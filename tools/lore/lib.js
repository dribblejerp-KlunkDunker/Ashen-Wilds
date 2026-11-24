// tools/lore/lib.js - what every lore reader shares: plain ASCII, names compared loosely, Markdown read into
// headings, paragraphs and tables with their line numbers, and the two rosters (people, beasts) a data file may
// name. Pure Node, no packages. See docs/pipeline.md.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const LORE = path.join(ROOT, 'docs', 'worldbuilding');

// The few characters the lore uses outside ASCII, and what each becomes in game text.
const FOLD = [
  [/[\u2018\u2019\u02bc]/g, "'"], [/[\u201c\u201d]/g, '"'], [/[\u2013\u2014\u2212]/g, '-'], [/\u00b7/g, ';'],
  [/\u2026/g, '...'], [/\u00a0/g, ' '], [/\u00d7/g, 'x'], [/\u00bd/g, ' 1/2'], [/\u00bc/g, ' 1/4'], [/\u00be/g, ' 3/4'],
  [/\u00b0/g, ' degrees'],
];
function ascii(s) {
  let t = String(s == null ? '' : s);
  for (const [re, to] of FOLD) t = t.replace(re, to);
  // accented letters lose their accents (Saint-Aumere keeps its spelling otherwise)
  t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return t.replace(/[^\x09\x0a\x0d\x20-\x7e]/g, '?');
}
const isAscii = (s) => !/[^\x09\x0a\x0d\x20-\x7e]/.test(String(s));

// A name for comparing: ASCII, no Markdown marks, lower case, no leading "the", one space.
function norm(s) {
  return ascii(s).replace(/[*_`]/g, '').toLowerCase().replace(/\s+/g, ' ').trim().replace(/^the /, '').replace(/[.,:;]+$/, '');
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Does text name `key` (normalised) as whole words? A possessive counts ("Greystair's").
function names(text, key) {
  if (!key) return false;
  return new RegExp('(^|[^a-z0-9-])(the )?' + esc(key) + "('s)?(?=$|[^a-z0-9-])").test(norm(' ' + text).replace(/^ /, ''));
}

const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
const readLines = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n').split('\n');

// A Markdown file as headings, each with its body's line range; and its tables.
function readDoc(file) {
  const lines = readLines(file);
  const heads = [];
  let fenced = false;
  lines.forEach((l, i) => {
    if (/^```/.test(l)) fenced = !fenced;
    if (fenced) return;
    const m = /^(#{1,6}) (.+?)\s*$/.exec(l);
    if (m) heads.push({ level: m[1].length, text: m[2], line: i + 1 });
  });
  heads.forEach((h, k) => { h.from = h.line + 1; h.to = k + 1 < heads.length ? heads[k + 1].line - 1 : lines.length; });
  return { file, rel: rel(file), lines, heads };
}

// The paragraph (run of non-blank lines) holding line n (1-based), as text. In a list, only the item holding n.
const ITEM = /^\s*(\d+\.|[-*]) /;
function paragraphAt(doc, n) {
  const stop = (l) => !l.trim() || /^#/.test(l);
  let a = n, b = n;
  while (a > 1 && !ITEM.test(doc.lines[a - 1]) && !stop(doc.lines[a - 2])) a--;
  while (b < doc.lines.length && !stop(doc.lines[b]) && !ITEM.test(doc.lines[b])) b++;
  return doc.lines.slice(a - 1, b).join(' ');
}

// The body of a heading as paragraphs, each { text, line }.
function paragraphs(doc, h) {
  const out = [];
  let cur = null;
  for (let n = h.from; n <= h.to; n++) {
    const l = doc.lines[n - 1];
    if (!l.trim()) { cur = null; continue; }
    if (!cur) { cur = { text: l, line: n }; out.push(cur); } else cur.text += ' ' + l;
  }
  return out;
}

// The sections of an atlas entry: "**At a glance.** ..." starts one; paragraphs after it belong to it.
function sections(doc, h) {
  const out = {};
  let cur = null;
  for (const p of paragraphs(doc, h)) {
    // the label may close the bold ("**Who is here.** ...") or run on into it ("**Who is here. Gytha Marrin**")
    const m = /^\*\*([A-Z][^*.]*?)\.(?:\*\*\s*|\s+)(.*)$/.exec(p.text);
    if (m) { cur = m[1]; out[cur] = { text: m[2], line: p.line }; } else if (cur) out[cur].text += '\n' + p.text;
  }
  return out;
}

// Every pipe table in a document: { line, head: [...], rows: [{ line, cells }] }.
function tables(doc) {
  const out = [];
  for (let i = 0; i < doc.lines.length; i++) {
    if (!/^\|.*\|\s*$/.test(doc.lines[i]) || !/^\|[\s:|-]+\|\s*$/.test(doc.lines[i + 1] || '')) continue;
    const cells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
    const t = { line: i + 1, head: cells(doc.lines[i]), rows: [] };
    let j = i + 2;
    for (; j < doc.lines.length && /^\|/.test(doc.lines[j]); j++) t.rows.push({ line: j + 1, cells: cells(doc.lines[j]) });
    out.push(t); i = j;
  }
  return out;
}

// The people roster: the first column of people/README.md's table (169 rows), with each row's line.
function people() {
  const doc = readDoc(path.join(LORE, 'people', 'README.md'));
  const t = tables(doc).find((x) => /^name$/i.test(x.head[0]));
  return t ? t.rows.map((r) => ({ name: ascii(r.cells[0]).replace(/\*/g, '').trim(), line: r.line, file: doc.rel })) : [];
}

// The beasts: Phase 32's seventeen (js/bestiary32.js) and the bestiary's own entry for the Unnamed.
// Each has the words the atlas uses for it. What the orks fled is left out on purpose: no place may say
// where it is (one of the three shut questions).
const BEAST_WORDS = {
  goblin: ['goblin', 'goblins'], ork: ['ork', 'orks', 'ork pack', 'ork packs'], ogre: ['ogre', 'ogres'],
  quarry_troll: ['quarry-troll', 'quarry-trolls', 'troll', 'trolls'], gallery_crawler: ['gallery-crawler', 'gallery-crawlers'],
  greymaw: ['greymaw'], peat_boar: ['peat-boar', 'peat-boars'], gallows_heron: ['gallows heron', 'gallows herons'],
  harrow_eel: ['harrow eel', 'harrow eels'], bloodwick: ['bloodwick', 'bloodwicks'], ash_rat: ['ash-rat', 'ash-rats'],
  rustling: ['rustling', 'rustlings'], ash_moth: ['ash-moth', 'ash-moths'], ashbound: ['ashbound'],
  corpse_cap: ['corpse-cap', 'corpse-caps'], walking_bloom: ['walking bloom', 'walking blooms', 'ash-spore husk', 'ash-spore husks'],
  unnamed: ['unnamed'],
};
function beasts() {
  const B = require(path.join(ROOT, 'js', 'bestiary32.js'));
  const rows = B.ROWS.filter((r) => r.id !== 'what_orks_fled').map((r) => ({ id: r.id, name: r.name }));
  const best = readDoc(path.join(LORE, 'bestiary.md'));
  if (best.heads.some((h) => h.level === 2 && /^The Unnamed$/.test(h.text))) rows.push({ id: 'unnamed', name: 'The Unnamed' });
  return rows.map((r) => Object.assign(r, { words: BEAST_WORDS[r.id] || [norm(r.name)] }));
}
// Which beasts a piece of text names. "The Unnamed" must be capitalised: "unnamed graves" is not the beast.
function beastsIn(text, roster) {
  const t = ascii(text);
  return roster.filter((b) => {
    if (b.id === 'unnamed') return /\b[Tt]he Unnamed\b/.test(t);
    // "rustling" is also an English word: only the beast's capital, or its plural, counts
    if (b.id === 'rustling') return /\bRustlings?\b|\brustlings\b/.test(t);
    return b.words.some((w) => new RegExp('(^|[^A-Za-z-])' + esc(w) + '(?=$|[^A-Za-z-])', 'i').test(t));
  }).map((b) => b.id);
}
function peopleIn(text, roster) {
  const t = ascii(text).replace(/\*/g, '');
  // a one-word name ("Kett") must stand alone, not be part of a longer name ("Neris Kett") or a word ("Ash-moth")
  const hit = (n) => / /.test(n)
    ? new RegExp('(^|[^A-Za-z])' + esc(n) + '(?=$|[^A-Za-z])').test(t)
    : new RegExp('(?<![A-Za-z-])(?<![A-Z][a-z]+ )' + esc(n) + "(?=$|[^A-Za-z-])(?! [A-Z][a-z])").test(t);
  return roster.filter((p) => hit(p.name) || (/ and /.test(p.name) && hit(p.name.split(' and ')[0]))).map((p) => p.name);
}

// The canon checks every generated data file runs (docs/pipeline.md, "Canon checks"). A word check catches only
// the plain phrasings; the owner still rules. Returns a list of faults, empty when the text passes.
const SHUT = [
  // the three shut questions: who made the Vaults, what the orks fled, why the Unnamed rise
  /\bthe (deep-seam )?vaults were (made|built|cut|dug) by\b/i, /(?<!who |whoever |what )\b(made|built|cut) the (deep-seam )?vaults\b/i,
  /\bthe orks fled (from )?(the|a|an) (?!thing|something)\w+/i, /\bwhat the orks fled (is|was)\b/i,
  /\bthe unnamed rise (because|when they)\b/i, /\bwhy the unnamed rise (is|was)\b/i,
];
function canonFaults(text) {
  const t = String(text), out = [];
  if (!isAscii(t)) out.push('not plain ASCII');
  if (/\bprophec(y|ies)\b|\bprophesied\b|\bchosen one\b|\bfated to\b/i.test(t)) out.push('prophecy');
  for (const re of SHUT) if (re.test(t)) out.push('answers a shut question: ' + re);
  return out;
}

module.exports = { canonFaults, SHUT,  ROOT, LORE, ascii, isAscii, norm, names, esc, rel, readLines, readDoc, paragraphAt, paragraphs, sections, tables, people, beasts, beastsIn, peopleIn };
