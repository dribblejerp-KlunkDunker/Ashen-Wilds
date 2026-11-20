// Usage: NODE_PATH=$(npm root -g) node tools/weathershots.js <outDir> [only]
// Phase 6's stills: ashfall and sleet on the ledge, sleet at the bothy's door and eaves, and the room dry inside; and one
// clip, played: the second day's sleet coming in over the Slagcrown, by daylight (needs ffmpeg on the path to join the frames).
// The first day's spell of sleet runs from about 0.795 to 0.841 of the day; the stills stand inside it or before it.
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const H = require(path.join(__dirname, '..', 'test', 'harness.js'));
const out = path.resolve(process.argv[2] || 'docs/screenshots'), only = process.argv[3];
const SHOTS = [
  // name, map, day, hour, camera x, y, heading (radians), pitch, weather switch
  ['60_ashfall_on_the_ledge', 'la_ledge', 0, 0.75, 89.5, 48.5, Math.PI, -0.06, true],
  ['61_sleet_on_the_ledge', 'la_ledge', 0, 0.82, 89.5, 48.5, Math.PI, -0.06, true],
  ['62_sleet_at_the_bothy', 'la_ledge', 0, 0.82, 87.2, 33.6, -2.35, 0.02, true],
  ['63_under_the_eaves', 'la_ledge', 0, 0.82, 83.5, 30.45, Math.PI / 2, 0.0, true],
  ['64_inside_while_it_sleets', 'la_bothy', 0, 0.82, 3.5, 3.6, -Math.PI / 2, 0.0, true],
  ['65_switch_off', 'la_ledge', 0, 0.82, 89.5, 48.5, Math.PI, -0.06, false],
  // by day: the second day's spell runs from about 0.323 to 0.382 of the day
  ['66_a_grey_morning', 'la_ledge', 1, 0.30, 89.5, 48.5, Math.PI, -0.06, true],
  ['67_sleet_by_day', 'la_ledge', 1, 0.352, 89.5, 48.5, Math.PI, -0.06, true],
];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const s = await H.open(); await H.begin(s.page);
  for (const [name, map, day, tod, x, y, dir, pitch, on] of SHOTS) {
    if (only && !name.includes(only)) continue;
    await s.page.evaluate(([map, day, tod, x, y, dir, pitch, on]) => {
      BLOOM4.reset(); G.flags = { la_told_bar: true }; GFX.laWx = on; loadMap(map, { x, y, dir }); G.state = 'play'; G.day = day; G.tod = tod; G.fadeT = 0;
      if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(pitch);
      advanceTime(600); G.tod = tod; advanceTime(30); G.tod = tod; const m = document.querySelector('#msgs'); if (m) m.innerHTML = '';
    }, [map, day, tod, x, y, dir, pitch, on]);
    await s.page.waitForTimeout(600);
    await s.page.evaluate(([tod]) => { G.tod = tod; const m = document.querySelector('#msgs'); if (m) m.innerHTML = ''; }, [tod]);
    await s.page.waitForTimeout(250);
    await s.page.screenshot({ path: path.join(out, name + '.png'), clip: { x: 0, y: 0, width: 1280, height: 600 } });
    console.log('wrote ' + name + '.png');
  }
  if (!only || '68_the_sleet_comes_in'.includes(only)) {
    // the clip: stand on the ledge a few seconds before the second day's spell, and let the game run at its own pace
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'la-gif-')); let n = 0;
    await s.page.evaluate(() => { window.requestAnimationFrame = () => 0; BLOOM4.reset(); G.flags = { la_told_bar: true }; GFX.laWx = true; loadMap('la_ledge', { x: 89.5, y: 48.5, dir: Math.PI }); G.state = 'play'; G.day = 1; G.tod = WEATHER6.spells(1)[0][0] - 5 / WEATHER6.DAY_S; G.fadeT = 0; WEATHER6.state().kind = 'ashfall'; if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(-0.06); const m = document.querySelector('#msgs'); if (m) m.innerHTML = ''; });
    for (let f = 0; f < 15 * 8; f++) {
      await s.page.evaluate(() => { for (let i = 0; i < 8; i++) update(1 / 64); render(); });
      await s.page.screenshot({ path: path.join(dir, 'f' + String(n++).padStart(4, '0') + '.png'), clip: { x: 0, y: 0, width: 1280, height: 600 } });
    }
    const gif = path.join(out, '68_the_sleet_comes_in.gif');
    cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '8', '-i', path.join(dir, 'f%04d.png'), '-vf', 'scale=640:300:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle', gif]);
    console.log('wrote 68_the_sleet_comes_in.gif: ' + n + ' frames, ' + Math.round(fs.statSync(gif).size / 1024) + ' KB; said: ' + (await s.page.evaluate(() => WEATHER6.state().said.join(' | '))));
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const info = await s.page.evaluate(() => ({ gl: WEATHER6.gl().failed || 'ok', drawn: WEATHER6.gl().drawn, err: WEATHER6.state().err }));
  console.log(JSON.stringify(info)); console.log(s.errors.length + ' page errors'); console.log(s.errors.slice(0, 8).join('\n'));
  await s.close();
})();
