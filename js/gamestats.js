/* Montevia — statistiques du jeu (Roblox) */

(function () {
  'use strict';

  var UNIVERSE_ID = '10752535690';
  var GAMES_URL = 'https://games.roblox.com/v1/games?universeIds=' + UNIVERSE_ID;
  var CACHE_KEY = 'montevia-gamestats';

  function formatNumber(n) {
    if (typeof n !== 'number' || isNaN(n)) return '—';
    return new Intl.NumberFormat('fr-FR').format(n);
  }

  function loadCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function applyData(data) {
    var visitsEl = document.getElementById('statVisits');
    var playingEl = document.getElementById('statPlaying');
    var likesEl = document.getElementById('statLikes');
    var favEl = document.getElementById('statFavorites');

    if (data.visits != null && visitsEl) visitsEl.textContent = formatNumber(data.visits);
    if (data.playing != null && playingEl) playingEl.textContent = formatNumber(data.playing);
    if (data.favorites != null && favEl) favEl.textContent = formatNumber(data.favorites);
    if (data.likes != null && likesEl) likesEl.textContent = formatNumber(data.likes);
  }

  async function fetchWithTimeout(url, ms, opts) {
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, ms);
    try {
      var fetchOpts = Object.assign({ signal: controller.signal }, opts || {});
      var res = await fetch(url, fetchOpts);
      clearTimeout(timeout);
      return res;
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  }

  // Essayer le proxy live (fonctionne en localhost)
  async function fetchLive() {
    try {
      var proxy = 'https://proxy.corsfix.com/?' + GAMES_URL;
      var res = await fetchWithTimeout(proxy, 3000);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      var game = data && data.data && data.data[0];
      if (!game) throw new Error('no data');
      return {
        visits: game.visits,
        playing: game.playing,
        favorites: game.favoritedCount,
        likes: null
      };
    } catch (e) {
      return null;
    }
  }

  // Fallback : fichier JSON mis à jour par GitHub Action
  async function fetchJson() {
    try {
      var res = await fetchWithTimeout('/data/stats.json', 3000, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  async function update() {
    // 1. Essayer le live
    var live = await fetchLive();
    if (live) {
      // Récupérer les votes si possible
      try {
        var vRes = await fetchWithTimeout('https://proxy.corsfix.com/?https://games.roblox.com/v1/games/votes?universeIds=' + UNIVERSE_ID, 3000);
        if (vRes.ok) {
          var vData = await vRes.json();
          live.likes = vData?.data?.[0]?.upVotes ?? live.likes;
        }
      } catch (e) {}
      saveCache(live);
      applyData(live);
      return;
    }

    // 2. Sinon fallback JSON
    var json = await fetchJson();
    if (json) {
      saveCache(json);
      applyData(json);
    }
  }

  function start() {
    if (!document.getElementById('gameStats')) return;
    var cached = loadCache();
    if (cached) applyData(cached);
    update();
    setInterval(update, 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();