/**
 * MONTEVIA RP — PANEL ADMIN & ESPACE STAFF
 * Intégration Supabase connectée au projet DevReports
 * URL: https://bylwvlxxvgumvqgpwgod.supabase.co
 */

const SUPABASE_URL = "https://bylwvlxxvgumvqgpwgod.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_T3XYbDWXV5VaC8WQj3CZOQ_LmB7CTwv";

// Initialisation du client Supabase
const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

document.addEventListener('DOMContentLoaded', async () => {
  const loginSection = document.getElementById('adminLoginSection');
  const dashboardSection = document.getElementById('adminDashboardSection');
  const loginForm = document.getElementById('staffLoginForm');
  const loginError = document.getElementById('loginErrorMessage');
  const submitBtn = document.getElementById('staffSubmitBtn');
  const logoutBtn = document.getElementById('staffLogoutBtn');
  
  if (!db) {
    if (loginError) {
      loginError.textContent = "Erreur de chargement du module Supabase. Veuillez recharger la page.";
      loginError.style.display = 'block';
    }
    return;
  }

  // 1. Vérification de la session existante
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

  // 2. Gestion de la connexion (Email ou Identifiant DevReports)
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
          // Connexion par adresse e-mail
          const { data, error } = await db.auth.signInWithPassword({
            email: loginInput,
            password: password
          });

          if (error) throw error;
          showDashboard(data.user);
        } else {
          // Connexion par identifiant (Edge Function DevReports)
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

  // 3. Déconnexion
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await db.auth.signOut();
      showLogin();
    });
  }

  // Afficher le tableau de bord
  async function showDashboard(user) {
    if (loginSection) loginSection.style.display = 'none';
    if (dashboardSection) dashboardSection.style.display = 'block';

    // Remplir les informations utilisateur
    const emailEl = document.getElementById('staffUserEmail');
    const roleEl = document.getElementById('staffUserRole');
    const avatarEl = document.getElementById('staffAvatar');

    if (emailEl) emailEl.textContent = user.email || user.user_metadata?.email || "Membre du Staff";
    
    // Récupérer le profil dans Supabase
    try {
      const { data: profile } = await db
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        if (roleEl) roleEl.textContent = profile.role || profile.title || "Staff Montevia";
        if (avatarEl) {
          avatarEl.textContent = (profile.username || profile.full_name || user.email || "S").substring(0, 2).toUpperCase();
        }
        const nameEl = document.getElementById('staffUserName');
        if (nameEl) nameEl.textContent = profile.username || profile.full_name || "Membre Staff";
      }
    } catch (e) {
      console.warn("Profil non récupéré :", e);
    }

    // Charger les dernières annonces ou rapports récents
    loadRecentAnnouncements();
  }

  // Afficher la page de connexion
  function showLogin() {
    if (loginSection) loginSection.style.display = 'block';
    if (dashboardSection) dashboardSection.style.display = 'none';
    if (loginForm) loginForm.reset();
  }

  // Charger les dernières annonces de l'équipe
  async function loadRecentAnnouncements() {
    const listEl = document.getElementById('recentAnnouncementsList');
    if (!listEl) return;

    try {
      const { data: announcements, error } = await db
        .from('team_announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

      if (error || !announcements || announcements.length === 0) {
        listEl.innerHTML = `<div class="empty-state">Aucune annonce récente de l'équipe.</div>`;
        return;
      }

      listEl.innerHTML = announcements.map(a => `
        <div class="announcement-card">
          <div class="announcement-header">
            <strong>${escapeHtml(a.title || 'Annonce Staff')}</strong>
            <span class="announcement-date">${new Date(a.created_at).toLocaleDateString('fr-FR')}</span>
          </div>
          <p>${escapeHtml(a.content || a.message || '')}</p>
        </div>
      `).join('');
    } catch (e) {
      listEl.innerHTML = `<div class="empty-state">Connecté au réseau DevReports. Accès sécurisé.</div>`;
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
