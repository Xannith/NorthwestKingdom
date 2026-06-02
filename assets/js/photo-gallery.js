/**
 * photo-gallery.js
 * Loads /data/photo-submissions.json and renders the NWK photo gallery.
 *
 * Pages using this script add:
 *   <div id="photo-gallery" data-category="events">   (category filter, or omit for "all")
 *   <div id="gallery-filters">                         (filter controls, optional)
 *
 * Only entries with status="published" and visibility="public" are shown.
 */
(function () {
  'use strict';

  var DATA_URL = '/data/photo-submissions.json';

  var CATEGORY_LABELS = {
    'events':          'Events',
    'land-and-nature': 'Land and Nature',
    'history':         'History',
    'general':         'General'
  };

  /* ── Utilities ─────────────────────────────────────────── */

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatYear(dateStr) {
    if (!dateStr) return '';
    return dateStr.slice(0, 4);
  }

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name) || '';
  }

  /* ── Data loading ──────────────────────────────────────── */

  function loadPhotos(callback) {
    fetch(DATA_URL)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        callback(null, Array.isArray(data.photos) ? data.photos : []);
      })
      .catch(function (err) {
        callback(err, []);
      });
  }

  /* ── Filtering ─────────────────────────────────────────── */

  function filterPhotos(photos, category, year, search) {
    return photos.filter(function (p) {
      if (p.status !== 'published') return false;
      if (p.visibility !== 'public') return false;
      if (category && p.category !== category) return false;
      if (year && formatYear(p.dateTaken) !== year) return false;
      if (search) {
        var haystack = [p.title, p.caption, (p.tags || []).join(' '), p.location, p.photographer]
          .join(' ').toLowerCase();
        if (haystack.indexOf(search.toLowerCase()) === -1) return false;
      }
      return true;
    });
  }

  /* ── Rendering ─────────────────────────────────────────── */

  function renderPhotoCard(photo) {
    var altText = escHtml(photo.title || photo.caption || 'NWK photo');
    var imgSrc  = escHtml(photo.path || '');
    var tags    = (photo.tags || []).map(function (t) {
      return '<span class="photo-tag">' + escHtml(t.trim()) + '</span>';
    }).join('');

    var infoItems = [];
    if (photo.photographer) infoItems.push('<span>&#128247; ' + escHtml(photo.photographer) + '</span>');
    if (photo.dateTaken)    infoItems.push('<span>' + escHtml(formatYear(photo.dateTaken)) + '</span>');

    var categoryLabel = CATEGORY_LABELS[photo.category] || escHtml(photo.category || '');

    return [
      '<article class="photo-card">',
      '  <div class="photo-card__img-wrap">',
      '    <img src="' + imgSrc + '" alt="' + altText + '" loading="lazy">',
      '  </div>',
      '  <div class="photo-card__meta">',
      '    <p class="photo-card__category">' + categoryLabel + '</p>',
      '    <h3 class="photo-card__title">' + escHtml(photo.title) + '</h3>',
      photo.caption ? '    <p class="photo-card__caption">' + escHtml(photo.caption) + '</p>' : '',
      tags          ? '    <div class="photo-card__tags">' + tags + '</div>' : '',
      infoItems.length ? '    <div class="photo-card__info">' + infoItems.join('') + '</div>' : '',
      '  </div>',
      '</article>'
    ].filter(Boolean).join('\n');
  }

  function renderEmpty(category) {
    var label = category ? (CATEGORY_LABELS[category] || category) : '';
    var heading = label ? (label + ' photos') : 'Photos';
    return [
      '<div class="gallery-empty">',
      '  <div class="gallery-empty__icon" aria-hidden="true">&#127956;</div>',
      '  <p class="gallery-empty__title">No ' + escHtml(heading) + ' yet</p>',
      '  <p>Photos shared by Northwest Kingdom residents will appear here.</p>',
      '  <a href="/public/photos/submit-photo.html" class="btn btn--primary">Submit a photo</a>',
      '</div>'
    ].join('\n');
  }

  function renderResults(photos, container, category) {
    if (photos.length === 0) {
      container.innerHTML = renderEmpty(category);
      return;
    }
    container.innerHTML = '<div class="photo-grid">' +
      photos.map(renderPhotoCard).join('\n') +
      '</div>';
  }

  /* ── Filter controls ───────────────────────────────────── */

  function buildYearOptions(photos) {
    var years = {};
    photos.forEach(function (p) {
      var y = formatYear(p.dateTaken);
      if (y) years[y] = true;
    });
    return Object.keys(years).sort().reverse();
  }

  function buildCategoryOptions(photos) {
    var cats = {};
    photos.forEach(function (p) { if (p.category) cats[p.category] = true; });
    return Object.keys(cats).sort();
  }

  function initFilters(container, allPublicPhotos, pageCategory, onFilterChange) {
    if (!container) return;

    var yearSelect = container.querySelector('[data-filter="year"]');
    var catSelect  = container.querySelector('[data-filter="category"]');
    var searchInput = container.querySelector('[data-filter="search"]');

    /* Populate year options dynamically */
    if (yearSelect) {
      buildYearOptions(allPublicPhotos).forEach(function (y) {
        var opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
      });
    }

    /* Populate category options if this is the "all" page */
    if (catSelect && !pageCategory) {
      buildCategoryOptions(allPublicPhotos).forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = c;
        opt.textContent = CATEGORY_LABELS[c] || c;
        catSelect.appendChild(opt);
      });
      /* Restore from URL */
      var urlCat = getParam('category');
      if (urlCat) catSelect.value = urlCat;
    } else if (catSelect && pageCategory) {
      /* Lock to current page's category */
      catSelect.value = pageCategory;
      catSelect.disabled = true;
    }

    /* Restore year from URL */
    if (yearSelect && getParam('year')) yearSelect.value = getParam('year');
    if (searchInput && getParam('q'))   searchInput.value = getParam('q');

    function getFilters() {
      return {
        category: catSelect  ? (catSelect.value  || pageCategory || '') : (pageCategory || ''),
        year:     yearSelect ? (yearSelect.value  || '') : '',
        search:   searchInput ? (searchInput.value.trim() || '') : ''
      };
    }

    function onChange() { onFilterChange(getFilters()); }

    if (yearSelect)  yearSelect.addEventListener('change', onChange);
    if (catSelect)   catSelect.addEventListener('change', onChange);
    if (searchInput) searchInput.addEventListener('input', onChange);

    /* Trigger initial render with URL params */
    onFilterChange(getFilters());
  }

  /* ── Result count ──────────────────────────────────────── */

  function updateResultsInfo(infoEl, count, total) {
    if (!infoEl) return;
    infoEl.textContent = count === total
      ? (count === 0 ? '' : count + ' photo' + (count !== 1 ? 's' : ''))
      : 'Showing ' + count + ' of ' + total + ' photo' + (total !== 1 ? 's' : '');
  }

  /* ── Init ──────────────────────────────────────────────── */

  function init() {
    var galleryEl   = document.getElementById('photo-gallery');
    var filtersEl   = document.getElementById('gallery-filters');
    var infoEl      = document.getElementById('gallery-results-info');
    var loadingEl   = document.getElementById('gallery-loading');

    if (!galleryEl) return;

    var pageCategory = galleryEl.dataset.category || '';

    loadPhotos(function (err, photos) {
      if (loadingEl) loadingEl.hidden = true;

      var allPublicPhotos = photos.filter(function (p) {
        return p.status === 'published' && p.visibility === 'public';
      });

      if (err) {
        /* Silently show empty state — JSON may just not exist yet */
        renderResults([], galleryEl, pageCategory);
        return;
      }

      function applyFilters(filters) {
        var filtered = filterPhotos(allPublicPhotos, filters.category, filters.year, filters.search);
        renderResults(filtered, galleryEl, pageCategory);
        updateResultsInfo(infoEl, filtered.length, allPublicPhotos.length);
      }

      initFilters(filtersEl, allPublicPhotos, pageCategory, applyFilters);

      /* If no filter controls, just render directly */
      if (!filtersEl) {
        var filtered = filterPhotos(allPublicPhotos, pageCategory, '', '');
        renderResults(filtered, galleryEl, pageCategory);
        updateResultsInfo(infoEl, filtered.length, allPublicPhotos.length);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
