/**
 * shirt-order.js
 * Client-side behavior for the public "I Gave" Community Shirts preorder page.
 *
 * Responsibilities:
 *   1. Line items — add/remove size+color+quantity rows for each product in a
 *      single order. Three products share the form:
 *        - classic "I Gave" shirt ($18, size + color)
 *        - Evergreen "I Gave" shirt ($20, size only, green)
 *        - "I Gave" 2026 button ($4, quantity only, one size)
 *   2. Live order total — per-product subtotals + grand total, shown before submit.
 *   3. Submission — serialize each product's line items into its own readable
 *      field and POST to Netlify Forms via AJAX (form name: "shirt-orders").
 *   4. Order Status — fetch data/shirt-order-rounds.json and render the rounds.
 *
 * This is a cash-commitment preorder, not a payment system. No card data is
 * collected or sent. Client-side validation is for UX only.
 *
 * Graceful degradation: if this script does not run, the page's static rows
 * submit natively to Netlify (see the <form> in /shirts/index.html). Each product
 * uses distinct field names so native submissions stay unambiguous.
 */
(function () {
  'use strict';

  /* Per-product config. Keyed by the container's data-product attribute.
     `field` is the Netlify hidden input the product's line items serialize into. */
  var PRODUCTS = {
    classic: { price: 18, unit: 'shirt',  name: '“I Gave” shirt',           field: 'order-items' },
    green:   { price: 20, unit: 'shirt',  name: '“I Gave” Evergreen shirt', color: 'Green', field: 'order-shirts-green' },
    button:  { price: 4,  unit: 'button', name: '“I Gave” 2026 button',     field: 'order-buttons' }
  };

  function $(id) { return document.getElementById(id); }

  function money(n) {
    return '$' + Number(n).toFixed(2);
  }

  function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  /* ── Line items ────────────────────────────────────────── */

  function initLineItems() {
    var containers = document.querySelectorAll('.shirt-lines');

    containers.forEach(function (container) {
      var addId  = container.getAttribute('data-add-btn');
      var addBtn = addId ? $(addId) : null;

      /* Capture a clean template from the first static row (before any edits). */
      var firstRow = container.querySelector('.shirt-line');
      if (!firstRow) return;
      var template = firstRow.cloneNode(true);

      function resetRow(row) {
        row.querySelectorAll('select').forEach(function (s) { s.selectedIndex = 0; });
        var qty = row.querySelector('.shirt-line__qty input');
        if (qty) qty.value = '1';
        return row;
      }

      function updateSingleFlag() {
        var rows = container.querySelectorAll('.shirt-line');
        if (rows.length <= 1) {
          container.setAttribute('data-single', '');
        } else {
          container.removeAttribute('data-single');
        }
      }

      function wireRow(row) {
        var remove = row.querySelector('.shirt-line__remove');
        if (remove) {
          remove.addEventListener('click', function () {
            var rows = container.querySelectorAll('.shirt-line');
            if (rows.length <= 1) return; /* never remove the last row */
            row.parentNode.removeChild(row);
            updateSingleFlag();
            recalcTotal();
          });
        }
        row.querySelectorAll('select, input').forEach(function (el) {
          el.addEventListener('input', recalcTotal);
          el.addEventListener('change', recalcTotal);
        });
      }

      /* Wire the existing static row. */
      wireRow(firstRow);
      updateSingleFlag();

      if (addBtn) {
        addBtn.addEventListener('click', function () {
          var row = resetRow(template.cloneNode(true));
          container.appendChild(row);
          wireRow(row);
          updateSingleFlag();
          recalcTotal();
          var firstField = row.querySelector('select, input');
          if (firstField) firstField.focus();
        });
      }
    });
  }

  /* Read every product's rows into a normalized order object. */
  function collectOrder() {
    var products = [];
    var grandQty = 0;
    var grandDollars = 0;

    document.querySelectorAll('.shirt-lines').forEach(function (container) {
      var key = container.getAttribute('data-product');
      var cfg = PRODUCTS[key];
      if (!cfg) return;

      var items = [];
      var qty = 0;

      container.querySelectorAll('.shirt-line').forEach(function (row) {
        var sizeEl  = row.querySelector('.shirt-line__size select');
        var colorEl = row.querySelector('.shirt-line__color select');
        var qtyEl   = row.querySelector('.shirt-line__qty input');
        var n = qtyEl ? parseInt(qtyEl.value, 10) : 0;

        if (!qtyEl || !n || n < 1) return;         /* qty 0 / blank → not ordered */
        if (sizeEl && !sizeEl.value) return;        /* size required when present */

        var size  = sizeEl ? sizeEl.value : '';
        var color = colorEl && colorEl.value ? colorEl.value : (cfg.color || '');

        var parts = [];
        if (size)  parts.push(size);
        if (color) parts.push(color);
        var label = parts.length ? parts.join(' ') : capitalize(cfg.unit);

        items.push({ size: size, color: color, qty: n, label: label });
        qty += n;
      });

      var dollars = qty * cfg.price;
      products.push({
        key: key,
        cfg: cfg,
        items: items,
        qty: qty,
        dollars: dollars,
        text: items.map(function (i) { return i.qty + 'x ' + i.label; }).join('; ')
      });

      grandQty += qty;
      grandDollars += dollars;
    });

    return { products: products, totalQty: grandQty, totalDollars: grandDollars };
  }

  function recalcTotal() {
    var order = collectOrder();
    var linesEl = $('order-total-lines');
    var amountEl = $('order-total-amount');
    var commitLabelEl = $('commit-amount');

    if (linesEl) {
      var rows = order.products.filter(function (p) { return p.qty > 0; }).map(function (p) {
        var unitLabel = p.qty === 1 ? p.cfg.unit : p.cfg.unit + 's';
        return '<li>' + p.qty + ' × ' + p.cfg.name + ' (' + p.qty + ' ' + unitLabel +
               ' @ ' + money(p.cfg.price) + ') <span>' + money(p.dollars) + '</span></li>';
      });
      linesEl.innerHTML = rows.length
        ? rows.join('')
        : '<li class="order-total__empty">No items selected yet.</li>';
    }

    if (amountEl) amountEl.textContent = money(order.totalDollars);
    if (commitLabelEl) commitLabelEl.textContent = money(order.totalDollars);
    return order;
  }

  /* ── Validation helpers ────────────────────────────────── */

  function setError(fieldId, errorId, message) {
    var field = $(fieldId);
    var err   = $(errorId);
    if (err) err.textContent = message || '';
    if (field) {
      var wrap = field.closest('.form-field') || field.parentElement;
      if (wrap) wrap.classList.toggle('form-field--error', !!message);
      field.setAttribute('aria-invalid', message ? 'true' : 'false');
    }
  }

  function phoneLooksValid(v) {
    var digits = (v || '').replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  }

  /* ── Submission (AJAX to Netlify Forms) ────────────────── */

  function encode(data) {
    return Object.keys(data).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(data[k]);
    }).join('&');
  }

  function initSubmit() {
    var form = $('shirt-order-form');
    if (!form) return;
    var submitBtn = $('shirt-submit-btn');
    var resultBox = $('shirt-submit-result');

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var order = recalcTotal();
      var nameEl   = $('shirt-name');
      var phoneEl  = $('shirt-phone');
      var commitEl = $('shirt-commitment');
      var valid = true;

      if (!nameEl.value.trim()) {
        setError('shirt-name', 'shirt-name-error', 'Please enter your name.');
        valid = false;
      } else {
        setError('shirt-name', 'shirt-name-error', '');
      }

      if (!phoneLooksValid(phoneEl.value)) {
        setError('shirt-phone', 'shirt-phone-error',
          'Please enter a phone number we can reach you at (at least 10 digits).');
        valid = false;
      } else {
        setError('shirt-phone', 'shirt-phone-error', '');
      }

      if (order.totalQty === 0) {
        setError('shirt-lines-anchor', 'shirt-lines-error',
          'Please choose at least one shirt or button (set a quantity of 1 or more).');
        valid = false;
      } else {
        setError('shirt-lines-anchor', 'shirt-lines-error', '');
      }

      if (!commitEl.checked) {
        setError('shirt-commitment', 'shirt-commitment-error',
          'Please confirm your cash commitment to place your order.');
        valid = false;
      } else {
        setError('shirt-commitment', 'shirt-commitment-error', '');
      }

      if (!valid) {
        var firstErr = form.querySelector('.form-field--error');
        if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      /* Populate hidden fields so a native submit (fallback) would also carry them. */
      order.products.forEach(function (p) {
        var el = $(p.cfg.field);
        if (el) el.value = p.text;
      });
      $('total-quantity').value = String(order.totalQty);
      $('total-dollars').value  = order.totalDollars.toFixed(2);

      var commitmentText =
        'I commit to paying ' + money(order.totalDollars) +
        ' in cash when my order is placed or at pickup.';

      var payload = {
        'form-name':      'shirt-orders',
        'name':           nameEl.value.trim(),
        'phone':          phoneEl.value.trim(),
        'total-quantity': String(order.totalQty),
        'total-dollars':  order.totalDollars.toFixed(2),
        'commitment':     commitmentText,
        'bot-field':      ''
      };
      order.products.forEach(function (p) { payload[p.cfg.field] = p.text; });

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('btn--loading');
        submitBtn.textContent = 'Submitting';
      }

      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encode(payload)
      })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          showConfirmation(order, nameEl.value.trim());
        })
        .catch(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('btn--loading');
            submitBtn.textContent = 'Submit my commitment';
          }
          if (resultBox) {
            resultBox.className = 'submit-result submit-result--error is-visible';
            resultBox.innerHTML =
              '<p class="submit-result__title">Sorry — that didn’t go through.</p>' +
              '<p>Your order was not submitted. Please check your connection and try ' +
              'again. Your entries have been kept below.</p>';
            resultBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
    });

    /* Live-clear field errors as the visitor corrects them. */
    ['shirt-name', 'shirt-phone'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', function () { setError(id, id + '-error', ''); });
    });
    var commit = $('shirt-commitment');
    if (commit) commit.addEventListener('change', function () {
      if (commit.checked) setError('shirt-commitment', 'shirt-commitment-error', '');
    });
  }

  function showConfirmation(order, name) {
    var form = $('shirt-order-form');
    var box  = $('shirt-submit-result');
    if (!box) return;

    var groups = order.products.filter(function (p) { return p.qty > 0; }).map(function (p) {
      var lines = p.items.map(function (i) {
        return '<li>' + i.qty + ' × ' + escapeHtml(i.label) + '</li>';
      }).join('');
      return '<p class="mb-0"><strong>' + escapeHtml(p.cfg.name) + '</strong></p>' +
             '<ul>' + lines + '</ul>';
    }).join('');

    var unitTotal = order.totalQty + ' item' + (order.totalQty === 1 ? '' : 's');

    box.className = 'submit-result submit-result--success is-visible';
    box.innerHTML =
      '<p class="submit-result__title">Thank you, ' + escapeHtml(name) + '! Your commitment is in.</p>' +
      '<p>You’ve committed to buy:</p>' +
      groups +
      '<p><strong>' + unitTotal + ' &mdash; ' + money(order.totalDollars) + ' total</strong>, ' +
      'payable in cash when your order is placed or at pickup.</p>' +
      '<p class="mb-0">Orders are placed in bulk rounds roughly every 3 weeks. ' +
      'We’ll contact you at the phone number you gave when the next round is ' +
      'placed so you can arrange payment and pickup. See the Order Status below for ' +
      'where things stand.</p>';

    if (form) form.style.display = 'none';
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    box.setAttribute('tabindex', '-1');
    box.focus();
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Order Status (rounds) ─────────────────────────────── */

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var STATUS_LABELS = {
    'upcoming':    'Upcoming',
    'collecting':  'Collecting now',
    'ordered':     'Ordered',
    'shipped':     'Shipped',
    'arrived':     'Arrived — ready for pickup',
    'distributed': 'Distributed'
  };

  /* Parse "YYYY-MM-DD" without timezone drift and format for display. */
  function formatDate(iso) {
    if (!iso || typeof iso !== 'string') return '';
    var m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso;
    var mi = parseInt(m[2], 10) - 1;
    if (mi < 0 || mi > 11) return iso;
    return MONTHS[mi] + ' ' + parseInt(m[3], 10) + ', ' + m[1];
  }

  function renderRounds() {
    var timeline = $('round-timeline');
    var fallback = $('round-status-fallback');
    if (!timeline) return;

    fetch('/data/shirt-order-rounds.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var campaignEl = $('round-campaign');
        var noteEl     = $('round-note');
        if (campaignEl && data.campaign) campaignEl.textContent = data.campaign;
        if (noteEl && data.note) noteEl.textContent = data.note;

        var rounds = Array.isArray(data.rounds) ? data.rounds : [];
        if (rounds.length === 0) throw new Error('no rounds');

        timeline.innerHTML = rounds.map(function (r) {
          var status = String(r.status || 'upcoming').toLowerCase();
          var label  = STATUS_LABELS[status] || STATUS_LABELS.upcoming;
          var cls    = STATUS_LABELS[status] ? status : 'upcoming';
          var detail = r.detail
            ? '<p class="round-card__detail">' + escapeHtml(r.detail) + '</p>' : '';
          return '' +
            '<div class="round-card round-card--' + cls + '">' +
              '<p class="round-card__num">Round ' + escapeHtml(r.round) + '</p>' +
              '<p class="round-card__date">' + escapeHtml(formatDate(r.cutoffDate)) +
                '<span>Commitment cutoff</span></p>' +
              '<span class="tag tag--' + cls + '">' + label + '</span>' +
              detail +
            '</div>';
        }).join('');

        if (fallback) fallback.style.display = 'none';
      })
      .catch(function () {
        timeline.innerHTML = '';
        if (fallback) {
          fallback.style.display = 'block';
          fallback.textContent =
            'The round status is being updated — please check back shortly, ' +
            'or contact us to ask which round is currently collecting.';
        }
      });
  }

  /* ── Bootstrap ─────────────────────────────────────────── */

  function init() {
    initLineItems();
    recalcTotal();
    initSubmit();
    renderRounds();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
