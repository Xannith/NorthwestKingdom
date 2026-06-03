/**
 * NWK Component Loader
 * Loads shared header, nav, left nav, and footer from /assets/components/
 * Requires a web server (http://); will not work from file:// protocol.
 * Local dev: python3 -m http.server 8080  OR  VS Code Live Server
 *
 * Left nav: loaded into <aside id="site-left-nav"> when that element is present.
 * Pages that want a left nav must include the aside in their HTML inside a .site-body wrapper.
 */
(function () {
  'use strict';

  const SECTION_NAV = {
    public: '/assets/components/nav-public.html',
    member: '/assets/components/nav-member.html',
    admin:  '/assets/components/nav-admin.html',
  };

  const SECTION_LEFT_NAV = {
    public: '/assets/components/nav-left-public.html',
    member: '/assets/components/nav-left-member.html',
    admin:  '/assets/components/nav-left-admin.html',
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

  /* Mark active links in both top nav and left nav */
  function markActiveLinks() {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    document.querySelectorAll('#site-nav a, #site-left-nav a').forEach(function (a) {
      const href = (a.getAttribute('href') || '').replace(/\/$/, '') || '/';
      if (href === '/' && path === '/') {
        a.classList.add('active');
        a.setAttribute('aria-current', 'page');
      } else if (href !== '/' && path.startsWith(href)) {
        a.classList.add('active');
        a.setAttribute('aria-current', 'page');
      }
    });
  }

  /* Open <details> in the left nav that contains the current page */
  function openActiveDetails() {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    document.querySelectorAll('#site-left-nav details').forEach(function (det) {
      const links = det.querySelectorAll('a');
      for (let i = 0; i < links.length; i++) {
        const href = (links[i].getAttribute('href') || '').replace(/\/$/, '') || '/';
        if (href !== '/' && path.startsWith(href)) {
          det.open = true;
          break;
        }
      }
    });
  }

  /* Mobile toggle for the top nav */
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

  /* Mobile toggle for the left nav */
  function initLeftNavMobile() {
    const toggle = document.getElementById('left-nav-mobile-toggle');
    const sections = document.getElementById('left-nav-sections');
    if (!toggle || !sections) return;
    toggle.addEventListener('click', function () {
      const open = sections.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sections.classList.contains('is-open')) {
        sections.classList.remove('is-open');
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
    const leftNavUrl = SECTION_LEFT_NAV[section] || SECTION_LEFT_NAV.public;
    const leftNavEl = document.getElementById('site-left-nav');

    const loads = [
      loadHTML('#site-header', '/assets/components/site-header.html'),
      loadHTML('#site-nav',    navUrl),
      loadHTML('#site-footer', '/assets/components/site-footer.html'),
    ];

    if (leftNavEl) {
      loads.push(loadHTML('#site-left-nav', leftNavUrl));
    }

    Promise.all(loads).then(function () {
      applyNavTheme();
      markActiveLinks();
      initMobileMenu();
      if (leftNavEl) {
        initLeftNavMobile();
        openActiveDetails();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
