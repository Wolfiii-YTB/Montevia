/* Montevia Team Manager - Gestion des membres de l'équipe
   Utilisation de Supabase pour la synchronisation avec DevReports
   https://bylwvlxxvgumvqgpwgod.supabase.co */

var SUPABASE_URL = 'https://bylwvlxxvgumvqgpwgod.supabase.co';
var SUPABASE_KEY = 'sb_publishable_T3XYbDWXV5VaC8WQj3CZOQ_LmB7CTwv';

var POLES = {
  1: 'France',
  2: 'Belgique',
  3: 'Canada',
  4: 'Québec',
  5: 'Afrique du Sud',
  6: 'Inde',
  7: 'Arabie saoudite',
  8: 'Égypte',
  9: 'Brésil',
  10: 'Argentine',
  11: 'Mexique',
  12: 'Pologne',
  13: 'Espagne',
  14: 'Portugal',
  15: 'Chine',
  16: 'Japon',
  17: 'Corée du Sud',
  18: 'Turquie',
  19: 'Russie',
  20: 'États-Unis',
  21: 'Australie',
  22: 'Nouvelle-Zélande',
  23: 'Philippines',
  24: 'Malaisie',
  25: 'Singapour',
  26: 'Indonésie',
  27: 'Thaïlande',
  28: 'Vietnam'
};

/* ---------- Initialisation Supabase ---------- */

function initSupabase() {
  try {
    var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return supabase;
  } catch (e) {
    console.error('Erreur Supabase:', e);
    return null;
  }
}

/* ---------- Récupération des membres ---------- */

async function fetchMembers() {
  const supabase = initSupabase();
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('montevia_team_members')
      .select('*')
      .order('display_name');

    if (error) {
      console.error('Erreur récupération membres:', error);
      return [];
    }

    if (!data) data = [];
    return data;
  } catch (e) {
    console.error('Erreur récupération membres:', e);
    return [];
  }
}

/* ---------- Synchronisation ---------- */

async function syncMembers() {
  const supabase = initSupabase();
  if (!supabase) {
    return false;
  }

  try {
    const { data, error } = await supabase
      .from('montevia_team_members')
      .select('*')
      .order('display_name');

    if (error) {
      console.error('Erreur synchronisation:', error);
      return false;
    }

    if (!data || data.length === 0) {
      console.log('Aucun membre synchronisé');
      return false;
    }

    console.log('Membres synchronisés:', data.length);
    return true;
  } catch (e) {
    console.error('Erreur synchronisation:', e);
    return false;
  }
}

/* ---------- Affichage des membres ---------- */

var members = [];

async function displayMembers() {
  members = await fetchMembers();
  renderRoster();
}

/* ---------- Raster de membres ---------- */

function renderRoster() {
  var container = document.getElementById('roster');
  if (!container) return;

  container.innerHTML = '';

  members.forEach((member, index) => {
    var row = node('tr', 'member__row');
    row.dataset.memberId = member.id;

    var cell = node('td', 'member__cell');

    var avatar = node('div', 'member__avatar');
    avatar.style.width = '64px';
    avatar.style.height = '64px';
    avatar.style.borderRadius = '50%';
    avatar.style.overflow = 'hidden';
    avatar.style.border = '2px solid #35d39a';

    var img = node('img', 'member__avatar__img');
    img.src = member.avatar_url || 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#35d39a" d="M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path fill="#35d39a" d="M12 12a4 4 0 0 1 4 4v4h-8v-4a4 4 0 0 1 4-4Z"/><path fill="#35d39a" d="M5 8v8l6 4 6-4V8H5Z"/></svg>');
    img.alt = member.display_name || 'Membre';
    avatar.append(img);

    cell.append(avatar);

    var identity = node('div', 'member__identity');
    var displayName = member.display_name || 'Membre';
    identity.append(node('h3', '', displayName));

    if (member.username) {
      var username = String(member.username).replace(/^@/, '');
      identity.append(node('p', '', '@' + username));
    }

    if (member.role_label) {
      identity.append(node('p', '', 'Rôle : ' + member.role_label));
    }

    if (POLES[member.pole]) {
      identity.append(node('p', '', 'Affiliation : ' + POLES[member.pole]));
    }

    if (member.status) {
      identity.append(node('p', '', 'Statut : ' + member.status));
    }

    if (member.is_moderator) {
      identity.append(node('p', '', 'Modérateur'));
    }

    if (member.is_admin) {
      identity.append(node('p', '', 'Administrateur'));
    }

    cell.append(identity);

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
      var discordUsername = String(member.discord_username).replace(/^@/, '');
      links.append(node('span', 'member__discord', 'Discord · ' + discordUsername));
    }

    if (links.childElementCount) {
      cell.append(links);
    }

    container.append(row);
  });
}

/* ---------- Fonction utilitaire ---------- */

function safeHttps(url) {
  if (!url) return null;
  var protocol = url.split('://')[0];
  return (protocol === 'http' || protocol === '') ? 'https://' + url : url;
}

/* ---------- Carte d'organisation : profils en rotation ---------- */

function shuffle(list) {
  var array = list.slice();
  for (var i = array.length - 1; i > 0; i -= 1) {
    var j = Math.floor(Math.random() * (i + 1));
    var value = array[i];
    array[i] = array[j];
    array[j] = value;
  }
  return array;
}

function renderShowcase() {
  var container = document.getElementById('showcase');
  if (!container) return;

  var membersToShow = members.length > 0 ? shuffle(members) : [];
  var member = membersToShow.length > 0 ? membersToShow[0] : null;

  if (!member) {
    container.innerHTML = '<p>Aucun membre disponible</p>';
    return;
  }

  var article = node('article', 'member');
  article.style.animationDelay = Math.min(8) * 45 + 'ms';

  var container = node('div', 'member__container');
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.gap = '16px';

  var head = node('div', 'member__head');
  head.append(avatar(member));
  article.append(head);

  var identity = node('div', 'member__identity');
  identity.append(node('h3', '', member.display_name || 'Membre'));
  if (member.username) {
    identity.append(node('p', '', '@' + String(member.username).replace(/^@/, '')));
  }
  if (member.role_label) {
    identity.append(node('p', '', 'Rôle : ' + member.role_label));
  }
  if (POLES[member.pole]) {
    identity.append(node('p', '', 'Affiliation : ' + POLES[member.pole]));
  }
  if (member.status) {
    identity.append(node('p', '', 'Statut : ' + member.status));
  }
  if (member.is_moderator) {
    identity.append(node('p', '', 'Modérateur'));
  }
  if (member.is_admin) {
    identity.append(node('p', '', 'Administrateur'));
  }
  article.append(identity);

  if (member.bio) {
    article.append(node('p', 'member__bio', member.bio));
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
  if (links.childElementCount) {
    article.append(links);
  }

  container.append(article);
  container.style.maxWidth = '350px';
  container.style.margin = '0 auto';
  container.style.padding = '20px';
  container.style.backgroundColor = '#1a1a1a';
  container.style.borderRadius = '12px';
  container.style.boxShadow = '0 4px 20px rgba(53, 211, 154, 0.2)';

  container.querySelector('.member__container').style.borderRadius = '16px';

  container.querySelector('.member__container').style.border = 'none';
  container.querySelector('.member__identity h3').style.fontWeight = '600';
  container.querySelector('.member__identity p').style.marginBottom = '4px';
  container.querySelector('.member__identity p:last-child').style.marginBottom = '0';

  container.querySelector('.member__bio').style.fontSize = '14px';
  container.querySelector('.member__bio').style.lineHeight = '1.6';
  container.querySelector('.member__bio').style.marginTop = '12px';
  container.querySelector('.member__links').style.display = 'flex';
  container.querySelector('.member__links').style.gap = '12px';
  container.querySelector('.member__links a').style.color = '#35d39a';
  container.querySelector('.member__links span').style.color = '#888';

  container.querySelector('.member__avatar').style.borderRadius = '50%';
  container.querySelector('.member__avatar img').style.borderRadius = '50%';
  container.querySelector('.member__avatar img').style.objectFit = 'cover';
  container.querySelector('.member__avatar img').style.width = '100%';
  container.querySelector('.member__avatar img').style.height = '100%';

  container.querySelector('.member__identity').style.flex = '1';
  container.querySelector('.member__links').style.flex = '0 0 auto';
}

/* ---------- Rotation automatique ---------- */

var showMemberTimeout;

function rotateShowcase() {
  renderShowcase();
  showMemberTimeout = setTimeout(rotateShowcase, 6000);
}

/* ---------- Initialisation ---------- */

async function init() {
  await displayMembers();
  renderRoster();
  rotateShowcase();

  window.addEventListener('resize', function() {
    renderShowcase();
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      clearTimeout(showMemberTimeout);
      renderShowcase();
    }
  });
}

// Exposer les membres globalement pour que rotateShowcase puisse les utiliser
window.teamMembers = members;

window.addEventListener('DOMContentLoaded', init);

/* ---------- Exportation ---------- */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fetchMembers,
    syncMembers,
    displayMembers,
    renderRoster,
    renderShowcase
  };
}
