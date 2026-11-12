# Roadmap - The Long Account

One phase is one feature, one file `js/<feature><phase>.js`, one test file, one entry here and one
pull request. The owners merge. Anything invented is marked **[PROPOSED]** and listed for a ruling.

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
copied in with 93 story and content scripts left behind. 85 scripts remain. `fork0.js` holds 39
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
- The hands and the sword. **Seen on screen.**
- The paintings used for the carter and Marget Sayle (`townsman`, `townswoman` in `js/assets.js`).
  **Seen on screen.**
- `js/dread.js`: its dread value and stalker, written for that game's songs. Off by default.
- The app icons in `assets/icons/`.
- The classic raycaster draws the ledge but not the coal sun, the ash or the burning ground.
- The engine asks for about twenty of the Octave's pictures and music files that are not here. The
  requests fail quietly. There is no music.
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

## Decisions I need

1. **The second director.** The brief names two people. I know one. Who is the other, and do both
   rule on canon?
2. **`story/` or `docs/worldbuilding/`?** The brief asks for a `story/` folder. The world bible is
   already at `docs/worldbuilding/` with many links into it. I have treated that as the story
   folder. Say so if you want it moved.
3. **The Octave's art in a public repository.** The engine carries that game's sprites, hands,
   faces and textures (`js/assets.js`, `img/face_*.jpg`, `img/pixel3d/`). The Octave's own credits
   list their origin as unverified. This repository is public. Keep them until replaced, or strip
   what the ledge does not use now?
4. **P17:** does the coal sun move?
5. **The opening view.** The design says no prompt appears until every player has looked at the
   Citadel. Alone, how long is a look?
6. **Publishing.** The Octave is played from GitHub Pages. Should this be? Nothing here turns Pages
   on.

## Next phases, in order

| Phase | Feature | The brief's line it answers |
| --- | --- | --- |
| 2 | Something that hunts by sound on the ledge. Which animal is yours to choose: the bestiary gives the walking bloom for the hollow | "one thing that hunts by sound" |
| 3 | The safe room made real: a door that holds, light, and what the hunter does at it | "one safe room" |
| 4 | Sleet and Ashfall, stopped by the bothy's roof | "rain"; "stop at a shelter height map" |
| 5 | This game's own carter and Marget Sayle, painted in code and rigged | "one person who walks and talks" |
| 6 | The highland edge's building style honoured by the planner (P16) | "every region builds differently" |
| 7 | The lantern as the one light, with a supply, and what it draws | "one light with a limited supply" |
| 8 | Dread as a value that changes the picture, tuned for this world | section 3 |
| 9 | This game's hands, panel words and creation | |
| 10 | Death and succession | "death means something" |
| 11 | Four players | D7 |

The order is a proposal. Phases 2 to 4 finish the brief's vertical slice.
