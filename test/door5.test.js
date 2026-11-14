// node test/door5.test.js               (add --no-browser to run only the half that needs no browser)
// NODE_PATH=$(npm root -g) node test/door5.test.js        with Playwright installed globally
// Phase 5, the door that holds: Marget Sayle's door has a bar, and the safe room is only safe when it is across.
// This checks the written lines it answers, the bar's paintings, the bloom's mind at a door without a browser, and, in
// a browser, plays it: bar the door and the bloom leans on it once and goes away; leave it open and it comes in.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const D = require(path.join(ROOT, 'js', 'door5.js')), B = require(path.join(ROOT, 'js', 'bloom4.js')), L = require(path.join(ROOT, 'js', 'ledge1.js'));
let fails = 0;
const check = (cond, label) => { if (cond) console.log('PASS ' + label); else { fails++; console.log('FAIL ' + label); } };
const src = fs.readFileSync(path.join(ROOT, 'js', 'door5.js'), 'utf8');

// ---- what it answers
const design = fs.readFileSync(path.join(ROOT, 'docs', 'worldbuilding', 'the-round-and-the-long-account.md'), 'utf8');
check(/The safe room made real:\*\* a door that holds, and what the hunter does at it\./.test(design), 'the design asks for it: "a door that holds, and what the hunter does at it"');
check(/One knock, once\.\*\* No scare is ever repeated\./.test(design) && /The worst thing is never on screen\./.test(design), 'and its rules of dread say one knock, once, and the worst thing never on screen');

// ---- where things are, against the ledge as built
const lsrc = fs.readFileSync(path.join(ROOT, 'js', 'ledge1.js'), 'utf8'), P = D.PLACE;
check(/portal: \{ map: LEDGE, x: 83\.5, y: 30\.6/.test(lsrc) && P.outside.x === 83.5 && P.outside.y === 30.6, 'the bloom tries the door where a player comes out of it (83.5, 30.6)');
check(/m\.set\(3, 5, DOOR\(/.test(lsrc) && Math.floor(P.barSet.x) === 3 && P.barSet.y > 4.5 && P.barSet.y < 5, 'the bar, set, lies across the inner face of the bothy\'s door (cell 3, 5)');
check(Math.hypot(P.waitOut.x - P.outside.x, P.waitOut.y - P.outside.y) > 1.2 && P.waitOut.x === B.R.wait.x, 'shut out, it waits off the door, at Phase 4\'s waiting place');

// ---- the bar, painted
const set = D.paintBarSet(), lean = D.paintBarLean();
const lit = (p) => { let n = 0; for (let i = 0; i < p.data.length; i++) if (p.data[i] >>> 24) n++; return n; };
check(set.w === 120 && set.h === 80 && Math.abs(set.hs * set.w / set.h - 0.8) < 0.01, 'the bar across is drawn 0.8 of a wall wide (' + set.w + ' x ' + set.h + ')');
check(lean.h === 150 && ![53, 60, 66].includes(lean.w) && ![53, 60, 66].includes(set.w), 'and the leaning bar is 150 high; neither is a width the engine would lay an old rig on');
check(lit(set) > 1500 && lit(lean) > 1200, 'both are painted (' + lit(set) + ' and ' + lit(lean) + ' pixels)');
let rowLo = 1e9, rowHi = -1; for (let y = 0; y < set.h; y++) for (let x = 0; x < set.w; x++) if (set.data[y * set.w + x] >>> 24) { rowLo = Math.min(rowLo, y); rowHi = Math.max(rowHi, y); }
const midH = (set.h - (rowLo + rowHi) / 2) / set.h * set.hs;
check(midH > 0.3 && midH < 0.55, 'the beam sits at about waist height (' + midH.toFixed(2) + ' of a wall)');

// ---- the bloom's mind at a door, without a browser
const open = { blocked: () => false, ground: () => 0 };
let S = B.fresh(); S.yaw = 0; const door = { x: S.x - 3, y: S.y };
for (let i = 0; i < 30; i++) B.think(S, Object.assign({}, open, { px: S.x + 4, py: S.y, noise: 4.2, moving: true, here: true, door }), 1 / 30);
B.think(S, Object.assign({}, open, { px: 0, py: 0, noise: 1, moving: false, here: false, door }), 1 / 30);
check(S.state === 'toDoor' && S.tx === door.x, 'when you go out of its map, it follows to the door you went through');
let atDoor = false; for (let i = 0; i < 30 * 12 && !atDoor; i++) atDoor = B.think(S, Object.assign({}, open, { px: 0, py: 0, noise: 1, moving: false, here: false, door }), 1 / 30).door;
check(atDoor && Math.hypot(S.x - door.x, S.y - door.y) < 0.4, 'and says when it is there; what happens next is the door\'s business');
S = B.fresh(); S.state = 'listen'; S.t = 0;
let homeDoor = false; for (let i = 0; i < 30 * 30 && !homeDoor; i++) homeDoor = B.think(S, Object.assign({}, open, { px: 0, py: 0, noise: 1, moving: false, here: false, door, home: door, homeIsDoor: true }), 1 / 30).door;
check(homeDoor && S.state === 'back', 'shut in a room with nothing to hunt, it listens, then makes for the door to go home');
S = B.fresh(); for (let i = 0; i < 30; i++) B.think(S, Object.assign({}, open, { px: S.x + 4, py: S.y, noise: 4.2, moving: true, here: true }), 1 / 30);
B.think(S, Object.assign({}, open, { px: 0, py: 0, noise: 1, moving: false, here: false }), 1 / 30);
check(S.state === 'toWait', 'with no door listed it still behaves as Phase 4 made it');

// ---- the words
const strings = Object.values(D.TX);
check(strings.length >= 8 && strings.every((t) => !/[^\x20-\x7e]/.test(t)), 'every line of in-game text is plain ASCII (canon rule)');
check((src.match(/'(?:[^'\\\n]|\\.)*'/g) || []).every((t) => !/[^\x20-\x7e]/.test(t)), 'and so is every quoted string in the file');
check(!/Math\.random|Date\.now|performance\.now/.test(src), 'no dice and no clock: even the knock\'s noise is a fixed hash');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
check(/js\/bloom4\.js\?v=\d+"><\/script>\s*<script src="js\/door5\.js\?v=\d+"><\/script>/.test(html) && /js\/door5\.js\?v=\d+/.test(sw), 'index.html loads door5.js straight after bloom4.js, and the offline list carries it');

// ---- the played half, in a browser
(async () => {
  const HN = require('./harness.js');
  if (process.argv.includes('--no-browser') || !HN.playwright()) { console.log('SKIPPED the browser half of this test (no Playwright: set PLAYWRIGHT_MODULE or NODE_PATH)'); return; }
  const s = await HN.open();
  try {
    await HN.begin(s.page);
    const r = await s.page.evaluate(() => {
      const out = {}, c = Engine.cam, Bm = BLOOM4, box = () => (document.querySelector('#msgs') || {}).textContent || '';
      const begin = (x, y) => { Bm.reset(); G.flags = {}; loadMap(LEDGE1.LEDGE, { x, y, dir: -Math.PI / 2 }); G.state = 'play'; G.dead = false; G.player.hp = G.player.hpMax || 43; G.noise = 1; G.keys = {}; const b = document.querySelector('#msgs'); if (b) b.innerHTML = ''; advanceTime(300); };
      let bad = 0; const check = () => { const S = Bm.state(), m = G.maps[S.map]; if (m.isBlocked(Math.floor(S.x), Math.floor(S.y))) bad++; for (const e of m.entities) if (e.solid && !e.laBloom && !e.hidden && e.kind !== 'item' && Math.hypot(e.x - S.x, e.y - S.y) < (e.radius || 0.3) + 0.1) bad++; };
      const go = (tx, ty, secs, run) => { for (let i = 0; i < secs * 10; i++) { c.dir = Math.atan2(ty - c.y, tx - c.x); G.keys = run ? { w: true, shift: true } : { w: true }; advanceTime(100); check(); if (Math.hypot(tx - c.x, ty - c.y) < 0.3 || G.state !== 'play') break; } G.keys = {}; };
      const wait = (secs, until) => { for (let i = 0; i < secs * 10; i++) { advanceTime(100); check(); if (G.state !== 'play' || (until && until())) break; } };
      const inDoor = () => { c.dir = -Math.PI / 2; interact(); advanceTime(100); };
      const useBar = () => { const b = G.ents.find((e) => e.use === 'la_bar'); c.dir = Math.atan2(b.y - c.y, b.x - c.x); interact(); advanceTime(50); return b; };
      out.doors = Bm.DOORS.map((d) => d.from + '>' + d.to);
      // the bar
      begin(83.5, 30.9); inDoor(); out.inside = G.mapId; out.told = /Put the bar across/.test(box());
      const n0 = G.noise, bar = useBar(); out.bar = { flag: !!G.flags.la_barred, sprite: bar.sprite, noise: G.noise - n0, said: /drop the bar/.test(box()) };
      useBar(); out.bar.lifted = !G.flags.la_barred && bar.sprite === 'la_bar_lean';
      // A. run down, go in, bar it: it leans on the door once, and goes away
      begin(87, 41.5); go(86.6, 33.6, 20, true); go(83.6, 30.9, 5, true); const heardA = Bm.state().heard; inDoor(); useBar();
      let everIn = 0; for (let i = 0; i < 600; i++) { advanceTime(100); check(); if (Bm.state().map !== LEDGE1.LEDGE) everIn++; if (Bm.state().state === 'post' && i > 100) break; }
      out.A = { heard: heardA, knocks: DOOR5.state().knocks, leans: DOOR5.state().leans, everIn, end: Bm.state().state, hp: G.player.hp, hpMax: G.player.hpMax || 43, knockSaid: /leans on the door from outside, once/.test(box()), marget: /They do not stay where it is quiet/.test(box()) };
      // ... and a second time it leans in silence: one knock, once
      const flags = G.flags; Bm.reset(); loadMap(LEDGE1.LEDGE, { x: 87, y: 41.5, dir: -Math.PI / 2 }); G.flags = flags; G.flags.la_barred = false; const b2 = document.querySelector('#msgs'); if (b2) b2.innerHTML = '';
      go(86.6, 33.6, 20, true); go(83.6, 30.9, 5, true); inDoor(); useBar(); wait(20, () => Bm.state().state === 'wait');
      out.A2 = { knocks: DOOR5.state().knocks, leans: DOOR5.state().leans, said: /leans on the door/.test(box()) };
      // B. leave it open: it comes in after you, and the room is as dangerous as the shelf
      begin(87, 41.5); go(86.6, 33.6, 20, true); go(83.6, 30.9, 5, true); inDoor(); go(2.0, 2.6, 4);
      wait(12, () => Bm.state().map === LEDGE1.BOTHY && Bm.state().t > 1.5);
      out.B = { inMap: Bm.state().map, ledgeHidden: Bm.entity(LEDGE1.LEDGE).hidden, bothyShown: !Bm.entity(LEDGE1.BOTHY).hidden };
      go(1.5, 3.4, 2); wait(8, () => Bm.state().clawed > 0); out.B.clawed = Bm.state().clawed; out.B.hp = G.player.hp;
      // ... and if it comes in and finds nothing to hunt (you stand still: be stone), it goes back out the way it came
      begin(87, 41.5); go(86.6, 33.6, 20, true); go(83.6, 30.9, 5, true); inDoor(); go(4.4, 1.7, 4);
      wait(15, () => Bm.state().map === LEDGE1.BOTHY); const cameIn = Bm.state().map; wait(40, () => Bm.state().map === LEDGE1.LEDGE);
      out.B.still = { cameIn, wentOut: Bm.state().map, hp: G.player.hp, hpMax: G.player.hpMax || 43 }; wait(40, () => Bm.state().state === 'post'); out.B.still.end = Bm.state().state;
      // C. a barred door does not open from outside, nor from inside
      begin(83.5, 30.8); G.flags.la_barred = true; inDoor(); out.C = { stayed: G.mapId, said: /barred from inside/.test(box()) };
      loadMap(LEDGE1.BOTHY); G.state = 'play'; transfer({ map: LEDGE1.LEDGE, x: 83.5, y: 30.6, dir: Math.PI / 2 }); out.C.inStayed = G.mapId; out.C.inSaid = /Lift it first/.test(box());
      out.bad = bad;
      // D. drawn inside: the body by firelight, and the switch
      Bm.reset(); G.flags = { la_told_bar: true }; G.dead = false; G.player.hp = G.player.hpMax || 43; loadMap(LEDGE1.BOTHY, { x: 1.7, y: 2.2, dir: 0.55 }); G.state = 'play'; G.tod = 0.735; Bm.pose({ map: LEDGE1.BOTHY, x: 3.6, y: 3.7, yaw: -2.5, state: 'listen', alert: 1 }); advanceTime(400);
      const pn = performance.now.bind(performance), t0 = pn(), dn = Date.now, d0 = dn();
      const frame = () => { performance.now = () => t0; Date.now = () => d0; render(); render(); const p = R3D.readPixels(); performance.now = pn; Date.now = dn; let t = 0, n = 0; for (let y = 0; y < p.h; y += 2) for (let x = Math.floor(p.w * 0.3); x < p.w * 0.8; x += 2) { const i = (y * p.w + x) * 4, rr = p.data[i], g = p.data[i + 1], bb = p.data[i + 2]; n++; if (g > rr + 25 && g > bb) t++; } return t / n; };   // its caps: green over red, warm as the firelight makes them
      GFX.laBodies = true; advanceTime(17); out.D = { on: frame(), passOn: R3D.passes().some((p) => p.name === 'la-bodies') }; GFX.laBodies = false; advanceTime(17); out.D.off = frame(); out.D.sprite = Bm.entity(LEDGE1.BOTHY).sprite; GFX.laBodies = true;
      out.err = DOOR5.state().err || Bm.gl().tickErr || null;
      return out;
    });
    check(r.doors.join(' ') === 'la_ledge>la_bothy la_bothy>la_ledge', 'the bloom knows both ways through Marget Sayle\'s door');
    check(r.inside === 'la_bothy' && r.told, 'the first time you come in, Marget Sayle tells you to put the bar across');
    check(r.bar.flag && r.bar.sprite === 'la_bar_set' && r.bar.said && r.bar.noise > 0.5, 'use the bar and it drops across the door, and that is not silent (noise +' + r.bar.noise.toFixed(1) + ')');
    check(r.bar.lifted, 'use it again and it stands back by the door');
    check(r.A.heard >= 1 && r.A.everIn === 0 && r.A.leans >= 1, 'PLAYED: run down, go in and bar it: the bloom follows to the door, and the door holds');
    check(r.A.knocks === 1 && r.A.knockSaid && r.A.marget, 'it leans on the door once, you are told, and Marget Sayle says it will go');
    check(r.A.end === 'post' && r.A.hp === r.A.hpMax, 'it waits a while off the door and goes back to its post; you are not touched');
    check(r.A2.leans > r.A.leans && r.A2.knocks === 1 && !r.A2.said, 'the second time it leans in silence: one knock, once');
    check(r.B.inMap === 'la_bothy' && r.B.ledgeHidden && r.B.bothyShown, 'PLAYED: leave the door open and it comes in after you');
    check(r.B.clawed >= 1 && r.B.hp < 43, 'move where it can see you, and it claws you in the room (' + r.B.hp + ' left)');
    check(r.B.still.cameIn === 'la_bothy' && r.B.still.wentOut === 'la_ledge' && r.B.still.hp === r.B.still.hpMax && r.B.still.end === 'post', 'stand still in the room and it finds nothing: it listens, goes back out the way it came, and home to its post');
    check(r.C.stayed === 'la_ledge' && r.C.said, 'a barred door does not open from outside: "The door is barred from inside."');
    check(r.C.inStayed === 'la_bothy' && r.C.inSaid, 'nor from inside until the bar is lifted');
    check(r.bad === 0, 'in all of that it never stood in a wall, the table, the bed or Marget Sayle');
    check(r.D.passOn && r.D.on > 0.0005 && r.D.off > 0.0002 && r.D.sprite === 'la_bloom_flat', 'inside, it is drawn by firelight, modelled or (switch off) flat (' + (r.D.on * 100).toFixed(2) + '% and ' + (r.D.off * 100).toFixed(2) + '% of the view is its caps)');
    check(!r.err, 'nothing it does threw: ' + (r.err || 'none'));
    check(s.errors.length === 0, 'no page errors: ' + (s.errors[0] || 'none'));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); }
  await s.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
