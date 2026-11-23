// ============================================================
//  bestiary32 - Phase 32, the seventeen entries in the book.
//
//  Source: docs/worldbuilding/bestiary.md, the seventeen-row table and the entries below it. Most senses
//  are the book's ratings (none, poor, fair, keen, acute), not invented metre figures. Only where the
//  book gives a distance is one repeated: the quarry-troll's noise reaches and the bloom's 8 m sight and
//  hearing. The Unnamed has its own entry in the book and is not one of the seventeen rows; the wider
//  world's hulk-conger is not either.
// ============================================================
'use strict';

const BESTIARY32 = (() => {
  const ROWS = [
    { id: 'goblin', name: 'Goblin', sight: 'keen, good in dark', hearing: 'keen', smell: 'fair', where: 'drains, glasshouse ranges, culverts', note: 'a swarming beast' },
    { id: 'ork', name: 'Ork', sight: 'fair', hearing: 'keen', smell: 'keen', where: 'stone dens, road choke points', note: 'a pack beast' },
    { id: 'ogre', name: 'Blackfen Ogre', sight: 'poor', hearing: 'fair', smell: 'acute', where: 'fen edge, farmland, its feeding ground', note: 'sees movement, not detail' },
    { id: 'quarry_troll', name: 'Blind Quarry-Troll', sight: 'none', hearing: 'acute', smell: 'poor', where: 'quarry, lime cuts, crags', note: 'walk 6 m, dodge 9 m, block 10 m, swing 12 m, sprint 14 m, clang 16 m, search 5 m; stone about half' },
    { id: 'gallery_crawler', name: 'The Roofed Mile animal (the gallery-crawler)', sight: 'fair', hearing: 'keen', smell: 'keen', where: 'galleries, culverts, upland', note: 'the animal stays unidentified' },
    { id: 'greymaw', name: 'Greymaw', sight: 'fair', hearing: 'keen', smell: 'acute', where: 'farmland, birch wood, road verges', note: 'wild dogs; they follow carts' },
    { id: 'peat_boar', name: 'Peat-boar', sight: 'poor', hearing: 'fair', smell: 'acute', where: 'reedbed, fen edge, farmland', note: 'charges in a line' },
    { id: 'gallows_heron', name: 'Gallows Heron', sight: 'acute', hearing: 'fair', smell: 'poor', where: 'mere, river, dead trees', note: 'its call brings others' },
    { id: 'harrow_eel', name: 'Harrow eel', sight: 'poor', hearing: 'fair', smell: 'keen', where: 'mere, flooded rooms, sluices', note: 'hearing is through the water' },
    { id: 'bloodwick', name: 'Bloodwick', sight: 'none', hearing: 'poor', smell: 'keen (warmth)', where: 'marsh, reedbed, standing water', note: 'a leech' },
    { id: 'ash_rat', name: 'Ash-rat', sight: 'poor', hearing: 'keen', smell: 'acute', where: 'drains, granaries, stores', note: 'where one is, many are' },
    { id: 'rustling', name: 'Rustling', sight: 'poor', hearing: 'poor', smell: 'keen (iron)', where: 'scrap piles, hinges, nail kegs', note: 'an iron beetle' },
    { id: 'ash_moth', name: 'Ash-moth', sight: 'fair (light)', hearing: 'poor', smell: 'fair', where: 'anywhere a flame burns', note: 'comes to a flame' },
    { id: 'ashbound', name: 'The Ashbound', sight: 'poor', hearing: 'fair', smell: 'poor', where: 'deep fen, reedbed, ruins', note: 'people; the book counts them with the dead' },
    { id: 'corpse_cap', name: 'Corpse-cap', sight: '-', hearing: '-', smell: '-', where: 'unburied dead, pits, folds', note: 'a growth, not a beast' },
    { id: 'walking_bloom', name: 'Walking bloom (Ash-Spore Husk)', sight: 'poor', hearing: 'poor', smell: '-', where: 'hollows, pits, still low ground', note: 'sees about 8 m in a 120-degree wedge; hears a sprint or a swing at about 8 m; fire burns spores' },
    { id: 'what_orks_fled', name: 'What the orks fled', sight: 'unknown', hearing: 'said to be acute', smell: 'unknown', where: 'below the Vaults, they say', note: 'unexplained by design' }
  ];
  const byId = (id) => ROWS.find((r) => r.id === id) || null;
  const sensesOf = (id) => { const r = byId(id); return r ? { sight: r.sight, hearing: r.hearing, smell: r.smell } : null; };
  const bloomHearing = () => byId('walking_bloom').note;
  const trollHearing = () => byId('quarry_troll').note;

  // ---------------------------------------------------------------- the page in the warning book
  const TX = {
    title: 'The beasts',
    lead: "The book's seventeen, in its order. Senses are the book's ratings; distances only where the book gives them.",
    sight: 'Sight', hearing: 'Hearing', smell: 'Smell', where: 'Where',
    open: 'The beasts', back: 'Back to the book', close: 'Close'
  };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function page() {
    const rows = ROWS.map((r, i) => `<div class="bestiary-entry" data-beast="${i + 1}">
      <h3>${i + 1}. ${esc(r.name)}</h3>
      <p><b>${TX.sight}:</b> ${esc(r.sight)} | <b>${TX.hearing}:</b> ${esc(r.hearing)} | <b>${TX.smell}:</b> ${esc(r.smell)}</p>
      <p><b>${TX.where}:</b> ${esc(r.where)}</p>
      <p>${esc(r.note)}</p>
    </div>`).join('');
    return `<h2>${TX.title}</h2><button class="dfbtn small close" id="bestiary-close" type="button">${TX.close}</button>
      <p class="muted">${TX.lead}</p><div class="bestiary-list">${rows}</div>
      <div class="btns"><button class="dfbtn" id="bestiary-back" type="button">${TX.back}</button></div>`;
  }

  function open() {
    if (typeof openModal !== 'function' || typeof document === 'undefined') return false;
    if (typeof G !== 'undefined' && G) G.state = 'panel';
    openModal(page(), 'log');
    const back = document.getElementById('bestiary-back');
    if (back) back.onclick = () => {
      if (typeof renderLog === 'function') renderLog();
      else { if (typeof closeModal === 'function') closeModal(); if (typeof G !== 'undefined' && G) G.state = 'play'; }
    };
    const close = document.getElementById('bestiary-close');
    if (close) close.onclick = () => { if (typeof closeModal === 'function') closeModal(); if (typeof G !== 'undefined' && G) G.state = 'play'; };
    return true;
  }

  let wired = false;
  function wire() {
    if (wired || typeof window === 'undefined' || typeof document === 'undefined' || typeof renderLog !== 'function') return false;
    const _renderLog = renderLog;
    renderLog = function () {
      const r = _renderLog.apply(this, arguments);
      try {
        if (typeof G === 'undefined' || !G || G.openPanel !== 'log') return r;
        if (!document.getElementById('book-search') || document.getElementById('bestiary-open')) return r;
        const panel = document.getElementById('modal-panel');
        const list = document.getElementById('book-list');
        if (!panel) return r;
        const block = document.createElement('div');
        block.className = 'btns';
        const btn = document.createElement('button');
        btn.className = 'dfbtn'; btn.id = 'bestiary-open'; btn.type = 'button'; btn.textContent = TX.open;
        btn.onclick = () => open();
        block.appendChild(btn);
        if (list && list.parentNode === panel) panel.insertBefore(block, list); else panel.appendChild(block);
      } catch (e) { /* the warning book still opens */ }
      return r;
    };
    wired = true;
    return true;
  }

  return { ROWS, TX, byId, sensesOf, bloomHearing, trollHearing, page, open, wire, isWired: () => wired };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = BESTIARY32;
if (typeof window !== 'undefined') BESTIARY32.wire();
