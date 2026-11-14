// Usage: NODE_PATH=$(npm root -g) node tools/sunshots.js <outDir>
// Stills of the sun's day (js/sun3.js): the same view at noon on the three kinds of day, the pale coin and the clear
// sun in the sky, the prologue's opening, sunset behind the Slagcrown, and night. Written for the owner to rule on.
'use strict';
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', 'test', 'harness.js'));
const out = path.resolve(process.argv[2] || 'docs/screenshots');
const SHOTS = [
  ['10_noon_on_a_coal_day', 7, 0.5, 78.35, 49.2, 180, -0.05],
  ['11_noon_on_a_coin_day', 1, 0.5, 78.35, 49.2, 180, -0.05],
  ['12_noon_on_a_clear_day', 2, 0.5, 78.35, 49.2, 180, -0.05],
  ['13_the_pale_coin', 1, 0.66, 80.5, 49.2, 163, 0.34],
  ['14_the_sun_itself', 2, 0.585, 84.0, 49.0, 128, 0.62],
  ['15_the_opening', 0, null, null, null, null, 0],
  ['16_sunset_behind_the_slagcrown', 0, 0.7445, 78.35, 48.6, 180, 0.0],
  ['17_night', 0, 0.92, 78.35, 49.2, 180, 0.0],
];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const s = await H.open(); await H.begin(s.page);
  for (const [name, day, tod, x, y, deg, pitch] of SHOTS) {
    const info = await s.page.evaluate(([day, tod, x, y, deg, pitch]) => {
      if (x != null) loadMap(LEDGE1.LEDGE, { x, y, dir: deg * Math.PI / 180 }); else loadMap(LEDGE1.LEDGE);
      G.state = 'play'; G.day = day; G.tod = tod != null ? tod : SUN3.START_TOD; G.fadeT = 0; Weather.hold('clear');
      if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(pitch);
      const m = document.querySelector('#msgs'); if (m) m.innerHTML = '';
      const hold = G.tod; advanceTime(900); G.tod = hold; advanceTime(50); G.tod = hold;
      const f = SUN3.face(G.day, G.tod); return SUN3.kind(G.day) + ' tod ' + G.tod.toFixed(3) + ' el ' + (f.el * 57.3).toFixed(0) + ' coal ' + f.coal.toFixed(2) + ' clear ' + f.clear.toFixed(2);
    }, [day, tod, x, y, deg, pitch]);
    await s.page.waitForTimeout(700);
    await s.page.evaluate(([tod]) => { G.tod = tod != null ? tod : SUN3.START_TOD; const m = document.querySelector('#msgs'); if (m) m.innerHTML = ''; }, [tod]);
    await s.page.waitForTimeout(250);
    await s.page.screenshot({ path: path.join(out, name + '.png') });
    console.log(name + ': ' + info);
  }
  console.log(s.errors.length ? s.errors.join('\n') : 'no page errors');
  await s.close();
})().catch((e) => { console.error('STOPPED', e.message); process.exit(1); });
