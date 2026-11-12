// ============================================================
//  A LOOK TEST, not part of the game. The page does not load this file; tools/beastshots.js injects it.
//
//  The owner ruled (12 Nov): "ill go with modeled so long as we can make them look drastically better than they are
//  now". The painted beasts are deleted. This is the second pass at the modelled ones: bodies sculpted from rounded
//  limbs and masses in place of boxes, with smooth surfaces, hide and skin drawn on them in code, an ink outline like
//  the painted people's, banded pixel-art light, a rim of the land's fire, and a shadow on the ground.
//
//    the walking bloom   a body that still walks: caps along the shoulders and scalp, a crust over the eyes, a slow
//                        swaying shamble, clawing hands (the-smothering.md). 1.5 to 1.85 m.
//    the quarry-troll    blind, hunched (2.6 m), huge forearms and fists, short thick legs, two shallow pits under a
//                        heavy brow, wide folded ear flaps, a grey hide crusted with lime: at rest, an outcrop (bestiary.md).
//
//  Nothing here uses a random number or a clock of its own: shapes come from fixed hashes, movement from the engine's.
// ============================================================
'use strict';

const BEASTLOOK = (() => {
  const hash = ART2.kit.hash;
  // ---------------------------------------------------------------- transforms (3 x 4). x forward, y to the left, z up.
  const mul = (A, B) => { const o = new Array(12); for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) o[r * 4 + c] = A[r * 4] * B[c] + A[r * 4 + 1] * B[4 + c] + A[r * 4 + 2] * B[8 + c] + (c === 3 ? A[r * 4 + 3] : 0); return o; };
  const Tr = (x, y, z) => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z];
  const Sc = (k) => [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0];
  const Rx = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0]; };
  const Ry = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0]; };
  const Rz = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0]; };
  const chain = (...m) => m.reduce(mul);
  const ap = (M, p) => [M[0] * p[0] + M[1] * p[1] + M[2] * p[2] + M[3], M[4] * p[0] + M[5] * p[1] + M[6] * p[2] + M[7], M[8] * p[0] + M[9] * p[1] + M[10] * p[2] + M[11]];
  const ad = (M, d) => [M[0] * d[0] + M[1] * d[1] + M[2] * d[2], M[4] * d[0] + M[5] * d[1] + M[6] * d[2], M[8] * d[0] + M[9] * d[1] + M[10] * d[2]];
  const nrm = (v) => { const L = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / L, v[1] / L, v[2] / L]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

  // ---------------------------------------------------------------- the sculptor's kit
  // A vertex: position, normal, colour, its place on the body (for what is drawn on it), material, shade. 14 floats.
  const MAT = { skin: 0, hide: 1, rag: 2, cap: 3, ink: 4, crust: 5, stem: 6, nail: 7 };
  const STRIDE = 14;
  let seedN = 0, defMat = 0;       // the material a part gets when it names none: skin for the bloom, hide for the troll
  // push one triangle, wound so that it faces the way its normals point (so back faces can be culled and the ink hull drawn)
  function tri(out, a, b, c) {
    const fn = cross(sub(b.p, a.p), sub(c.p, a.p)), vn = [a.n[0] + b.n[0] + c.n[0], a.n[1] + b.n[1] + c.n[1], a.n[2] + b.n[2] + c.n[2]];
    const o = fn[0] * vn[0] + fn[1] * vn[1] + fn[2] * vn[2] >= 0 ? [a, b, c] : [a, c, b];
    for (const v of o) out.push(v.p[0], v.p[1], v.p[2], v.n[0], v.n[1], v.n[2], v.c[0], v.c[1], v.c[2], v.l[0], v.l[1], v.l[2], v.m, v.s);
  }
  const V = (M, p, n, o, l) => ({ p: ap(M, p), n: nrm(ad(M, n)), c: o.col, l: [l[0] + o.off, l[1] + o.off * 0.37, l[2] + o.off * 0.71], m: o.mat + (o.k || 0) * 0.5, s: o.shade == null ? 1 : o.shade });
  // a rounded mass: an ellipsoid at c with radii r. `squash` flattens its underside (a belly on the ground, a cap's gills).
  function blob(out, M, c, r, o) {
    o = Object.assign({ col: [0.5, 0.5, 0.5], mat: defMat, off: (seedN++) * 3.17 }, o); const NL = o.lat || 7, NO = o.lon || 10, ring = [];
    for (let i = 0; i <= NL; i++) {
      const th = Math.PI * i / NL, st = Math.sin(th), ct = Math.cos(th), row = [];
      for (let j = 0; j <= NO; j++) {
        const ph = Math.PI * 2 * j / NO, d = [st * Math.cos(ph), st * Math.sin(ph), ct], zz = o.squash != null && d[2] < 0 ? d[2] * o.squash : d[2];
        const p = [c[0] + d[0] * r[0], c[1] + d[1] * r[1], c[2] + zz * r[2]], n = [d[0] / r[0], d[1] / r[1], (o.squash != null && d[2] < 0 ? d[2] * 3 : d[2]) / r[2]];
        row.push(V(M, p, n, o, p));
      }
      ring.push(row);
    }
    for (let i = 0; i < NL; i++) for (let j = 0; j < NO; j++) { const a = ring[i][j], b = ring[i][j + 1], c2 = ring[i + 1][j + 1], d = ring[i + 1][j]; if (i > 0) tri(out, a, b, c2); if (i < NL - 1) tri(out, a, c2, d); }
  }
  // a limb: a tube through points [x, y, z, r] or [x, y, z, rSide, rOther], round or oval in section, closed at both ends
  function tube(out, M, pts, o) {
    o = Object.assign({ col: [0.5, 0.5, 0.5], mat: defMat, off: (seedN++) * 3.17, sides: 9, up: [0, 1, 0] }, o); const N = o.sides, rings = [], P = [];
    const first = pts[0], last = pts[pts.length - 1], d0 = nrm(sub(pts[1], first)), d1 = nrm(sub(last, pts[pts.length - 2]));
    // round the ends: a small ring just past each end
    P.push([first[0] - d0[0] * first[3] * 0.55, first[1] - d0[1] * first[3] * 0.55, first[2] - d0[2] * first[3] * 0.55, first[3] * 0.55, (first[4] || first[3]) * 0.55]);
    for (const q of pts) P.push(q);
    P.push([last[0] + d1[0] * last[3] * 0.55, last[1] + d1[1] * last[3] * 0.55, last[2] + d1[2] * last[3] * 0.55, last[3] * 0.55, (last[4] || last[3]) * 0.55]);
    for (let i = 0; i < P.length; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], t = nrm(sub(b, a));
      let s = cross(t, o.up); if (Math.hypot(s[0], s[1], s[2]) < 0.05) s = cross(t, [1, 0, 0]); s = nrm(s); const u = nrm(cross(s, t)), row = [], rs = P[i][3], ru = P[i][4] == null ? P[i][3] : P[i][4];
      for (let j = 0; j <= N; j++) {
        const an = Math.PI * 2 * j / N, cs = Math.cos(an), sn = Math.sin(an), p = [P[i][0] + (s[0] * cs * rs + u[0] * sn * ru), P[i][1] + (s[1] * cs * rs + u[1] * sn * ru), P[i][2] + (s[2] * cs * rs + u[2] * sn * ru)];
        const n = [s[0] * cs / rs + u[0] * sn / ru, s[1] * cs / rs + u[1] * sn / ru, s[2] * cs / rs + u[2] * sn / ru];
        const e = i === 0 ? -0.9 : i === P.length - 1 ? 0.9 : 0, nn = nrm(n);
        row.push(V(M, p, [nn[0] + t[0] * e, nn[1] + t[1] * e, nn[2] + t[2] * e], o, p));
      }
      rings.push(row);
    }
    for (let i = 0; i + 1 < rings.length; i++) for (let j = 0; j < N; j++) { const a = rings[i][j], b = rings[i][j + 1], c = rings[i + 1][j + 1], d = rings[i + 1][j]; tri(out, a, b, c); tri(out, a, c, d); }
    for (const [row, c, dn] of [[rings[0], P[0], [-d0[0], -d0[1], -d0[2]]], [rings[rings.length - 1], P[P.length - 1], d1]]) { const ctr = V(M, c, dn, o, c); for (let j = 0; j < N; j++) tri(out, ctr, row[j], row[j + 1]); }
  }
  // a corpse-cap: a pale stem, a dome that gives its own light, darker gills under it
  function cap(out, M, at, r, tilt) {
    const m = chain(M, Tr(at[0], at[1], at[2]), Rx(tilt[0]), Ry(tilt[1])), h = r * (1.1 + hash(seedN, 3, 601) * 0.9);
    tube(out, m, [[0, 0, -r * 0.3, r * 0.2], [0, 0, h, r * 0.16]], { col: C.stem, mat: MAT.stem, sides: 5 });
    blob(out, m, [0, 0, h], [r, r, r * 0.62], { col: C.teal, mat: MAT.cap, squash: 0.12, lat: 5, lon: 8 });
  }

  const C = {
    ashen: rgb('#7c8170'), ashenD: rgb('#565b4d'), rag: rgb('#221e19'), crust: rgb('#c2c0aa'), teal: rgb('#7fe3cb'), stem: rgb('#cdd8c6'),
    hide: rgb('#63676b'), hideD: rgb('#43464a'), ink: rgb('#08080a'), nail: rgb('#2a2622'), mouth: rgb('#1a0c0b'),
  };

  // ---------------------------------------------------------------- the walking bloom
  function bloomModel(out, root, t) {
    seedN = 100; defMat = MAT.skin;
    const w = t * 1.25, sway = Math.sin(w) * 0.06, step = Math.sin(w), bob = Math.abs(Math.cos(w)) * 0.012, loll = Math.sin(w * 0.5 + 1) * 0.12;
    const body = chain(root, Tr(0, 0, bob), Rx(sway * 0.6));
    // legs: thin, the knees never straight
    for (const sg of [-1, 1]) {
      const sw = sg * step * 0.3, hip = chain(body, Tr(0, sg * 0.082, 0.5), Ry(-0.12 + sw));
      tube(out, hip, [[0, 0, 0.02, 0.056, 0.062], [0.012, 0, -0.12, 0.05, 0.054], [0.02, 0, -0.235, 0.04]], { col: C.ashen, k: 0.5, shade: 0.9 });
      const knee = chain(hip, Tr(0.02, 0, -0.235), Ry(0.32 + Math.max(0, -sg * step) * 0.5));
      blob(out, knee, [0.012, 0, 0], [0.042, 0.04, 0.045], { col: C.ashenD });
      tube(out, knee, [[0, 0, 0, 0.038], [-0.012, 0, -0.11, 0.036, 0.032], [-0.006, 0, -0.225, 0.026]], { col: C.ashen, shade: 0.86 });
      const foot = chain(knee, Tr(-0.006, 0, -0.235), Ry(-0.2 - sw * 0.4));
      blob(out, foot, [0.045, 0, -0.012], [0.085, 0.042, 0.03], { col: C.ashenD, squash: 0.25, shade: 0.8 });
      for (let i = -1; i <= 1; i++) blob(out, foot, [0.125, i * 0.024, -0.02], [0.022, 0.014, 0.014], { col: C.ashen, lat: 4, lon: 6, squash: 0.3 });
    }
    // the hips and the rags that hang from them
    blob(out, body, [-0.005, 0, 0.515], [0.085, 0.125, 0.08], { col: C.rag, mat: MAT.rag });
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * Math.PI * 2 + 0.2, rx = 0.088, ry = 0.128, len = 0.07 + hash(i, 0, 611) * 0.2, fl = Math.sin(w + i) * 0.012, wd = 0.016 + hash(i, 1, 612) * 0.014;
      const x = Math.cos(a) * rx, y = Math.sin(a) * ry, ox = Math.cos(a) * 0.012, oy = Math.sin(a) * 0.012;
      tube(out, body, [[x, y, 0.5, wd, 0.005], [x + ox + fl, y + oy, 0.5 - len * 0.5, wd * 0.9, 0.004], [x + ox * 2.2 + fl * 2, y + oy * 2.2, 0.5 - len, wd * (0.25 + hash(i, 2, 613) * 0.6), 0.003]], { col: C.rag, mat: MAT.rag, sides: 5, up: [-Math.sin(a), Math.cos(a), 0] });
    }
    // the trunk: bent forward from the waist, ribs under what is left of a shirt
    const waist = chain(body, Tr(0, 0, 0.56), Ry(0.36), Rx(sway));
    tube(out, waist, [[0, 0, -0.03, 0.118, 0.07], [0.004, 0, 0.07, 0.108, 0.066], [0.012, 0, 0.17, 0.13, 0.082], [0.012, 0, 0.26, 0.15, 0.08], [0.004, 0, 0.305, 0.13, 0.058]], { col: C.ashen, k: 1, sides: 12, shade: 0.95 });
    for (const sg of [-1, 1]) blob(out, waist, [0.004, sg * 0.15, 0.285], [0.055, 0.055, 0.05], { col: C.ashen, k: 1 });        // the shoulders' points
    // the neck and the head, hung forward and lolling
    const neck = chain(waist, Tr(0.012, 0, 0.315), Ry(0.5), Rx(0.22 + loll));
    tube(out, neck, [[0, 0, -0.03, 0.036], [0.006, 0, 0.06, 0.03]], { col: C.ashenD, shade: 0.8 });
    const head = chain(neck, Tr(0.012, 0, 0.075), Ry(0.25));
    blob(out, head, [0.012, 0, 0.07], [0.086, 0.07, 0.09], { col: C.ashen, lat: 9, lon: 12 });
    blob(out, head, [0.062, 0, 0.012], [0.05, 0.05, 0.036], { col: C.ashenD });                                                    // the jaw, hanging
    blob(out, head, [0.088, 0, 0.034], [0.022, 0.034, 0.016], { col: C.mouth, mat: MAT.ink, lat: 4, lon: 6 });                     // the open mouth
    blob(out, head, [0.066, 0, 0.088], [0.04, 0.066, 0.036], { col: C.crust, mat: MAT.crust, lat: 6, lon: 10 });                   // the crust over the eyes
    blob(out, head, [0.094, 0, 0.058], [0.018, 0.016, 0.022], { col: C.ashenD, lat: 4, lon: 6 });                                  // what is left of a nose
    for (const [x, y, z, r, tx, ty] of [[0.0, -0.02, 0.15, 0.03, 0.2, -0.2], [0.04, 0.03, 0.14, 0.024, -0.3, 0.3], [-0.035, 0.03, 0.14, 0.034, -0.2, -0.5], [-0.05, -0.03, 0.115, 0.022, 0.4, -0.7], [0.02, 0.058, 0.1, 0.018, -0.9, 0.1], [-0.01, -0.062, 0.1, 0.02, 0.9, 0]]) cap(out, head, [x, y, z], r, [tx, ty]);
    // the arms: long, reaching, the hands open; the caps along the shoulders
    for (const sg of [-1, 1]) {
      const sh = chain(waist, Tr(0.004, sg * 0.158, 0.285), Ry(-0.95 + sg * step * 0.16 - sway), Rx(sg * 0.1));
      tube(out, sh, [[0, 0, 0.01, 0.04], [0.004, 0, -0.11, 0.036], [0, 0, -0.225, 0.029]], { col: C.ashen, k: 0.6, shade: 0.92 });
      const el = chain(sh, Tr(0, 0, -0.225), Ry(-0.5 - Math.max(0, sg * step) * 0.25));
      blob(out, el, [0, 0, 0], [0.032, 0.031, 0.034], { col: C.ashenD, lat: 5, lon: 7 });
      tube(out, el, [[0, 0, 0, 0.029], [0.002, 0, -0.12, 0.027, 0.024], [0, 0, -0.235, 0.02]], { col: C.ashen, shade: 0.9 });
      const hand = chain(el, Tr(0, 0, -0.24), Ry(-0.35));
      blob(out, hand, [0.004, 0, -0.03], [0.018, 0.032, 0.038], { col: C.ashenD, lat: 5, lon: 7 });
      for (let f = 0; f < 4; f++) { const fy = (f - 1.5) * 0.017, cr = 0.5 + f * 0.05, fm = chain(hand, Tr(0.004, fy, -0.06), Rx((f - 1.5) * 0.18), Ry(-cr)); tube(out, fm, [[0, 0, 0, 0.0085], [0, 0, -0.04, 0.0075], [0.012, 0, -0.072, 0.006], [0.03, 0, -0.092, 0.003]], { col: C.ashen, sides: 5 }); }
      tube(out, chain(hand, Tr(0.01, sg * 0.03, -0.03), Rx(sg * 0.9), Ry(-0.4)), [[0, 0, 0, 0.009], [0, 0, -0.035, 0.007], [0.01, 0, -0.055, 0.003]], { col: C.ashen, sides: 5 });
      for (const [x, y, z, r, tx, ty] of [[0.0, sg * 0.15, 0.33, 0.032, sg * -0.5, 0], [-0.03, sg * 0.105, 0.325, 0.024, sg * -0.2, -0.4], [0.03, sg * 0.1, 0.32, 0.02, sg * -0.2, 0.5], [-0.045, sg * 0.165, 0.29, 0.018, sg * -1.0, -0.5]]) cap(out, waist, [x, y, z], r, [tx, ty]);
    }
    for (const [x, y, z, r] of [[-0.085, 0.03, 0.22, 0.03], [-0.085, -0.05, 0.16, 0.036], [-0.08, 0.07, 0.12, 0.022], [-0.075, -0.01, 0.275, 0.024]]) cap(out, waist, [x, y, z], r, [0.2 * (y > 0 ? -1 : 1), -1.25]);   // down the back
    for (const [x, y, z, r] of [[0.03, 0.03, -0.13, 0.016], [0.028, -0.02, -0.19, 0.013]]) cap(out, chain(waist, Tr(0.004, -0.158, 0.285), Ry(-0.95)), [x, y, z], r, [0.5, 1.2]);                        // on one arm
  }

  // ---------------------------------------------------------------- the blind quarry-troll, on its knuckles
  function trollModel(out, root, t) {
    seedN = 500; defMat = MAT.hide;
    const br = Math.sin(t * 0.8), turn = Math.sin(t * 0.33) * 0.35, shift = Math.sin(t * 0.4) * 0.02;
    const body = chain(root, Tr(0, shift, 0));
    for (const sg of [-1, 1]) {                                                              // the legs: short, bowed, thick
      const hip = chain(body, Tr(-0.16, sg * 0.2, 0.52), Rx(sg * -0.1));
      tube(out, hip, [[0, 0, 0.04, 0.15, 0.16], [0.07, sg * 0.03, -0.12, 0.14, 0.15], [0.13, sg * 0.04, -0.26, 0.115]], { col: C.hide, k: 0.5, sides: 11, shade: 0.85 });
      blob(out, hip, [0.15, sg * 0.04, -0.26], [0.12, 0.12, 0.11], { col: C.hideD, k: 0.3 });
      tube(out, hip, [[0.13, sg * 0.04, -0.26, 0.11], [0.08, sg * 0.04, -0.37, 0.1], [0.05, sg * 0.04, -0.46, 0.085]], { col: C.hide, sides: 11, shade: 0.8 });
      blob(out, hip, [0.11, sg * 0.045, -0.475], [0.17, 0.115, 0.055], { col: C.hideD, squash: 0.2, shade: 0.75 });
      for (let i = -1; i <= 1; i++) blob(out, hip, [0.265, sg * 0.045 + i * 0.06, -0.49], [0.05, 0.034, 0.034], { col: C.nail, mat: MAT.nail, lat: 5, lon: 7, squash: 0.3 });
    }
    // the trunk: a barrel carried almost level, a belly under it, the great hump of the back above
    blob(out, body, [-0.18, 0, 0.56], [0.22, 0.27, 0.2], { col: C.hide, k: 0.6, lat: 9, lon: 13 });
    blob(out, body, [0.04, 0, 0.6], [0.27, 0.3, 0.22], { col: C.hideD, lat: 9, lon: 13, shade: 0.85 });
    const chest = chain(body, Tr(0.22, 0, 0.82), Ry(0.5));
    blob(out, chest, [0, 0, 0], [0.3 + br * 0.006, 0.39, 0.3 + br * 0.008], { col: C.hide, k: 1, lat: 10, lon: 14 });
    blob(out, chest, [-0.2, 0, 0.14], [0.27, 0.3, 0.17], { col: C.hide, k: 1, lat: 8, lon: 12 });                                    // the hump
    for (let i = 0; i < 7; i++) { const a = -0.55 + i * 0.2 + hash(i, 0, 621) * 0.08, yy = (hash(i, 1, 622) - 0.5) * 0.34; blob(out, chest, [-0.2 - Math.sin(a) * 0.26, yy, 0.14 + Math.cos(a) * 0.17], [0.07 + hash(i, 2, 623) * 0.05, 0.08 + hash(i, 3, 624) * 0.05, 0.035], { col: C.crust, mat: MAT.crust, lat: 5, lon: 8 }); }   // slabs of lime on it
    for (const sg of [-1, 1]) blob(out, chest, [0.06, sg * 0.37, 0.12], [0.2, 0.19, 0.19], { col: C.hide, k: 1, lat: 8, lon: 11 }); // the shoulders
    // the head: low, thrust forward, turning to listen
    const head = chain(chest, Tr(0.3, 0, 0.02), Ry(-0.42), Rz(turn));
    tube(out, head, [[-0.12, 0, 0.0, 0.2, 0.16], [0.02, 0, 0.0, 0.15, 0.13]], { col: C.hideD, sides: 11, shade: 0.8 });                // the neck
    blob(out, head, [0.1, 0, 0.03], [0.17, 0.155, 0.15], { col: C.hide, k: 0.7, lat: 10, lon: 14 });                                   // the skull
    tube(out, head, [[0.2, -0.135, 0.075, 0.042, 0.05], [0.235, -0.05, 0.085, 0.05, 0.056], [0.235, 0.05, 0.085, 0.05, 0.056], [0.2, 0.135, 0.075, 0.042, 0.05]], { col: C.hide, k: 1, sides: 8, up: [0, 0, 1] });   // the brow
    for (const sg of [-1, 1]) {
      blob(out, head, [0.238, sg * 0.062, 0.028], [0.022, 0.04, 0.026], { col: C.ink, mat: MAT.ink, lat: 5, lon: 8 });                 // a shallow pit where an eye would be
      // an ear: a wide flap, folded back on itself
      const ear = chain(head, Tr(0.04, sg * 0.15, 0.05), Rx(sg * -0.45), Rz(sg * 0.35));
      blob(out, ear, [-0.02, sg * 0.03, 0.01], [0.13, 0.022, 0.15], { col: C.hideD, lat: 7, lon: 10, shade: 0.9 });
      blob(out, ear, [0.0, sg * 0.05, 0.02], [0.08, 0.014, 0.1], { col: C.mouth, mat: MAT.ink, lat: 6, lon: 8 });
      blob(out, head, [0.275, sg * 0.03, -0.012], [0.012, 0.016, 0.012], { col: C.ink, mat: MAT.ink, lat: 4, lon: 6 });                // a nostril
    }
    blob(out, head, [0.2, 0, -0.035], [0.105, 0.115, 0.07], { col: C.hide, lat: 7, lon: 11 });                                         // the muzzle
    blob(out, head, [0.19, 0, -0.105], [0.115, 0.125, 0.055], { col: C.hideD, lat: 7, lon: 11, shade: 0.85 });                         // the lower jaw, thrust out past it
    tube(out, head, [[0.262, -0.09, -0.07, 0.014], [0.292, 0, -0.068, 0.014], [0.262, 0.09, -0.07, 0.014]], { col: C.ink, mat: MAT.ink, sides: 5, up: [0, 0, 1] });   // the mouth, shut
    for (const sg of [-1, 1]) tube(out, head, [[0.25, sg * 0.07, -0.085, 0.02], [0.268, sg * 0.074, -0.035, 0.012], [0.27, sg * 0.074, -0.01, 0.004]], { col: C.crust, mat: MAT.nail, sides: 6 });   // a tusk either side
    // the arms: longer than the legs, the forearms thicker than the upper, the fists on the ground
    for (const sg of [-1, 1]) {
      const sh = chain(chest, Tr(0.08, sg * 0.43, 0.08), Ry(-0.5), Rx(sg * 0.12));
      tube(out, sh, [[0, 0, 0.04, 0.16], [0.03, sg * 0.03, -0.17, 0.15, 0.14], [0.04, sg * 0.04, -0.37, 0.125]], { col: C.hide, k: 0.9, sides: 11 });
      const el = chain(sh, Tr(0.04, sg * 0.04, -0.38), Ry(-0.42), Rx(sg * -0.1));
      blob(out, el, [0, 0, 0], [0.135, 0.135, 0.13], { col: C.hideD, k: 0.4 });
      tube(out, el, [[0, 0, 0, 0.13], [0.02, 0, -0.16, 0.165, 0.15], [0.01, 0, -0.33, 0.14, 0.13], [0, 0, -0.42, 0.115]], { col: C.hide, k: 0.5, sides: 11, shade: 0.92 });
      const fist = chain(el, Tr(0, 0, -0.46), Ry(0.92));
      blob(out, fist, [0.05, 0, -0.02], [0.17, 0.155, 0.125], { col: C.hideD, lat: 8, lon: 11, squash: 0.45, shade: 0.85 });
      for (let f = 0; f < 4; f++) blob(out, fist, [0.17, (f - 1.5) * 0.075, -0.06], [0.07, 0.042, 0.06], { col: C.hide, lat: 5, lon: 8, squash: 0.4 });   // the knuckles
      blob(out, fist, [0.06, sg * -0.15, -0.04], [0.09, 0.05, 0.055], { col: C.hide, lat: 5, lon: 8 });                                                 // the thumb
    }
  }

  // stand a body on the ground: build it once at rest to find its lowest point, then lift it by that much.
  // (The renderer's world is map cells across and height times R3D.ZK up; the bodies are sculpted in heights.)
  const low = new Map();
  function build(fn, x, y, h, yaw, t) {
    if (!low.has(fn)) { const tmp = []; fn(tmp, Tr(0, 0, 0), 0); let lo = 1e9; for (let i = 2; i < tmp.length; i += STRIDE) lo = Math.min(lo, tmp[i]); low.set(fn, lo); }
    const ZK = (typeof R3D !== 'undefined' && R3D.ZK) || 1, out = []; fn(out, chain(Tr(x, y, h * ZK), Sc(ZK), Tr(0, 0, -low.get(fn)), Rz(yaw)), t); return out;
  }
  // its shadow: a soft dark oval on the ground under it
  function shadow(out, x, y, h, rx, ry, yaw) {
    const ZK = (typeof R3D !== 'undefined' && R3D.ZK) || 1, z = h * ZK + 0.012, c = Math.cos(yaw), s = Math.sin(yaw), N = 16;
    for (let j = 0; j < N; j++) {
      const a0 = Math.PI * 2 * j / N, a1 = Math.PI * 2 * (j + 1) / N, P = (a) => { const lx = Math.cos(a) * rx, ly = Math.sin(a) * ry; return [x + lx * c - ly * s, y + lx * s + ly * c, z]; };
      const p0 = P(a0), p1 = P(a1);
      out.push(x, y, z, 0, 0, 1, 0, 0, 0, 0, 0, 0, 9, 1, p0[0], p0[1], p0[2], 0, 0, 1, 0, 0, 0, 0, 0, 0, 9, 0, p1[0], p1[1], p1[2], 0, 0, 1, 0, 0, 0, 0, 0, 0, 9, 0);
    }
  }

  // ---------------------------------------------------------------- how it is drawn
  const VS = `layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec3 aCol; layout(location=3) in vec3 aLoc; layout(location=4) in vec2 aMS;
uniform float uGrow;
out vec3 vPos; out vec3 vNrm; out vec3 vCol; out vec3 vLoc; out vec2 vMS;
void main() { vec3 p = aPos + normalize(aNrm) * uGrow; vPos = p; vNrm = aNrm; vCol = aCol; vLoc = aLoc; vMS = aMS; gl_Position = uViewProj * vec4(p, 1.0); }`;
  const FS = `in vec3 vPos; in vec3 vNrm; in vec3 vCol; in vec3 vLoc; in vec2 vMS;
uniform vec4 uBSun; uniform vec3 uBSunC; uniform vec3 uBAmb; uniform vec3 uBFire; uniform float uInk;
layout(location=0) out vec4 oColor; layout(location=1) out vec4 oAux;
float h1(vec3 p) { p = fract(p * vec3(443.897, 441.423, 437.195)); p += dot(p, p.yzx + 19.19); return fract((p.x + p.y) * p.z); }
vec3 h3(vec3 p) { return vec3(h1(p), h1(p + 17.3), h1(p + 41.7)); }
float vn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h1(i), h1(i + vec3(1, 0, 0)), f.x), mix(h1(i + vec3(0, 1, 0)), h1(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(h1(i + vec3(0, 0, 1)), h1(i + vec3(1, 0, 1)), f.x), mix(h1(i + vec3(0, 1, 1)), h1(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
// plates: x = how near the edge of a plate (0 at a crack), y = a number for the plate
vec2 plates(vec3 p) { vec3 i = floor(p), f = fract(p); float d1 = 9.0, d2 = 9.0, id = 0.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec3 g = vec3(float(x), float(y), float(z)); vec3 o = h3(i + g); float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; id = h1(i + g + 3.1); } else if (d < d2) d2 = d; }
  return vec2(d2 - d1, id); }
void main() {
  ivec2 lp = ivec2(gl_FragCoord.xy / max(1.0, uUp.w)); float bay = float(r3dBayer(lp)) / 16.0;
  float dist = distance(vPos, uEye.xyz), fog = clamp(dist * uFog.w, 0.0, 1.0); fog *= fog;
  float mat = floor(vMS.x + 0.01), k = clamp((vMS.x - mat) * 2.0, 0.0, 1.0);
  if (mat > 8.5) {                                                    // the shadow on the ground
    float a = vMS.y * vMS.y * 0.62 * (1.0 - fog); if (a < bay * 0.3) discard; oColor = vec4(0.0, 0.0, 0.0, a); oAux = vec4(0.0); return; }
  if (uInk > 0.5) { oColor = vec4(mix(vec3(0.025, 0.022, 0.024), uFog.rgb, fog), 1.0); oAux = vec4(0.0, 0.0, 0.0, 1.0); return; }   // the outline
  vec3 n = normalize(vNrm), v = normalize(uEye.xyz - vPos);
  vec3 tp = floor(vLoc * 56.0);                                       // one texel of what is drawn on the body
  float tex = h1(tp), soft = vn(vLoc * 9.0), fine = vn(vLoc * 26.0);
  vec3 alb = vCol; float glow = 0.0, rough = 0.5;
  if (mat < 0.5) {                                                    // dead skin: mottled, veined, crusted in patches; k: how much shirt is left on it
    alb *= 0.78 + 0.3 * soft + 0.14 * (tex - 0.5);
    float vein = smoothstep(0.035, 0.0, abs(vn(vLoc * 13.0 + 5.0) - 0.5)); alb = mix(alb, vec3(0.20, 0.23, 0.21), vein * 0.5);
    vec2 pl = plates(vLoc * 30.0); float cr = step(0.62, pl.y + (soft - 0.5) * 0.5) * smoothstep(0.02, 0.07, pl.x);
    alb = mix(alb, vec3(0.74, 0.73, 0.64) * (0.85 + 0.3 * tex), cr * 0.85);
    float cloth = step(0.47, vn(vLoc * 7.0 + 11.0) + (fine - 0.5) * 0.25) * step(0.01, k) * step(0.45 - k * 0.3, vn(vLoc * 3.1 + 2.0));
    alb = mix(alb, vec3(0.115, 0.10, 0.085) * (0.8 + 0.5 * tex), cloth); rough = mix(rough, 0.9, cloth);
  } else if (mat < 1.5) {                                             // the troll's hide: cracked into plates like dry clay; lime on what faces up
    vec2 pl = plates(vLoc * 9.0);
    alb *= 0.74 + 0.22 * pl.y + 0.2 * soft + 0.12 * (tex - 0.5);
    alb *= mix(0.42, 1.0, smoothstep(0.0, 0.085, pl.x));
    float up = smoothstep(0.15, 0.7, n.z + (fine - 0.5) * 0.5 + (pl.y - 0.5) * 0.5) * k;
    alb = mix(alb, vec3(0.74, 0.73, 0.67) * (0.8 + 0.3 * tex) * mix(0.75, 1.0, smoothstep(0.0, 0.05, pl.x)), up * 0.9); rough = 0.8;
  } else if (mat < 2.5) { alb *= 0.7 + 0.6 * fine * tex + 0.2 * soft; rough = 0.95; }   // rag
  else if (mat < 3.5) {                                               // a cap: it gives its own light; darker gills under it
    float under = smoothstep(0.1, -0.5, n.z); alb = mix(vCol * (0.8 + 0.3 * fine), vec3(0.10, 0.30, 0.27), under); glow = mix(0.85, 0.25, under); }
  else if (mat < 4.5) { alb = vCol; rough = 1.0; }                    // a pit, a mouth
  else if (mat < 5.5) { vec2 pl = plates(vLoc * 22.0); alb *= (0.72 + 0.4 * pl.y) * mix(0.5, 1.0, smoothstep(0.0, 0.09, pl.x)); rough = 0.85; }   // crust and lime
  else if (mat < 6.5) { alb *= 0.85 + 0.2 * tex; glow = 0.12; }       // a stem
  else { alb *= 0.8 + 0.3 * tex; rough = 0.4; }                       // nail, tusk
  // a little of the texel in the surface itself, so light catches it
  n = normalize(n + (h3(tp) - 0.5) * 0.12 * rough);
  float ndl = max(dot(n, normalize(uBSun.xyz)), 0.0), hemi = 0.62 + 0.38 * n.z;
  float ground = smoothstep(0.0, 0.5, vPos.z - uBSun.w);              // darker toward the ground it stands on
  vec3 fireDir = normalize(vec3(-1.0, 0.0, 0.12));
  float rim = pow(1.0 - max(dot(n, v), 0.0), 2.2) * smoothstep(-0.65, 0.3, dot(n, fireDir));
  vec3 lit = uBAmb * hemi * mix(0.5, 1.0, ground) * vMS.y + uBSunC * ndl + uBFire * (max(dot(n, fireDir), 0.0) * 0.55 + rim * 2.3);
  // banded, as a painted thing is: a few steps of light, dithered between
  // (the steps are even to the eye, not to the meter: taken on the root of the light, so the dark end keeps its shape)
  float l = max(lit.r, max(lit.g, lit.b)), r = sqrt(l), q = (floor(r * 6.0 + bay * 0.9) + 0.55) / 6.0; lit *= l > 0.0005 ? (q * q) / l : 0.0;
  vec3 c = alb * lit;
  c = mix(c, vCol * 1.35, glow);
  c = mix(c, uFog.rgb, fog);
  oColor = vec4(max(c, 0.0), 1.0); oAux = vec4(0.0, glow * 0.8, 0.0, 1.0);
}`;
  const GLS = { prog: null, vao: null, buf: null, failed: null, tris: 0 }, things = [];
  const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const KINDS = { bloom: { fn: bloomModel, sh: [0.27, 0.23] }, troll: { fn: trollModel, sh: [0.78, 0.6] } };
  const pass = {
    name: 'look-beasts', order: 32,
    init(gl) {
      try {
        GLS.prog = R3D.program(VS, FS, { chunks: ['common'] });
        GLS.vao = gl.createVertexArray(); GLS.buf = gl.createBuffer(); gl.bindVertexArray(GLS.vao); gl.bindBuffer(gl.ARRAY_BUFFER, GLS.buf);
        const S = STRIDE * 4; for (const [i, n, o] of [[0, 3, 0], [1, 3, 12], [2, 3, 24], [3, 3, 36], [4, 2, 48]]) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, n, gl.FLOAT, false, S, o); }
        gl.bindVertexArray(null);
      } catch (e) { GLS.failed = String(e && e.message); }
    },
    enabled(F) { return things.length > 0 && !!GLS.prog && !GLS.failed && F.map && F.map.id === LEDGE1.LEDGE; },
    draw(gl, F) {
      const t = F.time || 0, ZK = R3D.ZK; let sh = [], v = [], zmin = 1e9;
      for (const b of things) { const h = LEDGE1.landH(b.x, b.y), K = KINDS[b.kind]; shadow(sh, b.x + 0.04, b.y, h, K.sh[0], K.sh[1], b.yaw); v = v.concat(build(K.fn, b.x, b.y, h, b.yaw, b.still ? 0 : t)); zmin = Math.min(zmin, h * ZK); }
      const ns = sh.length / STRIDE, data = new Float32Array(sh.concat(v));
      R3D.bindScene(gl, F); const u = R3D.use(GLS.prog).u;
      const tod = F.tod == null ? 0.5 : F.tod, f = SUN3.on() ? SUN3.face(G.day | 0, tod) : SUN3.face(0, 0.735), day = smooth(-0.06, 0.2, Math.cos((tod - 0.5) * Math.PI * 2));
      const ce = Math.cos(f.el), lowSun = 1 - smooth(0.15, 0.5, f.el), k = day * (1 - f.dark * 0.6), sk = day * f.shadows;
      gl.uniform4f(u.uBSun, Math.cos(f.az) * ce, Math.sin(f.az) * ce, Math.max(0.08, Math.sin(f.el)), zmin);
      gl.uniform3f(u.uBSunC, 1.0 * sk, (0.93 - 0.45 * lowSun) * sk, (0.80 - 0.6 * lowSun) * sk);
      gl.uniform3f(u.uBAmb, 0.10 + 0.50 * k, 0.11 + 0.48 * k, 0.15 + 0.44 * k);
      const fk = 0.16 + 0.84 * f.coal * (1 - 0.6 * smooth(0.2, 0.6, f.el)); gl.uniform3f(u.uBFire, 0.95 * fk, 0.24 * fk, 0.06 * fk);
      gl.bindVertexArray(GLS.vao); gl.bindBuffer(gl.ARRAY_BUFFER, GLS.buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      // the shadows, laid on the ground
      gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
      gl.uniform1f(u.uInk, 0); gl.uniform1f(u.uGrow, 0); gl.drawArrays(gl.TRIANGLES, 0, ns);
      // the ink: the body a little larger, inside out, so only its edge shows
      gl.disable(gl.BLEND); gl.depthMask(true); gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT);
      gl.uniform1f(u.uInk, 1); gl.uniform1f(u.uGrow, 0.0075); gl.drawArrays(gl.TRIANGLES, ns, data.length / STRIDE - ns);
      // the body
      gl.cullFace(gl.BACK); gl.uniform1f(u.uInk, 0); gl.uniform1f(u.uGrow, 0); gl.drawArrays(gl.TRIANGLES, ns, data.length / STRIDE - ns);
      gl.disable(gl.CULL_FACE); gl.bindVertexArray(null); GLS.tris = (data.length / STRIDE - ns) / 3;
    },
  };

  // place(list): [{ kind: 'bloom' | 'troll', x, y, yaw, still }]
  function place(list) { things.length = 0; for (const b of list) if (KINDS[b.kind]) things.push({ kind: b.kind, x: b.x, y: b.y, yaw: b.yaw == null ? 0 : b.yaw, still: !!b.still }); }
  R3D.addPass(pass);
  const count = (fn) => { const o = []; fn(o, Tr(0, 0, 0), 0); return o.length / STRIDE / 3; };
  return { place, gl: () => GLS, count: () => things.length, tris: () => ({ bloom: count(bloomModel), troll: count(trollModel) }) };
})();
