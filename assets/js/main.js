/**
 * MONTEVIA RP — SCRIPT PRINCIPAL & LOGIQUE INTERACTIVE
 * CommunityLine Studio (CLS)
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. GESTION DU HEADER LORS DU DÉFILEMENT
  const header = document.querySelector('.site-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  // 2. MENU MOBILE RESPONSIVE
  const menuToggle = document.querySelector('.menu-toggle');
  const navMenu = document.querySelector('.nav-menu');

  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
      const isOpen = navMenu.classList.contains('open');
      menuToggle.setAttribute('aria-expanded', isOpen);
    });

    // Fermer le menu mobile en cliquant sur un lien
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
      });
    });
  }

  // 3. SYNTHÉTISEUR AUDIO WEB AUDIO API (CARILLON TRAMWAY FRANÇAIS)
  let audioCtx = null;

  function playTramChime(stationName = "Mairie de Montévia") {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!audioCtx) {
        audioCtx = new AudioContext();
      }

      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const now = audioCtx.currentTime;

      // Note 1 (ex: Sol 4 - 392Hz)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5

      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.25, now + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);

      osc1.start(now);
      osc1.stop(now + 0.85);

      // Note 2 (ex: Do 5 - 659.25Hz)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.35); // E5

      gain2.gain.setValueAtTime(0, now + 0.35);
      gain2.gain.linearRampToValueAtTime(0.3, now + 0.4);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.25);

      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);

      osc2.start(now + 0.35);
      osc2.stop(now + 1.3);

      // Animation du bouton
      const chimeBtn = document.getElementById('tramChimeBtn');
      if (chimeBtn) {
        chimeBtn.classList.add('playing');
        setTimeout(() => chimeBtn.classList.remove('playing'), 1400);
      }

      showToast(`🚊 Ding-Dong : "Prochain arrêt — ${stationName}"`);
    } catch (e) {
      console.warn("Audio non autorisé ou non supporté :", e);
    }
  }

  const tramChimeBtn = document.getElementById('tramChimeBtn');
  if (tramChimeBtn) {
    tramChimeBtn.addEventListener('click', () => {
      playTramChime("Mairie de Montévia");
    });
  }

  // 4. CARTE INTERACTIVE DU RÉSEAU DE TRAMWAY (LIGNE T1)
  const stationsData = {
    "gare": {
      name: "Gare Centrale — Esplanade",
      desc: "Pôle multimodal d'échange de Montévia. Correspondance avec les lignes régionales, hall voyageur, boutiques de presse et parvis piétonnier.",
      connections: ["TER Alsace", "Lignes Bus Civils", "Taxis", "Location Vélos"],
      eta: "Départ",
      status: "Trafic Normal"
    },
    "kleber": {
      name: "Place d'Alsace",
      desc: "Cœur historique bordé d'immeubles traditionnels alsaciens et de terrasses de café. Grand carrefour commercial et zone de détente.",
      connections: ["Pharmacie Centrale", "Commerces de Proximité", "Terrasses"],
      eta: "+ 2 min",
      status: "Trafic Normal"
    },
    "mairie": {
      name: "Mairie de Montévia",
      desc: "Station centrale emblématique. Accès direct à l'Hôtel de Ville, aux services de police municipale et aux grands édifices administratifs.",
      connections: ["Hôtel de Ville", "Services d'État Civil", "Commissariat Municipal", "Poste"],
      eta: "+ 4 min",
      status: "Station Principale"
    },
    "hopital": {
      name: "Centre Hospitalier & Secours",
      desc: "Pôle médical majeur et caserne des sapeurs-pompiers. Voies prioritaires et accès rapide aux urgences médicales.",
      connections: ["Urgences SAMU", "Caserne Pompiers", "Héliport Secours"],
      eta: "+ 7 min",
      status: "Accès Prioritaire"
    },
    "affaires": {
      name: "Quartier Bancaire & Affaires",
      desc: "Centre financier de la métropole. Siège de la Banque Nationale de Montévia, cabinets d'avocats et concessions automobiles.",
      connections: ["Banque Centrale", "Concessionnaire Auto", "Bureaux d'Affaires"],
      eta: "+ 10 min",
      status: "Trafic Normal"
    },
    "terminus": {
      name: "Les Colombages (Terminus)",
      desc: "Quartier résidentiel calme aux ruelles pavées pittoresques. Dépôt technique et ateliers de maintenance des rames de tramway.",
      connections: ["Dépôt Tramway CTS", "Zone Pavillonnaire", "Parc Naturel"],
      eta: "+ 13 min",
      status: "Terminus Ligne T1"
    }
  };

  const stationNodes = document.querySelectorAll('.station-node');
  const detailTitle = document.getElementById('stationDetailTitle');
  const detailDesc = document.getElementById('stationDetailDesc');
  const detailTags = document.getElementById('stationDetailTags');

  stationNodes.forEach(node => {
    node.addEventListener('click', () => {
      const stationKey = node.getAttribute('data-station');
      const data = stationsData[stationKey];

      if (data) {
        stationNodes.forEach(n => n.classList.remove('active'));
        node.classList.add('active');

        if (detailTitle) detailTitle.textContent = data.name;
        if (detailDesc) detailDesc.textContent = data.desc;
        if (detailTags) {
          detailTags.innerHTML = data.connections.map(c => `<span class="con-tag">${c}</span>`).join('');
        }

        // Jouer le carillon avec le nom de la station
        playTramChime(data.name);
      }
    });
  });

  // 5. ONGLETS SERVICES & FACTIONS
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetContent = document.getElementById(`tab-${targetTab}`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });

  // 6. ACCORDÉON DES RÈGLES RP
  const ruleHeaders = document.querySelectorAll('.rule-header');

  ruleHeaders.forEach(headerEl => {
    headerEl.addEventListener('click', () => {
      const item = headerEl.parentElement;
      const body = item.querySelector('.rule-body');
      const isOpen = item.classList.contains('open');

      // Fermer les autres (optionnel ou multi-ouvert)
      document.querySelectorAll('.rule-item').forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('open');
          const otherBody = otherItem.querySelector('.rule-body');
          if (otherBody) otherBody.style.maxHeight = null;
        }
      });

      if (isOpen) {
        item.classList.remove('open');
        body.style.maxHeight = null;
      } else {
        item.classList.add('open');
        body.style.maxHeight = body.scrollHeight + 'px';
      }
    });
  });

  // 7. GESTION DES MODALES
  const modalBackdrops = document.querySelectorAll('.modal-backdrop');
  const modalCloseBtns = document.querySelectorAll('.modal-close-btn');

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal() {
    modalBackdrops.forEach(m => m.classList.remove('open'));
    document.body.style.overflow = '';
  }

  document.querySelectorAll('[data-open-modal]').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const modalId = trigger.getAttribute('data-open-modal');
      openModal(modalId);
    });
  });

  modalCloseBtns.forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  modalBackdrops.forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        closeModal();
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });

  // 8. SYSTÈME DE TOAST NOTIFICATIONS
  function showToast(message, duration = 3500) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    // Déclencher l'animation d'entrée
    setTimeout(() => toast.classList.add('show'), 10);

    // Supprimer après duration
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  }

  // 9. ANIMATION FLUIDE DES STATISTIQUES AU SCROLL
  const statsElements = document.querySelectorAll('.stat-number[data-count]');
  let statsAnimated = false;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !statsAnimated) {
        statsAnimated = true;
        statsElements.forEach(el => {
          const target = parseInt(el.getAttribute('data-count'), 10);
          const suffix = el.getAttribute('data-suffix') || '';
          let current = 0;
          const increment = Math.ceil(target / 40);
          const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
              el.textContent = target + suffix;
              clearInterval(timer);
            } else {
              el.textContent = current + suffix;
            }
          }, 30);
        });
      }
    });
  }, { threshold: 0.5 });

  const statsBar = document.querySelector('.hero-stats-bar');
  if (statsBar) {
    observer.observe(statsBar);
  }

  // Exposer les helpers globalement si besoin
  window.Montevia = {
    playTramChime,
    showToast,
    openModal,
    closeModal
  };
});
