// ============================================================
//  sidearcs35 - Phase 35, Act II: the five side arcs.
//
//  Source: docs/worldbuilding/the-round-and-the-long-account.md, "Act II: the Round", side arcs:
//  the Skerries, the Weald, the Unpaid, the Limewalks and the two glasses.
//  Each arc is a landing or two. This file is the pure consequence engine: one outcome per arc,
//  a flag, a debt or an item, and no XP or level. The arc lines and the exact reward wording are
//  [PROPOSED] and wait for G35.0.
// ============================================================
'use strict';

const SIDEARCS35 = (() => {
  const ARCS = [
    { id: 'skerries', name: 'The Skerries', choices: ['buy_bond', 'refuse'], reward: 'oil_bond' },
    { id: 'weald', name: 'The Weald', choices: ['cut_swathe', 'refuse'], reward: 'swathe' },
    { id: 'unpaid', name: 'The Unpaid', choices: ['pay', 'refuse', 'show_receipts'], reward: 'claim' },
    { id: 'limewalks', name: 'The Limewalks', choices: ['strike', 'break_strike', 'negotiate'], reward: 'crews' },
    { id: 'glasses', name: 'The two glasses', choices: ['carry', 'refuse'], reward: 'glass' }
  ];

  // [PROPOSED] G35.0. The situations are the bible's; the lines are connective.
  const TX = {
    skerries: 'An oil-bond is for sale. Behind it is what the keep has cost.',
    buy_bond: 'You buy out one oil-bond. The keep\'s books are worse than the price.',
    refuse: 'You leave the oil-bond with its keepers.',
    weald: 'A steading asks for its Swathe cut before the Brand-wind. No fire is allowed.',
    cut_swathe: 'You cut the Swathe. The steading has a break and no flame.',
    unpaid: 'A king\'s ship demands the King\'s toll. It has a claim on the receipts.',
    pay: 'You pay the King\'s toll. The Unpaid note the receipt.',
    show_receipts: 'You show the receipts. The claim is read, and not settled.',
    limewalks: 'The dead-cart crews have stopped work. The quays are learning what the Greys were for.',
    strike: 'You stand with the crews. The dead-carts stay where they are.',
    break_strike: 'You break the strike. The carts move, and the Limewalks remember.',
    negotiate: 'You find an accord. The carts move and the crews keep a name.',
    glasses: 'Qesh\'s smoked glass must go to Marrah. The registers have never been compared.',
    carry: 'You carry the glass to Marrah. Half the disagreement is the instruments. The other half remains.',
    refuse: 'The glass stays at Qesh. The registers remain apart.'
  };

  const RULINGS = [
    { id: 'R35.1', question: 'The exact beats and lines for each of the five side arcs.', proposed: 'Use the bible situations and the TX lines.' },
    { id: 'R35.2', question: 'What buying the oil-bond costs and what the keep has lost.', proposed: 'The bond becomes an item and a debt; no silver figure is invented.' },
    { id: 'R35.3', question: 'How the no-fire rule of the Weald is enforced.', proposed: 'Any attempt to cut with fire is refused before it starts.' },
    { id: 'R35.4', question: 'The Unpaid\'s three answers and what each does to the claim.', proposed: 'Pay, refuse or show the receipts; each writes a different debt.' },
    { id: 'R35.5', question: 'What the Limewalks strike leaves behind.', proposed: 'Strike, break or negotiate; each writes a different consequence.' },
    { id: 'R35.6', question: 'What the two glasses prove and what stays unexplained.', proposed: 'The instruments explain half; the remainder is never explained.' },
    { id: 'R35.7', question: 'The rewards: flags, debts and items, never XP.', proposed: 'Each arc writes one flag and one debt or item; no level is granted.' }
  ];

  function make() {
    return { done: {}, flags: {}, debts: [], items: [], log: [] };
  }
  const arc = (id) => ARCS.find((a) => a.id === id) || null;

  function act(s, id, choice, o) {
    const a = arc(id);
    o = o || {};
    if (!s || !a || s.done[id] || !a.choices.includes(choice)) return null;
    if (id === 'weald' && o.fire) return null;
    s.done[id] = choice;
    if (id === 'skerries') {
      if (choice === 'buy_bond') { s.flags.oilBond = true; s.items.push('oil_bond'); s.debts.push('the Skerries keep'); }
      else s.flags.oilBond = false;
    } else if (id === 'weald') {
      if (choice === 'cut_swathe') { s.flags.swatheCut = true; s.debts.push('the steading Swathe'); }
      else s.flags.swatheCut = false;
    } else if (id === 'unpaid') {
      if (choice === 'pay') { s.flags.tollPaid = true; s.debts.push('the King\'s toll'); }
      if (choice === 'refuse') { s.flags.tollRefused = true; s.debts.push('the Unpaid claim'); }
      if (choice === 'show_receipts') { s.flags.receiptsShown = true; s.debts.push('the claim examined'); }
    } else if (id === 'limewalks') {
      if (choice === 'strike') { s.flags.crewsWin = true; s.debts.push('the dead-cart crews'); }
      if (choice === 'break_strike') { s.flags.strikeBroken = true; s.debts.push('the broken carts'); }
      if (choice === 'negotiate') { s.flags.accord = true; s.debts.push('the Limewalks accord'); }
    } else if (id === 'glasses') {
      if (choice === 'carry') { s.flags.instruments = true; s.flags.remainder = true; s.items.push('smoked_glass'); }
      else s.flags.instruments = false;
    }
    s.log.push({ arc: id, choice, line: TX[choice] || '' });
    return { arc: id, choice, line: TX[choice] || '', reward: rewardOf(id) };
  }

  function rewardOf(id) {
    const a = arc(id);
    if (!a) return null;
    return { flag: a.reward, debt: a.reward === 'oil_bond' ? 'the Skerries keep' : null, item: a.reward === 'oil_bond' ? 'oil_bond' : a.reward === 'glass' ? 'smoked_glass' : null };
  }
  const allDone = (s) => !!s && ARCS.every((a) => !!s.done[a.id]);
  const summary = (s) => s ? {
    done: Object.assign({}, s.done), flags: Object.assign({}, s.flags),
    debts: s.debts.slice(), items: s.items.slice(), allDone: allDone(s)
  } : null;

  return { ARCS, TX, RULINGS, make, act, rewardOf, allDone, summary };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SIDEARCS35;
