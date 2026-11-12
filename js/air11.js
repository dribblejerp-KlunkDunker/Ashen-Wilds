// ============================================================
//  air11 — Phase 11 "Feedback and feel", the AIR team: atmosphere in the raycaster
//
//  Six effects, each behind its own GFX switch (Options -> Graphics & access). They are all post
//  hooks (or, for ghosts, a wrapper around Engine.render) that read the finished frame's depth and
//  material buffers, so a wall or a sprite in front hides them exactly. Nothing here is simulated,
//  saved or put in G: no entity field is written (per-entity bookkeeping lives in WeakMaps), and the
//  module has its own random generator so the game's Math.random sequence is never shifted.
//  Every effect is a procedural STAND-IN for hand-painted art.
//
//   sunShafts   soft slanted beams through the Deep Woods canopy and the Cloister's windows, by day
//               only, with a pool of light on the floor and slowly drifting dust motes.
//   heatHaze    a gentle shimmer (screen-space offset) above braziers, camp fires and the
//               Steam Golem; only the pixels behind the source are moved. Reduce motion = off.
//   glassGlare  a cool halo, four soft streaks and a rippling of the air around Light-glass: shards,
//               glass lamps and the glass "coil" growths. Reduce motion keeps a still halo.
//   seeThrough  spectral kinds (the Quiet, Dirges, the Drowned, the Hollow mourners) are drawn
//               half-transparent (the engine's own dither) with a faint travelling shimmer; never
//               below MIN_ALPHA, and with a light outline in High contrast.
//   coldBreath  small puffs at the mouths of people and beasts, and from the bottom of your own view,
//               at night and in cold places (see COLD_MAPS).
//   footprints  prints in mud and shallow water from you and from walking enemies, fading over
//               ~60 s, capped, floor decals in the same world-space ground pass look10.js uses.
//               Current visit only: cleared on map change, never saved.
//
//  A flag that is false returns before touching a pixel, so the frame is the original frame (the
//  Original preset switches all six off; Low switches them off too, see js/presets.js LOW_OFF).
// ============================================================
'use strict';

const AIR_FLAGS = ['sunShafts', 'heatHaze', 'glassGlare', 'seeThrough', 'coldBreath', 'footprints'];
if (typeof GFX !== 'undefined') {
  for (const k of AIR_FLAGS) {
    if (GFX[k] === undefined) GFX[k] = true;
    if (GFX.FX && !GFX.FX.includes(k)) GFX.FX.push(k);
  }
}

const AIR11 = (() => {
  const KEY = 'echoes-air11';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // the module's own generator
  let rs = 0x0a11c0de;
  function rnd() { rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; return ((rs >>> 0) % 100000) / 100000; }
  const seeded = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s % 100000) / 100000; }; };

  const config = {
    footprints: { cap: 60, life: 60, stride: 0.62, enemyStride: 0.78, range: 13 },
    ghost: { minAlpha: 0.42 },
    breath: { maxBreathers: 5, range: 7.5 },
    haze: { amp: 2.6 },
  };

  // ------------------------------------------------------------------
  //  settings: GFX flags (presets own the defaults) with an optional stored override
  // ------------------------------------------------------------------
  const stored = {}; for (const k of AIR_FLAGS) stored[k] = null;
  let mineChanging = false;
  function loadSettings() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && typeof o === 'object') for (const k of AIR_FLAGS) if (typeof o[k] === 'boolean') stored[k] = o[k];
    } catch (e) { /* storage may be blocked: the flags keep their preset values */ }
    for (const k of AIR_FLAGS) if (stored[k] !== null && typeof GFX !== 'undefined') GFX[k] = stored[k];
  }
  function saveSettings() { try { localStorage.setItem(KEY, JSON.stringify(stored)); } catch (e) { /* optional */ } }
  function setFlag(k, on) {
    mineChanging = true;
    try { GFX[k] = !!on; stored[k] = !!on; saveSettings(); GFX.changed(); } finally { mineChanging = false; }
  }

  // ------------------------------------------------------------------
  //  shared helpers
  // ------------------------------------------------------------------
  const stats = { shafts: 0, haze: 0, glare: 0, ghosts: 0, breath: 0, prints: 0, pixels: 0, ms: {}, calls: {} };
  let profile = false;
  const timed = (name, fn) => function (F) {
    if (!profile) return fn(F);
    const t0 = now(); try { return fn(F); } finally { stats.ms[name] = now() - t0; stats.calls[name] = (stats.calls[name] || 0) + 1; }
  };
  const hasFrame = (F) => F && F.fb && F.dbuf && F.mbuf && F.map && F.cam && F.sprList;

  // daylight in 0..1 with the engine's own formula (engine.js buildSky), so "day" here is the sky's day
  function dayness(tod) { return clamp((Math.cos((tod - 0.5) * Math.PI * 2) + 0.3) / 1.3, 0, 1); }

  // project a world point: returns depth (trY) and sets pTrX (units of the camera plane)
  let pTrX = 0;
  function proj(F, wx, wy) {
    const sx = wx - F.cam.x, sy = wy - F.cam.y;
    const inv = 1 / (F.planeX * F.dirY - F.dirX * F.planeY);
    pTrX = inv * (F.dirY * sx - F.dirX * sy);
    return inv * (-F.planeY * sx + F.planeX * sy);
  }
  const eyeZ = (F) => (F.relief ? F.cam.z : 0.5);

  // scratch copy of a screen rectangle, for the distortion effects (read the original, write the shifted)
  let scratch = new Uint32Array(0), gx0 = 0, gy0 = 0, gw = 0;
  function grab(F, x0, y0, x1, y1) {
    gx0 = x0; gy0 = y0; gw = x1 - x0 + 1;
    const n = gw * (y1 - y0 + 1);
    if (scratch.length < n) scratch = new Uint32Array(Math.max(n, 4096));
    const fb = F.fb, w = F.w;
    for (let y = y0, k = 0; y <= y1; y++) {
      const o = y * w + x0;
      for (let x = 0; x < gw; x++) scratch[k++] = fb[o + x];
    }
  }
  const grabbed = (x, y) => scratch[(y - gy0) * gw + (x - gx0)];

  function blend(px, tr, tg, tb, a) {
    const r = px & 255, g = (px >> 8) & 255, b = (px >> 16) & 255;
    const nr = r + (tr - r) * a, ng = g + (tg - g) * a, nb = b + (tb - b) * a;
    return (px & 0xff000000) | ((nb < 0 ? 0 : nb > 255 ? 255 : nb | 0) << 16) | ((ng < 0 ? 0 : ng > 255 ? 255 : ng | 0) << 8) | (nr < 0 ? 0 : nr > 255 ? 255 : nr | 0);
  }

  // ==================================================================
  //  1. SUN SHAFTS
  // ==================================================================
  // A shaft is a slanted ribbon from a point on the floor (bx,by) up to the canopy / window, drawn as a
  // camera-facing quad whose pixels are tested against the depth buffer: anything nearer than the
  // shaft's floor point (a wall, a trunk, a sprite) hides it, anything behind is lit by it.
  const SH = { map: null, list: [] };
  // [floor x, floor y, bright, phase]: the nave of the Cloister, where light from tall windows on the
  // north-west lands between the pillars. [PROPOSED placement; the map itself has no window cells.]
  const CLOISTER_SPOTS = [[7.6, 9.4, 1.0], [11.4, 9.0, 0.95], [9.5, 6.4, 0.85], [5.9, 12.4, 0.8], [13.3, 12.6, 0.75], [16.2, 7.8, 0.7]];
  function buildShafts(map) {
    SH.map = map; SH.list = [];
    if (!map) return;
    const r = seeded(0x5a11 + map.w * 31 + map.h);
    if (map.id === 'cloister') {
      const topZ = map.ceilZ || 1;
      CLOISTER_SPOTS.forEach(([x, y, b], i) => SH.list.push({ x, y, sx: -0.95, sy: -0.55, topZ, wTop: 0.3, wBot: 0.72, bright: b, ph: r() * 6.28, motes: 7, pool: 0.8, win: true }));
    } else if (map.id === 'deepwoods') {
      // a loose scatter over open ground, one candidate per 5x5 block; away from trunks and thickets
      for (let by = 0; by < map.h; by += 5) for (let bx = 0; bx < map.w; bx += 5) {
        if (r() > 0.5) continue;
        const x = bx + 0.8 + r() * 3.4, y = by + 0.8 + r() * 3.4, ix = x | 0, iy = y | 0;
        if (ix < 2 || iy < 2 || ix >= map.w - 2 || iy >= map.h - 2) continue;
        let blocked = false;
        for (let dy = -1; dy <= 1 && !blocked; dy++) for (let dx = -1; dx <= 1; dx++) if (map.cells[(iy + dy) * map.w + ix + dx]) { blocked = true; break; }
        if (blocked) continue;
        SH.list.push({ x, y, sx: -1.05, sy: -0.6, topZ: 1.0 + r() * 0.4, wTop: 0.28 + r() * 0.12, wBot: 0.62 + r() * 0.3, bright: 0.55 + r() * 0.45, ph: r() * 6.28, motes: 5, pool: 0.5, win: false });
      }
    }
  }
  function sunAmount(F) {
    const m = F.map;
    if (m.id !== 'cloister' && m.id !== 'deepwoods') return 0;
    const day = smooth(0.42, 0.78, dayness(F.tod));
    if (day <= 0.01) return 0;
    const wx = F.wx || {};
    return day * (1 - 0.8 * (wx.cloud || 0)) * (1 - 0.7 * clamp((wx.haze || 0) / 0.6, 0, 1)) * (1 - (wx.dark || 0));
  }
  function drawShafts(F) {
    if (!GFX.sunShafts || !hasFrame(F)) return;
    stats.shafts = 0;
    if (SH.map !== F.map) buildShafts(F.map);
    if (!SH.list.length) return;
    const k0 = sunAmount(F); if (k0 <= 0.01) return;
    const w = F.w, h = F.h, S = F.S || 1, fb = F.fb, dbuf = F.dbuf, mbuf = F.mbuf, bias = F.surfBias == null ? 0.45 : F.surfBias;
    const pl = Math.hypot(F.planeX, F.planeY), fogD = Math.max(4, F.fogDist), T = GFX.reduceMotion ? 0 : F.animT;
    const day = dayness(F.tod), warm = 1 - smooth(0.55, 0.95, day);   // low sun is more orange
    const cr = 255, cg = 236 - 26 * warm, cb = 190 - 70 * warm;
    const ez = eyeZ(F), m = F.map;
    for (let i = 0; i < SH.list.length; i++) {
      const s = SH.list[i];
      const tB = proj(F, s.x, s.y), xBn = pTrX;
      if (tB < 0.7 || tB > fogD * 0.9) continue;
      const tx = s.x + s.sx, ty = s.y + s.sy;
      const tT = proj(F, tx, ty), xTn = pTrX;
      if (tT < 0.3) continue;
      const gz = F.relief ? F.gAt(s.x, s.y, clamp(s.x | 0, 0, m.w - 1), clamp(s.y | 0, 0, m.h - 1)) : 0;
      const xB = (w / 2) * (1 + xBn / tB), xT = (w / 2) * (1 + xTn / tT);
      const yB = F.horizon + (ez - gz) * h / tB, yT = F.horizon + (ez - (gz + s.topZ)) * h / tT;
      if ((xB < -w * 0.3 && xT < -w * 0.3) || (xB > w * 1.3 && xT > w * 1.3)) continue;
      const ppu = (w / 2) / (tB * pl);
      const breathe = 0.82 + 0.18 * Math.sin(T * 0.23 + s.ph);          // the beam swells and thins very slowly
      const fade = k0 * s.bright * breathe * smooth(0, 1, 1 - tB / (fogD * 0.9)) * smooth(0.9, 3.2, tB) * 0.9;   // thin out as they near the eye, so one never floods the screen
      const y0 = Math.max(0, Math.ceil(yT)), y1 = Math.min(h - 1, Math.floor(yB));
      stats.shafts++;
      if (y1 > y0) {
        const span = yB - yT;
        for (let y = y0; y <= y1; y++) {
          const u = (y - yT) / span;
          const vf = smooth(0.0, 0.32, u) * (0.5 + 0.5 * u);
          const cxp = xT + (xB - xT) * u, hw = Math.max(1.5, (s.wTop + (s.wBot - s.wTop) * u) * 0.5 * ppu);
          const xa = Math.max(0, Math.ceil(cxp - hw)), xb = Math.min(w - 1, Math.floor(cxp + hw));
          let o = y * w + xa;
          for (let x = xa; x <= xb; x++, o++) {
            if (mbuf[o] === 1 || dbuf[o] < tB - 0.02) continue;
            const d = Math.abs(x - cxp) / hw, p = 1 - d, pr = p * p * (3 - 2 * p);
            const a = fade * vf * pr * 0.8;
            if (a < 0.004) continue;
            fb[o] = blend(fb[o], cr, cg, cb, a);
          }
        }
      }
      // the pool of light where the beam lands (ground pixels only: the renderer's own depth rule)
      if (yB > 0 && yB < h + 20) drawPool(F, s, gz, tB, fade, cr, cg, cb);
      // dust motes: a few bright specks wandering up the beam
      if (y1 > y0 && s.motes) {
        const span = yB - yT, hwB = Math.max(1.5, s.wBot * 0.5 * ppu);
        for (let j = 0; j < s.motes; j++) {
          const q = (s.ph * 7.31 + j * 1.713) % 1, sp = 0.006 + 0.01 * ((j * 0.37) % 1);
          const u = ((q + T * sp) % 1 + 1) % 1, lat = Math.sin(T * (0.21 + 0.05 * j) + s.ph + j * 2.1) * 0.62;
          const mx = xT + (xB - xT) * u + lat * ((s.wTop + (s.wBot - s.wTop) * u) * 0.5 * ppu), my = yT + span * u;
          const tw = 0.45 + 0.55 * Math.sin(T * 1.3 + j * 1.9 + s.ph);
          if (tw <= 0.1) continue;
          const ma = fade * tw * smooth(0.05, 0.3, u) * 0.9;
          const px0 = Math.round(mx), py0 = Math.round(my);
          for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) {
            const X = px0 + xx, Y = py0 + yy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
            const o = Y * w + X; if (mbuf[o] === 1 || dbuf[o] < tB - 0.02) continue;
            fb[o] = blend(fb[o], 255, 246, 214, ma);
          }
        }
      }
    }
  }
  function drawPool(F, s, gz, tB, fade, cr, cg, cb) {
    const w = F.w, h = F.h, fb = F.fb, dbuf = F.dbuf, mbuf = F.mbuf, bias = F.surfBias == null ? 0.45 : F.surfBias, cam = F.cam;
    const R = s.pool, ez = eyeZ(F);
    const dz = ez - gz; if (dz < 0.05) return;
    const tn = Math.max(0.12, tB - R), tf = tB + R;
    const yHi = F.horizon + h * dz / tn, yLo = F.horizon + h * dz / tf;
    const pl = Math.hypot(F.planeX, F.planeY);
    const cxs = (w / 2) * (1 + pTrXOf(F, s.x, s.y) / tB), half = (w / 2) * R * 1.2 / (pl * tn);
    const y0 = Math.max(0, Math.floor(yLo - 2)), y1 = Math.min(h - 1, Math.ceil(yHi + 2)), x0 = Math.max(0, Math.floor(cxs - half)), x1 = Math.min(w - 1, Math.ceil(cxs + half));
    if (y1 < y0 || x1 < x0) return;
    // the pool is stretched along the slant of the beam
    const ang = Math.atan2(s.sy, s.sx), ca = Math.cos(ang), sa = Math.sin(ang), ra = R * 1.15, rb = R * 0.7;
    const camx = cam.x, camy = cam.y;
    for (let y = y0; y <= y1; y++) {
      let o = y * w + x0;
      for (let x = x0; x <= x1; x++, o++) {
        const mt = mbuf[o]; if (mt !== 5) continue;
        const t = dbuf[o] - bias, cx = 2 * x / w - 1;
        const dx = camx + t * (F.dirX + F.planeX * cx) - s.x, dy = camy + t * (F.dirY + F.planeY * cx) - s.y;
        const u = (dx * ca + dy * sa) / ra, v = (-dx * sa + dy * ca) / rb, q = u * u + v * v;
        if (q >= 1) continue;
        if (F.relief) { const wx = s.x + dx, wy = s.y + dy; if (wx < 0 || wy < 0 || (wx | 0) >= F.map.w || (wy | 0) >= F.map.h) continue; const g = F.gAt(wx, wy, wx | 0, wy | 0); if (Math.abs(g - gz) > 0.4) continue; }
        const a = fade * 0.8 * (1 - q) * (1 - q);
        if (a < 0.004) continue;
        fb[o] = blend(fb[o], cr, cg, cb, a);
      }
    }
  }
  function pTrXOf(F, x, y) { proj(F, x, y); return pTrX; }

  // ==================================================================
  //  2. HEAT HAZE
  // ==================================================================
  // (hearths are left out: they sit in walls indoors, where the shimmer would be the one thing moving in a still room)
  const HEAT_SPRITES = { brazier: 1.0, campfire: 1.0, golem: 1.0 };
  function heatOf(e) {
    if (!e || e.hidden || e.dead || !e._screen) return 0;
    if (e.kind === 'enemy' && e.type !== 'golem') return 0;
    return HEAT_SPRITES[e.sprite] || 0;
  }
  function drawHaze(F) {
    if (!GFX.heatHaze || GFX.reduceMotion || !hasFrame(F)) return;
    stats.haze = 0;
    const list = F.sprList, w = F.w, h = F.h, S = F.S || 1, fb = F.fb, dbuf = F.dbuf, T = F.animT;
    const amp0 = config.haze.amp * S;
    for (let i = 0; i < list.length; i++) {
      const e = list[i], hk = heatOf(e); if (!hk) continue;
      const sc = e._screen, z = sc.z; if (!(z > 0.3) || sc.dist > 9) continue;
      const sx0 = sc.x0 * S, sx1 = sc.x1 * S, sy0 = sc.y0 * S, sy1 = sc.y1 * S, sw = sx1 - sx0, sh = sy1 - sy0;
      if (sw < 3 || sh < 3) continue;
      const golem = e.kind === 'enemy';
      // above the flame (or the Golem's shoulders), a little wider than the source
      const H = sh * (golem ? 0.55 : 0.95), below = golem ? 0 : sh * 0.3;
      const x0 = Math.max(0, Math.floor(sx0 - sw * 0.3)), x1 = Math.min(w - 1, Math.ceil(sx1 + sw * 0.3));
      const y0 = Math.max(0, Math.floor(sy0 - H)), y1 = Math.min(h - 1, Math.ceil(sy0 + below));
      if (x1 - x0 < 3 || y1 - y0 < 2 || (x1 - x0 + 1) * (y1 - y0 + 1) > 24000) continue;
      const amp = Math.ceil(amp0 * hk) + 1, gx = Math.max(0, x0 - amp), gx1 = Math.min(w - 1, x1 + amp);
      grab(F, gx, y0, gx1, y1);
      const cxm = (sx0 + sx1) / 2, halfW = (x1 - x0) / 2 + 1, ph = (e.x * 3.1 + e.y * 1.7) % 6.28;
      stats.haze++;
      for (let y = y0; y <= y1; y++) {
        const up = (sy0 - y) / H;                                   // 0 at the top of the source, 1 at the top of the haze
        const env = y <= sy0 ? Math.pow(1 - clamp(up, 0, 1), 1.1) * smooth(0, 0.12, 1 - up + 0.12) : clamp(1 - (y - sy0) / Math.max(1, below), 0, 1) * 0.5;
        if (env <= 0.02) continue;
        const wob = Math.sin((y / S) * 0.62 - T * 3.3 + ph) + 0.4 * Math.sin((y / S) * 1.37 - T * 5.1 + ph * 2);
        let o = y * w + x0;
        for (let x = x0; x <= x1; x++, o++) {
          if (dbuf[o] <= z + 0.02) continue;                         // the source itself, and anything nearer, stays put
          const ht = 1 - ((x - cxm) / halfW) * ((x - cxm) / halfW); if (ht <= 0) continue;
          const dx = Math.round(amp0 * hk * env * ht * wob);
          if (!dx) continue;
          const sxp = clamp(x + dx, gx, gx1), so = y * w + sxp;
          if (dbuf[so] <= z + 0.02) continue;                        // never drag a nearer pixel into the haze
          fb[o] = grabbed(sxp, y);
          stats.pixels++;
        }
      }
    }
  }

  // ==================================================================
  //  3. LIGHT-GLASS GLARE
  // ==================================================================
  // How Light-glass is placed in this game: there is no separate "growth" entity. It is the glowing
  // glass the lighting module already knows: shards lying on the floor (item 'shard'), Light-glass lamps
  // (glassLamp) and the green-gold "coil" growths (sprite 'coil': the Growth crystal in the Mausoleum
  // and Bell-Tower, and the coil items). Their size (scale) sets the strength of the glare.
  function glassOf(e) {
    if (!e || e.hidden || e.dead || !e._screen) return 0;
    if (e.item === 'shard' || e.glassLamp || e.glassGrowth || e.sprite === 'coil') return clamp(0.5 + 0.55 * Math.sqrt(e.scale || 0.8), 0.5, 1.3);
    return 0;
  }
  function drawGlare(F) {
    if (!GFX.glassGlare || !hasFrame(F)) return;
    stats.glare = 0;
    const list = F.sprList, w = F.w, h = F.h, S = F.S || 1, fb = F.fb, dbuf = F.dbuf, fogD = Math.max(4, F.fogDist);
    // Reduce motion, No flashes, or the Light-glass glimmer switched off (shardGlint): a still halo, no ripple or pulse
    const still = !!GFX.reduceMotion || !!GFX.noFlash || GFX.shardGlint === false, T = still ? 0 : F.animT;
    const night = 1 + 0.45 * (1 - dayness(F.tod)) * (F.outdoor ? 1 : 0.5);
    for (let i = 0; i < list.length; i++) {
      const e = list[i], gk = glassOf(e); if (!gk) continue;
      const sc = e._screen, z = sc.z; if (!(z > 0.3) || sc.dist > fogD * 0.9) continue;
      const sx0 = sc.x0 * S, sx1 = sc.x1 * S, sy0 = sc.y0 * S, sy1 = sc.y1 * S;
      const sw = sx1 - sx0, sh = sy1 - sy0; if (sw < 2 || sh < 2) continue;
      const cx = (sx0 + sx1) / 2, cy = (sy0 + sy1) / 2;
      const R = clamp(Math.max(sw, sh) * 0.95 + 5 * S, 8 * S, 64 * S);
      const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(w - 1, Math.ceil(cx + R)), y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(h - 1, Math.ceil(cy + R));
      if (x1 <= x0 || y1 <= y0) continue;
      const dfade = smooth(0, 1, 1 - sc.dist / (fogD * 0.9));
      const pulse = still || GFX.noFlash ? 1 : 0.88 + 0.12 * Math.sin(T * 1.7 + e.x * 2.3 + e.y);
      const str = gk * dfade * pulse * night;
      const amp = still ? 0 : 1.5 * S * gk, pad = Math.ceil(amp) + 1;
      stats.glare++;
      const gxa = Math.max(0, x0 - pad), gxb = Math.min(w - 1, x1 + pad);
      if (amp > 0) grab(F, gxa, y0, gxb, y1);
      const R2 = R * R;
      for (let y = y0; y <= y1; y++) {
        let o = y * w + x0;
        const dy = y - cy;
        for (let x = x0; x <= x1; x++, o++) {
          const dx = x - cx, q = (dx * dx + dy * dy) / R2; if (q >= 1) continue;
          const dz = dbuf[o];
          if (dz < z - 0.01) continue;                              // something nearer hides the glare
          const own = dz <= z + 0.02;                               // the glass itself
          if (amp > 0 && !own) {
            // ripple: the air shivers outward in rings, strongest near the glass
            const d = Math.sqrt(q) * R, f = (1 - Math.sqrt(q)), sh2 = Math.sin(d * (0.55 / S) - T * 2.6) * amp * f * f;
            const sxp = clamp(Math.round(x + (dx / (d + 0.5)) * sh2), gxa, gxb);
            if (dbuf[y * w + sxp] > z + 0.02) fb[o] = grabbed(sxp, y);
          }
          const a = str * (own ? 0.12 : 0.26) * (1 - q) * (1 - q);
          if (a > 0.004) fb[o] = blend(fb[o], 150, 255, 238, a);
        }
      }
      // four soft streaks through the heart
      const cxi = Math.round(cx), cyi = Math.round(cy), L = R * 1.35;
      for (let k = 0; k < 2; k++) for (let t = -Math.ceil(L); t <= Math.ceil(L); t++) {
        const X = k ? cxi : cxi + t, Y = k ? cyi + t : cyi;
        if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const o = Y * w + X; if (dbuf[o] < z - 0.01) continue;
        const f = 1 - Math.abs(t) / L; if (f <= 0) continue;
        fb[o] = blend(fb[o], 200, 255, 246, str * 0.34 * f * f);
      }
    }
  }

  // ==================================================================
  //  4. SEE-THROUGH GHOSTS
  // ==================================================================
  // The spectral kinds, by sprite: the Quiet (Hush-kin), the Dirges (floating mourning-shades of the
  // Mausoleum), the Drowned Hollows and the Hollow mourners walking the Mausoleum yard. NOT the Hollows
  // of Whisper-Grove (living people the Silencing emptied) and not the Phantom Weaver or other bosses.
  const GHOST = { quiet: 0.6, dirge: 0.55, drowned: 0.66, mourner: 0.6 };
  const MIN_ALPHA = config.ghost.minAlpha;
  function ghostBase(e) {
    if (!e || (e.kind !== 'enemy' && e.kind !== 'npc')) return 0;
    return GHOST[e.sprite] || 0;
  }
  // the alpha a ghost is drawn with this moment; bounded below by MIN_ALPHA and above by 0.8
  function ghostAlpha(e, t) {
    const b = ghostBase(e); if (!b) return 1;
    const wob = GFX.reduceMotion ? 0 : 0.08 * Math.sin(t * 1.3 + (e.x || 0) * 1.9 + (e.y || 0) * 0.7);
    return clamp(b + wob, MIN_ALPHA, 0.8);
  }
  function wrapRender() {
    if (typeof Engine === 'undefined' || Engine.render.__air11) return;
    const _render = Engine.render;
    Engine.render = function (ents, tod, opts) {
      let saved = null;
      if (GFX.seeThrough && ents) {
        for (let i = 0; i < ents.length; i++) {
          const e = ents[i];
          if (!e || !GHOST[e.sprite] || e.hidden) continue;
          if (e.kind !== 'enemy' && e.kind !== 'npc') continue;
          const had = Object.prototype.hasOwnProperty.call(e, 'animAlpha'), prev = e.animAlpha;
          (saved || (saved = [])).push(e, had, prev);
          const ga = ghostAlpha(e, lastT), cur = prev == null ? 1 : prev;
          e.animAlpha = cur < ga ? cur : ga;
        }
      }
      try { return _render.apply(this, arguments); }
      finally {
        if (saved) for (let i = 0; i < saved.length; i += 3) { const e = saved[i]; if (saved[i + 1]) e.animAlpha = saved[i + 2]; else delete e.animAlpha; }
      }
    };
    Engine.render.__air11 = true;
  }
  let lastT = 0;   // the sim clock, kept by the first hook of the frame
  // a light outline on a dark backdrop, a dark one on a light backdrop: it reads either way
  function outline(fb, o, k) {
    const px = fb[o], lum = ((px & 255) * 77 + ((px >> 8) & 255) * 150 + ((px >> 16) & 255) * 29) >> 8;
    fb[o] = lum < 120 ? blend(px, 240, 252, 255, 0.85 * k) : blend(px, 18, 22, 40, 0.8 * k);
  }
  // shimmer + outline, after the grade so the cool tint stays cool
  function drawGhosts(F) {
    if (!GFX.seeThrough || !hasFrame(F)) return;
    stats.ghosts = 0;
    const list = F.sprList, w = F.w, h = F.h, S = F.S || 1, fb = F.fb, dbuf = F.dbuf, mbuf = F.mbuf, T = F.animT, still = !!GFX.reduceMotion;
    let hc = false; try { hc = document.documentElement.classList.contains('ac-hc'); } catch (e) { /* no DOM */ }
    for (let i = 0; i < list.length; i++) {
      const e = list[i]; if (!GHOST[e.sprite] || e.hidden || !e._screen) continue;
      if (e.kind !== 'enemy' && e.kind !== 'npc') continue;
      const sc = e._screen, z = sc.z; if (!(z > 0.1)) continue;
      const x0 = Math.max(0, Math.floor(sc.x0 * S)), x1 = Math.min(w - 1, Math.ceil(sc.x1 * S)), y0 = Math.max(0, Math.floor(sc.y0 * S)), y1 = Math.min(h - 1, Math.ceil(sc.y1 * S));
      if (x1 <= x0 || y1 <= y0) continue;
      stats.ghosts++;
      const hh = y1 - y0 + 1, band = still ? -1 : y0 + ((((T * 0.32 + (e.x + e.y) * 0.37) % 1) + 1) % 1) * hh;
      const fogK = clamp(1 - sc.dist / Math.max(4, F.fogDist), 0.25, 1);
      for (let y = y0; y <= y1; y++) {
        let first = -1, last = -1;
        const onBand = band >= 0 && Math.abs(y - band) <= 1.5 * S;
        let o = y * w + x0;
        for (let x = x0; x <= x1; x++, o++) {
          if (Math.abs(dbuf[o] - z) > 0.0005 || (mbuf[o] !== 6 && mbuf[o] !== 8)) continue;
          if (first < 0) first = x; last = x;
          // a faint cool wash over the whole body, a brighter ribbon travelling up it
          fb[o] = blend(fb[o], 150, 190, 235, onBand ? 0.34 : 0.1);
        }
        if (hc && first >= 0) {
          // High contrast: an outline on the silhouette, found from the drawn pixels (the dither leaves holes inside)
          if (first > 0) outline(fb, y * w + first - 1, fogK);
          if (last < w - 1) outline(fb, y * w + last + 1, fogK);
        }
      }
      if (hc) {
        // top and bottom edges per column
        for (let x = x0; x <= x1; x++) {
          let top = -1, bot = -1;
          for (let y = y0; y <= y1; y++) { const o = y * w + x; if (Math.abs(dbuf[o] - z) <= 0.0005 && (mbuf[o] === 6 || mbuf[o] === 8)) { if (top < 0) top = y; bot = y; } }
          if (top > 0) outline(fb, (top - 1) * w + x, fogK);
          if (bot >= 0 && bot < h - 1) outline(fb, (bot + 1) * w + x, fogK);
        }
      }
    }
  }

  // ==================================================================
  //  5. COLD BREATH
  // ==================================================================
  // Which places are cold. [PROPOSED] Always: stone and underground places (the catacombs, the Mausoleum,
  // the Bell-Tower, the Cloister, the Root-vaults and the quarry, the Greenroot undercroft, the under-hedge
  // tunnels, procedural dungeons). Outdoors: at night, at dusk and dawn, and in snow, mist or rain.
  // Warm interiors (houses, the tavern, the chapel, the Malting with its stove) never are.
  const COLD_MAPS = new Set(['catacombs', 'mausoleum', 'belfry', 'cloister', 'rootvault', 'quarry', 'greenroot_crypt', 'underhedge', 'procdungeon', 'wickhouse']);
  // 0 = warm, up to 1 = bitter
  function coldness(map, tod) {
    if (!map) return 0;
    if (COLD_MAPS.has(map.id)) return 0.9;
    if (!map.outdoor) return 0;
    const day = dayness(tod == null ? 0.5 : tod);
    let c = 1 - smooth(0.2, 0.62, day);                 // night 1, dusk and dawn part way, noon 0
    let st = ''; try { st = (typeof Weather !== 'undefined' && Weather.state) || ''; } catch (e) { /* none */ }
    if (st === 'snow') c = Math.max(c, 0.9); else if (st === 'mist' || st === 'rain' || st === 'storm') c = Math.max(c, 0.6);
    return c;
  }
  // living things that breathe out visible air: people and beasts, never constructs, ghosts or swarms
  const NO_BREATH = new Set(['golem', 'aegis', 'horn', 'warden', 'requiem', 'legionnaire_x', 'quiet', 'dirge', 'drowned', 'mourner', 'mites', 'hushmoth', 'weaverling', 'weaver', 'broodmother', 'fretcrawler', 'miredrone', 'kestrel', 'crow_stand', 'rat_idle', 'bore', 'coil', 'gear']);
  function breathes(e) {
    if (!e || e.hidden || e.dead || e.corpse) return false;
    if (e.kind !== 'npc' && e.kind !== 'enemy') return false;
    if (!e.sprite || NO_BREATH.has(e.sprite) || NO_BREATH.has(e.type)) return false;
    const d = e.def || {}; if (d.quiet || d.hushkin || d.moth || d.horn) return false;
    return true;
  }
  // where on the sprite the mouth is, as a fraction of its height (a beast carries its head low)
  const LOW_HEAD = { hound: 0.46, cat: 0.5, weaverling: 0.3 };
  const breathClock = new WeakMap();   // entity -> its personal phase offset
  function phaseOf(e) {
    let p = breathClock.get(e); if (p === undefined) { p = rnd() * 3.7; breathClock.set(e, p); }
    return p;
  }
  const PUFF = 1.15;     // seconds an exhaled puff lasts
  let playerPhase = 0, playerRate = 0, lastCamX = null, lastCamY = 0, lastBT = null, camSpeed = 0;
  function drawBreath(F) {
    if (!GFX.coldBreath || !hasFrame(F)) return;
    stats.breath = 0;
    const cold = coldness(F.map, F.tod); if (cold <= 0.05) return;
    const list = F.sprList, w = F.w, h = F.h, S = F.S || 1, fb = F.fb, dbuf = F.dbuf, T = F.animT, still = !!GFX.reduceMotion;
    const pl = Math.hypot(F.planeX, F.planeY), ez = eyeZ(F), m = F.map;
    // --- the others: the nearest few that can breathe ---
    let n = 0;
    for (let i = list.length - 1; i >= 0 && n < config.breath.maxBreathers; i--) {
      const e = list[i]; if (!breathes(e) || !e._screen) continue;
      const sc = e._screen; if (sc.dist > config.breath.range || sc.dist < 0.6) continue;
      const alpha = e.animAlpha == null ? 1 : e.animAlpha; if (alpha < 0.5) continue;
      n++;
      const period = (e.kind === 'enemy' && e.state && e.state !== 'idle' && e.state !== 'passive') ? 1.5 : 3.3;   // a creature in a fight pants
      const ph = (((T + phaseOf(e)) / period) % 1 + 1) % 1, life = ph * period;
      if (life > PUFF) continue;
      for (let k = 0; k < 2; k++) {
      const tau = life / PUFF - k * 0.2; if (tau <= 0) continue;
      const sp = (typeof Engine !== 'undefined' && Engine.sprites[e.animSprite || e.sprite]) || null;
      const scale = e.scale || 1, hs = sp ? (sp.hs || 1) : 1, head = LOW_HEAD[e.sprite] || LOW_HEAD[e.type] || 0.86;
      const heading = Number.isFinite(e.facing) ? e.facing : (Number.isFinite(e.dir) ? e.dir : 0);
      // the mouth, a hand in front of the face; the puff rises and drifts forward as it thins
      const fx = Math.cos(heading), fy = Math.sin(heading), fwd = 0.12 * scale + 0.25 * tau * (still ? 0 : 1);
      const px = e.x + fx * fwd, py = e.y + fy * fwd;
      const gz = F.relief ? F.gAt(e.x, e.y, clamp(e.x | 0, 0, m.w - 1), clamp(e.y | 0, 0, m.h - 1)) : 0;
      const pz = gz + (head * scale * hs) + 0.13 * tau * (still ? 0 : 1) + (e.yOff || 0);
      const t = proj(F, px, py); if (t < 0.3) continue;
      const sxp = (w / 2) * (1 + pTrX / t), syp = F.horizon + (ez - pz) * h / t;
      const rad = (0.04 + 0.085 * tau) * (h / t) * 1.15 + 0.9 * S;
      const a = (k ? 0.7 : 1) * 0.5 * cold * (1 - tau) * (1 - tau) * Math.min(1, tau * 7 + 0.3) * clamp(1 - sc.dist / (config.breath.range + 1), 0.25, 1);
      puff(F, sxp, syp, rad, a, t - 0.12, 1);
      }
      stats.breath++;
    }
    // --- your own: from the bottom of the view, quickening as you move ---
    if (!still) ownBreath(F, cold, T);
  }
  function puff(F, cx, cy, r, a, depth, squash) {
    const w = F.w, h = F.h, fb = F.fb, dbuf = F.dbuf;
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r * squash)), y1 = Math.min(h - 1, Math.ceil(cy + r * squash));
    const ir = 1 / r, is = 1 / (r * squash);
    for (let y = y0; y <= y1; y++) {
      const v = (y - cy) * is; let o = y * w + x0;
      for (let x = x0; x <= x1; x++, o++) {
        const u = (x - cx) * ir, q = u * u + v * v; if (q >= 1) continue;
        if (depth > 0 && dbuf[o] < depth) continue;
        const f = (1 - q); const k = a * f * f;
        if (k < 0.004) continue;
        fb[o] = blend(fb[o], 226, 234, 246, k);
      }
    }
  }
  function ownBreath(F, cold, T) {
    const w = F.w, h = F.h, S = F.S || 1, cam = F.cam;
    const dt = lastBT == null ? 0 : clamp(T - lastBT, 0, 0.1); lastBT = T;
    if (lastCamX != null && dt > 0) {
      const d = Math.hypot(cam.x - lastCamX, cam.y - lastCamY);
      camSpeed += ((d < 1 ? d / dt : camSpeed) - camSpeed) * Math.min(1, dt * 4);   // a teleport (a door) is not a sprint
    }
    lastCamX = cam.x; lastCamY = cam.y;
    // calm breathing every ~3.6 s, ~1.8 s at a run
    const rate = (1 / 3.6) * (1 + 1.0 * clamp(camSpeed / 3.2, 0, 1));
    playerPhase = (playerPhase + dt * rate) % 1;
    if (playerPhase > 0.34) return;
    const tau = playerPhase / 0.34;
    for (let j = 0; j < 3; j++) {
      const tj = clamp(tau * 1.15 - j * 0.14, 0, 1); if (tj <= 0) continue;
      const cx = w * (0.5 + (j - 1) * 0.045 + 0.02 * Math.sin(j * 2.3 + playerPhase * 9)), cy = h - (4 + tj * 30) * S;
      const r = (4 + tj * 12 + j * 1.5) * S, a = 0.3 * cold * (1 - tj) * Math.min(1, tj * 8);
      puff(F, cx, cy, r, a, 0, 0.7);
    }
  }

  // ==================================================================
  //  6. FOOTPRINTS
  // ==================================================================
  const MN = 16, MH = (MN - 1) / 2;
  function makeMask(fn) { const m = new Uint8Array(MN * MN); for (let y = 0; y < MN; y++) for (let x = 0; x < MN; x++) { const u = (x - MH) / MH, v = (y - MH) / MH; m[y * MN + x] = clamp(fn(u, v), 0, 1) * 255 | 0; } return m; }
  // v runs from the toe (-1) to the heel (+1); a boot sole, a heel, with a gap between
  const bootQ = (u, v) => Math.min(((u / 0.46) ** 2 + ((v + 0.38) / 0.6) ** 2), ((u / 0.34) ** 2 + ((v - 0.66) / 0.3) ** 2));
  const pawQ = (u, v) => {
    let q = ((u / 0.42) ** 2 + ((v - 0.25) / 0.32) ** 2);
    for (const [tx, ty] of [[-0.46, -0.28], [-0.16, -0.62], [0.16, -0.62], [0.46, -0.28]]) q = Math.min(q, ((u - tx) ** 2 + (v - ty) ** 2) / 0.022);
    return q;
  };
  const MASKS = [
    makeMask((u, v) => (1 - bootQ(u, v)) * 3.2),                                  // 0 boot, solid (mud)
    makeMask((u, v) => 1 - Math.abs(bootQ(u, v) - 0.82) / 0.3),                   // 1 boot, ring (water)
    makeMask((u, v) => (1 - pawQ(u, v)) * 3.2),                                   // 2 paw, solid
    makeMask((u, v) => 1 - Math.abs(pawQ(u, v) - 0.82) / 0.3),                    // 3 paw, ring
  ];
  const CAP_MAX = 60;
  const prints = []; for (let i = 0; i < CAP_MAX; i++) prints.push({ on: false, x: 0, y: 0, z: 0, c: 1, s: 0, r: 0.2, kind: 0, paw: 0, born: 0, seq: 0 });
  let printSeq = 0, printMap = null, printHead = 0, clockT = 0;

  function printCount() { let n = 0; for (let i = 0; i < CAP_MAX; i++) if (prints[i].on) n++; return n; }
  function clearPrints() { for (let i = 0; i < CAP_MAX; i++) prints[i].on = false; printMap = null; printHead = 0; trackers = new WeakMap(); pTrack.has = false; }
  function trimPrints() {   // a lower cap drops the oldest at once
    while (printCount() > config.footprints.cap) { let best = null; for (let i = 0; i < CAP_MAX; i++) if (prints[i].on && (!best || prints[i].seq < best.seq)) best = prints[i]; if (!best) break; best.on = false; }
  }
  function wetGround() {
    try { const s = typeof Weather !== 'undefined' && Weather.state; return s === 'rain' || s === 'storm'; } catch (e) { return false; }
  }
  // 0 = not a surface that takes a print, 1 = mud, 2 = shallow water
  function surfaceAt(map, x, y) {
    if (!map || !(x >= 0) || !(y >= 0)) return 0;
    const ix = x | 0, iy = y | 0; if (ix >= map.w || iy >= map.h) return 0;
    if (map.cells[iy * map.w + ix]) return 0;
    const fc = map.floorCells, idx = fc ? fc[iy * map.w + ix] : 0;
    const name = idx && map.floorTextures ? map.floorTextures[idx] : map.floor;
    if (name === 't_shallows') return 2;
    if (!map.outdoor) return 0;
    if (name.startsWith('t_moss')) return 1;                 // the marsh moss of the clearing and the Deep Woods (and painted20's variants)
    if (name.startsWith('t_grass') && wetGround()) return 1; // grass goes to mud in the rain
    return 0;
  }
  function addPrint(map, x, y, heading, r, paw) {
    const kind = surfaceAt(map, x, y); if (!kind) return null;
    if (printMap && printMap !== map) clearPrints();
    printMap = map;
    // a ring buffer: the oldest print is the one overwritten when the cap is reached
    let slot = null;
    for (let i = 0; i < CAP_MAX; i++) if (!prints[i].on) { slot = prints[i]; break; }
    if (!slot) { let best = prints[0]; for (let i = 1; i < CAP_MAX; i++) if (prints[i].seq < best.seq) best = prints[i]; slot = best; }
    if (printCount() >= config.footprints.cap) { let best = null; for (let i = 0; i < CAP_MAX; i++) if (prints[i].on && (!best || prints[i].seq < best.seq)) best = prints[i]; if (best) slot = best; }
    slot.on = true; slot.x = x; slot.y = y; slot.z = 0; slot.r = r; slot.kind = kind; slot.paw = paw ? 1 : 0;
    slot.c = Math.cos(heading); slot.s = Math.sin(heading); slot.born = clockT; slot.seq = ++printSeq;
    return slot;
  }
  let trackers = new WeakMap();           // entity -> { x, y, acc, side }
  const pTrack = { has: false, x: 0, y: 0, acc: 0, side: 1, hx: 1, hy: 0 };
  function scanSteps(F) {
    const map = F.map, cam = F.cam;
    if (printMap && printMap !== map) clearPrints();
    clockT = F.animT;
    // you
    if (pTrack.has) {
      const dx = cam.x - pTrack.x, dy = cam.y - pTrack.y, d = Math.hypot(dx, dy);
      if (d > 2) { pTrack.acc = 0; }                            // a door, a teleport: no trail across it
      else if (d > 1e-4) {
        pTrack.hx = dx / d; pTrack.hy = dy / d; pTrack.acc += d;
        let guard = 0;
        while (pTrack.acc >= config.footprints.stride && guard++ < 3) {
          pTrack.acc -= config.footprints.stride; pTrack.side = -pTrack.side;
          const hx = pTrack.hx, hy = pTrack.hy, off = 0.1 * pTrack.side;
          const grounded = !(typeof G !== 'undefined' && G.player && G.player.fallFrom != null);
          if (grounded) addPrint(map, cam.x - hy * off - hx * 0.12, cam.y + hx * off - hy * 0.12, Math.atan2(hy, hx), 0.26, false);
        }
      }
    }
    pTrack.has = true; pTrack.x = cam.x; pTrack.y = cam.y;
    // walking enemies near you
    if (typeof G === 'undefined' || !G.ents) return;
    const ents = G.ents, R2 = config.footprints.range * config.footprints.range;
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (!e || e.kind !== 'enemy' || e.hidden || e.dead || !e.sprite) continue;
      let tr = trackers.get(e);
      const dxc = e.x - cam.x, dyc = e.y - cam.y;
      if (dxc * dxc + dyc * dyc > R2 || (e.yOff || 0) < 0 || GHOST[e.sprite] || NO_FOOT.has(e.sprite) || NO_FOOT.has(e.type)) { if (tr) trackers.delete(e); continue; }
      if (!tr) { trackers.set(e, { x: e.x, y: e.y, acc: 0, side: 1 }); continue; }
      const dx = e.x - tr.x, dy = e.y - tr.y, d = Math.hypot(dx, dy);
      tr.x = e.x; tr.y = e.y;
      if (d > 1.5) { tr.acc = 0; continue; }
      if (d < 1e-4) continue;
      tr.acc += d;
      const stride = config.footprints.enemyStride * Math.max(0.5, Math.min(1.5, (e.scale || 1) * (LOW_HEAD[e.sprite] ? 0.7 : 1)));
      if (tr.acc >= stride) {
        tr.acc -= stride; tr.side = -tr.side;
        const hx = dx / d, hy = dy / d, off = 0.1 * (e.scale || 1) * tr.side, big = Math.max(0.85, e.scale || 1);
        addPrint(map, e.x - hy * off - hx * 0.1, e.y + hx * off - hy * 0.1, Math.atan2(hy, hx), (LOW_HEAD[e.sprite] ? 0.17 : 0.26) * big, !!LOW_HEAD[e.sprite]);
      }
    }
  }
  const NO_FOOT = new Set(['mites', 'hushmoth', 'horn', 'weaverling_x', 'kestrel', 'fretcrawler', 'miredrone']);

  function drawPrints(F) {
    if (!GFX.footprints || !hasFrame(F) || !F.gAt) return;
    stats.prints = 0;
    scanSteps(F);
    if (!printCount()) return;
    const w = F.w, h = F.h, fb = F.fb, dbuf = F.dbuf, mbuf = F.mbuf, bias = F.surfBias == null ? 0.45 : F.surfBias;
    const cam = F.cam, camx = cam.x, camy = cam.y, dirX = F.dirX, dirY = F.dirY, planeX = F.planeX, planeY = F.planeY, relief = F.relief;
    const pl = Math.hypot(planeX, planeY), ez = eyeZ(F), life = config.footprints.life;
    for (let i = 0; i < CAP_MAX; i++) {
      const p = prints[i]; if (!p.on) continue;
      const age = clockT - p.born;
      if (age >= life || age < -1) { if (age >= life) p.on = false; continue; }
      const k = Math.pow(1 - clamp(age, 0, life) / life, 1.15);
      if (k < 0.02) continue;
      const t = proj(F, p.x, p.y); if (t < 0.25 || t > Math.min(14, F.fogDist * 1.1)) continue;
      const gz = relief ? F.gAt(p.x, p.y, clamp(p.x | 0, 0, F.map.w - 1), clamp(p.y | 0, 0, F.map.h - 1)) : 0;
      const dz = ez - gz; if (dz < 0.05) continue;
      const r = p.r, tn = Math.max(0.12, t - r * 1.2), tf = t + r * 1.2;
      const yHi = F.horizon + h * dz / tn, yLo = F.horizon + h * dz / tf;
      const margin = relief ? 3 + ((r * 1.3 * h / t) | 0) : 2;
      const y0 = Math.max(0, Math.floor(yLo - margin)), y1 = Math.min(h - 1, Math.ceil(yHi + margin));
      const cxs = (w / 2) * (1 + pTrX / t), half = (w / 2) * (r * 1.3) / (pl * tn);
      const x0 = Math.max(0, Math.floor(cxs - half)), x1 = Math.min(w - 1, Math.ceil(cxs + half));
      if (y1 < y0 || x1 < x0) continue;
      const mask = MASKS[(p.kind === 2 ? 1 : 0) + p.paw * 2], ir = 1 / r, c = p.c, sn = p.s;
      const water = p.kind === 2, str = (water ? 0.62 : 1.0) * k;
      stats.prints++;
      for (let y = y0; y <= y1; y++) {
        let o = y * w + x0;
        for (let x = x0; x <= x1; x++, o++) {
          const mt = mbuf[o]; if (mt !== 5 && mt !== 3) continue;
          const tt = dbuf[o] - bias, cx = 2 * x / w - 1;
          const wx = camx + tt * (dirX + planeX * cx), wy = camy + tt * (dirY + planeY * cx);
          const dx = wx - p.x, dy = wy - p.y;
          // toward the heading is the toe (v = -1)
          const u = (-dx * sn + dy * c) * ir, v = -(dx * c + dy * sn) * ir;
          if (u < -1 || u > 1 || v < -1 || v > 1) continue;
          const cov = mask[(((v + 1) * MH) | 0) * MN + (((u + 1) * MH) | 0)]; if (!cov) continue;
          if (relief) { if (wx < 0 || wy < 0 || (wx | 0) >= F.map.w || (wy | 0) >= F.map.h) continue; const g = F.gAt(wx, wy, wx | 0, wy | 0), zp = cam.z - (y - F.horizon) * tt / h; if (Math.abs(zp - g) > 0.1 + 1.6 * tt / h || Math.abs(g - gz) > 0.5) continue; }
          const a = (cov / 255) * str;
          const px = fb[o], r0 = px & 255, g0 = (px >> 8) & 255, b0 = (px >> 16) & 255;
          let nr, ng, nb;
          if (water) {   // a ring of disturbed, paler water
            nr = r0 + a * (Math.min(255, r0 * 1.9 + 44) - r0); ng = g0 + a * (Math.min(255, g0 * 1.9 + 50) - g0); nb = b0 + a * (Math.min(255, b0 * 1.8 + 56) - b0);
          } else {       // a dark, damp press in the ground with a wet lip of lighter mud around it
            const core = cov > 90 ? clamp((cov - 90) / 120, 0, 1) : 0, lip = 1 - Math.abs(cov - 90) / 90;
            const dk = 0.5 * core * str, lt = lip > 0 ? 0.22 * lip * str : 0;
            nr = r0 * (1 - dk) + lt * (r0 * 0.5 + 14); ng = g0 * (1 - 0.94 * dk) + lt * (g0 * 0.5 + 12); nb = b0 * (1 - 0.82 * dk) + lt * (b0 * 0.5 + 10);
          }
          fb[o] = (px & 0xff000000) | ((nb < 0 ? 0 : nb > 255 ? 255 : nb | 0) << 16) | ((ng < 0 ? 0 : ng > 255 ? 255 : ng | 0) << 8) | (nr < 0 ? 0 : nr > 255 ? 255 : nr | 0);
          stats.pixels++;
        }
      }
    }
  }

  // ------------------------------------------------------------------
  //  wiring
  // ------------------------------------------------------------------
  function clockHook(F) { lastT = F.animT; }
  function wire() {
    if (typeof Engine !== 'undefined' && Engine.addPostHook) {
      const guard = (name, fn) => (F) => { try { fn(F); } catch (err) { if (!guard['w' + name]) { guard['w' + name] = true; console.warn('air11 ' + name + ' failed', err); } } };
      Engine.addPostHook(guard('clock', clockHook), -50);
      Engine.addPostHook(guard('prints', timed('prints', drawPrints)), 5);
      Engine.addPostHook(guard('shafts', timed('shafts', drawShafts)), 28);
      Engine.addPostHook(guard('haze', timed('haze', drawHaze)), 35);
      Engine.addPostHook(guard('glare', timed('glare', drawGlare)), 36);
      Engine.addPostHook(guard('breath', timed('breath', drawBreath)), 38);
      Engine.addPostHook(guard('ghosts', timed('ghosts', drawGhosts)), 41);
    }
    wrapRender();
    if (typeof loadMap === 'function') {
      const _loadMap = loadMap;
      loadMap = function () { try { clearPrints(); SH.map = null; } catch (e) { console.warn('air11 clear failed', e); } return _loadMap.apply(this, arguments); };
    }
    if (typeof GFX !== 'undefined') GFX.onChange(() => {
      if (!GFX.footprints) clearPrints();
      if (!mineChanging) for (const k of AIR_FLAGS) if (stored[k] !== null && GFX[k] !== stored[k]) { stored[k] = null; saveSettings(); }   // a preset took over
    });
    if (typeof renderAccessibilityMenu === 'function') {
      const _acc = renderAccessibilityMenu;
      renderAccessibilityMenu = function () {
        const r = _acc.apply(this, arguments);
        try { appendRows(); } catch (e) { console.warn('air11 rows failed', e); }
        return r;
      };
    }
  }
  const ROWS = [
    ['sunShafts', 'Sun shafts', 'beams through the canopy and Cloister windows, by day', 'air-shafts'],
    ['heatHaze', 'Heat haze', 'a shimmer over fires and the Steam Golem (off with Reduce motion)', 'air-haze'],
    ['glassGlare', 'Light-glass glare', 'a halo and rippling air around Light-glass', 'air-glare'],
    ['seeThrough', 'See-through ghosts', 'spectral creatures drawn half-transparent', 'air-ghosts'],
    ['coldBreath', 'Cold breath', 'visible breath at night and in cold places', 'air-breath'],
    ['footprints', 'Footprints', 'prints in mud and shallow water, for this visit only', 'air-prints'],
  ];
  function el(tag, props, text) {
    const e = document.createElement(tag);
    if (props) for (const k in props) e.setAttribute(k, props[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function appendRows() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById('air-shafts')) return;
    for (const [flag, label, hint, id] of ROWS) {
      const s = el('span', { class: 'gfx-label' }, label); s.appendChild(document.createTextNode(' ')); s.appendChild(el('small', { class: 'muted' }, hint));
      const b = el('button', { class: 'dfbtn small', id, type: 'button' }, '');
      b.setAttribute('aria-label', label);
      const sync = () => { b.textContent = GFX[flag] ? 'On' : 'Off'; b.setAttribute('aria-pressed', GFX[flag] ? 'true' : 'false'); b.classList.toggle('sel', !!GFX[flag]); };
      b.onclick = () => { setFlag(flag, !GFX[flag]); sync(); };
      sync(); grid.appendChild(s); grid.appendChild(b);
    }
  }

  loadSettings();
  wire();
  return {
    config, stats, FLAGS: AIR_FLAGS, stored, setFlag, appendRows, ROWS,
    get profile() { return profile; }, set profile(v) { profile = !!v; },
    sun: { amount: sunAmount, shafts: () => SH.list, build: buildShafts, dayness },
    heat: { of: heatOf },
    glass: { of: glassOf },
    ghost: { base: ghostBase, alpha: ghostAlpha, kinds: GHOST, MIN_ALPHA },
    breath: { coldness, breathes, COLD_MAPS },
    prints: { list: prints, count: printCount, clear: clearPrints, add: addPrint, surfaceAt, masks: MASKS, get cap() { return config.footprints.cap; }, set cap(v) { config.footprints.cap = Math.max(1, Math.min(CAP_MAX, v | 0)); trimPrints(); }, get now() { return clockT; } },
    drawPrints, drawShafts, drawHaze, drawGlare, drawGhosts, drawBreath,
  };
})();
if (typeof window !== 'undefined') window.AIR11 = AIR11;
