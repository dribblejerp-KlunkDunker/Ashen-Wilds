// Usage: NODE_PATH=$(npm root -g) node tools/thresholdshots.js <outDir> [only]
// Phase 40's stills: the gap in the ledge's boulders (on and off), coming down at the crag's foot with the company, the
// crag from the ramp foot, the band of rock at the seam and the cut through it from both sides, the Greystair fork, and a
// notch where a way runs into country not built yet. Daylight, so the shapes read.
'use strict';
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', 'test', 'harness.js'));
const out = path.resolve(process.argv[2] || 'docs/screenshots'), only = process.argv[3];
const NOON = 0.5;
const SHOTS = [
  // name, map, camera x, y, heading (radians), pitch, switch, company
  ['170_the_gap_in_the_ledge', 'la_ledge', 86.5, 51, Math.PI / 2, -0.12, true, false],
  ['171_the_gap_switch_off', 'la_ledge', 86.5, 51, Math.PI / 2, -0.12, false, false],
  ['172_down_at_the_crags_foot', 'la_z1_2_0', 222.5, 146, Math.PI / 2, -0.05, true, false],
  ['173_the_company_comes_down', 'la_z1_2_0', 222.6, 152, -Math.PI / 2, -0.02, true, true],
  ['174_the_crag_from_the_ramp_foot', 'la_z1_2_0', 232, 250, -Math.PI / 2 - 0.05, 0.04, true, false],
  ['175_the_band_and_the_cut', 'la_z1_2_0', 196.0, 362, 1.62, -0.05, true, false],
  ['176_in_the_cut', 'la_z1_2_0', 195.6, 370.5, 1.45, -0.05, true, false],
  ['177_the_far_side_of_the_cut', 'la_z1_2_1', 184.5, 25.6, -0.69, -0.05, true, false],
  ['178_the_greystair_fork', 'la_z1_2_1', 140, 150, Math.PI * 0.85, -0.03, true, false],
  ['179_a_way_not_built_yet', 'la_z1_2_1', 364, 70.5, -0.17, -0.04, true, false],
];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const s = await H.open(); await H.begin(s.page);
  const place = ([map, x, y, dir, pitch, on, company, NOON]) => {
    BLOOM4.pose({ map: 'la_bothy', x: 3.5, y: 2.5, state: 'wait' });
    GFX.laThresholds = on; G.flags.la_marget_out = false; G.flags.la_marget_map = null;
    try { CARRY15.releaseNow(); } catch (e) { void e; }
    const k = CARTER13.state(); k.mode = 'hold'; k.map = 'la_ledge'; k.x = 79.9; k.y = 46.2; CARTER13.save();
    G.state = 'paused'; loadMap(map, { x, y, dir }); G.state = 'play'; G.day = 3; G.tod = NOON; G.fadeT = 0; G.keys = {};
    if (company) {
      G.flags.la_marget_out = true; G.flags.la_marget_promise = true; G.flags.la_marget_map = map;
      CARRY15.attachNow();
      k.mode = 'follow'; k.map = map; k.x = x + 0.4; k.y = y - 2.6; CARTER13.save();
      THRESH40.setGap(on); loadMap(map, { x, y, dir }); G.fadeT = 0;
    }
    if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(pitch);
    advanceTime(400); G.tod = NOON;
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
  await s.page.evaluate(() => { GFX.laThresholds = true; });
  await s.close();
})().catch((e) => { console.error(e); process.exit(1); });
