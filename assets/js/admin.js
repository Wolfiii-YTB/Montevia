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
    if (session) {
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

  // Remplir les champs avec la configuration actuelle
  function loadSiteConfigIntoForm() {
    const raw = localStorage.getItem('montevia_site_config');
    const config = raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG;

    const bannerActive = document.getElementById('cfgBannerActive');
    const bannerText = document.getElementById('cfgBannerText');
    const bannerType = document.getElementById('cfgBannerType');
    const bannerLink = document.getElementById('cfgBannerLink');

    const statusText = document.getElementById('cfgStatusText');
    const statusColor = document.getElementById('cfgStatusColor');

    const heroTitle = document.getElementById('cfgHeroTitle');
    const heroDesc = document.getElementById('cfgHeroDesc');

    const discordUrl = document.getElementById('cfgDiscordUrl');
    const robloxUrl = document.getElementById('cfgRobloxUrl');

    if (bannerActive) bannerActive.checked = config.announcementActive;
    if (bannerText) bannerText.value = config.announcementText || '';
    if (bannerType) bannerType.value = config.announcementType || 'info';
    if (bannerLink) bannerLink.value = config.announcementLink || '';

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
      saveBtn.addEventListener('click', (e) => {
        e.preventDefault();

        const config = {
          announcementActive: document.getElementById('cfgBannerActive')?.checked || false,
          announcementText: document.getElementById('cfgBannerText')?.value.trim() || '',
          announcementType: document.getElementById('cfgBannerType')?.value || 'info',
          announcementLink: document.getElementById('cfgBannerLink')?.value.trim() || '',
          
          statusText: document.getElementById('cfgStatusText')?.value.trim() || DEFAULT_CONFIG.statusText,
          statusColor: document.getElementById('cfgStatusColor')?.value || DEFAULT_CONFIG.statusColor,
          
          heroTitle: document.getElementById('cfgHeroTitle')?.value.trim() || DEFAULT_CONFIG.heroTitle,
          heroDesc: document.getElementById('cfgHeroDesc')?.value.trim() || DEFAULT_CONFIG.heroDesc,
          
          discordUrl: document.getElementById('cfgDiscordUrl')?.value.trim() || DEFAULT_CONFIG.discordUrl,
          robloxUrl: document.getElementById('cfgRobloxUrl')?.value.trim() || DEFAULT_CONFIG.robloxUrl
        };

        localStorage.setItem('montevia_site_config', JSON.stringify(config));
        showToast("Modifications enregistrées ! Le site est mis à jour.");
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
  function showToast(msg) {
    let toast = document.getElementById('adminToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'adminToast';
      toast.className = 'admin-save-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3500);
  }

  // Publication d'annonce interne
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

  // Charger les dernières annonces
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
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }
});
