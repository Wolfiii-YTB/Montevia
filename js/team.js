/* Montevia — chargement public des membres de l'équipe. */

(function () {
  'use strict';

  var config = window.MONTEVIA_SUPABASE;
  var section = document.getElementById('membres');
  var roster = document.getElementById('roster');

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

  function avatar(member) {
    var wrap = node('div', 'member__avatar');
    var url = safeHttps(member.avatar_url);

    if (url) {
      var img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.width = 56;
      img.height = 56;
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

  function card(member, index) {
    var article = node('article', 'member');
    article.style.animationDelay = Math.min(index, 8) * 45 + 'ms';

    var head = node('div', 'member__head');
    head.append(avatar(member));

    var identity = node('div', 'member__identity');
    identity.append(node('h3', '', member.display_name || 'Membre'));
    if (member.username) {
      identity.append(node('p', '', '@' + String(member.username).replace(/^@/, '')));
    }
    head.append(identity);
    article.append(head);

    var tags = node('div', 'member__tags');
    if (member.role_label) tags.append(node('span', 'member__role', member.role_label));
    if (POLES[member.pole]) tags.append(node('span', 'member__pole', POLES[member.pole]));
    if (tags.childElementCount) article.append(tags);

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
  }

  load().catch(function (error) {
    // La section reste masquée tant que la table n'est pas installée
    // ou qu'aucun membre n'est publié.
    console.warn('[Montevia] Équipe indisponible :', error.message);
  });
})();
