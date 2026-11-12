// ============================================================
//  lighting — emissive highlights and torch-driven interiors (Phase 2)
//  1. Emissive masks (GFX.emissive): Kaelen's glass arm, shard/lens glass,
//     lamp and hearth/campfire flame pixels draw at near-full brightness
//     through Engine.setEmissive, however dark the room around them is.
//  2. Torch-driven darkness (GFX.darkInteriors): interiors get a lower
//     ambient floor so rooms are lit by lamps, hearths and glass, and the
//     player's lantern (UPG.lantern) becomes a warm light around the player,
//     indoors and out at night. Every effect is fully off with its flag off.
//  Masks are computed ONCE per sprite from its decoded pixels by colour rule.
// ============================================================
'use strict';

if (GFX.emissive === undefined) GFX.emissive = true;
if (!GFX.FX.includes('emissive')) GFX.FX.push('emissive');
if (GFX.darkInteriors === undefined) GFX.darkInteriors = true;
if (!GFX.FX.includes('darkInteriors')) GFX.FX.push('darkInteriors');

const LIGHTING = (() => {
  // Which pixels of which sprite glow. Procedural rules over the decoded art.
  const hueOf = (r, g, b) => {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0;
    const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return ((h * 60) + 360) % 360;
  };
  const RULES = {
    // Light-glass: cyan through green-gold, saturated and not dark
    glass: (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx < 120 || (mx - mn) / mx < 0.3) return false; const h = hueOf(r, g, b); return h >= 65 && h <= 200; },
    // lamp panes, flames and embers: warm and bright
    warm: (r, g, b) => r > 175 && r > g * 1.12 && g > b * 1.25 && 0.3 * r + 0.59 * g + 0.11 * b > 135,
    // the purple core crystals of the prismatic lens
    crystal: (r, g, b) => b > g * 1.25 && r > g * 1.05 && Math.max(r, g, b) > 130 && (Math.max(r, g, b) - g) / Math.max(r, g, b) > 0.3,
  };
  // the hearth's fire is mostly embers: dimmer and paler than a lamp flame
  RULES.ember = (r, g, b) => r > 145 && r > g * 1.12 && g > b * 1.35 && 0.3 * r + 0.59 * g + 0.11 * b > 100;
  RULES.warmGlass = (r, g, b) => RULES.warm(r, g, b) || RULES.glass(r, g, b);
  const SPRITES = {
    kaelen: 'glass', kaelen_w1: 'glass', kaelen_w2: 'glass', kaelen_a1: 'glass', kaelen_a2: 'glass',
    coil: 'glass', cores: 'crystal', lamp: 'warmGlass', hearth: 'ember', campfire: 'warm',
  };
  const NAMES = Object.keys(SPRITES);
  const MASKS = new WeakMap();           // sprite object -> Uint8Array mask (or null when nothing glows)
  const FRAMES = new WeakMap();          // animated flame frame -> mask
  const framesTouched = [];              // flame frames we masked, to clear again
  const stats = {};                      // sprite name -> emissive pixel count

  function computeMask(sp, rule) {
    const test = RULES[rule], n = sp.w * sp.h, mask = new Uint8Array(n); let count = 0;
    for (let i = 0; i < n; i++) {
      const p = sp.data[i]; if ((p >>> 24) < 160) continue;
      if (test(p & 255, (p >>> 8) & 255, (p >>> 16) & 255)) { mask[i] = 1; count++; }
    }
    return count ? mask : null;
  }

  let applied = false;
  function syncMasks() {
    const on = !!GFX.emissive;
    for (let i = 0; i < NAMES.length; i++) {
      const name = NAMES[i], sp = Engine.sprites[name]; if (!sp) continue;
      let m = MASKS.get(sp);
      if (on) {
        if (m === undefined) { m = computeMask(sp, SPRITES[name]); MASKS.set(sp, m); stats[name] = m ? m.reduce((a, v) => a + v, 0) : 0; }
        if (m && sp.emit !== m) Engine.setEmissive(name, m);
      } else if (sp.emit && sp.emit === m) Engine.setEmissive(name, null);
    }
    if (!on && applied) { for (const f of framesTouched) if (f.emit && f.emit === FRAMES.get(f)) f.emit = null; framesTouched.length = 0; }
    applied = on;
  }

  // ---- torch-driven interiors ------------------------------------------
  const INTERIOR_K = 0.45, AMBIENT_FLOOR = 0.06;
  let lastK = 1;
  const lantern = { x: 0, y: 0, r: 6, cr: 44, cg: 28, cb: 8, occlude: false };
  // the engine's own night curve, so an outdoor lantern fades in with dusk
  const dayness = tod => Math.max(0, Math.min(1, (Math.cos((tod - 0.5) * Math.PI * 2) + 0.3) / 1.3));

  function interiorK() {
    const m = typeof G !== 'undefined' && G.map; if (!m || m.outdoor || !GFX.darkInteriors) return 1;
    const amb = m.ambient || 0;
    // never darker than a small floor: a dark room is still a playable room
    return amb > 0 ? Math.min(1, Math.max(INTERIOR_K, AMBIENT_FLOOR / amb)) : 1;
  }
  function lanternLight() {
    if (!GFX.darkInteriors || typeof UPG === 'undefined' || !UPG.lantern) return null;
    const c = Engine.cam, m = G.map, outdoor = m && m.outdoor;
    const night = outdoor ? 1 - dayness(G.tod == null ? 0.5 : G.tod) : 1;
    const k = outdoor ? 0.12 + 0.88 * night : 1;
    if (k < 0.15) return null;
    const flick = 0.95 + 0.05 * Math.sin((typeof ANIM !== 'undefined' ? ANIM.T : 0) * 7.3);
    lantern.x = c.x + Math.cos(c.dir) * 0.35; lantern.y = c.y + Math.sin(c.dir) * 0.35;
    const g = (outdoor ? 1.6 : 1) * k * flick;   // open air swallows light, so the lantern burns brighter out there
    lantern.cr = 44 * g; lantern.cg = 28 * g; lantern.cb = 8 * g; lantern.r = outdoor ? 5 + 1 * night : 6;
    return lantern;
  }

  function frameSetup() {
    syncMasks();
    const k = interiorK();
    if (k !== lastK) { Engine.setLook({ ambientK: k }); lastK = k; }
  }

  // ---- the dark itself: a post pass over interior frames --------------------
  // The engine's own falloff leaves everything near the player fully lit, so a
  // room never feels dark. This pass dims interior pixels to FLOOR and lifts
  // them back toward full brightness near a light (lamp, hearth, glass, lantern),
  // honouring each light's occlusion mask. Light strength is sampled on a coarse
  // grid (CELL px) and interpolated, so it costs a fraction of a millisecond.
  const FLOOR = 0.45, CELL = 4, EX_MAX = 16384;
  const exIdx = new Int32Array(EX_MAX), exPx = new Uint32Array(EX_MAX);
  // Glowing pixels must survive the dimming. Find them through the entities that
  // are on screen: the engine leaves each one's screen rect in e._screen, and the
  // mask says which texels glow. Their pixels are saved here and put back after.
  function saveGlowing(F) {
    let n = 0; const ents = G.ents, S = F.S || 1, w = F.w, h = F.h;
    if (!ents || !GFX.emissive) return 0;
    for (let i = 0; i < ents.length && n < EX_MAX; i++) {
      const e = ents[i], sc = e._screen;
      if (!sc || e.hidden) continue;
      const base = Engine.sprites[e.sprite]; if (!base || !base.emit) continue;   // only sprites that carry a mask can glow
      const art = animDirectionalSprite(e), sp = art && art.sprite, emit = sp && sp.emit; if (!emit) continue;
      const dsX = sc.x0 * S, dsY = sc.y0 * S, deY = sc.y1 * S, sprW = Math.max(1, (sc.x1 - sc.x0) * S), sprH = Math.max(1, deY - dsY);
      const skew = e.animSkew || 0, tw = sp.w, th = sp.h, z = sc.z;
      const ys = Math.max(0, dsY | 0), ye = Math.min(h - 1, deY | 0);
      const xs = Math.max(0, (dsX - Math.abs(skew) * sprH) | 0), xe = Math.min(w - 1, (dsX + sprW + Math.abs(skew) * sprH) | 0);
      for (let y = ys; y <= ye; y++) {
        const ty = (((y - dsY) * th) / sprH) | 0; if (ty < 0 || ty >= th) continue;
        for (let x = xs; x <= xe; x++) {
          const o = y * w + x; if ((F.mbuf[o] !== 6 && F.mbuf[o] !== 8) || Math.abs(F.dbuf[o] - z) > 1e-3) continue;
          const sx = skew ? x - skew * (deY - y) : x;
          let tx = (((sx - dsX) * tw) / sprW) | 0; if (tx < 0 || tx >= tw) continue;
          if (art.flip) tx = tw - 1 - tx;
          if (emit[ty * tw + tx] && n < EX_MAX) { exIdx[n] = o; exPx[n] = F.fb[o]; n++; }
        }
      }
    }
    return n;
  }
  let gw = 0, gh = 0, grid = null, rowBuf = null, w0 = 0, h0 = 0, stat = { ms: 0, lights: 0, ran: 0, glow: 0 };
  function darken(F) {
    if (F.outdoor || !GFX.darkInteriors) return;
    const lights = F.ptLights; if (!lights || !F.dbuf) return;
    const t0 = performance.now();
    const w = F.w, h = F.h, S = F.S || 1, cell = CELL * S;
    if (w !== w0 || h !== h0) { w0 = w; h0 = h; gw = Math.ceil(w / cell) + 1; gh = Math.ceil(h / cell) + 1; grid = new Float32Array(gw * gh); rowBuf = new Float32Array(gw); }
    // light strength per light: how much it counts as a "real" light
    const n = lights.length, dbuf = F.dbuf, camx = F.cam.x, camy = F.cam.y;
    const dX = F.dirX, dY = F.dirY, pX = F.planeX, pY = F.planeY;
    for (let gy = 0; gy < gh; gy++) {
      const py = Math.min(h - 1, gy * cell);
      for (let gx = 0; gx < gw; gx++) {
        const px = Math.min(w - 1, gx * cell), depth = dbuf[py * w + px], gi = gy * gw + gx;
        if (depth >= 1e8) { grid[gi] = 1; continue; }
        const s = 2 * px / w - 1, wx = camx + (dX + pX * s) * depth, wy = camy + (dY + pY * s) * depth;
        let sum = 0;
        for (let i = 0; i < n; i++) {
          const L = lights[i], dx = wx - L.x, dy = wy - L.y, d2 = dx * dx + dy * dy, r2 = L.r * L.r;
          if (d2 >= r2) continue;
          if (L.vis) { const ci = (wx | 0) - L.vox, cj = (wy | 0) - L.voy; if (ci < 0 || cj < 0 || ci >= L.vd || cj >= L.vd || L.vis[cj * L.vd + ci] !== 1) continue; }
          const k = 1 - d2 / r2, str = (L.cr + L.cg + L.cb) * (1 / 100);
          sum += k * (str > 1 ? 1 : str) * 1.35;   // the 1.35 lets a lamp's glow reach full brightness before its rim
        }
        grid[gi] = FLOOR + (1 - FLOOR) * (sum > 1 ? 1 : sum);
      }
    }
    const fb = F.fb, inv = 1 / cell, kept = saveGlowing(F);
    for (let y = 0; y < h; y++) {
      const fy = y * inv, gy0 = fy | 0, wy = fy - gy0, o0 = gy0 * gw, o1 = Math.min(gh - 1, gy0 + 1) * gw;
      for (let gx = 0; gx < gw; gx++) rowBuf[gx] = grid[o0 + gx] * (1 - wy) + grid[o1 + gx] * wy;
      let o = y * w;
      for (let x = 0; x < w; x++, o++) {
        const fx = x * inv, gx0 = fx | 0, wx = fx - gx0, f = rowBuf[gx0] * (1 - wx) + rowBuf[gx0 + 1 > gw - 1 ? gw - 1 : gx0 + 1] * wx;
        if (f >= 0.999) continue;
        const px = fb[o], k = (f * 256) | 0;
        fb[o] = (px & 0xff000000) | ((((px >>> 16) & 255) * k >> 8) << 16) | ((((px >>> 8) & 255) * k >> 8) << 8) | (((px & 255) * k) >> 8);
      }
    }
    for (let i = 0; i < kept; i++) fb[exIdx[i]] = exPx[i];
    stat.ms = performance.now() - t0; stat.glow = kept; stat.lights = n; stat.ran++;
  }
  Engine.addPostHook(darken, -5);

  return { syncMasks, frameSetup, darken, computeMask, rule: name => SPRITES[name] || 'warm', stat, FLOOR, lanternLight, interiorK, stats, names: NAMES, masks: MASKS, frames: FRAMES, framesTouched, lantern };
})();

// Flame frames are fresh sprite objects (anim.js moves the flame pixels), so
// each one gets its own mask, cut from its own pixels the first time it is seen.
// So does a turned view of a masked sprite (Kaelen's rigged side from js/people25.js,
// shown by js/pixel3d.js): the glass arm glows from every side it is seen from.
(() => {
  const _dir = animDirectionalSprite;
  const masked = new Set(LIGHTING.names);
  const turned = (e, sp) => masked.has(e.sprite) && sp !== Engine.sprites[e.sprite] && !(e.animSprite && sp === Engine.sprites[e.animSprite]);
  animDirectionalSprite = function (e) {
    const r = _dir(e);
    try {
      if (GFX.emissive && r && r.sprite && ((ANIM.fire.has(e.sprite) && e.kind !== 'enemy') || turned(e, r.sprite))) {
        const sp = r.sprite;
        if (!LIGHTING.frames.has(sp)) {
          const m = LIGHTING.computeMask(sp, LIGHTING.rule(e.sprite));
          LIGHTING.frames.set(sp, m); sp.emit = m; if (m) LIGHTING.framesTouched.push(sp);
        } else if (sp.emit !== LIGHTING.frames.get(sp)) { sp.emit = LIGHTING.frames.get(sp); if (sp.emit && !LIGHTING.framesTouched.includes(sp)) LIGHTING.framesTouched.push(sp); }
      }
    } catch (err) { /* never break a frame */ }
    return r;
  };
})();

// The render wrapper: masks, interior darkness and the lantern. Loaded after
// the other wrappers, so it is the outermost; opts reach the engine unchanged
// apart from playerLight, which only appears while the lantern burns.
(() => {
  const _r = Engine.render;
  Engine.render = function (ents, tod, opts) {
    let opts2 = opts;
    try {
      LIGHTING.frameSetup();
      const light = LIGHTING.lanternLight();
      if (light) opts2 = Object.assign({}, opts, { playerLight: light });
    } catch (err) { opts2 = opts; }
    return _r.call(this, ents, tod, opts2);
  };
  // The lantern has had a key binding (U) but no handler: wire it here.
  window.addEventListener('keydown', (ev) => {
    try {
      if (ev.repeat || (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA'))) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const key = (UPG.keybinds && UPG.keybinds.lantern || 'u').toLowerCase();
      if (ev.key.toLowerCase() !== key || G.state !== 'play' || G.openPanel) return;
      UPG.lantern = !UPG.lantern;
      if (typeof msg === 'function') msg(UPG.lantern ? 'You light the lantern.' : 'You douse the lantern.', 'info', 1400);
    } catch (err) { /* a key press must never throw */ }
  });
  GFX.onChange(() => { try { LIGHTING.syncMasks(); } catch (err) { /* ignore */ } });
})();
