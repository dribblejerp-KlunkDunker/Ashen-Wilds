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

### Proposed in Phase 1: **approved 2026-11-12 (O6)**, except P17

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
| P17 | ~~The sun does not move.~~ **Not approved.** The owner: "I suppose it should move ... I do want there to be actual sunlight at times". See Phase 3. Original wording: it hangs low in the west at every hour; day and night only change how much light there is | The engine's own sun still rises and sets behind it. Is the coal sun fixed, or does it cross the sky? |

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

### Proposed in Phase 2: **approved 2026-11-12 (O6)**

| # | Invented | Note |
| --- | --- | --- |
| P21 | The carter wears a leather coif, a short green-grey mantle, an undyed wool jerkin laced down the front and belted, trousers bound below the knee, boots | The bible gives him no dress |
| P22 | Marget Sayle wears a linen headcloth tied under the chin, a heavy shawl crossed on the chest, a dark wool gown to the ankle and an apron; grey hair; hands held together | The bible gives her age (sixty-two), not her dress |
| P23 | The bothy's fire is an open hearth on the floor in a kerb of stones, with no chimney | Follows the door's own line, "smoke at the hole in the roof" |
| P24 | The glim mark on the deserter's blade is a small sign near the guard: a cross over a stem, pale blue | The design says the blade is glim-marked; the sign's shape is mine |
| P25 | The game's mark is the coal sun: a black disc in a burning ring over a red horizon | Used for the app icons and the tab |
| P26 | The engine's tile names for marble, brass, hedge, moss and the like all draw as this world's stone, grass or water | Nothing on the ledge uses them |

## Phase 3 - the sun's day

`js/sun3.js` · `test/sun3.test.js` · `tools/sunshots.js` · stills 10 to 17 in `docs/screenshots/`

The owner was unsure whether the coal sun should move, and wanted real sunlight at times. The world
bible already answers it, in three written lines: the sun is "a pale coin behind the ash, a disc you
can look at directly"; "the sun throws a shadow at noon now, on some days"; and "on the worst days
over Orlen the sun is a dark disc with a red edge". So:

- **The sun crosses the sky** on the engine's own arc: up in the east, high in the south at noon,
  down behind the Slagcrown. The engine's shadows fall away from the disc.
- **It has three faces.** A *coal* day: the dark disc with the burning rim, all day, and a gloom at
  noon. A *coin* day: a pale disc behind the pall, flat grey daylight, hardly a shadow. A *clear* day:
  about noon the pall thins, the sun burns through, and things throw shadows.
- **Every dusk and dawn is red.** Near the horizon any sun sinks into the ash and is the coal again.
- **The prologue's day is a coal day**, and it opens with the sun low over the Slagcrown, a little
  before it sets behind the keep.
- One Options switch, "The sun's day". Off: the sun hangs where Phase 1 put it.

`js/ledge1.js` changed with it: the sky's shader learned the two paler faces, the fire along the
horizon now belongs to the land (it stays in the west when the sun is elsewhere), and the hour the
prologue opens at can be set.

**Checked by the tests:** the arc is the engine's; day 0 is a coal day and all three kinds fall in the
first ten; what each face does to the light; the three written lines are in the bible; in a browser,
noon is three different pictures, the land is brightest under the clear sun and dimmest under the
coal, the switch puts the fixed sun back, and indoors nothing changes.

**Not done:** the moon and stars are the engine's and are hidden behind this sky. The six weathers do
not yet change the sun's face (a clear noon in Sleet is still clear). The classic renderer shows none
of it. Day length is the engine's: a day passes in thirty-six minutes.

### Proposed in Phase 3: **approved 2026-11-12 (O8)**

| # | Invented | Note |
| --- | --- | --- |
| P27 | How often: after the first day, of every twenty days about five are coal days, eleven are coin days and four have a clear noon | The bible says "the worst days" and "some days", no numbers |
| P28 | A clear noon lasts from about ten in the morning to half past two | |
| P29 | Which day is which is fixed for ever by the day's number, so a company can learn that the fourth day out is clear | A rule of the brief: nothing visual rolls dice |
| P30 | Every sunset and sunrise shows the coal sun, on every kind of day | It keeps the key painting's view true each evening |
| P31 | The prologue opens at about half past five in the evening, with the sun a little south of due west, low over the Slagcrown | It was a quarter to six, with the sun fixed due west |
| P32 | By daylight the far haze is dun, not red | |

## Phase 4 - the walking bloom

`js/bloom4.js` · `test/bloom4.test.js` · `tools/bloomshots.js`, `tools/bloomgifs.js` · stills 30 to 36 and clips 40 to 43 in `docs/screenshots/`

The owner ruled that the walking bloom hunts on the highland edge (O7) and that it is modelled (O9).
One stands on the shelf by the foot of the ramp, its back to the way down. You must pass behind it
to reach Marget Sayle's door. Its numbers are the bible's own (`the-smothering.md`, `bestiary.md`):
it shambles at 1.9 m/s, slower than you walk; it sees 8 m in a 120 degree cone; it hears a run
within 8 m, scaled by your noise; it claws for 16, with two seconds of choking.

- **It hunts by sound.** It hears through the engine's own noise value. Standing still and walking
  are under its hearing. A run is heard at 8 m, and louder noise from further off. It goes to *where
  the noise was*, not to you. If you have gone quietly since, it reaches an empty place, listens
  there a while, and goes back to its post.
- **What little it sees is movement:** in front of it, within 8 m. Walk where it is looking and it
  follows you.
- **In reach it claws**: it winds up, strikes for 16, and rests before the next strike. The dust sets you
  coughing for two seconds, and coughing is loud, so a clawed player is easy to find again.
- **It cannot follow you in at the bothy's door.** It waits a little way off the door, then goes back.
- **The carter warns you**, once, as you step onto the ramp: walk, do not run.
- **Modelled, and fast.** The look test's body (approved) is built once, each part in the space of one
  of sixteen bones, and the bones are moved on the graphics card each frame. It has the same ink
  outline, banded light, red rim from the land's fire and ground shadow. The look test cost 27 ms a
  frame for two bodies. This costs about 1 to 3 ms more than the flat figure for one body, measured in
  software rendering.
- **One Options switch, "Modelled bodies".** Off, or under the classic renderer, which cannot draw a
  model: a flat painted figure stands in its place. The test checks that off draws exactly what it
  draws with the modelled pass removed.

**Checked by the tests:** the bible's numbers and the rules match. Hearing and sight work as described,
step by step without a browser. It goes to where the noise was. It never steps into a wall or up a
cliff. Its post and waiting place are on the shelf. Its body is whole, every vertex is carried by a
bone, and every triangle faces the right way. In a browser the tests *play* it: walk to the door and
it never turns; run and it hears, comes and claws for 16, and the coughing is loud; go in at the
door and it waits outside, then goes home; it never stands on a blocked cell. The switch is checked by
frame hash. There are no page errors.

**Not done:**
- It cannot be struck or killed. Its 55 health, the wound puff and the death burst are not built.
- It makes no sound.
- Saves do not record it: a loaded game puts it back at its post.
- Co-op does not sync it.
- It is lit by its own light, not the engine's, so its own caps and the bothy's fire do not light the ground around it.
- There is only one.
- The player's health is the engine's (43): three claws kill. Health is Phase 11's business.
- Frame cost on a real graphics card is not measured.

### Proposed in Phase 4: **[PROPOSED], awaiting a ruling**

| # | Invented | Note |
| --- | --- | --- |
| P33 | The hunt's metres are cells of walking: the engine walks you about 2.6 cells a second, so "1.9 m/s, slower than you walk" stays true | The engine's people are 0.62 of a cell tall; by that scale a cell would be 2.8 m and the bloom would be quicker than you |
| P34 | Standing and walking are under its hearing, even close; a run is heard at 8 m; each step louder is heard further | The bible says "a sprint or a swing within 8 m (scaled by your noise)" |
| P35 | It goes to where the noise was, not to where you are; it listens there about seven seconds, then goes back | |
| P36 | It sees only movement | The bible: "a crust so thick over the eyes that it barely sees" |
| P37 | "Two seconds of choking" is two seconds of coughing, and coughing is loud | |
| P38 | Its post: the shelf by the foot of the ramp, its back to the way down, facing out over the drop | Marget Sayle's door is reached by passing behind it |
| P39 | When you go in at the door it waits a little way off it for about twenty seconds, then goes back | Phase 5 makes the safe room real |
| P40 | A wind-up of about 0.7 s before a claw, and a rest of 1.5 s after | |
| P41 | The carter's warning: "Walk. Do not run. There is one on the shelf, and it hears running." | |
| P42 | What the game says of it: "A walking bloom. Caps along its shoulders and its scalp. A crust where the eyes were. It stands and sways."; "The walking bloom. It is going to where the noise was."; "On the shelf, something has turned its head."; "The dust is in your mouth and eyes. You cannot stop coughing." | |

## Phase 6 - sleet and ashfall

`js/weather6.js` · `test/weather6.test.js` · `tools/weathershots.js` · stills 60 to 67 and clip 68 in `docs/screenshots/`

The first two of the Smothering's six weathers, stopped by the bothy's roof. Every number is the bible's
(`the-smothering.md`, section 3, the Godot build's figures, used as they stand). Every banner is the bible's own,
word for word (section 6).

- **Ashfall**, the ordinary weather: grey flakes come down slow and a little sideways, now in the world rather than
  across the view. They fall in three layers at increasing distance, each hidden behind anything nearer, and stop at
  any roof the roof planner has built (`js/eaves78.js`), the bothy's included. Embers still rise from the burning
  country.
- **Sleet** comes in spells of 70 to 130 seconds and blends in over 8.
  - It beats the ash out of the air and puts most of the embers out.
  - The fog closes in to 14/24 of its distance (sight 14 m against 24) and turns a wet grey instead of the land's red.
  - The sun dims a little.
  - You walk at 85%.
  - The walking bloom hears a sound 0.85 as far and sees 14/24 as far. What muffles your footsteps muffles its
    hearing.
  - Indoors you hear it on the roof.
- **When it comes:** fixed by the day's number, like the sun. A clear day stays dry, a coin day has one spell, a coal
  day two. The first comes about two minutes after the prologue opens, at dusk.
- **What you are told:** a cue as a spell begins ("The ash is coming down wet, in clumps."), then one of the bible's
  sleet banners. When it ends you get one of its ashfall banners. Indoors: "Sleet rattles on the roof."
- **One Options switch, "Ashfall and sleet".** Off puts back Phase 1's ash across the view and turns all of the
  weather off, play included. The test checks off by frame hash.
- **The panel names it:** "ashfall", "sleet", or "sleet coming in", where it said "clear" before.
- `js/bloom4.js` changed with it. The weather can now scale the bloom's hearing and sight (`BLOOM4.setSenses`). With
  nothing set, it is unchanged.

**Checked by the tests:** the bible's numbers and the rules; 120 days of spells (lengths, no overlap, dry clear
days); the 8-second blend; every banner is the bible's. In a browser:
- In sleet the weather fills the view.
- Under a roof over everything it draws nothing, and the bothy's roof covers all twelve of its cells.
- The fog closes to 14/24 and turns grey.
- Nothing is drawn inside the bothy.
- You walk at 85% (measured).
- A run 7.4 m from the bloom is heard in ashfall and lost in sleet.
- The cue and a banner come outside; the roof line comes inside.
- Phase 1's "Ash and embers" switch still rules the ash and embers.
- The panel names the weather.
- Switched off, nothing changes in play and the frame is exact.
- There are no page errors.

**Not done:**
- The other four weathers (miasma fog, cinder-squall, hoarfrost, the Dead Calm).
- What sleet does to a torch and to the shelter fire. There is no torch yet (Phase 8). Some of the bible's sleet
  banners speak of the torch anyway.
- Spore clouds, which sleet clears, do not exist yet.
- Nobody has listened to the hiss outside or the roof rattle inside: the tests run without sound.
- Under sleet the light dims only a little. By day the land measured 46.1 against 47.5 dry, on a coin day when the sun
  is already behind the ash.
- The weather is per player: co-op does not share it.
- Frame cost on a real graphics card is not measured. The pass is one full-screen triangle, as the engine's own rain is.

### Proposed in Phase 6: **[PROPOSED], awaiting a ruling**

| # | Invented | Note |
| --- | --- | --- |
| P50 | Sleet comes on coin and coal days only: one spell on a coin day, two on a coal day; a clear day stays dry | The bible gives the cycle as a rhyme, "a rule of thumb, not a calendar" |
| P51 | The first spell comes about two minutes after the prologue opens, at dusk, for about 100 seconds | |
| P52 | The cue before sleet: "The ash is coming down wet, in clumps." | The bible's hook asks for a sensory cue before a change |
| P53 | Indoors: "Sleet rattles on the roof.", and the sound of it, low, on the roof | The bible: sleet is "rattling on roofs" |
| P54 | Sleet puts out most of the rising embers, and turns the fog a wet grey | |

## Phase 5 - the door that holds

`js/door5.js` · `test/door5.test.js` · `tools/doorshots.js` · stills 50 to 52 and clips 53 and 54 in `docs/screenshots/`

The design's work list asks for "a door that holds, and what the hunter does at it". The safe room is only safe if
the bar is across the door.

- **The bar.** A bar of heavy timber leans by the door inside. Use it and it drops across the door, which makes a
  little noise. Use it again and it stands back by the door. A barred door will not open from outside ("The door is
  barred from inside"), and will not open from inside until you lift the bar.
- **The bloom at the door.** If it was coming for you when you went in, it follows you to the door.
  - **Barred:** the door holds. It leans on the door once, waits a while off it, then goes back to its post.
  - **Not barred:** it comes in after you, and the room is as dangerous as the shelf. Move where it can see you and
    it claws. Stand still and it finds nothing: it listens, then goes back out the way it came.
- **One knock, once** (rule of dread 7). The first time it leans on the barred door with you inside, you hear it, you
  are told so, and Marget Sayle says one thing. After that it leans in silence. You never see it at the door.
- **Marget Sayle** tells you, the first time you come in, to put the bar across.
- `js/bloom4.js` changed with it. The bloom can now be on more than one map, go through doors that a later phase
  lists (`BLOOM4.DOORS`), and be lit by a fire indoors. With no doors listed it behaves exactly as Phase 4 made it.
  Phase 4's test now bars the door in its door case, because an open door lets the bloom in.

Nothing here adds a visual effect, so there is no new Options switch. The bar is a painted thing like the table. The
bloom indoors is drawn by Phase 4's pass and covered by its switch, "Modelled bodies".

**Checked by the tests:** the design's lines are in the bible; the bar's place and paintings; the bloom's mind at a
door without a browser. In a browser the tests *play* it:
- Bar the door and it leans once, you are told, Marget speaks, it goes home, and you are not touched.
- The second time, it leans in silence.
- Leave the door open and it comes in and claws you.
- Stand still in the room and it goes back out and home.
- A barred door opens from neither side.
- It never stands in a wall, the table, the bed or Marget Sayle.
- Inside, it is drawn by firelight, modelled or flat.

**Not done:**
- Nothing at the door can be seen: no dust from the lintel, no movement of the bar.
- The knock and the bar make sound through the engine's synthesiser, but nobody has listened to them: the tests run
  without sound.
- Marget Sayle does nothing when the bloom is in the room, and it ignores her.
- The bar is per player: co-op does not share it, or the bloom.
- A save keeps whether the bar is across, but not where the bloom is.
- If you bar it in with you, it stands back from the door and waits; that case is not tested.
- The roadmap listed light for this phase. The hearth is still the room's one light, unchanged; light as a supply is
  Phase 8.

### Proposed in Phase 5: **[PROPOSED], awaiting a ruling**

| # | Invented | Note |
| --- | --- | --- |
| P43 | The door has a bar: heavy timber, iron at both ends, on two hooks. Dropping it makes a little noise | The bible says only "a door that holds" |
| P44 | Barred, the bloom leans on the door once and waits about twenty seconds off it; not barred, it follows you in | |
| P45 | The knock comes only the first time, with you inside; after that it leans in silence | Rule of dread 7: one knock, once |
| P46 | Marget Sayle: "Put the bar across. They come to a door." and, after the knock, "It will go. They do not stay where it is quiet." | |
| P47 | A barred door is barred to a partner outside too: "The door is barred from inside." | Rule of dread 8: your partners are the uncertainty |
| P48 | Indoors the bloom hunts as it does outside: a still player is not found, and it goes back out the way it came | |
| P49 | The bar's words: "A bar of heavy timber, iron at both ends, leaning by the door. It goes across the door on two hooks."; "You drop the bar across the door. It sits in its hooks with a sound like a dropped plank."; "Something leans on the door from outside, once. The bar takes it." | |

## A look test: the beasts, modelled

`tools/look/beasts.js` · `tools/beastshots.js` · stills 20 to 27 in `docs/screenshots/`

The page does not load this file. The walking bloom went into the game in Phase 4; the quarry-troll is still only here. The owner saw the walking bloom and the blind
quarry-troll each painted and each modelled, and ruled: **"ill go with modeled so long as we can make
them look drastically better than they are now."** The painted beasts are deleted. This is the second
pass at the modelled ones.

- **Sculpted, not boxed.** Each body is built from rounded limbs and masses (about 6,000 triangles
  each, where the first had 470), with smooth surfaces.
- **Drawn on in code.** The troll's hide is cracked into plates like dry clay, with lime lying on
  what faces up and slabs of it on the hump. The bloom's dead skin is mottled and veined, crusted
  in patches, with what is left of a shirt; its caps have stems, domes and gills and give light.
- **Inked and banded like the painted people:** a dark outline, a few steps of light with a dither
  between, the land's fire as a red rim along its edge, a shadow on the ground.
- **They move:** the bloom shambles, sways and lolls its head; the troll breathes, shifts its weight
  and turns its head to listen.

**What it is not, yet.** The engine does not know these bodies are there: they cannot be hit,
heard or saved, and they do not hunt. They are lit by this file's own light, not the engine's, so
the bothy's fire and the caps' own glow do not fall on them or on the ground. **They are far too
slow as built:** here, on software rendering, the two together cost about 27 milliseconds a frame,
against a budget of about one. The cause is known (every body is rebuilt in full on every frame)
and so is the cure (build each part once and move it on the graphics card); that is the first job
of the phase that puts the bloom in the game. No test covers this file.

## Rulings (2026-11-11 to 2026-11-14)

| Asked | Ruled |
| --- | --- |
| Which build stands | This one: the Octave's engine, copied. |
| Who rules on canon | The owner alone (D15). |
| When co-op is built | After the first single-player slice (D16). |
| `story/` or `docs/worldbuilding/` | The world bible stays where it is. |
| The Octave's art | It leaves now. Done in Phase 2. |
| Where it is saved and published | The Ashen-Wilds repository only. The Shattered Octave's repository is read, never written. |
| Everything proposed (P1 to P26) | Approved, except P17. Recorded as O6 on the canon sheet. |
| What hunts on the ledge | The walking bloom (O7). |
| Does the coal sun move | "I suppose it should move", with real sunlight at times. Built as Phase 3 from three written lines of the bible; P27 to P32 await a ruling. |
| Pages | The owner has set the source to GitHub Actions. It publishes when `main` receives the game. |
| Beasts: modelled or painted | **Modelled** (D8 stands), "so long as we can make them look drastically better". The walking bloom is modelled too. The painted beasts are deleted; the second pass at the models awaits the owner's eye. |
| The sun's day (P27 to P32) | "Yes the days are perfect." Approved; recorded as O8 on the canon sheet. |
| The second pass at the modelled beasts | "Thank you lets proceed." Taken as approval; the walking bloom went into the game as Phase 4. |
| Merging pull requests 38 to 40 | "Merge and proceed." The owner asked Claude to merge them. Each was squashed, so the Octave's pictures stay out of `main`'s history. The old Godot work that was on `main` is kept on `archive/isometric-prototype`. |

## Decisions I still need

1. **The walking bloom's rules, P33 to P42,** **the door's, P43 to P49,** and **the weather's, P50 to P54.** Clips 41 to 43,
   53 to 54 and 68 show them played.
2. **The opening view.** The design says no prompt appears until every player has looked at the
   Citadel. Alone, how long is a look?
3. **The world map's placements.** The chart of the Round (an Artifact, not in this repository) marks every place
   whose spot I chose. Say which stand, and it can come into the repository with them.

## Next phases, in order

| Phase | Feature | The brief's line it answers |
| --- | --- | --- |
| 4 | **Built.** The walking bloom hunts by sound on the ledge (O7), modelled | "one thing that hunts by sound" |
| 5 | **Built.** The safe room made real: a door that holds, and what the bloom does at it | "one safe room" |
| 6 | **Built.** Sleet and Ashfall, stopped by the bothy's roof | "rain"; "stop at a shelter height map" |
| 7 | The highland edge's building style honoured by the planner (P16, approved) | "every region builds differently" |
| 8 | The lantern as the one light, in the left hand, with a supply, and what it draws | "one light with a limited supply" |
| 9 | Dread as a value that changes the picture, tuned for this world | section 3 |
| 10 | This game's panel words, credits and creation | |
| 11 | Death and succession | "death means something" |
| 12 | Four players | D7 |

The order is a proposal. Phases 4 to 6 finish the brief's vertical slice.
