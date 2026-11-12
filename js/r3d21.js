// ============================================================
//  r3d21 — Phase 21 "Wow", team CORE: R3D, a true 3D WebGL2 renderer for the same maps, with a free-look camera.
//
//  ===================================================================================================================
//  THE R3D CONTRACT  (stable: LIGHT, SPRITES and BODY code against this; CORE keeps it backward compatible)
//  ===================================================================================================================
//  0. WHAT R3D IS. When R3D is active, Engine.render() still runs its preamble (sky rows, point lights with their wall
//     masks, fog/haze, far mode) and then hands the frame to R3D (Engine.setRenderOverride) instead of the CPU passes.
//     R3D draws the map with WebGL2 on its own canvas (#r3d21-gl) and the game's HUD keeps drawing on gpu18's device-
//     resolution HUD layer (GPU18.claimHud), so drawHUD and every module that paints on Engine.ctx works unchanged.
//     The CPU raycaster stays the fallback: no WebGL2, a software rasteriser on auto, a lost context, the Original preset,
//     the Options row "3D renderer" set to Classic, or any error in a frame. Under R3D the CPU sky hooks and post hooks
//     (FI.fb passes) do NOT run; their looks move into R3D passes (see R3D.cpuHooks() for the inventory).
//     Gameplay never reads R3D: collision, AI, line of sight, noise and saves use map data as always; R3D.pick()
//     answers exactly what Engine.pick() would on the CPU frame (see 6).
//
//  1. WORLD SPACE AND UNITS. GL world = (x, y, z*ZK): x, y are map cells (1 unit = one cell), z is the game's height
//     (eye 0.5 on flat ground, walls 1 unit tall) multiplied by R3D.ZK = 0.61875. The raycaster's projection is
//     anisotropic (a wall one cell wide and one unit tall is 242 x 150 logical pixels at distance 1); scaling heights by ZK
//     makes it an ordinary isotropic pinhole camera that reproduces the raycaster's picture exactly at pitch 0, so true
//     3D (looking up and down, real lighting, normals) is plain geometry. Use R3D.toGL(x, y, z) / R3D.ZK. Normals and
//     lights live in GL space. A sprite's width/height in GL units: see 4.
//
//  2. THE CAMERA. Engine.cam stays the source of truth: x, y, z (game units), dir (radians), bob (logical rows) and pitch,
//     which keeps its old meaning "horizon offset in logical rows" so every module that reads or resets it still works.
//     The look angle is R3D.camera.angle() = atan(pitch / FX) with FX = 160 / 0.66 = 242.42 (logical px focal length);
//     R3D.camera.setAngle(a) writes pitch = FX * tan(a). The game's look() is wrapped: free look runs in angle space
//     (both renderers), clamped to +-R3D.camera.limit() — about 80 degrees under R3D (the Options "Look range" comfort
//     choice caps it at 45), 110 rows (about 24 degrees) when the CPU raycaster draws (its y-shear; checked to 150),
//     and exactly the old +-40 rows in the Original preset. The crosshair is the view centre, which is the camera's
//     forward ray. Gamepad right stick vertical and touch drag pitch the camera too.
//     Per frame, F.view / F.proj / F.viewProj / F.invViewProj (Float32Array(16), column-major), F.eye, F.fwd, F.right, F.up
//     (GL world), F.fwdH (horizontal forward, xy), F.pitchA (rad). Projection: x_ndc = (FX/160) Xc/Zc,
//     y_ndc = (FX/75) Yc/Zc - bob/75 (the bob is a lens shift, as on the CPU), depth: near F.near, far F.far.
//
//  3. THE FRAME: R3D.frame (one object, reused) — read it in hooks and passes:
//       gl, w, h (render target px), devW, devH, vpY (where the view sits on the canvas, y from the bottom), pxK (render px
//       per logical px), cam {x,y,z,dir,pitch,bob}, pitchA, eye, fwd, right, up, fwdH, view, proj, viewProj, invViewProj,
//       near, far, map, outdoor, tod, time (the engine's animT, s), now (performance.now()/1000), dt (s), env (the engine's
//       frame values: fogR/G/B 0..255 per unit of light, fogPx displayed fog colour ABGR, fogDist, light, ambient, flick,
//       skyDay, far, farHaze, skyR/G/B rows, wx {haze,dark,flash,cloud}, ptLights (the engine's point lights with masks),
//       detail...), ents (the final entity list the engine was given), opts, ZK, FX, relief (bool), targets (see 5).
//
//  4. SPRITES. Everything that isn't map geometry is submitted as instances, batched into one draw per frame:
//       R3D.sprites.submit(inst) with inst = {
//         sprite: an Engine sprite object {w,h,data,emit?} (or a name in Engine.sprites),
//         x, y: map position; z: GL height of the bottom edge (default: the ground there, R3D.groundGL(x, y)),
//         w, h: GL size (a raycaster sprite of scale s is h = ZK*s*hs, w = h*sp.w/sp.h),
//         cx: anchor 0..1 across (default sp.cx), flip, skew (top shifts by skew*h along the camera's right), alpha 0..1
//         (ordered dither like the CPU), mode: 'upright' (default: vertical, facing the camera's horizontal view plane,
//         exactly the CPU's screen-aligned rect at pitch 0) | 'face' (faces the camera fully) | 'ground' (lies flat,
//         w along the camera's right, h along its horizontal forward), fi (brightness 0..1; default: the CPU's fog/ambient
//         formula at that distance), light [r,g,b] 0..1 (default: the engine's point lights at x,y), hurt 0..1, flash
//         (bool), mat (Engine.MAT id written to the aux target, default sprite 6; emissive pixels write 8), ent (the entity:
//         R3D then fills ent._screen with its on-screen rect in logical 320x150 px and its depth, for HUD overlays) }.
//       The entity pass is a provider: R3D.sprites.setProvider(fn(F, ents, submit)) replaces CORE's default (which draws
//       every entity the way the CPU does: directional views, anim fields, glow, flash, hurt, elite light, emissive
//       masks). R3D.sprites.defaultProvider(F, ents, submit) stays callable, so a provider can wrap it. Sprite pixels go
//       into an atlas (TEXTURE_2D_ARRAY, 1024x1024 pages, nearest, 4 mip levels made with the engine's own sprite-mip rule
//       so distant sprites don't sparkle; alpha 0 / 255 / 128 = transparent / opaque / emissive); a sprite whose .data is
//       replaced re-uploads itself;
//       call R3D.sprites.dirty(sp) after editing .data in place. Instance shading goes through the 'shade' chunk (kind 1).
//       js/sprites21.js: when a global SPRITES21 with frame() exists (and no provider is set), it replaces CORE's batch:
//       R3D calls SPRITES21.attach(gl) per context, SPRITES21.frame(ents, F.sview) per frame with the engine's final list,
//       drawOpaque(view) + drawDecals(view) in 'sprites' and drawTranslucent(view) in 'transparent', with the scene target
//       bound. F.sview = { vp (map space, z game units -> clip), eye, dir, pitch (rad), pitchRows, fogDist, outdoor, fog,
//       fogPx, light, ambient, flick, lights, px, spriteAspect (ZK), shade: 'cpu', w, h, ZK, R3D, F } (see buildSpriteView).
//
//  5. PASSES AND TARGETS. A frame is a list of passes sorted by order; each is { name, order, init(gl, R), draw(gl, F, R),
//     resize(w, h, F), dispose(gl), enabled(F) } (all optional but draw). R3D.addPass(p) adds one; a pass with the name of
//     an existing pass replaces it (R3D.passes() lists them). init runs at creation and again after a lost context is
//     restored: create GL resources there. CORE's passes:
//        0 'sky'        backdrop into the scene target: gradient by elevation from the engine's sky rows, clouds, sun and
//                       moon; indoors the fog colour. LIGHT replaces it (dome, layered clouds, stars, panoramas, aurora).
//       10 'prepass'    world geometry depth only (the depth pre-pass)
//       20 'world'      world geometry: ground, slopes, walls, low walls and stands, caps, ceilings, decals, doors and
//                       gates (animated from map.doors), water (animated)
//       30 'sprites'    the sprite batch (4)
//       40 'body'       (free) BODY's first-person body: clear depth or use its own depth range there
//       50 'transparent'(free) water reflections, weather, particles that blend
//       90 'post'       scene target -> the canvas (CORE: a plain nearest copy). LIGHT replaces it (tone map, grade,
//                       bloom on emissives, fog, vignette) and must write the final picture into the bound framebuffer
//                       with the viewport R3D set (R3D.bindOutput(gl, F) does both).
//     Every pass between 0 and 89 draws into F.targets.scene: color0 = scene colour (RGBA16F when the browser can render to
//     float, else RGBA8; CORE writes display-referred 0..1, LIGHT may write linear HDR), color1 = aux RGBA8 (r = material
//     id / 255 as Engine.MAT, g = emissive 0..1, b = free, a = 1), depth = DEPTH24 (sampleable: F.targets.scene.depthTex).
//     Shaders made with R3D.program() declare the two outputs as oColor / oAux. F.targets.scene.{fb,color,aux,depthTex}.
//     R3D.bindScene(gl, F) binds the scene target with its viewport. With antialiasing (4x on High and above, hardware
//     only) passes draw into a multisampled twin; F.targets.scene.{color,aux,depthTex} are valid from order 90 on (R3D
//     resolves before the first pass at 90); a pass below 90 that samples them calls R3D.resolveScene(gl, F) first.
//
//  6. PICKING AND READ-BACK. R3D.pick(ents, maxDist) is Engine.pick under R3D (Engine.pick is wrapped): it evaluates the
//     raycaster's own rule (the crosshair column, the centre row and the eye row, the +-4 px window, relief occlusion) on
//     a virtual CPU frame of the last rendered camera, so its answers are the raycaster's answers (test/r3d21.test.js
//     checks a grid of view directions). Engine.pickWall is untouched (a map walk). R3D.depthAt(lx, ly) / materialAt(lx, ly)
//     (Engine.depthAt/materialAt are wrapped under R3D): the last frame's view depth (GL units along the view axis, 1e9 for
//     sky) and Engine.MAT id at a logical 320x150 pixel, read back from the GPU one frame late. R3D.project(x, y, zGame) ->
//     {x, y (logical px), depth} or null; R3D.unproject(lx, ly) -> {o: [3], d: [3]} a GL world ray. R3D.groundGL(x, y).
//
//  7. SHADERS, CHUNKS, UNIFORMS. R3D.program(vsBody, fsBody, opts) compiles a program with the common header: GLSL ES 3.0,
//     the std140 uniform block R3DFrame (binding 0; fields below), the R3DLights block (binding 1) and the chunks.
//     Chunks are named GLSL pieces CORE's own shaders include; R3D.setChunk(name, glsl, { uniforms(gl, prog, F) })
//     replaces one and recompiles every program that uses it. CORE's chunks:
//       'shade': vec3 r3dShade(R3DSurf s) — the colour written for a lit surface. struct R3DSurf { vec3 albedo; vec3 pos;
//                vec3 nrm; float side; float mat; float emissive; float fi; vec3 ladd; int kind; } (kind 0 world,
//                1 sprite, 2 body). CORE's version is the raycaster's: fog to the fog colour by perpendicular distance,
//                ambient, side shading 0.8, indoor flicker, the point lights with their wall masks (capped as on the CPU).
//                LIGHT replaces it (clustered lights, sun/moon, shadows, height fog...).
//       'common': helpers every program gets (r3dLinearDepth(z), r3dBayer(ivec2)).
//       'landmarks': vec4 r3dLandmarks(float azimuth, float tanElevation) — the engine's horizon ridges (LANDMARKS) for
//                this map and hour, rgb + coverage; include it (opts.chunks) in a sky program and CORE sets its uniforms.
//     R3DFrame (std140): mat4 uViewProj, uView, uProj, uInvViewProj; vec4 uEye (xyz eye GL, w engine animT);
//       uFwd (xyz forward, w pitch angle); uRight (xyz, w ZK); uUp (xyz, w render px per logical px); uFwdH (xy horizontal
//       forward, z near, w far); uFog (rgb fog colour 0..1 per unit of light, w 1/fogDist); uFogPx (rgb displayed fog/haze,
//       w fogDist); uLit (x light, y ambient, z flicker, w outdoor 0/1); uSky (x skyDay, y tod, z far mode 0/1, w far haze);
//       uWx (haze, dark, cloud, flash); uView2 (x w px, y h px, z real time s, w number of point lights);
//       uMap (x map w, y map h, z detail distance, w ground depth bias in GL units (relief maps) or 0);
//       uFar (x far mix start, y far mix end, z kEff, w ambientDark); uCam (x, y, z game units, w dir).
//     R3DLights (std140, binding 1): vec4 uLP[32] (x, y, r^2, 0), vec4 uLC[32] (rgb 0..1 as the CPU's 0..255/255).
//     Texture units CORE binds for its passes (teams may bind 6 and up freely): 0 world texture array (uTex), 1 detail
//     (uDetail), 2 point-light cell masks (uLVis, R32UI bit i = light i reaches the cell), 3 sprite atlas (uAtlas),
//     4 sky rows (uSkyRows), 5 cloud noise (uCloud). R3D.worldTex(name) -> layer index (texture array) for a texture.
//
//  8. HOOKS. R3D.on(event, fn): 'frame' (F) before any pass (update per-frame data), 'after' (F) after the post pass,
//     'mapchange' (map, F), 'meshbuilt' (map, info), 'lost', 'restored' (gl), 'toggle' (active). R3D.off(event, fn).
//     R3D.invalidate() rebuilds the world mesh next frame (cells change: CORE also notices by itself within a frame for
//     cells, and within half a second for heights/floors/ceilings/decals). R3D.textureDirty(name) re-uploads a texture.
//
//  9. STATE AND SWITCHES. R3D.active() (this frame is R3D's), R3D.available(), R3D.setMode('auto'|'on'|'off'),
//     R3D.mode(), R3D.st (flags, stats), R3D.stats (frame cost: cpu ms per frame, gpu ms when the timer query exists).
//     Storage: localStorage 'octave.r3d21.v1' = { mode, cap }. Auto = on where WebGL2 is hardware accelerated; js/max20.js's
//     safety net turns R3D off first (back to the raycaster) before it steps the preset down. Automation (navigator.
//     webdriver) keeps auto off unless the page sets window.__r3d21 = { automation: true }.
//
//  Loaded after js/max20.js (its own script tag). Nothing here touches saves, RNG, gameplay or story. No assets: every
//  picture comes from the game's own textures and sprites.
// ============================================================
'use strict';

const R3D = (() => {
  const KEY = 'octave.r3d21.v1';
  const ZK = 0.61875;                                   // world height scale: 150 / (160 / 0.66)
  const FX = 160 / 0.66;                                // logical focal length in px (both axes in GL space)
  const LOG_W = 320, LOG_H = 150;                       // the logical 3D view (Engine.VW x Engine.VIEW_H)
  const OLD_PITCH = 40;                                 // the game's original pitch clamp (rows)
  const MAX_LIGHTS = 32;
  const MAT = (typeof Engine !== 'undefined' && Engine.MAT) || { other: 0, sky: 1, water: 2, shallows: 3, wall: 4, ground: 5, sprite: 6, ceiling: 7, glow: 8 };
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const opts0 = (typeof window !== 'undefined' && window.__r3d21 && typeof window.__r3d21 === 'object') ? window.__r3d21 : {};
  const automation = (() => { try { return !!(typeof navigator !== 'undefined' && navigator.webdriver); } catch (e) { return false; } })();

  const st = {
    available: null, software: false, renderer: '', lost: false, failed: false, failWhy: '',
    mode: 'auto', cap: 80, settled: false,     // stored choices
    on: false,                                // the resolved switch (mode + device), before per-frame conditions
    shown: false,                             // our canvas is up and the HUD layer is claimed
    inFrame: false, drew: false,              // inside the game's render(); whether this frame was ours
    floatRT: false, timer: null, aniso: 0, msaa: 0,
    resScale: 1, frames: 0,
    warned: {},
  };
  const stats = { frames: 0, cpu: 0, cpuLast: 0, gpu: 0, gpuLast: null, meshBuilds: 0, meshMs: 0, tris: 0, sprites: 0, draws: 0, uploads: 0, lastMesh: null };
  const warnOnce = (k, e) => { if (st.warned[k]) return; st.warned[k] = true; console.warn('r3d21 ' + k, e); };

  // ---------------------------------------------------------------------------------------------------- events
  const ev = {};
  function on(name, fn) { (ev[name] || (ev[name] = [])).push(fn); return fn; }
  function off(name, fn) { const l = ev[name]; if (!l) return; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); }
  function emit(name, a, b) { const l = ev[name]; if (!l) return; for (let i = 0; i < l.length; i++) { try { l[i](a, b); } catch (e) { warnOnce('hook ' + name, e); } } }

  // ---------------------------------------------------------------------------------------------------- settings
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && typeof o === 'object') {
        if (o.mode === 'auto' || o.mode === 'on' || o.mode === 'off') st.mode = o.mode;
        if (o.cap === 45 || o.cap === 80) st.cap = o.cap;
        st.settled = o.settled === true;
      }
    } catch (e) { /* no storage */ }
  }
  function save() { if (automation && !opts0.automation) return; try { localStorage.setItem(KEY, JSON.stringify({ mode: st.mode, cap: st.cap, settled: st.settled })); } catch (e) { /* no storage */ } }
  function originalish() {
    if (typeof GFX === 'undefined') return true;
    if (GFX.preset === 'plain' || GFX.preset === 'original') return true;
    try { return typeof PRESETS !== 'undefined' && PRESETS.current() === 'original'; } catch (e) { return false; }
  }

  // ---------------------------------------------------------------------------------------------------- math
  function mat4() { return new Float32Array(16); }
  function invert(out, m) {
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
  }
  function mul(out, a, b) {   // out = a * b (column-major)
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return out;
  }
  const toGL = (x, y, z) => [x, y, z * ZK];

  // ---------------------------------------------------------------------------------------------------- the frame
  const F = {
    gl: null, w: 0, h: 0, devW: 0, devH: 0, vpY: 0, vpH: 0, pxK: 1,
    cam: { x: 0, y: 0, z: 0.88, dir: 0, pitch: 0, bob: 0 }, pitchA: 0,
    eye: new Float32Array(3), fwd: new Float32Array(3), right: new Float32Array(3), up: new Float32Array(3), fwdH: new Float32Array(2),
    view: mat4(), proj: mat4(), viewProj: mat4(), invViewProj: mat4(), near: 0.02, far: 200,
    map: null, outdoor: false, tod: 0.5, time: 0, now: 0, dt: 0.016, env: null, ents: null, opts: null,
    ZK, FX, relief: false, targets: {}, S: 1,
  };

  // ---------------------------------------------------------------------------------------------------- GL setup
  let canvas = null, gl = null;
  function makeCanvas() {
    if (canvas || typeof document === 'undefined') return canvas;
    const view = document.getElementById('view'); if (!view || !view.parentNode) return null;
    if (!document.getElementById('r3d21-style')) {
      const s = document.createElement('style'); s.id = 'r3d21-style';
      s.textContent = '#r3d21-gl{position:absolute;inset:0;width:100%;height:100%;display:none;pointer-events:none}' +
        '#game.r3d21-on #r3d21-gl{display:block}#r3d21-gl.unwrite{filter:saturate(0.2) contrast(0.9)}';
      document.head.appendChild(s);
    }
    canvas = document.createElement('canvas'); canvas.id = 'r3d21-gl'; canvas.setAttribute('aria-hidden', 'true');
    // above the CPU view and gpu18's GL layer, below the HUD layer
    const gpuGl = document.getElementById('gpu18-gl');
    (gpuGl || view).insertAdjacentElement('afterend', canvas);
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); st.lost = true; resourcesOK = false; emit('lost'); try { sync(); } catch (err) { warnOnce('lost', err); } }, false);
    canvas.addEventListener('webglcontextrestored', () => { st.lost = false; try { initGL(); emit('restored', gl); sync(); } catch (err) { warnOnce('restore', err); } }, false);
    try { new MutationObserver(() => { canvas.classList.toggle('unwrite', view.classList.contains('unwrite')); }).observe(view, { attributes: true, attributeFilter: ['class'] }); } catch (e) { /* old browser */ }
    try {
      const game = document.getElementById('game');
      if (typeof ResizeObserver !== 'undefined' && game) new ResizeObserver(() => { sizeDirty = true; }).observe(game);
      window.addEventListener('resize', () => { sizeDirty = true; });
    } catch (e) { /* fine */ }
    return canvas;
  }
  const SOFT = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i;
  function probe(force) {
    if (gl && !gl.isContextLost()) return true;
    if (!makeCanvas()) { st.available = false; return false; }
    const attrs = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
    let g = null;
    try { g = canvas.getContext('webgl2', Object.assign({ failIfMajorPerformanceCaveat: true }, attrs)); } catch (e) { g = null; }
    if (!g && force) { try { g = canvas.getContext('webgl2', attrs); } catch (e) { g = null; } if (g) st.software = true; }
    if (!g) { if (force) st.available = false; return false; }
    gl = g; F.gl = g;
    try {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      st.renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
      if (SOFT.test(st.renderer)) st.software = true;
    } catch (e) { /* hidden */ }
    st.available = true;
    initGL();
    return true;
  }

  // ---------------------------------------------------------------------------------------------------- shaders
  const UBO_FRAME_GLSL = `layout(std140) uniform R3DFrame {
  mat4 uViewProj; mat4 uView; mat4 uProj; mat4 uInvViewProj;
  vec4 uEye; vec4 uFwd; vec4 uRight; vec4 uUp; vec4 uFwdH; vec4 uFog; vec4 uFogPx; vec4 uLit; vec4 uSky; vec4 uWx;
  vec4 uView2; vec4 uMap; vec4 uFar; vec4 uCam;
};
layout(std140) uniform R3DLights { vec4 uLP[${MAX_LIGHTS}]; vec4 uLC[${MAX_LIGHTS}]; };
`;
  const HEAD = '#version 300 es\nprecision highp float;precision highp int;precision highp sampler2DArray;precision highp usampler2D;precision highp sampler2D;\n';
  const chunks = {
    common: { src: `
float r3dLinearDepth(float z) { float n = uFwdH.z, f = uFwdH.w; float zn = z * 2.0 - 1.0; return 2.0 * n * f / (f + n - zn * (f - n)); }
int r3dBayer(ivec2 p) { int i = ((p.y & 3) << 2) | (p.x & 3); const int B[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5); return B[i]; }
struct R3DSurf { vec3 albedo; vec3 pos; vec3 nrm; float side; float mat; float emissive; float fi; vec3 ladd; int kind; };
`, opts: null },
    shade: { src: `
uniform highp usampler2D uLVis;
vec3 r3dPointLight(vec2 p) {
  int n = int(uView2.w); if (n <= 0) return vec3(0.0);
  ivec2 c = ivec2(floor(p)); uint bits = 0u;
  if (c.x >= 0 && c.y >= 0 && float(c.x) < uMap.x && float(c.y) < uMap.y) bits = texelFetch(uLVis, c, 0).r;
  if (bits == 0u) return vec3(0.0);
  vec3 s = vec3(0.0);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= n) break;
    if ((bits & (1u << uint(i))) == 0u) continue;
    vec2 d = p - uLP[i].xy; float d2 = dot(d, d);
    if (d2 < uLP[i].z) { float k = 1.0 - d2 / uLP[i].z; s += uLC[i].rgb * (k * k); }
  }
  return min(s, vec3(90.0 / 255.0));
}
// the raycaster's shading: fog by perpendicular distance, ambient, side shade, indoor flicker, point lights
vec3 r3dShade(R3DSurf s) {
  float f;
  vec3 L;
  if (s.kind == 1) { f = s.fi; L = s.ladd; }
  else {
    float d = max(0.0, dot(s.pos.xy - uEye.xy, uFwdH.xy));
    f = clamp(1.0 - d * uFog.w, 0.0, 1.0);
    f = uLit.y + (1.0 - uLit.y) * f;
    f *= s.side;
    if (uLit.w < 0.5) f *= uLit.z;
    f = floor(f * 255.0 + 0.5) / 255.0;
    if (s.emissive > 0.5) f = max(f, 0.95);
    L = r3dPointLight(s.pos.xy + s.nrm.xy * 0.02) + s.ladd;
  }
  vec3 c = uLit.w > 0.5 ? (s.albedo * f + uFog.rgb * (1.0 - f)) * uLit.x + L : s.albedo * f + L;
  return min(c, vec3(1.0));
}
`, opts: null },
    // the engine's distant landmarks (horizon ridges, LANDMARKS in js/upgrades.js), as a function of azimuth and
    // tan(elevation): rgb + coverage. CORE sets the uniforms per frame for any program that includes this chunk.
    landmarks: { src: `
uniform vec4 uLm0[16]; uniform vec4 uLm1[16]; uniform vec4 uLm2[16]; uniform vec4 uLm3[16]; uniform int uLmN; uniform vec4 uLmK;
vec4 r3dLandmarks(float az, float te) {
  vec4 o = vec4(0.0);
  for (int i = 0; i < 16; i++) {
    if (i >= uLmN) break;
    vec4 a = uLm0[i];
    float da = mod(az - a.x + 3.14159265, 6.28318531) - 3.14159265; float t = abs(da) / a.y;
    if (t >= 1.0) continue;
    vec4 b = uLm1[i];
    float prof = pow(1.0 - t, a.w);
    if (b.x != 0.0) prof *= 1.0 + b.x * sin(t * 11.0 + b.y * 2.7) * 0.5;
    float ttop = a.z * 150.0 * max(0.0, prof) / ${FX.toFixed(6)};
    if (te > ttop) continue;
    float v = ttop > 0.0 ? te / ttop : 0.0;
    float mx = min(0.95, 0.30 + 0.5 * t * t + 0.25 * v + b.z * 0.55);
    vec3 sil = uLm2[i].rgb;
    if (uLm2[i].w > 0.5 && v > 1.0 - b.w) { float k = min(1.0, (v - (1.0 - b.w)) / max(0.08, b.w)); sil = mix(sil, uLm3[i].rgb, k); }
    o = vec4((sil * (1.0 - mx) + uFog.rgb * uLmK.y * mx) * uLmK.x, 1.0);
  }
  return o;
}
`, opts: { uniforms: (g, pr, f) => landmarkUniforms(g, pr, f) } },
  };
  const CHUNK_ORDER = ['common', 'shade'];
  // landmark uniforms (map's ridges, the hour's light)
  const lmBuf = [new Float32Array(64), new Float32Array(64), new Float32Array(64), new Float32Array(64)];
  // js/sky.js hands the engine an empty list for a map whose ridges it bakes into its panorama: R3D keeps the originals
  const LM_SEEN = {};
  function snapLandmarks() { try { if (typeof LANDMARKS !== 'undefined') for (const k in LANDMARKS) if (Array.isArray(LANDMARKS[k]) && LANDMARKS[k].length) LM_SEEN[k] = LANDMARKS[k]; } catch (e) { /* none */ } }
  function landmarksOf(id) {
    if (typeof LANDMARKS === 'undefined') return null;
    const l = LANDMARKS[id];
    if (Array.isArray(l) && l.length) { LM_SEEN[id] = l; return l; }
    if (LM_SEEN[id]) return LM_SEEN[id];
    if (l) return l;   // a map whose list is really empty
    const d = LANDMARKS._default; if (Array.isArray(d) && d.length) { LM_SEEN._default = d; return d; }
    return LM_SEEN._default || null;
  }
  function landmarkUniforms(g, pr, f) {
    if (!pr.u.uLmN) return;
    let lms = null;
    try { if (f.outdoor && f.map) lms = landmarksOf(f.map.id); } catch (e) { lms = null; }
    const n = lms ? Math.min(16, lms.length) : 0;
    for (let i = 0; i < n; i++) {
      const lm = lms[i], c = lm.c || [30, 26, 42], cap = lm.cap;
      lmBuf[0].set([lm.a, lm.aw, lm.h, lm.p || 1.6], i * 4);
      lmBuf[1].set([lm.ridge || 0, lm.seed || 0, lm.far || 0, cap ? (lm.capH || 0.3) : 0], i * 4);
      lmBuf[2].set([c[0] / 255, c[1] / 255, c[2] / 255, cap ? 1 : 0], i * 4);
      lmBuf[3].set(cap ? [cap[0] / 255, cap[1] / 255, cap[2] / 255, 0] : [0, 0, 0, 0], i * 4);
    }
    g.uniform1i(pr.u.uLmN, n);
    if (n) { g.uniform4fv(pr.u.uLm0, lmBuf[0]); g.uniform4fv(pr.u.uLm1, lmBuf[1]); g.uniform4fv(pr.u.uLm2, lmBuf[2]); g.uniform4fv(pr.u.uLm3, lmBuf[3]); }
    const env = f.env || {}, dayM = 0.32 + 0.68 * (env.skyDay == null ? 1 : env.skyDay);
    g.uniform4f(pr.u.uLmK, dayM, env.far ? (env.light || 1) / dayM : 1, 0, 0);
  }
  const programs = [];   // every program made by program(): { vs, fs, opts, p, u, chunks }
  function compileProgram(vsSrc, fsSrc, useChunks) {
    const mk = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) {
        const log = gl.getShaderInfoLog(s); const lines = src.split('\n'); const m = /0:(\d+)/.exec(log || ''); const at = m ? (+m[1]) : 0;
        throw new Error('shader: ' + log + (at ? ' @ ' + (lines[at - 1] || '').trim().slice(0, 160) : ''));
      }
      return s;
    };
    const pre = HEAD + UBO_FRAME_GLSL + useChunks.map(n => chunks[n] ? chunks[n].src : '').join('\n');
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, pre + vsSrc));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, pre + fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error('link: ' + gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) || 0;
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); const loc = gl.getUniformLocation(p, a.name); if (loc) u[a.name.replace(/\[0\]$/, '')] = loc; }
    const bi = gl.getUniformBlockIndex(p, 'R3DFrame'); if (bi !== gl.INVALID_INDEX && bi !== 0xFFFFFFFF) gl.uniformBlockBinding(p, bi, 0);
    const bl = gl.getUniformBlockIndex(p, 'R3DLights'); if (bl !== gl.INVALID_INDEX && bl !== 0xFFFFFFFF) gl.uniformBlockBinding(p, bl, 1);
    // fixed texture units for CORE's samplers, so any pass can bind them once per frame
    gl.useProgram(p);
    const units = { uTex: 0, uDetail: 1, uLVis: 2, uAtlas: 3, uSkyRows: 4, uCloud: 5 };
    for (const k in units) if (u[k]) gl.uniform1i(u[k], units[k]);
    return { p, u };
  }
  // R3D.program(vs, fs, { chunks: ['common','shade'] }): the program object keeps .p and .u fresh across recompiles
  function program(vs, fs, o) {
    o = o || {};
    const use = o.chunks || CHUNK_ORDER;
    const P = { vs, fs, opts: o, chunks: use, p: null, u: {} };
    if (gl) { const c = compileProgram(vs, fs, use); P.p = c.p; P.u = c.u; }
    programs.push(P);
    return P;
  }
  function use(P) {
    gl.useProgram(P.p);
    for (const n of P.chunks) { const c = chunks[n]; if (c && c.opts && c.opts.uniforms) { try { c.opts.uniforms(gl, P, F); } catch (e) { warnOnce('chunk uniforms ' + n, e); } } }
    return P;
  }
  function recompileAll(onlyChunk) {
    if (!gl) return;
    for (const P of programs) {
      if (onlyChunk && P.chunks.indexOf(onlyChunk) < 0) continue;
      const c = compileProgram(P.vs, P.fs, P.chunks);
      if (P.p) gl.deleteProgram(P.p);
      P.p = c.p; P.u = c.u;
    }
  }
  function setChunk(name, src, o) {
    if (typeof src !== 'string') throw new Error('chunk source must be a string');
    const prev = chunks[name];
    chunks[name] = { src, opts: o || null };
    if (CHUNK_ORDER.indexOf(name) < 0) CHUNK_ORDER.push(name);
    try { recompileAll(name); } catch (e) { chunks[name] = prev; try { recompileAll(name); } catch (e2) { /* keep */ } throw e; }
  }
  function chunk(name) { return chunks[name] ? chunks[name].src : null; }

  // ---------------------------------------------------------------------------------------------------- GL resources
  let resourcesOK = false, ubo = null, uboL = null, uboBuf = new Float32Array(120), uboLBuf = new Float32Array(MAX_LIGHTS * 8);
  let triVAO = null;
  const T = {};          // textures
  function initGL() {
    resourcesOK = false;
    if (!gl || gl.isContextLost()) return;
    st.floatRT = !!gl.getExtension('EXT_color_buffer_float');
    const an = gl.getExtension('EXT_texture_filter_anisotropic');
    st.aniso = an ? Math.min(4, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 1) : 0; st.anisoExt = an;
    st.timer = gl.getExtension('EXT_disjoint_timer_query_webgl2') || null;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    ubo = gl.createBuffer(); gl.bindBuffer(gl.UNIFORM_BUFFER, ubo); gl.bufferData(gl.UNIFORM_BUFFER, uboBuf.byteLength, gl.DYNAMIC_DRAW);
    uboL = gl.createBuffer(); gl.bindBuffer(gl.UNIFORM_BUFFER, uboL); gl.bufferData(gl.UNIFORM_BUFFER, uboLBuf.byteLength, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    triVAO = gl.createVertexArray();   // the fullscreen triangle needs no buffers (gl_VertexID)
    for (const k of Object.keys(T)) delete T[k];
    world.layers = new Map(); world.cap = 0; world.tex = null; world.srcs = new Map();
    atlas.reset();
    mesh.reset();
    targets.reset();
    // recompile every program (a restored context lost them all); CORE's own are made on the first context
    for (const P of programs) { const c = compileProgram(P.vs, P.fs, P.chunks); P.p = c.p; P.u = c.u; }
    if (!P.world) corePrograms();
    sprInit();
    for (const p of passList) { if (p.init) { try { p.init(gl, api); } catch (e) { warnOnce('pass init ' + p.name, e); } } }
    readback.reset();
    s21gl = null;
    resourcesOK = true;
  }

  // ---------------------------------------------------------------------------------------------------- world textures
  // Every Engine texture is a layer of one TEXTURE_2D_ARRAY (64x64, mipmapped, nearest within a level: the pixel art keeps
  // its texels close up, distance picks a smaller level so nothing shimmers).
  const world = { tex: null, cap: 0, size: 64, layers: new Map(), srcs: new Map(), checkI: 0, sums: new Map() };
  // Phase 77 (js/walls77.js): with "Sharp walls and ground" on, every layer is 256 x 256, enlarged from the tile itself
  const worldSize = () => (typeof HDTEX !== 'undefined' && HDTEX.on() ? HDTEX.SIZE : 64);
  function texSum(d) { let h = 0x811c9dc5; for (let i = 0; i < d.length; i += 61) h = Math.imul(h ^ d[i], 16777619); return h >>> 0; }
  function worldEnsureCap(n) {
    const size = worldSize();
    if (n <= world.cap && world.tex && size === world.size) return false;
    let cap = Math.max(128, world.cap || 0); while (cap < n) cap *= 2;
    const max = gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS) || 256; cap = Math.min(cap, max);
    if (world.tex) gl.deleteTexture(world.tex);
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, size === 64 ? 7 : 9, gl.RGBA8, size, size, cap);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    // no anisotropic filtering: drivers turn it into linear magnification, which would blur the pixel art
    world.tex = t; world.cap = cap; world.size = size;
    // re-upload what we had
    for (const [name, layer] of world.layers) { const d = Engine.textures[name]; if (d) uploadLayer(layer, d); }
    world.mipDirty = true;
    return true;
  }
  function uploadLayer(layer, d) {
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, world.tex);
    const hd = world.size !== 64 ? HDTEX.bytes(d) : null;
    if (hd) gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, world.size, world.size, 1, gl.RGBA, gl.UNSIGNED_BYTE, hd);
    else if (world.size === 64) gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, 64, 64, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(d.buffer, d.byteOffset, 64 * 64 * 4));
    world.mipDirty = true; stats.uploads++;
  }
  // the layer of a texture name (allocated and uploaded on first use); -1 when the engine has no such texture
  function worldTex(name) {
    if (!name) return -1;
    let L = world.layers.get(name);
    const d = Engine.textures[name];
    if (L !== undefined) return d ? L : -1;
    if (!d || !gl) return -1;
    L = world.layers.size;
    world.layers.set(name, L);
    if (!worldEnsureCap(L + 1)) uploadLayer(L, d);
    world.srcs.set(name, d); world.sums.set(name, texSum(d));
    return L;
  }
  function textureDirty(name) { const L = world.layers.get(name); const d = Engine.textures[name]; if (L !== undefined && d && gl) { uploadLayer(L, d); world.srcs.set(name, d); world.sums.set(name, texSum(d)); } }
  // per frame: replaced textures re-upload at once; a few are checksummed in turn to catch edits in place
  function worldCheck() {
    if (!world.tex) return;
    if (worldSize() !== world.size) worldEnsureCap(world.cap);          // the switch was flipped: rebuild at the other size
    for (const [name, L] of world.layers) { const d = Engine.textures[name]; if (d && d !== world.srcs.get(name)) { uploadLayer(L, d); world.srcs.set(name, d); world.sums.set(name, texSum(d)); } }
    const names = Array.from(world.layers.keys()); if (!names.length) return;
    for (let k = 0; k < 3; k++) {
      const name = names[(world.checkI++) % names.length], d = Engine.textures[name]; if (!d) continue;
      const s = texSum(d); if (s !== world.sums.get(name)) { uploadLayer(world.layers.get(name), d); world.sums.set(name, s); }
    }
    if (world.mipDirty) { gl.bindTexture(gl.TEXTURE_2D_ARRAY, world.tex); gl.generateMipmap(gl.TEXTURE_2D_ARRAY); world.mipDirty = false; }
  }

  // ---------------------------------------------------------------------------------------------------- sprite atlas
  // Sprites live in pages of one TEXTURE_2D_ARRAY (1024 x 1024, nearest, no mips), shelf-packed with a 1 px gap.
  // Alpha: 0 transparent (the CPU's alpha <= 100), 255 opaque, 128 opaque and emissive (the sprite's emit mask).
  const atlas = (() => {
    const PAGE = 1024, LV = 4, AL = 8;   // 4 levels; regions sit on an 8-texel grid with an 8-texel gap, so each level
    // of a sprite is its own block (level L of a region at (x, y) lives at (x >> L, y >> L)) and nothing bleeds
    const A = { tex: null, pages: 0, shelves: [], map: new WeakMap(), list: [], uploads: 0, full: false };
    A.reset = function () { A.tex = null; A.pages = 0; A.shelves = []; A.map = new WeakMap(); A.list = []; };
    function grow(n) {
      const max = Math.min(64, gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS) || 64);
      n = Math.min(n, max);
      if (n <= A.pages && A.tex) return false;
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, LV, gl.RGBA8, PAGE, PAGE, n);
      // nearest texels, the level picked by distance: a far sprite shows its smaller copy instead of sparkling
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAX_LEVEL, LV - 1);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (A.tex) gl.deleteTexture(A.tex);
      A.tex = t;
      while (A.shelves.length < n) A.shelves.push([]);
      const old = A.list; A.list = [];
      A.pages = n;
      for (const e of old) if (e.sp) { upload(e); A.list.push(e); }
      return true;
    }
    const up8 = (v) => (v + AL - 1) & ~(AL - 1);
    function place(w, h) {
      const W = up8(w) + AL, H = up8(h) + AL;
      for (let p = 0; p < A.pages; p++) {
        const sh = A.shelves[p];
        let y = 0;
        for (const s of sh) { if (H <= s.h && s.x + W <= PAGE) { const r = { p, x: s.x, y: s.y }; s.x += W; return r; } y = s.y + s.h; }
        if (y + H <= PAGE) { sh.push({ y, h: H, x: W }); return { p, x: 0, y }; }
      }
      return null;
    }
    // level 0 in RGBA bytes: alpha 0 transparent (CPU alpha <= 100), 255 opaque, 128 opaque and emissive
    function level0(sp) {
      const n = sp.w * sp.h * 4, out = new Uint8Array(n), d = sp.data, emit = sp.emit;
      for (let i = 0, o = 0; i < d.length; i++, o += 4) {
        const px = d[i], a = px >>> 24;
        if (a <= 100) continue;
        out[o] = px & 255; out[o + 1] = (px >>> 8) & 255; out[o + 2] = (px >>> 16) & 255; out[o + 3] = emit && emit[i] ? 128 : 255;
      }
      return out;
    }
    // the engine's sprite mip rule (spriteMip): a 2x2 block keeps the mean colour of its solid pixels and is solid when at
    // least two of them are, so thin shapes thin out rather than sparkle; emissive when most of its solid pixels are
    function down(src, w, h) {
      const W = Math.max(1, (w + 1) >> 1), H = Math.max(1, (h + 1) >> 1), out = new Uint8Array(W * H * 4);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let r = 0, g = 0, b = 0, n = 0, em = 0;
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
          const sx = x * 2 + i, sy = y * 2 + j; if (sx >= w || sy >= h) continue;
          const o = (sy * w + sx) * 4; if (!src[o + 3]) continue;
          r += src[o]; g += src[o + 1]; b += src[o + 2]; n++; if (src[o + 3] === 128) em++;
        }
        if (n >= 2) { const o = (y * W + x) * 4; out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = em * 2 > n ? 128 : 255; }
      }
      return { data: out, w: W, h: H };
    }
    function upload(e) {
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, A.tex);
      let lv = { data: level0(e.sp), w: e.w, h: e.h };
      for (let L = 0; L < LV; L++) {
        if (L) lv = down(lv.data, lv.w, lv.h);
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, L, e.x >> L, e.y >> L, e.p, lv.w, lv.h, 1, gl.RGBA, gl.UNSIGNED_BYTE, lv.data);
      }
      e.src = e.sp.data; e.emitSrc = e.sp.emit || null; A.uploads++; stats.uploads++;
    }
    // the atlas entry of a sprite (uploads on first use or when its pixels were replaced)
    A.get = function (sp) {
      if (!sp || !sp.data || !(sp.w > 0) || !(sp.h > 0)) return null;
      let e = A.map.get(sp);
      if (e) {
        if (e.src !== sp.data || e.emitSrc !== (sp.emit || null) || e.dirty) {
          if (sp.w === e.w && sp.h === e.h) { e.dirty = false; upload(e); } else { A.map.delete(sp); e.sp = null; e = null; }
        }
        if (e) return e;
      }
      if (!A.tex) grow(2);
      if (sp.w > PAGE - 2 * AL || sp.h > PAGE - 2 * AL) return null;
      let r = place(sp.w, sp.h);
      if (!r) { if (A.pages >= 64) { if (!A.full) { A.full = true; warnOnce('atlas full', new Error('sprite atlas full')); } return null; } grow(A.pages * 2); r = place(sp.w, sp.h); if (!r) return null; }
      e = { sp, p: r.p, x: r.x, y: r.y, w: sp.w, h: sp.h, src: null, emitSrc: null, dirty: false };
      e.u0 = e.x / PAGE; e.v0 = e.y / PAGE; e.u1 = (e.x + e.w) / PAGE; e.v1 = (e.y + e.h) / PAGE;
      upload(e); A.map.set(sp, e); A.list.push(e);
      return e;
    };
    A.dirty = function (sp) { const e = A.map.get(sp); if (e) e.dirty = true; };
    A.PAGE = PAGE; A.LEVELS = LV;
    return A;
  })();

  // ---------------------------------------------------------------------------------------------------- render targets
  const targets = (() => {
    const TG = { scene: null, w: 0, h: 0 };
    TG.reset = function () { TG.scene = null; TG.w = TG.h = 0; F.targets = {}; };
    function tex2d(fmt, w, h, format, type, filter) {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, w, h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter || gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter || gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    TG.ensure = function (w, h, samples) {
      samples = samples | 0;
      if (TG.scene && w === TG.w && h === TG.h && samples === TG.samples) return false;
      if (TG.scene) { const s = TG.scene; gl.deleteFramebuffer(s.fb); gl.deleteTexture(s.color); gl.deleteTexture(s.aux); gl.deleteTexture(s.depthTex); if (s.ms) { gl.deleteFramebuffer(s.ms.fb); for (const r of s.ms.rb) gl.deleteRenderbuffer(r); } }
      const color = tex2d(st.floatRT ? gl.RGBA16F : gl.RGBA8, w, h, gl.RGBA, st.floatRT ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, gl.LINEAR);
      const aux = tex2d(gl.RGBA8, w, h, gl.RGBA, gl.UNSIGNED_BYTE);
      const depthTex = tex2d(gl.DEPTH_COMPONENT24, w, h, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT);
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, aux, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTex, 0);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error('scene target incomplete: 0x' + status.toString(16));
      // multisampled twin (antialiased edges, the pixel art stays nearest): passes draw into it, resolve() blits it down
      let ms = null;
      if (samples > 1) {
        try {
          const mfb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, mfb);
          const rb = [st.floatRT ? gl.RGBA16F : gl.RGBA8, gl.RGBA8, gl.DEPTH_COMPONENT24].map((fmt, i) => {
            const r = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, r); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, fmt, w, h);
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, i === 2 ? gl.DEPTH_ATTACHMENT : gl.COLOR_ATTACHMENT0 + i, gl.RENDERBUFFER, r); return r;
          });
          gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
          if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) ms = { fb: mfb, rb, samples }; else { gl.deleteFramebuffer(mfb); for (const r of rb) gl.deleteRenderbuffer(r); }
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        } catch (e) { ms = null; warnOnce('msaa', e); }
      }
      TG.scene = { fb, color, aux, depthTex, w, h, hdr: st.floatRT, ms, resolved: true };
      TG.w = w; TG.h = h; TG.samples = samples; F.targets.scene = TG.scene; st.msaa = ms ? samples : 0;
      for (const p of passList) if (p.resize) { try { p.resize(w, h, F); } catch (e) { warnOnce('pass resize ' + p.name, e); } }
      return true;
    };
    TG.tex2d = tex2d;
    return TG;
  })();
  function bindScene(g, f) { const s = (f || F).targets.scene; g.bindFramebuffer(g.FRAMEBUFFER, s.ms ? s.ms.fb : s.fb); g.viewport(0, 0, s.w, s.h); if (s.ms) s.resolved = false; return s; }
  // with antialiasing on, copy the multisampled scene into the sampleable textures (colour, aux, depth); R3D does it before
  // the post pass (order 90); a pass below 90 that samples the scene textures calls it first
  function resolveScene(g, f) {
    const s = (f || F).targets.scene; if (!s || !s.ms || s.resolved) return s;
    g.bindFramebuffer(g.READ_FRAMEBUFFER, s.ms.fb); g.bindFramebuffer(g.DRAW_FRAMEBUFFER, s.fb);
    for (let i = 0; i < 2; i++) {
      g.readBuffer(g.COLOR_ATTACHMENT0 + i);
      g.drawBuffers(i === 0 ? [g.COLOR_ATTACHMENT0, g.NONE] : [g.NONE, g.COLOR_ATTACHMENT1]);
      g.blitFramebuffer(0, 0, s.w, s.h, 0, 0, s.w, s.h, g.COLOR_BUFFER_BIT, g.NEAREST);
    }
    g.blitFramebuffer(0, 0, s.w, s.h, 0, 0, s.w, s.h, g.DEPTH_BUFFER_BIT, g.NEAREST);
    g.drawBuffers([g.COLOR_ATTACHMENT0, g.COLOR_ATTACHMENT1]); g.readBuffer(g.COLOR_ATTACHMENT0);
    g.bindFramebuffer(g.READ_FRAMEBUFFER, null); g.bindFramebuffer(g.DRAW_FRAMEBUFFER, null);
    s.resolved = true;
    return s;
  }
  function bindOutput(g, f) { f = f || F; g.bindFramebuffer(g.FRAMEBUFFER, null); g.viewport(0, f.vpY, f.devW, f.vpH); }

  // ---------------------------------------------------------------------------------------------------- the world mesh
  // One static mesh per map (rebuilt only when its cells, heights, floors, ceilings or decals change) plus a small
  // dynamic mesh for door leaves and lifting gates. Vertex: pos(3, GL) uv(2) tex(4: layer, decal layer or -1, material,
  // side shade + 10 when alpha-tested) nrm(3) = 12 floats.
  const VSTRIDE = 12;
  const mesh = (() => {
    const M = { vao: null, vbo: null, ibo: null, count: 0, map: null, sig: '', sigT: 0, info: null,
      dvao: null, dvbo: null, dibo: null, dcount: 0, dcap: 0, dirty: true };
    M.reset = function () { M.vao = M.vbo = M.ibo = null; M.count = 0; M.map = null; M.sig = ''; M.dvao = M.dvbo = M.dibo = null; M.dcount = 0; M.dcap = 0; M.dirty = true; };
    return M;
  })();
  // growable vertex/index arrays
  function Builder() { this.v = new Float32Array(4096 * VSTRIDE); this.nv = 0; this.i = new Uint32Array(8192); this.ni = 0; }
  Builder.prototype.vert = function (x, y, z, u, v, layer, dec, mat, side, nx, ny, nz) {
    if ((this.nv + 1) * VSTRIDE > this.v.length) { const n = new Float32Array(this.v.length * 2); n.set(this.v); this.v = n; }
    const o = this.nv * VSTRIDE, a = this.v;
    a[o] = x; a[o + 1] = y; a[o + 2] = z * ZK; a[o + 3] = u; a[o + 4] = v; a[o + 5] = layer; a[o + 6] = dec; a[o + 7] = mat; a[o + 8] = side;
    a[o + 9] = nx; a[o + 10] = ny; a[o + 11] = nz * 1;
    return this.nv++;
  };
  Builder.prototype.tri = function (a, b, c) {
    if (this.ni + 3 > this.i.length) { const n = new Uint32Array(this.i.length * 2); n.set(this.i); this.i = n; }
    this.i[this.ni++] = a; this.i[this.ni++] = b; this.i[this.ni++] = c;
  };
  // a quad a-b-c-d, wound so that its front faces along (nx, ny, nz) in GL space
  Builder.prototype.quad = function (a, b, c, d) {
    const v = this.v, A = a * VSTRIDE, B = b * VSTRIDE, C = c * VSTRIDE;
    const ux = v[B] - v[A], uy = v[B + 1] - v[A + 1], uz = v[B + 2] - v[A + 2], wx = v[C] - v[A], wy = v[C + 1] - v[A + 1], wz = v[C + 2] - v[A + 2];
    const cx = uy * wz - uz * wy, cy = uz * wx - ux * wz, cz = ux * wy - uy * wx;
    const dot = cx * v[A + 9] + cy * v[A + 10] + cz * v[A + 11];
    if (dot >= 0) { this.tri(a, b, c); this.tri(a, c, d); } else { this.tri(a, c, b); this.tri(a, d, c); }
  };

  // ---- map helpers (game units) ----
  function ground(m, x, y) {   // ground height at a world point (the engine's gAt over the cell containing it)
    const cx = Math.min(m.w - 1, Math.max(0, Math.floor(x))), cy = Math.min(m.h - 1, Math.max(0, Math.floor(y))), i = cy * m.w + cx;
    if (m.smooth && m.smooth[i]) {
      const W1 = m.w + 1, v = cy * W1 + cx, V = m.verts;
      let fx = x - cx, fy = y - cy; fx = fx < 0 ? 0 : fx > 1 ? 1 : fx; fy = fy < 0 ? 0 : fy > 1 ? 1 : fy;
      return (V[v] * (1 - fx) + V[v + 1] * fx) * (1 - fy) + (V[v + W1] * (1 - fx) + V[v + W1 + 1] * fx) * fy;
    }
    return m.lvls ? m.lvls[i] : 0;
  }
  function cellGround(m, cx, cy, fx, fy) {   // the cell's own ground at fractional (fx, fy) in [0,1]
    const i = cy * m.w + cx;
    if (m.smooth && m.smooth[i]) {
      const W1 = m.w + 1, v = cy * W1 + cx, V = m.verts;
      return (V[v] * (1 - fx) + V[v + 1] * fx) * (1 - fy) + (V[v + W1] * (1 - fx) + V[v + W1 + 1] * fx) * fy;
    }
    return m.lvls ? m.lvls[i] : 0;
  }
  const isBlock = (c) => !!(c && !c.door);
  function wallTop0(m) { return m.ceil ? (m.ceilZ || 1) : 0; }

  // Build the static mesh of a map. Mirrors the CPU's relief walk: a block's face rises from whatever is in front (the
  // neighbour's ground or cap) to its top, in the wall texture above its own base and its side texture below; a rise in
  // open ground is a riser in the higher cell's side texture; caps on blocks; ground per cell (slopes bilinear);
  // ceilings at ceilZ indoors; door cells are ground with their leaves in the dynamic mesh.
  function buildMesh(m) {
    const t0 = now();
    const B = new Builder();
    const relief = !!m.relief;
    const W = m.w, H = m.h, grid = m.cells;
    const floorDef = m.floor || 't_flag';
    const texOfFloor = (cx, cy) => { if (m.floorCells && m.floorTextures) { const idx = m.floorCells[cy * W + cx]; if (idx && m.floorTextures[idx] && Engine.textures[m.floorTextures[idx]]) return m.floorTextures[idx]; } return Engine.textures[floorDef] ? floorDef : 't_flag'; };
    const sideOf = (cx, cy) => { const n = m.sideTex && m.sideTex[cy * W + cx]; return (n && Engine.textures[n]) ? n : texOfFloor(cx, cy); };
    const matOf = (name) => name === 't_water' ? MAT.water : name === 't_shallows' ? MAT.shallows : MAT.ground;
    const decals = m.decals || null;
    const decOf = (ci) => { const n = decals && decals[ci]; return n && Engine.textures[n] ? worldTex(n) : -1; };
    const wTop0 = wallTop0(m);
    const tex = (name) => { const L = worldTex(name); return L < 0 ? worldTex('t_stone') : L; };
    // surface height of a cell at fractional (fx, fy): blocks their top, open cells their ground
    const blockTop = (c, cx, cy, fx, fy) => relief ? (c.top != null ? c.top : Math.max(cellGround(m, cx, cy, fx, fy) + 1, wTop0)) : (c.top != null ? c.top : 1);
    const surfAt = (cx, cy, fx, fy) => {
      const c = grid[cy * W + cx];
      if (isBlock(c)) return blockTop(c, cx, cy, fx, fy);
      return relief ? cellGround(m, cx, cy, fx, fy) : 0;
    };
    let tris = 0;
    // slope normals: each corner's gradient is the mean of the bilinear gradients of the open slope cells that share it,
    // and a sub-quad vertex blends its cell's four corners, so the shading runs on across cell edges (taken from inside
    // each cell alone, a steep slope shaded as a stack of bands, one per row of cells)
    const SM = m.smooth, VV = m.verts, W1 = W + 1, cg = (relief && SM && VV) ? new Float32Array(W1 * (H + 1) * 2) : null;
    if (cg) for (let vy = 0; vy <= H; vy++) for (let vx = 0; vx <= W; vx++) {
      let gx = 0, gy = 0, n = 0;
      for (let k = 0; k < 4; k++) {
        const cx2 = vx - 1 + (k & 1), cy2 = vy - 1 + (k >> 1);
        if (cx2 < 0 || cy2 < 0 || cx2 >= W || cy2 >= H || !SM[cy2 * W + cx2] || isBlock(grid[cy2 * W + cx2])) continue;
        const v0 = cy2 * W1 + cx2, fx = vx - cx2, fy = vy - cy2;
        gx += VV[v0 + fy * W1 + 1] - VV[v0 + fy * W1]; gy += VV[v0 + W1 + fx] - VV[v0 + fx]; n++;
      }
      const o = (vy * W1 + vx) * 2; cg[o] = n ? gx / n : 0; cg[o + 1] = n ? gy / n : 0;
    }
    // ---- ground and caps
    for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) {
      const ci = cy * W + cx, c = grid[ci];
      if (isBlock(c)) {
        if (!relief) continue;   // flat maps: the eye (0.5) is always below a block's top
        const top = blockTop(c, cx, cy, 0.5, 0.5);
        const capName = (c.capTex && Engine.textures[c.capTex]) ? c.capTex : (Engine.textures[c.tex] ? c.tex : 't_stone');
        // a smooth block keeps one flat top (the CPU's cap is flat at top)
        const L = tex(capName);
        const a = B.vert(cx, cy, top, cx, cy, L, -1, MAT.ground, 1, 0, 0, 1), b = B.vert(cx + 1, cy, top, cx + 1, cy, L, -1, MAT.ground, 1, 0, 0, 1);
        const cc = B.vert(cx + 1, cy + 1, top, cx + 1, cy + 1, L, -1, MAT.ground, 1, 0, 0, 1), d = B.vert(cx, cy + 1, top, cx, cy + 1, L, -1, MAT.ground, 1, 0, 0, 1);
        B.quad(a, b, cc, d); tris += 2;
        continue;
      }
      const name = texOfFloor(cx, cy), L = tex(name), mat = matOf(name);
      if (relief && m.smooth && m.smooth[ci]) {
        // a slope: 2x2 sub-quads on the bilinear surface, normals blended from the shared corner gradients
        const idx = [], o00 = (cy * W1 + cx) * 2, o10 = o00 + 2, o01 = o00 + W1 * 2, o11 = o01 + 2;
        for (let j = 0; j <= 2; j++) for (let i = 0; i <= 2; i++) {
          const fx = i / 2, fy = j / 2, z = cellGround(m, cx, cy, fx, fy);
          const gx = (cg[o00] * (1 - fx) + cg[o10] * fx) * (1 - fy) + (cg[o01] * (1 - fx) + cg[o11] * fx) * fy;
          const gy = (cg[o00 + 1] * (1 - fx) + cg[o10 + 1] * fx) * (1 - fy) + (cg[o01 + 1] * (1 - fx) + cg[o11 + 1] * fx) * fy;
          const nx = -gx * ZK, ny = -gy * ZK, nl = Math.hypot(nx, ny, 1);
          idx.push(B.vert(cx + fx, cy + fy, z, cx + fx, cy + fy, L, -1, mat, 1, nx / nl, ny / nl, 1 / nl));
        }
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const a = idx[j * 3 + i]; B.quad(a, a + 1, a + 4, a + 3); tris += 2; }
      } else {
        const z = relief && m.lvls ? m.lvls[ci] : 0;
        const a = B.vert(cx, cy, z, cx, cy, L, -1, mat, 1, 0, 0, 1), b = B.vert(cx + 1, cy, z, cx + 1, cy, L, -1, mat, 1, 0, 0, 1);
        const cc = B.vert(cx + 1, cy + 1, z, cx + 1, cy + 1, L, -1, mat, 1, 0, 0, 1), d = B.vert(cx, cy + 1, z, cx, cy + 1, L, -1, mat, 1, 0, 0, 1);
        B.quad(a, b, cc, d); tris += 2;
      }
    }
    // ---- flat maps: the CPU's floor runs on past the map's edge to the horizon; an apron does the same
    if (!relief) {
      const L = tex(Engine.textures[floorDef] ? floorDef : 't_flag'), R = 160;
      const rects = [[-R, -R, W + R, 0], [-R, H, W + R, H + R], [-R, 0, 0, H], [W, 0, W + R, H]];
      for (const [x0, y0, x1, y1] of rects) {
        const a = B.vert(x0, y0, 0, x0, y0, L, -1, MAT.ground, 1, 0, 0, 1), b = B.vert(x1, y0, 0, x1, y0, L, -1, MAT.ground, 1, 0, 0, 1);
        const cc = B.vert(x1, y1, 0, x1, y1, L, -1, MAT.ground, 1, 0, 0, 1), d = B.vert(x0, y1, 0, x0, y1, L, -1, MAT.ground, 1, 0, 0, 1);
        B.quad(a, b, cc, d); tris += 2;
      }
    }
    // ---- vertical faces: every edge between a cell A and its neighbour N, where A stands higher than N
    // dir: 0 = +x neighbour (face at x = cx+1, normal +x), 1 = -x, 2 = +y, 3 = -y
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const pushFace = (ax, ay, dirI, z0a, z0b, z1a, z1b, name, dec, vTopA, vTopB) => {
      // the face's two bottom points (z0) and two top points (z1) along the edge, endpoints a then b
      // geometry of the edge (endpoints in world xy) and its outward normal
      let xa, ya, xb, yb, nx = 0, ny = 0;
      if (dirI === 0) { xa = ax + 1; ya = ay; xb = ax + 1; yb = ay + 1; nx = 1; }
      else if (dirI === 1) { xa = ax; ya = ay; xb = ax; yb = ay + 1; nx = -1; }
      else if (dirI === 2) { xa = ax; ya = ay + 1; xb = ax + 1; yb = ay + 1; ny = 1; }
      else { xa = ax; ya = ay; xb = ax + 1; yb = ay; ny = -1; }
      // the CPU's texture column rule: on every face u grows toward the viewer's left
      //   +x face: u = frac(y); -x face: u = 1 - frac(y); -y face: u = frac(x); +y face: u = 1 - frac(x)
      let ua, ub;
      if (dirI === 0) { ua = 0; ub = 1; } else if (dirI === 1) { ua = 1; ub = 0; } else if (dirI === 3) { ua = 0; ub = 1; } else { ua = 1; ub = 0; }
      const side = (dirI >= 2) ? 0.8 : 1;
      const L = tex(name);
      const a0 = B.vert(xa, ya, z0a, ua, vTopA - z0a, L, dec, MAT.wall, side, nx, ny, 0);
      const b0 = B.vert(xb, yb, z0b, ub, vTopB - z0b, L, dec, MAT.wall, side, nx, ny, 0);
      const b1 = B.vert(xb, yb, z1b, ub, vTopB - z1b, L, dec, MAT.wall, side, nx, ny, 0);
      const a1 = B.vert(xa, ya, z1a, ua, vTopA - z1a, L, dec, MAT.wall, side, nx, ny, 0);
      B.quad(a0, b0, b1, a1); tris += 2;
    };
    const EPS = 0.02;
    // a face piece between bottom (n) and top (s) lines along the edge, both linear in the edge parameter; clipped to
    // where s > n (+EPS), split at the crossing; v measured down from vTop (linear too)
    const facePiece = (ax, ay, dirI, na, nb, sa, sb, name, dec, vTa, vTb) => {
      const da = sa - na, db = sb - nb;
      if (da <= EPS && db <= EPS) return;
      if (da > EPS && db > EPS) { pushFace(ax, ay, dirI, na, nb, sa, sb, name, dec, vTa, vTb); return; }
      // split where s - n crosses zero: keep the positive end as a triangle-ish quad (degenerate top at the crossing)
      const t = da / (da - db);   // 0..1 along a->b where s == n
      const nm = na + (nb - na) * t, vm = vTa + (vTb - vTa) * t;
      if (da > EPS) pushFaceSub(ax, ay, dirI, 0, t, na, nm, sa, nm, name, dec, vTa, vm);
      else pushFaceSub(ax, ay, dirI, t, 1, nm, nb, nm, sb, name, dec, vm, vTb);
    };
    // a sub-span [t0, t1] of an edge
    const pushFaceSub = (ax, ay, dirI, t0, t1, z0a, z0b, z1a, z1b, name, dec, vTa, vTb) => {
      let xa, ya, xb, yb, nx = 0, ny = 0;
      if (dirI === 0) { xa = ax + 1; ya = ay; xb = ax + 1; yb = ay + 1; nx = 1; }
      else if (dirI === 1) { xa = ax; ya = ay; xb = ax; yb = ay + 1; nx = -1; }
      else if (dirI === 2) { xa = ax; ya = ay + 1; xb = ax + 1; yb = ay + 1; ny = 1; }
      else { xa = ax; ya = ay; xb = ax + 1; yb = ay; ny = -1; }
      let ua, ub;
      if (dirI === 0 || dirI === 3) { ua = 0; ub = 1; } else { ua = 1; ub = 0; }
      const X0 = xa + (xb - xa) * t0, Y0 = ya + (yb - ya) * t0, X1 = xa + (xb - xa) * t1, Y1 = ya + (yb - ya) * t1;
      const U0 = ua + (ub - ua) * t0, U1 = ua + (ub - ua) * t1;
      const side = (dirI >= 2) ? 0.8 : 1, L = tex(name);
      const a0 = B.vert(X0, Y0, z0a, U0, vTa - z0a, L, dec, MAT.wall, side, nx, ny, 0);
      const b0 = B.vert(X1, Y1, z0b, U1, vTb - z0b, L, dec, MAT.wall, side, nx, ny, 0);
      const b1 = B.vert(X1, Y1, z1b, U1, vTb - z1b, L, dec, MAT.wall, side, nx, ny, 0);
      const a1 = B.vert(X0, Y0, z1a, U0, vTa - z1a, L, dec, MAT.wall, side, nx, ny, 0);
      B.quad(a0, b0, b1, a1); tris += 2;
    };
    // the fractional coordinates of an edge's two endpoints inside cell A (for its own height function)
    const edgeF = (dirI) => dirI === 0 ? [1, 0, 1, 1] : dirI === 1 ? [0, 0, 0, 1] : dirI === 2 ? [0, 1, 1, 1] : [0, 0, 1, 0];
    const edgeFN = (dirI) => dirI === 0 ? [0, 0, 0, 1] : dirI === 1 ? [1, 0, 1, 1] : dirI === 2 ? [0, 0, 1, 0] : [0, 1, 1, 1];
    for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) {
      const ci = cy * W + cx, c = grid[ci], blk = isBlock(c);
      if (!blk && !relief) continue;                    // flat maps: only blocks have faces
      for (let k = 0; k < 4; k++) {
        const nxC = cx + DIRS[k][0], nyC = cy + DIRS[k][1];
        if (nxC < 0 || nyC < 0 || nxC >= W || nyC >= H) continue;   // nothing is ever seen from outside the map
        const nc = grid[nyC * W + nxC];
        const ef = edgeF(k), en = edgeFN(k);
        // A's surface along the edge, and N's (the bottom of A's visible face)
        const sa = surfAt(cx, cy, ef[0], ef[1]), sb = surfAt(cx, cy, ef[2], ef[3]);
        let na, nb;
        if (!relief) { na = nb = isBlock(nc) ? (nc.top != null ? nc.top : 1) : 0; }
        else { na = surfAt(nxC, nyC, en[0], en[1]); nb = surfAt(nxC, nyC, en[2], en[3]); }
        if (blk) {
          const name = Engine.textures[c.tex] ? c.tex : 't_stone';
          const dec = decOf(ci);
          if (!relief) { facePiece(cx, cy, k, na, nb, sa, sb, name, dec, sa, sb); continue; }
          // wall part above the block's own base, side part below it
          const ba = cellGround(m, cx, cy, ef[0], ef[1]), bb = cellGround(m, cx, cy, ef[2], ef[3]);
          facePiece(cx, cy, k, Math.max(na, ba), Math.max(nb, bb), sa, sb, name, dec, sa, sb);
          facePiece(cx, cy, k, na, nb, Math.min(ba, sa), Math.min(bb, sb), sideOf(cx, cy), -1, ba, bb);
        } else {
          // open ground (or a door cell): a rise toward the neighbour is a riser in this cell's side texture
          facePiece(cx, cy, k, na, nb, sa, sb, sideOf(cx, cy), -1, sa, sb);
        }
      }
    }
    // ---- door cells: lintels up to a tall room's ceiling and the cap the CPU lays over a shut door (relief maps)
    for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) {
      const ci = cy * W + cx, c = grid[ci];
      if (!c || !c.door || !relief) continue;
      const base = cellGround(m, cx, cy, 0.5, 0.5), or = doorOrient(m, cx, cy);
      if (wTop0 > base + 1) {
        const L = tex('t_stone');
        for (const p of doorPlanes(or)) for (const sgn of [1, -1]) {
          const nx = p === 'x' ? sgn : 0, ny = p === 'y' ? sgn : 0;
          const x0 = p === 'x' ? cx + 0.5 : cx, y0 = p === 'x' ? cy : cy + 0.5, x1 = p === 'x' ? cx + 0.5 : cx + 1, y1 = p === 'x' ? cy + 1 : cy + 0.5;
          const flip = (p === 'x' && sgn < 0) || (p === 'y' && sgn > 0);
          const u0 = flip ? 1 : 0, u1 = flip ? 0 : 1, side = p === 'y' ? 0.8 : 1;
          const a0 = B.vert(x0, y0, base + 1, u0, wTop0 - base - 1, L, -1, MAT.wall, side, nx, ny, 0), b0 = B.vert(x1, y1, base + 1, u1, wTop0 - base - 1, L, -1, MAT.wall, side, nx, ny, 0);
          const b1 = B.vert(x1, y1, wTop0, u1, 0, L, -1, MAT.wall, side, nx, ny, 0), a1 = B.vert(x0, y0, wTop0, u0, 0, L, -1, MAT.wall, side, nx, ny, 0);
          B.quad(a0, b0, b1, a1); tris += 2;
        }
      }
    }
    // ---- ceilings (interiors): one plane at ceilZ over every cell a full wall does not fill
    if (m.ceil && Engine.textures[m.ceil]) {
      const cz = m.ceilZ || 1;
      const cl = m.ceilCells, ctl = m.ceilTextures;
      for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) {
        const ci = cy * W + cx, c = grid[ci];
        if (isBlock(c) && blockTop(c, cx, cy, 0.5, 0.5) >= cz - 1e-4 && c.top == null) continue;
        let name = m.ceil;
        if (cl && ctl) { const idx = cl[ci]; if (idx && ctl[idx] && Engine.textures[ctl[idx]]) name = ctl[idx]; }
        const L = tex(name);
        const a = B.vert(cx, cy, cz, cx, cy, L, -1, MAT.ceiling, 1, 0, 0, -1), b = B.vert(cx + 1, cy, cz, cx + 1, cy, L, -1, MAT.ceiling, 1, 0, 0, -1);
        const cc = B.vert(cx + 1, cy + 1, cz, cx + 1, cy + 1, L, -1, MAT.ceiling, 1, 0, 0, -1), d = B.vert(cx, cy + 1, cz, cx, cy + 1, L, -1, MAT.ceiling, 1, 0, 0, -1);
        B.quad(a, b, cc, d); tris += 2;
      }
    }
    // ---- extensions (js/eaves78.js: roofs, gables, windows): more triangles into the same mesh, same vertex rules
    for (const fn of meshExt) { try { tris += fn(m, { B, tex, MAT, ZK }) | 0; } catch (e) { warnOnce('meshExt', e); } }
    // ---- upload
    if (!mesh.vao) { mesh.vao = gl.createVertexArray(); mesh.vbo = gl.createBuffer(); mesh.ibo = gl.createBuffer(); }
    gl.bindVertexArray(mesh.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo); gl.bufferData(gl.ARRAY_BUFFER, B.v.subarray(0, B.nv * VSTRIDE), gl.STATIC_DRAW);
    vertexLayout();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, B.i.subarray(0, B.ni), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    mesh.count = B.ni; mesh.map = m;
    const ms = now() - t0;
    stats.meshBuilds++; stats.meshMs = ms; stats.tris = tris;
    mesh.info = { map: m.id, verts: B.nv, tris, ms: Math.round(ms * 10) / 10, relief };
    stats.lastMesh = mesh.info;
    emit('meshbuilt', m, mesh.info);
  }
  function vertexLayout() {
    const S4 = VSTRIDE * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, S4, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, S4, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, S4, 20);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, S4, 36);
  }
  // which way a doorway runs: 1 walls north and south (leaf plane x = cell + 0.5), 2 walls east and west (y = cell + 0.5)
  function doorOrient(m, cx, cy) {
    if (typeof Doors !== 'undefined' && Doors.orient) { try { return Doors.orient(null, m.cells, m.w, cy * m.w + cx); } catch (e) { /* fall through */ } }
    const g = m.cells, ci = cy * m.w + cx, n = g[ci - m.w], s = g[ci + m.w], w = g[ci - 1], e = g[ci + 1];
    if (n && s && !(w && e)) return 1; if (w && e && !(n && s)) return 2; return 0;
  }
  // the CPU draws a sliding leaf on whichever mid-plane the ray crosses; a clear doorway has one, an unclear one both
  const doorPlanes = (or) => or === 1 ? ['x'] : or === 2 ? ['y'] : ['x', 'y'];

  // ---- the dynamic mesh: door leaves (sliding or swung) and lifting gates, rebuilt every frame from map.doors
  const dynB = new Builder();
  function buildDoors(m, cam) {
    const B = dynB; B.nv = 0; B.ni = 0;
    const relief = !!m.relief, W = m.w;
    const gates = typeof GATES !== 'undefined' && GFX.gateAnims;
    for (const key in m.doors) {
      const ci = +key, d = m.doors[key], c = m.cells[ci];
      if (!c || !c.door || !d) continue;
      const cx = ci % W, cy = (ci / W) | 0;
      const open = d.open || 0;
      if (open >= 0.98) continue;
      const base = relief ? cellGround(m, cx, cy, 0.5, 0.5) : 0, top = base + 1;
      const L = worldTex(Engine.textures[c.tex] ? c.tex : 't_stone'); if (L < 0) continue;
      const dec = (m.decals && m.decals[ci] && Engine.textures[m.decals[ci]]) ? worldTex(m.decals[ci]) : -1;
      // a lifting gate (js/gates.js): the lattice rises, seen through its gaps
      let g = null;
      if (gates && open > 0) { try { g = GATES.gateInfo(c, m.cells, W, cx, cy); } catch (e) { g = null; } }
      if (g && g.or) {
        // the engine draws nothing for an opening gate (Doors.swing answers "miss"); gates.js draws the lattice once it is
        // past 0.001 open
        if (open > 0.001) {
          const bb = GATES.barBottom(open), Lb = worldTex('gates_bars');
          if (Lb >= 0) {
            const p = g.or === 1 ? 'x' : 'y';
            gateQuad(B, cx, cy, p, base + bb, top, base + bb + 1, Lb);
            if (c.portal) darkBacking(B, cx, cy, p, base, top, cam);
          }
        }
        continue;
      }
      // a swung leaf (js/doors.js): hinge on one edge, turned open*90 degrees, clipped to the cell
      let swung = false;
      if (open > 0 && typeof Doors !== 'undefined' && GFX.swingDoors) {
        if (d._or === undefined) { d._or = doorOrient(m, cx, cy); d._hg = ((cx * 3 + cy * 5) & 1); }
        const or = d._or;
        if (or) {
          if (!d._sw) d._sw = (or === 1 ? cam.x < cx + 0.5 : cam.y < cy + 0.5) ? 1 : -1;
          const th = open * Math.PI / 2, sn = Math.sin(th), cs = Math.cos(th), hg = d._hg, s = d._sw;
          let Hx, Hy, Lx, Ly;
          if (or === 1) { Hx = cx + 0.5; Hy = cy + hg; Lx = s * sn; Ly = (hg ? -cs : cs); } else { Hx = cx + hg; Hy = cy + 0.5; Lx = (hg ? -cs : cs); Ly = s * sn; }
          // clip tau in [0,1] to the cell
          let t1 = 1;
          if (Lx > 1e-9) t1 = Math.min(t1, (cx + 1 - Hx) / Lx); else if (Lx < -1e-9) t1 = Math.min(t1, (cx - Hx) / Lx);
          if (Ly > 1e-9) t1 = Math.min(t1, (cy + 1 - Hy) / Ly); else if (Ly < -1e-9) t1 = Math.min(t1, (cy - Hy) / Ly);
          t1 = clamp(t1, 0, 1);
          const sideK = or === 1 ? 1 : 0.8;
          const ex = Hx + Lx * t1, ey = Hy + Ly * t1;
          // leaf normal (perpendicular to L), both faces; u = tau (hg: 1 - tau), flipped per the CPU's rule by which way
          // the viewer looks: for side 0 (or 1) the face seen looking +x (normal -x) is flipped; side 1: looking -y
          const nx0 = -Ly, ny0 = Lx;
          for (const sg of [1, -1]) {
            const nx = nx0 * sg, ny = ny0 * sg;
            const flipped = or === 1 ? nx < 0 : ny > 0;
            const uA = hg ? 1 : 0, uB = hg ? 1 - t1 : t1;
            const ua = flipped ? 1 - uA : uA, ub = flipped ? 1 - uB : uB;
            const a0 = B.vert(Hx, Hy, base, ua, 1, L, dec, MAT.wall, sideK, nx, ny, 0), b0 = B.vert(ex, ey, base, ub, 1, L, dec, MAT.wall, sideK, nx, ny, 0);
            const b1 = B.vert(ex, ey, top, ub, 0, L, dec, MAT.wall, sideK, nx, ny, 0), a1 = B.vert(Hx, Hy, top, ua, 0, L, dec, MAT.wall, sideK, nx, ny, 0);
            B.quad(a0, b0, b1, a1);
          }
          swung = true;
        }
      }
      if (swung) continue;
      // the sliding leaf: on its mid-plane, covering [open, 1] of the cell, texture u = frac - open (then the face rule)
      for (const p of doorPlanes(doorOrient(m, cx, cy))) {
        for (const sg of [1, -1]) {
          const nx = p === 'x' ? sg : 0, ny = p === 'y' ? sg : 0;
          // side 0 (plane x): the face seen looking +x (normal -x) is flipped; side 1 (plane y): looking -y (normal +y)
          const flipped = p === 'x' ? sg < 0 : sg > 0;
          const f0 = open, f1 = 1;
          const xa = p === 'x' ? cx + 0.5 : cx + f0, ya = p === 'x' ? cy + f0 : cy + 0.5, xb = p === 'x' ? cx + 0.5 : cx + f1, yb = p === 'x' ? cy + f1 : cy + 0.5;
          const uA = 0, uB = 1 - open, ua = flipped ? 1 - uA : uA, ub = flipped ? 1 - uB : uB, side = p === 'y' ? 0.8 : 1;
          const a0 = B.vert(xa, ya, base, ua, 1, L, dec, MAT.wall, side, nx, ny, 0), b0 = B.vert(xb, yb, base, ub, 1, L, dec, MAT.wall, side, nx, ny, 0);
          const b1 = B.vert(xb, yb, top, ub, 0, L, dec, MAT.wall, side, nx, ny, 0), a1 = B.vert(xa, ya, top, ua, 0, L, dec, MAT.wall, side, nx, ny, 0);
          B.quad(a0, b0, b1, a1);
        }
      }
      // relief maps: the CPU lays a cap over a shut door at its top (seen from higher ground)
      if (relief && open < 0.02 && wallTop0(m) <= top) {
        const a = B.vert(cx, cy, top, cx, cy, L, -1, MAT.ground, 1, 0, 0, 1), b = B.vert(cx + 1, cy, top, cx + 1, cy, L, -1, MAT.ground, 1, 0, 0, 1);
        const cc = B.vert(cx + 1, cy + 1, top, cx + 1, cy + 1, L, -1, MAT.ground, 1, 0, 0, 1), dd = B.vert(cx, cy + 1, top, cx, cy + 1, L, -1, MAT.ground, 1, 0, 0, 1);
        B.quad(a, b, cc, dd);
      }
    }
    if (!mesh.dvao) { mesh.dvao = gl.createVertexArray(); mesh.dvbo = gl.createBuffer(); mesh.dibo = gl.createBuffer(); }
    gl.bindVertexArray(mesh.dvao);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.dvbo); gl.bufferData(gl.ARRAY_BUFFER, B.v.subarray(0, Math.max(1, B.nv) * VSTRIDE), gl.DYNAMIC_DRAW);
    vertexLayout();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.dibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, B.i.subarray(0, Math.max(3, B.ni)), gl.DYNAMIC_DRAW);
    gl.bindVertexArray(null);
    mesh.dcount = B.ni;
  }
  // the lifted lattice: both faces, alpha-tested (side shade + 10 marks it), v measured from the lattice's own top
  function gateQuad(B, cx, cy, p, z0, z1, vTop, L) {
    for (const sg of [1, -1]) {
      const nx = p === 'x' ? sg : 0, ny = p === 'y' ? sg : 0, flipped = p === 'x' ? sg < 0 : sg > 0;
      const xa = p === 'x' ? cx + 0.5 : cx, ya = p === 'x' ? cy : cy + 0.5, xb = p === 'x' ? cx + 0.5 : cx + 1, yb = p === 'x' ? cy + 1 : cy + 0.5;
      const ua = flipped ? 1 : 0, ub = flipped ? 0 : 1, side = (p === 'y' ? 0.8 : 1) + 10;
      const a0 = B.vert(xa, ya, z0, ua, vTop - z0, L, -1, MAT.wall, side, nx, ny, 0), b0 = B.vert(xb, yb, z0, ub, vTop - z0, L, -1, MAT.wall, side, nx, ny, 0);
      const b1 = B.vert(xb, yb, z1, ub, vTop - z1, L, -1, MAT.wall, side, nx, ny, 0), a1 = B.vert(xa, ya, z1, ua, vTop - z1, L, -1, MAT.wall, side, nx, ny, 0);
      B.quad(a0, b0, b1, a1);
    }
  }
  // a portal gate opens onto nothing drawable: a dark passage 0.2 behind the bars, as js/gates.js draws it
  function darkBacking(B, cx, cy, p, z0, z1, cam) {
    const L = worldTex('r3d_dark'); if (L < 0) return;
    const off = p === 'x' ? (cam.x < cx + 0.5 ? 0.2 : -0.2) : (cam.y < cy + 0.5 ? 0.2 : -0.2);
    const nx = p === 'x' ? -Math.sign(off) : 0, ny = p === 'y' ? -Math.sign(off) : 0;
    const xa = p === 'x' ? cx + 0.5 + off : cx, ya = p === 'x' ? cy : cy + 0.5 + off, xb = p === 'x' ? cx + 0.5 + off : cx + 1, yb = p === 'x' ? cy + 1 : cy + 0.5 + off;
    const a0 = B.vert(xa, ya, z0, 0, 1, L, -1, MAT.wall, 1, nx, ny, 0), b0 = B.vert(xb, yb, z0, 1, 1, L, -1, MAT.wall, 1, nx, ny, 0);
    const b1 = B.vert(xb, yb, z1, 1, 0, L, -1, MAT.wall, 1, nx, ny, 0), a1 = B.vert(xa, ya, z1, 0, 0, L, -1, MAT.wall, 1, nx, ny, 0);
    B.quad(a0, b0, b1, a1);
  }

  // ---- change detection: the cells every frame (cheap), the per-cell arrays twice a second
  const strHash = new Map();
  function hs(s) { if (!s) return 0; let h = strHash.get(s); if (h === undefined) { h = 0; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; strHash.set(s, h); } return h; }
  function cellSig(m) {
    let h = 0x9e3779b9 | 0; const g = m.cells;
    for (let i = 0; i < g.length; i++) {
      const c = g[i]; let v = 0;
      if (c) v = (hs(c.tex) ^ (c.top != null ? ((c.top * 4096) | 0) * 31 : 7) ^ (c.door ? 0x55 : 0) ^ hs(c.capTex) * 3) | 0;
      h = Math.imul(h ^ v, 0x01000193) + i | 0;
    }
    return h;
  }
  function arrSig(a) { if (!a) return 0; let h = 0x811c9dc5 | 0; for (let i = 0; i < a.length; i++) { const v = a[i]; h = Math.imul(h ^ (typeof v === 'number' ? (v * 4096) | 0 : hs(v)), 16777619) | 0; } return h; }
  function objSig(o) { if (!o) return 0; let h = 7; for (const k in o) h = Math.imul(h ^ ((+k) | 0) ^ hs(o[k]), 16777619) | 0; return h; }
  const refs = (m) => [m.cells, m.lvls, m.verts, m.smooth, m.floorCells, m.ceilCells, m.decals, m.sideTex, m.floorTextures, m.ceilTextures, m.ceil, m.floor, m.ceilZ, m.relief];
  let lastRefs = [], lastCellSig = 0, lastArrSig = 0, arrT = 0;
  function needRebuild(m) {
    if (mesh.dirty || mesh.map !== m || !mesh.vao) return true;
    const r = refs(m);
    for (let i = 0; i < r.length; i++) if (r[i] !== lastRefs[i]) return true;
    const cs = cellSig(m); if (cs !== lastCellSig) return true;
    if (F.now - arrT > 0.5) {
      arrT = F.now;
      const as = arrSig(m.lvls) ^ arrSig(m.verts) * 3 ^ arrSig(m.floorCells) * 5 ^ arrSig(m.ceilCells) * 7 ^ (Array.isArray(m.decals) ? arrSig(m.decals) : objSig(m.decals)) * 11 ^ arrSig(m.sideTex) * 13;
      if (as !== lastArrSig) { lastArrSig = as; return true; }
    }
    return false;
  }
  function ensureMesh(m) {
    if (!needRebuild(m)) return false;
    if (typeof Engine.scanRelief === 'function') { try { Engine.scanRelief(m); } catch (e) { /* keep */ } }
    const first = mesh.map !== m;
    buildMesh(m);
    mesh.dirty = false; lastRefs = refs(m); lastCellSig = cellSig(m);
    lastArrSig = arrSig(m.lvls) ^ arrSig(m.verts) * 3 ^ arrSig(m.floorCells) * 5 ^ arrSig(m.ceilCells) * 7 ^ (Array.isArray(m.decals) ? arrSig(m.decals) : objSig(m.decals)) * 11 ^ arrSig(m.sideTex) * 13;
    arrT = F.now;
    if (first) emit('mapchange', m, F);
    return true;
  }
  function invalidate() { mesh.dirty = true; }
  const meshExt = [];
  function extendMesh(fn) { if (typeof fn === 'function' && !meshExt.includes(fn)) { meshExt.push(fn); mesh.dirty = true; } return fn; }

  // ---------------------------------------------------------------------------------------------------- shaders: world
  const WORLD_VS = `
layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUV; layout(location=2) in vec4 aTex; layout(location=3) in vec3 aNrm;
out vec3 vPos; out vec2 vUV; flat out vec4 vTex; out vec3 vNrm;
void main() { vPos = aPos; vUV = aUV; vTex = aTex; vNrm = aNrm; gl_Position = uViewProj * vec4(aPos, 1.0); }`;
  const WORLD_FS = (variant) => `
uniform sampler2DArray uTex; uniform sampler2D uDetail; uniform int uDetailOn;
in vec3 vPos; in vec2 vUV; flat in vec4 vTex; in vec3 vNrm;
layout(location=0) out vec4 oColor; layout(location=1) out vec4 oAux;
void main() {
  float layer = vTex.x, mat = vTex.z, side = vTex.w;
  bool alphaTest = side > 5.0; if (alphaTest) side -= 10.0;
  vec2 uv = vUV;
  vec4 c;
  if (mat == 2.0 || mat == 3.0) {
    // the CPU's water: rows scroll, columns wave, in whole texels
    ivec2 t = ivec2(floor(fract(uv) * 64.0));
    float sc = mat == 2.0 ? floor(uEye.w * 3.0) : floor(uEye.w * 1.2);
    int wy = mat == 2.0 ? t.y : ((t.y + 16) & 63);
    float wv = floor(sin(float(wy) / 64.0 * 12.566370614 + uEye.w * 1.8) * 1.6 + 0.5);
    if (mat == 3.0) wv = floor(wv / 2.0);
    ivec2 q = ivec2((t.x + int(wv)) & 63, (t.y + int(sc)) & 63);
    vec2 uv2 = floor(uv) + (vec2(q) + 0.5) / 64.0;
    c = textureGrad(uTex, vec3(uv2, layer), dFdx(uv), dFdy(uv));
  } else c = texture(uTex, vec3(uv, layer));
  if (alphaTest && c.a < 0.394) discard;
  if (vTex.y >= 0.0) { vec4 dc = texture(uTex, vec3(uv, vTex.y)); if (dc.a > 0.394) c = dc; }
  float d = max(0.0, dot(vPos.xy - uEye.xy, uFwdH.xy));
  // far mode: distant surfaces fade into their texture's average colour (the 1x1 level), as on the CPU
  if (uSky.z > 0.5 && d > uFar.x) { float k = clamp((d - uFar.x) / max(1e-3, uFar.y - uFar.x), 0.0, 1.0); k = k * k * (3.0 - 2.0 * k); c.rgb = mix(c.rgb, textureLod(uTex, vec3(0.5, 0.5, layer), 6.0).rgb, k); }
  // close-range wall detail, as on the CPU (64x64 greyscale at twice the texel frequency)
  if (uDetailOn == 1 && mat == 4.0 && d < uMap.z) { float dd = texture(uDetail, fract(uv) * 2.0).r; c.rgb *= 1.0 + (dd - 0.5) * 0.45 * (1.0 - d / uMap.z); }
  R3DSurf s; s.albedo = c.rgb; s.pos = vPos; s.nrm = normalize(vNrm); s.side = side; s.mat = mat; s.emissive = mat == 8.0 ? 1.0 : 0.0; s.fi = 1.0; s.ladd = vec3(0.0); s.kind = 0;
  oColor = vec4(r3dShade(s), 1.0);
  oAux = vec4(mat / 255.0, 0.0, 0.0, 1.0);
${variant === 'bias' ? `  // relief maps: ground stands a little further back than it is, so it never swallows the feet of what stands on it
  if (mat == 5.0 || mat == 2.0 || mat == 3.0) { vec4 cp = uViewProj * vec4(vPos + vec3(uFwdH.xy, 0.0) * uMap.w, 1.0); gl_FragDepth = clamp(cp.z / cp.w * 0.5 + 0.5, 0.0, 1.0); }
  else gl_FragDepth = gl_FragCoord.z;` : ''}
}`;
  const DEPTH_FS = (variant) => `
uniform sampler2DArray uTex;
in vec3 vPos; in vec2 vUV; flat in vec4 vTex; in vec3 vNrm;
layout(location=0) out vec4 oColor; layout(location=1) out vec4 oAux;
void main() {
  if (vTex.w > 5.0 && texture(uTex, vec3(vUV, vTex.x)).a < 0.394) discard;
  oColor = vec4(0.0); oAux = vec4(0.0);
${variant === 'bias' ? `  float mat = vTex.z;
  if (mat == 5.0 || mat == 2.0 || mat == 3.0) { vec4 cp = uViewProj * vec4(vPos + vec3(uFwdH.xy, 0.0) * uMap.w, 1.0); gl_FragDepth = clamp(cp.z / cp.w * 0.5 + 0.5, 0.0, 1.0); }
  else gl_FragDepth = gl_FragCoord.z;` : ''}
}`;

  // ---------------------------------------------------------------------------------------------------- shaders: sky
  const TRI_VS = `
out vec2 vNdc;
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0; vNdc = p; gl_Position = vec4(p, 0.0, 1.0); }`;
  const SKY_FS = `
uniform sampler2D uSkyRows; uniform sampler2D uCloud;
uniform vec4 uSun;   // x azimuth, y tan(elevation of the body's centre on screen), z strength, w night (0/1)
uniform vec3 uSunCol;
uniform float uRows; // the engine's sky rows (150 x S)
in vec2 vNdc;
layout(location=0) out vec4 oColor; layout(location=1) out vec4 oAux;
void main() {
  vec4 a = uInvViewProj * vec4(vNdc, 1.0, 1.0); vec4 b = uInvViewProj * vec4(vNdc, -1.0, 1.0);
  vec3 dir = normalize(a.xyz / a.w - b.xyz / b.w);
  if (uLit.w < 0.5) { oColor = vec4(uFog.rgb, 1.0); oAux = vec4(0.0); return; }   // indoors without a ceiling: the dark
  float te = dir.z / max(1e-4, length(dir.xy));            // tan(elevation) in GL space
  if (te < 0.0) { oColor = vec4(uFogPx.rgb, 1.0); oAux = vec4(1.0 / 255.0, 0.0, 0.0, 1.0); return; }   // below the horizon: haze
  // the engine's sky row for this elevation: 112.5 - FX tan(e) logical rows, in the S-scaled row table
  float S = uRows / 150.0;
  float sy = clamp((112.5 - ${FX.toFixed(6)} * te) * S, 0.0, uRows - 1.0);
  vec3 c = texture(uSkyRows, vec2((floor(sy) + 0.5) / uRows, 0.5)).rgb;
  float az = atan(dir.y, dir.x);
  // the engine's drifting cloud band, by azimuth
  float amp = (6.0 + 14.0 * uSky.x) * (1.0 - sy / uRows) / 255.0;
  float ci = mod(floor(az * 412.0 + (sy / S) * 2.1), 1024.0);
  c += texture(uCloud, vec2((ci + 0.5) / 1024.0, 0.5)).r * amp;
  // sun or moon: the CPU's glow and disc, in angles
  float da = az - uSun.x; da = mod(da + 3.14159265, 6.2831853) - 3.14159265; float dA = abs(da);
  if (dA < 0.95) {
    float k = dA / 0.4, glow = exp(-k * k) * uSun.z;
    float dyRow = (uSun.y - te) * ${FX.toFixed(6)} / 66.0;
    float aa = glow * exp(-dyRow * dyRow) * 0.55;
    float dx = da * 176.0 / 7.5, dy = (uSun.y - te) * ${FX.toFixed(6)} / 7.5, dd = sqrt(dx * dx + dy * dy);
    if (dd <= 1.0) aa = max(aa, 0.9 - dd * 0.2);
    c += uSunCol * aa;
  }
  vec4 lm = r3dLandmarks(az, te); if (lm.a > 0.5) c = lm.rgb;
  oColor = vec4(min(c, vec3(1.0)), 1.0); oAux = vec4(1.0 / 255.0, 0.0, 0.0, 1.0);
}`;

  // ---------------------------------------------------------------------------------------------------- shaders: sprites
  // one instanced quad per sprite; instance data in a float buffer (see SPR_STRIDE)
  const SPR_STRIDE = 24;   // floats per instance
  const SPRITE_VS = `
layout(location=0) in vec4 iPos;   // x, y, z (GL, bottom), skew
layout(location=1) in vec4 iSize;  // w, h (GL), anchor cx (already flipped), mode (0 upright, 1 face, 2 ground)
layout(location=2) in vec4 iUV;    // u0 v0 u1 v1
layout(location=3) in vec4 iLay;   // layer, flip, alpha, flags (1 flash, 2 glow entity)
layout(location=4) in vec4 iCol;   // fi, light add rgb (0..1)
layout(location=5) in vec4 iMisc;  // hurt, mat, emissive floor, depth pull (GL units toward the camera)
out vec2 vUV; flat out vec4 vLay; flat out vec4 vCol; flat out vec4 vMisc; out vec3 vPos;
void main() {
  vec2 c = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1));
  vec3 R = vec3(-uFwdH.y, uFwdH.x, 0.0), U = vec3(0.0, 0.0, 1.0);
  if (iSize.w == 1.0) { R = uRight.xyz; U = uUp.xyz; }
  else if (iSize.w == 2.0) { U = vec3(uFwdH.xy, 0.0); }
  vec3 base = iPos.xyz;
  vec3 p = base + R * ((c.x - iSize.z) * iSize.x + iPos.w * c.y * iSize.y) + U * (c.y * iSize.y);
  p -= vec3(uFwdH.xy, 0.0) * iMisc.w;
  vPos = p;
  float u = iLay.y > 0.5 ? 1.0 - c.x : c.x;
  vUV = vec2(mix(iUV.x, iUV.z, u), mix(iUV.w, iUV.y, c.y));
  vLay = iLay; vCol = iCol; vMisc = iMisc;
  gl_Position = uViewProj * vec4(p, 1.0);
}`;
  const SPRITE_FS = `
uniform sampler2DArray uAtlas;
in vec2 vUV; flat in vec4 vLay; flat in vec4 vCol; flat in vec4 vMisc; in vec3 vPos;
layout(location=0) out vec4 oColor; layout(location=1) out vec4 oAux;
void main() {
  vec4 t = texture(uAtlas, vec3(vUV, vLay.x));
  if (t.a < 0.25) discard;
  float alpha = vLay.z;
  if (alpha < 0.999 && float(r3dBayer(ivec2(gl_FragCoord.xy))) >= alpha * 16.0) discard;
  float emissive = t.a < 0.75 ? 1.0 : 0.0;
  int flags = int(vLay.w + 0.5);
  vec3 px = t.rgb;
  if ((flags & 1) != 0) { oColor = vec4(1.0, 230.0 / 255.0, 200.0 / 255.0, 1.0); oAux = vec4(vMisc.y / 255.0, 0.0, 0.0, 1.0); return; }
  float hurt = vMisc.x;
  if (hurt > 0.0) { float k = hurt * 0.45; px = vec3(px.r + (1.0 - px.r) * k, px.g * (1.0 - k), px.b * (1.0 - k)); }
  R3DSurf s; s.albedo = px; s.pos = vPos; s.nrm = -vec3(uFwdH.xy, 0.0); s.side = 1.0; s.mat = vMisc.y; s.emissive = emissive;
  s.fi = emissive > 0.5 ? max(vCol.x, vMisc.z) : vCol.x; s.ladd = vCol.yzw; s.kind = 1;
  oColor = vec4(r3dShade(s), 1.0);
  oAux = vec4((emissive > 0.5 ? 8.0 : vMisc.y) / 255.0, emissive, 0.0, 1.0);
}`;
  // ---------------------------------------------------------------------------------------------------- shaders: post
  const COPY_FS = `
uniform sampler2D uSrc;
in vec2 vNdc;
out vec4 oOut;
void main() { oOut = vec4(texture(uSrc, vNdc * 0.5 + 0.5).rgb, 1.0); }`;
  // linear depth and material at the logical 320x150 grid (read back one frame late for depthAt/materialAt)
  const READ_FS = `
uniform sampler2D uDepth; uniform sampler2D uAux; uniform vec2 uSrcSize;
in vec2 vNdc;
layout(location=0) out vec4 oOut;
void main() {
  vec2 lp = floor((vNdc * 0.5 + 0.5) * vec2(320.0, 150.0));
  vec2 uv = (lp + 0.5) / vec2(320.0, 150.0);
  ivec2 sp = ivec2(uv * uSrcSize);
  float z = texelFetch(uDepth, sp, 0).r;
  float m = texelFetch(uAux, sp, 0).r * 255.0;
  float d = z >= 0.99999 ? 1e9 : r3dLinearDepth(z);
  oOut = vec4(d, floor(m + 0.5), 0.0, 1.0);
}`;

  // ---------------------------------------------------------------------------------------------------- passes
  const passList = [];
  function sortPasses() { passList.sort((a, b) => (a.order || 0) - (b.order || 0)); }
  function addPass(p) {
    if (!p || typeof p.draw !== 'function' || !p.name) throw new Error('a pass needs a name and draw()');
    const i = passList.findIndex(q => q.name === p.name);
    if (i >= 0) { const old = passList[i]; if (old.dispose && gl) { try { old.dispose(gl); } catch (e) { /* fine */ } } passList.splice(i, 1); }
    passList.push(p); sortPasses();
    if (gl && resourcesOK && p.init) { try { p.init(gl, api); } catch (e) { warnOnce('pass init ' + p.name, e); } }
    if (gl && resourcesOK && p.resize && F.targets.scene) { try { p.resize(F.targets.scene.w, F.targets.scene.h, F); } catch (e) { warnOnce('pass resize ' + p.name, e); } }
    return p;
  }
  function removePass(name) { const i = passList.findIndex(q => q.name === name); if (i < 0) return false; const p = passList[i]; if (p.dispose && gl) { try { p.dispose(gl); } catch (e) { /* fine */ } } passList.splice(i, 1); return true; }
  function getPass(name) { return passList.find(q => q.name === name) || null; }

  // CORE's own programs
  const P = {};
  function corePrograms() {
    P.world = program(WORLD_VS, WORLD_FS(''), {});
    P.worldB = program(WORLD_VS, WORLD_FS('bias'), {});
    P.depth = program(WORLD_VS, DEPTH_FS(''), { chunks: ['common'] });
    P.depthB = program(WORLD_VS, DEPTH_FS('bias'), { chunks: ['common'] });
    P.sky = program(TRI_VS, SKY_FS, { chunks: ['common', 'landmarks'] });
    P.sprite = program(SPRITE_VS, SPRITE_FS, {});
    P.copy = program(TRI_VS, COPY_FS, { chunks: ['common'] });
    P.read = program(TRI_VS, READ_FS, { chunks: ['common'] });
  }

  function drawWorld(prog) {
    gl.bindVertexArray(mesh.vao); gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0); stats.draws++;
    if (mesh.dcount) { gl.bindVertexArray(mesh.dvao); gl.drawElements(gl.TRIANGLES, mesh.dcount, gl.UNSIGNED_INT, 0); stats.draws++; }
    gl.bindVertexArray(null);
  }
  const skyPass = {
    name: 'sky', order: 0,
    draw(g, f) {
      bindScene(g, f);
      g.disable(g.DEPTH_TEST); g.depthMask(false); g.disable(g.CULL_FACE); g.disable(g.BLEND);
      const pr = use(P.sky);
      g.uniform4f(pr.u.uSun, sun.az, sun.te, sun.str, sun.night); g.uniform3f(pr.u.uSunCol, sun.r, sun.g, sun.b); g.uniform1f(pr.u.uRows, sky.rows);
      g.activeTexture(g.TEXTURE4); g.bindTexture(g.TEXTURE_2D, T.skyRows);
      g.activeTexture(g.TEXTURE5); g.bindTexture(g.TEXTURE_2D, T.cloud);
      g.bindVertexArray(triVAO); g.drawArrays(g.TRIANGLES, 0, 3); g.bindVertexArray(null); stats.draws++;
    },
  };
  const prePass = {
    name: 'prepass', order: 10,
    draw(g, f) {
      bindScene(g, f);
      g.enable(g.DEPTH_TEST); g.depthFunc(g.LESS); g.depthMask(true); g.colorMask(false, false, false, false);
      g.enable(g.CULL_FACE); g.cullFace(g.BACK); g.frontFace(g.CW);
      use(f.relief ? P.depthB : P.depth);
      bindWorldTextures(g);
      drawWorld();
      g.colorMask(true, true, true, true);
    },
  };
  const worldPass = {
    name: 'world', order: 20,
    draw(g, f) {
      bindScene(g, f);
      g.enable(g.DEPTH_TEST); g.depthFunc(g.LEQUAL); g.depthMask(true);
      g.enable(g.CULL_FACE); g.cullFace(g.BACK); g.frontFace(g.CW);
      const pr = use(f.relief ? P.worldB : P.world);
      bindWorldTextures(g);
      g.uniform1i(pr.u.uDetailOn, T.detail && f.env && f.env.detail ? 1 : 0);
      drawWorld();
      g.disable(g.CULL_FACE);
    },
  };
  const spritePass = {
    name: 'sprites', order: 30,
    draw(g, f) {
      const S2 = sprites21();
      if (S2 && !spr.provider) {
        bindScene(g, f); g.enable(g.DEPTH_TEST); g.depthFunc(g.LEQUAL); g.depthMask(true); g.disable(g.CULL_FACE);
        if (S2.drawOpaque) S2.drawOpaque(f.sview);
        if (S2.drawDecals) { bindScene(g, f); S2.drawDecals(f.sview); }
        return;
      }
      if (!spr.n || !atlas.tex) return;
      bindScene(g, f);
      g.enable(g.DEPTH_TEST); g.depthFunc(g.LEQUAL); g.depthMask(true); g.disable(g.CULL_FACE);
      use(P.sprite);
      bindWorldTextures(g);
      g.activeTexture(g.TEXTURE3); g.bindTexture(g.TEXTURE_2D_ARRAY, atlas.tex);
      g.bindVertexArray(spr.vao);
      g.bindBuffer(g.ARRAY_BUFFER, spr.vbo); g.bufferData(g.ARRAY_BUFFER, spr.buf.subarray(0, spr.n * SPR_STRIDE), g.STREAM_DRAW);
      g.drawArraysInstanced(g.TRIANGLE_STRIP, 0, 4, spr.n); stats.draws++;
      g.bindVertexArray(null);
    },
  };
  const postPass = {
    name: 'post', order: 90,
    draw(g, f) {
      bindOutput(g, f);
      g.disable(g.DEPTH_TEST); g.depthMask(false); g.disable(g.BLEND); g.disable(g.CULL_FACE);
      use(P.copy);
      g.activeTexture(g.TEXTURE6); g.bindTexture(g.TEXTURE_2D, f.targets.scene.color);
      g.uniform1i(P.copy.u.uSrc, 6);
      g.bindVertexArray(triVAO); g.drawArrays(g.TRIANGLES, 0, 3); g.bindVertexArray(null); stats.draws++;
    },
  };
  function bindWorldTextures(g) {
    g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D_ARRAY, world.tex);
    g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, T.detail || T.white);
    g.activeTexture(g.TEXTURE2); g.bindTexture(g.TEXTURE_2D, T.lvis);
  }

  // ---------------------------------------------------------------------------------------------------- per-frame data
  const sky = { rows: 150, buf: new Uint8Array(0), cloudSrc: null };
  const sun = { az: 0, te: 0, str: 0, night: 0, r: 0, g: 0, b: 0 };
  function frameTextures(env) {
    // sky rows (outdoors) from the engine's table
    const n = env.skyR ? env.skyR.length : 150;
    if (!T.skyRows || sky.rows !== n) {
      if (T.skyRows) gl.deleteTexture(T.skyRows);
      T.skyRows = targets.tex2d(gl.RGBA8, n, 1, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST); sky.rows = n; sky.buf = new Uint8Array(n * 4);
    }
    if (env.outdoor && env.skyR) {
      const b = sky.buf;
      for (let i = 0; i < n; i++) { b[i * 4] = clamp(env.skyR[i], 0, 255); b[i * 4 + 1] = clamp(env.skyG[i], 0, 255); b[i * 4 + 2] = clamp(env.skyB[i], 0, 255); b[i * 4 + 3] = 255; }
      gl.bindTexture(gl.TEXTURE_2D, T.skyRows); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, n, 1, gl.RGBA, gl.UNSIGNED_BYTE, b);
    }
    if (!T.cloud || sky.cloudSrc !== env.cloud) {
      if (!T.cloud) T.cloud = targets.tex2d(gl.R32F, 1024, 1, gl.RED, gl.FLOAT, gl.NEAREST);
      if (env.cloud && env.cloud.length >= 1024) { gl.bindTexture(gl.TEXTURE_2D, T.cloud); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1024, 1, gl.RED, gl.FLOAT, env.cloud.subarray ? env.cloud.subarray(0, 1024) : new Float32Array(env.cloud).subarray(0, 1024)); }
      sky.cloudSrc = env.cloud;
    }
    // detail texture
    if (env.detail !== T.detailSrc) {
      if (T.detail) { gl.deleteTexture(T.detail); T.detail = null; }
      if (env.detail && env.detail.length === 64 * 64) {
        T.detail = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, T.detail);
        const d = env.detail; const b = new Uint8Array(64 * 64); for (let i = 0; i < b.length; i++) b[i] = d[i] & 255;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 64, 64, 0, gl.RED, gl.UNSIGNED_BYTE, b);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      }
      T.detailSrc = env.detail;
    }
    if (!T.white) { T.white = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, T.white); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([128])); }
    if (!world.layers.has('r3d_dark') && typeof Engine.addTexture === 'function' && !Engine.textures.r3d_dark) {
      const d = new Uint32Array(64 * 64); for (let i = 0; i < d.length; i++) d[i] = (255 << 24) | (14 << 16) | (12 << 8) | 12;   // procedural: a dark passage
      Engine.textures.r3d_dark = d;
    }
  }
  // the point lights: positions and colours (UBO) and a per-cell bitmask of which lights reach each cell (their wall masks)
  let lvisBuf = new Uint32Array(0), lvisW = 0, lvisH = 0;
  function frameLights(env, m) {
    const Ls = env.ptLights || [];
    const n = Math.min(MAX_LIGHTS, Ls.length);
    const b = uboLBuf; b.fill(0);
    if (lvisW !== m.w || lvisH !== m.h || !T.lvis) {
      if (T.lvis) gl.deleteTexture(T.lvis);
      lvisW = m.w; lvisH = m.h; lvisBuf = new Uint32Array(m.w * m.h);
      gl.activeTexture(gl.TEXTURE2);   // the light map's own unit: an integer texture left on another unit breaks sampler2D draws there
      T.lvis = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, T.lvis);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R32UI, m.w, m.h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }
    lvisBuf.fill(0);
    for (let k = 0; k < n; k++) {
      const L = Ls[k];
      b[k * 4] = L.x; b[k * 4 + 1] = L.y; b[k * 4 + 2] = L.r * L.r;
      b[MAX_LIGHTS * 4 + k * 4] = (L.cr || 0) / 255; b[MAX_LIGHTS * 4 + k * 4 + 1] = (L.cg || 0) / 255; b[MAX_LIGHTS * 4 + k * 4 + 2] = (L.cb || 0) / 255;
      const bit = (1 << k) >>> 0;
      if (L.vis) {
        for (let j = 0; j < L.vd; j++) { const ty = L.voy + j; if (ty < 0 || ty >= m.h) continue; for (let i = 0; i < L.vd; i++) { const tx = L.vox + i; if (tx < 0 || tx >= m.w) continue; if (L.vis[j * L.vd + i] === 1) lvisBuf[ty * m.w + tx] |= bit; } }
      } else {
        const R = Math.ceil(L.r) + 1;
        for (let ty = Math.max(0, (L.y | 0) - R); ty <= Math.min(m.h - 1, (L.y | 0) + R); ty++) for (let tx = Math.max(0, (L.x | 0) - R); tx <= Math.min(m.w - 1, (L.x | 0) + R); tx++) lvisBuf[ty * m.w + tx] |= bit;
      }
    }
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, T.lvis); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, m.w, m.h, gl.RED_INTEGER, gl.UNSIGNED_INT, lvisBuf);
    gl.bindBuffer(gl.UNIFORM_BUFFER, uboL); gl.bufferSubData(gl.UNIFORM_BUFFER, 0, b); gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    return n;
  }
  // the engine's sun and moon, as angles (render(): sunA, elev, bodyEl, the glow strength and colour)
  function frameSun(env) {
    const tod = env.tod;
    const sunA = (tod - 0.25) * Math.PI * 2, elev = Math.cos((tod - 0.5) * Math.PI * 2), night = elev < 0.02;
    sun.az = night ? sunA + Math.PI : sunA;
    const bodyEl = night ? Math.min(0.8, Math.max(0.18, -elev)) : Math.min(0.95, elev);
    sun.te = bodyEl * 150 * 0.58 / FX;
    const warm = 1 - Math.min(1, Math.abs(elev) * 1.5);
    sun.r = (night ? 150 : 255) / 255; sun.g = (night ? 160 : 236 * (1 - warm * 0.12)) / 255; sun.b = (night ? 190 : 196 * (1 - warm * 0.34)) / 255;
    sun.str = (night ? 0.45 : 1) * (1 - Math.min(0.8, env.wx.cloud * 0.8)) * (1 - env.wx.dark * 0.5);
    sun.night = night ? 1 : 0;
  }
  // camera matrices
  function frameCamera(cam, env) {
    const d = cam.dir, pitch = cam.pitch || 0, bob = cam.bob || 0;
    const th = Math.atan(pitch / FX);
    F.pitchA = th;
    const cd = Math.cos(d), sd = Math.sin(d), ct = Math.cos(th), stt = Math.sin(th);
    const E = F.eye; E[0] = cam.x; E[1] = cam.y; E[2] = (cam.z == null ? 0.88 : cam.z) * ZK;
    const Fw = F.fwd; Fw[0] = ct * cd; Fw[1] = ct * sd; Fw[2] = stt;
    const R = F.right; R[0] = -sd; R[1] = cd; R[2] = 0;
    const U = F.up; U[0] = -stt * cd; U[1] = -stt * sd; U[2] = ct;
    F.fwdH[0] = cd; F.fwdH[1] = sd;
    const m = F.map;
    const n = 0.02, far = Math.max(48, (m ? Math.hypot(m.w, m.h) : 64) * 1.25, (env ? env.fogDist : 12) * 2 + 4);
    F.near = n; F.far = far;
    const ax = FX / 160, ay = FX / 75, sy = bob / 75, A = (far + n) / (far - n), Bz = -2 * far * n / (far - n);
    const re = R[0] * E[0] + R[1] * E[1] + R[2] * E[2], ue = U[0] * E[0] + U[1] * E[1] + U[2] * E[2], fe = Fw[0] * E[0] + Fw[1] * E[1] + Fw[2] * E[2];
    // view (rows: R, U, -F) and projection with the lens shift, multiplied out
    const V = F.view;
    V[0] = R[0]; V[4] = R[1]; V[8] = R[2]; V[12] = -re;
    V[1] = U[0]; V[5] = U[1]; V[9] = U[2]; V[13] = -ue;
    V[2] = -Fw[0]; V[6] = -Fw[1]; V[10] = -Fw[2]; V[14] = fe;
    V[3] = 0; V[7] = 0; V[11] = 0; V[15] = 1;
    const Pm = F.proj; Pm.fill(0);
    Pm[0] = ax; Pm[5] = ay; Pm[9] = sy; Pm[10] = -A; Pm[11] = -1; Pm[14] = Bz;
    mul(F.viewProj, Pm, V);
    invert(F.invViewProj, F.viewProj);
  }
  function frameUBO(env) {
    const b = uboBuf;
    b.set(F.viewProj, 0); b.set(F.view, 16); b.set(F.proj, 32); b.set(F.invViewProj, 48);
    let o = 64;
    const v4 = (a, b2, c, d) => { b[o++] = a; b[o++] = b2; b[o++] = c; b[o++] = d; };
    v4(F.eye[0], F.eye[1], F.eye[2], env.animT || 0);
    v4(F.fwd[0], F.fwd[1], F.fwd[2], F.pitchA);
    v4(F.right[0], F.right[1], F.right[2], ZK);
    v4(F.up[0], F.up[1], F.up[2], F.pxK);
    v4(F.fwdH[0], F.fwdH[1], F.near, F.far);
    v4(env.fogR / 255, env.fogG / 255, env.fogB / 255, 1 / Math.max(0.01, env.fogDist));
    const fp = env.fogPx >>> 0;
    v4((fp & 255) / 255, ((fp >>> 8) & 255) / 255, ((fp >>> 16) & 255) / 255, env.fogDist);
    v4(env.light, env.ambient, env.outdoor ? 1 : env.flick, env.outdoor ? 1 : 0);
    v4(env.skyDay, env.tod, env.far ? 1 : 0, env.farHaze || 0);
    v4(env.wx.haze, env.wx.dark, env.wx.cloud, env.wx.flash);
    v4(F.w, F.h, F.now, F.nLights);
    v4(F.map.w, F.map.h, env.detail ? env.detailDist : 0, F.relief ? (env.surfBias || 0.45) : 0);
    v4(env.far ? env.farA0 : 1e9, env.far ? env.farA1 : 1e9 + 1, env.kEff || 1, env.ambientDark || 1);
    v4(F.cam.x, F.cam.y, F.cam.z, F.cam.dir);
    gl.bindBuffer(gl.UNIFORM_BUFFER, ubo); gl.bufferSubData(gl.UNIFORM_BUFFER, 0, b); gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, ubo); gl.bindBufferBase(gl.UNIFORM_BUFFER, 1, uboL);
  }

  // ---------------------------------------------------------------------------------------------------- sprites
  const spr = { buf: new Float32Array(256 * SPR_STRIDE), n: 0, vao: null, vbo: null, provider: null };
  function sprInit() {
    spr.vao = gl.createVertexArray(); spr.vbo = gl.createBuffer();
    gl.bindVertexArray(spr.vao); gl.bindBuffer(gl.ARRAY_BUFFER, spr.vbo);
    const S4 = SPR_STRIDE * 4;
    for (let i = 0; i < 6; i++) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, 4, gl.FLOAT, false, S4, i * 16); gl.vertexAttribDivisor(i, 1); }
    gl.bindVertexArray(null);
  }
  const instDefaults = {};
  // submit one sprite instance (see the contract, 4); returns false when it cannot be drawn
  function submit(o) {
    if (!o) return false;
    let sp = o.sprite; if (typeof sp === 'string') sp = Engine.sprites[sp];
    const e = atlas.get(sp); if (!e) return false;
    if ((spr.n + 1) * SPR_STRIDE > spr.buf.length) { const nb = new Float32Array(spr.buf.length * 2); nb.set(spr.buf); spr.buf = nb; }
    const h = o.h != null ? o.h : ZK, w = o.w != null ? o.w : h * sp.w / sp.h;
    const z = o.z != null ? o.z : groundGL(o.x, o.y);
    const flip = !!o.flip, cx0 = o.cx != null ? o.cx : (sp.cx == null ? 0.5 : sp.cx), cx = flip ? 1 - cx0 : cx0;
    const mode = o.mode === 'face' ? 1 : o.mode === 'ground' ? 2 : 0;
    let fi = o.fi, la = o.light;
    if (fi == null || la == null) {
      const dx = o.x - F.cam.x, dy = o.y - F.cam.y, d = Math.sqrt(dx * dx + dy * dy), env = F.env;
      if (fi == null) { let f = env.light === undefined ? 1 : 1; f = 1 * (1 - d / env.fogDist); if (f < 0) f = 0; f = env.ambient + (1 - env.ambient) * f; if (!env.outdoor) f *= env.flick; fi = Math.round(f * 255) / 255; }
      if (la == null) { const L = sampleLight(env.ptLights, o.x, o.y); la = [L[0] / 255, L[1] / 255, L[2] / 255]; }
    }
    const b = spr.buf, k = spr.n * SPR_STRIDE;
    b[k] = o.x; b[k + 1] = o.y; b[k + 2] = z; b[k + 3] = o.skew || 0;
    b[k + 4] = w; b[k + 5] = h; b[k + 6] = cx; b[k + 7] = mode;
    b[k + 8] = e.u0; b[k + 9] = e.v0; b[k + 10] = e.u1; b[k + 11] = e.v1;
    b[k + 12] = e.p; b[k + 13] = flip ? 1 : 0; b[k + 14] = o.alpha == null ? 1 : o.alpha; b[k + 15] = (o.flash ? 1 : 0) | (o.glowEnt ? 2 : 0);
    b[k + 16] = fi; b[k + 17] = la[0]; b[k + 18] = la[1]; b[k + 19] = la[2];
    b[k + 20] = o.hurt || 0; b[k + 21] = o.mat != null ? o.mat : MAT.sprite; b[k + 22] = o.emitFloor != null ? o.emitFloor : 0.95; b[k + 23] = o.pull || 0;
    spr.n++; stats.sprites++;
    if (o.ent) o.ent._screen = screenRect(o.x, o.y, z, w, h, cx, o.skew || 0, mode);
    return true;
  }
  // the on-screen rect (logical px) of an upright sprite, for HUD overlays (ent._screen)
  const corners = [0, 0, 1, 0, 0, 1, 1, 1];
  function screenRect(x, y, z, w, h, cx, skew, mode) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, zc = 0, okN = 0;
    const R0 = mode === 1 ? F.right[0] : -F.fwdH[1], R1 = mode === 1 ? F.right[1] : F.fwdH[0], R2 = mode === 1 ? F.right[2] : 0;
    const U0 = mode === 1 ? F.up[0] : mode === 2 ? F.fwdH[0] : 0, U1 = mode === 1 ? F.up[1] : mode === 2 ? F.fwdH[1] : 0, U2 = mode === 1 ? F.up[2] : mode === 2 ? 0 : 1;
    const M = F.viewProj;
    for (let i = 0; i < 4; i++) {
      const cxx = corners[i * 2], cyy = corners[i * 2 + 1];
      const a = (cxx - cx) * w + skew * cyy * h, bb = cyy * h;
      const px = x + R0 * a + U0 * bb, py = y + R1 * a + U1 * bb, pz = z + R2 * a + U2 * bb;
      const cw = M[3] * px + M[7] * py + M[11] * pz + M[15];
      if (cw < F.near) continue;
      const sx = (M[0] * px + M[4] * py + M[8] * pz + M[12]) / cw, sy = (M[1] * px + M[5] * py + M[9] * pz + M[13]) / cw;
      const lx = (sx * 0.5 + 0.5) * LOG_W, ly = (0.5 - sy * 0.5) * LOG_H;
      if (lx < x0) x0 = lx; if (lx > x1) x1 = lx; if (ly < y0) y0 = ly; if (ly > y1) y1 = ly; zc += cw; okN++;
    }
    if (okN < 4 || x1 < 0 || x0 > LOG_W || y1 < 0 || y0 > LOG_H) return null;
    const dx = x - F.cam.x, dy = y - F.cam.y;
    return { x0, x1, y0, y1, dist: Math.sqrt(dx * dx + dy * dy), z: zc / okN };
  }
  // the engine's point-light sum at a world point (sampleLight with the wall masks), 0..90 per channel
  function sampleLight(Ls, wx, wy) {
    let cr = 0, cg = 0, cb = 0;
    if (Ls) for (let i = 0; i < Ls.length; i++) {
      const L = Ls[i], dx = wx - L.x, dy = wy - L.y, d2 = dx * dx + dy * dy, r2 = L.r * L.r;
      if (d2 >= r2) continue;
      if (L.vis) { const ii = (wx | 0) - L.vox, jj = (wy | 0) - L.voy; if (!(ii >= 0 && jj >= 0 && ii < L.vd && jj < L.vd && L.vis[jj * L.vd + ii] === 1)) continue; }
      const k = 1 - d2 / r2, kk = k * k; cr += L.cr * kk; cg += L.cg * kk; cb += L.cb * kk;
    }
    return [cr > 90 ? 90 : cr, cg > 90 ? 90 : cg, cb > 90 ? 90 : cb];
  }
  function groundGL(x, y) { const m = F.map; return m ? ground(m, x, y) * ZK : 0; }
  // CORE's entity provider: every entity drawn the way Engine.render draws it (see the sprite loop there)
  function defaultProvider(f, ents, sub) {
    const env = f.env, m = f.map, fd2 = env.fogDist * env.fogDist * 1.3;
    const camx = f.cam.x, camy = f.cam.y, relief = !!(m.lvls || m.smooth);
    const fogMul = 1 / env.fogDist, light = 1, ambient = env.ambient, outdoor = env.outdoor, flick = env.flick;
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (!e) continue;
      e._screen = null;
      if (!e.sprite || e.hidden) continue;
      const dx = e.x - camx, dy = e.y - camy, d2 = dx * dx + dy * dy;
      if (d2 > fd2) continue;
      // behind the camera's horizontal plane: the CPU drops trY <= 0.08; R3D keeps what a pitched view still sees
      let dirl;
      try { dirl = typeof animDirectionalSprite === 'function' ? animDirectionalSprite(e) : { sprite: (e.animSprite && Engine.sprites[e.animSprite]) || Engine.sprites[e.sprite], flip: !!e.animFlip }; } catch (err) { dirl = null; }
      const sp = dirl && dirl.sprite; if (!sp) continue;
      const alpha = e.animAlpha == null ? 1 : e.animAlpha;
      if (alpha <= 0.02) continue;
      const scale = e.scale || 1, hs = sp.hs || 1;
      const hGame = scale * hs * (e.animSY || 1);
      const wGL = ZK * scale * hs * (sp.w / sp.h) * (e.animSX || 1);
      const floorZ = relief ? ground(m, e.x, e.y) : 0;
      const bottom = floorZ - ((e.yOff || 0) - (e.animLift || 0)) - (sp.dy || 0) * scale;
      const d = Math.sqrt(d2);
      let f2 = light * (1 - d * fogMul); if (f2 < 0) f2 = 0;
      f2 = ambient + (1 - ambient) * f2;
      if (!outdoor) f2 *= flick;
      if (e.glow) f2 = Math.max(f2, e.glow);
      if (e.animGlow) f2 = Math.max(f2, e.animGlow);
      if (e.item === 'shard' || e.item === 'core' || e.glassLamp) f2 = Math.max(f2, 0.9);
      if (e.flash) f2 = 1;
      const fi = Math.round(f2 * 255) / 255;
      const farSpr = env.far && d2 > env.farLod2;
      const L = env.ptLights && env.ptLights.length && !farSpr ? sampleLight(env.ptLights, e.x, e.y) : [0, 0, 0];
      const lr = (e.elite ? L[0] + 28 : L[0]) / 255, lg = (e.elite ? L[1] + 20 : L[1]) / 255, lb = L[2] / 255;
      const glowEnt = e.glow > 0.3 || e.animGlow > 0.3 || !!e.glassLamp || e.item === 'shard' || e.item === 'core';
      instTmp.sprite = sp; instTmp.x = e.x; instTmp.y = e.y; instTmp.z = bottom * ZK; instTmp.w = wGL; instTmp.h = hGame * ZK;
      instTmp.cx = sp.cx == null ? 0.5 : sp.cx; instTmp.flip = !!dirl.flip; instTmp.skew = e.animSkew || 0; instTmp.alpha = alpha; instTmp.mode = 'upright';
      instTmp.fi = fi; instTmp.light = [lr, lg, lb]; instTmp.hurt = e.animHurt || 0; instTmp.flash = !!e.flash; instTmp.mat = glowEnt ? MAT.glow : MAT.sprite;
      instTmp.glowEnt = glowEnt; instTmp.ent = e;
      sub(instTmp);
    }
  }
  const instTmp = {};
  function setProvider(fn) { spr.provider = typeof fn === 'function' ? fn : null; }

  // ---- js/sprites21.js (team SPRITES): when SPRITES21 is loaded it draws every entity instead of CORE's batch.
  // R3D calls SPRITES21.attach(gl) once per context, SPRITES21.frame(ents, view) per frame with the very list the CPU sprite
  // pass gets, drawOpaque(view) and drawDecals(view) in the 'sprites' pass and drawTranslucent(view) in 'transparent', each
  // with the scene target bound (its two outputs) and depth testing on. The view (F.sview):
  //   vp: Float32Array(16) map space (x, y, z game units, z up) -> clip; eye [x, y, z] game units; dir; pitch (radians);
  //   pitchRows (Engine.cam.pitch); fogDist; outdoor; fog [r,g,b] 0..1 (the CPU's tint target, per unit of light); fogPx
  //   [r,g,b] 0..1 (displayed haze); light; ambient; flick; lights (the engine's point lights, with wall masks);
  //   px (render px per logical px); spriteAspect (ZK: a CPU sprite of height h game units is h*sp.w/sp.h*ZK map units
  //   wide); shade ('cpu': the raycaster's fog/ambient/light formula); w, h (target px); ZK; R3D (this API); F (the frame).
  const SV = { vp: new Float32Array(16), eye: [0, 0, 0.5], dir: 0, pitch: 0, pitchRows: 0, fogDist: 12, outdoor: false, fog: [0, 0, 0], fogPx: [0, 0, 0], light: 1, ambient: 0, flick: 1, lights: null, px: 1, spriteAspect: ZK, shade: 'cpu', w: 0, h: 0, ZK, R3D: null, F };
  F.sview = SV;
  function buildSpriteView(env, ents) {
    const vp = SV.vp, M = F.viewProj;
    for (let i = 0; i < 16; i++) vp[i] = M[i];
    vp[8] *= ZK; vp[9] *= ZK; vp[10] *= ZK; vp[11] *= ZK;   // z column: game units -> GL
    SV.eye[0] = F.cam.x; SV.eye[1] = F.cam.y; SV.eye[2] = F.cam.z; SV.dir = F.cam.dir; SV.pitch = F.pitchA; SV.pitchRows = F.cam.pitch;
    SV.fogDist = env.fogDist; SV.outdoor = env.outdoor; SV.fog[0] = env.fogR / 255; SV.fog[1] = env.fogG / 255; SV.fog[2] = env.fogB / 255;
    const fp = env.fogPx >>> 0; SV.fogPx[0] = (fp & 255) / 255; SV.fogPx[1] = ((fp >>> 8) & 255) / 255; SV.fogPx[2] = ((fp >>> 16) & 255) / 255;
    SV.light = env.light; SV.ambient = env.ambient; SV.flick = env.flick; SV.lights = env.ptLights; SV.px = F.pxK; SV.w = F.w; SV.h = F.h; SV.R3D = api;
  }
  const sprites21 = () => (typeof SPRITES21 !== 'undefined' && SPRITES21 && typeof SPRITES21.frame === 'function') ? SPRITES21 : null;
  let s21gl = null;
  function s21attach() { const S2 = sprites21(); if (!S2 || s21gl === gl) return S2; s21gl = gl; try { if (S2.attach) S2.attach(gl); } catch (e) { warnOnce('sprites21 attach', e); } return S2; }
  const translucentPass = {
    name: 'transparent', order: 50,
    enabled: () => !!sprites21(),
    draw(g, f) { const S2 = sprites21(); if (!S2 || !S2.drawTranslucent) return; bindScene(g, f); g.enable(g.DEPTH_TEST); g.depthFunc(g.LEQUAL); S2.drawTranslucent(f.sview); },
  };

  // ---------------------------------------------------------------------------------------------------- pick (gameplay parity)
  // The CPU's pick rule, evaluated on a virtual raycaster frame of the camera R3D last drew (y-shear by cam.pitch rows):
  // each entity gets the rect the CPU would have given it (e._pickScr, at the engine's render scale, with its integer
  // truncations), and on relief maps the occlusion test asks the CPU's own column walk what depth the pixel would hold.
  const VCAM = { x: 0, y: 0, z: 0.88, dir: 0, pitch: 0, bob: 0, S: 1, fogDist: 12, relief: false, map: null, list: [], gen: 0 };
  function vframe(cam, env, ents) {
    VCAM.x = cam.x; VCAM.y = cam.y; VCAM.z = cam.z == null ? 0.88 : cam.z; VCAM.dir = cam.dir; VCAM.pitch = cam.pitch || 0; VCAM.bob = cam.bob || 0;
    const S = env.S || 1; VCAM.S = S; VCAM.fogDist = env.fogDist; VCAM.map = F.map; VCAM.gen++;
    VCAM.relief = !!(F.map.relief || F.map.lvls || F.map.verts);
    const w = 320 * S, h = 150 * S;
    const dirX = Math.cos(cam.dir), dirY = Math.sin(cam.dir), FOV = (Engine.FOV || 1);
    const planeX = -dirY * FOV * 0.66, planeY = dirX * FOV * 0.66;
    const horizon = (h >> 1) + (((VCAM.pitch) * S) | 0) + (((VCAM.bob) * S) | 0);
    VCAM.w = w; VCAM.h = h; VCAM.dirX = dirX; VCAM.dirY = dirY; VCAM.planeX = planeX; VCAM.planeY = planeY; VCAM.horizon = horizon;
    const m = F.map, mw = m.w, mh = m.h, heightMap = m.lvls, smooth = m.smooth;
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    const list = VCAM.list; list.length = 0;
    const fd2 = env.fogDist * env.fogDist * 1.3;
    for (const e of ents) {
      if (!e) continue;
      e._pickScr = null;
      if (!e.sprite || e.hidden) continue;
      const dx = e.x - cam.x, dy = e.y - cam.y, d2 = dx * dx + dy * dy;
      if (d2 > fd2) continue;
      let directional;
      try { directional = typeof animDirectionalSprite === 'function' ? animDirectionalSprite(e) : { sprite: (e.animSprite && Engine.sprites[e.animSprite]) || Engine.sprites[e.sprite], flip: !!e.animFlip }; } catch (err) { directional = null; }
      const sp = directional && directional.sprite; if (!sp) continue;
      const sx = e.x - cam.x, sy = e.y - cam.y;
      const trX = invDet * (dirY * sx - dirX * sy), trY = invDet * (-planeY * sx + planeX * sy);
      if (trY <= 0.08) continue;
      const screenX = ((w / 2) * (1 + trX / trY)) | 0;
      const scale = e.scale || 1, unitH = Math.abs((h / trY) * scale), baseH = unitH * (sp.hs || 1);
      const sprH = (baseH * (e.animSY || 1)) | 0;
      const vMove = (((e.yOff || 0) - (e.animLift || 0)) * h / trY + (sp.dy || 0) * unitH) | 0;
      const scx = Math.min(mw - 1, Math.max(0, e.x | 0)), scy = Math.min(mh - 1, Math.max(0, e.y | 0));
      const sprFloor = (heightMap || smooth) ? cellGround(m, scx, scy, clamp(e.x - scx, 0, 1), clamp(e.y - scy, 0, 1)) : 0;
      const baseline = horizon + (((VCAM.z - sprFloor) * h / trY) | 0) + vMove;
      const dsY = baseline - sprH, deY = baseline;
      const sprW = Math.max(1, (baseH * sp.w / sp.h * (e.animSX || 1)) | 0);
      const cx0 = sp.cx == null ? 0.5 : sp.cx, flip = !!directional.flip;
      const dsX = screenX - ((flip ? 1 - cx0 : cx0) * sprW | 0), deX = dsX + sprW;
      const alpha = e.animAlpha == null ? 1 : e.animAlpha;
      if (alpha <= 0.02) continue;
      const skew = e.animSkew || 0, shTop = skew * sprH;
      const xs = Math.max(0, (dsX + Math.min(0, shTop)) | 0), xe = Math.min(w - 1, (deX + Math.max(0, shTop)) | 0);
      const ys = Math.max(0, dsY), ye = Math.min(h - 1, deY);
      if (xe < xs || ye < ys) continue;
      const d = Math.sqrt(d2);
      e._pickScr = { x0: dsX / S, x1: deX / S, y0: dsY / S, y1: deY / S, dist: d, z: trY, gen: VCAM.gen };
      list.push({ e, sp, dsX, dsY, sprW, sprH, deY, trY, flip, skew, alpha });
    }
  }
  // Gameplay reads whether an entity is on screen (upgrades.js spawnHitParticles draws its 8 random sparks only when
  // e._screen is set, and that is the game's Math.random). So under R3D an entity has e._screen exactly when the CPU frame
  // would have given it one; the rect itself is R3D's projection (for overlays) or, when R3D's is clipped, the CPU's.
  // Only views the CPU cannot show (pitch past its range) keep R3D's own answer.
  function reconcileScreens(ents) {
    const wide = Math.abs(F.pitchA) > Math.atan(CPU_ROWS / FX) + 1e-9;
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i]; if (!e) continue;
      const p = e._pickScr && e._pickScr.gen === VCAM.gen ? e._pickScr : null;
      if (p && !e._screen) e._screen = { x0: p.x0, x1: p.x1, y0: p.y0, y1: p.y1, dist: p.dist, z: p.z };
      else if (!p && e._screen && !wide) e._screen = null;
    }
  }
  // the depth the CPU frame would hold at render pixel (px, ry): relief maps only (flat maps never test occlusion)
  function vdepth(px, ry) {
    let best = reliefDepth(px, ry);
    // a sprite drawn nearer over that pixel also writes its depth there
    for (const s of VCAM.list) {
      if (!(s.trY < best)) continue;
      if (ry < Math.max(0, s.dsY) || ry > Math.min(VCAM.h - 1, s.deY)) continue;
      const sxx = s.skew ? px - s.skew * (s.deY - ry) : px;
      let tx = (((sxx - s.dsX) * s.sp.w) / s.sprW) | 0;
      if (tx < 0 || tx >= s.sp.w) continue;
      if (s.flip) tx = s.sp.w - 1 - tx;
      const ty = (((ry - s.dsY) * s.sp.h) / s.sprH) | 0; if (ty < 0 || ty >= s.sp.h) continue;
      if ((s.sp.data[ty * s.sp.w + tx] >>> 24) > 100) best = s.trY;
    }
    return best;
  }
  // The CPU's relief column walk (engine.js render, "relief"), only asking which segment fills row ry of column px.
  function reliefDepth(px, ry) {
    const m = VCAM.map, w = VCAM.w, h = VCAM.h, horizon = VCAM.horizon, CX = VCAM.x, CY = VCAM.y, CZ = VCAM.z;
    const mw = m.w, mh = m.h, grid = m.cells, heightMap = m.lvls, smooth = m.smooth, verts = m.verts, VW1 = mw + 1, doors = m.doors;
    const maxTop = m.maxTop != null ? m.maxTop : 2;
    const ceilZ = m.ceilZ || 1, wallTop0v = m.ceil ? ceilZ : 0;
    const gAt = (x, y, cx, cy) => {
      const i = cy * mw + cx;
      if (smooth && smooth[i]) { let fx = x - cx, fy = y - cy; fx = fx < 0 ? 0 : fx > 1 ? 1 : fx; fy = fy < 0 ? 0 : fy > 1 ? 1 : fy; const v = cy * VW1 + cx; return (verts[v] * (1 - fx) + verts[v + 1] * fx) * (1 - fy) + (verts[v + VW1] * (1 - fx) + verts[v + VW1 + 1] * fx) * fy; }
      return heightMap ? heightMap[i] : 0;
    };
    let found = -1;
    const surf = (t0, z0, t1, z1, clip) => {
      if (t0 < 0.03) t0 = 0.03;
      if (t1 <= t0) return clip;
      const yA = horizon + h * (CZ - z0) / t0, yB = horizon + h * (CZ - z1) / t1;
      if (!(yB < yA)) return clip;
      let ys = Math.ceil(yB); if (ys < 0) ys = 0;
      let ye = yA < h ? Math.floor(yA) : h - 1; if (ye > clip - 1) ye = clip - 1;
      if (ye < ys) return clip;
      if (found < 0 && ry >= ys && ry <= ye) {
        const dt = t1 - t0, dz = z1 - z0, K = h * (CZ - z0), p = ry - horizon, den = p * dt + h * dz;
        let s = den !== 0 ? (K - p * t0) / den : 0; s = s < 0 ? 0 : s > 1 ? 1 : s;
        found = t0 + s * dt + SURF;
      }
      return ys < clip ? ys : clip;
    };
    const riser = (t, zLo, zHi, clip) => {
      if (zHi - zLo < 0.02) return clip;
      const yT = horizon + h * (CZ - zHi) / t, yBt = horizon + h * (CZ - zLo) / t;
      let ys = yT | 0; if (ys < 0) ys = 0;
      let ye = yBt < h ? yBt | 0 : h - 1; if (ye > clip - 1) ye = clip - 1;
      if (ye < ys) return clip;
      if (found < 0 && ry >= ys && ry <= ye) found = t;
      return ys < clip ? ys : clip;
    };
    const camX = 2 * px / w - 1;
    const rdx = VCAM.dirX + VCAM.planeX * camX, rdy = VCAM.dirY + VCAM.planeY * camX;
    let cx = CX | 0, cy = CY | 0;
    const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
    let stepX, stepY, sdx, sdy;
    if (rdx < 0) { stepX = -1; sdx = (CX - cx) * ddx; } else { stepX = 1; sdx = (cx + 1 - CX) * ddx; }
    if (rdy < 0) { stepY = -1; sdy = (CY - cy) * ddy; } else { stepY = 1; sdy = (cy + 1 - CY) * ddy; }
    let clip = h, side = 0, tIn = 0, capZ = null;
    const far = !!(F.env && F.env.far);
    const maxIter = far ? Math.max(160, mw + mh + 2) : 160;
    for (let iter = 0; iter < maxIter && found < 0; iter++) {
      const tOut = sdx < sdy ? sdx : sdy;
      let zOut;
      if (capZ !== null) { zOut = capZ; if (capZ < CZ) clip = surf(tIn, capZ, tOut, capZ, clip); }
      else {
        const ci = cy * mw + cx;
        if (smooth && smooth[ci]) {
          const tm = (tIn + tOut) * 0.5;
          const z0 = gAt(CX + tIn * rdx, CY + tIn * rdy, cx, cy), zm = gAt(CX + tm * rdx, CY + tm * rdy, cx, cy);
          zOut = gAt(CX + tOut * rdx, CY + tOut * rdy, cx, cy);
          clip = surf(tIn, z0, tm, zm, clip); clip = surf(tm, zm, tOut, zOut, clip);
        } else { zOut = heightMap ? heightMap[ci] : 0; clip = surf(tIn, zOut, tOut, zOut, clip); }
      }
      if (found >= 0 || clip <= 0) break;
      if (tOut > 0.05 && (maxTop >= CZ ? horizon + h * (CZ - maxTop) / tOut : horizon) >= clip) break;
      if (sdx < sdy) { sdx += ddx; cx += stepX; side = 0; } else { sdy += ddy; cy += stepY; side = 1; }
      if (cx < 0 || cy < 0 || cx >= mw || cy >= mh) break;
      tIn = tOut;
      const ci = cy * mw + cx, c = grid[ci];
      const base = (smooth && smooth[ci]) ? gAt(CX + tIn * rdx, CY + tIn * rdy, cx, cy) : (heightMap ? heightMap[ci] : 0);
      capZ = null;
      if (c && c.door) {
        const d = doors[ci]; const openAmt = d ? d.open : 0;
        if (openAmt < 0.98) {
          let tD, frac, hit = true;
          const sw = (openAmt > 0 && typeof Doors !== 'undefined') ? doorSwingProbe(d, cx, cy, CX, CY, rdx, rdy, grid, mw) : 0;
          if (sw) { hit = sw === 2; if (hit) { tD = Doors.out.t; frac = Doors.out.u + openAmt; } }
          else if (side === 0) { tD = tIn + ddx * 0.5; const hy = CY + tD * rdy; if ((hy | 0) !== cy) hit = false; frac = hy - cy; }
          else { tD = tIn + ddy * 0.5; const hx = CX + tD * rdx; if ((hx | 0) !== cx) hit = false; frac = hx - cx; }
          if (hit && frac >= openAmt) {
            clip = riser(tIn, zOut, base, clip);
            clip = surf(tIn, base, tD, base, clip);
            clip = riser(tD, base, base + 1, clip);
            if (wallTop0v > base + 1) clip = riser(tD, base + 1, wallTop0v, clip);
            capZ = Math.max(base + 1, wallTop0v); tIn = tD;
            continue;
          }
        }
        if (base > zOut) clip = riser(tIn, zOut, base, clip);
        continue;
      }
      if (c) {
        const top = c.top != null ? c.top : Math.max(base + 1, wallTop0v);
        clip = riser(tIn, zOut, top, clip);
        capZ = top;
        continue;
      }
      if (base > zOut + 0.02) clip = riser(tIn, zOut, base, clip);
    }
    if (found >= 0) return found;
    // never filled by the walk: haze below the horizon (1e9), sky or ceiling above it
    if (ry <= horizon && m.ceil && Engine.textures[m.ceil]) { const p = horizon - ry; if (p > 0) return (ceilZ - CZ) * h / p; }
    return 1e9;
  }
  const SURF = (typeof Engine !== 'undefined' && Engine.SURF_BIAS) || 0.45;
  // Doors.swing without its first-sight side effect when the door has never been seen (the CPU would have set _sw then)
  function doorSwingProbe(d, mx, my, cx, cy, rdx, rdy, grid, mw) { try { return Doors.swing(d, mx, my, cx, cy, rdx, rdy, grid, mw); } catch (e) { return 0; } }
  // Engine.pick, on the virtual frame
  function pick(entities, maxDist) {
    let best = null, bd = 1e9;
    const S = VCAM.S, RW = 320 * S, RH = 150 * S;
    const cx = 160, aim = 75, horizon = 75 + VCAM.pitch, camZ = Engine.cam.z;
    for (const e of entities) {
      const s = e._pickScr; if (!s || s.gen !== VCAM.gen || e.hidden || e.nopick) continue;
      if (s.dist > maxDist) continue;
      if (!(cx >= s.x0 - 4 && cx <= s.x1 + 4)) continue;
      // hand level (z 0.5) at this entity’s distance: level play picks as it
      // always has, though the standing eye is taller than the hands that reach
      const level = horizon + (150 / Math.max(0.25, s.dist)) * (camZ - 0.5);
      let ok = false;
      for (const cy of aim === level ? [aim] : [aim, level]) {
        if (!(cy >= s.y0 && cy <= s.y1 + 6)) continue;
        if (VCAM.relief && s.z) {
          const ry = (Math.max(s.y0, Math.min(s.y1, cy)) * S) | 0, px = Math.max(0, Math.min(RW - 1, (cx * S) | 0));
          if (ry >= 0 && ry < RH && vdepth(px, ry) < s.z - 0.05) continue;
        }
        ok = true; break;
      }
      if (ok && s.dist < bd) { bd = s.dist; best = e; }
    }
    return best;
  }

  // ---------------------------------------------------------------------------------------------------- read-back (depthAt)
  const readback = (() => {
    const RB = { fb: null, tex: null, pbo: [null, null], fence: [null, null], i: 0, data: new Float32Array(320 * 150 * 4), have: false, frame: -1 };
    RB.reset = function () { RB.fb = RB.tex = null; RB.pbo = [null, null]; RB.fence = [null, null]; RB.have = false; };
    RB.render = function (f) {
      if (!st.floatRT) return;   // needs a float target to read depths
      if (!RB.fb) {
        RB.tex = targets.tex2d(gl.RGBA32F, 320, 150, gl.RGBA, gl.FLOAT, gl.NEAREST);
        RB.fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, RB.fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, RB.tex, 0);
        for (let k = 0; k < 2; k++) { RB.pbo[k] = gl.createBuffer(); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, RB.pbo[k]); gl.bufferData(gl.PIXEL_PACK_BUFFER, 320 * 150 * 16, gl.STREAM_READ); }
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      }
      // collect the previous read if its fence passed
      const j = RB.i ^ 1;
      if (RB.fence[j]) {
        const s = gl.clientWaitSync(RB.fence[j], 0, 0);
        if (s === gl.ALREADY_SIGNALED || s === gl.CONDITION_SATISFIED) {
          gl.bindBuffer(gl.PIXEL_PACK_BUFFER, RB.pbo[j]); gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, RB.data); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
          gl.deleteSync(RB.fence[j]); RB.fence[j] = null; RB.have = true;
        }
      }
      if (RB.fence[RB.i]) return;   // still in flight: skip this frame's read
      gl.bindFramebuffer(gl.FRAMEBUFFER, RB.fb); gl.viewport(0, 0, 320, 150);
      gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
      use(P.read);
      gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, f.targets.scene.depthTex); gl.uniform1i(P.read.u.uDepth, 6);
      gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, f.targets.scene.aux); gl.uniform1i(P.read.u.uAux, 7);
      gl.uniform2f(P.read.u.uSrcSize, f.w, f.h);
      gl.bindVertexArray(triVAO); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, RB.pbo[RB.i]); gl.readPixels(0, 0, 320, 150, gl.RGBA, gl.FLOAT, 0); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      RB.fence[RB.i] = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      RB.i ^= 1;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };
    // logical (x, y) with y down -> the read texture's rows run bottom-up
    RB.at = function (x, y, ch) { if (!RB.have) return ch === 0 ? 1e9 : 0; x = x | 0; y = y | 0; if (x < 0 || y < 0 || x >= 320 || y >= 150) return ch === 0 ? 1e9 : 0; return RB.data[((149 - y) * 320 + x) * 4 + ch]; };
    return RB;
  })();
  function depthAt(x, y) { return readback.at(x, y, 0); }
  function materialAt(x, y) { return readback.at(x, y, 1) | 0; }
  function project(x, y, z) {
    const M = F.viewProj, pz = (z || 0) * ZK, cw = M[3] * x + M[7] * y + M[11] * pz + M[15];
    if (cw < F.near) return null;
    const sx = (M[0] * x + M[4] * y + M[8] * pz + M[12]) / cw, sy = (M[1] * x + M[5] * y + M[9] * pz + M[13]) / cw;
    return { x: (sx * 0.5 + 0.5) * LOG_W, y: (0.5 - sy * 0.5) * LOG_H, depth: cw };
  }
  function unproject(lx, ly) {
    const nx = lx / LOG_W * 2 - 1, ny = 1 - ly / LOG_H * 2, M = F.invViewProj;
    const tr = (z) => { const x = M[0] * nx + M[4] * ny + M[8] * z + M[12], y = M[1] * nx + M[5] * ny + M[9] * z + M[13], zz = M[2] * nx + M[6] * ny + M[10] * z + M[14], w = M[3] * nx + M[7] * ny + M[11] * z + M[15]; return [x / w, y / w, zz / w]; };
    const a = tr(-1), b = tr(1); const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const l = Math.hypot(d[0], d[1], d[2]) || 1;
    return { o: a, d: [d[0] / l, d[1] / l, d[2] / l] };
  }

  // ---------------------------------------------------------------------------------------------------- the frame
  let sizeDirty = true, lastNow = 0;
  function fitCanvas() {
    const game = document.getElementById('game'); if (!game || !canvas) return;
    const r = game.getBoundingClientRect(), dpr = (typeof devicePixelRatio === 'number' && devicePixelRatio > 0) ? devicePixelRatio : 1;
    const W = Math.max(320, Math.round(r.width * dpr)), H = Math.max(200, Math.round(r.height * dpr));
    if (W !== canvas.width || H !== canvas.height) { canvas.width = W; canvas.height = H; }
    F.devW = W; F.devH = H; F.vpH = Math.round(H * LOG_H / 200); F.vpY = H - F.vpH;
    sizeDirty = false;
  }
  // antialiasing: 4x on High and above (scale 2 presets) on hardware; never on a software rasteriser
  function msaaWanted() {
    if (opts0.msaa != null) return opts0.msaa | 0;
    if (st.software) return 0;
    const s = typeof GFX !== 'undefined' ? GFX.scale : 1;
    const max = gl.getParameter(gl.MAX_SAMPLES) || 0;
    return s >= 2 ? Math.min(4, max) : 0;
  }
  function resScale() {
    if (opts0.resScale) return clamp(+opts0.resScale || 1, 0.25, 1);
    const s = typeof GFX !== 'undefined' ? GFX.scale : 1;
    return s >= 2 ? 1 : 0.75;
  }
  // Engine.render's override: draw this frame with R3D. Returns true when drawn.
  function renderFrame(ents, tod, opts, env) {
    if (!st.inFrame || !wantedNow()) return false;
    const t0 = now();
    if (sizeDirty) fitCanvas();
    const m = env.map;
    F.map = m; F.env = env; F.ents = ents; F.opts = opts; F.outdoor = env.outdoor; F.tod = tod; F.time = env.animT; F.S = env.S;
    F.now = t0 / 1000; F.dt = lastNow ? clamp(F.now - lastNow, 0, 0.1) : 0.016; lastNow = F.now;
    const c = Engine.cam; F.cam.x = c.x; F.cam.y = c.y; F.cam.z = c.z == null ? 0.88 : c.z; F.cam.dir = c.dir; F.cam.pitch = c.pitch || 0; F.cam.bob = c.bob || 0;
    F.relief = !!m.relief;
    st.resScale = resScale();
    const w = Math.max(64, Math.round(F.devW * st.resScale)), h = Math.max(32, Math.round(F.vpH * st.resScale));
    targets.ensure(w, h, msaaWanted());
    F.w = w; F.h = h; F.pxK = w / LOG_W;
    frameCamera(F.cam, env);
    frameTextures(env);
    ensureMesh(m);
    worldCheck();
    F.nLights = frameLights(env, m);
    frameSun(env);
    frameUBO(env);
    buildDoors(m, F.cam);
    buildSpriteView(env, ents);
    // the virtual CPU frame for picking (same camera, same list)
    try { vframe(F.cam, env, ents); } catch (e) { warnOnce('vframe', e); }
    emit('frame', F);
    // sprites: SPRITES21 when loaded, else the provider fills CORE's batch
    spr.n = 0; stats.sprites = 0;
    const S2 = s21attach();
    if (S2 && !spr.provider) { try { S2.frame(ents, F.sview); } catch (e) { warnOnce('sprites21 frame', e); } }
    else { try { (spr.provider || defaultProvider)(F, ents, submit); } catch (e) { warnOnce('sprite provider', e); } }
    reconcileScreens(ents);
    // timer query (when the browser has one)
    let q = null;
    if (st.timer && !gpuQ.pending) { q = gl.createQuery(); gl.beginQuery(st.timer.TIME_ELAPSED_EXT, q); }
    stats.draws = 0;
    // clear the scene target
    bindScene(gl, F);
    gl.depthMask(true); gl.colorMask(true, true, true, true);
    gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 1]); gl.clearBufferfv(gl.COLOR, 1, [0, 0, 0, 1]); gl.clearBufferfi(gl.DEPTH_STENCIL, 0, 1, 0);
    let resolved = false;
    for (const p of passList) {
      if (p.enabled && !p.enabled(F)) continue;
      if (!resolved && (p.order || 0) >= 90) { resolveScene(gl, F); resolved = true; }
      try { p.draw(gl, F, api); } catch (e) { warnOnce('pass ' + p.name, e); if (p.name === 'post' || p.name === 'world') throw e; }
    }
    if (!resolved) resolveScene(gl, F);
    try { readback.render(F); } catch (e) { warnOnce('readback', e); }
    emit('after', F);
    if (q) { gl.endQuery(st.timer.TIME_ELAPSED_EXT); gpuQ.pending = q; }
    pollGpu();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const dtc = now() - t0;
    stats.frames++; stats.cpuLast = dtc; stats.cpu = stats.cpu ? stats.cpu * 0.95 + dtc * 0.05 : dtc;
    st.drew = true;
    return true;
  }
  const gpuQ = { pending: null };
  function pollGpu() {
    const q = gpuQ.pending; if (!q || !st.timer) return;
    if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) return;
    const disjoint = gl.getParameter(st.timer.GPU_DISJOINT_EXT);
    if (!disjoint) { const ns = gl.getQueryParameter(q, gl.QUERY_RESULT); stats.gpuLast = ns / 1e6; stats.gpu = stats.gpu ? stats.gpu * 0.95 + stats.gpuLast * 0.05 : stats.gpuLast; }
    gl.deleteQuery(q); gpuQ.pending = null;
  }

  // ---------------------------------------------------------------------------------------------------- on / off
  function resolveOn() {
    if (st.mode === 'off') return false;
    if (st.mode === 'on') return true;
    // auto: hardware WebGL2 only; automation keeps the classic renderer unless the page opts in
    if (automation && !opts0.automation) return false;
    return st.available === true && !st.software;
  }
  function wantedNow() {
    return !!(st.on && gl && resourcesOK && !st.lost && !st.failed && !originalish() && typeof GPU18 !== 'undefined' && GPU18.claimHud && typeof G !== 'undefined' && G.map);
  }
  function sync() {
    st.on = resolveOn();
    const want = !!(st.on && gl && resourcesOK && !st.lost && !st.failed && !originalish() && typeof GPU18 !== 'undefined' && GPU18.claimHud);
    const game = typeof document !== 'undefined' ? document.getElementById('game') : null;
    if (want && !st.shown) {
      st.shown = true; sizeDirty = true;
      try { GPU18.claimHud(api); } catch (e) { warnOnce('claim', e); }
      if (game) game.classList.add('r3d21-on');
      emit('toggle', true);
      try { netStart(); } catch (e) { /* fine */ }
    } else if (!want && st.shown) {
      st.shown = false;
      try { if (GPU18.hudClaim && GPU18.hudClaim() === api) GPU18.claimHud(null); } catch (e) { warnOnce('release', e); }
      if (game) game.classList.remove('r3d21-on');
      emit('toggle', false);
    }
    if (typeof GFX !== 'undefined') GFX.r3d = st.shown;
    syncRows();
    return st.shown;
  }
  function setMode(mode, o) {
    if (mode !== 'auto' && mode !== 'on' && mode !== 'off') return st.mode;
    st.mode = mode;
    if (mode !== 'off' && !gl) probe(true);
    if (mode === 'on') st.failed = false;
    if (!(o && o.noSave)) save();
    sync();
    return st.mode;
  }
  function fail(e) { warnOnce('frame', e); st.failed = true; st.failWhy = String(e && e.message || e); sync(); }

  // ---------------------------------------------------------------------------------------------------- integration
  function wire() {
    if (typeof Engine === 'undefined' || !Engine.setRenderOverride) return;
    Engine.setRenderOverride((ents, tod, opts, env) => {
      if (!st.inFrame || !st.shown) return false;
      try { return renderFrame(ents, tod, opts, env); } catch (e) { fail(e); return false; }
    });
    // the outermost render(): the game's frame with R3D allowed to draw the 3D view
    if (typeof render === 'function') {
      const _render = render;
      render = function () {
        if (st.shown !== !!(st.on && wantedNowNoMap())) sync();
        clampPitchForRenderer();
        if (!st.shown) return _render.apply(this, arguments);
        st.inFrame = true; st.drew = false;
        try { return _render.apply(this, arguments); } finally { st.inFrame = false; }
      };
    }
    // picking and the read-backs follow the renderer that drew the last frame
    const _pick = Engine.pick, _depth = Engine.depthAt, _mat = Engine.materialAt;
    Engine.pick = function (ents, maxDist) { if (st.shown && st.drew && VCAM.map === (typeof G !== 'undefined' ? G.map : null)) return pick(ents, maxDist); return _pick.apply(this, arguments); };
    Engine.depthAt = function (x, y) { if (st.shown && st.drew) return depthAt(x, y); return _depth.apply(this, arguments); };
    Engine.materialAt = function (x, y) { if (st.shown && st.drew) return materialAt(x, y); return _mat.apply(this, arguments); };
    wireLook();
    wireMenu();
    if (typeof GFX !== 'undefined' && GFX.onChange) GFX.onChange(() => { try { sync(); } catch (e) { warnOnce('sync', e); } });
  }
  function wantedNowNoMap() { return !!(gl && resourcesOK && !st.lost && !st.failed && !originalish() && typeof GPU18 !== 'undefined' && GPU18.claimHud); }

  // ---- the camera: free look in angle space, clamped per renderer
  const camera = {
    angle: () => Math.atan(((typeof Engine !== 'undefined' && Engine.cam.pitch) || 0) / FX),
    setAngle(a) { a = clamp(+a || 0, -camera.limit(), camera.limit()); Engine.cam.pitch = FX * Math.tan(a); return a; },
    // the widest look the active renderer can show: R3D 80 degrees (comfort 45); the CPU's y-shear up to CPU_ROWS rows;
    // the Original preset keeps the old 40 rows
    limit() { if (originalish()) return Math.atan(OLD_PITCH / FX); return st.shown ? (st.cap * Math.PI / 180) : Math.atan(CPU_ROWS / FX); },
    FX, ZK,
  };
  const CPU_ROWS = 110;  // the CPU raycaster's widest look (24 degrees): checked to +-150 rows with no breakage (floor casting,
  // sky rows, sun, landmarks, relief walk); past ~110 the y-shear only fills the view with floor or sky
  const RATE = 0.0032;   // radians of pitch per unit of look input (the same as yaw; the game halves vertical mouse input)
  function clampPitchForRenderer() {
    if (typeof Engine === 'undefined') return;
    const c = Engine.cam, lim = camera.limit(), a = Math.atan((c.pitch || 0) / FX);
    if (a > lim + 1e-9 || a < -lim - 1e-9) c.pitch = FX * Math.tan(clamp(a, -lim, lim));
  }
  function wireLook() {
    if (typeof look !== 'function') return;
    const _look = look;
    look = function (mx, my) {
      if (originalish() || typeof Engine === 'undefined' || typeof sensK !== 'function') return _look.apply(this, arguments);
      const k = sensK();
      Engine.cam.dir += mx * 0.0032 * k;   // exactly the game's yaw
      const inv = (typeof G !== 'undefined' && G.opts && G.opts.invertY) ? -1 : 1;
      const lim = camera.limit();
      const a = clamp(Math.atan((Engine.cam.pitch || 0) / FX) - my * RATE * k * inv, -lim, lim);
      Engine.cam.pitch = FX * Math.tan(a);
    };
    // gamepad right stick, vertical: the game turns with axes[2] only
    let padT = 0;
    const padTick = (t) => {
      try {
        requestAnimationFrame(padTick);
        const dt = padT ? Math.min(0.1, (t - padT) / 1000) : 0; padT = t;
        if (typeof G === 'undefined' || G.state !== 'play' || originalish() || !navigator.getGamepads) return;
        const pads = navigator.getGamepads(); let gp = null; for (const p of pads) if (p && p.connected) { gp = p; break; }
        if (!gp) return;
        const v = gp.axes[3] || 0; if (Math.abs(v) < 0.18) return;
        const inv = (G.opts && G.opts.invertY) ? -1 : 1, lim = camera.limit();
        const a = clamp(Math.atan((Engine.cam.pitch || 0) / FX) - v * 1.6 * dt * inv, -lim, lim);
        Engine.cam.pitch = FX * Math.tan(a);
      } catch (e) { /* no pads */ }
    };
    if (typeof requestAnimationFrame === 'function' && !automation) requestAnimationFrame(padTick);
    api._padTick = padTick;
  }

  // ---- Options rows: "3D renderer" and "Look range"
  const ROWS = [
    ['r3d-mode', '3D renderer', 'True 3D (WebGL2): look up and down freely; Classic: the original raycaster'],
    ['r3d-cap', 'Look range', 'how far up and down the free look turns (Comfort: 45 degrees)'],
  ];
  function syncRows() {
    if (typeof document === 'undefined') return;
    const b = document.getElementById(ROWS[0][0]);
    if (b) {
      const avail = st.available !== false;
      const lab = st.mode === 'auto' ? (st.on ? 'Auto: True 3D' : 'Auto: Classic') : st.mode === 'on' ? 'True 3D' : 'Classic';
      b.textContent = avail ? lab : 'Not available';
      b.disabled = !avail; b.setAttribute('aria-pressed', st.shown ? 'true' : 'false'); b.classList.toggle('sel', st.shown);
      const h = document.getElementById(ROWS[0][0] + '-hint');
      if (h) h.textContent = !avail ? 'WebGL2 is not available on this device' : originalish() ? 'the Original preset always uses the classic raycaster' : ROWS[0][2];
    }
    const c = document.getElementById(ROWS[1][0]);
    if (c) { c.textContent = st.cap === 45 ? 'Comfort (45°)' : 'Full (80°)'; c.setAttribute('aria-pressed', st.cap === 45 ? 'true' : 'false'); }
  }
  function appendRows() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById(ROWS[0][0]) || !document.getElementById('gfx-state')) return;
    let anchor = document.getElementById('gpu-comp') || document.getElementById('cine-grade') || document.getElementById('gfx-curve');
    for (const [id, name, hint] of ROWS) {
      const lab = document.createElement('span'); lab.className = 'gfx-label'; lab.id = id + '-label'; lab.textContent = name + ' ';
      const small = document.createElement('small'); small.className = 'muted'; small.id = id + '-hint'; small.textContent = hint; lab.appendChild(small);
      const b = document.createElement('button'); b.className = 'dfbtn small'; b.id = id; b.type = 'button'; b.setAttribute('aria-label', name);
      if (id === 'r3d-mode') b.onclick = () => { if (st.available === null) probe(true); setMode(st.shown ? 'off' : 'on'); };
      else b.onclick = () => { st.cap = st.cap === 45 ? 80 : 45; save(); clampPitchForRenderer(); syncRows(); };
      if (anchor && anchor.parentNode === grid) { anchor.insertAdjacentElement('afterend', b); anchor.insertAdjacentElement('afterend', lab); anchor = b; }
      else { grid.appendChild(lab); grid.appendChild(b); }
    }
    syncRows();
  }
  function wireMenu() {
    if (typeof renderAccessibilityMenu !== 'function') return;
    const _acc = renderAccessibilityMenu;
    renderAccessibilityMenu = function () { const r = _acc.apply(this, arguments); try { appendRows(); } catch (e) { warnOnce('rows', e); } return r; };
  }

  // ---- the safety net (js/max20.js calls this before stepping a preset down): an auto R3D that runs slow goes back to
  // the raycaster first. Returns true when it took the step.
  function netStep() {
    if (!st.shown || st.mode !== 'auto') return false;
    st.mode = 'off'; st.settled = true; save(); sync();
    return true;
  }

  // ---- R3D's own net, for when js/max20.js is not measuring (a Medium pick, a phone): an auto R3D whose median frame
  // over 4 s of play is slower than 30 fps goes back to the raycaster; 20 s of smooth play settles the choice.
  const NET = { samples: [], playS: 0, lastT: 0, on: false, skip: 1, windows: [] };
  const netLive = !automation || opts0.automation === true;
  function netWanted() {
    if (!netLive || st.mode !== 'auto' || st.settled || !st.shown) return false;
    try { if (typeof MAX20 !== 'undefined' && MAX20.measuring && MAX20.measuring()) return false; } catch (e) { /* fine */ }
    return true;
  }
  function netFeed(ms) {
    if (!netWanted()) return false;
    if (!(ms > 0) || ms > 1000) return true;
    if (NET.skip > 0) { NET.skip -= ms / 1000; return true; }
    NET.samples.push(ms); NET.playS += ms / 1000;
    let win = 0; for (const x of NET.samples) win += x / 1000;
    if (win < 4) return true;
    const a = NET.samples.slice().sort((x, y) => x - y), med = a[a.length >> 1];
    NET.windows.push(Math.round(med * 10) / 10); NET.samples.length = 0;
    if (med > 1000 / 30) {
      netStep();
      try { if (typeof msg === 'function') msg('Graphics eased to the classic renderer to keep the game smooth — Options to change', 'warn', 6500); } catch (e) { /* fine */ }
      return false;
    }
    if (NET.playS >= 20) { st.settled = true; save(); return false; }
    return true;
  }
  function netTick(t) {
    if (!netWanted()) { NET.on = false; return; }
    requestAnimationFrame(netTick);
    const dt = NET.lastT ? t - NET.lastT : 0; NET.lastT = t;
    if (typeof G === 'undefined' || G.state !== 'play' || !G.map || (G.fadeT || 0) > 0) return;
    try { if (document.hidden) return; } catch (e) { /* fine */ }
    netFeed(dt);
  }
  function netStart() { if (NET.on || !netWanted() || typeof requestAnimationFrame !== 'function') return; NET.on = true; NET.lastT = 0; NET.skip = 1; requestAnimationFrame(netTick); }

  // ---- frame cost: median ms per game frame (render(): the 3D view and the HUD) with 12 enemies in view, R3D vs the CPU
  // raycaster, at the given presets. gl.finish() closes each R3D frame so the GPU's share is counted (on a software
  // rasteriser that is CPU time too). Puts the game back as it found it.
  function measure(o) {
    o = o || {};
    const scenes = o.scenes || [{ id: 'oakhaven', map: 'oakhaven', x: 23.5, y: 20.5, dir: -1.57, tod: 0.73 }, { id: 'tavern', map: 'tavern', x: 8.5, y: 10.5, dir: -1.57, tod: 0.85 }, { id: 'deepwoods', map: 'deepwoods', x: 27.5, y: 30.5, dir: -1.57, tod: 0.95 }];
    const presets = o.presets || ['medium', 'cinematic'], frames = o.frames || 20, runs = o.runs || 3;
    const keep = { map: G.mapId, x: Engine.cam.x, y: Engine.cam.y, dir: Engine.cam.dir, state: G.state, tod: G.tod, mode: st.mode, preset: GFX.preset };
    const med = (a) => { const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
    const out = {};
    try {
      for (const sc of scenes) {
        G.state = 'paused'; loadMap(sc.map, { x: sc.x, y: sc.y, dir: sc.dir }); G.state = 'play'; G.fadeT = 0; G.tod = sc.tod;
        const crowd = [];
        for (let i = 0; i < 12; i++) {
          const ang = sc.dir + (i - 5.5) * 0.11, d = 3 + (i % 6) * 1.6;
          const e = hydrate({ kind: 'enemy', type: ['hound', 'proctor', 'quiet', 'legionnaire'][i % 4], x: sc.x + Math.cos(ang) * d, y: sc.y + Math.sin(ang) * d });
          e.state = 'passive'; crowd.push(e); G.ents.push(e);
        }
        const t = {};
        for (const pr of presets) for (const m of ['off', 'on']) t[pr + '/' + (m === 'on' ? 'r3d' : 'cpu')] = [];
        for (let r = 0; r < runs; r++) for (const pr of presets) for (const m of ['off', 'on']) {
          PRESETS.apply(pr); setMode(m, { noSave: true });
          for (let i = 0; i < 3; i++) render();
          if (gl) gl.finish();
          const t0 = now();
          for (let i = 0; i < frames; i++) { render(); if (m === 'on' && gl) gl.finish(); }
          t[pr + '/' + (m === 'on' ? 'r3d' : 'cpu')].push((now() - t0) / frames);
        }
        for (const e of crowd) { const i = G.ents.indexOf(e); if (i >= 0) G.ents.splice(i, 1); }
        out[sc.id] = {}; for (const k in t) out[sc.id][k] = Math.round(med(t[k]) * 100) / 100;
      }
    } finally {
      setMode(keep.mode, { noSave: true }); if (PRESETS.table[keep.preset]) PRESETS.apply(keep.preset);
      G.state = 'paused'; loadMap(keep.map, { x: keep.x, y: keep.y, dir: keep.dir }); G.state = keep.state; G.tod = keep.tod;
    }
    out.renderer = st.renderer; out.software = st.software; out.size = F.w + 'x' + F.h;
    return out;
  }

  // ---- the CPU hooks R3D does not run, for the report and the teams (name -> order)
  // [module, kind, order, what it does, status under R3D]. 'core' = R3D draws it (CORE), 'light'/'sprites'/'body' = the team
  // that ports it, 'cpu-only' = not drawn under R3D (yet).
  const HOOKS = [
    ['engine', 'core', 0, 'walls, floors, ceilings, risers, caps, decals, detail, water, far-mode haze and distance average', 'core'],
    ['engine', 'core', 0, 'sprites (directional views, anim fields, glow, flash, hurt, elite light, emissive masks)', 'core (SPRITES21 replaces)'],
    ['engine', 'core', 0, 'sky rows, clouds, sun and moon, landmark ridges', 'core (LIGHT replaces the sky pass)'],
    ['doors.js', 'engine', 0, 'swinging door leaves (Doors.swing)', 'core'],
    ['gates.js', 'post', -8, 'lifting portcullis lattice, portal backing', 'core'], ['gates.js', 'post', -8, 'cave-in dust and falling stone', 'sprites'],
    ['calendar11.js', 'sky', 5, 'moon phases', 'light'], ['sky.js', 'sky', 10, 'stars', 'light'], ['sky.js', 'sky', 20, 'painted panoramas', 'light'],
    ['sky.js', 'sky', 30, 'Drift-Kestrel flyover', 'light'], ['skies14.js', 'sky', 12, 'aurora', 'light'], ['synod15.js', 'sky', 14, 'eclipse', 'light'],
    ['horizon20.js', 'post', -9.6, 'far country beyond the walls', 'light'], ['horizon20.js', 'post', -9.5, 'belfry bell', 'light'],
    ['props14.js', 'post', -7, 'glass shimmer', 'light'], ['props14.js', 'post', -4, 'mirrors', 'light'],
    ['lighting.js', 'post', -5, 'dark interiors (light falloff, lamp pools)', 'light'], ['motion10.js', 'post', -4, 'lantern glow', 'light'],
    ['look10.js', 'post', 4, 'ground shadows and fight marks', 'sprites'], ['air11.js', 'post', 5, 'footprints', 'sprites'],
    ['greening14.js', 'post', 5, 'Greening stages, root veins, glass spread', 'light'], ['extras17.js', 'post', 6, 'winter ground (snow)', 'light'],
    ['extras17.js', 'post', 7, 'winter roofs', 'light'], ['firesmoke.js', 'post', 8, 'chimney smoke and torch fire', 'sprites'],
    ['post.js', 'post', 10, 'soft fog', 'light'], ['post.js', 'post', 20, 'mist', 'light'], ['water.js', 'post', 25, 'water reflections and ripples', 'light'],
    ['hunters13.js', 'post', 26, 'grey wave', 'light'], ['skies14.js', 'post', 26, 'caustic light', 'light'], ['companions.js', 'post', 26, "Kaelen's glass hum glow", 'sprites'],
    ['flume16.js', 'post', 27, 'flume glow', 'light'], ['air11.js', 'post', 28, 'sun shafts', 'light'], ['post.js', 'post', 30, 'bloom', 'light'],
    ['air11.js', 'post', 35, 'heat haze', 'light'], ['air11.js', 'post', 36, 'glass glare', 'light'], ['air11.js', 'post', 38, 'cold breath', 'sprites'],
    ['extras17.js', 'post', 39, 'snowflakes', 'light'], ['post.js', 'post', 40, 'colour grade', 'light'], ['air11.js', 'post', 41, 'see-through ghosts', 'sprites'],
    ['extras17.js', 'post', 42, 'winter grade', 'light'], ['ghost18.js', 'post', 0, 'ghost replays', 'sprites'], ['sync19.js', 'post', 0, 'co-op figures (guest side)', 'sprites'],
    ['partner19.js', 'post', 0, 'partner figure measure', 'sprites'], ['motion10.js', 'post', 45, 'sparks', 'sprites'], ['smalllife.js', 'post', 0, 'rope and shard glimmer', 'sprites'],
    ['telegraphs.js', 'post', 0, 'attack telegraphs', 'sprites'], ['deep16.js', 'post', 50, 'underwater view (the Deep)', 'light'],
    ['cinema14.js', 'post', 95, 'Cinematic haze, ground fog, emissive bloom, god rays, grade, vignette', 'light'],
    ['fp-feel.js', 'post', 100, 'hit/deafen screen effects', 'body'], ['dread.js', 'post', 110, 'Dread phantom and vignette', 'light'],
    ['air11.js', 'post', -50, 'clock (state only)', 'cpu-only (harmless: presentation clock)'], ['extras17.js', 'post', -60, 'winter breath sync (state)', 'cpu-only (presentation)'],
  ];
  function cpuHooks() { return HOOKS.map(([module, kind, order, what, status]) => ({ module, kind, order, what, status })); }

  // ---------------------------------------------------------------------------------------------------- boot
  const api = {
    KEY, ZK, FX, MAT, st, stats, frame: F, camera, toGL,
    // state
    active: () => st.shown && st.drew, shown: () => st.shown, available: () => st.available === true, mode: () => st.mode, setMode, sync, probe,
    // passes and shaders
    addPass, removePass, getPass, passes: () => passList.map(p => ({ name: p.name, order: p.order })), program, use, setChunk, chunk, bindScene, bindOutput, resolveScene,
    gl: () => gl, worldTex, textureDirty, invalidate, extendMesh,
    // sprites
    sprites: { submit, setProvider, defaultProvider, dirty: (sp) => atlas.dirty(sp), atlas: () => ({ tex: atlas.tex, pages: atlas.pages, page: atlas.PAGE }), entry: (sp) => atlas.get(sp), count: () => spr.n },
    // picking and read-back
    pick, depthAt, materialAt, project, unproject, groundGL, sampleLight: (x, y) => sampleLight(F.env && F.env.ptLights, x, y),
    // hooks
    on, off,
    // tools and tests
    netStep, netFeed, net: NET, cpuHooks, measure, dynamicTris: () => mesh.dcount / 3, mesh: () => mesh.info, vframe: () => VCAM, reliefDepth, vdepth, buildMesh: () => { mesh.dirty = true; },
    readPixels() {
      if (!gl || !canvas) return null;
      const w = canvas.width, h = canvas.height, out = new Uint8Array(w * h * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, out);
      return { w, h, data: out };
    },
    canvas: () => canvas,
  };
  function boot() {
    load();
    snapLandmarks();
    for (const p of [skyPass, prePass, worldPass, spritePass, translucentPass, postPass]) if (!getPass(p.name)) passList.push(p);
    sortPasses();
    makeCanvas();
    if (st.mode !== 'off') probe(st.mode === 'on' || (automation && opts0.automation && opts0.force));
    wire();
    sync();
  }
  try { boot(); } catch (e) { warnOnce('boot', e); }
  return api;
})();
if (typeof window !== 'undefined') window.R3D = R3D;
