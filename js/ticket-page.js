/* Montevia — page de conversation de ticket (style Discord) */

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
  var openerProfile = null;

  function getClient() {
    if (client) return client;
    if (!window.supabase || typeof window.supabase.createClient !== 'function') return null;

    // Vérifier s'il y a une session admin dans le sessionStorage
    var adminSession = null;
    try {
      var raw = sessionStorage.getItem('montevia-admin-auth');
      if (raw) adminSession = JSON.parse(raw);
    } catch (e) {}

    var options = {};
    if (adminSession && adminSession.access_token) {
      options = {
        global: {
          headers: {
            Authorization: 'Bearer ' + adminSession.access_token
          }
        }
      };
    }

    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, options);
    return client;
  }

  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function getTicketId() {
    return new URLSearchParams(window.location.search).get('id');
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

    var { data: t, error } = await sb.from('montevia_tickets').select('*').eq('id', id).maybeSingle();
    if (error) { renderError('Erreur : ' + error.message); return; }
    if (!t) { renderError('Ticket introuvable. Vérifiez l\'URL ou vos droits d\'accès.'); return; }
    ticket = t;

    var { data: msgs } = await sb.from('montevia_ticket_messages').select('*').eq('ticket_id', id).order('created_at', { ascending: true });
    messages = msgs || [];

    var { data: parts } = await sb.from('montevia_ticket_participants').select('*').eq('ticket_id', id);
    participants = parts || [];

    // Ne pas utiliser le profil DevReports pour le nom ; utiliser le pseudo Discord
    ticket._openerName = ticket.discord_username || 'Anonyme';

    render();
  }

  function renderError(msg) {
    var page = document.getElementById('ticketApp');
    if (page) page.innerHTML = '<div class="ticket-page__error">' + escapeHtml(msg) + '</div>';
  }

  function render() {
    if (!ticket) return;

    // Header
    document.getElementById('ticketTitle').textContent = ticket.subject;
    var statusEl = document.getElementById('ticketStatus');
    var st = ticket.status || 'open';
    statusEl.textContent = st === 'open' ? 'Ouvert' : (st === 'in_progress' ? 'En cours' : 'Fermé');
    statusEl.className = 'ticket-header__status ticket-header__status--' + ticket.status;

    // Actions
    var actionsEl = document.getElementById('ticketActions');
    actionsEl.innerHTML = '';
    if (isAdmin) {
      if (!ticket.claimed_by && ticket.status !== 'closed') {
        var claimBtn = createBtn('Prendre en charge', 'ticket-btn--claim', async function () {
          await client.from('montevia_tickets').update({ claimed_by: currentUser.id, claimed_at: new Date().toISOString(), status: 'in_progress' }).eq('id', ticket.id);
          ticket.claimed_by = currentUser.id; ticket.status = 'in_progress';
          render();
        });
        actionsEl.append(claimBtn);
      }
      if (ticket.status !== 'closed') {
        var closeBtn = createBtn('Fermer', 'ticket-btn--close', async function () {
          if (!confirm('Fermer ce ticket ?')) return;
          await client.from('montevia_tickets').update({ status: 'closed' }).eq('id', ticket.id);
          ticket.status = 'closed';
          render();
        });
        actionsEl.append(closeBtn);
      } else {
        var reopenBtn = createBtn('Rouvrir', 'ticket-btn--reopen', async function () {
          await client.from('montevia_tickets').update({ status: 'open', closed_at: null }).eq('id', ticket.id);
          ticket.status = 'open';
          render();
        });
        actionsEl.append(reopenBtn);
      }
      var addPartBtn = createBtn('+ Participant', 'ticket-btn--add', async function () {
        var uid = prompt('UUID de l\'utilisateur à ajouter :');
        if (!uid) return;
        await client.from('montevia_ticket_participants').insert({ ticket_id: ticket.id, user_id: uid.trim(), added_by: currentUser.id });
        alert('Participant ajouté.');
        loadTicket();
      });
      actionsEl.append(addPartBtn);
      var delBtn = createBtn('Supprimer', 'ticket-btn--delete', async function () {
        if (!confirm('Supprimer définitivement ce ticket ?')) return;
        await client.from('montevia_tickets').delete().eq('id', ticket.id);
        window.location.href = 'support.html';
      });
      actionsEl.append(delBtn);
    }

    // Chat
    var chat = document.getElementById('ticketChat');
    chat.innerHTML = '';

    // Initial message
    var initMsg = createMessage(ticket.discord_username || 'Utilisateur', ticket.message, ticket.created_at, 'user');
    chat.append(initMsg);

    messages.forEach(function (m) {
      var senderName = m.sender_type === 'admin' ? 'Admin' : (ticket.discord_username || 'Utilisateur');
      var msg = createMessage(senderName, m.message, m.created_at, m.sender_type);
      chat.append(msg);
    });

    // Scroll to bottom
    chat.scrollTop = chat.scrollHeight;

    // Sidebar info
    var info = document.getElementById('ticketInfo');
    if (info) {
      info.innerHTML = '';
      info.append(createInfoRow('Ouvert par', ticket.discord_username || ticket._openerName || 'Anonyme'));
      info.append(createInfoRow('ID utilisateur', ticket.user_id || '—'));
      info.append(createInfoRow('Pseudo Discord', ticket.discord_username || '—'));
      info.append(createInfoRow('Créé le', new Date(ticket.created_at).toLocaleString('fr-FR')));
      if (ticket.claimed_by) info.append(createInfoRow('Pris en charge', ticket.claimed_by === currentUser?.id ? 'Vous' : ticket.claimed_by));
      if (ticket.priority) info.append(createInfoRow('Priorité', ticket.priority));
    }

    // Participants
    var parts = document.getElementById('ticketParticipants');
    if (parts) {
      parts.innerHTML = '';
      if (!participants.length) {
        parts.innerHTML = '<p style="color:var(--text-3);font-size:13px;">Aucun participant ajouté.</p>';
      } else {
        participants.forEach(function (p) {
          var row = document.createElement('div');
          row.className = 'ticket-participant';
          row.textContent = p.user_id;
          parts.append(row);
        });
      }
    }

    // Input bar
    var input = document.getElementById('ticketInput');
    if (ticket.status === 'closed' || (!isAdmin && currentUser?.id !== ticket.user_id)) {
      input.innerHTML = '<div class="ticket-input__closed">Ce ticket est fermé.</div>';
    } else {
      input.innerHTML = '<form id="replyForm" class="ticket-input__form"><textarea id="replyMsg" placeholder="Envoyer un message…" rows="1"></textarea><button type="submit" class="ticket-input__send" title="Envoyer"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button></form>';
      var form = document.getElementById('replyForm');
      form.addEventListener('submit', async function (e) {
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
      // Auto-resize textarea
      var textarea = document.getElementById('replyMsg');
      textarea.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
      });
    }
  }

  function createBtn(label, className, onClick) {
    var btn = document.createElement('button');
    btn.className = 'ticket-btn ' + className;
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function createMessage(sender, text, time, type) {
    var msg = document.createElement('div');
    msg.className = 'ticket-msg ticket-msg--' + type;

    var avatar = document.createElement('div');
    avatar.className = 'ticket-msg__avatar';
    avatar.textContent = String(sender || '?').charAt(0).toUpperCase();
    msg.append(avatar);

    var content = document.createElement('div');
    content.className = 'ticket-msg__content';

    var meta = document.createElement('div');
    meta.className = 'ticket-msg__meta';
    meta.innerHTML = '<span class="ticket-msg__author">' + escapeHtml(sender) + '</span><span class="ticket-msg__time">' + new Date(time).toLocaleString('fr-FR') + '</span>';
    content.append(meta);

    var bubble = document.createElement('div');
    bubble.className = 'ticket-msg__bubble';
    bubble.textContent = text;
    content.append(bubble);

    msg.append(content);
    return msg;
  }

  function createInfoRow(label, value) {
    var row = document.createElement('div');
    row.className = 'ticket-info__row';
    row.innerHTML = '<strong>' + escapeHtml(label) + ' :</strong> ' + escapeHtml(value);
    return row;
  }

  function renderError(msg) {
    var page = document.getElementById('ticketApp');
    if (page) page.innerHTML = '<div class="ticket-page__error">' + escapeHtml(msg) + '</div>';
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