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
  // Phase 10: Begin first asks who walks north; the tests walk as the default, the deserter
  await page.waitForFunction(() => G.state === 'intro' || G.state === 'play' || !!document.querySelector('#la-who'), null, { timeout: 20000 });
  if (await page.evaluate(() => !!document.querySelector('#la-who'))) await page.locator('#la-who [data-bg="deserter"]').first().dispatchEvent('click');
  await page.waitForFunction(() => G.state === 'intro' || G.state === 'play', null, { timeout: 20000 });
  if (await page.evaluate(() => G.state === 'intro')) await page.locator('#btn-intro-skip').first().dispatchEvent('click');
  await page.waitForFunction(() => G.state === 'play', null, { timeout: 20000 });
  await page.evaluate(() => { if (typeof R3D !== 'undefined') R3D.setMode('on'); });
  await page.waitForFunction(() => typeof R3D !== 'undefined' && R3D.active && R3D.active(), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
}
// Phase 39: the prologue's autopilot. It stops the page's own frame loop (the frame already asked for runs once and asks
// for no more), so time passes only by update() and advanceTime, and the run is the same every time. walkTo presses what
// a player presses, W and the arrow keys to turn, through G.keys (what the keyboard listeners fill), one frame at a time.
async function autopilot(page) {
  await page.evaluate(() => {
    window.requestAnimationFrame = () => 0;
    // the autopilot: it presses what a player presses (W, and the arrow keys to turn) and lets one frame pass
    const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    window.__P39 = {
      // walk to (x, y) until within r; returns where it ended and how long it took
      walkTo(x, y, r, maxMs, opt) {
        const c = Engine.cam, o = opt || {};
        let t = 0, best = 1e9, still = 0;
        const n = Math.round((maxMs || 20000) / (1000 / 60));
        for (let i = 0; i < n; i++) {
          if (G.state !== 'play') { G.keys = {}; return { ok: false, why: 'state ' + G.state + ' ' + (G.openPanel || ''), x: c.x, y: c.y, t, map: G.mapId }; }
          const d = Math.hypot(x - c.x, y - c.y);
          if (d <= (r || 0.4)) break;
          const diff = norm(Math.atan2(y - c.y, x - c.x) - c.dir);
          G.keys = { w: Math.abs(diff) < 0.5, arrowleft: diff < -0.06, arrowright: diff > 0.06, shift: !!o.run };
          update(1 / 60); t += 1 / 60;
          if (d < best - 0.01) { best = d; still = 0; } else if (++still > 240) { G.keys = {}; return { ok: false, why: 'stuck', x: c.x, y: c.y, t, map: G.mapId }; }
        }
        G.keys = {};
        for (let i = 0; i < 20; i++) update(1 / 60);
        render();
        const d = Math.hypot(x - c.x, y - c.y);
        return { ok: d <= (r || 0.4) + 0.3, x: c.x, y: c.y, t, d, map: G.mapId };
      },
      // turn on the spot to a bearing, with the arrow keys
      face(a) {
        const c = Engine.cam;
        for (let i = 0; i < 400; i++) {
          const diff = norm(a - c.dir);
          if (Math.abs(diff) < 0.04 && Math.abs(G.turnV) < 0.05) break;
          G.keys = { arrowleft: diff < -0.03, arrowright: diff > 0.03 };
          update(1 / 60);
        }
        G.keys = {}; for (let i = 0; i < 10; i++) update(1 / 60); render();
        return norm(a - c.dir);
      },
      faceTo(x, y) { const c = Engine.cam; return this.face(Math.atan2(y - c.y, x - c.x)); },
      msgs() { const el = document.getElementById('msgs') || document.getElementById('messages'); return el ? el.innerText : ''; },
      where() { const c = Engine.cam; return { map: G.mapId, x: +c.x.toFixed(2), y: +c.y.toFixed(2), dir: +c.dir.toFixed(2), state: G.state, panel: G.openPanel, hp: G.player && G.player.hp }; },
    };
  });
}
module.exports = { ROOT, ARGS, playwright, serve, open, begin, autopilot };
