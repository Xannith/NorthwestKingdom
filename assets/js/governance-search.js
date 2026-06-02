\
/**
 * governance-search.js
 * Client-side search for governance documents using MiniSearch.
 * Loaded only on the governance index page.
 */
(function () {
  'use strict';

  var searchInput   = document.getElementById('gov-search-input');
  var resultsBox    = document.getElementById('gov-search-results');
  var docListing    = document.getElementById('gov-doc-listing');
  if (!searchInput || !resultsBox) return;

  var miniSearch = new MiniSearch({
    fields:       ['title', 'body'],
    storeFields:  ['title', 'url', 'category', 'body'],
    searchOptions: {
      boost:  { title: 3 },
      prefix: true,
      fuzzy:  0.15,
    },
  });

  var INDEX_URL = '/governance/search-index.json';
  var loaded = false;

  function loadIndex() {
    if (loaded) return Promise.resolve();
    return fetch(INDEX_URL)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        miniSearch.addAll(data);
        loaded = true;
      });
  }

  function snippet(body, query, maxLen) {
    maxLen = maxLen || 160;
    var words = query.toLowerCase().split(/\s+/).filter(Boolean);
    var lbody = body.toLowerCase();
    var best  = -1;
    words.forEach(function (w) {
      var idx = lbody.indexOf(w);
      if (idx !== -1 && (best === -1 || idx < best)) best = idx;
    });
    if (best === -1) return body.slice(0, maxLen) + '…';
    var start = Math.max(0, best - 60);
    var end   = Math.min(body.length, start + maxLen);
    var s     = (start > 0 ? '…' : '') + body.slice(start, end) + (end < body.length ? '…' : '');
    words.forEach(function (w) {
      var re = new RegExp('(' + w.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + ')', 'gi');
      s = s.replace(re, '<mark>$1</mark>');
    });
    return s;
  }

  function renderResults(results, query) {
    if (results.length === 0) {
      resultsBox.innerHTML = '<p class="gov-search__no-results">No documents matched <em>' +
        escHtml(query) + '</em>.</p>';
    } else {
      resultsBox.innerHTML = results.map(function (r) {
        var catLabel = r.category === 'governing' ? 'Governing Document' : 'Policy';
        return '<a href="' + r.url + '" class="gov-search__result" role="option">' +
          '<span class="gov-search__result-title">' + escHtml(r.title) + '</span>' +
          '<span class="gov-search__result-cat">' + catLabel + '</span>' +
          '<span class="gov-search__result-snippet">' + snippet(r.body, query) + '</span>' +
          '</a>';
      }).join('');
    }
    resultsBox.hidden = false;
    searchInput.setAttribute('aria-expanded', 'true');
    docListing.hidden = true;
  }

  function showListing() {
    resultsBox.hidden = true;
    resultsBox.innerHTML = '';
    searchInput.setAttribute('aria-expanded', 'false');
    docListing.hidden = false;
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  var debounceTimer;
  searchInput.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    var q = searchInput.value.trim();
    if (!q) { showListing(); return; }
    debounceTimer = setTimeout(function () {
      loadIndex().then(function () {
        var results = miniSearch.search(q, { combineWith: 'OR' });
        renderResults(results.slice(0, 12), q);
      }).catch(function (err) {
        console.warn('Governance search index load failed:', err);
      });
    }, 150);
  });

  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { searchInput.value = ''; showListing(); }
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('#gov-search-box')) showListing();
  });
})();
