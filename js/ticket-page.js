/* Montevia — page de conversation de ticket */

(function () {
  'use strict';

  var SUPABASE_URL = 'https://bylwvlxxvgumvqgpwgod.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_T3XYbDWXV5VaC8WQj3CZOQ_LmB7CTwv';

  var client = null;
  var currentUser = null;
  var isAdmin = false;
  var ticket = null;
  var messages = [];
  var participants = [];

  function getClient() {
    if (client) return client;
    if (!window.supabase || typeof window.supabase.createClient !== 'function') return null;
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return client;
  }

  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function getTicketId() {
    var params = new URLSearchParams(window.location.search);
    return params.get('id');
  }

  async function checkAdmin() {
    if (!currentUser) return false;
    try {
      var { data } = await client.from('profiles').select('role,status').eq('id', currentUser.id).maybeSingle();
      if (data && data.role === 'admin' && data.status === 'active') return true;
    } catch (e) {}
    try {
      var { data: acc } = await client.from('montevia_admin_access').select('user_id').eq('user_id', currentUser.id).maybeSingle();
      if (acc) return true;
    } catch (e) {}
    return false;
  }

  async function loadTicket() {
    var id = getTicketId();
    if (!id) { renderError('Aucun ticket spécifié.'); return; }

    var sb = getClient();
    if (!sb) { setTimeout(loadTicket, 500); return; }

    var { data: { session } } = await sb.auth.getSession();
    currentUser = session ? session.user : null;
    isAdmin = await checkAdmin();

    // Load ticket
    var { data: t, error } = await sb.from('montevia_tickets').select('*').eq('id', id).maybeSingle();
    if (error || !t) { renderError('Ticket introuvable.'); return; }
    ticket = t;

    // Load messages
    var { data: msgs } = await sb.from('montevia_ticket_messages').select('*').eq('ticket_id', id).order('created_at', { ascending: true });
    messages = msgs || [];

    // Load participants
    var { data: parts } = await sb.from('montevia_ticket_participants').select('*').eq('ticket_id', id);
    participants = parts || [];

    // Load opener profile
    if (ticket.user_id) {
      var { data: prof } = await sb.from('profiles').select('display_name,nickname').eq('id', ticket.user_id).maybeSingle();
      if (prof) ticket._openerName = prof.display_name || prof.nickname || ticket.user_id;
    }

    render();
  }

  function renderError(msg) {
    var page = document.getElementById('ticketPage');
    if (page) page.innerHTML = '<div class="ticket-page__error">' + escapeHtml(msg) + '</div>';
  }

  function render() {
    var page = document.getElementById('ticketPage');
    if (!page || !ticket) return;

    var isClosed = ticket.status === 'closed';
    var isClaimed = !!ticket.claimed_by;
    var isClaimedByMe = ticket.claimed_by === currentUser?.id;

    var html = '';

    // Header
    html += '<div class="ticket-page__header">';
    html += '<a href="support.html" class="btn btn--ghost btn--sm">← Retour</a>';
    html += '<div class="ticket-page__title">';
    html += '<h1>' + escapeHtml(ticket.subject) + '</h1>';
    html += '<span class="ticket-item__status ticket-item__status--' + (ticket.status === 'in_progress' ? 'in_progress' : ticket.status) + '">' + (ticket.status === 'open' ? 'Ouvert' : (ticket.status === 'in_progress' ? 'En cours' : 'Fermé')) + '</span>';
    html += '</div>';
    html += '</div>';

    // Info bar (admin only)
    if (isAdmin) {
      html += '<div class="ticket-page__info">';
      html += '<div class="ticket-info__row"><strong>Ouvert par :</strong> ' + escapeHtml(ticket._openerName || ticket.user_id || 'Anonyme') + '</div>';
      html += '<div class="ticket-info__row"><strong>ID :</strong> ' + escapeHtml(ticket.user_id || '—') + '</div>';
      html += '<div class="ticket-info__row"><strong>Discord :</strong> ' + escapeHtml(ticket.discord_username || '—') + '</div>';
      html += '<div class="ticket-info__row"><strong>Créé le :</strong> ' + new Date(ticket.created_at).toLocaleString('fr-FR') + '</div>';
      if (isClaimed) html += '<div class="ticket-info__row"><strong>Pris en charge par :</strong> ' + (isClaimedByMe ? 'Vous' : ticket.claimed_by) + '</div>';
      if (participants.length) html += '<div class="ticket-info__row"><strong>Participants :</strong> ' + participants.length + '</div>';
      html += '</div>';
    }

    // Actions (admin only)
    if (isAdmin) {
      html += '<div class="ticket-page__actions">';
      if (!isClaimed && !isClosed) {
        html += '<button class="btn btn--primary btn--sm" id="claimBtn">Prendre en charge</button>';
      }
      if (!isClosed) {
        html += '<button class="btn btn--secondary btn--sm" id="closeBtn">Fermer le ticket</button>';
      }
      html += '<button class="btn btn--ghost btn--sm" id="addPartBtn">+ Participant</button>';
      html += '<button class="btn btn--danger btn--sm" id="deleteBtn">Supprimer</button>';
      html += '</div>';
    }

    // Conversation
    html += '<div class="ticket-page__conv">';
    // Initial message
    html += '<div class="ticket-msg ticket-msg--user">';
    html += '<div class="ticket-msg__bubble">' + escapeHtml(ticket.message) + '</div>';
    html += '<div class="ticket-msg__time">' + escapeHtml(ticket.discord_username || 'Utilisateur') + ' · ' + new Date(ticket.created_at).toLocaleString('fr-FR') + '</div>';
    html += '</div>';

    messages.forEach(function (m) {
      html += '<div class="ticket-msg ticket-msg--' + m.sender_type + '">';
      html += '<div class="ticket-msg__bubble">' + escapeHtml(m.message) + '</div>';
      html += '<div class="ticket-msg__time">' + (m.sender_type === 'admin' ? 'Admin' : escapeHtml(ticket.discord_username || 'Utilisateur')) + ' · ' + new Date(m.created_at).toLocaleString('fr-FR') + '</div>';
      html += '</div>';
    });

    html += '</div>';

    // Reply form
    if (!isClosed && (isAdmin || currentUser?.id === ticket.user_id)) {
      html += '<form class="ticket-page__reply" id="replyForm">';
      html += '<textarea id="replyMsg" rows="3" placeholder="Votre réponse…" required></textarea>';
      html += '<button class="btn btn--primary" type="submit">Envoyer</button>';
      html += '</form>';
    } else if (isClosed) {
      html += '<p class="ticket-page__closed">Ce ticket est fermé.</p>';
    }

    page.innerHTML = html;

    // Bind events
    bindEvents();
  }

  function bindEvents() {
    var claimBtn = document.getElementById('claimBtn');
    if (claimBtn) claimBtn.addEventListener('click', async function () {
      await client.from('montevia_tickets').update({ claimed_by: currentUser.id, claimed_at: new Date().toISOString(), status: 'in_progress' }).eq('id', ticket.id);
      ticket.claimed_by = currentUser.id;
      ticket.claimed_at = new Date().toISOString();
      ticket.status = 'in_progress';
      render();
    });

    var closeBtn = document.getElementById('closeBtn');
    if (closeBtn) closeBtn.addEventListener('click', async function () {
      if (!confirm('Fermer ce ticket ?')) return;
      await client.from('montevia_tickets').update({ status: 'closed' }).eq('id', ticket.id);
      ticket.status = 'closed';
      render();
    });

    var deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) deleteBtn.addEventListener('click', async function () {
      if (!confirm('Supprimer définitivement ce ticket ?')) return;
      await client.from('montevia_tickets').delete().eq('id', ticket.id);
      window.location.href = 'support.html';
    });

    var addPartBtn = document.getElementById('addPartBtn');
    if (addPartBtn) addPartBtn.addEventListener('click', async function () {
      var uid = prompt('UUID de l\'utilisateur à ajouter :');
      if (!uid) return;
      await client.from('montevia_ticket_participants').insert({ ticket_id: ticket.id, user_id: uid.trim(), added_by: currentUser.id });
      alert('Participant ajouté.');
      loadTicket();
    });

    var replyForm = document.getElementById('replyForm');
    if (replyForm) replyForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var textarea = document.getElementById('replyMsg');
      var text = textarea.value.trim();
      if (!text) return;
      var senderType = isAdmin ? 'admin' : 'user';
      await client.from('montevia_ticket_messages').insert({
        ticket_id: ticket.id,
        sender_id: currentUser.id,
        sender_type: senderType,
        message: text
      });
      textarea.value = '';
      loadTicket();
    });
  }

  async function init() {
    await loadTicket();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();