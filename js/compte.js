/* Montevia — gestion de compte (Discord, Google, Roblox) */

(function () {
  'use strict';

  var SUPABASE_URL = 'https://bylwvlxxvgumvqgpwgod.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_T3XYbDWXV5VaC8WQj3CZOQ_LmB7CTwv';

  var client = null;
  var currentUser = null;
  var robloxLink = null;

  function getClient() {
    if (client) return client;
    if (!window.supabase || typeof window.supabase.createClient !== 'function') return null;
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return client;
  }

  function redirectUrl() {
    return window.location.origin + window.location.pathname;
  }

  function initials(name) {
    var words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return 'M';
    return words.slice(0, 2).map(function (w) { return Array.from(w)[0] || ''; }).join('').toUpperCase();
  }

  function displayName() {
    var meta = (currentUser && currentUser.user_metadata) || {};
    return meta.preferred_username || meta.user_name || meta.full_name || meta.name || currentUser.email || 'Utilisateur';
  }

  function errorMessage(error) {
    var message = String((error && error.message) || error || '');
    if (/manual linking.*disabled/i.test(message)) {
      return 'La liaison de comptes est désactivée dans Supabase. Active « Manual linking » dans Authentication → Settings, puis réessaie.';
    }
    if (/provider is not enabled|Unsupported provider/i.test(message)) {
      return 'Ce fournisseur n’est pas activé dans Supabase. Ajoute ses identifiants OAuth (Discord/Google) dans Authentication → Providers.';
    }
    if (/redirect.*not allowed|redirect_uri_mismatch/i.test(message)) {
      return 'L’URL de redirection n’est pas autorisée. Ajoute ' + redirectUrl() + ' dans les Redirect URLs Supabase et chez le fournisseur OAuth.';
    }
    if (/Failed to fetch|NetworkError/i.test(message)) {
      return 'Connexion impossible. Vérifie ton réseau puis réessaie.';
    }
    return message || 'Une erreur inattendue est survenue.';
  }

  async function loadRobloxLink() {
    robloxLink = null;
    if (!currentUser) return;
    var sb = getClient();
    if (!sb) return;
    try {
      var result = await sb
        .from('montevia_account_links')
        .select('user_id,roblox_username,roblox_user_id,roblox_url')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      if (!result.error && result.data) robloxLink = result.data;
    } catch (e) {
      // Table absente ou RLS : on affiche simplement « non connecté ».
    }
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

    await loadRobloxLink();
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

    var name = displayName();
    var email = currentUser.email || '';

    var avatar = document.getElementById('accountAvatar');
    var nameEl = document.getElementById('accountName');
    var emailEl = document.getElementById('accountEmail');
    if (avatar) avatar.textContent = initials(name);
    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = email;

    renderLinked();
  }

  function providerIcon(provider) {
    if (provider === 'discord') {
      return '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20.3 4.4a19.8 19.8 0 0 0-4.9-1.5l-.1 0c-.2.4-.4.9-.6 1.3a18.3 18.3 0 0 0-5.5 0c-.2-.4-.4-.9-.6-1.3l-.1 0a19.7 19.7 0 0 0-4.9 1.5l0 0C.5 9-.3 13.6.1 18.1l0 .1a19.9 19.9 0 0 0 6 3l.1 0c.5-.6.9-1.3 1.2-2v-.1l-1.9-.9v-.1l.4-.3h.1a14.2 14.2 0 0 0 12.1 0h.1l.4.3v.1l-1.9.9v.1c.4.7.7 1.4 1.2 2l.1 0a19.8 19.8 0 0 0 6-3l0-.1c.5-5.2-.8-9.7-3.5-13.7zM8 15.3c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.5 8 10.5s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.19 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>';
  }

  function providerRow(provider, label, connected) {
    var row = document.createElement('div');
    row.className = 'account-linked__row';

    var icon = document.createElement('span');
    icon.className = 'account-linked__icon';
    icon.innerHTML = providerIcon(provider);

    var name = document.createElement('span');
    name.className = 'account-linked__label';
    name.textContent = label;

    var status = document.createElement('span');
    status.className = 'account-linked__status' + (connected ? ' is-connected' : '');
    status.textContent = connected ? 'Connecté' : 'Non connecté';

    row.append(icon, name, status);

    if (!connected) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn--ghost btn--sm';
      button.textContent = 'Lier';
      button.addEventListener('click', function () { linkProvider(provider); });
      row.append(button);
    }

    return row;
  }

  function robloxRow() {
    var row = document.createElement('div');
    row.className = 'account-linked__row account-linked__row--stack';

    var icon = document.createElement('span');
    icon.className = 'account-linked__icon';
    icon.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M5.3 1.3 18.7 4.9l-3.6 13.8L1.8 15.1 5.3 1.3zm6.5 8.2-1.8-.4-.4 1.8 1.8.4.4-1.8z"/></svg>';

    var name = document.createElement('span');
    name.className = 'account-linked__label';
    name.textContent = 'Roblox';

    var status = document.createElement('span');
    status.className = 'account-linked__status' + (robloxLink ? ' is-connected' : '');
    status.textContent = robloxLink
      ? (robloxLink.roblox_username ? '@' + robloxLink.roblox_username : 'Profil lié')
      : 'Non connecté';

    row.append(icon, name, status);

    if (robloxLink) {
      if (robloxLink.roblox_url) {
        var profile = document.createElement('a');
        profile.className = 'btn btn--ghost btn--sm';
        profile.href = robloxLink.roblox_url;
        profile.target = '_blank';
        profile.rel = 'noopener noreferrer';
        profile.textContent = 'Profil';
        row.append(profile);
      }

      var unlink = document.createElement('button');
      unlink.type = 'button';
      unlink.className = 'btn btn--ghost btn--sm';
      unlink.textContent = 'Délier';
      unlink.addEventListener('click', unlinkRoblox);
      row.append(unlink);
      return row;
    }

    var link = document.createElement('button');
    link.type = 'button';
    link.className = 'btn btn--ghost btn--sm';
    link.textContent = 'Lier';
    link.addEventListener('click', function () { openRobloxForm(row); });
    row.append(link);

    return row;
  }

  function renderLinked() {
    var container = document.getElementById('linkedAccounts');
    if (!container) return;
    container.replaceChildren();

    var identityData = currentUser && currentUser.identities ? currentUser.identities : [];
    var providers = identityData.map(function (identity) { return identity.provider; });
    if (!providers.length && currentUser && currentUser.app_metadata && Array.isArray(currentUser.app_metadata.providers)) {
      providers = currentUser.app_metadata.providers;
    }

    container.append(providerRow('discord', 'Discord', providers.indexOf('discord') !== -1));
    container.append(providerRow('google', 'Gmail / Google', providers.indexOf('google') !== -1));
    container.append(robloxRow());
  }

  function openRobloxForm(row) {
    if (row.querySelector('.account-roblox-form')) return;

    var form = document.createElement('form');
    form.className = 'account-roblox-form';

    var label = document.createElement('label');
    label.className = 'account-roblox-form__label';
    label.textContent = 'Pseudo Roblox ou lien de profil';

    var input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 200;
    input.required = true;
    input.placeholder = 'ex. Wolfiii ou https://www.roblox.com/users/123456/profile';
    input.autocomplete = 'off';

    var actions = document.createElement('div');
    actions.className = 'account-roblox-form__actions';

    var save = document.createElement('button');
    save.type = 'submit';
    save.className = 'btn btn--primary btn--sm';
    save.textContent = 'Enregistrer';

    var cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn btn--secondary btn--sm';
    cancel.textContent = 'Annuler';
    cancel.addEventListener('click', function () { form.remove(); });

    actions.append(save, cancel);
    label.append(input);
    form.append(label, actions);

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var parsed = parseRoblox(input.value);
      if (!parsed) {
        alert('Indique un pseudo Roblox valide (3 à 20 caractères) ou un lien de profil roblox.com/users/…');
        input.focus();
        return;
      }

      save.disabled = true;
      save.textContent = 'Enregistrement…';

      var sb = getClient();
      try {
        var result = await sb.from('montevia_account_links').upsert({
          user_id: currentUser.id,
          roblox_username: parsed.username,
          roblox_user_id: parsed.userId,
          roblox_url: parsed.url,
          updated_at: new Date().toISOString()
        });
        if (result.error) throw result.error;

        robloxLink = {
          user_id: currentUser.id,
          roblox_username: parsed.username,
          roblox_user_id: parsed.userId,
          roblox_url: parsed.url
        };
        renderLinked();
      } catch (error) {
        alert('Impossible d’enregistrer le compte Roblox : ' + errorMessage(error));
        save.disabled = false;
        save.textContent = 'Enregistrer';
      }
    });

    row.after(form);
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    input.focus();
  }

  function parseRoblox(value) {
    var text = String(value || '').trim();
    if (!text) return null;

    var urlMatch = text.match(/^(?:https?:\/\/)?(?:www\.|fr\.|en\.)?roblox\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?users\/(\d+)\/profile\/?$/i);
    if (urlMatch) {
      return {
        userId: urlMatch[1],
        username: '',
        url: 'https://www.roblox.com/users/' + urlMatch[1] + '/profile'
      };
    }

    var username = text.replace(/^@/, '');
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return null;

    return {
      userId: '',
      username: username,
      url: 'https://www.roblox.com/search/users?keyword=' + encodeURIComponent(username)
    };
  }

  async function unlinkRoblox() {
    if (!currentUser) return;
    if (!window.confirm('Délier ton compte Roblox ?')) return;

    var sb = getClient();
    try {
      var result = await sb.from('montevia_account_links').delete().eq('user_id', currentUser.id);
      if (result.error) throw result.error;
      robloxLink = null;
      renderLinked();
    } catch (error) {
      alert('Impossible de délier le compte : ' + errorMessage(error));
    }
  }

  async function linkProvider(provider) {
    var sb = getClient();
    if (!sb) { alert('Supabase n’a pas pu être chargé. Recharge la page.'); return; }
    if (!currentUser) { alert('Connecte-toi d’abord pour lier un compte.'); return; }

    try {
      var result = await sb.auth.linkIdentity({
        provider: provider,
        options: { redirectTo: redirectUrl() }
      });

      if (result.error) {
        alert(errorMessage(result.error));
        return;
      }
      if (!result.data || !result.data.url) {
        alert('Aucune URL de redirection reçue. Vérifie que le fournisseur ' + provider + ' est activé dans Supabase.');
        return;
      }
      window.location.href = result.data.url;
    } catch (error) {
      alert(errorMessage(error));
    }
  }

  async function login(provider) {
    var sb = getClient();
    if (!sb) { alert('Supabase n’a pas pu être chargé. Recharge la page.'); return; }

    var result = await sb.auth.signInWithOAuth({
      provider: provider,
      options: { redirectTo: redirectUrl() }
    });

    if (result && result.error) alert(errorMessage(result.error));
  }

  async function logout() {
    var sb = getClient();
    if (!sb) return;
    await sb.auth.signOut();
    currentUser = null;
    robloxLink = null;
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
