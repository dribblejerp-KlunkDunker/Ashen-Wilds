// node tools/lore/places.js --write   read the atlas's places into docs/data/places.json
// node tools/lore/places.js --check   exit 1 if docs/data/places.json has drifted from the atlas
// node tools/lore/places.js --list    print one line per place: how it was found, and where
//
// The first slice of the lore pipeline (docs/pipeline.md). The list of places is the gazetteer's 133
// (tools/lore/gazetteer.md); each is looked up in docs/worldbuilding/atlas/ and given its region, kind, position
// where the atlas gives one, zones (atlas/10-zones.md), people (people/README.md's roster), what hunts there
// (the bestiary), and the file and line it was read from. Nothing here is written by hand: change the atlas and
// run --write. Nothing in the game loads the JSON yet.
'use strict';
const fs = require('fs'), path = require('path');
const L = require('./lib.js');
const ATLAS = path.join(L.LORE, 'atlas');
const GAZ = path.join(__dirname, 'gazetteer.md');
const OUT = path.join(L.ROOT, 'docs', 'data', 'places.json');

// Which atlas files to search first for each gazetteer region; the rest are searched after.
const REGION_FILES = {
  'The wider Round, outside Orlen': ['8-the-wider-round.md', '5-the-deep.md'],
  'Orlen outside the Blackfen': ['7-orlen-beyond-the-fen.md'],
  'The Blackfen: roads, towns and sites': ['2-the-blackfen.md'],
  "The Watchhouse map: the old game's Act I": ['2-the-blackfen.md'],
  'The Bell Road': ['3-the-bell-road.md'],
  'The Drowned Measures': ['6-the-drowned-measures.md'],
  'The Citadels and the far north': ['4-the-citadels.md', '5-the-deep.md'],
  // the ledge and the bothy have no atlas entry: the game's design is their source
  "The Long Account's built level": ['../the-round-and-the-long-account.md'],
  'The wilds between': ['9-the-wilds-between.md'],
};
// The files that are places (not the guide, the scale tab or the zone plan).
const PLACE_FILES = ['2-the-blackfen.md', '3-the-bell-road.md', '4-the-citadels.md', '5-the-deep.md', '6-the-drowned-measures.md',
  '7-orlen-beyond-the-fen.md', '8-the-wider-round.md', '9-the-wilds-between.md'];
// The atlas's six kinds of place (0-how-to-read.md, "Kinds of place"). A kind is set only when the line under the
// name uses the kind's own words; otherwise it is left null and the line's own words are kept (kindText).
const KINDS = [
  ['great complex', /^great complex/i], ['deep place', /^deep place|deep place$/i], ['small site', /^small site/i],
  ['spire', /^spire/i], ['city or town', /^(?:[a-z-]+ ){0,2}(?:city|town)\b/i], ['open country', /^open country/i],
];

// ---- the gazetteer
function readGazetteer() {
  const doc = L.readDoc(GAZ);
  const out = [];
  let region = null;
  doc.lines.forEach((l, i) => {
    const h = /^## (.+?) \((\d+)\)$/.exec(l);
    if (h) { region = { name: h[1], count: +h[2] }; return; }
    const m = /^- (.+)$/.exec(l);
    if (!m || !region) return;
    const parts = m[1].split(' | ');
    const g = { name: parts[0].trim(), region: region.name, regionCount: region.count, aka: [], at: null, line: i + 1 };
    for (const p of parts.slice(1)) {
      const a = /^aka: (.+)$/.exec(p), b = /^at: (.+)$/.exec(p);
      if (a) g.aka = a[1].split(';').map((s) => s.trim()).filter(Boolean);
      if (b) g.at = b[1].trim();
    }
    out.push(g);
  });
  return out;
}

// ---- the atlas
function readAtlas() {
  const files = fs.readdirSync(ATLAS).filter((f) => /\.md$/.test(f)).sort().concat(['../the-round-and-the-long-account.md']);
  return files.map((f) => {
    const d = L.readDoc(path.join(ATLAS, f));
    d.name = f;
    return d;
  });
}
// The italic line under an entry's name: kind, scale, holder, danger, source. It may wrap over lines.
function kindLine(doc, h) {
  // only the atlas writes this line; the game's design document does not
  if (!/^\d+-/.test(doc.name || '')) return null;
  for (let n = h.from; n <= Math.min(h.to, h.from + 3); n++) {
    const l = doc.lines[n - 1];
    if (!l.trim()) continue;
    if (!/^\*/.test(l)) return null;
    let s = l;
    for (let k = n + 1; k <= h.to && doc.lines[k - 1].trim(); k++) s += ' ' + doc.lines[k - 1];
    const text = L.ascii(s).replace(/\*\s*\*/g, '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
    return { text, line: n };
  }
  return null;
}
function parseKindLine(k) {
  if (!k) return { kind: null, held: null, danger: null, origin: null };
  const parts = k.text.split(/\s*;\s*/);
  const first = parts[0];
  const kind = (KINDS.find(([, re]) => re.test(first)) || [null])[0];
  const held = (parts.find((p) => /^held by /.test(p)) || '').replace(/^held by /, '') || null;
  const dm = /danger ([IV]+(?:[^;]*?)?)(?:$|;)/.exec(k.text);
  const last = parts[parts.length - 1];
  const origin = /\(new\)|^new$/.test(last) ? 'new' : /lore/.test(last) ? (/new/.test(last) ? 'lore, with new details' : 'lore') : null;
  return { kind, kindText: first, held, danger: dm ? dm[1].trim() : null, origin };
}

// ---- positions the atlas gives as numbers
function readPositions(atlas) {
  const pos = [];
  const scale = atlas.find((d) => d.name === '1-scale-and-distances.md');
  if (scale) {
    for (const t of L.tables(scale)) {
      const h = t.head.map((c) => c.toLowerCase());
      const road = h[1] === 'miles from the watchhouse';
      const scarp = h[1] === 'miles along the scarp from hob\'s height';
      if (!road && !scarp) continue;
      let along = 'the scarp';
      if (road) {
        // the road is named in the bold line above the table
        for (let n = t.line - 1; n > 0; n--) { const m = /^\*\*(The [^*]+)\*\*/.exec(scale.lines[n - 1]); if (m) { along = m[1]; break; } }
      }
      for (const r of t.rows) {
        // "54 to 55", or "46, below the rim"
        const m = /^(\d+)(?: to (\d+))?(?:,.*)?$/.exec(r.cells[1]);
        if (!m) continue;
        const p = { along: L.ascii(along), mile: +m[1], file: scale.rel, line: r.line };
        if (m[2]) p.toMile = +m[2];
        // a stage may name two places ("The Last Gardens and Halwen House"); each part is a candidate
        const parts = L.ascii(r.cells[0]).replace(/\s*\([^)]*\)/g, '').split(/,| and /).map((s) => L.norm(s));
        pos.push({ parts, p });
      }
    }
  }
  for (const d of atlas) {
    for (const t of L.tables(d)) {
      const col = t.head.findIndex((c) => /^miles from the watchhouse$/i.test(c));
      if (col < 0 || d.name === '1-scale-and-distances.md') continue;
      for (const r of t.rows) {
        const m = /^(\d+), ([a-z-]+) \((-?\d+), (-?\d+)\)$/.exec(L.ascii(r.cells[col]));
        if (!m) continue;
        pos.push({ parts: [L.norm(r.cells[0])], p: { from: "The Wayfarer's Watchhouse", miles: +m[1], bearing: m[2], x: +m[3], y: +m[4], file: d.rel, line: r.line } });
      }
    }
  }
  return pos;
}
// "about 64 miles north-west of the Watchhouse" in an entry's kind line
function kindLinePosition(k, rel) {
  if (!k) return null;
  const m = /about (\d+) miles ([a-z-]+) of the Watchhouse/.exec(k.text.replace(/-\s+/g, '-'));
  return m ? { from: "The Wayfarer's Watchhouse", miles: +m[1], bearing: m[2], file: rel, line: k.line } : null;
}

// ---- zones (atlas/10-zones.md: PROPOSED under O15)
function readZones(atlas) {
  const d = atlas.find((x) => x.name === '10-zones.md');
  if (!d) return [];
  const rows = [];
  for (const h of d.heads.filter((x) => x.level === 2)) {
    const m = /^(Z\d+[a-z]?)\. (.+)$/.exec(h.text);
    if (!m) continue;
    for (const t of L.tables(d).filter((t) => t.line > h.line && t.line <= h.to + 200)) {
      if (!(t.head[1] === 'Place' && t.head[2] === 'x, y')) continue;
      // only this zone's own table: it is the first after the zone's heading and before the next zone's
      const next = d.heads.find((x) => x.level === 2 && x.line > h.line);
      if (next && t.line > next.line) continue;
      for (const r of t.rows) {
        const xy = /^(\d+), (\d+)$/.exec(r.cells[2]);
        if (!xy || !/^(atlas|complex|gate)$/.test(r.cells[3])) continue;
        rows.push({ zone: m[1], label: L.ascii(r.cells[1]).replace(/[`*]/g, ''), x: +xy[1], y: +xy[2], kind: r.cells[3], file: d.rel, line: r.line });
      }
    }
  }
  return rows;
}
// A zone row is about a place when its label (or one half of it, split at "and") starts with the place's
// name, alone or followed by a comma, a colon, a bracket or a possessive.
function zoneRowNames(label, key) {
  // a row may name two places: "The Peg Houses and the Crooked Pair"
  return L.ascii(label).split(' and ').map(L.norm).some((n) => n === key || new RegExp('^' + L.esc(key) + "(('s)? |,|:| \\(|$)").test(n));
}

// A place's id: its name, compared loosely, in lower case with underscores ("The Wayfarer's Watchhouse" is
// wayfarers_watchhouse). Other data files refer to a place by this id.
const idOf = (name) => L.norm(name).replace(/'/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// ---- finding one place
function find(g, atlas) {
  const keys = (g.at ? [g.at] : [g.name].concat(g.aka)).map(L.norm);
  const pref = REGION_FILES[g.region] || [];
  const files = pref.concat(PLACE_FILES.filter((f) => !pref.includes(f))).map((f) => atlas.find((d) => d.name === f)).filter(Boolean);
  const entryOf = (d, n) => d.heads.filter((h) => h.level >= 2 && h.line <= n).pop() || null;
  // 1. an entry of its own, or one it shares a heading with ("Milebank and the Red Stitch"); an entry with a line
  // under its name beats a heading that only groups others; 2. a region's own file ("# The Blackfen"), read from its
  // first entry; 3. a bold name in an entry; 4. a plain mention
  const cands = [];
  for (const key of keys) for (const d of files) for (const h of d.heads) {
    if (h.level < 2) continue;
    const exact = L.norm(h.text) === key;
    const shared = !exact && L.ascii(h.text).split(/:| and |, /).map(L.norm).includes(key);
    if (exact || shared) cands.push({ how: exact ? 'entry' : 'shared entry', d, h, line: h.line, key, rank: (kindLine(d, h) ? 0 : 2) + (exact ? 0 : 1) });
  }
  if (cands.length) return cands.sort((a, b) => a.rank - b.rank)[0];
  for (const key of keys) for (const d of files) {
    const top = d.heads.find((h) => h.level === 1);
    const first = d.heads.find((h) => h.level === 2);
    if (top && first && L.norm(top.text) === key) return { how: 'region', d, h: first, line: top.line, key };
  }
  for (const key of keys) for (const d of files) {
    for (let n = 1; n <= d.lines.length; n++) {
      const bolds = d.lines[n - 1].match(/\*\*[^*]+\*\*/g) || [];
      if (bolds.some((b) => { const t = L.norm(b.replace(/\(new\)/, '')); return t === key || new RegExp('^' + L.esc(key) + "('s)?(,| \\(|$)").test(t); })) {
        const h = entryOf(d, n);
        if (h) return { how: 'named in', d, h, line: n, key };
      }
    }
  }
  for (const key of keys) for (const d of files) {
    for (let n = 1; n <= d.lines.length; n++) {
      if (/^#|^>/.test(d.lines[n - 1])) continue;
      if (L.names(d.lines[n - 1], key)) { const h = entryOf(d, n); if (h) return { how: 'mentioned in', d, h, line: n, key }; }
    }
  }
  return null;
}

function build() {
  const atlas = readAtlas();
  const gaz = readGazetteer();
  const roster = { people: L.people(), beasts: L.beasts() };
  const positions = readPositions(atlas);
  const zoneRows = readZones(atlas);
  const places = [];
  const missing = [];
  for (const g of gaz) {
    const f = find(g, atlas);
    if (!f) { missing.push(g.name); continue; }
    const own = f.how === 'entry' || f.how === 'shared entry' || f.how === 'region';
    const k = kindLine(f.d, f.h);
    const info = parseKindLine(k);
    const sec = L.sections(f.d, f.h);
    // people and beasts: an entry's "Who is here", "What hunts it" and "Dangers"; a place named inside an entry,
    // the paragraph that names it
    const text = own ? ['Who is here', 'What hunts it', 'What hunts', 'Dangers'].map((s) => (sec[s] ? sec[s].text : '')).join('\n') : L.paragraphAt(f.d, f.line);
    const whoText = own ? (sec['Who is here'] ? sec['Who is here'].text : '') : L.paragraphAt(f.d, f.line);
    const keys = [L.norm(g.name)].concat(g.aka.map(L.norm));
    const pos = [];
    for (const { parts, p } of positions) if (keys.some((key) => parts.includes(key))) pos.push(p);
    const kp = own ? kindLinePosition(k, f.d.rel) : null;
    if (kp && !pos.some((p) => p.x != null)) pos.push(kp);
    const zones = zoneRows.filter((z) => keys.some((key) => zoneRowNames(z.label, key)))
      .map((z) => ({ zone: z.zone, x: z.x, y: z.y, as: z.kind, label: z.label, file: z.file, line: z.line }));
    const place = {
      id: idOf(g.name),
      name: L.ascii(g.name),
      aka: g.aka.map(L.ascii),
      region: L.ascii(g.region),
      atlasRegion: /^\d+-/.test(f.d.name) ? L.ascii((f.d.heads.find((h) => h.level === 1) || { text: '' }).text) : null,
      kind: own ? info.kind : null,
      kindText: own ? info.kindText || null : null,
      held: own ? info.held : null,
      danger: own ? info.danger : null,
      origin: own ? info.origin : null,
      within: own ? null : L.ascii(f.h.text),
      found: f.how,
      positions: pos,
      zones,
      people: L.peopleIn(whoText, roster.people),
      hunts: L.beastsIn(text, roster.beasts),
      source: { file: f.d.rel, line: f.line, heading: L.ascii(f.h.text), headingLine: f.h.line },
    };
    if (f.how === 'shared entry') place.within = L.ascii(f.h.text);
    places.push(place);
  }
  return { places, missing, gazetteer: gaz };
}

function json(places) {
  const doc = {
    about: 'GENERATED by tools/lore/places.js from docs/worldbuilding/atlas/ (approved under O10), the zone plan in ' +
      'atlas/10-zones.md (PROPOSED under O15), docs/worldbuilding/people/README.md and the bestiary. Do not edit by hand: ' +
      'change the lore and run node tools/lore/places.js --write. See docs/pipeline.md.',
    count: places.length,
    places,
  };
  return JSON.stringify(doc, null, 1) + '\n';
}

if (require.main === module) {
  const r = build();
  const text = json(r.places);
  const arg = process.argv[2];
  if (r.missing.length) { console.error('not found in the atlas: ' + r.missing.join('; ')); if (arg !== '--list') process.exit(1); }
  if (arg === '--check') {
    let old = '';
    try { old = fs.readFileSync(OUT, 'utf8'); } catch (e) { console.error('docs/data/places.json is missing: run node tools/lore/places.js --write'); process.exit(1); }
    if (old !== text) { console.error('docs/data/places.json is out of date: run node tools/lore/places.js --write'); process.exit(1); }
    console.log('docs/data/places.json is current (' + r.places.length + ' places)');
  } else if (arg === '--write') {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, text);
    console.log('wrote docs/data/places.json (' + r.places.length + ' places)');
  } else if (arg === '--list') {
    for (const p of r.places) console.log([p.name, p.found, p.source.file.replace('docs/worldbuilding/', '') + ':' + p.source.line, p.within || '', p.kind || '-', 'pos ' + p.positions.length, 'z ' + p.zones.map((z) => z.zone).join(','), 'ppl ' + p.people.length, p.hunts.join(',')].join(' | '));
  } else {
    console.log('usage: node tools/lore/places.js --write | --check | --list');
  }
}
module.exports = { build, json, readGazetteer, idOf, OUT, GAZ };
