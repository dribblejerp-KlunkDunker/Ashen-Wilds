// node test/chart26.test.js --no-browser
// Phase 26: five chart nodes, shortest road, supplies, refusal and the day count.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const C = require(path.join(ROOT, 'js', 'chart26.js'));
let fails = 0;
const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };

check(C.NODES.join(' ') === 'ledge bell_road fen salt_trace wexhaven', 'the chart names all five nodes');
const r = C.shortest('wexhaven');
check(r.days === 6 && r.path.join('>') === 'ledge>bell_road>wexhaven' && r.food === 9 && r.fuel === 4, 'Wexhaven is six days by the bell road');
check(C.shortest('fen').path.join('>') === 'ledge>bell_road>fen' && C.shortest('fen').days === 3, 'the fen is three days');
const s = { day: 0, node: 'ledge', stores: { food: 9, fuel: 4 } };
check(C.canTravel(s.stores, 'wexhaven'), 'nine food and four fuel provision the six-day road');
const went = C.travel(s, 'wexhaven');
check(went && s.node === 'wexhaven' && s.day === 6 && s.stores.food === 0 && s.stores.fuel === 0, 'the road spends what it said');
check(!C.canTravel({ food: 8, fuel: 4 }, 'wexhaven') && C.travel({ stores: { food: 8, fuel: 4 } }, 'wexhaven') === null, 'a road the company cannot provision is refused');
check(C.dateOf(0).day === 1 && C.dateOf(0).month === 1 && C.dateOf(30).day === 1 && C.dateOf(30).month === 2, 'the day count turns at thirty days');
check(C.nodeKnown('wexhaven') && !C.nodeKnown('octave'), 'the chart knows no road off its table');
const src = fs.readFileSync(path.join(ROOT, 'js', 'chart26.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src) && !/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'pure, plain ASCII, no clock');
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
