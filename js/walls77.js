// ============================================================
//  walls77 — Phase 77 pilot, "sharp walls": every wall, roof, floor and ground tile at sixteen times the pixels.
//
//  Owner, 11 Nov: "I just want the visuals to look more crisp in game", then "show me what it can do with the
//  buildings and some of the most beautiful regions". The game's tiles are 64 x 64. In the 3D renderer (js/r3d21.js)
//  a house front fills the screen with them, so one painted pixel becomes a block the size of a thumbnail. This module
//  gives the renderer a 256 x 256 version of every tile, made from the tile itself, so the painting is the same and the
//  blocks are gone:
//    1. the tile is enlarged four times over with a curve fitted through its pixels (the tile wraps, so edges still
//       meet their neighbours), then sharpened;
//    2. fine grain is laid over it, the size of one new pixel and two: strongest where the painting has texture
//       (stone, timber, thatch, cobbles), faint on flat plaster and sky-lit water. It is the same for the same place on
//       the same tile, so nothing swims.
//  Only the 3D renderer uses it; the classic renderer draws 64 x 64 tiles exactly as before. Tiles that change every
//  frame (running water) are enlarged the cheap way so they cost nothing.
//
//  HDTEX.SIZE                 256
//  HDTEX.on()                 the switch (GFX.hdtex; Options -> Graphics & access, "Sharp walls and ground")
//  HDTEX.bytes(d)             a 64x64 engine tile (Uint32Array) -> Uint8Array(256*256*4), cached by the tile's content
//  HDTEX.plain(d)             the same tile only repeated 4x4 per pixel (what "off" looks like at this size)
//  Nothing is saved; no game random numbers; no assets.
// ============================================================
'use strict';

if (typeof GFX !== 'undefined') {
  if (GFX.hdtex === undefined) GFX.hdtex = true;
  if (!Array.isArray(GFX.ART)) GFX.ART = [];
  if (!GFX.ART.includes('hdtex')) GFX.ART.push('hdtex');
}

const HDTEX = (() => {
  const S = 64, K = 4, N = S * K, max = Math.max, min = Math.min, abs = Math.abs;
  const on = () => typeof GFX === 'undefined' || GFX.hdtex !== false;
  const sum = (d) => { let h = 0x811c9dc5; for (let i = 0; i < d.length; i += 7) h = Math.imul(h ^ d[i], 16777619); return h >>> 0; };
  function h2(a, b) { let n = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
  const CR = []; for (let k = 0; k < K; k++) { const t = (k + 0.5) / K - 0.5, u = t < 0 ? t + 1 : t, t2 = u * u, t3 = t2 * u; CR.push({ sh: t < 0 ? -1 : 0, w: [-0.5 * t3 + t2 - 0.5 * u, 1.5 * t3 - 2.5 * t2 + 1, -1.5 * t3 + 2 * t2 + 0.5 * u, 0.5 * t3 - 0.5 * t2] }); }

  function plain(d) {
    const out = new Uint8Array(N * N * 4), o32 = new Uint32Array(out.buffer);
    for (let y = 0; y < N; y++) { const sy = (y >> 2) * S; for (let x = 0; x < N; x++) o32[y * N + x] = d[sy + (x >> 2)]; }
    return out;
  }
  function make(d) {
    // premultiplied source (a few tiles have holes: gates, grilles)
    const pm = new Float32Array(S * S * 4); let holes = false;
    for (let i = 0; i < S * S; i++) { const c = d[i], a = (c >>> 24) >= 128 ? 1 : 0; if (!a) holes = true; pm[i * 4] = (c & 255) * a; pm[i * 4 + 1] = ((c >>> 8) & 255) * a; pm[i * 4 + 2] = ((c >>> 16) & 255) * a; pm[i * 4 + 3] = a; }
    // 1. a curve through the pixels, wrapping at the tile's edges
    const up = new Float32Array(N * N * 3), al = new Uint8Array(N * N), lum = new Float32Array(N * N);
    for (let Y = 0; Y < N; Y++) {
      const cy = CR[Y & 3], y0 = (Y >> 2) + cy.sh;
      for (let X = 0; X < N; X++) {
        const cx = CR[X & 3], x0 = (X >> 2) + cx.sh; let r = 0, g = 0, b = 0, a = 0;
        for (let j = 0; j < 4; j++) { const yy = ((y0 - 1 + j) & 63) * S, wy = cy.w[j]; for (let i = 0; i < 4; i++) { const k = (yy + ((x0 - 1 + i) & 63)) * 4, w = wy * cx.w[i]; r += pm[k] * w; g += pm[k + 1] * w; b += pm[k + 2] * w; a += pm[k + 3] * w; } }
        const o = Y * N + X;
        if (!holes) { al[o] = 1; up[o * 3] = r; up[o * 3 + 1] = g; up[o * 3 + 2] = b; }
        else if (a >= 0.5) { al[o] = 1; const near = d[(Y >> 2) * S + (X >> 2)]; if (a > 0.9 || (near >>> 24) < 128) { up[o * 3] = r / a; up[o * 3 + 1] = g / a; up[o * 3 + 2] = b / a; } else { up[o * 3] = near & 255; up[o * 3 + 1] = (near >>> 8) & 255; up[o * 3 + 2] = (near >>> 16) & 255; } }
        lum[o] = 0.3 * up[o * 3] + 0.59 * up[o * 3 + 1] + 0.11 * up[o * 3 + 2];
      }
    }
    // how much texture the painting has around each of its own pixels (0 flat .. 1 busy): steers the grain
    const busy = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const c = d[y * S + x], l = 0.3 * (c & 255) + 0.59 * ((c >>> 8) & 255) + 0.11 * ((c >>> 16) & 255); let v = 0;
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const q = d[((y + dy) & 63) * S + ((x + dx) & 63)]; v += abs(l - (0.3 * (q & 255) + 0.59 * ((q >>> 8) & 255) + 0.11 * ((q >>> 16) & 255))); }
      busy[y * S + x] = min(1, v / 4 / 14);
    }
    // 2. sharpen (unsharp mask over a wrapped 3x3), then grain
    const out = new Uint8Array(N * N * 4), G3 = [1, 2, 1, 2, 4, 2, 1, 2, 1], AMT = 1.1, seed = sum(d) & 1023;
    for (let Y = 0; Y < N; Y++) for (let X = 0; X < N; X++) {
      const o = Y * N + X; if (!al[o]) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const q = ((Y + j) & 255) * N + ((X + i) & 255); if (!al[q]) continue; const w = G3[(j + 1) * 3 + i + 1]; r += up[q * 3] * w; g += up[q * 3 + 1] * w; b += up[q * 3 + 2] * w; n += w; }
      const bz = busy[(Y >> 2) * S + (X >> 2)], amp = 0.05 + 0.13 * bz;
      const gr = 1 + amp * ((h2(X + seed, Y) - 0.5) * 1.1 + (h2((X >> 1) + seed * 3, Y >> 1) - 0.5) * 1.0 + (h2((X >> 2) + seed * 7, (Y >> 2) + 5) - 0.5) * 0.6);
      // crisp shapes: of the four painted pixels around this spot, take the one the curve came closest to (edges stay
      // hard and follow the curve, as a pixel artist would redraw them), and keep a share of the curve for the shading
      const sr = up[o * 3] + AMT * (up[o * 3] - r / n), sg = up[o * 3 + 1] + AMT * (up[o * 3 + 1] - g / n), sb = up[o * 3 + 2] + AMT * (up[o * 3 + 2] - b / n);
      const bx = ((X + 2) >> 2) - 1, by = ((Y + 2) >> 2) - 1; let best = 1e9, pr = sr, pg = sg, pb = sb;
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const q = d[((by + j) & 63) * S + ((bx + i) & 63)]; if ((q >>> 24) < 128) continue; const qr = q & 255, qg = (q >>> 8) & 255, qb = (q >>> 16) & 255, e = abs(qr - sr) + abs(qg - sg) + abs(qb - sb); if (e < best) { best = e; pr = qr; pg = qg; pb = qb; } }
      const SNAP = 0.62, f = (c, p) => { const v = (c * (1 - SNAP) + p * SNAP) * gr; return v < 0 ? 0 : v > 255 ? 255 : v; };
      out[o * 4] = f(sr, pr); out[o * 4 + 1] = f(sg, pg); out[o * 4 + 2] = f(sb, pb); out[o * 4 + 3] = 255;
    }
    return out;
  }
  // cache by content; a tile that keeps changing (animated water) stops being enlarged the slow way
  const cache = new Map(), churn = new WeakMap(); let made = 0;
  function bytes(d) {
    if (!(d instanceof Uint32Array) || d.length !== S * S) return null;
    const c = churn.get(d) || { n: 0, last: 0 }, s = sum(d);
    if (c.last !== s) { c.n++; c.last = s; churn.set(d, c); }
    if (c.n > 6) return plain(d);
    let e = cache.get(s);
    if (!e) { e = make(d); cache.set(s, e); made++; if (cache.size > 400) cache.delete(cache.keys().next().value); }
    return e;
  }
  return { SIZE: N, on, bytes, plain, make, stats: () => ({ made, cached: cache.size }) };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = HDTEX;
if (typeof window !== 'undefined') window.HDTEX = HDTEX;

// the Options row
if (typeof renderAccessibilityMenu === 'function' && typeof document !== 'undefined') (() => {
  const _acc = renderAccessibilityMenu;
  renderAccessibilityMenu = function () {
    const r = _acc.apply(this, arguments);
    try {
      const grid = document.querySelector('#modal-panel .ctl-grid');
      if (grid && !document.getElementById('gfx-hdtex')) {
        const label = document.createElement('span'); label.className = 'gfx-label'; label.appendChild(document.createTextNode('Sharp walls and ground '));
        const sm = document.createElement('small'); sm.className = 'muted'; sm.textContent = 'every wall, roof and ground tile at sixteen times the pixels, made from the tile itself (3D renderer only)'; label.appendChild(sm);
        const b = document.createElement('button'); b.className = 'dfbtn small'; b.id = 'gfx-hdtex'; b.type = 'button'; b.setAttribute('aria-label', 'Sharp walls and ground');
        const sync = () => { b.textContent = GFX.hdtex !== false ? 'On' : 'Off'; b.setAttribute('aria-pressed', GFX.hdtex !== false ? 'true' : 'false'); };
        b.onclick = () => { GFX.hdtex = GFX.hdtex === false; if (typeof GFX.changed === 'function') GFX.changed(); sync(); };
        sync(); grid.appendChild(label); grid.appendChild(b);
      }
    } catch (e) { /* the menu still opens without the row */ }
    return r;
  };
})();
