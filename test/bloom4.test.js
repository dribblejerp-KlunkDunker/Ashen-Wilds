// node test/bloom4.test.js               (add --no-browser to run only the half that needs no browser)
// NODE_PATH=$(npm root -g) node test/bloom4.test.js        with Playwright installed globally
// Phase 4, the walking bloom: it hunts by sound on the ledge (O7), modelled (O9). This checks its rules against the
// bestiary's numbers, its mind step by step without a browser, its body (bones, winding, the flat picture), and, in a
// browser, that it is PLAYED: walked past it does not turn, run past it comes and claws, it cannot follow you in at
// Marget Sayle's door, and the switch puts the flat painted figure in its place.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const B = require(path.join(ROOT, 'js', 'bloom4.js')), L = require(path.join(ROOT, 'js', 'ledge1.js'));
let fails = 0;
const check = (cond, label) => { if (cond) console.log('PASS ' + label); else { fails++; console.log('FAIL ' + label); } };
const R = B.R, src = fs.readFileSync(path.join(ROOT, 'js', 'bloom4.js'), 'utf8');

// ---- what the written world says, and that the rules say the same
const bible = ['the-smothering.md', 'bestiary.md'].map((f) => fs.readFileSync(path.join(ROOT, 'docs', 'worldbuilding', f), 'utf8')).join('\n');
check(/shambles at 1\.9 m\/s \(slower than you walk\), sees 8 m in a 120 degree cone,\s+hears a sprint or a swing within 8 m \(scaled by your noise\), claws for 16 and two seconds of\s+choking/.test(bible), 'the world bible says what a walking bloom is (the-smothering.md: 1.9 m/s, 8 m, 120 degrees, 16, two seconds)');
check(R.speed === 1.9 && R.see === 8 && Math.abs(R.seeCone - Math.PI * 2 / 3) < 1e-9 && R.claw === 16 && R.choke === 2, 'and the rules carry exactly those numbers');
const ENGINE_WALK = 2.6;   // js/game.js: (2.6 + Speed/60) cells a second, before running
check(/const spd = \(2\.6 \+ p\.attrs\.Speed \/ 60\) \* \(running \? 1\.7 : 1\)/.test(fs.readFileSync(path.join(ROOT, 'js', 'game.js'), 'utf8')) && R.speed < ENGINE_WALK, 'it shambles slower than you walk (1.9 against the engine\'s 2.6 and up)');

// ---- hearing and sight
check(!B.hears(1.0, 0.5) && !B.hears(2.4, 0.5) && !B.hears(2.9, 0.5), 'it does not hear you stand or walk, even at arm\'s length (noise 1.0, 2.4, and walking in noisy gear 2.9)');
check(B.hears(4.2, 7.9) && !B.hears(4.2, 8.2), 'it hears a run within 8 m and not beyond');
check(B.hearRange(10) > B.hearRange(5.5) && B.hearRange(5.5) > 8, 'louder is heard further: ' + [4.2, 5.5, 10].map((n) => B.hearRange(n).toFixed(1)).join(', ') + ' m');
const S0 = B.fresh(); S0.x = 0; S0.y = 0; S0.yaw = 0;
check(B.sees(S0, 5, 0.5, true) && B.sees(S0, 4, 6.5, true) && !B.sees(S0, 4, 7.5, true), 'it sees movement in front of it, inside a 120 degree cone');
check(!B.sees(S0, 3, 0, false) && !B.sees(S0, -3, 0, true) && !B.sees(S0, 8.5, 0, true), 'but not a player standing still, nor one behind it, nor one beyond 8 m');

// ---- its mind, step by step, on open ground
const open = { blocked: () => false, ground: () => 0 };
const run = (S, env, secs, until) => { const ev = { heard: 0, claw: 0 }; for (let i = 0; i < secs * 30; i++) { const e = B.think(S, Object.assign({}, open, env), 1 / 30); if (e.heard) ev.heard++; if (e.claw) ev.claw++; if (until && until(S)) break; } return ev; };
let S = B.fresh(); const post = { x: S.x, y: S.y };
let ev = run(S, { px: post.x + 3, py: post.y, noise: 2.4, moving: false, here: true }, 20);
check(S.state === 'post' && ev.heard === 0 && Math.hypot(S.x - post.x, S.y - post.y) < 1e-9, 'a walking player beside it, out of its sight: it stays at its post for 20 s');
S = B.fresh(); S.yaw = Math.PI;   // its back to the noise
ev = run(S, { px: post.x + 5, py: post.y, noise: 4.2, moving: false, here: true }, 0.1);
check(ev.heard === 1 && S.state === 'turn', 'a run 5 m behind it: it hears, and turns');
ev = run(S, { px: post.x + 5, py: post.y, noise: 1.0, moving: false, here: false }, 0.01);
S = B.fresh(); S.yaw = Math.PI; run(S, { px: post.x + 5, py: post.y, noise: 4.2, moving: false, here: true }, 0.1);
const t0 = { x: S.x, y: S.y }; let tArr = 0;
for (let i = 0; i < 30 * 12; i++) { B.think(S, Object.assign({}, open, { px: post.x + 9, py: post.y + 3, noise: 1, moving: false, here: true }), 1 / 30); tArr += 1 / 30; if (S.state === 'listen') break; }
check(S.state === 'listen' && Math.hypot(S.x - (post.x + 5), S.y - post.y) < 0.4, 'it goes to WHERE THE NOISE WAS, not to where you have gone quietly since, and listens there');
const pace = Math.hypot(S.x - t0.x, S.y - t0.y) / tArr;
check(pace > 1.2 && pace <= 1.9 + 1e-6, 'at a shamble: ' + pace.toFixed(2) + ' m/s over the whole way, with its turn');
run(S, { px: post.x + 9, py: post.y + 3, noise: 1, moving: false, here: true }, 40, (q) => q.state === 'post');
check(S.state === 'post' && Math.hypot(S.x - post.x, S.y - post.y) < 0.3, 'nothing more heard: it listens a while and goes back to its post');
S = B.fresh(); S.yaw = 0;
ev = run(S, { px: post.x + 0.5, py: post.y, noise: 4.2, moving: true, here: true }, 6.6);
check(ev.claw >= 2 && ev.claw <= 4, 'in reach it claws, a wind-up and a rest between each: ' + ev.claw + ' in 6.6 s');
S = B.fresh(); S.yaw = 0; run(S, { px: post.x + 4, py: post.y, noise: 4.2, moving: true, here: true }, 1.2);
ev = run(S, { px: post.x + 4, py: post.y, noise: 1, moving: false, here: false }, 0.1);
check(S.state === 'toWait', 'when you go in at the door, it makes for a place a little way off it');
run(S, { px: 0, py: 0, noise: 1, moving: false, here: false }, 20, (q) => q.state === 'wait');
check(S.state === 'wait' && Math.hypot(S.x - R.wait.x, S.y - R.wait.y) < 0.4, 'and waits there');
run(S, { px: 0, py: 0, noise: 1, moving: false, here: false }, R.waitFor + 30, (q) => q.state === 'post');
check(S.state === 'post', 'then, after ' + R.waitFor + ' s with nothing, goes back to its post');
// a wall in the way: it does not step into it, and gives up rather than pushing at it for ever
S = B.fresh(); S.yaw = 0; const wallX = post.x + 1;
const walled = { blocked: (x) => x > wallX, ground: () => 0 };
let inWall = 0; for (let i = 0; i < 30 * 30; i++) { B.think(S, Object.assign({}, walled, { px: post.x + 4, py: post.y, noise: i < 5 ? 4.2 : 1, moving: false, here: true }), 1 / 30); if (S.x > wallX) inWall++; }
check(inWall === 0 && S.state !== 'come', 'a wall between: it never steps into it, and stops pushing at it (' + S.state + ')');
S = B.fresh(); S.yaw = 0; let cliff = 0;
for (let i = 0; i < 30 * 10; i++) { B.think(S, { blocked: () => false, ground: (x) => (x > post.x + 1 ? 4 : 0), px: post.x + 3, py: post.y, noise: i < 5 ? 4.2 : 1, moving: false, here: true }, 1 / 30); if (S.x > post.x + 1) cliff++; }
check(cliff === 0, 'nor does it climb a step it could not (the ledge\'s rock is 4.5 above the shelf)');
check(!/Math\.random|Date\.now/.test(src), 'nothing it does is dice: no random number and no wall clock');

// ---- where it stands, on the ledge as built
const onShelf = (p) => p.x > L.SHELF.x0 && p.x < L.SHELF.x1 && p.y > L.SHELF.y0 && p.y < L.SHELF.y1 + 1 && Math.abs(L.landH(p.x, p.y) - L.SHELF.h) < 0.2;
check(onShelf(R.post) && onShelf(R.wait), 'its post and its waiting place are on the shelf, at the shelf\'s height');
check(!(R.post.x >= 82 && R.post.x < 86 && R.post.y >= 27 && R.post.y < 30) && !(R.wait.x >= 82 && R.wait.x < 86 && R.wait.y >= 27 && R.wait.y < 30), 'neither is inside the bothy');
check(Math.hypot(R.post.x - (L.RAMP.x0 + L.RAMP.x1) / 2, R.post.y - L.RAMP.y0) < 2.5, 'it stands by the foot of the ramp, so the way to the door goes behind it');
check(Math.hypot(R.wait.x - 83.5, R.wait.y - 30.6) > 1.2 && Math.hypot(R.wait.x - 83.5, R.wait.y - 30.6) < 2.5, 'it waits near the door, not on it (' + Math.hypot(R.wait.x - 83.5, R.wait.y - 30.6).toFixed(1) + ' m off)');

// ---- its body
const m = B.sculpt(), n = m.data.length / B.STRIDE;
let badBone = 0, badN = 0, top = -1e9;
const rest = B.rig({ phase: 0, walk: 0, reach: 0, alert: 0 });
for (let i = 0; i < n; i++) {
  const o = i * B.STRIDE, b = m.data[o + 14]; if (!(b >= 0 && b < B.NB && b === Math.round(b))) badBone++;
  if (Math.abs(Math.hypot(m.data[o + 3], m.data[o + 4], m.data[o + 5]) - 1) > 0.02 && i < m.body) badN++;
  if (i < m.body) { const M = rest[b]; top = Math.max(top, M[8] * m.data[o] + M[9] * m.data[o + 1] + M[10] * m.data[o + 2] + M[11]); }
}
check(n % 3 === 0 && m.body % 3 === 0 && m.shadow === 48, 'its body is whole triangles (' + m.body / 3 + '), and a 16-sided shadow');
check(badBone === 0 && badN === 0, 'every corner of it is carried by one of its ' + B.NB + ' bones, with a normal of unit length');
let wrong = 0; for (let i = 0; i < m.body; i += 3) { const v = (k) => [0, 1, 2].map((j) => m.data[(i + k) * B.STRIDE + j]), nn = (k) => [3, 4, 5].map((j) => m.data[(i + k) * B.STRIDE + j]); const a = v(0), b = v(1), c = v(2), e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], s = [0, 1, 2].map((j) => nn(0)[j] + nn(1)[j] + nn(2)[j]); if (f[0] * s[0] + f[1] * s[1] + f[2] * s[2] < -1e-12) wrong++; }
check(wrong === 0, 'every triangle faces the way its normals do, so the ink hull draws round it and not through it');
const tall = (top - m.lo) * 0.61875;   // the model is built in its own units and drawn at R3D.ZK of them to a cell's height
check(tall > 0.5 && tall < 0.7, 'stooped, caps and all it is about a person\'s height (' + tall.toFixed(2) + ' of a cell; the painted people stand 0.62)');
check(m.body / 3 < 20000, 'and is light enough to draw every frame: ' + m.body / 3 + ' triangles, built once and moved by its bones');
const fl = B.paintFlat();
check(fl.h === 160 && ![53, 60, 66].includes(fl.w), 'the flat figure is a 160-high painting the engine will not lay an old rig on (' + fl.w + ' wide)');
let teal = 0; for (let i = 0; i < fl.data.length; i++) { const c = fl.data[i]; if (c >>> 24) { const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255; if (g > r + 40 && b > r + 20) teal++; } }
check(teal > 20, 'and its caps are teal, the bloom\'s colour (' + teal + ' pixels)');

// ---- the words
const strings = Object.values(B.TX);
check(strings.length >= 6 && strings.every((t) => !/[^\x20-\x7e]/.test(t)), 'every line of in-game text is plain ASCII (canon rule)');
check((src.match(/'(?:[^'\\\n]|\\.)*'/g) || []).every((t) => !/[^\x20-\x7e]/.test(t)), 'and so is every quoted string in the file');
check(!/prophe|chosen|destin/i.test(strings.join(' ')), 'no prophecy');

// ---- the page loads it
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
check(/js\/sun3\.js\?v=\d+"><\/script>\s*<script src="js\/bloom4\.js\?v=\d+"><\/script>/.test(html), 'index.html loads bloom4.js straight after sun3.js');
check(/js\/bloom4\.js\?v=\d+/.test(sw), 'and the offline list carries it');

// ---- the played half, in a browser
(async () => {
  const HN = require('./harness.js');
  if (process.argv.includes('--no-browser') || !HN.playwright()) { console.log('SKIPPED the browser half of this test (no Playwright: set PLAYWRIGHT_MODULE or NODE_PATH)'); return; }
  const s = await HN.open();
  try {
    await HN.begin(s.page);
    const r = await s.page.evaluate(() => {
      const out = { row: null }, c = Engine.cam, Bm = BLOOM4, log = [];
      try { renderAccessibilityMenu(); const b = document.getElementById('gfx-labodies'); out.row = b ? b.textContent : null; if (typeof closeModal === 'function') closeModal(); } catch (e) { out.row = String(e); }
      out.passes = R3D.passes().map((p) => p.name); out.failed = Bm.gl().failed; out.modelled = Bm.modelled();
      const ent = Bm.entity(); out.inMap = !!ent && G.maps.la_ledge.entities.includes(ent) && !!ent.solid;
      const begin = (x, y) => { Bm.reset(); loadMap(LEDGE1.LEDGE, { x, y, dir: -Math.PI / 2 }); G.state = 'play'; G.dead = false; G.player.hp = G.player.hpMax || 43; G.noise = 1; G.keys = {}; advanceTime(300); };
      const blockedAt = () => { const S = Bm.state(), m = G.maps.la_ledge; return m.isBlocked(Math.floor(S.x), Math.floor(S.y)); };
      let onBlocked = 0;
      const go = (tx, ty, secs, runK) => { for (let i = 0; i < secs * 10; i++) { c.dir = Math.atan2(ty - c.y, tx - c.x); G.keys = runK ? { w: true, shift: true } : { w: true }; advanceTime(100); if (blockedAt()) onBlocked++; if (Math.hypot(tx - c.x, ty - c.y) < 0.3 || G.state !== 'play') break; } G.keys = {}; };
      const wait = (secs) => { for (let i = 0; i < secs * 10; i++) { advanceTime(100); if (blockedAt()) onBlocked++; if (G.state !== 'play') break; } };
      // 1. walk down the ramp and behind it to the door
      begin(87, 38); const hp0 = G.player.hp; go(87, 33.4, 20); go(83.6, 31.0, 20); wait(3);
      out.walk = { state: Bm.state().state, heard: Bm.state().heard, hp: G.player.hp, hp0, door: Math.hypot(c.x - 83.6, c.y - 31.0) < 0.5 };
      // 2. run down the ramp, and stand
      begin(87, 41.5); const box = document.querySelector('#msgs'); if (box) box.innerHTML = '';
      go(86.6, 33.3, 20, true); const heardAt = Bm.state().heard; let peakNoise = 0, clawedAt = -1, hpAfter = null;
      for (let i = 0; i < 80 && G.state === 'play'; i++) { advanceTime(100); if (blockedAt()) onBlocked++; if (Bm.state().clawed && clawedAt < 0) { clawedAt = i; hpAfter = G.player.hp; } if (clawedAt >= 0 && i - clawedAt < 20) peakNoise = Math.max(peakNoise, G.noise); if (clawedAt >= 0 && i - clawedAt > 20) break; }
      out.run = { heard: heardAt, clawed: Bm.state().clawed, hp0: G.player.hpMax || 43, hpAfter, peakNoise, msgs: box ? box.textContent : '' };
      // 3. run, then go in at the door: it cannot follow, waits off the door, and goes back to its post
      begin(87, 41.5); go(86.6, 33.6, 20, true); wait(0.5); const heard3 = Bm.state().state;
      loadMap(LEDGE1.BOTHY); G.state = 'play'; let maxIn = 0;
      for (let i = 0; i < 400; i++) { advanceTime(100); const S = Bm.state(); if (S.x >= 82 && S.x < 86 && S.y >= 27 && S.y < 30) maxIn++; if (blockedAt()) onBlocked++; if (S.state === 'wait') break; }
      const atWait = Bm.state(); out.door = { heard: heard3, state: atWait.state, x: atWait.x, y: atWait.y, inside: maxIn };
      for (let i = 0; i < 900 && Bm.state().state !== 'post'; i++) advanceTime(100);
      out.door.after = Bm.state().state; out.onBlocked = onBlocked;
      // 4. the switch: off, the flat figure stands in its place, and the frame is what it is with the modelled pass gone
      Bm.reset(); Bm.pose({}); loadMap(LEDGE1.LEDGE, { x: 86.3, y: 32.6, dir: -0.67 }); G.state = 'play'; G.day = 0; G.tod = 0.735; G.fadeT = 0; Weather.hold('clear'); advanceTime(600); G.tod = 0.735;
      if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(0);
      const pn = performance.now.bind(performance), t0 = pn(), dn = Date.now, d0 = dn();
      const fnv = (d) => { let x = 0x811c9dc5 | 0; for (let i = 0; i < d.length; i++) x = Math.imul(x ^ d[i], 16777619) | 0; return x >>> 0; };
      const frame = () => { performance.now = () => t0; Date.now = () => d0; render(); render(); const p = R3D.readPixels(); performance.now = pn; Date.now = dn; return p; };
      // what is drawn where it stands: the share of the view's middle third that is teal
      const tealIn = (p) => { let t = 0, n = 0; for (let y = Math.floor(p.h * 0.2); y < p.h * 0.8; y += 2) for (let x = Math.floor(p.w * 0.3); x < p.w * 0.7; x += 2) { const i = (y * p.w + x) * 4, rr = p.data[i], g = p.data[i + 1], b = p.data[i + 2]; n++; if (g > rr + 35 && b > rr + 20) t++; } return t / n; };
      GFX.laBodies = true; advanceTime(17); const on = frame(); out.spriteOn = ent.sprite;
      GFX.laBodies = false; advanceTime(17); const off = frame(); out.spriteOff = ent.sprite;
      const gone = R3D.removePass('la-bodies'); R3D.invalidate(); const without = frame(); R3D.addPass(Bm.pass); GFX.laBodies = true;
      out.sw = { on: fnv(on.data), off: fnv(off.data), without: fnv(without.data), gone, tealOn: tealIn(on), tealOff: tealIn(off) };
      // 5. what it costs: thirty frames with it in view, with the modelled pass and without (software rendering: an upper bound)
      const cost = (enable) => { GFX.laBodies = enable; advanceTime(17); const a = pn(); for (let i = 0; i < 30; i++) render(); return (pn() - a) / 30; };
      cost(true); out.ms = { on: cost(true), off: cost(false), pass: Bm.gl().ms }; GFX.laBodies = true;
      out.tickErr = Bm.gl().tickErr || null;
      return out;
    });
    check(r.row === 'On', 'Options has a row for the modelled bodies');
    check(r.passes.includes('la-bodies') && !r.failed && r.modelled, 'under the 3D renderer it is drawn as a model (pass la-bodies; ' + (r.failed || 'no GL failure') + ')');
    check(r.inMap, 'and it stands in the ledge\'s map as a solid thing you can look at and cannot walk through');
    check(r.walk.state === 'post' && r.walk.heard === 0 && r.walk.hp === r.walk.hp0 && r.walk.door, 'PLAYED: walk down the ramp and behind it to the door, and it never turns');
    check(r.run.heard >= 1 && r.run.clawed >= 1, 'PLAYED: run down the ramp, and it hears, comes, and claws');
    check(r.run.hpAfter === r.run.hp0 - 16, 'the claw takes 16 (' + r.run.hp0 + ' to ' + r.run.hpAfter + ')');
    check(r.run.peakNoise > 5, 'and the dust sets you coughing, which is loud (noise up to ' + r.run.peakNoise.toFixed(1) + ')');
    check(/walking bloom/i.test(r.run.msgs), 'what happened is said in words: "' + r.run.msgs.slice(0, 120).replace(/\s+/g, ' ') + '"');
    check(r.door.inside === 0 && r.door.state === 'wait' && Math.hypot(r.door.x - 85.3, r.door.y - 31.5) < 0.5, 'PLAYED: go in at the door and it cannot follow; it waits off the door (' + r.door.state + ' at ' + r.door.x.toFixed(1) + ', ' + r.door.y.toFixed(1) + ')');
    check(r.door.after === 'post', 'and in time goes back to its post');
    check(r.onBlocked === 0, 'in all of that it never stood on a cell the map blocks');
    check(r.spriteOn === 'la_bloom_ghost' && r.spriteOff === 'la_bloom_flat', 'the switch: on, its place in the map holds nothing to see (the model is drawn there); off, the flat painted figure');
    check(r.sw.on !== r.sw.off && r.sw.tealOn > 0.0005 && r.sw.tealOff > 0.0002, 'on and off are different pictures, and both show its teal caps (' + (r.sw.tealOn * 100).toFixed(2) + '% and ' + (r.sw.tealOff * 100).toFixed(2) + '% of the middle of the view)');
    check(r.sw.gone && r.sw.off === r.sw.without, 'off draws exactly what it draws with the modelled pass taken out (frame hash ' + r.sw.off + ')');
    console.log('NOTE frame cost in software rendering, 30 frames with it in view: ' + r.ms.on.toFixed(1) + ' ms with the model, ' + r.ms.off.toFixed(1) + ' ms with the flat figure (the time to submit a frame; software rendering cannot say what it costs on a real card)');
    check(r.ms.on - r.ms.off < Math.max(8, r.ms.off * 0.5), 'it costs a small part of the frame even in software rendering (' + (r.ms.on - r.ms.off).toFixed(1) + ' ms more; the look test cost 27)');
    check(!r.tickErr, 'its step through the game never threw: ' + (r.tickErr || 'none'));
    check(s.errors.length === 0, 'no page errors: ' + (s.errors[0] || 'none'));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); }
  await s.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
