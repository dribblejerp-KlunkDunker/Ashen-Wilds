// frames — Phase 5 (illustrated interface) module. Owned by the FRAMES team; see ROADMAP.md.
// Carved-wood panel frames with brass corner pieces on every panel, the title, death and ending screens
// and the canvas HUD bar; the bundled blackletter on titles and panel headings; a Credits panel for the fonts.
// All art is procedural stand-in work (a seeded wood-grain painter and SVG brass), generated once and cached.
// Switch: GFX.carvedFrames (default on). Off = the original look: no class on #game, no overlay, no Credits row.
'use strict';
const FRAMES = (function () {
  if (typeof GFX !== 'undefined' && GFX.carvedFrames === undefined) GFX.carvedFrames = true;   // deliberately not in GFX.FX

  const enabled = () => typeof GFX !== 'undefined' && GFX.carvedFrames !== false;

  // ---- procedural stand-in art ---------------------------------------------------------------
  function prng(seed) {   // small deterministic generator so the wood is the same every load
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // Walnut grain: bands that wander along the length of the board. vertical = the grain runs top to bottom.
  const WOOD_LO = [58, 38, 22], WOOD_HI = [146, 104, 60];
  function woodCanvas(w, h, vertical, seed) {
    const c = makeCanvas(w, h), x = c.getContext('2d'), img = x.createImageData(w, h), r = prng(seed);
    const f1 = 0.55 + r() * 0.5, f2 = 1.3 + r() * 0.9, p1 = r() * 6.28, p2 = r() * 6.28, w1 = 0.03 + r() * 0.03;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const along = vertical ? j : i, across = vertical ? i : j;
      const v = Math.sin(across * f1 + Math.sin(along * w1 + p1) * 2.4) * 0.5 + Math.sin(across * f2 + p2 + Math.sin(along * 0.13) * 1.2) * 0.28 + (r() - 0.5) * 0.3;
      const t = Math.max(0, Math.min(1, 0.5 + v * 0.5)), o = (j * w + i) * 4;
      for (let k = 0; k < 3; k++) img.data[o + k] = WOOD_LO[k] + (WOOD_HI[k] - WOOD_LO[k]) * t;
      img.data[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  // 64x64 nine-slice ring (slice 16): mitred boards, an outer bevel, a carved groove and a dark inner lip.
  const SLICE = 16, SIZE = 64;
  let frameUrl = null;
  function frameDataUrl() {
    if (frameUrl) return frameUrl;
    const c = makeCanvas(SIZE, SIZE), x = c.getContext('2d');
    const top = woodCanvas(SIZE, SLICE, false, 11), side = woodCanvas(SLICE, SIZE, true, 29);
    const S = SIZE, B = SLICE;
    const bands = [
      [[0, 0], [S, 0], [S - B, B], [B, B], top, 0, 0],
      [[0, S], [S, S], [S - B, S - B], [B, S - B], top, 0, S - B],
      [[0, 0], [0, S], [B, S - B], [B, B], side, 0, 0],
      [[S, 0], [S, S], [S - B, S - B], [S - B, B], side, S - B, 0]
    ];
    for (const [a, b, d, e, img, ox, oy] of bands) {
      x.save(); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.lineTo(d[0], d[1]); x.lineTo(e[0], e[1]); x.closePath(); x.clip();
      x.drawImage(img, ox, oy); x.restore();
    }
    const ring = (inset, col, wd) => { x.strokeStyle = col; x.lineWidth = wd; x.strokeRect(inset, inset, S - inset * 2, S - inset * 2); };
    ring(0.75, 'rgba(214,170,96,.8)', 1.5);        // lit outer edge
    ring(6, 'rgba(8,5,3,.6)', 2);            // carved groove
    ring(8, 'rgba(240,200,130,.3)', 1.2);     // groove's lit lip
    ring(15, 'rgba(6,4,3,.9)', 2);          // dark inner lip against the panel
    frameUrl = c.toDataURL('image/png');
    return frameUrl;
  }

  // Brass corner bracket as SVG; fx/fy mirror it into the four corners.
  const brassUrls = {};
  function brassDataUrl(fx, fy) {
    const key = (fx ? 'r' : 'l') + (fy ? 'b' : 't');
    if (brassUrls[key]) return brassUrls[key];
    const tf = `translate(${fx ? 32 : 0} ${fy ? 32 : 0}) scale(${fx ? -1 : 1} ${fy ? -1 : 1})`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6dc8e"/><stop offset=".5" stop-color="#c79a3e"/><stop offset="1" stop-color="#6e4f18"/></linearGradient></defs><g transform="${tf}"><path d="M1 1H31V8H9V31H1Z" fill="url(#g)" stroke="#2c1d06" stroke-width="1.2"/><path d="M3 3H29" stroke="#fbeaa8" stroke-width=".8" opacity=".8"/><circle cx="5" cy="5" r="2.6" fill="#2c1d06"/><circle cx="4.6" cy="4.6" r="1.4" fill="#e9c66b"/><circle cx="20" cy="4.5" r="1.3" fill="#2c1d06"/><circle cx="4.5" cy="20" r="1.3" fill="#2c1d06"/></g></svg>`;
    brassUrls[key] = 'data:image/svg+xml,' + encodeURIComponent(svg);
    return brassUrls[key];
  }

  // ---- the canvas HUD overlay ------------------------------------------------------------------
  // Drawn over the bar (320x50 at y 150) after the original: wood rails on the empty edges and brass corner plates.
  // Nothing here touches the button, vital, status or compass rectangles (the test checks that).
  const BAR_H = 50;
  let hudCanvas = null;
  function hudOverlay() {
    if (hudCanvas) return hudCanvas;
    const W = 320, c = makeCanvas(W, BAR_H), x = c.getContext('2d');
    const rail = woodCanvas(W, 4, false, 53), side = woodCanvas(3, BAR_H, true, 71);
    x.drawImage(rail, 0, 0);                      // top rail, rows 0-3
    x.fillStyle = 'rgba(214,170,96,.9)'; x.fillRect(0, 0, W, 1);
    x.fillStyle = 'rgba(8,5,3,.85)'; x.fillRect(0, 2, W, 1);
    x.fillStyle = 'rgba(240,200,130,.3)'; x.fillRect(0, 1, W, 1);
    x.fillStyle = '#0b0806'; x.fillRect(0, 3, W, 1);
    x.drawImage(side, 0, 0, 2, BAR_H, 0, 0, 2, BAR_H);           // left rail
    x.drawImage(side, 0, 0, 3, BAR_H, W - 3, 0, 3, BAR_H);       // right rail
    x.fillStyle = 'rgba(8,5,3,.8)'; x.fillRect(1, 4, 1, BAR_H - 4); x.fillRect(W - 3, 4, 1, BAR_H - 4);
    // brass rivets between the clusters of the bar
    for (const rx of [44, 153, 224]) { x.fillStyle = '#2c1d06'; x.fillRect(rx - 1, 0, 3, 3); x.fillStyle = '#e9c66b'; x.fillRect(rx, 1, 1, 1); }
    // corner plates: 7 wide arms along the rails, 5 tall at the top and bottom
    const plate = (px, py, w, h, armX, armY, mx, my) => {
      x.fillStyle = '#2c1d06'; x.fillRect(px - 1 + (mx ? 1 : 0), py - 1 + (my ? 1 : 0), w + 1, h + 1);
      const g = x.createLinearGradient(px, py, px + w, py + h); g.addColorStop(0, '#f2d487'); g.addColorStop(0.55, '#c79a3e'); g.addColorStop(1, '#7a5a1c');
      x.fillStyle = g; x.fillRect(px, py, w, h);
      x.fillStyle = '#2c1d06'; x.fillRect(armX, armY, 1, 1);
    };
    plate(0, 0, 6, 5, 2, 2, false, false);
    plate(W - 5, 0, 5, 5, W - 3, 2, true, false);
    plate(0, BAR_H - 5, 6, 5, 2, BAR_H - 3, false, true);
    plate(W - 5, BAR_H - 5, 5, 5, W - 3, BAR_H - 3, true, true);
    hudCanvas = c;
    return c;
  }

  // ---- styles -----------------------------------------------------------------------------------
  const NOISE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect width='8' height='8' fill='%23241b14'/%3E%3Crect x='0' y='0' width='1' height='1' fill='%232c2219'/%3E%3Crect x='4' y='4' width='1' height='1' fill='%231c1510'/%3E%3C/svg%3E\")";
  function brassLayers() {
    const s = 'var(--fr-brass) var(--fr-brass) no-repeat';
    return `url("${brassDataUrl(0, 0)}") left top / ${s}, url("${brassDataUrl(1, 0)}") right top / ${s}, url("${brassDataUrl(0, 1)}") left bottom / ${s}, url("${brassDataUrl(1, 1)}") right bottom / ${s}`;
  }
  function css() {
    const fr = `url("${frameDataUrl()}") ${SLICE} / var(--fr-bw) stretch`;
    const SEL = '#game.carved';
    return `
${SEL} { --fr-brass: min(2.6cqw, 3.6cqh); --fr-bw: max(5px, .78cqw); }
/* wooden frame + brass corners on every panel (modal, event, creation); the interior keeps its original fill */
${SEL} .panel { border: var(--fr-bw) solid transparent; border-image: ${fr}; background: ${brassLayers()}, ${NOISE} var(--panel); box-shadow: 0 0 0 2px #000, 0 0 40px rgba(0,0,0,.8), inset 0 0 0 1px rgba(0,0,0,.55); }
/* the title and ending screens are framed at the screen edge, over their existing shading */
${SEL} .title-inner { border: var(--fr-bw) solid transparent; border-image: ${fr}; background: ${brassLayers()}, linear-gradient(180deg, rgba(0,0,0,.0) 0%, rgba(0,0,0,.55) 25%, rgba(0,0,0,.75) 100%); }
${SEL} .ending-inner { border: var(--fr-bw) solid transparent; border-image: ${fr}; background: ${brassLayers()}, linear-gradient(90deg, rgba(0,0,0,.85) 0%, rgba(0,0,0,.75) 55%, rgba(0,0,0,.2) 100%); }
${SEL} .death-inner { border: var(--fr-bw) solid transparent; border-image: ${fr}; padding: 2.4cqh 2.4cqw; background: ${brassLayers()}, ${NOISE} #1a1210; box-shadow: 0 0 0 2px #000, 0 0 40px rgba(0,0,0,.8); }
/* buttons keep their bevel; the lit edge turns brass */
${SEL} .dfbtn { border-color: #a3813f #2a1c0c #2a1c0c #a3813f; }
${SEL} .dfbtn:active { border-color: #2a1c0c #a3813f #a3813f #2a1c0c; }
${SEL} #party, ${SEL} #touchui .tb { border-color: #a3813f #2a1c0c #2a1c0c #a3813f; }
${SEL} .dlg .port img, ${SEL} .panel .faces img { border-color: #6e5428; }
${SEL} .panel .faces img.sel { border-color: var(--gold); }
/* blackletter for titles and panel headings only; Cinzel is the fallback, h3 and body text are untouched */
${SEL} .title-inner h1, ${SEL} .panel h2, ${SEL} .death-inner h2, ${SEL} .ending-inner h2 { font-family: var(--font-blackletter); font-weight: 400; letter-spacing: .01em; }
${SEL} .title-inner h1 { font-size: 6.8cqw; }
${SEL} .panel h2 { font-size: 3.7cqw; }
${SEL} .death-inner h2, ${SEL} .ending-inner h2 { font-size: 5.4cqw; }
${SEL} .panel.credits td { vertical-align: top; }
${SEL} .panel.credits .lic { margin-top: 1cqh; }
`;
  }
  let styleEl = null;
  function injectStyle() {
    if (styleEl || typeof document === 'undefined') return;
    styleEl = document.createElement('style'); styleEl.id = 'frames-style'; styleEl.textContent = css();
    document.head.appendChild(styleEl);
  }

  // keep the class on #game in step with the switch (also checked whenever a screen is shown)
  function sync() {
    const g = document.getElementById('game'); if (!g) return enabled();
    g.classList.toggle('carved', enabled());
    return enabled();
  }
  function setEnabled(v) { GFX.carvedFrames = !!v; if (typeof GFX.changed === 'function') GFX.changed(); else sync(); }

  // ---- credits ------------------------------------------------------------------------------------
  // constants only: nothing here comes from a save
  const CREDITS = [
    ['Cinzel', 'The Cinzel Project Authors', 'capital-letter labels and buttons'],
    ['Alegreya', 'The Alegreya Project Authors', 'body text'],
    ['Alegreya SC', 'The Alegreya Project Authors', 'small capitals'],
    ['UnifrakturMaguntia', "j. 'mach' wust and Peter Wiegel", 'blackletter, titles and headings only']
  ];
  const LICENCE = 'All four fonts are bundled with the game and licensed under the SIL Open Font License, Version 1.1. The full licence texts ship in the fonts folder (OFL-*.txt). The frames, brass and wood grain are drawn in code.';
  function renderCredits() {
    const rows = CREDITS.map(([n, who, use]) => `<tr><td><b>${n}</b></td><td>${who}</td><td class="muted">${use}</td></tr>`).join('');
    openModal(`<h2>Credits</h2><button class="dfbtn small close" id="x">Close</button>
    <p class="muted">Typefaces used in this game.</p>
    <table class="credits-table">${rows}</table>
    <p class="lic" id="fr-licence">${LICENCE}</p>
    <div class="btns"><button class="dfbtn small" id="fr-back">Back to Graphics &amp; access</button></div>`, 'credits');
    const p = document.getElementById('modal-panel'); if (p) p.classList.add('credits');
    document.getElementById('x').onclick = () => { closeModal(); G.state = 'play'; };
    document.getElementById('fr-back').onclick = () => renderAccessibilityMenu();
  }
  function el(tag, props, text) {
    const e = document.createElement(tag);
    if (props) for (const k in props) e.setAttribute(k, props[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  // a row in the Graphics & access grid (Options itself gets no extra row: hardcore.test.js checks it fits)
  function appendCreditsRow() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById('fr-credits')) return;
    const lab = el('span', { class: 'gfx-label' }, 'Credits ');
    lab.appendChild(el('small', { class: 'muted' }, 'fonts and their open licence'));
    const b = el('button', { class: 'dfbtn small', id: 'fr-credits', type: 'button' }, 'Credits');
    b.onclick = () => renderCredits();
    grid.appendChild(lab); grid.appendChild(b);
  }

  // ---- wiring ---------------------------------------------------------------------------------------
  let rawDrawHUD = null;
  function wire() {
    if (typeof drawHUD === 'function') {
      const _drawHUD = drawHUD; rawDrawHUD = _drawHUD;
      drawHUD = function () {
        const r = _drawHUD.apply(this, arguments);
        try { if (sync() && G.player) Engine.ctx.drawImage(hudOverlay(), 0, VIEW_H); } catch (e) { console.warn('frames hud failed', e); }
        return r;
      };
    }
    if (typeof show === 'function') {
      const _show = show;
      show = function () { try { sync(); } catch (e) { /* class only */ } return _show.apply(this, arguments); };
    }
    if (typeof renderAccessibilityMenu === 'function') {
      const _acc = renderAccessibilityMenu;
      renderAccessibilityMenu = function () {
        const r = _acc.apply(this, arguments);
        try { if (enabled()) appendCreditsRow(); } catch (e) { console.warn('credits row failed', e); }
        return r;
      };
    }
    if (typeof GFX !== 'undefined' && GFX.onChange) GFX.onChange(sync);
  }

  injectStyle();
  wire();
  sync();
  return {
    enabled, sync, setEnabled, renderCredits, appendCreditsRow, hudOverlay, frameDataUrl, brassDataUrl, woodCanvas,
    CREDITS, LICENCE, BAR_H, SLICE,
    get rawDrawHUD() { return rawDrawHUD; },
    get styleText() { return styleEl ? styleEl.textContent : ''; }
  };
})();
if (typeof window !== 'undefined') window.FRAMES = FRAMES;
