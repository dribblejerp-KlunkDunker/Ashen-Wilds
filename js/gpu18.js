// ============================================================
//  gpu18 — Phase 18 "Technical", team GPU: a WebGL2 COMPOSITOR in front of the CPU raycaster.
//
//  The raycaster is untouched: it still fills FI.fb / dbuf / mbuf and runs every post hook. When WebGL2 is available and
//  the Options switch "GPU compositor" is on (and the preset is not Original), this module:
//    - presents the 3D view through WebGL2: the finished frame is uploaded as a texture and drawn with an integer
//      nearest-neighbour upscale (k = floor(device / render) per axis; where the window is not an exact multiple, a
//      one-device-pixel seam is blended so pixel columns stay even: "sharp bilinear"). The Upscaling "Smooth" choice
//      keeps its plain bilinear look.
//    - draws the HUD (bottom panel, weapon, crosshair and everything modules paint over the view) into a transparent 2D
//      canvas at DEVICE resolution stacked above it: Engine.ctx points at that canvas while the compositor is on, with a
//      base transform from the logical 320x200 space to device pixels, so text is crisp at 1x. Panel art and the weapon are
//      drawn with image smoothing off, so they stay pixel art.
//    - runs the measured top three per-pixel colour passes in fragment shaders instead of JavaScript (measured in the
//      12-enemy Oakhaven-at-dusk scene, see the report; Medium 2x: post.js bloom 2.8 ms, post.js grade 1.4 ms; Cinematic
//      2x: cinema14's hook 1.9 ms, post.js grade 1.3 ms):
//        1. post.js grade (order 40): the same 3x256 table and saturation, in integers (bit-exact);
//        2. cinema14's full-resolution pass (order 95): depth haze, ground fog, the light add, and the grade and vignette
//           (the canvas formula of js/cinema14.js, in integers). Its light chain (bright pass, blur, rays on the 80x38 grid)
//           stays in JavaScript (below, a port): it is small and its brightest-cell search does not suit a shader;
//        3. post.js bloom (order 30): bright pass, blur and the capped upsample-add, when no cinema pass is on (in
//           Cinematic post.js bloom is off anyway) and the browser can render to float textures.
//      Each moved pass is skipped on the CPU by hiding the frame from it for its one hook call (the hooks at 29.99/30.01,
//      39.99/40.01, 94.99/95.01 below), only inside a frame this module presents; GFX flags are never touched, so every
//      other module (and PRESETS.current()) sees exactly the settings it always saw. Engine.render called directly (tests,
//      photo mode, the mods preview) still runs every pass on the CPU.
//      The moved passes run after ALL remaining CPU hooks instead of in their slots, so effects drawn between them (air11
//      haze/glare/breath 35-38, ghosts 41, sparks 45, deep16 50, fp-feel 100, Dread 110) are bloomed/graded where they
//      were not before; in the reference scenes the difference is a fraction of a level (test/gpu18.test.js).
//  The canvas path stays the fallback: no WebGL2, a lost context, any GL error, or the Original preset = the old path,
//  frame for frame. Lost context: the module falls back at once and comes back on webglcontextrestored.
//  Default: on only where WebGL2 is hardware accelerated (a software rasteriser such as SwiftShader would be slower than
//  the CPU path); the player's choice is remembered in localStorage 'octave.gpu18.v1'.
//  Nothing here touches saves, RNG, gameplay or story. Procedural: no assets are loaded.
//
//  Phase 21 hotfix ("the sky was not loading properly", owner, desktop Chrome on a real GPU: the sky just black):
//    - SELF-CHECK. The compositor now proves on the device that what it shows matches the frame the raycaster made. A few
//      frames after it turns on (and after every resize, scale or preset change, then about once a minute) it reads back
//      the composited view and a handful of presented pixels and compares them with the CPU frame: where the CPU frame is
//      clearly lit (the sky above all) the GPU picture must not be black. Two failed checks in a row turn the compositor off
//      for the session (the canvas path, the picture the game always had) with one console warning; st.check has the
//      numbers. A driver that mis-renders the composite can no longer leave the player with a black sky.
//    - LOST CONTEXT. A context lost between frames used to read as a failed present and latched the compositor off for the
//      session (and the canvas showed the lost, cleared drawing buffer until the event arrived). Now a lost context hands
//      that very frame to the canvas path and the compositor comes back on webglcontextrestored.
//    - DRAWING BUFFER. The view is placed with gl.drawingBufferWidth/Height (a browser may give a smaller buffer than the
//      canvas size it was asked for, e.g. at a high page zoom on a large screen), so the top of the view (the sky) is never
//      pushed off the buffer.
// ============================================================
'use strict';

if (typeof GFX !== 'undefined' && GFX.gpuCompositor === undefined) GFX.gpuCompositor = false;   // the live switch (not a preset flag)

const GPU18 = (() => {
  const KEY = 'octave.gpu18.v1';
  const st = {
    available: null,      // null = not probed yet; true / false
    software: false,      // a software rasteriser (auto default stays off)
    renderer: '',
    floatRT: false,       // EXT_color_buffer_float: needed to move post.js bloom
    lost: false,
    shown: false,         // the GL and HUD layers are on screen and Engine.ctx points at the HUD layer
    presenting: false,    // inside a frame this module presents (the hide/restore hooks act only then)
    failed: false,        // a GL error turned the compositor off for this session
    choice: null,         // the player's stored choice: null (auto) / true / false
    profile: false,
    stats: { frames: 0, inner: 0, upload: 0, cpuLight: 0, gl: 0, lastPasses: null },
    check: { runs: 0, bad: 0, streak: 0, last: null, failedBy: '' },   // the on-device self-check (see the header)
    warned: {},
  };
  const warnOnce = (k, e) => { if (st.warned[k]) return; st.warned[k] = true; console.warn('gpu18 ' + k, e); };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // ---------------------------------------------------------------------------------------------------- settings
  function loadChoice() {
    try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && typeof o === 'object' && (o.on === 0 || o.on === 1)) return o.on === 1; } catch (e) { /* no storage */ }
    return null;
  }
  function saveChoice(v) { try { localStorage.setItem(KEY, JSON.stringify({ on: v ? 1 : 0 })); } catch (e) { /* no storage */ } }
  function originalish() {
    if (typeof GFX === 'undefined') return true;
    if (GFX.preset === 'plain' || GFX.preset === 'original') return true;
    try { return typeof PRESETS !== 'undefined' && PRESETS.current() === 'original'; } catch (e) { return false; }
  }
  // whether the compositor should be showing now
  function wanted() { return !!(GFX.gpuCompositor && st.available && !st.lost && !st.failed && gl && !originalish()); }
  // Phase 21: an external renderer (js/r3d21.js, R3D) draws the 3D view on its own canvas and borrows only the HUD layer.
  // While it holds the claim the HUD layer shows (Engine.ctx = the device-resolution HUD canvas), this module's GL canvas
  // is hidden and it presents nothing; the compositor's own switch is left exactly as the player set it.
  let ext = null;
  const showing = () => !!ext || wanted();
  function claimHud(owner) {
    ext = owner || null;
    try { const game = typeof document !== 'undefined' ? document.getElementById('game') : null; if (game) game.classList.toggle('gpu18-ext', !!ext); } catch (e) { /* fine */ }
    sizeDirty = true; makeLayers(); sync();
    return !!(ext && st.shown);
  }

  // ---------------------------------------------------------------------------------------------------- GL setup
  let glCanvas = null, hudCanvas = null, hudCtx = null, gl = null, viewCtx = null;
  let devW = 0, devH = 0;
  const P = {};   // programs
  const T = {};   // textures
  const FB = {};  // framebuffers
  let pp = 0, texW = 0, texH = 0, bW = 0, bH = 0, lightW = 0, lightH = 0, vigN = 0;
  function makeLayers() {
    if (glCanvas || typeof document === 'undefined') return;
    const view = document.getElementById('view'); if (!view || !view.parentNode) return;
    if (!document.getElementById('gpu18-style')) {
      const s = document.createElement('style'); s.id = 'gpu18-style';
      s.textContent = '#gpu18-gl,#gpu18-hud{position:absolute;inset:0;width:100%;height:100%;display:none;pointer-events:none;image-rendering:auto}' +
        '#game.gpu18-on #gpu18-gl,#game.gpu18-on #gpu18-hud{display:block}' +
        '#gpu18-gl.unwrite,#gpu18-hud.unwrite{filter:saturate(0.2) contrast(0.9)}' +
        '#game.gpu18-on #cine14-veil{display:none!important}' +   // the cinema grade and vignette run in the shader instead
        '#game.gpu18-ext #gpu18-gl{display:none!important}';     // Phase 21: R3D draws the view, only the HUD layer shows
      document.head.appendChild(s);
    }
    glCanvas = document.createElement('canvas'); glCanvas.id = 'gpu18-gl'; glCanvas.setAttribute('aria-hidden', 'true');
    hudCanvas = document.createElement('canvas'); hudCanvas.id = 'gpu18-hud'; hudCanvas.setAttribute('aria-hidden', 'true');
    view.insertAdjacentElement('afterend', glCanvas);
    glCanvas.insertAdjacentElement('afterend', hudCanvas);
    glCanvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); st.lost = true; resources = false; try { sync(); } catch (err) { warnOnce('lost', err); } }, false);
    glCanvas.addEventListener('webglcontextrestored', () => { st.lost = false; try { initGL(); checkSoon(); sync(); } catch (err) { warnOnce('restore', err); } }, false);
    // the game's "unwriting" desaturation is a CSS class on #view: mirror it onto the layer that now shows the view
    try { new MutationObserver(() => { const u = view.classList.contains('unwrite'); glCanvas.classList.toggle('unwrite', u); hudCanvas.classList.toggle('unwrite', u); }).observe(view, { attributes: true, attributeFilter: ['class'] }); } catch (e) { /* old browser */ }
    viewCtx = Engine.ctx;
    hudCtx = hudCanvas.getContext('2d');
    if (hudCtx) wrapHudCtx(hudCtx);
    try {
      const game = document.getElementById('game');
      if (typeof ResizeObserver !== 'undefined' && game) new ResizeObserver(() => { sizeDirty = true; }).observe(game);
      window.addEventListener('resize', () => { sizeDirty = true; });
    } catch (e) { /* fine */ }
  }
  // Probe: a hardware context first (failIfMajorPerformanceCaveat), otherwise note a software one only when asked for it.
  function probe(force) {
    if (st.available === true && gl) return true;
    makeLayers(); if (!glCanvas) { st.available = false; return false; }
    const attrs = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
    let g = null;
    try { g = glCanvas.getContext('webgl2', Object.assign({ failIfMajorPerformanceCaveat: true }, attrs)); } catch (e) { g = null; }
    if (!g && force) { try { g = glCanvas.getContext('webgl2', attrs); } catch (e) { g = null; } if (g) st.software = true; }
    if (!g) { if (force) st.available = false; return false; }   // not forced: unknown (maybe software only) until asked
    gl = g;
    try {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      st.renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
      if (/swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i.test(st.renderer)) st.software = true;
    } catch (e) { /* renderer name hidden: fine */ }
    st.available = true;
    initGL();
    return true;
  }

  const VS = '#version 300 es\nin vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}';
  const HEAD = '#version 300 es\nprecision highp float;precision highp int;precision highp usampler2D;precision highp isampler2D;\n';
  // composite: one render pixel. Inputs are integer textures so the CPU's integer maths is reproduced exactly.
  const FS_COMP = HEAD + `
uniform usampler2D uFB; uniform usampler2D uM; uniform sampler2D uD; uniform sampler2D uBloom; uniform usampler2D uLut;
uniform usampler2D uLight; uniform usampler2D uN1; uniform usampler2D uN2; uniform isampler2D uTab; uniform isampler2D uRow;
uniform int uS, uSh;
uniform int uBloomOn; uniform ivec2 uBSize; uniform float uGain, uCap;
uniform int uGradeOn, uSat;
uniform int uCineOn, uDoAer, uDoGrade, uLit;
uniform float uAScale, uFDist, uFNear; uniform ivec3 uA, uF; uniform ivec2 uNoff, uN1S, uN2S; uniform ivec3 uGK;
uniform int uVigCol, uVigRow;
out vec4 o;
bool act(vec4 c){ return c.r + c.g + c.b > 1.5; }
void main(){
  int x = int(gl_FragCoord.x), y = int(gl_FragCoord.y);
  uvec4 p = texelFetch(uFB, ivec2(x, y), 0);
  int r = int(p.r), g = int(p.g), b = int(p.b);
  if (uBloomOn == 1) {
    float uy = (float(y) + 0.5) / 4.0 - 0.5, ux = (float(x) + 0.5) / 4.0 - 0.5;
    int y0 = int(floor(uy)), x0 = int(floor(ux)); float fy = uy - float(y0), fx = ux - float(x0);
    int ya = y0 < 0 ? 0 : y0, yb = y0 + 1 >= uBSize.y ? uBSize.y - 1 : y0 + 1;
    int xa = x0 < 0 ? 0 : x0, xb = x0 + 1 >= uBSize.x ? uBSize.x - 1 : x0 + 1;
    vec4 c00 = texelFetch(uBloom, ivec2(xa, ya), 0), c10 = texelFetch(uBloom, ivec2(xb, ya), 0), c01 = texelFetch(uBloom, ivec2(xa, yb), 0), c11 = texelFetch(uBloom, ivec2(xb, yb), 0);
    if (act(c00) || act(c10) || act(c01) || act(c11)) {
      float w00 = (1.0 - fx) * (1.0 - fy), w10 = fx * (1.0 - fy), w01 = (1.0 - fx) * fy, w11 = fx * fy;
      vec3 a = (c00.rgb * w00 + c10.rgb * w10 + c01.rgb * w01 + c11.rgb * w11) * uGain;
      if (!(a.r < 0.5 && a.g < 0.5 && a.b < 0.5)) {
        a = min(a, vec3(uCap));
        r = int(min(255.0, float(r) + a.r)); g = int(min(255.0, float(g) + a.g)); b = int(min(255.0, float(b) + a.b));
      }
    }
  }
  if (uGradeOn == 1) {
    r = int(texelFetch(uLut, ivec2(r, 0), 0).r); g = int(texelFetch(uLut, ivec2(g, 1), 0).r); b = int(texelFetch(uLut, ivec2(b, 2), 0).r);
    int l = (r * 77 + g * 150 + b * 29) >> 8;
    r = clamp(l + (((r - l) * uSat) >> 8), 0, 255); g = clamp(l + (((g - l) * uSat) >> 8), 0, 255); b = clamp(l + (((b - l) * uSat) >> 8), 0, 255);
  }
  if (uCineOn == 1) {
    int lx = x >> uSh, ly = y >> uSh;
    int lr = 0, lg = 0, lb = 0;
    if (uLit == 1) { uvec4 q = texelFetch(uLight, ivec2(lx, ly), 0); lr = int(q.r); lg = int(q.g); lb = int(q.b); }
    int rowFog = texelFetch(uRow, ivec2(ly, 0), 0).r;
    if (uDoAer == 1 || rowFog > 0) {
      float d = texelFetch(uD, ivec2(lx * uS, ly * uS), 0).r;
      int ka = 0, kf = 0;
      if (d < 1e8) {
        if (uDoAer == 1) { int ai = int(d * uAScale); if (ai > 511) ai = 511; ka = texelFetch(uTab, ivec2(ai, 0), 0).r; }
        if (rowFog > 0 && d >= uFNear) {
          int dk = int(d * uFDist); if (dk > 256) dk = 256;
          int n1 = int(texelFetch(uN1, ivec2((lx + uNoff.x) % uN1S.x, ly % uN1S.y), 0).r);
          int n2 = int(texelFetch(uN2, ivec2((lx + uNoff.y) % uN2S.x, ly % uN2S.y), 0).r);
          int fogN = (rowFog * (n1 + n2)) >> 8;
          kf = (fogN * dk) >> 8;
        }
      }
      int ra = 256 - kf, wa = (ka * ra) >> 8, M = ((256 - ka) * ra) >> 8;
      if (int(texelFetch(uM, ivec2(x, y), 0).r) != 1) {
        r = (r * M + uA.r * wa + uF.r * kf + (lr << 8) + 128) >> 8;
        g = (g * M + uA.g * wa + uF.g * kf + (lg << 8) + 128) >> 8;
        b = (b * M + uA.b * wa + uF.b * kf + (lb << 8) + 128) >> 8;
      } else { r += lr; g += lg; b += lb; }
    } else { r += lr; g += lg; b += lb; }
    if (uDoGrade == 1) {
      int v = texelFetch(uTab, ivec2(texelFetch(uTab, ivec2(y, uVigRow), 0).r + texelFetch(uTab, ivec2(x, uVigCol), 0).r, 1), 0).r;
      int av = uGK.x * v, L = (uGK.y * ((r * 77 + g * 150 + b * 29) >> 8) + uGK.z) * v;
      r = (av * r + L) >> 16; g = (av * g + L) >> 16; b = (av * b + L) >> 16;
    }
    r = clamp(r, 0, 255); g = clamp(g, 0, 255); b = clamp(b, 0, 255);
  }
  o = vec4(float(r), float(g), float(b), 255.0) / 255.0;
}`;
  // post.js bloom bright pass: one cell of the quarter-resolution buffer = 4x4 render pixels
  const FS_BRIGHT = HEAD + `
uniform usampler2D uFB; uniform usampler2D uM; uniform ivec2 uSize;
uniform float uLowL, uIlk, uLampL, uLampS, uSprK, uLampK, uSkyL, uHardL, uSunK;
out vec4 o;
void main(){
  int bx = int(gl_FragCoord.x), by = int(gl_FragCoord.y);
  vec3 s = vec3(0.0);
  for (int j = 0; j < 4; j++) {
    int y = by * 4 + j; if (y >= uSize.y) continue;
    for (int i = 0; i < 4; i++) {
      int x = bx * 4 + i; if (x >= uSize.x) continue;
      uvec4 p = texelFetch(uFB, ivec2(x, y), 0);
      int r = int(p.r), g = int(p.g), b = int(p.b);
      int l = (r * 77 + g * 150 + b * 29) >> 8;
      float lf = float(l);
      if (lf < uLowL) continue;
      int m = int(texelFetch(uM, ivec2(x, y), 0).r);
      vec3 c = vec3(float(r), float(g), float(b));
      if (m == 8) {
        int mx = max(r, max(g, b)), mn = min(r, min(g, b));
        float ln = lf * uIlk, sat = float(mx - mn) * uIlk;
        float w0 = ln >= uLampL && sat > uLampS ? (ln - uLampL) / (255.0 - uLampL) * ((sat - uLampS) > 80.0 ? 1.0 : (sat - uLampS) / 80.0) : 0.0;
        float wgt = w0 > 0.02 ? w0 * uSprK * uIlk * uLampK : 0.0;
        if (wgt > 0.0) s += c * wgt;
        else if (lf >= uHardL) s += c * ((lf - uHardL) / (255.0 - uHardL));
      } else if (m == 1) {
        if (lf >= uSkyL) s += c * ((lf - uSkyL) / (255.0 - uSkyL) * uSunK);
      } else if (lf >= uHardL) s += c * ((lf - uHardL) / (255.0 - uHardL));
    }
  }
  o = vec4(s * 0.125, 0.0);
}`;
  // post.js blur: 5-tap (1 4 6 4 1)/16, clamped at the edges
  const FS_BLUR = HEAD + `
uniform sampler2D uSrc; uniform ivec2 uSize; uniform int uH;
out vec4 o;
void main(){
  int x = int(gl_FragCoord.x), y = int(gl_FragCoord.y);
  vec4 s = vec4(0.0); float K[5] = float[5](0.0625, 0.25, 0.375, 0.25, 0.0625);
  for (int k = -2; k <= 2; k++) {
    int xx = uH == 1 ? clamp(x + k, 0, uSize.x - 1) : x, yy = uH == 1 ? y : clamp(y + k, 0, uSize.y - 1);
    s += texelFetch(uSrc, ivec2(xx, yy), 0) * K[k + 2];
  }
  o = s;
}`;
  // present: integer nearest upscale (sharp bilinear seam for a fractional remainder), or plain bilinear for "Smooth"
  const FS_PRESENT = HEAD + `
uniform sampler2D uImg; uniform vec2 uSrc; uniform vec4 uVP; uniform int uSmooth;
out vec4 o;
void main(){
  vec2 fc = gl_FragCoord.xy - uVP.xy;
  vec2 dev = vec2(fc.x, uVP.w - fc.y);
  vec2 sc = uVP.zw / uSrc;
  vec2 texel = dev / sc, uv;
  if (uSmooth == 1) uv = texel / uSrc;
  else {
    vec2 k = max(floor(sc), vec2(1.0)), tf = floor(texel), cd = texel - tf - 0.5, rr = 0.5 - 0.5 / k;
    uv = (tf + (cd - clamp(cd, -rr, rr)) * k + 0.5) / uSrc;
  }
  o = vec4(texture(uImg, uv).rgb, 1.0);
}`;

  let resources = false, quad = null;
  function compile(fs) {
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error('shader: ' + gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'a'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error('link: ' + gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) || 0;
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  }
  function initGL() {
    resources = false;
    if (!gl || gl.isContextLost()) return;
    st.floatRT = !!gl.getExtension('EXT_color_buffer_float');
    P.comp = compile(FS_COMP); P.bright = compile(FS_BRIGHT); P.blur = compile(FS_BLUR); P.present = compile(FS_PRESENT);
    quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);   // one triangle covers the viewport
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.pixelStorei(gl.PACK_ALIGNMENT, 1);
    for (const k of Object.keys(T)) delete T[k];
    for (const k of Object.keys(FB)) delete FB[k];
    texW = texH = bW = bH = lightW = lightH = vigN = 0;
    // constant tables: the fog noise octaves, quantised exactly as js/cinema14.js does
    if (typeof CINEMA14 !== 'undefined' && CINEMA14.noise) {
      const q = (N, k) => { const a = new Uint8Array(N.data.length); for (let i = 0; i < a.length; i++) a[i] = Math.round(N.data[i] * k * 255); return a; };
      T.n1 = itex(gl.R8UI, CINEMA14.noise.N1.W, CINEMA14.noise.N1.H, gl.RED_INTEGER, gl.UNSIGNED_BYTE, q(CINEMA14.noise.N1, 0.7));
      T.n2 = itex(gl.R8UI, CINEMA14.noise.N2.W, CINEMA14.noise.N2.H, gl.RED_INTEGER, gl.UNSIGNED_BYTE, q(CINEMA14.noise.N2, 0.3));
    }
    T.lut = itex(gl.R8UI, 256, 3, gl.RED_INTEGER, gl.UNSIGNED_BYTE, null);
    resources = true;
  }
  // an unfiltered texture (integer or float), optionally filled
  function itex(fmt, w, h, format, type, data) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, w, h);
    if (data) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, format, type, data);
    t.w = w; t.h = h; return t;
  }
  function target(t) { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return f; }
  function ensureSize(w, h) {
    if (w === texW && h === texH) return;
    for (const k of ['comp', 'b1', 'b2', 'light', 'row', 'tab']) if (T[k]) { gl.deleteTexture(T[k]); delete T[k]; }
    for (const k of ['fbs', 'ms', 'ds']) if (T[k]) { for (const t of T[k]) gl.deleteTexture(t); delete T[k]; }
    for (const k of Object.keys(FB)) { gl.deleteFramebuffer(FB[k]); delete FB[k]; }
    texW = w; texH = h; checkSoon();
    // the per-frame inputs come in pairs, used in turn: a frame's upload never waits for the previous frame's draw
    T.fbs = [0, 1].map(() => itex(gl.RGBA8UI, w, h, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, null));
    T.ms = [0, 1].map(() => itex(gl.R8UI, w, h, gl.RED_INTEGER, gl.UNSIGNED_BYTE, null));
    T.ds = [0, 1].map(() => itex(gl.R32F, w, h, gl.RED, gl.FLOAT, null));
    T.comp = itex(gl.RGBA8, w, h, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindTexture(gl.TEXTURE_2D, T.comp);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    FB.comp = target(T.comp);
    bW = Math.ceil(w / 4); bH = Math.ceil(h / 4);
    if (st.floatRT) { T.b1 = itex(gl.RGBA32F, bW, bH, gl.RGBA, gl.FLOAT, null); T.b2 = itex(gl.RGBA32F, bW, bH, gl.RGBA, gl.FLOAT, null); FB.b1 = target(T.b1); FB.b2 = target(T.b2); }
    // per logical pixel / row / column tables for the cinema pass
    const S = Math.max(1, Math.round(w / 320)), LW = Math.ceil(w / S), LH = Math.ceil(h / S);
    lightW = LW; lightH = LH;
    T.light = itex(gl.RGBA8UI, LW, LH, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, null);
    T.row = itex(gl.R32I, LH, 1, gl.RED_INTEGER, gl.INT, null);
    // row 0: haze table (512); row 1: vignette table (VIG_N + 4); row 2: vignette column index (w); row 3: row index (h)
    vigN = Math.max(1028, w, h);
    T.tab = itex(gl.R32I, vigN, 4, gl.RED_INTEGER, gl.INT, null);
    tabBuf = new Int32Array(vigN * 4); tabKey = '';
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // ---------------------------------------------------------------------------------------------------- the CPU half
  // post.js grade, rebuilt from POST.config exactly as post.js builds it (a test checks the two agree pixel for pixel)
  const lut = new Uint8Array(768); let gradeSat = 256;
  const smooth = (x) => x * x * (3 - 2 * x);
  function buildGrade(F) {
    const C = POST.config, g = C.gradePresets, map = F.map;
    const name = (map && C.grade[map.id]) || (F.outdoor ? C.grade._outdoor : C.grade._indoor);
    const p = g[name] || g.candle;
    const dk = F.outdoor ? clamp(F.skyDay == null ? 1 : F.skyDay, 0, 1) : 1;
    const q = (dk * 32) | 0;
    const tod = F.tod == null ? 0.5 : F.tod;
    const warm = F.outdoor ? Math.exp(-Math.pow(tod - 0.76, 2) / 0.006) + Math.exp(-Math.pow(tod - 0.26, 2) / 0.006) : 0;
    const wq = (clamp(warm, 0, 1) * 8) | 0;
    const kk = F.outdoor ? q / 32 : 1, wk = wq / 8;
    const mix = (a, b) => b + (a - b) * kk;
    const sat = mix(p.day.sat, p.night.sat) + 0.16 * wk, con = mix(p.day.con, p.night.con);
    gradeSat = (sat * 256) | 0;
    const dusk = C.dusk;
    for (let ch = 0; ch < 3; ch++) {
      const gain = mix(p.day.gain[ch], p.night.gain[ch]) * (1 + (dusk[ch] - 1) * wk), lift = mix(p.day.lift[ch], p.night.lift[ch]);
      const keep = p.keep || 0;
      for (let v = 0; v < 256; v++) {
        let u = v / 255;
        u = u * (1 - con) + smooth(u) * con;
        const ge = keep && gain < 1 ? gain + (1 - gain) * keep * u * u * u : gain;
        let o = u * ge * 255 + lift * (1 - u);
        o = o < 0 ? 0 : o > 255 ? 255 : o;
        lut[ch * 256 + v] = o | 0;
      }
    }
  }
  function gradePx(px) {
    let r = lut[px & 255], g = lut[256 + ((px >> 8) & 255)], b = lut[512 + ((px >> 16) & 255)];
    const l = (r * 77 + g * 150 + b * 29) >> 8, sat = gradeSat;
    r = l + (((r - l) * sat) >> 8); g = l + (((g - l) * sat) >> 8); b = l + (((b - l) * sat) >> 8);
    r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
    return (px & 0xff000000) | (b << 16) | (g << 8) | r;
  }

  // ---- js/cinema14.js's light chain, ported (same buffers, same order of operations, so the same numbers). It reads the
  // frame as cinema14 would have: after post.js grade, which on this path runs later in the shader, so the few pixels it
  // reads (lights, sky) are graded here first.
  let FW = 0, FH = 0, FS = 1, LW = 0, LH = 0, w2 = 0, h2 = 0, w3 = 0, h3 = 0;
  let b2 = null, b3 = null, rS = null, rO = null, rowV = null, span0 = null, span1 = null;
  let ux0 = null, ux1 = null, uxf = null, uy0 = null, uy1 = null, uyf = null;
  let lightMap = null, rowFogA = null;
  function ensureC(w, h, S) {
    if (w === FW && h === FH && S === FS) return;
    FW = w; FH = h; FS = S;
    const lw = LW = Math.ceil(w / S), lh = LH = Math.ceil(h / S);
    w2 = Math.ceil(lw / 4); h2 = Math.ceil(lh / 4); w3 = Math.ceil(w2 / 2); h3 = Math.ceil(h2 / 2);
    b2 = new Float32Array(w2 * h2 * 3); b3 = new Float32Array(w3 * h3 * 3);
    rS = new Float32Array(w2 * h2 * 3); rO = new Float32Array(w2 * h2 * 3);
    span0 = new Int32Array(h2); span1 = new Int32Array(h2); rowV = new Float32Array(w2 * 3);
    ux0 = new Int32Array(lw); ux1 = new Int32Array(lw); uxf = new Float32Array(lw); uy0 = new Int32Array(lh); uy1 = new Int32Array(lh); uyf = new Float32Array(lh);
    for (let x = 0; x < lw; x++) { const u = (x + 0.5) / 4 - 0.5, i = Math.floor(u); ux0[x] = clamp(i, 0, w2 - 1); ux1[x] = clamp(i + 1, 0, w2 - 1); uxf[x] = u - i; }
    for (let y = 0; y < lh; y++) { const u = (y + 0.5) / 4 - 0.5, i = Math.floor(u); uy0[y] = clamp(i, 0, h2 - 1); uy1[y] = clamp(i + 1, 0, h2 - 1); uyf[y] = u - i; }
    lightMap = new Uint8Array(lw * lh * 4); rowFogA = new Int32Array(lh);
  }
  const best = { x: 0, y: 0, v: 0 };
  function brightPass(F, S, gr) {
    const fb = F.fb, mbuf = F.mbuf, w = F.w, h = F.h, cb = CINEMA14.T.bloom, cr = CINEMA14.T.rays;
    b2.fill(0); rS.fill(0);
    const out = !!F.outdoor, lk = out ? 0.3 + 0.7 * clamp(F.light == null ? 1 : F.light, 0.1, 1) : 1, ilk = 1 / lk;
    const sprK = out ? 1 - 0.5 * clamp(F.skyDay == null ? 0 : F.skyDay, 0, 1) : 1;
    const lampL = cb.lampLuma, lampS = cb.lampSat, lowL = lampL * lk, lampW = sprK * ilk * cb.lampK / (255 - lampL);
    const sunL = cb.sunLuma, ss = 1 / (255 - sunL), rayL = cr.luma, rs = 1 / (255 - rayL), rg = cr.glow;
    let any = false;
    for (let y = 0, ly = 0; y < h; y += S, ly++) {
      const o = y * w, r2 = (ly >> 2) * w2;
      for (let x = 0, lx = 0; x < w; x += S, lx++) {
        const m = mbuf[o + x];
        if (m !== 8 && m !== 1) continue;
        const p = gr ? gradePx(fb[o + x]) : fb[o + x], r = p & 255, g = (p >> 8) & 255, b = (p >> 16) & 255;
        const l = (r * 77 + g * 150 + b * 29) >> 8, j = (r2 + (lx >> 2)) * 3;
        if (m === 8) {
          if (l < lowL) continue;
          const mx = r > g ? (r > b ? r : b) : (g > b ? g : b), mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
          const ln = l * ilk, sat = (mx - mn) * ilk - lampS;
          if (ln < lampL || sat <= 0) continue;
          const k = (ln - lampL) * lampW * (sat > 80 ? 1 : sat / 80);
          b2[j] += r * k; b2[j + 1] += g * k; b2[j + 2] += b * k; any = true;
          const kr = k * rg; rS[j] += r * kr; rS[j + 1] += g * kr; rS[j + 2] += b * kr;
        } else {
          if (l <= rayL) continue;
          if (l > sunL) { const k = (l - sunL) * ss; b2[j] += r * k; b2[j + 1] += g * k; b2[j + 2] += b * k; any = true; }
          const kr = (l - rayL) * rs * 0.6; rS[j] += r * kr; rS[j + 1] += g * kr; rS[j + 2] += b * kr;
        }
      }
    }
    best.v = 0;
    for (let i = 0, c = 0; c < w2 * h2; c++, i += 3) {
      if (b2[i] + b2[i + 1] + b2[i + 2] !== 0) { b2[i] *= 0.0625; b2[i + 1] *= 0.0625; b2[i + 2] *= 0.0625; }
      if (rS[i] + rS[i + 1] + rS[i + 2] === 0) continue;
      rS[i] *= 0.0625; rS[i + 1] *= 0.0625; rS[i + 2] *= 0.0625;
      const v = rS[i] + rS[i + 1] + rS[i + 2];
      if (v > best.v) { best.v = v; best.x = c % w2; best.y = (c / w2) | 0; }
    }
    return any;
  }
  function down(src, sw, sh, dst, dw, dh) {
    for (let y = 0; y < dh; y++) {
      const ya = Math.min(sh - 1, y * 2), yb = Math.min(sh - 1, y * 2 + 1);
      for (let x = 0; x < dw; x++) {
        const xa = Math.min(sw - 1, x * 2), xb = Math.min(sw - 1, x * 2 + 1), o = (y * dw + x) * 3;
        const i00 = (ya * sw + xa) * 3, i10 = (ya * sw + xb) * 3, i01 = (yb * sw + xa) * 3, i11 = (yb * sw + xb) * 3;
        dst[o] = (src[i00] + src[i10] + src[i01] + src[i11]) * 0.25;
        dst[o + 1] = (src[i00 + 1] + src[i10 + 1] + src[i01 + 1] + src[i11 + 1]) * 0.25;
        dst[o + 2] = (src[i00 + 2] + src[i10 + 2] + src[i01 + 2] + src[i11 + 2]) * 0.25;
      }
    }
  }
  let tScr = new Float32Array(0);
  function blur5(buf, bw, bh) {
    if (tScr.length < buf.length) tScr = new Float32Array(buf.length);
    const t = tScr, xm = bw - 1, ym = bh - 1;
    for (let y = 0; y < bh; y++) {
      const row = y * bw;
      for (let x = 0; x < bw; x++) {
        const a = (row + (x > 1 ? x - 2 : 0)) * 3, b = (row + (x > 0 ? x - 1 : 0)) * 3, o = (row + x) * 3, c = (row + (x < xm ? x + 1 : xm)) * 3, d = (row + (x < xm - 1 ? x + 2 : xm)) * 3;
        t[o] = (buf[a] + 4 * buf[b] + 6 * buf[o] + 4 * buf[c] + buf[d]) * 0.0625;
        t[o + 1] = (buf[a + 1] + 4 * buf[b + 1] + 6 * buf[o + 1] + 4 * buf[c + 1] + buf[d + 1]) * 0.0625;
        t[o + 2] = (buf[a + 2] + 4 * buf[b + 2] + 6 * buf[o + 2] + 4 * buf[c + 2] + buf[d + 2]) * 0.0625;
      }
    }
    for (let y = 0; y < bh; y++) {
      const ra = (y > 1 ? y - 2 : 0) * bw, rb = (y > 0 ? y - 1 : 0) * bw, ro = y * bw, rc = (y < ym ? y + 1 : ym) * bw, rd = (y < ym - 1 ? y + 2 : ym) * bw;
      for (let x = 0; x < bw; x++) {
        const a = (ra + x) * 3, b = (rb + x) * 3, o = (ro + x) * 3, c = (rc + x) * 3, d = (rd + x) * 3;
        buf[o] = (t[a] + 4 * t[b] + 6 * t[o] + 4 * t[c] + t[d]) * 0.0625;
        buf[o + 1] = (t[a + 1] + 4 * t[b + 1] + 6 * t[o + 1] + 4 * t[c + 1] + t[d + 1]) * 0.0625;
        buf[o + 2] = (t[a + 2] + 4 * t[b + 2] + 6 * t[o + 2] + 4 * t[c + 2] + t[d + 2]) * 0.0625;
      }
    }
  }
  const upTabs = {};
  function upTab(cn, fn) {
    const key = cn + '>' + fn;
    let t = upTabs[key]; if (t) return t;
    const a = new Int32Array(fn), b = new Int32Array(fn), f = new Float32Array(fn), sc = cn / fn;
    for (let i = 0; i < fn; i++) { const u = (i + 0.5) * sc - 0.5, j = Math.floor(u); a[i] = clamp(j, 0, cn - 1); b[i] = clamp(j + 1, 0, cn - 1); f[i] = u - j; }
    t = upTabs[key] = { a, b, f }; return t;
  }
  let upRow = new Float32Array(0);
  function upAdd(src, cw, ch, dst, fw, fh, k) {
    const X = upTab(cw, fw), Y = upTab(ch, fh), xa = X.a, xb = X.b, xf = X.f;
    if (upRow.length < cw * 3) upRow = new Float32Array(cw * 3);
    const t = upRow;
    for (let y = 0; y < fh; y++) {
      const fy = Y.f[y], ra = Y.a[y] * cw * 3, rb = Y.b[y] * cw * 3, ky0 = (1 - fy) * k, ky1 = fy * k;
      let nz = 0;
      for (let q = 0; q < cw * 3; q++) { const v = src[ra + q] * ky0 + src[rb + q] * ky1; t[q] = v; if (v !== 0) nz = 1; }
      if (!nz) continue;
      let o = y * fw * 3;
      for (let x = 0; x < fw; x++, o += 3) {
        const fx = xf[x], gx = 1 - fx, i = xa[x] * 3, j = xb[x] * 3;
        dst[o] += t[i] * gx + t[j] * fx; dst[o + 1] += t[i + 1] * gx + t[j + 1] * fx; dst[o + 2] += t[i + 2] * gx + t[j + 2] * fx;
      }
    }
  }
  function rays(at, noFlash) {
    const c = CINEMA14.T.rays;
    if (best.v < 1) return false;
    const bx = best.x + 0.5, by = best.y + 0.5, steps = c.steps, decay = c.decay, reach = c.reach / steps;
    const sh = noFlash ? 1 : 1 + c.shimmer * Math.sin(at * 1.1) * Math.sin(at * 0.43 + 1.1);
    const str = c.str * sh / steps * 2;
    for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
      const dx = (bx - (x + 0.5)) * reach, dy = (by - (y + 0.5)) * reach;
      let sx = x + 0.5, sy = y + 0.5, wt = 1, r = 0, g = 0, b = 0;
      for (let s = 0; s < steps; s++) {
        sx += dx; sy += dy;
        const j = ((sy | 0) * w2 + (sx | 0)) * 3;
        r += rS[j] * wt; g += rS[j + 1] * wt; b += rS[j + 2] * wt; wt *= decay;
      }
      const o = (y * w2 + x) * 3; rO[o] = r * str; rO[o + 1] = g * str; rO[o + 2] = b * str;
    }
    return true;
  }
  const skyCol = [0, 0, 0];
  function skyColour(F, gr) {
    const { w, h, mbuf, fb, horizon } = F; let r = 0, g = 0, b = 0, c = 0;
    const S = F.S || 1, y0 = clamp((horizon | 0) - 6 * S, 0, h - 1);
    for (let y = Math.max(0, y0 - 8 * S); y <= y0; y += S) for (let x = 0, o = y * w; x < w; x += 2 * S) if (mbuf[o + x] === 1) { const p = gr ? gradePx(fb[o + x]) : fb[o + x]; r += p & 255; g += (p >> 8) & 255; b += (p >> 16) & 255; c++; }
    if (c) { skyCol[0] = r / c; skyCol[1] = g / c; skyCol[2] = b / c; } else { skyCol[0] = F.fogR; skyCol[1] = F.fogG; skyCol[2] = F.fogB; }
    return skyCol;
  }
  const AER_N = 512, aerLut = new Int32Array(AER_N);
  function buildAer(aK) { for (let i = 0; i < AER_N; i++) { const k = Math.round(256 * aK * Math.pow(i / (AER_N - 1), CINEMA14.T.aerial.pow)); aerLut[i] = k < 3 ? 0 : k; } }
  const VIG_N = 1024;
  let tabBuf = new Int32Array(0), tabKey = '';

  // What this frame hands to the shaders (filled by the hooks, read by present()).
  const job = { fb: null, dbuf: null, mbuf: null, w: 0, h: 0, S: 1, grade: false, bloom: false, cine: false, bl: null, ci: null };
  const ci = { doAer: 0, doGrade: 0, lit: 0, aScale: 0, fDist: 0, fNear: 0, a: [0, 0, 0], f: [0, 0, 0], o1: 0, o2: 0, gk: [0, 0, 0], needD: false };
  const bl = { lowL: 0, ilk: 1, lampL: 0, lampS: 0, sprK: 1, lampK: 0, skyL: 0, hardL: 0, sunK: 0, gain: 0, cap: 0 };
  const hc = () => typeof document !== 'undefined' && !!document.documentElement && document.documentElement.classList.contains('ac-hc');
  const flagOn = (k) => typeof GFX !== 'undefined' && GFX[k] === true;
  const cineWanted = () => typeof CINEMA14 !== 'undefined' && (flagOn('cineLight') || flagOn('cineFog') || (flagOn('cineGrade') && !hc()));
  // post.js bloom moves to the GPU only when no cinema pass reads the frame after it (the cinema light chain runs on the
  // CPU and must see bloomed colours) and the browser can render into float textures
  const bloomMoves = () => st.floatRT && flagOn('bloom') && !cineWanted();

  // The cinema half that stays on the CPU: the light chain on the small grids, the per-logical-pixel light add, the haze and
  // fog constants, the per-row fog band, the grade constants. Mirrors CINEMA14.hook, minus its full-resolution loop.
  function cinemaCPU(F, gr) {
    const CT = CINEMA14.T;
    const doLight = flagOn('cineLight'), doFogF = flagOn('cineFog'), doGrade = flagOn('cineGrade') && !hc();
    const { w, h } = F, S = F.S || 1;
    const noFlash = !!GFX.noFlash, still = !!GFX.reduceMotion;
    ensureC(w, h, S);
    const flash = F.wx ? F.wx.flash || 0 : 0, fk = clamp(1 - flash * 1.6, 0, 1);
    let lit = false;
    if (doLight && fk > 0.02) {
      const any = brightPass(F, S, gr);
      const hasRays = rays(F.animT || 0, noFlash);
      if (any || hasRays) {
        const bk = CT.bloom.gain * fk * (noFlash ? CT.bloom.noFlashK : 1), n2 = w2 * h2 * 3;
        if (any) {
          down(b2, w2, h2, b3, w3, h3);
          blur5(b3, w3, h3); blur5(b2, w2, h2);
          upAdd(b3, w3, h3, b2, w2, h2, CT.bloom.halo);
          if (hasRays) for (let i = 0; i < n2; i++) b2[i] = b2[i] * bk + rO[i] * fk; else for (let i = 0; i < n2; i++) b2[i] *= bk;
        } else for (let i = 0; i < n2; i++) b2[i] = rO[i] * fk;
        const cap = CT.bloom.cap;
        for (let y = 0, c = 0; y < h2; y++) {
          let s0 = w2, s1 = -1;
          for (let x = 0; x < w2; x++, c++) {
            const i = c * 3;
            if (b2[i] > cap) b2[i] = cap; if (b2[i + 1] > cap) b2[i + 1] = cap; if (b2[i + 2] > cap) b2[i + 2] = cap;
            if (b2[i] + b2[i + 1] + b2[i + 2] > 1.5) { if (s0 === w2) s0 = x; s1 = x; }
          }
          span0[y] = s0; span1[y] = s1; if (s1 >= 0) lit = true;
        }
      }
    }
    // the light add per logical pixel, exactly as the cinema loop works it out row by row (zero outside each row's span)
    lightMap.fill(0);
    if (lit) {
      for (let ly = 0; ly < LH; ly++) {
        const ya = uy0[ly], yb = uy1[ly];
        let c0 = Math.min(span0[ya], span0[yb]), c1 = Math.max(span1[ya], span1[yb]);
        if (c1 < c0) continue;
        const fy = uyf[ly], gy = 1 - fy, A3 = ya * w2 * 3, B3 = yb * w2 * 3;
        const la = Math.max(0, c0 * 4 - 2), lb = Math.min(LW, c1 * 4 + 6);
        if (c0 > 0) c0--; if (c1 < w2 - 1) c1++;
        for (let q = c0 * 3, qe = c1 * 3 + 3; q < qe; q++) rowV[q] = b2[A3 + q] * gy + b2[B3 + q] * fy;
        for (let lx = la, o = (ly * LW + la) * 4; lx < lb; lx++, o += 4) {
          const fx = uxf[lx], gx = 1 - fx, i = ux0[lx] * 3, j = ux1[lx] * 3;
          lightMap[o] = (rowV[i] * gx + rowV[j] * fx + 0.5) | 0; lightMap[o + 1] = (rowV[i + 1] * gx + rowV[j + 1] * fx + 0.5) | 0; lightMap[o + 2] = (rowV[i + 2] * gx + rowV[j + 2] * fx + 0.5) | 0;
        }
      }
    }
    // haze, fog and grade constants
    const out = !!F.outdoor, far = F.far === true, base = F.fogDist || 12;
    const doAer = doFogF && !(out && far);
    const A = CT.aerial, Fo = CT.fog;
    ci.doAer = doAer ? 1 : 0; ci.doGrade = doGrade ? 1 : 0; ci.lit = lit ? 1 : 0;
    rowFogA.fill(0);
    if (doFogF) {
      const sky = skyColour(F, gr);
      buildAer(out ? A.out : A.inn);
      ci.a = [(out ? sky[0] : A.inCol[0]) | 0, (out ? sky[1] : A.inCol[1]) | 0, (out ? sky[2] : A.inCol[2]) | 0];
      ci.aScale = (AER_N - 1) / (base * A.reach);
      ci.f = [(out ? sky[0] * Fo.outMul + Fo.outAdd[0] : Fo.inCol[0]) | 0, (out ? sky[1] * Fo.outMul + Fo.outAdd[1] : Fo.inCol[1]) | 0, (out ? sky[2] * Fo.outMul + Fo.outAdd[2] : Fo.inCol[2]) | 0];
      ci.fDist = 256 / (base * Fo.distK); ci.fNear = Fo.near;
      const tt = still ? 0 : (F.animT || 0);
      const o1 = Math.round(tt * Fo.drift1), o2 = Math.round(tt * Fo.drift2);
      const N1 = CINEMA14.noise.N1, N2 = CINEMA14.noise.N2;
      ci.o1 = ((o1 % N1.W) + N1.W) % N1.W; ci.o2 = ((o2 % N2.W) + N2.W) % N2.W;
      const horizon = F.horizon;
      for (let ly = 0; ly < LH; ly++) {
        const below = ((ly + 0.5) * S - horizon) / h;
        if (below >= -Fo.above) rowFogA[ly] = Math.round(256 * Fo.a * Math.max(0, 1 - Math.abs(below) * Fo.band));
      }
    }
    ci.needD = doAer || doFogF;
    if (doGrade) {
      const g = CT.grade;
      ci.gk = [Math.round(g.con * g.sat * 256), Math.round(g.con * (1 - g.sat) * 256), Math.round((128 - 128 * g.con) * 256)];
    }
    return true;
  }
  // the haze table and the vignette tables for the shader (rebuilt when the size or the tunables change)
  function fillTab(w, h) {
    const g = CINEMA14.T.grade, key = w + 'x' + h + '|' + g.vig + '|' + g.vigPow + '|' + Array.prototype.join.call(aerLut.subarray(0, 8), ',') + aerLut[AER_N - 1];
    if (key === tabKey) return false;
    tabKey = key;
    const N = vigN, t = tabBuf; t.fill(0);
    for (let i = 0; i < AER_N; i++) t[i] = aerLut[i];
    for (let i = 0; i < VIG_N + 4; i++) t[N + i] = Math.round(256 * (1 - g.vig * Math.pow(Math.min(1, i / (VIG_N - 1)), g.vigPow)));
    const cx = w / 2, cy = h / 2, r2 = cx * cx + cy * cy, M = VIG_N - 1;
    for (let x = 0; x < w; x++) t[2 * N + x] = Math.floor((x + 0.5 - cx) * (x + 0.5 - cx) / r2 * M);
    for (let y = 0; y < h; y++) t[3 * N + y] = Math.floor((y + 0.5 - cy) * (y + 0.5 - cy) / r2 * M);
    return true;
  }

  // ---- the hooks: hide the frame from each moved pass for its one call, then put it back ------------------------------
  let hid = null;
  function hide(F, what) { if (!st.presenting) return; hid = { k: what, v: F[what] }; F[what] = null; }
  function unhide(F) { if (hid) { F[hid.k] = hid.v; hid = null; } }
  function wireHooks() {
    if (typeof Engine === 'undefined' || !Engine.addPostHook) return;
    // post.js bloom returns at once without F.dbuf; post.js grade and cinema14 without F.fb
    Engine.addPostHook((F) => { if (st.presenting && job.bloom) hide(F, 'dbuf'); }, 29.99);
    Engine.addPostHook(unhide, 30.01);
    Engine.addPostHook((F) => { if (st.presenting && job.grade) hide(F, 'fb'); }, 39.99);
    Engine.addPostHook(unhide, 40.01);
    Engine.addPostHook((F) => { if (st.presenting && job.cine) hide(F, 'fb'); }, 94.99);
    Engine.addPostHook((F) => {
      unhide(F);
      if (!st.presenting) return;
      const t0 = st.profile ? now() : 0;
      try {
        if (job.grade) buildGrade(F);
        if (job.cine) cinemaCPU(F, job.grade);
        if (job.bloom) {
          const c = POST.config.bloom, flash = F.wx ? F.wx.flash : 0, fk = clamp(1 - flash * c.flashCut, 0, 1);
          if (fk <= 0.02) bl.on = false;
          else {
            const lk = F.outdoor ? 0.3 + 0.7 * clamp(F.light, 0.1, 1) : 1;
            Object.assign(bl, { on: true, lowL: c.lampLuma * lk, ilk: 1 / lk, lampL: c.lampLuma, lampS: c.lampSat, sprK: F.outdoor ? 1 - 0.5 * clamp(F.skyDay == null ? 0 : F.skyDay, 0, 1) : 1, lampK: c.lampK, skyL: c.skyLuma, hardL: c.hardLuma, sunK: c.sunK, gain: c.gain * fk, cap: c.cap * fk });
          }
        }
      } catch (e) { warnOnce('cpu half', e); job.cine = false; }
      job.fb = F.fb; job.dbuf = F.dbuf; job.mbuf = F.mbuf; job.w = F.w; job.h = F.h; job.S = F.S || 1; job.ready = true;
      if (st.profile) st.stats.cpuLight += now() - t0;
    }, 95.01);
  }

  // ---------------------------------------------------------------------------------------------------- present
  let sizeDirty = true;
  function fitLayers() {
    const game = document.getElementById('game'); if (!game) return;
    const r = game.getBoundingClientRect(), dpr = (typeof devicePixelRatio === 'number' && devicePixelRatio > 0) ? devicePixelRatio : 1;
    const W = Math.max(320, Math.round(r.width * dpr)), H = Math.max(200, Math.round(r.height * dpr));
    if (W !== devW || H !== devH) { devW = W; devH = H; glCanvas.width = W; glCanvas.height = H; hudCanvas.width = W; hudCanvas.height = H; }
    sizeDirty = false;
  }
  // HUD layer: Engine.ctx while the compositor shows. Code that sets a transform does so in the 3D canvas's own pixels
  // (logical x S); this layer maps those to device pixels, so every caller keeps working unchanged.
  let kx = 4, ky = 4;
  function wrapHudCtx(c) {
    const proto = Object.getPrototypeOf(c);
    const S = () => (typeof Engine !== 'undefined' && Engine.getScale ? Engine.getScale() : 1);
    c.setTransform = function (a, b, cc, d, e, f) {
      if (a && typeof a === 'object') { const m = a; a = m.a; b = m.b; cc = m.c; d = m.d; e = m.e; f = m.f; }
      const s = S(), sx = kx / s, sy = ky / s;
      return proto.setTransform.call(this, a * sx, b * sy, cc * sx, d * sy, e * sx, f * sy);
    };
    c.resetTransform = function () { const s = S(); return proto.setTransform.call(this, kx / s, 0, 0, ky / s, 0, 0); };
    c._gpu18Base = function () { proto.setTransform.call(this, kx, 0, 0, ky, 0, 0); };
  }
  function beginHud() {
    kx = devW / VW; ky = devH / VH;
    const c = hudCtx;
    c._gpu18Base(); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none'; c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, VW, VH);
  }
  function upload() {
    const w = job.w, h = job.h;
    ensureSize(w, h);
    pp ^= 1; T.fb = T.fbs[pp]; T.m = T.ms[pp]; T.d = T.ds[pp];
    gl.bindTexture(gl.TEXTURE_2D, T.fb); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, new Uint8Array(job.fb.buffer, job.fb.byteOffset, w * h * 4));
    if ((job.bloom && bl.on) || job.cine) { gl.bindTexture(gl.TEXTURE_2D, T.m); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RED_INTEGER, gl.UNSIGNED_BYTE, job.mbuf); }
    if (job.cine && ci.needD) { gl.bindTexture(gl.TEXTURE_2D, T.d); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RED, gl.FLOAT, job.dbuf); }
    if (job.grade) { gl.bindTexture(gl.TEXTURE_2D, T.lut); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 3, gl.RED_INTEGER, gl.UNSIGNED_BYTE, lut); }
    if (job.cine) {
      if (ci.lit) { gl.bindTexture(gl.TEXTURE_2D, T.light); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, lightW, lightH, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, lightMap); }
      gl.bindTexture(gl.TEXTURE_2D, T.row); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, lightH, 1, gl.RED_INTEGER, gl.INT, rowFogA);
      if (fillTab(w, h)) { gl.bindTexture(gl.TEXTURE_2D, T.tab); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, vigN, 4, gl.RED_INTEGER, gl.INT, tabBuf); }
    }
  }
  function bind(prog, name, unit, tex) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex || null); if (prog.u[name]) gl.uniform1i(prog.u[name], unit); }
  function draw() { gl.drawArrays(gl.TRIANGLES, 0, 3); }
  function present() {
    if (!job.ready || !gl || gl.isContextLost() || !resources) return false;
    const t0 = st.profile ? now() : 0;
    if (sizeDirty) fitLayers();
    upload();
    const t1 = st.profile ? now() : 0;
    const w = job.w, h = job.h;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    const bloomNow = job.bloom && bl.on;
    if (bloomNow) {
      gl.viewport(0, 0, bW, bH);
      gl.bindFramebuffer(gl.FRAMEBUFFER, FB.b1); gl.useProgram(P.bright.p);
      bind(P.bright, 'uFB', 0, T.fb); bind(P.bright, 'uM', 1, T.m);
      const u = P.bright.u; gl.uniform2i(u.uSize, w, h);
      gl.uniform1f(u.uLowL, bl.lowL); gl.uniform1f(u.uIlk, bl.ilk); gl.uniform1f(u.uLampL, bl.lampL); gl.uniform1f(u.uLampS, bl.lampS); gl.uniform1f(u.uSprK, bl.sprK);
      gl.uniform1f(u.uLampK, bl.lampK); gl.uniform1f(u.uSkyL, bl.skyL); gl.uniform1f(u.uHardL, bl.hardL); gl.uniform1f(u.uSunK, bl.sunK);
      draw();
      gl.useProgram(P.blur.p); gl.uniform2i(P.blur.u.uSize, bW, bH);
      const radius = Math.max(0, POST.config.bloom.radius | 0);
      for (let p = 0; p < radius; p++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, FB.b2); bind(P.blur, 'uSrc', 0, T.b1); gl.uniform1i(P.blur.u.uH, 1); draw();
        gl.bindFramebuffer(gl.FRAMEBUFFER, FB.b1); bind(P.blur, 'uSrc', 0, T.b2); gl.uniform1i(P.blur.u.uH, 0); draw();
      }
    }
    // composite at render resolution
    gl.bindFramebuffer(gl.FRAMEBUFFER, FB.comp); gl.viewport(0, 0, w, h); gl.useProgram(P.comp.p);
    const C = P.comp, u = C.u;
    bind(C, 'uFB', 0, T.fb); bind(C, 'uM', 1, T.m); bind(C, 'uD', 2, T.d); bind(C, 'uBloom', 3, T.b1 || null); bind(C, 'uLut', 4, T.lut);
    bind(C, 'uLight', 5, T.light); bind(C, 'uN1', 6, T.n1); bind(C, 'uN2', 7, T.n2); bind(C, 'uTab', 8, T.tab); bind(C, 'uRow', 9, T.row);
    const sh = job.S === 2 ? 1 : 0;
    gl.uniform1i(u.uS, job.S); gl.uniform1i(u.uSh, sh);
    gl.uniform1i(u.uBloomOn, bloomNow ? 1 : 0); gl.uniform2i(u.uBSize, bW, bH); gl.uniform1f(u.uGain, bl.gain); gl.uniform1f(u.uCap, bl.cap);
    gl.uniform1i(u.uGradeOn, job.grade ? 1 : 0); gl.uniform1i(u.uSat, gradeSat);
    gl.uniform1i(u.uCineOn, job.cine ? 1 : 0); gl.uniform1i(u.uDoAer, ci.doAer); gl.uniform1i(u.uDoGrade, ci.doGrade); gl.uniform1i(u.uLit, ci.lit);
    gl.uniform1f(u.uAScale, ci.aScale); gl.uniform1f(u.uFDist, ci.fDist); gl.uniform1f(u.uFNear, ci.fNear);
    gl.uniform3i(u.uA, ci.a[0], ci.a[1], ci.a[2]); gl.uniform3i(u.uF, ci.f[0], ci.f[1], ci.f[2]); gl.uniform2i(u.uNoff, ci.o1, ci.o2);
    gl.uniform2i(u.uN1S, T.n1 ? T.n1.w : 1, T.n1 ? T.n1.h : 1); gl.uniform2i(u.uN2S, T.n2 ? T.n2.w : 1, T.n2 ? T.n2.h : 1); gl.uniform3i(u.uGK, ci.gk[0], ci.gk[1], ci.gk[2]);
    gl.uniform1i(u.uVigCol, 2); gl.uniform1i(u.uVigRow, 3);
    draw();
    // present to the device-resolution canvas: the 3D view is the top VIEW_H / VH of it; the HUD layer covers the rest
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const DW = gl.drawingBufferWidth || devW, DH = gl.drawingBufferHeight || devH;   // may be smaller than asked for
    gl.viewport(0, 0, DW, DH); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    const h3 = Math.round(DH * VIEW_H / VH);
    gl.viewport(0, DH - h3, DW, h3);
    gl.useProgram(P.present.p); bind(P.present, 'uImg', 0, T.comp);
    gl.uniform2f(P.present.u.uSrc, w, h); gl.uniform4f(P.present.u.uVP, 0, DH - h3, DW, h3);
    pres.DW = DW; pres.DH = DH; pres.h3 = h3;
    const smoothUp = typeof PRESETS !== 'undefined' && PRESETS.upscale && PRESETS.upscale.mode === 'smooth';
    gl.uniform1i(P.present.u.uSmooth, smoothUp ? 1 : 0);
    draw();
    st.stats.lastPasses = { bloom: bloomNow, grade: job.grade, cine: job.cine, w, h, devW, devH };
    if (st.profile) { const t2 = now(); st.stats.upload += t1 - t0; st.stats.gl += t2 - t1; }
    st.stats.frames++;
    return true;
  }

  // ---------------------------------------------------------------------------------------------------- self-check
  // Right after a present (same task, so the drawing buffer is still there): read the composited view back, and a few
  // presented pixels, and compare with the CPU frame the raycaster made. The GPU applies the grade, so colours differ a
  // little; what must never happen is a black picture where the CPU frame is plainly lit.
  const pres = { DW: 0, DH: 0, h3: 0 };
  const CHECK = { first: 3, again: [30, 150], every: 3600, darkL: 12, litL: 40, badShare: 0.6, minN: 24 };
  let checkBase = 0, checkAt = CHECK.first, checkIdx = 0, compBuf = null, presBuf = new Uint8Array(4);
  function checkSoon() { checkBase = st.stats.frames; checkAt = checkBase + CHECK.first; checkIdx = 0; }
  const lumaPx = (p) => ((p & 255) * 77 + ((p >> 8) & 255) * 150 + ((p >> 16) & 255) * 29) >> 8;
  function selfCheck() {
    const f = st.stats.frames;
    if (f < checkAt || !gl || !resources) return;
    checkAt = checkIdx < CHECK.again.length ? Math.max(f + 1, checkBase + CHECK.again[checkIdx++]) : f + CHECK.every;
    const w = texW, h = texH, fb = job.fb, mb = job.mbuf; if (!fb || !w || fb.length < w * h) return;
    if (!compBuf || compBuf.length !== w * h * 4) compBuf = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, FB.comp);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, compBuf);
    // a sparse grid; sky pixels (material 1) are what the owner saw go black, so they are judged on their own too
    let n = 0, bad = 0, sn = 0, sbad = 0;
    const sx = Math.max(1, (w / 40) | 0), sy = Math.max(1, (h / 24) | 0);
    for (let y = (sy >> 1); y < h; y += sy) for (let x = (sx >> 1); x < w; x += sx) {
      const i = y * w + x, cl = lumaPx(fb[i]); if (cl < CHECK.litL) continue;
      const o = i * 4, gl2 = (compBuf[o] * 77 + compBuf[o + 1] * 150 + compBuf[o + 2] * 29) >> 8;
      n++; if (gl2 < CHECK.darkL) bad++;
      if (mb && mb[i] === 1) { sn++; if (gl2 < CHECK.darkL) sbad++; }
    }
    // what was actually presented: the middle row of the view, five points, against the composite they came from
    let pn = 0, pbad = 0;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (pres.DW && pres.h3) {
      for (let k = 1; k <= 5; k++) {
        const ry = (h * 0.3) | 0, rx = ((w * k) / 6) | 0, o = (ry * w + rx) * 4;
        const cl = (compBuf[o] * 77 + compBuf[o + 1] * 150 + compBuf[o + 2] * 29) >> 8; if (cl < CHECK.litL) continue;
        const dx = Math.min(pres.DW - 1, Math.floor((rx + 0.5) * pres.DW / w)), dy = pres.DH - pres.h3 + Math.min(pres.h3 - 1, Math.floor((h - 1 - ry + 0.5) * pres.h3 / h));
        gl.readPixels(dx, dy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, presBuf);
        pn++; if (((presBuf[0] * 77 + presBuf[1] * 150 + presBuf[2] * 29) >> 8) < CHECK.darkL) pbad++;
      }
    }
    const err = gl.getError();
    const verdict = (n >= CHECK.minN && bad / n >= CHECK.badShare) || (sn >= CHECK.minN && sbad / sn >= CHECK.badShare) || (pn >= 3 && pbad / pn >= CHECK.badShare);
    const c = st.check; c.runs++;
    c.last = { frame: f, n, bad, sky: sn, skyBad: sbad, presented: pn, presentedBad: pbad, glError: err, ok: !verdict };
    if (!verdict) { c.streak = 0; return; }
    c.bad++; c.streak++;
    checkAt = f + 2;   // look again straight away: one odd frame is not a verdict
    if (c.streak >= 2) {
      c.failedBy = 'black picture where the frame is lit (sky ' + sbad + '/' + sn + ', all ' + bad + '/' + n + ', presented ' + pbad + '/' + pn + ', gl error ' + err + ')';
      fail(new Error('self-check: ' + c.failedBy));
    }
  }

  // ---------------------------------------------------------------------------------------------------- on / off
  function sync() {
    const want = showing();
    const game = typeof document !== 'undefined' ? document.getElementById('game') : null;
    if (want && !st.shown) {
      if (!viewCtx) viewCtx = Engine.ctx;
      Engine.ctx = hudCtx; st.shown = true; sizeDirty = true; checkSoon();
      if (game) game.classList.add('gpu18-on');
    } else if (!want && st.shown) {
      Engine.ctx = viewCtx; st.shown = false;
      if (game) game.classList.remove('gpu18-on');
    }
    syncRow();
    return st.shown;
  }
  function setEnabled(v, opts) {
    v = !!v;
    if (v && !gl) probe(true);
    GFX.gpuCompositor = v && !!st.available;
    st.choice = v; if (!(opts && opts.noSave)) saveChoice(v);
    if (GFX.gpuCompositor) st.failed = false;
    sync();
    return GFX.gpuCompositor;
  }
  function fail(e) {
    warnOnce('present', e);
    st.failed = true; sync();
  }

  // the outermost render(): the game's frame (raycaster, hooks, HUD) then the GL present
  function wireRender() {
    if (typeof render !== 'function') return;
    const _render = render;
    render = function () {
      // a context lost since the last frame: this frame goes to the canvas at once (the event follows later)
      if (gl && !st.lost && st.shown && gl.isContextLost()) { st.lost = true; resources = false; }
      if (st.shown !== showing()) sync();
      if (!st.shown || typeof G === 'undefined' || !G.map) return _render.apply(this, arguments);
      if (sizeDirty) fitLayers();
      if (ext) { try { beginHud(); } catch (e) { warnOnce('hud', e); } return _render.apply(this, arguments); }   // R3D presents the view
      job.ready = false; job.grade = flagOn('grade') && typeof POST !== 'undefined'; job.cine = cineWanted(); job.bloom = typeof POST !== 'undefined' && bloomMoves(); bl.on = false;
      try { beginHud(); } catch (e) { fail(e); return _render.apply(this, arguments); }
      st.presenting = true;
      let r; const t0 = st.profile ? now() : 0;
      try { r = _render.apply(this, arguments); } finally { st.presenting = false; if (hid) hid = null; }
      if (st.profile) st.stats.inner += now() - t0;
      try {
        if (present()) selfCheck();
        else if (job.ready && !(gl && gl.isContextLost())) fail(new Error('present failed'));
        else if (gl && gl.isContextLost()) { st.lost = true; resources = false; sync(); }
      } catch (e) { if (gl && gl.isContextLost()) { st.lost = true; resources = false; sync(); } else fail(e); }
      return r;
    };
  }

  // ---------------------------------------------------------------------------------------------------- Options row
  const ROW = ['gpu-comp', 'GPU compositor', 'WebGL2: crisp HUD text, colour passes on the graphics card'];
  function syncRow() {
    if (typeof document === 'undefined') return;
    const b = document.getElementById(ROW[0]); if (!b) return;
    const avail = st.available !== false;
    const v = !!GFX.gpuCompositor && avail;
    b.textContent = avail ? (v ? 'On' : 'Off') : 'Not available';
    b.disabled = !avail; b.setAttribute('aria-pressed', v ? 'true' : 'false'); b.classList.toggle('sel', v);
    const lab = document.getElementById(ROW[0] + '-hint');
    if (lab) lab.textContent = avail ? (originalish() && v ? 'the Original preset always uses the classic canvas' : ROW[2]) : 'WebGL2 is not available on this device';
  }
  function appendRow() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById(ROW[0]) || !document.getElementById('gfx-state')) return;
    const lab = document.createElement('span'); lab.className = 'gfx-label'; lab.id = ROW[0] + '-label'; lab.textContent = ROW[1] + ' ';
    const small = document.createElement('small'); small.className = 'muted'; small.id = ROW[0] + '-hint'; small.textContent = ROW[2]; lab.appendChild(small);
    const b = document.createElement('button'); b.className = 'dfbtn small'; b.id = ROW[0]; b.type = 'button'; b.setAttribute('aria-label', ROW[1]);
    b.onclick = () => { if (st.available === null) probe(true); setEnabled(!GFX.gpuCompositor); };
    const anchor = document.getElementById('cine-grade') || document.getElementById('gfx-curve');
    if (anchor && anchor.parentNode === grid) { anchor.insertAdjacentElement('afterend', b); anchor.insertAdjacentElement('afterend', lab); }
    else { grid.appendChild(lab); grid.appendChild(b); }
    syncRow();
  }
  function wireMenu() {
    if (typeof renderAccessibilityMenu !== 'function') return;
    const _acc = renderAccessibilityMenu;
    renderAccessibilityMenu = function () {
      const r = _acc.apply(this, arguments);
      try { appendRow(); } catch (e) { warnOnce('row', e); }
      return r;
    };
  }

  // ---------------------------------------------------------------------------------------------------- tests and tools
  // the last composited 3D frame at render resolution, as ABGR pixels (top row first), the same layout as Engine's fb
  function readFrame() {
    if (!gl || !resources || !texW || gl.isContextLost()) return null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, FB.comp);
    const out = new Uint8Array(texW * texH * 4);
    gl.readPixels(0, 0, texW, texH, gl.RGBA, gl.UNSIGNED_BYTE, out);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { w: texW, h: texH, fb: new Uint32Array(out.buffer) };
  }
  // post.js grade as this module rebuilds it, on one pixel (tests compare it with post.js itself)
  function gradeOne(F, px) { buildGrade(F); return gradePx(px) >>> 0; }

  // ---------------------------------------------------------------------------------------------------- boot
  function boot() {
    makeLayers();
    wireHooks(); wireRender(); wireMenu();
    st.choice = loadChoice();
    if (st.choice === false) { GFX.gpuCompositor = false; probeLater(false); }
    else if (st.choice === true) { probe(true); GFX.gpuCompositor = !!st.available; }
    else { probe(false); GFX.gpuCompositor = !!(st.available && !st.software); }   // auto: hardware only
    if (typeof GFX !== 'undefined' && GFX.onChange) GFX.onChange(() => { try { checkSoon(); sync(); } catch (e) { warnOnce('sync', e); } });
    sync();
  }
  // whether WebGL2 exists at all, for the Options row, without keeping a context
  function probeLater() {
    try { st.available = typeof WebGL2RenderingContext !== 'undefined' ? null : false; } catch (e) { st.available = false; }
  }
  try { boot(); } catch (e) { warnOnce('boot', e); }

  return {
    KEY, st, stats: st.stats, setEnabled, sync, readFrame, gradeOne, present, claimHud, hudClaim: () => ext, checkSoon, CHECK,
    probeGL: (force) => probe(!!force),
    active: () => st.shown, available: () => st.available === true, software: () => st.software, renderer: () => st.renderer,
    wanted, layers: () => ({ gl: glCanvas, hud: hudCanvas, hudCtx, viewCtx }), gl: () => gl,
    get profile() { return st.profile; }, set profile(v) { st.profile = !!v; },
    resetStats() { Object.assign(st.stats, { frames: 0, inner: 0, upload: 0, cpuLight: 0, gl: 0 }); },
  };
})();
if (typeof window !== 'undefined') window.GPU18 = GPU18;
