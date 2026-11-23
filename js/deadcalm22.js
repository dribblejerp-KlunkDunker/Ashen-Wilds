// ============================================================
//  deadcalm22 - Phase 22, the cinder squall and the Dead Calm.
//
//  The squall is weather with teeth: a torch burns 1.6 times as fast, the spore falls to 0.4, and sight is
//  nine tenths. The Dead Calm is ninety seconds that cannot be skipped; sound carries 1.6 (bestiary) and
//  dread takes 0.2 [PROPOSED]. Both are tracked here so the run and the weather table never disagree.
// ============================================================
'use strict';

const DEADCALM22 = (() => {
  const CINDER = { torch: 1.6, spore: 0.4, sight: 0.9 };
  const CALM = { duration: 90, sound: 1.6, dread: 0.2 };

  function make() { return { kind: null, left: 0, started: false, ended: false }; }

  function start(s, kind) {
    if (!s || s.started) return false;
    if (kind !== 'cinder' && kind !== 'deadcalm') return false;
    s.kind = kind; s.started = true; s.ended = false;
    s.left = kind === 'deadcalm' ? CALM.duration : 0;
    return true;
  }

  // Returns how much of this step was actually spent in the state. The calm may end; it may not be cut short.
  function step(s, dt) {
    if (!s || !s.started || s.ended) return 0;
    if (s.kind !== 'deadcalm') return Math.max(0, +dt || 0);
    const used = Math.min(s.left, Math.max(0, +dt || 0));
    s.left -= used;
    if (s.left <= 0) { s.left = 0; s.ended = true; }
    return used;
  }

  const skip = () => false;
  const torchBurn = (kind) => (kind === 'cinder' ? CINDER.torch : 1);
  const sporeMul = (kind) => (kind === 'cinder' ? CINDER.spore : 1);
  const sightMul = (kind) => (kind === 'cinder' ? CINDER.sight : 1);
  const soundMul = (kind) => (kind === 'deadcalm' ? CALM.sound : 1);
  const dreadAdd = (kind) => (kind === 'deadcalm' ? CALM.dread : 0);
  const effects = (kind) => ({ torch: torchBurn(kind), spore: sporeMul(kind), sight: sightMul(kind), sound: soundMul(kind), dread: dreadAdd(kind) });

  return { CINDER, CALM, make, start, step, skip, torchBurn, sporeMul, sightMul, soundMul, dreadAdd, effects };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = DEADCALM22;
