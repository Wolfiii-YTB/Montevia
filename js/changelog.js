/* Montevia — changelog */

(function () {
  'use strict';

  var SUPABASE_URL = 'https://bylwvlxxvgumvqgpwgod.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_T3XYbDWXV5VaC8WQj3CZOQ_LmB7CTwv';

  async function load() {
    var container = document.getElementById('changelogList');
    if (!container) return;

    try {
      if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        setTimeout(load, 500);
        return;
      }
      var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      var { data, error } = await client.from('montevia_changelog').select('*').eq('published', true).order('created_at', { ascending: false }).limit(10);
      if (error) throw error;

      if (!data || !data.length) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-3);">Aucune mise à jour pour le moment.</p>';
        return;
      }

      container.innerHTML = '';
      data.forEach(function (entry) {
        var card = document.createElement('div');
        card.className = 'changelog-entry';
        card.innerHTML = '<div class="changelog-entry__head">' +
          '<span class="changelog-entry__version">v' + escapeHtml(entry.version) + '</span>' +
          '<span class="changelog-entry__date">' + new Date(entry.created_at).toLocaleDateString('fr-FR') + '</span>' +
        '</div>' +
        '<h3 class="changelog-entry__title">' + escapeHtml(entry.title) + '</h3>' +
        '<p class="changelog-entry__content">' + escapeHtml(entry.content) + '</p>';
        container.append(card);
      });
    } catch (e) {
      console.warn('changelog: load failed', e);
    }
  }

  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();