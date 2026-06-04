/**
 * NWK Component Loader — auth-aware navigation
 *
 * This single script handles ALL navigation rendering, including auth state.
 * Every HTML page loads this script. identity.js is only needed on pages
 * with login-specific logic (modal, redirect).
 *
 * How to enable debug logging:
 *   In browser console: localStorage.setItem('nwk_debug','1') then refresh.
 *   To disable: localStorage.removeItem('nwk_debug')
 *   Or append ?nwk_debug to the URL for one-time debug output.
 *
 * Browser console checks:
 *   typeof NWK                          // "object"
 *   typeof NWK.updateNav               // "function"
 *   typeof netlifyIdentity             // "object"
 *   netlifyIdentity.currentUser()      // user or null
 *   document.getElementById('site-left-nav')   // aside element or null
 *   document.querySelector('.left-nav')         // nav element or null
 *   document.body.className            // includes "auth-member" or "auth-admin"
 */
(function () {
  'use strict';

  /* ── Debug logging ─────────────────────────────────────────────────────────── */

  var _dbg = window.location.search.indexOf('nwk_debug') !== -1 ||
             localStorage.getItem('nwk_debug') === '1';

  function log() {
    if (!_dbg) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[NWK]');
    console.log.apply(console, args);
  }

  log('components.js loaded, readyState=' + document.readyState);

  /* ── Race-condition guard ──────────────────────────────────────────────────── */
  /* Set to true the first time identity.js fires init/login with the real user.
     Prevents updateNav(null) in the header/footer load chain from overwriting
     a correct member/admin nav that identity already rendered.                   */
  var _navAuthSet = false;

  /* ── Nav component URLs ───────────────────────────────────────────────────── */

  var TOP_NAV = {
    'public':   '/assets/components/nav-public.html',
    'member':   '/assets/components/nav-member.html',
    'admin':    '/assets/components/nav-admin.html',
    'no-role':  '/assets/components/nav-no-role.html',
  };

  var LEFT_NAV = {
    'public':   '/assets/components/nav-left-public.html',
    'member':   '/assets/components/nav-left-member.html',
    'admin':    '/assets/components/nav-left-admin.html',
    'no-role':  '/assets/components/nav-left-public.html',
  };

  /* ── Role detection ───────────────────────────────────────────────────────── */

  function getAuthSection(user) {
    if (!user) return 'public';
    var roles = (user.app_metadata && user.app_metadata.roles) || [];
    if (roles.indexOf('admin') !== -1 || roles.indexOf('technical-admin') !== -1) {
      return 'admin';
    }
    if (roles.indexOf('member') !== -1 ||
        roles.indexOf('records-steward') !== -1 ||
        roles.indexOf('content-maintainer') !== -1) {
      return 'member';
    }
    return 'no-role';
  }

  /* ── HTML loader ──────────────────────────────────────────────────────────── */

  function loadHTML(selector, url) {
    log('loadHTML', selector, url);
    var el = document.querySelector(selector);
    if (!el) {
      log('loadHTML: element not found:', selector);
      return Promise.resolve();
    }
    return fetch(url)
      .then(function (resp) {
        log('fetch', url, 'status=' + resp.status);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.text();
      })
      .then(function (html) { el.innerHTML = html; })
      .catch(function (err) {
        console.warn('NWK: failed to load ' + url + ':', err.message);
        el.innerHTML = '<div style="padding:0.5rem;background:#fdf5dc;font-size:0.8rem;color:#7a5a00;">' +
          'Navigation unavailable. Serve via a local server (<code>python3 -m http.server 8080</code>).' +
          '</div>';
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

  /* Global Escape handler — registered once */
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

  /* ── Nav bar colour ───────────────────────────────────────────────────────── */

  function applyNavTheme(authSection) {
    var nav = document.getElementById('site-nav');
    if (!nav) return;
    nav.classList.remove('nav--member', 'nav--admin');
    if (authSection === 'member' || authSection === 'no-role') nav.classList.add('nav--member');
    if (authSection === 'admin') nav.classList.add('nav--admin');
  }

  /* ── Body auth-state classes (UI only — not security) ────────────────────── */

  function setBodyClass(authSection) {
    document.body.classList.remove(
      'auth-public', 'auth-member', 'auth-admin', 'auth-no-role', 'nav-has-sidebar'
    );
    document.body.classList.add('auth-' + authSection);
    if (authSection === 'member' || authSection === 'admin') {
      document.body.classList.add('nav-has-sidebar');
    }
    log('body class set to auth-' + authSection);
  }

  /* ── Left-nav container injection ────────────────────────────────────────── */

  function ensureLeftNav() {
    if (document.body.dataset.noSidenav) {
      log('ensureLeftNav: skipped (data-no-sidenav)');
      return;
    }
    if (document.getElementById('site-left-nav')) {
      log('ensureLeftNav: already present');
      return;
    }
    var main = document.getElementById('main-content');
    if (!main) {
      log('ensureLeftNav: #main-content not found');
      return;
    }

    var aside = document.createElement('aside');
    aside.id = 'site-left-nav';
    aside.setAttribute('aria-label', 'Section navigation');

    if (main.parentElement && main.parentElement.classList.contains('site-body')) {
      log('ensureLeftNav: inserting aside into existing .site-body');
      main.parentElement.insertBefore(aside, main);
    } else {
      log('ensureLeftNav: wrapping main in .site-body and inserting aside');
      var wrapper = document.createElement('div');
      wrapper.className = 'site-body';
      main.parentNode.insertBefore(wrapper, main);
      wrapper.appendChild(aside);
      wrapper.appendChild(main);
    }
    log('ensureLeftNav: injection complete');
  }

  /* ── Main auth-nav update ─────────────────────────────────────────────────── */

  function updateNav(user) {
    var section = getAuthSection(user);
    var roles = user && user.app_metadata && user.app_metadata.roles;
    log('updateNav section=' + section + ' roles=' + JSON.stringify(roles));

    setBodyClass(section);
    ensureLeftNav();

    var leftNavEl = document.getElementById('site-left-nav');
    log('site-left-nav element:', leftNavEl ? 'found' : 'NOT FOUND');

    var topUrl  = TOP_NAV[section]  || TOP_NAV['public'];
    var leftUrl = LEFT_NAV[section] || LEFT_NAV['public'];

    var loads = [ loadHTML('#site-nav', topUrl) ];
    if (leftNavEl) {
      loads.push(loadHTML('#site-left-nav', leftUrl));
    }

    return Promise.all(loads).then(function () {
      applyNavTheme(section);
      markActiveLinks();
      initMobileMenu();
      if (leftNavEl) {
        initLeftNavMobile();
        openActiveDetails();
      }
      log('nav render complete for section=' + section);
    });
  }

  /* ── Identity Widget loader ───────────────────────────────────────────────── */

  function loadIdentityWidget() {
    if (window.netlifyIdentity) {
      log('identity widget already present');
      return;
    }
    if (document.querySelector('script[src*="netlify-identity-widget"]')) {
      log('identity widget script tag already in DOM');
      return;
    }
    log('loading identity widget dynamically');
    var s = document.createElement('script');
    s.src = 'https://identity.netlify.com/v1/netlify-identity-widget.js';
    s.async = true;
    document.head.appendChild(s);
  }

  /* ── Identity event handlers ──────────────────────────────────────────────── */
  /* Registered once from every page via components.js.                          */
  /* identity.js is only needed for login-page-specific redirect logic.          */

  var _identityHandlersRegistered = false;

  function registerIdentityHandlers() {
    if (_identityHandlersRegistered) return;
    _identityHandlersRegistered = true;
    log('registering identity event handlers');

    /* Logout button — event delegation, works after nav is injected */
    if (!window._nwkLogoutHandlerAdded) {
      window._nwkLogoutHandlerAdded = true;
      document.addEventListener('click', function (e) {
        var el = e.target.closest('[data-logout]');
        if (el) {
          e.preventDefault();
          log('logout button clicked');
          netlifyIdentity.logout();
        }
      });
    }

    /* Init — fires on every page with current user (or null if not logged in).
       This is the primary mechanism that makes auth-aware nav work everywhere. */
    netlifyIdentity.on('init', function (user) {
      _navAuthSet = true;
      log('identity init event, user=' + (user ? user.email : 'null'));
      updateNav(user);
    });

    /* Login — update nav after successful login */
    netlifyIdentity.on('login', function (user) {
      _navAuthSet = true;
      log('identity login event, user=' + (user ? user.email : 'null'));
      updateNav(user);
    });

    /* Logout — reset to public nav and redirect home */
    netlifyIdentity.on('logout', function () {
      _navAuthSet = false;
      log('identity logout event');
      updateNav(null);
      window.location.href = '/';
    });
  }

  /* ── Poll for Identity Widget, then register handlers ────────────────────── */

  function pollForIdentity() {
    if (window.netlifyIdentity) {
      log('identity widget available immediately (blocking script in <head>)');
      registerIdentityHandlers();
      /* Fast path: cached user from localStorage */
      if (typeof window.netlifyIdentity.currentUser === 'function') {
        var cached = window.netlifyIdentity.currentUser();
        if (cached) {
          log('fast path: cached user found, section=' + getAuthSection(cached));
          _navAuthSet = true;
          updateNav(cached);
        }
      }
      return;
    }
    var tries = 0;
    var poll = setInterval(function () {
      if (window.netlifyIdentity) {
        clearInterval(poll);
        log('identity widget loaded after ~' + (tries * 50) + 'ms');
        registerIdentityHandlers();
      } else if (++tries >= 100) {
        clearInterval(poll);
        console.warn('NWK: identity widget did not load after 5s. ' +
          'Enable debug: localStorage.setItem("nwk_debug","1")');
      }
    }, 50);
  }

  /* ── Initialisation ───────────────────────────────────────────────────────── */

  function init() {
    log('init() called');

    /* Expose globals for identity.js and browser console inspection */
    window.NWK = window.NWK || {};
    window.NWK.updateNav      = updateNav;
    window.NWK.getAuthSection = getAuthSection;
    window.NWK.log            = log;

    log('window.NWK registered');

    loadIdentityWidget();
    pollForIdentity();

    /* Load header and footer (auth-independent) */
    Promise.all([
      loadHTML('#site-header', '/assets/components/site-header.html'),
      loadHTML('#site-footer', '/assets/components/site-footer.html'),
    ]).then(function () {
      log('header/footer loaded, _navAuthSet=' + _navAuthSet);
      /* Render public nav only if identity has not already set the correct nav.
         If identity fired 'init' before this resolved, _navAuthSet is true
         and we skip updateNav(null) to avoid overwriting the member/admin nav. */
      if (!_navAuthSet) {
        log('identity not yet ready — rendering public nav as default');
        return updateNav(null);
      }
      log('identity already set nav — skipping public default');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
