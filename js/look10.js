// ============================================================
//  look10 — Phase 10 "the owner's picks", the LOOK team
//
//  1. Ground shadows: a soft dark disc on the floor under every enemy, NPC and companion that
//     stands on the ground. It is not a sprite: it is painted into the finished frame by a post hook
//     (before the fog and mist passes, so distance fades it) onto exactly the ground pixels whose
//     true world position falls inside the disc, which makes it follow the renderer's own depth and
//     relief for free: a wall in front hides it (the pixel is a wall pixel), a sprite in front hides
//     it, a slope or a step carries it (the ground height at the pixel is read from map.lvls/verts via
//     Engine's gAt), and water never gets one. Flat and relief maps share the same code.
//  2. Fight marks: blood splashes, scorch, sparks and cracks where blows landed and creatures fell.
//     Floor marks use the same ground pass (a cached 32x32 mask per variant, sampled in world space);
//     wall cracks and scorch reuse the seeded wall decals through the existing map.decals table (the
//     shared table is never touched: a private copy carries the marks and is dropped again on map
//     change). Marks live for the current visit of a map only (cleared in loadMap, never saved, never
//     put in G), are capped at 40, and the oldest fade away.
//  3. The per-area colour grades live in js/post.js (config.gradePresets / config.grade).
//
//  Everything here is a procedural STAND-IN for hand-painted art. Visual only: the module reads hp and
//  position and writes nothing the game saves or simulates (entity fields start with _l10), and it has
//  its own random generator so it never shifts the game's Math.random sequence.
//  GFX.groundShadows / GFX.fightMarks = false return before touching a pixel: the frame is the
//  original frame (the Original preset switches both off).
// ============================================================
'use strict';

if (typeof GFX !== 'undefined') {
  for (const k of ['groundShadows', 'fightMarks']) {
    if (GFX[k] === undefined) GFX[k] = true;
    if (GFX.FX && !GFX.FX.includes(k)) GFX.FX.push(k);
  }
}

const LOOK10 = (() => {
  const KEY = 'echoes-look10';
  const CAP = 40;            // most live marks on one map
  const SLOTS = CAP + 12;    // plus a few still fading out
  const FADE = 2.5;          // seconds an evicted mark takes to fade away
  const DRY = 420;           // seconds for a mark to settle to its dry strength (blood darkens, then dulls)

  const config = {
    shadow: {
      base: 0.33,        // outdoors: darkening at the centre in dim light
      sun: 0.33,         // ...plus this much more in full light
      indoor: 0.46,      // interiors: lit by lamps; the pixel-brightness term softens it in dark rooms
      fadeFar: 1.3,      // shadows fade out as distance approaches fogDist * this
      minR: 0.14, maxR: 1.0,
    },
    marks: { cap: CAP, fade: FADE },
  };

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // The module's own generator, so nothing here consumes the game's Math.random.
  let rs = 0x1badf00d;
  function rnd() { rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; return ((rs >>> 0) % 100000) / 100000; }
  const seeded = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s % 100000) / 100000; }; };

  // ------------------------------------------------------------------
  //  settings: GFX flags (presets own the defaults) with an optional stored override
  // ------------------------------------------------------------------
  const stored = { groundShadows: null, fightMarks: null };
  let mineChanging = false;
  function loadSettings() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && typeof o === 'object') for (const k in stored) if (typeof o[k] === 'boolean') stored[k] = o[k];
    } catch (e) { /* storage may be blocked: the flags keep their preset values */ }
    for (const k in stored) if (stored[k] !== null && typeof GFX !== 'undefined') GFX[k] = stored[k];
  }
  function saveSettings() { try { localStorage.setItem(KEY, JSON.stringify(stored)); } catch (e) { /* optional */ } }
  function setFlag(k, on) {
    mineChanging = true;
    try { GFX[k] = !!on; stored[k] = !!on; saveSettings(); GFX.changed(); } finally { mineChanging = false; }
  }

  // ------------------------------------------------------------------
  //  mark masks: 32x32 coverage (0..255), made once at load from seeded noise
  // ------------------------------------------------------------------
  const N = 32, HALF = (N - 1) / 2;
  function newMask() { return new Uint8Array(N * N); }
  // a ragged blob: radius R(theta) from a few sine terms, soft rim
  function blobMask(seed, base, wob, soft, drops, core) {
    const m = newMask(), r = seeded(seed);
    const p1 = r() * 6.28, p2 = r() * 6.28, p3 = r() * 6.28;
    const ds = [];
    for (let i = 0; i < drops; i++) ds.push([r() * 6.28, 0.62 + r() * 0.28, 0.05 + r() * 0.06]);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = (x - HALF) / HALF, v = (y - HALF) / HALF, d = Math.hypot(u, v), th = Math.atan2(v, u);
      const R = base + wob * (0.5 * Math.sin(2 * th + p1) + 0.35 * Math.sin(3 * th + p2) + 0.25 * Math.sin(5 * th + p3));
      let a = clamp((R - d) / soft, 0, 1);
      if (core) a = a * (1 - core + core * clamp(1.15 - d / R, 0, 1) * 1.1);
      for (const [dt, dd, dr] of ds) { const dx = u - Math.cos(dt) * dd, dy = v - Math.sin(dt) * dd; a = Math.max(a, clamp((dr - Math.hypot(dx, dy)) / 0.04, 0, 1)); }
      m[y * N + x] = (a * 255) | 0;
    }
    return m;
  }
  // soot: dense at the heart, stippled and streaked toward a ragged rim
  function sootMask(seed, base, streaks) {
    const m = newMask(), r = seeded(seed), p = [r() * 6.28, r() * 6.28, r() * 6.28];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = (x - HALF) / HALF, v = (y - HALF) / HALF, d = Math.hypot(u, v), th = Math.atan2(v, u);
      const R = base * (0.78 + 0.22 * Math.sin(3 * th + p[0]) + 0.14 * Math.sin(7 * th + p[1]) + (streaks ? 0.18 * Math.sin(11 * th + p[2]) : 0));
      let a = clamp(1 - d / R, 0, 1);
      a = Math.pow(a, 0.65);
      const h = ((Math.imul(x + 31 * seed, 374761393) ^ Math.imul(y + 17, 668265263)) >>> 0) / 4294967296;
      if (d / R > 0.6 && h < (d / R - 0.6) * 1.6) a = 0;   // ragged, stippled edge
      m[y * N + x] = (a * 235) | 0;
    }
    return m;
  }
  // a crack: a jagged dark fissure with a few branches, one pixel wide with a soft shoulder
  function crackMask(seed) {
    const m = newMask(), r = seeded(seed);
    const put = (x, y, v) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= N || y >= N) return; if (m[y * N + x] < v) m[y * N + x] = v; };
    const walk = (x, y, ang, len, depth) => {
      for (let i = 0; i < len; i++) {
        ang += (r() - 0.5) * 0.9; x += Math.cos(ang); y += Math.sin(ang);
        if (x < 0 || y < 0 || x >= N || y >= N) return;
        put(x, y, 255); put(x + 1, y, 120); put(x, y + 1, 120); if (depth === 0 && i < len * 0.5) put(x - 1, y, 90);
        if (depth < 2 && r() < 0.11) walk(x, y, ang + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.7), 5 + ((r() * 7) | 0), depth + 1);
      }
    };
    const arms = 3 + ((r() * 2) | 0);
    for (let i = 0; i < arms; i++) walk(HALF + (r() - 0.5) * 3, HALF + (r() - 0.5) * 3, (i / arms) * 6.28 + r() * 0.8, 11 + ((r() * 5) | 0), 0);
    return m;
  }
  // kind -> variants and colour treatment. mul darkens/colours the lit floor pixel; add is a faint
  // light-scaled tint so a mark stays readable on dark ground (scaled by the pixel's own brightness).
  const KINDS = {
    blood: { masks: [0, 1, 2, 3].map(i => blobMask(910 + i * 7, 0.42, 0.16, 0.10, 3 + (i & 1), 0)), mul: [0.46, 0.13, 0.12], add: [30, 2, 2], a: 0.85 },
    pool: { masks: [0, 1].map(i => blobMask(960 + i * 5, 0.64, 0.12, 0.16, 0, 0.35)), mul: [0.40, 0.11, 0.10], add: [26, 2, 2], a: 0.88 },
    scorch: { masks: [0, 1].map(i => sootMask(1010 + i * 9, 0.95, i === 1)), mul: [0.20, 0.19, 0.18], add: [0, 0, 0], a: 0.92 },
    spark: { masks: [0, 1].map(i => sootMask(1060 + i * 11, 0.7, false)), mul: [0.24, 0.22, 0.20], add: [10, 5, 0], a: 0.9 },
    crack: { masks: [0, 1, 2].map(i => crackMask(1110 + i * 13)), mul: [0.26, 0.25, 0.25], add: [0, 0, 0], a: 0.95 },
  };
  const KIND_IDS = Object.keys(KINDS);
  let maskBytes = 0;
  for (const k of KIND_IDS) for (const m of KINDS[k].masks) maskBytes += m.length;

  // ------------------------------------------------------------------
  //  the mark store: preallocated slots, one visit of one map
  // ------------------------------------------------------------------
  const slots = [];
  for (let i = 0; i < SLOTS; i++) slots.push({ on: false, kind: 'blood', v: 0, x: 0, y: 0, z: 0, r: 0.2, c: 1, s: 0, born: 0, seq: 0, dying: -1, wall: -1, name: null });
  let seq = 0, clockT = 0, marksMap = null, epoch = 1, wallDirty = false;
  const wallTable = {};          // cell index -> decal texture name, for the visit
  let wallCount = 0;

  function liveCount() { let n = 0; for (let i = 0; i < SLOTS; i++) if (slots[i].on && slots[i].dying < 0) n++; return n; }
  function totalCount() { let n = 0; for (let i = 0; i < SLOTS; i++) if (slots[i].on) n++; return n; }
  function releaseWall(s) {
    if (s.wall >= 0) { delete wallTable[s.wall]; wallCount--; s.wall = -1; wallDirty = true; }
  }
  function freeSlot() {
    for (let i = 0; i < SLOTS; i++) if (!slots[i].on) return slots[i];
    // all busy (a burst while others still fade): take the oldest of the fading ones, else the oldest overall
    let best = null;
    for (let i = 0; i < SLOTS; i++) { const s = slots[i]; if (s.dying >= 0 && (!best || s.seq < best.seq)) best = s; }
    if (!best) for (let i = 0; i < SLOTS; i++) { const s = slots[i]; if (!best || s.seq < best.seq) best = s; }
    releaseWall(best); best.on = false;
    return best;
  }
  function evictOldest() {
    let best = null;
    for (let i = 0; i < SLOTS; i++) { const s = slots[i]; if (s.on && s.dying < 0 && (!best || s.seq < best.seq)) best = s; }
    if (best) { best.dying = clockT; if (best.wall >= 0) { releaseWall(best); best.on = false; } }   // a wall decal cannot fade: it just goes
  }
  function groundZ(m, x, y) {
    if (!m || !(m.lvls || m.verts) || !GROUND) return 0;
    const cx = clamp(x | 0, 0, m.w - 1), cy = clamp(y | 0, 0, m.h - 1);
    return GROUND(x, y, cx, cy);
  }
  let GROUND = null;   // Engine's gAt, handed to hooks each frame
  function mapNow() { return typeof G !== 'undefined' ? G.map : null; }

  function addMark(kind, x, y, r, variant) {
    const K = KINDS[kind]; if (!K) return null;
    const m = mapNow();
    if (marksMap && m && marksMap !== m) clearMarks();
    marksMap = m || marksMap;
    while (liveCount() >= config.marks.cap) evictOldest();
    const s = freeSlot();
    s.on = true; s.kind = kind; s.v = variant == null ? ((rnd() * K.masks.length) | 0) % K.masks.length : variant % K.masks.length;
    s.x = x; s.y = y; s.z = groundZ(m, x, y); s.r = r; s.c = Math.cos(rnd() * 6.283); s.s = Math.sqrt(Math.max(0, 1 - s.c * s.c)) * (rnd() < 0.5 ? -1 : 1);
    s.born = clockT; s.seq = ++seq; s.dying = -1; s.wall = -1; s.name = null;
    return s;
  }
  // a cracked or scorched wall face: rides on the seeded decal table (private copy, only where no seeded mark sits)
  function addWallMark(kind, cx, cy) {
    const m = mapNow(); if (!m || typeof DECALS === 'undefined' || !m.cells) return null;
    if (cx < 0 || cy < 0 || cx >= m.w || cy >= m.h) return null;
    const ci = cy * m.w + cx, c = m.cells[ci];
    if (!c || c.door) return null;
    const base = (GFX.decals && m._decalsAll) ? m._decalsAll : null;
    if ((base && base[ci]) || wallTable[ci]) return null;
    if (marksMap && marksMap !== m) clearMarks();
    marksMap = m;
    while (liveCount() >= config.marks.cap) evictOldest();
    const names = DECALS.names[kind === 'scorch' ? 'scorch' : 'crack'];
    const s = freeSlot();
    s.on = true; s.kind = 'wall'; s.wall = ci; s.name = names[(rnd() * names.length) | 0]; s.born = clockT; s.seq = ++seq; s.dying = -1;
    wallTable[ci] = s.name; wallCount++; wallDirty = true;
    syncWalls();
    return s;
  }
  function syncWalls() {
    const m = marksMap; wallDirty = false;
    if (!m || m !== mapNow()) return;
    if (!wallCount) { if (m._l10dec) { m._l10dec = null; if (typeof DECALS !== 'undefined') DECALS.sync(m); } return; }
    const base = (GFX.decals && m._decalsAll) ? m._decalsAll : null;
    const t = {}; if (base) for (const k in base) t[k] = base[k];
    for (const k in wallTable) t[k] = wallTable[k];
    m.decals = t; m._l10dec = t;
  }
  function clearMarks() {
    for (let i = 0; i < SLOTS; i++) { slots[i].on = false; slots[i].wall = -1; slots[i].dying = -1; }
    for (const k in wallTable) delete wallTable[k];
    const m = marksMap, had = wallCount > 0 || (m && m._l10dec);
    wallCount = 0; wallDirty = false;
    if (m && had) { m._l10dec = null; try { if (typeof DECALS !== 'undefined') DECALS.sync(m); } catch (e) { /* the map is being left anyway */ } }
    marksMap = null; epoch++;
  }
  function sweepFaded() {
    for (let i = 0; i < SLOTS; i++) { const s = slots[i]; if (s.on && s.dying >= 0 && clockT - s.dying >= config.marks.fade) s.on = false; }
  }

  // ------------------------------------------------------------------
  //  what counts as what
  // ------------------------------------------------------------------
  const NONE_TYPES = new Set(['quiet', 'mites', 'hushmoth', 'drowned', 'dirge']);
  const CONSTRUCT_TYPES = new Set(['golem', 'aegis', 'horn', 'warden', 'requiem']);
  const HEAVY_TYPES = new Set(['golem', 'aegis', 'pressman', 'warden']);
  // 'none': leaves nothing (the Quiet, the Hush's moths, swarms, Hollows and the drowned);
  // 'spark': constructs and glass-cored men (sparks and scorch, never blood); 'blood': everything else
  function classify(e) {
    const d = (e && e.def) || {}, t = (e && e.type) || '';
    if (!e || d.quiet || d.hushkin || d.moth || NONE_TYPES.has(t) || e.sprite === 'hollow' || e.sprite === 'ln17_hollow') return 'none';   // ln17_hollow: the Long Night's Hollow (js/longnight17.js)
    if (d.core || CONSTRUCT_TYPES.has(t)) return 'spark';
    return 'blood';
  }
  // shadow: 0 = none, otherwise the strength factor (1 solid, less for ghosts)
  const NO_SHADOW_SPRITES = new Set(['hushmoth', 'mites', 'quiet', 'dirge']);
  function shadowOf(e) {
    if (!e || e.hidden || e.dead || e.corpse) return 0;
    if (e.kind !== 'enemy' && e.kind !== 'npc') return 0;
    const d = e.def || {};
    if (d.quiet || d.hushkin || d.moth || NO_SHADOW_SPRITES.has(e.sprite) || NO_SHADOW_SPRITES.has(e.type)) return 0;
    if ((e.yOff || 0) < 0 || (d.yOff || 0) < 0) return 0;          // flying things do not touch the ground
    if (e.sprite === 'hollow' || e.sprite === 'ln17_hollow' || e.type === 'drowned') return 0.35;  // ghost-like: a faint one
    return 1;
  }

  // ------------------------------------------------------------------
  //  scene scan: new hits and deaths become marks
  // ------------------------------------------------------------------
  let frameNo = 0, songFrame = -99, songSear = false, songShatter = false;
  function scanFights() {
    if (typeof G === 'undefined' || !G.ents) return;
    const ents = G.ents, cam = Engine.cam;
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (!e || e.kind !== 'enemy') continue;
      if (e._l10e !== epoch) { e._l10e = epoch; e._l10hp = e.hp; e._l10dead = !!e.dead; continue; }   // first sight of this one (or marks were switched back on): no marks for the past
      if (e.dead) { if (!e._l10dead) { e._l10dead = true; onFall(e); } continue; }
      const hp = e.hp;
      // a hit is hp lost by something that is awake to the fight (a blow wakes it, see attack()) or lost to a Song
      // this very moment; hp edited behind a quiet creature's back (scripts, tests, scaling) leaves no mark
      if (hp < e._l10hp - 0.01 && ((e.state !== 'idle' && e.state !== 'passive') || songNow('sear') || songNow('shatter'))) onHit(e, e._l10hp - hp, cam);
      e._l10hp = hp;
    }
  }
  function songNow(kind) { return frameNo - songFrame <= 3 && (kind === 'sear' ? songSear : songShatter); }
  function away(e, cam) {   // unit vector from the player toward the struck creature
    let dx = e.x - cam.x, dy = e.y - cam.y; const d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d];
  }
  function onHit(e, dmg, cam) {
    const kind = classify(e); if (kind === 'none') return;
    const [ux, uy] = away(e, cam);
    if (songNow('sear')) { addMark('scorch', e.x + ux * 0.12, e.y + uy * 0.12, 0.26 + rnd() * 0.12); return; }
    if (songNow('shatter')) {
      addMark('crack', e.x, e.y, 0.34 + rnd() * 0.12);
      if (rnd() < 0.5) wallBehind(e.x, e.y, ux, uy, 'crack');
      return;
    }
    const heavy = typeof G !== 'undefined' && G.attack && G.attack.t > 0 && G.attack.dur - G.attack.t < 0.4 && typeof currentWeapon === 'function' && currentWeapon().blunt;
    if (heavy && rnd() < 0.6) { addMark('crack', e.x + ux * 0.1, e.y + uy * 0.1, 0.3 + rnd() * 0.12); if (rnd() < 0.3) wallBehind(e.x, e.y, ux, uy, 'crack'); }
    if (kind === 'blood') { if (rnd() < 0.8) addMark('blood', e.x + ux * (0.18 + rnd() * 0.18) + (rnd() - 0.5) * 0.12, e.y + uy * (0.18 + rnd() * 0.18) + (rnd() - 0.5) * 0.12, 0.10 + Math.min(0.08, dmg * 0.006) + rnd() * 0.05); }
    else if (rnd() < 0.7) addMark('spark', e.x + ux * 0.14, e.y + uy * 0.14, 0.09 + rnd() * 0.06);
  }
  function onFall(e) {
    const kind = classify(e); if (kind === 'none') return;
    if (songNow('sear')) { addMark('scorch', e.x, e.y, 0.34 + rnd() * 0.12); return; }
    if (kind === 'blood') addMark('pool', e.x, e.y, 0.26 + 0.08 * Math.min(1.6, e.scale || 1) + rnd() * 0.06);
    else addMark('scorch', e.x, e.y, 0.28 + 0.08 * Math.min(1.6, e.scale || 1) + rnd() * 0.06, 1);
  }
  // a wall within a pace and a half beyond a point, along (ux,uy): crack or scorch its face
  function wallBehind(x, y, ux, uy, kind) {
    const m = mapNow(); if (!m) return;
    for (let t = 0.5; t <= 1.6; t += 0.3) {
      const cx = (x + ux * t) | 0, cy = (y + uy * t) | 0;
      if (cx < 0 || cy < 0 || cx >= m.w || cy >= m.h) return;
      const c = m.cells[cy * m.w + cx];
      if (c) { if (!c.door) addWallMark(kind, cx, cy); return; }
    }
  }
  // a heavy creature's blow lands where the player stands: crack the floor between them and maybe the wall behind
  function onPlayerHit(dmg, src) {
    if (typeof G === 'undefined' || !G.ents) return;
    const cam = Engine.cam; let best = null, bd = 9;
    for (let i = 0; i < G.ents.length; i++) {
      const e = G.ents[i];
      if (!e || e.kind !== 'enemy' || e.dead || e.hidden || !e.def || e.def.name !== src) continue;
      const d = Math.hypot(e.x - cam.x, e.y - cam.y); if (d < bd) { bd = d; best = e; }
    }
    if (!best || !HEAVY_TYPES.has(best.type)) return;
    const dx = cam.x - best.x, dy = cam.y - best.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    const px = best.x + ux * Math.min(d * 0.85, (best.def.reach || 1.2)), py = best.y + uy * Math.min(d * 0.85, (best.def.reach || 1.2));
    addMark('crack', px, py, 0.36 + rnd() * 0.12);
    if (rnd() < 0.5) wallBehind(cam.x, cam.y, ux, uy, 'crack');
  }

  // ------------------------------------------------------------------
  //  the ground pass
  // ------------------------------------------------------------------
  // bounding box of a floor disc of radius r at (ex,ey,ez), in frame pixels; false if it cannot show
  let bx0 = 0, bx1 = 0, by0 = 0, by1 = 0, bTrY = 0;
  function bbox(F, ex, ey, ez, r) {
    const cam = F.cam, sx = ex - cam.x, sy = ey - cam.y;
    const inv = 1 / (F.planeX * F.dirY - F.dirX * F.planeY);
    const trX = inv * (F.dirY * sx - F.dirX * sy), trY = inv * (-F.planeY * sx + F.planeX * sy);
    if (trY < 0.2 || trY > F.fogDist * 1.4) return false;
    const dz = F.relief ? cam.z - ez : cam.z;   // flat ground sits at 0
    if (dz < 0.05) return false;
    const w = F.w, h = F.h, tn = Math.max(0.12, trY - r * 1.1), tf = trY + r * 1.1;
    const yHi = F.horizon + h * dz / tn, yLo = F.horizon + h * dz / tf;
    const margin = F.relief ? 3 + ((r * 1.3 * h / trY) | 0) : 2;
    by0 = Math.max(0, Math.floor(yLo - margin)); by1 = Math.min(h - 1, Math.ceil(yHi + margin));
    const cxs = (w / 2) * (1 + trX / trY), half = (w / 2) * (r * 1.15) / (0.66 * tn);
    bx0 = Math.max(0, Math.floor(cxs - half)); bx1 = Math.min(w - 1, Math.ceil(cxs + half));
    bTrY = trY;
    return by1 >= by0 && bx1 >= bx0;
  }
  const FALL_N = 64;
  const fallLit = new Float32Array(FALL_N + 1), fallDark = new Float32Array(FALL_N + 1);
  for (let i = 0; i <= FALL_N; i++) { const u = 1 - i / FALL_N; fallLit[i] = Math.pow(u, 1.25); fallDark[i] = Math.pow(u, 2.3); }

  const stats = { shadows: 0, marks: 0, pixels: 0, ms: 0, calls: 0 };
  let profile = false;

  // is pixel (x,y) of the frame the ground at world point (wx,wy), at about height ez?
  function groundOk(F, o, y, t, wx, wy, ez, tol) {
    const m = F.map, cx = wx | 0, cy = wy | 0;
    if (wx < 0 || wy < 0 || cx >= m.w || cy >= m.h) return false;
    const gz = F.gAt(wx, wy, cx, cy);
    const zp = F.cam.z - (y - F.horizon) * t / F.h;
    return Math.abs(zp - gz) <= 0.1 + 1.6 * t / F.h && Math.abs(gz - ez) <= tol;
  }

  function drawMarks(F) {
    const w = F.w, h = F.h, fb = F.fb, dbuf = F.dbuf, mbuf = F.mbuf, bias = F.surfBias == null ? 0.45 : F.surfBias;
    const cam = F.cam, camx = cam.x, camy = cam.y, dirX = F.dirX, dirY = F.dirY, planeX = F.planeX, planeY = F.planeY, relief = F.relief;
    for (let i = 0; i < SLOTS; i++) {
      const s = slots[i];
      if (!s.on || s.wall >= 0) continue;
      let alpha = 1;
      if (s.dying >= 0) alpha = 1 - (clockT - s.dying) / config.marks.fade;
      if (alpha <= 0.01) continue;
      const K = KINDS[s.kind];
      // fresh blood is wetter and darker; it dries to a dull stain
      const age = clockT - s.born;
      let strength = K.a * alpha;
      if (s.kind === 'blood' || s.kind === 'pool') strength *= 1 - 0.28 * clamp(age / DRY, 0, 1);
      if (!bbox(F, s.x, s.y, s.z, s.r)) continue;
      stats.marks++;
      const mask = K.masks[s.v], mr = K.mul[0], mg = K.mul[1], mb = K.mul[2], ar = K.add[0] / 255, ag = K.add[1] / 255, ab = K.add[2] / 255;
      const ir = 1 / s.r, c = s.c, sn = s.s, ex = s.x, ey = s.y, ez = s.z;
      for (let y = by0; y <= by1; y++) {
        let o = y * w + bx0;
        for (let x = bx0; x <= bx1; x++, o++) {
          if (mbuf[o] !== 5) continue;
          const t = dbuf[o] - bias, cx = 2 * x / w - 1;
          const wx = camx + t * (dirX + planeX * cx), wy = camy + t * (dirY + planeY * cx);
          const dx = wx - ex, dy = wy - ey;
          const u = (dx * c + dy * sn) * ir, v = (-dx * sn + dy * c) * ir;
          if (u < -1 || u > 1 || v < -1 || v > 1) continue;
          const cov = mask[(((v + 1) * HALF) | 0) * N + (((u + 1) * HALF) | 0)];
          if (cov === 0) continue;
          if (relief && !groundOk(F, o, y, t, wx, wy, ez, 0.62)) continue;
          const a = (cov / 255) * strength;
          const px = fb[o], r = px & 255, g = (px >> 8) & 255, b = (px >> 16) & 255;
          const lf = ((r * 77 + g * 150 + b * 29) >> 8);
          const nr = r + a * (r * mr + ar * lf - r), ng = g + a * (g * mg + ag * lf - g), nb = b + a * (b * mb + ab * lf - b);
          fb[o] = (px & 0xff000000) | ((nb < 0 ? 0 : nb > 255 ? 255 : nb | 0) << 16) | ((ng < 0 ? 0 : ng > 255 ? 255 : ng | 0) << 8) | (nr < 0 ? 0 : nr > 255 ? 255 : nr | 0);
          stats.pixels++;
        }
      }
    }
  }

  function drawShadows(F) {
    const list = F.sprList; if (!list) return;
    const w = F.w, h = F.h, fb = F.fb, dbuf = F.dbuf, mbuf = F.mbuf, bias = F.surfBias == null ? 0.45 : F.surfBias, S = F.S || 1;
    const cam = F.cam, camx = cam.x, camy = cam.y, dirX = F.dirX, dirY = F.dirY, planeX = F.planeX, planeY = F.planeY, relief = F.relief, c = config.shadow;
    const m = F.map, sunK = F.outdoor ? c.base + c.sun * Math.min(1, clamp(F.light, 0.2, 1.2)) : c.indoor;
    const wxK = F.wx ? (1 - 0.55 * clamp(F.wx.haze / 0.6, 0, 1)) * (1 - 0.3 * F.wx.cloud) : 1;   // overcast air throws a weaker shadow
    const fogD = Math.max(4, F.fogDist);
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const sk = shadowOf(e); if (sk === 0) continue;
      const alpha = e.animAlpha == null ? 1 : e.animAlpha; if (alpha <= 0.02) continue;
      const sp = (typeof Engine !== 'undefined' && Engine.sprites[e.animSprite || e.sprite]) || null; if (!sp) continue;
      const scale = e.scale || 1, hw = scale * (sp.hs || 1);
      let r = clamp(0.5 * hw * sp.w / sp.h * 1.2 + 0.1 * hw, c.minR, c.maxR);
      const scx = clamp(e.x | 0, 0, m.w - 1), scy = clamp(e.y | 0, 0, m.h - 1);
      const ez = relief ? F.gAt(e.x, e.y, scx, scy) : 0;
      if (!bbox(F, e.x, e.y, ez, r * 1.3)) continue;
      const d = bTrY, fade = clamp(c.fadeFar - d / fogD, 0, 1); if (fade <= 0.02) continue;
      // brightness of the ground just in front of its feet: dark rooms get a softer, weaker shadow
      let lum = 110;
      { const fy = clamp(Math.round(F.horizon + h * (relief ? cam.z - ez : cam.z) / d) + 2 * S, 0, h - 1), inv = 1 / (F.planeX * F.dirY - F.dirX * F.planeY), sx = e.x - camx, sy = e.y - camy;
        const fx = clamp(Math.round((w / 2) * (1 + inv * (F.dirY * sx - F.dirX * sy) / d)), 0, w - 1), px0 = fb[fy * w + fx];
        if (mbuf[fy * w + fx] === 5) lum = ((px0 & 255) * 77 + ((px0 >> 8) & 255) * 150 + ((px0 >> 16) & 255) * 29) >> 8; }
      const soft = 1 - clamp(lum / 70, 0, 1);               // 0 on lit ground, 1 in the dark
      const rr = r * (1 + 0.3 * soft), ir2 = 1 / (rr * rr), fall = soft > 0.5 ? fallDark : fallLit;
      const k = sunK * wxK * fade * sk * alpha * (0.4 + 0.6 * (1 - soft * 0.75));
      const ex = e.x, ey = e.y;
      stats.shadows++;
      for (let y = by0; y <= by1; y++) {
        let o = y * w + bx0;
        for (let x = bx0; x <= bx1; x++, o++) {
          if (mbuf[o] !== 5) continue;
          const t = dbuf[o] - bias, cx = 2 * x / w - 1;
          const wx = camx + t * (dirX + planeX * cx) - ex, wy = camy + t * (dirY + planeY * cx) - ey;
          const q = (wx * wx + wy * wy) * ir2;
          if (q >= 1) continue;
          if (relief && !groundOk(F, o, y, t, wx + ex, wy + ey, ez, 0.3)) continue;
          const px = fb[o], r0 = px & 255, g0 = (px >> 8) & 255, b0 = (px >> 16) & 255;
          // brighter pixels take more shadow, so a dim floor is not crushed to black
          const pl = (r0 * 77 + g0 * 150 + b0 * 29) >> 8;
          const ia = (k * fall[(q * FALL_N) | 0] * (0.62 + 0.38 * Math.min(1, pl / 80)) * 256) | 0;
          if (ia <= 0) continue;
          // the sun is what a shadow takes away, so red goes first and blue least
          fb[o] = (px & 0xff000000) | (((b0 * (256 - ia + (ia >> 3))) >> 8) << 16) | (((g0 * (256 - ia + (ia >> 5))) >> 8) << 8) | ((r0 * (256 - ia)) >> 8);
          stats.pixels++;
        }
      }
    }
  }

  function pass(F) {
    const sh = !!GFX.groundShadows, mk = !!GFX.fightMarks;
    if (!sh && !mk) return;
    if (!F.dbuf || !F.mbuf || !F.map || !F.gAt) return;
    const t0 = profile ? now() : 0;
    frameNo++; clockT = F.animT || clockT; GROUND = F.gAt;
    if (marksMap && marksMap !== F.map) clearMarks();
    stats.shadows = stats.marks = stats.pixels = 0;
    if (mk) {
      scanFights(); sweepFaded();
      if (wallDirty) syncWalls();
      if (totalCount() > 0) drawMarks(F);
    }
    if (sh) drawShadows(F);
    if (profile) { stats.ms = now() - t0; stats.calls++; }
  }

  // ------------------------------------------------------------------
  //  wiring: the hook, the wrapped game functions, Options rows
  // ------------------------------------------------------------------
  function wire() {
    if (typeof Engine !== 'undefined' && Engine.addPostHook) Engine.addPostHook(pass, 4);   // after dark-interiors (-5), before soft fog (10), mist (20), water (25), bloom (30), grade (40)
    if (typeof loadMap === 'function') {
      const _loadMap = loadMap;
      loadMap = function () { try { clearMarks(); } catch (e) { console.warn('look10 clear failed', e); } return _loadMap.apply(this, arguments); };
    }
    if (typeof executeCustomSong === 'function') {
      const _song = executeCustomSong;
      executeCustomSong = function (s) {
        try { const ef = (s && s.effects) || []; songSear = ef.indexOf('sear') >= 0; songShatter = ef.indexOf('shatter') >= 0; songFrame = frameNo; } catch (e) { /* attribution only */ }
        return _song.apply(this, arguments);
      };
    }
    if (typeof damagePlayer === 'function') {
      const _dp = damagePlayer;
      damagePlayer = function (dmg, src) {
        const r = _dp.apply(this, arguments);
        try { if (GFX.fightMarks) onPlayerHit(dmg, src); } catch (e) { console.warn('look10 blow failed', e); }
        return r;
      };
    }
    if (typeof GFX !== 'undefined') GFX.onChange(() => {
      // switched off: the marks go (and the wall decals return to the seeded set); back on: start clean
      if (!GFX.fightMarks) clearMarks();          // (also forgets every hp baseline, so nothing that happened while off appears later)
      else if (wallCount) syncWalls();
      if (!mineChanging) for (const k in stored) if (stored[k] !== null && GFX[k] !== stored[k]) { stored[k] = null; saveSettings(); }   // a preset or plain() took over: stop overriding it
    });
    if (typeof renderAccessibilityMenu === 'function') {
      const _acc = renderAccessibilityMenu;
      renderAccessibilityMenu = function () {
        const r = _acc.apply(this, arguments);
        try { appendRows(); } catch (e) { console.warn('look rows failed', e); }
        return r;
      };
    }
  }
  function el(tag, props, text) {
    const e = document.createElement(tag);
    if (props) for (const k in props) { if (k === 'style') e.style.cssText = props[k]; else e.setAttribute(k, props[k]); }
    if (text != null) e.textContent = text;
    return e;
  }
  function appendRows() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById('look-shadows')) return;
    const row = (label, hint) => { const s = el('span', { class: 'gfx-label' }, label); s.appendChild(document.createTextNode(' ')); s.appendChild(el('small', { class: 'muted' }, hint)); return s; };
    const mk = (id, flag, aria) => {
      const b = el('button', { class: 'dfbtn small', id, type: 'button' }, '');
      b.setAttribute('aria-label', aria);
      const sync = () => { b.textContent = GFX[flag] ? 'On' : 'Off'; b.setAttribute('aria-pressed', GFX[flag] ? 'true' : 'false'); b.classList.toggle('sel', !!GFX[flag]); };
      b.onclick = () => { setFlag(flag, !GFX[flag]); sync(); };
      sync(); return b;
    };
    grid.appendChild(row('Ground shadows', 'a soft shadow under people and creatures'));
    grid.appendChild(mk('look-shadows', 'groundShadows', 'Ground shadows'));
    grid.appendChild(row('Fight marks', 'blood, scorch and cracks, for this visit only'));
    grid.appendChild(mk('look-marks', 'fightMarks', 'Fight marks'));
  }

  loadSettings();
  wire();
  return {
    config, stats, classify, shadowOf, KINDS, maskBytes, appendRows, setFlag, stored,
    get profile() { return profile; }, set profile(v) { profile = !!v; },
    marks: {
      add: addMark, addWall: addWallMark, clear: clearMarks, live: liveCount, total: totalCount, slots, wall: wallTable,
      get cap() { return config.marks.cap; }, set cap(v) { config.marks.cap = Math.max(1, Math.min(CAP, v | 0)); },
      scan: scanFights, onPlayerHit, get now() { return clockT; }, tick(t) { clockT = t; sweepFaded(); },
    },
    pass,
  };
})();
if (typeof window !== 'undefined') window.LOOK10 = LOOK10;
