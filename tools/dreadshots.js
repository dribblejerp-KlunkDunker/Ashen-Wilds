// Usage: NODE_PATH=$(npm root -g) node tools/dreadshots.js <outDir> [only]
// Phase 9's stills: the ledge at dusk looking at the Slagcrown with no dread, half, and full; the walking bloom on the
// shelf, calm and at full dread; your lantern lit at night at full dread (the tallow keeps its colour); and one clip,
// played: you run at the walking bloom at dusk, it hears you and comes, and dread rises with it (needs ffmpeg
// on the path to join the frames).
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const H = require(path.join(__dirname, '..', 'test', 'harness.js'));
const out = path.resolve(process.argv[2] || 'docs/screenshots'), only = process.argv[3];
const DUSK = 0.735, NIGHT = 0.95;
const SHOTS = [
  // name, map, hour, camera x, y, heading (radians), pitch, dread (held), lantern lit
  ['90_dusk_no_dread', 'la_ledge', DUSK, 89.5, 40.5, Math.PI, -0.06, 0, false],
  ['91_dusk_half_dread', 'la_ledge', DUSK, 89.5, 40.5, Math.PI, -0.06, 0.5, false],
  ['92_dusk_full_dread', 'la_ledge', DUSK, 89.5, 40.5, Math.PI, -0.06, 1, false],
  ['93_the_bloom_no_dread', 'la_ledge', DUSK, 86.9, 35.0, 284 * Math.PI / 180, -0.2, 0, false],
  ['94_the_bloom_full_dread', 'la_ledge', DUSK, 86.9, 35.0, 284 * Math.PI / 180, -0.2, 1, false],
  ['95_night_lantern_no_dread', 'la_ledge', NIGHT, 89.5, 40.5, Math.PI, -0.3, 0, true],
  ['96_night_lantern_full_dread', 'la_ledge', NIGHT, 89.5, 40.5, Math.PI, -0.3, 1, true],
];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const s = await H.open(); await H.begin(s.page);
  const place = ([map, tod, x, y, dir, pitch, d, lit]) => {
    BLOOM4.reset(); G.flags = { la_told_bar: true, la_oil: 1080 }; loadMap(map, { x, y, dir }); G.state = 'play'; G.day = 2; G.tod = tod; G.fadeT = 0; G.keys = {};
    UPG.lantern = lit; LANTERN7.state().prev = lit; if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(pitch);
    const S = DREAD9.state(); S.hold = true; S.d = d;
    advanceTime(600); G.tod = tod; BLOOM4.reset(); advanceTime(30); G.tod = tod; S.d = d; const m = document.querySelector('#msgs'); if (m) m.innerHTML = '';
  };
  for (const [name, ...rest] of SHOTS) {
    if (only && !name.includes(only)) continue;
    await s.page.evaluate(place, rest);
    await s.page.waitForTimeout(600);
    await s.page.evaluate(([tod, d]) => { G.tod = tod; DREAD9.state().d = d; const m = document.querySelector('#msgs'); if (m) m.innerHTML = ''; }, [rest[1], rest[6]]);
    await s.page.waitForTimeout(250);
    await s.page.screenshot({ path: path.join(out, name + '.png'), clip: { x: 0, y: 0, width: 1280, height: 600 } });
    console.log('wrote ' + name + '.png (dread ' + rest[6] + ')');
  }
  if (!only || '97_the_bloom_comes'.includes(only)) {
    // the clip: dusk, coming down the ramp to the walking bloom's back; you run a few steps, it hears you, turns and
    // comes, and you back away while dread rises of itself (nothing held). The game runs at its own pace; the picture is what a player would see.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'la-dread-')); let n = 0; const trace = [];
    await s.page.evaluate(([tod]) => {
      window.requestAnimationFrame = () => 0; BLOOM4.reset(); G.flags = { la_told_bar: true, la_oil: 1080 }; loadMap('la_ledge', { x: 86.9, y: 35.0, dir: 284 * Math.PI / 180 }); G.state = 'play'; G.day = 2; G.tod = tod; G.fadeT = 0; G.keys = {};
      UPG.lantern = false; LANTERN7.state().prev = false; if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(-0.2);
      const S = DREAD9.state(); S.hold = false; S.d = 0; const m = document.querySelector('#msgs'); if (m) m.innerHTML = '';
    }, [DUSK]);
    for (let f = 0; f < 12 * 8; f++) {
      const r = await s.page.evaluate((f) => {
        const c = Engine.cam, B = BLOOM4.state();
        // look at it the whole time; run a few steps toward it (a run is loud enough for it to hear), then back away
        c.dir = Math.atan2(B.y - c.y, B.x - c.x); G.keys = f < 6 ? { w: true, shift: true } : { s: true };
        advanceTime(125); G.tod = 0.735;
        render(); const m = document.querySelector('#msgs'); if (m) m.innerHTML = '';
        return { d: +DREAD9.state().d.toFixed(2), state: B.state, dist: +Math.hypot(B.x - c.x, B.y - c.y).toFixed(1) };
      }, f);
      trace.push(r);
      await s.page.screenshot({ path: path.join(dir, 'f' + String(n++).padStart(4, '0') + '.png'), clip: { x: 0, y: 0, width: 1280, height: 600 } });
    }
    const gif = path.join(out, '97_the_bloom_comes.gif');
    cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '8', '-i', path.join(dir, 'f%04d.png'), '-vf', 'scale=480:225:flags=lanczos,split[a][b];[a]palettegen=max_colors=48:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5', gif]);
    console.log('wrote 97_the_bloom_comes.gif: ' + n + ' frames, ' + Math.round(fs.statSync(gif).size / 1024) + ' KB');
    console.log('dread, the bloom and its distance, once a second: ' + trace.filter((_, i) => i % 8 === 0).map((t) => t.d + ' ' + t.state + ' ' + t.dist).join(' | '));
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(JSON.stringify(await s.page.evaluate(() => ({ err: DREAD9.state().err, drawn: DREAD9.gl().drawn, failed: DREAD9.gl().failed }))));
  console.log(s.errors.length + ' page errors'); console.log(s.errors.slice(0, 8).join('\n'));
  await s.close();
})();
