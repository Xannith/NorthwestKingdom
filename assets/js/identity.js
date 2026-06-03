/**
 * NWK Identity
 * Handles Netlify Identity login, logout, and redirect flows.
 *
 * The Netlify Identity Widget is loaded dynamically by components.js.
 * This script polls until the widget is available, then attaches handlers.
 *
 * Dashboard setup required (one-time, in Netlify):
 *   Site → Identity → Enable Identity
 *   Identity → Registration → Set to "Invite only"
 *   Identity → Invite user → enter email → assign role: member or admin
 */
(function () {
  'use strict';

  function setup() {
    var isLoginPage = window.location.pathname.indexOf('/login') === 0;

    /* Logout — use event delegation so it works after nav is injected */
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

    /* Login page behaviour */
    if (isLoginPage) {
      var loginBtn = document.getElementById('login-open-btn');
      var loginLoading = document.getElementById('login-loading');

      netlifyIdentity.on('init', function (user) {
        if (user) {
          /* Already authenticated — send them to their destination */
          var p = new URLSearchParams(window.location.search);
          window.location.href = decodeURIComponent(p.get('redirect') || '/member/dashboard/');
          return;
        }
        /* Open the login modal automatically */
        netlifyIdentity.open('login');
        /* Show fallback button in case modal is dismissed */
        if (loginLoading) loginLoading.hidden = true;
        if (loginBtn) loginBtn.hidden = false;
      });

      netlifyIdentity.on('login', function () {
        netlifyIdentity.close();
        var p = new URLSearchParams(window.location.search);
        window.location.href = decodeURIComponent(p.get('redirect') || '/member/dashboard/');
      });

      if (loginBtn) {
        loginBtn.addEventListener('click', function () {
          netlifyIdentity.open('login');
        });
      }
    }
  }

  /* Poll until the Identity Widget becomes available (loaded async by components.js) */
  function waitAndSetup() {
    if (window.netlifyIdentity) {
      setup();
      return;
    }
    var tries = 0;
    var poll = setInterval(function () {
      tries++;
      if (window.netlifyIdentity) {
        clearInterval(poll);
        setup();
      } else if (tries >= 100) { /* give up after ~5 s */
        clearInterval(poll);
      }
    }, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitAndSetup);
  } else {
    waitAndSetup();
  }
})();
