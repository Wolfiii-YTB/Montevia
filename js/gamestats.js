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
      var proxy = 'https://api.allorigins.win/get?url=' + encodeURIComponent(GAMES_URL);
      var res = await fetch(proxy);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var json = await res.json();
      var data = JSON.parse(json.contents);
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

  async function update() {
    var games = await fetchGames();
    var votes = await fetchVotes();

    var visitsEl = document.getElementById('statVisits');
    var playingEl = document.getElementById('statPlaying');
    var likesEl = document.getElementById('statLikes');
    var favEl = document.getElementById('statFavorites');

    if (games) {
      if (visitsEl) visitsEl.textContent = formatNumber(games.visits);
      if (playingEl) playingEl.textContent = formatNumber(games.playing);
      if (favEl) favEl.textContent = formatNumber(games.favorites);
    }
    if (votes && likesEl) {
      likesEl.textContent = formatNumber(votes.likes);
    }
  }

  function start() {
    if (!document.getElementById('gameStats')) return;
    update();
    setInterval(update, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();