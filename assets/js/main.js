/**
 * MONTEVIA RP — SCRIPT PRINCIPAL
 * Annonces en temps réel via announcements.json (GitHub Pages)
 * Visible par tous les visiteurs dès publication par le staff
 * CommunityLine Studio
 */

document.addEventListener('DOMContentLoaded', async () => {

  // 1. Chargement de l'annonce depuis announcements.json (mise à jour par le staff)
  await loadLiveAnnouncement();

  // 2. Application des configurations dynamiques locales (textes, liens)
  applyDynamicSiteConfig();

  // 3. Navigation Mobile
  const mobileToggle = document.querySelector('.mobile-toggle-btn');
  const navMenu = document.querySelector('.nav-menu');

  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      const isOpen = navMenu.classList.contains('mobile-open');
      if (isOpen) {
        navMenu.classList.remove('mobile-open');
        navMenu.style.display = 'none';
      } else {
        navMenu.classList.add('mobile-open');
        navMenu.style.display = 'flex';
        navMenu.style.flexDirection = 'column';
        navMenu.style.position = 'absolute';
        navMenu.style.top = '100%';
        navMenu.style.left = '0';
        navMenu.style.width = '100%';
        navMenu.style.backgroundColor = '#0b0c10';
        navMenu.style.padding = '20px 24px';
        navMenu.style.borderBottom = '1px solid rgba(255, 255, 255, 0.08)';
        navMenu.style.gap = '16px';
      }
    });

    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          navMenu.classList.remove('mobile-open');
          navMenu.style.display = 'none';
        }
      });
    });
  }

  // 4. Défilement fluide pour les ancres
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#' || targetId === '') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // 5. Accordéon FAQ
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');

    if (questionBtn && answer) {
      questionBtn.addEventListener('click', () => {
        const isActive = item.classList.contains('active');

        faqItems.forEach(other => {
          if (other !== item) {
            other.classList.remove('active');
            const otherAnswer = other.querySelector('.faq-answer');
            if (otherAnswer) otherAnswer.style.maxHeight = null;
          }
        });

        if (isActive) {
          item.classList.remove('active');
          answer.style.maxHeight = null;
        } else {
          item.classList.add('active');
          answer.style.maxHeight = answer.scrollHeight + 'px';
        }
      });
    }
  });

  // ─── Annonce publique depuis announcements.json ─────────────────────────
  async function loadLiveAnnouncement() {
    try {
      // Cache-bust pour toujours récupérer la dernière version
      const res = await fetch(`/Montevia/announcements.json?t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (!res.ok) return;
      const cfg = await res.json();

      if (cfg && cfg.active && cfg.text) {
        injectBanner(cfg);
      }
    } catch (e) {
      // Silencieux si le fichier est inaccessible
    }
  }

  function injectBanner(cfg) {
    // Supprimer une éventuelle bannière existante
    const existing = document.querySelector('.site-announcement-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.className = `site-announcement-banner banner-${cfg.type || 'info'}`;

    const linkHtml = cfg.link
      ? `<a href="${escapeAttr(cfg.link)}" target="_blank" rel="noopener noreferrer" class="banner-link">En savoir plus →</a>`
      : '';

    banner.innerHTML = `
      <span>${escapeHtml(cfg.text)}</span>
      ${linkHtml}
      <button class="banner-close" aria-label="Fermer" onclick="this.parentElement.remove()" style="margin-left:auto;background:none;border:none;cursor:pointer;color:inherit;font-size:1.1rem;line-height:1;padding:0 4px;opacity:0.7;">✕</button>
    `;

    document.body.prepend(banner);
  }

  // ─── Config dynamique locale (textes, liens) ─────────────────────────────
  function applyDynamicSiteConfig() {
    try {
      const raw = localStorage.getItem('montevia_site_config');
      if (!raw) return;
      const config = JSON.parse(raw);

      if (config.statusText) {
        const statusSpan = document.querySelector('.status-badge span:last-child');
        if (statusSpan) statusSpan.textContent = config.statusText;
      }
      if (config.statusColor) {
        const statusDot = document.querySelector('.status-dot');
        if (statusDot) {
          statusDot.style.backgroundColor = config.statusColor;
          statusDot.style.boxShadow = `0 0 10px ${config.statusColor}`;
        }
      }

      if (config.heroTitle) {
        const heroTitleEl = document.querySelector('.hero-title');
        if (heroTitleEl) heroTitleEl.textContent = config.heroTitle;
      }
      if (config.heroDesc) {
        const heroDescEl = document.querySelector('.hero-description');
        if (heroDescEl) heroDescEl.textContent = config.heroDesc;
      }

      if (config.discordUrl) {
        document.querySelectorAll('a[href*="discord.gg"]').forEach(a => { a.href = config.discordUrl; });
      }
      if (config.robloxUrl) {
        document.querySelectorAll('a[href*="roblox.com"]').forEach(a => { a.href = config.robloxUrl; });
      }
    } catch (e) {
      console.warn("Config locale invalide :", e);
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
  }

  function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
});
