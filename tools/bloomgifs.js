// Usage: NODE_PATH=$(npm root -g) node tools/bloomgifs.js <outDir> [only]
// Phase 4 in motion, for an owner who does not run the game from source. Each clip is PLAYED, not posed: the keys are
// held, the engine's own noise rises and falls, and the walking bloom does what its rules make it do. The real clock is
// stopped and the game is stepped an eighth of a second a frame, so a clip is the same every time it is made.
// Needs ffmpeg on the path to join the frames (it is not a dependency of the game).
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const H = require(path.join(__dirname, '..', 'test', 'harness.js'));
const out = path.resolve(process.argv[2] || 'docs/screenshots'), only = process.argv[3];
// a clip is a list of beats: [seconds, what the player does]. travel: walk or run toward a point; look: 'bloom', 'ahead' or a heading
const N = -Math.PI / 2;
const CLIPS = {
  '40_at_its_post': { from: [86.3, 32.6, -0.67], beats: [[4, { look: 'bloom' }]] },
  '41_walk_and_it_does_not_turn': { from: [87, 37.2, N], beats: [[0.8, { look: 'bloom' }], [9, { to: [87, 33.4], look: 'bloom' }], [9, { to: [83.7, 31.0], look: 'bloom' }], [1.6, { look: 'bloom' }]] },
  '42_run_and_it_comes': { from: [87, 41.5, N], beats: [[9, { to: [86.6, 33.3], run: true, look: 'ahead' }], [4.6, { look: 'bloom' }]] },
  '43_it_follows_what_it_sees': { from: [87, 41.5, N], beats: [[9, { to: [86.9, 33.6], run: true, look: 'ahead' }], [1.2, { look: 'bloom' }], [9, { to: [87.4, 46.5], look: 'bloom' }], [2.6, { look: 'bloom' }]] },
};
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const s = await H.open(); await H.begin(s.page);
  await s.page.evaluate(() => { window.requestAnimationFrame = () => 0; });      // stop the real clock: the clip steps the game itself
  await s.page.waitForTimeout(300);
  for (const name of Object.keys(CLIPS)) {
    if (only && !name.includes(only)) continue;
    const clip = CLIPS[name], dir = fs.mkdtempSync(path.join(os.tmpdir(), 'la-gif-')); let n = 0;
    await s.page.evaluate(([x, y, d]) => {
      loadMap(LEDGE1.LEDGE, { x, y, dir: d }); G.state = 'play'; G.dead = false; G.player.hp = G.player.hpMax; G.day = 0; G.tod = 0.735; G.fadeT = 0; G.noise = 1; G.keys = {}; Weather.hold('clear'); GFX.laBodies = true;
      BLOOM4.reset(); if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(0); const m = document.querySelector('#msgs'); if (m) m.innerHTML = '';
      window.__look = d; advanceTime(400);
    }, clip.from);
    for (const [secs, act] of clip.beats) {
      for (let f = 0; f < secs * 8; f++) {
        const done = await s.page.evaluate((act) => {
          const c = Engine.cam, S = BLOOM4.state(); let arrived = false;
          for (let i = 0; i < 8; i++) {
            if (act.to && G.state === 'play') { c.dir = Math.atan2(act.to[1] - c.y, act.to[0] - c.x); G.keys = act.run ? { w: true, shift: true } : { w: true }; if (Math.hypot(act.to[0] - c.x, act.to[1] - c.y) < 0.25) { arrived = true; G.keys = {}; } } else G.keys = {};
            G.tod = 0.735; update(1 / 64);
          }
          G.keys = {};
          // the head turns to watch; the feet keep their own heading (in play: the mouse)
          const want = act.look === 'bloom' ? Math.atan2(S.y - c.y, S.x - c.x) : act.look === 'ahead' ? (act.to ? Math.atan2(act.to[1] - c.y, act.to[0] - c.x) : window.__look) : act.look;
          let d = want - window.__look; d = Math.atan2(Math.sin(d), Math.cos(d)); window.__look += Math.max(-0.27, Math.min(0.27, d));
          c.dir = window.__look; if (R3D.camera && R3D.camera.setAngle) { const dz = (LEDGE1.landH(S.x, S.y) - LEDGE1.landH(c.x, c.y)) * 0.62, dd = Math.hypot(S.x - c.x, S.y - c.y); R3D.camera.setAngle(act.look === 'bloom' ? Math.max(-0.45, Math.min(0.1, Math.atan2(dz, dd) * 0.8)) : -0.1); }
          render(); return arrived || G.state !== 'play';
        }, act);
        await s.page.screenshot({ path: path.join(dir, 'f' + String(n++).padStart(4, '0') + '.png'), clip: { x: 0, y: 0, width: 1280, height: 600 } });
        if (done && act.to) break;
        if (done && !act.to && n > 20) { for (let k = 0; k < 10; k++) await s.page.screenshot({ path: path.join(dir, 'f' + String(n++).padStart(4, '0') + '.png'), clip: { x: 0, y: 0, width: 1280, height: 600 } }); break; }
      }
    }
    const gif = path.join(out, name + '.gif');
    cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '8', '-i', path.join(dir, 'f%04d.png'), '-vf', 'scale=640:300:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle', gif]);
    const state = await s.page.evaluate(() => ({ bloom: BLOOM4.state().state, heard: BLOOM4.state().heard, clawed: BLOOM4.state().clawed, hp: Math.round(G.player.hp), game: G.state }));
    console.log('wrote ' + name + '.gif: ' + n + ' frames, ' + Math.round(fs.statSync(gif).size / 1024) + ' KB ' + JSON.stringify(state));
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(s.errors.length + ' page errors'); console.log(s.errors.slice(0, 8).join('\n'));
  await s.close();
})();
