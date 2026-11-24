// node test/stream41.test.js            (add --no-browser to run only the half that needs no browser)
// NODE_PATH=$(npm root -g) node test/stream41.test.js     with Playwright installed globally
// Phase 41, streaming: a big map built and drawn a chunk at a time near the eye; the same triangles as the whole map;
// changes found and rebuilt where they are; small maps and the switch off exactly as before.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const noBrowser = process.argv.includes('--no-browser');
let fails = 0;
const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };

// ---- the setters mark what they change, on a streamed map only
global.GameMap = class { constructor(w, h) { this.w = w; this.h = h; this.cells = new Array(w * h).fill(null); this.floorCells = new Uint8Array(w * h); }
  set(x, y, c) { this.cells[y * this.w + x] = c; } setFloor(x, y, i) { this.floorCells[y * this.w + x] = i; } syncSlopes() {} setSide() {} };
global.window = undefined;
const S = require(path.join(ROOT, 'js', 'stream41.js'));
S.wrap();
const a = new GameMap(8, 8), b = new GameMap(8, 8); b._r3dStream = true;
a.set(1, 1, { tex: 't' }); b.set(2, 3, { tex: 't' }); b.setFloor(4, 5, 1); b.syncSlopes(0, 0, 2, 2);
check(!a._r3dDirty && a._r3dVer === undefined, 'a map the renderer is not streaming is left alone');
check(b._r3dDirty.length === 3 && b._r3dDirty[0].join() === '2,3,3,4' && b._r3dDirty[2].join() === '0,0,3,3' && b._r3dVer === 3, 'a streamed map lists each change and counts it');
check(b.cells[3 * 8 + 2] && b.floorCells[5 * 8 + 4] === 1, 'and the setters still do what they did');

// ---- the renderer's side, read from its source
const r3d = fs.readFileSync(path.join(ROOT, 'js', 'r3d21.js'), 'utf8');
check(/const STREAM = \{ CH: 64, MIN: 65536,/.test(r3d), 'chunks are 64 cells a side; a map is streamed past 65,536 cells');
check(/function fillStatic\(m, B, X0, Y0, X1, Y1, whole\)/.test(r3d) && /const tris = fillStatic\(m, B, 0, 0, m\.w, m\.h, true\);/.test(r3d), 'the whole map is the builder\'s whole rectangle, as before');
check(/GFX\.laStream === false/.test(r3d), 'the switch turns it off');
const l21 = fs.readFileSync(path.join(ROOT, 'js', 'light21.js'), 'utf8');
check(/mm\._r3dStream \? 'v' \+ \(mm\._r3dVer \| 0\) : heightSig\(mm\)/.test(l21), 'the sun\'s heights follow the map\'s count of changes, not a hash of every cell');
const src = fs.readFileSync(path.join(ROOT, 'js', 'stream41.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src) && !/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'plain ASCII, no clock and no dice');
check(!src.split('\n').some((l) => /\S.*[;{)]\s*\/\/ /.test(l)), 'no comment after code on a line');

// ---------------------------------------------------------------- the browser half
(async () => {
  if (noBrowser) return;
  const H = require(path.join(__dirname, 'harness.js'));
  const L = require(path.join(ROOT, 'tools', 'limits.js'));
  const pw = H.playwright();
  if (!pw) { console.log('SKIP the browser half: Playwright not found (NODE_PATH=$(npm root -g))'); return; }
  // the harness's page, with every static upload of geometry kept, to compare triangles
  const srv = await H.serve();
  const browser = await pw.chromium.launch({ args: H.ARGS });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERR ' + String(e.message).slice(0, 240)));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource|GPU stall|swiftshader|WebGL-.*fallback|READ-usage/i.test(m.text())) errors.push('CONSOLE ' + m.text().slice(0, 240)); if (/meshExt|stream/i.test(m.text()) && m.type() === 'warning') errors.push('WARN ' + m.text().slice(0, 240)); });
  await page.addInitScript(() => {
    window.__r3d21 = { automation: true }; window.__up = [];
    const bd = WebGL2RenderingContext.prototype.bufferData;
    WebGL2RenderingContext.prototype.bufferData = function (t, d, u) { try { if (window.__cap && d && d.byteLength > 64 && u === this.STATIC_DRAW) window.__up.push([t === this.ARRAY_BUFFER ? 'v' : 'i', d.slice()]); } catch (e) { void e; } return bd.apply(this, arguments); };
  });
  try {
    await page.goto(srv.url, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof G !== 'undefined' && typeof LEDGE1 !== 'undefined' && !(document.querySelector('#loading') && document.querySelector('#loading').classList.contains('on')), null, { timeout: 60000 });
    await H.begin(page);
    const ev = (fn, arg) => page.evaluate(fn, arg);
    await ev(() => {
      // every triangle of the captured static uploads, as a sorted list of hashes of its three vertices (order-free)
      window.__tris = () => {
        const out = [];
        for (let i = 0; i + 1 < window.__up.length; i++) {
          const [tv, v] = window.__up[i], [ti, ix] = window.__up[i + 1];
          if (tv !== 'v' || ti !== 'i') continue;
          const bits = new Uint32Array(v.buffer, v.byteOffset, v.byteLength / 4), u = new Uint32Array(ix.buffer, ix.byteOffset, ix.byteLength / 4);
          for (let t = 0; t + 2 < u.length; t += 3) {
            const hv = [];
            for (let k = 0; k < 3; k++) { let h = 0x811c9dc5 | 0; const o = u[t + k] * 12; for (let q = 0; q < 12; q++) h = Math.imul(h ^ bits[o + q], 16777619) | 0; hv.push(h >>> 0); }
            hv.sort((p, q) => p - q); out.push(((hv[0] * 31 + hv[1]) * 31 + hv[2]) >>> 0);
          }
          i++;
        }
        return out.sort((p, q) => p - q);
      };
    });

    // ---- 1. the ledge and the bothy are built whole, as before
    const a1 = await ev(() => {
      const out = {};
      for (const id of ['la_ledge', 'la_bothy']) { G.state = 'paused'; loadMap(id, G.maps[id].spawn); G.state = 'play'; render(); out[id] = R3D.stream().on; }
      out.row = LEDGE1.SWITCHES.some((r) => r[0] === 'laStream');
      return out;
    });
    check(a1.la_ledge === false && a1.la_bothy === false, 'the ledge and the bothy are small: built whole, as before');
    check(a1.row, 'Options has the switch "Stream large maps"');

    // ---- 2. a 300 x 300 map streamed is the very same triangles as built whole
    await ev(L.buildInPage, 300);
    const a2 = await ev(() => {
      const { m, id } = window.__lim; G.maps[id] = m;
      const go = (on) => {
        GFX.laStream = on; window.__up = []; window.__cap = true;
        G.state = 'paused'; loadMap(id, { x: 150.5, y: 150.5, dir: 0 }); G.state = 'play'; R3D.invalidate();
        for (let i = 0; i < 40; i++) render();
        window.__cap = false;
        return { t: window.__tris(), st: R3D.stream() };
      };
      const whole = go(false), part = go(true);
      let same = whole.t.length === part.t.length;
      if (same) for (let i = 0; i < whole.t.length; i++) if (whole.t[i] !== part.t[i]) { same = false; break; }
      return { n: whole.t.length, same, chunks: part.st.chunks, on: part.st.on };
    });
    check(a2.on && a2.chunks === 25 && a2.same && a2.n > 500000, 'a 300 x 300 map in 25 chunks is the same ' + a2.n + ' triangles as built whole, to the bit');

    // ---- 3. a change rebuilds the chunk it is in; a write round the setters is found too
    const a3 = await ev(() => {
      const { m } = window.__lim, st0 = R3D.stream().rebuilt;
      m.block(150, 152, 't_la_rock', 20, { capTex: 't_la_frost' });
      render(); const st1 = R3D.stream().rebuilt;
      m.cells[160 * m.w + 160] = { tex: 't_la_rock', top: 22 };
      let n = 0; for (; n < 60 && R3D.stream().rebuilt === st1; n++) render();
      return { set: st1 - st0, found: R3D.stream().rebuilt > st1, frames: n, ver: m._r3dVer | 0 };
    });
    check(a3.set >= 1 && a3.set <= 4, 'a block set with the map\'s setter rebuilds its chunk (and a neighbour at an edge) at once: ' + a3.set);
    check(a3.found && a3.frames < 40 && a3.ver > 0, 'a cell written straight into the array is found within ' + a3.frames + ' frames, and counted');

    // ---- 4. a square mile: the chunks near the eye only, let go behind
    await ev(L.buildInPage, 1600);
    const a4 = await ev(() => {
      const { m, id } = window.__lim; G.maps[id] = m; GFX.laStream = true;
      const t0 = performance.now(); G.state = 'paused'; loadMap(id, { x: 400.5, y: 400.5, dir: 0 }); G.state = 'play'; render(); R3D.gl().finish();
      const first = performance.now() - t0;
      for (let i = 0; i < 200 && R3D.stream().info.chunks < R3D.stream().info.need; i++) render();
      const at = R3D.stream();
      Engine.cam.x = 1200.5; Engine.cam.y = 1200.5; settleFeet();
      for (let i = 0; i < 200 && R3D.stream().info.chunks < R3D.stream().info.need; i++) render();
      for (let i = 0; i < 3; i++) render();
      const later = R3D.stream();
      return { first: Math.round(first), chunks: at.info.chunks, tris: at.info.tris, later: later.info.chunks, freed: later.freed, keys: later.keys.every((k) => { const [x, y] = k.split(',').map(Number); return Math.abs(x * 64 + 32 - 1200) < 300 && Math.abs(y * 64 + 32 - 1200) < 300; }) };
    });
    console.log('   1600 x 1600: first frame ' + a4.first + ' ms here (software); ' + a4.chunks + ' chunks, ' + a4.tris + ' triangles kept');
    check(a4.chunks <= 45 && a4.tris < 1.8e6, 'on a 1600 x 1600 map no more than 45 chunks are kept (' + a4.chunks + '), whatever the map\'s size');
    check(a4.freed > 0 && a4.later <= 45 && a4.keys, 'walking 800 cells on, the chunks behind are let go and only those round the eye remain');
    check(a4.first < 3000, 'entering it takes ' + a4.first + ' ms here, not the 5 s of the whole map');

    // ---- 5. the switch off: the whole map again
    const a5 = await ev(() => { GFX.laStream = false; G.state = 'paused'; loadMap('la_z1_2_0', G.maps.la_z1_2_0.spawn); G.state = 'play'; render(); const off = R3D.stream().on; GFX.laStream = true; render(); return { off, on: R3D.stream().on }; });
    check(a5.off === false && a5.on === true, 'off, a big map is built whole; on, it streams again');

    check(errors.length === 0, 'no page errors or renderer warnings: ' + (errors[0] || 'none'));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); console.log(e.stack.split('\n').slice(0, 4).join('\n')); }
  await browser.close(); srv.srv.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
