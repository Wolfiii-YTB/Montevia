/* Montevia — système de tickets (login Discord).
   Inclut filtres, recherche et protections anti-spam côté client. */

(function () {
  'use strict';

  var FALLBACK_CONFIG = {
    url: 'https://bylwvlxxvgumvqgpwgod.supabase.co',
    anonKey: 'sb_publishable_T3XYbDWXV5VaC8WQj3CZOQ_LmB7CTwv'
  };

  var security = window.MonteviaSecurity || null;

  var STATUS_LABELS = { open: 'Ouvert', in_progress: 'En cours', closed: 'Fermé' };
  var CATEGORY_LABELS = {
    general: 'Général',
    bug: 'Bug',
    question: 'Question',
    suggestion: 'Suggestion',
    autre: 'Autre'
  };
  var PRIORITY_LABELS = { low: 'Basse', normal: 'Normale', high: 'Haute' };

  var MAX_SUBJECT = 120;
  var MAX_MESSAGE = 2000;
  var RATE_MAX_TICKETS = 3;
  var RATE_WINDOW_MS = 10 * 60 * 1000;
  var SUBMIT_COOLDOWN_MS = 20 * 1000;

  var client = null;
  var currentUser = null;
  var authTimer = null;
  var state = {
    tickets: [],
    filter: 'all',
    query: ''
  };

  function getConfig() {
    return window.MONTEVIA_SUPABASE || FALLBACK_CONFIG;
  }

  function escapeHtml(value) {
    if (security) return security.escapeHtml(value);
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitize(value, max) {
    if (security) return security.sanitizeText(value, max);
    return String(value == null ? '' : value).trim().slice(0, max || 4000);
  }

  function validate(value, options) {
    if (security) return security.validateSubmission(value, options);
    var text = String(value == null ? '' : value).trim();
    var min = options && options.min != null ? options.min : 1;
    var max = options && options.max != null ? options.max : 2000;
    if (text.length < min) return { ok: false, message: 'Le message est trop court.', text: text };
    if (text.length > max) return { ok: false, message: 'Le message est trop long.', text: text };
    return { ok: true, text: text, message: '' };
  }

  function errorMessage(error) {
    if (!error) return 'Une erreur inattendue est survenue.';
    var message = String(error.message || error);
    var code = error.code || '';
    if (code === '42P01' || /does not exist/i.test(message)) {
      return 'La table des tickets est introuvable. Exécutez le script SQL Montevia dans Supabase.';
    }
    if (code === '42501' || /row-level security|permission denied/i.test(message)) {
      return 'Action non autorisée. Vérifie que tu es bien connecté avec Discord.';
    }
    if (code === '23514' || /violates check constraint/i.test(message)) {
      return 'Les informations du ticket sont invalides. Vérifie le sujet et le message.';
    }
    if (/rate limit|too many|trop de/i.test(message)) {
      return 'Trop de demandes. Patiente quelques minutes avant de réessayer.';
    }
    if (/JWT expired|Invalid JWT|refresh_token|session.*expired/i.test(message)) {
      return 'Ta session a expiré. Recharge la page et reconnecte-toi avec Discord.';
    }
    if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
      return 'Connexion impossible. Vérifie ton réseau puis réessaie.';
    }
    return message;
  }

  function getClient() {
    if (client) return client;
    if (!window.supabase || typeof window.supabase.createClient !== 'function') return null;
    var config = getConfig();
    if (!config || !config.url || !config.anonKey) return null;
    client = window.supabase.createClient(config.url, config.anonKey, {
      auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true }
    });
    return client;
  }

  function statusClass(status) {
    return STATUS_LABELS[status] ? status : 'open';
  }

  function displayName() {
    var meta = (currentUser && currentUser.user_metadata) || {};
    return meta.preferred_username || meta.user_name || meta.name || meta.full_name || currentUser.email || 'Utilisateur';
  }

  function relativeTime(value) {
    if (!value) return '';
    var time = new Date(value).getTime();
    if (isNaN(time)) return '';
    var diff = Math.max(0, Date.now() - time);
    var minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "à l'instant";
    if (minutes < 60) return 'il y a ' + minutes + ' min';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return 'il y a ' + hours + ' h';
    var days = Math.floor(hours / 24);
    if (days < 7) return 'il y a ' + days + ' j';
    return new Date(value).toLocaleDateString('fr-FR');
  }

  async function checkSession() {
    var sb = getClient();
    if (!sb) { setTimeout(checkSession, 500); return; }

    try {
      var result = await sb.auth.getSession();
      currentUser = result && result.data && result.data.session ? result.data.session.user : null;
    } catch (e) {
      currentUser = null;
    }

    // Marquer l'utilisateur comme venant de Montevia (DevReports filtre ses notifications).
    if (currentUser && (!currentUser.user_metadata || currentUser.user_metadata.site !== 'montevia')) {
      try {
        await sb.auth.updateUser({ data: { site: 'montevia' } });
      } catch (e) { /* non bloquant */ }
    }

    renderAuth();
    if (currentUser) await loadMyTickets();
    else renderTickets();
  }

  function renderAuth() {
    var authDiv = document.getElementById('ticketAuth');
    var formDiv = document.getElementById('ticketForm');
    var userDiv = document.getElementById('ticketUser');
    if (!authDiv || !formDiv) return;

    if (currentUser) {
      authDiv.hidden = true;
      formDiv.hidden = false;
      if (userDiv) userDiv.textContent = 'Connecté en tant que ' + displayName();
    } else {
      authDiv.hidden = false;
      formDiv.hidden = true;
      if (userDiv) userDiv.textContent = '';
    }
  }

  async function fetchAccessibleTickets() {
    var sb = getClient();

    var ownResult = await sb
      .from('montevia_tickets')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (ownResult.error) throw ownResult.error;

    var tickets = Array.isArray(ownResult.data) ? ownResult.data.slice() : [];
    var ownIds = tickets.map(function (t) { return t.id; });

    var partResult = await sb
      .from('montevia_ticket_participants')
      .select('ticket_id')
      .eq('user_id', currentUser.id);

    var extraIds = [];
    if (!partResult.error && Array.isArray(partResult.data)) {
      partResult.data.forEach(function (row) {
        if (row.ticket_id && ownIds.indexOf(row.ticket_id) === -1 && extraIds.indexOf(row.ticket_id) === -1) {
          extraIds.push(row.ticket_id);
        }
      });
    }

    if (extraIds.length) {
      var sharedResult = await sb
        .from('montevia_tickets')
        .select('*')
        .in('id', extraIds)
        .order('created_at', { ascending: false });
      if (!sharedResult.error && Array.isArray(sharedResult.data)) {
        tickets = tickets.concat(sharedResult.data);
      }
    }

    tickets.sort(function (a, b) {
      var first = new Date(b.updated_at || b.created_at).getTime() || 0;
      var second = new Date(a.updated_at || a.created_at).getTime() || 0;
      return first - second;
    });
    return tickets;
  }

  function statusCount(status) {
    return state.tickets.filter(function (ticket) {
      return statusClass(ticket.status) === status;
    }).length;
  }

  function updateCounts() {
    var counts = {
      all: state.tickets.length,
      open: statusCount('open'),
      in_progress: statusCount('in_progress'),
      closed: statusCount('closed')
    };
    Object.keys(counts).forEach(function (key) {
      var node = document.querySelector('[data-count="' + key + '"]');
      if (node) node.textContent = String(counts[key]);
    });
  }

  function filteredTickets() {
    var query = state.query.trim().toLowerCase();
    return state.tickets.filter(function (ticket) {
      var status = statusClass(ticket.status);
      if (state.filter !== 'all' && status !== state.filter) return false;
      if (!query) return true;
      var haystack = [
        ticket.subject,
        ticket.message,
        ticket.discord_username,
        ticket.opener_name,
        CATEGORY_LABELS[ticket.category] || ticket.category
      ].join(' ').toLowerCase();
      return haystack.indexOf(query) !== -1;
    });
  }

  function renderTickets() {
    updateCounts();

    var list = document.getElementById('ticketList');
    if (!list) return;

    if (!currentUser) {
      list.innerHTML = '<p class="ticket-list__empty">Connecte-toi avec Discord pour voir tes tickets.</p>';
      return;
    }

    var tickets = filteredTickets();

    if (!tickets.length) {
      var message = state.tickets.length
        ? 'Aucun ticket ne correspond à ce filtre ou à cette recherche.'
        : 'Aucun ticket pour le moment.';
      list.innerHTML = '<p class="ticket-list__empty">' + escapeHtml(message) + '</p>';
      return;
    }

    var fragment = document.createDocumentFragment();

    tickets.forEach(function (ticket) {
      var card = document.createElement('a');
      card.className = 'ticket-item';
      card.href = 'ticket.html?id=' + encodeURIComponent(ticket.id);

      var status = statusClass(ticket.status);
      var head = document.createElement('div');
      head.className = 'ticket-item__head';

      var subject = document.createElement('span');
      subject.className = 'ticket-item__subject';
      subject.textContent = ticket.subject || 'Ticket';

      var date = document.createElement('span');
      date.className = 'ticket-item__date';
      date.textContent = ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('fr-FR') : '';

      head.append(subject, date);

      var message = document.createElement('p');
      message.className = 'ticket-item__message ticket-item__preview';
      message.textContent = ticket.message || '';

      var foot = document.createElement('div');
      foot.className = 'ticket-item__foot';

      var statusBadge = document.createElement('span');
      statusBadge.className = 'ticket-item__status ticket-item__status--' + status;
      statusBadge.textContent = STATUS_LABELS[status] || 'Ouvert';
      foot.append(statusBadge);

      var category = document.createElement('span');
      category.className = 'ticket-item__meta';
      category.textContent = (CATEGORY_LABELS[ticket.category] || 'Général') + ' · Priorité ' +
        (PRIORITY_LABELS[ticket.priority] || 'Normale');
      foot.append(category);

      if (ticket.claimed_by) {
        var claimed = document.createElement('span');
        claimed.className = 'ticket-item__claimed';
        claimed.textContent = 'Pris en charge';
        foot.append(claimed);
      }

      var activity = document.createElement('span');
      activity.className = 'ticket-item__activity';
      activity.textContent = relativeTime(ticket.updated_at || ticket.created_at);
      foot.append(activity);

      card.append(head, message, foot);
      fragment.append(card);
    });

    list.replaceChildren(fragment);
  }

  async function loadMyTickets() {
    var sb = getClient();
    if (!sb || !currentUser) return;
    var list = document.getElementById('ticketList');
    if (!list) return;

    try {
      state.tickets = await fetchAccessibleTickets();
    } catch (error) {
      list.innerHTML = '<p class="ticket-list__error">' + escapeHtml(errorMessage(error)) + '</p>';
      return;
    }

    renderTickets();
  }

  async function handleLogin() {
    var sb = getClient();
    if (!sb) return;
    try {
      await sb.auth.signInWithOAuth({
        provider: 'discord',
        options: { redirectTo: window.location.href }
      });
    } catch (error) {
      setFormStatus(errorMessage(error), 'error');
    }
  }

  function setFormStatus(message, type) {
    var status = document.getElementById('ticketFormStatus');
    if (!status) return;
    if (!message) {
      status.hidden = true;
      status.textContent = '';
      status.className = 'ticket-form__status';
      return;
    }
    status.hidden = false;
    status.textContent = message;
    status.className = 'ticket-form__status is-' + (type === 'success' ? 'success' : 'error');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    var sb = getClient();
    if (!sb || !currentUser) {
      setFormStatus('Vous devez être connecté avec Discord pour créer un ticket.', 'error');
      return;
    }

    var form = event.currentTarget;
    if (security && security.isHoneypotFilled(form, 'website')) {
      setFormStatus('Envoi bloqué pour raison de sécurité.', 'error');
      return;
    }

    var subjectInput = document.getElementById('ticketSubject');
    var messageInput = document.getElementById('ticketMessage');
    var categoryInput = document.getElementById('ticketCategory');
    var priorityInput = document.getElementById('ticketPriority');
    var submitButton = document.querySelector('#ticketFormEl button[type="submit"]');

    var subjectCheck = validate(subjectInput ? subjectInput.value : '', {
      min: 3,
      max: MAX_SUBJECT,
      maxLinks: 0,
      minMessage: 'Le sujet doit contenir au moins 3 caractères.',
      maxMessage: 'Le sujet est trop long (120 caractères maximum).'
    });
    if (!subjectCheck.ok) {
      setFormStatus(subjectCheck.message, 'error');
      if (subjectInput) subjectInput.focus();
      return;
    }

    var messageCheck = validate(messageInput ? messageInput.value : '', {
      min: 10,
      max: MAX_MESSAGE,
      maxLinks: 3,
      minMessage: 'Décris ton problème en quelques mots (10 caractères minimum).',
      maxMessage: 'Le message est trop long (2000 caractères maximum).'
    });
    if (!messageCheck.ok) {
      setFormStatus(messageCheck.message, 'error');
      if (messageInput) messageInput.focus();
      return;
    }

    if (security) {
      var cooldown = security.cooldownLeft('ticket-create-last', SUBMIT_COOLDOWN_MS);
      if (cooldown > 0) {
        setFormStatus('Patiente encore ' + security.humanDuration(cooldown) + ' avant d’envoyer un nouveau ticket.', 'error');
        return;
      }
      var rate = security.checkRate('ticket-create', RATE_MAX_TICKETS, RATE_WINDOW_MS);
      if (!rate.allowed) {
        setFormStatus('Limite atteinte : ' + RATE_MAX_TICKETS + ' tickets par 10 minutes. Réessaie dans ' +
          security.humanDuration(rate.retryAfterMs) + '.', 'error');
        return;
      }
    }

    var subject = sanitize(subjectCheck.text, MAX_SUBJECT);
    var message = sanitize(messageCheck.text, MAX_MESSAGE);
    var category = categoryInput ? categoryInput.value : 'general';
    var priority = priorityInput ? priorityInput.value : 'normal';

    if (['general', 'bug', 'question', 'suggestion', 'autre'].indexOf(category) === -1) category = 'general';
    if (['low', 'normal', 'high'].indexOf(priority) === -1) priority = 'normal';

    setFormStatus('', '');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.dataset.label = submitButton.textContent;
      submitButton.textContent = 'Envoi…';
    }

    try {
      var result = await sb.from('montevia_tickets').insert({
        user_id: currentUser.id,
        discord_username: displayName(),
        opener_name: displayName(),
        subject: subject,
        message: message,
        category: category,
        priority: priority,
        status: 'open'
      });

      if (result.error) throw result.error;

      if (security) {
        security.recordAction('ticket-create', RATE_WINDOW_MS);
        security.recordAction('ticket-create-last', SUBMIT_COOLDOWN_MS * 2);
        security.log('ticket-created', 'Ticket créé depuis le support');
      }

      if (subjectInput) subjectInput.value = '';
      if (messageInput) messageInput.value = '';
      setFormStatus('Ton ticket a bien été créé. Ouvre-le pour suivre la conversation avec le staff.', 'success');
      await loadMyTickets();
      var list = document.getElementById('ticketList');
      if (list) list.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      setFormStatus('Erreur : ' + errorMessage(error), 'error');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        if (submitButton.dataset.label) submitButton.textContent = submitButton.dataset.label;
      }
    }
  }

  function initFilters() {
    var buttons = document.querySelectorAll('.ticket-filter');
    Array.prototype.forEach.call(buttons, function (button) {
      button.addEventListener('click', function () {
        state.filter = button.getAttribute('data-filter') || 'all';
        Array.prototype.forEach.call(buttons, function (other) {
          var active = other === button;
          other.classList.toggle('is-active', active);
          other.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        renderTickets();
      });
    });

    var search = document.getElementById('ticketSearch');
    if (search) {
      var timer = null;
      search.addEventListener('input', function () {
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () {
          state.query = search.value || '';
          renderTickets();
        }, 150);
      });
    }
  }

  function init() {
    initFilters();

    var loginBtn = document.getElementById('discordLoginBtn');
    if (loginBtn) loginBtn.addEventListener('click', handleLogin);

    var form = document.getElementById('ticketFormEl');
    if (form) {
      if (security) security.installHoneypot(form, 'website');
      form.addEventListener('submit', handleSubmit);
    }

    var sb = getClient();
    if (sb && sb.auth && typeof sb.auth.onAuthStateChange === 'function') {
      sb.auth.onAuthStateChange(function () {
        if (authTimer) clearTimeout(authTimer);
        authTimer = setTimeout(checkSession, 250);
      });
    }

    renderTickets();
    checkSession();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
