// ============================================================
//  fp-hands — Phase 3: first-person draw/holster/switch, Song-casting glow,
//  and climbing hands. All procedural stand-in art (canvas shapes tinted from
//  the existing fp_hands artwork) pending final painted frames.
//
//  Nothing here drives gameplay. It watches state (p.weapon, G.state, G.song,
//  doClimb's result) and draws. Wraps: update (timers), drawHUD (overlay),
//  castSong (which Song/colour), doClimb (start the climb animation).
//
//  Attacks during a switch: DECISION = an attack (or a Song) cancels the
//  transition instantly and the weapon snaps ready. So combat timing and damage
//  are exactly as before; there is no readiness wait at all.
//
//  GFX.fpHands (default true): off => drawHUD is not wrapped at all in effect
//  (the original runs untouched), so HUD frames are byte-identical.
// ============================================================
'use strict';

const FPHANDS = (() => {
  if (typeof GFX !== 'undefined') {
    if (GFX.fpHands === undefined) GFX.fpHands = true;
    if (GFX.reduceFlash === undefined) GFX.reduceFlash = false; // no pulsing/bright glow when true
  }
  const LOWER_T = 0.15, RAISE_T = 0.2;   // 0.35 s lower + raise
    const CLIMB_T = 1.0, CAST_T = 0.7, TAIL_T = 0.2;
  const st = {
    lower: 0,            // 0 ready ... 1 fully out of view
    shown: null,         // weapon id currently on screen
    player: null,
    climb: 0,            // seconds left of climb animation
    cast: 0, castDur: CAST_T, castCol: [255, 255, 255], castPower: 0.7, castFreq: 0,
    t: 0,
  };

  // ---- Song colour: root note -> colour --------------------------------
  // The six Octave roots, then log-frequency interpolation for anything else.
  const ROOTS = [
    [174, [214, 64, 48]],    // Root Foundation: deep red
    [285, [232, 134, 40]],   // Flambeau Ward: ember orange
    [396, [226, 196, 64]],   // Quarry-Breaker: stone gold
    [528, [96, 214, 112]],   // Sun-Glass: green-gold light
    [639, [72, 168, 232]],   // Drift-Wind: sky blue
    [741, [164, 112, 236]],  // Catalogue Unnaming: violet
  ];
  function colourFor(freq) {
    if (!(freq > 0)) return [214, 220, 232];   // Murmur: pale breath
    if (freq <= ROOTS[0][0]) return ROOTS[0][1].slice();
    for (let i = 1; i < ROOTS.length; i++) {
      if (freq <= ROOTS[i][0]) {
        const a = ROOTS[i - 1], b = ROOTS[i], k = Math.log(freq / a[0]) / Math.log(b[0] / a[0]);
        return a[1].map((v, n) => Math.round(v + (b[1][n] - v) * k));
      }
    }
    return ROOTS[ROOTS.length - 1][1].slice();
  }
  function songFreq(id) {
    const s = typeof SONGS !== 'undefined' ? SONGS[id] : null; if (!s) return 0;
    if (s.freq) return s.freq;
    const m = /\d+/.exec(String(s.hz)); return m ? +m[0] : 0;
  }
  function songPower(id) {
    const s = SONGS[id]; if (id === 'murmur') return 0.3;
    if (s && s.dyn) return s.dyn === 'whisper' ? 0.45 : s.dyn === 'forte' ? 1 : 0.75;
    const n = s ? s.noise : 1.5; return n >= 3 ? 1 : n >= 1.8 ? 0.75 : 0.6;
  }

  const ease = t => t * t * (3 - 2 * t);
  const reduced = () => !!(typeof GFX !== 'undefined' && GFX.reduceFlash) ||
    !!(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const enabled = () => typeof GFX === 'undefined' || GFX.fpHands !== false;
  const weaponId = () => { const p = G.player; return p && p.weapons ? p.weapons[p.weapon] : null; };
  const holstered = () => G.state === 'panel' || G.state === 'dialogue' || G.state === 'event' || st.climb > 0;
  const busy = () => G.attack.t > 0 || G.song.t > 0 || G.songFx > 0;

  // ---- timers (driven by the game's own update, so advanceTime is deterministic) --
  function step(dt) {
    if (!enabled() || !G.player) return;
    st.t += dt;
    if (st.player !== G.player) { st.player = G.player; st.shown = weaponId(); st.lower = 0; st.climb = 0; st.cast = 0; }
    if (st.climb > 0) st.climb = Math.max(0, st.climb - dt);
    if (st.cast > 0) st.cast = Math.max(0, st.cast - dt);
    if (busy()) { st.shown = weaponId(); st.lower = 0; return; }   // attack/Song cancel a transition at once
    const now = weaponId();
    if (st.shown !== now || holstered()) {
      st.lower = Math.min(1, st.lower + dt / LOWER_T);
      if (st.lower >= 1 && st.shown !== now) st.shown = now;   // swap while hidden; it rises on return
    } else if (st.lower > 0) st.lower = Math.max(0, st.lower - dt / RAISE_T);
  }

  // ---- cached art ------------------------------------------------------------
  const cache = new Map();
  function haloSprite(col) {
    const key = 'h' + col.join(','); let c = cache.get(key); if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, `rgba(${col},0.95)`); g.addColorStop(0.35, `rgba(${col},0.45)`); g.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); cache.set(key, c); return c;
  }
  function tintSprite(img, col) {
    const key = 't' + col.join(',') + img.width; let c = cache.get(key); if (c) return c;
    c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = `rgb(${col})`; x.fillRect(0, 0, c.width, c.height);
    cache.set(key, c); return c;
  }
  // Skin tones sampled once from the existing fp_hands art so climbing hands match.
  let skin = null;
  function skinTones() {
    if (skin) return skin;
    skin = ['#8a6a50', '#5e4634', '#b08c6a'];
    try {
      const im = Engine.images.fp_hands; if (!im) return skin;
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data; let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      if (n) { r /= n; g /= n; b /= n; const f = k => `rgb(${Math.min(255, r * k) | 0},${Math.min(255, g * k) | 0},${Math.min(255, b * k) | 0})`; skin = [f(1), f(0.62), f(1.25)]; }
    } catch (e) { /* keep the defaults */ }
    return skin;
  }

  // ---- drawing -----------------------------------------------------------------
  const NONE = { img: '__fphands_none__', name: '', type: 'iron', speed: 0.4 };
  function weaponGeom(w, ay, rot) {
    const img = Engine.images[w.img]; if (!img) return null;
    const iw = img.width * 0.5, ih = img.height * 0.5;
    const bx = w.img === 'fp_hands' ? VW / 2 - iw / 2 : w.center ? VW / 2 - iw / 2 + 22 : VW - iw - 10;
    const bob = (Engine.cam.bob || 0) + Math.sin(performance.now() / 900) * 1.4;
    return { img, iw, ih, bx, tx: bx + iw * 0.5, ty: VIEW_H + 12 + ay + bob * 1.5, rot };
  }
  function drawWeapon(ctx) {
    const w = WEAPONS[st.shown] || WEAPONS.hands, k = ease(st.lower);
    const im = Engine.images[w.img]; if (!im) return;
    st.dropPx = k * (im.height * 0.5 + 24);
    const g = weaponGeom(w, st.dropPx, k * 0.3 * (w.center ? 0 : 1)); if (!g) return;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VW, VIEW_H); ctx.clip();
    ctx.translate(g.tx, g.ty); ctx.rotate(g.rot);
    ctx.drawImage(g.img, -g.iw * 0.5, -g.ih + 12, g.iw, g.ih);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,240,200,0.7)'; ctx.fillRect(VW / 2 - 1, VIEW_H / 2 - 1, 2, 2);
  }
  function drawCastGlow(ctx) {
    const age = st.castDur - st.cast;            // 0 .. castDur(+tail)
    const live = Math.min(1, st.cast / TAIL_T);   // fade through the final tail
    const calm = reduced();
    const fade = age < 0.12 ? age / 0.12 : live;
    const pulse = calm ? 0.85 : 0.8 + 0.2 * Math.sin(age * 22);
    st.pulse = pulse;
    const a = st.castPower * fade * (calm ? 0.55 : 1);
    if (a <= 0.01) return;
    const hands = Engine.images.fp_hands; if (!hands) return;
    const rise = G.song.t > 0 ? -Math.sin((1 - G.song.t / 0.7) * Math.PI) * 30 : 0;
    const g = weaponGeom(WEAPONS.hands, rise, 0); if (!g) return;
    const col = st.castCol;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VW, VIEW_H); ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    // the hands take the Song's colour
    const handsUp = G.song.t > 0 || G.songFx > 0;   // Murmur keeps the weapon out: halo only
    if (handsUp) {
      ctx.globalAlpha = Math.min(0.55, a * 0.5);
      ctx.save(); ctx.translate(g.tx, g.ty); ctx.drawImage(tintSprite(hands, col), -g.iw * 0.5, -g.ih + 12, g.iw, g.ih); ctx.restore();
    }
    // pulsing halo between the hands
    const r = (16 + st.castPower * 22) * pulse, cy = handsUp ? g.ty - g.ih * 0.55 : VIEW_H - 14;
    ctx.globalAlpha = Math.min(1, a * 0.9);
    ctx.drawImage(haloSprite(col), g.tx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }
  // Rungs scroll down and two hands alternate gripping them as the climb advances.
  function drawClimb(ctx) {
    const prog = 1 - st.climb / CLIMB_T;                  // 0..1
    const slide = Math.min(1, prog / 0.15, (1 - prog) / 0.15);   // hands slide in/out
    if (slide <= 0) return;
    const S = prog * 3 * 34, sk = skinTones(), gap = (1 - ease(slide)) * 60;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VW, VIEW_H); ctx.clip();
    ctx.globalAlpha = Math.min(1, slide * 1.5);
    // side rails and rungs (dark wood stand-in)
    ctx.fillStyle = '#2b1d12'; ctx.fillRect(96, 0, 3, VIEW_H); ctx.fillRect(221, 0, 3, VIEW_H);
    ctx.fillStyle = '#4a3320';
    for (let k = -1; k < 6; k++) { const y = 38 + (S % 34) + k * 34 - 34 + gap * 0.3; ctx.fillRect(96, y, 128, 4); }
    for (let i = 0; i < 2; i++) {
      const d = (S + i * 34) % 68, cyc = d / 68;
      let y = 38 + d - 34 + gap * 0.3;
      if (cyc < 0.15) y += (1 - ease(cyc / 0.15)) * 40;           // reaching up to the next rung
      const x = i ? 168 : 120;
      ctx.fillStyle = sk[1]; ctx.fillRect(x - 1, y - 1, 34, 16);    // outline
      ctx.fillStyle = sk[0]; ctx.fillRect(x, y, 32, 14);            // fist over the rung
      ctx.fillStyle = sk[2]; for (let f = 0; f < 4; f++) ctx.fillRect(x + 2 + f * 8, y + 1, 6, 4); // knuckles
      ctx.fillStyle = sk[1]; for (let f = 1; f < 4; f++) ctx.fillRect(x + f * 8 - 1, y + 5, 1, 8);  // finger gaps
      ctx.fillStyle = sk[0]; ctx.fillRect(i ? x - 6 : x + 30, y + 6, 8, 5); // thumb
      ctx.fillStyle = sk[1]; ctx.fillRect(x + 6, y + 14, 20, VIEW_H);       // forearm
      ctx.fillStyle = sk[0]; ctx.fillRect(x + 8, y + 14, 16, VIEW_H);
    }
    ctx.restore();
  }

  // ---- wraps --------------------------------------------------------------------
  const _update = update;
  update = function (dt) { try { step(dt); } catch (e) { console.warn('fp-hands step', e); } return _update.apply(this, arguments); };

  const _castSong = castSong;
  castSong = function (id) {
    const before = G.song.t, mu = G.murmurT;
    const r = _castSong.apply(this, arguments);
    try {
      const sung = G.song.t > 0 && before <= 0, murmured = id === 'murmur' && G.murmurT > mu;
      if (enabled() && (sung || murmured)) {
        st.castCol = colourFor(songFreq(id)); st.castPower = songPower(id); st.castFreq = songFreq(id);
        st.castDur = CAST_T + TAIL_T; st.cast = st.castDur; st.climb = 0;
      }
    } catch (e) { console.warn('fp-hands cast', e); }
    return r;
  };

  const _doClimb = doClimb;
  doClimb = function (e) {
    const c = Engine.cam, x = c.x, y = c.y;
    const r = _doClimb.apply(this, arguments);
    try { if (enabled() && (c.x !== x || c.y !== y)) { st.climb = CLIMB_T; st.cast = 0; } } catch (er) { console.warn('fp-hands climb', er); }
    return r;
  };

  const _drawHUD = drawHUD;
  drawHUD = function () {
    if (!enabled() || !G.player) { st.player = null; return _drawHUD.apply(this, arguments); }
    if (busy()) { st.lower = 0; st.shown = weaponId(); st.climb = 0; }   // swings and Songs always show as the original draws them
    const hide = st.lower > 0 || st.climb > 0;
    let r;
    if (hide) {
      // the original still draws crosshair + bar; only its weapon is suppressed
      const _cw = currentWeapon; currentWeapon = () => NONE;
      try { r = _drawHUD.apply(this, arguments); } finally { currentWeapon = _cw; }
      try {
        const ctx = Engine.ctx;
        drawWeapon(ctx);
        if (st.climb > 0) drawClimb(ctx);
      } catch (e) { console.warn('fp-hands draw', e); }
      return r;
    }
    r = _drawHUD.apply(this, arguments);
    try { if (st.cast > 0) drawCastGlow(Engine.ctx); } catch (e) { console.warn('fp-hands glow', e); }
    return r;
  };

  return { st, colourFor, songFreq, step, ROOTS, LOWER_T, RAISE_T, CLIMB_T, CAST_T, TAIL_T,
    offset: () => st.dropPx || 0 };
})();
