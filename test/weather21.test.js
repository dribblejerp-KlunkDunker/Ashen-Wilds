// node test/weather21.test.js --no-browser
// Phase 21: the six skies and their exact sight, sound, spore, ground and torch figures.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const W = require(path.join(ROOT, 'js', 'weather21.js'));
let fails = 0;
const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };

check(Object.keys(W.STATES).length === 6, 'there are six skies');
check(W.sight('miasma') === 7 && W.sound('miasma') === 0.6 && W.spore('miasma') === 1.3, 'miasma: sight 7 m, sound 0.6, spore 1.3');
check(W.ground('hoarfrost') === 0.8 && W.spore('hoarfrost') === 0.9 && W.sound('hoarfrost') === 1.25, 'hoarfrost: ground 0.8, spore 0.9, sound 1.25');
check(W.torch('sleet') === 1.8 && W.ground('sleet') === 0.85 && W.spore('sleet') === 0.6, 'sleet: torch 1.8, ground 0.85, spore 0.6');
check(W.spore('cinder') === 0.4 && W.sound('cinder') === 0 && W.torch('cinder') === 1.6, 'cinder clears spores, drowns sound; torch 1.6 is proposed');
check(W.sound('deadcalm') === 1.6 && W.spore('deadcalm') === 1.6 && W.dread('deadcalm') === 0.2, 'Dead Calm carries sound 1.6, holds spores 1.6, dread 0.2 proposed');
check(W.forDay(0).name === 'ashfall' && W.forDay(2).name === 'miasma' && W.forDay(6).name === 'deadcalm', 'the day table keeps its order');
check(W.forDay(7).name === 'ashfall', 'the weather turns over after the seventh day');
check(W.state('nonsense').name === 'ashfall' && W.state().name === 'ashfall', 'the unknown sky is ashfall');
check(W.all().length === 7 && W.all().filter((x) => x === 'ashfall').length === 2, 'the cycle is seven days, two of ash');
const src = fs.readFileSync(path.join(ROOT, 'js', 'weather21.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src) && !/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'pure, plain ASCII, no clock');
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
