/**
 * Real-browser layout test for the member area (two-column sidebar layout).
 *
 *   Setup:  cd test/browser && npm install
 *   Run:    node member-layout.browser.test.js   (or: npm test)
 *
 * Guards the fix for the cramped member layout: the two-column wrapper
 * (.site-body) is a flex item of a column-flex <body> and was shrink-wrapping to
 * its content, collapsing the content column (worst on the calendar page, whose
 * iframe contributes ~0 intrinsic width). Asserts, on real member pages, that:
 *   - the sidebar and content bounding boxes do not overlap,
 *   - the sidebar sits at/below the top nav (never tucked under it),
 *   - the content column is at least a reasonable share of the viewport
 *     at 1440px and 1024px.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TYPES = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon' };
const MIN_CONTENT_SHARE = 0.6; // content column must be >= 60% of viewport width

function startServer() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(REPO_ROOT, p);
    if (!file.startsWith(REPO_ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function measure(page, url, width) {
  await page.setViewport({ width, height: 900 });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await wait(500); // components.js injects/loads the sidebar
  return page.evaluate(() => {
    const rect = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, right: b.right, bottom: b.bottom }; };
    return { innerWidth: window.innerWidth, nav: rect('#site-nav'), leftNav: rect('#site-left-nav'), main: rect('#main-content') };
  });
}

(async () => {
  let failures = 0;
  const ok = (name, cond, extra) => { if (cond) console.log('  ok   - ' + name); else { failures++; console.log('  FAIL - ' + name + (extra ? '  :: ' + extra : '')); } };

  const server = await startServer();
  const port = server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  // Block the external Base44 iframe so the test is deterministic offline.
  await page.setRequestInterception(true);
  page.on('request', (req) => { if (req.url().includes('base44.app')) req.abort(); else req.continue(); });

  try {
    /* /member/dashboard/ = member area (cards); /public/calendar/ = the wide
       Base44 embed page that exposed the collapse. Both use the .site-body
       two-column layout. (/member/calendar/ was retired into the public area.) */
    for (const url of ['/member/dashboard/', '/public/calendar/']) {
      for (const width of [1440, 1024]) {
        const d = await measure(page, `http://localhost:${port}${url}`, width);
        const label = `${url} @ ${width}px`;
        if (!d.leftNav || !d.main) { ok(`${label}: sidebar + content present`, false, JSON.stringify(d)); continue; }
        const share = d.main.w / d.innerWidth;
        ok(`${label}: sidebar/content do not overlap`, d.leftNav.right <= d.main.x + 1, `sidebar.right=${Math.round(d.leftNav.right)} main.x=${Math.round(d.main.x)}`);
        ok(`${label}: sidebar not tucked under top nav`, !d.nav || d.leftNav.y >= d.nav.bottom - 1, `sidebar.y=${Math.round(d.leftNav.y)} nav.bottom=${Math.round(d.nav.bottom)}`);
        ok(`${label}: content >= ${Math.round(MIN_CONTENT_SHARE*100)}% of viewport`, share >= MIN_CONTENT_SHARE, `${Math.round(d.main.w)}px = ${(share*100).toFixed(1)}%`);
      }
    }
  } catch (err) {
    failures++; console.log('  FAIL - test threw: ' + err.message); console.log(err.stack);
  } finally {
    await browser.close(); server.close();
  }

  console.log('\n' + (failures ? 'FAILED (' + failures + ')' : 'ALL MEMBER-LAYOUT ASSERTIONS PASSED'));
  process.exit(failures ? 1 : 0);
})();
