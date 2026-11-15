/* Montevia — statistiques du jeu (Roblox) */

(function () {
  'use strict';

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

  async function fetchStats() {
    try {
      var url = '/data/stats.json?t=' + Date.now();
      var res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      return data;
    } catch (e) {
      console.warn('gamestats: fetch failed', e);
      return null;
    }
  }

  async function update() {
    var data = await fetchStats();
    if (!data) return;
    saveCache(data);
    applyData(data);
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