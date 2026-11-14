// ============================================================
//  enemy-fx — hit-flinch frames for every enemy, and boss phase art (Phase 3)
//
//  1. Flinch: when an enemy takes a hit (anim.js sets e._hurt = 0.3 s) the
//     sprite it is showing is swapped for a recoil frame: the figure leans away
//     from the blow and rises a little, the spot it left is smeared, and a
//     pale highlight marks the struck edge. Symmetric blobs (swarm, moth,
//     horn) burst and scatter instead. Frames are built once per source sprite
//     (so once per species, pose and view), cached and byte-budgeted.
//  2. The Requiem cracks at half health: ~1 s of cracks spreading across it,
//     shards flying off as screen-space particles, then a cracked variant for
//     the rest of the fight. The Brood-Mother sheds her egg-sacs the same way:
//     the pods peel off and fall, leaving a deflated variant.
//
//  Everything here is a procedural STAND-IN for hand-painted art: the contract
//  (a sprite per pose that replaces the current one) does not change when the
//  painted frames arrive. Visual only: this file reads hp and writes nothing
//  the game saves or simulates (fields start with _fx), and it keeps its own
//  random generator so it never shifts the game's Math.random sequence.
//  GFX.enemyFx = false puts every sprite and frame back exactly as before.
// ============================================================
'use strict';

if (GFX.enemyFx === undefined) GFX.enemyFx = true;
// Pure motion switch: the shatter and the shedding jump straight to the
// finished variant (no shake, no flying shards). prefers-reduced-motion sets it.
if (GFX.reducedMotion === undefined) {
  GFX.reducedMotion = false;
  try { GFX.reducedMotion = !!(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { /* default stays false */ }
}

const ENEMY_FX = (() => {
  const CAP = 3 * 1024 * 1024;                 // byte budget for every derived frame
  const SYMMETRIC = new Set(['mites', 'hushmoth', 'horn']);
  const BOSSES = { requiem: { dur: 1.0 }, broodmother: { dur: 1.2 } };
  const WAVES = [0.12, 0.36, 0.6, 0.84];       // fractions of the phase at which a burst of bits is released
  const STAGES = [0.18, 0.42, 0.7, 0.95];      // crack / peel progress shown in each quarter of the phase

  // ---- pixel helpers (sprites are ABGR Uint32Arrays, like the engine's) -----
  const clamp = v => (v > 255 ? 255 : v < 0 ? 0 : v | 0);
  const pack = (r, g, b, a) => (((a << 24) | (clamp(b) << 16) | (clamp(g) << 8) | clamp(r)) >>> 0);
  const rOf = p => p & 255, gOf = p => (p >>> 8) & 255, bOf = p => (p >>> 16) & 255, aOf = p => p >>> 24;
  function mix(p, tr, tg, tb, k) { return pack(rOf(p) + (tr - rOf(p)) * k, gOf(p) + (tg - gOf(p)) * k, bOf(p) + (tb - bOf(p)) * k, aOf(p)); }
  function hash(x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  // The module's own generator, so nothing here consumes the game's Math.random.
  let rs = 0x2545f491;
  function rnd() { rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; return ((rs >>> 0) % 100000) / 100000; }
  const derive = (src, data) => ({ w: src.w, h: src.h, data, hs: src.hs, cx: src.cx, dy: src.dy });
  const PALE = [238, 230, 222];

  // ---- the cache: per source sprite, one entry holding every derived frame --
  const cache = new Map();                      // source sprite -> { flinch, stage[4], fin, bytes, used }
  let bytes = 0, stamp = 0;
  function entryOf(src) {
    let en = cache.get(src);
    if (!en) { en = { flinch: null, stage: [null, null, null, null], fin: null, bytes: 0, used: 0 }; cache.set(src, en); }
    en.used = ++stamp; return en;
  }
  function evict(need, keep) {
    while (bytes + need > CAP) {
      let oldest = null, key = null;
      for (const [k, en] of cache) if (k !== keep && en.bytes > 0 && (!oldest || en.used < oldest.used)) { oldest = en; key = k; }
      if (!oldest) return;
      bytes -= oldest.bytes; cache.delete(key);
    }
  }
  function store(src, en, sprite, put) {
    const size = sprite.data.byteLength;
    evict(size, src);
    if (!cache.has(src)) cache.set(src, en);
    put(sprite); en.bytes += size; bytes += size;
    return sprite;
  }

  // ---- 1. flinch --------------------------------------------------------
  // Struck from the right: the body leans left and rises, the vacated edge is
  // smeared in a darker, half-seen ghost, and the right-hand rim goes pale.
  function buildRecoil(src) {
    const { w, h, data } = src;
    const out = new Uint32Array(w * h);
    const back = Math.max(3, Math.round(w * 0.07)), lean = 0.07, rise = Math.max(2, Math.round(h * 0.012));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ys0 = y + Math.round(rise * (1 - y / h));
        const ys = ys0 >= h ? h - 1 : ys0;
        const xs = x + Math.round(back * 0.5 + lean * (h - 1 - ys));
        let px = xs >= 0 && xs < w ? data[ys * w + xs] : 0;
        if (aOf(px) < 100) {
          // the smear: where the figure stood a moment ago, a dim trace of it
          const og = data[y * w + x];
          px = aOf(og) >= 100 ? pack(rOf(og) * 0.55, gOf(og) * 0.5, bOf(og) * 0.55, 130) : 0;
        }
        out[y * w + x] = px;
      }
    }
    // the pale highlight on the struck rim, and a small impact star
    let starX = -1, starY = (h * 0.32) | 0;
    for (let y = 0; y < h; y++) {
      for (let x = w - 1; x >= 0; x--) {
        const p = out[y * w + x];
        if (aOf(p) < 200) continue;
        const right = x + 1 < w ? aOf(out[y * w + x + 1]) : 0;
        if (right < 200) {
          out[y * w + x] = mix(p, PALE[0], PALE[1], PALE[2], 0.62);
          if (x > 0 && aOf(out[y * w + x - 1]) >= 200) out[y * w + x - 1] = mix(out[y * w + x - 1], PALE[0], PALE[1], PALE[2], 0.28);
          if (y >= h * 0.22 && y <= h * 0.42 && x > starX) { starX = x; starY = y; }
        }
      }
    }
    if (starX >= 0) {
      for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [0, -2], [0, 2]]) {
        const x = starX + dx, y = starY + dy;
        if (x >= 0 && x < w && y >= 0 && y < h) out[y * w + x] = pack(255, 250, 240, 255);
      }
    }
    return derive(src, out);
  }
  // Blobs have no front: they burst. Pixels are pushed outward, the rim breaks
  // into scattered bits and pale sparks fly off it.
  function buildBurst(src) {
    const { w, h, data } = src;
    const out = new Uint32Array(w * h);
    const cx = (src.cx == null ? 0.5 : src.cx) * w, cy = h * 0.5, rmax = Math.hypot(w, h) / 2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - cx, dy = y - cy, rd = Math.hypot(dx, dy) / rmax;
        const k = 1.12 + 0.12 * rd;
        const jx = (hash(x, y, 1) - 0.5) * 3.4 * rd, jy = (hash(x, y, 2) - 0.5) * 3.4 * rd;
        const sx = Math.round(cx + dx / k + jx), sy = Math.round(cy + dy / k + jy);
        if (sx < 0 || sx >= w || sy < 0 || sy >= h) continue;
        let p = data[sy * w + sx];
        if (aOf(p) < 100) continue;
        if (rd > 0.5 && hash(x, y, 3) < 0.22) continue;        // the rim breaks up
        if (rd > 0.55) p = mix(p, PALE[0], PALE[1], PALE[2], 0.4);
        out[y * w + x] = p;
      }
    }
    // sparks just off the silhouette
    const spark = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (aOf(out[y * w + x]) >= 100 || hash(x, y, 4) > 0.09) continue;
      if (aOf(out[y * w + x - 1]) >= 100 || aOf(out[y * w + x + 1]) >= 100 || aOf(out[(y - 1) * w + x]) >= 100 || aOf(out[(y + 1) * w + x]) >= 100) spark.push(y * w + x);
    }
    for (const i of spark) out[i] = pack(255, 248, 236, 255);
    return derive(src, out);
  }
  function flinchOf(src, symmetric) {
    const en = entryOf(src);
    if (en.flinch) return en.flinch;
    return store(src, en, symmetric ? buildBurst(src) : buildRecoil(src), s => { en.flinch = s; });
  }

  // ---- 2a. the Requiem's cracks -----------------------------------------
  // Crack geometry in sprite space (0..1), grown from the chest outward; t is
  // how far along the spread a segment appears.
  let CRACKS = null;
  function cracks() {
    if (CRACKS) return CRACKS;
    let s = 0x1234abcd; const r = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
    const segs = [], ends = [], ox = 0.5, oy = 0.36;
    function walk(x, y, ang, steps, level, t0) {
      for (let i = 0; i < steps; i++) {
        ang += (r() - 0.5) * 1.2;
        const len = 0.03 + r() * 0.015, nx = x + Math.cos(ang) * len * 1.1, ny = y + Math.sin(ang) * len * 0.9;
        const t = Math.min(1, t0 + (i + 1) / (steps + 4) * (level ? 0.55 : 0.8));
        segs.push({ x0: x, y0: y, x1: nx, y1: ny, t, level });
        x = nx; y = ny;
        if (!level && (i === 3 || i === 7) && steps > 5) walk(x, y, ang + (r() < 0.5 ? -1 : 1) * (0.7 + r() * 0.5), 3 + ((r() * 4) | 0), 1, t);
      }
      ends.push([x, y]);
    }
    // the long seam: up through the bell and down the robe, then the spread
    walk(ox, oy, -Math.PI / 2, 10, 0, 0); walk(ox, oy, Math.PI / 2, 15, 0, 0);
    for (let i = 0; i < 8; i++) walk(ox, oy, (i / 8) * Math.PI * 2 + (r() - 0.5) * 0.4, 6 + ((r() * 8) | 0), 0, 0);
    CRACKS = { segs, ends, ox, oy };
    return CRACKS;
  }
  function crackSprite(src, p, chips) {
    const { w, h, data } = src, out = data.slice(), C = cracks();
    const core = new Uint8Array(w * h);
    for (const sg of C.segs) {
      if (sg.t > p) continue;
      const x0 = sg.x0 * w, y0 = sg.y0 * h, x1 = sg.x1 * w, y1 = sg.y1 * h, n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
      for (let i = 0; i <= n; i++) {
        const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
        if (x >= 0 && x < w && y >= 0 && y < h && aOf(data[y * w + x]) >= 100) core[y * w + x] = 1;
      }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (core[i]) { out[i] = pack(206, 188, 250, aOf(data[i])); continue; }
      if (aOf(data[i]) < 100) continue;
      // a lilac glow bleeding into one pixel either side, darker beyond
      if ((x > 0 && core[i - 1]) || (x < w - 1 && core[i + 1]) || (y > 0 && core[i - w]) || (y < h - 1 && core[i + w])) out[i] = mix(mix(data[i], 0, 0, 0, 0.45), 150, 120, 215, 0.3);
    }
    if (chips) {
      // chips missing from the rim where the cracks reach it
      for (const [ex, ey] of C.ends) {
        const cxp = ex * w, cyp = ey * h, rad = Math.max(2.5, w * 0.045);
        for (let y = Math.max(0, (cyp - rad - 1) | 0); y <= Math.min(h - 1, cyp + rad + 1); y++) for (let x = Math.max(0, (cxp - rad - 1) | 0); x <= Math.min(w - 1, cxp + rad + 1); x++) {
          const d = Math.hypot(x - cxp, y - cyp) + (hash(x, y, 7) - 0.5) * 2.2;
          if (d < rad && !core[y * w + x]) {
            // only the outline: a pixel with open air within a few pixels
            let edge = false;
            for (let k = 1; k <= 3 && !edge; k++) if (x - k < 0 || aOf(data[y * w + x - k]) < 100 || x + k >= w || aOf(data[y * w + x + k]) < 100) edge = true;
            if (edge) out[y * w + x] = 0;
          }
        }
      }
    }
    return derive(src, out);
  }

  // ---- 2b. the Brood-Mother's sacs --------------------------------------
  // The sacs are the pods and red mouths packed into the abdomen. They peel in
  // 4x4 clumps, upper ones first; what is left is a smooth, deflated husk.
  function inAbdomen(x, y, w, h) { const u = (x / w - 0.5) / 0.33, v = (y / h - 0.37) / 0.38; return u * u + v * v < 1; }
  function isSac(p, x, y, w, h) {
    if (aOf(p) < 100 || !inAbdomen(x, y, w, h)) return false;
    const r = rOf(p), g = gOf(p), b = bOf(p), lum = 0.3 * r + 0.59 * g + 0.11 * b;
    return lum < 118 || r > g * 1.35 + 8;
  }
  const peelOrder = (x, y, h) => hash(x >> 2, y >> 2, 11) * 0.6 + (y / h) * 0.4;
  function shedSprite(src, p) {
    const { w, h, data } = src, out = data.slice();
    let hr = 0, hg = 0, hb = 0, hn = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const px = data[y * w + x];
      if (aOf(px) >= 100 && inAbdomen(x, y, w, h) && !isSac(px, x, y, w, h)) { hr += rOf(px); hg += gOf(px); hb += bOf(px); hn++; }
    }
    const husk = hn > 20 ? [hr / hn, hg / hn, hb / hn] : [150, 120, 150];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!isSac(data[i], x, y, w, h) || peelOrder(x, y, h) >= p) continue;
      const n = 0.88 + hash(x, y, 5) * 0.1;
      out[i] = pack(husk[0] * n, husk[1] * n * 0.95, husk[2] * n, aOf(data[i]));
    }
    return derive(src, out);
  }

  function stageOf(src, kind, k) {
    const en = entryOf(src), final = k >= 4;
    const slot = final ? en.fin : en.stage[k];
    if (slot) return slot;
    const p = final ? 1 : STAGES[k];
    const sprite = kind === 'requiem' ? crackSprite(src, p, final) : shedSprite(src, p);
    return store(src, en, sprite, s => { if (final) en.fin = s; else en.stage[k] = s; });
  }

  // ---- phase state --------------------------------------------------------
  // 0 whole, 1 playing the shatter / shedding, 2 finished (variant). A boss
  // first seen at or below half health goes straight to 2, so a loaded save
  // shows the variant at once.
  const ACTIVE = [];
  const halfLeft = e => { const m = e.hpMax || (e.def && e.def.hp) || 0; return m > 0 && e.hp != null && e.hp <= m * 0.5; };
  function phaseOf(e) {
    if (e._fxPhase === undefined) e._fxPhase = halfLeft(e) ? 2 : 0;
    return e._fxPhase;
  }
  function tick(e, dt, T) {
    const cfg = BOSSES[e.type];
    if (!cfg || e.kind !== 'enemy' || e.dead || e.hp <= 0) return;
    let ph = phaseOf(e);
    if (ph === 0 && halfLeft(e)) {
      if (GFX.reducedMotion) ph = e._fxPhase = 2;
      else { ph = e._fxPhase = 1; e._fxT = 0; e._fxWave = 0; if (ACTIVE.indexOf(e) < 0) ACTIVE.push(e); }
    }
    if (ph === 1) {
      e._fxT += dt;
      const k = Math.min(1, e._fxT / cfg.dur);
      // a tremor that dies away as the figure gives (visual only)
      e.animSkew = (e.animSkew || 0) + 0.035 * (1 - k) * Math.sin(T * 58);
      if (e._fxT >= cfg.dur) { e._fxPhase = 2; const i = ACTIVE.indexOf(e); if (i >= 0) ACTIVE.splice(i, 1); }
    }
  }

  // ---- the sprite chooser -------------------------------------------------
  function choose(e, r) {
    let sp = r.sprite;
    if (BOSSES[e.type]) {
      const ph = phaseOf(e);
      if (ph === 2) sp = stageOf(sp, e.type, 4);
      else if (ph === 1) { e._fxBase = sp; e._fxFlip = !!r.flip; sp = stageOf(sp, e.type, Math.min(3, Math.floor(e._fxT / BOSSES[e.type].dur * 4))); }
    }
    if (e._hurt > 0 && e.hp > 0) sp = flinchOf(sp, SYMMETRIC.has(e.sprite));
    return sp === r.sprite ? r : { sprite: sp, flip: r.flip };
  }

  // ---- shards and sacs falling off (screen space, drawn over the view) ----
  const bits = [];
  const BIT_CAP = 200;
  function bitFrom(e, tx, ty, kind, ox, oy) {
    const sc = e._screen, sp = e._fxBase; if (!sc || !sp || bits.length >= BIT_CAP) return;
    const fx = (e._fxFlip ? sp.w - 1 - tx : tx) + 0.5;
    const x = sc.x0 + fx / sp.w * (sc.x1 - sc.x0), y = sc.y0 + (ty + 0.5) / sp.h * (sc.y1 - sc.y0);
    const px = sp.data[ty * sp.w + tx], dx = x - ox, dy = y - oy, d = Math.hypot(dx, dy) || 1;
    const shard = kind === 'shard', speed = shard ? 22 + rnd() * 40 : 3 + rnd() * 14;
    bits.push({
      x, y, vx: dx / d * speed + (rnd() - 0.5) * 8, vy: dy / d * speed * (shard ? 1 : 0.1) - (shard ? 24 : -4),
      g: shard ? 95 : 150, life: 0, max: shard ? 0.8 + rnd() * 0.6 : 0.9 + rnd() * 0.6,
      size: rnd() < 0.35 ? 2 : 1, c: 'rgb(' + rOf(px) + ',' + gOf(px) + ',' + bOf(px) + ')', pale: shard && rnd() < 0.2,
    });
  }
  function wave(e, k) {
    const sc = e._screen, sp = e._fxBase; if (!sc || !sp) return;
    const { w, h } = sp, ox = sc.x0 + (sc.x1 - sc.x0) * 0.5, oy = sc.y0 + (sc.y1 - sc.y0) * 0.36;
    const lo = k ? STAGES[k - 1] : 0, hi = STAGES[k];
    if (e.type === 'requiem') {
      // shards from the cracks that opened since the last wave
      const pool = cracks().segs.filter(sg => sg.t > lo && sg.t <= hi);
      for (let i = 0; i < 20 && pool.length; i++) {
        const sg = pool[(rnd() * pool.length) | 0], tx = Math.min(w - 1, Math.max(0, Math.round(sg.x1 * w))), ty = Math.min(h - 1, Math.max(0, Math.round(sg.y1 * h)));
        if (aOf(sp.data[ty * w + tx]) >= 100) bitFrom(e, tx, ty, 'shard', ox, oy);
      }
    } else {
      // pods from the clumps that peel in this stretch
      const pool = [];
      for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
        const o = peelOrder(x, y, h); if (o >= lo && o < hi && isSac(sp.data[y * w + x], x, y, w, h)) pool.push(y * w + x);
      }
      for (let i = 0; i < 16 && pool.length; i++) { const q = pool[(rnd() * pool.length) | 0]; bitFrom(e, q % w, (q / w) | 0, 'sac', ox, oy - (sc.y1 - sc.y0) * 0.1); }
    }
  }
  function drawBits(dt) {
    const ctx = Engine.ctx;
    for (const e of ACTIVE) {
      const cfg = BOSSES[e.type]; if (!cfg) continue;
      while (e._fxWave < WAVES.length && e._fxT / cfg.dur >= WAVES[e._fxWave]) { wave(e, e._fxWave); e._fxWave++; }
    }
    if (!bits.length) return;
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i]; b.life += dt;
      if (b.life >= b.max) { bits.splice(i, 1); continue; }
      b.vy += b.g * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      ctx.globalAlpha = Math.min(1, (b.max - b.life) * 3);
      ctx.fillStyle = b.pale && b.life < 0.25 ? '#f2eafa' : b.c;
      ctx.fillRect(b.x | 0, b.y | 0, b.size, b.size);
    }
    ctx.globalAlpha = 1;
  }

  function species() {
    const seen = new Set(), list = [];
    for (const k in ENEMIES) {
      const s = ENEMIES[k].sprite; if (seen.has(s) || !Engine.sprites[s]) continue; seen.add(s);
      list.push({ sprite: s, symmetric: SYMMETRIC.has(s) });
    }
    return list;
  }
  function clear() { cache.clear(); bytes = 0; bits.length = 0; }

  return {
    cap: CAP, symmetric: SYMMETRIC, bosses: BOSSES, species, clear, tick, choose, drawBits, phaseOf, halfLeft, stages: STAGES,
    flinch: (src, symmetric) => flinchOf(src, symmetric),
    stage: (src, type, k) => stageOf(src, type, k),
    budgetBytes: () => bytes, bits, active: ACTIVE,
  };
})();

// Wrap the sprite chooser (outermost: directions.js and lighting.js are inside it,
// so side/back views and emissive frames are preserved whenever nothing is
// happening), the per-creature tick and the engine's render.
(() => {
  const _dir = animDirectionalSprite;
  animDirectionalSprite = function (e) {
    const r = _dir(e);
    try {
      if (!GFX.enemyFx || !e || e.kind !== 'enemy' || e.deathArt || e.dead || e.dying || !r || !r.sprite) return r;
      return ENEMY_FX.choose(e, r);
    } catch (err) { return r; }
  };
  const _creature = animCreature;
  animCreature = function (e, dt, T) {
    _creature(e, dt, T);
    try { if (GFX.enemyFx) ENEMY_FX.tick(e, dt, T); } catch (err) { /* never break a tick */ }
  };
  const _render = Engine.render;
  Engine.render = function (ents, tod, opts) {
    const r = _render.call(Engine, ents, tod, opts);
    try { if (GFX.enemyFx) ENEMY_FX.drawBits(ANIM.dt || 0.016); } catch (err) { /* never break a frame */ }
    return r;
  };
})();
