// ============================================================
//  paintfolk76 — Phase 76 pilot, "the paintings, moving": the painted people keep their paintings and get real limbs.
//
//  Owner, 11 Nov: "can you give the paintings the same updated movement next. I like that art style much better I
//  just want the visuals to look more crisp in game". So the art here IS the game's own painted sprite, and the
//  movement is the skeleton of js/pixelfolk75.js (its walk, idle, talk, hurt and strikes).
//
//  How: 1. the painting is enlarged twice over with a sharp filter (smooth curves between the old pixels, then an
//          unsharp pass), so a figure close to the eye has four times the pixels to show;
//       2. it is cut into parts along a rig laid over it by hand (head, chest, coat or apron, upper and lower arms,
//          thighs, shins and boots, a weapon), and every part is given depth: thick in the middle, thin at its edge,
//          so an arm is a rounded arm and not a card;
//       3. each frame the skeleton's pose turns every part about its own joint in three dimensions, and the picture
//          is made by looking through the parts pixel by pixel (the nearest surface wins). Standing still and seen
//          from the front the result is the painting itself; walking, the knees fold, the arms swing, the coat hangs.
//          From the side and the back the same parts are seen edge-on and from behind (hair, cloth and plate carried
//          round from the painting's own colours).
//
//  PAINTFOLK.has(id)                       rigged, and its painting is loaded (pilot: kaelen, townsman, legionnaire, lyra)
//  PAINTFOLK.frame(id, anim, f, octant)    -> an engine sprite { w, h, data, hs, cx, emit } (cached, least-recent dropped)
//  PAINTFOLK.render(id, anim, phase, yaw)  uncached
//  PAINTFOLK.source(id, sprite)            give a painting by hand (tests, tools); in the game Engine.sprites is read
//  Art switch GFX.paintfolk (Options -> Graphics & access, "Moving paintings"). Nothing is saved; no game random numbers.
// ============================================================
'use strict';

const PAINTFOLK = (() => {
  const PF = typeof PIXELFOLK !== 'undefined' ? PIXELFOLK : (typeof require === 'function' ? require('./pixelfolk75.js') : null);
  const K = 2, SH = 160;                                        // enlargement; the painting's height in the engine's unit
  const PI = Math.PI, sin = Math.sin, cos = Math.cos, max = Math.max, min = Math.min, abs = Math.abs, hyp = Math.hypot;

  // ---------------------------------------------------------------- the rigs (painting pixels: x right, y down)
  // parts: [name, bone, segments [[x0, y0, x1, y1, r], ...], { ymin, ymax, xmax, pri, cap, back }]
  const limbs = (o) => ({ pri: 0.75, back: 'mirror', ...o });
  const RIGS = {
    kaelen: {
      w: 60, cx: 29, hair: 8,
      J: { root: [29, 72], neck: [29, 22], shR: [14, 28], shL: [44, 28], elbowR: [9, 52], elbowL: [50, 52], handR: [7, 82], handL: [55, 88], hipR: [22, 76], hipL: [36, 76], kneeR: [20, 110], kneeL: [38, 110], ankleR: [17, 150], ankleL: [42, 150] },
      parts: [
        ['head', 'head', [[29, 5, 29, 16, 10]], { ymax: 21, cap: 9, back: 'hair' }],
        ['torso', 'torso', [[29, 23, 29, 66, 14]], { cap: 10, back: 'edge' }],
        ['skirt', 'pelvis', [[29, 70, 29, 124, 24]], { ymin: 60, ymax: 129, cap: 12, back: 'edge' }],
        ['armUR', 'armUR', [[14, 28, 9, 52, 6]], limbs({ cap: 5 })], ['armFR', 'armFR', [[9, 52, 7, 84, 5.5]], limbs({ cap: 4 })],
        ['armUL', 'armUL', [[44, 28, 50, 52, 6]], limbs({ cap: 5 })], ['armFL', 'armFL', [[50, 52, 55, 88, 6]], limbs({ cap: 4.5 })],
        ['shinR', 'shinR', [[20, 110, 17, 152, 8]], limbs({ ymin: 127, cap: 6 })], ['shinL', 'shinL', [[38, 110, 42, 152, 8]], limbs({ ymin: 127, cap: 6 })],
      ],
      ghosts: [['thighR', 22, 76, 20, 110, 8], ['thighL', 36, 76, 38, 110, 8], ['shinR', 20, 110, 18.5, 130, 7.5], ['shinL', 38, 110, 40, 130, 7.5]],
      emit: (r, g, b) => b > r + 50 && g > r + 30, gen: { stride: 0.3 },
    },
    townsman: {
      w: 60, cx: 30, hair: 9,
      J: { root: [30, 74], neck: [30, 25], shR: [13, 32], shL: [47, 32], elbowR: [7, 56], elbowL: [53, 56], handR: [6, 86], handL: [53, 87], hipR: [22, 78], hipL: [38, 78], kneeR: [20, 112], kneeL: [39, 112], ankleR: [17, 150], ankleL: [42, 150] },
      parts: [
        ['head', 'head', [[30, 6, 30, 17, 11]], { ymax: 24, cap: 9, back: 'hair' }],
        ['torso', 'torso', [[30, 26, 30, 64, 15]], { cap: 11, back: 'edge' }],
        ['skirt', 'pelvis', [[30, 68, 30, 112, 20]], { ymin: 60, ymax: 117, cap: 12, back: 'edge' }],
        ['armUR', 'armUR', [[13, 32, 7, 56, 7]], limbs({ cap: 5.5 })], ['armFR', 'armFR', [[7, 56, 6, 88, 5.5]], limbs({ cap: 4 })],
        ['armUL', 'armUL', [[47, 32, 53, 56, 7]], limbs({ cap: 5.5 })], ['armFL', 'armFL', [[53, 56, 53, 89, 5.5]], limbs({ cap: 4 })],
        ['shinR', 'shinR', [[20, 112, 17, 152, 8]], limbs({ ymin: 114, cap: 6 })], ['shinL', 'shinL', [[39, 112, 42, 152, 8]], limbs({ ymin: 114, cap: 6 })],
      ],
      ghosts: [['thighR', 22, 78, 20, 114, 8.5], ['thighL', 38, 78, 39, 114, 8.5]], gen: { stride: 0.32 },
    },
    legionnaire: {
      w: 66, cx: 39,
      J: { root: [39, 84], neck: [39, 44], shR: [22, 50], shL: [56, 50], elbowR: [15, 64], elbowL: [60, 72], handR: [14, 74], handL: [61, 95], hipR: [32, 94], hipL: [47, 94], kneeR: [30, 118], kneeL: [49, 118], ankleR: [28, 150], ankleL: [50, 150] },
      parts: [
        ['head', 'head', [[39, 18, 39, 36, 13]], { ymax: 43, cap: 11, back: 'mirror' }],
        ['torso', 'torso', [[39, 46, 39, 78, 15]], { cap: 11, back: 'mirror' }],
        ['pelvis', 'pelvis', [[39, 82, 39, 94, 14]], { ymin: 76, ymax: 101, cap: 11, back: 'mirror' }],
        ['weapon', 'weapon', [[15, 3, 17, 159, 2.4], [11, 22, 11, 42, 12, { xmax: 25, ymax: 47 }]], { pri: 0.55, cap: 1.6, back: 'mirror' }],
        ['armUR', 'armUR', [[22, 50, 15, 64, 7]], limbs({ cap: 6 })], ['armFR', 'armFR', [[15, 64, 14, 75, 6.5]], limbs({ cap: 5, pri: 0.5 })],
        ['armUL', 'armUL', [[56, 50, 60, 72, 7]], limbs({ cap: 6 })], ['armFL', 'armFL', [[60, 72, 61, 96, 6.5]], limbs({ cap: 5 })],
        ['thighR', 'thighR', [[32, 96, 30, 118, 8]], limbs({ ymin: 96, cap: 6.5 })], ['shinR', 'shinR', [[30, 118, 28, 152, 8]], limbs({ cap: 6 })],
        ['thighL', 'thighL', [[47, 96, 49, 118, 8]], limbs({ ymin: 96, cap: 6.5 })], ['shinL', 'shinL', [[49, 118, 50, 152, 8]], limbs({ cap: 6 })],
      ],
    },
    lyra: {
      w: 53, cx: 25, hair: 7, armsFixed: true,
      J: { root: [25, 76], neck: [25, 24], shR: [11, 34], shL: [40, 34], elbowR: [8, 58], elbowL: [43, 58], handR: [22, 56], handL: [28, 56], hipR: [20, 80], hipL: [31, 80], kneeR: [19, 114], kneeL: [32, 114], ankleR: [18, 152], ankleL: [33, 152] },
      parts: [
        ['head', 'head', [[25, 6, 25, 16, 10]], { ymax: 23, cap: 9, back: 'hair' }],
        ['torso', 'torso', [[25, 26, 25, 66, 26]], { ymax: 93, cap: 13, back: 'edge' }],
        ['skirt', 'pelvis', [[25, 74, 25, 146, 24]], { ymin: 66, ymax: 150, cap: 15, back: 'edge' }],
        ['shinR', 'shinR', [[19, 130, 18, 154, 6]], limbs({ ymin: 149, cap: 4 })], ['shinL', 'shinL', [[32, 130, 33, 154, 6]], limbs({ ymin: 149, cap: 4 })],
      ],
      ghosts: [['thighR', 20, 80, 19, 114, 9], ['thighL', 31, 80, 32, 114, 9], ['shinR', 19, 114, 18, 150, 8], ['shinL', 32, 114, 33, 150, 8]],
    },
  };

  // ---------------------------------------------------------------- 1. enlarge the painting, sharply
  const A_ = (c) => c >>> 24, R_ = (c) => c & 255, G_ = (c) => (c >>> 8) & 255, B_ = (c) => (c >>> 16) & 255;
  function enlarge(sp) {
    const w = sp.w, h = sp.h, W = w * K, H = h * K, src = sp.data, pm = new Float32Array(w * h * 4);
    for (let i = 0; i < w * h; i++) { const c = src[i], a = A_(c) >= 128 ? 1 : 0; pm[i * 4] = R_(c) * a; pm[i * 4 + 1] = G_(c) * a; pm[i * 4 + 2] = B_(c) * a; pm[i * 4 + 3] = a; }
    const cr = (t) => { const t2 = t * t, t3 = t2 * t; return [-0.5 * t3 + t2 - 0.5 * t, 1.5 * t3 - 2.5 * t2 + 1, -1.5 * t3 + 2 * t2 + 0.5 * t, 0.5 * t3 - 0.5 * t2]; };
    const up = new Float32Array(W * H * 3), al = new Uint8Array(W * H);
    for (let Y = 0; Y < H; Y++) {
      const fy = (Y + 0.5) / K - 0.5, y0 = Math.floor(fy), wy = cr(fy - y0);
      for (let X = 0; X < W; X++) {
        const fx = (X + 0.5) / K - 0.5, x0 = Math.floor(fx), wx = cr(fx - x0);
        let r = 0, g = 0, b = 0, a = 0;
        for (let j = 0; j < 4; j++) { const yy = min(h - 1, max(0, y0 - 1 + j)); for (let i = 0; i < 4; i++) { const xx = min(w - 1, max(0, x0 - 1 + i)), k = (yy * w + xx) * 4, wt = wy[j] * wx[i]; r += pm[k] * wt; g += pm[k + 1] * wt; b += pm[k + 2] * wt; a += pm[k + 3] * wt; } }
        const o = Y * W + X, near = src[min(h - 1, (Y / K) | 0) * w + min(w - 1, (X / K) | 0)];
        if (a >= 0.5) { al[o] = 1; if (a > 0.9) { up[o * 3] = r / a; up[o * 3 + 1] = g / a; up[o * 3 + 2] = b / a; } else if (A_(near) >= 128) { up[o * 3] = R_(near); up[o * 3 + 1] = G_(near); up[o * 3 + 2] = B_(near); } else { up[o * 3] = r / a; up[o * 3 + 1] = g / a; up[o * 3 + 2] = b / a; } }
      }
    }
    // unsharp mask (3x3 gaussian, only over the figure's own pixels)
    const out = new Uint32Array(W * H), G3 = [1, 2, 1, 2, 4, 2, 1, 2, 1], AMT = 0.85;
    for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
      const o = Y * W + X; if (!al[o]) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = X + i, yy = Y + j; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const q = yy * W + xx; if (!al[q]) continue; const wt = G3[(j + 1) * 3 + i + 1]; r += up[q * 3] * wt; g += up[q * 3 + 1] * wt; b += up[q * 3 + 2] * wt; n += wt; }
      const f = (c, bl) => { const v = c + AMT * (c - bl / n); return v < 0 ? 0 : v > 255 ? 255 : v | 0; };
      out[o] = (255 << 24 | f(up[o * 3 + 2], b) << 16 | f(up[o * 3 + 1], g) << 8 | f(up[o * 3], r)) >>> 0;
    }
    return { w: W, h: H, data: out, al };
  }

  // ---------------------------------------------------------------- 2. cut it into parts with depth
  function distSeg(px, py, s) { const dx = s[2] - s[0], dy = s[3] - s[1], l2 = dx * dx + dy * dy; let t = l2 ? ((px - s[0]) * dx + (py - s[1]) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; return hyp(px - s[0] - dx * t, py - s[1] - dy * t); }
  function build(id, sp, rig) {
    const img = enlarge(sp), W0 = img.w, H = img.h, ghosts = rig.ghosts || [], W = W0 * (1 + ghosts.length), N = W * H;
    // one wide sheet: the painting on the first page, each hidden part (a "ghost") on a page of its own to the right
    const data = new Uint32Array(N), al = new Uint8Array(N);
    for (let y = 0; y < H; y++) { data.set(img.data.subarray(y * W0, (y + 1) * W0), y * W); al.set(img.al.subarray(y * W0, (y + 1) * W0), y * W); }
    // distance to the silhouette's edge (two-pass chamfer), in enlarged pixels
    const dist = new Float32Array(N);
    for (let i = 0; i < N; i++) dist[i] = al[i] ? 1e6 : 0;
    const pass = (x0, x1, dx, y0, y1, dy) => { for (let y = y0; y !== y1; y += dy) for (let x = x0; x !== x1; x += dx) { const i = y * W + x; if (!dist[i]) continue; let d = dist[i]; const e = (xx, yy, c) => { const v = xx < 0 || yy < 0 || xx >= W0 || yy >= H ? 0 : dist[yy * W + xx]; if (v + c < d) d = v + c; }; e(x - dx, y, 1); e(x, y - dy, 1); e(x - dx, y - dy, 1.414); e(x + dx, y - dy, 1.414); dist[i] = d; } };
    pass(0, W0, 1, 0, H, 1); pass(W0 - 1, -1, -1, H - 1, -1, -1);
    // every pixel goes to the part whose bone it is nearest (measured in that bone's own thickness)
    const owner = new Int8Array(N).fill(-1), parts = rig.parts.map(([name, bone, segs, o]) => ({ name, bone, segs, o: o || {}, off: 0 }));
    for (let y = 0; y < H; y++) for (let x = 0; x < W0; x++) {
      const i = y * W + x; if (!al[i]) continue;
      const px = (x + 0.5) / K, py = (y + 0.5) / K; let best = 1e9, bi = -1, any = 1e9, ai = -1;
      for (let p = 0; p < parts.length; p++) {
        const P = parts[p], o = P.o;
        for (const s of P.segs) {
          const so = s[5] || {}, d = distSeg(px, py, s) / s[4] * (o.pri || 1);
          if (d < any) { any = d; ai = p; }
          if ((o.ymin != null && py < o.ymin) || (o.ymax != null && py > o.ymax) || (so.xmax != null && px > so.xmax) || (so.ymax != null && py > so.ymax)) continue;
          if (d < best) { best = d; bi = p; }
        }
      }
      owner[i] = bi < 0 ? ai : bi;
    }
    const thick = new Float32Array(N);
    parts.forEach((P, p) => { const cap = (P.o.cap || 6) * K; P.cap = cap; for (let y = 0; y < H; y++) for (let x = 0; x < W0; x++) { const i = y * W + x; if (owner[i] !== p) continue; const d = min(cap, dist[i]); thick[i] = max(0.9, Math.sqrt(max(0, 2 * cap * d - d * d))); } });
    // ghosts: a copy of the cloth where the hidden limb lies, shaped as a round limb
    ghosts.forEach(([bone, x0, y0, x1, y1, r], g) => {
      const p = parts.length, off = W0 * (g + 1), seg = [x0, y0, x1, y1, r];
      parts.push({ name: 'ghost-' + bone + g, bone, segs: [seg], o: { back: 'mirror', ghost: true }, off, cap: r * K * 0.82 });
      for (let y = 0; y < H; y++) for (let x = 0; x < W0; x++) {
        if (!al[y * W + x]) continue; const d = distSeg((x + 0.5) / K, (y + 0.5) / K, seg); if (d > r) continue;
        const i = y * W + x + off; al[i] = 1; data[i] = data[y * W + x]; owner[i] = p; thick[i] = max(0.9, Math.sqrt(r * r - d * d) * K * 0.82);
      }
    });
    parts.forEach((P, p) => {
      let x0 = W, x1 = -1, y0 = H, y1 = -1; P.id = p; P.rowL = new Int16Array(H).fill(-1); P.rowR = new Int16Array(H).fill(-1);
      for (let y = 0; y < H; y++) for (let x = P.off; x < P.off + W0; x++) if (owner[y * W + x] === p) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (P.rowL[y] < 0) P.rowL[y] = x; P.rowR[y] = x; }
      P.box = [x0, x1, y0, y1]; P.empty = x1 < 0;
    });
    let emit = null;
    if (rig.emit) { emit = new Uint8Array(N); for (let i = 0; i < N; i++) if (al[i]) { const c = data[i]; if (rig.emit(R_(c), G_(c), B_(c))) emit[i] = 1; } }
    const v3 = (p) => [(p[0] - rig.cx) * K, 0, (sp.h - p[1]) * K], J0 = {};
    for (const k in rig.J) J0[k] = v3(rig.J[k]);
    return { id, rig, poseId: rig.pose || id, spH: sp.h, hs0: sp.hs || 1, dy0: sp.dy || 0, data, W, W0, H, owner, thick, parts: parts.filter((P) => !P.empty), J0, emit, hairRow: (rig.hair || 0) * K };
  }

  // ---------------------------------------------------------------- 3. pose and draw
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const nrm = (a) => { const l = hyp(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const mm = (a, b) => { const o = new Array(9); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]; return o; };
  const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
  const rz = (a) => [cos(a), -sin(a), 0, sin(a), cos(a), 0, 0, 0, 1], rx = (a) => [1, 0, 0, 0, cos(a), -sin(a), 0, sin(a), cos(a)];
  function fromTo(a, b) {                                       // the smallest turn that takes direction a to direction b
    a = nrm(a); b = nrm(b); const v = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], c = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    if (c < -0.9999) return [-1, 0, 0, 0, 1, 0, 0, 0, -1];
    const k = 1 / (1 + c), [x, y, z] = v;
    return [1 - k * (y * y + z * z), k * x * y - z, k * x * z + y, k * x * y + z, 1 - k * (x * x + z * z), k * y * z - x, k * x * z - y, k * y * z + x, 1 - k * (x * x + y * y)];
  }
  const refs = new Map();
  function transforms(M, anim, phase) {
    const id = M.id, rig = M.rig, J0 = M.J0;
    let ref = refs.get(id); if (!ref) { ref = PF.pose(M.poseId, 'idle', 0, rig.gen); refs.set(id, ref); }
    const cur = PF.pose(M.poseId, anim, phase, rig.gen), A = ref.J, Bj = cur.J, P = cur.P, P0 = ref.P;
    const d = (J, a, b) => sub(J[b], J[a]), turn = (a, b) => fromTo(d(A, a, b), d(Bj, a, b));
    const Rp = rz((P.twP || 0) - (P0.twP || 0));
    const Rt = mm(fromTo(d(A, 'root', 'neck'), d(Bj, 'root', 'neck')), rz((P.twC || 0) - (P0.twC || 0)));
    const Rh = mm(fromTo(d(A, 'root', 'neck'), d(Bj, 'root', 'neck')), mm(rz((P.headYaw || 0) - (P0.headYaw || 0) + 0.35 * ((P.twC || 0) - (P0.twC || 0))), rx(-((P.headPitch || 0) - (P0.headPitch || 0)))));   // the head follows the lean, and only a little of the chest's twist: the eyes stay on the target
    const T = {}, set = (bone, R, c, j0) => { T[bone] = { R, c, j0 }; };
    const root = add(J0.root, [(Bj.root[0] - A.root[0]) * K, (Bj.root[1] - A.root[1]) * K, 0]);
    const breath = [0, 0, ((P.breath || 0) - (P0.breath || 0)) * K * 0.7];
    const at = (c, R, from, to) => add(c, mv(R, sub(J0[to], J0[from])));
    set('pelvis', Rp, root, J0.root); set('torso', Rt, add(root, breath), J0.root);
    const neck = add(at(root, Rt, 'root', 'neck'), breath); set('head', Rh, neck, J0.neck);
    const low = [];
    for (const k of ['R', 'L']) {
      const fixed = rig.armsFixed, Ru = fixed ? Rt : turn('sh' + k, 'elbow' + k), Rf = fixed ? Rt : turn('elbow' + k, 'hand' + k);
      const sh = add(at(root, Rt, 'root', 'sh' + k), breath), el = add(sh, mv(Ru, sub(J0['elbow' + k], J0['sh' + k]))), hand = add(el, mv(Rf, sub(J0['hand' + k], J0['elbow' + k])));
      set('armU' + k, Ru, sh, J0['sh' + k]); set('armF' + k, Rf, el, J0['elbow' + k]);
      if (k === 'R' && cur.wp && ref.wp) set('weapon', fromTo(ref.wp.d, cur.wp.d), hand, J0.handR);
      const Rth = turn('hip' + k, 'knee' + k), Rs = turn('knee' + k, 'ankle' + k);
      const hip = at(root, Rp, 'root', 'hip' + k), knee = add(hip, mv(Rth, sub(J0['knee' + k], J0['hip' + k])));
      set('thigh' + k, Rth, hip, J0['hip' + k]); set('shin' + k, Rs, knee, J0['knee' + k]);
      const a0 = J0['ankle' + k], heel = add(knee, mv(Rs, sub([a0[0], 0, 0], J0['knee' + k]))), toe = add(knee, mv(Rs, sub([a0[0], 7 * K, 0], J0['knee' + k])));
      low.push(heel[2], toe[2]);
    }
    const dz = -min(...low);                                    // the lower foot stands on the ground
    for (const k in T) T[k].c = [T[k].c[0], T[k].c[1], T[k].c[2] + dz];
    return T;
  }

  const SW = 640, SHH = 440, GX = 320, GY = 420;                 // scratch picture; the ground line
  const zb = new Float32Array(SW * SHH), cb = new Uint32Array(SW * SHH), eb = new Uint8Array(SW * SHH);
  function shade(c, k) { return (255 << 24 | ((B_(c) * k) | 0) << 16 | ((G_(c) * k) | 0) << 8 | ((R_(c) * k) | 0)) >>> 0; }
  function backColour(M, P, ix, iy) {
    const W = M.W, data = M.data, own = M.owner, mode = P.o.back;
    if (mode === 'hair' && M.hairRow) { let y = Math.round(P.box[2] + 2 + (iy - P.box[2]) * (M.hairRow - 4) / max(1, P.box[3] - P.box[2])); for (let n = 0; n < 6 && own[y * W + ix] !== P.id && y > P.box[2]; n++) y--; if (own[y * W + ix] === P.id) return shade(data[y * W + ix], 0.84); let x = ix; const mid = (P.box[0] + P.box[1]) >> 1; for (let n = 0; n < 12 && own[y * W + x] !== P.id; n++) x += x < mid ? 1 : -1; return shade(data[y * W + x], 0.84); }
    if (mode === 'edge' && P.rowL[iy] >= 0) {                   // cloth carried round the back: the strip at each side, folded back and forth across
      const L = P.rowL[iy], Rr = P.rowR[iy], mid = (L + Rr) / 2, half = (Rr - L) / 2, band = max(3, min(half, 7 * K)), left = ix < mid;
      let t = (left ? ix - L : Rr - ix) % (2 * band); if (t > band) t = 2 * band - t;
      const xx = min(Rr, max(L, Math.round(left ? L + 1 + t : Rr - 1 - t)));
      if (own[iy * W + xx] === P.id) return shade(data[iy * W + xx], 0.8);
    }
    return shade(data[iy * W + ix], 0.78);
  }
  function render(id, anim, phase, yaw) {
    const M = model(id); if (!M) return null;
    const T = transforms(M, anim, phase), W = M.W, H = M.H, own = M.owner, thick = M.thick, data = M.data, cxk = M.rig.cx * K;
    const erx = cos(yaw), ery = -sin(yaw), ed = [sin(yaw), cos(yaw), 0];
    zb.fill(-1e9); cb.fill(0); if (M.emit) eb.fill(0);
    let bx0 = SW, bx1 = -1, by0 = SHH;
    for (const P of M.parts) {
      const t = T[P.bone]; if (!t) continue;
      const R = t.R, cap = P.cap, pid = P.id, j0x = t.j0[0] + P.off, j0y = t.j0[1], j0z = t.j0[2], c = t.c;
      // rest-space ray for picture pixel (u, v): origin = base + u * a + v * b, direction D (R transposed times the view)
      const Dx = R[0] * ed[0] + R[3] * ed[1], Dy = R[1] * ed[0] + R[4] * ed[1], Dz = R[2] * ed[0] + R[5] * ed[1];
      const ax = R[0] * erx + R[3] * ery, ay = R[1] * erx + R[4] * ery, az = R[2] * erx + R[5] * ery, bxx = R[6], bxy = R[7], bxz = R[8];
      const basex = j0x - (R[0] * c[0] + R[3] * c[1] + R[6] * c[2]), basey = j0y - (R[1] * c[0] + R[4] * c[1] + R[7] * c[2]), basez = j0z - (R[2] * c[0] + R[5] * c[1] + R[8] * c[2]);
      const X0 = P.box[0] - cxk - 1, X1 = P.box[1] + 1 - cxk + 1, Z0 = H - 1 - P.box[3] - 1, Z1 = H - P.box[2] + 1;
      let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
      for (let n = 0; n < 8; n++) { const qx = (n & 1 ? X1 : X0) - j0x, qy = (n & 2 ? cap : -cap) - j0y, qz = (n & 4 ? Z1 : Z0) - j0z, wx = c[0] + R[0] * qx + R[1] * qy + R[2] * qz, wy = c[1] + R[3] * qx + R[4] * qy + R[5] * qz, wz = c[2] + R[6] * qx + R[7] * qy + R[8] * qz, u = wx * erx + wy * ery; if (u < u0) u0 = u; if (u > u1) u1 = u; if (wz < v0) v0 = wz; if (wz > v1) v1 = wz; }
      const px0 = max(0, Math.floor(GX + u0)), px1 = min(SW - 1, Math.ceil(GX + u1)), py0 = max(0, Math.floor(GY - v1)), py1 = min(SHH - 1, Math.ceil(GY - v0));
      const side = abs(Dy) < 0.5, nearR = Dx > 0, back = P.o.back;
      const iDx = abs(Dx) < 1e-6 ? 0 : 1 / Dx, iDy = abs(Dy) < 1e-6 ? 0 : 1 / Dy, iDz = abs(Dz) < 1e-6 ? 0 : 1 / Dz;
      for (let py = py0; py <= py1; py++) { const v = GY - py - 0.5; for (let px = px0; px <= px1; px++) {
        const u = px + 0.5 - GX, ox = basex + u * ax + v * bxx, oy = basey + u * ay + v * bxy, oz = basez + u * az + v * bxz;
        let ta = -1e9, tb = 1e9, t1, t2;
        if (iDx) { t1 = (X0 - ox) * iDx; t2 = (X1 - ox) * iDx; if (t1 > t2) { const q = t1; t1 = t2; t2 = q; } if (t1 > ta) ta = t1; if (t2 < tb) tb = t2; } else if (ox < X0 || ox > X1) continue;
        if (iDy) { t1 = (-cap - oy) * iDy; t2 = (cap - oy) * iDy; if (t1 > t2) { const q = t1; t1 = t2; t2 = q; } if (t1 > ta) ta = t1; if (t2 < tb) tb = t2; } else if (oy < -cap || oy > cap) continue;
        if (iDz) { t1 = (Z0 - oz) * iDz; t2 = (Z1 - oz) * iDz; if (t1 > t2) { const q = t1; t1 = t2; t2 = q; } if (t1 > ta) ta = t1; if (t2 < tb) tb = t2; } else if (oz < Z0 || oz > Z1) continue;
        if (ta > tb) continue;
        const o = py * SW + px, zmin = zb[o]; if (tb <= zmin) continue; if (ta < zmin) ta = zmin;
        for (let tt = tb; tt >= ta; tt -= 0.5) {
          const ix = Math.floor(ox + tt * Dx + cxk), iy = Math.floor(H - (oz + tt * Dz));
          if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
          const i = iy * W + ix; if (own[i] !== pid) continue;
          const y = oy + tt * Dy, th = thick[i]; if (y > th || y < -th) continue;
          let col;
          if (side && P.rowL[iy] >= 0) {                        // seen edge-on: the painting's own cloth carried round the flank
            const L = P.rowL[iy], Rr = P.rowR[iy], half = (Rr - L) / 2, yn = min(1, abs(y) / cap), xt = min(Rr, max(L, Math.round(nearR ? Rr - 1 - yn * half * 0.8 : L + 1 + yn * half * 0.8)));
            col = own[iy * W + xt] === pid ? (y < 0 ? (back === 'hair' ? backColour(M, P, xt, iy) : shade(data[iy * W + xt], 0.82)) : shade(data[iy * W + xt], 0.94)) : data[i];
          } else col = y < -0.25 * th && th > 1.2 ? backColour(M, P, ix, iy) : data[i];
          zb[o] = tt; cb[o] = col; if (M.emit) eb[o] = M.emit[i];
          if (px < bx0) bx0 = px; if (px > bx1) bx1 = px; if (py < by0) by0 = py;
          break;
        }
      } }
    }
    if (bx1 < 0) return null;
    if ((bx1 - bx0 + 1) & 1) { if (bx0 > 0) bx0--; else bx1++; } if ((GY - by0) & 1) by0--;      // even sizes: the half-size copy covers exactly the same ground
    const w = bx1 - bx0 + 1, h = GY - by0, out = new Uint32Array(w * h); let emit = null;
    for (let y = 0; y < h; y++) { const s = (by0 + y) * SW + bx0; out.set(cb.subarray(s, s + w), y * w); }
    if (M.emit) { emit = new Uint8Array(w * h); let any = false; for (let y = 0; y < h; y++) { const s = (by0 + y) * SW + bx0; for (let x = 0; x < w; x++) if (eb[s + x]) { emit[y * w + x] = 1; any = true; } } if (!any) emit = null; }
    return { w, h, data: out, emit, _mask: emit, hs: h / (M.spH * K) * M.hs0, cx: (GX - bx0) / w, dy: M.dy0, paintfolk: true };
  }

  // ---------------------------------------------------------------- models and frames
  // ---------------------------------------------------------------- a rig for anyone: read off the painting itself
  // The four pilot paintings have rigs laid by hand (RIGS). A painting with the same outline as one of them (the many
  // recoloured orchardmen) borrows that rig. Anyone else is measured: where the head ends, where the legs part, whether
  // the arms hang clear of the body. The rule is caution: a part only moves on its own when the painting shows it
  // standing clear; a robe, a shawl, a jug held to the chest or a staff stays in one piece and moves with the body.
  function autorig(sp) {
    const w = sp.w, h = sp.h, d = sp.data, on = (x, y) => (d[y * w + x] >>> 24) >= 128;
    const runs = (y) => { const r = []; if (y < 0 || y >= h) return r; let s = -1; for (let x = 0; x <= w; x++) { const o = x < w && on(x, y); if (o && s < 0) s = x; else if (!o && s >= 0) { if (x - s >= 2) r.push([s, x - 1]); s = -1; } } return r; };
    let top = -1, bot = -1; for (let y = 0; y < h; y++) if (runs(y).length) { if (top < 0) top = y; bot = y; }
    if (top < 0) return null; const H = bot - top + 1;
    if (H < 90 || w < 24 || w > 100 || H / w < 1.6 || bot < h - 8) return null;                 // not a person standing
    const Y = (f) => Math.round(top + f * H), wide = (y) => { let b = null; for (const r of runs(y)) if (!b || r[1] - r[0] > b[1] - b[0]) b = r; return b; }, mid = (r) => (r[0] + r[1]) / 2, len = (r) => r[1] - r[0] + 1;
    let headW = 0, hx = 0, n = 0; for (let y = top; y < Y(0.12); y++) { const r = wide(y); if (r) { headW = max(headW, len(r)); hx += mid(r); n++; } } hx /= n || 1;
    let neckY = Y(0.145), nw = 1e9; for (let y = Y(0.09); y <= Y(0.2); y++) { const r = wide(y); if (r && len(r) < nw) { nw = len(r); neckY = y; } }
    if (nw > headW * 0.85) neckY = Y(0.145);                                                      // a hood, or hair to the shoulders
    const hr = min(headW / 2, 0.075 * H);
    let cx = 0, m = 0; for (let y = Y(0.2); y < Y(0.5); y++) { const r = wide(y); if (r) { cx += mid(r); m++; } } cx = m ? cx / m : w / 2;
    const half = (f) => { const r = wide(Y(f)); return r ? len(r) / 2 : w / 4; };
    // legs: do they part, and from where
    const legRows = []; for (let y = Y(0.8); y <= Y(0.93); y++) legRows.push(runs(y));
    const two = legRows.filter((r) => r.length === 2 && r.every((q) => len(q) >= 0.035 * H)).length / legRows.length, many = legRows.filter((r) => r.length >= 3).length / legRows.length;
    const split = two >= 0.6 && many < 0.3;
    const kneeY = Y(0.71), hipY = Y(0.5), ankleY = Y(0.94), waistY = Y(0.4);
    let xa = [cx - 0.11 * w, cx + 0.11 * w], lr = 0.045 * H, splitTop = bot, feetTop = 0;
    if (split) {
      const r = runs(Y(0.9)); if (r.length === 2) { xa = [mid(r[0]), mid(r[1])]; lr = max(len(r[0]), len(r[1])) / 2 + 1.5; }
      splitTop = Y(0.8); while (splitTop > Y(0.45) && runs(splitTop - 1).length === 2) splitTop--;
    } else { let y = bot; while (y > Y(0.88) && runs(y).length !== 2) y--; if (runs(y).length === 2) { const r = runs(y); xa = [mid(r[0]), mid(r[1])]; feetTop = y; while (feetTop > Y(0.88) && runs(feetTop - 1).length === 2) feetTop--; } }
    const trousers = split && splitTop <= Y(0.6), hipX = [cx - (cx - xa[0]) * 0.8, cx + (xa[1] - cx) * 0.8], kneeX = [(hipX[0] + xa[0]) / 2, (hipX[1] + xa[1]) / 2];
    // arms: only when they hang clear of the body on both sides
    let armRows = 0, tot = 0; const ex = [0, 0], ew = [0, 0];
    for (let y = Y(0.3); y <= Y(0.44); y++) { tot++; const r = runs(y); if (r.length !== 3) continue; const wa = len(r[0]), wb = len(r[1]), wc = len(r[2]); if (wb >= 0.09 * H && wa >= 0.02 * H && wa <= 0.09 * H && wc >= 0.02 * H && wc <= 0.09 * H) { armRows++; ex[0] += mid(r[0]); ex[1] += mid(r[2]); ew[0] = max(ew[0], wa); ew[1] = max(ew[1], wc); } }
    const arms = armRows / tot >= 0.7;
    const J = { root: [cx, Y(0.47)], neck: [cx, neckY], shR: [cx - half(0.22) * 0.8, Y(0.2)], shL: [cx + half(0.22) * 0.8, Y(0.2)], elbowR: [cx - half(0.3) * 0.9, Y(0.36)], elbowL: [cx + half(0.3) * 0.9, Y(0.36)], handR: [cx - half(0.3) * 0.9, Y(0.52)], handL: [cx + half(0.3) * 0.9, Y(0.52)],
      hipR: [hipX[0], hipY], hipL: [hipX[1], hipY], kneeR: [kneeX[0], kneeY], kneeL: [kneeX[1], kneeY], ankleR: [xa[0], ankleY], ankleL: [xa[1], ankleY] };
    const parts = [['head', 'head', [[hx, top + hr, hx, max(top + hr, neckY - hr * 0.6), hr * 1.1]], { ymax: neckY + 1, cap: max(4, hr * 0.95), back: 'hair' }]], ghosts = [];
    const bodyHalf = half(0.3), tcap = max(6, min(13, bodyHalf * (arms ? 0.6 : 0.42)));
    if (arms) {
      for (const [k, i] of [['R', 0], ['L', 1]]) {
        const exx = ex[i] / armRows; let hy = Y(0.44), hxx = exx;
        for (let y = Y(0.44); y <= Y(0.62); y++) { const r = runs(y); const q = i ? r[r.length - 1] : r[0]; if (!q || r.length < 3 || abs(mid(q) - hxx) > 4) break; hy = y; hxx = mid(q); }
        const sh = [exx + (cx - exx) * 0.3, Y(0.2)], rr = ew[i] / 2 + 1;
        J['sh' + k] = sh; J['elbow' + k] = [exx, Y(0.36)]; J['hand' + k] = [hxx, hy];
        parts.push(['armU' + k, 'armU' + k, [[sh[0], sh[1], exx, Y(0.36), rr + 0.5]], limbs({ cap: rr * 0.8 })], ['armF' + k, 'armF' + k, [[exx, Y(0.36), hxx, hy + 2, rr]], limbs({ cap: rr * 0.75 })]);
      }
    }
    if (trousers) {
      parts.push(['torso', 'torso', [[cx, neckY + 3, cx, waistY, bodyHalf + (arms ? 0 : 5)]], { ymax: Y(0.45), cap: tcap, back: 'edge' }], ['pelvis', 'pelvis', [[cx, Y(0.44), cx, Y(0.5), bodyHalf + 2]], { ymin: Y(0.4), ymax: splitTop, cap: tcap, back: 'edge' }]);
      for (const [k, i] of [['R', 0], ['L', 1]]) parts.push(['thigh' + k, 'thigh' + k, [[hipX[i], hipY + 2, kneeX[i], kneeY, lr + 1]], limbs({ ymin: min(splitTop, hipY + 2), cap: lr * 0.8 })], ['shin' + k, 'shin' + k, [[kneeX[i], kneeY, xa[i], bot - 4, lr]], limbs({ cap: lr * 0.8 })]);
    } else {
      const skirtEnd = split ? splitTop : (feetTop ? feetTop - 1 : bot), scap = max(7, min(15, half(0.7) * 0.5));
      parts.push(['torso', 'torso', [[cx, neckY + 3, cx, waistY, arms ? bodyHalf : w * 0.5]], { ymax: Y(0.56), cap: tcap, back: 'edge' }], ['skirt', 'pelvis', [[cx, Y(0.47), cx, max(Y(0.5), skirtEnd - 3), half(0.7) + 3]], { ymin: Y(0.42), ymax: skirtEnd, cap: scap, back: 'edge' }]);
      if (split || feetTop) for (const [k, i] of [['R', 0], ['L', 1]]) parts.push(['shin' + k, 'shin' + k, [[kneeX[i], kneeY, xa[i], bot - 3, split ? lr : 6]], limbs({ ymin: skirtEnd + 1, cap: split ? lr * 0.8 : 4 })]);
      const gr = split ? lr + 0.5 : max(5.5, 0.05 * H), low = min(skirtEnd, bot - 2);
      for (const [k, i] of [['R', 0], ['L', 1]]) { ghosts.push(['thigh' + k, hipX[i], hipY, kneeX[i], kneeY, gr]); if (low > kneeY + 4) { const t = (low - kneeY) / max(1, ankleY - kneeY); ghosts.push(['shin' + k, kneeX[i], kneeY, kneeX[i] + (xa[i] - kneeX[i]) * min(1, t), low, gr - 0.5]); } }
    }
    return { w, cx, hair: max(3, Math.round(top + (neckY - top) * 0.36)), J, parts, ghosts, armsFixed: !arms, pose: '_generic', gen: { stride: trousers ? 0.33 : split ? 0.27 : 0.2 }, auto: trousers ? 'trousers' : split ? 'coat' : 'robe' };
  }
  function sameOutline(a, b) {
    if (!a || !b || a.w !== b.w || a.h !== b.h) return false; let diff = 0, n = 0;
    for (let i = 0; i < a.data.length; i++) { const x = (a.data[i] >>> 24) >= 128, y = (b.data[i] >>> 24) >= 128; if (x || y) { n++; if (x !== y) diff++; } }
    return n > 0 && diff / n < 0.03;
  }
  const NEVER = new Set(['orla', 'cat', 'p31_seated', 'p17p_solenne']);     // seated in her chair, an animal, a map marker, a winged figure (her wings would be cut as limbs)
  const models = new Map(), given = new Map(), rigOf = new Map();
  function rigFor(id, sp) {
    if (rigOf.has(id) && rigOf.get(id).src === sp.data) return rigOf.get(id).rig;
    let rig = null;
    if (!NEVER.has(id) && sp.data instanceof Uint32Array && sp.data.length === sp.w * sp.h) {
      if (RIGS[id] && sp.w === RIGS[id].w && sp.h === SH) rig = RIGS[id];
      else {
        const sprites = typeof Engine !== 'undefined' && Engine.sprites ? Engine.sprites : {};
        for (const base in RIGS) { const b = given.get(base) || sprites[base]; if (b && b !== sp && sameOutline(b, sp)) { rig = Object.assign({}, RIGS[base], { pose: base }); break; } }
        if (!rig) { try { rig = autorig(sp); } catch (e) { rig = null; } }
      }
    }
    rigOf.set(id, { src: sp.data, rig }); return rig;
  }
  function model(id) {
    if (!PF) return null;
    const sp = given.get(id) || (typeof Engine !== 'undefined' && Engine.sprites && Engine.sprites[id]);
    if (!sp || !(sp.data instanceof Uint32Array)) return null;
    let M = models.get(id); if (M && M.src === sp.data) return M;
    const rig = rigFor(id, sp); if (!rig) return null;
    M = build(id, sp, rig); M.src = sp.data; models.set(id, M); refs.delete(id);
    for (const k of Array.from(cache.keys())) if (k.startsWith(id + '|')) cache.delete(k);
    return M;
  }
  // in play a model is built in a quiet moment, one at a time; until then the still painting draws
  const queue = []; let pumping = false;
  function pump() { const id = queue.shift(); if (id == null) { pumping = false; return; } try { model(id); } catch (e) { /* stays a still painting */ } setTimeout(pump, 90); }
  function ready(id) {
    const sp = typeof Engine !== 'undefined' && Engine.sprites && Engine.sprites[id]; if (!sp) return false;
    const M = models.get(id); if (M && M.src === sp.data) return true;
    if (rigOf.has(id) && rigOf.get(id).src === sp.data && !rigOf.get(id).rig) return false;
    if (!queue.includes(id)) queue.push(id);
    if (!pumping) { pumping = true; setTimeout(pump, 30); }
    return false;
  }
  const cache = new Map(), CAP = (typeof navigator !== 'undefined' && navigator.deviceMemory && navigator.deviceMemory <= 4) ? 220 : 420, COUNT = PF ? PF.COUNT : {};
  function frame(id, anim, f, octant) {
    const n = COUNT[anim] || COUNT.idle, k = ((f % n) + n) % n, o = ((octant % 8) + 8) % 8, key = id + '|' + anim + '|' + k + '|' + o;
    let s = cache.get(key);
    if (s) { cache.delete(key); cache.set(key, s); return s; }
    s = render(id, anim, k / n, o * PI / 4); if (!s) return null;
    cache.set(key, s); if (cache.size > CAP) cache.delete(cache.keys().next().value);
    return s;
  }
  return { K, COUNT, ids: () => Object.keys(RIGS), has: (id) => !!model(id), ready, rigFor, autorig, source: (id, sp) => { given.set(id, sp); models.delete(id); rigOf.delete(id); }, render, frame, cache, model, canAttack: (id) => PF.canAttack(id), stats: () => ({ models: models.size, frames: cache.size, waiting: queue.length }) };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = PAINTFOLK;
if (typeof window !== 'undefined') window.PAINTFOLK = PAINTFOLK;

// ---------------------------------------------------------------- in the game
// The outermost link of the sprite chooser's chain. js/anim.js still decides what a body is doing; this draws it.
if (typeof GFX !== 'undefined') {
  if (GFX.paintfolk === undefined) GFX.paintfolk = true;
  if (!Array.isArray(GFX.ART)) GFX.ART = [];
  if (!GFX.ART.includes('paintfolk')) GFX.ART.push('paintfolk');
}
if (typeof animDirectionalSprite === 'function' && typeof Engine !== 'undefined' && typeof PIXELFOLK !== 'undefined' && PIXELFOLK.choose) (() => {
  const _dir = animDirectionalSprite; let tick = -1, made = 0;
  // a figure drawn small is given a smaller, smoothed copy of its frame: a sharp picture shrunk by skipping pixels sparkles
  const half = (s) => {
    if (s._half) return s._half; const w = s.w >> 1, h = s.h >> 1, d = new Uint32Array(w * h), em = s.emit ? new Uint8Array(w * h) : null, oy = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let r = 0, g = 0, b = 0, n = 0, e = 0; for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const k = (y * 2 + j + oy) * s.w + x * 2 + i, p = s.data[k]; if (p >>> 24) { r += p & 255; g += (p >> 8) & 255; b += (p >> 16) & 255; n++; if (s.emit && s.emit[k]) e++; } }
      if (n >= 2) { d[y * w + x] = ((255 << 24) | (((b / n) | 0) << 16) | (((g / n) | 0) << 8) | ((r / n) | 0)) >>> 0; if (em && e >= 2) em[y * w + x] = 1; } }
    return (s._half = { w, h, data: d, emit: em, _mask: em, hs: s.hs, cx: s.cx, paintfolk: true });
  };
  animDirectionalSprite = function (e) {
    try {
      if (GFX.paintfolk !== false && e && !e.deathArt && (e.kind === 'npc' || (e.kind === 'enemy' && e.sprite === 'legionnaire') || e.paintfolk) && e.sprite && PAINTFOLK.ready(e.sprite)) {
        const cam = Engine.cam, q = PIXELFOLK.choose(e, cam), T = typeof ANIM !== 'undefined' ? ANIM.T : 0;
        if (T !== tick) { tick = T; made = 0; }
        const key = e.sprite + '|' + q.anim + '|' + (((q.f % PAINTFOLK.COUNT[q.anim]) + PAINTFOLK.COUNT[q.anim]) % PAINTFOLK.COUNT[q.anim]) + '|' + q.octant;
        let s = PAINTFOLK.cache.get(key);
        if (!s) { if (made < 2 || !e._pk) { s = PAINTFOLK.frame(e.sprite, q.anim, q.f, q.octant); made++; } else s = e._pk; }   // at most two new pictures a frame: no hitching
        if (s) {
          e._pk = s; e.animSX = 1; e.animSY = 1; e.animSkew = 0; e.animLift = 0;
          const dist = Math.hypot(e.x - cam.x, e.y - cam.y), onScreen = 150 * (Engine.getScale ? Engine.getScale() : 1) / Math.max(0.2, dist) * (e.scale || 1) * s.hs;
          const r3d = typeof R3D !== 'undefined' && R3D.active && R3D.active();
          return { sprite: (r3d ? dist > 3.6 : onScreen < s.h * 0.72) ? half(s) : s, flip: false };   // far figures take a quarter of the atlas
        }
      }
    } catch (err) { /* fall through to the still painting */ }
    return _dir.apply(this, arguments);
  };
  if (typeof renderAccessibilityMenu === 'function' && typeof document !== 'undefined') {
    const _acc = renderAccessibilityMenu;
    renderAccessibilityMenu = function () {
      const r = _acc.apply(this, arguments);
      try {
        const grid = document.querySelector('#modal-panel .ctl-grid');
        if (grid && !document.getElementById('gfx-paintfolk')) {
          const label = document.createElement('span'); label.className = 'gfx-label'; label.appendChild(document.createTextNode('Moving paintings (pilot) '));
          const sm = document.createElement('small'); sm.className = 'muted'; sm.textContent = 'Kaelen, Lyra, the orchardmen and the Legionnaires keep their paintings, sharpened, and walk, talk and strike with real limbs'; label.appendChild(sm);
          const b = document.createElement('button'); b.className = 'dfbtn small'; b.id = 'gfx-paintfolk'; b.type = 'button'; b.setAttribute('aria-label', 'Moving paintings');
          const sync = () => { b.textContent = GFX.paintfolk !== false ? 'On' : 'Off'; b.setAttribute('aria-pressed', GFX.paintfolk !== false ? 'true' : 'false'); };
          b.onclick = () => { GFX.paintfolk = GFX.paintfolk === false; if (typeof GFX.changed === 'function') GFX.changed(); sync(); };
          sync(); grid.appendChild(label); grid.appendChild(b);
        }
      } catch (e) { /* the menu still opens without the row */ }
      return r;
    };
  }
})();
