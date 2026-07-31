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

      var redirecting = false;
      var modalOpened = false;

      /* If already logged in redirect away; if not, open the login modal.
         Called with currentUser() immediately (the 'init' event may have fired
         before this script registered a handler — same race components.js
         already guards against) and again from on('init') as a backup. */
      function handleLoginState(user) {
        if (user) {
          if (redirecting) return;
          redirecting = true;
          /* Being here logged-in usually means the CDN bounced us because the
             nf_jwt cookie expired. Force a token refresh first — the Identity
             server re-issues the cookie in its response — otherwise the
             redirect back would bounce us straight into the loop detector. */
          user.jwt(true).then(function () {
            var p = new URLSearchParams(window.location.search);
            var dest = p.get('redirect');
            if (dest) {
              redirectWithLoopDetection(dest);
            } else {
              sessionStorage.removeItem(REDIRECT_KEY);
              window.location.href = DASHBOARD;
            }
          }, function (err) {
            /* Session is dead (revoked/failed refresh) — let them log in. */
            console.warn('NWK: token refresh failed:', err);
            redirecting = false;
            netlifyIdentity.open('login');
          });
          return;
        }
        if (!modalOpened) {
          modalOpened = true;
          netlifyIdentity.open('login');
        }
      }

      handleLoginState(netlifyIdentity.currentUser());
      netlifyIdentity.on('init', handleLoginState);

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
            btn.textContent = 'Login widget could not load, try refreshing.';
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
