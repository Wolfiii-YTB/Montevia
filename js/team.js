/* Montevia — chargement public des membres de l'équipe. */

(function () {
  'use strict';

  var config = window.MONTEVIA_SUPABASE;
  var section = document.getElementById('membres');
  var roster = document.getElementById('roster');
  var orgCard = document.getElementById('orgCard');
  var orgList = document.getElementById('orgList');
  var orgBadge = document.getElementById('orgBadge');
  var orgSubtitle = document.getElementById('orgSubtitle');

  if (!config || !section || !roster) return;
  if (!config.url || !config.anonKey) return;

  var table = config.teamTable || 'montevia_team_members';
  var POLES = {
    direction: 'Direction',
    developpement: 'Développement',
    moderation: 'Modération',
    support: 'Support & animation',
    studio: 'Studio',
    autre: 'Autre'
  };

  var SHOWCASE_SIZE = 4;
  var SHOWCASE_DELAY = 6000;
  var showcase = {
    members: [],
    deck: [],
    index: 0,
    ticks: 0,
    timer: 0,
    paused: false,
    started: false
  };

  function safeHttps(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      var url = new URL(value.trim());
      return url.protocol === 'https:' ? url.href : '';
    } catch (error) {
      return '';
    }
  }

  function initials(name) {
    var words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return 'M';
    return words.slice(0, 2).map(function (word) {
      return Array.from(word)[0] || '';
    }).join('').toUpperCase();
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
      wrap.classList.add('is-fallback');
    }

    return wrap;
  }

  function avatar(member) {
    return avatarNode(member, 'member__avatar');
  }

  function card(member, index) {
    var article = node('article', 'member');
    article.style.animationDelay = Math.min(index, 8) * 45 + 'ms';

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

    if (member.bio) article.append(node('p', 'member__bio', member.bio));

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
    if (links.childElementCount) article.append(links);

    return article;
  }

  /* ---------- carte d'organisation : profils en rotation ---------- */

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

  function showcaseRows() {
    var count = Math.min(SHOWCASE_SIZE, showcase.deck.length);
    var rows = [];

    for (var i = 0; i < count; i += 1) {
      rows.push(showcase.deck[(showcase.index + i) % showcase.deck.length]);
    }

    return rows;
  }

  function orgRow(member) {
    var item = node('li', 'org-card__member-item');
    var link = document.createElement('a');
    link.className = 'org-card__member';
    link.href = '#membres';
    link.setAttribute('aria-label', 'Voir ' + (member.display_name || 'ce membre') + ' dans l’équipe');

    link.append(avatarNode(member, 'org-card__avatar'));

    var label = node('span', 'org-card__label');
    label.append(node('strong', '', member.display_name || 'Membre'));
    label.append(node('small', '', member.role_label || POLES[member.pole] || 'Membre'));
    link.append(label);

    var arrow = node('span', 'org-card__arrow', '→');
    arrow.setAttribute('aria-hidden', 'true');
    link.append(arrow);

    item.append(link);
    return item;
  }

  function paintShowcase() {
    if (!orgList || !orgCard) return;

    var member = showcase.deck[showcase.index];
    var fragment = document.createDocumentFragment();
    fragment.append(card(member, showcase.index));

    orgList.replaceChildren(fragment);
    orgList.classList.remove('is-swapping');
  }

  function renderShowcase(animate) {
    if (!orgList) return;

    if (animate) {
      orgList.classList.add('is-swapping');
      window.setTimeout(paintShowcase, 170);
    } else {
      paintShowcase();
    }
  }

  function updateShowcaseMeta() {
    var total = showcase.members.length;

    if (orgBadge) {
      orgBadge.textContent = total + (total > 1 ? ' membres' : ' membre');
    }
    if (orgSubtitle) {
      orgSubtitle.textContent = 'Les visages de l’équipe';
    }
  }

  function tickShowcase() {
    if (showcase.paused || document.hidden || showcase.deck.length < 2) return;

    showcase.index = (showcase.index + 1) % showcase.deck.length;
    showcase.ticks += 1;

    if (showcase.ticks >= showcase.deck.length) {
      showcase.deck = shuffle(showcase.members);
      showcase.index = 0;
      showcase.ticks = 0;
    }

    renderShowcase(true);
  }

  function startShowcase(members) {
    if (!orgCard || !orgList || !members.length) return;

    showcase.members = members.slice();
    showcase.deck = shuffle(members);
    showcase.index = 0;
    showcase.ticks = 0;

    updateShowcaseMeta();
    renderShowcase(false);

    if (showcase.started || members.length < 2) return;
    showcase.started = true;

    var reduceMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    showcase.timer = window.setInterval(tickShowcase, SHOWCASE_DELAY);

    orgCard.addEventListener('mouseenter', function () {
      showcase.paused = true;
    });
    orgCard.addEventListener('mouseleave', function () {
      showcase.paused = false;
    });
    orgCard.addEventListener('focusin', function () {
      showcase.paused = true;
    });
    orgCard.addEventListener('focusout', function (event) {
      if (!orgCard.contains(event.relatedTarget)) showcase.paused = false;
    });
  }

  /* ---------- chargement ---------- */

  async function load() {
    var params = new URLSearchParams({
      select: 'id,display_name,username,role_label,pole,bio,avatar_url,roblox_url,discord_username,sort_order',
      published: 'eq.true',
      order: 'sort_order.asc,display_name.asc'
    });

    var response = await fetch(
      config.url.replace(/\/$/, '') + '/rest/v1/' + encodeURIComponent(table) + '?' + params.toString(),
      {
        headers: {
          apikey: config.anonKey,
          Authorization: 'Bearer ' + config.anonKey
        },
        cache: 'no-store'
      }
    );

    if (!response.ok) throw new Error('HTTP ' + response.status);

    var members = await response.json();
    if (!Array.isArray(members) || !members.length) return;

    var fragment = document.createDocumentFragment();
    members.forEach(function (member, index) {
      fragment.append(card(member, index));
    });

    roster.replaceChildren(fragment);
    section.hidden = false;
    startShowcase(members);
  }

  load().catch(function (error) {
    // La carte garde ses pôles et la section reste masquée tant que la
    // table n'est pas installée ou qu'aucun membre n'est publié.
    console.warn('[Montevia] Équipe indisponible :', error.message);
  });
})();
