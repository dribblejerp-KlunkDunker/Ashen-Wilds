# The Tally: design

**Status: proposal for sleeves. M0.** This is the build brief for *The Tally*, adapted to the lore of
Ashen Wilds after reading `docs/worldbuilding/` in full and The Long Account's engine. Every place it
departs from the brief is recorded in `lore-deltas.md`. Where this file and the lore disagree, the
lore wins and this file is wrong.

*The Tally* is a top-down horde-survival game, in the shape of Vampire Survivors and in the world of
Ashen Wilds. It is a sister to **The Long Account**, which is first person and set a week after this
game's last night. This game is **the winter of S.30**: the tower has fallen, the fen is awake, and
the road north ends at a gate nobody finished.

**v1 is three of the nine stages.** The whole road is designed here because the design has to be
whole; the first release builds the first three nights. Section 26 is the cut, and it is the section
to read first if you are costing this.

---

## 0. The framing that makes the cast possible

Canon keeps Acts I to III as **"what may have happened that winter"**, and assumes none of its
choices. The Tally adopts that framing as a rule of the game:

> **Every run is what may have happened that winter.**

That single sentence is why Merrick can be played and still die at the gate, why Pim can walk out of
the White Trees, and why Winna, whose fate canon leaves unsettled, can stand at the fire. The muster book
records what the run did. It does not correct the lore. It is the same move canon already makes.

---

## 1. The pitch and the six pillars

It is the winter of S.30. The tower has fallen. What takes the Blackfen at night is not one thing but
all of them: goblins out of the drains, orks down the Causeway, blooms walking up out of the reeds
with red thread still at their cuffs. You stand by a fire with one weapon and a book of names.

**Keep the fire. Keep the names. Last until first light, then go north and drop the gate.**

| # | Pillar | What it means in play |
| --- | --- | --- |
| 1 | **Hold the line** | Survival is the verb. Standing ground is rewarded; so is moving well. |
| 2 | **Everything costs** | Power is borrowed. Warmth, salt, sound and time are the four prices. |
| 3 | **Names matter** | The dead are counted and can be *put to rest*. The naming is a mechanic. |
| 4 | **Wonder in the dark** | Every stage has one moment that makes you stop. Stopping is dangerous. |
| 5 | **Crunch** | Hits land with weight, kills pop, the horde breaks like surf. |
| 6 | **The screen reads** | At 1,500 enemies you can still see yourself, the threats, the pickups. |

---

## 2. The run

**Shape.** 30:00, one night. Pick a character and a stage; survive. Stages are scripted minute by
minute. Bosses at fixed times. Pause on level-up, strongbox, and the Order.

### 2.1 The Grey Hour (every non-final stage)

At 30:00 the night's last hour comes. Ash goes pale, the reeds show, and the spawn rate **triples for
60 s**. Survive it and the line is **Held**. Die in it and the line is **Held, and fell at first
light**: a win with reduced salt.

There is no unkillable reaper and no time-out. The Grey Hour is the climax and it ends.

### 2.2 The Order (20:00)

A **cinder-squall** comes in. Sound drops to a rushing roar, rain sheets, and somewhere in it a
**wayfarer's horn** sounds off the road: a passing place's horn, or the Watch's recall. In the
cinder-squall nothing can be heard.

The screen holds, the mix thins to wind, and one line of text appears, in the Watch's voice, once.
It is the roster's standing order, word for word:

```
Fall back to the Watchhouse. Bring the book.
```

The book the order means is the tower's **muster book**, the roll of names: it is the one that
travels. The warning book is already at the Watchhouse and never leaves the fire.

Then the prompt, for ten seconds: **"Did you hear the order?"**

| Answer | What happens |
| --- | --- |
| **I heard it.** | Extract on the spot with **60%** of the run's salt and **every relic** found. The line reads **Deserted**. No shame screen: just the line. |
| **I heard nothing.** | The run continues. All rewards from 20:00 to the end are **x1.5**. |

Running is never punished beyond the reward, and some unlocks require it. This is the game's first
moral weight and it is the novel's own question. **Rafe** gets a third answer: **"Go back."**

### 2.3 Death

Health to zero ends the run on a quiet screen: the muster book, a pen moving, the line for the dead.
Salt and brass tags are kept at **100%**. Strongbox contents not yet opened are lost.

### 2.4 The muster book's four lines

| Line | Entry condition |
| --- | --- |
| **The dead** | died |
| **Held** | survived to first light |
| **Deserted** | took the Order and left |
| **Did not answer** | the Ashbound: the Silent put down, and any who stopped answering |

Each is a real line in the muster book. Patterns in it unlock characters and stages: ten
**Deserted** lines, a full page of **Held**, a page of **Did not answer** that is longer than you
meant it to be.

---

## 3. Movement (exact numbers; tune from here, never drift)

World unit: **1 tile = 64 px** at the 1920x1080 reference view. The camera shows about 30x17 tiles.

### 3.1 Walking

| | |
| --- | --- |
| Base top speed | 4.0 tiles/s (256 px/s); characters vary +/-15% |
| Acceleration to top | 70 ms |
| Deceleration to zero | 55 ms |
| Turn-around (full reverse) | 90 ms total, no slowdown arc |
| Keyboard | eight-way, diagonals normalised |
| Stick | radial dead zone 0.18, outer 0.95, response exponent 1.4 |
| Simulation | fixed **120 Hz**, rendered with interpolation |

### 3.2 The Watch Step

| | |
| --- | --- |
| Distance / time | 3 tiles in 0.18 s |
| Invulnerability | 0.22 s (the window is longer than the move) |
| Cooldown | 2.4 s, one charge (kit may add a second) |
| Input buffer | 120 ms |
| Direction | movement direction, else facing |
| Perfect step | a 40 ms time slow, a white edge flash, a soft bell. No other reward |

### 3.3 Collision

Player hurtbox: a circle of **radius 14 px** on a 64 px sprite (about 40% of the visible body), so
gaps can be slipped by skill. Walls resolve circle-vs-segment with corner rounding and slide, never
stick. Enemies separate softly against up to 8 neighbours from the spatial hash and push the player
only very lightly, except weight classes that body-block: ork shields, trolls, ogres.

### 3.4 Getting hit

0.35 s hurt-grace, a red rim flash, a **2-frame hit-stop on the player sprite only**, a directional
screen nudge capped at 6 px, a low thud. Player damage numbers are never shown; the health cord ticks
and shakes once. Under 25%: heartbeat in the mix, a vignette, and the fire drained from the UI toward
grey.

### 3.5 Facing

Facing follows the last movement direction. Aiming uses, in order: nearest enemy, facing, or the
mouse/right stick when **Aimed Watch** is on (off by default).

### 3.6 The feel gate

`tests/feel.html`: a flat yard, three dummy goblins, an overlay of speed, acceleration, and
input-to-motion latency. Target: **<= 1 frame** from input read to first motion. The gate for M1 is
sleeves at the controls saying the movement is right.

---

## 4. Camera and readability

Top-down, flat play space, art drawn with a slight 3/4 tilt so faces and fronts read.

- **Camera:** critically damped spring, no overshoot; lead up to 1.5 tiles in the direction of
  travel; **no lag on the Watch Step**.
- **Shake:** capped and summed. Boss slam 12 px, elite death 4 px, everything else 0. Slider plus off.
- **Draw order (back to front):** ground, ground effects (lime, salt, blood, water), pickups,
  corpses, small enemies, large enemies, enemy projectiles, player projectiles, player, telegraph
  rings, damage numbers, UI.
- **The four lights** (canon, and the strongest art rule in the repo): **yours is tallow yellow and
  small; the land's is ember red and vast; teal belongs to the bloom; pale blue belongs to
  workings.** Enforced in `data/palette.js` as reserved ranges, checked by a test.
- **Threat contrast:** enemy projectiles and telegraphs use the only saturated **coal-sun red**, and
  the only saturated **sulphur green**, and that green appears only inside a telegraph or a spore
  cloud, never on a body. Player effects are bone, ember, salt-white and **pale blue**. Nothing the
  player fires can look like something that hurts them.
- **Player beacon:** a thin bone-white ring and a faint glow, always drawn above enemies. Enemies
  within 2 tiles fade to 70%.
- **Effect limiter:** over budget, cull ambient, then kill puffs, hit sparks, weapon effects.
  **Telegraphs are never culled.**

---

## 5. Combat

**Stats.** Max Health, Recovery, Armour (flat per hit, minimum 1 damage), Move Speed, Might, Area,
Speed, Duration, Amount, Cooldown (cap 75%), Reach, Luck, Growth, **Measure** (salt %), Debt.

**Damage.** `weapon_base x (1 + Might) x crit x status_bonus`. Crits: base 5%, x2, raised by Luck.
Damage numbers small and short; crits larger and ember-gold; hideable.

**Knockback.** Weight classes: feather, light, medium, heavy, immovable. Applied as an impulse with
drag, never a teleport. Immovables flash and never move.

**Statuses.** Burn (DoT; stops troll regeneration; spreads from limed ground) - Limed (-30% speed,
+20% damage, blooms take double) - Salted (blooms and spore-things take damage per second; others
merely slowed) - Rooted - Rung (0.6 s, diminishing) - **Named** (+25% damage; cannot rot; drops
brass) - **Grey Cough** (player).

**Enemy contact damage** applies once per hurt-grace window however many enemies touch. Swarms are
dangerous by blocking and chipping, never by instant shredding.

---

## 6. Growth inside a run

**Embers.** Dull red 1, amber 5, white-hot 25, glim spark 100 (elite). They drift in inside Reach and
snap at the last half tile. The pickup sound rises a semitone per ember collected within 0.4 s.
**Cap: above 400 on the ground, new embers merge into the nearest and raise its value.**

**Level curve.** `5 + 10*L` for L < 20; `+13` per level 20-39; `+16` from 40. Levels **20** and
**40** give a one-time **+100% Growth** for that level only: the second wind.

**The muster book page.** Pauses. Three cards, four with Luck. Each card gives the item, the next
level's effect in one line, and a small **seal-mark** if it is part of an evolution, showing its
partner.

| Action | Cost |
| --- | --- |
| **Turn the page** (reroll) | limited uses, from meta |
| **Leave it** (skip) | nothing, refunds a little XP |
| **Strike it out** (banish) | never appears again this run; limited uses |
| **Borrow** (the Debt) | take a second card from the same page; Debt rises |

**Slots.** 6 weapons, 6 kit. Weapons to **8**, kit to **5**. A weapon at 8 with its partner kit owned
evolves at the next strongbox.

**Late growth.** With every slot full and maxed, level-ups offer **Marks**: small permanent increments
(+1% Might, +0.1 Recovery...), so a level-up never stops mattering.

---

## 7. Weapons (16)

Every weapon has a sound signature, a hit spark, and a kill effect in its own material: steel rings,
iron clanks, lime hisses, fire crackles, cold light chimes. A weapon's cooldown is a ring on its slot
icon. Nothing the player fires is red or sulphur green.

**v1 ships eight of these, chosen so that each has an evolution partner. Which eight is in 26.** The
other eight are the same table, later.

| # | Weapon | Role and shape | Path (short) | Starter |
| --- | --- | --- | --- | --- |
| 1 | **Watch Sword** (glim-marked issue blade) | a fast crescent cut in the facing direction, alternating sides | +damage, +1 cut behind, +area, cut leaves a 0.3 s glim trail | Rafe Sedley |
| 2 | **Billhook** (Watch bill) | a slow wide 180-degree hook-sweep that pulls enemies one tile in before cutting | +arc, +pull, +damage, second sweep at 6 | Merrick Thwaite |
| 3 | **Lime Sack** | lobbed sacks that burst into white patches of lime | +patch size, +duration, +1 sack, patches merge | the Split Kiln hand |
| 4 | **Nails** (the nail shrine's iron) | thrown nails in a line; pierce; chance to Root | +nails, +pierce, +root, fan spread | Edda Wray |
| 5 | **Hand Bell** (a Hob's Height bell) | every few seconds a ring: a shockwave that pushes back and Rings small foes | +radius, +stun, faster, damages at 5 | - |
| 6 | **Lantern** | lanterns orbit and burn what they touch | +1 lantern, +orbit, +burn, speed | Marget Sayle |
| 7 | **Muster Book** | pages fly to the toughest nearby enemy and mark it **Named** | +pages, +mark duration, Named deaths burst into torn-page shrapnel | Pim Haddow |
| 8 | **Bloomery Hammer** | thrown hammer that arcs out and returns, hitting twice | +hammers, +size, +knockback, faster return | Tobin Crane |
| 9 | **Watch Crossbow** | heavy bolt to the nearest enemy; hard knockback; pierces 2 | +bolts, +pierce, +reload, ricochet once | Col Wray |
| 10 | **Salt Pouch** | a ring of salt grains; Salted; savage against blooms | +radius, +damage, ring pulses outward at 6 | Grisel |
| 11 | **The Ward** | a ward-circle that blocks one hit, breaks, repels, recharges | +charges, faster, breaking damages, heals 1 | Margery Reeve |
| 12 | **Hoist Chain** | a chain whips out in a long arc, wraps and drags an elite | +length, +damage, wraps 2, drag throws the elite into others | - |
| 13 | **Peat Fire** | drops a smouldering peat fire behind you every few seconds | +fires, +burn, +duration, fires spread to each other | Winna |
| 14 | **Brass Tags** | thrown tags ricochet between enemies | +tags, +bounces, +damage, chance to Name on hit | - |
| 15 | **Reed Spear** | a long piercing thrust forward, then a second | +length, +thrusts, +pierce, leaves a slowing wake | - |
| 16 | **Cold Light** (taught, never issued) | a thin beam of pale blue that sweeps a quarter-circle | +width, +arc, +damage, lingers as a cold line | Aud |

**Note on names.** Every one of these is a canon object or trade: the glim-marked issue sword, the
Watch bill, the Split Kiln's lime, the nail shrine's iron (*A NAIL FOR AN OPEN DOOR. TAKE ONE AND YOU
OWE ONE*), a Hob's Height carrying bell, the Drowned Lantern's oil, the muster book, the Bloomery
Company's hammer, a Watch crossbow, the Cold Passing's salt, Margery's ward over salt, the
Coldbarrow warehouse hoist, peat, miners' brass tags, reed-cutting, and Aud's cold light.

---

## 8. Kit (16 passives)

**v1 ships eight, chosen so that every shipped weapon has its partner. Which eight is in 26.**

Five levels each.

| Kit | Per level | Canon root |
| --- | --- | --- |
| **Glim Mark** | +8% Might | a mark cut into slag-iron and renewed at a fire |
| **Kiln Ash** | +10% Area | the Split Kiln |
| **Bellows** | -6% Cooldown | the Greystair bloomery |
| **Whetstone** | +5% crit | Watch kit |
| **Good Boots** | +8% Move Speed | the Corpseway's miles |
| **Watch Cloak** | +1 Armour | the Watch's grey cloak |
| **Carter's Hitch** | +25% Reach | the carter's-hitch rope the grey rags carry |
| **Return-Bread** | +0.2 Recovery | a loaf left on a mooring post for someone who came back; food, not a charm |
| **Warning-Book Page** | +10% Duration | a page of the warning book, found where its entry happened |
| **Brass Tag** | +10% Luck | the tags on the miners' dead |
| **Muster Roll** | +8% Growth | the muster book's list of names |
| **Lamp Oil** | +10% projectile Speed | oil counted in nights |
| **Iron Ration** | +20 Max Health | Watch stores |
| **Passage Rule** | +1 Amount at levels 3 and 5 only (rare) | Merrick's letters-board |
| **Strong Corner** | +5% damage reduction while standing still | the hall's strong corner, where the salt is hid |
| **Salt Cache** | blooms and spore-things take +10% | the Cold Passing salt |

---

## 9. Evolutions (16, and two unions)

**v1 ships eight, one per weapon, and no unions. Which eight is in 26.**

A weapon at 8 plus its partner kit at any level evolves at the next strongbox, with a ceremony.

| Weapon + Kit | Becomes | What changes |
| --- | --- | --- |
| Watch Sword + Glim Mark | **The Cold Edge** | cuts leave hanging pale-blue lines that keep cutting for 2 s; the blade hums |
| Billhook + Passage Rule | **Held the Gate** | every 8 s a line of planted bills forms a 6-tile wall for 4 s; nothing passes, and they are cut as they press |
| Lime Sack + Kiln Ash | **The Limed Road** | you leave a lime trail at all times; blooms will not cross it |
| Nails + Strong Corner | **The Nailhouse** | nails pin enemies into rows; the pinned become walls for others |
| Hand Bell + Warning-Book Page | **The Bell-Tender's Toll** | every 13th ring kills every non-elite below 15% health |
| Lantern + Lamp Oil | **The Road of Cold Lights** | the lanterns become a slow procession that wanders out and comes back |
| Muster Book + Muster Roll | **Deserted: None** | every Named death writes a line; each line is +0.5% Might, no cap |
| Bloomery Hammer + Bellows | **The Furnace Night** | hammers leave pools of molten bloom-iron; the screen warms orange on landing |
| Watch Crossbow + Whetstone | **The Causeway Tower** | drops a bolt-tower that fires on its own; up to three |
| Salt Pouch + Salt Cache | **The Cold Passing** | the salt ring becomes a slowly spreading circle; blooms inside fall apart |
| The Ward + Return-Bread | **Grisel's Hedge** | the ward never fully breaks; each block heals and throws a ring of thorned light |
| Hoist Chain + Iron Ration | **The Weight Gate's Chain** | every 10 s a falling iron gate comes down on the biggest thing on screen |
| Peat Fire + Good Boots | **The Outside Fire** | fires follow as a ring of embers; standing in it heals |
| Brass Tags + Brass Tag | **The Naming Stone** | tags Name everything they touch; Named kills can never rot |
| Reed Spear + Carter's Hitch | **The Cutters' Bank** | thrusts become a row of spears coming up out of the ground along a line |
| Cold Light + Watch Cloak | **Aud's Lesson** | the beam becomes a slow full circle; you take -15% damage inside it |

**Unions** (two evolved weapons fuse, freeing a slot; rare, late; not in v1):

- **The Cold Edge + Aud's Lesson -> The Glim Road**
- **Held the Gate + The Weight Gate's Chain -> The Last Gate**

---

## 10. The workings

Three per run, never more. Found at minutes **8, 16 and 24**, each guarded by an elite, each permanent,
each with its price printed in plain words before you take it.

**The canon frame.** Orlen's old magic was **six trades**: **Holding, Cold light (glim), Carrying,
Marking, Keeping, Staking**. Every working costs **warmth (the chill), salt, sound, or time**. A living
person can do only small things: nothing a working does throws fire or moves a wall, and nothing
names, shows or predicts. The three workings of the novel are the core of the set: **the ward over
salt**, **the naming at the graves**, and **cold light**.

### 10.1 The twelve

**v1 ships eight of the twelve. Which eight is in 26.**

| Working | Craft | Gift | Price |
| --- | --- | --- | --- |
| **The Ward Spoken** | Keeping | every 30 s a hit is fully blocked | **warmth:** -15% Max Health |
| **The Naming at the Graves** | Keeping | every 100th kill raises your level by one | **time:** embers drop 20% less |
| **Cold Light Taught** | Cold light | all weapon effects deal +30% to anything in darkness | **warmth:** your light radius halves |
| **The Bright Hour Called** | Cold light | once a run, call a clear noon for 45 s | **salt:** all salt earned this run is halved |
| **The Passage Rule** | Marking | enemies in front of you take +40% | **sound:** enemies behind you deal +40% |
| **The Carter's Hitch Tied** | Carrying | pickups anywhere on screen come to you | **warmth:** Move Speed -10% |
| **Take Nothing You Cannot Carry** | Carrying | +2 to all weapon levels at once | **salt:** strongboxes give one fewer item |
| **The Bargain** | Marking | double salt for the rest of the run | **time:** Debt +50, and it comes due early |
| **Lime the Road** | Keeping | the ground you walk stays limed for 20 s | **salt:** healing pickups heal half |
| **The Third Arch** | Holding | every 60 s stones fall on the busiest spot on screen | **sound:** it can hit you |
| **Kept Hand** | Keeping | you cannot die once; at zero you stand up at 50% | **warmth:** your Recovery becomes zero |
| **Call the Roll** | Marking | elites drop two glim sparks | **time:** each elite answers with a second elite |

**Rules.** A working is spoken aloud: the character's mouth moves, the sound is in the mix, and the
listeners will hear it. No working is ever a passive icon with no cost shown. The price is applied the
instant you take it and is never refunded, including on death.

**The Marking craft's own price**, for any working that cuts a mark: the mark lasts until the next
fire and must be paid again there. Canon already says a mark holds for hours, then fades.

---

## 11. Loot

### 11.1 On the ground

| Pickup | Effect |
| --- | --- |
| **Return-bread** / **full pot** | heal 30 / heal 100; food, not a charm; rare, from braziers, some elites and one loaf on a post (**proposal**) |
| **Lime barrel** | kills every non-elite in a wide radius in a white blast |
| **Bell clapper** | Rings every enemy on screen for 2 s |
| **Hoist hook** | pulls every ember on the map to you |
| **Coal** | for 8 s every weapon burns |
| **Glim candle** | for 6 s enemies are held in cold light and take double |
| **Salt** (measures) | the currency: a handful, a measure, rarely a **salt block** |
| **Crown penny** | rare, 10 measures, its own small ring |
| **Brass tag** | the Naming Stone's currency |
| **Relic** | permanent, found once |
| **Peat brick** | fuel, in stages that use fires |

### 11.2 Strongboxes

Elites and bosses drop them. Opening pauses the game and plays a ceremony: the lid lifts, pages
riffle, items are written in one by one. It gives **1, 3 or 5** items (Luck raises the odds), picks
level-ups for what you own, and evolves anything ready. A 5-item box is rare and gets the grandest
ceremony. Hold a button to skip.

### 11.3 Breakables

Braziers, cairns, carts, reed stacks, coffin-boxes, rotted grain crates. Canon names to use: the
**Spore-Choked Cart**, the **Gnawed Bone Heap**, the **Ork Plunder Pile**, the **doorstep due** (one
rag, one stick, in a low box).

### 11.4 Relics (16+)

Permanent, found once, each tied to a place. **The warning book is not one of them**: it never leaves
the fire, so what you find and carry are its pages (17.4). **v1 has the ones that stand in stages
1-3**; the rest wait for the road north. The Watch Whistle is a collectible there whose effect
arrives with co-op.

| Relic | Where | Unlocks |
| --- | --- | --- |
| **The Muster Book's Clasp** | the Watchhouse, the tally room | **Turn the page** |
| **Gytha Marrin's Seal** | the Causeway toll house | **Strike it out** |
| **A Tally Stick** | the Outside Fire, the second one out of Joan Tallis's belt | the minute-by-minute kill graph on the end screen |
| **Stott's whittling knife** | the Causeway tower's guardroom | Named kills drop an extra brass tag |
| **A Witness Token** | Halwen's chapel, the chaplain's cupboard | the Kept Hand working |
| **A Bent Spoon from Darnel Cross** | Darnel Cross | Hard Bargain shop items |
| **A Watch Whistle** | the Causeway tower's guardroom | co-op revive by carrying (**post-1.0**) |
| **The Glass Key** | Halwen's glasshouse range | the room nobody claims |
| **Osric Brayne's Sheet** | the bricked hatch | a leaf of the house's admittance rolls, naming the turned away |
| **T. Gale's Kettle Hat** | the ogre's bone heap | a Watch helm; the refuge asks for it back |
| **Winna's Pot** | the ogre's bone heap | the pot returns to the children; a book line |
| **Odo Starke's Name-Strip** | the Spore-Choked Cart | carry it to Dowsett at the Nine Stakes |
| **The Seam Roll** | the Slagcrown counting house | names for the brass tags |
| **The Tower's Key-Ring** | nowhere yet | Kemble's fate stays a shut door |
| **Cerrin Vane's Cloak** | the Slagcrown hall | nothing says where he went |
| **The Bell's Tongue** | the tower's bell-loft, wrapped in a Watch cloak | the bell on its side in the yard can be struck once, with its tongue hung back in it (**proposal**) |

**Rarity is material,** never a colour scale: iron, brass, silver, glim-blue. Evolved weapons get a
thin pale-blue outline on their icon.

---

## 12. Characters

**Twelve, plus three secret.** Every one is human (O1). Each has a starting weapon, a trait, small
stat differences, a unique dodge, and a line of their own in the muster book.

**v1 ships six: Rafe, Merrick, Edda, Pim, Margery and Aud.** The other nine are written below and
built after the first release. The six are the four who are already at the fire in the first three
stages, plus the listener whose cold light the game teaches.

| # | Character | Starts with | Trait | Unlock |
| --- | --- | --- | --- | --- |
| 1 | **Rafe Sedley**, the Watch Deserter | Watch Sword | **Heard the Order:** +20% Move Speed below half health; at the Order he has a third answer, **Go back** (+3 levels, rewards x2, no extract). Carries a targe: +1 Armour. | start |
| 2 | **Merrick Thwaite**, billman | Billhook | **The Grey Cough:** the ladder advances on the clock, not on spores: crust at 10:00 (+3 Armour, -10% speed), silence at 20:00 (+40% Might, pickups heal half, his barks stop) | finish a stage as Rafe |
| 3 | **Margery Reeve** | The Ward | **First Working:** begins each run with one working already spoken (your pick), and her workings' prices are halved | survive 15:00 |
| 4 | **Aud**, a listener | Cold Light | **The Lesson:** her cold light lingers 50% longer; darkness never shrinks her light radius | lay the three Unnamed in one run (**proposal**; "reach Greystair" was a post-1.0 gate) |
| 5 | **Tobin Crane**, of the Bloomery Company | Bloomery Hammer | **Hammers:** each consecutive hammer hit is +2% damage to +40%; reset when he is hurt | open 25 strongboxes |
| 6 | **Edda Wray** | Nails | **The Assize Corner:** +1 Armour per wall or obstacle within 2 tiles (max +4) | survive 60 s below 10% health |
| 7 | **Pim Haddow** | Muster Book | **Carried the Book:** +15% Growth; Named kills give double embers | write 100 lines in the book |
| 8 | **Grisel**, hedge-priest of no chapel | Salt Pouch | **Hedge-Lore:** blooms take +30% from her; spores do not stack the cough on her | Name 1,000 enemies |
| 9 | **Winna** | Peat Fire | **The Pot:** all healing pickups heal double; her fires warm allies in co-op | heal 5,000 health in total |
| 10 | **[name]**, a hand from the Split Kiln | Lime Sack | **Kiln-Burned:** immune to lime and burn; her lime patches are 25% larger | lime 10,000 enemies |
| 11 | **Marget Sayle** | Lantern | **Highland Eyes:** sees elites and strongboxes on the minimap from anywhere | finish The Ledge (**post-1.0**) |
| 12 | **Col Wray** | Watch Crossbow | **The Band's Ways:** humans he kills drop double salt; he walks 10% faster in the dark | desert at the Order 10 times |
| S1 | **The Ledge's Deserter** (unnamed) | Watch Sword + Crossbow | **Sent North:** two weapons; cannot take workings | hold through the Order on every main stage |
| S2 | **Wat Corley**, bell-keeper of Hob's Height | Hand Bell | **The Quiet Kept:** his sound weapons are silent and weaker; he sees the Silent and the Unnamed outlined in the dark; his cold light lasts half again as long; his bell does not ring, it **carries**: its note reaches the next bell and returns, and what it touches is Rung | find all 16 relics |
| S3 | **Gise Marrable** | Brass Tags | **The Roll:** every level-up offers one more card; Named kills drop double brass; she is looking for a name in the Seam Roll | hold through the Weight Gate as every main character |

**Character rules.** Idle, walk (8 directions), dodge, hurt and fall. A portrait. A bark set of 6-10
lines, said rarely: on a boss's arrival, on low health, at the Order, on a perfect step. Merrick's go
silent at his silence stage, and that silence is the point. **Merrick says "look at that" at wonders,
and only there.**

---

## 13. Enemies

Built from data (`data/enemies.js`): sprite set, weight class, health, speed, contact damage,
behaviour, attacks, drops, sound. Health scales with time. One clear silhouette at 24 px tall.

The bestiary gives **17 canon creatures**. Use them before inventing any.

### 13.1 The surf

| Enemy | Behaviour | Notes |
| --- | --- | --- |
| **Goblin scavenger** | fast, weak, comes in flanking arcs, not straight lines | 10% carry a stolen-goods sack: they take embers off the floor and run; kill one and the sack bursts for triple |
| **Goblin nest-runt** | tiny, in packs of 15-30 from nest mouths | nests are breakables that spawn until broken |
| **Goblin lamp-thief** | carries a lamp and runs; your light radius shrinks while it lives | drops the lamp as a temporary light |
| **Greymaw** | wild dogs, arrive in a loose pack, circle, feint, then commit | canon: *Greymaw on the south wet. Nine, or six counted twice.* |
| **Walking bloom** | slow, sways, reaches; contact grabs and slows (dodge to break) | bursts into spores on death; some wear brass tags |
| **Corpse-cap** | rises from a corpse left too long; immobile 2 s, then walks | the rot, capped at one per 2 s per screen |
| **Spore drift** | motes that drift with the wind toward you | burst on touch; cluster before blooms, and that is the warning |

### 13.2 The line

**Ork shield** (advances behind a shield; blocks projectiles from the front; hit from the side, or
break the shield) - **Ork cleaver** (walks, then charges in a burst with a lowered-head telegraph; the
charge hits other enemies) - **Ork thrower** (lobs crude javelins with a ground marker; they stick as
brief obstacles) - **Ork pack-leader** (elite: a banner aura, +25% speed to nearby orks; kill to
scatter the pack).

### 13.3 The walls

**Ogre** (slow, then a stomp: an expanding ring with a 0.8 s telegraph) - **Quarry-troll** (stone-hided,
regenerates 3%/s unless Burned or Limed; sheds plates that become obstacles; **blind, hears everything**)
- **Gallery-crawler** (drops from the roof; a growing shadow for 1 s; latches on) - **Hulk-conger**
(water edges, a lunge marked by a ripple first) - **Reed-jaw** (in the reeds: a head-and-ridge shape
that could be floating timber, then a straight rush).

### 13.4 People (the cruelty)

Humans are the only enemies cruel on purpose. Rarer, smarter, worth more.

**Grey-rag raider** (knots of 4-6; weighted nets that slow; their leader carries a carter's hitch and
pulls you) - **Plate-reaver** (armoured, slow, steals salt on hit; kill to get it back with interest) -
**Cutwarden** (runs for a dyke and cuts it, flooding a quarter of the map, unless stopped) -
**Halwen Remnant crossbowman** (volleys in lines from fixed posts; marks the line first) -
**The Unpaid** (on coast stages, boarding waves off the ships) - **The Silent** (the far-gone sick:
fast, quiet, **no sound cue at all**, and they do no damage; they block, and putting one down writes
*did not answer*).

**The Gutter Kin are not enemies.** They are six road waifs holding Halwen's glasshouse range: you can
drive them off, trade with them, or leave them, and the Remnant wants what they hold. The drain
ambushers at Halwen are goblins.

### 13.5 Neutrals

**The listeners** stand in the Low Galleries with their heads tilted, listening. Weapons never hurt
them. Enemies drag them away. Standing near one for 3 s while it is grabbed saves it: brass, and at
six, a hidden reward. **Ringing a bell near a listener costs their trust**: they leave, and the run's
kindness closes. Some will not be saved and walk into the dark of their own accord; you cannot stop
them. The listeners arrive with stage 8; v1 has their craft (Aud) but not their galleries.

### 13.6 Elites

Any enemy can spawn as an elite: 1.5x size, a dark aura, a health bar, one affix, a strongbox.
Affixes: **Limed** (immune to lime), **Banner** (buffs neighbours), **Hollow** (splits into two),
**Glim-touched** (reflects the first projectile each second), **Drowned** (leaves slowing water),
**Bloom-laden** (a spore cloud follows it), **Seam-called** (another elite answers).

---

## 14. Bosses

Every boss: an arrival (music drops, a sound, a warning-book line on screen), a health bar with its
name in the warning book's hand, 2-3 patterns with clear telegraphs, a phase at 50%, and a death that
matters.

**v1 has the first three.** The other six wait for the road north, and the Weight Gate is the last
thing the game does, not the first release's.

| Stage | Boss | The fight |
| --- | --- | --- |
| 1 | **The Ogre of the Long Stable** | stomps (rings), a charge that breaks the stable piers, picks up and throws carts; at half health it starts eating corpses to heal, so burn them |
| 2 | **The Causeway Tower band** | three ork pack-leaders round a war-banner; kill the banner-bearer first or the others enrage |
| 3 | **The Halwen siege** | waves of Remnant crossbowmen, Garden Hands and gutter goblins under one captain who moves between windows; break the doors to reach her. **[name needed]** |
| 4 | **The blind troll of Rook's Stair** | rolls boulders down the benches; regenerates; the winch can drop a load on it if the rope goes at the right moment |
| 5 | **The Reed-Jaw of the Long Cut** | ambushes from the reeds; a ridge shape you must read; drags what it takes into the water |
| 6 | **The crawler at the third arch** | drops from arch to arch; between drops the corridor goes dark and only its claws tell you which arch |
| 7 | **The furnace night** | two quarry-trolls at the bloomery, then an ogre on the venting slopes in bloom; keep the furnace fuelled or the trolls stop burning |
| 8 | **The troll pair in a Dead Calm** | two trolls in total silence; you read them by sight and by the shake in the ground |
| 9 | **The ork pack at the Slagcrown, then the billman on the scaffold** | see 16.9 |

---

## 15. Weather, light and the sun

**The sun crosses the sky.** The day's number sets its face, before you leave the Tally Room:

| Day | In twenty | Sky |
| --- | --- | --- |
| **Coal** | 5 | the dark disc all day; the run is genuinely dark; light radius -25% |
| **Coin** | 11 | a pale disc behind the ash; flat grey daylight |
| **Clear** | 4 | real noon from about 10:00 to 14:30, real shadows, and a **Bright Hour** inside it |

Every dusk goes down red behind the Slagcrown. **Darkness is not constant**, and the light pass reads
the minute and the day.

**The six weathers** (canon): **Ashfall, Miasma fog, Sleet, Cinder-squall, Hoarfrost, the Dead Calm.**
Sleet comes on coin and coal days only: one spell on a coin day, two on a coal day; a clear day stays
dry. A **cinder-squall** is the Order's weather. **Miasma fog** shrinks the light radius.
**Dead Calm** is the one where sound stops.

**Light radius matters.** Beyond it enemies are silhouettes and elites are two eyes. Lanterns, fires
and cold light push it back. **The player's own light is tallow yellow.**

---

## 16. The stages

Nine on the road north, six secret. Map types: **open** (infinite, seeded), **lane** (infinite on one
axis, bounded on the other), **bounded** (hand-built), **rising** (the map changes).

**v1 ships three of them: 1, 2 and 3.** They are three of the four map types — open, lane, bounded —
so the remaining six stages are content rather than capability. Rising is the one map type v1 does
not exercise, and it belongs to stage 5. Stages 4-9, the six secret stages and the Weight Gate are
written here because the design has to be whole, not because the first release builds them.

### 16.1 Stage 1 - The Outside Fire

**The Wayfarer's Watchhouse.** Open, with the house and yard hand-built at the centre.
**Look:** the grey stone box, ash against every wall, the ring of dark stone by the west fence, the
Naming Stone, and three figures standing in the flooded corner. Reeds to the horizon, black water, the
coal sun low and red.
**Map:** the atlas's thirteen zones, exactly: the gallows stump, the Outside Fire, the yard, the 1.35 m
doorway and the Counting Passage, the hall (hearth, drain cover, wayfarers' room, tally room, strong
corner, assize corner), the drain, the Naming Stone, the Drowned Graves, Withy Bottom (the Spore
Hollow) and its lime pit, the Long Stable and the bone heap, the Causeway Delph, the Roofed Gallery,
the East Choke Point.

**Mechanic: keep the fire.** The Outside Fire burns down. Peat bricks drop from breakables; carry them
back. A fed fire gives Recovery nearby and keeps blooms out. A dead fire shrinks the light radius
across the whole map.
**Script:** 0-3 goblin scavengers; 3-6 nest-runts out of the wayfarers' room; 6 the first blooms out of
Withy Bottom; 8 the first working (the ward, at a door); 10 orks at the East Choke Point; 12 **the
gold reeds** (wonder); 15 **the Ogre of the Long Stable**; 16 the second working (the naming, at the
graves); 20 **the Order**; 20-25 the first Silent; 24 the third working (cold light, in the Delph);
25-30 everything; 30 the Grey Hour.
**The Unnamed** stand in the Drowned Graves from the first minute. They rise when the horde presses
the yard. The only way to lay one is to kneel at a grave and speak a name: three seconds, loud, and
you cannot move.
**Wonder:** at 12:00 the reeds catch the last of the light and turn gold for 20 s.
**Opening page:** warning book entry 1, nailed to the fence post.

### 16.2 Stage 2 - The Old Causeway

Lane, infinite east-west, deep water north and south. **The dry ways:** every four minutes the water
drops for 60 s and the old drowned roads come up beside the causeway, widening the map; anything
standing in the water when it rises is slowed and pulled, enemies too. **Wonder:** at low water, the
drowned lanterns along the dry ways glow under the surface. **Boss:** the Causeway Tower band at
15:00. **Page:** entry 6, *The Dry Ways*.

### 16.3 Stage 3 - Halwen House

Bounded: rooms, corridors, gardens, the glasshouse range, the Chapel of the Kept Hand, the records
tower, the cistern vault. **Mechanic: bells.** Bell-posts can be rung by hitting them: every enemy on
the map turns toward the bell for 8 s. Pull the horde off yourself, or pile it into one place.
**The Gutter Kin** hold the glasshouse range, and they are people, not enemies. **The room nobody
claims:** with the Glass Key, the cistern vault opens. Inside is nothing. The game never explains it,
and after that the door is open a crack on every Halwen run. **Boss:** the Halwen siege at 15:00.
**Wonder:** the glasshouse range at dawn, every pane lit. **Page:** entry 12, *The Culvert*.

### 16.4 Stage 4 - Rook's Stair

Bounded, built on benches: ramps connect them, edges are drops. Enemies on a higher bench can drop on
you; you can drop down a bench (a short fall with i-frames) but climbing back takes a ramp. Rocks roll
down the benches. **Boss:** the blind troll at 15:00, and the winch. **Wonder:** rooks lifting off the
whole quarry face at once. **Page:** entry 10, *Lime*.

### 16.5 Stage 5 - The Drowned Measures

Rising: the water level changes through the run. **Mechanic: dykes.** Cutwardens run for the dykes;
each cut floods a quarter of the map with slow water and congers. Stop them, or use the flood against
the horde. **Boss:** the Reed-Jaw of the Long Cut at 15:00. **Wonder:** the Drowned Orchard in flower
under the water at 22:00. **Page:** *blank*. The warning book has no entry for the Measures, and the
page shows its number and nothing else, which is the warning book's own rule for a page not yet found.

### 16.6 Stage 6 - The Roofed Mile

Lane, infinite north-south, five tiles wide between piers, with side recesses. **Mechanic: arches.**
Gallery-crawlers drop from the roof; the third arch and the fifth pier are scripted danger points.
Light is everything here. **Boss:** the crawler at the third arch, 15:00. **Wonder:** a gap in the
roof where the snow comes down in a column of grey light. **Page:** entry 15, *The Third Arch*.

### 16.7 Stage 7 - Greystair and the Venting Slopes

Open, with the fallen Citadel hand-built. **Mechanic: warm ground.** The venting slopes heal slowly
and grow blooms fastest. Blooms here wear brass tags worth triple. **Boss:** the furnace night, 15:00:
keep the furnace lit or the trolls stop burning. **Wonder:** at 22:00, far east, the small pale lights
on Kell Tor's tarn, drifting across the black water and going out one by one. Kell Tor has been
sealed since S.1 and nobody has been inside; the lights are most likely marsh gas at warm vents.
(A sightline from Greystair: **proposal**.) **Page:** entry 25, *The Venting Slopes*.

### 16.8 Stage 8 - The Low Galleries

Bounded maze of galleries and a few great halls, held up by **Holding marks**. **Mechanic: listening.**
The listeners; and **the Quiet**: some galleries are silent zones where sound weapons (the bell) do
not work at all. **Boss:** the troll pair in a Dead Calm, 15:00. **Wonder:** the road of cold lights
at 26:00, a line of pale-blue lights through the galleries, moving north; following it leads to a
strongbox and to stage 9. **Page:** entry 26, *The Quiet*.

### 16.9 Stage 9 - The Slagcrown and the Weight Gate

Bounded: the hall above, the counting house, the drift-head, and below, the Black Seam and the
unfinished Weight Gate on its scaffold.

- **0-20** survive in and around the hall. Orks from above, goblins from below.
- **20:00** the Order. Running from here is allowed.
- **25:00** the ork pack at the Slagcrown (boss).
- **28:00** the scaffold. **The billman.** Merrick, at the silence, not knowing you. You cannot heal
  during the fight. He uses the bill's pull and the passage rule against you. At low health he stops
  for a few breaths and signs something with his hand. Then he goes down below the gate.
- **30:00 the Weight Gate.** The gate must be dropped, and the props are below it, on the wrong side.
  **Solo: Merrick does it.** The screen holds on the closed gate and there is **one knock**. What is
  below is never shown: the dark closes in from the edges of the screen as the work is done.
  **Co-op:** the gate is worked by the company, and whoever stands below does so by their own choice,
  with a volunteer prompt and no default. That player's run ends at the gate; everyone else wins; the
  line is **Held the gate**, and it marks their portrait forever.

**Pages:** entries 27, 28, 29, 30, in that order, and 30 appears in the warning book by itself.

### 16.10 Secret stages

| | Stage | Unlock |
| --- | --- | --- |
| A | **The Ledge** (Orlen's highland edge, the key painting): blooms only, in vast drifts, and the view | finish stage 9 |
| B | **The Barrows** in total darkness; your light is all there is | find the Barrow relic |
| C | **Gull's Throat**, a sea cave on the Wrack Shore; the Unpaid come in on the tide | kill 100 of the Unpaid |
| D | **The Iron Stair**, a spire climbed in a forced upward scroll, the bottom of the screen rising | finish stage 4 without taking a ramp |
| E | **The Ringing Field**, standing stones that ring when hit, in a rhythm; on the beat, double damage; 15 minutes, no boss | ring 500 bells |
| F | **The King's Sluice**, the great dam complex; at 20:00 it can be opened and sweeps the valley below, including you if you are down there | finish stage 5 |

### 16.11 Modes

**The Long Account** (endless): any stage, no Grey Hour, and every 10 minutes the Account comes due.
**The Approved Load** (challenge tiers): ten stacking tiers chosen before a run, each one weight: +enemy
speed, fewer heals, no dodging, the dark never lifts, elites everywhere, the Order cannot be refused.
Each tier adds salt and a mark on the muster book's line. **The Watch Rota** (daily): one seeded run a day,
fixed character, stage and workings.

**v1 ships the Watch Rota only.** The Long Account and the Approved Load need stages 4-9 to be worth
playing and arrive with them.

---

## 17. Meta-progression

### 17.1 The Tally Room

The Watchhouse's tally room, firelit, where Joan Tallis keeps her sticks. Spend **salt** on permanent
small raises: Might, Armour, Max Health, Recovery, Speed, Area, Duration, Amount (max 1), Cooldown,
Reach, Luck, Growth, Measure, Turn-the-page uses, Strike-it-out uses, an extra Watch Step charge.
Prices rise with each purchase. **A refund button returns all salt**, so builds can be re-planned.

### 17.2 The Naming Stone

**post-1.0.** In v1 the stone is a place in the yard where the dead were named, and a tag pickup; the
long arc below waits for the second release, because a three-stage game cannot fill a hundred tags.

Brass tags come back here. Every 100 returned, the stone takes a name and you choose one of three
small permanent boons. It fills slowly over the whole game: the long arc.

**proposal:** in canon the stone takes nothing. The Watch laid its dead on it so their names could be
spoken into their mouths before the lime, and when a body had no name **the warden wrote down what it
carried**. A miner's brass tag is exactly what a nameless body carried, so the mechanic is that
practice, done a hundred times.

### 17.3 The Muster Book

The Causeway Watch's roll of names, and the one that travels. Pim Haddow carried it to the Watchhouse
about nine weeks before Rafe arrived and wrote its last entry there: four dead, a date, and
*Deserted: none*.

Every run writes one line in it: character, stage, minutes, kills, how it ended, and the build's
evolved weapons. The small kindnesses write their lines here too ("[Name], carried to the fire"), and
so does every name spoken at a grave. Patterns in the muster book, not totals of kills, unlock characters
and stages: ten **Deserted** lines, a full page of **Held**, and a page of **Did not answer** that is
longer than you meant it to be.

Weapons, kit, evolutions, workings and relics are in neither book in the lore. The collection gives
them their own leaves, in the same hand: a UI conceit, and nothing more.

### 17.4 The Warning Book

A different object, and it never leaves the Watchhouse fire. Margery Reeve has kept it since S.12.
It holds the beast pages (the bestiary) and the thirty dated entries of the winter of S.30.

Its **pages** travel. Each is found where its entry happened and carried back, and each returned
page fills that leaf and unlocks its **hint**. A page not yet found is not blank: it shows its
number and nothing else. Entry 30 is the exception and appears by itself. Every stage still opens
with its entry on screen while it loads, in the canon text of `the-warning-book-s30.md`, because that
is the game telling you where you are.

---

## 18. The things that make this game its own

### 18.1 The muster book as the spine
Four lines, and the muster book grows across hundreds of runs. Some unlocks are patterns in it, not
totals of kills.

### 18.2 The rot
A corpse left 20 s may rise as a corpse-cap. Corpses are cleared by fire, lime, salt, the naming, or
by walking over them (which gathers their embers). Named kills never rot. **Capped at one per 2 s per
screen** so it can never snowball into an unwinnable flood.

### 18.3 The grey cough
Spore clouds add stacks. **5:** a cough (0.25 s stop). **10:** crust (-10% speed, +2 Armour). **15:**
silence (+25% Might, healing halved, barks stop, the mix thins). Stacks fall slowly, and all at once
in fire or salt. A risk the player can choose to carry for power.

### 18.4 The Order
The choice with no right answer. See 2.2.

### 18.5 Stand and look
Each stage has wonders. When one begins, a small **eye-mark** appears. Stand perfectly still for 3 s
while it lasts, with the horde coming, and you take its blessing for the run (+10% to one stat) and
the music swells once. Moving cancels it. Being hit cancels it. In co-op, if everyone stands still it
is doubled. The game explains the eye-mark once and never again. **Merrick says "look at that."**

### 18.6 The Debt
At any level-up you may **borrow**: take a second card from the same page. Debt rises. At 25:00 (or
every 10 minutes in the Long Account) **the Account comes due**: an elite collector wave sized by the
Debt, grey rags and plate-reavers, with a strongbox the size of the debt. Kill it and the Debt clears
and the box is paid back; fail and the Debt is -Max Health for the rest of the run.

### 18.7 The Bright Hour
On a **clear day**, inside the clear noon: 45 s of real sun. The palette goes warm gold, the one
hopeful theme plays, blooms in the open wither, light radius goes to full, and all weapons are +50%.
When it ends, it ends quickly, and the dark is darker. Never more than once a run.

### 18.8 Dead Calm
Every sound in the world stops. Music cuts. Only your breath and heartbeat. Enemies make no noise.
The Silent cannot be heard at all. The screen desaturates 40%. Small ripples on the ground show where
heavy things are stepping, so nobody is disadvantaged by it except in the way everyone is.

### 18.9 Goblin thieves
A goblin takes embers, sometimes salt, and runs for the edge of the screen. If it gets away it keeps
the haul and its laugh echoes. A small, funny, tense game inside the big one.

### 18.10 The friend who walks with you
On by default **for Rafe**, and only for Rafe. Merrick follows at a short distance, fights with the
bill, and coughs on the canon ladder. He is never stronger than you. He leaves at stage 9, and becomes
the billman on the scaffold.

### 18.11 Lime the road, keep the line
Lime, salt and fire leave marks on the ground for the whole run. By minute 25 a good player's map is a
drawing of where they held. The end screen shows the whole map with every lime line, salt ring and
burned patch. **It is the run's portrait, and it can be saved as an image.**

### 18.12 The Kept Hand's chapel
At Halwen, the chapel's **covenant recess** takes one weapon out of your slots (it is gone) and gives
back one evolution of your choosing, immediately, ignoring the rules. Once per run. The sacrifice is
real and the game does not soften it, and it is spoken aloud, because the covenant's own rule is cut
under it: *let each obligation be spoken in the hearing of those it binds.*

The altar is not involved. Canon says it holds no treasury and was broken open and crudely patched
long before the player arrives. What the chapel answers through is the promise beside it.

### 18.13 Bell-ringing combos
Every ring of any bell adds to a hidden count. **13 rings in 13 seconds** and a deep bell sounds from
far off and every enemy on screen hesitates for 1 s. Players will find it; the muster book will note it.

### 18.14 Small kindnesses
Some stages have survivors: a woman at a cistern, a child in the reeds, an old man with a cart.
Stand near one for 5 s while enemies come and they reach safety, leaving nothing but a line in the
book: **"[Name], carried to the fire."** No reward beyond the line.

### 18.15 The naming at the graves
Stage 1's mechanic, and the game's first real choice. An Unnamed cannot be killed: cut it down and it
rises whole. To lay one you must **kneel at its grave and speak a name**: three seconds, stationary,
loud, and it draws the horde. Doing it is worth brass, and a line of its own in the muster book: not
the **did not answer** line, which is for the ones who stopped answering. Doing it during the
Grey Hour is how the best runs end. The game never says whether the name has to be true, because canon
never says either.

---

## 19. The look

**Painted, deep, atmospheric, heavy shadow.** A cold palette broken by firelight and the coal sun.
Black is the base colour: build dark and add light. Never cartoonish, never neon.

**The palette** (`data/palette.js`): peat black, fen-water slate, reed ochre, bone, salt white, lime
white, ember orange, coal-sun red, **glim pale blue**, **bloom teal** (threat only), bloom grey-green,
rust. Two reserved ranges enforced by test: threat red and threat sulphur green appear only in
telegraphs, projectiles and spore clouds.

**Sprites.** Creatures are **modelled** (O9) and rendered to 8-direction sheets at 2x and shown at 1x,
with an ink outline and a few dithered steps of light so they sit beside paintings. Living people are
**painted**, as they are in The Long Account. Frame counts: walk 8, idle 6, dodge 6, hurt 2, death 8
(people and bosses 12). Swarm enemies may use 4-direction mirrored sets. Every sprite has a matching
**silhouette mask** for outlines, the light-radius silhouette mode and hit flashes.

**No picture this repository did not make.** The repo's standing rule: every sprite, tile, portrait
and icon is generated by tools in this repo (a code-painted atlas builder, and Forge renders), never
downloaded, and never embedded as base64.

**Ground.** Large painted tiles with seeded variation and hand-placed set pieces. No visible grid.
Ground decals (lime, salt, scorch, blood, water) are drawn into a persistent canvas per region, so
they last the whole run at no draw cost.

**Lighting.** A 2D light pass: ambient per minute from the sun path, plus point lights. Rendered into
a **quarter-resolution** light map, multiplied over the scene, then bloomed slightly. Darkness reads
as darkness, not as grey fog.

**Effects.** Hand-made, short and sharp (most under 0.3 s), weight through scale and squash. No
rainbow, no glitter, no cartoon stars. Kills pop: one frame of bone-white, then a burst in the
creature's material: goblins into rags and grit, blooms into grey spores, orks into dark blood,
trolls into stone.

**UI.** Ink on paper, iron and leather. Top bar: XP as a line of **tally marks** filling in. Health as
a red-brown **cord** under the player. Weapon and kit slots as woodcut icons with cooldown rings. The
timer is **a candle burning down**. Salt and kills in the muster book's hand. A readable book face for
numbers, a period hand for headings. Readability is never sacrificed.

**Key screens:** title (the key-painting view, coal sun, animated reeds, slow ember drift), the Tally
Room, character select (portraits on a row of pegs), stage select (a painted map of the north with the
road drawn on it), the level-up page, the strongbox ceremony, the end-of-run line, the map portrait.

---

## 20. Audio

**Music:** low, slow, heavy. Bells, bowed strings, drones, low choir without words, hand drums. Each
stage theme builds in three layers by time (sparse, driving, full), with the boss as its own piece.
**One hopeful theme, used only in the Bright Hour.**

**Sound design:** every weapon, enemy and pickup has its own set, 3-5 variations, slight pitch
randomisation. Hordes are mixed by **voice limiting per type**: at most 8 goblin deaths at once, the
rest summarised into a group sound. **Telegraphs and warnings are never voice-limited out.**

**The mix tells you things:** the low-health heartbeat, an elite's arrival sting, the boss music
dropping out, Dead Calm's total silence, the Order's squall roar.

**Chain:** `master -> music / effects / voice / ambience`. Muffle, duck, and the "Hush" low-pass
already exist in `js/audio.js` and are reused.

---

## 21. Screens and flow

Title -> (first time: a 60-second playable opening at the Outside Fire with no UI but the health cord,
teaching move, auto-fire, embers and the first level-up) -> Tally Room -> character select -> stage
select -> (optional) Approved Load -> run -> the book's line -> the map portrait -> the Tally Room.

The pause menu shows the build (every weapon and kit, its level, and what it evolves with), the run's
stats, options, and **Deserted** (quit, written as deserting).

---

## 22. Co-op

**Post-1.0.** v1 has no co-op, and nothing in sections 3-21 assumes a second player: no shared embers,
no pause-for-everyone at a level-up, no revive, no interest management. The design below is kept whole
so that v1.1 does not have to redesign the simulation to add it.

1-4 players, host-authoritative star. Shared world, separate builds. Embers are shared, so nobody
falls behind. A level-up pauses everyone; each levelling player chooses on their own page and the
others see a small "choosing" mark. Enemy health x(1 + 0.6 x extra players); spawn rate x(1 + 0.4 x
extra). A fallen player leaves a body: revive by standing on it 4 s, or carry it to a fire with the
Watch Whistle. If everyone falls, the run ends. The Weight Gate: see 16.9. Local co-op on one screen
frames all players, and the camera stops at the screen edge with an invisible wall.

---

## 23. Architecture

### 23.1 Engine shape

Fixed **120 Hz** simulation, rendering with interpolation. Deterministic given a seed: one seeded RNG
per system, so dailies, replays and co-op share seeds. Data-oriented entities in **pooled
struct-of-arrays** typed arrays: no per-entity objects in the hot loop, **zero allocation per frame**
in steady state. **Spatial hash** at 2-tile cells, rebuilt each step. **Flow field** from the player at
10 Hz for bounded stages. Weapons are data plus small behaviour functions
(`data/weapons.js` + `js/weapons/*.js`).

### 23.2 Rendering

WebGL2 **instanced sprites**: one atlas per category, one instanced quad per sprite with per-instance
position, frame, tint, flash and scale. Target **<= 30 draw calls**. Ground decals in cached region
textures. Light map at quarter resolution. No Canvas 2D fallback: if WebGL2 is missing, say so clearly.

### 23.3 What The Long Account gives us

| Module | What it is | Verdict for the Tally |
| --- | --- | --- |
| `js/audio.js` | a full Web Audio engine: master chain, low-pass muffler (deafness/Hush), a routed echo bus, procedural `noiseBurst`/`tone` SFX, a family/voice limiter, a duck-to-silence `quiet()`, and a streaming score with crossfade | **Reuse outright.** Dead Calm, the heartbeat, the thinning mix and the one hopeful theme all land on what is already here |
| `js/net19.js` | host/guest WebRTC transport, six-letter join codes, typed message specs with size/rate/sender validation, reliable and unordered channels, RTT and stats, a lobby and a URL-join flow | **Reuse at v1.1.** The transport and the spec layer are sound; the 4-player star goes above them, and v1 does not touch either |
| `js/ledge1.js` | the sun's day, the coal sun, the light reading, the pixel-art colour ramp and dithering, the "nothing visual uses live random numbers" hash | **Reuse the ideas and the ramp.** The sun path, the coal/coin/clear day logic and the dither are exactly this game's look |
| `js/sun3.js` | the sun crossing the sky, coal, coin and clear days fixed by day number | **Reuse.** It is the Tally's stage lighting model already written |
| `js/bloom4.js` | a pure `think(S, env, dt)` hunter that hears by noise, tested step by step in Node | **Reuse the pattern.** Every Tally enemy behaviour should be a pure step testable without a browser |
| `js/light21.js`, `js/lighting.js` | ambient sky, sun, point lights, a lantern light read once a frame | **Reuse the model.** The Tally's 2D light pass is the same shape at quarter res |
| `js/paintfolk76.js`, `js/pixelfolk75.js` | painted people, rigged and walked, auto-rigged from one front-view painting | **Read, then re-author.** The Tally needs 8 directions, so the rig is different; the painting technique is the house style |
| `js/game.js` (noise, collision, saves), `js/upgrades.js` | engine services, `G` state, save handling | **Reference only.** The Tally's simulation is a different shape |
| `test/*.test.js`, `test/harness.js` | one test per phase, half of it `--no-browser`, half headless Chromium with the exact flags to make WebGL run | **Reuse the shape.** Same runner, same two halves, same PR habit |
| `tools/shots.js` and the shot tools | stills and clips written into `docs/screenshots/` | **Reuse the approach**: every visual change is seen as a picture in the PR |

**Not reused:** the raycaster, the map/cell world, the first-person camera, the roof planner, the
weather-as-shader system. The Tally is top-down and its world is a horde field.

### 23.4 Performance targets (measured, never assumed)

60 fps locked on an Intel Chromebook in Chrome at **1,500 enemies, 600 player projectiles, 200 enemy
projectiles, 3,000 particles, 400 embers, 30 lights**. Simulation step **<= 4 ms**, render **<= 6 ms**.
Memory **< 600 MB**. First load **< 15 MB** before the title screen; stages stream. `tests/stress.html`
spawns the target horde with a frame-time graph and runs at every milestone.

### 23.5 Saves

`localStorage` in try/catch, a **versioned** format with migrations, and export/import as a file in
options. Meta is never lost to a bad parse: on failure, keep the file and start a clean save beside it.

### 23.6 Input

Keyboard, mouse, gamepad (standard mapping, rumble where supported) and touch (a floating stick
left, a dodge button right). Full rebinding. Every input is a named action, never a key code.

### 23.7 Layout

```
the-tally/
  index.html
  js/    core/ (loop rng input audio save)  sim/ (entities spatial flow spawn combat)
         weapons/  enemies/  render/ (gl atlas lights ui)  net/  screens/
  data/  weapons.js kit.js evolutions.js workings.js enemies.js characters.js relics.js
         palette.js stages/  text/ (warning-book entries, barks, muster lines)
  art/   audio/
  tests/ unit/ sim/ feel.html stress.html bot.html
  docs/the-tally/ design.md lore-deltas.md plan.md balance.md art/reference.md
```

**Zero runtime dependencies. No build step. No framework.** Shared modules with The Long Account live
in a `shared/` folder both pages can load, and nothing in `js/` is duplicated.

### 23.8 Tests

**Unit** (a tiny no-dependency runner, the repo's own pattern): level curve, damage formula, evolution
rules, strongbox rolls, spawn budget, Debt, save migration, the muster book's four lines.
**Headless sim:** 30 minutes at 10x with a scripted bot; no crashes, no NaNs, entity counts in budget,
the boss on time, the Grey Hour ends the run.
**Feel** and **stress** scenes, played by a person and captured for the PR.

---

## 24. Balance

**Enemy health:** `1 + 0.06*m + 0.0035*m^2`, then by stage and tier.
**Spawn budget** (points per second): `2 + 0.55*m + 0.012*m^2`. Each type has a point cost; the stage
script picks from what is allowed at that minute.
**Target player DPS** at minutes 5, 10, 15, 20, 25, 30 for a decent build, recorded in
`docs/the-tally/balance.md`, and weapons tuned against it.
**The bot** (`tests/bot.html`): moves away from the densest threat, picks level-ups by a simple
priority, and records survival, damage taken, the XP curve and evolution timings. **50 seeded games
per character per stage after any balance change**, kept in a table.

**Feel goals:** first evolution 10-14 minutes; full build 22-26; the Grey Hour survivable for a good
build and hard for a weak one.

---

## 25. Accessibility

Screen shake slider and off; reduced flashing; damage numbers off; **colour-blind threat palette**
(enemy threats switch from red and sulphur to a high-contrast shape-and-pattern scheme); text size;
high-contrast player outline; hold-to-dodge; aim mode; 0.75x game speed assist; **subtitles for barks**;
**a visual cue for every important sound** (Dead Calm's ripples are the model); pause anytime;
remappable controls.

---

## 26. Milestones

**This section is the scope.** v1 is three stages, and the cut is what makes the milestones affordable.
Ruled 2026-11-20.

| | In v1 | Post-1.0 |
| --- | --- | --- |
| Stages | 1 Outside Fire, 2 Old Causeway, 3 Halwen House | 4-9, and the six secret stages |
| Bosses | the Ogre, the Causeway band, the Halwen siege | six, including the billman and the Weight Gate |
| Weapons | 8: Watch Sword, Billhook, Nails, Lime Sack, Muster Book, Hand Bell, Cold Light, The Ward | 8 |
| Kit | 8: Glim Mark, Kiln Ash, Watch Cloak, Warning-Book Page, Muster Roll, Strong Corner, Passage Rule, Return-Bread | 8 |
| Evolutions | 8, one per weapon, no unions | 8, and both unions |
| Workings | 8 of the 12 | 4 |
| Characters | 6: Rafe, Merrick, Edda, Pim, Margery, Aud | 6, and all three secret |
| Meta | the Tally Room, saves, the relics that stand in stages 1-3 | the Naming Stone's long arc, the collection |
| Modes | the Watch Rota | the Long Account, the Approved Load |
| Co-op | none | v1.1 |

**What is not cut:** the Order and its two answers, the four book lines, the naming at the graves, the
Grey Hour, the fire, and the Silent. Cutting any of those would make a different game rather than a
smaller one.

Each milestone ends with tests passing on the exact commit, a stress capture, pictures in the PR, and
a stop for sleeves.

| # | What | Gate |
| --- | --- | --- |
| **M0** | Read and plan. `design.md`, `lore-deltas.md`, `plan.md`. No code. | sleeves rules the deltas |
| **M1** | Feel: fixed step, four inputs, camera, movement and the Watch Step to section 3, collision, Watch Sword, goblins with steering and separation, embers, the level curve, a bare page. Feel and stress scenes running. | sleeves says the movement is right |
| **M2** | The horde: WebGL2 instancer, pools, spatial hash, flow fields, 1,500 enemies at 60 fps, effect limiter, damage numbers, knockback, statuses, the light pass. One player's snapshot budget only. | a frame-time capture in the PR |
| **M3** | The build: the 8 weapons, 8 kit and 8 evolutions, strongboxes and the ceremony, pickups, breakables, 8 workings, the Debt, the cough, and the first modelled goblin and ork rendered to sheets. | the build is a game |
| **M4** | Stage 1 complete: the map, the fire, the full script, the Ogre, the Order, the Grey Hour, the wonders, the rot, the Unnamed and the naming, thieves, music and sound, the book's line, the map portrait. | a full 30 minutes is fun start to finish |
| **M5** | Meta and roster: the Tally Room, saves with export, the relics of stages 1-3, characters 1-6 and their unlocks. | a run survives a reload and the roster is playable |
| **M6** | The road so far: stages 2 and 3, their bosses and pages, and the Watch Rota. | three stages, start to finish, with no dead ends |
| **M7** | Ship: the bot, accessibility, Chromebook performance, README, Pages, a trailer capture. | it runs on the worst machine and reads on the smallest screen |

**Post-1.0, in this order.**

1. **v1.1, co-op.** The host-authoritative star above `net19`, as designed in 22. Interest management
   and shared embers arrive here and nowhere earlier.
2. **v1.2, the road.** Stages 4-6, their bosses and pages, characters 7-12, the other eight weapons
   and kit, and the Long Account.
3. **v1.3, the north.** Stages 7-9, the Weight Gate, the billman, the three secret characters, the
   Approved Load.
4. **v1.4, the secrets.** The six secret stages, the unions, the Naming Stone's long arc, the
   collection, and whatever the bot says needs tuning.

---

## 27. Definition of done, every milestone

1. All unit and sim tests pass **on the exact commit in the PR**.
2. The stress scene holds 60 fps at the target counts on the Chromebook, with the capture attached.
3. Pictures or a short clip of everything new, in the PR.
4. `lore-deltas.md` updated; nothing new slipped into canon without a **proposal** mark.
5. No console errors; **no allocation per frame** in the hot loop, checked in the profiler.
6. The PR says in plain words what changed and what is still rough.
