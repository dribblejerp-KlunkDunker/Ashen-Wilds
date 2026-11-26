// ============================================================
//  troll44 - Phase 44, the blind quarry-troll. The first beast of the highland edge's hunts.
//
//  WHAT IT IS (docs/worldbuilding/bestiary.md, "The Blind Quarry-Troll"; act-one-the-outskirts.md, "The Old Quarry";
//  rooks-stair-quarry-supplement.md, its counterplay; searched before anything was invented):
//    "A blind thing of the quarries that hunts by sound alone. Stand still and it cannot find you, even at arm's length.
//     Make a noise and it comes to where the noise was and brings both fists down on that spot."
//    Height 2.6 m hunched, 1.6 m across the shoulders; a lumber of 2.2 to 3.2 m/s. Sight: none. Hearing: acute (a walk
//    carries 6 m, a sprint 14 m, a blade on stone 16 m; through stone about half). After a sound it remembers about six
//    seconds, then forgets and goes home. It hears companions as well as you. A thrown stone draws it. At the end of the
//    turn before the pound it plants its feet and raises its fists; whoever leaves the place is not hit (the supplement).
//
//  WHERE: Z1's two hunts of it (atlas/10-zones.md): "Quarry-troll ground" (1200, 1060) and "Quarry-troll on the high
//  ground" (1230, 500). One troll keeps each, on the open map (js/open42.js).
//
//  HOW IT HUNTS (think(), pure: test/troll44.test.js runs it without a browser)
//    At home it sits still and looks like an outcrop. A sound it can hear turns it; it lumbers to where the sound WAS;
//    there it plants its feet and raises its fists, and a second later brings them down on that spot. Anyone within two
//    cells of the spot is struck; whoever has crept out of the ring is not. Then it listens six seconds, and goes home.
//    A new, louder sound while it walks sends it there instead; once its fists are up, nothing does.
//
//  HOW IT IS DRAWN: the look test's sculpted troll (tools/look/beasts.js, approved 12 Nov under O9), built once and
//  moved by fifteen bones on the graphics card, as the walking bloom is. Off ("Modelled bodies"), and in the classic
//  renderer, a flat painted figure. Its pounds leave rings of shattered stone.
//
//  The switch (Options) "The quarry-trolls": off, no troll is on the highland edge, exactly as before this phase.
//
//  Plain ASCII. No random number: where it goes and how it moves follow from the state alone.
// ============================================================
'use strict';

const TROLL44 = (() => {
  const K = typeof ART2 !== 'undefined' ? ART2.kit : (typeof require !== 'undefined' ? require('./art2.js').kit : null);
  const HR = typeof HEARING19 !== 'undefined' ? HEARING19 : (typeof require !== 'undefined' ? require('./hearing19.js') : null);
  const S3 = typeof SUN3 !== 'undefined' ? SUN3 : (typeof require !== 'undefined' ? require('./sun3.js') : null);
  const hash = K.hash, clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // ---------------------------------------------------------------- the rules
  // Metres are cells of walking (P33), as the walking bloom's are.
  const R = {
    speed: 2.4,              // a lumber of 2.2 to 3.2 m/s (bestiary); the low end, it is not hungry here
    turn: 0.7,               // seconds it listens, turning, before it goes
    arrive: 1.3,             // how near the spot it stops to pound: its fists reach that far in front of it
    raise: 1.0,              // seconds its fists are up: the warning, and the time to step out of the ring
    slam: 0.55,              // seconds of the blow and its recovery
    ring: 2.0,               // the blow strikes everyone within this of the spot (the supplement's 2 m)
    pound: 60,               // [PROPOSED] the blow, on the cards' 100 scale
    memory: 6,               // it remembers a sound about six seconds (bestiary)
    giveUp: 25,              // a spot it cannot reach: it stops and listens
    radius: 0.8,             // 1.6 m across the shoulders, a little narrower at the ground
    size: 1.25,              // the look test's sculpt, made 2.6 m hunched beside the walking bloom's 1.78
    stride: 2.2,
    still: 0.08,             // moving less than this many cells a second is standing still
  };
  // How far a sound carries to it: the company's hearing table (js/hearing19.js), but standing still is not heard at all
  // ("even at arm's length"), and stone between halves it.
  function reachOf(noise, moving) {
    if (!moving) return 0;
    return HR.heardAt(noise);
  }
  // The sound it goes to: of those it hears, the one heard best (reach past distance), then the nearest (the supplement).
  // sounds: [{ x, y, reach, through }]; through: how much of the way is through stone (0 or 1)
  function pick(S, sounds) {
    let best = null, bm = -1e9;
    for (const s of sounds || []) {
      const d = Math.hypot(s.x - S.x, s.y - S.y), reach = s.reach * (s.through ? 0.5 : 1);
      if (reach <= 0 || d > reach) continue;
      const m = reach - d * 0.001;
      if (m > bm) { bm = m; best = s; }
    }
    return best;
  }
  const fresh = (home) => ({ x: home.x, y: home.y, yaw: home.yaw || 0, home: { x: home.x, y: home.y, yaw: home.yaw || 0 }, state: 'rest', t: 0, tx: home.x, ty: home.y, phase: 0, walk: 0, raise: 0, slam: 0, alert: 0, crouch: 1, look: 0, heard: 0, pounds: 0, hits: 0 });
  // One step. env: { sounds, px, py, here, blocked(x, y), ground(x, y) }. Returns { heard, pound: {x, y} | null, hit }.
  function think(S, env, dt) {
    const ev = { heard: false, pound: null, hit: false };
    const face = (x, y, rate) => { let a = Math.atan2(y - S.y, x - S.x) - S.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); const m = rate * dt; S.yaw += clamp(a, -m, m); return Math.abs(a); };
    const go = (state) => { S.state = state; S.t = 0; };
    S.t += dt;
    // a sound it hears: before its fists are up, it turns to it
    const s = S.state === 'raise' || S.state === 'slam' ? null : pick(S, env.sounds);
    if (s) {
      S.tx = s.x; S.ty = s.y;
      if (S.state === 'rest' || S.state === 'home' || S.state === 'listen') { go('turn'); ev.heard = true; S.heard++; }
    }
    let moveTo = null;
    if (S.state === 'rest') { face(S.x + Math.cos(S.home.yaw), S.y + Math.sin(S.home.yaw), 0.4); }
    else if (S.state === 'turn') { face(S.tx, S.ty, 1.6); if (S.t >= R.turn) go('go'); }
    else if (S.state === 'go') {
      if (Math.hypot(S.tx - S.x, S.ty - S.y) < R.arrive) go('raise');
      else if (S.t > R.giveUp) go('listen');
      else moveTo = [S.tx, S.ty];
    } else if (S.state === 'raise') {
      face(S.tx, S.ty, 1.2);
      if (S.t >= R.raise) {
        go('slam'); S.pounds++;
        // the blow falls a little in front of it, on the spot, whoever is there
        ev.pound = { x: S.tx, y: S.ty };
        if (env.here && Math.hypot(env.px - S.tx, env.py - S.ty) <= R.ring) { ev.hit = true; S.hits++; }
      }
    } else if (S.state === 'slam') { if (S.t >= R.slam) go('listen'); }
    else if (S.state === 'listen') { if (S.t >= R.memory) go('home'); }
    else if (S.state === 'home') {
      if (Math.hypot(S.home.x - S.x, S.home.y - S.y) < 0.4) go('rest');
      else if (S.t > R.giveUp * 3) { S.x = S.home.x; S.y = S.home.y; go('rest'); }
      else moveTo = [S.home.x, S.home.y];
    }
    let moved = 0;
    if (moveTo) {
      const off = face(moveTo[0], moveTo[1], 1.8), sp = R.speed * (off > 1.0 ? 0.2 : 1) * dt, vx = Math.cos(S.yaw) * sp, vy = Math.sin(S.yaw) * sp;
      const ok = (x, y) => !env.blocked(x, y) && Math.abs(env.ground(x, y) - env.ground(S.x, S.y)) < 0.5 && !(env.here && Math.hypot(env.px - x, env.py - y) < R.radius + 0.25);
      // straight on if it can; else half a turn either side; else along whichever axis is open
      const rot = (a) => [Math.cos(S.yaw + a) * sp, Math.sin(S.yaw + a) * sp];
      const tries = [[vx, vy], rot(0.8), rot(-0.8), [Math.sign(moveTo[0] - S.x) * sp, 0], [0, Math.sign(moveTo[1] - S.y) * sp]];
      for (const [mx, my] of tries) if ((mx || my) && ok(S.x + mx, S.y + my)) { S.x += mx; S.y += my; moved = Math.hypot(mx, my); break; }
      // a way it cannot get along: after two seconds stuck it stops and listens
      S.stuck = moved ? 0 : (S.stuck || 0) + dt;
      if (S.stuck > 2 && S.state === 'go') { S.stuck = 0; S.state = 'listen'; S.t = 0; }
    }
    // the body: its gait keeps time with the ground covered; the fists go up and come down; at rest it is still
    S.phase += moved * R.stride;
    const k = Math.min(1, dt * 4);
    S.walk += ((moved > 0 ? 1 : 0) - S.walk) * k;
    S.raise += ((S.state === 'raise' ? 1 : 0) - S.raise) * Math.min(1, dt * (S.state === 'raise' ? 4 : 14));
    S.slam += ((S.state === 'slam' && S.t < 0.25 ? 1 : 0) - S.slam) * Math.min(1, dt * 16);
    S.alert += ((S.state === 'rest' ? 0 : 1) - S.alert) * Math.min(1, dt * 2);
    S.crouch = S.state === 'rest' ? Math.min(1, (S.crouch || 0) + dt * 0.5) : Math.max(0, (S.crouch || 0) - dt * 3);
    S.look = S.state === 'listen' || S.state === 'turn' ? Math.sin(S.t * 1.7) * 0.5 : S.look * (1 - k);
    return ev;
  }

  // ---------------------------------------------------------------- the words (plain ASCII; [PROPOSED] in ROADMAP.md)
  const TX = {
    still: 'An outcrop, grey with lime dust.',
    name: 'The blind quarry-troll',
    hunting: 'The blind quarry-troll. It is going to where the sound was.',
    near: 'Rings of shattered stone. Something pounds here. Stand still and be stone.',
    heard: 'The outcrop moves. It has heard you.',
    raise: 'It plants its feet and lifts its fists.',
    switchName: 'The quarry-trolls',
    switchWhat: 'A blind quarry-troll keeps each of its two grounds on the highland edge. Off: no troll there, as before',
  };

  // ---------------------------------------------------------------- the sculptor's kit (as js/bloom4.js; x forward, y left, z up)
  const mul = (A, B) => { const o = new Array(12); for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) o[r * 4 + c] = A[r * 4] * B[c] + A[r * 4 + 1] * B[4 + c] + A[r * 4 + 2] * B[8 + c] + (c === 3 ? A[r * 4 + 3] : 0); return o; };
  const ID = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
  const Tr = (x, y, z) => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z];
  const Sc = (k) => [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0];
  const Rx = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0]; };
  const Ry = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0]; };
  const Rz = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0]; };
  const chain = (...m) => m.reduce(mul);
  // the inverse of a rigid transform (rotation and translation only, as every rest bone is)
  const inv = (M) => { const r = [M[0], M[4], M[8], 0, M[1], M[5], M[9], 0, M[2], M[6], M[10], 0]; r[3] = -(r[0] * M[3] + r[1] * M[7] + r[2] * M[11]); r[7] = -(r[4] * M[3] + r[5] * M[7] + r[6] * M[11]); r[11] = -(r[8] * M[3] + r[9] * M[7] + r[10] * M[11]); return r; };
  const ap = (M, p) => [M[0] * p[0] + M[1] * p[1] + M[2] * p[2] + M[3], M[4] * p[0] + M[5] * p[1] + M[6] * p[2] + M[7], M[8] * p[0] + M[9] * p[1] + M[10] * p[2] + M[11]];
  const ad = (M, d) => [M[0] * d[0] + M[1] * d[1] + M[2] * d[2], M[4] * d[0] + M[5] * d[1] + M[6] * d[2], M[8] * d[0] + M[9] * d[1] + M[10] * d[2]];
  const nrm = (v) => { const L = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / L, v[1] / L, v[2] / L]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  const MAT = { hide: 1, ink: 4, crust: 5, nail: 7, shadow: 9 };
  const STRIDE = 15;      // position 3, normal 3, colour 3, place on the body 3, material and shade 2, bone 1
  let seedN = 0, bone = 0;
  function tri(out, a, b, c) {
    const fn = cross(sub(b.p, a.p), sub(c.p, a.p)), vn = [a.n[0] + b.n[0] + c.n[0], a.n[1] + b.n[1] + c.n[1], a.n[2] + b.n[2] + c.n[2]];
    for (const v of fn[0] * vn[0] + fn[1] * vn[1] + fn[2] * vn[2] >= 0 ? [a, b, c] : [a, c, b]) out.push(v.p[0], v.p[1], v.p[2], v.n[0], v.n[1], v.n[2], v.c[0], v.c[1], v.c[2], v.l[0], v.l[1], v.l[2], v.m, v.s, v.b);
  }
  const V = (M, p, n, o, l) => ({ p: ap(M, p), n: nrm(ad(M, n)), c: o.col, l: [l[0] + o.off, l[1] + o.off * 0.37, l[2] + o.off * 0.71], m: o.mat + (o.k || 0) * 0.5, s: o.shade == null ? 1 : o.shade, b: bone });
  function blob(out, M, c, r, o) {
    o = Object.assign({ col: [0.5, 0.5, 0.5], mat: MAT.hide, off: (seedN++) * 3.17 }, o); const NL = o.lat || 7, NO = o.lon || 10, ring = [];
    for (let i = 0; i <= NL; i++) {
      const th = Math.PI * i / NL, st = Math.sin(th), ct = Math.cos(th), row = [];
      for (let j = 0; j <= NO; j++) {
        const ph = Math.PI * 2 * j / NO, d = [st * Math.cos(ph), st * Math.sin(ph), ct], zz = o.squash != null && d[2] < 0 ? d[2] * o.squash : d[2];
        const p = [c[0] + d[0] * r[0], c[1] + d[1] * r[1], c[2] + zz * r[2]];
        row.push(V(M, p, [d[0] / r[0], d[1] / r[1], (o.squash != null && d[2] < 0 ? d[2] * 3 : d[2]) / r[2]], o, p));
      }
      ring.push(row);
    }
    for (let i = 0; i < NL; i++) for (let j = 0; j < NO; j++) { const a = ring[i][j], b = ring[i][j + 1], c2 = ring[i + 1][j + 1], d = ring[i + 1][j]; if (i > 0) tri(out, a, b, c2); if (i < NL - 1) tri(out, a, c2, d); }
  }
  function tube(out, M, pts, o) {
    o = Object.assign({ col: [0.5, 0.5, 0.5], mat: MAT.hide, off: (seedN++) * 3.17, sides: 9, up: [0, 1, 0] }, o); const N = o.sides, rings = [], P = [];
    const first = pts[0], last = pts[pts.length - 1], d0 = nrm(sub(pts[1], first)), d1 = nrm(sub(last, pts[pts.length - 2]));
    P.push([first[0] - d0[0] * first[3] * 0.55, first[1] - d0[1] * first[3] * 0.55, first[2] - d0[2] * first[3] * 0.55, first[3] * 0.55, (first[4] || first[3]) * 0.55]);
    for (const q of pts) P.push(q);
    P.push([last[0] + d1[0] * last[3] * 0.55, last[1] + d1[1] * last[3] * 0.55, last[2] + d1[2] * last[3] * 0.55, last[3] * 0.55, (last[4] || last[3]) * 0.55]);
    for (let i = 0; i < P.length; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], t = nrm(sub(b, a));
      let s = cross(t, o.up); if (Math.hypot(s[0], s[1], s[2]) < 0.05) s = cross(t, [1, 0, 0]); s = nrm(s); const u = nrm(cross(s, t)), row = [], rs = P[i][3], ru = P[i][4] == null ? P[i][3] : P[i][4];
      for (let j = 0; j <= N; j++) {
        const an = Math.PI * 2 * j / N, cs = Math.cos(an), sn = Math.sin(an), p = [P[i][0] + (s[0] * cs * rs + u[0] * sn * ru), P[i][1] + (s[1] * cs * rs + u[1] * sn * ru), P[i][2] + (s[2] * cs * rs + u[2] * sn * ru)];
        const nn = nrm([s[0] * cs / rs + u[0] * sn / ru, s[1] * cs / rs + u[1] * sn / ru, s[2] * cs / rs + u[2] * sn / ru]), e = i === 0 ? -0.9 : i === P.length - 1 ? 0.9 : 0;
        row.push(V(M, p, [nn[0] + t[0] * e, nn[1] + t[1] * e, nn[2] + t[2] * e], o, p));
      }
      rings.push(row);
    }
    for (let i = 0; i + 1 < rings.length; i++) for (let j = 0; j < N; j++) { const a = rings[i][j], b = rings[i][j + 1], c = rings[i + 1][j + 1], d = rings[i + 1][j]; tri(out, a, b, c); tri(out, a, c, d); }
    for (const [row, c, dn] of [[rings[0], P[0], [-d0[0], -d0[1], -d0[2]]], [rings[rings.length - 1], P[P.length - 1], d1]]) { const ctr = V(M, c, dn, o, c); for (let j = 0; j < N; j++) tri(out, ctr, row[j], row[j + 1]); }
  }
  const C = { hide: rgb('#8a8a80'), hideD: rgb('#62625a'), crust: rgb('#cfcbbb'), ink: rgb('#0a0908'), mouth: rgb('#1c1210'), nail: rgb('#b9b09a') };

  // ---------------------------------------------------------------- the body: fifteen bones and its shadow
  const B = { body: 0, hipL: 1, kneeL: 2, hipR: 3, kneeR: 4, chest: 5, head: 6, shL: 7, elL: 8, fistL: 9, shR: 10, elR: 11, fistR: 12, ground: 13 }, NB = 14;
  // the bones for a moment of its movement, in the body's space. a: { phase, walk, raise, slam, alert, look }
  // (the look test's own transforms, at rest when every number is 0)
  function rig(a) {
    const w = a.phase || 0, wk = a.walk || 0, up = a.raise || 0, sl = a.slam || 0, cr = a.crouch || 0, step = Math.sin(w) * wk;
    const M = new Array(NB);
    // crouched (at rest): sunk down over its fists, the head tucked under the hump, so that it reads as a lump of rock
    const body = chain(Tr(0, 0, Math.abs(Math.cos(w)) * 0.02 * wk - sl * 0.04 - cr * 0.07), Ry(-up * 0.12 + sl * 0.1 + cr * 0.08)); M[B.body] = body;
    for (const [sg, h, k] of [[1, B.hipL, B.kneeL], [-1, B.hipR, B.kneeR]]) {
      M[h] = chain(body, Tr(-0.16, sg * 0.2, 0.52), Rx(sg * -0.1), Ry(sg * step * 0.35 - up * 0.15));
      M[k] = chain(M[h], Tr(0.13, sg * 0.04, -0.26), Ry(Math.max(0, -sg * step) * 0.4 + up * 0.15));
    }
    M[B.chest] = chain(body, Tr(0.22, 0, 0.82), Ry(0.5 - up * 0.55 + sl * 0.35 + cr * 0.4));
    M[B.head] = chain(M[B.chest], Tr(0.3 - cr * 0.06, 0, 0.02 - cr * 0.06), Ry(-0.42 + up * 0.3 + cr * 0.55), Rz((a.look || 0) * 0.6));
    for (const [sg, s, e, f] of [[1, B.shL, B.elL, B.fistL], [-1, B.shR, B.elR, B.fistR]]) {
      M[s] = chain(M[B.chest], Tr(0.08, sg * 0.43, 0.08), Ry(-0.5 - sg * step * 0.3 - up * 2.3 + sl * 0.5 - cr * 0.35), Rx(sg * (0.12 + up * 0.15 - cr * 0.08)));
      M[e] = chain(M[s], Tr(0.04, sg * 0.04, -0.38), Ry(-0.42 + up * 0.5 - sl * 0.3), Rx(sg * -0.1));
      M[f] = chain(M[e], Tr(0, 0, -0.46), Ry(0.92 - up * 0.6));
    }
    M[B.ground] = ID;
    return M;
  }
  // every part once, where the look test puts it at rest, carried by its bone (moved as bone * inverse(rest bone))
  function sculpt() {
    const out = []; seedN = 500;
    const RS = rig({});
    const on = (b) => { bone = b; return RS[b]; };
    for (const [sg, h, k] of [[1, B.hipL, B.kneeL], [-1, B.hipR, B.kneeR]]) {
      const hip = on(h);
      tube(out, hip, [[0, 0, 0.04, 0.15, 0.16], [0.07, sg * 0.03, -0.12, 0.14, 0.15], [0.13, sg * 0.04, -0.26, 0.115]], { col: C.hide, k: 0.5, sides: 11, shade: 0.85 });
      const kn = on(k);
      blob(out, kn, [0.02, 0, 0], [0.12, 0.12, 0.11], { col: C.hideD, k: 0.3 });
      tube(out, kn, [[0, 0, 0, 0.11], [-0.05, 0, -0.11, 0.1], [-0.08, 0, -0.2, 0.085]], { col: C.hide, sides: 11, shade: 0.8 });
      blob(out, kn, [-0.02, sg * 0.005, -0.215], [0.17, 0.115, 0.055], { col: C.hideD, squash: 0.2, shade: 0.75 });
      for (let i = -1; i <= 1; i++) blob(out, kn, [0.135, sg * 0.005 + i * 0.06, -0.23], [0.05, 0.034, 0.034], { col: C.nail, mat: MAT.nail, lat: 5, lon: 7, squash: 0.3 });
    }
    const body = on(B.body);
    blob(out, body, [-0.18, 0, 0.56], [0.22, 0.27, 0.2], { col: C.hide, k: 0.6, lat: 9, lon: 13 });
    blob(out, body, [0.04, 0, 0.6], [0.27, 0.3, 0.22], { col: C.hideD, lat: 9, lon: 13, shade: 0.85 });
    const chest = on(B.chest);
    blob(out, chest, [0, 0, 0], [0.3, 0.39, 0.3], { col: C.hide, k: 1, lat: 10, lon: 14 });
    blob(out, chest, [-0.2, 0, 0.14], [0.27, 0.3, 0.17], { col: C.hide, k: 1, lat: 8, lon: 12 });
    for (let i = 0; i < 7; i++) { const a = -0.55 + i * 0.2 + hash(i, 0, 621) * 0.08, yy = (hash(i, 1, 622) - 0.5) * 0.34; blob(out, chest, [-0.2 - Math.sin(a) * 0.26, yy, 0.14 + Math.cos(a) * 0.17], [0.07 + hash(i, 2, 623) * 0.05, 0.08 + hash(i, 3, 624) * 0.05, 0.035], { col: C.crust, mat: MAT.crust, lat: 5, lon: 8 }); }
    for (const sg of [-1, 1]) blob(out, chest, [0.06, sg * 0.37, 0.12], [0.2, 0.19, 0.19], { col: C.hide, k: 1, lat: 8, lon: 11 });
    const head = on(B.head);
    tube(out, head, [[-0.12, 0, 0.0, 0.2, 0.16], [0.02, 0, 0.0, 0.15, 0.13]], { col: C.hideD, sides: 11, shade: 0.8 });
    blob(out, head, [0.1, 0, 0.03], [0.17, 0.155, 0.15], { col: C.hide, k: 0.7, lat: 10, lon: 14 });
    tube(out, head, [[0.2, -0.135, 0.075, 0.042, 0.05], [0.235, -0.05, 0.085, 0.05, 0.056], [0.235, 0.05, 0.085, 0.05, 0.056], [0.2, 0.135, 0.075, 0.042, 0.05]], { col: C.hide, k: 1, sides: 8, up: [0, 0, 1] });
    for (const sg of [-1, 1]) {
      blob(out, head, [0.238, sg * 0.062, 0.028], [0.022, 0.04, 0.026], { col: C.ink, mat: MAT.ink, lat: 5, lon: 8 });
      const ear = chain(head, Tr(0.04, sg * 0.15, 0.05), Rx(sg * -0.45), Rz(sg * 0.35));
      blob(out, ear, [-0.02, sg * 0.03, 0.01], [0.13, 0.022, 0.15], { col: C.hideD, lat: 7, lon: 10, shade: 0.9 });
      blob(out, ear, [0.0, sg * 0.05, 0.02], [0.08, 0.014, 0.1], { col: C.mouth, mat: MAT.ink, lat: 6, lon: 8 });
      blob(out, head, [0.275, sg * 0.03, -0.012], [0.012, 0.016, 0.012], { col: C.ink, mat: MAT.ink, lat: 4, lon: 6 });
    }
    blob(out, head, [0.2, 0, -0.035], [0.105, 0.115, 0.07], { col: C.hide, lat: 7, lon: 11 });
    blob(out, head, [0.19, 0, -0.105], [0.115, 0.125, 0.055], { col: C.hideD, lat: 7, lon: 11, shade: 0.85 });
    tube(out, head, [[0.262, -0.09, -0.07, 0.014], [0.292, 0, -0.068, 0.014], [0.262, 0.09, -0.07, 0.014]], { col: C.ink, mat: MAT.ink, sides: 5, up: [0, 0, 1] });
    for (const sg of [-1, 1]) tube(out, head, [[0.25, sg * 0.07, -0.085, 0.02], [0.268, sg * 0.074, -0.035, 0.012], [0.27, sg * 0.074, -0.01, 0.004]], { col: C.crust, mat: MAT.nail, sides: 6 });
    for (const [sg, s, e, f] of [[1, B.shL, B.elL, B.fistL], [-1, B.shR, B.elR, B.fistR]]) {
      tube(out, on(s), [[0, 0, 0.04, 0.16], [0.03, sg * 0.03, -0.17, 0.15, 0.14], [0.04, sg * 0.04, -0.37, 0.125]], { col: C.hide, k: 0.9, sides: 11 });
      const el = on(e);
      blob(out, el, [0, 0, 0], [0.135, 0.135, 0.13], { col: C.hideD, k: 0.4 });
      tube(out, el, [[0, 0, 0, 0.13], [0.02, 0, -0.16, 0.165, 0.15], [0.01, 0, -0.33, 0.14, 0.13], [0, 0, -0.42, 0.115]], { col: C.hide, k: 0.5, sides: 11, shade: 0.92 });
      const fist = on(f);
      blob(out, fist, [0.05, 0, -0.02], [0.17, 0.155, 0.125], { col: C.hideD, lat: 8, lon: 11, squash: 0.45, shade: 0.85 });
      for (let q = 0; q < 4; q++) blob(out, fist, [0.17, (q - 1.5) * 0.075, -0.06], [0.07, 0.042, 0.06], { col: C.hide, lat: 5, lon: 8, squash: 0.4 });
      blob(out, fist, [0.06, sg * -0.15, -0.04], [0.09, 0.05, 0.055], { col: C.hide, lat: 5, lon: 8 });
    }
    const nbody = out.length / STRIDE;
    for (let j = 0, N = 16; j < N; j++) {
      const a0 = Math.PI * 2 * j / N, a1 = Math.PI * 2 * (j + 1) / N, sh = (x, y, s) => out.push(x, y, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, MAT.shadow, s, B.ground);
      sh(0, 0, 1); sh(Math.cos(a0) * 0.78, Math.sin(a0) * 0.6, 0); sh(Math.cos(a1) * 0.78, Math.sin(a1) * 0.6, 0);
    }
    let lo = 1e9;
    for (let i = 0; i < nbody * STRIDE; i += STRIDE) lo = Math.min(lo, out[i + 2]);
    return { data: new Float32Array(out), body: nbody, shadow: out.length / STRIDE - nbody, lo, invRest: RS.map(inv) };
  }
  let mesh = null; const getMesh = () => mesh || (mesh = sculpt());

  // ---------------------------------------------------------------- the flat picture (the classic renderer, and "Modelled bodies" off)
  function paintFlat() {
    const { sheet, limb, oval, outline, done, cols, put, at, INK } = K;
    const H1 = cols('#3a3a34', '#55554d', '#72726a', '#8e8e84', '#aaa99e'), H2 = cols('#2a2a26', '#3e3e38', '#55554d', '#6c6c63'), L = cols('#a8a596', '#c8c4b2', '#e0dccb');
    const s = sheet(120, 150);
    // the legs, short and bowed; the fists on the ground before them
    for (const [x0, x1] of [[44, 38], [76, 82]]) { limb(s, x0, 96, x1, 128, 9, 8, H2, { base: 0.45, fold: 0.25, seed: x0 }); oval(s, x1, 140, 13, 7, H2, { base: 0.4 }); }
    // the back and the hump, the shoulders broad
    oval(s, 60, 74, 40, 32, H1, { base: 0.55 });
    oval(s, 56, 52, 32, 22, H1, { base: 0.62 });
    for (const sx of [24, 96]) oval(s, sx, 62, 18, 17, H1, { base: 0.55 });
    // the arms: huge forearms down to the fists
    for (const [sx, ex, fx] of [[22, 14, 16], [98, 106, 104]]) { limb(s, sx, 64, ex, 96, 12, 13, H1, { base: 0.5, seed: sx }); limb(s, ex, 96, fx, 130, 14, 12, H1, { base: 0.48, seed: sx + 3 }); oval(s, fx, 136, 15, 11, H2, { base: 0.4 }); }
    // the head, low and thrust forward under the hump; the brow; the pits; the ears
    oval(s, 60, 84, 17, 15, H1, { base: 0.5 });
    for (const ex of [41, 79]) oval(s, ex, 80, 7, 11, H2, { base: 0.4 });
    for (const px of [54, 66]) for (let y = 81; y <= 83; y++) for (let x = px - 2; x <= px + 2; x++) put(s, x, y, INK);
    for (let x = 52; x <= 68; x++) put(s, x, 93, INK);
    // lime on its back
    for (let y = 30; y < 70; y++) for (let x = 25; x < 95; x++) if (at(s, x, y) && hash(x >> 2, y >> 2, 631) > 0.72) put(s, x, y, L[(x + y) % 3]);
    outline(s, INK);
    return done(s, { hs: 1.7 });
  }
  // a ring of shattered stone where it pounded
  function paintChips() {
    const w = 40, h = 10, d = new Uint32Array(w * h), C2 = ['#6e6a5e', '#9a9584', '#c4bfac', '#3e3b34'].map(K.hex);
    for (let i = 0; i < 46; i++) {
      const a = hash(i, 0, 641) * Math.PI * 2, r = 0.55 + hash(i, 1, 642) * 0.45, x = Math.round(20 + Math.cos(a) * 18 * r), y = Math.round(6 + Math.sin(a) * 3.6 * r);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h && hash(i, dx + dy, 643) > 0.3) d[Y * w + X] = C2[Math.floor(hash(i, 2 + dx, 644) * 4)]; }
    }
    return { w, h, data: d, hs: 0.3, cx: 0.5, dy: 0 };
  }

  // ---------------------------------------------------------------- how it is drawn (the walking bloom's pass, with the look test's hide)
  const VS = `layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec3 aCol; layout(location=3) in vec3 aLoc; layout(location=4) in vec2 aMS; layout(location=5) in float aBone;
uniform vec4 uBone[${NB * 3}]; uniform float uGrow;
out vec3 vPos; out vec3 vNrm; out vec3 vCol; out vec3 vLoc; out vec2 vMS;
void main() {
  int b = int(aBone + 0.5) * 3; vec4 r0 = uBone[b], r1 = uBone[b + 1], r2 = uBone[b + 2], q = vec4(aPos, 1.0);
  vec3 n = normalize(vec3(dot(r0.xyz, aNrm), dot(r1.xyz, aNrm), dot(r2.xyz, aNrm)));
  vec3 p = vec3(dot(r0, q), dot(r1, q), dot(r2, q)) + n * uGrow;
  vPos = p; vNrm = n; vCol = aCol; vLoc = aLoc; vMS = aMS; gl_Position = uViewProj * vec4(p, 1.0); }`;
  const FS = `in vec3 vPos; in vec3 vNrm; in vec3 vCol; in vec3 vLoc; in vec2 vMS;
uniform vec4 uBSun; uniform vec3 uBSunC; uniform vec3 uBAmb; uniform vec3 uBFire; uniform vec3 uBFireDir; uniform float uInk;
layout(location=0) out vec4 oColor; layout(location=1) out vec4 oAux;
float h1(vec3 p) { p = fract(p * vec3(443.897, 441.423, 437.195)); p += dot(p, p.yzx + 19.19); return fract((p.x + p.y) * p.z); }
vec3 h3(vec3 p) { return vec3(h1(p), h1(p + 17.3), h1(p + 41.7)); }
float vn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h1(i), h1(i + vec3(1, 0, 0)), f.x), mix(h1(i + vec3(0, 1, 0)), h1(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(h1(i + vec3(0, 0, 1)), h1(i + vec3(1, 0, 1)), f.x), mix(h1(i + vec3(0, 1, 1)), h1(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
vec2 plates(vec3 p) { vec3 i = floor(p), f = fract(p); float d1 = 9.0, d2 = 9.0, id = 0.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec3 g = vec3(float(x), float(y), float(z)); vec3 o = h3(i + g); float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; id = h1(i + g + 3.1); } else if (d < d2) d2 = d; }
  return vec2(d2 - d1, id); }
void main() {
  ivec2 lp = ivec2(gl_FragCoord.xy / max(1.0, uUp.w)); float bay = float(r3dBayer(lp)) / 16.0;
  float dist = distance(vPos, uEye.xyz), fog = clamp(dist * uFog.w, 0.0, 1.0); fog *= fog;
  float mat = floor(vMS.x + 0.01), k = clamp((vMS.x - mat) * 2.0, 0.0, 1.0);
  if (mat > 8.5) { float a = vMS.y * vMS.y * 0.62 * (1.0 - fog); if (a < bay * 0.3) discard; oColor = vec4(0.0, 0.0, 0.0, a); oAux = vec4(0.0); return; }
  if (uInk > 0.5) { oColor = vec4(mix(vec3(0.025, 0.022, 0.024), uFog.rgb, fog), 1.0); oAux = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec3 n = normalize(vNrm), v = normalize(uEye.xyz - vPos), tp = floor(vLoc * 56.0);
  float tex = h1(tp), soft = vn(vLoc * 9.0), fine = vn(vLoc * 26.0);
  vec3 alb = vCol; float rough = 0.5;
  if (mat < 1.5) {                                                    // the hide: cracked into plates like dry clay; lime on what faces up
    vec2 pl = plates(vLoc * 9.0);
    alb *= 0.74 + 0.22 * pl.y + 0.2 * soft + 0.12 * (tex - 0.5);
    alb *= mix(0.42, 1.0, smoothstep(0.0, 0.085, pl.x));
    float up = smoothstep(0.15, 0.7, n.z + (fine - 0.5) * 0.5 + (pl.y - 0.5) * 0.5) * k;
    alb = mix(alb, vec3(0.74, 0.73, 0.67) * (0.8 + 0.3 * tex) * mix(0.75, 1.0, smoothstep(0.0, 0.05, pl.x)), up * 0.9); rough = 0.8;
  } else if (mat < 4.5) { alb = vCol; rough = 1.0; }                  // a pit, a mouth
  else if (mat < 5.5) { vec2 pl = plates(vLoc * 22.0); alb *= (0.72 + 0.4 * pl.y) * mix(0.5, 1.0, smoothstep(0.0, 0.09, pl.x)); rough = 0.85; }   // lime
  else { alb *= 0.8 + 0.3 * tex; rough = 0.4; }                       // nail, tusk
  n = normalize(n + (h3(tp) - 0.5) * 0.12 * rough);
  float ndl = max(dot(n, normalize(uBSun.xyz)), 0.0), hemi = 0.62 + 0.38 * n.z, ground = smoothstep(0.0, 0.5, vPos.z - uBSun.w);
  vec3 fireDir = normalize(uBFireDir);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 2.2) * smoothstep(-0.65, 0.3, dot(n, fireDir));
  vec3 lit = uBAmb * hemi * mix(0.5, 1.0, ground) * vMS.y + uBSunC * ndl + uBFire * (max(dot(n, fireDir), 0.0) * 0.1 + rim * 1.2);
  float l = max(lit.r, max(lit.g, lit.b)), r = sqrt(l), q = (floor(r * 6.0 + bay * 0.9) + 0.55) / 6.0; lit *= l > 0.0005 ? (q * q) / l : 0.0;
  vec3 c = mix(alb * lit, uFog.rgb, fog);
  oColor = vec4(max(c, 0.0), 1.0); oAux = vec4(0.0, 0.0, 0.0, 1.0);
}`;
  const GLS = { prog: null, vao: null, failed: null, drawn: 0, ms: 0, tickErr: null };
  const on = () => typeof GFX === 'undefined' || GFX.laTrolls !== false;
  const bodies = () => typeof GFX === 'undefined' || GFX.laBodies !== false;
  const ID_MAP = 'la_z1';
  // Z1's two hunts of it: the plan's points (atlas/10-zones.md, places 26 and 37)
  const GROUNDS = [{ id: 'troll26', place: 26, x: 1200, y: 1060, yaw: Math.PI * 0.5 }, { id: 'troll37', place: 37, x: 1230, y: 500, yaw: Math.PI }];
  let T = [];                       // the trolls: { S, e (its entity on the map), g (its ground) }
  const modelled = () => bodies() && typeof R3D !== 'undefined' && R3D.active && R3D.active() && !!GLS.prog && !GLS.failed;
  const groundOn = (m) => (m && (m.lvls || m.smooth) ? (x, y) => m.groundAt(x, y) : () => 0);
  const pass = {
    name: 'la-trolls', order: 33,
    init(gl) {
      try {
        const m = getMesh(); GLS.prog = R3D.program(VS, FS, { chunks: ['common'] });
        GLS.vao = gl.createVertexArray(); const buf = gl.createBuffer(); gl.bindVertexArray(GLS.vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, m.data, gl.STATIC_DRAW);
        const ST = STRIDE * 4; for (const [i, n, o] of [[0, 3, 0], [1, 3, 12], [2, 3, 24], [3, 3, 36], [4, 2, 48], [5, 1, 56]]) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, n, gl.FLOAT, false, ST, o); }
        gl.bindVertexArray(null);
      } catch (e) { GLS.failed = String(e && e.message); }
    },
    enabled(F) { return on() && bodies() && !!GLS.prog && !GLS.failed && F.map && F.map.id === ID_MAP && T.length > 0; },
    draw(gl, F) {
      const t0 = typeof performance !== 'undefined' ? performance.now() : 0, m = getMesh(), ZK = R3D.ZK, ground = groundOn(F.map), eye = Engine.cam;
      R3D.bindScene(gl, F); const u = R3D.use(GLS.prog).u;
      const tod = F.tod == null ? 0.5 : F.tod, f = S3.on() ? S3.face(G.day | 0, tod) : S3.face(0, 0.735), day = smooth(-0.06, 0.2, Math.cos((tod - 0.5) * Math.PI * 2));
      const ce = Math.cos(f.el), lowSun = 1 - smooth(0.15, 0.5, f.el), k = day * (1 - f.dark * 0.6), sk = day * f.shadows * (1 - 0.82 * f.coal), fk = 0.16 + 0.84 * f.coal * (1 - 0.6 * smooth(0.2, 0.6, f.el));
      gl.uniform3f(u.uBSunC, 1.0 * sk, (0.93 - 0.45 * lowSun) * sk, (0.80 - 0.6 * lowSun) * sk);
      gl.uniform3f(u.uBAmb, 0.10 + 0.50 * k, 0.11 + 0.48 * k, 0.15 + 0.44 * k);
      gl.uniform3f(u.uBFire, 0.95 * fk, 0.24 * fk, 0.06 * fk); gl.uniform3f(u.uBFireDir, -1, 0, 0.12);
      gl.bindVertexArray(GLS.vao); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      const fogR = (F.map.fogDist || 120) + 10, u8 = new Float32Array(NB * 12);
      for (const t of T) {
        const S = t.S; if (eye && Math.hypot(S.x - eye.x, S.y - eye.y) > fogR) continue;
        const h = ground(S.x, S.y), root = chain(Tr(S.x, S.y, h * ZK), Sc(ZK * R.size), Tr(0, 0, -m.lo), Rz(S.yaw)), bones = rig(S);
        for (let b = 0; b < NB; b++) u8.set(b === B.ground ? chain(Tr(S.x, S.y, h * ZK + 0.012), Rz(S.yaw), Sc(R.size)) : chain(root, bones[b], m.invRest[b]), b * 12);
        gl.uniform4fv(u.uBone || u['uBone[0]'], u8);
        gl.uniform4f(u.uBSun, Math.cos(f.az) * ce, Math.sin(f.az) * ce, Math.max(0.08, Math.sin(f.el)), h * ZK);
        gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
        gl.uniform1f(u.uInk, 0); gl.uniform1f(u.uGrow, 0); gl.drawArrays(gl.TRIANGLES, m.body, m.shadow);
        gl.disable(gl.BLEND); gl.depthMask(true); gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT);
        gl.uniform1f(u.uInk, 1); gl.uniform1f(u.uGrow, 0.012); gl.drawArrays(gl.TRIANGLES, 0, m.body);
        gl.cullFace(gl.BACK); gl.uniform1f(u.uInk, 0); gl.uniform1f(u.uGrow, 0); gl.drawArrays(gl.TRIANGLES, 0, m.body);
        GLS.drawn++;
      }
      gl.disable(gl.CULL_FACE); gl.bindVertexArray(null); GLS.ms = (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
    },
  };

  // ---------------------------------------------------------------- in the game
  const ST = { said: {}, chips: [], heardAt: 0, raisedAt: 0, err: null, thrown: 0 };
  let last = null, lastCarter = null, pending = [];
  // a home on open ground near the plan's point: the nearest place with room round it to turn and get out (the place's
  // own boulders stand there, js/places43.js)
  function homeFor(m, g) {
    const bl = blockedOn(m, null), roomy = (x, y) => { if (bl(x, y)) return false; for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; if (bl(x + Math.cos(a) * 1.6, y + Math.sin(a) * 1.6)) return false; } return true; };
    for (let r = 0; r <= 20; r++) for (let k = 0; k < Math.max(1, r * 8); k++) {
      const a = (k / Math.max(1, r * 8)) * Math.PI * 2, x = g.x + 0.5 + Math.cos(a) * r, y = g.y + 0.5 + Math.sin(a) * r;
      if (roomy(x, y)) return { x, y, yaw: g.yaw };
    }
    return { x: g.x + 0.5, y: g.y + 0.5, yaw: g.yaw };
  }
  function blockedOn(m, self) {
    return (x, y) => {
      for (const [ox, oy] of [[0, 0], [R.radius, 0], [-R.radius, 0], [0, R.radius], [0, -R.radius]]) if (m.isBlocked(Math.floor(x + ox), Math.floor(y + oy))) return true;
      for (const e of m.entities) if (e !== self && e.solid && !e.laTroll && !e.hidden && !e.dead && e.kind !== 'item' && !e.laBloom && Math.hypot(e.x - x, e.y - y) < (e.radius || 0.3) + R.radius) return true;
      return false;
    };
  }
  // put the trolls on the open map, or take them off, to match the switch
  function place(m) {
    unplace();
    if (!m || !on()) return;
    for (const g of GROUNDS) {
      const home = homeFor(m, g), S = fresh(home);
      const e = m.deco('la_troll_ghost', S.x, S.y, { solid: true, radius: R.radius, scale: 1, label: TX.still, laTroll: true });
      if (typeof hydrate === 'function') hydrate(e);
      T.push({ id: g.id, S, e, g, m });
    }
    sync();
  }
  function unplace() {
    for (const t of T) { const i = t.m.entities.indexOf(t.e); if (i >= 0) t.m.entities.splice(i, 1); }
    for (const c of ST.chips) { const i = c.m.entities.indexOf(c.e); if (i >= 0) c.m.entities.splice(i, 1); }
    T = []; ST.chips = [];
  }
  function sync() {
    for (const t of T) {
      const S = t.S, e = t.e;
      e.x = S.x; e.y = S.y; e.sprite = modelled() ? 'la_troll_ghost' : 'la_troll_flat';
      e.label = S.state === 'rest' ? TX.still : S.state === 'go' || S.state === 'turn' ? TX.hunting : TX.name;
    }
  }
  // what it hears this step: you (moving), the carter (moving with you), and a thrown stone where it landed
  function soundsFor(m, dt) {
    const out = [], c = Engine.cam, here = G.map === m;
    if (here) {
      const moving = last && Math.hypot(c.x - last.x, c.y - last.y) > dt * R.still;
      const reach = reachOf(G.noise || 0, moving);
      if (reach > 0) out.push({ x: c.x, y: c.y, reach, who: 'you' });
    }
    if (typeof CARTER13 !== 'undefined' && CARTER13.state) {
      const k = CARTER13.state();
      if (k && k.map === m.id && !k.dead) {
        const moving = lastCarter && Math.hypot(k.x - lastCarter.x, k.y - lastCarter.y) > dt * R.still;
        if (moving) out.push({ x: k.x, y: k.y, reach: HR.heardAt(2.4), who: 'carter' });
        lastCarter = { x: k.x, y: k.y };
      }
    }
    for (const p of pending) out.push(p);
    pending = [];
    return out;
  }
  // stone between: if the straight way from the sound to the troll crosses a solid cell, it carries half as far
  function stoneBetween(m, ax, ay, bx, by) {
    const L = Math.hypot(bx - ax, by - ay), n = Math.ceil(L * 2);
    for (let i = 1; i < n; i++) { const x = ax + (bx - ax) * i / n, y = ay + (by - ay) * i / n; if (m.isSolidCell(Math.floor(x), Math.floor(y))) return 1; }
    return 0;
  }
  function chips(m, x, y) {
    const e = m.deco('la_chips', x, y, { solid: false, scale: 1, label: TX.near, laTroll: true });
    if (typeof hydrate === 'function') hydrate(e);
    ST.chips.push({ m, e });
    while (ST.chips.length > 16) { const o = ST.chips.shift(), i = o.m.entities.indexOf(o.e); if (i >= 0) o.m.entities.splice(i, 1); }
    if (typeof FIRESMOKE !== 'undefined' && FIRESMOKE.spawn) {
      const g = groundOn(m)(x, y);
      for (let i = 0; i < 8; i++) { const a = i * 0.785; FIRESMOKE.spawn(0, x + Math.cos(a) * 0.6, y + Math.sin(a) * 0.6, g + 0.1, Math.cos(a) * 0.35, Math.sin(a) * 0.35, 0.25, 1.6, 0.1, 0.6, 0.45, 0, g + 1.6); }
    }
  }
  function tick(dt) {
    if (typeof G === 'undefined' || !G || !G.maps) return;
    const m = G.maps[ID_MAP];
    if (!on() && T.length) unplace();
    if (on() && m && T.length && T[0].m !== m) place(m);
    if (on() && m && !T.length && typeof OPEN42 !== 'undefined' && OPEN42.ready(m)) place(m);
    if (G.state !== 'play' || !T.length) { if (G.map) last = { x: Engine.cam.x, y: Engine.cam.y }; return; }
    const here = G.map === m, c = Engine.cam, step = Math.min(dt || 0, 0.1);
    const sounds = soundsFor(m, step);
    for (const t of T) {
      const S = t.S;
      if (S.held) continue;
      const env = { sounds: sounds.map((s) => Object.assign({}, s, { through: stoneBetween(m, s.x, s.y, S.x, S.y) })), px: c.x, py: c.y, here, blocked: blockedOn(m, t.e), ground: groundOn(m) };
      const ev = think(S, env, step);
      if (ev.heard && here && G.time - ST.heardAt > 10) { ST.heardAt = G.time; msg(TX.heard, 'bad', 3500); }
      if (S.state === 'raise' && S.t <= step + 1e-6 && here && Math.hypot(S.x - c.x, S.y - c.y) < 30) msg(TX.raise, 'bad', 2200);
      if (ev.pound) { chips(m, ev.pound.x, ev.pound.y); if (ev.hit) damagePlayer(R.pound, TX.name); }
      // coming near its ground the first time, the quarry's own words (items-and-texts.md)
      if (here && !ST.said[t.id] && Math.hypot(t.S.home.x - c.x, t.S.home.y - c.y) < 28) { ST.said[t.id] = true; msg(TX.near, '', 6000); }
    }
    last = { x: c.x, y: c.y };
    sync();
  }
  // a thrown stone or bottle (the engine's distractions, js/game.js) lands where it can hear it
  function heardThrow(x, y, reach) { pending.push({ x, y, reach, who: 'stone' }); ST.thrown++; }
  function reset() { for (const t of T) { const h = t.S.home; Object.assign(t.S, fresh(h)); } sync(); }
  function wire() {
    if (typeof Engine === 'undefined' || typeof R3D === 'undefined' || typeof G === 'undefined') return false;
    const fl = paintFlat(); Engine.addSprite('la_troll_flat', { w: fl.w, h: fl.h, data: fl.data, hs: fl.hs, cx: fl.cx, dy: fl.dy });
    Engine.addSprite('la_troll_ghost', { w: 96, h: 120, data: new Uint32Array(96 * 120), hs: 1.7 });
    const ch = paintChips(); Engine.addSprite('la_chips', ch);
    R3D.addPass(pass);
    const _bm = buildAllMaps; buildAllMaps = function () { const maps = _bm.apply(this, arguments); try { T = []; ST.chips = []; } catch (e) { ST.err = ST.err || String(e && e.message); } return maps; };
    const _up = update; update = function (dt) { const r = _up.apply(this, arguments); try { tick(dt); } catch (e) { GLS.tickErr = GLS.tickErr || String(e && e.message); } return r; };
    const _lm = loadMap; loadMap = function (id) { const r = _lm.apply(this, arguments); try { if (id === ID_MAP && on() && !T.length) place(G.maps[ID_MAP]); last = null; } catch (e) { ST.err = ST.err || String(e && e.message); } return r; };
    if (typeof throwDistraction === 'function') {
      const _td = throwDistraction;
      throwDistraction = function (id) {
        const n = G.ents ? G.ents.length : 0, r = _td.apply(this, arguments);
        try { if (r && G.mapId === ID_MAP) { const e = G.ents[G.ents.length - 1]; if (G.ents.length > n && e && e.distractionT) heardThrow(e.x, e.y, (DISTRACTIONS[id] || {}).hearing || 7); } } catch (e) { ST.err = ST.err || String(e && e.message); }
        return r;
      };
    }
    if (typeof document !== 'undefined') { const wake = document.getElementById('btn-wake'); if (wake) wake.addEventListener('click', reset); }
    if (typeof LEDGE1 !== 'undefined') LEDGE1.SWITCHES.push(['laTrolls', TX.switchName, TX.switchWhat]);
    return true;
  }
  const wired = wire();
  return { R, TX, B, NB, GROUNDS, reachOf, pick, fresh, think, rig, sculpt: getMesh, paintFlat, trolls: () => T, place, unplace, reset, heardThrow, modelled, gl: () => GLS, state: () => ST, wired };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = TROLL44;
