// ============================================================
//  net19 — Phase 19 "Together", team NET: the transport and the lobby for two-player co-op.
//
//  ====================================================================================================================
//  THE NET19 API CONTRACT (v1). Teams SYNC and PARTNER code against exactly this; the signatures do not change.
//  ====================================================================================================================
//  Sessions are two players: one HOST (the world) and one GUEST. Nothing here runs, touches G, the canvas, the RNG or
//  the saves until a player presses Host or Join, so single-player is unchanged.
//
//  Lifecycle
//    NET19.host(opts?)        -> Promise<{ code }>   start hosting; code is the 6-letter join code ("KRT4MW", shown
//                                                    "KRT-4MW"). opts: { transport, name, code } (see Transports).
//    NET19.join(code, opts?)  -> Promise<void>       connect to a host; resolves once the host has said welcome.
//                                                    Rejects with Error whose .code is one of 'no-host' | 'full' |
//                                                    'version' | 'timeout' | 'bad-code' | 'transport'.
//    NET19.leave(reason?)     -> void                clean disconnect (the other side gets 'net:closed').
//    NET19.role()             -> 'host' | 'guest' | null    null = not in a session (single-player).
//    NET19.connected()        -> boolean             a guest/host is on the other end right now (handshake done).
//    NET19.peers()            -> [{ id: 'host'|'guest', name, state: 'open'|'lost', rtt }]   (0 or 1 entries)
//    NET19.stats()            -> { role, state, transport, code, rtt, rttAvg, sent, recv, bytesOut, bytesIn,
//                                  kbpsOut, kbpsIn, rejected, reasons: {why: n}, lost, reconnects, unreliable }
//                                state: 'idle' | 'hosting' (waiting for a guest) | 'connecting' | 'open' | 'lost' | 'closed'
//                                unreliable: true when {reliable:false} really goes over a lossy, unordered channel.
//
//  Messages
//    NET19.define(type, spec) -> void   tightens a type: size, rate, who may send it, a validate() check. A type that
//         is only used through on()/send() without define() gets the DEFAULT spec { max: 16384, rate: 60, burst: 120,
//         from: 'any', no validate } (your handler then validates); frames of a type this side has neither defined nor
//         subscribed to are dropped. define() after that replaces the default. Recommended for every type.
//         type: /^[a-z][a-z0-9_.:-]{0,31}$/ ; 'net.' is reserved. Use your team prefix: 'sync.*', 'partner.*'.
//         spec: { max: bytes of the whole frame (default 2048, hard cap 32768),
//                 rate: messages per second allowed from the peer (default 10), burst: (default 2*rate),
//                 from: 'host' | 'guest' | 'any' — who may SEND this type (default 'any'); anything else is dropped,
//                 validate(payload, meta) -> boolean — your shape/range check; throwing counts as false }
//         Every incoming frame is checked in this order: version byte, size (64 KB link cap, then spec.max), JSON,
//         envelope shape, depth <= 8 / <= 1024 keys / no __proto__-style keys, type known, sender role, rate, validate.
//         A failure drops the frame and counts it in stats().reasons; a flood of failures closes the link.
//    NET19.on(type, fn)       -> off()   fn(payload, meta) with meta = { from: 'host'|'guest', seq, reliable, at }
//         at = performance.now() on arrival. Unreliable frames older than the newest seen of the same type are dropped.
//         Lifecycle events come through on() too (no define needed):
//           'net:state'  { state }                 every state change
//           'net:peer'   { id, name }              the other player arrived (host: guest joined; guest: welcomed)
//           'net:lost'   { id }                    no word from them for lostMs; the host carries on alone meanwhile
//           'net:back'   { id, name }              the same player reconnected after a drop
//           'net:closed' { reason }                session over: 'left' | 'kicked' | 'gave-up' | 'full' | 'error' | 'local'
//    NET19.off(type, fn)
//    NET19.send(type, payload, { reliable = true }?) -> boolean
//         payload: plain JSON data (no functions, cycles, typed arrays). Returns false when nobody is connected, the type
//         is not defined/reserved, or the frame is larger than spec.max. reliable:true = ordered, never lost (events);
//         reliable:false = may be dropped or overtaken (state snapshots: send often, the newest wins).
//
//  Testing hooks (the same API on separate instances)
//    NET19.create(opts?)      -> a new, independent instance with this whole API (two in one page = host + guest)
//    NET19.loopbackPair(opts?)-> Promise<{ host, guest }> two fresh instances already connected in-page (no network);
//                                opts.loss (0..1) drops that share of unreliable frames, opts.latency adds ms each way.
//    NET19.configure(cfg)     -> merge { broker: { host, port, path, secure, key }, iceServers: [...], heartbeatMs,
//                                lostMs, giveUpMs, joinTimeoutMs, reconnectTimeoutMs } into the default config (tests point the broker at
//                                a local stub and set iceServers: [] so nothing reaches the internet).
//
//  ICE (CONFIG.iceServers): Google STUN for the direct way, which ICE always prefers, and PeerJS's public TURN relays
//    (eu-0 / us-0.turn.peerjs.com, the ones PeerJS 1.5.5 ships) used only when no direct way exists (mobile data, strict
//    NATs). Tests configure iceServers: [] so nothing reaches the internet.
//  Transports (opts.transport): 'peer' (default: PeerJS broker + WebRTC, js/vendor/peerjs.min.js, loaded on demand),
//    'bc' (BroadcastChannel: two tabs of the same browser, no network), 'loop' (two instances in one page), or an
//    injected object { name, listen(code, onLink) -> Promise, connect(code) -> Promise<link>, close() } where
//    link = { send(str, reliable) -> bool, close(), onmessage(str, reliable), onclose(), unreliable }.
//    The manual copy-paste path (no broker at all) is NET19.manual: hostOffer() -> Promise<offerCode>,
//    hostAccept(answerCode) -> Promise, guestAnswer(offerCode) -> Promise<answerCode>; the session then opens as above.
//  ====================================================================================================================
//
//  SECURITY: the other player is untrusted. Every frame is validated (above); nothing from the network is ever put into
//  markup (names go in through textContent and are cleaned: no control or bidi characters, at most 24 characters); no
//  eval; join and manual codes are parsed with fixed rules and size caps. Random codes come from crypto.getRandomValues,
//  never Math.random (the game's RNG order is untouched).
//  Keys: localStorage 'octave.net19.v1' (the name you play under; last code joined). Flags: none (prefix p19n_ reserved).
// ============================================================
'use strict';

const NET19 = (function () {
  const PROTO = 1;                                   // the version byte, first character of every frame
  const LINK_CAP = 65536;                            // no frame larger than this is even parsed
  const TYPE_CAP = 32768;                            // the largest spec.max a team may ask for
  const TYPE_RE = /^[a-z][a-z0-9_.:-]{0,31}$/;
  const CODE_ABC = '23456789ABCDEFGHJKMNPQRSTVWXYZ';   // no 0/O, 1/I/L, U (reads as V): easy to say over the phone
  const CODE_LEN = 6;
  const ID_PREFIX = 'octave19-';                     // PeerJS id = prefix + code (lower case)
  const BAD_KEYS = { __proto__: 1, constructor: 1, prototype: 1 };
  const NAME_MAX = 24;
  const DEFAULT_SPEC = { max: 16384, rate: 60, burst: 120, from: 'any' };

  const DEFAULTS = {
    broker: { host: '0.peerjs.com', port: 443, path: '/', secure: true, key: 'peerjs' },  // PeerJS's free public broker
    // Google STUN finds the direct way (preferred: ICE tries direct candidates first); PeerJS's public TURN relays (the
    // ones PeerJS 1.5.5 itself ships) carry the link only when no direct way exists, e.g. a phone on mobile data
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'turn:eu-0.turn.peerjs.com:3478', username: 'peerjs', credential: 'peerjsp' },
      { urls: 'turn:us-0.turn.peerjs.com:3478', username: 'peerjs', credential: 'peerjsp' },
    ],
    heartbeatMs: 1000, lostMs: 4500, giveUpMs: 90000, joinTimeoutMs: 20000, reconnectMs: 2500, reconnectTimeoutMs: 8000,
    inRate: 240, inBurst: 480,                       // all frames per second from the peer, any type
    abuse: 400,                                      // rejected frames within 10 s that close the link
  };
  const CONFIG = JSON.parse(JSON.stringify(DEFAULTS));

  const warned = {};
  function warnOnce(k, e) { if (!warned[k]) { warned[k] = true; try { console.warn('net19 ' + k, e); } catch (e2) { /* no console */ } } }
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  function err(code, text) { const e = new Error(text || code); e.code = code; return e; }

  // ---------------------------------------------------------------- small pure helpers (exported for tests)
  function randomCode() {
    const out = [], buf = new Uint32Array(CODE_LEN);
    crypto.getRandomValues(buf);
    for (let i = 0; i < CODE_LEN; i++) out.push(CODE_ABC[buf[i] % CODE_ABC.length]);
    return out.join('');
  }
  // what the guest typed (or a pasted join link) -> the code, or '' when it can't be one. Case, spaces and dashes are
  // forgiven; the alphabet has no look-alikes to confuse, so anything outside it is simply not a code.
  function normCode(s) {
    if (typeof s !== 'string' || s.length > 200) return '';
    // a pasted join link: take the code from #join=...
    const m = /[#&?]join=([A-Za-z0-9-]{4,16})/.exec(s);
    if (m) s = m[1];
    let c = s.toUpperCase().replace(/[\s\-_.]/g, '');
    if (c.length !== CODE_LEN) return '';
    for (const ch of c) if (CODE_ABC.indexOf(ch) < 0) return '';
    return c;
  }
  const showCode = (c) => (c && c.length === CODE_LEN ? c.slice(0, 3) + '-' + c.slice(3) : c || '');
  // control characters, bidi overrides and isolates, line/paragraph separators, zero-width characters, BOM, specials.
  // Built from code points so the source stays plain ASCII.
  const hex4 = (n) => '\\' + 'u' + ('000' + n.toString(16)).slice(-4);
  const STRIP_RE = new RegExp('[' + [[0x0, 0x1f], [0x7f, 0x9f], [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x206f], [0xfeff, 0xfeff], [0xfff9, 0xfffb]]
    .map(([a, b]) => hex4(a) + '-' + hex4(b)).join('') + ']', 'g');
  function cleanName(s) {
    if (typeof s !== 'string') return '';
    s = s.replace(STRIP_RE, '').replace(/\s+/g, ' ').trim();
    return Array.from(s).slice(0, NAME_MAX).join('');
  }
  // depth / key-count / dangerous-key check of parsed JSON
  function sane(v, depth, budget) {
    if (v === null || typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return typeof v !== 'number' || Number.isFinite(v);
    if (typeof v !== 'object' || depth > 8) return false;
    if (Array.isArray(v)) { budget.n += v.length; if (budget.n > 1024) return false; for (const x of v) if (!sane(x, depth + 1, budget)) return false; return true; }
    const ks = Object.keys(v); budget.n += ks.length; if (budget.n > 1024) return false;
    for (const k of ks) { if (BAD_KEYS[k] === 1 || k === '__proto__') return false; if (!sane(v[k], depth + 1, budget)) return false; }
    return true;
  }
  function encodeFrame(type, seq, payload) { return String.fromCharCode(PROTO) + JSON.stringify([type, seq, payload === undefined ? null : payload]); }
  // -> { type, seq, payload } or { bad: reason }
  function decodeFrame(data) {
    if (typeof data !== 'string') return { bad: 'not-text' };
    if (data.length > LINK_CAP) return { bad: 'too-big' };
    if (data.length < 2) return { bad: 'short' };
    if (data.charCodeAt(0) !== PROTO) return { bad: 'version' };
    let a;
    try { a = JSON.parse(data.slice(1)); } catch (e) { return { bad: 'json' }; }
    if (!Array.isArray(a) || a.length !== 3) return { bad: 'shape' };
    const [type, seq, payload] = a;
    if (typeof type !== 'string' || !TYPE_RE.test(type)) return { bad: 'type' };
    if (!Number.isInteger(seq) || seq < 0 || seq > 0x7fffffff) return { bad: 'seq' };
    if (!sane(payload, 0, { n: 0 })) return { bad: 'deep' };
    return { type, seq, payload, size: data.length };
  }
  function bucket(rate, burst) { return { rate, burst, tokens: burst, t: now() }; }
  function take(b) {
    const t = now(); b.tokens = Math.min(b.burst, b.tokens + (t - b.t) * b.rate / 1000); b.t = t;
    if (b.tokens < 1) return false;
    b.tokens -= 1; return true;
  }
  function savedName() {
    try { const o = JSON.parse(localStorage.getItem('octave.net19.v1') || '{}'); return cleanName(o && o.name) || ''; } catch (e) { return ''; }
  }
  function defaultName() {
    const s = savedName(); if (s) return s;
    try { if (typeof G !== 'undefined' && G && G.player && typeof G.player.name === 'string') { const n = cleanName(G.player.name); if (n) return n; } } catch (e) { /* no game */ }
    return 'Traveller';
  }

  // ---------------------------------------------------------------- transports
  // A link is one live connection to the other player:
  //   { send(str, reliable) -> bool, close(), onmessage: fn(str, reliable), onclose: fn(), unreliable: bool, kind }
  // A transport makes links: host side listen(code, onLink) -> Promise<{ code }>, guest side connect(code) -> Promise<link>.

  // LOOP: two instances in one page. Delivery is asynchronous (a timer), like a real network, so code that works here
  // does not depend on same-tick delivery.
  const LOOP_HOSTS = new Map();
  function pairLinks(opts) {
    const o = opts || {}, loss = +o.loss || 0, latency = +o.latency || 0;
    let ls = 0x9e3779b9 >>> 0;
    const lossRng = () => { ls = (ls + 0x6d2b79f5) >>> 0; let t = ls; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const mk = () => ({ kind: 'loop', unreliable: loss > 0, open: true, onmessage: null, onclose: null });
    const a = mk(), b = mk();
    const deliver = (to, str, rel) => {
      if (!rel && loss > 0 && lossRng() < loss) return;   // test-only loss, own stream (never the game's Math.random)
      setTimeout(() => { if (to.open && to.onmessage) to.onmessage(str, rel); }, latency);
    };
    const closeBoth = () => {
      for (const l of [a, b]) if (l.open) { l.open = false; setTimeout(() => { if (l.onclose) l.onclose(); }, latency); }
    };
    a.send = (s, r) => { if (!a.open) return false; deliver(b, s, r !== false); return true; };
    b.send = (s, r) => { if (!b.open) return false; deliver(a, s, r !== false); return true; };
    a.close = b.close = closeBoth;
    return [a, b];
  }
  function loopTransport(opts) {
    let code = null;
    return {
      name: 'loop',
      listen(c, onLink) { code = c; LOOP_HOSTS.set(c, onLink); return Promise.resolve({ code: c }); },
      connect(c) {
        const onLink = LOOP_HOSTS.get(c);
        if (!onLink) return Promise.reject(err('no-host', 'No game with that code'));
        const [h, g] = pairLinks(opts);
        setTimeout(() => onLink(h), 0);
        return Promise.resolve(g);
      },
      close() { if (code && LOOP_HOSTS.get(code)) LOOP_HOSTS.delete(code); code = null; },
    };
  }

  // BC: two tabs of the same browser (same origin). A knock/accept exchange gives each guest connection its own id, so
  // a stale tab can't talk into a newer session. Messages are only strings; anything else on the channel is ignored.
  function bcTransport() {
    let ch = null, onLinkFn = null;
    const links = new Map();
    const rid = () => { const b = new Uint32Array(2); crypto.getRandomValues(b); return b[0].toString(36) + b[1].toString(36); };
    function mkLink(chan, me, them) {
      const l = { kind: 'bc', unreliable: false, open: true, onmessage: null, onclose: null };
      l.send = (s, r) => { if (!l.open) return false; try { chan.postMessage({ k: 'm', from: me, to: them, d: s, r: r !== false }); return true; } catch (e) { return false; } };
      l.close = () => { if (!l.open) return; l.open = false; try { chan.postMessage({ k: 'x', from: me, to: them }); } catch (e) { /* closed */ } setTimeout(() => { if (l.onclose) l.onclose(); }, 0); };
      l._remote = () => { if (!l.open) return; l.open = false; if (l.onclose) l.onclose(); };
      return l;
    }
    const okMsg = (m) => m && typeof m === 'object' && typeof m.k === 'string' && typeof m.from === 'string' && m.from.length < 40;
    return {
      name: 'bc',
      listen(c, onLink) {
        if (typeof BroadcastChannel !== 'function') return Promise.reject(err('transport', 'BroadcastChannel is not available'));
        onLinkFn = onLink; ch = new BroadcastChannel('octave.net19.' + c);
        const me = 'h' + rid();
        ch.onmessage = (ev) => {
          const m = ev.data; if (!okMsg(m)) return;
          if (m.k === 'knock') {
            const l = mkLink(ch, me, m.from); links.set(m.from, l);
            ch.postMessage({ k: 'accept', from: me, to: m.from });
            onLinkFn(l);
          } else if (m.to === me) {
            const l = links.get(m.from); if (!l) return;
            if (m.k === 'm' && typeof m.d === 'string') { if (l.open && l.onmessage) l.onmessage(m.d, m.r !== false); } else if (m.k === 'x') { links.delete(m.from); l._remote(); }
          }
        };
        return Promise.resolve({ code: c });
      },
      connect(c) {
        if (typeof BroadcastChannel !== 'function') return Promise.reject(err('transport', 'BroadcastChannel is not available'));
        const chan = new BroadcastChannel('octave.net19.' + c), me = 'g' + rid();
        return new Promise((resolve, reject) => {
          let link = null;
          const t = setTimeout(() => { if (!link) { chan.close(); reject(err('no-host', 'No game with that code')); } }, 1500);
          chan.onmessage = (ev) => {
            const m = ev.data; if (!okMsg(m) || m.to !== me) return;
            if (m.k === 'accept' && !link) { clearTimeout(t); link = mkLink(chan, me, m.from); link._host = m.from; const cl = link.close; link.close = () => { cl(); setTimeout(() => { try { chan.close(); } catch (e) { /* closed */ } }, 50); }; resolve(link); } else if (!link || m.from !== link._host) { /* not our host */ } else if (m.k === 'm' && typeof m.d === 'string') { if (link.open && link.onmessage) link.onmessage(m.d, m.r !== false); } else if (m.k === 'x') { link._remote(); try { chan.close(); } catch (e) { /* closed */ } }
          };
          chan.postMessage({ k: 'knock', from: me });
        });
      },
      close() { for (const l of links.values()) l.close(); links.clear(); if (ch) { const c2 = ch; setTimeout(() => { try { c2.close(); } catch (e) { /* closed */ } }, 50); } ch = null; },
    };
  }

  // PEER (PeerJS broker + WebRTC) and MANUAL (copy-paste offer/answer, no broker) are defined further down.
  let peerTransport = null, manualApi = null;   // filled in below
  function makeTransport(kind, opts, inst) {
    if (kind && typeof kind === 'object') return kind;                // injected (tests, or another team's stub)
    if (kind === 'loop') return loopTransport(opts);
    if (kind === 'bc') return bcTransport(opts);
    if (kind === 'peer' || !kind) return peerTransport(opts, inst);
    throw err('transport', 'Unknown transport ' + kind);
  }

  // ---------------------------------------------------------------- the session (one per instance)
  function create(createOpts) {
    const cfg = () => Object.assign({}, CONFIG, (createOpts && createOpts.config) || {});
    const handlers = new Map();                 // type -> Set(fn)
    const types = new Map();                    // type -> spec (+ bucket)
    const S = {
      role: null, state: 'idle', code: null, transport: null, tname: null,
      link: null, peer: null,                   // peer: { name, token, state }
      token: null,                              // guest: the token the host gave us (reconnect proof)
      myName: '', seqR: 0, seqU: 0, lastU: new Map(),
      heard: 0, pingN: 0, timers: [], inB: null, rejectsAt: [], joinWait: null, giveUpAt: 0, reconnecting: false,
      st: null,
    };
    function freshStats() {
      return { sent: 0, recv: 0, bytesOut: 0, bytesIn: 0, kbpsOut: 0, kbpsIn: 0, rtt: 0, rttAvg: 0, rejected: 0, reasons: {}, lost: 0, reconnects: 0, _wOut: 0, _wIn: 0, _wT: now() };
    }
    S.st = freshStats();

    function emit(type, payload, meta) {
      const set = handlers.get(type); if (!set) return;
      for (const fn of Array.from(set)) { try { fn(payload, meta || {}); } catch (e) { warnOnce('handler ' + type, e); } }
    }
    function setState(s) { if (S.state === s) return; S.state = s; emit('net:state', { state: s }); }

    function reject(why) {
      S.st.rejected++; S.st.reasons[why] = (S.st.reasons[why] || 0) + 1;
      const t = now(); S.rejectsAt.push(t);
      while (S.rejectsAt.length && t - S.rejectsAt[0] > 10000) S.rejectsAt.shift();
      if (S.rejectsAt.length > cfg().abuse && S.link) {
        S.rejectsAt = [];
        const l = S.link;
        if (S.role === 'host' && S.peer) S.peer.token = null;           // no coming back with that token
        dropLink(l, 'kicked');
      }
    }

    // ------------------------------------------------ sending
    function rawSend(link, type, payload, reliable) {
      if (!link || !link.open) return false;
      const seq = reliable ? (S.seqR = (S.seqR + 1) & 0x7fffffff) : (S.seqU = (S.seqU + 1) & 0x7fffffff);
      let f;
      try { f = encodeFrame(type, seq, payload); } catch (e) { warnOnce('encode ' + type, e); return false; }
      if (f.length > LINK_CAP) return false;
      const ok = link.send(f, reliable);
      if (ok) { S.st.sent++; S.st.bytesOut += f.length; S.st._wOut += f.length; }
      return ok;
    }
    function send(type, payload, opts) {
      if (typeof type !== 'string' || type.indexOf('net.') === 0) return false;
      autoDefine(type);
      const spec = types.get(type); if (!spec) return false;
      if (S.state !== 'open' || !S.link) return false;
      const reliable = !(opts && opts.reliable === false);
      let f;
      try { f = encodeFrame(type, 0, payload); } catch (e) { return false; }
      if (f.length + 10 > spec.max) return false;
      return rawSend(S.link, type, payload, reliable);
    }

    // ------------------------------------------------ receiving
    const SYS = {
      'net.hello': { max: 600, from: 'guest' }, 'net.welcome': { max: 600, from: 'host' }, 'net.full': { max: 200, from: 'host' },
      'net.ping': { max: 120, from: 'any' }, 'net.pong': { max: 120, from: 'any' }, 'net.bye': { max: 200, from: 'any' },
    };
    function onFrame(link, data, reliable) {
      if (link !== S.link && link !== S.pending) return;
      const fr = decodeFrame(data);
      if (fr.bad) return reject(fr.bad);
      if (!take(S.inB)) return reject('flood');
      const them = S.role === 'host' ? 'guest' : 'host';
      S.heard = now();
      S.st.recv++; S.st.bytesIn += fr.size; S.st._wIn += fr.size;
      if (fr.type.indexOf('net.') === 0) {
        const sp = SYS[fr.type]; if (!sp) return reject('unknown');
        if (fr.size > sp.max) return reject('size');
        if (sp.from !== 'any' && sp.from !== them) return reject('role');
        return system(link, fr);
      }
      if (link !== S.link || S.state === 'connecting') return reject('early');
      const spec = types.get(fr.type);
      if (!spec) return reject('unknown');
      if (fr.size > spec.max) return reject('size');
      if (spec.from !== 'any' && spec.from !== them) return reject('role');
      if (!take(spec.b)) return reject('rate');
      if (!reliable) {
        const last = S.lastU.get(fr.type);
        if (last != null && ((fr.seq - last) & 0x7fffffff) > 0x3fffffff) return reject('stale');   // older (wrap-safe)
        S.lastU.set(fr.type, fr.seq);
      }
      const meta = { from: them, seq: fr.seq, reliable: !!reliable, at: now() };
      let ok = false;
      try { ok = spec.validate ? spec.validate(fr.payload, meta) === true : true; } catch (e) { ok = false; }
      if (!ok) return reject('invalid');
      const set = handlers.get(fr.type); if (!set) return;
      for (const fn of Array.from(set)) { try { fn(fr.payload, meta); } catch (e) { warnOnce('handler ' + fr.type, e); } }
    }
    const isTok = (t) => typeof t === 'string' && /^[a-z0-9]{8,32}$/.test(t);
    function rtoken() { const b = new Uint32Array(3); crypto.getRandomValues(b); return Array.from(b, (x) => x.toString(36)).join('').slice(0, 20); }
    function system(link, fr) {
      const p = fr.payload;
      switch (fr.type) {
        case 'net.ping': if (p && typeof p.t === 'number' && Number.isFinite(p.t)) rawSend(link, 'net.pong', { t: p.t }, false); return;
        case 'net.pong': {
          if (!p || typeof p.t !== 'number' || !Number.isFinite(p.t)) return reject('invalid');
          const rtt = now() - p.t; if (rtt < 0 || rtt > 60000) return reject('invalid');
          S.st.rtt = Math.round(rtt); S.st.rttAvg = Math.round(S.st.rttAvg ? S.st.rttAvg * 0.8 + rtt * 0.2 : rtt);
          if (S.peer) S.peer.rtt = S.st.rtt;
          return;
        }
        case 'net.bye': if (link === S.link) dropLink(link, 'left', true); return;
        case 'net.hello': {         // host side
          if (S.role !== 'host' || link !== S.pending) return reject('early');
          if (!p || p.v !== PROTO) { rawSend(link, 'net.full', { why: 'version' }, true); return setTimeout(() => link.close(), 200); }
          const name = cleanName(p.name) || 'Traveller';
          // the same guest coming back (its token), even before the host has noticed that the old link died
          const back = !!S.peer && isTok(p.token) && p.token === S.peer.token;
          if (S.peer && !back) { rawSend(link, 'net.full', { why: 'full' }, true); S.pending = null; return setTimeout(() => link.close(), 200); }
          S.pending = null;
          const old = S.link;
          S.link = link; S.lastU.clear();
          if (old && old !== link) { try { old.close(); } catch (e) { /* gone */ } }
          if (back) { const was = S.peer.state; S.peer.state = 'open'; S.peer.name = name; S.st.reconnects++; if (was === 'open') S.st.lost++; }
          else S.peer = { name, token: rtoken(), state: 'open', rtt: 0 };
          rawSend(link, 'net.welcome', { v: PROTO, name: S.myName, token: S.peer.token }, true);
          S.heard = now(); setState('open');
          emit(back ? 'net:back' : 'net:peer', { id: 'guest', name });
          return;
        }
        case 'net.welcome': {       // guest side
          if (S.role !== 'guest' || link !== S.pending) return reject('early');
          if (!p || p.v !== PROTO || !isTok(p.token)) return reject('invalid');
          const back = !!S.peer;
          S.pending = null; S.link = link; S.token = p.token; S.lastU.clear();
          S.peer = { name: cleanName(p.name) || 'Host', state: 'open', rtt: 0 };
          if (back) S.st.reconnects++;
          S.heard = now(); S.reconnecting = false; setState('open');
          emit(back ? 'net:back' : 'net:peer', { id: 'host', name: S.peer.name });
          if (S.joinWait) { const w = S.joinWait; S.joinWait = null; w.resolve(); }
          return;
        }
        case 'net.full': {
          if (S.role !== 'guest') return reject('role');
          const why = p && p.why === 'version' ? 'version' : 'full';
          if (S.joinWait) { const w = S.joinWait; S.joinWait = null; w.reject(err(why, why === 'version' ? 'That game is a different version' : 'That game already has two players')); }
          finish(why === 'version' ? 'error' : 'full');
          return;
        }
      }
    }

    // ------------------------------------------------ links coming and going
    function adopt(link) {
      link.onmessage = (data, rel) => { try { onFrame(link, data, rel); } catch (e) { warnOnce('frame', e); } };
      link.onclose = () => { if (link === S.link) linkLost(link); else if (link === S.pending) S.pending = null; };
    }
    function hostOnLink(link) {
      if (S.role !== 'host' || S.state === 'closed') { try { link.close(); } catch (e) { /* gone */ } return; }
      adopt(link);
      // one handshake at a time; a newer knock replaces an unfinished one
      if (S.pending && S.pending !== link) { try { S.pending.close(); } catch (e) { /* gone */ } }
      S.pending = link;
      setTimeout(() => { if (S.pending === link) { S.pending = null; try { link.close(); } catch (e) { /* gone */ } } }, 8000);
    }
    function linkLost(link) {
      if (link !== S.link) return;
      if (S.state === 'closed' || S.state === 'idle') return;
      S.link = null;
      if (S.peer) S.peer.state = 'lost';
      S.st.lost++;
      setState('lost');
      emit('net:lost', { id: S.role === 'host' ? 'guest' : 'host' });
      S.giveUpAt = now() + cfg().giveUpMs;
      if (S.role === 'guest') tryReconnect();
    }
    function dropLink(link, reason, remote) {
      // a deliberate end of this link: bye (theirs) or kick (ours)
      if (link !== S.link) return;
      S.link = null;
      if (!remote) { try { rawSend(link, 'net.bye', { why: reason }, true); } catch (e) { /* gone */ } }
      setTimeout(() => { try { link.close(); } catch (e) { /* gone */ } }, 100);
      if (S.role === 'host') {
        S.peer = null; S.lastU.clear();
        emit('net:closed', { reason, id: 'guest' });
        setState('hosting');                    // the host carries on and can take a new guest
      } else finish(reason);
    }
    function tryReconnect() {
      if (S.role !== 'guest' || S.reconnecting || S.state !== 'lost') return;
      if (now() > S.giveUpAt) { finish('gave-up'); return; }
      S.reconnecting = true;
      // one attempt at a time, and every attempt ends: a transport whose connect() never settles is given up on after
      // reconnectTimeoutMs (a link that turns up later is closed), so the next tick can try again
      const attempt = S.attempt = (S.attempt || 0) + 1;
      const tmo = setTimeout(() => { if (S.attempt === attempt && S.reconnecting && !S.pending) { S.attempt++; S.reconnecting = false; S.st.reasons['reconnect-timeout'] = (S.st.reasons['reconnect-timeout'] || 0) + 1; } }, cfg().reconnectTimeoutMs);
      let p;
      try { p = Promise.resolve(S.transport.connect(S.code, { reconnect: true })); } catch (e) { p = Promise.reject(e); }
      p.then((link) => {
        clearTimeout(tmo);
        if (S.attempt !== attempt || S.state !== 'lost') { try { link.close(); } catch (e) { /* gone */ } if (S.attempt === attempt) S.reconnecting = false; return; }
        adopt(link); S.pending = link;
        rawSend(link, 'net.hello', { v: PROTO, name: S.myName, token: S.token }, true);
        setTimeout(() => { if (S.pending === link) { S.pending = null; try { link.close(); } catch (e) { /* gone */ } S.reconnecting = false; } }, 6000);
      }).catch(() => { clearTimeout(tmo); if (S.attempt === attempt) S.reconnecting = false; });
    }

    // ------------------------------------------------ heartbeat
    function tick() {
      const c = cfg(), t = now();
      if (S.state === 'open' && S.link) {
        rawSend(S.link, 'net.ping', { t: Math.round(t * 10) / 10 }, false);
        if (t - S.heard > c.lostMs) linkLost(S.link);
      } else if (S.state === 'lost') {
        if (t > S.giveUpAt) {
          if (S.role === 'guest') finish('gave-up');
          else { S.peer = null; emit('net:closed', { reason: 'gave-up', id: 'guest' }); setState('hosting'); }
        } else if (S.role === 'guest') tryReconnect();
      }
      const dt = (t - S.st._wT) / 1000;
      if (dt >= 1) { S.st.kbpsOut = Math.round(S.st._wOut / dt / 102.4) / 10; S.st.kbpsIn = Math.round(S.st._wIn / dt / 102.4) / 10; S.st._wOut = S.st._wIn = 0; S.st._wT = t; }
    }
    function startTimers() { stopTimers(); S.timers.push(setInterval(tick, cfg().heartbeatMs)); }
    function stopTimers() { for (const t of S.timers) clearInterval(t); S.timers = []; }

    // ------------------------------------------------ public lifecycle
    function reset(role, tname) {
      S.role = role; S.tname = tname; S.link = null; S.pending = null; S.peer = null; S.token = null;
      S.seqR = S.seqU = 0; S.lastU.clear(); S.rejectsAt = []; S.st = freshStats(); S.reconnecting = false;
      const c = cfg(); S.inB = bucket(c.inRate, c.inBurst);
      S.myName = defaultName();
    }
    function finish(reason) {
      const was = S.role;
      stopTimers();
      if (S.link) { try { S.link.close(); } catch (e) { /* gone */ } }
      if (S.pending) { try { S.pending.close(); } catch (e) { /* gone */ } }
      if (S.transport) { try { S.transport.close(); } catch (e) { /* gone */ } }
      if (S.joinWait) { const w = S.joinWait; S.joinWait = null; w.reject(err(reason === 'full' ? 'full' : 'transport', 'Connection closed')); }
      S.link = S.pending = null; S.transport = null; S.peer = null; S.role = null; S.code = null;
      if (was) { setState('closed'); emit('net:closed', { reason }); }
      S.state = 'idle';
    }
    function host(opts) {
      const o = opts || {};
      if (S.role) finish('local');
      reset('host', typeof o.transport === 'object' ? (o.transport.name || 'custom') : (o.transport || 'peer'));
      if (o.name) S.myName = cleanName(o.name) || S.myName;
      let tr;
      try { tr = makeTransport(o.transport, o, api); } catch (e) { S.role = null; return Promise.reject(e); }
      S.transport = tr;
      const want = normCode(o.code || '') || randomCode();
      setState('connecting');
      return Promise.resolve(tr.listen(want, hostOnLink)).then((r) => {
        if (S.transport !== tr) throw err('transport', 'Stopped');
        S.code = (r && r.code) || want;
        setState('hosting'); startTimers();
        return { code: S.code };
      }).catch((e) => { if (S.transport === tr) { S.role = null; S.transport = null; try { tr.close(); } catch (e2) { /* gone */ } setState('idle'); } throw e; });
    }
    function join(code, opts) {
      const o = opts || {};
      const c = normCode(code);
      if (!c) return Promise.reject(err('bad-code', 'That is not a join code'));
      if (S.role) finish('local');
      reset('guest', typeof o.transport === 'object' ? (o.transport.name || 'custom') : (o.transport || 'peer'));
      if (o.name) S.myName = cleanName(o.name) || S.myName;
      let tr;
      try { tr = makeTransport(o.transport, o, api); } catch (e) { S.role = null; return Promise.reject(e); }
      S.transport = tr; S.code = c;
      setState('connecting');
      return new Promise((resolve, reject) => {
        S.joinWait = { resolve, reject };
        const to = setTimeout(() => { if (S.joinWait) { S.joinWait = null; finish('error'); reject(err('timeout', 'The host did not answer')); } }, cfg().joinTimeoutMs);
        const done = (f) => (v) => { clearTimeout(to); f(v); };
        S.joinWait = { resolve: done(resolve), reject: done(reject) };
        Promise.resolve(tr.connect(c)).then((link) => {
          if (S.transport !== tr) { try { link.close(); } catch (e) { /* gone */ } return; }
          adopt(link); S.pending = link;
          startTimers();
          rawSend(link, 'net.hello', { v: PROTO, name: S.myName, token: null }, true);
        }).catch((e) => {
          if (S.joinWait) { const w = S.joinWait; S.joinWait = null; S.role = null; S.transport = null; try { tr.close(); } catch (e2) { /* gone */ } setState('idle'); w.reject(e && e.code ? e : err('transport', (e && e.message) || 'Could not connect')); }
        });
      });
    }
    // The manual path hands a finished link to the session directly (no join code, no reconnect).
    function adoptManual(role, link, tr) {
      if (S.role) finish('local');
      reset(role, 'manual');
      S.transport = tr; S.code = null;
      adopt(link);
      startTimers();
      if (role === 'host') { setState('hosting'); S.pending = link; } else {
        setState('connecting'); S.pending = link;
        return new Promise((resolve, reject) => {
          S.joinWait = { resolve, reject };
          rawSend(link, 'net.hello', { v: PROTO, name: S.myName, token: null }, true);
        });
      }
      return Promise.resolve();
    }
    function leave(reason) {
      if (!S.role) return;
      if (S.link) { try { rawSend(S.link, 'net.bye', { why: 'left' }, true); } catch (e) { /* gone */ } }
      const l = S.link; S.link = null;
      setTimeout(() => { try { if (l) l.close(); } catch (e) { /* gone */ } }, 120);
      finish(reason || 'local');
    }

    // a type used without define(): the default spec (see the contract). Reserved and malformed names are never defined.
    function autoDefine(type) {
      if (types.has(type) || typeof type !== 'string' || !TYPE_RE.test(type) || type.indexOf('net.') === 0 || type.indexOf('net:') === 0) return;
      api.define(type, DEFAULT_SPEC); types.get(type).auto = true;
    }
    const api = {
      PROTO,
      host, join, leave,
      role: () => S.role,
      connected: () => S.state === 'open' && !!S.link,
      code: () => S.code,
      peers: () => (S.peer ? [{ id: S.role === 'host' ? 'guest' : 'host', name: S.peer.name, state: S.peer.state, rtt: S.st.rtt }] : []),
      stats: () => ({
        role: S.role, state: S.state, transport: S.tname, code: S.code, rtt: S.st.rtt, rttAvg: S.st.rttAvg,
        sent: S.st.sent, recv: S.st.recv, bytesOut: S.st.bytesOut, bytesIn: S.st.bytesIn, kbpsOut: S.st.kbpsOut, kbpsIn: S.st.kbpsIn,
        rejected: S.st.rejected, reasons: Object.assign({}, S.st.reasons), lost: S.st.lost, reconnects: S.st.reconnects,
        unreliable: !!(S.link && S.link.unreliable), name: S.myName,
      }),
      define(type, spec) {
        if (typeof type !== 'string' || !TYPE_RE.test(type) || type.indexOf('net.') === 0) throw err('type', 'Bad message type ' + type);
        const s = spec || {};
        const rate = Math.max(0.1, Math.min(240, +s.rate || 10));
        const d = {
          max: Math.max(32, Math.min(TYPE_CAP, Math.floor(+s.max || 2048))),
          rate, burst: Math.max(1, Math.min(480, Math.floor(+s.burst || rate * 2))),
          from: s.from === 'host' || s.from === 'guest' ? s.from : 'any',
          validate: typeof s.validate === 'function' ? s.validate : null,
        };
        d.b = bucket(d.rate, d.burst);
        types.set(type, d);
      },
      defined: (type) => types.has(type),
      on(type, fn) {
        if (typeof fn !== 'function') return () => {};
        autoDefine(type);
        if (!handlers.has(type)) handlers.set(type, new Set());
        handlers.get(type).add(fn);
        return () => api.off(type, fn);
      },
      off(type, fn) { const s = handlers.get(type); if (s) s.delete(fn); },
      send,
      setName(n) { const c = cleanName(n); if (c) S.myName = c; return S.myName; },
      _adoptManual: adoptManual,
      _state: S,
    };
    api.manual = manualFor(api);
    return api;
  }

  // ---------------------------------------------------------------- PeerJS transport (the broker finds the host; WebRTC does the rest)
  // PeerJS is loaded on demand, only when a player presses Host or Join, so single-player pages never run it. It would
  // call Math.random for its tokens and connection ids; we hand it our own (crypto) ids and tokens, and every synchronous
  // call into it runs with Math.random briefly swapped for a crypto source, so the game's RNG order is not disturbed.
  const PEERJS_SRC = 'js/vendor/peerjs.min.js';
  const STATE_LIFE_MS = 200;                     // how long a lossy state frame may be retried before it is dropped
  const cryptoRandom = () => { const b = new Uint32Array(1); crypto.getRandomValues(b); return b[0] / 4294967296; };
  function shielded(fn) { const r = Math.random; Math.random = cryptoRandom; try { return fn(); } finally { Math.random = r; } }
  function rtok() { const b = new Uint32Array(3); crypto.getRandomValues(b); return Array.from(b, (x) => x.toString(36)).join('').slice(0, 18); }
  let peerLibP = null;
  function loadPeerJS() {
    if (typeof window !== 'undefined' && typeof window.Peer === 'function') return Promise.resolve(window.Peer);
    if (peerLibP) return peerLibP;
    peerLibP = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = PEERJS_SRC; s.async = true;
      s.onload = () => (typeof window.Peer === 'function' ? resolve(window.Peer) : reject(err('transport', 'PeerJS did not start')));
      s.onerror = () => { peerLibP = null; s.remove(); reject(err('transport', 'PeerJS could not be loaded')); };
      document.head.appendChild(s);
    });
    return peerLibP;
  }
  function peerOptions() {
    const b = CONFIG.broker;
    return { host: b.host, port: b.port, path: b.path, secure: !!b.secure, key: b.key, debug: 0, token: rtok(), config: { iceServers: CONFIG.iceServers } };
  }
  // PeerJS opens {reliable:false} channels unordered but still retransmitting for ever. For the state channel we want
  // stale frames dropped, so the one createDataChannel call PeerJS makes inside connect() gets a packet lifetime: SCTP may
  // resend within STATE_LIFE_MS (one quick retry on a phone's lossy radio), then gives up; the newest frame wins anyway.
  function lossyChannel(fn) {
    const P = window.RTCPeerConnection && window.RTCPeerConnection.prototype;
    if (!P) return fn();
    const orig = P.createDataChannel;
    P.createDataChannel = function (label, o) { return orig.call(this, label, Object.assign({}, o || {}, { ordered: false, maxPacketLifeTime: STATE_LIFE_MS })); };
    try { return fn(); } finally { P.createDataChannel = orig; }
  }
  // one link over a PeerJS pair: 'ev' (reliable, ordered) and 'st' (lossy, unordered; optional)
  function peerLink(ev) {
    const link = { kind: 'peer', unreliable: false, open: true, onmessage: null, onclose: null, st: null };
    const okBuf = (c, rel) => { const dc = c.dataChannel; return !dc || dc.bufferedAmount < (rel ? 4000000 : 262144); };
    link.send = (s, rel) => {
      const c = (!rel && link.st && link.st.open) ? link.st : ev;
      if (!link.open || !c.open || !okBuf(c, rel !== false)) return false;
      try { c.send(s); return true; } catch (e) { return false; }
    };
    const onData = (rel) => (d) => { if (link.open && typeof d === 'string' && link.onmessage) link.onmessage(d, rel); };
    ev.on('data', onData(true));
    link.attachSt = (st) => {
      if (link.st === st) return;
      link.st = st; link.unreliable = true; st.on('data', onData(false));
      st.on('close', () => { if (link.st === st) { link.st = null; link.unreliable = false; } });
    };
    const end = () => {
      if (!link.open) return;
      link.open = false;
      try { ev.close(); } catch (e) { /* gone */ }
      try { if (link.st) link.st.close(); } catch (e) { /* gone */ }
      if (link.onclose) link.onclose();
    };
    ev.on('close', end); ev.on('error', end);
    // a dead ICE path does not always close the channel promptly; the heartbeat notices that (lostMs)
    link.close = end;
    return link;
  }
  peerTransport = function () {
    let peer = null, closed = false;
    const conns = new Map();                     // guest peer id -> { ev, st, link }
    function makePeer(id) {
      return loadPeerJS().then((Peer) => new Promise((resolve, reject) => {
        if (closed) return reject(err('transport', 'Stopped'));
        let p;
        try { p = shielded(() => new Peer(id, peerOptions())); } catch (e) { return reject(err('transport', String(e && e.message))); }
        let opened = false;
        p.on('open', () => { opened = true; resolve(p); });
        p.on('error', (e) => {
          if (opened) return;                  // after open, errors are handled by whoever is waiting (connect)
          const t = e && e.type;
          try { p.destroy(); } catch (x) { /* gone */ }
          reject(err(t === 'unavailable-id' ? 'taken' : (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') ? 'broker' : 'transport', String((e && e.message) || t)));
        });
        // the broker connection drops now and then; P2P links stay up, but a host must stay findable for reconnects
        p.on('disconnected', () => {
          setTimeout(() => { if (!closed && !p.destroyed && p.disconnected) { try { shielded(() => p.reconnect()); } catch (x) { /* retry next drop */ } } }, CONFIG.reconnectMs);
        });
      }));
    }
    function accept(conn, onLink) {
      const rid = conn.peer;
      if (typeof rid !== 'string' || !/^octave19-g[a-z0-9]{6,24}$/.test(rid) || (!conns.has(rid) && conns.size >= 6) || (conn.label !== 'ev' && conn.label !== 'st')) {
        setTimeout(() => { try { conn.close(); } catch (e) { /* gone */ } }, 0);
        return;
      }
      let c = conns.get(rid);
      if (!c) {
        c = {}; conns.set(rid, c);
        setTimeout(() => { if (conns.get(rid) === c && !c.link) { conns.delete(rid); try { if (c.st) c.st.close(); } catch (e) { /* gone */ } } }, 15000);
      }
      if (conn.label === 'ev') {
        conn.on('open', () => {
          if (closed) { try { conn.close(); } catch (e) { /* gone */ } return; }
          c.ev = conn; c.link = peerLink(conn);
          const l = c.link, oc = l.onclose;
          if (c.st && c.st.open) l.attachSt(c.st);
          conn.on('close', () => { if (conns.get(rid) === c) conns.delete(rid); });
          void oc;
          onLink(l);
        });
      } else {
        conn.on('open', () => { c.st = conn; if (c.link) c.link.attachSt(conn); });
      }
    }
    function reopen(p) {
      if (!p.disconnected) return Promise.resolve(p);
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(err('broker', 'The matchmaker cannot be reached')), 8000);
        p.once('open', () => { clearTimeout(t); resolve(p); });
        try { shielded(() => p.reconnect()); } catch (e) { clearTimeout(t); reject(err('broker', 'The matchmaker cannot be reached')); }
      });
    }
    return {
      name: 'peer',
      listen(code, onLink) {
        const attempt = (c, n) => makePeer(ID_PREFIX + c.toLowerCase()).then((p) => {
          peer = p; p.on('connection', (conn) => accept(conn, onLink));
          return { code: c };
        }).catch((e) => { if (e.code === 'taken' && n < 4) return attempt(randomCode(), n + 1); throw e; });
        return attempt(code, 0);
      },
      connect(code) {
        const hid = ID_PREFIX + code.toLowerCase();
        const ready = (peer && !peer.destroyed) ? reopen(peer) : makePeer(ID_PREFIX + 'g' + rtok()).then((p) => (peer = p));
        return ready.then((p) => new Promise((resolve, reject) => {
          let done = false, ev = null, st = null;
          const fail = (e) => {
            if (done) return; done = true; clearTimeout(t); p.off('error', onErr);
            try { if (ev) ev.close(); } catch (x) { /* gone */ } try { if (st) st.close(); } catch (x) { /* gone */ }
            reject(e);
          };
          const onErr = (e) => { const ty = e && e.type; if (ty === 'peer-unavailable') fail(err('no-host', 'No game with that code')); else if (ty === 'network' || ty === 'server-error' || ty === 'socket-error') fail(err('broker', 'The matchmaker cannot be reached')); };
          p.on('error', onErr);
          const t = setTimeout(() => fail(err('timeout', 'The host did not answer')), Math.max(4000, CONFIG.joinTimeoutMs - 2000));
          try {
            ev = shielded(() => p.connect(hid, { label: 'ev', reliable: true, serialization: 'raw', connectionId: 'dc_' + rtok() }));
            st = lossyChannel(() => shielded(() => p.connect(hid, { label: 'st', reliable: false, serialization: 'raw', connectionId: 'dc_' + rtok() })));
          } catch (e) { fail(err('transport', String(e && e.message))); return; }
          ev.on('error', () => fail(err('transport', 'Could not connect')));
          ev.on('open', () => {
            if (done) return; done = true; clearTimeout(t); p.off('error', onErr);
            const l = peerLink(ev);
            if (st.open) l.attachSt(st); else st.on('open', () => { if (l.open) l.attachSt(st); });
            resolve(l);
          });
        }));
      },
      close() {
        closed = true;
        for (const c of conns.values()) { try { if (c.link) c.link.close(); else if (c.st) c.st.close(); } catch (e) { /* gone */ } }
        conns.clear();
        if (peer) { const p = peer; peer = null; try { p.destroy(); } catch (e) { /* gone */ } }
      },
    };
  };

  // ---------------------------------------------------------------- MANUAL: copy-paste offer/answer, no broker at all
  // The host makes an invitation (a WebRTC offer with its network candidates), the guest pastes it and makes an answer,
  // the host pastes that back. STUN (if reachable) adds public candidates; on one network it works with none. A code is
  // "OCT1." + base64url(deflate-raw(JSON {t:'o'|'a', s: sdp})) ("OCT1J." without compression where the browser lacks
  // CompressionStream). Incoming codes are capped (16 KB text, 32 KB inflated, 16 KB SDP), parsed with fixed rules, and
  // the SDP must be printable ASCII starting "v=0" with a data-channel section; the browser's own parser does the rest.
  const MAN = { CODE_MAX: 16384, INFLATE_MAX: 32768, SDP_MAX: 16384 };
  const b64u = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  function unb64u(s) {
    if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
    let t = s.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '=';
    try { const bin = atob(t), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; } catch (e) { return null; }
  }
  const canZip = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
  async function zip(bytes) {
    const cs = new CompressionStream('deflate-raw'); const w = cs.writable.getWriter(); w.write(bytes); w.close();
    return new Uint8Array(await new Response(cs.readable).arrayBuffer());
  }
  async function unzip(bytes, cap) {
    const ds = new DecompressionStream('deflate-raw'); const w = ds.writable.getWriter();
    w.write(bytes).catch(() => {}); w.close().catch(() => {});
    const r = ds.readable.getReader(), parts = []; let n = 0;
    for (;;) {
      const { done, value } = await r.read();
      if (done) break;
      n += value.length; if (n > cap) { try { r.cancel(); } catch (e) { /* done */ } return null; }
      parts.push(value);
    }
    const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  async function packCode(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    return canZip() ? 'OCT1.' + b64u(await zip(bytes)) : 'OCT1J.' + b64u(bytes);
  }
  async function unpackCode(code, want) {
    const bad = () => err('bad-code', want === 'o' ? 'That is not an invitation code' : 'That is not an answer code');
    if (typeof code !== 'string') throw bad();
    const c = code.replace(/\s+/g, '');
    if (c.length > MAN.CODE_MAX || c.length < 12) throw bad();
    const m = /^OCT1(J?)\.([A-Za-z0-9_-]+)$/.exec(c); if (!m) throw bad();
    let bytes = unb64u(m[2]); if (!bytes) throw bad();
    if (!m[1]) { if (!canZip()) throw bad(); try { bytes = await unzip(bytes, MAN.INFLATE_MAX); } catch (e) { bytes = null; } if (!bytes) throw bad(); } else if (bytes.length > MAN.INFLATE_MAX) throw bad();
    let o; try { o = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch (e) { throw bad(); }
    if (!o || typeof o !== 'object' || Array.isArray(o) || o.t !== want || typeof o.s !== 'string' || Object.keys(o).length !== 2) throw bad();
    if (o.s.length > MAN.SDP_MAX || !/^v=0\r\n[\x20-\x7e\r\n]+$/.test(o.s) || o.s.indexOf('m=application') < 0) throw bad();
    return o;
  }
  function gather(pc, ms) {
    return new Promise((res) => {
      if (pc.iceGatheringState === 'complete') return res();
      const t = setTimeout(res, ms);
      pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
    });
  }
  function chanLink(pc, ev, st) {
    const link = { kind: 'manual', unreliable: !!st, open: true, onmessage: null, onclose: null };
    link.send = (s, rel) => {
      const c = (rel === false && st && st.readyState === 'open') ? st : ev;
      if (!link.open || c.readyState !== 'open' || c.bufferedAmount > (c === ev ? 4000000 : 262144)) return false;
      try { c.send(s); return true; } catch (e) { return false; }
    };
    ev.onmessage = (e) => { if (link.open && typeof e.data === 'string' && link.onmessage) link.onmessage(e.data, true); };
    if (st) st.onmessage = (e) => { if (link.open && typeof e.data === 'string' && link.onmessage) link.onmessage(e.data, false); };
    const end = () => { if (!link.open) return; link.open = false; try { pc.close(); } catch (e) { /* gone */ } if (link.onclose) link.onclose(); };
    ev.onclose = end;
    pc.addEventListener('connectionstatechange', () => { if (pc.connectionState === 'failed' || pc.connectionState === 'closed') end(); });
    link.close = end;
    return link;
  }
  function manualFor(inst) {
    let pc = null;
    const tr = () => ({ name: 'manual', connect: () => Promise.reject(err('transport', 'Codes by hand cannot reconnect: make new codes')), close() { if (pc) { try { pc.close(); } catch (e) { /* gone */ } } } });
    const M = {
      busy: () => !!pc,
      cancel() { if (pc) { try { pc.close(); } catch (e) { /* gone */ } } pc = null; },
      async hostOffer() {
        if (typeof RTCPeerConnection !== 'function') throw err('transport', 'This browser cannot connect directly');
        M.cancel(); if (inst.role()) inst.leave('local');
        const p = pc = new RTCPeerConnection({ iceServers: CONFIG.iceServers });
        const ev = p.createDataChannel('ev', { ordered: true });
        const st = p.createDataChannel('st', { ordered: false, maxPacketLifeTime: STATE_LIFE_MS });
        ev.onopen = () => { if (pc === p) { const t = tr(); pc = null; inst._adoptManual('host', chanLink(p, ev, st), Object.assign(t, { close() { try { p.close(); } catch (e) { /* gone */ } } })); } };
        await p.setLocalDescription(await p.createOffer());
        await gather(p, 6000);
        if (pc !== p) throw err('transport', 'Cancelled');
        return packCode({ t: 'o', s: p.localDescription.sdp });
      },
      async hostAccept(code) {
        const o = await unpackCode(code, 'a');
        if (!pc) throw err('bad-code', 'Make an invitation first');
        const p = pc;
        await p.setRemoteDescription({ type: 'answer', sdp: o.s });
        return new Promise((resolve, reject) => {
          const t = setTimeout(() => { off(); reject(err('timeout', 'No connection: try again, or make new codes')); }, 20000);
          const off = inst.on('net:peer', () => { clearTimeout(t); off(); resolve(); });
        });
      },
      async guestAnswer(code) {
        const o = await unpackCode(code, 'o');
        if (typeof RTCPeerConnection !== 'function') throw err('transport', 'This browser cannot connect directly');
        M.cancel(); if (inst.role()) inst.leave('local');
        const p = pc = new RTCPeerConnection({ iceServers: CONFIG.iceServers });
        let ev = null, st = null;
        p.ondatachannel = (e) => {
          const ch = e.channel;
          if (ch.label === 'st' && !st) st = ch;
          else if (ch.label === 'ev' && !ev) {
            ev = ch;
            ch.onopen = () => {
              if (pc !== p) return;
              pc = null;
              const t = tr(); t.close = () => { try { p.close(); } catch (x) { /* gone */ } };
              inst._adoptManual('guest', chanLink(p, ev, st), t).catch(() => {});
            };
          } else { try { ch.close(); } catch (x) { /* unexpected */ } }
        };
        await p.setRemoteDescription({ type: 'offer', sdp: o.s });
        await p.setLocalDescription(await p.createAnswer());
        await gather(p, 6000);
        return packCode({ t: 'a', s: p.localDescription.sdp });
      },
    };
    return M;
  }

  // ---------------------------------------------------------------- QR code (procedural: byte mode, ECC M or L, versions 1-10)
  // Written for this game from the QR specification (ISO/IEC 18004): data codewords, Reed-Solomon blocks, function
  // patterns, zigzag placement, the eight masks scored by the standard penalty rules. No library. A join link is about
  // 60-110 bytes: version 4-7 at level M. Checked in test/net19.test.js against fixed matrices and by decoding.
  const QR = (function () {
    const ECC = { L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18], M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26] };
    const BLK = { L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4], M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5] };
    const FMT = { L: 1, M: 0 };
    function rawModules(v) { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; }
    const dataCw = (v, e) => Math.floor(rawModules(v) / 8) - ECC[e][v] * BLK[e][v];
    function gmul(x, y) { let z = 0; for (let i = 7; i >= 0; i--) { z = ((z << 1) ^ ((z >>> 7) * 0x11d)) & 0xff; z ^= ((y >>> i) & 1) * x; } return z; }
    function divisor(deg) {
      const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1;
      for (let i = 0; i < deg; i++) { for (let j = 0; j < deg; j++) { r[j] = gmul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; } root = gmul(root, 2); }
      return r;
    }
    function remainder(data, div) {
      const r = new Array(div.length).fill(0);
      for (const b of data) { const f = b ^ r.shift(); r.push(0); for (let i = 0; i < div.length; i++) r[i] ^= gmul(div[i], f); }
      return r;
    }
    const MASKS = [
      (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
      (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0,
    ];
    function penalty(M, n) {
      let p = 0, dark = 0;
      const line = (get) => {
        let run = 1;
        for (let i = 1; i <= n; i++) {
          if (i < n && get(i) === get(i - 1)) run++;
          else { if (run >= 5) p += 3 + run - 5; run = 1; }
        }
        // finder-like 1:1:3:1:1 with four light modules on one side (outside the symbol counts as light)
        for (let i = -4; i < n; i++) {
          const at = (k) => (k < 0 || k >= n ? false : get(k));
          if (at(i + 4) && !at(i + 5) && at(i + 6) && at(i + 7) && at(i + 8) && !at(i + 9) && at(i + 10)) {
            if ((!at(i) && !at(i + 1) && !at(i + 2) && !at(i + 3)) || (!at(i + 11) && !at(i + 12) && !at(i + 13) && !at(i + 14))) p += 40;
          }
        }
      };
      for (let y = 0; y < n; y++) line((x) => M[y][x]);
      for (let x = 0; x < n; x++) line((y) => M[y][x]);
      for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) { const c = M[y][x]; if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) p += 3; }
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (M[y][x]) dark++;
      const total = n * n;
      p += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
      return p;
    }
    function encode(text, ecl, forceMask) {
      const e = ecl === 'L' ? 'L' : 'M';
      const bytes = Array.from(new TextEncoder().encode(String(text)));
      let v = 0;
      for (let t = 1; t <= 10; t++) if (4 + (t <= 9 ? 8 : 16) + bytes.length * 8 <= dataCw(t, e) * 8) { v = t; break; }
      if (!v) return null;
      const bits = [], put = (val, k) => { for (let i = k - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
      put(4, 4); put(bytes.length, v <= 9 ? 8 : 16); for (const b of bytes) put(b, 8);
      const cap = dataCw(v, e) * 8;
      put(0, Math.min(4, cap - bits.length)); put(0, (8 - bits.length % 8) % 8);
      for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
      const data = [];
      for (let i = 0; i < bits.length; i += 8) { let x = 0; for (let j = 0; j < 8; j++) x = (x << 1) | bits[i + j]; data.push(x); }
      const nb = BLK[e][v], el = ECC[e][v], raw = Math.floor(rawModules(v) / 8), nShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
      const div = divisor(el), blocks = [];
      for (let i = 0, k = 0; i < nb; i++) {
        const d = data.slice(k, k + shortLen - el + (i < nShort ? 0 : 1)); k += d.length;
        const ec = remainder(d, div); if (i < nShort) d.push(0); blocks.push(d.concat(ec));
      }
      const all = [];
      for (let i = 0; i < blocks[0].length; i++) for (let j = 0; j < nb; j++) if (i !== shortLen - el || j >= nShort) all.push(blocks[j][i]);
      const size = v * 4 + 17, M = [], F = [];
      for (let y = 0; y < size; y++) { M.push(new Array(size).fill(false)); F.push(new Array(size).fill(false)); }
      const setF = (x, y, d) => { M[y][x] = d; F[y][x] = true; };
      for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
      const finder = (cx, cy) => {
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
          if (x >= 0 && x < size && y >= 0 && y < size) setF(x, y, d !== 2 && d !== 4);
        }
      };
      finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
      if (v >= 2) {
        const n = Math.floor(v / 7) + 2, step = Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2, pos = [6];
        for (let q = size - 7; pos.length < n; q -= step) pos.splice(1, 0, q);
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
      const fmt = (mask) => {
        const d = (FMT[e] << 3) | mask; let r = d;
        for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
        const b = ((d << 10) | r) ^ 0x5412, bit = (i) => ((b >>> i) & 1) === 1;
        for (let i = 0; i <= 5; i++) setF(8, i, bit(i));
        setF(8, 7, bit(6)); setF(8, 8, bit(7)); setF(7, 8, bit(8));
        for (let i = 9; i < 15; i++) setF(14 - i, 8, bit(i));
        for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, bit(i));
        for (let i = 8; i < 15; i++) setF(8, size - 15 + i, bit(i));
        setF(8, size - 8, true);
      };
      fmt(0);
      if (v >= 7) {
        let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
        const b = (v << 12) | r;
        for (let i = 0; i < 18; i++) { const bt = ((b >>> i) & 1) === 1, a = size - 11 + i % 3, c = Math.floor(i / 3); setF(a, c, bt); setF(c, a, bt); }
      }
      let k = 0;
      for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
          const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
          if (!F[y][x] && k < all.length * 8) { M[y][x] = ((all[k >>> 3] >>> (7 - (k & 7))) & 1) === 1; k++; }
        }
      }
      const apply = (m) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && MASKS[m](x, y)) M[y][x] = !M[y][x]; };
      let best = 0;
      if (forceMask >= 0 && forceMask < 8) best = forceMask;
      else {
        let bestP = Infinity;
        for (let m = 0; m < 8; m++) { apply(m); fmt(m); const p = penalty(M, size); if (p < bestP) { bestP = p; best = m; } apply(m); }
      }
      apply(best); fmt(best);
      return { size, version: v, ecl: e, mask: best, modules: M };
    }
    // draw onto a canvas: dark modules on parchment, a four-module quiet zone, whole pixels per module
    function draw(canvas, qr, px) {
      const q = 4, n = qr.size + q * 2, s = Math.max(1, px | 0);
      canvas.width = canvas.height = n * s;
      const g = canvas.getContext('2d');
      g.fillStyle = '#f2e8d0'; g.fillRect(0, 0, n * s, n * s);
      g.fillStyle = '#16110c';
      for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) if (qr.modules[y][x]) g.fillRect((x + q) * s, (y + q) * s, s, s);
      return canvas;
    }
    return { encode, draw };
  })();

  // ---------------------------------------------------------------- the lobby (title screen "Play together", Options row)
  // Every string shown is a constant from TX, a number, or a cleaned name put in with textContent. The panel is built from
  // DOM nodes; nothing from the network or storage is ever parsed as markup.
  const TX = {
    btn: 'Play together',
    title: 'Play together',
    intro: 'Two travellers, one world. The host’s game is the world, and the host makes the story’s choices; the guest brings their own traveller and can join from a phone.',
    nameL: 'Your name',
    hostH: 'Host a game',
    hostP: 'Your companion joins your world. Best on a computer.',
    hostB: 'Host',
    joinH: 'Join a game',
    joinP: 'Type the code the host gives you, or scan their QR code with your phone’s camera.',
    joinB: 'Join',
    manualB: 'No matchmaker? Use codes by hand',
    yourCode: 'Your join code',
    qrAlt: 'QR code: scan it with a phone camera to open the game and join this session',
    hostHelp: 'Your companion scans this with their phone’s camera, or opens the game, chooses Play together and types the code. Then start or load your game: they join you there.',
    copyLink: 'Copy the link', copied: 'Copied', copyCode: 'Copy',
    stop: 'Stop hosting', leave: 'Leave', close: 'Close', back: 'Back', cont: 'Continue',
    opening: 'Opening the way…', waiting: 'Waiting for your companion…', finding: 'Finding the host…',
    joined: '{name} has joined.', connectedTo: 'Connected to {name}.', ping: 'Ping {ms} ms',
    guestWait: 'The host’s world opens here when their game is running.',
    lostHost: 'The connection to your companion is lost. Carry on: they can come back with the same code.',
    lostGuest: 'The connection is lost. Trying again…',
    back2: 'The connection is back.',
    left: 'Your companion has left.',
    ended: 'The session has ended.',
    eNoHost: 'No game with that code. Check it with the host.',
    eFull: 'That game already has two travellers.',
    eVersion: 'That game is a different version. Both of you reload the page.',
    eTimeout: 'The host did not answer. Check the code, or try codes by hand.',
    eBroker: 'The matchmaker cannot be reached. Try again, or use codes by hand.',
    eTransport: 'Could not connect. Try again, or use codes by hand.',
    eBadCode: 'That is not a join code: six letters and numbers, like KRT-4MW.',
    eDesktop: 'The desktop app does not go online. Use codes by hand, or play together in the browser version.',
    manH: 'Codes by hand',
    manP: 'No matchmaker needed: you swap two codes through any message app. It works at home or on mobile data.',
    manHostH: 'I am hosting',
    manMake: 'Make an invitation',
    manInvite: 'Send this invitation to your companion:',
    manAnswerL: 'Paste their answer here:',
    manConnect: 'Connect',
    manJoinH: 'I am joining',
    manPasteL: 'Paste the host’s invitation here:',
    manAnswer: 'Make my answer',
    manSendBack: 'Send this answer back to the host:',
    manWorking: 'Working…',
    manBad: 'That code is not right: copy all of it.',
    chipOn: 'Together · {name} · {ms} ms',
    chipLost: 'Connection lost',
    chipWait: 'Hosting · {code}',
    optLabel: 'Play together',
    optHint: 'host a two-player game or join one; the guest can be on a phone.',
    optOpen: 'Open',
    optOn: 'Connected',
  };
  const TEXTS = Object.values(TX);
  const fill = (s, o) => s.replace(/\{(\w+)\}/g, (m, k) => (o && o[k] != null ? String(o[k]) : m));
  const ERRTX = { 'no-host': 'eNoHost', full: 'eFull', version: 'eVersion', timeout: 'eTimeout', broker: 'eBroker', transport: 'eTransport', 'bad-code': 'eBadCode', taken: 'eBroker' };
  const errText = (e) => TX[ERRTX[e && e.code] || 'eTransport'];
  const isDesktop = () => typeof location !== 'undefined' && location.protocol === 'app:';

  function el(tag, attrs, text) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) { if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (text != null) e.textContent = text;
    return e;
  }
  function btn(id, text, onclick, cls) { const b = el('button', { class: 'dfbtn' + (cls ? ' ' + cls : ''), id, type: 'button' }, text); b.onclick = onclick; return b; }
  function saveName(n) { try { const o = JSON.parse(localStorage.getItem('octave.net19.v1') || '{}') || {}; o.name = cleanName(n); localStorage.setItem('octave.net19.v1', JSON.stringify(o)); } catch (e) { /* storage blocked */ } }
  function joinLink(code) {
    try { return location.origin + location.pathname + '#join=' + showCode(code); } catch (e) { return '#join=' + showCode(code); }
  }
  async function copyText(t, ta) {
    try { await navigator.clipboard.writeText(t); return true; } catch (e) { /* fall back */ }
    try { if (ta) { ta.focus(); ta.select(); return document.execCommand('copy'); } } catch (e) { /* no copy */ }
    return false;
  }

  const ui = { view: 'menu', status: '', statusCls: '', prefill: '', busy: false, offer: '', answer: '', offerIn: '', manRole: null };
  const panelOpen = () => typeof G !== 'undefined' && G && G.openPanel === 'net19';
  function openPanel(view) {
    if (view) ui.view = view;
    else ui.view = main.role() === 'host' ? 'host' : main.role() === 'guest' ? 'guest' : 'menu';
    try { Audio_.init(); Audio_.resume(); } catch (e) { /* no audio yet */ }
    openModal('', 'net19');
    render();
  }
  function setStatus(text, cls) { ui.status = text || ''; ui.statusCls = cls || ''; const s = document.getElementById('n19-status'); if (s) { s.textContent = ui.status; s.className = 'n19-status' + (ui.statusCls ? ' ' + ui.statusCls : ''); } }
  function render() {
    if (!panelOpen()) return;
    const P = document.getElementById('modal-panel'); if (!P) return;
    P.textContent = '';
    const root = el('div', { class: 'n19', id: 'n19-panel', 'data-i18n-scope': 'net19' });
    root.appendChild(el('h2', null, TX.title));
    const V = ui.view;
    if (V === 'menu') viewMenu(root);
    else if (V === 'host') viewHost(root);
    else if (V === 'guest') viewGuest(root);
    else if (V === 'manual') viewManual(root);
    root.appendChild(el('p', { class: 'n19-status' + (ui.statusCls ? ' ' + ui.statusCls : ''), id: 'n19-status', role: 'status', 'aria-live': 'polite', 'data-i18n': 'off' }, ui.status));
    const foot = el('div', { class: 'n19-row n19-foot' });
    if (V === 'manual' || (V === 'menu' && false)) foot.appendChild(btn('n19-back', TX.back, () => { main.manual.cancel(); ui.view = main.role() ? (main.role() === 'host' ? 'host' : 'guest') : 'menu'; setStatus(''); render(); }));
    foot.appendChild(btn('n19-close', TX.close, () => closeModal()));
    root.appendChild(foot);
    P.appendChild(root);
    // a code that just appeared may be below the fold on a phone: bring it into view
    if (ui.reveal) { const r = document.getElementById(ui.reveal); ui.reveal = ''; if (r) { try { r.scrollIntoView({ block: 'center' }); } catch (e) { /* old browser */ } } }
  }
  function nameRow(root) {
    const r = el('div', { class: 'n19-row' });
    const lab = el('label', { for: 'n19-name' }, TX.nameL);
    const inp = el('input', { id: 'n19-name', type: 'text', maxlength: String(NAME_MAX), autocomplete: 'nickname', spellcheck: 'false', 'data-i18n': 'off' });
    inp.value = defaultName();
    inp.onchange = () => { const n = cleanName(inp.value); inp.value = n; if (n) { saveName(n); main.setName(n); } };
    r.appendChild(lab); r.appendChild(inp); root.appendChild(r);
  }
  function viewMenu(root) {
    root.appendChild(el('p', null, TX.intro));
    nameRow(root);
    const desk = isDesktop();
    const cards = el('div', { class: 'n19-cards' });
    const h = el('div', { class: 'n19-card' });
    h.appendChild(el('h3', null, TX.hostH)); h.appendChild(el('p', null, TX.hostP));
    const hb = btn('n19-host', TX.hostB, () => doHost()); if (desk) hb.disabled = true; h.appendChild(hb);
    const j = el('div', { class: 'n19-card' });
    j.appendChild(el('h3', null, TX.joinH)); j.appendChild(el('p', null, TX.joinP));
    const jr = el('div', { class: 'n19-row' });
    const ci = el('input', { id: 'n19-code', type: 'text', inputmode: 'text', autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false', maxlength: '9', placeholder: 'KRT-4MW', 'aria-label': TX.joinH, 'data-i18n': 'off' });
    ci.value = ui.prefill || '';
    ci.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); doJoin(); } e.stopPropagation(); };
    const jb = btn('n19-join', TX.joinB, () => doJoin()); if (desk) jb.disabled = true;
    jr.appendChild(ci); jr.appendChild(jb); j.appendChild(jr);
    cards.appendChild(h); cards.appendChild(j); root.appendChild(cards);
    if (desk) root.appendChild(el('p', { class: 'n19-warn' }, TX.eDesktop));
    const m = el('div', { class: 'n19-row' }); m.appendChild(btn('n19-manual', TX.manualB, () => { ui.view = 'manual'; setStatus(''); render(); }, 'small')); root.appendChild(m);
  }
  function viewHost(root) {
    const code = main.code();
    const box = el('div', { class: 'n19-hostbox' });
    const left = el('div', { class: 'n19-codecol' });
    left.appendChild(el('div', { class: 'n19-label' }, TX.yourCode));
    left.appendChild(el('div', { class: 'n19-code', id: 'n19-code-show', 'data-i18n': 'off' }, code ? showCode(code) : '…'));
    left.appendChild(el('p', { class: 'n19-help' }, TX.hostHelp));
    const r = el('div', { class: 'n19-row' });
    const cb = btn('n19-copy', TX.copyLink, async () => { if (code && await copyText(joinLink(code))) { cb.textContent = TX.copied; setTimeout(() => { cb.textContent = TX.copyLink; }, 1600); } }, 'small');
    r.appendChild(cb);
    r.appendChild(btn('n19-stop', TX.stop, () => { main.leave('local'); ui.view = 'menu'; setStatus(''); render(); }, 'small'));
    if (main.connected()) r.appendChild(btn('n19-continue', TX.cont, () => closeModal()));
    left.appendChild(r);
    box.appendChild(left);
    if (code) {
      const qr = QR.encode(joinLink(code), 'M');
      if (qr) {
        const c = el('canvas', { class: 'n19-qr', id: 'n19-qr', role: 'img', 'aria-label': TX.qrAlt });
        QR.draw(c, qr, 4);
        box.appendChild(c);
      }
    }
    root.appendChild(box);
    hostStatus();
  }
  function hostStatus() {
    const p = main.peers()[0], s = main.stats();
    if (s.state === 'connecting') setStatus(TX.opening);
    else if (p && p.state === 'open') setStatus(fill(TX.joined, { name: p.name }) + ' ' + fill(TX.ping, { ms: s.rtt }), 'n19-good');
    else if (p && p.state === 'lost') setStatus(TX.lostHost, 'n19-warn');
    else if (!ui.status || ui.statusCls === 'n19-good') setStatus(TX.waiting);
  }
  function viewGuest(root) {
    const p = main.peers()[0];
    root.appendChild(el('p', { class: 'n19-big', id: 'n19-guest-line', 'data-i18n': 'off' }, p ? fill(TX.connectedTo, { name: p.name }) : TX.finding));
    root.appendChild(el('p', null, TX.guestWait));
    const r = el('div', { class: 'n19-row' });
    r.appendChild(btn('n19-leave', TX.leave, () => { main.leave('local'); ui.view = 'menu'; setStatus(''); render(); }, 'small'));
    root.appendChild(r);
    if (p && p.state === 'open') setStatus(fill(TX.ping, { ms: main.stats().rtt }), 'n19-good');
  }
  function viewManual(root) {
    root.appendChild(el('h3', null, TX.manH));
    root.appendChild(el('p', null, TX.manP));
    nameRow(root);
    const cards = el('div', { class: 'n19-cards' });
    const h = el('div', { class: 'n19-card' });
    h.appendChild(el('h3', null, TX.manHostH));
    h.appendChild(btn('n19-man-offer', TX.manMake, () => manOffer(), 'small'));
    if (ui.offer) {
      h.appendChild(el('label', { for: 'n19-man-offer-text' }, TX.manInvite));
      const ta = el('textarea', { id: 'n19-man-offer-text', readonly: 'readonly', rows: '3', spellcheck: 'false', 'data-i18n': 'off' }); ta.value = ui.offer; h.appendChild(ta);
      const cb = btn('n19-man-copy-offer', TX.copyCode, async () => { if (await copyText(ui.offer, ta)) cb.textContent = TX.copied; }, 'small'); h.appendChild(cb);
      h.appendChild(el('label', { for: 'n19-man-answer-in' }, TX.manAnswerL));
      const ai = el('textarea', { id: 'n19-man-answer-in', rows: '3', spellcheck: 'false', autocomplete: 'off', 'data-i18n': 'off' }); ai.onkeydown = (e) => e.stopPropagation(); h.appendChild(ai);
      h.appendChild(btn('n19-man-connect', TX.manConnect, () => manAccept(ai.value), 'small'));
    }
    const j = el('div', { class: 'n19-card' });
    j.appendChild(el('h3', null, TX.manJoinH));
    j.appendChild(el('label', { for: 'n19-man-offer-in' }, TX.manPasteL));
    const oi = el('textarea', { id: 'n19-man-offer-in', rows: '3', spellcheck: 'false', autocomplete: 'off', 'data-i18n': 'off' }); oi.value = ui.offerIn || ''; oi.oninput = () => { ui.offerIn = oi.value.slice(0, MAN.CODE_MAX); }; oi.onkeydown = (e) => e.stopPropagation(); j.appendChild(oi);
    j.appendChild(btn('n19-man-answer', TX.manAnswer, () => manAnswer(oi.value), 'small'));
    if (ui.answer) {
      j.appendChild(el('label', { for: 'n19-man-answer-text' }, TX.manSendBack));
      const ta = el('textarea', { id: 'n19-man-answer-text', readonly: 'readonly', rows: '3', spellcheck: 'false', 'data-i18n': 'off' }); ta.value = ui.answer; j.appendChild(ta);
      const cb = btn('n19-man-copy-answer', TX.copyCode, async () => { if (await copyText(ui.answer, ta)) cb.textContent = TX.copied; }, 'small'); j.appendChild(cb);
    }
    cards.appendChild(h); cards.appendChild(j); root.appendChild(cards);
  }
  function currentName() { const i = document.getElementById('n19-name'); const n = i ? cleanName(i.value) : ''; if (n) { saveName(n); return n; } return defaultName(); }
  async function doHost() {
    if (ui.busy) return; ui.busy = true;
    const name = currentName();
    ui.view = 'host'; setStatus(TX.opening); render();
    try { await main.host({ name }); setStatus(main.connected() ? ui.status : TX.waiting); render(); } catch (e) { ui.view = 'menu'; render(); setStatus(errText(e), 'n19-warn'); }
    ui.busy = false;
  }
  async function doJoin() {
    if (ui.busy) return;
    const ci = document.getElementById('n19-code');
    const raw = ci ? ci.value : '';
    const code = normCode(raw);
    if (!code) { setStatus(TX.eBadCode, 'n19-warn'); return; }
    ui.busy = true; ui.prefill = showCode(code);
    const name = currentName();
    setStatus(TX.finding);
    try {
      await main.join(code, { name });
      remember(code);
      ui.view = 'guest'; setStatus(''); render();
    } catch (e) { setStatus(errText(e), 'n19-warn'); }
    ui.busy = false;
  }
  function remember(code) { try { const o = JSON.parse(localStorage.getItem('octave.net19.v1') || '{}') || {}; o.last = code; localStorage.setItem('octave.net19.v1', JSON.stringify(o)); } catch (e) { /* storage blocked */ } }
  async function manOffer() {
    if (ui.busy) return; ui.busy = true; ui.manRole = 'host'; main.setName(currentName());
    setStatus(TX.manWorking);
    try { ui.offer = await main.manual.hostOffer(); ui.answer = ''; ui.reveal = 'n19-man-offer-text'; render(); setStatus(TX.waiting); } catch (e) { setStatus(errText(e), 'n19-warn'); }
    ui.busy = false;
  }
  async function manAccept(code) {
    if (ui.busy) return; ui.busy = true; setStatus(TX.manWorking);
    try { await main.manual.hostAccept(code); ui.offer = ''; ui.view = 'host'; render(); } catch (e) { setStatus(e && e.code === 'bad-code' ? TX.manBad : errText(e), 'n19-warn'); }
    ui.busy = false;
  }
  async function manAnswer(code) {
    if (ui.busy) return;
    ui.offerIn = typeof code === 'string' ? code.slice(0, MAN.CODE_MAX) : ''; ui.busy = true; ui.manRole = 'guest'; main.setName(currentName());
    setStatus(TX.manWorking);
    try { ui.answer = await main.manual.guestAnswer(code); ui.reveal = 'n19-man-answer-text'; render(); setStatus(TX.finding); } catch (e) { setStatus(e && e.code === 'bad-code' ? TX.manBad : errText(e), 'n19-warn'); }
    ui.busy = false;
  }

  // the small connection chip over the game (DOM only; the canvas is never touched)
  function chip() {
    let c = document.getElementById('n19-chip');
    const role = main.role();
    if (!role) { if (c) c.hidden = true; return; }
    if (!c) {
      const host = document.getElementById('game') || document.body;
      c = el('div', { id: 'n19-chip', role: 'status', 'aria-live': 'polite', 'data-i18n': 'off' });
      host.appendChild(c);
    }
    c.hidden = false;
    const p = main.peers()[0], s = main.stats();
    c.className = p && p.state === 'open' ? 'n19-on' : p ? 'n19-lost' : 'n19-wait';
    c.textContent = p && p.state === 'open' ? fill(TX.chipOn, { name: p.name, ms: s.rtt }) : p ? TX.chipLost : fill(TX.chipWait, { code: showCode(s.code || '') });
  }
  let chipTimer = null;
  function wireEvents() {
    main.on('net:state', () => { chip(); if (main.role() && !chipTimer) chipTimer = setInterval(() => { chip(); if (panelOpen()) { if (ui.view === 'host') hostStatus(); else if (ui.view === 'guest') { const p = main.peers()[0]; if (p && p.state === 'open') setStatus(fill(TX.ping, { ms: main.stats().rtt }), 'n19-good'); } } }, 1000); if (!main.role() && chipTimer) { clearInterval(chipTimer); chipTimer = null; } });
    main.on('net:peer', (p) => {
      setStatus(main.role() === 'host' ? fill(TX.joined, { name: p.name }) : fill(TX.connectedTo, { name: p.name }), 'n19-good');
      if (panelOpen()) { ui.view = main.role() === 'host' ? 'host' : 'guest'; render(); }
      chip();
    });
    main.on('net:lost', () => { setStatus(main.role() === 'host' ? TX.lostHost : TX.lostGuest, 'n19-warn'); if (panelOpen()) render(); chip(); });
    main.on('net:back', () => { setStatus(TX.back2, 'n19-good'); if (panelOpen()) render(); chip(); });
    main.on('net:closed', (p) => {
      const why = p && p.reason;
      setStatus(why === 'left' ? TX.left : why === 'full' ? TX.eFull : TX.ended, why === 'local' ? '' : 'n19-warn');
      if (panelOpen()) { ui.view = main.role() === 'host' ? 'host' : 'menu'; render(); }
      chip();
    });
  }

  const CSS = `
#modal-panel .n19 { max-width: 100%; overflow-wrap: anywhere; }
#modal-panel .n19 h2 { margin: 0 0 .6cqh; }
#modal-panel .n19 h3 { margin: .2cqh 0 .4cqh; }
#modal-panel .n19 p { margin: .4cqh 0; }
#modal-panel .n19-card label { display: block; margin-top: .5cqh; }
#modal-panel .n19-card button { margin-top: .4cqh; }
#title .menu:has(#btn-together) { gap: 1cqw; }
#modal-panel .n19-row { display: flex; flex-wrap: wrap; gap: .6cqw; align-items: center; margin: .5cqh 0; }
#modal-panel .n19-row input { min-width: 0; flex: 1 1 14cqw; }
#modal-panel .n19 input, #modal-panel .n19 textarea { font-size: max(1.9cqw, 16px); background: #120e0a; color: #f0e4c8; border: 1px solid var(--gold-dim, #7a5c2a); padding: .3cqh .6cqw; box-sizing: border-box; }
#modal-panel .n19 textarea { width: 100%; font-family: monospace; font-size: max(1.4cqw, 16px); resize: vertical; }
#modal-panel #n19-code { font-family: monospace; letter-spacing: .1em; text-transform: uppercase; flex: 0 1 11ch; width: 11ch; }
#modal-panel .n19-cards { display: flex; flex-wrap: wrap; gap: 1cqw; }
#modal-panel .n19-card { flex: 1 1 30cqw; min-width: 0; border: 1px solid var(--gold-dim, #7a5c2a); padding: .6cqh 1cqw; background: rgba(0,0,0,.18); }
#modal-panel .n19-hostbox { display: flex; flex-wrap: wrap; gap: 1.6cqw; align-items: flex-start; }
#modal-panel .n19-codecol { flex: 1 1 34cqw; min-width: 0; }
#modal-panel .n19-label { font-family: var(--font-sc), serif; color: #c9b38a; }
#modal-panel .n19-code { font-family: monospace; font-size: max(5.2cqw, 28px); letter-spacing: .14em; color: var(--gold, #d9a441); margin: .3cqh 0 .6cqh; }
#modal-panel .n19-qr { width: min(30cqh, 30cqw); height: auto; image-rendering: pixelated; border: 2px ridge var(--gold-dim, #8c6d2f); flex: 0 0 auto; }
#modal-panel .n19-big { font-size: 1.15em; color: #e8d8b0; }
#modal-panel .n19-status { min-height: 1.3em; color: #e2d4b4; }
#modal-panel .n19-warn { color: #f0b060; } #modal-panel .n19-good { color: #b8d890; }
#modal-panel .n19-foot { justify-content: flex-end; }
#n19-chip { position: absolute; right: 1.2cqw; top: 1.2cqh; z-index: 6; pointer-events: none; font-family: var(--font-sc), serif; font-size: max(1.5cqw, 10px);
  color: #e9dcc0; background: rgba(12,10,8,.62); border: 1px solid rgba(201,160,80,.45); padding: .25cqh .8cqw; border-radius: 2px; text-shadow: 0 1px 0 #000; max-width: 40cqw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#n19-chip[hidden] { display: none; }
#n19-chip.n19-on::before { content: ''; display: inline-block; width: .7em; height: .7em; border-radius: 50%; background: #8fd070; margin-right: .5em; vertical-align: middle; }
#n19-chip.n19-lost { color: #f0b060; }
`;
  function injectStyle() {
    if (document.getElementById('net19-style')) return;
    const s = document.createElement('style'); s.id = 'net19-style'; s.textContent = CSS; document.head.appendChild(s);
  }
  function titleButton() {
    if (document.getElementById('btn-together')) return;
    const menu = document.querySelector('#title .menu'); if (!menu) return;
    const b = el('button', { class: 'dfbtn', id: 'btn-together', type: 'button' }, TX.btn);
    b.onclick = () => openPanel();
    const help = document.getElementById('btn-help');
    if (help && help.parentNode === menu) menu.insertBefore(b, help); else menu.appendChild(b);
  }
  function appendRows() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById('n19-opt')) return;
    const lab = el('span', { class: 'gfx-label', id: 'n19-opt-label' }, TX.optLabel + ' ');
    lab.appendChild(el('small', { class: 'muted' }, TX.optHint));
    const b = el('button', { class: 'dfbtn small', id: 'n19-opt', type: 'button', 'aria-label': TX.optLabel }, main.connected() ? TX.optOn : TX.optOpen);
    b.onclick = () => openPanel();
    grid.appendChild(lab); grid.appendChild(b);
  }
  function wireOptions() {
    if (typeof renderAccessibilityMenu !== 'function') return;
    const _acc = renderAccessibilityMenu;
    renderAccessibilityMenu = function () { const r = _acc.apply(this, arguments); try { appendRows(); } catch (e) { warnOnce('rows', e); } return r; };
  }
  // a scanned QR code or a shared link opens the game at #join=CODE: open the Join view with the code filled in (the
  // player still presses Join, which is also the gesture the browser wants before sound).
  function joinFromHash() {
    let m = null;
    try { m = /[#&]join=([A-Za-z0-9-]{4,16})/.exec(location.hash || ''); } catch (e) { return; }
    if (!m) return;
    const code = normCode(m[1]);
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* file: */ }
    if (!code) return;
    ui.prefill = showCode(code);
    let tries = 0;
    const wait = setInterval(() => {
      tries++;
      if (typeof G !== 'undefined' && G && G.state === 'title' && !G.openPanel) { clearInterval(wait); openPanel('menu'); const i = document.getElementById('n19-join'); if (i) i.focus(); }
      else if (tries > 600) clearInterval(wait);
    }, 100);
  }
  function boot() {
    try { injectStyle(); titleButton(); } catch (e) { warnOnce('boot', e); }
    try { wireOptions(); } catch (e) { warnOnce('wireOptions', e); }
    try { wireEvents(); } catch (e) { warnOnce('events', e); }
    try { joinFromHash(); } catch (e) { warnOnce('hash', e); }
    window.addEventListener('pagehide', () => { try { if (main.role()) main.leave('local'); } catch (e) { /* closing */ } });
  }

  // ---------------------------------------------------------------- the default instance and the module object
  const main = create();
  function loopbackPair(opts) {
    const h = create(), g = create(), code = randomCode();
    const tr = loopTransport(opts);
    return h.host({ transport: tr, code, name: (opts && opts.hostName) || 'Host' }).then(() => g.join(code, { transport: loopTransport(opts), name: (opts && opts.guestName) || 'Guest' })).then(() => ({ host: h, guest: g, code }));
  }
  const NET = Object.assign(main, {
    create, loopbackPair,
    configure(c) {
      if (!c || typeof c !== 'object') return Object.assign({}, CONFIG);
      if (c.broker && typeof c.broker === 'object') CONFIG.broker = Object.assign({}, CONFIG.broker, c.broker);
      if (Array.isArray(c.iceServers)) CONFIG.iceServers = c.iceServers.slice();
      for (const k of ['heartbeatMs', 'lostMs', 'giveUpMs', 'joinTimeoutMs', 'reconnectMs', 'reconnectTimeoutMs', 'abuse', 'inRate', 'inBurst']) if (Number.isFinite(+c[k]) && +c[k] > 0) CONFIG[k] = +c[k];
      return JSON.parse(JSON.stringify(CONFIG));
    },
    _pure: { randomCode, normCode, showCode, cleanName, encodeFrame, decodeFrame, sane, packCode, unpackCode, joinLink, CODE_ABC, CODE_LEN, ID_PREFIX, LINK_CAP, TYPE_CAP, MAN, DEFAULTS: JSON.parse(JSON.stringify(DEFAULTS)) },
    _transports: { loop: loopTransport, bc: bcTransport, peer: () => peerTransport(), pairLinks, loadPeerJS },
    QR, TX, TEXTS,
    ui: { open: openPanel, render, chip, state: ui, appendRows, titleButton },
  });
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot(); }
  return NET;
})();
if (typeof window !== 'undefined') window.NET19 = NET19;
