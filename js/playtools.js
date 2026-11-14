// ============================================================
//  playtools — Phase 7: photo mode, an optional speedrun timer, a statistics page
//
//  1. PHOTO MODE (key Backslash, or Options > Graphics & access > Photo mode).
//     G.state becomes 'photo'. The wrapper around update() returns before the
//     real update runs, so nothing advances: no AI, timers, hunger, weather,
//     day/night, doors or particles. Leaving puts the camera back and sets
//     G.state to 'play', so the game resumes exactly where it stopped.
//     The picture is Engine.render() with no drawHUD, so no HUD, weapon or
//     hands; DOM overlays (messages, hints, touch buttons, timer) are hidden by
//     a class. The camera can look (drag, arrows), tilt (Q/E) and dolly a few
//     paces (W/A/S/D, wheel), never through a wall and never out of a small
//     radius. Save picture exports the clean 3D frame as a PNG through
//     canvas.toBlob and a download link; "2x" re-renders once at double size.
//  2. SPEEDRUN TIMER (Options row, off by default). Two clocks, both stored in
//     the run's own G.flags as integers (p7t_*), so they ride save and load:
//       real time  - wall clock since the run began. Keeps running through
//                    panels, dialogue, photo mode and the death screen; does not
//                    run on the title, creation, intro or an ending screen, nor
//                    while the page is hidden (one tick counts at most 1 s).
//       game time  - only while you are actually playing: not in panels,
//                    dialogue, events, loading, photo mode, death or ending.
//     Starts on a new game; a save made before the timer existed starts timing
//     when it is first loaded (marked "late"). The clocks stop on every ending
//     screen. Splits are taken the first time each story flag is seen:
//     gate_open, rite_started, greening, escaped, part3, part4, book_one_done.
//  3. STATISTICS (Options > Graphics & access > Statistics): kills by family,
//     paces walked and ridden, play time, Songs cast, sovereigns earned and
//     spent, bodies found by patrols, rests, days passed, plus what the game
//     already counts (kills, names kept, crime). Counters are p7s_ integers in
//     G.flags, read through a validator that clamps hostile values.
//  Everything is derived or stored in existing fields: no new save fields.
// ============================================================
'use strict';

const PLAYTOOLS = (() => {
  const LS_KEY = 'octave.playtools.v1';
  const cfg = { timer: false, photoBar: true };
  const POLICY = 'Real time runs from a new game, through panels, dialogue, photo mode and the death screen. Game time counts only while you play: panels, dialogue, loading, photo mode, death and ending screens do not. Both stop at each ending, and are kept with the save.';
  const MILESTONES = [
    ['gate_open', 'North Gate opened'], ['rite_started', 'The Rite begins'], ['greening', 'The greening'],
    ['escaped', 'Part Two ends'], ['part3', 'Part Three'], ['part4', 'Part Four'], ['book_one_done', 'Book One ends'],
  ];
  const FAMILIES = [['cac', 'Cacophonies'], ['bell', 'Bell-bound'], ['con', 'Constructs'], ['qui', 'Quiets'], ['oth', 'Others']];
  const SONG_IDS = ['murmur', 'tending', 'fifth', 'root', 'name', 'other'];
  const BIG = 9e9, MAXC = 999999999;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ---- settings (own localStorage key, guarded) ---------------------------------------------
  function saveCfg() { try { localStorage.setItem(LS_KEY, JSON.stringify({ t: cfg.timer ? 1 : 0 })); } catch (e) { /* no storage: fine */ } }
  function loadCfg() { try { const o = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if (o && typeof o === 'object') cfg.timer = o.t === 1; } catch (e) { /* ignore */ } }

  // ---- validated flag integers ----------------------------------------------------------------
  function rd(key, max) {
    const f = G.flags; if (!f || typeof f !== 'object') return 0;
    const v = f[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
    return clamp(Math.floor(v), 0, max || MAXC);
  }
  function put(key, v, max) { G.flags[key] = clamp(Math.floor(Number.isFinite(v) ? v : 0), 0, max || MAXC); }
  function inc(key, n, max) { if (!G.flags) return; put(key, rd(key, max) + (n == null ? 1 : n), max); }

  // ---- the run clock ---------------------------------------------------------------------------
  // In-memory accumulators (milliseconds / tenths of a pace) are flushed to the flags every second,
  // before every snapshot and on leaving photo mode. A new flags object (load, new game) reloads them.
  const T = { g: 0, r: 0, walk: 0, ride: 0, flags: null, lastReal: null, lastFlush: 0, pos: null, gold: null, bodies: new WeakSet() };
  const photo = { on: false, prev: 'play', saved: null, origin: null, tilt: 0, shot: null, lastBlob: null, saves: 0, bar: null, status: null, barHidden: false, drag: null };

  function syncFromFlags() {
    T.flags = G.flags;
    T.g = rd('p7t_gms', BIG); T.r = rd('p7t_rms', BIG);
    T.walk = rd('p7s_walk'); T.ride = rd('p7s_ride');
    T.lastReal = null; T.pos = null; T.gold = null;
  }
  function flush(force) {
    if (!G.flags || T.flags !== G.flags) return;
    if (photo.on && !force) return;   // a photo never changes the save: real time is written when you leave
    if (G.flags.p7t_on !== 1) return;
    put('p7t_gms', T.g, BIG); put('p7t_rms', T.r, BIG);
    put('p7s_walk', T.walk); put('p7s_ride', T.ride);
  }
  function runActive() { return !!(G.player && G.flags && G.flags.p7t_on === 1); }
  function ensureRun() {
    if (!G.player || !G.flags) return false;
    if (T.flags !== G.flags) syncFromFlags();
    if (G.flags.p7t_on !== 1) {
      // an older save, or a harness that replaced the flags: time from here, and say so
      G.flags.p7t_on = 1; G.flags.p7t_late = 1; T.g = 0; T.r = 0;
    }
    return true;
  }
  // gameMs counts only when `playing`; realMs counts whenever the run is live. Pure so tests can drive it.
  function advance(gameMs, realMs, playing, live) {
    if (!ensureRun()) return;
    if (live) T.r = clamp(T.r + Math.max(0, realMs), 0, BIG);
    if (playing) T.g = clamp(T.g + Math.max(0, gameMs), 0, BIG);
  }
  const LIVE_STATES = ['play', 'panel', 'dialogue', 'event', 'photo', 'dead'];
  function splits() {
    const out = [];
    for (const [flag, label] of MILESTONES) {
      const g = rd('p7t_sg_' + flag, BIG), r = rd('p7t_sr_' + flag, BIG);
      if (g || r) out.push({ flag, label, game: Math.max(0, g - 1), real: Math.max(0, r - 1) });
    }
    return out;
  }
  function takeSplits() {
    for (const [flag] of MILESTONES) {
      if (G.flags[flag] && !rd('p7t_sg_' + flag, BIG)) {
        put('p7t_sg_' + flag, Math.floor(T.g) + 1, BIG); put('p7t_sr_' + flag, Math.floor(T.r) + 1, BIG);
      }
    }
  }
  function fmt(ms) {
    ms = Math.max(0, Math.floor(ms)); const s = Math.floor(ms / 1000), t = Math.floor((ms % 1000) / 100);
    const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = s % 60;
    const two = (n) => (n < 10 ? '0' : '') + n;
    return (h ? h + ':' + two(m) : m) + ':' + two(ss) + '.' + t;
  }
  function clocks() { return { game: Math.floor(T.g), real: Math.floor(T.r), late: G.flags && G.flags.p7t_late === 1, ended: G.state === 'ending' }; }

  // ---- the timer readout -----------------------------------------------------------------------
  let timerEl = null, timerAt = 0;
  function timerShown() { return cfg.timer && !!G.player && !photo.on && ['play', 'panel', 'dialogue', 'event', 'dead', 'ending'].includes(G.state); }
  function paintTimer(now) {
    if (!timerEl) return;
    const show = timerShown();
    if (timerEl.hidden === show) timerEl.hidden = !show;
    if (!show || now - timerAt < 100) return;
    timerAt = now;
    const c = clocks(), tag = c.late ? '~' : '';
    const text = 'GAME ' + tag + fmt(c.game) + '\nREAL ' + tag + fmt(c.real) + (c.ended ? '\nENDED' : '');
    if (timerEl.textContent !== text) timerEl.textContent = text;
  }

  // ---- statistics ------------------------------------------------------------------------------
  function famOf(def) {
    if (!def) return 'oth';
    if (def.cacophony) return 'cac';
    if (def.core) return 'bell';
    if (def.quiet) return 'qui';
    if (def.armored) return 'con';
    return 'oth';
  }
  function songKey(id) { return 'p7s_s_' + (SONG_IDS.includes(id) && id !== 'other' ? id : 'other'); }
  function stats() {
    try { flush(true); } catch (e) { /* read what the flags hold */ }   // bring the in-memory distance and clocks into the flags first
    const p = G.player || {}, crime = (typeof crimeState === 'function' && G.player) ? crimeState() : {};
    const num = (v) => (Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
    const fam = {}; for (const [k] of FAMILIES) fam[k] = rd('p7s_k_' + k);
    const songs = {}; for (const id of SONG_IDS) songs[id] = rd('p7s_s_' + id);
    return {
      kills: num(p.kills), killsByFamily: fam, songs,
      walked: rd('p7s_walk') / 10, ridden: rd('p7s_ride') / 10,
      gameMs: Math.floor(T.g), realMs: Math.floor(T.r),
      earned: rd('p7s_gold_in'), spent: rd('p7s_gold_out'),
      bodies: rd('p7s_body'), rests: rd('p7s_rest'), days: num(G.day),
      names: Array.isArray(G.ledger) ? G.ledger.length : 0,
      bounty: num(crime.bounty), thefts: num(crime.thefts), assaults: num(crime.assaults), jailHours: num(crime.jailHours),
      splits: splits(), late: !!(G.flags && G.flags.p7t_late === 1),
    };
  }

  // ---- photo mode ------------------------------------------------------------------------------
  const DOLLY = 3.2;          // how far the camera may stray from where you stood
  const PITCH = 40;           // the game's own look limit
  function photoCanEnter() { return !!G.player && !G.dead && G.state === 'play' && !G.openPanel && !photo.on; }
  function walkable(x, y) {
    const m = G.map; if (!m) return false;
    for (const [dx, dy] of [[0, 0], [0.22, 0], [-0.22, 0], [0, 0.22], [0, -0.22]]) {
      const cx = Math.floor(x + dx), cy = Math.floor(y + dy);
      if (cx < 0 || cy < 0 || cx >= m.w || cy >= m.h || m.isBlocked(cx, cy)) return false;
    }
    for (const e of G.ents) if (e.solid && !e.dead && !e.hidden && (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y) < 0.2) return false;
    return true;
  }
  function photoMove(fwd, str) {
    const c = Engine.cam, o = photo.origin; if (!o || (!fwd && !str)) return false;
    const cs = Math.cos(c.dir), sn = Math.sin(c.dir);
    let nx = c.x + cs * fwd - sn * str, ny = c.y + sn * fwd + cs * str;
    const d = Math.hypot(nx - o.x, ny - o.y);
    if (d > DOLLY) { nx = o.x + (nx - o.x) * DOLLY / d; ny = o.y + (ny - o.y) * DOLLY / d; }
    let moved = false;
    if (walkable(nx, ny)) { c.x = nx; c.y = ny; moved = true; }
    else if (walkable(nx, c.y)) { c.x = nx; moved = true; }   // slide along a wall
    else if (walkable(c.x, ny)) { c.y = ny; moved = true; }
    return moved;
  }
  function photoLook(dd, dp) { const c = Engine.cam; c.dir += dd; c.pitch = clamp(c.pitch + dp, -PITCH, PITCH); }
  function setTilt(deg) { photo.tilt = clamp(Math.round(deg), -20, 20); setStatus(); }

  function photoEnter() {
    if (!photoCanEnter()) return false;
    const c = Engine.cam;
    photo.saved = { x: c.x, y: c.y, z: c.z, dir: c.dir, pitch: c.pitch, bob: c.bob };
    photo.origin = { x: c.x, y: c.y }; photo.tilt = 0; photo.prev = G.state; photo.drag = null;
    G.keys = {}; G.state = 'photo'; photo.on = true;
    try { releaseMouse(); } catch (e) { /* not locked */ }
    const game = document.getElementById('game'); if (game) game.classList.add('p7-photo');
    ensureBar(); photo.bar.hidden = !cfg.photoBar; setStatus();
    return true;
  }
  function photoExit() {
    if (!photo.on) return false;
    const c = Engine.cam, s = photo.saved;
    if (s) { c.x = s.x; c.y = s.y; c.z = s.z; c.dir = s.dir; c.pitch = s.pitch; c.bob = s.bob; }
    photo.on = false; photo.saved = null; photo.shot = null;
    G.state = photo.prev || 'play'; G.keys = {};
    const game = document.getElementById('game'); if (game) game.classList.remove('p7-photo');
    if (photo.bar) photo.bar.hidden = true;
    flush(true);
    return true;
  }

  // one clean frame: the 3D view with no HUD, copied out at the current render scale
  function cleanFrame() {
    const S = Engine.getScale(), w = Engine.VW * S, h = Engine.VIEW_H * S;
    if (typeof ANIM !== 'undefined') ANIM.dt = 0;   // particles stand still while the world is held
    Engine.render(G.ents, G.tod);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(Engine.canvas, 0, 0, w, h, 0, 0, w, h);
    return cv;
  }
  // apply the tilt: a rotated copy scaled just enough that no corner shows
  function tilted(src, deg) {
    if (!deg) return src;
    const w = src.width, h = src.height, th = deg * Math.PI / 180;
    const k = Math.abs(Math.cos(th)) + (w / h) * Math.abs(Math.sin(th));
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    const x = out.getContext('2d'); x.imageSmoothingEnabled = false;
    x.translate(w / 2, h / 2); x.rotate(th); x.scale(k, k); x.drawImage(src, -w / 2, -h / 2);
    return out;
  }
  // the held picture, centred in the full canvas with plain bars where the HUD used to be
  function paintPhoto() {
    const ctx = Engine.ctx, S = Engine.getScale();
    const shot = tilted(cleanFrame(), photo.tilt); photo.shot = shot;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, Engine.VW * S, Engine.VH * S);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(shot, 0, ((Engine.VH - Engine.VIEW_H) / 2) * S);
    ctx.restore();
  }
  function toBlob(cv) { return new Promise((res) => { try { cv.toBlob((b) => res(b || null), 'image/png'); } catch (e) { res(null); } }); }
  function download(blob) {
    const a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = 'octave-' + String(G.mapId || 'world').replace(/[^a-z0-9_-]/gi, '') + '-' + (++photo.saves) + '.png';
    a.rel = 'noopener'; a.hidden = true; document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
  }
  // Save picture. double=true re-renders once at 2x (the engine canvas is resized and put back).
  async function savePicture(double) {
    if (!photo.on) return null;
    const was = Engine.getScale();
    let cv;
    try {
      if (double && was !== 2) {
        Engine.setScale(2);
        try { cv = tilted(cleanFrame(), photo.tilt); } finally { Engine.setScale(was); }
        paintPhoto();
      } else { cv = tilted(cleanFrame(), photo.tilt); paintPhoto(); }
    } catch (e) { console.warn('playtools: picture failed', e); return null; }
    const blob = await toBlob(cv);
    if (!blob) { setStatus('The picture could not be saved.'); return null; }
    photo.lastBlob = blob; download(blob);
    setStatus('Picture saved (' + cv.width + ' x ' + cv.height + ').');
    return blob;
  }

  function setStatus(text) {
    if (!photo.status) return;
    photo.status.textContent = text || ('Tilt ' + photo.tilt + '° · Drag or arrows look · W A S D or wheel move a little · Q E tilt · Enter saves · Esc leaves');
  }
  function ensureBar() {
    if (photo.bar) return;
    const game = document.getElementById('game'); if (!game) return;
    const bar = document.createElement('div'); bar.id = 'p7-photo-bar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Photo mode');
    const st = document.createElement('div'); st.className = 'p7-status'; st.setAttribute('role', 'status'); st.setAttribute('aria-live', 'polite');
    const row = document.createElement('div'); row.className = 'p7-row';
    const mk = (id, label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'dfbtn small'; b.id = id; b.textContent = label; b.onclick = (ev) => { ev.stopPropagation(); fn(); }; return b; };
    row.append(
      mk('p7-save', 'Save picture', () => { savePicture(false); }),
      mk('p7-save2', 'Save 2x', () => { savePicture(true); }),
      mk('p7-tl', 'Tilt −', () => setTilt(photo.tilt - 2)),
      mk('p7-tr', 'Tilt +', () => setTilt(photo.tilt + 2)),
      mk('p7-reset', 'Reset view', () => { const s = photo.saved, c = Engine.cam; if (s) { c.x = s.x; c.y = s.y; c.dir = s.dir; c.pitch = s.pitch; } setTilt(0); }),
      mk('p7-exit', 'Leave', () => photoExit()));
    bar.append(st, row); game.appendChild(bar); photo.bar = bar; photo.status = st;
  }
  // 2x only makes sense when the game is not already rendering at 2x
  function syncBar() { const b = document.getElementById('p7-save2'); if (b) b.hidden = Engine.getScale() === 2; }

  // held keys and the pad drive the free camera; called from the update wrapper with the real dt
  function photoStep(dt) {
    const k = G.keys || {};
    let fwd = 0, str = 0, yaw = 0, pit = 0;
    if (k.w) fwd += 1; if (k.s) fwd -= 1; if (k.d) str += 1; if (k.a) str -= 1;
    if (k.arrowleft) yaw -= 1; if (k.arrowright) yaw += 1; if (k.arrowup) pit += 1; if (k.arrowdown) pit -= 1;
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const pad of pads) {
        if (!pad) continue;
        const dz = (v) => (Math.abs(v) < 0.2 ? 0 : v);
        str += dz(pad.axes[0] || 0); fwd -= dz(pad.axes[1] || 0); yaw += dz(pad.axes[2] || 0); pit -= dz(pad.axes[3] || 0);
        const down = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
        if (down(1) && !photo.padB) { photo.padB = true; photoExit(); return; }
        if (!down(1)) photo.padB = false;
        if (down(0) && !photo.padA) { photo.padA = true; savePicture(false); }
        if (!down(0)) photo.padA = false;
      }
    } catch (e) { /* no gamepad API */ }
    if (k.q) setTilt(photo.tilt - 20 * dt); if (k.e) setTilt(photo.tilt + 20 * dt);
    if (yaw || pit) photoLook(yaw * 1.4 * dt, pit * 30 * dt);
    if (fwd || str) photoMove(clamp(fwd, -1, 1) * 1.6 * dt, clamp(str, -1, 1) * 1.6 * dt);
  }

  function onKeyDown(ev) {
    try {
      if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const isKey = ev.code === 'Backslash' || ev.key === '\\';
      if (!photo.on) {
        if (isKey && !ev.repeat && photoCanEnter()) { ev.preventDefault(); photoEnter(); }
        return;
      }
      const k = (ev.key || '').toLowerCase();
      if (k === 'escape' || isKey) { ev.preventDefault(); ev.stopPropagation(); if (!ev.repeat) photoExit(); }
      else if (k === 'enter') { ev.preventDefault(); ev.stopPropagation(); if (!ev.repeat) savePicture(ev.shiftKey); }
      else if (k === 'h') { ev.stopPropagation(); if (!ev.repeat && photo.bar) { cfg.photoBar = !cfg.photoBar; photo.bar.hidden = !cfg.photoBar; } }
      else if (k === 'z' || k === 'home') { if (!ev.repeat) { const s = photo.saved, c = Engine.cam; if (s) { c.x = s.x; c.y = s.y; c.dir = s.dir; c.pitch = s.pitch; } setTilt(0); } }
      else if (k === ' ' || k === 'tab') ev.preventDefault();
    } catch (e) { console.warn('playtools key', e); }
  }
  function onPointer(ev) {
    if (!photo.on) return;
    const cv = Engine.canvas;
    if (ev.type === 'pointerdown') { if (ev.target !== cv) return; photo.drag = { x: ev.clientX, y: ev.clientY }; try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ } }
    else if (ev.type === 'pointermove' && photo.drag) {
      const r = cv.getBoundingClientRect(), dx = (ev.clientX - photo.drag.x) / Math.max(1, r.width), dy = (ev.clientY - photo.drag.y) / Math.max(1, r.height);
      photo.drag = { x: ev.clientX, y: ev.clientY }; photoLook(dx * 2.2, -dy * 70);
    } else if (ev.type === 'pointerup' || ev.type === 'pointercancel') photo.drag = null;
  }
  function onWheel(ev) { if (photo.on && ev.target === Engine.canvas) { ev.preventDefault(); photoMove(-Math.sign(ev.deltaY) * 0.25, 0); } }

  // ---- stats: the Statistics panel ---------------------------------------------------------------
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const n0 = (v) => Math.floor(v).toLocaleString('en-GB');
  function renderStats() {
    const s = stats();
    G.state = 'panel';
    openModal('<h2>Statistics</h2><button class="dfbtn small close" id="x">Close</button><div id="p7-stats" class="p7-stats"></div><div class="btns"><button class="dfbtn small" id="p7-stats-back">Back to Options</button></div>', 'stats');
    const root = document.getElementById('p7-stats');
    const col = (title, rows) => {
      const c = el('div', 'p7-col'); c.appendChild(el('h3', null, title));
      for (const [k, v] of rows) { const r = el('div', 'p7-srow'); r.appendChild(el('span', null, k)); r.appendChild(el('b', null, v)); c.appendChild(r); }
      return c;
    };
    const a = el('div', 'p7-cell');
    a.appendChild(col('Journey', [
      ['Days passed', n0(s.days)], ['Play time', fmt(s.gameMs)], ['Walked', n0(s.walked) + ' paces'], ['Ridden', n0(s.ridden) + ' paces'],
      ['Rests taken', n0(s.rests)], ['Bodies found', n0(s.bodies)], ['Sovereigns earned', n0(s.earned)], ['Sovereigns spent', n0(s.spent)],
    ]));
    const k = FAMILIES.map(([id, label]) => [label, n0(s.killsByFamily[id])]);
    a.appendChild(col('Kills (' + n0(s.kills) + ' in all)', k));
    const b = el('div', 'p7-cell');
    const songNames = { murmur: 'Murmur', tending: 'Tending Note', fifth: 'Falling Fifth', root: 'Root Note', name: 'Read the Name', other: 'Your own Songs' };
    b.appendChild(col('Songs cast', SONG_IDS.filter((id) => id !== 'other' || s.songs.other > 0).map((id) => [songNames[id], n0(s.songs[id])])));
    const clk = [['Real time', (s.late ? '~' : '') + fmt(s.realMs)]];
    for (const sp of s.splits) clk.push([sp.label, fmt(sp.game)]);
    if (!s.splits.length) clk.push(['No splits yet', '\u2014']);
    const rc = col('Run clock', clk); rc.title = POLICY; b.appendChild(rc);
    root.append(a, b);
    document.getElementById('x').onclick = () => { closeModal(); G.state = 'play'; };
    document.getElementById('p7-stats-back').onclick = () => renderAccessibilityMenu();
  }

  // ---- Options rows --------------------------------------------------------------------------------
  function appendRows() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById('p7-head')) return;
    const head = el('span', null, 'Play tools'); head.id = 'p7-head';
    head.style.cssText = 'grid-column:1/-1;margin-top:1cqh;color:var(--gold);font-family:var(--font-display);letter-spacing:.08em';
    grid.appendChild(head);
    const label = (t, hint) => { const s = el('span', 'gfx-label', t + ' '); s.appendChild(el('small', 'muted', hint)); return s; };
    const btn = (id, text, fn) => { const b = el('button', 'dfbtn small', text); b.id = id; b.type = 'button'; b.onclick = fn; return b; };
    grid.appendChild(label('Photo mode', 'hides the interface and pauses the world; key \\ (backslash)'));
    grid.appendChild(btn('p7-photo-open', 'Enter', () => { closeModal(); G.state = 'play'; photoEnter(); }));
    const tm = btn('p7-timer-opt', cfg.timer ? 'On' : 'Off', () => {
      cfg.timer = !cfg.timer; saveCfg(); tm.textContent = cfg.timer ? 'On' : 'Off';
      tm.setAttribute('aria-pressed', cfg.timer ? 'true' : 'false'); tm.classList.toggle('sel', cfg.timer);
    });
    tm.setAttribute('aria-pressed', cfg.timer ? 'true' : 'false'); tm.classList.toggle('sel', cfg.timer);
    const tl = label('Speedrun timer', 'real time always runs; game time skips panels, dialogue, photo, death and endings'); tl.title = POLICY;
    tm.title = POLICY;
    grid.appendChild(tl); grid.appendChild(tm);
    grid.appendChild(label('Statistics', 'kills, paces, Songs, sovereigns, rests, run clock'));
    grid.appendChild(btn('p7-stats-open', 'Open', () => renderStats()));
  }

  // ---- style ---------------------------------------------------------------------------------------
  function injectStyle() {
    if (document.getElementById('playtools-style')) return;
    const st = document.createElement('style'); st.id = 'playtools-style';
    st.textContent = `
#game.p7-photo #fx, #game.p7-photo #msgs, #game.p7-photo #hint, #game.p7-photo #cover-status, #game.p7-photo #lockhint,
#game.p7-photo #t-stick, #game.p7-photo #touchui, #game.p7-photo #debug, #game.p7-photo #p7-timer { visibility: hidden !important; }
#game.p7-photo #view { cursor: grab; touch-action: none; }
#p7-timer { position: absolute; right: 1.2cqw; top: 1cqh; z-index: 5; white-space: pre; text-align: right; pointer-events: none; font-family: var(--font-sc); font-size: 2cqw; line-height: 1.2; color: var(--gold); text-shadow: 0 0 3px #000, 1px 1px 0 #000, -1px 0 0 #000; font-variant-numeric: tabular-nums; }
#p7-photo-bar { position: absolute; left: 50%; bottom: 1.2cqh; transform: translateX(-50%); z-index: 6; width: 94cqw; max-width: 94cqw; display: flex; flex-direction: column; align-items: center; gap: .6cqh; background: rgba(12,9,6,.72); border: 1px solid var(--edge-d); padding: .8cqh 1cqw; }
#p7-photo-bar[hidden] { display: none; }
#p7-photo-bar .p7-status { font-family: var(--font-body); font-size: 1.8cqw; color: var(--parch); text-align: center; line-height: 1.25; }
#p7-photo-bar .p7-row { display: flex; flex-wrap: wrap; justify-content: center; gap: .6cqw; }
#p7-photo-bar .dfbtn[hidden] { display: none; }
.p7-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0 2.4cqw; max-height: 68cqh; overflow-y: auto; overflow-x: hidden; margin: 1cqh 0; }
.p7-stats h3 { margin: .8cqh 0 .3cqh; font-family: var(--font-display); font-size: 2cqw; letter-spacing: .06em; color: var(--gold); font-weight: 600; }
.p7-srow { display: flex; justify-content: space-between; gap: 1.4cqw; font-size: 1.8cqw; line-height: 1.18; border-bottom: 1px dotted rgba(217,164,65,.18); min-width: 0; }
.p7-srow span { min-width: 0; overflow-wrap: anywhere; }
.p7-srow b { font-weight: 600; color: var(--parch); font-variant-numeric: tabular-nums; white-space: nowrap; }
.p7-note { grid-column: 1 / -1; font-size: 1.5cqw; margin: .6cqh 0 0; }
`;
    document.head.appendChild(st);
  }
  function ensureTimerEl() {
    if (timerEl) return;
    const game = document.getElementById('game'); if (!game) return;
    timerEl = document.createElement('div'); timerEl.id = 'p7-timer'; timerEl.hidden = true;
    timerEl.setAttribute('role', 'timer'); timerEl.setAttribute('aria-label', 'Speedrun timer'); game.appendChild(timerEl);
  }

  // ---- per-tick bookkeeping (after the real update) ---------------------------------------------------
  function afterTick(dt, wasPlaying) {
    if (!G.player || !G.map) return;
    if (!ensureRun()) return;
    const now = performance.now();
    const realMs = T.lastReal == null ? 0 : Math.min(1000, Math.max(0, now - T.lastReal)); T.lastReal = now;
    advance(wasPlaying ? dt * 1000 : 0, realMs, wasPlaying, LIVE_STATES.includes(G.state) || wasPlaying);
    const c = Engine.cam, playingNow = G.state === 'play' && wasPlaying;
    // distance: only small steps on one map count, so doors, loads and fast travel add nothing
    const here = { x: c.x, y: c.y, map: G.mapId };
    if (playingNow && T.pos && T.pos.map === here.map) {
      const d = Math.hypot(here.x - T.pos.x, here.y - T.pos.y);
      if (d > 0 && d < 0.6) { const ride = typeof horseActive === 'function' && horseActive(); if (ride) T.ride = clamp(T.ride + d * 10, 0, MAXC); else T.walk = clamp(T.walk + d * 10, 0, MAXC); }
    }
    T.pos = here;
    // sovereigns: watched every tick, panels included, because shops and fines happen in panels
    const gold = G.player.gold;
    if (Number.isFinite(gold)) {
      if (T.gold != null && gold !== T.gold) { if (gold > T.gold) inc('p7s_gold_in', gold - T.gold); else inc('p7s_gold_out', T.gold - gold); }
      T.gold = gold;
    }
    // bodies the patrols have found (once per body)
    if (playingNow) for (const e of G.ents) if (e.corpse && e.bodyFound && !T.bodies.has(e)) { T.bodies.add(e); inc('p7s_body'); }
    takeSplits();
    if (now - T.lastFlush > 1000) { T.lastFlush = now; flush(); }
    paintTimer(now);
  }

  // ---- wiring ---------------------------------------------------------------------------------------
  function wire() {
    if (typeof update === 'function') {
      const _update = update;
      update = function (dt) {
        if (photo.on) {
          // held: nothing in the world advances. Only the free camera and the real-time clock move.
          try { photoStep(dt); advance(0, Math.min(1000, T.lastReal == null ? 0 : performance.now() - T.lastReal), false, true); T.lastReal = performance.now(); paintTimer(T.lastReal); } catch (e) { console.warn('playtools photo', e); }
          return;
        }
        const wasPlaying = G.state === 'play' && !G.dead;
        const r = _update.apply(this, arguments);
        try { afterTick(dt, wasPlaying); } catch (e) { console.warn('playtools tick', e); }
        return r;
      };
    }
    if (typeof render === 'function') {
      const _render = render;
      render = function () {
        if (!photo.on) return _render.apply(this, arguments);
        if (!G.map) return;
        try { syncBar(); paintPhoto(); } catch (e) { console.warn('playtools photo render', e); }
      };
    }
    if (typeof startGame === 'function') {
      const _start = startGame;
      startGame = function () {
        if (photo.on) photoExit();
        const r = _start.apply(this, arguments);
        try { if (G.flags) { G.flags.p7t_on = 1; syncFromFlags(); T.g = 0; T.r = 0; } } catch (e) { console.warn('playtools start', e); }
        return r;
      };
    }
    if (typeof restoreGame === 'function') {
      const _restore = restoreGame;
      restoreGame = function () {
        if (photo.on) photoExit();
        const r = _restore.apply(this, arguments);
        try { syncFromFlags(); ensureRun(); } catch (e) { console.warn('playtools restore', e); }
        return r;
      };
    }
    if (typeof snapshotGame === 'function') {
      const _snap = snapshotGame;
      snapshotGame = function () { try { flush(); } catch (e) { /* never block a save */ } return _snap.apply(this, arguments); };
    }
    if (typeof killEnemy === 'function') {
      const _kill = killEnemy;
      killEnemy = function (e) {
        const was = !!(e && e.dead), r = _kill.apply(this, arguments);
        try { if (e && !was && e.dead && G.flags) inc('p7s_k_' + famOf(e.def)); } catch (err) { /* counters never break a kill */ }
        return r;
      };
    }
    if (typeof castSong === 'function') {
      const _cast = castSong;
      castSong = function (id) {
        const t0 = G.song ? G.song.t : 0, m0 = G.murmurT || 0;
        const r = _cast.apply(this, arguments);
        try {
          const ok = id === 'murmur' ? (G.murmurT || 0) > m0 : (G.song && G.song.t > 0 && t0 <= 0);
          if (ok && G.flags && typeof SONGS === 'object' && SONGS[id]) inc(songKey(id));
        } catch (err) { /* ignore */ }
        return r;
      };
    }
    if (typeof doRest === 'function') {
      const _rest = doRest;
      doRest = function () { const r = _rest.apply(this, arguments); try { inc('p7s_rest'); } catch (e) { /* ignore */ } return r; };
    }
    if (typeof renderAccessibilityMenu === 'function') {
      const _acc = renderAccessibilityMenu;
      renderAccessibilityMenu = function () {
        const r = _acc.apply(this, arguments);
        try { appendRows(); } catch (e) { console.warn('playtools rows failed', e); }
        return r;
      };
    }
    window.addEventListener('keydown', onKeyDown, true);
    for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) window.addEventListener(t, onPointer, true);
    window.addEventListener('wheel', onWheel, { passive: false });
  }

  loadCfg();
  injectStyle();
  ensureTimerEl();
  wire();
  return {
    cfg, POLICY, MILESTONES, FAMILIES, SONG_IDS, photo,
    enter: photoEnter, leave: photoExit, canEnter: photoCanEnter, save: savePicture, move: photoMove, look: photoLook, setTilt, paintPhoto, cleanFrame,
    timer: { advance, clocks, splits, fmt, flush, syncFromFlags, ensureRun, get el() { return timerEl; }, paint: paintTimer, setOn(v) { cfg.timer = !!v; saveCfg(); } },
    stats, famOf, songKey, renderStats, appendRows, rd, inc,
  };
})();
if (typeof window !== 'undefined') window.PLAYTOOLS = PLAYTOOLS;
