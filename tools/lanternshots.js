// Usage: NODE_PATH=$(npm root -g) node tools/lanternshots.js <outDir> [only]
// Phase 7's stills: the lantern unlit and lit on the ledge at night, the pool at your feet with it lit and unlit, burning
// low, Marget Sayle's oil in the bothy, the lantern lit indoors, and the switch off; and one clip, played: a lantern with
// a few seconds of oil left, guttering out on the ledge (needs ffmpeg on the path to join the frames).
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const H = require(path.join(__dirname, '..', 'test', 'harness.js'));
const out = path.resolve(process.argv[2] || 'docs/screenshots'), only = process.argv[3];
const NIGHT = 0.95;
const SHOTS = [
  // name, map, hour, camera x, y, heading (radians), pitch, oil (seconds), lit, switch
  ['70_unlit_on_the_ledge', 'la_ledge', NIGHT, 89.5, 40.5, Math.PI, -0.06, 540, false, true],
  ['71_lit_on_the_ledge', 'la_ledge', NIGHT, 89.5, 40.5, Math.PI, -0.06, 540, true, true],
  ['72_at_your_feet_unlit', 'la_ledge', NIGHT, 89.5, 40.5, Math.PI, -0.45, 540, false, true],
  ['73_at_your_feet_lit', 'la_ledge', NIGHT, 89.5, 40.5, Math.PI, -0.45, 540, true, true],
  ['74_burning_low', 'la_ledge', NIGHT, 89.5, 40.5, Math.PI, -0.45, 60, true, true],
  ['75_the_oil_in_the_bothy', 'la_bothy', NIGHT, 2.4, 3.4, -2.2, -0.12, 540, false, true],
  ['76_lit_in_the_bothy', 'la_bothy', NIGHT, 2.4, 3.4, -2.2, -0.12, 540, true, true],
  ['77_switch_off', 'la_ledge', NIGHT, 89.5, 40.5, Math.PI, -0.45, 540, true, false],
];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const s = await H.open(); await H.begin(s.page);
  // Phase 7's lantern: Phase 38's torch is held off (GFX.laTorch) so these stills show the lantern as built
  const place = ([map, tod, x, y, dir, pitch, oil, lit, on]) => {
    BLOOM4.reset(); G.flags = { la_told_bar: true, la_oil: oil }; GFX.laLamp = on; GFX.laTorch = false; loadMap(map, { x, y, dir }); G.state = 'play'; G.day = 2; G.tod = tod; G.fadeT = 0; G.keys = {};
    UPG.lantern = lit; LANTERN7.state().prev = lit; if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(pitch);
    advanceTime(600); G.tod = tod; G.flags.la_oil = oil; advanceTime(30); G.tod = tod; G.flags.la_oil = oil; const m = document.querySelector('#msgs'); if (m) m.innerHTML = '';
  };
  for (const [name, ...rest] of SHOTS) {
    if (only && !name.includes(only)) continue;
    await s.page.evaluate(place, rest);
    await s.page.waitForTimeout(600);
    await s.page.evaluate(([tod, oil]) => { G.tod = tod; G.flags.la_oil = oil; const m = document.querySelector('#msgs'); if (m) m.innerHTML = ''; }, [rest[1], rest[6]]);
    await s.page.waitForTimeout(250);
    await s.page.screenshot({ path: path.join(out, name + '.png'), clip: { x: 0, y: 0, width: 1280, height: 600 } });
    console.log('wrote ' + name + '.png');
  }
  if (!only || '78_the_lantern_gutters_out'.includes(only)) {
    // the clip: eight seconds of oil left, standing on the ledge at night looking a little down, the game run at its own pace
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'la-gif-')); let n = 0;
    await s.page.evaluate(() => {
      window.requestAnimationFrame = () => 0; BLOOM4.reset(); G.flags = { la_told_bar: true, la_oil: 8 }; GFX.laLamp = true; loadMap('la_ledge', { x: 89.5, y: 40.5, dir: Math.PI }); G.state = 'play'; G.day = 2; G.tod = 0.95; G.fadeT = 0;
      UPG.lantern = true; LANTERN7.state().prev = true; if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(-0.3); const m = document.querySelector('#msgs'); if (m) m.innerHTML = '';
    });
    for (let f = 0; f < 11 * 8; f++) {
      await s.page.evaluate(() => { for (let i = 0; i < 8; i++) update(1 / 64); render(); });
      await s.page.screenshot({ path: path.join(dir, 'f' + String(n++).padStart(4, '0') + '.png'), clip: { x: 0, y: 0, width: 1280, height: 600 } });
    }
    const gif = path.join(out, '78_the_lantern_gutters_out.gif');
    cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '8', '-i', path.join(dir, 'f%04d.png'), '-vf', 'scale=640:300:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle', gif]);
    console.log('wrote 78_the_lantern_gutters_out.gif: ' + n + ' frames, ' + Math.round(fs.statSync(gif).size / 1024) + ' KB; said: ' + (await s.page.evaluate(() => LANTERN7.state().said.join(' | '))));
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(JSON.stringify(await s.page.evaluate(() => ({ err: LANTERN7.state().err, drawn: LANTERN7.state().drawn }))));
  console.log(s.errors.length + ' page errors'); console.log(s.errors.slice(0, 8).join('\n'));
  await s.close();
})();
