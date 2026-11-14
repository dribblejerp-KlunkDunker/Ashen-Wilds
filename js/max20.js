// ============================================================
//  max20 — Phase 20 MAX: new players start at the highest graphics preset their device can run.
//
//  The owner, 2026-10-20: "The graphics aren't high enough to leave anything off. Let's max out everything we can."
//  The art half of that lives in js/presets.js (ART: every art switch is on in every preset). This file is the
//  other half, the first-launch choice and its safety net. Loads LAST, after every module has registered its
//  GFX flags and restored its own stored switches.
//
//  1. THE PICK (only when no preset choice is stored yet, by the player or by an earlier auto pick):
//       phone or tablet (primary pointer coarse, a small screen, or a mobile user agent)  -> Medium
//       hardware WebGL2 (GPU18's probe: a context without a major performance caveat, not a
//         software rasteriser) and >= 4 logical cores and (device memory unknown or >= 4 GB) -> Cinematic
//       otherwise >= 4 cores and (memory unknown or >= 4 GB), a desktop without hardware WebGL2 -> High
//       anything else                                                                      -> Medium
//     View distance is the chosen preset's own (Cinematic and Ultra: 2.5, "Far").
//  2. THE SAFETY NET (only for an auto choice above Medium, never for a preset the player chose): during the first
//     ~20 s of play the frame interval is measured (requestAnimationFrame, play state only, the tab visible, pauses
//     over 1 s and the first second after a preset change or map load skipped). Every 4 s of play, if the median
//     frame is over 33.3 ms (below 30 fps), the preset steps down one (Cinematic -> Ultra -> High -> Medium) with a
//     one-line notice (Phase 21: if the true 3D renderer R3D is on by auto choice, the first step turns it off instead and
//     keeps the preset; js/r3d21.js). Once 20 s of play pass at a preset whose last window was smooth (or Medium is reached) the
//     choice is SETTLED and stored, so it is not measured again on later launches.
//  3. THE PLAYER'S CHOICE: any button in Options -> Graphics & access that changes a graphics setting (a preset,
//     resolution, view distance, particles, or any effect switch) records the result as the player's own choice
//     (PRESETS.current(), or 'custom' over the last preset pressed). From then on nothing here changes the preset;
//     the stored choice is applied at boot (the modules that keep their own switches still lay them over it).
//
//     A returning player with no entry here but settings stored by an earlier phase (Cinematic in 'octave.cinema14.v1',
//     or a view distance of their own in 'echoes-far14') is treated the same way: their restored settings are their choice.
//  Storage: localStorage 'octave.max20.v1' = { v: 1, user: <preset>|'custom'|null, base: <preset>|null,
//  auto: <preset>|null, settled: bool }. Guarded: no storage = the pick is made fresh each launch.
//  Automation (navigator.webdriver) leaves the game exactly as before, booting on Medium, unless the page opts in
//  with window.__max20 = { automation: true, fake: { hwgl2, cores, mobile, memory } } (test/max20.test.js), so the
//  rest of the test suite keeps its fixed starting preset. Nothing here touches saves, RNG, gameplay or story.
// ============================================================
'use strict';

const MAX20 = (() => {
  const KEY = 'octave.max20.v1';
  const STEPS = ['cinematic', 'ultra', 'high', 'medium'];   // the safety net's ladder, highest first
  const LABEL = { original: 'Original', low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra', cinematic: 'Cinematic', custom: 'Custom' };
  const SLOW_MS = 1000 / 30;     // a median frame above this is below 30 fps
  const WINDOW_S = 4;            // seconds of play per verdict
  const BUDGET_S = 20;           // seconds of smooth play before the choice is settled
  const SKIP_S = 1;              // seconds skipped after a preset change or map load
  const HITCH_MS = 1000;         // a longer gap is a pause (loading, a tab switch), not a frame; a 4 fps device still counts
  const opts = (typeof window !== 'undefined' && window.__max20 && typeof window.__max20 === 'object') ? window.__max20 : {};
  const automation = (() => { try { return !!(typeof navigator !== 'undefined' && navigator.webdriver); } catch (e) { return false; } })();
  const live = !automation || opts.automation === true;

  const S = { v: 1, user: null, base: null, auto: null, settled: false };
  const stats = { reason: '', profile: null, steps: [], windows: [], playS: 0, presetS: 0, skipS: 0, samples: [], notices: [] };
  let forceFrameMs = null;       // tests: substitute this for the measured frame interval

  // ---------------------------------------------------------------------------------------------------- storage
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!o || typeof o !== 'object') return false;
      const ok = (n) => typeof n === 'string' && (n === 'custom' || (typeof PRESETS !== 'undefined' && PRESETS.table[n]));
      S.user = ok(o.user) ? o.user : null;
      S.base = ok(o.base) && o.base !== 'custom' ? o.base : null;
      S.auto = ok(o.auto) && o.auto !== 'custom' ? o.auto : null;
      S.settled = o.settled === true;
      return true;
    } catch (e) { return false; }
  }
  function save() { if (!live) return; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* no storage: fine */ } }

  // ---------------------------------------------------------------------------------------------------- the device
  const SOFT = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i;   // js/gpu18.js's list
  // hardware WebGL2: GPU18's own probe when it ran (it does unless the player switched the compositor off),
  // otherwise one throwaway context with the same rules, released at once
  function hardwareWebGL2() {
    try {
      if (typeof GPU18 !== 'undefined' && GPU18.st && GPU18.st.available !== null) return !!(GPU18.available() && !GPU18.software());
    } catch (e) { /* fall through */ }
    try {
      if (typeof document === 'undefined' || typeof WebGL2RenderingContext === 'undefined') return false;
      const c = document.createElement('canvas');
      const g = c.getContext('webgl2', { failIfMajorPerformanceCaveat: true, powerPreference: 'high-performance' });
      if (!g) return false;
      let soft = false;
      try { const ext = g.getExtension('WEBGL_debug_renderer_info'); soft = SOFT.test(String(ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER) || '')); } catch (e) { /* hidden name */ }
      try { const lose = g.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); } catch (e) { /* fine */ }
      return !soft;
    } catch (e) { return false; }
  }
  function mobile() {
    try {
      const mm = (q) => typeof matchMedia === 'function' && matchMedia(q).matches;
      if (mm('(pointer: coarse)')) return true;
      const sw = typeof screen !== 'undefined' ? Math.min(screen.width || 0, screen.height || 0) : 0;
      if (sw > 0 && sw < 600) return true;
      const nav = typeof navigator !== 'undefined' ? navigator : {};
      if (nav.userAgentData && nav.userAgentData.mobile === true) return true;
      const ua = String(nav.userAgent || '');
      if (/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Opera Mini|IEMobile/i.test(ua)) return true;
      if (/Macintosh/.test(ua) && (nav.maxTouchPoints || 0) > 1) return true;   // iPadOS asks for the desktop site
    } catch (e) { /* treat as desktop */ }
    return false;
  }
  function profile() {
    const f = opts.fake && typeof opts.fake === 'object' ? opts.fake : {};
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    return {
      hwgl2: typeof f.hwgl2 === 'boolean' ? f.hwgl2 : hardwareWebGL2(),
      cores: typeof f.cores === 'number' ? f.cores : (+nav.hardwareConcurrency || 0),
      mobile: typeof f.mobile === 'boolean' ? f.mobile : mobile(),
      memory: typeof f.memory === 'number' ? f.memory : (typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null),
    };
  }
  // the rule, as a pure function (tests call it with made-up devices)
  function pick(p) {
    if (!p || p.mobile) return 'medium';
    const roomy = p.memory == null || p.memory >= 4;
    if (p.hwgl2 && p.cores >= 4 && roomy) return 'cinematic';
    if (p.cores >= 4 && roomy) return 'high';
    return 'medium';
  }

  // ---------------------------------------------------------------------------------------------------- applying
  const SCALARS = ['scale', 'viewDist', 'particles'];
  // the switches that differ from what preset `from` sets (at boot: the ones a module restored from the player's own
  // stored settings on top of the boot preset), laid back over any preset applied here
  function overrides(from) {
    const out = {};
    if (typeof PRESETS === 'undefined' || !PRESETS.fxWanted) return out;
    if (!PRESETS.table[from]) from = PRESETS.table[GFX.preset] ? GFX.preset : PRESETS.boot;
    const kind = PRESETS.table[from].fx;
    for (const k of GFX.FX) if (k !== 'crtCurve' && typeof GFX[k] === 'boolean' && GFX[k] !== PRESETS.fxWanted(kind, k)) out[k] = GFX[k];
    return out;
  }
  let applying = false;
  function applyPreset(name, keep) {
    if (typeof PRESETS === 'undefined' || !PRESETS.table[name]) return false;
    applying = true;
    try {
      const vd = GFX.viewDist;
      PRESETS.apply(name);
      if (keep) {
        let any = false;
        for (const k in keep.flags) if (GFX[k] !== keep.flags[k]) { GFX[k] = keep.flags[k]; any = true; }
        if (keep.viewDist && GFX.viewDist !== vd) { PRESETS.setViewDist(vd); any = false; }
        if (any) { GFX.preset = PRESETS.current(); GFX.changed(); }
      }
      if (PRESETS.refresh) PRESETS.refresh();
    } finally { applying = false; }
    stats.presetS = 0; stats.skipS = SKIP_S; stats.samples.length = 0;
    return true;
  }
  const already = (name) => { try { return PRESETS.current() === name || (name === 'cinematic' && GFX.preset === 'cinematic'); } catch (e) { return false; } };

  function legacyChoice() {
    try {
      const c = JSON.parse(localStorage.getItem('octave.cinema14.v1') || 'null');
      if (c && c.p === 1) return true;
      const f = JSON.parse(localStorage.getItem('echoes-far14') || 'null');
      if (f && typeof f.viewDist === 'number' && Math.abs(f.viewDist - PRESETS.table[PRESETS.boot].viewDist) > 1e-6) return true;
    } catch (e) { /* no storage */ }
    return false;
  }
  function boot() {
    if (!live || typeof PRESETS === 'undefined' || typeof GFX === 'undefined') { stats.reason = live ? 'no presets' : 'automation'; return; }
    load();
    if (S.user) {
      const name = S.user === 'custom' ? (S.base || S.auto || PRESETS.boot) : S.user;
      stats.reason = 'player choice ' + S.user;
      if (!already(name)) applyPreset(name, { flags: overrides(), viewDist: S.user === 'custom' });
      return;
    }
    if (S.auto) {
      stats.reason = 'stored auto ' + S.auto + (S.settled ? ' (settled)' : '');
      if (!already(S.auto)) applyPreset(S.auto, { flags: overrides(), viewDist: false });
      return;
    }
    // a returning player from before this phase who already chose something (Cinematic, kept by js/cinema14.js, or a
    // view distance of their own, kept by js/far14.js) has made a choice: keep what their settings restored
    if (legacyChoice()) {
      const cur = PRESETS.current();
      S.user = cur; S.base = cur === 'custom' ? (GFX.preset === 'cinematic' ? 'cinematic' : PRESETS.boot) : cur;
      stats.reason = 'earlier player settings: ' + cur;
      save();
      return;
    }
    stats.profile = profile();
    S.auto = pick(stats.profile); S.settled = S.auto === 'medium';
    stats.reason = 'first launch: ' + S.auto;
    if (!already(S.auto)) applyPreset(S.auto, { flags: overrides(), viewDist: false });
    save();
  }

  // ---------------------------------------------------------------------------------------------------- the safety net
  function notice(text) {
    stats.notices.push(text);
    try { if (typeof msg === 'function') { msg(text, 'warn', 6500); return; } } catch (e) { /* fall through */ }
    try { console.info(text); } catch (e) { /* fine */ }
  }
  const median = (a) => { const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const measuring = () => live && !S.user && !S.settled && !!S.auto && STEPS.indexOf(S.auto) >= 0 && S.auto !== 'medium';
  function settle(why) { S.settled = true; stats.reason += '; settled ' + S.auto + ' (' + why + ')'; save(); }
  function stepDown(med) {
    // Phase 21: an automatic true-3D renderer (js/r3d21.js) goes back to the classic raycaster before the preset drops
    try {
      if (typeof R3D !== 'undefined' && R3D && typeof R3D.netStep === 'function' && R3D.netStep()) {
        stats.steps.push({ from: S.auto, to: S.auto, renderer: 'classic', medianMs: Math.round(med * 10) / 10 });
        stats.presetS = 0; stats.skipS = SKIP_S; stats.samples.length = 0;
        notice('Graphics eased to the classic renderer to keep the game smooth — Options to change');
        return;
      }
    } catch (e) { /* no R3D */ }
    const i = STEPS.indexOf(S.auto), from = S.auto;
    const next = STEPS[Math.min(STEPS.length - 1, i + 1)];
    stats.steps.push({ from, to: next, medianMs: Math.round(med * 10) / 10 });
    const keep = overrides(from);
    S.auto = next;
    applyPreset(next, { flags: keep, viewDist: false });
    notice('Graphics eased to ' + LABEL[next] + ' to keep the game smooth — Options to change');
    if (next === 'medium') settle('reached Medium'); else save();
  }
  // one frame interval (ms) of play; returns whether the net is still measuring
  function feed(ms) {
    if (!measuring()) return false;
    if (!(ms > 0) || ms > HITCH_MS) return true;     // a hitch (loading, a tab switch): not a frame
    const s = ms / 1000;
    if (stats.skipS > 0) { stats.skipS -= s; return true; }
    stats.samples.push(ms); stats.playS += s; stats.presetS += s;
    let windowS = 0; for (const x of stats.samples) windowS += x / 1000;
    if (windowS < WINDOW_S) return true;
    const med = median(stats.samples);
    stats.windows.push({ preset: S.auto, medianMs: Math.round(med * 10) / 10, n: stats.samples.length });
    stats.samples.length = 0;
    if (med > SLOW_MS) stepDown(med);
    else if (stats.playS >= BUDGET_S) settle('smooth');
    return measuring();
  }
  let lastT = 0, lastMap = null, rafOn = false;
  function playing() {
    if (typeof G === 'undefined' || G.state !== 'play' || !G.map) return false;
    try { if (typeof document !== 'undefined' && document.hidden) return false; } catch (e) { /* fine */ }
    return true;
  }
  function tick(t) {
    if (!measuring()) { rafOn = false; return; }
    requestAnimationFrame(tick);
    const dt = lastT ? t - lastT : 0; lastT = t;
    if (!playing()) return;
    if (G.mapId !== lastMap) { lastMap = G.mapId; stats.skipS = Math.max(stats.skipS, SKIP_S); }
    if ((G.fadeT || 0) > 0) return;
    feed(forceFrameMs != null ? forceFrameMs : dt);
  }
  function startNet() { if (rafOn || !measuring() || typeof requestAnimationFrame !== 'function') return; rafOn = true; lastT = 0; requestAnimationFrame(tick); }

  // ---------------------------------------------------------------------------------------------------- the player's choice
  // a click on any Graphics & access button that changes a graphics setting is the player choosing
  function snapshot() {
    const o = {}; if (typeof GFX === 'undefined') return o;
    for (const k of SCALARS) o[k] = GFX[k];
    for (const k of GFX.FX) o[k] = GFX[k];
    return o;
  }
  function changedSince(a) { const b = snapshot(); for (const k in b) if (a[k] !== b[k]) return true; return false; }
  function recordChoice(pressed) {
    if (!live) return;
    const cur = PRESETS.current();
    if (pressed && PRESETS.table[pressed]) S.base = pressed;
    else if (!S.base) S.base = S.auto || PRESETS.boot;
    S.user = cur;
    if (cur !== 'custom') S.base = cur;
    stats.reason = 'player chose ' + cur;
    save();
  }
  function wireChoice() {
    if (typeof document === 'undefined' || !document.addEventListener) return;
    let before = null, btnId = '';
    const inGrid = (t) => (t && t.closest && t.closest('#modal-panel .ctl-grid') && t.closest('button')) || null;
    // capture: before the button's own handler (which may rebuild the menu); bubble: after it
    document.addEventListener('click', (ev) => { const b = inGrid(ev.target); before = b ? snapshot() : null; btnId = b ? b.id || '' : ''; }, true);
    document.addEventListener('click', () => {
      if (!before || applying) { before = null; return; }
      const snap = before, id = btnId; before = null;
      if (!changedSince(snap)) return;
      const m = /^gfx-p-(\w+)$/.exec(id);
      recordChoice(m ? m[1] : null);
    }, false);
  }

  try { boot(); } catch (e) { console.warn('max20 boot failed', e); }
  try { wireChoice(); } catch (e) { console.warn('max20 options wiring failed', e); }
  try { startNet(); } catch (e) { console.warn('max20 safety net failed', e); }

  return {
    KEY, STEPS, SLOW_MS, WINDOW_S, BUDGET_S, state: S, stats, live, automation,
    pick, profile, feed, recordChoice, measuring, startNet,
    get forceFrameMs() { return forceFrameMs; }, set forceFrameMs(v) { forceFrameMs = v == null ? null : +v; startNet(); },
  };
})();
if (typeof window !== 'undefined') window.MAX20 = MAX20;
