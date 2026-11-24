// Usage: NODE_PATH=$(npm root -g) node tools/prologueshots.js <outDir>
// Phase 39's stills and clip: the prologue played through, as test/prologue39.test.js plays it (the same autopilot,
// test/harness.js), with a still at every beat and the walk recorded as 150_the_prologue.gif (needs ffmpeg).
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const H = require(path.join(__dirname, '..', 'test', 'harness.js'));
const out = path.resolve(process.argv[2] || 'docs/screenshots');
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const s = await H.open(); const page = s.page;
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'la-p39-')); let n = 0;
  const VIEW = { x: 0, y: 0, width: 1280, height: 800 };
  const still = async (name) => { await page.screenshot({ path: path.join(out, name + '.png'), clip: VIEW }); console.log('wrote ' + name + '.png'); };
  const frame = async (hold) => { for (let i = 0; i < (hold || 1); i++) await page.screenshot({ path: path.join(dir, 'f' + String(n++).padStart(4, '0') + '.png'), clip: VIEW }); };
  const click = (sel) => page.locator(sel).first().dispatchEvent('click');
  const press = async (k) => { await page.keyboard.down(k); await ev(() => advanceTime(50)); await page.keyboard.up(k); await ev(() => advanceTime(50)); };
  // walk in pieces of a third of a second, a clip frame after each
  const walk = async (x, y, r) => {
    for (let i = 0; i < 90; i++) {
      const w = await ev(([x, y, r]) => __P39.walkTo(x, y, r, 333, { noSettle: true }), [x, y, r]);
      await frame();
      if (process.env.P39DEBUG) console.log('     ' + JSON.stringify(await ev(() => { const m = G.ents.find((e) => e.id === 'la_marget'), c = Engine.cam, b = BLOOM4.state(), k = CARRY15.state(); return [+c.x.toFixed(2), +c.y.toFixed(2), +c.dir.toFixed(2), G.player.hp, +G.player.feet.toFixed(2), +G.map.groundAt(c.x, c.y).toFixed(2), b.state, +b.x.toFixed(2), +b.y.toFixed(2), m && [+m.x.toFixed(2), +m.y.toFixed(2), m.solid, m.hidden], [+k.x.toFixed(2), +k.y.toFixed(2)], +G.vel.x.toFixed(2), +G.vel.y.toFixed(2), JSON.stringify(G.keys)]; })));
      if (w.ok || w.why) { await log('walk to ' + x + ',' + y + ': ' + (w.ok ? 'there' : w.why)); return w; }
    }
    await log('walk to ' + x + ',' + y + ': not there');
    return { ok: false };
  };
  const log = async (what) => console.log('   ' + what + ' ' + JSON.stringify(await ev(() => ({ at: __P39.where(), bloom: BLOOM4.state().state, b: [+BLOOM4.state().x.toFixed(1), +BLOOM4.state().y.toFixed(1)], title: !!G.flags.la_title_seen, carry: CARRY15.state().on }))));
  const clearMsgs = () => ev(() => { const m = document.querySelector('#msgs'); if (m) m.innerHTML = ''; });

  await H.autopilot(page);
  await click('#btn-new');
  await page.waitForFunction(() => !!document.querySelector('#la-who'), null, { timeout: 20000 });
  await still('151_who_walks_north'); await frame(6);
  await click('#la-who [data-bg="deserter"]');
  await page.waitForFunction(() => G.state === 'intro' || G.state === 'play', null, { timeout: 20000 });
  if (await ev(() => G.state === 'intro')) await click('#btn-intro-skip');
  await page.waitForFunction(() => G.state === 'play', null, { timeout: 20000 });
  await ev(() => { if (typeof R3D !== 'undefined') R3D.setMode('on'); render(); render(); });
  for (let i = 0; i < 7; i++) { await ev(() => advanceTime(333)); await frame(); }
  await still('152_the_look_gives_the_errand'); await frame(6);

  await walk(87, 41, 0.35); await walk(87, 34.2, 0.3); await walk(87, 32.2, 0.3);
  // on the shelf, a look back up the ramp: the carter is coming down behind
  await ev(() => { __P39.face(Math.PI / 2 + 0.15); advanceTime(300); });
  await clearMsgs(); await still('153_the_carter_follows_down'); await frame(5);
  await walk(83.5, 30.8, 0.25);
  await ev(() => { advanceTime(800); __P39.face(-Math.PI / 2); });
  await clearMsgs(); await still('154_the_bothy_door'); await frame(5);
  await press('e'); await ev(() => advanceTime(300)); await frame(4);
  await ev(() => __P39.faceTo(4.62, 4.5)); await press('e'); await ev(() => advanceTime(200));
  await still('155_the_bar_across'); await frame(5);
  await walk(2.9, 2.9, 0.3); await ev(() => __P39.faceTo(2.6, 1.9)); await clearMsgs();
  await press('e'); await ev(() => advanceTime(100));
  await still('156_marget_gives_the_lantern'); await frame(8);
  await click('#d-tell'); await click('[data-topic="The south"]'); await click('#d-answer');
  await still('157_her_promise'); await frame(8);
  await click('[data-choice="0"]'); await click('#d-bye');
  await press('x'); await ev(() => advanceTime(100)); await still('158_the_account'); await frame(6); await press('Escape');
  await press('e'); await still('159_take_her_arm'); await frame(6);
  await click('#event-panel button[data-i="0"]');
  await walk(3.5, 4.2, 0.25); await ev(() => __P39.face(Math.PI / 2)); await press('e'); await frame(2); await press('e');
  await ev(() => { advanceTime(200); __P39.faceTo(CARTER13.state().x, CARTER13.state().y); }); await press('e');
  const i = await ev(() => Array.from(document.querySelectorAll('[data-choice]')).findIndex((b) => /Follow/.test(b.textContent)));
  await click('[data-choice="' + i + '"]'); await click('#d-bye');
  await ev(() => { __P39.face(0.35); advanceTime(200); }); await clearMsgs();
  await still('160_out_with_her_on_your_arm'); await frame(5);
  await walk(86.9, 32.4, 0.3); await walk(87, 36, 0.3);
  // half way up, without stopping (the bloom heard the carry and is coming): she is at your side
  await clearMsgs(); await still('161_up_the_ramp_with_her'); await frame(2);
  await walk(87, 40.6, 0.35);
  await ev(() => advanceTime(200)); await still('162_the_look_back'); await frame(12);
  await ev(async () => { for (let i = 0; i < 40 && G.openPanel !== 'la-prologue-end'; i++) { await new Promise((r) => setTimeout(r, 100)); advanceTime(50); } });
  await still('163_the_prologue_end'); await frame(14);

  const gif = path.join(out, '150_the_prologue.gif');
  cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '6', '-i', path.join(dir, 'f%04d.png'), '-vf', 'scale=512:320:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle', gif]);
  console.log('wrote 150_the_prologue.gif: ' + n + ' frames, ' + Math.round(fs.statSync(gif).size / 1024) + ' KB');
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(s.errors.length + ' page errors'); console.log(s.errors.slice(0, 8).join('\n'));
  await s.close();
})();
