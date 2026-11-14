// ============================================================
//  sun3 - Phase 3, "the sun's day". Phase 1 hung the coal sun in one place for ever. The owner (12 Nov): "I suppose it
//  should move but at the same time I do want there to be actual sunlight at times so its not always dark".
//  The world bible already says how (docs/worldbuilding/, searched before anything was invented):
//
//    "The sun, when it shows at all, is a pale coin behind the ash, a disc you can look at directly."   (the-smothering.md)
//    "... the sun throws a shadow at noon now, on some days, which it did not then."                    (the-smothering.md)
//    "The coal sun. On the worst days over Orlen the sun is a dark disc with a red edge."               (the design)
//
//  So the sun crosses the sky on the engine's own arc (east at dawn, south and high at noon, down behind the Slagcrown
//  at dusk), and it has three faces:
//    coal   the worst days, all day: the dark disc with the burning rim. The prologue's day is one.
//    coin   most days: a pale disc behind the pall, grey daylight, hardly a shadow.
//    clear  some days, about noon: the pall thins, the sun burns through, and things throw shadows.
//  Near the horizon every sun sinks into the ash and is the coal again, so every dusk and dawn is red.
//  Which day is which is fixed by the day's number (a hash, never a live random number): a place can be learned.
//
//  The face also sets the light, through the engine's own weather terms (cloud, dark): a coal noon is a gloom, a coin
//  noon is flat grey, a clear noon is sunlight. Nothing here changes the hour the engine keeps.
//
//  One Options switch, "The sun's day". Off: the sun hangs where Phase 1 put it, and the light is the engine's alone.
// ============================================================
'use strict';

const SUN3 = (() => {
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function hash(x, y, s) { let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2246822519)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }

  const START_TOD = 0.73;      // the prologue opens with the sun low over the Slagcrown, a little before it sets behind the keep
  // where the sun stands at an hour (0..1): the engine's own arc (js/light21.js), so its shadows fall away from this disc
  function at(tod) {
    const elev = Math.cos((tod - 0.5) * TAU);
    return { az: ((((tod - 0.25) * TAU) % TAU) + TAU) % TAU, el: Math.asin(clamp(elev, -1, 1)) * 0.74 };
  }
  // what kind of day it is. Day 0 is the prologue's: the worst kind. After it, of every twenty days about five are coal
  // days, eleven are coin days and four have a clear noon.
  function kind(day) {
    if ((day | 0) === 0) return 'coal';
    const h = hash(day | 0, 7, 303);
    return h < 0.25 ? 'coal' : h < 0.8 ? 'coin' : 'clear';
  }
  function face(day, tod) {
    const s = at(tod), k = kind(day);
    const low = 1 - smooth(0.10, 0.30, s.el);                                    // in the ash at the horizon: the coal again
    const coal = k === 'coal' ? 1 : low;
    const noon = smooth(0.40, 0.44, tod) * (1 - smooth(0.58, 0.62, tod));        // about ten in the morning to half past two
    const clear = k === 'clear' ? noon * (1 - coal) : 0;
    const up = smooth(-0.05, 0.12, s.el);
    // what the pall does to the light, scaled in as the sun climbs (so the red dusk Phase 1 lit is left alone)
    const high = smooth(0.15, 0.5, s.el);
    const cloud = high * (coal * 0.92 + (1 - coal) * (0.80 - 0.74 * clear));
    const dark = high * (coal * 0.58 + (1 - coal) * 0.16 * (1 - clear));
    return { kind: k, az: s.az, el: s.el, coal, clear, up, moving: 1, cloud, dark, shadows: (1 - cloud * 0.78) * (1 - dark * 0.7) };
  }

  const on = () => typeof GFX === 'undefined' || GFX.laDay !== false;
  const dayNow = () => (typeof G !== 'undefined' && G ? G.day | 0 : 0);
  function state(F) { return face(dayNow(), F && F.tod != null ? F.tod : 0.5); }
  // daylight fog: the red-brown the land burns into, turned toward dun as a paler sun climbs
  const DUN = [92, 84, 72], DUN_CLEAR = [128, 126, 118];
  const here = () => on() && typeof G !== 'undefined' && G && G.map && G.map._la && G.map.outdoor !== false && !G.map.ceil;
  function wire() {
    if (typeof LEDGE1 === 'undefined' || typeof R3D === 'undefined') return false;
    LEDGE1.SWITCHES.push(['laDay', 'The sun\'s day', 'The sun crosses the sky and changes its face: coal, pale coin, or a clear noon. Off: it hangs in the west (3D renderer only)']);
    if (on()) LEDGE1.START.tod = START_TOD;
    // the light: the engine's weather terms pass through here on their way in (the engine's own phases wrap this the same way)
    if (typeof Engine !== 'undefined' && Engine.setWeather) {
      const _sw = Engine.setWeather;
      Engine.setWeather = function (o) {
        if (o && here()) { const f = face(dayNow(), G.tod); o = Object.assign({}, o, { cloud: Math.max(+o.cloud || 0, f.cloud), dark: Math.max(+o.dark || 0, f.dark) }); }
        return _sw.call(this, o);
      };
    }
    // the fog: once a frame, before any pass draws
    R3D.on('frame', (F) => {
      const env = F && F.env; if (!env || !on() || !LEDGE1.laMap(F) || env.fogR == null) return;
      const f = state(F), k = (1 - f.coal) * f.up; if (k <= 0) return;
      const lum = Math.max(0.35, (env.fogR + env.fogG + env.fogB) / (46 + 20 + 16));      // keep the hour's brightness, change the colour
      for (const [key, i] of [['fogR', 0], ['fogG', 1], ['fogB', 2]]) { const t = (DUN[i] + (DUN_CLEAR[i] - DUN[i]) * f.clear) * lum * 0.5; env[key] += (t - env[key]) * k; }
    });
    return true;
  }
  const wired = wire();
  return { at, kind, face, state, on, here, hash, START_TOD, wired };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SUN3;
