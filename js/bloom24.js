// ============================================================
//  bloom24 - Phase 24, the walking bloom's flesh and cloud.
//
//  The prologue bloom is invulnerable (owner ruling, 2026-11-23); the later bloom can die at 55 wounds. Every wound
//  leaves a 1.2 m cloud for 3 s; the burst leaves 2.4 m for 8 s. Fire burns the cloud away, and the cinder
//  squall feeds it 1.6 times as fast; the Dead Calm leaves it hanging.
// ============================================================
'use strict';

const BLOOM24 = (() => {
  const HP = 55, WOUND = { r: 1.2, t: 3 }, BURST = { r: 2.4, t: 8 };
  // bestiary.md, the six-weather table: how long a cloud lasts, relative to ashfall.
  const CLOUD_LIFE = { deadcalm: 1.6, miasma: 1.3, ashfall: 1.0, hoarfrost: 0.9, sleet: 0.6, cinder: 0.4 };

  function make(o) {
    o = o || {};
    return { hp: HP, max: HP, alive: true, invulnerable: o.invulnerable !== false, cloud: null, cloudLeft: 0 };
  }

  function wound(s) {
    if (!s || !s.alive) return null;
    s.cloud = { r: WOUND.r, t: WOUND.t }; s.cloudLeft = WOUND.t;
    return s.cloud;
  }

  function burst(s) {
    if (!s || !s.alive) return null;
    s.alive = false; s.hp = 0;
    s.cloud = { r: BURST.r, t: BURST.t }; s.cloudLeft = BURST.t;
    return s.cloud;
  }

  function hit(s, damage) {
    if (!s || !s.alive) return { hit: false, blocked: false, dead: true };
    if (s.invulnerable) return { hit: false, blocked: true, dead: false };
    s.hp = Math.max(0, s.hp - Math.max(0, +damage || 0));
    if (s.hp <= 0) { burst(s); return { hit: true, blocked: false, dead: true }; }
    wound(s);
    return { hit: true, blocked: false, dead: false };
  }

  // lit fire within 2 m eats the cloud; weather may slow or hurry it.
  function burn(s, o) {
    o = o || {};
    if (!s || !s.cloudLeft) return 0;
    if (!o.lit || (+o.dist || 0) > 2) return s.cloudLeft;
    const life = CLOUD_LIFE[o.weather] || 1;
    const used = Math.min(s.cloudLeft, Math.max(0, +o.dt || 0) * (10 / life));
    s.cloudLeft -= used;
    if (s.cloudLeft <= 0) { s.cloudLeft = 0; s.cloud = null; }
    return s.cloudLeft;
  }

  const cloudAt = (s) => (s && s.cloudLeft > 0 ? { r: s.cloud.r, left: s.cloudLeft } : null);
  const life = (weather) => CLOUD_LIFE[weather] || 1;

  // ---------------------------------------------------------------- the wire (browser only)
  // The prologue bloom is the one in bloom4. Its state is replaced by reset(), so a new reference is a
  // new character and therefore a new, invulnerable bloom. The later bloom can call state().invulnerable = false.
  const here = () => typeof G !== 'undefined' && G && G.map && G.map._la;
  const TX = { blocked: 'The bloom does not bleed; the crust turns the blade.', wound: 'The crust splits; spores spill out.', burst: 'The bloom bursts; the whole crop lets go at once.' };
  let S = make(), bloomRef = null, wired = false;
  function reset() {
    S = make();
    bloomRef = (typeof BLOOM4 !== 'undefined' && BLOOM4.state) ? BLOOM4.state() : null;
    return S;
  }
  function state() {
    try {
      if (typeof BLOOM4 !== 'undefined' && BLOOM4.state) {
        const b = BLOOM4.state();
        if (b !== bloomRef) { bloomRef = b; S = make(); }
      }
    } catch (e) { /* no bloom */ }
    return S;
  }
  const cloudSpot = () => (S.cloudLeft > 0 ? { x: S.cloudX, y: S.cloudY, map: S.cloudMap, r: S.cloud.r, left: S.cloudLeft } : null);
  function spill(b) {
    if (!S.cloud || !b) return null;
    S.cloudX = +b.x || 0; S.cloudY = +b.y || 0;
    S.cloudMap = G.mapId || (G.map && G.map.id) || 'la_ledge';
    return S.cloud;
  }
  function weatherKind() {
    try { if (typeof WEATHER21 !== 'undefined' && WEATHER21.forDay) return WEATHER21.forDay(G.day).name; } catch (e) { /* ashfall */ }
    try { if (typeof WEATHER6 !== 'undefined' && WEATHER6.kindAt) return WEATHER6.kindAt(G.day, G.tod); } catch (e) { /* ashfall */ }
    return 'ashfall';
  }
  function sporeNow() {
    try { if (typeof WEATHER21 !== 'undefined' && WEATHER21.forDay) return WEATHER21.forDay(G.day).spore; } catch (e) { /* ordinary air */ }
    return 1;
  }
  function fireLit() {
    try { return !!(typeof LANTERN7 !== 'undefined' && LANTERN7.lit && LANTERN7.lit()); } catch (e) { return false; }
  }
  function damageOf(w) {
    const d = w && w.dmg;
    if (!d) return 1;
    const lo = +d[0] || 1, hi = +d[1] || lo;
    return Math.max(1, Math.round((lo + hi) / 2));
  }
  function target() {
    if (!here() || G.state !== 'play' || G.dead || !G.player) return null;
    let b = null;
    try { b = (typeof BLOOM4 !== 'undefined' && BLOOM4.state) ? BLOOM4.state() : null; } catch (e) { b = null; }
    if (!b || (b.map && b.map !== G.mapId)) return null;
    const w = typeof currentWeapon === 'function' ? currentWeapon() : null;
    if (!w || w.ranged) return null;
    const c = Engine.cam; if (!c) return null;
    const dx = (+b.x || 0) - c.x, dy = (+b.y || 0) - c.y, d = Math.hypot(dx, dy);
    if (!(d <= (+w.reach || 1.5) + 0.35)) return null;
    let a = Math.atan2(dy, dx) - c.dir; a = Math.atan2(Math.sin(a), Math.cos(a));
    if (Math.abs(a) > 0.55) return null;
    try { if (typeof los === 'function' && !los(c.x, c.y, b.x, b.y)) return null; } catch (e) { /* no line of sight */ }
    return { b, w };
  }
  function say(t, cls, ms) { try { if (typeof msg === 'function') msg(t, cls || '', ms || 2200); } catch (e) { /* no message box */ } }
  function tick(dt) {
    if (!here() || G.state !== 'play' || G.dead) return;
    const s = state(), step = Math.max(0, +dt || 0);
    if (!(s.cloudLeft > 0)) return;
    const c = Engine.cam; if (!c) return;
    const d = Math.hypot(c.x - (+S.cloudX || 0), c.y - (+S.cloudY || 0)), weather = weatherKind();
    const edge = Math.max(0, d - (s.cloud.r || 0));
    if (S.cloudMap === G.mapId && fireLit() && edge <= 2) {
      burn(s, { lit: true, dist: edge, dt: step, weather });
    } else {
      s.cloudLeft = Math.max(0, s.cloudLeft - step / life(weather));
      if (s.cloudLeft <= 0) { s.cloudLeft = 0; s.cloud = null; }
    }
    if (s.cloudLeft > 0 && S.cloudMap === G.mapId && d <= s.cloud.r) {
      try {
        if ((typeof GFX === 'undefined' || GFX.laLungs !== false) && typeof LUNGS20 !== 'undefined' && LUNGS20.state && LUNGS20.chokeTick) {
          LUNGS20.chokeTick(LUNGS20.state(), { dt: step, choke: 1, spore: sporeNow(), mask: !!(G.flags && G.flags.la_mask) });
        }
      } catch (e) { /* the lungs keep their last dose */ }
    }
  }
  function wire() {
    if (wired || typeof window === 'undefined' || typeof G === 'undefined' || typeof Engine === 'undefined' || typeof attack !== 'function' || typeof update !== 'function' || typeof BLOOM4 === 'undefined' || !BLOOM4.state) return false;
    wired = true;
    reset();
    const _at = attack;
    attack = function () {
      const before = +G.attack.t || 0;
      const r = _at.apply(this, arguments);
      try {
        if (!(+G.attack.t > before)) return r;
        const t = target(); if (!t) return r;
        const finish = () => {
          const now = target();
          if (!now || now.b !== t.b) return;   // the bloom moved or the swing no longer reaches it
          const out = hit(state(), damageOf(t.w));
          if (out.blocked) { say(TX.blocked, '', 1600); return; }
          if (!out.hit) return;
          spill(t.b);
          say(out.dead ? TX.burst : TX.wound, 'bad', out.dead ? 3000 : 2200);
        };
        // Phase 23 delays melee hits to the active window; put the bloom's own hit on the same clock.
        if (typeof G.attack.pendingHit === 'function') {
          const inner = G.attack.pendingHit;
          G.attack.pendingHit = () => { const x = inner(); finish(); return x; };
        } else finish();
      } catch (e) { /* the swing stands */ }
      return r;
    };
    const _up = update;
    update = function (dt) {
      const r = _up.apply(this, arguments);
      try { tick(dt); } catch (e) { /* the cloud keeps its last shape */ }
      return r;
    };
    return true;
  }

  return { HP, WOUND, BURST, CLOUD_LIFE, make, hit, wound, burst, burn, cloudAt, life, state, reset, cloudSpot, wire };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = BLOOM24;
if (typeof window !== 'undefined') BLOOM24.wire();
