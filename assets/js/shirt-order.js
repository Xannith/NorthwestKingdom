/**
 * shirt-order.js
 * Client-side behavior for the public "I Gave" Community Shirts preorder page.
 *
 * Pricing is NOT defined here. Product prices/options live in data/products.json
 * and all math runs through NWKOrder.computeOrder() (assets/js/order-core.js) —
 * the same module the server-side invoice function uses. This file only:
 *   1. Line items — add/remove size+color+quantity rows for each product.
 *   2. Live order total + itemized summary + checkbox text, all from computeOrder.
 *   3. Submission — serialize line items (machine JSON + human fields) and POST to
 *      Netlify Forms via AJAX (form name: "shirt-orders").
 *   4. On-page confirmation mirroring the emailed invoice (itemized + FL tax block).
 *   5. Order Status — fetch data/shirt-order-rounds.json and render the rounds.
 *
 * Cash-commitment preorder, not a payment system. No card data is collected.
 * Client-side validation and totals are for UX; the server re-derives the order
 * from products.json and never trusts a client-submitted total.
 *
 * Graceful degradation: without JavaScript the static rows submit natively to
 * Netlify with distinct field names per product.
 */
(function () {
  'use strict';

  var CORE = (typeof NWKOrder !== 'undefined') ? NWKOrder : null;
  var PRODUCTS_DATA = null;   // data/products.json, once fetched
  var PRODUCTS_BY_ID = {};    // id -> product (name, unit, field, fixedColor, ...)

  function $(id) { return document.getElementById(id); }
  function money(n) { return CORE ? CORE.money(n) : '$' + Number(n).toFixed(2); }
  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Products (single source of truth, fetched at load) ── */

  function loadProducts() {
    return fetch('/data/products.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        PRODUCTS_DATA = data;
        PRODUCTS_BY_ID = {};
        (data.products || []).forEach(function (p) { PRODUCTS_BY_ID[p.id] = p; });
      })
      .catch(function (err) {
        /* Leave the static default totals in place; submit still works and the
           server re-derives the order authoritatively from products.json.
           Log loudly — a silent failure here looks like "only the $18 shirt
           counts", since the live total can no longer recompute. */
        PRODUCTS_DATA = null;
        console.error('[shirt-order] Could not load /data/products.json — live ' +
          'order totals are disabled until reload (submissions still work; the ' +
          'server re-prices the order).', err);
      });
  }

  /* ── Line items ──────────────────────────────────────────
   *
   * Wiring uses EVENT DELEGATION on the stable <form> element rather than
   * per-element listeners. Cloned rows and the add-row buttons therefore never
   * need to be individually bound — they can't "detach" from the logic — and a
   * failure preparing one product section cannot silently disable the others
   * (each section's setup is guarded and logged loudly).
   */

  var ROW_TEMPLATES = {};   // containerId -> pristine .shirt-line node
  var ADD_TO = {};          // add-button id -> containerId it appends to

  function updateSingleFlag(container) {
    if (!container) return;
    var rows = container.querySelectorAll('.shirt-line');
    if (rows.length <= 1) container.setAttribute('data-single', '');
    else container.removeAttribute('data-single');
  }

  function addRow(containerId) {
    var container = $(containerId);
    var tpl = ROW_TEMPLATES[containerId];
    if (!container || !tpl) {
      console.error('[shirt-order] cannot add row: missing container/template for', containerId);
      return;
    }
    var row = tpl.cloneNode(true);
    row.querySelectorAll('select').forEach(function (s) { s.selectedIndex = 0; });
    var qty = row.querySelector('.shirt-line__qty input');
    if (qty) qty.value = '1';
    container.appendChild(row);
    updateSingleFlag(container);
    recalcTotal();
    var firstField = row.querySelector('select, input');
    if (firstField) firstField.focus();
  }

  function removeRow(removeBtn) {
    var row = removeBtn.closest('.shirt-line');
    var container = removeBtn.closest('.shirt-lines');
    if (!row || !container) return;
    if (container.querySelectorAll('.shirt-line').length <= 1) return; /* keep last row */
    row.parentNode.removeChild(row);
    updateSingleFlag(container);
    recalcTotal();
  }

  function initLineItems() {
    var form = $('shirt-order-form');
    if (!form) { console.error('[shirt-order] order form not found; line items disabled'); return; }

    var sections = document.querySelectorAll('.shirt-lines[data-product]');
    if (!sections.length) console.error('[shirt-order] no product sections found (.shirt-lines[data-product])');

    /* Capture a pristine row template per section. Guarded so one bad section
       cannot abort setup of the rest. */
    sections.forEach(function (container) {
      try {
        var firstRow = container.querySelector('.shirt-line');
        if (!firstRow) {
          console.error('[shirt-order] section "' + container.id + '" has no .shirt-line row template');
          return;
        }
        ROW_TEMPLATES[container.id] = firstRow.cloneNode(true);
        var addId = container.getAttribute('data-add-btn');
        if (addId) ADD_TO[addId] = container.id;
        updateSingleFlag(container);
      } catch (err) {
        console.error('[shirt-order] failed to initialize section "' +
          (container && container.id) + '":', err);
      }
    });

    /* Delegated field changes → recalc (covers every current and future row). */
    function onField(e) {
      if (e.target && e.target.closest && e.target.closest('.shirt-line')) recalcTotal();
    }
    form.addEventListener('input', onField);
    form.addEventListener('change', onField);

    /* Delegated clicks for add-row buttons and per-row remove buttons. */
    form.addEventListener('click', function (e) {
      if (!e.target || !e.target.closest) return;
      var addBtn = e.target.closest('button[id]');
      if (addBtn && ADD_TO[addBtn.id]) { e.preventDefault(); addRow(ADD_TO[addBtn.id]); return; }
      var removeBtn = e.target.closest('.shirt-line__remove');
      if (removeBtn) { e.preventDefault(); removeRow(removeBtn); return; }
    });
  }

  /* Read every product's rows into raw line items for computeOrder. */
  function collectLineItems() {
    var out = [];
    document.querySelectorAll('.shirt-lines[data-product]').forEach(function (container) {
      var productId = container.getAttribute('data-product');
      container.querySelectorAll('.shirt-line').forEach(function (row) {
        var sizeEl  = row.querySelector('.shirt-line__size select');
        var colorEl = row.querySelector('.shirt-line__color select');
        var qtyEl   = row.querySelector('.shirt-line__qty input');
        out.push({
          productId: productId,
          size:  sizeEl  ? sizeEl.value  : '',
          color: colorEl ? colorEl.value : '',
          qty:   qtyEl   ? qtyEl.value   : '0'
        });
      });
    });
    return out;
  }

  function currentOrder() {
    if (!CORE || !PRODUCTS_DATA) return null;
    return CORE.computeOrder(collectLineItems(), PRODUCTS_DATA);
  }

  /* Short "5XL, Sand" descriptor for a line (may be empty for buttons). */
  function lineDetail(line) {
    var parts = [];
    if (line.size)  parts.push(line.size);
    if (line.color) parts.push(line.color);
    return parts.join(', ');
  }

  function recalcTotal() {
    var order = currentOrder();
    if (!order) return null;   // products not loaded yet — keep static defaults

    var linesEl = $('order-total-lines');
    if (linesEl) {
      var rows = order.lines.map(function (l) {
        var detail = lineDetail(l);
        var label = escapeHtml(l.qty + ' × ' + l.name) +
          (detail ? ' <small>' + escapeHtml(detail) + '</small>' : '');
        return '<li>' + label + ' <span>' + money(l.lineTotal) + '</span></li>';
      });
      linesEl.innerHTML = rows.length
        ? rows.join('')
        : '<li class="order-total__empty">No items selected yet.</li>';
    }

    var amountEl = $('order-total-amount');
    var commitEl = $('commit-amount');
    if (amountEl) amountEl.textContent = money(order.subtotal);
    if (commitEl) commitEl.textContent = money(order.subtotal);
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

  function emailLooksValid(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim());
  }

  /* Group priced lines back into the human-readable per-product Netlify fields. */
  function humanFieldsFor(order) {
    var byField = {};
    order.lines.forEach(function (l) {
      var p = PRODUCTS_BY_ID[l.productId];
      if (!p || !p.field) return;
      /* Space-joined "5XL Sand" so the function's fallback parser can split
         size from color; the on-page summary uses the prettier comma form. */
      var parts = [];
      if (l.size) parts.push(l.size);
      if (l.color) parts.push(l.color);
      var label = parts.length ? parts.join(' ') : capitalize(l.unit);
      (byField[p.field] = byField[p.field] || []).push(l.qty + 'x ' + label);
    });
    var out = {};
    Object.keys(byField).forEach(function (f) { out[f] = byField[f].join('; '); });
    return out;
  }

  /* ── On-page invoice / confirmation block ──────────────── */

  function invoiceHtml(order, meta) {
    var totals = CORE.invoiceTotals(order.subtotal);
    var pct = (totals.taxRate * 100).toFixed(1).replace(/\.0$/, '') + '%';

    var rows = order.lines.map(function (l) {
      var detail = lineDetail(l);
      return '<tr>' +
        '<td>' + escapeHtml(l.name) + (detail ? ' <span class="invoice__detail">' + escapeHtml(detail) + '</span>' : '') + '</td>' +
        '<td class="invoice__num">' + l.qty + '</td>' +
        '<td class="invoice__num">' + money(l.unitPrice) + '</td>' +
        '<td class="invoice__num">' + money(l.lineTotal) + '</td>' +
      '</tr>';
    }).join('');

    return '' +
      '<div class="invoice">' +
        (meta && meta.orderId ? '<p class="invoice__meta">Order ' + escapeHtml(meta.orderId) + '</p>' : '') +
        '<table class="invoice__table">' +
          '<thead><tr><th>Item</th><th class="invoice__num">Qty</th><th class="invoice__num">Unit</th><th class="invoice__num">Total</th></tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
        '<dl class="invoice__tax">' +
          '<div><dt>Sale price</dt><dd>' + money(totals.salePrice) + '</dd></div>' +
          '<div><dt>Florida sales tax (' + pct + ')</dt><dd>' + money(totals.tax) + '</dd></div>' +
        '</dl>' +
        '<p class="invoice__note">The seller will pay this sales tax to the State of Florida on ' +
          'your behalf under section 212.07(4)(b), Florida Statutes.</p>' +
        '<dl class="invoice__tax invoice__tax--due">' +
          '<div><dt>Amount due from purchaser</dt><dd>' + money(totals.amountDue) + '</dd></div>' +
        '</dl>' +
        '<p class="invoice__terms">Payment: cash at order placement or pickup. Orders are placed ' +
          'in bulk rounds; unpaid commitments may be dropped from a round.</p>' +
      '</div>';
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
      if (!order) {
        /* Products failed to load; fall back to an empty priced order so the
           server can still re-derive from the raw line items we submit. */
        order = { lines: [], subtotal: 0, totalQty: 0 };
      }

      var nameEl   = $('shirt-name');
      var emailEl  = $('shirt-email');
      var phoneEl  = $('shirt-phone');
      var commitEl = $('shirt-commitment');
      var valid = true;

      if (!nameEl.value.trim()) {
        setError('shirt-name', 'shirt-name-error', 'Please enter your name.');
        valid = false;
      } else { setError('shirt-name', 'shirt-name-error', ''); }

      if (!emailLooksValid(emailEl.value)) {
        setError('shirt-email', 'shirt-email-error',
          'Please enter a valid email address so we can send your order summary.');
        valid = false;
      } else { setError('shirt-email', 'shirt-email-error', ''); }

      if (!phoneLooksValid(phoneEl.value)) {
        setError('shirt-phone', 'shirt-phone-error',
          'Please enter a phone number we can reach you at (at least 10 digits).');
        valid = false;
      } else { setError('shirt-phone', 'shirt-phone-error', ''); }

      if (order.totalQty === 0) {
        setError('shirt-lines-anchor', 'shirt-lines-error',
          'Please choose at least one shirt or button (set a quantity of 1 or more).');
        valid = false;
      } else { setError('shirt-lines-anchor', 'shirt-lines-error', ''); }

      if (!commitEl.checked) {
        setError('shirt-commitment', 'shirt-commitment-error',
          'Please confirm your cash commitment to place your order.');
        valid = false;
      } else { setError('shirt-commitment', 'shirt-commitment-error', ''); }

      if (!valid) {
        var firstErr = form.querySelector('.form-field--error');
        if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      /* Machine-readable line items (no prices — server prices from products.json). */
      var rawLines = order.lines.map(function (l) {
        return { productId: l.productId, size: l.size, color: l.color, qty: l.qty };
      });
      $('order-lines').value = JSON.stringify(rawLines);

      /* Human-readable per-product fields for the Netlify dashboard. */
      var human = humanFieldsFor(order);
      ['order-items', 'order-shirts-green', 'order-buttons'].forEach(function (f) {
        var el = $(f);
        if (el) el.value = human[f] || '';
      });
      $('total-quantity').value = String(order.totalQty);
      $('total-dollars').value  = order.subtotal.toFixed(2);

      var commitmentText =
        'I commit to paying ' + money(order.subtotal) +
        ' in cash when my order is placed or at pickup.';

      var payload = {
        'form-name':      'shirt-orders',
        'name':           nameEl.value.trim(),
        'email':          emailEl.value.trim(),
        'phone':          phoneEl.value.trim(),
        'order-lines':    $('order-lines').value,
        'order-items':    $('order-items').value,
        'order-shirts-green': $('order-shirts-green').value,
        'order-buttons':  $('order-buttons').value,
        'total-quantity': String(order.totalQty),
        'total-dollars':  order.subtotal.toFixed(2),
        'commitment':     commitmentText,
        'bot-field':      ''
      };

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
            submitBtn.disabled = !commitEl.checked;
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

    ['shirt-name', 'shirt-email', 'shirt-phone'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', function () { setError(id, id + '-error', ''); });
    });
    /* The cash commitment is mandatory: keep Submit disabled until it's checked. */
    var commit = $('shirt-commitment');
    function syncSubmitState() {
      var checked = !!(commit && commit.checked);
      if (submitBtn) submitBtn.disabled = !checked;
      var hint = $('shirt-submit-hint');
      if (hint) hint.style.display = checked ? 'none' : '';
      if (checked) setError('shirt-commitment', 'shirt-commitment-error', '');
    }
    if (commit) commit.addEventListener('change', syncSubmitState);
    syncSubmitState();
  }

  function showConfirmation(order, name) {
    var form = $('shirt-order-form');
    var box  = $('shirt-submit-result');
    if (!box) return;

    var invoice = (CORE && PRODUCTS_DATA && order.lines.length)
      ? invoiceHtml(order)
      : '';

    box.className = 'submit-result submit-result--success is-visible';
    box.innerHTML =
      '<p class="submit-result__title">Thank you, ' + escapeHtml(name) + '! Your commitment is in.</p>' +
      '<p>Here’s your order summary — we’ve also emailed it to you:</p>' +
      invoice +
      '<p class="mb-0">Orders are placed in bulk rounds roughly every 3 weeks. ' +
      'We’ll contact you when the next round is placed so you can arrange payment ' +
      'and pickup. See the Order Status below for where things stand.</p>';

    if (form) form.style.display = 'none';
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    box.setAttribute('tabindex', '-1');
    box.focus();
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
    /* Guard each subsystem: a failure in one must not disable the others. */
    try { initLineItems(); } catch (e) { console.error('[shirt-order] initLineItems failed:', e); }
    try { initSubmit(); }    catch (e) { console.error('[shirt-order] initSubmit failed:', e); }
    try { renderRounds(); }  catch (e) { console.error('[shirt-order] renderRounds failed:', e); }
    loadProducts().then(function () {
      try { recalcTotal(); } catch (e) { console.error('[shirt-order] recalcTotal failed:', e); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
