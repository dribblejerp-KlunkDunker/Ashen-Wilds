// The M2 renderer: WebGL2 instanced quads, one atlas, one shader, and preallocated instance
// batches. No Canvas 2D fallback: if WebGL2 is missing, the page says so clearly.

import { VIEW } from '../sim/tuning.js';
import { FRAMES, FRAME_COUNT, createAtlas } from './atlas.js';
import { INSTANCE_FLOATS, INSTANCE_BYTES, createInstanceBatch } from './instances.js';

const GROUND = [0.043, 0.055, 0.047];
const WALL_TINT = [0.192, 0.220, 0.184];
const GOBLIN_TINT = [0.275, 0.345, 0.227];
const PLAYER_TINT = [0.914, 0.882, 0.788];
const ACTOR_CAPACITY = 4096;
const WALL_CAPACITY = 256;

const VS = `#version 300 es
layout(location = 0) in vec2 a_quad;
layout(location = 1) in vec4 a_instance;
layout(location = 2) in float a_frame;
layout(location = 3) in vec4 a_tint;
layout(location = 4) in float a_flash;

uniform vec2 u_resolution;
uniform vec2 u_camera;
uniform float u_scale;
uniform float u_atlasCols;

out vec2 v_uv;
out vec4 v_tint;
out float v_flash;

void main() {
  vec2 world = a_instance.xy + a_quad * a_instance.zw;
  vec2 screen = (world - u_camera) * u_scale + u_resolution * 0.5;
  gl_Position = vec4(
    screen.x / u_resolution.x * 2.0 - 1.0,
    1.0 - screen.y / u_resolution.y * 2.0,
    0.0,
    1.0
  );

  float col = mod(a_frame, u_atlasCols);
  v_uv = vec2((col + a_quad.x + 0.5) / u_atlasCols, a_quad.y + 0.5);
  v_tint = a_tint;
  v_flash = a_flash;
}`;

const FS = `#version 300 es
precision mediump float;

uniform sampler2D u_atlas;

in vec2 v_uv;
in vec4 v_tint;
in float v_flash;

out vec4 outColor;

void main() {
  vec4 tex = texture(u_atlas, v_uv);
  vec3 color = tex.rgb * v_tint.rgb;
  float alpha = tex.a * v_tint.a;
  color = mix(color, vec3(1.0), v_flash);
  outColor = vec4(color, alpha);
}`;

// GPU time needs a real timer: performance.now around draw() only measures how long the CPU
// spends filling buffers and submitting commands, while the driver runs the frame later. When the
// browser exposes EXT_disjoint_timer_query_webgl2 this tracks the GPU's own elapsed time for each
// frame. Results arrive a frame or two late, so the query is polled, never waited on, and a power
// or thermal event (a disjoint result) throws the samples in flight away.
const MAX_PENDING_GPU_QUERIES = 4;

function createGpuTimer(gl) {
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const stats = { supported: false, samples: 0, dropped: 0, skipped: 0 };
  let lastMs = null;

  if (!ext) {
    return {
      stats,
      lastMs() { return null; },
      begin() { return false; },
      end() {},
      poll() { return null; },
    };
  }

  stats.supported = true;
  const target = ext.TIME_ELAPSED_EXT;
  const pending = [];
  let open = null;

  return {
    stats,
    lastMs() { return lastMs; },
    begin() {
      if (open || pending.length >= MAX_PENDING_GPU_QUERIES) {
        stats.skipped++;
        return false;
      }
      const query = gl.createQuery();
      if (!query) {
        stats.skipped++;
        return false;
      }
      gl.beginQuery(target, query);
      open = query;
      return true;
    },
    end() {
      if (!open) return;
      gl.endQuery(target);
      pending.push(open);
      open = null;
    },
    poll() {
      lastMs = null;
      if (pending.length === 0) return null;

      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
      if (disjoint) {
        for (let i = 0; i < pending.length; i++) {
          gl.deleteQuery(pending[i]);
          stats.dropped++;
        }
        pending.length = 0;
        return null;
      }

      while (pending.length > 0) {
        const query = pending[0];
        if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) break;
        pending.shift();
        lastMs = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
        stats.samples++;
        gl.deleteQuery(query);
      }
      return lastMs;
    },
  };
}

export function createGlRenderer(canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  if (!gl) throw new Error('The Tally needs WebGL2. This browser did not provide a WebGL2 context.');

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('WebGL2 shader compile failed: ' + log);
    }
    return shader;
  }

  const vs = compile(gl.VERTEX_SHADER, VS);
  const fs = compile(gl.FRAGMENT_SHADER, FS);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    throw new Error('WebGL2 program link failed: ' + log);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  const uResolution = gl.getUniformLocation(program, 'u_resolution');
  const uCamera = gl.getUniformLocation(program, 'u_camera');
  const uScale = gl.getUniformLocation(program, 'u_scale');
  const uAtlasCols = gl.getUniformLocation(program, 'u_atlasCols');
  const uAtlas = gl.getUniformLocation(program, 'u_atlas');

  const quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -0.5, -0.5,
    0.5, -0.5,
    -0.5, 0.5,
    0.5, 0.5,
  ]), gl.STATIC_DRAW);

  function makeVao(batch) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, batch.buffer);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, INSTANCE_BYTES, 0);
    gl.vertexAttribDivisor(1, 1);

    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, INSTANCE_BYTES, 16);
    gl.vertexAttribDivisor(2, 1);

    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, INSTANCE_BYTES, 20);
    gl.vertexAttribDivisor(3, 1);

    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, INSTANCE_BYTES, 36);
    gl.vertexAttribDivisor(4, 1);

    gl.bindVertexArray(null);
    return vao;
  }

  function makeBatch(capacity) {
    const batch = createInstanceBatch(capacity);
    batch.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, batch.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, batch.data.byteLength, gl.DYNAMIC_DRAW);
    batch.vao = makeVao(batch);
    return batch;
  }

  const wallBatch = makeBatch(WALL_CAPACITY);
  const actorBatch = makeBatch(ACTOR_CAPACITY);
  const atlas = createAtlas(gl);
  const gpuTimer = createGpuTimer(gl);
  const stats = { instances: 0, drawCalls: 0, culled: 0, contextLost: false };

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    stats.contextLost = true;
  }, false);

  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(GROUND[0], GROUND[1], GROUND[2], 1);

  function upload(batch) {
    if (batch.count === 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, batch.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, batch.data, 0, batch.count * INSTANCE_FLOATS);
  }

  function drawBatch(batch) {
    if (batch.count === 0) return 0;
    gl.bindVertexArray(batch.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, batch.count);
    return 1;
  }

  // Off-screen sprites never reach the buffer: the yard is wider than the view, and an instance
  // that is not drawn costs neither upload nor vertex work. Walls are few, but the test is the same.
  function addWall(batch, w, x0, y0, x1, y1) {
    const dx = w.x2 - w.x1;
    const dy = w.y2 - w.y1;
    const cx = (w.x1 + w.x2) * 0.5;
    const cy = (w.y1 + w.y2) * 0.5;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const width = horizontal ? Math.abs(dx) + 8 : 8;
    const height = horizontal ? 8 : Math.abs(dy) + 8;
    if (cx + width * 0.5 < x0 || cx - width * 0.5 > x1
      || cy + height * 0.5 < y0 || cy - height * 0.5 > y1) return false;
    batch.push(cx, cy, width, height, FRAMES.wall,
      WALL_TINT[0], WALL_TINT[1], WALL_TINT[2], 1, 0);
    return true;
  }

  function draw(world, alpha) {
    if (stats.contextLost || gl.isContextLost()) return;

    gpuTimer.poll();
    const timed = gpuTimer.begin();

    const width = canvas.width;
    const height = canvas.height;
    const scale = Math.max(width / VIEW.w, height / VIEW.h);
    const halfW = width / (2 * scale);
    const halfH = height / (2 * scale);
    const viewX0 = world.cam.x - halfW;
    const viewY0 = world.cam.y - halfH;
    const viewX1 = world.cam.x + halfW;
    const viewY1 = world.cam.y + halfH;

    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    wallBatch.begin();
    actorBatch.begin();

    let culled = 0;
    const wallList = world.walls;
    for (let i = 0; i < wallList.length; i++) {
      if (!addWall(wallBatch, wallList[i], viewX0, viewY0, viewX1, viewY1)) culled++;
    }
    const wallCount = wallBatch.count;

    const goblins = world.goblins;
    for (let i = 0; i < goblins.length; i++) {
      const g = goblins[i];
      const half = g.radius * 1.4;
      const x = g.px + (g.x - g.px) * alpha;
      const y = g.py + (g.y - g.py) * alpha;
      if (x + half < viewX0 || x - half > viewX1 || y + half < viewY0 || y - half > viewY1) {
        culled++;
        continue;
      }
      const size = g.radius * 2.8;
      actorBatch.push(x, y, size, size, FRAMES.goblin,
        GOBLIN_TINT[0], GOBLIN_TINT[1], GOBLIN_TINT[2], 1, 0);
    }

    const p = world.player;
    const px = p.px + (p.x - p.px) * alpha;
    const py = p.py + (p.y - p.py) * alpha;
    const playerFlash = p.iframes > 0 ? 0.35 : 0;
    actorBatch.push(px, py, 34, 34, FRAMES.player,
      PLAYER_TINT[0], PLAYER_TINT[1], PLAYER_TINT[2], 1, playerFlash);

    const actorCount = actorBatch.count;
    upload(wallBatch);
    upload(actorBatch);

    gl.useProgram(program);
    gl.uniform2f(uResolution, width, height);
    gl.uniform2f(uCamera, world.cam.x, world.cam.y);
    gl.uniform1f(uScale, scale);
    gl.uniform1f(uAtlasCols, FRAME_COUNT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, atlas);
    gl.uniform1i(uAtlas, 0);

    let draws = 0;
    draws += drawBatch(wallBatch);
    draws += drawBatch(actorBatch);
    gl.bindVertexArray(null);
    if (timed) gpuTimer.end();

    stats.instances = wallCount + actorCount;
    stats.drawCalls = draws;
    stats.culled = culled;
  }

  // The last GPU sample that finished since the previous frame, in ms. Null means no sample yet.
  // The value is only filled when the browser exposes EXT_disjoint_timer_query_webgl2.
  function pollGpu() {
    return gpuTimer.lastMs();
  }

  function info() {
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      context: 'webgl2',
      vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      version: gl.getParameter(gl.VERSION),
      shading: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
    };
  }

  return { draw, info, stats, pollGpu, gpuTiming: gpuTimer.stats };
}
