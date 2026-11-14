// ============================================================
//  townsfolk — Phase 4 (living world): talking gestures, work loops, daily routines
//  Two switches:
//    GFX.townsfolkLife  (default true) VISUAL ONLY. Wraps animCreature for NPCs and
//                       nudges the anim* fields after the original ran: hand/arm
//                       emphasis and head turns while talking, a glance at a player
//                       who comes close, and work loops for the tavern barman (Hetty),
//                       the tanner (Abner) and the mill hands (Nell, Pim). It never
//                       moves an entity or writes facing (witness cones read it).
//    GFX.routines       (default true) WHO STANDS WHERE BY HOUR. A handful of generic
//                       Oakhaven townsfolk (id townsman/townswoman, no quest, no law
//                       duty, no nightWatch/requires/until) work in the day, drink at
//                       the Boar in the evening and are indoors (hidden) at night.
//                       Moving between maps is a pair of entities: the original in
//                       Oakhaven and a transient stand-in appended to the tavern.
//  Save safety: nothing here adds a saved field. x/y/homeX/homeY/hidden are saved by
//  the game, so what is applied is a pure function of G.tod and G.flags and is
//  recomputed after buildAllMaps, loadMap, restoreGame, passHours and every tick.
//  Entities are never added or removed in a built map: stand-ins are appended after
//  the builds with transient:true (past baseCount, never saved). Named characters
//  (every quest-bearing NPC) are not in the roster and are never touched.
//  The motion is procedural STAND-IN work; painted talk/work frames replace it later
//  without changing this contract.
// ============================================================
'use strict';

if (GFX.townsfolkLife === undefined) GFX.townsfolkLife = true;
if (GFX.routines === undefined) GFX.routines = true;

const TOWNSFOLK = (() => {
  const TAU = Math.PI * 2;
  const frac = x => x - Math.floor(x);
  const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
  const stats = { calls: 0, applied: 0 };

  // ------------------------------------------------------------ routines
  // Hours are game hours (G.tod * 24). work = [from, to) the original is out; tavern =
  // [from, to) the stand-in is at the Boar; otherwise indoors at home (hidden). A
  // range may wrap past midnight. `present` entries only have the one range.
  // Positions are the builders' own (maps.js), used to find the entity again after a
  // rebuild; the tavern spots were checked clear of tables, the bar, the cellar door and
  // the street door (test/townsfolk.test.js re-checks them).
  const ROSTER = [
    { key: 'orchardA', map: 'oakhaven', id: 'townsman', x: 50.5, y: 32.5, work: [6, 17], tavern: [17, 22], slot: 0 },
    { key: 'orchardB', map: 'oakhaven', id: 'townsman', x: 58.5, y: 36.5, work: [6, 18] },
    { key: 'market', map: 'oakhaven', id: 'townswoman', x: 49.5, y: 20.5, work: [7, 17], tavern: [17, 20], slot: 1 },
    { key: 'lane', map: 'oakhaven', id: 'townsman', x: 19.5, y: 23.5, work: [8, 18], tavern: [18, 23], slot: 2 },
    { key: 'west', map: 'oakhaven', id: 'townswoman', x: 9.5, y: 14.5, work: [6, 19] },
    { key: 'meadow', map: 'oakhaven', id: 'townsman', x: 30.5, y: 55.5, work: [5, 18] },
    { key: 'patron', map: 'tavern', id: 'townsman', x: 10.5, y: 3.5, work: [15, 2], present: true },
  ];
  // where the Oakhaven hands sit when they are at the Boar (tavern 17x12; door at 8,11)
  const TAVERN_SLOTS = [
    { x: 13.3, y: 4.9, facing: Math.PI },
    { x: 6.1, y: 7.6, facing: Math.PI },
    { x: 11.6, y: 6.5, facing: Math.PI / 2 },
  ];
  const inRange = (h, r) => r[0] <= r[1] ? h >= r[0] && h < r[1] : h >= r[0] || h < r[1];
  // 'work' (the original is out), 'tavern' (the stand-in is there), 'home' (nobody is out)
  function stateAt(r, h) {
    if (inRange(h, r.work)) return 'work';
    if (r.tavern && inRange(h, r.tavern)) return 'tavern';
    return 'home';
  }
  // the epsilon keeps an exact hour (17/24*24 = 16.999...) on the right side of its boundary
  const hourNow = () => ((((G.tod % 1) + 1) % 1) * 24 + 1e-7) % 24;
  const active = () => !!GFX.routines && !(G.flags && G.flags.greening);

  // Mark the originals and append the stand-ins. Runs after every build (the other
  // modules append their own entities first, so ours are the last in the list).
  function attach(maps) {
    if (!maps) return maps;
    for (const r of ROSTER) {
      const m = maps[r.map]; if (!m) continue;
      const e = m.entities.find(o => o.kind === 'npc' && o.id === r.id && !o.transient && Math.abs(o.x - r.x) < 0.01 && Math.abs(o.y - r.y) < 0.01 &&
        !o.lawGuard && !o.nightWatch && !o.requires && !o.until && !o.companion);
      if (!e) continue;
      e._tf = r;
      const tav = maps.tavern;
      if (r.slot != null && tav) {
        const s = TAVERN_SLOTS[r.slot];
        const st = tav.add({ kind: 'npc', id: r.id, x: s.x, y: s.y, sprite: NPCS[r.id].sprite, scale: NPCS[r.id].scale || 1, solid: true, radius: 0.35, facing: s.facing, transient: true, _decor: true, hidden: true, _tfStand: r.key });
        e._tfStandIn = st;
      }
    }
    return maps;
  }

  // Is the player looking at it? A change in front of the player waits (up to WAIT_MAX
  // seconds) for them to look away, so nobody pops in or out of the street in view.
  const WAIT_MAX = 8;
  function watched(e) {
    const c = Engine.cam, dx = e.x - c.x, dy = e.y - c.y, d2 = dx * dx + dy * dy;
    if (d2 > 14 * 14) return false;
    if (d2 < 1.5 * 1.5) return true;
    return typeof los === 'function' ? los(c.x, c.y, e.x, e.y) : true;
  }
  // returns false while a change is still waiting for the player to look away
  function setHidden(e, want, force, dt) {
    if (e.dead) return true;
    if (!!e.hidden === want) { e._tfWait = 0; return true; }
    if (!force) {
      const inMap = G.ents && G.ents.includes(e);
      if (inMap && ((typeof DLG !== 'undefined' && DLG.ent === e && G.state === 'dialogue') || (e._tfWait = (e._tfWait || 0) + dt) < WAIT_MAX && watched(e))) return false;
    }
    e.hidden = want; e._tfWait = 0; stats.applied++; return true;
  }
  // anim.js removes transient entities of the map being left (loadMap) and of every
  // other map (animFrame). The stand-ins are transient so the game never saves them,
  // which means they must be put back before the tavern is entered or loaded.
  function ensureStands() {
    if (!G.maps || !G.maps.tavern) return;
    const list = G.maps.tavern.entities;
    for (const id in G.maps) for (const e of G.maps[id].entities) {
      const st = e._tfStandIn; if (!st) continue;
      if (!list.includes(st)) list.push(st);
      if (!st._h) hydrate(st);
    }
  }
  // Pure function of tod + switches -> hidden on every roster entity, in every map.
  // force = a cut (load, rest, travel): apply at once. Otherwise a tick of dt seconds.
  function apply(force, dt) {
    if (!G.maps) return;
    if (force) ensureStands();
    const h = hourNow(), on = active();
    for (const id in G.maps) {
      for (const e of G.maps[id].entities) {
        const r = e._tf; if (!r) continue;
        const st = stateAt(r, h), key = (on ? 'on:' : 'off:') + st;
        // A tick only acts on a change of routine (or one still waiting to happen). Between changes it leaves
        // hidden alone, so other code that hides a townsperson (a scene, a test fixture) is not overruled.
        if (!force && e._tfKey === key && !e._tfPend) continue;
        const a = setHidden(e, on ? st !== 'work' : false, force, dt || 0);
        const b = e._tfStandIn ? setHidden(e._tfStandIn, !(on && st === 'tavern'), force, dt || 0) : true;
        e._tfKey = key; e._tfPend = !(a && b);
      }
    }
  }

  const _build = buildAllMaps;
  buildAllMaps = function () { const maps = attach(_build()); return maps; };
  const _load = loadMap;
  loadMap = function (id, pos) {
    try { ensureStands(); } catch (err) { /* cosmetic */ }
    const r = _load(id, pos);
    try { apply(true); } catch (err) { /* routines are cosmetic */ }
    return r;
  };
  const _restore = restoreGame;
  restoreGame = function (d) { const r = _restore(d); try { apply(true); } catch (err) { /* ditto */ } return r; };
  const _pass = passHours;
  passHours = function (hours) { const r = _pass(hours); try { apply(true); } catch (err) { /* ditto */ } return r; };
  const _update = update;
  update = function (dt) { const r = _update(dt); try { apply(false, dt); } catch (err) { /* never break a tick */ } return r; };

  // ------------------------------------------------------------ gestures and work loops
  let reduce = false;
  try {
    const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq) { reduce = mq.matches; const on = ev => { reduce = ev.matches; }; if (mq.addEventListener) mq.addEventListener('change', on); else if (mq.addListener) mq.addListener(on); }
  } catch (err) { /* no matchMedia: carry on */ }
  const enabled = () => GFX.townsfolkLife && !reduce && !GFX.reduceMotion;

  const o = { sy: 0, sx: 0, lift: 0, skew: 0 }; // scratch, reused (no per-frame allocation)

  // Work loops: [map, id] -> { from, to, fn(T, s, k, o) }. k is the loop's own 0..1 weight.
  // Hours are game hours; they only pick when a loop runs, never where anyone stands.
  const LOOPS = {
    // Hetty behind the bar: wipe the counter, pause, tilt a jug to pour, look up
    'tavern|hetty': { from: 10, to: 26, fn(T, s, k) {
      const t = (T + s * 2) % 14;
      if (t < 6) { const e = smooth(t / 0.6) * smooth((6 - t) / 0.6); o.skew += 0.04 * Math.sin(T * 5.5) * e * k; o.sx += 0.012 * Math.sin(T * 5.5 + 1) * e * k; o.sy -= 0.012 * e * k; }
      else if (t >= 9 && t < 12) { const w = smooth((t - 9) / 0.6) * smooth((12 - t) / 0.6); o.sy -= 0.035 * w * k; o.skew += 0.03 * w * k; o.lift -= 0.004 * w * k; }
    } },
    // Abner the tanner: three hard strokes over the beam, then a breath
    'oakhaven|hob': { from: 6, to: 20, fn(T, s, k) {
      const t = (T + s) % 5;
      if (t < 3.2) { const e = smooth(t / 0.4) * smooth((3.2 - t) / 0.4), st = Math.sin(T * 7.5); o.skew += 0.05 * st * e * k; o.sy -= (0.03 + 0.012 * st) * e * k; o.lift -= 0.006 * (0.5 + 0.5 * st) * e * k; o.sx += 0.008 * st * e * k; }
    } },
    // Nell at the still engine: hand-carding wool, long pulls with a rest
    'mill|nell': { from: 6, to: 21, fn(T, s, k) {
      const t = (T + s) % 9;
      if (t < 6.5) { const e = smooth(t / 0.5) * smooth((6.5 - t) / 0.5), st = Math.sin(T * 3.6); o.skew += 0.032 * st * e * k; o.sx += 0.014 * (0.5 + 0.5 * st) * e * k; o.sy -= 0.015 * e * k; }
    } },
    // Pim sorting fleece by the engine, with the cough Nell mentions
    'mill|pim': { from: 6, to: 21, fn(T, s, k) {
      o.skew += 0.012 * Math.sin(T * 1.9 + s) * k; o.lift -= 0.004 * (0.5 + 0.5 * Math.sin(T * 1.9 + s)) * k;
      const t = (T + s * 3) % 11;
      if (t < 0.7) { const e = Math.sin(Math.PI * t / 0.7); o.skew += 0.035 * Math.sin(T * 38) * e * k; o.sy -= 0.03 * e * k; }
    } },
  };

  function lifeNPC(e, dt, T) {
    if (e.kind !== 'npc' || e.companion || e.id === 'cat' || e.dead || e.hidden || e.dying) return;
    const c = Engine.cam, dx = c.x - e.x, dy = c.y - e.y, d2 = dx * dx + dy * dy;
    if (d2 > 16 * 16) return; // out of sight: nobody sees it
    const s = animSeed(e);
    o.sy = o.sx = o.lift = o.skew = 0;
    const talking = typeof DLG !== 'undefined' && DLG.ent === e && G.state === 'dialogue';
    const kk = Math.min(1, dt * 6);
    e._tfTalk = (e._tfTalk || 0) + ((talking ? 1 : 0) - (e._tfTalk || 0)) * kk;
    const talk = e._tfTalk, still = (e._spd || 0) < 0.25;
    // screen side of the speaker: lean toward the player's view axis
    const side = (e.x - c.x) * -Math.sin(c.dir) + (e.y - c.y) * Math.cos(c.dir) > 0 ? -1 : 1;

    if (talk > 0.01) {
      // phrases rise and fall; each stress lifts a hand (the figure widens and rises a
      // touch) and the head swings slowly toward and away from the listener
      const phrase = smooth(0.5 + 0.9 * Math.sin(T * 1.7 + s));
      const beat = Math.pow(Math.max(0, Math.sin(T * 4.4 + s * 1.3)), 2) * phrase;
      const turn = Math.sin(T * 0.8 + s) * 0.6 + 0.4;
      o.sy += 0.02 * beat * talk; o.sx += 0.014 * beat * talk; o.lift += 0.007 * beat * talk;
      o.skew += (0.022 * beat * (s > 3.14 ? 1 : -1) + 0.014 * turn * side) * talk;
      o.sx -= 0.035 * Math.abs(turn - 0.4) * talk;
    } else if (still && d2 < 4.5 * 4.5) {
      // a player close by: the head turns to take them in now and then
      e._tfNear = Math.min(1, (e._tfNear || 0) + dt * 2);
      const P = 4.5 + 3 * frac(s * 0.29), ph = T + s * 2.1, t = ph - Math.floor(ph / P) * P;
      if (t < 1.0) { const g = Math.sin(Math.PI * t) * e._tfNear; o.sx -= 0.07 * g; o.skew += 0.03 * g * side; o.lift += 0.003 * g; }
    } else e._tfNear = 0;

    // work loops: only while standing at the post, in working hours, and not talking
    const L = LOOPS[(G.mapId || '') + '|' + e.id];
    if (L && still) {
      const h = hourNow();
      const run = L.to > 24 ? (h >= L.from || h < L.to - 24) : (h >= L.from && h < L.to);
      e._tfWk = (e._tfWk || 0) + (((run ? 1 : 0) * (1 - talk)) - (e._tfWk || 0)) * Math.min(1, dt * 4);
      if (e._tfWk > 0.01) L.fn(T, s, e._tfWk, o);
    } else if (e._tfWk) e._tfWk = Math.max(0, e._tfWk - dt * 4);

    e.animSY += o.sy; e.animSX += o.sx; e.animLift += o.lift; e.animSkew += o.skew;
  }

  const _anim = animCreature;
  animCreature = function (e, dt, T) {
    _anim(e, dt, T);
    if (e.kind !== 'npc' || !enabled()) return;
    const t0 = TOWNSFOLK.timing ? performance.now() : 0;
    try { lifeNPC(e, dt, T); stats.calls++; } catch (err) { /* never break a frame */ }
    if (t0) TOWNSFOLK.ms += performance.now() - t0;
  };

  return { ROSTER, TAVERN_SLOTS, LOOPS, stateAt, hourNow, apply, attach, lifeNPC, stats, timing: false, ms: 0, enabled, WAIT_MAX };
})();
