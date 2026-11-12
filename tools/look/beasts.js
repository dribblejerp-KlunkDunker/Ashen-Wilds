// ============================================================
//  A LOOK TEST, not part of the game. The page does not load this file; tools/beastshots.js injects it.
//
//  The owner asked (12 Nov) to see "a couple beasts both modeled and painted", to rule on D8 ("people are painted;
//  beasts are modelled") against the build brief ("each person and each creature is one painted front-view picture").
//  Two things from the world bible, each made both ways:
//
//    the walking bloom   a body that still walks: caps along the shoulders and scalp, a crust over the eyes, a slow
//                        swaying shamble, clawing hands (the-smothering.md). 1.5 to 1.85 m.
//    the quarry-troll    blind, hunched (2.6 m), huge forearms and fists, short thick legs, two shallow pits under a
//                        heavy brow, wide folded ear flaps, a grey hide crusted with lime: at rest, an outcrop (bestiary.md).
//
//  PAINTED: one front-view picture each, made with the painter's kit of js/art2.js, drawn by the engine as it draws
//  people: flat, turned to face you, lit and fogged by the engine.
//  MODELLED: real geometry (boxes, tapered and jointed), drawn by a pass of its own into the same frame, with depth,
//  lit by the hour and by the land's fire in the west. It has a back and sides, and it can be seen from above.
//
//  Whichever the owner rules against is deleted. Nothing here uses a random number or a clock of its own.
// ============================================================
'use strict';

const BEASTLOOK = (() => {
  const K = ART2.kit, { sheet, put, at, limb, drape, oval, box, outline, done, cols, hex, ramp, hash, vnoise, INK } = K;

  // ---------------------------------------------------------------- PAINTED
  const ASHEN = cols('#1f221c', '#33372e', '#484d41', '#5f6555', '#787e6b'), CRUST = cols('#6f6e61', '#8f8e7d', '#b4b39f'), RAG = cols('#0d0c0a', '#161411', '#201d18', '#2b2721');
  const TEAL = cols('#1c4f47', '#2c7d6d', '#4fb39b', '#8fe0cb');
  function cap(s, cx, cy, r) {                              // a corpse-cap: a pale stem and a small dome that gives its own light
    for (let y = 0; y < Math.max(2, r); y++) put(s, Math.round(cx), Math.round(cy + y), CRUST[2]);
    for (let y = Math.floor(cy - r * 0.7); y <= Math.round(cy); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const u = (x + 0.5 - cx) / r, v = (y + 0.5 - cy) / (r * 0.7); if (u * u + v * v > 1 || v > 0.15) continue;
      put(s, x, y, ramp(TEAL, 0.62 - u * 0.3 + v * -0.25, x, y), v < -0.2);
    }
  }
  function paintBloom() {
    const s = sheet(64, 160), X = 32;
    // legs, bare and thin, one a little behind the other; feet
    for (const [hx, kx, ax, seed] of [[26, 24.5, 26, 1], [38, 39.5, 37.5, 2]]) {
      limb(s, hx, 90, kx, 119, 4.4, 3.6, ASHEN, { base: 0.5, fold: 0.2, seed });
      limb(s, kx, 119, ax, 151, 3.6, 3.0, ASHEN, { base: 0.48, fold: 0.2, seed: seed + 4 });
      oval(s, ax + (hx < X ? -1 : 1), 155.5, 5.2, 3.2, ASHEN, { base: 0.45 });
    }
    // the trunk, stooped to its right, in what is left of a shirt; the rags hang in strips below it
    drape(s, 31, 92, (t) => X + t * 1.5, (t) => (t < 0.6 ? 11.5 - t * 2 : 10.3 + (t - 0.6) * 3), RAG, { fold: 0.5, seed: 3 });
    for (let x = 20; x <= 46; x++) { const len = Math.floor(hash(x >> 1, 0, 501) * 13); for (let y = 93; y < 93 + len; y++) if (hash(x >> 1, 1, 502) > 0.3) put(s, x, y, ramp(RAG, 0.3 + hash(x, y, 503) * 0.4, x, y)); }
    for (let y = 36; y <= 60; y++) for (let x = 24; x <= 40; x++) if (at(s, x, y) && vnoise(x * 0.3, y * 0.25, 504, 0) > 0.63) put(s, x, y, ramp(ASHEN, 0.35 + hash(x, y, 505) * 0.4, x, y));   // skin through the tears
    for (let y = 38; y <= 58; y++) for (let x = 26; x <= 38; x++) if (at(s, x, y) && vnoise(x * 0.5, y * 0.45, 506, 0) > 0.74) put(s, x, y, CRUST[1 + ((x + y) & 1)]);                           // the crust on the chest
    // the arms: long, hanging forward, the hands open and clawed
    for (const [sx, ex, wx, seed] of [[19.5, 14.5, 15.5, 5], [45.5, 50, 48.5, 6]]) {
      limb(s, sx, 35, ex, 63, 3.9, 3.2, ASHEN, { base: 0.5, fold: 0.2, seed });
      limb(s, ex, 63, wx, 92, 3.2, 2.6, ASHEN, { base: 0.46, fold: 0.2, seed: seed + 3 });
      for (const d of [-3, -1, 1, 3]) limb(s, wx + d * 0.5, 93, wx + d * 1.25, 102 + Math.abs(d), 1.15, 0.7, ASHEN, { base: 0.6 });
    }
    // the shoulders, uneven; the neck; the head hung forward and to one side
    drape(s, 27, 37, X + 0.5, (t) => 9 + t * 7, RAG, { fold: 0.4, seed: 7 });
    limb(s, 32, 30, 34, 22, 3.4, 3.2, ASHEN, { base: 0.42 });
    oval(s, 35, 15, 8.2, 9.6, ASHEN, { base: 0.55 });
    for (let y = 9; y <= 15; y++) for (let x = 28; x <= 42; x++) if (at(s, x, y) && (y < 14 || hash(x, y, 507) > 0.4)) put(s, x, y, ramp(CRUST, 0.75 - (x - 35) * 0.05 - (y - 9) * 0.06 + hash(x, y, 508) * 0.3, x, y));   // the crust over the eyes
    for (let x = 32; x <= 38; x++) { put(s, x, 20, INK); if (x > 32 && x < 38) put(s, x, 21, hex('#1a0d0b')); }                                                                                // the mouth, open
    for (const [cx, cy, r] of [[30, 6, 3.2], [36, 4, 3.8], [41, 7, 2.6], [26, 10, 2.2], [17, 30, 3.2], [22, 27, 2.6], [45, 28, 3.6], [50, 32, 2.6], [40, 25, 2.2], [13, 36, 2.2]]) cap(s, cx, cy, r);
    outline(s, INK);
    return done(s, { hs: 1 });
  }
  const HIDE = cols('#18191b', '#27292c', '#383b3f', '#4b4f54', '#5f646a'), LIME = cols('#84837a', '#a3a297', '#bebdb0');
  function paintTroll() {
    const s = sheet(150, 150), X = 75;
    for (const sg of [-1, 1]) {                                                                       // the legs: short, thick; the feet
      limb(s, X + sg * 17, 108, X + sg * 20, 138, 13.5, 11.5, HIDE, { base: 0.42, fold: 0.25, seed: 10 + sg });
      oval(s, X + sg * 22, 144, 14, 5.6, HIDE, { base: 0.4 });
    }
    oval(s, X, 74, 41, 44, HIDE, { base: 0.5 });                                                      // the trunk
    for (const sg of [-1, 1]) {                                                                       // the shoulders, the arms, the fists on the ground
      oval(s, X + sg * 38, 50, 21, 19, HIDE, { base: 0.56 });
      limb(s, X + sg * 46, 56, X + sg * 55, 100, 13.5, 14.5, HIDE, { base: 0.5, fold: 0.25, seed: 20 + sg });
      limb(s, X + sg * 55, 100, X + sg * 53, 132, 15.5, 17.5, HIDE, { base: 0.48, fold: 0.25, seed: 30 + sg });
      oval(s, X + sg * 53, 140, 18, 9.5, HIDE, { base: 0.5 });
      for (let i = -2; i <= 2; i++) for (let y = 141; y <= 146; y++) put(s, Math.round(X + sg * 53 + i * 6.5), y, HIDE[0]);   // between the knuckles
    }
    // the head: low, in front of the chest; ears like folded flaps; a heavy brow; two shallow pits; a wide shut mouth
    for (const sg of [-1, 1]) { oval(s, X + sg * 23, 47, 9.5, 14, HIDE, { base: 0.45 }); for (let y = 37; y <= 57; y++) put(s, Math.round(X + sg * (21 + Math.abs(y - 47) * 0.12)), y, HIDE[0]); }
    oval(s, X, 62, 14, 9.5, HIDE, { base: 0.36 });
    oval(s, X, 50, 18, 15.5, HIDE, { base: 0.56 });
    for (let x = X - 17; x <= X + 16; x++) { put(s, x, 43, HIDE[4]); put(s, x, 44, HIDE[3]); put(s, x, 45, HIDE[1]); put(s, x, 46, HIDE[0]); }
    for (const sg of [-1, 1]) oval(s, X + sg * 8, 50.5, 3.8, 2.6, cols('#08080a', '#101113'), { base: 0.3 });
    put(s, X - 2, 56, HIDE[0]); put(s, X + 1, 56, HIDE[0]);
    for (let x = X - 11; x <= X + 10; x++) put(s, x, 63 + (Math.abs(x - X) > 8 ? 1 : 0), INK);
    // the lime: it lies where dust would, on what faces up
    const top = new Int16Array(s.w).fill(-1);
    for (let x = 0; x < s.w; x++) for (let y = 0; y < s.h; y++) if (at(s, x, y)) { top[x] = y; break; }
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      const v = at(s, x, y); if (!v) continue;
      const lit = v === HIDE[4] || v === HIDE[3], near = top[x] >= 0 && y - top[x] < 14;
      if ((lit && hash(x, y, 511) > 0.52) || (near && hash(x, y, 512) > 0.35 + (y - top[x]) * 0.04)) put(s, x, y, ramp(LIME, 0.4 + hash(x, y, 513) * 0.6 - (y - top[x]) * 0.01, x, y));
    }
    outline(s, INK);
    return done(s, { hs: 1.45 });
  }

  // ---------------------------------------------------------------- MODELLED
  // 3 x 4 transforms. Local axes: x forward, y to the thing's left, z up. One unit is a wall's height (a person's).
  const mul = (A, B) => { const o = new Array(12); for (let r = 0; r < 3; r++) { for (let c = 0; c < 4; c++) o[r * 4 + c] = A[r * 4] * B[c] + A[r * 4 + 1] * B[4 + c] + A[r * 4 + 2] * B[8 + c] + (c === 3 ? A[r * 4 + 3] : 0); } return o; };
  const Tr = (x, y, z) => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z];
  const Rx = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0]; };
  const Ry = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0]; };
  const Rz = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0]; };
  const chain = (...m) => m.reduce(mul);
  const ap = (M, p) => [M[0] * p[0] + M[1] * p[1] + M[2] * p[2] + M[3], M[4] * p[0] + M[5] * p[1] + M[6] * p[2] + M[7], M[8] * p[0] + M[9] * p[1] + M[10] * p[2] + M[11]];
  const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  // a box from lo to hi in the part's own space; `taper` narrows or widens its top; k > 0 glows, k < 0 takes lime
  function part(out, M, lo, hi, col, o) {
    o = o || {}; const t = o.taper || [1, 1], mx = (lo[0] + hi[0]) / 2, my = (lo[1] + hi[1]) / 2, k = o.k || 0;
    const P = []; for (let i = 0; i < 8; i++) { const top = i & 4, x = i & 1 ? hi[0] : lo[0], y = i & 2 ? hi[1] : lo[1]; P.push([top ? mx + (x - mx) * t[0] : x, top ? my + (y - my) * t[1] : y, top ? hi[2] : lo[2]]); }
    const W = P.map((p) => ap(M, p));
    for (const f of [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]) {
      const a = W[f[0]], b = W[f[1]], c = W[f[2]], ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
      for (const i of [f[0], f[1], f[2], f[0], f[2], f[3]]) out.push(W[i][0], W[i][1], W[i][2], nx, ny, nz, col[0], col[1], col[2], P[i][0] + o.seed || P[i][0], P[i][1], P[i][2], k);
    }
  }
  const C = { ashen: rgb('#6a7060'), ashenD: rgb('#474c40'), rag: rgb('#1d1a16'), crust: rgb('#b6b5a1'), teal: rgb('#6fd3bd'), stem: rgb('#c4d2c4'), hide: rgb('#55595e'), hideD: rgb('#34373b'), pit: rgb('#0a0a0c'), ink: rgb('#141210') };
  function capModel(out, M, x, y, z, r) { part(out, M, [x - 0.008, y - 0.008, z], [x + 0.008, y + 0.008, z + r * 1.1], C.stem); part(out, M, [x - r, y - r, z + r * 1.1], [x + r, y + r, z + r * 1.9], C.teal, { taper: [0.45, 0.45], k: 0.75 }); }
  // the walking bloom. `t` is the engine's clock; the sway and the step come from it.
  function bloomModel(out, root, t) {
    const sway = Math.sin(t * 1.3) * 0.07, step = Math.sin(t * 1.3) * 0.22;
    for (const sg of [-1, 1]) {
      const hip = chain(root, Tr(0, sg * 0.085, 0.50), Ry(-0.1 + sg * step));
      part(out, hip, [-0.048, -0.045, -0.24], [0.048, 0.045, 0.01], C.ashen, { taper: [1.15, 1.15] });
      const knee = chain(hip, Tr(0, 0, -0.24), Ry(0.22 + Math.max(0, -sg * step) * 0.8));
      part(out, knee, [-0.038, -0.038, -0.245], [0.038, 0.038, 0.0], C.ashenD, { taper: [1.2, 1.2] });
      part(out, chain(knee, Tr(0, 0, -0.245)), [-0.04, -0.04, -0.02], [0.11, 0.04, 0.02], C.ashenD);
    }
    const waist = chain(root, Tr(-0.02, 0, 0.5), Rx(sway));
    part(out, waist, [-0.075, -0.13, -0.04], [0.075, 0.13, 0.08], C.rag);
    for (let i = 0; i < 9; i++) { const yy = -0.13 + i * 0.03, len = 0.06 + hash(i, 0, 521) * 0.16; part(out, waist, [-0.08, yy, -0.04 - len], [0.08, yy + 0.022, -0.03], C.rag); }
    const torso = chain(waist, Tr(0, 0, 0.07), Ry(0.34));
    part(out, torso, [-0.07, -0.135, 0], [0.075, 0.135, 0.31], C.rag, { taper: [1.0, 1.2] });
    part(out, torso, [0.076, -0.07, 0.08], [0.082, 0.05, 0.2], C.crust, { seed: 3 });
    const head = chain(torso, Tr(0.03, 0.015, 0.31), Ry(0.5), Rx(0.28));
    part(out, head, [-0.035, -0.035, -0.02], [0.035, 0.035, 0.04], C.ashenD);
    part(out, head, [-0.065, -0.062, 0.03], [0.075, 0.062, 0.17], C.ashen, { taper: [0.86, 0.86] });
    part(out, head, [0.076, -0.063, 0.085], [0.084, 0.063, 0.15], C.crust, { seed: 5 });
    part(out, head, [0.076, -0.03, 0.045], [0.08, 0.03, 0.062], C.ink);
    for (const [cx, cy, r] of [[0.0, -0.02, 0.022], [0.03, 0.03, 0.018], [-0.03, 0.02, 0.026], [-0.04, -0.035, 0.016]]) capModel(out, head, cx, cy, 0.165, r);
    for (const sg of [-1, 1]) {
      const sh = chain(torso, Tr(0.0, sg * 0.165, 0.27), Ry(-0.75 + sg * 0.12 + sway), Rx(sg * 0.08));
      part(out, sh, [-0.036, -0.036, -0.22], [0.036, 0.036, 0.02], C.ashen);
      const el = chain(sh, Tr(0, 0, -0.22), Ry(-0.55));
      part(out, el, [-0.03, -0.03, -0.23], [0.03, 0.03, 0], C.ashenD);
      for (const d of [-1, 0, 1]) part(out, chain(el, Tr(0, d * 0.022, -0.23), Rx(d * 0.3), Ry(-0.3)), [-0.008, -0.008, -0.075], [0.008, 0.008, 0], C.ashen);
      for (const [cx, cy, r] of [[0, sg * 0.12, 0.024], [-0.03, sg * 0.15, 0.017], [0.03, sg * 0.09, 0.019]]) capModel(out, torso, cx, cy, 0.31, r);
    }
    for (const [cx, cy, cz, r] of [[-0.075, 0.04, 0.2, 0.02], [-0.075, -0.06, 0.12, 0.024]]) capModel(out, chain(torso, Tr(cx, cy, cz), Ry(-1.2)), 0, 0, 0, r);
  }
  // the blind quarry-troll, on its knuckles
  function trollModel(out, root, t) {
    const breath = Math.sin(t * 0.7) * 0.012;
    for (const sg of [-1, 1]) {
      const hip = chain(root, Tr(-0.12, sg * 0.2, 0.56), Ry(-0.25));
      part(out, hip, [-0.12, -0.115, -0.3], [0.12, 0.115, 0.04], C.hide, { taper: [1.15, 1.15], k: -0.6 });
      const knee = chain(hip, Tr(0, 0, -0.3), Ry(0.5));
      part(out, knee, [-0.1, -0.1, -0.27], [0.1, 0.1, 0.0], C.hideD, { taper: [1.15, 1.15] });
      part(out, chain(knee, Tr(0, 0, -0.27), Ry(-0.25)), [-0.11, -0.115, -0.05], [0.2, 0.115, 0.03], C.hideD);
    }
    const torso = chain(root, Tr(-0.16, 0, 0.56), Ry(0.82));
    part(out, torso, [-0.2, -0.33, -0.05], [0.24, 0.33, 0.66 + breath], C.hide, { taper: [1.1, 1.32], k: -1 });
    part(out, torso, [-0.27, -0.3, 0.24], [-0.15, 0.3, 0.63], C.hide, { taper: [0.75, 0.82], k: -1 });              // the hump of the back
    const head = chain(torso, Tr(0.2, 0, 0.6), Ry(-0.55));
    part(out, head, [-0.1, -0.13, -0.06], [0.2, 0.13, 0.17], C.hide, { taper: [0.8, 0.85], k: -0.8 });
    part(out, head, [0.14, -0.15, 0.09], [0.235, 0.15, 0.155], C.hide, { k: -1 });                                 // the brow
    part(out, head, [0.08, -0.105, -0.13], [0.2, 0.105, -0.05], C.hideD);                                         // the jaw
    for (const sg of [-1, 1]) {
      part(out, head, [0.201, sg * 0.03 + (sg < 0 ? -0.05 : 0), 0.035], [0.206, sg * 0.03 + (sg < 0 ? 0 : 0.05), 0.085], C.pit);   // a shallow pit where an eye would be
      part(out, chain(head, Tr(0.0, sg * 0.13, 0.06), Rx(-sg * 0.55)), [-0.12, -0.012, -0.16], [0.07, 0.012, 0.1], C.hideD, { taper: [0.7, 1] });   // an ear, folded
    }
    part(out, head, [0.201, -0.08, -0.052], [0.205, 0.08, -0.04], C.ink);
    for (const sg of [-1, 1]) {
      const sh = chain(torso, Tr(0.08, sg * 0.43, 0.56), Ry(-0.78), Rx(sg * 0.12));
      part(out, sh, [-0.115, -0.11, -0.4], [0.115, 0.11, 0.08], C.hide, { taper: [1.25, 1.25], k: -1 });
      const el = chain(sh, Tr(0, 0, -0.4), Ry(-0.12));
      part(out, el, [-0.13, -0.125, -0.4], [0.13, 0.125, 0.02], C.hide, { taper: [0.85, 0.85], k: -0.5 });
      part(out, chain(el, Tr(0.02, 0, -0.4)), [-0.15, -0.14, -0.2], [0.15, 0.14, 0.0], C.hideD, { k: -0.4 });      // the fist
    }
  }
  // stand a model on the ground: find how far its lowest point is from z = h and lift it
  // (the renderer's world is map cells across and height times R3D.ZK up; the models are built in heights, so the whole
  // thing is scaled by ZK: a body one height tall stands as tall as a painted person)
  const Sc = (k) => [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0];
  function grounded(fn, x, y, h, yaw, t) {
    const tmp = []; fn(tmp, Tr(0, 0, 0), 0); let lo = 1e9; for (let i = 2; i < tmp.length; i += 13) lo = Math.min(lo, tmp[i]);
    const ZK = (typeof R3D !== 'undefined' && R3D.ZK) || 1, out = []; fn(out, chain(Tr(x, y, h * ZK), Sc(ZK), Tr(0, 0, -lo), Rz(yaw)), t); return out;
  }

  const VS = `layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec3 aCol; layout(location=3) in vec4 aLoc;
out vec3 vPos; out vec3 vNrm; out vec3 vCol; out vec4 vLoc;
void main() { vPos = aPos; vNrm = aNrm; vCol = aCol; vLoc = aLoc; gl_Position = uViewProj * vec4(aPos, 1.0); }`;
  const FS = `in vec3 vPos; in vec3 vNrm; in vec3 vCol; in vec4 vLoc;
uniform vec4 uBSun; uniform vec3 uBSunC; uniform vec3 uBAmb; uniform vec3 uBFire;
layout(location=0) out vec4 oColor; layout(location=1) out vec4 oAux;
float bh(vec3 p) { p = fract(p * vec3(443.897, 441.423, 437.195)); p += dot(p, p.yzx + 19.19); return fract((p.x + p.y) * p.z); }
void main() {
  vec3 n = normalize(vNrm);
  float tex = bh(floor(vLoc.xyz * 44.0));                                   // a texel that stays on the body as it moves
  vec3 alb = vCol * (0.84 + 0.32 * tex);
  float lime = max(0.0, -vLoc.w) * smoothstep(0.2, 0.75, n.z + (tex - 0.5) * 0.7);
  alb = mix(alb, vec3(0.70, 0.69, 0.63) * (0.85 + 0.3 * tex), lime);
  vec3 lit = uBAmb * (0.62 + 0.38 * n.z) + uBSunC * max(dot(n, normalize(uBSun.xyz)), 0.0) * uBSun.w + uBFire * max(dot(n, normalize(vec3(-1.0, 0.0, -0.25))), 0.0);
  vec3 c = alb * lit;
  float glow = max(vLoc.w, 0.0);
  c = mix(c, vCol * 1.25, glow);
  float f = clamp(distance(vPos, uEye.xyz) * uFog.w, 0.0, 1.0); c = mix(c, uFog.rgb, f * f);
  ivec2 lp = ivec2(gl_FragCoord.xy / max(1.0, uUp.w));
  c += (float(r3dBayer(lp)) / 16.0 - 0.5) / 40.0;
  oColor = vec4(max(c, 0.0), 1.0); oAux = vec4(0.0, glow * 0.7, 0.0, 1.0);
}`;
  const GLS = { prog: null, vao: null, buf: null, failed: null }, things = [];
  const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const pass = {
    name: 'look-beasts', order: 32,
    init(gl) {
      try {
        GLS.prog = R3D.program(VS, FS, { chunks: ['common'] });
        GLS.vao = gl.createVertexArray(); GLS.buf = gl.createBuffer(); gl.bindVertexArray(GLS.vao); gl.bindBuffer(gl.ARRAY_BUFFER, GLS.buf);
        const S = 13 * 4; for (const [i, n, o] of [[0, 3, 0], [1, 3, 12], [2, 3, 24], [3, 4, 36]]) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, n, gl.FLOAT, false, S, o); }
        gl.bindVertexArray(null);
      } catch (e) { GLS.failed = String(e && e.message); }
    },
    enabled(F) { return things.length > 0 && !!GLS.prog && !GLS.failed && F.map && F.map.id === LEDGE1.LEDGE; },
    draw(gl, F) {
      const t = F.time || 0; let v = [];
      for (const b of things) v = v.concat(grounded(b.fn, b.x, b.y, LEDGE1.landH(b.x, b.y), b.yaw, b.still ? 0 : t));
      R3D.bindScene(gl, F); const u = R3D.use(GLS.prog).u;
      const tod = F.tod == null ? 0.5 : F.tod, f = SUN3.on() ? SUN3.face(G.day | 0, tod) : SUN3.face(0, 0.735), day = smooth(-0.06, 0.2, Math.cos((tod - 0.5) * Math.PI * 2));
      const ce = Math.cos(f.el), low = 1 - smooth(0.15, 0.5, f.el), k = day * (1 - f.dark * 0.6);
      gl.uniform4f(u.uBSun, Math.cos(f.az) * ce, Math.sin(f.az) * ce, Math.max(0.05, Math.sin(f.el)), day * f.shadows);
      gl.uniform3f(u.uBSunC, 1.0, 0.93 - 0.45 * low, 0.80 - 0.6 * low);
      gl.uniform3f(u.uBAmb, 0.07 + 0.42 * k, 0.08 + 0.40 * k, 0.11 + 0.36 * k);
      gl.uniform3f(u.uBFire, 0.62 * (0.45 + 0.55 * f.coal), 0.17 * (0.45 + 0.55 * f.coal), 0.05);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
      gl.bindVertexArray(GLS.vao); gl.bindBuffer(gl.ARRAY_BUFFER, GLS.buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, v.length / 13); gl.bindVertexArray(null);
    },
  };

  // ---------------------------------------------------------------- into the running game
  function install() {
    const P = { look_bloom: paintBloom(), look_troll: paintTroll() };
    for (const k in P) { const sp = P[k]; Engine.addSprite(k, { w: sp.w, h: sp.h, data: sp.data, hs: sp.hs, cx: sp.cx, dy: sp.dy }); if (sp.emit) Engine.setEmissive(k, sp.emit); }
    R3D.addPass(pass);
    return P;
  }
  // place(list): [{ kind: 'bloom' | 'troll', how: 'painted' | 'modelled', x, y, yaw }]
  function place(list) {
    things.length = 0; const m = G.maps[LEDGE1.LEDGE];
    m.entities = m.entities.filter((e) => !/^look_/.test(e.sprite || ''));
    for (const b of list) {
      if (b.how === 'painted') m.deco(b.kind === 'bloom' ? 'look_bloom' : 'look_troll', b.x, b.y, { solid: false, scale: 1 });
      else things.push({ fn: b.kind === 'bloom' ? bloomModel : trollModel, x: b.x, y: b.y, yaw: b.yaw == null ? 0 : b.yaw, still: !!b.still });
    }
  }
  const painted = install();
  return { place, painted, gl: () => GLS, count: () => things.length, tris: () => things.reduce((a, b) => a + grounded(b.fn, 0, 0, 0, 0, 0).length / 39, 0) };
})();
