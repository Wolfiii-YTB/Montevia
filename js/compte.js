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

    // Marquer l'utilisateur comme venant de Montevia (pour éviter les notifs DevReports)
    if (currentUser && (!currentUser.user_metadata || currentUser.user_metadata.site !== 'montevia')) {
      try {
        await sb.auth.updateUser({ data: { site: 'montevia' } });
      } catch (e) { /* ignore */ }
    }

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
      { key: 'discord', label: 'Discord', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20.3 4.4a19.8 19.8 0 0 0-4.9-1.5l-.1 0c-.2.4-.4.9-.6 1.3a18.3 18.3 0 0 0-5.5 0c-.2-.4-.4-.9-.6-1.3l-.1 0a19.7 19.7 0 0 0-4.9 1.5l0 0C.5 9-.3 13.6.1 18.1l0 .1a19.9 19.9 0 0 0 6 3l.1 0c.5-.6.9-1.3 1.2-2v-.1l-1.9-.9v-.1l.4-.3h.1a14.2 14.2 0 0 0 12.1 0h.1l.4.3v.1l-1.9.9v.1c.4.7.7 1.4 1.2 2l.1 0a19.8 19.8 0 0 0 6-3l0-.1c.5-5.2-.8-9.7-3.5-13.7zM8 15.3c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.5 8 10.5s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z"/></svg>', connected: providers.includes('discord') || meta.provider === 'discord' },
      { key: 'google', label: 'Gmail / Google', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.19 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>', connected: providers.includes('google') || meta.provider === 'google' },
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
    robloxRow.innerHTML = '<span class="account-linked__icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M5.3 1.3 18.7 4.9l-3.6 13.8L1.8 15.1 5.3 1.3zm6.5 8.2-1.8-.4-.4 1.8 1.8.4.4-1.8z"/></svg></span>' +
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
    if (!sb) { alert('Supabase non chargé. Recharge la page.'); return; }
    if (!currentUser) { alert('Vous devez être connecté pour lier un compte.'); return; }

    console.log('Tentative de liaison avec', provider, 'pour', currentUser.id);

    try {
      var { data, error } = await sb.auth.linkIdentity({ provider: provider });
      console.log('linkIdentity result:', data, error);
      if (error) {
        alert('Erreur Supabase : ' + error.message);
        return;
      }
      if (!data || !data.url) {
        alert('Aucune URL de redirection reçue. Vérifie que le provider ' + provider + ' est activé dans Supabase.');
        return;
      }
      // Redirection manuelle si nécessaire
      window.location.href = data.url;
    } catch (e) {
      console.error('linkProvider error:', e);
      alert('Erreur : ' + (e.message || e));
    }
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