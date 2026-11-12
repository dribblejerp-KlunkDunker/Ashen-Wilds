// Usage: NODE_PATH=$(npm root -g) node tools/beastshots.js <outDir>
// The look test: the walking bloom and the quarry-troll, modelled (the owner's ruling), by daylight, at dusk, from the
// side, from behind and close. It injects tools/look/beasts.js into the running game; the game itself
// does not load that file.
'use strict';
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', 'test', 'harness.js'));
const out = path.resolve(process.argv[2] || 'docs/screenshots');
// facing west, north is to the right: the troll on the left, the walking bloom on the right, both turned toward the
// camera of the first stills (yaw 0 is east).
const ROW = [{ kind: 'troll', x: 81.4, y: 50.1 }, { kind: 'bloom', x: 81.8, y: 47.9 }];
const SHOTS = [
  // name, day, hour, camera x, y, heading (degrees), pitch
  ['20_beasts_by_daylight', 1, 0.5, 85.2, 49.1, 180, -0.02],
  ['21_beasts_at_dusk', 0, 0.73, 85.2, 49.1, 180, -0.02],
  ['22_beasts_from_the_side', 1, 0.5, 82.6, 53.2, 248, -0.03],
  ['23_the_walking_bloom_close', 0, 0.73, 83.35, 47.9, 180, 0.02],
  ['24_the_troll_close', 1, 0.5, 83.9, 50.1, 180, 0.06],
  ['25_from_behind', 1, 0.5, 78.9, 49.0, 0, -0.04],
  ['26_the_walking_bloom_by_daylight', 1, 0.5, 83.1, 48.75, 213, 0.02],
  ['27_the_troll_at_dusk', 0, 0.735, 84.1, 49.4, 190, 0.06],
];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const s = await H.open(); await H.begin(s.page);
  await s.page.addScriptTag({ path: path.join(__dirname, 'look', 'beasts.js') });
  const ok = await s.page.evaluate((ROW) => { BEASTLOOK.place(ROW.map((b) => Object.assign({ yaw: 0 }, b))); advanceTime(200); return { failed: BEASTLOOK.gl().failed, n: BEASTLOOK.count(), tris: BEASTLOOK.tris() }; }, ROW);
  console.log('look test loaded: ' + JSON.stringify(ok));
  for (const [name, day, tod, x, y, deg, pitch] of SHOTS) {
    await s.page.evaluate(([day, tod, x, y, deg, pitch]) => {
      loadMap(LEDGE1.LEDGE, { x, y, dir: deg * Math.PI / 180 }); G.state = 'play'; G.day = day; G.tod = tod; G.fadeT = 0; Weather.hold('clear');
      G.ents = G.ents.filter((e) => e.kind !== 'npc');
      if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(pitch);
      advanceTime(900); G.tod = tod; advanceTime(50); G.tod = tod; const m = document.querySelector('#msgs'); if (m) m.innerHTML = '';
    }, [day, tod, x, y, deg, pitch]);
    await s.page.waitForTimeout(700);
    await s.page.evaluate(([tod]) => { G.tod = tod; const m = document.querySelector('#msgs'); if (m) m.innerHTML = ''; }, [tod]);
    await s.page.waitForTimeout(250);
    await s.page.screenshot({ path: path.join(out, name + '.png'), clip: { x: 0, y: 0, width: 1280, height: 600 } });
    console.log('wrote ' + name + '.png');
  }
  console.log(s.errors.length ? s.errors.join('\n') : 'no page errors');
  await s.close();
})().catch((e) => { console.error('STOPPED', e.message); process.exit(1); });
