// node test/endings37.test.js --no-browser
// Phase 37: five endings, their conditions, the last line and the invariants that must hold.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const E = require(path.join(ROOT, 'js', 'endings37.js'));
let fails = 0;
const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };

check(E.ENDING_IDS.join(' ') === 'refusal hazard drown sell home' && E.ENDING_IDS.every((id) => E.ENDINGS[id].title && E.ENDINGS[id].text), 'the five endings, each with its title and text');
check(E.RULINGS.length === 8 && E.RULINGS.every((r) => /^R37\./.test(r.id) && r.proposed), 'the eight G37.0 rulings are listed with proposed defaults');
check(E.ending(E.make()) === null, 'an incomplete state gets no ending');

const r = E.make(); Object.assign(r, { wall: 'refusal', margetHeard: true, lodgeStrike: true });
check(E.ending(r) === 'refusal', 'the refusal needs Marget heard, a strike and no forsworn spokesman');
r.forsworn = true; check(E.ending(r) === null, 'a forsworn spokesman cannot reach the refusal');
const h = E.make(); Object.assign(h, { wall: 'hazard', charterAmended: true, covenantPaid: true, gateBuilt: true });
check(E.ending(h) === 'hazard', 'the hazard needs the charter, the covenant and the gate');
h.gateBuilt = false; check(E.ending(h) === null, 'the hazard cannot open without the gate');
const d = E.make(); Object.assign(d, { wall: 'drown', pumpsBroken: true, deadCalm: true });
check(E.ending(d) === 'drown', 'drowning needs the pumps broken on a Dead Calm night');
d.deadCalm = false; check(E.ending(d) === null, 'the pumps alone do not drown the ore');
const s = E.make(); Object.assign(s, { wall: 'sell', sold: true });
check(E.ending(s) === 'sell' && E.ending(Object.assign(E.make(), { sold: true })) === 'sell', 'selling at the Exchange reaches sell and sail');
const ho = E.make(); Object.assign(ho, { wall: 'home', voyageBack: true });
check(E.ending(ho) === 'home' && E.ending(Object.assign(E.make(), { voyageBack: true })) === 'home', 'the voyage back reaches go home');

const line = E.lastLine({ paid: 'a signature', owing: 'one winter', refused: 'Daw' });
check(line.text === 'Paid: a signature. Owing: one winter. Refused by: Daw.' && E.parseLastLine(line.text).paid === 'a signature', 'the three blanks take the player\'s words and read back');
const blanks = E.lastLine({});
check(blanks.text === 'Paid: ___. Owing: ___. Refused by: ___.' && E.parseLastLine(blanks.text).owing === '___', 'empty blanks are three underscores');
const dirty = E.lastLine({ paid: 'a\tb\nc', owing: 'x', refused: 'y' });
check(!/[^\x20-\x7e]/.test(dirty.text) && dirty.paid === 'a b c', 'the last line is plain ASCII and single-spaced');

check(E.ENDING_IDS.every((id) => E.audit(E.ENDINGS[id].text).length === 0), 'every ending passes the invariant scan');
check(E.audit('The King is proven. The White Deeps are shown. A prophecy. A working heals.').length >= 4, 'the scan catches a proven King, a shown deep, a prophecy and a healing working');

r.forsworn = false;
const f = E.finish(r, { paid: 'a name', owing: 'nothing', refused: 'no one' });
check(f && f.ending === 'refusal' && f.returnToTitle === true && f.credits.length >= 3 && /Paid: a name/.test(f.lastLine) && r.finished, 'an ending finishes with the last line, the credits and the title');
check(E.finish(E.make(), {}) === null, 'an unfinished state cannot finish');
check(E.summary(r).ending === 'refusal' && E.summary(r).finished === true, 'the summary reports the ending');
const src = fs.readFileSync(path.join(ROOT, 'js', 'endings37.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src) && !/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'pure, plain ASCII, no clock');
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
