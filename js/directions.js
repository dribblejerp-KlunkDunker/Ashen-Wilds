// ============================================================
//  directions — five-angle enemies for every species (Phase 2)
//  The Proctor keeps its hand-drawn pilot views (anim.js). Every other enemy
//  gets front-side / side / back-side / back views derived from its CURRENT
//  pose frame (idle, walk or attack), so a walking hound is still a walking
//  hound from behind. These are procedural STAND-INS: final painted
//  directional action sheets replace them without changing this contract.
//  Opposite obliques are never stored twice: animViewAngle reports a flip.
// ============================================================
'use strict';

if (GFX.directions === undefined) GFX.directions = true;
if (!GFX.FX.includes('directions')) GFX.FX.push('directions');

const DIRECTIONS = (() => {
  const CAP = 4 * 1024 * 1024;           // memory budget for derived views
  const POSES = ['', '_w1', '_w2', '_a1', '_a2'];
  // Blobs and swarms have no front or back: they keep their one drawing.
  const SYMMETRIC = new Set(['mites', 'hushmoth', 'horn']);
  // Painted in profile already, so the "front" art keeps most of its width.
  const PROFILE = new Set(['hound', 'weaverling', 'broodmother']);
  // Per view: width squeeze, darkness, one-sided shade (dark edge, lit edge),
  // mirror (a back view swaps left and right), how much of the back rules apply.
  const VIEWS = {
    biped: [null,
      { k: 0.84, dark: 0.97, shade: [0.86, 1.03], mirror: false, back: 0 },
      { k: 0.62, dark: 0.92, shade: [0.70, 1.06], mirror: false, back: 0 },
      { k: 0.76, dark: 0.80, shade: [0.74, 0.98], mirror: true, back: 0.6 },
      { k: 0.90, dark: 0.66, shade: [0.88, 0.92], mirror: true, back: 1 }],
    profile: [null,
      { k: 0.93, dark: 0.97, shade: [0.88, 1.03], mirror: false, back: 0 },
      { k: 1.0, dark: 0.92, shade: [0.72, 1.06], mirror: false, back: 0 },
      { k: 0.78, dark: 0.80, shade: [0.74, 0.98], mirror: true, back: 0.6 },
      { k: 0.62, dark: 0.66, shade: [0.88, 0.92], mirror: true, back: 1 }],
  };

  const cache = new Map();      // sprite name -> array(5 views * 5 poses) of entries
  const tones = new WeakMap();  // source sprite -> { hair, body } replacement tones
  let bytes = 0, stamp = 0;

  const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;

  // Dark garment / hair colours of a sprite: what a face or a light turns into
  // once you are looking at the back of the head.
  function toneOf(src) {
    let t = tones.get(src); if (t) return t;
    const { w, h, data } = src, head = h * 0.3;
    let hr = 0, hg = 0, hb = 0, hn = 0, br = 0, bg = 0, bb = 0, bn = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = data[y * w + x]; if ((p >>> 24) < 160) continue;
      const r = p & 255, g = (p >>> 8) & 255, b = (p >>> 16) & 255, l = lum(r, g, b);
      if (l < 22 || l > 105 || isGlow(r, g, b)) continue;
      br += r; bg += g; bb += b; bn++;
      if (y < head) { hr += r; hg += g; hb += b; hn++; }
    }
    t = { body: bn ? [br / bn, bg / bn, bb / bn] : [58, 54, 58], hair: null };
    t.hair = hn > 8 ? [hr / hn, hg / hn, hb / hn] : t.body;
    tones.set(src, t); return t;
  }
  function isGlow(r, g, b) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return (mx > 150 && (mx - mn) / mx > 0.5) || lum(r, g, b) > 225;
  }
  function isSkin(r, g, b) {
    const d = r - b, l = lum(r, g, b);
    return r >= g && g >= b * 0.95 && d > 18 && d < 100 && l > 80 && l < 235 && g > r * 0.55;
  }

  function build(src, spec, quad) {
    const { w, h, data } = src;
    const nw = Math.max(8, Math.round(w * spec.k));
    const out = new Uint32Array(nw * h);
    const cxs = (src.cx == null ? 0.5 : src.cx) * w, cxd = (src.cx == null ? 0.5 : src.cx) * nw;
    const step = 1 / (nw / w);                       // source columns per output column
    const tone = spec.back > 0 ? toneOf(src) : null;
    const head = h * 0.3, d0 = spec.shade[0], d1 = spec.shade[1];
    for (let x = 0; x < nw; x++) {
      const ox = spec.mirror ? nw - 1 - x : x;       // where this column lands
      const c = cxs + (x - cxd) * step;
      let a = Math.floor(c - step * 0.5 + 0.5), z = Math.max(a + 1, Math.floor(c + step * 0.5 + 0.5));
      if (a < 0) a = 0; if (z > w) z = w; if (a >= z) continue;
      // light falls from the leading edge: the far edge of the body is darker
      const t = nw > 1 ? x / (nw - 1) : 0.5;
      const sh = (d0 + (d1 - d0) * t) * spec.dark;
      for (let y = 0; y < h; y++) {
        let r = 0, g = 0, b = 0, wt = 0, am = 0;
        for (let i = a; i < z; i++) {
          const p = data[y * w + i], al = p >>> 24; if (al < 100) continue;
          if (al > am) am = al;
          r += (p & 255) * al; g += ((p >>> 8) & 255) * al; b += ((p >>> 16) & 255) * al; wt += al;
        }
        if (!wt) continue;
        r /= wt; g /= wt; b /= wt;
        if (tone && (isGlow(r, g, b) || (y < head && isSkin(r, g, b)))) {
          // the face and the lights are on the other side of the creature
          const to = y < head ? tone.hair : tone.body, n = ((x * 7 + y * 13) & 15) - 8, k = Math.min(1, spec.back * 1.4);
          r += (to[0] + n - r) * k; g += (to[1] + n - g) * k; b += (to[2] + n - b) * k;
        }
        let f = sh;
        // a stitched seam down the spine (bipeds only) makes the back read as a back
        if (spec.back >= 1 && !quad && y > h * 0.2 && y < h * 0.8 && Math.abs(x - nw * 0.5) < 0.8 + step * 0.4) f *= 0.74;
        r *= f; g *= f; b *= f;
        out[y * nw + ox] = ((am << 24) | ((b > 255 ? 255 : b) << 16) | ((g > 255 ? 255 : g) << 8) | (r > 255 ? 255 : r)) >>> 0;
      }
    }
    return { w: nw, h, data: out, hs: src.hs, cx: src.cx, dy: src.dy };
  }

  function evict(need) {
    while (bytes + need > CAP) {
      let oldest = null, list = null, idx = -1;
      for (const arr of cache.values()) for (let i = 0; i < arr.length; i++) { const en = arr[i]; if (en && (!oldest || en.used < oldest.used)) { oldest = en; list = arr; idx = i; } }
      if (!oldest) return;
      bytes -= oldest.sprite.data.byteLength; list[idx] = null;
    }
  }

  function view(spriteName, v, pose) {
    const base = Engine.sprites[spriteName];
    const src = (pose && Engine.sprites[spriteName + pose]) || base;
    try {
      if (!src || !v || v < 1 || v > 4 || SYMMETRIC.has(spriteName)) return src;
      if (spriteName === 'proctor') return animProctorView(v, pose || '');   // the hand-drawn pilot stays authoritative
      let pi = POSES.indexOf(pose || ''); if (pi < 0) pi = 0;
      let arr = cache.get(spriteName); if (!arr) { arr = new Array(25).fill(null); cache.set(spriteName, arr); }
      const slot = v * 5 + pi, hit = arr[slot];
      if (hit && hit.src === src) { hit.used = ++stamp; return hit.sprite; }
      if (hit) { bytes -= hit.sprite.data.byteLength; arr[slot] = null; }
      const quad = PROFILE.has(spriteName);
      const sprite = build(src, VIEWS[quad ? 'profile' : 'biped'][v], quad);
      const size = sprite.data.byteLength; evict(size);
      arr[slot] = { src, sprite, used: ++stamp }; bytes += size;
      return sprite;
    } catch (err) { return src; }
  }

  function species() {
    const seen = new Set(), list = [];
    for (const k in ENEMIES) {
      const s = ENEMIES[k].sprite; if (seen.has(s) || !Engine.sprites[s]) continue; seen.add(s);
      list.push({ sprite: s, pilot: s === 'proctor', symmetric: SYMMETRIC.has(s), profile: PROFILE.has(s) });
    }
    return list;
  }
  function clear() { cache.clear(); bytes = 0; }

  return { view, species, budgetBytes: () => bytes, cap: CAP, symmetric: SYMMETRIC, clear };
})();

// Wrap the engine's sprite chooser. The Proctor pilot and every non-enemy path
// (corpses, fire, scenery, NPCs, companions) pass through untouched.
(() => {
  const _dir = animDirectionalSprite;
  animDirectionalSprite = function (e) {
    const r = _dir(e);
    try {
      if (!GFX.directions || e.kind !== 'enemy' || e.deathArt || e.sprite === 'proctor') return r;
      const angle = animViewAngle(e);
      if (angle.view === 0) return r;
      const pose = e.animSprite ? e.animSprite.slice(e.sprite.length) : '';
      const sprite = DIRECTIONS.view(e.sprite, angle.view, pose);
      return sprite ? { sprite, flip: angle.flip } : r;
    } catch (err) { return r; }
  };
})();
