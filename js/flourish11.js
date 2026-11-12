// ============================================================
//  flourish11 — Phase 11 (feedback and feel): seven small presentation flourishes.
//    1. HIT-STOP     a 60-90 ms freeze of the simulation clock on a critical blow you land and on a parry (js/guard.js).
//    2. TRAILS       a faint arc behind fast melee swings in the first-person weapon view, tinted by material.
//    3. LEVEL-UP     musical notes rise along the screen edges with a short rising arpeggio (<= 2 s, any key skips).
//    4. QUEST BANNER a parchment banner unrolls across the top when a quest completes; queued, shown only in play.
//    5. LOOT FLIGHT  a picked-up item's icon flies from where it lay to the INV button (cap 4 at once).
//    6. COIN COUNT   buying/selling: coins tick between the purse chip and the merchant portrait with small clinks.
//    7. PAGE TURNS   a quick leaf-turn when changing pages in a held book/letter and when the logbook opens.
//
//  PRESENTATION ONLY. Nothing here changes a damage number, an AI decision, an RNG draw or a save:
//    - this module never calls Math.random (it has its own xorshift stream, used for layout jitter only);
//    - it writes no G.* field and no flag; every wrapper calls the original first (or, for the hit-stop, skips
//      whole update() steps, which is the same as the world holding its breath: every timer in the game is
//      dt-driven, so nothing "catches up" afterwards);
//    - hit-stop honours GFX.reduceMotion (no freeze); trails/notes/flights honour reduceMotion and GFX.noFlash.
//  "Critical hit": the game has no critical-hit roll. Presentation rule used here: a landed blow whose final damage
//  reaches the top of the weapon's damage range (max roll + Strength bonus), read AFTER attack() resolves by
//  comparing enemy hp before/after. It never feeds back into the game.
//  Settings (Options > Graphics & access): Flourishes (items 2-7) and Hit-stop (item 1), each a GFX.FX flag (so the
//  Original preset turns them off) AND a persisted switch (localStorage octave.flourish11.v1). Low preset: no trails,
//  no note particles (the per-frame ones); banner, coins and page turns are event-driven and stay.
//  Procedural stand-in art: notes, coins, parchment and leaf are CSS/SVG/canvas drawn here.
// ============================================================
'use strict';
/* eslint-disable no-func-assign */

for (const k of ['flourishes', 'hitstop']) {
  if (GFX[k] === undefined) GFX[k] = true;
  if (!GFX.FX.includes(k)) GFX.FX.push(k);
}

const FLOURISH11 = (() => {
  const KEY = 'octave.flourish11.v1';
  const set = { flourish: true, hitstop: true };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  // private random stream: nothing here may touch Math.random (that would shift the game's rolls)
  let rs = 0x2545f491;
  const rnd = () => { rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; return ((rs >>> 0) % 1000003) / 1000003; };
  const $q = (s) => document.querySelector(s);
  const reduced = () => !!GFX.reduceMotion;
  const calmLight = () => !!GFX.noFlash;

  function save() { try { localStorage.setItem(KEY, JSON.stringify({ f: set.flourish ? 1 : 0, h: set.hitstop ? 1 : 0 })); } catch (e) { /* no storage: fine */ } }
  function load() {
    try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && typeof o === 'object') { set.flourish = o.f !== 0; set.hitstop = o.h !== 0; } } catch (e) { /* ignore */ }
  }
  const flOn = () => set.flourish && GFX.flourishes !== false;
  const hsOn = () => set.hitstop && GFX.hitstop !== false && !reduced();
  const cheapOk = () => GFX.preset !== 'low';

  const stats = { hitstops: 0, trails: 0, levelups: 0, banners: 0, flights: 0, coinRuns: 0, turns: 0 };

  // ---------------------------------------------------------------- layers + style
  const CSS = `
#fl11-under, #fl11-over { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
#fl11-under { z-index: 4; }
#fl11-over { z-index: 8; }
.fl11-note { position: absolute; width: 3.1cqw; height: 4.2cqw; opacity: 0; filter: drop-shadow(0 0 3px rgba(255,214,120,.8)); }
.fl11-note svg { width: 100%; height: 100%; display: block; }
.fl11-banner { position: absolute; left: 50%; top: .8cqh; width: 54cqw; transform: translateX(-50%); display: none; }
.fl11-banner.on { display: block; }
.fl11-roll { position: absolute; top: -.5cqh; width: 2.2cqw; height: calc(100% + 1cqh); border-radius: 1.1cqw; background: linear-gradient(90deg, #5b3b1c, #b88a4a 45%, #6d4723); box-shadow: 0 .3cqh .8cqh rgba(0,0,0,.6); z-index: 1; }
.fl11-roll.l { left: -1.1cqw; } .fl11-roll.r { right: -1.1cqw; }
.fl11-sheet { position: relative; margin: 0 .6cqw; padding: .9cqh 2.2cqw; text-align: center; color: #2a1a0b; background: linear-gradient(180deg, #ecd9a7, #d8bf84 60%, #c9ad70); border-top: 2px solid #8a6a38; border-bottom: 2px solid #8a6a38; box-shadow: 0 .5cqh 1.2cqh rgba(0,0,0,.55); transform-origin: 50% 50%; overflow: hidden; }
.fl11-sheet small { display: block; font-family: var(--font-sc); font-size: 1.45cqw; letter-spacing: .12em; color: #6b4a22; }
.fl11-sheet b { display: block; font-family: var(--font-display); font-size: 2.5cqw; line-height: 1.2; color: #1c1208; font-weight: 700; }
#game.fl11-banner-up #msgs { top: 11.5cqh; transition: top .25s; }
.fl11-fly { position: absolute; left: 0; top: 0; width: 3.2cqw; height: 3.2cqw; will-change: transform; }
.fl11-fly > i { display: block; width: 100%; height: 100%; will-change: transform; }
.fl11-fly img { width: 100%; height: 100%; display: block; image-rendering: auto; filter: drop-shadow(0 0 3px rgba(0,0,0,.8)); }
.fl11-dot { display: block; width: 100%; height: 100%; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff1b8, #d9a441 55%, #8a5f1c); box-shadow: 0 0 3px rgba(0,0,0,.7); }
#fl11-over .fl11-leaf { position: absolute; box-shadow: inset -.8cqw 0 1.2cqw rgba(0,0,0,.28); will-change: transform, opacity; }
.fl11-purse { position: absolute; display: none; align-items: center; gap: .6cqw; padding: .3cqh 1.2cqw .3cqh .8cqw; font-family: var(--font-body); font-size: 2.3cqw; font-weight: 700; color: var(--gold, #d9a441); background: #0e0a07; border: 2px solid; border-color: var(--edge-d, #3a2a1a) var(--edge-l, #7a5e3a) var(--edge-l, #7a5e3a) var(--edge-d, #3a2a1a); }
.fl11-purse.on { display: flex; }
.fl11-purse .fl11-dot { width: 2.2cqw; height: 2.2cqw; }
`;
  function injectStyle() {
    if (typeof document === 'undefined' || document.getElementById('flourish11-style')) return;
    const st = document.createElement('style'); st.id = 'flourish11-style'; st.textContent = CSS; document.head.appendChild(st);
  }
  let under = null, over = null;
  function layers() {
    const game = $q('#game'); if (!game) return null;
    if (!under || !under.isConnected) { under = document.createElement('div'); under.id = 'fl11-under'; under.setAttribute('aria-hidden', 'true'); game.appendChild(under); }
    if (!over || !over.isConnected) { over = document.createElement('div'); over.id = 'fl11-over'; over.setAttribute('aria-hidden', 'true'); game.appendChild(over); }
    return { game, under, over };
  }
  const gameRect = () => { const g = $q('#game'); return g ? g.getBoundingClientRect() : { left: 0, top: 0, width: 1280, height: 800 }; };
  const anim = (el, frames, opts) => { try { return el.animate ? el.animate(frames, opts) : null; } catch (e) { return null; } };

  // ---------------------------------------------------------------- audio (own tiny voices on the sfx bus)
  function audioReady() { return typeof Audio_ !== 'undefined' && Audio_.ctx && Audio_.sfxBus && !Audio_.muted; }
  function ping(freq, when, dur, vol, type) {
    const ctx = Audio_.ctx, bus = Audio_.sfxBus, t0 = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  const ARP = [261.63, 329.63, 392.0, 523.25, 659.25];   // C major rising, a short bright arpeggio
  function playArpeggio() {
    if (!audioReady()) return false;
    try { ARP.forEach((f, i) => { ping(f, i * 0.085, 0.42, 0.11, 'triangle'); ping(f * 2, i * 0.085, 0.3, 0.035, 'sine'); }); return true; } catch (e) { return false; }
  }
  function clink(i) {
    if (!audioReady()) return false;
    try { const f = 2100 + (i % 3) * 260; ping(f, 0, 0.09, 0.05, 'triangle'); ping(f * 1.5, 0.012, 0.06, 0.02, 'sine'); return true; } catch (e) { return false; }
  }

  // ============================================================
  //  1. HIT-STOP
  // ============================================================
  const HS = { left: 0, frozen: 0, count: 0, last: '', CRIT_MS: 80, PARRY_MS: 65 };
  function hitStop(ms, why) {
    if (!hsOn() || typeof G === 'undefined' || G.state !== 'play') return false;
    HS.left = Math.max(HS.left, ms / 1000); HS.count++; HS.last = why; stats.hitstops++;
    return true;
  }
  function isCrit(w, dmg) {
    const p = G.player, bonus = Math.floor(((p && p.attrs && p.attrs.Strength) || 0) / 25);
    return !!w && Array.isArray(w.dmg) && dmg > 0 && dmg >= w.dmg[1] + bonus;
  }
  function wireCombat() {
    if (typeof attack === 'function') {
      const _attack = attack;
      attack = function () {
        let before = null, w = null;
        try { w = currentWeapon(); before = G.ents.filter(e => e.kind === 'enemy' && !e.dead).map(e => [e, e.hp]); } catch (e) { before = null; }
        const r = _attack.apply(this, arguments);
        try {
          if (before) for (const [e, hp] of before) {
            const dmg = hp - e.hp;
            if (dmg > 0 && isCrit(w, dmg)) { hitStop(HS.CRIT_MS, 'crit'); break; }
          }
        } catch (e) { console.warn('flourish11 crit read failed', e); }
        return r;
      };
    }
    if (typeof damagePlayer === 'function') {
      const _dp = damagePlayer;
      damagePlayer = function () {
        const gs = typeof GUARD !== 'undefined' ? GUARD.state : null, p0 = gs ? gs.parried : 0;
        const r = _dp.apply(this, arguments);
        try { if (gs && gs.parried > p0) hitStop(HS.PARRY_MS, 'parry'); } catch (e) { /* presentation only */ }
        return r;
      };
    }
  }

  // ============================================================
  //  2. WEAPON TRAILS
  // ============================================================
  const TINT = { iron: [255, 228, 186], bronze: [255, 190, 98], glass: [110, 232, 255], wood: [196, 176, 146] };
  const materialOf = (w) => (w && w.img === 'fp_hands') ? 'wood' : (w && TINT[w.type]) ? w.type : 'iron';
  const trailAlpha = () => (calmLight() ? 0.16 : 0.34);
  const TRAIL = { last: null };
  function tipAt(w, f, dirLabel, iw, ih, bx, bob) {
    const pose = animWeaponPose(w, f, dirLabel), ox = bx + pose.x + iw * 0.5, oy = VIEW_H + 12 + pose.y + bob * 1.5;
    const sin = Math.sin(pose.rotation), cos = Math.cos(pose.rotation);
    const at = (k) => { const ly = (-ih * k + 12) * pose.scale; return [ox - ly * sin, oy + ly * cos]; };
    return { tip: at(0.97), root: at(0.7) };
  }
  function trailPoints(w, prog, dirLabel) {
    const img = Engine.images[w.img]; if (!img) return null;
    const iw = img.width * 0.5, ih = img.height * 0.5;
    const bx = w.img === 'fp_hands' ? VW / 2 - iw / 2 : w.center ? VW / 2 - iw / 2 + 22 : VW - iw - 10;
    const bob = Engine.cam.bob || 0, out = [];
    for (let k = 0; k <= 6; k++) { const f = clamp(prog - k * 0.035, 0.05, 1); out.push(tipAt(w, f, dirLabel, iw, ih, bx, bob)); }
    return out;
  }
  function drawTrail(ctx) {
    const w = currentWeapon(); if (!w || w.ranged || !(w.speed <= 0.65)) return false;
    if (G.attack.t <= 0 || G.song.t > 0 || G.songFx > 0) return false;
    const prog = 1 - G.attack.t / G.attack.dur; if (prog < 0.16 || prog > 0.92) return false;
    const pts = trailPoints(w, prog, G.attack.dirLabel); if (!pts) return false;
    const mat = materialOf(w), c = TINT[mat], a0 = trailAlpha() * (mat === 'wood' ? 0.6 : 1);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VW, VIEW_H); ctx.clip();
    for (let i = 0; i < pts.length - 1; i++) {
      const A = pts[i], B = pts[i + 1], fade = 1 - i / (pts.length - 1);
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(a0 * fade * fade).toFixed(3)})`;
      ctx.beginPath(); ctx.moveTo(A.tip[0], A.tip[1]); ctx.lineTo(B.tip[0], B.tip[1]); ctx.lineTo(B.root[0], B.root[1]); ctx.lineTo(A.root[0], A.root[1]); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(a0 * 1.2).toFixed(3)})`; ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(pts[0].tip[0], pts[0].tip[1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].tip[0], pts[i].tip[1]); ctx.stroke();
    ctx.restore();
    TRAIL.last = { mat, n: pts.length }; stats.trails++;
    return true;
  }
  function wireTrails() {
    if (typeof drawHUD !== 'function') return;
    const _hud = drawHUD;
    drawHUD = function () {
      try { if (flOn() && cheapOk() && !reduced() && G.player && G.attack && G.attack.t > 0) drawTrail(Engine.ctx); } catch (e) { if (!TRAIL.warned) { TRAIL.warned = true; console.warn('flourish11 trail failed', e); } }
      return _hud.apply(this, arguments);
    };
  }

  // ============================================================
  //  3. LEVEL-UP
  // ============================================================
  const NOTE_SVG = '<svg viewBox="0 0 12 16" aria-hidden="true"><ellipse cx="4" cy="12.4" rx="3.5" ry="2.6" transform="rotate(-22 4 12.4)" fill="#ffd978" stroke="#2a1a0b" stroke-width="1"/><path d="M7.2 11.4V1.6c1.2 2.8 3.8 3 4.2 6.2" fill="none" stroke="#ffd978" stroke-width="1.6" stroke-linecap="round"/></svg>';
  const LV = { notes: [], timer: 0, skip: null, active: false, dur: 1900 };
  function stopLevel() {
    for (const n of LV.notes) { try { n.remove(); } catch (e) { /* gone */ } }
    LV.notes.length = 0; clearTimeout(LV.timer); LV.active = false;
    if (LV.skip) { document.removeEventListener('keydown', LV.skip, true); document.removeEventListener('pointerdown', LV.skip, true); LV.skip = null; }
  }
  function levelFlourish(level) {
    stats.levelups++;
    playArpeggio();
    const L = layers(); if (!L) return false;
    stopLevel(); LV.active = true;
    const dim = calmLight() ? 0.5 : 0.9;
    if (cheapOk()) for (let i = 0; i < 12; i++) {
      const side = i % 2, el = document.createElement('div'); el.className = 'fl11-note'; el.innerHTML = NOTE_SVG;
      const gx = 1.5 + rnd() * 5, y0 = 82 - rnd() * 14, rise = 34 + rnd() * 24, sway = (rnd() - 0.5) * 3;
      el.style.left = (side ? (100 - gx - 3.1) : gx) + 'cqw'; el.style.top = y0 + 'cqh';
      L.under.appendChild(el); LV.notes.push(el);
      if (reduced()) { anim(el, [{ opacity: 0 }, { opacity: dim * 0.7, offset: 0.25 }, { opacity: dim * 0.7, offset: 0.7 }, { opacity: 0 }], { duration: 1200, delay: i * 30, fill: 'forwards' }); }
      else { anim(el, [{ opacity: 0, transform: 'translate(0, 0) scale(.7)' }, { opacity: dim, offset: 0.2 }, { opacity: dim, offset: 0.7 }, { opacity: 0, transform: `translate(${sway}cqw, -${rise}cqh) scale(1)` }], { duration: 1100, delay: i * 70, easing: 'ease-out', fill: 'forwards' }); }
    }
    LV.skip = () => stopLevel();
    setTimeout(() => { if (LV.active && LV.skip) { document.addEventListener('keydown', LV.skip, true); document.addEventListener('pointerdown', LV.skip, true); } }, 250);
    LV.timer = setTimeout(stopLevel, LV.dur);
    LV.last = level;
    return true;
  }
  function wireLevel() {
    if (typeof checkLevel !== 'function') return;
    const _cl = checkLevel;
    checkLevel = function () {
      const lv0 = G.player ? G.player.level : 0;
      const r = _cl.apply(this, arguments);
      try { if (flOn() && G.player && G.player.level > lv0) levelFlourish(G.player.level); } catch (e) { console.warn('flourish11 level-up failed', e); }
      return r;
    };
  }

  // ============================================================
  //  4. QUEST-COMPLETE BANNER
  // ============================================================
  // Quests complete through scattered code (questXp + journal in dialogue choices, flags set by side-quest modules,
  // bounties). Two detectors feed one queue: (a) a questXp(>=40) paired with a side/main journal() entry in the same
  // call stack, named from the entry's own opening words; (b) a watch on a short table of flags for quests that
  // complete without a titled journal line. Names in TABLE marked [PROPOSED] are invented; the rest are the game's words.
  const TABLE = [
    ['bounty_1_done', 'Writ of Clearing'],
    ['bounty_2_done', 'Scribe\'s Commission'],
    ['p9q_pellow_done', 'A New Reed for Joram'],      // [PROPOSED]
    ['p9q_tomas_done', 'Tomas\'s Last Load'],         // [PROPOSED]
    ['p9q_bees_done', 'Telling the Bees'],            // [PROPOSED]
    ['p6t_done', 'Tobin\'s Journal'],
    ['p9p_filed', 'The Greenroot Register'],          // [PROPOSED]
    ['p9p_kept', 'The Greenroot Register'],           // [PROPOSED]
  ];
  const BN = { queue: [], active: null, seen: new Map(), shown: [], el: null, flagsRef: null, baseline: null, scanT: 0, gap: 0, MAX_Q: 6, HOLD: 2600, IN: 480, OUT: 420 };
  function nameFromJournal(text) {
    const t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim(); if (!t) return '';
    let m = t.indexOf(':'); if (m > 2 && m <= 48) return t.slice(0, m);
    m = t.search(/[.,;]/); if (m > 2 && m <= 48) return t.slice(0, m);
    if (t.length <= 48) return t;
    const cut = t.slice(0, 44), sp = cut.lastIndexOf(' ');
    return (sp > 20 ? cut.slice(0, sp) : cut) + '…';
  }
  function enqueueQuest(name) {
    name = String(name || '').trim(); if (!name || !flOn()) return false;
    const key = name.toLowerCase(), now = Date.now();
    const prev = BN.seen.get(key); if (prev && now - prev < 6000) return false;   // the same completion seen by both detectors
    BN.seen.set(key, now);
    if (BN.queue.length >= BN.MAX_Q) BN.queue.shift();
    BN.queue.push(name); return true;
  }
  function scanFlags() {
    const f = (typeof G !== 'undefined' && G.flags && typeof G.flags === 'object') ? G.flags : null; if (!f) return 0;
    if (BN.flagsRef !== f) { BN.flagsRef = f; BN.baseline = {}; for (const [k] of TABLE) BN.baseline[k] = f[k] === true; return 0; }   // new game or load: nothing "completes"
    let n = 0;
    for (const [k, name] of TABLE) {
      const now = f[k] === true;
      if (now && !BN.baseline[k]) { BN.baseline[k] = true; if (enqueueQuest(name)) n++; }
      else if (!now) BN.baseline[k] = false;
    }
    return n;
  }
  const PEND = { xp: 0, text: '', scheduled: false };
  function flushPending() {
    PEND.scheduled = false;
    const xp = PEND.xp, text = PEND.text; PEND.xp = 0; PEND.text = '';
    try {
      if (scanFlags() > 0) return;                       // a table quest explains this questXp: do not announce it twice
      if (xp >= 40 && text) enqueueQuest(nameFromJournal(text));
    } catch (e) { console.warn('flourish11 quest detect failed', e); }
  }
  function schedule() { if (PEND.scheduled) return; PEND.scheduled = true; Promise.resolve().then(flushPending); }
  function wireQuests() {
    if (typeof questXp === 'function') {
      const _q = questXp;
      questXp = function (n) { try { if (n >= 40) { PEND.xp = Math.max(PEND.xp, n); schedule(); } } catch (e) { /* presentation only */ } return _q.apply(this, arguments); };
    }
    if (typeof journal === 'function') {
      const _j = journal;
      journal = function (cat, text) { try { if (cat === 'side' || cat === 'main') { PEND.text = text; schedule(); } } catch (e) { /* presentation only */ } return _j.apply(this, arguments); };
    }
  }
  const blockedForBanner = () => typeof G === 'undefined' || G.state !== 'play';
  function showBanner(name) {
    const L = layers(); if (!L) return false;
    const el = document.createElement('div'); el.className = 'fl11-banner on'; el.setAttribute('role', 'status');
    el.innerHTML = '<span class="fl11-roll l"></span><span class="fl11-roll r"></span><div class="fl11-sheet"><small></small><b></b></div>';
    el.querySelector('small').textContent = 'Quest complete';
    el.querySelector('b').textContent = name;
    L.under.appendChild(el); BN.el = el; stats.banners++; BN.shown.push(name);
    if (BN.shown.length > 30) BN.shown.shift();
    L.game.classList.add('fl11-banner-up');
    const sheet = el.querySelector('.fl11-sheet'), rl = el.querySelector('.fl11-roll.l'), rr = el.querySelector('.fl11-roll.r');
    if (reduced()) { anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 160, fill: 'forwards' }); }
    else {
      anim(sheet, [{ transform: 'scaleX(.04)' }, { transform: 'scaleX(1)' }], { duration: BN.IN, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
      anim(rl, [{ transform: 'translateX(26cqw)' }, { transform: 'translateX(0)' }], { duration: BN.IN, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
      anim(rr, [{ transform: 'translateX(-26cqw)' }, { transform: 'translateX(0)' }], { duration: BN.IN, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
    }
    return true;
  }
  function hideBanner(el) {
    const game = $q('#game');
    const done = () => { try { el.remove(); } catch (e) { /* gone */ } if (BN.el === el) BN.el = null; if (game && !BN.queue.length) game.classList.remove('fl11-banner-up'); };
    if (reduced()) { const a = anim(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }); if (a) a.onfinish = done; else done(); return; }
    const sheet = el.querySelector('.fl11-sheet'), rl = el.querySelector('.fl11-roll.l'), rr = el.querySelector('.fl11-roll.r');
    const a = anim(sheet, [{ transform: 'scaleX(1)' }, { transform: 'scaleX(.04)' }], { duration: BN.OUT, easing: 'ease-in', fill: 'forwards' });
    anim(rl, [{ transform: 'translateX(0)' }, { transform: 'translateX(26cqw)' }], { duration: BN.OUT, easing: 'ease-in', fill: 'forwards' });
    anim(rr, [{ transform: 'translateX(0)' }, { transform: 'translateX(-26cqw)' }], { duration: BN.OUT, easing: 'ease-in', fill: 'forwards' });
    if (a) a.onfinish = done; else done();
  }
  function bannerPump(dt) {
    if (BN.active) return;
    if (BN.gap > 0) { BN.gap -= dt; return; }
    if (!BN.queue.length || blockedForBanner()) return;
    const name = BN.queue.shift();
    if (!showBanner(name)) return;
    const el = BN.el; BN.active = { name, el };
    setTimeout(() => { hideBanner(el); setTimeout(() => { BN.active = null; BN.gap = 0.2; }, reduced() ? 180 : BN.OUT + 40); }, (reduced() ? 160 : BN.IN) + BN.HOLD);
  }

  // ============================================================
  //  5. LOOT FLYING TO THE INVENTORY
  // ============================================================
  const FLY = { active: 0, MAX: 4, last: null };
  // The HUD team may move the INV control: they can mark any element with data-flourish-target="inventory",
  // or provide window.HUD11.invAnchor() returning {x, y} in client pixels.
  function invTarget() {
    try {
      if (typeof HUD11 !== 'undefined' && HUD11 && typeof HUD11.invAnchor === 'function') { const a = HUD11.invAnchor(); if (a && isFinite(a.x) && isFinite(a.y)) return a; }
    } catch (e) { /* fall through */ }
    const mark = $q('[data-flourish-target="inventory"]');
    if (mark) { const r = mark.getBoundingClientRect(); if (r.width) return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    const cv = $q('#view'); if (!cv) return null; const r = cv.getBoundingClientRect(), sx = r.width / VW, sy = r.height / VH;
    let b = null; try { b = HUD_BTNS.find(x => x.t === 'INV'); } catch (e) { b = null; }
    if (b) return { x: r.left + (b.x + b.w / 2) * sx, y: r.top + (b.y + b.h / 2) * sy };
    return { x: r.left + 12 * sx, y: r.top + (VH - 12) * sy };
  }
  function pickupSource(e) {
    const cv = $q('#view'); if (!cv) return null; const r = cv.getBoundingClientRect(), sx = r.width / VW, sy = r.height / VH;
    const s = e && e._screen;
    if (s && isFinite(s.x0) && isFinite(s.x1)) return { x: r.left + ((s.x0 + s.x1) / 2) * sx, y: r.top + ((s.y0 + s.y1) / 2) * sy };
    return { x: r.left + (VW / 2) * sx, y: r.top + (VIEW_H * 0.7) * sy };    // not on screen (just stepped over it): the foot of the view
  }
  function iconFor(id) {
    let u = null; try { if (typeof ICONS !== 'undefined' && typeof id === 'string' && Object.prototype.hasOwnProperty.call(ITEMS, id)) u = ICONS.url(id); } catch (e) { u = null; }
    const wrap = document.createElement('i');
    if (u) { const im = document.createElement('img'); im.alt = ''; im.src = u; wrap.appendChild(im); } else { const d = document.createElement('span'); d.className = 'fl11-dot'; wrap.appendChild(d); }
    return wrap;
  }
  function flyItem(id, from, to) {
    const L = layers(); if (!L || !from || !to) return false;
    if (FLY.active >= FLY.MAX) return false;
    const gr = L.game.getBoundingClientRect(), half = gr.width * 0.016;
    const x0 = from.x - gr.left - half, y0 = from.y - gr.top - half, x1 = to.x - gr.left - half, y1 = to.y - gr.top - half;
    const el = document.createElement('div'); el.className = 'fl11-fly'; el.appendChild(iconFor(id)); L.under.appendChild(el);
    FLY.active++; stats.flights++; FLY.last = { id, from: [x0, y0], to: [x1, y1] };
    const end = () => { FLY.active = Math.max(0, FLY.active - 1); try { el.remove(); } catch (e) { /* gone */ } };
    if (reduced()) {
      el.style.transform = `translate(${x1}px, ${y1}px)`;
      const a = anim(el, [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], { duration: 500 }); if (a) a.onfinish = end; else end();
      return true;
    }
    const inner = el.firstChild, dur = 640;
    el.style.transform = `translate(${x0}px, ${y0}px)`;
    const ax = anim(el, [{ transform: `translate(${x0}px, ${y0}px)` }, { transform: `translate(${x1}px, ${y1}px)` }], { duration: dur, easing: 'cubic-bezier(.5,0,.8,.6)', fill: 'forwards' });
    const lift = Math.min(gr.height * 0.18, Math.abs(y1 - y0) * 0.6 + 20);
    anim(inner, [{ transform: 'translateY(0) scale(1)', opacity: 1 }, { transform: `translateY(${-lift}px) scale(1.25)`, opacity: 1, offset: 0.35 }, { transform: 'translateY(0) scale(.4)', opacity: 0.2 }], { duration: dur, easing: 'ease-in-out', fill: 'forwards' });
    if (ax) ax.onfinish = end; else end();
    return true;
  }
  function wireLoot() {
    if (typeof pickUp !== 'function') return;
    const _pu = pickUp;
    pickUp = function (e) {
      const was = !!e && !e.dead && !e.hidden;
      let src = null, item = null;
      try { if (was && flOn()) { src = pickupSource(e); item = e.item; } } catch (er) { src = null; }
      const r = _pu.apply(this, arguments);
      try { if (was && src && e.hidden && flOn()) flyItem(item, src, invTarget()); } catch (er) { console.warn('flourish11 loot flight failed', er); }
      return r;
    };
  }

  // ============================================================
  //  6. COINS COUNTED OUT IN SHOPS
  // ============================================================
  const CO = { last: null, shown: 0, seen: null, chip: null, tween: 0, coins: [], timers: [], runs: 0 };
  function chipEl() {
    const L = layers(); if (!L) return null;
    if (!CO.chip || !CO.chip.isConnected) {
      const c = document.createElement('div'); c.className = 'fl11-purse'; c.setAttribute('role', 'img'); c.setAttribute('aria-label', 'Purse');
      c.innerHTML = '<span class="fl11-dot"></span><span class="fl11-amt"></span>'; L.over.appendChild(c); CO.chip = c;
    }
    return CO.chip;
  }
  function placeChip() {
    const c = chipEl(), panel = $q('#modal-panel'); if (!c || !panel) return null;
    const gr = gameRect(), pr = panel.getBoundingClientRect();
    c.classList.add('on');
    c.style.left = Math.max(0, pr.right - gr.left - c.offsetWidth - gr.width * 0.012) + 'px';
    c.style.top = Math.max(0, pr.top - gr.top + gr.height * 0.012) + 'px';
    return c;
  }
  function setAmt(n) { CO.shown = n; if (CO.chip) CO.chip.querySelector('.fl11-amt').textContent = String(Math.round(n)); }
  function clearCoins() {
    for (const t of CO.timers) clearTimeout(t); CO.timers.length = 0;
    clearInterval(CO.tween); CO.tween = 0;
    for (const c of CO.coins) { try { c.remove(); } catch (e) { /* gone */ } } CO.coins.length = 0;
  }
  function hideChip() { if (CO.chip) CO.chip.classList.remove('on'); clearCoins(); }
  function centreOf(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  function coinRun(delta, to) {
    const L = layers(), chip = placeChip(), port = $q('#modal-panel .dlg .port img'); if (!L || !chip || !port) { setAmt(to); return false; }
    const from0 = CO.shown; clearCoins(); stats.coinRuns++; CO.runs++;
    const spend = delta < 0, n = clamp(Math.ceil(Math.abs(delta) / 6), 1, 9);
    const gr = L.game.getBoundingClientRect(), sz = gr.width * 0.018;
    const cc = centreOf(chip), pc = centreOf(port);
    const A = spend ? cc : pc, B = spend ? pc : cc, step = 55, dur = 520;
    if (reduced()) { setAmt(to); clink(0); CO.last = { delta, n, spend, instant: true }; return true; }
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div'); el.className = 'fl11-fly'; el.style.width = el.style.height = sz + 'px';
      el.innerHTML = '<i><span class="fl11-dot"></span></i>'; L.over.appendChild(el); CO.coins.push(el);
      const jx = (rnd() - 0.5) * sz * 2, jy = (rnd() - 0.5) * sz * 2;
      const x0 = A.x - gr.left - sz / 2, y0 = A.y - gr.top - sz / 2, x1 = B.x - gr.left - sz / 2 + jx, y1 = B.y - gr.top - sz / 2 + jy;
      el.style.opacity = '0';
      const a = anim(el, [{ transform: `translate(${x0}px, ${y0}px)`, opacity: 1 }, { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - sz * 3}px)`, opacity: 1, offset: 0.5 }, { transform: `translate(${x1}px, ${y1}px)`, opacity: 1 }], { duration: dur, delay: i * step, easing: 'ease-in-out', fill: 'both' });
      CO.timers.push(setTimeout(() => { clink(i); try { el.style.visibility = 'hidden'; } catch (e) { /* gone */ } }, i * step + dur));
      if (!a) el.style.opacity = '1';
    }
    // the purse counter ticks over the same stretch of time
    const total = (n - 1) * step + dur, t0 = performance.now();
    CO.tween = setInterval(() => {
      const u = clamp((performance.now() - t0) / total, 0, 1);
      setAmt(from0 + (to - from0) * u);
      if (u >= 1) { clearInterval(CO.tween); CO.tween = 0; setAmt(to); }
    }, 40);
    CO.timers.push(setTimeout(() => { for (const c of CO.coins) { try { c.remove(); } catch (e) { /* gone */ } } CO.coins.length = 0; }, total + 120));
    CO.last = { delta, n, spend, total };
    return true;
  }
  function wireShop() {
    if (typeof renderDialogue !== 'function') return;
    const _rd = renderDialogue;
    renderDialogue = function (mode) {
      const r = _rd.apply(this, arguments);
      try {
        const gold = G.player ? G.player.gold : 0, shop = flOn() && (mode === 'buy' || mode === 'sell');
        if (!shop) { hideChip(); CO.last = null; }
        else {
          const chip = placeChip();
          if (chip) {
            if (CO.seen == null) setAmt(gold);
            else if (gold !== CO.seen) coinRun(gold - CO.seen, gold);
            else if (!CO.tween) setAmt(gold);
          }
        }
        CO.seen = gold;
      } catch (e) { console.warn('flourish11 coin count failed', e); }
      return r;
    };
  }
  function shopPump() {
    if (CO.seen != null && (G.openPanel !== 'dialogue' || G.state === 'play')) { CO.seen = null; hideChip(); }
  }

  // ============================================================
  //  7. PAGE TURNS
  // ============================================================
  // The leaf is an overlay sheet that swings away over the target and reveals what is already underneath, so the
  // page's own boxes are never transformed (measuring tools and screen readers see the real layout at once).
  const PT = { obs: null, lastPage: new WeakMap(), anim: null, leaf: null, last: null, DUR: 280 };
  function clearLeaf() { if (PT.anim) { try { PT.anim.cancel(); } catch (e) { /* done */ } PT.anim = null; } if (PT.leaf) { try { PT.leaf.remove(); } catch (e) { /* gone */ } PT.leaf = null; } }
  function turnLeaf(el, dir, tone) {
    if (!el || !flOn() || reduced()) return false;
    const L = layers(); if (!L) return false;
    clearLeaf();
    const r = el.getBoundingClientRect(), gr = L.game.getBoundingClientRect(); if (!(r.width > 4 && r.height > 4)) return false;
    const leaf = document.createElement('div'); leaf.className = 'fl11-leaf';
    let paper = '#e6d5a8'; try { const sh = el.closest('.hd-sheet'); if (sh) paper = getComputedStyle(sh).backgroundColor || paper; } catch (e) { /* default paper */ }
    leaf.style.cssText = `left:${r.left - gr.left}px;top:${r.top - gr.top}px;width:${r.width}px;height:${r.height}px;transform-origin:${dir > 0 ? '0% 50%' : '100% 50%'};` +
      (tone === 'dark' ? 'background:linear-gradient(90deg,#17110b,#2a2018 60%,#17110b);' : `background:linear-gradient(${dir > 0 ? 90 : 270}deg,${paper} 70%,rgba(60,40,20,.35));background-color:${paper};`);
    L.over.appendChild(leaf); PT.leaf = leaf;
    PT.anim = anim(leaf, [
      { transform: 'perspective(1100px) rotateY(0deg)', opacity: 0.96 },
      { transform: `perspective(1100px) rotateY(${dir > 0 ? -86 : 86}deg)`, opacity: 0.2 }], { duration: PT.DUR, easing: 'ease-in' });
    const mine = leaf, done = () => { try { mine.remove(); } catch (e) { /* gone */ } if (PT.leaf === mine) { PT.leaf = null; PT.anim = null; } };
    if (PT.anim) PT.anim.onfinish = done; else done();
    PT.last = { dir, at: Date.now() }; stats.turns++;
    return true;
  }
  function onCount(span) {
    const m = /(\d+)\D+(\d+)/.exec(span.textContent || ''); if (!m) return;
    const page = +m[1], total = +m[2], prev = PT.lastPage.get(span);
    PT.lastPage.set(span, { page, total });
    if (!prev || prev.total !== total || prev.page === page) return;     // first draw, a re-flow (text size) or no change
    const sheet = span.closest('.hd-sheet');
    turnLeaf(sheet && sheet.querySelector('.hd-body'), page > prev.page ? 1 : -1, 'paper');
  }
  function wirePages() {
    const ev = $q('#event-panel'); if (!ev || typeof MutationObserver !== 'function') return;
    PT.obs = new MutationObserver((list) => {
      if (!flOn()) return;
      for (const m of list) {
        const t = m.target, el = t.nodeType === 1 ? t : t.parentNode;
        const span = el && el.classList && el.classList.contains('hd-count') ? el : null;
        if (span) { try { onCount(span); } catch (e) { /* presentation only */ } }
      }
    });
    PT.obs.observe(ev, { childList: true, subtree: true, characterData: true });
    if (typeof renderLog === 'function') {
      const _rl = renderLog;
      renderLog = function () {
        const r = _rl.apply(this, arguments);
        try { turnLeaf($q('#modal-panel'), 1, 'dark'); } catch (e) { console.warn('flourish11 logbook turn failed', e); }
        return r;
      };
    }
  }

  // ============================================================
  //  frame pump + wiring
  // ============================================================
  function wireUpdate() {
    if (typeof update !== 'function') return;
    const _up = update;
    update = function (dt) {
      try {
        shopPump();
        BN.scanT -= dt; if (BN.scanT <= 0) { BN.scanT = 0.3; scanFlags(); }
        bannerPump(dt);
      } catch (e) { /* presentation only */ }
      if (HS.left > 0) {
        if (G.state !== 'play' || !hsOn()) HS.left = 0;
        else { HS.left -= dt; HS.frozen += dt; return; }   // the world holds its breath; nothing else advances
      }
      return _up.apply(this, arguments);
    };
  }

  // ---------------------------------------------------------------- Options rows
  const ROWS = [
    ['f11-flourish', 'Flourishes', 'weapon trails, level-up notes, quest banners, loot and coins in motion, page turns', 'flourish'],
    ['f11-hitstop', 'Hit-stop', 'a brief freeze on a hard blow or a parry', 'hitstop'],
  ];
  function syncBtn(b, key) { b.textContent = set[key] ? 'On' : 'Off'; b.setAttribute('aria-pressed', set[key] ? 'true' : 'false'); b.classList.toggle('sel', !!set[key]); }
  function setSwitch(key, v) {
    set[key] = !!v; save();
    if (key === 'hitstop' && !set.hitstop) HS.left = 0;
    if (key === 'flourish' && !set.flourish) { stopLevel(); clearCoins(); hideChip(); BN.queue.length = 0; }
    const id = (ROWS.find(r => r[3] === key) || [])[0], b = id && document.getElementById(id); if (b) syncBtn(b, key);
    return set[key];
  }
  function appendRows() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById('f11-flourish')) return;
    let anchor = document.getElementById('m10-parry') || document.getElementById('rp-toggle') || document.getElementById('ac-cap');
    for (const [id, label, hint, key] of ROWS) {
      const lab = document.createElement('span'); lab.className = 'gfx-label'; lab.id = id + '-label'; lab.textContent = label + ' ';
      const small = document.createElement('small'); small.className = 'muted'; small.textContent = hint; lab.appendChild(small);
      const b = document.createElement('button'); b.className = 'dfbtn small'; b.id = id; b.type = 'button'; b.setAttribute('aria-label', label);
      b.onclick = () => setSwitch(key, !set[key]);
      syncBtn(b, key);
      if (anchor && anchor.parentNode) { anchor.insertAdjacentElement('afterend', b); anchor.insertAdjacentElement('afterend', lab); anchor = b; }
      else { grid.appendChild(lab); grid.appendChild(b); }
    }
  }
  function wireMenu() {
    if (typeof renderAccessibilityMenu !== 'function') return;
    const _acc = renderAccessibilityMenu;
    renderAccessibilityMenu = function () {
      const r = _acc.apply(this, arguments);
      try { appendRows(); } catch (e) { console.warn('flourish11 rows failed', e); }
      return r;
    };
  }

  load();
  const init = () => {
    try { injectStyle(); layers(); wirePages(); } catch (e) { console.warn('flourish11 setup failed', e); }
    try { wireMenu(); } catch (e) { console.warn('flourish11 menu failed', e); }
  };
  try { wireCombat(); wireTrails(); wireLevel(); wireQuests(); wireLoot(); wireShop(); wireUpdate(); } catch (e) { console.warn('flourish11 wiring failed', e); }
  GFX.onChange(() => { try { if (!flOn()) { stopLevel(); clearCoins(); hideChip(); clearLeaf(); BN.queue.length = 0; } if (!hsOn()) HS.left = 0; } catch (e) { /* ignore */ } });
  if (typeof document !== 'undefined' && document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  return {
    settings: set, setSwitch, stats, on: { flourishes: flOn, hitstop: hsOn },
    hitstop: { state: HS, fire: hitStop, isCrit },
    trail: { points: trailPoints, draw: drawTrail, materialOf, TINT, state: TRAIL },
    level: { fire: levelFlourish, state: LV, arpeggio: playArpeggio },
    banner: { enqueue: enqueueQuest, queue: BN.queue, state: BN, TABLE, nameFromJournal, scan: scanFlags, pump: bannerPump },
    loot: { fly: flyItem, state: FLY, target: invTarget, source: pickupSource },
    coins: { run: coinRun, state: CO },
    pages: { turn: turnLeaf, state: PT },
    clink,
  };
})();
if (typeof window !== 'undefined') window.FLOURISH11 = FLOURISH11;
