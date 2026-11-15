/* Montevia Team Manager - Gestion des membres de l'équipe
   Utilisation de Supabase pour la synchronisation avec DevReports
   https://bylwvlxxvgumvqgpwgod.supabase.co */

var POLES = {
  direction: 'Direction',
  developpement: 'Développement',
  moderation: 'Modération',
  support: 'Support & animation',
  studio: 'Studio',
  autre: 'Autre'
};

/* ---------- Initialisation Supabase ---------- */

function initSupabase() {
  if (!window.MONTEVIA_SUPABASE) return null;
  if (!window.supabase || typeof window.supabase.createClient !== 'function') return null;
  try {
    var supabase = window.supabase.createClient(
      window.MONTEVIA_SUPABASE.url,
      window.MONTEVIA_SUPABASE.anonKey
    );
    return supabase;
  } catch (e) {
    console.error('Erreur Supabase:', e);
    return null;
  }
}

/* ---------- Utilitaires ---------- */

function node(tag, className, text) {
  var el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function safeHttps(url) {
  if (!url) return null;
  var protocol = String(url).split('://')[0];
  return (protocol === 'http' || protocol === '') ? 'https://' + url : url;
}

function initials(name) {
  var words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'M';
  return words.slice(0, 2).map(function (word) {
    return Array.from(word)[0] || '';
  }).join('').toUpperCase();
}

function avatar(member) {
  var wrap = node('span', 'member__avatar');
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
    wrap.classList.add('is-fallback');
  }
  return wrap;
}

/* ---------- Récupération des membres ---------- */

async function fetchMembers() {
  var supabase = initSupabase();
  if (!supabase) return [];

  var table = (window.MONTEVIA_SUPABASE && window.MONTEVIA_SUPABASE.teamTable) || 'montevia_team_members';

  try {
    var queryPromise = supabase
      .from(table)
      .select('*')
      .order('sort_order', { ascending: true })
      .order('display_name', { ascending: true });

    var timeoutPromise = new Promise(function (resolve) {
      setTimeout(function () { resolve({ data: null, error: new Error('timeout') }); }, 5000);
    });

    var result = await Promise.race([queryPromise, timeoutPromise]);

    if (result.error) {
      console.error('Erreur récupération membres:', result.error);
      return [];
    }
    return Array.isArray(result.data) ? result.data : [];
  } catch (e) {
    console.error('Erreur récupération membres:', e);
    return [];
  }
}

/* ---------- État ---------- */

var members = [];
var showcaseIndex = 0;
var showcaseTimer = null;

/* ---------- Affichage ---------- */

async function displayMembers() {
  members = await fetchMembers();

  var section = document.getElementById('membres');
  if (section) {
    section.hidden = members.length === 0;
  }

  if (members.length) {
    showcaseIndex = Math.floor(Math.random() * members.length);
  }

  renderRoster();
  renderShowcase();
  startRotation();
}

function renderRoster() {
  var container = document.getElementById('roster');
  if (!container) return;

  container.innerHTML = '';

  members.forEach(function (member) {
    var card = node('article', 'member');

    var head = node('div', 'member__head');
    head.append(avatar(member));

    var identity = node('div', 'member__identity');
    identity.append(node('h3', '', member.display_name || 'Membre'));
    if (member.username) {
      identity.append(node('p', '', '@' + String(member.username).replace(/^@/, '')));
    }
    head.append(identity);
    card.append(head);

    var tags = node('div', 'member__tags');
    if (member.role_label) {
      tags.append(node('span', 'member__role', member.role_label));
    }
    if (POLES[member.pole]) {
      tags.append(node('span', 'member__pole', POLES[member.pole]));
    }
    if (tags.childElementCount) card.append(tags);

    if (member.bio) {
      card.append(node('p', 'member__bio', member.bio));
    }

    var links = node('div', 'member__links');
    var roblox = safeHttps(member.roblox_url);
    if (roblox) {
      var link = document.createElement('a');
      link.href = roblox;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Profil Roblox';
      links.append(link);
    }
    if (member.discord_username) {
      links.append(node('span', 'member__discord', 'Discord · ' + String(member.discord_username).replace(/^@/, '')));
    }
    if (links.childElementCount) card.append(links);

    container.append(card);
  });
}

function renderShowcase() {
  var container = document.getElementById('showcase');
  if (!container) return;

  container.innerHTML = '';

  if (!members.length) {
    var empty = node('p', '', 'Aucun membre disponible');
    empty.style.textAlign = 'center';
    empty.style.color = 'var(--text-3)';
    container.append(empty);
    return;
  }

  var member = members[showcaseIndex % members.length];

  var card = node('article', 'member member--showcase');

  var head = node('div', 'member__head');
  head.append(avatar(member));

  var identity = node('div', 'member__identity');
  identity.append(node('h3', '', member.display_name || 'Membre'));
  if (member.username) {
    identity.append(node('p', '', '@' + String(member.username).replace(/^@/, '')));
  }
  head.append(identity);
  card.append(head);

  var tags = node('div', 'member__tags');
  if (member.role_label) {
    tags.append(node('span', 'member__role', member.role_label));
  }
  if (POLES[member.pole]) {
    tags.append(node('span', 'member__pole', POLES[member.pole]));
  }
  if (tags.childElementCount) card.append(tags);

  var meta = node('div', 'member__meta');
  if (member.status) {
    var statusP = node('p', 'member__status', '');
    var dotClass = 'member__status__dot';
    var lower = String(member.status).toLowerCase();
    if (lower !== 'actif' && lower !== 'active' && lower !== 'en ligne') {
      dotClass += ' member__status__dot--inactive';
    }
    statusP.append(node('span', dotClass));
    statusP.append(node('span', 'member__status__label', member.status));
    meta.append(statusP);
  }
  if (member.is_moderator) {
    meta.append(node('p', '', 'Modérateur'));
  }
  if (member.is_admin) {
    meta.append(node('p', '', 'Administrateur'));
  }
  if (meta.childElementCount) card.append(meta);

  if (member.bio) {
    card.append(node('p', 'member__bio', member.bio));
  }

  var links = node('div', 'member__links');
  var roblox = safeHttps(member.roblox_url);
  if (roblox) {
    var link = document.createElement('a');
    link.href = roblox;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Profil Roblox';
    links.append(link);
  }
  if (member.discord_username) {
    links.append(node('span', 'member__discord', 'Discord · ' + String(member.discord_username).replace(/^@/, '')));
  }
  if (links.childElementCount) card.append(links);

  container.append(card);
}

function startRotation() {
  if (showcaseTimer) clearTimeout(showcaseTimer);
  if (members.length <= 1) return;
  showcaseTimer = setTimeout(function () {
    var next = Math.floor(Math.random() * members.length);
    if (next === showcaseIndex && members.length > 1) {
      next = (next + 1) % members.length;
    }
    showcaseIndex = next;
    renderShowcase();
    startRotation();
  }, 5000);
}

/* ---------- Initialisation ---------- */

async function init() {
  await displayMembers();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/* ---------- Exportation ---------- */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fetchMembers: fetchMembers,
    displayMembers: displayMembers,
    renderRoster: renderRoster,
    renderShowcase: renderShowcase
  };
}