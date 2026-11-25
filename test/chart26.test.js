// node test/chart26.test.js --no-browser
// Phase 26: the chart on the atlas's legs (O18, LP5): the walk south, shortest road, supplies, refusal and the day count.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const C = require(path.join(ROOT, 'js', 'chart26.js'));
let fails = 0;
const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };

check(C.NODES.join(' ') === 'ledge coldbarrow watchhouse brackenreach southern_reach whitlow_grange wexhaven', 'the chart names the walk south\'s seven places');
const r = C.shortest('wexhaven');
check(r.days === 28 && r.miles === 315, 'Wexhaven is 315 miles and 28 days, as the atlas says (' + r.miles + ', ' + r.days + ')');
check(r.legs.join(' ') === 'Z1 Z2 Z3 C1 Z5 C2' && r.path[0] === 'ledge' && r.path[r.path.length - 1] === 'wexhaven', 'by the upper road, the Bell Road, the Causeway, the Salt Trace and the Downs');
check(r.food === 56 && r.fuel === 52, 'two travellers spend 56 food and 52 fuel (' + r.food + ', ' + r.fuel + ')');
const one = C.shortest('wexhaven', 1);
check(one.food === 28 && one.fuel === 26, 'one traveller spends half');
check(C.shortest('watchhouse').days === 9 && C.shortest('brackenreach').days === 14, 'the Watchhouse is nine days, Brackenreach fourteen');
const s = { day: 0, node: 'ledge', stores: { food: 56, fuel: 52 } };
check(C.canTravel(s.stores, 'wexhaven'), '56 food and 52 fuel provision the walk for two');
const went = C.travel(s, 'wexhaven');
check(went && s.node === 'wexhaven' && s.day === 28 && s.stores.food === 0 && s.stores.fuel === 0, 'the road spends what it said');
check(!C.canTravel({ food: 55, fuel: 52 }, 'wexhaven') && C.travel({ stores: { food: 55, fuel: 52 } }, 'wexhaven') === null, 'a road the company cannot provision is refused');
check(C.dateOf(0).day === 1 && C.dateOf(0).month === 1 && C.dateOf(30).day === 1 && C.dateOf(30).month === 2, 'the day count turns at thirty days');
check(C.nodeKnown('wexhaven') && !C.nodeKnown('octave') && C.shortest('octave').days === 0, 'the chart knows no road off its table');

// ---- the table is the atlas's: every leg's miles and days, and the Chart legs' food and fuel, are read back from the lore
const atlas = (f) => fs.readFileSync(path.join(ROOT, 'docs', 'worldbuilding', 'atlas', f), 'utf8');
const rows = (text, head) => { const i = text.indexOf(head); const out = []; for (const line of text.slice(i).split('\n').slice(2)) { if (!/^\|/.test(line)) break; out.push(line.split('|').slice(1, -1).map((c) => c.trim())); } return out; };
const walk = rows(atlas('1-scale-and-distances.md'), '| Leg | Miles | Days |');
const total = walk.find((w) => w[0] === 'Total');
check(total && +total[1] === 315 && +total[2] === 28, 'the atlas\'s walk south is 315 miles and 28 days');
const z = atlas('10-zones.md');
const seams = rows(z, '| From | To | Through | Atlas road | Days booked |');
const seamOf = (via) => seams.find((w) => w[2] === via);
const walked = C.ROADS.filter((x) => x.kind === 'walked');
check(walked.every((x) => { const w = seamOf(x.via); return w && +w[4] === x.days && new RegExp('\\b' + x.miles + ' miles').test(w[3]); }), 'each walked seam has the zone plan\'s miles and days');
const legs = rows(z, '| Leg | From | To | Miles | Days |');
const legOf = (id) => legs.find((w) => w[0] === id);
check(C.ROADS.filter((x) => x.kind === 'chart').every((x) => { const w = legOf(x.id); return w && +w[3].replace(/^about /, '') === x.miles && parseInt(w[4], 10) === x.days && +w[5] === x.food && parseInt(w[6], 10) === x.fuel; }), 'each Chart leg has the zone plan\'s miles, days, food and fuel');
check(walked.every((x) => x.food === x.days && x.fuel === x.days), 'a walked seam spends a ration and a fuel a traveller a day');
check(walk.filter((w) => w[0] !== 'Total').reduce((a, w) => a + +w[2], 0) === r.days, 'the legs add up to the atlas\'s days');

const src = fs.readFileSync(path.join(ROOT, 'js', 'chart26.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src) && !/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'pure, plain ASCII, no clock');
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
