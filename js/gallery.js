/* Montevia — carrousel de la galerie */

(function () {
  'use strict';

  var FALLBACK_CONFIG = {
    url: 'https://bylwvlxxvgumvqgpwgod.supabase.co',
    anonKey: 'sb_publishable_T3XYbDWXV5VaC8WQj3CZOQ_LmB7CTwv'
  };

  var AUTOPLAY_MS = 5000;
  var SWIPE_MIN = 40;

  var images = [];
  var current = 0;
  var timer = null;
  var paused = false;
  var track = null;
  var dots = [];
  var slides = [];
  var live = null;

  function getConfig() {
    return window.MONTEVIA_SUPABASE || FALLBACK_CONFIG;
  }

  function node(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function render() {
    var container = document.getElementById('carousel');
    if (!container) return;
    container.innerHTML = '';

    stopAuto();
    paused = false;
    dots = [];
    track = null;
    slides = [];

    if (!images.length) {
      container.removeAttribute('role');
      container.removeAttribute('aria-roledescription');
      container.removeAttribute('aria-label');
      container.innerHTML = '<div class="carousel__empty">Aucune image pour le moment.</div>';
      return;
    }

    container.setAttribute('role', 'region');
    container.setAttribute('aria-roledescription', 'carrousel');
    container.setAttribute('aria-label', 'Galerie Montevia');

    track = document.createElement('div');
    track.className = 'carousel__track';

    images.forEach(function (img, idx) {
      var slide = document.createElement('div');
      slide.className = 'carousel__slide';
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'diapositive');
      slide.setAttribute('aria-label', (idx + 1) + ' sur ' + images.length);
      slide.setAttribute('aria-hidden', idx === current ? 'false' : 'true');

      var image = document.createElement('img');
      image.src = img.image_url;
      image.alt = img.caption || 'Photo de Montevia';
      image.loading = idx === 0 ? 'eager' : 'lazy';
      image.decoding = 'async';
      slide.append(image);

      if (img.caption) {
        slide.append(node('div', 'carousel__caption', img.caption));
      }

      track.append(slide);
      slides.push(slide);
    });

    container.append(track);

    // Boutons précédent / suivant
    var prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'carousel__btn carousel__btn--prev';
    prevBtn.setAttribute('aria-label', 'Image précédente');
    prevBtn.innerHTML = '&#8249;';
    prevBtn.addEventListener('click', function () {
      goTo(current - 1, true);
    });
    container.append(prevBtn);

    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'carousel__btn carousel__btn--next';
    nextBtn.setAttribute('aria-label', 'Image suivante');
    nextBtn.innerHTML = '&#8250;';
    nextBtn.addEventListener('click', function () {
      goTo(current + 1, true);
    });
    container.append(nextBtn);

    // Pastilles de navigation
    var dotWrap = document.createElement('div');
    dotWrap.className = 'carousel__dots';
    dotWrap.setAttribute('role', 'group');
    dotWrap.setAttribute('aria-label', 'Choisir une image');
    images.forEach(function (_, idx) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'carousel__dot' + (idx === current ? ' is-active' : '');
      dot.setAttribute('aria-label', 'Image ' + (idx + 1) + ' sur ' + images.length);
      dot.addEventListener('click', function () {
        goTo(idx, true);
      });
      dots.push(dot);
      dotWrap.append(dot);
    });
    container.append(dotWrap);

    // Annonce discrète du changement d'image pour les lecteurs d'écran.
    live = node('p', 'sr-only');
    live.setAttribute('aria-live', 'polite');
    container.append(live);

    bindPause(container);
    bindSwipe(container);
    bindKeyboard(container);

    goTo(current);
    startAuto();
  }

  function goTo(idx, manual) {
    if (!images.length) return;
    current = ((idx % images.length) + images.length) % images.length;

    if (!track) track = document.querySelector('#carousel .carousel__track');
    if (track) track.style.transform = 'translateX(-' + (current * 100) + '%)';

    dots.forEach(function (dot, i) {
      var active = i === current;
      dot.classList.toggle('is-active', active);
      if (active) {
        dot.setAttribute('aria-current', 'true');
      } else {
        dot.removeAttribute('aria-current');
      }
    });

    slides.forEach(function (slide, i) {
      slide.setAttribute('aria-hidden', i === current ? 'false' : 'true');
    });

    if (live) live.textContent = 'Image ' + (current + 1) + ' sur ' + images.length;

    if (manual) {
      restartAuto();
    }
  }

  function startAuto() {
    if (timer || paused) return;
    if (images.length <= 1) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    timer = setInterval(function () {
      goTo(current + 1);
    }, AUTOPLAY_MS);
  }

  function stopAuto() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function restartAuto() {
    stopAuto();
    startAuto();
  }

  function pause() {
    paused = true;
    stopAuto();
  }

  function resume() {
    paused = false;
    startAuto();
  }

  function bindPause(container) {
    container.addEventListener('mouseenter', pause);
    container.addEventListener('mouseleave', resume);
    container.addEventListener('focusin', pause);
    container.addEventListener('focusout', function (event) {
      if (!container.contains(event.relatedTarget)) resume();
    });
  }

  function bindSwipe(container) {
    var startX = 0;
    var startY = 0;
    var tracking = false;

    container.addEventListener('touchstart', function (event) {
      if (event.touches.length !== 1) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      tracking = true;
    }, { passive: true });

    container.addEventListener('touchend', function (event) {
      if (!tracking) return;
      tracking = false;
      var touch = event.changedTouches && event.changedTouches[0];
      if (!touch) return;
      var dx = touch.clientX - startX;
      var dy = touch.clientY - startY;
      if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy)) return;
      goTo(dx < 0 ? current + 1 : current - 1, true);
    }, { passive: true });
  }

  function bindKeyboard(container) {
    container.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goTo(current - 1, true);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goTo(current + 1, true);
      }
    });
  }

  async function load() {
    try {
      if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        setTimeout(load, 500);
        return;
      }
      var config = getConfig();
      if (!config || !config.url || !config.anonKey) {
        setTimeout(load, 500);
        return;
      }
      var client = window.supabase.createClient(config.url, config.anonKey);
      var result = await client.from('montevia_gallery').select('*').eq('published', true).order('sort_order', { ascending: true });
      if (result.error) throw result.error;
      images = Array.isArray(result.data) ? result.data : [];
      render();
    } catch (e) {
      console.warn('gallery: load failed', e);
      var container = document.getElementById('carousel');
      if (container) {
        container.innerHTML = '<div class="carousel__empty">Impossible de charger la galerie.</div>';
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
