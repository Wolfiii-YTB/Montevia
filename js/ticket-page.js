/* Montevia — page de conversation de ticket.
   Gère la session admin (sessionStorage) et la session utilisateur (localStorage). */

(function () {
  'use strict';

  var FALLBACK_CONFIG = {
    url: 'https://bylwvlxxvgumvqgpwgod.supabase.co',
    anonKey: 'sb_publishable_T3XYbDWXV5VaC8WQj3CZOQ_LmB7CTwv'
  };
  var CONFIG = window.MONTEVIA_SUPABASE || FALLBACK_CONFIG;
  var ADMIN_STORAGE_KEY = 'montevia-admin-auth';
  var MAX_MESSAGE = 2000;
  var POLL_INTERVAL = 4000;
  var security = window.MonteviaSecurity || null;
  var REALTIME_ENABLED = true;

  var STATUS_LABELS = { open: 'Ouvert', in_progress: 'En cours', closed: 'Fermé' };
  var CATEGORY_LABELS = {
    general: 'Général',
    bug: 'Bug',
    question: 'Question',
    suggestion: 'Suggestion',
    autre: 'Autre'
  };
  var PRIORITY_LABELS = { low: 'Basse', normal: 'Normale', high: 'Haute' };
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  var ICONS = {
    arrowLeft: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>',
    ticket: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6z"/><path d="M13 5v2"/><path d="M13 11v2"/><path d="M13 17v2"/></svg>',
    claim: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2 4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4z"/><path d="m9 12 2 2 4-4"/></svg>',
    release: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    reopen: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    link: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.5-1.5"/></svg>',
    send: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/></svg>',
    info: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>',
    closeSmall: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    alert: '<svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>'
  };

  var sb = null;
  var session = null;
  var currentUser = null;
  var isAdmin = false;
  var ticketId = null;
  var ticket = null;
  var messages = [];
  var participants = [];
  var namesById = {};
  var renderedIds = [];
  var pollTimer = null;
  var pollBusy = false;
  var lastParticipantsAt = 0;
  var composerKey = '';
  var toastTimer = null;
  var fatalShown = false;
  var realtimeChannel = null;
  var unreadCount = 0;
  var baseTitle = '';

  var el = {};

  function byId(id) {
    return document.getElementById(id);
  }

  function node(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = text;
    return element;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isUuid(value) {
    return UUID_RE.test(String(value || ''));
  }

  function shortId(value) {
    var text = String(value || '');
    if (text.length <= 14) return text || '—';
    return text.slice(0, 8) + '…' + text.slice(-4);
  }

  function formatDate(value) {
    if (!value) return '—';
    var date = new Date(value);
    if (isNaN(date.getTime())) return '—';
    try {
      return date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
      return date.toLocaleString('fr-FR');
    }
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error('timeout')); }, ms);
      })
    ]);
  }

  function errorMessage(error) {
    if (!error) return 'Une erreur inattendue est survenue.';
    var message = String(error.message || error);
    var code = error.code || '';

    if (/infinite recursion/i.test(message)) {
      return 'La configuration de la base doit être corrigée (RLS). Exécutez supabase/montevia_tickets_fix.sql.';
    }
    if (code === '42P17') {
      return 'La configuration de la base doit être corrigée (RLS). Exécutez supabase/montevia_tickets_fix.sql.';
    }
    if (code === '42P01' || /does not exist/i.test(message)) {
      return 'La table des tickets est introuvable. Exécutez le script SQL Montevia dans Supabase.';
    }
    if (code === '42703' || /column .* does not exist/i.test(message)) {
      return 'Une colonne de la base est manquante. Exécutez supabase/montevia_tickets_fix.sql.';
    }
    if (code === '42501' || /row-level security|permission denied/i.test(message)) {
      return 'Action non autorisée pour ce compte.';
    }
    if (/montevia_tickets_message_len_chk/.test(message)) {
      return 'Le message du ticket ne respecte pas les limites autorisées (2000 caractères maximum).';
    }
    if (/montevia_tickets_subject_len_chk/.test(message)) {
      return 'Le sujet du ticket ne respecte pas les limites autorisées (120 caractères maximum).';
    }
    if (/montevia_messages_len_chk/.test(message)) {
      return 'Le message ne respecte pas les limites autorisées (2000 caractères maximum).';
    }
    if (code === '23514' || /violates check constraint/i.test(message)) {
      return 'Les informations du ticket ne respectent pas les limites autorisées.';
    }
    if (code === '23505') {
      return 'Ce participant est déjà ajouté au ticket.';
    }
    if (/JWT expired|Invalid JWT|refresh_token|session.*expired/i.test(message)) {
      return 'Votre session a expiré. Reconnectez-vous depuis la page Support.';
    }
    if (/Failed to fetch|NetworkError|Load failed|timeout/i.test(message)) {
      return 'Connexion impossible. Vérifiez votre réseau puis réessayez.';
    }
    return message;
  }

  function toast(message, type) {
    var box = el.toast || byId('ticketToast');
    if (!box) return;
    box.textContent = message;
    box.className = 'ticket-toast ticket-toast--' + (type || 'info') + ' is-visible';
    box.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      box.classList.remove('is-visible');
      setTimeout(function () { box.hidden = true; }, 250);
    }, 4200);
  }

  function makeClient(authOptions) {
    var auth = Object.assign({
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }, authOptions || {});
    return window.supabase.createClient(CONFIG.url, CONFIG.anonKey, { auth: auth });
  }

  async function waitForSupabase() {
    for (var i = 0; i < 24; i += 1) {
      if (window.supabase && typeof window.supabase.createClient === 'function') return true;
      await sleep(250);
    }
    return false;
  }

  async function initClient() {
    var hasAdminSession = false;
    try {
      hasAdminSession = !!window.sessionStorage.getItem(ADMIN_STORAGE_KEY);
    } catch (e) { /* stockage indisponible */ }

    if (hasAdminSession) {
      var adminClient = makeClient({
        storage: window.sessionStorage,
        storageKey: ADMIN_STORAGE_KEY,
        detectSessionInUrl: false
      });
      try {
        var adminResult = await withTimeout(adminClient.auth.getSession(), 8000);
        if (adminResult && adminResult.data && adminResult.data.session && adminResult.data.session.user) {
          sb = adminClient;
          session = adminResult.data.session;
          currentUser = session.user;
          return;
        }
      } catch (e) {
        // Session admin expirée ou invalide : on retombe sur la session normale.
      }
    }

    var userClient = makeClient();
    try {
      var userResult = await withTimeout(userClient.auth.getSession(), 8000);
      sb = userClient;
      session = userResult && userResult.data ? userResult.data.session : null;
      currentUser = session ? session.user : null;
    } catch (e) {
      sb = userClient;
      session = null;
      currentUser = null;
    }
  }

  async function checkAdmin() {
    if (!currentUser) return false;

    try {
      var rpc = await withTimeout(sb.rpc('montevia_is_admin'), 8000);
      if (!rpc.error && typeof rpc.data === 'boolean') return rpc.data;
    } catch (e) {
      // On tente les vérifications de secours ci-dessous.
    }

    try {
      var profile = await sb.from('profiles').select('role,status').eq('id', currentUser.id).maybeSingle();
      if (profile.data && profile.data.role === 'admin' && profile.data.status === 'active') return true;
    } catch (e) { /* ignore */ }

    try {
      var access = await sb.from('montevia_admin_access').select('user_id').eq('user_id', currentUser.id).maybeSingle();
      if (access.data) return true;
    } catch (e) { /* ignore */ }

    return false;
  }

  function cacheElements() {
    el.app = byId('ticketApp');
    el.title = byId('ticketTitle');
    el.status = byId('ticketStatus');
    el.meta = byId('ticketMeta');
    el.actions = byId('ticketActions');
    el.chat = byId('ticketChat');
    el.sidebar = byId('ticketSidebar');
    el.sidebarToggle = byId('ticketSidebarToggle');
    el.sidebarClose = byId('ticketSidebarClose');
    el.backdrop = byId('ticketSidebarBackdrop');
    el.info = byId('ticketInfo');
    el.adminTools = byId('ticketAdminTools');
    el.categorySelect = byId('ticketCategorySelect');
    el.prioritySelect = byId('ticketPrioritySelect');
    el.addParticipantForm = byId('addParticipantForm');
    el.participantQuery = byId('participantQuery');
    el.participants = byId('ticketParticipants');
    el.input = byId('ticketInput');
    el.toast = byId('ticketToast');
  }

  function initUi() {
    if (el.sidebarToggle) {
      el.sidebarToggle.addEventListener('click', function () {
        var open = el.sidebar.classList.toggle('is-open');
        el.sidebarToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (el.backdrop) el.backdrop.hidden = !open;
      });
    }

    function closeSidebar() {
      if (!el.sidebar) return;
      el.sidebar.classList.remove('is-open');
      if (el.sidebarToggle) el.sidebarToggle.setAttribute('aria-expanded', 'false');
      if (el.backdrop) el.backdrop.hidden = true;
    }

    if (el.sidebarClose) el.sidebarClose.addEventListener('click', closeSidebar);
    if (el.backdrop) el.backdrop.addEventListener('click', closeSidebar);
    window.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeSidebar();
    });

    if (el.categorySelect) {
      el.categorySelect.addEventListener('change', function () {
        updateTicketField('category', el.categorySelect.value);
      });
    }
    if (el.prioritySelect) {
      el.prioritySelect.addEventListener('change', function () {
        updateTicketField('priority', el.prioritySelect.value);
      });
    }
    if (el.addParticipantForm) {
      el.addParticipantForm.addEventListener('submit', function (event) {
        event.preventDefault();
        addParticipant(el.participantQuery ? el.participantQuery.value : '');
      });
    }

    if (el.chat) {
      el.chat.addEventListener('click', function (event) {
        var deleteButton = event.target.closest('[data-delete-message]');
        if (deleteButton) {
          deleteMessage(deleteButton.getAttribute('data-delete-message'));
          return;
        }
        var copyButton = event.target.closest('[data-copy]');
        if (copyButton) copyText(copyButton.getAttribute('data-copy'));
      });
    }

    if (el.participants) {
      el.participants.addEventListener('click', function (event) {
        var removeButton = event.target.closest('[data-remove-participant]');
        if (removeButton) removeParticipant(removeButton.getAttribute('data-remove-participant'));
      });
    }

    if (el.info) {
      el.info.addEventListener('click', function (event) {
        var copyButton = event.target.closest('[data-copy]');
        if (copyButton) copyText(copyButton.getAttribute('data-copy'));
      });
    }
  }

  function fatal(message, detail) {
    if (fatalShown) return;
    fatalShown = true;
    stopPolling();
    var app = el.app || byId('ticketApp');
    if (!app) return;

    var wrap = document.createElement('div');
    wrap.className = 'ticket-fatal-wrap';

    var card = document.createElement('div');
    card.className = 'ticket-fatal';

    var icon = document.createElement('div');
    icon.className = 'ticket-fatal__icon';
    icon.innerHTML = ICONS.alert;

    var title = node('h1', '', 'Ticket indisponible');
    var text = node('p', '', message);

    var actions = document.createElement('div');
    actions.className = 'ticket-fatal__actions';

    var back = node('a', 'btn btn--primary', 'Retour au support');
    back.href = 'support.html';
    actions.append(back);

    if (!currentUser) {
      var login = node('a', 'btn btn--secondary', 'Se connecter');
      login.href = 'support.html';
      actions.append(login);
    }

    var retry = node('button', 'btn btn--secondary', 'Réessayer');
    retry.type = 'button';
    retry.addEventListener('click', function () { window.location.reload(); });
    actions.append(retry);

    card.append(icon, title, text);
    if (detail) {
      var details = document.createElement('details');
      details.className = 'ticket-fatal__details';
      var summary = node('summary', '', 'Détail technique');
      var pre = node('code', '', detail);
      details.append(summary, pre);
      card.append(details);
    }
    card.append(actions);
    wrap.append(card);

    app.replaceChildren(wrap);
    app.classList.add('ticket-app--fatal');
  }

  function gateway(data) {
    if (Array.isArray(data)) return data[0] || null;
    return data || null;
  }

  function openerName() {
    if (!ticket) return 'Utilisateur';
    return ticket.opener_name || namesById[ticket.user_id] || ticket.discord_username || 'Utilisateur';
  }

  function nameForId(id) {
    if (!id) return '—';
    if (currentUser && id === currentUser.id) return 'Vous';
    return namesById[id] || shortId(id);
  }

  async function loadNames(ids) {
    var unique = [];
    ids.forEach(function (id) {
      if (id && unique.indexOf(id) === -1) unique.push(id);
    });
    if (!unique.length) return;
    try {
      var result = await sb.from('profiles').select('id,display_name,nickname').in('id', unique);
      if (result.error || !Array.isArray(result.data)) return;
      result.data.forEach(function (profile) {
        var name = (profile.display_name && profile.display_name !== 'Membre') ? profile.display_name : null;
        name = name || (profile.nickname && profile.nickname !== 'Membre' ? profile.nickname : null);
        name = name || namesById[profile.id] || shortId(profile.id);
        namesById[profile.id] = name;
      });
    } catch (e) { /* les noms sont un bonus, pas un bloquant */ }
  }

  async function loadMessages() {
    var result = await withTimeout(
      sb.from('montevia_ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true }),
      15000
    );
    if (result.error) {
      if (result.error.code === '42P01') {
        messages = [];
        return;
      }
      throw result.error;
    }
    messages = Array.isArray(result.data) ? result.data : [];

    var ids = [ticket.user_id].concat(messages.map(function (message) { return message.sender_id; }));
    await loadNames(ids);
  }

  async function loadParticipants() {
    try {
      var result = await sb.from('montevia_ticket_participants')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      if (result.error) {
        participants = [];
        return;
      }
      participants = Array.isArray(result.data) ? result.data : [];
      await loadNames(participants.map(function (participant) { return participant.user_id; }));
    } catch (e) {
      participants = [];
    }
    lastParticipantsAt = Date.now();
  }

  async function boot() {
    cacheElements();
    if (!el.app) return;
    initUi();

    ticketId = new URLSearchParams(window.location.search).get('id');
    if (!ticketId || !isUuid(ticketId)) {
      fatal('Le lien de ce ticket est invalide. Vérifiez l’adresse ou retournez à la liste des tickets.');
      return;
    }

    var ready = await waitForSupabase();
    if (!ready) {
      fatal('Le module de connexion n’a pas pu être chargé. Vérifiez votre connexion puis rechargez la page.');
      return;
    }

    try {
      await initClient();
    } catch (e) {
      fatal('Impossible d’initialiser la session. Rechargez la page et réessayez.', errorMessage(e));
      return;
    }

    isAdmin = await checkAdmin();

    // Un ticket est privé : inutile d'interroger la base sans session,
    // cela évite une erreur 401 et affiche directement la connexion.
    if (!currentUser) {
      fatal('Connectez-vous avec le compte qui a ouvert ce ticket pour voir la conversation.');
      return;
    }

    var result;
    try {
      result = await withTimeout(
        sb.from('montevia_tickets').select('*').eq('id', ticketId).maybeSingle(),
        15000
      );
    } catch (e) {
      fatal(errorMessage(e), String(e && e.message ? e.message : e));
      return;
    }

    if (result.error) {
      fatal(errorMessage(result.error), result.error.message || String(result.error));
      return;
    }

    if (!result.data) {
      fatal('Ticket introuvable ou accès refusé. Vérifiez que vous êtes connecté avec le bon compte (ouvreur, participant ou staff).');
      return;
    }

    ticket = result.data;
    try {
      await Promise.all([loadMessages(), loadParticipants()]);
    } catch (e) {
      fatal(errorMessage(e), String(e && e.message ? e.message : e));
      return;
    }

    renderAll();
    startPolling();
    startRealtime();
  }

  function renderAll() {
    document.title = (ticket.subject || 'Ticket') + ' — Montevia';
    baseTitle = document.title;
    renderHeader();
    renderChat(true);
    renderInfo();
    renderParticipants();
    renderAdminTools();
    renderComposer();
  }

  function appendPill(container, text, className) {
    var pill = node('span', 'ticket-pill ' + (className || ''), text);
    container.append(pill);
    return pill;
  }

  function createAction(label, className, icon, handler) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'ticket-btn ' + className;
    if (icon) {
      var iconWrap = document.createElement('span');
      iconWrap.className = 'ticket-btn__icon';
      iconWrap.innerHTML = icon;
      button.append(iconWrap);
    }
    button.append(node('span', 'ticket-btn__label', label));
    button.addEventListener('click', handler);
    return button;
  }

  function renderHeader() {
    var status = ticket.status || 'open';
    el.title.textContent = ticket.subject || 'Ticket';
    el.status.textContent = STATUS_LABELS[status] || status;
    el.status.className = 'ticket-header__status ticket-header__status--' + status;
    el.status.hidden = false;

    if (el.meta) {
      el.meta.replaceChildren();
      appendPill(el.meta, CATEGORY_LABELS[ticket.category] || ticket.category || 'Général', 'ticket-pill--category');
      appendPill(el.meta, 'Priorité ' + (PRIORITY_LABELS[ticket.priority] || ticket.priority || 'Normale'), 'ticket-pill--' + (ticket.priority || 'normal'));
      if (ticket.claimed_by) {
        appendPill(el.meta, 'Pris en charge', 'ticket-pill--claimed');
      }
    }

    el.actions.replaceChildren();

    var copyButton = createAction('Lien', 'ticket-btn--copy', ICONS.link, copyTicketLink);
    copyButton.title = 'Copier le lien du ticket';
    el.actions.append(copyButton);

    if (isAdmin) {
      if (status !== 'closed') {
        if (!ticket.claimed_by) {
          el.actions.append(createAction('Prendre en charge', 'ticket-btn--claim', ICONS.claim, claimTicket));
        } else if (ticket.claimed_by === (currentUser && currentUser.id)) {
          el.actions.append(createAction('Relâcher', 'ticket-btn--release', ICONS.release, releaseTicket));
        }
        el.actions.append(createAction('Fermer', 'ticket-btn--close', ICONS.close, function () {
          changeStatus('closed');
        }));
      } else {
        el.actions.append(createAction('Rouvrir', 'ticket-btn--reopen', ICONS.reopen, function () {
          changeStatus('open');
        }));
      }
      el.actions.append(createAction('Supprimer', 'ticket-btn--delete', ICONS.trash, deleteTicket));
    } else if (currentUser && ticket.user_id === currentUser.id && status !== 'closed') {
      el.actions.append(createAction('Fermer', 'ticket-btn--close', ICONS.close, function () {
        changeStatus('closed');
      }));
    }
  }

  function messageItems() {
    var initial = {
      id: 'initial',
      sender_id: ticket.user_id,
      sender_type: 'user',
      message: ticket.message,
      created_at: ticket.created_at,
      is_internal: false,
      initial: true
    };
    return [initial].concat(messages);
  }

  function messageAuthor(message) {
    if (message.initial) return openerName();
    if (message.sender_type === 'admin') {
      if (currentUser && message.sender_id === currentUser.id) return 'Vous';
      return namesById[message.sender_id] || 'Staff Montevia';
    }
    if (message.sender_id && message.sender_id === ticket.user_id) return openerName();
    return namesById[message.sender_id] || 'Participant';
  }

  function createMessageNode(message) {
    var author = messageAuthor(message);
    var isAdminMessage = message.sender_type === 'admin';
    var article = document.createElement('article');
    article.className = 'ticket-msg ticket-msg--' + (isAdminMessage ? 'admin' : 'user');
    if (message.is_internal) article.classList.add('ticket-msg--internal');
    if (currentUser && message.sender_id === currentUser.id) article.classList.add('ticket-msg--own');
    article.setAttribute('data-id', String(message.id));

    var avatar = node('div', 'ticket-msg__avatar', String(author || '?').charAt(0).toUpperCase());
    article.append(avatar);

    var content = node('div', 'ticket-msg__content');
    var meta = node('div', 'ticket-msg__meta');
    meta.append(node('span', 'ticket-msg__author', author));
    if (isAdminMessage) meta.append(node('span', 'ticket-msg__role', 'STAFF'));
    meta.append(node('span', 'ticket-msg__time', formatDate(message.created_at)));

    if (message.is_internal) {
      var internalBadge = node('span', 'ticket-msg__internal-badge');
      var lock = document.createElement('span');
      lock.className = 'ticket-msg__internal-icon';
      lock.innerHTML = ICONS.lock;
      internalBadge.append(lock, node('span', '', 'Note interne'));
      meta.append(internalBadge);
    }

    if (isAdmin && !message.initial) {
      var deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'ticket-msg__delete';
      deleteButton.setAttribute('data-delete-message', String(message.id));
      deleteButton.setAttribute('aria-label', 'Supprimer ce message');
      deleteButton.title = 'Supprimer ce message';
      deleteButton.innerHTML = ICONS.trash;
      meta.append(deleteButton);
    }

    content.append(meta);
    content.append(node('div', 'ticket-msg__bubble', message.message || ''));
    article.append(content);
    return article;
  }

  function renderChat(force) {
    if (!el.chat) return;
    var items = messageItems();
    var ids = items.map(function (item) { return String(item.id); });
    var previous = renderedIds;
    var appendOnly = !force && previous.length > 0 && ids.length > previous.length &&
      previous.every(function (id, index) { return ids[index] === id; });

    var chat = el.chat;
    var nearBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 100;

    if (appendOnly) {
      var fragment = document.createDocumentFragment();
      items.slice(previous.length).forEach(function (item) {
        fragment.append(createMessageNode(item));
      });
      chat.append(fragment);
    } else {
      var all = document.createDocumentFragment();
      items.forEach(function (item) {
        all.append(createMessageNode(item));
      });
      chat.replaceChildren(all);
    }

    renderedIds = ids;

    if (nearBottom || force || (messages.length && messages[messages.length - 1].sender_id === (currentUser && currentUser.id))) {
      chat.scrollTop = chat.scrollHeight;
    }
  }

  function copyText(text) {
    if (!text) return;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () {
        toast('Copié dans le presse-papiers.', 'success');
      }).catch(function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    try {
      document.execCommand('copy');
      toast('Copié dans le presse-papiers.', 'success');
    } catch (e) {
      toast('Impossible de copier automatiquement.', 'error');
    }
    area.remove();
  }

  function copyTicketLink() {
    copyText(window.location.href);
  }

  function infoRow(label, value) {
    var row = node('div', 'ticket-info__row');
    row.append(node('span', 'ticket-info__label', label));
    var valueNode = node('div', 'ticket-info__value');
    if (value instanceof Node) {
      valueNode.append(value);
    } else {
      valueNode.textContent = value == null ? '—' : String(value);
    }
    row.append(valueNode);
    return row;
  }

  function copyableId(id) {
    var wrap = document.createElement('span');
    wrap.className = 'ticket-id';
    var code = document.createElement('code');
    code.textContent = shortId(id);
    code.title = id;
    wrap.append(code);
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'ticket-copy';
    button.setAttribute('data-copy', id);
    button.setAttribute('aria-label', 'Copier l’identifiant');
    button.title = 'Copier l’identifiant';
    button.innerHTML = ICONS.copy;
    wrap.append(button);
    return wrap;
  }

  function priorityNode(priority) {
    var value = priority || 'normal';
    return node('span', 'ticket-pill ticket-pill--' + value, PRIORITY_LABELS[value] || value);
  }

  function renderInfo() {
    if (!el.info) return;
    el.info.replaceChildren();

    el.info.append(infoRow('Ouvert par', openerName()));
    el.info.append(infoRow('Pseudo Discord', ticket.discord_username || 'Non renseigné'));
    el.info.append(infoRow('ID du membre', copyableId(ticket.user_id)));
    el.info.append(infoRow('Catégorie', CATEGORY_LABELS[ticket.category] || ticket.category || 'Général'));
    el.info.append(infoRow('Priorité', priorityNode(ticket.priority)));
    var status = ticket.status || 'open';
    el.info.append(infoRow('Statut', node('span', 'ticket-header__status ticket-header__status--' + status, STATUS_LABELS[status] || status)));
    el.info.append(infoRow('Créé le', formatDate(ticket.created_at)));
    el.info.append(infoRow('Dernière activité', formatDate(ticket.updated_at || ticket.created_at)));
    if (ticket.claimed_by) {
      el.info.append(infoRow('Pris en charge par', nameForId(ticket.claimed_by)));
      if (ticket.claimed_at) {
        el.info.append(infoRow('Pris en charge le', formatDate(ticket.claimed_at)));
      }
    }
    if (status === 'closed' && ticket.closed_at) {
      el.info.append(infoRow('Fermé le', formatDate(ticket.closed_at)));
    }
  }

  function renderParticipants() {
    if (!el.participants) return;
    el.participants.replaceChildren();

    if (!participants.length) {
      el.participants.append(node('p', 'ticket-empty-small', 'Aucun participant. Ajoutez des membres pour les inviter dans la conversation.'));
      return;
    }

    participants.forEach(function (participant) {
      var name = namesById[participant.user_id] || 'Participant';
      var row = node('div', 'ticket-participant');

      var avatar = node('span', 'ticket-participant__avatar', String(name).charAt(0).toUpperCase());
      var main = node('div', 'ticket-participant__main');
      main.append(node('span', 'ticket-participant__name', name));
      main.append(node('span', 'ticket-participant__id', shortId(participant.user_id)));
      row.append(avatar, main);

      if (isAdmin) {
        var remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'ticket-participant__remove';
        remove.setAttribute('data-remove-participant', participant.user_id);
        remove.setAttribute('aria-label', 'Retirer ce participant');
        remove.title = 'Retirer ce participant';
        remove.innerHTML = ICONS.closeSmall;
        row.append(remove);
      }

      el.participants.append(row);
    });
  }

  function renderAdminTools() {
    if (!el.adminTools) return;
    el.adminTools.hidden = !isAdmin;
    if (!isAdmin) return;
    if (el.categorySelect) el.categorySelect.value = ticket.category || 'general';
    if (el.prioritySelect) el.prioritySelect.value = ticket.priority || 'normal';
  }

  function canParticipate() {
    if (!currentUser || !ticket) return false;
    if (isAdmin) return true;
    if (ticket.user_id === currentUser.id) return true;
    return participants.some(function (participant) {
      return participant.user_id === currentUser.id;
    });
  }

  function renderComposer() {
    if (!el.input) return;
    var key = [
      ticket.status || 'open',
      currentUser ? currentUser.id : 'anon',
      isAdmin ? 'admin' : 'user',
      canParticipate() ? 'member' : 'outsider'
    ].join('|');

    if (key === composerKey && el.input.querySelector('#replyMsg')) return;

    var previous = el.input.querySelector('#replyMsg');
    var draft = previous ? previous.value : '';
    var selection = previous && typeof previous.selectionStart === 'number' ? previous.selectionStart : null;
    composerKey = key;

    el.input.replaceChildren();

    var status = ticket.status || 'open';

    if (!currentUser) {
      var loginBox = node('div', 'ticket-input__closed');
      loginBox.append(node('span', '', 'Connectez-vous pour participer à la conversation. '));
      var loginLink = node('a', 'ticket-input__link', 'Se connecter');
      loginLink.href = 'support.html';
      loginBox.append(loginLink);
      el.input.append(loginBox);
      return;
    }

    if (status === 'closed') {
      var closedBox = node('div', 'ticket-input__closed');
      closedBox.append(node('span', '', 'Ce ticket est fermé.'));
      if (isAdmin) {
        var reopen = node('button', 'btn btn--secondary btn--sm', 'Rouvrir le ticket');
        reopen.type = 'button';
        reopen.addEventListener('click', function () { changeStatus('open'); });
        closedBox.append(reopen);
      }
      el.input.append(closedBox);
      return;
    }

    if (!canParticipate()) {
      el.input.append(node('div', 'ticket-input__closed', 'Vous ne participez pas à ce ticket. Demandez au staff de vous ajouter.'));
      return;
    }

    var form = document.createElement('form');
    form.id = 'replyForm';
    form.className = 'ticket-input__form';

    var textarea = document.createElement('textarea');
    textarea.id = 'replyMsg';
    textarea.rows = 1;
    textarea.maxLength = MAX_MESSAGE;
    textarea.placeholder = isAdmin ? 'Répondre au ticket… (ou ajouter une note interne)' : 'Écrire un message…';
    textarea.value = draft;
    textarea.setAttribute('aria-label', 'Votre message');

    var send = document.createElement('button');
    send.type = 'submit';
    send.id = 'replySend';
    send.className = 'ticket-input__send';
    send.title = 'Envoyer';
    send.setAttribute('aria-label', 'Envoyer le message');
    send.innerHTML = ICONS.send;

    form.append(textarea, send);

    var footer = node('div', 'ticket-input__footer');
    if (isAdmin) {
      var internalLabel = document.createElement('label');
      internalLabel.className = 'ticket-internal-toggle';
      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = 'internalNote';
      internalLabel.append(checkbox, node('span', '', 'Note interne (staff uniquement)'));
      footer.append(internalLabel);
    }

    var counter = node('span', 'ticket-input__counter', '0/' + MAX_MESSAGE);
    footer.append(counter);

    var hint = node('p', 'ticket-input__hint', 'Entrée pour envoyer · Maj + Entrée pour un saut de ligne');

    el.input.append(form, footer, hint);

    function updateCounter() {
      var length = textarea.value.length;
      counter.textContent = length + '/' + MAX_MESSAGE;
      counter.classList.toggle('is-near-limit', length > MAX_MESSAGE - 200);
    }

    function autoResize() {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px';
    }

    textarea.addEventListener('input', function () {
      updateCounter();
      autoResize();
    });

    textarea.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    });

    form.addEventListener('submit', sendMessage);

    updateCounter();
    autoResize();

    if (draft && selection !== null) {
      textarea.focus();
      textarea.setSelectionRange(selection, selection);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!currentUser) {
      toast('Connectez-vous pour répondre.', 'error');
      return;
    }

    var textarea = byId('replyMsg');
    var sendButton = byId('replySend');
    var raw = textarea ? textarea.value : '';

    var check = security
      ? security.validateSubmission(raw, {
        min: 1,
        max: MAX_MESSAGE,
        maxLinks: 3,
        minMessage: 'Écrivez un message avant d’envoyer.',
        maxMessage: 'Le message est trop long (2000 caractères maximum).'
      })
      : { ok: String(raw || '').trim().length > 0, text: String(raw || '').trim(), message: 'Écrivez un message avant d’envoyer.' };

    if (!check.ok) {
      toast(check.message || 'Message invalide.', 'error');
      return;
    }

    if (security) {
      var cooldown = security.cooldownLeft('ticket-message-last', 2500);
      if (cooldown > 0) {
        toast('Patiente encore ' + security.humanDuration(cooldown) + ' avant d’envoyer un autre message.', 'error');
        return;
      }
      var rate = security.checkRate('ticket-message', 20, 2 * 60 * 1000);
      if (!rate.allowed) {
        toast('Limite atteinte : 20 messages par 2 minutes. Réessayez dans ' +
          security.humanDuration(rate.retryAfterMs) + '.', 'error');
        return;
      }
    }

    var text = security ? security.sanitizeText(check.text, MAX_MESSAGE) : String(check.text).trim();

    var internalBox = byId('internalNote');
    var isInternal = !!(isAdmin && internalBox && internalBox.checked);

    if (sendButton) sendButton.disabled = true;
    if (textarea) textarea.setAttribute('aria-busy', 'true');

    var payload = {
      ticket_id: ticketId,
      sender_id: currentUser.id,
      sender_type: isAdmin ? 'admin' : 'user',
      message: text
    };
    if (isAdmin) payload.is_internal = isInternal;

    var result;
    try {
      result = await sb.from('montevia_ticket_messages').insert(payload).select('*').single();
    } catch (e) {
      result = { error: e };
    }

    if (sendButton) sendButton.disabled = false;
    if (textarea) textarea.removeAttribute('aria-busy');

    if (result.error) {
      toast(errorMessage(result.error), 'error');
      return;
    }

    messages.push(result.data);
    ticket.updated_at = result.data.created_at || new Date().toISOString();

    if (security) {
      security.recordAction('ticket-message', 2 * 60 * 1000);
      security.recordAction('ticket-message-last', 5000);
    }

    if (textarea) {
      textarea.value = '';
      textarea.style.height = 'auto';
    }
    var counter = el.input.querySelector('.ticket-input__counter');
    if (counter) counter.textContent = '0/' + MAX_MESSAGE;

    renderChat();
    renderInfo();
    toast(isInternal ? 'Note interne ajoutée.' : 'Message envoyé.', 'success');
  }

  async function updateTicketField(field, value) {
    if (!isAdmin || !ticket) return;
    var previous = ticket[field];

    var result;
    try {
      result = await sb.from('montevia_tickets')
        .update({ [field]: value })
        .eq('id', ticketId)
        .select('*')
        .maybeSingle();
    } catch (e) {
      result = { error: e };
    }

    if (result.error || !result.data) {
      toast(errorMessage(result.error) || 'Mise à jour impossible.', 'error');
      if (field === 'category' && el.categorySelect) el.categorySelect.value = previous || 'general';
      if (field === 'priority' && el.prioritySelect) el.prioritySelect.value = previous || 'normal';
      return;
    }

    ticket = result.data;
    renderHeader();
    renderInfo();
    renderAdminTools();
    toast('Ticket mis à jour.', 'success');
  }

  async function changeStatus(status) {
    if (!ticket) return;
    if (status === 'closed' && !window.confirm('Fermer ce ticket ? Vous ne pourrez plus y répondre tant qu’il n’est pas rouvert.')) {
      return;
    }

    var result;
    try {
      result = await sb.rpc('montevia_set_ticket_status', {
        p_ticket_id: ticketId,
        p_status: status
      });
    } catch (e) {
      result = { error: e };
    }

    if (result.error) {
      if (result.error.code === '42883' && isAdmin) {
        var fallback = await sb.from('montevia_tickets')
          .update({ status: status })
          .eq('id', ticketId)
          .select('*')
          .maybeSingle();
        if (!fallback.error && fallback.data) {
          ticket = fallback.data;
          afterStatusChange(status);
          return;
        }
      }
      toast(errorMessage(result.error), 'error');
      return;
    }

    var updated = gateway(result.data);
    ticket = updated || Object.assign({}, ticket, {
      status: status,
      closed_at: status === 'closed' ? new Date().toISOString() : null
    });
    afterStatusChange(status);
  }

  function afterStatusChange(status) {
    renderHeader();
    renderInfo();
    renderChat(true);
    renderComposer();
    toast(status === 'closed' ? 'Ticket fermé.' : 'Ticket rouvert.', 'success');
  }

  async function claimTicket() {
    if (!isAdmin || !currentUser) return;
    var result;
    try {
      result = await sb.from('montevia_tickets')
        .update({
          claimed_by: currentUser.id,
          claimed_at: new Date().toISOString(),
          status: 'in_progress'
        })
        .eq('id', ticketId)
        .select('*')
        .maybeSingle();
    } catch (e) {
      result = { error: e };
    }

    if (result.error || !result.data) {
      toast(errorMessage(result.error) || 'Impossible de prendre en charge ce ticket.', 'error');
      return;
    }

    ticket = result.data;
    renderHeader();
    renderInfo();
    renderComposer();
    toast('Ticket pris en charge.', 'success');
  }

  async function releaseTicket() {
    if (!isAdmin) return;
    var result;
    try {
      result = await sb.from('montevia_tickets')
        .update({
          claimed_by: null,
          claimed_at: null,
          status: 'open'
        })
        .eq('id', ticketId)
        .select('*')
        .maybeSingle();
    } catch (e) {
      result = { error: e };
    }

    if (result.error || !result.data) {
      toast(errorMessage(result.error) || 'Impossible de relâcher ce ticket.', 'error');
      return;
    }

    ticket = result.data;
    renderHeader();
    renderInfo();
    renderComposer();
    toast('Ticket remis dans la file.', 'success');
  }

  async function deleteTicket() {
    if (!isAdmin) return;
    if (!window.confirm('Supprimer définitivement ce ticket et toute sa conversation ?')) return;

    var result;
    try {
      result = await sb.from('montevia_tickets').delete().eq('id', ticketId);
    } catch (e) {
      result = { error: e };
    }

    if (result.error) {
      toast(errorMessage(result.error), 'error');
      return;
    }

    stopPolling();
    window.location.href = 'support.html';
  }

  async function deleteMessage(id) {
    if (!isAdmin || !id || id === 'initial') return;
    if (!window.confirm('Supprimer ce message ?')) return;

    var result;
    try {
      result = await sb.from('montevia_ticket_messages').delete().eq('id', id);
    } catch (e) {
      result = { error: e };
    }

    if (result.error) {
      toast(errorMessage(result.error), 'error');
      return;
    }

    messages = messages.filter(function (message) { return String(message.id) !== String(id); });
    renderChat(true);
    toast('Message supprimé.', 'success');
  }

  async function resolveParticipantId(query) {
    var value = String(query || '').trim();
    if (!value) throw new Error('Indiquez un UUID, un pseudo Discord ou un nom.');

    if (isUuid(value)) return value;

    var tickets = await sb.from('montevia_tickets')
      .select('user_id,discord_username')
      .ilike('discord_username', '%' + value + '%')
      .not('user_id', 'is', null)
      .limit(10);

    if (!tickets.error && Array.isArray(tickets.data)) {
      var ids = [];
      tickets.data.forEach(function (row) {
        if (row.user_id && ids.indexOf(row.user_id) === -1) ids.push(row.user_id);
      });
      if (ids.length === 1) return ids[0];
      if (ids.length > 1) throw new Error('Plusieurs comptes correspondent à ce pseudo. Utilisez l’UUID du compte.');
    }

    var profiles = await sb.from('profiles')
      .select('id,display_name,nickname')
      .ilike('display_name', '%' + value + '%')
      .limit(10);

    if (!profiles.error && Array.isArray(profiles.data) && profiles.data.length) {
      if (profiles.data.length === 1) return profiles.data[0].id;
      throw new Error('Plusieurs comptes correspondent à ce nom. Utilisez l’UUID du compte.');
    }

    var nicknames = await sb.from('profiles')
      .select('id,display_name,nickname')
      .ilike('nickname', '%' + value + '%')
      .limit(10);

    if (!nicknames.error && Array.isArray(nicknames.data) && nicknames.data.length) {
      if (nicknames.data.length === 1) return nicknames.data[0].id;
      throw new Error('Plusieurs comptes correspondent à ce pseudo. Utilisez l’UUID du compte.');
    }

    throw new Error('Aucun compte trouvé. Vérifiez le pseudo ou utilisez l’UUID du compte.');
  }

  async function addParticipant(query) {
    if (!isAdmin) return;
    if (!query || !String(query).trim()) {
      toast('Indiquez un UUID, un pseudo Discord ou un nom.', 'error');
      return;
    }

    var button = el.addParticipantForm ? el.addParticipantForm.querySelector('button[type="submit"]') : null;
    if (button) button.disabled = true;

    try {
      var userId = await resolveParticipantId(query);
      if (userId === ticket.user_id) {
        toast('L’ouvreur du ticket a déjà accès à la conversation.', 'info');
        return;
      }
      var result = await sb.from('montevia_ticket_participants').insert({
        ticket_id: ticketId,
        user_id: userId,
        added_by: currentUser.id
      });
      if (result.error) throw result.error;

      if (el.participantQuery) el.participantQuery.value = '';
      await loadParticipants();
      renderParticipants();
      toast('Participant ajouté.', 'success');
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function removeParticipant(userId) {
    if (!isAdmin || !userId) return;
    if (!window.confirm('Retirer ce participant du ticket ?')) return;

    var result;
    try {
      result = await sb.from('montevia_ticket_participants')
        .delete()
        .eq('ticket_id', ticketId)
        .eq('user_id', userId);
    } catch (e) {
      result = { error: e };
    }

    if (result.error) {
      toast(errorMessage(result.error), 'error');
      return;
    }

    participants = participants.filter(function (participant) {
      return participant.user_id !== userId;
    });
    renderParticipants();
    renderComposer();
    toast('Participant retiré.', 'success');
  }

  function updateTitleWithUnread() {
    var title = baseTitle || document.title;
    document.title = unreadCount > 0 ? '(' + unreadCount + ') ' + title : title;
  }

  async function refresh() {
    if (pollBusy || !sb || !ticket || document.hidden) return;
    pollBusy = true;
    try {
      var results = await Promise.all([
        withTimeout(sb.from('montevia_tickets').select('*').eq('id', ticketId).maybeSingle(), 12000),
        withTimeout(sb.from('montevia_ticket_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true }), 12000)
      ]);

      var ticketResult = results[0];
      var messageResult = results[1];

      if (ticketResult.data) {
        var previousStatus = ticket.status;
        var previousClaim = ticket.claimed_by;
        var previousUpdated = ticket.updated_at;
        ticket = ticketResult.data;
        if (ticket.updated_at !== previousUpdated || ticket.status !== previousStatus || ticket.claimed_by !== previousClaim) {
          renderHeader();
          renderInfo();
          if (previousStatus !== ticket.status) renderComposer();
        }
      }

      if (!messageResult.error && Array.isArray(messageResult.data)) {
        var previousCount = messages.length;
        var oldIds = messages.map(function (message) { return String(message.id); }).join(',');
        var newIds = messageResult.data.map(function (message) { return String(message.id); }).join(',');
        if (oldIds !== newIds) {
          messages = messageResult.data;

          if (messages.length > previousCount) {
            var chat = el.chat;
            var nearBottom = chat ? chat.scrollHeight - chat.scrollTop - chat.clientHeight < 150 : false;
            if (document.hidden || !nearBottom) {
              unreadCount += messages.length - previousCount;
              updateTitleWithUnread();
            }
          }

          await loadNames(messages.map(function (message) { return message.sender_id; }));
          renderChat();
        }
      }

      if (Date.now() - lastParticipantsAt > 20000) {
        await loadParticipants();
        renderParticipants();
      }
    } catch (e) {
      // Le polling est silencieux : on ne spamme pas l'utilisateur.
    } finally {
      pollBusy = false;
    }
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(refresh, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  /* Temps réel Supabase : les nouveaux messages arrivent instantanément.
     Le polling reste actif comme filet de sécurité si Realtime est indisponible. */
  function startRealtime() {
    stopRealtime();
    if (!REALTIME_ENABLED || !sb || typeof sb.channel !== 'function') return;

    try {
      realtimeChannel = sb.channel('montevia-ticket-' + ticketId);

      realtimeChannel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'montevia_ticket_messages', filter: 'ticket_id=eq.' + ticketId },
        function () { refresh(); }
      );

      realtimeChannel.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'montevia_tickets', filter: 'id=eq.' + ticketId },
        function () { refresh(); }
      );

      realtimeChannel.subscribe(function (status) {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          REALTIME_ENABLED = false;
          stopRealtime();
        }
      });
    } catch (e) {
      REALTIME_ENABLED = false;
      stopRealtime();
    }
  }

  function stopRealtime() {
    if (realtimeChannel && sb) {
      try { sb.removeChannel(realtimeChannel); } catch (e) { /* ignore */ }
    }
    realtimeChannel = null;
  }

  window.addEventListener('beforeunload', function () {
    stopPolling();
    stopRealtime();
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      unreadCount = 0;
      updateTitleWithUnread();
      refresh();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
