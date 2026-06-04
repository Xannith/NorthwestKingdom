/**
 * NWK Identity — login-page redirect logic only.
 *
 * Nav updates, logout redirect, and data-logout handling are ALL in components.js,
 * which is loaded on every page. This script only needs to be on pages that
 * require login-specific behaviour: modal auto-open, post-login redirect,
 * loop detection for role-blocked users.
 *
 * Currently loaded on: index.html, login/index.html, member/dashboard/index.html,
 * admin/index.html, access-denied/index.html.
 *
 * The Netlify Identity Widget must already be loaded (either via blocking <script>
 * in <head>, or via components.js's dynamic loader + polling).
 */
(function () {
  'use strict';

  var DASHBOARD     = '/member/dashboard/';
  var ACCESS_DENIED = '/access-denied/';
  var REDIRECT_KEY  = 'nwk_redirect_attempt';

  /* ── Loop detection ─────────────────────────────────────────────────────────
     Prevents infinite redirect when a logged-in user lacks the required role:
       1. User visits /member/dashboard/ without the right role
       2. Netlify CDN redirects → /login/?redirect=/member/dashboard/
       3. identity.js sees user is logged in → tries to redirect to /member/dashboard/
       4. Netlify CDN redirects again → loop
     Detection: document.referrer (clears in private mode) + sessionStorage fallback. */
  function redirectWithLoopDetection(dest) {
    var decoded = decodeURIComponent(dest);
    var refLoop     = document.referrer && document.referrer.indexOf(decoded) !== -1;
    var sessionLoop = sessionStorage.getItem(REDIRECT_KEY) === decoded;
    if (refLoop || sessionLoop) {
      sessionStorage.removeItem(REDIRECT_KEY);
      window.location.href = ACCESS_DENIED;
    } else {
      sessionStorage.setItem(REDIRECT_KEY, decoded);
      window.location.href = decoded;
    }
  }

  /* ── Setup — called once the Identity Widget is available ──────────────────── */

  function setup() {
    var isLoginPage = window.location.pathname.indexOf('/login') === 0;

    if (isLoginPage) {
      /* Show "Open Login Form" button and auto-open the modal */
      var btn = document.getElementById('login-open-btn');
      if (btn) {
        btn.addEventListener('click', function () { netlifyIdentity.open('login'); });
      }

      /* Init on login page: redirect if already logged in, open modal if not */
      netlifyIdentity.on('init', function (user) {
        if (user) {
          var p    = new URLSearchParams(window.location.search);
          var dest = p.get('redirect');
          if (dest) {
            redirectWithLoopDetection(dest);
          } else {
            sessionStorage.removeItem(REDIRECT_KEY);
            window.location.href = DASHBOARD;
          }
          return;
        }
        /* Not logged in: auto-open login modal */
        netlifyIdentity.open('login');
      });

      /* Login on login page: redirect to ?redirect param or dashboard */
      netlifyIdentity.on('login', function () {
        netlifyIdentity.close();
        var p    = new URLSearchParams(window.location.search);
        var dest = p.get('redirect');
        sessionStorage.removeItem(REDIRECT_KEY);
        window.location.href = dest ? decodeURIComponent(dest) : DASHBOARD;
      });

    } else {
      /* Non-login page (homepage, etc.): after invite/login, redirect to dashboard.
         components.js has already registered on('login') to update the nav.
         This handler adds the redirect on top of that. */
      netlifyIdentity.on('login', function () {
        netlifyIdentity.close();
        window.location.href = DASHBOARD;
      });
    }
  }

  /* ── Bootstrap ──────────────────────────────────────────────────────────────── */

  function waitAndSetup() {
    if (window.netlifyIdentity) { setup(); return; }
    var tries = 0;
    var poll = setInterval(function () {
      if (window.netlifyIdentity) {
        clearInterval(poll);
        setup();
      } else if (++tries >= 100) {
        clearInterval(poll);
        /* Login page fallback: show error on button if widget never loads */
        if (window.location.pathname.indexOf('/login') === 0) {
          var btn = document.getElementById('login-open-btn');
          if (btn) {
            btn.textContent = 'Login widget could not load — try refreshing.';
            btn.disabled = true;
          }
        }
      }
    }, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitAndSetup);
  } else {
    waitAndSetup();
  }
})();
