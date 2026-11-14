// ============================================================
//  SCENERY — barrels, crates, carts, broken statues, graves and bones
//  Procedural stand-in art (painted at load time, no assets) and a placement
//  pass that never blocks a route: each solid prop is only accepted if a
//  flood-fill of the walkable grid still reaches the spawn, every door, NPC,
//  item, trigger and usable deco that was reachable before it went down.
//  Every prop is a transient deco appended after all builds (see ROADMAP.md,
//  "More barrels, crates, carts, broken statues, graves and bones").
// ============================================================
'use strict';

const SCENERY = (() => {
  const RES = 2;            // walk-grid nodes per cell (half-cell steps)
  const WALKER = 0.24;      // the player's corner probe radius in solidAt()
  const SPAWN_ENTRY = 'spawn';

  // ---------------------------------------------------------------- art
  // STAND-IN ART: every sprite below is painted procedurally with canvas 2D and
  // then hardened to the game's painted-pixel look (hard alpha, light noise,
  // dark outline, dithered contact shadow). Final painted sprites replace them.
  function hash2(x, y) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function paint(w, h, draw, opts) {
    opts = opts || {};
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d', { willReadFrequently: true });
    draw(c, w, h);
    const id = c.getImageData(0, 0, w, h), u8 = id.data, n = w * h;
    // hard alpha first, so the outline and shadow passes read a clean mask
    const solid = new Uint8Array(n);
    for (let i = 0; i < n; i++) solid[i] = u8[i * 4 + 3] >= 110 ? 1 : 0;
    const outline = opts.outline == null ? 0.58 : opts.outline, noise = opts.noise == null ? 0.16 : opts.noise;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, o = i * 4;
      if (!solid[i]) { u8[o + 3] = 0; continue; }
      let k = 1 + (hash2(x, y) - 0.5) * noise;
      if (outline < 1 && (x === 0 || y === 0 || x === w - 1 || y === h - 1 || !solid[i - 1] || !solid[i + 1] || !solid[i - w] || !solid[i + w])) k *= outline;
      u8[o] = Math.min(255, u8[o] * k); u8[o + 1] = Math.min(255, u8[o + 1] * k); u8[o + 2] = Math.min(255, u8[o + 2] * k); u8[o + 3] = 255;
    }
    if (opts.shadow) {
      // a checkerboard of dark pixels under the prop reads as a soft contact shadow
      const s = opts.shadow;
      for (let y = Math.max(0, (s.cy - s.ry) | 0); y < Math.min(h, s.cy + s.ry + 1); y++) for (let x = Math.max(0, (s.cx - s.rx) | 0); x < Math.min(w, s.cx + s.rx + 1); x++) {
        const dx = (x - s.cx) / s.rx, dy = (y - s.cy) / s.ry, i = y * w + x;
        if (dx * dx + dy * dy <= 1 && !solid[i] && ((x + y) & 1) === 0) { u8[i * 4] = 16; u8[i * 4 + 1] = 14; u8[i * 4 + 2] = 11; u8[i * 4 + 3] = 255; }
      }
    }
    return new Uint32Array(id.data.buffer);
  }
  function poly(c, col, pts) { c.fillStyle = col; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.fill(); }
  function line(c, col, lw, x0, y0, x1, y1) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
  function ell(c, col, cx, cy, rx, ry, stroke, lw) { c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); if (stroke) { c.strokeStyle = col; c.lineWidth = lw || 1; c.stroke(); } else { c.fillStyle = col; c.fill(); } }
  function grad(c, x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); for (const [t, col] of stops) g.addColorStop(t, col); return g; }
  function reg(name, w, h, data) { Engine.addSprite(name, { w, h, data, hs: 1, cx: 0.5, dy: 0 }); }

  const WOOD = ['#2f1f12', '#6b4a2a', '#8c6439', '#9a7240'];
  function barrelBody(c, open) {
    // staves bulge around the belly; two iron hoops follow the curve
    const hw = (y) => 17 + 5 * Math.sin(Math.PI * (y - 12) / 46);
    c.beginPath(); c.moveTo(7, 12); c.bezierCurveTo(1, 26, 1, 44, 7, 57); c.quadraticCurveTo(24, 65, 41, 57); c.bezierCurveTo(47, 44, 47, 26, 41, 12); c.closePath();
    c.fillStyle = grad(c, 1, 0, 47, 0, [[0, '#3a2616'], [0.28, '#7a5232'], [0.5, WOOD[2]], [0.78, WOOD[1]], [1, WOOD[0]]]); c.fill();
    c.strokeStyle = 'rgba(30,18,10,.55)'; c.lineWidth = 1;
    for (let k = 1; k < 7; k++) { const xt = 7 + k * 34 / 7; c.beginPath(); c.moveTo(xt, 13); c.quadraticCurveTo(24 + (xt - 24) * 1.2, 36, xt, 59 - 2 * Math.abs(xt - 24) / 17); c.stroke(); }
    for (const y of [23, 49]) {
      c.beginPath(); c.moveTo(24 - hw(y), y); c.quadraticCurveTo(24, y + 5, 24 + hw(y), y); c.strokeStyle = '#2f3035'; c.lineWidth = 3.4; c.stroke();
      c.beginPath(); c.moveTo(24 - hw(y) + 2, y - 1); c.quadraticCurveTo(24, y + 3.5, 24 + hw(y) - 2, y - 1); c.strokeStyle = '#6a6b72'; c.lineWidth = 1; c.stroke();
    }
    if (open) {
      ell(c, '#1b130b', 24, 12, 17, 6);
      ell(c, '#2d3626', 24, 13, 12, 3.4);                       // a skin of something green on the dregs
      ell(c, WOOD[3], 24, 12, 17, 6, true, 2.4);
      ell(c, '#4a3118', 24, 12, 14.6, 4.6, true, 1);
    } else {
      ell(c, '#9a7240', 24, 12, 17, 6);
      ell(c, '#4a3118', 24, 12, 17, 6, true, 2);
      line(c, 'rgba(60,38,20,.7)', 1, 12, 10, 36, 14); line(c, 'rgba(60,38,20,.7)', 1, 10, 13, 34, 17);
    }
  }
  function makeBarrels() {
    reg('p_barrel', 48, 64, paint(48, 64, (c) => barrelBody(c, false), { shadow: { cx: 24, cy: 60, rx: 22, ry: 4 } }));
    reg('p_barrel_open', 48, 64, paint(48, 64, (c) => barrelBody(c, true), { shadow: { cx: 24, cy: 60, rx: 22, ry: 4 } }));
    // a barrel on its side with its dregs run out across the ground
    reg('p_barrel_side', 72, 48, paint(72, 48, (c) => {
      ell(c, '#2a1c12', 58, 42, 12, 3.5);
      c.beginPath(); c.moveTo(8, 12); c.bezierCurveTo(22, 5, 38, 5, 52, 12); c.lineTo(52, 40); c.bezierCurveTo(38, 47, 22, 47, 8, 40); c.closePath();
      c.fillStyle = grad(c, 0, 5, 0, 46, [[0, WOOD[2]], [0.45, WOOD[1]], [1, WOOD[0]]]); c.fill();
      c.strokeStyle = 'rgba(30,18,10,.5)'; c.lineWidth = 1;
      for (let k = 1; k < 5; k++) { const y = 8 + k * 8; c.beginPath(); c.moveTo(9, y); c.quadraticCurveTo(30, y + (k - 2.5) * 1.3, 52, y); c.stroke(); }
      for (const x of [16, 40]) { c.beginPath(); c.moveTo(x, 8); c.quadraticCurveTo(x + 3, 26, x, 44); c.strokeStyle = '#2f3035'; c.lineWidth = 3.2; c.stroke(); }
      ell(c, '#9a7240', 52, 26, 6, 14); ell(c, '#4a3118', 52, 26, 6, 14, true, 2); ell(c, '#6b4a2a', 52, 26, 2.5, 6);
    }, { shadow: { cx: 34, cy: 44, rx: 30, ry: 3 } }));
  }
  function makeCrate() {
    reg('p_crate', 56, 56, paint(56, 56, (c) => {
      poly(c, '#5a4026', [[40, 18], [50, 12], [50, 46], [40, 52]]);
      poly(c, '#a07e4e', [[6, 18], [16, 12], [50, 12], [40, 18]]);
      c.fillStyle = '#7a5a34'; c.fillRect(6, 18, 34, 34);
      for (const y of [29, 40]) line(c, '#3a2816', 1.2, 6, y, 40, y);
      c.strokeStyle = '#4a331c'; c.lineWidth = 3; c.strokeRect(8, 20, 30, 30);
      line(c, '#5a3f22', 3, 9, 21, 37, 49);
      for (const [x, y] of [[9, 21], [37, 21], [9, 49], [37, 49]]) { c.fillStyle = '#b9b2a0'; c.fillRect(x - 1, y - 1, 2, 2); }
      line(c, 'rgba(255,230,180,.25)', 1, 16, 12.5, 49, 12.5);
    }, { shadow: { cx: 28, cy: 53, rx: 25, ry: 3 } }));
  }
  function wheel(c, cx, cy, r, spokes, broken) {
    c.strokeStyle = '#2c2a2b'; c.lineWidth = 3.6; c.beginPath(); c.arc(cx, cy, r, broken ? 0.35 : 0, broken ? Math.PI * 1.75 : Math.PI * 2); c.stroke();
    c.strokeStyle = '#8a6038'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, r - 3.4, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < spokes; i++) { const a = i / spokes * Math.PI * 2 + 0.3; if (broken && i % 3 === 1) continue; line(c, '#7a5632', 1.8, cx, cy, cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3)); }
    ell(c, '#4a3a2a', cx, cy, 4, 4); ell(c, '#1d1814', cx, cy, 1.5, 1.5);
  }
  function sack(c, cx, cy, rx, ry, col) { ell(c, col, cx, cy, rx, ry); ell(c, 'rgba(40,30,15,.45)', cx + rx * 0.2, cy + ry * 0.3, rx * 0.8, ry * 0.6); ell(c, col, cx - rx * 0.1, cy - ry * 0.1, rx * 0.8, ry * 0.7); line(c, 'rgba(60,45,20,.7)', 1, cx - rx * 0.5, cy - ry * 0.6, cx + rx * 0.4, cy - ry * 0.7); }
  function makeCarts() {
    reg('p_cart', 100, 76, paint(100, 76, (c) => {
      line(c, '#4a331c', 3.4, 14, 40, 0, 66); line(c, '#5a3f22', 3, 17, 35, 3, 62);              // the shafts, dropped on the ground
      poly(c, '#7a5632', [[12, 28], [86, 24], [82, 47], [16, 49]]);
      for (const y of [33, 40]) line(c, '#3a2816', 1.2, 14, y, 84, y - 1);
      line(c, '#4a331c', 3, 11, 28, 87, 24);
      sack(c, 30, 21, 13, 9, '#b3a171'); sack(c, 54, 18, 14, 10, '#a89466'); sack(c, 74, 21, 11, 8, '#bfae7e');
      wheel(c, 48, 55, 17, 8, false);
    }, { shadow: { cx: 50, cy: 73, rx: 40, ry: 3 } }));
    reg('p_cart_broken', 100, 76, paint(100, 76, (c) => {
      // the bed slumped onto the ground on one side, a spar jutting, a wheel lying flat
      poly(c, '#6b4a2a', [[4, 56], [72, 28], [80, 46], [14, 70]]);
      for (const t of [0.3, 0.62]) line(c, '#3a2816', 1.2, 4 + t * 10, 56 + t * 14, 72 + t * 8, 28 + t * 18);
      line(c, '#4a331c', 3, 4, 56, 72, 28);
      line(c, '#5a3f22', 3.2, 72, 28, 88, 14); line(c, '#3a2816', 1.4, 86, 15, 90, 10);
      wheel(c, 78, 56, 15, 8, true);
      c.save(); c.translate(38, 70); c.scale(1, 0.36); c.strokeStyle = '#2c2a2b'; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, 18, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = '#8a6038'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 14.6, 0, Math.PI * 2); c.stroke();
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; line(c, '#7a5632', 2, 0, 0, Math.cos(a) * 14, Math.sin(a) * 14); } c.restore();
      sack(c, 24, 66, 11, 6, '#a89466'); sack(c, 92, 70, 7, 4, '#b3a171');
      c.fillStyle = '#c9b27a'; for (const [x, y] of [[40, 74], [46, 73], [52, 75], [58, 74], [84, 74], [96, 74]]) c.fillRect(x, y, 2, 1);
    }, { shadow: { cx: 50, cy: 73, rx: 44, ry: 3 } }));
  }
  const STONE = ['#3b3e3f', '#5c5f5e', '#8a8c88', '#a9aba4'], MOSS = '#4d6b3a';
  function makeStatues() {
    reg('p_statue_broken', 56, 100, paint(56, 100, (c) => {
      // a robed figure sheared off at the shoulders, its plinth cracked, moss climbing
      poly(c, STONE[1], [[8, 78], [48, 78], [48, 98], [8, 98]]);
      poly(c, STONE[2], [[6, 74], [50, 74], [48, 80], [8, 80]]);
      line(c, STONE[0], 1.2, 30, 80, 27, 98); line(c, STONE[0], 1.2, 27, 98, 22, 92);
      c.beginPath(); c.moveTo(17, 76); c.lineTo(18, 54); c.lineTo(22, 43); c.lineTo(26, 37); c.lineTo(29, 42); c.lineTo(34, 36); c.lineTo(38, 43); c.lineTo(39, 54); c.lineTo(41, 76); c.closePath();
      c.fillStyle = grad(c, 17, 0, 41, 0, [[0, STONE[1]], [0.35, STONE[3]], [0.7, STONE[2]], [1, STONE[0]]]); c.fill();
      poly(c, STONE[2], [[18, 50], [10, 56], [9, 68], [13, 70], [16, 60]]);                  // one arm hangs, snapped at the wrist
      line(c, STONE[0], 1.2, 22, 46, 24, 76); line(c, STONE[0], 1.2, 29, 48, 31, 76); line(c, STONE[0], 1.2, 35, 47, 36, 76);
      line(c, '#2a2c2c', 1.2, 24, 52, 33, 60);
      poly(c, MOSS, [[8, 90], [14, 86], [20, 92], [18, 98], [8, 98]]); poly(c, MOSS, [[34, 70], [40, 66], [41, 76], [35, 76]]); poly(c, '#5f7f45', [[10, 78], [18, 78], [14, 82]]);
      poly(c, STONE[1], [[44, 92], [52, 94], [50, 98], [43, 98]]);                            // a chunk of the missing head lies at its base
    }, { shadow: { cx: 28, cy: 97, rx: 26, ry: 3 } }));
    reg('p_statue_broken2', 72, 64, paint(72, 64, (c) => {
      // only the legs and plinth stand; the torso has toppled and lies beside them
      poly(c, STONE[1], [[6, 46], [34, 46], [34, 62], [6, 62]]); poly(c, STONE[2], [[4, 42], [36, 42], [34, 48], [6, 48]]);
      c.beginPath(); c.moveTo(10, 42); c.lineTo(11, 26); c.lineTo(15, 20); c.lineTo(19, 24); c.lineTo(22, 18); c.lineTo(26, 26); c.lineTo(28, 42); c.closePath();
      c.fillStyle = grad(c, 10, 0, 28, 0, [[0, STONE[1]], [0.4, STONE[3]], [1, STONE[0]]]); c.fill();
      line(c, STONE[0], 1.2, 17, 28, 18, 42); line(c, STONE[0], 1.2, 22, 30, 23, 42);
      c.save(); c.translate(54, 54); c.rotate(-0.12);
      c.beginPath(); c.moveTo(-14, -2); c.lineTo(12, -6); c.lineTo(15, 4); c.lineTo(-14, 8); c.closePath(); c.fillStyle = grad(c, 0, -8, 0, 10, [[0, STONE[3]], [1, STONE[0]]]); c.fill();
      ell(c, STONE[2], 14, -1, 3.5, 6); c.restore();
      poly(c, MOSS, [[34, 58], [42, 56], [48, 60], [46, 62], [34, 62]]); poly(c, MOSS, [[6, 56], [12, 54], [14, 62], [6, 62]]);
    }, { shadow: { cx: 36, cy: 61, rx: 34, ry: 3 } }));
    reg('p_statue_head', 36, 32, paint(36, 32, (c) => {
      c.save(); c.translate(18, 18); c.rotate(0.35);
      ell(c, STONE[2], 0, 0, 12, 10); ell(c, STONE[3], -2, -2, 8, 6);
      poly(c, STONE[0], [[-6, -1], [-2, -2], [-2, 2], [-6, 2]]); poly(c, STONE[0], [[2, -2], [6, -1], [6, 2], [2, 2]]);
      line(c, STONE[0], 1.4, 0, 0, 1, 6); line(c, STONE[0], 1.2, -4, 7, 3, 7);
      poly(c, MOSS, [[-12, 2], [-6, 6], [-9, 10], [-12, 8]]); c.restore();
    }, { shadow: { cx: 18, cy: 29, rx: 15, ry: 2.5 } }));
  }
  function makeBones() {
    reg('p_bones_small', 60, 26, paint(60, 26, (c) => {
      const bone = (x0, y0, x1, y1) => { line(c, '#8f845f', 4, x0, y0 + 0.8, x1, y1 + 0.8); line(c, '#cdbf9a', 3, x0, y0, x1, y1); ell(c, '#cdbf9a', x0, y0, 2.6, 2.6); ell(c, '#cdbf9a', x1, y1, 2.6, 2.6); };
      bone(6, 18, 30, 14); bone(24, 21, 50, 19); bone(34, 11, 52, 13);
      for (let i = 0; i < 4; i++) { c.strokeStyle = '#bfb18c'; c.lineWidth = 1.8; c.beginPath(); c.arc(16 + i * 3, 9, 6 - i * 0.6, Math.PI * 1.1, Math.PI * 1.95); c.stroke(); }
      ell(c, '#d6c9a5', 44, 8, 6.5, 5.5); ell(c, '#1d1814', 42, 8, 1.8, 2); ell(c, '#1d1814', 47, 8, 1.8, 2); poly(c, '#1d1814', [[43, 11], [46, 11], [44.5, 13]]);
    }, { shadow: { cx: 30, cy: 22, rx: 28, ry: 3 } }));
  }
  function paintAll() { makeBarrels(); makeCrate(); makeCarts(); makeStatues(); makeBones(); }
  try { paintAll(); } catch (e) { console.warn('scenery art failed', e); }

  // ---------------------------------------------------------------- what goes where
  // kind -> sprite choices, size and collision. Labels speak in the game's voice.
  const KINDS = {
    barrel: { sprites: [['p_barrel', 5], ['p_barrel_open', 2], ['p_barrel_side', 1.5]], scale: [0.46, 0.56], radius: 0.27, solid: true,
      labels: ['A cooper\'s barrel, hooped in rust. Something sloshes.', 'A barrel with a ring of old wine dried at the bottom.', 'A barrel the damp has swollen shut.'] },
    crate: { sprites: [['crates', 3], ['p_crate', 3]], scale: [0.5, 0.62], radius: 0.3, solid: true,
      labels: ['Crates stencilled with a tally nobody has settled.', 'A packing crate, nails still bright.', 'Stacked crates; the top one has been prised and re-nailed.'] },
    cart: { sprites: [['p_cart', 1]], scale: [0.74, 0.8], radius: 0.5, solid: true, labels: ['A hand-cart, shafts down, sacks still lashed on.'] },
    cart_broken: { sprites: [['p_cart_broken', 1]], scale: [0.78, 0.84], radius: 0.5, solid: true, labels: ['A broken cart. The axle went and somebody walked off without the load.'] },
    statue: { sprites: [['p_statue_broken', 3], ['p_statue_broken2', 2]], scale: [0.82, 0.95], radius: 0.36, solid: true, shallows: true,
      labels: ['A statue with no head. Moss has taken the shoulders.', 'A toppled statue. Someone chipped the face away on purpose.', 'Robed stone, sheared off at the neck.'] },
    statue_head: { sprites: [['p_statue_head', 1]], scale: [0.2, 0.26], radius: 0.12, solid: false, shallows: true, labels: ['A stone head, face-down in the wet.'] },
    grave: { sprites: [['grave', 1]], scale: [0.58, 0.66], radius: 0.26, solid: true, labels: ['A headstone, leaning. The name has been worn off by weather or by hand.'] },
    tomb: { sprites: [['tomb', 1]], scale: [0.6, 0.66], radius: 0.5, solid: true, labels: ['A sealed tomb. Whatever was sung here has long stopped.'] },
    bones: { sprites: [['bones', 3], ['p_bones_small', 3]], scale: [0.3, 0.4], radius: 0.2, solid: false, labels: ['Bones, picked clean and left where they fell.', 'The remains of something that did not get away.'] },
  };
  // zones: rect [x0,y0,x1,y1] or circle [cx,cy,r]; wall: hug a wall face; market: allowed mid-cobble
  const PLANS = {
    oakhaven: [
      { kind: 'cart', n: 1, circle: [57.4, 20.3, 1.2], market: true },
      { kind: 'barrel', n: 4, rect: [46.5, 14.5, 60, 21.4], market: true },
      { kind: 'crate', n: 4, rect: [46.5, 14.5, 60, 21.4], market: true },
      { kind: 'barrel', n: 2, circle: [44.5, 46.6, 2.2] },
      { kind: 'crate', n: 1, circle: [46.2, 47.6, 1.6] },
      { kind: 'cart', n: 1, circle: [30.5, 56.8, 2.0] },
      { kind: 'cart', n: 1, rect: [3, 12, 9, 25], wall: true },
      { kind: 'barrel', n: 5, rect: [3, 3, 45, 47], wall: true },
      { kind: 'crate', n: 3, rect: [3, 3, 45, 47], wall: true },
      { kind: 'barrel', n: 4, rect: [45, 3, 67, 47], wall: true },
      { kind: 'crate', n: 3, rect: [45, 3, 67, 47], wall: true },
      { kind: 'barrel', n: 3, rect: [10, 56, 20, 62], wall: true },
      { kind: 'barrel', n: 2, rect: [26, 55, 46, 62], wall: true },
      { kind: 'crate', n: 2, rect: [3, 51, 46, 62], wall: true },
    ],
    clearing: [
      { kind: 'cart_broken', n: 1, circle: [22.7, 27.2, 1.3] },
      { kind: 'bones', n: 5, circle: [17.5, 24.5, 2.7], gap: 0.7 },
      { kind: 'barrel', n: 2, circle: [24.2, 7.0, 1.8] },
      { kind: 'barrel', n: 1, circle: [9.6, 19.2, 1.4] },
    ],
    quarry: [
      { kind: 'barrel', n: 3, rect: [26.5, 26.5, 34.5, 32.5] },
      { kind: 'crate', n: 2, rect: [26.5, 26.5, 34.5, 32.5] },
      { kind: 'cart', n: 1, rect: [26.5, 26.5, 34.5, 32.5] },
      { kind: 'barrel', n: 2, rect: [6.5, 32.5, 12.5, 37.2] },
      { kind: 'crate', n: 2, rect: [6.5, 32.5, 12.5, 37.2] },
      { kind: 'barrel', n: 1, rect: [7.5, 9.5, 10.5, 12.5] },
      { kind: 'crate', n: 1, rect: [7.5, 9.5, 10.5, 12.5] },
    ],
    deepwoods: [
      { kind: 'statue', n: 4, circle: [27.5, 15.5, 5.5] },
      { kind: 'statue_head', n: 2, circle: [27.5, 15.5, 5.5] },
      { kind: 'grave', n: 6, circle: [27.5, 16.2, 7] },
      { kind: 'tomb', n: 1, circle: [32.5, 15.2, 2.2] },
      { kind: 'bones', n: 6, circle: [8.5, 43.5, 5], gap: 0.8 },
      { kind: 'bones', n: 2, circle: [28.5, 44, 2.2] },
    ],
    whispergrove: [
      { kind: 'statue', n: 6, rect: [14, 11, 34, 30] },
      { kind: 'statue_head', n: 3, rect: [14, 11, 34, 30] },
    ],
    catacombs: [
      { kind: 'bones', n: 6, rect: [13, 1, 26, 5], gap: 0.8 },
      { kind: 'bones', n: 4, rect: [3, 13, 35, 17] },
      { kind: 'bones', n: 3, rect: [13, 24, 24, 28] },
      { kind: 'grave', n: 3, rect: [28.5, 8.5, 34, 21] },
      { kind: 'grave', n: 2, rect: [2.5, 3.5, 8.5, 8.5] },
      { kind: 'tomb', n: 1, rect: [3, 3.5, 8, 8] },
    ],
  };
  // The routes a walker is most likely to use; solid props keep a clear lane around them.
  const ROUTES = {
    oakhaven: [[[23.5, 2.5], [23.5, 29]], [[23.5, 34.5], [23.5, 61]], [[3, 23.5], [66.5, 23.5]], [[53.5, 4], [53.5, 60]], [[9.5, 10.5], [9.5, 36]], [[37.5, 8], [37.5, 36]]],
    clearing: [[[20.5, 34.5], [20.5, 5.5]]],
    deepwoods: [[[27.5, 38.2], [27.5, 13.2]]],
    whispergrove: [[[24.5, 43.5], [24.5, 31]]],
    catacombs: [[[1.5, 14.5], [34.5, 14.5]]],
  };
  const ROUTE_PAD = 1.05, DOOR_CLEAR = 1.6;

  // ---------------------------------------------------------------- walk grid
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
  function stepUp() { return typeof STEP_UP !== 'undefined' ? STEP_UP : 0.36; }
  function maxGrade() { return typeof MAX_GRADE !== 'undefined' ? MAX_GRADE : 1.1; }
  // Entities that stand still and block a walker. Wanderers and enemies move,
  // so they are targets to reach rather than walls to path around.
  function blocksWalker(e) {
    if (e._scn || !e.solid || e.hidden || e.dead) return false;
    if (e.kind === 'enemy' || e.companion) return false;
    if (e.kind === 'npc' && e.wander) return false;
    return true;
  }
  function entriesOf(map, maps) {
    const out = [{ x: map.spawn.x, y: map.spawn.y }];
    if (!maps) return out;
    for (const id in maps) {
      const src = maps[id];
      for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
        const c = src.cells[y * src.w + x]; if (!c || !c.door || !c.portal || c.portal.map !== map.id) continue;
        const p = c.portal;
        if (p.useSpawn === 'shaft') { if (map.shaftReturn) out.push({ x: map.shaftReturn.x, y: map.shaftReturn.y }); else if (map.named && map.named.shaft) out.push({ x: map.named.shaft.cx + 0.5, y: map.named.shaft.cy + 1.2 }); }
        else if (p.useSpawn) continue;
        else if (isFinite(p.x) && isFinite(p.y)) out.push({ x: p.x, y: p.y });
      }
    }
    return out;
  }
  function targetsOf(map) {
    const groups = [];
    for (const k in map.doors) {
      const cx = k % map.w, cy = (k / map.w) | 0, pts = [];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (!map.isSolidCell(nx, ny) && nx >= 0 && ny >= 0 && nx < map.w && ny < map.h) pts.push([nx + 0.5, ny + 0.5, 0.55]); }
      if (pts.length) groups.push({ name: 'door ' + cx + ',' + cy, pts });
    }
    for (const e of map.entities) {
      if (e._scn || e.dead) continue;
      if (e.kind === 'npc') groups.push({ name: 'npc ' + (e.id || '?') + '@' + e.x + ',' + e.y, pts: [[e.x, e.y, (e.radius || 0.3) + 0.22 + 0.7]] });
      else if (e.kind === 'enemy') groups.push({ name: 'enemy ' + e.type + '@' + e.x + ',' + e.y, pts: [[e.x, e.y, 1.0]] });
      else if (e.kind === 'item') groups.push({ name: 'item ' + e.item + '@' + e.x + ',' + e.y, pts: [[e.x, e.y, 0.9]] });
      else if (e.kind === 'deco' && e.use) groups.push({ name: 'use ' + e.sprite + '@' + e.x + ',' + e.y, pts: [[e.x, e.y, 1.5 + (e.radius || 0)]] });
    }
    map.triggers.forEach((t, i) => groups.push({ name: 'trigger ' + (t.id || i) + '@' + t.x + ',' + t.y, pts: [[t.x, t.y, Math.min(t.r || 1, 1.2)]] }));
    return groups;
  }
  function makeCtx(map, entries) {
    const gw = map.w * RES, gh = map.h * RES, N = gw * gh;
    const cellBlocked = new Uint8Array(map.w * map.h);
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) cellBlocked[y * map.w + x] = map.isBlocked(x, y) ? 1 : 0;
    const isB = (x, y) => (x < 0 || y < 0 || x >= map.w || y >= map.h) ? 1 : cellBlocked[y * map.w + x];
    const pass = new Uint8Array(N), relief = !!(map.lvls || map.smooth);
    const gz = relief ? new Float32Array(N) : null, gr = map.smooth ? new Float32Array(N) : null;
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const x = (i + 0.5) / RES, y = (j + 0.5) / RES, o = j * gw + i;
      if (isB((x - WALKER) | 0, (y - WALKER) | 0) || isB((x + WALKER) | 0, (y - WALKER) | 0) || isB((x - WALKER) | 0, (y + WALKER) | 0) || isB((x + WALKER) | 0, (y + WALKER) | 0)) continue;
      pass[o] = 1;
      if (relief) { gz[o] = map.groundAt(x, y); if (gr) gr[o] = map.gradeAt(x, y); }
    }
    const ctx = { map, gw, gh, N, pass, gz, gr, relief, entries: entries, queue: new Int32Array(N), seen: new Uint8Array(N), groups: null, need: null, stamped: [] };
    for (const e of map.entities) if (blocksWalker(e)) stamp(ctx, e.x, e.y, (e.radius || 0.3) + 0.22, null);
    ctx.groups = targetsOf(map);
    ctx.need = ctx.groups.filter(g => groupHit(ctx, flood(ctx), g));
    return ctx;
  }
  // Mark the nodes inside a disc as blocked; `undo` collects the nodes it changed.
  function stamp(ctx, x, y, r, undo) {
    const r2 = r * r, i0 = Math.max(0, Math.floor((x - r) * RES - 0.5)), i1 = Math.min(ctx.gw - 1, Math.ceil((x + r) * RES - 0.5)), j0 = Math.max(0, Math.floor((y - r) * RES - 0.5)), j1 = Math.min(ctx.gh - 1, Math.ceil((y + r) * RES - 0.5));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dx = (i + 0.5) / RES - x, dy = (j + 0.5) / RES - y, o = j * ctx.gw + i;
      if (dx * dx + dy * dy < r2 && ctx.pass[o]) { ctx.pass[o] = 0; if (undo) undo.push(o); }
    }
  }
  function flood(ctx) {
    const { gw, gh, pass, gz, gr, seen, queue } = ctx; seen.fill(0);
    let qh = 0, qt = 0;
    for (const s of ctx.entries) {
      let best = -1, bd = 1.5 * 1.5;
      const i0 = Math.max(0, Math.floor((s.x - 1.5) * RES)), i1 = Math.min(gw - 1, Math.ceil((s.x + 1.5) * RES)), j0 = Math.max(0, Math.floor((s.y - 1.5) * RES)), j1 = Math.min(gh - 1, Math.ceil((s.y + 1.5) * RES));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const o = j * gw + i; if (!pass[o]) continue; const dx = (i + 0.5) / RES - s.x, dy = (j + 0.5) / RES - s.y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = o; } }
      if (best >= 0 && !seen[best]) { seen[best] = 1; queue[qt++] = best; }
    }
    const up = stepUp(), mg = maxGrade();
    while (qh < qt) {
      const o = queue[qh++], i = o % gw, j = (o / gw) | 0;
      for (let k = 0; k < 4; k++) {
        const ni = k === 0 ? i + 1 : k === 1 ? i - 1 : i, nj = k === 2 ? j + 1 : k === 3 ? j - 1 : j;
        if (ni < 0 || nj < 0 || ni >= gw || nj >= gh) continue;
        const n = nj * gw + ni; if (seen[n] || !pass[n]) continue;
        if (gz) { const rise = gz[n] - gz[o]; if (rise > up) continue; if (gr && rise > 0.02 && gr[n] > mg) continue; }
        seen[n] = 1; queue[qt++] = n;
      }
    }
    return seen;
  }
  function groupHit(ctx, seen, g) {
    for (const [x, y, r] of g.pts) {
      const i0 = Math.max(0, Math.floor((x - r) * RES - 0.5)), i1 = Math.min(ctx.gw - 1, Math.ceil((x + r) * RES - 0.5)), j0 = Math.max(0, Math.floor((y - r) * RES - 0.5)), j1 = Math.min(ctx.gh - 1, Math.ceil((y + r) * RES - 0.5));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        if (!seen[j * ctx.gw + i]) continue;
        const dx = (i + 0.5) / RES - x, dy = (j + 0.5) / RES - y; if (dx * dx + dy * dy <= r * r) return true;
      }
    }
    return false;
  }
  function missing(ctx) { const seen = flood(ctx); return ctx.need.filter(g => !groupHit(ctx, seen, g)).map(g => g.name); }
  // A prop blocks like solidAt() sees it: its radius plus the walker's 0.22, with a
  // little slack so a placed prop never leaves a gap only a pixel-perfect walker fits.
  const stampRadius = (r) => r + 0.22 + 0.1;

  // The reachability test, exposed for tests: everything that could be reached
  // from the spawn (and the arrivals of other maps' portals) without props must
  // still be reachable with every solid prop of `map` standing.
  function reachable(map, maps) {
    const ctx = makeCtx(map, map._scnEntries || entriesOf(map, maps));
    for (const e of (map._scn || [])) if (e.solid) stamp(ctx, e.x, e.y, stampRadius(e.radius || 0.3), null);
    const miss = missing(ctx);
    return { ok: miss.length === 0, missing: miss, checked: ctx.need.length, props: (map._scn || []).length };
  }

  // ---------------------------------------------------------------- placement
  function floorName(map, cx, cy) {
    if (map.floorCells && map.floorTextures) { const t = map.floorTextures[map.floorCells[cy * map.w + cx]]; if (t) return t; }
    return map.floor;
  }
  function pick(rng, list) { let sum = 0; for (const [, w] of list) sum += w; let t = rng() * sum; for (const [v, w] of list) { t -= w; if (t <= 0) return v; } return list[0][0]; }
  function segDist(px, py, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy; let t = l2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
  }
  function sample(map, rng, item) {
    let x, y;
    if (item.circle) { const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * item.circle[2]; x = item.circle[0] + Math.cos(a) * r; y = item.circle[1] + Math.sin(a) * r; }
    else { const r = item.rect; x = r[0] + rng() * (r[2] - r[0]); y = r[1] + rng() * (r[3] - r[1]); }
    if (!item.wall) return { x, y };
    // snap against the nearest wall face, a little off it
    const cx = Math.floor(x), cy = Math.floor(y), dirs = [];
    if (cx < 1 || cy < 1 || cx >= map.w - 1 || cy >= map.h - 1 || map.get(cx, cy)) return null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = map.get(cx + dx, cy + dy); if (c && !c.door) dirs.push([dx, dy]); }
    if (!dirs.length) return null;
    const d = dirs[(rng() * dirs.length) | 0], along = (rng() - 0.5) * 0.5;
    return d[0] ? { x: cx + 0.5 + d[0] * 0.14, y: cy + 0.5 + along } : { x: cx + 0.5 + along, y: cy + 0.5 + d[1] * 0.14 };
  }
  function acceptable(map, ctx, kind, item, x, y, placed, routes, doorsAt) {
    const cx = Math.floor(x), cy = Math.floor(y);
    if (cx < 1 || cy < 1 || cx >= map.w - 1 || cy >= map.h - 1 || map.isBlocked(cx, cy)) return false;
    const tex = floorName(map, cx, cy);
    if (tex === 't_water' || (tex === 't_shallows' && !kind.shallows)) return false;
    // keep the prop's whole footprint on open ground
    const fr = Math.max(kind.radius, 0.2);
    for (const [dx, dy] of [[fr, 0], [-fr, 0], [0, fr], [0, -fr]]) if (map.isBlocked(Math.floor(x + dx), Math.floor(y + dy))) return false;
    if (map.lvls || map.smooth) {
      const g0 = map.groundAt(x, y);
      for (const [dx, dy] of [[0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]]) if (Math.abs(map.groundAt(x + dx, y + dy) - g0) > 0.08) return false;
      if (map.gradeAt(x, y) > 0.25) return false;
    }
    // never on a road's centre line: a cobble cell with cobble on both sides is the middle of the road
    if (tex === 't_cobble' && !item.market) {
      const t = (ox, oy) => floorName(map, cx + ox, cy + oy) === 't_cobble';
      if ((t(-1, 0) && t(1, 0)) || (t(0, -1) && t(0, 1))) return false;
    }
    for (const d of doorsAt) if (Math.hypot(x - d[0], y - d[1]) < DOOR_CLEAR) return false;
    for (const a of (routes || [])) if (segDist(x, y, a[0], a[1]) < ROUTE_PAD + (kind.solid ? 0 : -0.35)) return false;
    const gap = item.gap || 0.9;
    for (const p of placed) if (Math.hypot(x - p.x, y - p.y) < Math.max(gap, (p.radius || 0.2) + kind.radius + 0.35)) return false;
    for (const e of map.entities) {
      if (e._scn) continue;
      const d = Math.hypot(x - e.x, y - e.y);
      if (e.kind === 'npc' || e.kind === 'enemy' || e.kind === 'item' || e.use) { if (d < 1.1) return false; }
      else if (e.solid) { if (d < (e.radius || 0.3) + kind.radius + 0.45) return false; }
      else if (d < 0.55) return false;
    }
    for (const t of map.triggers) if (Math.hypot(x - t.x, y - t.y) < 0.9) return false;
    return true;
  }
  function makeProp(kindName, kind, rng, x, y) {
    const sprite = pick(rng, kind.sprites), s = kind.scale[0] + rng() * (kind.scale[1] - kind.scale[0]);
    const e = { kind: 'deco', sprite, x, y, scale: s, radius: kind.radius, solid: kind.solid, transient: true, nopick: true, _scn: kindName, label: kind.labels[(rng() * kind.labels.length) | 0] };
    if (sprite === 'p_barrel_side') e.radius = 0.3;
    return e;
  }
  function placeMap(map, maps, cache) {
    const id = map.id, plan = PLANS[id];
    if (!plan || map._scnPlaced) return;
    map._scnPlaced = true; map._scn = [];
    const key = id + '|' + map.name + '|' + map.baseCount + '|' + map.w + 'x' + map.h;
    const cached = cache[key];
    if (cached) { for (const s of cached) addProp(map, Object.assign({}, s)); map._scnEntries = entriesOf(map, maps); return; }
    const rng = mulberry32(hashStr(id) ^ 0x5CE9E), routes = ROUTES[id] || [];
    const entries = entriesOf(map, maps); map._scnEntries = entries;
    const ctx = makeCtx(map, entries);
    const doorsAt = []; for (const k in map.doors) doorsAt.push([(k % map.w) + 0.5, ((k / map.w) | 0) + 0.5]);
    const specs = [];
    for (const item of plan) {
      const kind = KINDS[item.kind];
      for (let n = 0; n < item.n; n++) {
        for (let tries = 0; tries < 160; tries++) {
          const pt = sample(map, rng, item); if (!pt) continue;
          if (!acceptable(map, ctx, kind, item, pt.x, pt.y, map._scn, routes, doorsAt)) continue;
          const e = makeProp(item.kind, kind, rng, +pt.x.toFixed(2), +pt.y.toFixed(2));
          if (e.solid) {
            const undo = []; stamp(ctx, e.x, e.y, stampRadius(e.radius), undo);
            if (missing(ctx).length) { for (const o of undo) ctx.pass[o] = 1; continue; }
          }
          addProp(map, e); specs.push(Object.assign({}, e));
          break;
        }
      }
    }
    cache[key] = specs;
  }
  function addProp(map, e) {
    e.hidden = !GFX.scenery;
    map._scn.push(e); if (GFX.scenery) map.entities.push(e);
  }

  const S = {
    KINDS, PLANS, ROUTES, DOOR_CLEAR, cache: {},
    place(maps) { for (const id in maps) { try { placeMap(maps[id], maps, S.cache); } catch (err) { console.warn('scenery placement failed on ' + id, err); } } S.sync(maps); },
    reachable,
    propsOf(map) { return (map && map._scn) || []; },
    // After anim.js sweeps transient entities away on a map change, put this map's props back.
    ensure(map) {
      if (!map || !map._scn || !map._scn.length || !GFX.scenery) return;
      const have = new Set(map.entities);
      for (const e of map._scn) if (!have.has(e)) map.entities.push(e);
      S.sync();
    },
    // With the toggle off the props are hidden (so they neither render nor collide) and also
    // taken out of the entity list, so a build with scenery off carries no transient decos at all.
    sync(maps) {
      const want = !GFX.scenery; S._shown = GFX.scenery;
      const lists = []; if (typeof G !== 'undefined' && G.maps) for (const id in G.maps) lists.push(G.maps[id]); if (maps) for (const id in maps) lists.push(maps[id]);
      for (const m of lists) {
        if (!m._scn || !m._scn.length) continue;
        for (const e of m._scn) e.hidden = want;
        const mine = new Set(m._scn);
        if (want) { for (let i = m.entities.length - 1; i >= 0; i--) if (mine.has(m.entities[i])) m.entities.splice(i, 1); }
        else if (typeof G !== 'undefined' && G.map === m) { const have = new Set(m.entities); for (const e of m._scn) if (!have.has(e)) m.entities.push(e); }
      }
    },
    entriesOf,
  };

  // ---------------------------------------------------------------- hooks
  if (typeof GFX !== 'undefined') GFX.onChange(() => { try { S.sync(); } catch (e) { /* never break a frame */ } });
  // appended after every other builder, so saved entity indexes never shift
  const _buildAllMaps = buildAllMaps;
  buildAllMaps = function () { const maps = _buildAllMaps(); S.place(maps); return maps; };
  // the Greening rebuilds Oakhaven on its own, outside buildAllMaps
  const _buildOakhaven = buildOakhaven;
  buildOakhaven = function (greening) { const m = _buildOakhaven(greening); if (greening) { try { placeMap(m, null, S.cache); } catch (err) { console.warn('scenery placement failed', err); } } return m; };
  const _loadMap = loadMap;
  loadMap = function (id, pos) { const r = _loadMap(id, pos); try { S.ensure(G.map); } catch (e) { /* never break a frame */ } return r; };
  const _update = update;
  update = function (dt) { if (S._shown !== GFX.scenery) S.sync(); return _update(dt); };
  if (typeof Engine !== 'undefined') {
    const _render = Engine.render;
    Engine.render = function (ents, tod, opts) { if (S._shown !== GFX.scenery) S.sync(); return _render.call(Engine, ents, tod, opts); };
  }
  return S;
})();
