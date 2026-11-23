// node test/hearth27.test.js --no-browser
// Phase 27: hearth rest, the store, names for the dead and promises. No food is created and no lung mends.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const H = require(path.join(ROOT, 'js', 'hearth27.js'));
let fails = 0;
const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };

const s = H.make();
check(H.rest(s, 3) === 3 && s.day === 3, 'three days at the hearth');
const p = { name: 'Marget', tired: 5, wounds: 2, frost: 2, lungs: 60 };
H.mend(p, 6);
check(p.tired === 0 && p.wounds === 0 && p.frost === 0 && p.lungs === 60, 'wounds and frost mend; the lung does not');
check(H.join(s, 'Marget') && !H.join(s, 'Marget'), 'a name joins once');
check(H.store(s, { food: 4, fuel: 2 }).food === 4, 'the store takes what is carried in');
const row = H.nameDead(s, 'Marget', 'the bloom');
check(row && row.day === 3 && row.cause === 'the bloom' && H.names(s).length === 0 && H.deadNames(s)[0] === 'Marget', 'the dead are named and leave the roster');
check(!H.join(s, 'Marget'), 'the dead do not rejoin');
const pr = H.promise(s, 'I will bring the salt back', 'Carter');
check(pr && pr.day === 3 && s.promises.length === 1, 'a promise keeps its day and person');
check(H.mend({ name: 'x', dead: true, tired: 9 }, 9).tired === 9, 'the hearth does not mend the dead');
const src = fs.readFileSync(path.join(ROOT, 'js', 'hearth27.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src) && !/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'pure, plain ASCII, no clock');
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
