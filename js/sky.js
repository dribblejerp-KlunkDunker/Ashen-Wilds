// ============================================================
//  sky — Phase 2 module: night stars, painted area panoramas and the
//  Drift-Kestrel's flyovers in Part Three. Three sky hooks (Engine.addSkyHook),
//  so everything draws before the LANDMARKS ridges, the terrain and the walls
//  and only ever touches pixels the renderer marked as sky (F.mbuf === 1).
//  Switches: GFX.stars, GFX.panoramas, GFX.flyovers (all false = the old sky).
//  Phase 20: the panoramas (with the LANDMARKS ridges baked in) and the flyover ship are hand-built pixel art.
// ============================================================
'use strict';

const SKY = (() => {
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const PN = 2048;                       // panorama table width: one entry per 0.176 degrees
  const FLAGS = ['stars', 'panoramas', 'flyovers'];
  if (typeof GFX !== 'undefined') {
    for (const k of FLAGS) { if (GFX[k] === undefined) GFX[k] = true; if (!GFX.FX.includes(k)) GFX.FX.push(k); }
  }
  const on = (k) => typeof GFX === 'undefined' || GFX[k] !== false;
  // how much of the sky is night: 0 by day, 1 deep in the dark (F.skyDay falls to 0)
  const nightOf = (F) => clamp((0.5 - F.skyDay) / 0.45, 0, 1);

  function mulberry(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  // one deterministic number in 0..1 from an integer and a salt (the flyover schedule)
  function hash01(n, salt) { const r = mulberry((Math.imul(n | 0, 2654435761) ^ Math.imul(salt | 0, 40503)) >>> 0); r(); return r(); }

  // bearing of a world direction (0 = +x, as atan2(y, x)) -> screen column, or -1 if behind / outside the view
  function projectX(F, bearing, margin) {
    const c = Math.cos(bearing), s = Math.sin(bearing);
    const fwd = c * F.dirX + s * F.dirY; if (fwd < 0.15) return -1;
    const p = Math.hypot(F.planeX, F.planeY);
    const camX = (-c * F.dirY + s * F.dirX) / (fwd * p);
    const m = 1 + (margin || 0);
    if (camX < -m || camX > m) return -1;
    return (camX + 1) * 0.5 * F.w;
  }

  // ---- night stars -------------------------------------------------
  // A fixed field: each star owns a bearing and an elevation, so it turns with
  // the view like the real thing. Projected per star (no per-pixel work).
  const NSTAR = 760;
  // Phase 21: the look reaches higher (110 rows up on the raycaster), so a second field fills the sky above the first
  // one's top (1.21 half-heights) up to 2.8; built from its own seed after the first, so the old field is unchanged
  const NHI = 560, NALL = NSTAR + NHI;
  const st = { cx: new Float32Array(NALL), sy: new Float32Array(NALL), el: new Float32Array(NALL), mag: new Float32Array(NALL), ph: new Float32Array(NALL), sp: new Float32Array(NALL), r: new Uint8Array(NALL), g: new Uint8Array(NALL), b: new Uint8Array(NALL) };
  (function buildStars() {
    let r = mulberry(0x57A25);
    for (let i = 0; i < NALL; i++) {
      if (i === NSTAR) r = mulberry(0x57A26);
      const th = r() * TAU; st.cx[i] = Math.cos(th); st.sy[i] = Math.sin(th);
      st.el[i] = i < NSTAR ? 0.03 + Math.pow(r(), 0.85) * 1.18 : 1.21 + r() * 1.6;   // fractions of half the view height above the horizon
      const m = r(); st.mag[i] = 0.22 + 0.78 * m * m * m;     // most are faint, a few are bright
      st.ph[i] = r() * TAU; st.sp[i] = 1.2 + r() * 3.4;
      const tint = r();                                       // cold white, blue, or a warm ember
      if (tint < 0.55) { st.r[i] = 235; st.g[i] = 240; st.b[i] = 255; } else if (tint < 0.82) { st.r[i] = 170; st.g[i] = 195; st.b[i] = 255; } else { st.r[i] = 255; st.g[i] = 214; st.b[i] = 160; }
    }
  })();
  const stats = { stars: 0, panoPx: 0, flyPx: 0 };

  function drawStars(F) {
    stats.stars = 0;
    if (!F.outdoor || !on('stars')) return;
    const night = nightOf(F);
    // cloud and haze put the stars out; a storm or a sea-fog leaves none
    const vis = night * clamp(1 - F.wx.cloud * 1.45, 0, 1) * clamp(1 - F.wx.haze * 3.2, 0, 1) * (1 - F.wx.flash);
    if (vis < 0.03) return;
    const { fb, mbuf, w, h, S, horizon, dirX, dirY } = F;
    const p = Math.hypot(F.planeX, F.planeY), halfH = h * 0.5, t = F.animT;
    const extent = h * 0.1;           // stars dim into the horizon haze
    let n = 0;
    for (let i = 0; i < NALL; i++) {
      const c = st.cx[i], s = st.sy[i];
      const fwd = c * dirX + s * dirY; if (fwd < 0.15) continue;
      const camX = (-c * dirY + s * dirX) / (fwd * p);
      if (camX < -1.02 || camX > 1.02) continue;
      const x = ((camX + 1) * 0.5 * w) | 0;
      const y = (horizon - st.el[i] * halfH) | 0;
      if (y < 0 || y >= horizon) continue;
      const ext = clamp((horizon - y) / extent, 0, 1);
      const tw = 0.76 + 0.24 * Math.sin(t * st.sp[i] + st.ph[i]);   // subtle twinkle tied to the animation clock
      const base = vis * st.mag[i] * tw * ext;
      if (base < 0.03) continue;
      const bright = st.mag[i] > 0.7;
      for (let k = 0; k < 5; k++) {
        if (k > 0 && !(bright && base > 0.35)) break;
        const ox = k === 1 ? -S : k === 2 ? S : 0, oy = k === 3 ? -S : k === 4 ? S : 0;
        const kf = k ? 0.3 : 1;
        for (let dy = 0; dy < S; dy++) {
          const yy = y + oy + dy; if (yy < 0 || yy >= horizon) continue;
          for (let dx = 0; dx < S; dx++) {
            const xx = x + ox + dx; if (xx < 0 || xx >= w) continue;
            const o = yy * w + xx; if (mbuf[o] !== 1) continue;
            const px = fb[o], pr = px & 255, pg = (px >> 8) & 255, pb = (px >> 16) & 255;
            // only where the sky is dark: moon glow and dusk wash the stars out
            const lum = (pr + pg + pb) / 3, allow = clamp(1 - (lum - 20) / 110, 0, 1);
            const a = base * kf * allow; if (a < 0.02) continue;
            const r = pr + st.r[i] * a, g = pg + st.g[i] * a, b = pb + st.b[i] * a;
            fb[o] = (255 << 24) | ((b > 255 ? 255 : b) << 16) | ((g > 255 ? 255 : g) << 8) | (r > 255 ? 255 : r);
          }
        }
      }
      n++;
    }
    stats.stars = n;
  }

  // ---- painted area panoramas (Phase 20: pixel art) ----------------
  // Per map, three layers of distant country drawn once, at load, as a strip of
  // pixel art AW columns round and up to AH rows tall: a far wash of hills, a
  // middle band of woods, a near skyline of farmsteads, ruins or trees. The
  // shapes are hand-made stamps (strings below) and hand-shaped ridges, coloured
  // from a small palette per layer; every art pixel is drawn as one S x S block,
  // so the country stays crisp at either render scale. Each frame the palette is
  // mixed toward the air (time of day, weather) row by row, and the windows in
  // the near layer light up after dark. Only sky pixels are touched.
  const AW = 1536;             // art columns per full turn: one per screen column at the view's centre at 1x
  const AH = 56;               // the tallest a layer may stand, in art rows (one row = S screen rows); the Grove spire-hill needs 54
  // palette slots: 1 dark edge, 2 shadow, 3 body, 4 lit, 5 crest light, 6 snow, 7 snow in shade,
  // 8 window (lit after dark), 9 roof, 10 pale stone or wall, 11 bark and dark timber
  const NSLOT = 12;
  function mkLayer(pal, mix) { return { art: new Uint8Array(AW * AH), top: new Uint8Array(AW), pal, mix, h: new Float32Array(PN) }; }
  const wrapX = (x) => ((x % AW) + AW) % AW;
  function put(L, x, row, c) {
    if (row < 0 || row >= AH) return;
    x = wrapX(x); L.art[row * AW + x] = c;
    if (c && row + 1 > L.top[x]) L.top[x] = row + 1;
  }
  // a column index from a world bearing (0 = east, as atan2)
  const colOf = (ang) => wrapX(Math.round((ang / TAU + 0.5) * AW));
  // smooth periodic noise, amp rows tall, `cells` bumps per turn
  function noise(r, cells, amp) {
    const v = new Float32Array(cells), out = new Float32Array(AW); for (let i = 0; i < cells; i++) v[i] = r();
    for (let i = 0; i < AW; i++) { const u = i / AW * cells, i0 = u | 0, f = u - i0, sm = f * f * (3 - 2 * f); out[i] = amp * (v[i0 % cells] * (1 - sm) + v[(i0 + 1) % cells] * sm); }
    return out;
  }
  const sum = (...a) => { const o = new Float32Array(AW); for (const b of a) for (let i = 0; i < AW; i++) o[i] += typeof b === 'number' ? b : b[i]; return o; };
  // a ridge filled from the horizon up: faces rising toward +x catch the light, falling ones are in shade,
  // the crest carries a one-pixel highlight; optional snow above a ragged snowline, field lines on downland
  function ridge(L, hts, o) {
    o = o || {};
    const base = o.shape || hts;   // faces are read from the smooth shape; the drawn crest may be craggier
    const snowN = o.snow ? noise(mulberry(0xC0FFEE ^ (L.art.length + Math.round(hts[7] * 97))), 61, 3) : null;
    // snow lies above one height for the whole range, so only the high summits carry it
    let peak = 0; for (let x = 0; x < AW; x++) if (hts[x] > peak) peak = hts[x];
    const snowLine = peak * (o.snow || 0);
    for (let x = 0; x < AW; x++) {
      const H = Math.round(hts[x]); if (H < 1) continue;
      // slope over nine columns: broad sunlit and shaded flanks, not column-by-column flicker
      const sl = (base[(x + 4) % AW] - base[(x + AW - 4) % AW]) / 8;
      // tone runs from shade (2) through body (3) to sunlit (4), dithered so the flanks are gradients, not panels
      const tone = clamp(0.5 + sl * 5, 0, 0.999) * 2;
      const face = sl > 0.09 ? 4 : sl < -0.09 ? 2 : 3;
      const crestSl = hts[(x + 1) % AW] - hts[(x + AW - 1) % AW];
      const snowAt = snowN ? snowLine + snowN[x] - 1.5 + (sl > 0 ? 1 : 0) : 1e9;   // the sunlit flank holds its snow a row higher
      for (let row = 0; row < H; row++) {
        let c = 2 + ((tone | 0) + ((tone % 1) > dith2(x, row) ? 1 : 0));
        if (row === H - 1) c = crestSl > 0.5 || face === 4 ? 5 : face === 2 ? 3 : 4;
        if (row >= snowAt + (dith2(x, row) - 0.5) * 2) c = tone - 0.4 > dith2(x + 1, row + 2) * 1.2 ? 6 : 7;
        else if (o.fields && row < H - 2 && row > 0) {
          // hedgerows and field edges: contour lines, broken every few dozen columns
          const band = (row + ((x >> 5) & 1)) % o.fields;
          if (band === 0 && ((x * 7) % 41) > 6) c = 2;
          if (((x + row * 3) % 53) === 0) c = 2;
        }
        else if (o.rock && row < H - 1 && row > 1) {
          // crags: short diagonal fissures and ledges, darker on the shaded faces
          if (((x * 2 + row * 3) % 23) === 0 || ((x * 5 - row * 7) % 61) === 0) c = face === 2 ? 1 : 2;
          else if (face !== 2 && ((x + row * 11) % 37) === 0) c = 5;
        }
        if (o.base && row < o.base) c = 2;
        put(L, x, row, c);
      }
    }
  }
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const dith2 = (x, y) => (BAY[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
  // stamps: rows top to bottom; '.' is empty, 1-9 are slots, 'a' is slot 10 and 'b' slot 11
  const STAMP = {
    con1: ['..4..', '.443.', '..43.', '.4432', '44332', '.443.', '44332', '43322', '..b..'],
    con2: ['...4...', '...43..', '..443..', '...43..', '..4432.', '.44332.', '..4432.', '.443322', '4443322', '..4432.', '.443322', '4433222', '...b...'],
    con3: ['..5..', '..4..', '.443.', '..43.', '.4432', '..432', '.4432', '44322', '..b..', '..b..'],
    rt1: ['..454..', '.44443.', '4444332', '4443322', '.33222.', '...b...'],
    rt2: ['..44543..', '.4454433.', '444443332', '444433322', '.4433322.', '..32222..', '....b....', '....b....'],
    rt3: ['.454.', '44433', '44332', '.322.', '..b..'],
    thorn: ['.4..4..', '4443.43', '.44332.', '..43...', '...b...', '..b....'],
    willow: ['...4443..', '.4444433.', '444443333', '4.44333.3', '4.4.33.3.', '3.4.3..3.', '..3.3..2.', '..2.b..2.', '....b....'],
    house: ['......1..', '....9991.', '...99999.', '..9999999', '.99999999', 'aaa8aaa8a', 'aaaaaaaaa', 'aa1aaa8aa'],
    house2: ['.1......', '.1.99...', '.199999.', '99999999', 'a8aa8aaa', 'aaaaaaaa', 'aa1aa8aa'],
    barn: ['....9999999..', '..99999999999', '9999999999999', 'aaaaaaaaaaaaa', 'a1aaaa11aaaaa', 'a1aaaa11aaaa8'],
    spire: ['..5..', '..4..', '.443.', '.443.', '.432.', '.432.', '44322', '4a322', '4a322', '48322', '44322', '44322', '48322', '44322'],
    chapel: ['..5.......', '..4.......', '.443......', '.432......', '44322.....', '4a3229999.', '4832999999', '4432aaaaaa', '4432a8aa8a', '4432aaaaaa'],
    stone: ['.4.', '443', '432', '432', '432'],
    stone2: ['44.', '432', '432', '432'],
    pylon: ['.....1', '....1.', '...11.', '..1.1.', '..131.', '..1.1.', '.1131.', '.1.11.', '.131.1', '.1.1.1', '11311.', '1.1.1.', '13111.', '1.1.11', '131.1.', '1.1.1.', '11.111'],
    col: ['555', '444', '432', '432', '432', '432', '432', '432', '432', '432', '544'],
    colb: ['5.', '44.', '432', '432', '432', '432', '432', '544'],
    colc: ['..5', '.43', '432', '432', '544'],
    arch: ['..5555555..', '.44333334..', '44.......44', '43.......43', '43.......43', '43.......43', '43.......43'],
    mspire: ['..5..', '..4..', '..4..', '.443.', '.443.', '.432.', '44432', '44432', '4a432', '44432', '44432', '4a432', '44432', '44432', '44432'],
    stump: ['4..5.4...', '44.44344.', '4443433.4', '444333332', '448333322', '444333322', '444333322', '4a4333322', '444333322', '444333322', '448333322', '444333322'],
    fold: ['aaaa.aaaa', 'a2aaaaa2a'],
    cairn: ['..a..', '.aa4.', 'aa4a3', 'a4a33'],
  };
  const SLOT = { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, a: 10, b: 11 };
  function stamp(L, name, x, base, flip) {
    const s = STAMP[name], h = s.length, w = s[0].length, x0 = Math.round(x - w / 2);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const ch = s[j][flip ? w - 1 - i : i], c = SLOT[ch]; if (!c) continue;
      put(L, x0 + i, base + (h - 1 - j), c);
    }
  }
  // a woodland band: ground of a few rows, then trees standing on it at irregular spacing
  function wood(L, r, base, spacing, kinds, opts) {
    opts = opts || {};
    const g = sum(base, noise(r, 23, 2.2));
    for (let x = 0; x < AW; x++) { const H = Math.round(g[x]); for (let row = 0; row < H; row++) put(L, x, row, row === H - 1 ? 3 : 2); }
    for (let x = r() * spacing; x < AW; x += spacing * (0.5 + r())) {
      if (opts.skip && opts.skip(x)) continue;
      const k = kinds[(r() * kinds.length) | 0];
      stamp(L, k, x, Math.round(g[Math.round(x) % AW]) - 1, r() < 0.5);
      if (opts.double && r() < opts.double) stamp(L, kinds[(r() * kinds.length) | 0], x + 3 + r() * 3, Math.round(g[Math.round(x) % AW]) - 1, r() < 0.5);
    }
    return g;
  }
  function finish(L) {
    for (let i = 0; i < PN; i++) L.h[i] = L.top[Math.floor(i * AW / PN)] / AH;
    return L;
  }
  const P = (o) => { const p = new Array(NSLOT).fill(null); for (const k in o) p[+k] = o[k]; return p; };
  const near = (x, c, w) => { let d = Math.abs(x - c); if (d > AW / 2) d = AW - d; return d < w; };

  // the recipes. Bearings: 0 east, PI/2 south, -PI/2 north (atan2 on the map grid).
  const RECIPES = {
    oakhaven(r) {   // chalk downs with their field lines, wooded crests and orchards, farmsteads and Greenroot's spire
      const A = mkLayer(P({ 1: [50, 56, 70], 2: [60, 66, 82], 3: [70, 78, 94], 4: [84, 92, 108], 5: [104, 112, 126] }), 0.6);
      ridge(A, sum(5, noise(r, 9, 9), noise(r, 31, 3)), { fields: 4 });
      const B = mkLayer(P({ 1: [20, 28, 24], 2: [28, 40, 32], 3: [38, 52, 38], 4: [52, 68, 46], 5: [70, 86, 56], 11: [38, 30, 22] }), 0.4);
      wood(B, r, sum(2, noise(r, 13, 5)), 9, ['rt1', 'rt2', 'rt3'], { double: 0.5 });
      const C = mkLayer(P({ 1: [22, 20, 24], 2: [34, 32, 38], 3: [48, 44, 48], 4: [64, 58, 56], 5: [82, 74, 64], 8: [38, 38, 50], 9: [88, 50, 40], 10: [146, 132, 108], 11: [42, 30, 22] }), 0.24);
      const g = sum(1, noise(r, 19, 2));
      for (let x = 0; x < AW; x++) for (let row = 0; row < Math.round(g[x]); row++) put(C, x, row, 2);
      const gb = (x) => Math.round(g[Math.round(wrapX(x))]) - 1;
      const greenroot = colOf(-0.75);
      for (let x = 30; x < AW; x += 40 + r() * 70) {
        if (near(x, greenroot, 40)) continue;
        const k = r();
        if (k < 0.34) { stamp(C, r() < 0.5 ? 'house' : 'house2', x, gb(x), r() < 0.5); stamp(C, 'rt1', x + 9, gb(x + 9)); }
        else if (k < 0.5) { stamp(C, 'barn', x, gb(x), r() < 0.5); stamp(C, 'rt3', x - 9, gb(x - 9)); }
        else for (let t = 0; t < 3; t++) stamp(C, ['rt1', 'rt3', 'thorn'][(r() * 3) | 0], x + t * 7, gb(x + t * 7));
      }
      stamp(C, 'chapel', greenroot, gb(greenroot)); stamp(C, 'house2', greenroot + 14, gb(greenroot + 14)); stamp(C, 'rt2', greenroot - 12, gb(greenroot - 12));
      return [finish(A), finish(B), finish(C)];
    },
    clearing(r) {   // blue hills with snow behind, the conifer edge of the forest, the stone ring and the snapped pylon
      const A = mkLayer(P({ 1: [44, 50, 66], 2: [54, 60, 78], 3: [64, 72, 92], 4: [80, 88, 108], 5: [100, 108, 128], 6: [176, 182, 196], 7: [136, 144, 164] }), 0.58);
      ridge(A, sum(4, noise(r, 7, 14), noise(r, 25, 4)), { snow: 0.74 });
      const B = mkLayer(P({ 1: [16, 26, 26], 2: [22, 36, 34], 3: [30, 46, 42], 4: [42, 60, 50], 5: [58, 76, 60], 11: [34, 28, 22] }), 0.4);
      wood(B, r, sum(2, noise(r, 17, 4)), 4, ['con1', 'con2', 'con3'], { double: 0.4 });
      const C = mkLayer(P({ 1: [18, 22, 22], 2: [26, 34, 32], 3: [36, 46, 40], 4: [52, 62, 50], 5: [70, 80, 60], 10: [120, 116, 104], 11: [34, 28, 22] }), 0.24);
      const ring = colOf(0.11), pylon = colOf(2.07);
      const g = wood(C, r, sum(1, noise(r, 21, 2)), 14, ['rt1', 'rt2', 'rt3', 'thorn'], { skip: (x) => near(x, ring, 40) || near(x, pylon, 12) });
      const gb = (x) => Math.round(g[Math.round(wrapX(x))]) - 1;
      for (let k = 0; k < 7; k++) { const x = ring - 30 + k * 10 + ((r() * 3) | 0); stamp(C, k % 3 === 1 ? 'stone2' : 'stone', x, gb(x), k > 3); }
      // the pylon: iron lattice, snapped near the top, a rust slot in the palette
      stamp(C, 'pylon', pylon, gb(pylon));
      return [finish(A), finish(B), finish(C)];
    },
    whispergrove(r) {   // violet hills, weeping willows, the sunken court's broken colonnade and the marble spires
      const A = mkLayer(P({ 1: [58, 48, 80], 2: [66, 54, 90], 3: [76, 62, 100], 4: [90, 76, 114], 5: [108, 94, 130] }), 0.58);
      ridge(A, sum(5, noise(r, 8, 9), noise(r, 27, 3)));
      const B = mkLayer(P({ 1: [36, 30, 54], 2: [44, 36, 64], 3: [56, 46, 78], 4: [72, 62, 94], 5: [92, 82, 112], 11: [40, 32, 46] }), 0.42);
      wood(B, r, sum(2, noise(r, 15, 3)), 11, ['willow', 'willow', 'rt2'], { double: 0.3 });
      const C = mkLayer(P({ 1: [30, 24, 46], 2: [44, 36, 62], 3: [62, 54, 82], 4: [86, 78, 106], 5: [118, 110, 138], 10: [104, 96, 124], 8: [50, 44, 70] }), 0.28);
      const g = sum(1, noise(r, 12, 1.5));
      for (let x = 0; x < AW; x++) for (let row = 0; row < Math.round(g[x]); row++) put(C, x, row, 2);
      const gb = (x) => Math.round(g[Math.round(wrapX(x))]) - 1;
      for (let x = 20; x < AW; x += 34 + r() * 24) {
        const k = r();
        if (k < 0.22) { stamp(C, 'arch', x, gb(x)); }
        else if (k < 0.75) { for (let n = 0; n < 4; n++) { const xx = x + n * 6; if (r() < 0.8) stamp(C, ['col', 'colb', 'colc'][(r() * 3) | 0], xx, gb(xx)); } }
        else stamp(C, 'willow', x, gb(x), r() < 0.5);
      }
      for (let k = 0; k < 6; k++) { const x = Math.round(AW * (0.07 + k * 0.161) + r() * 30); stamp(C, 'mspire', x, gb(x)); }
      return [finish(A), finish(B), finish(C)];
    },
    deepwoods(r) {   // snow-shouldered far hills, black conifer forest, a broken tower stump
      const A = mkLayer(P({ 1: [46, 48, 68], 2: [54, 56, 78], 3: [64, 66, 90], 4: [78, 80, 104], 5: [98, 100, 122], 6: [168, 172, 194], 7: [128, 132, 158] }), 0.58);
      ridge(A, sum(5, noise(r, 6, 15), noise(r, 22, 4)), { snow: 0.7 });
      const B = mkLayer(P({ 1: [14, 20, 24], 2: [20, 28, 32], 3: [26, 36, 40], 4: [36, 48, 50], 5: [50, 64, 62], 11: [26, 22, 22] }), 0.42);
      wood(B, r, sum(2, noise(r, 15, 3)), 3, ['con1', 'con2', 'con3'], { double: 0.5 });
      const C = mkLayer(P({ 1: [12, 16, 18], 2: [18, 24, 28], 3: [24, 32, 36], 4: [34, 44, 46], 5: [46, 58, 58], 10: [84, 84, 92], 8: [30, 30, 40], 11: [22, 18, 18] }), 0.26);
      const tower = colOf(-0.38);
      const g = wood(C, r, sum(1, noise(r, 24, 2)), 5, ['con1', 'con2', 'con3', 'con2'], { skip: (x) => near(x, tower, 9) });
      stamp(C, 'stump', tower, Math.round(g[tower]) - 1);
      return [finish(A), finish(B), finish(C)];
    },
    p20_downs(r) {   // the Watch Downs [PROPOSED]: chalk country west of the clearing, sheepfolds and thorn, woods below
      const A = mkLayer(P({ 1: [50, 56, 70], 2: [60, 66, 82], 3: [72, 80, 96], 4: [86, 94, 110], 5: [106, 114, 128], 6: [172, 178, 192], 7: [134, 142, 162] }), 0.58);
      ridge(A, sum(4, noise(r, 8, 13), noise(r, 29, 3)), { snow: 0.8 });
      const B = mkLayer(P({ 1: [22, 30, 26], 2: [30, 42, 32], 3: [42, 56, 40], 4: [56, 72, 48], 5: [74, 90, 58], 10: [150, 146, 128], 11: [38, 30, 22] }), 0.4);
      ridge(B, sum(3, noise(r, 11, 6), noise(r, 37, 2)), { fields: 5 });
      for (let x = r() * 40; x < AW; x += 30 + r() * 60) stamp(B, r() < 0.5 ? 'rt3' : 'thorn', x, Math.max(0, B.top[Math.round(wrapX(x))] - 1));
      const C = mkLayer(P({ 1: [22, 24, 22], 2: [34, 40, 32], 3: [48, 56, 42], 4: [64, 72, 52], 5: [84, 92, 64], 10: [138, 132, 116], 11: [40, 30, 22] }), 0.24);
      const g = wood(C, r, sum(1, noise(r, 19, 2)), 26, ['thorn', 'rt3', 'rt1'], {});
      for (let x = 60; x < AW; x += 160 + r() * 120) stamp(C, 'fold', x, Math.round(g[Math.round(wrapX(x))]) - 1);
      return [finish(A), finish(B), finish(C)];
    },
    _default(r) {   // rolling country with a few lone trees
      const A = mkLayer(P({ 1: [50, 54, 70], 2: [58, 62, 80], 3: [68, 74, 92], 4: [82, 88, 106], 5: [100, 106, 124] }), 0.6);
      ridge(A, sum(4, noise(r, 8, 9), noise(r, 27, 3)));
      const B = mkLayer(P({ 1: [32, 36, 44], 2: [40, 44, 54], 3: [50, 54, 64], 4: [62, 66, 74], 5: [78, 82, 88] }), 0.44);
      ridge(B, sum(2, noise(r, 13, 6)));
      const C = mkLayer(P({ 1: [24, 26, 30], 2: [32, 34, 40], 3: [42, 44, 50], 4: [56, 58, 62], 5: [72, 74, 76], 11: [36, 30, 24] }), 0.28);
      wood(C, r, sum(1, noise(r, 18, 2)), 40, ['rt1', 'rt3', 'thorn'], {});
      return [finish(A), finish(B), finish(C)];
    },
  };
  // The LANDMARKS ridges (js/upgrades.js: the Grey Teeth, cliff shoulders, downs, per outdoor map) were drawn by
  // the engine as smooth gradient silhouettes over the panorama. With panoramas on they are baked here instead, one
  // pixel-art layer per ridge from the same numbers (bearing, width, height, peakiness, lumpiness, snow cap, colour,
  // aerial distance), and the engine's own pass is handed an empty list for that map; with panoramas off the original
  // lists are put back untouched, so the off state is the old frame exactly.
  const EMPTY = Object.freeze([]);
  const LM_ORIG = {};
  const lmList = (id) => { if (typeof LANDMARKS === 'undefined') return null; const k = LM_ORIG[id] ? id : (LANDMARKS[id] && LANDMARKS[id] !== EMPTY ? id : '_default'); if (!LM_ORIG[k] && LANDMARKS[k] && LANDMARKS[k] !== EMPTY) LM_ORIG[k] = LANDMARKS[k]; return { key: k, list: LM_ORIG[k] || [] }; };
  function syncLandmarks(id, want) {
    if (typeof LANDMARKS === 'undefined') return;
    if (want) { const L = lmList(id); if (L && LANDMARKS[L.key] !== EMPTY) LANDMARKS[L.key] = EMPTY; return; }
    // put back only what this module took away (anyone else's own edits to LANDMARKS stand)
    for (const k in LM_ORIG) if (LANDMARKS[k] === EMPTY) LANDMARKS[k] = LM_ORIG[k];
  }
  function landmarkLayer(lm, idx) {
    const c = lm.c || [30, 26, 42], cap = lm.cap || null;
    const sc = (k, add) => c.map((v) => clamp(v * k + add, 0, 255));
    const L = mkLayer(P({ 1: sc(0.7, 0), 2: sc(0.84, 0), 3: c, 4: sc(1.18, 6), 5: sc(1.4, 12), 6: cap, 7: cap ? cap.map((v) => v * 0.8) : null }), clamp(0.2 + (lm.far || 0) * 0.5, 0, 0.82));
    const hts = new Float32Array(AW), jag = mulberry(0x51A0 + idx * 977);
    for (let x = 0; x < AW; x++) {
      let da = (x + 0.5) / AW * TAU - Math.PI - lm.a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
      const tt = Math.abs(da) / lm.aw; if (tt >= 1) continue;
      let prof = Math.pow(1 - tt, lm.p || 1.6);
      if (lm.ridge) prof *= 1 + lm.ridge * Math.sin(tt * 11 + (lm.seed || 0) * 2.7) * 0.5;
      hts[x] = Math.max(0, prof) * lm.h * 150;
    }
    // a little crag along the crest, so a range reads as rock and not as a curve
    const crag = Float32Array.from(hts);
    for (let x = 0, run = 0, off = 0; x < AW; x++) { if (--run <= 0) { run = 3 + ((jag() * 7) | 0); off = jag() < 0.55 ? 0 : jag() < 0.6 ? 1 : -1; } if (hts[x] > 6) crag[x] += off; }
    ridge(L, crag, { shape: hts, snow: cap ? 1 - (lm.capH || 0.3) : 0, rock: lm.h > 0.15 });
    L.far = lm.far || 0;
    return finish(L);
  }
  const panos = {}, recipeCache = {};
  // the layers for a map, farthest first: its baked LANDMARKS ridges, then the recipe's far, middle and near layers
  function panorama(id) {
    const key = RECIPES[id] ? id : '_default', lmk = lmList(id), ck = key + '|' + (lmk ? lmk.key : '');
    if (panos[ck]) return panos[ck];
    if (!recipeCache[key]) recipeCache[key] = RECIPES[key](mulberry(hashStr('pano:' + key)));
    const ridges = lmk ? lmk.list.map(landmarkLayer) : [];
    const all = ridges.concat(recipeCache[key]).sort((a, b) => b.mix - a.mix);
    panos[ck] = all;
    return all;
  }
  for (const k in RECIPES) recipeCache[k] = RECIPES[k](mulberry(hashStr('pano:' + k)));   // built once at load, never per frame
  // the ridge layers are baked just after load, once every module has registered its maps' LANDMARKS
  setTimeout(() => { try { for (const k of ['oakhaven', 'clearing', 'whispergrove', 'deepwoods', '_default']) panorama(k); } catch (e) { /* drawn lazily instead */ } }, 0);

  // per-frame state kept outside the draw so nothing allocates
  let ai = new Int16Array(320), aiDir = NaN, aiW = 0, aiP = NaN;
  let lut = new Uint8Array(8 * NSLOT * AH * 3);   // layer x slot x art row x rgb, rebuilt each frame
  function drawPanorama(F) {
    stats.panoPx = 0;
    if (!F.outdoor) return;
    const want = on('panoramas');
    syncLandmarks(F.map && F.map.id, want);
    if (!want) return;
    const { fb, mbuf, w, h, S, horizon } = F;
    if (horizon < 1) return;
    const layers = panorama(F.map && F.map.id), NL = layers.length;
    if (lut.length < NL * NSLOT * AH * 3) lut = new Uint8Array(NL * NSLOT * AH * 3);
    // art column of every screen column, recomputed only when the view turns
    if (ai.length !== w) { ai = new Int16Array(w); aiDir = NaN; }
    if (aiDir !== F.cam.dir || aiW !== w || aiP !== F.planeX) {
      for (let x = 0; x < w; x++) { const cx = 2 * (x + 0.5) / w - 1; const ang = Math.atan2(F.dirY + F.planeY * cx, F.dirX + F.planeX * cx); ai[x] = (((ang / TAU + 0.5) * AW) | 0) % AW; }
      aiDir = F.cam.dir; aiW = w; aiP = F.planeX;
    }
    // the air: half the sky's own colour at the horizon, half the map's fog (which already carries weather)
    const yh = clamp(horizon, 0, h - 1) * w;
    let sr = 0, sg = 0, sb = 0;
    for (let k = 1; k <= 3; k++) { const px = fb[yh + ((w * k / 4) | 0)]; sr += px & 255; sg += (px >> 8) & 255; sb += (px >> 16) & 255; }
    const hr = sr / 6 + F.fogR * 0.5, hg = sg / 6 + F.fogG * 0.5, hb = sb / 6 + F.fogB * 0.5;
    const dayM = (0.34 + 0.66 * F.skyDay) * (1 - F.wx.dark * 0.45);
    const hazeAdd = F.wx.haze * 0.7;
    // windows in the near layer glow after dark (none in a sea-fog)
    const night = nightOf(F), glow = night > 0.25 && F.wx.haze < 0.25 ? night * (1 - F.wx.haze * 3) * 0.85 : 0;
    for (let li = 0; li < NL; li++) {
      const L = layers[li];
      for (let s = 1; s < NSLOT; s++) {
        const c = L.pal[s]; if (!c) continue;
        for (let row = 0; row < AH; row++) {
          const v = (row + 0.5) / 18;   // rows above the base climb out of the ground haze
          let mix = clamp(L.mix + hazeAdd + Math.max(0, 1 - v) * 0.2 - Math.min(1, v) * 0.04, 0, 0.96);
          let r = c[0] * dayM, g = c[1] * dayM, b = c[2] * dayM;
          if (s === 8 && glow > 0) { r += (255 - r) * glow; g += (178 - g) * glow; b += (70 - b) * glow; mix *= 1 - glow * 0.8; }
          const o = ((li * NSLOT + s) * AH + row) * 3;
          lut[o] = r * (1 - mix) + hr * mix; lut[o + 1] = g * (1 - mix) + hg * mix; lut[o + 2] = b * (1 - mix) + hb * mix;
        }
      }
    }
    // art rows count up from the horizon itself; looking far up (Phase 21's wider look) it can sit below the frame, and the
    // rows that fall below the frame are simply not drawn (for a horizon inside the frame this is the old rule exactly)
    const yEnd = horizon;
    let n = 0;
    for (let li = 0; li < NL; li++) {
      const L = layers[li], art = L.art, top = L.top, lb = li * NSLOT;
      for (let x = 0; x < w; x++) {
        const a = ai[x], tp = top[a]; if (!tp) continue;
        for (let row = 0; row < tp; row++) {
          const s = art[row * AW + a]; if (!s) continue;
          const q = ((lb + s) * AH + row) * 3, col = (255 << 24) | (lut[q + 2] << 16) | (lut[q + 1] << 8) | lut[q];
          const yb = yEnd - row * S;   // this art row's S screen rows, counted up from the horizon
          for (let k = 0; k < S; k++) {
            const y = yb - k; if (y < 0) break; if (y >= h) continue;
            const o = y * w + x; if (mbuf[o] !== 1) continue;
            fb[o] = col; n++;
          }
        }
      }
    }
    stats.panoPx = n;
  }

  // ---- Drift-Kestrel flyovers --------------------------------------
  // Once a cycle (about 90 s) the airship crosses the sky over the Spectral
  // Woods and the Deep Woods for about 12 s, small and hazed, on a fixed
  // bearing path derived from the animation clock, so turning the view moves it.
  const FLY = { period: 90, dur: 12, maps: { whispergrove: true, deepwoods: true }, sweep: 1.35 };
  let forced = null;
  const last = { active: false, forced: false, u: 0, bearing: 0, elev: 0, dir: 1, x: -1, y: -1, drawn: 0, mapId: '' };
  // the flight in progress at animation time t, or null
  function flightAt(t) {
    if (forced) { if (t >= forced.start && t < forced.start + FLY.dur) return { start: forced.start, u: (t - forced.start) / FLY.dur, b0: forced.b0, dir: forced.dir, k: -1, forced: true }; return null; }
    if (t < 0) return null;
    const k = Math.floor(t / FLY.period), start = k * FLY.period + 18 + hash01(k, 1) * 50;
    if (t < start || t >= start + FLY.dur) return null;
    return { start, u: (t - start) / FLY.dur, b0: hash01(k, 2) * TAU - Math.PI, dir: hash01(k, 3) < 0.5 ? -1 : 1, k, forced: false };
  }
  // The ship is hand-drawn pixel art (Phase 20): the Drift-Kestrel as the game paints her at the crash, a timber
  // hull with a bowsprit, two masts under square sails, the brass lift-tank slung along her side, and lanterns at
  // bow and stern. Bow to the right; the art is mirrored when she flies the other way. One art pixel is drawn as an
  // S x S block. The two red pennants are [PROPOSED].
  const SHIP_ART = [
    '............ppm.........ppm.............',
    '...........p..mllllllllpllm.............',
    '...........occmCCo.....occmCCo..........',
    '..........ccccmCCCC...ccccmCCCC.........',
    '..........RRRRmRRRR...RRRRmRRRR.........',
    '..........ccccmCCCC...ccccmCCCCl........',
    '........ll.cccmCCCC....cccmCCCC.l.......',
    '.......l......m...l....l..m......ll....m',
    '...oooooo.....m...l....l..m........lmmmL',
    '..Lowwwwrrrrrrrrrrrrrrrrrrrrrrrrrrrml...',
    '...owgwgwwwwoYYYSYYYSYYYowwwwwwwwwwoo...',
    '....owwwwwwoBBBBSBBBSBBBBowwwwwwwwwwo...',
    '.....oWWWWWWoDDDSDDDSDDDoWWWWWWWWWWo....',
    '......owwwwwwwwwwwwwwwwwwwwwwwwwwo......',
    '........okkkkkkkkkkkkkkkkkkkkkko........',
    '...........ooooooooooooooooo............',
  ];
  const SHIP_PAL = {
    o: [36, 26, 18], w: [90, 58, 32], W: [122, 82, 48], k: [46, 31, 18], r: [160, 120, 64], m: [74, 50, 32],
    c: [200, 184, 150], C: [156, 140, 108], R: [126, 112, 86], p: [138, 42, 34], l: [60, 48, 36],
    Y: [224, 192, 112], B: [176, 138, 60], D: [110, 82, 32], S: [58, 42, 24], g: [224, 176, 80], L: [255, 208, 112],
  };
  const SW = SHIP_ART[0].length, SHH = SHIP_ART.length;
  const ship = { S: 0, dw: 0, dh: 0, r: null, g: null, b: null, a: null, lamps: [] };
  function buildShip(S) {
    const dw = SW * S, dh = SHH * S, n = dw * dh;
    const r = new Uint8Array(n), g = new Uint8Array(n), b = new Uint8Array(n), a = new Uint8Array(n), lamps = [];
    for (let j = 0; j < SHH; j++) for (let i = 0; i < SW; i++) {
      const ch = SHIP_ART[j][i], c = SHIP_PAL[ch]; if (!c) continue;
      if (ch === 'L') lamps.push([i * S, j * S]);
      for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) { const o = (j * S + yy) * dw + i * S + xx; r[o] = c[0]; g[o] = c[1]; b[o] = c[2]; a[o] = 255; }
    }
    Object.assign(ship, { S, dw, dh, r, g, b, a, lamps });
    return true;
  }
  function drawFlyover(F) {
    last.drawn = 0; last.active = false;
    if (!F.outdoor || !on('flyovers')) return;
    const id = F.map && F.map.id;
    if (!forced && !FLY.maps[id]) return;
    const f = flightAt(F.animT); if (!f) return;
    const bearing = f.b0 + f.dir * (f.u - 0.5) * FLY.sweep;
    const elev = 0.56 + 0.05 * Math.sin(f.u * Math.PI * 2 + (f.k > 0 ? f.k : 0));
    Object.assign(last, { active: true, forced: f.forced, u: f.u, bearing, elev, dir: f.dir, mapId: id });
    const { fb, mbuf, w, h, S, horizon } = F;
    const xc = projectX(F, bearing, 0.15), yc = horizon - elev * h * 0.5;
    last.x = xc; last.y = yc;
    if (xc < -w * 0.15 || xc >= w * 1.15 || yc < 0 || yc >= horizon) return;
    if (ship.S !== S && !buildShip(S)) return;
    const { dw, dh } = ship;
    const fade = Math.min(1, f.u * FLY.dur, (1 - f.u) * FLY.dur);   // ease in and out over the first and last second
    const night = nightOf(F);
    const dayM = (0.34 + 0.66 * F.skyDay) * (1 - F.wx.dark * 0.45);
    // hazed: the ship is only ever part-covered, and the weather thins it further
    const dens = 0.8 * fade * clamp(1 - F.wx.haze * 1.6, 0.15, 1);
    const x0 = Math.round(xc - dw / 2), y0 = Math.round(yc - dh / 2), flip = f.dir < 0;
    let n = 0;
    for (let y = 0; y < dh; y++) {
      const yy = y0 + y; if (yy < 0 || yy >= horizon) continue;
      for (let x = 0; x < dw; x++) {
        const xx = x0 + x; if (xx < 0 || xx >= w) continue;
        const so = y * dw + (flip ? dw - 1 - x : x), sa = ship.a[so]; if (sa < 40) continue;
        const o = yy * w + xx; if (mbuf[o] !== 1) continue;
        const al = sa / 255 * dens;
        const px = fb[o], pr = px & 255, pg = (px >> 8) & 255, pb = (px >> 16) & 255;
        fb[o] = (255 << 24) | ((pb + (ship.b[so] * dayM * 0.8 - pb) * al) << 16) | ((pg + (ship.g[so] * dayM * 0.8 - pg) * al) << 8) | (pr + (ship.r[so] * dayM * 0.8 - pr) * al);
        n++;
      }
    }
    // after dark her lanterns burn (the bow lamp blinks, as it always has)
    if (night > 0.3 && F.wx.haze < 0.3) {
      for (let li = 0; li < ship.lamps.length; li++) {
        const lp = ship.lamps[li]; if (li === 0 && (F.animT % 1.6) >= 0.25) continue;
        const lx = x0 + (flip ? dw - S - lp[0] : lp[0]), ly = y0 + lp[1];
        for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) {
          const yy = ly + dy, xx = lx + dx; if (yy < 0 || yy >= horizon || xx < 0 || xx >= w) continue;
          const o = yy * w + xx; if (mbuf[o] !== 1) continue;
          fb[o] = (255 << 24) | (70 << 16) | (180 << 8) | 255; n++;
        }
      }
    }
    last.drawn = n; stats.flyPx = n;
  }

  // ---- registration -------------------------------------------------
  // orders: stars first, then the panorama over them, then the ship over both
  if (typeof Engine !== 'undefined' && Engine.addSkyHook) {
    Engine.addSkyHook(drawStars, 10);
    Engine.addSkyHook(drawPanorama, 20);
    Engine.addSkyHook(drawFlyover, 30);
  }

  return {
    // test hooks: force a flyover starting at animation time t0 (null clears it)
    // and read what the last frame did with it
    flyover(t0, bearing0, dir) {
      if (t0 == null) { forced = null; return null; }
      forced = { start: +t0, b0: bearing0 == null ? 0 : +bearing0, dir: dir < 0 ? -1 : 1 };
      return Object.assign({}, forced);
    },
    flightAt,
    ship: { art: SHIP_ART, pal: SHIP_PAL },   // Phase 21 (js/light21.js draws her on the 3D renderer's sky dome)
    state() { return Object.assign({}, last); },
    panorama,
    hooks: { stars: drawStars, panoramas: drawPanorama, flyovers: drawFlyover },   // so a test can time each on its own
    stats,
    FLY,
    NSTAR,
    PN,
  };
})();
