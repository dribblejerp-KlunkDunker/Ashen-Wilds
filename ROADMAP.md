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
- The carter and Marget Sayle, with eight things anyone in the north can be asked about. Asked about herself,
  Marget answers in her own voice; the north's third-person line is for everyone else (P87).
- The cliff holds with no wall in front of it. The way down can be walked.

**Checked by the tests:** the shape of the land; the plan of the citadel; that every tile is 64 x 64
and the frost leaves no bare lane to repeat from cell to cell; that nothing rolls dice;
that every line is plain ASCII and every name is in the world bible; in a browser, that the game
opens on the ledge, the edge refuses you at three places, the walk to the door works, the door opens,
Marget answers (about herself in her own voice too), every speaker whose name can be asked about answers
for themselves, each switch changes the frame, and off equals the pass being absent.

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
| P87 | **[PROPOSED]** Marget, asked about herself: "That is my name on the door. I came back with the other three and I have been here since. What I saw is mine. Sit down and ask me something else." | Asked about "Marget Sayle" she used the north's third-person line ("She has never said what she saw"), which contradicted her own answer on the survey |

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
within 8 m, scaled by your noise; it claws for 32, with two seconds of choking (P88).

- **It hunts by sound.** It hears through the engine's own noise value. Standing still and walking
  are under its hearing. A run is heard at 8 m, and louder noise from further off. It goes to *where
  the noise was*, not to you. If you have gone quietly since, it reaches an empty place, listens
  there a while, and goes back to its post.
- **What little it sees is movement:** in front of it, within 8 m. Walk where it is looking and it
  follows you.
- **In reach it claws**: it winds up, strikes for 32, and rests before the next strike. The dust sets you
  coughing for two seconds, and coughing is loud, so a clawed player is easy to find again.
- **It cannot follow you in at the bothy's door.** It waits a little way off the door, then goes back.
- **Waking by the lamp sends it back to its post.** The engine's wake (`#btn-wake`, `js/game.js`) puts its own chasers
  back where they started; the bloom is not an engine entity, so `js/bloom4.js` listens to the same button and resets
  itself to its post. Before this, a player it had killed woke at the ledge's spawn with it still hunting, and it
  killed them again before they could move.
- **The carter warns you**, once, as you step onto the ramp: walk, do not run.
- **Modelled, and fast.** The look test's body (approved) is built once, each part in the space of one
  of sixteen bones, and the bones are moved on the graphics card each frame. It has the same ink
  outline, banded light, red rim from the land's fire and ground shadow. The look test cost 27 ms a
  frame for two bodies. This costs about 1 to 3 ms more than the flat figure for one body, measured in
  software rendering.
- **One Options switch, "Modelled bodies".** Off, or under the classic renderer, which cannot draw a
  model: a flat painted figure stands in its place. The test checks that off draws exactly what it
  draws with the modelled pass removed.

**Checked by the tests:** the bible's numbers and the rules agree, the claw's 16 doubled for the cards' 100 scale
(P88). Hearing and sight work as described,
step by step without a browser. It goes to where the noise was. It never steps into a wall or up a
cliff. Its post and waiting place are on the shelf. Its body is whole, every vertex is carried by a
bone, and every triangle faces the right way. In a browser the tests *play* it: walk to the door and
it never turns; run and it hears, comes and claws for 32, and the coughing is loud; go in at the
door and it waits outside, then goes home; it never stands on a blocked cell; die to it and wake by the lamp and it
is back at its post, and twelve seconds later you are still standing. The switch is checked by
frame hash. There are no page errors.

**Not done:**
- It cannot be struck or killed. Its 55 health, the wound puff and the death burst are not built.
- It makes no sound.
- Saves do not record it: a loaded game puts it back at its post.
- Co-op does not sync it.
- It is lit by its own light, not the engine's, so its own caps and the bothy's fire do not light the ground around it.
- There is only one.
- The player's health is the card's (90 for the deserter, Phase 10): three of its claws kill (32 each). A health system of its own is Phase 11's business.
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
| P88 | The claw's 16 is doubled to **32** | The bible's numbers are the Godot game's, on classes of about 43 health; this game's cards are on the 100 scale (P86), so 16 took six blows and the bite lost half its weight. 32 keeps three blows for the deserter, as 43 health died to three. Owner's word, 23 Nov 2026: tune the claw or the health, keeping the cards and the HUD agreeing |
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
- **The doorway answers with the door.** Standing inside the doorway and looking at the door, E opens it and leaves the
  bothy, even when the bar's painting sits on the crosshair (it used to toggle the bar there, so a player could not get
  out from the obvious spot). With the bar across, the first press lifts it and the next leaves. The prompt says the
  same: in the doorway it names the door ("The door. Outside, the shelf..."), and at the edges, where the engine's own
  crosshair missed the door cell and said nothing at all, it names it too. It never named the bar there.
- **The bloom at the door.** If it was coming for you when you went in, it follows you to the door and stands four
  seconds there before it tries it: long enough for a player who has just come in to find and drop the bar. (It used to
  try at once. The test barred the door in the same breath as entering and so always passed; in play the bloom was
  inside before a hand reached the bar, and the knock never fired. Owner's word, 23 Nov 2026: verify it in the browser.)
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
- A player's three seconds to find the bar still bars it in time: the bloom stands at the door before it tries it,
  rather than being inside when the bar falls.
- The second time, it leans in silence.
- Leave the door open and it comes in and claws you.
- Stand still in the room and it goes back out and home.
- A barred door opens from neither side.
- Standing in the doorway, E leaves the bothy; with the bar across, the first press lifts it and the next leaves.
- The doorway's prompt names the door, not the bar, including where the crosshair misses the door cell.
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
| P50 | The bloom stands four seconds at the door before it tries it | A player who has just come in needs longer than the 2.5 s it took to reach the door; in play the bloom was inside before the bar fell, so the knock never fired. Owner's word, 23 Nov 2026: verify the knock in the browser and fix it if it does not [PROPOSED] |

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
  - It sets your health to the card's own figure: the deserter's old wound 90, the gutter-kin frail 75, the carter
    hardy 120, and 100 for a card that gives none (P86). The card, the player and the YOU panel now say the same number.
  - It quietens your steps: the gutter-kin's "a third less" is the engine's floor for quiet feet; the chapel cleaner's
    "quieter steps" have no number on the card (P82).
  - It is kept in `G.flags.la_bg`, so a save keeps it.
  - **An old save is brought up to the card (23 Nov).** `choose()` runs once, at creation; `restoreGame()` puts a
    saved player back exactly as stored. A save written under the earlier share-of-43 reading therefore still carried
    39 for the deserter and 52 for the carter, and the YOU panel's card line and its Health line disagreed on load.
    Loading one now raises a maximum below the card's figure to the card's figure, and scales what is left of the bar
    with it (a full bar stays full, 13 of 39 becomes 30 of 90); a levelled or otherwise higher maximum is never lowered.
  - **Co-op (23 Nov).** A guest's traveller is made on the host by PARTNER19, which knew only the engine's calling health
    (about 43). The guest's card now carries the walk of life they chose, as its id; the host looks that id up in its own
    table and gives the partner the card's health outright, the same reading as the host's own (P86). A guest walking
    as the carter has 120, the gutter-kin 75, the deserter 90; a card with no id, or no figure, is the default card.
    No number is taken from the wire.
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
- **An earlier reading changed (23 Nov).** P86 first made a card's health a share of the engine's 43, which had the
  deserter's card promise 90 health while the YOU panel showed 39 (and the gutter-kin's 75 showed as 32). The owner
  had the card's figure and the HUD agree, so the card's health is now your health outright. Saving under that first
  reading left the old figures in a save, which is why a load has its own reconciliation above.
- **The panels keep the engine's names** (char, inv, log, ledger, help), so pressing C, I, L, K or H again closes them
  as before; Tab closes the pack it opens.
- No engine file was edited. It is not a picture effect, so there is no switch: off would only bring the Octave's
  words back.
- **An earlier phase's test changed.** `test/lantern7.test.js` compares its switched-off frame with the frame drawn with
  its own wrappers taken out. Panel10 wraps the HUD last, so taking lantern7's layer out took this one out too. The test
  now puts this phase's layer back (`PANEL10.wrapHUD`). `test/harness.js` and `tools/shots.js` pick the deserter when
  creation asks.

**Checked by the tests:** each walk of life is the lore's text word for word, and each knack, flaw and kit is its card's;
the health figures on the cards are the health the game gives; the buttons fit their boxes and do not overlap; the HUD's line and what it drops; no Octave
word and nothing but plain ASCII (the HUD's middle dot aside) in anything this phase writes; the credits. In a browser:
- Begin shows the eight.
- Choosing the gutter-kin names you "The waif", with 75 health and the quietest feet; the deserter's 90, the
  gutter-kin's 75 and the carter's 120 are what the YOU panel shows.
- The buttons are this game's, and C, I, L, K, H and Tab open this game's panels, with none of the Octave's words.
- N lights the lantern, the LAMP button douses it, and F1 sings nothing.
- The HUD draws salt and the oil bar.
- An old save's 43-scale health (the carter's 120 stored as 52, the deserter's 90 as 39) is brought up to the card's
  figure on load, and a hurt one keeps its share of the bar.
- The credits are this repository's, and the choice is saved.
- A guest's chosen walk of life is carried to the host, and the partner's health is that card's figure (the carter's
  120, the default deserter's 90), not the engine's 43.
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
| P86 | A card's health is your health outright, on the 100 its cards are written on: 90 is 90, and a card with no figure is 100 | First a share of the engine's 43 (P86 as approved), which made the card promise 90 and the YOU panel show 39; changed 2026-11-23 at the owner's word |

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
3. **The opening look** (O11): built in Phase 11 (`js/opening11.js`). The Slagcrown is held near the middle of the
   view for two seconds, added up, before the errand. The co-op half waits for the two-player phase.
4. **Google Drive** could not be searched for the faction bible (the connector lacks a permission). If it is there,
   it is read against O11.
5. ~~**The zones (O15), ZP1 to ZP30**~~ **Settled by O16** (2026-11-24): all approved, Wexhaven at the standard zone
   size. See *Zones (O15)* below.

Settled on 2026-11-19 by O10: the rules of Phases 4 to 8 (P33 to P70), the chart's placements, and the warning
book of S.30. Settled the same evening by O11: Mara Venn and Harl, Odo Starke's route, the opening view, the dates,
the novel's title, and Rafe Sedley. Settled on 2026-11-21 by O12: the warning book's entry 30 carries Rafe's name, and
the Kings' Barrows' Unnamed are fact.

## The Flash roadmap, phases 11 to 18 (2026-11-23)

The numbered phases below follow the kept Doc *The Long Account - the Flash roadmap*, which supersedes the old
"phase 11 death, phase 12 four players" table. One phase is one file, one test and one entry here. Every phase was
checked with `node test/<name>.test.js --no-browser` and the full no-browser suite was run between phases; the
browser halves skip on this machine because Chromium cannot launch without its system libraries.

| Phase | Feature | Files | State |
| --- | --- | --- | --- |
| 11 | **Built.** The opening look: the Slagcrown held at the middle for two seconds, added up, before the errand | `js/opening11.js`, `test/opening11.test.js` | Pure rule and single-player wire. The co-op "every player" rule is ready (`combine`) but waits for Phase 25. |
| 12 | **Built.** Death and succession: a two-person company, permanent death, the next card at the hearth, the roll, hardcore, the end of the company | `js/company12.js`, `test/company12.test.js` | Pure rules and wire; old saves get a one-person company. Browser half not run here. |
| 13 | **Built.** The carter as a person: follows at 1.2 cells, holds and waits, goes down and bleeds, dies into the roll | `js/carter13.js`, `test/carter13.test.js` | Pure rules and wire. The spear and shield are not yet painted as separate look. |
| 14 | **Built.** The Account: promises, surety and standing apart, the three pages, hearth marking, forsworn, the non-pausing `A` overlay | `js/account14.js`, `test/account14.test.js` | Pure rules and wire; the first promise is Marget's. Browser half not run here. |
| 15 | **Built.** The carry and the title: 0.65 pace, both hands full, no sprint or attack, Marget at the carrier's side, the look back once | `js/carry15.js`, `test/carry15.test.js` | Pure rules and wire. The three carry stills are produced: `134_3d_carry_prompt.png`, `135_3d_carry_walk.png`, `136_3d_the_title.png`. The wire now places her forward and to the camera's side, not under the next step. |
| 16 | **Built.** The warning book: thirty entries exported from the Markdown, read marks, search, the witness field, BOOK as the book | `tools/book.js`, `js/book16.js`, `test/book16.test.js` | Exporter, data and panel. `node tools/book.js --check` is clean. BOOK's list is one two-column scroll with the panel's own search field; stills `131_3d_book.png` and `132_3d_book_entry.png`. |
| 17 | **Built.** Kit, weight and money: the eighteen-row table in salt, the eight kits, burden and capacity, torch fuel, one light, no field healing, no ranged weapon | `js/kit17.js`, `test/kit17.test.js` | The kit replaces the bag, weapon hand and worn slots; burden slows the walk and adds its noise step; the torch sets the one fuel pool and says torch in the panel; old saves rebuild the kit once. The copied inventory's own page still speaks of sovereigns. |
| 18 | **Built.** The eight cards: exact effects, no levels or XP, stamina, bleeding, bandaging, sight, hearing, dodges, sprint, search, quiet pack | `js/cards18.js`, `test/cards18.test.js` | The card sets stamina, fog distance, attack fatigue and pack/step noise; no-level holds. There is no block, bleed, bandage, hearing, dodge or search system in the copied engine yet, so those figures stay on the card. |

## The Flash roadmap, phases 19 to 37 (2026-11-23)

The nineteen Flash-scope phases below were built as one file and one test each. Phases 33 to 37 are pure content and state machines; they add no map, scene art, model, dialogue UI or save. Their briefs were drafted on 23 November 2026; the gates G33.0 to G37.0 remain owner or Opus rulings, and every invented line is marked `[PROPOSED]`. Every file is loaded by `index.html` and listed in `CLAUDE.md`; the phase files are named in `PANEL10.PHASE_FILES`, except the chill, whose in-game credit is deliberately omitted. The first runtime wires now run in play: 19 hearing, 20 lungs, 23 combat, 24 bloom flesh/cloud, 27 the hearth, 29 the chill and 32 the beasts page; 21 contributes only its spore multiplier to the lungs. The co-op cut has its own two-tab browser test, `test/sync19.test.js`, in the browser matrix: a real left-drag is the engine's cut, the guest pays its 8 fatigue, the host records exactly one `sync.act` and its own fatigue is not charged. A fake-G wire test, `test/wires19-23.test.js`, covers Options, the HUD, the attack gate (including engine/card refusals and a co-op swing that spends no engine fatigue), the lung stages, the death reset and the new-card reset without a browser; `test/bloom24.test.js` covers the bloom's invulnerable hit, cloud and exposure wire. The no-browser suite, `tools/book.js --check`, `tools/icons.js --check` and `tools/pwa/precache.js --check` are current. Precache build: `2e8284b0a422`.

| Phase | Feature | Files | State |
| --- | --- | --- | --- |
| 19 | **Built, wired.** Noise inputs 1.0/2.4/4.2, hearing 6/14/16 m sourced, stone half sourced, surfaces, company maximum, clang 16, human listeners, wall clang | `js/hearing19.js`, `test/hearing19.test.js` | Standing at 3 m, gear adding to the input, the ledge's rock/frost split, the 1.2 s listening hold, the 2.4 s clang hold and the wall textures that ring are `[PROPOSED]`; walk/sprint/clang and stone are the lore's. The HUD reads `G.noise`, the ground and CARDS18 hearing; Options > Hearing gauge turns it off. Wired: a human listener in reach turns toward a noise and holds that facing for 1.2 s after the last one; a slash or rising cut with a stone wall inside the weapon's reach adds clang 16 and turns listeners toward the wall, and a thrust or chop never clangs. Browser checked on the live ledge: `heard 3 m` at rest and 14.41 m at noise 6.6 on frost; a waiting carter turned toward a sprint, and a slash on the bothy drystone added the clang and turned him to the wall, while a thrust did not. A bloom feed remains absent; the bloom keeps its own ears. |
| 20 | **Built, wired from bloom choke.** Exposure never down, stages 25/50/75/100, mask half, fire clean, silence refuses speech/workings, death at bloom, cough every 20 s | `js/lungs20.js`, `test/lungs20.test.js` | Thresholds, the 20 s cough, crust return, silence stamina and the choke rate of 2 exposure/s are `[PROPOSED]`; the lore gives the stages and 'cough is noise'. A claw's choke feeds `BLOOM4.state().choke` through the day's `WEATHER21` spore multiplier; the grey bar and Options > Lungs are live; the state saves in `G.flags.la_lungs`; a new card clears it through both `PANEL10.applyBg` and `PANEL10.choose`; a lung death clears the state when it is handed to the engine, so a co-op fall that is softened rather than fatal cannot re-down the host after a revive, and the next card (or a wake) starts clean. Coughs add 1.5 noise, silence returns no stamina, and bloom calls `die('ash-lung')`. No ambient exposure, mask system (nothing sets `la_mask`) or Marget flag. Browser: choke added 0.8 exposure, 80 exposure became silence and stamina 0, the bar drew; a forced bloom reaching 100 showed the death screen. The mask was not exercised. |
| 21 | **Built, partly wired.** Six skies, sight/sound/spore/ground/torch/dread, fixed seven-day table | `js/weather21.js`, `test/weather21.test.js` | Sourced from the bestiary: miasma sight 7/spore 1.3; sleet torch 1.8/ground 0.85/spore 0.6; hoarfrost ground 0.8/sound 1.25/spore 0.9; cinder spore 0.4; Dead Calm sound/spore 1.6. Sight baselines, cinder torch 1.6, dread 0.2 and the day order are `[PROPOSED]`. One link is live: `forDay(G.day).spore` scales the lungs' choke dose. No renderer, fog hand-off, HUD line, switch or other consumer; replacing `WEATHER6`'s visuals is C work beyond the stop rule. |
| 22 | **Built, pure.** Cinder torch 1.6/spore .4/sight .9; Dead Calm 90 s, unskippable, sound 1.6, dread .2 | `js/deadcalm22.js`, `test/deadcalm22.test.js` | Sound 1.6 is the bestiary's; 90 s, dread .2, cinder sight .9 and cinder torch 1.6 are `[PROPOSED]`. No ember art, real-time calm, dread feed or panel refusal. Browser: REST/menu cannot end it, embers and silence render, sound and dread feed. |
| 23 | **Built, wired through the active window.** Windup/active/recovery, stamina at start, formation 1.7 m, clang 16, lodge 1.2, stagger .8 | `js/combat23.js`, `js/game.js`, `js/bloom24.js`, `test/combat23.test.js`, `test/wires19-23.test.js` | Sourced: commitment-melee shape, 1.7 m formation and 16 m clang. `[PROPOSED]`: every cut/thrust/heavy second and stamina cost, 1.2 s lodge and 0.8 s stagger; the code exposes `PROPOSED` and `SOURCES`. The attack wrapper classifies the blow, refuses under cost, takes the full cost at the start, and holds the engine's cooldown for the whole clock; a blow the engine or a card refuses before swinging spends no stamina and opens no clock. The remainder is charged from the fatigue the inner swing actually spent, so sync19's co-op swing, which marks the clock without taking the engine's one fatigue, still pays the full cost. The copied engine's `attack` now starts the swing and leaves target resolution in `G.attack.pendingHit`; `resolveAttack` is called at the windup-to-active boundary, so a blow cannot land during windup or recovery, and a step across the whole clock still resolves once. Bloom24 puts its own hit on the same pending clock. This is the copied-engine edit the rule allows only when there is no other way, and it is recorded here. The co-op partner's own attack, the optional floating damage numbers/crit stop and the Phase 19 wall clang still resolve on their own paths. No poise, durability, thrown-only gate or beast adoption. Browser: a hound went 100 to 96 only at the active frame, and the vulnerable bloom went 55 to 48 there; windup and recovery left both unchanged. |
| 24 | **Built, wired into play.** 55 health, 1.2 m/3 s wound cloud, 2.4 m/8 s burst, fire within 2 m of the cloud's edge at ten times the rate, six cloud-life multipliers, prologue invulnerable (owner ruling) | `js/bloom24.js`, `test/bloom24.test.js` | Sourced: 55, the cloud sizes/times, fire's 2 m, and cloud life 1.6 calm / 1.3 miasma / 1.0 ash / 0.9 hoar / 0.6 sleet / 0.4 cinder. The prologue bloom is invulnerable by the owner's 2026-11-23 ruling. The wire takes the live state from `BLOOM4.state()`; a melee swing in its arc calls `BLOOM24.hit`, so the prologue blocks without a wound or cloud. A vulnerable state (for a later bloom) takes weapon damage, leaves the cloud where it was hit, bursts it at zero, decays it by the weather life, lets a lit lantern within 2 m of its edge burn it, and gives a player inside a `LUNGS20` spore dose with the mask applied. A new bloom state resets clean and invulnerable. The three hit/cloud lines are [PROPOSED]. No cloud billboard, health/sight/stamina choking, save, sound or teal light. Browser: not run here; the fake-G test covers the invulnerable block, vulnerable wound/burst, cloud life/fire and exposure. |
| 25 | **Built, pure.** Loudest noise, shared sightings, worse bar, one fuel pool, 1.7 m formation, shared dread | `js/coop25.js`, `test/coop25.test.js` | No new proposed numbers. No `net19`/`partner19` wire, third/fourth player or panel/Account sync. Browser: two loopback clients share noise, sight, bar, fuel and bloom without a contract change. |
| 26 | **Built, pure.** Five nodes/six roads, shortest path, food/fuel cost, refusal, 30-day month | `js/chart26.js`, `test/chart26.test.js` | Road days, supply costs, 30-day month and the six-day Wexhaven route are `[PROPOSED]`. No MAP panel, calendar, weather fronts, Reckoner, objection or save. Browser: chart opens and walks, refusal works, day/node/stores reload. |
| 27 | **Built, wired at the bothy hearth.** REST at the lit bothy fire opens the hearth: four or eight hours, a food/oil store, the named dead, the Account promises and the company roster | `js/hearth27.js`, `test/hearth27.test.js` | One wound per 3 days and one frost per 2 are `[PROPOSED]`; so is the panel's connective wording. The engine's rest supplies the clock, health and fatigue; the phase's `mend` runs on a body copy. Wounds and frost have no source in the copied engine yet, so those two fields stay ready for a future source and are not visible in play. The state saves in `G.flags.la_hearth27`; the store moves smoked eel and oil between the pack and the bothy; naming an unnamed company dead updates FOLK; promises are read from the Account. No lime/burn/leave, recruit, dependants or body-fruit. Node and browser: rest, naming, store, the promise/roster state and the fall-through to the engine's rest off the hearth. |
| 28 | **Built, pure.** Morale/memory, help/rob/spare/threaten/kill/leave, trust/fear, meeting again, Account line | `js/people28.js`, `test/people28.test.js` | Morale 0-10, start 5 and action deltas are `[PROPOSED]`. No encounter, dialogue, yield/bargain/run/return, dependant or save; dialogue remains gated. Browser: a reaver yields, is spared, remembers and is met again. |
| 29 | **Built, wired in play.** One per-player warmth pool, 0-100; four stages; visible sleet and night, shelter and the bothy's lit hearth; no run or attack at zero | `js/chill29.js`, `test/chill29.test.js` | Sourced: every working takes warmth (the fen's chill), marks renew at the hearth, and the bothy's `la_hearth` is lit. Accepted 2026-11-23: the -0.08/-0.30/-0.12/+1.00 rates, 50/25/1/0 stages, 2.5 m fire radius, bar at x=40 and all four stage words; non-lethal at zero. The wire reads `G.map.entities` for a lit `la_hearth` or campfire, `WEATHER6.sleetAt` for sleet and the game's clock for night; it holds indoors, saves in `G.flags.la_chill`, resets through both `PANEL10` paths and registers Options > The chill. It wraps `needsRecovery` and holds `p.fat=0` at zero; the workings and marks stay pure and untouched, and no future-workings API is exposed. The in-game credits omit this file at the owner's request. No fire-lighting, fuel, NPC or co-op warmth. The saved state is the warmth alone; the stage is derived, and a stage word is said on the crossing that changes it. The cold is non-lethal: at zero the player keeps walking, and health is untouched. Node/fake-G: 35 checks. Browser: stood in the bothy at 40 warmth, the bar drew at x=40..42, save/restore kept only `warmth:37`, both card paths reset to 100, and the lit hearth raised warmth (the fake-G test holds the pool indoors away from it); no script errors (the console's 404s were the base game's optional portraits and music, not `chill29.js`); still `138_3d_the_chill.png`. |
| 30 | **Built, pure.** The lore's eight: Cold light, Staunch, The stilling, Kindle, The ward, The naming, Wind-knot, The bound word; all spoken, all cost warmth; no ranged damage/healing/feeding/lung cure | `js/workings30.js`, `test/workings30.test.js` | Names, keepers and effects are sourced from the bible's workings table. No numeric loudness is invented; each is simply spoken and heard. No left-hand slot, spoken/heard wire, learning limit or pale-blue light. Browser: all eight speak/refuse when silent, are heard and cost, left hand swaps. |
| 31 | **Built, pure.** Five lore marks (Glim, Keen, Rime, Ember, Dull-voice), one at a time, one landing, renew at the hearth fire; effects and catches are the bible's | `js/marks31.js`, `test/marks31.test.js` | Duration is the lore's 'one landing'; there are no invented damage bonuses. Glim lights, Keen ignores part of armour but wears the blade, Rime slows, Ember sears/burns spores, Dull-voice halves the clang but lodges more. No blade wire, rendered mark or damage application. Browser: one mark, landing ends it, renews at fire, visible on the blade. |
| 32 | **Built, wired into the warning book.** The book's seventeen entries in order, qualitative sight/hearing/smell ratings, exact troll noise table and bloom 8 m senses | `js/bestiary32.js`, `test/bestiary32.test.js` | Senses are the book's ratings, not invented distances. The Unnamed has its own entry and the hulk-conger is wider-world, so neither is in the seventeen. The wire is a page in the warning book: L/LOG opens the book, The beasts opens the seventeen in the book's order with sight, hearing, smell, where and note, and Back to the book returns. No `think()` modules, models, encounters or combat adoption; models remain C work. Browser: the page opened from the book, listed all seventeen with the exact troll and bloom distances, and returned; no page errors. |
| 33 | **Built, pure content spine.** Act I: the commission and the stove, the reavers, the witness, the crossing and the Forty; three choices recorded; two exits | `js/actone33.js`, `test/actone33.test.js` | Sourced: the bible's commission, the *Constance* stove, Corvin Hale, the witness, the crossing and the Forty. `[PROPOSED]` G33.0: every connective line, the fight/trade/follow costs, share/ration, bury/keep/name, wait/stove/receipts/chain costs and the Wexhaven/Port Sable exit. The witness stays aboard. No map, art, Follower model, save or engine wire. Node: 19 checks. |
| 34 | **Built, pure content spine.** Act II: the three courts, one accepted answer, the Merewick receipt, three hands on the Deeps, three winter roofs and five Chart legs | `js/acttwo34.js`, `test/acttwo34.test.js` | Sourced: the three offers, costs and hands from the bible. `[PROPOSED]` G34.0: court lines, the one-answer rule, the receipt's unanswered hand, the winter obligations and the Chart's sea legs. The Guest's identity stays unknown. No court map, art, receipt UI, Chart panel or save. Node: 23 checks. |
| 35 | **Built, pure content spine.** Act II side arcs: the Skerries, the Weald, the Unpaid, the Limewalks and the two glasses; flags, debts and items; no XP | `js/sidearcs35.js`, `test/sidearcs35.test.js` | Sourced: the five situations and consequences from the bible. `[PROPOSED]` G35.0: arc lines, the oil-bond cost, the no-fire refusal, the three Unpaid answers, the Limewalks outcomes and the glass's unexplained remainder. No landing map, art, pack or Account wire. Node: 19 checks. |
| 36 | **Built, pure content spine.** Act III: the eleven days, one action per person per day, Corrant, Brode, Marget's limit, four wall courses and the winter door | `js/actthree36.js`, `test/actthree36.test.js` | Sourced: forty thousand people, the eleven-day clock, Brode's refusal, Marget's short answer and the four wall courses. `[PROPOSED]` G36.0: the day actions, the roster and the exact lines. The wall is recorded unresolved. No Halsing or Lodge map, art, model, ending resolution or save. The phone-link support `js/touchlink36.js` shares the number and is not this Act III; see the support note below the table. Node: 25 checks. |
| 37 | **Built, pure content spine.** Five endings, their conditions, the player's three blanks, the invariant scan, credits and return to title | `js/endings37.js`, `test/endings37.test.js` | Sourced: the five outcomes, the last scene and the three blanks. `[PROPOSED]` G37.0: the ending prose, the exact condition flags, the credits and the fallback. An incomplete state gets no ending. No ending scene, film, credits screen or save. Node: 20 checks. |

**Phase 36 support: the phone link.** `js/touchlink36.js` is a loaded support file, not the Act III content: opening with `?touch`/`?mobile` or a coarse pointer starts the engine's touch controls before the first touch. It was kept rather than removed because the page loads it and it does a real job, but its `36` is historical and it does not add a second Phase 36 row or feature. `test/touchlink36.test.js` covers the link forms, the coarse-pointer path, Options Off, the explicit `?touch=0` override, load-time apply, and the later apply call. The phone itself and the browser class changes are not exercised here; this test is Node only. The README's Play on your phone section and `CLAUDE.md` name it as support.

**Lore audit, 23 November 2026.** The first close-out table was checked against `the-round-and-the-long-account.md`, `bestiary.md` and the book. It corrected the workings list (the eight were Cold light, Staunch, The stilling, Kindle, The ward, The naming, Wind-knot and The bound word, not an invented trade list); the five marks (one landing, effects/catches only, no invented damage); the bestiary (the book's seventeen in order, qualitative senses, exact troll and bloom distances, with the Unnamed and hulk-conger excluded); the weather multipliers (sleet, hoarfrost and Dead Calm now follow the bestiary); the cough (20 s, not 18); and bloom cloud life. Combat timings, stamina, lodge and stagger remain `[PROPOSED]` and are labelled in code; the 1.7 m formation and 16 m clang are sourced.

**Not done in 19 to 37:** 22, 25 to 26, 28 and 30 to 31 remain pure tables or state machines with no HUD, renderer, save or engine wire. Phase 27 is now wired at the bothy hearth; its wounds/frost rules still have no source in the engine. Phases 33 to 37 are pure content engines: no Act map, scene art, model, dialogue UI, Follower model, save or engine hook starts them; their briefs are drafted and G33.0 to G37.0 remain open. Phase 29 is now wired: the warmth pool, its bar, the cold and the hearth. Phase 32 is now a page in the warning book; its models, encounters and combat adoption remain C work. Phase 21 has only its spore link. Hearing has no bloom feed, and a wall clang has no separate sound or line, though human listeners turn and a stone wall rings the 16 m clang; lungs have no ambient exposure, mask source or working/speech consumer; combat now moves the player's engine hit and the bloom's own hit into the active window, but the co-op partner's own attack, the optional damage numbers/crit stop and the Phase 19 wall clang still resolve on their own paths; weather's four non-ash/sleet skies still have no picture. The browser halves skip when Chromium cannot launch in the Node environment; this VM lacks its system libraries, while CI installs them. The new `test/wires19-23.test.js` runs the actual wrappers against fake G, update, attack and HUD objects: Options registration, gauge and grey bar, attack cost/refusal/recovery (including engine/card refusals and a co-op swing with no engine fatigue), the lung stages, cough, death reset (including a softened co-op fall) and the new-card reset. `test/bloom24.test.js` runs the bloom's invulnerable hit, cloud life/fire and exposure against its own fake page. Both are in the CI no-browser job, and so are `test/hearing19.test.js`, `test/combat23.test.js`, `test/bestiary32.test.js`, `test/hearth27.test.js`, `test/touchlink36.test.js` and `test/chill29.test.js`. The cloud browser pass additionally covered the live ledge; it did not exercise the mask or the beast. That pass found the Options rows reading `L1` as a global; the wires now resolve `LEDGE1`, and both rows register. The no-browser suite is 43 files with 889 passing assertions and 22 skips; `fork0`, book, icons and precache are clean at build `2e8284b0a422`. Phase 25's `net19` contract and 28's dialogue remain gated. Phases 33-37 now have drafted briefs and proposed defaults; Phase 38 still needs hardware and ears.

**Not done in 11 to 18:** the browser halves were not run locally (no Playwright); the painted spear and shield; the
PACK/Inventory page still says "sovereigns" where Phase 17 says salt; the block, bleed, bandage, hearing, dodge and
search figures have no engine system to drive yet. The UI screens were checked in the cloud browser; Phases 17 and 18
were also checked by their no-browser tests. Phase 38 remains.

**Stills, 23 November 2026.** `docs/screenshots/` now holds the first picture pass: `100_who_walks_north.png`,
`108_title.png`, `109_opening_look_before.png`, `110_the_account.png`, `111_the_warning_book.png`,
`112_you.png`, `113_the_title.png`, `114_options.png`, `115_folk.png`, `116_pack.png`, and the 3D renderer set
`120_3d_opening.png`, `121_3d_the_account.png`, `122_3d_the_warning_book.png`, `123_3d_folk.png`,
`124_3d_the_title.png`. The 100 to 116 set was taken before the 3D automation flag was set and shows the classic
renderer. The 120 to 124 set is the real look: the coal sun, the ash and the Slagcrown. `116_pack.png` shows the
engine's old inventory list, not the Phase 17 kits.

The 23 November browser pass added `126_3d_title.png`, `127_3d_who_walks_north.png`, `128_3d_prologue.png`,
`129_3d_opening_look.png`, `130_3d_account.png`, `131_3d_book.png`, `132_3d_book_entry.png`, `133_3d_kit.png`,
`134_3d_carry_prompt.png`, `135_3d_carry_walk.png`, `136_3d_the_title.png`, `137_3d_hearing_lungs.png` and `138_3d_the_chill.png`.
The last still shows the live hearing gauge at 3 m and the grey lungs bar at 80 exposure. That browser pass also
found two layout faults and fixed them: BOOK had a browser-default search field and nested scrolling, and the carry wire placed Marget in
front of the camera. The title still keeps the HUD below it, as `124_3d_the_title.png` did.

## Audit of phases 11 to 37 (2026-11-23, evening)

PRs #63 and #64 were merged with CI red. Five suites of approved phases (1, 2, 5, 7, 10) failed in the browser, and the
browser halves of phases 11 to 18 had never passed: the machine that wrote them could not start Chromium, and those
suites were not in CI. This pass fixes every failure. Every suite now passes in Node and in headless Chromium
(43 suites, 1,157 checks), and CI now runs all of them.

Faults in the game, fixed:

- **Two Margets.** Phase 15 put a second Marget Sayle on the ledge outside her door from the first frame. Her ledge body
  now waits hidden until she is taken by the arm (`G.flags.la_marget_out`); then the bothy's body is hidden instead.
- **The lantern shrank to a torch.** Phase 17 set the lantern's oil to the kit's torch fuel (four minutes, not eighteen)
  and emptied Marget's two flasks; Phase 7's capacity read the torch. Phase 7 (P59, approved under O10) is restored:
  the kit still records its torch's fuel in `la_kit.fuel`. See the question below.
- **The carter never moved.** His collision test counted his own body, so every step was blocked. Fixed; and while he
  follows he no longer blocks you (he pinned the player on the ledge), solid again when held or waiting.
- **No company until a death.** Phase 12 made the company in a wrapper the creation screen never calls. It is now made
  when a card is chosen, as Phase 17 does. FOLK's roll was also always empty (`roll()` called with nothing).
- **The roll named the carter "The causeway carter"**, the card's name, not the prologue's "The carter". Fixed.
- **Untrained did nothing once Phase 23 was wired.** The commitment cost absorbed the card's extra third. It now scales.
- **Soft feet counted twice** (Phase 10's -0.8 and Phase 18's -0.34). Phase 18 no longer adds it; Phase 10's P82 stands.
- **"heard N m" sat under the game's messages** (top left). Moved to the top right of the view.
- **Tab could fail to close the pack** when two presses shared a millisecond (Phase 10). It now compares the event.

Tests that were wrong, fixed: Phase 15 walked into the bothy wall; Phases 11, 14 and 16 left a dialogue open or opened
the book before the two-second look; Phase 12 checked the wake was shown when it must be hidden; Phase 13 teleported
into the bothy with a held carter; Phase 17 compared total armour noise to 1; Phase 7's switch-off frame now holds
the later HUD layers (19, 20, 29) off by their own switches. `LEDGE1.resetLook()` is new, for tests.

Not built, though the Flash list reads as if it were: phases 21, 22, 25, 26, 28, 30, 31 and 33 to 37 are tables and
pure rules with tests of themselves only. Nothing in the game calls them. Their "Browser:" lines are what a browser
test should check one day, not what was checked.

Ruled:

- **Q-A1: torch or lantern.** Ruled 2026-11-23: "start with torches; the lanterns should be findable or buyable." Built
  as Phase 38, below (O14 in `CANON.md`).
- **The world's scale** (O15 in `CANON.md`), ruled 2026-11-23: the hybrid. Each region is one dense walkable zone of
  about a square mile; the Chart carries you between regions. Not on the small side: more places may be added. Next:
  a scale proposal (zone sizes, which places go in each, the squeeze from atlas miles) for a ruling.

## Phase 38 - start with a torch

`js/torch38.js` · `test/torch38.test.js` · `tools/torchshots.js` (stills 140 to 147) · switch: Options > "Start with a torch"

The owner's ruling Q-A1. Every traveller begins with the kit's Pitch Torch in the left hand, at the bible's fuel (240 s;
the gutter-kin 90, the hedge-priest 360). It burns by Phase 7's rules: U lights and douses it, the weather spends it, the
last fifth shrinks, the last half minute gutters, and spent is spent (lamp oil is not for a torch). The horn lantern is
given or bought: Marget Sayle gives you hers the first time you speak to her, and it goes into your hand, with the torch
in your pack. Using either from the pack takes it into the hand; using the one in hand lights or douses it. Her
flasks fill the lantern, even while the torch burns, and refuse you when you have no lantern. Old saves: one from before
Phase 38 carried a lantern and keeps it (with the card's torch in the pack); one written by the build merged in #63/#64
had the torch's fuel in the lantern's oil and no flasks, so its fuel moves to the torch and the two flasks come back
(this answers the review comment on #65).

How: Phase 7 now draws "the light in the hand" from a source (`LANTERN7.setSource`); with none set it is Phase 7 exactly.
Phase 38 sets the torch as that source. The HUD's third bar, the PACK line and dread read the light in hand
(`LANTERN7.frac`, `source`, `reach`, `flameNow`). Off, the frame is Phase 7's, by hash (tested). Phase 7's and Phase 10's
own suites run with this switch off, as built; `tools/lanternshots.js` does too.

Lore conflict, resolved by the ruling: the bible's item proposal 3 put a horn lantern in the Hedge-priest's kit. Every kit
now starts with the torch.

Ruled 2026-11-23 ("she will give it to you. I approve of the rest"):

- **P-T1** Marget Sayle gives you her lantern, the first time you speak to her. Her line, [PROPOSED]: *"Take the
  lantern. A torch shows you to everything on that shelf."* (the bestiary: a shuttered lantern draws fewer than an
  open torch).
- **P-T2** Its price, for when a trader exists: 10 measures (a targe is 6; lanterns are only mended, never made).
- **P-T3** The torch's light: a pool 2.2 to 5.6 cells across (the lantern 1.7 to 4.2), colour (255, 140, 30), and in a
  room 0.15 of its strength (the lantern 0.22), so one fire still lights a room.
- **P-T4** Its words: fresh, burning well, half burned, burning down, nearly spent, spent; and its lines (light, pinch
  out, burning down to the stave, gutters and goes out, no lantern to fill).
- **P-T5** Taking the lantern puts it straight into the hand and the torch into the pack, pinched out if it was lit.

P-T2 to P-T5 are approved. The flame in the hand now fades with its fuel (the review on #66).

Not built: buying (no trader yet; `TORCH38.gain('lantern')` is the hook one calls), bog-pine splints that add fuel, a torch
burning spores, moths drawn to an open flame (bestiary), and a torch dropped or thrown.

## Phase 39 - the prologue played through

`js/prologue39.js` · `test/prologue39.test.js` · `tools/prologueshots.js` (stills 151 to 163, clip
`150_the_prologue.gif`) · switch: Options > "The prologue's end"

The prologue's pieces (Phases 5, 11, 13, 14, 15 and 38) had each been tested alone. `test/prologue39.test.js` plays
them in a row in headless Chromium with a player's inputs: the page's own keyboard (E, X, Escape, A held down), W and
the arrow keys through `G.keys` one frame at a time (an autopilot in `test/harness.js` that walks and turns as a
player does), and the real buttons (Begin, the card, the dialogue's topics and answers, her arm, Goodbye, Walk on). It
stops the page's frame loop so the run is the same every time. Nothing in the run sets a flag the game should set;
the one exception is a separate check after the run, which holds the bloom still to test the carry on the ramp alone.

The beats, and what each one does now:

| Beat | Phase | Result |
| --- | --- | --- |
| Begin, choose the deserter's card | 10 | Works. On the ledge with a fresh 240 s torch, no errand yet. |
| The two-second look at the Slagcrown | 11 | Works. The errand is given at 2 s, not at 1. |
| Walk down the ramp to the door, the carter behind | 13 | Works. He follows and stands within 2 cells when you stop; the bloom stays at its post. |
| The door and its bar | 5 | Works. E goes in; he waits outside; Marget says to bar it; E at the bar drops it. |
| Marget gives you her lantern | 38 | Works. The first E: the lantern in hand, the torch in the pack. |
| Her promise and the Account | 14 | Works. The south, then Answer, then Give your word: the Account's first entry, under your name. X opens it. |
| Her arm, out of the door | 15 | **Was broken; fixed.** |
| The carter told to follow again | 13 | **Was broken; fixed.** |
| The carry up the ramp, the look back, the title | 15 | **Was broken (twice); fixed.** |
| The end | 39 | **Had none; added.** |

### Faults found by playing, and fixed (each test-first, in the phase that owns it)

1. **A did not walk left** (`js/account14.js`). The Account opened on A from a capture listener that swallowed the key,
   so the W A S D walk could not strafe left, and A opened the book instead. The Account is on X now, and it gives way
   to any key bound in the controls. The BOOK page says "The Account opens with X" (`js/panel10.js`).
2. **E with her on your arm always let her go** (`js/carry15.js`). With Marget on your arm, E at the bothy's door let go
   of her instead of lifting the bar or opening the door, so she could not be brought out: the prologue could not be
   finished. E at the carter let go of her too. Now E does what it would do for what is in front of you (a door and its
   bar, another person, the bar itself) and lets go only when she or nothing is there. Things on the ground are left:
   both hands are full. (`js/door5.js` exposes its doorway rule as `DOOR5.doorway()` so the carry can ask it.)
3. **Out of the door, she was left in a corner of the map** (`js/carry15.js`). Her place beside you was blocked by the
   carter waiting outside, so she kept the place she had inside the bothy, which on the ledge is a far corner. Now a
   blocked place tries the other side, beside you, then behind.
4. **The title came at the foot of the ramp** (`js/carry15.js`). It fired at (87.5, 33.2), on the shelf, the moment
   you came out with her. The bible: "At the top she turns". It now fires where the ramp comes up onto the ledge
   (`CARRY15.atTop`). `test/carry15.test.js` checks the foot does not start it.
5. **The carry locked on the ramp** (`js/carry15.js`; found by the clip's run, not the test's). Turning on the ramp
   with her, her new place was judged from her own last place a step below, as the engine judges a walker, so it was
   always too high; she was left behind, then put where you stood, and as she was solid neither of you could move
   again. Now her place is judged from your feet (she is on your arm), and on your arm she is not solid.

### Added

- **The prologue's end** [PROPOSED]: after the title, a card with the run's numbers, then Walk on. Its words: *The
  ledge is behind you.* / *Marget Sayle is on your arm. The Bell Road goes south from here.* / *On the road: 1 day.* /
  *The lantern: 9 of 18 minutes of oil, and 2 flasks in the pack.* (or *No lantern.*) / *The torch: 4 of 4 minutes of
  pitch.* (or *The torch is spent.*) / *Who lived: ...* / *Written in the roll: ...* (or *Nobody was written in the
  roll.*) / *The walk south to Wexhaven is the first leg on the Chart. It is not built yet.* / button *Walk on*. Days
  count from the day you began (`G.flags.la_day0`); who lived reads the company roll (Phase 12), the carter's own state
  (Phase 13) and whether Marget is out. Shown once (`G.flags.la_prologue_end`). Off, the title ends the prologue as
  Phase 15 left it; the card is a page, not a picture, so the frame is the same on and off (tested by hash).
- **[PROPOSED] P39-1** The Account's key is X (A walks).
- **[PROPOSED] P39-2** E while carrying acts on a door, the bar or another person; on her or on nothing it lets go.

### Not done, and what needs a person

- **The bloom and the carry, for a ruling.** Carrying her, your step is 3.4 loud and you walk at 0.65 of a pace, about
  1.7 cells a second; the bloom shambles at 1.9. Every way from the door to the ramp passes within its hearing of its
  post at the ramp's foot, so it hears the carry and follows you up the ramp. In the test's run it never reached us; in
  the clip's run, where we stopped half way up for a still, it clawed once (90 to 58). When the title comes it is a
  step behind you, and the world is held while the title and the card are up. Whether that is the dread wanted, or
  whether the bloom should give up at the top, is a ruling for the owner; nothing here changes it.
- Feel, timing and sound: whether the two-second look reads as a look, whether the walk and the carry's pace feel
  right, whether the bar's sound and the knock land, how long the title should hold. Software rendering cannot show any
  of that.
- Only the deserter's run is played. The other seven cards, co-op, a dead carter and a refused promise are not.
- The walk south (the Chart's first leg) is not built.

## Engine limits (for O15)

`tools/limits.js` · `docs/engine-limits.md` (the table and the reasoning) · `docs/engine-limits.json` (raw numbers) ·
still 150. Not a phase: a measurement. No game code changed.

O15 wants each region to be one walkable zone of about a square mile, about 1600 x 1600 cells (P33). The tool builds
ledge-like test maps from 96 to 1600 cells a side, with a place every 115 cells and decos between, loads each in
headless Chromium and times the mesh, the frame, the whole-map checks, memory and the save. At 1600 x 1600: 20 million
triangles, 1.3 GB of vertex buffers, a 5 s mesh build, and about 50 ms a frame of whole-map checks in `js/r3d21.js`
(a hash of every cell, a light map of every cell uploaded every frame) before anything is drawn. Saves and `update()`
are not the limit.

- **E1** (approved 2026-11-24) The largest single map is 384 x 384 (512 x 512 at most).
- **E2** (approved 2026-11-24) Build each region now as connected maps of at most 384 x 384, joined at natural thresholds (a pass,
  a gate, a stair), and make chunked streaming in `js/r3d21.js` a numbered phase so that a region can later become one
  map. A coarser cell is not recommended (a person is one cell tall); a smaller zone is the fallback.

Ruled 2026-11-24 ("I approve"; then "everything that was done and proposed last night in all 5 chats I approve of").
Their row in `CANON.md` is not written here: #68 numbers its zones ruling O16, so E1 and E2 take the next free number
once the stack is merged. Software rendering cannot show real GPU speed or memory limits; re-run the tool on real
hardware when the streaming phase is planned.

## Zones (O15): approved 2026-11-24 (O16)

`docs/worldbuilding/atlas/10-zones.md` (the plan) · `docs/worldbuilding/atlas/zones/*.svg` (one sketch a zone) ·
`tools/zones.js` (draws the sketches from the plan's tables and measures the 30-to-60-second rule). Not a phase: a
plan. No game code changed. `test/art2.test.js` now allows the zone sketches (pictures this repository draws), and CI
runs `node tools/zones.js --check`.

O15 rules the hybrid: the atlas stays the true map, each region is one dense walkable zone of about a square mile,
the long hauls are on the Chart, and something to see, find or fight every 30 to 60 seconds of walking (78 to 156
cells at 2.6 cells a second). The plan lays out eleven zones in the road's order, places every atlas place that
belongs in each on a grid, fills the ways between them, and gives the Chart legs between zones from the atlas's
distances. `node tools/zones.js` passes for every zone: the longest stretch of any way with nothing within 70 cells is
155 cells, and on average there is something every 71 to 106 cells.

Everything below was **[PROPOSED]** here and is **approved** ("i approve", 2026-11-24; O16 on the canon sheet). Wexhaven
takes the standard zone size (ZP16); its own extent inside the zone stays unset.

**Rules**

- **ZP1** A zone is 1,536 x 1,536 cells (4 x 4 maps of 384, 0.95 of a mile a side). Three are larger because their
  road is long: the Bell Road country 1,536 x 2,688, the Watchhouse and the Causeway 2,688 x 1,152, the Citadels and
  the north 3,072 x 1,536. About 13 square miles in all, before the great complexes.
- **ZP2** Zones are built now as connected maps of at most 384 x 384 (E1, E2), seams put on thresholds the land has;
  they join into one map when chunked streaming lands. A long thin map (the King's Sluice, the Hewers' Road)
  is cheap because the cost is per cell: a reading of `docs/engine-limits.md`, not yet measured.
- **ZP3** Great complexes stand at true size (O10) in their own maps behind a gate in the zone, as `la_bothy` is.
  Small built places are built in the zone at true size.
- **ZP4** Open country is squeezed; each zone states its squeeze; bearings are kept within about a quarter turn.
- **ZP5** A zone's days: leaving a zone by another threshold books the atlas days of the road between the two (the
  walk south stays 28 days).
- **ZP6** Six kinds of thing on a zone: complex, atlas place, new site, gate, hunting ground, wayside find or view.
- **ZP7** Wayside things are a fixed list of kinds (a cache cairn, a dead traveller and what they carried, a view, a
  cut stone, a broken cart, a neighbour's mark), each placed by hand and showing only what the atlas says is there.
- **ZP8** A Chart leg may stop at a landing: one map of at most 384 x 384 (the White Trees, the Nailhouse, the Lazaret
  Rocks).
- **ZP9** Chart units: food one ration a traveller a day; fuel one a traveller a night away from a hearth; oil at sea
  counted in nights.

**The zones** (sizes, squeezes and grids as in the plan)

- **ZP10** Z1 the highland edge and the ledge (the ledge and bothy kept as built; Coldbarrow at its foot).
- **ZP11** Z2 the Bell Road country, with the Spiral Fold and Hollowmere Dam at its two edges.
- **ZP12** Z3 the Watchhouse and the Causeway, from Bellwether Yard to Brackenreach and the burning east.
- **ZP13** Z4 the Blackfen's drowned middle, west and south, walked into from Z3 only by the Corpseway and the dry ways.
- **ZP14** Z4b the Drowned Measures as its own zone, a day's Chart leg from Rook's Stair: the brief grouped it with
  the Blackfen, but the atlas puts it fifty miles north, off the Bell Road.
- **ZP15** Z5 the Salt Trace and the Downs: the Trace's Downs stretch to Whitlow, the White Horse and the Kings'
  Barrows. The Trace's fen stretch (with the White Trees) and its last stretch to Wexhaven are Chart legs.
- **ZP16** Z6 Wexhaven and the Burned Quay at the standard size, **though the archive leaves Wexhaven's scale unset**:
  that is the owner's first ruling here.
- **ZP17** Z7 the Citadels and the north: the rim, the Ringing Field, the Scald to the Cold Edge and the Bald Hills;
  Kell Tor drawn only to its blank gate and its tarn; the Deep in its own maps.
- **ZP18** Z8a to Z8d, the Round's landfalls: Port Sable and the Sable Shore, Saint-Aumere, Sephar and the Garden of
  Hours (its temples drawn into one stretch of river), Halsing and the White Deeps.
- **ZP19** The Roofed Mile drawn in Z2 at a third of its true length (about 540 cells); Milebank in Z4b at half (about
  820 cells).
- **ZP20** The carrying line counted from the fen: the first tower is Halwen's chapel tower, the fifth the
  Bell-Tender's House, the ninth at Coldbarrow, the eleventh Greystair's belfry; wrapped bells still in the second,
  fifth, seventh and tenth; the third, sixth and eighth lost; the fourth broken in its yard.

**New small sites** (each written up in the plan with why it fits)

- **ZP21** Z1: Marget's peat bank, the Warm Skeps, the Boiling Stone, the Slag Fall, the Warm Shieling, the
  Listeners' Cairn, the Downhill Den, the Dropping Place, the Ponies' Shelf, Wilmot's Fold.
- **ZP22** Z2: the Wether Bield, the Lime Fall, the Moth Barn, the Stone Ruts, the Carriers' Pit, the Last Coach, the
  Halwen Stones.
- **ZP23** Z3: the Roll Stone, the Spent Beacon, the Eel Weir.
- **ZP24** Z4: the Penitents' Lime Cache, the Withy Beds, the Eel Traps, the Claim Post, Heron Holm.
- **ZP25** Z4b: the Surveyors' Mound, the Eel Garths, the Rent Stones.
- **ZP26** Z5: Cleeve Grange, Sallow Grange, Brockhold, the Gate Camp, Hollow Grange, the Chalk Well.
- **ZP27** Z6: the Stove Sledge, the Rear-guard Barricade, the Fishers' Stair, the Burned Ropewalk.
- **ZP28** Z7: the Breathing Holes, the Lodge Cairn, the Ice-walkers' Camp, the Prospectors' Shelter.
- **ZP29** Z8: the Hand-Sign Stones, the Debt Board, the Pressers' Shrine, the Petitioners' Steps, the Glass-Carriers'
  Path, the Embassy Quay, the Empty Traps, the Low Lodge's Meeting Room.

**Chart legs whose miles the atlas does not give**

- **ZP30** Tavin's road station to the Downs, about 20 miles, 2 days (C4); Crake Ford's ferry path to the Trace,
  about 10 miles, 1 day (C5); Port Sable to Sephar, about 1,000 miles, 10 days (S3b); Saint-Aumere to Halsing, about
  120 miles, 15 days (S4).

**Not done, and not checked:** no zone is built and no code changed; `js/chart26.js` still has its five nodes and
six short roads, and would be rebuilt from these legs in a later phase if they are approved. Feel (whether one thing
every 85 cells reads dense or cluttered, how a seam's half-second load sits with the dread) needs a person at the
controls once a zone exists. The Round's four landfalls are outlines: their ways cover a small part of their ground.
Names were checked against `docs/worldbuilding/` and `js/` for clashes on 2026-11-24 ("Lime Pit" clashed with Withy
Bottom's lime pit and was renamed the Carriers' Pit).

## Old phase table (kept for history)

| Phase | Feature | The brief's line it answers |
| --- | --- | --- |
| 4 | **Built.** The walking bloom hunts by sound on the ledge (O7), modelled | "one thing that hunts by sound" |
| 5 | **Built.** The safe room made real: a door that holds, and what the bloom does at it | "one safe room" |
| 6 | **Built.** Sleet and Ashfall, stopped by the bothy's roof | "rain"; "stop at a shelter height map" |
| 7 | **Built.** The lantern as the one light, in the left hand, with a supply, and what it draws | "one light with a limited supply" |
| 8 | **Built.** The highland edge's building style honoured by the planner (P16, approved) | "every region builds differently" |
| 9 | **Built.** Dread as a value that changes the picture, tuned for this world | section 3 |
| 10 | **Built.** This game's panel words, credits and creation | "There are no classes"; the eight backgrounds |

Phases 4 to 6 finish the brief's vertical slice. The later phases are in the Doc.
