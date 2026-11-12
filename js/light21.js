// ============================================================
//  light21 — Phase 21 "Wow", team LIGHT: the look of the true 3D renderer (R3D, js/r3d21.js).
//
//  Written against the R3D CONTRACT at the top of js/r3d21.js. Nothing here runs unless R3D draws the frame: the CPU
//  raycaster (the fallback, Original, no WebGL2) is untouched, and so is every saved, gameplay or story value.
//  Art direction (the brief, the research doc's "HD-2D in first person"): keep the pixel art (textures nearest, the sky
//  and its painted country drawn at the game's own logical pixel), but light it like a modern game: warm lamp pools,
//  long soft sun shadows at dusk, light shafts, depth fog that is the colour of the sky behind it, bloom only on what
//  glows, layered clouds, a sun, a moon with its phase, stars, and the Octave lights. No heavy blur, no heavy particles.
//
//  WHAT IT REPLACES (R3D.setChunk / R3D.addPass, so CORE's pieces stay the fallback if a shader fails to compile):
//    chunk 'shade' (every lit surface: world kind 0, sprites kind 1, the body kind 2):
//       - outdoors: a hemisphere ambient (sky above, ground bounce below) by the hour and the weather, the sun by day and
//         the moon by night as a directional light with N.L, and SHADOWS: the sun ray is marched through the map's cell
//         heights (a heightfield of wall tops and ground, uploaded per map; exact for the grid world, no shadow-map
//         resolution), with a penumbra that widens with distance and with a low sun (long soft shadows at dusk).
//         Lighting positions are snapped to the texel grid, so light and shadow edges stay pixel art.
//       - the game's point lights (lamps, torches, braziers, fires, Light-glass, the player's lantern) per pixel, with
//         their wall masks (CORE's per-cell bits), a lamp height and N.L, so lamps make pools on the ground and light
//         the faces turned to them.
//       - indoors: the raycaster's own distance-to-dark base light (readability is kept), with the lamps on top.
//       - depth fog to the colour of the sky toward that direction (the horizon, warm toward a low sun); a height fog
//         that hugs the ground for mist and the Cinematic ground fog; distances follow the game's view distance exactly.
//       - water: a reflection of the sky (and the sun's glitter) through rippled normals, with Fresnel.
//       - emissive pixels (glow masks, Light-glass, lit windows) go above 1.0, which is what the bloom keys on.
//    pass 'sky' (order 0): the sky dome, rendered at the game's logical resolution (320 x 150, or twice that on High and
//       above) and laid in nearest, so it is pixel art like the panoramas: a gradient by hour, a sun glow, two layers of
//       drifting cloud from the weather (pixel-quantised with an ordered dither), stars, the moon with the calendar's
//       phase, the sun's disc, the Octave lights on the nights js/skies14.js picks, lightning in the clouds, and the
//       Phase 20 pixel-art panoramas (js/sky.js, with the LANDMARKS ridges baked in) as distant layers mixed into the air;
//       with panoramas off, CORE's 'landmarks' ridges.
//    pass 'post' (order 90): bloom on emissives and HDR highlights only (aux target g / material 8, plus what is above
//       1.0), light shafts from the sun through the sky mask, a soft shoulder tone curve (mid-tones stay as the CPU drew
//       them), the per-area, per-hour colour grade of js/post.js (the same table), Cinematic's grade (js/cinema14.js
//       numbers), a subtle vignette, the Deep's underwater tint, ordered dither against banding.
//
//  Also: 'l21-shadows' (order 5) renders js/sprites21.js's casters (SPRITES21.drawCasters) into a sun/moon-view depth map
//  so figures, beasts and props cast shadows on the ground and walls; lamp halos (the raycaster's glow round each lamp, now
//  hidden by walls in front); rain and snow in the scene (behind walls, turning with the view), replacing the flat 2D
//  weather overlay under R3D; water mirroring what stands above it (screen space, as js/water.js does).
//
//  CPU post hooks (FI.fb passes) under R3D, from R3D.cpuHooks()'s LIGHT rows: PORTED here — engine sky/clouds/sun/moon,
//  calendar11 moon phase, sky.js stars, panoramas (LANDMARKS ridges baked in) and the Kestrel flyover, skies14 aurora,
//  synod15 eclipse disc, post.js soft fog and mist (height fog), water.js reflections, air11 sun shafts, post.js bloom,
//  post.js grade, cinema14 haze/ground fog/bloom/rays/grade/vignette, deep16 underwater (a tint), extras17 winter
//  (snow cover, grade, snowfall), hunters13 grey wave, dread.js shadow figure, lighting.js dark interiors (the indoor
//  distance-to-dark and lamp pools are the shade chunk's), motion10 lantern glow (the lantern is a point light: pool and
//  halo). NOT PORTED (CPU only, flagged): horizon20 far country and belfry art, props14 glass shimmer and mirrors,
//  greening14 stages/veins/glass spread, skies14 caustics, flume16 glow, air11 heat haze and glass glare, dread.js
//  hound silhouette (a world sprite: SPRITES). See LIGHT21.ported.
//
//  Switches (existing GFX flags, so the Options rows and presets keep meaning): bloom or cineLight -> bloom;
//  sunShafts or cineLight -> shafts; grade -> the area grade; cineGrade -> Cinematic grade and vignette; mist, softFog,
//  cineFog -> height fog; reflections -> water reflection; stars, panoramas, aurora, moonPhase as named. New:
//  GFX.p21_shadows (sun/moon shadows) and GFX.p21_clouds (cloud layers), on in every preset but Original.
//  Loaded after js/r3d21.js (its own script tag). No assets: everything is drawn here or comes from the game.
// ============================================================
'use strict';

for (const k of ['p21_shadows', 'p21_clouds']) {
  if (typeof GFX !== 'undefined') { if (GFX[k] === undefined) GFX[k] = true; if (GFX.FX && !GFX.FX.includes(k)) GFX.FX.push(k); }
}

const LIGHT21 = (() => {
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const warned = {};
  const warnOnce = (k, e) => { if (!warned[k]) { warned[k] = true; console.warn('light21 ' + k, e); } };
  const flag = (k) => typeof GFX !== 'undefined' && GFX[k] === true;
  const stats = { frames: 0, ms: 0, sky: 0, post: 0, shadows: false, clouds: 0, panoLayers: 0, bloom: false, shafts: false, grade: false, installed: false, failed: '' };
  const ported = {
    ported: ['engine sky, clouds, sun and moon', 'calendar11 moon phase', 'sky.js stars', 'sky.js panoramas (+ LANDMARKS ridges)', 'sky.js Kestrel flyover', 'skies14 aurora', 'synod15 eclipse disc', 'post.js soft fog + mist (height fog)', 'water.js reflections', 'air11 sun shafts', 'post.js bloom', 'post.js grade', 'cinema14 haze, ground fog, bloom, rays, grade, vignette', 'deep16 underwater (tint)', 'extras17 winter (snow cover, grade, snowfall)', 'hunters13 grey wave', 'dread.js shadow figure', 'lighting.js dark interiors', 'motion10 lantern glow'],
    cpuOnly: ['horizon20 far country beyond the walls', 'horizon20 belfry art', 'props14 glass shimmer and mirrors', 'greening14 stages, root veins, glass spread', 'skies14 caustics', 'flume16 glow', 'air11 heat haze and glass glare', 'dread.js hound silhouette (a world sprite: SPRITES)'],
  };
  // ------------------------------------------------------------------------------------------------ photo mode grades
  // For js/photo21.js (team CARD): [{ id, label, css }], CSS filter strings photo mode lays over the picture. The first is
  // the grade of the place and hour you stand in (js/post.js's table, read as a filter: its saturation, its contrast,
  // its overall gain, and a warm or cold cast from the gain's red-blue balance); then the named area grades; then looks
  // made for screenshots. All are plain CSS filters (no shader needed).
  function gradeCss(p, night) {
    const g = night ? p.night : p.day, gain = (g.gain[0] + g.gain[1] + g.gain[2]) / 3, warm = g.gain[0] - g.gain[2];
    const parts = ['saturate(' + g.sat.toFixed(2) + ')', 'contrast(' + (1 + g.con * 0.9).toFixed(2) + ')', 'brightness(' + gain.toFixed(2) + ')'];
    if (warm > 0.04) parts.push('sepia(' + Math.min(0.45, warm * 1.6).toFixed(2) + ')');
    else if (warm < -0.04) parts.push('hue-rotate(' + Math.round(Math.min(18, -warm * 70)) + 'deg)');
    return parts.join(' ');
  }
  const AREA_LABEL = { town: 'Town', meadow: 'Meadow', grove: 'Grove', woods: 'Woods', amber: 'Oakhaven amber', amberIn: 'Candlelit', teal: 'Whisper-Grove teal', violet: 'Deep Woods violet', crypt: 'Crypt', candle: 'Candle' };
  function photoGrades() {
    const out = [];
    try {
      if (typeof POST !== 'undefined' && POST.config) {
        const C = POST.config, m = typeof G !== 'undefined' && G ? G.map : null, outdoor = !!(m && m.outdoor);
        const name = (m && C.grade[m.id]) || (outdoor ? C.grade._outdoor : C.grade._indoor);
        const tod = typeof G !== 'undefined' && G ? G.tod : 0.5, night = outdoor && Math.cos((tod - 0.5) * TAU) < 0.1;
        if (C.gradePresets[name]) out.push({ id: 'l21-here', label: 'This place, this hour', css: gradeCss(C.gradePresets[name], night) });
        for (const k of Object.keys(C.gradePresets)) out.push({ id: 'l21-' + k, label: AREA_LABEL[k] || k, css: gradeCss(C.gradePresets[k], false) });
      }
    } catch (e) { warnOnce('photo grades', e); }
    const CG = typeof CINEMA14 !== 'undefined' && CINEMA14.T && CINEMA14.T.grade ? CINEMA14.T.grade : { sat: 1.12, con: 1.08 };
    out.push(
      { id: 'l21-cinematic', label: 'Cinematic', css: 'saturate(' + CG.sat + ') contrast(' + CG.con + ')' },
      { id: 'l21-dusk', label: 'Warm dusk', css: 'sepia(0.3) saturate(1.3) hue-rotate(-8deg) contrast(1.06) brightness(1.03)' },
      { id: 'l21-night', label: 'Cold night', css: 'saturate(0.75) hue-rotate(14deg) contrast(1.1) brightness(0.9)' },
      { id: 'l21-sepia', label: 'Sepia', css: 'sepia(0.85) contrast(1.06) brightness(1.02)' },
      { id: 'l21-bw', label: 'Black and white', css: 'grayscale(1) contrast(1.45) brightness(1.04)' },
      { id: 'l21-faded', label: 'Faded print', css: 'saturate(0.7) contrast(0.88) brightness(1.08) sepia(0.15)' },
    );
    return out;
  }

  if (typeof R3D === 'undefined' || !R3D.setChunk || !R3D.addPass) return { stats, ported, available: false, photoGrades };

  const ZK = R3D.ZK, FX = R3D.FX;

  // ------------------------------------------------------------------------------------------------ the hour's light
  // Colour keys by time of day (0 midnight, 0.25 dawn, 0.5 noon, 0.75 dusk): the Reach's pale, fading Light by day,
  // ember dusks, deep indigo nights. Linear interpolation between keys, wrapping.
  const KEYS = [
    // tod   zenith            horizon           glow (sun halo)    ambient sky        sun colour
    [0.00, [6, 8, 22], [22, 26, 46], [40, 50, 90], [50, 56, 92], [0, 0, 0]],
    [0.20, [10, 12, 32], [44, 40, 66], [120, 90, 110], [54, 56, 94], [0, 0, 0]],
    [0.25, [44, 56, 104], [214, 136, 104], [255, 170, 120], [86, 76, 96], [255, 150, 90]],
    [0.31, [84, 120, 172], [196, 188, 180], [255, 220, 170], [118, 120, 128], [255, 222, 170]],
    [0.50, [86, 126, 184], [194, 202, 210], [255, 244, 214], [128, 132, 140], [255, 246, 226]],
    [0.66, [84, 116, 170], [206, 192, 164], [255, 226, 170], [124, 122, 124], [255, 228, 180]],
    [0.72, [58, 66, 124], [214, 140, 96], [255, 168, 96], [118, 100, 112], [255, 166, 100]],
    [0.76, [34, 32, 76], [160, 86, 80], [230, 110, 70], [86, 70, 92], [240, 116, 70]],
    [0.80, [16, 16, 44], [64, 44, 70], [110, 70, 100], [60, 58, 92], [0, 0, 0]],
    [0.88, [7, 9, 26], [26, 28, 50], [44, 52, 92], [50, 56, 92], [0, 0, 0]],
    [1.00, [6, 8, 22], [22, 26, 46], [40, 50, 90], [50, 56, 92], [0, 0, 0]],
  ];
  function keyAt(tod, slot) {
    tod = ((tod % 1) + 1) % 1;
    let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] <= tod) i++;
    const a = KEYS[i], b = KEYS[i + 1], t = (tod - a[0]) / Math.max(1e-6, b[0] - a[0]);
    return [mix(a[slot][0], b[slot][0], t) / 255, mix(a[slot][1], b[slot][1], t) / 255, mix(a[slot][2], b[slot][2], t) / 255];
  }

  // per-frame parameters, worked out on the CPU once (the shaders only read them)
  const P = {
    sun: [0, 0, 1], sunC: [0, 0, 0], soft: 0.06, sunD: [0, 0, 1], sunVis: 0, moonD: [0, 0, 1], moonIll: 1, moonVis: 0,
    zen: [0, 0, 0], hor: [0, 0, 0], glow: [0, 0, 0], ambS: [0, 0, 0], ambG: [0, 0, 0],
    fog: [1, 0, 0.4, 2], pt: [1.25, 0.6, 0, 1], t: [0, 0, 0, 1], shadowOn: false, maxH: 1, night: 0,
    cl: [0.2, 0, 0, 0], sky2: [0, 0, 0, 1], aur: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], panoAir: [0, 0, 0, 1], panoGlow: 0, panoOn: false,
    flash: 0, wet: 0, snow: 0, underwater: 0, win: [0, 0, 0], ecl: [0, 1, 0], wvN: 0, wv: new Float32Array(16), wvT: new Float32Array(256),
  };
  const WX = () => { try { return typeof Weather !== 'undefined' && Weather ? Weather.state : 'clear'; } catch (e) { return 'clear'; } };
  function dir3(az, el) { const c = Math.cos(el); return [Math.cos(az) * c, Math.sin(az) * c, Math.sin(el)]; }
  function frameParams(F) {
    const env = F.env || {}, wx = env.wx || { haze: 0, dark: 0, cloud: 0, flash: 0 };
    const tod = F.tod == null ? 0.5 : F.tod;
    // the engine's sun and moon geometry (render(): sunA, elev); elevations as the angle the disc is drawn at
    const sunA = (tod - 0.25) * TAU, elev = Math.cos((tod - 0.5) * TAU);
    // the bodies' real arcs (Phase 21's free look reaches the zenith): the sun rises in the east, stands about 66 degrees up at
    // noon and sets in the west; the moon keeps the opposite arc through the night. Light comes from the body itself.
    const sunEl = Math.asin(clamp(elev, -1, 1)) * 0.74;
    // the discs stand where the raycaster draws them (so both renderers show the sun and moon in the same place, in view
    // at eye level); the light comes from twice that height, so noon shadows are not dusk-long
    P.sunD = dir3(sunA, sunEl);
    const moonEl = Math.max(0.12, Math.asin(clamp(-elev, -1, 1)) * 0.74);
    P.moonD = dir3(sunA + Math.PI, elev < 0.02 ? moonEl : -0.3);
    const day = smooth(-0.06, 0.2, elev), night = 1 - smooth(-0.2, 0.05, elev);
    P.night = night;
    const cloud = clamp(wx.cloud || 0, 0, 1), dark = clamp(wx.dark || 0, 0, 1), haze = clamp(wx.haze || 0, 0, 1);
    // the moon's phase (js/calendar11.js: one phase a day, day 0 waxing gibbous, idx 4 full)
    const idx = (((typeof G !== 'undefined' && G ? G.day | 0 : 0) + 3) % 8 + 8) % 8;
    P.moonIll = flag('moonPhase') || (typeof GFX !== 'undefined' && GFX.moonPhase === undefined) ? (1 - Math.cos(idx * Math.PI / 4)) / 2 : 1;
    P.moonWax = idx < 4 ? 1 : -1;
    // direct light: the sun by day, the moon by night
    const sunCol = keyAt(tod, 5), direct = (1 - cloud * 0.78) * (1 - dark * 0.7);
    if (day > 0.02) {
      P.sun = dir3(sunA, Math.max(0.035, sunEl));
      const k = day * 0.98 * direct;
      P.sunC = [sunCol[0] * k, sunCol[1] * k, sunCol[2] * k];
    } else {
      P.sun = dir3(sunA + Math.PI, moonEl);
      const k = night * 0.34 * (0.3 + 0.7 * P.moonIll) * direct;
      P.sunC = [0.55 * k, 0.64 * k, 0.9 * k];
    }
    // long soft shadows at dusk: the penumbra widens as the light drops; overcast nearly removes them (the light is spread)
    P.soft = mix(0.03, 0.12, 1 - smooth(0.05, 0.6, Math.abs(elev))) + cloud * 0.25;
    P.sunVis = day * (1 - cloud * 0.85) * (1 - dark * 0.6);
    P.moonVis = night * (1 - cloud * 0.9);
    // the sky's colours, then the weather: cloud greys it toward the weather's tint, haze thickens it, dark presses it down
    let zen = keyAt(tod, 1), hor = keyAt(tod, 2), glow = keyAt(tod, 3), amb = keyAt(tod, 4);
    const tint = [(wx.tr || 196) / 255, (wx.tg || 200) / 255, (wx.tb || 214) / 255];
    const grey = clamp(cloud * 0.7 + haze * 1.6, 0, 0.92), lum = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
    const toward = (c, k) => { const l = lum(c), g = [tint[0] * (0.25 + l), tint[1] * (0.25 + l), tint[2] * (0.25 + l)]; return [mix(c[0], g[0] * 0.8, k), mix(c[1], g[1] * 0.8, k), mix(c[2], g[2] * 0.8, k)]; };
    zen = toward(zen, grey); hor = toward(hor, grey * 0.85);
    const dk = (1 - dark * 0.62);
    const fl = clamp(wx.flash || 0, 0, 1);
    P.flash = fl;
    for (const c of [zen, hor]) { c[0] = c[0] * dk + fl * 0.5; c[1] = c[1] * dk + fl * 0.5; c[2] = c[2] * (1 - dark * 0.45) + fl * 0.55; }
    P.zen = zen; P.hor = hor;
    P.glow = [glow[0] * P.sunVis, glow[1] * P.sunVis, glow[2] * P.sunVis];
    // ambient: the sky's light from above and a warmer, darker bounce from the ground; overcast spreads the sun into it
    const spread = 1 + cloud * 0.45 + haze * 0.3;
    const ak = 1 - 0.16 * day * (1 - cloud);   // a clear day's light is mostly the sun's: deeper shade
    P.ambS = [amb[0] * spread * dk * ak + fl * 0.4, amb[1] * spread * dk * ak + fl * 0.4, amb[2] * spread * (1 - dark * 0.45) * ak + fl * 0.45];
    P.ambG = [P.ambS[0] * 0.62 + sunCol[0] * day * 0.06, P.ambS[1] * 0.55 + sunCol[1] * day * 0.05, P.ambS[2] * 0.48];
    // the scale of everything: the engine's own light level keeps the two renderers equally bright on average
    // fog: the height fog (mist, Cinematic ground fog, soft fog) and its height above the feet
    const hf = (flag('mist') || flag('softFog') ? 0.16 : 0) + (flag('cineFog') ? 0.22 : 0) + (WX() === 'mist' ? 0.35 : 0) + haze * 0.6;
    P.fog = [1, F.outdoor ? hf : hf * 0.4, 0.22 * ZK, P.maxH];
    P.shadowOn = !!(F.outdoor && flag('p21_shadows') && hgt.ok && (P.sunC[0] + P.sunC[1] + P.sunC[2]) > 0.01);
    P.pt = [1.9 + 0.6 * night, 0.62 * ZK, flag('darkInteriors') ? 2 : 1, flag('reflections') ? 1 : 0];   // lamps carry the night
    P.t = [F.now || 0, F.time || 0, 0, 1];
    // clouds: cover from the weather; wind from Weather.wind
    const wind = typeof Weather !== 'undefined' ? (Weather.wind || 0.2) : 0.2;
    P.cl = [clamp(0.4 + cloud * 0.76, 0, 1), wind, dark, flag('p21_clouds') ? 1 : 0];
    // stars: night, thinned by cloud and haze; aurora from js/skies14.js's plan for tonight
    P.sky2 = [flag('stars') || (typeof GFX !== 'undefined' && GFX.stars === undefined) ? night * clamp(1 - cloud * 1.3, 0, 1) * clamp(1 - haze * 3, 0, 1) * (1 - fl) : 0, 0, fl, F.pxK || 1];
    try {
      if (night > 0.3 && flag('aurora') && typeof SKIES14 !== 'undefined' && SKIES14.aurora && SKIES14.aurora.plan && typeof G !== 'undefined' && F.outdoor) {
        const plan = SKIES14.aurora.plan(G.day | 0, G.tod, G.flags || {});
        if (plan && plan.notes) {
          const N = SKIES14.aurora.NOTES || [];
          for (let i = 0; i < 3; i++) { const n = N[plan.notes[i % plan.notes.length]]; P.aur[i] = n ? n.rgb.map(v => v / 255) : [0.3, 0.6, 0.4]; }
          P.sky2[1] = (plan.amp || 0.6) * night * clamp(1 - cloud * 1.4, 0, 1);
        }
      }
    } catch (e) { warnOnce('aurora', e); }
    // the panoramas' air: the horizon colour half and the map's fog half, as js/sky.js mixes it
    const fp = (env.fogPx >>> 0) || 0;
    P.panoAir = [(hor[0] + ((fp & 255) / 255)) * 0.5, (hor[1] + (((fp >>> 8) & 255) / 255)) * 0.5, (hor[2] + (((fp >>> 16) & 255) / 255)) * 0.5, (0.34 + 0.66 * (env.skyDay == null ? 1 : env.skyDay)) * (1 - dark * 0.45)];
    P.panoGlow = night > 0.25 && haze < 0.25 ? night * (1 - haze * 3) * 0.85 : 0;
    P.panoHaze = haze * 0.7;
    P.panoOn = flag('panoramas') && pano.ok && pano.n > 0;
    P.wet = WX() === 'rain' || WX() === 'storm' ? 1 : 0;
    P.snow = WX() === 'snow' ? 1 : 0;
    // the eclipse (js/synod15.js): its own darkening reaches the engine through the weather light already; the disc is here
    try {
      const Sy = typeof SYNOD15 !== 'undefined' ? SYNOD15 : null, k = Sy && Sy.state ? +Sy.state.k || 0 : 0;
      if (k > 0.01 && F.outdoor && (typeof GFX === 'undefined' || GFX.eclipseSky !== false)) {
        const u = Sy.eclipseU ? Sy.eclipseU(typeof G !== 'undefined' ? G.day | 0 : 0, F.tod) : 0.5;
        P.ecl = [Math.min(1, k), u < 0.5 ? -1 : 1, (typeof ANIM !== 'undefined' && ANIM.T) || 0];
      } else P.ecl = [0, 1, 0];
    } catch (e) { P.ecl = [0, 1, 0]; }
    // the grey wave: tables from js/hunters13.js's own greyAt() (32 steps in distance squared per wave)
    P.wvN = 0;
    try {
      const H = typeof HUNTERS13 !== 'undefined' ? HUNTERS13 : null;
      if (H && H.waves && H.waves.length && H.greyAt && (typeof GFX === 'undefined' || GFX.hushWave !== false) && F.map) {
        const W = H.BAL.wave, T = H.clock;
        for (const wv of H.waves) {
          if (P.wvN >= 4 || wv.map !== F.map.id) continue;
          const age = T - wv.t0, R = H.waveR(wv, T), ring = wv.still ? 0 : W.ring * (wv.soft ? W.softK * 0.5 : 1) * (wv.gentle ? W.scareK : 1);
          const outer = wv.still ? W.maxR * 1.1 : Math.min(W.maxR + W.band, R + W.band * 0.5), o2 = outer * outer, i = P.wvN;
          P.wv.set([wv.x, wv.y, o2, 0], i * 4);
          for (let k = 0; k < 32; k++) {
            const d = Math.sqrt((k + 0.5) / 32 * o2), a = H.greyAt(wv, d, age);
            let lift = 0; if (ring > 0) { const dl = (R - d) / (W.band * 0.5); lift = ring * Math.exp(-dl * dl) * (1 - 0.5 * d / W.maxR); }
            P.wvT[i * 64 + k * 2] = a; P.wvT[i * 64 + k * 2 + 1] = lift;
          }
          P.wvN++;
        }
      }
    } catch (e) { warnOnce('grey wave', e); P.wvN = 0; }
    try {
      const W = typeof WINTER17 !== 'undefined' && WINTER17.active && F.map && flag('winter17') ? WINTER17.active(F.map.id) : null;
      P.win = W ? [W.snow || 0, W.grade || 0, W.fall || 0] : [0, 0, 0];
    } catch (e) { P.win = [0, 0, 0]; }
    try { P.underwater = typeof DEEP16 !== 'undefined' && DEEP16.underwater && DEEP16.underwater() ? 1 : 0; } catch (e) { P.underwater = 0; }
  }

  // ------------------------------------------------------------------------------------------------ the shade chunk
  const SHADE = `
uniform highp usampler2D uLVis;
uniform highp sampler2D uL21H;
uniform vec4 uL21Sun; uniform vec4 uL21SunC; uniform vec4 uL21SunD; uniform vec4 uL21MoonD;
uniform vec3 uL21Zen; uniform vec3 uL21Hor; uniform vec3 uL21Glow; uniform vec3 uL21AmbS; uniform vec3 uL21AmbG;
uniform vec4 uL21Fog; uniform vec4 uL21P; uniform vec4 uL21T;
uniform highp sampler2D uL21SMap; uniform mat4 uL21SVP; uniform float uL21SOn;
uniform vec4 uL21Win;   // WINTER17 on this map: x snow cover 0..1 (0 = none)
// js/hunters13.js's grey wave (the Hush's quiet passing through the world): per wave its centre, outer radius squared, and
// a table of (grey, lift) over distance squared, worked out on the CPU with the module's own greyAt()
uniform vec4 uL21Wv[4]; uniform vec4 uL21WvT[64]; uniform int uL21WvN;
vec3 l21Wave(vec3 c, vec2 p) {
  for (int i = 0; i < 4; i++) {
    if (i >= uL21WvN) break;
    vec2 d = p - uL21Wv[i].xy; float d2 = dot(d, d); if (d2 > uL21Wv[i].z) continue;
    float f = d2 / uL21Wv[i].z * 31.0; int k = int(f);
    vec4 e = uL21WvT[i * 16 + k / 2]; vec2 t = (k & 1) == 0 ? e.xy : e.zw;
    float L = dot(c, vec3(0.3, 0.59, 0.11)) * 0.9;
    c = mix(c, vec3(L), t.x);
    c = mix(c, vec3(200.0, 200.0, 196.0) / 255.0, t.y);
  }
  return c;
}
float l21Hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
float l21Noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(l21Hash(i), l21Hash(i + vec2(1, 0)), f.x), mix(l21Hash(i + vec2(0, 1)), l21Hash(i + vec2(1, 1)), f.x), f.y); }
// the figures' shadows (js/sprites21.js casters in a sun-view depth map): 1 lit .. 0 under a figure
float l21FigShadow(vec3 p) {
  if (uL21SOn < 0.5) return 1.0;
  vec4 q = uL21SVP * vec4(p.xy, p.z / uRight.w, 1.0); vec3 n = q.xyz / q.w;
  vec2 uv = n.xy * 0.5 + 0.5; float d = n.z * 0.5 + 0.5;
  if (uv.x <= 0.0 || uv.y <= 0.0 || uv.x >= 1.0 || uv.y >= 1.0) return 1.0;
  vec2 t = vec2(1.0 / 1024.0); float occ = 0.0;
  occ += texture(uL21SMap, uv + vec2(-0.5, -0.5) * t).r < d - 0.002 ? 1.0 : 0.0;
  occ += texture(uL21SMap, uv + vec2(0.5, -0.5) * t).r < d - 0.002 ? 1.0 : 0.0;
  occ += texture(uL21SMap, uv + vec2(-0.5, 0.5) * t).r < d - 0.002 ? 1.0 : 0.0;
  occ += texture(uL21SMap, uv + vec2(0.5, 0.5) * t).r < d - 0.002 ? 1.0 : 0.0;
  vec4 sp = uViewProj * vec4(p, 1.0); float ex = sp.w > 0.0 ? abs(sp.x / sp.w) : 2.0;
  return 1.0 - occ * 0.25 * 0.85 * (1.0 - smoothstep(0.7, 1.0, ex));   // no pop where a caster leaves the screen
}
// CORE's lamp sum, kept under its own name for any program that calls it
vec3 r3dPointLight(vec2 p) {
  int n = int(uView2.w); if (n <= 0) return vec3(0.0);
  ivec2 c = ivec2(floor(p)); uint bits = 0u;
  if (c.x >= 0 && c.y >= 0 && float(c.x) < uMap.x && float(c.y) < uMap.y) bits = texelFetch(uLVis, c, 0).r;
  if (bits == 0u) return vec3(0.0);
  vec3 s = vec3(0.0);
  for (int i = 0; i < 32; i++) {
    if (i >= n) break;
    if ((bits & (1u << uint(i))) == 0u) continue;
    vec2 d = p - uLP[i].xy; float d2 = dot(d, d);
    if (d2 < uLP[i].z) { float k = 1.0 - d2 / uLP[i].z; s += uLC[i].rgb * (k * k); }
  }
  return min(s, vec3(90.0 / 255.0));
}
// the sky's colour toward a direction (gradient and the sun's halo; no clouds): the fog and the reflections use it
vec3 l21SkyCol(vec3 d);
vec3 l21Air(vec3 d) {
  d = normalize(vec3(d.xy, 0.05));
  float sd = max(0.0, dot(d, uL21SunD.xyz));
  return uL21Hor + uL21Glow * pow(sd, 6.0) * 0.18;
}
vec3 l21SkyCol(vec3 d) {
  d = normalize(d);
  float e = d.z;
  float t = pow(1.0 - clamp(e, 0.0, 1.0), 4.5);
  vec3 c = mix(uL21Zen, uL21Hor, t);
  if (e < 0.0) c = mix(uL21Hor, uL21Hor * 0.82, clamp(-e * 3.0, 0.0, 1.0));
  float sd = max(0.0, dot(d, uL21SunD.xyz));
  c += uL21Glow * (pow(sd, 5.0) * 0.32 + pow(sd, 40.0) * 0.5) * (1.0 - clamp(e, 0.0, 1.0) * 0.6);
  return c;
}
// a cell's height; open slope cells are stored 10000 low (their lowest corner, flagged), so ground that only goes on
// rising is never taken for a wall
float l21Hgt(ivec2 c) { float v = texelFetch(uL21H, c, 0).r; return v < -5000.0 ? v + 10000.0 : v; }
bool l21Occ(ivec2 c, float z) { float v = texelFetch(uL21H, c, 0).r; return v >= -5000.0 && v > z; }
// the sun's ray marched through the map's cell heights: 1 lit, 0 in shadow, a penumbra by how narrowly it clears
float l21Shadow(vec3 p, vec3 L) {
  if (uL21Sun.w < 0.5 || L.z <= 0.0) return 1.0;
  float lxy = length(L.xy); if (lxy < 1e-4) return 1.0;
  vec2 d = L.xy / lxy; float rise = L.z / lxy;
  ivec2 c = ivec2(floor(p.xy));
  vec2 st = vec2(d.x >= 0.0 ? 1.0 : -1.0, d.y >= 0.0 ? 1.0 : -1.0);
  vec2 inv = vec2(abs(d.x) > 1e-5 ? 1.0 / abs(d.x) : 1e9, abs(d.y) > 1e-5 ? 1.0 / abs(d.y) : 1e9);
  vec2 tMax = vec2(d.x >= 0.0 ? (float(c.x) + 1.0 - p.x) : (p.x - float(c.x)), d.y >= 0.0 ? (float(c.y) + 1.0 - p.y) : (p.y - float(c.y))) * inv;
  float sh = 1.0, t = 0.0;
  for (int i = 0; i < 40; i++) {
    if (tMax.x < tMax.y) { t = tMax.x; tMax.x += inv.x; c.x += int(st.x); } else { t = tMax.y; tMax.y += inv.y; c.y += int(st.y); }
    if (c.x < 0 || c.y < 0 || float(c.x) >= uMap.x || float(c.y) >= uMap.y) break;
    float z = p.z + rise * t;
    if (z > uL21Fog.w) break;
    float h = l21Hgt(c);
    float clear = z - h;
    if (clear < 0.0) return 0.0;
    sh = min(sh, clear / (t * uL21SunC.w + 0.02));
  }
  return clamp(sh, 0.0, 1.0);
}
// ambient occlusion from the map's heights: the ground darkens where it meets a wall, a wall darkens toward its foot;
// read on the texel grid like the rest of the light, so corners get a stepped pixel-art shade
float l21AO(vec3 p, vec3 n) {
  if (uL21Sun.w < -0.5) return 1.0;
  ivec2 c = ivec2(floor(p.xy)); vec2 f = p.xy - floor(p.xy);
  if (c.x < 0 || c.y < 0 || float(c.x) >= uMap.x || float(c.y) >= uMap.y) return 1.0;
  float ao = 0.0;
  if (n.z > 0.5) {
    float z = p.z + 0.12;
    if (c.x > 0 && l21Occ(c + ivec2(-1, 0), z)) ao += pow(max(0.0, 1.0 - f.x / 0.45), 2.0);
    if (float(c.x) < uMap.x - 1.0 && l21Occ(c + ivec2(1, 0), z)) ao += pow(max(0.0, 1.0 - (1.0 - f.x) / 0.45), 2.0);
    if (c.y > 0 && l21Occ(c + ivec2(0, -1), z)) ao += pow(max(0.0, 1.0 - f.y / 0.45), 2.0);
    if (float(c.y) < uMap.y - 1.0 && l21Occ(c + ivec2(0, 1), z)) ao += pow(max(0.0, 1.0 - (1.0 - f.y) / 0.45), 2.0);
  } else if (n.z < 0.3) {
    ivec2 o = ivec2(floor(p.xy + n.xy * 0.5));
    if (o.x >= 0 && o.y >= 0 && float(o.x) < uMap.x && float(o.y) < uMap.y) { float g = l21Hgt(o); ao = 1.0 - smoothstep(0.0, 0.32, p.z - g); }
  }
  return 1.0 - 0.42 * clamp(ao, 0.0, 1.0);
}
// js/lighting.js's dark interiors: indoors, what no lamp reaches sinks toward 45 % (lamps count by their strength)
float l21Dark(vec3 p) {
  int cnt = int(uView2.w); float sum = 0.0;
  ivec2 c = ivec2(floor(p.xy)); uint bits = 0u;
  if (cnt > 0 && c.x >= 0 && c.y >= 0 && float(c.x) < uMap.x && float(c.y) < uMap.y) bits = texelFetch(uLVis, c, 0).r;
  for (int i = 0; i < 32; i++) {
    if (i >= cnt || bits == 0u) break;
    if ((bits & (1u << uint(i))) == 0u) continue;
    vec2 d = p.xy - uLP[i].xy; float d2 = dot(d, d); if (d2 >= uLP[i].z) continue;
    float str = min(1.0, (uLC[i].r + uLC[i].g + uLC[i].b) * 2.55);
    sum += (1.0 - d2 / uLP[i].z) * str * 1.35;
  }
  return 0.45 + 0.55 * min(sum, 1.0);
}
// the game's point lights per pixel: each at a lamp's height, its reach and colour as the engine has them, N.L
vec3 l21Points(vec3 p, vec3 n, float wrap) {
  int cnt = int(uView2.w); if (cnt <= 0) return vec3(0.0);
  ivec2 c = ivec2(floor(p.xy)); uint bits = 0u;
  if (c.x >= 0 && c.y >= 0 && float(c.x) < uMap.x && float(c.y) < uMap.y) bits = texelFetch(uLVis, c, 0).r;
  if (bits == 0u) return vec3(0.0);
  vec3 s = vec3(0.0);
  for (int i = 0; i < 32; i++) {
    if (i >= cnt) break;
    if ((bits & (1u << uint(i))) == 0u) continue;
    vec3 lp = vec3(uLP[i].xy, uL21P.y);
    vec3 dv = lp - p; float d2 = dot(dv.xy, dv.xy);
    if (d2 >= uLP[i].z) continue;
    float k = 1.0 - d2 / uLP[i].z; k = k * k;
    float ndl = dot(n, normalize(dv));
    float lam = wrap + (1.0 - wrap) * max(0.0, ndl);
    s += uLC[i].rgb * k * lam * (1.0 + 0.6 * k);   // a brighter heart near the flame: warm pools
  }
  return s;
}
vec3 r3dShade(R3DSurf s) {
  vec3 eye = uEye.xyz;
  float dist = max(0.0, dot(s.pos.xy - eye.xy, uFwdH.xy));
  vec3 V = s.pos - eye; float vl = max(length(V), 1e-4); vec3 vd = V / vl;
  bool outdoor = uLit.w > 0.5;
  bool body = s.kind == 2, spr = s.kind == 1;
  vec3 n = s.kind == 0 ? normalize(s.nrm) : normalize(vec3(-uFwdH.xy, 0.15));
  // light and shadow on the texel grid (1/32 of a cell): edges stay pixel art
  vec3 lp = s.pos;
  if (s.kind == 0) { vec3 g = vec3(32.0, 32.0, 32.0 / uRight.w); lp = (floor(s.pos * g + n * 0.5) + 0.5) / g; }
  bool water = s.kind == 0 && (s.mat == 2.0 || s.mat == 3.0);
  if (water) {
    // ripples: two drifting sines in world space, quantised to the texel grid
    vec2 q = floor(s.pos.xy * 32.0) / 32.0; float tt = uL21T.x;
    float a = sin(q.x * 9.0 + tt * 1.7) + sin(q.y * 11.0 - tt * 1.3) + 0.6 * sin((q.x + q.y) * 17.0 + tt * 2.3);
    float b = cos(q.y * 8.0 + tt * 1.5) + cos(q.x * 13.0 - tt * 1.1);
    n = normalize(vec3(a * 0.035, b * 0.035, 1.0));
  }
  // winter (js/extras17.js WINTER17): snow lies on what faces the sky, in patches, on the texel grid
  if (uL21Win.x > 0.001 && s.kind == 0 && n.z > 0.55 && !water) {
    vec2 q = floor(s.pos.xy * 16.0) / 16.0;
    float nz = l21Noise(q * 2.5) * 0.65 + l21Noise(q * 7.0) * 0.35;
    float cover = smoothstep(1.0 - uL21Win.x - 0.04, 1.0 - uL21Win.x + 0.04, nz) * smoothstep(0.55, 0.8, n.z);
    s.albedo = mix(s.albedo, vec3(0.86, 0.9, 0.96) * (0.9 + 0.1 * l21Hash(q)), cover);
  }
  vec3 c;
  float fogK;
  if (outdoor) {
    vec3 amb = mix(uL21AmbG, uL21AmbS, n.z * 0.5 + 0.5) * (s.kind == 0 ? l21AO(lp, n) : 1.0);
    float ndl = dot(n, uL21Sun.xyz);
    if (s.kind != 0) ndl = 0.35 + 0.65 * max(ndl, dot(normalize(vec3(-uFwdH.xy, 0.4)), uL21Sun.xyz));
    vec3 direct = vec3(0.0);
    if (ndl > 0.0 && uL21SunC.r + uL21SunC.g + uL21SunC.b > 0.003) {
      float sh = l21Shadow(lp + n * 0.035 + vec3(0.0, 0.0, body ? 0.0 : 0.002), uL21Sun.xyz);
      if (s.kind == 0) sh *= l21FigShadow(s.pos + n * 0.01);
      direct = uL21SunC.rgb * ndl * sh;
    }
    vec3 pts = l21Points(lp + n * 0.02, n, s.kind == 0 ? 0.15 : 0.6) * uL21P.x;
    if (spr) pts = max(pts, s.ladd);
    vec3 light = amb + direct + pts;
    c = s.albedo * light + pts * 0.22;
    // wet ground after rain: a faint sheen toward the light
    if (uL21T.z > 0.5 && s.kind == 0 && n.z > 0.7) { vec3 r = reflect(vd, n); c += uL21SunC.rgb * pow(max(0.0, dot(r, uL21Sun.xyz)), 24.0) * 0.35; }
    // the raycaster's visibility (view distance, ambient floor), as fog toward the sky behind
    float f = clamp(1.0 - dist * uFog.w, 0.0, 1.0); f = uLit.y + (1.0 - uLit.y) * f;
    fogK = 1.0 - f;
  } else {
    // indoors: the raycaster's distance-to-dark (readability), the lamps on top
    float f = s.kind == 1 ? s.fi : clamp(1.0 - dist * uFog.w, 0.0, 1.0);
    if (s.kind != 1) { f = uLit.y + (1.0 - uLit.y) * f; f *= s.side; f *= uLit.z; f *= l21AO(lp, n); }
    vec3 pts = l21Points(lp + n * 0.02, n, s.kind == 0 ? 0.2 : 0.6) * uL21P.x;
    if (spr) pts = max(pts, s.ladd);
    c = s.albedo * (f * 0.86 + pts * 1.15) + pts * 0.06;
    if (uL21P.z > 1.5 && s.emissive < 0.5) c *= l21Dark(lp);
    fogK = 0.0;
  }
  if (water && uL21P.w > 0.5) {
    vec3 r = reflect(vd, n); r.z = abs(r.z);
    float fr = 0.18 + 0.7 * pow(1.0 - max(0.0, dot(-vd, n)), 4.0);
    vec3 refl = outdoor ? l21SkyCol(r) * (0.65 + 0.35 * uLit.x) : uFog.rgb * 0.6 + l21Points(lp, vec3(0, 0, 1), 0.5) * 0.6;
    float k = (s.mat == 2.0 ? 0.62 : 0.4) * fr;
    c = mix(c, refl, k);
    if (outdoor) c += uL21SunC.rgb * pow(max(0.0, dot(r, uL21Sun.xyz)), 160.0) * 3.0;   // the sun's glitter (blooms)
  }
  if (s.emissive > 0.5) c = max(c, s.albedo * 1.12);
  if (outdoor) {
    // the air toward that direction: the sky just above the horizon there, held toward the map's own haze colour
    vec3 fc = mix(uFogPx.rgb, l21Air(vd) * 0.84, 0.42) * mix(1.0, uLit.x, 0.25);
    fogK = pow(fogK, 1.5);
    // height fog: thick near the ground, thin above the eye; grows with distance
    float hz = s.pos.z - (eye.z - 0.5 * uRight.w);
    float hfog = uL21Fog.y * exp(-max(0.0, hz) / max(0.01, uL21Fog.z)) * (1.0 - exp(-dist * 0.12));
    float k = clamp(fogK + hfog * (1.0 - fogK), 0.0, 1.0);
    if (body) k = 0.0;
    c = mix(c, fc, k);
  } else if (uL21Fog.y > 0.0) {
    float hz = s.pos.z - (eye.z - 0.5 * uRight.w);
    float hfog = uL21Fog.y * exp(-max(0.0, hz) / max(0.01, uL21Fog.z)) * (1.0 - exp(-dist * 0.12));
    c = mix(c, uFog.rgb, clamp(hfog, 0.0, 0.6));
  }
  if (uL21WvN > 0 && !body) c = l21Wave(c, s.pos.xy);
  return max(c, vec3(0.0));
}
`;
  function v3(g, loc, a) { if (loc) g.uniform3f(loc, a[0], a[1], a[2]); }
  function v4(g, loc, a, b, c, d) { if (loc) g.uniform4f(loc, a, b, c, d); }
  function shadeUniforms(g, pr) {
    const u = pr.u;
    if (u.uL21H) { g.activeTexture(g.TEXTURE15); g.bindTexture(g.TEXTURE_2D, hgt.tex); g.uniform1i(u.uL21H, 15); }   // unit 15: clear of CORE (0-5) and SPRITES (6, 7)
    v4(g, u.uL21Sun, P.sun[0], P.sun[1], P.sun[2], P.shadowOn ? 1 : 0);
    v4(g, u.uL21SunC, P.sunC[0], P.sunC[1], P.sunC[2], P.soft);
    v4(g, u.uL21SunD, P.sunD[0], P.sunD[1], P.sunD[2], P.sunVis);
    v4(g, u.uL21MoonD, P.moonD[0], P.moonD[1], P.moonD[2], P.moonIll);
    v3(g, u.uL21Zen, P.zen); v3(g, u.uL21Hor, P.hor); v3(g, u.uL21Glow, P.glow); v3(g, u.uL21AmbS, P.ambS); v3(g, u.uL21AmbG, P.ambG);
    v4(g, u.uL21Fog, P.fog[0], P.fog[1], P.fog[2], P.maxH);
    v4(g, u.uL21P, P.pt[0], P.pt[1], P.pt[2], P.pt[3]);
    v4(g, u.uL21T, P.t[0], P.t[1], P.wet, P.t[3]);
    if (u.uL21SMap) { g.activeTexture(g.TEXTURE14); g.bindTexture(g.TEXTURE_2D, smap.on ? smap.tex : null); g.uniform1i(u.uL21SMap, 14); }
    if (u.uL21SVP) g.uniformMatrix4fv(u.uL21SVP, false, smap.vp);
    if (u.uL21SOn) g.uniform1f(u.uL21SOn, smap.on ? 1 : 0);
    v4(g, u.uL21Win, P.win[0], P.win[1], P.win[2], 0);
    if (u.uL21WvN) { g.uniform1i(u.uL21WvN, P.wvN); if (P.wvN) { g.uniform4fv(u.uL21Wv, P.wv); g.uniform4fv(u.uL21WvT, P.wvT); } }
  }

  // ------------------------------------------------------------------------------------------------ the map's heights
  // R32F, one texel per cell: a block's top, an open cell's ground (its centre on a slope), in GL units. Rebuilt per map.
  // where the rain stops: roof heights over the map (js/eaves78.js), a quarter of a cell to the texel
  const shel = { tex: null, none: null, src: null, w: 0, h: 0, k: 4 };
  function shelterNone(gl) { if (!shel.none) { shel.none = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, shel.none); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R32F, 1, 1); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, 1, gl.RED, gl.FLOAT, new Float32Array([-1e4])); } return shel.none; }
  function shelterTex(gl, F) {
    let s = null; try { s = typeof EAVES78 !== 'undefined' && EAVES78.shelter ? EAVES78.shelter(F.map) : null; } catch (e) { warnOnce('shelter', e); }
    if (!s) return null;
    if (shel.src !== s) {
      if (!shel.tex || shel.w !== s.w || shel.h !== s.h) { if (shel.tex) gl.deleteTexture(shel.tex); shel.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, shel.tex); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R32F, s.w, s.h);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); shel.w = s.w; shel.h = s.h; }
      const d = new Float32Array(s.data.length); for (let i = 0; i < d.length; i++) d[i] = s.data[i] < -5000 ? -1e4 : s.data[i] * ZK;
      gl.bindTexture(gl.TEXTURE_2D, shel.tex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, s.w, s.h, gl.RED, gl.FLOAT, d); shel.src = s; shel.k = s.k;
    }
    return shel.tex;
  }
  const hgt = { tex: null, map: null, sig: '', w: 0, h: 0, ok: false };
  function buildHeights(gl, m) {
    if (!gl || !m) return;
    const W = m.w, H = m.h, relief = !!m.relief, grid = m.cells, wTop0 = m.ceil ? (m.ceilZ || 1) : 0;
    const d = new Float32Array(W * H);
    let maxH = 0;
    const groundC = (cx, cy) => {
      const i = cy * W + cx;
      if (relief && m.smooth && m.smooth[i] && m.verts) { const W1 = W + 1, v = cy * W1 + cx, V = m.verts; return (V[v] + V[v + 1] + V[v + W1] + V[v + W1 + 1]) / 4; }
      return relief && m.lvls ? m.lvls[i] : 0;
    };
    for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) {
      const i = cy * W + cx, c = grid[i];
      let z;
      let slope = false;
      if (c && !c.door) z = relief ? (c.top != null ? c.top : Math.max(groundC(cx, cy) + 1, wTop0)) : (c.top != null ? c.top : 1);
      else if (relief && m.smooth && m.smooth[i] && m.verts) { const W1 = W + 1, v = cy * W1 + cx, V = m.verts; z = Math.min(V[v], V[v + 1], V[v + W1], V[v + W1 + 1]); slope = true; }
      else z = groundC(cx, cy);
      d[i] = z * ZK; if (d[i] > maxH) maxH = d[i];
      // a slope cell: its lowest corner, flagged 10000 low (see l21Hgt): a ray or a corner never meets it as a wall
      if (slope) d[i] -= 10000;
    }
    if (!hgt.tex || hgt.w !== W || hgt.h !== H) {
      if (hgt.tex) gl.deleteTexture(hgt.tex);
      hgt.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, hgt.tex);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R32F, W, H);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      hgt.w = W; hgt.h = H;
    }
    gl.bindTexture(gl.TEXTURE_2D, hgt.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RED, gl.FLOAT, d);
    hgt.map = m; hgt.ok = true; P.maxH = maxH + 0.01;
  }
  // cheap signature of what the heights depend on (cells that open or close, a level that changes)
  function heightSig(m) {
    let h = m.w * 131 + m.h, n = 0;
    for (let i = 0; i < m.cells.length; i += 1) { const c = m.cells[i]; if (c && !c.door) { h = (h * 31 + i + (c.top != null ? (c.top * 64) | 0 : 7)) | 0; n++; } }
    return h + ':' + n + ':' + (m.lvls ? m.lvls.length : 0);
  }

  // ------------------------------------------------------------------------------------------------ the panoramas
  // js/sky.js's layers for the map (its LANDMARKS ridges baked in), farthest first: art slots in an R8UI array texture
  // (1536 columns round, 56 rows up), palettes in a small RGBA8 texture (12 slots x layers).
  const pano = { tex: null, pal: null, key: '', n: 0, ok: false, AW: 1536, AH: 56, mix: new Float32Array(64) };
  function buildPano(gl, m) {
    pano.ok = false; pano.n = 0;
    if (!m || !m.outdoor || typeof SKY === 'undefined' || !SKY.panorama) return;
    let layers;
    try { layers = SKY.panorama(m.id); } catch (e) { warnOnce('panorama', e); return; }
    if (!layers || !layers.length) return;
    const NL = Math.min(16, layers.length), AW = layers[0].art.length / pano.AH | 0, AH = pano.AH;
    pano.AW = AW;
    const art = new Uint8Array(AW * AH * NL), pal = new Uint8Array(12 * 16 * 4);
    for (let l = 0; l < NL; l++) {
      const L = layers[l];
      art.set(L.art.subarray ? L.art.subarray(0, AW * AH) : L.art, l * AW * AH);
      for (let s = 0; s < 12; s++) { const c = L.pal[s]; const o = (l * 12 + s) * 4; if (c) { pal[o] = c[0]; pal[o + 1] = c[1]; pal[o + 2] = c[2]; pal[o + 3] = 255; } }
      pano.mix[l * 4] = L.mix; pano.mix[l * 4 + 1] = 0; pano.mix[l * 4 + 2] = 0; pano.mix[l * 4 + 3] = 0;
    }
    if (pano.tex) gl.deleteTexture(pano.tex);
    pano.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, pano.tex);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.R8UI, AW, AH, NL);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 0, AW, AH, NL, gl.RED_INTEGER, gl.UNSIGNED_BYTE, art);
    if (!pano.pal) { pano.pal = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, pano.pal); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 12, 16); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); }
    gl.bindTexture(gl.TEXTURE_2D, pano.pal); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 12, 16, gl.RGBA, gl.UNSIGNED_BYTE, pal);
    pano.n = NL; pano.ok = true;
  }

  // ------------------------------------------------------------------------------------------------ shaders
  const TRI = `
out vec2 vNdc;
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0; vNdc = p; gl_Position = vec4(p, 0.0, 1.0); }`;
  // the sky at logical resolution
  const SKY_FS = `
precision highp usampler2DArray;
uniform highp usampler2DArray uL21Pano; uniform sampler2D uL21Pal;
uniform vec4 uL21PanoK[16]; uniform int uL21PanoN; uniform vec4 uL21PanoAir; uniform vec4 uL21PanoG; uniform int uL21PanoAW;
uniform vec4 uL21Ecl;   // js/synod15.js's eclipse: x cover 0..1, y side (-1/+1), z shimmer clock
uniform vec4 uL21Ship; uniform sampler2D uL21ShipT; uniform vec2 uL21ShipS;   // the Drift-Kestrel: az, tan(el), alpha, flip; art size
uniform vec4 uL21Cl; uniform vec4 uL21Sky2; uniform vec3 uL21Aur[3]; uniform vec2 uL21Size; uniform int uL21LmOn;
in vec2 vNdc;
layout(location=0) out vec4 oSky;
float h21(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
float n21(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n21(p); p = p * 2.03 + vec2(17.1, 9.3); a *= 0.5; } return s; }
float bay(ivec2 p) { return (float(r3dBayer(p)) + 0.5) / 16.0; }
void main() {
  ivec2 pix = ivec2(gl_FragCoord.xy);
  vec4 a = uInvViewProj * vec4(vNdc, 1.0, 1.0); vec4 b = uInvViewProj * vec4(vNdc, -1.0, 1.0);
  vec3 dir = normalize(a.xyz / a.w - b.xyz / b.w);
  float glowFlag = 0.0;
  float lxy = max(1e-4, length(dir.xy));
  float te = dir.z / lxy, az = atan(dir.y, dir.x);
  vec3 c = l21SkyCol(dir);
  float up = clamp(dir.z, 0.0, 1.0);
  // stars: one logical pixel each on an angle grid, twinkling, faint toward the horizon
  if (uL21Sky2.x > 0.01 && dir.z > 0.02) {
    vec3 g3 = floor(dir * ${(FX * 0.5).toFixed(3)});
    vec2 cell = vec2(g3.x * 1.31 + g3.z * 7.7, g3.y * 1.73 - g3.z * 3.1);
    float h = h21(cell * 0.137 + 3.7);
    // the Chord [PROPOSED]: a pale band of star-dust across the night, the way the Reach's old songs say the eight notes lie
    vec3 bandN = normalize(vec3(0.35, 0.82, 0.45));
    float band = exp(-pow(dot(dir, bandN), 2.0) / 0.018);
    float dust = n21(vec2(atan(dir.y, dir.x) * 9.0, dir.z * 14.0)) * 0.6 + n21(vec2(atan(dir.y, dir.x) * 31.0, dir.z * 45.0)) * 0.4;
    float allowB = clamp(1.0 - (dot(c, vec3(0.33)) - 0.06) / 0.3, 0.0, 1.0);
    c += vec3(0.42, 0.44, 0.62) * band * smoothstep(0.35, 0.8, dust) * 0.16 * uL21Sky2.x * allowB * clamp(dir.z * 5.0, 0.0, 1.0);
    float thr = 0.9935 - band * 0.006;
    if (h > thr) {
      float m = (h - thr) / (1.0 - thr); m = 0.25 + 0.75 * m * m * m;
      float tw = 0.75 + 0.25 * sin(uL21T.x * (1.3 + 3.0 * h21(cell + 1.3)) + h * 40.0);
      vec3 sc = h21(cell + 7.7) < 0.6 ? vec3(0.92, 0.95, 1.0) : h21(cell + 2.1) < 0.6 ? vec3(0.68, 0.78, 1.0) : vec3(1.0, 0.85, 0.65);
      float allow = clamp(1.0 - (dot(c, vec3(0.33)) - 0.08) / 0.35, 0.0, 1.0);
      c += sc * m * tw * uL21Sky2.x * allow * clamp(dir.z * 8.0, 0.0, 1.0) * 1.1;
    }
  }
  // the Octave lights: thin ribbons high in the night sky, one hue per note along each ribbon, rays, a soft lower fringe
  float elA = asin(clamp(dir.z, -1.0, 1.0));
  if (uL21Sky2.y > 0.01 && elA > 0.2) {
    for (int k = 0; k < 2; k++) {
      float fk = float(k);
      float base = 0.5 + 0.32 * fk + 0.14 * sin(az * (2.0 + fk) + uL21T.x * 0.05 + fk * 2.0) + 0.07 * n21(vec2(az * 6.0 + uL21T.x * 0.08, fk * 5.0));
      float s = (elA - base) / 0.3;
      float prof = s < 0.0 ? exp(-pow(s * 3.1, 2.0)) : exp(-s * 1.7);
      float rays = 0.65 + 0.35 * n21(vec2(az * 60.0 + fk * 13.0, uL21T.x * 0.3));
      float u = fract(az / 6.2831853 * 3.0 + fk * 0.37 + uL21T.x * 0.004) * 3.0;
      vec3 hue = u < 1.0 ? mix(uL21Aur[0], uL21Aur[1], u) : u < 2.0 ? mix(uL21Aur[1], uL21Aur[2], u - 1.0) : mix(uL21Aur[2], uL21Aur[0], u - 2.0);
      float al = prof * rays * uL21Sky2.y * 0.55 * smoothstep(0.2, 0.42, elA);
      al = floor(al * 6.0 + bay(pix)) / 6.0;
      c += hue * al * (1.0 - clamp(dot(c, vec3(0.33)) * 1.5, 0.0, 0.8));
    }
  }
  // the moon: a crisp disc with the calendar's phase, a few grey seas, a halo
  float occl = 1.0;
  vec3 md = normalize(uL21MoonD.xyz);
  if (md.z > -0.05) {
    float dm = acos(clamp(dot(dir, md), -1.0, 1.0));
    float R = 0.04;
    float halo = exp(-pow(dm / 0.18, 2.0)) * 0.12 * (0.4 + 0.6 * uL21MoonD.w);
    c += vec3(0.55, 0.6, 0.78) * halo * smoothstep(-0.02, 0.1, md.z) * (1.0 - uL21Sky2.z);
    if (dm < R) {
      vec3 rt = normalize(cross(md, vec3(0.0, 0.0, 1.0))); vec3 upv = cross(rt, md);
      vec2 q = vec2(dot(dir - md, rt), dot(dir - md, upv)) / R;   // -1..1 across the disc
      q = floor(q * 9.0) / 9.0;                                     // pixel art: the disc is drawn on a coarse grid
      float lit = 1.0;
      float ill = uL21MoonD.w;
      // the terminator: an ellipse across the disc; the lit side faces the sun's side of the sky
      float xt = (1.0 - 2.0 * ill);
      float x = q.x * sign(dot(uL21SunD.xyz - md, rt) + 1e-4);
      float edge = xt * sqrt(max(0.0, 1.0 - q.y * q.y));
      lit = x > edge ? 1.0 : 0.08;
      float sea = n21(q * 2.3 + 4.0) > 0.62 ? 0.78 : 1.0;
      vec3 mc = vec3(0.95, 0.94, 0.86) * sea * lit;
      c = mix(c, mc * 1.25, smoothstep(1.0, 0.96, length(q)) * smoothstep(-0.03, 0.05, md.z));
      glowFlag = max(glowFlag, lit > 0.5 ? 0.5 : 0.0);
    }
  }
  // the sun's disc (HDR: it blooms and casts the shafts)
  vec3 sd = normalize(uL21SunD.xyz);
  float ds = acos(clamp(dot(dir, sd), -1.0, 1.0));
  float sunDisc = 0.0;
  if (sd.z > -0.05 && ds < 0.032) { sunDisc = 1.0; c = mix(c, vec3(1.0, 0.97, 0.9) * (1.4 + 3.0 * uL21SunD.w * (1.0 - uL21Ecl.x * 0.9)), smoothstep(0.032, 0.026, ds)); glowFlag = 1.0; }
  // the eclipse: the moon slides over the sun from one side and out the other; a pale corona at its height
  if (uL21Ecl.x > 0.01 && sd.z > 0.0 && ds < 0.15) {
    vec3 rt = normalize(cross(sd, vec3(0.0, 0.0, 1.0))), upv = cross(rt, sd);
    vec3 mc = normalize(sd + rt * uL21Ecl.y * (1.0 - uL21Ecl.x) * 2.6 * 0.03 + upv * (1.0 - uL21Ecl.x) * 0.03 * 0.3 * uL21Ecl.y);
    float rm = acos(clamp(dot(dir, mc), -1.0, 1.0)) / 0.03, rs = ds / 0.03;
    if (rs < 3.4) c *= 1.0 - uL21Ecl.x * 0.55 * exp(-rs * rs / 5.0);
    if (rm <= 1.02) { c *= 0.06; glowFlag = 0.0; }
    else if (rm < 2.3 && uL21Ecl.x > 0.55) c += vec3(0.8, 0.82, 0.96) * (uL21Ecl.x - 0.55) / 0.45 * 0.5 * exp(-pow((rm - 1.0) / 0.5, 2.0)) * (1.0 + 0.08 * sin(uL21Ecl.z * 1.7 + rm * 5.0));
  }
  // the Drift-Kestrel crossing the sky (js/sky.js's flight schedule and hand-drawn ship), one art pixel per logical pixel
  if (uL21Ship.z > 0.01) {
    float da = mod(az - uL21Ship.x + 3.14159265, 6.2831853) - 3.14159265;
    vec2 q = vec2(da * ${FX.toFixed(3)} / sqrt(1.0 + te * te) + uL21ShipS.x * 0.5, (uL21Ship.y - te) * ${FX.toFixed(3)} + uL21ShipS.y * 0.5);
    if (q.x >= 0.0 && q.y >= 0.0 && q.x < uL21ShipS.x && q.y < uL21ShipS.y) {
      vec2 tq = vec2(uL21Ship.w > 0.5 ? uL21ShipS.x - 1.0 - floor(q.x) : floor(q.x), floor(q.y));
      vec4 sc = texelFetch(uL21ShipT, ivec2(tq), 0);
      if (sc.a > 0.5) {
        bool lamp = sc.a < 0.9;
        vec3 shipC = lamp && uL21Sky2.x > 0.1 ? vec3(1.0, 0.72, 0.28) * 1.6 : sc.rgb * (0.3 + 0.7 * clamp(dot(uL21Hor, vec3(0.5)), 0.0, 1.0)) * 0.85;
        c = mix(c, shipC, uL21Ship.z);
        if (lamp && uL21Sky2.x > 0.1) glowFlag = 1.0;
      }
    }
  }
  // clouds: a low layer of heaps and a high layer of streaks on a plane overhead, drifting with the wind
  if (uL21Cl.w > 0.5 && dir.z > 0.0) {
    float cov = uL21Cl.x, tt = uL21T.x;
    vec2 wnd = vec2(cos(0.6), sin(0.6)) * (0.004 + 0.02 * uL21Cl.y) * tt;
    vec2 p = dir.xy / (dir.z + 0.08);
    // high streaks
    float hi = fbm(vec2(p.x * 0.9, p.y * 2.6) + wnd * 0.6 + 31.0);
    float hd = smoothstep(0.66 - cov * 0.2, 0.9 - cov * 0.2, hi) * (0.32 + 0.25 * cov);   // high streaks, some in every sky
    // low heaps (two samples: the second toward the sun gives their lit side)
    vec2 lp2 = p * 1.25 + wnd;
    float lo = fbm(lp2), lo2 = fbm(lp2 + sd.xy * 0.18);
    float ld = smoothstep(1.0 - cov * 0.82, 1.15 - cov * 0.6, lo + 0.25 * cov);
    float det = fbm(lp2 * 3.1 + 7.0);
    float lit2 = floor(clamp(0.55 + (lo - lo2) * 4.5 + (det - 0.5) * 0.6 - (1.0 - ld) * 0.25, 0.0, 1.0) * 4.0 + bay(pix) * 0.6) / 4.0;   // lit and shaded faces in bands
    float horizonFade = smoothstep(0.0, 0.12, dir.z);
    float dsun = max(0.0, dot(dir, sd));
    vec3 shadeC = mix(uL21Hor, uL21Zen, 0.45) * mix(0.72, 0.5, uL21Cl.z);
    vec3 litC = mix(uL21Hor * 1.08, uL21Glow * 0.9 + uL21Hor * 0.4, clamp(dot(uL21Glow, vec3(0.4)), 0.0, 1.0));
    vec3 cc = mix(shadeC, litC, lit2) + uL21Glow * pow(dsun, 8.0) * 0.6 * (1.0 - ld);   // silver lining toward the sun
    cc += vec3(0.85, 0.88, 1.0) * uL21Sky2.z * 0.9;                                       // lightning inside the cloud
    float al = clamp(ld + hd * (1.0 - ld), 0.0, 1.0) * horizonFade;
    al = al < 0.2 ? 0.0 : al < 0.3 ? (bay(pix) < (al - 0.2) * 10.0 ? 0.6 : 0.0) : floor(al * 3.0 + 0.5) / 3.0;   // solid bands inside, a one-step dithered rim
    c = mix(c, cc, al);
    occl = 1.0 - al;
    glowFlag *= occl;
  }
  // the painted country (js/sky.js) in front of the sky; farthest layer first, each mixed into the air
  if (uL21PanoN > 0 && te >= 0.0) {
    int row = int(floor(te * ${FX.toFixed(3)}));
    if (row < 56) {
      int col = int(floor((az / 6.2831853 + 0.5) * float(uL21PanoAW))) % uL21PanoAW;
      for (int l = 0; l < 16; l++) {
        if (l >= uL21PanoN) break;
        uint slot = texelFetch(uL21Pano, ivec3(col, row, l), 0).r;
        if (slot == 0u) continue;
        vec4 pc = texelFetch(uL21Pal, ivec2(int(slot), l), 0);
        if (pc.a < 0.5) continue;
        float v = (float(row) + 0.5) / 18.0;
        float mx = clamp(uL21PanoK[l].x + uL21PanoG.y + max(0.0, 1.0 - v) * 0.2 - min(1.0, v) * 0.04, 0.0, 0.96);
        vec3 col3 = pc.rgb * uL21PanoAir.w;
        float glow = 0.0;
        if (slot == 8u && uL21PanoG.x > 0.0) { col3 = mix(col3, vec3(1.0, 0.7, 0.28) * 1.6, uL21PanoG.x); mx *= 1.0 - uL21PanoG.x * 0.8; glow = uL21PanoG.x; }
        c = mix(col3, uL21PanoAir.rgb, mx);
        glowFlag = glow;
      }
    }
  } else if (uL21LmOn == 1 && te >= 0.0) {
    vec4 lm = r3dLandmarks(az, te); if (lm.a > 0.5) { c = lm.rgb; glowFlag = 0.0; }
  }
  oSky = vec4(max(c, vec3(0.0)), glowFlag);
}`;
  // the low-resolution sky laid into the scene target, nearest; the material is sky, the alpha is the glow flag
  const SKYBLIT_FS = `
uniform sampler2D uL21SkyTex;
in vec2 vNdc;
layout(location=0) out vec4 oColor; layout(location=1) out vec4 oAux;
void main() {
  vec4 s = texture(uL21SkyTex, vNdc * 0.5 + 0.5);
  if (uLit.w < 0.5) { oColor = vec4(uFog.rgb, 1.0); oAux = vec4(0.0, 0.0, 0.0, 1.0); return; }
  oColor = vec4(s.rgb, 1.0); oAux = vec4(1.0 / 255.0, s.a, 0.0, 1.0);
}`;
  // post: bright pass (emissives and HDR highlights), the downsample/upsample chain, the shafts, the composite
  const BRIGHT_FS = `
uniform sampler2D uSrc; uniform sampler2D uAux; uniform vec2 uTexel; uniform vec4 uK;   // uK: x threshold, y emissive gain, z hdr gain
in vec2 vNdc; out vec4 oOut;
void main() {
  vec2 uv = vNdc * 0.5 + 0.5;
  vec3 s = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 q = uv + (vec2(float(i), float(j)) - 0.5) * uTexel;
    vec3 c = texture(uSrc, q).rgb; vec4 a = texture(uAux, q);
    float m = floor(a.r * 255.0 + 0.5);
    float em = max(a.g, m == 8.0 ? 1.0 : 0.0);
    vec3 e = max(c - vec3(uK.x), vec3(0.0)) * uK.z;                 // what is above 1.0 (the sun, glitter, glows)
    // emissives bloom in their own colour: the hue of the pixel, its strength capped, so glass glows cyan, not white
    float l = max(c.r, max(c.g, c.b));
    vec3 hue = c / max(l, 1e-3);
    s += min(e, vec3(0.8)) + hue * min(l * em * uK.y * smoothstep(0.42, 0.95, l), 0.55);
  }
  oOut = vec4(s * 0.25, 1.0);
}`;
  const DOWN_FS = `
uniform sampler2D uSrc; uniform vec2 uTexel;
in vec2 vNdc; out vec4 oOut;
void main() { vec2 uv = vNdc * 0.5 + 0.5;
  vec3 s = texture(uSrc, uv).rgb * 4.0 + texture(uSrc, uv + uTexel * vec2(-1, -1)).rgb + texture(uSrc, uv + uTexel * vec2(1, -1)).rgb + texture(uSrc, uv + uTexel * vec2(-1, 1)).rgb + texture(uSrc, uv + uTexel * vec2(1, 1)).rgb;
  oOut = vec4(s / 8.0, 1.0); }`;
  const UP_FS = `
uniform sampler2D uSrc; uniform sampler2D uAdd; uniform vec2 uTexel; uniform float uMix;
in vec2 vNdc; out vec4 oOut;
void main() { vec2 uv = vNdc * 0.5 + 0.5; vec2 t = uTexel;
  vec3 s = texture(uSrc, uv + vec2(-t.x * 2.0, 0.0)).rgb + texture(uSrc, uv + vec2(t.x * 2.0, 0.0)).rgb + texture(uSrc, uv + vec2(0.0, -t.y * 2.0)).rgb + texture(uSrc, uv + vec2(0.0, t.y * 2.0)).rgb
    + (texture(uSrc, uv + vec2(-t.x, t.y)).rgb + texture(uSrc, uv + vec2(t.x, t.y)).rgb + texture(uSrc, uv + vec2(-t.x, -t.y)).rgb + texture(uSrc, uv + vec2(t.x, -t.y)).rgb) * 2.0;
  oOut = vec4(s / 12.0 + texture(uAdd, uv).rgb * uMix, 1.0); }`;
  // shafts: the sky's brightness near the sun, smeared toward the sun's place on screen (occluded where geometry stands)
  const SHAFT_MASK_FS = `
uniform sampler2D uSrc; uniform sampler2D uDepth; uniform vec2 uSun;   // sun in uv
in vec2 vNdc; out vec4 oOut;
void main() { vec2 uv = vNdc * 0.5 + 0.5;
  float d = texture(uDepth, uv).r;
  vec3 c = texture(uSrc, uv).rgb;
  float sky = d >= 0.99999 ? 1.0 : 0.0;
  float near = exp(-pow(length((uv - uSun) * vec2(1.6, 1.0)) / 0.35, 2.0));
  oOut = vec4(max(c - vec3(0.55), vec3(0.0)) * sky * (0.3 + near), 1.0); }`;
  const SHAFT_FS = `
uniform sampler2D uSrc; uniform vec2 uSun; uniform float uStep; uniform float uDecay;
in vec2 vNdc; out vec4 oOut;
void main() { vec2 uv = vNdc * 0.5 + 0.5; vec2 dl = (uSun - uv) * uStep; vec3 s = vec3(0.0); float w = 1.0; vec2 p = uv;
  for (int i = 0; i < 20; i++) { s += texture(uSrc, p).rgb * w; w *= uDecay; p += dl; }
  oOut = vec4(s / 20.0 * 2.2, 1.0); }`;
  const COMP_FS = `
uniform sampler2D uScene; uniform sampler2D uBloom; uniform sampler2D uShaft; uniform sampler2D uLut; uniform sampler2D uAux;
uniform vec4 uC1;   // x bloom gain, y shaft gain, z grade on, w saturation (area grade)
uniform vec4 uC2;   // x cinematic grade on, y contrast, z saturation, w vignette
uniform vec4 uC3;   // x underwater, y exposure, z bloom on, w shafts on
uniform vec3 uShaftC;
uniform vec4 uWx2;   // x rain, y snow, z time, w wind
uniform float uWinG;   // WINTER17's cold grade (0..1)
uniform vec3 uWxC;   // the colour of falling rain and snow (the air's light)
uniform highp sampler2D uWxRoof; uniform vec4 uWxMap;   // where the rain stops (js/eaves78.js): heights over the map, x texels per cell, z on
uniform sampler2D uAuxT; uniform float uSSR;   // the material target; water reflections on (GFX.reflections)
uniform vec4 uDread;   // the Dread's shadow at the edge of sight (js/dread.js): x centre (uv), y top (uv from the top), z height (uv), w strength
uniform sampler2D uDepth; uniform vec4 uHalo[16]; uniform vec4 uHaloC[16]; uniform int uHaloN; uniform float uAspect;
in vec2 vNdc; out vec4 oOut;
// the glow round each lamp in the air (the raycaster's lamp halos): a soft disc on screen, hidden when a wall stands in front
vec3 halos(vec2 uv) {
  vec3 s = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    if (i >= uHaloN) break;
    vec4 h = uHalo[i];
    vec2 d = (uv - h.xy) * vec2(uAspect, 1.0);
    float r2 = dot(d, d) / (h.z * h.z);
    if (r2 > 1.0) continue;
    float zc = r3dLinearDepth(texture(uDepth, h.xy).r);
    float vis = zc > h.w - 0.35 ? 1.0 : 0.0;
    float zp = r3dLinearDepth(texture(uDepth, uv).r);
    float front = zp < h.w - 0.6 ? 0.25 : 1.0;   // a figure or post in front of the lamp keeps most of its own colour
    float k = (1.0 - r2); k = k * k * k;
    s += uHaloC[i].rgb * k * vis * front;
  }
  return s;
}
vec3 shoulder(vec3 c) { vec3 k = vec3(0.78); vec3 over = max(c - k, vec3(0.0)); return min(c, k) + (1.0 - exp(-over / (1.0 - k) * 1.0)) * (1.0 - k); }
float wh(float a, float b) { return fract(sin(a * 127.1 + b * 311.7) * 43758.5453); }
// rain and snow in the scene: three layers at increasing distance, each hidden behind anything nearer than it, drawn on
// the game's logical pixel grid; turning the view moves them with the world
float weather(vec2 uv, float zScene) {
  vec2 lp = floor(vec2(uv.x * 320.0 + uCam.w * 242.42, (1.0 - uv.y) * 150.0));
  float a = 0.0;
  // under a roof it does not fall: each layer's drop is placed in the world and looked up in the roof heights
  bool roofs = uWxMap.z > 0.5; vec3 wd = vec3(0.0); float wk = 1.0; ivec2 ws = ivec2(1);
  if (roofs) { vec2 nd = uv * 2.0 - 1.0; vec4 pa = uInvViewProj * vec4(nd, 1.0, 1.0), pb = uInvViewProj * vec4(nd, -1.0, 1.0); wd = normalize(pa.xyz / pa.w - pb.xyz / pb.w); wk = 1.0 / max(0.05, dot(wd, uFwd.xyz)); ws = textureSize(uWxRoof, 0); }
  for (int i = 0; i < 3; i++) {
    float fi = float(i), dist = 0.9 + fi * 1.7;
    if (zScene < dist) continue;
    if (roofs) { vec3 wp = uEye.xyz + wd * (dist * wk); ivec2 tc = ivec2(floor(wp.xy * uWxMap.x)); if (tc.x >= 0 && tc.y >= 0 && tc.x < ws.x && tc.y < ws.y && wp.z < texelFetch(uWxRoof, tc, 0).r) continue; }
    float near = 1.0 / (1.0 + fi);
    if (uWx2.x > 0.01) {
      float cw = 5.0 + fi * 4.0, len = 9.0 * near + 3.0;
      vec2 p = lp; p.x += p.y * (0.18 + uWx2.w * 0.35);
      float col = floor(p.x / cw), h = wh(col, fi + 1.0);
      if (h < 0.55 * uWx2.x && floor(mod(p.x, cw)) == floor(cw * 0.5)) {
        float y = mod(p.y - uWx2.z * (260.0 * near + 120.0) + h * 997.0, 70.0 + fi * 25.0);
        if (y < len) a = max(a, (0.42 - fi * 0.1) * (1.0 - y / len * 0.6));
      }
    }
    if (uWx2.y > 0.01) {
      float cs = 10.0 + fi * 7.0;
      vec2 c = floor(lp / cs), h2 = vec2(wh(c.x, c.y + fi * 7.0), wh(c.y, c.x + fi * 3.0));
      if (h2.x < 0.3 * uWx2.y) {
        float t = uWx2.z * (0.35 * near + 0.15);
        vec2 f = vec2(fract(h2.x * 7.0 + sin(t * 3.0 + h2.y * 6.0) * 0.12 + t * 0.2 * uWx2.w), fract(h2.y + t));
        vec2 q = floor(f * cs);
        vec2 me = lp - c * cs;
        float sz = 1.0;
        if (me.x >= q.x && me.x < q.x + sz && me.y >= q.y && me.y < q.y + sz) a = max(a, 0.62 - fi * 0.16);
      }
    }
  }
  // looking up into the fall, the streaks would cross the sky sideways: they thin out as the view tips up
  return a * (1.0 - 0.8 * smoothstep(0.55, 1.05, uFwd.w));
}
// js/dread.js's figure, the same outline in screen space: head, neck, shoulders, a body that fades at the feet
float dread(vec2 uv) {
  float t = ((1.0 - uv.y) - uDread.y) / uDread.z; if (t < 0.0 || t > 1.0) return 0.0;
  float half_;
  if (t < 0.15) half_ = 0.02 * sqrt(max(0.0, 1.0 - pow((t - 0.075) / 0.075, 2.0)));
  else if (t < 0.2) half_ = 0.009; else if (t < 0.3) half_ = 0.02 + (t - 0.2) * 0.25; else half_ = 0.045 - (t - 0.3) * 0.02;
  half_ *= 2.0;   // the CPU's widths are fractions of the half width
  float dx = abs(uv.x - uDread.x) * 2.0; if (dx > half_ || half_ <= 0.0) return 0.0;
  float fadeB = t > 0.82 ? 1.0 - (t - 0.82) / 0.18 : 1.0;
  return uDread.w * fadeB * min(1.0, (1.0 - dx / half_) * 2.4);
}
// water mirrors what stands above its waterline in the same column (as js/water.js does on the CPU): march up the screen
// to the first pixel that is not water, and read as far above it as this pixel is below; the ripples bend it a little
vec3 waterRefl(vec2 uv, float mat, inout float k) {
  float st = 2.0 / 150.0, yb = -1.0;
  for (int i = 1; i <= 48; i++) {
    float y = uv.y + float(i) * st; if (y >= 1.0) break;
    float m = floor(texture(uAuxT, vec2(uv.x, y)).r * 255.0 + 0.5);
    if (m != 2.0 && m != 3.0) { yb = y; break; }
  }
  if (yb < 0.0) { k = 0.0; return vec3(0.0); }
  for (int j = 0; j < 2; j++) { float y = yb - st * 0.5; float m = floor(texture(uAuxT, vec2(uv.x, y)).r * 255.0 + 0.5); if (m != 2.0 && m != 3.0) yb = y; st *= 0.5; }
  float yr = yb + (yb - uv.y);
  float wob = sin(uv.y * 420.0 + uEye.w * 3.1) * 0.0025 + sin(uv.y * 170.0 - uEye.w * 1.7) * 0.0015;
  k = (mat == 2.0 ? 0.8 : 0.58) * (1.0 - smoothstep(0.85, 1.0, yr)) * clamp((yb - uv.y) * 12.0, 0.0, 1.0);
  return texture(uScene, vec2(uv.x + wob, min(yr, 0.998))).rgb * vec3(0.78, 0.88, 0.92);
}
void main() {
  vec2 uv = vNdc * 0.5 + 0.5;
  vec3 c = texture(uScene, uv).rgb * uC3.y;
  if (uSSR > 0.5) {
    float mat = floor(texture(uAuxT, uv).r * 255.0 + 0.5);
    if (mat == 2.0 || mat == 3.0) { float k = 0.0; vec3 r = waterRefl(uv, mat, k); c = mix(c, r, k * 0.75); }
  }
  if (uC3.z > 0.5) { vec3 b = texture(uBloom, uv).rgb * uC1.x; c += b * clamp(1.0 - c * 0.7, 0.15, 1.0); }
  if (uC3.w > 0.5) c += texture(uShaft, uv).rgb * uShaftC * uC1.y;
  if (uHaloN > 0) { vec3 hl = halos(uv); c += hl * clamp(1.0 - c * 0.8, 0.1, 1.0); }
  if (uWx2.x + uWx2.y > 0.01) { float zs = r3dLinearDepth(texture(uDepth, uv).r); float w = weather(uv, zs); c = mix(c, uWxC, w); }
  if (uC3.x > 0.5) { float l = dot(c, vec3(0.3, 0.59, 0.11)); c = mix(c, vec3(0.1, 0.32, 0.36) * (0.4 + l * 1.4), 0.55); }
  if (uDread.w > 0.0) c = mix(c, vec3(8.0, 6.0, 14.0) / 255.0, dread(uv));
  c = shoulder(c);
  if (uWinG > 0.0) { float L = dot(c, vec3(0.3, 0.59, 0.11)); c = mix(c, vec3(L), 0.26 * uWinG); c.r *= 1.0 - 0.06 * uWinG; c.b += (1.0 - c.b) * L * 0.07 * uWinG + L * 6.0 / 255.0 * uWinG; }
  if (uC1.z > 0.5) {
    ivec3 q = ivec3(clamp(c, 0.0, 1.0) * 255.0 + 0.5);
    c = vec3(texelFetch(uLut, ivec2(q.r, 0), 0).r, texelFetch(uLut, ivec2(q.g, 0), 0).g, texelFetch(uLut, ivec2(q.b, 0), 0).b);
    float l = dot(c, vec3(0.30, 0.59, 0.11)); c = mix(vec3(l), c, uC1.w);
  }
  if (uC2.x > 0.5) { c = (c - 0.5) * uC2.y + 0.5; float l = dot(c, vec3(0.30, 0.59, 0.11)); c = mix(vec3(l), c, uC2.z); }
  vec2 dv = uv - 0.5; float r = dot(dv, dv) / 0.5;
  c *= 1.0 - uC2.w * pow(r, 1.1);
  c += (float(r3dBayer(ivec2(gl_FragCoord.xy))) / 16.0 - 0.47) / 255.0;
  oOut = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

  // ------------------------------------------------------------------------------------------------ GL state
  const S = { progs: null, vao: null, skyTex: null, skyFb: null, skyW: 0, skyH: 0, rt: {}, lutTex: null, w: 0, h: 0, gl: null };
  function mkTex(gl, w, h, hdr, filter) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    const fl = R3D.st.floatRT && hdr;
    gl.texStorage2D(gl.TEXTURE_2D, 1, fl ? gl.RGBA16F : gl.RGBA8, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter || gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter || gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function mkTarget(gl, w, h, hdr, filter) {
    const tex = mkTex(gl, w, h, hdr, filter), fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb, w, h };
  }
  function freeTarget(gl, t) { if (t) { try { gl.deleteFramebuffer(t.fb); gl.deleteTexture(t.tex); } catch (e) { /* lost */ } } }
  function programs() {
    if (S.progs) return S.progs;
    const pr = {};
    pr.sky = R3D.program(TRI, SKY_FS, { chunks: ['common', 'shade', 'landmarks'] });
    pr.blit = R3D.program(TRI, SKYBLIT_FS, { chunks: ['common'] });
    pr.bright = R3D.program(TRI, BRIGHT_FS, { chunks: ['common'] });
    pr.down = R3D.program(TRI, DOWN_FS, { chunks: ['common'] });
    pr.up = R3D.program(TRI, UP_FS, { chunks: ['common'] });
    pr.mask = R3D.program(TRI, SHAFT_MASK_FS, { chunks: ['common'] });
    pr.shaft = R3D.program(TRI, SHAFT_FS, { chunks: ['common'] });
    pr.comp = R3D.program(TRI, COMP_FS, { chunks: ['common'] });
    S.progs = pr;
    return pr;
  }
  function initGL(gl) {
    S.gl = gl;
    S.vao = gl.createVertexArray();
    S.skyTex = null; S.skyFb = null; S.skyW = S.skyH = 0; S.rt = {}; S.lutTex = null; S.w = S.h = 0;
    hgt.tex = null; hgt.map = null; hgt.sig = ''; hgt.ok = false; hgt.w = hgt.h = 0; shel.tex = null; shel.none = null; shel.src = null; shel.w = shel.h = 0;
    pano.tex = null; pano.pal = null; pano.key = ''; pano.ok = false; pano.n = 0;
    ship.tex = null; smap.tex = null; smap.fb = null;
    programs();
  }
  function tri(gl) { gl.bindVertexArray(S.vao); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null); }
  function tex(gl, unit, t, pr, name) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); if (pr.u[name]) gl.uniform1i(pr.u[name], unit); }

  // per-map resources, checked each frame (cheap: a signature every half second)
  let sigT = 0;
  function mapResources(gl, F) {
    const m = F.map; if (!m) return;
    if (hgt.map !== m || !hgt.ok) { buildHeights(gl, m); hgt.sig = heightSig(m); sigT = F.now; }
    else if (F.now - sigT > 0.5) { sigT = F.now; const s = heightSig(m); if (s !== hgt.sig) { hgt.sig = s; buildHeights(gl, m); } }
    const key = m.outdoor ? m.id + '|' + (typeof GFX !== 'undefined' && GFX.panoramas ? 1 : 0) : '';
    if (key !== pano.key) { pano.key = key; if (m.outdoor) buildPano(gl, m); else { pano.ok = false; pano.n = 0; } }
  }

  // ------------------------------------------------------------------------------------------------ figure shadows
  // js/sprites21.js draws this frame's billboards, each turned square to the light, depth-only into a sun-view map
  // (an orthographic box of 2 x SR cells around the view, in map space with z in game units); the shade chunk samples it
  // on the ground and walls, so people, beasts and props cast their own sun and moon shadows.
  const SR = 13, SMAP = 1024;
  const smap = { tex: null, fb: null, on: false, vp: new Float32Array(16) };
  function lightVP(F) {
    const L = P.sun, lz = L[2] / ZK, n = Math.hypot(L[0], L[1], lz), d = [L[0] / n, L[1] / n, lz / n];
    const c = [F.cam.x + Math.cos(F.cam.dir) * SR * 0.55, F.cam.y + Math.sin(F.cam.dir) * SR * 0.55, 0.5];
    const e = [c[0] + d[0] * 40, c[1] + d[1] * 40, c[2] + d[2] * 40];
    let up = Math.abs(d[2]) > 0.98 ? [1, 0, 0] : [0, 0, 1];
    // view basis: f toward the target, r = f x up, u = r x f
    const f = [-d[0], -d[1], -d[2]];
    let r = [f[1] * up[2] - f[2] * up[1], f[2] * up[0] - f[0] * up[2], f[0] * up[1] - f[1] * up[0]]; const rl = Math.hypot(r[0], r[1], r[2]) || 1; r = r.map(v => v / rl);
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const near = 1, far = 90, k = 1 / SR, A = -2 / (far - near), B = -(far + near) / (far - near);
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const m = smap.vp;   // column-major: rows (k r, k u, A(-f)), translation from the eye
    m[0] = k * r[0]; m[4] = k * r[1]; m[8] = k * r[2]; m[12] = -k * dot(r, e);
    m[1] = k * u[0]; m[5] = k * u[1]; m[9] = k * u[2]; m[13] = -k * dot(u, e);
    m[2] = -A * f[0]; m[6] = -A * f[1]; m[10] = -A * f[2]; m[14] = A * dot(f, e) + B;   // depth: distance along f, near -> -1
    m[3] = 0; m[7] = 0; m[11] = 0; m[15] = 1;
    return d;
  }
  const shadowPass = {
    name: 'l21-shadows', order: 5,
    init(gl) { smap.tex = null; smap.fb = null; },
    draw(gl, F) {
      smap.on = false;
      const S2 = typeof SPRITES21 !== 'undefined' ? SPRITES21 : null;
      if (!P.shadowOn || !S2 || !S2.drawCasters) return;
      if (!smap.tex) {
        smap.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, smap.tex);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, SMAP, SMAP);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        smap.fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, smap.fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, smap.tex, 0);
        gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
      }
      const d = lightVP(F);
      gl.bindFramebuffer(gl.FRAMEBUFFER, smap.fb); gl.viewport(0, 0, SMAP, SMAP);
      gl.depthMask(true); gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
      S2.drawCasters({ vp: smap.vp, dir: [d[0], d[1]] });
      smap.on = true;
    },
  };

  // ------------------------------------------------------------------------------------------------ the Kestrel
  // js/sky.js's flyover schedule (once a cycle over the Spectral Woods and the Deep Woods), drawn on the dome
  const ship = { tex: null, gl: null, w: 1, h: 1, az: 0, te: 0, a: 0, flip: 0 };
  function shipFrame(gl, F) {
    if (typeof SKY === 'undefined' || !SKY.ship || !SKY.flightAt || !F.outdoor || !flag('flyovers')) return false;
    if (!ship.tex || ship.gl !== gl) {
      const A = SKY.ship.art, PAL = SKY.ship.pal, w = A[0].length, h = A.length, d = new Uint8Array(w * h * 4);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const ch = A[j][i], c = PAL[ch]; if (!c) continue; const o = (j * w + i) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = ch === 'L' ? 200 : 255; }
      ship.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, ship.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      ship.gl = gl; ship.w = w; ship.h = h;
    }
    const FLY = SKY.FLY, id = F.map && F.map.id, t = (F.env && F.env.animT) || F.time || 0;
    const f = SKY.flightAt(t); if (!f) return false;
    if (!f.forced && !(FLY.maps && FLY.maps[id])) return false;
    const bearing = f.b0 + f.dir * (f.u - 0.5) * FLY.sweep, elev = 0.56 + 0.05 * Math.sin(f.u * Math.PI * 2 + (f.k > 0 ? f.k : 0));
    const fade = Math.min(1, f.u * FLY.dur, (1 - f.u) * FLY.dur), haze = (F.env && F.env.wx && F.env.wx.haze) || 0;
    ship.az = bearing; ship.te = elev * 75 / FX; ship.a = 0.8 * fade * clamp(1 - haze * 1.6, 0.15, 1); ship.flip = f.dir < 0 ? 1 : 0;
    return true;
  }

  // ------------------------------------------------------------------------------------------------ the sky pass
  const skyPass = {
    name: 'sky', order: 0,
    init(gl) { initGL(gl); },
    draw(gl, F) {
      const t0 = now();
      mapResources(gl, F);
      const pr = programs();
      // the logical-resolution target: 320 x 150 (2x on High and above)
      const k = (typeof GFX !== 'undefined' && GFX.scale === 2) ? 2 : 1;
      const sw = 320 * k, sh = Math.max(16, Math.round(150 * k * (F.h / Math.max(1, F.w)) * (320 / 150)));
      if (!S.skyFb || S.skyW !== sw || S.skyH !== sh) {
        if (S.skyFb) freeTarget(gl, { fb: S.skyFb, tex: S.skyTex });
        const t = mkTarget(gl, sw, sh, true, gl.NEAREST); S.skyTex = t.tex; S.skyFb = t.fb; S.skyW = sw; S.skyH = sh;
      }
      gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
      if (F.outdoor) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, S.skyFb); gl.viewport(0, 0, sw, sh);
        const p = R3D.use(pr.sky);
        const u = p.u;
        if (u.uL21Pano) { gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_2D_ARRAY, P.panoOn ? pano.tex : null); gl.uniform1i(u.uL21Pano, 8); }
        if (u.uL21Pal) { gl.activeTexture(gl.TEXTURE9); gl.bindTexture(gl.TEXTURE_2D, P.panoOn ? pano.pal : null); gl.uniform1i(u.uL21Pal, 9); }
        if (u.uL21PanoN) gl.uniform1i(u.uL21PanoN, P.panoOn ? pano.n : 0);
        if (u.uL21PanoAW) gl.uniform1i(u.uL21PanoAW, pano.AW);
        if (u.uL21PanoK) gl.uniform4fv(u.uL21PanoK, pano.mix);
        v4(gl, u.uL21PanoAir, P.panoAir[0], P.panoAir[1], P.panoAir[2], P.panoAir[3]);
        v4(gl, u.uL21PanoG, P.panoGlow, P.panoHaze, 0, 0);
        v4(gl, u.uL21Cl, P.cl[0], P.cl[1], P.cl[2], P.cl[3]);
        v4(gl, u.uL21Ecl, P.ecl[0], P.ecl[1], P.ecl[2], 0);
        const shipOn = shipFrame(gl, F);
        v4(gl, u.uL21Ship, ship.az, ship.te, shipOn ? ship.a : 0, ship.flip);
        if (u.uL21ShipT) { gl.activeTexture(gl.TEXTURE10); gl.bindTexture(gl.TEXTURE_2D, ship.tex); gl.uniform1i(u.uL21ShipT, 10); }
        if (u.uL21ShipS) gl.uniform2f(u.uL21ShipS, ship.w, ship.h);
        v4(gl, u.uL21Sky2, P.sky2[0], P.sky2[1], P.sky2[2], P.sky2[3]);
        if (u.uL21Aur) gl.uniform3fv(u.uL21Aur, new Float32Array([].concat(P.aur[0], P.aur[1], P.aur[2])));
        if (u.uL21Size) gl.uniform2f(u.uL21Size, sw, sh);
        if (u.uL21LmOn) gl.uniform1i(u.uL21LmOn, !P.panoOn ? 1 : 0);
        tri(gl);
      }
      R3D.bindScene(gl, F);
      const b = R3D.use(pr.blit);
      tex(gl, 6, S.skyTex, b, 'uL21SkyTex');
      tri(gl);
      stats.sky = now() - t0;
    },
  };

  // ------------------------------------------------------------------------------------------------ the post pass
  // js/post.js's grade, rebuilt exactly as js/gpu18.js does it (the same table), into a 256 x 1 RGBA8 texture
  const lutBuf = new Uint8Array(256 * 4);
  let gradeSat = 1, lutKey = '';
  function buildGrade(F) {
    if (typeof POST === 'undefined' || !POST.config) return false;
    const C = POST.config, g = C.gradePresets, map = F.map, env = F.env || {};
    const name = (map && C.grade[map.id]) || (F.outdoor ? C.grade._outdoor : C.grade._indoor);
    const p = g[name] || g.candle; if (!p) return false;
    const dk = F.outdoor ? clamp(env.skyDay == null ? 1 : env.skyDay, 0, 1) : 1, q = (dk * 32) | 0;
    const tod = F.tod == null ? 0.5 : F.tod;
    const warm = F.outdoor ? Math.exp(-Math.pow(tod - 0.76, 2) / 0.006) + Math.exp(-Math.pow(tod - 0.26, 2) / 0.006) : 0;
    const wq = (clamp(warm, 0, 1) * 8) | 0, kk = F.outdoor ? q / 32 : 1, wk = wq / 8;
    const key = name + '|' + q + '|' + wq;
    const mx = (a, b) => b + (a - b) * kk;
    gradeSat = mx(p.day.sat, p.night.sat) + 0.16 * wk;
    if (key === lutKey) return true;
    lutKey = key;
    const con = mx(p.day.con, p.night.con), dusk = C.dusk, sm = (x) => x * x * (3 - 2 * x);
    for (let ch = 0; ch < 3; ch++) {
      const gain = mx(p.day.gain[ch], p.night.gain[ch]) * (1 + (dusk[ch] - 1) * wk), lift = mx(p.day.lift[ch], p.night.lift[ch]), keep = p.keep || 0;
      for (let v = 0; v < 256; v++) {
        let u = v / 255; u = u * (1 - con) + sm(u) * con;
        const ge = keep && gain < 1 ? gain + (1 - gain) * keep * u * u * u : gain;
        lutBuf[v * 4 + ch] = clamp(u * ge * 255 + lift * (1 - u), 0, 255) | 0;
      }
    }
    for (let v = 0; v < 256; v++) lutBuf[v * 4 + 3] = 255;
    S.lutDirty = true;
    return true;
  }
  const sunUV = [0.5, 0.5];
  function sunOnScreen(F) {
    const d = P.sunD, m = F.viewProj; if (!m) return false;
    const x = d[0] * 1000, y = d[1] * 1000, z = d[2] * 1000;   // a point far along the sun's direction (w=0 is fine: direction)
    const cx = m[0] * x + m[4] * y + m[8] * z, cy = m[1] * x + m[5] * y + m[9] * z, cw = m[3] * x + m[7] * y + m[11] * z;
    if (cw <= 0.0001) return false;
    sunUV[0] = (cx / cw) * 0.5 + 0.5; sunUV[1] = (cy / cw) * 0.5 + 0.5;
    return sunUV[0] > -0.1 && sunUV[0] < 1.1 && sunUV[1] > -0.05 && sunUV[1] < 1.1;   // shafts only from a sun in (or just at the edge of) the view
  }
  function ensurePost(gl, w, h) {
    if (S.w === w && S.h === h && S.rt.h1) return;
    for (const k in S.rt) freeTarget(gl, S.rt[k]);
    S.rt = {};
    const W = (d) => Math.max(1, Math.round(w / d)), H = (d) => Math.max(1, Math.round(h / d));
    S.rt.h1 = mkTarget(gl, W(2), H(2), true); S.rt.q1 = mkTarget(gl, W(4), H(4), true); S.rt.e1 = mkTarget(gl, W(8), H(8), true); S.rt.x1 = mkTarget(gl, W(16), H(16), true);
    S.rt.e2 = mkTarget(gl, W(8), H(8), true); S.rt.q2 = mkTarget(gl, W(4), H(4), true); S.rt.h2 = mkTarget(gl, W(2), H(2), true);
    S.rt.sm = mkTarget(gl, W(4), H(4), true); S.rt.s1 = mkTarget(gl, W(4), H(4), true); S.rt.s2 = mkTarget(gl, W(4), H(4), true);
    S.w = w; S.h = h;
  }
  // lamp halos: the engine's point lights projected to the screen (the player's own lantern and lights behind the eye
  // are left out), strongest first
  const haloP = new Float32Array(64), haloC = new Float32Array(64);
  function halosFor(F) {
    const env = F.env || {}, Ls = env.ptLights || [], m = F.viewProj; let n = 0;
    if (!m || !(flag('bloom') || flag('cineLight'))) return 0;
    const night = F.outdoor ? 0.08 + 0.92 * P.night : 1, cam = F.cam, hz = 0.62 * ZK, aspect = F.w / Math.max(1, F.h);
    const list = [];
    for (const L of Ls) {
      if (L == null || L.x == null) continue;
      const dx = L.x - cam.x, dy = L.y - cam.y; if (dx * dx + dy * dy < 0.5) continue;
      const x = L.x, y = L.y, z = hz;
      const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (cw < 0.3) continue;
      const u = cx / cw * 0.5 + 0.5, v = cy / cw * 0.5 + 0.5; if (u < -0.2 || u > 1.2 || v < -0.2 || v > 1.2) continue;
      const str = ((L.cr || 0) + (L.cg || 0) + (L.cb || 0)) / 255; if (str < 0.05) continue;
      list.push({ u, v, d: cw, L, str });
    }
    list.sort((a, b) => b.str / b.d - a.str / a.d);
    for (const h of list) {
      if (n >= 16) break;
      const r = Math.min(0.18, 0.26 * Math.min(2.2, h.L.r || 2) / h.d * 0.5), k = 0.55 * night / (1 + h.d * 0.08);
      haloP.set([h.u, h.v, r, h.d], n * 4); haloC.set([(h.L.cr || 0) / 255 * k, (h.L.cg || 0) / 255 * k, (h.L.cb || 0) / 255 * k, 0], n * 4);
      n++;
    }
    return n;
  }
  function into(gl, t) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.viewport(0, 0, t.w, t.h); }
  const postPass = {
    name: 'post', order: 90,
    init(gl) { if (S.gl !== gl) initGL(gl); },
    resize(w, h) { /* targets follow the scene's size in draw */ },
    draw(gl, F) {
      const t0 = now();
      const pr = programs(), sc = F.targets.scene;
      ensurePost(gl, sc.w, sc.h);
      gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
      const bloomOn = flag('bloom') || flag('cineLight');
      const shaftOn = F.outdoor && (flag('sunShafts') || flag('cineLight')) && P.sunVis > 0.05 && sunOnScreen(F);
      stats.bloom = bloomOn; stats.shafts = shaftOn;
      if (bloomOn) {
        let p = R3D.use(pr.bright);
        into(gl, S.rt.h1); tex(gl, 6, sc.color, p, 'uSrc'); tex(gl, 7, sc.aux, p, 'uAux');
        gl.uniform2f(p.u.uTexel, 1 / sc.w, 1 / sc.h); gl.uniform4f(p.u.uK, 1.0, flag('cineLight') ? 2.0 : 1.6, 0.8, 0);
        tri(gl);
        p = R3D.use(pr.down);
        for (const [a, b] of [['h1', 'q1'], ['q1', 'e1']]) { into(gl, S.rt[b]); tex(gl, 6, S.rt[a].tex, p, 'uSrc'); gl.uniform2f(p.u.uTexel, 1 / S.rt[a].w, 1 / S.rt[a].h); tri(gl); }
        p = R3D.use(pr.up);
        for (const [src, add, dst] of [['e1', 'q1', 'q2'], ['q2', 'h1', 'h2']]) {
          into(gl, S.rt[dst]); tex(gl, 6, S.rt[src].tex, p, 'uSrc'); tex(gl, 7, S.rt[add].tex, p, 'uAdd');
          gl.uniform2f(p.u.uTexel, 1 / S.rt[src].w, 1 / S.rt[src].h); gl.uniform1f(p.u.uMix, 1.0); tri(gl);
        }
      }
      if (shaftOn) {
        let p = R3D.use(pr.mask);
        into(gl, S.rt.sm); tex(gl, 6, sc.color, p, 'uSrc'); tex(gl, 7, sc.depthTex, p, 'uDepth'); gl.uniform2f(p.u.uSun, sunUV[0], sunUV[1]); tri(gl);
        p = R3D.use(pr.shaft);
        into(gl, S.rt.s1); tex(gl, 6, S.rt.sm.tex, p, 'uSrc'); gl.uniform2f(p.u.uSun, sunUV[0], sunUV[1]); gl.uniform1f(p.u.uStep, 0.045); gl.uniform1f(p.u.uDecay, 0.93); tri(gl);
        into(gl, S.rt.s2); tex(gl, 6, S.rt.s1.tex, p, 'uSrc'); gl.uniform1f(p.u.uStep, 0.018); gl.uniform1f(p.u.uDecay, 0.96); tri(gl);
      }
      // the grade table
      const gradeOn = flag('grade') && buildGrade(F);
      stats.grade = gradeOn;
      if (!S.lutTex) { S.lutTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, S.lutTex); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 256, 1); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); S.lutDirty = true; }
      if (S.lutDirty) { gl.bindTexture(gl.TEXTURE_2D, S.lutTex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RGBA, gl.UNSIGNED_BYTE, lutBuf); S.lutDirty = false; }
      R3D.bindOutput(gl, F);
      const p = R3D.use(pr.comp);
      tex(gl, 6, sc.color, p, 'uScene'); tex(gl, 7, bloomOn ? S.rt.h2.tex : S.rt.h1.tex, p, 'uBloom'); tex(gl, 8, S.rt.s2.tex, p, 'uShaft'); tex(gl, 9, S.lutTex, p, 'uLut');
      const cine = flag('cineGrade') && !(typeof document !== 'undefined' && document.documentElement.classList.contains('ac-hc'));
      const CG = typeof CINEMA14 !== 'undefined' && CINEMA14.T && CINEMA14.T.grade ? CINEMA14.T.grade : { sat: 1.12, con: 1.08 };
      gl.uniform4f(p.u.uC1, flag('cineLight') ? 0.95 : 0.75, 0.32 * P.sunVis, gradeOn ? 1 : 0, gradeSat * 1.06);
      gl.uniform4f(p.u.uC2, cine ? 1 : 0, CG.con, CG.sat, cine ? 0.2 : 0.08);
      gl.uniform4f(p.u.uC3, P.underwater, 1.0, bloomOn ? 1 : 0, shaftOn ? 1 : 0);
      const hn = halosFor(F);
      tex(gl, 10, sc.depthTex, p, 'uDepth');
      tex(gl, 11, sc.aux, p, 'uAuxT');
      if (p.u.uSSR) gl.uniform1f(p.u.uSSR, flag('reflections') ? 1 : 0);
      if (p.u.uHaloN) gl.uniform1i(p.u.uHaloN, hn);
      if (hn && p.u.uHalo) { gl.uniform4fv(p.u.uHalo, haloP); gl.uniform4fv(p.u.uHaloC, haloC); }
      if (p.u.uAspect) gl.uniform1f(p.u.uAspect, sc.w / Math.max(1, sc.h));
      stats.halos = hn;
      let dr = [0, 0, 0, 0];
      try {
        const D = typeof DREAD !== 'undefined' ? DREAD : null, sh = D && D.st && D.st.shadow;
        if (sh && D.shadowF && D.SH) {
          const f = D.shadowF(sh, F.cam.dir), af = Math.abs(f);
          if (af >= D.SH.minF && af <= 1.18 && sh.a > 0.01) {
            const edge = clamp((af - D.SH.minF) / (D.SH.fadeF - D.SH.minF), 0, 1), hz = (75 + (F.cam.pitch || 0)) / 150;
            dr = [0.5 * (1 + f), hz - 0.34, 0.64, sh.a * edge];
          }
        }
      } catch (e) { warnOnce('dread', e); }
      if (p.u.uDread) gl.uniform4f(p.u.uDread, dr[0], dr[1], dr[2], dr[3]);
      const wxOn = F.outdoor && wx3d();
      const roofT = wxOn ? shelterTex(gl, F) : null;
      gl.activeTexture(gl.TEXTURE12); gl.bindTexture(gl.TEXTURE_2D, roofT || shelterNone(gl)); if (p.u.uWxRoof) gl.uniform1i(p.u.uWxRoof, 12);
      if (p.u.uWxMap) gl.uniform4f(p.u.uWxMap, roofT ? shel.k : 1, 0, roofT ? 1 : 0, 0);
      if (p.u.uWx2) gl.uniform4f(p.u.uWx2, wxOn && P.wet ? (WX() === 'storm' ? 1 : 0.7) : 0, wxOn ? Math.max(P.snow ? 1 : 0, P.win[2] * 1.4) : 0, F.now % 1000, P.cl[1]);
      if (p.u.uWinG) gl.uniform1f(p.u.uWinG, P.win[1]);
      if (p.u.uWxC) gl.uniform3f(p.u.uWxC, Math.min(1, P.ambS[0] * 1.5 + 0.12), Math.min(1, P.ambS[1] * 1.5 + 0.13), Math.min(1, P.ambS[2] * 1.5 + 0.16));
      gl.uniform3f(p.u.uShaftC, 1.0 * P.glow[0] + 0.3, 0.92 * P.glow[1] + 0.25, 0.8 * P.glow[2] + 0.2);
      tri(gl);
      stats.post = now() - t0;
    },
  };

  // rain and snow are drawn in the 3D scene under R3D (behind walls, moving with the view); the game's flat 2D weather overlay
  // (js/weather.js drawOverlay, on the HUD layer) steps aside then. Its haze is the scene's fog, its flash the sky's.
  const wx3d = () => typeof GFX === 'undefined' || (GFX.particles || 0) > 0;
  function wrapWeather() {
    if (typeof Weather === 'undefined' || !Weather.drawOverlay || Weather.drawOverlay._l21) return;
    const _d = Weather.drawOverlay;
    const w = function () { try { if (R3D.active() && wx3d()) return undefined; } catch (e) { /* fall through */ } return _d.apply(this, arguments); };
    w._l21 = true; Weather.drawOverlay = w;
  }

  // ------------------------------------------------------------------------------------------------ install
  function install() {
    try { wrapWeather(); } catch (e) { warnOnce('weather overlay', e); }
    try {
      R3D.setChunk('shade', SHADE, { uniforms: (g, pr) => shadeUniforms(g, pr) });
    } catch (e) { stats.failed = 'shade: ' + (e && e.message); warnOnce('shade chunk (CORE shading stays)', e); return false; }
    try { R3D.addPass(shadowPass); } catch (e) { warnOnce('shadow pass', e); }
    try { R3D.addPass(skyPass); } catch (e) { stats.failed = 'sky: ' + (e && e.message); warnOnce('sky pass', e); }
    try { R3D.addPass(postPass); } catch (e) { stats.failed = 'post: ' + (e && e.message); warnOnce('post pass', e); }
    R3D.on('frame', (F) => { const t0 = now(); try { frameParams(F); } catch (e) { warnOnce('frame', e); } stats.frames++; stats.ms = now() - t0; stats.shadows = P.shadowOn; stats.clouds = P.cl[0]; stats.panoLayers = P.panoOn ? pano.n : 0; });
    R3D.on('restored', (gl) => { if (gl) initGL(gl); });
    stats.installed = true;
    return true;
  }
  install();

  return { stats, ported, P, available: true, photoGrades, keyAt, frameParams, heights: () => hgt, shelter: () => shel, pano: () => pano, shaderSource: () => ({ SHADE, SKY_FS, COMP_FS }) };
})();
if (typeof window !== 'undefined') window.LIGHT21 = LIGHT21;
