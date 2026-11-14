// ---------------------------------------------------------------------------
//  DYNAMIC WEATHER
//  A clock-driven state machine per climate, with a modern look pass and
//  gameplay consequences. The old four-state timer in js/upgrades.js defers
//  to this the moment it loads (see the tickWeather adapter), and UPG.weather
//  / UPG.weatherFx stay in step so existing perception code needs no changes.
// ---------------------------------------------------------------------------
const Weather = (() => {
  // sight/hear multiply the existing perception ranges. haze thickens distance,
  // dark presses the light down, wind drives the rain slant and the sway, wet
  // counts towards exposure, bolt allows lightning.
  const STATES = {
    clear: { name: 'clear', sight: 1, hear: 1, haze: 0.00, dark: 0.00, wind: 0.15, wet: 0, bolt: 0, cloud: 0.06, say: 'The weather clears. Sound carries again.' },
    overcast: { name: 'overcast', sight: 0.95, hear: 1.05, haze: 0.05, dark: 0.12, wind: 0.32, wet: 0, bolt: 0, cloud: 0.6, say: 'Cloud comes up flat and grey over the Reach. Nothing moves in it.' },
    rain: { name: 'rain', sight: 0.85, hear: 0.62, haze: 0.12, dark: 0.2, wind: 0.45, wet: 1, bolt: 0, cloud: 0.72, say: 'Rain comes in over the Reach, soft on the oaks. Sound will not carry.' },
    storm: { name: 'storm', sight: 0.7, hear: 0.45, haze: 0.17, dark: 0.34, wind: 0.9, wet: 1, bolt: 1, cloud: 0.95, say: 'A storm walks up the river. The road will be slow, and loud, and lit in pieces.' },
    mist: { name: 'mist', sight: 0.5, hear: 0.9, haze: 0.32, dark: 0.06, wind: 0.08, wet: 0, bolt: 0, cloud: 0.3, say: 'A sea-fog walks up the river and sits down in the streets. They will not see you coming.' },
    snow: { name: 'snow', sight: 0.78, hear: 1.3, haze: 0.14, dark: 0.08, wind: 0.42, wet: 0, bolt: 0, cloud: 0.62, say: 'The first snow comes sideways off the water. It will crunch, and they will hear it.' },
  };
  // what each place gets, and how often. Weights are relative.
  const CLIMATES = {
    reach: { clear: 34, overcast: 20, rain: 22, storm: 8, mist: 8, snow: 8 },
    spectral: { clear: 14, overcast: 22, rain: 16, storm: 6, mist: 38, snow: 4 },
    moor: { clear: 18, overcast: 26, rain: 14, storm: 10, mist: 12, snow: 20 },
  };
  const CLIMATE_OF = {
    oakhaven: 'reach', clearing: 'reach', quarry: 'reach', chapel: 'reach', underhedge: 'reach',
    whispergrove: 'spectral', sunken: 'spectral', catacombs: 'spectral',
    deepwoods: 'moor', mausoleum: 'moor', belfry: 'moor',
  };
  const ORDER = ['clear', 'overcast', 'rain', 'storm', 'mist', 'snow'];
  // the four names the old upgrades timer used, still honoured when a hand sets one
  const ALIAS = { fog: 'mist', rain: 'rain', snow: 'snow', clear: 'clear' };

  let state = 'clear', left = 3, blend = 1, bolt = 0, boltCd = 8, wrote = 'clear', pinned = false, held = false;
  let wind = 0;   // set by apply(); declared so the HUD can read it before the first tick

  function climateOf(mapId) { return CLIMATES[CLIMATE_OF[mapId]] || CLIMATES.reach; }
  function fx(s) { return STATES[s] || STATES.clear; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  // Outdoors in a storm is not the place to stand and think; a pinned state is
  // what captures and tests use to hold one sky still.
  function set(next, hours) {
    const to = STATES[next] ? next : 'clear';
    const changed = to !== state;
    state = to; flush(hours);
    if (changed) { blend = 0; boltCd = rnd(4, 9); if (!pinned && G.map && G.map.outdoor) msg(STATES[to].say, to === 'storm' || to === 'snow' ? 'warn' : '', 5200); }
  }
  function flush(hours) {
    left = Number.isFinite(hours) ? Math.max(0.05, hours) : rnd(2, 6.5);
    wrote = state;
    if (typeof UPG === 'object' && UPG) { UPG.weather = state; UPG.weatherT = left * 3600; UPG.weatherFx = { sight: fx(state).sight, hear: fx(state).hear }; }
  }
  function pick(climate) {
    const total = ORDER.reduce((a, k) => a + (climate[k] || 0), 0);
    let r = Math.random() * total;
    for (const k of ORDER) { r -= climate[k] || 0; if (r <= 0) return k; }
    return 'clear';
  }
  function roll() { if (held) return; pinned = false; set(pick(climateOf(G.mapId)), rnd(2.5, 7)); }
  // Hold one sky still: what the tests and the gallery captures use when they need
  // the world's clock to matter without the weather changing under the assertion.
  function hold(next) { held = true; pinned = true; set(next || state, 12); blend = 1; return state; }
  // The world clock moves weather: resting, travelling and serving a sentence
  // all take hours off whatever is in the sky.
  function advance(hours) {
    if (!(hours > 0)) return;
    if (held) return;               // a held sky is not the clock's to change
    pinned = false;                 // the clock moving shakes any hand-pinned sky loose
    if (!G.map || !G.map.outdoor) return;
    left -= hours;
    for (let i = 0; left <= 0 && i < 12; i++) { const over = -left; roll(); left -= over; }
    if (left <= 0) left = 3;
  }
  function tick(dt) {
    if (!G.map) return;
    // A test or a capture may set UPG.weather by hand; adopt it as an override.
    if (typeof UPG === 'object' && UPG && UPG.weather !== wrote) {
      const want = ALIAS[UPG.weather] || UPG.weather;
      if (STATES[want]) { pinned = true; if (UPG.weather !== want) UPG.weather = want; if (want !== state) { set(want, 6); pinned = true; } blend = 1; return; }
    }
    if (pinned || held) { blend = 1; apply(); return; }
    const f = fx(state);
    if (G.map.outdoor) {
      // Real time trickles the clock too, so the sky turns over during play.
      left -= dt * 0.02;
      if (left <= 0) roll();
      blend = Math.min(1, blend + dt / 12);
      if (f.bolt && blend > 0.4) {
        boltCd -= dt;
        if (boltCd <= 0) { bolt = 1; boltCd = rnd(7, 17); setTimeout(() => { try { Audio_.sfx.thunder(); } catch (e) { } }, 500 + Math.random() * 1100); }
      }
    }
    if (bolt > 0) bolt = Math.max(0, bolt - dt / 0.42);
    apply();
  }
  function apply() {
    const f = fx(state), b = blend;
    const tint = state === 'mist' ? [196, 200, 214] : state === 'snow' ? [188, 200, 220] : state === 'storm' ? [40, 44, 60] : state === 'rain' ? [74, 82, 100] : state === 'overcast' ? [96, 98, 110] : [0, 0, 0];
    if (typeof Engine !== 'undefined' && Engine.setWeather) {
      Engine.setWeather({ haze: f.haze * b, dark: f.dark * b, cloud: f.cloud * (0.55 + 0.45 * b), tint, flash: bolt * (0.55 + 0.45 * Math.random()) });
    }
    wind = f.wind * (0.8 + 0.2 * b);
  }
  // ------------------------------------------------------------- gameplay
  function exposure() { return 1 + fx(state).wet * 0.15; }
  function travelFactor() { return state === 'storm' ? 1.12 : state === 'snow' ? 1.06 : state === 'rain' ? 1.03 : 1; }
  function riskFactor() { return state === 'storm' ? 1.35 : state === 'rain' ? 1.12 : state === 'snow' ? 1.08 : state === 'mist' ? 1.1 : 1; }
  function mask() { return state === 'storm' ? 0.7 : state === 'rain' ? 0.85 : 1; }   // footfalls in the wet
  function label() { return state + (blend < 1 ? ' coming in' : ''); }
  function save() { return { s: state, left: Math.round(left * 100) / 100 }; }
  function load(d) {
    pinned = false; held = false;
    if (!d || typeof d !== 'object' || !STATES[d.s]) { state = 'clear'; left = 3; blend = 1; wrote = 'clear'; if (typeof UPG === 'object' && UPG) { UPG.weather = 'clear'; UPG.weatherFx = { sight: 1, hear: 1 }; } return; }
    state = d.s; left = Math.min(24, Math.max(0.05, Number(d.left) || 3)); blend = 1; wrote = state;
    if (typeof UPG === 'object' && UPG) { UPG.weather = state; UPG.weatherT = left * 3600; UPG.weatherFx = { sight: fx(state).sight, hear: fx(state).hear }; }
  }
  // ------------------------------------------------------------- the look
  function drawOverlay() {
    if (!G.map || !G.map.outdoor) return;
    const ctx = Engine.ctx; if (!ctx) return;
    const w = Engine.VW || 320, h = Engine.VIEW_H || 150, now = performance.now() / 1000, b = blend, f = fx(state);
    const horizon = (h >> 1) + (Engine.cam.pitch | 0) + (Engine.cam.bob | 0);
    if (state === 'clear' || b <= 0.02) return;
    // haze: a flat wash that thickens toward the horizon, the way air does
    if (f.haze > 0) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      const a = f.haze * b;
      const col = state === 'storm' ? '48,52,66' : state === 'mist' ? '200,204,216' : state === 'snow' ? '190,200,220' : '120,128,150';
      g.addColorStop(0, `rgba(${col},${(a * 0.25).toFixed(3)})`);
      g.addColorStop(0.55, `rgba(${col},${(a * 0.7).toFixed(3)})`);
      g.addColorStop(1, `rgba(${col},${(a * 0.5).toFixed(3)})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    if (state === 'mist') {
      // low bands that drift at walking height
      for (let i = 0; i < 5; i++) {
        const y = horizon - 14 + i * 7 + Math.sin(now * 0.2 + i) * 2;
        ctx.fillStyle = `rgba(206,210,222,${(0.05 + 0.03 * i) * b})`;
        ctx.fillRect(0, y, w, 6);
      }
    }
    if (state === 'rain' || state === 'storm') {
      const heavy = state === 'storm' ? 1 : 0.55;
      ctx.strokeStyle = `rgba(178,190,212,${(0.26 * heavy + 0.08).toFixed(3) * b})`;
      ctx.lineWidth = 1; ctx.beginPath();
      const n = state === 'storm' ? 110 : 60;
      for (let i = 0; i < n; i++) {
        const x = ((i * 53.7 + now * (240 + 160 * heavy) + i * wind * 40) % (w + 40)) - 20;
        const y = ((i * 97.3 + now * (500 + 260 * heavy)) % (h + 40)) - 20;
        ctx.moveTo(x, y); ctx.lineTo(x - 3 - wind * 4, y + 9 + heavy * 3);
      }
      ctx.stroke();
      // splashes on the ground plane under the horizon
      ctx.fillStyle = `rgba(190,200,220,${(0.20 * b).toFixed(3)})`;
      for (let i = 0; i < 26; i++) {
        const x = (i * 47.3 + now * 90) % w;
        const y = horizon + 6 + ((i * 29.7 + now * 120) % Math.max(4, h - horizon - 8));
        const r = 1 + (i % 3);
        ctx.fillRect(x | 0, y | 0, r, 1);
      }
    }
    if (state === 'snow') {
      ctx.fillStyle = `rgba(228,232,242,${(0.72 * b).toFixed(3)})`;
      for (let i = 0; i < 70; i++) {
        const x = ((i * 61.9 + Math.sin(now * 0.8 + i) * 12 + now * (14 + wind * 30)) % (w + 16)) - 8;
        const y = ((i * 88.1 + now * (26 + (i % 5) * 7)) % (h + 16)) - 8;
        ctx.fillRect(x | 0, y | 0, i % 3 ? 1 : 2, i % 3 ? 1 : 2);
      }
    }
    if (state === 'overcast') ctx.fillStyle = `rgba(70,74,88,${(0.10 * b).toFixed(3)})`, ctx.fillRect(0, 0, w, h);
    if (state === 'storm') ctx.fillStyle = `rgba(24,26,36,${(0.16 * b).toFixed(3)})`, ctx.fillRect(0, 0, w, h);
    // lightning: one bright frame, then the world keeps its breath
    if (bolt > 0.01) { ctx.fillStyle = `rgba(226,232,255,${(0.34 * bolt).toFixed(3)})`; ctx.fillRect(0, 0, w, h); }
  }
  return { STATES, CLIMATES, tick, advance, set, roll, apply, drawOverlay, exposure, travelFactor, riskFactor, mask, label, save, load, climateOf, hold, get state() { return state; }, get left() { return left; }, get blend() { return blend; }, get wind() { return wind; }, get pinned() { return pinned; }, get held() { return held; }, release() { pinned = false; held = false; blend = 1; } };
})();
window.Weather = Weather;
function weatherLine() { return Weather.label() + (Weather.wind > 0.6 ? ' · gale' : Weather.wind > 0.35 ? ' · wind' : ''); }
