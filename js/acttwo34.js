// ============================================================
//  acttwo34 - Phase 34, Act II: the three courts.
//
//  Source: docs/worldbuilding/the-round-and-the-long-account.md, "Act II: the Round".
//  The bible gives the three offers, their costs and each court's hand on the White Deeps. The
//  receipt scene and the winter roofs are its own. The exact court lines, the receipt's hand and the
//  exclusivity of the answer below are [PROPOSED] and wait for G34.0. Pure content/state; no map,
//  court art, chart panel or ending is claimed here.
// ============================================================
'use strict';

const ACTTWO34 = (() => {
  const COURTS = [
    {
      id: 'exchange', name: 'The Exchange, Port Sable', who: 'Lucan Daw', hand: 'digging', handValue: 'company_shares',
      offer: 'Silver at a hundredth: enough grain for the fen parishes for one winter, delivered.',
      cost: 'The receipts become claims the buyers will press for land. The fen is fed, and sold.',
      deeps: 'Company shares are the best-performing paper on the floor.'
    },
    {
      id: 'saint_aumere', name: 'Saint-Aumere', who: 'Queen Ysabeau and Osbert, called the Fifth; Prior Lambert Strand', hand: 'levying', handValue: 'vauclere',
      offer: 'Osbert\'s seal on every receipt: payment in full, upon restoration. And a writ to carry north.',
      cost: 'Paper for paper. The writ reasserts the old assessments on the people who are owed.',
      deeps: 'Vauclere levies the hewers.',
      prior: 'Prior Lambert Strand keeps the Keeping in exile at the court.'
    },
    {
      id: 'garden', name: 'The Garden of Hours', who: 'The Guest', hand: 'blessing', handValue: 'sephar',
      offer: 'The Guest has nothing. He offers to write I owe this and sign it.',
      cost: 'It is worth nothing at the Exchange. It is the only thing Gytha asked for.',
      deeps: 'Sephar\'s priests have blessed the digging as the recovery of hidden day.'
    }
  ];
  const WINTER = [
    { id: 'limewalks', name: 'The Limewalks', obligation: 'The dead-cart crews and the Greys.', door: 'limewalks' },
    { id: 'saint_aumere', name: 'Saint-Aumere guest-house', obligation: 'The court\'s guest-place and its writ.', door: 'saint_aumere' },
    { id: 'halsing', name: 'Halsing bunkhouses', obligation: 'The Deeps Company and the cold.', door: 'halsing' }
  ];
  const CHART = {
    NODES: ['port_sable', 'saint_aumere', 'sephar', 'halsing'],
    ROADS: [
      { a: 'port_sable', b: 'saint_aumere', days: 3, food: 3, fuel: 1, sea: true },
      { a: 'port_sable', b: 'halsing', days: 5, food: 5, fuel: 3, sea: true },
      { a: 'saint_aumere', b: 'sephar', days: 4, food: 4, fuel: 2, sea: true },
      { a: 'saint_aumere', b: 'halsing', days: 2, food: 2, fuel: 1, sea: false },
      { a: 'sephar', b: 'halsing', days: 3, food: 3, fuel: 2, sea: false }
    ]
  };
  const RECEIPT_ANSWERS = ['gytha', 'marget', 'no_one'];

  // [PROPOSED] G34.0. The offers and costs are the bible's; the receipt question is the bible's.
  const TX = {
    exchange: 'Lucan Daw names his price. ' + COURTS[0].offer,
    saint: 'The court receives you. ' + COURTS[1].offer,
    garden: 'The Garden of Hours is quiet. ' + COURTS[2].offer,
    receipt: 'The receipt is the one from Merewick, with Still waiting. S.19. under it in charcoal. He asks whose hand that is.',
    gytha: 'You say it is Gytha Marrin\'s hand.',
    marget: 'You say it is Marget Sayle\'s hand.',
    no_one: 'You say you do not know.',
    identity: 'He does not say who he is. The game does not answer it.',
    winter: 'The company chooses a roof for the winter.'
  };

  const RULINGS = [
    { id: 'R34.1', question: 'The exact lines for Lucan Daw, Queen Ysabeau, Osbert, Prior Strand and the Guest.', proposed: 'Use the bible offers in COURTS and the connective lines in TX.' },
    { id: 'R34.2', question: 'Are the three offers exclusive?', proposed: 'All three may be visited and examined; only one answer may be taken.' },
    { id: 'R34.3', question: 'Whose hand wrote Still waiting. S.19. in charcoal?', proposed: 'The player may answer Gytha, Marget or no one, and the game never confirms it.' },
    { id: 'R34.4', question: 'Which court sets which hand on the Deeps?', proposed: 'The Exchange digs through company shares; Saint-Aumere sets Vauclere levying; the Garden sets Sephar blessing.' },
    { id: 'R34.5', question: 'What each winter roof obliges the company to.', proposed: 'The Limewalks, Saint-Aumere guest-house and Halsing bunkhouses each carry one obligation and one Act III door.' },
    { id: 'R34.6', question: 'The sea legs, supplies and weather fronts from Wexhaven to the courts.', proposed: 'Use the five roads in CHART; no weather front is resolved here.' },
    { id: 'R34.7', question: 'The receipt scene exact wording and whether the Guest must know the hand.', proposed: 'Keep the bible question and the unanswered identity; add no answer.' }
  ];

  function make() {
    return {
      visited: {}, offers: {}, answer: null, receipt: { shown: false, answer: null, identity: 'unknown' },
      winter: null, hands: { digging: null, levying: null, blessing: null },
      flags: {}, log: [], done: false
    };
  }
  const court = (id) => COURTS.find((c) => c.id === id) || null;
  const roof = (id) => WINTER.find((w) => w.id === id) || null;

  function visit(s, id) {
    const c = court(id);
    if (!s || !c || s.done) return null;
    s.visited[id] = true;
    s.hands[c.hand] = c.handValue;
    s.log.push({ what: 'visit', court: id });
    return { id: c.id, name: c.name, who: c.who, offer: c.offer, cost: c.cost, deeps: c.deeps, prior: c.prior || null, hand: c.hand };
  }

  function accept(s, id) {
    const c = court(id);
    if (!s || !c || s.done || !s.visited[id] || s.answer) return null;
    s.answer = id; s.offers[id] = 'accepted';
    s.flags.answer = id;
    if (id === 'exchange') { s.flags.receiptsSold = true; s.flags.grainNorth = true; s.flags.sold = true; s.receipts = 0; }
    if (id === 'saint_aumere') { s.flags.paperSeal = true; s.flags.writNorth = true; s.flags.paperForPaper = true; }
    if (id === 'garden') { s.flags.guestNote = true; s.flags.onlyThing = true; }
    s.log.push({ what: 'accept', court: id });
    return { id, offer: c.offer, cost: c.cost, flags: Object.assign({}, s.flags) };
  }

  function decline(s, id) {
    if (!s || !court(id) || !s.visited[id] || s.answer) return null;
    s.offers[id] = 'declined';
    s.log.push({ what: 'decline', court: id });
    return { id, declined: true };
  }

  function showReceipt(s, answer) {
    if (!s || !s.visited.garden || !RECEIPT_ANSWERS.includes(answer)) return null;
    s.receipt = { shown: true, answer, identity: 'unknown' };
    s.flags.receiptShown = true;
    s.flags.guestIdentity = 'unknown';
    s.log.push({ what: 'receipt', answer });
    return { line: TX.receipt, answer: TX[answer], identity: TX.identity, identityKnown: false };
  }

  function winter(s, id) {
    const w = roof(id);
    if (!s || !w || s.done || !COURTS.every((c) => s.visited[c.id]) || !s.receipt.shown) return null;
    s.winter = { id: w.id, name: w.name, obligation: w.obligation, door: w.door };
    s.flags.winter = w.id;
    s.log.push({ what: 'winter', roof: w.id });
    return Object.assign({}, s.winter);
  }

  function finish(s) {
    if (!s || s.done) return null;
    if (!COURTS.every((c) => s.visited[c.id]) || !s.receipt.shown || !s.winter) return null;
    s.done = true;
    s.log.push({ what: 'done' });
    return true;
  }

  const allVisited = (s) => !!s && COURTS.every((c) => !!s.visited[c.id]);
  const handsOnDeeps = (s) => (s ? Object.assign({}, s.hands) : { digging: null, levying: null, blessing: null });
  const summary = (s) => s ? {
    visited: Object.assign({}, s.visited), offers: Object.assign({}, s.offers), answer: s.answer,
    receipt: Object.assign({}, s.receipt), winter: s.winter ? Object.assign({}, s.winter) : null,
    hands: handsOnDeeps(s), flags: Object.assign({}, s.flags), done: !!s.done
  } : null;

  return { COURTS, WINTER, CHART, RECEIPT_ANSWERS, TX, RULINGS, make, visit, accept, decline, showReceipt, winter, finish, allVisited, handsOnDeeps, summary };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = ACTTWO34;
