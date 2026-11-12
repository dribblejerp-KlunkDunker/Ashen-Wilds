// ============================================================
//  sprites21 — Phase 21 "Wow", team SPRITES: everything that is not map geometry, drawn by the WebGL2 renderer (R3D).
//
//  The CPU raycaster (js/engine.js) draws sprites column by column into its framebuffer; under R3D that pass does not
//  run, so this module draws the same things as real 3D billboards in R3D's scene:
//    * ENTITIES: enemies (with the Phase 20 hand-built five-angle views, picked by the very same animDirectionalSprite
//      chain the raycaster calls: anim.js, directions.js, bestiary20a/b, lighting.js's flame masks, enemy-fx's flinch
//      and boss phases), NPCs, companions, the co-op partner / host figures (partner19 puts them in the entity list),
//      items, props, scenery, small life (crows, rats, the cat are entities), corpses and death animations. Every field
//      the raycaster reads is honoured: scale, hs/cx/dy, yOff, animLift, animSX/SY, animSkew, animFlip, animAlpha
//      (dithered, so depth stays right), animHurt, animGlow, glow, flash, elite, emissive masks, the shard/core glow.
//      Each one is an upright quad turned to face the camera, alpha-tested at the raycaster's own threshold (alpha >
//      100), and written to the depth buffer with the depth of its own vertical axis (pulled a little toward the eye),
//      which is the raycaster's rule — a body is one thin line for occlusion — so a figure beside a wall never cuts
//      into it, a wall or crest in front hides it, and two bodies sort by their centres.
//    * DECALS on the ground: the soft contact shadows under everything that stands (js/look10.js's rules and
//      strengths) and the fight marks (blood, scorch, sparks, cracks: look10's own slots and masks), as small meshes
//      that follow the ground's height (slopes and steps), multiplied into the lit frame.
//    * TRANSLUCENT things, back to front, depth-tested but not written: fire and chimney smoke, steam and splash
//      droplets (js/firesmoke.js's particles), the ghost replay (js/ghost18.js), the casting halos, entrance rings,
//      mist and threads of js/telegraphs.js, the Light-glass glimmer of js/smalllife.js.
//    * The rest keeps working as it is: anim.js's ambient motes and enemy-fx's shards are drawn on the 2D canvas over
//      the view (they use e._screen, which this module fills exactly as the raycaster did, in the logical 320x150
//      space: x0, x1, y0, y1, dist, z), so HUD bars, name tags, hints, flourishes and labels follow every body.
//  Textures: ONE atlas family, pages of 1024x1024 RGBA8 (allocated as needed, at most 8), every sprite placed on a
//  8-pixel grid with an 8-pixel transparent gutter so its own 4-level mip chain (built here with the raycaster's
//  spriteMip rule: a 2x2 block is solid when two of its pixels are) never bleeds into a neighbour. Sampling is
//  nearest-texel with nearest mip: pixel art stays crisp close up and does not sparkle far away (the GPU's version of
//  the raycaster's "sprite LOD"). Emissive pixels are stored with alpha 200 instead of 255 (both pass the test), so
//  the mask costs nothing. Sprites are uploaded the first time they are seen (directional views, flinch frames, flame
//  frames and painter frames are made on demand by their modules) and found again by object identity; a sprite
//  whose pixel array or mask object changes is uploaded again. When the pages are full the least recently used page
//  is emptied and refilled on demand.
//  Batching: per frame one instance buffer for all billboards (sorted by page: one draw call per page in use, usually
//  one to three), one dynamic mesh for every decal (one draw call), one instance buffer for every translucent particle
//  (two calls: alpha and additive) and one call per translucent figure (the ghost).
//
//  CONTRACT (CORE's js/r3d21.js calls it: see its section 4; stable):
//    SPRITES21.attach(gl)              build GL objects on this context (R3D calls it once per context; idempotent)
//    SPRITES21.detach()                forget the GL objects (context lost)
//    SPRITES21.frame(ents, view)       once per frame, before drawing: picks every sprite, fills e._screen, steps the
//                                      bookkeeping of modules whose post hooks do not run under R3D (smoke, fight marks,
//                                      footprints, parry sparks)
//    SPRITES21.drawOpaque(view)        the alpha-tested billboards (depth write on)      — R3D pass 'sprites' (30)
//    SPRITES21.drawDecals(view)        shadows, marks, footprints (depth test, no write) — R3D pass 'sprites' (30)
//    SPRITES21.drawTranslucent(view)   particles, ghost, halos (depth test, no write)    — R3D pass 'transparent' (50)
//    SPRITES21.drawCasters(cview)      for LIGHT's shadow maps: this frame's billboards, depth only, each card turned
//                                      square to the light. cview = { vp (light view-proj, map space, z game units),
//                                      dir [dx, dy] (the light's horizontal direction) }
//    view = R3D's F.sview: { vp: Float32Array(16) column-major, MAP SPACE (x, y cells, z game units, z up) -> clip;
//             eye [x, y, z]; dir (yaw); pitch (radians); fogDist; outdoor; fog [r, g, b] 0..1 (the raycaster's tint
//             target per unit of light); light; ambient; flick; lights (the engine's point lights with wall masks); px
//             (render px per logical px: dither and pixel-noise size); spriteAspect = ZK (a raycaster sprite h tall is
//             h * sp.w / sp.h * ZK map units wide); ZK; optional: tilt (0..1, default 0.5: how far a thing seen steeply
//             from above leans back toward the eye; the parity view uses 0), map, animT, wx {haze, cloud}, farLod2 }.
//    Shading: on R3D's context the billboard program is built with R3D.program() and the 'common' + 'shade' chunks,
//    each texel is shaded by r3dShade() as a kind-1 R3DSurf (albedo, GL position, normal toward the eye, the raycaster's
//    fog/light factor fi and point-light add ladd, emissive), so whatever LIGHT puts in the 'shade' chunk lights every
//    sprite. Outputs: oColor and oAux (material 6, 8 for emissive texels and glowing entities; emissive in g);
//    blended passes leave aux untouched. Texture units 6 (atlas page) and 7 (mark masks); 0-5 are CORE's.
//    GL state on return from each draw: VAO null, blend off, depth test on, depthMask true, cull face off, unit 0.
//    SPRITES21.dev                     a parity view for tests and screenshots without R3D: the CPU frame with its
//                                      sprites hidden, drawn under these GL sprites with the raycaster's own
//                                      projection and depth (see dev.on()).
//  Nothing here changes gameplay: it reads entities, writes only e._screen (exactly what the raycaster wrote) and the
//  module's own fields (_s21*), consumes no game random numbers, and saves nothing. Original preset / no WebGL2 / the
//  "3D renderer" switch off = CORE does not call it, and the raycaster draws as before.
//  Procedural: no assets are loaded; the art is the game's own sprites.
// ============================================================
'use strict';

const SPRITES21 = (() => {
  const VWL = 320, VHL = 150;                   // the logical view every overlay works in
  const PAGE = 1024, MAX_PAGES = 16, AL = 8, LEVELS = 4;   // 8-pixel grid: four clean mip levels
  const BB_FLOATS = 20;                         // floats per billboard instance
  const PT_FLOATS = 16;                         // floats per particle instance
  const DC_FLOATS = 12;                         // floats per decal vertex
  const ALPHA_CUT = 100;                        // the raycaster's opacity threshold
  const EMIT_A = 200;                           // alpha that marks an emissive texel
  const st = {
    frames: 0, sprites: 0, culled: 0, uploads: 0, uploadPx: 0, evictions: 0, pages: 0, calls: 0, decals: 0, particles: 0,
    figures: 0, ms: { frame: 0, chooser: 0, own: 0, opaque: 0, decals: 0, translucent: 0, parts: {} }, missed: 0, warned: {},
  };
  const warnOnce = (k, e) => { if (st.warned[k]) return; st.warned[k] = true; console.warn('sprites21 ' + k, e); };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const pad = (n) => (n + AL - 1) & ~(AL - 1);
  const isNum = (v) => typeof v === 'number' && isFinite(v);

  let gl = null;
  const P = {};                                  // programs
  const B = {};                                  // buffers / VAOs
  let maskTex = null, maskCount = 0, maskIndex = null;

  // ================================================================ the atlas
  const pages = [];                              // { tex, shelves:[{y,h,x}], top, gen, used }
  let atlasGen = 0;
  const entries = new WeakMap();                 // sprite object -> { data, emit, pg, gen, u0, v0, u1, v1 }
  let frameNo = 0;
  function newPage() {
    const tex = gl.createTexture(), at = gl.getParameter(gl.ACTIVE_TEXTURE);
    gl.activeTexture(gl.TEXTURE0 + U_ATLAS);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, LEVELS, gl.RGBA8, PAGE, PAGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, LEVELS - 1);
    gl.activeTexture(at);
    const pg = { tex, shelves: [], top: 0, gen: ++atlasGen, used: 0, idx: pages.length };
    pages.push(pg); st.pages = pages.length;
    return pg;
  }
  function resetPage(pg) { pg.shelves.length = 0; pg.top = 0; pg.gen = ++atlasGen; st.evictions++; }
  // shelf packing on the 8-pixel grid: the best-fitting shelf by height, else a new shelf
  function placeIn(pg, w, h) {
    let best = null;
    for (const s of pg.shelves) if (s.h >= h && PAGE - s.x >= w && (!best || s.h < best.h)) best = s;
    if (best && best.h <= h * 1.6 + 8) { const x = best.x; best.x += w; return [x, best.y]; }
    if (pg.top + h <= PAGE) { pg.shelves.push({ y: pg.top, h, x: w }); pg.top += h; return [0, pg.top - h]; }
    if (best) { const x = best.x; best.x += w; return [x, best.y]; }
    return null;
  }
  function alloc(w, h) {
    for (const pg of pages) { const at = placeIn(pg, w, h); if (at) return [pg, at]; }
    if (pages.length < MAX_PAGES) { const pg = newPage(); const at = placeIn(pg, w, h); if (at) return [pg, at]; }
    // full: empty the least recently used page that this frame has not drawn from
    let lru = null;
    for (const pg of pages) if (pg.used !== frameNo && (!lru || pg.used < lru.used)) lru = pg;
    if (!lru) return null;
    resetPage(lru);
    const at = placeIn(lru, w, h);
    return at ? [lru, at] : null;
  }
  // level 0 copy (alpha quantised, emissive marked) and the two smaller levels (the raycaster's spriteMip rule)
  function level0(sp, W, H, keep) {
    const out = new Uint32Array(W * H), src = sp.data, emit = sp.emit, w = sp.w, h = sp.h;
    for (let y = 0; y < h; y++) {
      const so = y * w, oo = y * W;
      for (let x = 0; x < w; x++) {
        const p = src[so + x];
        // a translucent figure (the ghost) keeps its own alpha: its soft rim is part of the painting
        if (keep) { if ((p >>> 24) > 4) out[oo + x] = p >>> 0; continue; }
        if ((p >>> 24) <= ALPHA_CUT) continue;
        out[oo + x] = ((p & 0xffffff) | ((emit && emit[so + x] ? EMIT_A : 255) << 24)) >>> 0;
      }
    }
    return out;
  }
  function down(src, W, H, keep) {
    const w = W >> 1, h = H >> 1, d = new Uint32Array(w * h);
    if (keep) {
      // a painted alpha (the ghost) is averaged like any soft image: colour weighted by alpha, alpha by the block
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const p = src[(y * 2 + j) * W + x * 2 + i], pa = p >>> 24; r += (p & 255) * pa; g += ((p >>> 8) & 255) * pa; b += ((p >>> 16) & 255) * pa; a += pa; }
        if (a) d[y * w + x] = ((((a / 4) | 0) << 24) | (((b / a) | 0) << 16) | (((g / a) | 0) << 8) | ((r / a) | 0)) >>> 0;
      }
      return d;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, n = 0, em = 0;
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        const p = src[(y * 2 + j) * W + x * 2 + i], a = p >>> 24;
        if (a) { r += p & 255; g += (p >>> 8) & 255; b += (p >>> 16) & 255; n++; if (a === EMIT_A) em++; }
      }
      if (n >= 2) d[y * w + x] = (((em * 2 > n ? EMIT_A : 255) << 24) | (((b / n) | 0) << 16) | (((g / n) | 0) << 8) | ((r / n) | 0)) >>> 0;
    }
    return d;
  }
  function upload(pg, x, y, sp, keep) {
    const W = pad(sp.w) + AL, H = pad(sp.h) + AL;           // the gutter is uploaded too: a recycled page is cleaned
    let lv = level0(sp, W, H, keep), lw = W, lh = H;
    gl.bindTexture(gl.TEXTURE_2D, pg.tex);
    for (let L = 0; L < LEVELS; L++) {
      if (L) { lv = down(lv, lw, lh, keep); lw >>= 1; lh >>= 1; }
      gl.texSubImage2D(gl.TEXTURE_2D, L, x >> L, y >> L, lw, lh, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(lv.buffer));
    }
    st.uploads++; st.uploadPx += W * H;
  }
  // where a sprite lives in the atlas, uploading it if it is new or changed; null if it cannot be placed
  function entryFor(sp, keep) {
    keep = !!keep;
    let en = entries.get(sp);
    if (en && en.data === sp.data && en.emit === (sp.emit || null) && en.keep === keep && en.gen === en.pg.gen) { en.pg.used = frameNo; return en; }
    if (!(sp.data instanceof Uint32Array) || !(sp.w > 0) || !(sp.h > 0) || sp.data.length < sp.w * sp.h) return null;
    const W = pad(sp.w) + AL, H = pad(sp.h) + AL;
    if (W > PAGE || H > PAGE) return null;
    const got = alloc(W, H); if (!got) { st.missed++; return null; }
    const [pg, [x, y]] = got;
    const ua = gl.getParameter(gl.UNPACK_ALIGNMENT), at = gl.getParameter(gl.ACTIVE_TEXTURE);
    gl.activeTexture(gl.TEXTURE0 + U_ATLAS);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    try { upload(pg, x, y, sp, keep); } finally { gl.pixelStorei(gl.UNPACK_ALIGNMENT, ua); gl.activeTexture(at); }
    en = { data: sp.data, emit: sp.emit || null, keep, pg, gen: pg.gen, u0: x / PAGE, v0: y / PAGE, u1: (x + sp.w) / PAGE, v1: (y + sp.h) / PAGE };
    entries.set(sp, en); pg.used = frameNo;
    return en;
  }

  // ================================================================ shaders
  // Bodies without a header: on R3D's context the billboard program is made with R3D.program (CORE's header: the frame
  // and light uniform blocks, the 'common' and 'shade' chunks), so LIGHT's lighting reaches every sprite through
  // r3dShade() as a kind-1 surface; elsewhere (the parity view) the same bodies get a plain header and the raycaster's
  // formula. Every fragment shader writes R3D's two targets: colour, and aux (material id / 255, emissive); a blended
  // pass writes an aux value its blend leaves unchanged.
  const HEAD_S = '#version 300 es\nprecision highp float;\n';
  const BB_VS = `
layout(location=0) in vec2 a_c;
layout(location=1) in vec4 i_p;   // x, y, base z, world width
layout(location=2) in vec4 i_s;   // world height, anchor (0..1 from the drawn left edge), skew, depth pull
layout(location=3) in vec4 i_uv;  // u0 v0 u1 v1 (u swapped when flipped)
layout(location=4) in vec4 i_k;   // light factor f, hurt, alpha, flags (1 flash, 2 translucent, 4 unlit, 8 glowing entity, 16 own alpha)
layout(location=5) in vec4 i_l;   // point light rgb (0..1), glow floor for emissive texels
uniform mat4 u_vp; uniform vec3 u_eye; uniform vec2 u_right; uniform float u_tilt;
out vec2 v_uv; out vec4 v_k; out vec4 v_l; out vec3 v_w; out float v_h;
void main() {
  float lat = (a_c.x - i_s.y) * i_p.w + i_s.z * i_s.x * a_c.y;
  vec2 te = u_eye.xy - i_p.xy; float L = length(te);
  vec2 toEye = L > 1e-4 ? te / L : vec2(0.0);
  // free look: a thing seen steeply from above (an item on the floor, a rat at your feet) leans its top away from the eye
  // by part of the angle, so it is not seen edge-on; level views (and the parity view: u_tilt 0) keep it upright
  float elev = atan(u_eye.z - (i_p.z + i_s.x * 0.5), max(L, 1e-3));
  float tilt = u_tilt * clamp(elev - 0.2, 0.0, 1.2);
  float hz = i_s.x * a_c.y;
  vec3 P = vec3(i_p.xy + u_right * lat - toEye * (hz * sin(tilt)), i_p.z + hz * cos(tilt));
  vec4 c = u_vp * vec4(P, 1.0);
  // depth of the body's own (leaning) axis at this height, pulled toward the eye: the raycaster's occlusion rule
  vec3 A = vec3(i_p.xy - toEye * (hz * sin(tilt)) + toEye * min(i_s.w, L * 0.5), P.z);
  vec4 ca = u_vp * vec4(A, 1.0);
  if (ca.w > 1e-3) c.z = clamp(ca.z / ca.w, -1.0, 1.0) * c.w;
  gl_Position = c;
  v_uv = vec2(mix(i_uv.x, i_uv.z, a_c.x), mix(i_uv.w, i_uv.y, a_c.y));
  v_k = i_k; v_l = i_l; v_w = P; v_h = 1.0 - a_c.y;
}`;
  const SHADE_FALLBACK = `
uniform vec3 u_fog; uniform float u_light; uniform float u_outdoor;
vec3 s21Shade(vec3 c, vec3 wpos, vec3 n, float emis, float f, vec3 pl) {
  // the raycaster's tint() outdoors (blend to the fog colour, then the daylight) and shade() indoors;
  // a texel that gives its own light is not dimmed by the hour (the raycaster's bloom made up for that)
  float day = emis > 0.5 ? max(u_light, f) : u_light;
  vec3 o = u_outdoor > 0.5 ? (c * f + u_fog * (1.0 - f)) * day + pl : c * f + pl;
  return min(o, vec3(1.0));
}`;
  const SHADE_R3D = `
uniform float u_zk;
vec3 s21Shade(vec3 c, vec3 wpos, vec3 n, float emis, float f, vec3 pl) {
  R3DSurf s; s.albedo = c; s.pos = vec3(wpos.xy, wpos.z * u_zk); s.nrm = n; s.side = 1.0; s.mat = 6.0;
  s.emissive = emis; s.fi = f; s.ladd = pl; s.kind = 1;
  return r3dShade(s);
}`;
  const BB_FS = (shade) => `
uniform sampler2D u_atlas; uniform float u_px; uniform vec3 u_eye;
in vec2 v_uv; in vec4 v_k; in vec4 v_l; in vec3 v_w; in float v_h;
layout(location=0) out vec4 oColor; layout(location=1) out vec4 oAux;
${shade}
const float BY[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
void main() {
  vec4 t = texture(u_atlas, v_uv);
  // flags in the whole part; a spectral body's travelling ribbon position (0 top .. 1 feet) in the fraction
  float al = v_k.z; int flags = int(floor(v_k.w + 1e-4)); float band = fract(v_k.w + 1e-4);
  bool raw = (flags & 16) != 0;                     // a figure that keeps its own alpha (the ghost)
  if (t.a < (raw ? 0.02 : 0.25)) discard;
  if (raw) al *= t.a;
  bool trans = (flags & 2) != 0;
  if (!trans && al < 0.999) { ivec2 q = ivec2(floor(gl_FragCoord.xy / u_px)) & 3; if (BY[q.y * 4 + q.x] >= al * 16.0) discard; }
  float emis = (!raw && t.a < 0.9) ? 1.0 : 0.0;
  vec3 c = t.rgb;
  float hk = v_k.y * 0.45;
  if (hk > 0.0) c = vec3(c.r + (1.0 - c.r) * hk, c.g * (1.0 - hk), c.b * (1.0 - hk));
  float f = emis > 0.5 ? max(v_k.x, v_l.w) : v_k.x;
  vec3 n = vec3(normalize(u_eye.xy - v_w.xy + vec2(1e-5)), 0.0);
  vec3 col = (flags & 4) != 0 ? c : s21Shade(c, v_w, n, emis, f, v_l.rgb);
  // air11's see-through kinds: a faint cool wash over the body and a brighter ribbon travelling up it
  if ((flags & 32) != 0) { bool onBand = (flags & 64) == 0 && abs(v_h - band) < 0.012; col = mix(col, vec3(150.0, 190.0, 235.0) / 255.0, onBand ? 0.34 : 0.1); }
  if ((flags & 1) != 0) col = vec3(1.0, 230.0 / 255.0, 200.0 / 255.0);
  if (trans) { oColor = vec4(col * al, al); oAux = vec4(0.0); return; }
  oColor = vec4(col, 1.0);
  oAux = vec4(((emis > 0.5 || (flags & 8) != 0) ? 8.0 : 6.0) / 255.0, emis, 0.0, 1.0);
}`;
  // decals: soft shadow discs (0), look10 / air11 marks (1, multiply) and pale water prints (2, additive)
  const DC_VS = `
layout(location=0) in vec3 a_p; layout(location=1) in vec2 a_uv; layout(location=2) in vec4 a_k; layout(location=3) in vec3 a_m;
uniform mat4 u_vp;
out vec2 v_uv; out vec4 v_k; out vec3 v_m;
void main() { gl_Position = u_vp * vec4(a_p, 1.0); v_uv = a_uv; v_k = a_k; v_m = a_m; }`;
  const DC_FS = `
uniform sampler2D u_masks; uniform float u_maskN;
in vec2 v_uv; in vec4 v_k; in vec3 v_m;
layout(location=0) out vec4 oColor; layout(location=1) out vec4 oAux;
void main() {
  if (abs(v_uv.x) > 1.0 || abs(v_uv.y) > 1.0) discard;
  float a;
  if (v_k.x < 0.5) {
    float q = dot(v_uv, v_uv); if (q >= 1.0) discard;
    a = v_k.z * pow(1.0 - q, v_k.w);
    // the sun is what a shadow takes away: red goes first, blue least (look10)
    oColor = vec4(1.0 - a, 1.0 - a * 0.97, 1.0 - a * 0.875, 1.0); oAux = vec4(1.0);
  } else {
    // the raycaster samples the 32x32 mask with a floor(): nearest texel, no smoothing (pixel art)
    vec2 m = floor((v_uv + 1.0) * 15.5) + 0.5;
    float cov = texture(u_masks, vec2(m.x / 32.0, (v_k.y * 32.0 + m.y) / (32.0 * u_maskN))).r;
    a = cov * v_k.z; if (a <= 0.003) discard;
    if (v_k.x < 1.5) { oColor = vec4(vec3(1.0) - a + a * v_m, 1.0); oAux = vec4(1.0); }
    else { oColor = vec4(v_m * a, 0.0); oAux = vec4(0.0); }
  }
}`;
  // particles: quads facing the eye, upright, or flat on the ground. kind 0 soft noisy disc (smoke, steam, mist),
  // 1 solid square (droplet, spark, thread), 2 ring (entrance, song), 3 soft ellipse (halos, glimmer, breath)
  const PT_VS = `
layout(location=0) in vec2 a_c;
layout(location=1) in vec4 i_p;   // x, y, z (centre), pull toward the eye
layout(location=2) in vec4 i_r;   // half width, half height (world), kind, seed
layout(location=3) in vec4 i_c;   // rgb 0..1, alpha
layout(location=4) in vec4 i_x;   // ring thickness, orientation (0 facing, 1 upright, 2 flat), 0, 0
uniform mat4 u_vp; uniform vec3 u_eye; uniform vec3 u_r3; uniform vec3 u_u3;
out vec2 v_q; out vec4 v_c; out vec4 v_r; out vec4 v_x;
void main() {
  vec2 q = a_c * 2.0 - 1.0;
  vec3 rt = i_x.y > 1.5 ? vec3(1.0, 0.0, 0.0) : u_r3;
  vec3 up = i_x.y > 1.5 ? vec3(0.0, 1.0, 0.0) : i_x.y > 0.5 ? vec3(0.0, 0.0, 1.0) : u_u3;
  vec3 P = i_p.xyz + rt * q.x * i_r.x + up * q.y * i_r.y;
  vec3 te = u_eye - i_p.xyz; float L = length(te);
  P += (L > 1e-4 ? te / L : vec3(0.0)) * min(i_p.w, L * 0.5);
  gl_Position = u_vp * vec4(P, 1.0);
  v_q = q; v_c = i_c; v_r = i_r; v_x = i_x;
}`;
  const PT_FS = `
uniform float u_px;
in vec2 v_q; in vec4 v_c; in vec4 v_r; in vec4 v_x;
layout(location=0) out vec4 oColor; layout(location=1) out vec4 oAux;
float h21(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float d2 = dot(v_q, v_q), a = v_c.a, k = v_r.z;
  if (k < 0.5) {
    if (d2 >= 1.0) discard;
    // the firesmoke puff: brightest in the middle, a fixed pixel noise (in art-sized cells) so it is not airbrushed
    vec2 cell = floor(gl_FragCoord.xy / max(1.0, u_px));
    a *= (1.0 - d2) * (0.72 + 0.28 * h21(cell + v_r.w));
  } else if (k < 1.5) {
    if (max(abs(v_q.x), abs(v_q.y)) > 1.0) discard;
  } else if (k < 2.5) {
    float r = sqrt(d2); if (abs(r - 1.0) > v_x.x) discard;
  } else {
    if (d2 >= 1.0) discard;
    float u = 1.0 - d2; a *= u * u;
  }
  if (a <= 0.002) discard;
  oColor = vec4(v_c.rgb * a, a); oAux = vec4(0.0);
}`;
  // shadow casters: the same billboards seen from a light (LIGHT's shadow maps). Each card turns to face the light, so a
  // figure throws its whole silhouette whatever the camera does; depth only, alpha-tested at the raycaster's threshold
  const SC_VS = `
layout(location=0) in vec2 a_c;
layout(location=1) in vec4 i_p; layout(location=2) in vec4 i_s; layout(location=3) in vec4 i_uv; layout(location=4) in vec4 i_k;
uniform mat4 u_vp; uniform vec2 u_right;
out vec2 v_uv; out float v_a;
void main() {
  float lat = (a_c.x - i_s.y) * i_p.w + i_s.z * i_s.x * a_c.y;
  vec3 P = vec3(i_p.xy + u_right * lat, i_p.z + i_s.x * a_c.y);
  gl_Position = u_vp * vec4(P, 1.0);
  v_uv = vec2(mix(i_uv.x, i_uv.z, a_c.x), mix(i_uv.w, i_uv.y, a_c.y)); v_a = i_k.z;
}`;
  const SC_FS = `
uniform sampler2D u_atlas;
in vec2 v_uv; in float v_a;
void main() { if (texture(u_atlas, v_uv).a < 0.25 || v_a < 0.5) discard; }`;
  // the parity view: CPU frame plus its depth, converted to this projection
  const DV_VS = `#version 300 es
layout(location=0) in vec2 a_c; out vec2 v_t;
void main() { v_t = vec2(a_c.x, 1.0 - a_c.y); gl_Position = vec4(a_c * 2.0 - 1.0, 0.0, 1.0); }`;
  const DV_FS = `#version 300 es
precision highp float;
uniform sampler2D u_col; uniform highp sampler2D u_dep; uniform vec2 u_ab;
in vec2 v_t; out vec4 o;
void main() {
  float t = texture(u_dep, v_t).r;
  float z = t > 1e8 ? 1.0 : clamp(u_ab.x + u_ab.y / max(t, 1e-3), -1.0, 1.0);
  gl_FragDepth = z * 0.5 + 0.5;
  o = vec4(texture(u_col, v_t).rgb, 1.0);
}`;

  function compile(vs, fs, name) {
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(name + ' shader: ' + log); } return s; };
    const p = gl.createProgram(), v = mk(gl.VERTEX_SHADER, HEAD_S + vs), f = mk(gl.FRAGMENT_SHADER, HEAD_S + fs);
    gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    gl.deleteShader(v); gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(name + ' link: ' + gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  // R3D's API when this context is R3D's own (its programs, chunks and frame uniforms apply here)
  function r3dOf(context) {
    try { if (typeof R3D !== 'undefined' && R3D && R3D.frame && R3D.frame.gl === context && typeof R3D.program === 'function') return R3D; } catch (e) { /* none */ }
    return null;
  }
  let R3 = null;
  // the billboard program: through R3D.program (LIGHT's shade chunk) on R3D's context, else the raycaster's formula
  let bbProg = null;
  function bbProgram() {
    if (bbProg) return bbProg;
    if (R3) { const P = R3.program(BB_VS, BB_FS(SHADE_R3D), { chunks: ['common', 'shade'] }); bbProg = { R: P, light: true, get p() { return P.p; }, get u() { return P.u; } }; }
    else { bbProg = compile(BB_VS, BB_FS(SHADE_FALLBACK), 'billboard'); bbProg.light = false; }
    return bbProg;
  }

  // ================================================================ GL objects
  const QUAD = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
  function vaoInstanced(locs, floats) {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, B.quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    for (let i = 0; i < locs; i++) { gl.enableVertexAttribArray(1 + i); gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, floats * 4, i * 16); gl.vertexAttribDivisor(1 + i, 1); }
    gl.bindVertexArray(null);
    return { vao, buf, cap: 0 };
  }
  function attach(context) {
    if (gl === context && P.dc) return true;
    gl = context; bbProg = null; R3 = r3dOf(context); pages.length = 0; st.pages = 0;
    try {
      B.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, B.quad); gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
      B.bb = vaoInstanced(5, BB_FLOATS);
      B.pt = vaoInstanced(4, PT_FLOATS);
      { const vao = gl.createVertexArray(); gl.bindVertexArray(vao); const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        const S = DC_FLOATS * 4; gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, S, 0);
        gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, S, 12);
        gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, S, 20);
        gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, S, 36);
        gl.bindVertexArray(null); B.dc = { vao, buf, cap: 0 }; }
      bbProgram();
      P.dc = compile(DC_VS, DC_FS, 'decal');
      P.pt = compile(PT_VS, PT_FS, 'particle');
      P.sc = compile(SC_VS, SC_FS, 'casters');
      buildMasks();
      return true;
    } catch (e) { warnOnce('attach', e); gl = null; P.dc = null; return false; }
  }
  function detach() { gl = null; P.dc = P.pt = null; bbProg = null; R3 = null; pages.length = 0; st.pages = 0; maskTex = null; dev.lost(); }
  // look10's mark masks (32x32 coverage each) stacked in one R8 texture
  function buildMasks() {
    maskTex = null; maskCount = 0; maskIndex = null;
    if (typeof LOOK10 === 'undefined' || !LOOK10.KINDS) return;
    const list = [], idx = {};
    for (const k of Object.keys(LOOK10.KINDS)) { idx[k] = list.length; for (const m of LOOK10.KINDS[k].masks) list.push(m); }
    // air11's footprint masks are 16x16: each texel becomes a 2x2 block of a 32x32 slot (the same nearest look)
    if (typeof AIR11 !== 'undefined' && AIR11.prints && AIR11.prints.masks) {
      idx._prints = list.length;
      for (const m of AIR11.prints.masks) { const big = new Uint8Array(1024); for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) big[y * 32 + x] = m[(y >> 1) * 16 + (x >> 1)]; list.push(big); }
    }
    if (!list.length) return;
    const data = new Uint8Array(32 * 32 * list.length);
    list.forEach((m, i) => data.set(m.subarray(0, 1024), i * 1024));
    const ua = gl.getParameter(gl.UNPACK_ALIGNMENT), at = gl.getParameter(gl.ACTIVE_TEXTURE);
    gl.activeTexture(gl.TEXTURE0 + U_MASKS);
    maskTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, maskTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 32, 32 * list.length, 0, gl.RED, gl.UNSIGNED_BYTE, data);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, ua);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.activeTexture(at);
    maskCount = list.length; maskIndex = idx;
  }
  function upload1(b, arr, n) {
    gl.bindBuffer(gl.ARRAY_BUFFER, b.buf);
    if (b.cap < arr.length) { gl.bufferData(gl.ARRAY_BUFFER, arr.byteLength, gl.DYNAMIC_DRAW); b.cap = arr.length; }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, arr, 0, n);
  }

  // ================================================================ per-frame collection (CPU)
  let BB = new Float32Array(BB_FLOATS * 512), nBB = 0;
  let bbPage = [];                                // page object per billboard instance
  let order = new Uint32Array(512);
  let BBS = new Float32Array(BB_FLOATS * 512);    // billboards sorted by page
  const runs = [];                                // [{pg, start, count}]
  const figures = [];                             // translucent textured figures: {en, inst Float32Array, d}
  let PT = new Float32Array(PT_FLOATS * 256), nPT = 0, PTA = null;   // alpha particles, additive particles
  let PTadd = new Float32Array(PT_FLOATS * 64), nPTadd = 0;
  let DC = new Float32Array(DC_FLOATS * 4096), nDC = 0, nDCmul = 0;
  const ptDist = []; let ptOrder = new Uint32Array(256);
  let V = null;                                   // the view of this frame
  let fogDist = 12, rightX = 0, rightY = 1, fwdX = 1, fwdY = 0;
  let mapNow = null, animT = 0, wxNow = null, chooseMs = 0;
  function growBB() { const n = new Float32Array(BB.length * 2); n.set(BB); BB = n; BBS = new Float32Array(BB.length); order = new Uint32Array(BB.length / BB_FLOATS); }
  function growPT(add) { if (add) { const n = new Float32Array(PTadd.length * 2); n.set(PTadd); PTadd = n; } else { const n = new Float32Array(PT.length * 2); n.set(PT); PT = n; ptOrder = new Uint32Array(PT.length / PT_FLOATS); } }
  function growDC() { const n = new Float32Array(DC.length * 2); n.set(DC); DC = n; }

  // the raycaster's coloured point lights at a world point (lights in its own format, wall masks honoured)
  function litBy(L, wx, wy) {
    if (!L.vis) return true;
    const i = (wx | 0) - L.vox, j = (wy | 0) - L.voy;
    return i >= 0 && j >= 0 && i < L.vd && j < L.vd && L.vis[j * L.vd + i] === 1;
  }
  const LC = [0, 0, 0];
  function lightAt(lights, wx, wy) {
    let cr = 0, cg = 0, cb = 0;
    if (lights) for (let i = 0; i < lights.length; i++) {
      const L = lights[i], dx = wx - L.x, dy = wy - L.y, d2 = dx * dx + dy * dy, r2 = L.r * L.r;
      if (d2 < r2 && litBy(L, wx, wy)) { const k = 1 - d2 / r2, kk = k * k; cr += L.cr * kk; cg += L.cg * kk; cb += L.cb * kk; }
    }
    LC[0] = cr > 90 ? 90 : cr; LC[1] = cg > 90 ? 90 : cg; LC[2] = cb > 90 ? 90 : cb;
    return LC;
  }
  // the raycaster's fog/light factor for a thing at distance d
  function lightF(d) {
    let f = 1 - d / Math.max(0.5, fogDist); if (f < 0) f = 0;
    const amb = V.ambient || 0;
    f = amb + (1 - amb) * f;
    if (!V.outdoor) f *= V.flick == null ? 1 : V.flick;
    return f;
  }
  function groundAt(x, y) {
    const m = mapNow; if (!m) return 0;
    if (!(m.lvls || m.smooth || m.verts)) return 0;
    try { return m.groundAt ? m.groundAt(x, y) : 0; } catch (e) { return 0; }
  }
  // project a map point with the frame's matrix into the logical 320x150 view; returns w (<= 0: behind the eye)
  const PJ = [0, 0, 0];
  function project(x, y, z) {
    const m = V.vp;
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw <= 1e-4) { PJ[2] = cw; return cw; }
    PJ[0] = (cx / cw + 1) * 0.5 * VWL; PJ[1] = (1 - cy / cw) * 0.5 * VHL; PJ[2] = cw;
    return cw;
  }
  // does a box of world points fall wholly outside one clip plane (cheap frustum test on the 8 corners of a quad's
  // swept box: the quad turns about z, so its corners are within r of the axis)
  function offscreen(x, y, z0, z1, r) {
    const m = V.vp; let outL = 0, outR = 0, outB = 0, outT = 0, outN = 0;
    for (let k = 0; k < 8; k++) {
      const px = x + ((k & 1) ? r : -r), py = y + ((k & 2) ? r : -r), pz = (k & 4) ? z1 : z0;
      const cx = m[0] * px + m[4] * py + m[8] * pz + m[12], cy = m[1] * px + m[5] * py + m[9] * pz + m[13], cw = m[3] * px + m[7] * py + m[11] * pz + m[15];
      if (cx < -cw) outL++; if (cx > cw) outR++; if (cy < -cw) outB++; if (cy > cw) outT++; if (cw < 0.03) outN++;
    }
    return outL === 8 || outR === 8 || outB === 8 || outT === 8 || outN === 8;
  }

  const SHARD = { shard: 1, core: 1 };
  // air11's see-through spectral kinds (the Quiet, Dirges, the Drowned, the Hollow mourners): their alpha comes through the
  // entity (air11 wraps Engine.render); the wash and ribbon its post hook painted are drawn here
  function spectral(e) {
    if (!GFX.seeThrough || typeof AIR11 === 'undefined' || !AIR11.ghost || !AIR11.ghost.kinds || (e.kind !== 'enemy' && e.kind !== 'npc')) return false;
    return !!AIR11.ghost.kinds[e.sprite];
  }
  function pushBillboard(en, x, y, z0, wW, wH, cx, skew, pull, f, hurt, alpha, flags, lr, lg, lb, glowFloor) {
    if ((nBB + 1) * BB_FLOATS > BB.length) growBB();
    const o = nBB * BB_FLOATS, flip = cx < 0;
    BB[o] = x; BB[o + 1] = y; BB[o + 2] = z0; BB[o + 3] = wW;
    BB[o + 4] = wH; BB[o + 5] = flip ? -cx : cx; BB[o + 6] = skew; BB[o + 7] = pull;
    BB[o + 8] = flip ? en.u1 : en.u0; BB[o + 9] = en.v0; BB[o + 10] = flip ? en.u0 : en.u1; BB[o + 11] = en.v1;
    BB[o + 12] = f; BB[o + 13] = hurt; BB[o + 14] = alpha; BB[o + 15] = flags;
    BB[o + 16] = lr; BB[o + 17] = lg; BB[o + 18] = lb; BB[o + 19] = glowFloor;
    bbPage[nBB] = en.pg; nBB++;
  }
  function pushParticle(add, x, y, z, pull, rx, ry, kind, seed, r, g, b, a, ex, upright) {
    if (add) { if ((nPTadd + 1) * PT_FLOATS > PTadd.length) growPT(true); }
    else if ((nPT + 1) * PT_FLOATS > PT.length) growPT(false);
    const A = add ? PTadd : PT, o = (add ? nPTadd : nPT) * PT_FLOATS;
    A[o] = x; A[o + 1] = y; A[o + 2] = z; A[o + 3] = pull;
    A[o + 4] = rx; A[o + 5] = ry; A[o + 6] = kind; A[o + 7] = seed;
    A[o + 8] = r; A[o + 9] = g; A[o + 10] = b; A[o + 11] = a;
    A[o + 12] = ex || 0; A[o + 13] = upright === 2 ? 2 : upright ? 1 : 0; A[o + 14] = 0; A[o + 15] = 0;
    if (add) nPTadd++; else { ptDist[nPT] = (x - V.eye[0]) * (x - V.eye[0]) + (y - V.eye[1]) * (y - V.eye[1]) + (z - V.eye[2]) * (z - V.eye[2]); nPT++; }
  }

  // ---------------------------------------------------------------- entities (the raycaster's sprite pass)
  function collectEntities(ents) {
    const eye = V.eye, ex = eye[0], ey = eye[1], aspectK = V.spriteAspect || 1;
    const lim2 = fogDist * fogDist * 1.3, lights = V.lights;
    const chooser = typeof animDirectionalSprite === 'function' ? animDirectionalSprite : null;
    const sprites = Engine.sprites;
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (!e) continue;
      e._screen = null;
      if (!e.sprite || e.hidden) continue;
      const dx = e.x - ex, dy = e.y - ey, d2 = dx * dx + dy * dy;
      if (d2 > lim2) { st.culled++; continue; }
      let r;
      // the game's own sprite chooser (directional views, flinch and flame frames are made there, on demand): the raycaster
      // calls it exactly once per drawn sprite too, so its cost is not this module's; it is timed apart
      const c0 = now();
      try { r = chooser ? chooser(e) : { sprite: (e.animSprite && sprites[e.animSprite]) || sprites[e.sprite], flip: !!e.animFlip }; } catch (err) { warnOnce('chooser', err); continue; } finally { chooseMs += now() - c0; }
      const sp = r && r.sprite; if (!sp) continue;
      const alpha = e.animAlpha == null ? 1 : e.animAlpha;
      if (alpha <= 0.02) continue;
      const scale = e.scale || 1, unit = Math.abs(scale);
      const hs = sp.hs || 1, wH = unit * hs * (e.animSY || 1);
      const wW = Math.max(0.01, unit * hs * sp.w / sp.h * (e.animSX || 1) * aspectK);
      // the raycaster lowers a sprite by (yOff - animLift) units and by dy of its own height (at the unsquashed size)
      const floor = groundAt(e.x, e.y);
      const z0 = floor - ((e.yOff || 0) - (e.animLift || 0)) - (sp.dy || 0) * unit * hs;
      if (offscreen(e.x, e.y, z0, z0 + wH, wW + Math.abs(e.animSkew || 0) * wH)) { st.culled++; continue; }
      const en = entryFor(sp); if (!en) continue;
      const d = Math.sqrt(d2);
      let f = lightF(d);
      if (e.glow) f = Math.max(f, e.glow);
      if (e.animGlow) f = Math.max(f, e.animGlow);
      if (SHARD[e.item] || e.glassLamp) f = Math.max(f, 0.9);
      f = Math.round(f * 255) / 255;
      // the raycaster skips the light sample for far sprites (two base fog lengths); so do we (it is a CPU cost)
      const far = V.farLod2 && d2 > V.farLod2;
      const L = lights && lights.length && !far ? lightAt(lights, e.x, e.y) : null;
      let lr = L ? L[0] : 0, lg = L ? L[1] : 0; const lb = L ? L[2] : 0;
      if (e.elite) { lr += 28; lg += 20; }
      const cx0 = sp.cx == null ? 0.5 : sp.cx, flip = !!r.flip;
      const anchor = flip ? -(1 - cx0) - 1e-6 : cx0;            // negative = flipped (u swapped), the anchor mirrored
      // a glowing thing (lamp, fire, glass, a singing companion) is marked so bloom can find it (aux material 8)
      const glowEnt = e.glow > 0.3 || e.animGlow > 0.3 || !!e.glassLamp || !!SHARD[e.item];
      let flags = (e.flash ? 1 : 0) | (glowEnt ? 8 : 0);
      if (spectral(e)) flags += 32 + (GFX.reduceMotion ? 64 : 0) + Math.min(0.999, (((animT * 0.32 + (e.x + e.y) * 0.37) % 1) + 1) % 1);
      const pull = Math.min(0.3, wW * 0.5);
      pushBillboard(en, e.x, e.y, z0, wW, wH, anchor, (e.animSkew || 0) * aspectK, pull, f, e.animHurt || 0, alpha >= 1 ? 1 : alpha, flags, lr / 255, lg / 255, lb / 255, Math.max(f, 0.95));
      // the screen rect every overlay reads (logical 320x150), as the raycaster left it
      const lat0 = -(flip ? 1 - cx0 : cx0) * wW, lat1 = lat0 + wW;
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, okc = 0;
      for (let k = 0; k < 4; k++) {
        const lat = (k & 1) ? lat1 : lat0, zz = (k & 2) ? z0 + wH : z0;
        if (project(e.x + rightX * lat, e.y + rightY * lat, zz) <= 0.02) continue;
        okc++; if (PJ[0] < x0) x0 = PJ[0]; if (PJ[0] > x1) x1 = PJ[0]; if (PJ[1] < y0) y0 = PJ[1]; if (PJ[1] > y1) y1 = PJ[1];
      }
      const zf = dx * fwdX + dy * fwdY;
      if (okc === 4 && zf > 0.08) e._screen = { x0, x1, y0, y1, dist: d, z: zf };
      st.sprites++;
    }
  }

  // ---------------------------------------------------------------- ghost replay (js/ghost18.js)
  function collectGhost() {
    if (typeof GHOST18 !== 'object' || !GHOST18 || !GHOST18.pb || typeof GHOST18.enabled !== 'function' || !GHOST18.enabled()) return;
    try {
      const pb = GHOST18.pb; if (!pb || !(pb.vis > 0) || !pb.g) return;
      const s = GHOST18.pbPose(pb); if (!mapNow || s.map !== mapNow.id) return;
      const dx = s.x - V.eye[0], dy = s.y - V.eye[1], d = Math.hypot(dx, dy);
      const al = GHOST18.ghostAlpha(d, fogDist, pb.vis); if (al < 0.02) return;
      const fm = GHOST18.frameFor(pb.g.look, s, V.dir); if (!fm || !fm.fr) return;
      const fr = fm.fr, en = entryFor(fr, true); if (!en) return;
      const wH = 1, wW = fr.w / fr.h * (V.spriteAspect || 1), z0 = groundAt(s.x, s.y);
      if (offscreen(s.x, s.y, z0, z0 + wH, wW)) return;
      // the ghost painter's colours are the figure's own: no fog, no light (ghost18 draws them straight)
      const inst = new Float32Array(BB_FLOATS), flip = !!fm.mirror;
      inst.set([s.x, s.y, z0, wW, wH, 0.5, 0, Math.min(0.3, wW * 0.5), flip ? en.u1 : en.u0, en.v0, flip ? en.u0 : en.u1, en.v1, 1, 0, al, 22, 0, 0, 0, 1]);
      figures.push({ en, inst, d2: d * d, raw: true });
      st.figures++;
    } catch (e) { warnOnce('ghost', e); }
  }

  // ---------------------------------------------------------------- contact shadows and fight marks (js/look10.js)
  function pushDecalVert(x, y, z, u, v, kind, mi, a, fall, mr, mg, mb) {
    if ((nDC + 1) * DC_FLOATS > DC.length) growDC();
    const o = nDC * DC_FLOATS;
    DC[o] = x; DC[o + 1] = y; DC[o + 2] = z; DC[o + 3] = u; DC[o + 4] = v;
    DC[o + 5] = kind; DC[o + 6] = mi; DC[o + 7] = a; DC[o + 8] = fall; DC[o + 9] = mr; DC[o + 10] = mg; DC[o + 11] = mb;
    nDC++;
  }
  const GN = 5;                                  // grid cells per side of a decal mesh
  const gz = new Float32Array((GN + 1) * (GN + 1)), gx = new Float32Array((GN + 1) * (GN + 1)), gy = new Float32Array((GN + 1) * (GN + 1)), ga = new Float32Array((GN + 1) * (GN + 1));
  // a square of side 2r centred on (cx, cy), turned by (c, s), lying on the ground; vertices whose ground is more than
  // tol away from ez (a step, a riser) carry no strength, so the mark does not climb walls (look10's groundOk)
  function decal(cx, cy, ez, r, c, s, tol, kind, mi, a, fall, mul) {
    const flat = !(mapNow && (mapNow.lvls || mapNow.smooth || mapNow.verts));
    const lift = 0.006 + 0.0015 * Math.sqrt((cx - V.eye[0]) * (cx - V.eye[0]) + (cy - V.eye[1]) * (cy - V.eye[1]));
    let any = false;
    for (let j = 0; j <= GN; j++) for (let i = 0; i <= GN; i++) {
      const k = j * (GN + 1) + i, u = -1 + 2 * i / GN, v = -1 + 2 * j / GN;
      const wx = cx + (u * c - v * s) * r, wy = cy + (u * s + v * c) * r;
      const z = flat ? 0 : groundAt(wx, wy);
      gx[k] = wx; gy[k] = wy; gz[k] = z + lift; ga[k] = Math.abs(z - ez) <= tol ? a : 0;
      if (ga[k] > 0) any = true;
    }
    if (!any) return;
    const mr = mul ? mul[0] : 1, mg = mul ? mul[1] : 1, mb = mul ? mul[2] : 1;
    for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) {
      const k0 = j * (GN + 1) + i, k1 = k0 + 1, k2 = k0 + GN + 1, k3 = k2 + 1;
      if (!(ga[k0] || ga[k1] || ga[k2] || ga[k3])) continue;
      // a cell that straddles a step is dropped whole rather than stretched up the riser
      const zmin = Math.min(gz[k0], gz[k1], gz[k2], gz[k3]), zmax = Math.max(gz[k0], gz[k1], gz[k2], gz[k3]);
      if (zmax - zmin > 0.12 + r * 0.5) continue;
      const tri = [k0, k1, k2, k2, k1, k3];
      for (const k of tri) {
        const u = -1 + 2 * (k % (GN + 1)) / GN, v = -1 + 2 * Math.floor(k / (GN + 1)) / GN;
        pushDecalVert(gx[k], gy[k], gz[k], u, v, kind, mi, ga[k] || 0, fall, mr, mg, mb);
      }
    }
    st.decals++;
  }
  function onWater(x, y) {
    const m = mapNow; if (!m) return false;
    const cx = x | 0, cy = y | 0; if (cx < 0 || cy < 0 || cx >= m.w || cy >= m.h) return false;
    let t = m.floor;
    if (m.floorCells && m.floorTextures) { const i = m.floorCells[cy * m.w + cx]; if (i) t = m.floorTextures[i]; }
    return t === 't_water' || t === 't_shallows';
  }
  const NULLF = { fb: new Uint32Array(0), dbuf: new Float32Array(0), mbuf: new Uint8Array(0), w: 0, h: 0, S: 1, horizon: 0, dirX: 1, dirY: 0, planeX: 0, planeY: 0.66, cam: null, map: null, outdoor: false, light: 1, ambient: 0, fogR: 0, fogG: 0, fogB: 0, fogDist: 12, animT: 0, ptLights: [], relief: false, far: false, sprList: [], gAt: () => 0, surfBias: 0.45, wx: { haze: 0, dark: 0, cloud: 0, flash: 0 } };
  // a frame of nothing: lets a module's post hook do its per-frame bookkeeping (it draws nothing into a 0x0 frame)
  function nullFrame() {
    const F = NULLF; F.cam = Engine.cam; F.map = mapNow; F.outdoor = !!V.outdoor; F.light = V.light == null ? 1 : V.light; F.fogDist = fogDist;
    F.animT = animT; F.dirX = Math.cos(V.dir); F.dirY = Math.sin(V.dir); F.planeX = -F.dirY * 0.66; F.planeY = F.dirX * 0.66;
    F.gAt = (x, y) => groundAt(x, y); F.relief = !!(mapNow && (mapNow.lvls || mapNow.verts || mapNow.relief));
    if (wxNow) F.wx = wxNow;
    return F;
  }
  function collectGround(ents) {
    if (typeof LOOK10 === 'undefined' || !mapNow) return;
    // the marks' scan, aging and map bookkeeping live in look10's post hook: run it on a frame of nothing
    if (!V.cpuHooks) { try { if (GFX.fightMarks || GFX.groundShadows) LOOK10.pass(nullFrame()); } catch (e) { warnOnce('look10', e); } }
    const relief = !!(mapNow.lvls || mapNow.smooth || mapNow.verts);
    if (GFX.fightMarks && maskIndex) {
      const clockT = LOOK10.marks.now, slots = LOOK10.marks.slots, fade = LOOK10.marks.fade || (LOOK10.config && LOOK10.config.marks.fade) || 2.5;
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i]; if (!s.on || s.wall >= 0) continue;
        const K = LOOK10.KINDS[s.kind]; if (!K || maskIndex[s.kind] == null) continue;
        let alpha = 1; if (s.dying >= 0) alpha = 1 - (clockT - s.dying) / fade;
        if (alpha <= 0.01) continue;
        let strength = K.a * alpha;
        if (s.kind === 'blood' || s.kind === 'pool') strength *= 1 - 0.28 * clamp((clockT - s.born) / 420, 0, 1);
        const dx = s.x - V.eye[0], dy = s.y - V.eye[1]; if (dx * dx + dy * dy > fogDist * fogDist * 2) continue;
        if (offscreen(s.x, s.y, s.z - 0.1, s.z + 0.1, s.r * 1.5)) continue;
        // look10 samples mask[v][u] with u along (c, s): the same turn here
        decal(s.x, s.y, s.z, s.r, s.c, s.s, relief ? 0.62 : 9, 1, maskIndex[s.kind] + s.v, strength, 1, K.mul);
      }
    }
    if (GFX.groundShadows && ents) {
      const c = LOOK10.config.shadow, wx = wxNow || { haze: 0, cloud: 0 };
      const sunK = V.outdoor ? c.base + c.sun * Math.min(1, clamp(V.light == null ? 1 : V.light, 0.2, 1.2)) : c.indoor;
      const wxK = (1 - 0.55 * clamp((wx.haze || 0) / 0.6, 0, 1)) * (1 - 0.3 * (wx.cloud || 0));
      const fogD = Math.max(4, fogDist);
      const sunShadows = !!(V.outdoor && typeof LIGHT21 !== 'undefined' && LIGHT21 && LIGHT21.P && LIGHT21.P.shadowOn);
      for (let i = 0; i < ents.length; i++) {
        const e = ents[i]; if (!e || !e.sprite || e.hidden) continue;
        const sk = LOOK10.shadowOf(e); if (!sk) continue;
        const alpha = e.animAlpha == null ? 1 : e.animAlpha; if (alpha <= 0.02) continue;
        const sp = Engine.sprites[e.animSprite || e.sprite]; if (!sp) continue;
        const dx = e.x - V.eye[0], dy = e.y - V.eye[1], d = Math.sqrt(dx * dx + dy * dy);
        const fade = clamp(c.fadeFar - d / fogD, 0, 1); if (fade <= 0.02) continue;
        if (onWater(e.x, e.y)) continue;
        const scale = e.scale || 1, hw = scale * (sp.hs || 1);
        const r = clamp(0.5 * hw * sp.w / sp.h * 1.2 + 0.1 * hw, c.minR, c.maxR);
        const ez = relief ? groundAt(e.x, e.y) : 0;
        if (offscreen(e.x, e.y, ez - 0.1, ez + 0.1, r * 1.4)) continue;
        // in the dark a shadow is softer, wider and weaker (look10 reads the lit floor; here the light that reaches it)
        let lum = lightF(d) * (V.outdoor ? (V.light == null ? 1 : V.light) : 1) * 255;
        if (V.lights && V.lights.length) { const L = lightAt(V.lights, e.x, e.y); lum += (L[0] + L[1] + L[2]) * 0.6; }
        const soft = 1 - clamp(lum / 120, 0, 1);
        const rr = r * (1 + 0.3 * soft);
        // where LIGHT casts real sun/moon shadows from these figures, the disc is only the soft contact under the feet
        const k = sunK * wxK * fade * sk * alpha * (0.4 + 0.6 * (1 - soft * 0.75)) * 0.9 * (sunShadows ? 0.6 : 1);
        decal(e.x, e.y, ez, rr, 1, 0, relief ? 0.3 : 9, 0, 0, k, soft > 0.5 ? 2.3 : 1.25, null);
      }
    }
  }

  // ---------------------------------------------------------------- smoke, steam, droplets (js/firesmoke.js)
  // firesmoke's own post hook (spawn, wind, simulate) does not run under R3D: the same steps through its API.
  const fs = { lastT: null, map: null };
  function stepSmoke() {
    if (typeof FIRESMOKE === 'undefined' || typeof GFX === 'undefined') return;
    const on = !!(GFX.smoke || GFX.splashes);
    if (!on) { if (FIRESMOKE.count) FIRESMOKE.reset(); fs.lastT = null; return; }
    if (typeof G === 'undefined' || !G || G.state === 'title' || !mapNow) return;
    if (fs.map !== mapNow) { fs.map = mapNow; FIRESMOKE.reset(); fs.lastT = null; }
    const T = animT;
    let dt = fs.lastT == null ? 0 : T - fs.lastT;
    if (!(dt >= 0) || dt > 0.5) { if (dt > 0.5 || dt < -0.01) FIRESMOKE.reset(); dt = 0; }
    fs.lastT = T;
    if (dt > 0.1) dt = 0.1;
    if (dt > 0) { try { FIRESMOKE.tick(dt, T); } catch (e) { warnOnce('smoke', e); } }
  }
  // firesmoke's puffs, drawn with its own formula (colour by light and fog, warmth, the fade in and out)
  function collectSmoke() {
    if (typeof FIRESMOKE === 'undefined' || !FIRESMOKE.count) return;
    const outdoor = !!V.outdoor, light = V.light == null ? 1 : V.light, amb = V.ambient || 0, fg0 = V.fog || [0, 0, 0], fog = [fg0[0] * 255, fg0[1] * 255, fg0[2] * 255];
    const fogD = Math.max(4, fogDist), noFlash = !!GFX.noFlash, eye = V.eye;
    let seed = 0;
    FIRESMOKE.each((p) => {
      seed++;
      const dx = p.x - eye[0], dy = p.y - eye[1], d = Math.sqrt(dx * dx + dy * dy);
      if (d > fogD * 1.1) return;
      const t = p.age / Math.max(0.01, p.life);
      if (p.kind === 2) {
        const f = outdoor ? Math.max(0.25, 1 - d / fogD) * light : Math.max(0.3, amb + (1 - amb) * (1 - d / fogD));
        const a = 0.85 * (1 - t * 0.5);
        const r = (noFlash ? 130 : 200) * f / 255, g = (noFlash ? 160 : 228) * f / 255, b = (noFlash ? 180 : 245) * f / 255;
        pushParticle(false, p.x, p.y, p.z, 0.02, 0.016, 0.022, 1, seed, Math.min(1, r), Math.min(1, g), Math.min(1, b), a, 0, false);
        return;
      }
      // each puff's own radius, strength and warmth (FIRESMOKE.each exposes them); an older firesmoke without them falls back
      // to its emitters' table values, told apart by lifetime (chimney 4.6-6.6 s, fire 2.4-3.4 s, small flame 1.7-2.4 s)
      let r0, r1, a0, warm;
      if (p.r1 != null) { r0 = p.r0; r1 = p.r1; a0 = p.a; warm = p.warm || 0; }
      else if (p.kind === 1) { r0 = 0.05; r1 = 0.24; a0 = 0.55; warm = 0; }
      else if (p.life >= 4.2) { r0 = 0.1; r1 = 0.67; a0 = 0.62; warm = 0; }
      else if (p.life >= 2.4) { r0 = 0.05; r1 = 0.31; a0 = 0.41; warm = 1; }
      else { r0 = 0.04; r1 = 0.125; a0 = 0.5; warm = 1; }
      const rw = r0 + (r1 - r0) * Math.sqrt(t);
      const fadeIn = Math.min(1, t / 0.12), A = a0 * fadeIn * (1 - t);
      if (A < 0.012) return;
      const br = p.kind === 1 ? 232 : 168, bg = p.kind === 1 ? 236 : 164, bb = p.kind === 1 ? 240 : 168;
      const f = Math.max(0, 1 - d / fogD);
      let cr, cg, cb;
      if (outdoor) { cr = (br * f + fog[0] * (1 - f)) * light; cg = (bg * f + fog[1] * (1 - f)) * light; cb = (bb * f + fog[2] * (1 - f)) * light; }
      else { const v = amb + (1 - amb) * f * 0.7; cr = br * v; cg = bg * v; cb = bb * v; }
      const wm = warm * (1 - t) * (1 - t); if (wm > 0.01) { cr += 120 * wm; cg += 58 * wm; cb += 12 * wm; }
      pushParticle(false, p.x, p.y, p.z, 0, rw, rw, 0, p.seed != null ? p.seed : (seed * 7) % 61, Math.min(1, cr / 255), Math.min(1, cg / 255), Math.min(1, cb / 255), A, 0, false);
    });
  }

  // ---------------------------------------------------------------- telegraphs (js/telegraphs.js) and glimmer
  function collectTelegraphs(ents) {
    if (typeof TELEGRAPHS === 'undefined' || typeof GFX === 'undefined' || GFX.telegraphs === false || !ents) return;
    const CFG = TELEGRAPHS.CFG || { lead: 0.6, markT: 0.6, riseT: 0.9 }, len = typeof TELEGRAPHS.entranceLen === 'function' ? TELEGRAPHS.entranceLen() : CFG.markT + CFG.riseT;
    const reduce = !!(GFX.reduceMotion || GFX.reducedMotion);
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i]; if (!e || e.hidden) continue;
      if (e._cast) {
        const cs = TELEGRAPHS.CASTERS && TELEGRAPHS.CASTERS[e.type]; if (!cs) continue;
        const k = Math.min(1, e._cast.t / CFG.lead), amp = 0.55 * k * k + 0.1 * k;
        const sp = Engine.sprites[e.sprite]; const hs = sp ? (sp.hs || 1) : 1, sc = e.scale || 1;
        const wH = sc * hs, wW = sp ? wH * sp.w / sp.h * (V.spriteAspect || 1) : 0.6, z = groundAt(e.x, e.y) + wH * 0.5;
        pushParticle(true, e.x, e.y, z, 0.1, wW * 0.8 + 0.06, wH * 0.62 + 0.06, 3, 0, cs.col[0] / 255 * amp, cs.col[1] / 255 * amp, cs.col[2] / 255 * amp, 1, 0, true);
      } else if (e._tg && !e.dead) {
        const g = e._tg, k = Math.min(1, g.t / len), z = groundAt(e.x, e.y) + 0.01;
        if (g.style === 'ground') {
          const r = 0.12 + 0.34 * k, a = 0.8 * (1 - k * 0.8) * 0.65;
          pushParticle(false, e.x, e.y, z, 0, r, r, 2, 0, 150 / 255, 126 / 255, 96 / 255, a, 0.38 * (1 - 0.5 * k), 2);
        } else if (g.style === 'ceiling') {
          const top = mapNow && mapNow.ceilZ ? mapNow.ceilZ : (mapNow && mapNow.ceil ? 1 : 2);
          const lo = g.t < CFG.markT ? groundAt(e.x, e.y) + 0.95 * (1 - (g.t / CFG.markT) * 0.35) : groundAt(e.x, e.y) + (e.scale || 1);
          const sway = reduce ? 0 : Math.sin(g.t * 5) * 0.01;
          pushParticle(false, e.x + sway, e.y, (top + lo) / 2, 0, 0.008, Math.max(0.01, (top - lo) / 2), 1, 0, 205 / 255, 200 / 255, 220 / 255, 0.6, 0, true);
          if (g.t < CFG.markT) pushParticle(false, e.x + sway, e.y, lo, 0, 0.02, 0.02, 1, 0, 225 / 255, 220 / 255, 235 / 255, 0.9, 0, false);
        } else {
          const fade = g.t < CFG.markT ? Math.min(1, g.t / (CFG.markT * 0.5)) : Math.max(0, 1 - (g.t - CFG.markT) / CFG.riseT);
          pushParticle(false, e.x, e.y, z + 0.18, 0.05, 0.55, 0.3, 0, 13, 196 / 255, 196 / 255, 214 / 255, 0.7 * fade, 0, true);
        }
      }
    }
  }
  function collectGlimmer(ents) {
    if (typeof GFX === 'undefined' || !ents || !GFX.shardGlint) return;
    const T = animT;
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i]; if (!e || e.item !== 'shard' || e.hidden || e.dead || !e._screen) continue;
      const z = groundAt(e.x, e.y) + 0.12, pulse = 0.5 + 0.5 * Math.sin(T * 2.2 + e.x * 1.7 + e.y);
      pushParticle(true, e.x, e.y, z, 0.12, 0.22, 0.16, 3, 0, 0.10 * pulse, 0.32 * pulse, 0.28 * pulse, 1, 0, true);
    }
  }

  // ---------------------------------------------------------------- footprints (js/air11.js)
  function collectPrints() {
    if (typeof AIR11 === 'undefined' || !GFX.footprints || !maskIndex || maskIndex._prints == null || !mapNow) return [];
    // air11's step scan and clock live in its post hook: run it on a frame of nothing
    if (!V.cpuHooks) { try { AIR11.drawPrints(nullFrame()); } catch (e) { warnOnce('prints', e); } }
    const list = AIR11.prints.list, life = (AIR11.config && AIR11.config.footprints.life) || 60, T = AIR11.prints.now, water = [];
    const relief = !!(mapNow.lvls || mapNow.smooth || mapNow.verts);
    for (let i = 0; i < list.length; i++) {
      const p = list[i]; if (!p.on) continue;
      const age = T - p.born; if (age >= life || age < -1) continue;
      const k = Math.pow(1 - clamp(age, 0, life) / life, 1.15); if (k < 0.02) continue;
      const dx = p.x - V.eye[0], dy = p.y - V.eye[1]; if (dx * dx + dy * dy > Math.pow(Math.min(14, fogDist * 1.1), 2)) continue;
      const ez = relief ? groundAt(p.x, p.y) : 0;
      if (offscreen(p.x, p.y, ez - 0.1, ez + 0.1, p.r * 1.5)) continue;
      if (p.kind === 2) { water.push(p, k, ez); continue; }
      // a dark damp press in the mud (air11 also lightens a lip around it; a multiply cannot, so the press alone)
      decal(p.x, p.y, ez, p.r, -p.s, p.c, relief ? 0.5 : 9, 1, maskIndex._prints + p.paw * 2, 0.5 * k, 1, MUD);
    }
    return water;
  }
  const MUD = [0.0, 0.06, 0.18], SHINE = [0.24, 0.27, 0.30];
  function collectWaterPrints(water) {
    for (let i = 0; i < water.length; i += 3) { const p = water[i]; decal(p.x, p.y, water[i + 2], p.r, -p.s, p.c, 9, 2, maskIndex._prints + 1 + p.paw * 2, 0.62 * water[i + 1], 1, SHINE); }
  }

  // ---------------------------------------------------------------- cold breath (js/air11.js)
  // copied from js/air11.js (not exported there): LOW_HEAD (mouth height on low-headed beasts), PUFF 1.15 s (a puff's life),
  // the breathing periods 1.5 / 3.3 s; its per-entity phase is a private WeakMap, so a position hash stands in
  const LOW_HEAD = { hound: 0.46, cat: 0.5, weaverling: 0.3 };
  function collectBreath(ents) {
    if (typeof AIR11 === 'undefined' || !GFX.coldBreath || !AIR11.breath || !mapNow) return;
    const cold = AIR11.breath.coldness(mapNow, typeof G !== 'undefined' ? G.tod : 0.5); if (cold <= 0.05) return;
    const T = animT, still = !!GFX.reduceMotion, range = (AIR11.config && AIR11.config.breath.range) || 7.5, maxN = (AIR11.config && AIR11.config.breath.maxBreathers) || 5;
    const cand = [];
    for (let i = 0; i < ents.length; i++) { const e = ents[i]; if (!e || !e._screen || !AIR11.breath.breathes(e)) continue; const d = e._screen.dist; if (d > range || d < 0.6) continue; if ((e.animAlpha == null ? 1 : e.animAlpha) < 0.5) continue; cand.push(e); }
    cand.sort((a, b) => a._screen.dist - b._screen.dist);
    for (let n = 0; n < cand.length && n < maxN; n++) {
      const e = cand[n], d = e._screen.dist;
      const period = (e.kind === 'enemy' && e.state && e.state !== 'idle' && e.state !== 'passive') ? 1.5 : 3.3;
      const seed = ((e.x * 12.9898 + e.y * 78.233) % 3.7 + 3.7) % 3.7;
      const life = ((((T + seed) / period) % 1 + 1) % 1) * period; if (life > 1.15) continue;
      const sp = Engine.sprites[e.animSprite || e.sprite], scale = e.scale || 1, hs = sp ? (sp.hs || 1) : 1, head = LOW_HEAD[e.sprite] || LOW_HEAD[e.type] || 0.86;
      const heading = isNum(e.facing) ? e.facing : (isNum(e.dir) ? e.dir : 0), fx = Math.cos(heading), fy = Math.sin(heading);
      for (let k = 0; k < 2; k++) {
        const tau = life / 1.15 - k * 0.2; if (tau <= 0) continue;
        const fwd = 0.12 * scale + 0.25 * tau * (still ? 0 : 1);
        const pz = groundAt(e.x, e.y) + head * scale * hs + 0.13 * tau * (still ? 0 : 1) + (e.yOff || 0);
        const r = (0.04 + 0.085 * tau) * 1.15;
        const a = (k ? 0.7 : 1) * 0.5 * cold * (1 - tau) * (1 - tau) * Math.min(1, tau * 7 + 0.3) * clamp(1 - d / (range + 1), 0.25, 1);
        if (a > 0.01) pushParticle(false, e.x + fx * fwd, e.y + fy * fwd, pz, 0.12, r, r, 3, 0, 226 / 255, 234 / 255, 246 / 255, a, 0, false);
      }
    }
  }

  // ---------------------------------------------------------------- guard lanterns and parry sparks (js/motion10.js)
  let lanternSp = null;
  function lanternSprite() {
    if (lanternSp) return lanternSp;
    // procedural stand-in: motion10's cage lantern as 7x10 pixel art (cap, iron frame, warm glass; the glass is emissive)
    const w = 7, h = 10, data = new Uint32Array(w * h), emit = new Uint8Array(w * h);
    const px = (r, g, b) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (y === 0) { if (x >= 2 && x <= 4) data[i] = px(40, 30, 20); continue; }
      if (y === 1 || y === h - 1 || x === 0 || x === w - 1) { data[i] = px(52, 38, 22); continue; }
      const core = 1 - Math.abs(x - 3) / 3 * 0.5 - (y / h) * 0.25;
      data[i] = px(Math.min(255, 140 + 115 * core) | 0, Math.min(255, 90 + 115 * core) | 0, Math.min(255, 40 + 60 * core) | 0); emit[i] = 1;
    }
    lanternSp = { w, h, data, emit, hs: 1, cx: 0.5, dy: 0 };
    return lanternSp;
  }
  function collectLanterns() {
    if (typeof MOTION10 === 'undefined' || !MOTION10.lanterns || !MOTION10.on || !MOTION10.on.lanterns()) return;
    const LAN = MOTION10.lanterns.state; if (!LAN || !(LAN.lit.length || LAN.drops.length)) return;
    const en = entryFor(lanternSprite()); if (!en) return;
    const one = (lx, ly, ztop, scale, s, hand) => {
      s = clamp(s, 0, 1.3);
      const wH = 0.12 * scale, wW = 0.085 * scale, z0 = ztop - wH;
      pushBillboard(en, lx, ly, z0, wW, wH, 0.5, 0, 0.4, Math.min(1, lightF(Math.hypot(lx - V.eye[0], ly - V.eye[1])) + 0.2), 0, 1, 0, 0, 0, 0, Math.min(1, 0.55 + 0.45 * s));
      const hr = 0.13 * scale * (0.7 + 0.3 * s);
      pushParticle(true, lx, ly, z0 + wH * 0.5, 0.42, hr, hr, 3, 0, 120 / 255 * 0.32 * s * 3.5, 70 / 255 * 0.32 * s * 3.5, 18 / 255 * 0.32 * s * 3.5, 1, 0, false);
      if (hand) { const hz = hand[2]; pushParticle(false, (hand[0] + lx) / 2, (hand[1] + ly) / 2, (hz + ztop) / 2, 0.4, 0.006 * scale, Math.max(0.01, (hz - ztop) / 2), 1, 0, 40 / 255, 30 / 255, 22 / 255, 0.9, 0, true); }
    };
    for (let i = 0; i < LAN.lit.length; i++) {
      const c = LAN.lit[i], h = c.hand; if (!h || c.g == null) continue;
      const e = c.e, scale = e.scale || 1, sp = Engine.sprites[e.sprite], hs = (sp && sp.hs) || 1;
      if ((h.hx - V.eye[0]) * (h.hx - V.eye[0]) + (h.hy - V.eye[1]) * (h.hy - V.eye[1]) > 225) continue;
      const hz = groundAt(h.hx, h.hy) + 0.4 * scale * hs, lz = groundAt(h.lx, h.ly) + 0.4 * scale * hs - 0.11 * scale;
      one(h.lx, h.ly, lz, scale, c.g, [h.hx, h.hy, hz]);
    }
    for (let i = 0; i < LAN.drops.length; i++) {
      // copied from js/motion10.js (not exported there): DROP_LIFE 45 s, GUTTER 1.8 s and gutterK()'s ember tail
      const dr = LAN.drops[i]; if (dr.age > 45) continue;
      if ((dr.x - V.eye[0]) * (dr.x - V.eye[0]) + (dr.y - V.eye[1]) * (dr.y - V.eye[1]) > 225) continue;
      const GUT = 1.8, f = clamp(1 - dr.age / GUT, 0, 1), g = dr.age < GUT ? f * f * 0.8 : dr.age < GUT + 2.5 ? 0.12 * (1 - (dr.age - GUT) / 2.5) : 0;
      one(dr.x, dr.y, groundAt(dr.x, dr.y) + 0.04 + 0.1, 0.8, g, null);
    }
  }
  function collectSparks() {
    if (typeof MOTION10 === 'undefined' || !MOTION10.parry) return;
    const SPK = MOTION10.parry.state, MATS = MOTION10.parry.MATS; if (!SPK || !SPK.list.length) return;
    const dt = V.cpuHooks ? 0 : (SPK.dt || 0.016), ax = camAxes(V);
    for (let bi = SPK.list.length - 1; bi >= 0; bi--) {
      const b = SPK.list[bi];
      // motion10's post hook ages and retires the bursts; under R3D it does not run, so it is done here
      if (dt) b.age += dt;
      const M = MATS[b.mat]; if (!M) continue;
      const z = groundAt(b.x, b.y) + b.z, dx = b.x - V.eye[0], dy = b.y - V.eye[1], d = Math.max(0.2, (dx * fwdX + dy * fwdY) * 0.9);
      const k = d / VHL;                                 // world units per logical pixel at the burst
      let alive = 0;
      if (b.star && b.age < 0.09 && !GFX.noFlash) { const L = (6 + 7 * (1 - b.age / 0.09)) * k; pushParticle(true, b.x, b.y, z, 0.05, L, L * 0.7, 3, 0, 1, 0.98, 0.92, 0.9, 0, false); }
      for (const p of b.parts) {
        const t = b.age; if (t >= p.life) continue; alive++;
        const f = t / p.life, col = f < 0.35 ? M.col[0] : f < 0.7 ? M.col[1] : M.col[2], a = (1 - f * f) * b.dim * (M.dull ? 0.8 : 1);
        for (let q = 0; q < 3; q++) {
          const tt = Math.max(0, t - 0.025 * q), sx = p.vx * tt, sy = p.vy * tt + 75 * tt * tt;
          const wx = b.x + ax.r[0] * sx * k - ax.u[0] * sy * k, wy = b.y + ax.r[1] * sx * k - ax.u[1] * sy * k, wz = z - ax.u[2] * sy * k;
          pushParticle(q === 0 && !M.dull && !GFX.noFlash, wx, wy, wz, 0.05, 0.5 * k, 0.5 * k, 1, 0, col[0] / 255, col[1] / 255, col[2] / 255, a * (1 - q * 0.3), 0, false);
        }
      }
      if (!V.cpuHooks && !alive && b.age > 0.1) SPK.list.splice(bi, 1);
    }
  }

  // ---------------------------------------------------------------- Lyra's song rings (js/companions.js)
  function collectRings(ents) {
    if (typeof GFX === 'undefined' || !GFX.companionLife || !ents || (GFX.particles != null && GFX.particles <= 0)) return;
    const calmed = !!GFX.reduceMotion, noF = !!GFX.noFlash;
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (!e || e.hidden || e.dead || !e.companion || e.sprite !== 'lyra' || !e._cRings || !e._cRings.length) continue;
      const dx = e.x - V.eye[0], dy = e.y - V.eye[1]; if (dx * dx + dy * dy > 144) continue;
      const z = groundAt(e.x, e.y) + 0.55 * (e.scale || 1) + (e.yOff || 0) - (e.animLift || 0);
      const ring = (age, strength) => {
        const k = age / 1.9, r = 0.28 + 0.8 * (1 - (1 - k) * (1 - k)), fade = (1 - k) * (1 - k) * strength; if (fade < 0.02) return;
        // a thin ring around her chest, facing the viewer, at her own depth
        pushParticle(false, e.x, e.y, z, 0.1, r, r * 0.82, 2, 0, noF ? 0.55 : 205 / 255, noF ? 0.62 : 238 / 255, noF ? 0.6 : 232 / 255, 0.5 * Math.min(1, fade + 0.2), 0.06, false);
      };
      if (calmed) ring(0.55, 0.45); else for (let j = 0; j < e._cRings.length; j++) ring(e._cRings[j], noF ? 0.8 : 1);
    }
  }

  // ---------------------------------------------------------------- the Kestrel's mooring rope (js/smalllife.js)
  // smalllife's mast and hull numbers (MAST, SHIP there): the rope runs from the mast top to the bow cone
  // fallbacks copied from js/smalllife.js (MAST, SHIP), used only if SMALLLIFE does not export them
  const KMAST = { x: 37, y: 20, top: 2.8 }, KSHIP = { scale: 1.7, half: 1.85 };
  function collectRope() {
    if (typeof SMALLLIFE === 'undefined' || !SMALLLIFE.ship || !SMALLLIFE.ship.e || !V.outdoor || typeof SMALLLIFE.isMoored !== 'function' || !SMALLLIFE.isMoored()) return;
    const p = SMALLLIFE.shipPose(animT); if (!p) return;
    const M = SMALLLIFE.MAST || KMAST, SH = SMALLLIFE.SHIP || KSHIP;
    const ax = M.x, ay = M.y, az = groundAt(ax, ay) + M.top - 0.05;
    const bx = p.x + Math.cos(p.h) * SH.half * 0.97, by = p.y + Math.sin(p.h) * SH.half * 0.97, bz = groundAt(bx, by) + p.lift + SH.scale * 0.43;
    const len = Math.hypot(bx - ax, by - ay, bz - az); if (!(len > 0.1)) return;
    if ((ax - V.eye[0]) * (ax - V.eye[0]) + (ay - V.eye[1]) * (ay - V.eye[1]) > fogDist * fogDist * 1.5) return;
    const n = Math.max(4, Math.min(60, Math.round(len * 14)));
    for (let i = 0; i <= n; i++) {
      const u = i / n, sag = Math.sin(u * Math.PI) * 0.06 * len / 4;
      pushParticle(false, ax + (bx - ax) * u, ay + (by - ay) * u, az + (bz - az) * u - sag, 0, 0.012, 0.012, 1, 0, 150 / 255, 138 / 255, 108 / 255, 0.75, 0, false);
    }
  }

  // ---------------------------------------------------------------- the quarry cave-in (js/gates.js): dust and stones
  function collectCave() {
    if (typeof GATES === 'undefined' || !GATES.cave || !mapNow) return;
    const cave = GATES.cave, puffs = typeof GATES.puffs === 'function' ? GATES.puffs() : [];
    if (cave.phase === 'idle' && !puffs.length) return;
    const sc = Math.max(0, GFX.particles === undefined ? 1 : GFX.particles); if (sc <= 0) return;
    const calm = !!GFX.reduceMotion, hash = GATES.hash, light = V.outdoor ? (V.light == null ? 1 : V.light) : 1;
    const tone = (x, y, base) => { const f = Math.max(0.35, lightF(Math.hypot(x - V.eye[0], y - V.eye[1]))) * light; return [base[0] * f / 255, base[1] * f / 255, base[2] * f / 255]; };
    // copied from js/gates.js (not exported there): DUST, ROCK colours and G_ACC; WARN, SETTLE, RUBBLE_H come from GATES
    const DUST = [172, 162, 146], ROCK = [96, 90, 84], G_ACC = 10.2, WARN = GATES.WARN || 2.4, SETTLE = GATES.SETTLE || 1.8, RUBBLE_H = GATES.RUBBLE_H || 0.45;
    const dust = (x, y, z, rad, a) => { if (a <= 0.01) return; const c = tone(x, y, DUST); pushParticle(false, x, y, z, 0, rad, rad, 0, (x * 7 + y * 13) % 61, c[0], c[1], c[2], Math.min(1, a * 0.6), 0, false); };
    const speck = (x, y, z, size) => { const c = tone(x, y, ROCK); pushParticle(false, x, y, z, 0, size, size, 1, 0, c[0], c[1], c[2], 1, 0, false); };
    if (cave.phase !== 'idle' && cave.map === mapNow && cave.pl) {
      const cells = cave.pl.cells, ceil = cave.pl.ceil, t = cave.t;
      if (cave.phase === 'warn') {
        const ramp = Math.min(1, t / 0.8);
        for (let k = 0; k < cells.length; k++) {
          const cx = cells[k][0], cy = cells[k][1], gr = cells[k][2];
          if (calm) { dust(cx + 0.5, cy + 0.5, gr + 0.6, 0.9, 0.5 * ramp); continue; }
          const N = Math.round(6 * sc * ramp);
          for (let j = 0; j < N; j++) { const id = k * 64 + j, per = 0.8 + hash(id * 3 + 1) * 0.8, u = ((t / per) + hash(id * 3 + 2)) % 1; speck(cx + hash(id * 3 + 3), cy + hash(id * 3 + 4), ceil - u * (ceil - gr), 0.006); }
          const M = Math.round(2 * sc);
          for (let j = 0; j < M; j++) {
            const id = k * 64 + 40 + j, t0 = 0.25 + hash(id * 5 + 1) * (WARN - 1.0), tau = t - t0; if (tau < 0) continue;
            const px = cx + 0.15 + hash(id * 5 + 2) * 0.7, py = cy + 0.15 + hash(id * 5 + 3) * 0.7, top = gr + RUBBLE_H * 0.4, z = ceil - 0.5 * G_ACC * tau * tau, land = Math.sqrt(2 * (ceil - top) / G_ACC);
            if (z > top) speck(px, py, z, 0.014);
            else dust(px, py, top + 0.1, 0.12 + Math.min(0.4, (tau - land) * 0.6), Math.max(0, 0.7 - (tau - land) * 0.9));
          }
        }
      } else {
        const p = Math.min(1, t / SETTLE);
        for (let k = 0; k < cells.length; k++) dust(cells[k][0] + 0.5, cells[k][1] + 0.5, cells[k][2] + 0.5 + p * 0.4, 0.55 + p * 0.55, (1 - p) * (calm ? 0.55 : 0.85));
      }
    }
    for (let i = 0; i < puffs.length; i++) { const p = puffs[i]; if (p.map !== mapNow) continue; const u = p.t / p.life; dust(p.x, p.y, p.z + u * 0.3, p.r * (0.5 + u * 0.8), (1 - u) * (calm ? 0.5 : 0.8)); }
  }

  // ---------------------------------------------------------------- Kaelen's blade on the whetstone (js/companions.js)
  function collectWhet(ents) {
    if (!GFX.companionLife || GFX.noFlash || GFX.reduceMotion) return;
    const pk = GFX.particles == null ? 1 : GFX.particles; if (pk <= 0.05) return;
    const ax = camAxes(V);
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i]; if (!e || e.hidden || e.dead || e.sprite !== 'kaelen' || !e._cSharp) continue;
      const sp = Engine.sprites[e.animSprite || e.sprite]; if (!sp) continue;
      const k = clamp(e._cSharpK == null ? 0 : e._cSharpK, 0, 1), sc = e.scale || 1, wH = sc * (sp.hs || 1), wW = wH * sp.w / sp.h * (V.spriteAspect || 1);
      const d = Math.max(0.3, (e.x - V.eye[0]) * fwdX + (e.y - V.eye[1]) * fwdY), px = d / VHL;     // world units per logical pixel there
      const bx = e.x + rightX * 0.24 * wW, by = e.y + rightY * 0.24 * wW, bz = groundAt(e.x, e.y) + 0.48 * wH;
      const n = Math.max(1, Math.round(3 * pk));
      for (let j = 0; j < n; j++) {
        const ang = -0.6 - j * 0.7 + (e._cStroke || 0) * 0.5, r = (1 + k * 3.2) * (0.6 + 0.3 * j);
        const sx = Math.cos(ang) * r * px, sy = (Math.sin(ang) * r + k * k * 2) * px;
        pushParticle(true, bx + ax.r[0] * sx - ax.u[0] * sy, by + ax.r[1] * sx - ax.u[1] * sy, bz - ax.u[2] * sy, 0.2, 0.5 * px, 0.5 * px, 1, 0, 1, 214 / 255, 130 / 255, 0.9 * (1 - k * 0.6), 0, false);
      }
    }
  }

  // ---------------------------------------------------------------- the co-op name tags (js/partner19.js)
  // partner19 places its name tags from what its post hook measured in the CPU depth buffer; under R3D that hook does not
  // run, so the figures' screen rects stand in (the head is the top of the rect)
  function measureCoop() {
    if (typeof PARTNER19 === 'undefined' || !PARTNER19.FIG || !PARTNER19.S || !PARTNER19.S.stats) return;
    const FIG = PARTNER19.FIG, S = PARTNER19.S;
    for (const o of [FIG.partner, FIG.host]) {
      if (!o) continue;
      const s = o.drawing && o._screen;
      const scr = s ? { x: (s.x0 + s.x1) / 2 / VWL, y: s.y0, w: (s.x1 - s.x0) / VWL, dist: s.dist } : null;
      const n = s ? Math.round((s.x1 - s.x0) * (s.y1 - s.y0) * 0.45) : 0;
      if (o === FIG.partner) { S.stats.drawn = n; S.screen = scr; } else { FIG.host.drawn = n; FIG.host.screen = scr; }
    }
  }

  // ================================================================ the frame
  function frame(ents, view) {
    const t0 = now();
    V = view; frameNo++; st.frames++;
    nBB = 0; nPT = 0; nPTadd = 0; nDC = 0; nDCmul = 0; figures.length = 0; chooseMs = 0;
    st.sprites = st.culled = st.decals = st.figures = 0;
    mapNow = view.map || (typeof G !== 'undefined' ? G.map : null);
    // the engine's animation clock (R3D hands its frame in view.F.time; the parity view passes animT)
    animT = isNum(view.animT) ? view.animT : view.F && isNum(view.F.time) ? view.F.time : (typeof ANIM !== 'undefined' && isNum(ANIM.T) ? ANIM.T : 0);
    wxNow = view.wx || (view.F && view.F.env && view.F.env.wx) || null;
    fogDist = view.fogDist || 12;
    const dir = isNum(view.dir) ? view.dir : Engine.cam.dir;
    fwdX = Math.cos(dir); fwdY = Math.sin(dir); rightX = -fwdY; rightY = fwdX;
    if (!gl || !ents) { st.ms.frame = now() - t0; return; }
    // each step is timed (st.ms.parts): the bookkeeping steps run what the modules' own post hooks would have run
    const P_ = st.ms.parts; let tp = now();
    const lap = (k) => { const t = now(); P_[k] = t - tp; tp = t; };
    try { collectEntities(ents); } catch (e) { warnOnce('entities', e); }
    lap('entities');
    try { collectGhost(); } catch (e) { warnOnce('ghost', e); }
    let water = [];
    try { collectGround(ents); } catch (e) { warnOnce('ground', e); }
    lap('ground');
    try { water = collectPrints() || []; } catch (e) { warnOnce('prints', e); }
    nDCmul = nDC;
    try { collectWaterPrints(water); } catch (e) { warnOnce('water prints', e); }
    lap('prints');
    try { if (!view.cpuHooks) stepSmoke(); } catch (e) { warnOnce('smoke', e); }
    lap('smokeSim');
    try { collectSmoke(); } catch (e) { warnOnce('smoke', e); }
    try { collectTelegraphs(ents); collectGlimmer(ents); } catch (e) { warnOnce('telegraphs', e); }
    try { collectBreath(ents); collectRings(ents); } catch (e) { warnOnce('breath', e); }
    try { collectLanterns(); collectSparks(); } catch (e) { warnOnce('motion10', e); }
    try { collectRope(); } catch (e) { warnOnce('rope', e); }
    try { collectCave(); } catch (e) { warnOnce('cave', e); }
    try { collectWhet(ents); } catch (e) { warnOnce('whet', e); }
    if (!view.cpuHooks) { try { measureCoop(); } catch (e) { warnOnce('coop', e); } }
    lap('effects');
    st.particles = nPT + nPTadd;
    // billboards grouped by atlas page: one draw call per page
    runs.length = 0;
    if (nBB) {
      if (order.length < nBB) order = new Uint32Array(BB.length / BB_FLOATS);
      for (let i = 0; i < nBB; i++) order[i] = i;
      const ord = Array.prototype.slice.call(order, 0, nBB).sort((a, b) => bbPage[a].idx - bbPage[b].idx);
      let cur = null;
      for (let k = 0; k < nBB; k++) {
        const i = ord[k]; BBS.set(BB.subarray(i * BB_FLOATS, i * BB_FLOATS + BB_FLOATS), k * BB_FLOATS);
        if (!cur || cur.pg !== bbPage[i]) { cur = { pg: bbPage[i], start: k, count: 0 }; runs.push(cur); }
        cur.count++;
      }
    }
    // translucent particles back to front
    if (nPT > 1) {
      if (ptOrder.length < nPT) ptOrder = new Uint32Array(PT.length / PT_FLOATS);
      const ord = []; for (let i = 0; i < nPT; i++) ord.push(i);
      ord.sort((a, b) => ptDist[b] - ptDist[a]);
      if (!PTA || PTA.length < PT.length) PTA = new Float32Array(PT.length);
      for (let k = 0; k < nPT; k++) PTA.set(PT.subarray(ord[k] * PT_FLOATS, ord[k] * PT_FLOATS + PT_FLOATS), k * PT_FLOATS);
    } else { if (!PTA || PTA.length < PT.length) PTA = new Float32Array(PT.length); if (nPT) PTA.set(PT.subarray(0, PT_FLOATS)); }
    lap('sort');
    st.ms.frame = now() - t0; st.ms.chooser = chooseMs; st.ms.own = st.ms.frame - chooseMs;
  }

  // ================================================================ drawing
  function stdState() { gl.bindVertexArray(null); gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.CULL_FACE); gl.activeTexture(gl.TEXTURE0); }
  const U_ATLAS = 6, U_MASKS = 7;                 // texture units: R3D keeps 0-5 for its own passes
  function bindBB(pr, view) {
    if (pr.R && R3) R3.use(pr.R); else gl.useProgram(pr.p);
    gl.uniformMatrix4fv(pr.u.u_vp, false, view.vp);
    gl.uniform3f(pr.u.u_eye, view.eye[0], view.eye[1], view.eye[2]);
    gl.uniform2f(pr.u.u_right, rightX, rightY);
    gl.uniform1f(pr.u.u_tilt, view.tilt == null ? 0.5 : +view.tilt);
    gl.uniform1f(pr.u.u_px, Math.max(1, view.px || 1));
    gl.uniform1i(pr.u.u_atlas, U_ATLAS);
    if (!pr.light) {
      const fog = view.fog || [0, 0, 0];
      gl.uniform3f(pr.u.u_fog, fog[0], fog[1], fog[2]);
      gl.uniform1f(pr.u.u_light, view.light == null ? 1 : view.light);
      gl.uniform1f(pr.u.u_outdoor, view.outdoor ? 1 : 0);
    } else if (pr.u.u_zk) gl.uniform1f(pr.u.u_zk, view.ZK || view.spriteAspect || 1);
  }
  // LIGHT's shadow pass: draw this frame's billboards depth-only into whatever framebuffer is bound.
  // cview = { vp: light view-projection, map space (z game units) -> clip; dir: [dx, dy] the light's horizontal direction
  // (any length; the cards turn square to it) }. Only things this frame drew are casters (off-screen bodies cast none).
  function drawCasters(cview) {
    if (!gl || !nBB || !P.sc || !cview || !cview.vp) return;
    try {
      const d = cview.dir || [1, 0], L = Math.hypot(d[0], d[1]) || 1;
      gl.useProgram(P.sc.p);
      gl.uniformMatrix4fv(P.sc.u.u_vp, false, cview.vp);
      gl.uniform2f(P.sc.u.u_right, -d[1] / L, d[0] / L);
      gl.uniform1i(P.sc.u.u_atlas, U_ATLAS);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
      gl.bindVertexArray(B.bb.vao);
      upload1(B.bb, BBS, nBB * BB_FLOATS);
      gl.activeTexture(gl.TEXTURE0 + U_ATLAS);
      for (const r of runs) {
        gl.bindTexture(gl.TEXTURE_2D, r.pg.tex);
        for (let i = 0; i < 5; i++) gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, BB_FLOATS * 4, r.start * BB_FLOATS * 4 + i * 16);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, r.count); st.calls++;
      }
      for (let i = 0; i < 5; i++) gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, BB_FLOATS * 4, i * 16);
    } catch (e) { warnOnce('drawCasters', e); }
    stdState();
  }
  function drawOpaque(view) {
    if (!gl || !nBB) return;
    const t0 = now();
    try {
      const pr = bbProgram();
      bindBB(pr, view);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
      gl.bindVertexArray(B.bb.vao);
      upload1(B.bb, BBS, nBB * BB_FLOATS);
      gl.activeTexture(gl.TEXTURE0 + U_ATLAS);
      for (const r of runs) {
        gl.bindTexture(gl.TEXTURE_2D, r.pg.tex);
        // instance attributes start at this run's first instance
        for (let i = 0; i < 5; i++) gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, BB_FLOATS * 4, r.start * BB_FLOATS * 4 + i * 16);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, r.count); st.calls++;
      }
      for (let i = 0; i < 5; i++) gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, BB_FLOATS * 4, i * 16);
    } catch (e) { warnOnce('drawOpaque', e); }
    stdState(); st.ms.opaque = now() - t0;
  }
  function drawDecals(view) {
    if (!gl || !nDC || !P.dc) return;
    const t0 = now();
    try {
      gl.useProgram(P.dc.p);
      gl.uniformMatrix4fv(P.dc.u.u_vp, false, view.vp);
      gl.uniform1i(P.dc.u.u_masks, U_MASKS); gl.uniform1f(P.dc.u.u_maskN, Math.max(1, maskCount));
      gl.activeTexture(gl.TEXTURE0 + U_MASKS); gl.bindTexture(gl.TEXTURE_2D, maskTex);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
      gl.bindVertexArray(B.dc.vao);
      upload1(B.dc, DC, nDC * DC_FLOATS);
      if (nDCmul) { gl.drawArrays(gl.TRIANGLES, 0, nDCmul); st.calls++; }
      if (nDC > nDCmul) { gl.blendFunc(gl.ONE, gl.ONE); gl.drawArrays(gl.TRIANGLES, nDCmul, nDC - nDCmul); st.calls++; }
      gl.disable(gl.POLYGON_OFFSET_FILL);
    } catch (e) { warnOnce('drawDecals', e); }
    stdState(); st.ms.decals = now() - t0;
  }
  function camAxes(view) {
    // the camera's right and up in map space (pitch tilts up toward the view direction)
    const dir = isNum(view.dir) ? view.dir : Engine.cam.dir, p = isNum(view.pitch) ? view.pitch : 0;
    const cp = Math.cos(p), sp = Math.sin(p);
    // map space carries z in game units (GL height / ZK): a vector that is unit length in GL has its z divided by ZK
    const zk = view.ZK || view.spriteAspect || 1;
    return { r: [-Math.sin(dir), Math.cos(dir), 0], u: [-Math.cos(dir) * sp, -Math.sin(dir) * sp, cp / zk] };
  }
  function drawTranslucent(view) {
    if (!gl) return;
    const t0 = now();
    try {
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false); gl.enable(gl.BLEND); gl.disable(gl.CULL_FACE);
      // figures (the ghost) first: they are few and sit among the particles
      if (figures.length) {
        const pr = bbProgram(); bindBB(pr, view);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.bindVertexArray(B.bb.vao); gl.activeTexture(gl.TEXTURE0 + U_ATLAS);
        for (const f of figures) {
          upload1(B.bb, f.inst, BB_FLOATS);
          gl.bindTexture(gl.TEXTURE_2D, f.en.pg.tex);
          gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 1); st.calls++;
        }
      }
      if ((nPT || nPTadd) && P.pt) {
        const ax = camAxes(view);
        gl.useProgram(P.pt.p);
        gl.uniformMatrix4fv(P.pt.u.u_vp, false, view.vp);
        gl.uniform3f(P.pt.u.u_eye, view.eye[0], view.eye[1], view.eye[2]);
        gl.uniform3f(P.pt.u.u_r3, ax.r[0], ax.r[1], ax.r[2]); gl.uniform3f(P.pt.u.u_u3, ax.u[0], ax.u[1], ax.u[2]);
        gl.uniform1f(P.pt.u.u_px, Math.max(1, view.px || 1));
        gl.bindVertexArray(B.pt.vao);
        if (nPT) { gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); upload1(B.pt, PTA, nPT * PT_FLOATS); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nPT); st.calls++; }
        if (nPTadd) { gl.blendFunc(gl.ONE, gl.ONE); upload1(B.pt, PTadd, nPTadd * PT_FLOATS); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nPTadd); st.calls++; }
      }
    } catch (e) { warnOnce('drawTranslucent', e); }
    stdState(); st.ms.translucent = now() - t0;
  }

  // ================================================================ the parity view (tests, screenshots, development)
  // The raycaster draws the world WITHOUT its sprites (an empty entity list for the sprite pass), its frame and depth
  // are uploaded, and these GL sprites are drawn over it with the raycaster's own projection, written as a matrix:
  //   clip.x = (right . d) / 0.66,  clip.y = 2 (z - eye z) - k t,  clip.w = t = forward . d   (d = P - eye),
  // where k puts eye level on the horizon row (the raycaster's y-shearing pitch). Same depths, same positions: a
  // sprite here must land on the pixels the raycaster's sprite pass would have filled (test/sprites21.test.js).
  const dev = (() => {
    const NEAR = 0.05, FAR = 400, A = (FAR + NEAR) / (FAR - NEAR), Bz = -2 * FAR * NEAR / (FAR - NEAR);
    const D = { on: false, canvas: null, gl: null, FI: null, colTex: null, depTex: null, prog: null, vao: null, w: 0, h: 0, hooked: false, hideCpu: true, last: null, ents: null };
    function hook() {
      if (D.hooked || typeof Engine === 'undefined' || !Engine.addPostHook) return;
      D.hooked = true;
      // runs after every other post hook: what the frame looked like, and the values its sprites were shaded with
      Engine.addPostHook((F) => { if (D.on) D.FI = F; }, 1e9);
      const _render = Engine.render;
      Engine.render = function (ents, tod, opts) {
        if (!D.on) return _render.apply(this, arguments);
        // the raycaster keeps its post hooks (they see no sprites); our GL sprites are drawn over the result
        D.ents = ents; D.FI = null;
        // the raycaster's sprite pass skips a sprite whose animAlpha is 0, while its lights (lamps, fires, glass) still
        // come from the same entities: hide them that way for this one call, then put every value back
        const saved = [];
        if (D.hideCpu && Array.isArray(ents)) for (let i = 0; i < ents.length; i++) { const e = ents[i]; if (e && e.sprite && !e.hidden) { saved.push(e, e.animAlpha); e.animAlpha = 0; } }
        let r;
        try { r = _render.call(this, ents, tod, opts); } finally { for (let i = 0; i < saved.length; i += 2) saved[i].animAlpha = saved[i + 1]; }
        try { present(); } catch (e) { warnOnce('dev.present', e); }
        return r;
      };
    }
    function ensure() {
      if (D.gl) return true;
      const view = Engine.canvas, c = document.createElement('canvas');
      c.id = 'p21s-dev'; c.setAttribute('aria-hidden', 'true');
      c.style.cssText = 'position:absolute;pointer-events:none;image-rendering:pixelated;z-index:2';
      view.parentNode.insertBefore(c, view.nextSibling);
      const g = c.getContext('webgl2', { antialias: false, depth: true, alpha: false, preserveDrawingBuffer: true });
      if (!g) { c.remove(); return false; }
      D.canvas = c; D.gl = g;
      if (!attach(g)) return false;
      const sh = (type, src) => { const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s); if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s)); return s; };
      const p = g.createProgram(); g.attachShader(p, sh(g.VERTEX_SHADER, DV_VS)); g.attachShader(p, sh(g.FRAGMENT_SHADER, DV_FS)); g.linkProgram(p);
      D.prog = { p, col: g.getUniformLocation(p, 'u_col'), dep: g.getUniformLocation(p, 'u_dep'), ab: g.getUniformLocation(p, 'u_ab') };
      D.vao = g.createVertexArray(); g.bindVertexArray(D.vao); g.bindBuffer(g.ARRAY_BUFFER, B.quad); g.enableVertexAttribArray(0); g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0); g.bindVertexArray(null);
      const mk = () => { const t = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE); return t; };
      D.colTex = mk(); D.depTex = mk();
      return true;
    }
    function place() {
      // over the 3D part (top 150 of 200 logical rows) of the view canvas, in CSS pixels
      const v = Engine.canvas, r = v.getBoundingClientRect(), pr = v.offsetParent ? v.offsetParent.getBoundingClientRect() : { left: 0, top: 0 };
      const cssW = r.width, cssH = r.height * VHL / 200;
      const c = D.canvas;
      c.style.left = (r.left - pr.left) + 'px'; c.style.top = (r.top - pr.top) + 'px'; c.style.width = cssW + 'px'; c.style.height = cssH + 'px';
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.max(1, Math.round(cssW * dpr)), H = Math.max(1, Math.round(cssH * dpr));
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    }
    // the raycaster's projection for the frame F, map space -> clip (column-major)
    function matrix(F) {
      const cam = F.cam, fx = F.dirX, fy = F.dirY, rx = -fy, ry = fx;
      const cx = cam.x, cy = cam.y, cz = cam.z;
      const k = 2 * (F.horizon + 0.5) / F.h - 1;
      const fd = fx * cx + fy * cy;
      const m = new Float32Array(16);
      // rows written into columns
      m[0] = rx / 0.66; m[4] = ry / 0.66; m[8] = 0; m[12] = -(rx * cx + ry * cy) / 0.66;
      m[1] = -k * fx; m[5] = -k * fy; m[9] = 2; m[13] = -2 * cz + k * fd;
      m[2] = A * fx; m[6] = A * fy; m[10] = 0; m[14] = -A * fd + Bz;
      m[3] = fx; m[7] = fy; m[11] = 0; m[15] = -fd;
      return m;
    }
    function present() {
      const F = D.FI; if (!F || !ensure()) return;
      place();
      const g = D.gl;
      // the frame's sky and fog values, as the sprites would have been shaded
      const view = {
        vp: matrix(F), eye: [F.cam.x, F.cam.y, F.cam.z], dir: Math.atan2(F.dirY, F.dirX), pitch: 0, fogDist: F.fogDist, outdoor: F.outdoor,
        fog: [F.fogR / 255, F.fogG / 255, F.fogB / 255], light: F.light, ambient: F.ambient || 0, flick: 1, lights: F.ptLights, px: D.canvas.width / F.w,
        spriteAspect: VHL * 0.66 * 2 / VWL, ZK: VHL * 0.66 * 2 / VWL, map: F.map, animT: F.animT, wx: F.wx, cpuHooks: true, tilt: 0,
        farLod2: F.far ? 4 * Math.pow(Engine.farInfo().baseFog || 12, 2) : 0,
      };
      D.last = view;
      frame(D.ents || [], view);
      g.bindFramebuffer(g.FRAMEBUFFER, null);
      g.viewport(0, 0, D.canvas.width, D.canvas.height);
      g.clearColor(0, 0, 0, 1); g.clearDepth(1); g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
      // the CPU frame and its depth
      g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, D.colTex);
      g.pixelStorei(g.UNPACK_ALIGNMENT, 4);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, F.w, F.h, 0, g.RGBA, g.UNSIGNED_BYTE, new Uint8Array(F.fb.buffer, F.fb.byteOffset, F.w * F.h * 4));
      g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, D.depTex);
      g.texImage2D(g.TEXTURE_2D, 0, g.R32F, F.w, F.h, 0, g.RED, g.FLOAT, F.dbuf);
      g.useProgram(D.prog.p); g.uniform1i(D.prog.col, 0); g.uniform1i(D.prog.dep, 1); g.uniform2f(D.prog.ab, A, Bz);
      g.enable(g.DEPTH_TEST); g.depthFunc(g.ALWAYS); g.depthMask(true); g.disable(g.BLEND);
      g.bindVertexArray(D.vao); g.drawArrays(g.TRIANGLE_STRIP, 0, 4); g.bindVertexArray(null);
      g.depthFunc(g.LEQUAL); g.activeTexture(g.TEXTURE0);
      drawOpaque(view); drawDecals(view); drawTranslucent(view);
    }
    return {
      on(opts) { opts = opts || {}; hook(); D.on = true; D.hideCpu = opts.hideCpu !== false; if (!ensure()) { D.on = false; return false; } D.canvas.style.display = ''; return true; },
      off() { D.on = false; if (D.canvas) D.canvas.style.display = 'none'; },
      get active() { return D.on; }, get canvas() { return D.canvas; }, get view() { return D.last; }, matrix,
      lost() { if (D.canvas) D.canvas.remove(); D.canvas = D.gl = null; D.on = false; },
    };
  })();

  return {
    attach, detach, frame, drawOpaque, drawDecals, drawTranslucent, drawCasters, dev, stats: st,
    entryFor: (sp) => (gl ? entryFor(sp) : null), project: (x, y, z) => (V && project(x, y, z) > 0 ? { x: PJ[0], y: PJ[1], w: PJ[2] } : null),
    get pages() { return pages.length; }, get count() { return { billboards: nBB, particles: nPT + nPTadd, decalVerts: nDC, figures: figures.length, runs: runs.length }; },
    get gl() { return gl; },
    consts: { PAGE, MAX_PAGES, AL, LEVELS, ALPHA_CUT, EMIT_A },
  };
})();
if (typeof window !== 'undefined') window.SPRITES21 = SPRITES21;
