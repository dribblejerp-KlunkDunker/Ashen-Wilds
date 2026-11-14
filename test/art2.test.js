// node test/art2.test.js               (add --no-browser to run only the half that needs no browser)
// NODE_PATH=$(npm root -g) node test/art2.test.js        with Playwright installed globally
// Phase 2, our own art: the Shattered Octave's pictures are out of the repository, and what replaces them is made in
// code. This checks that nothing embedded or copied remains, that every tile, figure and thing is the size and kind
// the engine needs, that the engine's rig can measure the two people, and, in a browser, that the game draws them.
// What it cannot check: whether the paintings are any good. tools/shots.js writes the stills for that.
'use strict';
const path = require('path'), fs = require('fs'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const A = require(path.join(ROOT, 'js', 'art2.js')), PF = require(path.join(ROOT, 'js', 'paintfolk76.js'));
let fails = 0;
const check = (cond, label) => { if (cond) console.log('PASS ' + label); else { fails++; console.log('FAIL ' + label); } };
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const P = A.paint(), lum = A.lum, solid = (v) => (v >>> 24) >= 128;

// ---- nothing of the Octave's is left
const assets = new Function(read('js/assets.js') + ';return ASSETS')();
check(['tex', 'spr', 'fp', 'meta'].every((k) => assets[k] && Object.keys(assets[k]).length === 0), 'the engine\'s table of embedded pictures is empty');
check(read('js/assets.js').length < 800, 'and the file that held 2.4 MB of them is a few lines');
check(Object.keys(new Function(read('js/painted-manifest.js') + ';return PAINTED_MANIFEST')()).length === 0, 'the list of painted picture files is empty too');
const walk = (dir, out) => { for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) { if (e.name === '.git' || e.name === 'node_modules') continue; const p = dir ? dir + '/' + e.name : e.name; if (e.isDirectory()) walk(p, out); else out.push(p); } return out; };
const all = walk('', []), pics = all.filter((f) => /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(f));
const mine = (f) => f === 'img/title.png' || /^img\/p_la_\w+\.jpg$/.test(f) || /^assets\/icons\/[\w-]+\.png$/.test(f) || /^docs\/screenshots\/\w+\.(png|gif)$/.test(f);   // stills, and clips of this game played (Phase 4)
check(pics.length > 0 && pics.every(mine), 'every picture file is a still or clip of this game, a portrait cut from it, or its own icon: ' + (pics.filter((f) => !mine(f)).join(' ') || pics.length + ' files'));
check(!all.some((f) => /\.(mp3|ogg|wav|m4a|flac)$/i.test(f)), 'no sound file is shipped');
const big = []; for (const f of all.filter((f) => /\.(js|css|html|json|webmanifest)$/.test(f) && !/vendor\//.test(f))) { const m = read(f).match(/base64,[A-Za-z0-9+/=]{200,}/g); if (m) big.push(f); }
check(big.length === 0, 'no picture is embedded as base64 in any script, style or page: ' + (big.join(' ') || 'none'));
check(!fs.existsSync(path.join(ROOT, 'js', 'pixel3d.js')) && !/pixel3d/.test(read('index.html')), 'the module that fetched the Octave\'s prop renders is gone');
const src = read('js/art2.js');
check(!/Math\.random|Date\.now|performance\.now/.test(src), 'the painters use no random number and no clock');
const again = (() => { delete require.cache[require.resolve(path.join(ROOT, 'js', 'art2.js'))]; return require(path.join(ROOT, 'js', 'art2.js')).paint(); })();
check(Object.keys(P.sprites).every((k) => P.sprites[k].data.every((v, i) => v === again.sprites[k].data[i])) && Object.keys(P.tiles).every((k) => P.tiles[k].every((v, i) => v === again.tiles[k][i])) && P.hand.data.every((v, i) => v === again.hand.data[i]), 'painted twice, every picture is the same to the pixel');

// ---- the tiles
const ENGINE_NAMES = ['t_stone', 't_flag', 't_wood', 't_house', 't_roof', 't_hedge', 't_cobble', 't_glassrock', 't_marble', 't_grass', 't_door', 't_brass', 't_water', 't_shallows', 't_greymarble', 't_catacomb', 't_mausoleum', 't_deepwood', 't_moss'];
check(ENGINE_NAMES.every((n) => P.tiles[A.TILE_OF[n]]) && Object.keys(A.TILE_OF).length === 19, 'each of the engine\'s nineteen tile names has a tile');
check(Object.keys(P.tiles).length === 8 && Object.values(P.tiles).every((d) => d instanceof Uint32Array && d.length === 4096 && d.every(solid)), 'eight tiles, each 64 x 64 and solid: ' + Object.keys(P.tiles).join(' '));
const mean = (d) => { let m = 0; for (const v of d) m += lum(v); return m / d.length; };
check(Object.values(P.tiles).every((d) => mean(d) < 190), 'all of them are dark: black is the base colour (brightest mean ' + Math.max(...Object.values(P.tiles).map(mean)).toFixed(0) + ' of 765)');
check(new Set(Object.values(P.tiles).map((d) => d.join(',').length + ':' + d[77] + ':' + d[2040])).size === 8, 'and no two are the same picture');
for (const k of Object.keys(P.tiles)) { const d = P.tiles[k], n = new Set(d).size; if (n < 3 || n > 16) check(false, k + ' uses a pixel-art palette (3 to 16 colours): ' + n); }
check(true, 'each tile keeps to a small palette');

// ---- the people
const { la_carter: C, la_marget: M } = P.sprites;
const bounds = (sp) => { let top = 1e9, bot = -1, l = 1e9, r = -1, n = 0; for (let y = 0; y < sp.h; y++) for (let x = 0; x < sp.w; x++) if (solid(sp.data[y * sp.w + x])) { n++; top = Math.min(top, y); bot = Math.max(bot, y); l = Math.min(l, x); r = Math.max(r, x); } return { top, bot, l, r, n }; };
for (const [name, sp] of [['the carter', C], ['Marget Sayle', M]]) {
  const b = bounds(sp);
  check(sp.h === 160 && sp.w >= 50 && sp.w <= 70 && b.top <= 3 && b.bot >= 156, name + ' is one front-view painting, 160 high, head to foot (' + sp.w + ' x ' + sp.h + ', ' + b.n + ' pixels painted)');
  check(sp.data.every((v) => (v >>> 24) === 0 || (v >>> 24) === 255) && new Set(sp.data).size <= 64, name + ' has hard edges and a small palette (' + new Set(sp.data).size + ' colours)');
  const mid = (b.l + b.r) / 2; check(Math.abs(mid - (sp.w - 1) / 2) <= 1.5, name + ' stands in the middle of the picture');
}
check(![60, 66, 53].includes(C.w) && ![60, 66, 53].includes(M.w), 'neither is the width of one of the engine\'s hand-rigged paintings, so neither borrows that rig');
const rc = PF.autorig(C), rm = PF.autorig(M), parts = (r) => r.parts.map((p) => p[0]);
check(rc && rc.auto === 'trousers' && !rc.armsFixed && ['armUR', 'armFR', 'armUL', 'armFL', 'thighR', 'shinR', 'thighL', 'shinL', 'head', 'torso'].every((p) => parts(rc).includes(p)), 'the rig measures the carter by itself: head, torso, two arms and two legs that each move (' + (rc ? parts(rc).length : 0) + ' parts)');
check(rm && rm.auto === 'robe' && rm.armsFixed && parts(rm).includes('skirt') && parts(rm).includes('head'), 'and Marget Sayle as one piece in a gown: she moves as the old do, hands held');
check(rc && rm && Math.abs(rc.cx - (C.w - 1) / 2) < 1.5 && rc.J.neck[1] > 14 && rc.J.neck[1] < 32 && rc.J.kneeR[1] > 100 && rc.J.ankleR[1] > 140, 'the carter\'s joints are found where a body has them (neck ' + (rc ? rc.J.neck[1] : '?') + ', knee ' + (rc ? rc.J.kneeR[1] : '?') + ', ankle ' + (rc ? rc.J.ankleR[1] : '?') + ' of 160)');
const skinny = (sp, y0, y1) => { let n = 0; for (let y = y0; y <= y1; y++) for (let x = 0; x < sp.w; x++) { const v = sp.data[y * sp.w + x]; if (solid(v) && (v & 255) > ((v >> 16) & 255) + 25 && (v & 255) > 80) n++; } return n; };
check(skinny(C, 4, 22) > 40 && skinny(M, 4, 24) > 30, 'each has a face of skin in its hood');

// ---- the things
const { la_hearth: HE, la_bed: BE, la_table: TA, la_mark: MK } = P.sprites;
const glow = HE.emit ? HE.emit.reduce((a, v) => a + v, 0) : 0;
check(glow > 40 && glow < 500 && !BE.emit && !TA.emit && !C.emit && !M.emit, 'only the fire gives light: ' + glow + ' of the hearth\'s pixels glow');
let hot = 0; for (let i = 0; i < HE.data.length; i++) if (HE.emit[i] && (HE.data[i] & 255) > 110 && (HE.data[i] & 255) >= ((HE.data[i] >> 8) & 255) && (HE.data[i] & 255) > ((HE.data[i] >> 16) & 255) * 1.5) hot++;
check(hot === glow, 'and every glowing pixel is ember red or tallow yellow, never blue or teal');
check(HE.hs < 0.5 && BE.hs < 0.8 && TA.hs < 0.5 && bounds(BE).n > 5000 && bounds(TA).n > 1200, 'a low fire, a box bed and a board on two stones, each smaller than a person');
check(MK.data.every((v) => v === 0), 'the mark a label hangs on shows nothing');

// ---- the hand
const H = P.hand, glove = [[26, 132], [48, 126], [62, 140], [99, 152], [99, 190], [52, 190], [24, 168]];
const inside = (x, y, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
let inG = 0, fill = 0; for (let y = 120; y < 190; y++) for (let x = 0; x < 99; x++) if (inside(x + 0.5, y + 0.5, glove)) { inG++; if (solid(H.data[y * 99 + x])) fill++; }
check(H.w === 99 && H.h === 190, 'the hand is the size the engine draws a held weapon at (99 x 190)');
let skinAll = 0, skinIn = 0; for (let y = 120; y < 190; y++) for (let x = 0; x < 99; x++) { const v = H.data[y * 99 + x]; if (solid(v) && (v & 255) > ((v >> 16) & 255) + 25 && (v & 255) > 80) { skinAll++; if (inside(x + 0.5, y + 0.5, glove)) skinIn++; } }
check(skinAll > 250 && skinIn / skinAll > 0.85 && fill / inG > 0.45, 'the fist lies where the engine expects a hand, so its gear colours land on it (' + (skinIn / skinAll * 100).toFixed(0) + '% of the skin is inside that region)');
let rightEdge = 0, bottom = 0; for (let y = 0; y < 190; y++) if (solid(H.data[y * 99 + 98])) rightEdge++; for (let x = 0; x < 99; x++) if (solid(H.data[189 * 99 + x])) bottom++;
check(rightEdge === 0 && bottom > 20, 'the arm leaves through the bottom of the picture, never its side, so no cut edge shows in the view');
let blade = 0, glim = 0; for (let y = 0; y < 124; y++) for (let x = 0; x < 99; x++) { const v = H.data[y * 99 + x]; if (!solid(v)) continue; blade++; if (((v >> 16) & 255) > (v & 255) + 30) glim++; }
check(blade > 500 && bounds(H).top <= 8, 'a blade stands above it, nearly to the top of the picture');
check(glim >= 6 && glim <= 14, 'with one small pale-blue mark on it, a working\'s colour (O4): ' + glim + ' pixels');

// ---- the icons and the page
const ic = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'icons.js'), '--check'], { cwd: ROOT, encoding: 'utf8' });
check(ic.status === 0, 'the app icons are the game\'s own mark, and current (node tools/icons.js --check)');
const mk = A.mark(64); let dark = 0, fire = 0; for (const v of mk) { if (lum(v) < 60) dark++; if ((v & 255) > 150) fire++; }
check(dark / 4096 > 0.6 && fire > 150, 'the mark is a dark disc in a burning ring on black');
const html = read('index.html'), files = [...html.matchAll(/<script[^>]*\bsrc="([^"?]+)/g)].map((m) => m[1]);
check(files.indexOf('js/art2.js') === files.indexOf('js/ledge1.js') - 1, 'the page loads this file just before the ledge');
check(/rel="icon"[^>]*circle/.test(html) && !/M16 3 L26 24/.test(html), 'the tab icon is the coal sun, not the old game\'s mark');
const ledge = read('js/ledge1.js');
check(!/'townsman'|'townswoman'|'hearth'|'bed'|'table'|'sign'/.test(ledge) && /la_carter/.test(ledge) && /la_marget/.test(ledge), 'the ledge asks for none of the old sprites by name');

// ---- in a browser
(async () => {
  const HN = require('./harness.js');
  if (process.argv.includes('--no-browser') || !HN.playwright()) { console.log('SKIPPED the browser half of this test (no Playwright: set PLAYWRIGHT_MODULE or NODE_PATH)'); return; }
  const s = await HN.open();
  try {
    await HN.begin(s.page);
    const r = await s.page.evaluate(() => {
      const out = {}, fnv = (d) => { let x = 0x811c9dc5 | 0; for (let i = 0; i < d.length; i++) x = Math.imul(x ^ d[i], 16777619) | 0; return x >>> 0; };
      out.embedded = Object.keys(ASSETS.tex).length + Object.keys(ASSETS.spr).length + Object.keys(ASSETS.fp).length;
      out.tiles = Object.keys(ART2.TILE_OF).filter((n) => !(Engine.textures[n] instanceof Uint32Array));
      out.sprites = ['la_carter', 'la_marget', 'la_hearth', 'la_bed', 'la_table', 'la_mark'].filter((n) => !Engine.sprites[n]);
      out.count = Object.keys(Engine.sprites).length;
      const h = Engine.images.fp_sword; out.hand = h ? [h.width, h.height, h.tagName] : null; out.weapon = typeof currentWeapon === 'function' ? currentWeapon().img : null;
      out.others = Object.keys(Engine.images);
      // the carter, moving
      out.has = [PAINTFOLK.has('la_carter'), PAINTFOLK.has('la_marget')];
      const fr = (a, f) => { const q = PAINTFOLK.frame('la_carter', a, f, 0); return q ? [q.w, q.h, fnv(new Uint8Array(q.data.buffer))] : null; };
      out.idle = fr('idle', 0); out.walk2 = fr('walk', 2); out.walk6 = fr('walk', 6); out.talk = fr('talk', 2);
      const side = PAINTFOLK.frame('la_carter', 'idle', 0, 2); out.side = side ? [side.w, side.h] : null;
      const e = G.ents.find((q) => q.kind === 'npc'); out.npc = e ? { sprite: e.sprite, name: e.name } : null;
      // the hearth lights the room
      loadMap(LEDGE1.BOTHY); advanceTime(400);
      const he = G.ents.find((q) => q.sprite === 'la_hearth'); out.hearth = he ? { light: he.lightCol, solid: he.solid } : null;
      out.inside = G.ents.filter((q) => q.sprite && !q.hidden).map((q) => q.sprite).sort();   // (the walking bloom's place in the room is hidden until it comes in: Phase 5)
      const pn = performance.now.bind(performance), t0 = pn(); performance.now = () => t0; G.state = 'play';
      const bright = () => { render(); render(); const p = R3D.readPixels(); let m = 0, n = 0; for (let i = 0; i < p.data.length; i += 16) { m += p.data[i] + p.data[i + 1] + p.data[i + 2]; n++; } return m / n; };
      out.lit = bright(); const keep = he.lightCol; he.lightCol = null; R3D.invalidate(); out.unlit = bright(); he.lightCol = keep; performance.now = pn;
      return out;
    });
    check(r.embedded === 0 && r.tiles.length === 0 && r.sprites.length === 0, 'in the running game no picture is embedded, and every tile and sprite it needs was painted (' + r.count + ' sprites in all)');
    check(r.hand && r.hand[0] === 99 && r.hand[1] === 190 && r.weapon === 'fp_sword', 'the hand on screen is this game\'s: ' + JSON.stringify(r.hand));
    check(r.npc && r.npc.sprite === 'la_carter' && r.has[0] && r.has[1], 'the carter on the ledge wears his own painting, and the rig has taken both people');
    check(r.idle && r.walk2 && r.walk6 && r.talk && new Set([r.idle[2], r.walk2[2], r.walk6[2], r.talk[2]]).size === 4, 'standing, two steps of a walk and talking are four different pictures of him');
    check(r.side && r.side[0] < r.idle[0], 'seen from the side he is narrower than from the front (' + (r.side || []).join(' x ') + ' against ' + r.idle.slice(0, 2).join(' x ') + ')');
    check(r.hearth && Array.isArray(r.hearth.light) && r.hearth.light[0] > r.hearth.light[2] * 3 && r.inside.join() === 'la_bar_lean,la_bed,la_hearth,la_marget,la_table', 'the bothy holds the bed, the fire, the table, the door bar (Phase 5) and Marget Sayle; the fire\'s light is red');
    check(r.lit > r.unlit * 1.15, 'the room is brighter with the fire than without it (' + r.lit.toFixed(1) + ' against ' + r.unlit.toFixed(1) + ')');
    check(s.errors.length === 0, 'no page errors: ' + (s.errors[0] || 'none'));
    const gone = [...s.missing].filter((p) => /pixel3d|painted|face_/.test(p));
    check(gone.length === 0, 'the game no longer asks for the prop renders, the painted files or the faces: ' + (gone.join(' ') || 'none asked for'));
    console.log('NOTE the engine still asks for ' + s.missing.size + ' of the old game\'s files that are not here: ' + [...s.missing].slice(0, 14).join(' '));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); }
  await s.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
