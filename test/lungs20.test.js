// node test/lungs20.test.js --no-browser
// Phase 20: the four stages, exposure that never falls, the mask, fire, silence and death in bloom.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const L = require(path.join(ROOT, 'js', 'lungs20.js'));
let fails = 0;
const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };

check(L.stageOf(0) === 'clear' && L.stageOf(24.9) === 'clear' && L.stageOf(25) === 'cough' && L.stageOf(49.9) === 'cough', 'clear below 25, cough at 25');
check(L.stageOf(50) === 'crust' && L.stageOf(75) === 'silence' && L.stageOf(100) === 'bloom', 'crust 50, silence 75, bloom 100');
const s = L.make();
L.breathe(s, { spore: 1, dt: 10 });
check(s.exposure === 10 && s.stage === 'clear', 'one spore breath adds its dt');
L.breathe(s, { spore: 1, dt: 10, mask: true });
check(s.exposure === 15, 'the mask halves the next breath');
L.breathe(s, { spore: 1, dt: 10, mask: true });
L.breathe(s, { spore: 1, dt: 10, mask: true });
check(s.exposure === 25 && s.stage === 'cough', 'exposure crosses 25 into cough');
L.breathe(s, { spore: 4, dt: 10, fire: true });
check(s.exposure === 25, 'fire clears the air and gives nothing back');
s.exposure = 100;
L.breathe(s, { spore: 3, dt: 1, mask: true });
check(s.exposure === 100 && s.dead, 'the bloom stage takes the walker at 100');
const q = L.make(); q.exposure = 40; q.stage = L.stageOf(40);
check(L.cough(q, 10) === false && L.cough(q, 10) === true && L.COUGH_EVERY === 20, 'the cough comes every 20 seconds of exposure');
check(L.canSpeak({ stage: 'cough' }) && !L.canSpeak({ stage: 'silence' }) && !L.canSpeak({ stage: 'bloom', dead: true }), 'silence refuses speech and workings');
check(L.staminaReturn({ stage: 'clear' }) === 1 && L.staminaReturn({ stage: 'crust' }) === 0.5 && L.staminaReturn({ stage: 'silence' }) === 0, 'breath buys less rest as the crust thickens');
check(L.maskMul() === 0.5, 'the mask is exactly half');
const c = L.make(); L.chokeTick(c, { dt: 2, choke: 2, spore: 1.3 });
check(Math.abs(c.exposure - 5.2) < 1e-9, 'a two-second claw choke in miasma adds 5.2 exposure');
const cm = L.make(); L.chokeTick(cm, { dt: 2, choke: 2, spore: 1.3, mask: true });
check(Math.abs(cm.exposure - 2.6) < 1e-9, 'a mask halves the claw dose');
const src = fs.readFileSync(path.join(ROOT, 'js', 'lungs20.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src) && !/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'pure, plain ASCII, no clock');
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
