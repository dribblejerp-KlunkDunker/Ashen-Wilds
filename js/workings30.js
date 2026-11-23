// ============================================================
//  workings30 - Phase 30, the eight workings.
//
//  Source: docs/worldbuilding/the-round-and-the-long-account.md, "Small magic" and
//  "Workings, by the trade that keeps them". The eight names and effects are the lore's, not invented.
//  All eight are spoken and heard, and all cost warmth. None deals ranged damage, heals a wound, feeds
//  the company or clears a lung. Silent lungs refuse speech and therefore workings.
// ============================================================
'use strict';

const WORKINGS30 = (() => {
  const ROWS = [
    { id: 'cold_light', name: 'Cold light', kept: 'Hewers', effect: 'a pale blue light in the hand, with no flame', note: 'made for bad air, where a lamp kills the crew' },
    { id: 'staunch', name: 'Staunch', kept: 'Fen healers', effect: 'stops a wound bleeding', note: 'it does not close the wound' },
    { id: 'stilling', name: 'The stilling', kept: 'Bell-tenders', effect: 'shuts sound inside a small space for a few breaths', note: 'a small space, not the world' },
    { id: 'kindle', name: 'Kindle', kept: "Sephar's register-priests", effect: 'lights tinder, wet or dry', note: 'it cracks like a snapped board' },
    { id: 'ward', name: 'The ward', kept: 'Hedge-priests', effect: 'a line spoken over salt across a doorway; beasts will not cross it for a while', note: 'people can cross it' },
    { id: 'naming', name: 'The naming', kept: 'The Keeping', effect: 'lays an Unnamed to rest', note: 'why a name works stays unsettled' },
    { id: 'wind_knot', name: 'Wind-knot', kept: 'Skerry boat-wives', effect: 'a knotted cord holds one breath of wind until it is untied', note: 'one breath, no more' },
    { id: 'bound_word', name: 'The bound word', kept: "The Tally's notaries", effect: 'seals a promise so both parties feel it break', note: 'the Tally licenses and taxes it' }
  ];
  const byId = (id) => ROWS.find((r) => r.id === id) || null;
  const allSpoken = () => ROWS.every((r) => r.spoken !== false);

  function speak(id, o) {
    o = o || {};
    const w = byId(id);
    if (!w || o.silent || (o.lungs && o.lungs.stage === 'silence')) return null;
    if (!(o.warmth > 0)) return null;                 // every working takes warmth
    return { id: w.id, name: w.name, cost: 'warmth', effect: w.effect, note: w.note, damage: 0, heal: false, feed: false, lung: false };
  }

  const forbidden = () => ROWS.some((r) => r.damage > 0 || r.heal || r.feed || r.lung);
  return { ROWS, byId, speak, forbidden, allSpoken };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = WORKINGS30;
