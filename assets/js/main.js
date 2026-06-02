/**
 * NWK main.js — general site utilities
 */
(function () {
  'use strict';

  /* Search placeholder — wire up when real search is implemented */
  function initSearchForms() {
    document.querySelectorAll('form[data-search-placeholder]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var msg = form.querySelector('.search-placeholder-msg');
        if (msg) {
          msg.hidden = false;
        }
      });
    });
  }

  /* Smooth anchor scroll for in-page links */
  function initAnchorScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href').slice(1);
        var target = document.getElementById(id);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  /* External link indicator — adds aria-label for screen readers */
  function labelExternalLinks() {
    document.querySelectorAll('a[href^="http"]').forEach(function (a) {
      if (!a.hostname || a.hostname === window.location.hostname) return;
      if (!a.getAttribute('aria-label')) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
        a.setAttribute('aria-label', (a.textContent.trim() || 'link') + ' (opens in new tab)');
      }
    });
  }

  function init() {
    initSearchForms();
    initAnchorScroll();
    labelExternalLinks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
