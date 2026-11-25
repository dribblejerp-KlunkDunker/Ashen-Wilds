// node test/lore-places.test.js [--no-browser]
// The lore pipeline's first slice (docs/pipeline.md): every one of the gazetteer's places (133, and 134 since O18
// split the Bloom Quarters) is found in the
// atlas, every fact in docs/data/places.json points at a line that says it, the names it carries are the lore's,
// the canon checks pass, and the JSON is current. Node only: there is no browser half.
'use strict';
const path = require('path'), fs = require('fs'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const L = require(path.join(ROOT, 'tools', 'lore', 'lib.js'));
const P = require(path.join(ROOT, 'tools', 'lore', 'places.js'));
let fails = 0;
const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };
const bad = (list, l, show) => check(list.length === 0, l + (list.length ? ': ' + list.slice(0, 6).map(show || String).join('; ') + (list.length > 6 ? ' ...' : '') : ''));

// ---- the gazetteer's 133, with the Bloom Quarters as two (O18, LP8): 134
const gaz = P.readGazetteer();
const regions = {};
for (const g of gaz) { regions[g.region] = regions[g.region] || { want: g.regionCount, got: 0 }; regions[g.region].got++; }
check(gaz.length === 134, 'the gazetteer lists 134 places (' + gaz.length + ')');
check(Object.keys(regions).length === 9, 'in nine regions');
bad(Object.entries(regions).filter(([, r]) => r.want !== r.got), 'each region has the count its heading gives', ([n, r]) => n + ' ' + r.got + '/' + r.want);
check(new Set(gaz.map((g) => L.norm(g.name))).size === 134, 'no place is listed twice');

// ---- every one parses
const r1 = P.build(), r2 = P.build();
bad(r1.missing, 'every place is found in the lore');
check(r1.places.length === 134, '134 places parsed (' + r1.places.length + ')');
check(P.json(r1.places) === P.json(r2.places), 'two builds are the same');
check(new Set(r1.places.map((p) => p.id)).size === 134 && r1.places.every((p) => /^[a-z0-9_]+$/.test(p.id)), 'every place has its own id, lower case and underscores');
check(r1.places.find((p) => p.name === 'The Wayfarer\'s Watchhouse').id === 'wayfarers_watchhouse', 'an id is the name without "the" (wayfarers_watchhouse)');

// ---- every source line says what the place is called
const lines = {};
const lineOf = (file, n) => { if (!lines[file]) lines[file] = L.readLines(path.join(ROOT, file)); return lines[file][n - 1] || ''; };
const keysOf = (p) => { const g = gaz.find((x) => x.name === p.name); return (g.at ? [g.at] : [g.name].concat(g.aka)).map(L.norm); };
bad(r1.places.filter((p) => !fs.existsSync(path.join(ROOT, p.source.file))), 'every source file exists', (p) => p.name);
bad(r1.places.filter((p) => !keysOf(p).some((k) => L.norm(lineOf(p.source.file, p.source.line)).includes(k))), 'every source line names its place', (p) => p.name + ' at ' + p.source.file + ':' + p.source.line);
check(r1.places.every((p) => /^#+ /.test(lineOf(p.source.file, p.source.headingLine))), 'every heading line is a heading');
// the gazetteer's aka and at add no names: each is a phrase the lore already has
const lore = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const q = path.join(d, f); if (fs.statSync(q).isDirectory()) walk(q); else if (/\.md$/.test(f)) lore.push(L.norm(fs.readFileSync(q, 'utf8'))); } })(L.LORE);
const phrases = [].concat(...gaz.map((g) => g.aka.concat(g.at ? [g.at] : [])));
bad(phrases.filter((a) => !lore.some((t) => t.includes(L.norm(a)))), 'every aka and at in the gazetteer is the lore\'s own words');

// ---- what each place carries is the lore's
const roster = new Set(L.people().map((x) => x.name));
const beasts = new Set(L.beasts().map((b) => b.id));
check(roster.size === 169 && beasts.size === 17, 'the rosters: 169 people, 17 beasts (the bestiary\'s seventeen without what the orks fled, with the Unnamed)');
bad([].concat(...r1.places.map((p) => p.people.filter((n) => !roster.has(n)).map((n) => p.name + ': ' + n))), 'every person named is in people/README.md');
bad([].concat(...r1.places.map((p) => p.hunts.filter((b) => !beasts.has(b)).map((b) => p.name + ': ' + b))), 'every beast named is in the bestiary');
check(r1.places.every((p) => !p.hunts.includes('what_orks_fled')), 'no place says where what the orks fled is');
const zoneDoc = L.readLines(path.join(L.LORE, 'atlas', '10-zones.md')).join('\n');
bad([].concat(...r1.places.map((p) => p.zones.filter((z) => !new RegExp('^## ' + z.zone + '\\. ', 'm').test(zoneDoc)).map((z) => p.name + ': ' + z.zone))), 'every zone is one atlas/10-zones.md has');
bad([].concat(...r1.places.map((p) => p.zones.filter((z) => !lineOf(z.file, z.line).includes(z.x + ', ' + z.y)).map((z) => p.name + ' ' + z.zone))), 'every zone position is on the line it came from');
const offLine = (q) => {
  const l = L.ascii(lineOf(q.file, q.line));
  return q.x != null ? !l.includes('(' + q.x + ', ' + q.y + ')') : q.mile != null ? !l.includes('| ' + q.mile) : !l.includes(q.miles + ' miles');
};
bad([].concat(...r1.places.map((p) => p.positions.filter(offLine).map(() => p.name))), 'every position is on the line it came from');
const KINDS = ['great complex', 'deep place', 'spire', 'city or town', 'open country', 'small site'];
check(r1.places.every((p) => p.kind === null || KINDS.includes(p.kind)), 'a kind is one of the atlas\'s six, or null');

// ---- facts the lore fixes, read back
const by = (n) => r1.places.find((p) => p.name === n) || {};
check(by('Halwen House').positions.some((q) => q.along === 'The Bell Road' && q.mile === 14), 'Halwen House is 14 miles down the Bell Road');
check(by('The toll house').positions.some((q) => q.along === 'The Old Causeway' && q.mile === 30), 'the toll house is half way along the Causeway (mile 30)');
check(by('The Slagcrown').positions.some((q) => q.along === 'the scarp' && q.mile === 32) && by('The ledge').positions.some((q) => q.mile === 46), 'the Slagcrown at scarp mile 32, the ledge at 46');
check(by('Whitlow Grange').positions.some((q) => q.x === 30 && q.y === 95), 'Whitlow Grange at (30, 95) miles from the Watchhouse door');
check(by('The Wayfarer\'s Watchhouse').people.includes('Margery Reeve') && by('Wexhaven').people.includes('Gytha Marrin'), 'Margery Reeve at the Watchhouse, Gytha Marrin at Wexhaven');
check(by('The Spore Hollow').hunts.includes('walking_bloom') && by('The Old Quarry').hunts.includes('quarry_troll') && by('The North-West Feeding Ground').hunts.includes('ogre'), 'the bloom in the Spore Hollow, the troll in the Delph, the ogre in the Long Stable');
check(by('Coldbarrow').kind === 'great complex' && by('The Iron Stair').kind === 'spire' && by('Gull\'s Throat').kind === 'deep place', 'kinds read from the line under the name');
check(by('The ledge').zones.some((z) => z.zone === 'Z1') && by('Marget Sayle\'s bothy').people.includes('Marget Sayle'), 'the ledge is in Z1; Marget Sayle is at her bothy');

// ---- the canon checks, and the file is current
const text = fs.existsSync(P.OUT) ? fs.readFileSync(P.OUT, 'utf8') : '';
bad(L.canonFaults(text), 'docs/data/places.json passes the canon checks (plain ASCII, no prophecy, no shut question answered)');
check(L.canonFaults('The Vaults were made by the old kings').length === 1 && L.canonFaults('nobody knows who made the Vaults').length === 0, 'the shut-question check fires on an answer and not on the question');
check(text === P.json(r1.places), 'docs/data/places.json is current (node tools/lore/places.js --write)');
const run = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'lore', 'places.js'), '--check'], { encoding: 'utf8' });
check(run.status === 0, 'node tools/lore/places.js --check passes');
const src = ['lib.js', 'places.js'].map((f) => fs.readFileSync(path.join(ROOT, 'tools', 'lore', f), 'utf8')).join('\n');
check(!/Math\.random|Date\.now|new Date\(/.test(src), 'the tools read no clock and no dice');

console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
