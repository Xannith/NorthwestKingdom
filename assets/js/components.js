/**
 * NWK Navigation Controller
 *
 * Architecture:
 *   1. On DOMContentLoaded, render public nav immediately as safe default.
 *   2. Load identity widget (async on most pages; blocking on homepage/login).
 *   3. When widget is ready, call currentUser() immediately — do NOT wait for
 *      the 'init' event, because it may have already fired before our handler
 *      was registered (the root cause of the "nav stays public" bug).
 *   4. Render nav based on currentUser() result.
 *   5. Register on('init') as a correction pass once Netlify verifies the token.
 *   6. Register on('login') / on('logout') for live updates.
 *
 * Nav is rendered INLINE from JS data arrays — not fetched from HTML files.
 * This makes updateNav() synchronous and eliminates all async timing issues.
 *
 * Header and footer still use fetch (they are auth-independent).
 *
 * Enable debug: localStorage.setItem('nwk_debug','1') then refresh.
 * Disable:      localStorage.removeItem('nwk_debug')
 */
(function () {
  'use strict';

  /* ── Debug ─────────────────────────────────────────────────────────────────── */

  var _dbg = window.location.search.indexOf('nwk_debug') !== -1 ||
             localStorage.getItem('nwk_debug') === '1';

  function log() {
    if (!_dbg) return;
    var a = Array.prototype.slice.call(arguments);
    a.unshift('[NWK]');
    console.log.apply(console, a);
  }

  log('components.js loaded');

  /* ── Escaping ───────────────────────────────────────────────────────────────── */

  function escH(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function escA(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  /* ── Role detection ─────────────────────────────────────────────────────────── */

  function getAuthSection(user) {
    if (!user) return 'public';
    var roles = (user.app_metadata && user.app_metadata.roles) || [];
    if (roles.indexOf('admin') !== -1 || roles.indexOf('technical-admin') !== -1) return 'admin';
    if (roles.indexOf('member')              !== -1 ||
        roles.indexOf('records-steward')     !== -1 ||
        roles.indexOf('content-maintainer')  !== -1) return 'member';
    return 'no-role';
  }

  /* ── Nav data ───────────────────────────────────────────────────────────────── */
  /* All nav content lives here. No HTML fragments fetched for navigation.         */

  var TOP_ITEMS = {
    'public': [
      { href: '/',                      label: 'Home' },
      { href: '/public-documents/',     label: 'Public Documents' },
      { href: '/public/about-nwk.html', label: 'About NWK' },
      { href: '/login/',                label: 'Member Login', cls: 'nav-login' },
    ],
    'member': [
      { href: '/',                   label: 'Home' },
      { href: '/member/dashboard/',  label: 'Dashboard' },
      { href: '/member/profile/',    label: 'Profile' },
      { href: '#', label: 'Log Out', cls: 'nav-login', logout: true },
    ],
    'admin': [
      { href: '/',                   label: 'Home' },
      { href: '/member/dashboard/',  label: 'Dashboard' },
      { href: '/admin/',             label: 'Admin' },
      { href: '/member/profile/',    label: 'Profile' },
      { href: '#', label: 'Log Out', cls: 'nav-login', logout: true },
    ],
    'no-role': [
      { href: '/',                      label: 'Home' },
      { href: '/public-documents/',     label: 'Public Documents' },
      { href: '/public/about-nwk.html', label: 'About NWK' },
      { href: '#', label: 'Log Out', cls: 'nav-login', logout: true },
    ],
  };

  /* Left nav groups. Each group has a label and an items array.
     Items may be plain links or collapsible sections (collapsible:true + sub:[]).
     The admin left nav is member groups + the admin group appended.              */

  var LEFT_PUBLIC = [
    { label: 'Public Reference', items: [
      { href: '/public-documents/', label: 'Public Documents', sub: [
        { href: '/public/mlc-reference/governing-documents/articles-of-incorporation.html', label: 'Articles of Incorporation' },
        { href: '/public/mlc-reference/governing-documents/covenants-and-restrictions.html', label: 'Covenants and Restrictions' },
        { href: '/public/mlc-reference/governing-documents/bylaws.html', label: 'Bylaws' },
      ]},
      { href: '/public/about-nwk.html', label: 'About NWK' },
      { href: '/public/contact.html',   label: 'Contact' },
      { href: '/login/',                label: 'Member Login' },
    ]},
  ];

  var LEFT_NO_ROLE = [
    { label: 'Your Account', items: [
      { href: '/access-denied/', label: 'Access info — no role assigned' },
      { href: '#', label: 'Log Out', logout: true },
    ]},
  ].concat(LEFT_PUBLIC);

  var LEFT_MEMBER = [
    { label: 'Northwest Kingdom', items: [
      { href: '/member/dashboard/',        label: 'Dashboard' },
      { href: '/member/nwk-hub/',          label: 'NWK Hub' },
      { href: '/member/nwk-hub/notices.html', label: 'Notices' },
      { href: '/member/calendar/',         label: 'Calendar' },
      { href: '/member/neighbor-skills/',  label: 'Neighbor Skills' },
      { href: '/public/photos/',           label: 'Photos' },
      { href: '/member/documents/',        label: 'Documents' },
      { href: '/member/search/',           label: 'Search' },
    ]},
    { label: 'Governance', items: [
      { label: 'Current MLC Framework', collapsible: true, sub: [
        { href: '/member/governance/current-mlc-framework/',                           label: 'Overview' },
        { href: '/member/governance/current-mlc-framework/source-documents.html',     label: 'Source Documents' },
        { href: '/member/governance/current-mlc-framework/rules-affecting-nwk.html',  label: 'Rules Affecting NWK' },
        { href: '/member/governance/current-mlc-framework/obligations.html',          label: 'Obligations' },
        { href: '/member/governance/current-mlc-framework/rights-and-limitations.html', label: 'Rights and Limitations' },
        { href: '/member/governance/current-mlc-framework/current-gaps.html',         label: 'Current Gaps' },
        { href: '/member/governance/current-mlc-framework/questions-for-review.html', label: 'Questions for Review' },
      ]},
      { label: 'Representation', collapsible: true, sub: [
        { href: '/member/governance/representation/',                          label: 'Overview' },
        { href: '/member/governance/representation/tc-representative.html',    label: 'TC Representative' },
        { href: '/member/governance/representation/representative-bio.html',   label: 'Representative Bio' },
        { href: '/member/governance/representation/representative-updates.html', label: 'Representative Updates' },
        { href: '/member/governance/representation/tc-agenda-watch.html',      label: 'TC Agenda Watch' },
        { href: '/member/governance/representation/vote-tracking.html',        label: 'Vote Tracking' },
        { href: '/member/governance/representation/questions-for-tc.html',     label: 'Questions for TC' },
        { href: '/member/governance/representation/tc-meeting-notes/',         label: 'TC Meeting Notes' },
      ]},
      { label: 'NWK Governance Development', collapsible: true, sub: [
        { href: '/member/governance/nwk-governance-development/',                              label: 'Overview' },
        { href: '/member/governance/nwk-governance-development/lightweight-governance.html',   label: 'Lightweight Governance' },
        { href: '/member/governance/nwk-governance-development/operating-principles.html',     label: 'Operating Principles' },
        { href: '/member/governance/nwk-governance-development/roles-and-responsibilities/',   label: 'Roles and Responsibilities' },
        { href: '/member/governance/nwk-governance-development/decision-making/',              label: 'Decision Making' },
        { href: '/member/governance/nwk-governance-development/draft-documents/',             label: 'Draft Documents' },
        { href: '/member/governance/nwk-governance-development/discussion/',                  label: 'Discussion' },
        { href: '/member/governance/nwk-governance-development/decision-log.html',            label: 'Decision Log' },
      ]},
      { label: 'Records', collapsible: true, sub: [
        { href: '/member/governance/records/',                        label: 'Overview' },
        { href: '/member/governance/records/meeting-notes/',          label: 'Meeting Notes' },
        { href: '/member/governance/records/decisions/',              label: 'Decisions' },
        { href: '/member/governance/records/proposals/',              label: 'Proposals' },
        { href: '/member/governance/records/votes/',                  label: 'Votes' },
        { href: '/member/governance/records/archived-notices/',       label: 'Archived Notices' },
        { href: '/member/governance/records/historical-records/',     label: 'Historical Records' },
      ]},
    ]},
    { label: 'Operations', items: [
      { href: '/member/operations/maintenance/',              label: 'Maintenance' },
      { href: '/member/operations/maintenance/roads.html',    label: 'Roads' },
      { href: '/member/operations/maintenance/drainage.html', label: 'Drainage' },
      { href: '/member/operations/maintenance/signage.html',  label: 'Signage' },
      { href: '/member/operations/maintenance/common-areas.html', label: 'Common Areas' },
      { href: '/member/operations/work-parties/',             label: 'Work Parties' },
      { href: '/member/operations/land-stewardship/',         label: 'Land Stewardship' },
      { href: '/member/operations/emergency-and-safety/',     label: 'Emergency and Safety' },
      { href: '/member/operations/forms/',                    label: 'Forms' },
      { href: '/member/operations/standard-operating-procedures/', label: 'SOPs' },
    ]},
    { label: 'Projects', items: [
      { href: '/member/projects/active/',            label: 'Active' },
      { href: '/member/projects/proposed/',          label: 'Proposed' },
      { href: '/member/projects/completed/',         label: 'Completed' },
      { href: '/member/projects/deferred/',          label: 'Deferred' },
      { href: '/member/projects/project-templates/', label: 'Templates' },
    ]},
    { label: 'Archives', items: [
      { href: '/member/archives/council-business/',    label: 'Council Business' },
      { href: '/member/archives/alternate-current/',   label: 'Alternate Current' },
      { href: '/member/archives/',                     label: 'Historical Documents' },
      { href: '/public/photos/',                       label: 'Photo Archive' },
    ]},
  ];

  var LEFT_ADMIN_GROUP = { label: 'Admin', items: [
    { href: '/admin/',                           label: 'Admin Dashboard' },
    { href: '/admin/users/',                     label: 'Users' },
    { href: '/admin/access-roles/',              label: 'Access Roles' },
    { href: '/admin/content-review/',            label: 'Content Review' },
    { href: '/admin/document-management/',       label: 'Document Management' },
    { href: '/admin/pdf-conversion-queue/',      label: 'PDF Conversion Queue' },
    { href: '/admin/search-index-manager/',      label: 'Search Index Manager' },
    { href: '/admin/photo-review/',              label: 'Photo Review' },
    { href: '/admin/calendar-approvals/',        label: 'Calendar Approvals' },
    { href: '/admin/alternate-current-manager/', label: 'Alternate Current Manager' },
    { href: '/admin/council-business-manager/',  label: 'Council Business Manager' },
    { href: '/admin/backups/',                   label: 'Backups' },
    { href: '/admin/audit-log/',                 label: 'Audit Log' },
  ]};

  var LEFT_ADMIN = LEFT_MEMBER.concat([LEFT_ADMIN_GROUP]);

  var LEFT_NAV_DATA = {
    'public':  LEFT_PUBLIC,
    'member':  LEFT_MEMBER,
    'admin':   LEFT_ADMIN,
    'no-role': LEFT_NO_ROLE,
  };

  /* ── Nav rendering (synchronous — no fetch) ──────────────────────────────────── */

  function isActive(href) {
    if (!href || href === '#') return false;
    var path = window.location.pathname.replace(/\/$/, '') || '/';
    var h    = href.replace(/\/$/, '') || '/';
    return h === '/' ? path === '/' : path.startsWith(h);
  }

  function renderTopNav(section) {
    var items = TOP_ITEMS[section] || TOP_ITEMS['public'];
    var html  = '<div class="nav-inner">' +
      '<button class="nav-toggle" aria-label="Toggle navigation" aria-expanded="false">' +
      '<span></span><span></span><span></span></button>' +
      '<ul class="nav-list" role="list">';
    items.forEach(function (it) {
      var active = isActive(it.href);
      html += '<li><a href="' + escA(it.href) + '"';
      if (it.cls)    html += ' class="' + escA(it.cls) + '"';
      if (it.logout) html += ' data-logout';
      if (active)    html += ' aria-current="page"';
      html += '>' + escH(it.label) + '</a></li>';
    });
    html += '</ul></div>';
    return html;
  }

  function renderSubItem(it) {
    var active = isActive(it.href);
    return '<li><a href="' + escA(it.href) + '"' +
      (active ? ' class="active" aria-current="page"' : '') + '>' +
      escH(it.label) + '</a></li>';
  }

  function renderLeftNav(section) {
    var groups = LEFT_NAV_DATA[section] || LEFT_NAV_DATA['public'];
    var html   =
      '<nav class="left-nav" aria-label="Section navigation">' +
      '<button class="left-nav__mobile-toggle" id="left-nav-mobile-toggle" ' +
      'aria-expanded="false" aria-controls="left-nav-sections">' +
      'Sections <span aria-hidden="true">&#9660;</span></button>' +
      '<div class="left-nav__sections" id="left-nav-sections">';

    groups.forEach(function (group) {
      html += '<div class="left-nav__group">' +
        '<p class="left-nav__label">' + escH(group.label) + '</p>' +
        '<ul class="left-nav__list">';

      group.items.forEach(function (it) {
        if (it.collapsible && it.sub) {
          /* <details> collapsible section */
          var open = it.sub.some(function (s) { return isActive(s.href); });
          html += '<li class="left-nav__item"><details class="left-nav__details"' +
            (open ? ' open' : '') + '>' +
            '<summary class="left-nav__summary">' + escH(it.label) + '</summary>' +
            '<ul class="left-nav__sub">';
          it.sub.forEach(function (s) { html += renderSubItem(s); });
          html += '</ul></details></li>';

        } else if (it.sub) {
          /* Parent link with always-visible sub-items */
          var parentActive = isActive(it.href);
          html += '<li class="left-nav__item left-nav__item--parent">' +
            '<a href="' + escA(it.href) + '"' +
            (parentActive ? ' class="active" aria-current="page"' : '') + '>' +
            escH(it.label) + '</a>' +
            '<ul class="left-nav__sub">';
          it.sub.forEach(function (s) { html += renderSubItem(s); });
          html += '</ul></li>';

        } else {
          /* Plain link */
          var active = isActive(it.href);
          html += '<li class="left-nav__item"><a href="' + escA(it.href || '#') + '"';
          if (it.logout) html += ' data-logout';
          if (active)    html += ' class="active" aria-current="page"';
          html += '>' + escH(it.label) + '</a></li>';
        }
      });

      html += '</ul></div>';
    });

    html += '</div></nav>';
    return html;
  }

  /* ── Body + nav-bar classes (UI only — not security) ─────────────────────────── */

  function setBodyClass(section) {
    document.body.classList.remove(
      'auth-public', 'auth-member', 'auth-admin', 'auth-no-role', 'nav-has-sidebar'
    );
    document.body.classList.add('auth-' + section);
    if (section === 'member' || section === 'admin') {
      document.body.classList.add('nav-has-sidebar');
    }
  }

  function applyNavTheme(section) {
    var nav = document.getElementById('site-nav');
    if (!nav) return;
    nav.classList.remove('nav--member', 'nav--admin');
    if (section === 'member' || section === 'no-role') nav.classList.add('nav--member');
    if (section === 'admin')  nav.classList.add('nav--admin');
  }

  /* ── Left-nav container injection ────────────────────────────────────────────── */

  function ensureLeftNav() {
    if (document.body.dataset.noSidenav) {
      log('ensureLeftNav: skipped (data-no-sidenav)');
      return;
    }
    if (document.getElementById('site-left-nav')) return;
    var main = document.getElementById('main-content');
    if (!main) {
      log('ensureLeftNav: #main-content not found');
      return;
    }
    var aside = document.createElement('aside');
    aside.id = 'site-left-nav';
    aside.setAttribute('aria-label', 'Section navigation');
    if (main.parentElement && main.parentElement.classList.contains('site-body')) {
      main.parentElement.insertBefore(aside, main);
    } else {
      var wrap = document.createElement('div');
      wrap.className = 'site-body';
      main.parentNode.insertBefore(wrap, main);
      wrap.appendChild(aside);
      wrap.appendChild(main);
    }
    log('ensureLeftNav: injected');
  }

  /* ── Mobile toggles ──────────────────────────────────────────────────────────── */

  function initMobileMenu() {
    var tog  = document.querySelector('#site-nav .nav-toggle');
    var list = document.querySelector('#site-nav .nav-list');
    if (!tog || !list) return;
    var fresh = tog.cloneNode(true);
    tog.parentNode.replaceChild(fresh, tog);
    fresh.addEventListener('click', function () {
      list.classList.toggle('nav-open');
      fresh.setAttribute('aria-expanded', String(list.classList.contains('nav-open')));
    });
  }

  function initLeftNavMobile() {
    var tog  = document.getElementById('left-nav-mobile-toggle');
    var secs = document.getElementById('left-nav-sections');
    if (!tog || !secs) return;
    var fresh = tog.cloneNode(true);
    tog.parentNode.replaceChild(fresh, tog);
    fresh.addEventListener('click', function () {
      secs.classList.toggle('is-open');
      fresh.setAttribute('aria-expanded', String(secs.classList.contains('is-open')));
    });
  }

  if (!window._nwkEscapeAdded) {
    window._nwkEscapeAdded = true;
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var list = document.querySelector('#site-nav .nav-list');
      if (list && list.classList.contains('nav-open')) {
        list.classList.remove('nav-open');
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

  /* ── Core nav update (synchronous) ──────────────────────────────────────────── */

  function updateNav(user) {
    var section = getAuthSection(user);
    var roles   = user && user.app_metadata && user.app_metadata.roles;
    log('updateNav section=' + section + ' roles=' + JSON.stringify(roles));

    setBodyClass(section);
    ensureLeftNav();

    var navEl     = document.getElementById('site-nav');
    var leftNavEl = document.getElementById('site-left-nav');

    if (navEl)     navEl.innerHTML     = renderTopNav(section);
    if (leftNavEl) leftNavEl.innerHTML = renderLeftNav(section);

    applyNavTheme(section);
    initMobileMenu();
    if (leftNavEl) initLeftNavMobile();

    log('nav rendered for section=' + section);
  }

  /* ── Logout button (event delegation) ───────────────────────────────────────── */

  if (!window._nwkLogoutAdded) {
    window._nwkLogoutAdded = true;
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-logout]');
      if (el && window.netlifyIdentity) {
        e.preventDefault();
        log('logout clicked');
        netlifyIdentity.logout();
      }
    });
  }

  /* ── HTML loader (header/footer only) ────────────────────────────────────────── */

  function loadHTML(selector, url) {
    var el = document.querySelector(selector);
    if (!el) return Promise.resolve();
    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (html) { el.innerHTML = html; })
      .catch(function (err) {
        console.warn('NWK: failed to load ' + url + ':', err.message);
      });
  }

  /* ── Identity handlers ───────────────────────────────────────────────────────── */

  var _handlersRegistered = false;

  function registerIdentityHandlers() {
    if (_handlersRegistered) return;
    _handlersRegistered = true;
    log('registering identity handlers');

    netlifyIdentity.on('init', function (user) {
      log('on(init) user=' + (user ? user.email : 'null'));
      updateNav(user);
    });

    netlifyIdentity.on('login', function (user) {
      log('on(login) user=' + (user ? user.email : 'null'));
      updateNav(user);
    });

    netlifyIdentity.on('logout', function () {
      log('on(logout)');
      updateNav(null);
      window.location.href = '/';
    });
  }

  /* ── Widget detection + immediate currentUser() render ──────────────────────── */
  /*                                                                                */
  /* KEY FIX: When the widget is detected (whether immediately or via polling),     */
  /* we ALWAYS call currentUser() immediately and render the nav based on that.     */
  /*                                                                                */
  /* Reason: The 'init' event may have already fired before our handler was         */
  /* registered (when the widget is loaded async and fires 'init' immediately from  */
  /* localStorage). currentUser() returns the same user that 'init' would have      */
  /* provided — so checking it after widget detection is equivalent.                */
  /*                                                                                */
  /* The on('init') handler registered above serves as a verification pass: if the  */
  /* token is expired, 'init' fires with null and corrects any stale localStorage.  */

  function onWidgetReady() {
    registerIdentityHandlers();
    var user = netlifyIdentity.currentUser() || null;
    log('widget ready, currentUser=' + (user ? user.email : 'null'));
    updateNav(user);
  }

  function loadIdentityWidget() {
    if (window.netlifyIdentity) return;
    if (document.querySelector('script[src*="netlify-identity-widget"]')) return;
    var s = document.createElement('script');
    s.src = 'https://identity.netlify.com/v1/netlify-identity-widget.js';
    s.async = true;
    document.head.appendChild(s);
  }

  function pollForIdentity() {
    if (window.netlifyIdentity) {
      log('widget already present — calling onWidgetReady immediately');
      onWidgetReady();
      return;
    }
    var tries = 0;
    var poll = setInterval(function () {
      if (window.netlifyIdentity) {
        clearInterval(poll);
        log('widget detected after ~' + (tries * 50) + 'ms — calling onWidgetReady');
        onWidgetReady();
      } else if (++tries >= 100) {
        clearInterval(poll);
        console.warn('NWK: identity widget did not load after 5s. Nav will stay public.');
      }
    }, 50);
  }

  /* ── Initialisation ──────────────────────────────────────────────────────────── */

  function init() {
    log('init()');

    /* Expose globally for identity.js and browser console */
    window.NWK = window.NWK || {};
    window.NWK.updateNav      = updateNav;
    window.NWK.getAuthSection = getAuthSection;
    window.NWK.log            = log;

    /* Render public nav immediately — no async, no blank state */
    updateNav(null);
    log('initial public nav rendered');

    /* Header and footer (auth-independent — fetched async, no nav dependency) */
    loadHTML('#site-header', '/assets/components/site-header.html');
    loadHTML('#site-footer', '/assets/components/site-footer.html');

    /* Load identity widget and render correct nav once auth state is known */
    loadIdentityWidget();
    pollForIdentity();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
