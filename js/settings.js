/* Montevia — paramètres du site (liens des boutons) */

(function () {
  'use strict';

  var SUPABASE_URL = 'https://bylwvlxxvgumvqgpwgod.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_T3XYbDWXV5VaC8WQj3CZOQ_LmB7CTwv';

  function applySettings(settings) {
    var links = document.querySelectorAll('[data-setting]');
    links.forEach(function (el) {
      var key = el.getAttribute('data-setting');
      if (settings[key]) {
        el.setAttribute('href', settings[key]);
      }
    });
  }

  async function load() {
    try {
      // Attendre que Supabase soit prêt
      if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        // retry shortly
        setTimeout(load, 500);
        return;
      }
      var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      var result = await client.from('montevia_site_settings').select('*');
      if (result.error) return;
      var settings = {};
      (result.data || []).forEach(function (row) {
        settings[row.key] = row.value;
      });
      applySettings(settings);
    } catch (e) {
      console.warn('settings: load failed', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();