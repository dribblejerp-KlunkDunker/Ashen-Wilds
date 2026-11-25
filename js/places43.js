// ============================================================
//  places43 - Phase 43, the places of the highland edge.
//
//  O15 asks for something to see, find or fight about every 30 to 60 seconds of walking; the zone plan (O16,
//  atlas/10-zones.md, "Z1. ... Places on the grid") puts 56 of them on Z1's grid. Phase 42 made Z1 one open map with
//  only its ground and ways. This phase puts every one of the 56 where the plan puts it, built from what the game
//  already draws (rock, dry stone, turf, slag, frost, scorch, embers, corpse-caps, smoke) and six small things painted
//  here (a body under its cloak, bones, a straw skep, a pair of boots, bright scraps, early flowers):
//
//    * each place stands at its own point of the grid (or beside its way, never on it), and its name, the plan's own,
//      is what you read when you look at it;
//    * coming within 14 cells of a place the first time, its name is said, and the place is found (G.flags.la_found,
//      saved with the game); the map (M) of the open country marks the places found;
//    * a gate to another zone says, as the upper road's notch does, that the country beyond is not built yet;
//      Coldbarrow's north gate is shut in its wall;
//    * the hunts are the hunters' signs only (tracks, bones, a split boulder); the beasts themselves are not in the game
//      yet, only the walking bloom.
//
//  The switch (Options) "Places of the highland edge": off, the open map is Phase 42's, cell for cell, as before.
//
//  Plain ASCII. No random number and no clock: every shape comes from a fixed hash of position.
// ============================================================
'use strict';

const PLACES43 = (() => {
  const O = typeof OPEN42 !== 'undefined' ? OPEN42 : (typeof require === 'function' ? require('./open42.js') : null);
  const T = typeof THRESH40 !== 'undefined' ? THRESH40 : (typeof require === 'function' ? require('./threshold40.js') : null);
  const TX = {
    switchName: 'Places of the highland edge',
    switchWhat: 'The 56 places of the zone plan stand on the highland edge, and are found as you come to them. Off: the open country is bare, as before',
  };
  const ID = 'la_z1', FOUND_R = 14;
  // the places built right on their own point (a gate across its way's end, a label on a complex): the rest stand
  // three cells clear of every way
  const ON_POINT = [1, 2, 11, 12, 30, 31, 35, 36];
  // Z1's places, copied from atlas/10-zones.md ("Places on the grid"); test/places43.test.js reads the table back.
  // [number, name as the plan writes it, x, y, kind]
  const PLACES = [
    [1, 'The ledge (`la_ledge`)', 990, 140, 'complex'],
    [2, 'Marget Sayle\'s bothy (`la_bothy`)', 1040, 110, 'complex'],
    [3, 'The ramp foot: the ledge\'s way down', 1000, 250, 'gate'],
    [4, 'Marget\'s peat bank [PROPOSED]', 960, 380, 'new'],
    [5, 'The Greystair fork', 900, 520, 'atlas'],
    [6, 'The Bloom drifts, the east hollow', 760, 380, 'atlas'],
    [7, 'The flower ground', 620, 260, 'atlas'],
    [8, 'The Warm Skeps [PROPOSED]', 650, 320, 'new'],
    [9, 'The Boiling Stone [PROPOSED]', 570, 350, 'new'],
    [10, 'The Slag Fall [PROPOSED]', 380, 150, 'new'],
    [11, 'The last climb: to the Slagcrown (Z7)', 260, 60, 'gate'],
    [12, 'The upper slope: to the Slagcrown\'s lower gate', 160, 90, 'gate'],
    [13, 'The Bloom drifts, the west hollows', 300, 260, 'atlas'],
    [14, 'The vent line', 330, 360, 'atlas'],
    [15, 'Walking blooms among the flowers', 360, 480, 'hunt'],
    [16, 'The lower slope: the ogre', 410, 560, 'hunt'],
    [17, 'A miner\'s dead in the drifts, with a brass tag', 560, 610, 'way'],
    [18, 'The Warm Shieling [PROPOSED]', 380, 760, 'new'],
    [19, 'The edge of the venting slopes', 700, 700, 'atlas'],
    [20, 'The crown seen whole from the road', 800, 610, 'way'],
    [21, 'Ork packs coming down in silence', 740, 780, 'hunt'],
    [22, 'The Listeners\' Cairn [PROPOSED]', 760, 870, 'new'],
    [23, 'The Hewers\' Cross', 720, 960, 'atlas'],
    [24, 'The tenth tower of the carrying line', 810, 1090, 'atlas'],
    [25, 'The Downhill Den [PROPOSED]', 1050, 1000, 'new'],
    [26, 'Quarry-troll ground', 1200, 1060, 'hunt'],
    [27, 'The Dropping Place [PROPOSED]', 690, 1190, 'new'],
    [28, 'The Ponies\' Shelf [PROPOSED]', 830, 1290, 'new'],
    [29, 'A cairn with a cache under it', 700, 1380, 'way'],
    [30, 'Coldbarrow, its north gate (SOUTH painted inside)', 760, 1480, 'complex'],
    [31, 'Coldbarrow\'s south road: on into Z2', 760, 1530, 'gate'],
    [32, 'Greystair\'s bloomery glow over the spur', 1100, 450, 'way'],
    [33, 'A Company carrier dead with his heat-stones', 1200, 415, 'way'],
    [34, 'Ork packs on the Greystair road', 1350, 360, 'hunt'],
    [35, 'Greystair\'s lower gate (Z7)', 1500, 300, 'gate'],
    [36, 'The Iron Stair\'s Foot (Z7)', 1490, 100, 'gate'],
    [37, 'Quarry-troll on the high ground', 1230, 500, 'hunt'],
    [38, 'The view of Kell Tor\'s black tarn', 1350, 560, 'atlas'],
    [39, 'Wilmot\'s Fold [PROPOSED]', 1320, 780, 'new'],
    [40, 'A dead pony still in its pack-straps', 765, 1335, 'way'],
    [41, 'A hewer\'s spare boots set side by side on a wall', 760, 1240, 'way'],
    [42, 'Goblins picking the Dropping Place over', 750, 1140, 'hunt'],
    [43, 'Coldbarrow\'s roofs seen far below', 765, 1025, 'way'],
    [44, 'Steam from a crack in the turf', 830, 450, 'way'],
    [45, 'Slag lumps still warm to the hand', 475, 250, 'way'],
    [46, 'A fallen stretch of field wall', 1000, 485, 'way'],
    [47, 'Troll dung and a split boulder', 1275, 388, 'way'],
    [48, 'Greystair\'s terraces seen stepping down the face', 1425, 330, 'way'],
    [49, 'Frost stopping in a line where the warm ground starts', 630, 655, 'way'],
    [50, 'An ogre\'s half-eaten kill', 485, 585, 'way'],
    [51, 'A goblin\'s cache of bright scraps under a stone', 230, 175, 'way'],
    [52, 'Bones of a sheep that sat down in a hollow', 395, 660, 'way'],
    [53, 'An ork\'s dropped cleaver', 930, 1045, 'way'],
    [54, 'Salt-licked stones on the den\'s spoil', 1125, 1030, 'way'],
    [55, 'Kell Tor\'s crag shows over the ridge', 1335, 670, 'way'],
    [56, 'The Iron Stair\'s black zigzag climbing into cloud', 1495, 200, 'way'],
  ];
  // what the game says: the plan's name without its brackets and code
  const nameOf = (s) => s.replace(/\s*\[PROPOSED\]/, '').replace(/\s*\(`[^`]*`\)/, '').trim();
  // the gates' ways, for the words a notch says (THRESH40.TX.notBuilt)
  const GATE_WAY = { 11: 'The last climb', 12: 'The slope path', 35: 'The Greystair road', 36: 'To the Iron Stair', 30: 'Coldbarrow' };

  // ---------------------------------------------------------------- shapes (pure)
  const hash = (x, y, s) => T.hash(x, y, s);
  const HALF = { road: 1.5, track: 1.0 };
  // how far a point is from the nearest way, past that way's half-width
  function offWay(x, y) {
    let d = 1e9;
    for (const w of T.WAYS) d = Math.min(d, T.lineDist(x, y, w.pts) - (HALF[w.kind] || 1));
    return d;
  }
  // a point near (x, y) at least `clear` cells off every way: the place's own point if it is, else the nearest of a ring
  // of points round it, turning from a direction fixed by the place's number
  function beside(n, x, y, clear) {
    if (offWay(x, y) >= clear) return [x, y];
    for (let r = 2; r <= 24; r += 1) {
      for (let k = 0; k < 16; k++) {
        const a = (k + hash(n, 0, 431) * 16) * Math.PI / 8, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        if (offWay(px, py) >= clear) return [px, py];
      }
    }
    return [x, y];
  }

  // ---------------------------------------------------------------- the things painted here (front views, pixel art)
  const px = (r, g, b) => ((255 << 24) | (Math.max(0, Math.min(255, b | 0)) << 16) | (Math.max(0, Math.min(255, g | 0)) << 8) | Math.max(0, Math.min(255, r | 0))) >>> 0;
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return px(n >> 16, (n >> 8) & 255, n & 255); };
  // [name, width, height, height in the world, painter(put)]
  const ART = [
    // a body lying on its side under a dark cloak, a pale hand out of it
    ['la_dead', 40, 12, 0.3, (put) => {
      const C = ['#120e0c', '#241c18', '#3a2e26', '#54443a'].map(hex), S = ['#8a7462', '#b09884'].map(hex);
      for (let x = 3; x < 36; x++) {
        const top = 6 - Math.round(Math.sin((x - 3) / 33 * Math.PI) * 3 + (x > 26 && x < 33 ? 1.5 : 0));
        for (let y = top; y < 12; y++) put(x, y, C[Math.min(3, Math.max(0, Math.floor(hash(x, y, 701) * 2 + (y === top ? 2 : 0))))]);
      }
      for (let x = 32; x < 38; x++) for (let y = 4; y < 9; y++) if (Math.hypot(x - 35, y - 6.5) < 2.6) put(x, y, S[(x + y) & 1]);
      for (const [x, y] of [[8, 11], [9, 11], [10, 10]]) put(x, y, S[1]);
    }],
    // bones: a curve of ribs, a long bone, a skull
    ['la_bones', 28, 8, 0.16, (put) => {
      const B = ['#6e665a', '#a49a88', '#d6ccb8'].map(hex);
      for (let i = 0; i < 5; i++) for (let y = 2; y < 8; y++) { const x = 4 + i * 3 + Math.round(Math.sin(y / 2) * 1.2); put(x, y, B[y < 4 ? 2 : 1]); }
      for (let x = 2; x < 20; x++) put(x, 7, B[(x >> 1) & 1 ? 1 : 0]);
      for (let x = 20; x < 27; x++) for (let y = 3; y < 8; y++) if (Math.hypot((x - 23) / 1.2, y - 5.5) < 2.6) put(x, y, (x === 22 && y === 5) ? B[0] : B[2]);
    }],
    // a straw bee-skep, a dome in coils, its little door
    ['la_skep', 16, 16, 0.42, (put) => {
      const S = ['#4a3416', '#7a5a26', '#a88438', '#d2b062'].map(hex);
      for (let y = 2; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (Math.hypot((x - 7.5) / 7.5, (y - 15) / 13) > 1) continue;
        put(x, y, S[(y % 3 === 0) ? 0 : (x + y) % 5 === 0 ? 3 : 2 - ((x < 6) ? 1 : 0)]);
      }
      for (let x = 6; x < 9; x++) for (let y = 13; y < 16; y++) put(x, y, hex('#120c06'));
    }],
    // a pair of boots, side by side
    ['la_boots', 14, 8, 0.16, (put) => {
      const L = ['#1e1510', '#3a2a1e', '#5a4230'].map(hex);
      for (const ox of [0, 7]) for (let y = 0; y < 8; y++) for (let x = 0; x < 6; x++) { if (y < 5 && x > 3) continue; put(ox + x, y, L[y === 0 ? 2 : (x === 0 ? 0 : 1)]); }
    }],
    // bright scraps: a cleaver's blade, a bent lamp, a shard of glass that catches the light
    ['la_scrap', 18, 6, 0.12, (put) => {
      const M = ['#3a3a40', '#7a7a84', '#c8c8d0'].map(hex), G = hex('#e8b84a');
      for (let x = 1; x < 9; x++) for (let y = 2; y < 6; y++) put(x, y, M[y === 2 ? 2 : 1]);
      for (let x = 9; x < 12; x++) put(x, 4, hex('#3a2416'));
      for (let x = 13; x < 17; x++) for (let y = 3; y < 6; y++) if ((x + y) % 2) put(x, y, G, true);
      put(5, 1, M[2], true);
    }],
    // early flowers in warm turf: small heads, yellow and pale
    ['la_flowers', 24, 10, 0.2, (put) => {
      const F = ['#d8b040', '#f0e0a0', '#c86a3a'].map(hex), G = ['#2a3a1a', '#3e5226'].map(hex);
      for (let i = 0; i < 9; i++) {
        const x = 1 + Math.floor(hash(i, 1, 703) * 22), top = 2 + Math.floor(hash(i, 2, 703) * 5);
        for (let y = top + 1; y < 10; y++) put(x, y, G[y & 1]);
        put(x, top, F[i % 3]); put(x - 1, top, F[(i + 1) % 3]); put(x + 1, top, F[(i + 1) % 3]); put(x, top - 1, F[i % 3]);
      }
    }],
  ];
  function paintArt() {
    if (typeof Engine === 'undefined' || !Engine.addSprite) return 0;
    for (const [name, w, h, hs, draw] of ART) {
      const d = new Uint32Array(w * h), emit = new Uint8Array(w * h);
      draw((x, y, c, glow) => { if (x >= 0 && y >= 0 && x < w && y < h) { d[y * w + x] = c; emit[y * w + x] = glow ? 1 : 0; } });
      Engine.addSprite(name, { w, h, data: d, hs, cx: 0.5, dy: 0 });
      if (Engine.setEmissive && emit.some((v) => v)) Engine.setEmissive(name, emit);
    }
    return ART.length;
  }

  // ---------------------------------------------------------------- building on a map, with a record to undo it
  // B is one place's builder: everything it changes is logged on the map's record, so the switch can take it all away
  function builder(m, rec, n, name) {
    const FL = typeof LEDGE1 !== 'undefined' ? LEDGE1.FL : { SCORCH: 0, ROCK: 1, DROP: 2, FROST: 3, EMBER: 4, BLOOM: 5, SLAG: 6, FROST2: 7 };
    const inside = (x, y) => x >= 12 && y >= 12 && x < m.w - 12 && y < m.h - 12;
    const g = (x, y) => m.groundAt(x + 0.5, y + 0.5);
    const B = {
      FL, n, name, g,
      // a cell a thing may stand on: inside the zone's edge, empty, and a cell clear of every way
      free(x, y, clear) { return inside(x, y) && !m.get(x, y) && offWay(x + 0.5, y + 0.5) >= (clear == null ? 0.8 : clear); },
      set(x, y, c, force) {
        x |= 0; y |= 0;
        if (!force && !B.free(x, y)) return false;
        rec.cells.push([x, y, m.get(x, y)]); m.set(x, y, c); return true;
      },
      block(x, y, h, tex, cap, force) { return B.set(x, y, { tex: tex || 't_la_rock', top: g(x | 0, y | 0) + h, capTex: cap || 't_la_frost', la43: n }, force); },
      floor(x, y, f) {
        x |= 0; y |= 0; if (!inside(x, y)) return;
        rec.floors.push([x, y, m.floorCells[y * m.w + x]]); m.setFloor(x, y, f);
      },
      // a floor in a rough round patch (not on a way: the ways keep their rock)
      patch(cx, cy, r, f, s, dens) {
        for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++) for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) + (T.vnoise(x / 3, y / 3, 433 + (s || 0)) - 0.5) * r * 0.6;
          if (d < r && (dens == null || T.vnoise(x / 2, y / 2, 434 + (s || 0)) < dens) && offWay(x + 0.5, y + 0.5) > 0) B.floor(x, y, f);
        }
      },
      thing(sprite, x, y, o) {
        // not 'transient': the engine strips those at every change of map (js/anim.js); the save leaves them out instead
        const e = m.deco(sprite, x, y, Object.assign({ solid: false, scale: 1, label: name, la43: n }, o || {}));
        if (typeof hydrate === 'function') hydrate(e);
        rec.ents.push(e); return e;
      },
      // the place's name, hung where you look: on a thing that is there, or on nothing at its point
      mark(x, y) { return B.thing('la_mark', x, y, { solid: false }); },
      cairn(x, y, h) {
        x |= 0; y |= 0; if (!B.block(x, y, h, 't_la_rock', 't_la_rock')) return false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (hash(x + dx, y + dy, 435 + n) > 0.3) B.block(x + dx, y + dy, h * (0.35 + hash(x + dx, y + dy, 437) * 0.25), 't_la_rock', 't_la_rock');
        return true;
      },
      stone(x, y, h, tex, cap) { return B.block(x, y, h, tex || 't_la_rock', cap || 't_la_frost'); },
      line(x0, y0, x1, y1, h, tex, gap, cap) {
        const len = Math.ceil(Math.hypot(x1 - x0, y1 - y0)); let k = 0;
        for (let i = 0; i <= len; i++) {
          const x = Math.floor(x0 + (x1 - x0) * i / len), y = Math.floor(y0 + (y1 - y0) * i / len);
          if (gap && hash(x, y, 439 + n) < gap) continue;
          if (B.block(x, y, h * (0.8 + hash(x, y, 441) * 0.35), tex || 't_house_la_drystone', cap || 't_la_turfroof')) k++;
        }
        return k;
      },
      ring(cx, cy, r, h, tex, gapA) {
        for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (Math.abs(d - r) > 0.55) continue;
          if (gapA != null) { const a = Math.atan2(y + 0.5 - cy, x + 0.5 - cx); if (Math.abs(Math.atan2(Math.sin(a - gapA), Math.cos(a - gapA))) < 0.45) continue; }
          B.block(x, y, h * (0.85 + hash(x, y, 443) * 0.3), tex || 't_house_la_drystone', 't_la_turfroof');
        }
      },
      // a roofless hut of field stone: its walls, a door in the south wall
      hut(cx, cy, w, d, h) {
        const x0 = Math.floor(cx - w / 2), y0 = Math.floor(cy - d / 2);
        for (let y = y0; y < y0 + d; y++) for (let x = x0; x < x0 + w; x++) {
          const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + d - 1;
          if (!edge || (y === y0 + d - 1 && x === x0 + (w >> 1))) continue;
          B.block(x, y, h, 't_house_la_drystone', 't_la_turfroof');
        }
        return [x0 + (w >> 1) + 0.5, y0 + d / 2];
      },
      embers(x, y, k, r) { for (let i = 0; i < k; i++) { const a = hash(n, i, 445) * 6.283, d = r * hash(i, n, 447); B.thing('la_ember', x + Math.cos(a) * d, y + Math.sin(a) * d, { glow: 1, lightCol: [120, 40, 8] }); } },
      caps(x, y, k, r) { for (let i = 0; i < k; i++) { const a = hash(n, i, 449) * 6.283, d = r * hash(i, n, 451); B.thing('la_caps', x + Math.cos(a) * d, y + Math.sin(a) * d, { glow: 1, lightCol: [14, 74, 60] }); } },
      scatter(sprite, x, y, k, r, o) { for (let i = 0; i < k; i++) { const a = hash(n, i, 453) * 6.283, d = r * Math.sqrt(hash(i, n, 455)); B.thing(sprite, x + Math.cos(a) * d, y + Math.sin(a) * d, o); } },
      steam(x, y, h) { rec.steam.push({ x, y, z: g(x | 0, y | 0) + (h || 0.1), n }); },
    };
    return B;
  }

  // ---------------------------------------------------------------- the 56, one recipe each
  // Each gets the builder and the point to build round (the plan's point, or beside its way when the point is on one).
  // Sizes are in cells (a cell is a metre, P33); heights in the game's units (a walker is about 1 tall, climbs 0.36).
  const VIEW = (B, x, y) => { B.stone(x, y, 0.5, 't_la_rock', 't_la_rock'); B.thing('la_mark', x + 0.5, y + 0.5); };
  const GATEPOSTS = (B, x, y, a) => {
    const nx = Math.cos(a + Math.PI / 2), ny = Math.sin(a + Math.PI / 2);
    for (const s of [-2.6, 2.6]) B.block(x + nx * s, y + ny * s, 2.6, 't_la_rock', 't_la_rock', true);
    B.mark(x, y);
  };
  // the direction a way runs at its end, so a gate stands across it
  function wayEnd(name) { const w = T.WAYS.find((q) => q.name === name), p = w.pts, a = p[p.length - 1], b = p[p.length - 2]; return { x: a[0], y: a[1], a: Math.atan2(a[1] - b[1], a[0] - b[0]) }; }
  const RECIPES = {
    1: (B) => { B.mark(990.5, 145); },
    2: (B, x, y) => { B.mark(x + 0.5, y + 0.5); },
    3: (B, x, y) => { B.cairn(x, y, 1.4); B.mark(x + 0.5, y + 0.5); },
    4: (B, x, y) => { for (let i = 0; i < 7; i++) for (let j = 0; j < 2; j++) B.floor(x - 3 + i, y + j, B.FL.SCORCH); B.stone(x - 2, y - 2, 0.9, 't_la_scorch', 't_la_turfroof'); B.stone(x - 1, y - 2, 0.8, 't_la_scorch', 't_la_turfroof'); B.mark(x + 0.5, y + 0.5); },
    5: (B, x, y) => { B.stone(x, y, 2.4, 't_la_rock', 't_la_rock'); B.cairn(x + 2, y + 1, 1.0); B.mark(x + 0.5, y + 0.5); },
    6: (B, x, y) => { B.patch(x, y, 10, B.FL.BLOOM, 6, 0.42); B.caps(x, y, 6, 8); B.mark(x, y); },
    7: (B, x, y) => { B.patch(x, y, 9, B.FL.SCORCH, 7); B.scatter('la_flowers', x, y, 12, 8); B.mark(x, y); },
    8: (B, x, y) => { for (let i = 0; i < 5; i++) { B.stone(x - 4 + i * 2, y, 0.32, 't_la_rock', 't_la_rock'); B.thing('la_skep', x - 4 + i * 2 + 0.5, y + 1.3, { solid: true, radius: 0.3 }); } B.patch(x, y + 1, 5, B.FL.SCORCH, 8); },
    9: (B, x, y) => { B.stone(x, y, 0.45); B.stone(x + 1, y, 0.45); B.steam(x + 1, y + 0.5, 0.5); B.thing('la_ember', x + 1, y + 1.4, { glow: 1, lightCol: [90, 30, 6] }); B.thing('la_dead', x - 3.5, y + 4.5); B.mark(x + 1, y + 0.5); },
    10: (B, x, y) => { B.patch(x, y, 12, B.FL.SLAG, 10); for (let i = 0; i < 14; i++) { const a = hash(i, 10, 457) * 6.283, d = 2 + hash(10, i, 459) * 9; B.stone(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.4 + hash(i, 3, 461) * 0.8, 't_la_slag', 't_la_slag'); } B.embers(x, y, 4, 8); B.mark(x, y); },
    11: (B) => { const e = wayEnd('The last climb'); GATEPOSTS(B, e.x, e.y, e.a); },
    12: (B) => { const e = wayEnd('The slope path'); GATEPOSTS(B, e.x, e.y, e.a); },
    13: (B, x, y) => { for (const [dx, dy] of [[-8, -3], [6, -5], [0, 7]]) { B.patch(x + dx, y + dy, 5, B.FL.BLOOM, dx, 0.45); B.caps(x + dx, y + dy, 3, 4); } B.mark(x, y); },
    14: (B, x, y) => { for (let i = -15; i <= 15; i++) { const cx = x + i, cy = y + Math.round(Math.sin(i / 4) * 2); if (offWay(cx + 0.5, cy + 0.5) > 0) B.floor(cx, cy, B.FL.EMBER); if (i % 5 === 0) B.thing('la_ember', cx + 0.5, cy + 0.5, { glow: 1, lightCol: [120, 40, 8] }); } B.steam(x - 6, y, 0.1); B.steam(x + 7, y + 1, 0.1); B.mark(x, y); },
    15: (B, x, y) => { B.scatter('la_flowers', x, y, 8, 7); B.caps(x, y, 3, 6); B.mark(x, y); },
    16: (B, x, y) => { B.thing('la_bones', x + 1, y + 1); B.stone(x - 2, y, 1.6); B.stone(x - 2, y + 2, 1.5); B.mark(x + 1, y + 1); },
    17: (B, x, y) => { B.patch(x, y, 3.5, B.FL.BLOOM, 17, 0.5); B.thing('la_dead', x + 0.5, y + 0.5); },
    18: (B, x, y) => { const d = B.hut(x, y, 6, 5, 1.6); B.thing('la_ember', d[0], d[1] - 0.6, { glow: 1, lightCol: [110, 40, 8] }); B.steam(d[0], d[1] - 0.6, 0.2); B.mark(d[0], d[1]); },
    19: (B, x, y) => { for (let i = -14; i <= 14; i++) for (let j = -3; j <= 3; j++) if (offWay(x + i + 0.5, y + j + 0.5) > 0) B.floor(x + i, y + j, j < 0 ? B.FL.FROST2 : B.FL.SCORCH); B.embers(x, y + 3, 3, 6); B.mark(x, y); },
    20: VIEW, 32: VIEW, 38: VIEW, 43: VIEW, 48: VIEW, 55: VIEW, 56: VIEW,
    21: (B, x, y) => { for (let i = -6; i <= 6; i++) for (let j = 0; j < 2; j++) B.floor(x + i, y + j, B.FL.SCORCH); B.mark(x, y); },
    22: (B, x, y) => { B.cairn(x, y, 1.7); B.mark(x + 0.5, y + 0.5); },
    23: (B, x, y) => { B.stone(x, y, 2.9, 't_la_rock', 't_la_rock'); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) B.stone(x + dx, y + dy, 1.1, 't_la_rock', 't_la_rock'); B.mark(x + 0.5, y + 0.5); },
    24: (B, x, y) => { for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) B.block(x - 1 + i, y - 1 + j, 6.2, 't_house_la_drystone', 't_la_rock'); B.mark(x + 0.5, y + 2); },
    25: (B, x, y) => { B.line(x - 4, y - 4, x - 4, y + 3, 1.8, 't_la_rock', 0, 't_la_rock'); B.line(x + 4, y - 4, x + 4, y + 3, 1.8, 't_la_rock', 0, 't_la_rock'); B.line(x - 3, y - 4, x + 3, y - 4, 2.0, 't_la_rock', 0, 't_la_rock'); B.patch(x, y, 3, B.FL.SCORCH, 25); B.thing('la_bones', x - 1, y); B.thing('la_scrap', x + 1.5, y - 1); B.mark(x, y + 2); },
    26: (B, x, y) => { for (let k = 0; k < 3; k++) { const bx = x - 5 + k * 5, by = y + (k & 1) * 3; B.stone(bx, by, 1.7); B.stone(bx + 2, by, 1.5); } B.thing('la_bones', x, y + 2); B.mark(x, y); },
    27: (B, x, y) => { for (let i = 0; i < 9; i++) { const a = hash(i, 27, 463) * 6.283, d = 1 + hash(27, i, 465) * 4; B.stone(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.3 + hash(i, 5, 467) * 0.5, i & 1 ? 't_wood' : 't_la_slag', 't_la_scorch'); } B.scatter('la_scrap', x, y, 4, 4); B.mark(x, y); },
    28: (B, x, y) => { B.line(x - 5, y - 2, x + 5, y - 2, 2.2, 't_la_rock', 0, 't_la_frost'); B.thing('la_bones', x, y); B.mark(x, y); },
    29: (B, x, y) => { B.cairn(x, y, 1.5); B.mark(x + 0.5, y + 0.5); },
    30: (B) => {
      const y = 1480;
      for (let x = 700; x <= 820; x++) {
        const road = offWay(x + 0.5, y + 0.5) < 0.6;
        B.block(x, y, road ? 3.0 : 3.4, road ? 't_wood' : 't_house_la_drystone', 't_la_rock', true);
      }
      B.mark(760.5, y - 1);
    },
    31: (B) => { B.mark(760.5, 1531); },
    33: (B, x, y) => { B.thing('la_dead', x + 0.5, y + 0.5); B.thing('la_ember', x + 2.4, y + 0.8, { glow: 1, lightCol: [44, 14, 4] }); B.thing('la_ember', x - 1.6, y + 1, { glow: 1, lightCol: [40, 12, 3] }); },
    34: (B, x, y) => { for (let i = -6; i <= 6; i++) B.floor(x + i, y, B.FL.SCORCH); B.thing('la_scrap', x + 2, y + 0.5); B.mark(x, y); },
    35: (B) => { const e = wayEnd('The Greystair road'); GATEPOSTS(B, e.x, e.y, e.a); },
    36: (B) => { const e = wayEnd('To the Iron Stair'); GATEPOSTS(B, e.x, e.y, e.a); },
    37: (B, x, y) => { B.stone(x, y, 1.9); B.stone(x + 2, y, 1.7); B.stone(x + 1, y + 3, 1.2); B.mark(x + 1, y + 1); },
    39: (B, x, y) => { B.ring(x, y, 5, 1.2, 't_house_la_drystone', Math.PI / 2); B.stone(x - 1, y + 5.6, 1.9, 't_la_rock', 't_la_rock'); B.stone(x + 1, y + 5.6, 1.9, 't_la_rock', 't_la_rock'); B.mark(x, y + 5); },
    40: (B, x, y) => { B.thing('la_bones', x + 0.5, y + 0.5, { scale: 1.6 }); },
    41: (B, x, y) => { B.line(x - 3, y, x + 3, y, 1.0); B.thing('la_boots', x + 0.5, y + 1.2); },
    42: (B, x, y) => { B.scatter('la_scrap', x, y, 3, 3); B.mark(x, y); },
    44: (B, x, y) => { for (let i = 0; i < 5; i++) B.floor(x + i - 2, y + (i & 1), B.FL.EMBER); B.steam(x + 0.5, y + 0.5, 0.05); B.mark(x + 0.5, y + 0.5); },
    45: (B, x, y) => { B.patch(x, y, 3, B.FL.SLAG, 45); B.stone(x, y, 0.5, 't_la_slag', 't_la_slag'); B.stone(x + 2, y + 1, 0.4, 't_la_slag', 't_la_slag'); B.embers(x, y, 2, 2); B.mark(x + 1, y + 1); },
    46: (B, x, y) => { B.line(x - 7, y, x + 7, y + 2, 0.9, 't_house_la_drystone', 0.35); B.mark(x, y + 1); },
    47: (B, x, y) => { B.stone(x, y, 1.6); B.stone(x + 2, y, 1.4); B.patch(x + 1, y + 2, 1.5, B.FL.SCORCH, 47); B.mark(x + 1, y + 1); },
    49: (B, x, y) => { for (let i = -15; i <= 15; i++) for (let j = -4; j <= 4; j++) { const edge = Math.round(Math.sin(i / 5) * 1.5); if (offWay(x + i + 0.5, y + j + 0.5) > 0) B.floor(x + i, y + j, j < edge ? B.FL.FROST : B.FL.SCORCH); } B.mark(x, y); },
    50: (B, x, y) => { B.thing('la_bones', x + 0.5, y + 0.5); B.patch(x, y, 2, B.FL.SCORCH, 50); },
    51: (B, x, y) => { B.stone(x, y, 0.55, 't_la_rock', 't_la_rock'); B.thing('la_scrap', x + 0.5, y + 1.3); },
    52: (B, x, y) => { B.thing('la_bones', x + 0.5, y + 0.5); },
    53: (B, x, y) => { B.thing('la_scrap', x + 0.5, y + 0.5); },
    54: (B, x, y) => { for (let i = 0; i < 3; i++) B.stone(x + i * 2, y + (i & 1), 0.6, 't_la_frost2', 't_la_frost'); B.mark(x + 2, y + 1); },
  };

  // ---------------------------------------------------------------- the wire's state, and putting the places up and down
  const ST = { applied: null, rec: null, found: 0, err: null, puffs: 0, acc: 0, k: 0 };
  const sw = () => typeof GFX === 'undefined' || GFX.laPlaces !== false;
  // where each place's things were put: its number -> [x, y] (the point its builder was given)
  const AT = {};
  function apply(m) {
    const rec = { m, cells: [], floors: [], ents: [], steam: [] };
    for (const [n, raw, x, y] of PLACES) {
      const name = nameOf(raw), B = builder(m, rec, n, name);
      const clear = ON_POINT.includes(n) ? 0 : 3;
      const p = beside(n, x + 0.5, y + 0.5, clear), bx = Math.floor(p[0]), by = Math.floor(p[1]);
      AT[n] = [bx + 0.5, by + 0.5];
      try { RECIPES[n](B, bx, by); } catch (e) { ST.err = ST.err || ('place ' + n + ': ' + String(e && e.message)); }
    }
    ST.applied = m; ST.rec = rec;
    return rec;
  }
  function remove() {
    const rec = ST.rec; if (!rec) return;
    const m = rec.m;
    for (let i = rec.cells.length - 1; i >= 0; i--) { const [x, y, c] = rec.cells[i]; m.set(x, y, c); }
    for (let i = rec.floors.length - 1; i >= 0; i--) { const [x, y, f] = rec.floors[i]; m.setFloor(x, y, f); }
    const gone = new Set(rec.ents);
    for (let i = m.entities.length - 1; i >= 0; i--) if (gone.has(m.entities[i])) m.entities.splice(i, 1);
    ST.applied = null; ST.rec = null;
  }
  // put them up or take them down to match the switch, on the open map once it is made
  function sync() {
    if (typeof G === 'undefined' || !G || !G.maps) return;
    const m = G.maps[ID];
    if (ST.applied && ST.applied !== m) { ST.applied = null; ST.rec = null; }
    if (!m || !O.ready(m)) return;
    if (sw() && !ST.applied) apply(m);
    else if (!sw() && ST.applied) remove();
  }
  const foundList = () => (G.flags.la_found = Array.isArray(G.flags.la_found) ? G.flags.la_found : []);
  function tick(dt) {
    sync();
    if (G.state !== 'play' || G.mapId !== ID || !ST.applied) return;
    const c = Engine.cam, F = foundList();
    for (const [n, raw] of PLACES) {
      if (F.includes(n)) continue;
      const p = AT[n]; if (!p || Math.hypot(c.x - p[0], c.y - p[1]) > FOUND_R) continue;
      F.push(n); ST.found++;
      msg(nameOf(raw), '', 4500);
      if (GATE_WAY[n]) msg(T.TX.notBuilt(GATE_WAY[n]), '', 4500);
    }
    // steam from the warm ground, near you only
    if (typeof FIRESMOKE === 'undefined' || !FIRESMOKE.spawn || (typeof GFX !== 'undefined' && GFX.smoke === false)) return;
    ST.acc += (dt || 0) * 3;
    while (ST.acc >= 1) {
      ST.acc -= 1;
      for (const s of ST.rec.steam) {
        if (Math.hypot(s.x - c.x, s.y - c.y) > 90) continue;
        const k = ST.k++, j = (q) => hash(k, q, 469) - 0.5;
        if (FIRESMOKE.spawn(0, s.x + j(1) * 0.5, s.y + j(2) * 0.5, s.z, j(3) * 0.05, j(4) * 0.05, 0.45 + j(5) * 0.1, 3.2, 0.06, 0.5, 0.35, 0, s.z + 2.6)) ST.puffs++;
      }
    }
  }
  // the map (M): the places found, a ring and a name each
  function markMap() {
    const cv = document.getElementById('amap'); if (!cv || !ST.applied) return;
    const cx = cv.getContext('2d'), F = foundList();
    cx.font = 'bold 22px serif'; cx.textAlign = 'left';
    for (const [n, raw] of PLACES) {
      if (!F.includes(n) || !AT[n]) continue;
      const [x, y] = AT[n];
      cx.strokeStyle = '#e8c870'; cx.lineWidth = 3; cx.beginPath(); cx.arc(x, y, 7, 0, 7); cx.stroke();
      // near the east edge the name goes to the left of its ring, so it is not cut off
      const left = x > cv.width - 380;
      cx.textAlign = left ? 'right' : 'left'; cx.fillStyle = '#e8c870'; cx.fillText(nameOf(raw), left ? x - 11 : x + 11, y + 7);
    }
  }
  function wire() {
    if (typeof window === 'undefined' || typeof G === 'undefined' || !O || !T) return false;
    paintArt();
    const _up = update;
    update = function (dt) { const r = _up.apply(this, arguments); try { tick(dt); } catch (e) { ST.err = ST.err || String(e && e.message); } return r; };
    const _lm = loadMap;
    loadMap = function (id) {
      const r = _lm.apply(this, arguments);
      try {
        if (id === ID) sync();
        // the ledge and the bothy are their own maps (Z-R3): being there is finding them
        if (id === 'la_ledge' || id === 'la_bothy') { const F = foundList(), n = id === 'la_ledge' ? 1 : 2; if (!F.includes(n)) F.push(n); }
      } catch (e) { ST.err = ST.err || String(e && e.message); }
      return r;
    };
    // a save keeps none of the places' things: they are put up again when the map is (the engine's restore makes only
    // enemies and items from a map's extra things anyway)
    if (typeof snapshotGame === 'function') {
      const _sg = snapshotGame;
      snapshotGame = function () {
        const d = _sg.apply(this, arguments);
        try { const z = d && d.maps && d.maps[ID]; if (z && Array.isArray(z.extra)) z.extra = z.extra.filter((o) => o.kind !== 'deco'); } catch (e) { ST.err = ST.err || String(e && e.message); }
        return d;
      };
    }
    if (typeof renderMap === 'function') {
      const _rm = renderMap;
      renderMap = function () { const r = _rm.apply(this, arguments); try { if (G.mapId === ID) markMap(); } catch (e) { ST.err = ST.err || String(e && e.message); } return r; };
    }
    if (typeof LEDGE1 !== 'undefined') LEDGE1.SWITCHES.push(['laPlaces', TX.switchName, TX.switchWhat]);
    return true;
  }
  const wired = wire();
  return { TX, ID, PLACES, RECIPES, ART, GATE_WAY, FOUND_R, nameOf, offWay, beside, apply, remove, sync, at: () => AT, state: () => ST, wired };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = PLACES43;
