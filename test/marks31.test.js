// node test/marks31.test.js --no-browser
// Phase 31 against the lore's five marks, effects and catches.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const M = require(path.join(ROOT, 'js', 'marks31.js'));
let fails = 0; const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };
check(M.ROWS.length === 5 && M.ROWS.map((r) => r.name).join(', ') === 'Glim, Keen, Rime, Ember, Dull-voice', 'the five lore marks');
check(M.byId('glim').effect.includes('dim light') && M.byId('glim').catch.includes('lit whenever'), 'glim lights the blade and marks the bearer');
check(M.byId('keen').catch === 'the blade wears twice as fast' && M.byId('rime').catch.includes('breath'), 'keen and rime keep their catches');
check(M.byId('ember').effect.includes('sears a bleed shut') && M.byId('dull-voice').effect.includes('half as far'), 'ember and dull-voice keep their effects');
check(!M.ROWS.some((r) => 'damage' in r) && M.DURATION === 'one landing', 'no invented damage figures; a mark lasts one landing');
const b = {};
check(M.apply(b, 'keen', { warmth: 1 }) && b.mark === 'keen' && b.markLeft === M.DURATION, 'a warm hand sets one mark');
check(!M.apply(b, 'glim', { warmth: 0 }) && b.mark === 'keen', 'a cold hand cannot set a mark');
check(M.renew(b) === null && M.renew(b, { fire: true }) && b.mark === 'keen', 'renewal needs the hearth fire');
check(M.endLanding(b) === 'keen' && !M.oneMark(b), 'the landing ends the mark');
const src = fs.readFileSync(path.join(ROOT, 'js', 'marks31.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src) && !/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'pure, plain ASCII, no clock');
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed'); process.exit(fails ? 1 : 0);
