// ============================================================
//  reading — Phase 3: full-screen "held" documents.
//  Books, letters, logs, registers, pamphlets, writs and inscriptions are
//  shown through showEvent()/readLoreBook(). This module wraps both and, for an
//  explicit allow-list of reading events only, presents the text as a sheet
//  filling the view: large, high-contrast serif text, paged with CSS columns
//  (so inline markup and text-size changes reflow for free), keyboard / touch /
//  controller paging and a session-long text-size control. Every other event
//  (dialogue, story beats, choices) keeps the normal panel.
//
//  The sheet's paper is procedural CSS (stand-in work, no image assets).
//  Security: the title, body and choice labels are the exact HTML strings the
//  game already built from its own data and already put in innerHTML; this
//  module adds nothing to them and never reads player-controlled text itself.
//  GFX.heldDocs = false restores the original panels exactly.
// ============================================================
'use strict';

if (typeof GFX !== 'undefined') {
  if (GFX.heldDocs === undefined) GFX.heldDocs = true;          // held full-screen documents
  if (GFX.reduceMotion === undefined) GFX.reduceMotion = false; // stops the hand-held sway
}

const READING = (function () {
  // Every source converted. Exact titles, never guessed from length. `style` picks
  // the paper: parch (parchment), paper (plain letter paper), office (grey ruled
  // Office form), slate (pale stone / chalk).
  const SOURCES = {
    // lore bookshelves are routed by readLoreBook (see below), kind 'book'
    'The log of OC-742':             { style: 'office', kind: 'Logbook' },          // js/coda.js codaCutter log
    'The register of interments':    { style: 'paper',  kind: 'Register' },         // js/coda.js maus_register
    'Over the inner door':           { style: 'slate',  kind: 'Inscription' },      // js/coda.js maus_inscription
    'The writ':                      { style: 'office', kind: 'Writ of the Synod' },// js/coda.js herald's writ (has choices)
    'WELCOME TO RELIEF':             { style: 'office', kind: 'Pamphlet' },         // js/grove.js reg_sign
    'Bryony Wick\'s letter':            { style: 'paper',  kind: 'Letter' },           // js/grove.js wick_letter
    'The grey folder':               { style: 'office', kind: 'Office file' },      // js/grove.js Arbiterium folder
    'The Arbiter\'s dispatch':       { style: 'office', kind: 'Dispatch' },         // js/wilds.js wildsDispatch
  };
  const BOOK = { style: 'parch', kind: 'Volume' };
  const SIZES = [0.85, 1, 1.2, 1.45, 1.75];
  const S = {                 // session memory
    sizeIdx: 1, open: false, page: 0, pages: 1, cur: null, raf: 0, pad: null, padPrev: [],
    pendingBook: false, el: null, layoutW: 0,
  };
  const GAP = 48;

  function q(sel) { return document.querySelector(sel); }
  function reduced() {
    try { if (typeof GFX !== 'undefined' && GFX.reduceMotion) return true; } catch (e) { /* ignore */ }
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }

  // ---------------------------------------------------------------- style
  const CSS = `
#event.hd-on { background: rgba(5,4,3,.93); }
#event.hd-on #event-panel { width: 100%; max-width: none; height: 100%; max-height: none; padding: 1.2cqh 1.5cqw; overflow: hidden; background: none; border: 0; box-shadow: none; display: flex; justify-content: center; align-items: stretch; }
.hd-sheet { --hd-bg: #e9d8ab; --hd-ink: #1c130a; --hd-edge: #b99a5e; --hd-btn: #2a1d10; --hd-btn-ink: #fbf1d4;
  position: relative; display: flex; flex-direction: column; min-width: 0; width: min(100%, calc(64ch + 7cqw)); height: 100%;
  padding: 2cqh 3.5cqw 1.6cqh; background-color: var(--hd-bg); color: var(--hd-ink);
  font-family: 'Alegreya', Georgia, 'Iowan Old Style', 'Palatino Linotype', 'DejaVu Serif', serif; --hd-u: max(15px, 2.8cqw); font-size: var(--hd-u); line-height: 1.55;
  box-shadow: 0 0 0 2px #000, 0 1.2cqh 5cqh rgba(0,0,0,.85); transform-origin: 50% 100%; text-align: left; }
.hd-sheet.hd-sway { animation: hd-sway 9s ease-in-out infinite; }
@keyframes hd-sway { 0%,100% { transform: rotate(-.18deg) translateY(0); } 50% { transform: rotate(.18deg) translateY(.4cqh); } }
@media (prefers-reduced-motion: reduce) { .hd-sheet.hd-sway { animation: none; } }
.hd-parch { --hd-bg: #e9d8ab; --hd-ink: #1c130a;
  background-image: radial-gradient(ellipse at 50% 45%, rgba(255,246,214,.35) 0, rgba(255,246,214,0) 60%), radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 62%, rgba(120,84,30,.28) 100%), repeating-linear-gradient(97deg, rgba(110,80,30,.035) 0 3px, rgba(0,0,0,0) 3px 9px); }
.hd-paper { --hd-bg: #f1ece0; --hd-ink: #16130f;
  background-image: radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 70%, rgba(150,130,90,.2) 100%), repeating-linear-gradient(0deg, rgba(60,50,40,.03) 0 1px, rgba(0,0,0,0) 1px 4px); }
.hd-office { --hd-bg: #d9dcdc; --hd-ink: #0d1012; --hd-edge: #7c8386;
  background-image: repeating-linear-gradient(0deg, rgba(40,60,70,.07) 0 1px, rgba(0,0,0,0) 1px 1.7em), linear-gradient(90deg, rgba(150,40,30,.0) 0, rgba(150,40,30,.0) 100%); border-top: .5em solid #50575b; }
.hd-office .hd-head { padding-right: 3.4em; }
.hd-office::after { content: ''; position: absolute; right: 3.5cqw; top: 1.2cqh; width: 2.6em; height: 2.6em; border-radius: 50%; border: .18em double rgba(140,28,20,.55); box-shadow: inset 0 0 0 .3em rgba(140,28,20,.10); pointer-events: none; }
.hd-slate { --hd-bg: #cfd2cc; --hd-ink: #0e100e;
  background-image: radial-gradient(ellipse at 50% 50%, rgba(255,255,255,.16) 0, rgba(0,0,0,0) 60%), repeating-linear-gradient(33deg, rgba(40,40,36,.04) 0 2px, rgba(0,0,0,0) 2px 7px); }
.hd-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: .4em 1em; padding-bottom: .35em; border-bottom: 2px solid var(--hd-ink); }
.hd-id { min-width: 0; flex: 1 1 14em; }
.hd-kicker { display: block; font-size: .62em; letter-spacing: .18em; text-transform: uppercase; font-weight: 700; }
#event.hd-on .hd-title { margin: 0; padding: 0; border: 0; font-family: inherit; font-size: 1.25em; line-height: 1.15; font-weight: 700; color: var(--hd-ink); letter-spacing: .01em; text-transform: none; }
.hd-tools { display: flex; align-items: center; gap: .4em; font-size: .72em; }
.hd-count { min-width: 6.5em; text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }
.hd-body { font-size: calc(var(--hd-k, 1) * 1em); flex: 1 1 0; min-height: 0; margin: .5em 0 .4em; overflow: hidden; column-fill: auto; orphans: 2; widows: 2; touch-action: pan-y; outline: none; }
.hd-body * { max-width: 100%; }
.hd-foot { flex: 0 0 auto; max-height: 46%; overflow: auto; border-top: 1px solid var(--hd-edge); padding-top: .4em; }
.hd-nav { display: flex; align-items: center; justify-content: space-between; gap: .6em; }
.hd-hint { flex: 1 1 auto; text-align: center; font-size: .6em; opacity: 1; font-weight: 600; }
.hd-choices { display: flex; flex-direction: column; gap: .3em; margin-top: .4em; }
.hd-choices.hd-off { visibility: hidden; }
.hd-btn { font-family: inherit; font-size: .8em; font-weight: 700; line-height: 1.2; color: var(--hd-btn-ink); background: var(--hd-btn); border: 2px solid var(--hd-ink); padding: .35em .9em; min-height: max(40px, 5.5cqh); min-width: 2.6em; cursor: pointer; text-align: left; }
.hd-btn:hover:not([disabled]), .hd-btn:focus-visible { outline: 3px solid #b02a1c; outline-offset: 1px; }
.hd-btn[disabled] { opacity: .45; cursor: default; }
.hd-nav .hd-btn, .hd-tools .hd-btn { text-align: center; }
@media (max-height: 460px) { .hd-choices { flex-direction: row; flex-wrap: wrap; } .hd-choices .hd-btn { flex: 1 1 auto; } .hd-sheet { padding-top: 1cqh; padding-bottom: .8cqh; line-height: 1.4; } .hd-hint { display: none; } .hd-btn { min-height: 34px; padding: .2em .7em; } .hd-kicker { display: none; } }
`;
  function injectStyle() {
    if (typeof document === 'undefined' || document.getElementById('reading-style')) return;
    const st = document.createElement('style'); st.id = 'reading-style'; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  // ---------------------------------------------------------------- layout / paging
  function body() { return S.el && S.el.querySelector('.hd-body'); }
  function layout(keepRatio) {
    const b = body(); if (!b) return;
    const oldRatio = S.pages > 1 ? S.page / S.pages : 0;
    b.style.width = ''; b.style.columnWidth = ''; b.style.columnGap = '';
    const w = Math.floor(b.getBoundingClientRect().width);
    b.style.width = w + 'px'; b.style.columnWidth = w + 'px'; b.style.columnGap = GAP + 'px';
    b.scrollLeft = 0;
    S.pages = Math.max(1, Math.round((b.scrollWidth + GAP) / (w + GAP)));
    S.layoutW = w;
    go(keepRatio ? Math.min(S.pages - 1, Math.floor(oldRatio * S.pages + 1e-6)) : S.page);
  }
  function go(p) {
    const b = body(); if (!b) return;
    S.page = Math.max(0, Math.min(S.pages - 1, p | 0));
    b.scrollLeft = S.page * (S.layoutW + GAP);
    const last = S.page === S.pages - 1;
    const el = S.el;
    el.querySelector('.hd-count').textContent = 'Page ' + (S.page + 1) + ' of ' + S.pages;
    el.querySelector('[data-act="prev"]').disabled = S.page === 0;
    el.querySelector('[data-act="next"]').disabled = last;
    const ch = el.querySelector('.hd-choices');
    ch.classList.toggle('hd-off', !last);
    ch.querySelectorAll('button').forEach(x => { x.tabIndex = last ? 0 : -1; x.disabled = !last; });
  }
  function setSize(idx) {
    idx = Math.max(0, Math.min(SIZES.length - 1, idx));
    S.sizeIdx = idx;
    if (!S.el) return;
    S.el.style.setProperty('--hd-k', SIZES[idx]);
    S.el.querySelector('[data-act="smaller"]').disabled = idx === 0;
    S.el.querySelector('[data-act="larger"]').disabled = idx === SIZES.length - 1;
    layout(true);
  }

  // ---------------------------------------------------------------- open / close
  function choose(i) {
    const cur = S.cur; if (!cur) return;
    const ch = cur.choices[i];
    teardown();
    hide('#event'); G.state = 'play'; G.keys = {};   // same order as the original showEvent
    if (ch && ch.f) ch.f();
  }
  function teardown() {
    S.open = false; S.cur = null;
    if (S.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(S.raf);
    S.raf = 0;
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onResize);
    const ev = q('#event'); if (ev) ev.classList.remove('hd-on');
    S.el = null;
  }
  function dismiss() {   // Escape / controller B
    const cur = S.cur; if (!cur) return;
    if (cur.choices.length <= 1) choose(0);   // the one way out: it is also the original's only action
    else { go(S.pages - 1); const b = S.el.querySelector('.hd-choices button'); if (b) b.focus(); }
  }
  function open(title, html, choices, src) {
    injectStyle();
    const ev = q('#event'), p = q('#event-panel');
    G.state = 'event';
    choices = choices && choices.length ? choices : [{ t: 'Close.', f: null }];
    S.cur = { title, choices };
    p.innerHTML = `<article class="hd-sheet hd-${src.style}${reduced() ? '' : ' hd-sway'}" role="dialog" aria-modal="true" aria-label="Held document">
  <header class="hd-head"><div class="hd-id"><span class="hd-kicker">${src.kind}</span><h2 class="hd-title">${title}</h2></div>
    <div class="hd-tools"><button class="hd-btn" data-act="smaller" aria-label="Smaller text">A-</button><button class="hd-btn" data-act="larger" aria-label="Larger text">A+</button><span class="hd-count" aria-live="polite"></span></div></header>
  <div class="hd-body" tabindex="0">${html}</div>
  <footer class="hd-foot"><div class="hd-nav"><button class="hd-btn" data-act="prev" aria-label="Previous page">&#9664; Back</button><span class="hd-hint">Arrows or swipe to turn pages. Esc to put it down.</span><button class="hd-btn" data-act="next" aria-label="Next page">Next &#9654;</button></div>
    <div class="hd-choices">${choices.map((c, i) => `<button class="hd-btn" data-i="${i}">${c.t}</button>`).join('')}</div></footer>
</article>`;
    S.el = p.firstElementChild;
    ev.classList.add('hd-on'); show('#event');
    S.open = true; S.page = 0; S.pages = 1;
    S.el.querySelectorAll('[data-act]').forEach(b => { b.onclick = () => act(b.dataset.act); });
    S.el.querySelectorAll('.hd-choices button').forEach(b => { b.onclick = () => choose(+b.dataset.i); });
    swipe(body());
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    setSize(S.sizeIdx);
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (S.open && S.el) layout(true); }); } catch (e) { /* ignore */ }
    padStart();
  }
  function act(a) {
    if (a === 'next') go(S.page + 1);
    else if (a === 'prev') go(S.page - 1);
    else if (a === 'larger') setSize(S.sizeIdx + 1);
    else if (a === 'smaller') setSize(S.sizeIdx - 1);
  }
  function onResize() { if (S.open) layout(true); }

  // ---------------------------------------------------------------- input
  function onKey(ev) {
    if (!S.open) return;
    const ev$ = q('#event');
    if (!ev$ || ev$.classList.contains('hidden')) { teardown(); return; }
    const k = ev.key;
    const onBtn = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('hd-btn');
    const last = S.page === S.pages - 1;
    let used = true;
    if (k === 'ArrowRight' || k === 'PageDown') go(S.page + 1);
    else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'Backspace') go(S.page - 1);
    else if (k === 'Home') go(0);
    else if (k === 'End') go(S.pages - 1);
    else if (k === '+' || k === '=') setSize(S.sizeIdx + 1);
    else if (k === '-' || k === '_') setSize(S.sizeIdx - 1);
    else if (k === 'Escape') dismiss();
    else if ((k === 'Enter' || k === ' ') && !onBtn) {
      if (!last) go(S.page + 1);
      else if (S.cur.choices.length === 1) choose(0);
      else { const b = S.el.querySelector('.hd-choices button'); if (b) b.focus(); }
    } else if (/^[1-9]$/.test(k) && last && S.cur.choices[+k - 1]) choose(+k - 1);
    else used = false;
    if (used) { ev.preventDefault(); ev.stopImmediatePropagation(); }
  }
  function swipe(el) {
    let d = null;
    el.addEventListener('pointerdown', (e) => { d = { x: e.clientX, y: e.clientY, t: Date.now(), type: e.pointerType }; });
    el.addEventListener('pointerup', (e) => {
      if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y, dt = Date.now() - d.t, ty = d.type; d = null;
      if (Math.abs(dx) > 48 && Math.abs(dx) > 1.5 * Math.abs(dy)) go(S.page + (dx < 0 ? 1 : -1));
      else if (ty !== 'mouse' && Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 400) {
        const r = el.getBoundingClientRect(); go(S.page + (e.clientX - r.left > r.width * 0.5 ? 1 : -1));
      }
    });
    el.addEventListener('pointercancel', () => { d = null; });
  }
  // Controller: A / RB / D-right next (A on the last page takes the single choice), LB / D-left back,
  // D-up / D-down text size, B puts it down. Own edge detection, so a held A from opening is ignored.
  function padPoll() {
    S.raf = 0; if (!S.open) return;
    const ev$ = q('#event'); if (!ev$ || ev$.classList.contains('hidden')) { teardown(); return; }
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : null;
      let gp = null;
      if (pads) for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { gp = pads[i]; break; }
      if (gp) {
        const btn = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
        const edge = (i) => btn(i) && !S.padPrev[i];
        const last = S.page === S.pages - 1;
        let later = null;
        if (edge(0)) { if (!last) go(S.page + 1); else if (S.cur.choices.length === 1) later = () => choose(0); else { const b = S.el.querySelector('.hd-choices button'); if (b) b.focus(); } }
        else if (edge(1)) later = () => dismiss();
        else if (edge(5) || edge(15)) go(S.page + 1);
        else if (edge(4) || edge(14)) go(S.page - 1);
        else if (edge(12)) setSize(S.sizeIdx + 1);
        else if (edge(13)) setSize(S.sizeIdx - 1);
        for (let i = 0; i < 16; i++) S.padPrev[i] = btn(i);
        // Deferred a beat so the same press is not also read by the play-state controller.
        if (later) setTimeout(() => { if (S.open) later(); }, 120);
      }
    } catch (e) { /* controller trouble never breaks reading */ }
    if (typeof requestAnimationFrame === 'function') S.raf = requestAnimationFrame(padPoll);
  }
  function padStart() {
    S.padPrev = [];
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : null;
      if (pads) for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { for (let j = 0; j < 16; j++) S.padPrev[j] = !!(pads[i].buttons[j] && pads[i].buttons[j].pressed); break; }
    } catch (e) { /* ignore */ }
    if (typeof requestAnimationFrame === 'function') S.raf = requestAnimationFrame(padPoll);
  }

  // ---------------------------------------------------------------- wrapping
  function enabled() { return typeof GFX === 'undefined' || GFX.heldDocs !== false; }
  function normal() {   // a non-reading event: make sure no held-document state lingers
    if (S.open) teardown();
    const ev = q('#event'); if (ev) ev.classList.remove('hd-on');
  }
  if (typeof showEvent === 'function') {
    const _showEvent = showEvent;
    showEvent = function (title, html, choices) {
      let src = null;
      if (enabled()) {
        if (S.pendingBook) src = BOOK;
        else if (Object.prototype.hasOwnProperty.call(SOURCES, title)) src = SOURCES[title];
      }
      if (!src) { normal(); return _showEvent(title, html, choices); }
      if (S.open) teardown();
      try { open(title, html, choices, src); } catch (e) {
        console.warn('held document failed, using the normal panel', e);
        teardown(); return _showEvent(title, html, choices);
      }
    };
  }
  if (typeof readLoreBook === 'function') {
    const _readLoreBook = readLoreBook;
    readLoreBook = function (idx) {
      S.pendingBook = true;
      try { return _readLoreBook(idx); } finally { S.pendingBook = false; }
    };
  }

  return {
    SOURCES, SIZES, state: () => ({ open: S.open, page: S.page, pages: S.pages, sizeIdx: S.sizeIdx }),
    open: (t, h, c, style) => open(t, h, c, SOURCES[t] || (style === 'book' ? BOOK : BOOK)),
    go, setSize, choose, dismiss, layout: () => layout(true),
  };
})();
