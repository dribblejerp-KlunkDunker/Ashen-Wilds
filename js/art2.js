// ============================================================
//  art2 - Phase 2, "our own art". The Shattered Octave's pictures are gone from this repository (owner, 11 Nov:
//  "the octaves art will leave now"). js/assets.js is an empty table. Everything the game draws is made here, in code:
//
//    tiles     the eight wall and floor tiles the engine itself falls back on (stone, flagstones, planks, turf, a
//              plank door, cobbles, dead grass, black water), 64 x 64. The engine's other tile names point at these.
//    people    the carter and Marget Sayle: one front-view painting each, 160 high, built from a skeleton so the
//              engine's moving-paintings rig (js/paintfolk76.js, autorig) can measure them without hand work.
//    things    a banked peat fire in a kerb of stones, a box bed, a board on two stones.
//    a hand    the deserter's right hand and a slag-iron blade with a glim mark near the guard (first person).
//
//  Nothing here uses a random number or a clock: every pixel comes from a fixed hash of its position.
//  The painters run in Node too (test/art2.test.js, tools/icons.js): ART2.paint() returns the raw pictures.
// ============================================================
'use strict';

const ART2 = (() => {
  // ---------------------------------------------------------------- the kit
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  function hash(x, y, s) { let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2246822519)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, y, s, per) {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const m = per ? (q) => ((q % per) + per) % per : (q) => q;
    const a = hash(m(x0), m(y0), s), b = hash(m(x0 + 1), m(y0), s), c = hash(m(x0), m(y0 + 1), s), d = hash(m(x0 + 1), m(y0 + 1), s);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }
  const px = (r, g, b) => ((255 << 24) | (clamp(b | 0, 0, 255) << 16) | (clamp(g | 0, 0, 255) << 8) | clamp(r | 0, 0, 255)) >>> 0;
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return px(n >> 16, (n >> 8) & 255, n & 255); };
  const cols = (...h) => h.map(hex);
  const DITH = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const dith = (x, y) => DITH[(x & 3) + (y & 3) * 4] / 16 - 0.5;
  // a colour from a small ramp (dark to light), dithered between neighbours so bands stay pixel art
  function ramp(c, t, x, y) { const k = clamp(t, 0, 0.999) * (c.length - 1) + dith(x, y) * 0.7; return c[clamp(Math.round(k), 0, c.length - 1)]; }
  const lum = (v) => (v & 255) + ((v >> 8) & 255) + ((v >> 16) & 255);

  // ---------------------------------------------------------------- the tiles (64 x 64, each wraps at its edges)
  function tile(fn) { const d = new Uint32Array(4096); for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) d[y * 64 + x] = fn(x, y); return d; }
  const tn = (x, y, cells, s) => vnoise(x * cells / 64, y * cells / 64, s, cells);
  function paintStone() {
    // field stone in rough courses, laid in clay
    const C = cols('#141416', '#1e1f22', '#292b2f', '#35383d', '#42464c'), J = hex('#08080a');
    return tile((x, y) => {
      const row = y >> 3, off = Math.floor(hash(row, 1, 201) * 16), sx = (x + off) & 63, w = 10 + Math.floor(hash(row, sx >> 4, 202) * 6), bx = sx % w, by = y & 7;
      if (by === 7 || bx === w - 1) return J;
      const k = hash(row, Math.floor(sx / w), 203);
      return ramp(C, 0.15 + k * 0.5 + tn(x, y, 16, 204) * 0.3 - (by === 6 ? 0.18 : 0) + (by === 0 ? 0.1 : 0), x, y);
    });
  }
  function paintFlags() {
    // flagstones: four big slabs to the tile, worn dark, grit in the joints
    const C = cols('#17140f', '#211c16', '#2b251d', '#372f25', '#443a2e'), J = hex('#0a0806');
    return tile((x, y) => {
      const ox = (y >> 5) * 13, sx = (x + ox) & 63, bx = sx & 31, by = y & 31;
      if (bx === 31 || by === 31) return J;
      const k = hash(sx >> 5, y >> 5, 211), wear = tn(x, y, 8, 212) * 0.45 + tn(x, y, 16, 213) * 0.2;
      return ramp(C, 0.12 + k * 0.3 + wear - (bx === 30 || by === 30 ? 0.15 : 0), x, y);
    });
  }
  function paintPlanks() {
    const C = cols('#120d08', '#1b130b', '#261a0f', '#322314', '#3e2c19'), J = hex('#070503');
    return tile((x, y) => {
      const b = x >> 3, bx = x & 7;
      if (bx === 7) return J;
      const grain = vnoise(b * 3.1 + x * 0.12, (y + hash(b, 0, 221) * 64) * 0.5, 222, 0) * 0.5 + tn(x, y, 32, 223) * 0.2;
      const end = ((y + Math.floor(hash(b, 1, 224) * 64)) & 63) === 0;
      return end ? J : ramp(C, 0.15 + hash(b, 2, 225) * 0.3 + grain - (bx === 0 ? 0.1 : 0), x, y);
    });
  }
  function paintTurf() {
    const C = cols('#0a0907', '#11100b', '#19170f', '#222014', '#2c2a1a'), ST = hex('#3a341f');
    return tile((x, y) => (hash(x, y, 231) > 0.975 ? ST : ramp(C, tn(x, y, 8, 232) * 0.6 + tn(x, y, 16, 233) * 0.4, x, y)));
  }
  function paintDoor() {
    // a plank door on two iron straps, a ring for a latch
    const C = cols('#150f09', '#20160c', '#2c1f11', '#392816', '#46321c'), IRON = cols('#0b0b0c', '#18191b', '#27292c'), J = hex('#060403');
    return tile((x, y) => {
      if (x < 2 || x > 61 || y < 2) return J;                                                  // the frame's shadow
      if ((y >= 12 && y <= 16) || (y >= 46 && y <= 50)) return (x % 9 === 4 && (y === 14 || y === 48)) ? IRON[2] : ramp(IRON, 0.3 + tn(x, y, 16, 241) * 0.5, x, y);
      const dx = x - 50, dy = y - 31, r = Math.hypot(dx, dy);
      if (r > 3.2 && r < 5.2) return ramp(IRON, 0.5 - dy * 0.08, x, y);
      const b = Math.floor((x - 2) / 10), bx = (x - 2) % 10;
      if (bx === 9) return J;
      return ramp(C, 0.2 + hash(b, 3, 242) * 0.25 + vnoise(x * 0.15 + b * 5, y * 0.45, 243, 0) * 0.45, x, y);
    });
  }
  function paintCobble() {
    const C = cols('#121213', '#1c1d1f', '#27282b', '#333539'), J = hex('#070708');
    return tile((x, y) => {
      const row = y >> 3, sx = (x + (row & 1) * 4) & 63, cx = (sx & 7) - 3.5, cy = (y & 7) - 3.5, r = Math.hypot(cx, cy * 1.1);
      if (r > 3.7) return J;
      return ramp(C, 0.25 + hash(sx >> 3, row, 251) * 0.4 - cx * 0.05 - cy * 0.07 + (r < 1.5 ? 0.12 : 0), x, y);
    });
  }
  function paintDeadGrass() {
    const C = cols('#0d0c09', '#15130d', '#1e1b12', '#282417', '#322d1c'), BL = hex('#4a4226');
    return tile((x, y) => {
      const blade = hash(x, y >> 2, 261) > 0.93 && ((y & 3) < 3);
      return blade ? BL : ramp(C, tn(x, y, 8, 262) * 0.55 + tn(x, y, 32, 263) * 0.35, x, y);
    });
  }
  function paintWater() {
    const C = cols('#040506', '#07090b', '#0b0e11', '#10151a'), GL = hex('#1c262e');
    return tile((x, y) => {
      const w = tn(x + tn(x, y, 4, 271) * 20, y * 2.2, 8, 272);
      return Math.abs(w - 0.5) < 0.02 ? GL : ramp(C, w, x, y);
    });
  }
  // the engine's nineteen tile names, each pointed at one of the eight
  const TILE_OF = {
    t_stone: 'stone', t_marble: 'stone', t_greymarble: 'stone', t_catacomb: 'stone', t_mausoleum: 'stone', t_glassrock: 'stone', t_brass: 'stone', t_house: 'stone',
    t_flag: 'flags', t_wood: 'planks', t_deepwood: 'planks', t_roof: 'turf', t_door: 'door', t_cobble: 'cobble',
    t_grass: 'grass', t_hedge: 'grass', t_moss: 'grass', t_water: 'water', t_shallows: 'water',
  };
  const TILE_PAINT = { stone: paintStone, flags: paintFlags, planks: paintPlanks, turf: paintTurf, door: paintDoor, cobble: paintCobble, grass: paintDeadGrass, water: paintWater };

  // ---------------------------------------------------------------- a sheet to paint figures and things on
  function sheet(w, h) { return { w, h, d: new Uint32Array(w * h), e: new Uint8Array(w * h) }; }
  const inb = (s, x, y) => x >= 0 && y >= 0 && x < s.w && y < s.h;
  const put = (s, x, y, c, glow) => { if (inb(s, x, y)) { s.d[y * s.w + x] = c; s.e[y * s.w + x] = glow ? 1 : 0; } };
  const at = (s, x, y) => (inb(s, x, y) ? s.d[y * s.w + x] : 0);
  // a rounded limb from (x0,y0) to (x1,y1), radius r0 to r1; lit from the upper left; `fold` adds cloth folds along it
  function limb(s, x0, y0, x1, y1, r0, r1, c, o) {
    o = o || {}; const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1, R = Math.max(r0, r1) + 1;
    for (let y = Math.floor(Math.min(y0, y1) - R); y <= Math.ceil(Math.max(y0, y1) + R); y++) for (let x = Math.floor(Math.min(x0, x1) - R); x <= Math.ceil(Math.max(x0, x1) + R); x++) {
      const qx = x + 0.5, qy = y + 0.5, t = clamp(((qx - x0) * dx + (qy - y0) * dy) / L2, 0, 1), cx = x0 + dx * t, cy = y0 + dy * t, r = lerp(r0, r1, t), ox = qx - cx, oy = qy - cy, d = Math.hypot(ox, oy);
      if (d > r) continue;
      let v = (o.base == null ? 0.56 : o.base) - (ox / r) * 0.3 - (oy / r) * 0.1 - (d / r) * (d / r) * 0.14;
      if (o.fold) v += (vnoise(x * 0.55 + (o.seed || 0), y * 0.11, 300 + (o.seed || 0), 0) - 0.5) * o.fold;
      put(s, x, y, ramp(c, v, x, y));
    }
  }
  // a shape that is `hw(y)` wide either side of `cx(y)` between y0 and y1: tunics, skirts, shawls
  function drape(s, y0, y1, cxf, hwf, c, o) {
    o = o || {};
    for (let y = Math.round(y0); y <= Math.round(y1); y++) {
      const t = (y - y0) / Math.max(1, y1 - y0), cx = typeof cxf === 'function' ? cxf(t) : cxf, hw = hwf(t);
      for (let x = Math.ceil(cx - hw - 0.5); x <= Math.floor(cx + hw - 0.5); x++) {
        const u = (x + 0.5 - cx) / Math.max(1, hw);
        let v = (o.base == null ? 0.56 : o.base) - u * 0.28 - u * u * 0.12 + (t < 0.08 ? 0.06 : 0);
        if (o.fold) v += (vnoise(x * 0.5 + (o.seed || 0), y * 0.09, 320 + (o.seed || 0), 0) - 0.5) * o.fold;
        if (o.hem && y >= y1 - 1) v -= 0.2;
        put(s, x, y, ramp(c, v, x, y));
      }
    }
  }
  function oval(s, cx, cy, rx, ry, c, o) {
    o = o || {};
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, d = u * u + v * v;
      if (d > 1) continue;
      put(s, x, y, ramp(c, (o.base == null ? 0.58 : o.base) - u * 0.28 - v * 0.14 - d * 0.12, x, y), o.glow);
    }
  }
  const box = (s, x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(s, x, y, c); };
  // the figure's own edge, drawn dark, so it reads against any ground
  function outline(s, c) {
    const edge = [];
    const clear = (x, y) => inb(s, x, y) && !at(s, x, y);        // past the picture's own border is not an edge: a limb may run off it
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { if (!at(s, x, y)) continue; if (clear(x - 1, y) || clear(x + 1, y) || clear(x, y - 1) || clear(x, y + 1)) edge.push(y * s.w + x); }
    for (const i of edge) if (!s.e[i]) s.d[i] = c;
  }
  const done = (s, o) => Object.assign({ w: s.w, h: s.h, data: s.d, emit: s.e.some((v) => v) ? s.e : null, hs: 1, cx: 0.5, dy: 0 }, o || {});

  // ---------------------------------------------------------------- the people
  const SKIN = cols('#3a2a20', '#5a4232', '#7a5c46', '#977458', '#b08a6a'), SKIN_OLD = cols('#3b2e26', '#5c4a3d', '#7b6656', '#96806e', '#ad9785');
  const INK = hex('#0a0807');
  // a face on a head already painted: brow shadow, eyes, nose, mouth. `age` adds the lines.
  function face(s, cx, ey, skin, age) {
    const D = skin[0], M = skin[1], H = skin[4];
    for (const sx of [-3, 3]) { put(s, cx + sx - (sx > 0 ? 1 : 0), ey - 1, M); put(s, cx + sx, ey - 1, M); put(s, cx + sx - (sx > 0 ? 1 : 0), ey, INK); put(s, cx + sx, ey, D); }
    put(s, cx - 1, ey + 1, M); put(s, cx - 1, ey + 2, M); put(s, cx - 1, ey + 3, D); put(s, cx, ey + 3, D); put(s, cx - 2, ey + 2, H);      // the nose, lit on its left
    put(s, cx - 2, ey + 6, D); put(s, cx - 1, ey + 6, D); put(s, cx, ey + 6, D);                                                             // the mouth: a straight line, shut
    if (age) { put(s, cx - 3, ey + 7, D); put(s, cx + 1, ey + 7, D); put(s, cx - 4, ey + 2, M); put(s, cx + 3, ey + 2, D); put(s, cx - 3, ey + 4, M); put(s, cx + 2, ey + 4, D); put(s, cx - 2, ey - 3, M); put(s, cx + 1, ey - 3, M); }
  }
  // The carter: young, off the causeway. A leather coif, a short mantle, a wool jerkin belted at the waist, trousers
  // bound below the knee, boots. Arms hang clear of the body and the legs stand apart, so every limb can move.
  function paintCarter() {
    const s = sheet(62, 160), X = 31;
    const WOOL = cols('#15140f', '#211f17', '#2d2a1f', '#3a3627', '#474230'), TROUSER = cols('#110e0b', '#1a1611', '#241e17', '#2e271d', '#383024');
    const LEATHER = cols('#120c08', '#1d130c', '#2a1b10', '#372415', '#452d1a'), MANTLE = cols('#0e1210', '#151b17', '#1d251f', '#263028', '#2f3b31'), BIND = cols('#2a261d', '#3b3628', '#4c4634');
    // legs and boots
    for (const [hx, kx, ax] of [[24.5, 24.2, 23.6], [37.5, 37.8, 38.4]]) {
      limb(s, hx, 88, kx, 116, 5.1, 4.6, TROUSER, { fold: 0.3, seed: hx | 0 });
      limb(s, kx, 116, ax, 150, 4.6, 4.0, TROUSER, { fold: 0.25, seed: 9 + (hx | 0) });
      for (let y = 122; y <= 140; y += 6) for (let x = Math.round(kx) - 5; x <= Math.round(kx) + 4; x++) if (at(s, x, y)) put(s, x, y, ramp(BIND, 0.5 - (x - kx) * 0.08, x, y));   // the bindings
      limb(s, ax, 143, ax, 152, 4.4, 4.6, LEATHER, { base: 0.5 });
      oval(s, ax + (hx < X ? -0.6 : 0.6), 155, 5.6, 3.6, LEATHER, { base: 0.5 });
    }
    // the jerkin, its belt and hem
    drape(s, 33, 90, X, (t) => (t < 0.62 ? lerp(11.2, 10.4, t / 0.62) : lerp(10.4, 12.2, (t - 0.62) / 0.38)), WOOL, { fold: 0.34, seed: 3, hem: true });
    box(s, 21, 72, 41, 74, LEATHER[1]); for (let x = 21; x <= 41; x++) put(s, x, 72, LEATHER[3]); box(s, 30, 71, 32, 75, hex('#5a5346')); put(s, 31, 73, INK);
    for (let y = 36; y <= 70; y += 1) put(s, X, y, y % 6 === 0 ? BIND[1] : WOOL[1]);                                                         // the lacing down the front
    // arms, cuffs and hands (clear of the body from the armpit down)
    for (const [sx, exx, hxx] of [[18, 13.2, 13.4], [44, 48.8, 48.6]]) {
      limb(s, sx, 34.5, exx, 58, 4.0, 3.7, WOOL, { fold: 0.3, seed: 20 + (sx | 0) });
      limb(s, exx, 58, hxx, 84, 3.7, 3.3, WOOL, { fold: 0.25, seed: 30 + (sx | 0) });
      for (let x = Math.round(hxx) - 4; x <= Math.round(hxx) + 3; x++) for (const y of [82, 83]) if (at(s, x, y)) put(s, x, y, LEATHER[2]);
      oval(s, hxx, 88, 3.1, 3.7, SKIN, { base: 0.5 });
    }
    // the mantle over the shoulders, and the neck
    drape(s, 25, 45, X, (t) => lerp(7.5, 15.2, Math.sqrt(t)), MANTLE, { fold: 0.3, seed: 5, hem: true });
    box(s, 28, 21, 33, 26, SKIN[1]); for (let y = 21; y <= 26; y++) put(s, 28, y, SKIN[2]);
    box(s, 26, 25, 35, 27, MANTLE[1]); for (let x = 26; x <= 35; x++) put(s, x, 25, MANTLE[3]);                                              // its collar
    // the head: a coif, and the face in it
    oval(s, X, 11.5, 9.2, 10.6, LEATHER, { base: 0.56 });
    oval(s, X, 13.4, 6.2, 7.8, SKIN, { base: 0.6 });
    for (let y = 16; y <= 22; y++) { put(s, X - 7, y, LEATHER[1]); put(s, X + 6, y, LEATHER[0]); }                                           // the coif's cheek straps
    for (let x = X - 2; x <= X + 1; x++) put(s, x, 22, LEATHER[2]);
    for (let x = X - 5; x <= X + 4; x++) put(s, x, 6, hash(x, 6, 401) > 0.4 ? hex('#2a1d12') : LEATHER[2]);                                  // hair under its edge
    face(s, X, 12, SKIN, false);
    outline(s, INK);
    return done(s, { hs: 1 });
  }
  // Marget Sayle: sixty-two. A linen headcloth tied under the chin, a heavy shawl crossed on the chest, a wool gown
  // to the ankle under an apron, her hands held together in front. She moves as one piece, as the old do in the cold.
  function paintMarget() {
    const s = sheet(58, 160), X = 29;
    const GOWN = cols('#100e0d', '#191615', '#231f1d', '#2d2826', '#38322f'), SHAWL = cols('#131110', '#1e1a17', '#2a241f', '#372f28', '#443a31');
    const LINEN = cols('#2c2a25', '#403d36', '#555148', '#69655a', '#7c776b'), APRON = cols('#26241f', '#37342d', '#49453c', '#5b574c'), SHOE = cols('#0c0907', '#17110c', '#231a12');
    for (const fx of [23, 35]) oval(s, fx, 156, 4.6, 3.2, SHOE, { base: 0.5 });
    // the gown and the apron over it
    drape(s, 60, 152, X, (t) => lerp(11.5, 17.2, Math.pow(t, 0.8)), GOWN, { fold: 0.42, seed: 7, hem: true });
    drape(s, 76, 138, X, (t) => lerp(6.2, 9.4, t), APRON, { fold: 0.3, seed: 8, hem: true });
    for (let y = 76; y <= 138; y++) { put(s, Math.round(X - lerp(6.2, 9.4, (y - 76) / 62)) , y, APRON[0]); }
    // the body under the shawl, then the shawl: wide on the shoulders, crossed, its ends tucked at the waist
    drape(s, 28, 76, X, (t) => lerp(10.5, 11.5, t), GOWN, { fold: 0.3, seed: 9 });
    drape(s, 24, 48, X, (t) => lerp(8.5, 16.4, Math.sqrt(t)), SHAWL, { fold: 0.4, seed: 10 });
    drape(s, 48, 82, X, (t) => lerp(16.4, 12.4, t), SHAWL, { fold: 0.4, seed: 11, hem: true });
    for (let i = 0; i <= 30; i++) { const y = 32 + i, xl = Math.round(X - 7 + i * 0.36), xr = Math.round(X + 6 - i * 0.36); put(s, xl, y, SHAWL[0]); put(s, xl + 1, y, SHAWL[3]); if (xr > xl + 2) { put(s, xr, y, SHAWL[0]); put(s, xr - 1, y, SHAWL[1]); } }   // where it crosses
    for (let x = X - 12; x <= X + 11; x += 2) if (at(s, x, 82)) put(s, x, 83, SHAWL[1 + ((x >> 1) & 1)]);                                    // its fringe
    // her hands, one over the other, held in the shawl's ends; the gown's dark cuffs either side of them
    limb(s, X - 9, 70, X - 3, 77, 3.4, 3.0, GOWN, { base: 0.5 }); limb(s, X + 9, 70, X + 3, 77, 3.4, 3.0, GOWN, { base: 0.42 });
    oval(s, X - 1.2, 77.4, 3.4, 2.5, SKIN_OLD, { base: 0.5 }); oval(s, X + 1.4, 78.6, 3.2, 2.3, SKIN_OLD, { base: 0.4 });
    put(s, X - 2, 78, SKIN_OLD[0]); put(s, X, 79, SKIN_OLD[0]);
    // the head: the headcloth, the face in it, the knot under the chin
    oval(s, X, 12.5, 9.4, 11.2, LINEN, { base: 0.52 });
    oval(s, X, 14.6, 5.8, 7.4, SKIN_OLD, { base: 0.56 });
    for (let x = X - 4; x <= X + 3; x++) if (hash(x, 7, 402) > 0.35) put(s, x, 7, hex('#8f8c86'));                                           // grey hair at the brow
    for (let y = 8; y <= 22; y++) { put(s, X - 7, y, LINEN[1]); put(s, X + 6, y, LINEN[0]); }                                                 // the cloth's shadow round the face
    box(s, X - 2, 23, X + 1, 25, LINEN[2]); put(s, X - 3, 25, LINEN[1]); put(s, X + 2, 25, LINEN[1]); put(s, X - 1, 26, LINEN[3]); put(s, X, 26, LINEN[1]);
    face(s, X, 13, SKIN_OLD, true);
    outline(s, INK);
    return done(s, { hs: 1 });
  }

  // ---------------------------------------------------------------- the things in the bothy
  function paintHearth() {
    // a banked peat fire on the floor in a kerb of stones: turves stacked dark, fire in the seams, ash at the edge
    const s = sheet(84, 48), ST = cols('#17171a', '#232428', '#303237', '#3e4146', '#4d5056'), PEAT = cols('#080605', '#110c08', '#1a120b', '#23180f');
    const FIRE = cols('#7a240a', '#c2440e', '#ee7a1a', '#ffb23c', '#ffe08a'), ASH = hex('#5c5750');
    // the turves: a low mound, dark, with seams that glow
    for (let y = 8; y <= 40; y++) for (let x = 12; x <= 71; x++) {
      const u = (x - 41.5) / 30, top = 10 + u * u * 22; if (y < top) continue;
      // the fire shows where the turves have cracked: veins, thickest low in the middle, none at the cold edges
      const heat = clamp(1 - Math.abs(u) * 1.1 - (y - top) * 0.012, 0, 1), vein = Math.min(Math.abs(vnoise(x * 0.16, y * 0.2, 411, 0) - 0.5), Math.abs(vnoise(x * 0.33 + 9, y * 0.3, 412, 0) - 0.5) * 1.3);
      if (vein < 0.035 * heat + 0.004 && heat > 0.15) put(s, x, y, ramp(FIRE, heat * (1 - vein / 0.04) * 0.95, x, y), true);
      else put(s, x, y, ramp(PEAT, 0.25 + vnoise(x * 0.25, y * 0.25, 413, 0) * 0.6 + (vein < 0.07 * heat ? 0.25 : 0), x, y));
    }
    for (const [x, y] of [[30, 9], [44, 6], [52, 10], [38, 12]]) { put(s, x, y, FIRE[3], true); put(s, x, y + 1, FIRE[1], true); }   // a few low flames
    // the kerb: nine stones along the front, two at each end
    const stone = (cx, cy, rx, ry, k) => oval(s, cx, cy, rx, ry, ST, { base: 0.42 + k * 0.2 });
    for (let i = 0; i < 9; i++) stone(7 + i * 8.8, 41 - Math.abs(i - 4) * 0.35 + hash(i, 0, 414) * 1.5, 5.2 + hash(i, 1, 415) * 1.2, 4.6 + hash(i, 2, 416) * 1.2, hash(i, 3, 417));
    stone(6, 33, 4.8, 4.4, 0.3); stone(78, 33, 4.8, 4.4, 0.6);
    for (let x = 14; x <= 70; x += 3) if (hash(x, 0, 418) > 0.5) put(s, x, 36 - (hash(x, 1, 419) * 2 | 0), ASH);
    outline(s, INK);
    return done(s, { hs: 0.36 });
  }
  function paintBed() {
    // a box bed: boards on three sides and above, straw, one blanket
    const s = sheet(120, 84), W = cols('#120d08', '#1c140c', '#281c10', '#342515', '#40301c'), STRAW = cols('#2a2412', '#3d351a', '#524823', '#665a2c'), BL = cols('#1d1e20', '#2a2c2f', '#383b3f', '#474b50');
    const plank = (x0, y0, x1, y1, seed, vert) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const b = vert ? Math.floor((x - x0) / 9) : Math.floor((y - y0) / 8), e = vert ? (x - x0) % 9 === 8 : (y - y0) % 8 === 7; put(s, x, y, e ? INK : ramp(W, 0.2 + hash(b, seed, 421) * 0.3 + vnoise(vert ? x * 0.2 : x * 0.5, vert ? y * 0.5 : y * 0.2, 422 + seed, 0) * 0.4, x, y)); } };
    plank(2, 4, 117, 15, 1, false);                 // the lid
    plank(2, 16, 11, 79, 2, true); plank(108, 16, 117, 79, 3, true);   // the ends
    plank(12, 58, 107, 79, 4, false);               // the front board
    box(s, 12, 16, 107, 57, hex('#050403'));        // the dark inside
    for (let y = 44; y <= 57; y++) for (let x = 12; x <= 107; x++) put(s, x, y, ramp(STRAW, 0.2 + hash(x, y, 423) * 0.6 - (57 - y) * 0.01, x, y));
    for (let y = 38; y <= 57; y++) for (let x = 40; x <= 107; x++) { const top = 40 + Math.sin(x * 0.19) * 1.6; if (y >= top) put(s, x, y, ramp(BL, 0.6 - (y - top) * 0.02 + (vnoise(x * 0.3, y * 0.2, 424, 0) - 0.5) * 0.4, x, y)); }
    oval(s, 26, 43, 11, 4.2, cols('#3a372f', '#56524a', '#726d62'), { base: 0.5 });   // a bolster
    box(s, 2, 80, 6, 83, W[1]); box(s, 113, 80, 117, 83, W[1]);
    outline(s, INK);
    return done(s, { hs: 0.62 });
  }
  function paintTable() {
    // a board on two stones; a cup, a knife; a tally cut along the near edge
    const s = sheet(100, 46), ST = cols('#17171a', '#232428', '#303237', '#3e4146'), W = cols('#17100a', '#22180e', '#2e2113', '#3b2b19', '#48351f'), CUP = cols('#2b2118', '#43352a', '#5c4a3a');
    for (const cx of [20, 80]) { oval(s, cx, 34, 12, 11, ST, { base: 0.45 }); box(s, cx - 11, 40, cx + 11, 45, ST[1]); for (let x = cx - 11; x <= cx + 11; x++) put(s, x, 45, ST[0]); }
    for (let y = 16; y <= 23; y++) for (let x = 3; x <= 96; x++) put(s, x, y, y === 16 ? W[4] : ramp(W, 0.35 + vnoise(x * 0.12, y * 0.6, 431, 0) * 0.45 - (y - 16) * 0.03, x, y));
    for (let x = 6; x <= 94; x += 2) if (hash(x, 0, 432) > 0.25) { put(s, x, 21, INK); put(s, x, 22, INK); if (x % 10 === 6) put(s, x, 20, INK); }   // the tally: a great many
    for (let y = 8; y <= 15; y++) for (let x = 60; x <= 66; x++) put(s, x, y, ramp(CUP, 0.6 - (x - 63) * 0.12, x, y)); box(s, 61, 8, 65, 8, INK);
    for (let x = 30; x <= 44; x++) put(s, x, 15, x < 35 ? W[1] : hex('#6a6e73')); put(s, 45, 15, hex('#8d9196'));
    outline(s, INK);
    return done(s, { hs: 0.4 });
  }
  function paintMark() { const s = sheet(2, 2); return done(s, { hs: 0.02 }); }   // nothing to see: a place a label hangs on

  // ---------------------------------------------------------------- the hand (first person; 99 x 190, the engine's size)
  function paintHand() {
    const s = sheet(99, 190);
    const IRON = cols('#08090a', '#111315', '#1b1e21', '#272b2f', '#353a3f', '#4a5057'), SLEEVE = cols('#171a10', '#1e2115', '#292d1d', '#343925', '#40462e'), GRIP = cols('#0f0a07', '#1a110b', '#261910');
    const GLIM = hex('#9fc4d8'), GLIM2 = hex('#5d8296');
    // the blade: slag-iron, dark, one lit edge, a fuller; it leans a little to the left
    const bx = (y) => 44 - (124 - y) * 0.105, bw = (y) => (y < 22 ? lerp(0.6, 4.2, (y - 6) / 16) : lerp(4.2, 5.4, (y - 22) / 102));
    for (let y = 6; y <= 124; y++) { const c = bx(y), w = bw(y); for (let x = Math.ceil(c - w - 0.5); x <= Math.floor(c + w - 0.5); x++) { const u = (x + 0.5 - c) / w; put(s, x, y, u < -0.72 ? IRON[5] : Math.abs(u) < 0.16 && y > 26 ? IRON[0] : ramp(IRON, 0.5 - u * 0.25 + (vnoise(x * 0.6, y * 0.12, 441, 0) - 0.5) * 0.3, x, y)); } }
    for (const [dx, dy] of [[-2, 0], [-1, 1], [0, 2], [1, 1], [2, 0], [0, 4], [0, 5], [-1, 6], [1, 6]]) put(s, Math.round(bx(108)) + dx, 104 + dy, dy > 3 ? GLIM2 : GLIM);   // the glim mark
    // the guard, the grip, the pommel
    limb(s, 31, 131, 59, 125, 2.6, 2.6, IRON, { base: 0.55 });
    limb(s, 45.5, 130, 48.5, 160, 3.1, 3.0, GRIP, { base: 0.5 });
    oval(s, 49.5, 164, 4.2, 4.0, IRON, { base: 0.5 });
    // the forearm and the fist round the grip
    // The sleeve is moss wool, and that matters: the engine (js/body21.js) knows cloth from skin in a hand picture by its
    // hue, and carries a sleeve that reaches the picture's bottom edge on out of the view, so no cut edge shows.
    limb(s, 81, 206, 60, 157, 16.5, 12.5, SLEEVE, { fold: 0.3, seed: 40 });
    for (let x = 50; x <= 78; x++) for (let y = 150; y <= 176; y++) if (at(s, x, y) && Math.abs((y - 166) + (x - 64) * 0.42) < 1.6) put(s, x, y, SLEEVE[0]);   // the cuff's edge
    oval(s, 47.5, 147, 13.2, 12.6, SKIN, { base: 0.5 });
    for (let i = 0; i < 4; i++) { const y = 138.5 + i * 5.6; limb(s, 36, y + 1.2, 52, y - 0.6, 3.0, 3.1, SKIN, { base: 0.56 - i * 0.03 }); for (let x = 35; x <= 54; x++) if (at(s, x, Math.round(y + 3.4))) put(s, x, Math.round(y + 3.4), SKIN[0]); }   // four fingers
    limb(s, 52, 135.5, 60, 142, 3.3, 3.6, SKIN, { base: 0.6 });                                                                                 // the thumb over them
    outline(s, INK);
    return done(s);
  }

  // ---------------------------------------------------------------- everything, as raw pictures
  let cache = null;
  function paint() {
    if (cache) return cache;
    const tiles = {}; for (const k in TILE_PAINT) tiles[k] = TILE_PAINT[k]();
    cache = { tiles, tileOf: TILE_OF, sprites: { la_carter: paintCarter(), la_marget: paintMarget(), la_hearth: paintHearth(), la_bed: paintBed(), la_table: paintTable(), la_mark: paintMark() }, hand: paintHand() };
    return cache;
  }
  // the coal sun as a small square picture: the game's mark (tools/icons.js writes the app icons from it)
  function mark(n) {
    const d = new Uint32Array(n * n), FIRE = cols('#5a1606', '#a8340b', '#e8691a', '#ffab3a', '#ffe9a0'), c = (n - 1) / 2, R = n * 0.27;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const r = Math.hypot(x - c, y - c), a = Math.atan2(y - c, x - c), k = (r - R) / (n * 0.045);
      let col = px(10 + (1 - y / n) * 6, 6, 6);
      if (y > n * 0.8) col = px(26 + (y / n - 0.8) * 160, 9 + (y / n - 0.8) * 40, 6);                                    // the red along the horizon
      if (r < R) col = px(8, 4, 4);
      else if (k < 1.2) col = FIRE[clamp(Math.round(4 - k * 2.2 + dith(x, y) * 0.8), 0, 4)];
      else if (k < 6) { const f = Math.exp(-(k - 1.2) * 0.75) * (0.75 + 0.25 * Math.sin(a * 9)); if (f > 0.22 + dith(x, y) * 0.3) col = FIRE[f > 0.6 ? 1 : 0]; }
      d[y * n + x] = col;
    }
    return d;
  }

  // ---------------------------------------------------------------- into the engine
  function install() {
    if (typeof Engine === 'undefined' || !Engine.addTexture) return false;
    const P = paint();
    for (const name in TILE_OF) Engine.addTexture(name, P.tiles[TILE_OF[name]]);
    for (const name in P.sprites) { const sp = P.sprites[name]; Engine.addSprite(name, { w: sp.w, h: sp.h, data: sp.data, hs: sp.hs, cx: sp.cx, dy: sp.dy }); if (sp.emit && Engine.setEmissive) Engine.setEmissive(name, sp.emit); }
    // a second player is the other of the default pair until creation exists: the engine's two partner figures wear the carter
    for (const alias of ['kaelen', 'lyra']) { const sp = P.sprites.la_carter; Engine.addSprite(alias, { w: sp.w, h: sp.h, data: sp.data, hs: sp.hs, cx: sp.cx, dy: sp.dy }); }
    if (typeof document !== 'undefined' && Engine.images) {
      const h = P.hand, c = document.createElement('canvas'); c.width = h.w; c.height = h.h;
      c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(h.data.buffer.slice(0)), h.w, h.h), 0, 0);
      Engine.images.fp_sword = c;
    }
    return true;
  }
  const installed = install();
  // the painter's kit, for later phases and for look tests (tools/look/): the same hands paint everything
  const kit = { sheet, put, at, limb, drape, oval, box, outline, done, cols, hex, px, ramp, dith, hash, vnoise, clamp, lerp, SKIN, SKIN_OLD, INK };
  return { paint, mark, install, installed, TILE_OF, hash, lum, kit };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = ART2;
