/**
 * MONTEVIA RP — SCRIPT PRINCIPAL
 * Prise en charge des configurations dynamiques du Panel Staff
 * CommunityLine Studio
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Application des configurations dynamiques du site (sauvegardées via Panel Admin)
  applyDynamicSiteConfig();

  // 2. Navigation Mobile
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

  // 3. Défilement fluide pour les ancres
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#' || targetId === '') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // 4. Accordéon FAQ
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');

    if (questionBtn && answer) {
      questionBtn.addEventListener('click', () => {
        const isActive = item.classList.contains('active');

        // Fermer les autres questions
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

  // Fonction pour appliquer la configuration en direct
  function applyDynamicSiteConfig() {
    try {
      const raw = localStorage.getItem('montevia_site_config');
      if (!raw) return;
      const config = JSON.parse(raw);

      // A. Bannière d'alerte / annonce
      if (config.announcementActive && config.announcementText) {
        let banner = document.querySelector('.site-announcement-banner');
        if (!banner) {
          banner = document.createElement('div');
          document.body.prepend(banner);
        }
        banner.className = `site-announcement-banner banner-${config.announcementType || 'info'}`;
        
        let linkHtml = '';
        if (config.announcementLink) {
          linkHtml = `<a href="${config.announcementLink}" target="_blank" rel="noopener noreferrer" class="banner-link">En savoir plus →</a>`;
        }

        banner.innerHTML = `
          <span>${config.announcementText}</span>
          ${linkHtml}
        `;
      } else {
        const banner = document.querySelector('.site-announcement-banner');
        if (banner) banner.remove();
      }

      // B. Statut du serveur & Badge
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

      // C. Titre & Pitch Hero
      if (config.heroTitle) {
        const heroTitleEl = document.querySelector('.hero-title');
        if (heroTitleEl) heroTitleEl.textContent = config.heroTitle;
      }
      if (config.heroDesc) {
        const heroDescEl = document.querySelector('.hero-description');
        if (heroDescEl) heroDescEl.textContent = config.heroDesc;
      }

      // D. Liens Discord & Roblox
      if (config.discordUrl) {
        document.querySelectorAll('a[href*="discord.gg"]').forEach(a => {
          a.href = config.discordUrl;
        });
      }
      if (config.robloxUrl) {
        document.querySelectorAll('a[href*="roblox.com"]').forEach(a => {
          a.href = config.robloxUrl;
        });
      }
    } catch (e) {
      console.warn("Erreur lors de l'application de la configuration :", e);
    }
  }
});
