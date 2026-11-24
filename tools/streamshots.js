// Usage: NODE_PATH=$(npm root -g) node tools/streamshots.js <outDir>
// Phase 41's stills: the Greystair fork with streaming on and off (they should look the same), and the 1600 x 1600 test
// map of tools/limits.js (a square mile) seen from inside, streamed.
'use strict';
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', 'test', 'harness.js'));
const L = require(path.join(__dirname, 'limits.js'));
const out = path.resolve(process.argv[2] || 'docs/screenshots');
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const s = await H.open(); await H.begin(s.page);
  const shot = async (name, arg) => {
    await s.page.evaluate(([map, x, y, dir, pitch, on]) => {
      BLOOM4.pose({ map: 'la_bothy', x: 3.5, y: 2.5, state: 'wait' });
      GFX.laStream = on; G.state = 'paused'; loadMap(map, { x, y, dir }); G.state = 'play'; G.day = 3; G.tod = 0.5; G.fadeT = 0; G.keys = {};
      if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(pitch);
      for (let i = 0; i < 300 && R3D.stream().on && R3D.stream().info.chunks < R3D.stream().info.need; i++) render();
      advanceTime(300); G.tod = 0.5;
      const m = document.querySelector('#msgs'); if (m) m.innerHTML = '';
    }, arg);
    await s.page.waitForTimeout(700);
    await s.page.evaluate(() => { G.tod = 0.5; const m = document.querySelector('#msgs'); if (m) m.innerHTML = ''; });
    await s.page.waitForTimeout(250);
    await s.page.screenshot({ path: path.join(out, name + '.png'), clip: { x: 0, y: 0, width: 1280, height: 600 } });
    console.log('wrote ' + name + '.png');
  };
  await shot('180_the_fork_streamed', ['la_z1_2_1', 140, 150, Math.PI * 0.85, -0.03, true]);
  await shot('181_the_fork_built_whole', ['la_z1_2_1', 140, 150, Math.PI * 0.85, -0.03, false]);
  await s.page.evaluate(L.buildInPage, 1600);
  await s.page.evaluate(() => { const { m, id } = window.__lim; G.maps[id] = m; });
  await shot('182_a_square_mile_streamed', ['la_limits_1600', 800.5, 805.5, -0.4, -0.04, true]);
  await s.page.evaluate(() => { GFX.laStream = true; });
  await s.close();
})().catch((e) => { console.error(e); process.exit(1); });
