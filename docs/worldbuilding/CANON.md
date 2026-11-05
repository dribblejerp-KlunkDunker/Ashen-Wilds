# Canon sheet: the facts every Ashen Wilds file shares

**Status: PROPOSED** (2026-11-05), like everything in `docs/worldbuilding/`. This sheet does not make
anything canon by itself; the owner does. It exists so the two builds (this Godot game and the
browser prototype, `Grim-Dark-Ashen-Wilds-`) and every lore file tell the same story.

**Precedence.** (1) The owner's explicit decisions. (2) What ships in the Godot game: the README
premise, item and background text, enemy doc comments, banners. (3) This sheet. (4) The other
files in this folder. When a lower one disagrees with a higher one, the lower one is corrected.

**Where the files came from.** The 24 files listed in `README.md` under *Previously preserved*,
*Remaining conversation material* and *Bestiary* were copied unchanged from the browser
prototype's `docs/worldbuilding/` (its commit `7afd805`, 2026-11-05). The files listed under
*Godot additions* in `README.md` were written for this repository to fill the gaps the archive
left: the kingdom, the Breaking, the thirty years, Act I as it is built, the people of the Godot
game, the acts, and texts the game can show.

---

## Tone

- **Grim and grounded.** Mud, cold, hunger, debt, small mercies. No chosen ones, no spells, no
  glowing runes. **No prophecy is coming** *(in game)*.
- **Uncertainty is a rule, not a gap.** The archive's habit: say what happened, say what you do not
  know, write down the dead. Lore files separate *what we know* from *what people guess*.
  Anything uncanny has, or could have, a plain cause.
- **Peoples, not monsters.** Goblins and orks are peoples who bargain, lie, keep deals and break
  them. The worst things in the Blackfen are often people.
- **Obligation is the theme.** Who owes whom, after the ones who were owed protection were left
  behind: lords, priests, the Crown, the Watch, a household, a friend.
- **Plain words** and old English-flavoured names. **In-game text** uses plain ASCII punctuation
  (straight quotes, hyphens; no arrows or symbols): the browser build has no system fonts.

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
6. What came up *(in game)*: **ash-spores**, **goblins** (households fleeing at once, which the
   first winter called hordes), **ork war-clans fleeing something deeper**, and the large things:
   ogres, the quarry-troll's kind.
7. **What the orks fled stays unexplained** *(archive, by design)*. The listeners call it *the
   Hush*, Citadel miners said *the Tenant*, fen folk say *below*. Lore files may add evidence and
   guesses, never an answer.
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
    animal.
13. **The Wayfarer's Watchhouse** *(in game)*: a ruined Crown waystation at the Causeway's fen end,
    the survivors' refuge and hearth. It keeps the **warning book** (`bestiary.md`) and argues
    every winter about whom to admit. Its doorway is 1.35 m and stays that way, because of the
    ogre.
14. **The Causeway Watch**: the Crown's road garrison, left without pay or orders in S.3, which kept
    the Old Causeway for twenty-six years. **The Causeway tower fell to an ork road-clan last
    autumn, S.29**; the Watch Deserter *(in game)* held it until they didn't. The clan now holds
    the choke point *(in game)*. *(Godot addition.)*

### Life, death and money

15. **Salt** is the money *(Salt Ration, in game; archive: copying paper bought with salt)*; prices
    are in **measures**. Orks need salt more than people and trade iron and leather for it.
16. **Lime the dead or meet them** *(archive)*. The ash-spores fruit in the unburied dead as
    **corpse-caps**; lime and fire stop them. The Split Kiln's lime is worth as much for graves as
    for chimneys. Fire works but costs fuel nobody has.
17. **Ash-lung (the Coughing)** *(archive)*: the grey cough, the crust, silence, the bloom.
    **"Ashbound" is a verdict, not a species**: the Watchhouse word for anyone who has stopped
    answering. Most are the far-gone sick (human, goblin or ork); a few are the starving and lost;
    a few are **bands who take the name**, deserters and raiders in grey rags, who took Edda and
    left her bound in the Watchhouse *(archive + in game)*.
18. **The Ash-Spore Husk** *(in game)* reconciles with ash-lung this way: in a few of the sick the
    bloom roots **before the body has finished dying**, so the caps fruit in a body that still
    walks. Every wound puffs spores and death bursts the whole crop at once. Carriers call them
    **walking blooms** or husks. Fire burns spores *(in game)*; still air keeps a cloud hanging,
    wind and sleet clear it *(in game)*. *(Godot addition.)*

### The Godot game's people

19. **Edda** *(in game)*: a survivor the band calling itself Ashbound left bound in the Watchhouse;
    cut free, she throws in with you. Not the Merewick **Eda** (who dried pages); the names are
    unrelated unless the owner says otherwise.
20. The **eight backgrounds** *(in game)* are walks of life the archive already knows: Watch
    deserters, Cinder Factors (road carriers), chapel cleaners, peat-cutters, the Gutter-kin,
    hedge-priests, fen healers, causeway carters. See `godot-people.md`.

## Open questions this sheet does not settle

| # | Question | Options |
|---|---|---|
| Q1 | **The Gutter-kin background.** The Godot card says "You grew up under the Roofed Mile taking what wasn't watched"; the bestiary calls it a goblin background ("also a playable background, the Gutter-kin"); the archive's Gutter Kin are a goblin household at Halwen House; the survivor model is human. | (a) a human raised by or among goblin households, who took the name; (b) a goblin survivor (needs a goblin body); (c) the Gutter-kin are an older word for any road waif |
| Q2 | Mara Venn and Harl name conflicts (from `keeping-and-merewick.md`) | Unchanged; still the owner's to settle |
| Q3 | The kingdom's name, Wexhaven, the Citadels' names, Aldric IV, Cerrin Vane | Proposed here; nothing in either build names them yet |
| Q4 | Whether the archive's "faction bible" and "Reedwake chapter" still exist | They are referenced but in neither repository |

## Name register

**In game:** the Smothering · the Highland Citadels · the Deep-Seam Vaults · the Blackfen · the
Blackfen Outskirts · the Wayfarer's Watchhouse · the Old Causeway · the Roofed Mile · the Spore
Hollow · the Old Quarry · the North-West Feeding Ground · Goblin Scavenger · Ork Vanguard ·
Blackfen Ogre · Blind Quarry-Troll · Ash-Spore Husk · Edda · the eight backgrounds · the six
weathers (Ashfall, Miasma fog, Sleet, Cinder-squall, Hoarfrost, the Dead Calm) · every item in
`scripts/data/item_database.gd`.

**Archive:** see the files themselves; above all the Keeping, the Keeper, the listeners, the
Hush, the Tenant, the Tithe, the Last Hearth, the Unnamed, the four roads and the places in fact
12, the Gutter Kin, Garden Hands, Halwen Remnant, Grey Lash, ash-lung, corpse-caps, the
gallery-crawler, the warning book.

**Godot additions (this sheet):** Orlen · Wexhaven · slag-iron · the Slagcrown, Greystair,
Dunmarrow, Hob's Height, Kell Tor · Slag-Lords · the Black Seam · Cerrin Vane · the Breaking ·
S-dating · the Flight South · Aldric IV · the Causeway Watch · walking blooms. Files written for
this repository list their own new names at the end.
