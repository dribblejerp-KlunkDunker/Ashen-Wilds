// ============================================================
//  spatial-audio — Phase 7: sounds that come from somewhere, and weather you can hear
//  1. Positional sound. Sounds with a place in the world (a foe's alert, attack, hurt and death, its bell or
//     hound-cry, a crow's caw, a rat's squeak, a proctor's hand-press) are routed through a short per-sound
//     chain: gain (distance falloff) -> low-pass (walls and air) -> StereoPanner (angle to the camera) ->
//     Audio_.sfxBus. js/audio.js is not edited: its sounds connect to the closure's sfxBus, so for the
//     synchronous duration of one call AudioNode.connect is redirected to the chain, then put back.
//     Where the game gives no position (the player's own steps, swings, menus, doors) the sound stays
//     centred and untouched. Setting "Positional sound" (default on); off = the original node graph.
//  2. Weather you can hear: a looped rain bed (open patter outdoors, muffled roof patter indoors, almost
//     nothing underground), willow wind in the Deep Woods and Whisper-Grove that follows Weather.wind, and
//     thunder that arrives after the flash by a distance-based delay. Setting "Weather sound" (Off/Low/
//     Normal/High, default Normal). GFX.noFlash only quiets the picture: the sound is read from the raw
//     flash value before any visual filter, so it stays.
//  Nothing here makes an AudioContext or does anything until Audio_.ctx exists (first user gesture).
//  Procedural stand-in work: all voices are filtered noise and sines; a final pass can swap authored beds in.
// ============================================================
'use strict';

const SPATIAL = (() => {
  // a private random stream: sound never draws from Math.random, so audio can't shift gameplay rolls
  const audioRnd = (() => { let s = (Date.now() ^ 0x9e3779b9) >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();
  const KEY = 'octave.spatial.v1';
  const set = { positional: true, weather: 2 };            // weather: 0 off, 1 low, 2 normal, 3 high
  const WEATHER_GAIN = [0, 0.5, 1, 1.5];
  const WEATHER_NAMES = ['Off', 'Low', 'Normal', 'High'];
  const MAX_PAN = 0.75;       // never hard left/right: kind to headphones
  const REF = 2.5;            // inside this many cells a sound is at full level
  const MIN_GAIN = 0.1;
  const WALL_CUT = 3000;      // low-pass for one wall between you and the source, in Hz
  const WILLOWS = { deepwoods: true, whispergrove: true };
  const DEEP = { dungeon: true, root: true, mausoleum: true };   // maps where rain cannot be heard at all

  const stats = { routed: 0, direct: 0, wallCacheHits: 0, thunders: [], last: null };
  const lay = { rain: 0, wind: 0, rainCut: 0, indoors: false, built: false };
  let cur = null;             // the enemy whose update / death is running, so its sounds know where they are
  let busy = false;           // inside a routed call: nested sfx calls (enemy -> bell) go straight through
  let wallStamp = -1, wallCache = new Map();
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ---- persistence (guarded: previews and private windows have no storage) ------------------
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ p: set.positional ? 1 : 0, w: set.weather })); } catch (e) { /* no storage: fine */ } }
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!o) return;
      set.positional = o.p !== 0;
      if (o.w === 0 || o.w === 1 || o.w === 2 || o.w === 3) set.weather = o.w;
    } catch (e) { /* ignore */ }
  }

  // ---- the maths (pure, so the tests can drive it without any sound) ------------------------
  // Walls between two points: how many separate solid runs a straight ray crosses (closed doors count).
  function wallsBetween(map, ax, ay, bx, by) {
    if (!map || !map.isSolidCell) return 0;
    const d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(d / 0.25));
    let walls = 0, inside = false;
    for (let i = 1; i < n; i++) {
      const t = i / n, solid = !!map.isSolidCell((ax + (bx - ax) * t) | 0, (ay + (by - ay) * t) | 0);
      if (solid && !inside) walls++;
      inside = solid;
      if (walls >= 6) break;
    }
    return walls;
  }
  // cached per source cell per frame (G.time moves every frame), so a crowd of foes costs one ray each
  function wallsCached(map, ax, ay, bx, by, stamp) {
    if (stamp !== wallStamp) { wallStamp = stamp; wallCache = new Map(); }
    const k = Math.round(ax * 2) + ',' + Math.round(ay * 2) + '|' + Math.round(bx * 2) + ',' + Math.round(by * 2);
    if (wallCache.has(k)) { stats.wallCacheHits++; return wallCache.get(k); }
    const w = wallsBetween(map, ax, ay, bx, by); wallCache.set(k, w); return w;
  }
  // listener {x,y,dir}, source {x,y}; walls = solid runs between them. dir is the camera angle
  // (engine: forward = (cos, sin), right = (-sin, cos)), so a positive lateral offset is on the right.
  function mix(listener, src, walls) {
    const dx = src.x - listener.x, dy = src.y - listener.y, d = Math.hypot(dx, dy);
    const lateral = -Math.sin(listener.dir) * dx + Math.cos(listener.dir) * dy;
    const pan = d < 0.01 ? 0 : clamp(lateral / Math.max(d, 1.2), -1, 1) * MAX_PAN;   // soft near-field: no flip when it is at your feet
    const gain = d <= REF ? 1 : Math.max(MIN_GAIN, 1 / (1 + Math.pow((d - REF) / 7, 1.6)));
    const air = Math.max(2500, 18000 / (1 + d / 12));
    const wall = walls > 0 ? Math.max(420, WALL_CUT / (1 + 0.6 * (walls - 1))) : 20000;
    return { pan, gain, cutoff: Math.min(air, wall), walls, dist: d };
  }

  // ---- finding where a sound comes from ------------------------------------------------------
  function listener() { const c = (typeof Engine !== 'undefined' && Engine.cam) || null; return c ? { x: c.x, y: c.y, dir: c.dir } : null; }
  function nearestEnt(pred) {
    const L = listener(); if (!L || typeof G === 'undefined' || !G.ents) return null;
    let best = null, bd = 1e9;
    for (const e of G.ents) { if (!e || !pred(e)) continue; const d = Math.hypot(e.x - L.x, e.y - L.y); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  function critter(kind) {
    const list = (typeof SmallLife !== 'undefined' && SmallLife.critters) || [];
    const L = listener(); if (!L) return null;
    let best = null, bd = 1e9;
    for (const e of list) {
      if (!e || !e._sl || e._sl.kind !== kind) continue;
      const d = Math.hypot(e.x - L.x, e.y - L.y) - (e._sl.st === 'fly' || e._sl.st === 'flee' ? 3 : 0);   // the startled one made the noise
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  // ambient birds and rats come from the trees and walls: no entity, so a bearing out in the dark
  function ambientSpot() {
    const L = listener(); if (!L) return null;
    const a = audioRnd() * Math.PI * 2, r = 5 + audioRnd() * 6;
    return { x: L.x + Math.cos(a) * r, y: L.y + Math.sin(a) * r };
  }
  const CTX_ONLY = { bell: 1, bellDie: 1, hound: 1, golem: 1, press: 1, bow: 1, shot: 1, voice: 1, song: 1, crack: 1 };
  function sourceOf(name, args) {
    if (name === 'enemy') {
      const def = args[0];
      if (cur && cur.def === def) return cur;
      return nearestEnt(e => e.kind === 'enemy' && e.def === def && !e.dead && !e.hidden) || nearestEnt(e => e.kind === 'enemy' && e.def === def);
    }
    if (CTX_ONLY[name]) return cur;                 // only when a foe is the one acting; the player's own stays centred
    if (name === 'bird') return critter('crow') || ambientSpot();
    if (name === 'rat') return critter('rat') || ambientSpot();
    return null;
  }

  // ---- routing ---------------------------------------------------------------------------------
  function ready() {
    return typeof Audio_ !== 'undefined' && !!Audio_.ctx && !!Audio_.sfxBus && !Audio_.muted && typeof AudioNode !== 'undefined' && typeof G !== 'undefined' && !!G.map;
  }
  function makeChain(m) {
    const ctx = Audio_.ctx, input = ctx.createGain(), lp = ctx.createBiquadFilter();
    input.gain.value = m.gain; lp.type = 'lowpass'; lp.frequency.value = m.cutoff; lp.Q.value = 0.5;
    let tail = lp; input.connect(lp);
    let pan = null;
    if (ctx.createStereoPanner) { pan = ctx.createStereoPanner(); pan.pan.value = m.pan; lp.connect(pan); tail = pan; }
    tail.connect(Audio_.sfxBus);
    return { input, lp, pan, tail };
  }
  // Run fn with every connect(sfxBus) sent to the chain instead; setTimeout callbacks started inside
  // (a second birdcall, a bell's later partials) are re-run under the same redirect so they stay in place.
  function withChain(chain, fn) {
    // audio.js routes every effect (and its delayed parts) to the chain while fn runs
    if (typeof Audio_.withRoute === 'function') return Audio_.withRoute(chain.input, fn);
    const bus = Audio_.sfxBus, oc = AudioNode.prototype.connect, ost = window.setTimeout;
    AudioNode.prototype.connect = function (dest) { const a = Array.prototype.slice.call(arguments); if (a[0] === bus) a[0] = chain.input; return oc.apply(this, a); };
    window.setTimeout = function (f, ms) {
      const rest = Array.prototype.slice.call(arguments, 2);
      if (typeof f !== 'function' || !(ms <= 2500)) return ost.apply(window, arguments);
      return ost.call(window, function () { try { withChain(chain, function () { f.apply(null, rest); }); } catch (e) { console.warn('spatial timer failed', e); } }, ms);
    };
    try { return fn(); } finally { AudioNode.prototype.connect = oc; window.setTimeout = ost; }
  }
  function release(chain) {
    setTimeout(() => { try { chain.input.disconnect(); chain.lp.disconnect(); if (chain.pan) chain.pan.disconnect(); } catch (e) { /* already gone */ } }, 8000);
  }
  function wrap(name) {
    const sfx = Audio_.sfx, orig = sfx[name];
    if (typeof orig !== 'function' || orig.__spatial) return;
    const w = function () {
      if (!set.positional || busy || !ready()) { stats.direct++; return orig.apply(this, arguments); }
      let src = null;
      try { src = sourceOf(name, arguments); } catch (e) { src = null; }
      const L = listener();
      if (!src || !L || !(src.x === src.x) || !(src.y === src.y)) { stats.direct++; return orig.apply(this, arguments); }
      let chain = null, m = null;
      try {
        m = mix(L, src, wallsCached(G.map, src.x, src.y, L.x, L.y, G.time));
        chain = makeChain(m);
      } catch (e) { console.warn('spatial chain failed', e); stats.direct++; return orig.apply(this, arguments); }
      stats.routed++; stats.last = { name, pan: m.pan, gain: m.gain, cutoff: m.cutoff, walls: m.walls, dist: m.dist, chain };
      busy = true;
      try { return withChain(chain, () => orig.apply(this, arguments)); } finally { busy = false; release(chain); }
    };
    w.__spatial = true; w.__orig = orig; sfx[name] = w;
  }

  // ---- weather layers --------------------------------------------------------------------------
  let nodes = null, noiseBuf = null;
  function build() {
    const ctx = Audio_.ctx, bus = Audio_.sfxBus;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = audioRnd() * 2 - 1;
    const loop = () => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s; };
    // rain: hiss band, low-passed harder when a roof is overhead; a quick tremolo makes it patter
    const rs = loop(), rh = ctx.createBiquadFilter(), rl = ctx.createBiquadFilter(), rg = ctx.createGain();
    rh.type = 'highpass'; rh.frequency.value = 350; rl.type = 'lowpass'; rl.frequency.value = 5200; rl.Q.value = 0.4; rg.gain.value = 0;
    rs.connect(rh); rh.connect(rl); rl.connect(rg); rg.connect(bus);
    const rlfo = ctx.createOscillator(), rld = ctx.createGain(); rlfo.frequency.value = 6.3; rld.gain.value = 0; rlfo.connect(rld); rld.connect(rg.gain);
    // willow wind: a rustling band that wanders in pitch and swells in gusts
    const ws = loop(), wb = ctx.createBiquadFilter(), wl = ctx.createBiquadFilter(), wg = ctx.createGain();
    wb.type = 'bandpass'; wb.frequency.value = 800; wb.Q.value = 1.1; wl.type = 'lowpass'; wl.frequency.value = 2600; wg.gain.value = 0;
    ws.connect(wb); wb.connect(wl); wl.connect(wg); wg.connect(bus);
    const wlfo = ctx.createOscillator(), wld = ctx.createGain(); wlfo.frequency.value = 0.23; wld.gain.value = 260; wlfo.connect(wld); wld.connect(wb.frequency);
    const glfo = ctx.createOscillator(), gld = ctx.createGain(); glfo.frequency.value = 0.41; gld.gain.value = 0; glfo.connect(gld); gld.connect(wg.gain);
    rs.start(); ws.start(Audio_.ctx.currentTime, 1.3); rlfo.start(); wlfo.start(); glfo.start();
    nodes = { rg, rl, rld, wg, gld, wb };
    lay.built = true;
  }
  function weatherTargets() {
    const out = { rain: 0, wind: 0, cut: 5200, indoors: false };
    const lvl = WEATHER_GAIN[set.weather] || 0;
    if (!lvl || typeof G === 'undefined' || !G.map || G.state === 'title' || typeof Weather === 'undefined') return out;
    const outdoor = !!G.map.outdoor;
    out.indoors = !outdoor;
    const st = Weather.state;
    if (st === 'rain' || st === 'storm') {
      const heavy = st === 'storm' ? 1 : 0;
      if (outdoor) { out.rain = (0.05 + 0.04 * heavy) * lvl; out.cut = 5200; }
      else if (DEEP[G.map.music]) { out.rain = 0.004 * lvl; out.cut = 300; }       // under stone: a rumour of it
      else { out.rain = (0.032 + 0.03 * heavy) * lvl; out.cut = 650; }              // a roof: muffled patter
    }
    if (outdoor && WILLOWS[G.mapId]) out.wind = clamp(Weather.wind, 0, 1) * 0.075 * lvl;
    return out;
  }
  function tickLayers() {
    if (typeof Audio_ === 'undefined' || !Audio_.ctx || !Audio_.sfxBus) return;
    const t = weatherTargets();
    if (Audio_.muted) { t.rain = 0; t.wind = 0; }
    lay.rain = t.rain; lay.wind = t.wind; lay.rainCut = t.cut; lay.indoors = t.indoors;
    if (!nodes) { if (t.rain <= 0 && t.wind <= 0) return; build(); }
    const now = Audio_.ctx.currentTime;
    nodes.rg.gain.setTargetAtTime(Math.max(0.0001, t.rain), now, 0.7);
    nodes.rld.gain.setTargetAtTime(t.rain * 0.3, now, 0.7);
    nodes.rl.frequency.setTargetAtTime(t.cut, now, 0.5);
    nodes.wg.gain.setTargetAtTime(Math.max(0.0001, t.wind), now, 1.2);
    nodes.gld.gain.setTargetAtTime(t.wind * 0.45, now, 1.2);
  }
  // thunder: scheduled from the flash, delayed by how far off the bolt fell, quieter and duller the further it is
  let lastFlashAt = -99, prevFlash = 0;
  function rumble(dist, level) {
    const ctx = Audio_.ctx, t0 = ctx.currentTime, dur = 3.4 + dist * 0.5;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf || (() => { const b = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = audioRnd() * 2 - 1; noiseBuf = b; return b; })();
    s.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.max(160, 520 - dist * 70) * (lay.indoors ? 0.6 : 1); lp.Q.value = 0.7;
    const g = ctx.createGain(), peak = clamp(0.5 - dist * 0.07, 0.08, 0.5) * level;
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + 0.12);
    g.gain.exponentialRampToValueAtTime(peak * 0.45, t0 + 0.9); g.gain.linearRampToValueAtTime(peak * 0.8, t0 + 1.2);   // the roll
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    const sub = ctx.createOscillator(); sub.type = 'triangle'; sub.frequency.setValueAtTime(52, t0); sub.frequency.exponentialRampToValueAtTime(28, t0 + dur);
    const sg = ctx.createGain(); sg.gain.setValueAtTime(0.0001, t0); sg.gain.linearRampToValueAtTime(peak * 0.5, t0 + 0.2); sg.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(lp); lp.connect(g); sub.connect(sg);
    let outNode = g;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = (audioRnd() - 0.5) * 0.6; g.connect(p); sg.connect(p); outNode = p; } else sg.connect(g);
    outNode.connect(Audio_.sfxBus);
    s.start(t0); sub.start(t0); s.stop(t0 + dur + 0.1); sub.stop(t0 + dur + 0.1);
  }
  function onFlash() {
    const now = performance.now() / 1000;
    if (now - lastFlashAt < 1.5) return;
    lastFlashAt = now;
    const lvl = WEATHER_GAIN[set.weather] || 0;
    if (!lvl || typeof Audio_ === 'undefined' || !Audio_.ctx) return;
    const dist = 0.3 + audioRnd() * 3.7, delay = 0.35 + dist * 1.1;   // about 3 s per "kilometre", like the real thing slowed for play
    const rec = { delay, dist, level: lvl, fired: false };
    stats.thunders.push(rec); if (stats.thunders.length > 20) stats.thunders.shift();
    setTimeout(() => { try { if (ready() || (Audio_.ctx && !Audio_.muted)) { rumble(dist, lvl); rec.fired = true; } } catch (e) { console.warn('thunder failed', e); } }, delay * 1000);
  }

  // ---- wiring --------------------------------------------------------------------------------
  function el(tag, props, text) {
    const e = document.createElement(tag);
    if (props) for (const k in props) { if (k === 'style') e.style.cssText = props[k]; else e.setAttribute(k, props[k]); }
    if (text != null) e.textContent = text;
    return e;
  }
  function appendRows() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById('spatial-head')) return;
    grid.appendChild(el('span', { id: 'spatial-head', style: 'grid-column:1/-1;margin-top:1cqh;color:var(--gold);font-family:var(--font-display);letter-spacing:.08em' }, 'Sound space'));
    const row = (label, hint) => { const s = el('span', { class: 'gfx-label' }, label); s.appendChild(document.createTextNode(' ')); s.appendChild(el('small', { class: 'muted' }, hint)); return s; };
    const btn = (id, aria, fn) => { const b = el('button', { class: 'dfbtn small', id, type: 'button' }, ''); b.setAttribute('aria-label', aria); b.onclick = () => { fn(); save(); sync(); }; return b; };
    const pos = btn('spatial-pos', 'Positional sound', () => { set.positional = !set.positional; });
    const wx = btn('spatial-wx', 'Weather sound', () => { set.weather = (set.weather + 1) % 4; });
    function sync() {
      pos.textContent = set.positional ? 'On' : 'Off'; pos.setAttribute('aria-pressed', set.positional ? 'true' : 'false'); pos.classList.toggle('sel', set.positional);
      wx.textContent = WEATHER_NAMES[set.weather]; wx.setAttribute('aria-pressed', set.weather ? 'true' : 'false'); wx.classList.toggle('sel', set.weather > 0);
    }
    grid.appendChild(row('Positional sound', 'foes, birds and bells pan, fade and muffle by where they are'));
    grid.appendChild(pos);
    grid.appendChild(row('Weather sound', 'rain, willow wind and thunder; works with sound effects on'));
    grid.appendChild(wx);
    sync();
  }
  // run fn with `cur` set to e for the duration of a game function that acts for that foe
  function around(name, pick) {
    const f = window[name]; if (typeof f !== 'function') return;
    window[name] = function () {
      const prev = cur, e = pick.apply(null, arguments);
      if (e && e.x === e.x) cur = e;
      try { return f.apply(this, arguments); } finally { cur = prev; }
    };
  }
  function wire() {
    if (typeof Audio_ === 'undefined' || !Audio_.sfx) return;
    ['enemy', 'bell', 'bellDie', 'hound', 'golem', 'press', 'bow', 'shot', 'voice', 'song', 'crack', 'bird', 'rat'].forEach(wrap);
    // the foe that is acting: its update, its death, its extra moves
    around('enemyUpdate', e => e);
    around('killEnemy', e => e);
    around('enemyExtra', e => e);
    around('drownedShriek', e => e);
    around('chordBlast', e => e);
    // the old rain-burst timer is replaced by the continuous bed; thunder from the old timer by the delayed rumble
    const sfx = Audio_.sfx, rain = sfx.rain, thunder = sfx.thunder;
    if (typeof rain === 'function') sfx.rain = function () { if (WEATHER_GAIN[set.weather] > 0 && Audio_.ctx) return; return rain.apply(this, arguments); };
    if (typeof thunder === 'function') sfx.thunder = function () {
      if (WEATHER_GAIN[set.weather] > 0 && Audio_.ctx && performance.now() / 1000 - lastFlashAt < 3) return;   // the flash already scheduled its own
      return thunder.apply(this, arguments);
    };
    // lightning flash -> thunder: watch the raw value Weather hands the renderer (before any no-flash filter)
    if (typeof Engine !== 'undefined' && Engine.setWeather) {
      const _sw = Engine.setWeather;
      Engine.setWeather = function (o) {
        try { const f = o && +o.flash || 0; if (f > 0.4 && prevFlash <= 0.4) onFlash(); prevFlash = f; } catch (e) { /* sound only */ }
        return _sw.apply(this, arguments);
      };
    }
    if (typeof update === 'function') {
      const _update = update;
      update = function (dt) {
        const r = _update.apply(this, arguments);
        try { tickLayers(dt); } catch (e) { console.warn('spatial tick failed', e); }
        return r;
      };
    }
    if (typeof renderAccessibilityMenu === 'function') {
      const _acc = renderAccessibilityMenu;
      renderAccessibilityMenu = function () {
        const r = _acc.apply(this, arguments);
        try { appendRows(); } catch (e) { console.warn('spatial rows failed', e); }
        return r;
      };
    }
  }

  load();
  try { wire(); } catch (e) { console.warn('spatial-audio wiring failed', e); }
  return {
    settings: set, stats, layers: lay, mix, wallsBetween, wallsCached, sourceOf, weatherTargets, tickLayers, onFlash, rumble, appendRows, save, load,
    wrap, ready, MAX_PAN, REF, WALL_CUT, WEATHER_GAIN,
    get current() { return cur; }, set current(v) { cur = v; },
    get nodes() { return nodes; },
    audio: 'routes world-positioned sfx through gain, low-pass and stereo pan; adds rain, willow-wind and thunder layers',
  };
})();
