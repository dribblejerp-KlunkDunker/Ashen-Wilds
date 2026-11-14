// ============================================================
//  pixelfolk75 — Phase 75 pilot, "pixel folk": people drawn as true pixel art with limbs that move.
//
//  The game's people have been one painted picture each (plus two walk and two attack pictures for a few),
//  squashed and leaned by js/anim.js. This module draws a person from a skeleton instead: hips, spine, head,
//  shoulders, elbows, hands, knees, feet. Every frame is rasterised straight onto the pixel grid (nothing is
//  rotated or scaled afterwards, so there is no smear): each bone is a tapered capsule shaded in a few flat
//  tones from a hand-picked colour ramp, clothes are painted in the bone's own coordinates (so an apron stays
//  on the front and a belt stays level as the body turns), then a dark outline and inner crease lines are added.
//  Because the skeleton is posed in three dimensions and only then flattened, the same figure can be drawn
//  from any of eight sides, and a walk is a real walk: thighs swing, knees fold, arms counter-swing, the coat
//  hem follows the legs.
//
//  PIXELFOLK.has(id)                      is this sprite id rigged? (pilot: kaelen, townsman, legionnaire, lyra)
//  PIXELFOLK.frame(id, anim, f, octant)   -> { w, h, data: Uint32Array, hs, cx, emit } (cached)
//      anim: 'idle' | 'walk' | 'talk' | 'attack' | 'hurt';  f: frame number (wraps for loops);  octant 0..7
//      (0 = facing the viewer, 2 = the figure's left side toward the viewer's right ... 4 = back)
//  PIXELFOLK.COUNT[anim]                  frames per animation
//  PIXELFOLK.render(id, anim, phase, yaw) uncached, any phase 0..1 and any angle (tools, showcase)
//
//  Pure: no DOM, no assets, no random numbers from the game; works in the browser and in Node (tests, tools).
// ============================================================
'use strict';

const PIXELFOLK = (() => {
  const W = 208, H = 184, GX = 104, GY = 182, N = W * H;
  const PITCH = 0.13, CP = Math.cos(PITCH), SP = Math.sin(PITCH);
  const LX = -0.46, LY = -0.56, LZ = 0.69;                      // light from the upper left, in front
  const COUNT = { idle: 6, walk: 8, talk: 6, attack: 6, hurt: 2 };
  const PI = Math.PI, sin = Math.sin, cos = Math.cos, max = Math.max, min = Math.min, abs = Math.abs;

  // ---------------------------------------------------------------- colour ramps
  // Six tones per material: 0 outline, 1 deep shade, 2 shade, 3 base, 4 light, 5 highlight. Shades lean cool
  // (toward violet), lights lean warm (toward yellow), the way a pixel artist shifts hue along a ramp.
  const RAMPS = [];
  function hsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = max(r, g, b), mn = min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; }
  function rgb(h, s, l) { h = ((h % 360) + 360) % 360; const c = (1 - abs(2 * l - 1)) * s, x = c * (1 - abs((h / 60) % 2 - 1)), m = l - c / 2; const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]; }
  function toward(h, target, deg) { let d = ((target - h + 540) % 360) - 180; return h + max(-deg, min(deg, d)); }
  function ramp(hex, o = {}) {
    const n = parseInt(hex.slice(1), 16), [h, s, l] = hsl(n >> 16, (n >> 8) & 255, n & 255);
    const L = o.l || [0.2, 0.42, 0.7, 1, 1.2, 1.5], out = new Uint32Array(6);
    for (let i = 0; i < 6; i++) {
      const k = i - 3, hh = k < 0 ? toward(h, 255, -k * 9) : toward(h, 48, k * 7);
      const ss = min(1, s * (k < 0 ? 1 + -k * 0.1 : 1 - k * 0.1)), ll = min(0.97, l * L[i] + (i === 5 ? (o.spec || 0) : 0));
      const [r, g, b] = rgb(hh, ss, ll); out[i] = (255 << 24 | b << 16 | g << 8 | r) >>> 0;
    }
    RAMPS.push(out); return RAMPS.length - 1;
  }

  // ---------------------------------------------------------------- the pixel buffers
  const bRamp = new Uint8Array(N), bShade = new Int8Array(N), bPart = new Uint8Array(N), bEmit = new Uint8Array(N), bDepth = new Float32Array(N);
  let P_ramp = 0, P_off = 0, P_emit = 0, P_skip = false, PART = 0, TH = 0, CT = 1, ST = 0;
  function clear() { bShade.fill(0); bPart.fill(0); bEmit.fill(0); bDepth.fill(-1e9); PART = 0; }
  function h2(a, b) { let n = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
  function wrap(a) { while (a > PI) a -= 2 * PI; while (a < -PI) a += 2 * PI; return a; }
  // character space (x: the figure's left, y: the way it faces, z: up) -> screen
  function pr(p) { const X = p[0] * CT - p[1] * ST, Y = p[0] * ST + p[1] * CT; return { x: GX + X, y: GY - p[2] * CP + Y * SP, d: Y * CP + p[2] * SP }; }
  function tone(lam, shiny, x, y) { if (!shiny) lam += ((x ^ y) & 1) ? 0.055 : -0.055; return lam < -0.02 ? 1 : lam < 0.34 ? 2 : lam < 0.7 ? 3 : lam < 0.93 || !shiny ? 4 : 5; }

  // A tapered capsule between two projected points. m: { ramp, paint(t, az), grain, shiny, flat0, flat1, emit,
  // len (its length in pixels, so patterns keep their size), twist }.
  function capsule(a3, b3, ra, rb, m) {
    const A = pr(a3), B = pr(b3), abx = B.x - A.x, aby = B.y - A.y, l2 = abx * abx + aby * aby, l = Math.sqrt(l2) || 1e-6, R = max(ra, rb);
    const x0 = max(0, Math.floor(min(A.x, B.x) - R - 1)), x1 = min(W - 1, Math.ceil(max(A.x, B.x) + R + 1));
    const y0 = max(0, Math.floor(min(A.y, B.y) - R - 1)), y1 = min(H - 1, Math.ceil(max(A.y, B.y) + R + 1));
    const pid = m.part || (++PART), len = m.len || 40, dot = l2 < 0.5;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - A.x, py = y + 0.5 - A.y;
      let t = dot ? 0 : (px * abx + py * aby) / l2;
      if (t < 0) { if (m.flat0) continue; t = 0; } else if (t > 1) { if (m.flat1) continue; t = 1; }
      const r = ra + (rb - ra) * t, qx = px - abx * t, qy = py - aby * t, d2 = qx * qx + qy * qy;
      if (d2 > r * r) continue;
      const nz = Math.sqrt(1 - d2 / (r * r)), dep = A.d + (B.d - A.d) * t + nz * r, i = y * W + x;
      if (dep <= bDepth[i]) continue;
      const nx = qx / r, ny = qy / r;
      let s = dot ? nx : (px * aby - py * abx) / l / r; s = s < -1 ? -1 : s > 1 ? 1 : s;
      const az = wrap(Math.asin(s) + TH + (m.twist || 0));
      P_ramp = m.ramp; P_off = 0; P_emit = m.emit || 0; P_skip = false;
      if (m.paint) { m.paint(t, az, s); if (P_skip) continue; }
      let sh = tone(nx * LX + ny * LY + nz * LZ, m.shiny, x, y);
      if (m.grain) { const g = h2((t * len / 2) | 0, (((az + 4) * R / 2) | 0) + pid * 131); if (g < m.grain) sh--; else if (g > 1 - m.grain * 0.5) sh++; }
      sh += P_off; sh = sh < 1 ? 1 : sh > 5 ? 5 : sh;
      bDepth[i] = dep; bRamp[i] = P_ramp; bShade[i] = sh; bPart[i] = pid; bEmit[i] = P_emit;
    }
  }
  // An ellipsoid (heads, hoods, caps, pauldrons). paint(az, el) in the ball's own angles; m.yaw, m.pitch turn it.
  function ball(c3, rx, rz, m) {
    const C = pr(c3), x0 = max(0, Math.floor(C.x - rx - 1)), x1 = min(W - 1, Math.ceil(C.x + rx + 1)), y0 = max(0, Math.floor(C.y - rz - 1)), y1 = min(H - 1, Math.ceil(C.y + rz + 1));
    const th = TH + (m.yaw || 0), c = cos(th), s = sin(th), p = m.pitch || 0, cp = cos(p), sp = sin(p), pid = m.part || (++PART), rd = m.rd || rx;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const u = (x + 0.5 - C.x) / rx, v = (y + 0.5 - C.y) / rz, q = u * u + v * v;
      if (q > 1) continue;
      const w = Math.sqrt(1 - q), dep = C.d + w * rd, i = y * W + x;
      if (dep <= bDepth[i]) continue;
      P_ramp = m.ramp; P_off = 0; P_emit = m.emit || 0; P_skip = false;
      if (m.paint) {
        const hx = u * c + w * s, hy = -u * s + w * c, hz = -v, y2 = hy * cp + hz * sp, z2 = -hy * sp + hz * cp;
        m.paint(Math.atan2(hx, y2), Math.asin(z2 < -1 ? -1 : z2 > 1 ? 1 : z2), u, v); if (P_skip) continue;
      }
      let sh = tone(u * LX + v * LY + w * LZ, m.shiny || m.smooth, x, y); if (sh > 4 && !m.shiny) sh = 4;
      if (m.grain) { const g = h2(x * 3 + pid, y * 5); if (g < m.grain) sh--; }
      sh += P_off; sh = sh < 1 ? 1 : sh > 5 ? 5 : sh;
      bDepth[i] = dep; bRamp[i] = P_ramp; bShade[i] = sh; bPart[i] = pid; bEmit[i] = P_emit;
    }
  }
  // Outline, inner creases, colours.
  function resolve() {
    const data = new Uint32Array(N); let emit = null;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, sh0 = bShade[i]; if (!sh0) continue;
      let sh = sh0;
      const L = x > 0 ? i - 1 : -1, R = x < W - 1 ? i + 1 : -1, U = y > 0 ? i - W : -1, D = y < H - 1 ? i + W : -1;
      if (L < 0 || R < 0 || U < 0 || D < 0 || !bShade[L] || !bShade[R] || !bShade[U] || !bShade[D]) sh = bEmit[i] ? 2 : 0;
      else {
        let gap = 0; const d = bDepth[i], p = bPart[i];
        for (const j of [L, R, U, D]) if (bPart[j] !== p) { const g = bDepth[j] - d; if (g > gap) gap = g; }
        if (gap > 7) sh = bEmit[i] ? max(1, sh - 2) : 0; else if (gap > 2.2) sh = max(1, sh - 1);
      }
      data[i] = RAMPS[bRamp[i]][sh];
      if (bEmit[i]) { if (!emit) emit = new Uint8Array(N); emit[i] = 1; }
    }
    return { w: W, h: H, data, emit, _mask: emit, hs: H / 153.5, cx: GX / W };
  }

  // ---------------------------------------------------------------- vectors, skeleton
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const vlen = (a) => Math.hypot(a[0], a[1], a[2]), norm = (a) => { const l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const rotz = (v, g) => [v[0] * cos(g) - v[1] * sin(g), v[0] * sin(g) + v[1] * cos(g), v[2]];
  const limb = (a, b, side, tw) => rotz([side * sin(b), sin(a) * cos(b), -cos(a) * cos(b)], tw);
  function ik(s, target, l1, l2, pole) {
    let v = sub(target, s), d = vlen(v); const dir = norm(v); d = max(abs(l1 - l2) + 0.5, min(l1 + l2 - 0.2, d));
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(max(0, l1 * l1 - a * a));
    const k = pole[0] * dir[0] + pole[1] * dir[1] + pole[2] * dir[2], perp = norm(sub(pole, mul(dir, k)));
    return { elbow: add(add(s, mul(dir, a)), mul(perp, h)), hand: add(s, mul(dir, d)) };
  }
  const ease = (t) => t * t * (3 - 2 * t), lerp = (a, b, t) => a + (b - a) * t;

  // Pose -> joints. B: body measures. P: the pose (angles in radians; see the animations below).
  function skeleton(B, P) {
    const J = {}, twP = P.twP || 0, twC = P.twC || 0, ln = P.lean || 0, S = B.s || 1;
    const root = [P.sway || 0, P.fwd || 0, B.hipZ * S + (P.drop || 0)];
    J.root = root;
    for (const [k, side] of [['L', 1], ['R', -1]]) {
      const g = P['leg' + k], hip = add(root, rotz([side * B.hipW * S, 0, 0], twP)), turn = twP + side * (B.toeOut || 0.16);
      const knee = add(hip, mul(limb(g.a, g.b || 0, side, twP), B.thigh * S)), ankle = add(knee, mul(limb(g.a - g.k, (g.b || 0) * 0.5, side, twP), B.shin * S));
      const fp = g.f || 0, toe = add(ankle, rotz([0, cos(fp) * B.foot * S, -sin(fp) * B.foot * S - 2.5 * S], turn));
      J['hip' + k] = hip; J['knee' + k] = knee; J['ankle' + k] = ankle; J['toe' + k] = toe;
    }
    const neck = add(root, [0, sin(ln) * B.torso * S, cos(ln) * B.torso * S + (P.breath || 0)]);
    J.neck = neck; J.waist = add(root, [0, sin(ln) * 9 * S, cos(ln) * 9 * S]);
    J.chest = mix(root, neck, 0.8);
    J.head = add(neck, [0, sin(ln + (P.headPitch || 0) * 0.5) * B.neck * S, cos(ln) * B.neck * S]);
    for (const [k, side] of [['L', 1], ['R', -1]]) {
      const g = P['arm' + k], sh = add(neck, rotz([side * B.shW * S, 0, -3 * S + (P.shrug || 0)], twC));
      let elbow, hand;
      if (g.to) { const r = ik(sh, g.to, B.upper * S, B.fore * S, g.pole || [side * 0.7, -0.5, -0.5]); elbow = r.elbow; hand = r.hand; }
      else { elbow = add(sh, mul(limb(g.a, g.b || 0.1, side, twC), B.upper * S)); hand = add(elbow, mul(limb(g.a + g.e, (g.b || 0.1) - (g.in || 0), side, twC), B.fore * S)); }
      J['sh' + k] = sh; J['elbow' + k] = elbow; J['hand' + k] = hand;
    }
    // stand on the ground: the lower foot touches z = 0 (this is where the walk's bob comes from)
    const low = min(J.ankleL[2] - 6.6 * S, J.ankleR[2] - 6.6 * S, J.toeL[2] - 3.9 * S, J.toeR[2] - 3.9 * S);
    for (const k in J) J[k] = [J[k][0], J[k][1], J[k][2] - low];
    return J;
  }

  // ---------------------------------------------------------------- animations (phase 0..1)
  function animate(anim, ph, o = {}) {
    const f = 2 * PI * ph, P = { legL: {}, legR: {}, armL: {}, armR: {} };
    const stand = () => { for (const k of ['legL', 'legR']) Object.assign(P[k], { a: 0, b: 0.07, k: 0.04, f: 0 }); for (const k of ['armL', 'armR']) Object.assign(P[k], { a: 0.03, b: 0.11, e: 0.2 }); };
    if (anim === 'walk') {
      const A = o.stride || 0.42;
      for (const [k, off] of [['L', 0], ['R', PI]]) {
        const q = f + off, sw = max(0, cos(q));
        P['leg' + k] = { a: A * sin(q) + 0.22 * sw, b: 0.04, k: 0.1 + 1.0 * Math.pow(sw, 1.1), f: 0.32 * Math.pow(max(0, sin(q)), 3) - 0.55 * max(0, cos(q + 1.0)) };
        P['arm' + k] = { a: -0.72 * A * sin(q), b: 0.1, e: 0.28 + 0.34 * max(0, -sin(q)) };
      }
      P.twC = -0.16 * sin(f); P.twP = 0.11 * sin(f); P.lean = 0.07; P.sway = 0.9 * sin(f); P.headYaw = 0.05 * sin(f); P.swing = sin(f);
    } else if (anim === 'talk') {
      stand(); const b = sin(f);
      P.armR = { to: [-9 - 3 * b, 17, 0], rel: 'chest', dz: -14 + 6 * sin(f * 2), pole: [-0.8, -0.3, -0.5] };
      P.headPitch = 0.1 * sin(f * 2); P.headYaw = 0.14 * sin(f); P.mouth = [0, 2, 1, 0, 2, 1][Math.floor(ph * 6) % 6]; P.breath = 0.4 * b; P.twC = 0.05 * b;
    } else if (anim === 'hurt') {
      stand(); P.lean = -0.16; P.headPitch = -0.25; P.fwd = -3; P.legL.k = 0.3; P.legR.k = 0.2; P.legL.a = 0.15; P.legR.a = 0.1;
      P.armL = { a: -0.5, b: 0.5, e: 0.9 }; P.armR = { a: -0.3, b: 0.6, e: 1.0 }; P.mouth = 2; P.twC = ph < 0.5 ? 0.25 : -0.1;
    } else if (anim === 'attack') {
      stand(); P.t = ph;                                       // each figure shapes its own strike from P.t
    } else {
      stand(); const b = sin(f);
      P.breath = 0.8 * b; P.shrug = 0.5 * b; P.armL.b = 0.11 + 0.012 * b; P.armR.b = 0.11 + 0.012 * b; P.headYaw = 0.1 * sin(f + 1); P.sway = 0.5 * sin(f);
      P.blink = ph > 0.7 && ph < 0.78;
    }
    return P;
  }

  // ---------------------------------------------------------------- shared body parts
  const BODY = { hipZ: 70, hipW: 7.2, thigh: 33, shin: 30, foot: 9.5, torso: 43, neck: 15, shW: 16.5, upper: 24.5, fore: 22.5 };
  const er = (rw, rd, tw) => { const a = TH + (tw || 0); return Math.hypot(rw * cos(a), rd * sin(a)); };
  function legs(J, m, B, P) {
    const S = B.s || 1, tw = P.twP || 0;
    for (const k of ['L', 'R']) {
      capsule(J['hip' + k], J['knee' + k], 8.2 * S * (m.thick || 1), 6.3 * S * (m.thick || 1), { ramp: m.trousers, grain: m.grainT, len: 38, paint: m.paintThigh, shiny: m.shiny, twist: tw });
      capsule(J['knee' + k], J['ankle' + k], 6.2 * S * (m.thick || 1), 4.7 * S * (m.thick || 1), { ramp: m.trousers, grain: m.grainT, len: 34, shiny: m.shiny, paint: m.paintShin, twist: tw });
      const heel = add(J['ankle' + k], [0, 0, -2.2 * S]);
      capsule(heel, J['toe' + k], 4.6 * S, 3.9 * S, { ramp: m.boots, shiny: m.shiny });
    }
  }
  function arms(J, m, B, P) {
    const S = B.s || 1;
    for (const k of ['L', 'R']) {
      const mm = m['arm' + k] || m;
      capsule(J['sh' + k], J['elbow' + k], 6.0 * S * (mm.thick || 1), 5.0 * S * (mm.thick || 1), { ramp: mm.sleeve, grain: mm.grainS, len: 26, paint: mm.paintUpper, emit: mm.emit, shiny: mm.shiny });
      capsule(J['elbow' + k], J['hand' + k], 4.9 * S * (mm.thick || 1), 3.8 * S * (mm.thick || 1), { ramp: mm.fore == null ? mm.sleeve : mm.fore, grain: mm.grainS, len: 24, paint: mm.paintFore, emit: mm.emit, shiny: mm.shiny });
      const tip = add(J['hand' + k], mul(norm(sub(J['hand' + k], J['elbow' + k])), 2.6 * S));
      ball(tip, 4.3 * S * (mm.fist || 1), 4.5 * S * (mm.fist || 1), { ramp: mm.hand, emit: mm.emit, shiny: mm.shiny });
    }
  }
  // A face painted on the head ball in its own angles, so it turns with the head. o: { skin, hair, hairline(az) -> el,
  // beard, stubble, brow, mouth, blink, female }
  function facePaint(o) {
    return (az, el) => {
      const a = abs(az);
      if (o.hairline && el > o.hairline(az, a)) { P_ramp = o.hair; if (h2((az * 9) | 0, (el * 7) | 0) < 0.3) P_off = -1; return; }
      if (a > 2.55 && el > -0.75 && o.hair != null) { P_ramp = o.hair; return; }
      const ex = abs(a - 0.4), ey = el - 0.05;
      if (ex < 0.12 && abs(ey) < 0.065) { if (o.blink) P_off = -2; else { P_ramp = INK; P_off = -1; } return; }
      if (ex < 0.27 && ey > 0.1 && ey < 0.21) { P_ramp = o.brow == null ? o.hair : o.brow; P_off = -1; return; }
      if (ex < 0.27 && ey > -0.12 && ey <= 0.1 && !o.female) { P_off = -1; return; }                 // the socket's shadow
      if (ex < 0.2 && ey < -0.12 && ey > -0.2 && o.tired) { P_off = -1; return; }
      if (a < 0.15 + (o.mouth ? 0.04 : 0) && el < -0.44 && el > -0.53 - (o.mouth || 0) * 0.08) { if (o.mouth) { P_ramp = INK; P_off = -1; } else { P_ramp = o.lip == null ? o.skin : o.lip; P_off = o.lip == null ? -2 : -1; } return; }
      if (a < 0.13 && el < -0.28 && el > -0.36) { P_off = -1; return; }                               // under the nose
      if (o.beard != null && el < -0.14 - 0.25 * max(0, 1 - a * 1.6) && a < 1.75) { P_ramp = o.beard; if (h2((az * 11) | 0, (el * 9) | 0) < 0.3) P_off = -1; return; }
      if (o.stubble != null && el < -0.2 && a < 1.5) { P_ramp = o.stubble; return; }
      if (a < 0.1 && el < 0.02 && el > -0.26) { P_off = 1; return; }
      if (a > 0.7 && a < 1.1 && el < 0 && el > -0.3) P_off = o.female ? 0 : -1;       // cheek hollow
    };
  }
  function head(J, P, o) {
    const S = o.s || 0.9, yaw = (P.headYaw || 0), pitch = P.headPitch || 0;
    capsule(J.neck, J.head, 4.8 * S, 4.6 * S, { ramp: o.skin });
    const c = add(J.head, [0, sin(pitch) * 2, 0]);
    ball(c, 10.6 * S, 12.2 * S, { ramp: o.skin, smooth: true, rd: 11.2 * S, yaw, pitch, paint: facePaint(Object.assign({ mouth: P.mouth, blink: P.blink }, o)) });
    const fw = rotz([0, 1, 0], yaw), side = rotz([1, 0, 0], yaw);
    ball(add(c, add(mul(fw, 10.4 * S), [0, 0, -1.6 * S])), 2.0 * S, 3.0 * S, { ramp: o.skin, paint: () => { P_off = 0; } });     // nose
    for (const sgn of [1, -1]) ball(add(c, add(mul(side, sgn * 10.3 * S), [0, -0.8, -0.5 * S])), 1.9 * S, 3.0 * S, { ramp: o.skin, paint: () => { P_off = -1; } });   // ears
    return { c, fw, side, yaw, pitch };
  }
  function resolveArm(P, J0, k) { const g = P['arm' + k]; if (g && g.to && g.rel === 'chest') { g.to = [g.to[0], J0.chest[1] + g.to[1], J0.chest[2] + (g.dz || 0)]; g.rel = null; } }

  // ---------------------------------------------------------------- the pilot cast
  const C = {}, INK = ramp('#231b1d');
  // --- Kaelen Vance: long dark coat, glass left arm (lit from inside), black hair, a week of stubble.
  {
    const skin = ramp('#b98f72'), hair = ramp('#221b19'), coat = ramp('#3f352f'), shirt = ramp('#5d4f45'), strap = ramp('#6a4a2e'), belt = ramp('#5e4129'), brass = ramp('#b8923c', { spec: 0.1 }),
      trousers = ramp('#3b3027'), boots = ramp('#2b2019'), glass = ramp('#49c4cf', { l: [0.5, 0.62, 0.82, 1, 1.25, 1.75] }), eye = ramp('#d8d2c4'), stubble = ramp('#93745f');
    const torsoPaint = (t, az) => {
      const a = abs(az);
      if (a < 0.3 + 0.1 * (1 - t)) { P_ramp = shirt; if (t > 0.74 && t < 0.84) { P_ramp = a < 0.09 ? brass : belt; } else if (a < 0.04 && t < 0.7) P_off = -1; return; }
      if (a < 1.25 && abs(az * 0.55 - (t - 0.42)) < 0.045) { P_ramp = strap; if (abs(az - 0.35) < 0.06) P_ramp = brass; return; }   // the satchel strap, shoulder to hip
      if (a < 0.46 + 0.14 * (1 - t)) { P_off = 1; return; }                           // the coat's turned edge
      if (abs(a - 0.62) < 0.04 && t > 0.3 && t < 0.7 && ((t * 12) | 0) % 3 === 0) { P_ramp = brass; P_off = -1; return; }   // buttons
      if (t > 0.74 && t < 0.8 && a < 1.2) P_off = -1;
      if (abs(a - 1.45) < 0.07) P_off = -1;                                            // side seam
    };
    const skirtPaint = (t, az) => {
      const a = abs(az);
      if (a < 0.1 + 0.2 * t) { P_skip = true; return; }
      if (t > 0.93 + 0.07 * h2((az * 7) | 0, 3)) { P_skip = true; return; }           // a worn hem
      if (a < 0.2 + 0.2 * t) { P_off = 1; return; }
      if (sin(az * 5.2 + 0.6) > 0.72) P_off = -1;                                      // hanging folds
      if (a > 2.9 && t > 0.35) P_off = -1;                                             // back vent
    };
    const glassPaint = (t, az) => {
      const v = h2((t * 13) | 0, (az * 3) | 0), w = sin(t * 19 + az * 4 + v * 2);
      P_emit = 1; if (w > 0.72) P_off = 2; else if (w < -0.8) P_off = -1; if (v < 0.07) P_off = 2;
    };
    C.kaelen = {
      body: Object.assign({}, BODY, { shW: 16.8 }),
      attack(P) {
        const t = P.t, wind = ease(min(1, t / 0.4)), hit = t < 0.4 ? 0 : ease(min(1, (t - 0.4) / 0.16)), back = t < 0.7 ? 0 : ease((t - 0.7) / 0.3), k = hit * (1 - back);
        P.twC = lerp(0, 0.55, wind) - 0.95 * k; P.twP = -0.2 * k; P.lean = 0.02 + 0.2 * k; P.fwd = 5 * k;
        P.legL = { a: 0.1 + 0.5 * k, b: 0.05, k: 0.1 + 0.5 * k, f: 0 }; P.legR = { a: -0.1 - 0.38 * k, b: 0.1, k: 0.08, f: -0.2 * k };
        P.armL = { to: mix(mix([21, -2, 92], [25, -13, 100], wind * (1 - back)), [6, 34, 103], k), pole: [0.8, -0.4, -0.4] };
        P.armR = { a: 0.2 * wind - 0.7 * k, b: 0.25, e: 0.9 }; P.headPitch = 0.12 * k; P.flare = k; P.mouth = k > 0.5 ? 1 : 0;
      },
      draw(J, P, B) {
        const tw = P.twC || 0, flare = P.flare || 0;
        legs(J, { trousers, boots, grainT: 0.05, paintShin: (t) => { if (t > 0.38) { P_ramp = boots; if (t < 0.48) P_off = 1; } } }, B, P);
        capsule(add(J.neck, [0, 0, -7]), add(J.root, [0, 0, 1]), er(15.2, 10.2, tw), er(12.8, 9.8, tw), { ramp: coat, paint: torsoPaint, grain: 0.05, len: 44, twist: tw });
        capsule(add(J.shL, [-2, 0, 0.5]), add(J.shR, [2, 0, 0.5]), 6.8, 6.8, { ramp: coat, grain: 0.04 });
        const hem = mix(mix(J.kneeL, J.kneeR, 0.5), [J.root[0], J.root[1], 0], 0.35); hem[2] = 24; hem[1] -= 2.5 * abs(P.swing || 0) + 5 * (P.lean || 0) * 10 * 0.1;
        const sw = abs(P.swing || 0) * 2.2 + flare * 4;
        capsule(J.waist, hem, er(13.2, 10.2, tw), er(19.5 + sw * 0.4, 14.5 + sw, tw), { ramp: coat, paint: skirtPaint, grain: 0.06, len: 60, flat0: true, flat1: true, twist: P.twP || 0 });
        arms(J, { armR: { sleeve: coat, hand: skin, grainS: 0.05, paintFore: (t) => { if (t > 0.86) P_off = 1; } },
          armL: { sleeve: glass, hand: glass, emit: 1, shiny: true, paintUpper: (t, az) => { if (t < 0.22) { P_ramp = coat; P_emit = 0; P_off = t > 0.16 ? -1 : 0; return; } glassPaint(t, az); if (flare > 0.5) P_off += 1; }, paintFore: (t, az) => { glassPaint(t + 1, az); if (flare > 0.5) P_off += 1; } } }, B, P);
        const hd = head(J, P, { skin, eye, hair, stubble, tired: true, hairline: (az, a) => a < 0.85 ? 0.5 - 0.14 * abs(sin(az * 3.4 + 0.5)) - (az > 0.3 ? 0.14 : 0) : a < 1.5 ? 0.12 : a < 2.2 ? -0.42 : -0.78 });
        for (let i = 0; i < 4; i++) { const b = mix(J.elbowL, J.handL, 0.12 + 0.24 * i), d = rotz([1, i % 2 ? 0.5 : -0.4, 0.45 + 0.2 * (i % 2)], tw); capsule(b, add(b, mul(d, 6.5 + (i % 2) * 2.5 + flare * 2)), 2.2, 0.4, { ramp: glass, emit: 1, shiny: true }); }
        { const d = rotz([1, -0.2, 0.9], tw); capsule(J.shL, add(J.shL, mul(d, 9)), 3.2, 0.5, { ramp: glass, emit: 1, shiny: true }); }
        ball(add(J.waist, rotz([-11.5, 3, -5], P.twP || 0)), 4.6, 5.2, { ramp: strap, grain: 0.1, paint: (az, el) => { if (el > 0.35) P_off = 1; } });   // the satchel
        // collar turned up at the back and sides
        capsule(add(J.neck, [0, -1, 7.5]), add(J.neck, [0, -1, -1]), 6.8, 8.8, { ramp: coat, flat0: true, paint: (t, az) => { if (abs(az) < 1.15) P_skip = true; else if (t < 0.25) P_off = 1; } });
        // hair falling to the jaw at the sides and back
        ball(add(hd.c, add(mul(hd.fw, -1.6), [0, 0, 1.2])), 10.7, 12, { ramp: hair, rd: 10.6, yaw: hd.yaw, paint: (az, el) => { const a = abs(az); if (a < 1.0 || el < (a < 1.7 ? -0.2 : -0.72) - 0.12 * h2((az * 8) | 0, 1)) P_skip = true; else if (sin(az * 9) > 0.55) P_off = -1; else if (el > 0.5 && sin(az * 9) < -0.75) P_off = 1; } });
      },
    };
  }
  // --- The Oakhaven orchardman: linen shirt with rolled sleeves, leather apron, felt cap, greying beard.
  {
    const skin = ramp('#bd9170'), beard = ramp('#6f6255'), shirt = ramp('#a89c82'), apron = ramp('#744b2d'), kerchief = ramp('#7d3a2c'), tie = ramp('#4a3423'), trousers = ramp('#5d5343'), boots = ramp('#3d2c20'), cap = ramp('#6c6a55'), eye = ramp('#d8d2c4');
    const torsoPaint = (t, az) => {
      const a = abs(az);
      if (t > 0.8 && t < 0.87) { P_ramp = tie; return; }
      if (t > 0.26 && a < 0.82) { P_ramp = apron; if (a > 0.72 || t < 0.3) P_off = -1; else if (h2((t * 22) | 0, (az * 9) | 0) < 0.07) P_off = -1; return; }
      if (t <= 0.26 && abs(a - 0.5 + t * 0.4) < 0.1) { P_ramp = apron; P_off = -1; return; }          // the bib's straps
      if (a < 0.1 && t < 0.2) P_off = -1;                                                             // the shirt's open neck
    };
    C.townsman = {
      body: Object.assign({}, BODY, { shW: 17.2, hipW: 7.6 }),
      draw(J, P, B) {
        const tw = P.twC || 0;
        legs(J, { trousers, boots, grainT: 0.07, paintShin: (t) => { if (t > 0.55) { P_ramp = boots; if (t < 0.63) P_off = 1; } } }, B, P);
        capsule(add(J.neck, [0, 0, -7]), add(J.root, [0, 0, 1]), er(15.6, 10.6, tw), er(14.4, 11.2, tw), { ramp: shirt, paint: torsoPaint, grain: 0.05, len: 44, twist: tw });
        capsule(add(J.shL, [-2, 0, 0.5]), add(J.shR, [2, 0, 0.5]), 7, 7, { ramp: shirt, grain: 0.04 });
        const hem = mix(J.kneeL, J.kneeR, 0.5); hem[2] += 3;
        capsule(J.waist, hem, er(14.2, 11.2, tw), er(16.5, 12 + abs(P.swing || 0) * 1.5, tw), { ramp: apron, len: 46, flat0: true, flat1: true, twist: P.twP || 0, grain: 0.07,
          paint: (t, az) => { const a = abs(az); if (a > 0.86) { if (t < 0.3) { P_ramp = shirt; if (t > 0.24) P_off = -1; } else P_skip = true; return; } if (a > 0.76 || t > 0.95) P_off = -1; else if (abs(az + 0.36) < 0.2 && t > 0.3 && t < 0.62) { P_off = (abs(abs(az + 0.36) - 0.18) < 0.03 || t > 0.59 || t < 0.33) ? -1 : 0; if (h2((az * 20) | 0, (t * 30) | 0) < 0.12) P_off -= 1; } else if (h2((az * 14) | 0, (t * 26) | 0) < 0.06) P_off = -1; } });
        const sleeve = { sleeve: shirt, fore: skin, hand: skin, grainS: 0.04, paintFore: (t) => { if (t < 0.2) { P_ramp = shirt; P_off = 1; } } };
        arms(J, { armL: sleeve, armR: sleeve }, B, P);
        const hd = head(J, P, { skin, eye, hair: beard, beard, hairline: (az, a) => a < 1.2 ? 2 : a < 2.0 ? 0.0 : -0.6 });
        ball(add(J.neck, [0, 3, 1.5]), 6.4, 4.4, { ramp: kerchief, grain: 0.1 });
        ball(add(hd.c, [0, 0, 4]), 10.5, 8.9, { ramp: cap, rd: 10.7, yaw: hd.yaw, grain: 0.08, paint: (az, el) => { if (el < -0.08) P_skip = true; else if (el < 0.1) P_off = -1; } });
        ball(add(hd.c, [0, -2, 10.4]), 6.8, 4.2, { ramp: cap, grain: 0.08 });                                // the cap's soft crown
      },
    };
  }
  // --- A Carillon Legionnaire: blackened plate with brass edges, a bell for a helmet, a halberd.
  {
    const iron = ramp('#3b3b43', { spec: 0.14, l: [0.26, 0.5, 0.74, 1, 1.34, 2.1] }), brass = ramp('#a47f30', { spec: 0.16, l: [0.26, 0.46, 0.72, 1, 1.25, 1.62] }), dark = ramp('#26252a'), wood = ramp('#6d4c2d'), steel = ramp('#8f949c', { spec: 0.2 });
    const plate = (t, az) => { const a = abs(az); if (t > 0.5) { const k = (t - 0.5) * 8.5; if (k - Math.floor(k) < 0.18) { P_ramp = k < 0.3 ? brass : iron; P_off = k < 0.3 ? 0 : -2; return; } } if (a < 0.07 && t < 0.5) P_off = 1; else if (abs(a - 0.95) < 0.05 && t > 0.08 && t < 0.4 && ((t * 16) | 0) % 2) P_off = -2; if (t < 0.5 && abs(t - 0.44 + a * 0.08) < 0.03 && a < 1.3) { P_ramp = brass; } };
    const band = (lo, hi) => (t) => { if (t > lo && t < hi) P_ramp = brass; else if (t > hi && t < hi + 0.06) P_off = -2; };
    C.legionnaire = {
      body: Object.assign({}, BODY, { shW: 18.5, hipW: 8, s: 1.03, stride: 0.36 }),
      weapon(P, J0) {                                            // where the halberd is: a point on the shaft M, its direction d
        if (P.t != null) {
          const t = P.t, wind = ease(min(1, t / 0.42)), hit = t < 0.42 ? 0 : ease(min(1, (t - 0.42) / 0.14)), back = t < 0.72 ? 0 : ease((t - 0.72) / 0.28), k = hit * (1 - back), w = wind * (1 - back);
          const M = mix(mix([-23, 6, 72], [-10, 2, 112], w), [-3, 20, 86], k), d = norm(mix(mix([0, 0, 1], [-0.25, -0.8, 0.62], w), [0.12, 0.93, -0.18], k));
          P.twC = 0.45 * w - 0.85 * k; P.lean = -0.06 * w + 0.3 * k; P.fwd = 6 * k; P.twP = -0.15 * k;
          P.legL = { a: 0.12 + 0.55 * k, b: 0.08, k: 0.12 + 0.55 * k, f: 0 }; P.legR = { a: -0.12 - 0.4 * k, b: 0.12, k: 0.1, f: -0.25 * k };
          return { M, d, both: max(w, k) };
        }
        const sw = P.swing || 0;
        return { M: [-23, 6 + sw * 1.5, 72 + (P.breath || 0)], d: norm([0.02, 0.03 - sw * 0.03, 1]), both: 0 };
      },
      draw(J, P, B, wp) {
        const tw = P.twC || 0, m = { trousers: iron, boots: iron, shiny: true, thick: 1.12,
          paintThigh: (t, az) => { if (t > 0.86) { P_ramp = brass; } else if (abs(az) < 0.08) P_off = 1; },
          paintShin: (t, az) => { if (t < 0.1) P_ramp = brass; else if (t > 0.86) { P_ramp = brass; } else if (abs(az) < 0.1) P_off = 1; } };
        legs(J, m, B, P);
        for (const k of ['L', 'R']) ball(add(J['knee' + k], rotz([0, 2.6, 0], P.twP || 0)), 7.2, 7.2, { ramp: iron, shiny: true, paint: (az, el) => { if (abs(el) < 0.16) P_ramp = brass; } });
        capsule(add(J.neck, [0, 0, -8]), add(J.root, [0, 0, 0]), er(17, 11.8, tw), er(13.6, 10.8, tw), { ramp: iron, paint: plate, shiny: true, len: 46, twist: tw });
        capsule(add(J.shL, [-3, 0, 0]), add(J.shR, [3, 0, 0]), 7.4, 7.4, { ramp: iron, shiny: true });
        const hem = mix(J.kneeL, J.kneeR, 0.5); hem[2] += 13;
        capsule(J.waist, hem, er(14, 11, tw), er(18.5, 13.5 + abs(P.swing || 0) * 1.4, tw), { ramp: iron, shiny: true, len: 28, flat0: true, flat1: true, twist: P.twP || 0,
          paint: (t, az) => { const k = t * 3; if (t > 0.9) P_ramp = brass; else if (k - Math.floor(k) < 0.12) P_off = -2; if (abs(az) < 0.12) P_off -= 1; } });
        const sleeve = { sleeve: iron, hand: dark, shiny: true, thick: 1.15, fist: 1.25, paintUpper: band(0.84, 0.94), paintFore: band(0.62, 0.72) };
        arms(J, { armL: sleeve, armR: sleeve }, B, P);
        for (const k of ['L', 'R']) ball(add(J['sh' + k], [k === 'L' ? 2 : -2, 0, 1.5]), 10.4, 9.2, { ramp: iron, shiny: true, rd: 10.4, paint: (az, el) => { if (el < -0.5) P_ramp = brass; else if (el < -0.36) P_off = -2; else if (abs(el - 0.1) < 0.07) P_off = -1; } });
        // gorget, then the bell: no face, only brass, with a dark mouth under the rim
        capsule(add(J.neck, [0, 0, 5]), add(J.neck, [0, 0, -2]), 8, 10.5, { ramp: iron, shiny: true });
        const c = add(J.head, [0, sin(P.headPitch || 0) * 3, 0]), lip = add(c, [0, 0, -11]);
        capsule(add(c, [0, 0, -8]), add(c, [0, 0, -11.5]), 11.5, 11.5, { ramp: dark });
        ball(add(c, [0, 0, 5]), 11, 11.5, { ramp: brass, shiny: true, rd: 11, paint: (az, el) => { if (el < -0.25) P_skip = true; else if (abs(el - 0.25) < 0.08) P_off = -1; else if (h2((az * 7) | 0, (el * 9) | 0) < 0.09) P_off = -1; } });
        capsule(add(c, [0, 0, 3]), lip, 11, 14.2, { ramp: brass, shiny: true, flat0: true, flat1: true, len: 14, paint: (t, az) => { if (t > 0.82) P_off = 1; else if (abs(t - 0.5) < 0.07) P_off = -1; if (h2((az * 6) | 0, (t * 5) | 0) < 0.06) P_off -= 1; if (abs(az) < 0.62 && t > 0.12 && t < 0.42 && sin(az * 15.7) > 0.25) { P_ramp = dark; P_off = 0; } } });
        capsule(add(c, [0, 0, 15.5]), add(c, [0, 0, 19]), 3.2, 2.4, { ramp: brass, shiny: true });
        ball(add(c, [0, 0, 20.5]), 3, 3, { ramp: brass, shiny: true });
        // the halberd
        const butt = add(wp.M, mul(wp.d, -72)), tip = add(wp.M, mul(wp.d, 74)), hd = add(wp.M, mul(wp.d, 58));
        capsule(butt, add(wp.M, mul(wp.d, 62)), 1.9, 1.9, { ramp: wood, len: 150, paint: (t) => { if (abs(t - 0.5) < 0.012 || abs(t - 0.2) < 0.012) P_ramp = brass; } });
        capsule(add(wp.M, mul(wp.d, 60)), add(tip, mul(wp.d, 6)), 2.8, 0.5, { ramp: steel, shiny: true });
        const sideV = norm([wp.d[2], 0, -wp.d[0]]), bx = (k) => add(hd, mul(sideV, k));
        capsule(bx(-1.5), bx(-11), 5, 9.5, { ramp: steel, shiny: true, flat1: true, paint: (t, az, s) => { if (t > 0.78) P_off = 1; } });
        capsule(bx(1.5), bx(9), 3, 0.6, { ramp: steel, shiny: true });
        capsule(add(hd, mul(wp.d, -7)), add(hd, mul(wp.d, 5)), 2.8, 2.8, { ramp: brass, shiny: true });
      },
    };
  }
  // --- Lyra Ashgrove: green-grey shawl, brown dress, a red braid over her shoulder.
  {
    const skin = ramp('#cfa487'), hair = ramp('#98432a'), shawl = ramp('#4f5a49'), dress = ramp('#75503b'), under = ramp('#8a6a52'), boots = ramp('#3b2a20'), eye = ramp('#d8d2c4'), lip = ramp('#b0705f'), cord = ramp('#c8b58a');
    C.lyra = {
      body: Object.assign({}, BODY, { s: 0.95, shW: 14, hipW: 6, toeOut: 0.1, stride: 0.27 }),
      idleArms(P, J0) {                                          // hands held together at her waist
        const b = (P.breath || 0) * 0.5;
        P.armL = { to: [4, J0.chest[1] + 10, J0.chest[2] - 20 + b], pole: [0.9, -0.3, -0.3] }; P.armR = { to: [-4, J0.chest[1] + 10, J0.chest[2] - 19 + b], pole: [-0.9, -0.3, -0.3] };
      },
      draw(J, P, B) {
        const tw = P.twC || 0, S = B.s;
        legs(J, { trousers: under, boots, paintShin: (t) => { if (t > 0.45) P_ramp = boots; } }, B, P);
        capsule(add(J.neck, [0, 0, -7]), add(J.root, [0, 0, 1]), er(12.8, 9.2, tw), er(10.6, 8.8, tw), { ramp: dress, len: 44, twist: tw, grain: 0.05,
          paint: (t, az) => { const a = abs(az); if (t < 0.5 + 0.12 * cos(az * 2)) { P_ramp = shawl; if (abs(sin(az * 3 + t * 9)) > 0.86) P_off = -1; if (a < 0.16 + t * 0.5 && t > 0.12) { P_ramp = dress; if (a < 0.05) P_off = -1; } return; } if (t > 0.8 && t < 0.86) { P_ramp = cord; return; } if (a < 0.05) P_off = -1; } });
        capsule(add(J.shL, [-2.5, 0, 0]), add(J.shR, [2.5, 0, 0]), 7.4, 7.4, { ramp: shawl, grain: 0.07 });
        const feet = mix(J.ankleL, J.ankleR, 0.5), hem = [lerp(J.root[0], feet[0], 0.6), lerp(J.root[1], feet[1], 0.6), 9], sw = abs(P.swing || 0);
        capsule(J.waist, hem, er(11, 9, tw), er(20 + sw, 16 + sw * 7, tw), { ramp: dress, len: 76, flat0: true, flat1: true, twist: P.twP || 0, grain: 0.06,
          paint: (t, az) => { const w = sin(az * 6.3 + sin(t * 3) * 0.6); if (w > 0.62) P_off = -1; else if (w < -0.86 && t > 0.3) P_off = 1; if (t > 0.95) P_off -= 1; } });
        const sleeve = { sleeve: shawl, fore: dress, hand: skin, grainS: 0.07, thick: 0.92, paintUpper: (t) => { if (t > 0.9) P_off = -1; }, paintFore: (t) => { if (t > 0.86) P_ramp = skin; } };
        arms(J, { armL: sleeve, armR: sleeve }, B, P);
        // the shawl: one piece over both shoulders, open in a V, a ragged fringe at the edge
        capsule(add(J.neck, [0, 0, 2]), add(J.neck, [0, 1, -23]), er(8.5, 7, tw), er(19.5, 12, tw), { ramp: shawl, len: 26, flat0: true, flat1: true, twist: tw, grain: 0.1,
          paint: (t, az) => { const a = abs(az); if (a < 0.1 + t * 0.34) { P_skip = true; return; } if (t > 0.9 + 0.1 * h2((az * 9) | 0, 7)) { P_skip = true; return; } if (a < 0.2 + t * 0.34 || t > 0.86) P_off = 1; else if (sin(az * 7 + t * 4) > 0.7) P_off = -1; } });
        const hd = head(J, P, { s: 0.86, skin, eye, hair, lip, female: true, hairline: (az, a) => a < 0.9 ? 0.5 - 0.12 * abs(sin(az * 2.2)) : a < 1.6 ? 0.05 : -0.9 });
        ball(add(hd.c, add(mul(hd.fw, -1.8), [0, 0, 1])), 10.2, 11.4, { ramp: hair, rd: 10.4, yaw: hd.yaw, paint: (az, el) => { const a = abs(az); if (a < 1.05 || el < (a < 1.9 ? -0.3 : -0.86)) P_skip = true; else if (sin(az * 10 + el * 3) > 0.5) P_off = -1; else if (el > 0.45 && sin(az * 10) < -0.7) P_off = 1; } });
        // the braid: down past her left collarbone, swinging a little as she walks
        let p = add(hd.c, add(mul(hd.side, 7.6), [0, -1, -6])); const swg = (P.swing || 0) * 1.6;
        for (let i = 0; i < 9; i++) { const q = add(p, [0.9 - i * 0.16 + swg * i * 0.12, i < 4 ? 3.4 : 0.5, -4.1]); capsule(p, q, 3.2 - i * 0.12, 3.1 - i * 0.12, { ramp: i === 8 ? cord : hair, paint: (t) => { if (t > 0.55) P_off = -1; else if (t < 0.25) P_off = 1; } }); p = q; }
      },
    };
  }

  // ---------------------------------------------------------------- render
  // The pose of a figure at one moment: P (angles), J (joints, the figure's own space), wp (its weapon, if it has one).
  // An id with no figure of its own (js/paintfolk76.js rigs every painted person) is posed as a plain standing body.
  const GENERIC = { body: BODY };
  function pose(id, anim, phase, o) {
    const c = C[id] || GENERIC;
    const B = o && o.stride ? Object.assign({}, c.body, { stride: o.stride }) : c.body, P = animate(c.attack || c.weapon || anim !== 'attack' ? anim : 'idle', phase, { stride: B.stride });
    if (anim === 'attack' && c.attack) c.attack(P);
    let wp = null;
    if (c.weapon) {
      wp = c.weapon(P, null); const pole = [-0.75, -0.45, -0.5];
      P.armR = { to: add(wp.M, mul(wp.d, wp.both ? 18 : -6)), pole };
      if (wp.both > 0.02) P.armL = { to: add(wp.M, mul(wp.d, -14)), pole: [0.75, -0.3, -0.6] };
    }
    const J0 = skeleton(B, P);
    resolveArm(P, J0, 'L'); resolveArm(P, J0, 'R');
    if (c.idleArms && (anim === 'idle' || anim === 'talk')) { const keep = anim === 'talk' ? P.armR : null; c.idleArms(P, J0); if (keep) { P.armR = keep; P.armL = { a: 0.05, b: 0.12, e: 0.35 }; } }
    return { B, P, J: skeleton(B, P), wp };
  }
  function render(id, anim, phase, yaw) {
    const c = C[id]; if (!c) return null;
    const q = pose(id, anim, phase);
    TH = yaw; CT = cos(yaw); ST = sin(yaw);
    clear(); c.draw(q.J, q.P, q.B, q.wp);
    return resolve();
  }
  const cache = new Map();
  function frame(id, anim, f, octant) {
    if (!C[id]) return null; const n = COUNT[anim] || COUNT.idle, k = ((f % n) + n) % n, o = ((octant % 8) + 8) % 8, key = id + '|' + anim + '|' + k + '|' + o;
    let s = cache.get(key); if (!s) { s = render(id, anim, k / n, o * PI / 4); cache.set(key, s); } return s;
  }
  return { W, H, COUNT, ids: () => Object.keys(C), has: (id) => !!C[id], canAttack: (id) => !!(C[id] && (C[id].attack || C[id].weapon)), render, frame, cache, pose };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = PIXELFOLK;

// ---------------------------------------------------------------- in the game
// The last link in the sprite chooser's chain: for a rigged person the frame comes from here, picked from what the
// body is doing (js/anim.js still decides walk / wind-up / strike; this only draws it). Art switch GFX.pixelfolk.
if (typeof GFX !== 'undefined') {
  if (GFX.pixelfolk === undefined) GFX.pixelfolk = false;   // off by default: the owner chose the painted look (js/paintfolk76.js moves the paintings)
  if (!Array.isArray(GFX.ART)) GFX.ART = [];
  if (!GFX.ART.includes('pixelfolk')) GFX.ART.push('pixelfolk');
}
if (typeof animDirectionalSprite === 'function' && typeof Engine !== 'undefined') (() => {
  const _dir = animDirectionalSprite, STRIDE = 1.15;            // map units walked per full walk cycle
  // what a body is doing, as an animation, a frame and a side: shared with js/paintfolk76.js
  PIXELFOLK.choose = function (e, cam) {
    const T = typeof ANIM !== 'undefined' ? ANIM.T : 0, seed = e._seed || 0;
    const heading = Number.isFinite(e.facing) ? e.facing : Math.atan2(cam.y - e.y, cam.x - e.x);
    const rel = Math.atan2(cam.y - e.y, cam.x - e.x) - heading, octant = ((Math.round(-rel / (Math.PI / 4)) % 8) + 8) % 8;
    if (e._pfx != null) { const d = Math.hypot(e.x - e._pfx, e.y - e._pfy); if (d < 1) e._pfd = (e._pfd || 0) + d; }
    e._pfx = e.x; e._pfy = e.y;
    const pose = e.animSprite && e.animSprite.startsWith(e.sprite) ? e.animSprite.slice(e.sprite.length) : '';
    let anim = 'idle', f = Math.floor(T * 2 + seed * 3);
    if ((pose === '_a1' || pose === '_a2') && PIXELFOLK.canAttack(e.sprite)) {
      if (pose === '_a1') { if (e._pfa !== 1) { e._pfa = 1; e._pft = T; } f = Math.min(2, Math.floor((T - e._pft) * 9)); }
      else { e._pfa = 2; e._pft = T; f = 3; }
      anim = 'attack';
    } else if (e._pfa === 2 && T - e._pft < 0.22) { anim = 'attack'; f = T - e._pft < 0.11 ? 4 : 5; }
    else {
      e._pfa = 0;
      if ((e.animHurt || 0) > 0.35) { anim = 'hurt'; f = 0; }
      else if ((e._spd || 0) > 0.25) { anim = 'walk'; f = Math.floor((e._pfd || 0) / STRIDE * PIXELFOLK.COUNT.walk); }
      else if (typeof DLG !== 'undefined' && typeof G !== 'undefined' && G.state === 'dialogue' && DLG.ent === e) { anim = 'talk'; f = Math.floor(T * 7); }
    }
    return { anim, f, octant };
  };
  PIXELFOLK.pick = function (e, cam) { const q = PIXELFOLK.choose(e, cam); return PIXELFOLK.frame(e.sprite, q.anim, q.f, q.octant); };
  animDirectionalSprite = function (e) {
    try {
      if (GFX.pixelfolk !== false && e && !e.deathArt && PIXELFOLK.has(e.sprite) && (e.kind === 'npc' || e.kind === 'enemy' || e.pixelfolk)) {
        const sprite = PIXELFOLK.pick(e, Engine.cam);
        if (sprite) { e.animSX = 1; e.animSY = 1; e.animSkew = 0; e.animLift = 0; return { sprite, flip: false }; }
      }
    } catch (err) { /* fall through to the painted art */ }
    return _dir.apply(this, arguments);
  };
})();

// the Options row (Options -> Graphics & access)
if (typeof renderAccessibilityMenu === 'function' && typeof document !== 'undefined') (() => {
  const _acc = renderAccessibilityMenu;
  renderAccessibilityMenu = function () {
    const r = _acc.apply(this, arguments);
    try {
      const grid = document.querySelector('#modal-panel .ctl-grid');
      if (grid && !document.getElementById('gfx-pixelfolk')) {
        const label = document.createElement('span'); label.className = 'gfx-label'; label.appendChild(document.createTextNode('Pixel folk (pilot) '));
        const sm = document.createElement('small'); sm.className = 'muted'; sm.textContent = 'Kaelen, Lyra, the orchardmen and the Legionnaires drawn as pixel art with moving limbs, from eight sides'; label.appendChild(sm);
        const b = document.createElement('button'); b.className = 'dfbtn small'; b.id = 'gfx-pixelfolk'; b.type = 'button'; b.setAttribute('aria-label', 'Pixel folk');
        const sync = () => { b.textContent = GFX.pixelfolk !== false ? 'On' : 'Off'; b.setAttribute('aria-pressed', GFX.pixelfolk !== false ? 'true' : 'false'); };
        b.onclick = () => { GFX.pixelfolk = GFX.pixelfolk === false; if (typeof GFX.changed === 'function') GFX.changed(); sync(); };
        sync(); grid.appendChild(label); grid.appendChild(b);
      }
    } catch (e) { /* the menu still opens without the row */ }
    return r;
  };
})();
if (typeof window !== 'undefined') window.PIXELFOLK = PIXELFOLK;
