// Usage: NODE_PATH=$(npm root -g) node tools/bloomshots.js <outDir> [only]
// Phase 4's stills: the walking bloom at its post on the shelf, passed behind, coming, clawing, by daylight, waiting
// off Marget Sayle's door, and as the flat painted figure the classic renderer and the switch show instead.
'use strict';
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', 'test', 'harness.js'));
const out = path.resolve(process.argv[2] || 'docs/screenshots'), only = process.argv[3];
const SHOTS = [
  // name, day, hour, camera x, y, heading (degrees, 0 east, clockwise), pitch, pose (null: at its post), bodies switch
  ['30_from_the_ramp', 0, 0.735, 86.9, 35.0, 284, -0.2, null, true],
  ['31_passing_behind_it', 0, 0.735, 86.3, 32.5, 322, 0.0, null, true],
  ['32_it_has_heard', 0, 0.735, 85.6, 31.6, 0, 0.0, { x: 87.6, y: 31.6, yaw: Math.PI, state: 'come', walk: 1, alert: 1, phase: 1.2 }, true],
  ['33_the_claw', 0, 0.735, 86.2, 31.6, 0, 0.04, { x: 87.05, y: 31.6, yaw: Math.PI, state: 'claw', walk: 0, alert: 1, reach: 1, phase: 0.4 }, true],
  ['34_by_daylight', 1, 0.5, 86.9, 32.1, 320, 0.0, null, true],
  ['35_waiting_off_the_door', 0, 0.735, 83.5, 30.6, 27, 0.0, { x: 85.3, y: 31.5, yaw: Math.PI + 0.45, state: 'wait', walk: 0, alert: 0.4, phase: 2.0 }, true],
  ['36_the_flat_figure', 0, 0.735, 86.3, 32.5, 322, 0.0, null, false],
];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const s = await H.open(); await H.begin(s.page);
  for (const [name, day, tod, x, y, deg, pitch, pose, bodies] of SHOTS) {
    if (only && !name.includes(only)) continue;
    await s.page.evaluate(([day, tod, x, y, deg, pitch, pose, bodies]) => {
      loadMap(LEDGE1.LEDGE, { x, y, dir: deg * Math.PI / 180 }); G.state = 'play'; G.day = day; G.tod = tod; G.fadeT = 0; Weather.hold('clear'); GFX.laBodies = bodies;
      BLOOM4.reset(); BLOOM4.pose(pose || {});
      if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(pitch);
      advanceTime(900); G.tod = tod; advanceTime(50); G.tod = tod; const m = document.querySelector('#msgs'); if (m) m.innerHTML = '';
    }, [day, tod, x, y, deg, pitch, pose, bodies]);
    await s.page.waitForTimeout(700);
    await s.page.evaluate(([tod]) => { G.tod = tod; const m = document.querySelector('#msgs'); if (m) m.innerHTML = ''; }, [tod]);
    await s.page.waitForTimeout(250);
    await s.page.screenshot({ path: path.join(out, name + '.png'), clip: { x: 0, y: 0, width: 1280, height: 600 } });
    console.log('wrote ' + name + '.png');
  }
  const info = await s.page.evaluate(() => ({ gl: BLOOM4.gl().failed || 'ok', drawn: BLOOM4.gl().drawn, tickErr: BLOOM4.gl().tickErr || null, modelled: BLOOM4.modelled() }));
  console.log(JSON.stringify(info)); console.log(s.errors.length + ' page errors'); console.log(s.errors.slice(0, 10).join('\n'));
  await s.close();
})();
