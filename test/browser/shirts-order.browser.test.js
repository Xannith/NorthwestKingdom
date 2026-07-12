/**
 * Real-browser end-to-end test for the /shirts preorder page.
 *
 *   Setup:  cd test/browser && npm install
 *   Run:    npm test        (or: node shirts-order.browser.test.js)
 *
 * Loads the ACTUAL shirts/index.html in headless Chromium over a local static
 * server (so /assets and /data resolve exactly as on Netlify) and drives the DOM
 * like a user. Unlike jsdom, this exercises real event wiring — the failure class
 * that broke this page (cloned rows / add buttons detaching from the logic).
 *
 * Canonical repro asserted here:
 *   two $18 shirt rows (5XL Sand, 5XL Light Blue) added via the add button,
 *   one Evergreen 5XL, and button qty 2  →  4 itemized lines, total $64.00,
 *   checkbox text $64.00, and ZERO console errors.
 * Plus: clicking "+ Add another green shirt" must actually add a DOM row.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon'
};

function startServer() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/favicon.ico') { res.writeHead(204); return res.end(); } // avoid noise
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(REPO_ROOT, p);
    if (!file.startsWith(REPO_ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('404');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Set size/color/qty on the Nth row of a container, dispatching real events.
async function setRow(page, containerId, index, opts) {
  await page.evaluate((cid, i, o) => {
    const rows = document.querySelectorAll('#' + cid + ' .shirt-line');
    const row = rows[i];
    const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));
    if (o.size !== undefined) { const s = row.querySelector('.shirt-line__size select'); s.value = o.size; fire(s, 'change'); }
    if (o.color !== undefined) { const s = row.querySelector('.shirt-line__color select'); s.value = o.color; fire(s, 'change'); }
    if (o.qty !== undefined) { const q = row.querySelector('.shirt-line__qty input'); q.value = String(o.qty); fire(q, 'input'); }
  }, containerId, index, opts);
}

(async () => {
  let failures = 0;
  const ok = (name, cond, extra) => {
    if (cond) console.log('  ok   - ' + name);
    else { failures++; console.log('  FAIL - ' + name + (extra ? '  :: ' + extra : '')); }
  };

  const server = await startServer();
  const port = server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

  try {
    await page.goto(`http://localhost:${port}/shirts/`, { waitUntil: 'networkidle0' });
    await wait(300); // let products.json settle

    // ── Add-row buttons actually add DOM rows ──
    const classicBefore = await page.$$eval('#shirt-lines .shirt-line', (n) => n.length);
    await page.click('#add-shirt-btn');
    await wait(50);
    const classicAfter = await page.$$eval('#shirt-lines .shirt-line', (n) => n.length);
    ok('"+ Add another shirt" adds a classic row', classicAfter === classicBefore + 1, classicBefore + '->' + classicAfter);

    const greenBefore = await page.$$eval('#shirt-lines-green .shirt-line', (n) => n.length);
    await page.click('#add-shirt-green-btn');
    await wait(50);
    const greenAfter = await page.$$eval('#shirt-lines-green .shirt-line', (n) => n.length);
    ok('"+ Add another green shirt" adds an Evergreen row', greenAfter === greenBefore + 1, greenBefore + '->' + greenAfter);

    // Remove the extra rows we just added so we start the repro clean.
    await page.evaluate(() => {
      document.querySelectorAll('#shirt-lines .shirt-line')[1].querySelector('.shirt-line__remove').click();
      document.querySelectorAll('#shirt-lines-green .shirt-line')[1].querySelector('.shirt-line__remove').click();
    });
    await wait(50);
    const classicReset = await page.$$eval('#shirt-lines .shirt-line', (n) => n.length);
    const greenReset = await page.$$eval('#shirt-lines-green .shirt-line', (n) => n.length);
    ok('remove-row returns classic to 1 row', classicReset === 1, String(classicReset));
    ok('remove-row returns Evergreen to 1 row', greenReset === 1, String(greenReset));

    // ── Canonical repro ──
    await setRow(page, 'shirt-lines', 0, { size: '5XL', color: 'Sand', qty: 1 });
    await page.click('#add-shirt-btn');
    await wait(50);
    await setRow(page, 'shirt-lines', 1, { size: '5XL', color: 'Light Blue', qty: 1 });
    await setRow(page, 'shirt-lines-green', 0, { size: '5XL', qty: 1 });
    await setRow(page, 'shirt-lines-button', 0, { qty: 2 });
    await wait(100);

    const state = await page.evaluate(() => ({
      total: document.getElementById('order-total-amount').textContent,
      commit: document.getElementById('commit-amount').textContent,
      lines: [...document.querySelectorAll('#order-total-lines li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim())
    }));

    console.log('\n  --- order summary (browser DOM) ---');
    state.lines.forEach((l) => console.log('      ' + l));
    console.log('      TOTAL ' + state.total + '   (checkbox ' + state.commit + ')\n');

    ok('four itemized lines', state.lines.length === 4, String(state.lines.length));
    ok('order total is $64.00', state.total === '$64.00', state.total);
    ok('checkbox text is $64.00', state.commit === '$64.00', state.commit);
    ok('Evergreen line present in summary', state.lines.some((l) => /Evergreen/.test(l)));
    ok('button line present in summary', state.lines.some((l) => /button/.test(l)));

    // ── Submit button gated on the commitment checkbox ──
    const disabledOnLoad = await page.$eval('#shirt-submit-btn', (b) => b.disabled);
    ok('Submit is DISABLED until the commitment box is checked', disabledOnLoad === true);
    await page.click('#shirt-commitment'); // check it
    await wait(30);
    const enabledAfterCheck = await page.$eval('#shirt-submit-btn', (b) => b.disabled);
    ok('Submit ENABLES once the commitment box is checked', enabledAfterCheck === false);
    await page.click('#shirt-commitment'); // uncheck it
    await wait(30);
    const disabledAfterUncheck = await page.$eval('#shirt-submit-btn', (b) => b.disabled);
    ok('Submit DISABLES again if the box is unchecked', disabledAfterUncheck === true);

    ok('zero console errors / page errors', consoleErrors.length === 0, JSON.stringify(consoleErrors));
  } catch (err) {
    failures++;
    console.log('  FAIL - test threw: ' + err.message);
    console.log(err.stack);
  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n' + (failures ? 'FAILED (' + failures + ')' : 'ALL BROWSER ASSERTIONS PASSED'));
  process.exit(failures ? 1 : 0);
})();
