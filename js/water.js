// ============================================================
//  water — reflections and step-driven ripples (Phase 2)
//  A post hook (order 25) for every floor of water (2) or shallows (3):
//  it mirrors whatever stands above the waterline in the same column (sky,
//  walls, sprites), tinted by the water, faded with distance and with steep
//  viewing angle. Footsteps of the player, and of enemies and NPCs wading,
//  spawn expanding world-space rings that bend the reflection and catch a
//  faint bright edge. Visual only: nothing here touches movement or swimming.
//  Off (GFX.reflections false) the hook returns before reading anything.
// ============================================================
'use strict';

if (GFX.reflections === undefined) GFX.reflections = true;
if (!GFX.FX.includes('reflections')) GFX.FX.push('reflections');

const WATER = (() => {
  const CAP = 24;          // most rings alive at once
  const LIFE = 1.5;        // seconds a ring lasts
  const SPEED = 1.15;      // world units per second the ring spreads
  const STEP = 0.55;       // distance between the player's ripples
  const SCAN = 0.1;        // seconds between looks at the wading enemies/NPCs
  const BIAS = 0.45;       // the engine's SURF_BIAS: ground depth sits this far behind its distance
  const DEEP_A = 0.8, SHAL_A = 0.58;   // reflection strength on deep water / shallows

  // rings are pooled: nothing is allocated while the game runs
  const free = [], list = [];
  for (let i = 0; i < CAP; i++) free.push({ x: 0, y: 0, t0: 0, s: 1 });
  let now = 0;             // animT of the latest frame
  let curMap = null, cellsRef = null, hasWater = false, kindTab = new Uint8Array(1);
  let havePos = false, px0 = 0, py0 = 0, scanT = 0;
  const entX = new Float32Array(512), entY = new Float32Array(512), entRef = new Array(512).fill(null);
  // scratch buffers, resized only when the render scale changes
  const LUTN = 96, lut = new Float32Array(LUTN + 1);   // one ring's profile across its band, indexed by distance squared
  let copy = new Uint32Array(0), rip = new Float32Array(0), shim = new Int8Array(0), fres = new Float32Array(0);
  // how much of each material is worth reflecting: other, sky, water, shallows, wall, ground, sprite, ceiling
  const WM = new Float32Array([0.6, 1, 0, 0, 0.9, 0.5, 1, 0.5, 1]);   // by Engine.MAT id; 8 = glow (lamps, fire, glass)

  function nameKind(n) { return n === 't_water' ? 2 : n === 't_shallows' ? 1 : 0; }

  // 0 dry, 1 shallows, 2 deep water: the floor under world point (x, y) on the current map
  function kindAt(map, x, y) {
    if (!map || x < 0 || y < 0) return 0;
    const ix = x | 0, iy = y | 0;
    if (ix >= map.w || iy >= map.h) return 0;
    const fc = map.floorCells;
    return kindTab[fc ? fc[iy * map.w + ix] : 0] | 0;
  }

  function newMap(map) {
    curMap = map; cellsRef = map.floorCells; havePos = false;
    clear();
    entRef.fill(null);
    const ft = map.floorTextures, fc = map.floorCells;
    kindTab = new Uint8Array((ft ? ft.length : 0) + 1);   // once per map change, never per frame
    kindTab[0] = nameKind(map.floor);                     // index 0 is the map's own floor, as the engine reads it
    if (ft) for (let i = 1; i < ft.length; i++) kindTab[i] = nameKind(ft[i]);
    hasWater = false;
    if (!fc) { hasWater = kindTab[0] > 0; return; }
    const seen = new Uint8Array(kindTab.length);
    for (let i = 0; i < fc.length; i++) if (fc[i] < seen.length) seen[fc[i]] = 1;
    for (let i = 0; i < seen.length; i++) if (seen[i] && kindTab[i] > 0) hasWater = true;
  }

  function ripple(x, y, strength) {
    if (!GFX.reflections || !(x === x) || !(y === y)) return;   // off means no ring and no work
    const r = free.pop() || list.shift();
    r.x = x; r.y = y; r.t0 = now; r.s = strength > 0 ? Math.min(strength, 2) : 1;
    list.push(r);
  }
  function ripples() { return list; }
  function clear() { while (list.length) free.push(list.pop()); }

  function expire() {
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const r = list[i], age = now - r.t0;
      if (age >= LIFE || age < -0.5) free.push(r); else list[n++] = r;
    }
    list.length = n;
  }

  // enemies and townsfolk wading through water also stir it
  function scanEnts(map, c) {
    if (typeof G === 'undefined' || !G || !G.ents || G.map !== map) return;
    const ents = G.ents, n = Math.min(ents.length, 512);
    let spawned = 0;
    for (let i = 0; i < n; i++) {
      const e = ents[i];
      if (e.kind !== 'enemy' && e.kind !== 'npc') continue;
      if (e.dead || e.hidden) { entRef[i] = null; continue; }
      const dx = e.x - c.x, dy = e.y - c.y;
      if (dx * dx + dy * dy > 196) continue;
      const k = kindAt(map, e.x, e.y);
      if (!k) { entRef[i] = null; continue; }
      if (entRef[i] !== e) { entRef[i] = e; entX[i] = e.x; entY[i] = e.y; continue; }
      const mx = e.x - entX[i], my = e.y - entY[i];
      if (mx * mx + my * my >= 0.16 && spawned < 3) {
        ripple(e.x, e.y, k === 2 ? 0.8 : 0.6); entX[i] = e.x; entY[i] = e.y; spawned++;
      }
    }
  }

  // ring heights into `rip`, only on water pixels, only on the band around each ring
  function buildRipples(F, w, h, hor) {
    rip.fill(0);
    const mb = F.mbuf, db = F.dbuf;
    const dirX = F.dirX, dirY = F.dirY, plX = F.planeX, plY = F.planeY, cx0 = F.cam.x, cy0 = F.cam.y;
    const det = dirX * plY - dirY * plX;
    if (Math.abs(det) < 1e-6) return;
    const flat = !F.relief, posZ = 0.5 * h, half = w * 0.5, P = Math.sqrt(plX * plX + plY * plY);
    const yFirst = hor + 1 > 0 ? hor + 1 : 0;
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      let age = now - r.t0; if (age < 0) age = 0;
      const R = 0.12 + age * SPEED, env = 1 - age / LIFE, amp = r.s * env;
      const wd = 0.22 + age * 0.18, pad = wd * 2.2, rOut = R + pad;
      const rIn = R > pad ? R - pad : 0, rIn2 = rIn * rIn, rOut2 = rOut * rOut, invPad = 1 / pad;
      const relX = r.x - cx0, relY = r.y - cy0;
      const d0 = (relX * plY - relY * plX) / det;       // ring centre: distance along the view
      const lat = (dirX * relY - dirY * relX) / det;    // and sideways, in units of the camera plane
      let ya = yFirst, yb = h - 1;
      if (flat) {
        const dmax = d0 + rOut; if (dmax <= 0.2) continue;
        const dmin = d0 - rOut;
        ya = Math.max(yFirst, Math.floor(hor + posZ / dmax));
        if (dmin > 0.2) yb = Math.min(h - 1, Math.ceil(hor + posZ / dmin));
      }
      // the band's profile, sampled once per ring and looked up per pixel by squared distance (no sqrt, no cos there)
      const span2 = rOut2 - rIn2, lutK = LUTN / span2;
      for (let j = 0; j <= LUTN; j++) {
        const k = Math.sqrt(rIn2 + j / lutK) - R, q = k * invPad, e = 1 - q * q;
        lut[j] = q > 1 || q < -1 ? 0 : amp * e * e * Math.cos(k * 6.5);
      }
      const rx = cx0 - r.x, ry = cy0 - r.y;
      for (let y = ya; y <= yb; y++) {
        // Flat ground has one depth per row, so the ring's band crosses a row in at most two runs of columns:
        // [-lo, -li] and [li, lo] sideways of the ring centre. Relief maps just scan the row.
        let xa = 0, xb = w - 1, xc = 0, xd = -1, d = 0;
        if (flat) {
          d = posZ / (y - hor);
          const dd = d - d0, o2 = rOut2 - dd * dd;
          if (o2 <= 0) continue;
          const lo = Math.sqrt(o2) / P, i2 = rIn2 - dd * dd, li = i2 > 0 ? Math.sqrt(i2) / P : 0;
          if (li > 0) {
            xa = Math.max(0, Math.floor(((lat - lo) / d + 1) * half - 1)); xb = Math.min(w - 1, Math.ceil(((lat - li) / d + 1) * half + 1));
            xc = Math.max(0, Math.floor(((lat + li) / d + 1) * half - 1)); xd = Math.min(w - 1, Math.ceil(((lat + lo) / d + 1) * half + 1));
          } else { xa = Math.max(0, Math.floor(((lat - lo) / d + 1) * half - 1)); xb = Math.min(w - 1, Math.ceil(((lat + lo) / d + 1) * half + 1)); }
        }
        // world offset from the ring centre along the row: flat rows step it evenly, relief reads each pixel's depth
        const bx = rx + d * (dirX - plX), by = ry + d * (dirY - plY), sx = d * plX / half, sy = d * plY / half;
        for (let pass = 0; pass < 2; pass++) {
          if (pass === 1) { if (xd < xc) break; xa = xc; xb = xd; }
          let o = y * w + xa;
          for (let x = xa; x <= xb; x++, o++) {
            const m = mb[o]; if (m !== 2 && m !== 3) continue;
            let wx, wy;
            if (flat) { wx = bx + sx * x; wy = by + sy * x; }
            else { const dp = db[o] - BIAS, u = x / half - 1; wx = rx + dp * (dirX + plX * u); wy = ry + dp * (dirY + plY * u); }
            const q2 = wx * wx + wy * wy;
            if (q2 > rOut2 || q2 < rIn2) continue;             // off the band
            rip[o] += lut[((q2 - rIn2) * lutK + 0.5) | 0];
          }
        }
      }
    }
  }

  function reflect(F) {
    const w = F.w, h = F.h, S = F.S, hor = F.horizon, fb = F.fb, mb = F.mbuf, db = F.dbuf;
    if (hor >= h - 1) return;
    if (copy.length !== w * h) { copy = new Uint32Array(w * h); rip = new Float32Array(w * h); shim = new Int8Array(h); fres = new Float32Array(h); }
    copy.set(fb);                       // reflections read the finished frame, never the one being written
    const T = F.animT, span = h - hor;
    for (let y = 0; y < h; y++) {
      const k = y > hor ? (y - hor) / span : 0;          // 0 at the horizon, 1 at the bottom edge
      fres[y] = 0.45 + 0.55 * (1 - k) * (1 - k);           // grazing view reflects most, looking straight down least
      shim[y] = Math.round(Math.sin(y * 0.55 + T * 2.2) * 1.2 * S);
    }
    const ripOn = list.length > 0;
    if (ripOn) buildRipples(F, w, h, hor);
    const invFog = 1 / ((F.fogDist || 20) * 1.1), invLine = 1 / (0.8 * span), rs = 5 * S, rx = 3 * S;
    const y0 = hor < 1 ? 1 : hor;
    for (let x = 0; x < w; x++) {
      let r0 = -1;
      for (let y = y0; y < h; y++) {
        const o = y * w + x, m = mb[o];
        if (m !== 2 && m !== 3) { r0 = -1; continue; }
        if (r0 < 0) r0 = y;                                // the first dry row above is the waterline
        let rv = ripOn ? rip[o] : 0;
        if (rv > 1.5) rv = 1.5; else if (rv < -1.5) rv = -1.5;
        const wp = fb[o];
        let R = wp & 255, Gc = (wp >> 8) & 255, B = (wp >> 16) & 255;
        const ssy = 2 * r0 - 1 - y + (rv !== 0 ? Math.round(rv * rs) : 0);   // mirrored row, bent by any ring
        if (ssy >= 0 && ssy < h) {
          let sx = x + shim[y] + (rv !== 0 ? Math.round(rv * rx) : 0);
          sx = sx < 0 ? 0 : sx >= w ? w - 1 : sx;
          const so = ssy * w + sx;
          const wm = WM[mb[so]];
          if (wm > 0) {
            const df = 1 - (db[o] - BIAS) * invFog, lf = 1 - (y - r0) * invLine;
            if (df > 0 && lf > 0) {
              const a = (m === 2 ? DEEP_A : SHAL_A) * fres[y] * wm * df * lf;
              const sp = copy[so];
              // the reflection takes the water's own colour: dark water gives a dark, blue-green mirror
              R += ((sp & 255) * (0.7 + R * 0.00118) - R) * a;
              Gc += (((sp >> 8) & 255) * (0.7 + Gc * 0.00118) - Gc) * a;
              B += (((sp >> 16) & 255) * (0.7 + B * 0.00118) - B) * a;
            }
          }
        }
        if (rv > 0.02) { const e = rv * 60; R += e * 0.8; Gc += e * 0.95; B += e; }        // bright crest
        else if (rv < -0.02) { const e = rv * 30; R += e; Gc += e; B += e; }             // dark trough
        R = R > 255 ? 255 : R < 0 ? 0 : R; Gc = Gc > 255 ? 255 : Gc < 0 ? 0 : Gc; B = B > 255 ? 255 : B < 0 ? 0 : B;
        fb[o] = (255 << 24) | ((B | 0) << 16) | ((Gc | 0) << 8) | (R | 0);
      }
    }
  }

  function hook(F) {
    if (!GFX.reflections) return;
    const map = F.map; if (!map) return;
    if (map !== curMap || map.floorCells !== cellsRef) newMap(map);
    if (!hasWater) return;
    const T = F.animT;
    if (T < now - 0.5) { clear(); havePos = false; scanT = T; }     // time was set well back: forget the old rings
    now = T;
    const c = F.cam, k = kindAt(map, c.x, c.y);
    if (k > 0) {
      if (!havePos) { px0 = c.x; py0 = c.y; havePos = true; }
      else {
        const dx = c.x - px0, dy = c.y - py0, d2 = dx * dx + dy * dy;
        if (d2 > 9) { px0 = c.x; py0 = c.y; }                       // teleported, not walked
        else if (d2 >= STEP * STEP) { ripple(c.x, c.y, k === 2 ? 1 : 0.75); px0 = c.x; py0 = c.y; }
      }
    } else havePos = false;
    if (now - scanT >= SCAN || now < scanT) { scanT = now; scanEnts(map, c); }
    expire();
    reflect(F);
  }

  if (typeof Engine !== 'undefined' && Engine.addPostHook) Engine.addPostHook(hook, 25);
  if (typeof GFX.onChange === 'function') GFX.onChange(() => { if (!GFX.reflections) clear(); });

  return { ripple, ripples, clear, CAP, LIFE, kindAt(x, y) {   // for tests and other modules: the water kind under a point on the current map
      const m = typeof G !== 'undefined' && G ? G.map : null;
      if (m && (m !== curMap || m.floorCells !== cellsRef)) newMap(m);
      return kindAt(m, x, y);
    } };
})();
