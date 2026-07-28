/**
 * functions/submission-created.js
 *
 * Netlify event function. Fires automatically on every Netlify Forms submission
 * (the "submission-created" event). For the "shirt-orders" form it:
 *
 *   1. Re-derives the itemized order + subtotal SERVER-SIDE from the submitted
 *      line items, pricing everything from data/products.json via order-core.js.
 *      The client-submitted total is never trusted.
 *   2. Renders an HTML invoice (with a plain-text fallback) and emails it to the
 *      purchaser and to josh@joshuabechtel.com via Resend.
 *   3. Dry-runs safely: if RESEND_API_KEY is absent it logs the invoice instead
 *      of sending, and never throws. Deploying before keys exist is harmless.
 *
 * Shares its pricing/tax math with the browser through assets/js/order-core.js,
 * so the on-page confirmation and the emailed invoice always agree.
 */
'use strict';

var crypto = require('crypto');
var core = require('../assets/js/order-core.js');
var products = require('../data/products.json');

/* Seller notification copy. Set SELLER_NOTIFY_EMAIL in Netlify env to change it
   without a code change (e.g. back to josh@joshuabechtel.com later). */
var SELLER_EMAIL = process.env.SELLER_NOTIFY_EMAIL || 'kal75el@gmail.com';
/* Override in Netlify env once the sending domain is verified with the provider. */
var FROM = process.env.INVOICE_FROM_EMAIL || 'NWK Shirt Preorder (Josh and Kim) <orders@northwestkingdom.com>';
var CAMPAIGN = products.campaign || 'I Gave';

/* ── Helpers ─────────────────────────────────────────────── */

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }

function makeOrderId() {
  var d = new Date();
  var ymd = '' + d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate());
  var suffix = crypto.randomBytes(2).toString('hex').toUpperCase(); // 4 hex chars
  return 'NWK-' + ymd + '-' + suffix;
}

function orderDateStr() {
  var d = new Date();
  var months = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
  return months[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear();
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Recover raw line items from the submission. Prefer the machine-readable
   order-lines JSON; fall back to parsing the human per-product fields. */
function parseLineItems(data) {
  var raw = data['order-lines'];
  if (raw) {
    try {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(function (li) {
          return {
            productId: li.productId,
            size: li.size || '',
            color: li.color || '',
            qty: li.qty
          };
        });
      }
    } catch (e) { /* fall through to human-field parsing */ }
  }
  return parseHumanFields(data);
}

/* Fallback: turn "2x 5XL Sand; 1x 5XL Light Blue" back into line items using the
   product's known sizes to split size from (multi-word) color. */
function parseHumanFields(data) {
  var out = [];
  (products.products || []).forEach(function (p) {
    var text = data[p.field];
    if (!text) return;
    var sizes = p.sizes || [];
    String(text).split(';').forEach(function (chunk) {
      var m = chunk.trim().match(/^(\d+)x\s*(.*)$/i);
      if (!m) return;
      var qty = parseInt(m[1], 10);
      var rest = (m[2] || '').trim();
      var size = '';
      var color = '';
      if (rest) {
        var firstTok = rest.split(/\s+/)[0];
        if (sizes.indexOf(firstTok) !== -1) {
          size = firstTok;
          color = rest.slice(firstTok.length).trim();
        } else if ((p.colors || []).length) {
          color = rest; // color-only product
        }
        // products without sizes/colors (e.g. buttons) carry no detail
      }
      out.push({ productId: p.id, size: size, color: color, qty: qty });
    });
  });
  return out;
}

/* ── Invoice rendering (HTML + text) ─────────────────────── */

function taxPct(rate) {
  return (rate * 100).toFixed(1).replace(/\.0$/, '') + '%';
}

function lineDetail(l) {
  var parts = [];
  if (l.size) parts.push(l.size);
  if (l.color) parts.push(l.color);
  return parts.join(', ');
}

function renderInvoice(ctx) {
  var order = ctx.order;
  var totals = ctx.totals;
  var pct = taxPct(totals.taxRate);
  var m = core.money;

  /* ---- Plain-text fallback ---- */
  var textLines = [];
  textLines.push('"' + CAMPAIGN + '" shirt preorder');
  textLines.push('Sold by Kim Reimer and Josh Bechtel');
  textLines.push('Order ' + ctx.orderId + '   ' + orderDateStr());
  textLines.push('');
  textLines.push('Purchaser: ' + ctx.name + (ctx.email ? ' <' + ctx.email + '>' : ''));
  textLines.push('');
  order.lines.forEach(function (l) {
    var detail = lineDetail(l);
    textLines.push('  ' + l.qty + ' x ' + l.name + (detail ? ' (' + detail + ')' : '') +
      '  @ ' + m(l.unitPrice) + '  = ' + m(l.lineTotal));
  });
  textLines.push('');
  textLines.push('Sale price: ' + m(totals.salePrice));
  textLines.push('Florida sales tax (' + pct + '): ' + m(totals.tax));
  textLines.push('The seller will pay this sales tax to the State of Florida on your behalf ' +
    'under section 212.07(4)(b), Florida Statutes.');
  textLines.push('Amount due from purchaser: ' + m(totals.amountDue));
  textLines.push('');
  textLines.push('Payment: cash at order placement or pickup. Orders are placed in bulk ' +
    'rounds; unpaid commitments may be dropped from a round.');
  var text = textLines.join('\n');

  /* ---- HTML ---- */
  var rowsHtml = order.lines.map(function (l) {
    var detail = lineDetail(l);
    return '<tr>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #eee;">' + escapeHtml(l.name) +
        (detail ? ' <span style="color:#777;font-size:13px;">' + escapeHtml(detail) + '</span>' : '') + '</td>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">' + l.qty + '</td>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">' + m(l.unitPrice) + '</td>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">' + m(l.lineTotal) + '</td>' +
    '</tr>';
  }).join('');

  var html =
  '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#222;">' +
    '<div style="background:#1d3d1a;color:#fff;padding:18px 20px;border-radius:8px 8px 0 0;">' +
      '<div style="font-size:18px;font-weight:bold;">&ldquo;' + escapeHtml(CAMPAIGN) + '&rdquo; Shirt Preorder</div>' +
      '<div style="font-size:13px;opacity:0.85;">Sold by Kim Reimer and Josh Bechtel</div>' +
    '</div>' +
    '<div style="border:1px solid #e2e2e2;border-top:none;border-radius:0 0 8px 8px;padding:20px;">' +
      '<p style="margin:0 0 4px;font-size:13px;color:#777;">Order ' + escapeHtml(ctx.orderId) +
        ' &middot; ' + escapeHtml(orderDateStr()) + '</p>' +
      '<p style="margin:0 0 16px;">Hi ' + escapeHtml(ctx.name) + ', thanks for your commitment! ' +
        'Here is your order summary.</p>' +
      '<p style="margin:0 0 16px;font-size:13px;color:#555;">Purchaser: ' + escapeHtml(ctx.name) +
        (ctx.email ? ' &lt;' + escapeHtml(ctx.email) + '&gt;' : '') + '</p>' +
      '<table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">' +
        '<thead><tr>' +
          '<th style="text-align:left;padding:6px 8px;border-bottom:2px solid #ddd;font-size:12px;color:#777;text-transform:uppercase;">Item</th>' +
          '<th style="text-align:right;padding:6px 8px;border-bottom:2px solid #ddd;font-size:12px;color:#777;text-transform:uppercase;">Qty</th>' +
          '<th style="text-align:right;padding:6px 8px;border-bottom:2px solid #ddd;font-size:12px;color:#777;text-transform:uppercase;">Unit</th>' +
          '<th style="text-align:right;padding:6px 8px;border-bottom:2px solid #ddd;font-size:12px;color:#777;text-transform:uppercase;">Total</th>' +
        '</tr></thead>' +
        '<tbody>' + rowsHtml + '</tbody>' +
      '</table>' +
      '<table style="width:100%;font-size:14px;">' +
        '<tr><td style="padding:2px 8px;">Sale price</td>' +
          '<td style="padding:2px 8px;text-align:right;">' + m(totals.salePrice) + '</td></tr>' +
        '<tr><td style="padding:2px 8px;">Florida sales tax (' + pct + ')</td>' +
          '<td style="padding:2px 8px;text-align:right;">' + m(totals.tax) + '</td></tr>' +
      '</table>' +
      '<p style="font-size:12px;color:#777;margin:8px 0;">The seller will pay this sales tax to the ' +
        'State of Florida on your behalf under section 212.07(4)(b), Florida Statutes.</p>' +
      '<table style="width:100%;font-size:15px;font-weight:bold;border-top:2px solid #1d3d1a;margin-top:4px;">' +
        '<tr><td style="padding:8px;">Amount due from purchaser</td>' +
          '<td style="padding:8px;text-align:right;color:#1d3d1a;">' + m(totals.amountDue) + '</td></tr>' +
      '</table>' +
      '<p style="font-size:13px;color:#555;margin:16px 0 0;">Payment: cash at order placement or ' +
        'pickup. Orders are placed in bulk rounds; unpaid commitments may be dropped from a round.</p>' +
    '</div>' +
  '</div>';

  return { html: html, text: text };
}

/* ── Email delivery (Resend) ─────────────────────────────── */

function sendViaResend(apiKey, message) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(message)
  }).then(function (res) {
    return res.text().then(function (body) {
      if (!res.ok) throw new Error('Resend HTTP ' + res.status + ': ' + body);
      return body;
    });
  });
}

/* ── Handler ─────────────────────────────────────────────── */

exports.handler = async function (event) {
  var submission;
  try {
    submission = JSON.parse((event && event.body) || '{}');
  } catch (e) {
    console.error('[submission-created] unparseable event body:', e.message);
    return { statusCode: 200, body: 'ignored: unparseable body' };
  }

  var payload = (submission && submission.payload) || {};
  var data = payload.data || {};
  var formName = payload.form_name || data['form-name'];
  if (formName && formName !== 'shirt-orders') {
    return { statusCode: 200, body: 'ignored: other form (' + formName + ')' };
  }

  var lineItems = parseLineItems(data);
  var order = core.computeOrder(lineItems, products);
  var totals = core.invoiceTotals(order.subtotal);

  var orderId = makeOrderId();
  var name = (data.name || '').trim() || 'Friend';
  var email = (data.email || '').trim();

  var invoice = renderInvoice({ orderId: orderId, order: order, totals: totals, name: name, email: email });

  var to = isEmail(email) ? [email] : [SELLER_EMAIL];
  var bcc = isEmail(email) ? [SELLER_EMAIL] : undefined;
  var subject = 'Your "' + CAMPAIGN + '" order, ' + orderId + ' (' + core.money(totals.amountDue) + ')';

  var apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[submission-created] DRY RUN: RESEND_API_KEY not set. No email sent.');
    console.log('[submission-created] Order ' + orderId + ' | to: ' + to.join(', ') +
      (bcc ? ' | bcc: ' + bcc.join(', ') : '') + ' | amount due: ' + core.money(totals.amountDue));
    console.log('[submission-created] Invoice (text):\n' + invoice.text);
    return { statusCode: 200, body: 'dry-run: no RESEND_API_KEY' };
  }

  var message = {
    from: FROM,
    to: to,
    subject: subject,
    html: invoice.html,
    text: invoice.text
  };
  if (bcc) message.bcc = bcc;

  try {
    await sendViaResend(apiKey, message);
    console.log('[submission-created] Sent invoice ' + orderId + ' to ' + to.join(', '));
    return { statusCode: 200, body: 'sent: ' + orderId };
  } catch (e) {
    /* Never throw: a failed email must not fail the submission or retry-storm. */
    console.error('[submission-created] email send failed for ' + orderId + ': ' + e.message);
    return { statusCode: 200, body: 'email-failed (logged): ' + orderId };
  }
};

/* Exported for the local dry-run test harness. */
exports._internal = {
  parseLineItems: parseLineItems,
  renderInvoice: renderInvoice,
  makeOrderId: makeOrderId
};
