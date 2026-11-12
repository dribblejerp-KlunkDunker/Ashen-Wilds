// ============================================================
//  hud11 — Phase 11 "Feedback and feel": five optional HUD aids, each its own switch in
//  Options -> Graphics & access, all off by default and off in the Original and Low presets.
//    1. Hit-direction marker  a short red arc on the edge of the 3D view points at whatever hurt you (an enemy, a
//                             bolt, a trap), relative to where you face now. Up to 4 at once, ~1 s each. It is
//                             about damage; js/ripples.js is about sound. They share no state.
//    2. Enemy health bars     a thin bar over the enemy under the crosshair and, for a moment, over anything you
//                             just hit. Placed from the sprite rect the renderer left in e._screen and hidden when
//                             the renderer's own depth buffer says the enemy is behind something. No bar for
//                             bosses (they keep their own presentation) or for the Hush-things.
//    3. Damage numbers        small numbers float up from hits you deal and take: plain, strong (top of the weapon's
//                             range, gold and "!"), blocked ([n]), parried ("Parry"). Drawn in the HUD's own
//                             Alegreya SC at its logical size. A fixed pool of 24.
//    4. Organ pipes           HUD style Bars / Organ pipes: health, fatigue and Song power as three brass pipes in the
//                             same slots as the bars (x 4..30; the glass bar, Narrow bar and Dread band are not touched).
//    5. Stillness tint        the view's edges darken slowly the longer you stand quiet (the same test as dread.js:
//                             moving slower than 0.35, Narrow under 2.2, no murmur or whistle) and clear in about
//                             a second when you move or make a sound. At most a 30% corner darkening.
//  Presentation only: everything here READS game state and draws on Engine.ctx after the frame. No Math.random, no
//  saved field, no change to any number. Wrapped: render (draw), update (clock, stillness), enemyUpdate and
//  triggerTrap (who is acting), damagePlayer (what was taken), attack and executeCustomSong (what was dealt).
//  Honours GFX.reduceMotion (numbers do not rise, marks do not grow), GFX.noFlash (nothing here pulses at all),
//  high contrast and the colour-blind switch (UPG.colorblind: amber/white marks, a different pipe palette; every
//  meaning is also carried by shape: "!" / "[ ]" / "-" on numbers, studs on pipes), and the text-size setting.
//  Procedural stand-in: plain canvas shapes.
// ============================================================
'use strict';

if (typeof GFX !== 'undefined') {
  for (const k of ['hitMarker', 'enemyBars', 'dmgNumbers', 'organPipes', 'stillTint']) if (GFX[k] === undefined) GFX[k] = false;
}

const HUD11 = (() => {
  const KEY = 'echoes-hud11';
  const FLAGS = ['hitMarker', 'enemyBars', 'dmgNumbers', 'organPipes', 'stillTint'];
  const MARK_CAP = 4, MARK_LIFE = 1.0;      // hit markers: most at once, seconds each
  const NUM_POOL = 24, NUM_LIFE = 1.0;      // damage numbers
  const BAR_RECENT = 2.5, BAR_CAP = 4;      // seconds a bar stays over something you hit; most bars at once
  const STILL_GRACE = 4, STILL_RAMP = 20, STILL_MAX = 0.3, STILL_CLEAR = 16;   // seconds before it starts / to full / clear speed (x real time) / darkest corner alpha
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const stats = { frames: 0, drawn: 0, marks: 0, nums: 0, bars: 0, tint: 0, pipes: 0 };
  const marks = [];                          // { x, y, t0, src }
  const nums = [];                           // fixed pool
  for (let i = 0; i < NUM_POOL; i++) nums.push({ on: false, text: '', kind: '', value: 0, ax: 0, ay: 0, ent: null, t0: 0, seq: 0, side: 0 });
  let seq = 0, T = 0, stillS = 0, cur = null;
  const recent = new Map();                  // enemy -> T until which its bar shows
  let vig = null;                            // cached edge-darkening image
  let barsNow = [];                          // enemies whose bar was drawn last frame (for tests)
  const api = {};

  // ---- settings -------------------------------------------------------------------------------
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && typeof o === 'object') for (const k of FLAGS) if (typeof o[k] === 'boolean') GFX[k] = o[k];
    } catch (e) { /* storage may be blocked: everything stays off */ }
  }
  function save() { try { const o = {}; for (const k of FLAGS) o[k] = !!GFX[k]; localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* optional */ } }
  const anyOn = () => FLAGS.some((k) => GFX[k]);
  function reset() { marks.length = 0; for (const n of nums) n.on = false; recent.clear(); stillS = 0; barsNow = []; }
  function setFlag(k, on) {
    if (!FLAGS.includes(k)) return false;
    GFX[k] = !!on; save();
    if (!GFX[k]) { if (k === 'hitMarker') marks.length = 0; if (k === 'dmgNumbers') for (const n of nums) n.on = false; if (k === 'enemyBars') recent.clear(); if (k === 'stillTint') stillS = 0; }
    return GFX[k];
  }

  // ---- small helpers ------------------------------------------------------------------------------
  const reduced = () => !!(typeof GFX !== 'undefined' && GFX.reduceMotion);
  const hcOn = () => !!(typeof document !== 'undefined' && document.documentElement.classList.contains('ac-hc'));
  const cbOn = () => !!(typeof UPG !== 'undefined' && UPG && UPG.colorblind);
  function inPhoto() { const g = typeof document !== 'undefined' && document.getElementById('game'); return !!(g && g.classList.contains('p7-photo')) || (typeof G !== 'undefined' && G.state === 'photo'); }
  const viewShown = () => typeof G !== 'undefined' && G.player && G.map && ['play', 'dialogue', 'event'].includes(G.state) && !inPhoto();
  // angle of a world point relative to the camera: 0 ahead, +90deg right, 180 behind (engine forward = (cos,sin))
  function bearing(cam, x, y) {
    let a = Math.atan2(y - cam.y, x - cam.x) - cam.dir;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a <= -Math.PI) a += Math.PI * 2;
    return a;
  }
  function textPx(base) { try { return Math.round(base * (ACCESS.TS_SCALE[ACCESS.settings.ts | 0] || 1)); } catch (e) { return base; } }

  // ---- 1. hit marks ---------------------------------------------------------------------------------
  function addHit(x, y, src) {
    if (!(x === x) || !(y === y)) return null;
    const c = Engine.cam;
    if (Math.hypot(x - c.x, y - c.y) < 0.2) return null;               // standing on you: there is no direction
    if (src) for (const m of marks) if (m.src === src && T - m.t0 < 0.25) { m.t0 = T; return m; }   // a flurry from one source is one mark
    if (marks.length >= MARK_CAP) { let oi = 0; for (let i = 1; i < marks.length; i++) if (marks[i].t0 < marks[oi].t0) oi = i; marks.splice(oi, 1); }
    const m = { x, y, t0: T, src: src || null };
    marks.push(m); return m;
  }
  function drawMarks(ctx) {
    const cam = Engine.cam, cx = VW / 2, cy = VIEW_H / 2, rx = VW / 2 - 7, ry = VIEW_H / 2 - 6;
    const hc = hcOn(), cb = cbOn(), rm = reduced();
    for (let i = marks.length - 1; i >= 0; i--) {
      const m = marks[i], age = (T - m.t0) / MARK_LIFE;
      if (age >= 1) { marks.splice(i, 1); continue; }
      const th = bearing(cam, m.x, m.y), base = th - Math.PI / 2;
      const a = clamp(1 - age * age, 0, 1);
      const grow = rm ? 1 : clamp(age / 0.12, 0.35, 1);
      const w = 0.27 * grow;
      ctx.lineCap = 'butt';
      const path = (ww) => { ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, base - ww, base + ww); ctx.stroke(); };
      ctx.globalAlpha = a * 0.65; ctx.strokeStyle = '#080404'; ctx.lineWidth = hc || cb ? 5 : 4.5; path(w + 0.03);
      ctx.globalAlpha = a * (hc || cb ? 0.7 : 0.55); ctx.strokeStyle = hc ? '#ffffff' : cb ? '#ffb000' : '#b8281c'; ctx.lineWidth = 2.5; path(w);
      ctx.globalAlpha = a; ctx.strokeStyle = hc ? '#ffffff' : cb ? '#fff2a0' : '#ee4a38'; ctx.lineWidth = 2.5; path(w * 0.62);
    }
    ctx.globalAlpha = 1;
    stats.marks++;
  }

  // ---- 3. damage numbers ------------------------------------------------------------------------------
  // the one word shown on the canvas goes through the story translator when a language is set (English otherwise)
  function word(w) { try { return (typeof STORY_I18N !== 'undefined' && STORY_I18N.translate(w)) || w; } catch (e) { return w; } }
  function slot() {
    for (const n of nums) if (!n.on) return n;
    let o = nums[0]; for (const n of nums) if (n.t0 < o.t0) o = n;      // all busy: the oldest makes way
    return o;
  }
  // kind: 'hit' | 'crit' | 'taken' | 'blocked' | 'parry'. value is the number shown; the text is made from it here.
  function addNumber(kind, value, ent) {
    if (!GFX.dmgNumbers) return null;
    const dealt = kind === 'hit' || kind === 'crit';
    let ax, ay;
    if (dealt) {
      const s = ent && ent._screen; if (!s) return null;               // out of view: nothing to float from
      ax = (s.x0 + s.x1) / 2; ay = s.y0 - 2;
      if (ax < -8 || ax > VW + 8) return null;
    } else { ax = VW / 2; ay = VIEW_H * 0.74; }
    const n = slot();
    n.on = true; n.kind = kind; n.value = value; n.ent = dealt ? ent : null; n.t0 = T; n.seq = ++seq; n.ax = ax; n.ay = ay;
    n.side = ((seq * 7) % 5) - 2;                                       // a small fixed spread so stacked numbers do not overprint
    n.text = kind === 'parry' ? word('Parry') : kind === 'taken' ? '-' + value : kind === 'blocked' ? '[' + value + ']' : kind === 'crit' ? value + '!' : String(value);
    return n;
  }
  function drawNumbers(ctx) {
    const rm = reduced(), hc = hcOn(), cb = cbOn();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    let any = false;
    for (const n of nums) {
      if (!n.on) continue;
      const age = (T - n.t0) / NUM_LIFE;
      if (age >= 1) { n.on = false; continue; }
      if (n.ent && n.ent._screen) { const s = n.ent._screen; n.ax = (s.x0 + s.x1) / 2; n.ay = s.y0 - 2; }   // follows the body while it is on screen
      const dealt = n.kind === 'hit' || n.kind === 'crit';
      const rise = rm ? 0 : (1 - (1 - age) * (1 - age)) * (dealt ? 15 : 12);
      const x = n.ax + n.side * 3, y = clamp(n.ay - rise - (dealt ? 4 : 0), 8, VIEW_H - 8);
      const big = n.kind === 'crit' ? 1.3 : n.kind === 'parry' ? 1.1 : 1;
      ctx.font = '700 ' + Math.round(textPx(8) * big) + 'px "Alegreya SC", serif';
      ctx.globalAlpha = age > 0.6 ? clamp((1 - age) / 0.4, 0, 1) : 1;
      ctx.strokeStyle = hc ? '#000' : 'rgba(8,4,2,0.9)'; ctx.lineWidth = 2.5;
      ctx.strokeText(n.text, x, y);
      ctx.fillStyle = hc ? '#fff' : n.kind === 'crit' ? (cb ? '#ffe566' : '#ffd23a') : n.kind === 'hit' ? '#f4ead0'
        : n.kind === 'taken' ? (cb ? '#ffb000' : '#e8553f') : n.kind === 'blocked' ? '#a8bcd8' : '#9fe0d0';
      ctx.fillText(n.text, x, y);
      any = true;
    }
    ctx.globalAlpha = 1;
    if (any) stats.nums++;
  }

  // ---- 2. enemy health bars ------------------------------------------------------------------------------------
  const BOSS_IDS = ['aegis', 'weaver', 'pressman', 'broodmother', 'bosun', 'horn', 'requiem', 'wearer_coda', 'wearer'];
  function bossLike(e) { const d = e.def || {}; return !!(d.boss || d.wildsBoss || BOSS_IDS.indexOf(e.type) >= 0); }
  function barEligible(e) {
    return !!(e && e.kind === 'enemy' && e.def && !e.dead && !e.hidden && !e.dying && !bossLike(e) && !e.def.quiet && !e.def.hushkin && e.hp > 0 && e._screen);
  }
  // the renderer wrote each body's depth into its depth buffer; a probe that reads something nearer than the body
  // is looking at a wall or another sprite. Five probes over the body: hidden only if all five are covered.
  function visible(e) {
    const s = e._screen, z = s.z, W = s.x1 - s.x0, H = s.y1 - s.y0, cx = (s.x0 + s.x1) / 2;
    if (!(z > 0) || W < 1 || H < 1) return false;
    const pts = [[cx, s.y0 + H * 0.2], [cx, s.y0 + H * 0.5], [s.x0 + W * 0.3, s.y0 + H * 0.5], [s.x1 - W * 0.3, s.y0 + H * 0.5], [cx, s.y1 - 1]];
    for (const [px, py] of pts) {
      if (px < 0 || px >= VW || py < 0 || py >= VIEW_H) continue;
      if (Engine.depthAt(px, py) >= z - 0.08) return true;
    }
    return false;
  }
  function barTargets() {
    const out = [];
    let aim = null;
    try { aim = Engine.pick(G.ents, 14); } catch (e) { aim = null; }
    if (aim && barEligible(aim)) out.push(aim);
    for (const [e, until] of recent) {
      if (until < T || e.dead || e.hidden) { recent.delete(e); continue; }
      if (e !== aim && barEligible(e) && out.length < BAR_CAP) out.push(e);
    }
    return out;
  }
  function drawBars(ctx) {
    const hc = hcOn(), cb = cbOn();
    barsNow = [];
    for (const e of barTargets()) {
      if (!visible(e)) continue;
      const s = e._screen, max = e.hpMax || (e.def && e.def.hp) || 1, f = clamp(e.hp / max, 0, 1);
      const w = clamp(Math.round((s.x1 - s.x0) * 0.8), 14, 38), x = Math.round((s.x0 + s.x1) / 2 - w / 2), y = clamp(Math.round(s.y0) - 5, 2, VIEW_H - 8);
      ctx.fillStyle = hc ? '#fff' : '#0b0806'; ctx.fillRect(x - 1, y - 1, w + 2, 5);
      ctx.fillStyle = hc ? '#000' : '#3a1712'; ctx.fillRect(x, y, w, 3);
      const fw = Math.max(f > 0 ? 1 : 0, Math.round(w * f));
      ctx.fillStyle = hc ? '#fff' : cb ? '#ffd23a' : f > 0.5 ? '#c8503c' : '#e0683a'; ctx.fillRect(x, y, fw, 3);
      if (!hc) { ctx.fillStyle = 'rgba(255,230,200,0.35)'; ctx.fillRect(x, y, fw, 1); }
      ctx.fillStyle = hc ? '#fff' : 'rgba(10,6,4,0.8)'; ctx.fillRect(x + (w >> 1), y, 1, 3);       // a notch at half
      barsNow.push(e);
    }
    stats.bars += barsNow.length;
  }

  // ---- 5. stillness tint ------------------------------------------------------------------------------------------
  function tick(dt) {
    if (!GFX.stillTint || !G.player || G.state !== 'play') { if (stillS > 0) stillS = Math.max(0, stillS - dt * STILL_CLEAR); return; }
    const sp = G.vel ? Math.hypot(G.vel.x, G.vel.y) : 0, breath = G.murmurT > 0 || G.whistleT > 0;
    if (sp < 0.35 && G.noise < 2.2 && !breath) stillS = Math.min(STILL_GRACE + STILL_RAMP + 1, stillS + dt);   // capped, so that clearing never takes more than ~1.5 s
    else stillS = Math.max(0, stillS - dt * STILL_CLEAR);
  }
  function tintAmount() { const k = clamp((stillS - STILL_GRACE) / STILL_RAMP, 0, 1); return k * k * (3 - 2 * k) * STILL_MAX; }   // smoothstep
  function vignette() {
    if (vig) return vig;
    const c = document.createElement('canvas'); c.width = VW; c.height = VIEW_H;
    const x = c.getContext('2d'), g = x.createRadialGradient(VW / 2, VIEW_H / 2, VIEW_H * 0.34, VW / 2, VIEW_H / 2, VW * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    x.fillStyle = g; x.fillRect(0, 0, VW, VIEW_H);
    return (vig = c);
  }
  function drawTint(ctx) {
    const a = tintAmount(); if (a < 0.004) return;
    ctx.globalAlpha = a; ctx.drawImage(vignette(), 0, 0); ctx.globalAlpha = 1; stats.tint++;
  }

  // ---- 4. organ pipes ---------------------------------------------------------------------------------------------------
  const PIPE_X = [5, 13, 21], PIPE_W = 7;
  function pipeColours() {
    if (hcOn()) return ['#ffffff', '#ffffff', '#ffffff'];
    if (cbOn()) return ['#e07020', '#f0e442', '#56b4e9'];
    return ['#b23a2a', '#4e8a3a', '#3d6aa8'];
  }
  function fractions() { const p = G.player; return [p.hp / p.hpMax, p.fat / p.fatMax, p.voice / p.voiceMax].map((v) => (v === v ? clamp(v, 0, 1) : 0)); }
  const FILL_TOP = 9, FILL_H = 34;                       // interior rows, relative to the bar's top (VIEW_H)
  function drawPipes(ctx) {
    const y0 = VIEW_H, cols = pipeColours(), fr = fractions(), hc = hcOn();
    ctx.fillStyle = '#2a2018'; ctx.fillRect(4, y0 + 3, 27, 44);                 // the bars' ground: only x 4..30; the glass bar (x 2) and Narrow bar (x 32) stay
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; for (let i = 0; i < 6; i++) ctx.fillRect(5 + (i * 5) % 25, y0 + 5 + (i * 13) % 40, 2, 1);
    for (let i = 0; i < 3; i++) {
      const x = PIPE_X[i], w = PIPE_W, top = y0 + 8, bot = y0 + FILL_TOP + FILL_H;   // body spans top..bot
      // foot: a small cone under the body
      ctx.fillStyle = '#6a4a1c'; ctx.fillRect(x + 1, bot + 1, w - 2, 1); ctx.fillRect(x + 2, bot + 2, w - 4, 1); ctx.fillRect(x + 3, bot + 3, w - 6, 1);
      // brass wall: light on the left, shade on the right
      ctx.fillStyle = hc ? '#fff' : '#a97f34'; ctx.fillRect(x, top, w, bot - top + 1);
      ctx.fillStyle = hc ? '#fff' : '#d9ad55'; ctx.fillRect(x, top, 1, bot - top + 1);
      ctx.fillStyle = hc ? '#fff' : '#6a4a1c'; ctx.fillRect(x + w - 1, top, 1, bot - top + 1);
      // inside, the bore: dark, filled from the bottom by the value
      ctx.fillStyle = '#0b0806'; ctx.fillRect(x + 1, y0 + FILL_TOP, w - 2, FILL_H);
      const hh = Math.round(FILL_H * fr[i]);
      if (hh > 0) {
        ctx.fillStyle = cols[i]; ctx.fillRect(x + 1, y0 + FILL_TOP + FILL_H - hh, w - 2, hh);
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x + 1, y0 + FILL_TOP + FILL_H - hh, w - 2, 1);        // the surface
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x + 1, y0 + FILL_TOP + FILL_H - hh, 1, hh);
      }
      // rim at the open end, and the mouth: a lip notched into both walls
      ctx.fillStyle = hc ? '#fff' : '#f0d080'; ctx.fillRect(x, top - 1, w, 1);
      ctx.fillStyle = '#0b0806'; ctx.fillRect(x, y0 + FILL_TOP + FILL_H - 8, 1, 2); ctx.fillRect(x + w - 1, y0 + FILL_TOP + FILL_H - 8, 1, 2);
      ctx.fillStyle = hc ? '#fff' : '#f0d080'; ctx.fillRect(x, y0 + FILL_TOP + FILL_H - 9, 1, 1); ctx.fillRect(x + w - 1, y0 + FILL_TOP + FILL_H - 9, 1, 1);
      // studs on the rim: one for health, two for fatigue, three for Song power (shape, not colour, names the pipe)
      ctx.fillStyle = '#2a1a08'; for (let k = 0; k <= i; k++) ctx.fillRect(x + 1 + k * 2, top, 1, 1);
    }
    stats.pipes++;
  }

  // ---- drawing, called once after each frame -------------------------------------------------------------------------------------
  function draw() {
    stats.frames++;
    if (!G.player || !G.map) return;
    const ctx = Engine.ctx;
    if (GFX.stillTint || GFX.enemyBars || GFX.dmgNumbers || GFX.hitMarker) {
      ctx.save();
      try {
        if (viewShown()) {
          ctx.beginPath(); ctx.rect(0, 0, VW, VIEW_H); ctx.clip();            // the view only: never the HUD bar
          if (GFX.stillTint) drawTint(ctx);
          if (GFX.enemyBars) drawBars(ctx);
          if (GFX.dmgNumbers) drawNumbers(ctx);
          if (GFX.hitMarker) drawMarks(ctx);
        }
      } finally { ctx.restore(); }
    }
    if (GFX.organPipes && !inPhoto()) { ctx.save(); try { drawPipes(ctx); } finally { ctx.restore(); } }
    stats.drawn++;
  }

  // ---- reading what happened ------------------------------------------------------------------------------------------------------
  function snapEnemies() {
    const a = [];
    for (const e of G.ents) if (e && e.kind === 'enemy' && !e.dead) a.push(e, e.hp);
    return a;
  }
  function afterDealt(before, crit) {
    for (let i = 0; i < before.length; i += 2) {
      const e = before[i], d = before[i + 1] - e.hp;
      if (!(d > 0)) continue;
      if (GFX.enemyBars) recent.set(e, T + BAR_RECENT);
      if (GFX.dmgNumbers) addNumber(crit && crit(d) ? 'crit' : 'hit', d, e);
    }
  }
  function wire() {
    if (typeof update === 'function') {
      const _u = update;
      update = function (dt) {
        const r = _u.apply(this, arguments);
        try { if (dt > 0) { T += dt; if (anyOn() || stillS > 0) tick(dt); } } catch (e) { console.warn('hud11 tick failed', e); }
        return r;
      };
    }
    if (typeof enemyUpdate === 'function') {
      const _eu = enemyUpdate;
      enemyUpdate = function (e) {
        const was = cur; cur = e;
        try { return _eu.apply(this, arguments); } finally { cur = was; }
      };
    }
    if (typeof triggerTrap === 'function') {
      const _tt = triggerTrap;
      triggerTrap = function (e) {
        const was = cur; cur = e;
        try { return _tt.apply(this, arguments); } finally { cur = was; }
      };
    }
    if (typeof damagePlayer === 'function') {
      const _dp = damagePlayer;
      damagePlayer = function () {
        const p = G.player;
        if (!(GFX.hitMarker || GFX.dmgNumbers) || !p) return _dp.apply(this, arguments);
        const gs = typeof GUARD !== 'undefined' ? GUARD.state : null;
        const hp0 = p.hp, par0 = gs ? gs.parried | 0 : 0, blk0 = gs ? gs.blocked | 0 : 0, src = cur;
        const r = _dp.apply(this, arguments);
        try {
          const lost = Math.max(0, hp0 - p.hp);
          const parried = !!gs && (gs.parried | 0) > par0, blocked = !!gs && (gs.blocked | 0) > blk0;
          if (GFX.dmgNumbers) { if (parried) addNumber('parry', 0, null); else if (lost > 0) addNumber(blocked ? 'blocked' : 'taken', lost, null); }
          if (GFX.hitMarker && lost > 0 && src && typeof src.x === 'number') addHit(src.x, src.y, src);
        } catch (e) { console.warn('hud11 hit failed', e); }
        return r;
      };
    }
    if (typeof attack === 'function') {
      const _at = attack;
      attack = function () {
        if (!(GFX.dmgNumbers || GFX.enemyBars) || !G.ents) return _at.apply(this, arguments);
        const before = snapEnemies();
        let top = 0;
        try { const w = currentWeapon(); top = w.dmg[1] + Math.floor(G.player.attrs.Strength / 25); if (!(w.dmg[1] > w.dmg[0])) top = 0; } catch (e) { top = 0; }
        const r = _at.apply(this, arguments);
        try { afterDealt(before, (d) => top > 0 && d >= top); } catch (e) { console.warn('hud11 dealt failed', e); }
        return r;
      };
    }
    if (typeof executeCustomSong === 'function') {
      const _es = executeCustomSong;
      executeCustomSong = function () {
        if (!(GFX.dmgNumbers || GFX.enemyBars) || !G.ents) return _es.apply(this, arguments);
        const before = snapEnemies();
        const r = _es.apply(this, arguments);
        try { afterDealt(before, null); } catch (e) { console.warn('hud11 song failed', e); }
        return r;
      };
    }
    if (typeof loadMap === 'function') {
      const _lm = loadMap;
      loadMap = function () { const r = _lm.apply(this, arguments); try { reset(); } catch (e) { /* cosmetic */ } return r; };
    }
    if (typeof render === 'function') {
      const _render = render;
      api.raw = { render: _render };
      render = function () {
        const r = _render.apply(this, arguments);
        try { if (anyOn()) draw(); } catch (e) { console.warn('hud11 draw failed', e); }
        return r;
      };
    }
    // Original and Low turn the five off (Low because they cost something every frame); any other preset leaves
    // the player's own choices alone. Medium and High do not switch them on: they start off.
    if (typeof GFX !== 'undefined' && GFX.onChange) {
      let last = GFX.preset;
      GFX.onChange(() => {
        if (GFX.preset === last) return;
        last = GFX.preset;
        if (['original', 'plain', 'low'].includes(last) && anyOn()) { for (const k of FLAGS) GFX[k] = false; reset(); save(); syncRows(); }
      });
    }
    if (typeof renderAccessibilityMenu === 'function') {
      const _acc = renderAccessibilityMenu;
      renderAccessibilityMenu = function () {
        const r = _acc.apply(this, arguments);
        try { appendRows(); } catch (e) { console.warn('hud11 rows failed', e); }
        return r;
      };
    }
  }

  // ---- Options rows (Graphics & access grid) -----------------------------------------------------------------------------------------
  const ROWS = [
    ['h11-marker', 'hitMarker', 'Hit-direction marker', 'a red arc at the edge of the view points at what hurt you'],
    ['h11-bars', 'enemyBars', 'Enemy health bars', 'a thin bar over the foe you aim at or just hit'],
    ['h11-nums', 'dmgNumbers', 'Damage numbers', 'small numbers float up from hits you deal and take'],
    ['h11-style', 'organPipes', 'HUD style', 'health, fatigue and Song power as bars or as organ pipes'],
    ['h11-still', 'stillTint', 'Stillness tint', 'the edges of the view darken the longer you stay still and quiet'],
  ];
  function el(tag, props, text) {
    const e = document.createElement(tag);
    if (props) for (const k in props) e.setAttribute(k, props[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function btnText(flag) { return flag === 'organPipes' ? (GFX.organPipes ? 'Organ pipes' : 'Bars') : (GFX[flag] ? 'On' : 'Off'); }
  function syncBtn(b, flag) { b.textContent = btnText(flag); b.setAttribute('aria-pressed', GFX[flag] ? 'true' : 'false'); b.classList.toggle('sel', !!GFX[flag]); }
  function syncRows() { for (const [id, flag] of ROWS) { const b = document.getElementById(id); if (b) syncBtn(b, flag); } }
  function appendRows() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById('h11-marker')) return;
    for (const [id, flag, label, hint] of ROWS) {
      const lab = el('span', { class: 'gfx-label' }, label); lab.appendChild(document.createTextNode(' ')); lab.appendChild(el('small', { class: 'muted' }, hint));
      const b = el('button', { class: 'dfbtn small', id, type: 'button', 'aria-label': label }, '');
      b.onclick = () => { setFlag(flag, !GFX[flag]); syncBtn(b, flag); };
      syncBtn(b, flag);
      grid.appendChild(lab); grid.appendChild(b);
    }
  }

  load();
  Object.assign(api, {
    FLAGS, stats, marks, nums, recent, MARK_CAP, MARK_LIFE, NUM_POOL, NUM_LIFE,
    bearing, addHit, addNumber, setFlag, appendRows, draw, drawPipes, tintAmount, reset, load, save, visible, barEligible,
    pipeGeometry: { x: PIPE_X, w: PIPE_W, fillTop: FILL_TOP, fillH: FILL_H },
  });
  // Object.assign would copy a getter's value, not the getter: define the live ones properly
  Object.defineProperties(api, {
    clock: { get() { return T; }, set(v) { T = v; }, enumerable: true },
    stillSeconds: { get() { return stillS; }, set(v) { stillS = v; }, enumerable: true },
    barsNow: { get() { return barsNow; }, enumerable: true },
  });
  try { wire(); } catch (e) { console.warn('hud11 wiring failed', e); }
  return api;
})();
if (typeof window !== 'undefined') window.HUD11 = HUD11;
