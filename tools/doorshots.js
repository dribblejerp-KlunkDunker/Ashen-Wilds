// Usage: NODE_PATH=$(npm root -g) node tools/doorshots.js <outDir> [only]
// Phase 5's stills and clips: the bar by Marget Sayle's door, the bar across it, the walking bloom come in by firelight;
// and, played (keys held, the engine's own noise, no clock), barring the door before it arrives and leaving it open.
// The clips need ffmpeg on the path to join the frames (it is not a dependency of the game).
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const H = require(path.join(__dirname, '..', 'test', 'harness.js'));
const out = path.resolve(process.argv[2] || 'docs/screenshots'), only = process.argv[3];
const S_ = Math.PI / 2, N_ = -Math.PI / 2;
const STILLS = [
  // name, camera x, y, heading, pitch, barred, bloom pose (null: at its post outside)
  ['50_the_bar_by_the_door', 3.5, 2.5, S_, 0.0, false, null],
  ['51_the_bar_across', 3.5, 2.5, S_, 0.0, true, null],
  ['52_it_came_in', 1.7, 2.2, 0.55, 0.0, false, { map: 'la_bothy', x: 3.6, y: 3.7, yaw: -2.5, state: 'listen', walk: 0, alert: 1, phase: 1.1 }],
];
// a clip is a list of beats: [seconds, what the player does]. to: walk (or run) toward a point; use: 'door' or 'bar'; look: 'bloom', 'door', 'ahead' or a heading
const CLIPS = {
  '53_bar_it_and_it_knocks': { from: [87, 41.5, N_], beats: [[9, { to: [86.6, 33.4], run: true, look: 'ahead' }], [3, { to: [83.6, 30.9], run: true, look: 'ahead' }], [0.4, { use: 'door' }], [1.6, { look: S_ + 0.6 }], [0.3, { use: 'bar' }], [1.2, { look: S_ }], [2.2, { to: [3.5, 3.1], look: S_, back: 1 }], [9, { look: S_ }]] },
  '54_leave_it_open_and_it_comes_in': { from: [87, 41.5, N_], beats: [[9, { to: [86.6, 33.4], run: true, look: 'ahead' }], [3, { to: [83.6, 30.9], run: true, look: 'ahead' }], [0.4, { use: 'door' }], [2.2, { to: [2.0, 2.6], look: 'ahead' }], [1.2, { look: 'door' }], [6, { look: 'bloom' }], [1.0, { to: [1.5, 3.4], look: 'bloom' }], [4, { look: 'bloom' }]] },
};
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const s = await H.open(); await H.begin(s.page);
  for (const [name, x, y, dir, pitch, bar, pose] of STILLS) {
    if (only && !name.includes(only)) continue;
    await s.page.evaluate(([x, y, dir, pitch, bar, pose]) => {
      BLOOM4.reset(); G.flags = { la_told_bar: true }; G.flags.la_barred = bar; loadMap(LEDGE1.BOTHY, { x, y, dir }); G.state = 'play'; G.day = 0; G.tod = 0.735; G.fadeT = 0; GFX.laBodies = true;
      BLOOM4.pose(pose || {}); if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(pitch);
      advanceTime(700); const m = document.querySelector('#msgs'); if (m) m.innerHTML = '';
    }, [x, y, dir, pitch, bar, pose]);
    await s.page.waitForTimeout(600);
    await s.page.evaluate(() => { const m = document.querySelector('#msgs'); if (m) m.innerHTML = ''; });
    await s.page.waitForTimeout(200);
    await s.page.screenshot({ path: path.join(out, name + '.png'), clip: { x: 0, y: 0, width: 1280, height: 600 } });
    console.log('wrote ' + name + '.png');
  }
  await s.page.evaluate(() => { window.requestAnimationFrame = () => 0; });     // stop the real clock: the clips step the game themselves
  for (const name of Object.keys(CLIPS)) {
    if (only && !name.includes(only)) continue;
    const clip = CLIPS[name], dir = fs.mkdtempSync(path.join(os.tmpdir(), 'la-gif-')); let n = 0;
    const shot = async () => s.page.screenshot({ path: path.join(dir, 'f' + String(n++).padStart(4, '0') + '.png'), clip: { x: 0, y: 0, width: 1280, height: 600 } });
    await s.page.evaluate(([x, y, d]) => {
      BLOOM4.reset(); G.flags = {}; loadMap(LEDGE1.LEDGE, { x, y, dir: d }); G.state = 'play'; G.dead = false; G.player.hp = G.player.hpMax; G.day = 0; G.tod = 0.735; G.fadeT = 0; G.noise = 1; G.keys = {}; Weather.hold('clear'); GFX.laBodies = true;
      if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(0); const m = document.querySelector('#msgs'); if (m) m.innerHTML = '';
      window.__look = d; advanceTime(400);
    }, clip.from);
    for (const [secs, act] of clip.beats) {
      if (act.use) {
        await s.page.evaluate((what) => {
          const c = Engine.cam;
          if (what === 'door') { c.dir = window.__look = -Math.PI / 2; interact(); }
          else { const b = G.ents.find((e) => e.use === 'la_bar'); c.dir = window.__look = Math.atan2(b.y - c.y, b.x - c.x); interact(); }
          for (let i = 0; i < 8; i++) update(1 / 64); window.__look = Engine.cam.dir; render();
        }, act.use);
        for (let k = 0; k < secs * 8; k++) await shot();
        continue;
      }
      for (let f = 0; f < secs * 8; f++) {
        const done = await s.page.evaluate((act) => {
          const c = Engine.cam, S = BLOOM4.state(); let arrived = false;
          for (let i = 0; i < 8; i++) {
            if (act.to && G.state === 'play') { c.dir = Math.atan2(act.to[1] - c.y, act.to[0] - c.x) + (act.back ? Math.PI : 0); G.keys = act.run ? { w: true, shift: true } : act.back ? { s: true } : { w: true }; if (Math.hypot(act.to[0] - c.x, act.to[1] - c.y) < 0.25) { arrived = true; G.keys = {}; } } else G.keys = {};
            G.tod = 0.735; update(1 / 64);
          }
          G.keys = {};
          const door = G.mapId === 'la_bothy' ? { x: 3.5, y: 5 } : { x: 83.5, y: 29.5 };
          const tgt = act.look === 'bloom' && S.map === G.mapId ? S : act.look === 'bloom' || act.look === 'door' ? door : null;
          const want = tgt ? Math.atan2(tgt.y - c.y, tgt.x - c.x) : act.look === 'ahead' ? (act.to ? Math.atan2(act.to[1] - c.y, act.to[0] - c.x) : window.__look) : act.look;
          let d = want - window.__look; d = Math.atan2(Math.sin(d), Math.cos(d)); window.__look += Math.max(-0.27, Math.min(0.27, d));
          c.dir = window.__look; if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(G.mapId === 'la_bothy' ? -0.02 : -0.1);
          render(); return arrived || G.state !== 'play';
        }, act);
        await shot();
        if (done && act.to) break;
      }
    }
    const gif = path.join(out, name + '.gif');
    cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '8', '-i', path.join(dir, 'f%04d.png'), '-vf', 'scale=640:300:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle', gif]);
    const st = await s.page.evaluate(() => ({ bloom: BLOOM4.state().map + ' ' + BLOOM4.state().state, clawed: BLOOM4.state().clawed, hp: Math.round(G.player.hp), barred: !!G.flags.la_barred, knocks: DOOR5.state().knocks, me: G.mapId }));
    console.log('wrote ' + name + '.gif: ' + n + ' frames, ' + Math.round(fs.statSync(gif).size / 1024) + ' KB ' + JSON.stringify(st));
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(s.errors.length + ' page errors'); console.log(s.errors.slice(0, 8).join('\n'));
  await s.close();
})();
