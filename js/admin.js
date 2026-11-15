/* Montevia — panneau d'administration.
   Authentification : comptes Supabase Auth du projet DevReports.
   Accès : profils dont role = 'admin' et status = 'active'.
   La clé publishable est publique ; les droits réels sont appliqués par RLS. */

(function () {
  'use strict';

  var config = window.MONTEVIA_SUPABASE;
  var boot = document.getElementById('boot');
  var bootText = document.getElementById('bootText');
  var bootReload = document.getElementById('bootReload');
  var authScreen = document.getElementById('authScreen');
  var adminApp = document.getElementById('adminApp');
  var loginForm = document.getElementById('loginForm');
  var loginId = document.getElementById('loginId');
  var loginPassword = document.getElementById('loginPassword');
  var togglePassword = document.getElementById('togglePassword');
  var loginBtn = document.getElementById('loginBtn');
  var loginError = document.getElementById('loginError');

  var adminName = document.getElementById('adminName');
  var adminAvatar = document.getElementById('adminAvatar');
  var navTeamCount = document.getElementById('navTeamCount');
  var viewTitle = document.getElementById('viewTitle');
  var dashboardView = document.getElementById('dashboardView');
  var teamView = document.getElementById('teamView');

  var statTotal = document.getElementById('statTotal');
  var statPublished = document.getElementById('statPublished');
  var statPoles = document.getElementById('statPoles');
  var statRecent = document.getElementById('statRecent');
  var recentMembers = document.getElementById('recentMembers');

  var teamTable = document.getElementById('teamTable');
  var teamRows = document.getElementById('teamRows');
  var teamEmpty = document.getElementById('teamEmpty');
  var teamEmptyText = document.getElementById('teamEmptyText');

  var accessView = document.getElementById('accessView');
  var accessTable = document.getElementById('accessTable');
  var accessRows = document.getElementById('accessRows');
  var accessEmpty = document.getElementById('accessEmpty');
  var grantAccessForm = document.getElementById('grantAccessForm');
  var grantUserId = document.getElementById('grantUserId');

  var memberDialog = document.getElementById('memberDialog');
  var memberForm = document.getElementById('memberForm');
  var memberDialogTitle = document.getElementById('memberDialogTitle');
  var memberId = document.getElementById('memberId');
  var memberName = document.getElementById('memberName');
  var memberUsername = document.getElementById('memberUsername');
  var memberRole = document.getElementById('memberRole');
  var memberPole = document.getElementById('memberPole');
  var memberBio = document.getElementById('memberBio');
  var memberAvatar = document.getElementById('memberAvatar');
  var memberRoblox = document.getElementById('memberRoblox');
  var memberDiscord = document.getElementById('memberDiscord');
  var memberOrder = document.getElementById('memberOrder');
  var memberPublished = document.getElementById('memberPublished');
  var saveMemberBtn = document.getElementById('saveMemberBtn');

  var deleteDialog = document.getElementById('deleteDialog');
  var deleteMemberName = document.getElementById('deleteMemberName');
  var confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

  var toast = document.getElementById('toast');
  var logoutBtn = document.getElementById('logoutBtn');

  var setupBanners = Array.prototype.slice.call(document.querySelectorAll('[data-setup]'));

  var POLES = {
    direction: 'Direction',
    developpement: 'Développement',
    moderation: 'Modération',
    support: 'Support & animation',
    studio: 'Studio',
    autre: 'Autre'
  };

  var VIEWS = {
    dashboard: { el: dashboardView, title: "Vue d'ensemble" },
    team: { el: teamView, title: 'Équipe' },
    access: { el: accessView, title: 'Accès' }
  };

  var db = null;
  var currentProfile = null;
  var members = [];
  var accessList = [];
  var allProfiles = [];
  var tableReady = false;
  var editingId = null;
  var deletingId = null;
  var toastTimer = 0;

  /* ---------- utilitaires ---------- */

  function errorMessage(error) {
    return (error && (error.message || error.error_description)) || '';
  }

  function authMessage(error) {
    var raw = errorMessage(error);
    if (/invalid login credentials/i.test(raw)) return 'Adresse e-mail ou mot de passe incorrect.';
    if (/email not confirmed/i.test(raw)) return "Ton adresse e-mail n'est pas encore confirmée.";
    if (/rate limit|too many/i.test(raw)) return 'Trop de tentatives. Réessaie dans quelques minutes.';
    if (/failed to fetch|network|load failed/i.test(raw)) return 'Connexion au serveur impossible. Vérifie ta connexion Internet.';
    return raw || 'Connexion impossible. Réessaie.';
  }

  function isMissingTable(error) {
    if (!error) return false;
    var code = String(error.code || '');
    var message = errorMessage(error);
    return code === 'PGRST205' || code === '42P01' ||
      /could not find the table|relation .* does not exist|schema cache/i.test(message);
  }

  function initials(name) {
    var words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return 'M';
    return words.slice(0, 2).map(function (word) {
      return Array.from(word)[0] || '';
    }).join('').toUpperCase();
  }

  function safeHttps(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      var url = new URL(value.trim());
      return url.protocol === 'https:' ? url.href : '';
    } catch (error) {
      return '';
    }
  }

  function node(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function avatarNode(member, className) {
    var wrap = node('span', className);
    var url = safeHttps(member.avatar_url);

    if (url) {
      var img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', function () {
        img.remove();
        wrap.textContent = initials(member.display_name);
        wrap.classList.add('is-fallback');
      });
      wrap.append(img);
    } else {
      wrap.textContent = initials(member.display_name);
    }

    return wrap;
  }

  function shortDate(value) {
    if (!value) return '—';
    var date = new Date(value);
    if (isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date);
  }

  function showToast(message, type) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.dataset.type = type || 'success';
    toast.hidden = false;
    // Force le calcul du style avant l'animation d'apparition.
    void toast.offsetWidth;
    toast.classList.add('is-visible');
    toastTimer = window.setTimeout(function () {
      toast.classList.remove('is-visible');
      window.setTimeout(function () { toast.hidden = true; }, 220);
    }, 4200);
  }

  function setLoginError(message) {
    if (!message) {
      loginError.hidden = true;
      loginError.textContent = '';
      return;
    }
    loginError.textContent = message;
    loginError.hidden = false;
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      button.dataset.label = button.textContent;
      button.disabled = true;
      if (label) button.textContent = label;
    } else {
      button.disabled = false;
      if (button.dataset.label) {
        button.textContent = button.dataset.label;
        delete button.dataset.label;
      }
    }
  }

  function showBoot(message, canReload) {
    boot.hidden = false;
    authScreen.hidden = true;
    adminApp.hidden = true;
    if (message) bootText.textContent = message;
    bootReload.hidden = !canReload;
  }

  function showAuth(message) {
    boot.hidden = true;
    adminApp.hidden = true;
    authScreen.hidden = false;
    setLoginError(message || '');
    if (message) {
      loginPassword.value = '';
      loginId.focus();
    }
  }

  function showApp() {
    boot.hidden = true;
    authScreen.hidden = true;
    adminApp.hidden = false;
  }

  function renderIdentity(profile) {
    var name = profile.display_name || profile.nickname || 'Administrateur';
    adminName.textContent = name;
    adminAvatar.textContent = initials(name);
  }

  function switchView(name) {
    var view = VIEWS[name] ? name : 'dashboard';

    Object.keys(VIEWS).forEach(function (key) {
      VIEWS[key].el.hidden = key !== view;
    });

    document.querySelectorAll('[data-view]').forEach(function (button) {
      button.classList.toggle('is-active', button.dataset.view === view);
    });

    viewTitle.textContent = VIEWS[view].title;
  }

  /* ---------- connexion ---------- */

  async function fetchProfile(userId) {
    var result = await db
      .from('profiles')
      .select('id,display_name,nickname,role,status')
      .eq('id', userId)
      .maybeSingle();

    if (result.error) throw result.error;
    return result.data;
  }

  async function hasMonteviaAccess(userId) {
    try {
      var result = await db
        .from('montevia_admin_access')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (result.error) return false;
      return !!result.data;
    } catch (e) {
      return false;
    }
  }

  async function loginByIdentifier(identifier, password) {
    var base = config.url.replace(/\/$/, '');
    var functionName = config.loginFunction || 'login-by-identifier';

    var response;
    try {
      response = await fetch(base + '/functions/v1/' + encodeURIComponent(functionName), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          apikey: config.anonKey,
          Authorization: 'Bearer ' + config.anonKey
        },
        body: JSON.stringify({ identifier: identifier, password: password }),
        cache: 'no-store'
      });
    } catch (networkError) {
      throw new Error("La connexion par identifiant est indisponible depuis ce domaine. Utilise ton adresse e-mail.");
    }

    var payload = null;
    try { payload = await response.json(); } catch (error) { payload = null; }

    if (response.status === 403) {
      throw new Error("La connexion par identifiant est refusée depuis ce site. Utilise ton adresse e-mail.");
    }
    if (!response.ok) {
      throw new Error((payload && payload.error) || 'Identifiant ou mot de passe incorrect.');
    }
    if (!payload || !payload.access_token || !payload.refresh_token) {
      throw new Error('Réponse de connexion invalide. Réessaie.');
    }

    return payload;
  }

  async function verifyAndEnter(user) {
    var profile;

    try {
      profile = await fetchProfile(user.id);
    } catch (error) {
      if (isMissingTable(error)) throw error;
      throw new Error("Impossible de vérifier ton profil. Réessaie dans un instant.");
    }

    var isDevReportsAdmin = profile && profile.role === 'admin' && profile.status === 'active';
    var isMonteviaAdmin = await hasMonteviaAccess(user.id);

    if (!isDevReportsAdmin && !isMonteviaAdmin) {
      await db.auth.signOut().catch(function () {});
      window.sessionStorage.removeItem('montevia-admin-auth');
      showAuth("Ce compte n'a pas les droits d'administration. Utilise un compte administrateur actif de DevReports.");
      return false;
    }

    currentProfile = profile;
    renderIdentity(profile);
    showApp();
    switchView('dashboard');

    try {
      await loadMembers();
    } catch (error) {
      showToast("Impossible de charger l'équipe : " + (errorMessage(error) || 'erreur réseau.'), 'error');
    }

    try {
      await loadAccess();
    } catch (error) {
      showToast("Impossible de charger les accès : " + (errorMessage(error) || 'erreur réseau.'), 'error');
    }

    return true;
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoginError('');

    var identifier = loginId.value.trim();
    var password = loginPassword.value;

    if (!identifier || !password) {
      setLoginError('Renseigne ton adresse e-mail (ou identifiant) et ton mot de passe.');
      return;
    }

    setBusy(loginBtn, true, 'Connexion…');

    try {
      if (identifier.indexOf('@') !== -1) {
        var result = await db.auth.signInWithPassword({
          email: identifier.toLowerCase(),
          password: password
        });
        if (result.error) throw result.error;
        if (!result.data || !result.data.user) throw new Error('Connexion impossible. Réessaie.');
        await verifyAndEnter(result.data.user);
      } else {
        var session = await loginByIdentifier(identifier.toLowerCase(), password);
        var setResult = await db.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token
        });
        if (setResult.error) throw setResult.error;
        if (!setResult.data || !setResult.data.user) throw new Error('Connexion impossible. Réessaie.');
        await verifyAndEnter(setResult.data.user);
      }
    } catch (error) {
      if (!adminApp.hidden) {
        // La session est valide mais le chargement des données a échoué.
        showToast(authMessage(error), 'error');
      } else {
        setLoginError(authMessage(error));
      }
    } finally {
      setBusy(loginBtn, false);
    }
  }

  async function handleLogout() {
    logoutBtn.disabled = true;
    try {
      await db.auth.signOut();
    } catch (error) {
      // La session locale est nettoyée de toute façon.
    }
    window.sessionStorage.removeItem('montevia-admin-auth');
    currentProfile = null;
    members = [];
    tableReady = false;
    logoutBtn.disabled = false;
    loginForm.reset();
    showAuth();
  }

  /* ---------- données de l'équipe ---------- */

  function showSetup(visible) {
    setupBanners.forEach(function (banner) { banner.hidden = !visible; });
  }

  function renderStats() {
    var published = members.filter(function (member) { return member.published; });
    var poles = new Set();
    var latest = null;

    members.forEach(function (member) {
      if (member.pole) poles.add(member.pole);
      var stamp = member.updated_at || member.created_at;
      if (!stamp) return;
      var date = new Date(stamp);
      if (isNaN(date.getTime())) return;
      if (!latest || date > latest) latest = date;
    });

    statTotal.textContent = String(members.length);
    statPublished.textContent = String(published.length);
    statPoles.textContent = String(poles.size);
    statRecent.textContent = latest ? shortDate(latest) : '—';
    navTeamCount.textContent = String(members.length);
  }

  function renderRecent() {
    var latest = members.slice().sort(function (a, b) {
      return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0);
    }).slice(0, 4);

    recentMembers.replaceChildren();

    if (!latest.length) {
      recentMembers.append(node('p', 'admin-recent__empty', 'Aucun membre pour le moment.'));
      return;
    }

    latest.forEach(function (member) {
      var item = node('div', 'admin-recent__item');
      item.append(avatarNode(member, 'admin-recent__avatar'));

      var text = node('span', 'admin-recent__text');
      text.append(node('strong', '', member.display_name || 'Membre'));
      text.append(node('small', '', member.role_label || POLES[member.pole] || 'Membre'));
      item.append(text);

      item.append(node('span', 'admin-recent__meta', shortDate(member.updated_at || member.created_at)));
      recentMembers.append(item);
    });
  }

  function rowAction(action, member, label, path) {
    var button = node('button', 'admin-icon-btn' + (action === 'delete' ? ' admin-icon-btn--danger' : ''));
    button.type = 'button';
    button.dataset.action = action;
    button.dataset.id = member.id;
    button.setAttribute('aria-label', label + ' ' + (member.display_name || 'ce membre'));
    button.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
    return button;
  }

  function renderTeam() {
    teamRows.replaceChildren();

    if (!members.length) {
      teamTable.hidden = true;
      teamEmpty.hidden = false;
      teamEmptyText.textContent = tableReady
        ? "Ajoute une première fiche pour commencer à présenter l'équipe."
        : "La table de l'équipe n'existe pas encore dans Supabase. Exécute le script SQL, puis recharge cette page.";
      return;
    }

    teamTable.hidden = false;
    teamEmpty.hidden = true;

    var fragment = document.createDocumentFragment();

    members.forEach(function (member) {
      var row = node('div', 'admin-row');
      row.dataset.id = member.id;

      var memberCell = node('div', 'admin-row__member');
      memberCell.append(avatarNode(member, 'admin-row__avatar'));

      var text = node('span', 'admin-row__text');
      text.append(node('strong', '', member.display_name || 'Membre'));
      text.append(node('small', '', member.username ? '@' + String(member.username).replace(/^@/, '') : 'Sans pseudo'));
      memberCell.append(text);
      row.append(memberCell);

      row.append(node('span', 'admin-row__role', member.role_label || '—'));
      row.append(node('span', 'admin-row__pole', POLES[member.pole] || 'Autre'));

      var statusCell = node('span', 'admin-row__status');
      var badge = node('span', 'admin-badge ' + (member.published ? 'admin-badge--live' : 'admin-badge--draft'),
        member.published ? 'Publié' : 'Brouillon');
      statusCell.append(badge);
      row.append(statusCell);

      var actions = node('div', 'admin-row__actions');
      actions.append(rowAction('edit', member, 'Modifier', '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>'));
      actions.append(rowAction('delete', member, 'Supprimer', '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>'));
      row.append(actions);

      fragment.append(row);
    });

    teamRows.append(fragment);
  }

  function renderAll() {
    renderStats();
    renderRecent();
    renderTeam();
  }

  async function loadMembers() {
    var table = config.teamTable || 'montevia_team_members';
    var result = await db
      .from(table)
      .select('*')
      .order('sort_order', { ascending: true })
      .order('display_name', { ascending: true });

    if (result.error) {
      if (isMissingTable(result.error)) {
        tableReady = false;
        members = [];
        renderAll();
        showSetup(true);
        return;
      }
      throw result.error;
    }

    tableReady = true;
    members = Array.isArray(result.data) ? result.data : [];
    showSetup(false);
    renderAll();
  }

  async function loadAccess() {
    // Charger la liste des accès accordés
    try {
      var result = await db
        .from('montevia_admin_access')
        .select('*')
        .order('created_at', { ascending: false });

      if (result.error) {
        if (isMissingTable(result.error)) {
          accessList = [];
        } else {
          throw result.error;
        }
      } else {
        accessList = Array.isArray(result.data) ? result.data : [];
      }
    } catch (error) {
      accessList = [];
      console.warn('loadAccess: access list failed', error);
    }

    // Charger tous les profils si possible (pour checkboxes)
    try {
      var profResult = await db
        .from('profiles')
        .select('id,display_name,nickname,role,status')
        .order('display_name', { ascending: true });
      if (!profResult.error && Array.isArray(profResult.data)) {
        allProfiles = profResult.data;
      } else {
        allProfiles = [];
      }
    } catch (e) {
      allProfiles = [];
    }

    renderAccess();
  }

  function renderAccess() {
    accessRows.replaceChildren();

    var grantedIds = new Set(accessList.map(function (e) { return e.user_id; }));

    // Si on a la liste des profils, afficher des checkboxes
    if (allProfiles.length) {
      accessTable.hidden = false;
      accessEmpty.hidden = true;

      var fragment = document.createDocumentFragment();

      allProfiles.forEach(function (profile) {
        var isDevReportsAdmin = profile.role === 'admin' && profile.status === 'active';
        var isGranted = grantedIds.has(profile.id);

        var row = node('div', 'admin-row');
        row.dataset.id = profile.id;

        var userCell = node('div', 'admin-row__member');
        var label = node('label', 'admin-check');
        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = isDevReportsAdmin || isGranted;
        checkbox.disabled = isDevReportsAdmin; // les admins DevReports sont toujours autorisés
        checkbox.dataset.userId = profile.id;
        checkbox.addEventListener('change', function () {
          if (checkbox.checked) {
            grantAccessById(profile.id);
          } else {
            handleRevokeAccess(profile.id);
          }
        });
        label.append(checkbox);
        label.append(node('span', '', (profile.display_name || profile.nickname || profile.id) + (isDevReportsAdmin ? ' (admin DevReports)' : '')));
        userCell.append(label);

        var dateCell = node('span', 'admin-row__role', isDevReportsAdmin ? 'Permanent' : (isGranted ? shortDate(accessList.filter(function (e) { return e.user_id === profile.id; })[0]?.created_at) : '—'));

        var actions = node('div', 'admin-row__actions');
        if (!isDevReportsAdmin && isGranted) {
          var revokeBtn = node('button', 'admin-icon-btn admin-icon-btn--danger');
          revokeBtn.type = 'button';
          revokeBtn.dataset.action = 'revoke-access';
          revokeBtn.dataset.id = profile.id;
          revokeBtn.setAttribute('aria-label', 'Révoquer ' + profile.id);
          revokeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
          actions.append(revokeBtn);
        }

        row.append(userCell);
        row.append(dateCell);
        row.append(actions);

        fragment.append(row);
      });

      accessRows.append(fragment);
      return;
    }

    // Fallback : liste des accès accordés uniquement
    if (!accessList.length) {
      accessTable.hidden = true;
      accessEmpty.hidden = false;
      return;
    }

    accessTable.hidden = false;
    accessEmpty.hidden = true;

    var frag = document.createDocumentFragment();

    accessList.forEach(function (entry) {
      var row = node('div', 'admin-row');
      row.dataset.id = entry.user_id;

      var userCell = node('div', 'admin-row__member');
      userCell.append(node('span', 'admin-row__text', entry.user_id));

      var dateCell = node('span', 'admin-row__role', shortDate(entry.created_at));

      var actions = node('div', 'admin-row__actions');
      var revokeBtn = node('button', 'admin-icon-btn admin-icon-btn--danger');
      revokeBtn.type = 'button';
      revokeBtn.dataset.action = 'revoke-access';
      revokeBtn.dataset.id = entry.user_id;
      revokeBtn.setAttribute('aria-label', 'Révoquer ' + entry.user_id);
      revokeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
      actions.append(revokeBtn);

      row.append(userCell);
      row.append(dateCell);
      row.append(actions);

      frag.append(row);
    });

    accessRows.append(frag);
  }

  async function grantAccessById(userId) {
    try {
      var result = await db.from('montevia_admin_access').insert({ user_id: userId, granted_by: currentProfile.id });
      if (result.error) throw result.error;
      showToast('Accès accordé.');
      await loadAccess();
    } catch (error) {
      showToast(errorMessage(error) || 'Autorisation impossible.', 'error');
      await loadAccess();
    }
  }

  /* ---------- formulaires ---------- */

  function openDialog(dialog) {
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function closeDialog(dialog) {
    if (typeof dialog.close === 'function' && dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  function resetMemberForm() {
    memberForm.reset();
    memberId.value = '';
    memberPole.value = 'direction';
    memberOrder.value = '100';
    memberPublished.checked = true;
    memberAvatar.value = '';
    memberRoblox.value = '';
  }

  function openMemberForm(member) {
    resetMemberForm();
    editingId = null;

    if (member) {
      editingId = member.id;
      memberId.value = member.id;
      memberName.value = member.display_name || '';
      memberUsername.value = member.username || '';
      memberRole.value = member.role_label || '';
      memberPole.value = POLES[member.pole] ? member.pole : 'autre';
      memberBio.value = member.bio || '';
      memberAvatar.value = member.avatar_url || '';
      memberRoblox.value = member.roblox_url || '';
      memberDiscord.value = member.discord_username || '';
      memberOrder.value = String(member.sort_order == null ? 100 : member.sort_order);
      memberPublished.checked = !!member.published;
      memberDialogTitle.textContent = 'Modifier le membre';
      saveMemberBtn.textContent = 'Enregistrer';
    } else {
      memberDialogTitle.textContent = 'Ajouter un membre';
      saveMemberBtn.textContent = 'Ajouter le membre';
    }

    openDialog(memberDialog);
    window.setTimeout(function () { memberName.focus(); }, 30);
  }

  function openDeleteDialog(member) {
    deletingId = member.id;
    deleteMemberName.textContent = member.display_name || 'ce membre';
    openDialog(deleteDialog);
  }

  function validateUrlField(field, label) {
    var value = field.value.trim();
    if (!value) return '';
    if (!/^https:\/\/[^\s]+$/i.test(value)) {
      showToast(label + ' doit commencer par https://', 'error');
      field.focus();
      return null;
    }
    return value;
  }

  function buildPayload() {
    var avatarUrl = validateUrlField(memberAvatar, "L'URL de l'avatar");
    if (avatarUrl === null) return null;

    var robloxUrl = validateUrlField(memberRoblox, 'Le profil Roblox');
    if (robloxUrl === null) return null;

    var order = parseInt(memberOrder.value, 10);
    if (isNaN(order)) order = 100;
    order = Math.min(9999, Math.max(0, order));

    return {
      display_name: memberName.value.trim(),
      username: memberUsername.value.trim().replace(/^@/, ''),
      role_label: memberRole.value.trim(),
      pole: POLES[memberPole.value] ? memberPole.value : 'autre',
      bio: memberBio.value.trim(),
      avatar_url: avatarUrl,
      roblox_url: robloxUrl,
      discord_username: memberDiscord.value.trim().replace(/^@/, ''),
      sort_order: order,
      published: memberPublished.checked
    };
  }

  async function handleMemberSubmit(event) {
    event.preventDefault();

    var payload = buildPayload();
    if (!payload) return;

    if (!payload.display_name) {
      showToast('Le nom affiché est obligatoire.', 'error');
      memberName.focus();
      return;
    }
    if (!payload.role_label) {
      showToast('Le rôle affiché est obligatoire.', 'error');
      memberRole.focus();
      return;
    }

    setBusy(saveMemberBtn, true, editingId ? 'Enregistrement…' : 'Ajout…');

    try {
      var table = config.teamTable || 'montevia_team_members';
      var result;

      if (editingId) {
        result = await db.from(table).update(payload).eq('id', editingId);
      } else {
        result = await db.from(table).insert(payload);
      }

      if (result.error) throw result.error;

      closeDialog(memberDialog);
      showToast(editingId ? 'Fiche mise à jour.' : 'Membre ajouté à l’équipe.');
      editingId = null;
      await loadMembers();
    } catch (error) {
      if (isMissingTable(error)) {
        showSetup(true);
        showToast("La table de l'équipe n'existe pas encore. Exécute le script SQL dans Supabase.", 'error');
      } else {
        showToast(errorMessage(error) || 'Enregistrement impossible.', 'error');
      }
    } finally {
      setBusy(saveMemberBtn, false);
    }
  }

  async function handleDelete() {
    if (!deletingId) return;

    setBusy(confirmDeleteBtn, true, 'Suppression…');

    try {
      var table = config.teamTable || 'montevia_team_members';
      var result = await db.from(table).delete().eq('id', deletingId);
      if (result.error) throw result.error;

      closeDialog(deleteDialog);
      showToast('Membre supprimé.');
      deletingId = null;
      await loadMembers();
    } catch (error) {
      showToast(errorMessage(error) || 'Suppression impossible.', 'error');
    } finally {
      setBusy(confirmDeleteBtn, false);
    }
  }

  async function handleGrantAccess(event) {
    event.preventDefault();
    var userId = grantUserId.value.trim();
    if (!userId) {
      showToast('Saisis un UUID utilisateur.', 'error');
      return;
    }
    grantUserId.value = '';
    await grantAccessById(userId);
  }

  async function handleRevokeAccess(userId) {
    if (!userId) return;
    try {
      var result = await db.from('montevia_admin_access').delete().eq('user_id', userId);
      if (result.error) throw result.error;
      showToast('Accès révoqué.');
      await loadAccess();
    } catch (error) {
      showToast(errorMessage(error) || 'Révocation impossible.', 'error');
    }
  }

  /* ---------- initialisation ---------- */

  function bindEvents() {
    window.addEventListener('pageshow', function (event) {
      if (event.persisted) window.location.reload();
    });

    loginForm.addEventListener('submit', handleLogin);

    togglePassword.addEventListener('click', function () {
      var show = loginPassword.type === 'password';
      loginPassword.type = show ? 'text' : 'password';
      togglePassword.textContent = show ? 'Masquer' : 'Afficher';
      togglePassword.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
      togglePassword.setAttribute('aria-pressed', show ? 'true' : 'false');
    });

    bootReload.addEventListener('click', function () { window.location.reload(); });

    logoutBtn.addEventListener('click', handleLogout);

    document.querySelectorAll('[data-view]').forEach(function (button) {
      button.addEventListener('click', function () { switchView(button.dataset.view); });
    });

    document.querySelectorAll('[data-go-team]').forEach(function (button) {
      button.addEventListener('click', function () { switchView('team'); });
    });

    document.getElementById('addMemberBtn').addEventListener('click', function () { openMemberForm(null); });
    document.getElementById('dashboardAddMember').addEventListener('click', function () { openMemberForm(null); });

    if (grantAccessForm) {
      grantAccessForm.addEventListener('submit', handleGrantAccess);
    }

    if (accessRows) {
      accessRows.addEventListener('click', function (event) {
        var button = event.target.closest('button[data-action="revoke-access"]');
        if (!button) return;
        handleRevokeAccess(button.dataset.id);
      });
    }

    teamRows.addEventListener('click', function (event) {
      var button = event.target.closest('button[data-action]');
      if (!button) return;

      var member = members.filter(function (item) { return item.id === button.dataset.id; })[0];
      if (!member) return;

      if (button.dataset.action === 'edit') openMemberForm(member);
      if (button.dataset.action === 'delete') openDeleteDialog(member);
    });

    memberForm.addEventListener('submit', handleMemberSubmit);
    confirmDeleteBtn.addEventListener('click', handleDelete);

    document.querySelectorAll('[data-close-dialog]').forEach(function (button) {
      button.addEventListener('click', function () {
        closeDialog(button.closest('dialog'));
      });
    });

    [memberDialog, deleteDialog].forEach(function (dialog) {
      dialog.addEventListener('click', function (event) {
        if (event.target !== dialog) return;
        var rect = dialog.getBoundingClientRect();
        var inside = event.clientX >= rect.left && event.clientX <= rect.right &&
          event.clientY >= rect.top && event.clientY <= rect.bottom;
        if (!inside) closeDialog(dialog);
      });
    });

    db.auth.onAuthStateChange(function (event) {
      if (event !== 'SIGNED_OUT') return;
      if (!authScreen.hidden) return;
      currentProfile = null;
      members = [];
      tableReady = false;
      showAuth();
    });
  }

  async function bootApp() {
    if (!config || !config.url || !config.anonKey) {
      showBoot("Configuration Supabase introuvable. Vérifie js/supabase-config.js.", true);
      return;
    }

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      showBoot('Le module de connexion Supabase n’a pas pu être chargé. Recharge la page.', true);
      return;
    }

    try {
      db = window.supabase.createClient(config.url, config.anonKey, {
        auth: {
          storage: window.sessionStorage,
          storageKey: 'montevia-admin-auth',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false
        }
      });

      bindEvents();
    } catch (setupError) {
      showBoot("Impossible d'initialiser la session administrateur. Vérifie que le stockage du navigateur est autorisé, puis recharge la page.", true);
      return;
    }

    try {
      var sessionResult = await db.auth.getSession();
      if (sessionResult.error) throw sessionResult.error;

      var session = sessionResult.data ? sessionResult.data.session : null;

      if (!session || !session.user) {
        showAuth();
        return;
      }

      await verifyAndEnter(session.user);
    } catch (error) {
      showBoot(authMessage(error), true);
    }
  }

  bootApp().catch(function (error) {
    showBoot(errorMessage(error) || 'Une erreur inattendue est survenue. Recharge la page.', true);
  });
})();
