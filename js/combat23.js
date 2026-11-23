// ============================================================
//  combat23 - Phase 23, commitment.
//
//  A swing is a clock, not a button: windup, active, recovery. Stamina is taken at the start and is not
//  refunded when the swing is interrupted. Two people need 1.7 m of formation to swing together. A lodge is
//  1.2 s and a partner's stagger is 0.8 s; a blade into stone is the 16 m clang.
// ============================================================
'use strict';

const COMBAT23 = (() => {
  // The lore gives the shape (startup, active, recovery, stamina) and the 1.7 m passage, but no seconds
  // or stamina costs. Every timing below is [PROPOSED]; the wall clang is the hearing table's 16 m.
  const KINDS = {
    cut:    { windup: 0.30, active: 0.15, recovery: 0.35, stamina: 8,  proposed: true },
    thrust: { windup: 0.20, active: 0.12, recovery: 0.40, stamina: 6,  proposed: true },
    heavy:  { windup: 0.55, active: 0.20, recovery: 0.60, stamina: 14, proposed: true }
  };
  const FORMATION = 1.7, WALL_CLANG = 16;
  const PROPOSED = { KINDS: true, LODGE: true, STAGGER: true };
  const SOURCES = { FORMATION: '1.7 m passage, the-round-and-the-long-account.md', WALL_CLANG: 'hearing table, 16 m', LODGE: 'shape only; seconds [PROPOSED]', STAGGER: 'stagger only; seconds [PROPOSED]' };
  const LODGE = 1.2, STAGGER = 0.8;

  function begin(kind, stamina) {
    const k = KINDS[kind] || KINDS.cut;
    if (!(stamina >= k.stamina)) return null;
    return { kind: KINDS[kind] ? kind : 'cut', phase: 'windup', left: k.windup, stamina, cost: k.stamina, spent: true, interrupted: false };
  }

  function step(s, dt) {
    if (!s || s.interrupted) return s && s.phase;
    let left = Math.max(0, +dt || 0);
    while (left > 0 && s.phase !== 'done') {
      const use = Math.min(s.left, left);
      s.left -= use; left -= use;
      if (s.left > 0) break;
      const k = KINDS[s.kind];
      if (s.phase === 'windup') { s.phase = 'active'; s.left = k.active; }
      else if (s.phase === 'active') { s.phase = 'recovery'; s.left = k.recovery; }
      else { s.phase = 'done'; s.left = 0; }
    }
    return s.phase;
  }

  function interrupt(s) {
    if (!s || s.phase === 'done') return false;
    s.interrupted = true; s.phase = 'interrupted'; s.left = 0;
    return true;
  }

  const canFormation = (space, people) => people < 2 || (+space || 0) >= FORMATION;
  const wallClang = () => WALL_CLANG;
  const lodgeTime = () => LODGE;
  const staggerTime = () => STAGGER;
  const total = (kind) => { const k = KINDS[kind] || KINDS.cut; return k.windup + k.active + k.recovery; };
  const kindOf = (label) => /heavy|overhead|chop/i.test(String(label || '')) ? 'heavy' : /thrust|stab|point/i.test(String(label || '')) ? 'thrust' : 'cut';

  // ---------------------------------------------------------------- the wire (browser only)
  const here = () => typeof G !== 'undefined' && G && G.map && G.map._la;
  function wire() {
    if (typeof window === 'undefined' || typeof attack !== 'function' || typeof update !== 'function') return false;
    const _at = attack;
    // The engine's hit waits on G.attack.pendingHit for a melee swing. Call it exactly once, when the
    // clock first reaches active; a step that crosses the whole window still lands at that boundary.
    function resolvePending() {
      const hit = G && G.attack && G.attack.pendingHit;
      if (typeof hit !== 'function') return;
      G.attack.pendingHit = null;
      try { hit(); } catch (e) { /* the blow is lost */ }
    }
    function advance(c, dt) {
      let left = Math.max(0, +dt || 0);
      while (left > 0 && c.phase !== 'done' && c.phase !== 'interrupted') {
        const was = c.phase, use = Math.min(c.left > 0 ? c.left : left, left);
        step(c, use); left -= use;
        if (was === 'windup' && c.phase === 'active') resolvePending();
      }
      if ((c.phase === 'done' || c.phase === 'interrupted') && G.attack) G.attack.pendingHit = null;
    }
    attack = function (label) {
      if (!here() || !G.player || G.state !== 'play') return _at.apply(this, arguments);
      try {
        const p = G.player, c = G.flags && G.flags.la_combat;
        if (c && c.phase && c.phase !== 'done' && c.phase !== 'interrupted') { msg('You are still committed to the last blow.', '', 1100); return; }
        if (G.attack.t > 0 || G.song.t > 0) return _at.apply(this, arguments);
        const kind = kindOf(label), st = begin(kind, p.fat);
        if (!st) { msg('You have no breath for that blow.', 'bad', 1400); return; }
        const beforeT = +G.attack.t || 0, beforeFat = p.fat;
        let r;
        if (G.attack) G.attack.deferHit = true;
        try { r = _at.apply(this, arguments); } finally { if (G.attack) G.attack.deferHit = false; }
        // A card or the engine can refuse without swinging (Sworn hands, a ranged kit, full hands). The
        // engine marks a real swing by raising attack.t; only then is the committed cost and clock due.
        if (!(+G.attack.t > beforeT)) return r;
        // The inner path may be the engine (one fatigue) or sync19's co-op swing (none). Charge the rest
        // of the committed cost from what it actually spent, not from an assumed one.
        const spent = Math.max(0, beforeFat - p.fat);
        p.fat = Math.max(0, p.fat - Math.max(0, st.cost - spent));
        if (G.flags) G.flags.la_combat = st;
        G.attack.t = Math.max(G.attack.t, total(kind)); G.attack.dur = G.attack.t;
        return r;
      } catch (e) { return _at.apply(this, arguments); }
    };
    const _up = update;
    update = function (dt) {
      const r = _up.apply(this, arguments);
      try { const c = G && G.flags && G.flags.la_combat; if (c && c.phase !== 'done' && c.phase !== 'interrupted') advance(c, dt); } catch (e) { /* the clock keeps its last phase */ }
      return r;
    };
    return true;
  }

  return { KINDS, FORMATION, LODGE, STAGGER, WALL_CLANG, PROPOSED, SOURCES, begin, step, interrupt, canFormation, wallClang, lodgeTime, staggerTime, total, kindOf, wire };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = COMBAT23;
if (typeof window !== 'undefined') COMBAT23.wire();
