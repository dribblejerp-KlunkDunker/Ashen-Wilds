// ============================================================
//  photo21 — Phase 21 "Wow", team CARD: the photo mode upgrade (on top of js/playtools.js's Phase 7 photo mode).
//
//  * FREE CAMERA. W A S D fly the camera up to 12 paces from where you stood (never into a wall), R / F raise and lower
//    it (over the walls when the 3D renderer is on), the arrows and a drag look around, and the look reaches as far up
//    and down as the renderer allows (R3D.camera.limit(): about 80 degrees under R3D; the old 40 rows on the raycaster).
//    Q / E still tilt, Z resets, H hides the bar, Esc leaves. Leaving puts everything back exactly (playtools does).
//  * NO HUD. The Phase 18 compositor's HUD layer is hidden too (the old photo mode only hid the DOM overlays).
//  * DEPTH OF FIELD, off by default: on, what is far from the centre's distance softens in the saved picture.
//  * FILTERS: None, the colour grades (from LIGHT21.photoGrades() when js/light21.js offers them, else this module's own
//    set), a vignette. Previewed live (a CSS filter on the view) and baked into the saved picture.
//  * SAVE SCREENSHOT: a PNG at the device's resolution (the game area's CSS size x devicePixelRatio), upscaled with
//    nearest-neighbour so the pixel art stays crisp, from whichever renderer is showing (R3D's canvas, the GPU
//    compositor's, or the CPU view). The world never changes: photo mode still holds every clock.
//  Switch: the free camera can be turned off in the bar ("Free camera: Off" = the Phase 7 dolly). Nothing here runs
//  outside photo mode. No saved fields; the bar's choices persist in localStorage 'octave.photo21.v1'.
// ============================================================
'use strict';

const PHOTO21 = (() => {
  const KEY = 'octave.photo21.v1';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const warned = {};
  const warnOnce = (k, e) => { if (warned[k]) return; warned[k] = true; console.warn('photo21 ' + k, e); };
  const B = { RADIUS: 12, SPEED: 2.6, RISE: 0.9, Z_MIN: 0.12, Z_CPU: 0.92, Z_R3D: 2.6, LOOK_KEY: 0.9 };   // LOOK_KEY: radians a second
  // the filters (CSS filter strings: the same string previews the view and bakes the picture)
  const OWN = [
    { id: 'none', label: 'None', css: '' },
    { id: 'warm', label: 'Warm dusk', css: 'sepia(0.22) saturate(1.18) hue-rotate(-6deg) brightness(1.04) contrast(1.04)' },
    { id: 'cold', label: 'Frost', css: 'saturate(0.78) hue-rotate(10deg) brightness(1.03) contrast(1.06)' },
    { id: 'vivid', label: 'Vivid', css: 'saturate(1.38) contrast(1.1)' },
    { id: 'print', label: 'Old print', css: 'sepia(0.85) contrast(1.12) brightness(0.98)' },
    { id: 'noir', label: 'Noir', css: 'grayscale(1) contrast(1.3) brightness(0.96)' },
    { id: 'hush', label: 'Hush', css: 'saturate(0.45) brightness(0.94) contrast(0.94)' },
  ];
  function filters() {
    try {
      if (typeof LIGHT21 === 'object' && LIGHT21 && typeof LIGHT21.photoGrades === 'function') {
        const g = LIGHT21.photoGrades();
        if (Array.isArray(g) && g.length) {
          // LIGHT's contract: [{ id, label, css }], css a plain CSS filter string ('l21-here' first: the grade of this map
          // and hour, then one per area grade, then the screenshot looks); anything else is dropped
          const ok = g.filter((x) => x && typeof x.id === 'string' && x.id.length < 40 && typeof x.label === 'string' && x.label.length < 60 && typeof x.css === 'string' && x.css.length < 300 && /^[a-z0-9().,%#\s-]*$/i.test(x.css) && !/url\s*\(/i.test(x.css)).slice(0, 40);
          if (ok.length) return [OWN[0]].concat(ok.filter((x) => x.id !== 'none'));
        }
      }
    } catch (e) { warnOnce('grades', e); }
    return OWN;
  }
  const HELP = 'Free camera · W A S D fly · R F up and down · arrows or drag look · Q E tilt · P saves a screenshot · Esc leaves';
  const S = { free: true, dof: false, filter: 'none', vignette: false, pitchRows: null, start: null, saves: 0, last: null, bar: null };
  try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && typeof o === 'object') { if (typeof o.free === 'boolean') S.free = o.free; if (typeof o.vignette === 'boolean') S.vignette = o.vignette; if (typeof o.filter === 'string') S.filter = o.filter; } } catch (e) { /* none */ }
  const saveCfg = () => { try { localStorage.setItem(KEY, JSON.stringify({ free: S.free, vignette: S.vignette, filter: S.filter })); } catch (e) { /* none */ } };
  const photoOn = () => typeof PLAYTOOLS === 'object' && PLAYTOOLS && PLAYTOOLS.photo && PLAYTOOLS.photo.on;
  const r3dOn = () => { try { return typeof R3D === 'object' && R3D && typeof R3D.active === 'function' && R3D.active(); } catch (e) { return false; } };
  // how far the look may go, in the camera's "pitch rows" (R3D's contract: pitch = FX * tan(angle))
  function pitchLimit() {
    try { if (typeof R3D === 'object' && R3D && R3D.camera && typeof R3D.camera.limit === 'function') { const a = R3D.camera.limit(); if (Number.isFinite(a) && a > 0) return Math.min(2000, (R3D.FX || 242.42) * Math.tan(Math.min(a, 1.45))); } } catch (e) { /* none */ }
    return 40;
  }
  function filterCss() { const f = filters().find((x) => x.id === S.filter) || OWN[0]; return f.css; }

  // ---------------------------------------------------------------- the free camera
  function walkable(x, y) {
    const m = G.map; if (!m) return false;
    for (const [dx, dy] of [[0, 0], [0.2, 0], [-0.2, 0], [0, 0.2], [0, -0.2]]) {
      const cx = Math.floor(x + dx), cy = Math.floor(y + dy);
      if (cx < 0 || cy < 0 || cx >= m.w || cy >= m.h) return false;
      // above the walls (R3D only) the camera may cross them
      if (m.isBlocked(cx, cy) && !(r3dOn() && Engine.cam.z > 1.15)) return false;
    }
    return true;
  }
  function fly(fwd, str) {
    const c = Engine.cam, o = S.start; if (!o) return false;
    const cs = Math.cos(c.dir), sn = Math.sin(c.dir);
    let nx = c.x + cs * fwd - sn * str, ny = c.y + sn * fwd + cs * str;
    const d = Math.hypot(nx - o.x, ny - o.y);
    if (d > B.RADIUS) { nx = o.x + (nx - o.x) * B.RADIUS / d; ny = o.y + (ny - o.y) * B.RADIUS / d; }
    let moved = false;
    if (walkable(nx, ny)) { c.x = nx; c.y = ny; moved = true; } else if (walkable(nx, c.y)) { c.x = nx; moved = true; } else if (walkable(c.x, ny)) { c.y = ny; moved = true; }
    // the Phase 7 dolly measures from its origin: keep it with the camera so it never pulls the camera back
    if (moved && PLAYTOOLS.photo.origin) { PLAYTOOLS.photo.origin.x = c.x; PLAYTOOLS.photo.origin.y = c.y; }
    return moved;
  }
  function rise(dz) {
    const c = Engine.cam, top = r3dOn() ? B.Z_R3D : B.Z_CPU;
    const nz = clamp(c.z + dz, B.Z_MIN, top);
    // never come down inside a wall when crossing over one
    if (nz <= 1.15 && G.map && G.map.isBlocked(Math.floor(c.x), Math.floor(c.y))) return;
    c.z = nz;
  }
  // the look is turned in angle space (R3D's: pitch rows = FX * tan(angle)), so it moves evenly up to the limit
  const FXv = () => (typeof R3D === 'object' && R3D && R3D.FX) || 160 / 0.66;
  const toA = (rows) => Math.atan(rows / FXv()), toRows = (a) => FXv() * Math.tan(a);
  function setPitch(rows) { const L = pitchLimit(); S.pitchRows = clamp(rows, -L, L); Engine.cam.pitch = S.pitchRows; }
  function turnPitch(da) { const cur = S.pitchRows == null ? Engine.cam.pitch : S.pitchRows, A = toA(pitchLimit()); setPitch(toRows(clamp(toA(cur) + da, -A, A))); }
  const MOVE_KEYS = ['w', 'a', 's', 'd', 'r', 'f', 'arrowup', 'arrowdown'];
  function step(dt, keys) {
    let fwd = 0, str = 0, up = 0, pit = 0;
    if (keys.w) fwd += 1; if (keys.s) fwd -= 1; if (keys.d) str += 1; if (keys.a) str -= 1;
    if (keys.r) up += 1; if (keys.f) up -= 1; if (keys.arrowup) pit += 1; if (keys.arrowdown) pit -= 1;
    if (fwd || str) fly(clamp(fwd, -1, 1) * B.SPEED * dt, clamp(str, -1, 1) * B.SPEED * dt);
    if (up) rise(up * B.RISE * dt);
    if (pit) turnPitch(pit * B.LOOK_KEY * dt);
  }
  // a drag looks up and down past the Phase 7 limit (this listener runs after playtools' own, so its value stands)
  let drag = null;
  function onPointer(ev) {
    if (!photoOn() || !S.free) return;
    const cv = Engine.canvas;
    if (ev.type === 'pointerdown') { if (ev.target !== cv && !(ev.target && ev.target.id === 'r3d21-gl')) return; drag = { y: ev.clientY, a: toA(S.pitchRows == null ? Engine.cam.pitch : S.pitchRows) }; }
    else if (ev.type === 'pointermove' && drag) {
      const r = cv.getBoundingClientRect(), dy = (ev.clientY - drag.y) / Math.max(1, r.height); drag.y = ev.clientY;
      const A = toA(pitchLimit()); drag.a = clamp(drag.a - dy * 2.2, -A, A); setPitch(toRows(drag.a));
    } else if (ev.type === 'pointerup' || ev.type === 'pointercancel') drag = null;
  }

  // ---------------------------------------------------------------- the picture
  // what the screen shows of the 3D view, as a canvas at the device's resolution
  function sourceCanvas() {
    try { if (r3dOn() && R3D.canvas) { const c = R3D.canvas(); if (c && c.width) return { cv: c, full: true }; } } catch (e) { /* CPU */ }
    try { if (typeof GPU18 === 'object' && GPU18 && GPU18.layers && document.getElementById('game').classList.contains('gpu18-on')) { const l = GPU18.layers(); if (l && l.gl && l.gl.width) return { cv: l.gl, full: true }; } } catch (e) { /* CPU */ }
    return { cv: Engine.canvas, full: false };
  }
  function deviceSize() {
    const game = document.getElementById('game'), r = game ? game.getBoundingClientRect() : { width: 1280, height: 800 };
    const dpr = clamp(window.devicePixelRatio || 1, 1, 4);
    // the 3D view's share of the game area (the HUD panel is below it)
    const vw = Math.max(1, Math.round(r.width * dpr)), vh = Math.max(1, Math.round(r.height * dpr * (Engine.VIEW_H / Engine.VH)));
    return { w: Math.min(vw, 7680), h: Math.min(vh, 4320) };
  }
  // render once (the world is held), then copy the view out of whichever canvas shows it
  function grab() {
    if (typeof ANIM !== 'undefined') ANIM.dt = 0;
    // R3D draws only inside the game's own render() (its frame is handed over there), and its canvas keeps the picture
    // only until the browser presents it: render through the game, then copy at once, in the same task
    if (r3dOn() && typeof render === 'function') render(); else Engine.render(G.ents, G.tod);
    const src = sourceCanvas(), D = deviceSize();
    const out = document.createElement('canvas'); out.width = D.w; out.height = D.h;
    const cx = out.getContext('2d'); cx.imageSmoothingEnabled = false;
    if (src.full) {
      // R3D / the compositor draw the whole game area: the view is the top VIEW_H / VH of it
      const sh = Math.round(src.cv.height * Engine.VIEW_H / Engine.VH);
      cx.drawImage(src.cv, 0, 0, src.cv.width, sh, 0, 0, D.w, D.h);
    } else {
      const s = Engine.getScale();
      cx.drawImage(src.cv, 0, 0, Engine.VW * s, Engine.VIEW_H * s, 0, 0, D.w, D.h);
    }
    return out;
  }
  // depth of field: the centre's distance stays sharp; nearer and farther soften (logical 320 x 150 depth)
  function applyDof(cv) {
    const w = cv.width, h = cv.height;
    let focus = null;
    try { focus = Engine.depthAt(160, 75); } catch (e) { focus = null; }
    if (!Number.isFinite(focus) || focus <= 0 || focus > 1e6) focus = 6;
    const blurred = document.createElement('canvas'); blurred.width = w; blurred.height = h;
    const bx = blurred.getContext('2d'); bx.filter = 'blur(' + Math.max(1, Math.round(w / 320 * 1.6)) + 'px)'; bx.drawImage(cv, 0, 0);
    const sharp = cv.getContext('2d').getImageData(0, 0, w, h), soft = bx.getImageData(0, 0, w, h), a = sharp.data, b = soft.data;
    const mask = new Float32Array(320 * 150);
    for (let y = 0; y < 150; y++) for (let x = 0; x < 320; x++) {
      let d = 1e9; try { d = Engine.depthAt(x, y); } catch (e) { d = 1e9; }
      if (!Number.isFinite(d)) d = 1e9;
      const k = Math.abs(Math.log(Math.max(0.2, d) / focus));
      mask[y * 320 + x] = clamp((k - 0.25) / 0.9, 0, 1);
    }
    for (let y = 0; y < h; y++) {
      const my = Math.min(149, (y * 150 / h) | 0);
      for (let x = 0; x < w; x++) {
        const m = mask[my * 320 + Math.min(319, (x * 320 / w) | 0)]; if (!m) continue;
        const i = (y * w + x) * 4; a[i] += (b[i] - a[i]) * m; a[i + 1] += (b[i + 1] - a[i + 1]) * m; a[i + 2] += (b[i + 2] - a[i + 2]) * m;
      }
    }
    cv.getContext('2d').putImageData(sharp, 0, 0);
    return cv;
  }
  function finish(cv) {
    const tilt = PLAYTOOLS.photo.tilt || 0, css = filterCss();
    let out = cv;
    if (S.dof) out = applyDof(out);
    if (tilt || css || S.vignette) {
      const w = out.width, h = out.height, o = document.createElement('canvas'); o.width = w; o.height = h;
      const x = o.getContext('2d'); x.imageSmoothingEnabled = false;
      if (css) x.filter = css;
      if (tilt) { const th = tilt * Math.PI / 180, k = Math.abs(Math.cos(th)) + (w / h) * Math.abs(Math.sin(th)); x.translate(w / 2, h / 2); x.rotate(th); x.scale(k, k); x.drawImage(out, -w / 2, -h / 2); x.setTransform(1, 0, 0, 1, 0, 0); }
      else x.drawImage(out, 0, 0);
      x.filter = 'none';
      if (S.vignette) { const g = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.55); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }
      out = o;
    }
    return out;
  }
  const toBlob = (cv) => new Promise((res) => { try { cv.toBlob((b) => res(b || null), 'image/png'); } catch (e) { res(null); } });
  function download(blob) {
    const a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = 'octave-' + String(G.mapId || 'world').replace(/[^a-z0-9_-]/gi, '') + '-' + Date.now().toString(36) + '.png';
    a.rel = 'noopener'; a.hidden = true; document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
  }
  async function screenshot() {
    if (!photoOn()) return null;
    let cv;
    try { cv = finish(grab()); } catch (e) { warnOnce('shot', e); say('The screenshot could not be taken.'); return null; }
    try { if (PLAYTOOLS.paintPhoto) PLAYTOOLS.paintPhoto(); } catch (e) { /* the preview repaints next frame */ }
    const blob = await toBlob(cv);
    if (!blob) { say('The screenshot could not be saved.'); return null; }
    S.last = { blob, w: cv.width, h: cv.height }; S.saves++;
    download(blob);
    say('Screenshot saved (' + cv.width + ' x ' + cv.height + ').');
    return blob;
  }

  // ---------------------------------------------------------------- the bar (extra row under playtools' own)
  function say(t) { try { const st = document.querySelector('#p7-photo-bar .p7-status'); if (st) st.textContent = t; } catch (e) { /* none */ } }
  // LIGHT's grades are asked for again each time photo mode opens ('l21-here' follows the map and hour); a stored
  // choice that no longer exists falls back to None
  function refreshFilter() {
    const F = filters(); if (!F.some((x) => x.id === S.filter)) S.filter = 'none';
    const b = document.getElementById('p21-filter'); if (b) b.textContent = 'Filter: ' + (F.find((x) => x.id === S.filter) || F[0]).label;
  }
  function preview() {
    const css = filterCss(), game = document.getElementById('game'); if (!game) return;
    game.style.setProperty('--p21-photo-filter', css || 'none');
    game.classList.toggle('p21-photo-vig', !!S.vignette);
  }
  function ensureBar() {
    const bar = document.getElementById('p7-photo-bar'); if (!bar || bar.querySelector('#p21-row')) return;
    const row = document.createElement('div'); row.className = 'p7-row'; row.id = 'p21-row';
    const mk = (id, label, fn, title) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'dfbtn small'; b.id = id; b.textContent = label; if (title) b.title = title; b.onclick = (ev) => { ev.stopPropagation(); fn(b); }; return b; };
    const shot = mk('p21-shot', 'Save screenshot', () => { screenshot(); }, 'A PNG at your screen\'s full resolution, with the filter, tilt and depth of field you chose');
    const free = mk('p21-free', '', (b) => { S.free = !S.free; saveCfg(); sync(b, 'Free camera', S.free); });
    const dof = mk('p21-dof', '', (b) => { S.dof = !S.dof; sync(b, 'Depth of field', S.dof); });
    const fil = mk('p21-filter', '', (b) => { const F = filters(); const i = F.findIndex((x) => x.id === S.filter); S.filter = F[(i + 1) % F.length].id; saveCfg(); b.textContent = 'Filter: ' + (F.find((x) => x.id === S.filter) || F[0]).label; preview(); });
    const vig = mk('p21-vig', '', (b) => { S.vignette = !S.vignette; saveCfg(); sync(b, 'Vignette', S.vignette); preview(); });
    const sync = (b, name, v) => { b.textContent = name + ': ' + (v ? 'On' : 'Off'); b.setAttribute('aria-pressed', v ? 'true' : 'false'); b.classList.toggle('sel', !!v); };
    sync(free, 'Free camera', S.free); sync(dof, 'Depth of field', S.dof); sync(vig, 'Vignette', S.vignette);
    fil.textContent = 'Filter: ' + ((filters().find((x) => x.id === S.filter) || OWN[0]).label);
    row.append(shot, free, fil, vig, dof);
    bar.appendChild(row); S.bar = row;
  }
  const STYLE = `
#game.p7-photo #gpu18-hud { visibility: hidden !important; }
#game.p7-photo #view, #game.p7-photo #gpu18-gl, #game.p7-photo #r3d21-gl { filter: var(--p21-photo-filter, none); }
#game.p7-photo.p21-photo-vig::after { content: ''; position: absolute; inset: 0 0 25% 0; pointer-events: none; z-index: 4; background: radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,.55) 100%); }
#p21-row .dfbtn.sel { box-shadow: inset 0 0 0 1px var(--gold, #d9a441); }
`;
  function injectStyle() { if (document.getElementById('photo21-style')) return; const st = document.createElement('style'); st.id = 'photo21-style'; st.textContent = STYLE; document.head.appendChild(st); }

  // ---------------------------------------------------------------- wiring
  function install() {
    if (typeof PLAYTOOLS !== 'object' || !PLAYTOOLS) return;
    injectStyle();
    // playtools' own key, button and Options row call its closure; this wrapper sees the state change instead
    let wasOn = false;
    const onEnter = () => { const c = Engine.cam; S.start = { x: c.x, y: c.y }; S.pitchRows = c.pitch; S.dof = false; ensureBar(); refreshFilter(); preview(); if (S.free) say(HELP); const d = document.getElementById('p21-dof'); if (d) { d.textContent = 'Depth of field: Off'; d.classList.remove('sel'); d.setAttribute('aria-pressed', 'false'); } };
    const onLeave = () => { S.start = null; S.pitchRows = null; drag = null; const game = document.getElementById('game'); if (game) { game.style.removeProperty('--p21-photo-filter'); game.classList.remove('p21-photo-vig'); } };
    if (typeof update === 'function') {
      const _update = update;
      update = function (dt) {
        const on = photoOn();
        if (on !== wasOn) { wasOn = on; try { if (on) onEnter(); else onLeave(); } catch (e) { warnOnce('state', e); } }
        if (!on || !S.free) return _update.apply(this, arguments);
        // the movement keys are this camera's; everything else (turning, tilt, the pad, the clocks) stays playtools'
        const keys = G.keys || {}, held = {};
        for (const k of MOVE_KEYS) { held[k] = !!keys[k]; if (keys[k]) keys[k] = false; }
        let r;
        try { r = _update.apply(this, arguments); } finally { for (const k of MOVE_KEYS) if (held[k]) keys[k] = true; }
        try { step(Math.min(0.1, Math.max(0, dt || 0)), held); } catch (e) { warnOnce('step', e); }
        return r;
      };
    }
    if (typeof render === 'function') {
      const _render = render;
      render = function () {
        const on = photoOn();
        if (on !== wasOn) { wasOn = on; try { if (on) onEnter(); else onLeave(); } catch (e) { warnOnce('state', e); } }
        if (on) { try { ensureBar(); } catch (e) { warnOnce('bar', e); } }
        return _render.apply(this, arguments);
      };
    }
    for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) window.addEventListener(t, onPointer, true);
    window.addEventListener('keydown', (ev) => {
      try {
        if (!photoOn() || ev.ctrlKey || ev.metaKey || ev.altKey || ev.repeat) return;
        if (ev.key === 'p' || ev.key === 'P') { ev.preventDefault(); ev.stopPropagation(); screenshot(); }
        else if ((ev.key === 'z' || ev.key === 'Z' || ev.key === 'Home') && S.start) { const s = PLAYTOOLS.photo.saved; if (s) { Engine.cam.z = s.z; S.pitchRows = s.pitch; } }
      } catch (e) { warnOnce('key', e); }
    }, true);
  }
  try { if (typeof document !== 'undefined') install(); } catch (e) { warnOnce('install', e); }
  return { B, S, OWN, filters, screenshot, grab, finish, fly, rise, setPitch, pitchLimit, deviceSize, sourceCanvas, ensureBar, step };
})();
if (typeof window !== 'undefined') window.PHOTO21 = PHOTO21;
