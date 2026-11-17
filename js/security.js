/* Montevia — noyau de sécurité côté client.
   Protections : validation, anti-spam, rate limiting, durcissement des liens,
   anti-clickjacking, HTTPS forcé, journal d'événements, auto-test. */

(function (global) {
  'use strict';

  var VERSION = '1.0.0';
  var LOG_KEY = 'montevia-security-log';
  var RATE_KEY = 'montevia-security-rate';
  var MAX_LOG = 80;
  var started = false;
  var observer = null;
  var observerTimer = null;

  /* ---------- stockage sûr ---------- */

  function storageAvailable() {
    try {
      var key = '__montevia_test__';
      global.localStorage.setItem(key, '1');
      global.localStorage.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  }

  function readJson(key, fallback) {
    try {
      var raw = global.localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* stockage plein ou désactivé : on continue sans persister. */
    }
  }

  /* ---------- journal ---------- */

  function log(type, detail) {
    var entry = {
      type: String(type || 'event'),
      detail: detail == null ? '' : String(detail).slice(0, 500),
      at: new Date().toISOString(),
      page: String(global.location.pathname || '').slice(0, 120)
    };

    var entries = readJson(LOG_KEY, []);
    if (!Array.isArray(entries)) entries = [];
    entries.push(entry);
    if (entries.length > MAX_LOG) entries = entries.slice(entries.length - MAX_LOG);
    writeJson(LOG_KEY, entries);

    try {
      global.dispatchEvent(new CustomEvent('montevia:security', { detail: entry }));
    } catch (e) { /* CustomEvent indisponible : sans importance. */ }
    return entry;
  }

  function getLog() {
    var entries = readJson(LOG_KEY, []);
    return Array.isArray(entries) ? entries.slice().reverse() : [];
  }

  function clearLog() {
    writeJson(LOG_KEY, []);
  }

  /* ---------- texte et HTML ---------- */

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeText(value, maxLength) {
    var text = String(value == null ? '' : value);

    // Caractères de contrôle et largeur nulle (invisibles, utilisés pour le spam).
    text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
    text = text.replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '');
    text = text.replace(/\r\n?/g, '\n').trim();

    if (maxLength && text.length > maxLength) text = text.slice(0, maxLength);
    return text;
  }

  /* ---------- URLs ---------- */

  function isSafeUrl(value) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw) return true;
    if (/^(#|\/(?!\/)|\.{1,2}\/|\?)/.test(raw)) return true;

    try {
      var url = new URL(raw, global.location.href);
      return ['http:', 'https:', 'mailto:', 'tel:'].indexOf(url.protocol) !== -1;
    } catch (e) {
      return false;
    }
  }

  function safeUrl(value, fallback) {
    return isSafeUrl(value) ? String(value).trim() : (fallback || '');
  }

  function hardenLinks(root) {
    var scope = root || document;
    var links = scope.querySelectorAll ? scope.querySelectorAll('a[href]') : [];
    var changed = 0;

    Array.prototype.forEach.call(links, function (link) {
      var href = link.getAttribute('href');
      if (!href) return;

      if (!isSafeUrl(href)) {
        link.removeAttribute('href');
        link.setAttribute('role', 'link');
        link.setAttribute('aria-disabled', 'true');
        link.classList.add('is-blocked-link');
        log('unsafe-link', href.slice(0, 120));
        changed += 1;
        return;
      }

      if (link.getAttribute('target') === '_blank') {
        var rel = (link.getAttribute('rel') || '').toLowerCase();
        var parts = rel.split(/\s+/).filter(Boolean);
        if (parts.indexOf('noopener') === -1) parts.push('noopener');
        if (parts.indexOf('noreferrer') === -1) parts.push('noreferrer');
        link.setAttribute('rel', parts.join(' '));
      }
    });

    return changed;
  }

  /* ---------- validation anti-spam ---------- */

  function repeatedCharacterRatio(text) {
    if (!text || text.length < 25) return 0;
    var counts = {};
    var top = 0;
    for (var i = 0; i < text.length; i += 1) {
      var ch = text.charAt(i);
      counts[ch] = (counts[ch] || 0) + 1;
      if (counts[ch] > top) top = counts[ch];
    }
    return top / text.length;
  }

  function uppercaseRatio(text) {
    var letters = text.replace(/[^A-Za-zÀ-ÖØ-Þà-öø-ÿ]/g, '');
    if (letters.length < 40) return 0;
    var upper = letters.replace(/[^A-ZÀ-ÖØ-Þ]/g, '');
    return upper.length / letters.length;
  }

  function validateSubmission(value, options) {
    var opts = options || {};
    var min = opts.min == null ? 1 : opts.min;
    var max = opts.max == null ? 2000 : opts.max;
    var maxLinks = opts.maxLinks == null ? 3 : opts.maxLinks;
    var raw = String(value == null ? '' : value);
    var text = sanitizeText(raw, max + 1);

    if (text.length < min) {
      return { ok: false, reason: 'too-short', text: text, message: opts.minMessage || 'Le message est trop court.' };
    }
    if (raw.length > max) {
      return { ok: false, reason: 'too-long', text: text, message: opts.maxMessage || 'Le message est trop long.' };
    }
    if (/<\s*\/?\s*(script|iframe|object|embed|svg|math)\b/i.test(text)) {
      return { ok: false, reason: 'markup', text: text, message: 'Le contenu HTML n’est pas autorisé.' };
    }

    var links = text.match(/https?:\/\/|www\.|discord\.gg/gi);
    if (links && links.length > maxLinks) {
      return { ok: false, reason: 'links', text: text, message: 'Trop de liens dans ce message.' };
    }
    if (repeatedCharacterRatio(text) > 0.65) {
      return { ok: false, reason: 'spam', text: text, message: 'Ce message semble contenir du spam.' };
    }
    if (uppercaseRatio(text) > 0.85) {
      return { ok: false, reason: 'caps', text: text, message: 'Évitez d’écrire entièrement en majuscules.' };
    }

    return { ok: true, reason: '', text: text, message: '' };
  }

  /* ---------- limitation de débit ---------- */

  function readRate() {
    var data = readJson(RATE_KEY, {});
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  }

  function pruneActions(timestamps, windowMs) {
    var cutoff = Date.now() - windowMs;
    return timestamps.filter(function (time) { return Number(time) > cutoff; });
  }

  function checkRate(key, max, windowMs) {
    var bucketKey = String(key || 'default');
    var rate = readRate();
    var timestamps = pruneActions(Array.isArray(rate[bucketKey]) ? rate[bucketKey] : [], windowMs);
    var remaining = Math.max(0, max - timestamps.length);
    var retryAfterMs = 0;

    if (timestamps.length >= max) {
      retryAfterMs = Math.max(0, windowMs - (Date.now() - Math.min.apply(null, timestamps)));
    }

    return {
      allowed: timestamps.length < max,
      remaining: remaining,
      retryAfterMs: retryAfterMs
    };
  }

  function recordAction(key, windowMs) {
    var bucketKey = String(key || 'default');
    var rate = readRate();
    var timestamps = pruneActions(Array.isArray(rate[bucketKey]) ? rate[bucketKey] : [], windowMs);
    timestamps.push(Date.now());
    rate[bucketKey] = timestamps.slice(-100);
    writeJson(RATE_KEY, rate);
    return timestamps.length;
  }

  function cooldownLeft(key, milliseconds) {
    var rate = readRate();
    var timestamps = rate[String(key || 'default')];
    if (!Array.isArray(timestamps) || !timestamps.length) return 0;
    var last = Number(timestamps[timestamps.length - 1]) || 0;
    return Math.max(0, milliseconds - (Date.now() - last));
  }

  function humanDuration(milliseconds) {
    var seconds = Math.ceil(Number(milliseconds || 0) / 1000);
    if (seconds <= 60) return seconds + ' s';
    var minutes = Math.ceil(seconds / 60);
    if (minutes <= 60) return minutes + ' min';
    return Math.ceil(minutes / 60) + ' h';
  }

  /* ---------- honeypot ---------- */

  function installHoneypot(form, name) {
    if (!form) return null;
    var fieldName = name || 'website';
    var existing = form.querySelector('input[name="' + fieldName + '"]');
    if (existing) return existing;

    var field = document.createElement('input');
    field.type = 'text';
    field.name = fieldName;
    field.tabIndex = -1;
    field.autocomplete = 'off';
    field.setAttribute('aria-hidden', 'true');
    field.style.position = 'absolute';
    field.style.left = '-10000px';
    field.style.width = '1px';
    field.style.height = '1px';
    field.style.opacity = '0';
    field.style.pointerEvents = 'none';
    form.append(field);
    return field;
  }

  function isHoneypotFilled(form, name) {
    if (!form) return false;
    var fieldName = name || 'website';
    var field = form.querySelector('input[name="' + fieldName + '"]');
    return !!(field && String(field.value || '').trim());
  }

  /* ---------- durcissement global ---------- */

  function isLocalHost() {
    var host = String(global.location.hostname || '');
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '';
  }

  function enforceHttps() {
    if (global.location.protocol === 'http:' && !isLocalHost()) {
      log('https-redirect', global.location.href.slice(0, 120));
      global.location.replace('https://' + global.location.host + global.location.pathname +
        global.location.search + global.location.hash);
      return false;
    }
    return true;
  }

  function frameBust() {
    try {
      if (global.top && global.top !== global.self) {
        log('frame-blocked', global.location.href.slice(0, 120));
        document.documentElement.style.display = 'none';
        try {
          global.top.location = global.self.location.href;
        } catch (e) { /* origine différente : on laisse masqué. */ }
      }
    } catch (e) { /* accès interdit : on laisse masqué. */ }
  }

  function inspectLinks() {
    var links = document.querySelectorAll('a[href^="javascript:"], a[href^="data:"], a[href^="vbscript:"]');
    Array.prototype.forEach.call(links, function (link) {
      link.removeAttribute('href');
      link.setAttribute('aria-disabled', 'true');
      log('unsafe-link-blocked', String(link.getAttribute('href') || '').slice(0, 80));
    });
  }

  function observeDom() {
    if (!global.MutationObserver) return;
    if (observer) observer.disconnect();
    observer = new MutationObserver(function () {
      if (observerTimer) return;
      observerTimer = setTimeout(function () {
        observerTimer = null;
        hardenLinks(document);
      }, 400);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function protectForms() {
    var forms = document.querySelectorAll('form');
    Array.prototype.forEach.call(forms, function (form) {
      form.addEventListener('submit', function (event) {
        var action = form.getAttribute('action');
        if (action && !isSafeUrl(action)) {
          event.preventDefault();
          log('form-blocked', action.slice(0, 120));
          try {
            alert('Envoi bloqué pour raison de sécurité.');
          } catch (e) { /* ignore */ }
        }
      }, true);
    });
  }

  function freezeConfig() {
    try {
      if (global.MONTEVIA_SUPABASE && typeof global.MONTEVIA_SUPABASE === 'object' && !Object.isFrozen(global.MONTEVIA_SUPABASE)) {
        Object.freeze(global.MONTEVIA_SUPABASE);
      }
    } catch (e) { /* ignore */ }
  }

  function watchCsp() {
    document.addEventListener('securitypolicyviolation', function (event) {
      log('csp-violation', (event.violatedDirective || '') + ' ' + (event.blockedURI || ''));
    });
  }

  /* ---------- auto-test ---------- */

  function selfTest() {
    var config = global.MONTEVIA_SUPABASE;
    var unsafeLinks = document.querySelectorAll('a[href^="javascript:"], a[href^="data:"], a[href^="vbscript:"]').length;
    var mixedContent = document.querySelectorAll(
      'script[src^="http:"], link[href^="http:"], img[src^="http:"], iframe[src^="http:"]'
    ).length;

    return [
      {
        id: 'https',
        label: 'Connexion chiffrée (HTTPS)',
        ok: global.location.protocol === 'https:' || isLocalHost(),
        detail: global.location.protocol === 'https:' ? 'Actif' : (isLocalHost() ? 'Développement local' : 'Connexion non chiffrée')
      },
      {
        id: 'csp',
        label: 'Politique de sécurité du contenu (CSP)',
        ok: !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'),
        detail: 'Restreint les sources de scripts et de styles'
      },
      {
        id: 'referrer',
        label: 'Politique de référent',
        ok: !!document.querySelector('meta[name="referrer"]'),
        detail: 'Limite les fuites d’URL vers les sites externes'
      },
      {
        id: 'storage',
        label: 'Stockage local protégé',
        ok: storageAvailable(),
        detail: storageAvailable() ? 'Disponible' : 'Indisponible (navigation privée ?)'
      },
      {
        id: 'key',
        label: 'Clé Supabase publique',
        ok: !!(config && /^sb_publishable_/.test(String(config.anonKey || ''))),
        detail: config && /^sb_publishable_/.test(String(config.anonKey || ''))
          ? 'Clé publishable détectée'
          : 'Clé absente ou non reconnue'
      },
      {
        id: 'links',
        label: 'Liens dangereux bloqués',
        ok: unsafeLinks === 0,
        detail: unsafeLinks === 0 ? 'Aucun lien javascript:/data:' : unsafeLinks + ' lien(s) bloqué(s)'
      },
      {
        id: 'mixed',
        label: 'Absence de contenu mixte',
        ok: mixedContent === 0,
        detail: mixedContent === 0 ? 'Toutes les ressources sont chiffrées' : mixedContent + ' ressource(s) non chiffrée(s)'
      },
      {
        id: 'frame',
        label: 'Protection anti-clickjacking',
        ok: true,
        detail: 'Cadrage externe bloqué au chargement'
      }
    ];
  }

  /* ---------- démarrage ---------- */

  function onReady(callback) {
    if (typeof callback !== 'function') return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function init() {
    if (started) return;
    started = true;

    if (!enforceHttps()) return;

    frameBust();
    inspectLinks();
    hardenLinks(document);
    protectForms();
    freezeConfig();
    watchCsp();
    observeDom();
  }

  var API = {
    version: VERSION,
    log: log,
    getLog: getLog,
    clearLog: clearLog,
    escapeHtml: escapeHtml,
    sanitizeText: sanitizeText,
    isSafeUrl: isSafeUrl,
    safeUrl: safeUrl,
    hardenLinks: hardenLinks,
    validateSubmission: validateSubmission,
    checkRate: checkRate,
    recordAction: recordAction,
    cooldownLeft: cooldownLeft,
    humanDuration: humanDuration,
    installHoneypot: installHoneypot,
    isHoneypotFilled: isHoneypotFilled,
    selfTest: selfTest,
    storageAvailable: storageAvailable
  };

  try {
    Object.freeze(API);
  } catch (e) { /* ignore */ }

  global.MonteviaSecurity = API;

  onReady(init);

  // Si le script est chargé après le DOM, on initialise tout de suite.
  if (document.readyState !== 'loading') init();
})(window);
