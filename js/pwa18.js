// pwa18 — Phase 18 "Technical", team PWA: an installable, offline game.
//
// What this module does (the worker itself is sw.js, the lists in it come from tools/pwa/precache.js):
//   1. Registers sw.js (relative to the page, so it works at a domain root and under a GitHub Pages sub-path) once the
//      game has reached the title screen, so the install never competes with the loading bar.
//   2. UPDATE NOTICE. A new version installs in the background and waits. When one is waiting, a small notice says
//      "A new version is ready — reload". It is held back while enemies are chasing you, its button is disabled while
//      a fight starts, and nothing ever reloads by itself: the page changes version only when the player presses
//      Reload. A running game is not saved by a reload, so with a game in progress the button asks once more; during a
//      hardcore run (which exists only in this page) there is no Reload button at all, only a line saying the new
//      version starts the next time the game is opened.
//   3. OPTIONS (Graphics & access), three rows appended the way cinema14 / extras17 do:
//        Keep saves on this device   default OFF. Off, nothing below runs and the game is exactly as before.
//        Offline audio               downloads the music and voices (about 52 MB) so they play offline too; the
//                                    scripts, pictures and text are already offline after the first visit.
//        Install the game            only when the browser offers installation.
//   4. KEEP SAVES ON THIS DEVICE. When ON, the three session slots (SLOTS in game.js) are mirrored into IndexedDB
//      ("octave18" / "slots") and put back into empty slots when the page opens. Rules that do not bend:
//        * hardcore runs are never written (hardcorePayload), and while a hardcore run is on nothing is written;
//        * an extra's saves (flag p17x_on) are never written, and nothing is read into or written from the slots
//          while an extra runs (EXTRAS17 empties SLOTS for it and puts Book One's back afterwards);
//        * the pre-boss autosave is not stored (it is a "rewind", not a slot);
//        * what comes back is validated like any imported save: a JSON string parsed in try/catch, the shape checked,
//          size capped, and restoreGame still does its own full validation when the player loads it; slot summaries
//          already pass through cleanName/cleanText. Nothing stored is ever put in markup.
//      Turning it OFF deletes the stored copies (the in-page slots stay until the page closes, as today).
//   Nothing here touches saves, RNG, balance or the story. No server: the only network use is the browser fetching
//   this site's own files.
(function () {
  'use strict';

  const KEY = 'octave.pwa18.v1';
  const DB_NAME = 'octave18', STORE = 'slots', N_SLOTS = 3, MAX_SLOT_BYTES = 8 * 1024 * 1024;

  const TX = {
    updTitle: 'A new version is ready — reload',
    updBtn: 'Reload',
    updLater: 'Later',
    updFight: 'After the fight',
    updSure: 'Reloading returns you to the title and does not save your game. Save first, or reload anyway.',
    updAnyway: 'Reload anyway',
    updHardcore: 'A new version is ready. It starts the next time you open the game; a reload now would end this hardcore run.',
    keepLabel: 'Keep saves on this device',
    keepHint: 'the three session slots stay in this browser after you close the page. Hardcore runs and the extras are never stored. Off: slots last until you leave the page, as before.',
    keepNoStore: 'This browser cannot store them (private window or storage blocked): slots last until you leave the page.',
    audioLabel: 'Offline audio',
    audioHint: 'download the music and voices (about 52 MB) so they play without a connection. Everything else is already offline after the first visit.',
    audioBtn: 'Download',
    audioNone: 'Offline play starts once this page has been fully loaded from a web address (not a file).',
    audioDone: 'Ready',
    audioBusy: 'Downloading',
    audioStop: 'Stop',
    audioMore: 'Finish',
    installLabel: 'Install the game',
    installHint: 'add it to your apps and start it from there, in its own window.',
    installBtn: 'Install',
    on: 'On', off: 'Off',
  };
  const TEXTS = Object.values(TX);

  const st = { keep: 0, sw: 'idle', update: false, controlled: false, store: 'unknown', reloading: false, media: { total: 0, cached: 0, busy: false, failed: 0 }, mediaBytes: 0 };
  let reg = null, waiting = null, deferredInstall = null, hydrated = false, hydrating = null;
  const loaded = [null, null, null];     // what the device had, read once
  const last = [null, null, null];       // the object each slot held when it was last written or deleted

  // ------------------------------------------------------------------------------------------------ settings
  function loadPrefs() { try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && typeof o === 'object') st.keep = o.keep === 1 ? 1 : 0; } catch (e) { /* no storage: default off */ } }
  function savePrefs() { try { localStorage.setItem(KEY, JSON.stringify({ keep: st.keep })); } catch (e) { /* this page only */ } }
  const inExtra = () => { try { return typeof EXTRAS17 === 'object' && !!EXTRAS17.inExtra(); } catch (e) { return false; } };
  const hardcore = () => { try { return typeof hardcoreOn === 'function' && hardcoreOn(); } catch (e) { return false; } };

  // ------------------------------------------------------------------------------------------------ IndexedDB
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      try {
        if (typeof indexedDB === 'undefined') throw new Error('no indexedDB');
        const rq = indexedDB.open(DB_NAME, 1);
        rq.onupgradeneeded = () => { try { rq.result.createObjectStore(STORE); } catch (e) { /* exists */ } };
        rq.onsuccess = () => resolve(rq.result);
        rq.onerror = () => reject(rq.error || new Error('indexedDB error'));
        rq.onblocked = () => reject(new Error('indexedDB blocked'));
      } catch (e) { reject(e); }
    }).catch((e) => { dbp = null; st.store = 'none'; throw e; });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then((d) => new Promise((resolve, reject) => {
      const t = d.transaction(STORE, mode), s = t.objectStore(STORE);
      let out; try { out = fn(s); } catch (e) { reject(e); return; }
      t.oncomplete = () => resolve(out && typeof out === 'object' && 'result' in out ? out.result : out);   // a request's result is read once the transaction is done
      t.onerror = t.onabort = () => reject(t.error || new Error('indexedDB transaction failed'));
    }));
  }
  const idbGet = (i) => tx('readonly', (s) => s.get(i));
  const idbPut = (i, v) => tx('readwrite', (s) => s.put(v, i));
  const idbDel = (i) => tx('readwrite', (s) => s.delete(i));
  const idbClear = () => tx('readwrite', (s) => s.clear());
  let chain = Promise.resolve();
  const queue = (fn) => { chain = chain.then(fn, fn).catch(() => { st.store = 'none'; }); return chain; };

  // ------------------------------------------------------------------------------------------------ slot mirror
  function persistable(d) {
    if (!d || typeof d !== 'object') return false;
    try { if (typeof hardcorePayload === 'function' && hardcorePayload(d)) return false; } catch (e) { return false; }
    if (d.flags && typeof d.flags === 'object' && d.flags.p17x_on) return false;     // an extra's save never leaves its session
    return true;
  }
  // a stored value is untrusted like any pasted save: parse, shape, size. restoreGame validates the rest on load.
  function parseStored(raw) {
    if (typeof raw !== 'string' || raw.length > MAX_SLOT_BYTES) return null;
    let d; try { d = JSON.parse(raw); } catch (e) { return null; }
    if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
    if (typeof SAVE_VERSION !== 'undefined' && d.v !== SAVE_VERSION) return null;
    if (!d.player || typeof d.player !== 'object' || !d.maps || typeof d.maps !== 'object' || typeof d.mapId !== 'string') return null;
    if (!persistable(d)) return null;
    return d;
  }
  function hydrate() {
    if (hydrating) return hydrating;
    hydrating = (async () => {
      for (let i = 0; i < N_SLOTS; i++) { let raw = null; try { raw = await idbGet(i); } catch (e) { st.store = 'none'; return; } loaded[i] = parseStored(raw); if (raw != null && !loaded[i]) queue(() => idbDel(i)); }   // an entry that does not read as one of our saves is cleared away
      st.store = 'ok';
      applyLoaded();
    })().catch(() => { st.store = 'none'; });
    return hydrating;
  }
  // put the device's slots into EMPTY in-page slots (never over one the player just saved), outside extras
  function applyLoaded() {
    if (!st.keep || hydrated || inExtra() || st.store !== 'ok' || typeof SLOTS === 'undefined') return false;
    hydrated = true;
    let any = false;
    for (let i = 0; i < N_SLOTS; i++) if (SLOTS[i] == null && loaded[i]) { SLOTS[i] = loaded[i]; last[i] = loaded[i]; any = true; }
    if (any) { try { if (G.state === 'panel' && (G.openPanel === 'loadtitle' || G.openPanel === 'load')) renderLoad(G.openPanel === 'loadtitle'); } catch (e) { /* the panel reads the slots when it next opens */ } }
    return any;
  }
  function sync() {
    if (!st.keep || inExtra() || hardcore() || typeof SLOTS === 'undefined') return;
    for (let i = 0; i < N_SLOTS; i++) {
      const d = SLOTS[i];
      if (d === last[i]) continue;
      last[i] = d;
      if (persistable(d)) { let s = null; try { s = JSON.stringify(d); } catch (e) { s = null; } if (s && s.length <= MAX_SLOT_BYTES) queue(() => idbPut(i, s)); }
      else queue(() => idbDel(i));
    }
  }
  // The slot buttons assign SLOTS[i] and only then ask for a redraw, so redraws are not a reliable signal: while the
  // switch is on, three reference comparisons once a second notice any change (nothing runs while it is off).
  let watchTimer = 0;
  function watchSlots() {
    if (st.keep && !watchTimer) watchTimer = setInterval(() => { try { sync(); } catch (e) { warn('watch', e); } }, 1000);
    else if (!st.keep && watchTimer) { clearInterval(watchTimer); watchTimer = 0; }
  }
  function setKeep(on) {
    on = !!on;
    if (on === !!st.keep) return;
    st.keep = on ? 1 : 0; savePrefs();
    if (on) {
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { }); } catch (e) { /* best effort */ }
      hydrated = false; hydrating = null;
      hydrate().then(() => { if (st.keep) { sync(); refreshRows(); } });
    } else {
      for (let i = 0; i < N_SLOTS; i++) { last[i] = null; loaded[i] = null; }
      hydrated = false; hydrating = null;
      queue(() => idbClear());
    }
    watchSlots(); refreshRows();
  }

  // ------------------------------------------------------------------------------------------------ wrappers
  function wrap() {
    if (typeof renderSave === 'function') {
      const _f = renderSave;
      renderSave = function () {
        if (st.keep) { try { applyLoaded(); sync(); } catch (e) { warn('save', e); } }
        const r = _f.apply(this, arguments);
        // the slot buttons assign SLOTS[i] and then call renderSave again, so this second call sees the new save
        return r;
      };
    }
    if (typeof renderLoad === 'function') {
      const _f = renderLoad;
      renderLoad = function () {
        if (st.keep) { try { applyLoaded(); } catch (e) { warn('load', e); } }
        return _f.apply(this, arguments);
      };
    }
  }
  let warned = {};
  function warn(k, e) { if (warned[k]) return; warned[k] = 1; try { console.warn('pwa18: ' + k, e); } catch (x) { /* no console */ } }

  // ------------------------------------------------------------------------------------------------ service worker
  function supported() { return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !/[?&]nosw(=|&|$)/.test(location.search); }
  function post(msg) { try { const c = navigator.serviceWorker.controller || (reg && (reg.active || reg.waiting)); if (c) { c.postMessage(msg); return true; } } catch (e) { /* no worker */ } return false; }

  function onMessage(ev) {
    const d = ev && ev.data; if (!d || typeof d !== 'object') return;
    if (d.type === 'status') { st.media.total = d.total | 0; st.media.cached = d.cached | 0; st.mediaBytes = d.bytes | 0; refreshRows(); }
    else if (d.type === 'media-progress') { st.media.busy = true; st.media.total = d.total | 0; st.media.cached = d.done | 0; st.media.failed = d.failed | 0; refreshRows(); }
    else if (d.type === 'media-done' || d.type === 'media-incomplete' || d.type === 'media-cancelled') { st.media.busy = false; st.media.cached = d.done | 0; st.media.failed = d.failed | 0; refreshRows(); }
  }
  function watch(r) {
    reg = r;
    const check = () => { if (r.waiting && navigator.serviceWorker.controller) { waiting = r.waiting; offerUpdate(); } };
    r.addEventListener('updatefound', () => {
      const w = r.installing; if (!w) return;
      w.addEventListener('statechange', () => { if (w.state === 'installed') check(); });
    });
    check();
    // look for a newer version when the page is opened, when it comes back to the front, and every half hour
    const poll = () => { try { r.update().catch(() => { }); } catch (e) { /* offline */ } };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') poll(); });
    setInterval(poll, 30 * 60 * 1000);
    poll();
  }
  function register() {
    if (!supported()) { st.sw = 'unsupported'; refreshRows(); return; }
    navigator.serviceWorker.addEventListener('message', onMessage);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      st.controlled = !!navigator.serviceWorker.controller;
      if (st.reloading) { try { location.reload(); } catch (e) { /* closed */ } }
    });
    navigator.serviceWorker.register('sw.js', { scope: './', updateViaCache: 'none' }).then((r) => {
      st.sw = 'registered'; watch(r);
      return navigator.serviceWorker.ready;
    }).then(() => { st.sw = 'ready'; st.controlled = !!navigator.serviceWorker.controller; post({ type: 'status' }); refreshRows(); })
      .catch((e) => { st.sw = 'failed'; warn('register', e); refreshRows(); });
  }
  // wait for the title screen (the loading bar is done) and a breath, then register
  function registerSoon() {
    let tries = 0;
    const go = () => { try { if ((typeof G !== 'undefined' && G.state && G.state !== 'loading') || ++tries > 120) { setTimeout(register, 1200); return; } } catch (e) { /* G not ready */ } setTimeout(go, 500); };
    go();
  }

  // ------------------------------------------------------------------------------------------------ update notice
  const el = (tag, attrs, text) => { const e = document.createElement(tag); if (attrs) for (const k in attrs) { if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); } if (text != null) e.textContent = text; return e; };
  let fightOverride = null;     // tests only: pretend a fight is on (true) or off (false) without putting a made-up enemy into the world
  function fighting() {
    if (fightOverride !== null) return fightOverride;
    try {
      if (typeof G === 'undefined' || !G.ents) return false;
      if (G.dead || G.state === 'dead') return true;
      if (G.attack && G.attack.t > 0) return true;
      for (const e of G.ents) if (e && e.kind === 'enemy' && !e.dead && !e.hidden && e.state === 'chase') return true;
    } catch (e) { /* treat as calm */ }
    return false;
  }
  const inRun = () => { try { return typeof G !== 'undefined' && !!G.player && G.state !== 'title' && G.state !== 'create' && G.state !== 'intro'; } catch (e) { return false; } };
  let noticeTimer = 0, dismissed = false, confirming = false;

  function offerUpdate() {
    st.update = true; dismissed = false;
    if (!noticeTimer) noticeTimer = setInterval(tickNotice, 1000);
    tickNotice();
  }
  function tickNotice() {
    let n = document.getElementById('pwa18-update');
    if (!st.update || dismissed) { if (n) n.hidden = true; return; }
    const fight = fighting();
    if (!n) {
      if (fight) return;                       // never first appear in the middle of a fight
      const host = document.getElementById('game'); if (!host) return;
      n = el('div', { id: 'pwa18-update', role: 'status', 'aria-live': 'polite' });
      host.appendChild(n);
    }
    const hc = hardcore();
    const sig = [fight, hc, confirming, inRun()].join();
    if (n.dataset.sig === sig && !n.hidden) return;
    n.dataset.sig = sig; n.hidden = false; n.textContent = '';
    if (hc) { n.appendChild(el('span', { class: 'pwa18-msg' }, TX.updHardcore)); const x = el('button', { class: 'dfbtn small', type: 'button', id: 'pwa18-later' }, TX.updLater); x.onclick = () => { dismissed = true; n.hidden = true; }; n.appendChild(x); return; }
    n.appendChild(el('span', { class: 'pwa18-msg' }, confirming ? TX.updSure : TX.updTitle));
    const go = el('button', { class: 'dfbtn small', type: 'button', id: 'pwa18-reload' }, fight ? TX.updFight : confirming ? TX.updAnyway : TX.updBtn);
    go.disabled = fight;
    go.onclick = () => { if (fighting()) return; if (!confirming && inRun()) { confirming = true; tickNotice(); return; } applyUpdate(); };
    n.appendChild(go);
    const later = el('button', { class: 'dfbtn small', type: 'button', id: 'pwa18-later' }, TX.updLater);
    later.onclick = () => { dismissed = true; confirming = false; n.hidden = true; };
    n.appendChild(later);
  }
  function applyUpdate() {
    if (hardcore()) return false;
    st.reloading = true;
    const w = waiting || (reg && reg.waiting);
    if (w) { try { w.postMessage({ type: 'skip-waiting' }); } catch (e) { /* gone */ } }
    setTimeout(() => { try { location.reload(); } catch (e) { /* closed */ } }, 4000);     // if controllerchange never comes
    return true;
  }

  // ------------------------------------------------------------------------------------------------ Options rows
  const MB = (b) => Math.max(1, Math.round(b / 1048576));
  function rowParts(id, label, hint) {
    const lab = el('span', { class: 'gfx-label', id: id + '-label' }, label + ' ');
    lab.appendChild(el('small', { class: 'muted', id: id + '-hint' }, hint));
    const b = el('button', { class: 'dfbtn small', id, type: 'button', 'aria-label': label });
    return [lab, b];
  }
  function appendRows() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById('pwa18-keep')) return;
    const [kl, kb] = rowParts('pwa18-keep', TX.keepLabel, TX.keepHint);
    kb.onclick = () => setKeep(!st.keep);
    const [al, ab] = rowParts('pwa18-audio', TX.audioLabel, TX.audioHint);
    ab.onclick = () => { if (st.media.busy) post({ type: 'media-cancel' }); else if (post({ type: 'media-download' })) { st.media.busy = true; } refreshRows(); };
    const rows = [kl, kb, al, ab];
    if (deferredInstall) {
      const [il, ib] = rowParts('pwa18-install', TX.installLabel, TX.installHint);
      ib.onclick = async () => { const p = deferredInstall; deferredInstall = null; try { p.prompt(); await p.userChoice; } catch (e) { /* declined */ } refreshRows(); };
      rows.push(il, ib);
    }
    for (const r of rows) grid.appendChild(r);
    post({ type: 'status' });
    refreshRows();
  }
  function refreshRows() {
    const kb = document.getElementById('pwa18-keep');
    if (kb) {
      kb.textContent = st.keep ? TX.on : TX.off; kb.setAttribute('aria-pressed', st.keep ? 'true' : 'false'); kb.classList.toggle('sel', !!st.keep);
      const h = document.getElementById('pwa18-keep-hint'); if (h) h.textContent = (st.keep && st.store === 'none') ? TX.keepNoStore : TX.keepHint;
    }
    const ab = document.getElementById('pwa18-audio');
    if (ab) {
      const m = st.media, ready = st.sw === 'ready' && st.controlled;
      ab.disabled = !ready || (!m.busy && m.total > 0 && m.cached >= m.total);
      ab.textContent = !ready ? TX.audioBtn : m.busy ? TX.audioStop + ' (' + m.cached + '/' + m.total + ')' : (m.total > 0 && m.cached >= m.total) ? TX.audioDone : (m.cached > 0 ? TX.audioMore + ' (' + m.cached + '/' + m.total + ')' : TX.audioBtn + (st.mediaBytes ? ' (' + MB(st.mediaBytes) + ' MB)' : ''));
      const h = document.getElementById('pwa18-audio-hint'); if (h) h.textContent = ready ? TX.audioHint : TX.audioNone;
    }
    const ib = document.getElementById('pwa18-install'); if (ib) ib.textContent = TX.installBtn;
  }
  function wireOptions() {
    if (typeof renderAccessibilityMenu !== 'function') return;
    const _acc = renderAccessibilityMenu;
    renderAccessibilityMenu = function () { const r = _acc.apply(this, arguments); try { appendRows(); } catch (e) { warn('rows', e); } return r; };
  }

  const CSS = `
#pwa18-update { position: absolute; left: 50%; top: 1.2cqh; transform: translateX(-50%); z-index: 60; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: .8cqw 1cqw; max-width: 84cqw; padding: .8cqh 1.4cqw; background: #1a1410; border: 2px ridge var(--gold-dim, #8c6d2f); color: var(--parch, #e8dcc0); font-family: var(--font-sc, serif); font-size: max(2cqw, 11px); box-shadow: 0 2px 10px #000a; }
#pwa18-update[hidden] { display: none; }
#pwa18-update .pwa18-msg { flex: 1 1 18cqw; text-align: center; }
#pwa18-update button { font-size: inherit; }
#pwa18-update button[disabled] { opacity: .55; }`;
  function injectStyle() { if (document.getElementById('pwa18-style')) return; const s = document.createElement('style'); s.id = 'pwa18-style'; s.textContent = CSS; document.head.appendChild(s); }

  // ------------------------------------------------------------------------------------------------ boot
  function boot() {
    loadPrefs(); injectStyle();
    try { wrap(); } catch (e) { warn('wrap', e); }
    try { wireOptions(); } catch (e) { warn('wireOptions', e); }
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; refreshRows(); });
    window.addEventListener('appinstalled', () => { deferredInstall = null; });
    if (st.keep) { hydrate(); watchSlots(); }
    // a slot saved just before the page is hidden or closed is written now, not on the next render
    window.addEventListener('pagehide', () => { try { sync(); } catch (e) { /* closing */ } });
    if (document.readyState === 'complete') registerSoon(); else window.addEventListener('load', registerSoon);
  }
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot(); }

  window.PWA18 = {
    state: st, TX, TEXTS, supported, setKeep, sync, hydrate, applyLoaded, persistable, parseStored,
    // for tests and the Options rows
    post, fighting, applyUpdate, offerUpdate, register, refreshRows, appendRows,
    _fight(v) { fightOverride = v; },
    waitingWorker: () => waiting || (reg && reg.waiting) || null, registration: () => reg,
    _forget() { for (let i = 0; i < N_SLOTS; i++) { last[i] = null; loaded[i] = null; } hydrated = false; hydrating = null; },
  };
})();
