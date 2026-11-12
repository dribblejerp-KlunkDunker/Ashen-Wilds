// ============================================================
//  cinema14 — Phase 14 (a world that shows the story), the CINEMA team: the owner's approved "level 2" look as a preset.
//
//  The owner approved a prototype (reference-mock.js, level 2) that did everything in several slow full-resolution float
//  passes. Here the same look is one post hook (order 95: after post.js's grade at 40 and the sparks at 45, before the
//  camera feel at 100 and Dread at 110), built so the expensive parts run small:
//    - bloom on EMISSIVE pixels only (Engine.MAT.glow: lamps, fire, Light-glass, emissive sprite pixels; weighted as
//      post.js weighs lamps) and the brightest sky (the sun's disc), through a downsample chain: boxed into a quarter of
//      the logical view, down to an eighth, each blurred (5-tap), the eighth added back up as a wide halo. Pale walls,
//      sunlit ground and hazed distance never bloom, so Light-glass is what glows. In the Cinematic preset post.js bloom
//      is off (js/presets.js CINEMA_OFF): this replaces it rather than doubling it.          switch "Cinematic light"
//    - god rays: a radial gather of bright light / sky toward the brightest light, on an 80x38 grid (a quarter of the
//      logical view, at any render scale), 12 samples per cell.                                switch "Cinematic light"
//    - ground fog: a low band hugging the floor below the horizon, thicker with distance, modulated by two octaves of a
//      tiling noise baked once at load; it drifts slowly.                                     switch "Ground fog"
//      Indoors the same switch adds the prototype's depth haze toward a warm black. Outdoors the engine's own sky-matched
//      haze (FAR team, far mode at view distance above 1.4: F.far) is the aerial perspective, so this module adds none
//      there; outdoors without far mode (a Custom mix at a short view distance) it adds the prototype's haze itself.
//    - grade: saturation 1.12 and contrast 1.08, then a vignette (0.35 at the corners).        switch "Cinematic grade"
//  Fog, haze and the light add are ONE full-resolution loop; everything smooth (fog noise, haze and fog weights, the
//  upsampled light) is worked out once per LOGICAL pixel and shared by the render pixels inside it, and rows with nothing
//  to add are skipped.
//  The GRADE AND VIGNETTE run on the compositor where the browser has backdrop-filter (every current one): an overlay that
//  covers exactly the 3D view (not the HUD) with backdrop-filter saturate + contrast and a radial-gradient vignette. Done in
//  JavaScript they touch every pixel and alone cost about 1.5 ms a frame at 2x on the build server (measured: hook alone,
//  clearing at dusk), which with light and fog breaks the 2.5 ms budget; the game already grades #view with a CSS filter
//  (#view.unwrite). Without backdrop-filter, or with CINEMA14.T.gradeOnCanvas set, the same grade and vignette are folded
//  into the full-resolution loop instead (the code below; tests run it too).
//
//  The three switches are GFX flags (cineLight, cineFog, cineGrade) that only the Cinematic preset turns on
//  (js/presets.js CINEMA_ONLY): Original / Low / Medium / High / Ultra frames are byte-identical to a page without this
//  file. The owner rejected blur and heavy particles: there is no depth of field, no tilt-shift and no particles here.
//
//  Accessibility: No flashes = the rays hold still (no shimmer) and bloom is halved; Reduce motion = the fog noise is
//  frozen; High contrast (html.ac-hc) = no grade and no vignette; colour-blind palettes are not read or touched.
//  Settings: localStorage 'octave.cinema14.v1' remembers the Cinematic preset and the three switches between sessions.
//  Procedural stand-in: the fog noise is generated here; nothing is loaded. Nothing here touches saves or Math.random.
// ============================================================
'use strict';

for (const k of ['cineLight', 'cineFog', 'cineGrade']) {
  if (typeof GFX === 'undefined') break;
  if (GFX[k] === undefined) GFX[k] = false;   // the boot preset (medium) has them off; presets.js turns them on in Cinematic
  if (!GFX.FX.includes(k)) GFX.FX.push(k);
}

const CINEMA14 = (() => {
  const KEY = 'octave.cinema14.v1';
  const FLAGS = ['cineLight', 'cineFog', 'cineGrade'];
  // Tunables. The values follow the owner's prototype (reference-mock.js, level 2), retuned for the cheaper passes.
  const T = {
    aerial: { reach: 1.2, pow: 1.6, out: 0.75, inn: 0.45, inCol: [8, 6, 10] },
    fog: { a: 0.32, near: 1.5, band: 5, above: 0.05, distK: 0.9, inCol: [70, 62, 58], outAdd: [20, 20, 24], outMul: 0.9, drift1: 1.2, drift2: -0.72 },
    bloom: { lampLuma: 150, lampSat: 40, lampK: 9, sunLuma: 225, gain: 2.2, halo: 0.6, noFlashK: 0.5, cap: 96 },
    rays: { luma: 150, glow: 0.12, steps: 12, decay: 0.865, reach: 0.9, str: 0.55, shimmer: 0.08 },
    grade: { sat: 1.12, con: 1.08, vig: 0.35, vigPow: 1.1 },
    gradeOnCanvas: false,   // true: grade in JavaScript even where the compositor could do it (tests, comparisons)
  };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const on = (k) => typeof GFX !== 'undefined' && GFX[k] === true;
  const highContrast = () => typeof document !== 'undefined' && !!document.documentElement && document.documentElement.classList.contains('ac-hc');
  const stats = { profile: false, ms: 0, frames: 0, last: null, ph: { light: 0, final: 0 } };
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // ---- tiling fog noise: two octaves of smooth value noise, each periodic, baked once (procedural stand-in) ------------
  // Octave 1 cells are 24x10 logical pixels, octave 2 cells 9x5, as in the prototype; each is its own texture so the two
  // can drift at their own speeds with one lookup each.
  function bakeNoise(cw, ch, cellsX, cellsY, seed) {
    const W = cw * cellsX, H = ch * cellsY, g = new Float32Array(cellsX * cellsY), out = new Float32Array(W * H);
    let s = seed >>> 0;
    for (let i = 0; i < g.length; i++) { s = (Math.imul(s, 1103515245) + 12345) >>> 0; g[i] = (s >>> 8) / 16777216; }
    for (let y = 0; y < H; y++) {
      const fy = y / ch, yi = fy | 0, v0 = fy - yi, v = v0 * v0 * (3 - 2 * v0), y0 = yi % cellsY, y1 = (yi + 1) % cellsY;
      for (let x = 0; x < W; x++) {
        const fx = x / cw, xi = fx | 0, u0 = fx - xi, u = u0 * u0 * (3 - 2 * u0), x0 = xi % cellsX, x1 = (xi + 1) % cellsX;
        const a = g[y0 * cellsX + x0], b = g[y0 * cellsX + x1], c = g[y1 * cellsX + x0], d = g[y1 * cellsX + x1];
        out[y * W + x] = a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
      }
    }
    return { W, H, data: out };
  }
  const N1 = bakeNoise(24, 10, 16, 8, 419), N2 = bakeNoise(9, 5, 32, 16, 528);   // 384x80 and 288x80, tiling
  // the two octaves as bytes, pre-weighted 0.7 and 0.3, so their sum is 0..255
  const N1q = new Uint8Array(N1.data.length), N2q = new Uint8Array(N2.data.length);
  for (let i = 0; i < N1q.length; i++) N1q[i] = Math.round(N1.data[i] * 0.7 * 255);
  for (let i = 0; i < N2q.length; i++) N2q[i] = Math.round(N2.data[i] * 0.3 * 255);

  // ---- buffers, rebuilt only when the render size changes --------------------------------------------------------------
  // The light chain works on the LOGICAL view (320x150), whatever the render scale: the bright pass reads one render pixel
  // per logical pixel and boxes it into a quarter-size grid (80x38: the bloom base and the god-ray grid); the bloom's wide
  // halo comes from an eighth (40x19). So the light chain costs the same at 1x and 2x; only the final loop runs at full
  // resolution, and it reads the light bilinearly from the quarter grid.
  let FW = 0, FH = 0, FS = 1, LW = 0, LH = 0;
  let w2 = 0, h2 = 0, w3 = 0, h3 = 0;
  let b2 = null, b3 = null, rS = null, rO = null, rowV = null;   // RGB interleaved Float32
  let span0 = null, span1 = null, litA = 0, litB = 0;   // per quarter-grid row: first and last cell with light; the lit logical span now in LR/LG/LB
  let ux0 = null, ux1 = null, uxf = null, uy0 = null, uy1 = null, uyf = null;   // all per logical pixel
  let n1x = null, n2x = null, fogN = null, LR = null, LG = null, LB = null;
  let vigRow = null, vigCol = null;
  const VIG_N = 1024, vigLut = new Int32Array(VIG_N + 4);
  function ensure(w, h, S) {
    if (w === FW && h === FH && S === FS) return;
    FW = w; FH = h; FS = S;
    const lw = LW = Math.ceil(w / S), lh = LH = Math.ceil(h / S);
    w2 = Math.ceil(lw / 4); h2 = Math.ceil(lh / 4); w3 = Math.ceil(w2 / 2); h3 = Math.ceil(h2 / 2);
    b2 = new Float32Array(w2 * h2 * 3); b3 = new Float32Array(w3 * h3 * 3);
    rS = new Float32Array(w2 * h2 * 3); rO = new Float32Array(w2 * h2 * 3);
    span0 = new Int32Array(h2); span1 = new Int32Array(h2); rowV = new Float32Array(w2 * 3);
    // per logical pixel: bilinear tables from the quarter grid (4 logical pixels per cell), fog noise columns, the light add
    ux0 = new Int32Array(lw); ux1 = new Int32Array(lw); uxf = new Float32Array(lw); uy0 = new Int32Array(lh); uy1 = new Int32Array(lh); uyf = new Float32Array(lh);
    for (let x = 0; x < lw; x++) { const u = (x + 0.5) / 4 - 0.5, i = Math.floor(u); ux0[x] = clamp(i, 0, w2 - 1); ux1[x] = clamp(i + 1, 0, w2 - 1); uxf[x] = u - i; }
    for (let y = 0; y < lh; y++) { const u = (y + 0.5) / 4 - 0.5, i = Math.floor(u); uy0[y] = clamp(i, 0, h2 - 1); uy1[y] = clamp(i + 1, 0, h2 - 1); uyf[y] = u - i; }
    n1x = new Int32Array(lw); n2x = new Int32Array(lw);
    fogN = new Int32Array(lw); LR = new Int32Array(lw); LG = new Int32Array(lw); LB = new Int32Array(lw);
    RM = new Int32Array(lw); RCR = new Int32Array(lw); RCG = new Int32Array(lw); RCB = new Int32Array(lw);
    // vignette: the squared distance from the centre over the squared half-diagonal, split into a row part and a column
    // part that add up to a table index (0 .. VIG_N - 1)
    vigRow = new Int32Array(h); vigCol = new Int32Array(w);
    const cx = w / 2, cy = h / 2, r2 = cx * cx + cy * cy, M = VIG_N - 1;
    for (let x = 0; x < w; x++) vigCol[x] = Math.floor((x + 0.5 - cx) * (x + 0.5 - cx) / r2 * M);
    for (let y = 0; y < h; y++) vigRow[y] = Math.floor((y + 0.5 - cy) * (y + 0.5 - cy) / r2 * M);
  }
  // vignette weights in 1/256: the prototype's 1 - (distance / half-diagonal)^2.2 * 0.35, i.e. 1 - q^1.1 * 0.35 for q the
  // squared ratio
  let vigKey = '';
  function buildVig() {
    const g = T.grade, key = g.vig + '|' + g.vigPow;
    if (key === vigKey) return;
    vigKey = key;
    for (let i = 0; i < vigLut.length; i++) vigLut[i] = Math.round(256 * (1 - g.vig * Math.pow(Math.min(1, i / (VIG_N - 1)), g.vigPow)));
  }
  // final clamp to 0..255 by table (cheaper than three pairs of compares per pixel); the index is offset by CL_OFF
  const CL_OFF = 1024, clampT = new Uint8Array(3072);
  for (let i = 0; i < clampT.length; i++) clampT[i] = clamp(i - CL_OFF, 0, 255);
  const AER_N = 512; const aerLut = new Int32Array(AER_N); let aerKey = '';
  function buildAer(aK) {
    const key = T.aerial.pow + '|' + aK;
    if (key === aerKey) return;
    aerKey = key;
    for (let i = 0; i < AER_N; i++) { const k = Math.round(256 * aK * Math.pow(i / (AER_N - 1), T.aerial.pow)); aerLut[i] = k < 3 ? 0 : k; }   // under 1%: nothing to see, skip it
  }

  // ---- the sky colour just above the horizon (or the fog colour when there is no sky in view) -------------------------
  const skyCol = [0, 0, 0];
  function skyColour(F) {
    const { w, h, mbuf, fb, horizon } = F; let r = 0, g = 0, b = 0, c = 0;
    const S = F.S || 1, y0 = clamp((horizon | 0) - 6 * S, 0, h - 1);
    for (let y = Math.max(0, y0 - 8 * S); y <= y0; y += S) for (let x = 0, o = y * w; x < w; x += 2 * S) if (mbuf[o + x] === 1) { const p = fb[o + x]; r += p & 255; g += (p >> 8) & 255; b += (p >> 16) & 255; c++; }
    if (c) { skyCol[0] = r / c; skyCol[1] = g / c; skyCol[2] = b / c; } else { skyCol[0] = F.fogR; skyCol[1] = F.fogG; skyCol[2] = F.fogB; }
    return skyCol;
  }

  // ---- light: bright pass (one sample per logical pixel) into two sources: bloom (emissive + sun) and rays -----------
  const best = { x: 0, y: 0, v: 0 };
  let lastShimmer = 1, lastBloomK = 0, lastFogShift = 0;
  function brightPass(F, S) {
    const fb = F.fb, mbuf = F.mbuf, w = F.w, h = F.h, cb = T.bloom, cr = T.rays;
    b2.fill(0); rS.fill(0);
    // An emissive pixel (Engine.MAT.glow: lamps, fire, Light-glass) is a light when it is bright AND coloured, judged as
    // post.js judges lamps: the engine dims sprites by the hour, so luma and saturation are read against that dimming and
    // a night-time lantern still glows its own orange, while pale cloth and skin do not. Small lamps are lifted (lampK)
    // so a few pixels still read after the blur. The sky gives light only where it is near white (the sun's disc).
    // Nothing else blooms: pale walls, lit ground and hazed distance never do, so Light-glass is what glows.
    const out = !!F.outdoor, lk = out ? 0.3 + 0.7 * clamp(F.light == null ? 1 : F.light, 0.1, 1) : 1, ilk = 1 / lk;
    const sprK = out ? 1 - 0.5 * clamp(F.skyDay == null ? 0 : F.skyDay, 0, 1) : 1;
    const lampL = cb.lampLuma, lampS = cb.lampSat, lowL = lampL * lk, lampW = sprK * ilk * cb.lampK / (255 - lampL);
    const sunL = cb.sunLuma, ss = 1 / (255 - sunL), rayL = cr.luma, rs = 1 / (255 - rayL), rg = cr.glow;
    let any = false;
    for (let y = 0, ly = 0; y < h; y += S, ly++) {
      const o = y * w, r2 = (ly >> 2) * w2;
      for (let x = 0, lx = 0; x < w; x += S, lx++) {
        const m = mbuf[o + x];
        if (m !== 8 && m !== 1) continue;
        const p = fb[o + x], r = p & 255, g = (p >> 8) & 255, b = (p >> 16) & 255;
        const l = (r * 77 + g * 150 + b * 29) >> 8, j = (r2 + (lx >> 2)) * 3;
        if (m === 8) {
          if (l < lowL) continue;
          const mx = r > g ? (r > b ? r : b) : (g > b ? g : b), mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
          const ln = l * ilk, sat = (mx - mn) * ilk - lampS;
          if (ln < lampL || sat <= 0) continue;
          const k = (ln - lampL) * lampW * (sat > 80 ? 1 : sat / 80);
          b2[j] += r * k; b2[j + 1] += g * k; b2[j + 2] += b * k; any = true;
          const kr = k * rg; rS[j] += r * kr; rS[j + 1] += g * kr; rS[j + 2] += b * kr;
        } else {
          if (l <= rayL) continue;
          if (l > sunL) { const k = (l - sunL) * ss; b2[j] += r * k; b2[j + 1] += g * k; b2[j + 2] += b * k; any = true; }
          const kr = (l - rayL) * rs * 0.6; rS[j] += r * kr; rS[j + 1] += g * kr; rS[j + 2] += b * kr;
        }
      }
    }
    // box: a cell is 4x4 logical pixels
    best.v = 0;
    for (let i = 0, c = 0; c < w2 * h2; c++, i += 3) {
      if (b2[i] + b2[i + 1] + b2[i + 2] !== 0) { b2[i] *= 0.0625; b2[i + 1] *= 0.0625; b2[i + 2] *= 0.0625; }
      if (rS[i] + rS[i + 1] + rS[i + 2] === 0) continue;
      rS[i] *= 0.0625; rS[i + 1] *= 0.0625; rS[i + 2] *= 0.0625;
      const v = rS[i] + rS[i + 1] + rS[i + 2];
      if (v > best.v) { best.v = v; best.x = c % w2; best.y = (c / w2) | 0; }
    }
    return any;
  }
  function down(src, sw, sh, dst, dw, dh) {
    for (let y = 0; y < dh; y++) {
      const ya = Math.min(sh - 1, y * 2), yb = Math.min(sh - 1, y * 2 + 1);
      for (let x = 0; x < dw; x++) {
        const xa = Math.min(sw - 1, x * 2), xb = Math.min(sw - 1, x * 2 + 1), o = (y * dw + x) * 3;
        const i00 = (ya * sw + xa) * 3, i10 = (ya * sw + xb) * 3, i01 = (yb * sw + xa) * 3, i11 = (yb * sw + xb) * 3;
        dst[o] = (src[i00] + src[i10] + src[i01] + src[i11]) * 0.25;
        dst[o + 1] = (src[i00 + 1] + src[i10 + 1] + src[i01 + 1] + src[i11 + 1]) * 0.25;
        dst[o + 2] = (src[i00 + 2] + src[i10 + 2] + src[i01 + 2] + src[i11 + 2]) * 0.25;
      }
    }
  }
  // 5-tap binomial blur (1 4 6 4 1)/16 in place, separable, through a scratch buffer: on the quarter grid it spreads a lamp
  // over about 20 logical pixels with a round falloff (a 3-tap tent left single hot cells looking square)
  let tScr = new Float32Array(0);
  function blur5(buf, bw, bh) {
    if (tScr.length < buf.length) tScr = new Float32Array(buf.length);
    const t = tScr, xm = bw - 1, ym = bh - 1;
    for (let y = 0; y < bh; y++) {
      const row = y * bw;
      for (let x = 0; x < bw; x++) {
        const a = (row + (x > 1 ? x - 2 : 0)) * 3, b = (row + (x > 0 ? x - 1 : 0)) * 3, o = (row + x) * 3, c = (row + (x < xm ? x + 1 : xm)) * 3, d = (row + (x < xm - 1 ? x + 2 : xm)) * 3;
        t[o] = (buf[a] + 4 * buf[b] + 6 * buf[o] + 4 * buf[c] + buf[d]) * 0.0625;
        t[o + 1] = (buf[a + 1] + 4 * buf[b + 1] + 6 * buf[o + 1] + 4 * buf[c + 1] + buf[d + 1]) * 0.0625;
        t[o + 2] = (buf[a + 2] + 4 * buf[b + 2] + 6 * buf[o + 2] + 4 * buf[c + 2] + buf[d + 2]) * 0.0625;
      }
    }
    for (let y = 0; y < bh; y++) {
      const ra = (y > 1 ? y - 2 : 0) * bw, rb = (y > 0 ? y - 1 : 0) * bw, ro = y * bw, rc = (y < ym ? y + 1 : ym) * bw, rd = (y < ym - 1 ? y + 2 : ym) * bw;
      for (let x = 0; x < bw; x++) {
        const a = (ra + x) * 3, b = (rb + x) * 3, o = (ro + x) * 3, c = (rc + x) * 3, d = (rd + x) * 3;
        buf[o] = (t[a] + 4 * t[b] + 6 * t[o] + 4 * t[c] + t[d]) * 0.0625;
        buf[o + 1] = (t[a + 1] + 4 * t[b + 1] + 6 * t[o + 1] + 4 * t[c + 1] + t[d + 1]) * 0.0625;
        buf[o + 2] = (t[a + 2] + 4 * t[b + 2] + 6 * t[o + 2] + 4 * t[c + 2] + t[d + 2]) * 0.0625;
      }
    }
  }
  // bilinear upsample-add of a coarse buffer (cw x ch) into a finer one (fw x fh), scaled by k. The index and weight tables
  // for each size pair are built once.
  const upTabs = {};
  function upTab(cn, fn) {
    const key = cn + '>' + fn;
    let t = upTabs[key]; if (t) return t;
    const a = new Int32Array(fn), b = new Int32Array(fn), f = new Float32Array(fn), sc = cn / fn;
    for (let i = 0; i < fn; i++) { const u = (i + 0.5) * sc - 0.5, j = Math.floor(u); a[i] = clamp(j, 0, cn - 1); b[i] = clamp(j + 1, 0, cn - 1); f[i] = u - j; }
    t = upTabs[key] = { a, b, f }; return t;
  }
  let upRow = new Float32Array(0);
  function upAdd(src, cw, ch, dst, fw, fh, k) {
    const X = upTab(cw, fw), Y = upTab(ch, fh), xa = X.a, xb = X.b, xf = X.f;
    if (upRow.length < cw * 3) upRow = new Float32Array(cw * 3);
    const t = upRow;
    for (let y = 0; y < fh; y++) {
      // separable: blend the two source rows once, then each destination cell blends two neighbours of that row
      const fy = Y.f[y], ra = Y.a[y] * cw * 3, rb = Y.b[y] * cw * 3, ky0 = (1 - fy) * k, ky1 = fy * k;
      let nz = 0;
      for (let q = 0; q < cw * 3; q++) { const v = src[ra + q] * ky0 + src[rb + q] * ky1; t[q] = v; if (v !== 0) nz = 1; }
      if (!nz) continue;   // nothing to add on this row
      let o = y * fw * 3;
      for (let x = 0; x < fw; x++, o += 3) {
        const fx = xf[x], gx = 1 - fx, i = xa[x] * 3, j = xb[x] * 3;
        dst[o] += t[i] * gx + t[j] * fx; dst[o + 1] += t[i + 1] * gx + t[j + 1] * fx; dst[o + 2] += t[i + 2] * gx + t[j + 2] * fx;
      }
    }
  }
  // god rays on the 80x38 grid: every cell walks 12 steps toward the brightest cell, gathering decaying light
  function rays(at, noFlash) {
    const c = T.rays;
    if (best.v < 1) return false;
    const bx = best.x + 0.5, by = best.y + 0.5, steps = c.steps, decay = c.decay, reach = c.reach / steps;
    // a slow, gentle breathing of the shafts (dust in the light); No flashes holds them still
    const sh = noFlash ? 1 : 1 + c.shimmer * Math.sin(at * 1.1) * Math.sin(at * 0.43 + 1.1);
    lastShimmer = sh;
    const str = c.str * sh / steps * 2;
    for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
      const dx = (bx - (x + 0.5)) * reach, dy = (by - (y + 0.5)) * reach;
      let sx = x + 0.5, sy = y + 0.5, wt = 1, r = 0, g = 0, b = 0;
      for (let s = 0; s < steps; s++) {
        sx += dx; sy += dy;
        const j = ((sy | 0) * w2 + (sx | 0)) * 3;   // the walk heads inward to a cell on the grid, so it never leaves it
        r += rS[j] * wt; g += rS[j + 1] * wt; b += rS[j + 2] * wt; wt *= decay;
      }
      const o = (y * w2 + x) * 3; rO[o] = r * str; rO[o + 1] = g * str; rO[o + 2] = b * str;
    }
    return true;
  }

  // ---- the final loop, one render row at a time ---------------------------------------------------------------------
  // Haze, fog and light are smooth, so they are worked out once per LOGICAL pixel (one depth read per logical pixel) and
  // folded into one affine step per channel: shown = (x * M + C) >> 8, where M (1/256) is what is left of the pixel after
  // haze and fog, and C holds the haze and fog colours times their weights, the light add and the rounding. Sky pixels
  // (Engine.MAT.sky) take only the light: haze and fog never touch the sky.
  let RM = null, RCR = null, RCG = null, RCB = null;   // per logical pixel of the current logical row
  const K = { gA: 0, gB: 0, gC: 0 };
  // the weights for one logical row: one depth read per logical pixel (its top-left render pixel)
  const P = { aScale: 0, fDist: 0, fNear: 0, aR: 0, aG: 0, aB: 0, fR: 0, fG: 0, fB: 0 };
  function prepDepth(dbuf, dro, S, doAer, doFog) {
    const AM = AER_N - 1, al = aerLut, fn = fogN, aS = P.aScale, fD = P.fDist, fN = P.fNear, aR = P.aR, aG = P.aG, aB = P.aB, fR = P.fR, fG = P.fG, fB = P.fB;
    const M_ = RM, cr = RCR, cg = RCG, cb = RCB, lr = LR, lg = LG, lb = LB, n = LW;
    for (let lx = 0, j = dro; lx < n; lx++, j += S) {
      const d = dbuf[j];
      let ka = 0, kf = 0;
      if (d < 1e8) {   // the sky (Engine.MAT.sky) is exactly the pixels at 1e9
        if (doAer) { let ai = (d * aS) | 0; if (ai > AM) ai = AM; ka = al[ai]; }
        if (doFog && d >= fN) { let dk = (d * fD) | 0; if (dk > 256) dk = 256; kf = (fn[lx] * dk) >> 8; }
      }
      // x -> x + (a - x) ka, then -> x + (f - x) kf: x (1 - ka)(1 - kf) + a ka (1 - kf) + f kf
      const ra = 256 - kf, wa = (ka * ra) >> 8;
      M_[lx] = ((256 - ka) * ra) >> 8;
      cr[lx] = aR * wa + fR * kf + (lr[lx] << 8) + 128; cg[lx] = aG * wa + fG * kf + (lg[lx] << 8) + 128; cb[lx] = aB * wa + fB * kf + (lb[lx] << 8) + 128;
    }
  }
  // grade on, a row with haze or fog: every pixel
  function gradeDepthRow(fb, mb, o, w, sh, vy) {
    const gA = K.gA, gB = K.gB, gC = K.gC, vc = vigCol, vl = vigLut, ct = clampT, M_ = RM, cr = RCR, cg = RCG, cb = RCB, lr = LR, lg = LG, lb = LB;
    for (let x = 0; x < w; x++) {
      const i = o + x, p = fb[i], lx = x >> sh;
      let r = p & 255, g = (p >> 8) & 255, b = (p >> 16) & 255;
      if (mb[i] !== 1) { const m = M_[lx]; r = (r * m + cr[lx]) >> 8; g = (g * m + cg[lx]) >> 8; b = (b * m + cb[lx]) >> 8; }
      else { r += lr[lx]; g += lg[lx]; b += lb[lx]; }
      // saturation and contrast in one: c * (l + (x - l) * s - 128) + 128 = x * gA + l * gB + gC (in 1/256), with the
      // vignette's v (1/256) folded into the same products
      const v = vl[vy + vc[x]], av = gA * v, L = (gB * ((r * 77 + g * 150 + b * 29) >> 8) + gC) * v;
      fb[i] = (p & -16777216) | (ct[((av * b + L) >> 16) + CL_OFF] << 16) | (ct[((av * g + L) >> 16) + CL_OFF] << 8) | ct[((av * r + L) >> 16) + CL_OFF];
    }
  }
  // grade on, no haze or fog on this row (most of the frame): kept apart and branch-free so it compiles tight
  function gradeOnly(fb, o, w, sh, vy, rowLit) {
    const gA = K.gA, gB = K.gB, gC = K.gC, vc = vigCol, vl = vigLut, ct = clampT;
    if (!rowLit) {
      for (let x = 0; x < w; x++) {
        const i = o + x, p = fb[i], r = p & 255, g = (p >> 8) & 255, b = (p >> 16) & 255;
        const v = vl[vy + vc[x]], av = gA * v, L = (gB * ((r * 77 + g * 150 + b * 29) >> 8) + gC) * v;
        fb[i] = (p & -16777216) | (ct[((av * b + L) >> 16) + CL_OFF] << 16) | (ct[((av * g + L) >> 16) + CL_OFF] << 8) | ct[((av * r + L) >> 16) + CL_OFF];
      }
      return;
    }
    const lr = LR, lg = LG, lb = LB;
    for (let x = 0; x < w; x++) {
      const i = o + x, p = fb[i], lx = x >> sh, r = (p & 255) + lr[lx], g = ((p >> 8) & 255) + lg[lx], b = ((p >> 16) & 255) + lb[lx];
      const v = vl[vy + vc[x]], av = gA * v, L = (gB * ((r * 77 + g * 150 + b * 29) >> 8) + gC) * v;
      fb[i] = (p & -16777216) | (ct[((av * b + L) >> 16) + CL_OFF] << 16) | (ct[((av * g + L) >> 16) + CL_OFF] << 8) | ct[((av * r + L) >> 16) + CL_OFF];
    }
  }
  // grade off, a row with haze or fog, at 2x: the two render pixels of each logical pixel share its M and C
  function depthRow2(fb, mb, o, w) {
    const M_ = RM, cr = RCR, cg = RCG, cb = RCB, lr = LR, lg = LG, lb = LB, ct = clampT;
    for (let x = 0, lx = 0; x < w; x += 2, lx++) {
      const m = M_[lx], c1 = cr[lx], c2 = cg[lx], c3 = cb[lx];
      if (m === 256 && c1 === 128 && c2 === 128 && c3 === 128) continue;   // nothing here (near, unlit): leave it
      for (let i = o + x, e = i + 2; i < e; i++) {
        const p = fb[i];
        let r = p & 255, g = (p >> 8) & 255, b = (p >> 16) & 255;
        if (mb[i] !== 1) { r = (r * m + c1) >> 8; g = (g * m + c2) >> 8; b = (b * m + c3) >> 8; }
        else { r += lr[lx]; g += lg[lx]; b += lb[lx]; }
        fb[i] = (p & -16777216) | (ct[b + CL_OFF] << 16) | (ct[g + CL_OFF] << 8) | ct[r + CL_OFF];
      }
    }
  }
  // grade off, a row with haze or fog
  function depthRow(fb, mb, o, w, sh) {
    const M_ = RM, cr = RCR, cg = RCG, cb = RCB, lr = LR, lg = LG, lb = LB, ct = clampT;
    for (let x = 0; x < w; x++) {
      const i = o + x, lx = x >> sh, m = M_[lx];
      if (m === 256 && cr[lx] === 128 && cg[lx] === 128 && cb[lx] === 128) continue;
      const p = fb[i];
      let r = p & 255, g = (p >> 8) & 255, b = (p >> 16) & 255;
      if (mb[i] !== 1) { r = (r * m + cr[lx]) >> 8; g = (g * m + cg[lx]) >> 8; b = (b * m + cb[lx]) >> 8; }
      else { r += lr[lx]; g += lg[lx]; b += lb[lx]; }
      fb[i] = (p & -16777216) | (ct[b + CL_OFF] << 16) | (ct[g + CL_OFF] << 8) | ct[r + CL_OFF];
    }
  }
  // grade off, light only: just the lit span
  function litRow(fb, o, x0, x1, sh) {
    const lr = LR, lg = LG, lb = LB;
    for (let x = x0; x < x1; x++) {
      const i = o + x, p = fb[i], lx = x >> sh, a = lr[lx], c = lg[lx], e = lb[lx];
      if ((a | c | e) === 0) continue;
      let r = (p & 255) + a, g = ((p >> 8) & 255) + c, b = ((p >> 16) & 255) + e;
      if (r > 255) r = 255; if (g > 255) g = 255; if (b > 255) b = 255;
      fb[i] = (p & -16777216) | (b << 16) | (g << 8) | r;
    }
  }

  // ---- the hook ------------------------------------------------------------------------------------------------------
  function hook(F) {
    const doLight = on('cineLight'), doFogF = on('cineFog'), doGrade = on('cineGrade') && !highContrast() && gradeMode() === 'canvas';
    if (!doLight && !doFogF && !doGrade) return;
    if (!F.fb || !F.dbuf || !F.mbuf) return;
    const t0 = stats.profile ? now() : 0;
    const { fb, dbuf, mbuf, w, h } = F, S = F.S || 1;
    const noFlash = !!(typeof GFX !== 'undefined' && GFX.noFlash), still = !!(typeof GFX !== 'undefined' && GFX.reduceMotion);
    ensure(w, h, S);
    // a lightning flash already lifts the frame: light gives way to it, as post.js bloom does
    const flash = F.wx ? F.wx.flash || 0 : 0, fk = clamp(1 - flash * 1.6, 0, 1);

    // 1. light, all on the small buffers. Bloom: the quarter grid boxed down to the eighth, both blurred, the eighth added
    //    back up (a soft core and a wide halo). The rays live on the quarter grid and join it there.
    let lit = false, actN = 0;
    lastBloomK = 0;
    if (doLight && fk > 0.02) {
      const any = brightPass(F, S);
      const hasRays = rays(F.animT || 0, noFlash);
      if (any || hasRays) {
        const bk = T.bloom.gain * fk * (noFlash ? T.bloom.noFlashK : 1), n2 = w2 * h2 * 3; lastBloomK = bk;
        if (any) {
          down(b2, w2, h2, b3, w3, h3);
          blur5(b3, w3, h3); blur5(b2, w2, h2);
          upAdd(b3, w3, h3, b2, w2, h2, T.bloom.halo);
          if (hasRays) for (let i = 0; i < n2; i++) b2[i] = b2[i] * bk + rO[i] * fk; else for (let i = 0; i < n2; i++) b2[i] *= bk;
        } else for (let i = 0; i < n2; i++) b2[i] = rO[i] * fk;
        // clip, and note per row the first and last cell that adds about half a level or more
        const cap = T.bloom.cap;
        for (let y = 0, c = 0; y < h2; y++) {
          let s0 = w2, s1 = -1;
          for (let x = 0; x < w2; x++, c++) {
            const i = c * 3;
            if (b2[i] > cap) b2[i] = cap; if (b2[i + 1] > cap) b2[i + 1] = cap; if (b2[i + 2] > cap) b2[i + 2] = cap;
            if (b2[i] + b2[i + 1] + b2[i + 2] > 1.5) { if (s0 === w2) s0 = x; s1 = x; actN++; }
          }
          span0[y] = s0; span1[y] = s1; if (s1 >= 0) lit = true;
        }
      }
    }
    const t1 = stats.profile ? now() : 0;
    if (stats.profile) stats.ph.light += t1 - t0;

    // 2. haze, fog and grade constants
    const out = !!F.outdoor, far = F.far === true, base = F.fogDist || 12;
    const doAer = doFogF && !(out && far);   // outdoors in far mode the engine's haze is the aerial perspective
    const doFog = doFogF;
    const A = T.aerial, Fo = T.fog;
    let aR = 0, aG = 0, aB = 0, aScale = 0, fR = 0, fG = 0, fB = 0, fDist = 0, fNear = 0;
    if (doFogF) {
      const sky = skyColour(F);
      buildAer(out ? A.out : A.inn);
      aR = (out ? sky[0] : A.inCol[0]) | 0; aG = (out ? sky[1] : A.inCol[1]) | 0; aB = (out ? sky[2] : A.inCol[2]) | 0;
      aScale = (AER_N - 1) / (base * A.reach);
      fR = (out ? sky[0] * Fo.outMul + Fo.outAdd[0] : Fo.inCol[0]) | 0; fG = (out ? sky[1] * Fo.outMul + Fo.outAdd[1] : Fo.inCol[1]) | 0; fB = (out ? sky[2] * Fo.outMul + Fo.outAdd[2] : Fo.inCol[2]) | 0;
      fDist = 256 / (base * Fo.distK); fNear = Fo.near;
      const tt = still ? 0 : (F.animT || 0);
      const o1 = Math.round(tt * Fo.drift1), o2 = Math.round(tt * Fo.drift2); lastFogShift = o1 * 1000 + o2;
      for (let lx = 0; lx < LW; lx++) { n1x[lx] = (((lx + o1) % N1.W) + N1.W) % N1.W; n2x[lx] = (((lx + o2) % N2.W) + N2.W) % N2.W; }
    }
    if (doGrade) {
      const g = T.grade; buildVig();
      K.gA = Math.round(g.con * g.sat * 256); K.gB = Math.round(g.con * (1 - g.sat) * 256); K.gC = Math.round((128 - 128 * g.con) * 256);
    }

    // 3. the one full-resolution loop. Everything smooth (fog noise, haze and fog weights, the light add) is worked out
    //    once per LOGICAL pixel per logical row; each render pixel then only does its own affine step, grade and vignette.
    //    With the grade off, rows with nothing to add are not touched at all.
    const horizon = F.horizon, sh = S === 2 ? 1 : 0;
    for (let ly = 0; ly < LH; ly++) {
      // fog: whether this logical row holds the band, and its strength times the noise, per logical column
      let rowFog = 0;
      if (doFog) {
        const below = ((ly + 0.5) * S - horizon) / h;
        if (below >= -Fo.above) rowFog = Math.round(256 * Fo.a * Math.max(0, 1 - Math.abs(below) * Fo.band));
        if (rowFog > 0) { const n1r = (ly % N1.H) * N1.W, n2r = (ly % N2.H) * N2.W; for (let lx = 0; lx < LW; lx++) fogN[lx] = (rowFog * (N1q[n1r + n1x[lx]] + N2q[n2r + n2x[lx]])) >> 8; }
      }
      // light: bilinear from the quarter grid at each logical pixel's centre, only across the span of cells that hold any.
      // LR/LG/LB are zero outside [litA, litB): the last span is cleared before a new one is written.
      let rowLit = false;
      if (lit) {
        const ya = uy0[ly], yb = uy1[ly];
        let c0 = Math.min(span0[ya], span0[yb]), c1 = Math.max(span1[ya], span1[yb]);
        if (litB > litA) { LR.fill(0, litA, litB); LG.fill(0, litA, litB); LB.fill(0, litA, litB); litA = litB = 0; }
        if (c1 >= c0) {
          rowLit = true;
          // the two grid rows blended once over the span (and one cell either side), then each logical pixel that reads a
          // lit cell blends its two cells of that row
          const fy = uyf[ly], gy = 1 - fy, A3 = ya * w2 * 3, B3 = yb * w2 * 3;
          const la = Math.max(0, c0 * 4 - 2), lb = Math.min(LW, c1 * 4 + 6);
          if (c0 > 0) c0--; if (c1 < w2 - 1) c1++;
          for (let q = c0 * 3, qe = c1 * 3 + 3; q < qe; q++) rowV[q] = b2[A3 + q] * gy + b2[B3 + q] * fy;
          for (let lx = la; lx < lb; lx++) {
            const fx = uxf[lx], gx = 1 - fx, i = ux0[lx] * 3, j = ux1[lx] * 3;
            LR[lx] = (rowV[i] * gx + rowV[j] * fx + 0.5) | 0; LG[lx] = (rowV[i + 1] * gx + rowV[j + 1] * fx + 0.5) | 0; LB[lx] = (rowV[i + 2] * gx + rowV[j + 2] * fx + 0.5) | 0;
          }
          litA = la; litB = lb;
        }
      }
      // haze and fog: one depth read per logical pixel (its top-left render pixel), folded with the light into M and C
      const depth = doAer || rowFog > 0, y0 = ly * S, y1 = Math.min(h, y0 + S);
      if (depth) {
        P.aScale = aScale; P.fDist = fDist; P.fNear = fNear;
        P.aR = aR; P.aG = aG; P.aB = aB; P.fR = fR; P.fG = fG; P.fB = fB;
        prepDepth(dbuf, y0 * w, S, doAer, rowFog > 0);
      }
      if (doGrade) {
        if (depth) { for (let y = y0; y < y1; y++) gradeDepthRow(fb, mbuf, y * w, w, sh, vigRow[y]); }
        else { for (let y = y0; y < y1; y++) gradeOnly(fb, y * w, w, sh, vigRow[y], rowLit); }
      } else if (depth) { if (sh === 1 && (w & 1) === 0) { for (let y = y0; y < y1; y++) depthRow2(fb, mbuf, y * w, w); } else { for (let y = y0; y < y1; y++) depthRow(fb, mbuf, y * w, w, sh); } }
      else if (rowLit) { const x0 = litA << sh, x1 = Math.min(w, litB << sh); for (let y = y0; y < y1; y++) litRow(fb, y * w, x0, x1, sh); }
    }
    if (litB > litA) { LR.fill(0, litA, litB); LG.fill(0, litA, litB); LB.fill(0, litA, litB); litA = litB = 0; }
    if (stats.profile) { const t2 = now(); stats.ph.final += t2 - t1; stats.ms += t2 - t0; stats.frames++; }
    stats.last = { lit, act: actN / (w2 * h2), aerial: doAer, fog: doFog, grade: doGrade, shimmer: lastShimmer, bloomK: lastBloomK, fogShift: lastFogShift, best: { x: best.x, y: best.y, v: Math.round(best.v) } };
  }

  // ---- grade + vignette on the compositor ---------------------------------------------------------------------------
  let cssOk = null;
  function gradeMode() {
    if (T.gradeOnCanvas) return 'canvas';
    if (cssOk === null) {
      try { cssOk = typeof CSS !== 'undefined' && !!CSS.supports && (CSS.supports('backdrop-filter', 'saturate(1.1)') || CSS.supports('-webkit-backdrop-filter', 'saturate(1.1)')); } catch (e) { cssOk = false; }
    }
    return cssOk ? 'css' : 'canvas';
  }
  // the vignette as gradient stops: black at alpha vig * q^vigPow for q the squared distance ratio, the same curve as the
  // canvas path (and the prototype's 1 - (distance / half-diagonal)^2.2 * 0.35)
  function vignetteCss() {
    const g = T.grade, stops = [0, 0.3, 0.45, 0.6, 0.7, 0.8, 0.9, 1];
    return 'radial-gradient(circle farthest-corner at 50% 50%, ' + stops.map(t => 'rgba(0,0,0,' + (g.vig * Math.pow(t * t, g.vigPow)).toFixed(4) + ') ' + Math.round(t * 100) + '%').join(', ') + ')';
  }
  let veil = null;
  function ensureVeil() {
    if (veil || typeof document === 'undefined') return veil;
    const view = document.getElementById('view');
    if (!view || !view.parentNode) return null;
    if (!document.getElementById('cinema14-style')) {
      const st = document.createElement('style'); st.id = 'cinema14-style';
      const vh = typeof VIEW_H !== 'undefined' && typeof VH !== 'undefined' ? VIEW_H / VH * 100 : 75;   // the 3D view, not the HUD
      const f = 'saturate(' + T.grade.sat + ') contrast(' + T.grade.con + ')';
      st.textContent = '#cine14-veil{position:absolute;left:0;top:0;width:100%;height:' + vh + '%;pointer-events:none;display:none;' +
        'backdrop-filter:' + f + ';-webkit-backdrop-filter:' + f + ';background:' + vignetteCss() + '}' +
        '#cine14-veil.on{display:block}' +
        'html.ac-hc #cine14-veil{display:none!important}';   // high contrast: no grade, no vignette
      document.head.appendChild(st);
    }
    veil = document.createElement('div'); veil.id = 'cine14-veil'; veil.setAttribute('aria-hidden', 'true');
    view.insertAdjacentElement('afterend', veil);   // right above the 3D view, under every other overlay and panel
    return veil;
  }
  function syncGrade() {
    const want = on('cineGrade') && gradeMode() === 'css';
    const el = want ? ensureVeil() : veil;
    if (el) el.classList.toggle('on', want);
  }
  // whether the compositor grade is showing now (tests)
  function veilShown() { return !!(veil && veil.classList.contains('on') && getComputedStyle(veil).display !== 'none'); }

  // ---- settings: remembered between sessions -------------------------------------------------------------------------
  let quiet = false;
  function save() {
    if (quiet || typeof GFX === 'undefined') return;
    try {
      const mine = FLAGS.some(k => GFX[k] === true);
      localStorage.setItem(KEY, JSON.stringify({ p: GFX.preset === 'cinematic' || mine ? 1 : 0, l: GFX.cineLight ? 1 : 0, f: GFX.cineFog ? 1 : 0, g: GFX.cineGrade ? 1 : 0 }));
    } catch (e) { /* no storage: fine */ }
  }
  function restore() {
    let o = null;
    try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return; }
    if (!o || typeof o !== 'object' || o.p !== 1 || typeof PRESETS === 'undefined') return;
    quiet = true;
    try {
      PRESETS.apply('cinematic');
      GFX.cineLight = o.l !== 0; GFX.cineFog = o.f !== 0; GFX.cineGrade = o.g !== 0;
      GFX.preset = PRESETS.current(); GFX.changed();
    } finally { quiet = false; }
  }

  // ---- Options rows (Graphics & access, after the graphics block) ----------------------------------------------------
  const ROWS = [
    ['cine-light', 'Cinematic light', 'bloom on lamps and Light-glass, soft light shafts', 'cineLight'],
    ['cine-fog', 'Ground fog', 'a low drifting fog band and distance haze', 'cineFog'],
    ['cine-grade', 'Cinematic grade', 'richer colour and a soft vignette', 'cineGrade'],
  ];
  function syncBtn(b, k) { const v = GFX[k] === true; b.textContent = v ? 'On' : 'Off'; b.setAttribute('aria-pressed', v ? 'true' : 'false'); b.classList.toggle('sel', v); }
  function setSwitch(k, v) {
    if (!FLAGS.includes(k)) return false;
    GFX[k] = !!v;
    if (typeof PRESETS !== 'undefined') { GFX.preset = PRESETS.current(); }
    GFX.changed();
    if (typeof PRESETS !== 'undefined' && PRESETS.refresh) PRESETS.refresh();
    syncRows();
    return GFX[k];
  }
  function syncRows() { for (const [id, , , k] of ROWS) { const b = typeof document !== 'undefined' && document.getElementById(id); if (b) syncBtn(b, k); } }
  function appendRows() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById('cine-light')) return;
    let anchor = document.getElementById('gfx-curve');
    for (const [id, label, hint, k] of ROWS) {
      const lab = document.createElement('span'); lab.className = 'gfx-label'; lab.id = id + '-label'; lab.textContent = label + ' ';
      const small = document.createElement('small'); small.className = 'muted'; small.textContent = hint; lab.appendChild(small);
      const b = document.createElement('button'); b.className = 'dfbtn small'; b.id = id; b.type = 'button'; b.setAttribute('aria-label', label);
      b.onclick = () => setSwitch(k, GFX[k] !== true);
      syncBtn(b, k);
      if (anchor && anchor.parentNode === grid) { anchor.insertAdjacentElement('afterend', b); anchor.insertAdjacentElement('afterend', lab); anchor = b; }
      else { grid.appendChild(lab); grid.appendChild(b); }
    }
  }
  function wire() {
    if (typeof renderAccessibilityMenu === 'function') {
      const _acc = renderAccessibilityMenu;
      renderAccessibilityMenu = function () {
        const r = _acc.apply(this, arguments);
        try { appendRows(); } catch (e) { console.warn('cinema14 rows failed', e); }
        return r;
      };
    }
    // the preset buttons live in presets.js: keep the switch rows in step when one is pressed
    if (typeof GFX !== 'undefined') GFX.onChange(() => { save(); try { syncGrade(); syncRows(); } catch (e) { /* menu closed */ } });
  }

  if (typeof Engine !== 'undefined' && Engine.addPostHook) Engine.addPostHook(hook, 95);
  wire();
  restore();
  try { if (typeof document !== 'undefined' && document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncGrade); else syncGrade(); } catch (e) { /* no DOM */ }

  return { KEY, FLAGS, T, hook, stats, setSwitch, ROWS, gradeMode, syncGrade, veilShown, veil: () => veil, noise: { N1, N2 }, sizes: () => ({ w2, h2, w3, h3 }) };
})();
if (typeof window !== 'undefined') window.CINEMA14 = CINEMA14;
