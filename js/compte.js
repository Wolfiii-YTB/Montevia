/* Montevia — gestion de compte (Discord, Google, Roblox) */

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

  function initials(name) {
    var words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return 'M';
    return words.slice(0, 2).map(function (w) { return Array.from(w)[0] || ''; }).join('').toUpperCase();
  }

  async function checkSession() {
    var sb = getClient();
    if (!sb) { setTimeout(checkSession, 500); return; }

    var { data: { session } } = await sb.auth.getSession();
    currentUser = session ? session.user : null;
    render();
  }

  function render() {
    var loading = document.getElementById('accountLoading');
    var guest = document.getElementById('accountGuest');
    var user = document.getElementById('accountUser');
    if (loading) loading.hidden = true;

    if (!currentUser) {
      if (guest) guest.hidden = false;
      if (user) user.hidden = true;
      return;
    }

    if (guest) guest.hidden = true;
    if (user) user.hidden = false;

    var name = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email || 'Utilisateur';
    var email = currentUser.email || '';
    var avatar = document.getElementById('accountAvatar');
    var nameEl = document.getElementById('accountName');
    var emailEl = document.getElementById('accountEmail');
    if (avatar) avatar.textContent = initials(name);
    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = email;

    renderLinked();
  }

  function renderLinked() {
    var container = document.getElementById('linkedAccounts');
    if (!container) return;
    container.innerHTML = '';

    var providers = currentUser?.app_metadata?.providers || [];
    var meta = currentUser?.user_metadata || {};

    var items = [
      { key: 'discord', label: 'Discord', icon: '🎮', connected: providers.includes('discord') || meta.provider === 'discord' },
      { key: 'google', label: 'Gmail / Google', icon: '📧', connected: providers.includes('google') || meta.provider === 'google' },
    ];

    items.forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'account-linked__row';
      row.innerHTML = '<span class="account-linked__icon">' + item.icon + '</span>' +
        '<span class="account-linked__label">' + item.label + '</span>' +
        '<span class="account-linked__status ' + (item.connected ? 'is-connected' : '') + '">' + (item.connected ? 'Connecté' : 'Non connecté') + '</span>';
      if (!item.connected) {
        var btn = document.createElement('button');
        btn.className = 'btn btn--ghost btn--sm';
        btn.textContent = 'Lier';
        btn.addEventListener('click', function () { linkProvider(item.key); });
        row.append(btn);
      }
      container.append(row);
    });

    // Roblox (manuel)
    var robloxRow = document.createElement('div');
    robloxRow.className = 'account-linked__row';
    robloxRow.innerHTML = '<span class="account-linked__icon">🧱</span>' +
      '<span class="account-linked__label">Roblox</span>' +
      '<span class="account-linked__status">Non connecté</span>';
    var robloxBtn = document.createElement('button');
    robloxBtn.className = 'btn btn--ghost btn--sm';
    robloxBtn.textContent = 'Lier';
    robloxBtn.addEventListener('click', function () { linkRoblox(); });
    robloxRow.append(robloxBtn);
    container.append(robloxRow);
  }

  async function linkProvider(provider) {
    var sb = getClient();
    if (!sb) return;
    await sb.auth.linkIdentity({ provider: provider });
  }

  function linkRoblox() {
    alert('La connexion Roblox sera disponible prochainement. Pour l\'instant, utilise Discord ou Gmail.');
  }

  async function login(provider) {
    var sb = getClient();
    if (!sb) return;
    await sb.auth.signInWithOAuth({
      provider: provider,
      options: { redirectTo: window.location.href }
    });
  }

  async function logout() {
    var sb = getClient();
    if (!sb) return;
    await sb.auth.signOut();
    currentUser = null;
    render();
  }

  function init() {
    var loginDiscord = document.getElementById('loginDiscord');
    var loginGoogle = document.getElementById('loginGoogle');
    var logoutBtn = document.getElementById('logoutBtn');

    if (loginDiscord) loginDiscord.addEventListener('click', function () { login('discord'); });
    if (loginGoogle) loginGoogle.addEventListener('click', function () { login('google'); });
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    checkSession();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();