# Canon sheet: the facts every Ashen Wilds file shares

**Status: PROPOSED** (2026-11-05, revised 2026-11-11), like everything in `docs/worldbuilding/`.
This sheet does not make anything canon by itself; the owner does. It exists so that this
repository's game (The Long Account, first person: owner decision O5), the retired isometric
Ashen Wilds game, the browser prototype (`Grim-Dark-Ashen-Wilds-`) and every lore file tell the
same story.

**Precedence.** (1) The owner's explicit decisions. (2) What the retired isometric game showed its
players, marked *(in game)* below: the README premise, item and background text, enemy doc
comments, banners. That game is no longer in this repository (O5; its code is on the branch
`archive/isometric-prototype`), and what it showed stands as lore. (3) This sheet. (4) The other
files in this folder. When a lower one disagrees with a higher one, the lower one is corrected.

**Where the files came from.** The 24 files listed in `README.md` under *Previously preserved*,
*Remaining conversation material* and *Bestiary* were copied unchanged from the browser
prototype's `docs/worldbuilding/` (its commit `7afd805`, 2026-11-05). The files listed under
*Godot additions* in `README.md` were written for this repository to fill the gaps the archive
left: the kingdom, the Breaking, the thirty years, Act I as it is built, the people of the Godot
game, the acts, and texts the game can show.

## Owner decisions (CONFIRMED)

| # | Decision | Date |
|---|---|---|
| **O1** | **Only humans are people. Everything else is an animal, a lizard, a fish or a monster.** Goblins, orks, ogres, trolls and every other creature have no language, names, culture, faith, bargains or society. They can be cunning, can use stolen tools and weapons and can hunt in packs, but they are beasts. Every companion, faction, quest-giver and playable background is human. | 2026-11-05 |
| **O2** | **The names the Godot additions invented are kept**: the Kingdom of Orlen, Wexhaven, slag-iron, the five Highland Citadels (the Slagcrown, Greystair, Dunmarrow, Hob's Height, Kell Tor), the Slag-Lords, the Black Seam, Slag-Lord Cerrin Vane, the Breaking and S-dating, the Flight South, King Aldric IV, the Causeway Watch. | 2026-11-05 |
| **O3** | **The wider-world decisions D1 to D11 in `the-round-and-the-long-account.md` are approved.** The follow-up game is titled The Long Account. Its look is first person, low-resolution 3D with painted people. The royal fleet is found in pieces in the south and the King is never proven; fact 8 stays true as what the Blackfen knows. There is a second wall, at the White Deeps, which adds evidence and settles nothing. Marget Sayle (one of the four who came back from the survey), Edith Brode (Ancel Brode's granddaughter) and Prior Lambert Strand (Abbot Hamon Strand's nephew) exist. The Collectors are agents of the Exchange at Port Sable, and the priests claiming southern appointment are sent from Vauclere. The game is for up to four players. People are drawn and beasts are modelled. Microphones as noise in a Dead Calm are optional and off by default. Whether the cough is catching is left open. The game opens with a prologue on Orlen's highland edge (D11). Everything else in that file stays proposed. | 2026-11-11 |
| **O4** | **Small magic exists.** Minor spells of varying uses and powers, and runes and magic on weapons, are part of the world (D12 in `the-round-and-the-long-account.md`). This amends the tone rule below, which used to read "no spells, no glowing runes". As proposed in that file: spoken *workings* and *marks* cut into slag-iron; every one is small, is heard, and costs the one who speaks it; anyone can learn one and nobody is chosen; only people work them (O1); none feeds anyone, clears a lung, raises the dead or shows the future. **Prophecy stays out**, and the three unsettled questions (who made the Vaults, what the orks fled, why the Unnamed rise) stay unsettled. The retired isometric game showed no magic; see *Reading the older files* below for why the older files never mention it. | 2026-11-11 |
| **O5** | **The isometric Ashen Wilds game is retired, and this repository's game is The Long Account** (D13 in `the-round-and-the-long-account.md`): first person, in the look of the Shattered Octave build and the owner's key painting. The old game's code, assets, tests, tools and production records are removed from `main` and kept on the branch `archive/isometric-prototype`. **All of the lore is kept**, and is read in line with O3 and O4 as set out under *Reading the older files* below. | 2026-11-11 |

The archive was revised to fit O1 on the same day; see *Archive material revised for O1* below.

## Reading the older files after O3, O4 and O5 (2026-11-11)

Every file in this folder is kept. None was rewritten wholesale; each file tied to the retired game
carries a dated note at its head, and these rules say how all of them now read.

- **"In game", "the Godot game" and "the Godot build"** mean the retired isometric game. Its
  places, people, creatures, items, weathers and texts stand as lore.
- **Its numbers are reference, not rules.** Metres of hearing, seconds, kilograms, collision sizes,
  key bindings, test counts and paths under `scripts/` describe the retired build. The Long Account
  starts from them and is free to change them. The files and tools those paths name are on the
  archive branch.
- **"Needs:" lines and "Godot integration" notes** are design notes for the retired build. They bind
  nothing now.
- **The winter of S.30 stands as a story.** Acts I to III (the Watchhouse, the Bell Road, the
  Citadels) are kept as what may have happened that winter. The Long Account opens at the thaw that
  ends it and assumes none of its choices or endings: not whether the Causeway is open, not what
  was done at the mouth of the Vaults.
- **Small magic (O4).** No older file shows a working, because the Keeping's register-keepers did
  not write them down and the trades that kept most of them died with the Citadels
  (`the-round-and-the-long-account.md`, *Small magic*). Where an older file rules that one
  particular thing is not magical (a survey plate, a troll's hide, a rescue, a guarantee), that
  ruling stands: O4 adds small workings and marked blades, it does not make those things magical.
  The naming that lays an Unnamed to rest is a working; why a name works stays unsettled (fact
  18a). The Keeping's own line, that the naming is a debt owed to the dead and not a charm, stands
  as the Keeping's view. No beast works magic (O1).
- **The wider world (O3).** "The south", the Collectors, the priests claiming southern appointment
  and the question of where the fleet went read with `the-round-and-the-long-account.md`. What the
  Blackfen knows is unchanged: nobody there knows where the fleet went.
- **The unsettled questions stay unsettled:** who made the Vaults, what the orks fled, why the
  Unnamed rise.

---

## Tone

- **Grim and grounded.** Mud, cold, hunger, debt, small mercies. No chosen ones. Magic is small
  and costs something (O4): minor workings and marked weapons, nothing grand.
  **No prophecy is coming** *(in game)*.
- **Uncertainty is a rule, not a gap.** The archive's habit: say what happened, say what you do not
  know, write down the dead. Lore files separate *what we know* from *what people guess*.
  Beyond a known small working (O4), anything uncanny has, or could have, a plain cause.
- **Only people are people (O1).** Creatures are animals, lizards, fish and monsters: they hunt,
  scavenge, nest, flee and feed, and they are never reasoned with. The moral weight of the story
  sits with humans: what they owe each other, and what they do to each other. The worst choices in
  the Blackfen are made by people.
- **Obligation is the theme.** Who owes whom, after the ones who were owed protection were left
  behind: lords, priests, the Crown, the Watch, a household, a friend.
- **Plain words** and old English-flavoured names. **In-game text** uses plain ASCII punctuation
  (straight quotes, hyphens; no arrows or symbols). The rule began because the browser build had no
  system fonts, and The Long Account keeps it for its ledger panel.

## The hard facts

### The world before

1. **The Kingdom of Orlen**: a cold northern realm of fen, moor and highland, ruled from
   **Wexhaven** on the south coast. *(Godot addition: the archive names no kingdom.)*
2. Its wealth was **slag-iron**, a dark, heavy ore that holds heat for hours once fired, mined and
   smelted by the **Highland Citadels** *(in game)*: fortified mining houses under hereditary
   **Slag-Lords**, five in all: **the Slagcrown** (the greatest), **Greystair**, **Dunmarrow**,
   **Hob's Height** and **Kell Tor**. *(Godot addition.)*
3. The faith was **the Keeping** *(archive)*: the world is held apart from the dark by obligations
   kept; the distant god is the Keeper. Its senior priests **blessed the slag-iron expeditions**
   as stewardship. Its southern hierarchy left with the Crown; the local faithful, penitents,
   listeners and smaller movements remain (`keeping-and-merewick.md`).

### The Breaking and the Smothering

4. **The Deep-Seam Vaults** *(in game)*: worked chambers below the Slagcrown's deepest workings,
   reached by following **the Black Seam**, the richest slag-iron ever found. The stonework was
   not human. **Who made the Vaults is not known**, and lore files must not settle it.
5. **The Breaking (S.0)**: the Vaults were broken open on the order of the Slag-Lord **Cerrin
   Vane**. Within the year the north vented ash, and summer did not come back: **the Smothering**
   *(in game)*. Years are counted from it: **S.0**, **S.1** ... The game's present is **the winter
   of S.30** ("thirty years into the Smothering", *in game*).
6. What came up *(in game)*: **ash-spores**, **goblins** (swarms of small scavenging beasts, which the
   first winter called hordes), **ork war-clans fleeing something deeper** (packs of large, armed,
   drilled beasts: "war-clan" is the first winter's word for a pack), and the large things: ogres,
   the quarry-troll's kind. All of them are animals and monsters (O1).
7. **What the orks fled stays unexplained** *(archive, by design)*. They fled it as animals flee a
   fire, and never went back down. The listeners (a human movement) call it *the Hush*, Citadel
   miners said *the Tenant*, fen folk say *below*. Lore files may add evidence and guesses, never
   an answer.
8. **The Flight South (S.3)**: King **Aldric IV**, the court, the treasuries, the archives and the
   Keeping's senior clergy sailed from Wexhaven with the royal fleet, promising relief. The harbour
   and every remaining ship were burned behind them *(in game: "the kings fled south and burned
   the ships")*. Whether the burning was ordered is disputed. Nobody knows where the fleet went.
9. **Spring** still comes, barely: a few grey weeks of thaw when the ash turns to mud and the fen
   floods. Everyone tries to last until spring *(in game)*. Some say the ash is thinning. No one can
   prove it.

### The Blackfen

10. **The Blackfen** *(in game)*: the great marsh of Orlen's middle north, once a working landscape
    of grain, stone, peat, livestock and roads *(archive)*. Low, cold and wet, it outlasted the
    rest of the north, and the stragglers, deserters and peasants ended up there *(in game)*.
11. **Roads** *(archive)*: the **Old Causeway** (raised road across the wet, with a toll house half
    way and an ork-held choke point), the **Bell Road** (north to the uplands below the Citadels),
    the **Salt Trace** (south, the trade routes) and the **Corpseway** (to the hospice at Saint
    Orra's Steps).
12. **Places** *(archive)*: Reedwake, the Nailhouse, Bellwether Yard, the Nine Stakes, Brackenreach,
    Merewick, Rook's Stair, Low Harrow, and along the Bell Road the Last Gardens, Halwen House,
    Darnel Cross, the Split Kiln, the Bell-Tender's House, Saint Vey's Fold, the Bent Span,
    Coldbarrow, and **the Roofed Mile**, an avalanche gallery now occupied by an unidentified
    animal, which carriers call the gallery-crawler *(in game: one waits on the wall of the Roofed
    Gallery in the yard's south-west corner; lime and fire are its counters)*.
13. **The Wayfarer's Watchhouse** *(in game)*: a ruined Crown waystation at the Causeway's fen end,
    the survivors' refuge and hearth. It keeps the **warning book** (`bestiary.md`) and argues
    every winter about whom to admit. Its doorway is 1.35 m and stays that way, because of the
    ogre.
14. **The Causeway Watch**: the Crown's road garrison, left without pay or orders in S.3, which kept
    the Old Causeway for twenty-six years. **The Causeway tower fell to an ork pack last
    autumn, S.29**; the Watch Deserter *(in game)* held it until they didn't. The pack now holds
    the choke point *(in game)*. *(Godot addition.)*

### Life, death and money

15. **Salt** is the money *(Salt Ration, in game; archive: copying paper bought with salt)*; prices
    are in **measures**. Orks crave salt like cattle at a lick: they raid salt stores and hoard it, and a dead ork often
    has some in its gut or its plunder.
16. **Lime the dead or meet them** *(archive)*. The ash-spores fruit in the unburied dead as
    **corpse-caps**; lime and fire stop them. The Split Kiln's lime is worth as much for graves as
    for chimneys. Fire works but costs fuel nobody has.
17. **Ash-lung (the Coughing)** *(archive)*: the grey cough, the crust, silence, the bloom.
    **"Ashbound"** is the fen's word for whatever came up with the ash and whatever the ash has
    taken: (1) the Vault-born beasts, goblins, orks, ogres and trolls *(in game: "the enemies are
    the Ashbound")*; and (2) as a verdict on people, anyone who has stopped answering: the
    far-gone sick in the silent stage of ash-lung, the starving and lost, and **bands who take the
    name**, deserters and raiders in grey rags, who took Edda and left her bound in the Watchhouse
    *(archive + in game)*. Calling a person Ashbound is still a verdict, and the warning book
    records who said it. *(Revised for O1.)*
17a. **Why the beasts wear rags and hoods** *(in game: hooded, ragged, grey-skinned)*: the
    Vault-born strip cloth from the dead and drag it over themselves, the way some animals dress in
    what they find. Survivors guess it is against the light, or the cold, or to smell of people.
    Nobody knows; it is habit, not dress.
18. **The Ash-Spore Husk** *(in game)* reconciles with ash-lung this way: in a few of the sick the
    bloom roots **before the body has finished dying**, so the caps fruit in a body that still
    walks. Every wound puffs spores and death bursts the whole crop at once. Carriers call them
    **walking blooms** or husks. Fire burns spores *(in game)*; still air keeps a cloud hanging,
    wind and sleet clear it *(in game)*. *(Godot addition.)*

18a. **The Unnamed** *(in game, the Drowned Graves in the yard's south-east corner)*: the drowned
    dead of a burial ground put into the wet ground in the Smothering without their names, against
    the Keeping's custom of speaking a corpse's name into its mouth *(archive)*. They walk. Cut one
    down and it rises whole again; it lies down for good only when someone kneels at its grave and
    speaks a name. They are monsters, not people (O1): they do not speak, plead or remember. **Why
    they rise is not known**, and lore files must not settle it: the Keeping says an unnamed body
    has no rest; healers suspect the bloom, which does not explain why a name works; carriers say
    any name will do, which the faithful deny. The Unwriters (a human movement, renamed from the
    archive's "the Unnamed") erased names and graves, and some blame them for the walking dead.

### The Godot game's people

19. **Edda** *(in game)*: a survivor the band calling itself Ashbound left bound in the Watchhouse;
    cut free, she throws in with you. Not the Merewick **Eda** (who dried pages); the names are
    unrelated unless the owner says otherwise.
20. The **eight backgrounds** *(in game)* are walks of life the archive already knows: Watch
    deserters, Cinder Factors (road carriers), chapel cleaners, peat-cutters, the Gutter-kin
    (human road waifs: see Q1), hedge-priests, fen healers, causeway carters. All human (O1). See
    `godot-people.md`.

## Open questions this sheet does not settle

| # | Question | Options |
|---|---|---|
| Q1 | ~~The Gutter-kin background~~ **Settled by O1:** the Gutter-kin are human road waifs, children who sheltered under the Roofed Mile and lived by taking what wasn't watched; the Godot card stands. The archive's Gutter Kin were revised into the same kind of human household. | Settled |
| Q2 | Mara Venn and Harl name conflicts (from `keeping-and-merewick.md`) | Unchanged; still the owner's to settle |
| Q3 | ~~The kingdom's name, Wexhaven, the Citadels' names, Aldric IV, Cerrin Vane~~ | **Settled by O2:** kept |
| Q4 | Whether the archive's "faction bible" and "Reedwake chapter" still exist | They are referenced but in neither repository |

## Archive material revised for O1 (2026-11-05)

The copied archive files were revised in place to fit O1; each revised file says so in its
status line. The originals, as copied from the browser prototype, are in git history at commit
`fd60061`.

| File | What changed |
|---|---|
| `bestiary.md` | Goblins: "a beast, not a people", swarming nest scavengers that hoard bright scraps; no bargains, kin or names. Orks: a ranked pack carrying stolen shields and cleavers, dens with one way in, a salt craving, an animal silence; no households, trading stones, elders or craft. The ogre hoards iron like a magpie. Ashbound: fact 17's two senses; ash-lung is human. Walking blooms added. Measures, senses, habitats, temperaments and the Godot numbers unchanged. |
| `gutter-kin.md`, `gutter-kin-members.md`, `hesh-challenges-oren.md`, `hesh-challenge-aftermath.md` | **The Gutter Kin are a human household of road waifs**: children who sheltered under the Roofed Mile, took what wasn't watched, and chose each other as kin. "Gutter" is others' slur; to the Remnant they are squatters and thieves. Every name (Hesh, Sere, Kett, Brik, Iss, Moth), custom, quarrel and dialogue beat kept. |
| `glasshouse-clearing.md`, `glasshouse-clearing-complications.md`, `rauth-glasshouse-inspection.md`, `remnant-goods-interception.md`, `gutter-remnant-relationship-web.md`, `grey-lash-relationship-web.md`, `halwen-house-occupation-factions.md` | The clearing stays a negotiated evacuation, now between people; cross-species distrust became class prejudice, past thefts and fear of the cough. Names, beats and diagram nodes unchanged. |
| `garden-hands.md`, `halwen-house.md` | The goblins in the glasshouse range became the human Gutter Kin. |
| `bell-road-locations.md` | Saint Vey's Fold: an ork den in the rear range, walled off with dressed stone by the Fold's people, who live beside it; no ork families or trading stone. The orks still will not den under timber, unexplained. |
| Everything else | Unchanged: no passage broke O1. |

## Name register

**In game** (the retired isometric game)**:** the Smothering · the Highland Citadels · the Deep-Seam Vaults · the Blackfen · the
Blackfen Outskirts · the Wayfarer's Watchhouse · the Old Causeway · the Roofed Mile · the Spore
Hollow · the Old Quarry · the North-West Feeding Ground · Goblin Scavenger · Ork Vanguard ·
Blackfen Ogre · Blind Quarry-Troll · Ash-Spore Husk · the Unnamed · the Drowned Graves · Edda · the eight backgrounds · the six
weathers (Ashfall, Miasma fog, Sleet, Cinder-squall, Hoarfrost, the Dead Calm) · every item in
`scripts/data/item_database.gd`.

**Archive:** see the files themselves; above all the Keeping, the Keeper, the listeners, the
Hush, the Tenant, the Tithe, the Last Hearth, the Unwriters, the four roads and the places in fact
12, Garden Hands, Halwen Remnant, Grey Lash, ash-lung, corpse-caps, the
gallery-crawler, the warning book.

**Godot additions (this sheet):** Orlen · Wexhaven · slag-iron · the Slagcrown, Greystair,
Dunmarrow, Hob's Height, Kell Tor · Slag-Lords · the Black Seam · Cerrin Vane · the Breaking ·
S-dating · the Flight South · Aldric IV · the Causeway Watch · walking blooms. Files written for
this repository list their own new names at the end.

**Wider world (O3):** see the *New names* list at the end of `the-round-and-the-long-account.md`.
