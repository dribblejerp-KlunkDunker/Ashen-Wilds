// ============================================================
//  telegraphs — Phase 3: casting tells and spawn entrances
//
//  1. Pressman Mallow's hand-press and the Deacon's clapperless bell used to
//     land with no warning. Now the caster raises its arms (stretch + lift, the
//     existing _a1 frame where there is one), a coloured glow builds for a fixed
//     lead time and ONLY THEN does the original effect run. Damage, chances and
//     cooldown lengths are untouched: the original enemyUpdate still makes every
//     roll, we only hold it back for CFG.lead seconds. Stun, death or leaving the
//     chase cancels the cast; a player who steps out of reach/range dodges it.
//  2. Enemies that appear mid-play (summons, ambushes, waves) get an entrance:
//     earth rising, a thread lowering from the ceiling, or a mist puff. During
//     it the enemy is non-solid and does not act; its spawn point is checked
//     collision-safe first (nudged to free ground within 1.5, else no telegraph).
//
//  Everything is switched by GFX.telegraphs (default on, not part of GFX.FX).
//  Off = the original code path and timing, call for call.
//  Art is procedural stand-in work (additive glow, dither rings), pending final art.
//  Saves: all state lives in fields starting with "_" (never saved). The one
//  exception is e.solid, restored when the entrance ends.
// ============================================================
'use strict';

const TELEGRAPHS = (() => {
  if (typeof GFX !== 'undefined' && GFX.telegraphs === undefined) GFX.telegraphs = true;
  const CFG = {
    lead: 0.6,       // seconds the cast is visible before the effect lands
    markT: 0.6,      // entrance: marker shows this long before the body appears
    riseT: 0.9,      // entrance: the body then rises/descends/fades in over this long
    nudgeMax: 1.5,   // furthest a blocked spawn point may be moved
    minPlayer: 0.8,  // spawn point must be at least this far from the player
  };
  const reduceMotion = () => { if (typeof GFX !== 'undefined' && GFX.reduceMotion) return true; try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (err) { return false; } };
  const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
  const on = () => typeof GFX === 'undefined' || GFX.telegraphs !== false;

  // ------------------------------------------------------------ casters
  // ready(): would the original code fire the effect on this very tick?
  const CASTERS = {
    pressman: {
      cue: 'Mallow raises the press —',
      col: [150, 200, 255],   // cold brass, 741 Hz: blue-white
      ready(e, dt, dist) {
        const d = e.def, p = G.player;
        return e.state === 'chase' && dist <= d.reach && (e.cool || 0) - dt <= 0 && Math.abs(feetOf(e) - feetOf(p)) <= MELEE_RISE;
      },
      release(e) { e.cool = 0; },
    },
    deacon: {
      cue: 'The Deacon lifts the bell —',
      col: [150, 120, 190],   // grey-violet hush
      ready(e, dt, dist) { return e.state === 'chase' && !!e.def.deaconAura && dist < 6 && (e.auraT || 0) - dt <= 0; },
      release(e) { e.auraT = 0; },
    },
  };
  function cancelCast(e) { e._cast = null; }

  // ------------------------------------------------------------ entrances
  const MIST_TYPES = new Set(['quiet', 'hushmoth', 'dirge']);
  const GRAVE_TYPES = new Set(['dirge', 'hollow', 'drowned']);
  const GRAVE_MAPS = new Set(['deepwoods', 'mausoleum']);
  const BROOD_TYPES = new Set(['weaverling', 'broodmother']);
  // pure rule, so tests can pin it: which entrance does this type get on this map?
  function chooseStyle(type, mapId, outdoor, nearGrave, misty) {
    if (BROOD_TYPES.has(type) && !outdoor) return 'ceiling';
    if (MIST_TYPES.has(type) && misty) return 'mist';
    if (GRAVE_TYPES.has(type) && (GRAVE_MAPS.has(mapId) || nearGrave)) return 'ground';
    return 'mist';
  }
  function nearGraveOf(e) {
    for (const o of G.ents) if (o.kind === 'deco' && o.sprite === 'grave' && (o.x - e.x) * (o.x - e.x) + (o.y - e.y) * (o.y - e.y) < 25) return true;
    return false;
  }
  function styleFor(e) {
    const m = G.map;
    const misty = typeof POST !== 'undefined' && POST.config && POST.config.mist && !!POST.config.mist[G.mapId];
    return chooseStyle(e.type, G.mapId, !!(m && m.outdoor), nearGraveOf(e), misty);
  }
  function spotFree(e, x, y) {
    if (solidAt(x, y, e)) return false;
    const c = Engine.cam;
    if ((x - c.x) * (x - c.x) + (y - c.y) * (y - c.y) < CFG.minPlayer * CFG.minPlayer) return false;
    for (const o of G.ents) if (o !== e && o.kind === 'enemy' && o._tg && !o.dead && (o.x - x) * (o.x - x) + (o.y - y) * (o.y - y) < 0.36) return false;
    return true;
  }
  // the spawn point if free, else the nearest free point within nudgeMax, else null
  function safeSpot(e) {
    if (spotFree(e, e.x, e.y)) return { x: e.x, y: e.y };
    for (let r = 0.25; r <= CFG.nudgeMax + 1e-6; r += 0.25) {
      const n = Math.round(r * 16);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r;
        if (spotFree(e, x, y)) return { x, y };
      }
    }
    return null;
  }
  function beginEntrance(e) {
    e._tgSeen = true;
    // every mid-play spawn site sends its arrivals straight into the chase; idle/passive ones are map furniture
    if (e.kind !== 'enemy' || e.dead || e.hidden || e.state !== 'chase') return;
    const style = styleFor(e);
    const spot = safeSpot(e);
    if (!spot) return;   // nowhere safe: spawn normally, no telegraph
    e.x = spot.x; e.y = spot.y; e.homeX = spot.x; e.homeY = spot.y;
    e._tg = { style, t: 0, solid: e.solid };
    e.solid = false;
  }
  function endEntrance(e) {
    if (e._tg) { if (!e.dead) e.solid = e._tg.solid !== false; e._tg = null; }
  }
  const entranceLen = () => CFG.markT + CFG.riseT;

  // ------------------------------------------------------------ wrapping
  const _eu = enemyUpdate;
  enemyUpdate = function (e, dt) {
    if (!on()) {
      if (e._cast) cancelCast(e);
      if (e._tg) endEntrance(e);
      return _eu(e, dt);
    }
    try {
      if (!e._tgSeen) beginEntrance(e);
      if (e._tg) {
        if (e.dead || e.hidden) endEntrance(e);
        else {
          e._tg.t += dt;
          if (e._tg.t >= entranceLen()) endEntrance(e);
          return;   // non-solid, harmless, inactive for the whole entrance
        }
      }
      const cs = CASTERS[e.type];
      if (cs && e.kind === 'enemy') {
        if (e._cast) {
          if (e.dead || e.hidden || e.stun > 0 || e.state !== 'chase') cancelCast(e);   // stun/death/loss of target cancels
          else {
            e._cast.t += dt;
            if (e._cast.t < CFG.lead - 1e-9) return;   // still telling: nothing lands
            cancelCast(e); cs.release(e);
          }
        } else if (!e.dead && !e.hidden && !(e.stun > 0) && !G.dead && e.state === 'chase' && !disguiseProtects(e)) {
          const c = Engine.cam, dist = Math.hypot(c.x - e.x, c.y - e.y);
          if (cs.ready(e, dt, dist)) {
            e._cast = { t: 0 };
            msg(cs.cue, 'warn', 2400);   // once per cast: the written cue
            return;
          }
        }
      }
    } catch (err) { console.warn('telegraphs: update failed', err); }
    return _eu(e, dt);
  };

  const _lm = loadMap;
  loadMap = function (id, pos) {
    if (G.ents) for (const e of G.ents) { if (e._cast) e._cast = null; if (e._tg) endEntrance(e); }
    const r = _lm(id, pos);
    // everything already on the map belongs to it: only later arrivals get an entrance
    try { if (G.ents) for (const e of G.ents) if (e.kind === 'enemy') e._tgSeen = true; } catch (err) { /* never break a load */ }
    return r;
  };

  // ------------------------------------------------------------ creature animation
  const _ac = animCreature;
  animCreature = function (e, dt, T) {
    _ac(e, dt, T);
    if (!on()) return;
    try {
      if (e._cast) castPose(e);
      else if (e._tg) entrancePose(e);
    } catch (err) { /* never break a frame */ }
  };
  function castPose(e) {
    const k = Math.min(1, e._cast.t / CFG.lead), s = ease(k);
    e.animSY = (e.animSY || 1) * (1 + 0.10 * s);     // arms raised: stretch...
    e.animSX = (e.animSX || 1) * (1 - 0.04 * s);
    e.animLift = (e.animLift || 0) + 0.09 * s;       // ...and lift
    const pose = e.sprite + '_a1';
    if (Engine.sprites[pose]) e.animSprite = pose;
    e.animGlow = Math.max(e.animGlow || 0, 0.45 + 0.45 * s);
  }
  function entrancePose(e) {
    const g = e._tg;
    if (g.t < CFG.markT) { e.animAlpha = 0; return; }   // the marker is showing; the body is not there yet
    const k = ease((g.t - CFG.markT) / CFG.riseT);
    if (g.style === 'ground') {
      // stand-in: the engine cannot clip a sprite at the floor, so the body grows up from its base
      e.animSY = Math.max(0.04, k) * (e.animSY || 1); e.animLift = 0; e.animAlpha = 0.45 + 0.55 * k;
    } else if (g.style === 'ceiling') {
      e.animLift = (e.animLift || 0) + (1 - k) * 1.7; e.animAlpha = Math.min(1, 0.3 + k * 1.5);
    } else {
      e.animAlpha = Math.max(0.05, k);
    }
  }

  // ------------------------------------------------------------ drawing (post hook)
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function mix(fb, o, r, g, b, a) {
    const px = fb[o], pr = px & 255, pg = (px >> 8) & 255, pb = (px >> 16) & 255;
    fb[o] = (255 << 24) | (((pb + (b - pb) * a) | 0) << 16) | (((pg + (g - pg) * a) | 0) << 8) | ((pr + (r - pr) * a) | 0);
  }
  function project(F, x, y) {
    const dx = x - F.cam.x, dy = y - F.cam.y, inv = 1 / (F.planeX * F.dirY - F.dirX * F.planeY);
    const trX = inv * (F.dirY * dx - F.dirX * dy), trY = inv * (-F.planeY * dx + F.planeX * dy);
    if (trY <= 0.15) return null;
    const m = F.map, floor = m && (m.lvls || m.smooth) ? m.groundAt(x, y) : 0;
    const L = Math.hypot(F.planeX, F.planeY) || 1;
    return { sx: (F.w / 2) * (1 + trX / trY), base: F.horizon + ((F.cam.z - floor) * F.h / trY), z: trY, ppu: (F.w / 2) / (L * trY), vpu: F.h / trY };
  }
  // a soft coloured halo behind a casting body (additive, hidden behind nearer things)
  function halo(F, e, col, k) {
    const s = e._screen; if (!s) return;
    const S = F.S, fb = F.fb, db = F.dbuf, W = F.w, H = F.h;
    const cx = (s.x0 + s.x1) / 2 * S, cy = (s.y0 + s.y1) / 2 * S, rx = (s.x1 - s.x0) * S * 0.8 + 3, ry = (s.y1 - s.y0) * S * 0.62 + 3;
    const x0 = Math.max(0, (cx - rx) | 0), x1 = Math.min(W - 1, (cx + rx) | 0), y0 = Math.max(0, (cy - ry) | 0), y1 = Math.min(H - 1, (cy + ry) | 0);
    const amp = 0.55 * k * k + 0.1 * k, zlim = s.z - 0.03, cr = col[0] * amp, cg = col[1] * amp, cb = col[2] * amp;
    for (let y = y0; y <= y1; y++) {
      const ny = (y - cy) / ry, rem = 1 - ny * ny; if (rem <= 0) continue;
      const half = Math.sqrt(rem) * rx, xa = Math.max(x0, Math.ceil(cx - half)), xb = Math.min(x1, Math.floor(cx + half));
      let o = y * W + xa;
      for (let x = xa; x <= xb; x++, o++) {
        if (db && db[o] < zlim) continue;
        const nx = (x - cx) / rx, u = 1 - nx * nx - ny * ny; if (u <= 0) continue;
        const f = u * u, px = fb[o];   // additive, inlined: this runs for every pixel of the halo
        const nr = (px & 255) + cr * f, ng = ((px >> 8) & 255) + cg * f, nb = ((px >> 16) & 255) + cb * f;
        fb[o] = (255 << 24) | ((nb > 255 ? 255 : nb) << 16) | ((ng > 255 ? 255 : ng) << 8) | (nr > 255 ? 255 : nr);
      }
    }
  }
  function groundRing(F, e, k, col) {
    const p = project(F, e.x, e.y); if (!p) return;
    const fb = F.fb, db = F.dbuf, W = F.w, H = F.h;
    const r = (0.12 + 0.34 * k) * p.ppu, ry = Math.max(1, r * 0.3);
    const x0 = Math.max(0, (p.sx - r - 2) | 0), x1 = Math.min(W - 1, (p.sx + r + 2) | 0), y0 = Math.max(0, (p.base - ry * 1.5 - 2) | 0), y1 = Math.min(H - 1, (p.base + ry * 1.5 + 2) | 0);
    const a = 0.8 * (1 - k * 0.8), th = 0.38;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const nx = (x - p.sx) / r, ny = (y - p.base) / ry, q = Math.sqrt(nx * nx + ny * ny);
      if (Math.abs(q - 1) > th * (1 - 0.5 * k)) continue;
      if (BAYER[((y & 3) << 2) | (x & 3)] >= 4 + 11 * a) continue;
      const o = y * W + x; if (db && db[o] < p.z - 0.1) continue;
      mix(fb, o, col[0], col[1], col[2], 0.65);
    }
    // a few flecks thrown up while the body rises
    if (k > 0.05 && k < 0.95) for (let i = 0; i < 7; i++) {
      const ang = i * 2.399 + e._tg.t * 3, rr = (0.3 + ((i * 37) % 10) / 20) * r, lift = Math.sin(Math.min(1, k * 1.4 + i * 0.07) * Math.PI) * ry * 2.5;
      const x = (p.sx + Math.cos(ang) * rr) | 0, y = (p.base + Math.sin(ang) * rr * 0.3 - lift) | 0;
      if (x >= 0 && x < W && y >= 0 && y < H) mix(fb, y * W + x, col[0], col[1], col[2], 0.8);
    }
  }
  function thread(F, e) {
    const p = project(F, e.x, e.y); if (!p) return;
    const g = e._tg, fb = F.fb, W = F.w, S = F.S, x = p.sx | 0;
    let yEnd;
    if (g.t < CFG.markT) yEnd = p.base - p.vpu * 0.95 * (1 - ease(g.t / CFG.markT) * 0.35);   // a bead dangling ahead of the body
    else if (e._screen) yEnd = e._screen.y0 * S;
    else return;
    yEnd = Math.min(F.h - 1, yEnd | 0);
    const sway = reduceMotion() ? 0 : Math.sin(g.t * 5) * 0.8 * S;
    for (let y = 0; y < yEnd; y++) {
      const xx = (x + sway * (y / Math.max(1, yEnd))) | 0; if (xx < 0 || xx >= W) continue;
      if (BAYER[((y & 3) << 2) | (xx & 3)] < 9) mix(fb, y * W + xx, 205, 200, 220, 0.75);
    }
    if (g.t < CFG.markT && yEnd > 1) for (let dy = -S; dy <= S; dy++) for (let dx = -S; dx <= S; dx++) {
      const xx = x + dx, yy = yEnd + dy; if (xx >= 0 && xx < W && yy >= 0 && yy < F.h) mix(fb, yy * W + xx, 225, 220, 235, 0.9);
    }
  }
  function mistSwirl(F, e) {
    const p = project(F, e.x, e.y); if (!p) return;
    const g = e._tg, fb = F.fb, db = F.dbuf, W = F.w, H = F.h;
    const total = entranceLen(), fade = g.t < CFG.markT ? Math.min(1, g.t / (CFG.markT * 0.5)) : Math.max(0, 1 - (g.t - CFG.markT) / CFG.riseT);
    const rx = 0.55 * p.ppu, ry = Math.max(1.5, rx * 0.32), spin = reduceMotion() ? 0 : g.t * 2.2;
    const x0 = Math.max(0, (p.sx - rx) | 0), x1 = Math.min(W - 1, (p.sx + rx) | 0), y0 = Math.max(0, (p.base - ry * 2.4) | 0), y1 = Math.min(H - 1, (p.base + ry) | 0);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const nx = (x - p.sx) / rx, ny = (y - p.base) / ry, q = nx * nx + ny * ny * 0.35; if (q >= 1) continue;
      const sw = Math.sin(Math.atan2(ny, nx) * 2 + q * 5 - spin); if (sw < -0.1) continue;
      const a = (1 - q) * fade * 0.7; if (BAYER[((y & 3) << 2) | (x & 3)] >= a * 16) continue;
      const o = y * W + x; if (db && db[o] < p.z - 0.1) continue;
      mix(fb, o, 196, 196, 214, 0.7);
    }
    // while the body fades in, the puff still clings to it
    const s = e._screen;
    if (s && g.t >= CFG.markT) {
      const k = 1 - (g.t - CFG.markT) / CFG.riseT, S = F.S;
      for (let y = Math.max(0, (s.y0 * S) | 0); y <= Math.min(H - 1, (s.y1 * S) | 0); y++) for (let x = Math.max(0, (s.x0 * S) | 0); x <= Math.min(W - 1, (s.x1 * S) | 0); x++) {
        if (BAYER[((y & 3) << 2) | (x & 3)] >= k * 7) continue;
        const o = y * W + x; if (db && db[o] < s.z - 0.03) continue;
        mix(fb, o, 190, 190, 208, 0.45);
      }
    }
  }
  const t0 = { ground: [150, 126, 96], mist: [196, 196, 214] };
  function hook(F) {
    if (!on() || !G.ents) return;
    for (let i = 0; i < G.ents.length; i++) {
      const e = G.ents[i];
      if (e._cast) { const cs = CASTERS[e.type]; if (cs && !e.hidden) halo(F, e, cs.col, Math.min(1, e._cast.t / CFG.lead)); }
      else if (e._tg && !e.hidden && !e.dead) {
        const g = e._tg;
        if (g.style === 'ground') groundRing(F, e, Math.min(1, g.t / entranceLen()), t0.ground);
        else if (g.style === 'ceiling') thread(F, e);
        else mistSwirl(F, e);
      }
    }
  }
  if (typeof Engine !== 'undefined' && Engine.addPostHook) Engine.addPostHook((F) => { try { hook(F); } catch (err) { if (!hook.warned) { hook.warned = true; console.warn('telegraphs hook failed', err); } } }, 25);

  // e.solid is a saved field: a save taken mid-entrance must record the enemy's
  // real solidity, not the temporary "non-solid while arriving" state
  if (typeof snapshotGame === 'function') {
    const _snap = snapshotGame;
    snapshotGame = function () {
      const arriving = [];
      for (const id in (G.maps || {})) for (const e of G.maps[id].entities) if (e._tg) { arriving.push([e, e.solid]); e.solid = e._tg.solid !== false; }
      try { return _snap.apply(this, arguments); } finally { for (const [e, s] of arriving) e.solid = s; }
    };
  }
  return { CFG, CASTERS, chooseStyle, styleFor, safeSpot, hook, entranceLen };
})();
if (typeof window !== 'undefined') window.TELEGRAPHS = TELEGRAPHS;
