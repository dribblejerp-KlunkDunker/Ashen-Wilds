// ============================================================
//  MAPS — Oakhaven, its interiors, the clearing, the Quarry, the Root-vault
// ============================================================
'use strict';

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const WALL = (tex) => ({ tex });
const DOOR = (opts) => Object.assign({ tex: 't_door', door: true }, opts || {});

// ---- people height ---------------------------------------------------------
// The player's own figure is one tile tall ("one tile tall like a standing
// townsperson"), and the folk of the world stand around that measure: most within
// a hand's width of it, a few notably taller or shorter. Children and animals
// carry their own scale in NPCS and are never touched here; so do the named cast
// whose stature is part of who they are. The playable likenesses, the party and
// the co-op figures keep exactly one tile - they ARE the measure. The height is
// hashed from the body's id and place (never Math.random: the shared stream
// stays as the settlers keep it), so a person keeps their stature across saves
// and on both sides of a co-op session.
const HERO_SPRITES = { kaelen: 1, lyra: 1, vane: 1, sable: 1, rooke: 1, mags: 1 };
function varyNpcHeight(e) {
  if (!e || e.kind !== 'npc' || e._hgt) return e;
  e._hgt = 1;
  if (e.companion || e.p19fig || e.p17pComp || HERO_SPRITES[e.sprite]) return e;
  if (e.scale != null && e.scale !== 1) return e;        // authored: children, animals, the named cast
  const s = (e.id || e.sprite || '') + '|' + (+e.x || 0).toFixed(2) + ',' + (+e.y || 0).toFixed(2);
  let h = 0x811c9dc5 | 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  e.scale = 0.92 + (((h >>> 0) % 1024) / 1024) * 0.16;
  return e;
}

class GameMap {
  constructor(id, name, w, h, opts) {
    this.id = id; this.name = name; this.w = w; this.h = h;
    this.cells = new Array(w * h).fill(null);
    this.doors = {};
    this.floor = opts.floor || 't_flag'; this.ceil = opts.ceil || null; this.outdoor = !!opts.outdoor;
    this.fogDist = opts.fogDist || 12; this.fogColor = opts.fogColor || [0, 0, 0]; this.ambient = opts.ambient || 0;
    this.floorTextures = opts.floorTextures || null; this.floorCells = opts.floorTextures ? new Uint8Array(w * h) : null;
    this.entities = []; this.spawn = opts.spawn || { x: 2.5, y: 2.5, dir: 0 };
    this.siphoned = !!opts.siphoned; this.danger = opts.danger || 0; this.music = opts.music || 'town';
    this.visited = new Uint8Array(w * h);
    this.triggers = [];
    // Floor elevation, one height per cell, in world units (eye height = 0.88).
    // Null on flat maps so they keep the fast render path untouched.
    this.lvls = null;
    // Sloped ground: heights at cell corners ((w+1) x (h+1)) and a mask of the
    // cells that blend them. Null until a map shapes a hill or a ramp.
    this.verts = null; this.smooth = null;
    // Optional per-cell texture for the side faces of raised ground (a stone
    // skirt under a grass knoll, timber under a stand). Null = the top texture.
    this.sideTex = null;
  }
  set(x, y, c) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) { this.cells[y * this.w + x] = c; if (c && c.door) this.doors[y * this.w + x] = { open: 0, target: 0 }; } }
  get(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? WALL('t_stone') : this.cells[y * this.w + x]; }
  setFloor(x, y, idx) { if (this.floorCells && x >= 0 && y >= 0 && x < this.w && y < this.h) this.floorCells[y * this.w + x] = idx; }
  rect(x0, y0, x1, y1, tex) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, WALL(tex)); }
  clear(x0, y0, x1, y1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, null); }
  border(tex) { for (let x = 0; x < this.w; x++) { this.set(x, 0, WALL(tex)); this.set(x, this.h - 1, WALL(tex)); } for (let y = 0; y < this.h; y++) { this.set(0, y, WALL(tex)); this.set(this.w - 1, y, WALL(tex)); } }
  isSolidCell(x, y) { const c = this.get(x, y); if (!c) return false; if (c.door) { const d = this.doors[y * this.w + x]; return !(d && d.open > 0.7); } return true; }
  isBlocked(x, y) { if (this.isSolidCell(x, y)) return true; return !!(this.floorCells && x >= 0 && y >= 0 && x < this.w && y < this.h && this.floorCells[y * this.w + x] === 2); }
  // --- elevation ---------------------------------------------------------
  ensureLvls() { if (!this.lvls) this.lvls = new Float32Array(this.w * this.h); return this.lvls; }
  lvlAt(x, y) { return this.groundAt(x, y); }
  // The height of the ground at a world point: sloped cells blend their four
  // corners, every other cell is flat at its own level.
  groundAt(x, y) {
    if (!this.lvls && !this.smooth) return 0;
    const cx = Math.floor(x), cy = Math.floor(y);
    if (cx < 0 || cy < 0 || cx >= this.w || cy >= this.h) return 0;
    const i = cy * this.w + cx;
    if (this.smooth && this.smooth[i]) {
      const fx = Math.min(1, Math.max(0, x - cx)), fy = Math.min(1, Math.max(0, y - cy)), W1 = this.w + 1, v = cy * W1 + cx, V = this.verts;
      return (V[v] * (1 - fx) + V[v + 1] * fx) * (1 - fy) + (V[v + W1] * (1 - fx) + V[v + W1 + 1] * fx) * fy;
    }
    return this.lvls ? this.lvls[i] : 0;
  }
  // How steep the ground is at a point, as rise per unit run (0 on flat cells).
  gradeAt(x, y) {
    if (!this.smooth) return 0;
    const cx = Math.floor(x), cy = Math.floor(y);
    if (cx < 0 || cy < 0 || cx >= this.w || cy >= this.h || !this.smooth[cy * this.w + cx]) return 0;
    const fx = Math.min(1, Math.max(0, x - cx)), fy = Math.min(1, Math.max(0, y - cy)), W1 = this.w + 1, v = cy * W1 + cx, V = this.verts;
    const a = V[v], b = V[v + 1], c = V[v + W1], d = V[v + W1 + 1];
    const gx = (b - a) * (1 - fy) + (d - c) * fy, gy = (c - a) * (1 - fx) + (d - b) * fx;
    return Math.hypot(gx, gy);
  }
  ensureVerts() {
    if (!this.verts) { this.verts = new Float32Array((this.w + 1) * (this.h + 1)); this.smooth = new Uint8Array(this.w * this.h); }
    return this.verts;
  }
  // Re-derive which cells are sloped and give each a coarse per-cell level
  // (its centre height) for code that only reads one height per cell.
  syncSlopes(x0, y0, x1, y1) {
    const V = this.ensureVerts(), L = this.ensureLvls(), W1 = this.w + 1;
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(this.w - 1, x1); y1 = Math.min(this.h - 1, y1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const v = y * W1 + x, a = V[v], b = V[v + 1], c = V[v + W1], d = V[v + W1 + 1];
      const i = y * this.w + x;
      // any cell a hill or ramp has touched follows its corners, including the
      // flat top of a crag where all four corners agree
      if (Math.max(a, b, c, d) > 0.001 || Math.min(a, b, c, d) < -0.001 || this.smooth[i]) { this.smooth[i] = 1; L[i] = (a + b + c + d) / 4; }
    }
  }
  // A rounded hill (or, with `steep`, a crag with cliff-like flanks) centred
  // on (cx, cy), radii rx/ry in cells, `height` above `base`. Overlapping
  // hills keep the higher ground, so ranges are built from several.
  hill(cx, cy, rx, ry, height, opts) {
    opts = opts || {};
    const V = this.ensureVerts(), W1 = this.w + 1, base = opts.base || 0, steep = opts.steep || 0;
    const x0 = Math.floor(cx - rx) - 1, x1 = Math.ceil(cx + rx) + 1, y0 = Math.floor(cy - ry) - 1, y1 = Math.ceil(cy + ry) + 1;
    for (let vy = Math.max(0, y0); vy <= Math.min(this.h, y1); vy++) for (let vx = Math.max(0, x0); vx <= Math.min(this.w, x1); vx++) {
      const d = Math.hypot((vx - cx) / rx, (vy - cy) / ry); if (d >= 1) continue;
      // a soft dome, or a flat-topped crag whose last `steep` of radius is its flank
      const k = steep ? Math.min(1, (1 - d) / steep) : 0.5 + 0.5 * Math.cos(Math.PI * d);
      const s = steep ? k * k * (3 - 2 * k) : k;
      const z = base + height * s, j = vy * W1 + vx;
      if (z > V[j]) V[j] = z;
    }
    this.syncSlopes(x0, y0, x1, y1);
  }
  // A straight ramp over a rectangle of cells, rising from h0 to h1 along x or y.
  ramp(x0, y0, x1, y1, h0, h1, axis) {
    const V = this.ensureVerts(), W1 = this.w + 1;
    for (let vy = y0; vy <= y1 + 1; vy++) for (let vx = x0; vx <= x1 + 1; vx++) {
      const k = axis === 'y' ? (vy - y0) / (y1 + 1 - y0) : (vx - x0) / (x1 + 1 - x0);
      V[vy * W1 + vx] = h0 + (h1 - h0) * k;
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.smooth[y * this.w + x] = 1;
    this.syncSlopes(x0, y0, x1, y1);
  }
  // Texture for the side faces of raised cells in a rectangle.
  setSide(x0, y0, x1, y1, tex) {
    if (!this.sideTex) this.sideTex = new Array(this.w * this.h).fill(null);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.sideTex[y * this.w + x] = tex;
  }
  // A wall block with its own absolute top: low walls and parapets you see
  // over, plinths, or tall towers and roof ridges that stand above the rest.
  block(x, y, tex, top, opts) { const c = Object.assign({ tex, top }, opts || {}); this.set(x, y, c); return c; }
  lowWall(x0, y0, x1, y1, tex, top, opts) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.block(x, y, tex, top, opts); }
  setLvl(x, y, h) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.ensureLvls()[y * this.w + x] = h; }
  raise(x0, y0, x1, y1, h) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.setLvl(x, y, h); }
  add(e) { this.entities.push(e); return e; }
  deco(sprite, x, y, opts) { return this.add(Object.assign({ kind: 'deco', sprite, x, y, solid: true, radius: 0.35 }, opts || {})); }
  npc(id, x, y, opts) { return this.add(Object.assign({ kind: 'npc', id, x, y, sprite: NPCS[id].sprite, scale: NPCS[id].scale || 1, solid: true, radius: 0.35 }, opts || {})); }
  item(item, x, y) { return this.add({ kind: 'item', item, x, y, sprite: ITEMS[item].sprite, scale: 0.35, yOff: 0.0, solid: false }); }
  enemy(type, x, y, opts) { return this.add(Object.assign({ kind: 'enemy', type, x, y }, opts || {})); }
  trigger(x, y, r, id, opts) { this.triggers.push(Object.assign({ x, y, r, id, done: false }, opts || {})); }
}

// A compact playable gaol; existing mechanical locks provide the escape route.
function buildWatchhouse() {
  const m = new GameMap('watchhouse', 'Oakhaven Watch-house', 14, 10, {
    floor: 't_flag', ceil: 't_stone', fogDist: 14, ambient: 0.18, music: 'inside',
    spawn: { x: 3.5, y: 4.5, dir: 0 },
  });
  m.border('t_stone'); m.rect(5, 1, 5, 8, 't_stone');
  m.set(5, 4, DOOR({ lockDifficulty: 2, label: 'Watch-house cell lock — pick to escape' }));
  m.set(12, 4, DOOR({ portal: { map: 'oakhaven', x: 39.5, y: 6.5, dir: Math.PI / 2 }, label: 'Street door — leaving in custody is escape (+60 bounty)' }));
  // Wall behind the street door prevents walking around its portal trigger.
  m.rect(12, 1, 12, 3, 't_stone'); m.rect(12, 5, 12, 8, 't_stone');
  m.deco('bed', 2.5, 3.5, { solid: false, use: 'prison_bunk', label: 'Cell bunk — serve sentence or pay fine' });
  m.deco('chest', 8.5, 3.5, { solid: false, scale: 0.6, use: 'prison_evidence', label: 'Locked evidence chest — recover confiscated belongings' });
  m.deco('lamp', 3.5, 2.5, { solid: false, scale: 0.6, glow: 0.8 });
  m.deco('lamp', 9.5, 6.5, { solid: false, scale: 0.6, glow: 0.8 });
  m.deco('sign', 10.5, 2.5, { solid: false, use: 'prison_bunk', label: 'Watch-house sentence registry' });
  m.baseCount = m.entities.length;
  return m;
}
function addLawWorld(maps) {
  maps.watchhouse = buildWatchhouse();
  const oh = maps.oakhaven;
  // Reuse the granary facade rather than changing streets or historical indexes.
  oh.set(40, 6, DOOR({ portal: { map: 'watchhouse', x: 10.5, y: 4.5, dir: Math.PI }, label: 'Oakhaven watch-house and evidence office' }));
  for (const [x, y] of [[25.5, 19.5], [39.5, 8.5]]) oh.deco('sign', x, y, { solid: false, scale: 0.85, use: 'wanted_poster', wantedPoster: true, hidden: true, label: 'Wanted by the Oakhaven watch — read warrant' });
  oh.npc('townsman', 23.5, 9.5, { lawGuard: true, wander: true, name: 'North-road watch constable' });
  for (const id of ['tavern', 'greenhall', 'mill', 'surgery', 'chapel', 'tannery']) {
    const m = maps[id]; if (!m) continue;
    const owner = m.entities.find(e => e.kind === 'npc');
    // Deterministic, nonblocking owned stock beside an inhabitant (or spawn).
    const anchor = owner || m.spawn;
    const spots = [];
    for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) {
      if (m.get(x, y) || m.isBlocked(x, y) || m.entities.some(e => dist2(e.x, e.y, x + 0.5, y + 0.5) < 1)) continue;
      spots.push({ x: x + 0.5, y: y + 0.5 });
    }
    spots.sort((a, b) => dist2(a.x, a.y, anchor.x, anchor.y) - dist2(b.x, b.y, anchor.x, anchor.y));
    if (!spots.length) throw new Error('No safe law placement in ' + id);
    const spot = spots[0], item = id === 'surgery' ? 'tonic' : 'honey';
    Object.assign(m.item(item, spot.x, spot.y), { owner: id, label: ITEMS[item].name + ' — owned stock (theft)' });
    if (['tavern', 'greenhall', 'mill'].includes(id)) {
      const guardSpot = spots.find(s => dist2(s.x, s.y, spot.x, spot.y) >= 4 && dist2(s.x, s.y, m.spawn.x, m.spawn.y) >= 4);
      if (!guardSpot) throw new Error('No safe guard placement in ' + id);
      m.npc('townsman', guardSpot.x, guardSpot.y, { lawGuard: true, name: 'Parish watch constable' });
    }
    m.baseCount = m.entities.length;
  }
  // Stable sign beside the North Gate square; appended last so historical indexes stay put.
  let stall = null;
  for (let r = 2; r <= 10 && !stall; r++) for (let a = 0; a < 32 && !stall; a++) {
    const x = Math.round(oh.spawn.x + Math.cos(a / 32 * Math.PI * 2) * r), y = Math.round(oh.spawn.y + Math.sin(a / 32 * Math.PI * 2) * r);
    if (x < 2 || y < 2 || x >= oh.w - 2 || y >= oh.h - 2) continue;
    if (oh.get(x, y) || oh.isBlocked(x, y)) continue;
    if (oh.entities.some(e => dist2(e.x, e.y, x + 0.5, y + 0.5) < 1.3)) continue;
    stall = { x: x + 0.5, y: y + 0.5 };
  }
  if (!stall) throw new Error('No safe stable placement in Oakhaven');
  oh.deco('sign', stall.x, stall.y, { solid: false, scale: 0.85, use: 'stable', label: 'North Gate stables — hire or return a horse' });
  oh.baseCount = oh.entities.length;
}

// -------------------------------------------------------------------------
//  OAKHAVEN
// -------------------------------------------------------------------------
function buildOakhaven(greening) {
  const W = 70, H = 64;
  const m = new GameMap('oakhaven', greening ? 'Oakhaven — the Greening' : 'Oakhaven', W, H, {
    outdoor: true, floor: 't_grass', floorTextures: ['t_grass', 't_cobble', 't_water'], fogDist: greening ? 18 : 22, fogColor: greening ? [62, 84, 58] : [70, 72, 80], music: 'town', danger: greening ? 2 : 0,
    spawn: { x: 23.5, y: 3.5, dir: Math.PI / 2 },
  });
  // Hedge — thick
  for (let i = 0; i < 2; i++) { m.rect(i, i, W - 1 - i, i, 't_hedge'); m.rect(i, H - 1 - i, W - 1 - i, H - 1 - i, 't_hedge'); m.rect(i, i, i, H - 1 - i, 't_hedge'); m.rect(W - 1 - i, i, W - 1 - i, H - 1 - i, 't_hedge'); }
  // Roads (cobbles): main N-S road, E-W road, square
  const road = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.setFloor(x, y, 1); };
  road(22, 2, 24, 60); road(3, 22, 66, 24); road(17, 17, 29, 29); road(8, 10, 10, 36); road(36, 8, 38, 36); road(10, 10, 36, 11); road(10, 35, 36, 36);
  // east district: Carders' Lane and the market
  road(52, 4, 54, 60); road(46, 14, 60, 21); road(44, 10, 52, 11); road(44, 35, 52, 36);
  // south district: Tannery Row and the water-meadow lane
  road(6, 54, 44, 55); road(10, 44, 11, 54); road(36, 44, 38, 54);
  // the Chlorophyll Flume: a green aqueduct-river across the south, bridged at the two lanes
  for (let x = 2; x < W - 2; x++) for (let y = 49; y <= 50; y++) m.setFloor(x, y, 2);
  for (let x = 21; x <= 25; x++) for (let y = 49; y <= 50; y++) m.setFloor(x, y, 1);
  for (let x = 51; x <= 55; x++) for (let y = 49; y <= 50; y++) m.setFloor(x, y, 1);
  for (const [a, b] of [[9, 12], [35, 39]]) for (let x = a; x <= b; x++) for (let y = 49; y <= 50; y++) m.setFloor(x, y, 1);
  m.rect(20, 49, 20, 50, 't_stone'); m.rect(26, 49, 26, 50, 't_stone'); m.rect(50, 49, 50, 50, 't_stone'); m.rect(56, 49, 56, 50, 't_stone'); // bridge piers
  m.rect(8, 49, 8, 50, 't_stone'); m.rect(13, 49, 13, 50, 't_stone'); m.rect(34, 49, 34, 50, 't_stone'); m.rect(40, 49, 40, 50, 't_stone');
  // North gate
  m.set(23, 0, DOOR({ portal: { map: 'clearing', x: 20.5, y: 32.5, dir: -Math.PI / 2 }, label: 'The North Gate', locked: 'gate_open', lockMsg: 'The gate is barred. Old Harrow keeps the key, and he keeps it on the Cantor\'s word.' }));
  m.set(23, 1, null); m.set(22, 1, WALL('t_hedge')); m.set(24, 1, WALL('t_hedge'));

  // Buildings: [x,y,w,h, tex, doorX, doorY, portal spec]
  const buildings = [
    { x: 26, y: 12, w: 8, h: 5, tex: 't_house', door: [29, 16], portal: { map: 'tavern', x: 8.5, y: 10.5, dir: -Math.PI / 2 }, label: 'The Boar & Dulcimer' },
    { x: 19, y: 30, w: 6, h: 4, tex: 't_house', door: [21, 30], portal: { map: 'lyra_house', x: 6.5, y: 7.5, dir: -Math.PI / 2 }, label: 'Lyra Ashgrove\'s house' },
    { x: 26, y: 4, w: 9, h: 5, tex: 't_marble', door: [30, 8], portal: { map: 'greenhall', x: 8.5, y: 10.5, dir: -Math.PI / 2 }, label: 'The Greenhall' },
    { x: 12, y: 13, w: 5, h: 4, tex: 't_wood', door: [16, 15], portal: { map: 'surgery', x: 1.5, y: 5.5, dir: 0 }, label: 'Rooke\'s surgery' },
    { x: 30, y: 38, w: 5, h: 4, tex: 't_wood', door: [30, 40], portal: { map: 'orla_house', x: 8.5, y: 5.5, dir: Math.PI }, label: 'Orla Hale\'s house' },
    // non-enterable houses
    { x: 4, y: 4, w: 5, h: 4, tex: 't_house', door: [6, 7], barred: true, label: 'A shuttered house' },
    { x: 12, y: 4, w: 5, h: 4, tex: 't_house', door: [14, 7], barred: true, label: 'The baker\'s' },
    { x: 36, y: 4, w: 3, h: 4, tex: 't_house', door: [37, 7], barred: true, label: 'A shuttered house' },   // the Carders live behind the tannery (MS ch. 6; js/hollow30.js)
    { x: 40, y: 4, w: 4, h: 5, tex: 't_wood', door: [40, 6], barred: true, label: 'A granary' },
    { x: 4, y: 14, w: 3, h: 6, tex: 't_wood', door: [6, 16], barred: true, label: 'A cooper\'s shed' },
    { x: 4, y: 27, w: 3, h: 6, tex: 't_house', door: [6, 29], barred: true, label: 'The Madders\' house' },
    { x: 12, y: 27, w: 4, h: 6, tex: 't_house', door: [15, 29], barred: true, label: 'Cooper\'s Row' },
    { x: 12, y: 38, w: 8, h: 4, tex: 't_wood', door: [16, 38], barred: true, label: 'The dyer\'s' },
    // --- east district: the Carders' Quarter ---
    { x: 58, y: 6, w: 8, h: 6, tex: 't_wood', door: [58, 9], portal: { map: 'mill', x: 2.0, y: 6.5, dir: 0 }, label: 'The Carders\' mill' },
    { x: 46, y: 4, w: 6, h: 6, tex: 't_marble', door: [48, 9], portal: { map: 'chapel', x: 6.5, y: 11.5, dir: -Math.PI / 2 }, label: 'The Chapel of the Carillon' },
    { x: 62, y: 14, w: 5, h: 5, tex: 't_house', door: [62, 16], barred: true, label: 'The wool-factor\'s' },
    { x: 46, y: 27, w: 5, h: 4, tex: 't_house', door: [48, 27], barred: true, label: 'Nell Carder\'s sister\'s' },
    { x: 62, y: 27, w: 5, h: 6, tex: 't_wood', door: [62, 29], barred: true, label: 'The orchard store' },
    { x: 46, y: 39, w: 5, h: 4, tex: 't_house', door: [48, 39], barred: true, label: 'A shuttered house' },
    { x: 58, y: 39, w: 6, h: 4, tex: 't_house', door: [60, 39], barred: true, label: 'The Sowerbys\' — empty' },
    // --- south district: Tannery Row and the Flume ---
    { x: 12, y: 57, w: 7, h: 4, tex: 't_wood', door: [15, 57], portal: { map: 'tannery', x: 7.5, y: 2.0, dir: Math.PI / 2 }, label: 'The tannery' },
    { x: 4, y: 57, w: 5, h: 4, tex: 't_house', door: [6, 57], barred: true, label: 'The Fenning twins\' house — empty' },
    { x: 27, y: 57, w: 6, h: 4, tex: 't_house', door: [29, 57], barred: true, label: 'Old Tam\'s' },
    { x: 40, y: 57, w: 5, h: 4, tex: 't_wood', door: [42, 57], barred: true, label: 'A hay-barn' },
    { x: 4, y: 45, w: 4, h: 3, tex: 't_wood', door: [7, 46], barred: true, label: 'The fulling-shed' },
    { x: 14, y: 45, w: 5, h: 3, tex: 't_house', door: [16, 47], barred: true, label: 'The Madders\' washhouse' },
    { x: 26, y: 30, w: 6, h: 4, tex: 't_house', door: [28, 30], barred: true, label: 'Bettany\'s' },
    { x: 40, y: 14, w: 3, h: 6, tex: 't_house', door: [40, 16], barred: true, label: 'A shuttered house' },
    { x: 40, y: 27, w: 3, h: 6, tex: 't_wood', door: [40, 29], barred: true, label: 'The chandler\'s' },
    { x: 4, y: 38, w: 5, h: 4, tex: 't_house', door: [8, 40], barred: true, label: 'Abner Fenning\'s' },
    { x: 38, y: 38, w: 5, h: 4, tex: 't_house', door: [38, 40], barred: true, label: 'A shuttered house' },
  ];
  for (const b of buildings) {
    m.rect(b.x, b.y, b.x + b.w - 1, b.y + b.h - 1, b.tex);
    const d = DOOR({ portal: b.portal, label: b.label });
    if (b.barred) { d.locked = '__never'; d.lockMsg = `${b.label}. The door is barred from within, and somebody inside is humming.`; }
    m.set(b.door[0], b.door[1], d);
    // cobble apron in front of each door
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) m.setFloor(b.door[0] + dx, b.door[1] + dy, 1);
    // stepped roofs: the inner cells of a building rise above its eaves, with
    // a ridge along the long axis, so the town has a broken roofline
    if (b.w >= 3 && b.h >= 3) {
      const along = b.w >= b.h, ridge = along ? b.y + (b.h >> 1) : b.x + (b.w >> 1);
      const roof = b.tex === 't_marble' ? 't_marble' : 't_roof';
      for (let y = b.y + 1; y <= b.y + b.h - 2; y++) for (let x = b.x + 1; x <= b.x + b.w - 2; x++) {
        const onRidge = along ? y === ridge || (b.h % 2 === 0 && y === ridge - 1) : x === ridge || (b.w % 2 === 0 && x === ridge - 1);
        m.block(x, y, roof, onRidge ? 1.7 : 1.35, { capTex: 't_roof' });
      }
    }
  }
  // Mooring mast (east): a wooden pylon with crates
  m.rect(36, 19, 37, 20, 't_wood');
  m.deco('crates', 35.5, 21.5); m.deco('ladder', 38.5, 21.5, { radius: 0.2, scale: 1.6, use: 'crates', label: 'The Drift-Kestrel\'s mast-ladder, up to her hold' });   // the corsair's cargo is in his own hold (Book One ch. 4, 8)
  m.trigger(36.5, 22.5, 2.2, 'mast');
  // Tannery culvert through the south hedge — the Wearer's spot, and the way down to the Under-hedge
  m.set(23, H - 2, DOOR({ portal: { map: 'underhedge', useSpawn: true }, label: 'The tannery culvert', locked: 'culvert_open', lockMsg: 'A grate over the culvert, rusted shut. Somebody with a tanner\'s key could open it.' }));
  m.deco('grate', 23.5, 61.2, { radius: 0.3, scale: 0.8, solid: false, nopick: true });
  m.trigger(23.5, 59.5, 2.5, 'hedge_voice');
  // Flume crossing — Old Tam's spot
  m.deco('sign', 55.5, 47.5, { radius: 0.2 });
  // market stalls
  for (const [x, y] of [[48.5, 16.5], [51.5, 16.5], [55.5, 16.5], [48.5, 19.5], [55.5, 19.5]]) m.deco('table', x, y, { radius: 0.5, scale: 0.7 });
  m.deco('crates', 58.5, 16.5, { radius: 0.35 }); m.deco('crates', 58.5, 19.5, { radius: 0.35 });
  // the empty bell-plinth in front of the chapel
  m.rect(49, 11, 49, 11, 't_stone');
  m.deco('pump', 44.5, 48.5, { radius: 0.4, scale: 0.9, label: 'A Flume sluice' });
  // Oaks
  const rnd = mulberry32(7);
  const oakSpots = [[14.5, 20.5], [31.5, 20.5], [9.5, 8.5], [36.5, 30.5], [14.5, 25.5], [31.5, 26.5], [19.5, 42.5], [6.5, 11.5], [38.5, 11.5], [27.5, 42.5], [6.5, 24.5], [40.5, 24.5], [29.5, 37.5], [16.5, 32.5]];
  for (const [x, y] of oakSpots) m.deco('oak', x, y, { scale: 1.6 + rnd() * 0.5, radius: 0.45, yOff: -0.02 });
  // the Governor's orchard (east) in rows, and a few meadow trees (south)
  for (const [x, y] of [[47.5, 32.5], [50.5, 32.5], [56.5, 32.5], [59.5, 32.5], [48.5, 37.5], [56.5, 37.5], [60.5, 36.5], [64.5, 36.5], [64.5, 22.5], [60.5, 25.5], [47.5, 44.5], [58.5, 45.5]]) m.deco('oak', x, y, { scale: 1.7 + rnd() * 0.4, radius: 0.45, yOff: -0.02 });
  for (const [x, y] of [[33.5, 46.5], [60.5, 54.5], [64.5, 58.5], [48.5, 57.5], [30.5, 52.5], [8.5, 51.5]]) m.deco('oak', x, y, { scale: 1.5 + rnd() * 0.6, radius: 0.45, yOff: -0.02 });
  if (greening) {
    const extra = [[23.5, 14.5], [20.5, 22.5], [26.5, 22.5], [23.5, 33.5], [10.5, 22.5], [34.5, 23.5], [23.5, 6.5], [15.5, 11.5], [50.5, 17.5], [53.5, 24.5], [23.5, 47.5], [53.5, 47.5], [40.5, 23.5]];
    const free = (x, y, r) => [[-r, -r], [r, -r], [-r, r], [r, r], [0, 0]].every(([dx, dy]) => !m.isBlocked((x + dx) | 0, (y + dy) | 0));
    for (const [x, y] of extra) if (free(x, y, 0.5)) m.deco('oak', x, y, { scale: 2.4 + rnd() * 0.8, radius: 0.5 });
    for (let n = 0, i = 0; n < 14 && i < 200; i++) { const x = 4 + rnd() * 62, y = 4 + rnd() * 56; if (free(x, y, 0.4) && Math.hypot(x - 36.5, y - 22.5) > 5) { m.enemy('hound', x, y); n++; } }
    m.enemy('hound', 23.5, 12.5); m.enemy('hound', 30.5, 23.5); m.enemy('hound', 23.5, 27.5);
    for (let n = 0, i = 0; n < 8 && i < 200; i++) { const x = 4 + rnd() * 62, y = 4 + rnd() * 56; if (free(x, y, 0.4)) { m.add({ kind: 'deco', sprite: 'burlsick', x, y, solid: true, radius: 0.3, wander: true, scale: 1 }); n++; } }
  } else {
    // Hush-lamps along the main road and square
    for (const [x, y] of [[21.5, 12.5], [25.5, 12.5], [21.5, 19.5], [25.5, 27.5], [21.5, 35.5], [25.5, 35.5], [16.5, 23.5], [30.5, 23.5], [9.5, 23.5], [37.5, 23.5], [23.5, 40.5],
      [47.5, 14.5], [57.5, 21.5], [51.5, 25.5], [51.5, 12.5], [55.5, 40.5], [21.5, 47.5], [25.5, 52.5], [51.5, 52.5], [55.5, 47.5], [13.5, 53.5], [31.5, 53.5], [21.5, 58.5], [25.5, 58.5]]) m.deco('lamp', x, y, { radius: 0.15, scale: 0.9, glow: 0.55 });
    // NPCs
    m.npc('harrow', 23.5, 4.5, { facing: Math.PI / 2 });
    m.npc('bettany', 51.5, 17.6, { facing: Math.PI / 2 });
    m.npc('tam', 54.2, 47.6, { facing: Math.PI / 2 });
    m.npc('hob', 15.5, 55.5, { wander: true });
    m.npc('townsman', 50.5, 32.5, { wander: true }); m.npc('townsman', 58.5, 36.5, { wander: true }); m.npc('townswoman', 49.5, 20.5, { wander: true }); m.npc('townswoman', 56.5, 15.5, { wander: true });
    m.npc('townsman', 30.5, 55.5, { wander: true }); m.npc('townswoman', 8.5, 48.5, { wander: true });
    m.item('sovereigns', 64.5, 42.5); m.item('honey', 66.5, 58.5); m.item('pellets', 4.5, 61.5);
    m.enemy('mites', 62.5, 57.5); m.enemy('mites', 36.5, 59.5);
    m.npc('townsman', 19.5, 23.5, { wander: true }); m.npc('townsman', 36.5, 25.5, { wander: true }); m.npc('townsman', 10.5, 30.5, { wander: true });
    m.npc('townswoman', 27.5, 19.5, { wander: true }); m.npc('townswoman', 9.5, 14.5, { wander: true }); m.npc('townswoman', 34.5, 34.5, { wander: true });
    m.item('tonic', 7.5, 36.5); m.item('pellets', 42.5, 12.5); m.item('sovereigns', 42.5, 35.5);
  }
  shapeOakhaven(m);   // last, so later cells (the mast, the plinth) take their heights
  m.baseCount = m.entities.length;
  return m;
}

// -------------------------------------------------------------------------
//  INTERIORS
// -------------------------------------------------------------------------
function interior(id, name, w, h, wallTex, exit, fill) {
  const m = new GameMap(id, name, w, h, { floor: 't_wood', ceil: 't_wood', fogDist: 18, ambient: 0.3, fogColor: [0, 0, 0], music: 'inside', spawn: { x: exit.sx, y: exit.sy, dir: exit.sdir } });
  m.border(wallTex);
  m.set(exit.x, exit.y, DOOR({ portal: { map: 'oakhaven', x: exit.ox, y: exit.oy, dir: exit.odir }, label: 'Out to the street' }));
  fill(m);
  return m;
}

function buildInteriors() {
  const maps = {};
  maps.tavern = interior('tavern', 'The Boar & Dulcimer', 17, 12, 't_wood', { x: 8, y: 11, sx: 8.5, sy: 9.5, sdir: -Math.PI / 2, ox: 29.5, oy: 17.5, odir: Math.PI / 2 }, (m) => {
    m.rect(2, 2, 6, 2, 't_wood'); // bar counter
    m.deco('table', 11.5, 4.5, { radius: 0.5, scale: 0.7 }); m.deco('table', 11.5, 8.5, { radius: 0.5, scale: 0.7 }); m.deco('table', 4.5, 7.5, { radius: 0.5, scale: 0.7 });
    m.deco('hearth', 14.9, 6.5, { radius: 0.3, scale: 0.9, glow: 0.7 }); m.deco('shelf', 1.4, 5.5, { radius: 0.2, scale: 0.9 });
    m.deco('lamp', 8.5, 6.5, { radius: 0.12, scale: 0.7, glow: 0.6 });
    m.npc('hetty', 4.5, 3.6, { facing: Math.PI / 2 }); m.npc('vane', 13.5, 9.5, { facing: Math.PI });
    m.npc('townsman', 10.5, 3.5, { facing: 0 });
    // cellar
    m.rect(1, 9, 5, 9, 't_wood'); m.set(6, 10, WALL('t_wood')); m.set(3, 9, DOOR({ label: 'Cellar door' }));
    m.add({ kind: 'deco', sprite: 'crates', x: 2.0, y: 10.4, solid: true, radius: 0.3, scale: 0.6, label: 'Casks of small beer' });
    m.add({ kind: 'deco', sprite: 'crates', x: 4.4, y: 10.5, solid: true, radius: 0.3, scale: 0.7 });
  });
  maps.lyra_house = interior('lyra_house', 'Lyra Ashgrove\'s house', 12, 9, 't_house', { x: 6, y: 8, sx: 6.5, sy: 6.5, sdir: -Math.PI / 2, ox: 21.5, oy: 29.5, odir: -Math.PI / 2 }, (m) => {
    m.deco('hearth', 1.2, 4.5, { radius: 0.3, scale: 0.9, glow: 0.7 }); m.deco('bed', 9.5, 2.0, { radius: 0.5, scale: 0.6 }); m.deco('shelf', 4.5, 1.3, { radius: 0.2, scale: 0.9 });
    m.deco('table', 6.5, 4.0, { radius: 0.5, scale: 0.7 }); m.deco('lamp', 3.5, 6.5, { radius: 0.12, scale: 0.7, glow: 0.6 });
    m.npc('lyra', 8.5, 5.5, { facing: Math.PI, until: 'rite_started' });
  });
  maps.greenhall = interior('greenhall', 'The Greenhall', 17, 12, 't_marble', { x: 8, y: 11, sx: 8.5, sy: 9.5, sdir: -Math.PI / 2, ox: 30.5, oy: 9.5, odir: Math.PI / 2 }, (m) => {
    m.rect(6, 2, 10, 2, 't_wood');
    m.deco('shelf', 1.4, 3.5, { radius: 0.2, scale: 0.9 }); m.deco('shelf', 1.4, 6.5, { radius: 0.2, scale: 0.9 }); m.deco('shelf', 15.6, 3.5, { radius: 0.2, scale: 0.9 });
    m.deco('table', 8.5, 6.0, { radius: 0.5, scale: 0.7 }); m.deco('lamp', 4.5, 8.5, { radius: 0.12, scale: 0.7, glow: 0.6 }); m.deco('lamp', 12.5, 8.5, { radius: 0.12, scale: 0.7, glow: 0.6 });
    m.npc('aldric', 8.5, 3.6, { facing: Math.PI / 2 }); m.npc('vosk', 12.5, 5.5, { facing: Math.PI });
    m.enemy('legionnaire', 3.5, 9.5, { passive: true, facing: 0 });
  });
  maps.surgery = interior('surgery', 'Rooke\'s surgery', 11, 9, 't_wood', { x: 0, y: 5, sx: 2.0, sy: 5.5, sdir: 0, ox: 17.5, oy: 15.5, odir: 0 }, (m) => {
    m.deco('chair', 5.5, 2.0, { radius: 0.3, scale: 0.6 }); m.deco('bed', 8.5, 2.0, { radius: 0.5, scale: 0.6 }); m.deco('shelf', 9.6, 6.5, { radius: 0.2, scale: 0.9 });
    m.deco('table', 5.5, 6.5, { radius: 0.5, scale: 0.7 }); m.deco('lamp', 3.5, 3.0, { radius: 0.12, scale: 0.7, glow: 0.6 });
    m.npc('rooke', 7.5, 4.5, { facing: Math.PI });
  });
  maps.mill = interior('mill', 'The Carders\' mill', 14, 12, 't_wood', { x: 0, y: 6, sx: 2.0, sy: 6.5, sdir: 0, ox: 57.5, oy: 9.5, odir: Math.PI }, (m) => {
    m.rect(9, 1, 12, 3, 't_wood'); // the carding engine's housing
    m.deco('pump', 8.5, 2.5, { radius: 0.4, scale: 1.0, label: 'The carding engine, still' }); m.deco('crates', 1.5, 1.6, { radius: 0.35 }); m.deco('crates', 1.5, 10.4, { radius: 0.35 });
    m.deco('table', 6.5, 8.5, { radius: 0.5, scale: 0.7 }); m.deco('chair', 4.5, 8.5, { radius: 0.3, scale: 0.6 }); m.deco('bed', 11.5, 9.8, { radius: 0.5, scale: 0.6 }); m.deco('shelf', 12.6, 6.5, { radius: 0.2, scale: 0.9 });
    m.deco('hearth', 6.5, 1.2, { radius: 0.3, scale: 0.9, glow: 0.7 }); m.deco('lamp', 3.5, 4.5, { radius: 0.12, scale: 0.7, glow: 0.6 }); m.deco('lamp', 9.5, 7.5, { radius: 0.12, scale: 0.7, glow: 0.6 });
    m.npc('nell', 6.5, 6.0, { facing: Math.PI }); m.npc('pim', 10.5, 9.0, { facing: Math.PI, home: true });
  });
  maps.chapel = interior('chapel', 'The Chapel of the Carillon', 13, 13, 't_marble', { x: 6, y: 12, sx: 6.5, sy: 10.5, sdir: -Math.PI / 2, ox: 48.5, oy: 10.5, odir: Math.PI / 2 }, (m) => {
    m.rect(5, 1, 7, 1, 't_stone'); // the altar step
    for (const y of [4.5, 6.5, 8.5]) for (const x of [2.5, 3.5, 9.5, 10.5]) m.deco('chair', x, y, { radius: 0.3, scale: 0.6 });
    m.add({ kind: 'deco', sprite: 'lever', x: 6.5, y: 2.2, solid: true, radius: 0.4, scale: 1.1, use: 'plinth', label: 'The empty bell-frame' });
    m.deco('lamp', 1.5, 2.5, { radius: 0.12, scale: 0.7, glow: 0.6 }); m.deco('lamp', 11.5, 2.5, { radius: 0.12, scale: 0.7, glow: 0.6 }); m.deco('lamp', 11.5, 10.5, { radius: 0.12, scale: 0.7, glow: 0.5 });
    m.deco('shelf', 1.4, 7.5, { radius: 0.2, scale: 0.9 });
    m.npc('townswoman', 3.5, 5.5, { facing: -Math.PI / 2 });
    // the Church, once it has come up the Greenroot road (Dawnday, or sooner once the coil is done: js/days35.js)
    m.npc('ignatius', 6.5, 3.6, { facing: Math.PI / 2, requires: 'church_come' });
    m.enemy('legionnaire', 4.5, 2.5, { passive: true, facing: Math.PI / 2, requires: 'church_come', name: 'Hal Ransome' });
    m.enemy('legionnaire', 8.5, 2.5, { passive: true, facing: Math.PI / 2, requires: 'church_come', name: 'Edda Quill' });
  });
  maps.tannery = interior('tannery', 'The tannery', 15, 10, 't_wood', { x: 7, y: 0, sx: 7.5, sy: 2.0, sdir: Math.PI / 2, ox: 15.5, oy: 56.5, odir: -Math.PI / 2 }, (m) => {
    for (const x of [2.5, 5.5, 9.5, 12.5]) m.deco('pump', x, 7.0, { radius: 0.45, scale: 0.9, label: 'A tanning vat' });
    m.deco('table', 11.5, 3.5, { radius: 0.5, scale: 0.7 }); m.deco('shelf', 13.6, 4.5, { radius: 0.2, scale: 0.9 }); m.deco('crates', 1.6, 2.4, { radius: 0.35 });
    m.deco('lamp', 4.5, 4.5, { radius: 0.12, scale: 0.7, glow: 0.6 }); m.deco('lamp', 10.5, 6.0, { radius: 0.12, scale: 0.7, glow: 0.6 });
    m.add({ kind: 'deco', sprite: 'sign', x: 7.5, y: 8.6, solid: true, radius: 0.3, scale: 0.8, use: 'tanner_key', label: 'A key on a nail: CULVERT' });
    m.deco('bones', 13.4, 8.4, { solid: false, scale: 0.5 });
  });
  maps.orla_house = interior('orla_house', 'Orla Hale\'s house', 10, 8, 't_wood', { x: 9, y: 5, sx: 7.5, sy: 5.5, sdir: Math.PI, ox: 29.5, oy: 40.5, odir: Math.PI }, (m) => {
    m.deco('hearth', 1.2, 2.5, { radius: 0.3, scale: 0.9, glow: 0.6 }); m.deco('bed', 7.5, 1.8, { radius: 0.5, scale: 0.6 }); m.deco('lamp', 5.5, 6.5, { radius: 0.12, scale: 0.7, glow: 0.6 });
    m.npc('orla', 4.5, 3.0, { facing: Math.PI / 2 });
  });
  return maps;
}

// -------------------------------------------------------------------------
//  RELIEF — heights that are not one flat block on flat ground
// -------------------------------------------------------------------------
// Oakhaven's skyline: towers over the roofs, and low stone you can see over.
// Only cells change here, never entities, so saved entity indexes still line up.
function shapeOakhaven(m) {
  // the Chapel of the Carillon's bell-tower stands over everything in town
  for (const [x, y] of [[48, 5], [49, 5], [48, 6], [49, 6]]) m.block(x, y, 't_marble', 3.2, { capTex: 't_stone' });
  // the Greenhall's dome
  m.block(30, 6, 't_marble', 2.1, { capTex: 't_roof' });
  // the mooring mast: a tall timber pylon the Kestrel ties up to
  m.lowWall(36, 19, 37, 20, 't_wood', 2.8, { capTex: 't_wood' });
  // the empty bell-plinth is knee-high stone, not a wall
  m.block(49, 11, 't_stone', 0.3);
  // bridge piers become parapets: you can look over them into the Flume
  for (const x of [8, 13, 20, 26, 34, 40, 50, 56]) m.lowWall(x, 49, x, 50, 't_stone', 0.32);
}

// The country outside the walls, shaped after every map is built so that new
// entities append after all historical ones and old saves keep their indexes.
function addReliefWorld(maps) {
  const cl = maps.clearing;
  if (cl) {
    // the Watch-stone is held up by a stone skirt, and so are its steps
    cl.setSide(25, 15, 31, 21, 't_stone'); cl.setSide(22, 19, 24, 20, 't_stone');
    // a dry-stone field wall, knee-high, with a stile gap; you see over it
    for (let x = 2; x <= 13; x++) if (x !== 7) cl.block(x, 9, 't_stone', 0.32);
    // the old hound-watch stand: a timber platform on posts, three steps up
    const WOOD = cl.floorTextures.indexOf('t_wood') >= 0 ? cl.floorTextures.indexOf('t_wood') : cl.floorTextures.push('t_wood') - 1;
    cl.raise(35, 21, 37, 23, 1.2);
    for (let y = 21; y <= 23; y++) { cl.setLvl(32, y, 0.3); cl.setLvl(33, y, 0.6); cl.setLvl(34, y, 0.9); }
    for (let y = 21; y <= 23; y++) for (let x = 32; x <= 37; x++) cl.setFloor(x, y, WOOD);
    cl.setSide(32, 21, 37, 23, 't_wood');
    // a low grassy rise in the south-west, where the hound sleeps
    cl.hill(6, 30, 4.2, 4.2, 0.9);
    cl.deco('sign', 36.5, 22.5, { solid: false, scale: 0.85, label: 'The old hound-watch stand. From up here the Hedge looks like a wall built to keep something in.' });
    cl.baseCount = cl.entities.length;
  }
  const dw = maps.deepwoods;
  if (dw) {
    // the Mausoleum stands on a low rise, so it is seen across the woods
    dw.hill(27.5, 8, 11, 9, 0.8);
    // a rolling willow rise north-east, and a knoll in the west
    dw.hill(47, 9, 7, 6, 1.6);
    dw.hill(5, 27, 3.5, 4.5, 1.2);
    // the crag: a flat-topped outcrop with cliff flanks too steep to climb,
    // its thicket standing on the top
    dw.hill(51.5, 33.5, 4.6, 4.6, 2.6, { steep: 0.3 });
    // bare rock where the ground is too steep to hold moss
    const ROCK = dw.floorTextures.indexOf('t_stone') >= 0 ? dw.floorTextures.indexOf('t_stone') : dw.floorTextures.push('t_stone') - 1;
    for (let y = 27; y <= 40; y++) for (let x = 45; x <= 55; x++) if (!dw.get(x, y) && dw.gradeAt(x + 0.5, y + 0.5) > 0.8) dw.setFloor(x, y, ROCK);
    // the Mausoleum's stepped roof and bell-tower, measured from its own ground
    const top = (x, y, k) => dw.groundAt(x + 0.5, y + 0.5) + k;
    for (let y = 4; y <= 11; y++) for (let x = 22; x <= 33; x++) {
      const inner = x >= 24 && x <= 31 && y >= 6 && y <= 9, tower = x >= 27 && x <= 28 && y >= 6 && y <= 7;
      if (dw.get(x, y) && !dw.get(x, y).door) dw.block(x, y, 't_mausoleum', top(x, y, tower ? 4.2 : inner ? 2.0 : 1.5), { capTex: 't_greymarble' });
    }
  }
}

// -------------------------------------------------------------------------
//  THE CLEARING (outside the Hedge)
// -------------------------------------------------------------------------
function buildClearing() {
  const W = 40, H = 36;
  const m = new GameMap('clearing', 'Outside the Hedge', W, H, { outdoor: true, floor: 't_grass', floorTextures: ['t_grass', 't_moss', 't_water', 't_stone'], fogDist: 16, fogColor: [50, 55, 50], music: 'wild', danger: 1, spawn: { x: 20.5, y: 32.5, dir: -Math.PI / 2 } });
  m.border('t_hedge');
  m.set(20, H - 1, DOOR({ portal: { map: 'oakhaven', x: 23.5, y: 2.5, dir: Math.PI / 2 }, label: 'The North Gate of Oakhaven' }));
  // Kaelen's hut
  m.rect(8, 14, 11, 17, 't_wood'); m.set(11, 16, DOOR({ locked: '__never', lockMsg: 'A charcoal-burner\'s hut. Inside, somebody is humming one low note, over and over, like a man in pain.' , label: 'Kaelen\'s hut'}));
  m.npc('kaelen', 13.5, 16.5, { facing: 0 });
  m.deco('hearth', 13.5, 19.0, { radius: 0.3, scale: 0.8, glow: 0.8 });
  // hound-bed
  m.deco('bones', 17.5, 24.5, { radius: 0.3, scale: 0.5, solid: false }); m.trigger(17.5, 24.5, 1.8, 'hound_bed');
  // quarry headframe (north)
  m.rect(16, 1, 24, 4, 't_stone'); m.set(20, 4, DOOR({ portal: { map: 'quarry', x: 0, y: 0, dir: 0, useSpawn: true }, label: 'The quarry headframe' }));
  m.deco('pump', 15.0, 5.5, { radius: 0.4, scale: 1.0 }); m.deco('crates', 25.0, 5.5, { radius: 0.4 }); m.deco('sign', 22.5, 7.5, { radius: 0.2 });
  // --- the Watch-stone: real ground you can climb and fall from ----------
  // A grass knoll east of the path, held up by a stone skirt, with four
  // shallow steps on its west face and one broken edge you can walk off.
  const KX0 = 25, KX1 = 31, KY0 = 15, KY1 = 21, KTOP = 1.2;
  m.raise(KX0, KY0, KX1, KY1, KTOP);
  for (let y = KY0; y <= KY1; y++) for (let x = KX0; x <= KX1; x++) m.setFloor(x, y, 1);   // mossy hilltop
  // The edge itself is the cliff: the renderer draws the ground's own riser
  // face, so any border cell is a drop and the stair is the only way up.
  // steps: 0 -> 0.3 -> 0.6 -> 0.9 -> 1.2, each rise inside a walking step
  for (const y of [19, 20]) { m.setLvl(22, y, 0.3); m.setLvl(23, y, 0.6); m.setLvl(24, y, 0.9); m.setFloor(22, y, 1); m.setFloor(23, y, 1); m.setFloor(24, y, 1); }
  m.setLvl(24, 18, 0); m.setLvl(24, 21, 0);
  m.deco('sign', 21.4, 20.6, { solid: false, scale: 0.85, label: 'The Watch-stone steps — the Grey Teeth are best seen from the top' });
  m.deco('sign', 28.5, 17.5, { radius: 0.35, scale: 1.15, label: 'The Watch-stone. The Grey Teeth stand up beyond the Hedge from here.' });
  // forest
  const rnd = mulberry32(99);
  for (let i = 0; i < 46; i++) {
    const x = 2 + rnd() * (W - 4), y = 2 + rnd() * (H - 4);
    if (Math.abs(x - 20) < 2.5 && y > 4) continue;           // keep the path clear
    if (x > 7 && x < 15 && y > 13 && y < 21) continue;       // hut
    if (x > 21 && x < 34 && y > 12 && y < 24) continue;      // the Watch-stone
    if (y < 8 && x > 13 && x < 27) continue;
    m.deco('oak', x, y, { scale: 1.5 + rnd() * 0.9, radius: 0.45 });
  }
  m.enemy('hound', 30.5, 12.5); m.enemy('hound', 6.5, 28.5); m.enemy('hound', 33.5, 28.5);
  m.enemy('mites', 28.5, 20.5);
  m.item('pellets', 4.5, 4.5); m.item('whistle', 34.5, 4.5); m.item('tonic', 30.5, 31.5);
  m.deco('lamp', 20.5, 30.5, { radius: 0.15, scale: 0.9, glow: 0.5, glassLamp: true, label: 'A green-gold Light-glass lamp beside the Hedge' });
  return m;
}

// -------------------------------------------------------------------------
//  DUNGEON GENERATOR (rooms + corridors)
// -------------------------------------------------------------------------
function genDungeon(id, name, seed, opts) {
  const W = opts.w || 44, H = opts.h || 44;
  const rnd = mulberry32(seed);
  const m = new GameMap(id, name, W, H, { floor: opts.floor, ceil: opts.ceil, fogDist: opts.fogDist || 9, ambient: opts.ambient || 0.08, fogColor: opts.fogColor || [0, 0, 0], music: opts.music || 'dungeon', siphoned: true, danger: opts.danger || 1 });
  // fill solid
  for (let i = 0; i < W * H; i++) m.cells[i] = WALL(rnd() < (opts.altChance || 0.2) ? opts.altWall : opts.wall);
  const rooms = [];
  const tryRoom = (rw, rh, forceX, forceY) => {
    for (let attempt = 0; attempt < 200; attempt++) {
      const x = forceX != null ? forceX : 2 + ((rnd() * (W - rw - 4)) | 0), y = forceY != null ? forceY : 2 + ((rnd() * (H - rh - 4)) | 0);
      let ok = true;
      for (const r of rooms) if (x < r.x + r.w + 2 && x + rw + 2 > r.x && y < r.y + r.h + 2 && y + rh + 2 > r.y) { ok = false; break; }
      if (!ok) continue;
      const r = { x, y, w: rw, h: rh, cx: x + (rw >> 1), cy: y + (rh >> 1) };
      rooms.push(r); m.clear(x, y, x + rw - 1, y + rh - 1);
      return r;
    }
    return null;
  };
  const carveCorridor = (ax, ay, bx, by) => {
    let x = ax, y = ay;
    const horizFirst = rnd() < 0.5;
    const cells = [];
    const stepX = () => { while (x !== bx) { x += Math.sign(bx - x); cells.push([x, y]); } };
    const stepY = () => { while (y !== by) { y += Math.sign(by - y); cells.push([x, y]); } };
    if (horizFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
    for (const [cx, cy] of cells) if (cx > 0 && cy > 0 && cx < W - 1 && cy < H - 1) m.set(cx, cy, null);
    return cells;
  };
  // rooms
  const entrance = tryRoom(5, 5, opts.entranceX, opts.entranceY);
  const specs = opts.rooms;
  const named = {};
  for (const s of specs) { const r = tryRoom(s.w, s.h); if (r) { r.name = s.name; named[s.name] = r; } }
  for (let i = 0; i < (opts.fillerRooms || 6); i++) tryRoom(3 + ((rnd() * 4) | 0), 3 + ((rnd() * 4) | 0));
  // connect sequentially (nearest-unconnected) + a couple of loops
  const connected = [entrance]; const remaining = rooms.filter(r => r !== entrance);
  const corridorCells = [];
  while (remaining.length) {
    let best = null, bi = -1, bd = 1e9, from = null;
    for (const c of connected) for (let i = 0; i < remaining.length; i++) { const r = remaining[i]; const d = Math.abs(r.cx - c.cx) + Math.abs(r.cy - c.cy); if (d < bd) { bd = d; best = r; bi = i; from = c; } }
    corridorCells.push(...carveCorridor(from.cx, from.cy, best.cx, best.cy));
    connected.push(best); remaining.splice(bi, 1);
  }
  for (let i = 0; i < 2; i++) { const a = rooms[(rnd() * rooms.length) | 0], b = rooms[(rnd() * rooms.length) | 0]; if (a !== b) corridorCells.push(...carveCorridor(a.cx, a.cy, b.cx, b.cy)); }
  // doors: corridor cells that have walls on exactly two opposite sides and open on the other two
  let doorsPlaced = 0;
  for (const [x, y] of corridorCells) {
    if (doorsPlaced > 14 || rnd() > 0.18) continue;
    if (m.get(x, y)) continue;
    const n = !!m.get(x, y - 1), s = !!m.get(x, y + 1), e = !!m.get(x + 1, y), w = !!m.get(x - 1, y);
    if ((n && s && !e && !w) || (e && w && !n && !s)) {
      // avoid adjacent doors
      let near = false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const c = m.get(x + dx, y + dy); if (c && c.door) near = true; }
      if (near) continue;
      m.set(x, y, DOOR({})); doorsPlaced++;
    }
  }
  m.spawn = { x: entrance.cx + 0.5, y: entrance.cy + 0.5, dir: 0 };
  m.rooms = rooms; m.named = named; m.entrance = entrance; m.rnd = rnd;
  // Place a portal in a dead-end niche of a room's wall, never in a corridor, so it can't cut the map in two.
  // Returns { x, y, sx, sy, sdir } — the door cell and a standing spot just inside the room, facing away from it.
  m.wallPortal = (r, props, prefer) => {
    const sides = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };
    const order = [prefer || 'w', 'n', 'w', 's', 'e'].filter((v, i, a) => a.indexOf(v) === i);
    const solid = (x, y) => { const c = m.get(x, y); return !!c && !c.door; };
    for (const side of order) {
      const [dx, dy] = sides[side]; const cands = [];
      if (dx === 0) { const y = dy < 0 ? r.y - 1 : r.y + r.h; for (let x = r.x + 1; x < r.x + r.w - 1; x++) cands.push([x, y]); }
      else { const x = dx < 0 ? r.x - 1 : r.x + r.w; for (let y = r.y + 1; y < r.y + r.h - 1; y++) cands.push([x, y]); }
      cands.sort((a, b) => (Math.abs(a[0] - r.cx) + Math.abs(a[1] - r.cy)) - (Math.abs(b[0] - r.cx) + Math.abs(b[1] - r.cy)));
      for (const [x, y] of cands) {
        if (x < 1 || y < 1 || x > W - 2 || y > H - 2) continue;
        if (!solid(x, y) || !solid(x + dx, y + dy)) continue;            // must be wall, with wall behind it
        const px = dy !== 0 ? 1 : 0, py = dx !== 0 ? 1 : 0;              // along-the-wall neighbours must be wall too
        if (!solid(x + px, y + py) || !solid(x - px, y - py)) continue;
        if (m.get(x - dx, y - dy)) continue;                              // the room side must be open floor
        m.set(x, y, DOOR(props));
        return { x, y, sx: x - dx * 1.6 + 0.5, sy: y - dy * 1.6 + 0.5, sdir: Math.atan2(-dy, -dx) };
      }
    }
    // fallback: carve a niche straight out of the room centre line on the west side
    const x = r.x - 1, y = r.cy; m.set(x, y, DOOR(props));
    return { x, y, sx: x + 1.6 + 0.5, sy: y + 0.5, sdir: 0 };
  };
  return m;
}

function buildQuarry() {
  const m = genDungeon('quarry', 'The Oakhaven Quarry', 4127, {
    wall: 't_stone', altWall: 't_glassrock', altChance: 0.18, floor: 't_flag', ceil: 't_stone', fogDist: 9, fogColor: [0, 0, 0], music: 'dungeon', danger: 1,
    rooms: [{ name: 'pumphall', w: 9, h: 7 }, { name: 'depot', w: 7, h: 6 }, { name: 'shaft', w: 5, h: 5 }, { name: 'store', w: 5, h: 4 }, { name: 'barracks', w: 6, h: 5 }], fillerRooms: 7,
  });
  const e = m.entrance, rnd = m.rnd;
  // exit door back to the clearing: on the entrance room's wall
  const qx = m.wallPortal(e, { portal: { map: 'clearing', x: 20.5, y: 6.5, dir: Math.PI / 2 }, label: 'Up the headframe ladder' }, 'w');
  m.spawn = { x: qx.sx, y: qx.sy, dir: qx.sdir };
  m.deco('lamp', e.cx + 0.5, e.y + 0.5, { radius: 0.12, scale: 0.7, glow: 0.6 }); m.deco('crates', e.x + e.w - 0.6, e.y + e.h - 0.6, { radius: 0.35 });
  const ph = m.named.pumphall;
  if (ph) {
    m.deco('pump', ph.x + 1.0, ph.y + 1.0, { radius: 0.4 }); m.deco('pump', ph.x + ph.w - 1.0, ph.y + 1.0, { radius: 0.4 }); m.deco('pump', ph.x + 1.0, ph.y + ph.h - 1.0, { radius: 0.4 });
    m.add({ kind: 'npc', id: 'hollow', name: 'A Hollow', sprite: 'hollow', x: ph.cx + 0.5, y: ph.cy + 0.5, solid: true, radius: 0.3, loop: true, restore: 'hew', lines: ['...pressure nominal... pressure nominal...', '...told Mags I\'d be home by Dawnday...'] });
    m.add({ kind: 'npc', id: 'hollow', name: 'A Hollow', sprite: 'hollow', x: ph.cx - 1.5, y: ph.cy + 1.5, solid: true, radius: 0.3, loop: true, lines: ['...the pump on the third level... the third level...', '...number four... number four... number four...'] });
    m.npc('tobiah', ph.x + ph.w - 1.5, ph.cy + 0.5, { facing: Math.PI });
    m.deco('lamp', ph.cx + 0.5, ph.y + ph.h - 0.6, { radius: 0.12, scale: 0.7, glow: 0.6 });
  }
  const dp = m.named.depot;
  if (dp) {
    m.item('coil', dp.cx + 0.5, dp.cy + 0.5);
    m.enemy('legionnaire', dp.cx + 0.5, dp.cy - 1.2, { guard: true, name: 'Tamsin Reed' });
    m.deco('crates', dp.x + 0.6, dp.y + 0.6, { radius: 0.35 }); m.deco('crates', dp.x + dp.w - 0.6, dp.y + 0.6, { radius: 0.35 }); m.deco('shelf', dp.x + 0.5, dp.y + dp.h - 0.5, { radius: 0.2 });
    m.item('pellets', dp.x + dp.w - 0.7, dp.y + dp.h - 0.7);
  }
  const sh = m.named.shaft;
  if (sh) {
    const sg = m.wallPortal(sh, { portal: { map: 'rootvault', useSpawn: true }, label: 'The shaft gate to the Root-vault', locked: 'pass', lockMsg: 'An iron gate over a green-lit shaft. A Consortium seal-lock. You have no pass.' }, 'n');
    m.shaftReturn = { x: sg.sx, y: sg.sy, dir: sg.sdir };
    m.deco('lever', sh.x + 0.5, sh.cy + 0.5, { radius: 0.3, scale: 0.8 }); m.deco('lamp', sh.x + sh.w - 0.6, sh.cy + 0.5, { radius: 0.12, scale: 0.7, glow: 0.6 });
  }
  const st = m.named.store; if (st) { m.item('tonic', st.cx + 0.5, st.cy + 0.5); m.item('honey', st.x + 0.6, st.y + 0.6); m.deco('crates', st.x + st.w - 0.6, st.y + st.h - 0.6, { radius: 0.35 }); m.enemy('mites', st.cx + 1.5, st.cy + 0.5); }
  const br = m.named.barracks; if (br) { m.enemy('legionnaire', br.cx + 0.5, br.cy + 0.5, { name: 'Gethin Coote' }); m.deco('bed', br.x + 0.8, br.y + 0.8, { radius: 0.4, scale: 0.6 }); m.deco('bed', br.x + br.w - 0.8, br.y + 0.8, { radius: 0.4, scale: 0.6 }); m.item('sovereigns', br.cx + 0.5, br.y + br.h - 0.6); }
  // filler encounters
  for (const r of m.rooms) {
    if (r === e || r.name) continue;
    const roll = rnd();
    if (roll < 0.35) m.enemy('legionnaire', r.cx + 0.5, r.cy + 0.5, { name: NAMES_POOL[(rnd() * NAMES_POOL.length) | 0] });
    else if (roll < 0.6) m.enemy('mites', r.cx + 0.5, r.cy + 0.5);
    else if (roll < 0.8) m.add({ kind: 'npc', id: 'hollow', name: 'A Hollow', sprite: 'hollow', x: r.cx + 0.5, y: r.cy + 0.5, solid: true, radius: 0.3, loop: true, lines: ['...I punched it down... I punched it down...', '...coming, Mam... coming...'] });
    if (rnd() < 0.5) m.item(rnd() < 0.5 ? 'sovereigns' : 'tonic', r.x + 0.6, r.y + 0.6);
    if (rnd() < 0.4) m.deco('bones', r.x + r.w - 0.7, r.y + r.h - 0.7, { solid: false, scale: 0.5 });
    if (rnd() < 0.5) m.deco('lamp', r.cx + 0.5, r.y + 0.5, { radius: 0.12, scale: 0.7, glow: 0.6 });
  }
  m.item('bottle', e.x + e.w - 0.7, e.y + 0.6);
  // The depot's loading terrace: a stone shelf along its north wall, a drop to
  // the floor on the south side, reached by a real ramp at the east end. Only
  // heights and side textures change; no entity moves, and the depot's three
  // exits (west and east corridors on row 5, south door) stay on the floor.
  if (dp) {
    const TERRACE = 1.2, tx0 = dp.x, tx1 = dp.x + dp.w - 1, ty0 = dp.y;
    m.ceilZ = 2.7;   // the quarry now has height to climb in; walls reach this
    m.raise(tx0, ty0, tx1 - 3, ty0 + 1, TERRACE);
    // 3 cells to climb 1.2 is a grade of 0.4, well under MAX_GRADE; the high end meets the shelf
    m.ramp(tx1 - 2, ty0, tx1, ty0 + 2, TERRACE, 0, 'y');
    m.setSide(tx0, ty0, tx1, ty0 + 2, 't_stone');
    // walls reach ceilZ, which is taller than any floor+1 here: give the renderer's
    // tallest-point scan one rock cell at ceiling height so it never stops early
    m.block(0, 0, 't_stone', m.ceilZ);
  }
  return m;
}

function buildRootVault() {
  const m = genDungeon('rootvault', 'The Root-vault', 8812, {
    wall: 't_glassrock', altWall: 't_brass', altChance: 0.12, floor: 't_flag', ceil: 't_glassrock', fogDist: 8, fogColor: [4, 12, 4], music: 'root', danger: 1,
    rooms: [{ name: 'casing', w: 11, h: 9 }, { name: 'boiler', w: 7, h: 6 }, { name: 'gallery', w: 8, h: 4 }, { name: 'cistern', w: 5, h: 5 }], fillerRooms: 6,
  });
  const e = m.entrance, rnd = m.rnd;
  const rx = m.wallPortal(e, { portal: { map: 'quarry', useSpawn: 'shaft' }, label: 'The shaft gate, up to the quarry' }, 'w');
  m.spawn = { x: rx.sx, y: rx.sy, dir: rx.sdir };
  const cs = m.named.casing;
  if (cs) {
    m.add({ kind: 'deco', sprite: 'bore', x: cs.cx + 0.5, y: cs.cy + 0.5, solid: true, radius: 0.9, scale: 2.2, use: 'bore', label: 'The Siphon Casing — the bore\'s lock', glow: 0.5 });
    for (const [dx, dy] of [[-3, -2], [3, -2], [-3, 2], [3, 2]]) m.deco('pump', cs.cx + 0.5 + dx, cs.cy + 0.5 + dy, { radius: 0.4, glow: 0.3 });
    m.deco('lever', cs.x + 0.6, cs.y + 0.6, { radius: 0.3, scale: 0.8 });
    m.add({ kind: 'npc', id: 'hollow', name: 'A Hollow at the pumps', sprite: 'hollow', x: cs.x + 1.5, y: cs.cy + 0.5, solid: true, radius: 0.3, loop: true, lines: ['...seven... eight... eight at the pumps...', '...hold... hold... hold...'] });
    m.casingRoom = cs;
  }
  const bl = m.named.boiler; if (bl) { m.enemy('golem', bl.cx + 0.5, bl.cy + 0.5); m.deco('pump', bl.x + 0.7, bl.y + 0.7, { radius: 0.4 }); m.item('tonic', bl.x + bl.w - 0.7, bl.y + bl.h - 0.7); }
  const ga = m.named.gallery; if (ga) { m.enemy('legionnaire', ga.cx + 0.5, ga.cy + 0.5, { name: 'Mirren Salk' }); m.enemy('legionnaire', ga.x + 1.5, ga.cy + 0.5, { name: 'Dunstan Pell' }); m.item('pellets', ga.x + ga.w - 0.7, ga.y + 0.6); }
  const ci = m.named.cistern; if (ci) { m.enemy('quiet', ci.cx + 0.5, ci.cy + 0.5); m.item('honey', ci.x + 0.6, ci.y + 0.6); m.item('sovereigns', ci.x + ci.w - 0.7, ci.y + ci.h - 0.7); }
  for (const r of m.rooms) {
    if (r === e || r.name) continue;
    const roll = rnd();
    if (roll < 0.4) m.enemy('legionnaire', r.cx + 0.5, r.cy + 0.5, { name: NAMES_POOL[(rnd() * NAMES_POOL.length) | 0] });
    else if (roll < 0.65) m.enemy('mites', r.cx + 0.5, r.cy + 0.5);
    else if (roll < 0.8) m.enemy('proctor', r.cx + 0.5, r.cy + 0.5, { name: NAMES_POOL[(rnd() * NAMES_POOL.length) | 0] });
    if (rnd() < 0.5) m.item(rnd() < 0.5 ? 'sovereigns' : 'tonic', r.x + 0.6, r.y + 0.6);
    if (rnd() < 0.4) m.deco('bones', r.x + r.w - 0.7, r.y + r.h - 0.7, { solid: false, scale: 0.5 });
  }
  return m;
}

function buildUnderhedge() {
  const m = genDungeon('underhedge', 'The Under-hedge', 5150, {
    w: 34, h: 30, wall: 't_stone', altWall: 't_hedge', altChance: 0.3, floor: 't_flag', ceil: 't_stone', fogDist: 7, ambient: 0.05, fogColor: [6, 8, 4], music: 'root', danger: 1,
    rooms: [{ name: 'sump', w: 7, h: 6 }, { name: 'bonehouse', w: 5, h: 5 }, { name: 'throat', w: 4, h: 7 }], fillerRooms: 4,
  });
  const e = m.entrance, rnd = m.rnd;
  const ux = m.wallPortal(e, { portal: { map: 'oakhaven', x: 23.5, y: 60.5, dir: -Math.PI / 2 }, label: 'Up the culvert, to Oakhaven' }, 'n');
  m.spawn = { x: ux.sx, y: ux.sy, dir: ux.sdir };
  const su = m.named.sump; if (su) { m.enemy('quiet', su.cx + 0.5, su.cy + 0.5); m.item('whistle', su.x + 0.6, su.y + 0.6); m.item('sovereigns', su.x + su.w - 0.7, su.y + su.h - 0.7); m.deco('pump', su.cx - 1.5, su.y + 0.7, { radius: 0.4, label: 'A sluice-wheel, seized' }); }
  const bh = m.named.bonehouse; if (bh) {
    m.deco('bones', bh.cx + 0.5, bh.cy + 0.5, { solid: false, scale: 0.6 }); m.deco('bones', bh.x + 0.7, bh.y + 0.7, { solid: false, scale: 0.5 });
    m.add({ kind: 'deco', sprite: 'crates', x: bh.x + bh.w - 0.7, y: bh.y + bh.h - 0.7, solid: true, radius: 0.35, scale: 0.8, use: 'twins', label: 'Two small coats, folded' });
    m.enemy('mites', bh.cx - 1, bh.cy + 1); m.item('tonic', bh.x + 0.6, bh.y + bh.h - 0.7);
  }
  const th = m.named.throat; if (th) {
    m.add({ kind: 'npc', id: 'hollow', name: 'A Hollow in the throat', sprite: 'hollow', x: th.cx + 0.5, y: th.cy + 0.5, solid: true, radius: 0.3, loop: true, lines: ['...Ned?... Ned, the lamp...', '...it\'s only the Hedge talking... only the Hedge...'] });
    m.item('bottle', th.cx + 0.5, th.y + th.h - 0.7); m.enemy('mites', th.cx + 0.5, th.y + 0.8);
  }
  for (const r of m.rooms) {
    if (r === e || r.name) continue;
    const roll = rnd();
    if (roll < 0.5) m.enemy('mites', r.cx + 0.5, r.cy + 0.5); else if (roll < 0.75) m.enemy('proctor', r.cx + 0.5, r.cy + 0.5, { name: NAMES_POOL[(rnd() * NAMES_POOL.length) | 0] });
    if (rnd() < 0.6) m.item(rnd() < 0.5 ? 'sovereigns' : 'pellets', r.x + 0.6, r.y + 0.6);
    if (rnd() < 0.5) m.deco('bones', r.x + r.w - 0.7, r.y + r.h - 0.7, { solid: false, scale: 0.5 });
  }
  return m;
}

// strongboxes, placed last (and with their own dice) so older saves still line up
function placeCaches(m, seed, tiers) {
  const r = mulberry32(seed), spots = [];
  const clear = (x, y) => !m.isBlocked(x | 0, y | 0) && !m.entities.some(e => (e.x - x) ** 2 + (e.y - y) ** 2 < 0.8);
  if (m.rooms) for (const rm of m.rooms) { if (rm === m.entrance) continue; spots.push([rm.x + rm.w - 0.7, rm.y + 0.7], [rm.x + 0.7, rm.y + rm.h - 0.7]); }
  else for (let i = 0; i < 400; i++) { const x = 2 + r() * (m.w - 4), y = 2 + r() * (m.h - 4); if (!m.spawn || (x - m.spawn.x) ** 2 + (y - m.spawn.y) ** 2 > 64) spots.push([(x | 0) + 0.5, (y | 0) + 0.5]); }
  for (let i = spots.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [spots[i], spots[j]] = [spots[j], spots[i]]; }
  let k = 0;
  for (const [x, y] of spots) { if (k >= tiers.length) break; if (!clear(x, y)) continue; m.add({ kind: 'item', item: 'cache', tier: tiers[k++], x, y, sprite: 'chest', scale: 0.5, yOff: 0, solid: false, label: 'A strongbox' }); }
}
function buildAllMaps() {
  const maps = buildInteriors();
  maps.underhedge = buildUnderhedge();
  maps.oakhaven = buildOakhaven(false);
  maps.clearing = buildClearing();
  maps.quarry = buildQuarry();
  maps.rootvault = buildRootVault();
  placeCaches(maps.clearing, 4101, [1, 1]);
  placeCaches(maps.quarry, 4102, [1, 2, 2, 1]);
  placeCaches(maps.underhedge, 4103, [1, 2, 2]);
  placeCaches(maps.rootvault, 4104, [2, 3, 3]);
  if (maps.chapel) placeCaches(maps.chapel, 4105, [1]);
  // Sable's camp in the mist, east of Kaelen's hut, with the Office's proctors on her trail (added last so older saves still line up)
  { const c = maps.clearing; c.npc('umber', 34.5, 18.5, { facing: Math.PI }); c.deco('lamp', 35.3, 19.3, { radius: 0.15, scale: 0.8, glow: 0.45 }); c.enemy('proctor', 30.5, 16.5); c.enemy('proctor', 32.5, 24.5); }
  // Part Three: Whisper-Grove (new maps, so they can be laid out freely)
  maps.whispergrove = buildWhisperGrove(); maps.cloister = buildCloister(); maps.malting = buildMalting();
  placeCaches(maps.whispergrove, 4201, [2, 2, 3]); placeCaches(maps.malting, 4203, [2, 3]);
  // second pass (appended, never inserted)
  extendWhisperGrove(maps.whispergrove); maps.catacombs = buildCatacombs(); maps.wickhouse = buildWickHouse();
  placeCaches(maps.catacombs, 4205, [2, 3, 3]);
  // Part Four
  maps.deepwoods = buildDeepWoods(); maps.mausoleum = buildMausoleum();
  placeCaches(maps.deepwoods, 4207, [2, 3, 3]); placeCaches(maps.mausoleum, 4209, [2, 3]);
  // Part Four, second pass (appended, never inserted)
  extendDeepWoods(maps.deepwoods); extendMausoleum(maps.mausoleum); maps.belfry = buildBelfry();
  // Part Four, third pass (appended after the second)
  extendDeepWoods3(maps.deepwoods);
  for (const k in maps) maps[k].baseCount = maps[k].entities.length;
  return maps;
}

// -------------------------------------------------------------------------
//  PART THREE — WHISPER-GROVE, the sunken marble capital of the Spectral Woods
// -------------------------------------------------------------------------
const WG_HOLLOW_LINES = [
  ['...the bread\'s for Thursday... the bread\'s for Thursday...', '...tell her I\'ll be back before the bell...'],
  ['...one step, two step, mind the water...', '...where did I put my hat...'],
  ['...the court is in session... the court is in session...', '...all rise... all rise...'],
  ['...Wren? Wren, the cloak, you forgot your cloak...', '...hymn nine, page forty...'],
  ['...sixpence for the ferry... sixpence...', '...it was here a moment ago...'],
  ['...I was going to say something...', '...I was going to say something important...'],
  ['...the lamps are late tonight...', '...somebody ought to see to the lamps...'],
  ['...seven, eight, nine pigeons... nine...', '...no, eight...'],
  ['...Mother says come in now... come in now...', '...the water\'s warm, though...'],
  ['...I love you, I love you, I love you...', '...what was your name...'],
  ['...ledger, page four... carry the two...', '...balance forward...'],
  ['...singing, can you hear the singing...', '...it stopped...'],
];
function buildWhisperGrove() {
  const W = 48, H = 48;
  const m = new GameMap('whispergrove', 'Whisper-Grove — the Sunken Court', W, H, {
    outdoor: true, floor: 't_shallows', floorTextures: ['t_shallows', 't_marble', 't_water'], fogDist: 21, fogColor: [104, 88, 128], ambient: 0.17,
    music: 'grove', danger: 1, spawn: { x: 24.5, y: 43.5, dir: -Math.PI / 2 },
  });
  m.border('t_greymarble');
  const dry = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.setFloor(x, y, 1); };
  const deep = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.setFloor(x, y, 2); };
  // the south landing under the Kestrel, the causeway, the dry steps of the Cloister road
  dry(18, 40, 30, 46); dry(23, 31, 25, 40); dry(14, 9, 26, 10); dry(27, 2, 31, 13); dry(19, 9, 20, 14);
  // drowned houses
  m.rect(12, 1, 26, 8, 't_greymarble');                  // the Cloister of the Lost Choir
  m.set(19, 8, DOOR({ portal: { map: 'cloister', x: 9.5, y: 13.4, dir: -Math.PI / 2 }, label: 'The Cloister of the Lost Choir' }));
  m.rect(32, 1, 45, 9, 't_brick');                        // the Malting: "a long brick range" (Book One; owner's ruling, 11 Nov). The tile is made in js/malting61.js
  m.set(32, 5, DOOR({ portal: { map: 'malting', x: 1.6, y: 11.5, dir: 0 }, label: 'The Malting — Relief Station Nineteen', locked: 'wg_plan', lockMsg: 'Grey shutters, an Office seal, a painted board: RELIEF STATION NINETEEN — REGISTRATION WITHIN. Boots in the wet outside. You do not know yet what you would be walking into. Find the scribe first.' }));
  m.rect(2, 2, 9, 7, 't_greymarble'); m.rect(2, 10, 8, 15, 't_greymarble');
  m.rect(2, 18, 7, 22, 't_greymarble'); m.rect(2, 25, 7, 28, 't_greymarble');
  m.rect(2, 31, 9, 36, 't_greymarble'); m.rect(2, 40, 12, 45, 't_greymarble');
  m.rect(38, 13, 45, 19, 't_greymarble'); m.rect(40, 24, 45, 31, 't_greymarble'); m.rect(36, 35, 45, 44, 't_greymarble');
  m.rect(33, 41, 35, 45, 't_greymarble');
  // phosphorescent deep pools
  deep(10, 20, 12, 22); deep(14, 33, 16, 35); deep(34, 31, 36, 33); deep(37, 22, 38, 23);
  // the Sunken Court: the fountain, four reflecting basins, dry lamps around the ring
  const cx = 24.5, cy = 22.5;
  m.deco('basin', cx, cy, { radius: 0.9, scale: 1.25, glow: 0.55, use: 'fountain', label: 'The fountain of the Sunken Court' });
  [[18.5, 16.5], [30.5, 16.5], [18.5, 28.5], [30.5, 28.5]].forEach(([x, y], i) => m.deco('basin', x, y, { radius: 0.55, scale: 0.8, glow: 0.5, use: 'pool', pool: i, label: 'A reflecting pool' }));
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; m.deco('lamp', cx + Math.cos(a) * 9.2, cy + Math.sin(a) * 9.2, { radius: 0.15, scale: 0.95, glow: 0, drylamp: true, label: 'A dry lamp. The wick has been lit a thousand times, and there is no oil.' }); }
  // Halder Wick's table for four
  m.deco('table', 32.5, 22.5, { radius: 0.55, scale: 0.7, label: 'A table for four, set in a foot of water. One of the plates is blue.' });
  m.deco('chair', 31.6, 21.7, { radius: 0.2, scale: 0.55 }); m.deco('chair', 33.4, 23.3, { radius: 0.2, scale: 0.55 }); m.deco('chair', 31.6, 23.3, { radius: 0.2, scale: 0.55 });
  // the Hollows walking their loops
  const spots = [[20.5, 19.0], [28.5, 19.5], [21.0, 26.0], [27.5, 26.0], [16.5, 22.5], [26.5, 15.5], [22.0, 29.5], [29.5, 13.5], [14.5, 27.5], [34.5, 27.5], [17.5, 12.5], [12.5, 17.0]];
  spots.push([22.5, 17.0], [26.5, 28.5], [19.5, 24.5], [29.5, 22.0], [15.5, 18.5], [33.0, 15.0], [13.5, 24.5], [21.5, 33.5]);
  spots.forEach(([x, y], i) => m.add({ kind: 'npc', id: 'hollow', name: 'A Hollow', sprite: 'hollow', x, y, solid: true, radius: 0.3, loop: true, lines: WG_HOLLOW_LINES[i % WG_HOLLOW_LINES.length] }));
  // the south landing and the Kestrel's company
  m.deco('ladder', 24.5, 45.3, { radius: 0.25, scale: 2.1, use: 'wg_ladder', label: 'The Drift-Kestrel\'s mast-ladder — a hundred feet of rope, up into the mist' });
  m.deco('crates', 28.5, 45.0, { radius: 0.4, scale: 0.8 }); m.deco('lamp', 22.5, 45.2, { radius: 0.15, scale: 0.8, glow: 0.6 });
  m.npc('vane_wg', 21.5, 44.0, { facing: -Math.PI / 2 });
  m.npc('lyra_wg', 27.5, 43.8, { facing: -Math.PI / 2 });
  m.npc('kaelen_wg', 19.5, 42.0, { facing: -Math.PI / 2 });
  m.npc('sable_wg', 26.2, 42.0, { facing: Math.PI, requires: 'sable_aboard' });
  m.npc('sable_wg', cx, cy + 1.7, { facing: Math.PI / 2, until: 'sable_aboard' });
  m.deco('lamp', cx + 1.0, cy + 2.2, { radius: 0.12, scale: 0.7, glow: 0.5 });
  m.npc('halder', 33.6, 21.6, { facing: Math.PI, loop: true, until: 'halder_dead', lines: ['...the blue one goes there...', '...four plates... four...'] });
  m.npc('lamplighter', 20.5, 21.5, { loop: true, lines: ['...the lamps are late tonight...'] });
  m.npc('cat', 27.5, 31.5, { wander: true, radius: 0.2, solid: false });
  // willows, never on the paths
  const rnd = mulberry32(741);
  for (let i = 0, n = 0; i < 400 && n < 34; i++) {
    const x = 2 + rnd() * (W - 4), y = 2 + rnd() * (H - 4), ix = x | 0, iy = y | 0;
    if (m.isBlocked(ix, iy) || (m.floorCells[iy * W + ix] === 1)) continue;
    if ((x - cx) ** 2 + (y - cy) ** 2 < 120) continue;           // the court
    if (Math.abs(x - 24.5) < 2.5 && y > 28) continue;             // the causeway
    if (x > 30 && x < 38 && y > 18 && y < 27) continue;          // Halder's corner
    if (m.entities.some(e => (e.x - x) ** 2 + (e.y - y) ** 2 < 4)) continue;
    let near = false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (m.isSolidCell(ix + dx, iy + dy)) near = true;
    if (near) continue;
    m.deco('willow', x, y, { scale: 1.6 + rnd() * 0.8, radius: 0.4, label: 'A silver weeping willow. The fronds reach the water, and the water lights where they touch.' }); n++;
  }
  // the Office in the mist
  m.enemy('proctor', 10.5, 30.5); m.enemy('proctor', 40.5, 33.0); m.enemy('quiet', 5.5, 38.5); m.enemy('mites', 43.5, 22.5);
  [[17.5, 25.0], [31.5, 18.5], [24.5, 14.6]].forEach(([x, y]) => m.enemy('proctor', x, y, { requires: 'wg_ambush', ambush: true }));
  m.item('tonic', 13.5, 30.5); m.item('honey', 36.5, 29.5); m.item('bolts', 5.5, 8.8); m.item('pellets', 44.5, 22.5); m.item('tonic', 30.5, 11.5);
  m.trigger(cx, cy + 3.0, 4.8, 'wg_ambush');
  m.trigger(19.5, 10.4, 2.0, 'wearer_porch');
  return m;
}

function buildCloister() {
  const W = 20, H = 16;
  const m = new GameMap('cloister', 'The Cloister of the Lost Choir', W, H, { floor: 't_marble', ceil: 't_stone', fogDist: 14, ambient: 0.26, fogColor: [18, 14, 26], music: 'cloister', spawn: { x: 9.5, y: 13.4, dir: -Math.PI / 2 } });
  m.border('t_greymarble');
  m.set(9, 15, DOOR({ portal: { map: 'whispergrove', x: 19.5, y: 9.6, dir: Math.PI / 2 }, label: 'Out to the Sunken Court' }));
  [[4, 5], [4, 9], [14, 5], [14, 9], [7, 11], [12, 11]].forEach(([x, y]) => m.set(x, y, WALL('t_greymarble')));
  [[2.0, 7.0], [17.5, 7.5], [17.5, 12.5], [8.2, 13.6], [10.8, 13.6], [6.0, 9.0], [13.0, 9.0]].forEach(([x, y]) => m.deco('lamp', x, y, { radius: 0.12, scale: 0.7, glow: 0.55, label: 'A Cloister candle-lamp. Somebody keeps these lit.' }));
  // the Aegis's alcove
  m.set(15, 1, WALL('t_greymarble')); m.set(15, 4, WALL('t_greymarble')); m.rect(15, 5, 18, 5, 't_greymarble'); m.clear(15, 5, 15, 5);
  // the vestry
  for (let y = 10; y <= 14; y++) m.set(5, y, WALL('t_greymarble'));
  m.rect(1, 10, 4, 10, 't_greymarble'); m.set(5, 12, DOOR({ label: 'The vestry — a brass tumbler lock', lockDifficulty: 1 }));
  // the risers, empty
  for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) m.deco('chair', 7.5 + i, 5.6 + r * 1.1, { radius: 0.18, scale: 0.45, label: 'An empty riser. Small. Eleven places.' });
  m.deco('hymnboard', 9.5, 2.0, { radius: 0.25, scale: 1.15, use: 'hymn', label: 'The hymn board: HYMN 9, still chalked' });
  m.deco('cloaks', 3.5, 2.0, { radius: 0.45, scale: 0.85, use: 'cloaks', label: 'Eleven small cloaks on iron pegs, and one shoe' });
  m.deco('lamp', 7.5, 1.6, { radius: 0.12, scale: 0.7, glow: 0.55 }); m.deco('lamp', 11.5, 1.6, { radius: 0.12, scale: 0.7, glow: 0.55 });
  m.deco('aegis', 16.8, 2.5, { radius: 0.5, scale: 1.35, until: 'aegis_awake', label: 'A nine-foot bronze automaton in an alcove. DEFEND THE SINGERS is stencilled across its chest. It is not moving. It is not quite still.' });
  m.enemy('aegis', 16.8, 2.5, { requires: 'aegis_awake', until: 'aegis_done' });
  m.npc('aegis_wg', 13.0, 3.6, { facing: Math.PI, requires: 'aegis_calmed' });
  m.add({ kind: 'item', item: 'redcloak', x: 16.6, y: 3.4, sprite: 'loot', scale: 0.35, yOff: 0, solid: false, requires: 'aegis_destroyed' });
  // vestry
  m.item('oil', 2.5, 13.2); m.deco('shelf', 1.4, 11.5, { radius: 0.2, scale: 0.9 }); m.deco('lamp', 3.5, 11.2, { radius: 0.12, scale: 0.6, glow: 0.5 });
  m.item('honey', 1.8, 13.6);
  m.trigger(9.5, 6.4, 2.4, 'aegis_wake'); m.trigger(16.0, 3.0, 2.2, 'aegis_wake');
  return m;
}

function buildMalting() {
  const W = 30, H = 22;
  const m = new GameMap('malting', 'The Malting — Relief Station Nineteen', W, H, { floor: 't_flag', ceil: 't_wood', fogDist: 12, ambient: 0.16, fogColor: [0, 0, 0], music: 'dungeon', danger: 0, spawn: { x: 1.6, y: 11.5, dir: 0 } });
  m.border('t_stone');
  m.set(0, 11, DOOR({ portal: { map: 'whispergrove', x: 31.0, y: 5.5, dir: Math.PI }, label: 'Out to the Cloister road' }));
  // registration (x1-8, y6-16)
  m.rect(1, 1, 8, 5, 't_stone'); m.rect(1, 17, 8, 20, 't_stone');
  for (let y = 1; y <= 20; y++) m.set(9, y, WALL('t_house')); m.set(9, 11, DOOR({ label: 'CLERKS — PLEASE WAIT TO BE CALLED' }));
  [[3.5, 7.6], [5.5, 7.6], [3.5, 15.2], [5.5, 15.2]].forEach(([x, y]) => m.deco('chair', x, y, { radius: 0.2, scale: 0.55, label: 'A bench. Clean. People hesitate less when the bench is clean.' }));
  m.deco('crates', 7.6, 7.0, { radius: 0.35, scale: 0.7, label: 'A water butt, with a tin cup on a chain' });
  m.deco('sign', 2.2, 6.6, { radius: 0.2, scale: 0.8, use: 'reg_sign', label: 'A printed pamphlet, pinned: WELCOME TO RELIEF' });
  m.add({ kind: 'npc', id: 'hollow', name: 'The man who takes your coat', sprite: 'hollow', x: 7.5, y: 12.6, solid: true, radius: 0.3, loop: true, lines: ['...take your coat... take your coat...', '...you won\'t need it where you\'re going...'] });
  m.deco('lamp', 4.5, 11.5, { radius: 0.12, scale: 0.7, glow: 0.5 });
  // the clerks' hall (x10-19, y1-14) and the Tuning Room archive below it (y16-20)
  for (let x = 10; x <= 19; x++) m.set(x, 15, WALL('t_house')); m.set(15, 15, DOOR({ label: 'ARCHIVE — THE TUNING ROOM' }));
  [[12.5, 4.0], [16.5, 4.0], [12.5, 9.5], [16.5, 9.5]].forEach(([x, y]) => m.deco('table', x, y, { radius: 0.5, scale: 0.65, label: 'A clerk\'s desk. Ruler, nib, blotter. Ruled pages of names.' }));
  m.deco('shelf', 10.4, 2.0, { radius: 0.2, scale: 0.9 }); m.deco('shelf', 18.6, 12.5, { radius: 0.2, scale: 0.9 }); m.deco('lamp', 14.5, 7.0, { radius: 0.12, scale: 0.7, glow: 0.5 });
  m.enemy('proctor', 13.5, 6.8); m.enemy('proctor', 17.5, 7.2); m.enemy('proctor', 15.0, 12.5);
  // Quist's office (x21-28, y1-8) and the press room (x21-28, y10-20)
  for (let y = 1; y <= 20; y++) m.set(20, y, WALL('t_house'));
  m.set(20, 5, DOOR({ label: 'REGISTRAR-GENERAL' })); m.set(20, 12, DOOR({ label: 'PRESSING' }));
  for (let x = 21; x <= 28; x++) m.set(x, 9, WALL('t_house'));
  m.deco('table', 25.5, 2.4, { radius: 0.5, scale: 0.65, label: 'The Registrar-General\'s desk. A second cup of hot water, at the empty place.' });
  m.deco('hearth', 27.9, 6.5, { radius: 0.3, scale: 0.8, glow: 0.7, label: 'A small stove with a kettle on it. There is always hot water.' });
  m.deco('shelf', 21.4, 2.0, { radius: 0.2, scale: 0.9 });
  m.npc('quist', 25.5, 4.2, { facing: Math.PI });
  m.deco('press', 25.0, 15.0, { radius: 0.5, scale: 0.95, use: 'press', label: 'An Office hand-press, tuned to 741' });
  m.deco('chair', 23.0, 19.2, { radius: 0.2, scale: 0.55 });
  m.npc('bettis', 23.0, 18.3, { facing: -Math.PI / 2, until: 'bettis_kept_awake' });   // carried to the Kestrel once she is kept awake (Book One ch. 18, 21)
  m.enemy('proctor', 26.8, 12.0, { room: 'press' }); m.enemy('proctor', 27.2, 18.6, { room: 'press' });
  m.deco('lamp', 22.0, 11.0, { radius: 0.12, scale: 0.7, glow: 0.55 });
  // the Tuning Room
  m.deco('shelf', 10.4, 17.0, { radius: 0.2, scale: 0.9 }); m.deco('shelf', 10.4, 19.5, { radius: 0.2, scale: 0.9 }); m.deco('shelf', 18.6, 17.0, { radius: 0.2, scale: 0.9 }); m.deco('shelf', 18.6, 19.5, { radius: 0.2, scale: 0.9 });
  m.item('returns', 12.8, 18.4); m.item('folder', 17.2, 19.2); m.deco('lamp', 15.0, 17.2, { radius: 0.12, scale: 0.6, glow: 0.5 });
  m.trigger(15.0, 18.2, 2.6, 'chorister_floor');
  // the alarm brings the hall's reserve
  m.enemy('proctor', 6.0, 10.5, { requires: 'malting_alarm' }); m.enemy('proctor', 11.2, 12.8, { requires: 'malting_alarm' });
  m.item('tonic', 2.0, 15.6); m.item('pellets', 28.2, 1.8);
  return m;
}

// -------------------------------------------------------------------------
//  Whisper-Grove, second pass. Appended after the first-pass entities so saves keep their indices.
// -------------------------------------------------------------------------
function extendWhisperGrove(m) {
  // the Sunken Stair, down into the catacombs, and the Wick house
  m.set(7, 20, DOOR({ portal: { map: 'catacombs', x: 2.6, y: 14.5, dir: 0 }, label: 'The Sunken Stair — down into the Whisper Catacombs' }));
  m.set(38, 15, DOOR({ portal: { map: 'wickhouse', x: 1.6, y: 4.5, dir: 0 }, label: 'A drowned house. WICK, on a brass plate.' }));
  const t = m.entities.find(e => e.sprite === 'table' && /table for four/.test(e.label || '')); if (t) t.use = 'wick_table';
  m.deco('web', 9.0, 19.0, { radius: 0.2, scale: 0.9, glow: 0.35, label: 'Threads of lilac light, strung across the stair-house door' });
  // the Pressman's round, west and south-west
  m.enemy('pressman', 12.0, 37.8, { mallow: true });
  m.enemy('proctor', 10.0, 38.6); m.enemy('proctor', 13.6, 38.9);
  // things the mist has got into
  m.enemy('drowned', 6.0, 16.5); m.enemy('drowned', 36.0, 27.2); m.enemy('drowned', 43.5, 33.0);
  m.enemy('weaverling', 9.6, 18.0); m.enemy('weaverling', 9.2, 23.4);
  m.item('pellets', 8.6, 17.0); m.item('honey', 37.0, 13.0);
}

function buildCatacombs() {
  const W = 36, H = 30;
  const m = new GameMap('catacombs', 'The Whisper Catacombs', W, H, { floor: 't_flag', floorTextures: ['t_flag', 't_shallows', 't_water'], ceil: 't_stone', fogDist: 10, ambient: 0.1, fogColor: [16, 10, 26], music: 'root', danger: 1, spawn: { x: 2.6, y: 14.5, dir: 0 } });
  m.rect(0, 0, W - 1, H - 1, 't_catacomb');
  const room = (x0, y0, x1, y1) => m.clear(x0, y0, x1, y1);
  room(1, 12, 7, 17);            // the foot of the stair
  room(8, 14, 15, 15);           // east passage
  room(16, 10, 22, 19);          // the ossuary
  room(19, 3, 20, 9); room(13, 1, 26, 5);       // north: the niche gallery
  room(19, 20, 20, 23); room(13, 24, 24, 28);   // south: the flooded crypt
  room(23, 14, 27, 15); room(28, 8, 34, 22);    // east: the loom chamber
  room(4, 9, 5, 11); room(2, 3, 8, 8);          // west: the charnel store
  room(4, 18, 5, 20); room(2, 21, 9, 28);       // south-west: the drowned chapel
  for (let y = 24; y <= 28; y++) for (let x = 13; x <= 24; x++) m.setFloor(x, y, 1);
  m.setFloor(17, 26, 2); m.setFloor(18, 26, 2); m.setFloor(17, 27, 2); m.setFloor(18, 27, 2);
  for (let y = 22; y <= 28; y++) for (let x = 2; x <= 9; x++) m.setFloor(x, y, 1);
  [[18, 12], [20, 12], [18, 17], [20, 17], [30, 11], [32, 11], [30, 19], [32, 19]].forEach(([x, y]) => m.set(x, y, WALL('t_greymarble')));
  m.set(0, 14, DOOR({ portal: { map: 'whispergrove', x: 8.5, y: 20.5, dir: 0 }, label: 'Up the Sunken Stair' }));
  // light
  [[3.5, 12.6], [15.5, 14.5], [19.5, 14.5], [19.5, 2.0], [16.0, 24.6], [3.0, 6.0], [3.0, 22.0], [28.6, 9.0], [28.6, 21.0]].forEach(([x, y]) => m.deco('lamp', x, y, { radius: 0.12, scale: 0.6, glow: 0.45 }));
  // threads, bones, the missing
  [[8.6, 14.8], [16.6, 10.8], [22.0, 18.6], [14.0, 1.8], [25.2, 4.2], [23.6, 27.6], [33.8, 12.6]].forEach(([x, y]) => m.deco('web', x, y, { radius: 0.2, scale: 0.85, glow: 0.35, label: 'A web of lilac light. The threads hum, each in a different voice.' }));
  [[16.6, 16.0], [24.6, 1.6], [14.0, 27.4], [33.6, 9.0], [33.6, 21.0]].forEach(([x, y], i) => m.deco('cocoon', x, y, { radius: 0.3, scale: 1.0, glow: 0.3, use: 'cocoon', cocoon: i, label: 'A Hollow, wound head to foot in lilac thread' }));
  m.deco('bones', 6.0, 4.0, { radius: 0.3, scale: 0.6 }); m.deco('bones', 21.4, 11.0, { radius: 0.3, scale: 0.6 }); m.deco('bones', 8.0, 27.0, { radius: 0.3, scale: 0.6 });
  m.deco('loom', 32.5, 15.0, { radius: 0.7, scale: 1.5, glow: 0.6, use: 'loom', label: 'The Weaver\'s loom, strung with the voices of Whisper-Grove' });
  // the Cacophony
  m.enemy('weaverling', 12.0, 14.6); m.enemy('weaverling', 17.5, 13.5); m.enemy('weaverling', 21.5, 16.5);
  m.enemy('weaverling', 16.0, 3.0); m.enemy('weaverling', 24.0, 2.5); m.enemy('mites', 5.0, 5.5);
  m.enemy('drowned', 15.5, 26.0); m.enemy('drowned', 22.0, 25.5); m.enemy('drowned', 5.5, 25.0);
  m.enemy('weaver', 31.0, 15.0, { guard: true });
  m.item('tonic', 7.4, 3.6); m.item('pellets', 2.6, 27.4); m.item('honey', 25.6, 1.6); m.item('tonic', 23.6, 25.0);
  m.trigger(29.6, 15.0, 2.6, 'weaver_room');
  return m;
}

function buildWickHouse() {
  const m = new GameMap('wickhouse', 'The Wick House', 10, 8, { floor: 't_wood', floorTextures: ['t_wood', 't_shallows', 't_water'], ceil: 't_wood', fogDist: 9, ambient: 0.22, fogColor: [6, 6, 10], music: 'inside', spawn: { x: 1.6, y: 4.5, dir: 0 } });
  m.border('t_greymarble');
  for (let y = 1; y <= 6; y++) for (let x = 1; x <= 8; x++) m.setFloor(x, y, 1);
  m.set(0, 4, DOOR({ portal: { map: 'whispergrove', x: 37.4, y: 15.5, dir: Math.PI }, label: 'Out to the Sunken Court' }));
  m.deco('bed', 7.5, 1.6, { radius: 0.4, scale: 0.55, label: 'A small bed. Two pillows.' });
  m.deco('bed', 7.5, 6.3, { radius: 0.4, scale: 0.6, label: 'A larger bed, made, the cover turned down on one side only.' });
  m.deco('hearth', 4.5, 1.2, { radius: 0.3, scale: 0.8, glow: 0.3, label: 'A cold hearth. The kettle is on it, full of lit water.' });
  m.deco('shelf', 1.4, 1.6, { radius: 0.2, scale: 0.9 });
  m.deco('chair', 4.0, 5.6, { radius: 0.2, scale: 0.5, label: 'A child\'s chair, its back mended twice by a good joiner' });
  m.deco('sign', 3.0, 6.6, { radius: 0.2, scale: 0.6, use: 'wick_letter', label: 'The dresser, bare' });
  m.deco('lamp', 8.6, 4.0, { radius: 0.12, scale: 0.6, glow: 0.4 });
  return m;
}

// =========================================================================
//  PART FOUR — CODA. The Deep Woods by the Mausoleum of Chords, where the Kestrel came down.
// =========================================================================
function buildDeepWoods() {
  const W = 56, H = 56;
  const m = new GameMap('deepwoods', 'The Deep Woods', W, H, {
    outdoor: true, floor: 't_moss', floorTextures: ['t_moss', 't_shallows', 't_water'], fogDist: 18, fogColor: [84, 72, 110], ambient: 0.21,
    music: 'coda', danger: 1, spawn: { x: 27.5, y: 38.2, dir: Math.PI / 2 },
  });
  m.border('t_deepwood');
  // thickets that make the paths
  [[14, 24, 16, 27], [36, 8, 39, 10], [8, 26, 11, 28], [40, 36, 42, 40], [17, 48, 20, 50], [34, 50, 37, 52], [38, 17, 40, 20], [50, 32, 53, 35], [2, 30, 5, 32], [20, 30, 22, 33], [32, 28, 34, 31]].forEach(([a, b, c, d]) => m.rect(a, b, c, d, 't_deepwood'));
  // the Mausoleum of Chords
  m.rect(21, 3, 34, 12, 't_mausoleum');
  m.set(27, 12, DOOR({ portal: { map: 'mausoleum', x: 19.5, y: 31.2, dir: -Math.PI / 2 }, label: 'The Mausoleum of Chords' }));
  // phosphorescent pools
  const pool = (x0, y0, x1, y1) => { for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) m.setFloor(x, y, 1); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.setFloor(x, y, 2); };
  pool(16, 29, 18, 31); pool(36, 34, 37, 35); pool(8, 6, 10, 7);
  // the crash
  m.deco('kestrel', 23.6, 44.8, { radius: 1.7, scale: 2.6, glow: 0.25, use: 'kestrel', label: 'The Drift-Kestrel, on her side in the willows' });
  m.deco('lifttank', 31.0, 45.2, { radius: 0.7, scale: 1.4, label: 'Number-three lift-tank, holed' });
  m.deco('campfire', 27.5, 41.6, { radius: 0.35, scale: 0.7, glow: 0.8, use: 'campfire', label: 'The camp fire' });
  m.deco('footprints', 21.6, 40.6, { radius: 0.2, scale: 0.6, glow: 0.3, use: 'footprints', solid: false, label: 'A deck-plank with two scorched footprints in it' });
  m.deco('crates', 29.8, 47.0, { radius: 0.4, scale: 0.8, label: 'What came out of the hold' });
  m.npc('vane_dw', 25.4, 40.4, { facing: Math.PI / 2 });
  m.npc('tobiah_dw', 30.0, 44.0, { facing: 0 });
  m.npc('mags_dw', 29.4, 39.8, { facing: Math.PI });
  m.npc('lyra_dw', 25.8, 43.0, { facing: 0, until: 'coda_go' });
  m.npc('kaelen_dw', 29.2, 42.6, { facing: Math.PI });
  m.npc('sable_dw', 24.4, 41.8, { facing: 0, requires: 'sable_with' });
  m.npc('aegis_dw', 32.2, 40.2, { facing: -Math.PI / 2, requires: 'aegis_follow', scale: 1.2 });
  m.npc('herald', 27.5, 50.6, { facing: -Math.PI / 2, requires: 'herald_come' });
  [[24.0, 38.6], [31.4, 42.0], [27.5, 47.4]].forEach(([x, y]) => m.deco('lamp', x, y, { radius: 0.12, scale: 0.6, glow: 0.45 }));
  // the sexton's yard, west of the Mausoleum
  for (let i = 0; i < 12; i++) m.deco('grave', 6.5 + (i % 4) * 2.4, 13.0 + Math.floor(i / 4) * 2.6, { radius: 0.25, scale: 0.7, label: ['A headstone with a bell on it. The name is worn away.', 'CANTOR\'S CLERK. The rest is lichen.', 'A small stone. A small grave.'][i % 3] });
  m.deco('grave', 11.6, 21.2, { radius: 0.3, scale: 0.8, use: 'nan_grave', label: 'A new headstone with a bell carved on it, and no name. Under it, a grave dug open.' });
  m.npc('sexton', 10.6, 21.4, { facing: 0 });
  // the cutter, east, with the willow-crown through her bow
  m.deco('cutter', 46.6, 23.6, { radius: 1.7, scale: 2.6, use: 'cutter', label: 'The Office cutter OC-742, split at the bow' });
  m.enemy('horn', 44.2, 26.6); m.enemy('bosun', 47.6, 27.4, { name: 'Bosun Teller' });
  m.enemy('marine', 43.0, 21.8); m.enemy('marine', 49.6, 21.6); m.enemy('marine', 45.0, 29.4);
  m.enemy('proctor', 41.2, 24.6); m.enemy('proctor', 50.6, 26.2);
  // the weaverling nests, south-west
  [[6.5, 38.5], [11.6, 44.6], [5.4, 45.2]].forEach(([x, y], i) => m.deco('web', x, y, { radius: 0.25, scale: 1.1, glow: 0.4, use: 'silk', silk: i, label: 'A web of lilac silk, thick as sailcloth' }));
  m.deco('cocoon', 9.0, 47.6, { radius: 0.3, scale: 1.0, glow: 0.3, label: 'A deer, wound in silk. It is still breathing.' });
  [[8.0, 40.0], [10.0, 42.0], [6.4, 43.0], [12.4, 39.6], [7.6, 46.4]].forEach(([x, y]) => m.enemy('weaverling', x, y));
  // the hush-lamp shrine, south-east: the Hush is drawn to light
  m.deco('lamp', 45.5, 45.5, { radius: 0.2, scale: 1.0, glow: 0.8, use: 'shrine', label: 'A hush-lamp shrine, still burning' });
  [[44.0, 44.2], [47.0, 44.2], [44.0, 46.8], [47.0, 46.8]].forEach(([x, y]) => m.deco('lamp', x, y, { radius: 0.12, scale: 0.55, glow: 0.4 }));
  m.enemy('quiet', 43.0, 48.6); m.enemy('quiet', 48.6, 42.4);
  // the Mausoleum's mourners, and what the mist has got into
  [[21.0, 15.2], [34.6, 14.6], [27.5, 18.4]].forEach(([x, y]) => m.enemy('dirge', x, y));
  m.enemy('drowned', 15.2, 30.0); m.enemy('drowned', 38.6, 35.0);
  m.enemy('hound', 18.0, 20.0); m.enemy('hound', 38.0, 14.0); m.enemy('hound', 13.0, 33.6);
  m.item('tonic', 47.4, 47.4); m.item('pellets', 43.8, 43.6); m.item('honey', 4.2, 41.0); m.item('tonic', 52.0, 28.0); m.item('w_spear', 12.8, 12.4);
  // trees
  const rnd = mulberry32(852);
  const keep = (x, y) => ((x - 27.5) ** 2 + (y - 43) ** 2 < 70) || (x > 20 && x < 35 && y < 15) || (x > 40 && x < 53 && y > 19 && y < 31) || (x > 3 && x < 15 && y > 11 && y < 23) || (x > 42 && x < 49 && y > 42 && y < 49) || (Math.abs(x - 27.5) < 2 && y > 12);
  for (let i = 0, n = 0; i < 900 && n < 70; i++) {
    const x = 2 + rnd() * (W - 4), y = 2 + rnd() * (H - 4), ix = x | 0, iy = y | 0;
    if (m.isBlocked(ix, iy) || m.floorCells[iy * W + ix] || keep(x, y)) continue;
    if (m.entities.some(e => (e.x - x) ** 2 + (e.y - y) ** 2 < 4)) continue;
    let near = false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (m.isSolidCell(ix + dx, iy + dy)) near = true;
    if (near) continue;
    if (rnd() < 0.75) m.deco('willow', x, y, { scale: 1.7 + rnd() * 0.9, radius: 0.4, label: 'A silver willow older than the Synod. Its fronds touch the moss, and the moss lights where they touch.' });
    else m.deco('oak', x, y, { scale: 1.6 + rnd() * 0.6, radius: 0.4, label: 'A black oak, dead standing, hung with lilac moss' });
    n++;
  }
  return m;
}

function buildMausoleum() {
  const W = 40, H = 34;
  const m = new GameMap('mausoleum', 'The Mausoleum of Chords', W, H, { floor: 't_marble', floorTextures: ['t_marble', 't_flag', 't_water'], ceil: 't_greymarble', fogDist: 11, ambient: 0.12, fogColor: [22, 16, 34], music: 'mausoleum', danger: 1, spawn: { x: 19.5, y: 31.2, dir: -Math.PI / 2 } });
  m.rect(0, 0, W - 1, H - 1, 't_mausoleum');
  const room = (x0, y0, x1, y1) => m.clear(x0, y0, x1, y1);
  room(17, 28, 22, 32);                       // the narthex
  room(19, 27, 20, 27); room(12, 18, 27, 26); // the hall of tombs
  room(10, 21, 11, 22); room(2, 18, 9, 24);   // west: the vestry
  room(28, 21, 29, 22); room(30, 18, 37, 26); // east: under the bell-tower
  room(19, 13, 19, 17); room(12, 2, 27, 12);  // north: the choir
  for (let y = 18; y <= 26; y++) for (let x = 12; x <= 27; x++) if ((x + y) % 2) m.setFloor(x, y, 1);
  [[16, 5], [23, 5], [16, 9], [23, 9], [15, 20], [24, 20], [15, 24], [24, 24]].forEach(([x, y]) => m.set(x, y, WALL('t_greymarble')));
  m.set(19, 33, DOOR({ portal: { map: 'deepwoods', x: 27.5, y: 13.7, dir: Math.PI / 2 }, label: 'Out to the Deep Woods' }));
  m.set(19, 15, DOOR({ label: 'The choir door, bronze, with four bells set in it', locked: 'tombs_rung', lockMsg: 'A bronze door with four small bells set into it, in a row, each stopped with felt. It does not open. Back in the hall the tombs are waiting to be rung.' }));
  // light
  [[17.6, 28.6], [21.4, 28.6], [12.6, 18.6], [27.4, 18.6], [12.6, 25.4], [27.4, 25.4], [2.6, 18.6], [37.4, 18.6], [12.6, 2.6], [27.4, 2.6], [12.6, 11.4], [27.4, 11.4]].forEach(([x, y]) => m.deco('lamp', x, y, { radius: 0.12, scale: 0.6, glow: 0.45 }));
  m.deco('sign', 21.6, 30.0, { radius: 0.2, scale: 0.6, use: 'maus_inscription', label: 'An inscription over the inner door' });
  // the four Cantors
  [[13.6, 19.6], [13.6, 25.0], [26.4, 19.6], [26.4, 25.0]].forEach(([x, y], i) => m.deco('tomb', x, y, { radius: 0.5, scale: 0.9, glow: 0.2, use: 'tomb', tomb: i, label: `The tomb of ${TOMB_NOTES[i][0]} — ${TOMB_NOTES[i][1]}` }));
  m.enemy('warden', 17.6, 22.4, { guard: true }); m.enemy('warden', 22.4, 22.4, { guard: true });
  // the vestry: the register
  m.deco('shelf', 2.6, 21.0, { radius: 0.2, scale: 0.9 });
  m.deco('table', 5.5, 21.0, { radius: 0.4, scale: 0.7, use: 'maus_register', label: 'The sexton\'s desk. The register is open on it.' });
  m.enemy('dirge', 4.0, 19.0); m.enemy('dirge', 7.6, 23.4);
  // under the bell-tower
  m.deco('bones', 33.0, 19.0, { radius: 0.3, scale: 0.6 }); m.deco('coil', 35.6, 24.4, { radius: 0.3, scale: 0.7, label: 'The bell-rope, cut, coiled on the floor' });
  m.enemy('warden', 34.0, 22.0); m.enemy('mites', 36.4, 19.6); m.enemy('dirge', 31.0, 25.0);
  // the choir
  m.deco('tomb', 19.5, 3.4, { radius: 0.6, scale: 1.2, glow: 0.35, label: 'The tomb of the Veil\'s first scribe. It is humming.' });
  [[14.0, 7.0], [25.0, 7.0]].forEach(([x, y]) => m.deco('hymnboard', x, y, { radius: 0.3, scale: 0.8, label: 'A board of funeral offices, a hundred names long' }));
  m.npc('lyra_dw', 14.6, 11.0, { facing: -Math.PI / 2, requires: 'coda_go' });
  m.item('tonic', 2.6, 23.6); m.item('pellets', 37.2, 25.6); m.item('honey', 26.6, 2.6); m.item('w_mace', 12.8, 2.8);
  m.trigger(19.5, 12.4, 1.6, 'coda_choir');
  return m;
}

// ---------------------------------------------------------------- Part Four, second pass
function extendDeepWoods(m) {
  // the Brood-Mother, at the heart of the nests
  m.enemy('broodmother', 10.2, 45.8);
  // the ring of lamps in the clearing north of the camp (Book One ch. 23; js/coda.js RING): six lamps, Lyra past the last one
  for (let i = 0; i < RING.lamps; i++) { const [x, y] = ringPos(i); m.deco('lamp', x, y, { radius: 0.12, scale: 0.7, glow: 0.6, requires: 'ring_set', ringLamp: true, label: 'A hush-lamp from the camp, set at the edge of the trees' }); }
  m.npc('lyra_dw', RING.bx, RING.by, { facing: -Math.PI / 2, requires: 'ring_go', ringLyra: true });
  m.trigger(RING.cx, RING.cy, 2.2, 'ring');
  // Hollow mourners walking the yard to the Mausoleum door and back, waiting for the bell
  const route = [[12.6, 17.6], [16.4, 15.6], [20.2, 14.2], [24.6, 13.8], [27.5, 13.7]];
  const rests = [[6.5, 13.9], [8.9, 16.5], [11.3, 13.9], [13.7, 19.1]];
  rests.forEach(([rx, ry], i) => {
    const start = route[i % route.length];
    m.npc('mourner', start[0], start[1] + (i % 2 ? 0.4 : -0.4), { solid: false, radius: 0.25, path: route.map(([x, y]) => [x + (i % 2 ? 0.3 : -0.3), y + (i - 1.5) * 0.25]), pi: i % route.length, dirn: i % 2 ? -1 : 1, rest: [rx, ry] });
  });
}
function extendMausoleum(m) {
  m.set(38, 22, DOOR({ portal: { map: 'belfry', x: 2.5, y: 5.5, dir: 0 }, label: 'The tower stair' }));
}
function buildBelfry() {
  const W = 14, H = 10;
  const m = new GameMap('belfry', 'The Bell-Tower', W, H, { floor: 't_wood', floorTextures: ['t_wood', 't_flag', 't_water'], ceil: 't_wood', fogDist: 10, ambient: 0.16, fogColor: [22, 16, 34], music: 'mausoleum', danger: 1, spawn: { x: 2.5, y: 5.5, dir: 0 } });
  m.ceilZ = 3.3;   // a tall room: the walls and pillars reach this, not one unit
  m.rect(0, 0, W - 1, H - 1, 't_mausoleum');
  m.clear(1, 1, W - 2, H - 2);
  m.set(0, 5, DOOR({ portal: { map: 'mausoleum', x: 37.0, y: 22.5, dir: Math.PI }, label: 'Down the tower stair' }));
  // pillars are blocks topped at the ceiling, so the tallest point the renderer scans is the ceiling
  [[4, 3], [4, 6], [8, 3], [8, 6]].forEach(([x, y]) => m.block(x, y, 't_greymarble', m.ceilZ));
  // The timber stair: six 0.3 rises along the north wall, two cells wide, up to
  // the bell gallery (stone-skirted, 1.8 high) on the east side.
  const GALLERY = 1.8, stepH = (x) => 0.3 * (x - 2);
  for (let x = 3; x <= 8; x++) for (const y of [1, 2]) m.setLvl(x, y, stepH(x));
  m.raise(9, 1, 12, 8, GALLERY);
  m.setSide(3, 1, 8, 2, 't_wood'); m.setSide(9, 1, 12, 8, 't_stone');
  // Railings: low blocks, knee-high above the walkway they guard. The stair's
  // south side runs between the pillars; the gallery's west edge is railed
  // except the two south cells, which stay an open drop.
  for (const x of [3, 5, 6, 7]) { m.setLvl(x, 3, stepH(x)); m.block(x, 3, 't_wood', stepH(x) + 0.3, { capTex: 't_wood' }); }
  m.setSide(3, 3, 7, 3, 't_wood');
  for (let y = 3; y <= 6; y++) m.block(9, y, 't_wood', GALLERY + 0.3, { capTex: 't_wood' });
  m.deco('bigbell', 10.2, 4.9, { radius: 0.8, scale: 1.7, yOff: -0.15, glow: 0.2, use: 'tower_bell', label: 'The great bell of the Mausoleum of Chords' });
  [[1.6, 1.6], [12.4, 1.6], [1.6, 8.4], [12.4, 8.4]].forEach(([x, y]) => m.deco('lamp', x, y, { radius: 0.12, scale: 0.55, glow: 0.4 }));
  m.deco('coil', 6.2, 8.2, { radius: 0.3, scale: 0.6, label: 'The other end of the bell-rope, cut clean with a spade' });
  m.deco('bones', 11.8, 7.6, { radius: 0.3, scale: 0.6 });
  m.enemy('dirge', 11.4, 2.4); m.enemy('dirge', 11.4, 7.6); m.enemy('mites', 6.4, 1.8);
  m.item('tonic', 12.4, 4.6);
  return m;
}

// ---------------------------------------------------------------- Part Four, third pass
function extendDeepWoods3(m) {
  // nudge a spot off any tree or deco it would stand inside
  const spot = (x, y) => {
    for (let k = 0; k < 12; k++) {
      const a = k * 2.4, r = k ? 0.5 + k * 0.15 : 0, nx = x + Math.cos(a) * r, ny = y + Math.sin(a) * r;
      if (m.isBlocked(nx | 0, ny | 0) || m.floorCells[(ny | 0) * m.w + (nx | 0)] === 2) continue;
      if (m.entities.some(e => e.solid && e.kind === 'deco' && (e.x - nx) ** 2 + (e.y - ny) ** 2 < 0.8)) continue;
      return [nx, ny];
    }
    return [x, y];
  };
  // the Quiet Faith's hush-gift, north-west past the pools
  const [wx, wy] = spot(5.4, 4.4);
  m.npc('wren', wx, wy, { facing: 0, until: 'wren_gone', radius: 0.25 });
  m.deco('lamp', wx, wy - 1.0, { radius: 0.12, scale: 0.75, glow: 0.9, solid: false, use: 'gift_lamp', giftLamp: true, label: 'One hush-lamp, lit, on a stake beside the child. Its reed-whistle has been stopped with wax.' });
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + 0.5; m.deco('lamp', wx + Math.cos(a) * 1.5, wy + Math.sin(a) * 1.5, { radius: 0.1, scale: 0.5, glow: 0, solid: false, label: 'A hush-lamp, unlit, set in a ring in the moss' }); }
  m.enemy('deacon', ...spot(12.4, 3.4), { passive: true, giftGuard: true });
  [[13.2, 6.2], [11.2, 9.4], [3.0, 8.8], [9.2, 2.2]].forEach(([x, y]) => m.enemy('tongueless', ...spot(x, y), { passive: true, giftGuard: true }));
  m.enemy('quiet', ...spot(15.0, 2.6), { requires: 'gift_quiets', passive: true, giftQ: true });
  m.enemy('quiet', ...spot(2.6, 12.4), { requires: 'gift_quiets', passive: true, giftQ: true });
  m.trigger(wx, wy + 1, 11, 'gift_far');
  m.trigger(wx, wy, 4.4, 'gift_ring');
  // hush-moths at the lights
  [[4.2, 2.2], [44.4, 42.2], [47.8, 48.4], [42.4, 45.6]].forEach(([x, y]) => m.enemy('hushmoth', ...spot(x, y)));
  // the Arbiter's search party, on the north-east cart-track
  m.deco('sign', ...spot(47.4, 2.4), { radius: 0.2, scale: 0.8, label: 'A Synod way-post: TRAMWAY 9 DAYS. The paint is fresh.' });
  m.enemy('captain', ...spot(48.4, 7.8), { requires: 'party_come', party: true });
  [[45.0, 6.0], [51.0, 10.4], [46.4, 12.2]].forEach(([x, y]) => m.enemy('outrider', ...spot(x, y), { requires: 'party_come', party: true }));
  [[49.6, 5.0], [43.6, 9.6]].forEach(([x, y]) => m.enemy('hushwarden', ...spot(x, y), { requires: 'party_come', party: true }));
  [[48.6, 7.0], [45.6, 7.2], [50.6, 9.2]].forEach(([x, y]) => m.deco('lamp', ...spot(x, y), { radius: 0.12, scale: 0.55, glow: 0.5, solid: false, requires: 'party_come', until: 'party_webbed', label: 'An Office hush-lantern, hooded, set down in the moss' }));
  // the false trail, in the heart of the nests
  m.deco('web', ...spot(8.6, 42.4), { radius: 0.25, scale: 1.3, glow: 0.45, use: 'trail_spot', label: 'The heart of the nests, where every thread meets. A good place for a voice to get lost.' });
  m.deco('cocoon', ...spot(6.0, 41.0), { radius: 0.3, scale: 1.0, glow: 0.3, requires: 'party_webbed', label: 'An Office outrider, wound in silk, still holding his crossbow' });
  m.deco('cocoon', ...spot(10.8, 40.2), { radius: 0.3, scale: 1.0, glow: 0.3, requires: 'party_webbed', label: 'A hushwarden, wound in silk with his felted bell' });
  m.deco('cocoon', ...spot(4.8, 44.0), { radius: 0.35, scale: 1.15, glow: 0.3, requires: 'party_webbed', use: 'captain_cocoon', label: 'Outrider-Captain Hal Brennick, wound in silk. His lantern is still lit inside it.' });
  // Wren at the camp fire, once she is safe
  m.npc('wren_dw', 24.7, 44.0, { facing: Math.PI / 2, requires: 'wren_saved', radius: 0.25 });
}
