// ============================================================
//  actthree36 - Phase 36, Act III: the eleven days.
//
//  Source: docs/worldbuilding/the-round-and-the-long-account.md, "Act III: the eleven days".
//  The bible gives the clock, Corrant's numbers, Brode's refusal, Marget's limit and the four wall
//  courses. The exact scene lines and the day actions below are [PROPOSED] and wait for G36.0.
//  Pure content/state: no Halsing map, Lodge art, model or ending resolution.
// ============================================================
'use strict';

const ACTTHREE36 = (() => {
  const DAYS = 11;
  const CORRANT_PEOPLE = 40000;
  const WALL_COURSES = ['refusal', 'hazard', 'drown', 'sell'];
  const ROOFS = ['limewalks', 'saint_aumere', 'halsing'];
  const DEFAULT_PEOPLE = ['you', 'marget', 'the carter'];
  const ACTIONS = {
    corrant_numbers: { once: true, line: 'corrant' },
    brode_refusal: { once: true, line: 'brode' },
    marget_lodge: { once: true, line: 'marget' },
    inspect_wall: { once: true, line: 'inspect' },
    prepare_gate: { once: true, line: 'gate' },
    prepare_pumps: { once: true, line: 'pumps' },
    pay_covenant: { once: true, line: 'covenant' },
    rest: { once: false, line: 'rest' }
  };

  // [PROPOSED] G36.0. Corrant's count and Marget's answer are the bible's.
  const TX = {
    corrant: 'Ines Corrant: Forty thousand people in the valley towns heat with wood, and the wood went to the terraces for rye. Last winter\'s dead are in my ledger by parish.',
    brode: 'Edith Brode: Unknown ground. Wrong air. The right of refusal. The charter recognises none of it.',
    marget: 'Marget Sayle: I will not make it a story. You have what I can give.',
    corrantAnswer: 'Then you have told us nothing.',
    inspect: 'The wall is close-fitted stone. The seam runs into it. The draught is warm.',
    gate: 'The gate is planned before the breach.',
    pumps: 'The pumps are marked for a Dead Calm night.',
    covenant: 'The dependants\' covenant is paid in advance.',
    rest: 'The company rests. The clock does not.',
    winter: 'The company enters Halsing by its winter roof.',
    done: 'The thaw comes. Fire-setting begins. The wall is not resolved here.'
  };

  const RULINGS = [
    { id: 'R36.1', question: 'The exact Halsing, Lodge and eleven-day scene lines for Corrant, Brode and Marget.', proposed: 'Use the bible facts and the TX lines; add no description of what Marget saw.' },
    { id: 'R36.2', question: 'What each person can do in one day, and whether a person may act twice.', proposed: 'Each named person acts once per day; one action per day per person.' },
    { id: 'R36.3', question: 'The eleven-day clock and the twelfth-day breach.', proposed: 'Eleven days, then the thaw and fire-setting; the wall opens only in an ending.' },
    { id: 'R36.4', question: 'How many people are in the company for the day budget.', proposed: 'The caller passes the roster; the default is you, Marget and the carter.' },
    { id: 'R36.5', question: 'Marget\'s exact short answer and the rule that no option adds to it.', proposed: 'One short line; askMore always returns null.' },
    { id: 'R36.6', question: 'The four wall courses and whether the decision can be changed.', proposed: 'Refusal, own hazard, drown, sell; one recorded choice, not resolved here.' },
    { id: 'R36.7', question: 'Which winter roof lets the company enter Halsing and what it obliges.', proposed: 'Limewalks, Saint-Aumere or Halsing; only the last sets the Halsing door.' }
  ];

  function make(people) {
    const roster = Array.isArray(people) && people.length ? people.slice(0, 10) : DEFAULT_PEOPLE.slice();
    return {
      day: 1, days: DAYS, people: roster, acted: {}, flags: {}, actions: [],
      marget: { heard: false, askedMore: false }, wall: null, roof: null,
      thaw: false, fireSetting: false, done: false
    };
  }
  const has = (s, person) => !!s && s.people.includes(person);
  const line = (key) => TX[key] || '';

  function act(s, person, action) {
    const a = ACTIONS[action];
    if (!s || !a || s.done || s.thaw || !has(s, person)) return null;
    const key = s.day + '|' + person;
    if (s.acted[key]) return null;
    if (a.once && s.flags[action]) return null;
    s.acted[key] = action;
    s.actions.push({ day: s.day, person, action });
    if (a.once) s.flags[action] = true;
    if (action === 'corrant_numbers') s.numbers = { people: CORRANT_PEOPLE };
    if (action === 'marget_lodge') { s.marget.heard = true; s.flags.margetHeard = true; }
    if (action === 'brode_refusal') s.flags.brodeHeard = true;
    if (action === 'inspect_wall') s.flags.inspected = true;
    if (action === 'prepare_gate') s.flags.gateBuilt = true;
    if (action === 'prepare_pumps') s.flags.pumpsPrepared = true;
    if (action === 'pay_covenant') s.flags.covenantPaid = true;
    return { day: s.day, person, action, line: line(a.line) };
  }

  function endDay(s) {
    if (!s || s.done || s.thaw) return null;
    if (s.day >= DAYS) {
      s.day = DAYS; s.thaw = true; s.fireSetting = true; s.done = true;
      return { day: s.day, thaw: true, fireSetting: true, done: true };
    }
    s.day += 1;
    return { day: s.day, thaw: false, fireSetting: false, done: false };
  }

  function askMore(s) {
    if (!s) return null;
    s.marget.askedMore = true;
    return null;
  }
  const margetLine = (s) => (s && s.marget.heard ? TX.marget : null);

  function setWall(s, course) {
    if (!s || s.wall || !WALL_COURSES.includes(course)) return null;
    s.wall = course;
    s.flags.wall = course;
    return { course, resolved: false };
  }

  function enter(s, roof) {
    if (!s || !ROOFS.includes(roof)) return null;
    s.roof = roof;
    s.flags.halsing = roof === 'halsing';
    s.flags.winterRoof = roof;
    return { roof, halsing: roof === 'halsing', line: roof === 'halsing' ? TX.winter : null };
  }

  const summary = (s) => s ? {
    day: s.day, days: s.days, done: !!s.done, thaw: !!s.thaw, fireSetting: !!s.fireSetting,
    wall: s.wall, resolved: false, margetHeard: !!s.marget.heard,
    flags: Object.assign({}, s.flags), actions: s.actions.map((a) => Object.assign({}, a))
  } : null;

  return { DAYS, CORRANT_PEOPLE, WALL_COURSES, ROOFS, DEFAULT_PEOPLE, ACTIONS, TX, RULINGS, make, act, endDay, askMore, margetLine, setWall, enter, summary };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = ACTTHREE36;
