// node test/acttwo34.test.js --no-browser
// Phase 34: the three courts, the one answer, the Merewick receipt, three hands on the Deeps and wintering.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const A = require(path.join(ROOT, 'js', 'acttwo34.js'));
let fails = 0;
const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };
const all = (s) => { A.COURTS.forEach((c) => A.visit(s, c.id)); };
const receipt = (s, a) => { all(s); return A.showReceipt(s, a || 'no_one'); };

check(A.COURTS.map((c) => c.id).join(' ') === 'exchange saint_aumere garden' && A.COURTS.every((c) => c.name && c.who && c.offer && c.cost && c.hand), 'the three courts, each with its offer and hand');
check(A.WINTER.length === 3 && A.WINTER.every((w) => w.obligation && w.door) && A.RULINGS.length === 7, 'three winter roofs and the seven G34.0 rulings');
check(A.make().hands.digging === null && A.make().receipt.identity === 'unknown' && A.make().done === false, 'a new company starts with no answer, no receipt and no roof');

const s = A.make();
check(!A.accept(s, 'exchange') && !A.showReceipt(s, 'no_one') && !A.winter(s, 'halsing'), 'nothing can be accepted, shown or wintered before the visits');
const g = A.visit(s, 'garden'), q = A.visit(s, 'saint_aumere'), x = A.visit(s, 'exchange');
check(g && q && x && A.allVisited(s), 'the courts can be visited in any order');
check(A.handsOnDeeps(s).digging === 'company_shares' && A.handsOnDeeps(s).levying === 'vauclere' && A.handsOnDeeps(s).blessing === 'sephar', 'three visits set the three hands on the Deeps');
check(A.accept(s, 'exchange') && s.answer === 'exchange' && s.flags.sold && s.flags.grainNorth && s.receipts === 0, 'the Exchange buys the receipts and feeds the fen');
check(!A.accept(s, 'saint_aumere') && s.answer === 'exchange', 'only one court answers for the Crown');
check(A.decline(s, 'saint_aumere') === null && s.answer === 'exchange', 'a declined court cannot be answered after the choice');

const t = A.make(); all(t); A.accept(t, 'saint_aumere');
check(t.flags.paperSeal && t.flags.writNorth && !t.flags.receiptsSold, 'Saint-Aumere seals the receipts in paper and gives the writ north');
const u = A.make(); all(u); A.accept(u, 'garden');
check(u.flags.guestNote && u.flags.onlyThing && !u.flags.paperSeal, 'the Garden gives the only thing Gytha asked for');
const v = A.make(); all(v);
check(A.accept(v, 'garden') && A.accept(v, 'exchange') === null, 'one accepted offer excludes another');

const r = A.make(); all(r);
const scene = A.showReceipt(r, 'marget');
check(scene && r.receipt.shown && r.receipt.answer === 'marget' && r.receipt.identity === 'unknown' && r.flags.receiptShown, 'the Merewick receipt can be shown and a hand named');
check(/Still waiting\. S\.19\./.test(scene.line) && /Marget Sayle's hand/.test(scene.answer) && /does not answer it/.test(scene.identity), 'the receipt keeps the charcoal line and leaves the Guest unidentified');
check(!A.showReceipt(r, 'aldric') && r.receipt.answer === 'marget', 'the receipt cannot be answered with a name the game never gives');
const r2 = A.make(); receipt(r2, 'gytha');
check(r2.receipt.identity === 'unknown' && r2.receipt.answer === 'gytha', 'Gytha is an allowed answer and the identity still stays unknown');

const w = A.make(); all(w); A.showReceipt(w, 'no_one');
check(!A.finish(w), 'the act cannot end before a winter roof is chosen');
for (const roof of A.WINTER) {
  const z = A.make(); all(z); A.showReceipt(z, 'no_one');
  check(A.winter(z, roof.id) && z.winter.id === roof.id && z.winter.obligation && A.finish(z) && z.done, 'the roof ' + roof.id + ' carries its obligation and ends the act');
}
const n = A.make(); all(n); A.showReceipt(n, 'no_one'); A.winter(n, 'limewalks'); A.finish(n);
check(n.answer === null && n.done, 'the company may reach winter without accepting any court');

check(A.CHART.NODES.join(' ') === 'port_sable saint_aumere sephar halsing' && A.CHART.ROADS.length === 5 && A.CHART.ROADS.some((r) => r.sea) && A.CHART.ROADS.every((r) => r.days > 0 && r.food > 0 && r.fuel >= 0), 'the Chart grows by four nodes, five roads and sea legs');
const src = fs.readFileSync(path.join(ROOT, 'js', 'acttwo34.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src) && !/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'pure, plain ASCII, no clock');
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
