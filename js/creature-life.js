// ============================================================
//  creature-life — Phase 3: species fidgets, alert startle, run strides
//  Wraps animCreature (anim.js) and enemyUpdate (game.js/pathing.js). It only
//  reads AI state and then nudges the anim* fields AFTER the original ran; it
//  never moves an entity, changes a timer or an AI decision. The only field it
//  writes outside anim*/_cl* is e.facing during a startle, and nothing in the
//  enemy AI reads an enemy's facing (only NPC witness cones do).
//  These are procedural STAND-INS on top of the existing art: final painted
//  idle/startle/run sheets replace them without changing this contract.
//  Switch: GFX.creatureLife (default true). Reduced motion (the OS setting or
//  GFX.reducedMotion) turns the whole module off; the original motion stays.
// ============================================================
'use strict';

if (GFX.creatureLife === undefined) GFX.creatureLife = true;

const CREATURE_LIFE = (() => {
  const STARTLE_T = 0.35;      // seconds, from the alert sound
  const CHARGE_SPD = 1.2;      // smoothed speed (e._spd) that counts as a charge
  const FLEE_SPD = 0.6;
  const TAU = Math.PI * 2;
  const frac = x => x - Math.floor(x);
  const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
  const stats = { calls: 0, startles: 0 };
  let counter = 0;

  // ---- reduced motion: nothing here is needed to play, so it simply steps aside
  let reduce = false;
  try {
    const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq) { reduce = mq.matches; const on = ev => { reduce = ev.matches; }; if (mq.addEventListener) mq.addEventListener('change', on); else if (mq.addListener) mq.addListener(on); }
  } catch (err) { /* no matchMedia: carry on */ }
  const enabled = () => GFX.creatureLife && !reduce && !GFX.reducedMotion;

  // ---- species families (read from ENEMIES flags/sprites, cached per entity)
  const ROBED = new Set(['proctor', 'legionnaire', 'pressman', 'deacon', 'tongueless', 'hushwarden', 'wearer']);
  const SPECTRAL = new Set(['quiet', 'dirge', 'weaver', 'requiem', 'drowned']);
  const KEEP = new Set(['hushmoth', 'mites', 'horn']); // flutter/swarm/static: their own motion stays
  function family(e) {
    if (e._clFam) return e._clFam;
    const d = e.def || {}, sp = e.sprite;
    let f = 'biped';
    if (KEEP.has(sp) || (typeof ANIM !== 'undefined' && ANIM.flutter.has(sp))) f = 'keep';
    else if (typeof ANIM !== 'undefined' && ANIM.quadruped.has(sp)) f = 'quad';
    else if (d.quiet || d.dirge || d.hushkin || SPECTRAL.has(sp)) f = 'spectral';
    else if (ROBED.has(sp)) f = 'robed';
    return (e._clFam = f);
  }

  // Idle fidgets: pure functions of time and the entity's seed, so two enemies
  // of one species are out of step. Each returns deltas to apply.
  function fidget(f, s, T, o) {
    if (f === 'quad') {
      // a sniff: three dips of the head (lean + squash), a lift, then a long pause
      const P = 6 + 3 * frac(s * 0.318), t = (T + s * 3.7) % P;
      if (t < 1.5) { const dip = Math.max(0, Math.sin(TAU * t / 0.5)) * Math.sin(Math.PI * t / 1.5); o.sy -= 0.07 * dip; o.sx += 0.04 * dip; o.lift -= 0.012 * dip; o.skew += 0.035 * dip * (s > 3.14 ? 1 : -1); }
      else if (t < 2.1) { const up = Math.sin(Math.PI * (t - 1.5) / 0.6); o.sy += 0.03 * up; o.sx -= 0.012 * up; }
    } else if (f === 'robed') {
      // the hem sways; now and then a slow settling shrug
      o.skew += 0.016 * Math.sin(T * 0.9 + s) + 0.007 * Math.sin(T * 1.7 + s * 2);
      const P = 7 + 3 * frac(s * 0.37), t = (T + s * 2.9) % P;
      if (t < 0.7) { const sh = Math.sin(Math.PI * t / 0.7); o.sy += 0.022 * sh; o.sx -= 0.012 * sh; o.lift += 0.008 * sh; }
    } else if (f === 'spectral') {
      // a head-turn glance: the body narrows as if turning, then comes back
      const P = 3.5 + 3 * frac(s * 0.29), ph = T + s * 2.3, k = Math.floor(ph / P), t = ph - k * P;
      if (t < 0.8) { const g = Math.sin(Math.PI * t / 0.8); o.sx -= 0.3 * g; o.skew += 0.05 * g * (k & 1 ? 1 : -1); o.alpha -= 0.1 * g; }
    } else if (f === 'biped') {
      // armoured/mechanical bipeds: only a slow weight shift
      o.skew += 0.008 * Math.sin(T * 0.5 + s);
      const P = 8 + 3 * frac(s * 0.41), t = (T + s * 1.7) % P;
      if (t < 0.8) o.sy += 0.012 * Math.sin(Math.PI * t / 0.8);
    }
  }

  // ---- startle: sight = jolt first then turn; hearing = head-turn first then jolt
  function startle(e, o, T, dt) {
    const u = 1 - e._clSt / STARTLE_T;      // 0..1 through the startle
    const jolt = (a, b) => { const x = (u - a) / (b - a); return x <= 0 || x >= 1 ? 0 : x < 0.3 ? x / 0.3 : 1 - smooth((x - 0.3) / 0.7); };
    let turn;
    if (e._clHear) {
      const g = u < 0.4 ? Math.sin(Math.PI * u / 0.4) : 0;
      o.sx -= 0.16 * g;
      const j = jolt(0.35, 1);
      o.lift += 0.06 * j * (e.scale || 1); o.sy += 0.13 * j; o.sx -= 0.05 * j;
      turn = smooth(u / 0.4);
    } else {
      const j = jolt(0, 1);
      o.lift += 0.06 * j * (e.scale || 1); o.sy += 0.13 * j; o.sx -= 0.06 * j;
      turn = smooth((u - 0.2) / 0.6);
    }
    if (e._spd < 0.25 && Number.isFinite(e._clF0)) {
      const target = Math.atan2(Engine.cam.y - e.y, Engine.cam.x - e.x);
      let da = target - e._clF0; da -= TAU * Math.round(da / TAU);
      e.facing = e._clF0 + da * turn;
    }
    e._clSt -= dt;
  }
  function beginStartle(e, hear) {
    e._clSt = STARTLE_T; e._clHear = !!hear; e._clF0 = e.facing; stats.startles++;
  }

  const o = { sy: 0, sx: 0, lift: 0, skew: 0, alpha: 0 }; // scratch, reused (no per-frame allocation)

  function apply(e, dt, T) {
    const f = family(e);
    if (f === 'keep') return;
    const d = e.def || {};
    if (e._clSeed == null) e._clSeed = (typeof animSeed === 'function' ? animSeed(e) : 0) + (counter++) * 2.399963;
    const s = e._clSeed;
    o.sy = o.sx = o.lift = o.skew = o.alpha = 0;
    // velocity relative to the player (own previous position: anim.js overwrites its own)
    let cos = 0;
    if (e._clx != null) {
      const k = Math.min(1, dt * 12), ivd = 1 / Math.max(dt, 1e-3);
      e._clVx = (e._clVx || 0) + ((e.x - e._clx) * ivd - (e._clVx || 0)) * k;
      e._clVy = (e._clVy || 0) + ((e.y - e._cly) * ivd - (e._clVy || 0)) * k;
      const sp = Math.hypot(e._clVx, e._clVy), dx = Engine.cam.x - e.x, dy = Engine.cam.y - e.y, dist = Math.hypot(dx, dy);
      if (sp > 0.05 && dist > 0.05) cos = (e._clVx * dx + e._clVy * dy) / (sp * dist);
    }
    e._clx = e.x; e._cly = e.y;
    const spd = e._spd || 0, enemyState = e.state;
    const chargeT = enemyState === 'chase' && cos > 0.5 && spd > CHARGE_SPD ? 1 : 0;
    const fleeT = enemyState !== 'idle' && enemyState !== 'passive' && cos < -0.5 && spd > FLEE_SPD ? 1 : 0;
    const kk = Math.min(1, dt * 8);
    e._clCh = (e._clCh || 0) + (chargeT - (e._clCh || 0)) * kk;
    e._clFl = (e._clFl || 0) + (fleeT - (e._clFl || 0)) * kk;

    let sy = e.animSY, sx = e.animSX, lift = e.animLift, skew = e.animSkew, alpha = e.animAlpha;
    const hover = (d.yOff || 0) < 0 || d.quiet;
    const idleish = spd <= 0.25 && enemyState !== 'chase' && !(e.stun > 0) && !(e._atk > 0);
    if (e._clSt > 0 && enemyState === 'chase') startle(e, o, T, dt);
    else { e._clSt = 0; if (idleish) fidget(f, s, T, o); }

    // strides: a charge is long, low and leaning in; a flight is hunched, quick and choppy
    if (e._clCh > 0.01 || e._clFl > 0.01) {
      e._clPh = (e._clPh || 0) + spd * dt;
      const ph = e._clPh, w = e._clCh, v = e._clFl;
      if (w > 0.01) {
        sy *= 1 - 0.08 * w; sx *= 1 + 0.07 * w;
        if (!hover) lift = lift * (1 - 0.45 * w) + w * 0.016 * (1 + Math.sin(ph * 1.6));
        skew = skew * (1 - w) + w * 0.025 * Math.sin(ph * 1.6); // slow, long swing
      }
      if (v > 0.01) {
        sy *= 1 - 0.1 * v + 0.03 * v * Math.abs(Math.sin(ph * 10));
        sx *= 1 + 0.02 * v;
        if (!hover) lift += v * 0.03 * Math.abs(Math.sin(ph * 10));
        skew = skew * (1 - v) + v * 0.06 * (Math.sin(ph * 10) >= 0 ? 1 : -1); // square-wave = choppy
        // every second or so a glance back over the shoulder
        const P = 1.3 + 0.5 * frac(s * 0.23), gt = (T + s) % P;
        if (gt < 0.32) { const g = Math.sin(Math.PI * gt / 0.32); sx *= 1 - 0.14 * v * g; skew -= 0.05 * v * g * (s > 3.14 ? 1 : -1); }
      }
    }
    e.animSY = sy + o.sy; e.animSX = sx + o.sx; e.animLift = lift + o.lift; e.animSkew = skew + o.skew;
    if (o.alpha) e.animAlpha = Math.max(0, alpha + o.alpha);
  }

  // ---- hooks (load order: after anim.js, game.js and pathing.js)
  const origAnim = animCreature;
  animCreature = function (e, dt, T) {
    origAnim(e, dt, T);
    if (!enabled() || e.kind !== 'enemy' || e.dead || e.dying || e.corpse) return;
    const t0 = CREATURE_LIFE.timing ? performance.now() : 0;
    try {
      // fallback detection (hit while idle, disguise exposed...): enemyUpdate's own
      // transition is caught below, this catches the rest one frame later
      if (e._clPrev !== undefined && e._clPrev !== 'chase' && e.state === 'chase' && !(e._clSt > 0)) beginStartle(e, false);
      e._clPrev = e.state;
      apply(e, dt, T); stats.calls++;
    } catch (err) { /* never break a frame */ }
    if (t0) CREATURE_LIFE.ms += performance.now() - t0;
  };

  const origUpdate = enemyUpdate;
  enemyUpdate = function (e, dt) {
    const before = e.state;
    origUpdate(e, dt);
    try {
      if (before !== 'chase' && e.state === 'chase' && enabled() && family(e) !== 'keep') {
        // the same call that played Audio_.sfx.enemy(d,'alert'): start the startle now
        const c = Engine.cam, dist = Math.hypot(c.x - e.x, c.y - e.y);
        const sight = dist < 5 && typeof los === 'function' && los(e.x, e.y, c.x, c.y);
        beginStartle(e, !sight); e._clPrev = 'chase';
      } else if (e.state !== 'chase') e._clPrev = e.state;
    } catch (err) { /* animation must never break a tick */ }
  };

  return { STARTLE_T, family, fidget, origAnim, origUpdate, stats, timing: false, ms: 0, enabled };
})();
