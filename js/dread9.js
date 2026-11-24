// ============================================================
//  dread9 - Phase 9, "dread as a value that changes the picture, tuned for this world".
//
//  WHAT THE BIBLE SAYS (searched before anything was invented; docs/worldbuilding/the-round-and-the-long-account.md):
//    On the Ground the dread comes from "light, noise, weight, and what you cannot see". The rules of dread: "The worst
//    thing is never on screen"; "Silence is scheduled"; "Loss is slow and has a name"; "One knock, once. No scare is ever
//    repeated"; "Your partners are the uncertainty". The look: "Black is the base colour. Build dark and add light";
//    "Four lights, never confused. Yours is tallow yellow and small. The land's is ember red and vast. Teal belongs to
//    the bloom alone. Pale blue belongs to workings"; "Cold where you stand, fire where you are going". The novel: "the
//    only warmth is people trying to build and keep what they have". The lore has no number for fear; every number here
//    is mine and marked [PROPOSED] (ROADMAP.md, P71 to P80).
//
//  WHAT IT DOES
//    * A VALUE, 0 to 1, that you never see as a number. The dark raises it, and your own lantern holds most of the dark
//      off. The walking bloom raises it, near and coming, but only where you could know it is there: in front of you,
//      or close enough behind to hear it shuffle. It is not a radar; what you cannot see or hear is not told to you.
//      Sleet and a bad wound add a little. Marget Sayle's roof takes most of it away, and the bar across her door more.
//      A partner beside you lowers it. It rises in seconds and leaves slowly. A claw sends it up at once, once a claw.
//    * THE PICTURE, in the 3D renderer, before the lighting's last pass:
//        - the edges close in, toward the base black;
//        - the colour drains out of the world (rock, frost, skin, cloth) but not out of the four lights, which grow
//          more precious against the grey: tallow, ember, the bloom's teal and the pale blue of a working keep theirs;
//        - the shadows go deeper;
//        - the far country goes to shapes against the sky, from nearer as dread rises (the sky, the painting, stays);
//        - at its height the closing breathes, slowly. Never with Reduce motion or No flashes.
//      At nought nothing is drawn at all. Nothing flashes, shakes, lunges or is shown that is not there.
//    * The Shattered Octave's own dread (js/dread.js: its songs' Dissonance, its stalker, its whispers) was written for
//      that game's story; it is held off here, and its row leaves Options. Its saved setting is not touched: the two
//      games are served from the same site and share a browser's storage.
//
//  Switch: Options > "Dread" (GFX.laDread). Off, the frame is exactly the frame before this phase. 3D renderer only:
//  the classic renderer draws nothing of it. Nothing here uses a random number; the breath is a sine of the anim clock.
// ============================================================
'use strict';
const DREAD9 = (() => {
  const L1 = typeof LEDGE1 !== 'undefined' ? LEDGE1 : (typeof require !== 'undefined' ? require('./ledge1.js') : null);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // ---------------------------------------------------------------- the numbers, all [PROPOSED] (see ROADMAP.md)
  const D = {
    night: 0.4,            // full night out of doors with no light of your own                                    [PROPOSED] P71
    lampCut: 0.65,         // your lantern, burning full, holds off this much of the dark's share                  [PROPOSED] P71
    sleet: 0.1,            // a full spell of sleet out of doors                                                   [PROPOSED] P72
    bloomFar: 14, bloomNear: 3,   // cells: from nothing at 14 to all of it at 3                                    [PROPOSED] P73
    bloomStill: 0.4, bloomComing: 0.75,   // at its post, or coming at you                                          [PROPOSED] P73
    hearClose: 4,          // behind you, it counts only this close: you would hear it shuffle                      [PROPOSED] P74
    ahead: Math.PI / 3,    // in front of you: within 60 degrees of where you face                                  [PROPOSED] P74
    hurtFrom: 0.3, hurtTo: 0.9, hurt: 0.25,   // a wound past a third of your health is felt                         [PROPOSED] P75
    room: 0.35, barred: 0.15,   // under a roof, and with the bar across the door                                    [PROPOSED] P76
    partner: 5, partnerK: 0.7,  // a partner within 5 cells                                                          [PROPOSED] P77
    rise: 0.2, fall: 0.05,      // per second: it builds in about five seconds and leaves in about twenty           [PROPOSED] P78
    claw: 0.85,                 // where a claw sends it                                                             [PROPOSED] P78
  };

  // ---------------------------------------------------------------- the rules (pure: test/dread9.test.js runs them without a browser)
  // env: { dark 0..1, lamp 0..1 (your flame), room, barred, sleet 0..1, hurt 0..1 (health lost), partner (cells, or
  // Infinity), bloom: null or { d (cells), coming, ahead }, clawed (how many claws so far) }
  function target(e) {
    // under a roof the hearth is lit and the sleet is on the roof: neither the night nor the weather counts there
    let t = e.room ? 0 : (e.dark || 0) * D.night * (1 - D.lampCut * clamp(e.lamp || 0, 0, 1));
    if (!e.room) t += D.sleet * clamp(e.sleet || 0, 0, 1);
    const b = e.bloom;
    if (b && (b.ahead || b.d < D.hearClose)) t += smooth(D.bloomFar, D.bloomNear, b.d) * (b.coming ? D.bloomComing : D.bloomStill);
    t += D.hurt * smooth(D.hurtFrom, D.hurtTo, e.hurt || 0);
    if (e.room) t *= e.barred ? D.barred : D.room;
    if (e.partner != null && e.partner <= D.partner) t *= D.partnerK;
    return clamp(t, 0, 1);
  }
  const fresh = () => ({ d: 0, clawed: 0, hold: false });
  function step(S, e, dt) {
    if (e.clawed != null && e.clawed > S.clawed) { S.clawed = e.clawed; S.d = Math.max(S.d, D.claw); return S.d; }
    if (S.hold || !(dt > 0)) return S.d;
    const t = target(e);
    S.d = t > S.d ? Math.min(t, S.d + D.rise * dt) : Math.max(t, S.d - D.fall * dt);
    return S.d;
  }
  // what the picture does at a given dread. o.still: Reduce motion or No flashes
  function look(d, o) {
    d = clamp(d || 0, 0, 1); o = o || {};
    return {
      drain: 0.65 * smooth(0.05, 0.85, d),          // how much colour leaves the world (not the four lights)    [PROPOSED] P79
      close: 0.8 * smooth(0.1, 1, d),               // how dark the edges go
      inner: 1.05 - 0.55 * smooth(0, 1, d),         // where the closing begins, from the middle (1.41 is a corner)
      crush: 0.35 * smooth(0.2, 1, d),              // how much deeper the shadows go
      far: 0.7 * smooth(0.25, 1, d),                // how far the far country goes to shapes
      farFrom: 22 - 12 * d,                         // and from how near, in cells
      breathe: o.still ? 0 : 0.12 * smooth(0.55, 1, d),   // the slow swell of the edges at its height           [PROPOSED] P80
    };
  }
  // The four lights keep their colour; everything else may drain. A twin of the shader's own rule (FS below), so that
  // Node can test it: tallow and ember (red strongest, little blue), the bloom's teal (green and blue over red), a
  // working's pale blue (blue strongest), and only where they are bright enough to be lights at all.
  function keep(r, g, b) {
    const mx = Math.max(r, g, b); if (mx <= 1e-4) return 0;
    const warm = r >= g && r >= b ? smooth(0.45, 0.7, (r - b) / r) : 0;
    const teal = smooth(0.25, 0.45, (Math.min(g, b) - r) / mx);
    const blue = b >= r && b >= g ? smooth(0.25, 0.4, (b - r) / b) : 0;
    return Math.max(warm, teal, blue) * smooth(0.08, 0.3, mx);
  }

  // ---------------------------------------------------------------- how it is drawn
  const VS = `out vec2 vUV; void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); vUV = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
  const FS = `in vec2 vUV;
uniform sampler2D uSrc; uniform highp sampler2D uDep;
uniform vec4 uDr;    // x drain, y close, z crush, w far
uniform vec4 uDr2;   // x inner, y breath (now), z far from (cells), w aspect (width over height)
uniform vec4 uDr3;   // x your lantern (0..1), y its reach (cells), z a room's hearth (0..1)
layout(location=0) out vec4 oColor;
float sstep(float a, float b, float v) { float t = clamp((v - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
float keepOf(vec3 c) {
  float mx = max(c.r, max(c.g, c.b)); if (mx <= 1e-4) return 0.0;
  float warm = (c.r >= c.g && c.r >= c.b) ? sstep(0.45, 0.7, (c.r - c.b) / c.r) : 0.0;
  float teal = sstep(0.25, 0.45, (min(c.g, c.b) - c.r) / mx);
  float blue = (c.b >= c.r && c.b >= c.g) ? sstep(0.25, 0.4, (c.b - c.r) / c.b) : 0.0;
  return max(warm, max(teal, blue)) * sstep(0.08, 0.3, mx);
}
void main() {
  vec4 src = texture(uSrc, vUV); vec3 c = src.rgb;
  float z = texture(uDep, vUV).r, dist = z < 0.99999 ? r3dLinearDepth(z) : 1e9;
  float k = keepOf(c), l = dot(c, vec3(0.30, 0.59, 0.11));
  // your own light: what lies within your lantern's reach keeps the warmth it gives, and a room keeps its hearth's
  k = max(k, max(uDr3.x * (1.0 - sstep(uDr3.y * 0.6, uDr3.y * 1.25, dist)), uDr3.z));
  // the colour drains out of the world, not out of the four lights
  c = mix(c, vec3(l), uDr.x * (1.0 - k));
  // the shadows go deeper; the lights hold
  c *= 1.0 - uDr.z * (1.0 - sstep(0.0, 0.45, l)) * (1.0 - k);
  // the far country goes to shapes; the sky (the painting) stays
  if (z < 0.99999) { c = mix(c, vec3(0.03, 0.03, 0.035), uDr.w * sstep(uDr2.z, uDr2.z * 2.2, dist) * (1.0 - 0.6 * k)); }
  // the edges close in, toward the base black
  vec2 q = (vUV - 0.5) * 2.0; q.y *= 0.85;
  float r = length(q), e = uDr.y * (1.0 + uDr2.y) * sstep(uDr2.x, 1.45, r);
  c = mix(c, vec3(0.018, 0.018, 0.02), clamp(e * (1.0 - 0.35 * k), 0.0, 1.0));
  oColor = vec4(c, src.a);
}`;
  const GLS = { prog: null, vao: null, fb: null, tex: null, w: 0, h: 0, hdr: null, failed: null, drawn: 0, ms: 0 };
  const ST = fresh(); ST.err = null; ST.look = null; ST.env = null;
  const sw = () => typeof GFX === 'undefined' || GFX.laDread !== false;
  const here = () => typeof G !== 'undefined' && G && G.map && G.map._la;
  const still = () => typeof GFX !== 'undefined' && !!(GFX.reduceMotion || GFX.noFlash);
  function target2(gl, s) {
    if (GLS.tex && GLS.w === s.w && GLS.h === s.h && GLS.hdr === !!s.hdr) return true;
    if (GLS.fb) { gl.deleteFramebuffer(GLS.fb); gl.deleteTexture(GLS.tex); }
    GLS.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, GLS.tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, s.hdr ? gl.RGBA16F : gl.RGBA8, s.w, s.h);
    for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, p, v);
    GLS.fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, GLS.fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, GLS.tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) { GLS.failed = 'dread target incomplete'; return false; }
    GLS.w = s.w; GLS.h = s.h; GLS.hdr = !!s.hdr; return true;
  }
  // order 88: after everything in the world and on the glass, before the lighting's last pass (90) reads the scene
  const pass = {
    name: 'la-dread', order: 88,
    init(gl) { try { GLS.prog = R3D.program(VS, FS, { chunks: ['common'] }); GLS.vao = gl.createVertexArray(); } catch (e) { GLS.failed = String(e && e.message); } },
    enabled(F) { return sw() && !!GLS.prog && !GLS.failed && !!(F && F.map && F.map._la) && ST.d > 0.003 && !!(F.targets && F.targets.scene); },
    draw(gl, F) {
      const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
      const s = R3D.resolveScene(gl, F); if (!s || !target2(gl, s)) return;
      const lk = look(ST.d, { still: still() }), T = typeof ANIM !== 'undefined' ? ANIM.T : 0;
      const breath = lk.breathe * (0.5 + 0.5 * Math.sin(T * Math.PI * 2 * 0.21));   // about thirteen breaths a minute
      // the scene, through the rule, into this pass's own target ...
      gl.bindFramebuffer(gl.FRAMEBUFFER, GLS.fb); gl.viewport(0, 0, s.w, s.h);
      const depth = gl.isEnabled(gl.DEPTH_TEST), blend = gl.isEnabled(gl.BLEND), cull = gl.isEnabled(gl.CULL_FACE);
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE); gl.depthMask(false);
      const u = R3D.use(GLS.prog).u;
      gl.activeTexture(gl.TEXTURE12); gl.bindTexture(gl.TEXTURE_2D, s.color); gl.uniform1i(u.uSrc, 12);
      gl.activeTexture(gl.TEXTURE13); gl.bindTexture(gl.TEXTURE_2D, s.depthTex); gl.uniform1i(u.uDep, 13);
      gl.uniform4f(u.uDr, lk.drain, lk.close, lk.crush, lk.far);
      gl.uniform4f(u.uDr2, lk.inner, breath, lk.farFrom, s.w / s.h);
      const e = ST.env || {}, reach = (() => { try { return typeof LANTERN7 !== 'undefined' && LANTERN7.reach ? LANTERN7.reach() : LANTERN7.radius ? LANTERN7.radius(LANTERN7.oil()) : 4.2; } catch (x) { return 4.2; } })();
      gl.uniform4f(u.uDr3, clamp(e.lamp || 0, 0, 1), reach, e.room ? 0.6 : 0, 0);
      gl.bindVertexArray(GLS.vao); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null);
      gl.activeTexture(gl.TEXTURE12); gl.bindTexture(gl.TEXTURE_2D, null); gl.activeTexture(gl.TEXTURE13); gl.bindTexture(gl.TEXTURE_2D, null);
      // ... and back into the scene's colour, which the last pass reads (its second target, the material one, untouched)
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, GLS.fb); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, s.fb);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
      gl.blitFramebuffer(0, 0, s.w, s.h, 0, 0, s.w, s.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      if (depth) gl.enable(gl.DEPTH_TEST); if (blend) gl.enable(gl.BLEND); if (cull) gl.enable(gl.CULL_FACE); gl.depthMask(true);
      GLS.drawn++; ST.look = lk; if (t0) GLS.ms = performance.now() - t0;
    },
  };

  // ---------------------------------------------------------------- in the game: what you could know, read once a step
  const dayness = (tod) => clamp((Math.cos(((tod == null ? 0.5 : tod) - 0.5) * Math.PI * 2) + 0.3) / 1.3, 0, 1);   // the engine's own curve (js/lighting.js), as the lantern reads it
  function envNow() {
    const m = G.map, c = Engine.cam, out = m.outdoor !== false && !m.ceil, p = G.player || {};
    const e = { dark: out ? 1 - dayness(G.tod) : 0, lamp: 0, room: !out, barred: false, sleet: 0, hurt: 0, bloom: null, partner: Infinity, clawed: 0 };
    try { if (typeof LANTERN7 !== 'undefined' && LANTERN7.lit && LANTERN7.lit()) e.lamp = LANTERN7.flameNow ? LANTERN7.flameNow() : LANTERN7.flame(LANTERN7.oil()); else if (typeof UPG !== 'undefined' && UPG.lantern) e.lamp = 1; } catch (x) { /* no lantern */ }
    try { if (typeof DOOR5 !== 'undefined') e.barred = !!DOOR5.barred(); } catch (x) { /* no door */ }
    try { if (out && typeof WEATHER6 !== 'undefined' && GFX.laWx !== false) e.sleet = WEATHER6.sleetAt(Math.max(0, G.day | 0), G.tod); } catch (x) { /* no weather */ }
    if (p.hpMax > 0) e.hurt = clamp(1 - p.hp / p.hpMax, 0, 1);
    try {
      if (typeof BLOOM4 !== 'undefined') {
        const S = BLOOM4.state(); e.clawed = S.clawed || 0;
        if (S.map === G.mapId) {
          const dx = S.x - c.x, dy = S.y - c.y, d = Math.hypot(dx, dy);
          let a = Math.atan2(dy, dx) - c.dir; a = Math.atan2(Math.sin(a), Math.cos(a));
          e.bloom = { d, coming: S.state === 'turn' || S.state === 'come' || S.state === 'claw', ahead: Math.abs(a) <= D.ahead };
        }
      }
    } catch (x) { /* no bloom */ }
    // a partner counts only when here: active, not paused for a map change, and on this map (partner19's own sameMap test)
    try { if (typeof PARTNER19 !== 'undefined' && PARTNER19.active && PARTNER19.active()) { const P = PARTNER19.S; if (P && !P.paused && P.map === G.mapId && P.x != null) e.partner = Math.hypot(P.x - c.x, P.y - c.y); } } catch (x) { /* alone */ }
    return e;
  }
  function tick(dt) {
    if (typeof G === 'undefined' || !G || !G.map) return;
    holdOctave();
    if (!sw() || !here()) { ST.d = 0; return; }
    if (G.state !== 'play' || G.dead) return;     // panels, talk and death hold it where it is
    const e = envNow(); ST.env = e; step(ST, e, dt);
  }
  // the Octave's own dread stays off here, without touching its saved setting (DREAD.setOn would save it)
  function holdOctave() { try { if (typeof DREAD !== 'undefined' && DREAD.set && DREAD.set.on) DREAD.set.on = false; } catch (e) { /* not loaded */ } }
  function wire() {
    if (typeof Engine === 'undefined' || typeof R3D === 'undefined' || !L1 || typeof update !== 'function') return false;
    holdOctave();
    R3D.addPass(pass);
    const _up = update; update = function (dt) { const r = _up.apply(this, arguments); try { tick(dt); } catch (e) { ST.err = ST.err || String(e && e.message); } return r; };
    if (typeof renderAccessibilityMenu === 'function') {
      const _acc = renderAccessibilityMenu;
      renderAccessibilityMenu = function () {
        const r = _acc.apply(this, arguments);
        try { for (const id of ['dread-on', 'dread-label']) { const el = document.getElementById(id); if (el) el.remove(); } } catch (e) { /* the menu still opens */ }
        return r;
      };
    }
    L1.SWITCHES.push(['laDread', 'Dread', 'The picture closes in as fear rises: the edges darken, the colour drains from all but the lights, the far country goes to shapes. Off: the picture as before (3D renderer only)']);
    return true;
  }
  if (typeof GFX !== 'undefined' && GFX.laDread === undefined) GFX.laDread = true;
  const wired = typeof window !== 'undefined' ? wire() : false;
  return { D, target, fresh, step, look, keep, state: () => ST, env: () => ST.env, gl: () => GLS, pass, FS, wired };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = DREAD9;
