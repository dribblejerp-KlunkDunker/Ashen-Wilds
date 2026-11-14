// ============================================================
//  screens — Phase 5 (illustrated interface): painted area cards, cause-specific
//  death illustrations and full-screen Book One ending paintings.
//
//  All art is procedural stand-in work: canvas painting composed from the game's
//  own images (img/ending.jpg, img/title.jpg, img/map_woods.jpg), its enemy sprites
//  and its palette. Every picture is painted once and cached (canvas or data URL);
//  nothing is regenerated per frame.
//
//  Nothing here changes saved state: scenes are chosen from the map id, the death
//  source string and G.flags (read as truthy/falsy only). Nothing from a save is ever
//  placed in markup: area names go through textContent, alt texts are constants.
//  GFX.illustratedScreens = false restores the original screens exactly.
// ============================================================
'use strict';

if (typeof GFX !== 'undefined') {
  if (GFX.illustratedScreens === undefined) GFX.illustratedScreens = true;
}

const SCREENS = (function () {
  const on = () => typeof GFX === 'undefined' || GFX.illustratedScreens !== false;

  // ---------------------------------------------------------------- painting kit
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function rng(seed) { // mulberry32 over a string hash: the same scene paints the same every time
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function vgrad(x, w, h, stops) { const g = x.createLinearGradient(0, 0, 0, h); stops.forEach(s => g.addColorStop(s[0], s[1])); x.fillStyle = g; x.fillRect(0, 0, w, h); }
  function glow(x, cx, cy, r, rgb, a) {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  function vignette(x, w, h, a) {
    const g = x.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.95); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`);
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }
  function grain(x, w, h, R, n, a) { for (let i = 0; i < n; i++) { x.fillStyle = R() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,240,200,${a * 0.5})`; x.fillRect((R() * w) | 0, (R() * h) | 0, 1, 1); } }
  function ridge(x, w, base, amp, col, R, step) {
    x.fillStyle = col; x.beginPath(); x.moveTo(0, base + 200);
    let y = base; for (let px = 0; px <= w + step; px += step) { y += (R() - 0.5) * amp; y = Math.max(base - amp * 2, Math.min(base + amp * 2, y)); x.lineTo(px, y); }
    x.lineTo(w, base + 200); x.closePath(); x.fill();
  }
  function tree(x, px, base, hgt, trunk, crown, R) {
    x.fillStyle = trunk; x.fillRect(px - hgt * 0.04, base - hgt * 0.5, hgt * 0.08, hgt * 0.5);
    x.fillStyle = crown; for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(px + (R() - 0.5) * hgt * 0.4, base - hgt * (0.55 + R() * 0.4), hgt * (0.14 + R() * 0.1), 0, 6.3); x.fill(); }
  }
  function tint(x, w, h, col, mode, a) { x.save(); x.globalCompositeOperation = mode; x.globalAlpha = a == null ? 1 : a; x.fillStyle = col; x.fillRect(0, 0, w, h); x.restore(); }
  function window_(x, px, py, w, h, col) { x.fillStyle = col; x.fillRect(px, py, w, h); glow(x, px + w / 2, py + h / 2, w * 2.2, '255,170,70', 0.25); x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(px + w / 2 - 0.5, py, 1, h); x.fillRect(px, py + h / 2 - 0.5, w, 1); }
  function arch(x, cx, base, w, h, col) { x.fillStyle = col; x.beginPath(); x.moveTo(cx - w / 2, base); x.lineTo(cx - w / 2, base - h + w / 2); x.arc(cx, base - h + w / 2, w / 2, Math.PI, 0); x.lineTo(cx + w / 2, base); x.closePath(); x.fill(); }
  function figure(x, px, base, h, col) { // a plain standing silhouette
    x.fillStyle = col; x.beginPath(); x.arc(px, base - h * 0.88, h * 0.11, 0, 6.3); x.fill();
    x.beginPath(); x.moveTo(px - h * 0.16, base); x.lineTo(px - h * 0.12, base - h * 0.75); x.lineTo(px + h * 0.12, base - h * 0.75); x.lineTo(px + h * 0.16, base); x.closePath(); x.fill();
  }

  // the game's own pictures, loaded once. A scene needing one that has not arrived yet is
  // painted without it and NOT cached, so the next visit gets the finished version.
  const IMG = {};
  function img(name) {
    let e = IMG[name];
    if (!e) { e = IMG[name] = { el: new Image(), ok: false }; e.el.onload = () => { e.ok = true; }; e.el.src = 'img/' + name; }
    return e.ok && e.el.naturalWidth ? e.el : null;
  }
  let missing = false;
  function backdrop(x, w, h, name, sx, sy, sw, sh) {
    const im = img(name); if (!im) { missing = true; return false; }
    x.imageSmoothingEnabled = false; x.drawImage(im, sx * im.naturalWidth, sy * im.naturalHeight, sw * im.naturalWidth, sh * im.naturalHeight, 0, 0, w, h); return true;
  }

  // ---------------------------------------------------------------- area cards (320x200)
  const AW = 320, AH = 200;
  const PAINT = {
    // Oakhaven: the burning-green town under its oaks, from the ending painting's own sky and roofs
    street(x, R) {
      vgrad(x, AW, AH, [[0, '#13200f'], [0.55, '#4d5e22'], [1, '#2a2410']]);
      if (backdrop(x, AW, AH, 'ending.jpg', 0, 0.1, 0.75, 0.75)) tint(x, AW, AH, '#7a8a5a', 'multiply', 0.55);
      ridge(x, AW, 118, 8, '#1a2010', R, 8);
      for (let i = 0; i < 9; i++) { const px = 8 + i * 36 + R() * 8, w = 24 + R() * 10, h = 22 + R() * 18; x.fillStyle = '#17120c'; x.fillRect(px, 150 - h, w, h + 50); x.beginPath(); x.moveTo(px - 3, 150 - h); x.lineTo(px + w / 2, 150 - h - 14 - R() * 6); x.lineTo(px + w + 3, 150 - h); x.fill(); if (R() < 0.8) window_(x, px + 5, 150 - h + 8, 5, 6, '#f0b048'); if (R() < 0.5) window_(x, px + w - 10, 150 - h + 14, 5, 6, '#d98c30'); }
      x.fillStyle = '#0d0a06'; x.fillRect(0, 160, AW, 40); ridge(x, AW, 168, 5, '#0f160b', R, 6);
      glow(x, 160, 160, 60, '255,150,60', 0.22);
    },
    // houses and halls: a hearth, a table, a lit lamp
    hearth(x, R) {
      vgrad(x, AW, AH, [[0, '#120b06'], [1, '#2a1a0c']]);
      for (let i = 0; i < 6; i++) { x.fillStyle = i % 2 ? '#1c1209' : '#23170c'; x.fillRect(i * 56 - 8, 0, 54, 140); }
      x.fillStyle = '#0b0704'; x.fillRect(0, 0, AW, 18); for (let i = 0; i < 5; i++) x.fillRect(i * 70 + 10, 0, 8, 40);
      arch(x, 160, 150, 90, 100, '#080503'); arch(x, 160, 150, 70, 80, '#2a0f06');
      glow(x, 160, 140, 110, '255,120,30', 0.55); glow(x, 160, 146, 40, '255,210,110', 0.8);
      for (let i = 0; i < 5; i++) { x.fillStyle = i % 2 ? '#ffb040' : '#ff7a20'; x.beginPath(); x.moveTo(130 + i * 15, 150); x.quadraticCurveTo(136 + i * 15, 100 - R() * 20, 144 + i * 15, 150); x.fill(); }
      x.fillStyle = '#0a0704'; x.fillRect(0, 150, AW, 50); x.fillStyle = '#1b110a'; x.fillRect(40, 162, 110, 6); x.fillRect(50, 168, 4, 24); x.fillRect(136, 168, 4, 24);
      x.fillStyle = '#c9a56a'; x.fillRect(80, 154, 6, 8); x.fillRect(100, 156, 5, 6); x.fillStyle = '#080604'; x.fillRect(240, 130, 6, 70); x.fillRect(250, 150, 30, 50);
    },
    hall(x, R) {
      vgrad(x, AW, AH, [[0, '#0d0e12'], [1, '#262420']]);
      for (let i = 0; i < 4; i++) { arch(x, 40 + i * 80, 160, 70, 130, '#1a1a1e'); arch(x, 40 + i * 80, 160, 54, 112, '#0a0a0d'); }
      for (let i = 0; i < 5; i++) { x.fillStyle = '#2b2a2e'; x.fillRect(i * 80 - 4, 30, 8, 130); }
      glow(x, 160, 100, 100, '255,190,100', 0.22);
      x.fillStyle = '#0b0a09'; x.fillRect(0, 160, AW, 40); x.fillStyle = '#3a2a18'; x.fillRect(100, 150, 120, 8); x.fillRect(108, 158, 6, 30); x.fillRect(206, 158, 6, 30);
      x.fillStyle = '#d8c79a'; x.fillRect(130, 144, 22, 6); x.fillStyle = '#e8d9b5'; x.fillRect(170, 146, 14, 4);
      x.fillStyle = '#d9a441'; x.beginPath(); x.arc(160, 60, 5, 0, 6.3); x.fill(); glow(x, 160, 60, 40, '255,200,90', 0.6); x.fillStyle = '#3a3226'; x.fillRect(159, 20, 2, 36);
    },
    mill(x, R) {
      vgrad(x, AW, AH, [[0, '#18241a'], [1, '#2a3a24']]);
      ridge(x, AW, 120, 6, '#0f1a0f', R, 10);
      x.fillStyle = '#1a1209'; x.fillRect(180, 70, 100, 100); x.beginPath(); x.moveTo(170, 72); x.lineTo(230, 36); x.lineTo(290, 72); x.fill();
      window_(x, 200, 90, 8, 10, '#e6a94a');
      x.save(); x.translate(110, 130); x.strokeStyle = '#2a1c0e'; x.lineWidth = 4; x.beginPath(); x.arc(0, 0, 44, 0, 6.3); x.stroke();
      x.lineWidth = 3; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * 44, Math.sin(a) * 44); x.stroke(); x.fillStyle = '#3a2814'; x.fillRect(Math.cos(a) * 44 - 4, Math.sin(a) * 44 - 4, 8, 8); } x.restore();
      vgrad(x, AW, AH, [[0, 'rgba(0,0,0,0)'], [0.72, 'rgba(0,0,0,0)'], [0.73, 'rgba(32,64,44,.9)'], [1, 'rgba(10,28,20,.95)']]);
      for (let i = 0; i < 30; i++) { x.fillStyle = 'rgba(160,220,170,.18)'; x.fillRect(R() * AW, 148 + R() * 50, 8 + R() * 14, 1); }
      for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(255,240,200,.5)'; x.fillRect(R() * 300, R() * 150, 1, 1); } // flour on the air
    },
    workshop(x, R) {
      vgrad(x, AW, AH, [[0, '#0e0a07'], [1, '#2a1c10']]);
      x.fillStyle = '#1a110a'; for (let i = 0; i < 8; i++) x.fillRect(i * 42, 0, 6, 120);
      x.fillStyle = '#0a0705'; x.fillRect(0, 36, AW, 8);
      for (let i = 0; i < 9; i++) { const px = 20 + i * 34; x.fillStyle = i % 3 ? '#5a3a1e' : '#6b4a28'; x.beginPath(); x.moveTo(px, 44); x.lineTo(px + 22, 44); x.lineTo(px + 20 + R() * 4, 90 + R() * 30); x.lineTo(px + 4, 96 + R() * 24); x.fill(); }
      glow(x, 160, 130, 130, '255,160,70', 0.28);
      x.fillStyle = '#0c0805'; x.fillRect(0, 150, AW, 50); x.fillStyle = '#1d1209'; x.fillRect(30, 140, 70, 40); x.fillRect(200, 144, 80, 36);
      x.fillStyle = 'rgba(70,90,40,.55)'; x.fillRect(34, 142, 62, 5); x.fillRect(204, 146, 72, 5);
    },
    chapel(x, R) {
      vgrad(x, AW, AH, [[0, '#0c0a14'], [1, '#1c1820']]);
      arch(x, 160, 150, 70, 150, '#26222e'); arch(x, 160, 150, 52, 130, '#e8d9b5');
      vgrad(x, AW, AH, [[0, 'rgba(255,220,150,0)'], [1, 'rgba(255,220,150,0)']]);
      x.fillStyle = 'rgba(255,230,170,.18)'; x.beginPath(); x.moveTo(135, 40); x.lineTo(185, 40); x.lineTo(260, 190); x.lineTo(60, 190); x.fill();
      x.fillStyle = '#3a2a1a'; x.fillRect(158, 30, 4, 100); x.fillRect(142, 60, 36, 4);
      for (let i = 0; i < 4; i++) { x.fillStyle = '#0a0810'; x.fillRect(0, 155 + i * 8, 100 - i * 6, 7); x.fillRect(AW - 100 + i * 6, 155 + i * 8, 100 - i * 6, 7); }
      x.fillStyle = '#0a0810'; x.fillRect(0, 175, AW, 25);
      x.fillStyle = '#2b2630'; for (let i = 0; i < 4; i++) x.fillRect(20 + i * 30, 20, 8, 140), x.fillRect(AW - 28 - i * 30, 20, 8, 140);
      glow(x, 160, 120, 70, '255,225,160', 0.35); // the one candle on the sill of a quiet room
    },
    hedge(x, R) {
      vgrad(x, AW, AH, [[0, '#101a14'], [1, '#2a3828']]);
      if (backdrop(x, AW, AH, 'title.jpg', 0.1, 0.25, 0.8, 0.6)) tint(x, AW, AH, '#49604a', 'multiply', 0.7);
      for (let i = 0; i < 12; i++) ridge(x, AW, 70 + i * 8, 6 + i * 0.5, `rgb(${12 + i * 3},${22 + i * 3},${14 + i * 2})`, R, 5);
      for (let i = 0; i < 900; i++) { x.fillStyle = R() < 0.5 ? '#0a1008' : '#3a4a2e'; const px = R() * AW, py = 60 + R() * 140; x.fillRect(px, py, 1, 2 + (R() * 4 | 0)); }
      for (let i = 0; i < 140; i++) { x.strokeStyle = 'rgba(8,10,6,.8)'; x.beginPath(); const px = R() * AW, py = 80 + R() * 110; x.moveTo(px, py); x.lineTo(px + (R() - 0.5) * 18, py + (R() - 0.5) * 18); x.stroke(); }
      vgrad(x, AW, AH, [[0, 'rgba(0,0,0,0)'], [0.55, 'rgba(0,0,0,0)'], [1, 'rgba(8,12,8,.75)']]);
      x.fillStyle = '#080a06'; x.fillRect(160, 140, 3, 50); x.fillRect(156, 134, 11, 8); glow(x, 161, 138, 36, '255,190,100', 0.5); // the hush-lamp
      for (let i = 0; i < 8; i++) { x.fillStyle = 'rgba(210,225,210,.07)'; x.fillRect(0, 130 + i * 8, AW, 6); }
    },
    quarry(x, R) {
      vgrad(x, AW, AH, [[0, '#0c1410'], [1, '#26402a']]);
      glow(x, 160, 140, 140, '90,255,140', 0.35);
      ridge(x, AW, 120, 10, '#0d140f', R, 14);
      x.strokeStyle = '#0a0a0a'; x.lineWidth = 5; x.beginPath(); x.moveTo(120, 160); x.lineTo(150, 60); x.lineTo(180, 160); x.moveTo(130, 130); x.lineTo(170, 130); x.moveTo(150, 60); x.lineTo(150, 40); x.stroke();
      x.lineWidth = 2; x.beginPath(); x.arc(150, 38, 7, 0, 6.3); x.stroke(); x.fillStyle = '#0a0a0a'; x.fillRect(0, 160, AW, 40);
      x.fillStyle = '#6cf29a'; x.fillRect(140, 162, 22, 4); glow(x, 150, 164, 36, '110,255,160', 0.8);
      for (let i = 0; i < 7; i++) figure(x, 40 + i * 40 + R() * 10, 190, 14, '#06100a');
    },
    // under the quarry and the hedge: a chamber grown out of the Root, veined with glass
    root(x, R) {
      vgrad(x, AW, AH, [[0, '#07100a'], [1, '#142a1c']]);
      for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(${40 + R() * 40},${160 + R() * 80},${90 + R() * 60},${0.2 + R() * 0.4})`; x.lineWidth = 1 + R() * 2; x.beginPath(); let px = R() * AW, py = 0; x.moveTo(px, py); for (let s = 0; s < 8; s++) { px += (R() - 0.5) * 40; py += 28; x.lineTo(px, py); } x.stroke(); }
      glow(x, 160, 110, 120, '90,255,150', 0.35);
      for (let i = 0; i < 9; i++) { const px = 20 + i * 34 + R() * 10, h = 18 + R() * 30; x.fillStyle = 'rgba(120,255,180,.75)'; x.beginPath(); x.moveTo(px, 200); x.lineTo(px + 5, 200 - h); x.lineTo(px + 10, 200); x.fill(); x.fillStyle = 'rgba(0,30,10,.5)'; x.fillRect(px + 5, 200 - h, 1, h); }
      vignette(x, AW, AH, 0.7);
    },
    grove(x, R) {
      vgrad(x, AW, AH, [[0, '#0c1618'], [1, '#26403a']]);
      glow(x, 160, 60, 100, '170,230,210', 0.25);
      for (let i = 0; i < 7; i++) { const px = 10 + i * 50 + R() * 20; x.fillStyle = '#0b100c'; x.fillRect(px - 5, 20, 10, 150); for (let k = 0; k < 14; k++) { x.strokeStyle = 'rgba(30,70,50,.7)'; x.beginPath(); const sx = px + (R() - 0.5) * 30; x.moveTo(sx, 20 + R() * 30); x.quadraticCurveTo(sx + (R() - 0.5) * 30, 100, sx + (R() - 0.5) * 20, 150 + R() * 20); x.stroke(); } }
      vgrad(x, AW, AH, [[0, 'rgba(0,0,0,0)'], [0.74, 'rgba(0,0,0,0)'], [0.75, 'rgba(40,90,90,.85)'], [1, 'rgba(10,28,36,.95)']]);
      for (let i = 0; i < 6; i++) { glow(x, 40 + i * 48, 150, 20, '255,200,110', 0.55); x.fillStyle = '#ffd890'; x.fillRect(40 + i * 48 - 1, 148, 2, 3); x.fillStyle = 'rgba(255,200,110,.3)'; x.fillRect(40 + i * 48 - 1, 156, 2, 20); }
      x.fillStyle = 'rgba(210,235,225,.1)'; for (let i = 0; i < 5; i++) x.fillRect(0, 110 + i * 10, AW, 7);
    },
    woods(x, R) {
      vgrad(x, AW, AH, [[0, '#0b1210'], [1, '#233a2a']]);
      if (backdrop(x, AW, AH, 'map_woods.jpg', 0.2, 0.2, 0.5, 0.45)) tint(x, AW, AH, '#2a4a36', 'multiply', 0.75);
      for (let layer = 0; layer < 3; layer++) { const col = ['#1a2c22', '#101c16', '#070d0a'][layer]; for (let i = 0; i < 9 - layer * 2; i++) { const px = R() * AW, w = 6 + layer * 6; x.fillStyle = col; x.fillRect(px, 0, w, AH); } x.fillStyle = `rgba(190,215,200,${0.1 - layer * 0.02})`; x.fillRect(0, 90 + layer * 16, AW, 22); }
      glow(x, 230, 70, 60, '200,235,210', 0.25);
      x.fillStyle = '#050806'; x.fillRect(0, 176, AW, 24);
    },
    crypt(x, R) {
      vgrad(x, AW, AH, [[0, '#0b0b10'], [1, '#1e1e24']]);
      for (let i = 0; i < 5; i++) { arch(x, 30 + i * 65, 170, 56, 120, '#2a2a32'); arch(x, 30 + i * 65, 170, 40, 100, '#07070a'); }
      for (let i = 0; i < 5; i++) { x.fillStyle = '#121216'; x.fillRect(8 + i * 65, 80, 44, 4); x.fillRect(8 + i * 65, 110, 44, 4); }
      x.fillStyle = '#d8d0b8'; for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(52 + i * 65 - 22, 76, 3, 0, 6.3); x.fill(); }
      glow(x, 160, 150, 90, '200,190,255', 0.28);
      x.fillStyle = '#060608'; x.fillRect(0, 170, AW, 30); x.fillStyle = '#e8d9b5'; x.fillRect(158, 158, 4, 12); glow(x, 160, 156, 30, '255,230,150', 0.7);
      vignette(x, AW, AH, 0.6);
    },
    belfry(x, R) {
      vgrad(x, AW, AH, [[0, '#0e0e14'], [1, '#262026']]);
      x.fillStyle = '#16121a'; x.fillRect(80, 0, 160, AH); x.fillStyle = '#0a080c'; x.fillRect(96, 0, 128, AH);
      for (let i = 0; i < 6; i++) { x.fillStyle = '#2a2230'; x.fillRect(96, i * 36 + 10, 128, 3); }
      arch(x, 160, 120, 64, 100, '#04030a'); glow(x, 160, 60, 80, '255,235,180', 0.2);
      x.fillStyle = '#6b4a22'; x.fillRect(100, 18, 120, 8);
      x.fillStyle = '#9c7430'; x.beginPath(); x.moveTo(140, 26); x.quadraticCurveTo(135, 90, 125, 112); x.lineTo(195, 112); x.quadraticCurveTo(185, 90, 180, 26); x.fill();
      x.fillStyle = '#d9a441'; x.fillRect(148, 30, 6, 76); x.fillStyle = '#080508'; x.beginPath(); x.arc(160, 116, 6, 0, 6.3); x.fill();
      x.fillStyle = '#050407'; x.fillRect(0, 170, AW, 30);
    },
    arena(x, R) {
      vgrad(x, AW, AH, [[0, '#14100c'], [1, '#32261a']]);
      x.fillStyle = '#080605'; x.beginPath(); x.ellipse(160, 130, 150, 54, 0, 0, 6.3); x.fill();
      x.fillStyle = '#4a3a24'; x.beginPath(); x.ellipse(160, 134, 120, 38, 0, 0, 6.3); x.fill();
      x.strokeStyle = '#120d08'; x.lineWidth = 2; for (let i = 0; i < 6; i++) { x.beginPath(); x.ellipse(160, 134, 120 - i * 18, 38 - i * 6, 0, 0, 6.3); x.stroke(); }
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const px = 160 + Math.cos(a) * 140, py = 130 + Math.sin(a) * 50; x.fillStyle = '#0b0805'; x.fillRect(px - 3, py - 40, 6, 40); if (i % 3 === 0) { x.fillStyle = '#8a1a14'; x.fillRect(px - 8, py - 38, 16, 22); } }
      glow(x, 160, 60, 110, '255,190,100', 0.22); figure(x, 160, 140, 28, '#0a0705');
    },
    plain(x, R) { // an unknown map: a lit doorway in the dark, nothing assumed about where it leads
      vgrad(x, AW, AH, [[0, '#0b0a0c'], [1, '#1a1612']]); arch(x, 160, 170, 60, 110, '#050405'); glow(x, 160, 120, 70, '255,200,120', 0.35); vignette(x, AW, AH, 0.6);
    },
  };
  PAINT.plain.__fallback = true;

  // map id -> picture family. Unknown ids use the map's outdoor flag, then 'plain'.
  const FAMILY = {
    oakhaven: 'street', watchhouse: 'hall', tavern: 'hearth', lyra_house: 'hearth', orla_house: 'hearth', cooper_house: 'hearth', wickhouse: 'hearth',
    greenhall: 'hall', surgery: 'hall', mill: 'mill', chapel: 'chapel', cloister: 'chapel', tannery: 'workshop', malting: 'workshop',
    clearing: 'hedge', quarry: 'quarry', rootvault: 'root', underhedge: 'root', procdungeon: 'root', whispergrove: 'grove', deepwoods: 'woods',
    catacombs: 'crypt', mausoleum: 'crypt', belfry: 'belfry', arena: 'arena',
  };
  function familyFor(id) {
    if (typeof id === 'string' && Object.prototype.hasOwnProperty.call(FAMILY, id)) return FAMILY[id];
    try { const m = typeof G !== 'undefined' && G.maps && typeof id === 'string' && Object.prototype.hasOwnProperty.call(G.maps, id) ? G.maps[id] : null; if (m) return m.outdoor ? 'woods' : 'plain'; } catch (e) { /* fall through */ }
    return 'plain';
  }

  // Phase 8 paintings: the decoded Image when js/painted.js has one ready now, else null (stand-in).
  function paintedReady(group, key) {
    try { return typeof PAINTED !== 'undefined' ? PAINTED.ready(group, key) : null; } catch (e) { return null; }
  }
  function paintedLoad(group, key) {
    try { return typeof PAINTED !== 'undefined' && PAINTED.has(group, key) ? PAINTED.load(group, key) : Promise.resolve(null); } catch (e) { return Promise.resolve(null); }
  }

  const areaCache = {};
  function areaCanvas(family) {
    if (areaCache[family]) return areaCache[family];
    const c = canvas(AW, AH), x = c.getContext('2d'), R = rng('area:' + family);
    missing = false;
    (PAINT[family] || PAINT.plain)(x, R);
    // the same finish on every card so the families read as one set of paintings
    vignette(x, AW, AH, 0.55); grain(x, AW, AH, R, 900, 0.12);
    if (!missing) areaCache[family] = c;
    return c;
  }

  // ---------------------------------------------------------------- the card
  let card = null, cardCanvas = null, cardName = null, hideT = 0, lastShown = -1e9, lastFamily = null, listening = false, padRaf = 0;
  function ensureCard() {
    if (card && card.isConnected) return card;
    const host = document.getElementById('game'); if (!host) return null;
    card = document.createElement('div'); card.id = 'scr-card'; card.setAttribute('aria-hidden', 'true');
    cardCanvas = document.createElement('canvas'); cardCanvas.width = AW; cardCanvas.height = AH;
    const shade = document.createElement('div'); shade.className = 'scr-shade';
    cardName = document.createElement('div'); cardName.className = 'scr-name';
    card.append(cardCanvas, shade, cardName); host.appendChild(card);
    return card;
  }
  function dismiss() {
    if (!card) return;
    clearTimeout(hideT); card.classList.remove('on'); card.classList.add('off');
    hideT = setTimeout(() => { if (card) card.classList.remove('off', 'rm', 'show', 'held'); }, 160);
    cancelAnimationFrame(padRaf);
  }
  function pollPad() {
    try { for (const p of (navigator.getGamepads ? navigator.getGamepads() : [])) if (p && (p.buttons.some(b => b.pressed) || p.axes.some(a => Math.abs(a) > 0.6))) { dismiss(); return; } } catch (e) { /* no pad */ }
    if (card && card.classList.contains('on')) padRaf = requestAnimationFrame(pollPad);
  }
  function listen() {
    if (listening) return; listening = true;
    // any input skips the card; the listeners only observe, so the input still reaches the game
    for (const ev of ['keydown', 'pointerdown', 'mousedown', 'touchstart', 'wheel']) window.addEventListener(ev, () => { if (card && card.classList.contains('on')) dismiss(); }, { capture: true, passive: true });
  }
  // The card lives for the fade the game already runs (0.5 s) and never longer.
  function showArea(id) {
    if (!on()) return false;
    const m = G.maps && Object.prototype.hasOwnProperty.call(G.maps, id) ? G.maps[id] : null;
    const el = ensureCard(); if (!el || !m) return false;
    const fam = familyFor(id);
    // Phase 8: a painting if one is already decoded (never wait: the stand-in serves this visit)
    const pim = paintedReady('area', fam);
    if (pim) {
      const hw = el.clientWidth || 1280, hh = el.clientHeight || 720, cw = 1280, ch = Math.max(1, Math.round(cw * hh / hw));
      if (cardCanvas.width !== cw || cardCanvas.height !== ch) { cardCanvas.width = cw; cardCanvas.height = ch; }
      const px = cardCanvas.getContext('2d'); PAINTED.drawCover(px, pim, cw, ch); vignette(px, cw, ch, 0.55);
      cardCanvas.classList.add('painted');
    } else {
      if (cardCanvas.width !== AW || cardCanvas.height !== AH) { cardCanvas.width = AW; cardCanvas.height = AH; }
      cardCanvas.classList.remove('painted');
      cardCanvas.getContext('2d').drawImage(areaCanvas(fam), 0, 0);
    }
    cardName.textContent = String(m.name || ''); // textContent only: a map name is never markup
    clearTimeout(hideT);
    el.classList.remove('on', 'off', 'rm'); void el.offsetWidth;
    if (GFX && GFX.reduceMotion) el.classList.add('rm');
    el.classList.add('show', 'on'); if (api.hold) el.classList.add('held');
    lastShown = performance.now(); lastFamily = fam;
    listen(); cancelAnimationFrame(padRaf); padRaf = requestAnimationFrame(pollPad);
    if (!api.hold) hideT = setTimeout(dismiss, 520); // api.hold is for screenshots and tests only
    return true;
  }
  function shouldShow(prevId, id) {
    if (!on() || !id || prevId === id || !prevId) return false;
    if (typeof G === 'undefined' || G.state !== 'play') return false;        // loads, intro, death, endings: no card
    if (performance.now() - lastShown < 1100) return false;                   // rapid door-to-door moves
    return true;
  }

  // ---------------------------------------------------------------- death illustrations (320x200)
  const DW = 320, DH = 200;
  function spriteLayer(x, name, px, py, h, alpha) { // an enemy sprite from the game's own art, drawn once, large
    try {
      const sp = typeof Engine !== 'undefined' && Engine.sprites && Engine.sprites[name]; if (!sp) return false;
      let src = sp.img;
      if (!src) { src = canvas(sp.w, sp.h); const id = src.getContext('2d').createImageData(sp.w, sp.h); new Uint32Array(id.data.buffer).set(sp.data); src.getContext('2d').putImageData(id, 0, 0); }
      const w = h * sp.w / sp.h; x.save(); x.imageSmoothingEnabled = false; x.globalAlpha = alpha == null ? 1 : alpha; x.drawImage(src, px - w / 2, py - h, w, h); x.restore(); return true;
    } catch (e) { return false; }
  }
  const DEATH = {
    heartglass(x, R) {
      vgrad(x, DW, DH, [[0, '#04100e'], [1, '#0c2a26']]); glow(x, 160, 100, 140, '80,255,210', 0.3);
      figure(x, 160, 190, 120, '#04090a');
      for (let i = 0; i < 22; i++) { const px = 100 + R() * 120, h = 20 + R() * 60; x.fillStyle = `rgba(${100 + R() * 60},255,${200 + R() * 50},${0.4 + R() * 0.4})`; x.beginPath(); x.moveTo(px, 190); x.lineTo(px + 4, 190 - h); x.lineTo(px + 9, 190); x.fill(); }
      for (let i = 1; i < 6; i++) { x.strokeStyle = `rgba(120,255,220,${0.35 - i * 0.05})`; x.beginPath(); x.arc(160, 100, i * 22, 0, 6.3); x.stroke(); } // the lullaby
    },
    unwrite(x, R) {
      vgrad(x, DW, DH, [[0, '#0b0b0e'], [1, '#18181c']]);
      figure(x, 160, 190, 130, '#131316');
      x.fillStyle = '#0b0b0e'; for (let i = 0; i < 160; i++) x.fillRect(120 + R() * 80, 60 + R() * 130, 2 + R() * 6, 2 + R() * 6); // the outline eaten away
      for (let i = 0; i < 80; i++) { x.fillStyle = `rgba(200,210,220,${R() * 0.35})`; x.fillRect(150 + (R() - 0.5) * 140, 40 + R() * 150, 1, 1); }
      glow(x, 160, 70, 60, '200,210,230', 0.1);
    },
    greening(x, R) {
      vgrad(x, DW, DH, [[0, '#142a10'], [1, '#2a3a14']]);
      backdrop(x, DW, DH, 'ending.jpg', 0.45, 0.05, 0.55, 0.6) && tint(x, DW, DH, '#5a7a30', 'multiply', 0.7);
      for (let i = 0; i < 30; i++) figure(x, 20 + i * 10 + R() * 4, 196 - R() * 6, 12 + R() * 4, '#05100a'); // the town, waving the ship away
      x.fillStyle = '#0a1608'; x.fillRect(150, 40, 20, 160); for (let i = 0; i < 7; i++) { x.beginPath(); x.arc(160 + (R() - 0.5) * 70, 60 + R() * 30, 20 + R() * 12, 0, 6.3); x.fill(); }
      x.fillStyle = '#1a2a10'; x.beginPath(); x.ellipse(250, 40, 16, 5, 0, 0, 6.3); x.fill(); // the ship, lifting
    },
    fall(x, R) {
      vgrad(x, DW, DH, [[0, '#2a3038'], [1, '#07090c']]);
      x.fillStyle = '#c8d0d6'; x.beginPath(); x.arc(160, 18, 9, 0, 6.3); x.fill(); glow(x, 160, 18, 40, '200,215,235', 0.5);
      x.fillStyle = '#0a0c10'; x.beginPath(); x.moveTo(0, 20); x.lineTo(70, 20); x.lineTo(54, 200); x.lineTo(0, 200); x.fill(); x.beginPath(); x.moveTo(320, 20); x.lineTo(250, 20); x.lineTo(268, 200); x.lineTo(320, 200); x.fill();
      for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(200,210,220,${0.08 + R() * 0.15})`; const px = 80 + R() * 160; x.beginPath(); x.moveTo(px, R() * 60); x.lineTo(px, 100 + R() * 90); x.stroke(); } // wind streaks
      figure(x, 160, 150, 40, '#05060a');
    },
    drown(x, R) {
      vgrad(x, DW, DH, [[0, '#2a6a74'], [0.25, '#123a48'], [1, '#02080e']]);
      for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(190,240,240,${0.07 - i * 0.008})`; x.beginPath(); x.moveTo(60 + i * 40, 0); x.lineTo(90 + i * 40, 0); x.lineTo(170 + i * 20, 200); x.lineTo(110 + i * 20, 200); x.fill(); }
      for (let i = 0; i < 60; i++) { x.strokeStyle = `rgba(200,240,240,${0.2 + R() * 0.3})`; x.beginPath(); x.arc(R() * DW, 30 + R() * 160, 1 + R() * 3, 0, 6.3); x.stroke(); }
      x.fillStyle = '#02070a'; x.beginPath(); x.moveTo(0, 200); x.lineTo(40, 170); x.lineTo(90, 200); x.fill(); x.fillRect(150, 150, 3, 50); x.beginPath(); x.moveTo(151, 150); x.lineTo(146, 130); x.lineTo(152, 120); x.lineTo(160, 126); x.lineTo(158, 150); x.fill(); // a reaching hand
    },
    trap(x, R) {
      vgrad(x, DW, DH, [[0, '#0d0907'], [1, '#2a1a10']]); glow(x, 70, 40, 120, '255,140,50', 0.35);
      x.fillStyle = '#080604'; x.fillRect(0, 150, DW, 50);
      x.strokeStyle = '#8a8a90'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(0, 138); x.lineTo(DW, 148); x.stroke();
      for (let i = 0; i < 16; i++) { const px = 10 + i * 20, py = 138 + (px / DW) * 10; x.strokeStyle = '#b8b8c0'; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 3, py - 7); x.moveTo(px, py); x.lineTo(px - 3, py + 7); x.stroke(); }
      x.fillStyle = '#04030a'; x.fillRect(200, 100, 18, 52); x.fillRect(196, 148, 30, 8); // the boot that found it
      x.fillStyle = 'rgba(160,20,16,.35)'; x.fillRect(0, 0, DW, DH);
    },
    bolt(x, R) {
      vgrad(x, DW, DH, [[0, '#1a2420'], [1, '#2a3a30']]);
      for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(200,220,210,${0.05 + i * 0.01})`; x.fillRect(0, 60 + i * 18, DW, 12); }
      for (let i = 0; i < 6; i++) { x.fillStyle = '#0a110d'; const px = 10 + i * 56 + R() * 20; x.fillRect(px, 0, 8, DH); for (let k = 0; k < 10; k++) { x.strokeStyle = '#142014'; x.beginPath(); x.moveTo(px + 4, R() * 60); x.quadraticCurveTo(px + 4 + (R() - 0.5) * 50, 100, px + (R() - 0.5) * 40, 160); x.stroke(); } }
      figure(x, 30, 160, 48, '#050806'); x.strokeStyle = '#050806'; x.lineWidth = 2; x.beginPath(); x.moveTo(24, 130); x.lineTo(44, 128); x.stroke();
      x.strokeStyle = '#d8d0b0'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(40, 128); x.lineTo(270, 126); x.stroke(); // the bolt, in flight
      x.fillStyle = '#d8d0b0'; x.beginPath(); x.moveTo(270, 126); x.lineTo(258, 122); x.lineTo(258, 130); x.fill();
    },
    grapnel(x, R) {
      vgrad(x, DW, DH, [[0, '#1c2226'], [1, '#0a0e10']]);
      for (let i = 0; i < 5; i++) { x.fillStyle = `rgba(190,210,220,${0.06})`; x.fillRect(0, 40 + i * 30, DW, 20); }
      x.fillStyle = '#0a0806'; x.fillRect(0, 150, DW, 50); x.fillStyle = '#3a2a18'; x.fillRect(0, 144, DW, 7);
      x.strokeStyle = '#8a7a58'; x.lineWidth = 3; x.beginPath(); x.moveTo(DW, 60); x.quadraticCurveTo(220, 100, 168, 142); x.stroke();
      x.strokeStyle = '#c0c0c8'; x.lineWidth = 2; x.beginPath(); x.moveTo(168, 142); x.lineTo(162, 128); x.moveTo(168, 142); x.lineTo(180, 130); x.moveTo(168, 142); x.lineTo(160, 150); x.stroke(); // the hook
      figure(x, 90, 190, 70, '#04050a'); x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(0, 0, DW, DH);
    },
    beast(x, R, sprite) {
      vgrad(x, DW, DH, [[0, '#0a0a0e'], [1, '#18141a']]);
      for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(200,210,220,${R() * 0.12})`; x.fillRect(R() * DW, R() * DH, 8 + R() * 30, 1); } // static
      glow(x, 215, 100, 90, '150,180,255', 0.18);
      spriteLayer(x, sprite, 215, 196, 170, 1) || (x.fillStyle = '#04040a', x.beginPath(), x.ellipse(215, 120, 50, 40, 0, 0, 6.3), x.fill());
      x.fillStyle = '#e8ecff'; x.fillRect(196, 96, 4, 3); x.fillRect(220, 96, 4, 3);
    },
    soldier(x, R, sprite) {
      vgrad(x, DW, DH, [[0, '#0e0a14'], [1, '#1c1424']]);
      for (let i = 0; i < 5; i++) { x.fillStyle = '#0a0710'; x.fillRect(20 + i * 62, 0, 10, DH); }
      glow(x, 215, 90, 100, '190,130,255', 0.25);
      spriteLayer(x, sprite, 215, 198, 180, 1);
    },
    golem(x, R, sprite) {
      vgrad(x, DW, DH, [[0, '#120a06'], [1, '#2a160a']]); glow(x, 215, 130, 110, '255,120,40', 0.4);
      for (let i = 0; i < 12; i++) { x.fillStyle = `rgba(220,220,220,${0.06 + R() * 0.1})`; x.beginPath(); x.arc(100 + R() * 200, 40 + R() * 100, 14 + R() * 22, 0, 6.3); x.fill(); } // steam
      spriteLayer(x, sprite, 215, 198, 185, 1);
    },
    wearer(x, R, sprite) {
      vgrad(x, DW, DH, [[0, '#08100a'], [1, '#162014']]);
      for (let i = 1; i < 7; i++) { x.strokeStyle = `rgba(190,230,170,${0.3 - i * 0.04})`; x.beginPath(); x.arc(215, 100, i * 24, 0, 6.3); x.stroke(); } // your own voice, coming back
      spriteLayer(x, sprite, 215, 198, 180, 1);
    },
    quiet(x, R, sprite) {
      vgrad(x, DW, DH, [[0, '#101216'], [1, '#080a0c']]);
      glow(x, 215, 100, 110, '210,220,230', 0.12);
      x.fillStyle = '#000'; x.beginPath(); x.ellipse(215, 110, 46, 70, 0, 0, 6.3); x.fill(); for (let i = 0; i < 100; i++) { x.fillStyle = '#000'; x.fillRect(215 + (R() - 0.5) * 130, 110 + (R() - 0.5) * 160, 3, 3); }
    },
    found(x, R) { // the fallback: a hush-lamp guttering over an empty floor
      vgrad(x, DW, DH, [[0, '#120806'], [1, '#2a0c08']]); glow(x, 160, 120, 130, '255,110,50', 0.3);
      x.fillStyle = '#060303'; x.fillRect(0, 160, DW, 40); x.fillStyle = '#2a1a10'; x.fillRect(158, 100, 4, 60); glow(x, 160, 96, 30, '255,190,100', 0.7);
      figure(x, 230, 190, 70, '#050202');
    },
  };
  const ENEMY_DEATH = { hound: 'beast', mites: 'beast', legionnaire: 'soldier', proctor: 'soldier', golem: 'golem', wearer: 'wearer', quiet: 'quiet' };

  // death source -> { key, sprite }. Unknown, non-string and hostile sources land on 'found'.
  function deathKind(src) {
    if (typeof src !== 'string') return { key: 'found' };
    const s = src.slice(0, 200).toLowerCase();
    if (s === 'heartglass') return { key: 'heartglass' };
    if (s === 'unwrite') return { key: 'unwrite' };
    if (s === 'greening') return { key: 'greening' };
    if (s === 'the fall') return { key: 'fall' };
    if (s === 'the deep water') return { key: 'drown' };
    if (/tripwire|\btrap\b/.test(s)) return { key: 'trap' };
    if (/grapnel/.test(s)) return { key: 'grapnel' };
    if (/\bbolt\b/.test(s)) return { key: 'bolt' };
    try {
      for (const t of Object.keys(ENEMIES)) { const n = String(ENEMIES[t].name || '').toLowerCase(); if (n && s.indexOf(n) >= 0 && ENEMY_DEATH[t]) return { key: ENEMY_DEATH[t] + ':' + t, kind: ENEMY_DEATH[t], sprite: ENEMIES[t].sprite }; }
    } catch (e) { /* no catalogue */ }
    return { key: 'found' };
  }
  const deathCache = {};
  function deathURL(src) {
    const k = deathKind(src);
    if (deathCache[k.key]) return deathCache[k.key];
    const c = canvas(DW, DH), x = c.getContext('2d'), R = rng('death:' + k.key);
    missing = false;
    (DEATH[k.kind || k.key] || DEATH.found)(x, R, k.sprite);
    vignette(x, DW, DH, 0.6); grain(x, DW, DH, R, 700, 0.12);
    const url = c.toDataURL('image/png');
    if (!missing) deathCache[k.key] = url;
    return url;
  }
  let deathTok = 0;
  function applyDeath(src) {
    const el = document.getElementById('death'); if (!el) return;
    if (!on()) { el.classList.remove('scr-art', 'scr-painted'); el.style.removeProperty('background-image'); return; }
    const dk = deathKind(src), key = dk.key, pk = dk.kind || dk.key, tok = ++deathTok;
    const pim = paintedReady('death', pk);
    // the same dark wash sits over a painting so the text on top stays readable
    const wash = 'linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,.55))';
    if (pim) { el.style.backgroundImage = `${wash}, url("${PAINTED.url('death', pk)}")`; el.classList.add('scr-painted'); }
    else {
      el.style.backgroundImage = `${wash}, url("${deathURL(src)}")`; el.classList.remove('scr-painted');
      // not decoded yet: the screen stays up for a while, so swap the painting in when it arrives
      paintedLoad('death', pk).then((im) => { if (im && tok === deathTok && !el.classList.contains('hidden')) applyDeath(src); });
    }
    el.classList.add('scr-art'); el.dataset.scrDeath = key.split(':')[0];
  }

  // ---------------------------------------------------------------- endings (640x360 over ending.jpg)
  const EW = 640, EH = 360;
  const ENDING_ALT = {
    p2_answered: 'The Kestrel lifts from the burning, greening town on a rope full of children. Behind it, where the thing that wore your voice burst, a ring of ground lies dead silent.',
    p2_silent: 'The Kestrel lifts from the burning, greening town on a rope full of children. Over the Hedge, pale shapes of the town\'s dead rise in the mist, still speaking.',
    p2_plain: 'The Kestrel lifts from the burning, greening town on a rope full of children, while the whole town stands in the mud and waves it away.',
    b1_herald: 'A lone herald walks a mist-bound road at dusk with a lantern and a writ, nine miles to read it aloud, a crashed ship and the Mausoleum of Chords behind.',
    b1_follow: 'In the deep woods by the Mausoleum of Chords, a nine-foot bronze automaton stands beside Sable, holding a red choir cloak to its chest.',
    b1_calmed: 'In the Cloister of the Lost Choir an automaton kneels beneath eleven empty pegs, chiming to nobody, while the wrecked ship smokes in the woods beyond.',
    b1_destroyed: 'In the deep woods, scattered bronze plates from a broken automaton, and a red choir cloak folded on the ground.',
    b1_none: 'The deep woods at dusk by the Mausoleum of Chords, a wrecked ship smoking, and an empty alcove with eleven bare pegs.',
  };
  const ENDING_FALLBACK_ALT = 'The Oakhaven oaks over the burning town, and a skyship leaving.';

  function crowd(x, n, R, col) { for (let i = 0; i < n; i++) { const px = 6 + (i / n) * 308 + R() * 4; figure(x, px, 176 + R() * 4, 9 + R() * 4, col); if (R() < 0.35) { x.strokeStyle = col; x.lineWidth = 1; x.beginPath(); x.moveTo(px + 2, 168); x.lineTo(px + 6, 160 - R() * 4); x.stroke(); } } }
  const END = {
    p2(x, R, v) {
      // the rope down from the ship, children climbing four to a line
      x.strokeStyle = 'rgba(30,22,12,.9)'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(248, 40); x.quadraticCurveTo(238, 110, 214, 168); x.stroke();
      for (let i = 0; i < 8; i++) { const t = 0.12 + i * 0.1, px = 248 - 34 * t - 10 * Math.sin(t * 3) + 0, py = 40 + 128 * t; x.fillStyle = '#0a0806'; x.beginPath(); x.arc(px, py - 3, 1.4, 0, 6.3); x.fill(); x.fillRect(px - 1.2, py - 2, 2.4, 4); }
      crowd(x, 56, R, 'rgba(6,10,6,.92)');
      if (v === 'p2_answered') { // a patch where no sound carries: the colour leaves the ground
        const g = x.createRadialGradient(70, 120, 6, 70, 120, 70); g.addColorStop(0, 'rgba(10,10,12,.8)'); g.addColorStop(0.7, 'rgba(60,60,64,.35)'); g.addColorStop(1, 'rgba(60,60,64,0)'); x.fillStyle = g; x.fillRect(0, 50, 150, 130);
        for (let i = 1; i < 4; i++) { x.strokeStyle = `rgba(200,200,210,${0.3 - i * 0.07})`; x.beginPath(); x.arc(70, 120, i * 16, 0, 6.3); x.stroke(); }
      } else if (v === 'p2_silent') { // the Hedge speaking in the town's dead voices
        for (let i = 0; i < 9; i++) { const px = 40 + i * 14 + R() * 6, base = 150 - R() * 20; x.strokeStyle = `rgba(200,235,225,${0.18 + R() * 0.2})`; x.lineWidth = 2; x.beginPath(); x.moveTo(px, base); x.bezierCurveTo(px - 8, base - 20, px + 8, base - 34, px, base - 52 - R() * 20); x.stroke(); x.fillStyle = `rgba(215,240,230,.35)`; x.beginPath(); x.ellipse(px, base - 56 - R() * 10, 2.6, 3.4, 0, 0, 6.3); x.fill(); }
      }
    },
    b1(x, R, v) {
      tint(x, EW / 2, EH / 2, '#9ab0d0', 'multiply', 0.55); // the same sky, gone to dusk
      vgrad(x, 320, 180, [[0, 'rgba(8,14,26,.25)'], [0.55, 'rgba(0,0,0,0)'], [1, 'rgba(4,6,8,.6)']]);
      for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(230,235,255,${0.2 + R() * 0.5})`; x.fillRect(R() * 320, R() * 60, 1, 1); }
      ridge(x, 320, 118, 5, '#0b1218', R, 8);
      // the Mausoleum of Chords: pediment and columns
      x.fillStyle = '#0a0f14'; x.beginPath(); x.moveTo(164, 98); x.lineTo(206, 80); x.lineTo(248, 98); x.fill(); x.fillRect(166, 98, 80, 4); for (let i = 0; i < 6; i++) x.fillRect(170 + i * 14, 102, 5, 34); x.fillRect(162, 136, 88, 5);
      // the wrecked ship, nose in the woods, smoking
      x.fillStyle = '#10161c'; x.beginPath(); x.ellipse(70, 128, 34, 9, -0.25, 0, 6.3); x.fill(); x.strokeStyle = '#10161c'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(52, 124); x.lineTo(44, 96); x.moveTo(78, 120); x.lineTo(96, 100); x.stroke();
      for (let i = 0; i < 7; i++) { x.fillStyle = `rgba(150,160,170,${0.2 - i * 0.02})`; x.beginPath(); x.arc(58 + i * 4 + R() * 4, 112 - i * 9, 5 + i * 1.6, 0, 6.3); x.fill(); }
      x.fillStyle = '#05080a'; x.fillRect(0, 150, 320, 30);
      for (let i = 0; i < 3; i++) tree(x, 12 + i * 34, 180, 70 + R() * 20, '#05080a', '#06100a', R);
      glow(x, 260, 140, 80, '170,195,235', 0.3); // mist behind the subject so a dark figure reads
      x.save(); x.translate(100, 0); // subjects sit in the right third: the story text covers the left
      if (v === 'b1_herald') { // a road in mist, one lantern, one writ
        x.fillStyle = 'rgba(180,190,200,.08)'; x.fillRect(0, 138, 320, 22);
        x.fillStyle = '#10161a'; x.beginPath(); x.moveTo(130, 180); x.lineTo(190, 180); x.lineTo(168, 130); x.lineTo(152, 130); x.fill();
        figure(x, 160, 166, 34, '#030405'); x.fillStyle = '#e8d9b5'; x.fillRect(166, 148, 3, 7); x.strokeStyle = '#030405'; x.beginPath(); x.moveTo(162, 150); x.lineTo(167, 148); x.stroke();
        glow(x, 176, 150, 40, '255,190,100', 0.7); x.fillStyle = '#ffd890'; x.fillRect(175, 146, 3, 4);
        x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.moveTo(158, 168); x.lineTo(120, 176); x.lineTo(130, 178); x.lineTo(162, 170); x.fill();
      } else if (v === 'b1_follow') {
        x.fillStyle = '#05080a'; x.fillRect(142, 114, 20, 6); x.fillRect(146, 118, 12, 46); x.fillRect(142, 124, 6, 26); x.fillRect(158, 124, 6, 26); x.beginPath(); x.arc(152, 108, 7, 0, 6.3); x.fill(); x.fillRect(148, 164, 4, 14); x.fillRect(154, 164, 4, 14);
        x.fillStyle = '#9a1c18'; x.fillRect(150, 130, 8, 16); x.fillStyle = '#c42a22'; x.fillRect(150, 130, 8, 3);
        figure(x, 182, 178, 26, '#030405'); glow(x, 152, 140, 40, '255,110,80', 0.18);
      } else if (v === 'b1_calmed') {
        x.fillStyle = '#05080a'; x.fillRect(100, 118, 120, 3); for (let i = 0; i < 11; i++) { x.fillStyle = '#1a2026'; x.fillRect(104 + i * 10.4, 118, 2, 9); }
        x.fillStyle = '#05080a'; x.beginPath(); x.arc(160, 150, 6, 0, 6.3); x.fill(); x.fillRect(154, 154, 14, 18); x.fillRect(146, 164, 30, 7); x.fillRect(172, 150, 4, 16);
        glow(x, 160, 140, 50, '200,210,255', 0.2);
      } else if (v === 'b1_destroyed') {
        x.fillStyle = '#10161a'; for (let i = 0; i < 9; i++) { x.save(); x.translate(120 + R() * 80, 160 + R() * 14); x.rotate(R() * 3); x.fillRect(0, 0, 6 + R() * 12, 3 + R() * 6); x.restore(); }
        x.fillStyle = '#7a5a30'; x.beginPath(); x.arc(158, 166, 6, 0, 6.3); x.fill();
        x.fillStyle = '#9a1c18'; x.fillRect(170, 168, 14, 6); x.fillStyle = '#c42a22'; x.fillRect(170, 168, 14, 2);
      } else { // nobody sang to it: the alcove stays empty
        x.fillStyle = '#05080a'; arch(x, 150, 168, 70, 58, '#05080a'); x.fillStyle = '#0d1318'; arch(x, 150, 168, 54, 46, '#0d1318');
        for (let i = 0; i < 11; i++) { x.fillStyle = '#2a323a'; x.fillRect(128 + i * 4.4, 130 + ((i % 2) * 2), 1.6, 5); }
      }
      x.restore();
    },
  };
  // which painting does this ending get? Flags are read as truthy/falsy and nothing else.
  function endingVariant(kind, f, glassed) {
    f = (f && typeof f === 'object') ? f : {};
    let v;
    if (kind === 'p2') v = f.hedge_answered ? 'p2_answered' : f.hedge_silent ? 'p2_silent' : 'p2_plain';
    else v = f.part4 ? 'b1_herald' : (f.aegis_calmed && f.aegis_follow) ? 'b1_follow' : f.aegis_calmed ? 'b1_calmed' : f.aegis_destroyed ? 'b1_destroyed' : f.aegis_follow ? 'b1_follow' : 'b1_none';
    return { v, glassed: !!glassed };
  }
  function glassVeins(x, R) { // the tideline: glass veining up from the corner of the picture (320x180 space)
    for (let i = 0; i < 14; i++) { const px = 8 + i * 5 + R() * 4, h = 14 + R() * 26; x.fillStyle = `rgba(110,255,220,${0.25 + R() * 0.3})`; x.beginPath(); x.moveTo(px, 180); x.lineTo(px + 2, 180 - h); x.lineTo(px + 4, 180); x.fill(); }
    glow(x, 40, 176, 70, '90,255,210', 0.25);
  }
  // A painted ending, with the glass tideline drawn over it for a glassed player. A canvas that
  // cannot be exported (file:// taint) just shows the plain painting.
  function paintedEndingURL(v, im, glassed) {
    if (!glassed) return PAINTED.url('ending', v);
    try {
      const c = canvas(1280, 720), x = c.getContext('2d'); PAINTED.drawCover(x, im, 1280, 720);
      x.save(); x.scale(4, 4); glassVeins(x, rng('end:' + v + '+glass')); x.restore();
      return c.toDataURL('image/jpeg', 0.9);
    } catch (e) { return PAINTED.url('ending', v); }
  }
  const endCache = {};
  function endingURL(kind, f, glassed) {
    const o = endingVariant(kind, f, glassed), key = o.v + (o.glassed ? '+glass' : '');
    if (endCache[key]) return { url: endCache[key], key: o.v };
    const c = canvas(EW, EH), x = c.getContext('2d'), R = rng('end:' + key);
    missing = false;
    const im = img('ending.jpg');
    if (im) { x.imageSmoothingEnabled = false; x.drawImage(im, 0, 0, EW, EH); } else { missing = true; vgrad(x, EW, EH, [[0, '#13200f'], [1, '#4d5e22']]); }
    x.save(); x.scale(2, 2);
    END[kind](x, R, o.v);
    if (o.glassed) glassVeins(x, R);
    x.restore();
    vignette(x, EW, EH, 0.35);
    const url = c.toDataURL('image/jpeg', 0.88);
    if (!missing) endCache[key] = url;
    return { url, key: o.v };
  }
  function applyEnding(kind) {
    const el = document.querySelector('#ending img.bg'); if (!el) return;
    if (!on()) { if (el.dataset.scrOrig) { el.src = el.dataset.scrOrig; el.alt = ''; delete el.dataset.scrOrig; delete el.dataset.scrEnding; delete el.dataset.scrPainted; } return; }
    let glassed = false; try { glassed = !!(G.player && G.player.glassed); } catch (e) { /* none */ }
    const v = endingVariant(kind, G.flags, glassed).v, pim = paintedReady('ending', v);
    const r = pim ? { url: paintedEndingURL(v, pim, glassed), key: v } : endingURL(kind, G.flags, glassed);
    if (!el.dataset.scrOrig) el.dataset.scrOrig = el.getAttribute('src') || 'img/ending.jpg';
    el.src = r.url; el.alt = ENDING_ALT[r.key] || ENDING_FALLBACK_ALT; el.dataset.scrEnding = r.key;
    if (pim) el.dataset.scrPainted = '1'; else delete el.dataset.scrPainted;
    if (!pim) paintedLoad('ending', v).then((im) => { if (im && typeof G !== 'undefined' && G.state === 'ending') applyEnding(kind); });
  }

  // ---------------------------------------------------------------- style
  const css = `
#scr-card { position: absolute; inset: 0; z-index: 2; pointer-events: none; background: #000; opacity: 0; visibility: hidden; overflow: hidden; }
#scr-card.show { visibility: visible; }
#scr-card canvas { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; transform-origin: 50% 60%; }
#scr-card .scr-shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.15) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,.6) 100%); }
#scr-card .scr-name { position: absolute; left: 0; right: 0; bottom: 14cqh; text-align: center; font-family: var(--font-display); color: var(--gold); font-size: 4.4cqw; letter-spacing: .12em; text-shadow: 0 .4cqh 1.2cqh #000, 0 0 2cqh #000; padding: 0 6cqw; }
#scr-card .scr-name::after { content: ""; display: block; width: 22cqw; height: 1px; margin: 1.4cqh auto 0; background: linear-gradient(90deg, transparent, var(--gold-dim), transparent); }
#scr-card.on { opacity: 1; animation: scr-hold .52s ease-out both; }
#scr-card.on canvas { animation: scr-drift .52s ease-out both; }
#scr-card.held, #scr-card.held canvas { animation: none !important; }
#scr-card.held { opacity: 1; }
#scr-card.off { opacity: 0; transition: opacity .15s linear; }
#scr-card.rm.on { animation: scr-fade .52s linear both; }
#scr-card.rm.on canvas { animation: none; }
@keyframes scr-hold { 0%, 55% { opacity: 1; } 100% { opacity: 0; } }
@keyframes scr-fade { 0% { opacity: 1; } 100% { opacity: 0; } }
@keyframes scr-drift { from { transform: scale(1.06); } to { transform: scale(1); } }
#scr-card canvas.painted { image-rendering: auto; }
#death.scr-painted { image-rendering: auto; }
#death.scr-art { background-size: cover, cover; background-position: center, center; background-repeat: no-repeat; image-rendering: pixelated; }
.death-inner { position: relative; }
`;
  function inject() {
    if (document.getElementById('screens-style')) return;
    const s = document.createElement('style'); s.id = 'screens-style'; s.textContent = css; document.head.appendChild(s);
  }

  // ---------------------------------------------------------------- wrap the game
  function wrap() {
    inject();
    if (typeof loadMap === 'function') {
      const _loadMap = loadMap;
      loadMap = function (id, pos) {
        const prev = typeof G !== 'undefined' ? G.mapId : null, wasPlay = typeof G !== 'undefined' && G.state === 'play';
        const r = _loadMap.apply(this, arguments);
        try { if (wasPlay && shouldShow(prev, id)) showArea(id); } catch (e) { console.warn('screens: area card failed', e); }
        return r;
      };
    }
    if (typeof die === 'function') {
      const _die = die;
      die = function (src) {
        const was = typeof G !== 'undefined' && G.dead;
        const r = _die.apply(this, arguments);
        try { if (!was) applyDeath(src); } catch (e) { console.warn('screens: death art failed', e); }
        return r;
      };
    }
    if (typeof ending === 'function') {
      const _ending = ending;
      ending = function () {
        const was = typeof G !== 'undefined' && G.state === 'ending';
        const r = _ending.apply(this, arguments);
        try { if (!was) applyEnding('p2'); } catch (e) { console.warn('screens: ending art failed', e); }
        return r;
      };
    }
    if (typeof bookOneEnd1 === 'function') {
      const _b1 = bookOneEnd1;
      bookOneEnd1 = function () {
        const was = typeof G !== 'undefined' && G.state === 'ending';
        const r = _b1.apply(this, arguments);
        try { if (!was) applyEnding('b1'); } catch (e) { console.warn('screens: ending art failed', e); }
        return r;
      };
    }
    // warm the pictures the endings use so the first ending is already finished
    img('ending.jpg'); img('title.jpg'); img('map_woods.jpg');
  }
  try { wrap(); } catch (e) { console.warn('screens: not installed', e); }

  const api = {
    hold: false,
    familyFor, deathKind, endingVariant, ENDING_ALT, FAMILY, DEATH_KEYS: Object.keys(DEATH), END_KEYS: Object.keys(ENDING_ALT),
    areaCanvas, deathURL, endingURL, showArea, dismiss, applyDeath, applyEnding,
    caches: { area: areaCache, death: deathCache, ending: endCache },
  };
  return api;
})();
