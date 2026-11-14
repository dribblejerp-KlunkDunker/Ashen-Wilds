// ============================================================
//  fp-feel — Phase 3: how the first-person camera and view FEEL
//  1. Head bob. The game already bobs (game.js: cam.bob = sin(G.bobPhase) * 2
//     rows * pace; one slow sine per ~0.7 s walking, ~0.5 s running, decaying at
//     exp(-13 dt) when you stop). That stays untouched. "Gentle" is an option
//     (GFX.headBob, default 'off') that swaps it for a smaller vertical bob with
//     a second footfall harmonic and a slight roll.
//  2. Landing dip: after a fall, a stair drop or a hard landing the eye eases
//     down and back up, scaled by the drop. ALWAYS ON (reduced motion cuts it).
//  3. Heavy-hit shake: a short camera shake when one tick takes >= 18% of max
//     health. Smaller hits do nothing. ALWAYS ON (reduced motion removes it).
//  4. Deafness (chord blasts, funeral-bell knock-backs, the felted bell's mute):
//     soft horizontal blur plus a dim, steady grey rim. ALWAYS ON when triggered.
//  5. Hushed: the view drains toward grey while you stand too still in siphoned
//     country or an awake Quiet is close. ALWAYS ON when triggered.
//  Audio: deafness and the Hush also close Audio_.muffle(), a master low-pass
//  on js/audio.js, so the world sounds stuffed while the view is blurred/grey.
//  Settings: GFX.headBob ('off'|'gentle'), GFX.reduceMotion, GFX.noFlash.
//  Camera offsets are applied only for the duration of Engine.render and
//  restored in a finally, so the player's own cam.bob/dir never drift.
//  Everything is procedural; a final pass can swap in authored feel curves.
// ============================================================
'use strict';

if (typeof GFX !== 'undefined') {
  if (GFX.headBob === undefined) GFX.headBob = 'off';
  if (GFX.reduceMotion === undefined) GFX.reduceMotion = false;
  if (GFX.noFlash === undefined) GFX.noFlash = false;
}

const FEEL = (() => {
  const HEAVY = 0.18;            // share of max health lost in one tick that counts as a heavy hit
  const DIP_PER_DROP = 4.2;      // view rows of dip per unit of drop
  const DIP_MAX = 6;
  const st = {
    gentle: 0, smooth: 0,        // gentle bob: current pace and (unused) smoothing
    dip: 0, dipT: 1, dipDur: 0.4,
    shake: 0,
    deafT: 0, deaf: 0, hush: 0, hushCue: 0, deafCue: -99, hushCueAt: -99,
    offY: 0, offDir: 0, rollDeg: 0, // what the last render applied (tests read these)
    fx: { blurCols: 0 },
    cost: { render: 0, post: 0, calls: 0 },
    lastDip: 0, lastShake: 0,
  };
  const settings = () => (typeof GFX !== 'undefined' ? GFX : { headBob: 'off', reduceMotion: false, noFlash: false });
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ---- persistence (guarded: previews and private windows have no storage) --------------------
  const KEY = 'octave.feel.v1';
  function save() {
    try { const g = settings(); localStorage.setItem(KEY, JSON.stringify({ b: g.headBob, r: g.reduceMotion, n: g.noFlash })); } catch (e) { /* no storage: fine */ }
  }
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!o) return;
      const g = settings();
      if (o.b === 'gentle' || o.b === 'off') g.headBob = o.b;
      g.reduceMotion = !!o.r; g.noFlash = !!o.n;
    } catch (e) { /* ignore */ }
  }

  // ---- triggers -----------------------------------------------------------------------------
  function landing(drop, hard) {
    if (!(drop > 0.08)) return;
    const g = settings();
    let d = Math.min(DIP_MAX, drop * DIP_PER_DROP) * (hard ? 1.35 : 1);
    if (g.reduceMotion) d *= 0.35;
    d = Math.min(d, DIP_MAX * 1.3);
    const cur = st.dip * dipShape(st.dipT);
    if (d < cur) return;          // a bigger dip is already under way
    st.dip = d; st.dipT = 0; st.dipDur = 0.32 + 0.1 * d; st.lastDip = d;
  }
  // down fast (30%), back up slowly; exactly 0 at both ends
  function dipShape(u) { if (u >= 1) return 0; return u < 0.3 ? Math.sin(Math.PI / 2 * (u / 0.3)) : Math.cos(Math.PI / 2 * ((u - 0.3) / 0.7)); }

  function heavyHit(ratio) {
    if (settings().reduceMotion) return;
    const k = clamp(0.45 + (ratio - HEAVY) * 2.2, 0.45, 1);
    st.shake = Math.max(st.shake, k); st.lastShake = k;
  }
  function deafen(sec, cue) {
    st.deafT = Math.max(st.deafT, sec);
    if (cue && typeof G !== 'undefined' && G.time - st.deafCue > 6) { st.deafCue = G.time; if (typeof msg === 'function') msg('Your ears ring.', 'warn', 3200); }
  }

  // ---- per tick ----------------------------------------------------------------------------
  function hushTarget() {
    if (typeof G === 'undefined' || !G.map || !G.player) return 0;
    let t = 0;
    if (G.map.siphoned) t = clamp((G.stillT - 1.5) / 5.5, 0, 1) * 0.7;
    if (G.unwriting) t = 0.85;
    const c = Engine.cam;
    for (const e of G.ents) {
      if (e.kind !== 'enemy' || e.dead || e.hidden || !e.def || !(e.def.quiet || e.def.hushkin)) continue;
      const dx = e.x - c.x, dy = e.y - c.y, d2 = dx * dx + dy * dy;
      if (d2 > 49) continue;
      t = Math.max(t, 0.55 * (1 - Math.sqrt(d2) / 7));
    }
    return t;
  }
  function tick(dt, pre) {
    const p = G.player;
    // landing: fallFrom cleared while a fall was under way means feet reached ground
    if (pre && p && G.map === pre.map) {
      if (pre.fallFrom != null && p.fallFrom == null) {
        const drop = pre.fallFrom - p.feet, hurt = pre.hp - p.hp > 0.5;
        landing(drop, hurt);
      } else if (pre.fallFrom == null && p.fallFrom == null && pre.feet - p.feet >= 0.1) landing(pre.feet - p.feet, false);   // one-step stair/ledge snap
      const lost = pre.hp - p.hp;
      if (lost > 0 && p.hpMax > 0 && lost / p.hpMax >= HEAVY) heavyHit(lost / p.hpMax);
    }
    st.shake *= Math.exp(-dt * 6.5); if (st.shake < 0.01) st.shake = 0;
    if (st.dipT < 1) st.dipT = Math.min(1, st.dipT + dt / st.dipDur);
    // deafness
    if (st.deafT > 0) st.deafT = Math.max(0, st.deafT - dt);
    let dt_ = Math.min(1, st.deafT / 0.9);
    if (G.mutedT > 0.5) dt_ = Math.max(dt_, Math.min(0.6, G.mutedT / 4));
    st.deaf += (dt_ - st.deaf) * (1 - Math.exp(-dt * (dt_ > st.deaf ? 10 : 2.6)));
    if (st.deaf < 0.01 && dt_ === 0) st.deaf = 0;
    // hush
    const ht = hushTarget();
    st.hush += (ht - st.hush) * (1 - Math.exp(-dt * (ht > st.hush ? 1.6 : 1.2)));
    if (st.hush < 0.01 && ht === 0) st.hush = 0;
    if (st.hush > 0.25 && G.time - st.hushCueAt > 14 && !st.hushCue) {
      st.hushCue = 1; st.hushCueAt = G.time;
      if (typeof msg === 'function') msg('The colour drains out of the world and sound goes flat. The Hush is close.', 'warn', 4200);
    } else if (st.hush < 0.08) st.hushCue = 0;
    // deafness and the Hush muffle the sound as well as the picture
    try { if (typeof Audio_ !== 'undefined' && Audio_.muffle) Audio_.muffle(Math.max(st.deaf, st.hush * 0.6)); } catch (e) { /* audio optional */ }
    // gentle bob pace
    const v = G.vel ? Math.hypot(G.vel.x, G.vel.y) : 0;
    st.gentle = clamp(v / 2.4, 0, 1);
  }

  // ---- camera offsets (applied only during Engine.render) ----------------------------------
  function offsets() {
    const g = settings(), c = Engine.cam;
    let y = 0, dir = 0, roll = 0;
    // bob: off = the game's own; gentle = replace it; reduced motion halves the game's own
    if (g.headBob === 'gentle') {
      const ph = G.bobPhase, k = g.reduceMotion ? 0.5 : 1, pace = st.gentle;
      const target = k * pace * (0.95 * Math.sin(ph) + 0.4 * Math.sin(2 * ph + 0.6));
      y += target - c.bob;
      roll = g.reduceMotion ? 0 : 0.4 * Math.sin(ph) * pace;
    } else if (g.reduceMotion) y += -0.5 * c.bob;
    if (st.dipT < 1) y -= st.dip * dipShape(st.dipT);
    if (st.shake > 0 && !g.reduceMotion) {
      const t = G.time;
      y += st.shake * 3.2 * (0.6 * Math.sin(t * 61) + 0.4 * Math.sin(t * 97 + 1));
      dir = st.shake * 0.016 * Math.sin(t * 47 + 2);
    }
    st.offY = y; st.offDir = dir; st.rollDeg = roll;
    return { y, dir };
  }

  // ---- the post hook: roll shear, deaf blur and rim, hush grey ------------------------------
  let tmp = new Uint32Array(0), rawRender = null;
  function post(F) {
    if (!F || !F.fb) return;
    const hasRoll = Math.abs(st.rollDeg) > 0.02, hasDeaf = st.deaf > 0.02, hasHush = st.hush > 0.02;
    if (!hasRoll && !hasDeaf && !hasHush) return;
    const t0 = performance.now();
    const fb = F.fb, w = F.w, h = F.h;
    if (hasRoll) {
      // a vertical shear about the centre column is a small roll; columns shift by at most ~1 row
      if (tmp.length < h) tmp = new Uint32Array(h);
      const slope = Math.tan(st.rollDeg * Math.PI / 180), cx = w / 2;
      for (let x = 0; x < w; x++) {
        const dy = Math.round((x - cx) * slope); if (!dy) continue;
        for (let y = 0; y < h; y++) tmp[y] = fb[y * w + x];
        for (let y = 0; y < h; y++) { const sy = y - dy; fb[y * w + x] = tmp[sy < 0 ? 0 : sy >= h ? h - 1 : sy]; }
      }
    }
    if (hasHush) {
      const keep = Math.round((1 - st.hush * 0.85) * 256), dim = 1 - st.hush * 0.08;
      const dimK = Math.round(dim * 256);
      for (let i = 0, n = w * h; i < n; i++) {
        const px = fb[i], r = px & 255, gg = (px >> 8) & 255, b = (px >> 16) & 255;
        const l = (r * 77 + gg * 150 + b * 29) >> 8;
        const r2 = ((l + (((r - l) * keep) >> 8)) * dimK) >> 8, g2 = ((l + (((gg - l) * keep) >> 8)) * dimK) >> 8, b2 = ((l + (((b - l) * keep) >> 8)) * dimK) >> 8;
        fb[i] = (px & 0xff000000) | (b2 << 16) | (g2 << 8) | r2;
      }
    }
    if (hasDeaf) {
      const a = st.deaf, M = 0x00fefefe;
      const mix = (p, q) => ((p & M) >>> 1) + ((q & M) >>> 1);
      const passes = a > 0.66 ? 2 : 1;
      for (let pass = 0; pass < passes; pass++) {
        for (let y = 0; y < h; y++) {
          const row = y * w; let prev = fb[row];
          for (let x = 0; x < w; x++) {
            const cur = fb[row + x], nxt = x + 1 < w ? fb[row + x + 1] : cur;
            const bl = mix(mix(prev, nxt), cur) | 0xff000000;
            prev = cur;
            fb[row + x] = a > 0.4 || pass ? bl : (mix(cur, bl) | 0xff000000);
          }
        }
      }
      // a steady, dim grey rim (no pulse, no brightening: nothing here can flash)
      const rim = a * 0.4, cxx = w / 2, cyy = h / 2;
      for (let y = 0; y < h; y++) {
        const dy = (y - cyy) / cyy;
        for (let x = 0; x < w; x++) {
          const dx = (x - cxx) / cxx, e = dx * dx * 0.5 + dy * dy * 0.5;
          if (e < 0.45) continue;
          const k = Math.min(1, (e - 0.45) / 0.55) * rim, px = fb[y * w + x];
          const r = px & 255, g2 = (px >> 8) & 255, b = (px >> 16) & 255, kk = k;
          fb[y * w + x] = (px & 0xff000000) | (((b + (40 - b) * kk) | 0) << 16) | (((g2 + (38 - g2) * kk) | 0) << 8) | ((r + (36 - r) * kk) | 0);
        }
      }
    }
    st.cost.post += performance.now() - t0; st.cost.calls++;
  }

  // ---- wiring -------------------------------------------------------------------------------
  function wire() {
    // one tick of the game, observed: health, feet and fall state before and after
    if (typeof update === 'function') {
      const _update = update;
      update = function (dt) {
        let pre = null;
        try {
          if (G.state === 'play' && G.player) pre = { map: G.map, hp: G.player.hp, feet: G.player.feet, fallFrom: G.player.fallFrom };
        } catch (e) { pre = null; }
        const r = _update.apply(this, arguments);
        try { tick(dt, pre); } catch (e) { console.warn('fp-feel tick failed', e); }
        return r;
      };
    }
    // camera offsets live only inside the render call
    if (typeof Engine !== 'undefined' && Engine.render) {
      const _render = Engine.render; rawRender = _render;
      Engine.render = function () {
        const c = Engine.cam, bob0 = c.bob, dir0 = c.dir;
        let o = null;
        try { if (typeof G !== 'undefined' && G.map && G.state !== 'title') o = offsets(); } catch (e) { o = null; }
        if (o) { c.bob = bob0 + o.y; c.dir = dir0 + o.dir; }
        try { return _render.apply(this, arguments); } finally { c.bob = bob0; c.dir = dir0; }
      };
      Engine.addPostHook(post, 100);
    }
    // deafening events (wrapped, never edited): the bronze chord and the funeral bell's knock-back
    if (typeof chordBlast === 'function') {
      const _cb = chordBlast;
      chordBlast = function () { const r = _cb.apply(this, arguments); try { deafen(2.4, true); } catch (e) { /* cue only */ } return r; };
    }
    if (typeof codaHitFx === 'function') {
      const _ch = codaHitFx;
      codaHitFx = function () {
        const before = G.hurtT || 0, r = _ch.apply(this, arguments);
        try { if ((G.hurtT || 0) >= 0.44 && before < 0.44) deafen(1.9, true); } catch (e) { /* cue only */ }
        return r;
      };
    }
    // no flashes: the game's red/cyan/gold full-view flashes become nothing; the damage line still prints
    if (typeof fx === 'function') {
      const _fx = fx;
      fx = function (cls) {
        if (settings().noFlash && (cls === 'hurt' || cls === 'glass' || cls === 'song')) return;
        return _fx.apply(this, arguments);
      };
    }
    // options rows, appended after presets.js has appended its Graphics block
    if (typeof renderAccessibilityMenu === 'function') {
      const _acc = renderAccessibilityMenu;
      renderAccessibilityMenu = function () {
        const r = _acc.apply(this, arguments);
        try { appendRows(); } catch (e) { console.warn('feel rows failed', e); }
        return r;
      };
    }
  }

  function el(tag, props, text) {
    const e = document.createElement(tag);
    if (props) for (const k in props) { if (k === 'style') e.style.cssText = props[k]; else e.setAttribute(k, props[k]); }
    if (text != null) e.textContent = text;
    return e;
  }
  function appendRows() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById('feel-head')) return;
    const g = settings();
    grid.appendChild(el('span', { id: 'feel-head', style: 'grid-column:1/-1;margin-top:1cqh;color:var(--gold);font-family:var(--font-display);letter-spacing:.08em' }, 'Camera feel'));
    const row = (label, hint) => { const s = el('span', { class: 'gfx-label' }, label); s.appendChild(document.createTextNode(' ')); s.appendChild(el('small', { class: 'muted' }, hint)); return s; };
    const btn = (id, aria, fn) => { const b = el('button', { class: 'dfbtn small', id, type: 'button' }, ''); b.setAttribute('aria-label', aria); b.onclick = () => { fn(); save(); sync(); }; return b; };
    const bob = btn('feel-bob', 'Head bob', () => { g.headBob = g.headBob === 'gentle' ? 'off' : 'gentle'; });
    const rm = btn('feel-reduce', 'Reduce motion', () => { g.reduceMotion = !g.reduceMotion; });
    const nf = btn('feel-noflash', 'No flashes', () => { g.noFlash = !g.noFlash; });
    function sync() {
      bob.textContent = g.headBob === 'gentle' ? 'Gentle' : 'Off';
      rm.textContent = g.reduceMotion ? 'On' : 'Off';
      nf.textContent = g.noFlash ? 'On' : 'Off';
      for (const [b, on] of [[bob, g.headBob === 'gentle'], [rm, g.reduceMotion], [nf, g.noFlash]]) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.classList.toggle('sel', on); }
    }
    grid.appendChild(row('Head bob', 'off keeps the original walk; gentle is smoother with a slight roll'));
    grid.appendChild(bob);
    grid.appendChild(row('Reduce motion', 'no shake or roll, softer bob and landing dip'));
    grid.appendChild(rm);
    grid.appendChild(row('No flashes', 'removes the red, cyan and gold full-view flashes'));
    grid.appendChild(nf);
    sync();
  }

  load();
  wire();
  return {
    state: st, settings, landing, heavyHit, deafen, offsets, post, tick, dipShape, appendRows, save, load,
    HEAVY, DIP_PER_DROP, DIP_MAX, get rawRender() { return rawRender; },
    audio: 'muffled through Audio_.muffle (a master low-pass) as well as the picture',
  };
})();
if (typeof window !== 'undefined') window.FEEL = FEEL;
