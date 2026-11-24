// node test/actthree36.test.js --no-browser
// Phase 36: the eleven days, one action per person, Marget's limit and the four wall courses.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const A = require(path.join(ROOT, 'js', 'actthree36.js'));
let fails = 0;
const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };

check(A.DAYS === 11 && A.CORRANT_PEOPLE === 40000 && A.WALL_COURSES.join(' ') === 'refusal hazard drown sell', 'eleven days, forty thousand people and four wall courses');
check(A.RULINGS.length === 7 && A.RULINGS.every((r) => /^R36\./.test(r.id) && r.proposed), 'the seven G36.0 rulings are listed with proposed defaults');
const s = A.make();
check(s.day === 1 && s.people.join(' ') === 'you marget the carter' && !s.done && !s.thaw, 'the default company has three people and eleven days');

check(!A.act(s, 'you', 'unknown') && !A.act(s, 'a stranger', 'rest'), 'an unknown action or person changes nothing');
check(A.act(s, 'you', 'corrant_numbers') && s.flags.corrant_numbers && s.numbers.people === 40000, 'Corrant puts forty thousand in the record');
check(!A.act(s, 'you', 'rest'), 'one person does one thing in a day');
check(!A.act(s, 'marget', 'corrant_numbers'), 'a once-only scene is not repeated by another person');
check(A.act(s, 'marget', 'marget_lodge') && s.marget.heard && s.flags.margetHeard && A.margetLine(s), 'Marget is heard at the Lodge');
check(A.askMore(s) === null && s.marget.askedMore && !('description' in s.marget), 'no follow-up makes Marget describe what she will not');
check(A.act(s, 'the carter', 'inspect_wall') && s.flags.inspected, 'another person can do another thing that day');
const next = A.endDay(s);
check(next.day === 2 && !next.done, 'the day turns');
check(A.act(s, 'you', 'rest') && A.act(s, 'marget', 'rest'), 'the next day is open again');

const clock = A.make();
for (let i = 0; i < 11; i++) {
  A.act(clock, 'you', 'rest');
  A.endDay(clock);
}
check(clock.done && clock.thaw && clock.fireSetting && clock.day === 11, 'the eleventh day ends in the thaw and fire-setting');
check(!A.act(clock, 'you', 'rest') && !A.endDay(clock), 'the clock stops after the thaw');
check(A.setWall(clock, 'refusal') && clock.wall === 'refusal' && !('ending' in clock), 'the wall can be recorded at the thaw, still unresolved');

for (const course of A.WALL_COURSES) {
  const w = A.make();
  const set = A.setWall(w, course);
  check(set && w.wall === course && w.flags.wall === course && set.resolved === false, 'the wall course ' + course + ' is recorded, not resolved');
}
const bad = A.make();
check(!A.setWall(bad, 'open') && !A.setWall(bad, 'home') && bad.wall === null, 'only the four wall courses can be recorded');
A.setWall(bad, 'refusal');
check(!A.setWall(bad, 'drown') && bad.wall === 'refusal', 'the wall decision is recorded once');

const h = A.make();
check(A.enter(h, 'halsing') && h.flags.halsing && h.flags.winterRoof === 'halsing' && h.roof === 'halsing', 'Halsing is entered through its winter roof');
check(!A.enter(h, 'the grass') && A.enter(A.make(), 'limewalks'), 'only the three winter roofs enter');
check(A.summary(s).resolved === false && A.summary(s).margetHeard && A.summary(s).actions.length >= 4, 'the summary keeps the days and the wall unresolved');
const src = fs.readFileSync(path.join(ROOT, 'js', 'actthree36.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src) && !/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'pure, plain ASCII, no clock');
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
