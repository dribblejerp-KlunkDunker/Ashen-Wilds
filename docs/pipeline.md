# The lore pipeline

Written 2026-11-24 (overnight run 4). **Status: approved (O18, 2026-11-24), with one slice built.** Nothing in the game
loads any of this yet. Every rule, file name and shape below was [PROPOSED] and is approved; the decisions and their
rulings are at the end and in `ROADMAP.md` ("The lore pipeline, for a ruling").

**The aim.** Adding a place, a person, a quest or an enemy should be mostly writing and ruling: the owner writes or
approves the lore, a tool reads it into data, a test says what is missing or wrong, and the engine work is done once
per *kind* of thing, not once per thing.

**The model already in the repository** is Phase 16's warning book. `tools/book.js` reads
`docs/worldbuilding/the-warning-book-s30.md` (one `### N. Title` heading and one fenced block an entry) and writes
`js/book16.js`. `--check` fails CI when the generated file has drifted from the Markdown. Nobody edits `book16.js` by
hand, and changing an entry is changing the Markdown. The pipeline is that same pattern, made general.

## 1. The sources of truth

The owner's lore stays exactly as it is: prose in `docs/worldbuilding/`. The pipeline reads the conventions the lore
already keeps and writes nothing into it.

| Kind | Source of truth | What a reader can rely on in it |
|---|---|---|
| Places | `docs/worldbuilding/atlas/2-` to `9-*.md` (approved, O10) | One `##` or `###` heading an entry; an italic line under the name (*kind, scale, held by, danger, source*, between middle dots); bold section labels (**At a glance.**, **Layout.**, **Who is here.**, **Dangers.**, **Finds.**, **Hooks.**); numbered layout items with bold names |
| Distances and positions | `atlas/1-scale-and-distances.md` | Stage tables ("Miles from the Watchhouse"), the scarp table, the walk south; `9-the-wilds-between.md`'s (x, y) miles from the Watchhouse door |
| Zones | `atlas/10-zones.md` (run 2; approved as O16) | `## Zn. Title`; tables "Places on the grid" (#, Place, x, y, Kind) and "Ways" (polylines); `tools/zones.js` already reads them |
| People | `docs/worldbuilding/people/README.md` (the 169-row roster) and the six `people/*.md` files | The roster's Name, Who, Where, State, Full entry; each entry's `###` name, italic line and **Who.**, **Looks.**, **Carries.**, **Find them.**, **Hooks.** |
| Enemies | `docs/worldbuilding/bestiary.md` | The "At a glance" table (seventeen rows: tier, height, weight, senses, ground, status); one `##` an entry with fixed `###` parts (Measures, Senses, Habitat and lair, For the game) |
| Items and texts | `docs/worldbuilding/items-and-texts.md` | One `###` an item; its price line |
| Acts, scenes, side arcs, endings | `docs/worldbuilding/the-round-and-the-long-account.md`, "Prologue" to "The endings" | `### Act I: ...`, an italic line with the time and the question, numbered scenes with bold names, the courts table, the side-arc list |
| Workings and marks | the same file, "Small magic" and "Workings and marks in play" | The tables Phases 30 and 31 were built from |
| The warning book | `the-warning-book-s30.md` | As now (`tools/book.js`) |
| The canon itself | `docs/worldbuilding/CANON.md` | The rulings (O1 to O15), the hard facts, the name register, the open questions |

**What the lore does not give, and never will**: the game's own numbers (a beast's health, a road's food cost, a
scene's exact line before the owner rules on it). Those go in **game sheets**, not in the lore (section 2).

## 2. Where each kind lives

Three layers, each with one owner:

1. **Lore** (`docs/worldbuilding/`): the owner's. Prose and tables. The pipeline reads it and never writes it.
2. **Game sheets** (`docs/game/<kind>.md`, none written yet): the game's numbers and lines that the lore does not
   give, one Markdown table a kind, one row a thing, keyed by the thing's id. Every row has a `status` column: a
   ruling id (`O16`) once the owner has ruled, or `[PROPOSED]` until then, and every `[PROPOSED]` row is listed in
   `ROADMAP.md`. Claude writes these; the owner rules on them. Markdown tables, not YAML front-matter: the repository
   has no packages, `tools/lore/lib.js` already reads tables with their line numbers, and a table is easy to review in
   a pull request.
3. **Generated data** (`docs/data/<kind>.json`): written only by `tools/lore/<kind>.js --write`, checked in so a
   pull request shows exactly what changed, and checked by `--check` in CI. When the game starts loading a kind, the
   same tool also writes `js/data/<kind>.js` (`const LORE_PLACES = {...}`), a plain script the page loads in order
   and `sw.js` caches, as `js/book16.js` is. The page never fetches JSON: `index.html` loads scripts in order with
   no build step, and a script works offline from the first visit.

**Why not front-matter in the lore files?** It would mean writing into the owner's files, and the lore's prose
conventions are already regular enough to read (the slice below finds all 133 places without one added line).

### The data shapes

Every record has an `id` (its name in lower case with underscores, no leading "the": `wayfarers_watchhouse`), its
`name` as the lore spells it in plain ASCII, and a `source` of `{ file, line }` that the tests re-read. Records refer
to each other only by id.

**Place** (`docs/data/places.json`, built):

    { id, name, aka: [..], region, atlasRegion, kind, kindText, held, danger, origin,
      // the entry it is named inside, when it has none of its own
      within,
      // entry | shared entry | region | named in | mentioned in
      found,
      // each with file and line
      positions: [ { along, mile, toMile? } | { from, miles, bearing, x?, y? } ],
      // from atlas/10-zones.md
      zones: [ { zone, x, y, as, label, file, line } ],
      people: [ roster names ], hunts: [ beast ids ],
      source: { file, line, heading, headingLine } }

`kind` is one of the atlas's six kinds (great complex, deep place, spire, city or town, open country, small site),
set only when the line under the name uses that kind's words; otherwise it is null and `kindText` keeps the line's
own words ("Drowned royal ship"). Later: `maps` (the map ids that build it) and `gate` (where a great complex's own
maps are entered).

**Zone** (`docs/data/zones.json`, not built): `{ id: 'z1', title, size: [w, h], maps: [[x, y, w, h]], squeeze,
things: [ { n, label, x, y, kind, place? } ], ways: [ { name, kind, points } ], legs: [ chart leg ids ] }`. Read from
`10-zones.md` after O15 is ruled; `tools/zones.js` keeps drawing the sketches from the same tables.

**Person** (`docs/data/people.json`): `{ id, name, who, where: place id, state, entry: { file, line }, looks,
carries, findThem, hooks, painting? }`. The roster row gives the first five; the full entry gives the rest. A game
sheet `docs/game/people.md` adds what the game needs (morale start, which act they meet in, a painting id).

**Scene** (`docs/data/scenes.json`): `{ id: 'act1.stove', act: 'act1', n, title, question, at: place id, people:
[ids], choices: [ { id, line, status } ], lines: [ { id, text, status } ], next: [scene ids] }`. The bible gives the
scenes, their order, their question and some quoted lines; every other line lives in `docs/game/scenes.md` with its
status. A **quest** is a scene list with an entry and an exit (Act I, a side arc, an ending); there is no separate
quest kind.

**Enemy** (`docs/data/beasts.json`): `{ id, name, tier, height, weight, sight, hearing, smell, ground, status,
entry: { file, line } }` from the bestiary's table, the same seventeen `js/bestiary32.js` has by hand today. The
game sheet `docs/game/beasts.md` adds health, speeds, hearing distances not in the book, and which model draws it.

**Item** (`docs/data/items.json`): `{ id, name, price, kind, entry: { file, line } }` from `items-and-texts.md`;
`docs/game/items.md` adds burden, slot and capacity (today in `js/kit17.js`).

**Chart leg** (`docs/data/chart.json`): `{ id, a: place id, b: place id, miles, days, ground, file, line }` from the
scale tab's stage tables and the walk south, and the zone plan's Chart legs; food and fuel per leg from ZP9's units.

## 3. The loader

When the first kind is wired (not in this pull request), one small file, `js/lore40.js` or whatever phase number it
gets, gives the game one way in:

    // the record, frozen
    LORE.place('wayfarers_watchhouse')
    // filtered lists
    LORE.places({ zone: 'z3' })
    // throws in a test, warns once in play, if the id is unknown
    LORE.ref('person', 'margery_reeve')
    // the plain-ASCII line for the HUD, or null
    LORE.text(id)

It reads only the globals the generated `js/data/*.js` files define, is pure (no clock, no dice), and runs in Node, so
every rule a phase builds on it can be tested without a browser, as `BLOOM4.think` is. Nothing is fetched and
nothing is parsed in the browser.

## 4. Canon checks, run as tests

Each generated kind has `test/lore-<kind>.test.js` (Node only), and one `test/lore-canon.test.js` runs over all of
`docs/data/` and `docs/game/`. The checks, each already in `tools/lore/lib.js` or the places test where marked:

1. **Every fact points at the line that says it** (*built for places*). The test re-reads `file:line` and checks the
   name, the mile or the (x, y) is on it. A stale line number fails.
2. **Every name in a data file exists in the lore or is marked [PROPOSED].** People are checked against the roster,
   beasts against the bestiary, places against the atlas (*built for places*). For game sheets, every capitalised
   name not in a lore index (all headings, bold names, the roster and CANON's name register) must sit in a row whose
   status is `[PROPOSED]`, and every `[PROPOSED]` id must appear in `ROADMAP.md`.
3. **Plain ASCII** in everything the game shows (*built*: `canonFaults`, and the tool folds the lore's few non-ASCII
   characters: the middle dot, the minus sign, curly quotes).
4. **No prophecy, no chosen one** (*built*: a word check).
5. **No answers to the three shut questions** (who made the Vaults, what the orks fled, why the Unnamed rise)
   (*built*: phrase checks that fire on an answer and not on the question; no place may list what the orks fled
   among what hunts there). A word check catches only plain phrasings: the owner still rules on meaning.
6. **O1**: every beast id is a beast; a person is never in `hunts` except the Ashbound, whom the bestiary itself lists.
7. **Current**: every generated file equals what its tool would write now (*built*: `--check`, like
   `tools/pwa/precache.js --check` and `tools/book.js --check`).
8. **The lore is untouched**: tools write only under `docs/data/` and `js/data/`; a test checks their output paths.

## 5. Wiring the phases nothing calls yet

Phases 21, 22, 25, 26, 28, 30, 31 and 33 to 37 are pure tables and state machines (`ROADMAP.md`, "The Flash roadmap,
phases 19 to 37"). The pipeline feeds their tables; their rules stay where they are. Each still needs one engine
hook, listed here so the work is visible.

| Phase | What it holds by hand today | Fed from | The one engine hook it still needs |
|---|---|---|---|
| 21 weather21 | The six skies' sight, sound, spore, ground, torch | `bestiary.md`, "Weather and the bestiary" -> `weather.json`; the [PROPOSED] cells in `docs/game/weather.md` | `WEATHER6` (Phase 6) choosing the sky; already read by `lungs20` and `bloom24` |
| 22 deadcalm22 | Cinder squall and the 90 s Dead Calm | the same sheet | A schedule entry in `WEATHER6`, and the HUD's warning |
| 25 coop25 | Parity rules; no lore table | nothing: rules only | `net19` sending the loudest noise and the shared sighting |
| 26 chart26 | Five nodes, six roads, made-up days | `chart.json` (the atlas's legs: the walk south is 315 miles, 28 days) | A MAP panel and `transfer` between zone maps |
| 28 people28 | `make(name)`; names supplied by the caller | `people.json` (who, where, state) and `docs/game/people.md` | An encounter placed in a zone by the person's place's (x, y); the engine's dialogue panel |
| 30 workings30 | The eight workings' rows | "Small magic" -> `workings.json` | A speak key, and the warmth cost through `chill29` |
| 31 marks31 | The five marks' rows | "Workings and marks in play" -> `marks.json` | A mark on a `kit17` item, renewed at the `hearth27` fire |
| 33 actone33 | Scene ids, titles, choices, lines (most [PROPOSED]) | the bible's Act I -> `scenes.json`; lines in `docs/game/scenes.md` | A scene runner: a scene opens at its place, in the engine's dialogue panel, and records choices in `account14` |
| 34 acttwo34 | Courts, receipt, winter roofs, five legs | Act II -> `scenes.json`, `chart.json` | The same runner; Chart legs by sea |
| 35 sidearcs35 | Five arcs and their outcomes | Act II's side arcs -> `scenes.json` | The same runner |
| 36 actthree36 | Eleven days, actions, wall courses | Act III -> `scenes.json` | The same runner, and a day clock |
| 37 endings37 | Five endings, the last line, credits | "The endings" -> `scenes.json` | The same runner, and the title |

So, after the data: **one scene runner** wires five phases (33 to 37), **one zone-map builder** (a place becomes
entities and a gate at its zone (x, y)) wires places, people and beasts, and **one MAP panel** wires the Chart. Those
three are the engine work; everything after them is writing and ruling.

## 6. The order to build it

Each step is one pull request, and each leaves the game exactly as it was until step 7.

1. **Places** (this pull request): `tools/lore/lib.js`, `tools/lore/places.js`, `docs/data/places.json`,
   `test/lore-places.test.js`, in CI.
2. **People and beasts**: `people.json` from the roster and the entries; `beasts.json` from the bestiary's table,
   and `js/bestiary32.js` generated from it as `js/book16.js` is (its test already pins the seventeen, so the switch is
   checked).
3. **The canon test over everything**: `test/lore-canon.test.js`, with the lore name index.
4. **Items and the chart**: `items.json`; `chart.json` from the atlas's legs. Regenerate `js/chart26.js`'s two
   tables from it (decision LP5 below), keeping its shortest-path rule and its test.
5. **Scenes**: `scenes.json` and `docs/game/scenes.md`. Regenerate the content tables of 33 to 37 from it; their state
   machines and tests stay.
6. **Zones**, once O15 is ruled: `zones.json`, shared parsing with `tools/zones.js`.
7. **The loader and the first wire**: `js/lore<N>.js`, `js/data/*.js` in `index.html` and `sw.js`, and the scene
   runner playing Act I's first scene. This is the first step a player could see; it gets its own phase number, stills
   and switch.
8. Then, in any order: the zone-map builder (one zone first: Z1, which holds the ledge), people placed in zones,
   workings and marks on the HUD.

**What adding a thing costs, once 1 to 7 are done.** A new place: an atlas entry (the owner writes or rules), a row in
its zone's grid, `node tools/lore/places.js --write`; the test names anything missing. A person: a roster row and an
entry. A quest: scenes in the bible and lines in the game sheet. An enemy: a bestiary entry, a game-sheet row, and a
model (the one part that stays engine work, O9).

## 7. The slice built tonight

`node tools/lore/places.js --write` reads the gazetteer's list (`tools/lore/gazetteer.md`, copied from the project
doc `claude/location-gazetteer.md`, which is not in the repository) and finds every one of the **133** places:

- 67 have an entry of their own; 33 share a heading with another place ("Milebank and the Red Stitch"); 3 are a
  whole region file read from its first entry (the Blackfen, the Bell Road, the Drowned Measures); 25 are named in
  bold inside another entry (the Naming Stone, the Long Stable); 5 are only mentioned in passing (Qesh, Marrah, the
  Grass, the Red Country, Marget Sayle's bothy).
- 42 get one of the six kinds from the line under their name; 37 a position in miles; 82 a zone and grid position;
  43 named people; 60 named beasts.
- The ledge and the bothy have no atlas entry: they are read from the game's design document.

`node test/lore-places.test.js` checks all of that against the lore, line by line, and that the JSON is current. The
gazetteer's `aka:` and `at:` notes add no names: the test checks each is the atlas's own words.

**Not done:** no game wiring; no zone, person, beast, item or scene data; no `docs/game/` sheet; no loader. People
and beasts are read by matching roster names and the bestiary's words, so a person the atlas names only by a role
("the warden") is not listed, and beasts outside the seventeen (the hulk-conger, hold-goblins) are not listed. The
Salt Trace's fen stages (Long Wade, the Ferry Stump, the White Trees at 18) are prose, not a table, and are not read.

## 8. Decisions for the owner

All approved as O18 (2026-11-24); the same list is in `ROADMAP.md` as LP1 to LP11. Where one asked a question: LP3 keep
the 133; LP6 leave the kind empty; LP7 add atlas entries for the ledge and the bothy; LP8 two places.

- **LP1** The three layers: lore untouched, game sheets in `docs/game/`, generated data in `docs/data/` (checked in)
  and `js/data/` once loaded.
- **LP2** Game sheets as Markdown tables with a status column, not front-matter in the lore files.
- **LP3** The gazetteer's 133 as the list of places (`tools/lore/gazetteer.md`). The atlas has places the
  gazetteer does not count (the Burning Bank, the Hewers' Road, the Bell-Spire, the King's Sluice, the drowned inns):
  should the list be every atlas heading instead?
- **LP4** Ids: the name in lower case with underscores and no leading "the" (`wayfarers_watchhouse`).
- **LP5** `js/chart26.js`'s five nodes and six roads (1 to 5 days, [PROPOSED]) replaced by the atlas's legs (the
  walk south is 28 days), keeping its rules.
- **LP6** 91 of the 133 have no kind in the atlas's six words (the Scald is a "Venting moor", the Constance a "Drowned
  royal ship"). Leave them null, or rule a kind for each in a game sheet.
- **LP7** The ledge and Marget Sayle's bothy have no atlas entry; their source is the design document. Should the
  atlas get two entries?
- **LP8** "The Bloom Quarters" is one place in the gazetteer, read from Port Sable's Bloom Quarter; Marlstow's lower
  town is the other. One place or two?
- **LP9** Beasts outside the bestiary's seventeen (the hulk-conger, hold-goblins) and the Unnamed: list them as
  beasts in data, or only the seventeen?
- **LP10** The Fen Gate stays an open alias of the East Choke Point (as ruled 2026-11-19): the pipeline does not join
  them until the owner does.
- **LP11** The build order in section 6.
