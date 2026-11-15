/* Montevia — interactions */

(function () {
  'use strict';

  document.documentElement.classList.add('has-js');

  var header = document.getElementById('header');
  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');
  var year = document.getElementById('year');
  var progress = document.getElementById('progress');

  /* ---- année du footer ---- */
  if (year) year.textContent = new Date().getFullYear();

  /* ---- header + barre de progression ---- */
  var onScroll = function () {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 6);
    if (progress) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---- menu mobile ---- */
  var setMenu = function (open) {
    if (!nav || !burger) return;
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
  };

  if (burger && nav) {
    burger.addEventListener('click', function () {
      setMenu(!nav.classList.contains('is-open'));
    });

    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setMenu(false);
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) setMenu(false);
    });
  }

  /* ---- apparition au défilement ---- */
  var items = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  var show = function (el) { el.classList.add('is-visible'); };

  // léger décalage entre les cartes d'une même grille
  ['.features', '.jobs', '.team', '.rules', '.faq'].forEach(function (selector) {
    var group = document.querySelectorAll(selector);
    Array.prototype.forEach.call(group, function (parent) {
      Array.prototype.forEach.call(parent.children, function (child, index) {
        if (child.classList.contains('reveal')) {
          child.style.transitionDelay = Math.min(index, 4) * 55 + 'ms';
        }
      });
    });
  });

  // ce qui est déjà à l'écran s'affiche immédiatement
  items.forEach(function (el) {
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) show(el);
  });

  if (!('IntersectionObserver' in window)) {
    items.forEach(show);
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        show(entry.target);
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    items.forEach(function (el) {
      if (!el.classList.contains('is-visible')) revealObserver.observe(el);
    });

    // filet de sécurité si l'observateur ne se déclenche pas
    setTimeout(function () {
      if (!document.querySelector('.reveal.is-visible')) items.forEach(show);
    }, 1800);
  }

  /* ---- section active ---- */
  var sections = document.querySelectorAll('main section[id]');
  var links = document.querySelectorAll('.nav > a[href^="#"]');

  if (sections.length && 'IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = '#' + entry.target.id;
        links.forEach(function (link) {
          link.classList.toggle('is-active', link.getAttribute('href') === id);
        });
      });
    }, { rootMargin: '-42% 0px -54% 0px' });

    sections.forEach(function (section) { spy.observe(section); });
  }

  /* ---- FAQ ---- */
  var faqItems = document.querySelectorAll('.faq__item');

  Array.prototype.forEach.call(faqItems, function (item) {
    var button = item.querySelector('.faq__question');
    var answer = item.querySelector('.faq__answer');
    if (!button || !answer) return;

    button.addEventListener('click', function () {
      var open = item.classList.contains('is-open');

      // une seule réponse ouverte à la fois
      Array.prototype.forEach.call(faqItems, function (other) {
        if (other === item) return;
        other.classList.remove('is-open');
        var otherBtn = other.querySelector('.faq__question');
        var otherAnswer = other.querySelector('.faq__answer');
        if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
        if (otherAnswer) otherAnswer.style.maxHeight = null;
      });

      item.classList.toggle('is-open', !open);
      button.setAttribute('aria-expanded', open ? 'false' : 'true');
      answer.style.maxHeight = open ? null : answer.scrollHeight + 'px';
    });
  });

  window.addEventListener('resize', function () {
    Array.prototype.forEach.call(document.querySelectorAll('.faq__item.is-open'), function (item) {
      var answer = item.querySelector('.faq__answer');
      if (answer) answer.style.maxHeight = answer.scrollHeight + 'px';
    });
  });
})();
