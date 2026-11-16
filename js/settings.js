/* Montevia — paramètres du site (liens des boutons) */

(function () {
  'use strict';

  var FALLBACK_CONFIG = {
    url: 'https://bylwvlxxvgumvqgpwgod.supabase.co',
    anonKey: 'sb_publishable_T3XYbDWXV5VaC8WQj3CZOQ_LmB7CTwv'
  };

  function getConfig() {
    return window.MONTEVIA_SUPABASE || FALLBACK_CONFIG;
  }

  function safeHttps(value) {
    try {
      var url = new URL(String(value || ''));
      if (url.protocol !== 'https:') return '';
      return url.href;
    } catch (e) {
      return '';
    }
  }

  function applySettings(settings) {
    var links = document.querySelectorAll('[data-setting]');
    links.forEach(function (el) {
      var key = el.getAttribute('data-setting');
      var value = safeHttps(settings[key]);
      if (value) {
        el.setAttribute('href', value);
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
      var config = getConfig();
      if (!config || !config.url || !config.anonKey) { setTimeout(load, 500); return; }
      var client = window.supabase.createClient(config.url, config.anonKey);
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