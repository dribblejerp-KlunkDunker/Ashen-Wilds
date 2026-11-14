// ============================================================
//  access — Phase 7: one Accessibility block, and a message catalog.
//  1. Accessibility (Options -> Graphics & access, "Accessibility" block):
//       Text size (Normal / Large / Largest), Reduce motion (GFX.reduceMotion),
//       No flashes (GFX.noFlash), High contrast, Sound captions.
//     The two switches that already existed (fp-feel's Reduce motion and No
//     flashes) are MOVED into the block, not duplicated, so there is one place.
//     Text size works on the stylesheets themselves: every rule that sets a
//     font-size in cqw/cqh/px is copied under `html.ac-ts` with the size
//     multiplied by --ac-ts, so panels, held documents' chrome, dialogue, the
//     messages and the touch buttons all scale; the canvas HUD keeps its size.
//     High contrast is a class (`html.ac-hc`) that only changes colours.
//     Reduce motion / No flashes reach the effects that never read the settings
//     through wrappers (creature idle motion, hit flashes, lamp flicker) and a
//     few CSS rules; see ACCESS.matrix for what honours what.
//  2. Messages: t(key, params) over locales/*.json. English is embedded here
//     (so file:// still works) and locales/en.json must equal it (the test checks).
//     Other catalogs are fetched on demand; a missing key falls back to English,
//     never to the key name, and is logged once. Catalog values are untrusted:
//     they are only ever written with nodeValue / textContent / setAttribute.
//     Translation walks the text nodes of the Options/menu/panel chrome and
//     swaps a node's text when it equals a known English catalog string (or an
//     English template such as "Graphics: {preset}"). Story prose is never in the
//     catalog, so it is never touched. No markup is built from catalog strings.
//  Settings: localStorage 'octave.access.v1' (text size, contrast, captions,
//  language). Reduce motion / No flashes persist through fp-feel's own key.
//  Everything off / Normal / English = the original game.
// ============================================================
'use strict';

const ACCESS = (() => {
  const KEY = 'octave.access.v1';
  const S = { ts: 0, hc: false, cap: false, loc: 'en' };
  const TS_SCALE = [1, 1.2, 1.4];
  const TS_NAMES = ['Normal', 'Large', 'Largest'];

  // ---------------------------------------------------------------- the English catalog
  // Chrome only: menus, headings, buttons, hints and common one-line messages. Each
  // English string appears once (the reverse index maps text back to a key).
  const EN = {
    'ui.close': 'Close', 'ui.back': 'Back', 'ui.back_options': 'Back to Options', 'ui.continue': 'Continue',
    'ui.on': 'On', 'ui.off': 'Off', 'ui.auto': 'Auto', 'ui.sing': 'Sing', 'ui.use': 'Use', 'ui.remove': 'Remove', 'ui.wear': 'Wear',
    'ui.ready': 'Ready', 'ui.copy_code': 'Copy code', 'ui.download_file': 'Download file', 'ui.save_here': 'Save here',
    'ui.how_to_play': 'How to play', 'ui.nothing_yet': 'Nothing yet.',
    'title.begin': 'Begin', 'title.load': 'Load a saved game',
    'title.subtitle': 'Book One · The Silenced Province',
    'title.tagline': 'A first-person role-playing game in the manner of 1996. Click to let the sound in.',
    'hud.songs': 'Songs', 'hud.run': 'Run', 'hud.cover': 'Cover', 'hud.body': 'Body', 'hud.throw': 'Throw', 'hud.purse': 'Purse', 'hud.strike': 'Strike',
    'hud.cover.aria': 'Disguise status and wear or remove Synod robes', 'hud.body.aria': 'Drag, drop, conceal or recover a nearby body',
    'hud.throw.aria': 'Choose a throwing distraction', 'hud.purse.aria': 'Inspect nearby purse',
    'menu.title': 'Options', 'menu.save': 'Save game', 'menu.load': 'Load game', 'menu.controls': 'Controls',
    'menu.gfx': 'Graphics & access', 'menu.gfx.aria': 'Graphics, difficulty and accessibility',
    'menu.sound_on': 'Sound on', 'menu.sound_off': 'Sound off', 'menu.music_on': 'Music on', 'menu.music_off': 'Music off',
    'menu.needs': 'Journey needs (hunger and sleep): {state}', 'menu.hardcore': 'Hardcore run (one save, death is final): {state}',
    'menu.to_title': 'Return to title',
    'ctl.free_look': 'Free look', 'ctl.free_look.hint': 'move the mouse over the view to look · rest it at a side edge to keep turning · when off, hold the right button and drag',
    'ctl.capture': 'Capture mouse', 'ctl.capture.hint': 'click the view to capture it, so it never wanders off the window · Esc gives it back',
    'ctl.fullscreen': 'Full screen', 'ctl.sens': 'Look sensitivity', 'ctl.invert': 'Invert up and down look',
    'ctl.always_run': 'Always run', 'ctl.always_run.hint': 'Shift walks instead · Caps Lock toggles',
    'ctl.touch': 'Touch controls', 'ctl.touch.hint': 'auto turns on when you touch the screen',
    'acc.title': 'Difficulty, Visuals & Accessibility', 'acc.difficulty': 'Difficulty',
    'acc.difficulty.hint': 'Narrative (forgiving Narrow & damage) · Standard · Narrow-Master (deadly)',
    'acc.crt': 'CRT Scanlines & Curvature', 'acc.dither': 'Bayer Dithering Shader', 'acc.colourblind': 'Colourblind-Safe Markers & Bars',
    'acc.subtitles': 'Subtitles & Audio Captions', 'acc.tts': 'Voiced Key Lines (TTS Synthesis)', 'acc.minimap': 'Corner Minimap Overlay',
    'acc.markers': 'Map Objective Markers', 'acc.tutorial': 'Tutorial Tips', 'acc.tutorial.hint': 'Contextual hints on first encounters',
    'acc.sens': 'Free Look & Mouse Sensitivity ({n})', 'acc.rebind': 'Key Rebinding', 'acc.rebind_btn': 'Rebind Keys…',
    'gfx.state': 'Graphics: {preset}', 'gfx.preset': 'Preset', 'gfx.preset.hint': 'sharpness, view distance, particles and effects',
    'gfx.original': 'Original', 'gfx.low': 'Low', 'gfx.medium': 'Medium', 'gfx.high': 'High',
    'gfx.resolution': 'Resolution', 'gfx.resolution.hint': '1x is the original 320x150 view, 2x renders four times the pixels',
    'gfx.view_distance': 'View distance', 'gfx.view_distance.hint': 'fog reach, 0.6 to 1.4',
    'gfx.particles': 'Particles', 'gfx.particles.hint': 'leaves, motes, dust and weather',
    'gfx.upscaling': 'Upscaling', 'gfx.upscaling.hint': 'Sharp pixels is the clean unfiltered look', 'gfx.sharp': 'Sharp pixels', 'gfx.smooth': 'Smooth',
    'gfx.dark': 'Dark interiors', 'gfx.dark.hint': 'rooms lit only by their lamps and your lantern (U)',
    'gfx.curve': 'CRT curvature', 'gfx.curve.hint': 'needs CRT scanlines on',
    'gfx.shorter': 'Shorter view distance', 'gfx.longer': 'Longer view distance', 'gfx.fewer': 'Fewer particles', 'gfx.more': 'More particles',
    'feel.head': 'Camera feel', 'feel.bob': 'Head bob', 'feel.bob.hint': 'off keeps the original walk; gentle is smoother with a slight roll', 'feel.gentle': 'Gentle',
    'feel.reduce': 'Reduce motion', 'feel.reduce.hint': 'no shake or roll, softer bob and landing dip, calmer creatures',
    'feel.noflash': 'No flashes', 'feel.noflash.hint': 'removes the red, cyan and gold full-view flashes and strobing hit flashes',
    'misc.credits': 'Credits', 'misc.credits.hint': 'fonts and their open licence', 'misc.dreams': 'Dreams and glass echoes', 'misc.dreams.hint': 'rest dreams, memory echoes',
    'ax.head': 'Accessibility', 'ax.text_size': 'Text size', 'ax.text_size.hint': 'scales panel, dialogue and message text; the game view and HUD keep their size',
    'ax.normal': 'Normal', 'ax.large': 'Large', 'ax.largest': 'Largest',
    'ax.contrast': 'High contrast', 'ax.contrast.hint': 'black panels, white text, strong outlines',
    'ax.captions': 'Sound captions', 'ax.captions.hint': 'a short written note for important sounds',
    'ax.language': 'Language', 'ax.language.hint': 'menus, buttons and the story; recorded voices stay in English',
    'panel.inventory': 'Inventory', 'panel.worn': 'Worn — Armour Rating {n}', 'panel.weapons': 'Weapons', 'panel.carried': 'Carried',
    'panel.logbook': 'Logbook', 'panel.rite': 'The Rite', 'panel.other_matters': 'Other matters', 'panel.ledger': 'The Ledger',
    'panel.songbook': 'Song-book', 'panel.vitals': 'Vitals', 'panel.world_map': 'World map (T)', 'panel.session_slots': 'Session slots',
    'panel.save_code': 'Save code', 'panel.map_hint': 'What you have walked. North is up.',
    'slot.head': 'Head', 'slot.hands': 'Hands', 'slot.feet': 'Feet', 'slot.shield': 'Shield',
    'attr.strength': 'Strength', 'attr.intelligence': 'Intelligence', 'attr.willpower': 'Willpower', 'attr.agility': 'Agility',
    'attr.endurance': 'Endurance', 'attr.personality': 'Personality', 'attr.speed': 'Speed', 'attr.luck': 'Luck',
    'legend.door': 'Door', 'legend.quest_giver': 'Quest giver', 'legend.shop': 'Shop', 'legend.danger': 'Danger', 'legend.boss': 'Boss', 'legend.trap': 'Trap',
    'msg.sound_on': 'Sound on.', 'msg.sound_off': 'Sound off.', 'msg.music_on': 'Music on.', 'msg.music_off': 'Music off.',
    'msg.logbook_updated': 'Your logbook has been updated.', 'msg.ears_ring': 'Your ears ring.',
    'msg.always_run_off': 'Always run: off.', 'msg.always_run_on': 'Always run: on (hold Shift to walk).',
    'death.wake': 'Wake', 'ending.again': 'Begin again',
    'cap.bell': '[A bell tolls]', 'cap.bellDie': '[A bell cracks]', 'cap.door': '[A door grinds]', 'cap.thunder': '[Thunder]',
    'cap.hound': '[A hound bays]', 'cap.golem': '[Stone grinds nearby]', 'cap.hurt': '[You are hurt]', 'cap.glasshit': '[Glass rings]',
    'cap.shot': '[A shot cracks]', 'cap.bow': '[A bowstring snaps]', 'cap.hit': '[A blow lands]', 'cap.swing': '[A blade swings]',
    'cap.song': '[A Song is sung]', 'cap.fifth': '[A hollow fifth sounds]', 'cap.crack': '[Something cracks open]', 'cap.press': '[A press thumps]',
    'cap.quiet': '[The sound drains away]', 'cap.pickup': '[Something is picked up]', 'cap.voice': '[A voice murmurs]',
    'cap.alert': '[Something cries out]', 'cap.attack': '[Something strikes]', 'cap.death': '[Something dies]',
  };
  const LOCALES = { en: 'English', fr: 'Français', 'en-XA': 'Pseudo (test)' };

  // ---------------------------------------------------------------- catalog machinery
  const catalogs = Object.create(null);       // code -> Map(key -> string)
  const loggedMissing = new Set();
  const missing = [];                         // [{ locale, key }] in the order first logged
  const KEY_RE = /^[a-z0-9_.]{1,64}$/i;
  const toMap = (obj) => { const m = new Map(); for (const k of Object.keys(obj)) m.set(k, obj[k]); return m; };
  catalogs.en = toMap(EN);
  let loc = 'en';

  // Validate an untrusted catalog: known keys only, strings only, bounded length.
  function sanitize(messages) {
    const out = new Map();
    if (!messages || typeof messages !== 'object') return out;
    for (const k of Object.keys(messages)) {
      const v = messages[k];
      if (!KEY_RE.test(k) || !Object.prototype.hasOwnProperty.call(EN, k) || typeof v !== 'string') continue;
      out.set(k, v.slice(0, 600));
    }
    return out;
  }
  function register(code, obj) {
    if (!Object.prototype.hasOwnProperty.call(LOCALES, code) && !/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(code)) return false;
    catalogs[code] = sanitize(obj && obj.messages ? obj.messages : obj);
    return true;
  }
  function logMissing(code, key) {
    const id = code + '\u0000' + key;
    if (loggedMissing.has(id)) return;
    loggedMissing.add(id); missing.push({ locale: code, key });
    try { console.info('[i18n] ' + code + ' has no "' + key + '"; showing English'); } catch (e) { /* console optional */ }
  }
  function fill(str, params) {
    if (!params) return str;
    return str.replace(/\{([a-z0-9_]+)\}/gi, (m, name) => (Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : m));
  }
  // t(key, params): the active locale, else its language ("fr-CA" -> "fr"), else English.
  // A key English does not have gives '' (and a log), never the key name.
  function t(key, params, code) {
    const want = code || loc;
    const chain = [want]; const dash = want.indexOf('-');
    if (dash > 0 && want !== 'en-XA') chain.push(want.slice(0, dash));
    for (const c of chain) {
      const cat = catalogs[c];
      if (cat && cat.has(key)) return fill(cat.get(key), params);
    }
    if (EN[key] == null) { logMissing('en', key); return ''; }   // a typo in the code, not a translation gap
    if (want !== 'en') logMissing(want, key);
    return fill(EN[key], params);
  }

  // Pseudo-locale: accented letters, then padded to at least 40% longer with word-like filler, so
  // wrapping behaves like a real longer language. {params} are kept intact.
  const ACC = { a: 'á', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ħ', i: 'í', j: 'ĵ', k: 'ķ', l: 'ļ', m: 'ṁ', n: 'ñ', o: 'ö', p: 'þ', q: 'q', r: 'ŕ', s: 'š', t: 'ţ', u: 'ü', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
    A: 'Á', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ħ', I: 'Í', J: 'Ĵ', K: 'Ķ', L: 'Ļ', M: 'Ṁ', N: 'Ñ', O: 'Ö', P: 'Þ', Q: 'Q', R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Ü', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž' };
  const FILLER = ['ēxtŕá', 'ļöñĝér', 'ţéẋţ', 'ṁöŕé', 'wörðš'];
  function pseudo(s) {
    const parts = s.split(/(\{[a-z0-9_]+\})/i);
    let out = parts.map((p, i) => (i % 2 ? p : p.replace(/[A-Za-z]/g, ch => ACC[ch]))).join('');
    const target = Math.ceil(s.length * 1.4);
    for (let i = 0; out.length < target; i++) out += (i === 0 ? ' ' : ' ') + FILLER[i % FILLER.length];
    return out;
  }
  function pseudoCatalog() { const o = {}; for (const k of Object.keys(EN)) o[k] = pseudo(EN[k]); return o; }
  catalogs['en-XA'] = toMap(pseudoCatalog());

  // ---------------------------------------------------------------- reverse index: English text -> key
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const exact = new Map();
  const templates = [];
  for (const key of Object.keys(EN)) {
    const v = EN[key];
    if (/\{[a-z0-9_]+\}/i.test(v)) {
      const names = []; let src = '';
      for (const p of v.split(/(\{[a-z0-9_]+\})/i)) {
        const m = /^\{([a-z0-9_]+)\}$/i.exec(p);
        if (m) { names.push(m[1]); src += '(.+?)'; } else src += p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      templates.push({ key, names, re: new RegExp('^' + src + '$') });
    } else if (!exact.has(norm(v))) exact.set(norm(v), key);
  }
  function lookupEnglish(text) {
    const n = norm(text);
    if (!n || n.length > 200) return null;
    const k = exact.get(n);
    if (k) return { key: k, params: null };
    for (const tp of templates) {
      const m = tp.re.exec(n);
      if (m) { const params = {}; tp.names.forEach((nm, i) => { params[nm] = m[i + 1]; }); return { key: tp.key, params }; }
    }
    return null;
  }
  // a parameter that is itself a known English word ("On") is translated too
  function renderMatch(m) {
    let params = m.params;
    const cat = catalogs[loc], base = catalogs[loc.split('-')[0]];
    const native = loc === 'en' || (cat && cat.has(m.key)) || (base && base.has(m.key));
    // a line that fell back to English keeps its English words, state words included
    if (params && native) { params = {}; for (const k of Object.keys(m.params)) { const sub = exact.get(norm(m.params[k])); params[k] = sub ? t(sub) : m.params[k]; } }
    return t(m.key, params);
  }

  // ---------------------------------------------------------------- applying a locale to the DOM
  const textSrc = new WeakMap();   // text node -> { en, shown }
  const attrSrc = new WeakMap();   // element -> { attr: { en, shown } }
  const ATTRS = ['aria-label', 'title'];
  const ROOTS = ['#modal-panel', '#title', '#touchui', '#death', '#ending'];
  const isPlayerName = (x) => { try { return typeof G !== 'undefined' && G.player && typeof G.player.name === 'string' && x.trim() === G.player.name; } catch (e) { return false; } };
  function xlateTextNode(node) {
    const cur = node.nodeValue, rec = textSrc.get(node);
    const src = rec && cur === rec.shown ? rec.en : cur;
    if (!rec && loc === 'en') return;
    if (isPlayerName(src) && !(node.parentNode && node.parentNode.closest && node.parentNode.closest('button'))) return;                // the traveller's own name is data, never chrome
    const m = lookupEnglish(src);
    if (!m) return;
    const lead = /^\s*/.exec(src)[0], trail = /\s*$/.exec(src)[0];
    const out = loc === 'en' ? src : lead + renderMatch(m) + trail;
    if (out !== cur) node.nodeValue = out;       // text only: catalog values are never parsed as markup
    textSrc.set(node, { en: src, shown: out });
  }
  function xlateAttrs(el) {
    for (const a of ATTRS) {
      const cur = el.getAttribute(a); if (cur == null) continue;
      const recs = attrSrc.get(el) || {}; const rec = recs[a];
      const src = rec && cur === rec.shown ? rec.en : cur;
      if (!rec && loc === 'en') continue;
      const m = lookupEnglish(src); if (!m) continue;
      const out = loc === 'en' ? src : renderMatch(m);
      if (out !== cur) el.setAttribute(a, out);
      recs[a] = { en: src, shown: out }; attrSrc.set(el, recs);
    }
  }
  let applying = false;
  function translateTree(root) {
    if (!root) return;
    applying = true;
    try {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n; while ((n = w.nextNode())) { const p = n.parentNode; if (p && (p.tagName === 'SCRIPT' || p.tagName === 'STYLE')) continue; xlateTextNode(n); }
      if (root.nodeType === 1) xlateAttrs(root);
      root.querySelectorAll('[aria-label],[title]').forEach(xlateAttrs);
    } finally { applying = false; }
  }
  function translateAll() { for (const sel of ROOTS) { const r = document.querySelector(sel); if (r) translateTree(r); } }
  function xlateMsg(text) {
    if (loc === 'en' || typeof text !== 'string') return text;
    const m = lookupEnglish(text);
    return m ? renderMatch(m) : text;
  }

  // load a locale: embedded for en and en-XA, fetched for the rest. Always resolves; a failure keeps English.
  async function setLocale(code) {
    if (!Object.prototype.hasOwnProperty.call(LOCALES, code) && !catalogs[code]) code = 'en';
    if (code !== 'en' && !catalogs[code]) {
      try {
        const r = await fetch('locales/' + code + '.json', { cache: 'no-cache' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        register(code, await r.json());
      } catch (e) { try { console.info('[i18n] could not load ' + code + ': ' + (e && e.message)); } catch (e2) { /* console optional */ } code = 'en'; }
    }
    loc = code; S.loc = code; save();
    translateAll();
    // the story text (js/story-i18n.js) follows the same choice, after the menu keys so the key catalogue wins on
    // rows both know; if its catalogue cannot load the story stays English
    try { if (window.STORY_I18N) await window.STORY_I18N.setLocale(code); } catch (e) { /* the menus still switch */ }
    refreshLanguageRow();
    return code;
  }

  // ---------------------------------------------------------------- persistence
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ ts: S.ts, hc: S.hc, cap: S.cap, loc: S.loc })); } catch (e) { /* no storage: fine */ } }
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!o || typeof o !== 'object') return;
      if (o.ts === 0 || o.ts === 1 || o.ts === 2) S.ts = o.ts;
      S.hc = o.hc === true; S.cap = o.cap === true;
      if (typeof o.loc === 'string' && Object.prototype.hasOwnProperty.call(LOCALES, o.loc)) S.loc = o.loc;
    } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------- classes on <html>
  const root = () => document.documentElement;
  let lastRM = null, lastNF = null;
  function syncClasses() {
    const h = root(); if (!h) return;
    h.classList.toggle('ac-ts', S.ts > 0);
    h.style.setProperty('--ac-ts', String(TS_SCALE[S.ts]));
    h.classList.toggle('ac-hc', S.hc);
    const rm = !!(typeof GFX !== 'undefined' && GFX.reduceMotion), nf = !!(typeof GFX !== 'undefined' && GFX.noFlash);
    h.classList.toggle('ac-rm', rm); h.classList.toggle('ac-nf', nf);
    if (nf !== lastNF && typeof GFX !== 'undefined') {
      // fp-hands keeps its own "no pulsing glow" switch; tie it to No flashes
      if (nf) GFX.reduceFlash = true; else if (lastNF === true) GFX.reduceFlash = false;
    }
    lastRM = rm; lastNF = nf;
  }

  // ---------------------------------------------------------------- text size: scale every font-size in cqw/cqh/px
  const TS_ID = 'access-ts-style';
  const SIZE_RE = /[\d.]+(?:cqw|cqh|px)/;
  function splitSel(s) {
    const out = []; let d = 0, cur = '';
    for (const ch of s) {
      if (ch === '(' || ch === '[') d++; else if (ch === ')' || ch === ']') d--;
      if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  function sizeOf(style) {
    let v = style.getPropertyValue('font-size');
    if (v && SIZE_RE.test(v)) return v;
    const f = style.getPropertyValue('font');       // shorthand such as "3.8cqw var(--font-display)"
    if (f) { const m = /(?:^|\s)([\d.]+(?:cqw|cqh|px))(?:\/\S+)?(?:\s|$)/.exec(f); if (m) return m[1]; }
    return null;
  }
  function scaleRules(rules, out) {
    for (const r of rules) {
      if (r.type === 1 && r.selectorText) {                       // style rule
        const size = sizeOf(r.style); if (!size) continue;
        const sels = splitSel(r.selectorText).filter(s => !/\.hd-|#access-|#ac-/.test(s));   // held documents have their own A+/A-
        if (!sels.length) continue;
        out.push(sels.map(s => 'html.ac-ts ' + s).join(', ') + ' { font-size: calc(var(--ac-ts, 1) * (' + size + ')); }');
      } else if ((r.type === 4 || r.type === 12) && r.cssRules) {   // @media / @supports
        const inner = []; scaleRules(r.cssRules, inner);
        if (inner.length) out.push((r.type === 4 ? '@media ' : '@supports ') + (r.conditionText || (r.media && r.media.mediaText) || '') + ' {\n' + inner.join('\n') + '\n}');
      }
    }
  }
  function buildTextSizeCss() {
    const out = [];
    for (const sheet of Array.from(document.styleSheets)) {
      if (sheet.ownerNode && (sheet.ownerNode.id === TS_ID || sheet.ownerNode.id === 'access-style')) continue;
      let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
      scaleRules(rules, out);
    }
    return out.join('\n');
  }
  let tsTimer = 0, tsBuilt = '';
  function rebuildTextSize() {
    let el = document.getElementById(TS_ID);
    if (!el) { el = document.createElement('style'); el.id = TS_ID; document.head.appendChild(el); }
    const css = buildTextSizeCss();
    if (css !== tsBuilt) { el.textContent = css; tsBuilt = css; }
    return css.length;
  }
  function scheduleTextSize() { if (S.ts === 0 || tsTimer) return; tsTimer = setTimeout(() => { tsTimer = 0; try { rebuildTextSize(); } catch (e) { console.warn('text size rebuild failed', e); } }, 60); }

  // ---------------------------------------------------------------- the stylesheet of this module
  const CSS = `
/* reduce motion: the DOM animations that never asked */
html.ac-rm #party.low .pbar i { animation: none; background: #e0533a; }
html.ac-rm .scroll-text p { animation: none; opacity: 1; }
html.ac-rm .hd-sheet.hd-sway { animation: none; }
html.ac-rm .dlg .port img.pt-swap { animation: none; }
html.ac-rm #fx { transition: none; }
/* no flashes: belt and braces for the full-view tints (the wrapper on fx() already skips them) */
html.ac-nf #fx.hurt, html.ac-nf #fx.glass, html.ac-nf #fx.song { background: none; }
/* focus outlines are always visible for keyboard use in high contrast */
html.ac-hc { --gold: #ffe566; --gold-dim: #ffd23a; --parch: #ffffff; --parch-dim: #ececec; --panel: #000; --panel-2: #000; --edge-l: #ffffff; --edge-d: #ffffff; --ink: #000; }
/* frames.js paints panels with image layers at higher specificity: !important is needed to get plain black */
html.ac-hc .panel, html.ac-hc .scroll-text, html.ac-hc .title-inner, html.ac-hc .death-inner, html.ac-hc .ending-inner { background: #000 !important; color: #fff; border: 3px solid #fff !important; border-image: none !important; box-shadow: 0 0 0 2px #000, 0 0 0 4px #fff; }
html.ac-hc .panel h2, html.ac-hc .panel h3, html.ac-hc .panel b { color: var(--gold); }
html.ac-hc .panel .muted, html.ac-hc .panel small, html.ac-hc .ctl-grid small { color: #ececec; }
html.ac-hc .dfbtn, html.ac-hc .tb { background: #000; color: #ffe566; border: 2px solid #fff; text-shadow: none; }
html.ac-hc .dfbtn:hover:not(:disabled), html.ac-hc .tb:hover { background: #1a1a1a; }
html.ac-hc .dfbtn.sel, html.ac-hc .dfbtn[aria-pressed="true"], html.ac-hc .dfbtn.sel:hover:not(:disabled), html.ac-hc .dfbtn[aria-pressed="true"]:hover:not(:disabled) { background: #fff; color: #000; }
html.ac-hc .dfbtn:disabled { color: #bdbdbd; border-style: dashed; }
html.ac-hc :focus-visible { outline: 3px solid #ffe566; outline-offset: 2px; }
html.ac-hc .dlg .log, html.ac-hc .panel input[type=text], html.ac-hc .panel pre { background: #000; color: #fff; border-color: #fff; }
html.ac-hc .panel table td { border-color: #666; }
html.ac-hc #msgs .m { background: rgba(0,0,0,.88); color: #fff; padding: .2cqh .8cqw; margin-bottom: .3cqh; width: fit-content; max-width: 100%; border-left: 3px solid #ffe566; }
html.ac-hc #msgs .m.warn { color: #ffe566; }
html.ac-hc #hint { background: rgba(0,0,0,.88); color: #ffe566; padding: .2cqh .8cqw; border: 1px solid #fff; }
html.ac-hc #cover-status { background: #000; color: #fff; border: 2px solid #fff; }
html.ac-hc .hd-sheet, html.ac-hc .hd-sheet.hd-parch, html.ac-hc .hd-sheet.hd-paper, html.ac-hc .hd-sheet.hd-office, html.ac-hc .hd-sheet.hd-slate { --hd-bg: #fff; --hd-ink: #000; --hd-edge: #000; background-image: none; background-color: #fff; color: #000; }
html.ac-hc #ac-captions div { background: #000; color: #fff; border-color: #fff; }
/* sound captions */
#ac-captions { position: absolute; right: 1.2cqw; top: 1cqh; max-width: 40cqw; display: flex; flex-direction: column; align-items: flex-end; gap: .4cqh; pointer-events: none; z-index: 6; font-family: var(--font-body); font-size: 2cqw; line-height: 1.2; }
#ac-captions div { padding: .3cqh .9cqw; background: rgba(8,6,4,.82); color: var(--parch); border-left: 3px solid var(--gold); font-style: italic; }
#ac-captions:empty { display: none; }
.ac-row-head { grid-column: 1 / -1; margin-top: 1cqh; color: var(--gold); font-family: var(--font-display); letter-spacing: .08em; }
.ac-grp { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .5cqw; max-width: 36cqw; }
`;
  function injectStyle() {
    if (document.getElementById('access-style')) return;
    const st = document.createElement('style'); st.id = 'access-style'; st.textContent = CSS; document.head.appendChild(st);
  }

  // ---------------------------------------------------------------- the Options block
  const el = (tag, props, text) => {
    const e = document.createElement(tag);
    if (props) for (const k in props) e.setAttribute(k, props[k]);
    if (text != null) e.textContent = text;
    return e;
  };
  function setPressed(b, on) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.classList.toggle('sel', !!on); }
  function setTextSize(i) {
    S.ts = i === 1 || i === 2 ? i : 0; save(); syncClasses();
    if (S.ts) rebuildTextSize();
    // the held-document reader has its own size steps; start it at a matching one
    try { if (typeof READING !== 'undefined' && READING.setSize) READING.setSize(S.ts === 0 ? 1 : S.ts + 1); } catch (e) { /* reader optional */ }
    refreshRows();
  }
  function setHighContrast(on) { S.hc = !!on; save(); syncClasses(); refreshRows(); }
  function setCaptions(on) { S.cap = !!on; save(); if (!S.cap) clearCaptions(); refreshRows(); }
  function setReduceMotion(on) {
    GFX.reduceMotion = !!on;
    try { if (typeof FEEL !== 'undefined' && FEEL.save) FEEL.save(); } catch (e) { /* storage optional */ }
    syncClasses(); refreshRows();
  }
  function setNoFlash(on) {
    GFX.noFlash = !!on;
    try { if (typeof FEEL !== 'undefined' && FEEL.save) FEEL.save(); } catch (e) { /* storage optional */ }
    syncClasses(); refreshRows();
  }
  const rowEls = {};
  function refreshRows() {
    const q = id => document.getElementById(id);
    if (!q('ac-head')) return;
    TS_NAMES.forEach((n, i) => { const b = q('ac-ts-' + i); if (b) setPressed(b, S.ts === i); });
    const hc = q('ac-hc'); if (hc) { hc.textContent = t(S.hc ? 'ui.on' : 'ui.off'); setPressed(hc, S.hc); }
    const cp = q('ac-cap'); if (cp) { cp.textContent = t(S.cap ? 'ui.on' : 'ui.off'); setPressed(cp, S.cap); }
    for (const [id, on] of [['feel-reduce', GFX.reduceMotion], ['feel-noflash', GFX.noFlash]]) { const b = q(id); if (b) { b.textContent = t(on ? 'ui.on' : 'ui.off'); setPressed(b, on); } }
    refreshLanguageRow();
  }
  function refreshLanguageRow() {
    for (const code of Object.keys(LOCALES)) { const b = document.getElementById('ac-loc-' + code); if (b) setPressed(b, loc === code); }
  }
  function appendBlock() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById('ac-head')) return;
    const label = (key, hintKey) => { const s = el('span', { class: 'gfx-label' }, EN[key]); if (hintKey) { s.appendChild(document.createTextNode(' ')); s.appendChild(el('small', { class: 'muted' }, EN[hintKey])); } return s; };
    const btn = (id, text, fn, aria) => { const b = el('button', { class: 'dfbtn small', id, type: 'button' }, text); if (aria) b.setAttribute('aria-label', aria); b.onclick = fn; return b; };
    const head = el('span', { id: 'ac-head', class: 'ac-row-head', role: 'heading', 'aria-level': '3' }, EN['ax.head']);
    grid.appendChild(head);
    // text size
    grid.appendChild(label('ax.text_size', 'ax.text_size.hint'));
    const g1 = el('span', { class: 'ctl-step ac-grp', role: 'group', 'aria-label': EN['ax.text_size'] });
    ['ax.normal', 'ax.large', 'ax.largest'].forEach((k, i) => g1.appendChild(btn('ac-ts-' + i, EN[k], () => setTextSize(i))));
    grid.appendChild(g1);
    // the two existing switches, moved here so there is one place
    for (const [id, key] of [['feel-reduce', 'feel.reduce'], ['feel-noflash', 'feel.noflash']]) {
      const b = document.getElementById(id); const lab = b && b.previousElementSibling;
      if (b && lab && lab.classList.contains('gfx-label')) {
        grid.appendChild(lab); grid.appendChild(b);
        const small = lab.querySelector('small'); if (small) small.textContent = EN[key + '.hint'];
        b.addEventListener('click', () => { syncClasses(); refreshRows(); });
      } else {   // fp-feel absent: provide our own
        grid.appendChild(label(key, key + '.hint'));
        grid.appendChild(btn(id, EN['ui.off'], () => (id === 'feel-reduce' ? setReduceMotion(!GFX.reduceMotion) : setNoFlash(!GFX.noFlash)), EN[key]));
      }
    }
    // high contrast, captions
    grid.appendChild(label('ax.contrast', 'ax.contrast.hint'));
    grid.appendChild(btn('ac-hc', EN['ui.off'], () => setHighContrast(!S.hc), EN['ax.contrast']));
    grid.appendChild(label('ax.captions', 'ax.captions.hint'));
    grid.appendChild(btn('ac-cap', EN['ui.off'], () => setCaptions(!S.cap), EN['ax.captions']));
    // language
    grid.appendChild(label('ax.language', 'ax.language.hint'));
    const g2 = el('span', { class: 'ctl-step ac-grp', role: 'group', 'aria-label': EN['ax.language'] });
    for (const code of Object.keys(LOCALES)) {
      const b = btn('ac-loc-' + code, LOCALES[code], () => { setLocale(code); }, LOCALES[code]);
      b.setAttribute('lang', code); g2.appendChild(b);
    }
    grid.appendChild(g2);
    refreshRows();
  }

  // ---------------------------------------------------------------- sound captions
  const CAP_KEYS = new Set(['bell', 'bellDie', 'door', 'thunder', 'hound', 'golem', 'hurt', 'glasshit', 'shot', 'bow', 'hit', 'swing', 'song', 'fifth', 'crack', 'press', 'quiet', 'pickup', 'voice']);
  const capSeen = new Map();
  function captionBox() {
    let b = document.getElementById('ac-captions');
    if (!b) { const g = document.getElementById('game'); if (!g) return null; b = el('div', { id: 'ac-captions', role: 'log', 'aria-live': 'polite', 'aria-label': 'Sound captions' }); g.appendChild(b); }
    return b;
  }
  function clearCaptions() { const b = document.getElementById('ac-captions'); if (b) b.textContent = ''; }
  function caption(name) {
    if (!S.cap) return;
    const text = t('cap.' + name); if (!text) return;
    const now = performance.now(), last = capSeen.get(name) || -1e9;
    if (now - last < 900) return;              // a chord of calls is one caption
    capSeen.set(name, now);
    const b = captionBox(); if (!b) return;
    const d = document.createElement('div'); d.textContent = text; b.appendChild(d);
    while (b.children.length > 4) b.removeChild(b.firstChild);
    setTimeout(() => { if (d.parentNode) d.remove(); }, 3200);
  }

  // ---------------------------------------------------------------- effect wrappers (reduce motion / no flashes)
  const touched = { creature: 0, flash: 0, flicker: 0 };
  function calmEntity(e) {
    if (!e) return;
    if (GFX.reduceMotion) {
      const k = 0.35;
      if (e.animSkew) e.animSkew *= k;
      if (e.animSY != null) e.animSY = 1 + (e.animSY - 1) * k;
      if (e.animSX != null) e.animSX = 1 + (e.animSX - 1) * k;
      if (e.animLift) e.animLift *= 0.5;
      touched.creature++;
    }
    if (GFX.noFlash) {
      if (e.animHurt) e.animHurt = 0;
      if (e.animGlow) { e._acGlow = e._acGlow == null ? e.animGlow : e._acGlow + (e.animGlow - e._acGlow) * 0.04; e.animGlow = e._acGlow; }   // steady glow, no 10 Hz pulse
      if (e.flash) e.flash = false;
      touched.flash++;
    }
  }
  function wire() {
    // the original creature / prop motion in anim.js, after creature-life and companions have had their say
    for (const name of ['animCreature', 'animDeco']) {
      const f = window[name];
      if (typeof f !== 'function') continue;
      window[name] = function (e) { const r = f.apply(this, arguments); try { calmEntity(e); } catch (err) { console.warn('access calm failed', err); } return r; };
    }
    if (typeof Engine !== 'undefined' && Engine.render) {
      const _render = Engine.render;
      Engine.render = function () {
        try {
          syncClasses();
          if (GFX.noFlash && typeof G !== 'undefined' && G.ents) for (const e of G.ents) if (e.flash) { e.flash = false; touched.flash++; }   // stun strobe and hit flash
        } catch (e) { /* cosmetic */ }
        return _render.apply(this, arguments);
      };
    }
    if (typeof Engine !== 'undefined' && Engine.setFlicker) {
      const _flick = Engine.setFlicker;
      Engine.setFlicker = function (v) {
        if (GFX.noFlash || GFX.reduceMotion) { v = 1 + (v - 1) * (GFX.noFlash ? 0.15 : 0.4); touched.flicker++; }   // lamp light stays near steady
        return _flick.call(this, v);
      };
    }
    // sound captions
    if (typeof Audio_ !== 'undefined' && Audio_.sfx) {
      for (const k of Object.keys(Audio_.sfx)) {
        const f = Audio_.sfx[k]; if (typeof f !== 'function') continue;
        if (CAP_KEYS.has(k)) Audio_.sfx[k] = function () { try { caption(k); } catch (e) { /* cosmetic */ } return f.apply(this, arguments); };
        else if (k === 'enemy') Audio_.sfx[k] = function (def, ev) { try { if (ev === 'alert' || ev === 'attack' || ev === 'death') caption(ev); } catch (e) { /* cosmetic */ } return f.apply(this, arguments); };
      }
    }
    // the Options screens
    if (typeof renderAccessibilityMenu === 'function') {
      const _acc = renderAccessibilityMenu;
      renderAccessibilityMenu = function () {
        const r = _acc.apply(this, arguments);
        try { appendBlock(); syncClasses(); translateTree(document.getElementById('modal-panel')); } catch (e) { console.warn('access block failed', e); }
        return r;
      };
    }
    // translate straight after each chrome panel draws (the observer below catches live edits)
    for (const name of ['renderMenu', 'renderControls', 'renderInventory', 'renderCharacter', 'renderLog', 'renderLedger', 'renderSongs', 'renderMap', 'renderSave', 'renderLoad', 'renderHelp']) {
      const f = window[name];
      if (typeof f !== 'function') continue;
      window[name] = function () { const r = f.apply(this, arguments); try { if (loc !== 'en') translateTree(document.getElementById('modal-panel')); } catch (e) { console.warn('access translate failed', e); } return r; };
    }
    if (typeof msg === 'function') {
      const _msg = msg;
      msg = function (text, cls, ttl) { let tx = text; try { tx = xlateMsg(text); } catch (e) { tx = text; } return _msg.call(this, tx, cls, ttl); };
    }
    // live edits: a button that flips between On and Off, a title redrawn
    if (typeof MutationObserver === 'function') {
      let pending = false;
      const obs = new MutationObserver(() => {
        if (applying || loc === 'en' || pending) return;
        pending = true; Promise.resolve().then(() => { pending = false; translateAll(); obs.takeRecords(); });
      });
      for (const sel of ROOTS) { const r = document.querySelector(sel); if (r) obs.observe(r, { childList: true, subtree: true, characterData: true }); }
      // stylesheets injected after load (reading, screens...) also need their sizes scaled
      obs.__head = new MutationObserver(scheduleTextSize);
      obs.__head.observe(document.head, { childList: true });
    }
  }

  // What honours what. Rows: module -> how it reads reduce motion / no flashes / contrast, and how this module reaches the rest.
  const MATRIX = [
    ['fp-feel (shake, dip, bob, roll, deaf blur)', 'GFX.reduceMotion removes shake/roll, softens bob+dip', 'fx() hurt/glass/song skipped', 'own'],
    ['enemy-fx (shatter, shedding)', 'GFX.reducedMotion (alias of reduceMotion) jumps to the finished variant', 'no flashes in the effect', 'own'],
    ['telegraphs', 'sway and spin stop', 'steady marks', 'own'],
    ['firesmoke', 'fewer, slower puffs', 'spark highlights dimmed', 'own'],
    ['windbells', 'cloth and signs hang still', 'no flashes in the effect', 'own'],
    ['smalllife', 'steady glow', 'steady glow', 'own'],
    ['gates', 'no wobble, no shake', 'no flashes in the effect', 'own'],
    ['companions', 'calmer flinch/limp/throb', 'no sparks, steady rings', 'own'],
    ['dreams, screens, reading, portraits', 'still variants (CSS/JS)', 'no flashes in the effect', 'own'],
    ['townsfolk, creature-life', 'idle life off', 'no flashes in the effect', 'own'],
    ['weather lightning (engine)', '-', 'wxFlash is zero', 'own'],
    ['anim.js creature/prop idle motion', 'ACCESS dampens skew/squash/lift (wrapper)', 'ACCESS clears hurt flash, steadies glow', 'wrapped here'],
    ['stun strobe / hit flash (e.flash)', '-', 'ACCESS clears it each frame (wrapper)', 'wrapped here'],
    ['lamp flicker (Engine.setFlicker)', 'ACCESS damps (wrapper)', 'ACCESS damps hard (wrapper)', 'wrapped here'],
    ['fp-hands glow pulse', '-', 'GFX.reduceFlash tied to No flashes', 'wrapped here'],
    ['CSS: party pulse, scroll-text fade, held-doc sway, portrait settle, #fx tints', 'ACCESS stylesheet turns them off', 'ACCESS stylesheet hides tints', 'wrapped here'],
    ['Text size / High contrast', 'all DOM panels, dialogue, messages, touch buttons, held-doc chrome', '-', 'here'],
    ['grass/reeds sway (flora), water shimmer, star twinkle, leaf/mote particles, door swing', 'NOT REACHABLE from this module (clock-driven inside the renderer); lower Graphics preset to remove', 'no strobing content', 'flag'],
    ['canvas HUD (bars, buttons) and in-view sprites', 'text size/contrast NOT applied (drawn on the 320x200 canvas)', '-', 'flag'],
  ];

  load();
  // initialise
  (function init() {
    try { injectStyle(); } catch (e) { console.warn('access style failed', e); }
    syncClasses();
    wire();
    if (S.ts) { try { rebuildTextSize(); } catch (e) { /* later */ } }
    if (S.loc !== 'en') setLocale(S.loc);
  })();

  return {
    settings: S, KEY, EN, LOCALES, TS_SCALE, TS_NAMES, MATRIX, catalogs,
    t, pseudo, pseudoCatalog, register, setLocale, translateTree, translateAll, lookupEnglish, sanitize,
    get locale() { return loc; }, missing,
    setTextSize, setHighContrast, setCaptions, setReduceMotion, setNoFlash, syncClasses, rebuildTextSize, caption, calmEntity,
    appendBlock, refreshRows, save, load, touched,
  };
})();
if (typeof window !== 'undefined') window.ACCESS = ACCESS;
