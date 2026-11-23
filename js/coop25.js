// ============================================================
//  coop25 - Phase 25, two walkers and one account.
//
//  Parity rules only; no net19 contract is changed here. The company is as loud as its loudest member, a
//  sighting is shared once, both bars show the worse walker, the lantern is one pool, and two swings need
//  the same 1.7 m formation as combat23. Pure state, no network code.
// ============================================================
'use strict';

const COOP25 = (() => {
  const FORMATION = 1.7;

  const loudest = (a, b) => Math.max(+a || 0, +b || 0);
  const sharedNoise = (list) => (Array.isArray(list) && list.length ? Math.max.apply(null, list.map((n) => +n || 0)) : 0);
  const mergeSeen = (a, b) => Array.from(new Set([].concat(a || [], b || [])));
  const witnesses = (a, b) => mergeSeen(a, b).sort();
  const sharedBar = (a, b) => Math.min(+a || 0, +b || 0);
  const sharedFuel = (a, b) => Math.min(+a || 0, +b || 0);
  const canBothSwing = (space) => (+space || 0) >= FORMATION;
  const partnerDread = (mine, theirs) => Math.max(+mine || 0, +theirs || 0);
  const parity = () => ({ noise: 'loudest', sight: 'union', bar: 'worse', fuel: 'one pool', formation: FORMATION });

  return { FORMATION, loudest, sharedNoise, mergeSeen, witnesses, sharedBar, sharedFuel, canBothSwing, partnerDread, parity };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = COOP25;
