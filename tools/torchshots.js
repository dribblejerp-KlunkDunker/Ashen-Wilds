// Usage: NODE_PATH=$(npm root -g) node tools/torchshots.js <outDir> [only]
// Phase 38's stills: the torch unlit and lit on the ledge at night, its pool at your feet beside the lantern's, burning
// down, the horn lantern on Marget Sayle's plank, the lantern in hand once found, and the switch off; and one clip, the
// torch's flame played for three seconds (needs ffmpeg on the path to join the frames).
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const H = require(path.join(__dirname, '..', 'test', 'harness.js'));
const out = path.resolve(process.argv[2] || 'docs/screenshots'), only = process.argv[3];
const NIGHT = 0.95;
const SHOTS = [
  // name, map, hour, camera x, y, heading (radians), pitch, torch fuel (s), lit, which light, switch
  ['140_torch_unlit_on_the_ledge', 'la_ledge', NIGHT, 89.5, 40.5, Math.PI, -0.06, 240, false, 'torch', true],
  ['141_torch_lit_on_the_ledge', 'la_ledge', NIGHT, 89.5, 40.5, Math.PI, -0.06, 240, true, 'torch', true],
  ['142_torch_at_your_feet', 'la_ledge', NIGHT, 89.5, 40.5, Math.PI, -0.45, 240, true, 'torch', true],
  ['143_lantern_at_your_feet', 'la_ledge', NIGHT, 89.5, 40.5, Math.PI, -0.45, 240, true, 'lantern', true],
  ['144_torch_burning_down', 'la_ledge', NIGHT, 89.5, 40.5, Math.PI, -0.45, 25, true, 'torch', true],
  ['145_the_lantern_by_the_oil', 'la_bothy', NIGHT, 2.6, 3.0, -1.95, -0.2, 240, true, 'torch', true],
  ['146_switch_off', 'la_ledge', NIGHT, 89.5, 40.5, Math.PI, -0.45, 240, true, 'torch', false],
];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const s = await H.open(); await H.begin(s.page);
  const place = ([map, tod, x, y, dir, pitch, fuel, lit, which, on]) => {
    BLOOM4.reset(); G.flags = { la_told_bar: true, la_oil: 540, la_bg: 'deserter' }; TORCH38.fresh(G.flags, 'deserter'); G.flags.la_torch = fuel;
    if (which === 'lantern') { G.flags.la_have.lantern = true; G.flags.la_light = 'lantern'; }
    GFX.laLamp = true; GFX.laTorch = on; loadMap(map, { x, y, dir }); G.state = 'play'; G.day = 2; G.tod = tod; G.fadeT = 0; G.keys = {};
    UPG.lantern = lit; LANTERN7.state().prev = lit; if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(pitch);
    advanceTime(600); G.tod = tod; G.flags.la_torch = fuel; G.flags.la_oil = 540; advanceTime(30); G.tod = tod; G.flags.la_torch = fuel;
    const m = document.querySelector('#msgs'); if (m) m.innerHTML = '';
  };
  for (const [name, ...rest] of SHOTS) {
    if (only && !name.includes(only)) continue;
    await s.page.evaluate(place, rest);
    await s.page.waitForTimeout(600);
    await s.page.evaluate(([tod, fuel]) => { G.tod = tod; G.flags.la_torch = fuel; const m = document.querySelector('#msgs'); if (m) m.innerHTML = ''; }, [rest[1], rest[6]]);
    await s.page.waitForTimeout(250);
    await s.page.screenshot({ path: path.join(out, name + '.png'), clip: { x: 0, y: 0, width: 1280, height: 600 } });
    console.log('wrote ' + name + '.png');
  }
  if (!only || '147_the_torch_burns'.includes(only)) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'la-gif-')); let n = 0;
    await s.page.evaluate(() => {
      window.requestAnimationFrame = () => 0; BLOOM4.reset(); G.flags = { la_told_bar: true, la_bg: 'deserter' }; TORCH38.fresh(G.flags, 'deserter');
      GFX.laLamp = true; GFX.laTorch = true; loadMap('la_ledge', { x: 89.5, y: 40.5, dir: Math.PI }); G.state = 'play'; G.day = 2; G.tod = 0.95; G.fadeT = 0;
      UPG.lantern = true; LANTERN7.state().prev = true; if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(-0.3); const m = document.querySelector('#msgs'); if (m) m.innerHTML = '';
    });
    for (let f = 0; f < 3 * 8; f++) {
      await s.page.evaluate(() => { for (let i = 0; i < 8; i++) update(1 / 64); render(); });
      await s.page.screenshot({ path: path.join(dir, 'f' + String(n++).padStart(4, '0') + '.png'), clip: { x: 0, y: 0, width: 1280, height: 600 } });
    }
    const gif = path.join(out, '147_the_torch_burns.gif');
    cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '8', '-i', path.join(dir, 'f%04d.png'), '-vf', 'scale=640:300:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle', gif]);
    console.log('wrote 147_the_torch_burns.gif: ' + n + ' frames, ' + Math.round(fs.statSync(gif).size / 1024) + ' KB');
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(JSON.stringify(await s.page.evaluate(() => ({ err: LANTERN7.state().err || TORCH38.state().err, drawn: LANTERN7.state().drawn }))));
  console.log(s.errors.length + ' page errors'); console.log(s.errors.slice(0, 8).join('\n'));
  await s.close();
})();
