// ============================================================
//  ceilings — painted Cloister vaults, tavern beams and cave rock.
//
//  Phase 20: three hand-built 64x64 pixel-art tiles (fixed palettes, hard
//  outlines, ordered dither), painted once at load. They replace the Phase 2
//  procedural stand-ins under the same names. The engine already
//  supports per-cell ceiling textures (map.ceilTextures + map.ceilCells); this
//  module only fills them in, leaving every map's cells, entities, ceilZ and
//  floor alone. GFX.ceilings switches it off (map.ceilCells = null gives back
//  each map's original single ceiling texture).
//
//  Texture memory: 3 tiles x 64x64x4 B = 49,152 B (counted by DECALS.budgetBytes()).
// ============================================================
'use strict';

if (GFX.ceilings === undefined) GFX.ceilings = true;
if (!GFX.FX.includes('ceilings')) GFX.FX.push('ceilings');

const CEILINGS = (() => {
  const T = 64;
  const textures = ['c_beams', 'c_vault', 'c_rock'];
  let generated = 0;

  const clamp8 = (v) => v < 0 ? 0 : v > 255 ? 255 : v | 0;
  const px = (r, g, b) => ((255 << 24) | (clamp8(b) << 16) | (clamp8(g) << 8) | clamp8(r)) >>> 0;
  function hash(ix, iy, seed) {
    let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(seed | 0, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  // value noise that wraps every `per` lattice cells, so a tile joins its neighbours
  function tnoise(x, y, per, seed) {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const m = (v) => ((v % per) + per) % per;
    const a = hash(m(x0), m(y0), seed), b = hash(m(x0 + 1), m(y0), seed), c = hash(m(x0), m(y0 + 1), seed), d = hash(m(x0 + 1), m(y0 + 1), seed);
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
  }
  // fractal noise across the whole 64px tile at `f` lattice cells, wrapping
  const tfbm = (x, y, f, seed) => tnoise(x / T * f, y / T * f, f, seed) * 0.55 + tnoise(x / T * f * 2, y / T * f * 2, f * 2, seed + 7) * 0.3 + tnoise(x / T * f * 4, y / T * f * 4, f * 4, seed + 13) * 0.15;
  function register(name, data) { Engine.addTexture(name, data); generated += data.length * 4; return data; }

  // ---- Phase 20: hand-built pixel art --------------------------------------
  // Each tile is drawn the way a pixel artist would: a small fixed palette per
  // material, hard outlines, one light direction (from the room's lamps, upper
  // left), shading by ordered dither instead of noise. Detail is placed by hand
  // (coordinates below) or from a seeded hash, so every load paints the same tile.
  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const dith = (x, y) => (BAYER4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;   // 0..1 threshold
  // pick ramp[i] for a 0..1 tone, dithered between neighbouring steps
  function ramp(pal, t, x, y) {
    const v = Math.max(0, Math.min(0.999, t)) * (pal.length - 1), i = v | 0;
    return pal[(v - i) > dith(x, y) ? Math.min(pal.length - 1, i + 1) : i];
  }
  // the same steps without the dither: ceilings are seen at grazing angles, where a fine checker turns to shimmer
  function band(pal, t) { return pal[Math.max(0, Math.min(pal.length - 1, Math.floor(Math.max(0, Math.min(0.999, t)) * pal.length)))]; }
  const hex = (s) => px(parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16));
  const pal = (...a) => a.map(hex);

  // ---- c_beams: a squared oak beam over lime plaster, soot along its flanks ---
  function paintBeams() {
    const d = new Uint32Array(T * T);
    const PL = pal('#5e5244', '#7a6c58', '#978670', '#ad9c80', '#c2b292', '#d2c4a4');   // plaster, soot to clean
    const OAK = pal('#24160c', '#3a2414', '#4f321b', '#634024', '#76502e', '#8c623a');  // oak, shadow to lit edge
    const B0 = 22, B1 = 41;                                                              // the beam: rows 22..41
    // grain: long streaks along x, placed by hand per row band (start, length, row)
    const GRAIN = [[2, 19, 25], [27, 30, 25], [6, 22, 28], [36, 24, 29], [0, 13, 32], [18, 28, 31], [50, 14, 33], [9, 25, 35], [41, 20, 36], [3, 17, 38], [26, 31, 38], [55, 9, 34], [14, 12, 27]];
    const CRACKS = [[[6, 3], [9, 6], [9, 9], [13, 12]], [[44, 51], [47, 54], [46, 58], [50, 61]], [[30, 2], [31, 5], [35, 7]]];
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      let c;
      if (y >= B0 && y <= B1) {
        // body: lit along the top face, darker toward the underside
        const k = 1 - (y - B0) / (B1 - B0);
        c = band(OAK, 0.32 + 0.38 * k);
        if (y === B0 || y === B1) c = OAK[0];                 // outline
        else if (y === B0 + 1) c = OAK[5];                     // arris catching the lamp
        else if (y === B0 + 2) c = OAK[4];
        else if (y === B1 - 1) c = OAK[1];                     // underside shadow
      } else {
        // plaster: soot darkens it near the beam (both sides), dithered in bands
        const dist = y < B0 ? B0 - y : y - B1;
        const soot = Math.max(0, 1 - dist / 14);
        c = band(PL, 0.92 - soot * 0.75 + (hash(x >> 3, y >> 3, 33) - 0.5) * 0.12);
        if (dist === 1) c = PL[0];                             // the beam's cast shadow line
      }
      d[y * T + x] = c;
    }
    for (const [x0, len, row] of GRAIN) for (let k = 0; k < len; k++) { const x = (x0 + k) & 63; d[row * T + x] = OAK[k % 9 === 4 ? 1 : 2]; }
    // a knot with a lighter ring, and an adze scallop on the lit arris
    for (let y = -2; y <= 2; y++) for (let x = -3; x <= 3; x++) { const r = (x * x) / 9 + (y * y) / 4; if (r <= 1) d[(31 + y) * T + ((46 + x) & 63)] = r < 0.35 ? OAK[0] : r < 0.75 ? OAK[1] : OAK[4]; }
    for (const ax of [12, 13, 14, 38, 39]) d[(B0 + 1) * T + ax] = OAK[3];
    // two iron pegs
    for (const [x, y] of [[20, 30], [52, 30]]) { d[y * T + x] = hex('#1a1a1c'); d[y * T + x + 1] = hex('#3c3c40'); d[(y + 1) * T + x] = hex('#2a2a2e'); d[(y + 1) * T + x + 1] = hex('#1a1a1c'); }
    // hairline cracks in the plaster
    for (const cr of CRACKS) for (let i = 0; i + 1 < cr.length; i++) {
      const [ax, ay] = cr[i], [bx, by] = cr[i + 1], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      for (let k = 0; k <= n; k++) { const x = Math.round(ax + (bx - ax) * k / n) & 63, y = Math.round(ay + (by - ay) * k / n) & 63; if (y < B0 - 1 || y > B1 + 1) d[y * T + x] = PL[1]; }
    }
    return d;
  }

  // ---- c_vault: a ribbed cross-vault, lilac fresco with gilt stars -----------
  function paintVault() {
    const d = new Uint32Array(T * T), C = 31.5;
    const LIL = pal('#3e2c4e', '#523c66', '#68507e', '#7e6694', '#9580a8', '#ab98bc');   // fresco, deep to lit
    const RIB = pal('#3e383c', '#5e585a', '#7c7676', '#9a928c', '#b2aaa0');               // dressed stone
    const GOLD = pal('#5c3e14', '#8e6424', '#c09034', '#e8c060', '#fff0b0');
    const PLASTER = hex('#bcae98');
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const dx = x - C, dy = y - C, ax = Math.abs(dx), ay = Math.abs(dy);
      const diag = Math.abs(ax - ay) / 1.414;                // distance to a diagonal rib
      const edge = Math.min(x, y, 63 - x, 63 - y);           // distance to a transverse rib
      let c;
      if (diag < 2.2 || edge < 2) {
        // ribs: lit on the upper-left flank, a dark line on the lower-right
        const onDiag = diag < 2.2, sgn = onDiag ? ((dx > 0) === (dy > 0) ? (dx - dy) : (dx + dy)) : 0;
        let t = onDiag ? 0.62 + (sgn < 0 ? 0.25 : -0.1) : (x < 2 || y < 2 ? 0.8 : 0.35);
        if (onDiag && diag > 1.6) t = 0.15; if (!onDiag && edge === 1 && (x >= 62 || y >= 62)) t = 0.1;
        c = band(RIB, t);
        if (!onDiag && edge === 0) c = RIB[1];
      } else {
        // the panel curves down into its ribs: lit in the middle, dark at the springing
        const toRib = Math.min(diag, edge * 1.1);
        c = band(LIL, 0.2 + Math.min(1, toRib / 13) * 0.7);
        if (toRib < 3) c = LIL[0];
      }
      d[y * T + x] = c;
    }
    // the gilt boss where the ribs cross
    for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {
      const r = Math.hypot(x + 0.5, y + 0.5); if (r > 5.2) continue;
      d[(32 + y) * T + 32 + x] = r > 4.3 ? GOLD[0] : (x + y < -3 ? GOLD[4] : x + y < 1 ? GOLD[3] : r > 3 ? GOLD[1] : GOLD[2]);
    }
    // one eight-point gilt star in each panel, hand-placed pixels
    const STAR = ['....#....', '....#....', '.#..#..#.', '..#.#.#..', '####O####', '..#.#.#..', '.#..#..#.', '....#....', '....#....'];
    for (const [sx, sy] of [[32, 13], [32, 51], [13, 32], [51, 32]]) STAR.forEach((row, j) => { for (let i = 0; i < 9; i++) { const ch = row[i]; if (ch === '.') continue; d[(sy - 4 + j) * T + sx - 4 + i] = ch === 'O' ? GOLD[4] : (i + j < 8 ? GOLD[3] : GOLD[2]); } });
    // small gilt dots on a lozenge grid inside the panels
    for (let y = 4; y < 60; y += 6) for (let x = 4 + ((y / 6) & 1) * 3; x < 60; x += 6) {
      const ax = Math.abs(x - C), ay = Math.abs(y - C);
      if (Math.abs(ax - ay) < 5 || Math.min(x, y, 63 - x, 63 - y) < 5) continue;
      if ([[32, 13], [32, 51], [13, 32], [51, 32]].some(([a, b]) => Math.abs(a - x) < 6 && Math.abs(b - y) < 6)) continue;
      d[y * T + x] = GOLD[2];
    }
    // flaked fresco: two patches where the plaster shows, with a dark rim
    for (const [fx, fy, fr] of [[20, 9, 3.2], [48, 43, 2.6], [10, 46, 2]]) for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
      const r = Math.hypot(x, y * 1.3) + (hash(x + fx, y + fy, 49) - 0.5) * 1.2; if (r > fr) continue;
      const o = (fy + y) * T + fx + x; if (o < 0 || o >= T * T) continue;
      d[o] = r > fr - 0.9 ? LIL[0] : PLASTER;
    }
    return d;
  }

  // ---- c_rock: faceted cave rock, crevices between the facets ----------------
  function paintRock() {
    const d = new Uint32Array(T * T);
    const ROCK = pal('#1c1916', '#2f2a25', '#433c34', '#575045', '#6c6455', '#837a68', '#9a917c');
    // facet centres on a jittered 5x5 grid that wraps, so the tile joins its neighbours
    const N = 5, cell = T / N, pts = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) pts.push([(i + 0.2 + hash(i, j, 61) * 0.6) * cell, (j + 0.2 + hash(i, j, 62) * 0.6) * cell, hash(i, j, 63)]);
    const near = (x, y) => {
      let b1 = 1e9, b2 = 1e9, k1 = 0;
      for (let k = 0; k < pts.length; k++) {
        let ddx = Math.abs(x - pts[k][0]), ddy = Math.abs(y - pts[k][1]); if (ddx > T / 2) ddx = T - ddx; if (ddy > T / 2) ddy = T - ddy;
        const dd = Math.max(ddx, ddy) * 0.55 + (ddx + ddy) * 0.45;   // an angular metric: broken planes, not cobbles
        if (dd < b1) { b2 = b1; b1 = dd; k1 = k; } else if (dd < b2) b2 = dd;
      }
      return [k1, b2 - b1];
    };
    const own = new Int16Array(T * T), gap = new Float32Array(T * T);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const [k, g] = near(x + 0.5, y + 0.5); own[y * T + x] = k; gap[y * T + x] = g; }
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const i = y * T + x, k = own[i], g = gap[i], tilt = pts[k][2];
      // each facet faces the light by its own tilt; inside it brightens toward its upper-left
      const fx = (x + 0.5 - pts[k][0]), fy = (y + 0.5 - pts[k][1]);
      // a ridge splits each facet into a lit plane and a shadowed one
      const ridge = fx * (tilt - 0.5) + fy * (0.5 - tilt * 0.7);
      let t = 0.26 + tilt * 0.34 - (fx + fy) * 0.01 + (ridge > 0 ? 0.14 : -0.04);
      let c = ramp(ROCK, t, x, y);
      if (g < 0.8 + 1.2 * pts[k][2] * hash(k, 3, 64)) c = ROCK[0];  // crevice: some deep, some hairline
      else if (g < 2.4) {
        // the lip of the crevice: lit if it faces the lamp (up-left), dark otherwise
        const up = own[((y - 2) & 63) * T + x] !== k || own[y * T + ((x - 2) & 63)] !== k;
        c = up ? ROCK[Math.min(6, 4 + (tilt > 0.5 ? 1 : 0))] : ROCK[1];
      }
      d[i] = c;
    }
    // pale mineral flecks and a thin seam of glass-green ore, placed sparingly
    for (let n = 0; n < 22; n++) { const x = (hash(n, 1, 67) * T) | 0, y = (hash(n, 2, 67) * T) | 0; if (gap[y * T + x] > 3) d[y * T + x] = hex('#b8b0a0'); }
    for (const [x, y] of [[40, 14], [41, 14], [42, 15], [43, 15], [44, 16], [9, 50], [10, 51], [11, 51]]) if (gap[y * T + x] > 1.3) d[y * T + x] = hex('#5e8a78');
    return d;
  }

  // ---- assignment ------------------------------------------------------------
  const VAULT_MAPS = { cloister: 1, chapel: 1 };          // painted vaults
  const ROCK_MAPS = { quarry: 1, underhedge: 1, rootvault: 1, catacombs: 1 };
  // Which painted ceiling a map should get, or null to keep the original.
  function pick(m) {
    if (!m || !m.ceil) return null;
    if (VAULT_MAPS[m.id]) return 'c_vault';
    if (ROCK_MAPS[m.id] || m.rooms) return 'c_rock';   // m.rooms: a generated dungeon
    if (m.ceil === 't_wood') return 'c_beams';          // timber interiors: the tavern, houses, mill, malting, belfry
    return null;
  }
  // Another module may already own a map's per-cell ceilings: leave those alone.
  function assign(m) {
    if (!m || m._ceilAssigned) return;
    m._ceilAssigned = true;
    const name = pick(m);
    if (!name || m.ceilCells) return;
    m.ceilTextures = [m.ceil, name];
    m._ceilCellsAll = new Uint8Array(m.w * m.h).fill(1);
  }
  function sync(m) {
    if (!m) return;
    assign(m);
    if (m._ceilCellsAll) m.ceilCells = (typeof GFX !== 'undefined' && GFX.ceilings) ? m._ceilCellsAll : null;
  }
  function syncAll() { if (typeof G !== 'undefined' && G.maps) for (const id in G.maps) sync(G.maps[id]); }
  const budgetBytes = () => generated;

  register('c_beams', paintBeams());
  register('c_vault', paintVault());
  register('c_rock', paintRock());

  return { textures, pick, assign, sync, syncAll, budgetBytes };
})();

// Wrap the world build last, so it sees every finished map; loadMap re-syncs
// the current map in case it was rebuilt outside buildAllMaps.
(function () {
  const _build = buildAllMaps;
  buildAllMaps = function () { const maps = _build(); for (const id in maps) CEILINGS.sync(maps[id]); return maps; };
  const _loadMap = loadMap;
  loadMap = function (id, pos) { if (G.maps && G.maps[id]) CEILINGS.sync(G.maps[id]); return _loadMap(id, pos); };
  GFX.onChange(() => CEILINGS.syncAll());
  CEILINGS.syncAll();
})();
