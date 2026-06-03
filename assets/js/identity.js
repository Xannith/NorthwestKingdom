/**
 * NWK Identity
 * Netlify Identity event handlers: login redirect, logout, invite/confirmation flow.
 *
 * LOADING ORDER REQUIREMENT:
 *   The Netlify Identity Widget script must be loaded before this script runs.
 *   On login/index.html and index.html, the widget is loaded in <head> as a blocking
 *   script. On all other pages, components.js loads it dynamically (async) — the
 *   polling fallback below handles that case.
 *
 * ROLE ASSIGNMENT NOTE:
 *   netlify.toml redirect conditions check app_metadata.roles — NOT user_metadata.
 *   In the Netlify dashboard: Identity → Users → select user → App metadata → set:
 *     {"roles": ["admin"]}    or    {"roles": ["member"]}
 *   Setting a role in "User metadata" has NO effect on redirect access control.
 */
(function () {
  'use strict';

  var DASHBOARD = '/member/dashboard/';
  var ACCESS_DENIED = '/access-denied/';
  var REDIRECT_KEY = 'nwk_redirect_attempt'; /* sessionStorage key for loop detection */

  /* ── Redirect after a successful login ─────────────────────────────────────
     Runs from ANY page. Needed so invite links (which land on the homepage)
     redirect the user to the member dashboard after they set their password.    */
  function onLogin() {
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

  /* ── Detect redirect loops for already-logged-in users ─────────────────────
     When a user is logged in but lacks the required role:
       1. They visit /member/dashboard/
       2. Netlify CDN redirects them to /login/?redirect=/member/dashboard/
       3. identity.js init sees they're logged in → redirects to /member/dashboard/
       4. Netlify CDN redirects them again → LOOP
     Detection: use document.referrer (cleared in private mode) + sessionStorage fallback. */
  function redirectWithLoopDetection(dest) {
    var decoded = decodeURIComponent(dest);
    var referrerLoop = document.referrer && document.referrer.indexOf(decoded) !== -1;
    var sessionLoop  = sessionStorage.getItem(REDIRECT_KEY) === decoded;

    if (referrerLoop || sessionLoop) {
      sessionStorage.removeItem(REDIRECT_KEY);
      window.location.href = ACCESS_DENIED;
    } else {
      sessionStorage.setItem(REDIRECT_KEY, decoded);
      window.location.href = decoded;
    }
  }

  function setup() {

    /* ── Logout ─────────────────────────────────────────────────────────────── */
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-logout]');
      if (el) {
        e.preventDefault();
        netlifyIdentity.logout();
      }
    });

    netlifyIdentity.on('logout', function () {
      window.location.href = '/';
    });

    /* ── Login ──────────────────────────────────────────────────────────────── */
    netlifyIdentity.on('login', onLogin);

    /* ── Login-page-specific init behaviour ─────────────────────────────────── */
    var isLoginPage = window.location.pathname.indexOf('/login') === 0;
    if (isLoginPage) {
      var btn = document.getElementById('login-open-btn');
      if (btn) {
        btn.addEventListener('click', function () {
          netlifyIdentity.open('login');
        });
      }

      netlifyIdentity.on('init', function (user) {
        if (user) {
          /* Already authenticated — redirect, with loop detection */
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
        /* Not logged in: auto-open the login modal */
        netlifyIdentity.open('login');
      });
    }
  }

  /* ── Bootstrap ───────────────────────────────────────────────────────────────
     Case A: widget loaded in <head> (login page, homepage) — available immediately.
     Case B: widget loaded async by components.js (all other pages) — need to poll. */
  function waitAndSetup() {
    if (window.netlifyIdentity) {
      setup();
      return;
    }
    var tries = 0;
    var poll  = setInterval(function () {
      if (window.netlifyIdentity) {
        clearInterval(poll);
        setup();
      } else if (++tries >= 100) { /* give up after ~5 s */
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
