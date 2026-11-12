// ============================================================
//  FLORA — swaying, player-reactive grass tufts and reeds
//  Procedural stand-in sprites plus transient, non-solid decos scattered on
//  grass and moss, and on the banks of water. Each frame the ones near the
//  camera lean with the wind (Weather.wind) and bend away from the player,
//  easing back once he has passed (ROADMAP.md, "Swaying, player-reactive
//  grass and reeds").
//  anim.js zeroes animSkew on every deco each frame (animReset), so the lean
//  is written from a wrapper around Engine.render, after anim.js has run.
// ============================================================
'use strict';

const FLORA = (() => {
  const CAP = 120;            // tufts and reeds per map
  const BEND_R = 1.2;         // the player bends anything within this many units
  const LOD_GRASS2 = 16 * 16, LOD_REED2 = 20 * 20;   // beyond these (squared) distances a tuft is not drawn

  // ---------------------------------------------------------------- art
  // STAND-IN ART: blades and stalks are painted procedurally with canvas 2D and
  // hardened to hard-alpha painted pixels; final painted sprites replace them.
  function hash2(x, y) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function paint(w, h, draw) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d', { willReadFrequently: true });
    draw(c, w, h);
    const id = c.getImageData(0, 0, w, h), u8 = id.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (u8[o + 3] < 100) { u8[o + 3] = 0; continue; }
      const k = 1 + (hash2(x, y) - 0.5) * 0.14;
      u8[o] = Math.min(255, u8[o] * k); u8[o + 1] = Math.min(255, u8[o + 1] * k); u8[o + 2] = Math.min(255, u8[o + 2] * k); u8[o + 3] = 255;
    }
    return new Uint32Array(id.data.buffer);
  }
  function reg(name, w, h, data) { Engine.addSprite(name, { w, h, data, hs: 1, cx: 0.5, dy: 0 }); }
  function blade(c, x0, base, tx, ty, bw, col) {
    c.fillStyle = col; c.beginPath(); c.moveTo(x0 - bw, base);
    c.quadraticCurveTo(x0 + (tx - x0) * 0.15, base - (base - ty) * 0.55, tx, ty);
    c.quadraticCurveTo(x0 + (tx - x0) * 0.2 + bw, base - (base - ty) * 0.5, x0 + bw, base); c.closePath(); c.fill();
  }
  function tuft(seed, opts) {
    const rnd = mulberry32(seed), w = 40, h = 34;
    return paint(w, h, (c) => {
      const n = opts.n, blades = [];
      for (let i = 0; i < n; i++) blades.push({ x0: w / 2 + (rnd() - 0.5) * w * 0.62, len: h * (0.42 + rnd() * 0.54), lean: (rnd() - 0.5) * 0.9, bw: opts.bw * (0.8 + rnd() * 0.5) });
      blades.sort((a, b) => b.len - a.len);       // tall, dark blades behind; short, bright ones in front
      blades.forEach((b, i) => {
        const t = i / Math.max(1, n - 1), tx = b.x0 + (b.x0 - w / 2) * 0.5 + b.lean * b.len * 0.6, ty = h - 1 - b.len;
        blade(c, b.x0, h - 1, tx, ty, b.bw, opts.cols[Math.min(opts.cols.length - 1, (t * opts.cols.length) | 0)]);
        if (opts.seeds && i < opts.seeds) { c.fillStyle = '#b09c4c'; c.beginPath(); c.ellipse(tx, ty + 1, 1.6, 3.2, b.lean * 0.6, 0, Math.PI * 2); c.fill(); }
      });
    });
  }
  function reed(seed, opts) {
    const rnd = mulberry32(seed), w = 28, h = 96;
    return paint(w, h, (c) => {
      const stalks = opts.n;
      for (let i = 0; i < stalks; i++) {
        const x0 = 7 + rnd() * (w - 14), height = h * (0.7 + rnd() * 0.28), lean = (rnd() - 0.5) * 0.28, tx = x0 + lean * height, ty = h - 1 - height;
        const col = opts.cols[i % opts.cols.length];
        c.strokeStyle = col; c.lineWidth = 2.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, h - 1); c.quadraticCurveTo(x0 + lean * height * 0.15, h - 1 - height * 0.5, tx, ty); c.stroke();
        // a long leaf peeling off the lower stalk
        const side = rnd() < 0.5 ? -1 : 1;
        blade(c, x0, h - 1 - height * 0.25, x0 + side * (6 + rnd() * 5), h - 1 - height * (0.62 + rnd() * 0.15), 1.3, opts.cols[(i + 1) % opts.cols.length]);
        if (opts.heads && i < opts.heads) {
          c.strokeStyle = '#5a3a22'; c.lineWidth = 4.6; c.beginPath(); c.moveTo(tx - lean * 3, ty + 15); c.lineTo(tx, ty + 3); c.stroke();
          c.strokeStyle = '#8a8f4a'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(tx, ty + 3); c.lineTo(tx + lean * 6, ty - 5); c.stroke();
        } else if (opts.plumes) {
          c.strokeStyle = '#a89a6a'; c.lineWidth = 1.6;
          for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(tx, ty + 8); c.quadraticCurveTo(tx + k * 2, ty + 3, tx + k * 3.4 + lean * 6, ty - 2 - Math.abs(k)); c.stroke(); }
        }
      }
    });
  }
  function paintAll() {
    const G1 = ['#2c4522', '#3a5a2c', '#4d7234', '#6b8f40'], G2 = ['#33492a', '#4a6a30', '#6f8a3c', '#9aa24c'], G3 = ['#2a4a38', '#35604a', '#467a52', '#5e9460'];
    reg('p_grass1', 40, 34, tuft(11, { n: 17, bw: 1.7, cols: G1 }));
    reg('p_grass2', 40, 34, tuft(23, { n: 12, bw: 1.4, cols: G2, seeds: 3 }));
    reg('p_grass3', 40, 34, tuft(37, { n: 9, bw: 2.5, cols: G3 }));
    reg('p_reed1', 28, 96, reed(5, { n: 5, cols: ['#4d6330', '#667a38', '#3e5228'], heads: 2 }));
    reg('p_reed2', 28, 96, reed(9, { n: 6, cols: ['#5b6e34', '#7a8a44', '#46592c'], plumes: true }));
  }
  try { paintAll(); } catch (e) { console.warn('flora art failed', e); }

  // ---------------------------------------------------------------- placement
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
  function floorName(map, cx, cy) {
    if (map.floorCells && map.floorTextures) { const t = map.floorTextures[map.floorCells[cy * map.w + cx]]; if (t) return t; }
    return map.floor;
  }
  // grass and reed budgets per map; reeds also cover the pools and the Flume
  const PLANS = {
    oakhaven: { grass: 82, reed: 38 },
    clearing: { grass: 120, reed: 0 },
    deepwoods: { grass: 85, reed: 35 },
    whispergrove: { grass: 0, reed: 120 },
  };
  const LABELS = { grass: ['Rank grass, bending with the wind.', 'A tuft of grass, grey at the roots.'], reed: ['Reeds, whispering to each other.', 'Reeds, tall as a man, heads nodding.'] };

  function makeTuft(rng, type, x, y) {
    const sprite = type === 'reed' ? (rng() < 0.55 ? 'p_reed1' : 'p_reed2') : 'p_grass' + (1 + ((rng() * 3) | 0));
    const scale = type === 'reed' ? 0.75 + rng() * 0.3 : 0.32 + rng() * 0.18;
    return { kind: 'deco', sprite, x, y, scale, solid: false, nopick: true, transient: true, _flora: type, _fp: rng() * Math.PI * 2, _fk: 0.8 + rng() * 0.5, _fa: 0.7 + rng() * 0.6, label: LABELS[type][(rng() * 2) | 0] };
  }
  function placeMap(map, cache) {
    const plan = PLANS[map.id];
    if (!plan || map._floraPlaced) return;
    map._floraPlaced = true; map._flora = [];
    const key = map.id + '|' + map.name + '|' + map.baseCount + '|' + map.w + 'x' + map.h;
    if (cache[key]) { for (const s of cache[key]) addTuft(map, Object.assign({}, s)); return; }
    const rng = mulberry32(hashStr(map.id) ^ 0xF10A);
    // cell classes
    const texAt = (x, y) => (x < 0 || y < 0 || x >= map.w || y >= map.h) ? null : floorName(map, x, y);
    // patches near where the player arrives are favoured, so the grass is met rather than hidden in the far corners
    const near0 = (x, y) => 1 + 3 * Math.exp(-Math.hypot(x - map.spawn.x, y - map.spawn.y) / 9);
    const grassCells = [], reedCells = [], shallowCells = [];
    for (let y = 1; y < map.h - 1; y++) for (let x = 1; x < map.w - 1; x++) {
      if (map.isBlocked(x, y)) continue;
      const t = texAt(x, y);
      if (t === 't_grass' || t === 't_moss') {
        // grass near a road gets extra weight so the verges grow thick
        let road = 0; for (let dy = -2; dy <= 2 && !road; dy++) for (let dx = -2; dx <= 2; dx++) if (texAt(x + dx, y + dy) === 't_cobble') { road = 1; break; }
        grassCells.push([x, y, (road ? 3 : 1) * near0(x, y)]);
      }
      if (t === 't_grass' || t === 't_moss' || t === 't_shallows') {
        let near = false; for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (texAt(x + dx, y + dy) === 't_water') { near = true; break; }
        if (near) reedCells.push([x, y, near0(x, y)]); else if (t === 't_shallows' && map.floor === 't_shallows') shallowCells.push([x, y, near0(x, y)]);
      }
    }
    const doors = []; for (const k in map.doors) doors.push([(k % map.w) + 0.5, ((k / map.w) | 0) + 0.5]);
    const solids = map.entities.filter(e => e.solid && !e.dead).map(e => [e.x, e.y, (e.radius || 0.3) + 0.08]);
    const spots = [];
    const free = (x, y, type, spacing) => {
      const cx = Math.floor(x), cy = Math.floor(y), t = texAt(cx, cy);
      if (cx < 1 || cy < 1 || cx >= map.w - 1 || cy >= map.h - 1 || map.isBlocked(cx, cy)) return false;
      if (type === 'grass' ? !(t === 't_grass' || t === 't_moss') : !(t === 't_grass' || t === 't_moss' || t === 't_shallows')) return false;
      for (const [dx, dy] of [[0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]]) if (map.isBlocked(Math.floor(x + dx), Math.floor(y + dy))) return false;
      for (const d of doors) if (Math.hypot(x - d[0], y - d[1]) < 1.2) return false;
      for (const s of solids) if (Math.hypot(x - s[0], y - s[1]) < s[2]) return false;
      for (const p of (map._scn || [])) if (Math.hypot(x - p.x, y - p.y) < (p.radius || 0.3) + 0.4) return false;
      for (const p of spots) if (Math.hypot(x - p.x, y - p.y) < spacing) return false;
      return true;
    };
    const weighted = (list) => { let sum = 0; for (const c of list) sum += c[2]; let t = rng() * sum; for (const c of list) { t -= c[2]; if (t <= 0) return c; } return list[0]; };
    const fill = (type, cells, budget) => {
      if (!budget || !cells.length) return;
      const target = Math.min(CAP - spots.length, budget), stop = spots.length + target;
      for (let guard = 0; spots.length < stop && guard < 400; guard++) {
        const c = weighted(cells), cx = c[0] + 0.5, cy = c[1] + 0.5;
        const k = type === 'reed' ? 4 + ((rng() * 4) | 0) : 6 + ((rng() * 6) | 0), spread = type === 'reed' ? 0.9 : 0.95;
        for (let i = 0; i < k && spots.length < stop; i++) {
          for (let tries = 0; tries < 6; tries++) {
            const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * spread, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
            if (!free(x, y, type, type === 'reed' ? 0.42 : 0.28)) continue;
            const e = makeTuft(rng, type, +x.toFixed(2), +y.toFixed(2)); spots.push(e); break;
          }
        }
      }
    };
    // reeds hug the banks first; Whispergrove is shallows throughout, so its beds also spread across them
    fill('reed', reedCells, Math.round(plan.reed * (shallowCells.length ? 0.6 : 1)));
    if (shallowCells.length) fill('reed', shallowCells, plan.reed - spots.length);
    fill('grass', grassCells, plan.grass);
    cache[key] = spots.map(e => Object.assign({}, e));
    for (const e of spots) addTuft(map, e);
  }
  function addTuft(map, e) { e.hidden = !GFX.grass; map._flora.push(e); if (GFX.grass) map.entities.push(e); }

  // ---------------------------------------------------------------- sway
  const F = {
    CAP, BEND_R, PLANS, cache: {},
    T: 0, lastT: null, held: false,
    place(maps) { for (const id in maps) { try { placeMap(maps[id], F.cache); } catch (err) { console.warn('flora placement failed on ' + id, err); } } F.sync(maps); },
    floraOf(map) { return (map && map._flora) || []; },
    ensure(map) {
      if (!map || !map._flora || !map._flora.length || !GFX.grass) return;
      const have = new Set(map.entities);
      for (const e of map._flora) if (!have.has(e)) map.entities.push(e);
      F.sync();
    },
    // With the toggle off the flora is hidden (so it neither renders nor collides) and also taken
    // out of the entity list, so a build with grass off carries no transient decos at all.
    sync(maps) {
      const want = !GFX.grass; F._shown = GFX.grass;
      const lists = []; if (typeof G !== 'undefined' && G.maps) for (const id in G.maps) lists.push(G.maps[id]); if (maps) for (const id in maps) lists.push(maps[id]);
      for (const m of lists) {
        if (!m._flora || !m._flora.length) continue;
        for (const e of m._flora) { e.hidden = want || !!e._lod; if (want) { e.animSkew = 0; e._fb = 0; } }
        const mine = new Set(m._flora);
        if (want) { for (let i = m.entities.length - 1; i >= 0; i--) if (mine.has(m.entities[i])) m.entities.splice(i, 1); }
        else if (typeof G !== 'undefined' && G.map === m) { const have = new Set(m.entities); for (const e of m._flora) if (!have.has(e)) m.entities.push(e); }
      }
    },
    // Tests hold the clock and step it by hand, so frames are repeatable.
    hold(on) { F.held = !!on; F.lastT = null; },
    step(dt) { F.T += dt; F.apply(dt); },
    // Lean every tuft near the camera: wind sway plus a bend away from the player.
    apply(dt) {
      const map = typeof G !== 'undefined' ? G.map : null; if (!map || !map._flora || !GFX.grass) return;
      const list = map._flora, cam = Engine.cam, T = F.T;
      const wind = Math.max(0, Math.min(1, typeof Weather !== 'undefined' ? Weather.wind : 0.15));
      const vel = typeof G !== 'undefined' && G.vel ? Math.hypot(G.vel.x, G.vel.y) : 0;
      const walk = Math.min(1, vel / 3.2), run = Math.max(0, Math.min(1, (vel - 3.4) / 2.2));
      const power = 0.34 + 0.12 * walk + 0.34 * run;                       // a runner flattens what a stander only brushes
      const fog = (map.fogDist || 12) * (typeof GFX.viewDist === 'number' ? GFX.viewDist : 1) * 1.15, fog2 = fog * fog;
      const rx = -Math.sin(cam.dir), ry = Math.cos(cam.dir);              // screen-right in the world
      const ease = dt > 0 ? 1 - Math.exp(-14 * dt) : 0, back = dt > 0 ? 1 - Math.exp(-3.2 * dt) : 0;
      const amp0 = (0.04 + 0.08 * wind) * (GFX.reduceMotion ? 0.25 : 1), S = typeof Engine.getScale === 'function' ? Engine.getScale() : 1;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        const dx = e.x - cam.x, dy = e.y - cam.y, d2 = dx * dx + dy * dy;
        // tufts a few pixels tall at the edge of the view are not worth the engine's projection and sort
        const far = d2 > (e._flora === 'reed' ? LOD_REED2 : LOD_GRASS2); e._lod = far; e.hidden = far;
        if (far || d2 > fog2) { if (e._fb || e.animSkew) { e._fb = 0; e.animSkew = 0; e.animSY = 1; } continue; }
        const reedK = e._flora === 'reed' ? 1.4 : 1;
        const gust = 0.75 + 0.25 * Math.sin(T * 0.31 + e.x * 0.08 + e.y * 0.05);
        const sway = amp0 * reedK * e._fa * gust * (0.7 * Math.sin(T * (1.3 + 0.9 * wind) * e._fk + e._fp) + 0.3 * Math.sin(T * 2.9 * e._fk + e._fp * 1.7));
        let target = 0;
        if (d2 < BEND_R * BEND_R) {
          const d = Math.sqrt(d2), k = 1 - d / BEND_R, side = (dx * rx + dy * ry) / Math.max(d, 0.2);
          // away from the player; a tuft dead ahead still leans a little to one side
          target = (0.4 * (side < 0 ? -1 : 1) + 0.6 * Math.max(-1, Math.min(1, side * 1.4))) * k * power;
        }
        const b = e._fb || 0;
        e._fb = b + (target - b) * (Math.abs(target) > Math.abs(b) ? ease : back);
        // a lean under a render pixel cannot be seen but would push the sprite onto the engine's slow path,
        // so far tufts stay upright: sprite height in pixels is about 150 * S * scale / distance
        let skew = sway + e._fb;
        if (Math.abs(skew) * 150 * S * (e.scale || 1) < 0.5 * Math.sqrt(d2)) skew = 0;
        e.animSkew = skew;
        e.animSY = 1 - Math.min(0.2, Math.abs(e._fb) * 0.45);
      }
    },
    // runs once per rendered frame, after anim.js has reset every deco
    tick() {
      if (!GFX.grass) return;
      if (F.held) { F.apply(0); return; }
      const now = typeof ANIM !== 'undefined' ? ANIM.T : performance.now() / 1000;
      const dt = F.lastT == null ? 0 : Math.min(0.1, Math.max(0, now - F.lastT));
      F.lastT = now; F.T = now; F.apply(dt);
    },
  };

  // ---------------------------------------------------------------- hooks
  if (typeof GFX !== 'undefined') GFX.onChange(() => { try { F.sync(); } catch (e) { /* never break a frame */ } });
  const _buildAllMaps = buildAllMaps;
  buildAllMaps = function () { const maps = _buildAllMaps(); F.place(maps); return maps; };
  // the Greening rebuilds Oakhaven on its own, outside buildAllMaps
  const _buildOakhaven = buildOakhaven;
  buildOakhaven = function (greening) { const m = _buildOakhaven(greening); if (greening) { try { placeMap(m, F.cache); } catch (err) { console.warn('flora placement failed', err); } } return m; };
  const _loadMap = loadMap;
  loadMap = function (id, pos) { const r = _loadMap(id, pos); try { F.ensure(G.map); } catch (e) { /* never break a frame */ } return r; };
  const _update = update;
  update = function (dt) { if (F._shown !== GFX.grass) F.sync(); return _update(dt); };
  if (typeof Engine !== 'undefined') {
    const _render = Engine.render;
    Engine.render = function (ents, tod, opts) {
      if (F._shown !== GFX.grass) F.sync();
      try { F.tick(); } catch (err) { /* never break a frame */ }
      return _render.call(Engine, ents, tod, opts);
    };
  }
  return F;
})();
