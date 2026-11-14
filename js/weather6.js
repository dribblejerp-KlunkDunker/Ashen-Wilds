// ============================================================
//  weather6 - Phase 6, "Sleet and Ashfall, stopped by the bothy's roof". The first two of the Smothering's six
//  weathers, on the highland edge.
//
//  WHAT THE BIBLE SAYS (docs/worldbuilding/the-smothering.md, section 3; bestiary.md, "Weather and the bestiary"):
//    Ashfall is the ordinary night: "Grey flakes come down slow and a little sideways"; the measure every other weather
//    is held against. Sleet is "grey rain half frozen, driven slant and fast, rattling on roofs and hissing on any
//    flame. It beats the ash out of the air"; "You can see about half as far" (14 m against ashfall's 24); "Sound
//    carries 0.85 as far"; "you move at 85%". "Hearing multiplies every sound, the survivor's and every enemy's: what
//    muffles a goblin's footsteps muffles yours." The Godot build gave a weather 70 to 130 seconds, with an 8 second
//    blend. The banners are the bible's own (section 6). Its numbers are "reference, not a rule": used as they stand.
//
//  WHAT IT DOES
//    * Ash falls in the world, not across the glass (Phase 1's switch "Ash and embers" still turns it off): in three layers at increasing distance, each hidden behind
//      anything nearer and stopped by any roof (the roof planner's heights, js/eaves78.js). Embers still rise.
//    * Sleet comes in spells fixed by the day's number and the sun's face (none on a clear day), blends in over
//      8 seconds, beats the ash down, dims the sun a little, closes in a cold grey fog, and stops at the bothy's roof as the ash
//      does. Indoors you hear it on the roof.
//    * In sleet the walking bloom hears 0.85 as far and sees 14/24 as far, and you walk at 85%.
//    * A short cue before a spell, and the bible's banners when it comes and when it goes.
//  One Options switch, "Ashfall and sleet". Off: the ash of Phase 1 and no weather, exactly as before.
//  Nothing uses a random number: spells, banners and every flake follow from the day, the hour and a fixed hash.
// ============================================================
'use strict';

const WEATHER6 = (() => {
  const L1 = typeof LEDGE1 !== 'undefined' ? LEDGE1 : (typeof require !== 'undefined' ? require('./ledge1.js') : null);
  const S3 = typeof SUN3 !== 'undefined' ? SUN3 : (typeof require !== 'undefined' ? require('./sun3.js') : null);
  const hash = (a, b, s) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ---------------------------------------------------------------- the rules (pure: test/weather6.test.js runs them without a browser)
  const DAY_S = 90 * 24;                                   // seconds of play in a day (js/game.js: G.tod += dt / (90 * 24))
  const W = {
    blendS: 8,                                             // the Godot build's 8 second blend
    spellS: [70, 130],                                     // and its 70 to 130 second spells
    first: { a: 0.795, len: 100 },                         // the first day's spell: a few minutes after the prologue opens, while you are on the shelf or in the bothy [PROPOSED]
    perDay: { clear: 0, coin: 1, coal: 2 },                // a clear day stays dry; the darker the sun, the wetter the day [PROPOSED]
    FX: {                                                  // against Ashfall as the ordinary night (the-smothering.md, section 3)
      ashfall: { sight: 1, hear: 1, footing: 1 },
      sleet: { sight: 14 / 24, hear: 0.85, footing: 0.85 },
    },
  };
  // the day's spells of sleet, as [start, end] in the day's fraction; fixed by the day's number
  function spells(day) {
    day = Math.max(0, day | 0);
    if (day === 0) return [[W.first.a, W.first.a + W.first.len / DAY_S]];
    const n = W.perDay[S3 ? S3.kind(day) : 'coin'] || 0, out = [];
    for (let i = 0; i < n; i++) {
      const len = (W.spellS[0] + hash(day, i, 611) * (W.spellS[1] - W.spellS[0])) / DAY_S;
      const a = (i + 0.08 + hash(day, i, 612) * 0.75) / Math.max(1, n);   // one spell in each part of the day, so two never overlap
      out.push([a, a + len]);
    }
    return out;
  }
  // how far into sleet the air is at this moment, 0 (ashfall) to 1 (sleet), blended over 8 seconds each way
  function sleetAt(day, tod) {
    const b = W.blendS / DAY_S; let k = 0;
    for (const [a, e] of spells(day)) k = Math.max(k, clamp((tod - a) / b, 0, 1) * clamp((e - tod) / b, 0, 1));
    return k;
  }
  const kindAt = (day, tod) => (sleetAt(day, tod) >= 0.5 ? 'sleet' : 'ashfall');
  function fx(k) { const a = W.FX.ashfall, s = W.FX.sleet, m = (x, y) => x + (y - x) * k; return { sight: m(a.sight, s.sight), hear: m(a.hear, s.hear), footing: m(a.footing, s.footing) }; }

  // ---------------------------------------------------------------- the words: the bible's banners (the-smothering.md, section 6), and two of mine
  const BANNERS = {
    ashfall: ['Ash falls, as it always does.', 'Ash again. Grey on grey, as always.', 'The ash comes down soft. An ordinary night.', 'Ash on the north wind. Nothing new.', 'Ashfall. Sweep the roof, mind the torch.', 'Ash, falling the way it has for thirty years.'],
    sleet: ['Sleet. The torch gutters, and the ground turns to grease.', 'Sleet. Keep the torch under your cloak.', 'Grey rain. The ash turns to grease underfoot.', 'The grease weather. Walk short, walk flat.', 'Sleet beats the spores out of the air.', 'Cold rain and slush. The fire sinks low.'],
  };
  const TX = {
    cue: 'The ash is coming down wet, in clumps.',        // [PROPOSED] the bible's hook: a sensory cue before a change
    roof: 'Sleet rattles on the roof.',                    // [PROPOSED] indoors, the same change
  };
  const banner = (kind, day, i) => { const l = BANNERS[kind]; return l[Math.floor(hash(day, i, kind === 'sleet' ? 621 : 622) * l.length) % l.length]; };

  // ---------------------------------------------------------------- how it is drawn: ash, embers and sleet, in the world
  const VS = `out vec2 vUV; void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); vUV = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
  const FS = `in vec2 vUV;
uniform vec4 uW6;     // x ash, y sleet, z time, w wind
uniform vec4 uW6C;    // rgb the air's light on a flake, w embers
uniform highp sampler2D uW6Roof; uniform vec4 uW6Map;   // where it stops: roof heights, x texels per cell, z roofs on
layout(location=0) out vec4 oColor; layout(location=1) out vec4 oAux;
float wh(float a, float b) { return fract(sin(a * 127.1 + b * 311.7) * 43758.5453); }
void main() {
  // the game's logical pixel grid, moved with the view the way the engine's own rain is
  vec2 lp = floor(vec2(vUV.x * 320.0 + uCam.w * 242.42, (1.0 - vUV.y) * 150.0));
  vec2 nd = vUV * 2.0 - 1.0; vec4 pa = uInvViewProj * vec4(nd, 1.0, 1.0), pb = uInvViewProj * vec4(nd, -1.0, 1.0);
  vec3 wd = normalize(pa.xyz / pa.w - pb.xyz / pb.w); float wk = 1.0 / max(0.05, dot(wd, uFwd.xyz));
  bool roofs = uW6Map.z > 0.5; ivec2 ws = roofs ? textureSize(uW6Roof, 0) : ivec2(1);
  float t = uW6.z;
  for (int i = 0; i < 3; i++) {
    float fi = float(i), dist = 0.9 + fi * 1.7, near = 1.0 / (1.0 + fi);
    vec3 wp = uEye.xyz + wd * (dist * wk);
    if (roofs) { ivec2 tc = ivec2(floor(wp.xy * uW6Map.x)); if (tc.x >= 0 && tc.y >= 0 && tc.x < ws.x && tc.y < ws.y && wp.z < texelFetch(uW6Roof, tc, 0).r) continue; }
    vec4 c = vec4(0.0); float glow = 0.0;
    // sleet: grey streaks, slant and fast
    if (uW6.y > 0.01) {
      float cw = 4.0 + fi * 3.0, len = 7.0 * near + 3.0;
      vec2 p = lp; p.x += p.y * (0.42 + uW6.w * 0.3);
      float col = floor(p.x / cw), h = wh(col, fi + 11.0);
      if (h < 0.62 * uW6.y && floor(mod(p.x, cw)) == floor(cw * 0.5)) {
        float y = mod(p.y - t * (320.0 * near + 160.0) + h * 997.0, 60.0 + fi * 22.0);
        if (y < len) c = vec4(uW6C.rgb * vec3(0.92, 0.96, 1.04), (0.5 - fi * 0.11) * (1.0 - y / len * 0.5));
      }
    }
    // ash: grey flakes, slow and a little sideways
    if (c.a <= 0.0 && uW6.x > 0.01) {
      float cs = 9.0 + fi * 6.0;
      vec2 cc = floor(lp / cs), h2 = vec2(wh(cc.x, cc.y + fi * 7.0 + 3.0), wh(cc.y, cc.x + fi * 3.0 + 5.0));
      if (h2.x < 0.34 * uW6.x) {
        float tt = t * (0.22 * near + 0.08);
        vec2 f = vec2(fract(h2.x * 7.0 + sin(tt * 2.0 + h2.y * 6.0) * 0.1 + tt * (0.25 + uW6.w * 0.4)), fract(h2.y + tt));
        vec2 q = floor(f * cs), me = lp - cc * cs;
        float sz = i == 0 ? 2.0 : 1.0;
        if (me.x >= q.x && me.x < q.x + sz && me.y >= q.y && me.y < q.y + sz) c = vec4(uW6C.rgb * 0.62, 0.66 - fi * 0.14);
      }
    }
    // embers: rising from the burning country, few, put out by sleet
    if (c.a <= 0.0 && uW6C.w > 0.01) {
      float cs = 23.0 + fi * 11.0;
      vec2 cc = floor(lp / cs), h3 = vec2(wh(cc.x + 17.0, cc.y + fi), wh(cc.y + 29.0, cc.x - fi));
      if (h3.x < 0.12 * uW6C.w) {
        float tt = t * (0.3 * near + 0.1);
        vec2 f = vec2(fract(h3.x * 5.0 + sin(tt * 3.0 + h3.y * 9.0) * 0.08), fract(h3.y - tt));
        vec2 q = floor(f * cs), me = lp - cc * cs;
        if (me.x >= q.x && me.x < q.x + 1.0 && me.y >= q.y && me.y < q.y + 1.0) { c = vec4(2.2, 0.8, 0.2, 1.0); glow = 1.0; }
      }
    }
    if (c.a > 0.0) {
      vec4 cl = uViewProj * vec4(wp, 1.0); gl_FragDepth = clamp(cl.z / cl.w * 0.5 + 0.5, 0.0, 1.0);
      oColor = c; oAux = vec4(0.0, glow, 0.0, glow); return;
    }
  }
  discard;
}`;
  const GLS = { prog: null, vao: null, roof: null, none: null, src: null, failed: null, drawn: 0 };
  const sw = () => typeof GFX === 'undefined' || GFX.laWx !== false;
  const ashOn = () => typeof GFX === 'undefined' || GFX.laAsh !== false;   // Phase 1's switch, "Ash and embers", still rules the ash and the embers
  const outside = (m) => !!(m && m._la && m.outdoor !== false && !m.ceil);
  const dayNow = () => (typeof G !== 'undefined' && G ? G.day | 0 : 0);
  const tod = (F) => (F && F.tod != null ? F.tod : typeof G !== 'undefined' && G ? G.tod : 0.5);
  function roofTex(gl, m) {
    let s = null; try { s = typeof EAVES78 !== 'undefined' && EAVES78.shelter ? EAVES78.shelter(m) : null; } catch (e) { s = null; }
    if (!s) return null;
    if (GLS.src !== s) {
      if (!GLS.roof) GLS.roof = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, GLS.roof); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, s.w, s.h, 0, gl.RED, gl.FLOAT, null);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      const d = new Float32Array(s.data.length); for (let i = 0; i < d.length; i++) d[i] = s.data[i] < -5000 ? -1e4 : s.data[i] * R3D.ZK;
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, s.w, s.h, gl.RED, gl.FLOAT, d); GLS.src = s; GLS.k = s.k;
    }
    return GLS.roof;
  }
  const pass = {
    name: 'la-weather', order: 55,
    init(gl) { try { GLS.prog = R3D.program(VS, FS, { chunks: ['common'] }); GLS.vao = gl.createVertexArray(); } catch (e) { GLS.failed = String(e && e.message); } },
    enabled(F) { return sw() && !!GLS.prog && !GLS.failed && F && outside(F.map) && F.outdoor !== false && (typeof GFX === 'undefined' || GFX.particles !== 0) && (ashOn() || sleetAt(dayNow(), tod(F)) > 0); },
    draw(gl, F) {
      const k = sleetAt(dayNow(), tod(F)), T = tod(F), day = clamp((Math.cos((T - 0.5) * Math.PI * 2) + 0.3) / 0.4, 0, 1);
      R3D.bindScene(gl, F); const u = R3D.use(GLS.prog).u, roof = roofTex(gl, F.map);
      gl.activeTexture(gl.TEXTURE12); gl.bindTexture(gl.TEXTURE_2D, roof || none(gl)); gl.uniform1i(u.uW6Roof, 12);
      gl.uniform4f(u.uW6Map, roof ? GLS.k : 1, 0, roof ? 1 : 0, 0);
      const ash = ashOn() ? 1 : 0;
      gl.uniform4f(u.uW6, ash * (1 - 0.85 * k), k, (F.now || 0) % 1000, 0.35 + 0.4 * k);   // F.now: seconds, as the engine's own rain uses
      const L = 0.5 + 0.5 * day;
      gl.uniform4f(u.uW6C, 0.74 * L, 0.71 * L, 0.69 * L, ash * (1 - 0.7 * k));
      const depth = gl.isEnabled(gl.DEPTH_TEST), blend = gl.isEnabled(gl.BLEND);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false); gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
      gl.bindVertexArray(GLS.vao); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null);
      if (!blend) gl.disable(gl.BLEND); if (!depth) gl.disable(gl.DEPTH_TEST); gl.depthMask(true);
      GLS.drawn++;
    },
  };
  function none(gl) { if (!GLS.none) { GLS.none = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, GLS.none); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 1, 1, 0, gl.RED, gl.FLOAT, new Float32Array([-1e4])); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); } return GLS.none; }

  // ---------------------------------------------------------------- the sound of it: a hiss outside, a rattle on the roof inside
  const SND = { src: null, gain: null, filt: null };
  function sound(k, inside) {
    try {
      const A = typeof Audio_ !== 'undefined' ? Audio_ : null, ctx = A && A.ctx; if (!ctx) return;
      if (!SND.src) {
        const n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (hash(i, 3, 631) * 2 - 1) * (0.6 + 0.4 * hash(i >> 9, 4, 632));   // fixed noise, in gusts
        SND.src = ctx.createBufferSource(); SND.src.buffer = buf; SND.src.loop = true;
        SND.filt = ctx.createBiquadFilter(); SND.gain = ctx.createGain(); SND.gain.gain.value = 0;
        SND.src.connect(SND.filt).connect(SND.gain).connect(A.sfxBus || A.master); SND.src.start();
      }
      const t = ctx.currentTime;
      SND.filt.type = inside ? 'lowpass' : 'bandpass'; SND.filt.frequency.setTargetAtTime(inside ? 700 : 2600, t, 0.2); SND.filt.Q.value = inside ? 0.7 : 0.5;
      SND.gain.gain.setTargetAtTime((A.muted ? 0 : 1) * k * (inside ? 0.16 : 0.1), t, 0.4);
    } catch (e) { /* no sound is fine */ }
  }

  // ---------------------------------------------------------------- in the game
  const ST = { k: 0, kind: 'ashfall', changes: 0, cued: -1, said: [], err: null };
  const kNow = () => (sw() && typeof G !== 'undefined' && G && G.map && G.map._la ? sleetAt(dayNow(), G.tod) : 0);
  function tick() {
    if (typeof G === 'undefined' || !G || G.state !== 'play' || !G.map || !G.map._la) return;
    const k = sw() ? sleetAt(dayNow(), G.tod) : 0, kind = k >= 0.5 ? 'sleet' : 'ashfall', inside = !outside(G.map), d = dayNow();
    // the cue: as a spell begins to blend in (the bible's hook: a sensory cue before a change)
    const sp = spells(d).findIndex(([a]) => G.tod >= a && G.tod < a + W.blendS / DAY_S);
    if (sw() && sp >= 0 && ST.cued !== d * 10 + sp) { ST.cued = d * 10 + sp; if (!inside) say(TX.cue, ''); }
    if (kind !== ST.kind) {
      ST.kind = kind; ST.changes++;
      say(inside ? (kind === 'sleet' ? TX.roof : '') : banner(kind, d, ST.changes), kind === 'sleet' ? 'warn' : '');
    }
    ST.k = k; sound(k, inside);
  }
  function say(t, cls) { if (!t) return; ST.said.push(t); if (ST.said.length > 20) ST.said.shift(); msg(t, cls, 5200); }
  function wire() {
    if (typeof Engine === 'undefined' || typeof R3D === 'undefined' || !L1) return false;
    L1.SWITCHES.push(['laWx', 'Ashfall and sleet', 'Ash falls in the world and stops at roofs; sleet comes in spells and slows you. Off: the ash across the view, and no weather (3D renderer only)']);
    R3D.addPass(pass);
    // Phase 1's ash across the view stands aside while this is on
    const ash = R3D.getPass('la-ash');
    if (ash) { const en = ash.enabled; ash.enabled = function (F) { return !(sw() && GLS.prog && !GLS.failed) && en.call(this, F); }; }
    // the light: sleet darkens the day (through the engine's weather terms, as js/sun3.js does); no haze, since a
    // wash would lighten the night: the grey fog does the closing in
    if (Engine.setWeather) {
      const _sw = Engine.setWeather;
      Engine.setWeather = function (o) { const k = kNow(); if (o && k > 0 && outside(G.map)) o = Object.assign({}, o, { cloud: Math.max(+o.cloud || 0, 0.72 * k), dark: (+o.dark || 0) + 0.24 * k }); return _sw.call(this, o); };
    }
    // the fog closes in: sight 14 m in sleet against 24 in ashfall
    R3D.on('frame', (F) => {
      const env = F && F.env; if (!env || env.fogDist == null || !F.map || !outside(F.map)) return; const k = kNow(); if (k <= 0) return;
      env.fogDist *= fx(k).sight;
      if (env.fogR != null) { const g = (env.fogR + env.fogG + env.fogB) / 3 * 0.55; env.fogR += (g * 0.92 - env.fogR) * k; env.fogG += (g * 0.97 - env.fogG) * k; env.fogB += (g * 1.08 - env.fogB) * k; }   // wet grey air, not the land's red
    });
    // the walking bloom: what muffles your footsteps muffles its hearing, and it sees less
    if (typeof BLOOM4 !== 'undefined' && BLOOM4.setSenses) BLOOM4.setSenses((mapId) => { const m = G && G.maps && G.maps[mapId], k = outside(m) ? kNow() : 0, f = fx(k); return { hear: f.hear, see: f.sight }; });
    // footing: in sleet the ground is grease
    if (typeof playerMove === 'function') { const _pm = playerMove; playerMove = function (o, dx, dy) { const k = G && G.map && outside(G.map) ? kNow() : 0; if (k > 0 && o === Engine.cam) { const f = fx(k).footing; dx *= f; dy *= f; } return _pm.call(this, o, dx, dy); }; }
    const _up = update; update = function (dt) { const r = _up.apply(this, arguments); try { tick(dt); } catch (e) { ST.err = ST.err || String(e && e.message); } return r; };
    return true;
  }
  const wired = wire();
  return { W, DAY_S, spells, sleetAt, kindAt, fx, BANNERS, TX, banner, state: () => ST, gl: () => GLS, pass, wired };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = WEATHER6;
