// ============================================================
//  endings37 - Phase 37, the five endings and the last line.
//
//  Source: docs/worldbuilding/the-round-and-the-long-account.md, "The endings". The five outcomes,
//  their conditions, the last scene and the three blanks are the bible's. The exact ending prose,
//  the condition flags below and the credits are [PROPOSED] and wait for G37.0. Pure content/state:
//  no ending film, scene, map or credits screen is claimed here.
// ============================================================
'use strict';

const ENDINGS37 = (() => {
  const ENDING_IDS = ['refusal', 'hazard', 'drown', 'sell', 'home'];
  const ENDINGS = {
    refusal: {
      title: 'The refusal',
      text: 'The Lodge strikes. The valley winters cold, and the count is given. In spring the Company evicts the hewers\' families. The wall was not proven to matter. Next year there is another steward.'
    },
    hazard: {
      title: 'On their own hazard',
      text: 'The charter is amended. The dependants\' covenant is paid in advance. A gate is built before the breach. On the twelfth day the wall opens. The game ends on the lamps.'
    },
    drown: {
      title: 'Drown it',
      text: 'The pumps break on a Dead Calm night. The ore is under water for years. The hewers lose their wages and are blamed. The company is hunted in three realms and can never present the Account.'
    },
    sell: {
      title: 'Sell and sail',
      text: 'The receipts are sold at the Exchange before the thaw. Grain ships go north. The fen eats for one winter, and Daw and Sturry hold its land claims. The company was not at Halsing.'
    },
    home: {
      title: 'Go home',
      text: 'Only the voyage back. Whatever was paid goes north: a signature, a sealed paper, or nothing, with lime and seed rye bought on the way. Nothing is stopped.'
    }
  };

  const CREDITS = [
    'The Long Account',
    'Written and built in this repository, with AI assistance.',
    'One file a phase. The engine is the Shattered Octave, copied at the owner\'s direction.'
  ];

  const RULINGS = [
    { id: 'R37.1', question: 'The exact prose of all five endings.', proposed: 'Use the bible outcomes and the prose in ENDINGS; no ending saves the world.' },
    { id: 'R37.2', question: 'The exact conditions for refusal, hazard, drown, sell and home.', proposed: 'The flags in ending() and the default state in make().' },
    { id: 'R37.3', question: 'What the Company must have paid for the hazard ending.', proposed: 'Charter amended, covenant paid in advance and gate built.' },
    { id: 'R37.4', question: 'What the sell ending requires before the thaw.', proposed: 'The receipts sold at the Exchange; grain goes north and Daw and Sturry keep the claims.' },
    { id: 'R37.5', question: 'Whether home is the fallback when nothing else is fulfilled.', proposed: 'Home requires the voyage back; an incomplete state returns no ending.' },
    { id: 'R37.6', question: 'The three blanks\' labels and the player\'s input.', proposed: 'Paid, Owing and Refused by, in plain ASCII, blank as three underscores.' },
    { id: 'R37.7', question: 'The credits and the return to title.', proposed: 'The repository credits in CREDITS, then the title; no Octave credits.' },
    { id: 'R37.8', question: 'The invariant list for every ending.', proposed: 'No proven King, no shown White Deeps, no prophecy, no answer to the shut questions, no healing or feeding working.' }
  ];

  function make() {
    return {
      wall: null, margetHeard: false, forsworn: false, lodgeStrike: false,
      charterAmended: false, covenantPaid: false, gateBuilt: false,
      pumpsBroken: false, deadCalm: false, sold: false, grainNorth: false,
      voyageBack: false, ending: null, lastLine: null, finished: false
    };
  }

  function ending(s) {
    if (!s) return null;
    if (s.wall === 'refusal' && s.margetHeard && !s.forsworn && s.lodgeStrike) return 'refusal';
    if (s.wall === 'hazard' && s.charterAmended && s.covenantPaid && s.gateBuilt) return 'hazard';
    if (s.wall === 'drown' && s.pumpsBroken && s.deadCalm) return 'drown';
    if (s.sold && (s.wall === 'sell' || s.wall === null)) return 'sell';
    if (s.voyageBack && (s.wall === 'home' || s.wall === null)) return 'home';
    return null;
  }

  const clean = (v) => String(v == null ? '' : v).replace(/[^\x20-\x7e]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  const blank = (v) => clean(v) || '___';

  function lastLine(a) {
    a = a || {};
    const text = 'Paid: ' + blank(a.paid) + '. Owing: ' + blank(a.owing) + '. Refused by: ' + blank(a.refused) + '.';
    return { text, paid: blank(a.paid), owing: blank(a.owing), refused: blank(a.refused) };
  }

  function parseLastLine(text) {
    const m = /^Paid: (.*)\. Owing: (.*)\. Refused by: (.*)\.$/.exec(String(text || '').trim());
    return m ? { paid: m[1], owing: m[2], refused: m[3] } : null;
  }

  const BAD = [
    { re: /\bking\b[\s\S]*\b(proven|proves|proved)\b|\b(proven|proves|proved)\b[\s\S]*\bking\b/i, why: 'the King is proven' },
    { re: /\bwhite\s+deeps\b[\s\S]*\b(shown|seen|opened|under)\b/i, why: 'the White Deeps are shown' },
    { re: /\bprophec/i, why: 'a prophecy' },
    { re: /\bvaults?\b[\s\S]*\b(made|built|maker|who)\b/i, why: 'the Vaults are answered' },
    { re: /\bworking\b[\s\S]*\b(heal|heals|healed|feed|feeds|fed)\b/i, why: 'a working heals or feeds' }
  ];
  const audit = (text) => BAD.filter((b) => b.re.test(String(text || ''))).map((b) => b.why);

  function finish(s, a) {
    const id = ending(s);
    if (!id) return null;
    const last = lastLine(a);
    s.ending = id;
    s.lastLine = last.text;
    s.finished = true;
    return { ending: id, title: ENDINGS[id].title, text: ENDINGS[id].text, lastLine: last.text, credits: CREDITS.slice(), returnToTitle: true };
  }

  const summary = (s) => s ? {
    ending: ending(s), wall: s.wall, lastLine: s.lastLine, finished: !!s.finished,
    flags: { margetHeard: s.margetHeard, forsworn: s.forsworn, lodgeStrike: s.lodgeStrike, sold: s.sold, voyageBack: s.voyageBack }
  } : null;

  return { ENDING_IDS, ENDINGS, CREDITS, RULINGS, make, ending, lastLine, parseLastLine, audit, finish, summary };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = ENDINGS37;
