// node test/deadcalm22.test.js --no-browser
// Phase 22: cinder x1.6 torch, .4 spore, .9 sight; Dead Calm 90 seconds, unskippable, x1.5 sound, +0.2 dread.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const D = require(path.join(ROOT, 'js', 'deadcalm22.js'));
let fails = 0;
const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };

check(D.effects('cinder').torch === 1.6 && D.effects('cinder').spore === 0.4 && D.effects('cinder').sight === 0.9, 'cinder squall: torch 1.6, spore 0.4, sight 0.9');
check(D.CALM.duration === 90 && D.effects('deadcalm').sound === 1.6 && D.effects('deadcalm').dread === 0.2, 'Dead Calm: 90 s proposed, sound 1.6 sourced, dread 0.2 proposed');
const c = D.make(); check(D.start(c, 'deadcalm') && c.left === 90, 'the calm starts at ninety seconds');
check(D.step(c, 30) === 30 && c.left === 60 && !c.ended, 'thirty seconds pass');
check(Math.abs(D.step(c, 59.9) - 59.9) < 1e-9 && c.left.toFixed(3) === '0.100' && !c.ended, 'the last tenth is not skipped');
check(Math.abs(D.step(c, 1) - 0.1) < 1e-9 && c.ended && c.left === 0, 'the calm ends only on its own last second');
check(D.skip() === false && !D.start(c, 'deadcalm'), 'the calm cannot be skipped or restarted');
const s = D.make(); D.start(s, 'cinder'); check(D.step(s, 12) === 12 && !s.ended, 'the squall is not a clock');
check(D.effects().torch === 1 && D.effects().sound === 1, 'clear weather gives no multiplier');
const src = fs.readFileSync(path.join(ROOT, 'js', 'deadcalm22.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src) && !/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'pure, plain ASCII, no clock');
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
