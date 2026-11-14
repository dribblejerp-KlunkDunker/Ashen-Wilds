// node test/building8.test.js               (add --no-browser to run only the half that needs no browser)
// NODE_PATH=$(npm root -g) node test/building8.test.js        with Playwright installed globally
// Phase 8, the highland edge's way of building (P16). Without a browser: the stone is the owner's look-test drystone pixel
// for pixel, the turf roof and the window are painted in code and tile, and the words are the bible's. In a browser: the
// planner builds the bothy hipped, low, under turf, with one window on the lee side and none on the weather side, a hole
// in the roof that smokes, the stone outside and in, sleet still stopping at the new roof, and the switch putting back
// exactly what was there.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const B8 = require(path.join(ROOT, 'js', 'building8.js')), LOOK = require(path.join(ROOT, 'tools', 'look', 'highland-materials.js'));
let fails = 0;
const check = (cond, label) => { if (cond) console.log('PASS ' + label); else { fails++; console.log('FAIL ' + label); } };
const src = fs.readFileSync(path.join(ROOT, 'js', 'building8.js'), 'utf8'), road = fs.readFileSync(path.join(ROOT, 'ROADMAP.md'), 'utf8');
const smother = fs.readFileSync(path.join(ROOT, 'docs', 'worldbuilding', 'the-smothering.md'), 'utf8'), ledge = fs.readFileSync(path.join(ROOT, 'js', 'ledge1.js'), 'utf8');
const lum = (p) => ((p & 255) + ((p >>> 8) & 255) + ((p >>> 16) & 255)) / 3;

// ---- what it rests on
check(/\| P16 \| \*\*How the highland edge builds\*\*[^|]*field stone laid dry, under turf and heather; one low room, one door, no window on the weather side/.test(road), 'P16 (approved) says how the highland edge builds: field stone laid dry, under turf and heather; one low room, one door, no window on the weather side');
check(/The ash comes on the wind, mostly from the north/.test(smother) && B8.B.weather[0] === 0 && B8.B.weather[1] === -1, 'the weather side is north: the bible\'s "The ash comes on the wind, mostly from the north"');
check(/Smoke at the hole in the roof/.test(ledge), 'the bothy has a hole in the roof, not a chimney: Phase 1\'s approved door line, "Smoke at the hole in the roof"');

// ---- the stone: the owner's look test, pixel for pixel
const stone = B8.paintStone(), look = LOOK.paint('drystone'); let diff = 0; for (let i = 0; i < 4096; i++) if (stone[i] !== look[i]) diff++;
check(stone.length === 4096 && diff === 0, 'the walls are the owner\'s highland drystone (tools/look/highland-materials.js), every one of 4096 pixels the same');

// ---- the turf roof
const turf = B8.paintTurf(); let tile = true, opaque = true, sum = 0; const cols = new Set(turf);
for (let y = -4; y < 68 && tile; y++) for (let x = -4; x < 68; x++) if (B8.turfAt(x, y) !== B8.turfAt(x + 64, y) || B8.turfAt(x, y) !== B8.turfAt(x, y + 64)) { tile = false; break; }
for (const p of turf) { if (p >>> 24 !== 255) opaque = false; sum += lum(p); }
const kind = (p) => { const r = p & 255, g = (p >>> 8) & 255, b = (p >>> 16) & 255; return b > r + 8 ? 'frost' : r > g + 5 && b > g ? 'heather' : Math.abs(r - b) < 4 && Math.abs(g - b) < 4 && r > 35 ? 'ash' : r > 48 && g > 42 && b < g - 8 ? 'grass' : 'sod'; };
const kinds = {}; for (const p of turf) kinds[kind(p)] = (kinds[kind(p)] || 0) + 1;
check(turf.length === 4096 && opaque && tile, 'the turf roof is a 64 x 64 tile painted in code, opaque, and it repeats without a seam');
check(sum / 4096 < 40 && cols.size <= 24, 'and it is dark, in a few dithered steps (mean ' + (sum / 4096).toFixed(1) + ' of 255, ' + cols.size + ' colours): black is the base colour');
check(kinds.sod > 2000 && kinds.heather > 150 && kinds.ash > 60 && kinds.frost > 10 && kinds.grass > 40, 'sod, with heather, dead grass, a crust of ash and frost in it: ' + JSON.stringify(kinds));

// ---- the window, from inside
const win = B8.paintWindow(); let night = 0, rest = 0, restSame = 0;
for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const p = win[y * 64 + x], inOpen = x >= 25 && x <= 38 && y >= 18 && y <= 31; if (inOpen) { if (lum(p) < 30) night++; } else if (x < 15 || x > 48 || y < 8 || y > 42) { rest++; if (p === B8.stoneAt(x, y)) restSame++; } }
check(night > 180 && restSame === rest, 'inside, the window is a small deep opening on the night (' + night + ' dark pixels of 196) in the same stone as the rest of the wall');

// ---- the rules of the house
check(!/[^\x00-\x7f]/.test(src), 'the file is plain ASCII, and so is every word it puts in the game');
check(!/Math\.random|Date\.now|performance\.now/.test(src), 'nothing in it is random or read off a clock: the smoke\'s jitter is a hash of a counter');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), swjs = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
check(/js\/lantern7\.js\?v=\d+"><\/script>\s*<script src="js\/building8\.js\?v=\d+"><\/script>/.test(html) && /js\/building8\.js\?v=\d+/.test(swjs) && !/tools\/look/.test(html), 'index.html loads building8.js after lantern7.js, the offline list carries it, and the look test itself is still not loaded');

// ---- the played half, in a browser
(async () => {
  const HN = require('./harness.js');
  if (process.argv.includes('--no-browser') || !HN.playwright()) { console.log('SKIPPED the browser half of this test (no Playwright: set PLAYWRIGHT_MODULE or NODE_PATH)'); return; }
  const s = await HN.open();
  try {
    await HN.begin(s.page);
    const r = await s.page.evaluate(() => {
      const out = {};
      const at = (on, map, x, y, dir, tod, pitch) => { BLOOM4.reset(); G.flags = { la_told_bar: true }; GFX.laBuild = on; loadMap(map, { x, y, dir }); G.state = 'play'; G.day = 2; G.tod = tod; G.fadeT = 0; G.keys = {}; R3D.camera.setAngle(pitch || 0); advanceTime(200); G.tod = tod; };
      const pn = performance.now.bind(performance), dn = Date.now, t0 = pn(), d0 = dn();
      const frame = () => { performance.now = () => t0; Date.now = () => d0; const a0 = ANIM.T; ANIM.T = a0; render(); ANIM.T = a0; render(); const p = R3D.readPixels(); performance.now = pn; Date.now = dn; ANIM.T = a0; return p; };
      const fnv = (d) => { let x = 0x811c9dc5 | 0; for (let i = 0; i < d.length; i++) x = Math.imul(x ^ d[i], 16777619) | 0; return x >>> 0; };
      try { renderAccessibilityMenu(); const b = document.getElementById('gfx-labuild'); out.row = b ? b.textContent : null; if (typeof closeModal === 'function') closeModal(); } catch (e) { out.row = String(e); }
      // the plan, on
      at(true, LEDGE1.LEDGE, 87.6, 33.4, 3.91, 0.8, -0.04);
      const m = G.maps[LEDGE1.LEDGE], p = EAVES78.planOf(m), b = p.houses[0], base = b.top - 1;
      out.on = { n: p.houses.length, type: b.type, roof: b.roofTex, ridgeAbove: b.ridge - base, over: b.over, plinth: b.plinth.length, dormers: b.dormers.length, windows: b.windows.map((w) => ({ nx: w.nx, ny: w.ny, style: w.style, x: Math.floor(w.cx), lit: w.lit })), hole: b.hole, door: b.doors.map((d) => [d.x, d.y, d.nx, d.ny]) };
      out.on.holeOnRidge = Math.abs(EAVES78.roofZ(b, b.hole.x, b.hole.y) - b.ridge) < 1e-6;
      out.style = EAVES78.STYLES[LEDGE1.LEDGE].builds;
      // sleet still stops at the roof: everywhere over the bothy's cells, at the roof's own height
      const sh = EAVES78.shelter(m); let covered = 0, total = 0, matches = 0;
      for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) { total++; const i = (y * sh.k + 2) * sh.w + x * sh.k + 2; if (sh.data[i] > base + 0.9) covered++; }
      for (const [fx, fy] of [[b.hole.x, b.hole.y], [b.x0 + 0.3, b.y0 + 0.3], [b.x1 + 0.7, b.y1 + 0.7]]) { const i = Math.floor(fy * sh.k) * sh.w + Math.floor(fx * sh.k), z = EAVES78.roofZ(b, (Math.floor(fx * sh.k) + 0.5) / sh.k, (Math.floor(fy * sh.k) + 0.5) / sh.k); if (z != null && Math.abs(sh.data[i] - z) < 0.02) matches++; }
      out.shelter = { covered, total, matches };
      // the stone and the window inside
      out.stone = { on: Engine.textures[BUILD8.STONE] === BUILD8.state().stone };
      const bothy = G.maps[LEDGE1.BOTHY]; out.winCell = bothy.cells[5 * bothy.w + 4].tex;
      // the smoke: stand near and wait
      FIRESMOKE.reset(); const p0 = BUILD8.state().puffs; for (let i = 0; i < 25; i++) { G.tod = 0.8; advanceTime(200); }
      let near = 0, high = 0; FIRESMOKE.each((q) => { if (q.kind === 0 && Math.hypot(q.x - b.hole.x, q.y - b.hole.y) < 1.6) { near++; if (q.z > b.ridge) high++; } });
      out.smoke = { spawned: BUILD8.state().puffs - p0, near, high };
      // the frames: on, and off
      const fOn = frame(); out.hashOn = fnv(fOn.data);
      at(false, LEDGE1.LEDGE, 87.6, 33.4, 3.91, 0.8, -0.04);
      const q = EAVES78.planOf(m), qb = q.houses[0];
      out.off = { type: qb.type, roof: qb.roofTex, windows: qb.windows.length, hole: !!qb.hole, stone: Engine.textures[BUILD8.STONE] === BUILD8.state().old, winCell: bothy.cells[5 * bothy.w + 4].tex };
      FIRESMOKE.reset(); const p1 = BUILD8.state().puffs; for (let i = 0; i < 10; i++) advanceTime(200); out.off.puffs = BUILD8.state().puffs - p1; FIRESMOKE.reset();
      const fOff = frame(); out.hashOff = fnv(fOff.data);
      // the same frame with this phase taken out altogether: Phase 1's style row, its stone, no mesh of ours
      const mine = EAVES78.STYLES[LEDGE1.LEDGE]; EAVES78.STYLES[LEDGE1.LEDGE] = BUILD8.orig(); m.cells = m.cells.slice(); R3D.invalidate();
      const fBare = frame(); out.hashBare = fnv(fBare.data); EAVES78.STYLES[LEDGE1.LEDGE] = mine; m.cells = m.cells.slice(); R3D.invalidate();
      // inside, off and on
      at(false, LEDGE1.BOTHY, 3.0, 2.2, 1.22, 0.8, -0.05); FIRESMOKE.reset(); out.inOff = fnv(frame().data);
      at(true, LEDGE1.BOTHY, 3.0, 2.2, 1.22, 0.8, -0.05); FIRESMOKE.reset(); out.inOn = fnv(frame().data);
      GFX.laBuild = true; advanceTime(50);
      out.err = BUILD8.state().err || null;
      return out;
    });
    check(r.row === 'On', 'Options has a row for the highland building');
    check(r.on.n === 1 && r.on.type === 'hip' && r.on.roof === 'la_turf' && r.on.ridgeAbove <= 2.1 + 1e-6 && r.on.over <= 0.1, 'PLAYED: the bothy is roofed the highland way: hipped all round, turf, low (ridge ' + r.on.ridgeAbove.toFixed(2) + ' above its ground), eaves cut short at the wall head');
    check(r.on.windows.length === 1 && r.on.windows[0].ny === 1 && r.on.windows[0].style === 'attic' && r.on.windows[0].lit && !r.on.windows.some((w) => w.ny === -1), 'one small window, on the lee side (south), lit by the fire after dusk; none on the weather side, none in the roof, no shutters: ' + JSON.stringify(r.on.windows));
    check(r.on.door.length === 1 && r.on.door[0][3] === 1 && Math.abs(r.on.windows[0].x - r.on.door[0][0]) === 1, 'one door, and the window beside it');
    check(r.on.plinth === 0 && r.on.dormers === 0, 'no stone footing and no dormers: the walls are the footing');
    check(r.on.hole && r.on.holeOnRidge, 'the hole in the roof is on the ridge, over the middle of the room');
    check(/turf and heather/.test(r.style) && !/thatch/.test(r.style), 'the style table says it: "' + r.style + '"');
    check(r.shelter.covered === r.shelter.total && r.shelter.matches === 3, 'sleet still stops at the roof: all ' + r.shelter.total + ' of its cells are covered, at the turf\'s own height');
    check(r.stone.on && r.winCell === 't_house_la_drystone_win', 'the walls, outside and in, take the highland drystone; the window is in the bothy\'s south wall inside too');
    check(r.smoke.spawned >= 4 && r.smoke.near >= 3 && r.smoke.high >= 3, 'PLAYED: smoke comes out of the hole and rises (' + r.smoke.spawned + ' puffs in five seconds, ' + r.smoke.near + ' over the roof)');
    check(r.off.type === 'gable' && r.off.roof === 'e78_thatch' && r.off.windows === 5 && !r.off.hole && r.off.stone && r.off.winCell === 't_house_la_drystone' && r.off.puffs === 0, 'switched off: the timber planner\'s thatch roof and its five windows, Phase 1\'s stone, no hole and no smoke');
    check(r.hashOff === r.hashBare, 'switched off, the frame is exactly the frame with this phase taken out (' + r.hashOff + ')');
    check(r.hashOn !== r.hashOff && r.inOn !== r.inOff, 'and switched on, outside and inside both change');
    check(!r.err, 'nothing threw: ' + (r.err || 'none'));
    check(s.errors.length === 0, 'no page errors: ' + (s.errors[0] || 'none'));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); }
  await s.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
