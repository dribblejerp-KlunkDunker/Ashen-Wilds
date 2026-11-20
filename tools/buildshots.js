// Usage: NODE_PATH=$(npm root -g) node tools/buildshots.js <outDir> [only]
// Phase 8's stills: the bothy before and after, built the highland way (P16), its door and lee window, its weather side,
// by day, the window from inside, and the room before; and one clip, played: smoke out of the hole in the roof at dusk
// (needs ffmpeg on the path to join the frames).
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const H = require(path.join(__dirname, '..', 'test', 'harness.js'));
const out = path.resolve(process.argv[2] || 'docs/screenshots'), only = process.argv[3];
const D = Math.PI / 180;
const SHOTS = [
  // name, map, hour, camera x, y, heading, pitch, switch
  ['80_the_bothy_before', 'la_ledge', 0.8, 87.6, 33.4, 224 * D, -0.04, false],
  ['81_the_bothy_highland', 'la_ledge', 0.8, 87.6, 33.4, 224 * D, -0.04, true],
  ['82_its_door_and_window', 'la_ledge', 0.8, 84.6, 32.8, -100 * D, 0.06, true],
  ['83_the_weather_side', 'la_ledge', 0.8, 90.6, 25.9, 172 * D, 0.0, true],
  ['84_by_day', 'la_ledge', 0.42, 87.6, 33.4, 224 * D, -0.04, true],
  ['85_the_window_from_inside', 'la_bothy', 0.8, 3.0, 2.2, 70 * D, -0.05, true],
  ['86_inside_before', 'la_bothy', 0.8, 3.0, 2.2, 70 * D, -0.05, false],
];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const s = await H.open(); await H.begin(s.page);
  const place = ([map, tod, x, y, dir, pitch, on]) => {
    BLOOM4.reset(); G.flags = { la_told_bar: true }; GFX.laBuild = on; loadMap(map, { x, y, dir }); G.state = 'play'; G.day = 2; G.tod = tod; G.fadeT = 0; G.keys = {};
    if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(pitch);
    advanceTime(1500); G.tod = tod; advanceTime(30); G.tod = tod; const m = document.querySelector('#msgs'); if (m) m.innerHTML = '';
  };
  for (const [name, ...rest] of SHOTS) {
    if (only && !name.includes(only)) continue;
    await s.page.evaluate(place, rest);
    await s.page.waitForTimeout(600);
    await s.page.evaluate((tod) => { G.tod = tod; const m = document.querySelector('#msgs'); if (m) m.innerHTML = ''; }, rest[1]);
    await s.page.waitForTimeout(250);
    await s.page.screenshot({ path: path.join(out, name + '.png'), clip: { x: 0, y: 0, width: 1280, height: 600 } });
    console.log('wrote ' + name + '.png');
  }
  if (!only || '87_smoke_from_the_hole'.includes(only)) {
    // the clip: at dusk below the bothy's door, looking up at the roof; the game run at its own pace, eight frames a second
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'la-gif-')); let n = 0;
    await s.page.evaluate(() => {
      window.requestAnimationFrame = () => 0; BLOOM4.reset(); G.flags = { la_told_bar: true }; GFX.laBuild = true; loadMap('la_ledge', { x: 89.5, y: 31.8, dir: 211 * Math.PI / 180 }); G.state = 'play'; G.day = 2; G.tod = 0.78; G.fadeT = 0;
      if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(0.1); FIRESMOKE.reset(); for (let k = 0; k < 48; k++) { for (let i = 0; i < 8; i++) { G.tod = 0.78; update(1 / 64); } render(); } const m = document.querySelector('#msgs'); if (m) m.innerHTML = '';
    });
    for (let f = 0; f < 8 * 8; f++) {
      await s.page.evaluate(() => { for (let i = 0; i < 8; i++) { G.tod = 0.78; update(1 / 64); } render(); });
      await s.page.screenshot({ path: path.join(dir, 'f' + String(n++).padStart(4, '0') + '.png'), clip: { x: 0, y: 0, width: 1280, height: 600 } });
    }
    const gif = path.join(out, '87_smoke_from_the_hole.gif');
    cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '8', '-i', path.join(dir, 'f%04d.png'), '-vf', 'scale=640:300:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle', gif]);
    console.log('wrote 87_smoke_from_the_hole.gif: ' + n + ' frames, ' + Math.round(fs.statSync(gif).size / 1024) + ' KB');
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(JSON.stringify(await s.page.evaluate(() => ({ err: BUILD8.state().err, puffs: BUILD8.state().puffs }))));
  console.log(s.errors.length + ' page errors'); console.log(s.errors.slice(0, 8).join('\n'));
  await s.close();
})();
