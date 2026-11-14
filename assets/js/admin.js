/**
 * MONTEVIA RP — PANEL ADMIN & ÉDITEUR DU SITE
 * Intégration Supabase DevReports & Gestion du contenu en direct
 * URL: https://bylwvlxxvgumvqgpwgod.supabase.co
 */

const SUPABASE_URL = "https://bylwvlxxvgumvqgpwgod.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_T3XYbDWXV5VaC8WQj3CZOQ_LmB7CTwv";

const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Configuration par défaut du site
const DEFAULT_CONFIG = {
  announcementActive: false,
  announcementText: "Session de test ouverte ce week-end ! Rejoignez le serveur Discord pour participer.",
  announcementType: "info",
  announcementLink: "https://discord.gg/6wHfn69Jt",
  
  statusText: "Phase de test active • Serious RP 16+",
  statusColor: "#10b981",
  
  heroTitle: "Le Roleplay français inspiré de l'Alsace.",
  heroDesc: "Plongez dans Montévia, un univers urbain soigné développé par CommunityLine Studio. Une ville vivante, des interactions crédibles et surtout une équipe disponible et attentive à sa communauté.",
  
  discordUrl: "https://discord.gg/6wHfn69Jt",
  robloxUrl: "https://www.roblox.com/fr/games/136984692229053/Montevia"
};

document.addEventListener('DOMContentLoaded', async () => {
  const loginSection = document.getElementById('adminLoginSection');
  const dashboardSection = document.getElementById('adminDashboardSection');
  const loginForm = document.getElementById('staffLoginForm');
  const loginError = document.getElementById('loginErrorMessage');
  const submitBtn = document.getElementById('staffSubmitBtn');
  const logoutBtn = document.getElementById('staffLogoutBtn');
  
  // 1. Initialisation des onglets du Panel
  initAdminTabs();

  // 2. Chargement de la configuration du site dans les formulaires
  loadSiteConfigIntoForm();

  // 3. Gestionnaire de sauvegarde du site
  initSiteEditorSave();

  // 4. Publication d'annonce interne DevReports
  initAnnouncementPublisher();

  // 5. Vérification de la session Supabase
  if (!db) {
    if (loginError) {
      loginError.textContent = "Erreur de chargement du module Supabase. Veuillez recharger la page.";
      loginError.style.display = 'block';
    }
    return;
  }

  try {
    const { data: { session } } = await db.auth.getSession();
    if (session && session.user) {
      showDashboard(session.user);
    } else {
      showLogin();
    }
  } catch (err) {
    console.error("Erreur session:", err);
    showLogin();
  }

  // 6. Formulaire de connexion Staff (Email ou Identifiant DevReports)
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginError.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = "Vérification en cours...";

      const loginInput = document.getElementById('staffLoginInput').value.trim();
      const password = document.getElementById('staffPasswordInput').value;

      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginInput);

      try {
        if (isEmail) {
          const { data, error } = await db.auth.signInWithPassword({
            email: loginInput,
            password: password
          });
          if (error) throw error;
          showDashboard(data.user);
        } else {
          const { data, error } = await db.functions.invoke("login-by-identifier", {
            body: { identifier: loginInput.toLowerCase(), password }
          });

          if (error || !data?.access_token || !data?.refresh_token) {
            throw new Error(data?.error || "Identifiant ou mot de passe incorrect.");
          }

          const { data: sessionData, error: sessionError } = await db.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token
          });

          if (sessionError) throw sessionError;
          showDashboard(sessionData.user);
        }
      } catch (err) {
        console.error("Échec connexion staff:", err);
        loginError.textContent = err.message || "Identifiants invalides. Vérifiez votre compte DevReports.";
        loginError.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Se connecter au Panel";
      }
    });
  }

  // 7. Déconnexion
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await db.auth.signOut();
      showLogin();
    });
  }

  // Fonctions d'affichage
  async function showDashboard(user) {
    if (loginSection) loginSection.style.display = 'none';
    if (dashboardSection) dashboardSection.style.display = 'block';

    // Forcer l'affichage de l'onglet Éditeur du site par défaut
    const sitePane = document.getElementById('tabPane-site');
    const toolsPane = document.getElementById('tabPane-tools');
    if (sitePane) sitePane.style.display = 'block';
    if (toolsPane) toolsPane.style.display = 'none';

    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      if (btn.getAttribute('data-tab') === 'site') {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    loadSiteConfigIntoForm();

    const emailEl = document.getElementById('staffUserEmail');
    const roleEl = document.getElementById('staffUserRole');
    const avatarEl = document.getElementById('staffAvatar');
    const nameEl = document.getElementById('staffUserName');

    if (emailEl) emailEl.textContent = user.email || user.user_metadata?.email || "Membre du Staff";
    
    try {
      const { data: profile } = await db
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        if (roleEl) roleEl.textContent = profile.role || profile.title || "Staff Montevia";
        if (nameEl) nameEl.textContent = profile.username || profile.full_name || "Membre Staff";
        if (avatarEl) {
          avatarEl.textContent = (profile.username || profile.full_name || user.email || "ST").substring(0, 2).toUpperCase();
        }
      }
    } catch (e) {
      console.warn("Profil non récupéré :", e);
    }

    // Charger l'annonce active depuis Supabase dans le formulaire
    await loadAnnouncementFromSupabase();
    loadRecentAnnouncements();
  }

  function showLogin() {
    if (loginSection) loginSection.style.display = 'block';
    if (dashboardSection) dashboardSection.style.display = 'none';
    if (loginForm) loginForm.reset();
  }

  // Gestion des onglets
  function initAdminTabs() {
    const tabs = document.querySelectorAll('.admin-tab-btn');
    const panes = document.querySelectorAll('.admin-tab-pane');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-tab');

        tabs.forEach(t => t.classList.remove('active'));
        panes.forEach(p => p.style.display = 'none');

        tab.classList.add('active');
        const targetPane = document.getElementById(`tabPane-${target}`);
        if (targetPane) targetPane.style.display = 'block';
      });
    });
  }

  // ─── Annonce publique : lecture depuis Supabase ───────────────────────────
  async function loadAnnouncementFromSupabase() {
    try {
      const { data, error } = await db
        .from('site_config')
        .select('*')
        .eq('key', 'site_announcement')
        .single();

      if (error || !data) return;

      let cfg = data.value;
      if (typeof cfg === 'string') {
        try { cfg = JSON.parse(cfg); } catch (e) { return; }
      }

      const bannerActive = document.getElementById('cfgBannerActive');
      const bannerText = document.getElementById('cfgBannerText');
      const bannerType = document.getElementById('cfgBannerType');
      const bannerLink = document.getElementById('cfgBannerLink');

      if (bannerActive) bannerActive.checked = !!cfg.active;
      if (bannerText) bannerText.value = cfg.text || '';
      if (bannerType) bannerType.value = cfg.type || 'info';
      if (bannerLink) bannerLink.value = cfg.link || '';

      // Afficher un indicateur d'état
      updateBannerStatus(cfg.active, data.updated_at);
    } catch (e) {
      console.warn("Annonce Supabase non chargée :", e);
    }
  }

  function updateBannerStatus(isActive, updatedAt) {
    const statusEl = document.getElementById('bannerLiveStatus');
    if (!statusEl) return;
    const date = updatedAt ? new Date(updatedAt).toLocaleString('fr-FR') : '';
    statusEl.innerHTML = isActive
      ? `<span style="color:#10b981">● Annonce active sur le site public</span>${date ? ` — Dernière mise à jour : ${date}` : ''}`
      : `<span style="color:#6b7280">○ Aucune annonce active</span>`;
  }

  // ─── Annonce publique : sauvegarde dans Supabase ─────────────────────────
  async function saveAnnouncementToSupabase(cfg) {
    const { error } = await db
      .from('site_config')
      .upsert(
        { key: 'site_announcement', value: cfg },
        { onConflict: 'key' }
      );
    if (error) throw error;
  }

  // Remplir les champs avec la configuration locale
  function loadSiteConfigIntoForm() {
    const raw = localStorage.getItem('montevia_site_config');
    const config = raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG;

    const statusText = document.getElementById('cfgStatusText');
    const statusColor = document.getElementById('cfgStatusColor');
    const heroTitle = document.getElementById('cfgHeroTitle');
    const heroDesc = document.getElementById('cfgHeroDesc');
    const discordUrl = document.getElementById('cfgDiscordUrl');
    const robloxUrl = document.getElementById('cfgRobloxUrl');

    if (statusText) statusText.value = config.statusText || '';
    if (statusColor) statusColor.value = config.statusColor || '#10b981';
    if (heroTitle) heroTitle.value = config.heroTitle || '';
    if (heroDesc) heroDesc.value = config.heroDesc || '';
    if (discordUrl) discordUrl.value = config.discordUrl || '';
    if (robloxUrl) robloxUrl.value = config.robloxUrl || '';
  }

  // Enregistrer les modifications du site
  function initSiteEditorSave() {
    const saveBtn = document.getElementById('saveSiteConfigBtn');
    const resetBtn = document.getElementById('resetSiteConfigBtn');

    if (saveBtn) {
      saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        saveBtn.disabled = true;
        saveBtn.textContent = "Enregistrement...";

        // — Annonce publique → Supabase
        const announcementCfg = {
          active: document.getElementById('cfgBannerActive')?.checked || false,
          text: document.getElementById('cfgBannerText')?.value.trim() || '',
          type: document.getElementById('cfgBannerType')?.value || 'info',
          link: document.getElementById('cfgBannerLink')?.value.trim() || ''
        };

        // — Configuration locale (textes, liens) → localStorage
        const localConfig = {
          statusText: document.getElementById('cfgStatusText')?.value.trim() || DEFAULT_CONFIG.statusText,
          statusColor: document.getElementById('cfgStatusColor')?.value || DEFAULT_CONFIG.statusColor,
          heroTitle: document.getElementById('cfgHeroTitle')?.value.trim() || DEFAULT_CONFIG.heroTitle,
          heroDesc: document.getElementById('cfgHeroDesc')?.value.trim() || DEFAULT_CONFIG.heroDesc,
          discordUrl: document.getElementById('cfgDiscordUrl')?.value.trim() || DEFAULT_CONFIG.discordUrl,
          robloxUrl: document.getElementById('cfgRobloxUrl')?.value.trim() || DEFAULT_CONFIG.robloxUrl
        };

        try {
          // 1. Publier l'annonce dans Supabase (visible par tous)
          await saveAnnouncementToSupabase(announcementCfg);

          // 2. Sauvegarder le reste en localStorage
          localStorage.setItem('montevia_site_config', JSON.stringify(localConfig));

          updateBannerStatus(announcementCfg.active, new Date().toISOString());
          showToast(announcementCfg.active
            ? "✓ Annonce publiée — visible sur le site public pour tous les visiteurs !"
            : "✓ Annonce désactivée — le site ne l'affiche plus."
          );
        } catch (err) {
          console.error("Erreur sauvegarde annonce :", err);
          showToast("⚠ Erreur Supabase : " + (err.message || "Vérifiez votre connexion."), true);
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = "Enregistrer & Appliquer";
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm("Réinitialiser tous les textes et liens aux valeurs d'origine ?")) {
          localStorage.removeItem('montevia_site_config');
          loadSiteConfigIntoForm();
          showToast("Valeurs réinitialisées par défaut.");
        }
      });
    }
  }

  // Notification Toast
  function showToast(msg, isError = false) {
    let toast = document.getElementById('adminToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'adminToast';
      toast.className = 'admin-save-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.background = isError ? '#7f1d1d' : '';
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 4000);
  }

  // Publication d'annonce interne (DevReports)
  function initAnnouncementPublisher() {
    const form = document.getElementById('staffAnnouncementForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('announcementTitle').value.trim();
      const content = document.getElementById('announcementContent').value.trim();
      const btn = document.getElementById('publishAnnouncementBtn');

      if (!title || !content) return;
      btn.disabled = true;
      btn.textContent = "Publication...";

      try {
        const { error } = await db
          .from('team_announcements')
          .insert([{ title, content }]);

        if (error) throw error;
        showToast("Annonce publiée sur DevReports !");
        form.reset();
        loadRecentAnnouncements();
      } catch (err) {
        alert("Erreur de publication: " + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = "Publier l'annonce interne";
      }
    });
  }

  // Charger les dernières annonces internes DevReports
  async function loadRecentAnnouncements() {
    const listEl = document.getElementById('recentAnnouncementsList');
    if (!listEl || !db) return;

    try {
      const { data: announcements, error } = await db
        .from('team_announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

      if (error || !announcements || announcements.length === 0) {
        listEl.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted); padding: 12px 0;">Aucune annonce récente de l'équipe.</div>`;
        return;
      }

      listEl.innerHTML = announcements.map(a => `
        <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 14px 18px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <strong style="color: #fff; font-size: 0.92rem;">${escapeHtml(a.title || 'Annonce')}</strong>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${new Date(a.created_at).toLocaleDateString('fr-FR')}</span>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5;">${escapeHtml(a.content || a.message || '')}</p>
        </div>
      `).join('');
    } catch (e) {
      listEl.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted); padding: 12px 0;">Connecté au réseau DevReports.</div>`;
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
  }
});
