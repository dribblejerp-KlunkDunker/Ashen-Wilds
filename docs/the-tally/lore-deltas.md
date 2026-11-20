# The Tally: lore deltas

**Status: proposal, ruled through to M1.** The ten framing questions in PR #49 were ruled on
2026-11-20, then all seventeen proposals in 33, every one as recommended; see *Rulings* below. The
only things still open in this file are the two names in 34, which are deliberately open to M4.

Every place where the build brief for *The Tally* and the lore of Ashen Wilds disagree, what the lore
says, what this design does instead, and every new thing the design adds to canon. Nothing here is
canon until sleeves rules it, and the rulings below are only a start.

Read with `docs/worldbuilding/CANON.md` (owner decisions O1 to O11), `atlas/`, `people/`,
`the-warning-book-s30.md`, `bestiary.md` and `ROADMAP.md`. Where this file and any of those
disagree, those win.

Each entry is: **what the brief said**, **what the lore says**, **the change**. Entries marked
**proposal** add something to the world and need a ruling even where there is no conflict.

**Every entry ends with its sources**, as `file:line` where a line will do, and as `file` plus a
section where a line would mislead (a table, a whole entry, a file the atlas rewrites). Line numbers
are against `main`; if one has moved, search the quoted words. `CANON.md`'s owner decisions O1 to O11
are a table at `CANON.md:24-36`; its twenty facts are `CANON.md:95-196`. Two sources are outside
`docs/worldbuilding/` and are marked as such where they appear: `CLAUDE.md` (the art rule) and
`js/net19.js` (the transport).

## Rulings

**Ruled by sleeves, 2026-11-20, on the ten questions in PR #49. All ten as recommended.** Where a
ruling settles a delta, that delta stands as written and its **proposal** mark is discharged for the
part named here. Where it does not, the entry stays open.

| # | Question | Ruling | Settles |
| --- | --- | --- | --- |
| 1 | Title | ***The Tally*** stands | the folder name and the `/the-tally/` path |
| 2 | Home | this repo, `the-tally/`, served at `/the-tally/` | `plan.md` |
| 3 | Beasts | modelled and rendered to sheets per O9; the two-way test is dropped | 3 |
| 4 | The Weight Gate | Merrick drops it and the player hears the one knock; in co-op, standing below is a volunteer choice with no default | 21 |
| 5 | Merrick | on by default, and only for Rafe | 19 |
| 6 | Secret character | **Wat Corley** in the roster; the Kept Hand is out. Gise Marrable keeps S3 | 16, and **P7** |
| 7 | Two names | left open to M4: character 10 and the Halwen captain stay `[name]` | 34, by ruling rather than by default |
| 8 | The Watch Rota | local only; no online board | 16.11 of `design.md` |
| 9 | Co-op | a four-player host-authoritative star above `net19`; the transport is not rewritten | 24 |
| 10 | Gytha Marrin | patron and narrator, not playable | 17, and **P8** |

**On the slot number.** The question said S3, because the brief's S3 was the Kept Hand. `design.md`
had already given Wat Corley **S2**, the slot Gytha's chair vacated when she became the patron, and
put Gise Marrable in S3. The ruling's substance is untouched: the Kept Hand is out of the roster and
Wat Corley is in it. But the label in 16 and P7 was wrong. See 36.

**The proposals, ruled.** A second pass, same day: the fifteen proposals, **all fifteen as written**.
They change the design's text rather than its framing, which is why they wanted a pass of its own;
none of them blocks M1.

| # | Ruling | Settles |
| --- | --- | --- |
| P1 | salt is the currency and `Measure` is the stat | 1, and the Tally Room's prices |
| P2 | the fourth line, **did not answer** | 6, and the four lines in 17.3 of `design.md` |
| P3 | the wayfarer's horn is what is heard at the Order | 5 |
| P4 | **Go back**, and only Rafe's | 5 |
| P5 | the Reed-Jaw is stage 5's boss | 9 |
| P6 | the Grey Hour replaces the Thaw | 15 |
| P9 | brass tags at the Naming Stone; v1 keeps the stone as a place and a pickup | 18 |
| P10 | a bell near a listener costs their trust | 23 |
| P11 | marks fade and are renewed at a fire | 10, and **stage 2 gets a brazier** (16.2 of `design.md`) |
| P12 | the naming at a grave is timed and loud | 14 |
| P13 | return-bread on the Causeway, eaten and never worn | 35 |
| P14 | the tower bell struck once, its tongue returned | 35 |
| P15 | Kell Tor's tarn seen from Greystair | 16.7 of `design.md`, and 35 |
| P16 | the bargain at the covenant recess; the altar stays empty | 36 |
| P17 | **Call the Roll**, and the Seam Roll keeps its name | 36 |

**One ruling changes a build.** Marks are renewed at a fire, so the Old Causeway, which has none, gets
one brazier (16.2 of `design.md`). That is the only thing the second pass adds to the design; every
other proposal was already written into it.

**What is still open.** Two names in 34, deliberately left to M4: character 10 and the Halwen siege
captain.

---

## 1. Money

**Brief.** Coin: "Orlen pennies, groats, a rare silver noble". `Greed` is a stat. Coin is kept at
100% on death.

**Lore.** Salt is the money; prices are in **measures** (CANON fact 15). Copper and silver exist at
the edges: a purse of Crown pennies at a drover's camp (`atlas/9`), silver marks on the quays
(`atlas/8`), lamp oil counted in *nights*, lime by the barrel, grain everywhere as power. There is
no groat and no noble anywhere in the lore.

**Change.** The Tally's currency is **salt, counted in measures**. The stat `Greed` is renamed
**Measure** (salt per kill, %). Every price in the Tally Room is in measures. Crown pennies survive
as a small, rare find worth 10 measures, with their own sound. No groats, no nobles, no gold.

*Why it is better:* salt is the thing everyone in the Blackfen is short of, it ties the meta-shop
to the fiction, and "every measure's somebody" (Joan Tallis) is the exact note the Tally Room wants.

*Sources: `CANON.md:157` (fact 15: salt is the money, prices in measures); `items-and-texts.md:246`
(iron priced in measures); `atlas/9-the-wilds-between.md` (Crown pennies at a drover's camp);
`atlas/8-the-wider-round.md` (silver marks on the quays). No groat or noble anywhere in
`docs/worldbuilding/`.*

---

## 2. The four lights

**Brief.** Player effects in "bone, ember, salt-white and cold-light **teal**"; the palette includes
"cold-light teal (the teal hollow)".

**Lore.** The strongest art rule in the repository (`CLAUDE.md`, *The look*): **four lights, never
confused.** Yours is tallow yellow and small. The land's is ember red and vast. **Teal belongs to
the bloom. Pale blue belongs to workings.** The teal hollow on the ledge is the bloom's ground.

**Change.** Player light and player workings are **pale blue (glim)**. **Teal is a threat colour**
reserved for the walking bloom, its spores and its ground. Nothing the player owns or fires is ever
teal. This replaces the brief's "cold-light teal" everywhere, including the Cold Light weapon.

*Why it is better:* the brief's own section 5 rule is that nothing the player fires may look like
something that hurts them. In canon the colour that hurts you is teal. Now the screen's most
dangerous colour is spent on the thing that is most dangerous, and the player's own light can never
be mistaken for it.

*Sources: `CLAUDE.md:185-186` (repo root, not `docs/worldbuilding/`: "Four lights, never confused"),
`atlas/0-how-to-read.md:22` (no beast works magic); `the-round-and-the-long-account.md:253` (workings
and marks), `atlas/4-the-citadels.md:30` (all six crafts practised at the Citadels).*

---

## 3. How beasts are made

**Brief.** `[OPEN]` Beasts hand-painted, Forge-modelled, or painted-over renders; the team should
produce one goblin and one ork **both ways** at M3 for sleeves to choose.

**Lore.** **O9** (confirming D8): beast are **modelled**, on condition that they look far better
than the first sketches. The walking bloom is modelled too, though it is a body and not a beast.
**Living people stay painted.**

**Change.** The test is closed: there is one pipeline, not two. Every creature is **modelled and
rendered to 8-direction sheets**; every living person is a **painting**. The M3 gate becomes: does a
modelled goblin and a modelled ork still read at 24 px tall after rendering and ink outline? No
painted alternative is produced.

*Note.* This is the ruling the brief itself deferred to. Building both ways would spend the M3
budget proving something sleeves has already decided.

*Sources: `CANON.md:34` (O9, beasts are modelled; D8 stands).*

---

## 4. Rafe Sedley is two different men

**Brief.** Character 1 is "The Watch Deserter (Rafe Sedley)", and secret character S1 is "the old
Watch man Gytha Marrin sent north; his name stays unknown".

**Lore.** **O11**: Rafe Sedley **is not** the deserter on the ledge. At the thaw he is at the
Watchhouse with the muster book. The ledge's deserter is a different, older Watch man, sent north by
Gytha Marrin. Both carry Watch issue swords with faded glim marks, because Watch issue swords
carried glim marks (`people/the-novel.md`).

**Change.** Both characters stand, and both are correctly named. Character 1 is **Rafe Sedley of
the Causeway tower**: about 34, lean, the grey cloak worn to the weave, a **wooden targe** on his
back (a trait hook the brief missed), the issued sword with its glim mark. S1 is the **unnamed older
Watch man** of the ledge, and his line in the muster book stays nameless.

*Sources: `CANON.md:36` (O11); `people/the-novel.md:20` ("He is not the deserter on The Long
Account's ledge"); `people/the-watchhouse.md` (Kemble's order; the ledge man sent north by Gytha).*

---

## 5. The Order is the Watch's fall-back order, not a horn in a squall

**Brief.** section 3.3: at 20:00 a squall comes in, a horn may or may not sound, and a prompt asks "Did you
hear the order?"

**Lore.** N2: on the night the tower fell Rafe **thinks he heard the order, in a squall where
nothing can be heard**. The order is a real, written thing: the roster's standing order, *Fall back
to the Watchhouse. Bring the book.*, which was Kemble's, which Pim says she gave, unconfirmed
(`people/the-watchhouse.md`; warning book entry 7). The squall is a **cinder-squall**, one of the six
weathers. Passing places along the Causeway are **cut with a wayfarer's horn** (`atlas/2`).

**Change.** The event is kept exactly, and it is now canon rather than invented. It arrives in a
**cinder-squall** at 20:00. The sound is a **wayfarer's horn** off the Causeway, and possibly a
voice under it. The prompt reads the same. The two answers are unchanged. Three things are added:

- The **text of the order** is shown, in the Watch's voice, once: *Fall back. Bring the book.* It is
  the only order the player is ever given, and it is the wrong one.
- On stages far from the Watch, the same event is a **passing company's horn** on the road. The
  ambiguity is canon's own position, and it does not weaken the moment.
- **Rafe's third choice**, "Go back" (+3 levels, rewards x2, no extract) is kept. **proposal.**
- The **book** the order means is the **muster book**, the tower's roll of names: it is the one that
  travels. The warning book is already at the Watchhouse and never leaves the fire. Say it once, in
  the text, so nobody later swaps them.

*Sources: `people/the-novel.md` N2; `the-warning-book-s30.md` entry 7 (the order, and the squall);
`atlas/2-the-blackfen.md:110` (markers "cut with its number and a wayfarer's horn", passing places);
`the-smothering.md:325` (the six weathers).*

---

## 6. The muster book has four lines, not three

**Brief.** Three lines: the dead, those who held, those who ran.

**Lore.** The muster book's own last entry, in Pim's hand: "four dead, a date, and *Deserted:
none*". And the phrase **"did not answer"** is written a dozen times in the Seam Roll, with no payment
against any name, and it is the Watchhouse's word for the Ashbound: the bestiary's second sense,
*a verdict on anyone who has stopped answering* (`acts-two-and-three.md`; `atlas/4`; `bestiary.md`).

**Change.** Four lines:

| Line | For |
| --- | --- |
| **The dead** | died in the run |
| **Held** | survived to first light |
| **Deserted** | took the Order and left |
| **Did not answer** | the Silent, and any who stopped answering. **Not** a laid Unnamed: laying one is the reverse |

"Deserted" replaces "ran" everywhere, because it is the word the muster book uses. "Did not answer" is the
fourth line and it is the one that will hurt, which is the point of it.

*Sources: `acts-two-and-three.md:202` (the Seam Roll's last entries; no payment against any name);
`acts-two-and-three.md:221` ("the same verdict the Watchhouse uses for the Ashbound");
`atlas/4-the-citadels.md:58` (the Seam Roll in the counting house); `bestiary.md:550` (Ashbound's two
senses).*

---

## 7. The Silent do not hurt you

**Brief.** section 14.4 lists the Silent as enemies under "People (the cruelty)".

**Lore.** O1: only humans are people. The Silent are **people at the far-gone stage of ash-lung**
(CANON fact 17). They are not cruel and they choose nothing.

**Change.** The Silent **deal no damage**. They cannot be killed for salt. They walk at the player in
silence, they body-block, and they are put down as a mercy: a kill that lands them on the **"did not
answer"** line and never on the kill tally. The horror is that they cost you nothing to kill and
something to have killed.

*Why it matters:* the brief's own rule is that humans are the only ones who are cruel on purpose.
Making the sick into a damage source would have broken it.

*Sources: `CANON.md:26` (O1, only humans are people); `CANON.md:163` (fact 17, ash-lung);
`bestiary.md:563` (the far-gone sick: grey crust, a wet cough, no words).*

---

## 8. Stage order follows the road

**Brief.** 3 Halwen House, 4 The Roofed Mile, 5 Rook's Stair, 6 The Drowned Measures.

**Lore.** The Bell Road runs, in order: the Last Gardens, **Halwen House**, Darnel Cross, the Old
Charcoal Lodge, the Split Kiln, the Bell-Tender's House, **Rook's Stair**, **the Roofed Mile**,
Saint Vey's Fold, the Bent Span, Coldbarrow, the upper road (`atlas/3`). The Drowned Measures is
**reached from the Bell Road's quarry branch past Rook's Stair** (`atlas/6`).

**Change.** The road north is walked in the lore's order:

| # | Stage | Why here |
| --- | --- | --- |
| 1 | The Outside Fire (the Wayfarer's Watchhouse) | the fen end of the Causeway |
| 2 | The Old Causeway | the raised road |
| 3 | Halwen House | the Bell Road's first great house |
| 4 | Rook's Stair | the quarry branch |
| 5 | The Drowned Measures | off that branch, past Rook's Stair |
| 6 | The Roofed Mile | back on the road, north of the quarry |
| 7 | Greystair and the Venting Slopes | the first Citadel |
| 8 | The Low Galleries | under the Citadels |
| 9 | The Slagcrown and the Weight Gate | the greatest Citadel |

Boss order, unlock order and the warning book's page order move with it. The Roofed Mile's crawler
is now stage 6 and Rook's Stair's troll is stage 4.

*Sources: `atlas/3-the-bell-road.md:22` ("Layout (south to north)": the Last Gardens, Halwen House,
the Old Charcoal Lodge, the Split Kiln, the Bell-Tender's House, Rook's Stair, the Roofed Mile...);
`atlas/6-the-drowned-measures.md:12` ("reached from the Bell Road's quarry branch past Rook's
Stair"); `atlas/3-the-bell-road.md:238` (Rook's Stair, the Held Benches).*

---

## 9. The Constance is not in the Drowned Measures

**Brief.** section 17.6 boss: "The hulk-conger of the Constance".

**Lore.** The *Constance* is a drowned royal ship **in Wexhaven's inlet**, 315 miles south, at the
far end of The Long Account's whole journey (`the-round-and-the-long-account.md`; `atlas/7`). The
hulk-conger is canon, a big eel kin to the fen's harrow eels, holding one dark space and striking
whatever enters it, and its canon homes are the drowned hulls at Wexhaven and the Lazaret hulks. The
Drowned Measures' own named hunter is the **reed-jaw**: a long ridge-backed ambush animal of the
reeds, seen as a head-and-ridge shape that could be floating timber.

**Change.** Stage 5's boss is **the Reed-Jaw of the Long Cut**. The hulk-conger keeps its canon home;
it appears in secret stage C (Gull's Throat), and as a rare elite in a drowned barge in the Measures
if wanted. Never the *Constance*.

*Sources: `atlas/7-orlen-beyond-the-fen.md:76` (The Constance, in Wexhaven's inlet);
`the-round-and-the-long-account.md:775` (the *Constance* at the first landing);
`atlas/6-the-drowned-measures.md:34` (Reed-jaws: "the lore names them and leaves them undescribed").*

---

## 10. "Cold light" is a craft, and there are six crafts

**Brief.** section 11: "The novel has three workings in the whole book. This game allows three per run...
Write at least 12 workings," with prices invented per working (-15% Max Health, etc.).

**Lore.** Orlen's old magic was **six trades**: **Holding, Cold light (glim), Carrying, Marking,
Keeping, Staking**, plus the Older Work that is not a craft. Each was kept by the people whose work
needed it. **Every working costs something: warmth (the fen calls it the chill), salt, sound, or
time.** Three workings appear in the novel: the **ward** spoken over salt across a door (Margery,
learned from Grisel), the **naming** at the Drowned Graves, and **cold light**, taught to Rafe by Aud
in chapter 26. A living person can do only small things: nothing a working does throws fire or moves
a wall, and the great works still standing were made by trades that died in S.1 and S.2.

**Change.** All workings are recast into the six crafts, and every price is stated in one of the four
canon currencies. The twelve are in `design.md` section 10. Three of them are the novel's three, unchanged.
No working may do anything a living hand could not do, and no working names, shows or predicts
anything.

**proposal:** the fourth price, for the Marking craft, is **a mark's own fading**: the gift lasts
until the next fire and must be paid for again. Canon already says a mark holds for hours, then fades
and must be renewed at a fire, so this costs nothing new to the world.

*Sources: `atlas/0-how-to-read.md:32-45` (the six trades and the Older Work);
`the-round-and-the-long-account.md:253` (workings and marks), `:278` (Cold light, the Hewers' Lodge);
`CANON.md:29` (O4, small magic); `atlas/5-the-deep.md:54` (cold light spoken aloud: "the quietest
sound a person makes").*

---

## 11. The Bright Hour is a clear day

**Brief.** section 19.7: a seeded 25% chance per run, at most once a run.

**Lore.** **O8**: the sun crosses the sky; after the first day, of every twenty days about **five are
coal days, eleven coin days, and four have a clear noon** from about ten in the morning to half past
two. **Which day is which is fixed by the day's number.**

**Change.** The day's number sets the sky before the player leaves the Tally Room. A **clear day**
gives the Bright Hour, inside its clear noon. The chance is four days in twenty, by the calendar,
not a per-run roll. The Tally Room's board shows the coming day's face, because the calendar fixes it
and everyone in the fen can count. A coal day makes the run genuinely darker, and an Approved Load
tier can force one.

*Sources: `CANON.md:33` (O8, the sun's day: five coal, eleven coin, four clear in twenty);
`atlas/2-the-blackfen.md:30` (the fen's names for the weathers); `the-smothering.md:325`.*

---

## 12. The weathers are canon's six

**Brief.** section 16: squall, fog, Dead Calm, the Bright Hour.

**Lore.** Six weathers: **Ashfall, Miasma fog, Sleet, Cinder-squall, Hoarfrost, the Dead Calm.**
Sleet comes on coin and coal days only: one spell on a coin day, two on a coal day; a clear day stays
dry.

**Change.** The six by name and by rule. "Squall" is always **cinder-squall**. The Bright Hour is not
a weather; it is a clear noon on a clear day.

*Sources: `atlas/2-the-blackfen.md:30` ("All six of the Smothering's weathers, and the fen has its own
names for them"); `the-smothering.md:325-333` (the cycle and what each does); `CANON.md:231`.*

---

## 13. Threat colours

**Brief.** section 5 and section 20.2: enemy threats use "the only saturated warm reds and acid greens on screen";
acid green and warning red are reserved for threats, and bloom is grey-green.

**Lore.** Painted palette, no neon, bloom is grey-green; the reference rule is that the picture stays
dreadful and never cartoonish.

**Change.** The reservation is kept, the hues are narrowed. Threat **red** is coal-sun red at full
saturation. Threat **green** is a **sulphur-yellow-green used only inside telegraph shapes and spore
clouds, never on a body**. Bodies keep the painted palette. Acid green is never a fill colour.

*Sources: `CLAUDE.md:185-186` (four lights; teal belongs to the bloom, pale blue to workings);
`atlas/0-how-to-read.md:22` (no beast works magic).*

---

## 14. The Unnamed are missing from the brief, and they are the best thing in the canon

**Brief.** No Unnamed anywhere. The dead rot into blooms and are dealt with by fire, lime, salt and
walking over them.

**Lore.** The **Drowned Graves** are in the Watchhouse yard's flooded south-east corner, and
**three figures stand in them**. The Unnamed walk. Cut one down and it rises whole again; it lies
down for good only when someone kneels at its grave and **speaks a name**. Why they rise is one of
the three shut doors and stays unsettled. The naming is a working of the Keeping craft.

**Change.** The Unnamed are **stage 1's signature enemy** and the game's first moral mechanic (see
`design.md` section 18.15). Standing at a grave and speaking a name is a real action with a real cost: it
takes **time** (a working's fourth price), it is loud, and it can only be done at the grave. This is
what the Muster Book weapon and the "Named" status were always reaching for, and it gives the muster book,
the fire and the yard one job.

*Sources: `atlas/2-the-blackfen.md:58` (zone 8, the Drowned Graves: "Three Unnamed stand here",
`atlas/2-the-blackfen.md:44` for "three figures standing in the flooded south-east corner");
`act-one-the-outskirts.md:561` (the graves), `:580` ("kneels at its stone and speaks a name over it");
`bestiary.md:643` (how long the naming takes, and a blow breaks it off); `CANON.md:183-185`.*

---

## 15. Non-final runs must not end in the thaw

**Brief.** Every non-final stage ends at 30:00 with "The Thaw": the ground thaws, a grey light rises.

**Lore.** The thaw is **spring**, after the winter: a few grey weeks of mud and flood, the thing
everyone is trying to last until. A run is one night. Eight stages cannot each end in spring.

**Change.** Non-final stages end at 30:00 with **the Grey Hour**: the night's last hour, the ash
going pale, the horde tripling for sixty seconds, and first light on the reeds. It is mechanically
identical to the brief's thaw. **The Thaw** is reserved for the true end of stage 9 and for the
game's ending screen.

*Sources: `CANON.md:127` (fact 9: "Spring still comes, barely: a few grey weeks of thaw when the ash
turns to mud"); `the-smothering.md` (the six weathers, for what a night is).*

---

## 16. The Kept Hand cannot be a playable character

**Brief.** S3: "an old relic carried by an empty Watch coat; no face, no voice", flagged by the brief
itself as a canon check.

**Lore.** O1: **every playable background is human**. Separately, the Kept Hand is a saint's hand
(**Saint Edras of the Kept Hand**) and a carved hand closed round a flame over the chapel door at
Halwen House. It is a relic and a chapel, not a person.

**Change.** The Kept Hand is out of the roster and its slot goes to a human. **proposal.** The
replacement is **Wat Corley**, the old bell-keeper of Hob's Height who lives alone on the Spiral and
keeps the bells wrapped: human, canon, strange, and mechanically unlike anyone else. His trait: **the
Quiet kept.** Sound-making weapons are silent and weaker for him; he sees the Silent and the Unnamed
outlined in the dark; his cold light lasts half again as long; and the Hand Bell in his hands does
not ring, it only carries (its sound reaches the next bell, eight miles off, and returns). Alternative
if sleeves prefers a woman: **Gise Marrable**, whose husband was in the Slagcrown's workings when the
Vaults were broken. In `design.md` he sits in **S2**, the slot the brief gave Gytha, since she became
the patron; **Gise Marrable** keeps S3. See 36 for why the label moved.

The Kept Hand stays exactly what it is: a saint, a carved hand over a chapel door, and the covenant
that answers for it (`design.md` 18.12).

*Sources: `CANON.md:26` and `:196` (O1; the eight human backgrounds);
`halwen-house-private-chapel.md:1` and `:23` (the Chapel of the Kept Hand, Saint Edras of the Kept
Hand).*

---

## 17. Gytha Marrin should not fight

**Brief.** S2: playable, never walks, carried in a chair by two porters at 70% speed, twice the size,
Reach across half the screen, Might +50%.

**Lore.** Gytha Marrin, the Receipt-Wife, is a **customs tallywoman on the Burned Quay at Wexhaven**,
twenty-eight years at the same chair, 315 miles south of the Watchhouse, and she has never been
north. Her whole function in the world is to take a receipt from everyone who walks down the Salt
Trace and write them a line for it.

**Change.** **proposal.** She stays the game's patron and its voice, not a playable body: the Tally
Room is her counter, every end screen is a receipt in her manner (one line, a name, a date, what was
owed), and the salt in the Tally Room is hers. **The muster book's own lines stay in the Watch's
hand**, as canon has them: Pim's last entry, then Rafe's line for Merrick with Margery's fair copy
under it. If sleeves wants a chair-borne character, the lore-native candidate is **Marget Sayle**
(62, the witness, the bothy under the ledge), though she walks in the novel; or a new carried
character from the fen, which needs a name.

*Sources: `people/the-round.md:8` (Gytha Marrin, the Receipt-Wife);
`atlas/7-orlen-beyond-the-fen.md:56` and `:62` (the Burned Quay, her chair, twenty-eight years);
`the-round-and-the-long-account.md:728` (the receipts she took).*

---

## 18. Brass tags at the Naming Stone

**Brief.** Brass tags are a currency, returned to the Naming Stone; every 100 tags the stone takes a
name and the player picks a boon.

**Lore.** Brass tags are **miners' identity tags**, worn on a cord; the miners' dead lie on the
venting slopes with their tags still on them; the tags can be matched against the Seam Roll to give
the dead their names. The Naming Stone stands **on the road out of the yard**, its top worn smooth
and paler than its sides, names scratched into it in many hands. The Watch laid its dead on it so
their names could be spoken into their mouths before the lime, and **when a body had no name the
warden wrote down what it carried**. Three short names were scratched into it this autumn, in
different hands, and none of them belonged to the dead limed.

**Change.** The mechanic is kept and marked **proposal**. It is thematically exact, a tag is a name,
and the Seam Roll makes the tags mean something. What is new is that the stone *takes* them: canon
has the warden write down **what a nameless body carried**, and a brass tag is exactly that, so the
mechanic is that practice repeated a hundred times.

*Sources: `act-one-the-outskirts.md:240` (the Naming Stone at (6.0, 12.5), "on the road out"; the
names spoken into their mouths; "the warden wrote down what it carried"); `:252` (the three names,
"none of the dead limed"); `atlas/2-the-blackfen.md:57` (zone 7, "on the road out of the yard");
`acts-two-and-three.md:352` and `atlas/4-the-citadels.md:213` (brass tags on the miners' dead),
`:226` (the find); `items-and-texts.md:472` (Name-Token).*

---

## 19. Merrick as the Deserter's companion

**Brief.** section 19.10 `[OPEN]`: on by default, an option, or off.

**Lore.** Merrick Thwaite **follows Rafe down the stair** and is with him through the winter; he is
the one who says "look at that", and those are his last spoken words at the end of chapter 25. He
fights Rafe on the scaffold at the Weight Gate, silent and dying and not knowing him, then comes back
for a few breaths at the Mouth, signs the passage rule and *go*, and drops the gate.

**Change.** **On by default for Rafe, and only for Rafe.** For every other character he is absent, or
a companion found on stage 1. His cough follows the canon ladder. His bark set stops at the silence
stage, and the mix thins with it.

*Sources: `people/the-novel.md:31-32` (the ladder, N15, and "look at that"); `CANON.md:163` (fact 17);
`acts-two-and-three.md` (the scaffold, the Mouth).*

---

## 20. One Grey Cough, not two

**Brief.** Merrick's trait: at 20:00 "cannot be healed by pickups"; separately section 19.3 says at 15
stacks "health pickups heal half".

**Lore.** N15: the cough runs the lore's stages through the novel: **cough, crust, silence, and a
moment that may be a return**.

**Change.** Both use one ladder, section 19.3's: cough at 5, crust at 10, silence at 15. Merrick's trait is
that the ladder advances on the clock rather than on spores, which is what makes watching him worse.

*Sources: `people/the-novel.md:31` (N15: cough, crust, silence, a moment that may be a return);
`CANON.md:163` (fact 17, the stages).*

---

## 21. The Weight Gate ending

**Brief.** section 17.9 `[OPEN]`: solo, either the player stays below or Merrick does it; in co-op one
player must stay.

**Lore.** In the novel **Merrick** comes back at the Mouth, signs *go*, and drops the gate from below.
**One knock.** Rafe never sees what happens to him. Canon's other endings for the same place (in
`acts-two-and-three.md`) need the **Coldbarrow hoist and chain and hands to draw the props**: the
listeners, or the Company. There is **no boss** at the Mouth, and the Dead Calm there does not lift.

**Change.** Solo: **Merrick does it.** The player hears the one knock, and the screen holds on the
closed gate. Co-op: the gate is worked by the company (hoist, chain, hands on the props) and
**whoever stands below does so by their own choice**, with a volunteer prompt and no default. The
rarest book line, *Held the gate*, goes to that player. Nobody is ever assigned it.

*Sources: `acts-two-and-three.md:199` and `:204` (the Weight Gate and its unused machinery);
`people/the-novel.md:32` (Merrick at the Weight Gate, silent and dying); `people/the-novel.md:34`
("and *go*, and drops the gate from below. One knock. Rafe never sees what happens to him").*

---

## 22. The three workings a run may hold

**Brief.** Three workings per run, found at minutes 8, 16 and 24, each guarded by an elite, each
permanent, each with a printed price.

**Lore.** Consistent with O4 and with the novel (three workings in the whole book), and with the
rule that a working costs warmth, salt, sound or time.

**Change.** Kept, with one addition: the three are found **at the three places the novel puts them**,
where the stage allows: a hearth or a door (the ward), a grave (the naming), and a dark place with
bad air (cold light). Stage 1 has all three, which is why stage 1 teaches the whole game.

*Sources: `CANON.md:29` (O4, small magic); `the-round-and-the-long-account.md:278` (cold light, made
for bad air); `atlas/2-the-blackfen.md:67` (the ward over salt; the naming; the workings at the
house). Three in the novel: the ward, the naming, cold light in chapter 26.*

---

## 23. The listeners and the bell

**Brief.** The listeners are neutrals; weapons never hurt them; saving them is a kindness.

**Lore.** The listeners keep the **Quiet**; they believe the ringing of S.0 and S.1 woke or called
something, which is why they wrap the bells. Aud refuses to burn.

**Change.** Kept, plus one rule the brief was missing: **ringing a bell near a listener costs their
trust.** They leave, the kindness is lost for the run, and at six listeners lost a stage's hidden
reward closes. The Hand Bell is the best weapon in the Low Galleries and it is the wrong one to
carry there. That tension is free and it is the point of the stage.

*Sources: `people/the-citadels-and-the-kingdom.md:159` (Aud: *Wants.* The Quiet kept. *Fears.* Noise);
`the-kingdom-and-the-breaking.md:292` ("who keep silence and wrap bells");
`bestiary.md:690` (silences, wrapped bells, the Dead Calm); `atlas/5-the-deep.md:54`.*

---

## 24. Co-op and the netcode

**Brief.** section 23 / section 29 Q9: 1-4 players, reuse The Long Account's networking if it fits.

**Lore / the engine.** `js/net19.js` is a well-documented host-and-guest transport: WebRTC data
channels, a six-letter join code, typed message specs with size/rate/sender validation, reliable and
unordered channels, RTT and stats. It is **two players**, one host and one guest, host-authoritative.

**Change.** The transport, the message-spec layer and the lobby are reused. The Tally adds a
**host-authoritative star**: the host runs one `net19` session per guest, relays between guests, and
sends quantised snapshots with interest management (only entities near each player). Four players is
a new transport layer above net19, not a change to it. Details in `design.md` section 23.

*Sources: `js/net19.js:1-20` (repo root, not `docs/worldbuilding/`: the v1 API contract, "Sessions are
two players: one HOST and one GUEST"); `js/audio.js` for the reused mix.*

---

## 25. Things the brief got right, kept unchanged

Recorded so nobody "fixes" them later.

- **The Watchhouse's 1.35 m doorway** and why it stays that way (`CANON` fact 13). Stage 1's map
  uses it, and the drain under the hearth is the goblins' road in.
- **The Long Stable** as the ogre's feeding ground, with the bone heap that holds Winna's pot and
  Tamsin Gale's kettle hat. The stage 1 boss is the canon ogre in its canon place.
- **The Naming Stone, the Drowned Graves, Withy Bottom (the Spore Hollow), the Causeway Delph, the
  Roofed Gallery, the East Choke Point**: the brief's stage 1 zones are the atlas's thirteen zones.
- **Lime and fire stop the corpse-caps**; the Split Kiln's lime is worth as much for graves as for
  chimneys. The rot mechanic is canon, not an invention.
- **The rot is capped** (one sprout per 2 s per screen), which the lore's ecology already implies:
  corpse-caps fruit in the unburied dead, not in a flood.
- **The Debt, the Long Account, the Approved Load**: all three are canon terms and canon mechanics
  (the Crown's grain receipts; the Crown's unpaid promise; the warning book's entry 14).
- **Wonders** (the gold reeds, the glasshouse dawn, the cold lights, the tarn lights) fit the rule
  that awe appears in the middle of danger and never as a safe rest.
- **Merrick says "look at that"** at wonders. The brief invented the trigger; canon invented the
  line. Together they are the best thing in the game.
- **Knockback, weight classes, hurt-grace, telegraphs, the effect limiter, the fixed 120 Hz step**:
  no lore touches any of it, and all of it is good.

*Sources for the list above: `CANON.md:146` (fact 13, the Watchhouse), `:160` (fact 16, lime),
`:157` (salt); `atlas/2-the-blackfen.md:36-60` (the thirteen zones), `:67` (the old magic);
`act-one-the-outskirts.md:240` (the Naming Stone), `:561` (the graves), `:601` (the graves and the
stone as "the same custom at two ends"); `items-and-texts.md:242` (a bent nail at a roadside shrine);
`the-warning-book-s30.md:19` (pages of 0.01 kg).*

---

## 26. Edda's weapon

**Brief.** Weapon 9, Watch Crossbow, "Starter of Edda".

**Lore.** Edda Wray fights with **her cudgel**: "Edda's cudgel is not an item. It is part of her
model and her attack" (`items-and-texts.md`). She is a stake-hand out of Stakeby, and her father
drove stakes with a **beetle**, the trade's two-handed wooden maul.

**Change.** Edda starts with **Nails**: iron, driven, rooted. It is a stake-hand's weapon, it matches
the nail shrine and the Nailhouse, and it keeps her cudgel in her hand as her model and her melee
animation. The **Watch Crossbow** goes to **Col Wray**, the band's youngest, where a coward's brave
weapon belongs.

*Sources: `items-and-texts.md:334` ("Edda's cudgel is not an item. It is part of her model and her
attack"); `godot-people.md:93` (the cudgel); `CANON.md:193` (fact 19, Edda).*

---

## 27. The Gutter Kin are not enemies

**Brief.** section 14.4: "Gutter Kin: In Halwen House: bursts out of drains and culverts behind the player,
then goes back down."

**Lore.** The Gutter Kin are a **human household of six road waifs**, children who sheltered under the
Roofed Mile and took what was not watched; they hold Halwen's glasshouse range against the Remnant
(O1 revision; `gutter-kin.md`, `halwen-house.md`). They are a faction with names, quarrels and a
negotiated evacuation, not a drain monster.

**Change.** **The Gutter Kin are not enemies.** At Halwen you can drive them off, trade with them or
leave them, and the Remnant wants what they hold. The drain-and-culvert ambushers are **goblins**,
which is what canon puts in the drains.

*Sources: `gutter-kin.md:27` ("They are road waifs... children when they found one another under the
Roofed Mile"); `CANON.md:205` (Q1 settled by O1: the Gutter-kin are human road waifs);
`act-one-the-outskirts.md:147` (the goblins' nest).*

---

## 28. Two books, never one

**Brief.** Kit: "Warning Book, +10% Duration, the warning book". Relic: "The Warning Book ... unlocks
reading the stage's warning-book entry before a run (and its hint)". And the collection ("The Muster
Book") holding "a page for every enemy type killed ... a page for every weapon, kit, evolution,
working and relic found ... and a page for every place visited".

**Lore.** There are two books and they are not interchangeable.

| | Warning book | Muster book |
| --- | --- | --- |
| Who keeps it | Margery Reeve, at the Watchhouse fire, since S.12 | the Causeway Watch |
| Does it travel | **No.** "The book itself does not leave the fire." Its **pages** do: 0.01 kg each, found where their entry happened and returned | **Yes.** Pim Haddow carried it to the Watchhouse about nine weeks before Rafe, and wrote its last entry: four dead, a date, *Deserted: none* |
| What is in it | the beast pages (the bestiary) and the thirty dated entries of S.30 | the roll of names: the dead, and *Deserted* |
| What "Bring the book" means | nothing: it is already there | **this one** |

**Change.** Four fixes.

1. The kit is **Warning-Book Page**, +10% Duration. You cannot carry the book; you carry a page of it.
2. **The relic "The Warning Book" is removed.** The book is not lost and cannot be carried, so it
   cannot be a relic. Its job is done by returning pages: each page returned unlocks its stage's
   **hint** and fills that leaf. The loading-screen entry is still shown regardless, because that is
   the game telling you where you are.
3. **The collection is split.** Run lines, the naming lines and the "carried to the fire" lines go in
   the **muster book**. Beast pages and the thirty entries go in the **warning book**. Weapons, kit,
   evolutions, workings and relics are in neither book in the lore, so they get their own leaves, and
   that is marked as a UI conceit.
4. The replacement relic is **Stott's whittling knife**, from the tower's guardroom (canon lists the
   dead Watchmen's gear, "Stott's whittling knife"), which keeps the count at sixteen.

**Also fixed in passing:** Pim's trait was called "Kept the Book", which is Margery's phrase about the
warning book. It is now "Carried the Book".

*Sources: `the-warning-book-s30.md:19` ("Pages 0.01 kg each. The book itself does not leave the
fire"); `the-warning-book-s30.md:28` (where each page is found); `people/the-watchhouse.md:203`
(Pim: "brought the muster book to the Watchhouse about nine weeks before Rafe, wrote its last entry");
`people/the-watchhouse.md:222` (the four dead in that last entry); `atlas/2-the-blackfen.md:126`
(the tower's finds).*

---

## 29. Nine canon creatures the brief left out

The bestiary gives **17 entries**. The brief uses eight of them. The rest are free and good, and a
horde game needs cheap variety more than it needs new monsters: **Greymaw** (wild dogs, tier II, III as
a pack, and the warning book's own first entry), **ash-rats**, **harrow eels**, **bloodwicks**,
**gallows heron** (it calls others), **peat-boar**, **rustlings** (iron beetles: they eat nails and
hinges, which is a lovely hazard for a nail weapon), **ash-moths** (they come to any flame, so they
come to your fire), and **corpse-caps** (the growth that a body becomes).

**Change.** Add Greymaw, corpse-caps, harrow eels, bloodwicks and rustlings to the first pass. The
rest are spare parts for later stages.

*Sources: `bestiary.md:92` ("Seventeen entries, from beetles to the thing below"); the entries
themselves in `bestiary.md`; `acts-two-and-three.md:183` (the venting slopes, for the brass-tagged
blooms).*

---

## 30. The warning book's thirty pages are the stage openings

**Brief.** section 18.4: "Every stage opens with a short entry from the warning book on screen while it
loads... written in the voice of the-warning-book-s30.md."

**Lore.** The voice exists: thirty dated entries, approved under O10, in Margery's hand with the last
in Rafe's. They are already mapped to places along the road.

**Change.** Use the canon entries rather than writing new ones:

| Stage | Page |
| --- | --- |
| 1 The Outside Fire | 1, *The Outside Fire* |
| 2 The Old Causeway | 6, *The Dry Ways* |
| 3 Halwen House | 12, *The Culvert* |
| 4 Rook's Stair | 10, *Lime* |
| 5 The Drowned Measures | **blank**: the warning book has no entry for the Measures, and a missing page shows its number and nothing else |
| 6 The Roofed Mile | 15, *The Third Arch* |
| 7 Greystair | 25, *The Venting Slopes* |
| 8 The Low Galleries | 26, *The Quiet* |
| 9 The Slagcrown | 27, 28, 29, 30 in order, and 30 appears by itself |

The blank page at stage 5 is the best use of the file: it tells the player the warning book is a real object
with holes in it, and it tells them where they are without a word.

*Sources: `the-warning-book-s30.md:28` ("Where each page is found"); `:152` (page found at Halwen
House, "the cistern vault"); `the-warning-book-s30.md:3` (approved under O10); `CANON.md:35` (O10).*

---

## 31. Halwen's two sealed places

**Brief.** section 17.3: a secret "room nobody claims" opened by the Glass Key; section 19.12: the Chapel of the
Kept Hand's altar.

**Lore.** Halwen has a **cistern vault** (a brick vault the size of a chapel, still black water, old
coins on the floor) and a **private chapel** joined to the family passage by a narrow door, with the
carved hand closed round a flame over it.

**Change.** The sealed room is the **cistern vault**; the covenant recess the chapel answers through is
in the **private chapel** (18.12). Both already exist in the atlas, and the vault's black water gives
the empty room something to reflect.

*Sources: `atlas/3-the-bell-road.md:87` (zone 13: "The cistern vault (new as a site), a brick vault the
size of a chapel, still black water, old coins on the floor"); `halwen-house-private-chapel.md:1`
(the chapel); `atlas/5-the-deep.md:152` (the service passage, cistern vault and lower culvert).*

---

## 32. Playing the dead

**Brief.** Playable Merrick, Pim and Winna, all of whom canon kills or leaves unsettled.

**Lore.** Canon keeps Acts I to III as **"what may have happened that winter"** and assumes none of
their choices. Winna's fate is explicitly unsettled. Pim dies in chapter 21. Merrick stays at the
mouth.

**Change.** The game adopts one sentence as its frame: **every run is what may have happened that
winter.** A run does not correct the muster book and the muster book does not correct a run. That is why Merrick can
be played and still be at the gate, and it is why Winna can stand at the fire without settling
anything. **proposal**, but it is the same move canon already makes, and it is the only way to have
this cast.

*Sources: `CANON.md:54` (the acts "are kept as what may have happened that winter");
`acts-two-and-three.md:3` (same wording); `people/the-novel.md` (Winna's fate left unsettled).*

---

## 33. Proposals that add to canon and need a ruling

| # | Proposal | Why it is worth it |
| --- | --- | --- |
| P1 | Salt is the Tally's currency; the stat is `Measure` | canon money, and the Tally Room becomes about a shortage |
| P2 | The muster book has a fourth line, **did not answer** | the lore's own verdict, and it is the cruellest line available |
| P3 | The **wayfarer's horn** is what is heard at the Order | passing places are cut with one; the ambiguity is canon's |
| P4 | Rafe's third choice at the Order, **Go back** | N2 and the novel's ending both point north |
| P5 | The **Reed-Jaw of the Long Cut** is stage 5's boss | the atlas names the animal and leaves it undescribed |
| P6 | The **Grey Hour** replaces "the Thaw" on non-final stages | eight springs in one winter is not a thing |
| P7 | **Wat Corley** in the roster, in the slot the brief gave Gytha | canon, human, and mechanically strange in a way no other character is |
| P8 | **Gytha Marrin as patron and narrator**, not a playable body | she is 315 miles away and her function is the receipt |
| P9 | **Brass tags at the Naming Stone** | a tag is a name; the Seam Roll makes it mean something |
| P10 | **Ringing a bell near a listener costs their trust** | the Low Galleries' best weapon is the wrong one to carry |
| P11 | **Marks fade and are renewed at a fire** (the Marking craft) | canon already, and it gives every stage a fire to come back to |
| P12 | The **naming at a grave** is a timed, noisy action | it is the Working's price, and it makes the yard a place you return to |
| P13 | **Return-bread on the Causeway**, as road food | the custom is Reedwake's, in the west fen, and canon says it works no magic: it is eaten, never worn |
| P14 | **The tower bell struck once**, its tongue returned | the bell lies on its side in the yard with its tongue gone; the tongue is in the loft, wrapped in a Watch cloak |
| P15 | **Kell Tor's tarn seen from Greystair** | the tarn is at the crag's foot, furthest east, and the lights on it are canon |
| P16 | The chapel's bargain is spoken at the **covenant recess**, and the altar stays empty | canon says the altar holds no treasury and was broken open long before the player arrives; the recess is the room's own subject |
| P17 | The Marking working is called **Call the Roll**, not **Seam Roll** | the canon object keeps its name; the invented thing moves |

**Ruled on 2026-11-20, all seventeen.** P7 (Wat Corley) and P8 (Gytha as patron) in the first pass;
P1-P6, P9-P15, P16 and P17 in the second, **every one as written**. **Still open:** the two names in
34.

*Sources: each P is sourced in the delta that argues for it: P1 in 1, P2 in 6, P3 and P4 in 5, P5 in
9, P6 in 15, P7 in 16, P8 in 17, P9 in 18, P10 in 23, P11 in 10, P12 in 14, P13 and P14 in 35, P15 in
16.7 of `design.md` and in 35, P16 and P17 in 36.*

---

## 34. Names this design must not invent without a ruling

The brief leaves these `[name]` or `[OPEN]`, and the lore does not answer them. They are in
`plan.md`'s question list, not in the build.

- Character 10, the hand from the Split Kiln. **Ruled 2026-11-20: stays open to M4.**
- The Halwen siege captain (stage 3's boss is "one captain who moves between windows"). **Ruled
  2026-11-20: stays open to M4.**
- The third traveller at the Spore-Choked Cart (the lore says nobody knows, and says so in the
  Watchhouse's own words: *The third would not say.*).
- Whether the daily board is online. **Ruled 2026-11-20: local only, no online board.**
- The working title: **The Tally**. **Ruled 2026-11-20: it stands.**

*Sources: `act-one-the-outskirts.md:252` ("The third would not say"); `people/the-watchhouse.md:203`
(Pim dies in chapter 21); `people/the-citadels-and-the-kingdom.md:159` (Wat Corley's bell).*

---

## 35. Five canon claims checked line by line

These five were used in `design.md` as canon roots but had been taken from a search rather than a
reading. Each is now checked against the file named, and four of the five needed changing.

| Claim | What the lore actually says | What changed |
| --- | --- | --- |
| The Naming Stone is in the yard | `atlas/2-the-blackfen.md`, zone 7: "**The Naming Stone,** on the road out of the yard." `act-one-the-outskirts.md` gives it as (6.0, 12.5), "on the road out", its top "worn smooth and paler than its sides" | it is on the **road out**, not in the yard. Fixed in 18 |
| The stone is scratched by nobody knows who | `act-one`: "Three short names were scratched into the Naming Stone this autumn, in different hands, **none of the dead limed**." The hook is that the names match no dead body, not that the hands are unknown | fixed in 18 |
| "Did not answer" is for the ash's own | `acts-two-and-three.md`: the Seam Roll's last entries read "did not answer" in a dozen hands, no payment against any name, and "the phrase is the same verdict the Watchhouse uses for the Ashbound". `bestiary.md`: the Ashbound's second sense is "a verdict on anyone who has stopped answering" | right, and stronger than the design claimed. The line is now the Ashbound's only, and a laid Unnamed is explicitly **not** on it |
| Kell Tor's tarn | `atlas/4-the-citadels.md`: at the crag's foot, "still black water that never freezes and always steams, and at night small pale lights that drift across it and go out"; "most likely marsh gas catching at warm vents". Kell Tor has been sealed since S.1 and "is never entered in the novel" | the wonder is now the lights, in canon's words, not the tarn "lighting". The sightline from Greystair is **proposal** (P15) |
| Return-bread | `atlas/2-the-blackfen.md`, Reedwake: a lost town of moorings in the **west fen**, about twelve miles south of Saint Orra's Steps, abandoned. A loaf baked and set on a mooring post when someone went out, "to be eaten when they came back". "**The return-bread is a custom and works no magic.**" The families keep the custom at Saint Orra's Steps and Dunmere | the kit and the pickup now say plainly it is **food, not a charm**. Its presence on the Causeway is **proposal** (P13) |
| The Bell's Tongue | `atlas/2-the-blackfen.md`: in the tower yard "the bell lies on its side in the mud with its tongue gone"; the tongue "turns up hidden in the bell-loft, wrapped in a Watch cloak" | the relic's place is the **bell-loft**, not the yard. Ringing it is **proposal** (P14) |

**Why this matters more than it looks.** Four of the five were close enough to pass a search and wrong
enough to mislead an artist: a stone on the road turned into a stone in the yard, three names turned
into anonymous graffiti, bread made into a charm, a tongue separated from its bell. None of it changes
a number. All of it changes what a stage looks like.

*Sources, in order of the table: `atlas/2-the-blackfen.md:57` and `act-one-the-outskirts.md:240`,
`:252`; `acts-two-and-three.md:221` and `bestiary.md:550`; `atlas/4-the-citadels.md:186` (the tarn)
and `:196` ("Kell Tor is never entered in the novel"); `atlas/2-the-blackfen.md:639-660` (Reedwake, the
return-bread, "works no magic"); `atlas/2-the-blackfen.md:96` and `:122` (the bell, its tongue, the
bell-loft).*

---

## 36. Five canon objects, checked

The Kept Hand, the Tally Stick, the Bell's Tongue, the Seam Roll and the Nailhouse were all reused in
`design.md` as though their canon meaning were settled. Each is now checked against the file that
defines it. **Three had drifted. Two had not.**

| Object | What `design.md` had | What canon says | Change |
| --- | --- | --- | --- |
| **The Kept Hand** | a relic called *The Kept Hand*, out of Halwen's chapel, unlocking the Kept Hand working; and 18.12: the chapel's **altar** takes a weapon and gives back an evolution | `halwen-house-private-chapel.md`: the Kept Hand is a **carved hand closed round a flame over the chapel door**, fingers polished by touching, the flame chipped. The chapel is Saint Edras's, a local saint of the Keeping, who held a burning storehouse door open until the people inside got out. **"There is no concealed treasury inside the altar."** Someone has already broken the base open and crudely replaced it. The chaplain's cupboard holds **wooden witness tokens marked with the open hand**, held during agreements and returned after, and the file says plainly that someone could carry one south and claim to have witnessed an agreement here | the relic is **a witness token** out of the cupboard: canon's tokens travel and the carved hand does not. The bargain moves from the altar to the **covenant recess** beside it, where the room's own rule is cut into the plaster: *let each obligation be spoken in the hearing of those it binds.* The altar stays empty and already robbed, as canon has it |
| **The Tally Stick** | a relic at **Darnel Cross**, unlocking the end screen's kill graph | the only tally stick in the lore is **Joan Tallis's**: the keeper of the stores carries "a notched tally stick through her belt and a second one behind her ear", notches it as she talks, and is found "in the tally room, or at the Outside Fire counting what the turned-away have". Darnel Cross is an inn with a split beam, a failed well and a custom of paying for a bed with news. No stick | the relic is **Joan's second stick**, found **at the Outside Fire**, and it still unlocks the graph: her stick counts measures in, the graph counts what the night cost. Darnel Cross keeps the bent spoon |
| **The Bell's Tongue** | the tower's bell-loft, wrapped in a Watch cloak; "the bell lying in the yard can be **rung** once" | `atlas/2-the-blackfen.md`: the bell "lies on its side in the mud with its tongue gone"; the tongue "turns up hidden in the bell-loft, wrapped in a Watch cloak" | the place is right and the verb is wrong. **A bell on its side cannot be swung.** It is struck, and the tongue has to be hung back in it first, which is a piece of business the relic should own rather than skip |
| **The Seam Roll** | a relic at the Slagcrown counting house (right), **and** a Marking working of the same name that makes elites drop two glim sparks | `atlas/4-the-citadels.md`: the Seam Roll is the counting house's register of the crews sent down the Black Seam, with each miner's covenant; it is **heavy**; *did not answer* is written in a dozen hands with no payment against any name. `acts-two-and-three.md`: the last crew is the one that broke the Vaults | the relic stays and keeps the name. **The working is renamed**, because a canon object keeps its name and an invented thing moves: **Call the Roll**. You mark a name on the roll, and something answers |
| **The Nailhouse** | an evolution, Nails + Strong Corner: nails pin enemies into rows | `atlas/2-the-blackfen.md`: a real place in the drowned middle, with bog-iron furnaces and a **nail-loft where every nail is counted and tallied by the hundred: "At the Nailhouse a nail is money."** `CANON.md` fact 12 lists it among the places held in archive | **no change.** The design names an evolution after a place and never moves the place, claims the player visits it, or gives the name to a character. Rows and counting by the hundred are the forge's own idiom |

**proposal:** two things here are new rather than corrected, and are now listed as **P16** (the bargain
spoken at the covenant recess) and **P17** (the working renamed Call the Roll).

**What this turned up that was not a canon question.** `design.md`'s roster already puts **Wat Corley**
in **S2**, the slot the brief gave Gytha, and **Gise Marrable** in S3. Delta 16 and P7 called Wat
Corley "S3" because the brief's S3 was the Kept Hand. The ruling is unaffected: the Kept Hand is out
and Wat Corley is in. But the label was wrong in three places and is corrected in those three. The
traits sit the right way round (the bell goes with the bell-keeper, the roll with the woman looking
for a name in it), so no swap was needed, only honest numbering.

*Sources: `halwen-house-private-chapel.md:9` (the carved hand), `:23` (Saint Edras, of the Keeping),
`:170` (the spoken obligation), `:184` ("no concealed treasury inside the altar"), `:186` (already
broken open and crudely replaced), `:295` and `:305` (the witness tokens, and carrying one south);
`people/the-watchhouse.md:66` (Joan's two sticks), `:68` (she notches it as she talks), `:71` (the
tally room, the Outside Fire); `atlas/2-the-blackfen.md:96` (the bell on its side), `:122` (the tongue
in the loft, the Watch cloak); `atlas/3-the-bell-road.md:114` (Darnel Cross) and `items-and-texts.md:414`
(news for a bed at Darnel Cross); `atlas/4-the-citadels.md:58` (the Seam Roll at the counting house),
`:72` ("The Seam Roll, heavy"), `acts-two-and-three.md:202` (the register and the covenants), `:373`
(the Slagcrown's register); `atlas/2-the-blackfen.md:670-687` (the Nailhouse), `:687` (the nail-loft,
"a nail is money"), `CANON.md:140` (fact 12).*
