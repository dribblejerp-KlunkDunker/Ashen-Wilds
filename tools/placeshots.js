// Usage: NODE_PATH=$(npm root -g) node tools/placeshots.js <outDir> [only]
// Phase 43's stills: some of the highland edge's 56 places, each seen from a few cells off, by day; one from the same
// spot with the switch off; and the map (M) with the places found marked.
'use strict';
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', 'test', 'harness.js'));
const out = path.resolve(process.argv[2] || 'docs/screenshots'), only = process.argv[3];
const NOON = 0.5;
const SHOTS = [
  // name, place number, how far off to stand (cells), from which side (radians, the way you look is back at it), pitch
  ['200_the_greystair_fork', 5, 9, Math.PI * 0.6, -0.02],
  ['201_the_bloom_drifts_east', 6, 13, Math.PI * 0.5, -0.06],
  ['202_the_warm_skeps', 8, 7, Math.PI * 0.5, -0.06],
  ['203_the_slag_fall', 10, 14, Math.PI * 0.4, -0.05],
  ['204_the_warm_shieling', 18, 9, Math.PI * 0.5, -0.04],
  ['205_the_hewers_cross', 23, 7, Math.PI * 0.3, -0.01],
  ['206_the_tenth_tower', 24, 12, Math.PI * 0.5, 0.06],
  ['207_coldbarrows_north_gate', 30, 12, -Math.PI / 2, 0.02],
  ['208_a_carrier_dead_with_his_heat_stones', 33, 4, Math.PI * 0.5, -0.12],
  ['209_wilmots_fold', 39, 12, Math.PI * 0.5, -0.03],
  ['210_the_vent_line', 14, 6, Math.PI * 0.5, -0.14],
  ['211_the_fork_switch_off', 5, 9, Math.PI * 0.6, -0.02, false],
];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const s = await H.open(); await H.begin(s.page);
  await s.page.evaluate(() => { OPEN42.finish(G.maps.la_z1); GFX.laPlaces = true; G.state = 'paused'; loadMap('la_z1', G.maps.la_z1.spawn); G.state = 'play'; });
  const place = ([n, d, side, pitch, on, tod]) => {
    BLOOM4.pose({ map: 'la_bothy', x: 3.5, y: 2.5, state: 'wait' });
    G.flags.la_marget_out = false; G.flags.la_marget_map = null;
    try { CARRY15.releaseNow(); } catch (e) { void e; }
    const k = CARTER13.state(); k.mode = 'hold'; k.map = 'la_ledge'; k.x = 79.9; k.y = 46.2; CARTER13.save();
    GFX.laPlaces = on !== false; PLACES43.sync(); GFX.laPlaces = true;
    const [px, py] = PLACES43.at()[n], m = G.maps.la_z1;
    // stand d cells off on the given side, or turn round it until the ground there is open
    let x = px, y = py, a = side;
    for (let i = 0; i < 16; i++) { a = side + i * 0.4 * (i & 1 ? 1 : -1); x = px + Math.cos(a) * d; y = py + Math.sin(a) * d; if (!m.isBlocked(Math.floor(x), Math.floor(y))) break; }
    G.state = 'paused'; loadMap('la_z1', { x, y, dir: a + Math.PI }); G.state = 'play'; G.day = 3; G.tod = tod; G.fadeT = 0; G.keys = {};
    if (on === false) { GFX.laPlaces = false; PLACES43.sync(); }
    if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(pitch);
    for (let i = 0; i < 300 && R3D.stream().on && R3D.stream().info.chunks < R3D.stream().info.need; i++) render();
    advanceTime(400); G.tod = tod;
    const mm = document.querySelector('#msgs'); if (mm) mm.innerHTML = '';
  };
  for (const [name, ...rest] of SHOTS) {
    if (only && !name.includes(only)) continue;
    const arg = rest.slice(); while (arg.length < 5) arg.push(undefined); arg.push(NOON);
    await s.page.evaluate(place, arg);
    await s.page.waitForTimeout(700);
    await s.page.evaluate((tod) => { G.tod = tod; const m = document.querySelector('#msgs'); if (m) m.innerHTML = ''; }, NOON);
    await s.page.waitForTimeout(250);
    await s.page.screenshot({ path: path.join(out, name + '.png'), clip: { x: 0, y: 0, width: 1280, height: 600 } });
    console.log('wrote ' + name + '.png');
    await s.page.evaluate(() => { GFX.laPlaces = true; PLACES43.sync(); });
  }
  if (!only || '212_the_map_with_places_found'.includes(only)) {
    await s.page.evaluate(() => {
      G.state = 'paused'; loadMap('la_z1', { x: 900.5, y: 515.5, dir: Math.PI / 2 }); G.state = 'play'; G.fadeT = 0;
      const m = G.map;
      // the ledge path, the upper road and the Greystair road marked walked, and the places by them found (set, not walked)
      const F = G.flags.la_found = [];
      for (const w of THRESH40.WAYS.filter((q) => ['The ledge path', 'The upper road', 'The Greystair road'].includes(q.name))) {
        for (let i = 0; i + 1 < w.pts.length; i++) {
          const [ax, ay] = w.pts[i], [bx, by] = w.pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay));
          for (let t = 0; t <= n; t++) {
            const x = ax + (bx - ax) * t / n, y = ay + (by - ay) * t / n;
            for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) if (dx * dx + dy * dy <= 81) { const X = Math.floor(x + dx), Y = Math.floor(y + dy); if (X >= 0 && Y >= 0 && X < m.w && Y < m.h) m.visited[Y * m.w + X] = 1; }
            for (const [k] of PLACES43.PLACES) { const p = PLACES43.at()[k]; if (p && Math.hypot(p[0] - x, p[1] - y) < 14 && !F.includes(k)) F.push(k); }
          }
        }
      }
      G.state = 'panel'; renderMap();
    });
    await s.page.waitForTimeout(400);
    await s.page.screenshot({ path: path.join(out, '212_the_map_with_places_found.png') });
    console.log('wrote 212_the_map_with_places_found.png');
    await s.page.evaluate(() => { closeModal(); G.state = 'play'; });
  }
  await s.close();
})().catch((e) => { console.error(e); process.exit(1); });
