// ============================================================
//  partner19 — Phase 19 "Together", team PARTNER: the second traveller in the host's world.
//
//  PARTNER19 CONTRACT (stable; NET and SYNC code against it)
//  ---------------------------------------------------------------------------------------------------------------
//  HOST SIDE (NET19.role() === 'host', or no network at all: the local / hot-seat API the tests drive)
//   PARTNER19.join(card, opts?)  -> { ok, reason?, partner? }  The guest's character CARD (below) is validated and clamped
//                                   (no impossible stats or items). One partner at a time. opts: { seed?: int } seeds the
//                                   partner's own RNG stream (the host's Math.random is never used for the partner).
//   PARTNER19.input(cmd)         -> { ok, reason? }   One guest command (INPUT below): shape, ranges, size and rate checked;
//                                   the guest may only act as its own traveller; story commands are refused.
//   PARTNER19.leave(reason?)     -> WB | null         Ends the session; returns the write-back message for the guest's own
//                                   save (with NET19 present the host also sends it as 'p19p:wb').
//   PARTNER19.active()           -> boolean
//   PARTNER19.snapshot()         -> PSNAP | null      The partner as the guest needs to see it, for SYNC's snapshots:
//                                   { name, cls, face, map, x, y, dir, hp, hpMax, voice, voiceMax, lvl, xp, down, downLeft,
//                                     revive, act, weapon, loot: 'host'|'guest' (whose drop is next), xpEarned }
//   PARTNER19.hostState()        -> { hp, hpMax, down, downLeft, revive }   the host's own state, for the guest's HUD
//   PARTNER19.setPose({ x, y, dir, feet, spd }) -> boolean   SYNC (the mover of the guest's traveller) places the partner
//                                   on the host's map each input: position in tiles, facing in radians, feet height, walking
//                                   speed in tiles/s (for the gait). Validated (finite, on the map); ignored while paused;
//                                   a downed partner keeps its facing. The partner's own mover stands aside while poses come.
//   PARTNER19.pause(on)          -> the guest dropped (NET reconnecting): the partner steps out of the world (not drawn,
//                                   not targetable, timers frozen) until pause(false). The host carries on alone.
//   PARTNER19.onStory(fn)        -> subscribe to the read-only copy of every story scene the host sees (STORY below).
//                                   With NET19 present each one is also sent as 'p19p:story'.
//   PARTNER19.drainFeed()        -> [{ text, cls }]   messages meant for the guest (blows they took, their loot) since
//                                   the last call; SYNC forwards them. The host never sees them in its own message line.
//  GUEST SIDE
//   PARTNER19.guest.card(src?, opts?) -> CARD | { error }  src: omitted = the live game (G.player); or a save object (a
//                                   session slot or a decoded save code; opts.slot = that slot's index: it gets the
//                                   write-back too). Hardcore runs cannot travel.
//   PARTNER19.guest.enter()      -> boolean   Puts the guest's own game aside (EXTRAS17 isolation, a hidden registration)
//                                   while the guest plays in the host's world. SYNC calls it before taking over G.
//   PARTNER19.guest.returnHome(wb?) -> { ok, reason?, gained? }   Gives the guest's own game back and applies a validated
//                                   write-back to it (only to it). Without a valid wb the game comes back unchanged.
//   PARTNER19.guest.applyWriteBack(wb, player?) -> { ok, reason?, gained? }   validate + apply (default: the home save).
//   PARTNER19.guest.showStory(STORY) / hideStory()   the read-only story panel (text only; no choices can be made).
//  MESSAGES (type strings for NET19.on / NET19.send; JSON objects, every one size-capped and validated on receipt)
//   guest->host 'p19p:join' CARD · 'p19p:in' INPUT · 'p19p:leave' {}
//   host->guest 'p19p:joined' { ok, reason? } · 'p19p:story' STORY · 'p19p:wb' WB · 'p19p:host' hostState()
//  SYNC HOOKS: SYNC19 passes each guest input frame to PARTNER19.input(cmd), puts snapshot(), hostState() and
//   drainFeed() in its snapshots, and calls pause(true / false) on a drop / reconnect.
//  CARD  { v:1, token:[A-Za-z0-9]{8,32}, name, cls, face:1-6, level, xp, attrs:{8 ATTRS}, weapons:[ids], weapon:int,
//          armor:{slot:id}, pellets, bolts, glass }
//  INPUT { t:'move', f:-1..1, s:-1..1, run:bool } | { t:'look', dir:rad } | { t:'turn', d:rad } | { t:'attack', label? }
//        | { t:'block' } | { t:'song', id:'tending'|'fifth' } | { t:'weapon', i:int } | { t:'use' } | { t:'revive' }
//        refused: 'choose', 'talk', 'flag', 'quest', 'interact', 'save' (the story and the world's choices are the host's)
//  STORY { kind:'event'|'dialogue'|'close'|'death'|'ending', title, text, choices:[text], host }   plain text, never markup
//  WB    { v:1, token, xp, kills, gold, items:[{id,n}], spent:{pellets,bolts} }
//
//  THE RULES (numbers in B below, one table)
//   * Aggro: an enemy that is chasing picks one of the two travellers and re-thinks every B.AGGRO_RETHINK s: the nearer
//     one, pulled toward whoever has hurt it most (B.THREAT_PULL tiles per point of damage, decaying), and it only
//     switches when the other is better by B.AGGRO_STICK tiles. A sleeping enemy notices the partner by sight (B.SIGHT)
//     or close by (B.HEAR). A downed traveller is never a target. When the target is the partner, the game's own enemy
//     code runs with the partner standing in for the player (position, armour, agility, calling), so every enemy fights
//     the partner exactly as it fights the player; blows go to the partner, never to the host.
//   * Friendly fire is off: the partner is not an entity, so nothing the host does can hit it, and the partner's blows
//     only look for enemies (never townsfolk: the law is the host's world).
//   * Downed and revive: at 0 health a traveller falls. The other lifts them by standing within B.REVIVE_RANGE for
//     B.REVIVE_TIME s (it drains back when they step away) inside B.DOWN_WINDOW s. A downed host cannot move or fight.
//     Out of time: a downed host dies (the death screen); a downed partner is carried to the map's lamp and wakes there.
//     Both down at once: the host's death screen. Story deaths (heartglass, too still, the oaks) are never softened.
//   * Shared XP: every kill gives both travellers its full XP (B.XP_SHARE); quest XP gives the partner B.QUEST_XP_SHARE.
//   * Loot by turns: each drop from a fallen enemy goes in turn, host first, then the partner, then the host... The HUD
//     says whose drop is next and the message line says who got each one. The partner's drops never touch the floor or
//     the host's save; they are written back to the guest's own save when the session ends.
//   * Scaling for two: while a partner is in the world every enemy has B.HP_SCALE (bosses B.BOSS_HP_SCALE) times its
//     health and hits B.DMG_SCALE times as hard. The host's save always stores unscaled health.
//   * Story: dialogue, choices and scenes stay the host's. The guest sees a read-only copy; no guest input can talk,
//     choose, set a flag or trigger a scene (story triggers fire only for the host's camera).
//   * The host's save holds the world and never the guest's character (the partner lives in this module's closure only).
//
//  SINGLE PLAYER: with nobody joined every wrapper below returns the original's result straight away, reads nothing
//  else and never calls Math.random: same frames, same RNG order, same saves (pinned by test/partner19.test.js).
//  Art: the partner's figure is procedural stand-in art, painted by Phase 18's ghost painter (GHOST18.paintFigure) in
//  solid colours: a blue travelling cloak, the calling's accent, the face's hair; cached, never per frame.
// ============================================================
'use strict';

const PARTNER19 = (function () {
  // ---------------------------------------------------------------- balance, one table
  const B = {
    HP_SCALE: 1.6,            // enemy health with two travellers in the world
    BOSS_HP_SCALE: 1.8,       // boss health with two travellers
    DMG_SCALE: 1.1,           // enemy blows (to either traveller) with two in the world
    XP_SHARE: 1.0,            // each kill: the other traveller also gets this fraction of its XP
    QUEST_XP_SHARE: 0.5,      // the host's quest XP: the partner's fraction
    AGGRO_RETHINK: 0.75,      // seconds between an enemy's choices of target
    AGGRO_STICK: 1.5,         // tiles the other traveller must be "better" by before an enemy switches
    THREAT_PULL: 0.12,        // tiles of pull per point of damage dealt to that enemy
    THREAT_DECAY: 0.15,       // fraction of threat lost per second
    THREAT_MAX: 60,           // threat cap (points of damage remembered)
    SIGHT: 5, HEAR: 1.8,      // a sleeping enemy notices the partner: in sight within SIGHT tiles, or within HEAR tiles
    DOWN_WINDOW: 25,          // seconds a downed traveller can still be lifted
    REVIVE_TIME: 3.0,         // seconds the other must stand beside them
    REVIVE_RANGE: 1.6,        // tiles
    REVIVE_DRAIN: 1.0,        // revive progress lost per second away from them
    REVIVE_HP: 0.35,          // fraction of health a lifted traveller gets back
    WAKE_HP: 0.5,             // a partner carried to the lamp wakes with this fraction
    BLOCK_T: 0.6, BLOCK_K: 0.5,   // the partner's block: seconds raised, damage taken off
    LEVEL_CAP: 30,            // [PROPOSED] the highest level a card may carry (Book One reaches the low teens)
    SIGN_MAX: 5,              // a birth sign's attribute bonus (calendar11 SIGN_BONUS)
    CARD_MAX: 8192, MSG_MAX: 2048, WB_MAX: 16384,      // bytes
    RATE: 60, BURST: 90,      // guest inputs per second, and the burst allowed
    WB_MAX_XP: 60000, WB_MAX_GOLD: 5000, WB_MAX_ITEMS: 60, WB_MAX_N: 20, WB_QUEST_XP: 3000,
    FOLLOW: 1.2,              // tiles behind the host where the partner arrives on a new map
    POSE_HOLD_MS: 200,        // after setPose() the partner's own mover waits this long for the next pose
  };

  // ---------------------------------------------------------------- text (all of it; see TEXT.md and tools/i18n/p19-partner.tsv)
  const LIST = [];
  const T = (t) => { LIST.push(t); return t; };
  const TX = {
    joins: T('{0} joins you on the road.'),
    leaves: T('{0} goes home, with what they earned.'),
    paused: T('{0} has lost the thread for a moment. You carry on.'),
    back: T('{0} is back beside you.'),
    lootHost: T('Loot by turns: this one is yours. The next is {0}\'s.'),
    lootGuest: T('Loot by turns: {1} goes to {0}. The next is yours.'),
    downHost: T('You fall. {0} can lift you: stand fast, {1} seconds.'),
    downGuest: T('{0} is down! Stand beside them to lift them ({1} seconds).'),
    liftedHost: T('{0} gets you back on your feet.'),
    liftedGuest: T('You get {0} back on their feet.'),
    lampGuest: T('Nobody reached {0} in time. They wake by the lamp, bruised.'),
    leftDown: T('{0} drags you clear before they go.'),
    hudLv: T('Lv {0}'),
    hudNextYou: T('Next drop: yours'),
    hudNextThem: T('Next drop: {0}'),
    hudDown: T('Down: {0} s'),
    hudLift: T('Lifting…'),
    hudAway: T('Reconnecting…'),
    tagDown: T('DOWN'),
    hostDownBar: T('You are down. {0} can lift you: {1} s'),
    storyHead: T('The story is the host\'s'),
    storyWait: T('{0} is choosing.'),
    storyNoChoice: T('Only the host can choose. You see what they see.'),
    coopTitle: T('Playing together'),
    // the guest's own feed (they read it on their screen, through SYNC)
    gHit: T('{0} hits you for {1}.'),
    gMiss: T('You miss {0}.'),
    gLand: T('Your blow lands on {0} for {1}.'),
    gAir: T('Your swing finds nothing but air.'),
    gNoAmmo: T('No ammunition.'),
    gKill: T('You destroy {0}.'),
    gLevel: T('You reach level {0}.'),
    gTend: T('You sing the tending note, low. Something knits.'),
    gFifth: T('You sing the falling fifth. {0} of them stop for a breath.'),
    gQuiet: T('You open your mouth and nothing comes out. The air here cannot carry it.'),
    gVoice: T('Your voice is torn. There is nothing left in it.'),
    gLoot: T('Loot by turns: you get {0}.'),
    gGold: T('{0} sovereigns'),
  };
  const fmt = (s, ...a) => String(s).replace(/\{(\d+)\}/g, (m, i) => (a[+i] == null ? '' : String(a[+i])));

  // ---------------------------------------------------------------- small helpers
  const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const clampN = (v, a, b) => (v < a ? a : v > b ? b : v);
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const intIn = (v, lo, hi, d) => (isNum(v) ? clampN(Math.floor(v), lo, hi) : d);
  const numIn = (v, lo, hi, d) => (isNum(v) ? clampN(v, lo, hi) : d);
  const TOKEN_RE = /^[A-Za-z0-9]{8,32}$/;
  const warned = {};
  const warnOnce = (k, e) => { if (!warned[k]) { warned[k] = true; console.warn('partner19 ' + k, e); } };
  const hasGame = () => typeof G !== 'undefined' && G && typeof Engine !== 'undefined';
  const sayHost = (t, c, ms) => { try { msg(t, c, ms); } catch (e) { /* the message line is cosmetic */ } };
  function mulberry(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const needXp = (lv) => Math.floor(60 * Math.pow(lv, 1.5));
  function hpFor(cls, a, lv) { return cls.hp + Math.floor(a.Endurance / 10) + (lv - 1) * (4 + Math.floor(a.Endurance / 20)); }
  function voiceFor(cls, a, lv) { return cls.voice + Math.floor(a.Willpower / 10) + (lv - 1) * (2 + Math.floor(a.Willpower / 20)); }
  // how far the biography can move each attribute away from the calling's base (from js/data.js, so it follows the data)
  let BIO = null;
  function bioRange() {
    if (BIO) return BIO;
    BIO = { pos: {}, neg: {} }; for (const a of ATTRS) { BIO.pos[a] = 0; BIO.neg[a] = 0; }
    for (const q of (typeof BIOGRAPHY !== 'undefined' ? BIOGRAPHY : [])) {
      for (const a of ATTRS) {
        let hi = 0, lo = 0;
        for (const ans of q.a) { const m = (ans.mod && ans.mod[a]) || 0; if (m > hi) hi = m; if (m < lo) lo = m; }
        BIO.pos[a] += hi; BIO.neg[a] += -lo;
      }
    }
    return BIO;
  }
  // the items a fallen enemy can drop (LOOT tables): the only things the partner can earn, so the only things a
  // write-back may carry
  let LOOTABLE = null;
  function lootable() {
    if (LOOTABLE) return LOOTABLE;
    LOOTABLE = new Set();
    for (const k in LOOT) for (const [id] of LOOT[k].table) if (own(ITEMS, id) && !ITEMS[id].key) LOOTABLE.add(id);
    return LOOTABLE;
  }
  // plain text from the host's own scene markup (constants and the host's own name only), for the read-only copy
  function plain(html, n) {
    let s = String(html == null ? '' : html).replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
    try { s = new DOMParser().parseFromString('<body>' + s + '</body>', 'text/html').body.textContent || ''; } catch (e) { s = s.replace(/<[^>]*>/g, ''); }
    return s.replace(/[\u0000-\u0008\u000b-\u001f]/g, '').slice(0, n || 4000);
  }

  // ---------------------------------------------------------------- state (the partner lives here and nowhere else)
  const S = {
    active: false, paused: false, pp: null, look: null, token: '', rng: null,
    map: null, x: 0, y: 0, dir: 0, feet: 0, prox: null, vx: 0, vy: 0, held: { f: 0, s: 0, run: false },
    atkT: 0, songT: 0, blockT: 0, act: 0, actT: 0, actDur: 0, hurtT: 0, stride: 0, spd: 0,
    down: false, downT: 0, revive: 0,
    hostDown: false, hostDownT: 0, hostSrc: '', hostRevive: 0,
    lootTurn: 'host', earned: null, feed: [], bucket: B.BURST, lastIn: 0,
    storyOpen: false, storySubs: [], storyLog: [], screen: null,
    stats: { inputs: 0, refused: 0, rate: 0, swapped: 0, partnerHits: 0, hostHits: 0, drawn: 0 },
  };
  const CTX = { swapped: false, cur: null, noScale: false, forceDie: false, killer: null };
  const STORY_DEATH = new Set(['heartglass', 'unwrite', 'greening']);
  function feed(text, cls) { S.feed.push({ text: String(text).slice(0, 300), cls: cls || '' }); if (S.feed.length > 40) S.feed.shift(); }
  const pname = () => (S.pp ? S.pp.name : '');
  const sameMap = () => S.active && !S.paused && S.map === G.mapId;

  // ================================================================ CARD VALIDATION (host side: the guest is untrusted)
  function validateCard(c) {
    const bad = (reason) => ({ ok: false, reason });
    if (!c || typeof c !== 'object' || Array.isArray(c)) return bad('not-a-card');
    let size = 0; try { size = JSON.stringify(c).length; } catch (e) { return bad('not-a-card'); }
    if (size > B.CARD_MAX) return bad('too-big');
    if (c.v !== 1) return bad('version');
    if (typeof c.token !== 'string' || !TOKEN_RE.test(c.token)) return bad('token');
    if (c.hardcore === true) return bad('hardcore');
    const cls = CLASSES.find((k) => k.id === c.cls); if (!cls) return bad('calling');
    const clamped = [];
    const name = cleanName(typeof c.name === 'string' ? c.name : '');
    const face = [1, 2, 3, 4, 5, 6].includes(c.face) ? c.face : 1;
    const level = intIn(c.level, 1, B.LEVEL_CAP, 1); if (level !== c.level) clamped.push('level');
    const xp = intIn(c.xp, 0, needXp(level) - 1, 0); if (xp !== c.xp) clamped.push('xp');
    const R = bioRange(), attrs = {}, ca = c.attrs && typeof c.attrs === 'object' ? c.attrs : {};
    for (const a of ATTRS) {
      const base = cls.attrs[a], lo = Math.max(1, base - R.neg[a]), hi = Math.min(100, base + R.pos[a] + B.SIGN_MAX);
      attrs[a] = intIn(ca[a], lo, hi, base); if (attrs[a] !== ca[a]) clamped.push(a);
    }
    let weapons = [];
    for (const w of (Array.isArray(c.weapons) ? c.weapons.slice(0, 24) : [])) {
      if (typeof w !== 'string' || !own(WEAPONS, w) || weapons.includes(w)) { clamped.push('weapon'); continue; }
      if (WEAPONS[w].innate && !cls.weapons.includes(w)) { clamped.push('weapon'); continue; }   // a glass arm is a calling, not an item
      weapons.push(w);
    }
    if (weapons.length > 12) weapons = weapons.slice(0, 12);
    if (!weapons.length) weapons = cls.weapons.slice();
    const weapon = intIn(c.weapon, 0, weapons.length - 1, 0);
    const armor = {}, ca2 = c.armor && typeof c.armor === 'object' ? c.armor : {};
    for (const [slot] of ARMOR_SLOTS) { const id = ca2[slot]; if (typeof id === 'string' && own(ARMOR, id) && ARMOR[id].slot === slot) armor[slot] = id; else if (id != null) clamped.push(slot); }
    const hpMax = hpFor(cls, attrs, level), voiceMax = voiceFor(cls, attrs, level);
    return {
      ok: true, clamped,
      char: { token: c.token, name, cls, face, level, xp, attrs, weapons, weapon, armor, hpMax, voiceMax,
        pellets: intIn(c.pellets, 0, 99, 0), bolts: intIn(c.bolts, 0, 99, 0), glass: cls.glass ? numIn(c.glass, 0, 95, 42) : 0 },
    };
  }
  // the stand-in for G.player while an enemy fights the partner (only the fields game code reads from a player)
  function makePP(ch) {
    return {
      name: ch.name, cls: ch.cls, face: ch.face, attrs: Object.assign({}, ch.attrs), level: ch.level, xp: ch.xp,
      hp: ch.hpMax, hpMax: ch.hpMax, voice: ch.voiceMax, voiceMax: ch.voiceMax, fat: ch.attrs.Strength + ch.attrs.Endurance, fatMax: ch.attrs.Strength + ch.attrs.Endurance,
      weapons: ch.weapons.slice(), weapon: ch.weapon, armor: Object.assign({}, ch.armor), inv: Object.values(ch.armor).map((id) => ({ id, n: 1 })),
      glass: ch.glass, glassed: !!ch.cls.glass, pellets: ch.pellets, bolts: ch.bolts, gold: 0, songs: ch.cls.songs.slice(), fragments: 0, kills: 0,
      perks: {}, perkPoints: 0, needs: false, hunger: 100, sleep: 100, hardcore: false, feet: 0, partner19: true,
    };
  }

  // ================================================================ JOIN / LEAVE (host)
  function join(card, opts) {
    if (!hasGame() || !G.player || !G.map) return { ok: false, reason: 'no-game' };
    if (S.active) return { ok: false, reason: 'full' };
    try { if (typeof EXTRAS17 === 'object' && EXTRAS17.inExtra && EXTRAS17.inExtra()) return { ok: false, reason: 'host-in-extra' }; } catch (e) { /* ignore */ }
    const v = validateCard(card); if (!v.ok) return v;
    const ch = v.char;
    S.pp = makePP(ch); S.token = ch.token;
    const seed = opts && isNum(opts.seed) ? (opts.seed >>> 0) : hashStr(ch.token);
    S.rng = mulberry(seed || 1);
    S.active = true; S.paused = false; S.down = false; S.hostDown = false; S.revive = 0; S.hostRevive = 0;
    S.held = { f: 0, s: 0, run: false }; S.vx = S.vy = 0; S.atkT = S.songT = S.blockT = S.actT = S.hurtT = 0; S.act = 0;
    S.lootTurn = 'host'; S.earned = { xp: 0, kills: 0, gold: 0, items: {}, spent: { pellets: 0, bolts: 0 } };
    S.feed.length = 0; S.bucket = B.BURST; S.lastIn = 0; S.storyOpen = false;
    S.prox = { kind: 'p19partner', x: 0, y: 0, feet: 0 };
    lookFor();
    placeBehindHost();
    scaleAll();
    ui.build();
    sayHost(fmt(TX.joins, ch.name), 'good', 5000);
    return { ok: true, clamped: v.clamped, partner: snapshot() };
  }
  function leave(reason) {
    if (!S.active) return null;
    if (S.hostDown) { S.hostDown = false; const p = G.player; p.hp = Math.max(1, Math.ceil(p.hpMax * B.REVIVE_HP)); sayHost(fmt(TX.leftDown, pname()), 'good', 5000); }
    unscaleAll();
    for (const id in G.maps) for (const e of G.maps[id].entities) { delete e.p19t; delete e.p19r; delete e.p19th; }
    const E = S.earned;
    const items = Object.keys(E.items).filter((id) => E.items[id] > 0).slice(0, B.WB_MAX_ITEMS).map((id) => ({ id, n: Math.min(B.WB_MAX_N, E.items[id]) }));
    const wb = { v: 1, token: S.token, xp: Math.min(B.WB_MAX_XP, E.xp | 0), kills: E.kills | 0, gold: Math.min(B.WB_MAX_GOLD, E.gold | 0), items, spent: { pellets: E.spent.pellets | 0, bolts: E.spent.bolts | 0 } };
    const nm = pname();
    S.active = false; S.paused = false; S.pp = null; S.down = false; S.screen = null;
    ui.remove();
    if (reason !== 'silent') sayHost(fmt(TX.leaves, nm), '', 5000);
    net.send('p19p:wb', wb);
    return wb;
  }
  function pause(on) {
    if (!S.active) return false;
    on = !!on; if (on === S.paused) return true;
    S.paused = on; S.held = { f: 0, s: 0, run: false };
    sayHost(fmt(on ? TX.paused : TX.back, pname()), on ? 'warn' : 'good', 4000);
    if (!on && S.map !== G.mapId) placeBehindHost();
    return true;
  }
  function lookFor() {
    // the ghost painter's own reading of a player's look, run on the partner
    S.look = { cls: 0, face: S.pp.face, wpn: 1, arm: 0 };
    try { if (typeof GHOST18 === 'object' && GHOST18.lookNow) { const keep = G.player; G.player = S.pp; try { S.look = GHOST18.lookNow(); } finally { G.player = keep; } } } catch (e) { warnOnce('look', e); }
  }
  function placeBehindHost() {
    const c = Engine.cam; S.map = G.mapId;
    const tries = [[Math.PI, B.FOLLOW], [Math.PI * 0.7, B.FOLLOW], [-Math.PI * 0.7, B.FOLLOW], [Math.PI / 2, 1.0], [-Math.PI / 2, 1.0], [Math.PI, 2.0], [0, 1.2]];
    let px = c.x, py = c.y;
    for (const [a, d] of tries) {
      const x = c.x + Math.cos(c.dir + a) * d, y = c.y + Math.sin(c.dir + a) * d;
      S.prox.x = x; S.prox.y = y; S.prox.feet = groundAt(x, y);
      if (!_solidAt(x, y, S.prox) && los(c.x, c.y, x, y)) { px = x; py = y; break; }
    }
    S.x = px; S.y = py; S.dir = c.dir; S.feet = groundAt(px, py); S.vx = S.vy = 0;
    syncProx();
  }
  // SYNC (or any driver) places the partner: a validated pose on the host's map. The partner's own mover stands aside
  // while poses keep coming (B.POSE_HOLD_MS); a downed partner keeps its facing.
  function setPose(p) {
    if (!S.active || S.paused || !p || typeof p !== 'object' || !hasGame() || !G.map) return false;
    const { x, y, dir, feet, spd } = p;
    if (!isNum(x) || !isNum(y) || x < 0 || y < 0 || x > G.map.w || y > G.map.h) return false;
    S.map = G.mapId; S.x = x; S.y = y; S.vx = 0; S.vy = 0;
    if (isNum(dir) && !S.down) S.dir = normAng(dir);
    S.feet = isNum(feet) ? feet : groundAt(x, y);
    syncProx();
    S.ext = { at: performance.now(), spd: isNum(spd) ? clampN(spd, 0, 20) : 0 };
    return true;
  }
  function groundAt(x, y) { const m = G.map; return m && (m.lvls || m.smooth) ? m.groundAt(x, y) : 0; }
  function syncProx() { S.prox.x = S.x; S.prox.y = S.y; S.prox.feet = S.feet; if (S.pp) S.pp.feet = S.feet; }

  // ================================================================ SCALING FOR TWO
  const isBoss = (d) => !!(d && (d.boss || d.wildsBoss || d.codaBoss));
  function scaleEnt(e) {
    if (!e || e.kind !== 'enemy' || !e.def || e.p19s) return;
    const k = isBoss(e.def) ? B.BOSS_HP_SCALE : B.HP_SCALE;
    e.p19s = k;
    if (isNum(e.hp) && e.hp > 0) e.hp = Math.round(e.hp * k);
    e.hpMax = Math.round((isNum(e.hpMax) ? e.hpMax : e.def.hp) * k);
  }
  const unscaledHp = (e) => (isNum(e.hp) && e.hp > 0 ? Math.max(1, Math.round(e.hp / e.p19s)) : e.hp);
  function unscaleEnt(e) {
    if (!e || !e.p19s) return;
    e.hp = unscaledHp(e); e.hpMax = Math.round(e.hpMax / e.p19s); delete e.p19s;
  }
  // every hydrated enemy once (G.ents is usually the current map's own list, so it is not visited twice)
  function eachEnemy(fn) {
    const seen = new Set();
    const visit = (L) => { if (Array.isArray(L)) for (const e of L) if (e && e.kind === 'enemy' && e._h && !seen.has(e)) { seen.add(e); fn(e); } };
    if (G.maps) for (const id in G.maps) visit(G.maps[id].entities);
    visit(G.ents);
  }
  function scaleAll() { eachEnemy(scaleEnt); }
  function unscaleAll() { eachEnemy(unscaleEnt); }

  // ================================================================ PLAYING AS THE PARTNER (the swap)
  // While an enemy fights the partner, the game's own enemy code runs with the partner in the player's place:
  // the camera at the partner, G.player = the partner's stand-in, Math.random = the partner's stream. Everything is
  // put back in `finally`, and the host's timers (glass lock, webs, mute...) are restored so no blow meant for the
  // partner reaches the host.
  function asPartner(fn) {
    const c = Engine.cam, sx = c.x, sy = c.y, sz = c.z, sp = G.player, mr = Math.random;
    const keep = {}; for (const k in G) { if (typeof G[k] === 'number' && k !== 'time' && k !== 'noise' && k !== 'tod' && k !== 'day') keep[k] = G[k]; }
    CTX.swapped = true; S.stats.swapped++;
    c.x = S.x; c.y = S.y; c.z = S.feet + 0.88; G.player = S.pp; Math.random = S.rng;
    try { return fn(); } finally {
      CTX.swapped = false; c.x = sx; c.y = sy; c.z = sz; G.player = sp; Math.random = mr;
      for (const k in keep) G[k] = keep[k];
    }
  }
  function withRng(fn) { const mr = Math.random; Math.random = S.rng; try { return fn(); } finally { Math.random = mr; } }

  // ================================================================ AGGRO
  function threat(e, who, dmg) {
    if (!e || !(dmg > 0)) return;
    const t = e.p19th || (e.p19th = [0, 0]);
    t[who] = Math.min(B.THREAT_MAX, t[who] + dmg);
  }
  function chooseTarget(e, dt) {
    const hostOk = !S.hostDown, guestOk = !S.down;
    if (!hostOk && !guestOk) return 'none';
    const c = Engine.cam, dg = Math.hypot(S.x - e.x, S.y - e.y);
    // a sleeping enemy can notice the partner too
    if (guestOk && e.state === 'idle' && !e.guard && (dg < B.HEAR || (dg < B.SIGHT && los(e.x, e.y, S.x, S.y)))) {
      e.state = 'chase'; e.alertT = 8; e.p19t = 'guest'; e.p19r = B.AGGRO_RETHINK;
      try { Audio_.sfx.enemy(e.def, 'alert'); } catch (x) { /* sound only */ }
    }
    if (e.state !== 'chase') return hostOk ? 'host' : 'idle';
    if (!guestOk) { e.p19t = 'host'; return 'host'; }
    if (!hostOk) { e.p19t = 'guest'; return 'guest'; }
    const th = e.p19th; if (th) { const k = Math.exp(-B.THREAT_DECAY * dt); th[0] *= k; th[1] *= k; }
    e.p19r = (e.p19r || 0) - dt;
    if (!e.p19t || e.p19r <= 0) {
      e.p19r = B.AGGRO_RETHINK;
      const dh = Math.hypot(c.x - e.x, c.y - e.y);
      const sh = dh - B.THREAT_PULL * (th ? th[0] : 0), sg = dg - B.THREAT_PULL * (th ? th[1] : 0);
      if (!e.p19t) e.p19t = sg < sh ? 'guest' : 'host';
      else if (e.p19t === 'host' && sg < sh - B.AGGRO_STICK) e.p19t = 'guest';
      else if (e.p19t === 'guest' && sh < sg - B.AGGRO_STICK) e.p19t = 'host';
    }
    return e.p19t;
  }

  // ================================================================ DOWNED AND REVIVE
  function partnerHurt(dmg, src) {
    const p = S.pp; if (!p || S.down) return;
    let d = dmg; if (S.blockT > 0) d = Math.max(1, Math.round(d * (1 - B.BLOCK_K)));
    p.hp -= d; S.hurtT = 0.3; S.stats.partnerHits++;
    feed(fmt(TX.gHit, src, d), 'bad');
    if (p.hp <= 0) partnerDown(src);
  }
  function partnerDown(src) {
    if (S.down) return;
    S.down = true; S.downT = B.DOWN_WINDOW; S.revive = 0; S.pp.hp = 0; S.held = { f: 0, s: 0, run: false }; S.vx = S.vy = 0;
    sayHost(fmt(TX.downGuest, pname(), B.DOWN_WINDOW), 'bad', 6000);
    ui.hud();
    if (S.hostDown) bothDown(src);
  }
  function hostDown(src) {
    S.hostDown = true; S.hostDownT = B.DOWN_WINDOW; S.hostSrc = String(src || ''); S.hostRevive = 0;
    const p = G.player; p.hp = 0; G.dragBody = null; G.keys = {}; G.vel.x = G.vel.y = 0;
    try { G.hurtT = 0.25; fx('hurt', 300); } catch (e) { /* cosmetic */ }
    sayHost(fmt(TX.downHost, pname(), B.DOWN_WINDOW), 'bad', 7000);
    ui.hud();
  }
  function bothDown(src) {
    S.hostDown = false;
    CTX.forceDie = true; try { die(S.hostSrc || src); } finally { CTX.forceDie = false; }
  }
  function liftHost() {
    S.hostDown = false; S.hostRevive = 0; const p = G.player; p.hp = Math.max(1, Math.ceil(p.hpMax * B.REVIVE_HP));
    sayHost(fmt(TX.liftedHost, pname()), 'good', 4000);
  }
  function liftPartner() {
    S.down = false; S.revive = 0; S.pp.hp = Math.max(1, Math.ceil(S.pp.hpMax * B.REVIVE_HP));
    sayHost(fmt(TX.liftedGuest, pname()), 'good', 4000);
  }
  function tickDowns(dt) {
    const c = Engine.cam, near = Math.hypot(c.x - S.x, c.y - S.y) <= B.REVIVE_RANGE;
    if (S.down) {
      S.downT -= dt;
      if (!S.hostDown && near) S.revive += dt; else S.revive = Math.max(0, S.revive - dt * B.REVIVE_DRAIN);
      if (S.revive >= B.REVIVE_TIME) liftPartner();
      else if (S.downT <= 0) {
        // carried to the lamp: the partner wakes at the map's spawn
        S.down = false; S.revive = 0; S.pp.hp = Math.max(1, Math.ceil(S.pp.hpMax * B.WAKE_HP));
        const s = G.map.spawn || { x: c.x, y: c.y, dir: c.dir }; S.x = s.x; S.y = s.y; S.dir = s.dir || 0; S.feet = groundAt(S.x, S.y); syncProx();
        sayHost(fmt(TX.lampGuest, pname()), 'warn', 6000);
      }
    }
    if (S.hostDown) {
      S.hostDownT -= dt;
      if (!S.down && near) S.hostRevive += dt; else S.hostRevive = Math.max(0, S.hostRevive - dt * B.REVIVE_DRAIN);
      if (S.hostRevive >= B.REVIVE_TIME) liftHost();
      else if (S.hostDownT <= 0) { const src = S.hostSrc; S.hostDown = false; CTX.forceDie = true; try { die(src); } finally { CTX.forceDie = false; } }
    }
  }

  // ================================================================ THE PARTNER'S OWN ACTIONS
  const POSE = { 'slash right': 1, 'slash left': 2, 'chop down': 3, 'cut up': 4, thrust: 5 };
  function setAct(a, dur) { S.act = a; S.actT = dur; S.actDur = dur; }
  function partnerWeapon() { const p = S.pp; return WEAPONS[p.weapons[p.weapon]] || WEAPONS.hands; }
  function partnerAttack(label) {
    const p = S.pp, w = partnerWeapon();
    if (S.down || S.atkT > 0 || S.songT > 0) return { ok: false, reason: 'busy' };
    if (w.ammo) { const k = w.ammo; if (!((p[k] || 0) > 0)) { feed(TX.gNoAmmo, 'bad'); return { ok: false, reason: 'ammo' }; } p[k]--; S.earned.spent[k] = (S.earned.spent[k] || 0) + 1; }
    S.atkT = w.speed; setAct(w.ranged ? 6 : (POSE[label] || 1), w.speed);
    try { if (w.ammo === 'bolts') Audio_.sfx.bow(); else if (w.ammo) Audio_.sfx.shot(); else Audio_.sfx.swing(); } catch (e) { /* sound only */ }
    addNoise(w.noise);
    p.fat = Math.max(0, p.fat - 1);
    let best = null, bd = 1e9;
    for (const e of G.ents) {
      if (e.kind !== 'enemy' || e.dead || e.hidden) continue;   // never townsfolk: the law is the host's world
      const dx = e.x - S.x, dy = e.y - S.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > w.reach + (e.radius || 0.3)) continue;
      if (!w.ranged && Math.abs(feetOf(e) - S.feet) > MELEE_RISE) continue;
      const ang = Math.abs(normAng(Math.atan2(dy, dx) - S.dir)), cone = w.ranged ? 0.14 + 0.25 / Math.max(1, d) : 0.55;
      if (ang > cone || !los(S.x, S.y, e.x, e.y)) continue;
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) { if (!w.ranged) feed(TX.gAir); return { ok: true, hit: false }; }
    const e = best, d = e.def, rng = S.rng;
    const hitChance = 0.55 + p.attrs.Agility / 250 + p.attrs.Luck / 600 + (w.ranged ? 0.15 : 0);
    if (rng() > hitChance) { feed(fmt(TX.gMiss, theName(d.name, false))); return { ok: true, hit: false }; }
    let dmg = Math.floor(w.dmg[0] + rng() * (w.dmg[1] - w.dmg[0] + 1)) + Math.floor(p.attrs.Strength / 25);
    if (w.type === 'shot') { if (d.cacophony) dmg *= 2; if (d.quiet || d.hushkin) dmg = 0; }
    if (w.type === 'iron' && d.quiet) dmg = Math.floor(dmg * 1.5);
    if (w.type === 'glass' && d.cacophony) dmg = Math.floor(dmg * 1.6);
    if (w.type === 'iron' && d.cacophony && w !== WEAPONS.hands) dmg = Math.floor(dmg * 0.6);
    if (w.type === 'bronze') { if (d.cacophony) dmg = Math.floor(dmg * 1.35); if (d.quiet) dmg = Math.floor(dmg * 0.5); }
    if (w.type === 'bolt') { if (d.quiet) dmg = Math.floor(dmg * 1.4); if (d.cacophony) dmg = Math.floor(dmg * 0.5); }
    if (w.cleave && d.core) dmg = Math.floor(dmg * 1.2);
    if (d.armored && w.blunt) dmg = Math.floor(dmg * 1.5); else if (d.armored && w.type !== 'glass') dmg = Math.max(1, dmg - 3);
    if (d.coda && typeof codaShield === 'function') dmg = withRng(() => codaShield(e, dmg));
    e.hp -= dmg; e.flash = true; setTimeout(() => { e.flash = false; }, 90);
    threat(e, 1, dmg);
    try { Audio_.sfx.hit(); Audio_.sfx.enemy(d, 'hurt'); } catch (x) { /* sound only */ }
    if (e.state === 'idle' || e.state === 'passive' || e.state === 'investigate') { delete e.investigation; e.state = 'chase'; e.alertT = 8; e.p19t = 'guest'; e.p19r = B.AGGRO_RETHINK; }
    if (dmg > 0) feed(fmt(TX.gLand, theName(d.name, false), dmg));
    if (e.hp <= 0) partnerKill(e);
    return { ok: true, hit: true, dmg, target: e.type };
  }
  function partnerKill(e) {
    // the kill is the world's: killEnemy runs for the host (story hooks, ledger and rewards stay the host's), on the
    // partner's RNG stream; the kill and its share are credited to the partner in the killEnemy wrapper
    const k0 = G.player.kills;
    CTX.killer = 'guest';
    try { withRng(() => killEnemy(e, false)); } finally { CTX.killer = null; }
    G.player.kills = k0;
    feed(fmt(TX.gKill, theName(e.def.name, false)), 'good');
  }
  function partnerSong(id) {
    const p = S.pp, s = SONGS[id];
    if (S.down || S.songT > 0 || S.atkT > 0) return { ok: false, reason: 'busy' };
    if (!s || !p.songs.includes(id) || (id !== 'tending' && id !== 'fifth')) return { ok: false, reason: 'song' };
    for (const e of G.ents) if (e.kind === 'enemy' && !e.dead && !e.hidden && e.def.quiet && dist2(e.x, e.y, S.x, S.y) < 16) { feed(TX.gQuiet, 'bad'); return { ok: false, reason: 'quiet' }; }
    if (p.voice < s.cost) { feed(TX.gVoice, 'bad'); return { ok: false, reason: 'voice' }; }
    p.voice -= s.cost; addNoise(s.noise); S.songT = 0.7; setAct(7, 0.7);
    if (id === 'tending') { p.hp = Math.min(p.hpMax, p.hp + 14); feed(TX.gTend, 'good'); try { Audio_.sfx.song(174, 1.4); } catch (e) { /* sound only */ } }
    else {
      let n = 0;
      for (const e of G.ents) {
        if (e.kind !== 'enemy' || e.dead || e.hidden || !e.def.cacophony || dist2(e.x, e.y, S.x, S.y) > 100) continue;
        if (e.def.boss && e.fifthN > 0) continue;
        e.stun = [4.5, 2.5, 1.2, 0.5][Math.min(3, e.fifthN)]; e.fifthN++; n++;
      }
      feed(fmt(TX.gFifth, n), n ? 'good' : 'warn'); try { Audio_.sfx.fifth(); } catch (e) { /* sound only */ }
    }
    return { ok: true };
  }
  function partnerCheckLevel() {
    const p = S.pp;
    while (p.level < B.LEVEL_CAP && p.xp >= needXp(p.level)) {
      p.xp -= needXp(p.level); p.level++;
      const h = 4 + Math.floor(p.attrs.Endurance / 20), v = 2 + Math.floor(p.attrs.Willpower / 20);
      p.hpMax += h; if (!S.down) p.hp += h; p.voiceMax += v; p.voice += v;
      feed(fmt(TX.gLevel, p.level), 'good');
    }
  }
  function grantGuest(id) {
    const it = ITEMS[id]; if (!it) return '';
    if (id === 'sovereigns') { const n = 4 + Math.floor(S.rng() * 11); S.earned.gold += n; return fmt(TX.gGold, n); }
    S.earned.items[id] = (S.earned.items[id] || 0) + 1;
    const p = S.pp;
    if (it.use === 'ammo') { const k = it.ammo || 'pellets'; p[k] = (p[k] || 0) + it.n; }
    else if (it.weapon && own(WEAPONS, it.weapon) && !p.weapons.includes(it.weapon)) p.weapons.push(it.weapon);
    return it.name;
  }

  // ================================================================ INPUT (the guest's commands)
  const STORY_CMDS = new Set(['choose', 'talk', 'flag', 'quest', 'interact', 'save', 'event', 'dialogue']);
  function input(cmd) {
    if (!S.active) return { ok: false, reason: 'inactive' };
    S.stats.inputs++;
    const refuse = (r) => { S.stats.refused++; return { ok: false, reason: r }; };
    if (!cmd || typeof cmd !== 'object' || Array.isArray(cmd) || typeof cmd.t !== 'string') return refuse('shape');
    let size = 0; try { size = JSON.stringify(cmd).length; } catch (e) { return refuse('shape'); }
    if (size > B.MSG_MAX) return refuse('too-big');
    // the guest acts only as its own traveller: no field may name anyone else
    if (cmd.who != null && cmd.who !== S.token) return refuse('not-yours');
    // rate: a token bucket refilled in real time
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    if (S.lastIn) S.bucket = Math.min(B.BURST, S.bucket + (now - S.lastIn) * B.RATE);
    S.lastIn = now;
    if (S.bucket < 1) { S.stats.rate++; return refuse('rate'); }
    S.bucket -= 1;
    const t = cmd.t;
    if (STORY_CMDS.has(t)) return refuse('story-is-the-hosts');
    if (S.paused) return refuse('paused');
    if (G.state !== 'play' && t !== 'look' && t !== 'turn') return refuse('not-now');
    switch (t) {
      case 'move': {
        if (!isNum(cmd.f) || !isNum(cmd.s)) return refuse('range');
        S.held = { f: clampN(cmd.f, -1, 1), s: clampN(cmd.s, -1, 1), run: cmd.run === true };
        if (cmd.dir != null) { if (!isNum(cmd.dir)) return refuse('range'); if (!S.down) S.dir = normAng(cmd.dir); }
        return { ok: true };
      }
      case 'look': if (!isNum(cmd.dir)) return refuse('range'); if (!S.down) S.dir = normAng(cmd.dir); return { ok: true };
      case 'turn': if (!isNum(cmd.d) || Math.abs(cmd.d) > Math.PI) return refuse('range'); if (!S.down) S.dir = normAng(S.dir + cmd.d); return { ok: true };
      case 'attack': { if (cmd.label != null && !own(POSE, cmd.label)) return refuse('range'); return partnerAttack(cmd.label || 'slash right'); }
      case 'block': if (S.down) return refuse('down'); S.blockT = B.BLOCK_T; setAct(9, B.BLOCK_T); return { ok: true };
      case 'song': if (typeof cmd.id !== 'string') return refuse('range'); return partnerSong(cmd.id);
      case 'weapon': { const i = cmd.i; if (!Number.isInteger(i) || i < 0 || i >= S.pp.weapons.length) return refuse('range'); S.pp.weapon = i; lookFor(); return { ok: true }; }
      case 'use': case 'revive': return { ok: true };   // lifting someone is standing beside them; nothing else is the guest's to use
      default: return refuse('unknown');
    }
  }

  // ================================================================ THE PARTNER EACH FRAME
  function tick(dt) {
    if (!S.active || S.paused) return;
    if (S.map !== G.mapId) placeBehindHost();   // "come with me": the partner is always on the host's map
    for (const k of ['atkT', 'songT', 'blockT', 'actT', 'hurtT']) if (S[k] > 0) S[k] = Math.max(0, S[k] - dt);
    if (S.actT <= 0) S.act = 0;
    const p = S.pp; p.voice = Math.min(p.voiceMax, p.voice + dt * 0.08);
    let spd = 0;
    const ext = S.ext && (performance.now() - S.ext.at) < B.POSE_HOLD_MS;
    if (ext) spd = S.down ? 0 : S.ext.spd;            // SYNC moves the partner (setPose): its gait comes with the pose
    else if (!S.down) {
      const h = S.held, run = h.run && p.fat > 0;
      const sp = (2.6 + p.attrs.Speed / 60) * (run ? 1.7 : 1);
      let f = h.f, s = h.s, mag = Math.hypot(f, s); if (mag > 1) { f /= mag; s /= mag; mag = 1; }
      const cs = Math.cos(S.dir), sn = Math.sin(S.dir);
      const wx = (cs * f - sn * s) * sp, wy = (sn * f + cs * s) * sp, bl = 1 - Math.exp(-(mag > 0.05 ? 15 : 22) * dt);
      S.vx += (wx - S.vx) * bl; S.vy += (wy - S.vy) * bl;
      if (mag <= 0.05 && Math.hypot(S.vx, S.vy) < 0.03) { S.vx = 0; S.vy = 0; }
      if (S.vx || S.vy) {
        syncProx(); const x0 = S.x, y0 = S.y;
        moveWithSlide(S.prox, S.vx * dt, S.vy * dt, S.prox);
        S.x = S.prox.x; S.y = S.prox.y; S.feet = groundAt(S.x, S.y); syncProx();
        spd = Math.hypot(S.x - x0, S.y - y0) / Math.max(dt, 1e-4);
      }
      if (run && mag > 0.05) p.fat = Math.max(0, p.fat - dt * 3); else p.fat = Math.min(p.fatMax, p.fat + dt * 2);
    }
    S.spd = spd; S.stride += spd * dt;
    tickDowns(dt);
    ui.hud();
  }

  // ================================================================ STORY: read-only for the guest
  function story(payload) {
    const P = { kind: payload.kind, title: String(payload.title || '').slice(0, 200), text: String(payload.text || '').slice(0, 4000), choices: (payload.choices || []).slice(0, 8).map((c) => String(c).slice(0, 300)), host: G.player ? cleanName(G.player.name) : '' };
    S.storyOpen = P.kind === 'event' || P.kind === 'dialogue';
    S.storyLog.push(P); if (S.storyLog.length > 12) S.storyLog.shift();
    for (const fn of S.storySubs) { try { fn(P); } catch (e) { warnOnce('storySub', e); } }
    net.send('p19p:story', P);
  }

  // ================================================================ THE FIGURE (procedural pixel art, drawn as a sprite)
  // The two travellers are painted in the manner of the game's own NPC sprites: GHOST18's painter gives the pose (its
  // tone map says which body part each pixel is, in 5 views x walk x action); here that map is doubled with Scale2x to
  // NPC resolution (80 x 192, one tile tall like a standing townsperson) and coloured as pixel art: a muted, earthy
  // palette by calling (coat, cloak or robe, trousers, boots), skin and the face's hair, steel or wood for the weapon in
  // hand (found by painting the pose once without it), light from the upper left across every part and darker toward the
  // feet, a cloth weave and folds, a dark outline. The frame is registered as an Engine sprite and drawn by the engine's
  // own sprite pass, so the scene's light, lamps, fog, darkness, shadows and depth apply to it exactly as to any NPC.
  // Cached per pose; never per frame. Not an entity: it is added to the list the renderer draws, never to G.ents.
  const FW = 40, FH = 96, AW = FW * 2, AH = FH * 2;
  // calling palettes, folded toward the townsfolk's browns: [coat, cloak/robe accent]
  const CALL = [
    [[92, 70, 52], [104, 48, 40]],     // blade: a leather jerkin, an oxblood cloak
    [[70, 60, 74], [96, 76, 100]],     // cantor: a dusty plum robe
    [[56, 66, 84], [118, 56, 44]],     // corsair: a faded sea coat, a red sash-cloak
    [[74, 76, 56], [90, 94, 62]],      // archivist: an olive robe
    [[92, 88, 82], [112, 108, 98]],    // penitent: an ash-grey robe
    [[116, 92, 62], [86, 64, 46]],     // quarry: ochre canvas, an umber cloak
  ];
  const HAIR = { 1: [70, 54, 42], 2: [122, 62, 40], 3: [168, 140, 92], 4: [44, 36, 30], 5: [36, 30, 28], 6: [164, 160, 152] };
  const SKIN = [188, 146, 116], TROUSER = [62, 56, 50], BOOT = [46, 36, 30], INKC = [30, 24, 21], OUTC = [20, 16, 14];
  const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  // material of each tone: 0 none, 1 cloth, 2 skin, 3 hair, 4 metal, 5 leather, 6 outline
  function toneColour(look) {
    const TN = GHOST18.TONE, cp = CALL[look.cls] || CALL[0], coat = cp[0], acc = cp[1], hair = HAIR[look.face] || HAIR[1], p = [];
    const plate = ((look.arm >> 2) & 3) === 2;
    const body = plate ? [112, 112, 106] : coat;
    p[TN.OUT] = [OUTC, 6]; p[TN.INK] = [INKC, 6];
    p[TN.LIGHT] = [mul(body, 1.22), plate ? 4 : 1]; p[TN.BASE] = [body, plate ? 4 : 1];
    p[TN.SHADE] = plate ? [[66, 64, 60], 4] : [mixc(mul(body, 0.7), TROUSER, 0.55), 1]; p[TN.DEEP] = [mixc(mul(body, 0.45), BOOT, 0.6), 5];
    p[TN.ACC] = [acc, 1]; p[TN.ACCS] = [mul(acc, 0.72), 1]; p[TN.ACCL] = [mul(acc, 1.2), 1];
    p[TN.DARK] = [[38, 30, 26], 5]; p[TN.GLINT] = [[196, 182, 140], 4];
    p[TN.HAIR] = [hair, 3]; p[TN.HAIRS] = [mul(hair, 0.72), 3]; p[TN.HAIRL] = [mixc(hair, [214, 196, 160], 0.25), 3];
    p[TN.SKIN] = [SKIN, 2]; p[TN.SKINS] = [mul(SKIN, 0.78), 2];
    p[17] = [mul(SKIN, 0.62), 2]; p[18] = [[118, 66, 56], 2]; p[19] = [[40, 30, 28], 7]; p[20] = [mul(SKIN, 0.7), 2];
    return p;
  }
  function weaponColour(tone, wpn) {
    const TN = GHOST18.TONE;
    if (wpn === 9) return tone === TN.GLINT ? [[200, 236, 236], 4] : [[96, 168, 172], 4];          // a glass arm
    if (tone === TN.GLINT) return [[214, 212, 200], 4];
    if (tone === TN.LIGHT) return [[150, 150, 144], 4];
    if (tone === TN.SHADE || tone === TN.BASE) return [[104, 104, 100], 4];
    if (tone === TN.ACC) return [[150, 120, 70], 4];
    return [[78, 56, 38], 5];                                                                          // grips and hafts: wood
  }
  // Scale2x (EPX) on a code map: rounder edges at twice the size, no new codes
  function scale2x(src, w, h) {
    const out = new Uint16Array(w * h * 4), W2 = w * 2, at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[y * w + x]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
      let p1 = P, p2 = P, p3 = P, p4 = P;
      if (C === A && C !== D && A !== B) p1 = A;
      if (A === B && A !== C && B !== D) p2 = B;
      if (D === C && D !== B && C !== A) p3 = C;
      if (B === D && B !== A && D !== C) p4 = D;
      const o = (y * 2) * W2 + x * 2; out[o] = p1; out[o + 1] = p2; out[o + W2] = p3; out[o + W2 + 1] = p4;
    }
    return out;
  }
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  // tones (40 x 96, or 96 x 40 lying down) + a weapon mask -> an ABGR sprite at twice the size
  function colourFrame(tones, wmask, look, w, h) {
    const code = new Uint16Array(w * h);
    for (let i = 0; i < w * h; i++) code[i] = tones[i] ? tones[i] | (wmask && wmask[i] ? 32 : 0) : 0;
    const big = scale2x(code, w, h), W = w * 2, H = h * 2, N = W * H, data = new Uint32Array(N);
    const pal = toneColour(look), TN = GHOST18.TONE;
    if (h > w) faceDetail(tones, big, w, h, TN);
    const edge = (i) => { const t = big[i] & 31; return !t || t === TN.OUT || t === TN.INK; };
    // each part as a rounded form: distance in from its edges (the painter's outline and the ink between parts),
    // turned into a height and lit from the upper left and the front
    const R = 5, d = new Float32Array(N);
    for (let i = 0; i < N; i++) d[i] = edge(i) ? 0 : 99;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!d[i]) continue; let v = d[i]; if (x) v = Math.min(v, d[i - 1] + 1); if (y) v = Math.min(v, d[i - W] + 1); if (x && y) v = Math.min(v, d[i - W - 1] + 1.4); if (x < W - 1 && y) v = Math.min(v, d[i - W + 1] + 1.4); d[i] = v; }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (!d[i]) continue; let v = d[i]; if (x < W - 1) v = Math.min(v, d[i + 1] + 1); if (y < H - 1) v = Math.min(v, d[i + W] + 1); if (x < W - 1 && y < H - 1) v = Math.min(v, d[i + W + 1] + 1.4); if (x && y < H - 1) v = Math.min(v, d[i + W - 1] + 1.4); d[i] = v; }
    const hgt = new Float32Array(N);
    for (let i = 0; i < N; i++) { const t = Math.min(1, d[i] / R); hgt[i] = Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t))); }
    const Lx = -0.55, Ly = -0.5, Lz = 0.67;
    let top = H, bot = -1, left = W, right = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, c = big[i]; if (!c) continue;
      const tone = c & 31, isW = !!(c & 32);
      const pm = isW ? weaponColour(tone, look.wpn) : pal[tone]; if (!pm) continue;
      let col = pm[0]; const mat = pm[1];
      let k = 1;
      if (mat === 6) {
        // the outline: dark only where it meets the air; inside it is the part's own deepest shade (a thin, soft line)
        let air = false, nb = 0;
        for (const j of [i - 1, i + 1, i - W, i + W]) { if (j < 0 || j >= N || !big[j]) air = true; else if (!edge(j)) nb = j; }
        if (!air && nb && tone === TN.OUT) { const q = big[nb], pq = (q & 32) ? weaponColour(q & 31, look.wpn) : pal[q & 31]; if (pq) { col = mul(pq[0], 0.5); } }
      } else {
        const hx = (x > 0 ? hgt[i - 1] : 0) - (x < W - 1 ? hgt[i + 1] : 0), hy = (y > 0 ? hgt[i - W] : 0) - (y < H - 1 ? hgt[i + W] : 0);
        let nx = hx * 1.6, ny = hy * 1.6, nz = 1; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
        const lam = Math.max(0, nx * Lx + ny * Ly + nz * Lz);
        k = 0.42 + 0.78 * lam;
        if (mat === 4) k = 0.5 + 0.9 * lam * lam;                                            // steel: hard light
        k *= 1.04 - 0.2 * (y / H);                                                            // darker toward the feet
        const n = hash(x, y) - 0.5, n2 = hash(x >> 1, y >> 1) - 0.5;
        if (mat === 1) k *= 1 + n2 * 0.16 + n * 0.06 + (hash(x >> 2, 11) - 0.5) * 0.08;      // weave, worn patches, folds
        else if (mat === 3) k *= 1 + (hash(x, y >> 2) - 0.5) * 0.34;                         // strands
        else if (mat === 5) k *= 1 + n2 * 0.14;
        else if (mat === 2) k *= 1 + n * 0.04;
        else if (mat === 4) { k *= 1 + n2 * 0.12 + (hash(x >> 2, y >> 1) - 0.5) * 0.1; if (lam > 0.86) col = mixc(col, [232, 230, 220], 0.45); }   // worn steel, a glint
      }
      const r = Math.max(0, Math.min(255, Math.round(col[0] * k))), g = Math.max(0, Math.min(255, Math.round(col[1] * k))), b = Math.max(0, Math.min(255, Math.round(col[2] * k)));
      data[i] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
      if (y < top) top = y; if (y > bot) bot = y; if (x < left) left = x; if (x > right) right = x;
    }
    return { w: W, h: H, data, top, bot, left, right };
  }
  // the face at twice the size: brows over the eyes, a nose, a mouth, and the hair (or the hood) over the forehead
  const BROW = 17, MOUTH = 18, EYE = 19, NOSE = 20;
  function faceDetail(t, big, w, h, TN) {
    const W = w * 2, at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : t[y * w + x]);
    const skin = (v) => v === TN.SKIN || v === TN.SKINS, set = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < h * 2 && skin(big[y * W + x] & 31)) big[y * W + x] = v; };
    const eyes = [];
    for (let y = 2; y < Math.min(h, 34); y++) for (let x = 1; x < w - 1; x++) if (at(x, y) === TN.DARK && (skin(at(x - 1, y)) || skin(at(x + 1, y))) && skin(at(x, y + 1))) eyes.push([x, y]);
    if (!eyes.length) return;
    for (const [x, y] of eyes) {
      const o = (y * 2) * W + x * 2; big[o] = BROW; big[o + 1] = BROW; big[o + W] = EYE; big[o + W + 1] = EYE;
      set(x * 2, y * 2 - 1, BROW); set(x * 2 + 1, y * 2 - 1, BROW);
    }
    const ey = eyes[0][1];
    let mx;
    if (eyes.length >= 2 && eyes[1][1] === ey) mx = eyes[0][0] + eyes[1][0] + 1;            // between the eyes (2x units)
    else { const ex = eyes[0][0], side = skin(at(ex + 2, ey)) ? 1 : -1; mx = ex * 2 + 1 + side * 3; }
    set(mx, ey * 2 + 3, NOSE); set(mx, ey * 2 + 4, NOSE); set(mx + 1, ey * 2 + 4, NOSE);
    for (let dx = -2; dx <= 2; dx++) set(mx + dx, ey * 2 + 8, MOUTH);
    // the hairline: the first skin pixel under hair or hood takes their colour
    for (let x = 0; x < w; x++) for (let y = 1; y < Math.min(h, 34); y++) {
      const v = at(x, y); if (!skin(v)) continue;
      const a = at(x, y - 1);
      if (a === TN.HAIR || a === TN.HAIRS || a === TN.HAIRL || a === TN.ACC || a === TN.ACCS) { const o = (y * 2) * W + x * 2; if (skin(big[o] & 31)) big[o] = a; if (skin(big[o + 1] & 31)) big[o + 1] = a; }
      break;
    }
  }
  function weaponMask(withW, noW) {
    const TN = GHOST18.TONE, m = new Uint8Array(withW.length);
    for (let i = 0; i < withW.length; i++) { const t = withW[i]; if (t !== noW[i] && t && t !== TN.OUT && t !== TN.INK && t !== TN.SKIN && t !== TN.SKINS) m[i] = 1; }
    return m;
  }
  const figCache = new Map();
  let figN = 0;
  function remember(k, f) {
    if (figCache.size > 240) { const old = figCache.keys().next().value, of = figCache.get(old); figCache.delete(old); try { if (of && of.name) delete Engine.sprites[of.name]; } catch (e) { /* gone */ } }
    figCache.set(k, f); return f;
  }
  function register(f, hs, dy) {
    f.name = 'p19fig_' + (++figN);
    try { Engine.addSprite(f.name, { w: f.w, h: f.h, data: f.data, hs, cx: 0.5, dy }); } catch (e) { warnOnce('sprite', e); }
    return f;
  }
  // Phase 21: CARD21 paints the same likeness as the character card (the real gear) when it is loaded and on
  const card21 = () => typeof CARD21 === 'object' && CARD21 && CARD21.on && CARD21.on() && typeof CARD21.partnerFrame === 'function';
  const c21key = (look) => (card21() ? 'c21:' + CARD21.sig(CARD21.lookFor(look)) : '');
  function frameOf(b, loco, act, ph, look) {
    const k = [b, loco, act, ph, look.cls, look.face, look.wpn, look.arm, c21key(look)].join(',');
    let f = figCache.get(k); if (f) return f;
    // never paint a new pose on the spot (a phone would stall): CARD21 paints it in slices and meanwhile offers the
    // nearest pose it has; with none yet, the Phase 19 figure below stands in (kept under its own key)
    let kOld = k;
    if (card21()) {
      try {
        const r = CARD21.partnerFrame(b, loco, act, ph, look, { now: false });
        if (r) { const kk = r.exact ? k : 'near|' + r.key; const g = figCache.get(kk); if (g) return g; f = { w: r.w, h: r.h, data: r.data, top: r.top, bot: r.bot, left: r.left, right: r.right }; return remember(kk, register(f, 1, (AH - 1 - f.bot) / AH)); }
      } catch (e) { warnOnce('card21', e); }
      kOld = 'fb|' + [b, loco, act, ph, look.cls, look.face, look.wpn, look.arm].join(',');
      f = figCache.get(kOld); if (f) return f;
    }
    const lk = Object.assign({}, look, { snug: true });
    const t = GHOST18.paintFigure(b, loco, act, ph, lk);
    const m = look.wpn ? weaponMask(t, GHOST18.paintFigure(b, loco, act, ph, Object.assign({}, lk, { wpn: 0 }))) : null;
    f = colourFrame(t, m, look, FW, FH);
    // the painter's feet stand 3 rows above its bottom edge: set the sprite down onto the ground
    return remember(kOld, register(f, 1, (AH - 1 - f.bot) / AH));
  }
  // lying on the ground: the side view turned a quarter (head to the right)
  function downFrame(look) {
    const k = 'down,' + [look.cls, look.face, look.wpn, look.arm, c21key(look)].join(',');
    let f = figCache.get(k); if (f) return f;
    const rot = (src) => { const r = new Uint8Array(FW * FH); for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) r[x * FH + (FH - 1 - y)] = src[y * FW + x]; return r; };
    let kOld = k;
    const s2 = card21() ? (() => { try { return CARD21.partnerFrame(2, 0, 0, 0, look, { now: false }); } catch (e) { return null; } })() : null;
    if (card21() && (!s2 || !s2.exact)) { kOld = 'fb|' + k; f = figCache.get(kOld); if (f) return f; }
    if (s2 && s2.exact) {
      try {
        // the card's side view laid down: a quarter turn, head to the right
        const d = new Uint32Array(s2.w * s2.h);
        for (let y = 0; y < s2.h; y++) for (let x = 0; x < s2.w; x++) d[x * s2.h + (s2.h - 1 - y)] = s2.data[y * s2.w + x];
        f = { w: s2.h, h: s2.w, data: d, top: 0, bot: 0, left: 0, right: 0 };
        let top = f.h, bot = -1; for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (d[y * f.w + x]) { if (y < top) top = y; bot = y; }
        f.top = top; f.bot = bot;
        const hs = f.h / f.w;
        return remember(k, register(f, hs, (f.h - 1 - f.bot) / f.h * hs));
      } catch (e) { warnOnce('card21', e); }
    }
    const t = GHOST18.paintFigure(2, 0, 0, 0, look);
    const m = look.wpn ? weaponMask(t, GHOST18.paintFigure(2, 0, 0, 0, Object.assign({}, look, { wpn: 0 }))) : null;
    f = colourFrame(rot(t), m ? rot(m) : null, look, FH, FW);
    const hs = FW / FH;
    return remember(kOld, register(f, hs, (f.h - 1 - f.bot) / f.h * hs));
  }
  // a figure to draw: a plain object the engine's sprite pass reads (never in G.ents, never picked)
  const FIG = { partner: { kind: 'npc', p19fig: 'guest', nopick: true, transient: true, scale: 1, x: 0, y: 0 }, host: { kind: 'npc', p19fig: 'host', nopick: true, transient: true, scale: 1, x: 0, y: 0 } };
  // pose one figure: { x, y, dir, act, ph, spd, stride, hurt, down, look } -> the figure object, ready for the renderer
  function poseFig(o, st, camDir, t) {
    let fr;
    if (st.down) { fr = downFrame(st.look); o.animFlip = false; }
    else {
      const v = GHOST18.viewOf(st.dir, camDir), moving = st.spd >= 0.35;
      const loco = moving ? 1 + (Math.floor(st.stride / 0.42) & 1) : 0;
      fr = frameOf(v.b, loco, st.act || (st.hurt ? 8 : 0), st.act ? st.ph : 0, st.look); o.animFlip = v.mirror;
    }
    o.sprite = fr.name; o.x = st.x; o.y = st.y; o.hidden = false;
    // the same small life the engine gives a walking townsperson (anim.js): a step bob and a lean, breathing at rest
    const s = st.who === 'host' ? 1.3 : 4.1;
    if (st.down) { o.animSY = 1; o.animSX = 1; o.animLift = 0; o.animSkew = 0; }
    else if (st.spd >= 0.35) { const ph = st.stride * 2.4; o.animLift = Math.abs(Math.sin(ph)) * 0.03; o.animSkew = Math.sin(ph) * 0.02; o.animSY = 1 - Math.abs(Math.cos(ph)) * 0.015; o.animSX = 1; }
    else { o.animLift = 0; o.animSkew = 0; o.animSY = 1 + 0.012 * Math.sin(t * 1.6 + s); o.animSX = 1 - 0.006 * Math.sin(t * 1.6 + s); }
    o.animHurt = st.hurt && !(typeof GFX !== 'undefined' && GFX.noFlash) ? 0.6 : 0;
    o.animAlpha = 1;
    return o;
  }
  // the figures this page draws now: the partner on the host's screen, the host on the guest's
  function coopFigures() {
    const out = [], t = performance.now() / 1000, camDir = Engine.cam.dir;
    if (S.active && !S.paused && S.pp && S.look && S.map === G.mapId) {
      let x = S.x, y = S.y, dir = S.dir;
      // SYNC's smoothed (interpolated) position of the guest's traveller, when SYNC moves it
      try { if (typeof SYNC19 === 'object' && SYNC19.isHost && SYNC19.isHost()) { const f = SYNC19.figures().find((q) => q.who === 'guest'); if (f && isNum(f.x) && isNum(f.y)) { x = f.x; y = f.y; if (isNum(f.dir) && !S.down) dir = f.dir; } } } catch (e) { warnOnce('figs', e); }
      const ph = S.act ? Math.min(3, Math.floor((1 - S.actT / Math.max(0.01, S.actDur)) * 4)) : 0;
      out.push(poseFig(FIG.partner, { who: 'guest', x, y, dir, act: S.act, ph, spd: S.spd, stride: S.stride, hurt: S.hurtT > 0, down: S.down, look: S.look }, camDir, t));
    }
    try {
      if (typeof SYNC19 === 'object' && SYNC19.isGuest && SYNC19.isGuest() && SYNC19.hostLook) {
        const look = SYNC19.hostLook(), f = SYNC19.figures().find((q) => q.who === 'host');
        if (look && f) {
          const H = FIG.host, tt = performance.now();
          H.stride = (H.stride || 0) + (f.spd || 0) * Math.max(0, Math.min(0.1, (tt - (H.at || tt)) / 1000)); H.at = tt;
          const act = f.act | 0, hp = SYNC19.hostPartnerState ? SYNC19.hostPartnerState() : null;
          out.push(poseFig(H, { who: 'host', x: f.x, y: f.y, dir: f.dir, act: act === 8 ? 0 : act, ph: act ? Math.min(3, Math.floor((f.ap || 0) * 4)) : 0, spd: f.spd || 0, stride: H.stride, hurt: act === 8, down: !!(hp && hp.down), look }, camDir, t));
        }
      }
    } catch (e) { warnOnce('hostfig', e); }
    return out;
  }
  // how much of each figure the last frame showed (pixels the sprite pass wrote at its depth), and where (name tags)
  function measure(F) {
    S.stats.drawn = 0; S.screen = null; FIG.host.screen = null;
    for (const o of [FIG.partner, FIG.host]) {
      const s = o._screen; if (!o.drawing || !s) continue;
      const sc = F.S || 1, w = F.w, h = F.h, x0 = Math.max(0, Math.floor(s.x0 * sc)), x1 = Math.min(w - 1, Math.ceil(s.x1 * sc)), y0 = Math.max(0, Math.floor(s.y0 * sc)), y1 = Math.min(h - 1, Math.ceil(s.y1 * sc));
      let n = 0, headY = -1; const zf = Math.fround(s.z);
      for (let y = y0; y <= y1; y++) { let o2 = y * w + x0; for (let x = x0; x <= x1; x++, o2++) if (F.dbuf[o2] === zf) { n++; if (headY < 0) headY = y; } }
      const scr = n ? { x: (s.x0 + s.x1) / 2 / VW, y: (headY >= 0 ? headY / sc : s.y0), w: (s.x1 - s.x0) / VW, dist: s.dist } : null;
      if (o === FIG.partner) { S.stats.drawn = n; S.screen = scr; } else { FIG.host.drawn = n; FIG.host.screen = scr; }
    }
  }
  // kept for the tests and other modules: the old post hook's name now only measures what the engine drew
  function drawHook(F) { measure(F); }

  // ================================================================ UI (host side: HUD chip, name tag, downed bar)
  // Everything is built with createElement + textContent; the names come from the validated card (cleanName).
  const CSS = `
#p19p-hud { position: absolute; right: 1.2cqw; top: 1cqh; width: 22cqw; display: grid; grid-template-columns: 6.4cqw 1fr; column-gap: .8cqw; row-gap: .3cqh;
  padding: .7cqw; background: rgba(14, 18, 28, .8); border: 1px solid #4f6c9c; box-shadow: inset 0 0 0 1px #1a2232; font-family: var(--font-body); color: var(--parch, #e9dcc0); z-index: 5; pointer-events: none; }
#p19p-hud.below { top: 15cqh; }
#p19p-hud img { grid-row: 1 / span 4; width: 6.4cqw; height: 6.4cqw; object-fit: cover; border: 1px solid #4f6c9c; }
#p19p-hud .n { font-family: var(--font-display, var(--font-body)); font-size: 1.9cqw; color: #a9c4f0; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#p19p-hud .bar { height: .9cqw; background: #1a1418; border: 1px solid #3a2e2c; }
#p19p-hud .bar i { display: block; height: 100%; background: linear-gradient(#b8432f, #7a2416); }
#p19p-hud .s, #p19p-hud .l { font-size: 1.45cqw; line-height: 1.2; }
#p19p-hud .s.down { color: #ff8a70; }
#p19p-hud .l { color: #c9b38a; }
#p19p-tag, #p19p-htag { position: absolute; transform: translate(-50%, -100%); pointer-events: none; z-index: 4; text-align: center; font-family: var(--font-sc, serif);
  font-size: 1.25cqw; line-height: 1; color: #e4d6b8; opacity: .82; text-shadow: 0 0 2px #000, 1px 1px 0 #000; white-space: nowrap; }
#p19p-tag .tb, #p19p-htag .tb { display: block; margin: .2cqh auto 0; width: 3.6cqw; height: .3cqw; background: rgba(0,0,0,.6); }
#p19p-tag .tb i, #p19p-htag .tb i { display: block; height: 100%; background: #b0483a; }
#p19p-tag.down, #p19p-htag.down { color: #ffb0a0; opacity: 1; }
#p19p-tag .rv, #p19p-htag .rv { display: block; margin: .2cqh auto 0; width: 5cqw; height: .4cqw; background: rgba(0,0,0,.65); }
#p19p-tag .rv i, #p19p-htag .rv i { display: block; height: 100%; background: #e9d27a; }
#p19p-down { position: absolute; left: 50%; top: 40cqh; transform: translate(-50%, -50%); z-index: 5; pointer-events: none; padding: 1cqh 2cqw; background: rgba(40, 8, 6, .72);
  border: 1px solid #a8452f; color: #ffd8c8; font-family: var(--font-sc, serif); font-size: 2.2cqw; text-align: center; }
#p19p-down .rv { display: block; margin: .6cqh auto 0; width: 24cqw; height: .8cqw; background: rgba(0,0,0,.6); }
#p19p-down .rv i { display: block; height: 100%; background: #e9d27a; }
#p19p-story { position: absolute; left: 50%; bottom: 27cqh; transform: translateX(-50%); width: 70cqw; max-height: 55cqh; overflow: auto; z-index: 7; padding: 1.2cqh 2cqw;
  background: rgba(16, 12, 10, .92); border: 1px solid #7a5c2a; color: var(--parch, #e9dcc0); font-family: var(--font-body); font-size: 2cqw; line-height: 1.3; }
#p19p-story h3 { margin: 0 0 .6cqh; font-family: var(--font-display, serif); color: var(--gold, #d9a441); font-size: 2.3cqw; }
#p19p-story .tx { white-space: pre-wrap; }
#p19p-story ul { margin: .8cqh 0 0; padding-left: 2cqw; color: #a8987c; }
#p19p-story .who { margin-top: .8cqh; font-family: var(--font-sc, serif); color: #c9b38a; font-size: 1.7cqw; }
#p19p-story[hidden], #p19p-hud[hidden], #p19p-tag[hidden], #p19p-htag[hidden], #p19p-down[hidden], #p19p-tag .rv[hidden], #p19p-htag .rv[hidden] { display: none; }
`;
  function injectStyle() { if (document.getElementById('partner19-style')) return; const st = document.createElement('style'); st.id = 'partner19-style'; st.textContent = CSS; document.head.appendChild(st); }
  const mk = (tag, attrs, text) => { const e = document.createElement(tag); if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; };
  const ui = {
    el: null, tag: null, down: null, sig: '',
    build() {
      injectStyle(); this.remove();
      const game = document.getElementById('game'); if (!game) return;
      const h = mk('div', { id: 'p19p-hud', role: 'status', 'aria-live': 'polite' });
      const img = mk('img', { alt: '' }); img.src = 'img/face_' + S.pp.face + '.jpg';
      h.append(img, mk('div', { class: 'n' }), mk('div', { class: 'bar' }), mk('div', { class: 's' }), mk('div', { class: 'l' }));
      h.querySelector('.bar').appendChild(mk('i'));
      const tg = mk('div', { id: 'p19p-tag', 'aria-hidden': 'true' }); tg.append(mk('span', { class: 'nm' }), mk('span', { class: 'tb' }), mk('span', { class: 'rv' }));
      tg.querySelector('.tb').appendChild(mk('i')); tg.querySelector('.rv').appendChild(mk('i'));
      const dn = mk('div', { id: 'p19p-down', role: 'alert' }); dn.append(mk('span', { class: 't' }), mk('span', { class: 'rv' })); dn.querySelector('.rv').appendChild(mk('i')); dn.hidden = true;
      game.append(h, tg, dn); this.el = h; this.tag = tg; this.down = dn; this.sig = ''; this.hud();
    },
    remove() { for (const id of ['p19p-hud', 'p19p-tag', 'p19p-down']) { const e = document.getElementById(id); if (e) e.remove(); } this.el = this.tag = this.down = null; },
    hud() {
      const h = this.el; if (!h || !S.pp) return;
      const p = S.pp, party = document.getElementById('party');
      const sig = [p.name, p.level, Math.ceil(p.hp), p.hpMax, S.down, Math.ceil(S.downT), S.revive > 0, S.lootTurn, S.paused, !!(party && !party.classList.contains('hidden')), S.hostDown, Math.ceil(S.hostDownT), Math.round(S.hostRevive * 10)].join('|');
      if (sig === this.sig) return; this.sig = sig;
      h.classList.toggle('below', !!(party && !party.classList.contains('hidden')));
      h.querySelector('.n').textContent = p.name;
      h.querySelector('.bar i').style.width = clampN(p.hp / p.hpMax * 100, 0, 100) + '%';
      const s = h.querySelector('.s'); s.classList.toggle('down', S.down);
      s.textContent = S.paused ? TX.hudAway : S.down ? (S.revive > 0 ? TX.hudLift : fmt(TX.hudDown, Math.ceil(S.downT))) : fmt(TX.hudLv, p.level) + ' · ' + Math.ceil(p.hp) + ' / ' + p.hpMax;
      h.querySelector('.l').textContent = S.lootTurn === 'host' ? TX.hudNextYou : fmt(TX.hudNextThem, p.name);
      const dn = this.down;
      if (dn) {
        dn.hidden = !S.hostDown;
        if (S.hostDown) { dn.querySelector('.t').textContent = fmt(TX.hostDownBar, p.name, Math.max(0, Math.ceil(S.hostDownT))); dn.querySelector('.rv i').style.width = clampN(S.hostRevive / B.REVIVE_TIME * 100, 0, 100) + '%'; }
      }
    },
    place() {
      const tg = this.tag; if (!tg) return;
      const sc = S.screen, view = document.getElementById('view'), game = document.getElementById('game');
      const card = document.getElementById('scr-card');
      if (!sc || !view || !game || G.state !== 'play' || sc.dist > 22 || (card && card.classList.contains('on'))) { tg.hidden = true; return; }
      const r = view.getBoundingClientRect(), gr = game.getBoundingClientRect();
      tg.hidden = false; tg.classList.toggle('down', S.down);
      tg.style.left = (r.left - gr.left + sc.x * r.width) + 'px';
      // never above the top of the view: a partner standing close still shows its name
      tg.style.top = Math.max(r.top - gr.top + (tg.offsetHeight || 0) + 2, r.top - gr.top + (sc.y / VH) * r.height - 2) + 'px';
      const nm = tg.querySelector('.nm'), txt = S.down ? S.pp.name + ' · ' + TX.tagDown : S.pp.name;
      if (nm.textContent !== txt) nm.textContent = txt;
      tg.querySelector('.tb i').style.width = clampN(S.pp.hp / S.pp.hpMax * 100, 0, 100) + '%';
      const rv = tg.querySelector('.rv'); rv.hidden = !S.down; if (S.down) rv.firstChild.style.width = clampN(S.revive / B.REVIVE_TIME * 100, 0, 100) + '%';
    },
    // the guest's screen: the host's name (from SYNC's welcome, cleaned) small above the host's figure
    hostTag() {
      let tg = document.getElementById('p19p-htag');
      const guestOn = typeof SYNC19 === 'object' && SYNC19 && SYNC19.isGuest && SYNC19.isGuest();
      const sc = guestOn ? FIG.host.screen : null, view = document.getElementById('view'), game = document.getElementById('game');
      if (!sc || !view || !game || G.state !== 'play' || sc.dist > 22) { if (tg) tg.hidden = true; return; }
      if (!tg) {
        injectStyle(); tg = mk('div', { id: 'p19p-htag', 'aria-hidden': 'true' }); tg.append(mk('span', { class: 'nm' }), mk('span', { class: 'tb' }));
        tg.querySelector('.tb').appendChild(mk('i')); game.appendChild(tg);
      }
      const st = SYNC19.hostPartnerState ? SYNC19.hostPartnerState() : null, name = cleanName(SYNC19.hostName ? SYNC19.hostName() : '');
      const r = view.getBoundingClientRect(), gr = game.getBoundingClientRect();
      tg.hidden = false; tg.classList.toggle('down', !!(st && st.down));
      tg.style.left = (r.left - gr.left + sc.x * r.width) + 'px';
      tg.style.top = Math.max(r.top - gr.top + (tg.offsetHeight || 0) + 2, r.top - gr.top + (sc.y / VH) * r.height - 2) + 'px';
      const txt = st && st.down ? name + ' · ' + TX.tagDown : name, nm = tg.querySelector('.nm');
      if (nm.textContent !== txt) nm.textContent = txt;
      tg.querySelector('.tb i').style.width = (st ? clampN(st.hp / Math.max(1, st.hpMax) * 100, 0, 100) : 100) + '%';
    },
  };

  // ================================================================ GUEST SIDE
  const guest = (function () {
    const home = { token: '', from: null, d: null, baseLevel: 1, used: false, entered: false };
    function newToken() {
      const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; let s = '';
      const b = new Uint8Array(20); try { crypto.getRandomValues(b); } catch (e) { for (let i = 0; i < b.length; i++) b[i] = (Date.now() * (i + 7)) & 255; }
      for (let i = 0; i < b.length; i++) s += A[b[i] % A.length];
      return s;
    }
    function card(src, opts) {
      let p, from;
      if (src && typeof src === 'object') { if (!src.player || typeof src.player !== 'object') return { error: 'not-a-save' }; p = src.player; from = 'save'; }
      else { if (!hasGame() || !G.player) return { error: 'no-game' }; p = G.player; from = 'live'; }
      if (p.hardcore === true) return { error: 'hardcore' };
      try { if (typeof EXTRAS17 === 'object' && EXTRAS17.inExtra && EXTRAS17.inExtra() && from === 'live') return { error: 'in-extra' }; } catch (e) { /* ignore */ }
      home.token = newToken(); home.from = from; home.used = false; home.entered = false;
      home.d = from === 'save' ? JSON.parse(JSON.stringify(src)) : null;
      home.slot = from === 'save' && opts && Number.isInteger(opts.slot) && opts.slot >= 0 && opts.slot < 3 ? opts.slot : null;
      home.baseLevel = p.level | 0;
      const cls = typeof p.cls === 'string' ? p.cls : (p.cls && p.cls.id);
      return {
        v: 1, token: home.token, name: String(p.name || ''), cls, face: p.face, level: p.level, xp: Math.floor(p.xp || 0), attrs: Object.assign({}, p.attrs),
        weapons: (p.weapons || []).slice(), weapon: p.weapon | 0, armor: Object.assign({}, p.armor), pellets: p.pellets | 0, bolts: p.bolts | 0, glass: +p.glass || 0,
      };
    }
    // the write-back is untrusted too (it came over the wire): every field is checked against what play could produce
    function validateWB(wb) {
      const bad = (r) => ({ ok: false, reason: r });
      if (!wb || typeof wb !== 'object' || Array.isArray(wb)) return bad('shape');
      let size = 0; try { size = JSON.stringify(wb).length; } catch (e) { return bad('shape'); }
      if (size > B.WB_MAX) return bad('too-big');
      if (wb.v !== 1) return bad('version');
      if (!home.token || wb.token !== home.token) return bad('not-mine');
      if (home.used) return bad('already-applied');
      const xp = wb.xp, kills = wb.kills, gold = wb.gold;
      if (!Number.isInteger(xp) || xp < 0 || xp > B.WB_MAX_XP) return bad('xp');
      if (!Number.isInteger(kills) || kills < 0 || kills > 5000) return bad('kills');
      if (!Number.isInteger(gold) || gold < 0 || gold > B.WB_MAX_GOLD) return bad('gold');
      let maxXp = 0; for (const k in ENEMIES) maxXp = Math.max(maxXp, ENEMIES[k].xp || 0);
      if (xp > kills * maxXp + B.WB_QUEST_XP) return bad('xp-vs-kills');
      if (gold > kills * 14) return bad('gold-vs-kills');
      if (!Array.isArray(wb.items) || wb.items.length > B.WB_MAX_ITEMS) return bad('items');
      const L = lootable(), items = []; let total = 0;
      for (const s of wb.items) {
        if (!s || typeof s !== 'object' || typeof s.id !== 'string' || !own(ITEMS, s.id) || !L.has(s.id) || s.id === 'sovereigns') return bad('item');
        if (!Number.isInteger(s.n) || s.n < 1 || s.n > B.WB_MAX_N) return bad('item-count');
        total += s.n; items.push({ id: s.id, n: s.n });
      }
      if (total > kills) return bad('items-vs-kills');
      const sp = wb.spent && typeof wb.spent === 'object' ? wb.spent : {};
      const spent = { pellets: intIn(sp.pellets, 0, 999, 0), bolts: intIn(sp.bolts, 0, 999, 0) };
      return { ok: true, wb: { xp, kills, gold, items, spent } };
    }
    function applyTo(p, w) {
      const gained = { xp: w.xp, levels: 0, gold: w.gold, items: [] };
      const cls = typeof p.cls === 'string' ? CLASSES.find((c) => c.id === p.cls) : p.cls;
      p.xp = (+p.xp || 0) + w.xp; p.level = Math.max(1, p.level | 0);
      while (p.level < B.LEVEL_CAP && p.xp >= needXp(p.level)) {
        p.xp -= needXp(p.level); p.level++; gained.levels++;
        const h = 4 + Math.floor(p.attrs.Endurance / 20), v = 2 + Math.floor(p.attrs.Willpower / 20);
        p.hpMax += h; p.hp += h; p.voiceMax += v; p.voice += v;
        if (p.level % 2 === 0) p.perkPoints = (p.perkPoints | 0) + 1;
      }
      p.gold = (p.gold | 0) + w.gold;
      p.pellets = Math.max(0, (p.pellets | 0) - w.spent.pellets); p.bolts = Math.max(0, (p.bolts | 0) - w.spent.bolts);
      if (!Array.isArray(p.inv)) p.inv = []; if (!Array.isArray(p.weapons)) p.weapons = cls ? cls.weapons.slice() : ['hands'];
      for (const s of w.items) {
        const it = ITEMS[s.id];
        if (it.use === 'ammo') { const k = it.ammo || 'pellets'; p[k] = (p[k] | 0) + it.n * s.n; }
        else {
          let n = s.n;
          if (it.weapon && own(WEAPONS, it.weapon) && !p.weapons.includes(it.weapon)) { p.weapons.push(it.weapon); n--; }
          if (n > 0) { const slot = p.inv.find((x) => x.id === s.id); if (slot) slot.n += n; else p.inv.push({ id: s.id, n }); }
        }
        gained.items.push(it.name + (s.n > 1 ? ' ×' + s.n : ''));
      }
      return gained;
    }
    function applyWriteBack(wb, player) {
      const v = validateWB(wb); if (!v.ok) return v;
      const p = player || (home.from === 'save' ? home.d && home.d.player : (hasGame() ? G.player : null));
      if (!p || typeof p !== 'object') return { ok: false, reason: 'no-home' };
      const gained = applyTo(p, v.wb); home.used = true;
      return { ok: true, gained };
    }
    let registered = false;
    function register() {
      if (registered || typeof EXTRAS17 !== 'object' || !EXTRAS17.register) return registered;
      registered = EXTRAS17.register({ id: 'p19coop', title: TX.coopTitle, blurb: '', hidden: true, unlocked: () => true,
        start() { loadMap('oakhaven'); G.state = 'play'; } });
      return registered;
    }
    function enter() {
      if (!home.token || home.entered) return false;
      register();
      let ok = false;
      try { ok = !!(typeof EXTRAS17 === 'object' && EXTRAS17.start && EXTRAS17.start('p19coop')); } catch (e) { warnOnce('enter', e); ok = false; }
      home.entered = ok;
      return ok;
    }
    function returnHome(wb) {
      hideStory();
      const wasIn = home.entered;
      if (wasIn) { try { EXTRAS17.quit(); } catch (e) { warnOnce('quit', e); } home.entered = false; }
      let res = { ok: false, reason: 'no-write-back' };
      if (wb !== undefined) res = applyWriteBack(wb);
      try {
        if (home.from === 'save' && home.d) {
          restoreGame(JSON.parse(JSON.stringify(home.d)));
          // the session slot the traveller came from keeps what they earned (it is their save: the write-back is in it)
          if (res.ok && home.slot != null && typeof SLOTS !== 'undefined') { const d = snapshotGame(); d.mapName = G.map && G.map.name; SLOTS[home.slot] = d; }
        }
        else if (home.from === 'live' && wasIn && G.player && G.map) {
          hide('#title'); G.state = 'play'; G.keys = {};
          try { Engine.setMap(G.map); Audio_.setScene(G.map.music); } catch (e) { /* the scene is cosmetic */ }
        }
      } catch (e) { warnOnce('home', e); return { ok: false, reason: 'restore-failed' }; }
      if (res.ok && res.gained) {
        const g = res.gained;
        sayHost('+' + g.xp + ' XP' + (g.levels ? ' · Lv ' + G.player.level : '') + (g.gold ? ' · ' + g.gold + ' sovereigns' : '') + (g.items.length ? ' · ' + g.items.join(', ') : ''), 'good', 8000);
      }
      return res;
    }
    // the read-only story panel: text only (textContent), the choices are a list, not buttons
    function showStory(P) {
      if (!P || typeof P !== 'object') return false;
      if (P.kind === 'close') { hideStory(); return true; }
      if (!['event', 'dialogue', 'death', 'ending'].includes(P.kind)) return false;
      injectStyle();
      let box = document.getElementById('p19p-story');
      if (!box) { box = mk('div', { id: 'p19p-story', role: 'dialog', 'aria-label': TX.storyHead }); (document.getElementById('game') || document.body).appendChild(box); }
      box.replaceChildren();
      box.appendChild(mk('h3', null, String(P.title || '').slice(0, 200)));
      box.appendChild(mk('div', { class: 'tx' }, String(P.text || '').slice(0, 4000)));
      const ch = Array.isArray(P.choices) ? P.choices.slice(0, 8) : [];
      if (ch.length) { const ul = mk('ul', { 'aria-label': TX.storyNoChoice }); for (const c of ch) ul.appendChild(mk('li', null, String(c).slice(0, 300))); box.appendChild(ul); }
      box.appendChild(mk('div', { class: 'who' }, ch.length ? fmt(TX.storyWait, cleanName(String(P.host || ''))) + ' ' + TX.storyNoChoice : TX.storyHead));
      box.hidden = false;
      return true;
    }
    function hideStory() { const b = document.getElementById('p19p-story'); if (b) b.hidden = true; }
    return { card, enter, returnHome, applyWriteBack, validateWB, showStory, hideStory, register, home };
  })();

  // ================================================================ NETWORK (only when NET19 is there; never required)
  const net = {
    wired: false,
    role() { try { return typeof NET19 === 'object' && NET19 && typeof NET19.role === 'function' ? NET19.role() : null; } catch (e) { return null; } },
    send(type, payload) { try { if (typeof NET19 === 'object' && NET19 && typeof NET19.send === 'function' && net.role()) NET19.send(type, payload, { reliable: true }); } catch (e) { warnOnce('send', e); } },
    wire() {
      if (net.wired || typeof NET19 !== 'object' || !NET19 || typeof NET19.on !== 'function') return false;
      net.wired = true;
      const host = () => net.role() === 'host', isGuest = () => net.role() === 'guest';
      NET19.on('p19p:join', (c) => { if (!host()) return; const r = join(c); net.send('p19p:joined', { ok: !!r.ok, reason: r.ok ? undefined : String(r.reason || '') }); });
      NET19.on('p19p:in', (c) => { if (host()) input(c); });
      NET19.on('p19p:leave', () => { if (host()) leave('left'); });
      NET19.on('p19p:story', (P) => { if (isGuest()) guest.showStory(P); });
      NET19.on('p19p:wb', (wb) => { if (isGuest()) guest.returnHome(wb); });
      return true;
    },
  };

  // ================================================================ WRAPPERS (each one a straight pass-through with nobody joined)
  let _solidAt = null;
  function install() {
    _solidAt = solidAt;
    solidAt = function (x, y, self) {
      if (_solidAt.call(this, x, y, self)) return true;
      if (!S.active || S.paused || S.down || self === S.prox || S.map !== G.mapId) return false;
      if (self && self.kind !== 'enemy') return false;
      return (x - S.x) * (x - S.x) + (y - S.y) * (y - S.y) < 0.4;
    };
    const _hy = hydrate;
    hydrate = function (e) { const r = _hy.apply(this, arguments); if (S.active && !CTX.noScale && r && r.kind === 'enemy') scaleEnt(r); return r; };
    const _lm = loadMap;
    loadMap = function () {
      if (!S.active) return _lm.apply(this, arguments);
      const r = _lm.apply(this, arguments);
      try { if (!CTX.noScale) for (const e of G.ents) if (e.kind === 'enemy') scaleEnt(e); if (!S.paused) placeBehindHost(); else S.map = null; } catch (e) { warnOnce('loadMap', e); }
      return r;
    };
    const _eu = enemyUpdate;
    enemyUpdate = function (e, dt) {
      if (!S.active || S.paused || !e || e.dead || e.hidden || e.stun > 0 || S.map !== G.mapId) return _eu.apply(this, arguments);
      CTX.cur = e;
      try {
        const tg = chooseTarget(e, dt);
        if (tg === 'guest') { const r = asPartner(() => _eu.call(this, e, dt)); if (S.pp.hp <= 0 && !S.down) partnerDown(e.def ? e.def.name : ''); return r; }
        if (tg === 'none') return undefined;                 // both down: nobody left to chase
        if (tg === 'idle') return undefined;                 // only the host is down and the enemy is not after the partner
        return _eu.apply(this, arguments);
      } finally { CTX.cur = null; }
    };
    const _dp = damagePlayer;
    damagePlayer = function (dmg, src) {
      if (!S.active) return _dp.apply(this, arguments);
      let d = dmg; if (CTX.cur && isNum(d)) d = Math.max(1, Math.round(d * B.DMG_SCALE));
      if (CTX.swapped) { partnerHurt(d, src); return undefined; }
      if (S.hostDown) return undefined;                      // a fallen traveller is not struck again
      S.stats.hostHits++;
      return _dp.call(this, d, src);
    };
    const _die = die;
    die = function (src) {
      if (!S.active) return _die.apply(this, arguments);
      if (CTX.swapped) { partnerDown(src); return undefined; }
      if (!CTX.forceDie) {
        if (G.dead || S.hostDown) return undefined;
        // with the partner up beside you a fall is a fall, not a death; story deaths are never softened
        if (!(STORY_DEATH.has(src) || S.down || S.paused || S.map !== G.mapId)) { hostDown(src); return undefined; }
      }
      S.hostDown = false;
      const r = _die.apply(this, arguments);
      try { const t = document.getElementById('death-title'), x = document.getElementById('death-text'); story({ kind: 'death', title: plain(t && t.textContent, 200), text: plain(x && x.textContent), choices: [] }); } catch (e) { warnOnce('deathStory', e); }
      return r;
    };
    // while an enemy fights the partner, its messages ("You slip the blow...") are the partner's, not the host's
    const _msg = msg;
    msg = function (text) { if (CTX.swapped) { feed(text, arguments[1]); return undefined; } return _msg.apply(this, arguments); };
    const _kill = killEnemy;
    killEnemy = function (e, byGlass) {
      if (!S.active) return _kill.apply(this, arguments);
      const xp = (e && e.def && e.def.xp) || 0, byGuest = CTX.killer === 'guest';
      const r = _kill.apply(this, arguments);
      try {
        if (byGuest) {
          // the host's own reward came through the original (shared XP); the partner gets the full kill
          S.pp.kills++; S.earned.kills++; S.pp.xp += xp; S.earned.xp += xp;
        } else if (S.map === G.mapId) {
          const share = Math.floor(xp * B.XP_SHARE); S.pp.xp += share; S.earned.xp += share; S.earned.kills++;
        }
        partnerCheckLevel();
      } catch (x) { warnOnce('kill', x); }
      return r;
    };
    const _qx = questXp;
    questXp = function (n) {
      const r = _qx.apply(this, arguments);
      if (S.active && isNum(n) && n > 0) { const s = Math.floor(n * B.QUEST_XP_SHARE); S.pp.xp += s; S.earned.xp += s; partnerCheckLevel(); }
      return r;
    };
    const _dl = dropLoot;
    dropLoot = function (e) {
      if (!S.active) return _dl.apply(this, arguments);
      const n0 = G.ents.length;
      const r = withRngIf(CTX.killer === 'guest', () => _dl.apply(this, arguments));
      try {
        const it = G.ents.length > n0 ? G.ents[G.ents.length - 1] : null;
        if (it && it.kind === 'item') {
          const turn = S.lootTurn; S.lootTurn = turn === 'host' ? 'guest' : 'host';
          if (turn === 'guest') {
            G.ents.splice(G.ents.length - 1, 1);
            const got = grantGuest(it.item);
            sayHost(fmt(TX.lootGuest, pname(), got), 'warn', 4000); feed(fmt(TX.gLoot, got), 'good');
          } else sayHost(fmt(TX.lootHost, pname()), 'warn', 3500);
          ui.hud();
        }
      } catch (x) { warnOnce('loot', x); }
      return r;
    };
    const _at = attack;
    attack = function () {
      if (!S.active) return _at.apply(this, arguments);
      if (S.hostDown) return undefined;
      const before = []; for (const e of G.ents) if (e && e.kind === 'enemy' && !e.dead) before.push(e, e.hp);
      const r = _at.apply(this, arguments);
      for (let i = 0; i < before.length; i += 2) { const lost = before[i + 1] - before[i].hp; if (lost > 0) threat(before[i], 0, lost); }
      return r;
    };
    const _cs = castSong;
    castSong = function () { if (S.active && S.hostDown) return undefined; return _cs.apply(this, arguments); };
    const _ia = interact;
    interact = function () { if (S.active && S.hostDown) return undefined; return _ia.apply(this, arguments); };
    const _u = update;
    update = function (dt) {
      if (!S.active) return _u.apply(this, arguments);
      if (S.hostDown && G.state === 'play') { G.keys = {}; G.touch.fx = 0; G.touch.fy = 0; G.touch.run = false; G.vel.x = 0; G.vel.y = 0; G.mouse.down = false; }
      const r = _u.apply(this, arguments);
      try {
        if (S.storyOpen && G.state === 'play') story({ kind: 'close' });
        if (S.active && G.state === 'play' && !G.dead && dt > 0) tick(dt);
      } catch (e) { warnOnce('tick', e); }
      return r;
    };
    const _snap = snapshotGame;
    snapshotGame = function () {
      if (!S.active) return _snap.apply(this, arguments);
      // the host's save stores the world as it is for one traveller: unscaled health, never the partner
      const held = []; eachEnemy((e) => { if (e.p19s) { held.push(e, e.hp, e.hpMax); e.hp = unscaledHp(e); e.hpMax = Math.round(e.hpMax / e.p19s); } });
      const hp = G.player.hp; if (S.hostDown) G.player.hp = 1;
      try { return _snap.apply(this, arguments); } finally {
        for (let i = 0; i < held.length; i += 3) { held[i].hp = held[i + 1]; held[i].hpMax = held[i + 2]; }
        G.player.hp = hp;
      }
    };
    const _rs = restoreGame;
    restoreGame = function () {
      if (!S.active) return _rs.apply(this, arguments);
      CTX.noScale = true; S.hostDown = false;
      let r; try { r = _rs.apply(this, arguments); } finally { CTX.noScale = false; }
      try { scaleAll(); if (!S.paused) placeBehindHost(); } catch (e) { warnOnce('restore', e); }
      return r;
    };
    const _sg = startGame;
    startGame = function () { if (S.active) leave('silent'); return _sg.apply(this, arguments); };
    const _se = showEvent;
    showEvent = function (title, html, choices) {
      const r = _se.apply(this, arguments);
      if (S.active) { try { story({ kind: 'event', title: plain(title, 200), text: plain(html), choices: (Array.isArray(choices) ? choices : []).map((c) => plain(c && c.t, 300)) }); } catch (e) { warnOnce('event', e); } }
      return r;
    };
    const _rd = renderDialogue;
    renderDialogue = function () {
      const r = _rd.apply(this, arguments);
      if (S.active && DLG.npc) {
        try {
          let last = ''; for (let i = DLG.log.length - 1; i >= 0; i--) if (DLG.log[i].who !== 'you') { last = DLG.log[i].t; break; }
          story({ kind: 'dialogue', title: plain(String(DLG.npc.name || '').split(',')[0], 200), text: plain(last), choices: (DLG.choices || []).map((c) => plain(c && c.t, 300)) });
        } catch (e) { warnOnce('dialogue', e); }
      }
      return r;
    };
    const _end = ending;
    ending = function () { const r = _end.apply(this, arguments); if (S.active) { try { story({ kind: 'ending', title: plain($('#ending-title').textContent, 200), text: plain($('#ending-text').innerHTML), choices: [] }); } catch (e) { warnOnce('ending', e); } } return r; };
    const _render = render;
    render = function () { const r = _render.apply(this, arguments); if (S.active) { try { ui.place(); } catch (e) { warnOnce('place', e); } } if (FIG.host.drawing || document.getElementById('p19p-htag')) { try { ui.hostTag(); } catch (e) { warnOnce('hostTag', e); } } return r; };
    // waking by the lamp after both fell: the partner wakes beside the host
    const wake = document.getElementById('btn-wake');
    if (wake) wake.addEventListener('click', () => { if (!S.active) return; S.down = false; S.hostDown = false; S.revive = S.hostRevive = 0; S.pp.hp = Math.max(1, Math.ceil(S.pp.hpMax * 0.6)); placeBehindHost(); ui.hud(); });
    // the travellers' figures go into the list the renderer draws (a copy: G.ents is never touched); nobody joined =
    // the very same call with the very same list
    if (typeof Engine !== 'undefined' && Engine.render) {
      const _er = Engine.render;
      Engine.render = function (ents, tod, opts) {
        FIG.partner.drawing = false; FIG.host.drawing = false;
        if (!S.active && !(typeof SYNC19 === 'object' && SYNC19 && SYNC19.isGuest && SYNC19.isGuest())) return _er.apply(this, arguments);
        let figs = null; try { figs = coopFigures(); } catch (e) { warnOnce('figures', e); }
        if (!figs || !figs.length || !Array.isArray(ents)) return _er.apply(this, arguments);
        for (const f of figs) f.drawing = true;
        return _er.call(this, ents.concat(figs), tod, opts);
      };
    }
    if (typeof Engine !== 'undefined' && Engine.addPostHook) Engine.addPostHook((F) => { if (!FIG.partner.drawing && !FIG.host.drawing) { if (S.stats.drawn) { S.stats.drawn = 0; S.screen = null; } return; } try { measure(F); } catch (e) { warnOnce('measure', e); } }, 0.5);
    try { if (typeof SYNC19 === 'object' && SYNC19 && SYNC19.fallbackFigure) SYNC19.fallbackFigure(false); } catch (e) { /* no SYNC */ }
    guest.register();
    net.wire();
  }
  function withRngIf(cond, fn) { return cond ? withRng(fn) : fn(); }

  // ================================================================ read-outs
  function snapshot() {
    if (!S.active || !S.pp) return null;
    const p = S.pp;
    return { name: p.name, cls: p.cls.id, face: p.face, map: S.map, x: +S.x.toFixed(3), y: +S.y.toFixed(3), dir: +S.dir.toFixed(3), hp: Math.max(0, Math.ceil(p.hp)), hpMax: p.hpMax,
      voice: Math.floor(p.voice), voiceMax: p.voiceMax, lvl: p.level, xp: p.xp, down: S.down, downLeft: S.down ? Math.max(0, +S.downT.toFixed(1)) : 0, revive: +(S.revive / B.REVIVE_TIME).toFixed(2),
      act: S.act, weapon: p.weapons[p.weapon], loot: S.lootTurn, xpEarned: S.earned.xp, paused: S.paused };
  }
  function hostState() {
    if (!hasGame() || !G.player) return null;
    return { hp: Math.max(0, Math.ceil(G.player.hp)), hpMax: G.player.hpMax, down: S.hostDown, downLeft: S.hostDown ? Math.max(0, +S.hostDownT.toFixed(1)) : 0, revive: +(S.hostRevive / B.REVIVE_TIME).toFixed(2) };
  }
  function drainFeed() { const f = S.feed.slice(); S.feed.length = 0; return f; }

  try { install(); } catch (e) { console.warn('partner19: install failed', e); }

  const api = {
    join, input, leave, pause, setPose, active: () => S.active, snapshot, hostState, drainFeed,
    onStory(fn) { if (typeof fn === 'function') S.storySubs.push(fn); return () => { const i = S.storySubs.indexOf(fn); if (i >= 0) S.storySubs.splice(i, 1); }; },
    guest,
    // not in the contract: the tests and the report read these
    B, TX, LIST, validateCard, chooseTarget, drawHook, frameOf, downFrame, toneColour, coopFigures, FIG, story,
    stats: S.stats, wireNet: net.wire,
  };
  Object.defineProperties(api, { S: { get: () => S, enumerable: false }, earned: { get: () => S.earned, enumerable: true } });
  return api;
})();
if (typeof window !== 'undefined') window.PARTNER19 = PARTNER19;
