// node test/actone33.test.js --no-browser
// Phase 33: Act I's five scenes, its three choices, the Forty's four roads and the exit to the Chart.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const A = require(path.join(ROOT, 'js', 'actone33.js'));
let fails = 0;
const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };

check(A.SCENES.join(' ') === 'commission reavers witness crossing forty' && A.SCENES.every((s) => A.TITLES[s] && A.CHOICES[s].length >= 2), 'five scenes, each with its own choices');
check(A.RULINGS.length === 7 && A.RULINGS.every((r) => /^R33\./.test(r.id) && r.question && r.proposed), 'the seven G33.0 rulings are listed with proposed defaults');
check(A.make().scene === 'commission' && A.make().receipts === 11000 && A.make().stores.food === 6, 'a new company starts at the commission with the receipts and stores');

const s = A.make();
check(!A.choose(s, 'trade') && s.scene === 'commission', 'a choice from another scene changes nothing');
check(A.choose(s, 'lift_stove').next === 'reavers' && s.flags.stove && s.cargo.includes('stove'), 'the stove can be lifted');
check(A.choose(s, 'trade').next === 'witness' && s.flags.harbourChart && s.cargo.includes('harbour_chart'), 'trading with the reavers buys the harbour chart');
check(A.choose(s, 'share').next === 'crossing' && s.flags.margetFed && s.stores.food === 5, 'sharing with Marget costs a day of food');
check(A.choose(s, 'bury').next === 'forty' && s.flags.body === 'bury', 'the first body can be buried at sea');
const end = A.choose(s, 'buy_stove');
check(end && end.exit && s.done && s.scene === 'done' && s.exit.node === 'wexhaven' && !s.cargo.includes('stove') && s.receipts === 11000, 'the stove plate buys a clean bill and the company exits to Wexhaven');

const b = A.make();
A.choose(b, 'leave_stove'); A.choose(b, 'fight'); A.choose(b, 'ration'); A.choose(b, 'keep');
check(b.stores.food === 5 && b.flags.reaverDebt && b.flags.margetRationed && b.cargo.includes('body'), 'fighting, rationing and keeping the body leave their flags');
A.choose(b, 'buy_receipts');
check(b.done && b.receipts === 10900 && b.flags.cleanBill === 'receipts' && b.exit && b.exit.node === 'wexhaven', 'receipts can buy the clean bill');

const c = A.make();
A.choose(c, 'lift_stove'); A.choose(c, 'follow'); A.choose(c, 'share'); A.choose(c, 'name'); A.choose(c, 'run_chain');
check(c.done && c.flags.outlaw && c.exit.node === 'port_sable' && c.flags.followedReavers && c.flags.body === 'name', 'running the chain exits as an outlaw to Port Sable');

const d = A.make();
A.choose(d, 'leave_stove'); A.choose(d, 'trade'); A.choose(d, 'share'); A.choose(d, 'bury');
check(!A.canChoose(d, 'buy_stove') && A.choose(d, 'buy_stove') === null && d.scene === 'forty' && !d.done, 'a clean bill cannot be bought with a stove that was left in the hull');
d.receipts = 99;
check(!A.canChoose(d, 'buy_receipts') && A.choose(d, 'buy_receipts') === null, 'a clean bill cannot be bought with a hundred receipts that are not there');

const e = A.make();
e.stores.food = 0;
A.choose(e, 'lift_stove'); A.choose(e, 'trade');
check(!A.canChoose(e, 'share') && !A.choose(e, 'share') && e.scene === 'witness', 'an empty store cannot feed the witness');

const f = A.make();
f.dying = true;
A.choose(f, 'lift_stove'); A.choose(f, 'trade'); A.choose(f, 'share'); A.choose(f, 'bury');
check(f.flags.follower === true, 'the Follower is marked when someone aboard is dying, and never shown');

const sum = A.summary(s);
check(sum && sum.done && sum.exit.node === 'wexhaven' && sum.choices.forty === 'buy_stove' && sum.log === undefined, 'the summary carries the route, flags and exit without the log');
const src = fs.readFileSync(path.join(ROOT, 'js', 'actone33.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src) && !/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'pure, plain ASCII, no clock');
const texts = Object.values(A.TX);
check(texts.every((t) => !/[^\x09\x0a\x0d\x20-\x7e]/.test(t)) && /Gytha Marrin: Present them/.test(A.TX.commission), 'the lines are ASCII and the commission is the bible\'s');
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
