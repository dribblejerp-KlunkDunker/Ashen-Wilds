// node test/opening11.test.js --no-browser
// Phase 11, the opening look: the Slagcrown must be held near the middle of the view for two seconds,
// added up, before the errand is given. This tests the rule on its own; the browser half checks the wire.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const O = require(path.join(ROOT, 'js', 'opening11.js'));
let fails = 0;
const check = (cond, label) => { if (cond) console.log('PASS ' + label); else { fails++; console.log('FAIL ' + label); } };

// ---- the rule
check(O.HOLD === 2 && Math.abs(O.CONE - Math.PI / 12) < 1e-12, 'two seconds, fifteen degrees either side of the middle');
const west = O.bearing(89.5, 48.5, 21, 48);
check(Math.abs(Math.abs(west) - Math.PI) < 0.01, 'from the spawn the tower bears due west (' + west.toFixed(4) + ' rad)');
let s = O.make();
for (let i = 0; i < 190; i++) O.step(s, Math.PI, west, 0.01);
check(!O.seen(s) && Math.abs(O.progress(s) - 0.95) < 1e-9, '1.90 s looking is not yet enough');
O.step(s, Math.PI, west, 0.1);
check(O.seen(s) && O.progress(s) === 1, '2.00 s is enough');

s = O.make();
O.step(s, Math.PI, west, 1.0);
O.step(s, 0, west, 1.0);
O.step(s, Math.PI, west, 1.0);
check(O.seen(s), 'the seconds add up across glances away, rather than having to be unbroken');

s = O.make();
O.step(s, west + O.CONE + 0.001, west, 1.0);
check(s.t === 0, 'just outside the cone counts nothing');
O.step(s, west + O.CONE, west, 0.5);
check(Math.abs(s.t - 0.5) < 1e-12, 'the edge of the cone counts');
O.step(s, west - O.CONE, west, 0.5);
check(Math.abs(s.t - 1.0) < 1e-12, 'and the other edge counts');

s = O.make();
O.step(s, Math.PI, -Math.PI, 2.0);
check(O.seen(s), 'the wrap at +/-pi is handled (west is west from both sides)');
s = O.make();
O.step(s, Math.PI, west, 0);
O.step(s, Math.PI, west, -1);
O.step(s, NaN, west, 1);
O.step(s, Math.PI, Infinity, 1);
check(!O.seen(s) && s.t === 0, 'zero, negative, NaN and infinite inputs add nothing');

check(O.progress(null) === 0 && O.progress(O.make()) === 0, 'progress starts at zero');
s = O.make(); O.step(s, Math.PI, west, 0.7);
const p1 = O.progress(s); O.step(s, Math.PI, west, 0.3);
check(p1 > 0 && O.progress(s) > p1, 'progress only rises while looking');

// ---- every player, not just one
const a = O.make(), b = O.make();
O.step(a, Math.PI, west, 2.0);
O.step(b, Math.PI, west, 1.0);
let c = O.combine([a, b]);
check(!O.seen(c) && Math.abs(O.progress(c) - 0.5) < 1e-12, 'in company, the slowest watcher holds the progress');
O.step(b, Math.PI, west, 1.0);
c = O.combine([a, b]);
check(O.seen(c) && O.progress(c) === 1, 'the look is done only when every watcher has looked');
check(!O.seen(O.combine([])), 'an empty company has looked at nothing');
check(O.seen(O.combine([a])), 'one watcher alone is the whole company');

// ---- the source rules
const src = fs.readFileSync(path.join(ROOT, 'js', 'opening11.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src), 'the rule owns no clock and no random number');
check(!/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'the file is plain ASCII');
const said = src.match(/'(?:[^'\\\n]|\\.)*'/g) || [];
check(said.every((q) => !/[^\x20-\x7e]/.test(q)), 'every quoted line is plain ASCII');
check(fs.existsSync(path.join(ROOT, 'js', 'ledge1.js')) && /OPEN(?:ING)?11\.step/.test(fs.readFileSync(path.join(ROOT, 'js', 'ledge1.js'), 'utf8')), 'the ledge feeds the camera bearing to the rule');

// ---- in a browser: the wire withholds the errand and then gives it. Skipped when no Playwright.
(async () => {
  const HN = require('./harness.js');
  if (process.argv.includes('--no-browser') || !HN.playwright()) { console.log('SKIPPED the browser half of this test (no Playwright: set PLAYWRIGHT_MODULE or NODE_PATH)'); return; }
  const s = await HN.open();
  try {
    await HN.begin(s.page);
    const r = await s.page.evaluate(async () => {
      const out = {};
      out.atStart = { flag: !!G.flags.la_looked, journal: G.journal.map((j) => j.text) };
      LEDGE1.resetLook(); G.journal = [];
      Engine.cam.dir = Math.PI;
      advanceTime(1900);
      out.early = { flag: !!G.flags.la_looked, journal: G.journal.length };
      advanceTime(300);
      out.after = { flag: !!G.flags.la_looked, journal: G.journal.map((j) => j.text) };
      // look away for two seconds: the count is held, and the errand is still given only once
      LEDGE1.resetLook(); G.journal = [];
      Engine.cam.dir = 0;
      advanceTime(2500);
      out.away = { flag: !!G.flags.la_looked, journal: G.journal.length };
      Engine.cam.dir = Math.PI;
      advanceTime(2500);
      out.back = { flag: !!G.flags.la_looked, journal: G.journal.length };
      return out;
    });
    check(r.atStart.journal.length === 0 && !r.atStart.flag, 'on arrival the errand is withheld and no look is recorded');
    check(!r.early.flag && r.early.journal === 0, '1.9 s of looking does not release it');
    check(r.after.flag && r.after.journal.length === 1, '2.0 s of looking releases the errand once');
    check(!r.away.flag && r.away.journal === 0, 'looking away does not count');
    check(r.back.flag && r.back.journal === 1, 'the accumulated look releases it when you come back');
    check(s.errors.length === 0, 'no page errors: ' + (s.errors[0] || 'none'));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); }
  await s.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
