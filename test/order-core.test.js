/**
 * Plain-node tests for order-core.js — no framework.
 *   Run:  node test/order-core.test.js
 *
 * Exercises the repro order ($64.00) plus the edge cases called out in the
 * refactor: qty 0, a removed row, non-numeric qty, and 10+ rows.
 */
'use strict';

var path = require('path');
var assert = require('assert');

var core = require(path.join(__dirname, '..', 'assets', 'js', 'order-core.js'));
var products = require(path.join(__dirname, '..', 'data', 'products.json'));

var passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   - ' + name); }
  catch (e) { console.log('  FAIL - ' + name + '\n         ' + e.message); process.exitCode = 1; }
}

/* ── The repro order: expect $64.00 across 4 itemized lines ──────────────── */
test('repro order totals $64.00 with 4 lines', function () {
  var items = [
    { productId: 'classic', size: '5XL', color: 'Sand',       qty: 1 },
    { productId: 'classic', size: '5XL', color: 'Light Blue', qty: 1 },
    { productId: 'green',   size: '5XL',                       qty: 1 },
    { productId: 'button',                                     qty: 2 }
  ];
  var r = core.computeOrder(items, products);
  assert.strictEqual(r.lines.length, 4, 'expected 4 lines, got ' + r.lines.length);
  assert.strictEqual(r.subtotal, 64.00, 'expected 64.00, got ' + r.subtotal);
  assert.strictEqual(r.totalQty, 5, 'expected total qty 5, got ' + r.totalQty);
  // Green line inherits its fixed color even though none was passed.
  assert.strictEqual(r.lines[2].color, 'Green');
  // Button line total = 2 x $4.
  assert.strictEqual(r.lines[3].lineTotal, 8);
});

/* ── Tax block for the repro order ($64 -> $4.80, amount due $64) ─────────── */
test('invoice totals: $64 sale -> $4.80 tax, $64 amount due', function () {
  var t = core.invoiceTotals(64);
  assert.strictEqual(t.salePrice, 64.00);
  assert.strictEqual(t.tax, 4.80);
  assert.strictEqual(t.amountDue, 64.00);
  assert.strictEqual(core.TAX_RATE, 0.075);
});

/* ── qty 0 is excluded ───────────────────────────────────────────────────── */
test('qty 0 rows are excluded', function () {
  var r = core.computeOrder([
    { productId: 'classic', size: 'M', color: 'Sand', qty: 0 },
    { productId: 'button', qty: 3 }
  ], products);
  assert.strictEqual(r.lines.length, 1);
  assert.strictEqual(r.subtotal, 12); // 3 x $4
});

/* ── a "removed" row is simply absent from the array ─────────────────────── */
test('removed row (absent) does not contribute', function () {
  var full = [
    { productId: 'classic', size: 'L', color: 'Sand', qty: 1 },
    { productId: 'green',   size: 'L',                 qty: 1 }
  ];
  var afterRemoval = full.slice(0, 1); // second row removed
  var r = core.computeOrder(afterRemoval, products);
  assert.strictEqual(r.lines.length, 1);
  assert.strictEqual(r.subtotal, 18);
});

/* ── non-numeric qty input is excluded (never NaN in the total) ──────────── */
test('non-numeric qty is excluded, subtotal stays finite', function () {
  var r = core.computeOrder([
    { productId: 'classic', size: 'M', color: 'Sand', qty: 'abc' },
    { productId: 'classic', size: 'M', color: 'Sand', qty: '' },
    { productId: 'classic', size: 'M', color: 'Sand', qty: null },
    { productId: 'button', qty: '5' } // numeric string still counts
  ], products);
  assert.strictEqual(r.lines.length, 1);
  assert.strictEqual(r.subtotal, 20); // 5 x $4
  assert.ok(isFinite(r.subtotal), 'subtotal must be finite');
});

/* ── unknown product id is ignored ───────────────────────────────────────── */
test('unknown product id is ignored', function () {
  var r = core.computeOrder([
    { productId: 'sticker', qty: 4 },
    { productId: 'button', qty: 1 }
  ], products);
  assert.strictEqual(r.lines.length, 1);
  assert.strictEqual(r.subtotal, 4);
});

/* ── 10+ rows sum correctly ──────────────────────────────────────────────── */
test('10+ rows sum correctly', function () {
  var items = [];
  for (var i = 0; i < 12; i++) {
    items.push({ productId: 'button', qty: 1 }); // 12 x $4 = $48
  }
  items.push({ productId: 'classic', size: 'S', color: 'Sand', qty: 2 }); // + $36
  var r = core.computeOrder(items, products);
  assert.strictEqual(r.lines.length, 13);
  assert.strictEqual(r.subtotal, 84); // 48 + 36
  assert.strictEqual(r.totalQty, 14);
});

console.log('\n' + passed + ' passing');
if (process.exitCode) { console.log('SOME TESTS FAILED'); }
