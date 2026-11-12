// ============================================================
//  doors — Phase 3 module: swinging doors, lifting chest lids, pulled levers
//  All art here is procedural stand-in work (cut and rotated from the existing
//  chest and lever sprites); final painted frames can replace it later.
//
//  Doors: a door leaf swings about a hinge on one edge of its cell. Collision,
//  portals, locks and the open threshold are untouched (they read d.open);
//  only the picture changes. The engine's two door branches call Doors.swing().
//    - hinge: on the low or high edge of the cell, fixed per door (parity of the
//      cell), so a row of doors does not all hang the same way
//    - swing side: AWAY from whoever opened it. It is chosen from the camera the
//      first frame the door is seen opening and kept until the door shuts
//    - the leaf is length 1 and turns open*90 degrees about the hinge; the part of
//      a fully swung leaf that would poke into the neighbouring cell is clipped to
//      the door's own cell (the engine walks cell by cell)
//  GFX.swingDoors = false restores the original sliding leaf exactly.
// ============================================================
'use strict';

if (GFX.swingDoors === undefined) GFX.swingDoors = true;       // swinging leaf instead of the sliding one
if (GFX.propAnims === undefined) GFX.propAnims = true;         // lifting chest lids and pulled levers

const Doors = (() => {
  const out = { t: 0, u: 0, side: 0 };   // result of swing(), read by the engine (no allocation per column)
  const HALF_PI = Math.PI / 2;

  // Which way does the doorway run? 1: walls north and south (plane x = cell + 0.5),
  // 2: walls east and west (plane y = cell + 0.5), 0: unclear, keep the sliding leaf.
  function orient(d, grid, mw, ci) {
    const n = grid[ci - mw], s = grid[ci + mw], wst = grid[ci - 1], e = grid[ci + 1];
    if (n && s && !(wst && e)) return 1;
    if (wst && e && !(n && s)) return 2;
    return 0;
  }

  // Intersect a ray with the swung leaf of door d in cell (mx, my).
  // Returns 0: not applicable (use the sliding leaf), 1: the ray misses the leaf,
  // 2: hit, with out.t (ray parameter = perpendicular depth), out.u (texture
  // coordinate along the closed leaf) and out.side (shading side).
  function swing(d, mx, my, cx, cy, rdx, rdy, grid, mw) {
    if (!GFX.swingDoors || !d || !(d.open > 0)) return 0;
    if (d._or === undefined) {
      d._or = orient(d, grid, mw, my * mw + mx);
      d._hg = ((mx * 3 + my * 5) & 1);
    }
    const or = d._or; if (!or) return 0;
    if (!d._sw) d._sw = (or === 1 ? cx < mx + 0.5 : cy < my + 0.5) ? 1 : -1;   // away from the viewer who opened it
    const th = d.open * HALF_PI, sn = Math.sin(th), cs = Math.cos(th), hg = d._hg, s = d._sw;
    let Hx, Hy, Lx, Ly;
    if (or === 1) { Hx = mx + 0.5; Hy = my + hg; Lx = s * sn; Ly = (hg ? -cs : cs); }
    else { Hx = mx + hg; Hy = my + 0.5; Lx = (hg ? -cs : cs); Ly = s * sn; }
    const Dx = Hx - cx, Dy = Hy - cy, det = Lx * rdy - rdx * Ly;
    if (det > -1e-9 && det < 1e-9) return 1;
    const t = (Lx * Dy - Ly * Dx) / det, tau = (rdx * Dy - rdy * Dx) / det;
    if (t <= 0.01 || tau < 0 || tau > 1) return 1;
    const px = cx + t * rdx, py = cy + t * rdy;
    if (px < mx - 1e-4 || px > mx + 1 + 1e-4 || py < my - 1e-4 || py > my + 1 + 1e-4) return 1;   // clipped to the cell
    out.t = t; out.u = hg ? 1 - tau : tau; out.side = or === 1 ? 0 : 1;
    return 2;
  }

  // ---------------------------------------------------------------- props
  const FRAMES = 8;
  const cache = {};                       // sprite name -> [frames]
  const ease = p => p * p * (3 - 2 * p);
  const clone = sp => ({ w: sp.w, h: sp.h, hs: sp.hs, cx: sp.cx, dy: sp.dy, data: new Uint32Array(sp.data.length) });

  // Chest: the shipped art is an OPEN chest. Frame 0 is a closed one, made by laying
  // the lid band (the rows above LID_SRC) down over the body and covering the
  // contents; the last frame is the original open art, so a lifted lid is exactly
  // what the game always showed. In between the lid's bottom edge climbs from
  // the rim (CLOSED_AT) to its open position while the band un-squashes.
  function chestFrames(name) {
    if (cache[name + '~chest']) return cache[name + '~chest'];
    const base = Engine.sprites[name]; if (!base) return null;
    const W = base.w, H = base.h, LID_SRC = Math.round(H * 0.40), CLOSED_AT = Math.round(H * 0.53);
    const list = [];
    for (let i = 0; i < FRAMES; i++) {
      const p = ease(i / (FRAMES - 1)), sp = clone(base), D = sp.data, S = base.data;
      if (i === FRAMES - 1) { D.set(S); list.push(sp); continue; }
      const anchor = CLOSED_AT - (CLOSED_AT - (LID_SRC - 1)) * p, sc = 0.8 + 0.2 * p;
      const top = Math.ceil(anchor);
      D.set(S.subarray(top * W), top * W);            // body and, as the lid rises, the contents
      for (let y = 0; y < LID_SRC; y++) {
        const ty = Math.round(anchor - (LID_SRC - 1 - y) * sc);
        if (ty < 0 || ty >= H) continue;
        for (let x = 0; x < W; x++) {
          const px = S[y * W + x];
          if ((px >>> 24) > 100) D[ty * W + x] = px;
        }
      }
      list.push(sp);
    }
    // register once so the engine can look the frames up by name
    list.forEach((sp, i) => Engine.addSprite(name + '~lid' + i, sp));
    return (cache[name + '~chest'] = list);
  }

  // Lever: the handle above the housing swings about its pivot.
  function leverFrames(name) {
    if (cache[name + '~lever']) return cache[name + '~lever'];
    const base = Engine.sprites[name]; if (!base) return null;
    const W = base.w, H = base.h, S = base.data;
    const PX = Math.round(W * 0.5), PY = Math.round(H * 0.34), X0 = Math.round(W * 0.3), X1 = Math.round(W * 0.7);
    const list = [];
    for (let i = 0; i < FRAMES; i++) {
      const a = (i / (FRAMES - 1)) * 0.62, sp = clone(base), D = sp.data;      // up to ~35 degrees
      if (i === 0) { D.set(S); list.push(sp); continue; }
      D.set(S);
      for (let y = 0; y < PY; y++) for (let x = X0; x < X1; x++) D[y * W + x] = 0;        // lift the handle off
      const ca = Math.cos(a), sa = Math.sin(a);
      for (let y = 0; y < PY + 6; y++) for (let x = 0; x < W; x++) {
        // inverse-rotate each destination pixel back into the source handle
        const dx = x - PX, dy = y - PY;
        const sx = Math.round(PX + dx * ca - dy * sa), sy = Math.round(PY + dx * sa + dy * ca);
        if (sx < X0 || sx >= X1 || sy < 0 || sy >= PY) continue;
        const px = S[sy * W + sx];
        if ((px >>> 24) > 100) D[y * W + x] = px;
      }
      list.push(sp);
    }
    list.forEach((sp, i) => Engine.addSprite(name + '~pull' + i, sp));
    return (cache[name + '~lever'] = list);
  }

  // ---------------------------------------------------------------- state
  let clock = 0, lastNow = 0;
  const pulls = [];           // { e, t0 } levers mid-pull
  let watchEnts = null, watchLen = -1, watched = [];
  const PULL_IN = 0.3, PULL_HOLD = 0.25, PULL_OUT = 0.3, LID_T = 0.4;

  function pullFrame(age) {
    const p = age < PULL_IN ? age / PULL_IN : age < PULL_IN + PULL_HOLD ? 1 : 1 - (age - PULL_IN - PULL_HOLD) / PULL_OUT;
    return Math.max(0, Math.min(FRAMES - 1, Math.round(ease(Math.max(0, Math.min(1, p))) * (FRAMES - 1))));
  }
  function startPull(e) {
    if (!e || e.sprite !== 'lever' || !GFX.propAnims) return;
    for (const q of pulls) if (q.e === e) return;
    pulls.push({ e, t0: clock });
  }
  function lidOpen(e, instant) { if (!e._lidT) e._lidT = instant ? -1e9 : clock; }
  function frameName(name, kind, i) { return name + '~' + kind + i; }

  // One pass over the map's entities when the list changes: which are chests.
  function rescan() {
    watchEnts = G.ents; watchLen = G.ents.length; watched = [];
    for (const e of G.ents) {
      if (e.sprite === 'chest' && (e._doorsLid || (e.kind === 'item' && e.item === 'cache') || (e.kind === 'deco' && e.use === 'prison_evidence'))) watched.push(e);
    }
    // looted strongboxes keep their open chest: transient companions are lost with the map, so make them again
    for (const e of watched.slice()) if (e.kind === 'item' && e.dead) ensureOpen(e);
  }
  function companion(e) {
    const c = hydrate({ kind: 'deco', sprite: 'chest', x: e.x, y: e.y, scale: e.scale, yOff: e.yOff || 0, solid: false, transient: true, label: 'An opened strongbox', _doorsLid: true, _src: e });
    c._lidT = e._lidT; e._comp = c; G.ents.push(c); watchLen = G.ents.length; watched.push(c);
    return c;
  }
  // a chest has just been seen open: a lid seen closed a moment ago lifts, one found open (a restored save) stays up
  function ensureOpen(e) {
    if (!e._lidT) e._lidT = e._seenClosed ? clock : -1e9;
    if (e.kind === 'item' && (!e._comp || G.ents.indexOf(e._comp) < 0)) companion(e);
  }
  function chestOpen(e) {
    if (e._doorsLid) return true;
    if (e.kind === 'item') return !!e.dead;   // looted strongboxes are hidden and dead: saved with the map
    // evidence chest: open once the lock is picked or the belongings come back
    let ev = false; try { ev = !!crimeState().evidence; } catch (err) { /* no law state yet */ }
    if (ev) e._evHad = true;
    return !!(G.flags && G.flags[EVIDENCE_KEY]) || (e._evHad && !ev);
  }

  function sync(dt) {
    clock += dt;
    if (!G.ents || !G.map) return;
    const doors = G.map.doors;
    if (doors) for (const k in doors) { const d = doors[k]; if (d._sw && !(d.open > 0) && !(d.target > 0)) d._sw = 0; }
    if (watchEnts !== G.ents || watchLen !== G.ents.length) rescan();
    const on = GFX.propAnims;
    for (let i = 0; i < watched.length; i++) {
      const e = watched[i];
      if (!on) { if (e._doorsAnim) { e.animSprite = null; e._doorsAnim = false; } continue; }
      if (chestOpen(e)) { if (!e._lidT) ensureOpen(e); } else e._seenClosed = true;
      if (e.kind === 'item' && e.dead) { e.animSprite = null; e._doorsAnim = false; continue; }
      const age = e._lidT ? clock - e._lidT : 0;
      const k = !e._lidT ? 0 : age >= LID_T ? FRAMES - 1 : Math.round(ease(age / LID_T) * (FRAMES - 1));
      if (!chestFrames('chest')) continue;
      e.animSprite = frameName('chest', 'lid', k); e._doorsAnim = true;
    }
    for (let i = pulls.length - 1; i >= 0; i--) {
      const q = pulls[i], age = clock - q.t0;
      if (!on || age >= PULL_IN + PULL_HOLD + PULL_OUT) { q.e.animSprite = null; pulls.splice(i, 1); continue; }
      if (leverFrames('lever')) q.e.animSprite = frameName('lever', 'pull', pullFrame(age));
    }
  }

  // ---------------------------------------------------------------- hooks
  function install() {
    const _render = Engine.render;
    Engine.render = function (ents, tod, opts) {
      try {
        const now = performance.now() / 1000, dt = Math.min(0.1, lastNow ? Math.max(0, now - lastNow) : 0.016); lastNow = now;
        sync(dt);
      } catch (err) { /* never break a frame */ }
      return _render(ents, tod, opts);
    };
    if (typeof useDeco === 'function') {
      const _use = useDeco;
      useDeco = function (e) { try { startPull(e); } catch (err) { /* cosmetic */ } return _use(e); };
    }
    if (typeof interact === 'function') {
      const _int = interact;
      interact = function () {
        try {
          // levers with no handler of their own (a chained sluice lever) still pull
          const e = Engine.pick(G.ents, USE_RANGE);
          if (e && !e.dead && e.kind === 'deco' && e.sprite === 'lever') startPull(e);
        } catch (err) { /* cosmetic */ }
        return _int.apply(this, arguments);
      };
    }
  }
  try { if (typeof Engine !== 'undefined' && typeof G !== 'undefined') install(); } catch (err) { console.warn('doors hooks failed', err); }

  return { swing, out, orient, chestFrames, leverFrames, sync, startPull, pullFrame, FRAMES, state: () => ({ clock, pulls: pulls.length, watched: watched.length }), advance: dt => sync(dt), PULL_IN, PULL_HOLD, PULL_OUT, LID_T };
})();
