/**
 * NWK Component Loader — auth-aware navigation
 *
 * Exposes window.NWK.updateNav(user) which identity.js calls on init/login/logout.
 * Nav components are loaded based on Netlify Identity auth state, not data-section.
 *
 * data-section is still used for page-specific styling (CSS classes on #site-nav),
 * but does NOT determine which nav HTML is loaded.
 *
 * Left nav is injected into every page that does not have data-no-sidenav on <body>.
 * Pages with data-no-sidenav="true" (login, access-denied) keep their centred layouts.
 */
(function () {
  'use strict';

  /* ── Nav component URLs ───────────────────────────────────────────────────── */

  var TOP_NAV = {
    public:   '/assets/components/nav-public.html',
    member:   '/assets/components/nav-member.html',
    admin:    '/assets/components/nav-admin.html',
    'no-role': '/assets/components/nav-no-role.html',
  };

  var LEFT_NAV = {
    public:   '/assets/components/nav-left-public.html',
    member:   '/assets/components/nav-left-member.html',
    admin:    '/assets/components/nav-left-admin.html',
    'no-role': '/assets/components/nav-left-public.html', /* public content still accessible */
  };

  /* ── Role detection ───────────────────────────────────────────────────────── */

  function getAuthSection(user) {
    if (!user) return 'public';
    var roles = (user.app_metadata && user.app_metadata.roles) || [];
    /* admin roles */
    if (roles.indexOf('admin') !== -1 || roles.indexOf('technical-admin') !== -1) {
      return 'admin';
    }
    /* member roles */
    if (roles.indexOf('member') !== -1 ||
        roles.indexOf('records-steward') !== -1 ||
        roles.indexOf('content-maintainer') !== -1) {
      return 'member';
    }
    /* logged in but no valid role yet */
    return 'no-role';
  }

  /* ── HTML loader ──────────────────────────────────────────────────────────── */

  function loadHTML(selector, url) {
    var el = document.querySelector(selector);
    if (!el) return Promise.resolve();
    return fetch(url)
      .then(function (resp) {
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.text();
      })
      .then(function (html) { el.innerHTML = html; })
      .catch(function (err) {
        console.warn('NWK: failed to load ' + url + ':', err.message);
        el.innerHTML = '<div style="padding:0.5rem;background:#fdf5dc;font-size:0.8rem;color:#7a5a00;">' +
          'Navigation unavailable. Open the site via a local server.' +
          '<br><code>python3 -m http.server 8080</code></div>';
      });
  }

  /* ── Active-link marking ──────────────────────────────────────────────────── */

  function markActiveLinks() {
    var path = window.location.pathname.replace(/\/$/, '') || '/';
    document.querySelectorAll('#site-nav a, #site-left-nav a').forEach(function (a) {
      var href = (a.getAttribute('href') || '').replace(/\/$/, '') || '/';
      a.classList.remove('active');
      a.removeAttribute('aria-current');
      if (href === '/' && path === '/') {
        a.classList.add('active');
        a.setAttribute('aria-current', 'page');
      } else if (href !== '/' && path.startsWith(href)) {
        a.classList.add('active');
        a.setAttribute('aria-current', 'page');
      }
    });
  }

  /* ── Open <details> containing the current page ───────────────────────────── */

  function openActiveDetails() {
    var path = window.location.pathname.replace(/\/$/, '') || '/';
    document.querySelectorAll('#site-left-nav details').forEach(function (det) {
      var links = det.querySelectorAll('a');
      for (var i = 0; i < links.length; i++) {
        var href = (links[i].getAttribute('href') || '').replace(/\/$/, '') || '/';
        if (href !== '/' && path.startsWith(href)) { det.open = true; break; }
      }
    });
  }

  /* ── Mobile top-nav toggle ────────────────────────────────────────────────── */

  function initMobileMenu() {
    /* Clone toggle to remove any previously attached listener */
    var toggle = document.querySelector('#site-nav .nav-toggle');
    var navList = document.querySelector('#site-nav .nav-list');
    if (!toggle || !navList) return;
    var fresh = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(fresh, toggle);
    fresh.addEventListener('click', function () {
      var open = navList.classList.toggle('nav-open');
      fresh.setAttribute('aria-expanded', String(open));
    });
  }

  /* ── Mobile left-nav toggle ───────────────────────────────────────────────── */

  function initLeftNavMobile() {
    var toggle = document.getElementById('left-nav-mobile-toggle');
    var sections = document.getElementById('left-nav-sections');
    if (!toggle || !sections) return;
    var fresh = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(fresh, toggle);
    fresh.addEventListener('click', function () {
      var open = sections.classList.toggle('is-open');
      fresh.setAttribute('aria-expanded', String(open));
    });
  }

  /* Single global Escape handler — registered once, reads current DOM state */
  if (!window._nwkEscapeAdded) {
    window._nwkEscapeAdded = true;
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var navList = document.querySelector('#site-nav .nav-list');
      if (navList && navList.classList.contains('nav-open')) {
        navList.classList.remove('nav-open');
        var t = document.querySelector('#site-nav .nav-toggle');
        if (t) { t.setAttribute('aria-expanded', 'false'); t.focus(); }
      }
      var secs = document.getElementById('left-nav-sections');
      if (secs && secs.classList.contains('is-open')) {
        secs.classList.remove('is-open');
        var lt = document.getElementById('left-nav-mobile-toggle');
        if (lt) { lt.setAttribute('aria-expanded', 'false'); lt.focus(); }
      }
    });
  }

  /* ── Nav bar colour (not security — visual only) ─────────────────────────── */

  function applyNavTheme(authSection) {
    var nav = document.getElementById('site-nav');
    if (!nav) return;
    nav.classList.remove('nav--member', 'nav--admin');
    if (authSection === 'member' || authSection === 'no-role') nav.classList.add('nav--member');
    if (authSection === 'admin') nav.classList.add('nav--admin');
  }

  /* ── Body auth-state classes (UI only, NOT security) ─────────────────────── */

  function setBodyClass(authSection) {
    document.body.classList.remove('auth-public', 'auth-member', 'auth-admin', 'auth-no-role', 'nav-has-sidebar');
    document.body.classList.add('auth-' + authSection);
    if (authSection === 'member' || authSection === 'admin') {
      document.body.classList.add('nav-has-sidebar');
    }
  }

  /* ── Left-nav container injection ────────────────────────────────────────── */

  function ensureLeftNav() {
    if (document.body.dataset.noSidenav) return;
    if (document.getElementById('site-left-nav')) return;   /* already present */
    var main = document.getElementById('main-content');
    if (!main) return;

    var aside = document.createElement('aside');
    aside.id = 'site-left-nav';
    aside.setAttribute('aria-label', 'Section navigation');

    if (main.parentElement.classList.contains('site-body')) {
      /* main is already inside .site-body — just prepend the aside */
      main.parentElement.insertBefore(aside, main);
    } else {
      /* Wrap main in .site-body and insert aside before it */
      var wrapper = document.createElement('div');
      wrapper.className = 'site-body';
      main.parentNode.insertBefore(wrapper, main);
      wrapper.appendChild(aside);
      wrapper.appendChild(main);
    }
  }

  /* ── Main auth-nav update ─── called by identity.js ──────────────────────── */

  function updateNav(user) {
    var section = getAuthSection(user);
    setBodyClass(section);
    ensureLeftNav();

    var leftNavEl = document.getElementById('site-left-nav');
    var loads = [ loadHTML('#site-nav', TOP_NAV[section] || TOP_NAV.public) ];
    if (leftNavEl) {
      loads.push(loadHTML('#site-left-nav', LEFT_NAV[section] || LEFT_NAV.public));
    }

    return Promise.all(loads).then(function () {
      applyNavTheme(section);
      markActiveLinks();
      initMobileMenu();
      if (leftNavEl) {
        initLeftNavMobile();
        openActiveDetails();
      }
    });
  }

  /* ── Identity Widget dynamic loader ──────────────────────────────────────── */

  function loadIdentityWidget() {
    if (window.netlifyIdentity) return;
    if (document.querySelector('script[src*="netlify-identity-widget"]')) return;
    var s = document.createElement('script');
    s.src = 'https://identity.netlify.com/v1/netlify-identity-widget.js';
    s.async = true;
    document.head.appendChild(s);
  }

  /* ── Initialisation ───────────────────────────────────────────────────────── */

  function init() {
    /* Expose updateNav and role helpers for identity.js */
    window.NWK = window.NWK || {};
    window.NWK.updateNav     = updateNav;
    window.NWK.getAuthSection = getAuthSection;

    loadIdentityWidget();

    /* Load header and footer first (auth-independent) */
    Promise.all([
      loadHTML('#site-header', '/assets/components/site-header.html'),
      loadHTML('#site-footer', '/assets/components/site-footer.html'),
    ]).then(function () {
      /* Render public nav immediately while we wait for identity to initialise.
         identity.js will call NWK.updateNav(user) once the widget fires 'init'. */
      return updateNav(null);
    }).then(function () {
      /* Fast path: if widget is already loaded (blocking <script> in <head>)
         and a cached user exists in localStorage, update nav right away without
         waiting for the async 'init' event. */
      if (window.netlifyIdentity && typeof window.netlifyIdentity.currentUser === 'function') {
        var cached = window.netlifyIdentity.currentUser();
        if (cached) updateNav(cached);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
