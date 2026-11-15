/* Montevia — système de tickets (login Discord) */

(function () {
  'use strict';

  var SUPABASE_URL = 'https://bylwvlxxvgumvqgpwgod.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_T3XYbDWXV5VaC8WQj3CZOQ_LmB7CTwv';

  var client = null;
  var currentUser = null;

  function getClient() {
    if (client) return client;
    if (!window.supabase || typeof window.supabase.createClient !== 'function') return null;
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return client;
  }

  async function checkSession() {
    var sb = getClient();
    if (!sb) { setTimeout(checkSession, 500); return; }

    var { data: { session } } = await sb.auth.getSession();
    currentUser = session ? session.user : null;
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
      if (userDiv) {
        var name = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email || 'Utilisateur';
        userDiv.textContent = 'Connecté en tant que ' + name;
      }
    } else {
      authDiv.hidden = false;
      formDiv.hidden = true;
      if (userDiv) userDiv.textContent = '';
    }
  }

  async function loadMyTickets() {
    var sb = getClient();
    if (!sb || !currentUser) return;
    var list = document.getElementById('ticketList');
    if (!list) return;

    var { data, error } = await sb.from('montevia_tickets').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
    if (error) { console.warn('tickets load failed', error); return; }

    list.innerHTML = '';
    if (!data || !data.length) {
      list.innerHTML = '<p style="text-align:center;color:var(--text-3);">Aucun ticket pour le moment.</p>';
      return;
    }

    data.forEach(function (t) {
      var card = document.createElement('div');
      card.className = 'ticket-item';

      var statusClass = 'ticket-item__status--' + (t.status === 'in_progress' ? 'in_progress' : t.status);

      card.innerHTML =
        '<div class="ticket-item__head">' +
          '<span class="ticket-item__subject">' + escapeHtml(t.subject) + '</span>' +
          '<span class="ticket-item__date">' + new Date(t.created_at).toLocaleDateString('fr-FR') + '</span>' +
        '</div>' +
        '<p class="ticket-item__message">' + escapeHtml(t.message) + '</p>' +
        '<span class="ticket-item__status ' + statusClass + '">' + (t.status === 'open' ? 'Ouvert' : (t.status === 'in_progress' ? 'En cours' : 'Fermé')) + '</span>';

      list.append(card);
    });
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async function handleLogin() {
    var sb = getClient();
    if (!sb) return;
    await sb.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: window.location.href }
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    var sb = getClient();
    if (!sb || !currentUser) return;

    var subject = document.getElementById('ticketSubject').value.trim();
    var message = document.getElementById('ticketMessage').value.trim();
    if (!subject || !message) return;

    var discordName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || '';

    var { error } = await sb.from('montevia_tickets').insert({
      user_id: currentUser.id,
      discord_username: discordName,
      subject: subject,
      message: message
    });

    if (error) {
      alert('Erreur : ' + error.message);
      return;
    }

    document.getElementById('ticketSubject').value = '';
    document.getElementById('ticketMessage').value = '';
    await loadMyTickets();
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