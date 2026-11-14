// ============================================================
//  decals — seeded wall detail layers (moss, cracks, scorch, posters, Synod
//  notices) and the close-range wall grain.
//
//  Everything here is a PROCEDURAL STAND-IN: 64x64 RGBA marks painted from
//  seeded noise at load time, to be replaced by hand-made art later. They are
//  registered as ordinary engine textures, so the renderer needs nothing new.
//
//  Texture memory (the budget this team's art takes; the cap is 512 KB):
//    12 decals x 64x64x4 B = 196,608 B   (moss x3, crack x2, scorch x2, poster x3, synod x2)
//     1 wall grain         =  16,384 B   (greyscale, stored in the red channel)
//     3 ceilings (js/ceilings.js, added via CEILINGS.budgetBytes()) = 49,152 B
//    total                 = 262,144 B   (256 KB, half the cap)
//  Per-map decal tables are small objects (about 5-12% of the wall cells).
//  budgetBytes() refuses nothing at runtime but the tests pin it under the cap.
// ============================================================
'use strict';

const DECALS = (() => {
  const T = 64, CAP_BYTES = 512 * 1024;
  const NAMES = {
    moss: ['d_moss1', 'd_moss2', 'd_moss3'],
    crack: ['d_crack1', 'd_crack2'],
    scorch: ['d_scorch1', 'd_scorch2'],
    poster: ['d_poster1', 'd_poster2', 'd_poster3'],
    synod: ['d_synod1', 'd_synod2'],
  };
  const textures = [].concat(NAMES.moss, NAMES.crack, NAMES.scorch, NAMES.poster, NAMES.synod);
  const DETAIL_DIST = 2.5;   // close-range wall grain fades out over this many cells
  let detailTex = null, generated = 0;

  // ---- tiny seeded helpers (no Math.random: the art is the same every load) --
  const px = (r, g, b, a) => (((a === undefined ? 255 : a) << 24) | (clamp8(b) << 16) | (clamp8(g) << 8) | clamp8(r)) >>> 0;
  function clamp8(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }
  function hash(ix, iy, seed) {
    let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(seed | 0, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, y, seed) {   // smooth value noise, 0..1
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash(x0, y0, seed), b = hash(x0 + 1, y0, seed), c = hash(x0, y0 + 1, seed), d = hash(x0 + 1, y0 + 1, seed);
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
  }
  function fbm(x, y, seed) { return vnoise(x, y, seed) * 0.55 + vnoise(x * 2.1, y * 2.1, seed + 17) * 0.3 + vnoise(x * 4.3, y * 4.3, seed + 31) * 0.15; }
  const blank = () => new Uint32Array(T * T);   // all zero: alpha 0 everywhere
  function register(name, data) { Engine.addTexture(name, data); generated += data.length * 4; return data; }

  // ---- moss: damp green growth that clings low and into corners -------------
  function paintMoss(mode, seed) {
    const d = blank();
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      let n = fbm(x / 8.5, y / 8.5, seed), bias, thr = 0.52;
      if (mode === 0) bias = Math.pow(y / T, 1.7) * 0.7 - 0.12;                       // creeping up from the foot
      else if (mode === 1) bias = 0.55 - Math.hypot(x, y) / 70;                          // a clump in the top-left corner
      else { n = fbm(x / 4.6, y / 4.6, seed); bias = -0.05 + (vnoise(x / 20, y / 20, seed + 5) - 0.5) * 0.5; thr = 0.56; }   // scattered speckle
      const v = n + bias;
      if (v < thr) continue;
      const edge = v - thr < 0.05, g = fbm(x / 3, y / 3, seed + 9);
      let r = 32 + g * 34, gr = 58 + g * 56, b = 24 + g * 18;
      if (edge) { r += 28; gr += 30; b += 10; }                                              // sunlit lip
      if (hash(x, y, seed + 3) > 0.93) { r += 40; gr += 35; }                                // spore flecks
      d[y * T + x] = px(r, gr, b);
    }
    return d;
  }

  // ---- cracks: a jagged dark fissure with a pale lip and a few branches -----
  function paintCrack(mode, seed) {
    const d = blank(), rnd = mulberry32(seed);
    const stamp = (x, y, core) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= T || yy >= T) continue;
        if (dx === 0 && dy === 0) { d[yy * T + xx] = core; continue; }
        if (!d[yy * T + xx] && rnd() < 0.55) d[yy * T + xx] = px(86, 82, 78);   // chipped pale lip
      }
    };
    const walk = (x, y, ang, len, depth) => {
      for (let i = 0; i < len; i++) {
        ang += (rnd() - 0.5) * 0.9;
        x += Math.cos(ang); y += Math.sin(ang);
        if (x < 0 || y < 0 || x >= T || y >= T) return;
        stamp(Math.round(x), Math.round(y), px(12, 11, 12));
        if (depth < 2 && rnd() < 0.06) walk(x, y, ang + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.7), 8 + ((rnd() * 14) | 0), depth + 1);
      }
    };
    if (mode === 0) walk(20 + rnd() * 24, 0, Math.PI / 2 + (rnd() - 0.5) * 0.4, 80, 0);   // top to bottom
    else walk(0, 8 + rnd() * 14, 0.45 + rnd() * 0.3, 90, 0);                                // a diagonal from the left edge
    return d;
  }

  // ---- scorch: soot and char from fire or a stray blast ----------------------
  function paintScorch(mode, seed) {
    const d = blank();
    const cx = mode === 0 ? 30 : 34, cy = mode === 0 ? 40 : 56;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const dx = x - cx, dy = y - cy;
      const ang = Math.atan2(dy, dx), dist = Math.hypot(dx * (mode === 0 ? 1 : 1.7), dy * (mode === 0 ? 1 : 0.55));
      const R = (mode === 0 ? 24 : 30) * (0.7 + 0.55 * fbm(Math.cos(ang) * 1.6 + 5, Math.sin(ang) * 1.6 + 5, seed));
      let t = dist / R;
      if (mode === 1 && dy < 0) t *= 1 - Math.min(0.5, -dy / 90);   // the lick of a flame runs up the wall
      if (t >= 1) continue;
      if (t > 0.72 && hash(x, y, seed + 2) < (t - 0.72) * 3.2) continue;   // ragged, stippled edge
      const k = 1 - t, c = 14 + (1 - k) * 34 + hash(x, y, seed + 6) * 10;
      d[y * T + x] = px(c, c * 0.93, c * 0.86);
    }
    return d;
  }

  // ---- posters: torn handbills with illegible scribbles ----------------------
  function paintPoster(mode, seed) {
    const d = blank(), rnd = mulberry32(seed);
    const x0 = [14, 22, 10][mode], x1 = [46, 44, 50][mode], y0 = [9, 14, 6][mode], y1 = [54, 52, 58][mode];
    const paper = [[214, 200, 160], [204, 186, 128], [206, 170, 164]][mode];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      // torn edges: each side is pulled in by a different noisy amount
      const tx = Math.min(x - x0, x1 - x), ty = Math.min(y - y0, y1 - y);
      const tear = 2.6 * vnoise(x / 2.5, y / 2.5, seed) + 1.4 * hash(x, y, seed + 4);
      if (Math.min(tx, ty) < tear - 1) continue;
      if (mode === 2 && (x - x0) + (y1 - y) < 11 + 4 * vnoise(x / 3, y / 3, seed)) continue;   // a corner ripped away
      const st = fbm(x / 6, y / 6, seed + 8);
      const shade = 0.82 + st * 0.3 - (Math.min(tx, ty) < 2 ? 0.14 : 0);
      d[y * T + x] = px(paper[0] * shade, paper[1] * shade, paper[2] * shade);
    }
    // scribbles stand in for print: a bold headline, then rows of short dashes
    const ink = (x, y, r, g, b) => { if (x > x0 + 1 && x < x1 - 1 && y > y0 + 1 && y < y1 - 1 && d[y * T + x]) d[y * T + x] = px(r, g, b); };
    const hy = y0 + 5;
    for (let x = x0 + 4; x < x1 - 3; x++) for (let k = 0; k < 3; k++) if (rnd() < 0.92) ink(x, hy + k, 40, 24, 22);
    let y = hy + 7;
    while (y < y1 - 5) {
      let x = x0 + 4;
      while (x < x1 - 4) {
        const len = 2 + ((rnd() * 6) | 0);
        for (let i = 0; i < len; i++) ink(x + i, y + (rnd() < 0.2 ? 1 : 0), 52, 44, 40);
        x += len + 2;
      }
      y += 3 + (rnd() < 0.3 ? 1 : 0);
    }
    if (mode === 1) for (let yy = y0 + 18; yy < y0 + 28; yy++) for (let xx = x0 + 6; xx < x0 + 18; xx++) ink(xx, yy, 60 + hash(xx, yy, seed) * 50, 44 + hash(xx, yy, seed) * 30, 36);   // a crude woodcut
    for (const [pxx, pyy] of [[x0 + 3, y0 + 2], [x1 - 3, y0 + 2]]) if (d[pyy * T + pxx]) d[pyy * T + pxx] = px(70, 70, 76);   // tacks
    return d;
  }

  // ---- Synod notices: grey paper, ruled lines, a red seal ---------------------
  function paintSynod(mode, seed) {
    const d = blank(), rnd = mulberry32(seed);
    const sheet = (x0, y0, x1, y1, seal) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const edge = x === x0 || x === x1 || y === y0 || y === y1;
        const s = 0.9 + fbm(x / 7, y / 7, seed) * 0.16;
        d[y * T + x] = edge ? px(120, 120, 128) : px(172 * s, 172 * s, 178 * s);
      }
      for (let x = x0 + 3; x < x1 - 2; x++) for (let k = 0; k < 2; k++) d[(y0 + 3 + k) * T + x] = px(64, 64, 76);   // heading bar
      for (let y = y0 + 9; y < y1 - (seal ? 14 : 4); y += 4) {                                                       // ruled lines with a few words
        for (let x = x0 + 3; x < x1 - 2; x++) d[y * T + x] = px(142, 142, 150);
        let x = x0 + 4;
        while (x < x1 - 6) { const len = 2 + ((rnd() * 5) | 0); for (let i = 0; i < len; i++) d[(y - 1) * T + x + i] = px(70, 70, 82); x += len + 2; }
      }
      if (seal) {   // red wax seal with ribbon tails
        const sx = ((x0 + x1) / 2) | 0, sy = y1 - 8;
        for (let y = sy; y < sy + 9; y++) for (const o of [-3, 2]) if (y < T && d[y * T + sx + o]) d[y * T + sx + o] = px(120, 28, 30);
        for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) {
          const r = Math.hypot(x, y) + (hash(x, y, seed + 7) - 0.5) * 1.2;
          if (r > 6.4) continue;
          const lit = x < 0 && y < 0 ? 24 : 0, ring = r > 4.4 && r < 5.4;
          d[(sy + y) * T + sx + x] = ring ? px(112 + lit, 18, 22) : px(150 + lit - r * 3, 26, 30);
        }
      }
    };
    if (mode === 0) sheet(13, 6, 51, 57, true);
    else { sheet(9, 5, 36, 33, false); sheet(26, 28, 55, 59, true); }
    return d;
  }

  // ---- close-range wall grain: stone grit blended with wood fibre -------------
  function paintGrain() {
    const d = new Uint32Array(T * T);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const grit = hash(x, y, 91) * 0.6 + vnoise(x / 2.2, y / 2.2, 93) * 0.4;
      const fibre = hash(x, 0, 95) * (0.55 + 0.45 * vnoise(x / 3, y / 14, 97));   // vertical grain lines
      const v = clamp8(128 + ((grit * 0.55 + fibre * 0.45) - 0.5) * 340);
      d[y * T + x] = (255 << 24) | (v << 16) | (v << 8) | v;
    }
    return d;
  }

  // ---- seeded placement ---------------------------------------------------------
  const cellAt = (m, x, y) => (x < 0 || y < 0 || x >= m.w || y >= m.h) ? undefined : m.cells[y * m.w + x];
  const NB = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  // a wall cell is eligible only if it shows a face to open ground
  const faceOpen = (m, x, y) => NB.some(([dx, dy]) => cellAt(m, x + dx, y + dy) === null);
  const touchesCobble = (m, x, y) => !!m.floorCells && !!m.floorTextures && NB.some(([dx, dy]) => {
    const nx = x + dx, ny = y + dy;
    return cellAt(m, nx, ny) === null && m.floorTextures[m.floorCells[ny * m.w + nx]] === 't_cobble';
  });
  const nearChapelOrHall = (m, x, y) => x >= 24 && x <= 54 && y <= 12;   // Oakhaven's Greenhall (26-34) and Chapel (46-51)
  const M = NAMES.moss, C = NAMES.crack, S = NAMES.scorch, P = NAMES.poster, Y = NAMES.synod;
  const STONE = ['t_stone', 't_hedge'];
  // Rules run in order per map; a cell takes at most one mark. density is the
  // share of that rule's eligible cells that get one (5-12%).
  const RULES = {
    oakhaven: [
      { names: Y, walls: ['t_house', 't_wood', 't_marble', 't_stone'], where: (m, x, y) => touchesCobble(m, x, y) && nearChapelOrHall(m, x, y), density: 0.12 },
      { names: P.concat(Y), walls: ['t_house', 't_wood'], where: touchesCobble, density: 0.10 },
      { names: M, walls: STONE, where: faceOpen, density: 0.08 },
    ],
    clearing: [{ names: M, walls: STONE, where: faceOpen, density: 0.10 }],
    deepwoods: [{ names: M, walls: ['t_deepwood', 't_mausoleum'], where: faceOpen, density: 0.10 }],
    whispergrove: [{ names: M, walls: ['t_greymarble', 't_stone', 't_brick'], where: faceOpen, density: 0.07 }],
    quarry: [{ names: S, walls: ['t_stone', 't_glassrock'], where: faceOpen, density: 0.09 }],
    rootvault: [{ names: S, walls: ['t_glassrock', 't_brass'], where: faceOpen, density: 0.07 }, { names: M, walls: ['t_glassrock'], where: faceOpen, density: 0.06 }],
    underhedge: [{ names: S, walls: STONE, where: faceOpen, density: 0.06 }, { names: M, walls: STONE, where: faceOpen, density: 0.08 }],
    catacombs: [{ names: S, walls: ['t_catacomb'], where: faceOpen, density: 0.06 }, { names: M, walls: ['t_catacomb', 't_greymarble'], where: faceOpen, density: 0.08 }],
    cloister: [{ names: C, walls: ['t_greymarble'], where: faceOpen, density: 0.12 }],
    mausoleum: [{ names: C, walls: ['t_mausoleum', 't_greymarble'], where: faceOpen, density: 0.08 }, { names: M, walls: ['t_mausoleum'], where: faceOpen, density: 0.05 }],
    belfry: [{ names: C, walls: ['t_mausoleum', 't_greymarble'], where: faceOpen, density: 0.12 }],
    chapel: [{ names: C, walls: ['t_marble'], where: faceOpen, density: 0.08 }],
    greenhall: [{ names: C, walls: ['t_marble'], where: faceOpen, density: 0.08 }],
    malting: [{ names: S, walls: ['t_stone'], where: faceOpen, density: 0.08 }],
  };
  function seedOf(id) { let h = 2166136261; for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619); return (h ^ 0x5eed5eed) >>> 0; }

  // Fill map._decalsAll ({cellIndex: textureName}) for one map. Pure function of
  // the map id and its cells, so two builds give identical marks. Never touches
  // cells or entities, and never marks a door.
  function placeMap(m) {
    const all = {}, rules = RULES[m.id] || [];
    const rnd = mulberry32(seedOf(m.id));
    for (const rule of rules) {
      const eligible = [];
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        const i = y * m.w + x, c = m.cells[i];
        if (!c || c.door || all[i] || rule.walls.indexOf(c.tex) < 0) continue;
        if (rule.where(m, x, y)) eligible.push(i);
      }
      let n = 0;
      for (const i of eligible) if (rnd() < rule.density) { all[i] = rule.names[(rnd() * rule.names.length) | 0]; n++; }
      // a small map with plenty of wall must still show its mark somewhere
      if (!n && eligible.length >= 8) all[eligible[(rnd() * eligible.length) | 0]] = rule.names[(rnd() * rule.names.length) | 0];
    }
    m._decalsAll = all;
    return all;
  }
  function place(maps) { for (const id in maps) placeMap(maps[id]); }

  // The switch: the engine reads map.decals, so GFX.decals decides what it sees.
  function sync(m) {
    if (!m) return;
    if (!m._decalsAll) placeMap(m);
    m.decals = (typeof GFX !== 'undefined' && GFX.decals) ? m._decalsAll : null;
  }
  function syncAll() { if (typeof G !== 'undefined' && G.maps) for (const id in G.maps) sync(G.maps[id]); }
  function syncDetail() { Engine.setDetail((typeof GFX !== 'undefined' && GFX.detail) ? detailTex : null, DETAIL_DIST); }

  function budgetBytes() {
    let b = generated;
    if (typeof CEILINGS !== 'undefined' && CEILINGS.budgetBytes) b += CEILINGS.budgetBytes();
    return b;
  }

  // ---- build the art ------------------------------------------------------------
  NAMES.moss.forEach((n, i) => register(n, paintMoss(i, 1100 + i * 37)));
  NAMES.crack.forEach((n, i) => register(n, paintCrack(i, 2200 + i * 41)));
  NAMES.scorch.forEach((n, i) => register(n, paintScorch(i, 3300 + i * 43)));
  NAMES.poster.forEach((n, i) => register(n, paintPoster(i, 4400 + i * 47)));
  NAMES.synod.forEach((n, i) => register(n, paintSynod(i, 5500 + i * 53)));
  detailTex = paintGrain(); generated += detailTex.length * 4;

  return { textures, names: NAMES, capBytes: CAP_BYTES, detailDist: DETAIL_DIST, detail: () => detailTex, place, placeMap, sync, syncAll, syncDetail, budgetBytes };
})();

// Hook it into the world: marks are placed after every other builder has run
// (they only read cells, so saves and entity indexes are untouched), and the
// two switches follow GFX.
(function () {
  const _build = buildAllMaps;
  buildAllMaps = function () { const maps = _build(); DECALS.place(maps); for (const id in maps) DECALS.sync(maps[id]); return maps; };
  // maps rebuilt outside buildAllMaps (the greening Oakhaven) are marked on entry
  const _loadMap = loadMap;
  loadMap = function (id, pos) { if (G.maps && G.maps[id]) DECALS.sync(G.maps[id]); return _loadMap(id, pos); };
  GFX.onChange(() => { DECALS.syncAll(); DECALS.syncDetail(); });
  if (typeof G !== 'undefined' && G.maps) DECALS.syncAll();
  DECALS.syncDetail();
})();
