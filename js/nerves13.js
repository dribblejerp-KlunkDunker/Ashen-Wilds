// ============================================================
//  nerves13 — Phase 13 (the Hush comes closer): the Jump-scare switch, whispers from behind, lights dying one by one.
//
//  1. JUMP SCARES (Options > Graphics & access > "Jump scares": Off / Gentle / Full, default Gentle, localStorage
//     octave.nerves13.v1). The API other teams call (kept stable):
//        window.NERVES13.scaresAllowed()  -> 'off' | 'gentle' | 'full'
//        window.NERVES13.onChange(fn)     -> fn('off'|'gentle'|'full') on every real change; returns an unsubscribe function
//     Helpers for the same purpose: NERVES13.pick(full, gentle, off), NERVES13.stingerGain() (1 / 0.5 / 0.22),
//     NERVES13.attackSeconds() (0.02 / 0.3 / 0.9). Rule for every team: a sudden loud sound or a sudden full-screen image
//     checks scaresAllowed() and falls back to a quiet, slow version (a swell, a fade) unless it is 'full'.
//     What this module does itself, by WRAPPING (no other file is edited):
//        sudden loud sounds   Audio_.sfx crack / press / golem / hound / thunder / bellDie. Off or Gentle: the effect bus
//                             is held down for the moment and swells in (Off: peak 0.22 over 0.9 s; Gentle: peak 0.5 over
//                             0.3 s), then returns. Full: untouched.
//        sudden full-screen   the death screen fades in (Off 1.6 s, Gentle 0.7 s); the red/cyan/gold/green view flashes
//                             (#fx) ease in (Off 600 ms at 55%, Gentle 300 ms at 80%); lightning is capped (Off 0.45,
//                             Gentle 0.7 of full) and never above the engine's own No flashes setting.
//     Dread's false foe, its shadow and its stalker already arrive by slow fades, and are left as they are.
//
//  2. WHISPERS FROM BEHIND (only when Dread is On and Dissonance is above 55; DREAD's own half-syllables start at 45).
//     A fragment is 3-6 breathy half-syllables (noise through two moving formant filters, fricative hiss, the front or the
//     back of the word cut off, the envelope of every other syllable run backwards), never a word, no recorded voice.
//     The source sits 2.4-4.6 cells BEHIND the listener (within 20 degrees of straight back), anchored in the world; the
//     pan, gain and low-pass are js/spatial-audio.js's own maths plus a rear low-pass (a sound behind the head is duller).
//     Turn round (the source moves into the front 120 degrees) and the fragment is cut off in 0.12 s: it was never there.
//     Never in dialogue, panels, cutscenes or after death, never near a boss or a chasing foe, never in the Hedge. Gap
//     between fragments: 26 s at Dissonance 55 down to 9 s at 100 (x 0.75-1.25). Caption "[whispering behind you]" with
//     Sound captions on.
//
//  3. LIGHTS DYING ONE BY ONE ("Dying lights", Options, default On; GFX.dyingLights, off in the Original preset).
//     Five long interior corridors get wall torches (transient entities, never saved) and, when their condition holds,
//     the torches AHEAD of the player go out one at a time (first after 1.3 s, then every 1.7-2.6 s), each with a soft
//     gutter sound (a low flame, a flicker unless Reduce motion / No flashes, then out). They relight, one by one, 4 s
//     after the player has left, or 55 s after the first one went out, at once on leaving the map, and when the switch
//     goes off. Only the picture goes dark: the player's lantern still lights the way, nothing is spawned, no damage, no
//     door or lock reads a torch, nothing is written to the save.
//        corridor (map)                                   cells                      when
//        rv_gallery   The Root-vault gallery   (rootvault)   y=5,  x=3..19              always (Hush-touched)
//        cat_west     The catacomb west way    (catacombs)   y=14..15, x=8..15           always (the Grove's silence reached it)
//        cat_east     The catacomb east link   (catacombs)   y=14..15, x=23..28          at night
//        quarry_shaft The quarry shaft         (quarry)      x=18, y=14..18              at night
//        gr_passage   The Undercroft passage   (greenroot_crypt) y=12, x=6..11           at night
//     "Night" is 20:00-07:00 (the game clock). Never in a town, an outdoor map or inside the Hedge (LAW_MAPS).
//
//  Gameplay numbers: none change. Saved state: none (no G.flags, no entity field is written; the torches are transient).
//  Procedural stand-in: the sounds are filtered noise; the low and the dead torch are the firesmoke torch with its flame
//  rows cut away.
// ============================================================
'use strict';

if (typeof GFX !== 'undefined') {
  if (GFX.dyingLights === undefined) GFX.dyingLights = true;
  if (GFX.FX && !GFX.FX.includes('dyingLights')) GFX.FX.push('dyingLights');
}

const NERVES13 = (() => {
  const KEY = 'octave.nerves13.v1';
  const LEVELS = ['off', 'gentle', 'full'];
  const set = { scares: 'gentle', lights: true };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---- every sentence this module can show (all [PROPOSED]; listed in P13-NERVES/TEXT.md) ----
  const TXT = {
    scaresLabel: 'Jump scares',
    scaresHint: 'Off: nothing sudden or loud · Gentle: softened · Full: as designed',
    lightsLabel: 'Dying lights',
    lightsHint: 'in some corridors the torches ahead of you go out, one by one',
    off: 'Off', gentle: 'Gentle', full: 'Full',
    k_whisper: '[whispering behind you]',
    k_gutter: '[a torch gutters out]',
    k_relight: '[a torch catches again]',
  };

  // ---- a private random stream (the module never draws from Math.random) ----
  let rs = (Date.now() ^ 0x2c1b3c6d) >>> 0;
  const rnd = () => { rs ^= rs << 13; rs >>>= 0; rs ^= rs >>> 17; rs ^= rs << 5; rs >>>= 0; return rs / 4294967296; };
  function seed(n) { rs = (n >>> 0) || 1; }

  // ================================================================ 1. the switch
  const listeners = [];
  const stats = { softened: {}, ducks: 0, lastDuck: null, fxSoftened: 0, flashCapped: 0, nodes: 0, whispers: 0, cuts: 0, captions: [], lastWhisper: null, outs: 0, relights: 0, gutters: 0, ticks: 0, changes: 0 };

  function save() { try { localStorage.setItem(KEY, JSON.stringify({ s: set.scares, l: set.lights ? 1 : 0 })); } catch (e) { /* no storage: fine */ } }
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && typeof o === 'object') {
        if (LEVELS.includes(o.s)) set.scares = o.s;
        if (o.l === 0 || o.l === 1) set.lights = o.l === 1;
      }
    } catch (e) { /* ignore */ }
  }
  const scaresAllowed = () => set.scares;
  function onChange(fn) {
    if (typeof fn !== 'function') return () => {};
    listeners.push(fn);
    return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
  }
  function setScares(v) {
    if (!LEVELS.includes(v) || v === set.scares) return set.scares;
    set.scares = v; save(); stats.changes++;
    applyBodyClass();
    for (const fn of listeners.slice()) { try { fn(v); } catch (e) { console.warn('nerves13 listener failed', e); } }
    return set.scares;
  }
  const pick = (full, gentle, off) => (set.scares === 'full' ? full : set.scares === 'gentle' ? (gentle === undefined ? full : gentle) : (off === undefined ? (gentle === undefined ? full : gentle) : off));
  const stingerGain = () => pick(1, 0.5, 0.22);
  const attackSeconds = () => pick(0.02, 0.3, 0.9);

  // ---- the page: CSS for the fades, and a class on <body> so the rules follow the setting ----
  function applyBodyClass() {
    try {
      const b = document.body; if (!b) return;
      b.classList.toggle('n13-off', set.scares === 'off');
      b.classList.toggle('n13-gentle', set.scares === 'gentle');
    } catch (e) { /* cosmetic */ }
  }
  function injectStyle() {
    if (typeof document === 'undefined' || document.getElementById('nerves13-style')) return;
    const s = document.createElement('style'); s.id = 'nerves13-style';
    s.textContent = [
      '@keyframes n13-fade { from { opacity: 0; } to { opacity: 1; } }',
      'body.n13-off #death:not(.hidden) { animation: n13-fade 1.6s ease-out; }',
      'body.n13-gentle #death:not(.hidden) { animation: n13-fade 0.7s ease-out; }',
      'body.n13-off #fx { transition: background 600ms ease-out; opacity: 0.55; }',
      'body.n13-gentle #fx { transition: background 300ms ease-out; opacity: 0.8; }',
    ].join('\n');
    document.head.appendChild(s);
  }

  // ---- sudden loud sounds: hold the effect bus down for the moment and let the sound swell in ----
  const STINGERS = ['crack', 'press', 'golem', 'hound', 'thunder', 'bellDie'];
  function duck() {
    if (typeof Audio_ === 'undefined' || !Audio_.ctx || !Audio_.sfxBus || Audio_.muted) return null;
    const g = Audio_.sfxBus.gain, t = Audio_.ctx.currentTime, peak = stingerGain(), att = attackSeconds(), start = Math.min(0.12, peak * 0.5);
    try {
      g.cancelScheduledValues(t);
      g.setValueAtTime(start, t);
      g.linearRampToValueAtTime(peak, t + att);
      g.linearRampToValueAtTime(1, t + att + 1.4);
    } catch (e) { return null; }
    stats.ducks++; stats.lastDuck = { peak, start, attack: att, level: set.scares };
    return stats.lastDuck;
  }
  function wrapStingers() {
    if (typeof Audio_ === 'undefined' || !Audio_.sfx) return;
    for (const name of STINGERS) {
      const f = Audio_.sfx[name]; if (typeof f !== 'function') continue;
      Audio_.sfx[name] = function () {
        if (set.scares !== 'full') { try { duck(); stats.softened[name] = (stats.softened[name] || 0) + 1; } catch (e) { /* sound only */ } }
        return f.apply(this, arguments);
      };
    }
  }
  function wrapPictures() {
    // the view flashes ease in through the CSS above; this only counts them for the tests
    if (typeof fx === 'function') {
      const _fx = fx;
      fx = function () { if (set.scares !== 'full') stats.fxSoftened++; return _fx.apply(this, arguments); };
    }
    // lightning: capped, but kept above the 0.4 line js/spatial-audio.js reads to time the thunder
    if (typeof Engine !== 'undefined' && Engine.setWeather) {
      const _sw = Engine.setWeather;
      Engine.setWeather = function (o) {
        if (set.scares !== 'full' && o && typeof o === 'object' && +o.flash > 0) {
          const cap = pick(1, 0.7, 0.45);
          if (+o.flash > cap) { o = Object.assign({}, o, { flash: cap }); stats.flashCapped++; }
        }
        return _sw.call(this, o);
      };
    }
  }

  // ================================================================ shared helpers (audio, captions, world)
  function audioReady() { return typeof Audio_ !== 'undefined' && !!Audio_.ctx && !!Audio_.sfxBus && !Audio_.muted; }
  function mk(kind) { stats.nodes++; return Audio_.ctx['create' + kind](); }
  let noiseBuf = null;
  function noise() {
    if (noiseBuf && noiseBuf.sampleRate === Audio_.ctx.sampleRate) return noiseBuf;
    stats.nodes++;
    const b = Audio_.ctx.createBuffer(1, Math.floor(Audio_.ctx.sampleRate * 1.5), Audio_.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
    return (noiseBuf = b);
  }
  function chain(m) {
    const input = mk('Gain'), lp = mk('BiquadFilter'); input.gain.value = m.gain; lp.type = 'lowpass'; lp.frequency.value = m.cutoff; lp.Q.value = 0.5;
    input.connect(lp); let tail = lp, pan = null;
    if (Audio_.ctx.createStereoPanner) { pan = mk('StereoPanner'); pan.pan.value = m.pan; lp.connect(pan); tail = pan; }
    tail.connect(Audio_.sfxBus);
    return { input, lp, pan };
  }
  function release(ch, ms) { setTimeout(() => { try { ch.input.disconnect(); ch.lp.disconnect(); if (ch.pan) ch.pan.disconnect(); } catch (e) { /* gone */ } }, ms); }
  function caption(key) {
    // the sound captions box of js/access.js, only when the player has turned captions on
    try {
      const text = TXT[key];
      if (typeof ACCESS === 'undefined' || !ACCESS.settings || !ACCESS.settings.cap || !text) return;
      const now = performance.now();
      if (now - (caption.last[key] || -1e9) < 900) return;
      caption.last[key] = now;
      let b = document.getElementById('ac-captions');
      if (!b) { const g = document.getElementById('game'); if (!g) return; b = document.createElement('div'); b.id = 'ac-captions'; b.setAttribute('role', 'log'); b.setAttribute('aria-live', 'polite'); b.setAttribute('aria-label', 'Sound captions'); g.appendChild(b); }
      const d = document.createElement('div'); d.textContent = text; b.appendChild(d);
      while (b.children.length > 4) b.removeChild(b.firstChild);
      setTimeout(() => { if (d.parentNode) d.remove(); }, 3200);
      stats.captions.push(text); if (stats.captions.length > 40) stats.captions.shift();
    } catch (e) { /* cosmetic */ }
  }
  caption.last = {};
  const camNow = () => { const c = Engine.cam; return { x: c.x, y: c.y, dir: c.dir }; };
  const normAng = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a <= -Math.PI) a += Math.PI * 2; return a; };
  const isNight = () => { const h = G.tod * 24; return h < 7 || h >= 20; };
  const playing = () => typeof G !== 'undefined' && G.state === 'play' && !G.dead && G.player && G.map;
  const reduced = () => typeof GFX !== 'undefined' && (GFX.reduceMotion || GFX.noFlash);
  function inTown(map) {
    if (!map) return true;
    if (map.outdoor) return true;
    if (typeof LAW_MAPS !== 'undefined' && LAW_MAPS.has(map.id)) return true;
    return map.id === 'oakhaven' || map.id === 'tavern' || /house$/.test(map.id);
  }
  // a real foe is chasing, or a boss lives on this map: the lights and the whispers keep to themselves
  function fightNear() {
    const c = Engine.cam;
    for (const e of G.ents || []) {
      if (!e || e.hidden || e.dead || e.kind !== 'enemy' || !e.def) continue;
      const d = e.def, dist = Math.hypot(e.x - c.x, e.y - c.y);
      if ((d.boss || d.wildsBoss || d.codaBoss) && (dist < 12 || e.state === 'chase')) return true;     // a boss on the map but far away and asleep does not count
      if (e.state === 'chase' && dist < 14) return true;
    }
    return false;
  }

  // ================================================================ 2. whispers from behind
  const WH = { threshold: 55, gapHi: 26, gapLo: 9, rMin: 2.4, rMax: 4.6, spread: 0.35, cutRel: 2.09, cutSecs: 0.12 };
  const wst = { t: 8, active: null, last: null };

  // the geometry, pure: where a fragment sits relative to a listener {x, y, dir}, and what the ears get
  // off is the offset from straight back in radians (positive = to the listener's left); r is the distance.
  function whisperMix(L, off, r, walls) {
    const ang = L.dir + Math.PI + off, pos = { x: L.x + Math.cos(ang) * r, y: L.y + Math.sin(ang) * r };
    let m = null;
    try { if (typeof SPATIAL !== 'undefined' && SPATIAL.mix) m = SPATIAL.mix(L, pos, walls || 0); } catch (e) { m = null; }
    if (!m) { const lateral = -Math.sin(L.dir) * (pos.x - L.x) + Math.cos(L.dir) * (pos.y - L.y); m = { pan: clamp(lateral / Math.max(r, 1.2), -1, 1) * 0.8, gain: r <= 2 ? 1 : 1 / (1 + Math.pow((r - 2) / 7, 1.6)), cutoff: 12000, walls: walls || 0, dist: r }; }
    const rel = normAng(Math.atan2(pos.y - L.y, pos.x - L.x) - L.dir), behind = Math.cos(rel) < 0;
    // a sound behind the head is duller: the closer to straight back, the more the high end goes
    const dull = behind ? 0.55 + 0.45 * (1 - Math.min(1, -Math.cos(rel))) : 1;
    return { pos, pan: m.pan, gain: m.gain, cutoff: Math.min(m.cutoff, 3200) * dull, rel, behind, dist: r, walls: m.walls };
  }
  const whisperGap = (D) => lerp(WH.gapHi, WH.gapLo, clamp((D - WH.threshold) / (100 - WH.threshold), 0, 1));
  function whisperSpot(L) {
    const m = G.map;
    const off = (rnd() * 2 - 1) * WH.spread; let r = WH.rMin + rnd() * (WH.rMax - WH.rMin);
    for (let i = 0; i < 6; i++, r *= 0.8) {
      const x = L.x + Math.cos(L.dir + Math.PI + off) * r, y = L.y + Math.sin(L.dir + Math.PI + off) * r;
      if (x > 0.5 && y > 0.5 && x < m.w - 0.5 && y < m.h - 0.5 && !(m.isSolidCell && m.isSolidCell(x | 0, y | 0))) return { off, r };
    }
    return { off, r: 1.4 };
  }
  // phones: vowels as two formants, fricatives as a hiss band; lengths in seconds
  const V = { ee: [270, 2290], ih: [390, 1990], eh: [530, 1840], ah: [730, 1090], oh: [570, 840], oo: [300, 870], uh: [440, 1020] };
  const FRAG = [
    [['s', 0.1], ['ih', 0.09], ['l', 0.05], ['eh', 0.1], ['n', 0.07]],
    [['sh', 0.12], ['oh', 0.12], ['k', 0.03], ['ah', 0.1]],
    [['h', 0.08], ['ee', 0.11], ['s', 0.08], ['t', 0.03], ['uh', 0.1], ['n', 0.06]],
    [['f', 0.09], ['oo', 0.13], ['th', 0.07], ['eh', 0.1], ['s', 0.09]],
    [['k', 0.03], ['ah', 0.1], ['m', 0.07], ['oh', 0.12], ['h', 0.06]],
    [['s', 0.08], ['t', 0.03], ['ee', 0.12], ['l', 0.05], ['ih', 0.09], ['sh', 0.1]],
  ];
  // choose a fragment and cut it: the front or the back of the word goes missing; plan is plain data (testable)
  function fragmentPlan(i) {
    const base = FRAG[(i == null ? Math.floor(rnd() * FRAG.length) : i) % FRAG.length].map(p => [p[0], p[1]]);
    const cutFront = rnd() < 0.5, keep = 3 + Math.floor(rnd() * Math.max(1, base.length - 2));
    let ph = cutFront ? base.slice(Math.max(0, base.length - keep)) : base.slice(0, keep);
    if (ph.length < 3) ph = base.slice(0, 3);
    const tilt = 0.9 + rnd() * 0.2;
    return { phones: ph, tilt, cutFront, syllables: ph.filter(p => V[p[0]] || p[0] === 'n' || p[0] === 'l' || p[0] === 'm').length };
  }
  function whisperVoice(m, plan) {
    const ctx = Audio_.ctx, t0 = ctx.currentTime + 0.02;
    const level = pick(1.35, 1, 0.8), att = pick(0.05, 0.14, 0.22);
    const ch = chain({ pan: m.pan, gain: Math.min(1, m.gain) * level, cutoff: m.cutoff });
    const src = mk('BufferSource'); src.buffer = noise(); src.loop = true;
    const f1 = mk('BiquadFilter'), f2 = mk('BiquadFilter'), g2 = mk('Gain'), vo = mk('Gain'), hiss = mk('BiquadFilter'), ho = mk('Gain'), master = mk('Gain');
    f1.type = 'bandpass'; f2.type = 'bandpass'; f1.Q.value = 5; f2.Q.value = 7; hiss.type = 'bandpass'; hiss.Q.value = 1.2;
    g2.gain.value = 0.6; vo.gain.setValueAtTime(0.0001, t0); ho.gain.setValueAtTime(0.0001, t0);
    master.gain.setValueAtTime(0.0001, t0); master.gain.linearRampToValueAtTime(1, t0 + att);
    let t = t0, i = 0;
    for (const [p, dur] of plan.phones) {
      const f = V[p];
      if (f) {
        const a = f[0] * plan.tilt, b = f[1] * plan.tilt;
        f1.frequency.setValueAtTime(a, t); f1.frequency.linearRampToValueAtTime(a * 0.94, t + dur);
        f2.frequency.setValueAtTime(b, t); f2.frequency.linearRampToValueAtTime(b * 1.06, t + dur);
        if (i % 2) { vo.gain.setValueAtTime(0.0001, t); vo.gain.linearRampToValueAtTime(0.11, t + dur * 0.85); vo.gain.linearRampToValueAtTime(0.0001, t + dur); }   // run backwards: swells, then stops dead
        else { vo.gain.linearRampToValueAtTime(0.11, t + dur * 0.25); vo.gain.linearRampToValueAtTime(0.0001, t + dur); }
      } else if (p === 'n' || p === 'm' || p === 'l') {
        f1.frequency.setValueAtTime(260, t); f2.frequency.setValueAtTime(p === 'l' ? 1400 : 1000, t);
        vo.gain.linearRampToValueAtTime(0.05, t + dur * 0.4); vo.gain.linearRampToValueAtTime(0.0001, t + dur);
      } else {
        const hz = { s: 6200, sh: 3000, h: 1800, f: 4200, th: 5200, k: 2400, t: 3600 }[p] || 3000;
        hiss.frequency.setValueAtTime(hz, t);
        const peak = (p === 'k' || p === 't') ? 0.12 : 0.07;
        ho.gain.linearRampToValueAtTime(peak, t + Math.min(0.02, dur * 0.4)); ho.gain.linearRampToValueAtTime(0.0001, t + dur);
      }
      t += dur + 0.02; i++;
    }
    src.connect(f1); src.connect(f2); f1.connect(vo); f2.connect(g2); g2.connect(vo); vo.connect(master);
    src.connect(hiss); hiss.connect(ho); ho.connect(master); master.connect(ch.input);
    src.start(t0); src.stop(t + 0.2);
    return { ch, master, stopAt: t + 0.2, dur: t - t0 };
  }

  function startWhisper(force) {
    if (!force && (!playing() || typeof DREAD === 'undefined' || !DREAD.set.on)) return null;
    const L = camNow(), sp = whisperSpot(L), walls = (typeof SPATIAL !== 'undefined' && SPATIAL.wallsBetween && G.map) ? SPATIAL.wallsBetween(G.map, L.x + Math.cos(L.dir + Math.PI + sp.off) * sp.r, L.y + Math.sin(L.dir + Math.PI + sp.off) * sp.r, L.x, L.y) : 0;
    const m = whisperMix(L, sp.off, sp.r, walls), plan = fragmentPlan();
    const w = { pos: m.pos, mix: m, plan, voice: null, t: 0, cut: false, r: sp.r, off: sp.off };
    stats.whispers++; stats.lastWhisper = m; wst.active = w;
    caption('k_whisper');
    try { if (audioReady()) { w.voice = whisperVoice(m, plan); release(w.voice.ch, Math.ceil((w.voice.dur + 0.8) * 1000)); } } catch (e) { console.warn('nerves13 whisper failed', e); }
    return w;
  }
  function cutWhisper(why) {
    const w = wst.active; if (!w) return;
    wst.active = null; w.cut = why || 'turn'; stats.cuts++; wst.last = w;
    try {
      if (w.voice && Audio_.ctx) {
        const t = Audio_.ctx.currentTime;
        w.voice.master.gain.cancelScheduledValues(t); w.voice.master.gain.setValueAtTime(w.voice.master.gain.value, t); w.voice.master.gain.linearRampToValueAtTime(0.0001, t + WH.cutSecs);
        setTimeout(() => { try { w.voice.ch.input.disconnect(); } catch (e) { /* gone */ } }, 300);
      }
    } catch (e) { /* sound only */ }
  }
  // is the fragment still behind the listener? (the source is fixed in the world; the listener turns)
  function stillBehind(w, L) {
    const rel = normAng(Math.atan2(w.pos.y - L.y, w.pos.x - L.x) - L.dir);
    return Math.abs(rel) >= WH.cutRel;
  }
  function whisperTick(dt) {
    const w = wst.active;
    if (w) {
      w.t += dt;
      const L = camNow();
      if (!playing() || (typeof DREAD !== 'undefined' && !DREAD.set.on)) { cutWhisper('state'); return; }
      if (!stillBehind(w, L)) { cutWhisper('turn'); wst.t = Math.max(wst.t, 4); return; }
      // the listener walks and drifts: follow the pan and the loudness of the fixed source
      try {
        const walls = (typeof SPATIAL !== 'undefined' && SPATIAL.wallsBetween) ? SPATIAL.wallsBetween(G.map, w.pos.x, w.pos.y, L.x, L.y) : 0;
        const m = whisperMix(L, 0, Math.hypot(w.pos.x - L.x, w.pos.y - L.y), walls);
        const lat = -Math.sin(L.dir) * (w.pos.x - L.x) + Math.cos(L.dir) * (w.pos.y - L.y), d = Math.max(Math.hypot(w.pos.x - L.x, w.pos.y - L.y), 1.2);
        w.mix.pan = clamp(lat / d, -1, 1) * 0.8; w.mix.gain = m.gain;
        if (w.voice && w.voice.ch.pan && Audio_.ctx) w.voice.ch.pan.pan.setTargetAtTime(w.mix.pan, Audio_.ctx.currentTime, 0.05);
      } catch (e) { /* sound only */ }
      if (w.voice ? w.t > w.voice.dur + 0.3 : w.t > 1.6) { wst.active = null; wst.last = w; }
      return;
    }
    if (!playing() || typeof DREAD === 'undefined' || !DREAD.set.on) { wst.t = Math.max(wst.t, 6); return; }
    const D = DREAD.st.D;
    if (D < WH.threshold) { wst.t = Math.max(wst.t, 4 + rnd() * 4); return; }
    if (DREAD.zone() !== 'open' || DREAD.st.S >= 2 || fightNear()) return;
    wst.t -= dt;
    if (wst.t <= 0) { startWhisper(false); wst.t = whisperGap(D) * (0.75 + 0.5 * rnd()); }
  }

  // ================================================================ 3. lights dying one by one
  const LT = { first: 1.3, gapMin: 1.7, gapMax: 2.6, gutter: 0.9, away: 4, hold: 55, spacing: 3, relightGap: 0.5 };
  const CORRIDORS = [
    { id: 'rv_gallery', map: 'rootvault', axis: 'h', a0: 3, a1: 19, y0: 5, y1: 5, when: 'always', name: 'The Root-vault gallery' },
    { id: 'cat_west', map: 'catacombs', axis: 'h', a0: 8, a1: 15, y0: 14, y1: 15, when: 'always', sp: 2, name: 'The catacomb west way' },
    { id: 'cat_east', map: 'catacombs', axis: 'h', a0: 23, a1: 28, y0: 14, y1: 15, when: 'night', sp: 2, name: 'The catacomb east link' },
    { id: 'quarry_shaft', map: 'quarry', axis: 'v', a0: 14, a1: 18, y0: 18, y1: 18, when: 'night', sp: 2, name: 'The quarry shaft' },
    { id: 'gr_passage', map: 'greenroot_crypt', axis: 'h', a0: 6, a1: 11, y0: 12, y1: 12, when: 'night', sp: 2, name: 'The Undercroft passage' },
  ];
  // for a vertical corridor y0/y1 hold the (single) column x; a0..a1 run along y
  const cellsOf = (c) => {
    const out = [];
    if (c.axis === 'h') { for (let x = c.a0; x <= c.a1; x++) for (let y = c.y0; y <= c.y1; y++) out.push([x, y]); }
    else { for (let y = c.a0; y <= c.a1; y++) out.push([c.y0, y]); }
    return out;
  };
  // the box a player counts as "in" the corridor (a little slack at the ends)
  function inside(c, p) {
    if (c.axis === 'h') return p.x >= c.a0 - 0.2 && p.x <= c.a1 + 1.2 && p.y >= c.y0 - 0.2 && p.y <= c.y1 + 1.2;
    return p.y >= c.a0 - 0.2 && p.y <= c.a1 + 1.2 && p.x >= c.y0 - 0.2 && p.x <= c.y0 + 1.2;
  }
  const along = (c, x, y) => (c.axis === 'h' ? x : y);
  const whenOk = (c) => c.when === 'always' || (c.when === 'night' && isNight());
  function eligible(c, map) {
    map = map || (typeof G !== 'undefined' ? G.map : null);
    if (!set.lights || (typeof GFX !== 'undefined' && GFX.dyingLights === false)) return false;
    if (!map || map.id !== c.map || inTown(map)) return false;
    return whenOk(c);
  }

  // ---- the sprites: the firesmoke torch with its flame cut away ----
  let spritesReady = false;
  function buildSprites() {
    if (spritesReady) return true;
    const t = typeof Engine !== 'undefined' && Engine.sprites ? Engine.sprites.torch : null; if (!t || !t.data) return false;
    const make = (name, fromRow, toRow) => {
      const data = new Uint32Array(t.data);
      for (let y = fromRow; y <= toRow; y++) for (let x = 0; x < t.w; x++) data[y * t.w + x] = 0;
      Engine.addSprite(name, Object.assign({}, t, { data }));
      const mask = new Uint8Array(t.w * t.h); let n = 0;
      if (name === 'p13n_torch_low') for (let y = 8; y <= 11; y++) for (let x = 0; x < t.w; x++) if ((data[y * t.w + x] >>> 24) > 100) { mask[y * t.w + x] = 1; n++; }
      Engine.setEmissive(name, n ? mask : null);
      delete Engine.sprites[name]._fs;
    };
    make('p13n_torch_low', 0, 7);     // a low, blue-yellow bead of flame in the cup
    make('p13n_torch_out', 0, 11);    // the bracket, the shaft and the cup
    if (typeof ANIM !== 'undefined' && ANIM.fire) ANIM.fire.add('p13n_torch_low');
    spritesReady = true; return true;
  }

  // ---- placing the torches (transient, never saved) ----
  const placed = new WeakMap();    // map object -> { cor: {id: [torch]} }
  const wallAt = (map, x, y) => { try { return !!map.isSolidCell(x, y) && !(map.doors && map.doors[y * map.w + x]); } catch (e) { return false; } };
  function planTorches(map, c) {
    const cells = cellsOf(c), out = [];
    const doors = []; for (const k in (map.doors || {})) doors.push([(k % map.w) + 0.5, ((k / map.w) | 0) + 0.5]);
    let n = 0;
    for (let i = 1; i < (c.a1 - c.a0); i += (c.sp || LT.spacing), n++) {
      const a = c.a0 + i;
      // the cell(s) across the corridor at this point
      const across = cells.filter(([x, y]) => along(c, x, y) === a);
      if (!across.length) continue;
      const wide = across.length > 1;
      const [cx, cy] = across[wide ? (n & 1) : 0];
      // which wall: for a horizontal corridor the wall above or below, for a vertical one left or right
      const sides = c.axis === 'h' ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
      let side = null;
      const want = wide ? (n & 1 ? sides[1] : sides[0]) : (n & 1 ? sides[1] : sides[0]);
      if (wallAt(map, cx + want[0], cy + want[1])) side = want;
      else { const alt = sides.find(s => wallAt(map, cx + s[0], cy + s[1])); if (alt) side = alt; }
      if (!side) continue;
      const x = +(cx + 0.5 + side[0] * 0.36).toFixed(2), y = +(cy + 0.5 + side[1] * 0.36).toFixed(2);
      if (doors.some(d => Math.hypot(d[0] - (cx + 0.5), d[1] - (cy + 0.5)) < 1.9)) continue;
      out.push({ x, y, cx, cy });
    }
    return out;
  }
  function makeTorch(spec, cor) {
    const sprite = (typeof Engine !== 'undefined' && Engine.sprites && Engine.sprites.torch) ? 'torch' : 'lamp';
    return { kind: 'deco', sprite, x: spec.x, y: spec.y, scale: 0.52, yOff: -0.36, solid: false, nopick: true, transient: true, _decor: true, glow: 0.8, lightCol: [66, 34, 9], label: 'A torch in a wall bracket', _n13: { cor: cor.id, st: 'lit', t: 0, out: 0 } };
  }
  function ensureMap(map) {
    if (!map || typeof map !== 'object') return;
    let rec = placed.get(map);
    const wantOn = set.lights && !(typeof GFX !== 'undefined' && GFX.dyingLights === false);
    for (const c of CORRIDORS) {
      if (c.map !== map.id) continue;
      if (!rec) { rec = { cor: {} }; placed.set(map, rec); }
      if (!rec.cor[c.id]) { try { rec.cor[c.id] = planTorches(map, c).map(s => makeTorch(s, c)); } catch (e) { rec.cor[c.id] = []; console.warn('nerves13 placement failed', e); } }
      const list = rec.cor[c.id], have = new Set(map.entities);
      if (wantOn) { for (const e of list) if (!have.has(e)) map.entities.push(e); }
      else {
        for (const e of list) relightNow(e);
        for (let i = map.entities.length - 1; i >= 0; i--) if (list.includes(map.entities[i])) map.entities.splice(i, 1);
      }
    }
    if (typeof G !== 'undefined' && G.map === map) G.ents = map.entities;
  }
  function torchesOf(c, map) { const rec = placed.get(map || G.map); return (rec && rec.cor[c.id]) || []; }

  // ---- one torch: lit -> low -> (flicker) -> out, and back ----
  function setLit(e, on, low) {
    if (on) { e.glow = 0.8; e.lightCol = [66, 34, 9]; if (e.sprite !== 'torch' && e.sprite !== 'lamp') e.sprite = 'torch'; }
    else if (low) { e.glow = 0.3; e.lightCol = [22, 11, 3]; if (spritesReady) e.sprite = 'p13n_torch_low'; }
    else { e.glow = 0; e.lightCol = null; if (spritesReady) e.sprite = 'p13n_torch_out'; }
  }
  function relightNow(e) { const n = e._n13; if (!n) return; n.st = 'lit'; n.t = 0; setLit(e, true); }
  function gutterSound(e) {
    stats.gutters++; caption('k_gutter');
    if (!audioReady()) return;
    try {
      const L = camNow(), walls = (typeof SPATIAL !== 'undefined' && SPATIAL.wallsBetween) ? SPATIAL.wallsBetween(G.map, e.x, e.y, L.x, L.y) : 0;
      const m = (typeof SPATIAL !== 'undefined' && SPATIAL.mix) ? SPATIAL.mix(L, { x: e.x, y: e.y }, walls) : { pan: 0, gain: 0.6, cutoff: 6000 };
      const ctx = Audio_.ctx, t0 = ctx.currentTime + 0.02, dur = 0.7;
      const ch = chain({ pan: m.pan, gain: Math.min(1, m.gain) * 0.5, cutoff: Math.min(m.cutoff, 2400) });
      const src = mk('BufferSource'); src.buffer = noise(); src.loop = true;
      const bp = mk('BiquadFilter'), env = mk('Gain'); bp.type = 'bandpass'; bp.Q.value = 0.9;
      bp.frequency.setValueAtTime(900, t0); bp.frequency.exponentialRampToValueAtTime(260, t0 + dur);
      env.gain.setValueAtTime(0.0001, t0); env.gain.linearRampToValueAtTime(0.06, t0 + 0.08);
      env.gain.linearRampToValueAtTime(0.02, t0 + 0.25); env.gain.linearRampToValueAtTime(0.0001, t0 + dur);
      src.connect(bp); bp.connect(env); env.connect(ch.input); src.start(t0); src.stop(t0 + dur + 0.1);
      release(ch, 1600);
    } catch (er) { /* sound only */ }
  }
  function relightSound(e) {
    caption('k_relight');
    if (!audioReady()) return;
    try {
      const L = camNow(), m = (typeof SPATIAL !== 'undefined' && SPATIAL.mix) ? SPATIAL.mix(L, { x: e.x, y: e.y }, 0) : { pan: 0, gain: 0.6, cutoff: 6000 };
      const ctx = Audio_.ctx, t0 = ctx.currentTime + 0.02, dur = 0.3;
      const ch = chain({ pan: m.pan, gain: Math.min(1, m.gain) * 0.4, cutoff: Math.min(m.cutoff, 1800) });
      const src = mk('BufferSource'); src.buffer = noise(); src.loop = true;
      const lp = mk('BiquadFilter'), env = mk('Gain'); lp.type = 'lowpass'; lp.frequency.value = 600;
      env.gain.setValueAtTime(0.0001, t0); env.gain.linearRampToValueAtTime(0.05, t0 + 0.05); env.gain.linearRampToValueAtTime(0.0001, t0 + dur);
      src.connect(lp); lp.connect(env); env.connect(ch.input); src.start(t0); src.stop(t0 + dur + 0.1);
      release(ch, 900);
    } catch (er) { /* sound only */ }
  }
  // advance the little animation of one torch that is going out
  function stepTorch(e, dt) {
    const n = e._n13; if (!n || n.st === 'lit' || n.st === 'out') return;
    n.t += dt;
    if (n.st === 'guttering') {
      const flick = !reduced();
      if (flick) {
        // low -> a flicker back to full -> low -> out; never faster than 4 changes in 0.9 s
        const t = n.t;
        if (t < 0.25) setLit(e, false, true);
        else if (t < 0.45) setLit(e, true);
        else if (t < 0.7) setLit(e, false, true);
        else { setLit(e, false, false); n.st = 'out'; n.t = 0; }
      } else if (n.t < 0.5) setLit(e, false, true);
      else { setLit(e, false, false); n.st = 'out'; n.t = 0; }
    } else if (n.st === 'catching') {
      if (n.t < 0.3) setLit(e, false, true);
      else { setLit(e, true); n.st = 'lit'; n.t = 0; }
    }
  }
  const lst = { cool: 0, cor: null, timer: 0, away: 0, firstOut: 0, relightQ: [], relightT: 0, clock: 0, lastMap: null, order: [] };
  function resetLights(instant) {
    const map = lst.lastMap;
    if (map) { const rec = placed.get(map); if (rec) for (const id in rec.cor) for (const e of rec.cor[id]) { if (instant || (e._n13 && e._n13.st !== 'lit')) relightNow(e); } }
    lst.cor = null; lst.timer = 0; lst.away = 0; lst.firstOut = 0; lst.relightQ = []; lst.relightT = 0; lst.order = []; lst.cool = 0;
  }
  // which torches in the corridor are ahead of the player (along its travel or, standing still, its facing)
  function aheadOf(c, list, L) {
    const vx = G.vel ? G.vel.x : 0, vy = G.vel ? G.vel.y : 0, sp = Math.hypot(vx, vy);
    const fx = sp > 0.3 ? vx : Math.cos(L.dir), fy = sp > 0.3 ? vy : Math.sin(L.dir);
    const s = Math.sign(c.axis === 'h' ? fx : fy) || 1, pa = along(c, L.x, L.y);
    return list.filter(e => (along(c, e.x, e.y) - pa) * s > 0.9).sort((a, b) => Math.abs(along(c, a.x, a.y) - pa) - Math.abs(along(c, b.x, b.y) - pa));
  }
  function lightsTick(dt) {
    const map = (typeof G !== 'undefined') ? G.map : null;
    if (map !== lst.lastMap) { resetLights(true); lst.lastMap = map; if (map) ensureMap(map); }
    if (!map) return;
    const rec = placed.get(map);
    if (!rec) return;
    lst.clock += dt;
    // little animations always run (so a torch never freezes half-lit when the player pauses)
    for (const id in rec.cor) for (const e of rec.cor[id]) stepTorch(e, dt);
    if (!set.lights || (typeof GFX !== 'undefined' && GFX.dyingLights === false)) { if (lst.cor || lst.relightQ.length) resetLights(true); return; }
    if (!playing()) return;
    const L = camNow(), p = { x: L.x, y: L.y };
    // which corridor is the player in?
    const here = CORRIDORS.find(c => c.map === map.id && inside(c, p));
    const live = lst.cor ? CORRIDORS.find(c => c.id === lst.cor) : null;
    if (live) {
      if (!here || here.id !== live.id) lst.away += dt; else lst.away = 0;
      const list = torchesOf(live, map), someOut = list.some(e => e._n13.st !== 'lit');
      if ((lst.away >= LT.away || lst.clock - lst.firstOut >= LT.hold || !eligible(live, map)) && someOut && !lst.relightQ.length) {
        // relight in the order they went out
        lst.relightQ = lst.order.filter(e => e._n13.st !== 'lit'); lst.relightT = 0;
      }
      if (lst.relightQ.length) {
        lst.relightT -= dt;
        if (lst.relightT <= 0) {
          const e = lst.relightQ.shift(); const n = e._n13;
          if (n && n.st !== 'lit') { n.st = 'catching'; n.t = 0; setLit(e, false, true); stats.relights++; relightSound(e); }
          lst.relightT = LT.relightGap;
          if (!lst.relightQ.length) { lst.cor = null; lst.order = []; lst.timer = 0; lst.cool = 20; }
        }
        if (here && here.id === live.id && lst.relightQ.length === 0) { /* it will go out again when the player walks on */ }
        return;
      }
      if (!someOut && !here) { lst.cor = null; lst.order = []; }
    }
    if (lst.cool > 0) { lst.cool -= dt; if (here) return; }
    if (!here || !eligible(here, map) || fightNear()) return;
    if (!spritesReady) buildSprites();
    if (!lst.cor) { lst.cor = here.id; lst.timer = LT.first; lst.away = 0; lst.firstOut = lst.clock; lst.order = []; }
    if (lst.cor !== here.id) return;
    lst.timer -= dt;
    if (lst.timer > 0) return;
    const ahead = aheadOf(here, torchesOf(here, map), L).filter(e => e._n13.st === 'lit' && Math.abs(along(here, e.x, e.y) - along(here, L.x, L.y)) >= 2.2);
    if (!ahead.length) { lst.timer = 0.5; return; }
    const e = ahead[0], n = e._n13;
    n.st = 'guttering'; n.t = 0; setLit(e, false, true); stats.outs++;
    if (!lst.order.length) lst.firstOut = lst.clock;
    lst.order.push(e);
    gutterSound(e);
    lst.timer = LT.gapMin + rnd() * (LT.gapMax - LT.gapMin);
  }

  // ================================================================ the tick, the options rows, the wiring
  function tick(dt) {
    stats.ticks++;
    dt = clamp(+dt || 0, 0, 0.25);
    try { whisperTick(dt); } catch (e) { console.warn('nerves13 whisper tick failed', e); }
    try { lightsTick(dt); } catch (e) { console.warn('nerves13 lights tick failed', e); }
  }
  function el(tag, props, text) {
    const e = document.createElement(tag);
    if (props) for (const k in props) { if (k === 'style') e.style.cssText = props[k]; else e.setAttribute(k, props[k]); }
    if (text != null) e.textContent = text;
    return e;
  }
  function appendRows() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById('nerves13-scares')) return;
    const row = (label, hint) => { const s = el('span', { class: 'gfx-label' }, label); s.appendChild(document.createTextNode(' ')); s.appendChild(el('small', { class: 'muted' }, hint)); return s; };
    const btn = (id, aria, fn) => { const b = el('button', { class: 'dfbtn small', id, type: 'button' }, ''); b.setAttribute('aria-label', aria); b.onclick = () => { fn(); sync(); }; return b; };
    const sc = btn('nerves13-scares', TXT.scaresLabel, () => { setScares(LEVELS[(LEVELS.indexOf(set.scares) + 1) % 3]); });
    const li = btn('nerves13-lights', TXT.lightsLabel, () => { setLights(!set.lights); });
    function sync() {
      sc.textContent = TXT[set.scares]; sc.setAttribute('aria-pressed', set.scares !== 'full' ? 'true' : 'false'); sc.classList.toggle('sel', set.scares !== 'full');
      li.textContent = set.lights ? 'On' : 'Off'; li.setAttribute('aria-pressed', set.lights ? 'true' : 'false'); li.classList.toggle('sel', set.lights);
    }
    grid.appendChild(row(TXT.scaresLabel, TXT.scaresHint)); grid.appendChild(sc);
    grid.appendChild(row(TXT.lightsLabel, TXT.lightsHint)); grid.appendChild(li);
    sync();
  }
  function setLights(v) {
    v = !!v; if (v === set.lights) return set.lights;
    set.lights = v; save();
    try { if (typeof G !== 'undefined' && G.map) ensureMap(G.map); if (!v) resetLights(true); } catch (e) { console.warn('nerves13 lights switch failed', e); }
    return set.lights;
  }

  function wire() {
    injectStyle(); applyBodyClass();
    wrapStingers(); wrapPictures();
    if (typeof update === 'function') {
      const _u = update;
      update = function (dt) { const r = _u.apply(this, arguments); try { tick(dt); } catch (e) { console.warn('nerves13 tick failed', e); } return r; };
    }
    if (typeof loadMap === 'function') {
      const _m = loadMap;
      loadMap = function () {
        const r = _m.apply(this, arguments);
        try { cutWhisper('map'); resetLights(true); if (G.map) { lst.lastMap = G.map; ensureMap(G.map); } } catch (e) { console.warn('nerves13 map failed', e); }
        return r;
      };
    }
    if (typeof renderAccessibilityMenu === 'function') {
      const _a = renderAccessibilityMenu;
      renderAccessibilityMenu = function () { const r = _a.apply(this, arguments); try { appendRows(); } catch (e) { console.warn('nerves13 rows failed', e); } return r; };
    }
    if (typeof GFX !== 'undefined' && GFX.onChange) GFX.onChange(() => { try { if (typeof G !== 'undefined' && G.map) { ensureMap(G.map); if (GFX.dyingLights === false) resetLights(true); } } catch (e) { /* ignore */ } });
  }
  // 'Off' and 'Gentle' are already in the game's catalogue (ui.off, feel.gentle)
  function catalog() { return Object.keys(TXT).filter(k => k !== 'off' && k !== 'gentle').map(k => ({ key: k, en: TXT[k] })); }

  load();
  try { wire(); } catch (e) { console.warn('nerves13 wiring failed', e); }
  return {
    scaresAllowed, onChange, setScares, pick, stingerGain, attackSeconds,
    set, stats, TXT, WH, LT, CORRIDORS, STINGERS, seed, tick, save, load, catalog, appendRows, setLights,
    duck, whisperMix, whisperGap, fragmentPlan, startWhisper, cutWhisper, stillBehind, whisperTick, wst,
    eligible, ensureMap, torchesOf, planTorches, cellsOf, inside, lightsTick, resetLights, buildSprites, lst, placed, aheadOf, isNight, inTown,
    get spritesReady() { return spritesReady; },
    audio: 'whispers and gutters are filtered noise through SPATIAL.mix; stingers are softened by holding Audio_.sfxBus down and letting it swell',
  };
})();
if (typeof window !== 'undefined') window.NERVES13 = NERVES13;
