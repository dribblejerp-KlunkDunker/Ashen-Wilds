// node test/carter13.test.js --no-browser
// Phase 13, the carter as a person: follows at 1.2 cells, holds and waits, never walks through a wall or off a
// cliff, goes down and bleeds, dies into the roll, and round-trips. The browser half checks the body and orders.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const C = require(path.join(ROOT, 'js', 'carter13.js'));
let fails = 0;
const check = (cond, label) => { if (cond) console.log('PASS ' + label); else { fails++; console.log('FAIL ' + label); } };

// ---- following
let s = C.make({ x: 3, y: 0, hp: 120 });
const env = { px: 0, py: 0 };
C.step(s, env, 1);
check(Math.abs(Math.hypot(s.x - 0, s.y - 0) - 1.2) < 1e-6, 'he stops at 1.2 cells from the player');
const at = s.x; C.step(s, env, 1);
check(Math.abs(s.x - at) < 1e-6, 'and does not crowd closer');
s = C.make({ x: 8, y: 0 }); C.step(s, env, 1);
check(s.x < 8 && s.x >= 1.2, 'he closes the distance at his own pace');

// ---- walls and cliffs
s = C.make({ x: 0, y: 0 });
const wall = { px: 5, py: 0, blocked: (x, y) => x > 1 };
C.step(s, wall, 2);
check(s.x <= 1 && s.y === 0, 'a wall stops him: x ' + s.x.toFixed(2));
s = C.make({ x: 0, y: 0 });
const cliff = { px: 5, py: 0, cliff: (x, y) => x > 1 };
C.step(s, cliff, 2);
check(s.x <= 1, 'a cliff stops him: x ' + s.x.toFixed(2));
s = C.make({ x: 0, y: 0 });
const both = { px: 5, py: 0, blocked: (x, y) => x > 1, cliff: (x, y) => x > 1 };
C.step(s, both, 2);
check(s.x === 0, 'a wall and a cliff together leave him where he is');

// ---- orders
s = C.make({ x: 3, y: 0 });
check(C.order(s, 'hold') && C.step(s, env, 1).x === 3, 'Hold keeps him where he is');
check(C.order(s, 'wait') && C.step(s, env, 1).x === 3, 'Wait keeps him where he is');
check(C.order(s, 'follow') && s.toldFollow, 'Follow is an explicit order, remembered');
check(!C.order(s, 'dance'), 'an unknown order is refused');
check(C.order(s, 'down') && s.mode === 'down' && s.bleed === C.BLEED, 'the downed state starts the bleed clock');

// ---- down, bleed, death, revive
s = C.make({ x: 3, y: 0 });
check(C.hurt(s, 32) && s.hp === 88, 'a claw takes 32');
check(C.hurt(s, 200) && s.mode === 'down' && s.hp === 0, 'enough damage puts him down');
check(C.tick(s, C.BLEED - 0.1) === null && s.mode === 'down', 'he bleeds but is not yet dead');
check(C.tick(s, 0.2) === 'died' && s.mode === 'dead', 'the bleed clock runs out and he dies');
check(C.tick(s, 1) === null, 'a dead man does not die twice');
s = C.make({ x: 3, y: 0 }); C.hurt(s, 200);
check(C.revive(s) && s.mode === 'hold' && s.hp > 0, 'a downed carter can be revived');
check(!C.revive(s), 'and only a downed one can be');

// ---- save
s = C.make({ x: 81.5, y: 30.5 });
C.order(s, 'hold'); C.hurt(s, 10);
const r = C.load(JSON.parse(JSON.stringify(s)), {});
check(r.x === 81.5 && r.y === 30.5 && r.mode === 'hold' && r.hp === 110, 'position, mode and health round-trip');
const d = C.load({ mode: 'dead', x: 1, y: 2, hp: 0, hpMax: 120, bleed: 0 }, {});
check(d.mode === 'dead' && d.hp === 0, 'a dead carter stays dead');
check(C.load(null, {}).mode === 'follow', 'a save without him gives a following carter');

// ---- names
check(C.TX.other === 'The other carter' && C.TX.name === 'The carter', 'the other carter has a name of his own');

// ---- source rules
const src = fs.readFileSync(path.join(ROOT, 'js', 'carter13.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src), 'the carter owns no random number and no clock');
check(!/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'the file is plain ASCII');
const q = src.match(/'(?:[^'\\\n]|\\.)*'/g) || [];
check(q.every((x) => !/[^\x09\x0a\x0d\x20-\x7e]/.test(x)), 'every quoted line is plain ASCII');
check(/la_carter/.test(src) && /la_carter/.test(fs.readFileSync(path.join(ROOT, 'js', 'ledge1.js'), 'utf8')), 'the wire drives the ledge\'s own carter');
check(/quest = function/.test(src) && /Follow me\./.test(src) && /Hold here\./.test(src), 'his talk menu is the two orders');

// ---- in a browser: the body follows, the orders change the mode, the door holds him, the roll takes his death.
(async () => {
  const HN = require('./harness.js');
  if (process.argv.includes('--no-browser') || !HN.playwright()) { console.log('SKIPPED the browser half of this test (no Playwright: set PLAYWRIGHT_MODULE or NODE_PATH)'); return; }
  const s = await HN.open();
  try {
    await HN.begin(s.page);
    const r = await s.page.evaluate(async () => {
      const out = {};
      const c = Engine.cam, e = CARTER13.body();
      out.body = !!e && e.id === 'la_carter' && !e.wander;
      advanceTime(6000);
      out.follow = { d: Math.hypot(e.x - c.x, e.y - c.y), mode: CARTER13.state().mode, map: G.mapId };
      // following but never told to come through, he waits outside the door when you go in (audit: tested before the
      // hold order, since a held carter rightly stays where he was told)
      loadMap(LEDGE1.BOTHY); advanceTime(200);
      out.door = { map: G.mapId, mode: CARTER13.state().mode, x: CARTER13.state().x, y: CARTER13.state().y };
      loadMap(LEDGE1.LEDGE); CARTER13.order(CARTER13.state(), 'follow'); CARTER13.state().toldFollow = false; advanceTime(4000);
      talk(e);
      out.choices = (DLG.choices || []).map((q) => q.t);
      DLG.choices[1].f();                    // Hold here
      out.hold = CARTER13.state().mode;
      closeModal(); G.state = 'play';        // leave the talk, as a player does, so the world runs
      const before = { x: e.x, y: e.y };
      G.keys = { w: true }; advanceTime(1500); G.keys = {};
      out.held = Math.hypot(e.x - before.x, e.y - before.y);
      CARTER13.hurt(CARTER13.state(), 200);
      for (let i = 0; i < 1300; i++) update(1 / 60);
      out.dead = { mode: CARTER13.state().mode, roll: COMPANY12.roll(G.flags.la_company).map((d) => d.name) };
      return out;
    });
    check(r.body, 'the ledge\'s carter is the companion body, not scenery');
    check(r.follow.mode === 'follow' && r.follow.d >= 1.2 && r.follow.d <= 2.2, 'he follows at 1.2 to 2 cells: ' + r.follow.d.toFixed(2));
    check(r.choices.join() === 'Follow me.,Hold here.', 'E opens the two orders, and no third');
    check(r.hold === 'hold', 'Hold changes his mode');
    check(r.held < 0.01, 'and he stays put while you walk');
    check(r.door.map === 'la_bothy' && r.door.mode === 'hold' && Math.abs(r.door.x - 83.5) < 1e-6, 'he waits outside the bothy, not in the door');
    check(r.dead.mode === 'dead' && r.dead.roll.includes('The carter'), 'his death writes a line in the roll');
    check(s.errors.length === 0, 'no page errors: ' + (s.errors[0] || 'none'));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); }
  await s.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
