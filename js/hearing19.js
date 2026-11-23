// ============================================================
//  hearing19 - Phase 19, noise and the hearing table.
//
//  The engine's noise value is the input, not the distance: standing floors at 1.0, walking at 2.4, running
//  at 4.2, and a wall clang is 16. The company's hearing table turns that into metres: stand 3 [PROPOSED],
//  walk 6, sprint 14, clang 16; stone halves every distance. The bloom keeps its own poorer ears; this file
//  exposes the company's numbers and the shared maximum, not a new hunt.
//
//  Two wires use the table when the page is there:
//   * human NPCs inside a noise's reach turn to face it for a moment (pixelfolk reads e.facing);
//   * a slash or rising cut whose aim meets a stone wall within the weapon's reach is a wall clang: noise
//     16, heard by those same listeners. Thrusts and chops never clang (the lore); the wall faces that
//     ring and the listening hold are [PROPOSED].
//
//  Pure. No DOM, no canvas, no clock, no random number.
//
//  Sourced: walk 6 m, sprint 14 m, clang 16 m, stone half (the round-and-the-long-account.md, Co-op
//  systems; bestiary.md, quarry-troll). Proposed: standing at 3 m, gear simply adding to the input,
//  the ledge's y=41 rock/frost split, the listening hold, and the stone-wall texture list.
// ============================================================
'use strict';

const HEARING19 = (() => {
  const CLANG = 16, STONE = 0.5;
  const BASE = { stand: 1.0, walk: 2.4, sprint: 4.2, clang: 16 };
  const DIST = { stand: 3, walk: 6, sprint: 14, clang: 16 };   // metres, [PROPOSED] for standing
  const HOLD = 1.2, CLANG_HOLD = 2.4;                         // seconds a listener holds a heard facing [PROPOSED]
  const STONE_WALL = /(stone|rock|marble|slag|granite|slate|catacomb|mausoleum)/i;   // faces a blade rings on [PROPOSED]
  const SWEEP = /slash|cut/i, NOT_SWEEP = /thrust|chop|heavy|overhead/i;

  function noiseOf(o) {
    o = o || {};
    const state = BASE[o.state] != null ? o.state : (o.state === 'run' ? 'sprint' : 'stand');
    const gear = Number.isFinite(+o.gear) ? Math.max(0, +o.gear) : 0;
    return (BASE[state] || BASE.stand) + gear;
  }

  // A noisier step is heard farther, between the table's marked rows. Stone halves the final distance.
  function heardAt(noise, surface) {
    const n = Math.max(0, Number.isFinite(+noise) ? +noise : 0);
    let d;
    if (n <= BASE.stand) d = DIST.stand;
    else if (n <= BASE.walk) d = DIST.stand + (n - BASE.stand) / (BASE.walk - BASE.stand) * (DIST.walk - DIST.stand);
    else if (n <= BASE.sprint) d = DIST.walk + (n - BASE.walk) / (BASE.sprint - BASE.walk) * (DIST.sprint - DIST.walk);
    else d = DIST.sprint + Math.min(1, (n - BASE.sprint) / (CLANG - BASE.sprint)) * (DIST.clang - DIST.sprint);
    return d * (surface === 'stone' ? STONE : 1);
  }

  // The bothy's flagstones and the ledge's rock are stone; the ramp's frost is not.
  function surfaceAt(map, x, y) {
    const id = typeof map === 'string' ? map : (map && map.id);
    if (id === 'la_bothy') return 'stone';
    if (id === 'la_ledge') return (Number.isFinite(+y) ? +y : 0) > 41 ? 'frost' : 'stone';
    return 'frost';
  }

  const companyNoise = (list) => (Array.isArray(list) && list.length ? Math.max.apply(null, list.map((n) => +n || 0)) : 0);
  const clangNoise = () => CLANG;
  const surfaceMul = (surface) => (surface === 'stone' ? STONE : 1);

  // A person who can hear: not the cat, a Hollow, a companion or a co-op figure. The dead and the hidden do not listen.
  function isHumanNpc(e) {
    return !!(e && e.kind === 'npc' && e.id !== 'cat' && !e.companion && !e.loop && !e.p19fig && !e.dead && !e.hidden);
  }
  const stoneWall = (cell) => { const tex = cell && (cell.tex || cell.texture); return typeof tex === 'string' && STONE_WALL.test(tex); };
  // A sweep is a slash or a rising cut. The lore is explicit that thrusts and overhead chops do not ring.
  function sweepClangs(label) { const s = String(label == null ? '' : label); return SWEEP.test(s) && !NOT_SWEEP.test(s); }
  const clangOf = (label, cell) => (sweepClangs(label) && stoneWall(cell) ? CLANG : 0);

  // One human's ears against one noise: the table's metres, with an optional reach used by the caller.
  function heardBy(e, o) {
    if (!isHumanNpc(e) || !o) return false;
    const x = Number.isFinite(+o.x) ? +o.x : NaN, y = Number.isFinite(+o.y) ? +o.y : NaN;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(+e.x) || !Number.isFinite(+e.y)) return false;
    const reach = heardAt(o.noise, o.surface) + Math.max(0, Number.isFinite(+o.reach) ? +o.reach : 0);
    return Math.hypot(+e.x - x, +e.y - y) <= reach;
  }
  // Turn each listener's facing toward a heard noise for `hold` seconds. memory keeps the facing to put back.
  function perceive(list, o, memory, now) {
    if (!Array.isArray(list) || !o || !memory || typeof memory.get !== 'function' || typeof memory.set !== 'function') return 0;
    if (!Number.isFinite(+o.x) || !Number.isFinite(+o.y)) return 0;
    const at = Number.isFinite(+now) ? +now : 0;
    const hold = Number.isFinite(+o.hold) && +o.hold >= 0 ? +o.hold : HOLD;
    let n = 0;
    for (const e of list) {
      if (!heardBy(e, o)) continue;
      if (e.state === 'chase' || e.state === 'investigate') continue;   // already reacting: their own rule owns the facing
      let m = memory.get(e);
      if (!m) { m = { was: Number.isFinite(e.facing) ? e.facing : null }; memory.set(e, m); }
      e.facing = Math.atan2(+o.y - e.y, +o.x - e.x); m.until = Math.max(m.until || 0, at + hold); n++;
    }
    return n;
  }
  // Put back the facings whose listening spell has passed; returns how many were released.
  function release(memory, now) {
    if (!memory || typeof memory.forEach !== 'function' || typeof memory.delete !== 'function') return 0;
    const at = Number.isFinite(+now) ? +now : 0;
    let n = 0;
    memory.forEach((m, e) => {
      if (!m || !(m.until <= at)) return;
      if (m.was == null) delete e.facing; else e.facing = m.was;
      memory.delete(e); n++;
    });
    return n;
  }

  // What the HUD reads: the noise value, the ground and the person's card hearing, in metres.
  function reading(o) {
    o = o || {};
    const surface = o.surface === 'stone' ? 'stone' : 'frost';
    const hearing = Number.isFinite(+o.hearing) && +o.hearing > 0 ? +o.hearing : 1;
    return { noise: +o.noise || 0, surface, metres: +(heardAt(o.noise, surface) * hearing).toFixed(2) };
  }

  // ---------------------------------------------------------------- the wire (browser only)
  function wire() {
    if (typeof window === 'undefined' || typeof Engine === 'undefined' || typeof G === 'undefined') return false;
    const L1 = typeof LEDGE1 !== 'undefined' ? LEDGE1 : null;
    try {
      if (L1 && Array.isArray(L1.SWITCHES) && !L1.SWITCHES.some((s) => s[0] === 'laHearGauge')) {
        L1.SWITCHES.push(['laHearGauge', 'Hearing gauge', 'How far your noise carries, in metres. Off: the old HUD']);
      }
    } catch (e) { /* the Options row is absent */ }
    if (typeof drawHUD !== 'function') return false;
    // ---------------------------------------------------------------- the listeners and the clang
    const MEM = new Map();
    function tick() {
      if (!G || G.state !== 'play' || !G.map || !G.map._la || !G.player || !Engine.cam) return 0;
      release(MEM, G.time);
      const noise = +G.noise || 0;
      if (!(noise > 0)) return 0;
      const c = Engine.cam;
      return perceive(G.ents, { x: c.x, y: c.y, noise, surface: surfaceAt(G.map, c.x, c.y) }, MEM, G.time);
    }
    function wallHit(label, before) {
      if (!G || G.state !== 'play' || !G.map || !G.map._la || !G.player || !G.attack || !Engine.cam) return 0;
      if (!(+G.attack.t > before)) return 0;                    // the engine refused: no swing, no clang
      const w = currentWeapon();
      if (!w || w.ranged || (typeof WEAPONS !== 'undefined' && w === WEAPONS.hands)) return 0;
      const reach = Number.isFinite(+w.reach) ? +w.reach : 1.2;
      const wall = Engine.pickWall(reach + 0.15);
      if (!wall || !clangOf(label || G.attack.dirLabel, wall.cell)) return 0;
      if (typeof Engine.pick === 'function' && Engine.pick(G.ents, reach + 0.2)) return 0;   // a body took the blow
      const c = Engine.cam, surface = surfaceAt(G.map, c.x, c.y);
      try { if (typeof addNoise === 'function') addNoise(CLANG); } catch (e) { /* the swing still stands */ }
      release(MEM, G.time);
      return perceive(G.ents, { x: wall.x + 0.5, y: wall.y + 0.5, noise: CLANG, surface, hold: CLANG_HOLD }, MEM, G.time);
    }
    if (typeof update === 'function') {
      const _up = update;
      update = function () {
        const r = _up.apply(this, arguments);
        try { tick(); } catch (e) { /* no perception is better than a broken frame */ }
        return r;
      };
    }
    if (typeof attack === 'function' && typeof currentWeapon === 'function' && typeof Engine.pickWall === 'function') {
      const _at = attack;
      attack = function (dirLabel) {
        const before = G && G.attack ? +G.attack.t || 0 : 0;
        const r = _at.apply(this, arguments);
        try { wallHit(dirLabel, before); } catch (e) { /* the swing stands */ }
        return r;
      };
    }
    const _hud = drawHUD;
    drawHUD = function () {
      const r = _hud.apply(this, arguments);
      try {
        if (!G || G.state !== 'play' || !G.map || !G.map._la || !Engine.ctx) return r;
        if (typeof GFX !== 'undefined' && GFX.laHearGauge === false) return r;
        const bg = G.flags && G.flags.la_bg;
        const hearing = (typeof CARDS18 !== 'undefined' && CARDS18.hearing) ? CARDS18.hearing(bg) : 1;
        const read = reading({ noise: G.noise, surface: surfaceAt(G.map, Engine.cam.x, Engine.cam.y), hearing });
        const ctx = Engine.ctx;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(2, 2, 62, 10);
        ctx.fillStyle = '#b8a883'; ctx.font = '7px "Alegreya", serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText('heard ' + Math.round(read.metres) + ' m', 5, 7);
        ctx.restore();
      } catch (e) { /* no gauge is better than a broken frame */ }
      return r;
    };
    return true;
  }

  return { CLANG, STONE, BASE, DIST, HOLD, CLANG_HOLD, noiseOf, heardAt, surfaceAt, companyNoise, clangNoise, surfaceMul, reading, isHumanNpc, stoneWall, sweepClangs, clangOf, heardBy, perceive, release, wire };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = HEARING19;
if (typeof window !== 'undefined') HEARING19.wire();
