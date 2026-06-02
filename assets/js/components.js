/**
 * NWK Component Loader
 * Loads shared header, nav, and footer from /assets/components/
 * Requires a web server (http://); will not work from file:// protocol.
 * Local dev: python3 -m http.server 8080  OR  VS Code Live Server
 */
(function () {
  'use strict';

  const SECTION_NAV = {
    public: '/assets/components/nav-public.html',
    member: '/assets/components/nav-member.html',
    admin:  '/assets/components/nav-admin.html',
  };

  async function loadHTML(selector, url) {
    const el = document.querySelector(selector);
    if (!el) return;
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      el.innerHTML = await resp.text();
    } catch (err) {
      console.warn(`NWK: failed to load component ${url}:`, err.message);
      el.innerHTML = `<div style="padding:0.5rem;background:#fdf5dc;font-size:0.8rem;color:#7a5a00;">
        Navigation unavailable. Open the site via a local server, not directly from a file.
        <br><code>python3 -m http.server 8080</code>
      </div>`;
    }
  }

  function markActiveNav() {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    document.querySelectorAll('#site-nav a').forEach(function (a) {
      const href = (a.getAttribute('href') || '').replace(/\/$/, '') || '/';
      if (href === '/' && path === '/') {
        a.classList.add('active');
      } else if (href !== '/' && path.startsWith(href)) {
        a.classList.add('active');
      }
    });
  }

  function initMobileMenu() {
    const toggle = document.querySelector('.nav-toggle');
    const navList = document.querySelector('.nav-list');
    if (!toggle || !navList) return;
    toggle.addEventListener('click', function () {
      const open = navList.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navList.classList.contains('nav-open')) {
        navList.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  function applyNavTheme() {
    const nav = document.getElementById('site-nav');
    const section = document.body.dataset.section;
    if (nav && section && section !== 'public') {
      nav.classList.add('nav--' + section);
    }
  }

  function init() {
    const section = document.body.dataset.section || 'public';
    const navUrl = SECTION_NAV[section] || SECTION_NAV.public;

    Promise.all([
      loadHTML('#site-header', '/assets/components/site-header.html'),
      loadHTML('#site-nav',    navUrl),
      loadHTML('#site-footer', '/assets/components/site-footer.html'),
    ]).then(function () {
      applyNavTheme();
      markActiveNav();
      initMobileMenu();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
