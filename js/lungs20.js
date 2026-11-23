// ============================================================
//  lungs20 - Phase 20, breath and the four stages.
//
//  Exposure only ever rises. A mask halves what a breath takes in; a fire clears the air entirely. At 25 the
//  cough starts, at 50 the crust, at 75 silence (no speech, no workings), and at 100 the bloom takes the
//  walker. There is no recovery, no clean-air reset and no field cure. Pure table and state; the browser wire
//  at the bottom reads bloom choke, clears the state once the death is handed to the engine, and clears it
//  again when a new character takes the card.
// ============================================================
'use strict';

const LUNGS20 = (() => {
  const STAGES = [
    { at: 0, name: 'clear' }, { at: 25, name: 'cough' }, { at: 50, name: 'crust' },
    { at: 75, name: 'silence' }, { at: 100, name: 'bloom' }
  ];
  const MASK = 0.5;
  const COUGH_EVERY = 20;   // F20.2's proposed interval; the lore says only that the cough comes

  function stageOf(exposure) {
    const x = Math.max(0, Math.min(100, +exposure || 0));
    let out = STAGES[0].name;
    for (const s of STAGES) if (x >= s.at) out = s.name;
    return out;
  }

  function make() { return { exposure: 0, stage: 'clear', coughIn: 0, dead: false }; }

  // A new card is a new pair of lungs. The first character starts with empty flags, but succession keeps them.
  function reset() {
    if (typeof G === 'undefined' || !G || !G.flags) return false;
    G.flags.la_lungs = make();
    return true;
  }

  // spore is the weather multiplier; fire replaces it with clean air for this breath.
  function breathe(s, o) {
    o = o || {};
    if (!s || s.dead || o.fire) return s;
    const dt = Math.max(0, +o.dt || 0), spore = Math.max(0, o.spore == null ? 1 : +o.spore);
    const mask = o.mask ? MASK : 1;
    s.exposure = Math.min(100, s.exposure + spore * mask * dt);
    s.stage = stageOf(s.exposure);
    if (s.stage === 'bloom') s.dead = true;
    return s;
  }

  function cough(s, dt) {
    if (!s || s.dead || (s.stage !== 'cough' && s.stage !== 'crust' && s.stage !== 'silence')) return false;
    s.coughIn += Math.max(0, +dt || 0);
    if (s.coughIn < COUGH_EVERY) return false;
    s.coughIn -= COUGH_EVERY;
    return true;
  }

  const canSpeak = (s) => !!s && !s.dead && s.stage !== 'silence' && s.stage !== 'bloom';
  const canWork = canSpeak;
  const staminaReturn = (s) => (!s || s.stage === 'clear' || s.stage === 'cough' ? 1 : s.stage === 'crust' ? 0.5 : 0);
  const maskMul = () => MASK;

  // A claw's spore choke is the only exposure source in the wired prologue. Two exposure a second is
  // [PROPOSED]; the weather's spore multiplier scales it. No clean air gives exposure back.
  const CHOKE_RATE = 2;
  function chokeTick(s, o) {
    o = o || {};
    if (!s || s.dead || !(+o.choke > 0)) return s;
    breathe(s, { dt: o.dt, spore: CHOKE_RATE * (o.spore == null ? 1 : +o.spore), mask: o.mask });
    return s;
  }

  // ---------------------------------------------------------------- the wire (browser only)
  const here = () => typeof G !== 'undefined' && G && G.map && G.map._la;
  const on = () => typeof GFX === 'undefined' || GFX.laLungs !== false;
  function state() {
    if (!G || !G.flags) return make();
    if (!G.flags.la_lungs || typeof G.flags.la_lungs !== 'object') G.flags.la_lungs = make();
    const s = G.flags.la_lungs;
    s.exposure = Math.max(0, Math.min(100, +s.exposure || 0));
    s.stage = stageOf(s.exposure);
    if (s.seen == null) s.seen = s.stage;
    return s;
  }
  const sporeNow = () => {
    try { if (typeof WEATHER21 !== 'undefined') return WEATHER21.forDay(G.day).spore; } catch (e) { /* ordinary air */ }
    return 1;
  };
  function tick(dt) {
    if (!here() || G.state !== 'play' || G.dead || !on()) return;
    const s = state();
    let choke = 0;
    try { const b = typeof BLOOM4 !== 'undefined' ? BLOOM4.state() : null; if (b && b.map === G.mapId) choke = Math.max(0, +b.choke || 0); } catch (e) { choke = 0; }
    if (choke > 0) chokeTick(s, { dt, choke, spore: sporeNow(), mask: !!(G.flags && G.flags.la_mask) });
    if (cough(s, dt)) {
      try { if (typeof addNoise === 'function') addNoise(1.5); } catch (e) { /* the cough is still heard in words */ }
      try { if (typeof msg === 'function') msg('The grey cough takes you. You cannot hold it in.', 'bad', 2600); } catch (e) { /* no message box */ }
    }
    if (s.stage !== s.seen) {
      s.seen = s.stage;
      const words = { cough: 'The cough has started. Your breath is no longer your own.', crust: 'The crust is forming. Rest buys you less.', silence: 'Your voice is gone. You can only sign now.', bloom: 'The bloom has you.' };
      try { if (typeof msg === 'function' && words[s.stage]) msg(words[s.stage], 'bad', 5000); } catch (e) { /* no message box */ }
    }
    if (s.dead && !G.dead) {
      try { G.player.hp = 0; die('ash-lung'); } catch (e) { /* the engine decides */ }
      // Once handed over, the state has done its work. This also covers partner19's softened fall, which
      // leaves G.dead false: without the clear, every later tick would down the host again after a revive.
      reset();
    }
  }
  function wire() {
    if (typeof window === 'undefined' || typeof G === 'undefined') return false;
    const L1 = typeof LEDGE1 !== 'undefined' ? LEDGE1 : null;
    try {
      if (L1 && Array.isArray(L1.SWITCHES) && !L1.SWITCHES.some((s) => s[0] === 'laLungs')) {
        L1.SWITCHES.push(['laLungs', 'Lungs', 'Spore exposure, the four stages, the grey bar and the cough. Off: no lungs and the old HUD']);
      }
    } catch (e) { /* the Options row is absent */ }
    // Both creation and succession put on a card; either path starts the new person clear. choose() calls its own
    // local applyBg, so it needs the same wrapper (the same split cards18 handles).
    try {
      if (typeof PANEL10 !== 'undefined' && PANEL10.applyBg) {
        const _ab = PANEL10.applyBg;
        PANEL10.applyBg = function () { const r = _ab.apply(this, arguments); try { reset(); } catch (e) { /* the card stands */ } return r; };
      }
      if (typeof PANEL10 !== 'undefined' && PANEL10.choose) {
        const _ch = PANEL10.choose;
        PANEL10.choose = function () { const r = _ch.apply(this, arguments); try { reset(); } catch (e) { /* the card stands */ } return r; };
      }
    } catch (e) { /* the card keeps its lungs */ }
    try {
      if (typeof needsRecovery === 'function') {
        const _nr = needsRecovery;
        needsRecovery = function () {
          const r = _nr.apply(this, arguments);
          try { if (here() && on()) return r * staminaReturn(state()); } catch (e) { /* the engine's rate */ }
          return r;
        };
      }
    } catch (e) { /* the engine's rate */ }
    try {
      const _up = update;
      update = function (dt) { const r = _up.apply(this, arguments); try { tick(dt); } catch (e) { /* the picture keeps running */ } return r; };
    } catch (e) { return false; }
    try {
      const _hud = drawHUD;
      drawHUD = function () {
        const r = _hud.apply(this, arguments);
        try {
          if (!here() || G.state !== 'play' || !on()) return r;
          const s = state(), ctx = Engine.ctx;
          if (s.exposure <= 0) return r;
          ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(44, 155, 3, 40);
          const hh = Math.round(40 * s.exposure / 100); ctx.fillStyle = '#9a9a96'; ctx.fillRect(44, 195 - hh, 3, hh);
          ctx.restore();
        } catch (e) { /* no bar is better than a broken frame */ }
        return r;
      };
    } catch (e) { /* the old HUD stands */ }
    return true;
  }

  return { STAGES, MASK, COUGH_EVERY, CHOKE_RATE, stageOf, make, reset, breathe, chokeTick, cough, canSpeak, canWork, staminaReturn, maskMul, state, wire };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = LUNGS20;
if (typeof window !== 'undefined') LUNGS20.wire();
