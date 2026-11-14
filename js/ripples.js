// ============================================================
//  ripples — Phase 8: directional on-screen sound ripples
//  An aid for players who are deaf, hard of hearing, or playing muted. When a sound that has a place in the world
//  happens, a short arc appears at the edge of the 3D view on the side it comes from: ahead at the top edge, behind
//  at the bottom, left and right on the sides. Loudness sets the size, distance sets how faint it is, and a sound
//  heard through a wall is drawn dashed and fainter. Foes are red-ochre, people warm gold, the world parchment.
//  What makes one: foe alert / attack / hurt / death and their bells, hound-cries, golem steps, hand-presses, bows,
//  shots, songs and voices (the same positions js/spatial-audio.js uses), the footfalls of foes close by (rate
//  limited), doors and gates that other hands move, a thrown stone or bottle landing, a companion's spoken line,
//  and thunder (no direction: a soft shimmer along the top). Sounds the game gives no place get no ripple.
//  Nothing is saved with the game and nothing here touches gameplay: it reads state and wraps sound calls only.
//  Setting "Sound ripples" (Off / On, default Off), Options > Graphics & access, next to Sound captions.
//  Honours GFX.reduceMotion (a still arc that fades), GFX.noFlash (no bright pulses), high contrast (thick white
//  arcs with a black outline) and photo mode (hidden). Captions, when on, put their text beside the ripple.
//  Procedural stand-in: plain canvas arcs; a final pass could swap in painted glyphs.
// ============================================================
'use strict';

const RIPPLES = (() => {
  const KEY = 'octave.ripples.v1';
  const set = { on: false };
  const MAX = 6;               // ripples alive at once
  const LIFE = 1200;           // ms each lasts
  const SRC_GAP = 320;         // ms between ripples from the same source
  const CW = 960, CH = 450;    // overlay resolution: the 3D view is the top 75% of the 320x200 game canvas
  const MAX_DIST = 26;         // beyond this many cells nothing shows
  const FOOT_GAP = 520, FOOT_NEAR = 9;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const list = [];             // live ripples
  const stats = { spawned: 0, dropped: 0, limited: 0, drawn: 0, last: null };
  let lastBySrc = new WeakMap();     // source entity -> ms of its last ripple
  let lastByKey = {};                // string keys (thunder, a stone) -> ms
  const foot = new WeakMap();        // enemy -> { x, y, acc, at }
  let cv = null, cx = null, styleEl = null, drewLast = false, doorMap = null, doorSeen = null;

  // ---- persistence (guarded: previews and private windows have no storage) --------------------
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ on: set.on ? 1 : 0 })); } catch (e) { /* no storage: fine */ } }
  function load() { try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o) set.on = o.on === 1; } catch (e) { /* ignore */ } }

  // ---- how loud each sound is, and what it is called for the caption ---------------------------
  // base = size 0..1; cap = ACCESS caption key (shown only when Sound captions is on)
  const SND = {
    alert: { base: 0.9, cap: 'alert' }, attack: { base: 1.0, cap: 'attack' }, hurt: { base: 0.6, cap: null },
    death: { base: 0.8, cap: 'death' }, bell: { base: 1.0, cap: 'bell' }, bellDie: { base: 0.9, cap: 'bellDie' },
    hound: { base: 0.85, cap: 'hound' }, golem: { base: 0.9, cap: 'golem' }, press: { base: 0.6, cap: 'press' },
    bow: { base: 0.7, cap: 'bow' }, shot: { base: 0.8, cap: 'shot' }, song: { base: 0.5, cap: 'song' },
    crack: { base: 0.7, cap: 'crack' }, voice: { base: 0.5, cap: 'voice' }, door: { base: 0.6, cap: 'door' },
    stone: { base: 0.5, cap: null }, foot: { base: 0.28, cap: null }, line: { base: 0.45, cap: null },
    thunder: { base: 0.7, cap: 'thunder' },
  };
  // red-ochre foes, warm gold people, parchment world. rgb strings, alpha applied at draw time
  const TINT = { enemy: '214,104,52', person: '240,196,108', world: '226,214,184' };

  // ---- the geometry (pure, so the tests can drive it) ------------------------------------------
  // angle of the source relative to the camera: 0 ahead, +90deg right, 180 behind (engine forward = (cos,sin), right = (-sin,cos))
  function bearing(cam, sx, sy) {
    const dx = sx - cam.x, dy = sy - cam.y;
    let a = Math.atan2(dy, dx) - cam.dir;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a <= -Math.PI) a += Math.PI * 2;
    return a;
  }
  // where on the view's edge a bearing lands: x,y in overlay pixels and nx,ny, the unit vector pointing into the view
  function edgePoint(theta, w, h) {
    const m = Math.round(h * 0.07), a = Math.abs(theta), sg = theta < 0 ? -1 : 1;
    const hw = w / 2 - m, top = m, bot = h - m, span = hw * 0.86;
    const Q = Math.PI / 4;
    if (a <= Q) return { x: w / 2 + sg * (a / Q) * span, y: top, nx: 0, ny: 1, edge: 'top' };
    if (a >= Q * 3) return { x: w / 2 + sg * ((Math.PI - a) / Q) * span, y: bot, nx: 0, ny: -1, edge: 'bottom' };
    const f = (a - Q) / (Q * 2);                       // 0 at the front corner, 1 at the back corner
    return { x: w / 2 + sg * hw, y: top + f * (bot - top), nx: -sg, ny: 0, edge: sg < 0 ? 'left' : 'right' };
  }
  function listener() { const c = (typeof Engine !== 'undefined' && Engine.cam) || null; return c ? { x: c.x, y: c.y, dir: c.dir } : null; }
  function walls(sx, sy, L) {
    try {
      if (typeof SPATIAL !== 'undefined' && SPATIAL.wallsBetween && typeof G !== 'undefined' && G.map) return SPATIAL.wallsBetween(G.map, sx, sy, L.x, L.y);
    } catch (e) { /* none */ }
    return 0;
  }
  function falloff(d) { return d <= 2.5 ? 1 : Math.max(0.1, 1 / (1 + Math.pow((d - 2.5) / 7, 1.6))); }   // same curve as spatial-audio

  // ---- making a ripple ---------------------------------------------------------------------------
  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  function capText(key) {
    try { if (key && ACCESS && ACCESS.settings && ACCESS.settings.cap) return ACCESS.t('cap.' + key) || ''; } catch (e) { /* no captions */ }
    return '';
  }
  // spawn(sound, tint, x, y, owner): the one entry point. owner is the source entity (rate-limit key) or null.
  function spawn(snd, tint, x, y, owner, at) {
    if (!set.on) return null;
    const def = SND[snd]; if (!def) return null;
    const L = listener(); if (!L || !(x === x) || !(y === y)) return null;
    const t = at == null ? nowMs() : at;
    const d = Math.hypot(x - L.x, y - L.y);
    if (d > MAX_DIST) return null;
    if (owner && typeof owner === 'object') { const p = lastBySrc.get(owner) || -1e9; if (t - p < SRC_GAP) { stats.limited++; return null; } lastBySrc.set(owner, t); }
    else { const k = snd + ':' + Math.round(x) + ',' + Math.round(y); if (t - (lastByKey[k] || -1e9) < SRC_GAP) { stats.limited++; return null; } lastByKey[k] = t; }
    const w = walls(x, y, L), g = falloff(d);
    const r = { snd, tint, x, y, t0: t, size: def.base, alpha: clamp((0.3 + 0.7 * g) * (w > 0 ? 0.6 : 1), 0.12, 1), muffled: w > 0, theta: bearing(L, x, y), dist: d, text: capText(def.cap), sky: false };
    return push(r);
  }
  function push(r) {
    if (list.length >= MAX) {                        // full: drop the oldest, unless the new one is fainter than all
      let wi = 0; for (let i = 1; i < list.length; i++) if (list[i].t0 < list[wi].t0) wi = i;
      list.splice(wi, 1); stats.dropped++;
    }
    list.push(r); stats.spawned++; stats.last = r; return r;
  }
  // thunder has no direction: a soft shimmer along the whole top edge
  function sky(at) {
    if (!set.on) return null;
    const t = at == null ? nowMs() : at;
    if (t - (lastByKey.thunder || -1e9) < 1500) { stats.limited++; return null; }
    lastByKey.thunder = t;
    return push({ snd: 'thunder', tint: 'world', x: 0, y: 0, t0: t, size: SND.thunder.base, alpha: 0.75, muffled: false, theta: 0, dist: 0, text: capText('thunder'), sky: true });
  }

  // ---- finding where a sound comes from (reuses spatial-audio's own lookup) ------------------------
  function sourceOf(name, args) {
    try { return typeof SPATIAL !== 'undefined' && SPATIAL.sourceOf ? SPATIAL.sourceOf(name, args) : null; } catch (e) { return null; }
  }
  const FOE_EVENTS = { alert: 1, attack: 1, hurt: 1, death: 1 };
  function onSfx(name, args) {
    if (!set.on || typeof G === 'undefined' || !G.map) return;
    if (name === 'thunder') { sky(); return; }
    if (name === 'enemy') {
      const ev = args[1]; if (!FOE_EVENTS[ev]) return;
      const src = sourceOf('enemy', args); if (!src) return;
      spawn(ev, 'enemy', src.x, src.y, src);
      return;
    }
    const src = sourceOf(name, args); if (!src) return;       // only when a foe is the one acting
    spawn(name, src.kind === 'enemy' || src.def ? 'enemy' : 'person', src.x, src.y, src);
  }

  // ---- things seen by watching rather than hearing: foes' footfalls, doors that move -----------------
  function quietFoe(e) { const d = e.def || {}; return !!(d.quiet || d.hushkin); }   // the Hush makes no sound, so it makes no ripple
  function tick() {
    if (!set.on || typeof G === 'undefined' || !G.map || !G.ents || G.state !== 'play') return;
    const L = listener(); if (!L) return;
    const t = nowMs();
    for (const e of G.ents) {
      if (!e || e.kind !== 'enemy' || e.dead || e.hidden || e.passive || quietFoe(e)) continue;
      const d = Math.hypot(e.x - L.x, e.y - L.y); if (d > FOOT_NEAR) { foot.delete(e); continue; }
      let f = foot.get(e);
      if (!f) { foot.set(e, { x: e.x, y: e.y, acc: 0, at: t }); continue; }
      f.acc += Math.hypot(e.x - f.x, e.y - f.y); f.x = e.x; f.y = e.y;
      if (f.acc > 0.7 && t - f.at > FOOT_GAP) { f.acc = 0; f.at = t; spawn('foot', 'enemy', e.x, e.y, e, t); }
    }
    // doors and gates other hands move: watch each door's target, never the ones at your own elbow
    const doors = G.map.doors;
    if (doors !== doorMap) { doorMap = doors; doorSeen = {}; if (doors) for (const k in doors) doorSeen[k] = doors[k] && doors[k].target; return; }
    if (!doors) return;
    for (const k in doors) {
      const d = doors[k]; if (!d) continue;
      if (doorSeen[k] === d.target) continue;
      doorSeen[k] = d.target;
      const w = G.map.w, ci = +k, dx = (ci % w) + 0.5, dy = Math.floor(ci / w) + 0.5;
      if (Math.hypot(dx - L.x, dy - L.y) < 1.8) continue;
      spawn('door', 'world', dx, dy, null, t);
    }
  }

  // ---- drawing -------------------------------------------------------------------------------------
  function highContrast() { return document.documentElement.classList.contains('ac-hc'); }
  function inPhoto() { const g = document.getElementById('game'); return !!(g && g.classList.contains('p7-photo')) || (typeof G !== 'undefined' && G.state === 'photo'); }
  function ensureCanvas() {
    if (cv && cv.isConnected) return cv;
    const g = document.getElementById('game'); if (!g) return null;
    if (!styleEl) {
      styleEl = document.createElement('style'); styleEl.id = 'ripples-style';
      // the overlay covers only the 3D view (top 75% of the game), never the HUD bar; photo mode hides it
      styleEl.textContent = '#rp-canvas { position: absolute; left: 0; top: 0; width: 100%; height: 75%; pointer-events: none; z-index: 5; display: none; }\n' +
        '#rp-canvas.on { display: block; }\n#game.p7-photo #rp-canvas { display: none !important; }';
      document.head.appendChild(styleEl);
    }
    cv = document.createElement('canvas'); cv.id = 'rp-canvas'; cv.width = CW; cv.height = CH; cv.setAttribute('aria-hidden', 'true');
    g.appendChild(cv); cx = cv.getContext('2d');
    return cv;
  }
  function fade2(age) { return age > 0.8 ? (1 - age) / 0.2 : 1; }
  // one arc group: nested arcs bulging into the view from an edge point
  function drawRipple(c, r, t, rm, nf, hc) {
    const age = (t - r.t0) / LIFE; if (age < 0 || age >= 1) return;
    const fade = rm ? 1 - age : (1 - age) * (1 - age * 0.3);
    const peak = nf ? 0.7 : 0.95;
    const a = clamp(r.alpha * fade * peak, 0, 1);
    const col = TINT[r.tint] || TINT.world;
    const u = CH / 450;
    if (r.sky) {                                                   // thunder: a band of light along the top, no direction
      const hgt = CH * (0.08 + 0.05 * r.size);
      const gr = c.createLinearGradient(0, 0, 0, hgt);
      gr.addColorStop(0, 'rgba(' + col + ',' + (a * (hc ? 0.9 : 0.5)).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(' + col + ',0)');
      c.fillStyle = gr; c.fillRect(0, 0, CW, hgt);
      if (hc) { c.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')'; c.fillRect(0, 0, CW, 4 * u); }
      if (r.text) label(c, r, CW / 2, hgt + 18 * u, a, hc);
      return;
    }
    const p = edgePoint(r.theta, CW, CH);
    const base = Math.atan2(p.ny, p.nx);                           // the direction pointing into the view
    const maxR = (46 + 74 * r.size) * u;
    const grow = rm ? 1 : clamp(age * 2.2, 0.0, 1);                // an expanding ring, or (reduce motion) a still one
    const rings = rm ? 3 : 3;
    const half = 0.62 + 0.25 * r.size;
    c.save();
    c.lineCap = 'round';
    c.setLineDash(r.muffled ? [9 * u, 8 * u] : []);
    for (let i = 0; i < rings; i++) {
      const rad = rm ? maxR * (0.42 + 0.29 * i) : maxR * clamp(grow * (0.45 + 0.28 * i) + (i === 0 ? 0.08 : 0), 0.05, 1);
      const ra = hc ? clamp(Math.max(a, 0.55) * (1 - i * 0.12) * fade2(age), 0, 1) : clamp(a * (1 - i * 0.24), 0, 1);   // high contrast stays solid until the last moments
      if (ra < 0.02) continue;
      c.beginPath(); c.arc(p.x, p.y, rad, base - half, base + half);
      if (hc) { c.strokeStyle = 'rgba(0,0,0,' + Math.min(1, ra + 0.2).toFixed(3) + ')'; c.lineWidth = (r.muffled ? 9 : 12) * u; c.stroke(); c.strokeStyle = 'rgba(255,255,255,' + Math.min(1, ra + 0.15).toFixed(3) + ')'; c.lineWidth = (r.muffled ? 5 : 7) * u; c.stroke(); }
      else {
        c.strokeStyle = 'rgba(8,6,4,' + (ra * 0.55).toFixed(3) + ')'; c.lineWidth = 7 * u; c.stroke();   // a dark underline so it reads on any scene
        c.strokeStyle = 'rgba(' + col + ',' + ra.toFixed(3) + ')'; c.lineWidth = (r.muffled ? 2.6 : 4) * u; c.stroke();
      }
    }
    c.restore();
    if (r.text) label(c, r, clamp(p.x + p.nx * (maxR * 0.5 + 24 * u), 90 * u, CW - 90 * u), clamp(p.y + p.ny * (maxR * 0.5 + 18 * u), 24 * u, CH - 12 * u), a, hc);
  }
  function label(c, r, x, y, a, hc) {
    c.save();
    c.font = 'italic ' + Math.round(22 * CH / 450) + 'px Alegreya, Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = c.measureText(r.text).width + 16;
    c.fillStyle = hc ? 'rgba(0,0,0,' + Math.min(1, a + 0.2).toFixed(3) + ')' : 'rgba(8,6,4,' + (a * 0.8).toFixed(3) + ')';
    c.fillRect(x - w / 2, y - 15, w, 30);
    if (hc) { c.strokeStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')'; c.lineWidth = 2; c.strokeRect(x - w / 2, y - 15, w, 30); }
    c.fillStyle = hc ? 'rgba(255,255,255,' + a.toFixed(3) + ')' : 'rgba(' + (TINT[r.tint] || TINT.world) + ',' + a.toFixed(3) + ')';
    c.fillText(r.text, x, y + 1);
    c.restore();
  }
  // draw(now): called after each frame; cheap and silent when there is nothing to show
  function draw(t) {
    const t0 = t == null ? nowMs() : t;
    for (let i = list.length - 1; i >= 0; i--) if (t0 - list[i].t0 >= LIFE) list.splice(i, 1);
    const show = set.on && list.length > 0 && !inPhoto() && typeof G !== 'undefined' && ['play', 'dialogue', 'event'].includes(G.state);
    if (!show) {
      if (cv && drewLast) { cx.clearRect(0, 0, CW, CH); cv.classList.remove('on'); drewLast = false; }
      return 0;
    }
    if (!ensureCanvas()) return 0;
    const rm = !!(typeof GFX !== 'undefined' && GFX.reduceMotion), nf = !!(typeof GFX !== 'undefined' && GFX.noFlash), hc = highContrast();
    cx.clearRect(0, 0, CW, CH); cv.classList.add('on'); drewLast = true;
    // ripples keep their position relative to the world: the bearing is refreshed from the camera each frame
    const L = listener();
    for (const r of list) { if (L && !r.sky) r.theta = bearing(L, r.x, r.y); drawRipple(cx, r, t0, rm, nf, hc); }
    stats.drawn++;
    return list.length;
  }
  function clear() { list.length = 0; lastBySrc = new WeakMap(); lastByKey = {}; if (cv && cx) { cx.clearRect(0, 0, CW, CH); cv.classList.remove('on'); } drewLast = false; }

  // ---- the setting ---------------------------------------------------------------------------------------
  function setOn(v) {
    set.on = !!v; save();
    if (!set.on) clear();
    else { doorMap = null; }
    const b = document.getElementById('rp-toggle'); if (b) syncBtn(b);
    return set.on;
  }
  function syncBtn(b) { b.textContent = set.on ? 'On' : 'Off'; b.setAttribute('aria-pressed', set.on ? 'true' : 'false'); b.classList.toggle('sel', set.on); }
  function appendRows() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById('rp-toggle')) return;
    const lab = document.createElement('span'); lab.className = 'gfx-label'; lab.id = 'rp-label'; lab.textContent = 'Sound ripples ';
    const small = document.createElement('small'); small.className = 'muted'; small.textContent = 'arcs at the edge of the view show where sounds come from'; lab.appendChild(small);
    const b = document.createElement('button'); b.className = 'dfbtn small'; b.id = 'rp-toggle'; b.type = 'button'; b.setAttribute('aria-label', 'Sound ripples');
    b.onclick = () => { setOn(!set.on); syncBtn(b); };
    syncBtn(b);
    const cap = document.getElementById('ac-cap');
    if (cap && cap.parentNode) { cap.insertAdjacentElement('afterend', b); cap.insertAdjacentElement('afterend', lab); }   // right after Sound captions
    else { grid.appendChild(lab); grid.appendChild(b); }
  }

  // ---- wiring ------------------------------------------------------------------------------------------------
  function wire() {
    if (typeof Audio_ !== 'undefined' && Audio_.sfx) {
      ['enemy', 'bell', 'bellDie', 'hound', 'golem', 'press', 'bow', 'shot', 'song', 'crack', 'voice', 'thunder'].forEach((name) => {
        const orig = Audio_.sfx[name]; if (typeof orig !== 'function') return;
        // outermost wrapper: it sees the call even when the player is muted, which is the point
        Audio_.sfx[name] = function () {
          try { onSfx(name, arguments); } catch (e) { console.warn('ripples sfx failed', e); }
          return orig.apply(this, arguments);
        };
      });
    }
    if (typeof throwDistraction === 'function' && typeof distractionImpact === 'function') {
      const _throw = throwDistraction;
      throwDistraction = function (id) {
        let pt = null;
        try { if (set.on && G.state === 'play') pt = distractionImpact(id); } catch (e) { pt = null; }   // a read-only ray: no side effects
        const r = _throw.apply(this, arguments);
        try { if (r && pt) spawn('stone', 'world', pt.x, pt.y, null); } catch (e) { console.warn('ripples throw failed', e); }
        return r;
      };
    }
    if (typeof VOICE_ACT !== 'undefined' && VOICE_ACT && typeof VOICE_ACT.playLine === 'function') {
      const _pl = VOICE_ACT.playLine;
      VOICE_ACT.playLine = function (l) {
        try {
          if (set.on && l && l.kind === 'companion' && typeof partyEnt === 'function') {
            const e = partyEnt(); if (e && G.map && G.ents && G.ents.indexOf(e) >= 0) spawn('line', 'person', e.x, e.y, e);
          }
        } catch (err) { console.warn('ripples line failed', err); }
        return _pl.apply(this, arguments);
      };
    }
    if (typeof update === 'function') {
      const _update = update;
      update = function () {
        const r = _update.apply(this, arguments);
        try { tick(); } catch (e) { console.warn('ripples tick failed', e); }
        return r;
      };
    }
    if (typeof render === 'function') {
      const _render = render;
      render = function () {
        const r = _render.apply(this, arguments);
        try { draw(); } catch (e) { console.warn('ripples draw failed', e); }
        return r;
      };
    }
    if (typeof loadMap === 'function') {
      const _lm = loadMap;
      loadMap = function () { const r = _lm.apply(this, arguments); try { clear(); doorMap = null; } catch (e) { /* cosmetic */ } return r; };
    }
  }
  // access.js loads after this file and adds the Sound captions row inside its own wrapper, so the Options
  // wrapper is installed once every script has run: then it is outermost and #ac-cap already exists
  function wireMenu() {
    if (typeof renderAccessibilityMenu !== 'function') return;
    const _acc = renderAccessibilityMenu;
    renderAccessibilityMenu = function () {
      const r = _acc.apply(this, arguments);
      try { appendRows(); } catch (e) { console.warn('ripples rows failed', e); }
      return r;
    };
  }

  load();
  try { wire(); } catch (e) { console.warn('ripples wiring failed', e); }
  if (typeof document !== 'undefined' && document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireMenu); else wireMenu();
  return {
    settings: set, stats, list, SND, TINT, MAX, LIFE, SRC_GAP,
    bearing, edgePoint, spawn, sky, onSfx, tick, draw, clear, setOn, appendRows, save, load,
    get canvas() { return cv; },
    audio: 'reads positions only; makes no sound',
  };
})();
if (typeof window !== 'undefined') window.RIPPLES = RIPPLES;
