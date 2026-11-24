// ============================================================
//  actone33 - Phase 33, Act I: the Burned Quay.
//
//  Source: docs/worldbuilding/the-round-and-the-long-account.md, "Act I: the Burned Quay".
//  The bible gives the five scenes and their question, not the exact lines. Every line below that is
//  not quoted from the bible is [PROPOSED] and waits for G33.0. This file is a pure scene/choice
//  state machine: no map, model, art, save or engine wire. The route records the three choices the
//  act is built on: the reavers, the witness and the Forty.
// ============================================================
'use strict';

const ACTONE33 = (() => {
  const SCENES = ['commission', 'reavers', 'witness', 'crossing', 'forty'];
  const TITLES = {
    commission: 'The commission and the stove',
    reavers: 'Corvin Hale',
    witness: 'The barrels and the witness',
    crossing: 'The Dead Calm crossing',
    forty: 'The Forty'
  };
  const CHOICES = {
    commission: ['lift_stove', 'leave_stove'],
    reavers: ['fight', 'trade', 'follow'],
    witness: ['share', 'ration'],
    crossing: ['bury', 'keep', 'name'],
    forty: ['wait', 'buy_stove', 'buy_receipts', 'run_chain']
  };

  // [PROPOSED] G33.0. The commission line is the bible's; the other lines are connective.
  const TX = {
    commission: 'Gytha Marrin: Present them to whoever answers for the Crown. Bring back what is paid. If nothing is paid, bring back the name of who refused.',
    stove: 'The royal ship Constance lies in the inlet. Her slag-iron galley stove is under the tide.',
    lift_stove: 'The stove comes up at low water. It takes both of you, and the tide is already turning.',
    leave_stove: 'You leave the stove in the hull. The tide closes over it.',
    reavers: 'Corvin Hale is stripping the upper town. His crew has seen you.',
    fight: 'Corvin Hale\'s crew gives way. You have the upper town, and a debt in blood.',
    trade: 'Corvin Hale sells you a chart of the harbour chains. It is drawn in a careful hand.',
    follow: 'You follow the reavers out and say nothing. They leave the upper town to the ash.',
    witness: 'The first admissions argument: Marget is one more mouth, and she is sick.',
    share: 'Marget eats. The barrel of receipts is lighter by one day\'s bread.',
    ration: 'You keep the bread. Marget says nothing and puts her hands in her sleeves.',
    crossing: 'The first Dead Calm at sea. The pumps are still. If anyone aboard is dying, the Follower is a bump on the hull.',
    bury: 'The body goes over the side in the Dead Calm. You say no words the wind can carry away.',
    keep: 'You keep the body aboard. The weight is a promise the sea has not agreed to.',
    name: 'You write the name in the book and leave the body to the sea.',
    forty: 'Every northern hull must lie forty days at the Lazaret Rocks.',
    wait: 'Forty days at the Lazaret Rocks. The summer shortens by a third.',
    buy_stove: 'The stove plate buys a clean bill. The hull is lighter and the hold is colder.',
    buy_receipts: 'A hundred receipts buy a clean bill. Gytha\'s count falls.',
    run_chain: 'You run the chain at night. The Sable Shore will remember the hull.',
    follower: 'The Follower keeps pace with the hull. It is never shown.',
    exit: 'The Burned Quay lets you go. The Chart takes the next leg.'
  };

  const RULINGS = [
    { id: 'R33.1', question: 'The exact words for Gytha Marrin, Wat Hebble and Corvin Hale.', proposed: 'Use the bible\'s commission line and the connective lines in TX.' },
    { id: 'R33.2', question: 'What the harbour-chain chart contains and what it costs.', proposed: 'Trade with Corvin buys the chart and no food.' },
    { id: 'R33.3', question: 'What fighting the reavers costs.', proposed: 'One day of food and a blood debt; no combat result is claimed.' },
    { id: 'R33.4', question: 'The first admissions argument and whether Marget can be put ashore.', proposed: 'She stays aboard; the choice is share or ration.' },
    { id: 'R33.5', question: 'The Follower and the first body choice.', proposed: 'The Follower appears only if someone is dying; bury, keep or name the body.' },
    { id: 'R33.6', question: 'The price of a clean bill and what the Forty costs.', proposed: 'Wait forty days; one stove plate or one hundred receipts; or run the chain and be outlawed.' },
    { id: 'R33.7', question: 'The exact exit node, cargo and debts to the Chart.', proposed: 'Wexhaven unless the chain is run, then Port Sable; cargo and flags travel with the company.' }
  ];

  function make() {
    return {
      scene: 'commission', day: 0, stores: { food: 6, fuel: 2 },
      receipts: 11000, cargo: [], flags: {}, choices: {}, log: [],
      dying: false, done: false, exit: null
    };
  }

  function canChoose(s, choice) {
    if (!s || s.done || !CHOICES[s.scene] || !CHOICES[s.scene].includes(choice)) return false;
    if (choice === 'buy_stove') return s.cargo.includes('stove');
    if (choice === 'buy_receipts') return (+s.receipts || 0) >= 100;
    if (choice === 'share') return (+s.stores.food || 0) > 0;
    return true;
  }

  function takeCargo(s, id) { if (!s.cargo.includes(id)) s.cargo.push(id); }
  function dropCargo(s, id) { s.cargo = s.cargo.filter((c) => c !== id); }

  function apply(s, choice) {
    if (s.scene === 'commission') {
      s.flags.stove = choice === 'lift_stove';
      if (s.flags.stove) takeCargo(s, 'stove');
    } else if (s.scene === 'reavers') {
      s.flags.reavers = choice;
      if (choice === 'fight') { s.stores.food = Math.max(0, s.stores.food - 1); s.flags.reaverDebt = true; }
      if (choice === 'trade') { takeCargo(s, 'harbour_chart'); s.flags.harbourChart = true; }
      if (choice === 'follow') s.flags.followedReavers = true;
    } else if (s.scene === 'witness') {
      s.flags.witness = choice;
      if (choice === 'share') { s.stores.food = Math.max(0, s.stores.food - 1); s.flags.margetFed = true; }
      else s.flags.margetRationed = true;
    } else if (s.scene === 'crossing') {
      s.flags.body = choice;
      s.flags.follower = !!s.dying;
      if (choice === 'keep') takeCargo(s, 'body');
    } else if (s.scene === 'forty') {
      s.flags.forty = choice;
      if (choice === 'wait') { s.day += 40; s.flags.summerLost = true; }
      if (choice === 'buy_stove') { dropCargo(s, 'stove'); s.flags.cleanBill = 'stove'; }
      if (choice === 'buy_receipts') { s.receipts -= 100; s.flags.cleanBill = 'receipts'; }
      if (choice === 'run_chain') { s.flags.outlaw = true; }
    }
    return TX[choice] || '';
  }

  function finish(s) {
    s.scene = 'done';
    s.done = true;
    s.exit = {
      node: s.flags.outlaw ? 'port_sable' : 'wexhaven',
      cargo: s.cargo.slice(), receipts: s.receipts,
      flags: Object.assign({}, s.flags)
    };
    return s.exit;
  }

  function choose(s, choice) {
    if (!canChoose(s, choice)) return null;
    const scene = s.scene;
    const line = apply(s, choice);
    s.choices[scene] = choice;
    s.log.push({ scene, choice, line, day: s.day });
    const i = SCENES.indexOf(scene);
    if (i >= 0 && i + 1 < SCENES.length) s.scene = SCENES[i + 1];
    else finish(s);
    return { scene, choice, line, next: s.scene, exit: s.exit };
  }

  function summary(s) {
    if (!s) return null;
    return {
      scene: s.scene, done: !!s.done, choices: Object.assign({}, s.choices),
      flags: Object.assign({}, s.flags), cargo: s.cargo.slice(),
      receipts: s.receipts, day: s.day, exit: s.exit ? Object.assign({}, s.exit) : null
    };
  }

  return { SCENES, TITLES, CHOICES, TX, RULINGS, make, canChoose, choose, summary };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = ACTONE33;
