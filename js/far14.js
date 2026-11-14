// ============================================================
//  far14 — Phase 14 "A world that shows the story", the FAR team: a view distance that goes much farther.
//
//  The View distance setting (Options -> Graphics & access) now runs 0.6 to 4: the old steps up to 1.4, then
//  2 ("Far"), 2.5 ("Far", the Ultra preset), 3 ("Very far"), 4 ("Horizon"). Everything that makes far views look
//  right lives in js/engine.js (the renderer owns the pixels) and is written down at the top of its FAR block:
//
//    RULES (viewDist = the multiplier on each map's own fogDist, kEff = what the renderer actually uses)
//    1. Up to 1.4 nothing changes: same frames as before this phase (the original / low / medium / high presets,
//       and every slider value the game had).
//    2. Indoors kEff = min(viewDist, 1.4). A dungeon at 4x is as dark beyond the light as at 1.4x: the dark is the
//       limit, and far view only matters where something lights it. (A room is never "seen into the distance".)
//    3. Outdoors above 1.4 ("far mode", switch GFX.farLook): the haze that ends the view is the colour of the sky
//       just above the horizon (time of day, weather and the dusk glow included) mixed with the map's own fog
//       colour (55% of the way at 2x, 85% at 4x), so far country reads as depth instead of as dark fog.
//    4. Far mode also: terrain and walls beyond 0.3 base fog lengths fade into the average colour of their texture
//       (fully by 0.85), so nothing shimmers; a wall past that is a single flat fill (cheaper than a texture walk).
//       Sprites beyond 2 base fog lengths skip the light sample, use a nearest-neighbour smaller copy, and are
//       hidden from the post hooks that decorate sprites (outlines, ground shadows, fight marks, air effects).
//       Ray walks run to the edge of the map (not 96 steps) and point lights beyond 1.6 base fog lengths are dropped.
//    5. Gameplay never reads any of it. AI, detection, sound, picking and the Dread phantom use the map's own
//       distances (js/dread.js foeSpot no longer multiplies by GFX.viewDist).
//
//  This file: the Options switch ("Far view look"), the stored view distance (localStorage 'echoes-far14': the
//  slider persists between sessions, like any other setting; the preset buttons set it too), FAR14.info() for tests
//  and FAR14.measure() for the frame-cost table. Nothing here touches saves or the game's Math.random sequence.
// ============================================================
'use strict';

const FAR14 = (() => {
  const KEY = 'echoes-far14';
  const stored = { viewDist: null, farLook: null };
  let mine = false;

  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && typeof o === 'object') {
        if (typeof o.viewDist === 'number' && isFinite(o.viewDist)) stored.viewDist = o.viewDist;
        if (typeof o.farLook === 'boolean') stored.farLook = o.farLook;
      }
    } catch (e) { /* storage blocked: the settings keep their preset values */ }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(stored)); } catch (e) { /* optional */ } }

  // the slider value follows every settings change (a preset button or the buttons in Options), and comes back at boot
  function onChange() {
    if (mine || typeof GFX === 'undefined') return;
    if (GFX.viewDist !== stored.viewDist) { stored.viewDist = GFX.viewDist; save(); }
    if (stored.farLook !== null && GFX.farLook !== stored.farLook && GFX.preset !== 'original' && GFX.preset !== 'plain') {
      mine = true; try { GFX.farLook = stored.farLook; } finally { mine = false; }
    }
  }
  function setFarLook(on) {
    mine = true;
    try { GFX.farLook = !!on; stored.farLook = !!on; save(); if (typeof PRESETS !== 'undefined') GFX.preset = PRESETS.current(); GFX.changed(); } finally { mine = false; }
  }

  // ---- Options row ------------------------------------------------------------------------------------------
  function appendRow() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById('gfx-farlook')) return;
    const label = document.createElement('span'); label.className = 'gfx-label'; label.appendChild(document.createTextNode('Far view look '));
    const hint = document.createElement('small'); hint.className = 'muted'; hint.textContent = 'sky haze and cheaper far detail above 1.4x view distance'; label.appendChild(hint);
    const b = document.createElement('button'); b.className = 'dfbtn small'; b.id = 'gfx-farlook'; b.type = 'button'; b.setAttribute('aria-label', 'Far view look');
    const sync = () => { b.textContent = GFX.farLook ? 'On' : 'Off'; b.setAttribute('aria-pressed', GFX.farLook ? 'true' : 'false'); };
    b.onclick = () => { setFarLook(!GFX.farLook); sync(); };
    sync();
    // sits right under the View distance row (the row is two cells: label, then the buttons group)
    const vd = document.getElementById('gfx-vd-val'), grp = vd && vd.parentNode;
    if (grp && grp.parentNode === grid && grp.nextSibling) { grid.insertBefore(label, grp.nextSibling); grid.insertBefore(b, label.nextSibling); }
    else { grid.appendChild(label); grid.appendChild(b); }
  }
  function wire() {
    if (typeof renderAccessibilityMenu === 'function') {
      const _acc = renderAccessibilityMenu;
      renderAccessibilityMenu = function () {
        const r = _acc.apply(this, arguments);
        try { appendRow(); } catch (e) { console.warn('far view row failed', e); }
        return r;
      };
    }
  }

  // ---- what the last frame did about distance ----------------------------------------------------------------
  const info = () => Object.assign({ viewDist: GFX.viewDist, farLook: GFX.farLook, preset: GFX.preset }, Engine.farInfo());

  // ---- frame cost ---------------------------------------------------------------------------------------------
  // Median ms per Engine.render for each view distance in each scene, with 12 enemies standing in view. Puts the game back as it
  // found it. opts: { scenes: [{id,map,x,y,dir}], dists: [1,2,3,4], scales: [1,2], frames, runs }
  const SCENES = [
    { id: 'oakhaven', map: 'oakhaven', x: 23.5, y: 20.5, dir: -1.57 },
    { id: 'clearing', map: 'clearing', x: 20.5, y: 32.5, dir: -Math.PI / 2 },
    { id: 'deepwoods', map: 'deepwoods', x: 27.5, y: 30.5, dir: -1.57 },
  ];
  const median = (a) => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  function measure(opts) {
    opts = opts || {};
    const dists = opts.dists || [1, 2, 3, 4], scales = opts.scales || [1, 2], frames = opts.frames || 30, runs = opts.runs || 7, scenes = opts.scenes || SCENES;
    const keep = { map: G.mapId, x: Engine.cam.x, y: Engine.cam.y, dir: Engine.cam.dir, state: G.state, fadeT: G.fadeT, gfx: {}, ents: G.ents };
    for (const k in GFX) { const t = typeof GFX[k]; if (t === 'number' || t === 'boolean' || t === 'string') keep.gfx[k] = GFX[k]; }
    const out = {};
    try {
      for (const sc of scenes) {
        loadMap(sc.map, { x: sc.x, y: sc.y, dir: sc.dir }); G.state = 'play'; G.fadeT = 0;
        const crowd = [];
        for (let i = 0; i < 12; i++) {
          const ang = sc.dir + (i - 5.5) * 0.11, d = 5 + (i % 6) * 3.2;
          const e = hydrate({ kind: 'enemy', type: ['hound', 'proctor', 'quiet', 'legionnaire'][i % 4], x: sc.x + Math.cos(ang) * d, y: sc.y + Math.sin(ang) * d });
          e.state = 'passive'; crowd.push(e);
        }
        const ents = G.ents.concat(crowd);
        const t = {};
        for (const s of scales) for (const v of dists) t[s + 'x@' + v] = [];
        for (let r = 0; r < runs; r++) {
          for (const s of scales) for (const v of dists) {
            PRESETS.setScale(s); GFX.viewDist = v; Engine.setLook({ fogK: v });
            for (let i = 0; i < 4; i++) Engine.render(ents, G.tod);
            const t0 = performance.now();
            for (let i = 0; i < frames; i++) Engine.render(ents, G.tod);
            t[s + 'x@' + v].push((performance.now() - t0) / frames);
          }
        }
        out[sc.id] = {}; for (const k in t) out[sc.id][k] = Math.round(median(t[k]) * 100) / 100;
      }
    } finally {
      Object.assign(GFX, keep.gfx); Engine.setScale(GFX.scale); Engine.setLook({ fogK: GFX.viewDist }); GFX.changed();
      loadMap(keep.map, { x: keep.x, y: keep.y, dir: keep.dir }); G.state = keep.state; G.fadeT = keep.fadeT;
    }
    api.last = out;
    return out;
  }

  const api = { KEY, info, measure, setFarLook, stored, scenes: SCENES, last: null };
  load();
  wire();
  if (typeof GFX !== 'undefined') {
    GFX.onChange(onChange);
    // restore the slider (after the preset the game booted on), then the switch
    if (stored.viewDist !== null && typeof PRESETS !== 'undefined') { mine = true; try { PRESETS.setViewDist(stored.viewDist); } finally { mine = false; } stored.viewDist = GFX.viewDist; }
    if (stored.farLook !== null) GFX.farLook = stored.farLook;
  }
  return api;
})();
