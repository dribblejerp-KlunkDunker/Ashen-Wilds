// ============================================================
//  ledge1 - Phase 1, "the ledge": The Long Account's first place, and the way into it.
//
//  The prologue of docs/worldbuilding/the-round-and-the-long-account.md: the first week of the thaw, S.31, on
//  Orlen's highland edge. You stand on frosted rock above a broken, burning country, with the Slagcrown under a
//  sun that has gone dark, and Marget Sayle's bothy is under the ledge.
//
//  What this file does, all of it on the Shattered Octave engine's own extension points:
//    * TILES. Seven 64x64 tiles painted here in code (black rock, hoarfrost, scorched earth, a burning crack,
//      slag-stone, bloom-ground, dry-stone), registered with Engine.addTexture.
//    * THE MAP la_ledge (96 x 96 cells): the ledge and its lip of boulders, the cliff, a ramp down to the bothy
//      shelf, the plain with its cracks and the great crack running west, the hollow where the bloom glows, and the
//      Slagcrown on its rise, built from tall blocks. Heights come from one function, landH(x, y).
//    * THE MAP la_bothy: one room with a hearth and a door that holds. The slice's safe room.
//    * TWO PEOPLE who talk: the carter on the ledge and Marget Sayle by her fire. Their pictures are the engine's
//      own townsfolk paintings until this game's people are painted.
//    * THE COAL SUN. Under the 3D renderer a pass at order 1 repaints the sky on this game's outdoor maps: a dark
//      disc with a burning rim low in the west, a red horizon, smoke for cloud. A second pass at order 55 drops ash
//      and lifts embers across the view. The classic renderer keeps the engine's ordinary sky for now.
//    * THE START. "Begin" on the title goes straight to the ledge as the Watch deserter of the design's default
//      pair; character creation waits for this game's eight-and-eight backgrounds. Only this game's maps exist.
//
//  Canon: owner decisions O1 (only people are people), O4 (small magic), O5 (this game). Names used here are
//  already in the design file. New wording is plain ASCII, as the canon sheet asks of in-game text.
//  Nothing here uses the game's random numbers: every placement is hashed from its position.
// ============================================================
'use strict';

const LEDGE1 = (() => {
  const LEDGE = 'la_ledge', BOTHY = 'la_bothy';
  const W = 96, H = 96;
  const CIT = { x: 21, y: 48 };                       // the Slagcrown's great tower
  const PLATEAU = { x0: 78, x1: 92, y0: 39, y1: 58, h: 14 };
  const SHELF = { x0: 80, x1: 92, y0: 25, y1: 33, h: 9.5 };
  const RAMP = { x0: 86, x1: 88, y0: 33, y1: 39 };    // vertex columns 86..88, rows 33..39
  const HOLLOW = { x: 62, y: 64, r: 8 };
  const CANYON = [[74, 50], [60, 46], [46, 52], [34, 48]];
  const SUN = { az: Math.PI, el: 0.2, r: 0.06 };      // where the coal sun hangs: due west, low over the Slagcrown

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  function hash(x, y, s) { let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2246822519)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
  // smooth value noise; with `per` it wraps every `per` lattice steps (tiles that must tile)
  function vnoise(x, y, s, per) {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const m = per ? (q) => ((q % per) + per) % per : (q) => q;
    const a = hash(m(x0), m(y0), s), b = hash(m(x0 + 1), m(y0), s), c = hash(m(x0), m(y0 + 1), s), d = hash(m(x0 + 1), m(y0 + 1), s);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }
  const fbm = (x, y, s) => vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.15;
  const px = (r, g, b) => ((255 << 24) | (clamp(b | 0, 0, 255) << 16) | (clamp(g | 0, 0, 255) << 8) | clamp(r | 0, 0, 255)) >>> 0;
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return px(n >> 16, (n >> 8) & 255, n & 255); };
  const DITH = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const dith = (x, y) => DITH[(x & 3) + (y & 3) * 4] / 16 - 0.5;
  // a colour from a small ramp, dithered between neighbours so bands stay pixel art
  function ramp(cols, t, x, y) { const k = clamp(t, 0, 0.999) * (cols.length - 1) + dith(x, y) * 0.7; return cols[clamp(Math.round(k), 0, cols.length - 1)]; }

  // ---------------------------------------------------------------- the tiles
  function tile(fn) { const d = new Uint32Array(64 * 64); for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) d[y * 64 + x] = fn(x, y); return d; }
  // tiling noise for a 64 px tile: `cells` lattice steps across it
  const tn = (x, y, cells, s) => vnoise(x * cells / 64, y * cells / 64, s, cells);
  const ROCK = ['#0b0b0d', '#141416', '#1c1d20', '#26272b', '#303238'].map(hex);
  const FROST = ['#5f6b76', '#8794a0', '#aebbc6', '#d2dde6'].map(hex);
  function rockAt(x, y) {
    const n = tn(x, y, 4, 11) * 0.6 + tn(x, y, 8, 12) * 0.3 + tn(x, y, 16, 13) * 0.1;
    const crack = Math.abs(tn(x, y, 4, 14) - 0.5) < 0.022 || Math.abs(tn(x, y, 8, 15) - 0.5) < 0.012;
    return crack ? ROCK[0] : ramp(ROCK, n * 1.15 - 0.05, x, y);
  }
  function paintRock() { return tile(rockAt); }
  // hoarfrost on the rock, in two cuts laid by a fixed hash of the cell, so no bare lane runs through tile after tile.
  // The noise is bent by a second noise before it is read: frost lies in drifts, not along the grain of the tile.
  function frostAt(x, y, s) {
    const wx = (tn(x, y, 2, s + 3) - 0.5) * 26, wy = (tn(x, y, 2, s + 4) - 0.5) * 26;
    return tn(x + wx, y + wy, 4, s) * 0.55 + tn(x + wy, y + wx, 8, s + 1) * 0.45;
  }
  function paintFrost(s) {
    return tile((x, y) => {
      const f = frostAt(x, y, s || 21);
      if (f > 0.5 + dith(x, y) * 0.08) return ramp(FROST, (f - 0.5) * 3.2, x, y);
      return rockAt(x, y);
    });
  }
  function paintScorch() {
    const C = ['#120d0c', '#1c1513', '#27201c', '#342a24', '#40342d'].map(hex), ASH = hex('#57514d');
    return tile((x, y) => {
      const n = tn(x, y, 4, 31) * 0.55 + tn(x, y, 8, 32) * 0.3 + tn(x, y, 16, 33) * 0.15;
      if (hash(x, y, 34) > 0.985) return ASH;
      return ramp(C, n * 1.1 - 0.05, x, y);
    });
  }
  function paintEmber() {
    const CRUST = ['#140806', '#221009', '#34160b'].map(hex), FIRE = ['#8a2a0c', '#c8480f', '#ee7a1a', '#ffb23c', '#ffe08a'].map(hex);
    return tile((x, y) => {
      const v = Math.abs(tn(x, y, 4, 41) - 0.5) * 2, w = Math.abs(tn(x, y, 8, 42) - 0.5) * 2, k = Math.min(v, w * 1.4);
      if (k < 0.2) return ramp(FIRE, 1 - k / 0.2, x, y);
      return ramp(CRUST, tn(x, y, 8, 43), x, y);
    });
  }
  function paintSlag() {
    // slag-stone in courses: dark blocks with a lighter top edge, a few fallen out
    const C = ['#0e0d0e', '#171617', '#201e20', '#2a282a'].map(hex), EDGE = hex('#3a3636'), JOINT = hex('#070707');
    return tile((x, y) => {
      const row = y >> 4, off = (row & 1) * 16, bx = (x + off) & 31, by = y & 15;
      if (by === 15 || bx === 31) return JOINT;
      const gone = hash(((x + off) >> 5), row, 51) > 0.9;
      if (gone) return C[0];
      if (by === 0) return EDGE;
      return ramp(C, 0.25 + tn(x, y, 8, 52) * 0.75, x, y);
    });
  }
  function paintBloom() {
    const C = ['#0d1514', '#122320', '#17332e'].map(hex), GLOW = ['#1f6a5e', '#2f9a88', '#6fd8c4'].map(hex);
    return tile((x, y) => {
      const v = Math.abs(tn(x, y, 8, 61) - 0.5) * 2;
      if (v < 0.12) return ramp(GLOW, 1 - v / 0.12, x, y);
      if (hash(x >> 1, y >> 1, 62) > 0.97) return GLOW[1];
      return ramp(C, tn(x, y, 4, 63), x, y);
    });
  }
  function paintDrystone() {
    // the bothy: field stone laid dry, frost in the joints
    const C = ['#1a1a1c', '#26272a', '#333539', '#42454a'].map(hex), J = hex('#0a0a0b'), FR = hex('#7c8892');
    return tile((x, y) => {
      const row = Math.floor(y / 9), off = Math.floor(hash(row, 0, 71) * 14), sx = x + off, w = 11 + Math.floor(hash(row, Math.floor(sx / 12), 72) * 5);
      const bx = sx % w, by = y % 9;
      if (by === 8 || bx === w - 1) return hash(x, y, 73) > 0.8 ? FR : J;
      return ramp(C, 0.2 + hash(row, Math.floor(sx / w), 74) * 0.5 + tn(x, y, 16, 75) * 0.3, x, y);
    });
  }
  function paintTurfRoof() {
    // the underside of the bothy's roof: peeled rafters a hand apart, black turf and heather packed between, soot over all
    const SOD = ['#070605', '#0c0a08', '#12100c', '#191610'].map(hex), POLE = ['#17110b', '#22190f', '#2e2214'].map(hex), STRAW = hex('#2b2415');
    return tile((x, y) => {
      const r = x & 15;
      if (r < 4) return ramp(POLE, (r === 1 ? 0.75 : r === 2 ? 0.5 : 0.15) + (tn(x, y, 16, 77) - 0.5) * 0.3, x, y);
      if (r === 4) return SOD[0];                                                // the shadow each rafter throws
      if (hash(x >> 1, y, 78) > 0.975) return STRAW;                             // a stem of heather hanging through
      return ramp(SOD, tn(x, y, 8, 79) * 0.7 + tn(x, y, 16, 80) * 0.3, x, y);
    });
  }
  // small sprites that give light: a heap of embers, a cluster of corpse-caps
  function glowSprite(name, w, h, hs, draw) {
    const d = new Uint32Array(w * h), emit = new Uint8Array(w * h);
    draw((x, y, c, glow) => { if (x >= 0 && y >= 0 && x < w && y < h) { d[y * w + x] = c; emit[y * w + x] = glow ? 1 : 0; } });
    Engine.addSprite(name, { w, h, data: d, hs, cx: 0.5, dy: 0 });
    Engine.setEmissive(name, emit);
  }
  function installArt() {
    if (typeof Engine === 'undefined' || !Engine.addTexture) return;
    Engine.addTexture('t_la_rock', paintRock());
    Engine.addTexture('t_la_frost', paintFrost(21));
    Engine.addTexture('t_la_frost2', paintFrost(121));
    Engine.addTexture('t_la_scorch', paintScorch());
    Engine.addTexture('t_la_ember', paintEmber());
    Engine.addTexture('t_la_slag', paintSlag());
    Engine.addTexture('t_la_bloom', paintBloom());
    Engine.addTexture('t_la_turfroof', paintTurfRoof());
    Engine.addTexture('t_house_la_drystone', paintDrystone());   // a name the roof planner (js/eaves78.js) reads as a house wall
    glowSprite('la_ember', 20, 10, 0.16, (put) => {
      const F = ['#8a2a0c', '#d8581a', '#ffab3a', '#ffe9a0'].map(hex), K = hex('#1a0c08');
      for (let x = 2; x < 18; x++) for (let y = 4; y < 10; y++) { const k = hash(x, y, 81); if (y > 5 + Math.abs(x - 10) * 0.35) put(x, y, k > 0.45 ? F[Math.floor(k * 3.99)] : K, k > 0.45); }
      for (const [x, y] of [[6, 2], [11, 0], [14, 3], [9, 3]]) put(x, y, F[2], true);
    });
    glowSprite('la_caps', 24, 14, 0.22, (put) => {
      const T = ['#16443c', '#2b8a78', '#62d6c0', '#b8fff0'].map(hex), S = hex('#0a1412');
      for (const [cx, top, r] of [[5, 6, 3], [11, 3, 4], [18, 7, 3], [14, 9, 2], [8, 10, 2]]) {
        for (let y = top + 2; y < 14; y++) put(cx, y, S, false);                                   // the stem
        for (let dx = -r; dx <= r; dx++) for (let dy = 0; dy <= 2; dy++) if (Math.abs(dx) <= r - dy * 0 && dy <= 2 - Math.abs(dx) * 0.4) put(cx + dx, top + dy, T[dy === 0 ? 2 : 1], true);
        put(cx, top - 1, T[3], true);
      }
    });
  }

  // ---------------------------------------------------------------- the land
  function distSeg(x, y, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1); return Math.hypot(x - ax - dx * t, y - ay - dy * t); }
  function distCanyon(x, y) { let d = 1e9; for (let i = 0; i + 1 < CANYON.length; i++) d = Math.min(d, distSeg(x, y, CANYON[i][0], CANYON[i][1], CANYON[i + 1][0], CANYON[i + 1][1])); return d; }
  const inRect = (x, y, r, pad) => x >= r.x0 - (pad || 0) && x <= r.x1 + 1 + (pad || 0) && y >= r.y0 - (pad || 0) && y <= r.y1 + 1 + (pad || 0);
  // the height of the ground at a vertex (map units; one cell is about one person tall)
  function landH(x, y) {
    if (x >= RAMP.x0 && x <= RAMP.x1 && y > RAMP.y0 && y < RAMP.y1) return lerp(SHELF.h, PLATEAU.h, (y - RAMP.y0) / (RAMP.y1 - RAMP.y0));
    if (inRect(x, y, PLATEAU)) return PLATEAU.h;
    if (inRect(x, y, SHELF)) return SHELF.h;
    if (x > 92) return PLATEAU.h + 3 + vnoise(x / 3, y / 3, 5) * 2;                                       // the rock at your back
    const dc = Math.hypot(x - CIT.x, y - CIT.y);
    let h = 0.5 + fbm(x / 13, y / 13, 1) * 2.4;
    h += smooth(9, 2, x) * 7 + smooth(8, 1, y) * 6 + smooth(H - 8, H - 1, y) * 6;              // the far rim
    h = lerp(h, 3, smooth(19, 12, dc));                                                         // the Slagcrown's rise
    for (let i = 0; i < 9; i++) {                                                               // the crown: spoil heaps round the pitheads
      const a = 0.35 + i * 0.698, hx = CIT.x + Math.cos(a) * 17.5, hy = CIT.y + Math.sin(a) * 15.5, d = Math.hypot(x - hx, y - hy);
      h = Math.max(h, 3 + (2.6 + (i % 3) * 0.9) * smooth(3.4, 0.4, d));
    }
    const nearHome = smooth(9, 3, Math.max(0, PLATEAU.x0 - x)) * (y > 20 && y < 64 ? 1 : 0);    // no cracks under the cliff's foot
    const dh = Math.hypot(x - HOLLOW.x, y - HOLLOW.y);
    const inHollow = smooth(HOLLOW.r, HOLLOW.r * 0.6, dh);                                      // no fire in the bloom: teal is its own light
    const crack = smooth(0.085, 0.03, Math.abs(vnoise(x / 8.5, y / 8.5, 3) - 0.5)) * smooth(15, 19, dc) * (1 - nearHome) * (1 - inHollow);
    const cany = smooth(3.8, 1.6, distCanyon(x, y) + (vnoise(x / 2.5, y / 2.5, 4) - 0.5) * 1.2) * smooth(13, 16, dc);
    h = lerp(h, -2.4, Math.max(crack, cany));
    h = lerp(h, -1.1, smooth(HOLLOW.r, HOLLOW.r * 0.45, dh) * (1 - Math.max(crack, cany)));
    return h;
  }

  // the Slagcrown from the east: a curtain wall with towers, halls, a keep, the great tower and its spires
  function citadelTop(x, y) {
    const dx = x - CIT.x, dy = y - CIT.y, ax = Math.abs(dx), ay = Math.abs(dy);
    let t = 0;
    const gone = (s) => hash(x, y, s) > 0.86;                                                   // ruin: a block fallen away
    if ((ax === 10 && ay <= 10) || (ay === 10 && ax <= 10)) t = gone(91) ? 2 : 4;              // the curtain
    if ((ax >= 9 && ax <= 11) && (ay >= 9 && ay <= 11)) t = 7 + (hash(dx > 0 ? 1 : 0, dy > 0 ? 1 : 0, 92) > 0.5 ? 1 : 0);   // corner towers
    if (ax >= 9 && ax <= 11 && ay <= 1) t = 8;                                                  // the gate towers, east and west
    if (ay >= 9 && ay <= 11 && ax <= 1) t = 6;
    if (ax >= 6 && ax <= 8 && ay <= 4) t = Math.max(t, gone(93) ? 3 : 5);                       // halls
    if (ax <= 5 && ay <= 5) t = 7;                                                              // the keep
    if (ax >= 4 && ax <= 5 && ay >= 4 && ay <= 5) t = 9;                                        // its turrets
    if (ax <= 1 && ay <= 1) t = 13;                                                             // the great tower
    if (ax === 0 && ay === 0) t = 16;
    if (ay === 0 && ax === 3) t = 11;                                                           // two lesser spires
    if (ax === 0 && ay === 3) t = 10;
    return t;
  }

  // index 2 is the engine's "cannot be walked on" floor (its water slot); here it is the cliff's own rock: the drop you cannot step off
  const FL = { SCORCH: 0, ROCK: 1, DROP: 2, FROST: 3, EMBER: 4, BLOOM: 5, SLAG: 6, FROST2: 7 };
  function buildLedge() {
    const m = new GameMap(LEDGE, 'The highland edge', W, H, {
      outdoor: true, floor: 't_la_scorch', floorTextures: ['t_la_scorch', 't_la_rock', 't_la_rock', 't_la_frost', 't_la_ember', 't_la_bloom', 't_la_slag', 't_la_frost2'],
      fogDist: 120, fogColor: [46, 20, 16], ambient: 0.16, music: 'wild', danger: 0, spawn: { x: 89.5, y: 48.5, dir: Math.PI },
    });
    m._la = true;
    // the ground: every vertex from landH, every cell sloped
    const V = m.ensureVerts(), W1 = W + 1;
    for (let vy = 0; vy <= H; vy++) for (let vx = 0; vx <= W; vx++) V[vy * W1 + vx] = landH(vx, vy);
    m.smooth.fill(1); m.syncSlopes(0, 0, W - 1, H - 1);
    const g = (x, y) => m.groundAt(x + 0.5, y + 0.5);
    const grade = (x, y) => { const a = V[y * W1 + x], b = V[y * W1 + x + 1], c = V[(y + 1) * W1 + x], d = V[(y + 1) * W1 + x + 1]; return Math.max(a, b, c, d) - Math.min(a, b, c, d); };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const h = g(x, y), dh = Math.hypot(x + 0.5 - HOLLOW.x, y + 0.5 - HOLLOW.y), dc = Math.hypot(x + 0.5 - CIT.x, y + 0.5 - CIT.y);
      let f = FL.SCORCH;
      if (h < -1.5 && grade(x, y) < 0.7) f = FL.EMBER;                          // the bed of a crack; its walls are rock
      else if (grade(x, y) > 1.2 || h < -1.5) f = FL.ROCK;
      else if (dh < HOLLOW.r * 0.8 && h < 0.4) f = FL.BLOOM;
      else if (h > 5.5 || (x >= SHELF.x0 && y >= SHELF.y0 - 1 && y <= PLATEAU.y1 + 1)) f = hash(x, y, 98) > 0.5 ? FL.FROST2 : FL.FROST;
      else if (dc < 13) f = FL.SLAG;
      m.setFloor(x, y, f);
    }
    // the edge of the map is rock you cannot pass
    m.border('t_la_rock');
    // the Slagcrown
    for (let y = CIT.y - 12; y <= CIT.y + 12; y++) for (let x = CIT.x - 12; x <= CIT.x + 12; x++) {
      const t = citadelTop(x, y); if (t > 0) m.block(x, y, 't_la_slag', 3 + t, { capTex: 't_la_slag' });
    }
    // the ledge has no wall: you can stand at the very edge and look straight down. The cliff face below it is ground
    // nobody can step onto, so the edge holds. Boulders close the two ends, and the rock stands at your back.
    for (let y = PLATEAU.y0 - 1; y <= PLATEAU.y1 + 1; y++) m.setFloor(PLATEAU.x0 - 1, y, FL.DROP);
    const lip = (x, y) => m.block(x, y, 't_la_rock', PLATEAU.h + 0.34 + hash(x, y, 95) * 0.22, { capTex: 't_la_frost' });
    for (let x = PLATEAU.x0; x <= PLATEAU.x1; x++) { lip(x, PLATEAU.y1); if (x < RAMP.x0 || x >= RAMP.x1) lip(x, PLATEAU.y0); }
    for (let y = SHELF.y0 - 1; y <= PLATEAU.y1; y++) m.block(93, y, 't_la_rock', PLATEAU.h + 5, { capTex: 't_la_frost' });
    // the ramp's sides and the shelf's lip
    for (let y = RAMP.y0; y < RAMP.y1; y++) for (const x of [RAMP.x0 - 1, RAMP.x1]) m.block(x, y, 't_la_rock', g(x === RAMP.x0 - 1 ? x + 1 : x - 1, y) + 0.5, { capTex: 't_la_frost' });
    for (let y = SHELF.y0; y <= SHELF.y1; y++) m.block(SHELF.x0, y, 't_la_rock', SHELF.h + 0.4, { capTex: 't_la_frost' });
    for (let x = SHELF.x0; x <= SHELF.x1; x++) m.block(x, SHELF.y0, 't_la_rock', SHELF.h + 0.4, { capTex: 't_la_frost' });
    for (let x = SHELF.x0; x <= SHELF.x1; x++) if (x < RAMP.x0 - 1 || x > RAMP.x1) m.block(x, SHELF.y1, 't_la_rock', SHELF.h + 0.4, { capTex: 't_la_frost' });
    // the bothy: four cells by three of dry-stone on the shelf, its door to the south
    for (let y = 27; y <= 29; y++) for (let x = 82; x <= 85; x++) m.set(x, y, WALL(x > 82 && x < 85 && y === 28 ? 't_roof' : 't_house_la_drystone'));
    m.set(83, 29, DOOR({ portal: { map: BOTHY, x: 3.5, y: 4.4, dir: -Math.PI / 2 }, label: TX.door }));
    // what gives light: embers along the cracks nearest the eye, and the bloom in its hollow
    let n = 0;
    for (let y = 30; y < 70 && n < 14; y += 3) for (let x = 44; x < 76 && n < 14; x += 3) {
      if (g(x, y) < -1.6 && hash(x, y, 96) > 0.45) { m.deco('la_ember', x + 0.5, y + 0.5, { solid: false, scale: 1, glow: 1, lightCol: [120, 40, 8], label: TX.crack }); n++; }
    }
    for (const [dx, dy] of [[0, 0], [-3, 2], [3, -2], [1, 4], [-2, -3], [4, 2]]) m.deco('la_caps', HOLLOW.x + dx + 0.5, HOLLOW.y + dy + 0.5, { solid: false, scale: 1, glow: 1, lightCol: [14, 74, 64], label: TX.bloom });
    // what you look at from the ledge
    m.deco('la_mark', 78.6, 48.5, { solid: false, scale: 1, label: TX.view });
    // the carter, at the lip
    m.npc('la_carter', 79.9, 46.2, { name: TX.carter, wander: false, dir: Math.PI });
    m.baseCount = m.entities.length;
    return m;
  }
  function buildBothy() {
    const m = new GameMap(BOTHY, "Marget Sayle's bothy", 7, 6, { floor: 't_flag', ceil: 't_la_turfroof', fogDist: 7, ambient: 0.05, music: 'inside', spawn: { x: 3.5, y: 4.4, dir: -Math.PI / 2 } });
    m._la = true; m.safe = true;
    m.border('t_house_la_drystone');
    m.set(3, 5, DOOR({ portal: { map: LEDGE, x: 83.5, y: 30.6, dir: Math.PI / 2 }, label: TX.doorOut }));
    m.deco('la_hearth', 3.5, 1.4, { solid: true, radius: 0.45, scale: 1, glow: 1, lightCol: [150, 66, 18], label: TX.hearth });
    m.deco('la_bed', 5.3, 2.5, { solid: true, radius: 0.45, scale: 1, label: TX.bed });
    m.deco('la_table', 1.6, 3.3, { solid: true, radius: 0.35, scale: 1, label: TX.table });
    m.npc('la_marget', 2.6, 1.9, { name: TX.marget, wander: false });
    m.baseCount = m.entities.length;
    return m;
  }

  // ---------------------------------------------------------------- the words (plain ASCII)
  const TX = {
    carter: 'The carter',
    marget: 'Marget Sayle',
    view: 'The Slagcrown, under the sun. From here it is a day and a half on foot. Nobody has walked it in thirty years and come back to say so.',
    door: 'A bothy of field stone under the ledge. Smoke at the hole in the roof. Somebody keeps a fire here.',
    doorOut: 'The door. Outside, the shelf, and the way back up to the ledge.',
    hearth: 'A peat fire, banked. It has not been let go out in a long time.',
    bed: 'A box bed with one blanket. She sleeps facing the door.',
    table: 'A board on two stones. A cup, a knife, a tally of days cut along the edge. There are a great many.',
    crack: 'Fire in the ground. The heat reaches you from here.',
    bloom: 'Corpse-caps, in a hollow where something died and was not limed. They give their own light. Do not go down wind of them.',
    intro: [
      'The first week of the thaw, S.31.',
      'Thirty years since the Slagcrown broke the Vaults open. The sun went dark that year and has not come back.',
      'Gytha Marrin, who keeps the receipts at the Burned Quay, has sent you north for one of the four who came back from the first survey.',
      'Her name is Marget Sayle. She has never said what she saw.',
      'Her bothy is under this ledge.',
    ],
    arrive: ['The highland edge. Hoarfrost.', 'Look west.'],
    journal: 'Gytha Marrin sent us north for Marget Sayle, one of the four who came back from the first survey. Her bothy is under the ledge, down the ramp on the north side.',
  };
  // what anyone in the north will say when asked (a person's own answer, in NPCS, comes first)
  const TOPICS_LA = {
    'The Slagcrown': { low: 'The greatest of the five Citadels. It broke the Vaults open, and the sun went dark that year. Nobody lives there.', high: 'The Slagcrown followed the Black Seam down to worked stone that was not ours, and broke it on a lord\'s order. Who made that stone, nobody knows.' },
    'The sun': { low: 'It went dark the year of the Breaking. Thirty years. Spring still comes, barely.', high: 'Some say the ash is thinning. No one can prove it.' },
    'The Smothering': { low: 'The ash, and what came up with it. We count the years from it. This is the thirty-first.', high: 'Ash, then goblins, then the ork packs running from something deeper, then the big things. Then the lords went south and burned the ships.' },
    'Marget Sayle': { low: 'One of the four who came back from the first survey. She has never said what she saw.', high: 'One of the four who came back from the first survey. She has never said what she saw.' },
    'Gytha Marrin': { low: 'The Receipt-Wife, at the Burned Quay. She takes a receipt from everyone who walks down the Salt Trace, and writes them a line for it.', high: 'She was a tallywoman at Wexhaven when the fleet sailed. She has eleven thousand of the Crown\'s receipts, and she wants an answer.' },
    'The survey': { low: 'Ebba Cray took a survey through the breach, the year it was made. Four came back. Ebba Cray did not.', high: 'Ebba Cray took a survey through the breach, the year it was made. Four came back. They would not say what they saw, then or later.' },
    'The south': { low: 'Where the King went, and the court, and the priests. They burned the harbour behind them. Nobody here knows what is south.', high: 'Where the King went, and the court, and the priests. They burned the harbour behind them. Nobody here knows what is south.' },
    'The dead': { low: 'Lime the dead or meet them. The caps fruit in a body that is left.', high: 'Lime the dead or meet them. And say the name into the mouth. The ones put down without a name do not stay down.' },
  };
  function people() {
    if (typeof NPCS === 'undefined') return;
    if (typeof TOPICS !== 'undefined' && typeof TOPIC_KEYS !== 'undefined') { for (const k of Object.keys(TOPICS)) delete TOPICS[k]; Object.assign(TOPICS, TOPICS_LA); TOPIC_KEYS.length = 0; TOPIC_KEYS.push(...Object.keys(TOPICS)); }
    if (typeof PLACES !== 'undefined') for (const k of Object.keys(PLACES)) delete PLACES[k];
    NPCS.la_carter = {
      name: TX.carter, sprite: 'la_carter', portrait: 'la_carter', tier: 'low', scale: 1,
      greet: { polite: 'There it is, then.', normal: 'There it is.', blunt: 'I can see it. You need not point.' },
      topics: {
        'The Slagcrown': 'My father hauled plate out of there before I was born. He said the spoil heaps stood round the pitheads like a crown. He did not say it burned.',
        'The sun': 'It was like that when I was born. People tell me it used to be something you could not look at. I look at it all the time.',
        'Marget Sayle': 'Under the ledge, the Receipt-Wife said. Down the ramp on the north side. She will not want to come. I would not.',
      },
    };
    NPCS.la_marget = {
      name: TX.marget, sprite: 'la_marget', portrait: 'la_marget', tier: 'low', scale: 0.95,
      greet: { polite: 'You came up the Bell Road. In the thaw. Sit down before you fall down.', normal: 'Shut the door. The fire is not for the hill.', blunt: 'Say what you want and say it quietly.' },
      topics: {
        'Gytha Marrin': 'The Receipt-Wife. Still counting. Tell her I am not a receipt.',
        'The survey': 'Six went through with Ebba Cray. Four came back. I am one of the four. That is all I have ever said and it is all I will say here.',
        'The south': 'They are digging under their salt. I heard it from a reaver who thought I was deaf. I have been waiting for somebody to come and ask me to go and tell them not to.',
      },
    };
  }

  // ---------------------------------------------------------------- the coal sun and the ash (3D renderer only)
  const TRI = `
out vec2 vNdc;
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0; vNdc = p; gl_Position = vec4(p, 0.0, 1.0); }`;
  const SKY_FS = `
uniform vec4 uLaSun;    // xyz: toward the sun (GL world), w: its radius in radians
uniform vec4 uLaK;      // x: day 0..1, y: clock (s), z: the bearing the land burns on (the Slagcrown's)
uniform vec4 uLaFace;   // the sun's face (js/sun3.js). x: coal 0..1, y: a clear noon 0..1, z: sun above the horizon 0..1,
                        // w: 1 when the sun moves. (1, 0, *, 0) is the fixed coal sun exactly as Phase 1 drew it.
in vec2 vNdc;
layout(location=0) out vec4 oColor; layout(location=1) out vec4 oAux;
float lh(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
float ln(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(lh(i), lh(i + vec2(1, 0)), f.x), mix(lh(i + vec2(0, 1)), lh(i + vec2(1, 1)), f.x), f.y); }
float lfbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * ln(p); p = p * 2.03 + vec2(17.1, 9.3); a *= 0.5; } return s; }
void main() {
  // one colour per logical pixel, so the sky is pixel art at any render scale
  float k = max(1.0, uUp.w);
  vec2 fc = (floor(gl_FragCoord.xy / k) + 0.5) * k;
  vec2 ndc = fc / uView2.xy * 2.0 - 1.0;
  ivec2 lp = ivec2(fc / k);
  vec4 a = uInvViewProj * vec4(ndc, 1.0, 1.0); vec4 b = uInvViewProj * vec4(ndc, -1.0, 1.0);
  vec3 dir = normalize(a.xyz / a.w - b.xyz / b.w);
  vec3 sd = normalize(uLaSun.xyz);
  float ang = acos(clamp(dot(dir, sd), -1.0, 1.0)), R = uLaSun.w;
  float up = max(dir.z, 0.0);
  // bearing measured from the sun, so the one seam in the smoke lies opposite it, in the rock at your back
  float saz = atan(sd.y, sd.x), az = mod(atan(dir.y, dir.x) - saz + 3.14159265, 6.2831853) - 3.14159265;
  float daz = abs(az);
  float day = uLaK.x;
  // the air: black overhead, old brick low down, fire along the horizon under the sun
  vec3 c = mix(vec3(0.030, 0.028, 0.034), vec3(0.150, 0.066, 0.050), exp(-up * 5.5));
  // (the fire along the horizon belongs to the land, not the sun: once the sun moves, it stays over the Slagcrown)
  float wst = abs(mod(atan(dir.y, dir.x) - uLaK.z + 3.14159265, 6.2831853) - 3.14159265);
  float hz = mix(daz, wst, uLaFace.w);
  c += vec3(0.80, 0.26, 0.07) * exp(-up * 15.0) * exp(-hz * hz / 1.3) * 0.60;
  c += vec3(0.58, 0.15, 0.045) * exp(-ang * ang / 0.060) * 0.70;
  // smoke for cloud: dark above, lit red underneath where it hangs near the sun
  float cl = lfbm(vec2(az * 2.6 + uLaK.y * 0.004, up * 8.0 - az * 0.7));
  if (uLaFace.w > 0.5 && daz > 2.6) {      // a moving sun turns the seam into view: there, cross-fade the smoke with its other side
    float az2 = az - sign(az) * 6.2831853;
    cl = mix(cl, lfbm(vec2(az2 * 2.6 + uLaK.y * 0.004, up * 8.0 - az2 * 0.7)), smoothstep(2.6, 3.14159265, daz) * 0.5);
  }
  float cover = smoothstep(0.38, 0.62, cl) * smoothstep(0.015, 0.12, up);
  vec3 smoke = mix(vec3(0.020, 0.018, 0.022), vec3(0.26, 0.085, 0.04), exp(-ang * ang / 0.16) * 0.85 + exp(-up * 10.0) * 0.22);
  c = mix(c, smoke, cover * 0.92);
  float glow = 0.0;
  // the coal sun: a dark disc, a burning rim, a thin corona
  if (ang < R) {
    float m = ln(dir.xy * 60.0 + dir.z * 31.0);
    c = vec3(0.050, 0.016, 0.012) * (0.75 + 0.5 * m);
  } else {
    float rim = exp(-pow((ang - R) / (R * 0.16), 2.0));
    float cor = exp(-(ang - R) / (R * 1.5)) * (0.75 + 0.25 * sin(atan(dir.z - sd.z, daz) * 9.0 + uLaK.y * 0.2));
    c += vec3(2.2, 0.72, 0.16) * rim * (1.0 - cover * 0.5) + vec3(1.0, 0.30, 0.07) * cor * 0.5 * (1.0 - cover * 0.6);
    glow = clamp(rim, 0.0, 1.0);
  }
  // below the horizon, where the map ends: the haze the land burns into
  if (dir.z < 0.0) c = mix(c, vec3(0.085, 0.036, 0.028), smoothstep(0.0, -0.05, dir.z));
  c *= mix(0.42, 1.0, day);
  // the other faces of the sun (canon: "a pale coin behind the ash, a disc you can look at directly"; and "the sun
  // throws a shadow at noon now, on some days"). Near the horizon every sun sinks into the ash and is the coal again.
  if (uLaFace.x < 1.0) {
    float clear = uLaFace.y;
    vec3 d = mix(mix(vec3(0.150, 0.142, 0.135), vec3(0.27, 0.31, 0.35), clear), mix(vec3(0.37, 0.325, 0.27), vec3(0.60, 0.585, 0.53), clear), exp(-up * 3.2));
    d += vec3(0.50, 0.43, 0.31) * exp(-ang * ang / 0.09) * mix(0.14, 0.50, clear);
    d += vec3(0.42, 0.13, 0.04) * exp(-up * 22.0) * exp(-wst * wst / 0.9) * 0.5;                       // the land still burns under it
    vec3 pall = mix(vec3(0.105, 0.098, 0.092), vec3(0.40, 0.375, 0.335), exp(-ang * ang / 0.3) * 0.8 + 0.12);
    d = mix(d, pall, cover * mix(0.88, 0.30, clear));
    float gd = 0.0;
    if (ang < R * 0.82) { d = mix(vec3(0.93, 0.89, 0.76), vec3(1.7, 1.6, 1.3), clear) * (1.0 - cover * mix(0.30, 0.05, clear)); gd = clear; }
    else d += vec3(1.3, 1.15, 0.8) * exp(-(ang - R * 0.82) / (R * 0.9)) * clear * 0.6;
    if (dir.z < 0.0) d = mix(d, mix(vec3(0.20, 0.175, 0.15), vec3(0.33, 0.32, 0.29), clear), smoothstep(0.0, -0.05, dir.z));
    d *= mix(0.30, 1.0, uLaFace.z);
    c = mix(d, c, uLaFace.x); glow = mix(gd, glow, uLaFace.x);
  }
  c += (float(r3dBayer(lp)) / 16.0 - 0.5) / 42.0;
  oColor = vec4(max(c, 0.0), 1.0);
  oAux = vec4(1.0 / 255.0, glow, 0.0, 1.0);
}`;
  const ASH_FS = `
uniform vec4 uLaK;      // x: day, y: clock (s), z: the camera's bearing (rad)
in vec2 vNdc;
layout(location=0) out vec4 oColor; layout(location=1) out vec4 oAux;
float lh(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
// one fleck per grid cell, drawn as one logical pixel
float fleck(vec2 lp, float cell, float density, vec2 drift) {
  vec2 p = lp + drift; vec2 c = floor(p / cell);
  if (lh(c) > density) return 0.0;
  vec2 at = floor(vec2(lh(c + 3.1), lh(c + 7.7)) * cell);
  vec2 d = floor(p - c * cell) - at;
  return (d.x == 0.0 && d.y == 0.0) ? 1.0 : 0.0;
}
void main() {
  float k = max(1.0, uUp.w);
  vec2 lp = floor(gl_FragCoord.xy / k);
  float t = uLaK.y, turn = uLaK.z * 150.0;
  float ash = fleck(lp, 13.0, 0.42, vec2(turn + t * 5.0, t * 11.0)) + fleck(lp, 21.0, 0.5, vec2(turn * 0.6 + t * 3.0, t * 7.0));
  float emb = fleck(lp, 37.0, 0.3, vec2(turn * 1.3 - t * 4.0, -t * 9.0));
  if (emb > 0.5) { oColor = vec4(2.2, 0.8, 0.2, 1.0); oAux = vec4(0.0, 1.0, 0.0, 0.0); return; }
  if (ash > 0.5) { oColor = vec4(vec3(0.46, 0.44, 0.43) * mix(0.5, 1.0, uLaK.x), 0.62); oAux = vec4(0.0); return; }
  discard;
}`;
  const GLS = { vao: null, sky: null, ash: null, failed: null };
  const laMap = (F) => !!(F && F.map && F.map._la && F.outdoor);
  const START = { tod: 0.735 };          // the hour the prologue opens at (a later phase may move it)
  // the three Options switches (Options -> Graphics & access). Off means the engine draws as it did without this file.
  const SWITCHES = [
    ['laSky', 'The coal sun', 'The dark sun, its burning rim and the red sky over the highland (3D renderer only)'],
    ['laAsh', 'Ash and embers', 'Ash falling and embers rising across the view (3D renderer only)'],
    ['laFire', 'Burning ground', 'The beds of the cracks and the bloom in its hollow give their own light (3D renderer only)'],
  ];
  const sw = (k) => typeof GFX === 'undefined' || GFX[k] !== false;
  // where the sun stands this frame, and its face: fixed as Phase 1 drew it, unless js/sun3.js is loaded and switched on
  const FIXED = { az: SUN.az, el: SUN.el, coal: 1, clear: 0, up: 1, moving: 0 };
  function sunNow(F) { try { if (typeof SUN3 !== 'undefined' && SUN3.on()) return SUN3.state(F); } catch (e) { /* the fixed sun */ } return FIXED; }
  function sunDir(st) { const c = Math.cos(st.el); return [Math.cos(st.az) * c, Math.sin(st.az) * c, Math.sin(st.el)]; }
  function dayOf(F) { const tod = F.tod == null ? 0.5 : F.tod, elev = Math.cos((tod - 0.5) * Math.PI * 2); return smooth(-0.3, 0.1, elev); }
  function initGL(gl) {
    GLS.vao = gl.createVertexArray();
    try { GLS.sky = R3D.program(TRI, SKY_FS, { chunks: ['common'] }); GLS.ash = R3D.program(TRI, ASH_FS, { chunks: ['common'] }); } catch (e) { GLS.failed = String(e && e.message); }
  }
  const tri = (gl) => { gl.bindVertexArray(GLS.vao); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null); };
  const skyPass = {
    name: 'la-coalsun', order: 1,
    init(gl) { initGL(gl); },
    enabled(F) { return sw('laSky') && laMap(F) && !!GLS.sky && !GLS.failed; },
    draw(gl, F) {
      if (!laMap(F) || !GLS.sky || !GLS.sky.p) return;
      R3D.bindScene(gl, F);
      gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
      const p = R3D.use(GLS.sky), u = p.u, st = sunNow(F), s = sunDir(st);
      if (u.uLaSun) gl.uniform4f(u.uLaSun, s[0], s[1], s[2], SUN.r);
      if (u.uLaK) gl.uniform4f(u.uLaK, dayOf(F), F.time || 0, Math.PI, 0);
      if (u.uLaFace) gl.uniform4f(u.uLaFace, st.coal, st.clear, st.up, st.moving);
      tri(gl);
    },
  };
  const ashPass = {
    name: 'la-ash', order: 55,
    enabled(F) { return sw('laAsh') && laMap(F) && !!GLS.ash && !GLS.failed && (typeof GFX === 'undefined' || GFX.particles !== 0); },
    draw(gl, F) {
      if (!laMap(F) || !GLS.ash || !GLS.ash.p) return;
      R3D.bindScene(gl, F);
      const depth = gl.isEnabled(gl.DEPTH_TEST), blend = gl.isEnabled(gl.BLEND);
      gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      const p = R3D.use(GLS.ash), u = p.u;
      if (u.uLaK) gl.uniform4f(u.uLaK, dayOf(F), F.time || 0, (F.cam && F.cam.dir) || 0, 0);
      tri(gl);
      if (!blend) gl.disable(gl.BLEND); if (depth) gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
    },
  };

  // the burning cracks and the bloom, as ground that gives its own light (the renderer's glow material)
  function glowGround(m, h) {
    if (!sw('laFire') || !m || m.id !== LEDGE || !m.floorCells || !m.verts) return 0;
    const B = h.B, L = { [FL.EMBER]: h.tex('t_la_ember'), [FL.BLOOM]: h.tex('t_la_bloom') }, V = m.verts, W1 = m.w + 1;
    let tris = 0;
    for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) {
      const f = m.floorCells[y * m.w + x]; if (L[f] === undefined || m.cells[y * m.w + x]) continue;
      const q = [V[y * W1 + x], V[y * W1 + x + 1], V[(y + 1) * W1 + x], V[(y + 1) * W1 + x + 1]];
      if (Math.max(...q) - Math.min(...q) > 0.7) continue;                      // the bed of a crack burns, not its walls
      if (f === FL.BLOOM && hash(x, y, 97) > 0.42) continue;                    // the bloom glows in patches
      const z = (vx, vy) => V[vy * W1 + vx] + 0.03;
      const a = B.vert(x, y, z(x, y), x, y, L[f], -1, h.MAT.glow, 1, 0, 0, 1), b = B.vert(x + 1, y, z(x + 1, y), x + 1, y, L[f], -1, h.MAT.glow, 1, 0, 0, 1);
      const c = B.vert(x + 1, y + 1, z(x + 1, y + 1), x + 1, y + 1, L[f], -1, h.MAT.glow, 1, 0, 0, 1), d = B.vert(x, y + 1, z(x, y + 1), x, y + 1, L[f], -1, h.MAT.glow, 1, 0, 0, 1);
      B.quad(a, b, c, d); tris += 2;
    }
    return tris;
  }

  // ---------------------------------------------------------------- the start
  function begin() {
    try { Audio_.init(); Audio_.resume(); } catch (e) { /* no sound yet */ }
    hide('#title');
    const ci = Math.max(0, CLASSES.findIndex((c) => c.id === 'quarry'));
    CREATE.step = 4; CREATE.name = 'The deserter'; CREATE.auto = ''; CREATE.cls = ci; CREATE.face = 1; CREATE.bio = BIOGRAPHY.map(() => 0);
    const attrs = Object.assign({}, CLASSES[ci].attrs);
    for (let i = 0; i < CREATE.bio.length; i++) { const a = BIOGRAPHY[i].a[CREATE.bio[i]]; for (const k in a.mod) attrs[k] += a.mod[k]; }
    CREATE.attrs = attrs;
    startGame();
  }
  function arrive() {
    const box = document.querySelector('#msgs'); if (box) box.innerHTML = '';
    G.journal = [{ cat: 'main', text: TX.journal, day: G.day }];
    G.tod = START.tod;
    try { if (typeof Weather !== 'undefined' && Weather.hold) Weather.hold('clear'); } catch (e) { /* the engine's own weather */ }
    msg(TX.arrive[0], 'warn', 5000); msg(TX.arrive[1], 'info', 6000);
  }
  function wire() {
    installArt(); people();
    if (typeof INTRO !== 'undefined' && Array.isArray(INTRO)) { INTRO.length = 0; for (const l of TX.intro) INTRO.push(l); }
    if (typeof LANDMARKS !== 'undefined') { LANDMARKS[LEDGE] = []; }
    try { if (typeof EAVES78 !== 'undefined' && EAVES78.STYLES) { EAVES78.STYLES[LEDGE] = { builds: 'field stone laid dry, under turf and heather thatch', shutters: 'none', only: ['one low room, one door, no window on the weather side'], low: true, maxRidge: 2.2, roof: 'e78_thatch' }; EAVES78.MAPS.add(LEDGE); } } catch (e) { /* roofs stay flat */ }
    // only this game's maps exist: the engine's own are built (its modules expect them while building) and then put down
    if (typeof buildAllMaps === 'function') {
      const _b = buildAllMaps;
      buildAllMaps = function () { try { _b.apply(this, arguments); } catch (e) { /* the engine's maps are not needed */ } const maps = {}; maps[LEDGE] = buildLedge(); maps[BOTHY] = buildBothy(); return maps; };
    }
    // anything that asks for a place this game does not have lands on the ledge
    if (typeof loadMap === 'function') {
      const _lm = loadMap;
      loadMap = function (id, pos) {
        const stray = !G.maps || !G.maps[id], opening = G.state === 'intro';
        const r = stray ? _lm.call(this, LEDGE) : _lm.call(this, id, pos);
        if (stray && opening) setTimeout(arrive, 0);
        return r;
      };
    }
    // the cliff holds. The engine lets a player wade into its water floor (index 2); on this game's maps that index is
    // the drop under the ledge, and nobody steps onto it
    if (typeof GameMap !== 'undefined' && GameMap.prototype && GameMap.prototype.isBlocked) {
      const _ib = GameMap.prototype.isBlocked;
      GameMap.prototype.isBlocked = function (x, y) {
        if (this._la && this.floorCells && x >= 0 && y >= 0 && x < this.w && y < this.h && this.floorCells[y * this.w + x] === FL.DROP) return true;
        return _ib.call(this, x, y);
      };
    }
    const btn = typeof document !== 'undefined' ? document.getElementById('btn-new') : null;
    if (btn) btn.addEventListener('click', (ev) => { ev.stopImmediatePropagation(); ev.preventDefault(); begin(); }, true);
    if (typeof R3D !== 'undefined' && R3D.extendMesh) R3D.extendMesh(glowGround);
    if (typeof DAYS !== 'undefined' && Array.isArray(DAYS)) { const n = DAYS.length || 8; DAYS.length = 0; for (let i = 0; i < n; i++) DAYS.push('The thaw'); }
    if (typeof R3D !== 'undefined' && R3D.addPass) { try { R3D.addPass(skyPass); R3D.addPass(ashPass); } catch (e) { GLS.failed = String(e && e.message); } }
  }
  // the Options rows
  function optionRows() {
    if (typeof renderAccessibilityMenu !== 'function' || typeof document === 'undefined') return;
    const _acc = renderAccessibilityMenu;
    renderAccessibilityMenu = function () {
      const r = _acc.apply(this, arguments);
      try {
        const grid = document.querySelector('#modal-panel .ctl-grid');
        for (const [key, name, what] of SWITCHES) {
          const id = 'gfx-' + key.toLowerCase();
          if (!grid || document.getElementById(id)) continue;
          const label = document.createElement('span'); label.className = 'gfx-label'; label.appendChild(document.createTextNode(name + ' '));
          const sm = document.createElement('small'); sm.className = 'muted'; sm.textContent = what; label.appendChild(sm);
          const b = document.createElement('button'); b.className = 'dfbtn small'; b.id = id; b.type = 'button'; b.setAttribute('aria-label', name);
          const sync = () => { b.textContent = sw(key) ? 'On' : 'Off'; b.setAttribute('aria-pressed', sw(key) ? 'true' : 'false'); };
          b.onclick = () => { GFX[key] = !sw(key); if (typeof GFX.changed === 'function') GFX.changed(); if (typeof R3D !== 'undefined' && R3D.invalidate) R3D.invalidate(); sync(); };
          sync(); grid.appendChild(label); grid.appendChild(b);
        }
      } catch (e) { /* the menu still opens without the rows */ }
      return r;
    };
  }
  wire(); optionRows();
  return { LEDGE, BOTHY, W, H, SUN, CIT, PLATEAU, SHELF, RAMP, HOLLOW, CANYON, landH, citadelTop, buildLedge, buildBothy, TX, TOPICS: TOPICS_LA, FL, hash, gl: () => GLS, begin, SWITCHES, START, laMap,
    tiles: () => ({ t_la_rock: paintRock(), t_la_frost: paintFrost(21), t_la_frost2: paintFrost(121), t_la_scorch: paintScorch(), t_la_ember: paintEmber(), t_la_slag: paintSlag(), t_la_bloom: paintBloom(), t_house_la_drystone: paintDrystone(), t_la_turfroof: paintTurfRoof() }) };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = LEDGE1;
