// ============================================================
//  post — Phase 2 modern look, applied to the finished frame
//  Four post hooks (Engine.addPostHook) that read the depth and material
//  buffers the renderer already fills: softer depth-graded fog, permanent
//  area mist, bloom on lamps and glass, and a per-area colour grade.
//  Each is gated by a live GFX flag and returns before touching a pixel when
//  its flag is off, so GFX.plain() frames stay byte-identical to the original.
//  Everything animated reads F.animT only, so a pinned clock gives pinned frames.
// ============================================================
'use strict';

if (typeof GFX !== 'undefined') {
  for (const k of ['softFog', 'bloom', 'grade', 'mist']) {
    if (GFX[k] === undefined) GFX[k] = true;
    if (GFX.FX && !GFX.FX.includes(k)) GFX.FX.push(k);
  }
}

const POST = (() => {
  // ------------------------------------------------------------------
  //  Tunables. All colours here are procedural stand-ins for painted grades.
  //  Colours are 0..255 RGB; gains multiply, lifts add into the shadows.
  // ------------------------------------------------------------------
  const config = {
    softFog: {
      start: 0.30,     // fraction of fogDist where the extra blend begins
      full: 1.15,      // fraction where it reaches full strength
      strength: 0.40,  // outdoors: how far the far pixels travel toward the fog colour
      indoor: 0.55,    // interiors use this share of that (their light is not fog-lit)
    },
    // Permanent mist by map id. a = strength 0..1, top = mist depth in wall
    // heights above the ground, col = colour (scaled by the light of the hour),
    // night = only at night, drift = how fast the bands slide.
    mist: {
      whispergrove: { a: 0.46, top: 0.62, col: [118, 152, 170], drift: 1.0 },   // P10: cold teal (was lilac [150, 132, 186])
      deepwoods: { a: 0.40, top: 0.55, col: [128, 112, 146], drift: 0.8 },   // P10: bruised violet (was grey-green [118, 120, 112])
      catacombs: { a: 0.40, top: 0.50, col: [60, 54, 84], drift: 0.6 },
      mausoleum: { a: 0.34, top: 0.45, col: [64, 56, 86], drift: 0.5 },
      belfry: { a: 0.26, top: 0.40, col: [62, 56, 78], drift: 0.7 },
      clearing: { a: 0.36, top: 0.50, col: [140, 150, 158], drift: 0.9, night: true },
    },
    bloom: {
      lampLuma: 150,   // a glow pixel (Engine.MAT.glow) this bright and coloured blooms as a light source
      lampSat: 40,     // ...and this saturated; weight ramps up over the next 80 (skin and cloth are pale)
      sunK: 0.015,      // sun and moon discs are already broad glows; bloom only a little of them
      lampK: 9,        // lamps are a few pixels, so their weight is lifted to read after the blur
      skyLuma: 244,    // the sun and moon discs; the open sky itself stays under this
      hardLuma: 222,   // anything else this bright blooms
      radius: 1,       // blur pass pairs on the quarter-resolution buffer
      gain: 3.5,
      cap: 64,         // most any channel can gain from bloom
      flashCut: 1.6,   // how fast lightning shuts bloom off (flash * this)
    },
    // Grade presets and the area -> preset table. gain multiplies each channel,
    // lift adds into the darks, sat is saturation, con an S-curve (0 = none).
    // night is blended in as the sky darkens outdoors.
    dusk: [1.12, 1.02, 0.88],   // extra gain at dawn and dusk, outdoors
    gradePresets: {
      town: { day: { gain: [1.04, 1.00, 0.93], lift: [5, 3, 2], sat: 0.86, con: 0.16 }, night: { gain: [0.92, 0.98, 1.10], lift: [1, 2, 6], sat: 0.84, con: 0.12 } },
      meadow: { day: { gain: [1.00, 1.04, 0.95], lift: [3, 4, 2], sat: 0.96, con: 0.14 }, night: { gain: [0.88, 0.98, 1.08], lift: [1, 3, 6], sat: 0.88, con: 0.12 } },
      grove: { day: { gain: [1.03, 0.95, 1.08], lift: [5, 3, 7], sat: 0.96, con: 0.15 }, night: { gain: [0.98, 0.9, 1.14], lift: [4, 2, 9], sat: 0.92, con: 0.14 } },
      woods: { day: { gain: [1.08, 0.97, 1.02], lift: [8, 3, 9], sat: 0.98, con: 0.18 }, night: { gain: [1.02, 0.88, 1.12], lift: [8, 2, 11], sat: 0.92, con: 0.16 } },
      // Phase 10: the owner's three palettes (procedural stand-ins for painted grades). Each keeps the
      // day -> night blend of the older presets, so dawn, dusk and night behave as before.
      amber: { keep: 0.7, day: { gain: [1.09, 1.00, 0.84], lift: [7, 3, 0], sat: 0.96, con: 0.16 }, night: { gain: [0.98, 0.97, 1.04], lift: [3, 2, 5], sat: 0.86, con: 0.12 } },   // Oakhaven streets: warm amber
      amberIn: { keep: 0.7, day: { gain: [1.12, 1.00, 0.82], lift: [8, 3, 0], sat: 1.00, con: 0.15 }, night: { gain: [1.12, 1.00, 0.82], lift: [8, 3, 0], sat: 1.00, con: 0.15 } },   // Oakhaven interiors: candle preset, a touch more amber
      teal: { keep: 0.7, day: { gain: [0.76, 1.03, 1.04], lift: [1, 5, 8], sat: 0.88, con: 0.15 }, night: { gain: [0.72, 0.98, 1.10], lift: [0, 5, 11], sat: 0.88, con: 0.14 } },   // Whisper-Grove: cold teal
      violet: { keep: 0.7, day: { gain: [0.98, 0.74, 1.03], lift: [8, 0, 8], sat: 1.02, con: 0.20 }, night: { gain: [0.98, 0.72, 1.12], lift: [8, 0, 13], sat: 0.94, con: 0.16 } },   // Deep Woods: bruised violet
      crypt: { day: { gain: [0.96, 0.98, 1.10], lift: [3, 3, 9], sat: 0.84, con: 0.16 }, night: { gain: [0.96, 0.98, 1.10], lift: [3, 3, 9], sat: 0.84, con: 0.16 } },
      candle: { day: { gain: [1.10, 1.01, 0.86], lift: [7, 3, 0], sat: 0.98, con: 0.15 }, night: { gain: [1.10, 1.01, 0.86], lift: [7, 3, 0], sat: 0.98, con: 0.15 } },
    },
    grade: {
      oakhaven: 'amber', chapel: 'amberIn', quarry: 'meadow', clearing: 'meadow', underhedge: 'meadow',
      tavern: 'amberIn', greenhall: 'amberIn', surgery: 'amberIn', mill: 'amberIn', orla_house: 'amberIn', lyra_house: 'amberIn', tannery: 'amberIn', watchhouse: 'amberIn',
      whispergrove: 'teal', sunken: 'teal', deepwoods: 'violet',
      catacombs: 'crypt', mausoleum: 'crypt', belfry: 'crypt', cloister: 'crypt', rootvault: 'crypt',
      _outdoor: 'meadow', _indoor: 'candle',
    },
  };

  // opt-in per-effect timing: POST.profile = true fills POST.cost (ms, last frame)
  const state = { profile: false, cost: { softFog: 0, mist: 0, bloom: 0, grade: 0 }, calls: { softFog: 0, mist: 0, bloom: 0, grade: 0 } };
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  const smooth = (x) => x * x * (3 - 2 * x);

  // ------------------------------------------------------------------
  //  softFog: the engine's linear fog stops dead at fogDist, which reads as
  //  a hard edge. This adds a smoothstep blend toward the fog colour,
  //  graded by depth, so the far ground and walls melt instead of cut.
  // ------------------------------------------------------------------
  const FOG_N = 256, FOG_RANGE = 2.56;   // table covers depth 0..2.56 * fogDist
  const fogLut = new Float32Array(FOG_N);
  let fogKey = '';
  function buildFogLut() {
    const c = config.softFog, key = c.start + '|' + c.full;
    if (key === fogKey) return;
    fogKey = key;
    for (let i = 0; i < FOG_N; i++) {
      const u = (i / (FOG_N - 1)) * FOG_RANGE;   // depth as a fraction of fogDist
      fogLut[i] = smooth(clamp((u - c.start) / Math.max(0.01, c.full - c.start), 0, 1));
    }
  }
  function softFog(F) {
    if (!GFX.softFog || !F.dbuf) return;
    const t0 = state.profile ? now() : 0;
    buildFogLut();
    const c = config.softFog, fb = F.fb, dbuf = F.dbuf, mbuf = F.mbuf, n = F.w * F.h;
    const k = (F.outdoor ? c.strength : c.strength * c.indoor);
    const lt = F.outdoor ? clamp(F.light, 0, 1.5) : 1;
    const fr = F.fogR * lt, fg = F.fogG * lt, fbl = F.fogB * lt;
    const scale = (FOG_N - 1) / (FOG_RANGE * Math.max(1, F.fogDist));
    const kq = (k * 256) | 0;
    for (let i = 0; i < n; i++) {
      const d = dbuf[i];
      if (d >= 1e8 || mbuf[i] === 1) continue;     // the open sky is not fogged
      let fi = (d * scale) | 0; if (fi > FOG_N - 1) fi = FOG_N - 1;
      const a = (fogLut[fi] * kq) | 0;
      if (a === 0) continue;
      const px = fb[i], r = px & 255, g = (px >> 8) & 255, b = (px >> 16) & 255;
      fb[i] = (px & 0xff000000) | ((b + (((fbl - b) * a) >> 8)) << 16) | ((g + (((fg - g) * a) >> 8)) << 8) | (r + (((fr - r) * a) >> 8));
    }
    if (state.profile) { state.cost.softFog = now() - t0; state.calls.softFog++; }
  }

  // ------------------------------------------------------------------
  //  mist: permanent, ground-hugging. Density rises with distance, falls with
  //  height above the ground (worked out from the pixel's own depth and row),
  //  and drifts in slow bands. A thin glow also sits on the sky at the horizon
  //  so far mist meets the air.
  // ------------------------------------------------------------------
  const NOISE_N = 1024;
  const noise = new Float32Array(NOISE_N);   // smooth 1D value noise, wrapped; stand-in for painted fog banks
  (function () {
    const K = 48, seeds = new Float32Array(K);
    let s = 12345;
    for (let i = 0; i < K; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; seeds[i] = s / 0x7fffffff; }
    for (let i = 0; i < NOISE_N; i++) {
      const u = (i / NOISE_N) * K, a = u | 0, f = u - a, m = f * f * (3 - 2 * f);
      noise[i] = seeds[a % K] * (1 - m) + seeds[(a + 1) % K] * m;
    }
  })();
  const MIST_D = 256, MIST_H = 64;
  const mistDepth = new Float32Array(MIST_D);   // 0..1 by depth / (fogDist * 1.5)
  for (let i = 0; i < MIST_D; i++) { const u = i / (MIST_D - 1); mistDepth[i] = 1 - Math.exp(-u * 3.2); }
  const mistHeight = new Float32Array(MIST_H);  // 1 at the ground, 0 at the top of the layer
  for (let i = 0; i < MIST_H; i++) { const u = 1 - i / (MIST_H - 1); mistHeight[i] = u * u * (3 - 2 * u); }
  let colIdx = new Int16Array(0), mistW = 0;
  function mist(F) {
    if (!GFX.mist || !F.dbuf || !F.map) return;
    const cfg = config.mist[F.map.id];
    if (!cfg) return;
    let amt = cfg.a;
    if (cfg.night) amt *= clamp((0.62 - (F.skyDay == null ? 1 : F.skyDay)) / 0.4, 0, 1);
    // weather mist is drawn afterwards by weather.js; give way to thick air
    const haze = F.wx ? F.wx.haze : 0;
    amt *= 1 - clamp(haze * 2.2, 0, 0.8);
    if (amt < 0.01) return;
    const t0 = state.profile ? now() : 0;
    const w = F.w, h = F.h, S = F.S || 1, fb = F.fb, dbuf = F.dbuf, mbuf = F.mbuf;
    if (mistW !== w) { colIdx = new Int16Array(w); for (let x = 0; x < w; x++) colIdx[x] = (x * 3.1 / S) | 0; mistW = w; }
    const L = F.outdoor ? clamp(F.light, 0.22, 1) : 1;
    const mr = (cfg.col[0] * L) | 0, mg = (cfg.col[1] * L) | 0, mb = (cfg.col[2] * L) | 0;
    const horizon = F.horizon, zEye = clamp(F.cam && F.cam.z != null ? F.cam.z : 0.5, 0.3, 1.2);
    const fd = Math.max(4, F.fogDist), dScale = (MIST_D - 1) / (fd * 1.5);
    const top = Math.max(0.1, cfg.top), hScale = (MIST_H - 1) / top;
    const tShift = ((F.animT || 0) * 14 * (cfg.drift || 1)) | 0;
    const skyBand = 12 * S;   // rows over which horizon glow fades out
    const cap = 0.62;
    for (let y = 0; y < h; y++) {
      const dy = y - horizon;
      // above the horizon the height over ground only grows with depth, so a row far above
      // it can hold mist only on things nearer than 1.5 units: skip the row outright
      if (dy < 0 && -dy > skyBand && -dy > (top > zEye ? (top - zEye) * h / 1.5 : 0)) continue;
      let o = y * w;
      const rowN = (y * 5) | 0;
      // a world point seen at row y and depth d sits at eye height - dy*d/h; with
      // the eye zEye over the ground that gives height above ground = zEye - dy*d/h
      const hk = dy / h;
      let skyA = 0;
      if (dy <= 0 && -dy < skyBand) skyA = (1 - -dy / skyBand); // sky rows hugging the horizon
      skyA = skyA * skyA * amt * 0.8;
      for (let x = 0; x < w; x++, o++) {
        const d = dbuf[o];
        let a;
        if (d >= 1e8) {
          if (skyA === 0) continue;
          a = skyA;
        } else {
          const di = (d * dScale) | 0;
          const dl = mistDepth[di > MIST_D - 1 ? MIST_D - 1 : di];
          if (dl * amt < 0.004) continue;
          let hg = zEye - hk * d;                       // height above the ground, wall heights
          if (hg < 0) hg = 0;
          if (hg >= top) { if (mbuf[o] !== 5) continue; hg = 0; }
          const hi = (hg * hScale) | 0;
          a = dl * mistHeight[hi > MIST_H - 1 ? MIST_H - 1 : hi] * amt;
          if (a < 0.004) continue;
          // slow bands: noise indexed by column and row (on the ground a row is a depth) plus the drifting clock
          a *= 0.55 + 0.9 * noise[(colIdx[x] + rowN + tShift) & (NOISE_N - 1)];
        }
        if (a > cap) a = cap;
        const ai = (a * 256) | 0;
        const px = fb[o], r = px & 255, g = (px >> 8) & 255, b = (px >> 16) & 255;
        fb[o] = (px & 0xff000000) | ((b + (((mb - b) * ai) >> 8)) << 16) | ((g + (((mg - g) * ai) >> 8)) << 8) | (r + (((mr - r) * ai) >> 8));
      }
    }
    if (state.profile) { state.cost.mist = now() - t0; state.calls.mist++; }
  }

  // ------------------------------------------------------------------
  //  bloom: bright-pass at quarter resolution (lamps, glass, flames, the
  //  sun), a separable blur, then an additive, capped upsample. Lightning
  //  turns it off: a flash already lifts the whole frame and must not flare.
  // ------------------------------------------------------------------
  const B = 4;
  let bw = 0, bh = 0, bFw = 0, bFh = 0;
  let bR = new Float32Array(0), bG = bR, bB = bR, tR = bR, tG = bR, tB = bR, bAct = new Uint8Array(0);
  let xi0 = new Int16Array(0), xf = new Float32Array(0), yi0 = new Int16Array(0), yf = new Float32Array(0);
  function bloomEnsure(w, h) {
    if (bFw === w && bFh === h) return;
    bFw = w; bFh = h; bw = Math.ceil(w / B); bh = Math.ceil(h / B);
    const n = bw * bh;
    bR = new Float32Array(n); bG = new Float32Array(n); bB = new Float32Array(n);
    tR = new Float32Array(n); tG = new Float32Array(n); tB = new Float32Array(n);
    bAct = new Uint8Array(n);
    xi0 = new Int16Array(w); xf = new Float32Array(w); yi0 = new Int16Array(h); yf = new Float32Array(h);
    for (let x = 0; x < w; x++) { const u = (x + 0.5) / B - 0.5, i = Math.floor(u); xi0[x] = i; xf[x] = u - i; }
    for (let y = 0; y < h; y++) { const u = (y + 0.5) / B - 0.5, i = Math.floor(u); yi0[y] = i; yf[y] = u - i; }
  }
  const K5 = [1 / 16, 4 / 16, 6 / 16, 4 / 16, 1 / 16];
  function blurPass(sr, sg, sb, dr, dg, db, horizontal) {
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        let r = 0, g = 0, b = 0;
        for (let k = -2; k <= 2; k++) {
          let xx = horizontal ? x + k : x, yy = horizontal ? y : y + k;
          if (xx < 0) xx = 0; else if (xx >= bw) xx = bw - 1;
          if (yy < 0) yy = 0; else if (yy >= bh) yy = bh - 1;
          const i = yy * bw + xx, wgt = K5[k + 2];
          r += sr[i] * wgt; g += sg[i] * wgt; b += sb[i] * wgt;
        }
        const o = y * bw + x; dr[o] = r; dg[o] = g; db[o] = b;
      }
    }
  }
  function bloom(F) {
    if (!GFX.bloom || !F.dbuf) return;
    const c = config.bloom;
    const flash = F.wx ? F.wx.flash : 0;
    const fk = clamp(1 - flash * c.flashCut, 0, 1);
    if (fk <= 0.02) return;
    const t0 = state.profile ? now() : 0;
    const w = F.w, h = F.h, fb = F.fb, mbuf = F.mbuf, dbuf = F.dbuf;
    bloomEnsure(w, h);
    // sprite lights matter most when it is dark; by day they only glint
    const sprK = F.outdoor ? 1 - 0.5 * clamp(F.skyDay == null ? 0 : F.skyDay, 0, 1) : 1;
    // bright pass: every pixel of each 4x4 cell, accumulate into the small buffer.
    // Lamps are drawn no brighter than the hour allows (the engine dims every sprite
    // by the ambient light), so a sprite's luma is judged against that dimming and its
    // colour lifted back by it: a night-time lantern still glows its own orange.
    let any = false;
    const lk = F.outdoor ? 0.3 + 0.7 * clamp(F.light, 0.1, 1) : 1, ilk = 1 / lk;
    const lampL = c.lampLuma, lampS = c.lampSat, skyL = c.skyLuma, hardL = c.hardLuma, lowL = lampL * lk;
    for (let by = 0; by < bh; by++) {
      for (let bx = 0; bx < bw; bx++) {
        let sr = 0, sg = 0, sb = 0;
        for (let j = 0; j < 4; j++) {
          const y = by * B + j; if (y >= h) continue;
          for (let i = 0; i < 4; i++) {
            const x = bx * B + i; if (x >= w) continue;
            const o = y * w + x, px = fb[o];
            const r = px & 255, g = (px >> 8) & 255, b = (px >> 16) & 255;
            const l = (r * 77 + g * 150 + b * 29) >> 8;
            if (l < lowL) continue;
            const m = mbuf[o];
            if (m === 8) {   // the engine marks lamps, fire, glass and emissive pixels as glow
              const mx = r > g ? (r > b ? r : b) : (g > b ? g : b), mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
              const ln = l * ilk, sat = (mx - mn) * ilk;
              // a flame or lantern is bright AND saturated; skin and cloth are bright but pale
              const w0 = ln >= lampL && sat > lampS ? (ln - lampL) / (255 - lampL) * ((sat - lampS) > 80 ? 1 : (sat - lampS) / 80) : 0;
              const wgt = w0 > 0.02 ? w0 * sprK * ilk * c.lampK : 0;
              if (wgt > 0) {
                sr += r * wgt; sg += g * wgt; sb += b * wgt;
              } else if (l >= hardL) { const wgt = (l - hardL) / (255 - hardL); sr += r * wgt; sg += g * wgt; sb += b * wgt; }
            } else if (m === 1) {
              if (l >= skyL) { const wgt = (l - skyL) / (255 - skyL) * c.sunK; sr += r * wgt; sg += g * wgt; sb += b * wgt; }
            } else if (l >= hardL) { const wgt = (l - hardL) / (255 - hardL); sr += r * wgt; sg += g * wgt; sb += b * wgt; }
          }
        }
        const o = by * bw + bx;
        bR[o] = sr * 0.125; bG[o] = sg * 0.125; bB[o] = sb * 0.125;
        if (sr + sg + sb > 0) any = true;
      }
    }
    if (!any) { if (state.profile) { state.cost.bloom = now() - t0; state.calls.bloom++; } return; }
    // blur twice (each is a 5-tap separable pass) for a soft, wide halo
    for (let p = 0; p < c.radius; p++) {
      blurPass(bR, bG, bB, tR, tG, tB, true);
      blurPass(tR, tG, tB, bR, bG, bB, false);
    }
    // activity mask so the upsample can skip the empty frame
    for (let i = 0; i < bw * bh; i++) bAct[i] = (bR[i] + bG[i] + bB[i]) > 1.5 ? 1 : 0;
    const gain = c.gain * fk, cap = c.cap * fk;
    for (let y = 0; y < h; y++) {
      const y0 = yi0[y], fy = yf[y];
      const ya = y0 < 0 ? 0 : y0, yb = y0 + 1 >= bh ? bh - 1 : y0 + 1;
      // skip a row when none of its two small rows hold any light
      let rowAny = false;
      for (let x = 0; x < bw; x++) if (bAct[ya * bw + x] | bAct[yb * bw + x]) { rowAny = true; break; }
      if (!rowAny) continue;
      const ra = ya * bw, rb = yb * bw;
      let o = y * w;
      for (let x = 0; x < w; x++, o++) {
        const x0 = xi0[x], fx = xf[x];
        const xa = x0 < 0 ? 0 : x0, xb = x0 + 1 >= bw ? bw - 1 : x0 + 1;
        const i00 = ra + xa, i10 = ra + xb, i01 = rb + xa, i11 = rb + xb;
        if (!(bAct[i00] | bAct[i10] | bAct[i01] | bAct[i11])) continue;
        const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
        let ar = (bR[i00] * w00 + bR[i10] * w10 + bR[i01] * w01 + bR[i11] * w11) * gain;
        let ag = (bG[i00] * w00 + bG[i10] * w10 + bG[i01] * w01 + bG[i11] * w11) * gain;
        let ab = (bB[i00] * w00 + bB[i10] * w10 + bB[i01] * w01 + bB[i11] * w11) * gain;
        if (ar < 0.5 && ag < 0.5 && ab < 0.5) continue;
        if (ar > cap) ar = cap; if (ag > cap) ag = cap; if (ab > cap) ab = cap;
        const px = fb[o];
        let r = (px & 255) + ar, g = ((px >> 8) & 255) + ag, b = ((px >> 16) & 255) + ab;
        if (r > 255) r = 255; if (g > 255) g = 255; if (b > 255) b = 255;
        fb[o] = (px & 0xff000000) | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0);
      }
    }
    if (state.profile) { state.cost.bloom = now() - t0; state.calls.bloom++; }
  }

  // ------------------------------------------------------------------
  //  grade: one 3x256 lookup (gain, lift and an S-curve per channel) plus a
  //  saturation pull toward luma. Rebuilt only when the area or the hour moves
  //  by a visible step, into the same typed array.
  // ------------------------------------------------------------------
  const gradeLut = new Uint8Array(768);
  let gradeKey = '', gradeSat = 256;
  function presetFor(F) {
    const g = config.gradePresets, map = F.map;
    const name = (map && config.grade[map.id]) || (F.outdoor ? config.grade._outdoor : config.grade._indoor);
    return g[name] || g.candle;
  }
  function buildGrade(F) {
    const p = presetFor(F);
    // outdoors the hour blends day into night; interiors are always "day"
    const dk = F.outdoor ? clamp(F.skyDay == null ? 1 : F.skyDay, 0, 1) : 1;
    const q = (dk * 32) | 0;
    // dawn and dusk warm the whole frame a little (the sky's own glow is richer for it)
    const tod = F.tod == null ? 0.5 : F.tod;
    const warm = F.outdoor ? Math.exp(-Math.pow(tod - 0.76, 2) / 0.006) + Math.exp(-Math.pow(tod - 0.26, 2) / 0.006) : 0;
    const wq = (clamp(warm, 0, 1) * 8) | 0;
    const key = (F.map ? F.map.id : '') + '|' + (F.outdoor ? q + ':' + wq : 'in') + '|' + config.grade._rev;
    if (key === gradeKey) return;
    gradeKey = key;
    const kk = F.outdoor ? q / 32 : 1, wk = wq / 8;
    const mix = (a, b) => b + (a - b) * kk;
    const sat = mix(p.day.sat, p.night.sat) + 0.16 * wk, con = mix(p.day.con, p.night.con);
    gradeSat = (sat * 256) | 0;
    const dusk = config.dusk;
    for (let ch = 0; ch < 3; ch++) {
      const gain = mix(p.day.gain[ch], p.night.gain[ch]) * (1 + (dusk[ch] - 1) * wk), lift = mix(p.day.lift[ch], p.night.lift[ch]);
      const keep = p.keep || 0;   // P10: highlight protection, so a strong tint cannot dye the whites (sun, lamps, glints stay bright)
      for (let v = 0; v < 256; v++) {
        let u = v / 255;
        u = u * (1 - con) + smooth(u) * con;   // gentle S-curve
        const ge = keep && gain < 1 ? gain + (1 - gain) * keep * u * u * u : gain;
        let o = u * ge * 255 + lift * (1 - u);   // lift raises the blacks and fades out toward white
        o = o < 0 ? 0 : o > 255 ? 255 : o;
        gradeLut[ch * 256 + v] = o | 0;
      }
    }
  }
  config.grade._rev = 0;
  function grade(F) {
    if (!GFX.grade || !F.fb) return;
    const t0 = state.profile ? now() : 0;
    buildGrade(F);
    const fb = F.fb, n = F.w * F.h, lut = gradeLut, sat = gradeSat;
    for (let i = 0; i < n; i++) {
      const px = fb[i];
      let r = lut[px & 255], g = lut[256 + ((px >> 8) & 255)], b = lut[512 + ((px >> 16) & 255)];
      const l = (r * 77 + g * 150 + b * 29) >> 8;
      r = l + (((r - l) * sat) >> 8); g = l + (((g - l) * sat) >> 8); b = l + (((b - l) * sat) >> 8);
      // saturation above 1 pushes vivid colours past the byte range; clamp, or the
      // overflow spills into the next channel (a dawn sun turned teal)
      r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
      fb[i] = (px & 0xff000000) | (b << 16) | (g << 8) | r;
    }
    if (state.profile) { state.cost.grade = now() - t0; state.calls.grade++; }
  }

  // drop caches (tests change config, or the resolution changes)
  function reset() { gradeKey = ''; fogKey = ''; bFw = 0; bFh = 0; mistW = 0; }
  // the area's grade and mist entry, for tests and tuning
  function areaOf(id) { return { mist: config.mist[id] || null, grade: config.grade[id] || null }; }

  if (typeof Engine !== 'undefined' && Engine.addPostHook) {
    Engine.addPostHook(softFog, 10);
    Engine.addPostHook(mist, 20);
    Engine.addPostHook(bloom, 30);
    Engine.addPostHook(grade, 40);
  }
  if (typeof GFX !== 'undefined' && GFX.onChange) GFX.onChange(reset);

  return {
    config, reset, areaOf, hooks: { softFog, mist, bloom, grade },
    get profile() { return state.profile; }, set profile(v) { state.profile = !!v; },
    cost: state.cost, calls: state.calls,
  };
})();
if (typeof window !== 'undefined') window.POST = POST;
