// Shared by the tests and by tools/shots.js: serve the game from this folder, open it in a headless browser, press Begin.
// Playwright is not a dependency of the game. Point at one with PLAYWRIGHT_MODULE=/path/to/playwright or NODE_PATH.
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];

function playwright() {
  try { return require(process.env.PLAYWRIGHT_MODULE || 'playwright'); } catch (e) { return null; }
}
// a static file server over the repository; remembers what was asked for and not found
function serve(root) {
  const missing = new Set();
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
    const f = path.join(root || ROOT, p);
    if (!f.startsWith(root || ROOT)) { r.writeHead(403); r.end(); return; }
    fs.readFile(f, (e, d) => { if (e) { missing.add(p); r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(d); } });
  });
  return new Promise((res) => srv.listen(0, '127.0.0.1', () => res({ srv, missing, url: 'http://127.0.0.1:' + srv.address().port + '/' })));
}
// open the title screen with the 3D renderer allowed; returns { page, errors, missing, close }
async function open(opts) {
  opts = opts || {};
  const pw = playwright(); if (!pw) return null;
  const s = await serve(opts.root);
  const browser = await pw.chromium.launch({ args: ARGS });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERR ' + String(e.message).slice(0, 240)));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource|GPU stall|swiftshader|WebGL-.*fallback|READ-usage/i.test(m.text())) errors.push('CONSOLE ' + m.text().slice(0, 240)); });
  await page.addInitScript(() => { window.__r3d21 = { automation: true }; });
  await page.goto(s.url, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof Engine !== 'undefined' && typeof G !== 'undefined' && typeof LEDGE1 !== 'undefined' && !(document.querySelector('#loading') && document.querySelector('#loading').classList.contains('on')), null, { timeout: 60000 });
  return { page, errors, missing: s.missing, url: s.url, close: async () => { await browser.close(); s.srv.close(); } };
}
// press Begin, pass the opening lines, and wait for the ledge under the 3D renderer
async function begin(page) {
  await page.locator('#btn-new').first().dispatchEvent('click');
  await page.waitForFunction(() => G.state === 'intro' || G.state === 'play', null, { timeout: 20000 });
  if (await page.evaluate(() => G.state === 'intro')) await page.locator('#btn-intro-skip').first().dispatchEvent('click');
  await page.waitForFunction(() => G.state === 'play', null, { timeout: 20000 });
  await page.evaluate(() => { if (typeof R3D !== 'undefined') R3D.setMode('on'); });
  await page.waitForFunction(() => typeof R3D !== 'undefined' && R3D.active && R3D.active(), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
}
module.exports = { ROOT, ARGS, playwright, serve, open, begin };
