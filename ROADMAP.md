# Roadmap - The Long Account

One phase is one feature, one file `js/<feature><phase>.js`, one test file, one entry here and one
pull request. The owner merges. Anything invented is marked **[PROPOSED]** and listed for a ruling.
The owner alone rules on canon (ruled 2026-11-11).

The story folder is `docs/worldbuilding/`. `CANON.md` there is the rule sheet.

## Where the interview's answers are written

The brief asks six questions before any code. The owner answered them over 2026-11-11 by approving
decisions D1 to D14; the answers are in `docs/worldbuilding/the-round-and-the-long-account.md`.

| Question | Answer, and where |
| --- | --- |
| What is the world? | Orlen under the coal sun, and the Slate Sea's other lands. *Part One*; `CANON.md` |
| What went wrong in it? | The Slagcrown broke the Vaults open; the Smothering; the court fled south and burned the harbour. `CANON.md`, `the-smothering.md` |
| What is the player? | One of a small carrying company working for Gytha Marrin. *The company* |
| What hunts them? | Beasts, the bloom, the Unnamed, and people. Sound first. `bestiary.md`; *Enemies*; *Rules of dread* |
| What is death? | Permanent. The player takes the next person on the roster at the hearth. *The company* |
| What should the first hour feel like? | *Prologue: the ledge*, then the walk south. *The feeling: the key art* |

## Phase 0 - the fork

`js/fork0.js` · `test/fork0.test.js`

The engine of *Echoes of the Shattered Octave* (commit `f2b3990`, branch `phase-75-pixel-folk`),
copied in with 93 story and content scripts left behind. `fork0.js` holds 39
do-nothing stand-ins for story hooks the engine still calls. The page, the install manifest and the
title screen name this game. The offline file list is rebuilt for it.

**Not done, and still the Octave's inside the engine.** None of it is reachable on the ledge unless
noted, but all of it ships:

- `js/data.js`: its classes, items, songs, enemies and people. The traveller is built from its
  "Quarry-Hand" class and carries its short sword.
- `js/maps.js`: its map builders. They run once at start and the result is thrown away.
- `js/game.js`: its creation screens (skipped), quest and law logic, logbook wording.
- The panel: CHAR, INV, SONG, LOG, MAP, REST, NAMES, HELP, MURMUR, SAVE, WEAPON, and money in "sov."
  **Seen on screen.**
- `js/dread.js`: its dread value and stalker, written for that game's songs. Off by default.
- The classic raycaster draws the ledge but not the coal sun, the ash or the burning ground.
- The engine asks for about ten of the Octave's pictures and music files that are not here. The
  requests fail quietly. There is no music.
- Options > Full credits still shows the Octave's own credits table (`js/voices.js`). It is wrong
  for this game.
- **All of the Octave's pictures left in Phase 2.** What remains of it is code and wording.
- Co-op joins two players. The design wants up to four (D7).

## Phase 1 - the ledge

`js/ledge1.js` · `test/ledge1.test.js` · stills in `docs/screenshots/`

- Two maps: `la_ledge` (96 x 96, ground heights everywhere) and `la_bothy` (7 x 6).
- Nine tiles painted in code: rock, hoarfrost in two cuts, scorched ground, ember bed, slag-stone,
  bloom, the bothy's dry-stone, and the underside of its turf roof. Two small glowing sprites.
- The land from one function, `landH(x, y)`: the ledge, the shelf, the ramp, the cracked plain, the
  canyon, the hollow, the Slagcrown's rise and nine spoil heaps, the far rim.
- The Slagcrown from one function, `citadelTop(x, y)`: curtain, towers, halls, keep, great tower.
- The coal sun and the ash as two passes of the 3D renderer; burning ground through the mesh hook.
- Three Options switches: the coal sun, ash and embers, burning ground.
- The carter and Marget Sayle, with eight things anyone in the north can be asked about.
- The cliff holds with no wall in front of it. The way down can be walked.

**Checked by the tests:** the shape of the land; the plan of the citadel; that every tile is 64 x 64
and the frost leaves no bare lane to repeat from cell to cell; that nothing rolls dice;
that every line is plain ASCII and every name is in the world bible; in a browser, that the game
opens on the ledge, the edge refuses you at three places, the walk to the door works, the door opens,
Marget answers, each switch changes the frame, and off equals the pass being absent.

**Not checked by anything:** frame cost. The tests run on software rendering, which cannot measure a
millisecond honestly. Feel, sound and how it reads on a real screen need a person.

**Not done in this phase:**

- Nothing hunts. The bothy is marked safe and nothing reads the mark.
- No Sleet, no Ashfall as weather. The engine's rain can be called for on the ledge and is tested
  to draw, but it is not this world's weather yet and is never called for in play.
- The bothy's roof comes from the Octave's timber-house planner with a thatch tile. It has windows
  with shutters. The style table says it should have no window on the weather side; the planner does
  not read that yet.
- The view is not gated ("no prompt until every player has looked at the Citadel").
- No walking bloom in the hollow. No carry. No Account. No title card at the look back.
- The player is alone on the ledge unless a second joins; the default pair's carter is a person
  standing there, not a second player's body.

### [PROPOSED] in Phase 1, for a ruling

Everything below was invented for the build. Nothing here contradicts a written line that I could
find; each was searched for in `docs/worldbuilding/` first.

**Facts and words**

| # | Invented | Where it shows |
| --- | --- | --- |
| P1 | It is "the first week of the thaw" | Opening line |
| P2 | **Six** went through the breach with Ebba Cray. The bible says only that four came back | Marget, on the survey |
| P3 | The carter's father hauled plate out of the Slagcrown before the Breaking, and said the spoil heaps stood round the pitheads "like a crown" | The carter. It gives the Slagcrown's name a reason; the bible gives none |
| P4 | Marget heard that the south is digging under its salt "from a reaver who thought I was deaf". The bible says reavers' talk reached her; the deafness is new | Marget, on the south |
| P5 | Gytha Marrin "takes a receipt from everyone who walks down the Salt Trace, and writes them a line for it" | What anyone says of her |
| P6 | "The Receipt-Wife" is said to Marget's face and she answers "Tell her I am not a receipt" | Marget |
| P7 | Marget "sleeps facing the door" and keeps "a tally of days cut along the edge" of her table | Things read in the bothy |
| P8 | "Do not go down wind of them", of corpse-caps | The bloom's label |
| P9 | The carter was born after the sun went dark and has never seen it otherwise | The carter |
| P10 | Every greeting and every other line spoken on the ledge | `TX` and `people()` in `js/ledge1.js` |

**The place**

| # | Invented | Note |
| --- | --- | --- |
| P11 | The Slagcrown lies due west of the ledge, about sixty cells off, "a day and a half on foot" | The painting fixes the view, not the bearing or the distance |
| P12 | The citadel's plan: a square curtain with four corner towers, gate towers east and west, halls, a keep with four turrets, one great tower and two spires | Built from the painting's silhouette |
| P13 | Nine spoil heaps in a ring round it | See P3 |
| P14 | A canyon runs from under the ledge west toward the Slagcrown | From the painting |
| P15 | The bothy is on a shelf north of the ledge, reached by a ramp. The design says only "under the ledge" | |
| P16 | **How the highland edge builds** (the first row of the regional table): field stone laid dry, under turf and heather; one low room, one door, no window on the weather side | `EAVES78.STYLES.la_ledge` |
| P17 | The sun does not move. It hangs low in the west at every hour; day and night only change how much light there is | The engine's own sun still rises and sets behind it. Is the coal sun fixed, or does it cross the sky? |

**Words for things**

| # | Invented | Note |
| --- | --- | --- |
| P18 | The brief's "rain" is this world's **Sleet**; its "snow" is **Hoarfrost** | The six weathers are canon; the mapping is mine |
| P19 | The traveller is called "The deserter" until creation exists | From the default pair |
| P20 | The weekday is shown as "The thaw" | Stands in until the calendar of *Calendars* is built |

## Phase 2 - our own art

`js/art2.js` · `test/art2.test.js` · `tools/icons.js`, `tools/png.js`

The Octave's pictures are out. `js/assets.js`, which held 2.4 MB of them, is an empty table. What
the game draws is made in code:

- Eight tiles the engine itself falls back on: stone, flagstones, planks, turf, a plank door,
  cobbles, dead grass, black water. The engine's nineteen tile names point at these.
- The carter and Marget Sayle: one front-view painting each, 160 high. The engine's rig measures
  both by itself: the carter with arms and legs that move, Marget as one piece in her gown.
- A banked peat fire in a kerb of stones, a box bed, a board on two stones.
- The deserter's right hand and blade.
- The app icons and the tab icon: the coal sun.
- The two dialogue portraits, cut from the new paintings.

**Engine files changed** (the rule is to wrap, not edit; these three could not be wrapped):
`js/assets.js` emptied; `js/painted-manifest.js` emptied (it listed the Octave's painted files);
`js/pixel3d.js` removed (it fetched the Octave's prop renders). `img/pixel3d/` and
`img/face_*.jpg` are deleted.

**Checked by the tests:** no embedded picture and no picture file that is not this game's; every
tile and figure the right size, dark, small-palette and the same every time; the rig takes both
people; the fist lies where the engine colours a hand; only the fire glows, and only in fire
colours; in a browser, the carter stands, walks and talks as different pictures, and the fire
lights the room.

**Not done in this phase:**

- The paintings are a first pass. They are plain. Whether they are good enough is yours to say.
- One hand only: the right, with the blade. No lantern in the left yet. The engine's other ten
  held-weapon pictures are gone and nothing replaces them; only the sword is carried.
- A second player is drawn as the carter, whoever they are. Co-op was not run.
- The carter has no spear and no shield (the design gives him both).
- Seen from behind, a figure is the engine's guess from the front painting.
- The classic renderer shows the people as flat cards.

### [PROPOSED] in Phase 2, for a ruling

| # | Invented | Note |
| --- | --- | --- |
| P21 | The carter wears a leather coif, a short green-grey mantle, an undyed wool jerkin laced down the front and belted, trousers bound below the knee, boots | The bible gives him no dress |
| P22 | Marget Sayle wears a linen headcloth tied under the chin, a heavy shawl crossed on the chest, a dark wool gown to the ankle and an apron; grey hair; hands held together | The bible gives her age (sixty-two), not her dress |
| P23 | The bothy's fire is an open hearth on the floor in a kerb of stones, with no chimney | Follows the door's own line, "smoke at the hole in the roof" |
| P24 | The glim mark on the deserter's blade is a small sign near the guard: a cross over a stem, pale blue | The design says the blade is glim-marked; the sign's shape is mine |
| P25 | The game's mark is the coal sun: a black disc in a burning ring over a red horizon | Used for the app icons and the tab |
| P26 | The engine's tile names for marble, brass, hedge, moss and the like all draw as this world's stone, grass or water | Nothing on the ledge uses them |

## Rulings (2026-11-11)

| Asked | Ruled |
| --- | --- |
| Which build stands | This one: the Octave's engine, copied. |
| Who rules on canon | The owner alone (D15). |
| When co-op is built | After the first single-player slice (D16). |
| `story/` or `docs/worldbuilding/` | The world bible stays where it is. |
| The Octave's art | It leaves now. Done in Phase 2. |
| Where it is saved and published | The Ashen-Wilds repository only. The Shattered Octave's repository is read, never written. |

## Decisions I still need

1. **Beasts: modelled or painted?** D8 says people are drawn and beasts are modelled. The build
   brief says each creature is one painted front-view picture, and the engine draws creatures that
   way. The two cannot both hold. This must be ruled before Phase 3, because the thing that hunts is
   a beast.
2. **P17:** does the coal sun move across the sky, or hang where it is?
3. **The opening view.** The design says no prompt appears until every player has looked at the
   Citadel. Alone, how long is a look?
4. **One setting only you can change.** The site publishes from `main` by
   `.github/workflows/pages.yml`, but GitHub will refuse until the repository's Settings > Pages >
   Build and deployment > Source is set to "GitHub Actions". I am not able to change that setting.
5. **The pictures are still in this branch's history.** Phase 2 removes them from the files. They
   remain in the earlier commit on the branch. "Squash and merge" keeps them out of `main`. If you
   want them gone from the branch too, say so and I will rewrite it.

## Next phases, in order

| Phase | Feature | The brief's line it answers |
| --- | --- | --- |
| 3 | Something that hunts by sound on the ledge. Which animal is yours to choose: the bestiary gives the walking bloom for the hollow | "one thing that hunts by sound" |
| 4 | The safe room made real: a door that holds, light, and what the hunter does at it | "one safe room" |
| 5 | Sleet and Ashfall, stopped by the bothy's roof | "rain"; "stop at a shelter height map" |
| 6 | The highland edge's building style honoured by the planner (P16) | "every region builds differently" |
| 7 | The lantern as the one light, in the left hand, with a supply, and what it draws | "one light with a limited supply" |
| 8 | Dread as a value that changes the picture, tuned for this world | section 3 |
| 9 | This game's panel words, credits and creation | |
| 10 | Death and succession | "death means something" |
| 11 | Four players | D7 |

The order is a proposal. Phases 3 to 5 finish the brief's vertical slice.
