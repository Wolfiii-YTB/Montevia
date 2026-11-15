/* Montevia — statistiques du jeu en temps réel (Roblox) */

(function () {
  'use strict';

  var UNIVERSE_ID = '10752535690';
  var GAMES_URL = 'https://games.roblox.com/v1/games?universeIds=' + UNIVERSE_ID;
  var VOTES_URL = 'https://games.roblox.com/v1/games/votes?universeIds=' + UNIVERSE_ID;

  function formatNumber(n) {
    if (typeof n !== 'number' || isNaN(n)) return '—';
    return new Intl.NumberFormat('fr-FR').format(n);
  }

  async function fetchGames() {
    try {
      var proxy = 'https://proxy.corsfix.com/?' + GAMES_URL;
      var res = await fetch(proxy);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      var game = data && data.data && data.data[0];
      if (!game) throw new Error('no data');
      return {
        visits: game.visits,
        playing: game.playing,
        favorites: game.favoritedCount
      };
    } catch (e) {
      console.warn('gamestats: games fetch failed', e);
      return null;
    }
  }

  async function fetchVotes() {
    try {
      var proxy = 'https://proxy.corsfix.com/?' + VOTES_URL;
      var res = await fetch(proxy);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      var vote = data && data.data && data.data[0];
      if (!vote) throw new Error('no data');
      return { likes: vote.upVotes };
    } catch (e) {
      console.warn('gamestats: votes fetch failed', e);
      return null;
    }
  }

  var CACHE_KEY = 'montevia-gamestats';

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

  async function update() {
    var games = await fetchGames();
    var votes = await fetchVotes();

    var cached = loadCache() || {};
    if (games) {
      cached.visits = games.visits;
      cached.playing = games.playing;
      cached.favorites = games.favorites;
    }
    if (votes) {
      cached.likes = votes.likes;
    }
    saveCache(cached);
    applyData(cached);
  }

  function start() {
    if (!document.getElementById('gameStats')) return;
    var cached = loadCache();
    if (cached) applyData(cached);
    update();
    setInterval(update, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();