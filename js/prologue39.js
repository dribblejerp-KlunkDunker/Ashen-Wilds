// ============================================================
//  prologue39 - Phase 39, the prologue played through.
//
//  The prologue's pieces (Phases 5, 11, 13, 14, 15 and 38) had each been tested alone; test/prologue39.test.js
//  plays them in a row with a player's inputs. This file is the one thing the run lacked: an end. After the look
//  back and the title, the prologue's end card comes up with the run's numbers: how many days it took, the oil and
//  the pitch left, and who lived. Then you walk on.
//
//  WHAT THE BIBLE SAYS (searched before anything was invented): the prologue is six beats, the last of them "The look
//  back. At the top she turns and looks at the Slagcrown once, and says nothing. The title comes up: THE LONG
//  ACCOUNT." Then: "The walk south to Wexhaven is then the first leg on the Chart" (the-round-and-the-long-account.md).
//  Nothing gives an end card or its words. The card and every line on it are [PROPOSED] (ROADMAP.md, Phase 39).
//
//  The rule is pure: numbers(flags, env) reads what the earlier phases saved, and lines(n) words it. The wire shows
//  the card once, when the title has gone, and stores that it did in G.flags.la_prologue_end.
//
//  Switch: Options > "The prologue's end" (GFX.laPrologueEnd). Off, the title ends the prologue as Phase 15 left it.
//  The card is a page over the view, not something drawn in it, so the frame is the same either way.
//  Plain ASCII. No random number.
// ============================================================
'use strict';

const PROLOGUE39 = (() => {
  // the words [PROPOSED]
  const TX = {
    title: 'The ledge is behind you',
    lead: 'Marget Sayle is on your arm. The Bell Road goes south from here.',
    days: (n) => 'On the road: ' + n + (n === 1 ? ' day.' : ' days.'),
    oil: (s, cap, flasks) => 'The lantern: ' + mins(s, cap) + ' of oil, and ' + (flasks ? flasks + (flasks === 1 ? ' flask' : ' flasks') : 'no flasks') + ' in the pack.',
    noLantern: 'No lantern.',
    torch: (s, cap) => s > 0 ? 'The torch: ' + mins(s, cap) + ' of pitch.' : 'The torch is spent.',
    lived: (names) => 'Who lived: ' + names.join(', ') + '.',
    dead: (names) => 'Written in the roll: ' + names.join(', ') + '.',
    noDead: 'Nobody was written in the roll.',
    next: 'The walk south to Wexhaven is the first leg on the Chart. It is not built yet.',
    walkOn: 'Walk on',
  };
  const MARGET = 'Marget Sayle', OIL_CAP = 1080;
  // seconds of burning, against a full filling, in whole minutes: "9 of 18 minutes"
  function mins(s, cap) {
    const c = Math.max(1, Math.round((+cap || 60) / 60)), v = Math.max(0, +s || 0);
    if (v <= 0) return 'none of ' + c + ' minutes';
    if (v < 60) return 'under a minute of ' + c;
    return Math.min(c, Math.round(v / 60)) + ' of ' + c + (c === 1 ? ' minute' : ' minutes');
  }

  // ---------------------------------------------------------------- the rule, pure (Node runs it)
  // flags: G.flags. env: { day, startDay, name }. Returns the numbers the card shows.
  function numbers(flags, env) {
    const f = flags && typeof flags === 'object' ? flags : {}, e = env || {};
    const day = isFinite(+e.day) ? +e.day : 0, start = isFinite(+e.startDay) ? +e.startDay : day;
    const n = { days: Math.max(1, Math.floor(day - start) + 1), oil: null, oilCap: OIL_CAP, flasks: 0, torch: null, torchCap: 240, lived: [], dead: [] };
    const have = f.la_have || {};
    if (have.lantern || f.la_light === 'lantern') { n.oil = Math.max(0, Math.round(+f.la_oil || 0)); n.flasks = Math.max(0, +f.la_flasks || 0); }
    if (have.torch !== false && f.la_torch != null) { n.torch = Math.max(0, Math.round(+f.la_torch || 0)); n.torchCap = Math.max(1, +f.la_torch_cap || 240); }
    // who lived: the company roll (Phase 12), with the carter's own state (Phase 13) as the last word on him
    const c = f.la_company, people = c && Array.isArray(c.people) ? c.people : [];
    const carterDead = f.la_carter && f.la_carter.mode === 'dead';
    for (const p of people) {
      if (!p || typeof p !== 'object') continue;
      const name = String(p.name || (p.id === 'you' ? e.name : '') || 'The traveller');
      const alive = p.alive !== false && !(p.id === 'carter' && carterDead);
      (alive ? n.lived : n.dead).push(name);
    }
    if (!people.length) n.lived.push(String(e.name || 'The traveller'));
    if (f.la_marget_out || (f.la_carry && f.la_carry.on)) n.lived.push(MARGET);
    return n;
  }
  function lines(n) {
    const out = [TX.days(n.days)];
    out.push(n.oil == null ? TX.noLantern : TX.oil(n.oil, n.oilCap, n.flasks));
    if (n.torch != null) out.push(TX.torch(n.torch, n.torchCap));
    out.push(TX.lived(n.lived.length ? n.lived : ['nobody']));
    out.push(n.dead.length ? TX.dead(n.dead) : TX.noDead);
    return out;
  }

  // ---------------------------------------------------------------- the wire (browser only)
  const ST = { shown: 0, err: null };
  const sw = () => typeof GFX === 'undefined' || GFX.laPrologueEnd !== false;
  const esc = (s) => String(s).replace(/[&<>"]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]));
  function show() {
    const n = numbers(G.flags, { day: G.day, startDay: G.flags.la_day0, name: G.player && G.player.name });
    G.flags.la_prologue_end = true; ST.shown++;
    openModal(`<div style="text-align:center"><h2 style="font-family:var(--font-display);letter-spacing:.1em">${esc(TX.title)}</h2><p class="muted">${esc(TX.lead)}</p>`
      + lines(n).map((l) => `<p>${esc(l)}</p>`).join('')
      + `<p class="muted">${esc(TX.next)}</p><button class="dfbtn" id="la-walk-on">${esc(TX.walkOn)}</button></div>`, 'la-prologue-end');
    G.state = 'panel'; G.keys = {};
    const b = document.getElementById('la-walk-on');
    if (b) b.onclick = () => { closeModal(); G.state = 'play'; };
    return n;
  }
  function tick() {
    if (typeof G === 'undefined' || !G || !G.flags || !G.map || !G.map._la) return;
    // the day the run began, for the card's count (a save from before this phase counts from where it is)
    if (G.flags.la_day0 == null) G.flags.la_day0 = G.day || 0;
    if (!sw() || G.flags.la_prologue_end || !G.flags.la_title_seen) return;
    // the title is a modal of its own; the card waits until it has gone and the player is walking again
    if (G.state !== 'play' || G.openPanel) return;
    show();
  }
  function wire() {
    if (typeof window === 'undefined' || typeof update !== 'function' || typeof LEDGE1 === 'undefined') return false;
    const _up = update;
    update = function () { const r = _up.apply(this, arguments); try { tick(); } catch (e) { ST.err = ST.err || String(e && e.message); } return r; };
    LEDGE1.SWITCHES.push(['laPrologueEnd', "The prologue's end", 'After the title, a card with the run: days, oil and pitch left, who lived. Off: the title ends it']);
    return true;
  }
  const wired = wire();
  return { TX, numbers, lines, mins, show, state: () => ST, wired };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = PROLOGUE39;
