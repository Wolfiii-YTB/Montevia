/* Montevia — carrousel de la galerie */

(function () {
  'use strict';

  var FALLBACK_CONFIG = {
    url: 'https://bylwvlxxvgumvqgpwgod.supabase.co',
    anonKey: 'sb_publishable_T3XYbDWXV5VaC8WQj3CZOQ_LmB7CTwv'
  };

  var images = [];
  var current = 0;
  var timer = null;

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

    if (!images.length) {
      container.innerHTML = '<div class="carousel__empty">Aucune image pour le moment.</div>';
      return;
    }

    var track = document.createElement('div');
    track.className = 'carousel__track';

    images.forEach(function (img, idx) {
      var slide = document.createElement('div');
      slide.className = 'carousel__slide';

      var image = document.createElement('img');
      image.src = img.image_url;
      image.alt = img.caption || '';
      image.loading = 'lazy';
      slide.append(image);

      if (img.caption) {
        slide.append(node('div', 'carousel__caption', img.caption));
      }

      track.append(slide);
    });

    container.append(track);

    // Prev/Next buttons
    var prevBtn = document.createElement('button');
    prevBtn.className = 'carousel__btn carousel__btn--prev';
    prevBtn.innerHTML = '&#8249;';
    prevBtn.addEventListener('click', function () { goTo(current - 1); });
    container.append(prevBtn);

    var nextBtn = document.createElement('button');
    nextBtn.className = 'carousel__btn carousel__btn--next';
    nextBtn.innerHTML = '&#8250;';
    nextBtn.addEventListener('click', function () { goTo(current + 1); });
    container.append(nextBtn);

    // Dots
    var dots = document.createElement('div');
    dots.className = 'carousel__dots';
    images.forEach(function (_, idx) {
      var dot = document.createElement('button');
      dot.className = 'carousel__dot' + (idx === current ? ' is-active' : '');
      dot.addEventListener('click', function () { goTo(idx); });
      dots.append(dot);
    });
    container.append(dots);

    goTo(current);
    startAuto();
  }

  function goTo(idx) {
    if (!images.length) return;
    current = ((idx % images.length) + images.length) % images.length;
    var track = document.querySelector('#carousel .carousel__track');
    if (track) track.style.transform = 'translateX(-' + (current * 100) + '%)';
    var dots = document.querySelectorAll('#carousel .carousel__dot');
    dots.forEach(function (d, i) {
      d.classList.toggle('is-active', i === current);
    });
  }

  function startAuto() {
    if (timer) clearInterval(timer);
    if (images.length <= 1) return;
    timer = setInterval(function () {
      goTo(current + 1);
    }, 5000);
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