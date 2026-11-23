// node test/combat23.test.js --no-browser
// Phase 23: the commitment clock, stamina at the start, wall clang 16 m, lodge 1.2 s, partner stagger 0.8 s.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const C = require(path.join(ROOT, 'js', 'combat23.js'));
let fails = 0;
const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };

const s = C.begin('cut', 20);
check(s && s.phase === 'windup' && s.left === 0.30 && s.stamina === 20, 'a cut buys windup with stamina already in hand');
C.step(s, 0.30); check(s.phase === 'active' && s.left === 0.15, 'windup turns into the active cut');
C.step(s, 0.15); check(s.phase === 'recovery' && s.left === 0.35, 'the active cut turns into recovery');
C.step(s, 0.35); check(s.phase === 'done' && Math.abs(C.total('cut') - 0.80) < 1e-9, 'recovery ends the cut at 0.80 s');
check(C.begin('heavy', 13) === null && C.begin('heavy', 14).cost === 14, 'stamina below the cost refuses the swing, and the cost is taken at the start');
const i = C.begin('thrust', 9); C.step(i, 0.10); C.interrupt(i);
check(i.phase === 'interrupted' && i.spent && C.step(i, 5) === 'interrupted', 'an interrupted swing is not refunded');
check(C.canFormation(1.7, 2) && !C.canFormation(1.69, 2) && C.canFormation(0.4, 1), 'two need 1.7 m of formation');
check(C.kindOf('overhead') === 'heavy' && C.kindOf('thrust') === 'thrust' && C.kindOf('slash') === 'cut', 'the wire classifies the three committed blows');
check(C.wallClang() === 16 && C.lodgeTime() === 1.2 && C.staggerTime() === 0.8, 'wall clang 16 m sourced; lodge 1.2 s and stagger 0.8 s are the proposed clock');
check(C.PROPOSED.KINDS && C.PROPOSED.LODGE && C.PROPOSED.STAGGER && /1\.7 m passage/.test(C.SOURCES.FORMATION) && /16 m/.test(C.SOURCES.WALL_CLANG), 'the source and the proposed figures are explicit');
const src = fs.readFileSync(path.join(ROOT, 'js', 'combat23.js'), 'utf8');
const gameSrc = fs.readFileSync(path.join(ROOT, 'js', 'game.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src) && !/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'pure, plain ASCII, no clock');
check(/function resolveAttack/.test(gameSrc) && /G\.attack\.pendingHit/.test(gameSrc) && /G\.attack\.deferHit && !w\.ranged/.test(gameSrc), 'the copied engine leaves the melee hit for the phase to resolve');
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
