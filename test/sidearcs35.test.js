// node test/sidearcs35.test.js --no-browser
// Phase 35: five side arcs, their consequences, the no-fire rule and the unexplained remainder.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const S = require(path.join(ROOT, 'js', 'sidearcs35.js'));
let fails = 0;
const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };

check(S.ARCS.map((a) => a.id).join(' ') === 'skerries weald unpaid limewalks glasses' && S.ARCS.every((a) => a.name && a.choices.length >= 2), 'the five side arcs and their choices');
check(S.RULINGS.length === 7 && S.RULINGS.every((r) => /^R35\./.test(r.id) && r.proposed), 'the seven G35.0 rulings are listed with proposed defaults');
const s = S.make();
check(!S.act(s, 'skerries', 'cut_swathe') && !S.allDone(s), 'an arc refuses a choice that is not its own');

const bond = S.act(s, 'skerries', 'buy_bond');
check(bond && bond.line && s.flags.oilBond && s.items.includes('oil_bond') && s.debts.includes('the Skerries keep'), 'the oil-bond is bought and its cost is written down');
check(!S.act(s, 'skerries', 'refuse') && s.done.skerries === 'buy_bond', 'an arc is played once');

const w = S.make();
check(!S.act(w, 'weald', 'cut_swathe', { fire: true }) && !w.done.weald, 'the Weald refuses any cut with fire');
check(S.act(w, 'weald', 'cut_swathe', { fire: false }) && w.flags.swatheCut && w.debts.includes('the steading Swathe'), 'the Swathe can be cut without fire');

const u = S.make();
S.act(u, 'unpaid', 'pay'); S.act(u, 'unpaid', 'refuse'); S.act(u, 'unpaid', 'show_receipts');
check(u.done.unpaid === 'pay' && u.flags.tollPaid && !u.flags.tollRefused && !u.flags.receiptsShown, 'the Unpaid takes one answer, not three');
const u2 = S.make(); S.act(u2, 'unpaid', 'refuse');
check(u2.flags.tollRefused && u2.debts.includes('the Unpaid claim'), 'a refusal leaves the Unpaid claim');
const u3 = S.make(); S.act(u3, 'unpaid', 'show_receipts');
check(u3.flags.receiptsShown && u3.debts.includes('the claim examined'), 'showing the receipts has the claim read');

const l = S.make();
S.act(l, 'limewalks', 'strike');
check(l.flags.crewsWin && l.debts.includes('the dead-cart crews'), 'the Limewalks strike has its consequence');
const l2 = S.make(); S.act(l2, 'limewalks', 'break_strike');
check(l2.flags.strikeBroken && l2.debts.includes('the broken carts'), 'breaking the strike is written down');
const l3 = S.make(); S.act(l3, 'limewalks', 'negotiate');
check(l3.flags.accord && l3.debts.includes('the Limewalks accord'), 'an accord is another consequence');

const g = S.make();
const carried = S.act(g, 'glasses', 'carry');
check(carried && g.flags.instruments && g.flags.remainder && g.items.includes('smoked_glass'), 'the two glasses explain half and leave a remainder');
check(!('xp' in g) && !('xp' in g.flags) && !('xp' in S.summary(g)) && !('xp' in carried.reward), 'no XP or level is granted');
const g2 = S.make(); S.act(g2, 'glasses', 'refuse');
check(g2.flags.instruments === false && !g2.flags.remainder, 'refusing the glass leaves the registers apart');

const all = S.make();
S.act(all, 'skerries', 'refuse'); S.act(all, 'weald', 'refuse'); S.act(all, 'unpaid', 'refuse'); S.act(all, 'limewalks', 'negotiate'); S.act(all, 'glasses', 'carry');
check(S.allDone(all) && S.summary(all).allDone === true && S.summary(all).debts.length === 2, 'all five arcs close and the summary carries the consequences');
check(S.rewardOf('glasses').item === 'smoked_glass' && S.rewardOf('nope') === null, 'the reward is an item or flag, not a level');
const src = fs.readFileSync(path.join(ROOT, 'js', 'sidearcs35.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src) && !/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'pure, plain ASCII, no clock');
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
