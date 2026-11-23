// ============================================================
//  weather21 - Phase 21, the six skies of the Smothering.
//
//  One table, read by sight, sound, spore and ground. Source for spore, ground, torch and sound multipliers:
//  bestiary.md, the six-weather table. Miasma sight 7 m; hoarfrost ground 0.8 and sound 1.25; sleet torch
//  1.8 and ground 0.85; Dead Calm sound 1.6 and spore 1.6. Values the table does not give are marked below.
// ============================================================
'use strict';

const WEATHER21 = (() => {
  const STATES = {
    // sound/touch/ground/spore are sourced where the bestiary gives them; sight and dread are [PROPOSED].
    ashfall:  { name: 'ashfall',  sight: 12, sound: 1.0, spore: 1.0, ground: 1.0, touch: 1.0, dread: 0 },
    miasma:   { name: 'miasma',   sight: 7,  sound: 0.6, spore: 1.3, ground: 1.0, touch: 1.0, dread: 0 },
    sleet:    { name: 'sleet',    sight: 9,  sound: 0.8, spore: 0.6, ground: 0.85, touch: 1.8, dread: 0 },
    hoarfrost:{ name: 'hoarfrost',sight: 12, sound: 1.25, spore: 0.9, ground: 0.8, touch: 1.0, dread: 0 },
    cinder:   { name: 'cinder',   sight: 10.8, sound: 0.0, spore: 0.4, ground: 1.0, touch: 1.6, dread: 0 },
    deadcalm: { name: 'deadcalm', sight: 12, sound: 1.6, spore: 1.6, ground: 1.0, touch: 1.0, dread: 0.2 }
  };
  const TABLE = ['ashfall', 'ashfall', 'miasma', 'sleet', 'hoarfrost', 'cinder', 'deadcalm'];

  const state = (id) => STATES[id] || STATES.ashfall;
  const forDay = (day) => state(TABLE[Math.max(0, Math.floor(+day || 0)) % TABLE.length]);
  const sight = (id) => state(id).sight;
  const sound = (id) => state(id).sound;
  const spore = (id) => state(id).spore;
  const ground = (id) => state(id).ground;
  const torch = (id) => state(id).touch;
  const dread = (id) => state(id).dread;
  const all = () => TABLE.slice();

  return { STATES, TABLE, state, forDay, sight, sound, spore, ground, torch, dread, all };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = WEATHER21;
