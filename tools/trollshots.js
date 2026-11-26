// Usage: NODE_PATH=$(npm root -g) node tools/trollshots.js <outDir> [only]
// Phase 44's stills: the blind quarry-troll on the high ground. At rest (an outcrop), on its knuckles coming, its fists
// up over the spot, the ring of shattered stone after the blow, the flat painting ("Modelled bodies" off), and its
// ground at dusk. Posed and held (TROLL44's state, held), by day unless named.
'use strict';
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', 'test', 'harness.js'));
const out = path.resolve(process.argv[2] || 'docs/screenshots'), only = process.argv[3];
const SHOTS = [
  // name, camera off its home (dx, dy), pose, time of day, modelled
  ['220_troll_at_rest_an_outcrop', [-7.5, 2.5], { state: 'rest' }, 0.5, true],
  ['221_troll_coming_on_its_knuckles', [-6.5, 0.5], { state: 'go', walk: 1, phase: 1.1, alert: 1, yaw: Math.PI }, 0.5, true],
  ['222_troll_fists_up_over_the_spot', [-5.2, 1.2], { state: 'raise', raise: 1, alert: 1, yaw: Math.PI - 0.2 }, 0.5, true],
  ['223_troll_the_blow_falls', [-5.2, 1.2], { state: 'slam', raise: 0, slam: 1, alert: 1, yaw: Math.PI - 0.2 }, 0.5, true],
  ['224_troll_flat_painting', [-6.5, 0.5], { state: 'rest' }, 0.5, false],
  ['225_troll_ground_at_dusk', [-11, 3], { state: 'rest' }, 0.79, true],
];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const s = await H.open(); await H.begin(s.page);
  await s.page.evaluate(() => { OPEN42.finish(G.maps.la_z1); G.state = 'paused'; loadMap('la_z1', G.maps.la_z1.spawn); G.state = 'play'; });
  for (const [name, off, pose, tod, modelled] of SHOTS) {
    if (only && !name.includes(only)) continue;
    await s.page.evaluate(([off, pose, tod, modelled]) => {
      BLOOM4.pose({ map: 'la_bothy', x: 3.5, y: 2.5, state: 'wait' });
      const k = CARTER13.state(); k.mode = 'hold'; k.map = 'la_ledge'; k.x = 79.9; k.y = 46.2; CARTER13.save();
      TROLL44.reset(); GFX.laBodies = modelled;
      const t = TROLL44.trolls()[1], S = t.S, h = S.home;
      const x = h.x + off[0], y = h.y + off[1];
      G.state = 'paused'; loadMap('la_z1', { x, y, dir: Math.atan2(h.y - y, h.x - x) }); G.state = 'play'; G.day = 3; G.tod = tod; G.fadeT = 0; G.keys = {};
      Object.assign(S, { walk: 0, raise: 0, slam: 0, alert: 0, crouch: pose.state === 'rest' ? 1 : 0, look: 0, phase: 0 }, pose, { held: true });
      if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(0.04);
      for (let i = 0; i < 300 && R3D.stream().info && R3D.stream().info.chunks < R3D.stream().info.need; i++) render();
      advanceTime(300); G.tod = tod;
      const m = document.querySelector('#msgs'); if (m) m.innerHTML = '';
    }, [off, pose, tod, modelled, name.includes('blow')]);
    if (name.includes('blow')) {
      // the blow: let it fall for real on the spot in front of it, then hold the frame
      await s.page.evaluate(() => { const t = TROLL44.trolls()[1], S = t.S; Object.assign(S, { held: false, state: 'raise', t: 0.99, tx: S.x - 1.3, ty: S.y, raise: 1 }); for (let i = 0; i < 9; i++) update(1 / 60); S.held = true; });
    }
    await s.page.waitForTimeout(700);
    await s.page.evaluate((tod) => { G.tod = tod; const m = document.querySelector('#msgs'); if (m) m.innerHTML = ''; }, tod);
    await s.page.waitForTimeout(250);
    await s.page.screenshot({ path: path.join(out, name + '.png'), clip: { x: 0, y: 0, width: 1280, height: 600 } });
    console.log('wrote ' + name + '.png');
  }
  await s.page.evaluate(() => { GFX.laBodies = true; TROLL44.reset(); });
  await s.close();
})().catch((e) => { console.error(e); process.exit(1); });
