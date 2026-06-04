/**
 * NWK Identity — login-page redirect logic only.
 *
 * components.js owns ALL nav rendering (updateNav, on-init/login/logout handlers,
 * data-logout click). This script owns only:
 *   • Auto-opening the login modal on /login/
 *   • Post-login redirect to /member/dashboard/ (or ?redirect= target)
 *   • Loop detection for role-blocked users
 *   • Post-login redirect on non-login pages (invite flow)
 */
(function () {
  'use strict';

  var DASHBOARD     = '/member/dashboard/';
  var ACCESS_DENIED = '/access-denied/';
  var REDIRECT_KEY  = 'nwk_redirect_attempt';

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

  function setup() {
    var isLoginPage = window.location.pathname.indexOf('/login') === 0;

    if (isLoginPage) {
      var btn = document.getElementById('login-open-btn');
      if (btn) {
        btn.addEventListener('click', function () { netlifyIdentity.open('login'); });
      }

      /* On login page: if already logged in redirect away; if not, open modal */
      netlifyIdentity.on('init', function (user) {
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
        netlifyIdentity.open('login');
      });

      /* On login page: after login redirect to ?redirect or dashboard */
      netlifyIdentity.on('login', function () {
        netlifyIdentity.close();
        var p    = new URLSearchParams(window.location.search);
        var dest = p.get('redirect');
        sessionStorage.removeItem(REDIRECT_KEY);
        window.location.href = dest ? decodeURIComponent(dest) : DASHBOARD;
      });

    } else {
      /* Non-login pages: after login (invite flow etc.) redirect to dashboard */
      netlifyIdentity.on('login', function () {
        netlifyIdentity.close();
        window.location.href = DASHBOARD;
      });
    }
  }

  function waitAndSetup() {
    if (window.netlifyIdentity) { setup(); return; }
    var tries = 0;
    var poll = setInterval(function () {
      if (window.netlifyIdentity) {
        clearInterval(poll);
        setup();
      } else if (++tries >= 100) {
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
