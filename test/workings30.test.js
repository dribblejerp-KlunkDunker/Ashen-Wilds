// node test/workings30.test.js --no-browser
// Phase 30 against the lore's eight workings, not an invented list.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const W = require(path.join(ROOT, 'js', 'workings30.js'));
let fails = 0; const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };
const names = W.ROWS.map((r) => r.name).join(', ');
check(W.ROWS.length === 8 && names === 'Cold light, Staunch, The stilling, Kindle, The ward, The naming, Wind-knot, The bound word', 'the eight lore workings, by name');
check(W.byId('cold_light').effect === 'a pale blue light in the hand, with no flame', 'cold light has no flame');
check(W.byId('staunch').effect === 'stops a wound bleeding' && /does not close/.test(W.byId('staunch').note), 'staunch stops a bleed and does not heal');
check(W.byId('stilling').effect.includes('shuts sound') && W.byId('kindle').note.includes('snapped board'), 'the stilling and kindle keep their lore');
check(W.byId('ward').effect.includes('beasts will not cross') && W.byId('naming').effect.includes('Unnamed'), 'the ward and the naming keep their limits');
check(W.byId('wind_knot').effect.includes('one breath of wind') && W.byId('bound_word').effect.includes('feel it break'), 'wind-knot and bound word are lore-exact');
check(!W.forbidden() && W.allSpoken(), 'none damages, heals, feeds or cures a lung; all are spoken');
check(W.speak('ward', { warmth: 1 }) && !W.speak('ward', { warmth: 0 }), 'every working needs warmth');
check(W.speak('naming', { warmth: 0.1 }), 'the naming costs warmth too, not salt');
check(W.speak('kindle', { silent: true }) === null && W.speak('kindle', { lungs: { stage: 'silence' } }) === null, 'silence refuses workings');
const src = fs.readFileSync(path.join(ROOT, 'js', 'workings30.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src) && !/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'pure, plain ASCII, no clock');
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed'); process.exit(fails ? 1 : 0);
