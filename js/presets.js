// ============================================================
//  presets — Original / Low / Medium / High graphics presets, the Graphics block in the
//  Options -> accessibility menu, CRT curvature and upscaling choice, and PRESETS.measure().
//  Loads last: it only sets GFX fields, calls Engine.setScale / Engine.setLook and
//  rescales PART_STYLE, so every other module just reads GFX.
// ============================================================
'use strict';

const PRESETS = (() => {
  const ORDER = ['original', 'low', 'medium', 'high', 'ultra', 'cinematic'];
  const LABEL = { original: 'Original', low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra', cinematic: 'Cinematic', custom: 'Custom' };
  // Low keeps the cheap effects (decals, ceilings, emissive, stars, grade, detail, scenery) and drops these.
  // Any flag this list does not name is "unknown": on for low/medium/high, off for original. (The painted panoramas
  // left this list in Phase 20 MAX: they are art, on in every preset; see ART below.)
  const LOW_OFF = ['bloom', 'softFog', 'mist', 'reflections', 'grass', 'flyovers', 'darkInteriors', 'groundShadows',
    'sunShafts', 'heatHaze', 'glassGlare', 'seeThrough', 'coldBreath', 'footprints', 'hushWave', 'folkHoods', 'folkHuddle', 'folkCapes', 'folkTavern', 'greenStages', 'glassSpread', 'rootVeins', 'p14pMirrors', 'p14pShimmer', 'aurora', 'causticLight', 'deepView', 'flumeGlow', 'winter17'];   // ground shadows cost about 1 ms a frame in town; the Phase 11 air effects are all per-frame (js/air11.js)
  // Phase 14 CINEMA: these flags are on ONLY in the Cinematic preset (off in original/low/medium/high, so those frames are
  // unchanged); js/cinema14.js owns them. Any other flag in a 'cinema' preset follows the 'all' rule.
  const CINEMA_ONLY = ['cineLight', 'cineFog', 'cineGrade'];
  // ...and these are off in Cinematic: its own emissive bloom (cineLight) replaces post.js bloom, which in far mode also
  // blooms hazed distance into pale discs
  const CINEMA_OFF = ['bloom'];
  // Phase 20 MAX ("the graphics aren't high enough to leave anything off"): ART switches are on in EVERY preset,
  // Original and Low included. They choose which built-once picture is drawn (hand-built enemy views, small-life
  // sprites, wall and ceiling textures, set dressing, the painted panoramas), so they cost nothing per frame once
  // built; per-frame EFFECTS keep the rules above. Art that is not a preset flag at all (painted art, item icons,
  // mood portraits, companion life frames, carved frames, log sketches, map stamps, illustrated screens) was
  // already on in every preset. A module can add its own art flag to GFX.ART; any 'p20_beast*' flag (each half of
  // the Phase 20 bestiary) counts as art. GFX.plain() (the pixel-exact test switch) still turns everything off.
  const ART = ['directions', 'p20_beastA', 'p20_beastb', 'critters', 'kestrelMoored', 'carrionCrows', 'decals', 'detail', 'ceilings', 'scenery', 'panoramas', 'belfryArt'];
  // ...and these cheap per-frame effects are on in every preset but Low, Original included (Phase 20 MAX; the country
  // beyond the walls, js/horizon20.js, costs about 1 ms: Low stays light for weak devices)
  const ALL_BUT_LOW = ['farCountry'];
  const isArt = (flag) => ART.includes(flag) || /^p20_beast/.test(flag) || (typeof GFX !== 'undefined' && Array.isArray(GFX.ART) && GFX.ART.includes(flag));
  // CRT curvature and the upscaling filter are display choices, not quality: presets leave them alone
  // (only 'original' switches curvature off, because GFX.plain() does).
  const NOT_PRESET = ['crtCurve'];
  const table = {
    original: { scale: 1, viewDist: 1, particles: 1, fx: 'none' },
    low: { scale: 1, viewDist: 0.8, particles: 0.5, fx: 'cheap' },
    medium: { scale: 1, viewDist: 1, particles: 1, fx: 'all' },
    high: { scale: 2, viewDist: 1.15, particles: 1.25, fx: 'all' },
    ultra: { scale: 2, viewDist: 2.5, particles: 1.25, fx: 'all' },   // Phase 14 FAR; no preset offers 4x, that is the slider's top step
    // Phase 14 CINEMA: Ultra plus the cinematic post pass (js/cinema14.js): the engine's far haze (viewDist 2.5) is the
    // aerial perspective outdoors; cinema14 adds ground fog, emissive bloom, god rays, grade and vignette (and indoor depth haze).
    cinematic: { scale: 2, viewDist: 2.5, particles: 1.25, fx: 'cinema' },
  };
  const BOOT = 'medium';
  // Why medium at boot. PRESETS.measure() times Engine.render per preset (round-robin, so machine noise
  // hits every preset alike). Median of seven 60-frame runs, ms per frame, headless Chromium on a shared
  // 2-CPU build server (load average 10 to 24 while measuring, so expect +-1 ms), with only the foundation
  // phase's effects present in this branch:
  //                 oakhaven  deepwoods  whispergrove  tavern
  //     original       7.05      9.23        5.41        4.01
  //     low            6.95     11.03        4.45        4.04
  //     medium         6.57      7.73        3.62        4.53
  //     high          21.80     26.88       13.79       13.42
  // Fastest-of-seven gives the same picture: original 6.1/7.1/3.0/3.2, medium 5.7/6.6/3.2/3.0, high 19.7/19.7/11.7/12.4.
  // What the numbers support: low, medium and original cost the same within noise (the effect modules these
  // presets switch on are thin or stubs in this branch), and only scale 2 changes the cost: about 3x here,
  // because it renders four times the pixels. So medium (scale 1, every effect on) is the default and scale 2
  // stays opt-in. Re-run test/presets.test.js once the effect modules land, and before touching the table.
  // SERVER NUMBERS ARE NOT CHROMEBOOK NUMBERS: they rank the presets against each other, nothing more.

  const upscale = { mode: 'sharp' };   // 'sharp' | 'smooth' — CSS image-rendering on #view

  // --- original part counts, remembered once ----------------------------------------------------
  const origN = {};
  function rememberParticles() {
    if (typeof PART_STYLE === 'undefined') return;
    for (const id in PART_STYLE) if (origN[id] === undefined) origN[id] = PART_STYLE[id].n;
  }
  function scaleParticles(mult) {
    if (typeof PART_STYLE === 'undefined') return;
    rememberParticles();
    for (const id in PART_STYLE) PART_STYLE[id].n = Math.max(0, Math.round(origN[id] * mult));
    // anim.js only rebuilds its particle list when the map changes: force it on the next frame
    try { if (typeof PARTICLES !== 'undefined') PARTICLES.mapId = null; } catch (e) { /* optional */ }
  }

  function fxWanted(kind, flag) {
    if (isArt(flag)) return true;
    if (ALL_BUT_LOW.includes(flag)) return kind !== 'cheap';
    if (kind === 'none') return false;
    if (CINEMA_ONLY.includes(flag)) return kind === 'cinema';
    if (kind === 'cinema' && CINEMA_OFF.includes(flag)) return false;
    if (kind === 'cheap') return !LOW_OFF.includes(flag);
    return true;
  }

  function pushLook() {
    Engine.setScale(GFX.scale);
    Engine.setLook({ fogK: GFX.viewDist });
    scaleParticles(GFX.particles);
  }

  function apply(name) {
    const t = table[name];
    if (!t) throw new Error('unknown graphics preset: ' + name);
    GFX.scale = t.scale; GFX.viewDist = t.viewDist; GFX.particles = t.particles;
    // iterate GFX.FX, not a fixed list: other teams add flags (ceilings, emissive, darkInteriors...) at load
    for (const k of GFX.FX) {
      if (k === 'crtCurve') { if (t.fx === 'none') GFX[k] = false; continue; }
      GFX[k] = fxWanted(t.fx, k);
    }
    pushLook();
    GFX.preset = name;
    GFX.changed();
    return name;
  }

  function matches(name) {
    const t = table[name];
    if (GFX.scale !== t.scale || Math.abs(GFX.viewDist - t.viewDist) > 1e-6 || Math.abs(GFX.particles - t.particles) > 1e-6) return false;
    for (const k of GFX.FX) if (!NOT_PRESET.includes(k) && !!GFX[k] !== fxWanted(t.fx, k)) return false;
    return true;
  }
  function current() {
    for (const n of ORDER) if (matches(n)) return n;
    return 'custom';
  }

  // --- individual settings (each one makes the state "custom" unless it lands on a preset) ---------
  function touched() { GFX.preset = current(); GFX.changed(); }
  function setScale(s) { GFX.scale = s === 2 ? 2 : 1; Engine.setScale(GFX.scale); touched(); }
  // Phase 14 FAR: the old 0.6..1.4 steps of 0.05, then four far steps (labelled Far / Far / Very far / Horizon)
  const FAR_STEPS = [2, 2.5, 3, 4], FAR_LABEL = { 2: 'Far', 2.5: 'Far', 3: 'Very far', 4: 'Horizon' };
  function snapViewDist(v) {
    v = Math.max(0.6, Math.min(4, isFinite(+v) ? +v : 1));
    if (v <= 1.4 + 1e-9) return Math.round(v * 20) / 20;
    let best = 1.4, bd = v - 1.4; for (const s of FAR_STEPS) if (Math.abs(s - v) < bd) { bd = Math.abs(s - v); best = s; }
    return best;
  }
  function viewSteps() { const a = []; for (let i = 12; i <= 28; i++) a.push(i / 20); return a.concat(FAR_STEPS); }
  function stepViewDist(dir) {
    const list = viewSteps(); let i = 0; for (let k = 0; k < list.length; k++) if (Math.abs(list[k] - GFX.viewDist) < Math.abs(list[i] - GFX.viewDist)) i = k;
    setViewDist(list[Math.max(0, Math.min(list.length - 1, i + dir))]);
  }
  function setViewDist(v) { GFX.viewDist = snapViewDist(v); Engine.setLook({ fogK: GFX.viewDist }); touched(); }
  function setParticles(v) { GFX.particles = Math.round(Math.max(0, Math.min(2, v)) * 100) / 100; scaleParticles(GFX.particles); touched(); }
  function setCurve(on) { GFX.crtCurve = !!on; touched(); }
  // darker interiors are an accessibility choice as much as a look: they get their own switch
  function setDark(on) { GFX.darkInteriors = !!on; touched(); }
  function setUpscale(mode) { upscale.mode = mode === 'smooth' ? 'smooth' : 'sharp'; syncClasses(); }

  // --- DOM classes: CRT curvature only shows with CRT on; smooth upscaling is a CSS filter choice ----
  function syncClasses() {
    try {
      const g = document.getElementById('game'), v = document.getElementById('view');
      const crt = typeof UPG !== 'undefined' && !!UPG.crt;
      if (g) g.classList.toggle('crt-curve', crt && !!GFX.crtCurve);
      if (v) v.classList.toggle('smooth-up', upscale.mode === 'smooth');
    } catch (e) { /* never break the page */ }
  }

  // --- measurement ------------------------------------------------------------------------------
  const SCENES = [
    { id: 'oakhaven', name: 'oakhaven', x: 23.5, y: 20.5, dir: -1.57 },
    { id: 'deepwoods', name: 'deepwoods', x: 27.5, y: 30.5, dir: -1.57 },
    { id: 'whispergrove', name: 'whispergrove', spawn: true },
    { id: 'tavern', name: 'tavern', x: 8.5, y: 10.5, dir: -1.57 },
  ];
  function median(a) { const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  // Median ms per Engine.render over `runs` runs of `frames` frames, for every preset in every scene.
  // Puts the game back where it found it (map, position, preset and custom settings).
  function measure(opts) {
    opts = opts || {};
    const runs = opts.runs || 9, frames = opts.frames || 60;
    const keep = { map: G.mapId, x: Engine.cam.x, y: Engine.cam.y, dir: Engine.cam.dir, state: G.state, fadeT: G.fadeT, gfx: {} };
    for (const k in GFX) { const t = typeof GFX[k]; if (t === 'number' || t === 'boolean' || t === 'string') keep.gfx[k] = GFX[k]; }
    const out = {}, best = {}, names = opts.presets || ORDER;
    for (const n of names) { out[n] = {}; best[n] = {}; }
    try {
      // Round-robin: inside each scene every preset takes a turn per round, so a noisy neighbour on a
      // shared machine hits all presets alike instead of whichever happened to run last.
      for (const sc of SCENES) {
        loadMap(sc.id, sc.spawn ? undefined : { x: sc.x, y: sc.y, dir: sc.dir });
        G.fadeT = 0;
        const times = {}; for (const n of names) times[n] = [];
        for (let r = 0; r < runs; r++) {
          for (const n of names) {
            apply(n);
            for (let i = 0; i < 6; i++) Engine.render(G.ents, G.tod);   // warm up: buffers just reallocated, caches, lazily built art
            const t0 = performance.now();
            for (let i = 0; i < frames; i++) Engine.render(G.ents, G.tod);
            times[n].push((performance.now() - t0) / frames);
          }
        }
        for (const n of names) { out[n][sc.name] = Math.round(median(times[n]) * 100) / 100; best[n][sc.name] = Math.round(Math.min.apply(null, times[n]) * 100) / 100; }
      }
    } finally {
      Object.assign(GFX, keep.gfx); pushLook(); GFX.changed();
      loadMap(keep.map, { x: keep.x, y: keep.y, dir: keep.dir }); G.state = keep.state; G.fadeT = keep.fadeT;
    }
    api.last = out; api.lastBest = best;
    return out;
  }

  // --- Options UI -------------------------------------------------------------------------------
  function el(tag, props, text) {
    const e = document.createElement(tag);
    if (props) for (const k in props) { if (k === 'style') e.style.cssText = props[k]; else e.setAttribute(k, props[k]); }
    if (text != null) e.textContent = text;
    return e;
  }
  const row = (label, hint) => {
    const s = el('span', { class: 'gfx-label' }, label);
    if (hint) { s.appendChild(document.createTextNode(' ')); s.appendChild(el('small', { class: 'muted' }, hint)); }
    return s;
  };
  const group = () => el('span', { class: 'ctl-step gfx-group', style: 'flex-wrap:wrap;justify-content:flex-end' });
  const btn = (id, text, onclick, aria) => {
    const b = el('button', { class: 'dfbtn small', id, type: 'button' }, text);
    if (aria) b.setAttribute('aria-label', aria);
    b.onclick = onclick; return b;
  };

  function refreshBlock() {
    const q = id => document.getElementById(id);
    if (!q('gfx-state')) return;
    const cur = current();
    q('gfx-state').textContent = 'Graphics: ' + LABEL[cur];
    for (const n of ORDER) { const b = q('gfx-p-' + n); b.classList.toggle('sel', cur === n); b.setAttribute('aria-pressed', cur === n ? 'true' : 'false'); }
    for (const s of [1, 2]) { const b = q('gfx-res' + s); b.classList.toggle('sel', GFX.scale === s); b.setAttribute('aria-pressed', GFX.scale === s ? 'true' : 'false'); }
    q('gfx-vd-val').textContent = GFX.viewDist.toFixed(2) + (FAR_LABEL[GFX.viewDist] ? ' ' + FAR_LABEL[GFX.viewDist] : '');
    q('gfx-pt-val').textContent = GFX.particles.toFixed(2);
    for (const m of ['sharp', 'smooth']) { const b = q('gfx-up-' + m); b.classList.toggle('sel', upscale.mode === m); b.setAttribute('aria-pressed', upscale.mode === m ? 'true' : 'false'); }
    const dk = q('gfx-dark'); if (dk) { dk.textContent = GFX.darkInteriors ? 'On' : 'Off'; dk.setAttribute('aria-pressed', GFX.darkInteriors ? 'true' : 'false'); }
    const c = q('gfx-curve'); c.textContent = GFX.crtCurve ? 'On' : 'Off'; c.setAttribute('aria-pressed', GFX.crtCurve ? 'true' : 'false');
    const on = typeof UPG !== 'undefined' && UPG.crt;
    c.title = on ? '' : 'Curvature shows once CRT scanlines are on';
  }

  function appendGraphicsBlock() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById('gfx-state')) return;
    const full = 'grid-column:1/-1';
    const head = el('span', { id: 'gfx-state', style: full + ';margin-top:1cqh;color:var(--gold);font-family:var(--font-display);letter-spacing:.08em', role: 'status' }, '');
    grid.appendChild(head);

    grid.appendChild(row('Preset', 'sharpness, view distance, particles and effects'));
    const pg = group();
    for (const n of ORDER) pg.appendChild(btn('gfx-p-' + n, LABEL[n], () => { apply(n); refreshBlock(); syncClasses(); }));
    grid.appendChild(pg);

    grid.appendChild(row('Resolution', '1x is the original 320x150 view, 2x renders four times the pixels'));
    const rg = group();
    rg.appendChild(btn('gfx-res1', '1x', () => { setScale(1); refreshBlock(); }, 'Resolution 1x'));
    rg.appendChild(btn('gfx-res2', '2x', () => { setScale(2); refreshBlock(); }, 'Resolution 2x'));
    grid.appendChild(rg);

    grid.appendChild(row('View distance', 'fog reach, 0.6 to 4 (Horizon)'));
    const vg = group();
    vg.appendChild(btn('gfx-vd-dn', '−', () => { stepViewDist(-1); refreshBlock(); }, 'Shorter view distance'));
    vg.appendChild(el('b', { id: 'gfx-vd-val' }, ''));
    vg.appendChild(btn('gfx-vd-up', '+', () => { stepViewDist(1); refreshBlock(); }, 'Longer view distance'));
    grid.appendChild(vg);

    grid.appendChild(row('Particles', 'leaves, motes, dust and weather'));
    const tg = group();
    tg.appendChild(btn('gfx-pt-dn', '−', () => { setParticles(GFX.particles - 0.25); refreshBlock(); }, 'Fewer particles'));
    tg.appendChild(el('b', { id: 'gfx-pt-val' }, ''));
    tg.appendChild(btn('gfx-pt-up', '+', () => { setParticles(GFX.particles + 0.25); refreshBlock(); }, 'More particles'));
    grid.appendChild(tg);

    grid.appendChild(row('Upscaling', 'Sharp pixels is the clean unfiltered look'));
    const ug = group();
    ug.appendChild(btn('gfx-up-sharp', 'Sharp pixels', () => { setUpscale('sharp'); refreshBlock(); }));
    ug.appendChild(btn('gfx-up-smooth', 'Smooth', () => { setUpscale('smooth'); refreshBlock(); }));
    grid.appendChild(ug);

    grid.appendChild(row('Dark interiors', 'rooms lit only by their lamps and your lantern (U)'));
    grid.appendChild(btn('gfx-dark', 'On', () => { setDark(!GFX.darkInteriors); refreshBlock(); }, 'Dark interiors'));
    grid.appendChild(row('CRT curvature', 'needs CRT scanlines on'));
    grid.appendChild(btn('gfx-curve', 'Off', () => { setCurve(!GFX.crtCurve); syncClasses(); refreshBlock(); }));
    refreshBlock();
  }

  // --- wiring: wrap, never edit, the functions other files own -----------------------------------
  function wire() {
    if (typeof renderAccessibilityMenu === 'function') {
      const _acc = renderAccessibilityMenu;
      renderAccessibilityMenu = function () {
        const r = _acc.apply(this, arguments);
        try { appendGraphicsBlock(); } catch (e) { console.warn('graphics block failed', e); }
        return r;
      };
    }
    if (typeof applyVisualSettings === 'function') {
      const _vis = applyVisualSettings;
      applyVisualSettings = function () { const r = _vis.apply(this, arguments); syncClasses(); return r; };
    }
    // The Options panel has no door to the accessibility menu in this build; add one (a single button).
    if (typeof renderMenu === 'function') {
      const _menu = renderMenu;
      renderMenu = function () {
        const r = _menu.apply(this, arguments);
        try {
          const list = document.querySelector('#modal-panel .menu-list');
          if (list && !document.getElementById('mn-gfx') && typeof renderAccessibilityMenu === 'function') {
            const b = el('button', { class: 'dfbtn', id: 'mn-gfx', type: 'button' }, 'Graphics & access');
            b.setAttribute('aria-label', 'Graphics, difficulty and accessibility');
            b.onclick = () => renderAccessibilityMenu();
            // share the Controls row instead of adding one: the Options panel is already tight (hardcore.test.js checks it fits)
            const ctl = document.getElementById('mn-ctl');
            if (ctl && ctl.parentNode === list) {
              const pair = el('div', { style: 'display:flex;gap:1cqw' });
              list.insertBefore(pair, ctl); pair.appendChild(ctl); pair.appendChild(b);
              for (const x of [ctl, b]) x.style.cssText = 'flex:1 1 0;min-width:0';
            } else list.insertBefore(b, document.getElementById('mn-title') || null);
          }
        } catch (e) { console.warn('options entry failed', e); }
        return r;
      };
    }
    GFX.onChange(syncClasses);
    // GFX.plain() (or anything else) changing the particle multiplier rescales the counts
    let lastPt = GFX.particles;
    GFX.onChange(() => { if (GFX.particles !== lastPt) { lastPt = GFX.particles; scaleParticles(GFX.particles); } });
  }

  const api = { apply, current, table, measure, scenes: SCENES, order: ORDER, cinemaOnly: CINEMA_ONLY, art: ART, allButLow: ALL_BUT_LOW, isArt, fxWanted, refresh: () => { try { refreshBlock(); } catch (e) { /* menu closed */ } }, upscale, setScale, setViewDist, stepViewDist, snapViewDist, farLabel: FAR_LABEL, setParticles, setCurve, setUpscale, syncClasses, boot: BOOT, last: null, lastBest: null };
  rememberParticles();
  wire();
  apply(BOOT);
  syncClasses();
  return api;
})();
