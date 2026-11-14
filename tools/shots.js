// Usage: NODE_PATH=$(npm root -g) node tools/shots.js . docs/screenshots [only]
// Serves the game, presses Begin, forces the 3D renderer, and writes stills. Reports page errors and missing files.
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const [root, out, only] = process.argv.slice(2);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const missing = new Set();
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(root, p);
  fs.readFile(f, (e, d) => { if (e) { missing.add(p); r.writeHead(404); r.end(); } else { if (p === '/index.html' && process.env.LA_EX) { const ex = new Set(process.env.LA_EX.split(/[\s,]+/)); d = Buffer.from(String(d).replace(/[ \t]*<script[^>]*src="([^"?]*)[^"]*"[^>]*><\/script>\s*\n?/g, (m, src) => ex.has(path.basename(src).replace(/\.js$/, '')) ? '' : m)); } r.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); r.end(d); } }); });
const SHOTS = [
  ['01_the_ledge', null, null, null, 0, false],
  ['02_at_the_edge', 78.35, 49.2, 178, -0.2, false],
  ['03_the_carter', 82.6, 47.9, 212, 0, false],
  ['04_the_bloom', 78.35, 55.5, 152, -0.3, false],
  ['05_the_bothy', 87.6, 33.4, 224, 0.04, false],
  ['06_marget_sayle', 'bothy', null, null, 0, false],
  ['07_down_on_the_plain', 72.5, 44.5, 180, -0.1, false],
];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  await new Promise(res => srv.listen(0, '127.0.0.1', res)); const port = srv.address().port;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 240))); page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/404|Failed to load resource|GPU stall|swiftshader|WebGL-.*fallback/i.test(m.text())) errs.push(m.type().toUpperCase() + ' ' + m.text().slice(0, 240)); });
  await page.addInitScript(() => { window.__r3d21 = { automation: true }; });
  await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load' });
  let at = 'boot';
  try {
    await page.waitForFunction(() => typeof Engine !== 'undefined' && typeof G !== 'undefined' && typeof LEDGE1 !== 'undefined' && !document.querySelector('#loading')?.classList.contains('on'), null, { timeout: 60000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(out, '00_title.png') });
    at = 'begin'; await page.locator('#btn-new').first().dispatchEvent('click');
    await page.waitForFunction(() => G.state === 'intro' || G.state === 'play', null, { timeout: 20000 });
    await page.waitForTimeout(600); await page.screenshot({ path: path.join(out, '00_intro.png') });
    at = 'skip'; await page.locator('#btn-intro-skip').first().dispatchEvent('click');
    await page.waitForFunction(() => G.state === 'play', null, { timeout: 20000 });
    at = 'r3d'; await page.evaluate(() => { if (typeof R3D !== 'undefined') R3D.setMode('on'); });
    await page.waitForTimeout(3000);
    for (const [name, x, y, deg, look, keepMsgs] of SHOTS) {
      if (only && !name.includes(only)) continue;
      at = name;
      await page.evaluate(([x, y, deg, look]) => {
        if (x === 'bothy') loadMap(LEDGE1.BOTHY); else if (x != null) loadMap(LEDGE1.LEDGE, { x, y, dir: deg * Math.PI / 180 });
        G.state = 'play'; G.tod = 0.735; G.fadeT = 0; G.keys = {}; if (G.vel) G.vel.x = G.vel.y = 0;
        if (typeof R3D !== 'undefined' && R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(look || 0);
        const n = document.querySelector('#msgs'); if (n) n.innerHTML = ''; const h = document.querySelector('#hint'); if (h) h.textContent = ''; const l = document.querySelector('#lockhint'); if (l) l.classList.remove('on');
      }, [x, y, deg, look]);
      await page.waitForTimeout(2200);
      await page.screenshot({ path: path.join(out, name + '.png') });
    }
    if (!only || 'talk'.includes(only)) {
      at = '08_talk';
      await page.evaluate(() => { loadMap(LEDGE1.BOTHY); G.state = 'play'; const e = G.ents.find((q) => q.kind === 'npc'); if (e) talk(e); });
      await page.waitForTimeout(1500); await page.screenshot({ path: path.join(out, '08_talking_to_marget.png') });
    }
    at = 'done';
  } catch (e) { errs.push('STOPPED at ' + at + ': ' + e.message.split('\n')[0].slice(0, 200)); await page.screenshot({ path: path.join(out, 'zz_stopped.png') }).catch(() => {}); }
  const info = await page.evaluate(() => ({ state: G.state, map: G.map && G.map.id, maps: Object.keys(G.maps || {}), r3d: typeof R3D !== 'undefined' ? R3D.active() : null, gl: typeof LEDGE1 !== 'undefined' ? LEDGE1.gl().failed : 'no LEDGE1', passes: typeof R3D !== 'undefined' && R3D.passes ? R3D.passes().map(p => p.name + ':' + p.order).join(' ') : '', cam: [Engine.cam.x.toFixed(1), Engine.cam.y.toFixed(1), (Engine.cam.z || 0).toFixed(2)], tris: R3D.stats && R3D.stats.tris })).catch(e => ({ evalfail: e.message.slice(0, 160) }));
  console.log(at, JSON.stringify(info));
  const uniq = [...new Set(errs)]; console.log(uniq.length + ' distinct errors/warnings'); console.log(uniq.slice(0, 30).join('\n'));
  console.log('missing files:', [...missing].slice(0, 40).join(' '));
  await b.close(); srv.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
