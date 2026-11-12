// ============================================================
//  windbells — Phase 4 (living world): wind-driven signs and banners, area-specific
//  falling leaves, and bells that swing in time with every strike.
//
//  Nothing here moves an entity, changes a cell, a flag or a timer: it reads
//  Weather.wind / the camera and then sets anim* fields (and animSprite) AFTER
//  anim.js has run, or draws screen-space particles. Switches (all default on,
//  all pure visual, registered in GFX.FX so GFX.plain() turns them off):
//    GFX.windSigns   outdoor signs sway with the wind; procedural Synod banners and
//                    gate pennants ripple with it
//    GFX.leaves      area-specific leaves / fluff / motes carried by the wind
//    GFX.bellSwing   the Belfry bell (and the arena and alarm-trap bells) swing on each strike
//  With a switch off the original code path runs untouched (banners are taken out of
//  the entity list, so the frames and G.ents match a build without this module).
//  Reduced motion (GFX.reduceMotion / reducedMotion): signs and cloth hang almost still,
//  leaves fall straight and slow in smaller numbers, bells swing a little and settle fast.
//
//  ART IS STAND-IN: banner, pennant and swung-bell frames are painted / cut procedurally
//  from the existing sprites; final painted frames can replace them without changing this
//  contract. Banners and pennants are transient, non-solid, unpickable decos appended
//  after the builds (same pattern as scenery.js), so saves and entity indexes never shift.
//
//  The Chapel of the Carillon gets no visible bell on purpose: its four bells were "taken
//  for bore-teeth, 417 SR" (the frame's chalk, data.js townsfolk), no flag ever puts one
//  back, and the town's whole mood is that nobody has rung a bell since.
// ============================================================
'use strict';

for (const k of ['windSigns', 'leaves', 'bellSwing']) {
  if (GFX[k] === undefined) GFX[k] = true;
  if (!GFX.FX.includes(k)) GFX.FX.push(k);
}

const WINDBELLS = (() => {
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
  const reduced = () => !!GFX.reduceMotion;
  const stats = { frames: 0, strikes: 0 };
  let clock = 0, lastNow = null, held = false;

  // ---------------------------------------------------------------- wind
  // One wind for the whole world: strength from Weather (0..~1.08) with slow gusts,
  // heading drifting slowly, then projected onto the camera so "right" is screen-right.
  const W = { s: 0, gust: 1, ang: 0.6, comp: 0, fwd: 0, g: 1 };
  function updateWind() {
    const T = clock;
    const base = typeof Weather !== 'undefined' && Number.isFinite(Weather.wind) ? clamp(Weather.wind, 0, 1.1) : 0.15;
    const pulse = Math.pow(Math.max(0, Math.sin(T * 0.19 + 2 * Math.sin(T * 0.05))), 3);
    W.gust = 0.82 + 0.18 * Math.sin(T * 0.37) + pulse * (0.15 + 0.35 * base);
    W.s = base;
    W.ang = 0.6 + 0.45 * Math.sin(T * 0.021) + 0.15 * Math.sin(T * 0.073);
    const d = typeof Engine !== 'undefined' && Engine.cam ? Engine.cam.dir : 0;
    const wx = Math.cos(W.ang), wy = Math.sin(W.ang);
    W.comp = wx * -Math.sin(d) + wy * Math.cos(d);        // across the view (+ = towards screen right, as flora.js)
    W.fwd = wx * Math.cos(d) + wy * Math.sin(d);          // along the view direction
    W.g = base * W.gust;
  }
  // wind felt at a spot: the gust front travels, so neighbours are slightly out of step
  const gustAt = (x, y) => W.g * (0.88 + 0.12 * Math.sin(clock * 0.6 + x * 0.3 + y * 0.21));

  // ---------------------------------------------------------------- hanging signs
  // 'sign' decos are in ANIM.hanging and sway on a constant sine. Outdoors, with the
  // switch on, they sway with the wind: almost still when calm, hard and fast in a gale,
  // leaning away from the wind. Indoor signs are letters and inscriptions: left alone.
  const READING_SIGNS = new Set(['reg_sign', 'wick_letter', 'maus_inscription', 'tanner_key', 'prison_bunk']);
  const cacheSigns = { ents: null, n: -1, list: [] };
  function signsOf(ents) {
    if (cacheSigns.ents === ents && cacheSigns.n === ents.length) return cacheSigns.list;
    cacheSigns.ents = ents; cacheSigns.n = ents.length; cacheSigns.list = [];
    for (const e of ents) if (e.kind === 'deco' && e.sprite === 'sign' && !READING_SIGNS.has(e.use)) cacheSigns.list.push(e);
    return cacheSigns.list;
  }
  function signSkew(e) {
    const s = e._wbSeed != null ? e._wbSeed : (e._wbSeed = (Math.round(e.x * 7.31 + e.y * 13.7) % 97) * 0.37);
    const g = gustAt(e.x, e.y), w = W.s;
    if (reduced()) return 0.003 * Math.sin(clock * 0.7 + s) + 0.004 * W.comp * w;
    const amp = 0.006 + 0.058 * Math.pow(Math.min(1.2, g), 1.3);
    const f = 1.1 + 1.7 * Math.min(1, g);
    const lean = 0.05 * Math.min(1, g) * W.comp;
    return lean + amp * (0.72 * Math.sin(clock * f + s) + 0.28 * Math.sin(clock * f * 2.3 + s * 1.9));
  }

  // ---------------------------------------------------------------- banners and pennants
  const BANNER_LEVELS = 4, BANNER_PHASES = 8;
  const bannerFrames = [], pennantFrames = [];
  let artReady = false;
  function hash2(x, y) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  // hard alpha, a little pixel noise and a dark outline, to sit with the painted art
  function finish(cv, w, h) {
    const c = cv.getContext('2d', { willReadFrequently: true });
    const id = c.getImageData(0, 0, w, h), u8 = id.data, out = new Uint8ClampedArray(u8.length);
    const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && u8[(y * w + x) * 4 + 3] >= 100;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (solid(x, y)) {
        const k = 1 + (hash2(x, y) - 0.5) * 0.14;
        out[o] = Math.min(255, u8[o] * k); out[o + 1] = Math.min(255, u8[o + 1] * k); out[o + 2] = Math.min(255, u8[o + 2] * k); out[o + 3] = 255;
      } else if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) { out[o] = 22; out[o + 1] = 18; out[o + 2] = 14; out[o + 3] = 255; }
    }
    return new Uint32Array(out.buffer);
  }
  function newCanvas(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
  // Synod standard: iron-grey cloth on a crossbar, a bronze trim and a single bronze tine ("One Note").
  function paintBanner(level, phase) {
    const w = 28, h = 62, cv = newCanvas(w, h), c = cv.getContext('2d');
    const lean = [0, 1.2, 2.6, 4.2][level], amp = [0.15, 0.7, 1.4, 2.2][level], ph = phase / BANNER_PHASES * TAU;
    c.fillStyle = '#3b2c1c'; c.fillRect(13, 3, 2, h - 3);                          // pole
    c.fillStyle = '#9a7a3a'; c.fillRect(12, 1, 4, 3);                              // finial
    c.fillStyle = '#4c3a24'; c.fillRect(3, 5, 22, 2);                              // crossbar
    const top = 7, bot = 46;
    for (let y = top; y <= bot; y++) {
      const t = (y - top) / (bot - top), off = lean * Math.pow(t, 1.1) + amp * Math.sin(ph - t * 5.2) * Math.pow(t, 1.15);
      let x0 = 5 + off, x1 = 23 + off;
      if (y > bot - 6) { const notch = (y - (bot - 6)) / 6; const mid = 14 + off; c.fillStyle = '#343b49'; c.fillRect(x0, y, mid - x0 - notch * 4, 1); c.fillRect(mid + notch * 4, y, x1 - mid - notch * 4, 1); continue; }
      const shade = 0.88 + 0.12 * Math.sin(ph - t * 5.2 + 1.2) * (level ? 1 : 0);     // folds catch the light
      c.fillStyle = `rgb(${(58 * shade) | 0},${(66 * shade) | 0},${(80 * shade) | 0})`; c.fillRect(x0, y, x1 - x0, 1);
      if (y <= top + 2 || (y >= bot - 13 && y <= bot - 11)) { c.fillStyle = '#8a6a30'; c.fillRect(x0, y, x1 - x0, 1); }   // trim
      if (y >= top + 8 && y <= bot - 17) { c.fillStyle = '#b08a3c'; c.fillRect(13 + off - 0.5, y, 2, 1); }                // the tine
      if (y === top + 8 || y === top + 9) { c.fillStyle = '#b08a3c'; c.fillRect(10 + off, y, 8, 1); }
    }
    return { w, h, data: finish(cv, w, h), hs: 1, cx: 0.5, dy: 0 };
  }
  // Pennant on a tall pole: the streamer lifts from drooping to flying as the wind rises.
  function paintPennant(level, phase) {
    const w = 38, h = 66, cv = newCanvas(w, h), c = cv.getContext('2d');
    const droop = -1.25 * (1 - level / (BANNER_LEVELS - 1)), amp = [0.04, 0.12, 0.22, 0.3][level], ph = phase / BANNER_PHASES * TAU;
    c.fillStyle = '#3b2c1c'; c.fillRect(3, 3, 2, h - 3);
    c.fillStyle = '#9a7a3a'; c.fillRect(2, 1, 4, 3);
    let x = 5, y = 7;
    for (let s = 0; s < 30; s += 0.5) {
      const th = droop + amp * Math.sin(ph - s * 0.3) * (s / 30);
      x += Math.cos(th) * 0.5; y -= Math.sin(th) * 0.5;
      const r = Math.max(0.6, 4.6 * (1 - s / 31));
      c.fillStyle = s < 6 ? '#8a6a30' : '#3e4756';
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
    return { w, h, data: finish(cv, w, h), hs: 1, cx: 0.1, dy: 0 };
  }
  function buildArt() {
    if (artReady || typeof Engine === 'undefined' || !Engine.addSprite) return;
    for (let l = 0; l < BANNER_LEVELS; l++) for (let p = 0; p < BANNER_PHASES; p++) {
      const b = paintBanner(l, p), q = paintPennant(l, p);
      Engine.addSprite('wb_banner~' + l + '_' + p, b); Engine.addSprite('wb_pennant~' + l + '_' + p, q);
      bannerFrames.push('wb_banner~' + l + '_' + p); pennantFrames.push('wb_pennant~' + l + '_' + p);
    }
    Engine.addSprite('wb_banner', Engine.sprites['wb_banner~0_0']); Engine.addSprite('wb_pennant', Engine.sprites['wb_pennant~0_0']);
    artReady = true;
  }

  // Placement: beside doors and the gate, never on a door line, a road centre or another prop.
  // Each spec tries a few candidate spots in order; a spot must be a free, open, dry cell.
  const BANNER_SPECS = {
    oakhaven: [
      { sprite: 'wb_banner', scale: 0.62, spots: [[28.35, 9.45], [27.6, 9.45]], label: 'Greenhall' },
      { sprite: 'wb_banner', scale: 0.62, spots: [[32.0, 9.45], [32.8, 9.45]], label: 'Greenhall' },
      { sprite: 'wb_banner', scale: 0.62, spots: [[39.5, 4.6], [39.5, 3.7]], label: 'Watch-house' },
      { sprite: 'wb_banner', scale: 0.62, spots: [[39.5, 9.7], [38.7, 9.7]], label: 'Watch-house' },
      { sprite: 'wb_pennant', scale: 0.8, spots: [[21.4, 3.2], [21.4, 4.4]], label: 'North Gate' },
      { sprite: 'wb_pennant', scale: 0.8, spots: [[25.6, 2.7], [26.2, 3.4]], label: 'North Gate' },
    ],
  };
  function spotOk(m, x, y) {
    const cx = x | 0, cy = y | 0;
    if (cx < 1 || cy < 1 || cx >= m.w - 1 || cy >= m.h - 1) return false;
    if (m.get(cx, cy) || m.isBlocked(cx, cy)) return false;
    for (const e of m.entities) if (!e._flora && (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y) < 0.8) return false;
    if (m.doors) for (const k in m.doors) { const dx = (k % m.w) + 0.5 - x, dy = ((k / m.w) | 0) + 0.5 - y; if (dx * dx + dy * dy < 1.0) return false; }
    return true;
  }
  function placeMap(m, id) {
    const specs = BANNER_SPECS[id || m.id];
    if (!specs || m._wbBanners) return;
    m._wbBanners = [];
    for (const sp of specs) {
      const at = sp.spots.find(([x, y]) => spotOk(m, x, y));
      if (!at) continue;
      const e = { kind: 'deco', sprite: sp.sprite, x: at[0], y: at[1], scale: sp.scale, solid: false, radius: 0.1, nopick: true, transient: true, _decor: true, _wb: sp.sprite === 'wb_banner' ? 'banner' : 'pennant', _wbAt: sp.label, _wbPh: Math.round(hash2(at[0] * 10, at[1] * 10) * 7.99), _wbS: 0 };
      m._wbBanners.push(e);
      if (GFX.windSigns) m.entities.push(e);
    }
  }
  function placeAll(maps) {
    buildArt();
    for (const id in maps) { try { placeMap(maps[id], id); } catch (err) { console.warn('wind banner placement failed on ' + id, err); } }
    sync(maps);
  }
  // With the switch off the banners are out of the list altogether, like a build without this module.
  function sync(maps) {
    const want = !!GFX.windSigns; api._shown = want;
    const lists = []; if (typeof G !== 'undefined' && G.maps) for (const id in G.maps) lists.push(G.maps[id]); if (maps) for (const id in maps) lists.push(maps[id]);
    for (const m of lists) {
      if (!m._wbBanners || !m._wbBanners.length) continue;
      const mine = new Set(m._wbBanners);
      if (!want) { for (let i = m.entities.length - 1; i >= 0; i--) if (mine.has(m.entities[i])) m.entities.splice(i, 1); for (const e of m._wbBanners) { e.animSprite = null; e.animFlip = false; } }
      else if (typeof G !== 'undefined' && G.map === m) { const have = new Set(m.entities); for (const e of m._wbBanners) if (!have.has(e)) m.entities.push(e); }
    }
  }
  // anim.js sweeps transient entities away on a map change: put this map's banners back
  function ensure(map) {
    if (!map || !map._wbBanners || !map._wbBanners.length || !GFX.windSigns) return;
    const have = new Set(map.entities);
    for (const e of map._wbBanners) if (!have.has(e)) map.entities.push(e);
  }
  function tickBanner(e, dt) {
    if (!artReady) return;
    const g = gustAt(e.x, e.y), calm = reduced();
    // cloth takes a moment to fill and empty: ease towards the wind it feels
    const target = calm ? 0 : clamp(g * (0.55 + 0.45 * Math.abs(W.comp)), 0, 1.2);
    e._wbS += (target - e._wbS) * (dt > 0 ? 1 - Math.exp(-2.2 * dt) : 1);
    const level = clamp(Math.round(e._wbS * 3.2), 0, BANNER_LEVELS - 1);
    const speed = calm ? 0.6 : 1.6 + 6 * e._wbS;
    const phase = ((Math.floor(clock * speed + e._wbPh)) % BANNER_PHASES + BANNER_PHASES) % BANNER_PHASES;
    const frames = e._wb === 'banner' ? bannerFrames : pennantFrames;
    e.animSprite = frames[level * BANNER_PHASES + phase];
    e.animFlip = W.comp < 0;
    // a pennant streaming straight at or away from you is foreshortened
    e.animSX = e._wb === 'pennant' ? 0.4 + 0.6 * Math.abs(W.comp) : 1;
  }
  const cacheBanners = { ents: null, n: -1, list: [] };
  function bannersOf(ents) {
    if (cacheBanners.ents === ents && cacheBanners.n === ents.length) return cacheBanners.list;
    cacheBanners.ents = ents; cacheBanners.n = ents.length; cacheBanners.list = [];
    for (const e of ents) if (e._wb) cacheBanners.list.push(e);
    return cacheBanners.list;
  }

  // ---------------------------------------------------------------- falling leaves
  // Area-specific: oak leaves in autumn colours (Oakhaven, the Clearing), grass seed-fluff in
  // the meadows of the Clearing, willow-yellow strips among the rust leaves in the Deepwoods,
  // spectral motes and ghost-leaves in the Whispergrove. Carried by the wind direction and
  // strength, a leaf that lands lies for a moment before it blows on. Outdoors only.
  const OAK = ['#9a5a22', '#b87a2c', '#7a4a1c', '#c8943a', '#6b4a22', '#8a7a3a'];
  const AREAS = {
    oakhaven: { n: 12, kind: 'leaf', cols: OAK, fluff: 0.12 },
    clearing: { n: 14, kind: 'leaf', cols: OAK, fluff: 0.35 },
    deepwoods: { n: 30, kind: 'leaf', cols: ['#8a4a1c', '#a8642a', '#6b3a18', '#c08a3a', '#7d5a2a'], strip: 0.35, stripCols: ['#a9a04a', '#c0b45a', '#8c8a3c'] },
    whispergrove: { n: 24, kind: 'mote', cols: ['#d8d2e8', '#bfb6d8', '#e8e0f0'], strip: 0.25, stripCols: ['#c8c0e0', '#b0a8d0'] },
  };
  const FLUFF = '#ebe6d6';
  const WEATHER_K = { clear: 1, overcast: 1, rain: 0.7, storm: 1.5, mist: 0.8, snow: 0.25 };
  const MAXP = 90;
  const pool = []; for (let i = 0; i < MAXP; i++) pool.push({ x: 0, y: 0, vx: 0, vy: 0, z: 1, ph: 0, c: '#fff', k: 0, ground: 0, rest: 0, life: 0, on: false });
  let poolMap = null, lastDir = null;
  // k: 0 leaf, 1 strip, 2 fluff, 3 mote, 4 ghost-leaf
  function spawn(p, a, anywhere, horizon) {
    p.z = 0.5 + Math.random() * 0.8; p.ph = Math.random() * TAU; p.rest = 0; p.life = 0; p.on = true;
    const r = Math.random();
    p.k = a.kind === 'mote' ? (r < a.strip ? 4 : 3) : a.fluff && r < a.fluff ? 2 : a.strip && r < a.strip ? 1 : 0;
    p.c = p.k === 2 ? FLUFF : p.k === 1 || p.k === 4 ? a.stripCols[(Math.random() * a.stripCols.length) | 0] : a.cols[(Math.random() * a.cols.length) | 0];
    p.x = Math.random() * 320;
    // nearer (bigger z) leaves land lower in the view
    p.ground = 8 + (p.z - 0.5) / 0.8 * 56;
    const gy = horizon + p.ground;
    if (p.k === 3) { p.y = anywhere ? Math.random() * 150 : 152; p.vy = -(3 + Math.random() * 4); }
    else { p.y = anywhere ? Math.random() * gy : -2; p.vy = (p.k === 2 ? 3.5 : p.k === 4 ? 5 : 9) + Math.random() * (p.k === 2 ? 2.5 : 9); }
    p.vx = -4 + Math.random() * 8;
  }
  function drawLeaves(dt) {
    const a = AREAS[G.mapId];
    // PART_STYLE stays the gate (presets and tests clear it to hold particles still)
    if (!a || typeof PART_STYLE === 'undefined' || !PART_STYLE[G.mapId] || !G.map || !G.map.outdoor || G.state === 'title') return false;
    const ctx = Engine.ctx; if (!ctx) return false;
    const cam = Engine.cam, horizon = (VIEW_H >> 1) + (cam.pitch | 0) + (cam.bob | 0);
    const calm = reduced();
    if (poolMap !== G.mapId) { poolMap = G.mapId; for (const p of pool) p.on = false; lastDir = null; }
    let dd = lastDir == null ? 0 : cam.dir - lastDir; lastDir = cam.dir;
    if (dd > Math.PI) dd -= TAU; if (dd < -Math.PI) dd += TAU;
    const shift = -dd * 255;
    const wk = (WEATHER_K[typeof Weather !== 'undefined' ? Weather.state : 'clear'] || 1);
    const want = Math.min(MAXP, Math.round(a.n * (0.8 + 0.6 * W.s) * wk * Math.max(0, GFX.particles) * (calm ? 0.5 : 1)));
    const gust = W.g, ws = calm ? 0.2 : 1;
    for (let i = 0; i < MAXP; i++) {
      const p = pool[i];
      if (i >= want) { p.on = false; continue; }
      if (!p.on) spawn(p, a, true, horizon);
      p.ph += dt * (p.k === 0 || p.k === 1 ? 3 : 1.2) * (calm ? 0.3 : 1);
      if (p.rest > 0) {
        // lying on the ground; the view turning still slides it, then a breath of wind moves it on
        p.x += shift * p.z; p.rest -= dt;
        if (p.rest <= 0) spawn(p, a, false, horizon);
        else {
          ctx.fillStyle = p.c; ctx.globalAlpha = Math.min(1, p.rest / 0.4) * (p.k === 4 ? 0.5 : p.k === 2 ? 0.55 : 0.8);
          ctx.fillRect(p.x | 0, (horizon + p.ground) | 0, p.k === 1 || p.k === 4 ? 3 : 2, 1);
        }
        continue;
      }
      const tvx = W.comp * (14 + 34 * gust) * Math.min(1, 0.35 + W.s) * (p.k === 2 ? 1.35 : p.k === 3 ? 0.5 : 1) * ws;
      p.vx += (tvx - p.vx) * Math.min(1, dt * 1.6);
      const flutter = p.k === 3 ? 2 : calm ? 0 : p.k === 2 ? 4 : 10;
      p.x += (p.vx + Math.sin(p.ph) * flutter) * dt * p.z + shift * p.z;
      // a gust lifts them; a toward/away wind pushes them down/up the view a touch
      const lift = calm ? 0 : Math.max(0, gust - 0.7) * W.s * 14;
      p.y += (p.vy * (calm ? 0.5 : 1 + 0.25 * -W.fwd * W.s) - (p.k === 3 ? 0 : lift)) * dt * p.z;
      if (p.x < -4) p.x += 328; if (p.x > 324) p.x -= 328;
      if (p.k === 3) {
        if (p.y < -4) spawn(p, a, false, horizon);
        ctx.fillStyle = p.c; ctx.globalAlpha = 0.35 + 0.35 * Math.sin(p.ph * 2); ctx.fillRect(p.x | 0, p.y | 0, 1, 1);
        continue;
      }
      if (p.y >= horizon + p.ground) { p.rest = 0.7 + Math.random() * 1.1; p.y = horizon + p.ground; continue; }
      if (p.y < -6) { p.y = -2; }
      ctx.fillStyle = p.c;
      if (p.k === 2) { ctx.globalAlpha = 0.7 + 0.2 * Math.sin(p.ph * 2); ctx.fillRect(p.x | 0, p.y | 0, 1, 1); }
      else if (p.k === 4) { ctx.globalAlpha = 0.45 + 0.2 * Math.sin(p.ph * 1.5); ctx.fillRect(p.x | 0, p.y | 0, 1, 2); }
      else {
        const flat = Math.sin(p.ph * 1.7) > 0, big = p.z > 1.1 ? 1 : 0;
        ctx.globalAlpha = 0.85;
        if (p.k === 1) ctx.fillRect(p.x | 0, p.y | 0, flat ? 3 : 1, flat ? 1 : 3);
        else ctx.fillRect(p.x | 0, p.y | 0, flat ? 2 + big : 1, flat ? 1 : 2 + big);
      }
    }
    ctx.globalAlpha = 1;
    return true;
  }

  // ---------------------------------------------------------------- bells
  // A struck bell swings in time: the angle is A * exp(-t/tau) * cos(2 pi t / P), which is at its
  // extreme at the strike, so the swing peaks on the hit; the next strike lands near the opposite
  // extreme (P is twice the interval between the coda bell's three tolls). The bell is cut from
  // the existing 'bigbell' art: the frame and crown stay, the bell and rope below swing as a
  // shear about the crossbeam, clipped to the gap between the posts.
  const BELL_FRAMES = 15, BELL_MID = 7;
  const bellFrames = [];
  const PIVOT_Y = 26, GAP_X0 = 20, GAP_X1 = 77, BELL_SHEAR = 0.1;
  function buildBellFrames() {
    if (bellFrames.length || typeof Engine === 'undefined') return bellFrames.length > 0;
    const base = Engine.sprites.bigbell; if (!base) return false;
    const w = base.w, h = base.h, sx = w / 97, sy = h / 150;     // measured on the 97x150 art; scaled if it is ever swapped
    const px = Math.round(PIVOT_Y * sy), x0 = Math.round(GAP_X0 * sx), x1 = Math.round(GAP_X1 * sx);
    for (let i = 0; i < BELL_FRAMES; i++) {
      const k = (i - BELL_MID) / BELL_MID, data = new Uint32Array(base.data);
      if (i !== BELL_MID) {
        for (let y = px + 4; y < h; y++) for (let x = x0; x <= x1; x++) data[y * w + x] = 0;
        for (let y = px + 4; y < h; y++) {
          const off = Math.round(k * BELL_SHEAR * (y - px));
          for (let x = x0; x <= x1; x++) {
            const px0 = base.data[y * w + x]; if ((px0 >>> 24) < 100) continue;
            const dx = x + off; if (dx >= x0 && dx <= x1) data[y * w + dx] = px0;
          }
        }
      }
      Engine.addSprite('wb_bell~' + i, { w, h, data, hs: base.hs, cx: base.cx, dy: base.dy });
      bellFrames.push('wb_bell~' + i);
    }
    return true;
  }
  const bells = new Set();      // decos currently ringing
  function angle(b, t) { const u = t - b.t0; return u < 0 ? 0 : b.sign * b.A * Math.exp(-u / b.tau) * Math.cos(TAU * u / b.P); }
  function strike(e, strength) {
    if (!GFX.bellSwing || !e || e.kind !== 'deco' || !buildBellFrames()) return false;
    const big = (e.scale || 1) >= 1.5, calm = reduced();
    const prev = e._wb, now = clock, cur = prev ? angle(prev, now) : 0;
    const A = clamp((calm ? 0.35 : 0.8) * (strength == null ? 1 : strength) + Math.abs(cur) * 0.5, 0, calm ? 0.45 : 1);
    const next = { t0: now, A, sign: prev ? -prev.sign : 1, tau: calm ? 1.4 : big ? 3.4 : 2.4, P: big ? 2.8 : 1.6, blendFrom: prev ? { b: prev, v: cur } : null };
    e._wb = next; e._wbRing = true; bells.add(e); stats.strikes++;
    return true;
  }
  function bellK(b, t) {
    let k = angle(b, t);
    if (b.blendFrom) { const u = (t - b.t0) / 0.12; if (u >= 1) b.blendFrom = null; else k = b.blendFrom.v * (1 - smooth(u)) + k * smooth(u); }
    return k;
  }
  function tickBells() {
    for (const e of bells) {
      const b = e._wb;
      if (!GFX.bellSwing || !b) { e.animSprite = null; e._wbRing = false; bells.delete(e); continue; }
      const k = bellK(b, clock);
      if (clock - b.t0 > b.tau * 3.2 && Math.abs(k) < 0.03) { e.animSprite = null; e._wbRing = false; e._wb = null; bells.delete(e); continue; }
      const i = clamp(Math.round(k * BELL_MID) + BELL_MID, 0, BELL_FRAMES - 1);
      e.animSprite = bellFrames[i];
    }
  }
  const nearest = (ents, test) => { let best = null, bd = 1e9; for (const e of ents) if (e.kind === 'deco' && !e.hidden && test(e)) { const d = (e.x - Engine.cam.x) ** 2 + (e.y - Engine.cam.y) ** 2; if (d < bd) { bd = d; best = e; } } return best; };

  // ---------------------------------------------------------------- per frame
  function frame(dt) {
    stats.frames++;
    updateWind();
    if (!G.ents || !G.map) return;
    const on = GFX.windSigns;
    if (on && G.map._wbBanners) ensure(G.map);
    if (on !== api._shown) sync();
    if (on) {
      if (G.map.outdoor) for (const e of signsOf(G.ents)) { if (!e.hidden) e.animSkew = signSkew(e); }
      for (const e of bannersOf(G.ents)) if (!e.hidden) tickBanner(e, dt);
    }
    if (bells.size) tickBells();
  }
  const api = {
    _shown: true, W, stats, AREAS, BANNER_SPECS,
    // tests hold the clock and step it by hand
    hold(on) { held = !!on; lastNow = null; },
    step(dt) { clock += dt; frame(dt); },
    get clock() { return clock; },
    strike, angle, bellK, bellFrames: () => bellFrames, buildBellFrames, buildArt, tickBells,
    bannersOf: m => (m && m._wbBanners) || [], signsOf, signSkew, updateWind, gustAt,
    ringing: () => bells.size, tickBanner, place: placeAll, sync, ensure, drawLeaves, pool,
    banner: { paintBanner, paintPennant, levels: BANNER_LEVELS, phases: BANNER_PHASES },
  };

  // ---------------------------------------------------------------- hooks
  if (typeof GFX !== 'undefined') GFX.onChange(() => { try { sync(); } catch (e) { /* never break a frame */ } });
  const _buildAllMaps = buildAllMaps;
  buildAllMaps = function () { const maps = _buildAllMaps(); placeAll(maps); return maps; };
  // the Greening rebuilds Oakhaven on its own, outside buildAllMaps
  const _buildOakhaven = buildOakhaven;
  buildOakhaven = function (greening) { const m = _buildOakhaven(greening); if (greening) { try { buildArt(); placeMap(m, 'oakhaven'); } catch (err) { console.warn('wind banner placement failed', err); } } return m; };
  // not re-added inside loadMap itself: visual.test.js asserts no transient decos right after a revisit; the first frame does it
  // leaves: take over the four outdoor areas when on; every other map and the off state run the original
  const _animParticles = animParticles;
  animParticles = function (dt, T) {
    if (GFX.leaves) {
      try {
        if (drawLeaves(dt)) {
          // keep anim.js's own list in step (presets and tests read it), exactly as it would rebuild it
          const st = PART_STYLE[G.mapId];
          if (st && PARTICLES.mapId !== G.mapId) { PARTICLES.mapId = G.mapId; PARTICLES.list = []; for (let i = 0; i < st.n; i++) PARTICLES.list.push(partNew(st, true)); }
          return;
        }
      } catch (err) { /* fall back to the original */ }
    }
    return _animParticles(dt, T);
  };
  if (typeof Engine !== 'undefined') {
    const _render = Engine.render;
    Engine.render = function (ents, tod, opts) {
      try {
        if (!held) { const now = performance.now() / 1000, dt = Math.min(0.1, lastNow ? Math.max(0, now - lastNow) : 0.016); lastNow = now; clock += dt; frame(dt); }
        else frame(0);
      } catch (err) { /* never break a frame */ }
      return _render.call(Engine, ents, tod, opts);
    };
  }
  // ---- bell rings: wrap the sounds the game already makes, so a swing happens exactly when (and only when) a ring does
  try {
    const sfx = Audio_.sfx;
    const _song = sfx.song;
    sfx.song = function (hz, dur) {
      const r = _song.apply(this, arguments);
      try {
        // coda.js rings the Mausoleum bell as three song(196, 1.4) once f.bell_rung is set
        if (hz === 196 && dur === 1.4 && G.flags && G.flags.bell_rung && G.ents) { const b = nearest(G.ents, e => e.use === 'tower_bell'); if (b) strike(b, 1); }
      } catch (err) { /* cosmetic */ }
      return r;
    };
    let arenaCall = false;
    const _bell = sfx.bell;
    sfx.bell = function () {
      const r = _bell.apply(this, arguments);
      try { if (arenaCall && G.ents) { const b = nearest(G.ents, e => e.use === 'arena_bell'); if (b) strike(b, 0.9); } } catch (err) { /* cosmetic */ }
      return r;
    };
    // the arena bell: startArenaWave calls sfx.bell only when it really starts a wave
    if (typeof startArenaWave === 'function') {
      const _wave = startArenaWave;
      startArenaWave = function () { arenaCall = true; try { return _wave.apply(this, arguments); } finally { arenaCall = false; } };
    }
    // the Catacombs alarm-bell wire: triggerTrap rings song(392) once, when it fires
    if (typeof triggerTrap === 'function') {
      const _trap = triggerTrap;
      triggerTrap = function (e) {
        const was = e && typeof trapKey === 'function' ? G.flags[trapKey(e)] : null;
        const r = _trap.apply(this, arguments);
        try { if (e && e.trapType === 'alarm' && !was && G.flags[trapKey(e)] === 'triggered') strike(e, 0.8); } catch (err) { /* cosmetic */ }
        return r;
      };
    }
  } catch (err) { console.warn('windbells bell hooks failed', err); }
  return api;
})();
