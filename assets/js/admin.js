/**
 * MONTEVIA RP — PANEL ADMIN & ÉDITEUR DU SITE
 * Annonces publiques via GitHub API (announcements.json)
 * Outils DevReports via Supabase
 * CommunityLine Studio
 */

const SUPABASE_URL = "https://bylwvlxxvgumvqgpwgod.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_T3XYbDWXV5VaC8WQj3CZOQ_LmB7CTwv";

// GitHub — dépôt hébergeant announcements.json
const GITHUB_OWNER = "Wolfiii-YTB";
const GITHUB_REPO = "Montevia";
const GITHUB_FILE = "announcements.json";
const GITHUB_BRANCH = "main";

const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const DEFAULT_CONFIG = {
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

  initAdminTabs();
  loadSiteConfigIntoForm();
  initSiteEditorSave();
  initAnnouncementPublisher();

  if (!db) {
    if (loginError) {
      loginError.textContent = "Erreur de chargement du module Supabase.";
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
    showLogin();
  }

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
          const { data, error } = await db.auth.signInWithPassword({ email: loginInput, password });
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
        loginError.textContent = err.message || "Identifiants invalides.";
        loginError.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Se connecter au Panel";
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await db.auth.signOut();
      showLogin();
    });
  }

  async function showDashboard(user) {
    if (loginSection) loginSection.style.display = 'none';
    if (dashboardSection) dashboardSection.style.display = 'block';

    const sitePane = document.getElementById('tabPane-site');
    const toolsPane = document.getElementById('tabPane-tools');
    if (sitePane) sitePane.style.display = 'block';
    if (toolsPane) toolsPane.style.display = 'none';

    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === 'site');
    });

    loadSiteConfigIntoForm();

    const emailEl = document.getElementById('staffUserEmail');
    const roleEl = document.getElementById('staffUserRole');
    const avatarEl = document.getElementById('staffAvatar');
    const nameEl = document.getElementById('staffUserName');

    if (emailEl) emailEl.textContent = user.email || "Membre du Staff";

    try {
      const { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single();
      if (profile) {
        if (roleEl) roleEl.textContent = profile.role || profile.title || "Staff Montevia";
        if (nameEl) nameEl.textContent = profile.username || profile.full_name || "Membre Staff";
        if (avatarEl) {
          avatarEl.textContent = (profile.username || profile.full_name || user.email || "ST").substring(0, 2).toUpperCase();
        }
      }
    } catch (e) {}

    // Charger l'annonce actuelle depuis GitHub
    await loadCurrentAnnouncement();
    loadRecentAnnouncements();
  }

  function showLogin() {
    if (loginSection) loginSection.style.display = 'block';
    if (dashboardSection) dashboardSection.style.display = 'none';
    if (loginForm) loginForm.reset();
  }

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

  // ─── Annonce publique : lecture depuis GitHub ────────────────────────────
  async function loadCurrentAnnouncement() {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}`,
        { headers: { 'Accept': 'application/vnd.github.v3+json' } }
      );
      if (!res.ok) return;
      const fileData = await res.json();
      const content = JSON.parse(atob(fileData.content.replace(/\n/g, '')));

      const bannerActive = document.getElementById('cfgBannerActive');
      const bannerText = document.getElementById('cfgBannerText');
      const bannerType = document.getElementById('cfgBannerType');
      const bannerLink = document.getElementById('cfgBannerLink');

      if (bannerActive) bannerActive.checked = !!content.active;
      if (bannerText) bannerText.value = content.text || '';
      if (bannerType) bannerType.value = content.type || 'info';
      if (bannerLink) bannerLink.value = content.link || '';

      updateBannerStatus(content.active, content.updated_at);
    } catch (e) {
      updateBannerStatus(false, null);
    }
  }

  function updateBannerStatus(isActive, updatedAt) {
    const statusEl = document.getElementById('bannerLiveStatus');
    if (!statusEl) return;
    const date = updatedAt ? new Date(updatedAt).toLocaleString('fr-FR') : '';
    statusEl.innerHTML = isActive
      ? `<span style="color:#10b981">● Annonce active — visible sur le site public pour tous les visiteurs</span>${date ? ` <span style="color:var(--text-muted)">— Publiée le ${date}</span>` : ''}`
      : `<span style="color:#6b7280">○ Aucune annonce active en ce moment</span>`;
  }

  // ─── Annonce publique : écriture vers GitHub ─────────────────────────────
  async function publishAnnouncementToGitHub(cfg) {
    const pat = getGithubPAT();
    if (!pat) {
      throw new Error("Token GitHub non configuré. Ajoutez votre PAT dans les paramètres du panel.");
    }

    // 1. Récupérer le SHA actuel du fichier
    const fileRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}`,
      { headers: { 'Authorization': `token ${pat}`, 'Accept': 'application/vnd.github.v3+json' } }
    );
    if (!fileRes.ok) throw new Error("Impossible de lire le fichier sur GitHub (vérifiez le PAT).");
    const fileData = await fileRes.json();
    const sha = fileData.sha;

    // 2. Encoder le nouveau contenu
    const newContent = JSON.stringify(cfg, null, 2);
    const encoded = btoa(unescape(encodeURIComponent(newContent)));

    // 3. Mettre à jour le fichier
    const updateRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${pat}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: cfg.active
            ? `annonce: activation "${cfg.text.substring(0, 50)}"`
            : "annonce: désactivation de la bannière",
          content: encoded,
          sha: sha,
          branch: GITHUB_BRANCH
        })
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.json();
      throw new Error(err.message || "Erreur GitHub lors de la mise à jour.");
    }
  }

  function getGithubPAT() {
    return sessionStorage.getItem('gh_pat') || '';
  }

  // ─── Init PAT GitHub ─────────────────────────────────────────────────────
  const patInput = document.getElementById('cfgGithubPAT');
  if (patInput) {
    // Pré-remplir si déjà saisi dans cette session
    patInput.value = sessionStorage.getItem('gh_pat') || '';
    patInput.addEventListener('change', () => {
      sessionStorage.setItem('gh_pat', patInput.value.trim());
    });
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

  function initSiteEditorSave() {
    const saveBtn = document.getElementById('saveSiteConfigBtn');
    const resetBtn = document.getElementById('resetSiteConfigBtn');

    if (saveBtn) {
      saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        saveBtn.disabled = true;
        saveBtn.textContent = "Publication en cours...";

        const announcementCfg = {
          active: document.getElementById('cfgBannerActive')?.checked || false,
          text: document.getElementById('cfgBannerText')?.value.trim() || '',
          type: document.getElementById('cfgBannerType')?.value || 'info',
          link: document.getElementById('cfgBannerLink')?.value.trim() || '',
          updated_at: new Date().toISOString()
        };

        // Sauvegarder le PAT si modifié
        const patField = document.getElementById('cfgGithubPAT');
        if (patField && patField.value.trim()) {
          sessionStorage.setItem('gh_pat', patField.value.trim());
        }

        const localConfig = {
          statusText: document.getElementById('cfgStatusText')?.value.trim() || DEFAULT_CONFIG.statusText,
          statusColor: document.getElementById('cfgStatusColor')?.value || DEFAULT_CONFIG.statusColor,
          heroTitle: document.getElementById('cfgHeroTitle')?.value.trim() || DEFAULT_CONFIG.heroTitle,
          heroDesc: document.getElementById('cfgHeroDesc')?.value.trim() || DEFAULT_CONFIG.heroDesc,
          discordUrl: document.getElementById('cfgDiscordUrl')?.value.trim() || DEFAULT_CONFIG.discordUrl,
          robloxUrl: document.getElementById('cfgRobloxUrl')?.value.trim() || DEFAULT_CONFIG.robloxUrl
        };

        try {
          // 1. Publier l'annonce sur GitHub (visible par tous)
          await publishAnnouncementToGitHub(announcementCfg);

          // 2. Sauvegarder la config locale
          localStorage.setItem('montevia_site_config', JSON.stringify(localConfig));

          updateBannerStatus(announcementCfg.active, announcementCfg.updated_at);
          showToast(announcementCfg.active
            ? "✓ Annonce publiée — visible sur le site public pour tous !"
            : "✓ Annonce désactivée — le site ne l'affiche plus."
          );
        } catch (err) {
          console.error("Erreur publication:", err);
          showToast("⚠ " + (err.message || "Erreur lors de la publication."), true);
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
    setTimeout(() => { toast.style.display = 'none'; }, 4500);
  }

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
        const { error } = await db.from('team_announcements').insert([{ title, content }]);
        if (error) throw error;
        showToast("Annonce publiée sur DevReports !");
        form.reset();
        loadRecentAnnouncements();
      } catch (err) {
        alert("Erreur: " + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = "Publier l'annonce interne";
      }
    });
  }

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
        listEl.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted); padding: 12px 0;">Aucune annonce récente.</div>`;
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
      listEl.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted); padding: 12px 0;">Réseau DevReports connecté.</div>`;
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
  }
});
