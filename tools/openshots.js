// Usage: NODE_PATH=$(npm root -g) node tools/openshots.js <outDir> [only]
// Phase 42's stills: the highland edge as one open map. Two pairs taken from the same spot, before (Phase 40's maps,
// with the band of rock at their seam) and after (the open map); the crag's foot; the long view south from the ramp
// foot; the upper road's notch at the zone's south edge; and the map (M) of the open country. Daylight, so the shapes
// read.
'use strict';
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', 'test', 'harness.js'));
const out = path.resolve(process.argv[2] || 'docs/screenshots'), only = process.argv[3];
const NOON = 0.5;
const SHOTS = [
  // name, map, camera x, y (in that map's cells), heading (radians), pitch
  ['190_before_the_band_at_the_seam', 'la_z1_2_0', 196.5, 352, 1.62, -0.03],
  ['191_after_open_country_at_the_seam', 'la_z1', 964.5, 352, 1.62, -0.03],
  ['192_before_the_fork_looking_north', 'la_z1_2_1', 132, 140, -Math.PI / 2 + 0.3, 0.0],
  ['193_after_the_fork_looking_north', 'la_z1', 900, 504, -Math.PI / 2 + 0.3, 0.0],
  ['194_open_the_crags_foot', 'la_z1', 990.5, 146, Math.PI / 2, -0.05],
  ['195_open_the_long_view_south', 'la_z1', 1000.5, 252.5, Math.PI / 2 + 0.35, -0.02],
  ['196_open_the_upper_road_ends', 'la_z1', 760.5, 1512, Math.PI / 2, -0.04],
];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const s = await H.open(); await H.begin(s.page);
  await s.page.evaluate(() => { OPEN42.finish(G.maps.la_z1); });
  const place = ([map, x, y, dir, pitch, tod]) => {
    BLOOM4.pose({ map: 'la_bothy', x: 3.5, y: 2.5, state: 'wait' });
    G.flags.la_marget_out = false; G.flags.la_marget_map = null;
    try { CARRY15.releaseNow(); } catch (e) { void e; }
    const k = CARTER13.state(); k.mode = 'hold'; k.map = 'la_ledge'; k.x = 79.9; k.y = 46.2; CARTER13.save();
    G.state = 'paused'; loadMap(map, { x, y, dir }); G.state = 'play'; G.day = 3; G.tod = tod; G.fadeT = 0; G.keys = {};
    if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(pitch);
    for (let i = 0; i < 300 && R3D.stream().on && R3D.stream().info.chunks < R3D.stream().info.need; i++) render();
    advanceTime(400); G.tod = tod;
    const m = document.querySelector('#msgs'); if (m) m.innerHTML = '';
  };
  for (const [name, ...rest] of SHOTS) {
    if (only && !name.includes(only)) continue;
    await s.page.evaluate(place, rest.concat([NOON]));
    await s.page.waitForTimeout(700);
    await s.page.evaluate((tod) => { G.tod = tod; const m = document.querySelector('#msgs'); if (m) m.innerHTML = ''; }, NOON);
    await s.page.waitForTimeout(250);
    await s.page.screenshot({ path: path.join(out, name + '.png'), clip: { x: 0, y: 0, width: 1280, height: 600 } });
    console.log('wrote ' + name + '.png');
  }
  // the map (M): the ways from the crag to the fork and down the upper road marked walked (set here, not walked)
  if (!only || '197_open_the_map'.includes(only)) {
    await s.page.evaluate(() => {
      G.state = 'paused'; loadMap('la_z1', { x: 900.5, y: 515.5, dir: Math.PI / 2 }); G.state = 'play'; G.fadeT = 0;
      const m = G.map;
      for (const w of THRESH40.WAYS.filter((q) => ['The ledge path', 'The upper road', 'The Greystair road'].includes(q.name))) {
        for (let i = 0; i + 1 < w.pts.length; i++) {
          const [ax, ay] = w.pts[i], [bx, by] = w.pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay));
          for (let t = 0; t <= n; t++) {
            const x = ax + (bx - ax) * t / n, y = ay + (by - ay) * t / n;
            for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) if (dx * dx + dy * dy <= 81) { const X = Math.floor(x + dx), Y = Math.floor(y + dy); if (X >= 0 && Y >= 0 && X < m.w && Y < m.h) m.visited[Y * m.w + X] = 1; }
          }
        }
      }
      G.state = 'panel'; renderMap();
    });
    await s.page.waitForTimeout(400);
    await s.page.screenshot({ path: path.join(out, '197_open_the_map.png') });
    console.log('wrote 197_open_the_map.png');
    await s.page.evaluate(() => { closeModal(); G.state = 'play'; });
  }
  await s.close();
})().catch((e) => { console.error(e); process.exit(1); });
