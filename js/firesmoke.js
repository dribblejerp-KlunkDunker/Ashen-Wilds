// ============================================================
//  firesmoke — Phase 4 (living world): chimney / hearth / campfire / Golem smoke,
//  water splashes, and wall torches and braziers.
//
//  Everything here is PROCEDURAL STAND-IN work: the chimney, torch and brazier
//  sprites are drawn in code, and the puffs and droplets are soft discs and
//  pixels. Final painted sheets can replace them without changing the contract.
//
//  Smoke and splashes are world-anchored particles drawn by one post hook
//  (order 8: after the scene, before soft fog, bloom and the water mirror, so
//  distance fog, the lit-water reflection and everything in front of a puff
//  treat it like any other object). Each particle is projected the way the
//  engine projects a sprite and is depth-tested against dbuf per pixel, so a
//  roof ridge, a wall or a creature in front hides it. Nothing here moves an
//  entity, touches a map cell or changes a timer: it reads game state only.
//
//  Switches (all in GFX.FX, so GFX.plain() turns them off):
//    GFX.smoke     chimneys (a small transient stack on a roof plus a smoke
//                  column), hearth / campfire smoke, Steam Golem and boiler steam
//    GFX.splashes  droplets thrown up when the player or an enemy wades, and a
//                  big splash when something falls in
//    GFX.torches   transient wall torches and braziers (sprites with an
//                  emissive flame and a point light) placed in dark places
//  With a switch off its transient decos are hidden AND removed from the entity
//  list, exactly like scenery.js, so frames and game state match the original.
//  Reduced motion (GFX.reduceMotion): fewer puffs that rise straight and slowly,
//  no spray arcs. No flash: the droplets lose their bright highlight.
// ============================================================
'use strict';

for (const k of ['smoke', 'splashes', 'torches']) {
  if (GFX[k] === undefined) GFX[k] = true;
  if (!GFX.FX.includes(k)) GFX.FX.push(k);
}

const FIRESMOKE = (() => {
  const CAP = 520;                 // live particles, all kinds
  const SPAWN_RANGE = 14;          // emitters farther than this (or than the fog) stay quiet
  const STEP = 0.5;                // distance between wading splashes
  const G_DROP = 6.5;              // droplet gravity, world units / s^2
  const stats = { calls: 0, spawned: 0, drawn: 0, torches: 0, chimneys: 0 };

  // ---- own RNG: never touches Math.random, so game rolls and tests stay untouched
  let rs = 0x9E3779B9;
  const rnd = () => { rs = (rs + 0x6D2B79F5) | 0; let t = Math.imul(rs ^ (rs >>> 15), 1 | rs); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rr = (a, b) => a + (b - a) * rnd();
  const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const reduced = () => !!GFX.reduceMotion;
  const pscale = () => Math.max(0, Math.min(2, typeof GFX.particles === 'number' ? GFX.particles : 1));

  // ================================================================ sprites
  const px = (r, g, b, a) => (((a == null ? 255 : a) << 24) | (b << 16) | (g << 8) | r) >>> 0;
  function canvasSprite(w, h, name, draw) {
    const data = new Uint32Array(w * h);
    const put = (x, y, c) => { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < w && y < h) data[y * w + x] = c; };
    const rect = (x, y, rw, rh, c) => { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) put(x + i, y + j, c); };
    draw(put, rect);
    Engine.addSprite(name, { w, h, data, hs: 1, cx: 0.5, dy: 0 });
    return data;
  }
  // the warm-flame mask: where a pixel gives its own light (same test lighting.js uses for fire)
  function flameMask(sp) {
    const m = new Uint8Array(sp.w * sp.h); let n = 0;
    for (let i = 0; i < m.length; i++) {
      const p = sp.data[i]; if ((p >>> 24) < 160) continue;
      const r = p & 255, g = (p >>> 8) & 255, b = (p >>> 16) & 255;
      if (r > 175 && r > g * 1.12 && g > b * 1.25 && 0.3 * r + 0.59 * g + 0.11 * b > 135) { m[i] = 1; n++; }
    }
    return n ? m : null;
  }
  const FLAME = [px(225, 90, 16), px(255, 150, 30), px(255, 205, 80), px(255, 230, 150)];
  function flameBlob(put, cx, top, rows, maxW) {
    // a teardrop: narrow tip, full belly, rounded base; colour runs hot toward the middle
    for (let j = 0; j < rows; j++) {
      const t = j / (rows - 1), wdt = Math.max(1, Math.round(maxW * Math.sin(Math.PI * Math.pow(t, 0.8) * 0.92 + 0.12)));
      for (let i = -(wdt >> 1); i < wdt - (wdt >> 1); i++) {
        const edge = Math.abs(i + 0.5 - (wdt & 1 ? 0.5 : 0)) / Math.max(1, wdt / 2);
        const heat = (1 - edge) * (0.45 + 0.7 * t);
        put(cx + i, top + j, heat > 0.78 ? FLAME[3] : heat > 0.5 ? FLAME[2] : heat > 0.25 ? FLAME[1] : FLAME[0]);
      }
    }
  }
  function buildSprites() {
    if (Engine.sprites.torch && Engine.sprites.torch._fs) return;
    // wall torch 16x32: iron plate, wooden shaft, iron cup, flame
    canvasSprite(16, 32, 'torch', (put, rect) => {
      rect(5, 23, 6, 8, px(52, 50, 58)); rect(5, 23, 6, 1, px(98, 94, 104)); put(6, 25, px(120, 116, 124)); put(9, 28, px(120, 116, 124));
      rect(7, 14, 2, 14, px(104, 72, 40)); rect(7, 14, 1, 14, px(132, 94, 54)); rect(8, 14, 1, 14, px(76, 52, 30));
      rect(4, 12, 8, 1, px(98, 94, 104)); rect(5, 13, 6, 2, px(58, 56, 62)); rect(6, 15, 4, 1, px(44, 42, 48));
      flameBlob(put, 8, 1, 11, 7);
    });
    // standing brazier 24x28: coal-filled iron bowl on three splayed legs
    canvasSprite(24, 28, 'brazier', (put, rect) => {
      flameBlob(put, 12, 0, 12, 10);
      rect(4, 12, 16, 1, px(116, 108, 104)); rect(5, 13, 14, 1, px(150, 60, 60)); rect(5, 14, 14, 2, px(62, 58, 66)); rect(6, 16, 12, 2, px(50, 48, 54)); rect(8, 18, 8, 1, px(40, 38, 44));
      put(8, 13, px(130, 52, 54)); put(13, 13, px(170, 70, 64)); put(16, 13, px(120, 48, 52));
      for (let j = 0; j < 9; j++) { const o = Math.round(j * 0.55); rect(9 - o, 19 + j, 2, 1, px(46, 44, 50)); rect(13 + o, 19 + j, 2, 1, px(46, 44, 50)); }
      rect(11, 19, 2, 8, px(56, 54, 60)); rect(3, 27, 4, 1, px(36, 34, 40)); rect(17, 27, 4, 1, px(36, 34, 40)); rect(10, 27, 4, 1, px(36, 34, 40));
    });
    // roof chimney 14x28: brick stack, stone cap, soot-dark mouth
    canvasSprite(14, 28, 'chimney', (put, rect) => {
      rect(2, 6, 10, 22, px(118, 70, 56));
      for (let y = 6; y < 28; y += 3) { rect(2, y, 10, 1, px(78, 52, 46)); const off = (y / 3) & 1 ? 3 : 0; for (let x = 2 + off; x < 12; x += 6) rect(x, y + 1, 1, 2, px(78, 52, 46)); }
      rect(2, 6, 1, 22, px(142, 88, 70)); rect(11, 6, 1, 22, px(84, 54, 46));
      rect(1, 3, 12, 3, px(136, 126, 116)); rect(1, 3, 12, 1, px(166, 156, 144)); rect(1, 5, 12, 1, px(98, 90, 84));
      rect(3, 2, 8, 1, px(30, 26, 28)); rect(3, 1, 8, 1, px(58, 52, 54));
      rect(0, 26, 14, 2, px(112, 104, 98));
    });
    for (const n of ['torch', 'brazier', 'chimney']) Engine.sprites[n]._fs = true;
    for (const n of ['torch', 'brazier']) Engine.setEmissive(n, flameMask(Engine.sprites[n]));
    // the fire animation (flame sway, flicker, glow, the emissive flame frames) keys on this set
    if (typeof ANIM !== 'undefined' && ANIM.fire) { ANIM.fire.add('torch'); ANIM.fire.add('brazier'); }
  }

  // ================================================================ placement
  const SKIP_ROOF = /tannery|mill|chapel|granary|barn|shed|store|washhouse|fulling|empty|shuttered/i;
  const mapOf = id => (typeof G !== 'undefined' && G.maps) ? G.maps[id] : null;

  // Roof ridges are m.block cells (tex and capTex 't_roof', top 1.35 / 1.7). Group them into
  // buildings, drop the ones that are sheds, barns or empty houses, put a stack on the ridge.
  function findChimneys(map) {
    const W = map.w, H = map.h, cells = map.cells, seen = new Uint8Array(W * H), out = [];
    const isRoof = c => c && c.tex === 't_roof' && c.capTex === 't_roof' && c.top >= 1.3 && c.top <= 1.8;
    for (let i = 0; i < cells.length; i++) {
      if (seen[i] || !isRoof(cells[i])) continue;
      const stack = [i], comp = []; seen[i] = 1;
      while (stack.length) {
        const k = stack.pop(); comp.push(k);
        const x = k % W, y = (k / W) | 0;
        for (const n of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, y > 0 ? k - W : -1, y < H - 1 ? k + W : -1]) if (n >= 0 && !seen[n] && isRoof(cells[n])) { seen[n] = 1; stack.push(n); }
      }
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, topMax = 0;
      for (const k of comp) { const x = k % W, y = (k / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; topMax = Math.max(topMax, cells[k].top); }
      // the building's door tells us what it is
      let label = '';
      for (let y = Math.max(0, y0 - 2); y <= Math.min(H - 1, y1 + 2); y++) for (let x = Math.max(0, x0 - 2); x <= Math.min(W - 1, x1 + 2); x++) { const c = cells[y * W + x]; if (c && c.door && c.label) label += c.label + '|'; }
      if (SKIP_ROOF.test(label)) continue;
      const along = (x1 - x0) >= (y1 - y0), ridge = comp.filter(k => cells[k].top >= topMax - 0.05);
      // the stack stands at the end of the ridge, alternating ends from house to house
      const flip = (hashStr(map.id + ':' + x0 + ',' + y0) & 1) === 1;
      ridge.sort((a, b) => along ? ((a % W) - (b % W)) || (((a / W) | 0) - ((b / W) | 0)) : (((a / W) | 0) - ((b / W) | 0)) || ((a % W) - (b % W)));
      const k = flip ? ridge[ridge.length - 1] : ridge[0];
      out.push({ x: (k % W) + 0.5, y: ((k / W) | 0) + 0.5, top: cells[k].top });
    }
    return out;
  }

  // plans for dark places: wall torches (the first ones flank the way in), braziers in open floor
  const PLANS = {
    underhedge: { torches: 4, braziers: 1 }, quarry: { torches: 4, braziers: 1 }, rootvault: { torches: 3, braziers: 0 },
    catacombs: { torches: 3, braziers: 1 }, mausoleum: { torches: 3, braziers: 2 }, arena: { torches: 0, braziers: 4 },
    malting: { torches: 2, braziers: 0 }, belfry: { torches: 2, braziers: 0 }, greenhall: { torches: 2, braziers: 0 },
  };
  const isWallCell = c => !!(c && !c.door && c.top === undefined);
  function floorKind(map, x, y) {
    if (!map.floorCells) return 0;
    const t = (map.floorTextures ? map.floorTextures[map.floorCells[y * map.w + x]] : null) || map.floor || '';
    return t === 't_water' ? 2 : t === 't_shallows' ? 1 : 0;
  }
  function planFires(map, plan) {
    const W = map.w, H = map.h, rng = (() => { let s = hashStr(map.id + ':fire') | 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
    const doors = []; for (const k in map.doors) doors.push([(k % W) + 0.5, ((k / W) | 0) + 0.5]);
    for (const t of map.triggers || []) doors.push([t.x, t.y]);
    const busy = [];   // anything that gives light, or stands in the way, in the map already
    for (const e of map.entities) if (e.kind === 'deco' || e.kind === 'npc' || e.kind === 'enemy' || e.kind === 'item') busy.push([e.x, e.y, (e.sprite === 'lamp' || e.sprite === 'hearth' || e.sprite === 'campfire') ? 3 : 1.1]);
    const free = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !map.isBlocked(x, y) && !floorKind(map, x, y);
    const cand = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (!free(x, y)) continue;
      const cx = x + 0.5, cy = y + 0.5;
      if (doors.some(d => Math.hypot(d[0] - cx, d[1] - cy) < 2.4)) continue;
      if (busy.some(b => Math.hypot(b[0] - cx, b[1] - cy) < b[2])) continue;
      let open = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && free(x + dx, y + dy)) open++;
      const sides = [[0, -1], [0, 1], [-1, 0], [1, 0]].filter(([dx, dy]) => isWallCell(map.get(x + dx, y + dy)) && free(x - dx, y - dy));
      if (sides.length !== 1) continue;
      cand.push({ x, y, side: sides[0], open, r: rng() });
    }
    const out = [], near = (l, x, y, d) => l.some(o => Math.hypot(o.x - x, o.y - y) < d);
    const sp = map.spawn || { x: map.w / 2, y: map.h / 2 };
    // the first two torches flank the way in
    const byDoor = cand.slice().sort((a, b) => Math.hypot(a.x + 0.5 - sp.x, a.y + 0.5 - sp.y) - Math.hypot(b.x + 0.5 - sp.x, b.y + 0.5 - sp.y));
    for (const c of byDoor) {
      if (out.filter(o => o.type === 'torch').length >= Math.min(2, plan.torches)) break;
      const d = Math.hypot(c.x + 0.5 - sp.x, c.y + 0.5 - sp.y);
      if (d < 2 || d > 9 || c.open < 4 || near(out, c.x, c.y, 3)) continue;
      out.push({ type: 'torch', x: c.x, y: c.y, side: c.side });
    }
    const rest = cand.slice().sort((a, b) => a.r - b.r);
    for (const c of rest) {
      if (out.filter(o => o.type === 'torch').length >= plan.torches) break;
      if (c.open < 4 || near(out, c.x, c.y, 6)) continue;
      out.push({ type: 'torch', x: c.x, y: c.y, side: c.side });
    }
    for (const c of rest) {
      if (out.filter(o => o.type === 'brazier').length >= plan.braziers) break;
      if (c.open < 6 || near(out, c.x, c.y, 5)) continue;
      out.push({ type: 'brazier', x: c.x, y: c.y, side: c.side });
    }
    return out;
  }
  function makeFire(spec) {
    const sx = spec.side[0], sy = spec.side[1];
    if (spec.type === 'torch') {
      // set into the wall face: 0.14 from the wall, shoulder-high
      return { kind: 'deco', sprite: 'torch', x: +(spec.x + 0.5 + sx * 0.36).toFixed(2), y: +(spec.y + 0.5 + sy * 0.36).toFixed(2), scale: 0.52, yOff: -0.36, solid: false, nopick: true, transient: true, _decor: true, glow: 0.8, lightCol: [66, 34, 9], _fs: 'torch', label: 'A torch in a wall bracket' };
    }
    return { kind: 'deco', sprite: 'brazier', x: +(spec.x + 0.5 + sx * 0.22).toFixed(2), y: +(spec.y + 0.5 + sy * 0.22).toFixed(2), scale: 0.62, solid: false, nopick: true, transient: true, _decor: true, glow: 0.8, lightCol: [74, 38, 10], _fs: 'brazier', label: 'An iron brazier, coals banked' };
  }

  function placeMap(map) {
    if (!map || map._fsPlaced) return;
    map._fsPlaced = true; map._fs = { chimneys: [], fires: [] };
    if (map.outdoor && map.id === 'oakhaven') {
      for (const c of findChimneys(map)) {
        const g = (map.lvls || map.smooth) ? map.groundAt(c.x, c.y) : 0;
        const e = { kind: 'deco', sprite: 'chimney', x: c.x, y: c.y, scale: 0.55, yOff: -(c.top + g + 0.03), solid: false, nopick: true, transient: true, _decor: true, _fs: 'chimney', _fsTop: c.top + g + 0.58, label: 'A chimney stack' };
        map._fs.chimneys.push(e);
      }
    }
    const plan = PLANS[map.id];
    if (plan) { try { for (const s of planFires(map, plan)) map._fs.fires.push(makeFire(s)); } catch (err) { console.warn('firesmoke placement failed on ' + map.id, err); } }
    const add = (list, on) => { for (const e of list) { e.hidden = !on; if (on) map.entities.push(e); } };
    add(map._fs.chimneys, GFX.smoke); add(map._fs.fires, GFX.torches);
  }
  function sync(maps) {
    const lists = []; if (typeof G !== 'undefined' && G.maps) for (const id in G.maps) lists.push(G.maps[id]); if (maps) for (const id in maps) if (!lists.includes(maps[id])) lists.push(maps[id]);
    for (const m of lists) {
      if (!m || !m._fs) continue;
      for (const [list, on] of [[m._fs.chimneys, GFX.smoke], [m._fs.fires, GFX.torches]]) {
        if (!list.length) continue;
        const mine = new Set(list);
        for (const e of list) e.hidden = !on;
        if (!on) { for (let i = m.entities.length - 1; i >= 0; i--) if (mine.has(m.entities[i])) m.entities.splice(i, 1); }
        else if (typeof G !== 'undefined' && G.map === m) { const have = new Set(m.entities); for (const e of list) if (!have.has(e)) m.entities.push(e); }
      }
    }
    shown = { smoke: GFX.smoke, torches: GFX.torches };
  }
  let shown = { smoke: true, torches: true };
  function ensure(map) {
    if (!map || !map._fs) return;
    const have = new Set(map.entities);
    if (GFX.smoke) for (const e of map._fs.chimneys) if (!have.has(e)) map.entities.push(e);
    if (GFX.torches) for (const e of map._fs.fires) if (!have.has(e)) map.entities.push(e);
  }

  // ================================================================ particles
  const px_ = new Float32Array(CAP), py_ = new Float32Array(CAP), pz_ = new Float32Array(CAP);
  const vx_ = new Float32Array(CAP), vy_ = new Float32Array(CAP), vz_ = new Float32Array(CAP);
  const age_ = new Float32Array(CAP), life_ = new Float32Array(CAP), r0_ = new Float32Array(CAP), r1_ = new Float32Array(CAP), a_ = new Float32Array(CAP);
  const warm_ = new Float32Array(CAP), seed_ = new Uint8Array(CAP), kind_ = new Uint8Array(CAP);   // kinds: 0 smoke, 1 steam, 2 droplet
  const zmax_ = new Float32Array(CAP);
  let n = 0;
  function spawn(kind, x, y, z, vx, vy, vz, life, r0, r1, a, warm, zmax) {
    if (n >= CAP) return false;
    const i = n++;
    px_[i] = x; py_[i] = y; pz_[i] = z; vx_[i] = vx; vy_[i] = vy; vz_[i] = vz; age_[i] = 0; life_[i] = life; r0_[i] = r0; r1_[i] = r1; a_[i] = a; warm_[i] = warm || 0;
    seed_[i] = (rnd() * 64) | 0; kind_[i] = kind; zmax_[i] = zmax == null ? 99 : zmax;
    stats.spawned++;
    return true;
  }
  function kill(i) {
    const l = --n; if (i === l) return;
    px_[i] = px_[l]; py_[i] = py_[l]; pz_[i] = pz_[l]; vx_[i] = vx_[l]; vy_[i] = vy_[l]; vz_[i] = vz_[l]; age_[i] = age_[l]; life_[i] = life_[l];
    r0_[i] = r0_[l]; r1_[i] = r1_[l]; a_[i] = a_[l]; warm_[i] = warm_[l]; seed_[i] = seed_[l]; kind_[i] = kind_[l]; zmax_[i] = zmax_[l];
  }
  function clearAll() { n = 0; }

  // wind: Weather.wind is 0..~1.08. The direction wanders slowly so columns lean the same way town-wide.
  let windX = 0, windY = 0, lastSkyDay = 1;
  function setWind(T) {
    const w = (typeof Weather !== 'undefined' && Weather && typeof Weather.wind === 'number') ? Weather.wind : 0.15;
    const a = 0.55 + 0.3 * Math.sin(T * 0.045), sp = (0.12 + w * 1.5) * (reduced() ? 0.3 : 1);
    windX = Math.cos(a) * sp; windY = Math.sin(a) * sp;
  }

  const ground = (map, x, y) => (map && (map.lvls || map.smooth)) ? map.groundAt(x, y) : 0;
  const waterAt = (x, y) => (typeof waterLvl === 'function' && G.map) ? waterLvl(x, y) : 0;

  // ---------------------------------------------------------------- emitters
  // Static ones are found once per map and cached on it; Steam Golems are read from the entity list.
  function staticEmitters(map) {
    if (map._fsEm) return map._fsEm;
    const list = [];
    for (const e of map.entities) {
      if (e.kind !== 'deco') continue;
      if (e.sprite === 'campfire') list.push({ t: 'camp', e, acc: rnd() });
      else if (e.sprite === 'hearth') list.push({ t: map.outdoor ? 'camp' : 'hearth', e, acc: rnd(), small: true });
    }
    const bl = map.named && map.named.boiler;
    if (bl) for (const e of map.entities) if (e.kind === 'deco' && e.sprite === 'pump' && e.x >= bl.x && e.x <= bl.x + bl.w && e.y >= bl.y && e.y <= bl.y + bl.h) list.push({ t: 'boiler', e, acc: 0 });
    map._fsEm = list;
    return list;
  }
  const lit = e => !e.hidden && !e.dead && (e.glow === undefined || e.glow > 0.05) && !/cold|unlit|dry/i.test(e.label || '');

  function emitChimney(map, e, dt, mult, cold) {
    e._fsAcc = (e._fsAcc || rnd()) + dt * 1.25 * mult * cold;
    while (e._fsAcc >= 1) {
      e._fsAcc -= 1;
      const rise = rr(0.5, 0.8) * (reduced() ? 0.55 : 1);
      spawn(0, e.x + rr(-0.05, 0.05), e.y + rr(-0.05, 0.05), e._fsTop, windX * 0.3, windY * 0.3, rise, rr(4.6, 6.6), 0.1, rr(0.55, 0.8), 0.62, 0, e._fsTop + 3.4);
    }
  }
  function emitFire(em, dt, mult, night) {
    const e = em.e;
    if (!lit(e)) return;
    const small = em.small, g = ground(G.map, e.x, e.y);
    em.acc += dt * (small ? 2.4 : 3.4) * mult;
    while (em.acc >= 1) {
      em.acc -= 1;
      const top = g + (e.scale || 0.7) * 0.9;
      spawn(0, e.x + rr(-0.06, 0.06), e.y + rr(-0.06, 0.06), top, windX * 0.5, windY * 0.5, rr(0.7, 1.05) * (reduced() ? 0.6 : 1), rr(2.4, 3.4), 0.05, rr(0.26, 0.36), 0.36 + 0.1 * night, 1, top + 2.6);
    }
  }
  function emitHearth(em, dt, mult) {
    const e = em.e;
    if (!lit(e)) return;
    const g = ground(G.map, e.x, e.y);
    em.acc += dt * 1.5 * mult;
    while (em.acc >= 1) {
      em.acc -= 1;
      // indoors: a thin curl that gives out under the ceiling
      const z0 = g + 0.62 * (e.scale || 0.9);
      spawn(0, e.x + rr(-0.05, 0.05), e.y + rr(-0.05, 0.05), z0, rr(-0.02, 0.02), rr(-0.02, 0.02), rr(0.08, 0.13) * (reduced() ? 0.6 : 1), rr(1.7, 2.4), 0.04, rr(0.1, 0.15), 0.5, 1, g + 0.97);
    }
  }
  function emitSteam(x, y, z, rate, dt, e, accKey, power) {
    e[accKey] = (e[accKey] || 0) + dt * rate;
    while (e[accKey] >= 1) {
      e[accKey] -= 1;
      spawn(1, x + rr(-0.04, 0.04), y + rr(-0.04, 0.04), z, windX * 0.4 + rr(-0.12, 0.12), windY * 0.4 + rr(-0.12, 0.12), rr(0.7, 1.15) * power * (reduced() ? 0.6 : 1), rr(0.7, 1.2), 0.05, rr(0.18, 0.3), 0.55, 0, z + 1.6);
    }
  }

  function spawnPass(dt, T) {
    const map = G.map, cam = Engine.cam; if (!map) return;
    const mult = pscale() * (reduced() ? 0.5 : 1);
    if (mult <= 0 || dt <= 0) return;
    const range = Math.min(SPAWN_RANGE, (map.fogDist || 12) * 1.1), r2 = range * range;
    const night = 1 - lastSkyDay;
    if (GFX.smoke) {
      // cold or foul weather and the dark hours: heavier smoke
      const st = (typeof Weather !== 'undefined' && Weather) ? Weather.state : 'clear';
      const cold = (st === 'snow' ? 1.4 : st === 'rain' || st === 'storm' || st === 'overcast' ? 1.15 : 1) * (1 + 0.5 * night);
      if (map._fs) for (const e of map._fs.chimneys) { if (e.hidden) continue; const dx = e.x - cam.x, dy = e.y - cam.y; if (dx * dx + dy * dy <= r2) emitChimney(map, e, dt, mult, cold); }
      for (const em of staticEmitters(map)) {
        const e = em.e, dx = e.x - cam.x, dy = e.y - cam.y;
        if (dx * dx + dy * dy > r2) continue;
        if (em.t === 'camp') emitFire(em, dt, mult, night);
        else if (em.t === 'hearth') emitHearth(em, dt, mult);
        else if (em.t === 'boiler') {
          // a pipe vent that surges every few seconds
          const surge = Math.max(0, Math.sin(T * 2.6 + e.x)); const k = surge > 0.75 ? 1 : 0.18;
          emitSteam(e.x, e.y, ground(map, e.x, e.y) + 0.62, 14 * mult * k, dt, em, 'acc', 1);
        }
      }
      // Steam Golems vent from both shoulders while they live
      const ents = G.ents, rx = Engine.cam ? Math.cos(cam.dir + Math.PI / 2) : 0, ry = Engine.cam ? Math.sin(cam.dir + Math.PI / 2) : 0;
      if (ents) for (let i = 0, nn = Math.min(ents.length, 512); i < nn; i++) {
        const e = ents[i];
        if (e.kind !== 'enemy' || e.sprite !== 'golem' || e.dead || e.hidden) continue;
        const dx = e.x - cam.x, dy = e.y - cam.y;
        if (dx * dx + dy * dy > r2) continue;
        if (e._fsSeed == null) e._fsSeed = rnd() * 6.28;
        const P = 3.4, ph = ((T + e._fsSeed) % P) / P, burst = ph < 0.2 ? 1 : 0, angry = e.state === 'chase' || e.state === 'attack' ? 1.6 : 1;
        const sc = e.scale || 1.15, z = ground(map, e.x, e.y) + 0.82 * sc;
        const k = (burst ? 16 : 2.2) * angry * mult;
        emitSteam(e.x + rx * 0.2 * sc, e.y + ry * 0.2 * sc, z, k, dt, e, '_fsA', burst ? 1.2 : 0.7);
        emitSteam(e.x - rx * 0.2 * sc, e.y - ry * 0.2 * sc, z, k, dt, e, '_fsB', burst ? 1.2 : 0.7);
      }
    }
    if (GFX.splashes) splashPass(dt, T, map, cam);
  }

  // ---------------------------------------------------------------- splashes
  let pPrevKind = 0, pPx = 0, pPy = 0, pHave = false, pFell = false, pAcc = 0, scanT = 0;
  function drops(x, y, z, count, power, spread) {
    if (!GFX.splashes || reduced()) return;
    const c = Math.round(count * Math.max(0.35, pscale()));
    for (let i = 0; i < c; i++) {
      const a = rnd() * 6.283, s = rr(0.15, 0.55) * spread;
      spawn(2, x + Math.cos(a) * 0.05, y + Math.sin(a) * 0.05, z, Math.cos(a) * s, Math.sin(a) * s, rr(0.55, 1) * power, 2, 0.02, 0.02, 0.9, 0, 0);
    }
  }
  function splashAt(x, y, size) {
    // public: size 0 small step, 1 wade-in, 2 big plunge
    const map = typeof G !== 'undefined' ? G.map : null; if (!map) return;
    const z = ground(map, x, y) + 0.01, k = Math.max(0, Math.min(3, size));
    drops(x, y, z, 6 + 10 * k, 1.5 + 0.9 * k, 1 + 0.4 * k);
    if (k >= 2 && typeof WATER !== 'undefined' && WATER.ripple) WATER.ripple(x, y, 1.4);
  }
  function splashPass(dt, T, map, cam) {
    const p = G.player;
    // the player: droplets are thrown a pace ahead, so they show at the bottom of the view
    const kind = waterAt(cam.x, cam.y);
    const dx = cam.x - pPx, dy = cam.y - pPy, moved = Math.hypot(dx, dy);
    const fell = !!(p && p.fallFrom != null);
    if (!pHave || moved > 3 || G.mapId !== lastMapId) { pPx = cam.x; pPy = cam.y; pHave = true; pPrevKind = kind; pAcc = 0; pFell = fell; }
    else {
      const sp = moved / Math.max(dt, 1e-3), run = sp > 3.6 ? 1 : 0;
      const front = (back) => ({ x: cam.x + Math.cos(cam.dir) * back, y: cam.y + Math.sin(cam.dir) * back });
      if (kind > 0) {
        if (pFell && !fell) { const f = front(0.9); drops(f.x, f.y, ground(map, f.x, f.y) + 0.01, 26, 3, 1.5); if (typeof WATER !== 'undefined' && WATER.ripple) WATER.ripple(cam.x, cam.y, 1.7); }
        else if (pPrevKind === 0) { const f = front(0.9); drops(f.x, f.y, ground(map, f.x, f.y) + 0.01, kind === 2 ? 14 : 9, kind === 2 ? 2.3 : 1.9, 1.2); }
        else { pAcc += moved; if (pAcc >= STEP * (run ? 0.8 : 1)) { pAcc = 0; for (let j = 0; j < 2; j++) { const f = front(rr(0.7, 1.3)); drops(f.x + (-Math.sin(cam.dir)) * rr(-0.35, 0.35), f.y + Math.cos(cam.dir) * rr(-0.35, 0.35), ground(map, f.x, f.y) + 0.01, (kind === 2 ? 2 : 3) + (run ? 3 : 0), run ? 1.9 : 1.4, 1); } } }
      } else pAcc = 0;
      pPrevKind = kind; pPx = cam.x; pPy = cam.y; pFell = fell;
    }
    lastMapId = G.mapId;
    // enemies (and anything else that wades): a look every 0.1 s
    scanT -= dt;
    if (scanT > 0) return;
    scanT = 0.1;
    const ents = G.ents; if (!ents) return;
    for (let i = 0, nn = Math.min(ents.length, 512); i < nn; i++) {
      const e = ents[i];
      if (e.kind !== 'enemy') continue;
      const ddx = e.x - cam.x, ddy = e.y - cam.y;
      if (ddx * ddx + ddy * ddy > 196) { e._fsK = undefined; continue; }
      const k = waterAt(e.x, e.y);
      if (e.dead) { if (!e._fsD) { e._fsD = true; if (k > 0) splashAt(e.x, e.y, 2); } continue; }
      if (e.hidden) continue;
      if (e._fsK === undefined) { e._fsK = k; e._fsX = e.x; e._fsY = e.y; continue; }
      if (k > 0) {
        const m = Math.hypot(e.x - e._fsX, e.y - e._fsY);
        if (e._fsK === 0 && m > 0.05) { splashAt(e.x, e.y, 1); e._fsX = e.x; e._fsY = e.y; }
        else if (m >= 0.45) { drops(e.x, e.y, ground(map, e.x, e.y) + 0.01, k === 2 ? 3 : 5, 1.3, 1); e._fsX = e.x; e._fsY = e.y; }
      } else { e._fsX = e.x; e._fsY = e.y; }
      e._fsK = k;
    }
  }
  let lastMapId = null;

  // ---------------------------------------------------------------- simulate
  function simulate(dt) {
    for (let i = n - 1; i >= 0; i--) {
      const a = age_[i] += dt;
      if (a >= life_[i]) { kill(i); continue; }
      if (kind_[i] === 2) {
        vz_[i] -= G_DROP * dt; px_[i] += vx_[i] * dt; py_[i] += vy_[i] * dt; pz_[i] += vz_[i] * dt;
        // a droplet ends when it comes back down to the water
        if (vz_[i] < 0 && pz_[i] < dropFloor(px_[i], py_[i])) kill(i);
        continue;
      }
      const k = Math.min(1, dt * 0.9);
      // smoke and steam lean into the wind; a gentle turbulence unless motion is reduced
      vx_[i] += (windX - vx_[i]) * k; vy_[i] += (windY - vy_[i]) * k;
      if (!reduced()) { const s = seed_[i]; vx_[i] += Math.sin(a * 1.7 + s) * 0.06 * dt; vy_[i] += Math.cos(a * 1.3 + s * 1.7) * 0.06 * dt; }
      px_[i] += vx_[i] * dt; py_[i] += vy_[i] * dt; pz_[i] += vz_[i] * dt;
      if (kind_[i] === 1) vz_[i] *= Math.max(0, 1 - 0.6 * dt);
      if (pz_[i] > zmax_[i]) kill(i);
    }
  }
  function dropFloor(x, y) { return ground(G.map, x, y) - 0.005; }

  // ---------------------------------------------------------------- draw
  const noise = new Float32Array(64); for (let i = 0; i < 64; i++) { const v = Math.sin(i * 12.9898) * 43758.5453; noise[i] = 0.72 + 0.28 * (v - Math.floor(v)); }
  function draw(F) {
    const fb = F.fb, dbuf = F.dbuf, w = F.w, h = F.h, cam = F.cam, S = F.S, hor = F.horizon;
    const dirX = F.dirX, dirY = F.dirY, plX = F.planeX, plY = F.planeY;
    const det = plX * dirY - dirX * plY; if (Math.abs(det) < 1e-9) return;
    const inv = 1 / det, outdoor = F.outdoor, light = F.light == null ? 1 : F.light, amb = F.ambient || 0;
    const fogD = Math.max(4, F.fogDist || 12), fr = F.fogR || 0, fg = F.fogG || 0, fbb = F.fogB || 0, camZ = cam.z, noFlash = !!GFX.noFlash;
    let drawn = 0;
    for (let i = 0; i < n; i++) {
      const sx = px_[i] - cam.x, sy = py_[i] - cam.y;
      const trY = inv * (-plY * sx + plX * sy);
      if (trY <= 0.12 || trY > fogD * 1.1) continue;
      const trX = inv * (dirY * sx - dirX * sy);
      const scx = (w * 0.5) * (1 + trX / trY), scy = hor + (camZ - pz_[i]) * h / trY;
      const kind = kind_[i];
      if (kind === 2) {
        // a droplet: one or two pixels, a streak while it climbs fast
        const sz = Math.max(1, (0.03 * h / trY) | 0), x0 = scx | 0, y0 = scy | 0;
        if (x0 + sz < 0 || x0 >= w || y0 + sz < 0 || y0 >= h) continue;
        const f = outdoor ? Math.max(0.25, 1 - trY / fogD) * light : Math.max(0.3, amb + (1 - amb) * (1 - trY / fogD));
        const cr = noFlash ? 130 : 200, cg = noFlash ? 160 : 228, cb = noFlash ? 180 : 245;
        const a = 0.85 * (1 - age_[i] / life_[i] * 0.5);
        const streak = vz_[i] > 1.2 ? 1 : 0;
        for (let yy = y0 - streak * sz; yy < y0 + sz; yy++) {
          if (yy < 0 || yy >= h) continue;
          for (let xx = x0; xx < x0 + sz; xx++) {
            if (xx < 0 || xx >= w) continue;
            const o = yy * w + xx; if (dbuf[o] <= trY) continue;
            const px = fb[o], r = px & 255, g = (px >> 8) & 255, b = (px >> 16) & 255;
            fb[o] = (255 << 24) | (((b + (cb * f - b) * a) | 0) << 16) | (((g + (cg * f - g) * a) | 0) << 8) | ((r + (cr * f - r) * a) | 0);
          }
        }
        drawn++;
        continue;
      }
      const t = age_[i] / life_[i], rw = r0_[i] + (r1_[i] - r0_[i]) * Math.sqrt(t);
      let R = rw * h / trY; if (R < 0.7) continue; if (R > 36 * S) R = 36 * S;
      const fadeIn = Math.min(1, t / 0.12), A = a_[i] * fadeIn * (1 - t);
      if (A < 0.012) continue;
      if (scx + R < 0 || scx - R >= w || scy + R < 0 || scy - R >= h) continue;
      // colour: the puff takes the light of the place and the fog of the distance
      let br, bg, bb;
      if (kind === 1) { br = 232; bg = 236; bb = 240; } else { br = 168; bg = 164; bb = 168; }
      const f = Math.max(0, 1 - trY / fogD);
      let cr, cg, cb;
      if (outdoor) { cr = (br * f + fr * (1 - f)) * light; cg = (bg * f + fg * (1 - f)) * light; cb = (bb * f + fbb * (1 - f)) * light; }
      else { const v = amb + (1 - amb) * f * 0.7; cr = br * v; cg = bg * v; cb = bb * v; }
      const wm = warm_[i] * (1 - t) * (1 - t); if (wm > 0.01) { cr += 120 * wm; cg += 58 * wm; cb += 12 * wm; }
      const x0 = Math.max(0, Math.floor(scx - R)), x1 = Math.min(w - 1, Math.ceil(scx + R)), y0 = Math.max(0, Math.floor(scy - R)), y1 = Math.min(h - 1, Math.ceil(scy + R));
      const R2 = R * R, invR2 = 1 / R2, sd = seed_[i];
      for (let y = y0; y <= y1; y++) {
        const dy = y - scy, dy2 = dy * dy; let o = y * w + x0;
        for (let x = x0; x <= x1; x++, o++) {
          const dx = x - scx, d2 = dx * dx + dy2; if (d2 >= R2) continue;
          if (dbuf[o] <= trY) continue;
          const q = 1 - d2 * invR2, a = A * q * noise[(x * 5 + y * 11 + sd) & 63];
          const px = fb[o], r = px & 255, g = (px >> 8) & 255, b = (px >> 16) & 255;
          fb[o] = (255 << 24) | ((Math.min(255, b + (cb - b) * a) | 0) << 16) | ((Math.min(255, g + (cg - g) * a) | 0) << 8) | (Math.min(255, r + (cr - r) * a) | 0);
        }
      }
      drawn++;
    }
    stats.drawn = drawn;
  }

  // ---------------------------------------------------------------- hook
  let lastT = null, lastMap = null, held = false, calm = 0;
  function active() { return !!(GFX.smoke || GFX.splashes); }
  function hook(F) {
    if (!active()) { if (n) clearAll(); lastT = null; return; }
    if (typeof G === 'undefined' || !G || G.state === 'title' || !F.map) return;
    stats.calls++;
    if (F.map !== lastMap) { lastMap = F.map; clearAll(); pHave = false; scanT = 0; }
    if (F.skyDay != null) lastSkyDay = F.outdoor ? F.skyDay : 0.5;
    const T = F.animT;
    let dt = lastT == null ? 0 : T - lastT;
    if (!(dt >= 0) || dt > 0.5) { if (dt > 0.5 || dt < -0.01) clearAll(); dt = 0; }
    lastT = T;
    if (dt > 0.1) dt = 0.1;
    if (!held && dt > 0) { setWind(T); spawnPass(dt, T); simulate(dt); }
    if (n) draw(F);
  }
  if (typeof Engine !== 'undefined' && Engine.addPostHook) {
    Engine.addPostHook((F) => { try { hook(F); } catch (err) { if (!hook.warned) { hook.warned = true; console.warn('firesmoke hook failed', err); } } }, 8);
  }

  // ---------------------------------------------------------------- wiring
  if (typeof Engine !== 'undefined') buildSprites();
  if (typeof GFX.onChange === 'function') GFX.onChange(() => { try { sync(); if (!GFX.smoke && !GFX.splashes) clearAll(); } catch (e) { /* never break a frame */ } });
  if (typeof buildAllMaps === 'function') {
    const _build = buildAllMaps;
    buildAllMaps = function () { const maps = _build(); for (const id in maps) { try { placeMap(maps[id]); } catch (err) { console.warn('firesmoke placement failed on ' + id, err); } } sync(maps); return maps; };
  }
  if (typeof loadMap === 'function') {
    const _load = loadMap;
    loadMap = function (id, pos) { const r = _load(id, pos); try { ensure(G.map); clearAll(); pHave = false; lastMap = G.map; } catch (e) { /* never break a frame */ } return r; };
  }
  if (typeof update === 'function') {
    const _update = update;
    update = function (dt) { if (shown.smoke !== GFX.smoke || shown.torches !== GFX.torches) { try { sync(); } catch (e) { /* ignore */ } } return _update(dt); };
  }
  if (typeof Engine !== 'undefined') {
    const _render = Engine.render;
    Engine.render = function (ents, tod, opts) { if (shown.smoke !== GFX.smoke || shown.torches !== GFX.torches) { try { sync(); } catch (e) { /* ignore */ } } return _render.call(Engine, ents, tod, opts); };
  }

  return {
    stats, PLANS, findChimneys, planFires, placeMap, sync, ensure, splash: splashAt, drops, spawn, simulate, spawnPass,
    hold(on) { held = !!on; lastT = null; },
    reset() { clearAll(); lastT = null; pHave = false; rs = 0x9E3779B9; },
    seed(v) { rs = v | 0; },
    get count() { return n; },
    countKind(k) { let c = 0; for (let i = 0; i < n; i++) if (kind_[i] === k) c++; return c; },
    // read-only view of the live particles, for tests
    each(fn) { for (let i = 0; i < n; i++) fn({ kind: kind_[i], x: px_[i], y: py_[i], z: pz_[i], age: age_[i], life: life_[i], r0: r0_[i], r1: r1_[i], a: a_[i], warm: warm_[i], seed: seed_[i] }); },
    tick(dt, T) { lastMap = G.map; setWind(T == null ? 0 : T); spawnPass(dt, T == null ? 0 : T); simulate(dt); },
    draw,
    cost() { return stats; },
  };
})();
