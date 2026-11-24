# The Tally: design (phase T0)

*Working title. Written 2026-11-21 against `main` at b3944f8, from build prompt version 2. Nothing
here is canon until the owner rules. No game code exists yet: T0 is reading and planning only.*

The Tally is a top-down horde-survival game set in the Blackfen in the winter of S.30, a sister game
to The Long Account in the same repository. The player moves and the weapons work on their own. A run
is thirty minutes on one stage, and every run is written into the Watch's muster book: on the line
for the dead, for those who held, or for those who ran.

This file holds four things: what was read, where the build prompt and the lore disagree, how the
game will be built, and what the owner is asked to rule on.

## 1. What was read, and what was not

The prompt asks for everything in its section 1.1 to be read in full before any code. That was not
finished in this phase, and the list below says exactly how far it got. **The files marked
"searched" must be read in full before the phase that leans on them.**

| File | How it was read | Needed in full before |
| --- | --- | --- |
| `CLAUDE.md` | In full | done |
| `docs/worldbuilding/CANON.md` (O1 to O12) | In full | done |
| `bestiary.md` | In full | done |
| `the-warning-book-s30.md` | In full | done |
| `the-round-and-the-long-account.md`: *Small magic*, *Beasts of the wider world* | In full | done |
| `items-and-texts.md` | Headings and section 3 (item proposals) in full; the rest searched | T4 (items), T5 (texts to place) |
| `godot-people.md` | The eight cards, the companions' hooks and reasons to leave; the rest searched | T6 |
| `atlas/`: the Watchhouse, the Low Galleries, the Slagcrown, the Black Seam drift, the venting slopes | Read through, with the longest paragraphs cut short at about 700 characters | T5 (the Watchhouse), T8 (the rest) |
| `atlas/`: every other place the prompt names | Searched by name | T7, T8, T10 |
| `people/`: Merrick Thwaite, Aud | Most of each entry | T6 |
| `people/`: every other person the prompt names | Searched by name (all are there) | T6 |
| `ROADMAP.md` | Header, the proposal tables' form, P81 to P86, Rulings, Decisions, Next phases | done for T0 |
| `the-smothering.md`, `act-one-the-outskirts.md`, `acts-two-and-three.md` | Searched only | T5 (act one), T7 and T8 (acts two and three) |
| `js/net19.js` | Header only: it is a two-player transport | T9 |
| `js/audio.js`, `js/bloom4.js`, `test/harness.js`, `tools/shots.js` | `harness.js` in full; the others by their shape only | T1 |

## 2. Where the prompt and the lore disagree

Every name the prompt uses for a person or a place is in the story folder. These are the places where
what the prompt says differs from what the lore says. Under the prompt's own rule the lore wins, so
each row gives what the build will do unless the owner rules otherwise.

| # | The prompt says | The lore says | The build will |
| --- | --- | --- | --- |
| C1 | The quarry-troll, the walking bloom, the Unnamed and the gallery animal all hunt by sound, and "noise is the whole fight" (6.5) | Only the troll has no sight (`bestiary.md`). The Unnamed see about 10 m in a cone and hear a sprint or a swing at about 10 m. The Roofed Mile animal turned to a hammer but also finds people by breath and smell, and sees well enough to drop on a climber | Stillness hides the player from the troll only. The Unnamed and the gallery animal get their own senses from their pages |
| C2 | The Watch Deserter's *Drilled* makes the Watch Step return 20% sooner (13.1) | The card says "Drilled (cheaper blocks; the old coif is in the shelter stash)" (`godot-people.md`) | Keep each card's quoted line unchanged, as the prompt asks. Treat every trait and flaw number as a game reading and list it for a ruling (P105). For *Drilled*, propose the targe's turned blow returning sooner, which is nearer the card |
| C3 | Whetstone and Good Rope are new items (9) | Both are in `items-and-texts.md` section 3: the Whetstone (quarry stone, found on the troll) and the Coil of Rope ("the good rope", dropped when the captive is freed) | Use the lore's items. Only their effects here (crit, reach) are new |
| C4 | A Shuttered Lantern (9) | The lore's shuttered lantern is the **Horn Lantern** (section 3, item 3) | Call it the Horn Lantern |
| C5 | Brass tags come off walking blooms and the dead everywhere (12.1, 18) | Brass tags are the miners' tally tags on the venting slopes (`atlas/4-the-citadels.md`). In the fen a carrier wears a **Name-Token**, a lead tag or a notched wooden token (section 3, item 12) | Name-Tokens in the fen and on the Bell Road; brass tags only from Greystair north. Both are returned at the Naming Stone |
| C6 | Return-Bread is food carried as kit, and ash-rats come for it (9) | Return-bread is a Reedwake custom: a loaf set on a mooring post for someone out on the water, eaten when they come back. It "works no magic" (`atlas/2-the-blackfen.md`) | Not use it as a ration. Propose instead a loaf left at the Outside Fire that is eaten only by a run that held (P98), or drop it |
| C7 | The ward is a line spoken over salt anywhere (11) | "A line spoken over salt across a doorway" (*Small magic*); "across a door or a drain" (the Watchhouse's atlas entry) | Let the ward be spoken only at a door, a drain, a gap or a culvert mouth. On open ground it has nothing to hold to |
| C8 | Wind-knot is a working the player speaks (11) | It is a knotted cord, bought from Skerry boat-wives, that holds one breath until it is untied. Such cords hang on huts on Orlen's coast (`atlas/7`, `atlas/9`) | Make it a thing found or bought and untied once, not a working taught. This also answers a third of question 7 |
| C9 | A mark fades after about eight minutes (10) | A mark holds "for hours, until it fades and must be renewed at a fire" | Keep eight minutes as a game number and list it (P99). The renewing at a fire is the lore's |
| C10 | A corpse fruits after 20 seconds (19.2) | Corpse-caps fruit "within days" | Keep 20 seconds as a game number and list it (P104) |
| C11 | Stage 1's ground: the Spore Hollow, the Old Quarry, the north-west feeding ground | The atlas names them **Withy Bottom (the Spore Hollow)**, **the Causeway Delph** and **the Long Stable**, and gives the ground thirteen numbered zones, the hard standing, the nail shrine, the ash-post and the drain among them | Build the thirteen zones under the atlas's names. The drain is the goblins' road into the house and the one shortcut |
| C12 | At the Slagcrown, orks come from above and goblins from below (17.9) | An ork pack dens behind the hall's high table; goblins are in the **upper** shafts | Goblins from the shafts above, the pack from the hall |
| C13 | The Low Galleries' wonder is "the road of cold lights" (17.8) | The road of stars is the **Hewers' Road**'s wonder. The Low Galleries' is the blue light coming and going along the lintels as people whisper to them | Use the lintels in the Low Galleries. Keep the road of stars for a Hewers' Road stage if one is wanted |
| C14 | The Counting Passage pairing is Targe and Padded Coif (10) | The listeners cross the long drift "walking slowly with their shields raised, because walking while blocking makes no sound" | Add this to the Targe: moving with the shield raised is silent. It is the lore's own counter for stage 8 |
| C15 | Pairings are named The Burning Bank and The Nailhouse (10) | Both are places in the Blackfen (`atlas/2-the-blackfen.md`) | Ask for a ruling on borrowing place names for things a weapon becomes (P100) |
| C16 | Cold light can be taught by a listener at a wayside (11) | The listeners "teach it to almost no one from outside" | Cold light is taught once, by a listener, only on stages 7 to 9, and only after the Quiet has been kept |
| C17 | Question 10: is the Receipt-Wife Marget Sayle or Gytha Marrin? | Gytha Marrin, in four files and in the game itself. `ROADMAP.md` P6 reads: "The Receipt-Wife" is said to Marget's face and she answers "Tell her I am not a receipt". `js/ledge1.js` gives Marget the line "The Receipt-Wife. Still counting. Tell her I am not a receipt." Only `CANON.md` O6 says Marget "is called the Receipt-Wife to her face" | Change nothing in this phase. It looks like O6 shortened P6 and turned it round. The owner rules; the fix would be one clause of O6 |
| C18 | Each pillar is "a saying from the Watchhouse fire" (2) | Three are in the fire's list of sayings. "Only people are people" is the book's rule and "write down the dead" its habit. "Hold the line" is nowhere in the story folder | Keep it as the game's own phrase and list it (P90), or take one the fire does say and the prompt does not use, such as *Never feed what follows you* |

One thing the lore offers that the prompt does not use: the ogre "will not" eat anything with
spore-growth on it. A field the player failed to lime is ground the ogre will not feed on. That can
be a small mercy inside the rot of 19.2, and it is listed as P104.

## 3. The game, as it will be built

The six measures of "done well" stand as the prompt gives them, in its order: movement, reading the
screen, the build, the Ashen Wilds, fairness, speed.

### 3.1 The six sayings and the systems they become

| Saying | System |
| --- | --- |
| Hold the line (the prompt's; not in the lore, see C18) | The thirty-minute run and the thaw |
| Stand still and be stone (`bestiary.md`, *What survivors say*) | The fourth input: be still. The troll, the naming, binding a wound, looking at a wonder |
| Lime the dead or meet them (the same list; fact 16) | Corpses stay, fruit and puff clouds the horde walks through unharmed |
| A light means fuel, not safety (the same list) | Fire clears chill and renews marks; it draws moths and brings the ogre from downwind |
| Only people are people (O1; the warning book's first rule) | Beasts never speak, bargain or carry banners. Every choice with weight is about a person |
| Write down the dead (the Roofed Mile board's habit) | The muster book, the warning book, the Naming Stone |

### 3.2 What the lore fixes and the game must not change

- Only people are people (O1). No beast speaks, bargains, answers to a name, makes anything, lights a
  fire or works magic.
- No prophecy. Who made the Vaults, what the orks fled and why the Unnamed rise are never answered.
  What the orks fled is never on screen.
- Whether the cough is catching stays open (O3). No mechanic gives a player ash-lung.
- Workings are small, are heard and cost warmth (O4). None feeds, clears a lung, raises the dead or
  shows the future. Nothing throws fire or moves a wall.
- Salt is the money, in measures.
- Beasts are modelled, the walking bloom too; living people are painted (O9).
- In-game text is plain ASCII. Dates are S-dates.
- The winter of S.30 is "what may have happened" (`CANON.md`). The Long Account assumes none of its
  endings, so nothing in The Tally may be written as settled fact about that winter, the last stage
  least of all.

### 3.3 Numbers taken from the lore as starting points

The canon sheet makes the old build's numbers reference, not rules. These are where tuning starts.

| Thing | Number | Source |
| --- | --- | --- |
| Goblin | 1.35 m; a dart near 5.6 m/s; stones from 5 to 11 m when backing off | `bestiary.md` |
| Ork | 1.92 m; slash, chop, a bash through a guard held too long | `bestiary.md` |
| Ogre | 2.95 m tall, 1.70 m across; charge 8.5 m/s over 5 to 11 m; reels about 2 s on stone; gives up after about 20 m; will not pass a 1.35 m door | `bestiary.md`, fact 13 |
| Troll | 2.60 m, 1.60 m across; 2.2 to 3.2 m/s; remembers a sound about 6 s | `bestiary.md` |
| Noise | Search 5 m, walk 6, dodge 9, a blow on a shield 10, swing 12, sprint 14, iron on stone 16; half through stone | `bestiary.md` |
| Walking bloom | 55 health; 1.9 m/s; sees 8 m in a 120 degree wedge; a wound puffs 1.2 m for 3 s; death bursts 2.4 m for 8 s | `bestiary.md` |
| Choking | About 3 health a second, never the last point; fire eats a cloud ten times faster | `bestiary.md` |
| The Unnamed | 2.6 m/s; a grab for about 14; rises about 12 s after falling; keeps within 14 m of its stone; the naming takes about 2.5 s and a blow breaks it | `bestiary.md` |
| Spore clouds by weather | Dead Calm x1.6, fog x1.3, ashfall x1.0, hoarfrost x0.9, sleet x0.6, squall x0.4 | `bestiary.md` |
| The sun's day | Of twenty days: five coal, eleven coin, four with a clear noon; fixed by the day's number | O8 |

## 4. How it is put together

### 4.1 Where it lives

Default, awaiting question 2: a folder `tally/` with its own `index.html`. It loads none of The Long
Account's engine, which is a first-person grid renderer. It shares the repository's rules, tests,
tools and site.

    tally/index.html          the page; loads every script in order, each with ?v=N
    tally/js/<feature><T>.js  one file a phase: feel1.js, horde2.js, fen3.js, build4.js ...
    tally/data/*.js           weapons, kit, creatures, stages: plain tables, no code
    tally/test/*.test.js      one test file a phase; runs in Node with --no-browser, and in Chromium
    tally/test/feel.html      the feel page (T1)
    tally/test/stress.html    the frame-time page (T2)
    tally/tools/              the sprite bake, stills
    tally/docs/               this file, balance.md

Storage keys are prefixed `tally_`, because GitHub Pages serves every game here from one site and
they share a browser's storage. No other key is touched.

### 4.2 The simulation

- One pure function, `step(S, env, dt)`, at a fixed 120 Hz, seeded, with no clock and no live random
  numbers. It runs in Node, as `js/bloom4.js`'s `think(S, env, dt)` does, so every rule can be tested
  one step at a time without a browser.
- State is struct-of-arrays in typed arrays, pooled, with no allocation in a frame: one pool each for
  beasts, missiles, embers, corpses, clouds and particles.
- Space is a 2 m hash, used for collision, soft separation and nearest-target queries. Bounded maps
  add a flow field recomputed at 10 Hz.
- Each creature's brain is a pure `think` function over its own slice of state, with a Node test of
  the one rule its page in the warning book gives.
- Rendering reads state and never writes it. It interpolates between the last two steps.

### 4.3 The renderer

A hand-written WebGL2 renderer of instanced quads: one atlas a kind, at most 30 draw calls. Light is
drawn to a low-resolution map and multiplied over the scene, which is how `js/light21.js` already
works; `CLAUDE.md` warns that warm light on cold ground turns white unless it is strongly red with
little blue. The four lights keep their colours: tallow yellow for the player, ember red for the
land, teal for the bloom, pale blue for workings and marks.

### 4.4 Art and sound

- People are painted in code, as `js/paintfolk76.js` does, redrawn for a top-down three-quarter view
  in eight directions.
- Beasts are modelled, as `js/bloom4.js` and `tools/look/` do, and baked to top-down sprite sheets by
  a tool in `tally/tools/`. The bake takes a posed model and returns a sheet, so a body rigged in
  IDTech3-NextGen-Forge could feed it later without the game changing.
- No picture and no sound the repository did not make. No base64. `test/art2.test.js` already fails
  on a copied picture; the Tally's own test will check `tally/` the same way.
- Sound is generated live with WebAudio, after `js/audio.js`.
- Every visual feature has a switch, and off draws exactly as before, tested by frame hash.

### 4.5 What the checks cannot show

Software rendering in CI cannot measure frame time. Movement feel, timing, sound and how the screen
reads at 1,500 beasts need a person at the controls on a real machine. Each phase's PR will say so
again where it applies. The two gates that depend on it are T1 (feel) and T2 (frame time on the
Chromebook).

## 5. The phases

One phase is one feature, one PR, then a stop for the owner. The order is the prompt's.

| Phase | What | Gate |
| --- | --- | --- |
| T0 | Read and plan. This file, the proposals in `ROADMAP.md`, the questions | The owner's rulings |
| T1 | Feel: the loop, the four inputs, the camera, walking, the step, stillness; one weapon; goblins that circle and dart; embers; a bare level-up; the feel page | The owner says the movement is right |
| T2 | The horde: renderer, pools, spatial hash, light map, conditions, noise | A frame-time capture from real hardware at 1,500 beasts |
| T3 | The fen's creatures, each with its counter and a Node test of its rule | |
| T4 | The build: weapons, kit, marks, workings, caches | |
| T5 | The Outside Fire, whole: the fire, the Unnamed, the ogre, the Order, the thaw, the rot, the portrait, sound | Thirty minutes that are good from start to finish |
| T6 | The Watchhouse: the hub, the books, the door, saves, all eight backgrounds | |
| T7 | The road: stages 2 to 5 | |
| T8 | The north: stages 6 to 9 | |
| T9 | Co-op | |
| T10 | Further stages, modes, access, the README with stills | |

### 5.1 T1 in detail

T1 can start without most of the rulings below. It needs only question 2 (where the game lives) and
uses nothing invented beyond P89 (embers) and P92 (the step and stillness).

- `tally/index.html`, `tally/js/feel1.js`, `tally/test/feel1.test.js`, `tally/test/feel.html`.
- Walking: top speed 4.0 m/s; to top speed in 70 ms, to a stop in 55 ms, full reverse in 90 ms;
  diagonals normalised; stick dead zone 0.18 to 0.95, exponent 1.4. Scale 1 tile = 1 m = 64 px.
- The Watch Step: 3 m in 0.18 s, untouchable 0.22 s, cooldown 2.4 s, a press buffered in the last
  120 ms.
- Be still: after 0.4 s weapons fall quiet and noise is zero; release and they resume at once.
- The camera: a critically damped spring leading up to 1.5 m.
- One weapon (the Tarnished Arming Sword), goblins from their page (circle out of reach, dart at a
  turned back or the end of a swing, skitter off), embers, a bare level-up.
- Tests in Node: the three walking times to the millisecond at 120 Hz; diagonal speed; the step's
  distance, its untouchable window and its buffer; stillness silencing weapons at 0.4 s; a goblin
  darting only at a turned back or in a swing's recovery, never at a player who faces it ready; the
  same seed giving the same run.
- Stills of the yard and the overlay. What they cannot show is whether it feels right; that is the
  gate.

### 5.2 Risks

- **1,500 beasts at 60 fps on an Intel Chromebook** is the hardest number in the prompt. The plan
  (typed arrays, a spatial hash, instancing, 30 draw calls) is the usual one, but it is unproven here
  until T2's capture on the owner's machine.
- **Modelled beasts baked to sprites** is new work: `tools/look/` draws beasts in first person. The
  bake tool is the largest unknown in T3.
- **The rot (19.2)** can run away with the frame budget and the player's patience. It has a cap in
  the prompt; it will need tuning with a scripted player before T5.
- **Nine stages, twelve named people and five further stages** is a great deal of authored content.
  T5 is one stage made whole on purpose, so the rest can be judged against it before it is built.
- **Co-op** for four needs more than `js/net19.js` gives. See question 9.

## 6. Questions for the owner

The prompt's ten, each with what the reading found and a recommendation. Then four more that the
reading raised.

1. **The title.** "The Tally" is also the faith of the Compact of Quays, whose notaries keep the bound
   word. In the fen a tally is only a count. *Recommend:* keep it as the working title through T5
   and rule then; *The Muster* fits the book the game is built round.
2. **Where it lives.** *Recommend:* `tally/` in this repository, as section 4.1.
3. **Reading danger:** flat ember-red ground shapes for every telegraph (P88). *Recommend:* yes. It
   keeps the four lights apart, since the land's light is already ember red.
4. **The door:** admitting and refusing people between runs (P110). The lore has the house arguing
   every winter about whom to admit, and Osric Brayne's sheet of the admitted and the turned away.
   *Recommend:* yes.
5. **The last stage tells the Seal ending,** and in solo Merrick drops the gate (P108). The lore has
   him drop it "from below. One knock." The Long Account assumes no ending. *Recommend:* yes, with
   the stage saying on its own screen that this is one telling.
6. **Merrick as the Deserter's companion** (P109). *Recommend:* an option, off by default, unlocked
   by holding stage 1.
7. **Who in the Blackfen teaches kindle, wind-knot and the bound word.** A search of `people/`, the
   atlas and the act files found nobody in the fen who keeps any of them. *Recommend:* wind-knot is a
   cord found or bought, not taught (C8). The bound word comes from a Collector's notary on the Salt
   Trace, since the Collectors are the Exchange's agents and the Tally licenses the word. The search
   found no keeper of kindle north of the sea; leave it out until the owner places one.
8. **Rulings on the invented things:** P87 to P118 in `ROADMAP.md`.
9. **Co-op.** `js/net19.js` is written for exactly two players, one host and one guest.
   *Recommend:* a new host-authoritative layer in `tally/`, copying its lobby and six-letter code and
   leaving the file itself alone. The simulation is already a pure seeded step, which suits it.
10. **The Receipt-Wife.** See C17. *Recommend:* she is Gytha Marrin, and O6's clause is corrected to
    match P6.
11. **Return-bread** (C6): a custom at the Outside Fire, or left out?
12. **Name-Tokens and brass tags** (C5): two kinds of tag by region, as the lore has them?
13. **Place names on weapons** (C15): may a pairing be called The Burning Bank or The Nailhouse?
14. **The reading still owed** (section 1): should T1 wait until every file in the prompt's 1.1 has
    been read in full, or may it start, since it leans only on files already read?

## 7. Everything invented

Listed in `ROADMAP.md` under *The Tally: phase T0* as P87 to P118, each marked [PROPOSED]. Nothing
on that list is built.
