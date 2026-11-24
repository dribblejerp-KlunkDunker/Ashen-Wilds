// ============================================================
//  chill29 - Phase 29, the chill: warmth in play.
//
//  Source: docs/worldbuilding/the-round-and-the-long-account.md, "Small magic" and "Workings and
//  marks in play": every working takes warmth from the one who speaks it, which the fen calls the
//  chill; marks are renewed at the hearth fire. The lore gives the cost and the fire, not a rate.
//  Every rate, threshold, stage word and bar position below was accepted by the owner on 2026-11-23.
//
//  One feature: a per-player warmth pool, 0..100, lost to the visible cold and restored at the
//  bothy's lit hearth. It does not add a working, a mark, a fire-lighting verb, NPC warmth or a
//  network field. The workings and marks stay pure; this file exposes no working API.
// ============================================================
'use strict';

const CHILL29 = (() => {
  const MIN = 0, MAX = 100;
  // The cold is the visible WEATHER6 sleet plus the night; shelter holds, the lit hearth warms.
  // The lore has no figures for any of these; the accepted values are the owner's, 2026-11-23.
  const ASH_RATE = -0.08;       // per second, outdoors, ashfall, day
  const SLEET_RATE = -0.30;     // per second, outdoors, full sleet
  const NIGHT_RATE = -0.12;     // per second, additional, outdoors, night
  const FIRE_RATE = 1.00;       // per second, within FIRE_RADIUS of a lit hearth
  const FIRE_RADIUS = 2.5;      // metres (cells)
  const WARM_AT = 50, CHILLED_AT = 25;   // accepted stage thresholds

  // The stage is a reading of the pool, not a second saved value. These are the words it says
  // when the reading changes.
  const STAGE_WORDS = {
    warm: 'The cold lets go of your hands.',
    chilled: 'The cold gets into your hands.',
    freezing: 'You are shaking. Get to a fire.',
    'the chill': 'The chill has you. You cannot run.'
  };

  const clamp = (n, a, b) => (n < a ? a : n > b ? b : n);

  function stageOf(w) {
    const x = clamp(+w || 0, MIN, MAX);
    if (x >= WARM_AT) return 'warm';
    if (x >= CHILLED_AT) return 'chilled';
    if (x > 0) return 'freezing';
    return 'the chill';
  }

  function make() { return { warmth: MAX }; }

  // One pure step. `o`: dt seconds; outdoor; sleet 0..1; night; fire. The pool holds indoors.
  function step(s, o) {
    o = o || {};
    if (!s) return s;
    const dt = Math.max(0, +o.dt || 0);
    let rate = 0;
    if (o.fire) rate = FIRE_RATE;
    else if (o.outdoor) {
      const sleet = clamp(+o.sleet || 0, 0, 1);
      rate = ASH_RATE + (SLEET_RATE - ASH_RATE) * sleet;
      if (o.night) rate += NIGHT_RATE;
    }
    s.warmth = clamp((+s.warmth || 0) + rate * dt, MIN, MAX);
    return s;
  }

  // The engine's stamina return, at each stage. At zero the wire also holds the engine's fatigue
  // at zero, which stops a run and an attack without editing the engine.
  function staminaReturn(s) {
    const st = stageOf(s && s.warmth);
    return st === 'warm' ? 1 : st === 'chilled' ? 0.75 : st === 'freezing' ? 0.5 : 0;
  }

  // A fire is a deco, not a lamp: the bothy's la_hearth or a campfire, lit (glow >= 0.5).
  function nearFire(entities, x, y, radius) {
    const r = radius == null ? FIRE_RADIUS : Math.max(0, +radius || 0);
    if (!Array.isArray(entities)) return false;
    for (const e of entities) {
      if (!e || e.hidden || e.dead || e.kind !== 'deco') continue;
      if (e.sprite !== 'la_hearth' && e.sprite !== 'campfire') continue;
      if (!(+e.glow >= 0.5)) continue;
      if (Math.hypot((+e.x || 0) - (+x || 0), (+e.y || 0) - (+y || 0)) <= r) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- the wire (browser only)
  let wired = false;
  const here = () => typeof G !== 'undefined' && G && G.map && G.map._la;
  const on = () => typeof GFX === 'undefined' || GFX.laChill !== false;
  function state() {
    if (typeof G === 'undefined' || !G || !G.flags) return make();
    if (!G.flags.la_chill || typeof G.flags.la_chill !== 'object') G.flags.la_chill = make();
    const s = G.flags.la_chill;
    s.warmth = clamp(+s.warmth || 0, MIN, MAX);
    return s;
  }
  function reset() {
    if (typeof G === 'undefined' || !G || !G.flags) return false;
    G.flags.la_chill = make();
    return true;
  }
  function sleetNow() {
    try {
      if (typeof WEATHER6 !== 'undefined' && WEATHER6.sleetAt) return clamp(+WEATHER6.sleetAt(G.day, G.tod) || 0, 0, 1);
    } catch (e) { /* ordinary air */ }
    return 0;
  }
  function nightNow() {
    const t = +((typeof G !== 'undefined' && G) ? G.tod : 0.5);
    return isFinite(t) && (t >= 20 / 24 || t < 5 / 24);
  }
  const playerPos = () => {
    try { if (typeof Engine !== 'undefined' && Engine && Engine.cam) return Engine.cam; } catch (e) { /* no camera */ }
    return null;
  };

  function tick(dt) {
    if (!here() || G.state !== 'play' || G.dead || !on()) return;
    const s = state(), pos = playerPos(), x = pos ? +pos.x || 0 : 0, y = pos ? +pos.y || 0 : 0;
    const fire = nearFire(G.map.entities, x, y, FIRE_RADIUS);
    const before = stageOf(s.warmth);
    step(s, { dt, outdoor: !!G.map.outdoor, sleet: sleetNow(), night: nightNow(), fire });
    const now = stageOf(s.warmth);
    if (now !== before) {
      const word = STAGE_WORDS[now];
      try { if (word && typeof msg === 'function') msg(word, now === 'warm' ? '' : 'bad', now === 'the chill' ? 5000 : 3200); } catch (e) { /* no message box */ }
    }
    // The engine's run and attack both read p.fat. Holding it at zero is the no-run/no-attack
    // gate without changing the engine; the player still walks and can reach the fire.
    if (s.warmth <= 0 && G.player) G.player.fat = 0;
  }

  function wire() {
    if (wired) return true;
    const L1 = typeof LEDGE1 !== 'undefined' ? LEDGE1 : null;
    try {
      if (L1 && Array.isArray(L1.SWITCHES) && !L1.SWITCHES.some((s) => s[0] === 'laChill')) {
        L1.SWITCHES.push(['laChill', 'The chill', 'Warmth, the cold stages and the bothy hearth. Off: no warmth and no bar']);
      }
    } catch (e) { /* the Options row is absent */ }
    // A new card is a new body. Creation calls choose(), which closes over panel10's local
    // applyBg, while succession (company12) calls PANEL10.applyBg directly: both paths need a
    // wrapper, and each wrapper belongs to its own path.
    try {
      if (typeof PANEL10 !== 'undefined' && PANEL10) {
        for (const key of ['applyBg', 'choose']) {
          const fn = PANEL10[key];
          if (typeof fn !== 'function') continue;
          PANEL10[key] = function () {
            const r = fn.apply(this, arguments);
            try { reset(); } catch (e) { /* the card stands */ }
            return r;
          };
        }
      }
    } catch (e) { /* the card keeps its warmth */ }
    // Stamina returns less in the cold. Multiply the layer below, which may already be the
    // cards' or the lungs' wrapper.
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
          const s = state();
          if (s.warmth >= MAX) return r;
          const ctx = Engine.ctx;
          if (!ctx || !ctx.fillRect) return r;
          const hh = Math.round(40 * s.warmth / MAX);
          ctx.save();
          ctx.fillStyle = '#000'; ctx.fillRect(40, 155, 3, 40);
          ctx.fillStyle = s.warmth <= 0 ? '#9a9a96' : '#c8913a';
          ctx.fillRect(40, 195 - hh, 3, hh);
          ctx.restore();
        } catch (e) { /* no bar is better than a broken frame */ }
        return r;
      };
    } catch (e) { /* the old HUD stands */ }
    wired = true;
    return true;
  }

  return {
    MIN, MAX, ASH_RATE, SLEET_RATE, NIGHT_RATE, FIRE_RATE, FIRE_RADIUS, WARM_AT, CHILLED_AT,
    stageOf, make, step, staminaReturn, nearFire, state, reset, wire
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = CHILL29;
if (typeof window !== 'undefined') CHILL29.wire();
