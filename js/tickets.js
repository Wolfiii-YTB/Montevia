/* Montevia — système de tickets (login Discord) */

(function () {
  'use strict';

  var FALLBACK_CONFIG = {
    url: 'https://bylwvlxxvgumvqgpwgod.supabase.co',
    anonKey: 'sb_publishable_T3XYbDWXV5VaC8WQj3CZOQ_LmB7CTwv'
  };

  function getConfig() {
    return window.MONTEVIA_SUPABASE || FALLBACK_CONFIG;
  }

  var client = null;
  var currentUser = null;

  var STATUS_LABELS = { open: 'Ouvert', in_progress: 'En cours', closed: 'Fermé' };
  var CATEGORY_LABELS = {
    general: 'Général',
    bug: 'Bug',
    question: 'Question',
    suggestion: 'Suggestion',
    autre: 'Autre'
  };
  var PRIORITY_LABELS = { low: 'Basse', normal: 'Normale', high: 'Haute' };

  function getClient() {
    if (client) return client;
    if (!window.supabase || typeof window.supabase.createClient !== 'function') return null;
    var config = getConfig();
    if (!config || !config.url || !config.anonKey) return null;
    client = window.supabase.createClient(config.url, config.anonKey, {
      auth: { detectSessionInUrl: true, persistSession: true }
    });
    return client;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
    if (/JWT expired|Invalid JWT|refresh_token|session.*expired/i.test(message)) {
      return 'Ta session a expiré. Recharge la page et reconnecte-toi avec Discord.';
    }
    if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
      return 'Connexion impossible. Vérifie ton réseau puis réessaie.';
    }
    return message;
  }

  function statusClass(status) {
    return STATUS_LABELS[status] ? status : 'open';
  }

  function displayName() {
    var meta = (currentUser && currentUser.user_metadata) || {};
    return meta.preferred_username || meta.user_name || meta.name || meta.full_name || currentUser.email || 'Utilisateur';
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
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return tickets;
  }

  async function loadMyTickets() {
    var sb = getClient();
    if (!sb || !currentUser) return;
    var list = document.getElementById('ticketList');
    if (!list) return;

    var tickets;
    try {
      tickets = await fetchAccessibleTickets();
    } catch (error) {
      list.innerHTML = '<p class="ticket-list__error">' + escapeHtml(errorMessage(error)) + '</p>';
      return;
    }

    if (!tickets.length) {
      list.innerHTML = '<p class="ticket-list__empty">Aucun ticket pour le moment.</p>';
      return;
    }

    list.innerHTML = '';
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
      message.className = 'ticket-item__message';
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

      card.append(head, message, foot);
      list.append(card);
    });
  }

  async function handleLogin() {
    var sb = getClient();
    if (!sb) return;
    await sb.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: window.location.href }
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    var sb = getClient();
    if (!sb || !currentUser) {
      alert('Vous devez être connecté avec Discord pour créer un ticket.');
      return;
    }

    var subjectInput = document.getElementById('ticketSubject');
    var messageInput = document.getElementById('ticketMessage');
    var categoryInput = document.getElementById('ticketCategory');
    var priorityInput = document.getElementById('ticketPriority');
    var submitButton = document.querySelector('#ticketFormEl button[type="submit"]');

    var subject = subjectInput ? subjectInput.value.trim() : '';
    var message = messageInput ? messageInput.value.trim() : '';
    var category = categoryInput ? categoryInput.value : 'general';
    var priority = priorityInput ? priorityInput.value : 'normal';

    if (subject.length < 3) {
      alert('Le sujet doit contenir au moins 3 caractères.');
      return;
    }
    if (message.length < 10) {
      alert('Décris ton problème en quelques mots (10 caractères minimum).');
      return;
    }

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

      if (subjectInput) subjectInput.value = '';
      if (messageInput) messageInput.value = '';
      await loadMyTickets();
      alert('Ton ticket a bien été créé. Tu peux suivre la conversation et recevoir les réponses du staff.');
      var list = document.getElementById('ticketList');
      if (list) list.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      alert('Erreur : ' + errorMessage(error));
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        if (submitButton.dataset.label) submitButton.textContent = submitButton.dataset.label;
      }
    }
  }

  function init() {
    var loginBtn = document.getElementById('discordLoginBtn');
    if (loginBtn) loginBtn.addEventListener('click', handleLogin);

    var form = document.getElementById('ticketFormEl');
    if (form) form.addEventListener('submit', handleSubmit);

    checkSession();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
