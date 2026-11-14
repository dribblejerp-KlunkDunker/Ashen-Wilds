// ============================================================
//  bloom4 - Phase 4, "the walking bloom". One thing that hunts by sound, on the highland edge (owner's ruling O7),
//  modelled (O9). It stands on the shelf by the foot of the ramp, its back to you, and you must pass behind it to reach
//  Marget Sayle's door.
//
//  WHAT IT IS (docs/worldbuilding/the-smothering.md, searched before anything was invented):
//    "A walking bloom is recognisable at a distance by the caps along its shoulders and scalp, its slow, swaying
//     shamble, and a crust so thick over the eyes that it barely sees."
//    "shambles at 1.9 m/s (slower than you walk), sees 8 m in a 120 degree cone, hears a sprint or a swing within
//     8 m (scaled by your noise), claws for 16 and two seconds of choking."
//
//  HOW IT HUNTS
//    It stands at its post and sways. It hears by the engine's own noise value: standing and walking are under its
//    hearing; a run is heard at 8 m, and anything louder from further. It goes to WHERE THE NOISE WAS, not to you.
//    What little it sees is movement, in front of it, within 8 m: walk where it is looking and it follows; get out of
//    its sight, or stand outside it, and it arrives at an empty place, listens there a while, and goes back. In reach
//    it lifts its hands and claws; the dust sets you coughing, and coughing is loud. It cannot follow through Marget
//    Sayle's door. It waits a little way off, then goes back to its post.
//
//  HOW IT IS DRAWN
//    A sculpted body (the look test's, approved 12 Nov), made fast: every part is built once, in the space of the
//    bone that carries it, and sixteen bones are moved on the graphics card each frame. The classic renderer cannot
//    draw a model, and so shows a flat painted figure in its place; so does the Options switch "Modelled bodies", off.
//
//  Nothing here uses a random number: where it stands, what it hears and how it moves follow from the state alone.
// ============================================================
'use strict';

const BLOOM4 = (() => {
  const K = typeof ART2 !== 'undefined' ? ART2.kit : (typeof require !== 'undefined' ? require('./art2.js').kit : null);
  const hash = K.hash, clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const L1 = typeof LEDGE1 !== 'undefined' ? LEDGE1 : (typeof require !== 'undefined' ? require('./ledge1.js') : null);
  const S3 = typeof SUN3 !== 'undefined' ? SUN3 : (typeof require !== 'undefined' ? require('./sun3.js') : null);

  // ---------------------------------------------------------------- the rules (pure: test/bloom4.test.js runs them without a browser)
  // HOW LONG IS A METRE. The engine's walker covers 2.6 cells a second and more, which is a walking pace in metres; its
  // people stand 0.62 of a cell tall, which is not. The hunt is a matter of pace, so the hunt's metres are cells of
  // walking: it shambles at 1.9 a second, "slower than you walk", and that stays true. Its reach is its body's. [PROPOSED]
  const R = {
    post: { x: 88.2, y: 31.0, yaw: -Math.PI / 2 + 0.35 }, // on the shelf by the ramp's foot, its back to the way down, facing out over the drop
    wait: { x: 85.3, y: 31.5 },                        // where it waits when you have gone in at the door
    speed: 1.9,                                        // 1.9 m/s
    hearAt: 3.0,                                       // the engine's noise value it cannot hear under (standing 1.0, walking 2.4 and a little for what you wear, running 4.2)
    hearPer: 8 / (4.2 - 3.0),                          // so that a run is heard at 8 m
    see: 8, seeCone: Math.PI * 2 / 3,                  // 8 m, 120 degrees, and only what moves
    reach: 0.62, claw: 16, windup: 0.7, rest: 1.5, choke: 2,
    turn: 0.8, listen: 7, waitFor: 22, giveUp: 14, radius: 0.26, stride: 3.4,
  };
  const hearRange = (noise) => Math.max(0, (noise - R.hearAt) * R.hearPer);
  const hears = (noise, dist) => dist <= hearRange(noise);
  function sees(S, px, py, moving) {
    if (!moving) return false; const dx = px - S.x, dy = py - S.y, d = Math.hypot(dx, dy); if (d > R.see || d < 1e-6) return false;
    let a = Math.atan2(dy, dx) - S.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); return Math.abs(a) <= R.seeCone / 2;
  }
  const fresh = () => ({ x: R.post.x, y: R.post.y, yaw: R.post.yaw, state: 'post', t: 0, tx: R.post.x, ty: R.post.y, phase: 0, walk: 0, reach: 0, alert: 0, heard: 0, clawed: 0, choke: 0 });
  // One step of its mind and body. env: { px, py, noise, moving, here (the player is on this map), blocked(x, y), ground(x, y) }.
  // Returns what happened this step: { heard, claw } (for messages and for hurting the player).
  function think(S, env, dt) {
    const ev = { heard: false, claw: false }, d = Math.hypot(env.px - S.x, env.py - S.y);
    const aware = env.here && (hears(env.noise, d) || sees(S, env.px, env.py, env.moving));
    const face = (x, y, rate) => { let a = Math.atan2(y - S.y, x - S.x) - S.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); const m = rate * dt; S.yaw += clamp(a, -m, m); return Math.abs(a); };
    const go = (state) => { S.state = state; S.t = 0; };
    S.t += dt;
    if (aware && S.state !== 'claw') { S.tx = env.px; S.ty = env.py; if (S.state === 'post' || S.state === 'back' || S.state === 'listen' || S.state === 'wait') { go('turn'); ev.heard = true; S.heard++; } }
    if (!env.here && (S.state === 'come' || S.state === 'turn' || S.state === 'claw')) { S.tx = R.wait.x; S.ty = R.wait.y; go('toWait'); }
    let moveTo = null;
    if (S.state === 'post') { face(S.x + Math.cos(R.post.yaw), S.y + Math.sin(R.post.yaw), 0.6); }
    else if (S.state === 'turn') { face(S.tx, S.ty, 2.2); if (S.t >= R.turn) go('come'); }
    else if (S.state === 'come') {
      if (env.here && d <= R.reach) go('claw'); else if (Math.hypot(S.tx - S.x, S.ty - S.y) < 0.3 || S.t > R.giveUp) go('listen'); else moveTo = [S.tx, S.ty];   // a way it cannot find: it stops and listens
    } else if (S.state === 'claw') {
      face(env.px, env.py, 3);
      if (S.t >= R.windup && !S._hit) { S._hit = true; if (env.here && d <= R.reach + 0.2) { ev.claw = true; S.clawed++; } }
      if (S.t >= R.windup + R.rest) { S._hit = false; S.tx = env.px; S.ty = env.py; go(env.here && d <= R.reach ? 'claw' : 'listen'); }
    } else if (S.state === 'listen') { if (S.t >= R.listen) { S.tx = R.post.x; S.ty = R.post.y; go('back'); } }
    else if (S.state === 'toWait') { if (env.here) go('listen'); else if (Math.hypot(S.tx - S.x, S.ty - S.y) < 0.3) go('wait'); else moveTo = [S.tx, S.ty]; }
    else if (S.state === 'wait') { if (S.t >= R.waitFor) { S.tx = R.post.x; S.ty = R.post.y; go('back'); } }
    else if (S.state === 'back') { if (Math.hypot(S.tx - S.x, S.ty - S.y) < 0.25) go('post'); else if (S.t > R.giveUp * 3) { S.x = R.post.x; S.y = R.post.y; go('post'); } else moveTo = [S.tx, S.ty]; }
    let moved = 0;
    if (moveTo) {
      const off = face(moveTo[0], moveTo[1], 2.4), sp = R.speed * (off > 1.2 ? 0.25 : 1) * dt, vx = Math.cos(S.yaw) * sp, vy = Math.sin(S.yaw) * sp;
      const ok = (x, y) => !env.blocked(x, y) && Math.abs(env.ground(x, y) - env.ground(S.x, S.y)) < 0.45 && !(env.here && Math.hypot(env.px - x, env.py - y) < 0.42);
      // straight on if it can; else along whichever way is open (it slides round the bothy's corner)
      const tries = [[vx, vy], [Math.sign(moveTo[0] - S.x) * sp, 0], [0, Math.sign(moveTo[1] - S.y) * sp]];
      for (const [mx, my] of tries) if ((mx || my) && ok(S.x + mx, S.y + my)) { S.x += mx; S.y += my; moved = Math.hypot(mx, my); break; }
    }
    S.phase += moved * R.stride + dt * 0.55;                                       // its step keeps time with the ground it covers
    const k = Math.min(1, dt * 5);
    S.walk += ((moved > 0 ? 1 : 0) - S.walk) * k;
    S.reach += ((S.state === 'claw' ? (S.t < R.windup ? 1 : 0.35) : 0) - S.reach) * Math.min(1, dt * 7);
    S.alert += ((S.state === 'post' || S.state === 'back' || S.state === 'wait' ? 0 : 1) - S.alert) * Math.min(1, dt * 3);
    return ev;
  }

  // ---------------------------------------------------------------- the words (plain ASCII; all [PROPOSED], see ROADMAP.md)
  const TX = {
    atPost: 'A walking bloom. Caps along its shoulders and its scalp. A crust where the eyes were. It stands and sways.',
    hunting: 'The walking bloom. It is going to where the noise was.',
    heard: 'On the shelf, something has turned its head.',
    choke: 'The dust is in your mouth and eyes. You cannot stop coughing.',
    warn: 'The carter, behind you, low: "Walk. Do not run. There is one on the shelf, and it hears running."',
    name: 'The walking bloom',
  };

  // ---------------------------------------------------------------- the flat picture (the classic renderer, and the switch off)
  const { sheet, put, at, limb, drape, oval, outline, done, cols, hex, ramp, vnoise, INK } = K;
  const ASHEN_F = cols('#1f221c', '#33372e', '#484d41', '#5f6555', '#787e6b'), CRUST = cols('#6f6e61', '#8f8e7d', '#b4b39f'), RAG = cols('#0d0c0a', '#161411', '#201d18', '#2b2721');
  const TEAL = cols('#1c4f47', '#2c7d6d', '#4fb39b', '#8fe0cb');
  function flatCap(s, cx, cy, r) {                              // a corpse-cap: a pale stem and a small dome that gives its own light
    for (let y = 0; y < Math.max(2, r); y++) put(s, Math.round(cx), Math.round(cy + y), CRUST[2]);
    for (let y = Math.floor(cy - r * 0.7); y <= Math.round(cy); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const u = (x + 0.5 - cx) / r, v = (y + 0.5 - cy) / (r * 0.7); if (u * u + v * v > 1 || v > 0.15) continue;
      put(s, x, y, ramp(TEAL, 0.62 - u * 0.3 + v * -0.25, x, y), v < -0.2);
    }
  }
  function paintFlat() {
    const s = sheet(64, 160), X = 32;
    // legs, bare and thin, one a little behind the other; feet
    for (const [hx, kx, ax, seed] of [[26, 24.5, 26, 1], [38, 39.5, 37.5, 2]]) {
      limb(s, hx, 90, kx, 119, 4.4, 3.6, ASHEN_F, { base: 0.5, fold: 0.2, seed });
      limb(s, kx, 119, ax, 151, 3.6, 3.0, ASHEN_F, { base: 0.48, fold: 0.2, seed: seed + 4 });
      oval(s, ax + (hx < X ? -1 : 1), 155.5, 5.2, 3.2, ASHEN_F, { base: 0.45 });
    }
    // the trunk, stooped to its right, in what is left of a shirt; the rags hang in strips below it
    drape(s, 31, 92, (t) => X + t * 1.5, (t) => (t < 0.6 ? 11.5 - t * 2 : 10.3 + (t - 0.6) * 3), RAG, { fold: 0.5, seed: 3 });
    for (let x = 20; x <= 46; x++) { const len = Math.floor(hash(x >> 1, 0, 501) * 13); for (let y = 93; y < 93 + len; y++) if (hash(x >> 1, 1, 502) > 0.3) put(s, x, y, ramp(RAG, 0.3 + hash(x, y, 503) * 0.4, x, y)); }
    for (let y = 36; y <= 60; y++) for (let x = 24; x <= 40; x++) if (at(s, x, y) && vnoise(x * 0.3, y * 0.25, 504, 0) > 0.63) put(s, x, y, ramp(ASHEN_F, 0.35 + hash(x, y, 505) * 0.4, x, y));   // skin through the tears
    for (let y = 38; y <= 58; y++) for (let x = 26; x <= 38; x++) if (at(s, x, y) && vnoise(x * 0.5, y * 0.45, 506, 0) > 0.74) put(s, x, y, CRUST[1 + ((x + y) & 1)]);                           // the crust on the chest
    // the arms: long, hanging forward, the hands open and clawed
    for (const [sx, ex, wx, seed] of [[19.5, 14.5, 15.5, 5], [45.5, 50, 48.5, 6]]) {
      limb(s, sx, 35, ex, 63, 3.9, 3.2, ASHEN_F, { base: 0.5, fold: 0.2, seed });
      limb(s, ex, 63, wx, 92, 3.2, 2.6, ASHEN_F, { base: 0.46, fold: 0.2, seed: seed + 3 });
      for (const d of [-3, -1, 1, 3]) limb(s, wx + d * 0.5, 93, wx + d * 1.25, 102 + Math.abs(d), 1.15, 0.7, ASHEN_F, { base: 0.6 });
    }
    // the shoulders, uneven; the neck; the head hung forward and to one side
    drape(s, 27, 37, X + 0.5, (t) => 9 + t * 7, RAG, { fold: 0.4, seed: 7 });
    limb(s, 32, 30, 34, 22, 3.4, 3.2, ASHEN_F, { base: 0.42 });
    oval(s, 35, 15, 8.2, 9.6, ASHEN_F, { base: 0.55 });
    for (let y = 9; y <= 15; y++) for (let x = 28; x <= 42; x++) if (at(s, x, y) && (y < 14 || hash(x, y, 507) > 0.4)) put(s, x, y, ramp(CRUST, 0.75 - (x - 35) * 0.05 - (y - 9) * 0.06 + hash(x, y, 508) * 0.3, x, y));   // the crust over the eyes
    for (let x = 32; x <= 38; x++) { put(s, x, 20, INK); if (x > 32 && x < 38) put(s, x, 21, hex('#1a0d0b')); }                                                                                // the mouth, open
    for (const [cx, cy, r] of [[30, 6, 3.2], [36, 4, 3.8], [41, 7, 2.6], [26, 10, 2.2], [17, 30, 3.2], [22, 27, 2.6], [45, 28, 3.6], [50, 32, 2.6], [40, 25, 2.2], [13, 36, 2.2]]) flatCap(s, cx, cy, r);
    outline(s, INK);
    return done(s, { hs: 1 });
  }

  // ---------------------------------------------------------------- the sculptor's kit (3 x 4 transforms; x forward, y left, z up)
  const mul = (A, B) => { const o = new Array(12); for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) o[r * 4 + c] = A[r * 4] * B[c] + A[r * 4 + 1] * B[4 + c] + A[r * 4 + 2] * B[8 + c] + (c === 3 ? A[r * 4 + 3] : 0); return o; };
  const ID = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
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
  const MAT = { skin: 0, rag: 2, cap: 3, ink: 4, crust: 5, stem: 6, shadow: 9 };
  const STRIDE = 15;      // position 3, normal 3, colour 3, place on the body 3, material and shade 2, bone 1
  let seedN = 0, bone = 0;
  function tri(out, a, b, c) {      // wound to face the way its normals point, so back faces can be culled and the ink hull drawn
    const fn = cross(sub(b.p, a.p), sub(c.p, a.p)), vn = [a.n[0] + b.n[0] + c.n[0], a.n[1] + b.n[1] + c.n[1], a.n[2] + b.n[2] + c.n[2]];
    for (const v of fn[0] * vn[0] + fn[1] * vn[1] + fn[2] * vn[2] >= 0 ? [a, b, c] : [a, c, b]) out.push(v.p[0], v.p[1], v.p[2], v.n[0], v.n[1], v.n[2], v.c[0], v.c[1], v.c[2], v.l[0], v.l[1], v.l[2], v.m, v.s, v.b);
  }
  const V = (M, p, n, o, l) => ({ p: ap(M, p), n: nrm(ad(M, n)), c: o.col, l: [l[0] + o.off, l[1] + o.off * 0.37, l[2] + o.off * 0.71], m: o.mat + (o.k || 0) * 0.5, s: o.shade == null ? 1 : o.shade, b: bone });
  function blob(out, M, c, r, o) {                                             // a rounded mass
    o = Object.assign({ col: [0.5, 0.5, 0.5], mat: MAT.skin, off: (seedN++) * 3.17 }, o); const NL = o.lat || 7, NO = o.lon || 10, ring = [];
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
  function tube(out, M, pts, o) {                                              // a limb through [x, y, z, r] or [x, y, z, rSide, rOther]
    o = Object.assign({ col: [0.5, 0.5, 0.5], mat: MAT.skin, off: (seedN++) * 3.17, sides: 9, up: [0, 1, 0] }, o); const N = o.sides, rings = [], P = [];
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
  const C = { ashen: rgb('#7c8170'), ashenD: rgb('#565b4d'), rag: rgb('#221e19'), crust: rgb('#c2c0aa'), teal: rgb('#7fe3cb'), stem: rgb('#cdd8c6'), mouth: rgb('#1a0c0b') };
  function cap(out, M, at3, r, tilt) {                                         // a corpse-cap: a pale stem, a dome that gives light, gills under it
    const m = chain(M, Tr(at3[0], at3[1], at3[2]), Rx(tilt[0]), Ry(tilt[1])), h = r * (1.1 + hash(seedN, 3, 601) * 0.9);
    tube(out, m, [[0, 0, -r * 0.3, r * 0.2], [0, 0, h, r * 0.16]], { col: C.stem, mat: MAT.stem, sides: 5 });
    blob(out, m, [0, 0, h], [r, r, r * 0.62], { col: C.teal, mat: MAT.cap, squash: 0.12, lat: 5, lon: 8 });
  }

  // ---------------------------------------------------------------- the body: sixteen bones, and one more for its shadow
  const B = { body: 0, hipL: 1, kneeL: 2, footL: 3, hipR: 4, kneeR: 5, footR: 6, waist: 7, neck: 8, head: 9, shL: 10, elL: 11, handL: 12, shR: 13, elR: 14, handR: 15, ground: 16 }, NB = 17;
  // where each bone is, in the body's own space, for a moment of its movement. a: { phase, walk, reach, alert }
  function rig(a) {
    const w = a.phase, wk = a.walk, sway = Math.sin(w) * (0.035 + 0.035 * wk), step = Math.sin(w) * wk, bob = Math.abs(Math.cos(w)) * 0.012 * wk, loll = Math.sin(w * 0.5 + 1) * 0.12;
    const M = new Array(NB), body = chain(Tr(0, 0, bob), Rx(sway * 0.6)); M[B.body] = body;
    for (const [sg, h, k, f] of [[1, B.hipL, B.kneeL, B.footL], [-1, B.hipR, B.kneeR, B.footR]]) {
      const sw = sg * step * 0.3;
      M[h] = chain(body, Tr(0, sg * 0.082, 0.5), Ry(-0.12 + sw));
      M[k] = chain(M[h], Tr(0.02, 0, -0.235), Ry(0.32 + Math.max(0, -sg * step) * 0.5));
      M[f] = chain(M[k], Tr(-0.006, 0, -0.235), Ry(-0.2 - sw * 0.4));
    }
    M[B.waist] = chain(body, Tr(0, 0, 0.56), Ry(0.36 - a.alert * 0.13), Rx(sway));
    M[B.neck] = chain(M[B.waist], Tr(0.012, 0, 0.315), Ry(0.5 - a.alert * 0.5), Rx((0.22 + loll) * (1 - a.alert * 0.8)));
    M[B.head] = chain(M[B.neck], Tr(0.012, 0, 0.075), Ry(0.25 - a.alert * 0.2));
    for (const [sg, s, e, hd] of [[1, B.shL, B.elL, B.handL], [-1, B.shR, B.elR, B.handR]]) {
      M[s] = chain(M[B.waist], Tr(0.004, sg * 0.158, 0.285), Ry(-0.95 + sg * step * 0.16 - sway - a.reach * 0.66), Rx(sg * (0.1 + a.reach * 0.1)));
      M[e] = chain(M[s], Tr(0, 0, -0.225), Ry(-0.5 - Math.max(0, sg * step) * 0.25 + a.reach * 0.22));
      M[hd] = chain(M[e], Tr(0, 0, -0.24), Ry(-0.35 + a.reach * 0.8));   // the fingers hook down and forward
    }
    M[B.ground] = ID;
    return M;
  }
  // every part, once, in the space of the bone that carries it
  function sculpt() {
    const out = []; seedN = 100;
    const on = (b) => { bone = b; return ID; };
    for (const [sg, h, k, f] of [[1, B.hipL, B.kneeL, B.footL], [-1, B.hipR, B.kneeR, B.footR]]) {
      tube(out, on(h), [[0, 0, 0.02, 0.056, 0.062], [0.012, 0, -0.12, 0.05, 0.054], [0.02, 0, -0.235, 0.04]], { col: C.ashen, k: 0.5, shade: 0.9 });
      blob(out, on(k), [0.012, 0, 0], [0.042, 0.04, 0.045], { col: C.ashenD });
      tube(out, on(k), [[0, 0, 0, 0.038], [-0.012, 0, -0.11, 0.036, 0.032], [-0.006, 0, -0.225, 0.026]], { col: C.ashen, shade: 0.86 });
      blob(out, on(f), [0.045, 0, -0.012], [0.085, 0.042, 0.03], { col: C.ashenD, squash: 0.25, shade: 0.8 });
      for (let i = -1; i <= 1; i++) blob(out, on(f), [0.125, i * 0.024, -0.02], [0.022, 0.014, 0.014], { col: C.ashen, lat: 4, lon: 6, squash: 0.3 });
      void sg;
    }
    on(B.body);
    blob(out, ID, [-0.005, 0, 0.515], [0.085, 0.125, 0.08], { col: C.rag, mat: MAT.rag });
    for (let i = 0; i < 13; i++) {                                              // the rags that hang from the hips
      const a = (i / 13) * Math.PI * 2 + 0.2, len = 0.07 + hash(i, 0, 611) * 0.2, wd = 0.016 + hash(i, 1, 612) * 0.014, x = Math.cos(a) * 0.088, y = Math.sin(a) * 0.128, ox = Math.cos(a) * 0.012, oy = Math.sin(a) * 0.012;
      tube(out, ID, [[x, y, 0.5, wd, 0.005], [x + ox, y + oy, 0.5 - len * 0.5, wd * 0.9, 0.004], [x + ox * 2.2, y + oy * 2.2, 0.5 - len, wd * (0.25 + hash(i, 2, 613) * 0.6), 0.003]], { col: C.rag, mat: MAT.rag, sides: 5, up: [-Math.sin(a), Math.cos(a), 0] });
    }
    on(B.waist);                                                                // the trunk, bent from the waist; the shoulders' points
    tube(out, ID, [[0, 0, -0.03, 0.118, 0.07], [0.004, 0, 0.07, 0.108, 0.066], [0.012, 0, 0.17, 0.13, 0.082], [0.012, 0, 0.26, 0.15, 0.08], [0.004, 0, 0.305, 0.13, 0.058]], { col: C.ashen, k: 1, sides: 12, shade: 0.95 });
    for (const sg of [-1, 1]) blob(out, ID, [0.004, sg * 0.15, 0.285], [0.055, 0.055, 0.05], { col: C.ashen, k: 1 });
    for (const sg of [-1, 1]) for (const [x, y, z, r, tx, ty] of [[0.0, sg * 0.15, 0.33, 0.032, sg * -0.5, 0], [-0.03, sg * 0.105, 0.325, 0.024, sg * -0.2, -0.4], [0.03, sg * 0.1, 0.32, 0.02, sg * -0.2, 0.5], [-0.045, sg * 0.165, 0.29, 0.018, sg * -1.0, -0.5]]) cap(out, ID, [x, y, z], r, [tx, ty]);
    for (const [x, y, z, r] of [[-0.085, 0.03, 0.22, 0.03], [-0.085, -0.05, 0.16, 0.036], [-0.08, 0.07, 0.12, 0.022], [-0.075, -0.01, 0.275, 0.024]]) cap(out, ID, [x, y, z], r, [0.2 * (y > 0 ? -1 : 1), -1.25]);
    on(B.neck); tube(out, ID, [[0, 0, -0.03, 0.036], [0.006, 0, 0.06, 0.03]], { col: C.ashenD, shade: 0.8 });
    on(B.head);                                                                 // the head: jaw hanging, the crust over the eyes, caps on the scalp
    blob(out, ID, [0.012, 0, 0.07], [0.086, 0.07, 0.09], { col: C.ashen, lat: 9, lon: 12 });
    blob(out, ID, [0.062, 0, 0.012], [0.05, 0.05, 0.036], { col: C.ashenD });
    blob(out, ID, [0.088, 0, 0.034], [0.022, 0.034, 0.016], { col: C.mouth, mat: MAT.ink, lat: 4, lon: 6 });
    blob(out, ID, [0.066, 0, 0.088], [0.04, 0.066, 0.036], { col: C.crust, mat: MAT.crust, lat: 6, lon: 10 });
    blob(out, ID, [0.094, 0, 0.058], [0.018, 0.016, 0.022], { col: C.ashenD, lat: 4, lon: 6 });
    for (const [x, y, z, r, tx, ty] of [[0.0, -0.02, 0.15, 0.03, 0.2, -0.2], [0.04, 0.03, 0.14, 0.024, -0.3, 0.3], [-0.035, 0.03, 0.14, 0.034, -0.2, -0.5], [-0.05, -0.03, 0.115, 0.022, 0.4, -0.7], [0.02, 0.058, 0.1, 0.018, -0.9, 0.1], [-0.01, -0.062, 0.1, 0.02, 0.9, 0]]) cap(out, ID, [x, y, z], r, [tx, ty]);
    for (const [sg, s, e, hd] of [[1, B.shL, B.elL, B.handL], [-1, B.shR, B.elR, B.handR]]) {   // the arms; the open, clawed hands
      tube(out, on(s), [[0, 0, 0.01, 0.04], [0.004, 0, -0.11, 0.036], [0, 0, -0.225, 0.029]], { col: C.ashen, k: 0.6, shade: 0.92 });
      if (sg < 0) for (const [x, y, z, r] of [[0.03, 0.03, -0.13, 0.016], [0.028, -0.02, -0.19, 0.013]]) cap(out, ID, [x, y, z], r, [0.5, 1.2]);
      blob(out, on(e), [0, 0, 0], [0.032, 0.031, 0.034], { col: C.ashenD, lat: 5, lon: 7 });
      tube(out, ID, [[0, 0, 0, 0.029], [0.002, 0, -0.12, 0.027, 0.024], [0, 0, -0.235, 0.02]], { col: C.ashen, shade: 0.9 });
      blob(out, on(hd), [0.004, 0, -0.03], [0.018, 0.032, 0.038], { col: C.ashenD, lat: 5, lon: 7 });
      for (let f = 0; f < 4; f++) tube(out, chain(Tr(0.004, (f - 1.5) * 0.017, -0.06), Rx((f - 1.5) * 0.18), Ry(-(0.5 + f * 0.05))), [[0, 0, 0, 0.0085], [0, 0, -0.04, 0.0075], [0.012, 0, -0.072, 0.006], [0.03, 0, -0.092, 0.003]], { col: C.ashen, sides: 5 });
      tube(out, chain(Tr(0.01, sg * 0.03, -0.03), Rx(sg * 0.9), Ry(-0.4)), [[0, 0, 0, 0.009], [0, 0, -0.035, 0.007], [0.01, 0, -0.055, 0.003]], { col: C.ashen, sides: 5 });
    }
    const body = out.length / STRIDE;
    // its shadow: a soft dark oval, carried by the ground bone
    for (let j = 0, N = 16; j < N; j++) {
      const a0 = Math.PI * 2 * j / N, a1 = Math.PI * 2 * (j + 1) / N, sh = (x, y, s) => out.push(x, y, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, MAT.shadow, s, B.ground);
      sh(0, 0, 1); sh(Math.cos(a0) * 0.27, Math.sin(a0) * 0.23, 0); sh(Math.cos(a1) * 0.27, Math.sin(a1) * 0.23, 0);
    }
    // how far its soles are below its own origin, standing at rest: it is lifted by this much to stand on the ground
    const rest = rig({ phase: 0, walk: 0, reach: 0, alert: 0 }); let lo = 1e9;
    for (let i = 0; i < body * STRIDE; i += STRIDE) { const m = rest[out[i + 14]]; lo = Math.min(lo, m[8] * out[i] + m[9] * out[i + 1] + m[10] * out[i + 2] + m[11]); }
    return { data: new Float32Array(out), body, shadow: out.length / STRIDE - body, lo };
  }
  let mesh = null; const getMesh = () => mesh || (mesh = sculpt());

  // ---------------------------------------------------------------- how it is drawn
  const VS = `layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec3 aCol; layout(location=3) in vec3 aLoc; layout(location=4) in vec2 aMS; layout(location=5) in float aBone;
uniform vec4 uBone[${NB * 3}]; uniform float uGrow;
out vec3 vPos; out vec3 vNrm; out vec3 vCol; out vec3 vLoc; out vec2 vMS;
void main() {
  int b = int(aBone + 0.5) * 3; vec4 r0 = uBone[b], r1 = uBone[b + 1], r2 = uBone[b + 2], q = vec4(aPos, 1.0);
  vec3 n = normalize(vec3(dot(r0.xyz, aNrm), dot(r1.xyz, aNrm), dot(r2.xyz, aNrm)));
  vec3 p = vec3(dot(r0, q), dot(r1, q), dot(r2, q)) + n * uGrow;
  vPos = p; vNrm = n; vCol = aCol; vLoc = aLoc; vMS = aMS; gl_Position = uViewProj * vec4(p, 1.0); }`;
  const FS = `in vec3 vPos; in vec3 vNrm; in vec3 vCol; in vec3 vLoc; in vec2 vMS;
uniform vec4 uBSun; uniform vec3 uBSunC; uniform vec3 uBAmb; uniform vec3 uBFire; uniform float uInk;
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
  if (mat > 8.5) { float a = vMS.y * vMS.y * 0.62 * (1.0 - fog); if (a < bay * 0.3) discard; oColor = vec4(0.0, 0.0, 0.0, a); oAux = vec4(0.0); return; }   // its shadow
  if (uInk > 0.5) { oColor = vec4(mix(vec3(0.025, 0.022, 0.024), uFog.rgb, fog), 1.0); oAux = vec4(0.0, 0.0, 0.0, 1.0); return; }                            // its outline
  vec3 n = normalize(vNrm), v = normalize(uEye.xyz - vPos), tp = floor(vLoc * 56.0);
  float tex = h1(tp), soft = vn(vLoc * 9.0), fine = vn(vLoc * 26.0);
  vec3 alb = vCol; float glow = 0.0, rough = 0.5;
  if (mat < 0.5) {                                                    // dead skin: mottled, veined, crusted in patches; k: how much shirt is left on it
    alb *= 0.78 + 0.3 * soft + 0.14 * (tex - 0.5);
    float vein = smoothstep(0.035, 0.0, abs(vn(vLoc * 13.0 + 5.0) - 0.5)); alb = mix(alb, vec3(0.20, 0.23, 0.21), vein * 0.5);
    vec2 pl = plates(vLoc * 30.0); float cr = step(0.62, pl.y + (soft - 0.5) * 0.5) * smoothstep(0.02, 0.07, pl.x);
    alb = mix(alb, vec3(0.74, 0.73, 0.64) * (0.85 + 0.3 * tex), cr * 0.85);
    float cloth = step(0.47, vn(vLoc * 7.0 + 11.0) + (fine - 0.5) * 0.25) * step(0.01, k) * step(0.45 - k * 0.3, vn(vLoc * 3.1 + 2.0));
    alb = mix(alb, vec3(0.115, 0.10, 0.085) * (0.8 + 0.5 * tex), cloth); rough = mix(rough, 0.9, cloth);
  } else if (mat < 2.5) { alb *= 0.7 + 0.6 * fine * tex + 0.2 * soft; rough = 0.95; }                      // rag
  else if (mat < 3.5) { float under = smoothstep(0.1, -0.5, n.z); alb = mix(vCol * (0.8 + 0.3 * fine), vec3(0.10, 0.30, 0.27), under); glow = mix(0.85, 0.25, under); }   // a cap
  else if (mat < 4.5) { alb = vCol; rough = 1.0; }                                                         // the mouth
  else if (mat < 5.5) { vec2 pl = plates(vLoc * 22.0); alb *= (0.72 + 0.4 * pl.y) * mix(0.5, 1.0, smoothstep(0.0, 0.09, pl.x)); rough = 0.85; }   // the crust
  else { alb *= 0.85 + 0.2 * tex; glow = 0.12; }                                                           // a stem
  n = normalize(n + (h3(tp) - 0.5) * 0.12 * rough);
  float ndl = max(dot(n, normalize(uBSun.xyz)), 0.0), hemi = 0.62 + 0.38 * n.z, ground = smoothstep(0.0, 0.5, vPos.z - uBSun.w);
  vec3 fireDir = normalize(vec3(-1.0, 0.0, 0.12));
  float rim = pow(1.0 - max(dot(n, v), 0.0), 2.2) * smoothstep(-0.65, 0.3, dot(n, fireDir));
  vec3 lit = uBAmb * hemi * mix(0.5, 1.0, ground) * vMS.y + uBSunC * ndl + uBFire * (max(dot(n, fireDir), 0.0) * 0.1 + rim * 1.5);
  float l = max(lit.r, max(lit.g, lit.b)), r = sqrt(l), q = (floor(r * 6.0 + bay * 0.9) + 0.55) / 6.0; lit *= l > 0.0005 ? (q * q) / l : 0.0;   // a few steps of light, even to the eye
  vec3 c = mix(alb * lit, vCol * 1.35, glow);
  c = mix(c, uFog.rgb, fog);
  oColor = vec4(max(c, 0.0), 1.0); oAux = vec4(0.0, glow * 0.8, 0.0, 1.0);
}`;
  const GLS = { prog: null, vao: null, buf: null, failed: null, drawn: 0, ms: 0 };
  const sw = () => typeof GFX === 'undefined' || GFX.laBodies !== false;
  let S = fresh(), ent = null;
  const modelled = () => sw() && typeof R3D !== 'undefined' && R3D.active && R3D.active() && !!GLS.prog && !GLS.failed;
  const pass = {
    name: 'la-bodies', order: 32,
    init(gl) {
      try {
        const m = getMesh(); GLS.prog = R3D.program(VS, FS, { chunks: ['common'] });
        GLS.vao = gl.createVertexArray(); GLS.buf = gl.createBuffer(); gl.bindVertexArray(GLS.vao); gl.bindBuffer(gl.ARRAY_BUFFER, GLS.buf);
        gl.bufferData(gl.ARRAY_BUFFER, m.data, gl.STATIC_DRAW);       // once: the body never changes, only its bones move
        const ST = STRIDE * 4; for (const [i, n, o] of [[0, 3, 0], [1, 3, 12], [2, 3, 24], [3, 3, 36], [4, 2, 48], [5, 1, 56]]) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, n, gl.FLOAT, false, ST, o); }
        gl.bindVertexArray(null);
      } catch (e) { GLS.failed = String(e && e.message); }
    },
    enabled(F) { return sw() && !!GLS.prog && !GLS.failed && F.map && F.map.id === L1.LEDGE; },
    draw(gl, F) {
      const t0 = typeof performance !== 'undefined' ? performance.now() : 0, m = getMesh(), ZK = R3D.ZK, h = L1.landH(S.x, S.y);
      const root = chain(Tr(S.x, S.y, h * ZK), Sc(ZK), Tr(0, 0, -m.lo), Rz(S.yaw)), bones = rig(S), u8 = new Float32Array(NB * 12);
      for (let b = 0; b < NB; b++) u8.set(b === B.ground ? chain(Tr(S.x, S.y, h * ZK + 0.012), Rz(S.yaw)) : mul(root, bones[b]), b * 12);
      R3D.bindScene(gl, F); const u = R3D.use(GLS.prog).u; gl.uniform4fv(u.uBone || u['uBone[0]'], u8);
      const tod = F.tod == null ? 0.5 : F.tod, f = S3.on() ? S3.face(G.day | 0, tod) : S3.face(0, 0.735), day = smooth(-0.06, 0.2, Math.cos((tod - 0.5) * Math.PI * 2));
      const ce = Math.cos(f.el), lowSun = 1 - smooth(0.15, 0.5, f.el), k = day * (1 - f.dark * 0.6), sk = day * f.shadows * (1 - 0.82 * f.coal), fk = 0.16 + 0.84 * f.coal * (1 - 0.6 * smooth(0.2, 0.6, f.el));
      gl.uniform4f(u.uBSun, Math.cos(f.az) * ce, Math.sin(f.az) * ce, Math.max(0.08, Math.sin(f.el)), h * ZK);
      gl.uniform3f(u.uBSunC, 1.0 * sk, (0.93 - 0.45 * lowSun) * sk, (0.80 - 0.6 * lowSun) * sk);
      gl.uniform3f(u.uBAmb, 0.10 + 0.50 * k, 0.11 + 0.48 * k, 0.15 + 0.44 * k);
      gl.uniform3f(u.uBFire, 0.95 * fk, 0.24 * fk, 0.06 * fk);
      gl.bindVertexArray(GLS.vao); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
      gl.uniform1f(u.uInk, 0); gl.uniform1f(u.uGrow, 0); gl.drawArrays(gl.TRIANGLES, m.body, m.shadow);              // the shadow
      gl.disable(gl.BLEND); gl.depthMask(true); gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT);
      gl.uniform1f(u.uInk, 1); gl.uniform1f(u.uGrow, 0.0075); gl.drawArrays(gl.TRIANGLES, 0, m.body);                 // the ink
      gl.cullFace(gl.BACK); gl.uniform1f(u.uInk, 0); gl.uniform1f(u.uGrow, 0); gl.drawArrays(gl.TRIANGLES, 0, m.body); // the body
      gl.disable(gl.CULL_FACE); gl.bindVertexArray(null); GLS.drawn++; GLS.ms = (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
    },
  };

  // ---------------------------------------------------------------- in the game
  function blockedOn(m) { return (x, y) => { for (const [ox, oy] of [[0, 0], [R.radius, 0], [-R.radius, 0], [0, R.radius], [0, -R.radius]]) if (m.isBlocked(Math.floor(x + ox), Math.floor(y + oy))) return true; return false; }; }
  let last = { x: 0, y: 0 }, warned = false, saidHeard = 0;
  function tick(dt) {
    if (typeof G === 'undefined' || !G || G.state !== 'play' || !G.maps || !G.maps[L1.LEDGE]) return;
    const m = G.maps[L1.LEDGE], c = Engine.cam, here = G.map === m, moving = here && Math.hypot(c.x - last.x, c.y - last.y) > dt * 0.4; last = { x: c.x, y: c.y };
    const ev = S.held ? { heard: false, claw: false } : think(S, { px: c.x, py: c.y, noise: G.noise || 0, moving, here, blocked: blockedOn(m), ground: L1.landH }, Math.min(dt, 0.1));
    if (ev.heard && G.time - saidHeard > 12) { saidHeard = G.time; msg(TX.heard, 'bad', 3500); }
    if (ev.claw) { damagePlayer(R.claw, TX.name); S.choke = R.choke; if (G.state === 'play') msg(TX.choke, 'bad', 3000); }
    if (S.choke > 0) { S.choke -= dt; if (typeof addNoise === 'function') addNoise(dt * 4.5); }
    if (here && !warned && c.x >= L1.RAMP.x0 && c.x <= L1.RAMP.x1 + 1 && c.y < L1.RAMP.y1 + 0.5 && c.y > L1.RAMP.y0) { warned = true; msg(TX.warn, '', 7000); }
    if (ent) { ent.x = S.x; ent.y = S.y; ent.sprite = modelled() ? 'la_bloom_ghost' : 'la_bloom_flat'; ent.scale = 1; ent.label = S.state === 'post' || S.state === 'back' || S.state === 'wait' ? TX.atPost : TX.hunting; }
  }
  // for stills and tests: stand it somewhere, in some moment of its movement, and hold it there until reset()
  function pose(o) { Object.assign(S, o || {}); S.held = true; if (ent) { ent.x = S.x; ent.y = S.y; } return S; }
  function reset() { S = fresh(); warned = false; saidHeard = 0; if (ent) { ent.x = S.x; ent.y = S.y; } }
  function wire() {
    if (typeof Engine === 'undefined' || typeof R3D === 'undefined' || !L1) return false;
    const fl = paintFlat(); Engine.addSprite('la_bloom_flat', { w: fl.w, h: fl.h, data: fl.data, hs: fl.hs, cx: fl.cx, dy: fl.dy }); if (fl.emit && Engine.setEmissive) Engine.setEmissive('la_bloom_flat', fl.emit);
    Engine.addSprite('la_bloom_ghost', { w: 44, h: 160, data: new Uint32Array(44 * 160), hs: 1 });   // nothing to see: the modelled body's place, for looking at and for walking into
    R3D.addPass(pass);
    L1.SWITCHES.push(['laBodies', 'Modelled bodies', 'The walking bloom as a sculpted body. Off: a flat painted figure, as the classic renderer shows it (3D renderer only)']);
    // it stands in the map as a thing you can look at and cannot walk through; the engine's maps are built once at start
    const _bm = buildAllMaps; buildAllMaps = function () { const maps = _bm.apply(this, arguments); try { const m = maps && maps[L1.LEDGE]; if (m) { ent = m.deco('la_bloom_ghost', R.post.x, R.post.y, { solid: true, radius: R.radius, scale: 1, label: TX.atPost, laBloom: true }); reset(); } } catch (e) { /* the ledge stands without it */ } return maps; };
    const _up = update; update = function (dt) { const r = _up.apply(this, arguments); try { tick(dt); } catch (e) { if (!GLS.tickErr) { GLS.tickErr = String(e && e.message); } } return r; };
    return true;
  }
  const wired = wire();
  return { R, TX, B, NB, STRIDE, hearRange, hears, sees, fresh, think, rig, sculpt: getMesh, paintFlat, state: () => S, reset, pose, modelled, entity: () => ent, gl: () => GLS, pass, wired };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = BLOOM4;
