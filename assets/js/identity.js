/**
 * NWK Identity
 * Netlify Identity event handlers: nav update, login redirect, logout.
 *
 * The Netlify Identity Widget must be loaded before this script.
 * login/index.html and index.html load it as a blocking <script> in <head>.
 * All other pages get it via components.js (async); polling handles that case.
 *
 * NAV UPDATE CONTRACT
 *   components.js exposes window.NWK.updateNav(user).
 *   identity.js calls it on every auth-state change so the nav always reflects
 *   who is logged in, regardless of which page the user is on.
 *
 * ROLE ASSIGNMENT REMINDER
 *   Redirect rules in netlify.toml check app_metadata.roles — NOT user_metadata.
 *   Dashboard: Identity → Users → select user → App metadata → {"roles":["admin"]}
 */
(function () {
  'use strict';

  var DASHBOARD    = '/member/dashboard/';
  var ACCESS_DENIED = '/access-denied/';
  var REDIRECT_KEY = 'nwk_redirect_attempt';

  /* ── Post-login redirect ──────────────────────────────────────────────────── */

  function onLogin(user) {
    /* Update nav before navigating (fast for pages with widget in <head>) */
    if (window.NWK && window.NWK.updateNav) window.NWK.updateNav(user);
    netlifyIdentity.close();

    var isLoginPage = window.location.pathname.indexOf('/login') === 0;
    if (isLoginPage) {
      var p = new URLSearchParams(window.location.search);
      var dest = p.get('redirect');
      sessionStorage.removeItem(REDIRECT_KEY);
      window.location.href = dest ? decodeURIComponent(dest) : DASHBOARD;
    } else {
      window.location.href = DASHBOARD;
    }
  }

  /* ── Loop detection (logged-in user blocked by role check) ────────────────── */

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

  /* ── Core setup — called once the Identity Widget is available ────────────── */

  function setup() {
    var isLoginPage = window.location.pathname.indexOf('/login') === 0;

    /* Logout via data-logout attribute (event delegation — works after nav inject) */
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-logout]');
      if (el) {
        e.preventDefault();
        netlifyIdentity.logout();
      }
    });

    netlifyIdentity.on('logout', function () {
      if (window.NWK && window.NWK.updateNav) window.NWK.updateNav(null);
      window.location.href = '/';
    });

    /* Login — registered on every page so invite flow works from homepage too */
    netlifyIdentity.on('login', onLogin);

    /* Init — registered on EVERY page, not just login.
       This is what makes the nav update when a returning user visits any page. */
    netlifyIdentity.on('init', function (user) {
      /* Always update nav to reflect current auth state */
      if (window.NWK && window.NWK.updateNav) {
        window.NWK.updateNav(user);
      }

      /* Login-page specific behaviour */
      if (isLoginPage) {
        if (user) {
          var p = new URLSearchParams(window.location.search);
          var dest = p.get('redirect');
          if (dest) {
            redirectWithLoopDetection(dest);
          } else {
            sessionStorage.removeItem(REDIRECT_KEY);
            window.location.href = DASHBOARD;
          }
          return;
        }
        /* Not logged in: open login modal */
        netlifyIdentity.open('login');
      }
    });

    /* Login-page button */
    if (isLoginPage) {
      var btn = document.getElementById('login-open-btn');
      if (btn) {
        btn.addEventListener('click', function () { netlifyIdentity.open('login'); });
      }
    }
  }

  /* ── Bootstrap ────────────────────────────────────────────────────────────── */

  function waitAndSetup() {
    if (window.netlifyIdentity) {
      setup();
      return;
    }
    /* Widget loaded async by components.js — poll until available */
    var tries = 0;
    var poll = setInterval(function () {
      if (window.netlifyIdentity) {
        clearInterval(poll);
        setup();
      } else if (++tries >= 100) {   /* give up after ~5 s */
        clearInterval(poll);
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
