// node test/carry15.test.js --no-browser
// Phase 15, the carry and the title: both hands full, 0.65 pace, no sprint or attack, a louder step, her place
// at the carrier's side, the ascent trigger once, and the title that does not come twice.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const C = require(path.join(ROOT, 'js', 'carry15.js'));
let fails = 0;
const check = (cond, label) => { if (cond) console.log('PASS ' + label); else { fails++; console.log('FAIL ' + label); } };

// ---- the load
let s = C.make();
check(!s.on && C.pace(s) === 1 && C.handsFree(s) && C.canAttack(s), 'unloaded, the walk is a walk and the hands are free');
s = C.attach('you', 'marget', 'arm');
check(s.on && s.carrier === 'you' && s.carried === 'marget' && s.item === 'arm', 'taking her arm records the pair');
check(C.pace(s) === 0.65 && !C.handsFree(s) && !C.canAttack(s) && C.noise(s) === 3.4, 'while carrying: 0.65 pace, no hands, no attack, a louder step');
C.detach(s);
check(!s.on && C.pace(s) === 1 && C.handsFree(s) && C.canAttack(s), 'releasing returns the hands and the pace');

// ---- her place
s = C.attach('you', 'marget', 'arm');
s.x = 0; s.y = 0;
C.step(s, { px: 2, py: 3 }, 0);
check(Math.abs(s.x - 2.55) < 1e-9 && Math.abs(s.y - 3) < 1e-9, 'she is placed at the carrier\'s side');
C.step(s, { px: 0, py: 0, dir: 0, side: 0.32, fwd: 0.8 }, 0);
check(Math.abs(s.x - 0.8) < 1e-9 && Math.abs(s.y - 0.32) < 1e-9, 'with a facing she stands forward and to the side, not under the next step');
const x = s.x;
C.step(s, { px: 4, py: 3, blocked: (bx, by) => bx > 4.4 }, 0);
check(Math.abs(s.x - x) < 1e-9, 'a blocked cell stops the pair where they are');
check(C.step(C.make(), { px: 9, py: 9 }, 0).x === 0, 'an unloaded state is never moved by the carry rule');

// ---- save
s = C.attach('you', 'marget', 'arm'); s.x = 87.2; s.y = 34.1;
const r = C.load(JSON.parse(JSON.stringify(s)));
check(r.on && r.x === 87.2 && r.y === 34.1 && r.carried === 'marget', 'the load, her place and the pair round-trip');
check(!C.load(null).on, 'a save without the load starts released');

// ---- source rules
const src = fs.readFileSync(path.join(ROOT, 'js', 'carry15.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src), 'the carry rule owns no random number and no clock');
check(!/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'the file is plain ASCII');
const q = src.match(/'(?:[^'\\\n]|\\.)*'/g) || [];
check(q.every((x) => !/[^\x09\x0a\x0d\x20-\x7e]/.test(x)), 'every quoted line is plain ASCII');
check(/la_carry/.test(src) && /la_title_seen/.test(src), 'the load and the title flag are saved');
check(/playerMove/.test(src) && /updateNarrow/.test(src) && /function startTitle/.test(src), 'the wire scales the walk, the noise and the title');

// ---- in a browser: take her arm, the pace, the look back. Skipped when no Playwright.
(async () => {
  const HN = require('./harness.js');
  if (process.argv.includes('--no-browser') || !HN.playwright()) { console.log('SKIPPED the browser half of this test (no Playwright: set PLAYWRIGHT_MODULE or NODE_PATH)'); return; }
  const s = await HN.open();
  try {
    await HN.begin(s.page);
    const r = await s.page.evaluate(async () => {
      const out = {};
      G.flags.la_marget_promise = true;
      loadMap(LEDGE1.BOTHY);
      const m = G.ents.find((e) => e.id === 'la_marget');
      talk(m);
      out.prompt = { state: G.state, text: document.getElementById('event-panel').innerText };
      const b = document.querySelector('#event-panel button[data-i="0"]'); if (b) b.click();
      out.attached = { on: CARRY15.state().on, hands: CARRY15.handsFree(CARRY15.state()), pace: CARRY15.pace(CARRY15.state()) };
      // walk a measured second on open ground (the bothy is too small: a walk there meets the wall), then the same
      // second free, from the same place and facing
      const c = Engine.cam;
      loadMap(LEDGE1.LEDGE);
      const at = { x: c.x, y: c.y }, walk1 = () => { c.x = at.x; c.y = at.y; c.dir = Math.PI; G.keys = { w: true }; advanceTime(1000); G.keys = {}; return Math.hypot(c.x - at.x, c.y - at.y); };
      out.walk = { dx: walk1(), pace: CARRY15.pace(CARRY15.state()) };
      out.walk.seen = G.ents.some((e) => e.id === 'la_marget' && !e.hidden);
      interact();
      out.walk.free = walk1();
      out.released = { on: CARRY15.state().on, hands: CARRY15.handsFree(CARRY15.state()) };
      // the top of the ramp starts the look back once
      CARRY15.attachNow(); loadMap(LEDGE1.LEDGE);
      // the ramp's foot (where Phase 15 first put the trigger) does not start it; the top does (Phase 39 fix)
      Engine.cam.x = 87.5; Engine.cam.y = 33.2;
      for (let i = 0; i < 5; i++) update(1 / 60);
      out.foot = !!G.flags.la_title_seen;
      Engine.cam.x = 87; Engine.cam.y = 39.6;
      for (let i = 0; i < 5; i++) update(1 / 60);
      out.title = { seen: !!G.flags.la_title_seen, open: G.openPanel, modal: document.getElementById('modal').classList.contains('hidden') === false };
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      out.after = { open: G.openPanel, state: G.state };
      // and it does not come twice
      const seen = G.flags.la_title_seen;
      CARRY15.startTitle(); out.twice = { before: seen, after: G.flags.la_title_seen, modal: document.getElementById('modal').classList.contains('hidden') };
      return out;
    });
    check(/Take her arm/.test(r.prompt.text) && r.attached.on, 'after the promise, Marget offers her arm');
    check(r.attached.on && !r.attached.hands && Math.abs(r.attached.pace - 0.65) < 1e-9, 'taking it loads both hands at 0.65 pace');
    check(r.walk.dx > 0.5 && r.walk.dx < r.walk.free * 0.75 && Math.abs(r.walk.pace - 0.65) < 1e-9, 'the measured walk is slower: ' + r.walk.dx.toFixed(2) + ' cells with her, ' + r.walk.free.toFixed(2) + ' free');
    check(r.walk.seen, 'out on the ledge with her, she is there at your side');
    check(!r.released.on && r.released.hands, 'E releases her and frees the hands');
    check(!r.foot, 'at the ramp\'s foot on the shelf, the title has not come');
    check(r.title.seen && r.title.open === 'la-title' && r.title.modal, 'at the top with her, the look back and title start once');
    check(r.after.open === null && r.after.state === 'play', 'Escape skips the title');
    check(r.twice.before && r.twice.after && r.twice.modal, 'the title does not come twice');
    check(s.errors.length === 0, 'no page errors: ' + (s.errors[0] || 'none'));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); }
  await s.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
