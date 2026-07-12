/**
 * order-core.js — single source of truth for "I Gave" preorder pricing math.
 *
 * Pure, dependency-free, and shared by BOTH runtimes:
 *   - the browser (loaded as a <script>, exposed as window.NWKOrder)
 *   - the Netlify submission-created function (loaded via require())
 *
 * Product prices/options live in data/products.json. This module owns only the
 * math and the tax config, so the on-page total, the confirmation, the checkbox
 * text, and the server-side invoice all compute from the exact same code.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NWKOrder = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Leon County FL combined rate for 2026, verify annually against DOR form DR-15DSS */
  var TAX_RATE = 0.075;

  /* Round to cents without binary-float drift (e.g. 1.005 -> 1.01). */
  function round2(n) {
    var v = Number(n);
    if (!isFinite(v)) return 0;
    return Math.round((v + Number.EPSILON) * 100) / 100;
  }

  function money(n) {
    return '$' + round2(n).toFixed(2);
  }

  /* Accept either the products.json object ({products:[...]}) or a bare array. */
  function indexProducts(products) {
    var list = Array.isArray(products) ? products
      : (products && Array.isArray(products.products)) ? products.products : [];
    var byId = {};
    list.forEach(function (p) { if (p && p.id != null) byId[p.id] = p; });
    return byId;
  }

  /**
   * computeOrder — pure. Turns raw line items into itemized lines + a subtotal.
   *
   * @param {Array} lineItems  [{ productId, size, color, qty }]
   * @param {Object|Array} products  data/products.json (object or products array)
   * @returns {{ lines: Array, subtotal: number, totalQty: number }}
   *
   * Excluded from the result: unknown products, and rows whose qty is missing,
   * blank, non-numeric, zero, or negative. (Removed rows are simply absent.)
   */
  function computeOrder(lineItems, products) {
    var byId = indexProducts(products);
    var lines = [];
    var subtotal = 0;
    var totalQty = 0;

    (lineItems || []).forEach(function (li) {
      if (!li) return;
      var p = byId[li.productId];
      if (!p) return;

      /* parseInt tolerates "3" and trims trailing junk; guard NaN / <1 explicitly. */
      var qty = parseInt(li.qty, 10);
      if (!isFinite(qty) || qty < 1) return;

      var price = Number(p.price);
      if (!isFinite(price) || price < 0) price = 0;

      var color = (li.color != null && li.color !== '') ? li.color : (p.fixedColor || '');
      var lineTotal = round2(price * qty);

      lines.push({
        productId: p.id,
        name: p.name,
        unit: p.unit || 'item',
        size: li.size || '',
        color: color,
        qty: qty,
        unitPrice: round2(price),
        lineTotal: lineTotal
      });

      subtotal = round2(subtotal + lineTotal);
      totalQty += qty;
    });

    return { lines: lines, subtotal: round2(subtotal), totalQty: totalQty };
  }

  /* Florida sales tax on a subtotal, rounded to cents. */
  function computeTax(subtotal) {
    return round2(Number(subtotal) * TAX_RATE);
  }

  /**
   * invoiceTotals — the numbers the invoice/confirmation tax block needs.
   * The seller remits sales tax on the buyer's behalf (§212.07(4)(b), Fla. Stat.),
   * so the amount due always equals the advertised sale price (the subtotal).
   */
  function invoiceTotals(subtotal) {
    var sale = round2(subtotal);
    return {
      salePrice: sale,
      taxRate: TAX_RATE,
      tax: computeTax(sale),
      amountDue: sale
    };
  }

  return {
    TAX_RATE: TAX_RATE,
    round2: round2,
    money: money,
    computeOrder: computeOrder,
    computeTax: computeTax,
    invoiceTotals: invoiceTotals
  };
});
