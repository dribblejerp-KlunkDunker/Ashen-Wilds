// node test/troll44.test.js            (add --no-browser to run only the half that needs no browser)
// NODE_PATH=$(npm root -g) node test/troll44.test.js     with Playwright installed globally
// Phase 44, the blind quarry-troll: it hunts by sound alone, comes to where the sound was, raises its fists and brings
// them down on that spot; stand still and it cannot find you; step out of the ring and it strikes empty ground.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const T = require(path.join(ROOT, 'js', 'troll44.js'));
const noBrowser = process.argv.includes('--no-browser');
let fails = 0;
const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };

// ---- what it hears (bestiary.md: a walk 6 m, a sprint 14 m; standing still, nothing)
check(T.reachOf(1.0, false) === 0 && T.reachOf(2.4, false) === 0, 'standing still it hears nothing, even at arm\'s length');
check(Math.abs(T.reachOf(2.4, true) - 6) < 1e-9 && Math.abs(T.reachOf(4.2, true) - 14) < 1e-9 && Math.abs(T.reachOf(16, true) - 16) < 1e-9, 'a walk carries 6, a sprint 14, a blade on stone 16 (the hearing table)');
const S0 = T.fresh({ x: 0, y: 0, yaw: 0 });
check(T.pick(S0, [{ x: 5, y: 0, reach: 6 }]) && !T.pick(S0, [{ x: 7, y: 0, reach: 6 }]), 'a walk is heard at 5, not at 7');
check(!T.pick(S0, [{ x: 4, y: 0, reach: 6, through: 1 }]) && T.pick(S0, [{ x: 2.5, y: 0, reach: 6, through: 1 }]), 'through stone a sound carries half as far');
const both = T.pick(S0, [{ x: 3, y: 0, reach: 6, who: 'a' }, { x: 10, y: 0, reach: 14, who: 'b' }]);
check(both && both.who === 'b', 'of two it hears, it goes to the one heard best');

// ---- the hunt, step by step
const open = { blocked: () => false, ground: () => 0 };
const run = (S, secs, envf) => { const evs = []; for (let i = 0; i < secs * 30; i++) evs.push(T.think(S, Object.assign({}, open, envf(i / 30)), 1 / 30)); return evs; };
{
  const S = T.fresh({ x: 0, y: 0, yaw: 0 });
  // you walk once, eight cells off, then stand still where you are: it comes to where the sound was
  const ev = run(S, 10, (t) => ({ sounds: t < 0.1 ? [{ x: 5, y: 0, reach: 6 }] : [], px: 5, py: 3, here: true }));
  const pounds = ev.filter((e) => e.pound), hits = ev.filter((e) => e.hit);
  check(ev[0].heard && pounds.length === 1 && Math.hypot(pounds[0].pound.x - 5, pounds[0].pound.y) < 1e-9, 'it hears a step, comes to where it was and pounds that spot, once');
  check(hits.length === 0, 'you, three cells off the spot and still, are not struck');
}
{
  const S = T.fresh({ x: 0, y: 0, yaw: 0 });
  const ev = run(S, 10, (t) => ({ sounds: t < 0.1 ? [{ x: 5, y: 0, reach: 6 }] : [], px: 5.5, py: 0.5, here: true }));
  check(ev.some((e) => e.hit), 'standing in the ring when the fists come down, you are struck');
}
{
  // it raises its fists over the spot; you creep out of the ring in that second; it strikes empty ground
  const S = T.fresh({ x: 0, y: 0, yaw: 0 });
  let raisedAt = -1, px = 5, hit = false, pounded = false;
  for (let i = 0; i < 300; i++) {
    const e = T.think(S, Object.assign({}, open, { sounds: i < 3 ? [{ x: 5, y: 0, reach: 6 }] : [], px, py: 0, here: true }), 1 / 30);
    if (S.state === 'raise' && raisedAt < 0) raisedAt = i;
    if (raisedAt >= 0 && S.state === 'raise') px += 3.0 / 30;
    if (e.hit) hit = true; if (e.pound) pounded = true;
  }
  check(raisedAt > 0 && pounded && !hit, 'its fists are up a second: walking out of the ring in time, you are not struck');
}
{
  // a new, louder sound while it walks sends it there; once its fists are up, nothing does
  const S = T.fresh({ x: 0, y: 0, yaw: 0 });
  run(S, 1.2, () => ({ sounds: [{ x: 5, y: 0, reach: 6 }], px: 30, py: 30, here: true }));
  run(S, 0.2, () => ({ sounds: [{ x: 0, y: 9, reach: 14 }], px: 30, py: 30, here: true }));
  const re = Math.hypot(S.tx, S.ty - 9) < 1e-9;
  const S2 = T.fresh({ x: 0, y: 0, yaw: 0 }); S2.state = 'raise'; S2.t = 0; S2.tx = 1; S2.ty = 0;
  T.think(S2, Object.assign({}, open, { sounds: [{ x: 0, y: 4, reach: 14 }], px: 30, py: 30, here: true }), 1 / 30);
  check(re && S2.tx === 1 && S2.ty === 0, 'a louder sound turns it while it walks; with its fists up it does not turn');
}
{
  // after the blow it listens six seconds, then goes home and sits still
  const S = T.fresh({ x: 0, y: 0, yaw: 0 });
  const states = [S.state];
  for (let i = 0; i < 30 * 30; i++) { T.think(S, Object.assign({}, open, { sounds: i < 3 ? [{ x: 4, y: 0, reach: 6 }] : [], px: 30, py: 30, here: true }), 1 / 30); if (states[states.length - 1] !== S.state) states.push(S.state); }
  check(states.join(',') === 'rest,turn,go,raise,slam,listen,home,rest' && Math.hypot(S.x, S.y) < 0.5, 'then it listens, forgets, and goes home to sit still: ' + states.join(' > '));
}
{
  // standing still beside it the whole time: nothing
  const S = T.fresh({ x: 0, y: 0, yaw: 0 });
  const ev = run(S, 20, () => ({ sounds: [], px: 1.2, py: 0, here: true }));
  check(S.state === 'rest' && !ev.some((e) => e.heard || e.pound), 'stand still at arm\'s length for twenty seconds and it never stirs');
}

// ---- its body
const M = T.sculpt();
check(M.body > 10000 && M.body < 30000 && M.shadow === 48 && M.invRest.length === T.NB, 'its body is the look test\'s sculpt, ' + M.body + ' vertices on ' + T.NB + ' bones, and a shadow');
const rest = T.rig({}), up = T.rig({ raise: 1 });
check(up[T.B.fistL][11] > rest[T.B.fistL][11] + 0.6 && up[T.B.fistR][11] > rest[T.B.fistR][11] + 0.6, 'raised, both fists are high over its head');
check(T.GROUNDS.map((g) => g.place + ':' + g.x + ',' + g.y).join(' ') === '26:1200,1060 37:1230,500', 'it keeps Z1\'s two grounds for it, the plan\'s places 26 and 37');
const z = fs.readFileSync(path.join(ROOT, 'docs', 'worldbuilding', 'atlas', '10-zones.md'), 'utf8');
check(/\| 26 \| Quarry-troll ground \| 1200, 1060 \| hunt \|/.test(z) && /\| 37 \| Quarry-troll on the high ground \| 1230, 500 \| hunt \|/.test(z), 'and the plan says so');
const book = fs.readFileSync(path.join(ROOT, 'docs', 'worldbuilding', 'items-and-texts.md'), 'utf8');
check(book.includes(T.TX.near), 'the words near its ground are the quarry\'s own (items-and-texts.md)');

const src = fs.readFileSync(path.join(ROOT, 'js', 'troll44.js'), 'utf8');
check(!/Math\.random|Date\.now/.test(src) && !/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'plain ASCII, no dice');
check(Object.values(T.TX).every((s) => !/[^\x20-\x7e]/.test(s)), 'its words are plain ASCII');

// ---------------------------------------------------------------- the browser half
(async () => {
  if (noBrowser) return;
  const H = require(path.join(__dirname, 'harness.js'));
  const s = await H.open();
  if (!s) { console.log('SKIP the browser half: Playwright not found (NODE_PATH=$(npm root -g))'); return; }
  try {
    await H.begin(s.page);
    await H.autopilot(s.page);
    const ev = (fn, arg) => s.page.evaluate(fn, arg);
    await ev(() => {
      window.__go = (x, y, dir) => { G.state = 'paused'; loadMap('la_z1', { x, y, dir: dir || 0 }); G.state = 'play'; G.fadeT = 0; G.keys = {}; document.querySelector('#msgs').innerHTML = ''; };
      window.__walk = (x, y, ms) => {
        const c = Engine.cam, norm = (a) => Math.atan2(Math.sin(a), Math.cos(a)); let i = 0;
        for (; i < (ms || 20000) / 16.7; i++) { const d = norm(Math.atan2(y - c.y, x - c.x) - c.dir); if (Math.hypot(x - c.x, y - c.y) < 0.3) break; G.keys = { w: Math.abs(d) < 0.5, arrowleft: d < -0.06, arrowright: d > 0.06 }; update(1 / 60); }
        G.keys = {}; return i;
      };
      window.__wait = (s) => { for (let i = 0; i < s * 60; i++) update(1 / 60); };
    });

    // ---- 1. two trolls on the open map, at their grounds, sitting still
    const a1 = await ev(() => {
      OPEN42.finish(G.maps.la_z1); __go(990.5, 150.5, Math.PI / 2);
      const T = TROLL44.trolls();
      return { n: T.length, at: T.map((t) => [t.id, +t.S.x.toFixed(1), +t.S.y.toFixed(1), t.S.state]), ents: G.ents.filter((e) => e.laTroll).length, row: LEDGE1.SWITCHES.some((r) => r[0] === 'laTrolls') };
    });
    check(a1.n === 2 && a1.at.every((t) => t[3] === 'rest') && Math.hypot(a1.at[0][1] - 1200, a1.at[0][2] - 1060) < 6 && Math.hypot(a1.at[1][1] - 1230, a1.at[1][2] - 500) < 6 && a1.ents === 2, 'a troll sits at each of its two grounds: ' + JSON.stringify(a1.at));
    check(a1.row, 'Options has the switch "The quarry-trolls"');

    // ---- 2. walking up to it, it hears you, comes, and pounds; stand still and be stone, and it does not find you
    const a2 = await ev(() => {
      const t = TROLL44.trolls()[1], S = t.S, h = S.home;
      __go(h.x - 12, h.y, 0); G.player.hp = G.player.hpMax || 100; const hp0 = G.player.hp;
      __wait(1);
      const s0 = S.state, said = document.querySelector('#msgs').innerText;
      __walk(h.x - 6.5, h.y, 4000);
      const heard = S.heard;
      // now stand still and let it come
      let raised = false; for (let i = 0; i < 60 * 8; i++) { update(1 / 60); if (S.state === 'raise') raised = true; if (S.pounds) break; }
      __wait(1);
      return { s0, heard, raised, pounds: S.pounds, hits: S.hits, hp: [hp0, G.player.hp], chips: G.ents.filter((e) => e.sprite === 'la_chips').length, said };
    });
    check(a2.s0 === 'rest' && a2.heard >= 1 && a2.raised && a2.pounds >= 1, 'walking up to it, it hears you, comes to where you were and pounds: ' + JSON.stringify(a2));
    check(a2.chips >= 1, 'it leaves a ring of shattered stone where it pounded');
    check(/Rings of shattered stone\. Something pounds here\. Stand still and be stone\./.test(a2.said), 'coming near its ground you read the quarry\'s warning');

    // ---- 3. step out of the ring when its fists go up, and it strikes the empty ground
    const a3 = await ev(() => {
      TROLL44.reset(); const t = TROLL44.trolls()[1], S = t.S, h = S.home;
      __go(h.x - 9, h.y, 0); G.player.hp = G.player.hpMax || 100; const hp0 = G.player.hp;
      __wait(1); __walk(h.x - 5.5, h.y, 3000);
      for (let i = 0; i < 60 * 10 && S.state !== 'raise'; i++) update(1 / 60);
      // step back, away from it, while its fists are up (S walks backward)
      const at = S.state, spot = [S.tx, S.ty];
      for (let i = 0; i < 54; i++) { G.keys = { s: true }; update(1 / 60); }
      G.keys = {}; const out = +Math.hypot(Engine.cam.x - spot[0], Engine.cam.y - spot[1]).toFixed(2);
      // and then still: be stone
      for (let i = 0; i < 60 * 12; i++) update(1 / 60);
      return { at, out, hits: S.hits, pounds: S.pounds, hp: [hp0, G.player.hp], state: S.state };
    });
    check(a3.at === 'raise' && a3.pounds >= 1 && a3.hits === 0 && a3.hp[1] === a3.hp[0], 'stepping out of the ring as its fists rise, the blow falls on empty ground and you stand untouched: ' + JSON.stringify(a3));

    // ---- 4. stand in the ring, and the blow lands
    const a4 = await ev(() => {
      TROLL44.reset(); const t = TROLL44.trolls()[1], S = t.S, h = S.home;
      __go(h.x - 9, h.y, 0); G.player.hp = G.player.hpMax || 100; const hp0 = G.player.hp;
      __wait(1); __walk(h.x - 5.5, h.y, 3000);
      for (let i = 0; i < 60 * 12 && !S.pounds; i++) update(1 / 60);
      return { hits: S.hits, hp: [hp0, G.player.hp] };
    });
    check(a4.hits === 1 && a4.hp[1] < a4.hp[0] - 40, 'standing where you were heard, the fists come down on you: ' + JSON.stringify(a4.hp));

    // ---- 5. a thrown stone draws it
    const a5 = await ev(() => {
      TROLL44.reset(); const t = TROLL44.trolls()[1], S = t.S, h = S.home;
      __go(h.x - 20, h.y, 0); __wait(0.5);
      TROLL44.heardThrow(h.x - 6, h.y, 7);
      for (let i = 0; i < 60 * 8 && !S.pounds; i++) update(1 / 60);
      return { pounds: S.pounds, at: [+S.tx.toFixed(1), +S.ty.toFixed(1)], wrapped: /heardThrow/.test(String(throwDistraction)) };
    });
    check(a5.pounds === 1 && a5.wrapped, 'a thrown stone draws it to where it landed, and it pounds there; the engine\'s throws reach it: ' + JSON.stringify(a5));

    // ---- 6. it is drawn, and off it is the flat painting; the switch takes it away
    const a6 = await ev(() => {
      TROLL44.reset(); const t = TROLL44.trolls()[1], S = t.S, h = S.home; S.held = true;
      __go(h.x - 6, h.y, 0); render(); render();
      const drawn = TROLL44.gl().drawn, modelled = t.e.sprite;
      GFX.laBodies = false; update(1 / 60); const flat = t.e.sprite; GFX.laBodies = true; update(1 / 60);
      GFX.laTrolls = false; update(1 / 60); const gone = { n: TROLL44.trolls().length, ents: G.ents.filter((e) => e.laTroll).length };
      GFX.laTrolls = true; update(1 / 60); const back = TROLL44.trolls().length;
      return { drawn, modelled, flat, gone, back, ms: TROLL44.gl().ms };
    });
    check(a6.drawn > 0 && a6.modelled === 'la_troll_ghost' && a6.flat === 'la_troll_flat', 'it is drawn as its sculpted body; with "Modelled bodies" off, as a flat painting');
    check(a6.gone.n === 0 && a6.gone.ents === 0 && a6.back === 2, 'off, no troll is on the highland edge and nothing of it is left; on, both sit at home again');
    console.log('   drawing the trolls took ' + a6.ms.toFixed(1) + ' ms of a frame here (software rendering)');

    const err = await ev(() => TROLL44.state().err || TROLL44.gl().failed || TROLL44.gl().tickErr);
    check(!err, 'the wire ran without an error' + (err ? ': ' + err : ''));
    check(s.errors.length === 0, 'no page errors: ' + (s.errors[0] || 'none'));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); console.log(e.stack.split('\n').slice(0, 4).join('\n')); }
  await s.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
