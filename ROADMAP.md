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
- `js/dread.js`: its dread value and stalker, written for that game's songs. Off by default. *(Held off, and its row
  removed from Options, in Phase 9.)*
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
  not read that yet. *(Done in Phase 8.)*
- The view is not gated ("no prompt until every player has looked at the Citadel"). O11 rules what a look is:
  the Slagcrown near the middle of the view for about two seconds, added up, for each player.
- No walking bloom in the hollow. No carry. No Account. No title card at the look back.
- The player is alone on the ledge unless a second joins; the default pair's carter is a person
  standing there, not a second player's body.
- **Fixed 2026-11-19:** the Shattered Octave's opening film (`js/cinematic24.js`, its catechism and its fly-over)
  still played after Begin, before this game's five lines. The tests skipped past it, so nothing saw it. `begin()` now
  turns it off, Options no longer shows its switch or its replay, and `test/ledge1.test.js` checks both.

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

### Proposed in Phase 4: **approved 2026-11-19 (O10)**

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
- What sleet does to a torch and to the shelter fire. There is no torch yet (the lantern came in Phase 7). Some of the bible's sleet
  banners speak of the torch anyway.
- Spore clouds, which sleet clears, do not exist yet.
- Nobody has listened to the hiss outside or the roof rattle inside: the tests run without sound.
- Under sleet the light dims only a little. By day the land measured 46.1 against 47.5 dry, on a coin day when the sun
  is already behind the ash.
- The weather is per player: co-op does not share it.
- Frame cost on a real graphics card is not measured. The pass is one full-screen triangle, as the engine's own rain is.

### Proposed in Phase 6: **approved 2026-11-19 (O10)**

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
- The roadmap listed light for this phase. The hearth is still the room's one light, unchanged; light as a supply came
  in Phase 7.

### Proposed in Phase 5: **approved 2026-11-19 (O10)**

| # | Invented | Note |
| --- | --- | --- |
| P43 | The door has a bar: heavy timber, iron at both ends, on two hooks. Dropping it makes a little noise | The bible says only "a door that holds" |
| P44 | Barred, the bloom leans on the door once and waits about twenty seconds off it; not barred, it follows you in | |
| P45 | The knock comes only the first time, with you inside; after that it leans in silence | Rule of dread 7: one knock, once |
| P46 | Marget Sayle: "Put the bar across. They come to a door." and, after the knock, "It will go. They do not stay where it is quiet." | |
| P47 | A barred door is barred to a partner outside too: "The door is barred from inside." | Rule of dread 8: your partners are the uncertainty |
| P48 | Indoors the bloom hunts as it does outside: a still player is not found, and it goes back out the way it came | |
| P49 | The bar's words: "A bar of heavy timber, iron at both ends, leaning by the door. It goes across the door on two hooks."; "You drop the bar across the door. It sits in its hooks with a sound like a dropped plank."; "Something leans on the door from outside, once. The bar takes it." | |

## Phase 7 - the lantern

`js/lantern7.js` · `test/lantern7.test.js` · `tools/lanternshots.js` · stills 70 to 77 and clip 78 in `docs/screenshots/`

The lantern as the one light, in the left hand, with a supply. What the bible gives is used as it stands: "Yours is
tallow yellow and small"; "Whoever holds the lantern cannot hold a shield"; light "shows you to everything that sees,
while doing nothing about what hears"; the weather's torch-burn column (ashfall x1.0, sleet x1.8); a light "dims as it
runs low and gutters out"; the Flask of Lamp Oil "fills a lantern" and is kept "from the torch"; a night costs "oil for
one lamp, dusk to dawn".

- **In the left hand.** An iron lantern with horn panes, held up by its ring, drawn at the left of the view as the
  sword is at the right, painted in code. Unlit it is a dark thing you carry. Lit, the horn glows and the fist above it
  takes the light. The arm leaves through the picture's bottom edge.
- **Its light.** Tallow yellow (255, 168, 40), yellower than the hearth's red. It is a pool 4.2 cells round, centred a
  little ahead and to your left. It warms the ground, the walls and anyone in it. Indoors, where the fire is lit, it adds
  about a fifth as much. By day out of doors it adds nothing.
- **U lights it and douses it** (the engine's own key). Lit, it tells you how full it is in words: "You light the
  lantern. It is about half full."
- **Its oil.** One filling burns dusk to dawn in ashfall: 1080 s, half the 2160 s day. Sleet spends it 1.8 times as
  fast, so a full lantern lasts 600 s out in it. Under a roof the weather spends nothing extra. Over its last fifth the
  flame and the pool shrink. At 12% you are told it is burning low. Its last half minute it gutters. Then it goes out,
  and dry it will not light.
- **The supply.** You come to the ledge with it half full. Marget Sayle keeps two flasks of lamp oil in the bothy's
  corner. Use them and one flask fills the lantern. Not while it burns: "Douse the lantern first. Oil is not poured
  near a flame." The first time, she says one thing. The corner shows two flasks, then one, then the wax drips where
  they stood.
- **What it costs.** Lit out of doors after dark, it shows you. The walking bloom sees you standing still as well as
  moving, and half as far again: 12 m instead of 8. Sleet still shortens that. It does nothing about what it hears.
- **One Options switch, "Your lantern".** Off, everything is as it was before this phase: no picture in the left hand,
  no oil spent, no flasks, and U gives the engine's own lantern. The test checks off by frame hash, scene and HUD.
- **Two earlier files changed with it.** `js/bloom4.js`: the bloom's `sees()` takes a sixth argument, `lit`, set
  through `BLOOM4.setLight`. With nothing set it is unchanged. And the 3D renderer shades your own body (the sword arm,
  `js/body21.js`, pass `body`) at a point 0.3 cells in front of your eye, which is where the lantern is. At full
  strength it burned the sword arm white. So for that one pass the lantern's colour in the lights buffer is turned
  down to 16% (`LANTERN7`'s `bodyPass`, a wrap through `R3D.getPass('body')`). No engine file was edited.

**Checked by the tests:** the bible's numbers in the rules; a full lantern lasts 1080 s dry and 600 s in sleet; the
low warning once; the flame shrinking and guttering, the same every time; a flask refused near a flame, into a full
lantern, and when there is none; the colour is tallow and not the hearth's; the bloom sees a lit lantern still at 7 m
and moving at 11 m, not at 13; the arm leaves the picture's bottom edge. In a browser:
- U lights it with this game's words, douses it, and will not light it dry.
- Its light is tallow and in your hand, and nothing by day.
- Looking down, it warms the ground at your feet (red up, blue barely).
- The left hand shows it, its horn glowing only when lit.
- It warms the sword arm without burning it white.
- It burns its oil and goes out.
- Ten seconds burn 1.8 times the oil in sleet, and no extra under the bothy's roof.
- Marget Sayle's flasks: refused while lit, then fill it, then full, then none.
- Standing still 10 m in front of the bloom at night: unseen in the dark, seen with the lantern lit.
- Switched off: the engine's lantern, no oil spent, no flasks, and the frame is exact.
- There are no page errors.

**Not done:**
- There is no shield yet, so "whoever holds the lantern cannot hold a shield" has nothing to bite on. The left hand
  holds the lantern always.
- There is no torch, no cold-light working and no ash-moths. The bestiary's "a shuttered lantern draws fewer than an
  open torch" waits for both.
- Co-op: the second player's lantern is not drawn, does not light the world for the first, and its oil is not shared.
  The bible's "their light reveals for everyone near them" is not built.
- The oil runs out for good: two flasks and no trade. That needs the road and the Skerries' oil.
- The lantern does not swing as you walk; it bobs with the sword.
- Lighting it makes no sound, and nobody has heard the flame.
- The CPU raycaster (the 3D renderer off) shows the engine's lantern pool and this game's picture, but no test or
  still covers it.
- Its frame cost on a real graphics card is not measured. It adds one light to the engine's list, one small picture to
  the HUD, and one 12-byte buffer write before and after the body pass.

### Proposed in Phase 7: **approved 2026-11-19 (O10)**

| # | Invented | Note |
| --- | --- | --- |
| P55 | The lantern is iron with horn panes, held up by its ring in the left hand, and you carry it from the start | The bible gives the left hand's choices, not the lantern's make |
| P56 | One filling burns dusk to dawn in ashfall (1080 s) | The bible's price of a night, "oil for one lamp, dusk to dawn", read as the lantern's capacity |
| P57 | The weather's torch-burn column spends the lantern too: sleet x1.8; a roof shelters it | The bible gives the column for the Pitch Torch only |
| P58 | You come to the ledge with it half full | |
| P59 | Marget Sayle keeps two flasks of lamp oil; one fills the lantern; not while it burns | "The Watchhouse has two lanterns and seldom the oil for both" |
| P60 | It shrinks over its last fifth, warns at 12%, and gutters its last half minute | The bible: "it dims as it runs low and gutters out" |
| P61 | Its light: tallow (255, 168, 40), 4.2 cells round, a fifth as much indoors, nothing by day | "Yours is tallow yellow and small" |
| P62 | Lit out of doors after dark, the walking bloom sees you standing still, and at 12 m instead of 8 | "Light also shows you to everything that sees" |
| P63 | The words: "You light the lantern. It is about half full.", "The lantern is burning low.", "The lantern gutters and goes out.", "Douse the lantern first. Oil is not poured near a flame.", and Marget Sayle's "That oil came up the road on somebody's back. Burn it where it counts." | |
| P64 | U lights and douses it (the engine's own lantern key) | |

## Phase 8 - the highland edge builds its own way

`js/building8.js` · `test/building8.test.js` · `tools/buildshots.js` · stills 80 to 86 and clip 87 in `docs/screenshots/`

P16, approved, says how the highland edge builds: "field stone laid dry, under turf and heather; one low room, one door,
no window on the weather side". Until now the roof planner did not read it. The bothy's roof came from the Octave's
timber-house planner: gabled thatch, a window with shutters on every side and an attic window in each gable (still 80).
What else the bible gives is used as it stands. The door line, approved in Phase 1: "Smoke at the hole in the roof."
The weather: "The ash comes on the wind, mostly from the north", so the north wall is the weather side. And "Thatch rots
under a crust of wet ash in a season; slate and stone hold."

- **The roof.** Turf and heather, hipped all round, cut short at the wall heads, and low. The ridge is no more than 2.1
  above the ground (the timber planner allowed 2.2). The turf is a tile painted in code: peat-dark sod, heather in
  clumps, dead grass, a crust of grey ash in the hollows, and frost.
- **The hole in the roof.** There is no chimney. A rim of turf on the ridge goes round a black hole, and the fire's smoke
  comes out of it, leaning away from the north wind. It is the engine's own smoke (`js/firesmoke.js`), put out through
  its `spawn()`. Its jitter is a hash of a counter, not a dice roll.
- **One window, on the lee side.** There is nothing in the north wall, no attic windows, no shutters and no stone footing.
  One small window sits in the south wall beside the door, lit by the fire after dusk. Inside, the same window is in the
  same wall: a deep opening on the night, with a long lintel stone.
- **The stone.** The walls, outside and in, are laid in the owner's own highland drystone from the look test
  (`tools/look/highland-materials.js`, merged in #41): irregular fieldstone masses instead of Phase 1's courses. The
  painter is carried into `js/building8.js`, and the test checks all 4096 pixels against the look test's.
- **One Options switch, "Highland building".** Off, everything is as it was: the timber planner's thatch roof and its
  five windows, Phase 1's coursed stone, no hole, no smoke. The test checks off by frame hash against a frame with this
  phase taken out.
- **How it reaches the planner.** `EAVES78.STYLES.la_ledge` gets its own `plan`, as the Octave's regions do. It runs the
  timber planner under Phase 1's style row (kept as `la_ledge_timber`) and builds what that finds the highland way.
  The plan is cached against the map's cells array, so the switch hands the planner a copy of that array to make it look
  again. No engine file was edited.

**Checked by the tests:** the bible's lines it rests on; the stone pixel for pixel; the turf tiles without a seam, is
dark, and has sod, heather, grass, ash and frost in it; the inside window is a dark opening in the same stone. In a
browser:
- The bothy is hipped, turfed and low, with eaves cut short.
- It has one window, on the south, lit, and beside the one door; none on the north and none in the roof.
- It has no footing and no dormers.
- The hole is on the ridge.
- Sleet still stops at the new roof, at its own height, over all twelve cells.
- The stone is in place outside and in, with the window in the bothy's south wall.
- Smoke comes out of the hole and rises.
- Switched off, it is the old plan and stone, with no smoke, and the frame is exact.
- Switched on, outside and inside both change.
- There are no page errors.

**Not done:**
- Only the bothy: it is the highland edge's one building. The next region's buildings will need their own row and rules.
- The walls stay a full cell high. "One low room" is the roof's lowness and the single room, not lower walls.
- The look test's other materials (rock, frost, flagstones, planks) are not installed. They are not building style, and
  each needs its own look before and after.
- The smoke does not lean with the weather's spells (it always leans south), and the classic renderer shows no hole and
  no turf, only the old boxes, as it does for every eaves roof.
- Already there before this phase: by the hearth, the 3D renderer lights the sword arm a saturated orange (stills 85 and
  86 both show it). The lantern's fix in Phase 7 covers only the lantern. The hearth's light on the body pass needs the
  same treatment, in its own small change.
- Frame cost on a real card is not measured. The hole adds 18 triangles to the map's static mesh; the smoke adds about
  one puff a second to the engine's particles while you are within 22 cells.

### Proposed in Phase 8: **approved 2026-11-19 (O10)**

| # | Invented | Note |
| --- | --- | --- |
| P65 | The highland roof is hipped all round, cut short at the wall heads, its ridge no more than 2.1 above the ground | P16 says turf and heather, not the shape |
| P66 | The turf: peat-dark sod, heather in clumps, dead grass, a crust of ash in the hollows, frost | |
| P67 | No chimney: a rim of turf round a hole on the ridge, and the smoke out of it leaning south | From "Smoke at the hole in the roof" |
| P68 | One small window, in the south wall beside the door, unshuttered and glazed; the same window inside | P16 forbids a window on the weather side only |
| P69 | The weather side of a highland house is north | From "The ash comes on the wind, mostly from the north" |
| P70 | The owner's highland drystone replaces Phase 1's coursed drystone, outside and in | The look test's own candidate mapping, "drystone -> t_house_la_drystone" |

## Phase 9 - dread

`js/dread9.js` · `test/dread9.test.js` · `tools/dreadshots.js` · stills 90 to 96 and clip 97 in `docs/screenshots/`

The design asks for "dread as a value that changes the picture". The build brief's own section 3 is not in this
repository or in any saved chat I could reach, so this is built on what the repository does say:
- On the Ground, the dread comes from "light, noise, weight, and what you cannot see".
- The eight rules of dread, first among them "The worst thing is never on screen" and "One knock, once".
- "Black is the base colour".
- "Four lights, never confused. Yours is tallow yellow and small. The land's is ember red and vast. Teal belongs to the
  bloom alone. Pale blue belongs to workings".
- The novel's "the only warmth is people".

The lore gives no number for fear, so every number is mine (P71 to P80).

- **A value you never see as a number.** It runs from 0 to 1.
  - **The dark** raises it, and your lit lantern holds most of the dark off.
  - **The walking bloom** raises it when it is near, and more when it is coming. It counts only where you could know it
    is there: in front of you, or close enough behind you to hear it shuffle. It is not a radar.
  - **Sleet and a bad wound** add a little.
  - **Marget Sayle's roof** takes most of it away, and the bar across her door takes more.
  - **A partner within five cells** lowers it.
  - **How it moves.** It builds in about five seconds and takes about twenty to leave you. A claw sends it up at once,
    once for each claw.
- **The picture.** In the 3D renderer, one pass at order 88, before the lighting's last pass reads the scene.
  - The edges close in toward the base black.
  - The colour drains out of the world: rock, frost, skin and cloth.
  - The four lights keep their colour: tallow, ember, the bloom's teal and a working's pale blue. So does what lies
    within your lantern's reach, and a room's hearth light.
  - The shadows deepen.
  - The far country goes to shapes against the sky, from nearer as dread rises. The sky, which is the painting, stays.
  - At its height the closing breathes slowly. It does not with Reduce motion or No flashes.
  - At nought nothing is drawn at all. Nothing flashes, shakes or lunges, and nothing is shown that is not there.
- **The Shattered Octave's own dread is held off here.** `js/dread.js` gave that game's songs a Dissonance, a stalker
  and whispers. It was off by default, but its "Dread" row was still in Options. The row is removed and the module is
  held off.
  - Its saved setting is not touched. GitHub Pages serves both games from one site, so they share a browser's storage,
    and saving it here would change the Octave.
  - No engine file was edited.
- **One Options switch, "Dread".** Off, the frame is exactly the frame before this phase. The test checks this by frame
  hash.

**Checked by the tests:** what raises dread and what does not; that the bloom behind you and out of hearing adds
nothing; what lowers it; that it rises quicker than it falls; that a claw sends it up once; that the picture's measures
are nothing at nought and grow with it; and the four lights, with a twin of the shader's rule run in Node. In a browser:
- The Octave's dread is off and its row is gone, and this game's row is there.
- Standing out at night with no light, dread builds of itself to 0.40, and in daylight it slowly lets go.
- At nought the frame equals both the switch-off frame and the frame with the pass taken out.
- At full dread a corner darkens from 19 to 11 out of 255 while the middle stays readable.
- The world's colour falls by about a sixth, but the burning country keeps its warmth, and so does your lantern's pool.
- In the bothy with the bar across, it leaves you.
- There are no page errors.

**Not done:**
- **Only the picture.** Dread changes no number in play: not your aim, your pace, nor what hunts you. Sound is not
  touched either: no heartbeat, no dulling of the world's sounds. Either could be a later phase, and each needs a
  ruling.
- **Not every source counts yet.** Noise, weight and the rest of "light, noise, weight" are not inputs. The carry does
  not exist yet, and noise is what the bloom hunts by, so it already counts through the bloom.
- **The classic renderer** draws none of it.
- **Rule 4, "Silence is scheduled"** (the Dead Calm), is not built. When it is, it should raise dread.
- **Frame cost on a real card** is not measured. Under software rendering the pass adds about a millisecond at full
  dread, one full-screen pass and one copy.

### Proposed in Phase 9: [PROPOSED], awaiting a ruling

| # | Invented | Note |
| --- | --- | --- |
| P71 | Night out of doors with no light raises dread to 0.4 of its height; your lantern burning full holds off 65% of that | From "light ... and what you cannot see" |
| P72 | A full spell of sleet out of doors adds 0.1 | Sleet halves how far you see (Phase 6) |
| P73 | The walking bloom adds dread from 14 cells in to 3, at its post up to 0.4, coming at you up to 0.75 | |
| P74 | It counts only in front of you (60 degrees either side) or within 4 cells behind: dread is never a radar | From "The worst thing is never on screen" |
| P75 | A wound past a third of your health adds up to 0.25 | |
| P76 | Under a roof, dread is cut to 0.35 of itself; with the bar across the door, to 0.15; the night and the weather do not count there | From "one safe room" |
| P77 | A partner within 5 cells cuts it to 0.7 of itself | From "the only warmth is people" |
| P78 | It rises at most 0.2 a second and falls at most 0.05; a claw sends it to 0.85 at once, once for each claw | From "Loss is slow" and "One knock, once" |
| P79 | The picture: the colour drains (up to 65%) from all but the four lights, your lantern's reach and a room's hearth; the edges close toward black (up to 80%); the shadows deepen (up to 35%); the far country goes to shapes from 22 cells in to 10 | From "Black is the base colour" and "Four lights, never confused" |
| P80 | At its height the closing breathes, about thirteen times a minute, never with Reduce motion or No flashes | |

## Phase 10 - this game's panel words, credits and creation

`js/panel10.js` · `test/panel10.test.js` · `tools/panelshots.js` · stills 100 to 107 in `docs/screenshots/`

Until now the panel, its keys and the in-game credits were still the Shattered Octave's: CHAR, INV, SONG, NAMES and
MURMUR, "Lv 1 · 12 sov.", a Voice bar, and the Octave's music, voices and paintings in the credits. And Begin dropped
you on the ledge without asking who you are.

What the lore gives, all searched first:
- The design's *The company*: "There are no classes." "Backgrounds. The eight from Ashen Wilds carry over unchanged."
  The default pair is "an old Watch deserter with a glim-marked blade, and a young causeway carter", sent north by
  Gytha Marrin.
- `godot-people.md`, part 2: each walk of life, and its card's knack, flaw and kit.
- The atlas: the fen's money is salt.
- `CREDITS.md`: this repository's own sources.

What it does:
- **Who walks north.** Begin asks first. The eight cards quote each walk of life word for word, with its knack and
  flaw. The deserter is first, marked as the one Gytha sent. The cards' own pasts at the Causeway tower are not shown:
  the novel fixes the nine who were there, and O11 rules the ledge's deserter is not one of them.
- **What the choice does now:**
  - It names you on the HUD (P81).
  - It sets your health where the card gives a number: the deserter's old wound 90, the gutter-kin frail 75, the
    carter hardy 120, as shares of the engine's health (P86).
  - It quietens your steps: the gutter-kin's "a third less" is the engine's floor for quiet feet; the chapel cleaner's
    "quieter steps" have no number on the card (P82).
  - It is kept in `G.flags.la_bg`, so a save keeps it.
- **The panel's words** (P84). YOU, PACK, BOOK, MAP, REST, FOLK, HELP, SAVE, LAMP, WEAPON, each in the engine's own box.
  - YOU: your walk of life, knack, flaw and health.
  - PACK: what is in your hands, worn and in the pack, the lantern's oil in words, and your salt.
  - BOOK: the errand, dated "The thaw of S.30, day N".
  - FOLK: Marget Sayle, Gytha Marrin and the carter, in Phase 1's words.
  - HELP: this game's keys.
  - The same keys open them: C, I, L, K, H. Tab, once the song-book, opens the pack. N, once the Murmur, and the LAMP
    button light and douse the lantern. The Octave's songs sing nothing here.
- **The HUD.** Its line reads "The waif · 12 salt": salt, not levels and sovereigns (P85). The song lines are not
  drawn. The third bar, once the Octave's Voice, is the lantern's oil, in tallow.
- **The credits** are this repository's, as `CREDITS.md` has them, and so is their first line. The engine's row no
  longer claims all of `js/`: this repository's phase files have a row of their own. `CREDITS.md` had the same fault (it
  named only fork0, art2 and ledge1 as this repository's) and is fixed.
- **The panels keep the engine's names** (char, inv, log, ledger, help), so pressing C, I, L, K or H again closes them
  as before; Tab closes the pack it opens.
- No engine file was edited. It is not a picture effect, so there is no switch: off would only bring the Octave's
  words back.
- **An earlier phase's test changed.** `test/lantern7.test.js` compares its switched-off frame with the frame drawn with
  its own wrappers taken out. Panel10 wraps the HUD last, so taking lantern7's layer out took this one out too. The test
  now puts this phase's layer back (`PANEL10.wrapHUD`). `test/harness.js` and `tools/shots.js` pick the deserter when
  creation asks.

**Checked by the tests:** each walk of life is the lore's text word for word, and each knack, flaw and kit is its card's;
the health and step numbers; the buttons fit their boxes and do not overlap; the HUD's line and what it drops; no Octave
word and nothing but plain ASCII (the HUD's middle dot aside) in anything this phase writes; the credits. In a browser:
- Begin shows the eight.
- Choosing the gutter-kin names you "The waif", with a quarter less health and the quietest feet.
- The buttons are this game's, and C, I, L, K, H and Tab open this game's panels, with none of the Octave's words.
- N lights the lantern, the LAMP button douses it, and F1 sings nothing.
- The HUD draws salt and the oil bar.
- The credits are this repository's, and the choice is saved.
- There are no page errors.

**Not done:**
- **The kit is still the engine's:** a short sword, throwing knives, a tanner's jerkin, boots and gloves, for every
  walk of life. The cards' kits need the weapons, the targe, the torch and the rags.
- **Most knacks and flaws do nothing yet.** Blocks, carry weight, dodges, stamina, poise, sight, hearing, bleeding,
  bandaging and searching do not exist on this game's maps. The cards say what each will do.
- **The other three things a person is** (a dependant, lungs, a word) are not asked.
- **The carter**, your companion, is not a player you can choose separately, and is not yet in the world as a person.
- **Three panels still carry Octave words:** the map's key (Quest giver, Shop, Boss), the Options line "The deserter,
  level 1", and its "Mod dungeons" row.
- How it reads to a player choosing on a real screen needs a person at the controls.

### Proposed in Phase 10: [PROPOSED], awaiting a ruling

| # | Invented | Note |
| --- | --- | --- |
| P81 | What the HUD calls each: the deserter, the carrier, the cleaner, the cutter, the waif, the hedge-priest, the healer, the causeway carter | From each card's own words |
| P82 | The chapel cleaner's quieter steps are 0.4 quieter, half the gutter-kin's | The card gives no number |
| P83 | Any of the eight may walk north beside the carter; the deserter stays the default | "Gytha Marrin sends two north ... a young carter from the Causeway, and one more" |
| P84 | The panel's names (YOU, PACK, BOOK, FOLK, LAMP), N for the lantern, Tab for the pack, and the help's words | |
| P85 | Salt counted in measures, and the engine's twelve sovereigns at the start become twelve measures | The fen's money is salt |
| P86 | A card's health (on its 100) is a share of the engine's health: 90 is nine tenths | |

## The Tally: phase T0 - read and plan

`tally/docs/design.md` · no code, no test file, nothing the page loads

A sister game, working title **The Tally**: top-down horde survival in the Blackfen in the winter of S.30, built from
the owner's build prompt (version 2, 2026-11-21). Its phases are numbered T0 to T10 so they do not collide with this
game's. T0 is reading and planning only.

- **Written:** `tally/docs/design.md`: what was read, where the prompt and the lore disagree (C1 to C18), how the game
  is put together, the phases, and fourteen questions for the owner.
- **Found:** every person and place the prompt names is in the story folder. Eighteen points where the prompt differs
  from the lore, each with what the build will do; the lore wins unless the owner rules otherwise.
- **Found for the lore itself:** `CANON.md` O6 says Marget Sayle "is called the Receipt-Wife to her face". P6 above, the
  atlas, `people/` and the game's own line (`js/ledge1.js`) all give that name to Gytha Marrin; Marget only hears it
  said. Not changed here. It needs the owner's word.
- **Not done:** the prompt asks for every file in its section 1.1 to be read in full. `the-smothering.md`,
  `act-one-the-outskirts.md` and `acts-two-and-three.md` were searched, not read through; `items-and-texts.md`,
  `godot-people.md`, most of `atlas/` and `people/` were read in part. The design file's first table says which, and
  which phase needs each.
- **Not run:** no suite covers a file this phase adds. Nothing was rendered, because nothing visible changed.

### Proposed for The Tally: [PROPOSED], awaiting a ruling

None of this is built. "The prompt" is the owner's build prompt; a section number in brackets is where it says so.

| # | Invented | Note |
| --- | --- | --- |
| P87 | A sister game in this world and this repository, in `tally/`, with the working title The Tally | "The Tally" is also the Compact's faith. Questions 1 and 2 |
| P88 | Every beast's telegraph is a flat ember-red shape on the ground; every spore cloud is teal; nothing the player makes is either (5) | Question 3 |
| P89 | Embers: tallow-yellow sparks left by kills, worth 1, 5, 25 and 100, are how a run's growth is counted (7.1) | |
| P90 | A run is thirty minutes. At 30:00 the ground thaws and spawns triple for a minute. The book's words *Held.* and *Held, and fell at the thaw*. The phrase "hold the line" (3) | The phrase is not in the story folder |
| P91 | The Order at 20:00: in a cinder-squall the game asks "Did you hear the order?", and a run may leave on the line for those who ran (3.3) | From the deserter's card: "Whether ordered, or before the order, nobody else alive saw" |
| P92 | The Watch Step (a short untouchable step) and being still as an input that silences weapons and noise (4) | |
| P93 | The Watch bill as a weapon that hooks and drags (8) | The bill itself is Merrick Thwaite's, in `people/` |
| P94 | A "fen bow", and Col Wray carrying one (8, 13.2) | Bows are in the lore (Wynn Carrow's; the Remnant's short bow); this name and Col's are not |
| P95 | The bloomery hammer as a weapon thrown out and back (8) | |
| P96 | A hand bell as a weapon, and the condition Rung (6.4, 8) | No hand bell is in the story folder |
| P97 | The hoist chain as a weapon (8) | The Coldbarrow hoist and chain are lore, as the tool that finishes the Weight Gate |
| P98 | New uses for the lore's own things: the Whetstone gives crit; the Coil of Rope gives reach; tallow, the heat-stone and the Wet-Cloth Mask as kit and weapon; return-bread as something a run carries (9) | Return-bread is a Reedwake mooring custom, not a ration. Question 11 |
| P99 | Marks are found only in a hunter's cache; a mark fades after about eight minutes; Dull-voice can sit on a bell (10) | The lore says a mark holds for hours, on a blade |
| P100 | Eleven pairings and their names: Held the Gate, The Counting Passage, The Outside Fire, The Limed Road, The Sling, The Long Draw, The Nailhouse, The Plunder Pile, The Weight, Greystair Heat, The Burning Bank (10) | The Nailhouse and the Burning Bank are places. Question 13 |
| P101 | Workings in play: one known at a time; three teachings a run; each speaking carries 12 m and adds one chill; the ward only at a door, a drain or a gap; cold light taught only by a listener in the north; who teaches kindle and the bound word (11) | Question 7 |
| P102 | The debt: a second choice at a level-up taken on a bound word, which the band who take the name come to collect at 25:00 (19.7) | |
| P103 | Thirteen bell rings inside a minute in the highlands bring a Dead Calm; nothing is shown or said (19.5) | Evidence only, as fact 7 requires |
| P104 | A corpse left unlimed fruits after 20 seconds, at most one new fruiting every 2 seconds in view; the ogre will not feed on fruited ground (19.2) | The lore says "within days"; the ogre's refusal is the bestiary's |
| P105 | What each card's trait and flaw does in this game, and each named person's lever and rule: Merrick's crust at 10:00 and silence at 20:00, Aud's refusal of bells, Alys Cope's refusal to go below ground, and the rest (13) | The cards' quoted lines are unchanged |
| P106 | Old ones: the grey-muzzled goblin, the scarred pack leader and the collared Greymaw are larger and tougher (14.7) | All three are described in the bestiary |
| P107 | Nine stages along the novel's road, each with a rule, a script by the minute and a hunter: the nest under Halwen, the Red Stitch failing, the furnace night, a troll pair in a Dead Calm (15, 17) | Places and beasts are the lore's; the scripts are not |
| P108 | The last stage tells the Seal ending: the billman on the scaffold, the gate, one knock; in co-op one player stays below and gets the line *Held the gate.* (17.9) | A telling of what may have happened. Question 5 |
| P109 | Merrick may walk with the Deserter as an ally (19.10) | Question 6 |
| P110 | The hub: Joan Tallis sells small lasting gains for salt; the Naming Stone takes a name every hundred tags; Gil Rudd's door, where people helped in a run are admitted or refused; Ottor Blewitt's fire shows the winter (18) | Question 4 |
| P111 | Tags returned at the Naming Stone: Name-Tokens in the fen, brass tags from Greystair north (12.1) | The prompt has brass tags everywhere. Question 12 |
| P112 | The Bright Hour: on a clear day, once, 45 seconds of sun (19.9) | From O8's clear noon |
| P113 | A wonder on each stage, and a small gain for standing still to look: the reeds going gold, Kell Tor's tarn lights, the blue light on the listeners' lintels (19.1) | Merrick's "look at that" is the novel's |
| P114 | Modes: endless, weights chosen before a run, one seeded run a day by the day's number (17.11) | |
| P115 | Co-op for one to four with separate builds and shared embers; beasts gain 60% health and 40% numbers a player; a downed player is lifted by another standing still for 4 seconds (23) | Question 9 |
| P116 | The muster book's three lines (the dead, those who held, those who ran) and the run's portrait: the map with every mark left on it (3, 19.3) | |
| P117 | How a reed-jaw behaves in play (14.3) | The atlas's description of it was approved under O10 |
| P118 | Numbers for the conditions (Limed, Rung, Chill at 4% a point) and the stats Noise, Light and Chill (6) | |

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

## Lore: the atlas, the people and the wilds between (2026-11-19)

Not a phase: no code changes. At the owner's request ("lets fix any and all names with nothing behind them", "very
large map", then "update the repo lore so each and every location and character have full entries. I accept all
proposals across the board"):

- `docs/worldbuilding/atlas/`: the atlas's nine tabs, exported from the Claude Doc and approved (O10), including the
  scale tab; thin entries filled out (Darnel Cross, the Old Charcoal Lodge, the Split Kiln, the Bell-Tender's House,
  the Bent Span, the Corpseway, Saint Ebbe's, Saint Leof's, Stakeby, Tavin's road station, Alder Fold, Moss Hythe,
  the Drowned Measures' eight places, the Long Marrow, the Marrow Passes); the ten other ports of the Compact named
  and written up; `9-the-wilds-between.md`, ten new places in the open country.
- `docs/worldbuilding/people/`: a who-is-who of 169 entries, and new full entries for everyone who lacked one.
- The Chart of the Round (an Artifact) redrawn to the scale, with five views.
- **Invented here:** everything marked *(new)* in those files, including new people (the Haskett smiths, Garth Collier
  and Tam, Dowsett Starke and Mattock, the Aske bridge household, Aveline Croft, Ulric Tibb, Jessamy Hesketh, Garrick
  Hollin, Ambrose Fell, Ide Varrow, and the ten ports' named people). The owner's O10 covers them; any can be struck.
- **Not done:** Kell Tor and the edge of the Vaults stay written only to their shut doors, by design. The atlas Claude
  Doc does not yet carry the new entries written here.

## Rulings (2026-11-11 to 2026-11-19)

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
| Everything still proposed: P33 to P70, the warning book, the chart's placements, the atlas and its scale, the novel's N1 to N20 | "I accept all proposals across the board" (2026-11-19). Recorded as O10 on the canon sheet. The owner also asked for a full entry for every person and place; written the same day (`docs/worldbuilding/people/`, `docs/worldbuilding/atlas/`). |
| The open questions: Mara Venn and Harl, Odo's route, the opening view, the dates, the title, Rafe | "lets go with D ... I will go with your recommendations" (2026-11-19). Recorded as O11 on the canon sheet: the faction bible is lost and the Merewick pair are the only ones; the cart came up from the south for the Corpseway; a look is two seconds on the Slagcrown; The Long Account opens at the thaw of S.30; the novel is *Held the Gate*; Rafe is not the ledge deserter. |
| The lore review's two questions: the warning book's entry 30, the Kings' Barrows | "the book does carry his name. keep it as fact" (2026-11-21). Recorded as O12 on the canon sheet: entry 30 carries Rafe Sedley's name; the Unnamed walk at the fifth barrow because its name-stones were carried off. The review's corrections were accepted the same day ("you can merge"; pull request 58). |
| Merging pull requests 44 to 47 | "merge everything please" (2026-11-19). Merged in order, with merge commits. |
| Merging pull requests 38 to 40 | "Merge and proceed." The owner asked Claude to merge them. Each was squashed, so the Octave's pictures stay out of `main`'s history. The old Godot work that was on `main` is kept on `archive/isometric-prototype`. |

## Decisions I still need

The questions of 2026-11-19 were all ruled that evening (O11, below). What is open now:

1. **Phase 9's proposals, P71 to P80** (dread): the numbers, and whether dread should one day change sound or play
   as well as the picture. Stills 90 to 96 and clip 97 show it.
2. **Phase 10's proposals, P81 to P86** (creation and the panel). Stills 100 to 107 show them.
3. **Build the opening look** (O11) when the prologue is next worked on: the Slagcrown held near the middle of each
   player's view for about two seconds, added up, before any prompt. Not built yet.
4. **Google Drive** could not be searched for the faction bible (the connector lacks a permission). If it is there,
   it is read against O11.
5. **The Tally** (a sister game, phase T0): its proposals P87 to P118 above, and the fourteen questions in
   `tally/docs/design.md`, the Receipt-Wife's name among them. No code is written until they are ruled.

Settled on 2026-11-19 by O10: the rules of Phases 4 to 8 (P33 to P70), the chart's placements, and the warning
book of S.30. Settled the same evening by O11: Mara Venn and Harl, Odo Starke's route, the opening view, the dates,
the novel's title, and Rafe Sedley. Settled on 2026-11-21 by O12: the warning book's entry 30 carries Rafe's name, and
the Kings' Barrows' Unnamed are fact.

## Next phases, in order

| Phase | Feature | The brief's line it answers |
| --- | --- | --- |
| 4 | **Built.** The walking bloom hunts by sound on the ledge (O7), modelled | "one thing that hunts by sound" |
| 5 | **Built.** The safe room made real: a door that holds, and what the bloom does at it | "one safe room" |
| 6 | **Built.** Sleet and Ashfall, stopped by the bothy's roof | "rain"; "stop at a shelter height map" |
| 7 | **Built.** The lantern as the one light, in the left hand, with a supply, and what it draws | "one light with a limited supply" |
| 8 | **Built.** The highland edge's building style honoured by the planner (P16, approved) | "every region builds differently" |
| 9 | **Built.** Dread as a value that changes the picture, tuned for this world | section 3 |
| 10 | **Built.** This game's panel words, credits and creation | "There are no classes"; the eight backgrounds |
| 11 | Death and succession | "death means something" |
| 12 | Four players | D7 |

The order is a proposal. Phases 4 to 6 finish the brief's vertical slice.
