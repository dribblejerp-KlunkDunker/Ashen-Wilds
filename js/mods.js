// ============================================================
//  mods — Phase 7: versioned, data-only mod schemas, a hand-written validator,
//  a local mod library (localStorage), a "Mod dungeons" panel and a grid dungeon editor.
//
//  Safety model (see docs/mods.md):
//   * A mod is JSON. Nothing in it is ever executed: no eval, no Function, no dynamic import,
//     no script or markup. Every key is on an allow-list (unknown keys are rejected), every string
//     is length-limited and may not contain markup characters, every number is range-checked or
//     clamped, every sprite / texture / enemy / item reference must be a name from the game's own
//     catalogs, and the validator REBUILDS a clean copy of the mod from scratch (the "normalized"
//     mod); only that copy is ever stored or used.
//   * Mod ids are namespaced "mod:<modid>:<local>" (maps, enemies, items, NPCs) and quest flags
//     live under "mod:<modid>:" in G.flags, so a mod can never touch a base flag or catalog entry.
//   * Nothing is added to the save format: mod map states ride in the existing per-map section, mod
//     flags in G.flags. A save made inside a mod map relocates to the dungeon's entrance when the mod is
//     missing or changed (restoreGame wrapper); a base save never needs a mod.
//   * Switch: GFX-free; "off" = no enabled mods. The Options menu gets one row, "Mod dungeons".
//  Art: the editor draws its grid from the game's own textures (procedural stand-in UI).
// ============================================================
'use strict';

const MODS = (() => {
  // ------------------------------------------------------------------ limits & catalogs
  const LIM = {
    fileChars: 131072, storeChars: 786432, mods: 12, maps: 3, enemies: 8, items: 16, npcs: 8, quests: 8,
    entities: 80, enemiesPerMap: 40, rules: 16, effects: 6, flags: 32, walls: 8,
    mapMin: 8, mapMax: 40, name: 40, author: 40, desc: 200, text: 300, nodes: 20000, depth: 10, str: 2000, errors: 40,
  };
  // Wall textures a mod may use, in canonical order (the order normalization sorts them into).
  const WALL_TEX = ['t_stone', 't_wood', 't_house', 't_roof', 't_hedge', 't_cobble', 't_glassrock', 't_marble', 't_brass', 't_greymarble', 't_catacomb', 't_mausoleum', 't_deepwood', 't_moss'];
  const FLOOR_TEX = ['t_flag', 't_cobble', 't_grass', 't_wood', 't_moss', 't_stone', 't_marble', 't_greymarble'];
  const CEIL_TEX = ['t_stone', 't_wood', 'c_beams', 'c_vault', 'c_rock'];
  const MUSIC = ['dungeon', 'inside', 'cloister', 'mausoleum', 'root'];
  // Enemy behaviour types a mod may vary. Bosses and the ones game.js special-cases by id are excluded.
  const ENEMY_BASES = ['hound', 'legionnaire', 'golem', 'proctor', 'mites', 'quiet', 'weaverling', 'drowned', 'marine', 'dirge', 'warden', 'tongueless', 'outrider', 'hushwarden', 'hushmoth', 'deacon', 'captain'];
  const PROPS = ['lamp', 'crates', 'bones', 'chair', 'table', 'bed', 'shelf', 'hearth', 'pump', 'sign', 'chest', 'basin', 'campfire', 'grave', 'cores', 'gear', 'web', 'tomb', 'oak'];
  const NPC_SPRITES = ['townsman', 'townswoman', 'hetty', 'hob', 'nell', 'orla', 'aldric', 'tam', 'bettany', 'pim', 'harrow', 'tongueless'];
  const PORTRAITS = ['townsman', 'townswoman', 'harrow', 'hetty', 'hob', 'mags', 'nell', 'orla', 'pim', 'tam', 'quist', 'wren', 'aldric', 'bettany', 'rooke', 'tongueless'];
  const ITEM_SPRITES = ['loot', 'gear', 'chest', 'coil', 'cores'];
  const ITEM_KINDS = ['trinket', 'tonic', 'draught', 'key'];
  const TRIGGERS = ['enter', 'talk', 'pickup'];
  const EFFECTS = ['journal', 'say', 'give', 'gold', 'setFlag', 'spawn'];
  const STATIC_ITEMS = ['tonic', 'honey', 'pellets', 'sovereigns'];
  const ID_RE = /^[a-z][a-z0-9_]{0,23}$/;
  const MODID_RE = /^[a-z][a-z0-9_]{2,23}$/;
  const VER_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  // markup, entities, backslashes, backticks, control and bidi-override characters
  const BAD_TEXT = /[<>&`\\\u0000-\u001f\u007f-\u009f\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]/;
  const BAD_URL = /\b(?:javascript|vbscript)\s*:/i;
  const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype'];
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const clampN = (v, a, b) => (v < a ? a : v > b ? b : v);
  const r2 = v => Math.round(v * 100) / 100;

  // Live catalogs: textures and sprites must exist in the engine, items in ITEMS. Falls back to the static
  // lists when run outside the game (a Node check of the validator).
  function liveHas(kind, name) {
    try {
      if (typeof Engine === 'undefined' || !Engine) return true;
      const t = kind === 'tex' ? Engine.textures : Engine.sprites; return !t || has(t, name);
    } catch (e) { return true; }
  }
  function catalogItems() {
    if (typeof ITEMS === 'undefined') return STATIC_ITEMS.slice();
    const out = [];
    for (const id of Object.keys(ITEMS)) {
      if (id.indexOf('mod:') === 0) continue; // a mod item is never a "catalog" item
      const it = ITEMS[id]; if (!it || it.key || it.armor || it.weapon) continue;
      if (id === 'sovereigns' || it.valuable || it.use === 'heal' || it.use === 'voice' || it.use === 'ammo') out.push(id);
    }
    return out;
  }
  function enemyBaseOk(id) { return ENEMY_BASES.includes(id) && (typeof ENEMIES === 'undefined' || has(ENEMIES, id)); }

  // ------------------------------------------------------------------ validator
  function Report() { this.errors = []; this.warnings = []; }
  Report.prototype.err = function (path, msg) { if (this.errors.length < LIM.errors) this.errors.push(path + ': ' + msg); else if (this.errors.length === LIM.errors) this.errors.push('...and more errors'); };
  Report.prototype.warn = function (path, msg) { if (this.warnings.length < LIM.errors) this.warnings.push(path + ': ' + msg); };

  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  // Structural scan: depth, node count, forbidden keys, non-JSON types, oversized strings.
  function scan(root, rp) {
    let nodes = 0; const stack = [[root, 0, '$']];
    while (stack.length) {
      const [v, d, p] = stack.pop();
      if (++nodes > LIM.nodes) { rp.err(p, 'too many values in the file'); return false; }
      if (d > LIM.depth) { rp.err(p, 'nested too deeply'); return false; }
      const t = typeof v;
      if (v === null || t === 'boolean') continue;
      if (t === 'number') { if (!isFinite(v)) { rp.err(p, 'numbers must be finite'); return false; } continue; }
      if (t === 'string') { if (v.length > LIM.str) { rp.err(p, 'string far too long'); return false; } continue; }
      if (t !== 'object') { rp.err(p, 'only JSON data is allowed (found ' + t + ')'); return false; }
      if (Array.isArray(v)) { if (v.length > 5000) { rp.err(p, 'array too long'); return false; } for (let i = 0; i < v.length; i++) stack.push([v[i], d + 1, p + '[' + i + ']']); continue; }
      const proto = Object.getPrototypeOf(v);
      if (proto !== Object.prototype && proto !== null) { rp.err(p, 'not a plain object'); return false; }
      for (const k of Object.keys(v)) {
        if (FORBIDDEN_KEYS.includes(k)) { rp.err(p, 'forbidden key "' + k + '"'); return false; }
        stack.push([v[k], d + 1, p + '.' + k]);
      }
    }
    return true;
  }
  function T(rp, v, path, max, o) {
    o = o || {};
    if (v === undefined) { if (o.opt) return undefined; rp.err(path, 'required'); return undefined; }
    if (typeof v !== 'string') { rp.err(path, 'must be text'); return undefined; }
    const s = v.replace(/\s+/g, ' ').trim();
    if (!s && !o.empty) { rp.err(path, 'must not be empty'); return undefined; }
    if (s.length > max) { rp.err(path, 'too long (max ' + max + ' characters)'); return undefined; }
    if (BAD_TEXT.test(s)) { rp.err(path, 'markup, backslashes and control characters are not allowed in text'); return undefined; }
    if (BAD_URL.test(s)) { rp.err(path, 'script addresses are not allowed'); return undefined; }
    return s;
  }
  // mode 'clamp': out of range -> warning + clamp. mode 'strict' (default): out of range -> error.
  function N(rp, v, path, lo, hi, o) {
    o = o || {};
    if (v === undefined) { if (o.def !== undefined) return o.def; if (o.opt) return undefined; rp.err(path, 'required'); return undefined; }
    if (typeof v !== 'number' || !isFinite(v)) { rp.err(path, 'must be a number'); return undefined; }
    if (o.int && !Number.isInteger(v)) { if (o.clamp) v = Math.round(v); else { rp.err(path, 'must be a whole number'); return undefined; } }
    if (v < lo || v > hi) {
      if (o.clamp) { rp.warn(path, 'clamped into ' + lo + '..' + hi); v = clampN(v, lo, hi); } else { rp.err(path, 'out of range (' + lo + '..' + hi + ')'); return undefined; }
    }
    return o.int ? v : r2(v);
  }
  function E(rp, v, path, list, def) {
    if (v === undefined) { if (def !== undefined) return def; rp.err(path, 'required'); return undefined; }
    if (typeof v !== 'string' || !list.includes(v)) { rp.err(path, 'must be one of: ' + list.join(', ')); return undefined; }
    return v;
  }
  function ID(rp, v, path, re) {
    if (v === undefined) { rp.err(path, 'required'); return undefined; }
    if (typeof v !== 'string' || !(re || ID_RE).test(v)) { rp.err(path, 'must be lowercase letters, digits and underscores, starting with a letter'); return undefined; }
    return v;
  }
  function OBJ(rp, v, path, allowed) {
    if (!isObj(v)) { rp.err(path, 'must be an object'); return null; }
    for (const k of Object.keys(v)) if (!allowed.includes(k)) rp.err(path + '.' + k, 'unknown field (not part of the schema)');
    return v;
  }
  function ARR(rp, v, path, max, opt) {
    if (v === undefined) { if (!opt) rp.err(path, 'required'); return []; }
    if (!Array.isArray(v)) { rp.err(path, 'must be a list'); return []; }
    if (v.length > max) { rp.err(path, 'too many entries (max ' + max + ')'); return v.slice(0, max); }
    return v;
  }

  // ---- enemies
  function vEnemy(rp, e, path) {
    if (!OBJ(rp, e, path, ['id', 'base', 'name', 'hp', 'dmg', 'speed', 'reach', 'scale', 'xp', 'desc'])) return null;
    const o = {};
    o.id = ID(rp, e.id, path + '.id');
    o.base = E(rp, e.base, path + '.base', ENEMY_BASES);
    if (o.base && !enemyBaseOk(o.base)) rp.err(path + '.base', 'this game has no enemy "' + o.base + '"');
    o.name = T(rp, e.name, path + '.name', LIM.name);
    o.hp = N(rp, e.hp, path + '.hp', 1, 250, { int: true, clamp: true });
    let dmg = e.dmg;
    if (!Array.isArray(dmg) || dmg.length !== 2) { rp.err(path + '.dmg', 'must be [low, high]'); } else {
      let a = N(rp, dmg[0], path + '.dmg[0]', 0, 30, { int: true, clamp: true }), b = N(rp, dmg[1], path + '.dmg[1]', 0, 30, { int: true, clamp: true });
      if (a !== undefined && b !== undefined) { if (a > b) { rp.warn(path + '.dmg', 'low was above high; swapped'); const t = a; a = b; b = t; } o.dmg = [a, b]; }
    }
    o.speed = N(rp, e.speed, path + '.speed', 0.3, 2.6, { clamp: true });
    const reach = N(rp, e.reach, path + '.reach', 0.7, 1.8, { clamp: true, opt: true }); if (reach !== undefined) o.reach = reach;
    const scale = N(rp, e.scale, path + '.scale', 0.5, 1.5, { clamp: true, opt: true }); if (scale !== undefined) o.scale = scale;
    const xp = N(rp, e.xp, path + '.xp', 0, 200, { int: true, clamp: true, opt: true }); if (xp !== undefined) o.xp = xp;
    const desc = T(rp, e.desc, path + '.desc', LIM.desc, { opt: true }); if (desc !== undefined) o.desc = desc;
    return o;
  }
  // ---- items
  function vItem(rp, it, path) {
    if (!OBJ(rp, it, path, ['id', 'name', 'desc', 'kind', 'sprite', 'n', 'value'])) return null;
    const o = {};
    o.id = ID(rp, it.id, path + '.id');
    o.name = T(rp, it.name, path + '.name', LIM.name);
    o.desc = T(rp, it.desc, path + '.desc', LIM.desc);
    o.kind = E(rp, it.kind, path + '.kind', ITEM_KINDS);
    const sp = it.sprite === undefined ? 'loot' : it.sprite;
    o.sprite = E(rp, sp, path + '.sprite', ITEM_SPRITES); if (o.sprite && !liveHas('spr', o.sprite)) rp.err(path + '.sprite', 'unknown sprite');
    if (o.kind === 'tonic' || o.kind === 'draught') o.n = N(rp, it.n, path + '.n', 1, 30, { int: true, clamp: true, def: 10 });
    else if (it.n !== undefined) rp.err(path + '.n', 'only tonics and draughts have n');
    if (o.kind === 'trinket') o.value = N(rp, it.value, path + '.value', 1, 50, { int: true, clamp: true, def: 5 });
    else if (it.value !== undefined) rp.err(path + '.value', 'only trinkets have a value');
    return o;
  }
  // ---- NPCs
  function vNpc(rp, n, path) {
    if (!OBJ(rp, n, path, ['id', 'name', 'sprite', 'portrait', 'greet'])) return null;
    const o = {};
    o.id = ID(rp, n.id, path + '.id');
    o.name = T(rp, n.name, path + '.name', LIM.name);
    o.sprite = E(rp, n.sprite, path + '.sprite', NPC_SPRITES); if (o.sprite && !liveHas('spr', o.sprite)) rp.err(path + '.sprite', 'unknown sprite');
    o.portrait = E(rp, n.portrait, path + '.portrait', PORTRAITS);
    o.greet = T(rp, n.greet, path + '.greet', LIM.text);
    return o;
  }

  // ---- maps
  const WALKABLE = '.SDX';
  function vMap(rp, m, path) {
    if (!OBJ(rp, m, path, ['id', 'name', 'w', 'h', 'floor', 'ceil', 'walls', 'rows', 'ambient', 'fog', 'music', 'startDir', 'entities'])) return null;
    const o = {};
    o.id = ID(rp, m.id, path + '.id');
    o.name = T(rp, m.name, path + '.name', LIM.name);
    o.w = N(rp, m.w, path + '.w', LIM.mapMin, LIM.mapMax, { int: true });
    o.h = N(rp, m.h, path + '.h', LIM.mapMin, LIM.mapMax, { int: true });
    o.floor = E(rp, m.floor, path + '.floor', FLOOR_TEX, 't_flag');
    o.ceil = m.ceil === null ? null : E(rp, m.ceil, path + '.ceil', CEIL_TEX, 't_stone');
    for (const k of ['floor', 'ceil']) if (o[k] && !liveHas('tex', o[k])) rp.err(path + '.' + k, 'unknown texture');
    // wall palette
    const walls = ARR(rp, m.walls, path + '.walls', LIM.walls);
    const wtex = [];
    walls.forEach((t, i) => {
      const v = E(rp, t, path + '.walls[' + i + ']', WALL_TEX);
      if (v) { if (wtex.includes(v)) rp.err(path + '.walls[' + i + ']', 'duplicate texture'); if (!liveHas('tex', v)) rp.err(path + '.walls[' + i + ']', 'unknown texture'); }
      wtex.push(v);
    });
    o.ambient = N(rp, m.ambient, path + '.ambient', 0, 0.5, { clamp: true, def: 0.18 });
    o.fog = N(rp, m.fog, path + '.fog', 4, 24, { clamp: true, def: 12 });
    o.music = E(rp, m.music, path + '.music', MUSIC, 'dungeon');
    const sd = m.startDir === undefined ? 0 : m.startDir;
    o.startDir = [0, 90, 180, 270].includes(sd) ? sd : (rp.err(path + '.startDir', 'must be 0, 90, 180 or 270'), undefined);
    // grid
    const rows = ARR(rp, m.rows, path + '.rows', LIM.mapMax);
    let grid = null, sx = -1, sy = -1, xx = -1, xy = -1, bad = false;
    if (o.w && o.h) {
      if (rows.length !== o.h) { rp.err(path + '.rows', 'needs exactly h (' + o.h + ') rows'); bad = true; }
      grid = [];
      for (let y = 0; y < Math.min(rows.length, o.h) && !bad; y++) {
        const r = rows[y];
        if (typeof r !== 'string' || r.length !== o.w) { rp.err(path + '.rows[' + y + ']', 'must be text exactly w (' + o.w + ') characters wide'); bad = true; break; }
        const line = [];
        for (let x = 0; x < o.w; x++) {
          const ch = r[x];
          if (ch === '.' || ch === 'D') line.push(ch);
          else if (ch === 'S') { if (sx >= 0) { rp.err(path + '.rows', 'more than one start (S)'); bad = true; } sx = x; sy = y; line.push(ch); }
          else if (ch === 'X') { if (xx >= 0) { rp.err(path + '.rows', 'more than one exit (X)'); bad = true; } xx = x; xy = y; line.push(ch); }
          else if (ch >= '1' && ch <= '8') { const idx = +ch - 1; if (idx >= wtex.length || !wtex[idx]) { rp.err(path + '.rows[' + y + ']', 'wall "' + ch + '" is not in the walls list'); bad = true; } line.push(ch); }
          else { rp.err(path + '.rows[' + y + ']', 'unknown cell character "' + (ch.length ? ch.charCodeAt(0) < 32 ? '?' : ch : '?') + '" (use . 1-8 D S X)'); bad = true; break; }
        }
        grid.push(line);
        if (bad) break;
      }
      if (!bad) {
        if (sx < 0) rp.err(path + '.rows', 'needs a start (S)');
        if (xx < 0) rp.err(path + '.rows', 'needs an exit (X)');
        if (sx >= 0 && xx >= 0 && !reachable(grid, o.w, o.h, sx, sy, xx, xy)) rp.err(path + '.rows', 'the exit cannot be reached from the start');
      }
    }
    // entities
    const ents = ARR(rp, m.entities, path + '.entities', LIM.entities, true);
    const outEnts = []; let nEn = 0;
    ents.forEach((e, i) => {
      const p = path + '.entities[' + i + ']';
      if (!isObj(e)) { rp.err(p, 'must be an object'); return; }
      const kind = E(rp, e.kind, p + '.kind', ['enemy', 'item', 'prop', 'npc']);
      const allowed = { enemy: ['kind', 'type', 'modEnemy', 'x', 'y'], item: ['kind', 'item', 'modItem', 'x', 'y'], prop: ['kind', 'sprite', 'x', 'y'], npc: ['kind', 'npc', 'x', 'y'] }[kind];
      if (!allowed) return;
      OBJ(rp, e, p, allowed);
      const out = { kind };
      const both = (a, b, label) => { if ((e[a] === undefined) === (e[b] === undefined)) { rp.err(p, 'give exactly one of "' + a + '" (game ' + label + ') or "' + b + '" (this mod\'s)'); return false; } return true; };
      if (kind === 'enemy') {
        if (both('type', 'modEnemy', 'enemy')) {
          if (e.type !== undefined) { out.type = E(rp, e.type, p + '.type', ENEMY_BASES); if (out.type && !enemyBaseOk(out.type)) rp.err(p + '.type', 'this game has no enemy "' + out.type + '"'); } else out.modEnemy = ID(rp, e.modEnemy, p + '.modEnemy');
        }
        nEn++;
      } else if (kind === 'item') {
        if (both('item', 'modItem', 'item')) {
          if (e.item !== undefined) { const cat = catalogItems(); out.item = typeof e.item === 'string' && cat.includes(e.item) ? e.item : (rp.err(p + '.item', 'not an item mods may place (' + cat.slice(0, 8).join(', ') + '...)'), undefined); } else out.modItem = ID(rp, e.modItem, p + '.modItem');
        }
      } else if (kind === 'prop') {
        out.sprite = E(rp, e.sprite, p + '.sprite', PROPS); if (out.sprite && !liveHas('spr', out.sprite)) rp.err(p + '.sprite', 'unknown sprite');
      } else if (kind === 'npc') out.npc = ID(rp, e.npc, p + '.npc');
      out.x = N(rp, e.x, p + '.x', 0.5, (o.w || LIM.mapMax) - 0.5);
      out.y = N(rp, e.y, p + '.y', 0.5, (o.h || LIM.mapMax) - 0.5);
      if (grid && !bad && out.x !== undefined && out.y !== undefined && grid.length === o.h) {
        const ch = (grid[Math.floor(out.y)] || [])[Math.floor(out.x)];
        if (ch !== '.' && ch !== 'S') rp.err(p, 'sits inside a wall, door, start or exit cell');
      }
      outEnts.push(out);
    });
    if (nEn > LIM.enemiesPerMap) rp.err(path + '.entities', 'too many enemies (max ' + LIM.enemiesPerMap + ')');
    // canonical wall order: remap digits to the order of WALL_TEX, keep only used textures
    if (grid && !bad) {
      const used = new Set();
      for (const line of grid) for (const ch of line) if (ch >= '1' && ch <= '8') used.add(wtex[+ch - 1]);
      const canon = WALL_TEX.filter(t => used.has(t));
      o.walls = canon;
      o.rows = grid.map(line => line.map(ch => (ch >= '1' && ch <= '8') ? String(canon.indexOf(wtex[+ch - 1]) + 1) : ch).join(''));
    }
    const kindOrder = { enemy: 0, item: 1, prop: 2, npc: 3 };
    outEnts.sort((a, b) => (a.y - b.y) || (a.x - b.x) || (kindOrder[a.kind] - kindOrder[b.kind]) || String(a.type || a.item || a.sprite || a.npc || a.modEnemy || a.modItem).localeCompare(String(b.type || b.item || b.sprite || b.npc || b.modEnemy || b.modItem)));
    o.entities = outEnts;
    return o;
  }
  function reachable(grid, w, h, sx, sy, xx, xy) {
    const seen = new Uint8Array(w * h), q = [sy * w + sx]; seen[q[0]] = 1;
    while (q.length) {
      const i = q.pop(), x = i % w, y = (i / w) | 0;
      if (x === xx && y === xy) return true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx; if (seen[j] || WALKABLE.indexOf(grid[ny][nx]) < 0) continue; seen[j] = 1; q.push(j);
      }
    }
    return false;
  }

  // ---- quests
  function vQuest(rp, q, path, refs, flags) {
    if (!OBJ(rp, q, path, ['id', 'title', 'rules'])) return null;
    const o = { id: ID(rp, q.id, path + '.id'), title: T(rp, q.title, path + '.title', LIM.name), rules: [] };
    const rules = ARR(rp, q.rules, path + '.rules', LIM.rules); const seen = new Set();
    rules.forEach((r, i) => {
      const p = path + '.rules[' + i + ']';
      if (!OBJ(rp, r, p, ['id', 'when', 'if', 'once', 'then'])) return;
      const out = { id: ID(rp, r.id, p + '.id') };
      if (out.id) { if (seen.has(out.id)) rp.err(p + '.id', 'duplicate rule id'); seen.add(out.id); }
      // trigger
      const w = r.when;
      if (OBJ(rp, w, p + '.when', ['type', 'map', 'x', 'y', 'r', 'npc', 'item', 'modItem'])) {
        const type = E(rp, w.type, p + '.when.type', TRIGGERS);
        const ww = { type };
        if (type === 'enter') {
          ww.map = ID(rp, w.map, p + '.when.map'); if (ww.map && !refs.maps.has(ww.map)) rp.err(p + '.when.map', 'no such map in this mod');
          ww.x = N(rp, w.x, p + '.when.x', 0, LIM.mapMax, { clamp: true }); ww.y = N(rp, w.y, p + '.when.y', 0, LIM.mapMax, { clamp: true });
          ww.r = N(rp, w.r, p + '.when.r', 0.5, 8, { clamp: true, def: 1.5 });
          for (const k of ['npc', 'item', 'modItem']) if (w[k] !== undefined) rp.err(p + '.when.' + k, 'not used by an enter trigger');
        } else if (type === 'talk') {
          ww.npc = ID(rp, w.npc, p + '.when.npc'); if (ww.npc && !refs.npcs.has(ww.npc)) rp.err(p + '.when.npc', 'no such NPC in this mod');
          for (const k of ['map', 'x', 'y', 'r', 'item', 'modItem']) if (w[k] !== undefined) rp.err(p + '.when.' + k, 'not used by a talk trigger');
        } else if (type === 'pickup') {
          if ((w.item === undefined) === (w.modItem === undefined)) rp.err(p + '.when', 'give exactly one of item or modItem');
          else if (w.item !== undefined) { const cat = catalogItems(); if (typeof w.item === 'string' && cat.includes(w.item)) ww.item = w.item; else rp.err(p + '.when.item', 'not a catalog item mods may reference'); }
          else { ww.modItem = ID(rp, w.modItem, p + '.when.modItem'); if (ww.modItem && !refs.items.has(ww.modItem)) rp.err(p + '.when.modItem', 'no such item in this mod'); }
          for (const k of ['map', 'x', 'y', 'r', 'npc']) if (w[k] !== undefined) rp.err(p + '.when.' + k, 'not used by a pickup trigger');
        }
        out.when = ww;
      }
      if (r.if !== undefined) {
        if (OBJ(rp, r.if, p + '.if', ['flag', 'is'])) {
          const f = ID(rp, r.if.flag, p + '.if.flag'); if (f) flags.add(f);
          const is = r.if.is === undefined ? true : r.if.is; if (typeof is !== 'boolean') rp.err(p + '.if.is', 'must be true or false');
          out.if = { flag: f, is };
        }
      }
      out.once = r.once === undefined ? true : r.once; if (typeof out.once !== 'boolean') rp.err(p + '.once', 'must be true or false');
      out.then = [];
      const eff = ARR(rp, r.then, p + '.then', LIM.effects);
      if (!eff.length) rp.err(p + '.then', 'needs at least one effect');
      let risky = false;
      eff.forEach((f, j) => {
        const ep = p + '.then[' + j + ']';
        if (!isObj(f)) { rp.err(ep, 'must be an object'); return; }
        const d = E(rp, f.do, ep + '.do', EFFECTS); if (!d) return;
        const allowed = { journal: ['do', 'text'], say: ['do', 'text'], give: ['do', 'item', 'modItem', 'n'], gold: ['do', 'amount'], setFlag: ['do', 'flag'], spawn: ['do', 'map', 'type', 'modEnemy', 'x', 'y'] }[d];
        OBJ(rp, f, ep, allowed);
        const x = { do: d };
        if (d === 'journal' || d === 'say') x.text = T(rp, f.text, ep + '.text', LIM.text);
        else if (d === 'give') {
          risky = true;
          if ((f.item === undefined) === (f.modItem === undefined)) rp.err(ep, 'give exactly one of item or modItem');
          else if (f.item !== undefined) { const cat = catalogItems().filter(i => i !== 'sovereigns'); if (typeof f.item === 'string' && cat.includes(f.item)) x.item = f.item; else rp.err(ep + '.item', 'not a catalog item mods may give (use gold for sovereigns)'); }
          else { x.modItem = ID(rp, f.modItem, ep + '.modItem'); if (x.modItem && !refs.items.has(x.modItem)) rp.err(ep + '.modItem', 'no such item in this mod'); }
          x.n = N(rp, f.n, ep + '.n', 1, 3, { int: true, clamp: true, def: 1 });
        } else if (d === 'gold') { risky = true; x.amount = N(rp, f.amount, ep + '.amount', 1, 50, { int: true, clamp: true }); }
        else if (d === 'setFlag') { x.flag = ID(rp, f.flag, ep + '.flag'); if (x.flag) flags.add(x.flag); }
        else if (d === 'spawn') {
          risky = true;
          x.map = ID(rp, f.map, ep + '.map'); if (x.map && !refs.maps.has(x.map)) rp.err(ep + '.map', 'no such map in this mod');
          if ((f.type === undefined) === (f.modEnemy === undefined)) rp.err(ep, 'give exactly one of type or modEnemy');
          else if (f.type !== undefined) { x.type = E(rp, f.type, ep + '.type', ENEMY_BASES); if (x.type && !enemyBaseOk(x.type)) rp.err(ep + '.type', 'this game has no enemy "' + x.type + '"'); }
          else { x.modEnemy = ID(rp, f.modEnemy, ep + '.modEnemy'); if (x.modEnemy && !refs.enemies.has(x.modEnemy)) rp.err(ep + '.modEnemy', 'no such enemy in this mod'); }
          x.x = N(rp, f.x, ep + '.x', 0.5, LIM.mapMax - 0.5, { clamp: true }); x.y = N(rp, f.y, ep + '.y', 0.5, LIM.mapMax - 0.5, { clamp: true });
        }
        out.then.push(x);
      });
      if (out.once === false && risky) rp.err(p + '.once', 'rules that give items, give gold or spawn enemies must be once:true');
      o.rules.push(out);
    });
    return o;
  }

  // ---- the whole mod
  function validateObject(src) {
    const rp = new Report();
    if (!scan(src, rp)) return { ok: false, errors: rp.errors, warnings: rp.warnings, mod: null };
    if (!OBJ(rp, src, '$', ['schemaVersion', 'id', 'version', 'name', 'author', 'description', 'maps', 'enemies', 'items', 'npcs', 'quests'])) return { ok: false, errors: rp.errors, warnings: rp.warnings, mod: null };
    const mod = {};
    if (src.schemaVersion !== 1) rp.err('$.schemaVersion', 'unsupported schemaVersion (this game reads version 1)');
    mod.schemaVersion = 1;
    mod.id = ID(rp, src.id, '$.id', MODID_RE);
    mod.version = typeof src.version === 'string' && VER_RE.test(src.version) ? src.version : (rp.err('$.version', 'must look like 1.0.0'), undefined);
    mod.name = T(rp, src.name, '$.name', LIM.name);
    mod.author = T(rp, src.author, '$.author', LIM.author);
    const description = T(rp, src.description, '$.description', LIM.desc, { opt: true }); if (description !== undefined) mod.description = description;
    // first pass: ids of enemies, items, npcs, maps (for cross references)
    const refs = { maps: new Set(), enemies: new Set(), items: new Set(), npcs: new Set() };
    const list = (key, max, fn, set, min) => {
      const arr = ARR(rp, src[key], '$.' + key, max, !min); const out = [];
      if (min && !arr.length) rp.err('$.' + key, 'needs at least ' + min);
      arr.forEach((v, i) => { const r = fn(rp, v, '$.' + key + '[' + i + ']'); if (r) { if (r.id) { if (set.has(r.id)) rp.err('$.' + key + '[' + i + '].id', 'duplicate id'); set.add(r.id); } out.push(r); } });
      return out;
    };
    mod.maps = list('maps', LIM.maps, vMap, refs.maps, 1);
    const enemies = list('enemies', LIM.enemies, vEnemy, refs.enemies);
    const items = list('items', LIM.items, vItem, refs.items);
    const npcs = list('npcs', LIM.npcs, vNpc, refs.npcs);
    if (enemies.length) mod.enemies = enemies;
    if (items.length) mod.items = items;
    if (npcs.length) mod.npcs = npcs;
    // cross references from maps
    mod.maps.forEach((m, mi) => (m.entities || []).forEach((e, ei) => {
      const p = '$.maps[' + mi + '].entities[' + ei + ']';
      if (e.modEnemy && !refs.enemies.has(e.modEnemy)) rp.err(p + '.modEnemy', 'no such enemy in this mod');
      if (e.modItem && !refs.items.has(e.modItem)) rp.err(p + '.modItem', 'no such item in this mod');
      if (e.npc && !refs.npcs.has(e.npc)) rp.err(p + '.npc', 'no such NPC in this mod');
    }));
    const flags = new Set(); const qs = ARR(rp, src.quests, '$.quests', LIM.quests, true); const quests = []; const qseen = new Set();
    qs.forEach((q, i) => { const r = vQuest(rp, q, '$.quests[' + i + ']', refs, flags); if (r) { if (r.id) { if (qseen.has(r.id)) rp.err('$.quests[' + i + '].id', 'duplicate id'); qseen.add(r.id); } quests.push(r); } });
    if (flags.size > LIM.flags) rp.err('$.quests', 'too many distinct flags (max ' + LIM.flags + ')');
    if (quests.length) mod.quests = quests;
    const ok = rp.errors.length === 0;
    return { ok, errors: rp.errors, warnings: rp.warnings, mod: ok ? mod : null, hash: ok ? hashOf(mod) : 0 };
  }
  function validate(input) {
    if (typeof input === 'string') {
      if (input.length > LIM.fileChars) return { ok: false, errors: ['$: file too large (max ' + LIM.fileChars + ' characters)'], warnings: [], mod: null };
      let text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
      let parsed; try { parsed = JSON.parse(text); } catch (e) { return { ok: false, errors: ['$: not valid JSON (' + String(e && e.message).slice(0, 80) + ')'], warnings: [], mod: null }; }
      return validateObject(parsed);
    }
    if (input === null || typeof input !== 'object') return { ok: false, errors: ['$: a mod must be a JSON object'], warnings: [], mod: null };
    return validateObject(input);
  }
  function exportText(mod) { return JSON.stringify(mod, null, 2); }
  // 32-bit FNV-1a of the canonical text: a save remembers which build of a mod's maps it was made on
  function hashOf(mod) { const s = JSON.stringify(mod); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }

  // ------------------------------------------------------------------ the local library
  const KEY = 'octave.mods.v1';
  const hcache = new WeakMap();
  const H = mod => { let h = hcache.get(mod); if (h === undefined) { h = hashOf(mod); hcache.set(mod, h); } return h; };
  const lib = { mods: [], temp: null }; // mods: [{ id, on, mod (normalized) }]; temp: the editor's playtest mod
  const fullId = (modId, local) => 'mod:' + modId + ':' + local;
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify({ v: 1, mods: lib.mods.map(m => ({ id: m.id, on: m.on, json: JSON.stringify(m.mod) })) })); return true; } catch (e) { return false; }
  }
  function storedChars() { return lib.mods.reduce((n, m) => n + JSON.stringify(m.mod).length, 0); }
  function loadLib() {
    lib.mods = [];
    try {
      const raw = localStorage.getItem(KEY); if (!raw || raw.length > LIM.storeChars * 1.5) return;
      const o = JSON.parse(raw); if (!o || o.v !== 1 || !Array.isArray(o.mods)) return;
      for (const rec of o.mods.slice(0, LIM.mods)) {
        if (!rec || typeof rec.json !== 'string') continue;
        const r = validate(rec.json); // always re-validated: storage is as untrusted as a download
        if (r.ok && !lib.mods.some(m => m.id === r.mod.id)) lib.mods.push({ id: r.mod.id, on: rec.on === true, mod: r.mod });
        else if (!r.ok) console.warn('mods: dropped a stored mod that no longer validates', r.errors[0]);
      }
    } catch (e) { /* no storage or damaged: start empty */ }
  }
  function install(input, opts) {
    opts = opts || {};
    const r = validate(input); if (!r.ok) return r;
    const existing = lib.mods.findIndex(m => m.id === r.mod.id);
    if (existing < 0 && lib.mods.length >= LIM.mods) return { ok: false, errors: ['library full (max ' + LIM.mods + ' mods); remove one first'], warnings: [], mod: null };
    const others = lib.mods.filter(m => m.id !== r.mod.id).reduce((n, m) => n + JSON.stringify(m.mod).length, 0);
    if (others + JSON.stringify(r.mod).length > LIM.storeChars) return { ok: false, errors: ['library storage cap reached (' + LIM.storeChars + ' characters); remove a mod first'], warnings: [], mod: null };
    const wasOn = existing >= 0 ? lib.mods[existing].on : true;
    if (existing >= 0) { deactivate(lib.mods[existing].mod); lib.mods.splice(existing, 1); r.replaced = true; }
    const rec = { id: r.mod.id, on: opts.enabled === undefined ? wasOn : !!opts.enabled, mod: r.mod };
    lib.mods.push(rec); if (rec.on) activate(rec.mod); syncMaps(); persist();
    return r;
  }
  function setEnabled(id, on) {
    const rec = lib.mods.find(m => m.id === id); if (!rec) return false;
    if (!on && insideMod(id)) return false; // leave the dungeon first
    rec.on = !!on; if (on) activate(rec.mod); else deactivate(rec.mod);
    syncMaps(); persist(); return true;
  }
  function remove(id) {
    const i = lib.mods.findIndex(m => m.id === id); if (i < 0) return false;
    if (insideMod(id)) return false;
    deactivate(lib.mods[i].mod); lib.mods.splice(i, 1); syncMaps(); persist(); return true;
  }
  const activeMods = () => lib.mods.filter(m => m.on).map(m => m.mod).concat(lib.temp ? [lib.temp] : []);
  const findActive = id => activeMods().find(m => m.id === id) || null;
  function insideMod(id) { return typeof G !== 'undefined' && typeof G.mapId === 'string' && G.mapId.indexOf('mod:' + id + ':') === 0; }

  // ---- catalog registration: namespaced entries only, built from validated data
  const registered = new Map(); // modId -> { items:[], enemies:[], npcs:[] }
  function activate(mod) {
    if (typeof ENEMIES === 'undefined' || registered.has(mod.id)) return;
    const reg = { items: [], enemies: [], npcs: [] };
    for (const e of (mod.enemies || [])) {
      const base = ENEMIES[e.base]; if (!base) continue;
      const k = fullId(mod.id, e.id);
      const def = Object.assign({}, base, { name: e.name, hp: e.hp, dmg: e.dmg.slice(), speed: e.speed, modded: true, boss: false });
      if (e.reach !== undefined) def.reach = e.reach;
      if (e.scale !== undefined) def.scale = r2((base.scale || 1) * e.scale);
      if (e.xp !== undefined) def.xp = e.xp;
      def.desc = e.desc !== undefined ? e.desc : 'A strange variant of ' + base.name + '.';
      ENEMIES[k] = def; reg.enemies.push(k);
    }
    for (const it of (mod.items || [])) {
      const k = fullId(mod.id, it.id); const o = { name: it.name, sprite: it.sprite, desc: it.desc, modded: true };
      if (it.kind === 'trinket') { o.valuable = true; o.value = it.value; } else if (it.kind === 'tonic') { o.use = 'heal'; o.n = it.n; } else if (it.kind === 'draught') { o.use = 'voice'; o.n = it.n; } else o.key = true;
      ITEMS[k] = o; reg.items.push(k);
    }
    for (const n of (mod.npcs || [])) {
      const k = fullId(mod.id, n.id);
      NPCS[k] = { name: n.name, sprite: n.sprite, portrait: n.portrait, tier: 'low', modded: true, greet: { polite: n.greet, normal: n.greet, blunt: n.greet }, topics: {}, quest: () => talkRules(mod, n.id) };
      reg.npcs.push(k);
    }
    registered.set(mod.id, reg);
  }
  function deactivate(mod) {
    const reg = registered.get(mod.id); if (!reg) return;
    for (const k of reg.enemies) delete ENEMIES[k];
    for (const k of reg.items) delete ITEMS[k];
    for (const k of reg.npcs) delete NPCS[k];
    registered.delete(mod.id);
  }

  // ------------------------------------------------------------------ building maps
  const refType = (mod, e) => e.type || fullId(mod.id, e.modEnemy);
  function buildMap(mod, md) {
    const rad = md.startDir * Math.PI / 180;
    let sx = 1, sy = 1;
    md.rows.forEach((r, y) => { const x = r.indexOf('S'); if (x >= 0) { sx = x; sy = y; } });
    const m = new GameMap(fullId(mod.id, md.id), md.name, md.w, md.h, { floor: md.floor, ceil: md.ceil, fogDist: md.fog, ambient: md.ambient, music: md.music, spawn: { x: sx + 0.5, y: sy + 0.5, dir: rad } });
    md.rows.forEach((r, y) => {
      for (let x = 0; x < md.w; x++) {
        const ch = r[x];
        if (ch >= '1' && ch <= '8') m.set(x, y, WALL(md.walls[+ch - 1]));
        else if (ch === 'D') m.set(x, y, DOOR());
        else if (ch === 'X') m.set(x, y, DOOR({ portal: { modExit: true }, label: 'The way out of the dungeon' }));
      }
    });
    m.modded = mod.id;
    for (const e of md.entities) {
      if (e.kind === 'enemy') { const t = refType(mod, e); if (typeof ENEMIES !== 'undefined' && ENEMIES[t]) m.enemy(t, e.x, e.y); }
      else if (e.kind === 'item') { const id = e.item || fullId(mod.id, e.modItem); if (ITEMS[id]) m.item(id, e.x, e.y); }
      else if (e.kind === 'prop') m.deco(e.sprite, e.x, e.y);
      else if (e.kind === 'npc') { const id = fullId(mod.id, e.npc); if (NPCS[id]) m.npc(id, e.x, e.y); }
    }
    m.baseCount = m.entities.length;
    return m;
  }
  function addModMaps(maps) {
    for (const mod of activeMods()) {
      activate(mod);
      for (const md of mod.maps) {
        const id = fullId(mod.id, md.id);
        if (maps[id]) continue;
        try { maps[id] = buildMap(mod, md); } catch (e) { console.warn('mods: could not build ' + id, e); }
      }
    }
    return maps;
  }
  // keep the live world in step when a mod is toggled, imported or removed
  function syncMaps() {
    if (typeof G === 'undefined' || !G.maps) return;
    const want = new Set();
    for (const mod of activeMods()) for (const md of mod.maps) want.add(fullId(mod.id, md.id));
    for (const id of Object.keys(G.maps)) if (id.indexOf('mod:') === 0 && !want.has(id) && G.mapId !== id) delete G.maps[id];
    for (const mod of activeMods()) {
      activate(mod);
      for (const md of mod.maps) {
        const id = fullId(mod.id, md.id); const cur = G.maps[id];
        if (cur && G.mapId !== id && cur.modHash !== H(mod)) delete G.maps[id]; // content changed: start clean
        if (!G.maps[id]) { try { G.maps[id] = buildMap(mod, md); G.maps[id].modHash = H(mod); } catch (e) { console.warn('mods: build failed', e); } }
      }
    }
  }

  // ------------------------------------------------------------------ entering and leaving
  function retRead() {
    // validated on every read: the flag lives in a save, so it is untrusted
    const f = typeof G !== 'undefined' && G.flags ? G.flags['mod:ret'] : null;
    let map = 'oakhaven', x = null, y = null, dir = 0;
    if (typeof f === 'string' && f.length < 80) {
      const p = f.split('|');
      if (p.length === 4 && /^[a-z0-9_]{1,30}$/.test(p[0]) && p.slice(1).every(v => isFinite(+v))) { map = p[0]; x = +p[1]; y = +p[2]; dir = +p[3]; }
    }
    const m = G.maps && G.maps[map];
    if (!m || map.indexOf('mod:') === 0 || map === 'watchhouse') { map = 'oakhaven'; x = null; }
    const mm = G.maps[map];
    if (x === null || x < 0.5 || y < 0.5 || x > mm.w - 0.5 || y > mm.h - 0.5 || mm.isBlocked(Math.floor(x), Math.floor(y))) return { map, x: mm.spawn.x, y: mm.spawn.y, dir: mm.spawn.dir || 0 };
    return { map, x, y, dir };
  }
  function whyNot() {
    if (typeof G === 'undefined' || !G.player || !G.map) return 'Start or load a game first.';
    if (G.dead || G.state === 'ending') return 'Not now.';
    if (G.player.hardcore) return 'Mod dungeons are not available in hardcore runs.';
    if (G.mapId === 'watchhouse' || (typeof crimeState === 'function' && crimeState().custody)) return 'You cannot go anywhere while in custody.';
    if (G.boreHold > 0 || G.escapeTimer > 0) return 'Not while the town is in danger.';
    return '';
  }
  function enter(modId, mapLocal, opts) {
    opts = opts || {};
    const mod = findActive(modId); if (!mod) return { ok: false, why: 'That mod is not enabled.' };
    const md = mod.maps.find(m => m.id === mapLocal); if (!md) return { ok: false, why: 'No such dungeon.' };
    const why = whyNot(); if (why) return { ok: false, why };
    const id = fullId(modId, mapLocal);
    if (G.mapId.indexOf('mod:') === 0) return { ok: false, why: 'Leave this dungeon first.' };
    syncMaps();
    if (opts.fresh || !G.maps[id]) { G.maps[id] = buildMap(mod, md); }
    G.maps[id].modHash = H(mod);
    const c = Engine.cam;
    G.flags['mod:ret'] = G.mapId + '|' + r2(c.x) + '|' + r2(c.y) + '|' + r2(c.dir);
    G.flags['mod:' + modId + ':h'] = H(mod);
    closeModal(); G.state = 'play'; G.keys = {};
    loadMap(id);
    return { ok: true, id };
  }
  function leave(note) {
    const r = retRead(); const from = G.mapId;
    delete G.flags['mod:ret'];
    G.state = 'play'; closeModal();
    loadMap(r.map, { x: r.x, y: r.y, dir: r.dir });
    G.dragBody = null;
    if (note) msg(note, 'warn', 6000);
    else msg('You climb back out into the light.', 'warn', 4000);
    // a playtest map is throwaway; reopen the editor on the draft
    if (from.indexOf('mod:_draft:') === 0) {
      delete G.maps[from]; delete G.flags['mod:_draft:h']; if (lib.temp) { deactivate(lib.temp); lib.temp = null; }
      setTimeout(() => { try { openEditor({ keep: true }); } catch (e) { console.warn('mods: editor reopen failed', e); } }, 60);
    }
    return r;
  }

  // ------------------------------------------------------------------ quest rules at run time
  const flagKey = (modId, name) => 'mod:' + modId + ':f_' + name;
  const onceKey = (modId, qid, rid) => 'mod:' + modId + ':r_' + qid + '_' + rid;
  const flagOn = k => !!(G.flags && G.flags[k] === true);
  function condOk(mod, rule) { return !rule.if || flagOn(flagKey(mod.id, rule.if.flag)) === rule.if.is; }
  function runEffects(mod, rule, said) {
    for (const f of rule.then) {
      try {
        if (f.do === 'journal') journal('side', f.text);
        else if (f.do === 'say') { if (said) said.push(f.text); else msg(f.text, 'voice', 7000); }
        else if (f.do === 'give') { const id = f.item || fullId(mod.id, f.modItem); if (!ITEMS[id]) continue; let got = ''; for (let i = 0; i < f.n; i++) got = f.modItem ? (G.give(id), 'the ' + ITEMS[id].name) : gainItem(id); msg('You take ' + got + '.', 'good', 3500); Audio_.sfx.pickup(); }
        else if (f.do === 'gold') { G.gold(f.amount); msg('You are given ' + f.amount + ' sovereigns.', 'good', 3500); }
        else if (f.do === 'setFlag') G.flags[flagKey(mod.id, f.flag)] = true;
        else if (f.do === 'spawn') spawnEnemy(mod, f);
      } catch (e) { console.warn('mods: effect failed', e); }
    }
  }
  function spawnEnemy(mod, f) {
    if (G.mapId !== fullId(mod.id, f.map)) return;
    const t = f.type || fullId(mod.id, f.modEnemy); if (typeof ENEMIES === 'undefined' || !ENEMIES[t]) return;
    if (G.ents.filter(e => e.kind === 'enemy' && !e.dead).length >= LIM.enemiesPerMap) return;
    if (G.map.isBlocked(Math.floor(f.x), Math.floor(f.y))) return;
    const e = hydrate({ kind: 'enemy', type: t, x: f.x, y: f.y }); G.ents.push(e);
  }
  // fire the rules of one trigger kind; ctx.said collects dialogue lines for talk triggers
  function fire(type, test, said, onlyMod) {
    if (typeof G === 'undefined' || !G.flags || !G.mapId) return 0;
    let n = 0;
    for (const mod of activeMods()) {
      if (onlyMod && mod.id !== onlyMod) continue;
      if (G.mapId.indexOf('mod:' + mod.id + ':') !== 0) continue; // a mod's rules only run inside its own dungeons
      for (const q of (mod.quests || [])) for (const rule of q.rules) {
        if (rule.when.type !== type || !test(rule.when)) continue;
        const ok = onceKey(mod.id, q.id, rule.id);
        if (rule.once && flagOn(ok)) continue;
        if (!condOk(mod, rule)) continue;
        if (rule.once) G.flags[ok] = true;
        runEffects(mod, rule, said); n++;
      }
    }
    return n;
  }
  function talkRules(mod, npcLocal) {
    const said = [];
    fire('talk', w => w.npc === npcLocal, said, mod.id);
    return said.length ? { text: said.join(' ') } : null;
  }
  const inside = new Set();
  function checkEnter() {
    if (typeof G === 'undefined' || !G.mapId || G.mapId.indexOf('mod:') !== 0 || !G.flags) { inside.clear(); return; }
    const c = Engine.cam;
    for (const mod of activeMods()) {
      if (G.mapId.indexOf('mod:' + mod.id + ':') !== 0) continue;
      for (const q of (mod.quests || [])) for (const rule of q.rules) {
        if (rule.when.type !== 'enter' || G.mapId !== fullId(mod.id, rule.when.map)) continue;
        const key = mod.id + '/' + q.id + '/' + rule.id, dx = c.x - rule.when.x, dy = c.y - rule.when.y;
        if (dx * dx + dy * dy > rule.when.r * rule.when.r) { inside.delete(key); continue; }
        if (inside.has(key)) continue; inside.add(key);
        fire('enter', w => w === rule.when, null, mod.id);
      }
    }
  }

  // ------------------------------------------------------------------ wiring (wrappers; game.js is untouched)
  let _baseBuild = null;
  function wire() {
    if (typeof buildAllMaps === 'function') {
      _baseBuild = buildAllMaps;
      buildAllMaps = function () {
        const maps = _baseBuild.apply(this, arguments);
        try { addModMaps(maps); for (const mod of activeMods()) for (const md of mod.maps) { const m = maps[fullId(mod.id, md.id)]; if (m) m.modHash = H(mod); } } catch (e) { console.warn('mods: could not add mod maps', e); }
        return maps;
      };
    }
    if (typeof transfer === 'function') {
      const _transfer = transfer;
      transfer = function (portal) { if (portal && portal.modExit) { leave(); return; } return _transfer.apply(this, arguments); };
    }
    if (typeof checkTriggers === 'function') {
      const _ct = checkTriggers;
      checkTriggers = function () { const r = _ct.apply(this, arguments); try { checkEnter(); } catch (e) { console.warn('mods: enter check failed', e); } return r; };
    }
    if (typeof pickUp === 'function') {
      const _pick = pickUp;
      pickUp = function (e) {
        const was = !!(e && e.dead); const r = _pick.apply(this, arguments);
        try { if (e && !was && e.dead && typeof e.item === 'string') fire('pickup', w => (w.item || fullId(G.map.modded || '', w.modItem || '')) === e.item); } catch (err) { console.warn('mods: pickup rules failed', err); }
        return r;
      };
    }
    if (typeof restoreGame === 'function') {
      const _restore = restoreGame;
      restoreGame = function (d) {
        let note = '';
        try { note = sanitizeSave(d); } catch (e) { console.warn('mods: save check failed', e); }
        const r = _restore.apply(this, arguments);
        if (note) { try { msg(note, 'warn', 8000); } catch (e) { /* cue only */ } }
        return r;
      };
    }
    if (typeof renderMenu === 'function') {
      const _menu = renderMenu;
      renderMenu = function () {
        const r = _menu.apply(this, arguments);
        try {
          const list = document.querySelector('#modal-panel .menu-list');
          if (list && !document.getElementById('mn-mods')) {
            const b = document.createElement('button'); b.className = 'dfbtn'; b.id = 'mn-mods'; b.type = 'button'; b.textContent = 'Mod dungeons';
            b.onclick = () => renderModsPanel();
            // share the How to play row instead of adding one: the Options panel is tight (hardcore.test.js checks it fits)
            const help = document.getElementById('mn-help');
            if (help && help.parentNode === list) {
              const pair = document.createElement('div'); pair.style.cssText = 'display:flex;gap:1cqw;margin-bottom:.6cqh';
              list.insertBefore(pair, help); pair.appendChild(help); pair.appendChild(b);
              for (const x of [help, b]) { x.style.cssText = 'flex:1 1 0;min-width:0;margin-bottom:0'; }
            } else list.insertBefore(b, document.getElementById('mn-title') || null);
          }
        } catch (e) { console.warn('mods: menu row failed', e); }
        return r;
      };
    }
  }

  // A save is untrusted. Mod sections of it are kept only when they still match an enabled, unchanged mod.
  function sanitizeSave(d) {
    if (!d || typeof d !== 'object' || typeof d.mapId !== 'string') return '';
    const flags = d.flags && typeof d.flags === 'object' && !Array.isArray(d.flags) ? d.flags : null;
    if (flags) for (const k of Object.keys(flags)) {
      if (k.indexOf('mod:') !== 0) continue;
      const v = flags[k];
      if (k === 'mod:ret') { if (typeof v !== 'string' || v.length > 80) delete flags[k]; } else if (/^mod:[a-z0-9_]+:h$/.test(k)) { if (!(typeof v === 'number' && isFinite(v))) delete flags[k]; } else if (v !== true) delete flags[k];
    }
    const usable = id => {
      const p = /^mod:([a-z][a-z0-9_]{2,23}):([a-z][a-z0-9_]{0,23})$/.exec(id); if (!p) return false;
      const mod = findActive(p[1]); if (!mod || !mod.maps.some(m => m.id === p[2])) return false;
      return !!flags && flags['mod:' + p[1] + ':h'] === H(mod);
    };
    if (d.maps && typeof d.maps === 'object') for (const id of Object.keys(d.maps)) if (id.indexOf('mod:') === 0 && !usable(id)) delete d.maps[id];
    if (d.mapId.indexOf('mod:') === 0 && usable(d.mapId)) {
      // a usable dungeon: a camera from a save is untrusted, so it must stand on an open cell of that dungeon
      const p = d.mapId.split(':'), md = findActive(p[1]).maps.find(m => m.id === p[2]), c = d.cam;
      const ch = c && isFinite(c.x) && isFinite(c.y) && c.x >= 0.5 && c.y >= 0.5 && c.x < md.w - 0.5 && c.y < md.h - 0.5 ? md.rows[Math.floor(c.y)][Math.floor(c.x)] : '#';
      if (ch !== '.' && ch !== 'S' && ch !== 'D') {
        let sx = 1, sy = 1; md.rows.forEach((r, y) => { const x = r.indexOf('S'); if (x >= 0) { sx = x; sy = y; } });
        d.cam = { x: sx + 0.5, y: sy + 0.5, dir: md.startDir * Math.PI / 180 };
      }
    }
    if (d.mapId.indexOf('mod:') === 0 && !usable(d.mapId)) {
      let map = 'oakhaven', x = null, y = null, dir = 0;
      const f = flags && flags['mod:ret'];
      if (typeof f === 'string') { const p = f.split('|'); if (p.length === 4 && /^[a-z0-9_]{1,30}$/.test(p[0]) && p.slice(1).every(v => isFinite(+v))) { map = p[0]; x = +p[1]; y = +p[2]; dir = +p[3]; } }
      const probe = (_baseBuild || buildAllMaps)();
      if (map.indexOf('mod:') === 0 || !probe[map] || map === 'watchhouse') { map = 'oakhaven'; x = null; }
      const mm = probe[map];
      if (x === null || x < 0.5 || y < 0.5 || x > mm.w - 0.5 || y > mm.h - 0.5 || mm.isBlocked(Math.floor(x), Math.floor(y))) { x = mm.spawn.x; y = mm.spawn.y; dir = mm.spawn.dir || 0; }
      d.mapId = map; d.cam = { x, y, dir };
      if (flags) delete flags['mod:ret'];
      return 'The dungeon you were in is not installed or has changed, so you wake at its entrance.';
    }
    return '';
  }

  // ------------------------------------------------------------------ UI helpers
  function el(tag, props, text) {
    const e = document.createElement(tag);
    if (props) for (const k of Object.keys(props)) { if (k === 'class') e.className = props[k]; else if (k === 'style') e.style.cssText = props[k]; else e.setAttribute(k, props[k]); }
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function installStyle() {
    if (document.getElementById('mods-style')) return;
    const s = document.createElement('style'); s.id = 'mods-style';
    s.textContent = `
#modal-panel:has(.mods-panel) { width: 84cqw; max-height: 94cqh; }
#modal-panel:has(.mods-editor) { width: 96cqw; max-height: 97cqh; padding: 1cqh 1.4cqw; overflow-y: auto; }
.mods-panel { display: flex; flex-direction: column; gap: .8cqh; }
.mods-panel h3, .mods-editor h3 { font-family: var(--font-display); color: var(--gold); font-size: 1.9cqw; margin: .4cqh 0 .2cqh; letter-spacing: .06em; }
.mods-row { display: flex; flex-wrap: wrap; align-items: center; gap: .6cqw; padding: .5cqh .8cqw; border: 1px solid var(--edge-d); background: rgba(0,0,0,.25); }
.mods-row .grow { flex: 1 1 14cqw; min-width: 0; font-size: 1.7cqw; overflow-wrap: anywhere; }
.mods-row .grow small { display: block; opacity: .75; font-size: 1.4cqw; }
.mods-panel .dfbtn.small, .mods-editor .dfbtn.small { font-size: 1.5cqw; padding: .3cqh 1cqw; }
.mods-panel textarea, .mods-editor textarea { width: 100%; box-sizing: border-box; height: 9cqh; font: 1.4cqw var(--font-body); background: #120d09; color: #e8d9b4; border: 1px solid var(--edge-d); resize: vertical; }
.mods-msg { font-size: 1.5cqw; margin: .2cqh 0; overflow-wrap: anywhere; }
.mods-msg.bad { color: #e9806c; } .mods-msg.good { color: #9fd49a; } .mods-msg.warn { color: #e6c36b; }
.mods-editor { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 1.2cqw; align-items: start; font-size: 1.5cqw; }
.mods-editor .ed-left { min-width: 0; }
.mods-editor .ed-side { display: flex; flex-direction: column; gap: .5cqh; min-width: 0; }
.mods-editor canvas { display: block; border: 2px solid var(--edge-d); background: #000; image-rendering: pixelated; cursor: crosshair; }
.mods-editor canvas:focus { outline: 2px solid var(--gold); }
.mods-editor label { display: flex; flex-wrap: wrap; align-items: center; gap: .4cqw; font-size: 1.4cqw; }
.mods-editor input[type=text], .mods-editor input[type=number], .mods-editor select { font: 1.4cqw var(--font-body); background: #120d09; color: #e8d9b4; border: 1px solid var(--edge-d); padding: .2cqh .4cqw; min-width: 0; }
.mods-editor input[type=number] { width: 5cqw; }
.mods-editor input[type=text] { width: 15cqw; }
.mods-editor-h { font-size: 2.6cqw; margin: 0 0 .3cqh; }
.mods-editor details summary { cursor: pointer; font-family: var(--font-display); color: var(--gold); font-size: 1.7cqw; }
.mods-editor .tools { display: flex; flex-wrap: wrap; gap: .3cqw; }
.mods-editor .tools .dfbtn { min-width: 0; }
.mods-editor .ed-top { display: flex; flex-wrap: wrap; gap: .4cqw; align-items: center; }
.mods-editor .ed-msgs { max-height: 11cqh; overflow-y: auto; }
.mods-editor .previews { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .5cqw; }
.mods-editor .previews:empty { display: none; }
.mods-editor .previews canvas { width: 100%; height: auto; cursor: default; }
.mods-note { font-size: 1.7cqw; padding: 1cqh 0; }
`;
    document.head.appendChild(s);
  }
  const panelRoot = () => document.getElementById('modal-panel');
  function listMsgs(host, r) {
    host.textContent = '';
    for (const e of r.errors.slice(0, 12)) host.appendChild(el('div', { class: 'mods-msg bad' }, e));
    for (const w of r.warnings.slice(0, 6)) host.appendChild(el('div', { class: 'mods-msg warn' }, w));
  }
  function download(name, text) {
    try {
      const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name });
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); return true;
    } catch (e) { return false; }
  }

  // ------------------------------------------------------------------ the Mod dungeons panel
  function renderModsPanel(note) {
    installStyle();
    openModal('', 'mods'); const root = panelRoot(); G.state = 'panel';
    const wrap = el('div', { class: 'mods-panel' });
    wrap.appendChild(el('h2', null, 'Mod dungeons'));
    const close = el('button', { class: 'dfbtn small close', id: 'x' }, 'Close'); close.onclick = () => { closeModal(); G.state = 'play'; };
    wrap.appendChild(close);
    const out = el('div', { class: 'mods-msg', id: 'mods-out', role: 'status' }); if (note) { out.textContent = note; }
    const why = whyNot();
    if (typeof G !== 'undefined' && G.mapId && G.mapId.indexOf('mod:') === 0) {
      const row = el('div', { class: 'mods-row' }); row.appendChild(el('span', { class: 'grow' }, 'You are inside ' + G.map.name + '.'));
      const b = el('button', { class: 'dfbtn small', id: 'mods-leave' }, 'Leave the dungeon'); b.onclick = () => leave(); row.appendChild(b); wrap.appendChild(row);
    } else if (why) wrap.appendChild(el('p', { class: 'mods-msg warn' }, why));
    if (!lib.mods.length) wrap.appendChild(el('p', { class: 'mods-msg' }, 'No mods installed. Import a .json mod below, or build a dungeon in the editor.'));
    for (const rec of lib.mods) {
      const mod = rec.mod, row = el('div', { class: 'mods-row', 'data-mod': mod.id });
      const g = el('span', { class: 'grow' }, mod.name + ' ' + mod.version); g.appendChild(el('small', null, 'by ' + mod.author + ' · ' + mod.maps.length + ' dungeon' + (mod.maps.length === 1 ? '' : 's') + (mod.description ? ' · ' + mod.description : '')));
      row.appendChild(g);
      const tog = el('button', { class: 'dfbtn small', 'data-toggle': mod.id }, rec.on ? 'Enabled' : 'Disabled');
      tog.onclick = () => { if (!setEnabled(mod.id, !rec.on)) out.textContent = 'Leave the dungeon first.'; else renderModsPanel(); };
      row.appendChild(tog);
      const rm = el('button', { class: 'dfbtn small', 'data-remove': mod.id }, 'Remove'); rm.onclick = () => { if (!remove(mod.id)) out.textContent = 'Leave the dungeon first.'; else renderModsPanel('Removed ' + mod.name + '. Your saves are untouched.'); };
      row.appendChild(rm);
      const ex = el('button', { class: 'dfbtn small', 'data-export': mod.id }, 'Export'); ex.onclick = () => { download(mod.id + '.mod.json', exportText(mod)); out.textContent = 'Exported ' + mod.id + '.mod.json'; }; row.appendChild(ex);
      wrap.appendChild(row);
      if (rec.on) for (const md of mod.maps) {
        const r2row = el('div', { class: 'mods-row', style: 'margin-left:2cqw' });
        r2row.appendChild(el('span', { class: 'grow' }, md.name + ' (' + md.w + '×' + md.h + ')'));
        const eb = el('button', { class: 'dfbtn small', 'data-enter': mod.id + ':' + md.id }, 'Enter'); eb.disabled = !!why || G.mapId.indexOf('mod:') === 0;
        eb.onclick = () => { const r = enter(mod.id, md.id); if (!r.ok) out.textContent = r.why; };
        r2row.appendChild(eb); wrap.appendChild(r2row);
      }
    }
    wrap.appendChild(el('h3', null, 'Import a mod'));
    const file = el('input', { type: 'file', accept: '.json,application/json', id: 'mods-file', 'aria-label': 'Choose a mod file' });
    const ta = el('textarea', { id: 'mods-paste', placeholder: 'Or paste a mod here', 'aria-label': 'Paste a mod' });
    const msgs = el('div', { id: 'mods-errs' });
    const doImport = (text) => {
      const r = install(text);
      if (r.ok) { renderModsPanel('Imported ' + r.mod.name + (r.replaced ? ' (replaced the earlier copy)' : '') + (r.warnings.length ? ' with ' + r.warnings.length + ' adjustment(s).' : '.')); }
      else { listMsgs(msgs, r); out.textContent = 'That mod was rejected; nothing was installed.'; out.className = 'mods-msg bad'; }
    };
    file.onchange = () => { const f = file.files && file.files[0]; if (!f) return; if (f.size > LIM.fileChars * 4) { out.textContent = 'That file is too large for a mod.'; return; } const rd = new FileReader(); rd.onload = () => doImport(String(rd.result || '')); rd.readAsText(f); };
    const imp = el('button', { class: 'dfbtn small', id: 'mods-import' }, 'Import pasted text'); imp.onclick = () => doImport(ta.value);
    const ed = el('button', { class: 'dfbtn small', id: 'mods-open-editor' }, 'Open the dungeon editor'); ed.onclick = () => openEditor();
    wrap.appendChild(file); wrap.appendChild(ta);
    const bar = el('div', { class: 'mods-row' }); bar.appendChild(imp); bar.appendChild(ed); wrap.appendChild(bar);
    wrap.appendChild(out); wrap.appendChild(msgs);
    wrap.appendChild(el('p', { class: 'mods-msg' }, 'Mods are data only: they cannot run code. Anything unrecognised is refused, and your saves never depend on a mod.'));
    root.appendChild(wrap);
  }

  // ------------------------------------------------------------------ the dungeon editor
  const ED = { draft: null, tool: 'wall', brush: 't_stone', ent: 'hound', cx: 1, cy: 1, extra: {}, meta: null, cs: 12, painting: false, last: null };
  function newDraft() {
    const w = 20, h = 14, grid = [];
    for (let y = 0; y < h; y++) { const r = []; for (let x = 0; x < w; x++) r.push(x === 0 || y === 0 || x === w - 1 || y === h - 1 ? 't_stone' : '.'); grid.push(r); }
    grid[2][2] = 'S'; grid[h - 3][w - 3] = 'X';
    return { id: 'hall', name: 'My Dungeon', w, h, floor: 't_flag', ceil: 't_stone', ambient: 0.18, fog: 12, music: 'dungeon', startDir: 0, grid, entities: [] };
  }
  const MAPKEYS = ['ambient', 'fog', 'music', 'startDir'];
  // editor model <-> schema map
  function draftToMod() {
    const d = ED.draft, used = new Set();
    for (const row of d.grid) for (const c of row) if (c.length > 2) used.add(c);
    const walls = WALL_TEX.filter(t => used.has(t));
    const rows = d.grid.map(row => row.map(c => (c.length > 2) ? String(walls.indexOf(c) + 1) : c).join(''));
    const map = { id: d.id, name: d.name, w: d.w, h: d.h, floor: d.floor, ceil: d.ceil, walls, rows, ambient: d.ambient, fog: d.fog, music: d.music, startDir: d.startDir, entities: d.entities.map(e => Object.assign({}, e)) };
    const m = ED.meta;
    const mod = { schemaVersion: 1, id: m.id, version: m.version, name: m.name, author: m.author, maps: [map] };
    if (m.description) mod.description = m.description;
    for (const k of ['enemies', 'items', 'npcs', 'quests']) if (ED.extra[k] && ED.extra[k].length) mod[k] = JSON.parse(JSON.stringify(ED.extra[k]));
    return mod;
  }
  function modToDraft(mod) {
    const md = mod.maps[0];
    const grid = md.rows.map(r => Array.from(r).map(c => (c >= '1' && c <= '8') ? md.walls[+c - 1] : c));
    ED.draft = { id: md.id, name: md.name, w: md.w, h: md.h, floor: md.floor, ceil: md.ceil, ambient: md.ambient, fog: md.fog, music: md.music, startDir: md.startDir, grid, entities: md.entities.map(e => Object.assign({}, e)) };
    ED.meta = { id: mod.id, version: mod.version, name: mod.name, author: mod.author, description: mod.description || '' };
    ED.extra = {}; for (const k of ['enemies', 'items', 'npcs', 'quests']) if (mod[k]) ED.extra[k] = JSON.parse(JSON.stringify(mod[k]));
    // the first map only is editable; other maps ride along untouched
    ED.otherMaps = mod.maps.slice(1).map(m => JSON.parse(JSON.stringify(m)));
  }
  function currentMod() { const mod = draftToMod(); if (ED.otherMaps && ED.otherMaps.length) mod.maps = mod.maps.concat(ED.otherMaps); return mod; }
  function slug(s) { const t = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20); return /^[a-z]/.test(t) ? t : 'm_' + t; }
  function validateDraft() { return validate(currentMod()); }

  const texColour = {};
  function colourOf(tex) {
    if (texColour[tex]) return texColour[tex];
    let c = '#555';
    try {
      const d = Engine.textures[tex]; let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 7) { const p = d[i]; r += p & 255; g += (p >> 8) & 255; b += (p >> 16) & 255; n++; }
      c = 'rgb(' + Math.round(r / n) + ',' + Math.round(g / n) + ',' + Math.round(b / n) + ')';
    } catch (e) { /* fallback grey */ }
    return (texColour[tex] = c);
  }
  const ENT_COL = { enemy: '#e24b4b', item: '#e6c34a', prop: '#9a7a4a', npc: '#58b8e0' };
  function paint(cv) {
    const d = ED.draft, cs = ED.cs, ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
    for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) {
      const c = d.grid[y][x];
      ctx.fillStyle = c.length > 2 ? colourOf(c) : colourOf(d.floor);
      if (c === '.' || c === 'S' || c === 'X' || c === 'D') { ctx.globalAlpha = 0.55; ctx.fillRect(x * cs, y * cs, cs, cs); ctx.globalAlpha = 1; } else ctx.fillRect(x * cs, y * cs, cs, cs);
      if (c === 'D') { ctx.fillStyle = '#b07a3a'; ctx.fillRect(x * cs + 1, y * cs + cs / 2 - 1, cs - 2, 3); }
      if (c === 'S' || c === 'X') { ctx.fillStyle = c === 'S' ? '#3ddc84' : '#b46bff'; ctx.fillRect(x * cs + 2, y * cs + 2, cs - 4, cs - 4); ctx.fillStyle = '#000'; ctx.font = 'bold ' + Math.max(8, cs - 4) + 'px monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText(c, x * cs + cs / 2, y * cs + cs / 2 + 1); }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    for (let x = 0; x <= d.w; x++) { ctx.beginPath(); ctx.moveTo(x * cs + 0.5, 0); ctx.lineTo(x * cs + 0.5, d.h * cs); ctx.stroke(); }
    for (let y = 0; y <= d.h; y++) { ctx.beginPath(); ctx.moveTo(0, y * cs + 0.5); ctx.lineTo(d.w * cs, y * cs + 0.5); ctx.stroke(); }
    for (const e of d.entities) { ctx.fillStyle = ENT_COL[e.kind] || '#fff'; ctx.beginPath(); ctx.arc(e.x * cs, e.y * cs, Math.max(2.5, cs * 0.3), 0, 6.283); ctx.fill(); ctx.strokeStyle = '#000'; ctx.stroke(); }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(ED.cx * cs + 1, ED.cy * cs + 1, cs - 2, cs - 2);
  }
  function entRef(e) { return e.type || e.item || e.sprite || e.npc || e.modEnemy || e.modItem; }
  function apply(cx, cy) {
    const d = ED.draft; if (cx < 0 || cy < 0 || cx >= d.w || cy >= d.h) return;
    const cell = d.grid[cy][cx], tool = ED.tool;
    const clearEnts = () => { d.entities = d.entities.filter(e => !(Math.floor(e.x) === cx && Math.floor(e.y) === cy)); };
    if (tool === 'wall') { if (cell === 'S' || cell === 'X') return; clearEnts(); d.grid[cy][cx] = ED.brush; }
    else if (tool === 'floor') { if (cell === 'S' || cell === 'X') return; d.grid[cy][cx] = '.'; }
    else if (tool === 'door') { if (cell === 'S' || cell === 'X') return; clearEnts(); d.grid[cy][cx] = 'D'; }
    else if (tool === 'start' || tool === 'exit') {
      const ch = tool === 'start' ? 'S' : 'X'; if (cell === (tool === 'start' ? 'X' : 'S')) return;
      for (const row of d.grid) for (let i = 0; i < row.length; i++) if (row[i] === ch) row[i] = '.';
      clearEnts(); d.grid[cy][cx] = ch;
    } else if (tool === 'erase') clearEnts();
    else {
      if (cell !== '.' && cell !== 'S') return;
      const ref = ED.ent; if (!ref) return;
      const x = cx + 0.5, y = cy + 0.5;
      d.entities = d.entities.filter(e => !(Math.floor(e.x) === cx && Math.floor(e.y) === cy && e.kind === tool));
      const e = { kind: tool, x, y };
      if (tool === 'enemy') { if (ref.indexOf('mod:') === 0) e.modEnemy = ref.slice(4); else e.type = ref; }
      else if (tool === 'item') { if (ref.indexOf('mod:') === 0) e.modItem = ref.slice(4); else e.item = ref; }
      else if (tool === 'prop') e.sprite = ref; else if (tool === 'npc') e.npc = ref.slice(4);
      d.entities.push(e);
    }
  }
  function resizeDraft(w, h) {
    const d = ED.draft; w = clampN(w | 0, LIM.mapMin, LIM.mapMax); h = clampN(h | 0, LIM.mapMin, LIM.mapMax);
    const grid = [];
    for (let y = 0; y < h; y++) { const r = []; for (let x = 0; x < w; x++) r.push((d.grid[y] && d.grid[y][x]) || (x === 0 || y === 0 || x === w - 1 || y === h - 1 ? 't_stone' : '.')); grid.push(r); }
    d.w = w; d.h = h; d.grid = grid;
    d.entities = d.entities.filter(e => e.x < w && e.y < h);
    // keep exactly one S and X where possible
    let s = false, x = false; for (const row of grid) for (const c of row) { if (c === 'S') s = true; if (c === 'X') x = true; }
    if (!s) grid[1][1] = 'S'; if (!x) grid[h - 2][w - 2] = grid[h - 2][w - 2] === 'S' ? 'S' : 'X';
    ED.cx = Math.min(ED.cx, w - 1); ED.cy = Math.min(ED.cy, h - 1);
  }
  function saveDraft() {
    try { const t = JSON.stringify(currentMod()); if (t.length < LIM.fileChars) localStorage.setItem('octave.mods.draft.v1', t); } catch (e) { /* storage may be off */ }
  }
  function loadDraft() {
    try {
      const t = localStorage.getItem('octave.mods.draft.v1'); if (!t) return false;
      const r = validate(t); if (!r.ok) return false; modToDraft(r.mod); return true;
    } catch (e) { return false; }
  }
  function entityChoices(tool) {
    const mod = ED.extra || {};
    if (tool === 'enemy') return ENEMY_BASES.filter(enemyBaseOk).map(v => [v, v]).concat((mod.enemies || []).map(e => ['mod:' + e.id, e.name + ' (mod)']));
    if (tool === 'item') return catalogItems().map(v => [v, (typeof ITEMS !== 'undefined' && ITEMS[v] ? ITEMS[v].name : v)]).concat((mod.items || []).map(i => ['mod:' + i.id, i.name + ' (mod)']));
    if (tool === 'prop') return PROPS.filter(p => liveHas('spr', p)).map(v => [v, v]);
    if (tool === 'npc') return (mod.npcs || []).map(n => ['mod:' + n.id, n.name]);
    return [];
  }
  function openEditor(opts) {
    installStyle();
    if (!(opts && opts.keep) || !ED.draft) { if (!ED.draft) { if (!loadDraft()) { ED.draft = newDraft(); ED.meta = { id: 'my_mod', version: '1.0.0', name: 'My Dungeon Mod', author: 'Anonymous', description: '' }; ED.extra = {}; ED.otherMaps = []; } } }
    G.state = 'panel';
    openModal('', 'modedit'); const root = panelRoot();
    const compact = window.innerWidth < 900 || window.innerHeight < 560;
    const wrap = el('div', { class: 'mods-panel' });
    wrap.appendChild(el('h2', { class: 'mods-editor-h' }, 'Dungeon editor'));
    const back = el('button', { class: 'dfbtn small close', id: 'x' }, 'Close'); back.onclick = () => { saveDraft(); renderModsPanel(); };
    if (compact) {
      wrap.appendChild(back);
      wrap.appendChild(el('p', { class: 'mods-note', id: 'ed-compact' }, 'The dungeon editor needs a larger window (at least 900 by 560). Please use a larger window, or full screen.'));
      root.appendChild(wrap); return;
    }
    wrap.appendChild(back);
    const ed = el('div', { class: 'mods-editor' });
    // left: canvas
    const left = el('div', { class: 'ed-left' });
    const cv = el('canvas', { id: 'ed-grid', tabindex: '0', role: 'application', 'aria-label': 'Dungeon grid. Arrow keys move the cursor, Enter applies the tool, Delete removes things.' });
    left.appendChild(cv);
    const prevHost = el('div', { class: 'previews', id: 'ed-previews' });
    ed.appendChild(left);
    const side = el('div', { class: 'ed-side' });
    // header fields
    const top = el('div', { class: 'ed-top' });
    const lab = (text, input) => { const l = el('label', null, text); l.appendChild(input); return l; };
    const name = el('input', { type: 'text', id: 'ed-name', maxlength: String(LIM.name), value: ED.draft.name, 'aria-label': 'Dungeon name' });
    name.oninput = () => { ED.draft.name = name.value; ED.meta.name = name.value; if (ED.meta.id === 'my_mod' || ED.meta.id === slug(ED.meta.name)) { /* keep */ } refresh(); };
    const author = el('input', { type: 'text', id: 'ed-author', maxlength: String(LIM.author), value: ED.meta.author, 'aria-label': 'Author' });
    author.oninput = () => { ED.meta.author = author.value; refresh(); };
    const modid = el('input', { type: 'text', id: 'ed-modid', maxlength: '24', value: ED.meta.id, 'aria-label': 'Mod id' });
    modid.oninput = () => { ED.meta.id = modid.value; refresh(); };
    top.appendChild(lab('Name ', name)); top.appendChild(lab('Author ', author)); top.appendChild(lab('Mod id ', modid));
    side.appendChild(top);
    const dims = el('div', { class: 'ed-top' });
    const wI = el('input', { type: 'number', id: 'ed-w', min: String(LIM.mapMin), max: String(LIM.mapMax), value: String(ED.draft.w), 'aria-label': 'Width' });
    const hI = el('input', { type: 'number', id: 'ed-h', min: String(LIM.mapMin), max: String(LIM.mapMax), value: String(ED.draft.h), 'aria-label': 'Height' });
    const onSize = () => { resizeDraft(+wI.value || ED.draft.w, +hI.value || ED.draft.h); wI.value = ED.draft.w; hI.value = ED.draft.h; fit(); refresh(); };
    wI.onchange = hI.onchange = onSize;
    dims.appendChild(lab('Width ', wI)); dims.appendChild(lab('Height ', hI));
    const sel = (id, list, cur, onch, label) => { const s = el('select', { id, 'aria-label': label }); for (const v of list) { const o = el('option', { value: v }, v === null ? 'none' : v); if (v === cur) o.selected = true; s.appendChild(o); } s.onchange = () => onch(s.value === 'none' ? null : s.value); return s; };
    dims.appendChild(lab('Floor ', sel('ed-floor', FLOOR_TEX, ED.draft.floor, v => { ED.draft.floor = v; refresh(); }, 'Floor texture')));
    dims.appendChild(lab('Ceiling ', sel('ed-ceil', CEIL_TEX, ED.draft.ceil, v => { ED.draft.ceil = v; refresh(); }, 'Ceiling texture')));
    dims.appendChild(lab('Music ', sel('ed-music', MUSIC, ED.draft.music, v => { ED.draft.music = v; refresh(); }, 'Music')));
    dims.appendChild(lab('Facing ', sel('ed-dir', ['0', '90', '180', '270'], String(ED.draft.startDir), v => { ED.draft.startDir = +v; refresh(); }, 'Start direction in degrees')));
    side.appendChild(dims);
    // tools
    const tools = el('div', { class: 'tools', role: 'toolbar', 'aria-label': 'Tools' });
    const TOOLS = [['wall', 'Wall'], ['floor', 'Floor'], ['door', 'Door'], ['start', 'Start'], ['exit', 'Exit'], ['enemy', 'Enemy'], ['item', 'Item'], ['prop', 'Prop'], ['npc', 'NPC'], ['erase', 'Remove things']];
    const toolBtns = {};
    for (const [id, label] of TOOLS) { const b = el('button', { class: 'dfbtn small', 'data-tool': id }, label); b.onclick = () => { ED.tool = id; fillChoice(); markTools(); cv.focus(); }; toolBtns[id] = b; tools.appendChild(b); }
    side.appendChild(tools);
    const choiceHost = el('div', { class: 'ed-top' }); side.appendChild(choiceHost);
    function markTools() { for (const id in toolBtns) toolBtns[id].classList.toggle('sel', id === ED.tool); }
    function fillChoice() {
      choiceHost.textContent = '';
      if (ED.tool === 'wall') {
        const s = el('select', { id: 'ed-brush', 'aria-label': 'Wall texture' });
        for (const t of WALL_TEX.filter(t => liveHas('tex', t))) { const o = el('option', { value: t }, t.replace(/^t_/, '')); if (t === ED.brush) o.selected = true; s.appendChild(o); }
        s.onchange = () => { ED.brush = s.value; }; choiceHost.appendChild(lab('Wall texture ', s));
      } else if (['enemy', 'item', 'prop', 'npc'].includes(ED.tool)) {
        const ch = entityChoices(ED.tool);
        if (!ch.length) { choiceHost.appendChild(el('span', { class: 'mods-msg' }, 'No ' + ED.tool + 's available (NPCs come from an imported mod).')); ED.ent = null; return; }
        if (!ch.some(c => c[0] === ED.ent)) ED.ent = ch[0][0];
        const s = el('select', { id: 'ed-ent', 'aria-label': 'What to place' });
        for (const [v, l] of ch) { const o = el('option', { value: v }, l); if (v === ED.ent) o.selected = true; s.appendChild(o); }
        s.onchange = () => { ED.ent = s.value; }; choiceHost.appendChild(lab('Place ', s));
      }
    }
    // actions
    const acts = el('div', { class: 'tools' });
    const mk = (id, text, fn) => { const b = el('button', { class: 'dfbtn small', id }, text); b.onclick = fn; acts.appendChild(b); return b; };
    const bPrev = mk('ed-preview', 'Preview', () => { preview(prevHost); });
    const bPlay = mk('ed-playtest', 'Playtest', () => { const r = playtest(); if (!r.ok) status.textContent = r.why || r.errors.join('; '); });
    const bExp = mk('ed-export', 'Export', () => { const r = validateDraft(); if (!r.ok) return; saveDraft(); download(r.mod.id + '.mod.json', exportText(r.mod)); status.textContent = 'Exported ' + r.mod.id + '.mod.json'; });
    const bAdd = mk('ed-install', 'Add to my mods', () => { const r = install(currentMod()); status.textContent = r.ok ? 'Added ' + r.mod.name + ' to your mods.' : r.errors[0]; });
    mk('ed-new', 'New', () => { ED.draft = newDraft(); ED.meta = { id: 'my_mod', version: '1.0.0', name: 'My Dungeon Mod', author: 'Anonymous', description: '' }; ED.extra = {}; ED.otherMaps = []; openEditor({ keep: true }); });
    side.appendChild(acts);
    const status = el('div', { class: 'mods-msg', id: 'ed-status', role: 'status' }); left.appendChild(status);
    const msgs = el('div', { class: 'ed-msgs', id: 'ed-msgs', 'aria-live': 'polite' }); left.appendChild(msgs);
    // import
    const imp = el('details'); imp.appendChild(el('summary', null, 'Import a mod into the editor'));
    const file = el('input', { type: 'file', accept: '.json,application/json', id: 'ed-file', 'aria-label': 'Choose a mod file to edit' });
    const ta = el('textarea', { id: 'ed-paste', placeholder: 'Or paste a mod here, then Import', 'aria-label': 'Paste a mod' });
    const doImport = (text) => {
      const r = validate(text);
      if (!r.ok) { listMsgs(msgs, r); status.textContent = 'Rejected: nothing was changed.'; return; }
      modToDraft(r.mod); openEditor({ keep: true });
    };
    file.onchange = () => { const f = file.files && file.files[0]; if (!f || f.size > LIM.fileChars * 4) return; const rd = new FileReader(); rd.onload = () => doImport(String(rd.result || '')); rd.readAsText(f); };
    const bImp = el('button', { class: 'dfbtn small', id: 'ed-import' }, 'Import'); bImp.onclick = () => doImport(ta.value);
    imp.appendChild(file); imp.appendChild(ta); imp.appendChild(bImp); side.appendChild(imp);
    ed.appendChild(side); ed.appendChild(prevHost); wrap.appendChild(ed); root.appendChild(wrap);

    // sizing: fit the grid to the space left of the side panel
    function fit() {
      const d = ED.draft, pr = root.getBoundingClientRect();
      const availW = Math.max(200, pr.width * 0.46), availH = Math.max(200, window.innerHeight * 0.42);
      ED.cs = clampN(Math.floor(Math.min(availW / d.w, availH / d.h)), 6, 22);
      cv.width = d.w * ED.cs; cv.height = d.h * ED.cs; cv.style.width = cv.width + 'px'; cv.style.height = cv.height + 'px';
      paint(cv);
    }
    function refresh() {
      paint(cv);
      const r = validateDraft(); listMsgs(msgs, r);
      if (r.ok && !msgs.childNodes.length) msgs.appendChild(el('div', { class: 'mods-msg good' }, 'Valid. This dungeon passes every check.'));
      else if (r.ok) msgs.insertBefore(el('div', { class: 'mods-msg good' }, 'Valid (with adjustments).'), msgs.firstChild);
      for (const b of [bPrev, bPlay, bExp, bAdd]) b.disabled = !r.ok;
      if (bPlay) bPlay.disabled = !r.ok || !!whyNot() || G.mapId.indexOf('mod:') === 0;
      saveDraft();
    }
    const at = ev => { const r = cv.getBoundingClientRect(); return [Math.floor((ev.clientX - r.left) * cv.width / r.width / ED.cs), Math.floor((ev.clientY - r.top) * cv.height / r.height / ED.cs)]; };
    cv.addEventListener('pointerdown', ev => { ev.preventDefault(); cv.focus(); ED.painting = true; const [x, y] = at(ev); ED.cx = clampN(x, 0, ED.draft.w - 1); ED.cy = clampN(y, 0, ED.draft.h - 1); apply(x, y); ED.last = x + ',' + y; refresh(); try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ } });
    cv.addEventListener('pointermove', ev => { if (!ED.painting) return; const [x, y] = at(ev); const k = x + ',' + y; if (k === ED.last) return; ED.last = k; if (['start', 'exit', 'enemy', 'item', 'prop', 'npc'].includes(ED.tool)) return; ED.cx = clampN(x, 0, ED.draft.w - 1); ED.cy = clampN(y, 0, ED.draft.h - 1); apply(x, y); refresh(); });
    const up = () => { ED.painting = false; ED.last = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('keydown', ev => {
      const k = ev.key; let used = true;
      if (k === 'ArrowLeft') ED.cx = Math.max(0, ED.cx - 1); else if (k === 'ArrowRight') ED.cx = Math.min(ED.draft.w - 1, ED.cx + 1);
      else if (k === 'ArrowUp') ED.cy = Math.max(0, ED.cy - 1); else if (k === 'ArrowDown') ED.cy = Math.min(ED.draft.h - 1, ED.cy + 1);
      else if (k === 'Enter' || k === ' ') apply(ED.cx, ED.cy);
      else if (k === 'Delete' || k === 'Backspace') { const t = ED.tool; ED.tool = 'erase'; apply(ED.cx, ED.cy); ED.tool = t; }
      else used = false;
      if (used) { ev.preventDefault(); ev.stopPropagation(); refresh(); }
    });
    markTools(); fillChoice(); fit(); refresh();
  }

  // ---- Preview: render the draft with the game's own renderer from the start, four ways
  function preview(host) {
    const r = validateDraft(); if (!r.ok || typeof Engine === 'undefined') return false;
    host.textContent = '';
    const saved = { map: G.map, x: Engine.cam.x, y: Engine.cam.y, dir: Engine.cam.dir, pitch: Engine.cam.pitch, z: Engine.cam.z, bob: Engine.cam.bob };
    const tmp = lib.temp; let ok = true;
    try {
      const mod = r.mod; const fake = Object.assign({}, mod, { id: '_draft' });
      if (!lib.temp) { lib.temp = fake; activate(fake); }
      const m = buildMap(fake, fake.maps[0]); m.entities.forEach(hydrate);
      Engine.setMap(m);
      const s = m.spawn, base = s.dir;
      for (let i = 0; i < 4; i++) {
        Engine.cam.x = s.x; Engine.cam.y = s.y; Engine.cam.dir = base + i * Math.PI / 2; Engine.cam.pitch = 0; Engine.cam.z = 0.88; Engine.cam.bob = 0;
        Engine.render(m.entities, 0.5);
        const c = el('canvas', { 'aria-label': 'Preview, looking ' + ['ahead', 'right', 'behind', 'left'][i] }); const vh = (typeof VIEW_H === 'number' ? VIEW_H : Engine.VIEW_H) || Engine.canvas.height; c.width = Engine.canvas.width; c.height = vh;
        c.getContext('2d').drawImage(Engine.canvas, 0, 0, Engine.canvas.width, vh, 0, 0, Engine.canvas.width, vh); host.appendChild(c);
      }
    } catch (e) { console.warn('mods: preview failed', e); ok = false; host.appendChild(el('div', { class: 'mods-msg bad' }, 'Preview failed.')); }
    finally {
      if (!tmp && lib.temp) { deactivate(lib.temp); lib.temp = null; }
      Engine.setMap(saved.map); Object.assign(Engine.cam, { x: saved.x, y: saved.y, dir: saved.dir, pitch: saved.pitch, z: saved.z, bob: saved.bob });
    }
    return ok;
  }
  // ---- Playtest: really enter the draft with the player's character; the exit door returns to the editor
  function playtest() {
    const r = validateDraft(); if (!r.ok) return { ok: false, errors: r.errors };
    const why = whyNot(); if (why) return { ok: false, why };
    if (G.mapId.indexOf('mod:') === 0) return { ok: false, why: 'Leave this dungeon first.' };
    if (lib.temp) deactivate(lib.temp);
    lib.temp = Object.assign({}, r.mod, { id: '_draft' }); activate(lib.temp);
    const mapLocal = lib.temp.maps[0].id;
    const res = enter('_draft', mapLocal, { fresh: true });
    if (!res.ok) { deactivate(lib.temp); lib.temp = null; }
    return res;
  }

  // ------------------------------------------------------------------ boot
  function init() {
    try { loadLib(); } catch (e) { console.warn('mods: library load failed', e); }
    try { for (const rec of lib.mods) if (rec.on) activate(rec.mod); } catch (e) { console.warn('mods: activate failed', e); }
    try { wire(); } catch (e) { console.warn('mods: wiring failed', e); }
  }
  const api = {
    LIM, WALL_TEX, FLOOR_TEX, CEIL_TEX, MUSIC, ENEMY_BASES, PROPS, NPC_SPRITES, PORTRAITS, ITEM_SPRITES, ITEM_KINDS, TRIGGERS, EFFECTS,
    validate, exportText, hashOf, catalogItems,
    install, setEnabled, remove, list: () => lib.mods.map(m => ({ id: m.id, on: m.on, name: m.mod.name, version: m.mod.version, maps: m.mod.maps.map(x => x.id) })),
    get: id => { const r = lib.mods.find(m => m.id === id); return r ? r.mod : null; }, reload: () => { loadLib(); },
    enter, leave, whyNot, fullId, buildMap, flagKey, onceKey, insideMod,
    panel: renderModsPanel, editor: openEditor, ED, draftToMod, currentMod, modToDraft, newDraft, resizeDraft, apply, preview, playtest, validateDraft,
    sanitizeSave, storedChars, state: lib, KEY,
  };
  api._init = init;
  return api;
})();

if (typeof module !== 'undefined' && module.exports) module.exports = MODS;
else if (typeof document !== 'undefined') { try { MODS._init(); } catch (e) { console.warn('mods: init failed', e); } }
