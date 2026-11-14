// voices — Phase 7 (sound, access & tools). Procedural vocal grunts and greetings for every NPC and enemy family,
// plus the full in-game credits table. Owned by the VOICES team; see ROADMAP.md, CREDITS.md and ASSETS.md.
//
// How it sounds: a glottal buzz (sawtooth) goes through three parallel band-pass formants (a vowel), with a little
// breath noise on top; pitch, formant scale and style are per character. Hollows are breath through the same
// formants with no buzz (toneless); the Legion is brass-throated (narrow, loud formants over a stacked buzz);
// Kaelen is low gravel; beasts growl; golems rumble; the Quiet, the Hush-moths, the Tongueless and a voiceless Lyra
// are SILENT and create no nodes at all. Procedural stand-in: a final pass can swap in recorded or sampled voices
// through the same profile table.
//
// Hooks (wrapped, never edited): Audio_.sfx.enemy(def, ev) for alert / hurt / death, talk() for the greeting when a
// dialogue opens, renderDialogue() for the optional spoken line (the game's own speakLine, browser speechSynthesis).
// Everything connects to Audio_.sfxBus, waits for Audio_.ctx, respects Audio_.muted, and is rate-limited.
// Setting: Options > Graphics & access > Voices (Off / Grunts / Grunts + spoken). Off creates no audio nodes.
'use strict';

const VOICES = (() => {
  // a private random stream: sound never draws from Math.random, so audio can't shift gameplay rolls
  const audioRnd = (() => { let s = (Date.now() ^ 0x9e3779b9) >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();
  const KEY = 'octave.voices.v1';
  const MODES = ['off', 'grunts', 'acted', 'spoken'];
  const MODE_LABEL = { off: 'Off', grunts: 'Grunts', acted: 'Voiced', spoken: 'Voiced + read aloud' };
  const st = { mode: 'acted', played: 0, limited: 0, silent: 0, nodes: 0, last: null, active: [], lastAt: -1e9, keyAt: {} };

  // ---- persistence (guarded: previews and private windows have no storage) -----------------------
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ m: st.mode })); } catch (e) { /* no storage: fine */ } }
  function load() {
    try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && MODES.includes(o.m)) st.mode = o.m; } catch (e) { /* ignore */ }
  }
  const hasSpeech = () => typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
  function setMode(m) { if (MODES.includes(m)) { st.mode = m; save(); } return st.mode; }
  function cycleMode() {
    const order = hasSpeech() ? MODES : ['off', 'grunts', 'acted'];
    const i = order.indexOf(st.mode);
    return setMode(order[(i + 1) % order.length]);
  }

  // ---- vowels: three formant centres in Hz, and how loud each is -----------------------------------
  const VOWEL = {
    a: { f: [730, 1090, 2440], g: [1, 0.5, 0.2] },
    e: { f: [530, 1840, 2480], g: [1, 0.55, 0.22] },
    i: { f: [270, 2290, 3010], g: [1, 0.35, 0.25] },
    o: { f: [570, 840, 2410], g: [1, 0.6, 0.12] },
    u: { f: [300, 870, 2240], g: [1, 0.45, 0.1] },
    m: { f: [250, 1000, 2200], g: [1, 0.06, 0.03] },     // the closed-mouth hum of "hm"
    h: { f: [500, 1500, 2500], g: [0.5, 0.5, 0.4] },     // an open breath
  };

  // ---- styles: how the throat behaves. q = formant sharpness, buzz = voiced level, breath = noise level ----
  const STYLE = {
    human:  { q: 7,  buzz: 1,   breath: 0.10 },
    gravel: { q: 6,  buzz: 1,   breath: 0.30, sub: 0.55 },
    brass:  { q: 13, buzz: 1,   breath: 0.06, stack: true, bright: [520, 1380, 2750] },
    breathy:{ q: 3,  buzz: 0,   breath: 0.9 },
    beast:  { q: 4,  buzz: 0.9, breath: 0.45, sub: 0.7 },
    golem:  { q: 9,  buzz: 1,   breath: 0.2, sub: 0.9 },
    multi:  { q: 6,  buzz: 1,   breath: 0.2, fifth: true },   // layered voices: the Wearer, the Weaver, the Requiem
    chord:  { q: 10, buzz: 1,   breath: 0.05, fifth: true, sub: 0.5 },
    cat:    { q: 8,  buzz: 1,   breath: 0.08 },
    swarm:  { q: 5,  buzz: 0.2, breath: 0.9 },
    silent: { q: 1,  buzz: 0,   breath: 0 },
  };

  // ---- the people: pitch (Hz), formant scale (bigger throat < 1), style -----------------------------
  // Authored one by one from each character's canon (age, build, trade); suffixes _wg / _dw (later parts) share them.
  const PEOPLE = {
    harrow:    { f0: 104, fs: 0.93, style: 'human' },    // old gate-warden, dry
    lyra:      { f0: 214, fs: 1.12, style: 'human' },    // Cantor; a trained, clear voice
    kaelen:    { f0: 82,  fs: 0.86, style: 'gravel' },   // low gravel
    hetty:     { f0: 182, fs: 1.06, style: 'human' },
    vane:      { f0: 118, fs: 0.95, style: 'human' },    // airship captain
    rooke:     { f0: 132, fs: 0.98, style: 'human' },    // surgeon-grafter, clipped
    orla:      { f0: 198, fs: 1.1,  style: 'human' },
    pim:       { f0: 262, fs: 1.2,  style: 'human' },    // a boy
    vosk:      { f0: 168, fs: 1.0,  style: 'human' },    // Consortium factor, precise
    aldric:    { f0: 112, fs: 0.92, style: 'human' },    // the Governor
    tobiah:    { f0: 142, fs: 1.0,  style: 'human' },
    bettany:   { f0: 186, fs: 1.04, style: 'human' },
    tam:       { f0: 94,  fs: 0.92, style: 'human' },    // the night-hummer
    hob:       { f0: 98,  fs: 0.9,  style: 'gravel' },   // tanner
    nell:      { f0: 236, fs: 1.15, style: 'human' },
    ignatius:  { f0: 108, fs: 0.94, style: 'human' },    // Flambeau of the Pure Note
    p12_herald: { f0: 124, fs: 0.97, style: 'human' },   // Phase 12: the Church's herald at the Rite, a carrying public voice
    p15s_preacher: { f0: 112, fs: 0.95, style: 'human' },   // Phase 15: the Chapel's preaching deacon, measured and even
    // Phase 16: Stillwater Landing and the Flume Road, Depot Three, the Drift-Kestrel
    p16f_pellam: { f0: 118, fs: 0.96, style: 'human' },     // the lockkeeper: smooth, selling
    p16f_madge: { f0: 190, fs: 1.08, style: 'human' },      // the fence: low for a woman, unhurried
    p16f_orrin: { f0: 98, fs: 0.93, style: 'human' },       // a Timber Compact cutter: deep, plain
    p16f_hand: { f0: 108, fs: 0.95, style: 'human' },       // a dock hand
    p16f_wife: { f0: 210, fs: 1.1, style: 'human' },       // the cutter's wife on the raft
    p16h_vause: { f0: 184, fs: 1.07, style: 'human' },      // Sergeant Vause: professional, clipped
    p16k_pennick: { f0: 104, fs: 0.94, style: 'human' },    // the Kestrel's engineer: dry, pessimistic
    // Phase 17 CANTABILE: Port Cantabile (the Salt Stair, the Mole, the Cay)
    p17c_teague: { f0: 112, fs: 0.95, style: 'human' },     // the harbour clerk: flat, bureaucratic
    p17c_oona: { f0: 176, fs: 1.04, style: 'human' },       // the Harbour-Queen: level, withholding
    p17c_bessa: { f0: 236, fs: 1.12, style: 'breathy' },    // the last Reef-Reader: old, eyes shut, soft
    p17c_teel: { f0: 100, fs: 0.93, style: 'human' },       // a free captain: rum-roughened
    p17c_sloe: { f0: 124, fs: 0.97, style: 'human' },       // the chandler: dry, particular
    p17c_tace: { f0: 206, fs: 1.08, style: 'human' },       // Marrin Tace, the widow: careful, kind
    p17c_dunmore: { f0: 130, fs: 0.98, style: 'human' },    // the Office clerk: pleasant as a shut door
    p17c_hesper: { f0: 150, fs: 0.9, style: 'human' },      // Hesper: foghorn-deep, slow, gentle
    p17c_quain: { f0: 96, fs: 0.92, style: 'human' },       // the Cay ferryman, hat over his eyes
    p17c_hesper2: { f0: 150, fs: 0.9, style: 'human' },     // Hesper on the Cay
    p17c_quain2: { f0: 96, fs: 0.92, style: 'human' },      // Quain on the Cay jetty
    p17c_mags: { f0: 190, fs: 1.07, style: 'silent' },      // Mags signs, she does not speak
    p17c_wife: { f0: 212, fs: 1.1, style: 'human' },
    p17c_hand: { f0: 110, fs: 0.95, style: 'human' },
    p17c_child: { f0: 300, fs: 1.25, style: 'human' },      // a child of the Cay
    townsman:  { f0: 122, fs: 0.97, style: 'human' },
    townswoman:{ f0: 202, fs: 1.08, style: 'human' },
    sable:     { f0: 208, fs: 1.1,  style: 'human' },
    umber:     { f0: 232, fs: 1.06, style: 'human' },
    halder:    { f0: 102, fs: 0.93, style: 'human' },
    quist:     { f0: 126, fs: 0.97, style: 'human' },
    aegis:     { f0: 70,  fs: 0.8,  style: 'chord' },    // the Sentinel sings its alto line
    cat:       { f0: 560, fs: 1.3,  style: 'cat' },
    lamplighter:{ f0: 128, fs: 1.0, style: 'breathy' },  // a Hollow
    bettis:    { f0: 198, fs: 1.05, style: 'breathy' },  // Bettis Renn, Ivo's wife: a Hollow, until woken
    hollow:    { f0: 140, fs: 1.0,  style: 'breathy' },  // any Hollow talking to no one
    mags:      { f0: 190, fs: 1.07, style: 'human' },
    sexton:    { f0: 92,  fs: 0.91, style: 'human' },
    herald:    { f0: 130, fs: 0.96, style: 'brass' },    // a herald's carrying voice
    mourner:   { f0: 176, fs: 1.04, style: 'breathy' },
    wren:      { f0: 258, fs: 1.18, style: 'human' },
    // Phase 17, team LONGNIGHT: the three Cantors of the Long Night [PROPOSED]
    p17n_marl: { f0: 88, fs: 0.9, style: 'human' },       // Marl Dunning, bass: low, slow, unhurried
    p17n_tansy: { f0: 226, fs: 1.12, style: 'human' },    // Tansy Quill, alto apprentice: thin, young
    p17n_jory: { f0: 116, fs: 0.96, style: 'human' },     // Jory Fenn, lamplighter: plain
    // Phase 17, team PROLOGUE: the river gate (an extra after Book One)
    p17p_dorran: { f0: 84, fs: 0.9, style: 'gravel' },      // Dorran Sedge: "a voice like a bullfrog", sang bass
    p17p_seraphina: { f0: 196, fs: 1.06, style: 'human' },  // Seraphina: low, even
    p17p_aegis: { f0: 70, fs: 0.8, style: 'chord' },        // the Aegis, as the Sentinel
    p17p_ignatius: { f0: 104, fs: 0.93, style: 'human' },   // Ignatius Crane, the preacher's voice gone thin
    p17p_solenne: { f0: 200, fs: 1.08, style: 'brass' },    // Solenne: copper in the throat
  };

  // ---- the enemy families ---------------------------------------------------------------------------
  const BEASTS = {
    hound:       { f0: 150, fs: 0.9,  style: 'beast' },
    mites:       { f0: 1900, fs: 1.3, style: 'swarm' },
    weaverling:  { f0: 340, fs: 1.1,  style: 'beast' },
    broodmother: { f0: 78,  fs: 0.8,  style: 'beast' },
  };
  const ENEMY_VOICES = Object.assign({
    legionnaire: { f0: 104, fs: 0.9,  style: 'brass' },
    golem:       { f0: 58,  fs: 0.78, style: 'golem' },
    proctor:     { f0: 150, fs: 1.0,  style: 'brass' },
    wearer:      { f0: 112, fs: 0.95, style: 'multi' },
    wearer_coda: { f0: 112, fs: 0.95, style: 'multi' },
    weaver:      { f0: 124, fs: 1.0,  style: 'multi' },
    requiem:     { f0: 98,  fs: 0.9,  style: 'multi' },
    quiet:       { style: 'silent' },
    hushmoth:    { style: 'silent' },
    p17n_hollow: { f0: 138, fs: 1.0, style: 'breathy' },   // Phase 17 LONGNIGHT: a Hollow walking toward a held voice
    p17n_hound:  { f0: 150, fs: 0.9, style: 'beast' },
    p17n_moth:   { style: 'silent' },
    tongueless:  { style: 'silent' },                      // no tongue, no sound
    hushwarden:  { style: 'silent' },                      // the game marks it mute
    aegis:       { f0: 66,  fs: 0.8,  style: 'chord' },
    drowned:     { f0: 138, fs: 1.0,  style: 'breathy' },  // a drowned Hollow
    pressman:    { f0: 68,  fs: 0.8,  style: 'golem' },
    horn:        { f0: 86,  fs: 0.85, style: 'brass' },
    marine:      { f0: 118, fs: 0.93, style: 'brass' },
    bosun:       { f0: 98,  fs: 0.9,  style: 'brass' },
    dirge:       { f0: 132, fs: 1.0,  style: 'multi' },
    warden:      { f0: 74,  fs: 0.8,  style: 'golem' },
    deacon:      { f0: 88,  fs: 0.9,  style: 'breathy' },   // the Quiet Faith keep their voices low
    outrider:    { f0: 126, fs: 0.94, style: 'brass' },
    captain:     { f0: 110, fs: 0.92, style: 'brass' },
  }, BEASTS);

  const hash = (s) => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const flagsNow = () => (typeof G !== 'undefined' && G && G.flags) ? G.flags : {};

  // Lyra: voiceless from Whisper-Grove on, and at the Deep Woods until Kaelen has told her everything (lyra_voice),
  // when she speaks again in her "own ruined voice" (breath-heavy, low). Reads existing flags only.
  function lyraState(id) {
    const f = flagsNow();
    if (id === 'lyra_wg') return 'silent';
    if (id === 'lyra_dw') return f.lyra_voice ? 'ruined' : 'silent';
    if (id === 'lyra' && (f.lyra_wg_met || f.lyra_dw_met) && !f.lyra_voice) return 'silent';
    if (id === 'lyra' && f.lyra_voice && (f.lyra_wg_met || f.lyra_dw_met)) return 'ruined';
    return 'clear';
  }

  function baseOf(id) { return String(id).replace(/_(wg|dw)$/, ''); }

  // resolveNpc / resolveEnemy -> a profile { id, kind, style, f0, fs, authored, silent }
  function resolveNpc(id) {
    id = String(id);
    let base = baseOf(id), p = PEOPLE[base];
    let authored = !!p;
    if (!p && typeof NPCS !== 'undefined' && NPCS[id] && NPCS[id].sprite && PEOPLE[NPCS[id].sprite]) { p = PEOPLE[NPCS[id].sprite]; authored = true; }
    if (!p) { const h = hash(id); p = { f0: 100 + (h % 120), fs: 0.92 + ((h >> 8) % 20) / 100, style: 'human' }; }
    let out = Object.assign({ id, kind: 'npc', authored, silent: false }, p);
    if (base === 'lyra') {
      const s = lyraState(id);
      if (s === 'silent') out = Object.assign(out, { style: 'silent', silent: true, why: 'Lyra has no voice' });
      else if (s === 'ruined') out = Object.assign(out, { style: 'gravel', f0: 168, breathMore: 0.5, why: 'her own ruined voice' });
    }
    if (out.style === 'silent') out.silent = true;
    return out;
  }
  function resolveEnemy(id, def) {
    id = String(id);
    def = def || (typeof ENEMIES !== 'undefined' ? ENEMIES[id] : null) || {};
    let p = ENEMY_VOICES[id], authored = !!p;
    if (!p) {
      if (def.quiet || def.hushkin || def.mute) p = { style: 'silent' };
      else if (def.core) p = { f0: 112, fs: 0.93, style: 'brass' };
      else if (def.cacophony) p = { f0: 140, fs: 0.9, style: 'beast' };
      else if (def.armored) p = { f0: 70, fs: 0.8, style: 'golem' };
      else { const h = hash(id); p = { f0: 100 + (h % 60), fs: 0.95, style: 'human' }; }
    }
    const out = Object.assign({ id, kind: 'enemy', authored, silent: false }, p);
    if (def.mute || out.style === 'silent') { out.style = 'silent'; out.silent = true; }
    return out;
  }
  function resolve(kind, id, def) { return kind === 'enemy' ? resolveEnemy(id, def) : resolveNpc(id); }
  function enemyIdOf(def) {
    if (!def || typeof ENEMIES === 'undefined') return null;
    for (const k in ENEMIES) if (ENEMIES[k] === def) return k;
    for (const k in ENEMIES) if (ENEMIES[k].name === def.name && ENEMIES[k].sprite === def.sprite) return k;
    return null;
  }

  // ---- syllable patterns: a short phrase per event --------------------------------------------------
  // v vowel, d seconds, p pitch multiplier start -> end, g loudness, b extra breath. Kept tiny: a grunt is not speech.
  const S = (v, d, p0, p1, g, b) => ({ v, d, p: [p0, p1], g: g == null ? 1 : g, b: b || 0 });
  function pattern(pr, ev) {
    const st_ = pr.style, h = hash(pr.id);
    if (st_ === 'silent') return [];
    if (st_ === 'cat') {
      if (ev === 'greet') return [S('e', 0.22, 1, 1.35), S('a', 0.32, 1.35, 0.8)];            // mrr-ow
      if (ev === 'hurt') return [S('a', 0.14, 1.7, 1.2)];
      if (ev === 'alert') return [S('i', 0.2, 1.1, 1.6)];
      return [S('a', 0.4, 1.2, 0.6)];
    }
    if (st_ === 'swarm') {
      if (ev === 'death') return [S('i', 0.5, 1, 0.5, 0.8, 0.6)];
      const n = ev === 'hurt' ? 3 : 5, out = [];
      for (let i = 0; i < n; i++) out.push(S('i', 0.045, 1 + (i % 2) * 0.12, 1, 0.7, 0.8));
      return out;
    }
    if (st_ === 'breathy') {   // a Hollow: an exhale that almost shapes a word
      const v = ['o', 'a', 'u'][h % 3];
      if (ev === 'greet') return [S('h', 0.5, 1, 0.9, 0.8, 0.5), S(v, 0.35, 0.9, 0.8, 0.5)];
      if (ev === 'alert') return [S('a', 0.34, 0.95, 1.15, 1)];
      if (ev === 'hurt') return [S('a', 0.2, 1.1, 0.8)];
      return [S('o', 0.9, 1, 0.55, 0.9, 0.4)];
    }
    if (st_ === 'beast') {
      if (ev === 'greet') return [S('a', 0.3, 0.9, 1, 0.6)];
      if (ev === 'alert') return [S('a', 0.26, 0.8, 1.05, 1, 0.3), S('a', 0.09, 1.3, 1.1, 1, 0.2), S('a', 0.09, 1.3, 1.1, 0.9, 0.2)];   // growl, bark, bark
      if (ev === 'hurt') return [S('a', 0.15, 1.5, 0.8, 1, 0.2)];
      return [S('a', 0.7, 1.1, 0.35, 1, 0.3)];
    }
    if (st_ === 'golem' || st_ === 'chord') {
      if (ev === 'greet') return [S('o', 0.4, 1, 0.95, 0.8)];
      if (ev === 'alert') return [S('o', 0.55, 0.9, 1.1)];
      if (ev === 'hurt') return [S('o', 0.2, 1.1, 0.85)];
      return [S('o', 1.0, 1, 0.5, 1)];
    }
    if (st_ === 'brass') {
      if (ev === 'greet') return [S('a', 0.2, 1, 1), S('o', 0.26, 1, 0.9)];                  // "hah-oh", clipped
      if (ev === 'alert') return [S('a', 0.3, 1, 1.12)];                                      // a blare
      if (ev === 'hurt') return [S('a', 0.14, 1.15, 0.9)];
      return [S('a', 0.2, 1, 0.9), S('o', 0.5, 0.9, 0.5, 0.8)];
    }
    // human, gravel, multi: "hm-mm" and its cousins
    const hm = [['m', 'm'], ['o', 'm'], ['a', 'm'], ['m', 'a']][h % 4];
    if (ev === 'greet') return [S(hm[0], 0.15, 1, 0.93), S(hm[1], 0.22, 0.93, 1.08)];
    if (ev === 'alert') return [S('e', 0.16, 0.85, 1.35), S('a', 0.12, 1.3, 1.1, 0.8)];     // "hey-a"
    if (ev === 'hurt') return [S('a', 0.13, 1.25, 0.85)];                                    // "ah!"
    return [S('o', 0.28, 1.05, 0.8), S('o', 0.45, 0.8, 0.45, 0.7, 0.2)];                     // a sinking "oh..."
  }

  // ---- gating and rate limits -----------------------------------------------------------------------
  const LIMIT = {
    globalGap: 70,     // ms between any two voices
    maxActive: 3,      // voices sounding at once
    perKey: { greet: 700, alert: 1800, hurt: 380, death: 250 },   // ms between the same event from the same source
  };
  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  function gate(key, ev, t) {
    st.active = st.active.filter((e) => e > t);
    if (t - st.lastAt < LIMIT.globalGap) return false;
    if (st.active.length >= LIMIT.maxActive) return false;
    const k = key + ':' + ev, gap = LIMIT.perKey[ev] || 400;
    if (st.keyAt[k] != null && t - st.keyAt[k] < gap) return false;
    return true;
  }

  // ---- synthesis --------------------------------------------------------------------------------------
  let noiseBuf = null, noiseCtx = null;
  function noise(ctx) {
    if (noiseBuf && noiseCtx === ctx) return noiseBuf;
    const n = Math.floor(ctx.sampleRate * 0.6), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = audioRnd() * 2 - 1;
    noiseBuf = b; noiseCtx = ctx; return b;
  }
  function node(x) { st.nodes++; return x; }

  // one syllable at time t0 (AudioContext seconds)
  function syllable(ctx, out, pr, sy, t0, vol) {
    const sty = STYLE[pr.style], V = VOWEL[sy.v] || VOWEL.a, d = sy.d * (pr.style === 'golem' ? 1.15 : 1);
    const f0 = (pr.f0 || 120) * (1 + (audioRnd() - 0.5) * 0.03);
    const fs = pr.fs || 1;
    const env = node(ctx.createGain());
    const peak = vol * (sy.g == null ? 1 : sy.g);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.03, d * 0.3));
    env.gain.setValueAtTime(peak, t0 + d * 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    env.connect(out);
    // vowel formants in parallel: source -> bandpass -> gain -> env
    const centres = (sty.bright && sy.v !== 'm') ? sty.bright : V.f;
    const formants = [];
    for (let i = 0; i < 3; i++) {
      const bp = node(ctx.createBiquadFilter()); bp.type = 'bandpass';
      bp.frequency.value = Math.min(7000, centres[i] * fs); bp.Q.value = sty.q;
      const g = node(ctx.createGain()); g.gain.value = V.g[i] * (i === 0 ? 1 : 1.3);
      bp.connect(g); g.connect(env); formants.push(bp);
    }
    const feed = (src) => formants.forEach((bp) => src.connect(bp));
    // buzz source
    const buzz = sty.buzz * (sy.v === 'h' ? 0 : 1);
    if (buzz > 0) {
      const bg = node(ctx.createGain()); bg.gain.value = buzz;
      const mkOsc = (type, mult, detune) => {
        const o = node(ctx.createOscillator()); o.type = type;
        o.frequency.setValueAtTime(f0 * mult * sy.p[0], t0);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, f0 * mult * sy.p[1]), t0 + d);
        if (detune) o.detune.value = detune;
        o.start(t0); o.stop(t0 + d + 0.05); return o;
      };
      mkOsc('sawtooth', 1, 0).connect(bg);
      if (sty.stack) { const sg = node(ctx.createGain()); sg.gain.value = 0.6; mkOsc('square', 2, 6).connect(sg); sg.connect(bg); }   // brass: stacked octave
      if (sty.sub) { const sg = node(ctx.createGain()); sg.gain.value = sty.sub; mkOsc('square', 0.5, -9).connect(sg); sg.connect(bg); }   // gravel / rumble
      if (sty.fifth) { const fg = node(ctx.createGain()); fg.gain.value = 0.7; mkOsc('sawtooth', 1.5, 12).connect(fg); fg.connect(bg); }   // layered voices
      feed(bg);
    }
    // breath noise (all of a Hollow's sound; a whisper on the others)
    const br = (sty.breath + (sy.b || 0) + (pr.breathMore || 0)) * (sy.v === 'm' ? 0.4 : 1);
    if (br > 0) {
      const ns = node(ctx.createBufferSource()); ns.buffer = noise(ctx); ns.loop = true;
      const ng = node(ctx.createGain()); ng.gain.value = Math.min(1.6, br) * (sty.buzz === 0 ? 1 : 0.5);
      ns.connect(ng);
      if (sty.buzz === 0) feed(ng);
      else { const hp = node(ctx.createBiquadFilter()); hp.type = 'bandpass'; hp.frequency.value = 1800 * fs; hp.Q.value = 0.8; ng.connect(hp); hp.connect(env); }
      ns.start(t0, audioRnd() * 0.3); ns.stop(t0 + d + 0.05);
    }
  }

  // play(kind, id, ev, def) -> number of syllables scheduled (0 = nothing sounded)
  function play(kind, id, ev, def, atMs) {
    if (st.mode === 'off') return 0;
    const ctx = typeof Audio_ !== 'undefined' ? Audio_.ctx : null;
    if (!ctx || !Audio_.sfxBus || Audio_.muted) return 0;
    const pr = resolve(kind, id, def);
    if (pr.silent) { st.silent++; return 0; }
    const t = atMs == null ? nowMs() : atMs, key = kind + ':' + id;
    if (!gate(key, ev, t)) { st.limited++; return 0; }
    // recorded lines (js/voice-acting.js) take the event when one fits; the grunt is the fallback
    if ((st.mode === 'acted' || st.mode === 'spoken') && typeof VOICE_ACT !== 'undefined') {
      const dur = VOICE_ACT.handle(kind, id, ev, pr);
      if (dur) {
        st.lastAt = t; st.keyAt[key + ':' + ev] = t; st.active.push(t + dur * 1000);
        st.played++; st.last = { kind, id, ev, style: 'acted', syllables: 0 };
        return 1;
      }
    }
    const pat = pattern(pr, ev);
    if (!pat.length) return 0;
    const vol = (pr.kind === 'enemy' ? 0.36 : 0.28) * (ev === 'death' ? 1.1 : 1);
    let t0 = ctx.currentTime + 0.01, span = 0;
    for (const sy of pat) { syllable(ctx, Audio_.sfxBus, pr, sy, t0 + span, vol); span += sy.d + 0.035; }
    st.lastAt = t; st.keyAt[key + ':' + ev] = t; st.active.push(t + span * 1000);
    st.played++; st.last = { kind, id, ev, style: pr.style, syllables: pat.length };
    return pat.length;
  }

  // ---- the spoken line (browser speech synthesis, via the game's own speakLine) ---------------------
  let spokenLen = 0;
  function speakNew() {
    if (st.mode !== 'spoken' || !hasSpeech() || typeof speakLine !== 'function' || typeof DLG === 'undefined' || !DLG.npc || !DLG.log) return false;
    if (DLG.log.length <= spokenLen) return false;
    const last = DLG.log[DLG.log.length - 1]; spokenLen = DLG.log.length;
    if (!last || last.who !== 'them' || !last.t) return false;
    if (typeof VOICE_ACT !== 'undefined' && VOICE_ACT.covers(String(last.t))) return false;   // a recorded line already says it
    const was = UPG.tts;
    try { UPG.tts = true; speakLine(String(last.t), String(DLG.npc.name || '')); } finally { UPG.tts = was; }
    return true;
  }

  // ---- options and credits ---------------------------------------------------------------------------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function el(tag, props, text) {
    const e = document.createElement(tag);
    if (props) for (const k in props) { if (k === 'style') e.style.cssText = props[k]; else e.setAttribute(k, props[k]); }
    if (text != null) e.textContent = text;
    return e;
  }

  // The audit, as constants (nothing here comes from a save). Mirrors CREDITS.md and ASSETS.md; "unverified" means the
  // repository does not record the answer, so the game does not claim one.
  const FONT_FILES = [
    'alegreya-latin-400-italic.woff2', 'alegreya-latin-400-normal.woff2', 'alegreya-latin-500-italic.woff2',
    'alegreya-latin-500-normal.woff2', 'alegreya-latin-700-italic.woff2', 'alegreya-latin-700-normal.woff2',
    'alegreya-sc-latin-500-normal.woff2', 'alegreya-sc-latin-700-normal.woff2', 'cinzel-latin-500-normal.woff2',
    'cinzel-latin-700-normal.woff2', 'UnifrakturMaguntia.woff2',
    'OFL-Alegreya.txt', 'OFL-AlegreyaSC.txt', 'OFL-Cinzel.txt', 'OFL-UnifrakturMaguntia.txt',
  ];
  const MUSIC_FILES = ['coda.mp3', 'combat.mp3', 'dungeon.mp3', 'ending.mp3', 'greening.mp3', 'grove.mp3', 'tavern.mp3', 'title.mp3', 'town.mp3', 'wild.mp3'];
  const OFL = 'SIL Open Font License 1.1 (text in fonts/)';
  const CREDIT_SECTIONS = [
    { title: 'Typefaces', rows: [
      ['Cinzel', 'The Cinzel Project Authors (2020)', OFL, ['cinzel-latin-500-normal.woff2', 'cinzel-latin-700-normal.woff2', 'OFL-Cinzel.txt']],
      ['Alegreya', 'The Alegreya Project Authors (2011)', OFL, ['alegreya-latin-400-italic.woff2', 'alegreya-latin-400-normal.woff2', 'alegreya-latin-500-italic.woff2', 'alegreya-latin-500-normal.woff2', 'alegreya-latin-700-italic.woff2', 'alegreya-latin-700-normal.woff2', 'OFL-Alegreya.txt']],
      ['Alegreya SC', 'The Alegreya Project Authors (2011)', OFL, ['alegreya-sc-latin-500-normal.woff2', 'alegreya-sc-latin-700-normal.woff2', 'OFL-AlegreyaSC.txt']],
      ['UnifrakturMaguntia', "j. 'mach' wust and Peter Wiegel (2009-2010)", OFL + '; titles and headings only', ['UnifrakturMaguntia.woff2', 'OFL-UnifrakturMaguntia.txt']],
    ] },
    { title: 'Music (music/)', rows: [
      ['Title, Town, Tavern, Wild, Dungeon, Grove, Coda, Combat, Greening, Ending', 'Score for this game, described in the README and audio.js as original orchestral cues; composer and rendering tool not recorded: unverified', 'Licence: unverified', MUSIC_FILES],
      ['The opening (music/opening.mp3)', 'The opening cinematic\'s score, composed for this game in tools/music/pieces/opening.py and rendered like the Extended score', 'Composition: game source; FluidR3 GM soundfont: MIT', ['opening.mp3']],
      ['Extended score (music/extended/, 22 pieces)', 'Composed for this game in tools/music/ and rendered with FluidSynth using the FluidR3 GM soundfont (Frank Wen); reverb with pedalboard', 'Compositions: game source; FluidR3 GM soundfont: MIT', []],
      ['Paintings (img/painted/)', 'Loading cards, death and ending pictures, logbook sketches: generated with Canva AI (five area cards) and locally with DreamShaper 8 LCM (tools/art/paint.py)', 'Canva: per the owner\'s Canva terms; DreamShaper: CreativeML OpenRAIL-M', []],
    ] },
    { title: 'Sound effects and voices', rows: [
      ['Footsteps, weather, combat, bells, doors, songs', 'Generated live with WebAudio in js/audio.js; no recorded samples', 'Part of the game source; licence: unverified (no licence file in the repository)', []],
      ['Grunts and greetings (this panel\'s setting)', 'Formant synthesis in js/voices.js; one profile per character and enemy family; no recordings', 'Part of the game source; licence: unverified', []],
      ['Voiced lines (voices/)', 'Greetings, barks, boss and companion lines for every speaking character, generated offline with the Kokoro-82M text-to-speech model and its voices (hexgrad), then treated per character by tools/voices/build.py; words from the game\'s own text, and short barks marked PROPOSED in voices/script.json', 'Kokoro-82M and voices: Apache-2.0; the lines are game text', []],
      ['Spoken lines (optional)', 'Your browser\'s own speech synthesis voices; nothing is bundled', 'Depends on your device', []],
    ] },
    { title: 'Art', rows: [
      ['Portraits, faces, maps, title and ending paintings', 'img/ (39 images). How they were made is not recorded in the repository: unverified', 'Licence: unverified', []],
      ['Wall textures, sprites and first-person weapons', 'Embedded in js/assets.js. Origin not recorded: unverified', 'Licence: unverified', []],
      ['Frames, icons, sky, weather, light, animation and screens', 'Procedural stand-ins drawn by the game\'s own code (canvas, SVG, CSS), awaiting painted art', 'Part of the game source', []],
    ] },
    { title: 'Tools', rows: [
      ['Playwright and Chromium', 'Browser tests (test/). Not bundled with the game', 'Playwright: Apache-2.0 upstream; Chromium: its own licences', []],
      ['Font subsets', 'Latin subsets of the typefaces above were cut with the @fontsource packages (per css/fonts.css)', 'Typefaces: OFL; packaging licence: unverified', []],
      ['Local server', 'Python http.server, for local play and tests', 'PSF licence upstream; not bundled', []],
      ['Voice build tools', 'kokoro-onnx (MIT), onnxruntime (MIT), pedalboard (GPL-3.0) and ffmpeg, used offline by tools/voices/build.py; none ships with the game', 'Their own licences; not bundled', []],
    ] },
    { title: 'Contributors', rows: [
      ['Project owner', 'The GitHub account named in the README\'s Pages link (dribblejerp-klunkdunker)', 'Design, story and direction: stated by the project, not verifiable from the repository', []],
      ['Code', 'Git history (at the time of the audit): 93 commits by "Claude", 1 by "Codebuff"; co-author trailers name Claude Opus 5.5, Claude Sonnet 5.5 and Codebuff', 'AI-assisted; see CREDITS.md', []],
    ] },
  ];
  function creditedFiles() {
    const out = new Set();
    for (const s of CREDIT_SECTIONS) for (const r of s.rows) for (const f of r[3]) out.add(f);
    return Array.from(out);
  }
  function creditsHtml() {
    return CREDIT_SECTIONS.map((s) => `<h3 class="vc-h">${esc(s.title)}</h3><table class="credits-table">${
      s.rows.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td class="muted">${esc(r[2])}${r[3].length ? `<br><small>${esc(r[3].join(', '))}</small>` : ''}</td></tr>`).join('')
    }</table>`).join('');
  }
  function renderFullCredits() {
    openModal(`<h2>Full credits</h2><button class="dfbtn small close" id="x">Close</button>
    <p class="muted">Everything the game ships with, and where it came from. "Unverified" means the project's files do not record it. The same audit is in CREDITS.md and ASSETS.md.</p>
    <div class="vc-body" id="vc-body" tabindex="0">${creditsHtml()}</div>
    <div class="btns"><button class="dfbtn small" id="vc-back">Back to Graphics &amp; access</button></div>`, 'credits');
    const p = document.getElementById('modal-panel'); if (p) p.classList.add('credits');
    document.getElementById('x').onclick = () => { closeModal(); G.state = 'play'; };
    document.getElementById('vc-back').onclick = () => renderAccessibilityMenu();
  }

  function appendRows() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById('voices-mode')) return;
    const lab = el('span', { class: 'gfx-label' }, 'Voices ');
    lab.appendChild(el('small', { class: 'muted' }, hasSpeech() ? 'Voiced: recorded greetings, barks and boss lines, grunts for the rest; read aloud adds your browser reading the dialogue' : 'Voiced: recorded greetings, barks and boss lines, grunts for the rest'));
    const b = el('button', { class: 'dfbtn small', id: 'voices-mode', type: 'button' }, MODE_LABEL[st.mode]);
    b.setAttribute('aria-label', 'Voices');
    const paint = () => { b.textContent = MODE_LABEL[st.mode]; b.setAttribute('aria-pressed', st.mode === 'off' ? 'false' : 'true'); b.classList.toggle('sel', st.mode !== 'off'); };
    b.onclick = () => { cycleMode(); paint(); if (st.mode !== 'off') { try { if (typeof Audio_ !== 'undefined') { Audio_.init(); Audio_.resume(); } st.lastAt = -1e9; st.keyAt = {}; play('npc', 'hetty', 'greet', null); } catch (e) { /* preview only */ } } };
    paint();
    grid.appendChild(lab); grid.appendChild(b);
    // sibling to frames.js's font-only Credits row (which this module may not edit)
    if (!document.getElementById('voices-credits')) {
      const l2 = el('span', { class: 'gfx-label' }, 'Full credits ');
      l2.appendChild(el('small', { class: 'muted' }, 'art, music, sound, fonts, tools and contributors'));
      const c = el('button', { class: 'dfbtn small', id: 'voices-credits', type: 'button' }, 'Full credits');
      c.onclick = () => renderFullCredits();
      grid.appendChild(l2); grid.appendChild(c);
    }
  }

  let styleEl = null;
  function injectStyle() {
    if (styleEl || typeof document === 'undefined') return;
    styleEl = document.createElement('style'); styleEl.id = 'voices-style';
    styleEl.textContent = `
#modal-panel.credits .vc-body { max-height: 56cqh; overflow-y: auto; padding-right: .8cqw; font-size: 1.9cqw; }
#modal-panel.credits .vc-h { margin: 1.2cqh 0 .4cqh; color: var(--gold); font-family: var(--font-display); letter-spacing: .06em; font-size: 2.3cqw; }
#modal-panel.credits .vc-body td { vertical-align: top; padding: .3cqh 1cqw .3cqh 0; }
#modal-panel.credits .vc-body small { font-size: 1.5cqw; overflow-wrap: anywhere; }
`;
    document.head.appendChild(styleEl);
  }

  // ---- wiring ------------------------------------------------------------------------------------------
  let rawEnemy = null;
  function wire() {
    if (typeof Audio_ !== 'undefined' && Audio_.sfx && typeof Audio_.sfx.enemy === 'function') {
      const _enemy = Audio_.sfx.enemy; rawEnemy = _enemy;
      Audio_.sfx.enemy = function (def, ev) {
        const r = _enemy.apply(this, arguments);
        try { if (ev === 'alert' || ev === 'hurt' || ev === 'death') { const id = enemyIdOf(def); if (id) play('enemy', id, ev, def); } } catch (e) { console.warn('voices enemy failed', e); }
        return r;
      };
    }
    if (typeof talk === 'function') {
      const _talk = talk;
      talk = function (e) {
        spokenLen = 0;   // a new conversation: renderDialogue (wrapped below) speaks its first line
        const r = _talk.apply(this, arguments);
        try {
          if (e && (G.state === 'dialogue' || e.id === 'hollow')) play('npc', e.id, 'greet', null);
        } catch (err) { console.warn('voices greet failed', err); }
        return r;
      };
    }
    if (typeof renderDialogue === 'function') {
      const _rd = renderDialogue;
      renderDialogue = function () {
        const r = _rd.apply(this, arguments);
        try { speakNew(); } catch (e) { console.warn('voices speak failed', e); }
        return r;
      };
    }
    if (typeof renderAccessibilityMenu === 'function') {
      const _acc = renderAccessibilityMenu;
      renderAccessibilityMenu = function () {
        const r = _acc.apply(this, arguments);
        try { appendRows(); } catch (e) { console.warn('voices rows failed', e); }
        return r;
      };
    }
  }

  load();
  injectStyle();
  wire();
  return {
    MODES, MODE_LABEL, LIMIT, STYLE, PEOPLE, ENEMY_VOICES, FONT_FILES, MUSIC_FILES, CREDIT_SECTIONS,
    state: st, get mode() { return st.mode; }, setMode, cycleMode, hasSpeech,
    resolveNpc, resolveEnemy, resolve, enemyIdOf, pattern, play, speakNew, gate,
    creditedFiles, creditsHtml, renderFullCredits, appendRows, save, load,
    resetLimits() { st.lastAt = -1e9; st.keyAt = {}; st.active = []; },
    get rawEnemy() { return rawEnemy; },
  };
})();
if (typeof window !== 'undefined') window.VOICES = VOICES;
