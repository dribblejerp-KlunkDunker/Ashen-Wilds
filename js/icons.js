// ============================================================
//  icons — Phase 5 (illustrated interface): painted item icons and the painted paper doll.
//  Every item, weapon and armour id gets a 48x48 icon painted on a canvas from a table of
//  (kind, parameters) and cached as a data URL. PROCEDURAL STAND-IN art: gradient fills, seeded
//  brush flecks, sheen and an ink outline, per-material palettes; final hand-painted sheets can
//  replace ICONS.url() later without touching the wrappers below.
//  The icons are added to the panels by DOM insertion after the original render functions run
//  (inventory rows, worn slots, weapon rows, shop/sell rows, house chest, forge/brewing), so the
//  original text, ids, buttons and click handlers are untouched.
//  Security: icons are chosen only by looking an id up in ITEMS / WEAPONS / ARMOR; an id that is
//  not an own key of those catalogs (e.g. from an imported save) gets no image. Save text is never
//  placed in markup by this module. The paper doll SVG is built only from catalog names/constants.
//  GFX.itemIcons = false restores the original panels and the original paper doll exactly.
// ============================================================
'use strict';

if (typeof GFX !== 'undefined') {
  if (GFX.itemIcons === undefined) GFX.itemIcons = true;
}

const ICONS = (function () {
  const S = 48, INK = '#17100b';
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  // ---------------------------------------------------------------- colour + brush helpers
  function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
  const lite = (c, t) => mix(c, '#ffffff', t), dark = (c, t) => mix(c, '#000000', t);
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function seeded(seed) { let a = seed || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  let R = seeded(1);

  const MET = { iron: '#aab3b5', steel: '#c9d2d4', bronze: '#c08a43', bell: '#cf9d4c', glass: '#8fe6ee', brass: '#cfa63c', silver: '#d6dcdf', copper: '#b9693b', gold: '#e3bc4c', ivory: '#e6dcc0', rust: '#8d6a55' };
  const WOOD = '#7a5434', LEATHER = '#8a5a38', CLOTH = '#a48a62';

  function P(fn) { const p = new Path2D(); fn(p); return p; }
  function poly(p, a) { p.moveTo(a[0], a[1]); for (let i = 2; i < a.length; i += 2) p.lineTo(a[i], a[i + 1]); p.closePath(); }
  function rect(x, y, w, h, r) { return P(p => { if (r && p.roundRect) p.roundRect(x, y, w, h, r); else p.rect(x, y, w, h); }); }
  function circ(x, y, r) { return P(p => p.arc(x, y, r, 0, Math.PI * 2)); }

  // Painted fill: gradient, seeded brush flecks clipped to the shape, a soft sheen, then an ink outline.
  function paint(c, path, base, o) {
    o = o || {};
    const b = o.box || [4, 4, 44, 44], w = b[2] - b[0], h = b[3] - b[1];
    const g = c.createLinearGradient(b[0], b[1], b[2], b[3]);
    g.addColorStop(0, lite(base, 0.34)); g.addColorStop(0.5, base); g.addColorStop(1, dark(base, 0.48));
    c.fillStyle = g; c.fill(path);
    c.save(); c.clip(path); c.lineCap = 'round';
    const n = o.strokes == null ? 22 : o.strokes;
    for (let i = 0; i < n; i++) {
      const x = b[0] + R() * w, y = b[1] + R() * h, a = (o.ang == null ? -0.9 : o.ang) + (R() - 0.5) * 0.6, l = 2 + R() * 4;
      c.strokeStyle = R() < 0.5 ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.17)'; c.lineWidth = 0.7 + R() * 1.2;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
    }
    if (!o.flat) {
      const rg = c.createRadialGradient(b[0] + w * 0.3, b[1] + h * 0.25, 0, b[0] + w * 0.3, b[1] + h * 0.25, Math.max(w, h) * 0.7);
      rg.addColorStop(0, 'rgba(255,255,255,.30)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = rg; c.fillRect(0, 0, S, S);
    }
    c.restore();
    c.lineWidth = o.lw || 1.4; c.strokeStyle = o.line || INK; c.lineJoin = 'round'; c.stroke(path);
  }
  function line(c, pts, col, w, cap) {
    c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.strokeStyle = col; c.lineWidth = w || 1; c.lineCap = cap || 'round'; c.lineJoin = 'round'; c.stroke();
  }
  function dot(c, x, y, r, col) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = col; c.fill(); }
  function glow(c, x, y, r, col) {
    const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function rivets(c, pts, col) { for (let i = 0; i < pts.length; i += 2) { dot(c, pts[i], pts[i + 1], 0.9, col || '#e8dcb0'); } }
  // tilts a vertical (tip-up) drawing 45 degrees so blades read as held weapons
  function tilt(c, o, fn) { c.save(); if (!o.upright) { c.translate(24, 24); c.rotate(Math.PI / 4); c.translate(-24, -24); } fn(); c.restore(); }

  // ---------------------------------------------------------------- weapon kinds
  function wGrip(c, o, y0, y1) {
    paint(c, rect(22.2, y0, 3.6, y1 - y0, 1), o.grip || LEATHER, { box: [22, y0, 26, y1], strokes: 5 });
    for (let y = y0 + 1.5; y < y1 - 0.5; y += 2.2) line(c, [22.4, y, 25.6, y + 0.9], 'rgba(0,0,0,.35)', 0.7);
  }
  const KIND = {};
  KIND.blade = function (c, o) {
    tilt(c, o, () => {
      const len = o.len || 24, w = o.w || 4.4, tip = 31 - len, m = o.m || MET.iron;
      wGrip(c, o, 33, 41);
      paint(c, circ(24, 43, 2.5), o.pom || MET.brass, { box: [21, 40, 27, 46], strokes: 3 });
      const bl = P(p => { if (o.curve) { p.moveTo(24 - w / 2, 31); p.quadraticCurveTo(24 - w / 2 - 1, tip + 8, 24 + 1, tip); p.quadraticCurveTo(24 + w / 2 + 1, tip + 8, 24 + w / 2, 31); p.closePath(); } else poly(p, [24 - w / 2, 31, 24 - w / 2, tip + 4, 24, tip, 24 + w / 2, tip + 4, 24 + w / 2, 31]); });
      paint(c, bl, m, { box: [20, tip, 28, 31], ang: -1.5, strokes: 12 });
      c.save(); c.clip(bl); c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(24, tip, w, len); c.restore();
      if (o.fuller !== false) line(c, [24, tip + 7, 24, 28], 'rgba(0,0,0,.35)', 1);
      if (o.glow) { glow(c, 24, tip + 10, 9, o.glow); line(c, [24, tip + 4, 24, 25], o.glow2 || '#ffffff', 0.9); }
      if (o.runes) for (let y = tip + 9; y < 28; y += 4) line(c, [22.8, y, 25.2, y], o.runes, 0.8);
      paint(c, rect(24 - (o.g || 9) / 2, 30.5, o.g || 9, 3, 1), o.gc || MET.brass, { box: [16, 30, 32, 34], strokes: 3, lw: 1.2 });
      if (o.tip) paint(c, P(p => poly(p, [24 - w / 2 + 0.3, tip + 5.5, 24, tip, 24 + w / 2 - 0.3, tip + 5.5])), o.tip, { flat: true, strokes: 0, lw: 0.8 });
    });
  };
  KIND.axe = function (c, o) {
    tilt(c, o, () => {
      paint(c, rect(22.6, 6, 2.8, 38, 1), WOOD, { box: [22, 6, 26, 44], ang: -1.5, strokes: 10 });
      const hd = o.deck
        ? P(p => { p.moveTo(25.4, 8); p.quadraticCurveTo(40, 5, 41, 16); p.quadraticCurveTo(39, 28, 25.4, 24); p.closePath(); })
        : P(p => { p.moveTo(25.4, 7); p.lineTo(34, 5); p.quadraticCurveTo(43, 14, 37, 29); p.lineTo(25.4, 22); p.closePath(); });
      paint(c, hd, o.m || MET.iron, { box: [24, 5, 42, 28], strokes: 14 });
      line(c, o.deck ? [38, 10, 38, 22] : [38, 10, 35, 24], 'rgba(255,255,255,.55)', 1);
      paint(c, P(p => poly(p, [22.6, 12, 14, 14.5, 22.6, 17.5])), o.m || MET.iron, { box: [14, 12, 23, 18], strokes: 3, lw: 1.2 });
      if (o.cord) { line(c, [22, 26, 28, 28], o.cord, 1.6); line(c, [22, 29, 28, 31], o.cord, 1.6); }
      if (o.rim) line(c, [26, 8, 38, 6.5], o.rim, 1.1);
    });
  };
  KIND.mace = function (c, o) {
    tilt(c, o, () => {
      paint(c, rect(22.6, 14, 2.8, 30, 1), WOOD, { box: [22, 14, 26, 44], ang: -1.5, strokes: 8 });
      const n = o.flanges || 8, st = P(p => { for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, r = i % 2 ? 6.2 : 10; const x = 24 + Math.cos(a) * r, y = 12 + Math.sin(a) * r; i ? p.lineTo(x, y) : p.moveTo(x, y); } p.closePath(); });
      paint(c, st, o.m || MET.bell, { box: [14, 2, 34, 22], strokes: 12 });
      paint(c, circ(24, 12, 3.4), lite(o.m || MET.bell, 0.2), { box: [20, 8, 28, 16], strokes: 2, lw: 1 });
    });
  };
  KIND.tollhammer = function (c, o) {
    tilt(c, o, () => {
      paint(c, rect(22.6, 22, 2.8, 22, 1), WOOD, { box: [22, 22, 26, 44], ang: -1.5, strokes: 6 });
      const bell = P(p => { p.moveTo(17, 22); p.quadraticCurveTo(16, 8, 24, 5); p.quadraticCurveTo(32, 8, 31, 22); p.quadraticCurveTo(24, 25, 17, 22); p.closePath(); });
      paint(c, bell, MET.bell, { box: [16, 5, 32, 24], strokes: 14 });
      line(c, [17.5, 20, 30.5, 20], 'rgba(0,0,0,.35)', 1); line(c, [20, 10, 19, 17], 'rgba(255,255,255,.45)', 1.2);
      dot(c, 24, 25, 1.7, '#5c3d1e');
      paint(c, rect(21, 3, 6, 3, 1), MET.iron, { box: [21, 3, 27, 6], strokes: 2, lw: 1 });
    });
  };
  KIND.maul = function (c, o) {
    tilt(c, o, () => {
      paint(c, rect(22.4, 12, 3.2, 32, 1), WOOD, { box: [22, 12, 26, 44], ang: -1.5, strokes: 8 });
      paint(c, rect(11, 4, 26, 13, 2), MET.iron, { box: [11, 4, 37, 17], strokes: 16 });
      paint(c, rect(11, 4, 5, 13, 1), dark(MET.iron, 0.25), { box: [11, 4, 16, 17], strokes: 2, lw: 1 });
      paint(c, rect(32, 4, 5, 13, 1), dark(MET.iron, 0.25), { box: [32, 4, 37, 17], strokes: 2, lw: 1 });
      paint(c, circ(24, 10.5, 4), MET.brass, { box: [20, 6, 28, 15], strokes: 2 });
      dot(c, 24, 10.5, 2.8, '#f1ead2'); line(c, [24, 10.5, 25.8, 9], '#a3261c', 0.9);
      rivets(c, [13, 6, 13, 15, 35, 6, 35, 15], '#e8dcb0');
      line(c, [20, 17, 28, 17], '#d9d9d9', 1);
    });
  };
  KIND.spear = function (c, o) {
    tilt(c, o, () => {
      paint(c, rect(22.7, 14, 2.6, 31, 1), '#8c6a43', { box: [22, 14, 26, 45], ang: -1.5, strokes: 8 });
      const fork = P(p => { p.moveTo(18.5, 19); p.lineTo(18.5, 3); p.lineTo(21.5, 3); p.lineTo(21.5, 13); p.quadraticCurveTo(24, 16, 26.5, 13); p.lineTo(26.5, 3); p.lineTo(29.5, 3); p.lineTo(29.5, 19); p.quadraticCurveTo(24, 24, 18.5, 19); p.closePath(); });
      paint(c, fork, o.m || MET.bronze, { box: [18, 3, 30, 24], strokes: 12 });
      paint(c, rect(20.5, 19, 7, 3, 1), MET.iron, { box: [20, 19, 28, 22], strokes: 2, lw: 1 });
      line(c, [19.8, 5, 19.8, 15], 'rgba(255,255,255,.5)', 0.9);
      c.save(); c.globalAlpha = 0.5; line(c, [31.5, 6, 33.5, 9], '#fff3c0', 0.8); line(c, [16.5, 6, 14.5, 9], '#fff3c0', 0.8); c.restore();
    });
  };
  KIND.crossbow = function (c) {
    paint(c, P(p => poly(p, [6, 25, 33, 23, 41, 24.5, 41, 27, 33, 27.5, 6, 29])), WOOD, { box: [6, 23, 41, 29], ang: -0.1, strokes: 10 });
    paint(c, P(p => { p.moveTo(33, 8); p.quadraticCurveTo(40, 26, 33, 44); p.lineTo(35.6, 44); p.quadraticCurveTo(44.5, 26, 35.6, 8); p.closePath(); }), MET.iron, { box: [32, 8, 44, 44], ang: 1.4, strokes: 10 });
    line(c, [34, 9, 24, 24, 34, 43], '#efe6c6', 0.9);
    line(c, [10, 26, 40, 26], '#cfd4d2', 1.2);
    paint(c, P(p => poly(p, [40, 26, 35, 23.5, 35, 28.5])), '#d6dcdf', { flat: true, strokes: 0, lw: 0.8 });
    paint(c, rect(5, 22, 6, 9, 2), '#5b3d25', { box: [5, 22, 11, 31], strokes: 3 });
    paint(c, rect(14, 25.5, 2.4, 5, 1), MET.iron, { box: [14, 25, 17, 31], strokes: 1, lw: 1 });
  };
  KIND.pistol = function (c) {
    paint(c, P(p => poly(p, [12, 21, 41, 21, 41, 26, 24, 26, 20, 41, 11, 41, 15, 26, 12, 26])), '#6a4a30', { box: [11, 21, 41, 41], strokes: 10 });
    paint(c, rect(14, 17, 28, 7, 2), MET.silver, { box: [14, 17, 42, 24], strokes: 8, ang: -0.1 });
    glow(c, 40, 20.5, 6, 'rgba(120,235,245,.85)'); dot(c, 41.5, 20.5, 2, '#bff7fb');
    paint(c, P(p => { p.moveTo(10, 17); p.quadraticCurveTo(7, 12, 13, 13); p.lineTo(17, 17); p.closePath(); }), MET.iron, { box: [8, 12, 17, 17], strokes: 2, lw: 1 });
    line(c, [23, 26, 25, 31, 29, 31], '#2a1c12', 1.1);
    line(c, [16, 19.5, 38, 19.5], 'rgba(255,255,255,.45)', 0.8);
  };
  KIND.tknives = function (c) {
    [[-0.5, 10, 6], [0, 24, 4], [0.5, 38, 6]].forEach(([a, x, y]) => {
      c.save(); c.translate(x, 24); c.rotate(a);
      paint(c, P(p => poly(p, [-2, 4, -2, -14, 0, -19, 2, -14, 2, 4])), MET.steel, { box: [-3, -19, 3, 4], strokes: 3, lw: 1.1 });
      paint(c, rect(-1.8, 4, 3.6, 10, 1), LEATHER, { box: [-2, 4, 2, 14], strokes: 2, lw: 1.1 });
      dot(c, 0, 15, 1.7, MET.brass); c.restore();
    });
  };
  KIND.fist = function (c) {
    paint(c, P(p => { p.moveTo(13, 40); p.lineTo(12, 24); p.quadraticCurveTo(12, 12, 24, 11); p.quadraticCurveTo(37, 11, 37, 24); p.lineTo(35, 40); p.closePath(); }), '#c39a78', { box: [12, 11, 37, 40], strokes: 12 });
    [[16, 12], [22, 11], [28, 11], [33, 13]].forEach(([x, y]) => paint(c, circ(x, y + 3, 3.6), '#c9a181', { box: [x - 4, y - 1, x + 4, y + 7], strokes: 2, lw: 1.1 }));
    line(c, [16, 22, 33, 22], 'rgba(0,0,0,.28)', 1); paint(c, rect(12, 38, 25, 6, 1), '#6b4a30', { box: [12, 38, 37, 44], strokes: 4 });
  };
  KIND.glassarm = function (c) {
    const arm = P(p => { p.moveTo(10, 38); p.lineTo(17, 14); p.quadraticCurveTo(20, 6, 28, 8); p.lineTo(38, 20); p.lineTo(31, 42); p.closePath(); });
    paint(c, arm, '#8fe0e8', { box: [10, 6, 38, 42], strokes: 6, line: '#0e3a44' });
    c.save(); c.clip(arm); line(c, [20, 12, 24, 22, 20, 30, 26, 40], '#e9ffff', 0.9); line(c, [28, 12, 26, 20, 33, 26], '#3aa7b5', 0.9); line(c, [14, 32, 20, 30], '#e9ffff', 0.8); c.restore();
    paint(c, rect(8, 34, 22, 8, 1), '#7a5a40', { box: [8, 34, 30, 42], strokes: 4 });
    glow(c, 26, 22, 12, 'rgba(160,250,255,.35)');
  };

  // ---------------------------------------------------------------- armour kinds
  KIND.helm = function (c, o) {
    const m = o.m || LEATHER, v = o.v;
    if (v === 'hood') {
      paint(c, P(p => { p.moveTo(10, 42); p.quadraticCurveTo(8, 8, 24, 5); p.quadraticCurveTo(40, 8, 38, 42); p.lineTo(31, 38); p.quadraticCurveTo(24, 32, 17, 38); p.closePath(); }), m, { box: [8, 5, 40, 42], strokes: 16 });
      paint(c, P(p => { p.ellipse(24, 24, 7, 9, 0, 0, Math.PI * 2); }), '#14100d', { flat: true, strokes: 0, lw: 1 });
      line(c, [14, 36, 18, 41], 'rgba(255,255,255,.18)', 1);
    } else if (v === 'cap') {
      paint(c, P(p => { p.moveTo(9, 34); p.quadraticCurveTo(8, 11, 24, 10); p.quadraticCurveTo(40, 11, 39, 34); p.quadraticCurveTo(24, 38, 9, 34); p.closePath(); }), m, { box: [8, 10, 40, 38], strokes: 14 });
      line(c, [10, 32, 38, 32], dark(m, 0.5), 1.2); line(c, [24, 11, 24, 32], dark(m, 0.35), 1); rivets(c, [14, 28, 34, 28], '#d8c690');
    } else if (v === 'kettle') {
      paint(c, P(p => { p.moveTo(3, 32); p.quadraticCurveTo(12, 26, 14, 24); p.quadraticCurveTo(15, 8, 24, 8); p.quadraticCurveTo(33, 8, 34, 24); p.quadraticCurveTo(36, 26, 45, 32); p.quadraticCurveTo(24, 38, 3, 32); p.closePath(); }), m, { box: [3, 8, 45, 38], strokes: 16 });
      line(c, [10, 31, 38, 31], 'rgba(0,0,0,.3)', 1.2); line(c, [19, 12, 18, 24], 'rgba(255,255,255,.5)', 1.3); rivets(c, [24, 12], '#e8dcb0');
    } else {
      paint(c, P(p => { p.moveTo(7, 40); p.quadraticCurveTo(5, 8, 24, 5); p.quadraticCurveTo(43, 8, 41, 40); p.quadraticCurveTo(24, 44, 7, 40); p.closePath(); }), m, { box: [5, 5, 43, 44], strokes: 20 });
      paint(c, P(p => poly(p, [14, 26, 34, 26, 34, 31, 14, 31])), '#17110c', { flat: true, strokes: 0, lw: 1 });
      line(c, [24, 8, 24, 26], 'rgba(0,0,0,.28)', 1.2); line(c, [10, 36, 38, 36], 'rgba(0,0,0,.3)', 1.2); line(c, [14, 12, 12, 30], 'rgba(255,255,255,.45)', 1.5);
      paint(c, circ(24, 5.5, 2.2), o.fin || MET.brass, { box: [21, 3, 27, 8], strokes: 2, lw: 1 });
    }
  };
  KIND.body = function (c, o) {
    const m = o.m || CLOTH, v = o.v;
    const torso = P(p => { p.moveTo(15, 8); p.lineTo(8, 14); p.lineTo(3, 29); p.lineTo(9, 32); p.lineTo(13, 22); p.lineTo(13, 43); p.lineTo(35, 43); p.lineTo(35, 22); p.lineTo(39, 32); p.lineTo(45, 29); p.lineTo(40, 14); p.lineTo(33, 8); p.quadraticCurveTo(24, 14, 15, 8); p.closePath(); });
    if (v === 'robe') {
      paint(c, P(p => { p.moveTo(15, 7); p.lineTo(7, 14); p.lineTo(3, 32); p.lineTo(9, 34); p.lineTo(12, 22); p.lineTo(8, 44); p.lineTo(40, 44); p.lineTo(36, 22); p.lineTo(39, 34); p.lineTo(45, 32); p.lineTo(41, 14); p.lineTo(33, 7); p.quadraticCurveTo(24, 13, 15, 7); p.closePath(); }), m, { box: [3, 7, 45, 44], strokes: 22, ang: 1.4 });
      paint(c, P(p => poly(p, [19, 8, 24, 14, 29, 8, 31, 8, 31, 44, 17, 44, 17, 8])), '#cfd2d0', { box: [17, 8, 31, 44], strokes: 6, lw: 1 }); // silver registry stole
      line(c, [24, 20, 24, 36], '#4d4a3a', 1); line(c, [20, 28, 28, 28], '#4d4a3a', 1);
    } else if (v === 'hushcoat') {
      paint(c, P(p => { p.moveTo(15, 7); p.lineTo(7, 14); p.lineTo(3, 33); p.lineTo(9, 35); p.lineTo(12, 22); p.lineTo(9, 45); p.lineTo(24, 42); p.lineTo(39, 45); p.lineTo(36, 22); p.lineTo(39, 35); p.lineTo(45, 33); p.lineTo(41, 14); p.lineTo(33, 7); p.quadraticCurveTo(24, 14, 15, 7); p.closePath(); }), m, { box: [3, 7, 45, 45], strokes: 24, ang: 1.4 });
      line(c, [24, 14, 24, 42], 'rgba(0,0,0,.4)', 1.2); [[21, 24], [21, 31], [21, 38], [27, 24], [27, 31], [27, 38]].forEach(([x, y]) => dot(c, x, y, 0.9, '#9fb6a6'));
    } else {
      paint(c, torso, m, { box: [3, 8, 45, 43], strokes: v === 'chain' ? 8 : 20 });
      c.save(); c.clip(torso);
      if (v === 'gambeson') { for (let x = 15; x < 36; x += 5) line(c, [x, 11, x, 43], 'rgba(0,0,0,.28)', 1); for (let y = 16; y < 43; y += 6) line(c, [13, y, 35, y], 'rgba(0,0,0,.2)', 1); }
      else if (v === 'jerkin') { line(c, [24, 12, 24, 43], 'rgba(0,0,0,.4)', 1.2); for (let y = 15; y < 40; y += 4) { line(c, [21, y, 27, y + 2], '#e0cfa0', 0.9); line(c, [27, y, 21, y + 2], '#e0cfa0', 0.9); } line(c, [13, 36, 35, 36], '#3d2616', 2); }
      else if (v === 'brig') { for (let y = 14; y < 42; y += 6) for (let x = 15; x < 35; x += 6) { c.fillStyle = 'rgba(190,198,196,.85)'; c.fillRect(x, y, 5, 5); c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = .7; c.strokeRect(x, y, 5, 5); dot(c, x + 2.5, y + 2.5, .7, '#f0e4b0'); } }
      else if (v === 'chain') { for (let y = 10; y < 44; y += 3) for (let x = (y / 3) % 2 ? 4 : 6; x < 46; x += 4) { c.beginPath(); c.arc(x, y, 1.6, 0, Math.PI); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = .8; c.stroke(); } }
      else if (v === 'plate') { line(c, [24, 12, 24, 43], 'rgba(0,0,0,.35)', 1.4); line(c, [13, 24, 35, 24], 'rgba(0,0,0,.3)', 1.2); line(c, [13, 33, 35, 33], 'rgba(0,0,0,.3)', 1.2); line(c, [17, 12, 16, 40], 'rgba(255,255,255,.5)', 1.6); glow(c, 24, 22, 8, 'rgba(255,230,160,.35)'); }
      c.restore();
      if (v === 'plate') { rivets(c, [16, 14, 32, 14, 16, 41, 32, 41], '#fff0b8'); paint(c, circ(24, 24, 3), MET.brass, { box: [21, 21, 27, 27], strokes: 1, lw: 1 }); }
    }
  };
  KIND.gloves = function (c, o) {
    const m = o.m || LEATHER;
    const hand = (dx, flip) => {
      c.save(); c.translate(24, 0); c.scale(flip, 1); c.translate(dx - 24, 0);
      paint(c, P(p => { p.moveTo(6, 42); p.lineTo(5, 24); p.quadraticCurveTo(5, 18, 9, 18); p.lineTo(9, 9); p.quadraticCurveTo(12, 6, 14, 9); p.lineTo(14, 17); p.lineTo(15, 6); p.quadraticCurveTo(18, 3, 19, 7); p.lineTo(19, 18); p.lineTo(21, 9); p.quadraticCurveTo(24, 7, 24, 11); p.lineTo(23, 24); p.lineTo(21, 42); p.closePath(); }), m, { box: [5, 3, 24, 42], strokes: 12 });
      paint(c, rect(5, 36, 17, 7, 1), o.cuff || '#5b3d25', { box: [5, 36, 22, 43], strokes: 3, lw: 1.2 });
      if (o.mail) { for (let y = 20; y < 34; y += 3) for (let x = 7; x < 22; x += 3.4) { c.beginPath(); c.arc(x, y, 1.4, 0, Math.PI); c.strokeStyle = 'rgba(235,240,240,.85)'; c.lineWidth = .8; c.stroke(); } }
      c.restore();
    };
    hand(2, 1);
    c.save(); c.translate(24, 0); hand(0, 1); c.restore();
  };
  KIND.boots = function (c, o) {
    const m = o.m || '#6a4a30', v = o.v;
    paint(c, P(p => { p.moveTo(14, 5); p.lineTo(28, 5); p.lineTo(29, 28); p.quadraticCurveTo(44, 29, 45, 38); p.lineTo(45, 42); p.lineTo(8, 42); p.lineTo(8, 36); p.lineTo(14, 32); p.closePath(); }), m, { box: [8, 5, 45, 42], strokes: 16 });
    paint(c, rect(8, 39, 37, 4, 1), '#2a1c12', { box: [8, 39, 45, 43], strokes: 2, lw: 1.1 });
    if (v === 'soft') { line(c, [14, 9, 28, 9], dark(m, .3), 1.3); line(c, [18, 18, 26, 20], 'rgba(255,255,255,.2)', 1); }
    if (v === 'hob') { for (let x = 11; x < 44; x += 5) dot(c, x, 41, 1, '#d6d6c8'); line(c, [14, 12, 28, 14], '#e0cfa0', 1); line(c, [14, 17, 28, 19], '#e0cfa0', 1); line(c, [14, 22, 28, 24], '#e0cfa0', 1); }
    if (v === 'greaves') { paint(c, P(p => poly(p, [13, 4, 29, 4, 30, 30, 12, 32])), MET.iron, { box: [12, 4, 30, 32], strokes: 10 }); line(c, [15, 8, 15, 26], 'rgba(255,255,255,.5)', 1.3); line(c, [12, 18, 30, 18], 'rgba(0,0,0,.3)', 1); rivets(c, [16, 7, 26, 7, 16, 28, 27, 28], '#e8dcb0'); }
  };
  KIND.shield = function (c, o) {
    const m = o.m || '#6d5140';
    if (o.v === 'kite') {
      const sh = P(p => { p.moveTo(10, 5); p.lineTo(38, 5); p.quadraticCurveTo(40, 26, 24, 45); p.quadraticCurveTo(8, 26, 10, 5); p.closePath(); });
      paint(c, sh, m, { box: [8, 5, 40, 45], strokes: 18, ang: 1.4 });
      c.save(); c.clip(sh); c.strokeStyle = '#c9b57a'; c.lineWidth = 3; c.stroke(sh); c.restore();
      // the Synod's dead queen: a pale crowned face, painted small
      paint(c, P(p => p.ellipse(24, 19, 4, 5.2, 0, 0, Math.PI * 2)), '#e6d8c0', { box: [20, 14, 28, 24], strokes: 2, lw: 1 });
      paint(c, P(p => poly(p, [19, 13, 21, 9, 24, 12, 27, 9, 29, 13])), MET.gold, { flat: true, strokes: 0, lw: 1 });
      line(c, [24, 25, 24, 38], '#c9b57a', 1.4); line(c, [17, 31, 31, 31], '#c9b57a', 1.4);
    } else {
      paint(c, circ(24, 24, 18), m, { box: [6, 6, 42, 42], strokes: 18 });
      c.save(); c.beginPath(); c.arc(24, 24, 17, 0, Math.PI * 2); c.strokeStyle = '#b8a16b'; c.lineWidth = 2.4; c.stroke(); c.restore();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; dot(c, 24 + Math.cos(a) * 14, 24 + Math.sin(a) * 14, 0.9, '#efe2b0'); }
      paint(c, circ(24, 24, 6), MET.iron, { box: [18, 18, 30, 30], strokes: 4 }); paint(c, circ(24, 24, 2.2), MET.brass, { flat: true, strokes: 0, lw: 1 });
    }
  };

  // ---------------------------------------------------------------- consumable kinds
  KIND.potion = function (c, o) {
    const liq = o.liq || '#c05a3a';
    const body = P(p => { p.moveTo(19, 16); p.lineTo(19, 11); p.lineTo(29, 11); p.lineTo(29, 16); p.quadraticCurveTo(40, 20, 38, 33); p.quadraticCurveTo(36, 44, 24, 44); p.quadraticCurveTo(12, 44, 10, 33); p.quadraticCurveTo(8, 20, 19, 16); p.closePath(); });
    paint(c, body, '#b9d4d6', { box: [8, 11, 40, 44], strokes: 0, flat: true, lw: 1.5 });
    c.save(); c.clip(body); const g = c.createLinearGradient(0, 22, 48, 44); g.addColorStop(0, lite(liq, .3)); g.addColorStop(1, dark(liq, .45)); c.fillStyle = g; c.fillRect(0, 24, 48, 24);
    for (let i = 0; i < 8; i++) { c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(12 + R() * 24, 28 + R() * 14, .8 + R() * 1.2, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(13, 20, 3, 18); c.restore();
    c.lineWidth = 1.5; c.strokeStyle = INK; c.stroke(body);
    paint(c, rect(20, 6, 8, 6, 1.5), o.cork || '#9a7448', { box: [20, 6, 28, 12], strokes: 3, lw: 1.2 });
    if (o.label) paint(c, rect(17, 29, 14, 7, 1), o.label, { flat: true, strokes: 0, lw: 0.8 });
  };
  KIND.jar = function (c, o) {
    const jar = P(p => { p.moveTo(14, 12); p.lineTo(34, 12); p.quadraticCurveTo(40, 14, 40, 22); p.lineTo(40, 38); p.quadraticCurveTo(40, 44, 34, 44); p.lineTo(14, 44); p.quadraticCurveTo(8, 44, 8, 38); p.lineTo(8, 22); p.quadraticCurveTo(8, 14, 14, 12); p.closePath(); });
    paint(c, jar, o.liq || '#d79a2a', { box: [8, 12, 40, 44], strokes: 12 });
    c.save(); c.clip(jar); c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(12, 16, 3.5, 24); c.restore();
    paint(c, rect(11, 7, 26, 6, 2), '#b9a78a', { box: [11, 7, 37, 13], strokes: 3, lw: 1.2 });
    paint(c, rect(14, 26, 20, 10, 1), '#e8dcb7', { flat: true, strokes: 0, lw: 0.9 }); line(c, [17, 31, 31, 31], '#7a5a2a', 1.4);
  };
  KIND.vox = function (c) {
    KIND.potion(c, { liq: '#8a5fd0', cork: '#4a3a2a' });
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(24, 27, 5 + i * 4, -0.9, 0.9); c.strokeStyle = 'rgba(210,190,255,' + (0.8 - i * 0.22) + ')'; c.lineWidth = 1; c.stroke(); }
    line(c, [20, 4, 28, 10], '#d9c9a0', 1.2);
  };
  KIND.bottle = function (c) {
    const b = P(p => { p.moveTo(21, 6); p.lineTo(27, 6); p.lineTo(27, 18); p.quadraticCurveTo(37, 22, 36, 34); p.quadraticCurveTo(35, 44, 24, 44); p.quadraticCurveTo(13, 44, 12, 34); p.quadraticCurveTo(11, 22, 21, 18); p.closePath(); });
    paint(c, b, '#a9d1d4', { box: [11, 6, 37, 44], strokes: 4, flat: true, lw: 1.4 });
    c.save(); c.clip(b); c.fillStyle = 'rgba(20,60,66,.28)'; c.fillRect(24, 6, 14, 40); c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(15, 24, 2.5, 14); c.restore();
    line(c, [21.5, 8, 26.5, 8], 'rgba(255,255,255,.7)', 1.4);
  };
  KIND.bandage = function (c) {
    paint(c, P(p => p.ellipse(24, 26, 16, 14, 0, 0, Math.PI * 2)), '#e8e0cc', { box: [8, 12, 40, 40], strokes: 12 });
    paint(c, P(p => p.ellipse(24, 26, 7, 6, 0, 0, Math.PI * 2)), '#3a2c20', { flat: true, strokes: 0, lw: 1 });
    for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(24, 26, 16 - i * 2.2, 14 - i * 2, 0, 0.2, 2.6); c.strokeStyle = 'rgba(120,100,70,.35)'; c.lineWidth = .8; c.stroke(); }
    paint(c, P(p => poly(p, [30, 30, 44, 36, 42, 41, 28, 36])), '#efe8d4', { box: [28, 30, 44, 41], strokes: 3, lw: 1.2 });
    line(c, [14, 24, 20, 18], '#9a3a30', 1.2);
  };
  KIND.whistle = function (c) {
    paint(c, P(p => { p.moveTo(5, 24); p.lineTo(32, 18); p.lineTo(40, 21); p.lineTo(40, 31); p.lineTo(32, 33); p.lineTo(5, 29); p.closePath(); }), '#8fa86a', { box: [5, 18, 40, 33], strokes: 12, ang: -0.1 });
    for (let x = 12; x < 34; x += 5) line(c, [x, 20, x + 1, 31], 'rgba(0,0,0,.28)', 1);
    paint(c, P(p => p.ellipse(34, 26, 3, 4, 0, 0, 7)), '#1a140e', { flat: true, strokes: 0, lw: 0.9 });
    line(c, [6, 26.5, 2, 33, 7, 39], '#6a5030', 1.4);
  };
  KIND.pellets = function (c) {
    [[16, 30], [28, 30], [22, 20], [34, 20], [10, 21], [24, 37], [36, 36]].forEach(([x, y], i) => {
      glow(c, x, y, 6, 'rgba(120,235,245,.35)'); paint(c, circ(x, y, 3.6), i % 2 ? '#9cecf2' : '#7bd8e2', { box: [x - 4, y - 4, x + 4, y + 4], strokes: 0, lw: 1, line: '#0f4a55' });
      dot(c, x - 1.1, y - 1.2, 0.9, '#ffffff');
    });
  };
  KIND.bolts = function (c) {
    [-9, 0, 9].forEach((dx, i) => {
      c.save(); c.translate(24 + dx, 25); c.rotate(i * 0.16 - 0.16);
      line(c, [0, -18, 0, 17], '#7a5434', 2.2); paint(c, P(p => poly(p, [-3, -18, 0, -24, 3, -18])), MET.steel, { flat: true, strokes: 0, lw: 1 });
      paint(c, P(p => poly(p, [-3, 17, 0, 11, 3, 17, 0, 20])), '#d9d3c0', { flat: true, strokes: 0, lw: 0.9 }); c.restore();
    });
    line(c, [10, 36, 38, 36], '#5b3d25', 3);
  };
  KIND.coins = function (c) {
    const coin = (x, y, r, k) => { paint(c, P(p => p.ellipse(x, y, r, r * 0.55, 0, 0, 7)), MET.gold, { box: [x - r, y - r, x + r, y + r], strokes: 3, lw: 1.1 }); c.beginPath(); c.ellipse(x, y, r * 0.6, r * 0.32, 0, 0, 7); c.strokeStyle = 'rgba(120,80,10,.5)'; c.lineWidth = .8; c.stroke(); if (k) dot(c, x, y, 0.8, 'rgba(120,80,10,.6)'); };
    for (let i = 0; i < 4; i++) coin(24, 38 - i * 4, 11, 0);
    coin(24, 22, 11, 1); coin(36, 34, 8, 1);
  };
  KIND.pebble = function (c) {
    paint(c, P(p => { p.moveTo(8, 30); p.quadraticCurveTo(10, 16, 24, 15); p.quadraticCurveTo(40, 15, 41, 29); p.quadraticCurveTo(38, 40, 24, 40); p.quadraticCurveTo(10, 40, 8, 30); p.closePath(); }), '#8b8f8c', { box: [8, 15, 41, 40], strokes: 22 });
    line(c, [16, 22, 22, 20], 'rgba(255,255,255,.4)', 1.4); line(c, [26, 33, 34, 31], 'rgba(0,0,0,.25)', 1);
  };
  KIND.whetstone = function (c) {
    paint(c, P(p => poly(p, [6, 28, 36, 16, 43, 21, 13, 36])), '#9aa09a', { box: [6, 16, 43, 36], strokes: 26, ang: -0.4 });
    paint(c, P(p => poly(p, [13, 36, 43, 21, 43, 26, 13, 41])), '#6c726e', { box: [13, 21, 43, 41], strokes: 8, lw: 1.2 });
    for (let i = 0; i < 6; i++) line(c, [10 + i * 5, 29 - i * 2, 12 + i * 5, 31 - i * 2], 'rgba(255,255,255,.3)', .8);
    c.save(); c.globalAlpha = .8; line(c, [28, 14, 33, 8], '#ffd36a', 1.2); line(c, [32, 17, 38, 14], '#ffd36a', 1); c.restore();
  };
  KIND.shard = function (c, o) {
    const col = o.col || '#88d890';
    glow(c, 24, 25, 22, 'rgba(160,255,160,.28)');
    paint(c, P(p => poly(p, [24, 3, 33, 17, 31, 40, 24, 45, 15, 38, 14, 17])), col, { box: [14, 3, 33, 45], strokes: 8, ang: 1.2 });
    line(c, [24, 3, 24, 45], 'rgba(255,255,255,.4)', 1); line(c, [14, 17, 24, 22, 33, 17], 'rgba(255,255,255,.45)', 1); line(c, [24, 22, 31, 40], 'rgba(0,0,0,.25)', 1);
    glow(c, 20, 14, 6, 'rgba(255,240,170,.6)');
  };
  KIND.eel = function (c) {
    paint(c, P(p => { p.moveTo(5, 32); p.quadraticCurveTo(10, 14, 22, 24); p.quadraticCurveTo(32, 32, 38, 14); p.lineTo(44, 12); p.quadraticCurveTo(40, 34, 30, 38); p.quadraticCurveTo(16, 40, 5, 32); p.closePath(); }), '#a9743c', { box: [5, 12, 44, 40], strokes: 18, ang: -0.3 });
    line(c, [8, 31, 20, 29, 32, 33, 40, 20], 'rgba(255,230,160,.4)', 1.4); line(c, [8, 34, 20, 34, 32, 36], 'rgba(0,0,0,.25)', 1);
    dot(c, 41.5, 13.5, 1, '#1a1008');
    line(c, [12, 18, 12, 6, 36, 6, 36, 12], '#9a8a68', 1);
  };
  KIND.herb = function (c, o) {
    const v = o.v;
    if (v === 'bark') {
      paint(c, P(p => { p.moveTo(8, 12); p.quadraticCurveTo(24, 4, 40, 14); p.lineTo(42, 34); p.quadraticCurveTo(26, 44, 10, 36); p.closePath(); }), '#a7a99a', { box: [8, 4, 42, 44], strokes: 24, ang: -0.3 });
      line(c, [12, 16, 36, 20], 'rgba(0,0,0,.28)', 1); line(c, [12, 26, 38, 30], 'rgba(0,0,0,.25)', 1); line(c, [14, 36, 34, 38], 'rgba(255,255,255,.3)', 1);
      paint(c, P(p => poly(p, [34, 8, 44, 4, 40, 14])), '#7aa65c', { box: [34, 4, 44, 14], strokes: 1, lw: 1 });
    } else if (v === 'reed') {
      [[-9, 0.24], [-3, 0.09], [3, -0.06], [9, -0.2]].forEach(([dx, a]) => { c.save(); c.translate(24 + dx, 44); c.rotate(a); paint(c, rect(-1.6, -40, 3.2, 40, 1.5), '#c8d98a', { box: [-2, -40, 2, 0], ang: -1.5, strokes: 6, lw: 1.1 }); line(c, [-1.6, -26, 1.6, -26], 'rgba(0,0,0,.3)', 0.8); line(c, [-1.6, -14, 1.6, -14], 'rgba(0,0,0,.3)', 0.8); c.restore(); });
      paint(c, P(p => poly(p, [14, 33, 34, 33, 36, 38, 12, 38])), '#7a5a35', { box: [12, 33, 36, 38], strokes: 3, lw: 1.1 });
    } else {
      glow(c, 24, 26, 20, 'rgba(210,150,255,.28)');
      for (let i = 0; i < 9; i++) paint(c, circ(10 + R() * 28, 18 + R() * 22, 4 + R() * 4), i % 2 ? '#a78bd4' : '#8b6fc2', { box: [4, 12, 44, 44], strokes: 3, lw: 1 });
      for (let i = 0; i < 5; i++) dot(c, 12 + R() * 24, 20 + R() * 20, 1, '#f3e9ff');
    }
  };
  KIND.chest = function (c) {
    paint(c, rect(5, 20, 38, 22, 2), '#74492a', { box: [5, 20, 43, 42], strokes: 18, ang: 0 });
    paint(c, P(p => { p.moveTo(5, 21); p.quadraticCurveTo(24, 3, 43, 21); p.closePath(); }), '#85563a', { box: [5, 8, 43, 21], strokes: 10 });
    line(c, [5, 21, 43, 21], INK, 1.4); line(c, [14, 15, 14, 42], MET.iron, 2.6); line(c, [34, 15, 34, 42], MET.iron, 2.6);
    paint(c, rect(21, 18, 6, 8, 1.5), MET.brass, { box: [21, 18, 27, 26], strokes: 2, lw: 1.1 }); dot(c, 24, 22, 1, INK);
  };

  // ---------------------------------------------------------------- valuables
  KIND.scrap = function (c) {
    paint(c, P(p => poly(p, [6, 34, 14, 12, 26, 8, 40, 20, 42, 36, 28, 42])), MET.bell, { box: [6, 8, 42, 42], strokes: 22 });
    line(c, [14, 16, 24, 28, 38, 24], 'rgba(0,0,0,.3)', 1); line(c, [18, 14, 12, 28], 'rgba(255,255,255,.5)', 1.4);
    c.save(); c.globalAlpha = .5; c.beginPath(); c.arc(32, 36, 5, 0, 7); c.strokeStyle = '#4a7a5a'; c.lineWidth = 1.5; c.stroke(); c.restore();
  };
  KIND.mesh = function (c) {
    const sq = P(p => poly(p, [8, 10, 40, 6, 42, 38, 6, 42]));
    paint(c, sq, '#aeb8bd', { box: [6, 6, 42, 42], strokes: 4, flat: false });
    c.save(); c.clip(sq); for (let i = -48; i < 48; i += 4) { line(c, [i, 0, i + 48, 48], 'rgba(255,255,255,.65)', 0.8); line(c, [i + 48, 0, i, 48], 'rgba(40,50,56,.55)', 0.8); } c.restore();
    c.lineWidth = 1.5; c.strokeStyle = INK; c.stroke(sq);
  };
  KIND.cog = function (c) {
    const n = 10, g = P(p => { for (let i = 0; i < n * 4; i++) { const a = i / (n * 4) * Math.PI * 2 - 0.1; const r = (i % 4 === 1 || i % 4 === 2) ? 19 : 14.5; const x = 24 + Math.cos(a) * r, y = 24 + Math.sin(a) * r; i ? p.lineTo(x, y) : p.moveTo(x, y); } p.closePath(); });
    paint(c, g, MET.brass, { box: [5, 5, 43, 43], strokes: 18 });
    paint(c, circ(24, 24, 9), dark(MET.brass, .2), { box: [15, 15, 33, 33], strokes: 4, lw: 1.1 });
    paint(c, circ(24, 24, 3.4), '#2a2018', { flat: true, strokes: 0, lw: 1 });
    glow(c, 24, 24, 20, 'rgba(255,170,70,.22)');
  };
  KIND.signet = function (c) {
    c.save(); c.beginPath(); c.arc(24, 28, 12, 0, Math.PI * 2); c.strokeStyle = INK; c.lineWidth = 7; c.stroke(); c.strokeStyle = MET.gold; c.lineWidth = 4.6; c.stroke(); c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1; c.beginPath(); c.arc(24, 28, 12, 3.6, 4.6); c.stroke(); c.restore();
    paint(c, P(p => poly(p, [15, 8, 33, 8, 36, 17, 24, 22, 12, 17])), MET.gold, { box: [12, 8, 36, 22], strokes: 4 });
    paint(c, P(p => poly(p, [19, 10, 29, 10, 31, 16, 24, 19, 17, 16])), '#2c4a7a', { flat: true, strokes: 0, lw: .9 }); line(c, [24, 11, 24, 17], '#e6d19a', 1);
  };
  KIND.fork = function (c) {
    paint(c, P(p => { p.moveTo(16, 4); p.lineTo(20, 4); p.lineTo(20, 24); p.quadraticCurveTo(24, 28, 28, 24); p.lineTo(28, 4); p.lineTo(32, 4); p.lineTo(32, 26); p.quadraticCurveTo(24, 34, 16, 26); p.closePath(); }), MET.silver, { box: [16, 4, 32, 34], strokes: 10, ang: 1.5 });
    paint(c, rect(22.4, 29, 3.2, 15, 1.4), MET.silver, { box: [22, 29, 26, 44], strokes: 3, lw: 1.1 });
    line(c, [18, 6, 18, 22], 'rgba(255,255,255,.7)', 1);
    c.save(); c.globalAlpha = .6; [[10, 10, 6, 7], [10, 16, 5, 16], [38, 10, 42, 7], [38, 16, 43, 16]].forEach(([a, b, d, e]) => line(c, [a, b, d, e], '#cfe9ff', 0.9)); c.restore();
  };

  // ---------------------------------------------------------------- quest-item kinds
  KIND.coil = function (c) {
    glow(c, 24, 24, 21, 'rgba(160,255,150,.25)');
    paint(c, P(p => poly(p, [24, 6, 31, 18, 29, 38, 24, 43, 19, 38, 17, 18])), '#8fd86f', { box: [17, 6, 31, 43], strokes: 6, ang: 1.2 });
    line(c, [24, 8, 24, 41], 'rgba(255,255,255,.4)', 1);
    for (let i = 0; i < 7; i++) { const y = 12 + i * 4.6; c.beginPath(); c.ellipse(24, y, 14, 3.2, 0, 0, Math.PI); c.strokeStyle = INK; c.lineWidth = 3.4; c.stroke(); c.strokeStyle = i % 2 ? MET.copper : MET.brass; c.lineWidth = 2; c.stroke(); }
    paint(c, rect(9, 41, 30, 4, 1), '#6a4a30', { box: [9, 41, 39, 45], strokes: 2, lw: 1.1 });
  };
  KIND.scroll = function (c, o) {
    paint(c, rect(8, 8, 32, 32, 1), o.paper || '#e5d7ae', { box: [8, 8, 40, 40], strokes: 22 });
    for (let i = 0; i < 6; i++) { line(c, [12, 14 + i * 4.6, 36, 14 + i * 4.6], 'rgba(60,80,110,.5)', .8); line(c, [12 + i * 4.6, 12, 12 + i * 4.6, 38], 'rgba(60,80,110,.38)', .8); }
    line(c, [12, 34, 20, 26, 26, 30, 36, 16], o.ink || '#8a2d22', 1.4);
    paint(c, P(p => { p.moveTo(5, 6); p.quadraticCurveTo(24, 1, 43, 6); p.lineTo(43, 9); p.quadraticCurveTo(24, 5, 5, 9); p.closePath(); }), '#c9b987', { box: [5, 2, 43, 9], strokes: 2, lw: 1.1 });
    paint(c, P(p => { p.moveTo(5, 40); p.quadraticCurveTo(24, 36, 43, 40); p.lineTo(43, 43); p.quadraticCurveTo(24, 40, 5, 43); p.closePath(); }), '#c9b987', { box: [5, 36, 43, 43], strokes: 2, lw: 1.1 });
    paint(c, circ(36, 33, 4), '#a8281e', { box: [32, 29, 40, 37], strokes: 2, lw: 1 });
  };
  KIND.card = function (c) {
    paint(c, rect(5, 12, 38, 26, 2), '#d8caa0', { box: [5, 12, 43, 38], strokes: 14 });
    paint(c, rect(8, 15, 32, 20, 1), '#c3b078', { flat: true, strokes: 4, lw: 0.9 });
    line(c, [11, 20, 27, 20], '#4a3a20', 1.2); line(c, [11, 24, 23, 24], '#4a3a20', 1); line(c, [11, 28, 25, 28], '#4a3a20', 1);
    paint(c, circ(34, 29, 5.5), '#9c2a20', { box: [28, 23, 40, 35], strokes: 4, lw: 1.1 }); dot(c, 34, 29, 2, '#e8c46a');
    paint(c, rect(36, 14, 4, 5, 1), MET.brass, { flat: true, strokes: 0, lw: 0.8 });
  };
  KIND.kboots = function (c) {
    c.save(); c.translate(-3, 0); c.scale(.8, .8); KIND.boots(c, { m: '#7a5a3c', v: 'soft' }); c.restore();
    c.save(); c.translate(15, 9); c.scale(.8, .8); KIND.boots(c, { m: '#6a4a30', v: 'soft' }); c.restore();
    line(c, [18, 22, 26, 20], '#d9c9a0', 1);
  };
  KIND.core = function (c) {
    glow(c, 24, 24, 22, 'rgba(190,140,255,.35)');
    const g = P(p => poly(p, [24, 4, 38, 14, 38, 32, 24, 44, 10, 32, 10, 14]));
    paint(c, g, '#b693e8', { box: [10, 4, 38, 44], strokes: 6, ang: 1.1 });
    line(c, [24, 4, 24, 44], 'rgba(255,255,255,.3)', 1); line(c, [10, 14, 24, 22, 38, 14], 'rgba(255,255,255,.4)', 1); line(c, [10, 32, 24, 22, 38, 32], 'rgba(255,255,255,.28)', 1);
    c.save(); c.clip(g); line(c, [26, 8, 22, 18, 28, 26, 22, 36, 25, 42], '#2a1448', 1.5); line(c, [22, 18, 14, 22], '#2a1448', 1); c.restore();
    glow(c, 19, 12, 6, 'rgba(255,255,255,.55)');
  };
  KIND.flask = function (c) {
    KIND.potion(c, { liq: '#e0b040', cork: '#6a4a2a' });
    c.save(); c.globalAlpha = .95; paint(c, P(p => { p.moveTo(24, 2); p.quadraticCurveTo(29, 8, 24, 11); p.quadraticCurveTo(19, 8, 24, 2); }), '#ffb030', { flat: true, strokes: 0, lw: .8 }); c.restore();
    glow(c, 24, 8, 8, 'rgba(255,190,60,.5)');
  };
  KIND.press = function (c) {
    paint(c, rect(8, 34, 32, 9, 2), '#5c6062', { box: [8, 34, 40, 43], strokes: 10 });
    paint(c, rect(18, 10, 12, 25, 1), '#767c7e', { box: [18, 10, 30, 35], strokes: 8 });
    paint(c, rect(12, 6, 24, 6, 2), MET.brass, { box: [12, 6, 36, 12], strokes: 4, lw: 1.2 });
    paint(c, circ(24, 22, 7), '#e9e2c8', { box: [17, 15, 31, 29], strokes: 2, lw: 1.2 }); line(c, [24, 22, 28, 18], '#9c2a20', 1.2); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; line(c, [24 + Math.cos(a) * 5, 22 + Math.sin(a) * 5, 24 + Math.cos(a) * 6.2, 22 + Math.sin(a) * 6.2], '#3a342a', .8); }
    line(c, [36, 9, 44, 4], MET.iron, 2.4); dot(c, 44.5, 3.8, 2, '#8d4a2a');
    paint(c, rect(14, 38, 20, 3, 1), '#c7b98a', { flat: true, strokes: 0, lw: .8 });
  };
  KIND.book = function (c, o) {
    const cov = o.cov || '#3d5a8a';
    paint(c, rect(9, 5, 30, 38, 2), cov, { box: [9, 5, 39, 43], strokes: 20 });
    paint(c, rect(9, 5, 5, 38, 1), dark(cov, .3), { box: [9, 5, 14, 43], strokes: 3, lw: 1.1 });
    paint(c, rect(36, 8, 4, 32, 1), '#e6dcc0', { box: [36, 8, 40, 40], strokes: 3, lw: 1 });
    if (o.band) { paint(c, rect(9, 14, 30, 3, 0), o.band, { flat: true, strokes: 0, lw: .8 }); paint(c, rect(9, 31, 30, 3, 0), o.band, { flat: true, strokes: 0, lw: .8 }); }
    if (o.title) paint(c, rect(17, 19, 16, 9, 1), o.title, { flat: true, strokes: 0, lw: .9 });
    if (o.ribbon) { paint(c, P(p => poly(p, [28, 42, 31, 42, 31, 47, 29.5, 45, 28, 47])), o.ribbon, { flat: true, strokes: 0, lw: .9 }); }
    if (o.clasp) { paint(c, rect(33, 21, 6, 6, 1), MET.brass, { flat: true, strokes: 0, lw: .9 }); }
    if (o.ruled) for (let i = 0; i < 4; i++) line(c, [18, 21 + i * 2.4, 32, 21 + i * 2.4], 'rgba(40,30,20,.6)', .7);
  };
  KIND.ledger = function (c) {
    [[6, 30, '#c7ba92'], [3, 24, '#d8cca4'], [0, 18, '#e8dfbb']].forEach(([dx, dy, col], i) => { c.save(); c.translate(dx + 3, dy - 14); c.rotate(-0.06 + i * 0.05); paint(c, rect(7, 10, 28, 22, 1), col, { box: [7, 10, 35, 32], strokes: 6, lw: 1.2 }); for (let k = 0; k < 4; k++) line(c, [10, 15 + k * 4.5, 31, 15 + k * 4.5], 'rgba(60,50,40,.5)', .8); c.restore(); });
    paint(c, rect(30, 26, 12, 8, 1), '#a8281e', { flat: true, strokes: 0, lw: .9 }); line(c, [32, 30, 40, 30], '#f0e0c0', 1);
    line(c, [14, 44, 34, 44], 'rgba(0,0,0,.3)', 2);
  };
  KIND.folder = function (c) {
    paint(c, P(p => poly(p, [5, 12, 18, 12, 21, 16, 43, 16, 43, 42, 5, 42])), '#8e9ba0', { box: [5, 12, 43, 42], strokes: 16 });
    paint(c, rect(8, 20, 33, 22, 1), '#c9ccc4', { box: [8, 20, 41, 42], strokes: 4, lw: 1 });
    paint(c, rect(14, 25, 20, 9, 1), '#e4e0d0', { flat: true, strokes: 0, lw: .8 }); line(c, [17, 29, 31, 29], '#444', 1.2); line(c, [17, 32, 27, 32], '#444', .8);
    paint(c, P(p => poly(p, [34, 14, 40, 14, 40, 22, 37, 20, 34, 22])), '#7a2a24', { flat: true, strokes: 0, lw: .8 });
  };
  KIND.cloak = function (c) {
    paint(c, P(p => { p.moveTo(14, 7); p.quadraticCurveTo(24, 3, 34, 7); p.lineTo(43, 41); p.quadraticCurveTo(24, 47, 5, 41); p.closePath(); }), '#b32a2a', { box: [5, 3, 43, 47], strokes: 22, ang: 1.5 });
    line(c, [24, 9, 24, 44], 'rgba(0,0,0,.28)', 1.2); line(c, [16, 12, 11, 40], 'rgba(255,255,255,.2)', 1.4); line(c, [33, 12, 37, 40], 'rgba(0,0,0,.25)', 1.2);
    paint(c, P(p => { p.moveTo(14, 7); p.quadraticCurveTo(24, 12, 34, 7); p.quadraticCurveTo(24, 3, 14, 7); }), '#d6b64a', { flat: true, strokes: 0, lw: 1 });
    dot(c, 24, 10, 1.6, '#e8dcb0');
  };
  KIND.spool = function (c) {
    paint(c, rect(12, 6, 24, 5, 2), '#8a6a45', { box: [12, 6, 36, 11], strokes: 3, lw: 1.2 });
    paint(c, rect(12, 37, 24, 5, 2), '#8a6a45', { box: [12, 37, 36, 42], strokes: 3, lw: 1.2 });
    paint(c, rect(15, 11, 18, 26, 1), '#d9d2c2', { box: [15, 11, 33, 37], strokes: 10, ang: 0 });
    for (let y = 13; y < 36; y += 2.6) line(c, [15, y, 33, y + 1], 'rgba(120,110,90,.45)', .9);
    c.beginPath(); c.moveTo(33, 30); c.bezierCurveTo(44, 32, 36, 44, 44, 44); c.strokeStyle = '#d9d2c2'; c.lineWidth = 1.4; c.stroke();
  };
  KIND.letter = function (c) {
    paint(c, rect(5, 10, 38, 28, 1), '#e8dcc0', { box: [5, 10, 43, 38], strokes: 14 });
    line(c, [5, 10, 24, 26, 43, 10], 'rgba(90,70,40,.55)', 1.2); line(c, [5, 38, 18, 24], 'rgba(90,70,40,.35)', 1); line(c, [43, 38, 30, 24], 'rgba(90,70,40,.35)', 1);
    paint(c, circ(24, 26, 5), '#7a1f2a', { box: [19, 21, 29, 31], strokes: 3, lw: 1.1 }); line(c, [22, 26, 26, 26], '#c9606a', 1); line(c, [24, 24, 24, 28], '#c9606a', 1);
  };
  KIND.silkbolt = function (c) {
    paint(c, rect(8, 12, 32, 26, 3), '#e6e0f0', { box: [8, 12, 40, 38], strokes: 12, ang: 0 });
    paint(c, P(p => p.ellipse(10, 25, 4, 13, 0, 0, 7)), '#cfc7e0', { box: [6, 12, 14, 38], strokes: 4, lw: 1.2 });
    for (let x = 16; x < 40; x += 4) line(c, [x, 14, x + 1, 36], 'rgba(150,140,190,.4)', 1);
    line(c, [10, 14, 38, 14], 'rgba(255,255,255,.7)', 1.2); paint(c, rect(24, 12, 4, 26, 0), '#b32a2a', { flat: true, strokes: 0, lw: .8 });
    c.beginPath(); c.moveTo(40, 30); c.bezierCurveTo(46, 36, 42, 44, 36, 43); c.strokeStyle = '#e6e0f0'; c.lineWidth = 3; c.stroke();
  };
  KIND.valve = function (c) {
    paint(c, rect(20, 24, 8, 20, 1), MET.brass, { box: [20, 24, 28, 44], strokes: 6, lw: 1.2 });
    paint(c, rect(12, 38, 24, 6, 2), MET.copper, { box: [12, 38, 36, 44], strokes: 4, lw: 1.2 });
    c.beginPath(); c.arc(24, 15, 11, 0, 7); c.strokeStyle = INK; c.lineWidth = 5; c.stroke(); c.strokeStyle = '#a73a2c'; c.lineWidth = 3; c.stroke();
    line(c, [24, 4, 24, 26], '#a73a2c', 2.4); line(c, [13, 15, 35, 15], '#a73a2c', 2.4);
    paint(c, circ(24, 15, 3), MET.brass, { flat: true, strokes: 0, lw: 1 });
  };
  KIND.bigkey = function (c) {
    c.save(); c.translate(24, 24); c.rotate(-Math.PI / 4); c.translate(-24, -24);
    paint(c, rect(22, 16, 4, 30, 1), MET.iron, { box: [22, 16, 26, 46], strokes: 6, lw: 1.2 });
    paint(c, P(p => { p.arc(24, 9, 8, 0, Math.PI * 2); p.arc(24, 9, 3.4, 0, Math.PI * 2, true); }), MET.iron, { box: [16, 1, 32, 17], strokes: 6 });
    paint(c, rect(26, 36, 7, 3.5, 1), MET.iron, { box: [26, 36, 33, 40], strokes: 1, lw: 1.1 }); paint(c, rect(26, 42, 5, 3.5, 1), MET.iron, { box: [26, 42, 31, 46], strokes: 1, lw: 1.1 });
    c.restore();
  };
  KIND.bell = function (c) {
    paint(c, P(p => { p.moveTo(24, 5); p.quadraticCurveTo(34, 5, 34, 18); p.quadraticCurveTo(34, 30, 41, 36); p.lineTo(7, 36); p.quadraticCurveTo(14, 30, 14, 18); p.quadraticCurveTo(14, 5, 24, 5); p.closePath(); }), MET.bell, { box: [7, 5, 41, 36], strokes: 20, ang: 1.4 });
    line(c, [18, 10, 17, 28], 'rgba(255,255,255,.5)', 1.6); line(c, [10, 33, 38, 33], 'rgba(0,0,0,.28)', 1);
    paint(c, rect(22, 2, 4, 5, 1), MET.iron, { flat: true, strokes: 0, lw: 1 });
    // unrung: the clapper is bound with cloth so it cannot sound
    paint(c, circ(24, 41, 3.2), '#6d6a60', { box: [20, 38, 28, 45], strokes: 2, lw: 1 }); line(c, [24, 36, 24, 38], '#d9d2c2', 2);
    line(c, [21, 38, 27, 40], '#d9d2c2', 1.4);
  };
  KIND.cylinder = function (c) {
    paint(c, rect(10, 10, 28, 28, 5), '#d9c079', { box: [10, 10, 38, 38], strokes: 14, ang: 0.2 });
    for (let x = 14; x < 38; x += 3.2) line(c, [x, 11, x, 37], 'rgba(90,60,10,.4)', .9);
    paint(c, P(p => p.ellipse(24, 10, 14, 4, 0, 0, 7)), '#e6d390', { box: [10, 6, 38, 14], strokes: 2, lw: 1.2 });
    paint(c, P(p => p.ellipse(24, 10, 4.5, 1.6, 0, 0, 7)), '#2a1c10', { flat: true, strokes: 0, lw: .8 });
    paint(c, rect(8, 36, 32, 5, 2), '#6a4a30', { box: [8, 36, 40, 41], strokes: 3, lw: 1.2 });
  };
  KIND.dispatch = function (c) {
    paint(c, P(p => poly(p, [6, 14, 40, 8, 43, 36, 8, 42])), '#e4d8b4', { box: [6, 8, 43, 42], strokes: 14 });
    for (let i = 0; i < 4; i++) line(c, [11, 17 + i * 5, 36, 14 + i * 5], 'rgba(60,50,40,.5)', .9);
    paint(c, P(p => poly(p, [28, 8, 34, 7.5, 36, 36, 30, 36.6])), '#b32a2a', { flat: true, strokes: 0, lw: .9 });
    paint(c, circ(32, 22, 4), '#7a1f1f', { flat: true, strokes: 0, lw: .9 }); line(c, [30.5, 22, 33.5, 22], '#e8c070', 1);
    paint(c, P(p => poly(p, [6, 14, 14, 8, 20, 9, 8, 20])), '#cdbf92', { flat: true, strokes: 0, lw: .9 });
  };
  KIND.gem = function (c, o) { KIND.shard(c, { col: o.col || '#c8a0e0' }); };

  // ---------------------------------------------------------------- the icon table
  // Item ids map to [kind, params]. Weapon icons are keyed 'weapon:<WEAPONS id>'; the shop/inventory
  // w_<id> items share them. Anything not listed falls back by catalog flags (see plan()).
  const M = MET;
  const TABLE = {
    'weapon:sword': ['blade', { m: M.iron, len: 24, w: 4.6, g: 9 }],
    'weapon:longsword': ['blade', { m: M.steel, len: 29, w: 4.4, g: 11, gc: M.iron, pom: M.iron }],
    'weapon:knife': ['blade', { m: M.iron, len: 12, w: 4.6, g: 5, fuller: false, grip: '#8a6a45', curve: true }],
    'weapon:sable_dagger': ['blade', { m: M.steel, len: 13, w: 4, g: 5.5, fuller: false, grip: M.ivory, gc: M.silver, pom: M.ivory, tip: M.glass, glow: 'rgba(170,150,255,.5)' }],
    'weapon:tobin_blade': ['blade', { m: M.bronze, len: 28, w: 4.4, g: 11, gc: M.bronze, pom: M.bronze, glow: 'rgba(120,200,255,.55)', glow2: '#bfe6ff', runes: '#5b3b12' }],
    'weapon:axe': ['axe', { m: M.iron, cord: '#7a5a3a' }],
    'weapon:vesper_hook': ['axe', { m: M.steel, deck: true, rim: M.brass, cord: '#a8281e' }],
    'weapon:mace': ['mace', { m: M.bell }],
    'weapon:tollhammer': ['tollhammer', {}],
    'weapon:maul': ['maul', {}],
    'weapon:spear': ['spear', { m: M.bronze }],
    'weapon:crossbow': ['crossbow', {}],
    'weapon:pistol': ['pistol', {}],
    'weapon:throwknife': ['tknives', {}],
    'weapon:hands': ['fist', {}],
    'weapon:glass': ['glassarm', {}],

    'a_cap': ['helm', { v: 'cap', m: '#8a5a38' }],
    'a_hood': ['helm', { v: 'hood', m: '#35504a' }],
    'a_kettle': ['helm', { v: 'kettle', m: M.iron }],
    'a_bellhelm': ['helm', { v: 'bell', m: M.bell, fin: M.gold }],
    'a_synodrobe': ['body', { v: 'robe', m: '#8a9290' }],
    'a_gambeson': ['body', { v: 'gambeson', m: '#b49a6c' }],
    'a_jerkin': ['body', { v: 'jerkin', m: '#8a5530' }],
    'a_hushcoat': ['body', { v: 'hushcoat', m: '#3b5a52' }],
    'a_brig': ['body', { v: 'brig', m: '#5d6b4c' }],
    'a_chain': ['body', { v: 'chain', m: '#8e9a9e' }],
    'a_plate': ['body', { v: 'plate', m: M.bell }],
    'a_gloves': ['gloves', { m: '#8a5a38' }],
    'a_gauntlets': ['gloves', { m: '#6f5a46', mail: true, cuff: '#8e9a9e' }],
    'a_softboots': ['boots', { v: 'soft', m: '#8a8068' }],
    'a_hobnails': ['boots', { v: 'hob', m: '#5a3d26' }],
    'a_greaves': ['boots', { v: 'greaves', m: '#5a4630' }],
    'a_buckler': ['shield', { v: 'buckler', m: '#6d5140' }],
    'a_kite': ['shield', { v: 'kite', m: '#7a3a34' }],

    'pellets': ['pellets', {}], 'bolts': ['bolts', {}], 'tknives': ['tknives', {}],
    'tonic': ['potion', { liq: '#d98a30', label: '#e8dcb7' }],
    'honey': ['jar', { liq: '#d79a2a' }],
    'sovereigns': ['coins', {}],
    'bottle': ['vox', {}], 'empty_bottle': ['bottle', {}],
    'whistle': ['whistle', {}], 'bandage': ['bandage', {}], 'whetstone': ['whetstone', {}],
    'pebble': ['pebble', {}], 'shard': ['shard', { col: '#8fe08a' }], 'flume_eel': ['eel', {}],
    'cache': ['chest', {}],
    'herb_willow': ['herb', { v: 'bark' }], 'herb_reed': ['herb', { v: 'reed' }], 'herb_moss': ['herb', { v: 'moss' }],

    'v_scrap': ['scrap', {}], 'v_mesh': ['mesh', {}], 'v_gear': ['cog', {}], 'v_signet': ['signet', {}], 'v_fork': ['fork', {}],

    'coil': ['coil', {}],
    'charts': ['scroll', { paper: '#e5d7ae', ink: '#8a2d22' }],
    'pass': ['card', {}],
    'boots': ['kboots', {}],
    'core': ['core', {}],
    'oil': ['flask', {}],
    'press741': ['press', {}],
    'returns': ['ledger', {}],
    'folder': ['folder', {}],
    'redcloak': ['cloak', {}],
    'roundbook': ['book', { cov: '#3d5a8a', band: '#d6b64a', title: '#e6dcc0' }],
    'thread': ['spool', {}],
    'adaletter': ['letter', {}],
    'liftsilk': ['silkbolt', {}],
    'valve': ['valve', {}],
    'holdkey': ['bigkey', {}],
    'register': ['book', { cov: '#4a2f3a', ribbon: '#b32a2a', clasp: true, ruled: true }],
    'cutterlog': ['book', { cov: '#4f5b3c', band: '#2a2a22', title: '#c9b987', ruled: true }],
    'unrungbell': ['bell', {}],
    'hornwax': ['cylinder', {}],
    'dispatch': ['dispatch', {}],
  };
  // ---------------------------------------------------------------- what to draw for an id
  function catalogHas(kind, id) {
    try {
      if (kind === 'item') return typeof ITEMS !== 'undefined' && has(ITEMS, id);
      if (kind === 'weapon') return typeof WEAPONS !== 'undefined' && has(WEAPONS, id);
    } catch (e) { /* ignore */ }
    return false;
  }
  // Items added later that have no table row still get a category-appropriate icon, varied by id.
  function fallbackPlan(id) {
    const it = ITEMS[id], h = hash(id), pick = a => a[h % a.length];
    const cols = ['#d98a30', '#9c5fd0', '#5fb06a', '#c05a5a', '#5f8fd0'];
    if (it.weapon && has(WEAPONS, it.weapon)) return planFor('weapon:' + it.weapon) || ['blade', { m: M.iron }];
    if (it.armor) {
      const k = { head: 'helm', body: 'body', hands: 'gloves', feet: 'boots', shield: 'shield' }[it.slot] || 'body';
      return [k, { v: k === 'helm' ? 'kettle' : k === 'body' ? 'gambeson' : k === 'boots' ? 'soft' : 'buckler', m: pick(['#8a5a38', '#8e9a9e', '#3b5a52', '#a48a62']) }];
    }
    if (it.valuable) return ['gem', { col: pick(['#c8a0e0', '#e0c070', '#80c0e0']) }];
    if (it.herb) return ['herb', { v: pick(['bark', 'reed', 'moss']) }];
    if (it.use === 'ammo') return ['pellets', {}];
    if (it.use === 'cache') return ['chest', {}];
    if (it.key) return pick([['scroll', { paper: '#dccfa6', ink: '#355a8a' }], ['book', { cov: pick(cols), band: '#d6b64a' }], ['card', {}]]);
    if (it.use) return ['potion', { liq: pick(cols) }];
    return ['pebble', {}];
  }
  function planFor(key) { return has(TABLE, key) ? TABLE[key] : null; }
  function plan(id) {
    if (has(TABLE, id)) return TABLE[id];
    if (catalogHas('item', id)) {
      const it = ITEMS[id];
      if (it.weapon && has(TABLE, 'weapon:' + it.weapon)) return TABLE['weapon:' + it.weapon];
      return fallbackPlan(id);
    }
    return null;
  }
  function weaponPlan(wid) {
    if (!catalogHas('weapon', wid)) return null;
    if (has(TABLE, 'weapon:' + wid)) return TABLE['weapon:' + wid];
    const W = WEAPONS[wid]; // an unlisted weapon: pick by its catalog flags
    if (W.ranged) return W.ammo === 'bolts' ? TABLE['weapon:crossbow'] : TABLE['weapon:pistol'];
    if (W.blunt) return TABLE['weapon:mace'];
    if (W.twoHanded) return TABLE['weapon:spear'];
    return TABLE['weapon:sword'];
  }

  // ================================================================ Phase 20 FOLK: hand-built pixel-art icons
  // Every catalog id has its own 24x24 pixel drawing (PIX below), shown at 2x on a pixel-art plate. The drawings are
  // pixel data placed by hand on an integer grid (ASCII rows or integer primitives); one shading rule (light from the
  // top-left, five-tone hue-shifted ramps: shadows lean cool, lights lean warm), one ink outline and one 1px drop
  // shadow keep the whole set consistent. Deterministic: no random numbers anywhere. The Phase 5 painted kinds above
  // stay as the fallback for ids added later without a drawing, and for the paper doll's layers.
  const PXN = 24, PX_INK = [24, 16, 11];
  function rgb2hsl(c) {
    const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l];
    const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  }
  function hsl2rgb(h, s, l) {
    s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }
  function hueTo(h, target, amt) { const d = ((target - h + 540) % 360) - 180; return (h + d * amt + 360) % 360; }
  const rampCache = {};
  // five tones per base colour: 0 deep shadow, 1 shadow, 2 base, 3 light, 4 glint
  function ramp(base) {
    if (rampCache[base]) return rampCache[base];
    const hs = rgb2hsl(hex(base)), h = hs[0], s = hs[1], l = hs[2];
    const grey = s < 0.08;
    const T = [
      [grey ? h : hueTo(h, 245, 0.18), grey ? s : Math.min(1, s * 1.08 + 0.04), Math.max(0.1, l * 0.5)],
      [grey ? h : hueTo(h, 245, 0.08), grey ? s : Math.min(1, s * 1.04 + 0.02), Math.max(0.16, l * 0.74)],
      [h, s, l],
      [grey ? h : hueTo(h, 52, 0.08), s * 0.95, l + (1 - l) * 0.3],
      [grey ? h : hueTo(h, 52, 0.14), s * 0.75, l + (1 - l) * 0.62],
    ].map(t => hsl2rgb(t[0], t[1], t[2]));
    return (rampCache[base] = T);
  }
  const mixRGB = (a, b, t) => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t));

  function PxLayer(col, o, W, H) { this.col = col; this.o = o || {}; this.W = W || PXN; this.H = H || PXN; this.m = new Uint8Array(this.W * this.H); this.ov = {}; this.v = 1; }
  const LP = PxLayer.prototype;
  LP.set = function (x, y) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.W && y < this.H) { const i = y * this.W + x; this.m[i] = this.v; if (!this.v) delete this.ov[i]; } return this; };
  LP.cut = function () { this.v = 0; return this; };   // following primitives erase
  LP.add = function () { this.v = 1; return this; };
  LP.px = function () { for (let i = 0; i + 1 < arguments.length; i += 2) this.set(arguments[i], arguments[i + 1]); return this; };
  LP.rect = function (x, y, w, h) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j); return this; };
  LP.ell = function (cx, cy, rx, ry) {
    for (let y = Math.max(0, Math.floor(cy - ry - 1)); y < Math.min(this.H, cy + ry + 1); y++) for (let x = Math.max(0, Math.floor(cx - rx - 1)); x < Math.min(this.W, cx + rx + 1); x++) { const a = (x + 0.5 - cx) / rx, b = (y + 0.5 - cy) / ry; if (a * a + b * b <= 1.0001) this.set(x, y); }
    return this;
  };
  LP.poly = function (p) {
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      const X = x + 0.5, Y = y + 0.5; let inside = false;
      for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
        const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
        if ((yi > Y) !== (yj > Y) && X < (xj - xi) * (Y - yi) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) this.set(x, y);
    }
    return this;
  };
  LP.line = function (x0, y0, x1, y1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
    for (let n = 0; n < 99; n++) { this.set(x0, y0); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
    return this;
  };
  // a fat stroke: discs of radius r stamped along a polyline (eels, cords, curls)
  LP.thick = function (pts, r) {
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const x0 = pts[i], y0 = pts[i + 1], x1 = pts[i + 2], y1 = pts[i + 3], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
      for (let k = 0; k <= n; k++) { const t = k / n, rr = typeof r === 'function' ? r((i / 2 + t) / (pts.length / 2 - 1)) : r; this.ell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, rr, rr); }
    }
    return this;
  };
  LP.path = function (pts) { for (let i = 0; i + 3 < pts.length; i += 2) this.line(pts[i], pts[i + 1], pts[i + 2], pts[i + 3]); return this; };
  // a band along the (1,-1) diagonal: columns x0..x1, anti-diagonals x+y = c0..c1 (blades, shafts, handles)
  LP.diag = function (x0, x1, c0, c1) { for (let x = x0; x <= x1; x++) for (let c = c0; c <= c1; c++) this.set(x, c - x); return this; };
  // force a ramp tone on pixels: tone(k, x, y, x, y, ...)
  LP.tone = function (k) { for (let i = 1; i + 1 < arguments.length; i += 2) { const x = arguments[i], y = arguments[i + 1]; if (x >= 0 && y >= 0 && x < this.W && y < this.H) { const j = y * this.W + x; this.m[j] = 1; this.ov[j] = k; } } return this; };
  LP.toneRect = function (k, x, y, w, h) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.tone(k, i, j); return this; };
  LP.toneDiag = function (k, x0, x1, c) { for (let x = x0; x <= x1; x++) this.tone(k, x, c - x); return this; };

  // upright shapes laid on the 45-degree diagonal (tip to the top-right): local x right, local y down, around the
  // icon's tilt centre; edges that are upright in local space come out as clean 45-degree pixel stairs
  const RS = Math.SQRT1_2;
  LP.rpoly = function (p) {
    const c = (this.ic && this.ic.T) || [12, 12, 0.82], k = RS * c[2], q = [];
    for (let i = 0; i + 1 < p.length; i += 2) q.push(c[0] + (p[i] - p[i + 1]) * k, c[1] + (p[i] + p[i + 1]) * k);
    return this.poly(q);
  };
  LP.rrect = function (x, y, w, h) { return this.rpoly([x, y, x + w, y, x + w, y + h, x, y + h]); };
  LP.rell = function (cx, cy, rx, ry) { const q = []; for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; q.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); } return this.rpoly(q); };
  // tone a local-space point (after the tilt)
  LP.rtone = function (k) { for (let i = 1; i + 1 < arguments.length; i += 2) { const p = this.ic.rp(arguments[i], arguments[i + 1]); this.tone(k, p[0], p[1]); } return this; };

  function PxIcon(W, H) { this.W = W || PXN; this.H = H || PXN; this.layers = []; this.marks = []; this.T = [12, 12, 0.82]; }
  PxIcon.prototype.layer = function (col, o) { const L = new PxLayer(col, o, this.W, this.H); L.ic = this; this.layers.push(L); return L; };
  PxIcon.prototype.tilt = function (cx, cy, sc) { this.T = [cx, cy, sc || 0.82]; return this; };
  // the pixel a local (tilted) point lands on
  PxIcon.prototype.rp = function (x, y) { const c = this.T, k = RS * c[2]; return [Math.floor(c[0] + (x - y) * k), Math.floor(c[1] + (x + y) * k)]; };
  PxIcon.prototype.rmark = function (col, x, y) { const p = this.rp(x, y); return this.mark(col, p[0], p[1]); };
  // detail pixels painted after shading: mark(col, x, y, x, y, ...) where col is '#rrggbb' or [layer, tone]
  PxIcon.prototype.mark = function (col) { for (let i = 1; i + 1 < arguments.length; i += 2) this.marks.push([arguments[i], arguments[i + 1], col]); return this; };
  // ASCII pixel rows placed at (ox, oy): each character maps to a layer, or to [layer, tone]; '.' and ' ' are empty
  PxIcon.prototype.grid = function (ox, oy, rows, map) {
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x], t = map[ch]; if (!t) continue;
      if (Array.isArray(t)) t[0].tone(t[1], ox + x, oy + y); else t.set(ox + x, oy + y);
    }
    return this;
  };

  // directional shading: how far a pixel sits from the lit (top-left) and shaded (bottom-right) edges of its own part,
  // weighted toward the part's thinner axis, mapped onto the ramp
  function pxShade(L, x, y) {
    const m = L.m, LW = L.W, inM = (i, j) => i >= 0 && j >= 0 && i < LW && j < L.H && m[j * LW + i];
    let dlx = 1, dsx = 1, dly = 1, dsy = 1;
    while (inM(x - dlx, y)) dlx++; while (inM(x + dsx, y)) dsx++;
    while (inM(x, y - dly)) dly++; while (inM(x, y + dsy)) dsy++;
    const spx = dlx + dsx - 1, spy = dly + dsy - 1, rx = (dlx - 0.5) / spx, ry = (dly - 0.5) / spy;
    const wx = 1 / spx, wy = 1 / spy, t = (rx * wx + ry * wy) / (wx + wy);
    const o = L.o, shiny = o.shiny;
    if (o.shade === 'flat') { return (dlx === 1 || dly === 1) ? 3 : (dsx === 1 || dsy === 1) ? 1 : 2; }
    let k = t < 0.2 ? (shiny ? 4 : 3) : t < 0.42 ? 3 : t < 0.62 ? 2 : t < 0.84 ? 1 : 0;
    if (k === 0 && Math.min(spx, spy) < 5) k = 1;   // thin parts never sink to the deepest tone
    if (o.lift) k = Math.max(0, Math.min(4, k + o.lift));
    return k;
  }
  // tones: 'weapon' | 'armor' | 'item' | 'key' | 'valuable' plate colours (same family as the painted plates)
  const PX_PLATE = { weapon: [[66, 54, 42], [24, 18, 13]], armor: [[56, 61, 66], [19, 21, 23]], item: [[64, 49, 54], [22, 15, 18]], key: [[68, 60, 38], [23, 20, 11]], valuable: [[46, 62, 62], [14, 21, 21]] };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function pxRender(icon, tone, plate) {
    const N = icon.W, NH = icon.H, A = new Array(N * NH).fill(null), own = new Int16Array(N * NH).fill(-1);
    icon.layers.forEach((L, li) => {
      const R = ramp(L.col);
      for (let y = 0; y < NH; y++) for (let x = 0; x < N; x++) {
        const i = y * N + x; if (!L.m[i]) continue;
        let k = L.ov[i] != null ? L.ov[i] : pxShade(L, x, y);
        if (L.ov[i] == null && L.o.sep !== false) {
          // a part laid over another part gets a dark seam on its lower-right edge, so parts read as separate pieces
          const rb = (x + 1 < N && own[i + 1] >= 0 && !L.m[i + 1]) || (y + 1 < NH && own[i + N] >= 0 && !L.m[i + N]);
          if (rb) k = Math.min(k, 1);
        }
        A[i] = R[k]; own[i] = li;
      }
    });
    for (const [x, y, col] of icon.marks) {
      if (x < 0 || y < 0 || x >= N || y >= NH) continue;
      const i = y * N + x; A[i] = Array.isArray(col) ? ramp(col[0].col)[col[1]] : hex(col); if (own[i] < 0) own[i] = 99;
    }
    // ink outline around the whole silhouette (4-neighbour), a little warmer on the lit side
    const O = A.slice();
    for (let y = 0; y < NH; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x; if (A[i]) continue;
      const r = x + 1 < N && A[i + 1], b = y + 1 < NH && A[i + N], l = x > 0 && A[i - 1], u = y > 0 && A[i - N];
      if (r || b) O[i] = mixRGB(PX_INK, r || b, 0.18); else if (l || u) O[i] = PX_INK;
    }
    if (icon.noOutline) for (let i = 0; i < O.length; i++) if (!A[i]) O[i] = null;
    const out = new Uint8ClampedArray(N * NH * 4);
    const P = PX_PLATE[tone] || PX_PLATE.item;
    for (let y = 0; y < NH; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, q = i * 4; let c = O[i], a = 255;
      if (!c && plate) {
        const corner = (x === 0 || x === N - 1) && (y === 0 || y === NH - 1);
        if (corner) { a = 0; c = [0, 0, 0]; }
        else if (x === 0 || y === 0) c = mixRGB(P[0], [200, 168, 104], 0.3);
        else if (x === N - 1 || y === NH - 1) c = mixRGB(P[1], [0, 0, 0], 0.35);
        else {
          const d = Math.hypot(x - 8, y - 7) / 19, lv = Math.max(0, Math.min(3, Math.floor(d * 4 + BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5)));
          c = mixRGB(P[0], P[1], lv / 4);
          // drop shadow: one pixel down-right of the outlined silhouette
          if (x > 0 && y > 0 && O[i - N - 1]) c = mixRGB(c, [0, 0, 0], 0.45);
        }
      } else if (!c) { a = 0; c = [0, 0, 0]; }
      out[q] = c[0]; out[q + 1] = c[1]; out[q + 2] = c[2]; out[q + 3] = a;
    }
    return out;
  }
  function pxCanvas(draw, tone, plate) {
    const cv = makeCanvas(); if (!cv) return null;
    const icon = new PxIcon(); draw(icon);
    const data = pxRender(icon, tone, plate !== false);
    const sm = document.createElement('canvas'); sm.width = sm.height = PXN;
    sm.getContext('2d').putImageData(new ImageData(data, PXN, PXN), 0, 0);
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(sm, 0, 0, S, S);
    return cv;
  }
  // Phase 20 FOLK: the same pixel engine for small world sprites (crows, rats, the cat's walk): returns the engine's
  // sprite format {w, h, data: Uint32Array} with an ink outline and no plate. o.ink: outline colour [r,g,b]
  function pxSprite(W, H, draw, o) {
    const icon = new PxIcon(W, H); icon.T = [W / 2, H / 2, 1]; draw(icon);
    if (o && o.noOutline) icon.noOutline = true;
    const px = pxRender(icon, 'item', false), d = new Uint32Array(px.buffer);
    return { w: W, h: H, data: d };
  }

  // ---------------------------------------------------------------- palette (base tones; ramps derive the rest)
  const C = {
    iron: '#8f989b', steel: '#aeb8bc', dsteel: '#6c7478', bronze: '#b27a3c', bell: '#c48f42', brass: '#c79a38', gold: '#d8ad3c',
    silver: '#c3cbcf', copper: '#b0613a', lead: '#6e7176', glass: '#56c9d6', lilac: '#a184d4', green: '#7cc45a',
    wood: '#7a5130', ash: '#a07c4e', dwood: '#56371f', pale: '#c9b58a', leather: '#83522f', dleather: '#5b3822', tan: '#a8774a',
    cloth: '#a48a62', wool: '#9c978c', grey: '#7d7f80', felt: '#6f6a64', linen: '#d8ceb4', paper: '#ddcda2', parch: '#c9b17e',
    wax: '#a52a26', red: '#a8342a', crimson: '#8c1f24', blue: '#3e5f92', navy: '#2e3e60', teal: '#3c6a62', moss: '#5f7a3c',
    reed: '#a9b25e', straw: '#d0b45a', honey: '#d4921f', amber: '#d07a22', bone: '#ddd0ae', ivory: '#e4d8ba', stone: '#8c877d',
    slate: '#4f565c', clay: '#a8683e', eel: '#5e7a3c', skin: '#c99272', ink: '#2d2620', cream: '#e8dfc4', black: '#34302c',
  };
  const PIX = {};
  // PIX-BEGIN
  // ---------------------------------------------------------------- weapons (tip to the top-right)
  const wrap = (L, y0, y1, step) => { for (let y = y0; y < y1; y += step || 2) L.rtone(1, 0, y); return L; };
  PIX['weapon:sword'] = d => {   // Short Sword: plain Synod iron, brass guard
    wrap(d.layer(C.leather).rrect(-1.2, 4, 2.4, 6.6), 5, 11);
    d.layer(C.iron, { shiny: 1 }).rpoly([-1.7, 4, -1.7, -9.5, 0, -12.5, 1.7, -9.5, 1.7, 4]);
    d.layer(C.brass).rrect(-4.6, 3, 9.2, 2.2);
    d.layer(C.brass, { shiny: 1 }).rell(0, 12, 1.8, 1.8);
  };
  PIX['weapon:longsword'] = d => {   // Synod Longsword: long steel, fuller, iron cross
    d.tilt(12, 12);
    wrap(d.layer(C.dleather).rrect(-1.2, 4.5, 2.4, 7.5), 5, 12);
    const b = d.layer(C.steel, { shiny: 1 }).rpoly([-1.8, 4, -1.8, -12, 0, -15, 1.8, -12, 1.8, 4]);
    for (let y = -11; y < 3; y++) b.rtone(1, 0.2, y);
    d.layer(C.iron).rpoly([-6.5, 2.6, 6.5, 2.6, 6.5, 4.8, -6.5, 4.8]).rtone(3, -6, 3, 6, 3);
    d.layer(C.iron, { shiny: 1 }).rell(0, 13.4, 1.9, 1.9);
  };
  PIX['weapon:knife'] = d => {   // Carder's Knife: short hooked blade on a pale wooden handle
    d.tilt(13, 11);
    const h = d.layer(C.pale).rrect(-1.6, 1, 3.2, 9);
    d.layer(C.iron, { shiny: 1 }).rpoly([-1.6, 1.4, -1.8, -4, -0.6, -8, 1.2, -9.2, 2.2, -6.5, 1.8, 1.4]);
    d.layer(C.brass).rrect(-1.9, 0.4, 3.8, 1.6);
    h.rtone(1, 0.3, 4.5).rtone(1, 0.3, 7.5);
    d.mark('#e9dcae', 13, 14);
  };
  PIX['weapon:sable_dagger'] = d => {   // Sable's Ivory Nib-Knife: ivory handle, silver guard, lilac glass point
    d.tilt(12, 12);
    d.layer(C.ivory).rpoly([-1.3, 3, 1.3, 3, 1.6, 10, 0, 11.5, -1.6, 10]);
    d.layer(C.silver, { shiny: 1 }).rpoly([-1.2, 3, -1.2, -6, 1.2, -6, 1.2, 3]);
    d.layer(C.lilac, { shiny: 1 }).rpoly([-1.2, -5.6, 1.2, -5.6, 0, -11.5]);
    d.layer(C.silver).rrect(-3.4, 2, 6.8, 1.8);
    d.mark('#efe6ff', 16, 5).mark('#d9c8ff', 18, 3);
  };
  PIX['weapon:tobin_blade'] = d => {   // Tobin's Tuning-Blade: bronze, runes that hold a little light
    d.tilt(12, 12);
    wrap(d.layer(C.dleather).rrect(-1.2, 4.4, 2.4, 7), 5, 12);
    const b = d.layer(C.bronze, { shiny: 1 }).rpoly([-2, 4, -2, -11.5, 0, -15, 2, -11.5, 2, 4]);
    d.layer(C.bronze).rpoly([-6, 3.4, -4.5, 2.2, 4.5, 2.2, 6, 3.4, 4.5, 4.8, -4.5, 4.8]);
    d.layer(C.bronze, { shiny: 1 }).rell(0, 12.8, 2, 2);
    for (let y = -10; y <= 1; y += 3) d.rmark('#a8f0ff', 0.2, y);
    void b;
  };
  PIX['weapon:axe'] = d => {   // Boarding Axe: bearded iron head, hatch spike, corded haft
    d.tilt(11, 13);
    const h = d.layer(C.wood).rrect(-1.2, -12, 2.4, 25);
    d.layer(C.iron, { shiny: 1 }).rpoly([0.8, -12.5, 4.5, -13.5, 8, -11.5, 9.2, -6, 8.4, -1.5, 6.4, -3.2, 4.6, -6.6, 0.8, -7.8]);
    d.layer(C.iron).rpoly([-0.8, -11.6, -6.5, -10.2, -0.8, -8.6]);
    for (let y = 6; y < 11; y += 2) h.rtone(0, 0, y);
  };
  PIX['weapon:vesper_hook'] = d => {   // Vesper's Boarding Axe: steel deck-axe, brass rim, red cord
    d.tilt(11, 13);
    d.layer(C.dwood).rrect(-1.2, -12, 2.4, 25);
    d.layer(C.steel, { shiny: 1 }).rpoly([0.8, -13, 5, -14, 9, -12, 10, -7, 9, -1, 6.6, -2.6, 5, -6.4, 0.8, -7.4]);
    d.layer(C.brass, { shiny: 1 }).rpoly([8.4, -12.6, 10.2, -12, 11.2, -7, 10.2, -0.6, 9, -1, 9.4, -7]);
    d.layer(C.steel).rpoly([-0.8, -11.6, -5, -10.6, -6.6, -8.2, -0.8, -8.8]);
    d.layer(C.red).rrect(-1.5, 5.5, 3, 1.4).rrect(-1.5, 8, 3, 1.4);
  };
  PIX['weapon:mace'] = d => {   // Bell-Bronze Mace: flanged head cast from a chapel bell
    d.tilt(12, 12);
    d.layer(C.wood).rrect(-1.1, -4, 2.2, 17);
    const hd = d.layer(C.bell, { shiny: 1 });
    hd.rell(0, -8.5, 3.6, 4.2).rrect(-5.6, -9.6, 11.2, 2.2).rrect(-1.1, -14.4, 2.2, 11.6).rpoly([-4.6, -12.8, -3, -13.8, 4.6, -4.6, 3, -3.6]).rpoly([4.6, -12.8, 3, -13.8, -4.6, -4.6, -3, -3.6]);
    d.layer(C.bronze).rrect(-1.8, -3.6, 3.6, 1.6);
    d.layer(C.iron).rrect(-1.4, 11.4, 2.8, 1.8);
  };
  PIX['weapon:tollhammer'] = d => {   // Sexton's Toll-Hammer: a little bell for a head
    d.tilt(12, 12);
    d.layer(C.ash).rrect(-1.1, -2, 2.2, 15);
    d.layer(C.bell, { shiny: 1 }).rpoly([-5.4, -2.4, -4.4, -8.6, -2.6, -11.4, 0, -12.2, 2.6, -11.4, 4.4, -8.6, 5.4, -2.4, 6.4, -1.2, -6.4, -1.2]);
    d.layer(C.iron).rrect(-1.3, -14.4, 2.6, 2.6);
    d.layer(C.dsteel).rell(0, -0.2, 1.4, 1.4);
    d.layer(C.wax).rrect(-1.3, 9, 2.6, 1.6);
  };
  PIX['weapon:maul'] = d => {   // Cinderhold Steam-Maul: foundry head, pressure gauge
    d.tilt(12, 12);
    d.layer(C.wood).rrect(-1.3, -5, 2.6, 18);
    d.layer(C.dsteel, { shiny: 1 }).rrect(-8, -13.6, 16, 8.4);
    d.layer(C.iron).rrect(-8.8, -14.2, 2.6, 9.6).rrect(6.2, -14.2, 2.6, 9.6);
    d.layer(C.brass, { shiny: 1 }).rell(0, -9.4, 2.9, 2.9);
    d.layer(C.cream).rell(0, -9.4, 1.8, 1.8);
    d.rmark('#a3261c', 0.6, -10.2);
    d.layer(C.iron).rrect(-1.8, -5.4, 3.6, 1.6).rrect(-1.6, 11.4, 3.2, 1.6);
  };
  PIX['weapon:p12_greatmaul'] = d => {   // Quarry Great-Maul: lead-weighted sledge on a long ash haft
    d.tilt(12, 12);
    const h = d.layer(C.ash).rrect(-1.1, -6, 2.2, 21);
    d.layer(C.lead, { shiny: 1 }).rpoly([-7.4, -14.2, 7.4, -14.2, 6.4, -6.6, -6.4, -6.6]);
    d.layer(C.iron).rrect(-7.6, -11.4, 15.2, 1.4);
    d.layer(C.iron).rrect(-1.6, -6.6, 3.2, 2.2);
    h.rtone(0, 0, 4).rtone(0, 0, 8);
  };
  PIX['weapon:spear'] = d => {   // Tuning-Fork Spear: bronze fork on an ash shaft
    d.tilt(12, 12);
    d.layer(C.ash).rrect(-1, -4, 2, 18);
    d.layer(C.bronze, { shiny: 1 }).rpoly([-3.6, -15, -1.6, -15, -1.6, -8.6, 1.6, -8.6, 1.6, -15, 3.6, -15, 3.6, -7, 1.4, -5, 1.4, -3, -1.4, -3, -1.4, -5, -3.6, -7]);
    d.layer(C.iron).rrect(-1.6, -3.6, 3.2, 1.8);
    d.mark('#fff3c0', 21, 1).mark('#fff3c0', 23, 4);
  };
  PIX['weapon:p12_bellglaive'] = d => {   // Bell-Bronze Glaive: curved blade on a six-foot shaft
    d.tilt(12, 12);
    d.layer(C.wood).rrect(-1, -6, 2, 20);
    d.layer(C.bell, { shiny: 1 }).rpoly([-1.4, -6, -1.8, -10, -0.6, -14, 1.6, -15.6, 3.4, -13.4, 4, -9.6, 3.2, -6.6, 1.4, -6]);
    d.layer(C.bronze).rrect(-2, -6.6, 4, 2);
    d.layer(C.bronze).rrect(-1.6, 11.6, 3.2, 1.4);
  };
  PIX['weapon:p12_glassblade'] = d => {   // Long Glass-Edged Blade: steel spine, a salvaged glass edge
    d.tilt(12, 12);
    wrap(d.layer(C.dleather).rrect(-1.2, 2.6, 2.4, 10), 3, 13);
    d.layer(C.dsteel).rpoly([-0.2, 2.4, -0.2, -12.5, 2.2, -11, 2.2, 2.4]);
    d.layer(C.glass, { shiny: 1, sep: false }).rpoly([-2.4, 2.4, -2.4, -11.5, -0.6, -15, -0.2, -12.5, -0.2, 2.4]);
    d.layer(C.iron).rrect(-5, 1.4, 10, 2);
    d.layer(C.iron).rell(0, 13.6, 1.6, 1.6);
  };
  PIX['weapon:p12_dirk'] = d => {   // Reed-Guard Dirk: stiff blade, basket hilt
    d.tilt(13, 11);
    d.layer(C.dleather).rrect(-1, 2, 2, 7);
    d.layer(C.steel, { shiny: 1 }).rpoly([-1.4, 1, -1.4, -9, 0, -11.5, 1.4, -9, 1.4, 1]);
    const bk = d.layer(C.iron).rell(0, 4.8, 3.8, 4.2);
    bk.cut().rell(0, 4.8, 2.3, 2.9).add();
    d.layer(C.iron, { shiny: 1 }).rell(0, 10, 1.5, 1.5);
  };
  PIX['weapon:crossbow'] = d => {   // Rust Coast Crossbow: iron prod, wooden stock, bolt on the rail
    d.tilt(12, 12);
    d.layer(C.wood).rpoly([-1.6, -7, 1.6, -7, 1.8, 6, 3, 13, -3, 13, -1.8, 6]);
    d.layer(C.dsteel, { shiny: 1 }).rpoly([-11, -4.4, -6, -7.4, 0, -8.6, 6, -7.4, 11, -4.4, 11, -3, 6, -5.6, 0, -6.8, -6, -5.6, -11, -3]);
    const st = d.layer(C.linen, { shade: 'flat', sep: false }), a = d.rp(-10.4, -3.4), b = d.rp(10.4, -3.4), n = d.rp(0, 1.5);
    st.line(a[0], a[1], n[0], n[1]).line(b[0], b[1], n[0], n[1]);
    d.layer(C.steel).rpoly([-0.6, -12, 0.6, -12, 0.6, 1, -0.6, 1]);
    d.layer(C.iron).rrect(-2, -9.6, 4, 1.4);
  };
  PIX['weapon:pistol'] = d => {   // Glass-Shot Pistol: silver barrel, glass pellet glowing in the breech
    const fr = d.layer(C.wood);
    fr.poly([9, 11, 15, 11, 12, 21, 5, 21, 8, 13]);
    d.layer(C.silver, { shiny: 1 }).rect(5, 7, 16, 4).rect(20, 6, 2, 6);
    d.layer(C.iron).rect(3, 8, 3, 2).px(4, 7);
    d.layer(C.dsteel).path([11, 11, 11, 14, 14, 14, 14, 12]);
    d.layer(C.glass, { shiny: 1, sep: false }).rect(8, 8, 3, 2);
    fr.tone(3, 9, 12).tone(1, 7, 20, 8, 20);
    d.mark('#d8fbff', 9, 8).mark('#bff7fb', 22, 8).mark('#8ff0f8', 23, 9);
  };
  PIX['weapon:throwknife'] = d => {   // Throwing Knives: three balanced blades
    [[6, 11], [11, 13], [16, 15]].forEach(([x, y]) => {
      d.tilt(x, y, 1);
      d.layer(C.dleather).rrect(-0.9, 1, 1.8, 4.4);
      d.layer(C.steel, { shiny: 1 }).rpoly([-1.1, 1, -1.1, -4.5, 0, -6.8, 1.1, -4.5, 1.1, 1]);
      d.layer(C.iron).rell(0, 6, 1.1, 1.1);
    });
  };
  PIX['weapon:hands'] = d => {   // Bare Hands: a fist, knuckles forward
    d.layer(C.dleather).rect(8, 17, 9, 4).tone(3, 8, 17, 9, 17);
    d.layer(C.skin).rect(8, 13, 9, 5);
    [[16, 6], [13, 5], [10, 5], [7, 6]].forEach(([x, y]) => d.layer(C.skin).rect(x, y + 1, 3, 6).rect(x + 1, y, 1, 1).px(x, y + 1));
    d.layer(C.skin).rect(6, 12, 8, 3).rect(5, 11, 3, 3).px(14, 13);
    d.mark('#e3b394', 8, 6, 11, 5, 14, 5, 17, 6);
  };
  PIX['weapon:glass'] = d => {   // Glass Arm: Kaelen's arm, glassed past the elbow
    d.tilt(11, 13);
    d.layer(C.dleather).rrect(-3.2, 7, 6.4, 6);
    const g = d.layer(C.glass, { shiny: 1 });
    g.rpoly([-2.6, 7.4, -3, 0, -3.6, -5, -2.6, -9.4, 0, -11.6, 2.8, -10, 3.6, -5, 3, 0, 2.6, 7.4]);
    g.rrect(-3.2, -14.6, 1.4, 5).rrect(-1.2, -15.4, 1.4, 5).rrect(0.8, -15, 1.4, 5).rrect(2.6, -13.4, 1.3, 4);
    g.rtone(4, -1.6, -3).rtone(4, -1.6, 2).rtone(1, 1.6, -7).rtone(1, 1.4, 1).rtone(3, 0, 4);
    d.mark('#e9ffff', 14, 6);
  };
  // ---------------------------------------------------------------- armour
  // a garment front: shoulders, sleeves to the elbow or wrist, hem at y = bot
  function garment(L, bot, sleeve) {
    const s = sleeve || 14;
    L.poly([8, 4, 16, 4, 20, 6, 22, s, 19, s + 1, 17, 10, 17.5, bot, 6.5, bot, 7, 10, 5, s + 1, 2, s, 4, 6]);
    return L.cut().poly([10, 3.6, 14, 3.6, 12, 7]).add();
  }
  PIX.a_cap = d => {   // Leather Cap: boiled leather, a seam and a short brim
    const c = d.layer(C.leather).ell(12, 13, 7.5, 7).cut().rect(0, 13, 24, 11).add().rect(5, 12, 14, 3);
    for (let y = 7; y < 13; y++) c.tone(1, 12, y);
    c.tone(3, 9, 8, 10, 7);
    d.layer(C.dleather).rect(4, 15, 16, 2);
    d.mark('#d9b98a', 7, 13, 10, 13, 13, 13, 16, 13);
  };
  PIX.a_hood = d => {   // Hush-Cloth Hood: packed wool, a soft dark opening
    d.layer(C.teal).poly([12, 3, 17, 5, 19.5, 10, 20, 17, 21.5, 21, 2.5, 21, 4, 17, 4.5, 10, 7, 5]);
    d.layer(C.black, { shade: 'flat', sep: false }).ell(12, 13, 4.2, 5.4).rect(8, 13, 8, 5);
    d.layer(C.teal).rect(6, 18, 12, 3).tone(3, 6, 18, 7, 18);
    d.mark('#6e9a90', 9, 6, 8, 7);
  };
  PIX.a_kettle = d => {   // Iron Kettle Helm: a broad brim that rings
    d.layer(C.iron, { shiny: 1 }).ell(12, 13, 6.2, 8).cut().rect(0, 13, 24, 11).add();
    d.layer(C.iron).ell(12, 14.5, 11, 3).cut().ell(12, 13.6, 6, 1.4).add();
    d.layer(C.dsteel).rect(11, 5, 2, 9);
    d.mark('#f2f6f6', 9, 8);
  };
  PIX.a_bellhelm = d => {   // Carillon Bell-Helm: a Legion bell, hollowed, with a gold finial
    d.layer(C.bell, { shiny: 1 }).poly([12, 3, 15.5, 4.5, 17, 9, 18, 16, 20.5, 19, 20.5, 21, 3.5, 21, 3.5, 19, 6, 16, 7, 9, 8.5, 4.5]);
    d.layer(C.black, { shade: 'flat', sep: false }).rect(8, 12, 8, 2).rect(11, 12, 2, 6);
    d.layer(C.gold, { shiny: 1 }).rect(11, 1, 2, 3);
    d.layer(C.bronze).rect(4, 19, 16, 2);
  };
  PIX.a_synodrobe = d => {   // Synod Clerk Robes: grey oilcloth, a silver registry stole
    garment(d.layer(C.grey), 22, 20);
    d.layer(C.silver, { shiny: 1 }).rect(9, 5, 2, 17).rect(13, 5, 2, 17);
    d.layer(C.dsteel).rect(10, 11, 4, 1);
    d.mark('#e8e8e0', 9, 22, 14, 22);
  };
  PIX.a_gambeson = d => {   // Quilted Gambeson: linen and wool in quilted rows
    const g = garment(d.layer(C.cloth), 20, 13);
    for (let y = 8; y < 20; y += 3) for (let x = 7; x < 18; x++) g.tone(1, x, y);
    for (let x = 9; x < 17; x += 3) for (let y = 7; y < 20; y++) if (y % 3) g.tone(2, x, y);
    d.layer(C.linen).rect(11, 6, 2, 14).tone(3, 11, 6);
  };
  PIX.a_jerkin = d => {   // Tanner's Leather Jerkin: oiled leather, laced front
    garment(d.layer(C.leather, { shiny: 1 }), 20, 11);
    d.layer(C.dleather).rect(11, 6, 2, 14);
    d.mark('#e0c08a', 10, 8, 13, 9, 10, 11, 13, 12, 10, 14, 13, 15, 10, 17, 13, 18);
    d.layer(C.dleather).rect(7, 17, 10, 1);
  };
  PIX.a_hushcoat = d => {   // Hush-Cloth Coat: long, the Hedge's own wool
    garment(d.layer(C.teal), 22, 19);
    d.layer('#2e4f48').poly([12, 6, 13, 6, 15, 22, 12, 22]);
    d.layer('#4c7a70').poly([9, 4, 12, 7, 10, 12, 8, 6]).poly([15, 4, 12, 7, 14, 12, 16, 6]);
    d.mark('#c9b07a', 13, 12, 13, 15);
  };
  PIX.a_brig = d => {   // Consortium Brigandine: plates under company canvas, rows of rivets
    garment(d.layer(C.moss), 20, 11);
    d.layer('#4d5a3a').rect(7, 9, 10, 1).rect(7, 13, 10, 1).rect(7, 17, 10, 1);
    for (let y = 8; y < 20; y += 4) for (let x = 8; x < 17; x += 2) d.mark('#e3d6a6', x, y);
    d.layer(C.wax).rect(15, 5, 2, 2);
  };
  PIX.a_chain = d => {   // Synod Chainmail: arsenal mail that shushes as you walk
    const m = garment(d.layer(C.steel, { shiny: 1 }), 21, 15);
    for (let y = 5; y < 22; y++) for (let x = 2; x < 23; x++) if (((x + y) & 1) === 0 && (y & 1)) m.tone(1, x, y);
    m.cut().rect(0, 22, 24, 2).add();
    for (let x = 7; x < 18; x += 2) d.mark('#5d666a', x, 21);
    d.layer(C.leather).rect(7, 14, 10, 2);
  };
  PIX.a_plate = d => {   // Carillon Bell-Plate: a bell-cast cuirass
    d.layer(C.bell, { shiny: 1 }).poly([6, 4, 18, 4, 19, 10, 18, 18, 15, 21, 9, 21, 6, 18, 5, 10]);
    d.layer(C.bronze, { shiny: 1 }).poly([2.5, 5, 8, 3.5, 8, 9, 3, 10]).poly([21.5, 5, 16, 3.5, 16, 9, 21, 10]);
    d.layer(C.bronze).rect(7, 14, 10, 2);
    d.mark('#fff2c8', 9, 7, 9, 8, 10, 7);
    d.mark('#6a4318', 12, 9, 12, 10, 12, 11, 12, 12);
  };
  PIX.a_gloves = d => {   // Leather Gloves: a work pair
    const g = (x, col) => { const L = d.layer(col); L.rect(x, 9, 6, 8).rect(x, 4, 1, 6).rect(x + 2, 3, 1, 6).rect(x + 4, 4, 1, 6).rect(x + 5, 6, 1, 4).rect(x - 1, 10, 1, 4).rect(x, 17, 6, 4); L.tone(1, x + 1, 4, x + 3, 4, x + 1, 5, x + 3, 5); return L; };
    g(4, C.leather); g(13, C.tan);
    d.layer(C.dleather).rect(4, 17, 6, 1).rect(13, 17, 6, 1);
  };
  PIX.a_gauntlets = d => {   // Mail Gauntlets: mail backs on leather palms
    const g = (x) => { const L = d.layer(C.steel); L.rect(x, 9, 6, 7).rect(x, 4, 1, 6).rect(x + 2, 3, 1, 6).rect(x + 4, 4, 1, 6).rect(x + 5, 6, 1, 4).rect(x - 1, 10, 1, 4); for (let y = 9; y < 16; y++) for (let i = x; i < x + 6; i++) if (((i + y) & 1) === 0) L.tone(1, i, y); return L; };
    g(4); g(13);
    d.layer(C.dleather).rect(3, 16, 8, 5).rect(12, 16, 8, 5);
    d.layer(C.iron).rect(3, 16, 8, 1).rect(12, 16, 8, 1);
  };
  const boot = (L, x, top) => L.rect(x, top, 5, 17 - top).rect(x, 15, 9, 4).px(x + 9, 17, x + 9, 18);
  PIX.a_softboots = d => {   // Soft Boots: felt-soled
    boot(d.layer(C.felt), 3, 5); boot(d.layer('#8d8576'), 11, 6);
    d.layer('#4a4540').rect(3, 19, 10, 1).rect(11, 19, 10, 1);
    d.layer('#a39a88').rect(3, 5, 5, 2).rect(11, 6, 5, 2);
  };
  PIX.a_hobnails = d => {   // Hobnail Boots: studded and loud
    boot(d.layer(C.dleather, { shiny: 1 }), 3, 4); boot(d.layer(C.leather, { shiny: 1 }), 11, 5);
    d.layer(C.black).rect(3, 19, 10, 2).rect(11, 19, 10, 2);
    d.mark('#d9dde0', 4, 20, 6, 20, 8, 20, 10, 20, 12, 20, 14, 20, 16, 20, 18, 20);
    d.mark('#d8b07a', 5, 7, 5, 10, 13, 8, 13, 11);
  };
  PIX.a_greaves = d => {   // Iron Greaves: shin-plates over riding boots
    boot(d.layer(C.dleather), 3, 5); boot(d.layer(C.dleather), 11, 6);
    d.layer(C.iron, { shiny: 1 }).rect(3, 4, 5, 10).rect(11, 5, 5, 10);
    d.layer(C.dsteel).rect(3, 9, 5, 1).rect(11, 10, 5, 1);
    d.mark('#e8dcb0', 4, 6, 12, 7);
  };
  PIX.a_buckler = d => {   // Corsair Buckler: fist-sized, iron boss
    d.layer(C.wood).ell(12, 12, 9, 9);
    d.layer(C.iron).ell(12, 12, 9, 9).cut().ell(12, 12, 7.6, 7.6).add();
    d.layer(C.iron, { shiny: 1 }).ell(12, 12, 3.4, 3.4);
    d.mark('#e8dcb0', 12, 4, 19, 12, 12, 19, 4, 12);
  };
  PIX.a_kite = d => {   // Synod Kite Shield: painted with the Synod's dead queen (a crowned head in profile)
    d.layer(C.red).poly([4, 3, 20, 3, 20, 10, 12, 22, 4, 10]);
    d.layer(C.brass).poly([4, 3, 20, 3, 20, 10, 12, 22, 4, 10]).cut().poly([5.4, 4.4, 18.6, 4.4, 18.6, 9.8, 12, 20, 5.4, 9.8]).add();
    d.grid(8, 5, [
      '.y.y.y..',
      '.yyyyy..',
      '.wwww...',
      'wwwwww..',
      '.wwwwww.',
      '.wwwww..',
      '..www...',
      '.wwwww..',
      'wwwwwww.',
    ], { y: d.layer(C.gold, { shiny: 1 }), w: d.layer(C.ivory) });
  };
  // ---------------------------------------------------------------- supplies, food, ammunition
  // a bottle: body ellipse/round or tall, neck, stopper; liquid fills the lower part
  function bottle(d, o) {
    const gl = d.layer(o.glass || '#9fc7c4', { shiny: 1 });
    if (o.round) gl.ell(12, 15, o.r || 6.5, o.r || 6.5).rect(10, 5, 4, 6);
    else gl.rect(7, 9, 10, 12).ell(12, 10, 5, 3).rect(10, 4, 4, 6);
    if (o.liq) {
      const lq = d.layer(o.liq, { shiny: 1, sep: false });
      if (o.round) lq.ell(12, 15, (o.r || 6.5) - 1, (o.r || 6.5) - 1).cut().rect(0, 0, 24, o.level || 13).add();
      else lq.rect(8, o.level || 12, 8, 21 - (o.level || 12));
    }
    if (o.cork !== false) d.layer(o.cork || C.tan).rect(10, 2, 4, 3);
    return gl;
  }
  PIX.tonic = d => {   // Bettany's Tonic: honey, egg and willow-bark in a round bottle, a paper label
    bottle(d, { round: true, liq: C.amber, level: 12 });
    d.layer(C.paper, { shade: 'flat' }).rect(9, 15, 6, 4);
    d.mark('#7a3a20', 10, 16, 11, 16, 13, 16, 10, 17, 12, 17).mark('#ffffff', 8, 11, 8, 12);
  };
  PIX.honey = d => {   // Oiled Honey: a clay pot, a cloth cover, a drip
    d.layer(C.clay).ell(12, 15, 7, 6.5).rect(7, 7, 10, 4);
    d.layer(C.linen).rect(6, 5, 12, 4).px(5, 8, 18, 8);
    d.layer(C.red).rect(6, 9, 12, 1);
    d.layer(C.honey, { shiny: 1, sep: false }).rect(14, 9, 2, 5).px(15, 14).rect(8, 9, 2, 2);
    d.mark('#fff0b0', 14, 10);
  };
  PIX.sovereigns = d => {   // Sovereigns: Synod coin, a dead queen's head
    for (let i = 0; i < 4; i++) d.layer(C.gold).ell(8, 19 - i * 2.2, 5.5, 2.4);
    const f = d.layer(C.gold, { shiny: 1 }).ell(15, 12, 6.2, 6.2);
    f.tone(1, 15, 9, 14, 10, 14, 11, 15, 11, 16, 12, 14, 13, 15, 14, 16, 14);
    d.layer(C.gold).ell(15, 12, 6.2, 6.2).cut().ell(15, 12, 5.2, 5.2).add();
  };
  PIX.pellets = d => {   // Glass Shot: Aether-Glass pellets
    [[8, 8], [15, 7], [18, 13], [11, 13], [6, 17], [14, 18]].forEach(([x, y]) => { d.layer(C.glass, { shiny: 1 }).ell(x, y, 2.9, 2.9); d.mark('#e9ffff', x - 2, y - 2); });
  };
  PIX.bolts = d => {   // Crossbow Bolts: iron heads, grey fletching
    [[8, 14], [12, 12], [16, 10]].forEach(([x, y]) => {
      d.tilt(x, y, 1);
      d.layer(C.ash).rrect(-0.5, -6, 1, 15);
      d.layer(C.linen).rpoly([-0.5, 5, -2.2, 7, -2.2, 9.5, -0.5, 8]).rpoly([0.5, 5, 2.2, 7, 2.2, 9.5, 0.5, 8]);
      d.layer(C.iron, { shiny: 1 }).rpoly([-1.4, -5.4, 0, -9.4, 1.4, -5.4]);
    });
  };
  PIX.tknives = d => {   // Throwing Knives (x5): a bundle fanned and tied with cord
    [-0.5, -0.25, 0, 0.25, 0.5].forEach((a, i) => {
      const L = d.layer(C.steel, { shiny: 1 }), H = d.layer(C.dleather), cx = 12 + a * 14;
      L.poly([12 + a * 3 - 1, 14, cx - 1, 5, cx, 3, cx + 1, 5, 12 + a * 3 + 1, 14]);
      H.rect(Math.round(12 + a * 3 - 1), 14, 2, 6 + (i % 2));
    });
    d.layer(C.red).rect(8, 13, 9, 2);
  };
  PIX.bottle = d => {   // Vox-Bottle: somebody's last words, stoppered; a lilac breath inside
    bottle(d, { glass: '#7a6a9a', cork: C.wax });
    d.layer(C.lilac, { shiny: 1, sep: false }).px(10, 12, 11, 11, 12, 11, 13, 12, 13, 13, 12, 14, 11, 15, 10, 16, 11, 17, 12, 17, 13, 18);
    d.layer(C.wax).rect(9, 5, 6, 2);
    d.mark('#e9ddff', 8, 10, 8, 11);
  };
  PIX.empty_bottle = d => {   // Empty Glass Bottle: clear glass, nothing in it
    bottle(d, { glass: '#b8d0cc', cork: false });
    d.layer('#b8d0cc', { shade: 'flat' }).rect(9, 2, 6, 2);
    d.mark('#ffffff', 8, 10, 8, 11, 8, 12, 15, 17);
  };
  PIX.whistle = d => {   // Hush-Whistle: a reed whistle from a hush-lamp, on a cord
    d.tilt(12, 12, 1);
    d.layer(C.reed).rrect(-1.8, -9, 3.6, 16);
    d.layer(C.dwood).rrect(-2, -9.5, 4, 2);
    const h = d.layer('#2a2a1a', { shade: 'flat', sep: false }); [-4, -1, 2].forEach(y => h.rp && 0); d.rmark('#2a2414', 0, -4); d.rmark('#2a2414', 0, -1); d.rmark('#2a2414', 0, 2);
    const a = d.rp(0, 7), cord = d.layer(C.tan, { shade: 'flat' }); cord.line(a[0], a[1] + 1, a[0] - 3, a[1] + 4).line(a[0] - 3, a[1] + 4, a[0] - 7, a[1] + 3);
  };
  PIX.bandage = d => {   // Clean Linen Bandage: a roll and its tail
    d.layer(C.linen).poly([12, 14, 21, 18, 20, 21, 11, 17]);
    d.layer(C.linen, { shiny: 1 }).ell(10, 11, 7, 7);
    d.layer('#b9ad92').ell(10, 11, 3, 3);
    d.layer('#6a5d48', { shade: 'flat' }).ell(10, 11, 1.4, 1.4);
    d.mark('#b9ad92', 6, 7, 5, 9, 6, 14, 14, 7);
  };
  PIX.whetstone = d => {   // Quarry Whetstone
    d.tilt(12, 12, 1);
    d.layer(C.slate).rrect(-3.6, -8, 7.2, 16);
    d.layer('#8a9096', { sep: false }).rrect(-2.2, -6.6, 2, 13);
    d.rmark('#d0d6d8', -1.6, -5);
  };
  PIX.pebble = d => {   // Skipping Stone: flat, grey, round
    d.layer(C.stone).ell(12, 13, 8.5, 6);
    d.layer('#a29d92', { sep: false }).ell(10, 11, 4, 2.2);
    d.mark('#d6d2c8', 8, 10, 9, 10).mark('#6a655c', 16, 16, 14, 17);
  };
  PIX.shard = d => {   // Light-Glass Shard: raw green-gold, from a root-vein
    d.layer(C.green, { shiny: 1 }).poly([12, 2, 16, 8, 15, 18, 12, 22, 8, 17, 8.5, 8]);
    d.layer('#c8d85a', { sep: false }).poly([12, 3, 12.6, 21, 10, 17, 9.4, 8]);
    d.layer(C.green).poly([16, 12, 20, 15, 18, 20, 15, 19]);
    d.mark('#f8ffd8', 11, 6, 11, 7, 10, 9);
  };
  PIX.flume_eel = d => {   // Smoked Flume-Eel: boiled twice, hung on a cord, golden-brown
    d.layer(C.tan, { shade: 'flat' }).path([7, 6, 6, 2, 11, 2]);
    d.layer('#9a6a36', { shiny: 1 }).thick([7.5, 7, 7, 11, 9, 15, 13, 17.5, 17, 17, 19.5, 14], t => 2.6 - t * 1.5);
    d.layer('#5a3418').poly([18, 15, 21, 11, 22, 14]);
    d.layer('#c88a4a', { shade: 'flat', sep: false }).path([7, 9, 7, 12, 9, 15]).path([11, 16, 14, 16]);
    d.mark('#2a1608', 7, 6);
  };
  PIX.cache = d => {   // A strongbox: iron-banded
    d.layer(C.wood).rect(4, 10, 16, 10);
    d.layer(C.wood, { shiny: 1 }).rect(4, 6, 16, 4).rect(5, 5, 14, 1);
    d.layer(C.iron).rect(4, 9, 16, 2).rect(7, 5, 2, 15).rect(15, 5, 2, 15);
    d.layer(C.brass, { shiny: 1 }).rect(11, 10, 2, 3);
    d.mark('#1a120c', 11, 12);
  };
  PIX.herb_willow = d => {   // Silver Willow-Bark: rolled quills of bark, silver outside, brown within
    [[9, 10], [14, 13]].forEach(([x, y]) => {
      d.tilt(x, y, 1);
      d.layer('#aeb2a6', { shiny: 1 }).rrect(-2.2, -8, 4.4, 15);
      d.layer('#7a5232', { shade: 'flat' }).rell(0, -8, 2.2, 1.2);
      d.layer('#4a2e18', { shade: 'flat', sep: false }).rell(0.4, -8, 1, 0.5);
      d.rmark('#e8ece4', -1, -4); d.rmark('#6a6c62', 1, 2); d.rmark('#6a6c62', 1, -1);
    });
  };
  PIX.herb_reed = d => {   // Sweet Reed-Pith: cut green stalks, white pith
    [[6, 4], [9, 3], [12, 5], [15, 4]].forEach(([x, y]) => { d.layer(C.reed).rect(x, y, 3, 17 - y + 2); d.layer(C.cream, { sep: false }).rect(x + 1, y, 1, 1); });
    d.layer(C.tan).rect(5, 13, 14, 2);
    d.layer('#7a8a3a').path([17, 8, 20, 4, 21, 3]);
  };
  PIX.herb_moss = d => {   // Lilac Moon-Moss: luminous moss from drowned stone
    d.layer(C.stone).ell(12, 17, 8.5, 4);
    const m = d.layer(C.lilac, { shiny: 1 });
    [[8, 12, 3.4], [12, 10, 4], [16, 12, 3.2], [10, 14, 3], [15, 15, 3]].forEach(([x, y, r]) => m.ell(x, y, r, r * 0.85));
    d.mark('#f2e8ff', 11, 8, 7, 11, 15, 10, 9, 13).mark('#7a5aa8', 13, 14, 17, 14);
  };
  PIX.p12_hearth_bread = d => {   // Hearth Bread: a round loaf, scored
    d.layer('#b0742e', { shiny: 1 }).ell(12, 14, 9, 6.5);
    d.layer('#c99a52', { sep: false }).path([7, 11, 9, 13]).path([11, 10, 13, 12]).path([15, 10, 17, 12]);
    d.layer('#7a4a1c').rect(4, 17, 16, 1);
  };
  PIX.p12_cider = d => {   // Last-Apple Cider: a stoppered clay jug
    d.layer(C.clay, { shiny: 1 }).ell(11, 15, 7, 6.5).rect(8, 4, 6, 6);
    d.layer(C.clay).path([14, 7, 18, 7, 19, 9, 18, 13, 17, 14]).path([14, 8, 17, 8]);
    d.layer('#e6d8b0').rect(6, 13, 10, 2);
    d.layer(C.tan).rect(8, 2, 6, 2);
  };
  PIX.p12_moot_curd = d => {   // Moot-Curd: soft salted curd in a dock-leaf
    d.layer('#4f7a34').poly([3, 14, 9, 9, 15, 9, 21, 13, 17, 19, 7, 19]);
    d.layer(C.cream, { shiny: 1 }).ell(12, 13, 5.4, 3.6);
    d.layer('#365a22', { shade: 'flat', sep: false }).path([4, 14, 8, 16, 12, 17, 16, 16, 20, 14]);
    d.mark('#ffffff', 10, 11, 11, 11);
  };
  PIX.p12_flume_eel = d => {   // Run-Eel: green, alive and quiet, coiled
    const e = d.layer(C.eel, { shiny: 1 });
    e.ell(12, 13, 8, 7).cut().ell(12, 13, 5.5, 4.5).add().rect(16, 6, 5, 3).cut().rect(15, 9, 2, 3).add();
    e.ell(10, 14, 3, 2.4);
    d.mark('#e8f0a0', 19, 7).mark('#1a120c', 20, 7).mark('#a8c870', 7, 8, 5, 12);
  };
  PIX.p15_smoked_eel = d => {   // Smoked Run-Eel: split and salted on a skewer, crackling
    d.layer(C.ash).line(2, 20, 21, 3).line(3, 20, 22, 3);
    const e = d.layer('#7a4420', { shiny: 1 });
    e.poly([5, 16, 10, 9, 16, 5, 19, 6, 14, 12, 8, 18]);
    d.layer('#c88a4a', { sep: false }).path([8, 15, 12, 11, 16, 7]);
    d.mark('#e8b070', 10, 12, 14, 9);
  };
  PIX.p15_toasted_round = d => {   // Toasted Round: bread with curd melted into the crumb
    d.layer('#8a5222').ell(12, 14, 9, 6.2);
    d.layer('#d8a860', { sep: false }).ell(12, 13.5, 7.2, 4.6);
    d.layer(C.cream, { shiny: 1, sep: false }).ell(11, 13, 4.4, 2.4).px(15, 14, 15, 15, 8, 15);
    d.mark('#6a3812', 7, 12, 17, 12, 10, 16);
  };
  PIX.p15_soothing_draught = d => {   // Soothing Draught: hot honey and bark in a tin cup
    d.layer(C.iron, { shiny: 1 }).rect(6, 9, 10, 11).ell(11, 20, 5, 1.2);
    d.layer(C.iron).path([16, 11, 19, 11, 19, 16, 16, 16]);
    d.layer(C.honey, { shade: 'flat', sep: false }).rect(7, 9, 8, 2);
    d.layer('#d8d0c4', { shade: 'flat' }).px(9, 6, 10, 5, 10, 4, 13, 7, 12, 6, 12, 5, 13, 3);
  };
  PIX.p12_flask = d => {   // Oil Flask: lamp-oil, a rag wick
    bottle(d, { round: true, r: 6, liq: '#c8a03a', level: 13, cork: '#7a7060' });
    d.layer(C.linen).poly([11, 2, 13, 2, 16, 5, 15, 6, 13, 4]).rect(11, 1, 2, 2);
    d.mark('#ffffff', 8, 13, 8, 14);
  };
  PIX.p12_jar = d => {   // Damper Jar: wool-fat and wax, sealed
    d.layer(C.lead, { shiny: 1 }).rect(6, 8, 12, 13).ell(12, 8, 6, 1.6);
    d.layer('#d8c890').rect(5, 4, 14, 4);
    d.layer(C.tan).rect(5, 7, 14, 1);
    d.layer(C.paper, { shade: 'flat' }).rect(8, 12, 8, 5);
    d.layer('#5a4a3a', { shade: 'flat', sep: false }).rect(9, 13, 6, 1).rect(9, 15, 4, 1);
  };
  PIX.p12_net = d => {   // Weighted Net: reed-cord around clay weights
    const n = d.layer('#c0a66a', { shade: 'flat' });
    for (let i = 0; i < 5; i++) { n.line(4 + i * 3, 4, 4 + i * 3 + 4, 18); n.line(20 - i * 3, 4, 20 - i * 3 - 4, 18); }
    [[4, 19], [10, 20], [15, 20], [20, 19]].forEach(([x, y]) => d.layer(C.clay).ell(x, y, 1.8, 1.8));
  };
  PIX.p13h_beads = d => {   // Linnet's Counting-Beads: eight beads, the eighth worn smooth
    const cord = d.layer(C.tan, { shade: 'flat' }); cord.path([4, 4, 6, 10, 9, 15, 13, 18, 17, 18, 20, 15]);
    [[5, 7], [6, 10], [8, 13], [10, 15], [13, 17], [16, 18], [19, 16]].forEach(([x, y]) => d.layer('#6a3a2a', { shiny: 1 }).ell(x + 0.5, y + 0.5, 1.5, 1.5));
    d.layer(C.bone, { shiny: 1 }).ell(20.5, 13, 1.7, 1.7);
  };
  // ---------------------------------------------------------------- valuables, tools, instruments
  PIX.v_scrap = d => {   // Bell-Bronze Scrap: a broken piece of a Legion bell, lip and all
    d.layer(C.bell, { shiny: 1 }).poly([3, 15, 6, 9, 9, 6, 12, 7, 14, 4, 17, 6, 19, 10, 21, 15, 18, 18, 12, 17, 6, 18]);
    d.layer(C.bronze, { shiny: 1 }).poly([3, 15, 6, 18, 12, 17, 18, 18, 21, 15, 21, 18, 18, 21, 12, 20, 6, 21, 3, 18]);
    d.mark('#fff0c0', 8, 9, 9, 8, 10, 8).mark('#5a3a18', 13, 9, 13, 10, 14, 11);
  };
  PIX.v_mesh = d => {   // Silver Proctor-Mesh: fine silver mesh from a mask
    const m = d.layer(C.silver, { shiny: 1 }).poly([5, 5, 19, 4, 20, 18, 6, 20]);
    for (let y = 5; y < 21; y++) for (let x = 5; x < 21; x++) if (x % 2 === 0 && y % 2 === 0) m.tone(0, x, y);
    d.layer(C.dsteel).path([5, 5, 19, 4]).path([6, 20, 20, 18]);
  };
  PIX.v_gear = d => {   // Brass Governor-Gear: from a Steam Golem's works, still warm
    const g = d.layer(C.brass, { shiny: 1 }).ell(12, 12, 6.6, 6.6);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, x = 12 + Math.cos(a) * 8, y = 12 + Math.sin(a) * 8; g.rect(Math.round(x - 1.5), Math.round(y - 1.5), 3, 3); }
    g.cut().ell(12, 12, 2.2, 2.2).add();
    d.layer(C.copper).ell(12, 12, 3.6, 3.6).cut().ell(12, 12, 2.2, 2.2).add();
    d.mark('#ffd8a0', 21, 3, 22, 4).mark('#ff9a50', 21, 21);
  };
  PIX.v_signet = d => {   // Synod Signet: an officer's ring
    d.layer(C.gold, { shiny: 1 }).ell(12, 14, 7, 6.6).cut().ell(12, 14.4, 4.4, 4).add();
    d.layer(C.gold, { shiny: 1 }).rect(8, 4, 8, 5);
    d.layer(C.crimson, { shiny: 1 }).rect(9, 5, 6, 3);
    d.mark('#ffd0c0', 10, 5).mark('#5a1010', 12, 6, 13, 6);
  };
  PIX.v_fork = d => {   // Silver Tuning Fork: tuned to 528
    d.tilt(12, 12, 1);
    d.layer(C.silver, { shiny: 1 }).rpoly([-3, -11, -1.4, -11, -1.4, -3, 1.4, -3, 1.4, -11, 3, -11, 3, -2, 1, 0, 0.8, 10, -0.8, 10, -1, 0, -3, -2]);
    d.layer(C.silver).rell(0, 10.5, 1.6, 1.6);
    d.mark('#ffffff', 15, 2, 20, 6).mark('#fff6c0', 21, 1);
  };
  PIX.coil = d => {   // Reverse-Phase Coil: brass and copper wound round a Growth crystal
    d.layer(C.green, { shiny: 1 }).poly([12, 2, 15, 6, 15, 18, 12, 22, 9, 18, 9, 6]);
    for (let y = 7; y <= 17; y += 2) d.layer(y % 4 === 3 ? C.copper : C.brass, { shiny: 1 }).rect(6, y, 12, 2);
    d.mark('#f0ffd0', 11, 4, 11, 5);
  };
  PIX.p12_fork = d => {   // Iron Tuning Fork: Bettany's, from a Cantor's widow
    d.tilt(12, 13, 1);
    d.layer(C.dsteel).rpoly([-3.4, -10, -1.6, -10, -1.6, -1, 1.6, -1, 1.6, -10, 3.4, -10, 3.4, 0, 1.2, 2, 1.2, 6, -1.2, 6, -1.2, 2, -3.4, 0]);
    d.layer(C.wood).rrect(-1.6, 6, 3.2, 6);
    d.layer(C.iron).rrect(-1.8, 5.4, 3.6, 1.2);
    d.mark('#cfd6d8', 15, 3);
  };
  PIX.p12_rod = d => {   // Resonance Rod: bell-bronze, ground at the forge to 174
    d.tilt(12, 12, 1);
    const r = d.layer(C.bronze, { shiny: 1 }).rrect(-1.3, -13, 2.6, 25);
    for (let y = -10; y < 10; y += 4) r.rtone(0, 0.6, y);
    d.layer(C.leather).rrect(-1.8, 6, 3.6, 5);
    d.layer(C.bell, { shiny: 1 }).rell(0, -13, 2, 2);
  };
  PIX.p12_lute = d => {   // Lute: Abner Fenning strings these with his own gut
    d.tilt(12, 12, 1);
    d.layer(C.ash, { shiny: 1 }).rell(0, 4, 6, 7);
    d.layer(C.dwood).rrect(-1.3, -12, 2.6, 11);
    d.layer(C.dwood).rpoly([-1.8, -12, 1.8, -12, 1, -15, -1, -15]);
    d.layer(C.dwood, { shade: 'flat' }).rell(0, 2, 1.8, 1.8);
    d.layer(C.cream, { shade: 'flat', sep: false }).rrect(-0.4, -11, 0.8, 18);
    d.layer(C.dwood).rrect(-2.4, 7.4, 4.8, 1.2);
  };
  PIX.p12_flute = d => {   // Alder Flute: bored alder, packed in hush-cloth
    d.tilt(12, 12, 1);
    d.layer(C.pale, { shiny: 1 }).rrect(-1.6, -13, 3.2, 26);
    [-8, -5, -2, 1, 4].forEach(y => d.rmark('#2a1c10', 0, y));
    d.layer(C.teal).rrect(-2.2, 7, 4.4, 4).rrect(-2.2, -13, 4.4, 2);
  };
  PIX.p12_gurdy = d => {   // Hurdy-Gurdy: a wheel-fiddle with a drone that never stops
    d.layer(C.wood, { shiny: 1 }).poly([3, 13, 6, 8, 14, 7, 20, 9, 21, 14, 18, 18, 8, 19]);
    d.layer(C.dwood).rect(7, 11, 12, 3);
    [8, 10, 12, 14, 16].forEach(x => d.layer(C.ivory).rect(x, 11, 1, 2));
    d.layer(C.brass).ell(18, 16, 2.6, 2.6);
    d.layer(C.iron).path([3, 13, 1, 15]).path([1, 15, 2, 18]);
    d.layer(C.dwood).ell(2, 18.5, 1.2, 1.2);
    d.layer(C.cream, { shade: 'flat', sep: false }).line(5, 12, 21, 12);
  };
  PIX.p12_grapnel = d => {   // Office Grapnel: a cutter-man's grapnel gun, OC-742 on the stock
    d.layer(C.dwood).poly([4, 13, 10, 13, 8, 21, 3, 21]);
    d.layer(C.dsteel, { shiny: 1 }).rect(4, 9, 12, 4);
    d.layer(C.iron, { shiny: 1 }).rect(16, 10, 2, 2).path([18, 11, 21, 8]).path([18, 11, 21, 14]).path([18, 11, 22, 11]).px(21, 7, 22, 10, 21, 15);
    d.layer('#c8b07a', { shade: 'flat' }).ell(9, 11, 2.4, 2.4).cut().ell(9, 11, 1, 1).add();
    d.mark('#e8e0c0', 5, 15, 6, 15);
  };
  PIX.p12_sheaf_figure = d => {   // Plaited Sheaf-Figure: the last stand of the north field
    const s = d.layer(C.straw, { shiny: 1 });
    s.ell(12, 6, 2.6, 2.8).rect(10, 9, 4, 7).poly([10, 16, 14, 16, 18, 22, 6, 22]).rect(5, 10, 14, 2);
    for (let y = 10; y < 16; y += 2) s.tone(1, 11, y, 12, y + 1);
    d.layer(C.red).rect(10, 9, 4, 1).rect(10, 15, 4, 1);
    d.layer('#b89a40', { shade: 'flat', sep: false }).px(8, 20, 10, 20, 12, 21, 14, 20, 16, 20);
  };
  // ---------------------------------------------------------------- books, letters, papers
  // a closed book seen a little from the side: cover, page block on the right edge
  function book(d, o) {
    const x = o.x || 5, y = o.y || 3, w = o.w || 13, h = o.h || 18;
    d.layer(C.paper).rect(x + 2, y + 1, w, h - 1);
    const cv = d.layer(o.cov, { shiny: !!o.shiny }).rect(x, y, w, h);
    d.layer(dark(o.cov, 0.3)).rect(x, y, 2, h);
    for (let j = y + 2; j < y + h; j += 2) d.mark('#f2ead2', x + w + 1, j);
    return cv;
  }
  // a folded letter with a wax seal; o.tie draws a string across
  function letter(d, o) {
    const p = d.layer(o.paper || C.paper);
    p.rect(3, 6, 18, 12);
    p.tone(1, ...[].concat(...Array.from({ length: 9 }, (_, i) => [3 + i, 6 + Math.floor(i * 0.66)]), ...Array.from({ length: 9 }, (_, i) => [20 - i, 6 + Math.floor(i * 0.66)])));
    if (o.tie) d.layer(o.tie, { shade: 'flat', sep: false }).rect(o.tieX || 15, 6, 1, 12);
    if (o.seal) d.layer(o.seal, { shiny: 1 }).ell(12, 12.5, 2.3, 2.3);
    if (o.mark) d.mark(...o.mark);
    return p;
  }
  // a rolled scroll/chart: rolls at both ends
  function scroll(d, o) {
    const p = d.layer(o.paper || C.paper).rect(6, 5, 12, 14);
    d.layer(dark(o.paper || C.paper, 0.12), { shiny: 1 }).rect(4, 3, 16, 3).rect(4, 18, 16, 3);
    return p;
  }
  PIX.charts = d => {   // Tobiah's Charts: night-shift charts, a red trace
    scroll(d, {});
    d.layer('#6a8aa0', { shade: 'flat', sep: false }).rect(7, 8, 10, 1).rect(7, 11, 10, 1).rect(7, 14, 10, 1);
    d.mark('#a3261c', 7, 15, 8, 14, 9, 14, 10, 12, 11, 11, 12, 12, 13, 9, 14, 8, 15, 10, 16, 9);
  };
  PIX.pass = d => {   // Consortium Pass: Factor Vosk's seal
    d.layer(C.parch).rect(3, 6, 18, 12);
    d.layer('#6a5a3a', { shade: 'flat', sep: false }).rect(5, 8, 8, 1).rect(5, 10, 6, 1).rect(5, 12, 8, 1);
    d.layer(C.wax, { shiny: 1 }).ell(16.5, 14, 3, 3);
    d.layer(C.red).rect(15, 16, 1, 4).rect(18, 16, 1, 3);
    d.mark('#e8a090', 15, 13);
  };
  PIX.returns = d => {   // Calibration Returns: K. Vance's, initialled at line ninety-four
    d.layer(C.paper).rect(7, 3, 13, 17);
    d.layer(C.linen).rect(4, 5, 13, 17);
    d.layer('#7a7a8a', { shade: 'flat', sep: false }).rect(6, 8, 9, 1).rect(6, 10, 9, 1).rect(6, 12, 9, 1).rect(6, 14, 9, 1).rect(6, 16, 9, 1);
    d.mark('#a3261c', 12, 14, 13, 14, 14, 13);
    d.layer(C.iron, { shiny: 1 }).rect(9, 3, 4, 3);
  };
  PIX.folder = d => {   // The Grey Arbiterium Folder: tied with a ribbon
    d.layer(C.paper).rect(5, 5, 15, 15);
    d.layer('#7c8084').rect(3, 6, 16, 15).rect(3, 4, 7, 2);
    d.layer('#5a2a2a', { shade: 'flat' }).rect(3, 13, 16, 1);
    d.layer('#c8c4b8', { shade: 'flat', sep: false }).rect(6, 9, 8, 2);
    d.mark('#5a2a2a', 19, 13, 20, 14, 20, 15);
  };
  PIX.redcloak = d => {   // The Red Cloak: a child's choir cloak on the eleventh peg
    d.layer(C.wood).rect(9, 2, 6, 2);
    d.layer(C.crimson, { shiny: 1 }).poly([10, 4, 14, 4, 17, 10, 19, 21, 5, 21, 7, 10]);
    d.layer('#6a1218', { shade: 'flat', sep: false }).path([12, 6, 11, 20]).path([15, 9, 16, 20]);
    d.layer(C.cream).rect(10, 4, 4, 2);
  };
  PIX.roundbook = d => {   // Mallow's Round-Book: Office blue, on a broken chain
    book(d, { cov: C.blue, x: 6, y: 4, w: 12, h: 16 });
    d.layer(C.gold).rect(6, 7, 12, 1).rect(6, 16, 12, 1);
    d.layer(C.iron, { shiny: 1 }).path([6, 6, 4, 5, 3, 7, 2, 9]).px(4, 4, 2, 10);
  };
  PIX.thread = d => {   // The Weaver's Last Thread: lilac, wound on a finger-bone
    d.layer(C.bone, { shiny: 1 }).rect(10, 3, 4, 18).rect(9, 3, 6, 2).rect(9, 19, 6, 2);
    const t = d.layer(C.lilac, { shiny: 1 }).rect(8, 7, 8, 10);
    for (let y = 7; y < 17; y += 2) t.tone(1, 9, y, 11, y, 13, y, 15, y);
    d.layer(C.lilac, { shade: 'flat' }).path([16, 16, 19, 18, 21, 17]);
  };
  PIX.adaletter = d => {   // Bryony Wick's Letter: to the Precentor of the Cloister
    letter(d, { paper: C.paper, seal: '#3e5f92', tie: '#a07a50' });
  };
  PIX.liftsilk = d => {   // Lift-Silk: a bolt of weaverling silk, light as breath
    d.layer('#d8d4e0', { shiny: 1 }).rect(4, 6, 16, 11);
    d.layer('#d8d4e0', { shiny: 1 }).ell(19, 11.5, 2.4, 5.5);
    d.layer('#b8b0c8', { shade: 'flat' }).ell(19, 11.5, 1, 2.6);
    d.layer('#e8e6f0').poly([4, 16, 9, 16, 13, 21, 7, 21]);
    d.mark('#ffffff', 6, 8, 7, 8, 8, 8);
  };
  PIX.valve = d => {   // Brass Relief Valve: OK-CATALOGUE, off the cutter's lift-tank
    d.layer(C.brass, { shiny: 1 }).rect(5, 13, 14, 5).rect(10, 9, 4, 4);
    d.layer(C.dsteel).rect(3, 14, 2, 3).rect(19, 14, 2, 3);
    const w = d.layer(C.red).ell(12, 6, 6, 2.4).cut().ell(12, 6, 3.8, 1).add();
    d.layer(C.red).rect(11, 4, 2, 5).rect(7, 5, 10, 1);
    d.mark('#fff2c0', 7, 14, 8, 14);
    void w;
  };
  PIX.holdkey = d => {   // The Cutter's Hold Key: iron, on a bosun's lanyard
    d.layer(C.tan, { shade: 'flat' }).path([3, 3, 6, 8, 8, 10]);
    d.layer(C.iron, { shiny: 1 }).ell(10, 12, 4, 4).cut().ell(10, 12, 1.8, 1.8).add().line(13, 15, 20, 22).line(14, 15, 21, 22).rect(17, 19, 2, 2).rect(19, 17, 2, 2);
  };
  PIX.register = d => {   // The Mausoleum Register: a clasp and a red ribbon
    book(d, { cov: '#4a2f3a', x: 5, y: 3, w: 13, h: 18 });
    d.layer(C.brass, { shiny: 1 }).rect(16, 10, 4, 3);
    d.layer(C.red, { shade: 'flat' }).rect(10, 21, 2, 2);
    d.layer('#6a4a52', { shade: 'flat', sep: false }).rect(8, 6, 7, 1).rect(8, 17, 7, 1);
  };
  PIX.cutterlog = d => {   // The Cutter's Log: OC-742, in an Office hand
    book(d, { cov: '#4f5b3c', x: 5, y: 3, w: 13, h: 18 });
    d.layer('#c9b987', { shade: 'flat', sep: false }).rect(8, 7, 7, 4);
    d.mark('#2a2a22', 9, 8, 10, 8, 12, 8, 13, 9, 9, 9, 10, 10, 12, 10);
    d.layer(C.iron).rect(5, 15, 13, 1);
  };
  PIX.unrungbell = d => {   // The Unrung Bell: a Quiet Faith handbell, no clapper
    d.layer(C.dwood, { shiny: 1 }).rect(11, 2, 2, 6).ell(12, 2, 1.8, 1.4);
    d.layer('#8a6a3a', { shiny: 1 }).poly([12, 7, 15, 8, 16, 13, 18, 18, 19, 20, 5, 20, 6, 18, 8, 13, 9, 8]);
    d.layer(C.black, { shade: 'flat', sep: false }).ell(12, 20.5, 5.5, 1.3);
    d.layer('#6a5030').rect(6, 17, 12, 1);
  };
  PIX.hornwax = d => {   // The Horn's Wax Cylinder: everything the horn heard
    d.layer('#a8743a', { shiny: 1 }).rect(5, 6, 14, 12).ell(12, 6, 7, 2).ell(12, 18, 7, 2);
    for (let x = 6; x < 19; x += 2) d.layer('#7a4e22', { shade: 'flat', sep: false }).rect(x, 7, 1, 11);
    d.layer('#d8a860', { shade: 'flat' }).ell(12, 5.5, 5.5, 1.3);
    d.layer(C.dsteel).ell(12, 5.5, 1.4, 0.9);
  };
  PIX.dispatch = d => {   // The Arbiter's Dispatch: a black seal, signed A.V.
    letter(d, { paper: '#d6d0c0', seal: C.black, tie: '#3a3a3a', tieX: 7 });
    d.mark('#8a8a8a', 11, 11);
  };
  PIX.tobin_page = d => {   // A page in a Cantor's hand
    d.layer(C.paper).poly([5, 3, 18, 3, 19, 20, 6, 21]);
    const ink = d.layer('#4a3a2a', { shade: 'flat', sep: false });
    for (let y = 6; y < 19; y += 2) ink.rect(7, y, 10 - (y % 4 === 0 ? 2 : 0), 1);
    d.mark('#bfa878', 17, 3, 18, 4, 18, 3);
  };
  PIX.tobin_journal = d => {   // Tobin's Journal: twelve pages tied with a strip of sleeve
    d.layer(C.parch).rect(6, 3, 14, 18);
    d.layer(C.paper).rect(4, 4, 14, 18);
    const ink = d.layer('#4a3a2a', { shade: 'flat', sep: false }); for (let y = 6; y < 20; y += 2) ink.rect(6, y, 7, 1);
    d.layer('#5a6a7a').rect(3, 11, 17, 3);
    d.layer('#5a6a7a').rect(14, 13, 2, 4);
  };
  PIX.p9_greenroot_register = d => {   // The Greenroot Register: slim, strapped shut
    book(d, { cov: '#3e5a32', x: 6, y: 3, w: 11, h: 18 });
    d.layer(C.leather).rect(4, 11, 16, 2);
    d.layer(C.brass).rect(16, 10, 2, 4);
  };
  PIX.p9_verrow_reedcase = d => {   // Verrow's Tuning-Reed Case: flat leather, spare reeds
    [7, 10, 13, 16].forEach((x, i) => d.layer(i % 2 ? C.reed : '#b8b070').rect(x, 3 + (i % 2), 2, 10));
    d.layer(C.leather, { shiny: 1 }).rect(4, 10, 16, 11);
    d.layer(C.dleather).rect(4, 10, 16, 2);
    d.layer(C.brass).rect(11, 15, 2, 2);
  };
  PIX.p16d_register = d => {   // The Relief Register: swollen with water, pencil inside
    const b = book(d, { cov: '#6a6a5a', x: 5, y: 3, w: 13, h: 18 });
    b.toneRect(1, 9, 13, 6, 6).tone(1, 8, 15, 15, 19, 7, 17);
    d.layer('#8a8a70', { shade: 'flat', sep: false }).px(8, 6, 9, 6, 10, 7, 11, 6, 12, 6);
  };
  PIX.p16h_roster = d => {   // Depot Three roster ledger: tall, grey cloth
    book(d, { cov: '#5a5e66', x: 6, y: 2, w: 11, h: 20 });
    d.layer(C.gold).rect(6, 5, 11, 1).rect(6, 18, 11, 1);
    d.layer('#d8d4c8', { shade: 'flat', sep: false }).rect(9, 9, 6, 3);
  };
  PIX.p16h_lease = d => {   // Quarry lease, copy: the Consortium's clerk's hand
    scroll(d, { paper: '#e0d2a4' });
    const ink = d.layer('#6a2a1c', { shade: 'flat', sep: false }); for (let y = 8; y < 16; y += 2) ink.rect(7, y, 10, 1);
    d.layer(C.wax, { shiny: 1 }).ell(15, 16, 2, 2);
  };
  // the six letters held at the Chapel: same fold, each its own seal and tie
  PIX.p16h_letter_lyra = d => letter(d, { seal: '#5a9a3a', tie: '#8a6a3a' });
  PIX.p16h_letter_kaelen = d => letter(d, { paper: '#d6cfb8', seal: '#3a6a8a', tie: '#3a3a3a', tieX: 7 });
  PIX.p16h_letter_hetty = d => letter(d, { paper: '#e4d2a0', seal: C.wax, mark: ['#8a5a3a', 5, 8, 6, 9, 18, 8] });
  PIX.p16h_letter_orla = d => letter(d, { seal: '#7a5a2a', tie: '#c0a070', tieX: 9 });
  PIX.p16h_letter_pim = d => letter(d, { paper: '#ddd6c4', seal: '#8a8a8a', tie: '#b8b4a8', tieX: 16 });
  PIX.p16h_letter_dessa = d => letter(d, { paper: '#e6dcc0', seal: '#6a3a8a', tie: '#3e5f92', tieX: 6 });
  // letters of credit: one, two or three seals and a gilt edge for the largest
  PIX.p15_letter_25 = d => { d.layer('#e5d7ae').rect(3, 5, 18, 14); d.layer('#355a8a', { shade: 'flat', sep: false }).rect(5, 7, 10, 1).rect(5, 9, 8, 1); d.layer('#355a8a', { shiny: 1 }).ell(17, 15, 2.2, 2.2); };
  PIX.p15_letter_100 = d => { d.layer('#e5d7ae').rect(3, 5, 18, 14); d.layer('#3f6a3a', { shade: 'flat', sep: false }).rect(5, 7, 10, 1).rect(5, 9, 8, 1).rect(5, 11, 9, 1); [13, 18].forEach(x => d.layer('#3f6a3a', { shiny: 1 }).ell(x, 15, 2.2, 2.2)); };
  PIX.p15_letter_500 = d => { d.layer(C.gold, { shiny: 1 }).rect(2, 4, 20, 16); d.layer('#ecdcae').rect(3, 5, 18, 14); d.layer('#8a2d22', { shade: 'flat', sep: false }).rect(5, 7, 12, 1).rect(5, 9, 10, 1).rect(5, 11, 11, 1); [9, 13.5, 18].forEach(x => d.layer(C.wax, { shiny: 1 }).ell(x, 15.5, 2.2, 2.2)); };
  PIX.p17p_slate = d => {   // The slate: on a cord, a stub of chalk
    d.layer(C.tan, { shade: 'flat' }).path([7, 6, 12, 2, 17, 6]);
    d.layer(C.wood).rect(4, 6, 16, 14);
    d.layer(C.slate).rect(5, 7, 14, 12);
    d.layer('#e8e4d8', { shade: 'flat', sep: false }).rect(7, 10, 3, 1).rect(7, 10, 1, 4).rect(11, 10, 3, 1).rect(12, 10, 1, 4);
    d.layer(C.cream, { shiny: 1 }).rect(16, 18, 4, 2);
  };
  PIX.p17p_stone = d => {   // A flat stone, from under the snow
    d.layer('#6e6a64').ell(12, 14, 8, 5.5);
    d.layer('#eef2f6', { sep: false }).ell(10, 11, 4.4, 1.8);
    d.mark('#ffffff', 8, 10, 9, 10).mark('#4a4640', 16, 17, 18, 15);
  };
  PIX.p17c_receipt = d => {   // The Harbour's Receipt: tarred paper, a chalk stamp
    d.layer('#4a3e30').poly([4, 6, 20, 5, 19, 18, 5, 19]);
    d.layer('#e8e4d8', { shade: 'flat', sep: false }).ell(14, 12, 3.4, 3.4).cut().ell(14, 12, 2.2, 2.2).add();
    d.layer('#c8b890', { shade: 'flat', sep: false }).path([6, 9, 10, 8]).path([6, 12, 9, 15]);
  };
  PIX.p17c_valve = d => {   // A Gauge-Valve: Fortis brass, in a twist of oiled cloth
    d.layer('#8a8058').poly([2, 18, 8, 13, 16, 14, 22, 19, 18, 22, 6, 22]);
    d.layer(C.brass, { shiny: 1 }).ell(12, 10, 6, 6).rect(10, 15, 4, 4);
    d.layer(C.cream).ell(12, 10, 4, 4);
    d.mark('#1a120c', 12, 10, 13, 9, 14, 8).mark('#a3261c', 12, 7);
  };
  PIX.p17c_bottle = d => {   // Marrin Tace's Bottle: blue glass, wax-sealed, a chalk four
    bottle(d, { glass: '#3a5aa8', cork: C.wax });
    d.layer(C.wax).rect(9, 4, 6, 2);
    d.layer('#e8e4d8', { shade: 'flat', sep: false }).rect(10, 13, 1, 3).rect(10, 15, 4, 1).rect(13, 13, 1, 5);
    d.mark('#b8d0ff', 8, 10, 8, 11);
  };
  PIX.p17c_gravebell = d => {   // A Small Bell: bronze, on an iron hook
    d.layer(C.iron).path([12, 2, 15, 2, 15, 5, 12, 5, 12, 8]);
    d.layer(C.bronze, { shiny: 1 }).poly([12, 8, 15, 10, 16, 15, 18, 18, 6, 18, 8, 15, 9, 10]);
    d.layer(C.dsteel).ell(12, 19, 1.4, 1.4);
  };
  PIX.p17c_whistle = d => {   // Jory's Pilot's Whistle: tin, worn bright at the mouth
    d.tilt(12, 12, 1);
    d.layer('#a8aeb0', { shiny: 1 }).rrect(-1.6, -10, 3.2, 18);
    d.layer('#e0e6e8', { shiny: 1 }).rrect(-1.6, -10, 3.2, 3);
    [-4, -1, 2, 5].forEach(y => d.rmark('#2a2a2a', 0, y));
    const a = d.rp(0, 8); d.layer(C.red, { shade: 'flat' }).line(a[0], a[1], a[0] - 4, a[1] + 1).line(a[0] - 4, a[1] + 1, a[0] - 6, a[1] - 3);
  };
  // ---------------------------------------------------------------- quest things, reeds, trophies
  PIX.boots = d => {   // Davin's Boots: a boy's boots, worn at the toe
    const b = (x, top, col) => d.layer(col).rect(x, top, 4, 17 - top).rect(x, 14, 7, 4).px(x + 7, 16, x + 7, 17);
    b(4, 7, '#6a4a30'); b(12, 8, '#7a5636');
    d.layer(C.black).rect(4, 18, 8, 1).rect(12, 18, 8, 1);
    d.mark('#c8a070', 5, 9, 13, 10).mark('#d8c8a0', 10, 15, 18, 15);
  };
  PIX.core = d => {   // Cracked Lilac Core: a Legionnaire's glass core
    d.layer(C.lilac, { shiny: 1 }).ell(12, 12, 8, 8);
    d.layer('#5a3a8a', { shade: 'flat', sep: false }).path([9, 4, 11, 8, 10, 11, 13, 14, 12, 17, 14, 20]).path([11, 8, 15, 9]);
    d.mark('#ffffff', 8, 7, 9, 7, 8, 8).mark('#f0e4ff', 15, 15);
  };
  PIX.oil = d => {   // Flask of Lamp-Oil: colza oil from the Cloister vestry
    d.layer(C.copper, { shiny: 1 }).poly([7, 10, 17, 10, 19, 20, 5, 20]).rect(10, 6, 4, 4);
    d.layer(C.copper).path([17, 12, 20, 12, 20, 17, 18, 17]);
    d.layer(C.copper).path([14, 7, 19, 4]);
    d.layer('#d8b040', { shade: 'flat' }).px(20, 3);
    d.layer(C.dwood).rect(9, 5, 6, 2);
    d.mark('#ffd8b0', 8, 12, 8, 13);
  };
  PIX.press741 = d => {   // Office Hand-Press, 741: iron and brass, a dial that reads in Hertz
    d.layer(C.dsteel, { shiny: 1 }).rect(4, 15, 16, 5).rect(6, 5, 3, 10).rect(15, 5, 3, 10).rect(6, 4, 12, 3);
    d.layer(C.felt).rect(8, 13, 8, 2);
    d.layer(C.brass, { shiny: 1 }).ell(12, 9, 3.4, 3.4);
    d.layer(C.cream).ell(12, 9, 2.2, 2.2);
    d.mark('#a3261c', 13, 8).mark('#1a120c', 12, 9);
    d.layer(C.brass).rect(17, 2, 2, 4).rect(19, 2, 3, 1);
  };
  PIX.p16_lock_key = d => {   // The Lock-Wheel Key: heavy brass, still warm
    d.tilt(12, 12, 1);
    d.layer(C.brass, { shiny: 1 }).rell(0, -7, 4.6, 4.6).rrect(-1.2, -3, 2.4, 14).rrect(1.2, 6, 3.4, 2).rrect(1.2, 9, 2.6, 2);
    d.layer(C.brass).rell(0, -7, 2, 2).cut().rell(0, -7, 1.6, 1.6).add();
    d.rmark('#fff4c8', -2, -9);
  };
  // reeds: a cane with a node or two and a slot; each kind its own colour and binding
  function reed(d, o) {
    d.tilt(12, 12, 1);
    const r = d.layer(o.col, { shiny: 1 }).rrect(-1.4, -o.len / 2, 2.8, o.len);
    (o.nodes || []).forEach(y => r.rtone(1, 0, y).rtone(1, 1, y));
    if (o.slot) d.layer('#2a2010', { shade: 'flat', sep: false }).rrect(-0.3, -o.len / 2 + 1, 0.6, 4);
    if (o.bind) d.layer(o.bind).rrect(-1.8, o.bindY || 2, 3.6, 1.6);
    return r;
  }
  PIX.p9_windreed = d => {   // Wind-Reed: cut green, holds any pitch, dead tomorrow
    reed(d, { col: '#6aa040', len: 22, nodes: [-3, 5] });
    d.layer('#4f8a2e').rpoly([1, -2, 6, -6, 7, -5, 1.4, 0]);
  };
  PIX.p9_dryreed = d => {   // Dry Reed: pale, brittle, worthless
    reed(d, { col: '#cfc29a', len: 20, nodes: [-2, 6] });
    d.rmark('#8a7a5a', 0.5, -9).rmark('#8a7a5a', 0.5, 9);
  };
  PIX.p9_reed_root = d => {   // Root-Note Reed: tuned to 174, bound in green
    reed(d, { col: '#b8a050', len: 16, nodes: [0], slot: true, bind: '#4f7a34', bindY: 3 });
    d.rmark('#c8e870', 0, 6);
  };
  PIX.p9_reed_lure = d => {   // Lure Reed: thin and high, one long note
    d.tilt(12, 12, 1);
    d.layer('#c0b060', { shiny: 1 }).rrect(-0.8, -12, 1.8, 24);
    d.layer(C.red).rrect(-1.4, 4, 2.8, 1.4).rrect(-1.4, 7, 2.8, 1.4);
    d.layer('#2a2010', { shade: 'flat', sep: false }).rrect(-0.2, -11, 0.5, 3);
  };
  PIX.p9_reed_first = d => {   // Blank First Reed: cut and slotted, not yet tuned, a hanging loop
    reed(d, { col: '#bba872', len: 16, nodes: [2], slot: true });
    const a = d.rp(0, -8); d.layer(C.tan, { shade: 'flat' }).path([a[0], a[1], a[0] + 1, a[1] - 3, a[0] + 3, a[1] - 3, a[0] + 3, a[1] - 1]);
  };
  PIX.p9_split_reed = d => {   // Split First Reed: split down the slot by the frost
    d.tilt(12, 12, 1);
    d.layer('#bba872', { shiny: 1 }).rrect(-2.6, -8, 2.2, 16);
    d.layer('#a8955e', { shiny: 1 }).rpoly([0.6, -8, 2.8, -8, 2.8, 8, 1, 8, 1.6, 0]);
    d.layer('#e8eef4', { shade: 'flat' }).rrect(-1, -10, 1.4, 1.2);
    d.rmark('#2a2010', -0.2, -4);
  };
  PIX.p9_wool = d => {   // Bundle of Carded Wool: grey fleece
    const w = d.layer(C.wool, { shiny: 1 });
    [[8, 10, 5], [14, 9, 5.5], [11, 14, 6], [17, 14, 4], [6, 15, 3.6]].forEach(([x, y, r]) => w.ell(x, y, r, r * 0.8));
    d.mark('#d8d6d0', 7, 7, 13, 6, 14, 6, 9, 11).mark('#6a6862', 12, 17, 16, 16);
    d.layer(C.tan, { shade: 'flat' }).rect(4, 13, 16, 1);
  };
  PIX.p9_bough = d => {   // Iron-bough Log: heavy as a bell
    d.tilt(12, 12, 1);
    d.layer('#5a4e48', { shiny: 1 }).rrect(-4.4, -9, 8.8, 18);
    d.layer('#8a7a6a').rell(0, -9, 4.4, 1.6);
    d.layer('#6a5a4e', { shade: 'flat' }).rell(0, -9, 2.2, 0.8);
    [-4, 0, 4].forEach(y => d.rmark('#9aa2a8', -2.6, y));
  };
  PIX.p15_t_wearer = d => {   // The Borrowed Collar: knotted cord, only cord now
    const c = d.layer('#8a7a5a', { shiny: 1 }).ell(12, 12, 8, 7).cut().ell(12, 12, 5.6, 4.8).add();
    [[6, 8], [12, 5], [18, 8], [19, 14], [12, 19], [5, 14]].forEach(([x, y]) => d.layer('#6a5a3e', { shiny: 1 }).ell(x + 0.5, y + 0.5, 1.6, 1.6));
    void c;
  };
  PIX.p15_t_coda = d => {   // The Split Funeral-Reed: black, split, the right nothing
    d.tilt(12, 12, 1);
    d.layer('#3a3430', { shiny: 1 }).rrect(-2.8, -11, 2.4, 22);
    d.layer('#4a4440', { shiny: 1 }).rpoly([0.4, -11, 2.8, -11, 2.8, 11, 0.6, 11, 1.4, -1]);
    d.layer(C.linen).rrect(-3.2, 4, 6.4, 1.4);
  };
  PIX.p15_t_requiem = d => {   // The Requiem's Chord-Plate: a chord with one voice too many
    d.layer(C.bronze, { shiny: 1 }).rect(3, 5, 18, 14);
    const l = d.layer('#6a4418', { shade: 'flat', sep: false }); for (let y = 8; y <= 16; y += 2) l.rect(5, y, 14, 1);
    d.mark('#3a2408', 9, 9, 9, 11, 9, 13, 9, 15, 10, 9, 10, 11, 10, 13, 10, 15).mark('#fff0c0', 15, 12, 4, 6);
  };
  PIX.p15_t_aegis = d => {   // The Aegis's Cheek-Plate: brass, a chalk hymn-number
    d.layer(C.brass, { shiny: 1 }).poly([6, 3, 17, 4, 19, 12, 15, 20, 8, 21, 5, 14]);
    d.layer('#e8e4d8', { shade: 'flat', sep: false }).px(9, 9, 10, 9, 11, 9, 11, 10, 10, 11, 10, 12, 13, 9, 14, 9, 13, 10, 14, 11, 14, 12, 13, 12);
    d.mark('#7a5a18', 6, 17, 7, 18, 16, 16).mark('#1a120c', 9, 15, 10, 15);
  };
  PIX.p15_t_hymn = d => {   // The Hymn-Nine Slate: chalked HYMN 9
    d.layer(C.wood).rect(3, 4, 18, 16);
    d.layer(C.slate).rect(4, 5, 16, 14);
    d.layer('#e8e4d8', { shade: 'flat', sep: false }).rect(10, 7, 4, 1).rect(10, 7, 1, 4).rect(13, 7, 1, 9).rect(10, 10, 4, 1).rect(10, 15, 4, 1);
  };
  PIX.p15_t_weaver = d => {   // The Weaver's Shuttle: pale wood, shroud-thread in no colour
    d.tilt(12, 12, 1);
    d.layer(C.pale, { shiny: 1 }).rpoly([0, -12, 2.6, -6, 2.6, 6, 0, 12, -2.6, 6, -2.6, -6]);
    d.layer('#c8c4bc', { shade: 'flat', sep: false }).rrect(-1.4, -4, 2.8, 8);
    for (let y = -3; y < 4; y += 2) d.rmark('#9a968e', 0, y);
  };
  PIX.p15_t_mallow = d => {   // The Pressman's Plate: a brass numbering-plate, worn smooth
    d.layer(C.brass, { shiny: 1 }).rect(3, 7, 18, 10);
    d.layer('#8a6a20', { shade: 'flat', sep: false }).rect(5, 9, 3, 6).rect(10, 9, 3, 6).rect(15, 9, 3, 6);
    d.layer(C.brass).rect(6, 10, 1, 4).rect(11, 10, 1, 4).rect(16, 10, 1, 4);
    d.mark('#1a120c', 4, 8, 19, 8, 4, 15, 19, 15);
  };
  PIX.p15_t_brood = d => {   // The Weaverling Spindle: lift-silk, light as breath
    d.layer(C.ash).rect(11, 2, 2, 20);
    d.layer('#e0dcea', { shiny: 1 }).ell(12, 12, 5.6, 7);
    d.layer(C.ash, { shiny: 1 }).ell(12, 19.5, 3.4, 1.4);
    d.mark('#ffffff', 9, 8, 9, 9, 10, 7).mark('#b8b0c8', 15, 14, 14, 16);
  };
  PIX.p15_t_bosun = d => {   // Teller's Lanyard: a brass tag, TELLER, HOLD, and 432 scratched on the back
    d.layer(C.leather, { shade: 'flat' }).path([5, 3, 4, 8, 6, 12, 10, 14]).path([18, 3, 19, 8, 15, 13, 12, 14]);
    d.layer(C.brass, { shiny: 1 }).rect(8, 14, 8, 7).px(11, 13, 12, 13);
    d.mark('#6a4a10', 10, 16, 11, 16, 13, 16, 10, 18, 12, 18, 14, 18);
  };
  PIX.p15_t_horn = d => {   // The Horn-Lens: thick glass in a brass rim
    d.layer(C.brass, { shiny: 1 }).ell(12, 12, 8.6, 8.6);
    d.layer('#9ad8e0', { shiny: 1 }).ell(12, 12, 6.6, 6.6);
    d.mark('#ffffff', 8, 8, 9, 8, 8, 9, 10, 7).mark('#5aa0aa', 15, 15, 16, 14);
  };
  PIX.p15_t_deacon = d => {   // The Felted Clapper: wrapped in grey felt, unwrapped a little
    d.layer(C.iron).rect(11, 2, 2, 8).ell(12, 2.5, 2, 1.5);
    d.layer(C.felt, { shiny: 1 }).ell(12, 15, 5.4, 6.6);
    d.layer(C.dsteel, { shiny: 1 }).ell(14, 18, 2.6, 2.6);
    d.layer('#8a847c', { shade: 'flat', sep: false }).path([7, 13, 16, 10]).path([7, 16, 12, 14]);
  };
  PIX.p15_t_captain = d => {   // The Captain's Gorget: dented steel, a rank stamp
    d.layer(C.steel, { shiny: 1 }).ell(12, 8, 10, 11).cut().ell(12, 5, 6.4, 7.6).rect(0, 0, 24, 3).add();
    d.layer(C.brass, { shiny: 1 }).ell(12, 15.5, 2, 2);
    d.mark('#6c7478', 6, 14, 7, 15).mark('#ffffff', 5, 10, 5, 11);
  };
  // PIX-END

  const PLATE = { weapon: ['#3a3027', '#17110c'], armor: ['#32363a', '#121416'], item: ['#3a2d32', '#150f12'], key: ['#3d3624', '#16130a'], valuable: ['#2c3a3a', '#0e1414'] };
  const cache = new Map();
  function makeCanvas() {
    if (typeof document === 'undefined' || !document.createElement) return null;
    const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    return cv.getContext && cv.getContext('2d') ? cv : null;
  }
  function paintIcon(key, pl, tone, upright) {
    const cv = makeCanvas(); if (!cv) return null;
    const c = cv.getContext('2d');
    R = seeded(hash(key));
    const t = PLATE[tone] || PLATE.item;
    const bg = c.createRadialGradient(18, 14, 2, 24, 24, 34); bg.addColorStop(0, t[0]); bg.addColorStop(1, t[1]);
    if (!upright) { c.fillStyle = bg; if (c.roundRect) { c.beginPath(); c.roundRect(1, 1, S - 2, S - 2, 6); c.fill(); } else c.fillRect(1, 1, S - 2, S - 2); c.strokeStyle = 'rgba(190,160,100,.35)'; c.lineWidth = 1; c.stroke(); }
    c.save(); if (upright) { /* doll layers sit on the figure, so no plate */ }
    c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = 2; c.shadowOffsetY = 1;
    KIND[pl[0]](c, upright ? Object.assign({ upright: true }, pl[1]) : pl[1]);
    c.restore();
    return cv;
  }
  function toneOf(id, isWeapon) {
    if (isWeapon) return 'weapon';
    const it = typeof ITEMS !== 'undefined' && has(ITEMS, id) ? ITEMS[id] : null;
    if (!it) return 'item';
    return it.weapon ? 'weapon' : it.armor ? 'armor' : it.valuable ? 'valuable' : it.key ? 'key' : 'item';
  }
  function memo(key, make) {
    if (cache.has(key)) return cache.get(key);
    let url = null;
    try { const cv = make(); url = cv ? cv.toDataURL('image/png') : null; } catch (e) { console.warn('icon failed', key, e); }
    cache.set(key, url); return url;
  }
  // Data URL for an item id, or null when the id is not a catalog id.
  // Phase 20: the hand-built pixel drawing for a (validated) id, or null for ids added later without one
  let pixelOn = true;
  function pixFor(id) {
    if (has(PIX, id)) return PIX[id];
    const it = catalogHas('item', id) ? ITEMS[id] : null;
    if (it && it.weapon && has(PIX, 'weapon:' + it.weapon)) return PIX['weapon:' + it.weapon];
    return null;
  }
  function url(id) {
    if (typeof id !== 'string') return null;
    const pl = plan(id); if (!pl) return null;
    const px = pixelOn && pixFor(id);
    if (px) return memo('p:' + id, () => pxCanvas(px, toneOf(id, false)));
    return memo('i:' + id, () => paintIcon('i:' + id, pl, toneOf(id, false), false));
  }
  function weaponUrl(wid) {
    if (typeof wid !== 'string') return null;
    const pl = weaponPlan(wid); if (!pl) return null;
    const px = pixelOn && has(PIX, 'weapon:' + wid) && PIX['weapon:' + wid];
    if (px) return memo('p:weapon:' + wid, () => pxCanvas(px, 'weapon'));
    return memo('w:' + wid, () => paintIcon('w:' + wid, pl, 'weapon', false));
  }
  // Upright, plate-less art for the paper doll (weapon in hand, shield on arm).
  function layerUrl(key, pl) { return memo('l:' + key, () => paintIcon('l:' + key, pl, 'weapon', true)); }
  function weaponLayerUrl(wid) { const pl = weaponPlan(wid); return pl ? layerUrl('w:' + wid, pl) : null; }
  function itemLayerUrl(id) { const pl = plan(id); return pl ? layerUrl('i:' + id, pl) : null; }

  // every id that should have an icon: items, weapons, armour
  function allIds() {
    const out = { items: [], weapons: [], armor: [] };
    try {
      for (const id in ITEMS) if (has(ITEMS, id)) out.items.push(id);
      for (const id in WEAPONS) if (has(WEAPONS, id)) out.weapons.push(id);
      for (const id in ARMOR) if (has(ARMOR, id)) out.armor.push(id);
    } catch (e) { /* ignore */ }
    return out;
  }

  // ---------------------------------------------------------------- DOM insertion
  const on = () => typeof GFX !== 'undefined' && GFX.itemIcons !== false;
  function img(src, cls) {
    const im = document.createElement('img');
    im.className = 'ico' + (cls ? ' ' + cls : ''); im.alt = ''; im.src = src; im.width = 24; im.height = 24;
    im.setAttribute('draggable', 'false');
    return im;
  }
  function put(host, src) {
    if (!host || !src || host.querySelector(':scope > img.ico')) return;
    host.insertBefore(img(src), host.firstChild);
  }
  const panel = () => document.querySelector('#modal-panel');
  function armorId(a) { if (!a) return null; for (const k in ARMOR) if (has(ARMOR, k) && ARMOR[k] === a) return k; return null; }

  function decorateInventory() {
    const pn = panel(); if (!pn) return;
    const p = G.player;
    pn.querySelectorAll('.carry tr').forEach((tr, i) => { const sl = p.inv[i]; if (sl) put(tr.querySelector('.nm'), url(sl.id)); });
    pn.querySelectorAll('.slots .slot').forEach((el, i) => {
      const slot = ARMOR_SLOTS[i]; if (!slot) return;
      const id = armorId(worn(slot[0])); if (id) put(el.querySelector('.nm b'), url(id));
    });
    pn.querySelectorAll('.weps .weprow').forEach((el, i) => { const w = p.weapons[i]; if (w) put(el.querySelector('b'), weaponUrl(w)); });
  }
  function decorateShop(mode) {
    const pn = panel(); if (!pn || typeof DLG === 'undefined' || !DLG.npc) return;
    const n = DLG.npc;
    if (mode === 'buy' && n.shop) pn.querySelectorAll('[data-buy]').forEach(b => { const e = n.shop[+b.dataset.buy]; if (e) put(b.querySelector('b'), url(e.item)); });
    if (mode === 'sell') { const L = sellables(n); pn.querySelectorAll('[data-sell]').forEach(b => { const e = L[+b.dataset.sell]; if (e) put(b.querySelector('b'), url(e.id)); }); }
  }
  function decorateChest() {
    const pn = panel(); if (!pn) return;
    const p = G.player, tabs = pn.querySelectorAll('table');
    const rowsOf = t => t ? Array.from(t.querySelectorAll('tr')).filter(tr => tr.querySelector('button')) : [];
    const store = p.houseStorage || [];
    rowsOf(tabs[0]).forEach((tr, i) => { if (store[i]) put(tr.querySelector('td b'), url(store[i].id)); });
    const carry = p.inv.filter(sl => has(ITEMS, sl.id) && !ITEMS[sl.id].key && !isWorn(sl.id));
    rowsOf(tabs[1]).forEach((tr, i) => { if (carry[i]) put(tr.querySelector('td b'), url(carry[i].id)); });
  }
  function decorateCrafting() {
    const pn = panel(); if (!pn) return;
    const wid = G.player.weapons[G.player.weapon] || 'sword';
    put(pn.querySelector('.slot b'), weaponUrl(wid));
    pn.querySelectorAll('[data-brew]').forEach(b => { const r = ALCHEMY_RECIPES[+b.dataset.brew]; if (r) put(b.querySelector('b'), url(r.out)); });
  }
  function guarded(fn, label) { try { fn(); } catch (e) { console.warn('item icons: ' + label + ' skipped', e); } }

  // ---------------------------------------------------------------- the painted paper doll
  // Same catalog-only SVG, same <title>, heading and figcaption as inventoryDoll; here the layers
  // carry gradients, shading and material textures, and the readied weapon and shield are the icons.
  function matOf(a) {
    if (!a) return null;
    if (a === ARMOR.a_synodrobe) return 'robe';
    if (/Hush/.test(a.name)) return 'hush';
    if (/Chain|Mail/.test(a.name)) return 'mail';
    if (/Bell-|Carillon/.test(a.name)) return 'bell';
    if (/Iron|Brigandine/.test(a.name)) return 'steel';
    if (/Leather/.test(a.name)) return 'leather';
    return 'cloth';
  }
  const MAT_COL = { robe: ['#a9b1af', '#5f6866'], hush: ['#4a6b62', '#223630'], mail: ['#a9b3b6', '#566064'], bell: ['#d8ab5a', '#7a5320'], steel: ['#b3bcbf', '#5a6366'], leather: ['#9a6642', '#4a2c18'], cloth: ['#b8a07a', '#6b5638'], skin: ['#c9a083', '#7b5842'], none: ['#7a6552', '#3a2d22'] };
  function dollSvg(p, origTitle) {
    const eq = slot => worn(slot, p), body = eq('body'), head = eq('head'), hands = eq('hands'), feet = eq('feet'), shield = eq('shield');
    const wid = p.weapons[p.weapon], weapon = WEAPONS[wid] || WEAPONS.sword, blocked = !!weapon.twoHanded;
    const mb = matOf(body), mh = matOf(head), mg = matOf(hands), mf = matOf(feet);
    const fill = m => 'url(#dl-' + (m || 'none') + ')';
    const defs = Object.keys(MAT_COL).map(k => '<linearGradient id="dl-' + k + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + MAT_COL[k][0] + '"/><stop offset="1" stop-color="' + MAT_COL[k][1] + '"/></linearGradient>').join('');
    const wUrl = weaponLayerUrl(wid), sUrl = shield && !blocked ? itemLayerUrl(armorId(shield)) : null;
    const metalBody = mb === 'mail' || mb === 'bell' || mb === 'steel';
    const plates = mb === 'bell' ? '<path d="M78 66L102 66L108 108L72 108Z" fill="url(#dl-bell)" opacity=".9"/><path d="M90 66V108M74 84H106" stroke="#5a3a12" stroke-width="1.2" opacity=".6"/><circle cx="90" cy="86" r="3.5" fill="#e8c46a" stroke="#5a3a12"/>'
      : mb === 'steel' ? '<path d="M74 66L105 66L111 109L70 109Z" fill="url(#dl-steel)"/><path d="M80 68V107M100 68V107" stroke="#e6e3c8" opacity=".6"/>' + [72, 80, 88, 96, 104].map(y => '<circle cx="' + (y - 20 + 12) + '" cy="72" r="1.1" fill="#f0e4b0"/>').join('')
      : mb === 'mail' ? '<path d="M74 65L105 65L111 109L70 109Z" fill="url(#dl-mail)"/><path d="M74 65L105 65L111 109L70 109Z" fill="url(#doll-mail)"/>' : '';
    const stitch = !body ? '<path d="M78 66L75 110M86 66V111M97 66L101 110" stroke="#af9469" opacity=".5"/>' : mb === 'leather' ? '<path d="M90 68V108" stroke="#2b1a0e" stroke-width="1.4"/>' + [72, 80, 88, 96, 104].map(y => '<path d="M86 ' + y + 'L94 ' + (y + 3) + 'M94 ' + y + 'L86 ' + (y + 3) + '" stroke="#e0cfa0" stroke-width=".9"/>').join('') : mb === 'cloth' ? '<path d="M76 66V110M84 66V110M92 66V110M100 66V110" stroke="#4b3a22" opacity=".28"/>' : mb === 'hush' ? '<path d="M90 66V112" stroke="#0f1d19" stroke-width="1.3" opacity=".6"/>' : '';
    const robe = mb === 'robe' ? '<path d="M67 109L113 109L123 166H58Z" fill="url(#dl-robe)"/><path d="M81 63V143L90 152L100 143V63" fill="none" stroke="#d8dad0" stroke-width="5"/><path d="M90 81V104M83 92H97" stroke="#514c39"/>' : '';
    const hushHem = mb === 'hush' ? '<path d="M66 118L114 118L120 150L60 150Z" fill="url(#dl-hush)" opacity=".92"/>' : '';
    const headPath = head ? '<path d="M73 40Q69 14 90 15Q112 15 107 41L101 47L101 30H79V47Z" fill="' + fill(mh) + '"/>'
      + (mh === 'bell' || mh === 'steel' || mh === 'mail' ? '<path d="M67 32Q90 24 113 32L110 37H70Z" fill="url(#dl-steel)"/><path d="M90 16V32" stroke="#4a3010" opacity=".5"/>' : '<path d="M76 24Q90 14 104 24" stroke="#fff" stroke-width="1.5" fill="none" opacity=".18"/>')
      : '<path d="M75 35Q69 14 90 17Q110 14 106 36L100 26L80 28Z" fill="#46352c"/>';
    const feetShade = feet ? '<path d="M72 152H85V176L65 178L65 170L72 168ZM96 152H109V168L117 171V178L96 176Z" fill="' + fill(mf) + '"/>' + (mf === 'steel' || mf === 'mail' ? '<path d="M75 155V170M100 155V170" stroke="#e6e6cf" opacity=".8"/>' : '') : '<path d="M72 152H85V176L65 178L65 170L72 168ZM96 152H109V168L117 171V178L96 176Z" fill="#67503c"/>';
    return '<svg viewBox="0 0 180 200" role="img" aria-label="Equipment paper doll">' + origTitle
      + '<defs><radialGradient id="doll-light"><stop stop-color="#6a5840"/><stop offset="1" stop-color="#211b17"/></radialGradient>'
      + '<pattern id="doll-mail" width="5" height="4" patternUnits="userSpaceOnUse"><path d="M0 1L2 3L5 1" fill="none" stroke="#e3e8e4" stroke-width=".8"/></pattern>'
      + defs + '<linearGradient id="dl-shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></linearGradient>'
      + '<radialGradient id="dl-floor"><stop stop-color="#000" stop-opacity=".7"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>'
      + '<rect x="5" y="5" width="170" height="190" rx="70" fill="url(#doll-light)" stroke="#8d744a" stroke-width="1.5"/><path d="M90 12V186M15 100H165" stroke="#c0a36b" opacity=".12"/>'
      + '<ellipse cx="90" cy="180" rx="46" ry="8" fill="url(#dl-floor)"/>'
      + '<g stroke="#221c1a" stroke-width="2" stroke-linejoin="round">'
      + '<path d="M73 111L87 113L85 169L72 169ZM94 113L108 111L109 169L96 169Z" fill="#483e38"/>'
      + '<path d="M67 64L54 72L44 111L54 116L69 88M112 64L125 73L136 111L126 116L111 88" fill="' + fill(mb) + '"/>'
      + '<path d="M71 60L108 60L117 118L65 118Z" fill="' + fill(mb) + '"/>' + plates + stitch + robe + hushHem
      + '<path d="M67 110H115V118H67Z" fill="#322923"/><rect x="85" y="110" width="10" height="8" fill="#c5a866"/>'
      + '<path d="M83 51V63L90 68L98 61V50" fill="' + fill('skin') + '"/><ellipse cx="90" cy="39" rx="15" ry="20" fill="' + fill('skin') + '"/>'
      + headPath + '<path d="M81 39H85M96 39H100M86 50Q91 53 96 49" fill="none" stroke="#594438"/>'
      + '<path d="M45 107L55 111L54 125L44 122ZM126 111L136 107L138 122L128 125Z" fill="' + (hands ? fill(mg) : fill('skin')) + '"/>'
      + feetShade + '</g>'
      // shading pass over the figure: light from the upper left, soft rim on the right
      + '<g stroke="none" pointer-events="none"><path d="M71 60L108 60L117 118L65 118Z" fill="url(#dl-shade)"/><path d="M67 64L54 72L44 111L54 116L69 88Z" fill="url(#dl-shade)"/><ellipse cx="90" cy="39" rx="15" ry="20" fill="url(#dl-shade)"/><path d="M72 152H85V176L65 178L65 170L72 168Z" fill="url(#dl-shade)"/></g>'
      + (metalBody ? '<path d="M76 68L74 106" stroke="#fff" stroke-width="2" opacity=".35"/>' : '')
      + (wUrl ? '<image href="' + wUrl + '" x="18" y="56" width="60" height="60" preserveAspectRatio="xMidYMid meet"/>' : '')
      + (sUrl ? '<image href="' + sUrl + '" x="108" y="84" width="48" height="48" preserveAspectRatio="xMidYMid meet"/>' : '')
      + '</svg>';
  }

  // ---------------------------------------------------------------- stylesheet
  function injectStyle() {
    if (typeof document === 'undefined' || !document.head || document.getElementById('icons-style')) return;
    const st = document.createElement('style'); st.id = 'icons-style';
    // negative block margins keep the icon from making rows taller than their text
    st.textContent = 'img.ico{width:3.2cqw;height:3.2cqw;vertical-align:middle;margin:-.8cqw .7cqw -.8cqw 0;image-rendering:auto;border-radius:.5cqw;flex:none}'
      + '.carry .nm img.ico{width:3.6cqw;height:3.6cqw}.slots .slot img.ico{width:3.8cqw;height:3.8cqw;margin:-1cqw .7cqw -1cqw 0;float:left}.slots .slot .nm{overflow:hidden}'
      + '.shoprow b:has(> img.ico){display:flex;align-items:center;gap:.6cqw}.shoprow b img.ico{width:3.6cqw;height:3.6cqw;margin:-.6cqw 0}'
      + '.paper-doll svg image{filter:drop-shadow(0 .4cqw .3cqw rgba(0,0,0,.6))}';
    document.head.appendChild(st);
  }

  // ---------------------------------------------------------------- wrap the original renderers (global function bindings, as reading.js does)
  function install() {
    injectStyle();
    if (typeof renderInventory === 'function') {
      const _inv = renderInventory;
      renderInventory = function () { const r = _inv.apply(this, arguments); if (on()) guarded(decorateInventory, 'inventory'); return r; };
    }
    if (typeof renderDialogue === 'function') {
      const _dlg = renderDialogue;
      renderDialogue = function (mode) { const r = _dlg.apply(this, arguments); if (on()) guarded(() => decorateShop(mode), 'shop'); return r; };
    }
    if (typeof renderHouseChest === 'function') {
      const _ch = renderHouseChest;
      renderHouseChest = function () { const r = _ch.apply(this, arguments); if (on()) guarded(decorateChest, 'chest'); return r; };
    }
    if (typeof renderCrafting === 'function') {
      const _cr = renderCrafting;
      renderCrafting = function () { const r = _cr.apply(this, arguments); if (on()) guarded(decorateCrafting, 'forge'); return r; };
    }
    if (typeof inventoryDoll === 'function') {
      const _doll = inventoryDoll;
      inventoryDoll = function (p) {
        const html = _doll.apply(this, arguments);
        if (!on()) return html;
        try {
          const t = /<title>[^<]*<\/title>/.exec(html), a = html.indexOf('<svg'), b = html.indexOf('</svg>');
          if (!t || a < 0 || b < 0) return html;
          const svg = dollSvg(p || G.player, t[0]);
          return html.slice(0, a) + svg + html.slice(b + 6);
        } catch (e) { console.warn('painted doll skipped', e); return html; }
      };
    }
  }
  try { install(); } catch (e) { console.warn('icons install failed', e); }

  return {
    TABLE, KIND: Object.keys(KIND), SIZE: S, url, weaponUrl, itemLayerUrl, weaponLayerUrl, allIds, plan, weaponPlan, dollSvg,
    decorateInventory, decorateShop, decorateChest, decorateCrafting, armorId, cacheSize: () => cache.size,
    // Phase 20: which ids have a hand-built pixel drawing; setPixel(false) shows the Phase 5 painted stand-ins (contact sheets)
    PIX, pxSprite, C_PX: C, hasPixel: id => typeof id === 'string' && !!pixFor(id), setPixel: v => { pixelOn = !!v; },
  };
})();
