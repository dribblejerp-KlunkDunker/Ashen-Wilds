# Items and texts: what the Blackfen carries and writes

**Status: PROPOSED** (Godot addition, 2026-11-05). Nothing here changes a mechanic; every weight,
stat and loot table is as `scripts/data/item_database.gd` and `scripts/core/scene_bootstrap.gd`
ship it. The proposed descriptions, texts and new items are for the owner to accept, cut or rewrite.

**Summary.** Where each of the game's seventeen items comes from, who made or carried it, what it
costs in measures of salt, and a longer description the owner can swap in. Then the material
culture of the Smothering: what can still be made, what can only be salvaged, and how people
trade. Then fourteen new items that fit the systems the game already has. Last, a library of
in-game texts ready to place: notes and letters, carved boards, discovery banners and alternative
background epigraphs, each with its place in the Act I level.

**Owner decision applied (2026-11-05), overriding the archive and `CANON.md`.** Goblins and orks
are **not peoples**. Only humans are people: every creature, goblins, orks, ogres and trolls
included, is an animal or a monster, with no language, names, culture, faith, bargains or society. So this file has no trading stone, no trade with goblins or orks, and nothing made by
them. Orks crave salt the way a beast craves a lick: they raid salt stores and hoard what they
take. Their gear is stolen or scavenged human gear. Where the archive (`bestiary.md`, the Saint
Vey's Fold ork households, "put it down and step back") or `CANON.md` (Tone: "Peoples, not
monsters"; fact 14, "an ork road-clan") says otherwise, this file follows the decision. Those
files need correcting to match. Trade in this file happens between people only.

**Rules for the in-game text below.** Everything in a `text` block, and every proposed description,
is plain ASCII: straight quotes, hyphens, no arrows, symbols or em dashes (the browser build has
no system fonts). Proposed descriptions are under 140 characters, epigraphs under 100, banners
under 90. Dates use S-years. The present is the winter of S.30. The Causeway tower fell in the
autumn of S.29.

---

## 1. The items

### How to read a price

Prices are in **measures** of salt. A measure is the Watch's salt cup **struck level**, about a
third of a kilo. A Salt Ration is one measure sewn into oiled cloth, so the game's 0.4 kg includes
the wrapping. Striking the measure level in front of the buyer is a public act. Heaping it is a
gift, and short-striking it is the commonest cheat in the fen. The prices below are what a fair
trader at the Watchhouse would ask in an ordinary winter. Deep winter, sleet and a closed
Causeway raise everything, and fuel most of all.

### Tarnished Arming Sword

*Weapon (blade), 1.4 kg. In the Watch Deserter's kit at 88% and the Gutter-kin's at 55%.*

A one-handed Crown arming sword of the Causeway Watch, forged in the Highland Citadels' smithies
before the Breaking and issued out of Wexhaven's armouries. Watch blades were punched with a
tower number below the cross. The Deserter's still has its number. The Gutter-kin's has been filed
off, which is why "the sword was someone else's". After S.3 the Watch got no more swords, so for
twenty-six years it kept the ones it had. A sword that stays on a road outlives its owners and
goes to whoever takes the dead man's post. It is tarnished because oil went to the lamps first.

*What it says about the world:* nobody in the Blackfen can make a blade like this any more. The
steel came down from the Citadels, and nobody goes up there now. Every good sword in the fen is
older than the Smothering, and every one has had several owners.

*Price:* 20 measures. Swords are rarely sold. They are inherited, issued or taken.

**Proposed description:** `Crown issue, Citadel steel, older than the Smothering. The tower number under the cross is all the pay it had.`

### Boar-Lugged Spear

*Weapon (polearm, two-handed), 2.6 kg. In the Watchhouse Supply Chest at 72%, and in the Cinder
Factor's and Fen Healer's kits.*

A leaf blade on a socket, with two iron lugs below it so that a charging peat-boar cannot run up
the shaft to the hands holding it. In the first winters the turned-out farm pigs went wild in the
reedbeds, and the farm smiths made these by the hundred, forging the heads from plough-irons and
hinge strap and hafting them on ash wood (the tree, not the fall). Road carriers carry one as a
walking staff that also keeps Greymaw off. The Watchhouse keeps one in its chest for the thaw
hunt that feeds the shelter, and the note in the chest says not to lend it.

*What it says:* the fen's first dangers were animals, and its weapons were made for them. A spear
is the one weapon a household can still re-haft, if it has a length of seasoned timber.

*Price:* 8 measures (the head is worth 5).

**Proposed description:** `A farm smith's boar spear. The lugs stop a charging boar running up the shaft to your hands.`

### Woodsman's Broadaxe

*Weapon (axe), 2.3 kg. In the Ork Plunder Pile at 90%, and in the Peat-cutter's and Causeway
Carter's kits.*

A broadaxe is a hewing axe, not a felling axe: a wide flat bit, bevelled on one side, for squaring
logs into beams. Wheelwrights, carters and roof-wrights carried them. There is little standing
timber left in the Blackfen worth hewing, so the broadaxes split salvaged beams, chop roots out of
the peat, and do the other work. The one in the plunder pile came off a cart on the Causeway. The
orks drag back whatever is heavy and smells of hands.

*What it says:* most of the fen's weapons were tools first. The game's three weapons are a soldier's
sword, a farmer's spear and a builder's axe, and only one of them was made for people.

*Price:* 10 measures.

**Proposed description:** `A hewing axe for squaring beams, and there are few beams left. Bites deep and is slow to come back.`

### Wooden Targe

*Shield, 3.5 kg. In the Watch Deserter's, Chapel Cleaner's, Hedge-priest's and Causeway Carter's
kits.*

A round shield of alder planks (the fen's own tree, light and slow to split), glued with hide
glue, faced with boar rawhide and nailed round with an iron rim. The Watch issued them once. Now
anyone with alder, glue and a rim can make one, and the rim is the costly part: usually a cart
tyre cut down and bent by a smith. It splinters because it is fen-made, and nobody pretends
otherwise.

*What it says:* the targe is one of the few things in the game the Blackfen still makes. Wood,
hide and glue are local, and only the iron is salvage.

*Price:* 6 measures (the rim is worth 4).

**Proposed description:** `Alder planks under boar rawhide, rimmed with a cut-down cart tyre. Fen-made, and it splinters like it.`

### Pitch Torch

*Torch, 0.8 kg, 240 s of fuel by default. In every background's kit (90 s for the Gutter-kin, 360 s
for the Hedge-priest) and fresh in the Spore-Choked Cart.*

A stave with a head of rag wound tight and dipped in pitch. The pitch is boiled from **bog-pine**:
the resinous roots of old pines that peat-cutters dig out of the peat, whose splits burn like
candles. Birch bark tar stretches it. A hedge-priest winds the head thick, because the light is
the work. Every survivor knows the saying *a light means fuel, not safety*. A flame draws
ash-moths first and something worse after. Since the husks came, the Watchhouse has had a second
rule: nobody crosses the Spore Hollow without a lit torch, because fire burns spores.

*Price:* 2 measures.

**Proposed description:** `Rag wound on a stave and dipped in bog-pine pitch. A light means fuel, not safety. Fire burns spores.`

### Padded Coif

*Armour (head), 0.6 kg. In the Shelter Stash at 48%.*

A quilted linen cap worn under a helmet to stop the iron chafing. On its own it does very little.
It was Watch issue under the kettle hat. The Deserter's trait text says "your old coif is in the
shelter stash": it was left there when they came in off the Causeway, and the helmet that went
over it was lost at the tower. At 48% it is sweat-rotted at the seams.

*Price:* 3 measures.

**Proposed description:** `Quilted linen worn under a helmet, kept after the helmet was lost. Turns a glancing blow and little else.`

### Kettle Hat

*Armour (head), 1.4 kg. In the Gnawed Bone Heap at 70%.*

A brimmed iron helmet of the Causeway Watch, raised in two halves and riveted along the crest in
Coldbarrow's smithies before S.3. The brim keeps ash, sleet and downward blows off the face. The
warning book says the ogre keeps the iron things that came with its meals, perhaps because they
smell of food. A sweated-through helmet smells of a person, so whoever wore this one is in the
heap. A name may be scratched in the lining (note 11 below).

*Price:* 12 measures. It is also the only thing in the heap that can tell you who died there.

**Proposed description:** `A Watch helmet with a brim, dented and sweated through. The ogre kept it for the smell. Its owner is in the heap.`

### Quilted Gambeson

*Armour (body), 3.2 kg. In the Watchhouse Supply Chest at 95%. The Causeway Carter starts in one at
90%.*

Thirty layers of linen, quilted in rows. Linen is the one cloth the Blackfen still makes. The Last
Gardens grow a little flax, and every household that can spins it. A gambeson takes a household
a winter of spinning and stitching, and a steel needle, which nobody can make any more. The one
in the Watchhouse chest is the shelter's spare, "for whoever goes out", and it is meant to come
back. The carter's was worn on the box seat against the cold as much as the cuts.

*Price:* 15 measures.

**Proposed description:** `Thirty layers of linen, a household's winter of stitching. Warm, and it stops a cut from going deep.`

### Rusted Mail Hauberk

*Armour (body), 8.5 kg. In the Ork Plunder Pile at 110 condition.*

Knee-length riveted mail: thousands of rings, each one drawn as wire, cut, punched and riveted.
Nobody in the Blackfen can draw wire now, so a broken ring can only be replaced with a ring taken
from another hauberk. The Causeway tower held one or two of these for whoever stood at the gap.
When the orks took the tower in S.29, they dragged this one back to their pile with the rest. It
does not fit them, and they do not wear it. Like the ogre with its heap, they hoard what is heavy
and iron. It is orange at every ring because oil went to lamps, and because salt sweat eats mail.

*Price:* 40 measures, and nobody has sold one in living memory. The Watch used to say a hauberk was
worth a tower.

**Proposed description:** `Crown mail from the Causeway tower, orange at every ring. Nobody alive can draw the wire to mend it.`

### Leather Greaves

*Armour (legs), 1.2 kg. In the Rotted Grain Crate at 60%.*

Boiled leather shaped over a wooden last into a shin guard, laced at the back. Brackenreach's
tannery quarter made them for carters, cutters and drovers against reed-cuts, boar tusks and dog
bites. These were packed into the grain crate for the winter, or hidden there. The rats got into
the grain and ate the old laces, and the owner never came back for either.

*Price:* 5 measures.

**Proposed description:** `Boiled leather shaped to the shin, laced at the back. Made for reed-cuts and dog bites. The rats ate the old laces.`

### Splinted Greaves

*Armour (legs), 3.0 kg. Dropped by some ork corpses (30%) at 70 condition.*

Iron splints riveted to a leather backing: Watch issue for road work, where a blow comes low. Orks
are found with human gear caught and buckled on them anyhow: greaves round a forearm, a belt round
the neck, a kettle hat snagged on a strap. The book does not think it is armour to them. They keep
what they have taken on their bodies, the way a jackdaw lines its nest. Every pair of splinted greaves
found on an ork belonged to someone first.

*Price:* 9 measures.

**Proposed description:** `Watch splints riveted to leather, cut off an ork that had them buckled on anyhow. They clatter on stone.`

### Clean Rag Bandage

*Consumable, 0.1 kg, stacks of 10. In every kit (five for the Fen Healer, four for the Chapel
Cleaner), the Shelter Stash, the Watchhouse Supply Chest, the Ork Plunder Pile and the
Spore-Choked Cart. Goblin corpses carry one half the time, orks 70% of the time, husks 40%. The
troll and the ogre carry them too. Lifting a downed Edda takes one, and she leaves one behind if she
dies.*

*Clean* means boiled, and boiling takes fuel and a pot. When the priests fled, altar cloth became
bandages and vestments became bedding (`keeping-and-merewick.md`). Goblins and orks steal cloth
as readily as iron. Rags turn up in their hoards and wound round their bodies, and the book's guess
is warmth. A rag taken off a beast is boiled before it touches a wound, if anyone has the fuel.

*Price:* 1 measure.

**Proposed description:** `Linen boiled clean and rolled tight. Stops bleeding and closes a little. Clean costs fuel: never waste one.`

### Iron Scrap

*Material, 0.6 kg, stacks of 20. One in the Rotted Grain Crate, two in the Gnawed Bone Heap. On
every corpse: goblins 1-2, orks 2-3, husks 1, the ogre 3, the troll 4.*

Bent nails, hinge plates, chain links: iron the Blackfen cannot make, only move. The smiths at
Coldbarrow and the Nailhouse forge scrap back into nails, rims and spear-heads. Goblins snatch
small iron like magpies, and orks hoard it in their piles. The fen's custom of leaving a bent nail at
a roadside shrine, in hope of an open door, means every shrine is a small iron store. Taking from
one is bad luck, and hungry people do it anyway. Two warnings travel with it. Rustlings, the iron
beetles, eat it in damp stores. And *never keep the salt with the iron*, because salt rusts it.

*Price:* half a measure a handful, two for a measure.

**Proposed description:** `Bent nails, hinge plates and chain links. Iron is not made in the Blackfen any more, only moved. Keep it from salt.`

### Salt Ration

*Material, 0.4 kg, stacks of 20. Two in the Watchhouse Supply Chest. Goblins carry one a third of
the time, orks 1-2, the troll 2, the ogre 3.*

The money of the Blackfen (section 2). Salt comes north up the Salt Trace from the coast salterns,
where brine is boiled down over peat, so every measure has burned fuel twice: once in the pan and
once on the road. It keeps pork through the winter, drops a bloodwick off the skin, buys a bed,
pays a copyist (the Merewick villagers "bought copying paper with salt"), and settles debts.
Orks crave it the way cattle crave a lick. They raid salt stores, lick salt-bearing rock, and
hoard what they take. A dead ork almost always has salt on it or near it. Nobody knows why they
need so much more than people do.

*Price:* 1 measure, by definition.

**Proposed description:** `One measure, struck level and sewn in oiled cloth. Keeps meat through the Smothering and pays for nearly everything.`

### Seasoned Timber

*Material, 1.5 kg, stacks of 10. One in the Shelter Stash, two in the Rotted Grain Crate, two on the
ogre. In the networked courtyard, repairing the breach costs two and lighting the hearth costs
one.*

Wood dry enough to burn without smothering the fire in smoke, or to build with without rotting.
Nothing seasons in a land without a summer. The trees that died in the first winters stand wet to
the heart. So nearly all the seasoned timber in the Blackfen comes out of buildings: roof battens,
floorboards, cart frames, pews, shutters. Every length came out of someone's roof. At Merewick,
chapel-roof timber discharged a debt. At the Watchhouse, the argument every winter is whether to
burn it or build with it.

*Price:* 1 measure a length, 2 in deep winter.

**Proposed description:** `Dry wood, cut out of a roof somewhere. Nothing dries in the Blackfen now. Burn it or build with it, not both.`

### Flask of Lamp Oil

*Material, 0.9 kg, stacks of 5. In the Ork Plunder Pile and the Spore-Choked Cart. Orks carry one
30% of the time, the troll always.*

An earthen flask stoppered with wax, holding oil rendered from eels (Low Harrow's are the fattest),
boar fat and tallow, with a little thin southern oil from the Salt Trace when the carriers get
through. It fills a lantern, and the Watchhouse has two lanterns and seldom the oil for both. It
also soaks a rag for fire. In *The third arch*, the man beyond the fifth pier broke a flask like
this and struck his fire steel, and that was the end of him and very nearly of the animal.

*Price:* 3 measures.

**Proposed description:** `Rendered eel and boar fat in an earthen flask. Fills a lantern or soaks a rag for fire. Keep it from the torch.`

### Cast-Iron Cooking Pot

*Tool, 4.5 kg. In the Gnawed Bone Heap at the North-West Feeding Ground. An Act I objective.*

Cast slag-iron, from Coldbarrow's foundry before the Breaking. Slag-iron holds its heat for hours
once fired, so a pot of it keeps a stew simmering long after the fire is banked. That saves fuel,
and it is why a pot is precious beyond its weight in iron. With a pot, a shelter can boil marsh
water (which stops the flux), boil rags clean, render fat into lamp oil, and stretch a meal for
four to feed ten. Nobody can cast iron now. The ogre kept it because it smelled of food.

There is a harder question. The Keeping counts the things buried with the dead as theirs (a
Door-Man once asked whether anyone would swear a pot belonged to the dead). A pot from a bone heap
belongs to someone who died there. The Watchhouse custom (section 2) says it is the shelter's
until kin come forward with a name.

*Price:* 30 measures. The Watchhouse says *a pot is a household*.

**Proposed description:** `Cast slag-iron. It holds its heat for hours after the fire is banked. With a pot, a shelter can boil water, rags and stew.`

*(Edda's cudgel is not an item. It is part of her model and her attack.)*

---

## 2. Material culture

### Made, mended, or only moved

The Smothering split the Blackfen's goods into three kinds, and the split explains every price.

| Still made in the Blackfen | Only mended | Only salvaged, never made |
|---|---|---|
| Linen (a little), rope, hide glue, rawhide, boiled leather | Targes, spears (re-hafted), gambesons, greaves | Swords, mail, kettle hats, cast-iron pots |
| Lime (the Split Kiln, Rook's Stair) | Carts, roofs, bridges | Steel needles, drawn wire, glass |
| Pitch and torches (bog-pine), tallow, eel oil | Nails (re-forged from scrap) | Paper, ink of any quality |
| Salt (the coast salterns, by the Salt Trace) | Lanterns | Seasoned timber (it comes out of buildings) |

What is made is made from the fen: reed, peat, hide, fat, chalk, brine. What is mended is mended
with salvaged iron. What can only be salvaged gets rarer every winter and never comes back. A
survivor carrying a sword, a hauberk and a pot is carrying three things the world has stopped
making.

### What is valuable, and why

**Salt.** Salt is money because everyone needs it, it keeps, it divides, and it is hard to fake.
A measure is the Watch's salt cup struck level. Salt preserves the only meat there is (boar,
eel, mutton) through a winter that does not end, so a household with no salt eats its pig in a
week or loses it. Salt buys beds, copies and passage. It must be kept dry and away from iron.
Orks raid salt stores, so a store near a road is guarded or empty.

**Iron.** It cannot be made, only moved. The Citadels and their ore are in the uplands, and nobody
goes up there. Every nail in the fen is a nail that was there before S.0. Smiths re-forge scrap.
Goblins and rustlings take it away. Ogres and orks keep it in their heaps and piles, which is why
the best salvage in the Blackfen is next to the worst danger.

**Lime.** *Lime the dead or meet them.* Quicklime on a body stops the corpse-caps fruiting. Lime
also mortars chimneys and drove back the Roofed Mile animal. The Split Kiln and Rook's Stair burn
it, and fuel decides how much they can make. A grave limed is a grave that stays a grave. A cart
of lime can be worth more than a cart of grain to the right village. Annet's company carried six
sacks up the Bell Road for four chimneys.

**Dry timber.** It comes out of buildings, so every fire and every barricade costs a roof somewhere.
Shelters strip their own outbuildings in deep winter and argue about it in the thaw.

**Fuel.** Peat for the hearth (wet, smoky, slow), bog-pine for light, tallow and oil for lamps. The
fen has fuel, but drying it needs dry weather, which there is not. Everything else in this list
costs fuel to make or move. Salt is boiled, lime is burned, rags are boiled and iron is forged.

**Rope.** Twisted from flax, reed, hide or horsehair. Rope hauls carts out of the wet, ties loads,
crosses Low Harrow and lifts at the Bent Span. A coil is a season's work. The band that took Edda
"carry rope", and the book counts that as a sign of a band.

**Needles.** A steel needle is drawn wire, hardened and eyed, and nobody can make one now. Bone
needles do for coarse work. Steel is needed for linen, quilting and wounds. Needles are carried in
a wooden case on a cord round the neck, and stealing one is treated like stealing a tool.

**Cloth.** Linen is spun from what flax will grow, and wool from what sheep are left (ash-moth grubs
eat it in store). Cloth is bandage, bedding, masks against spores, wrapping for salt, and the
backing of every piece of armour in the game.

**Paper.** Nobody in the Blackfen makes paper. What there is came up from the south before S.3 or
was cut from books. Most writing is on the backs of things: shutter boards, crate lids, register
margins, the board from the Roofed Mile. The Watchhouse's warning book is stitched from damaged
merchant sheets and blank margins, the way Mara Venn stitched Merewick's. A page of it is worth
more than its weight in salt to the people it names.

### How people trade

**Only between people.** Only humans are people. No creature trades, goblins and orks included. Goblins snatch: small iron, cloth, salt and
anything that shines, from packs, stores and the dead. Orks raid: salt stores above all, then iron
and anything heavy, which they drag back to a plunder pile and leave there. A hoard is not a
market. It is where lost goods turn up.

**The barter board.** The Watchhouse keeps a plank by the door for trade with carriers. A trader
chalks what they bring and what they want, and the Watchhouse chalks its answer underneath. Salt is
struck level on the board itself, in front of both parties and a witness. Debts go in the warning
book's back pages ("owed to the house"), because the book is the only record everyone can read.

**Carriers.** The Cinder Factors carry salt, oil, needles and news up the Salt Trace and the
Causeway. They take a cut in salt and are paid on arrival, never in advance. Carriers who bring
news pay less for their bed (the custom at Darnel Cross too).

**Hoard-right.** The Watchhouse custom for what comes out of a hoard or a heap: the finder keeps
it unless someone names it and has a witness. Whatever was on the dead goes to their kin if any
come forward, and to the shelter if not. A name in the book is how a dead person's kin find their
things. That is why the Watchhouse asks for every name scratched in a helmet. The cooking pot is
the shelter's under this rule until someone comes with a name for it.

**Receipts.** The Crown gave villages receipts for grain it took south. Thirty years on, some
families still keep them. They are worthless, and nobody throws them away.

### Price table (an ordinary winter at the Watchhouse)

| Item | Measures | Note |
|---|---|---|
| Salt Ration | 1 | The unit |
| Iron Scrap (a handful) | 1/2 | Two for a measure |
| Clean Rag Bandage | 1 | More in a bad week |
| Seasoned Timber (a length) | 1 | 2 in deep winter |
| Pitch Torch | 2 | |
| Flask of Lamp Oil | 3 | Scarce when the Salt Trace floods |
| Padded Coif | 3 | |
| Leather Greaves | 5 | |
| Wooden Targe | 6 | The rim is 4 |
| Boar-Lugged Spear | 8 | The head is 5 |
| Splinted Greaves | 9 | |
| Woodsman's Broadaxe | 10 | |
| Kettle Hat | 12 | |
| Quilted Gambeson | 15 | |
| Tarnished Arming Sword | 20 | Seldom sold |
| Cast-Iron Cooking Pot | 30 | "A pot is a household" |
| Rusted Mail Hauberk | 40 | Never sold in living memory |
| *For comparison:* a night's bed by the fire | 1 | Less with news |
| A sack of lime (proposed item) | 2 | At the kiln; 4 at the Watchhouse |
| A steel needle (proposed item) | 4 | |
| A copied page | 2 | Paper and copyist |
| A burial, limed | 3 | Lime, labour and a name in the book |

---

## 3. New item proposals

Fourteen items that use the systems the game already has (categories, condition, channels,
`ActionPoint`, choking, noise, the torch, the HUD). None is implemented. Weights are suggestions.

| # | Item | Category, weight | What it would do | Where found |
|---|---|---|---|---|
| 1 | **Sack of Lime** | Material, 2.0 kg, stack 5 | Used on a corpse (a 2 s channel through an `ActionPoint` "Lime the dead"), it stops that body ever making a spore cloud. Thrown into a spore cloud, it halves the cloud's remaining life. A later counter for the gallery-crawler. | Watchhouse Supply Chest. Later the Split Kiln and Rook's Stair |
| 2 | **Wet-Cloth Mask** | Armour (head), 0.2 kg | Halves choke damage and its sight loss while its condition (wetness) lasts. Dries over about 90 s, faster in a cinder-squall. Sleet keeps it wet. Re-wet at the shelter fire's water. Needs a `choke_mult` armour field. | Spore-Choked Cart, the Fen Healer's kit |
| 3 | **Horn Lantern** | Torch, 1.2 kg | A shuttered lantern: less light range than the torch but burns half as fast. Refills from a Flask of Lamp Oil (the oil's description already says "Refuels lanterns"). Burns spores only when opened. | Watchhouse Supply Chest (empty), the Hedge-priest's kit |
| 4 | **Fire-Rag** | Consumable, 0.3 kg, stack 5 | An oil-soaked rag, dropped and lit from the torch: burns a spore cloud and stays burning for 10 s, making a fire the husks avoid. Made at the fire from a bandage and lamp oil. | Ork Plunder Pile, made at the shelter |
| 5 | **Bell-Tongue Felt** | Material, 0.3 kg, stack 3 | Wrapped round a hauberk or splinted greaves (a 3 s channel in the pack), it sets that piece's `noise_mult` to 1.0 until the piece is next worn down by 20 condition. Lore: the felt Old Edrin wraps his bell's tongue with. | Watchhouse Supply Chest. Later the Bell-Tender's House |
| 6 | **Bog-Pine Splints** | Material, 0.4 kg, stack 10 | Used while holding the torch, adds 60 s of fuel (a 1 s channel). | Shelter Stash, the Peat-cutter's kit, husk corpses |
| 7 | **Whetstone** | Tool, 0.4 kg | A 3 s channel that restores 15 condition to the main-hand weapon, never above 90%. Quarry stone. | The troll's corpse in the Old Quarry |
| 8 | **Steel Needle and Thread** | Tool, 0.05 kg | At the shelter fire only, a 4 s channel restores 20 condition to a cloth or leather armour piece, using up a bandage as patching. | Watchhouse Supply Chest. Taken by the band (see note 8) |
| 9 | **Coil of Rope** | Material, 1.0 kg, stack 3 | In the networked courtyard, rope plus one timber repairs the breach instead of two timber. Freeing the Bound Captive drops one ("the good rope"). | The Bound Captive, the Spore-Choked Cart |
| 10 | **Skin of Boiled Water** | Consumable, 1.0 kg, stack 3 | Drinking it (1.2 s) ends choking at once and restores 15 stamina. Made at the shelter fire only once the Cooking Pot is home, which gives the Act I objective a use. | Shelter fire, after the pot |
| 11 | **Warning-Book Page** | Material, 0.01 kg | Carries one of the texts below. Read from the pack. Brought to the Shelter Stash, it is "returned to the book" and its text joins a readable book at the fire. | Torn pages on corpses and in containers |
| 12 | **Name-Token** | Material, 0.02 kg, stack 10 | A lead tag or notched wooden token a carrier wears so the dead can be named. Taken from the dead and brought to the shelter, it puts a name in the book (a banner and a line in the readable book). | Husk corpses, the Gnawed Bone Heap, the Ork Plunder Pile |
| 13 | **Goblin Shiv** | Weapon (blade), 0.4 kg | A broken knife or a sharpened nail on a rag grip: a short thrust that never clangs, with fast recovery and low damage, in light and heavy alike. It never lodges. What the goblins jab with, taken from the dead. | Goblin corpses (rare) |
| 14 | **Sack of Rotten Grain** | Material, 3.0 kg | Worthless as food. Dropped as a ground pile, it draws goblins to it for 8 s (they rummage noisily, so it is also a noise lure). Relief grain from before the Flight. | Rotted Grain Crate |

---

## 4. Texts to place

### 4.1 Notes, letters and scraps

Each note gives its place in the Act I level. "On a corpse" means the note joins that corpse's loot
as a Warning-Book Page or a note item (proposal 11). Notes 1 to 24 are written to be read in any
order.

**1. The stash rule.** *Shelter Stash, pinned inside the lid.*

```text
SHELTER STASH
This is yours and it is the shelter's.
Take what you need. Say what you took.
If you die out there, what you carried was the shelter's too.
```

**2. The warning book: goblins.** *Shelter Stash, a torn page.*

```text
THE BOOK - GOBLINS
What we know. They wait for a turned back, a search, a stumble. They take
small iron, cloth and salt and run. Stones thrown from far off mean it is
going, not gone. They do not speak. Whoever says they bargained with one
was robbed slowly.
What we do not know. Where they nest. Where their young are.
Whether they came up from the Vaults or were always there.
Keep it in front of you.
```

**3. Watchhouse stores.** *Watchhouse Supply Chest.*

```text
CAUSEWAY WATCH - WATCHHOUSE STORES
Counted S.29, the week after the tower.
Spear, boar, 1. Head loose. Do not lend it.
Gambeson, 1. For whoever goes out. Bring it back.
Rags, boiled, 1 roll.
Salt, 2 measures, struck level.
Mail: none. The mail was at the tower.
Swords: what we came in with.
- W. Prowse, Serjeant
```

**4. Owed to the Watch.** *Watchhouse Supply Chest, under the stores list.*

```text
Owed to the Causeway Watch by the Crown of Orlen:
pay, from the spring of S.3. Relief, as promised. Orders.
Twenty-six years. We kept the road. We wrote it down
because there is no one to send it to.
```

**5. Inspected.** *Rotted Grain Crate, a tag tied to the lid.*

```text
INSPECTED. Weevil and rat. Do not eat, do not feed to stock.
Burn the sacks if there is fuel. There is not.
```

**6. A register leaf.** *Rotted Grain Crate, folded under the greaves.*

```text
CAUSEWAY PARISH - ADMITTED TO SHELTER, S.1
Fallow household, five.          departed
Widow Pruett and two children.   departed
Ancel the drover.                departed
On the back, in another hand, older ink:
REFUSED AT THE GATE, S.1: Fallow, five. Pruett, three. Ancel.
```

*(The archive's proposed Causeway register, `keeping-and-merewick.md` section 4: the same
households admitted, then crossed out as departed, and refused on the older sheet. It proves that
someone revised the record, but not who.)*

**7. The band's mark.** *The Bound Captive's corner, south-east of the Watchhouse, scratched in
the plaster above her head.*

```text
OURS. WE COME BACK AT THAW.
TOUCH HER AND YOU ARE OURS TOO.
ASHBOUND
```

**8. The band's tally.** *On the Bound Captive's spot once she is cut free, dropped and trodden in.*

```text
Watchhouse. Took: rope, 2 coils. Steel needles, 3, the healer's.
Salt none, they hid it. 1 woman, knows the dry ways. Osgar says
leave her tied, she keeps in the cold and fetches more than salt.
Cuddy says she will be dead by thaw. Cuddy is soft.
Wear the rags on the road. Cough when they look.
```

*(The band is people: deserters and raiders who take the name to frighten, fact 17. "Knows the dry
ways" is a proposal about Edda and needs the owner's or `godot-people.md`'s agreement.)*

**9. Tower roster.** *Ork Plunder Pile, with the hauberk.*

```text
CAUSEWAY TOWER - THE GAP
Night watch, autumn S.29.
First: Gale, T.     Second: (blank)     Third: (blank)
Mail to whoever has the gap. Kettle hats to the wall.
If they come in numbers, the tower holds and the road does not.
Fall back to the Watchhouse. Bring the book.
```

**10. A waybill.** *Ork Plunder Pile, in the broadaxe's leather sheath.*

```text
CINDER FACTORS - WAYBILL
Carried by E. Callow, carter, Watchhouse to Brackenreach.
Salt, 12 measures, struck level at the Watchhouse board.
Lamp oil, 2 flasks. Needles, 1 case. Letters, 3.
Paid on arrival, never before.
```

**11. Inside the kettle hat.** *Gnawed Bone Heap, scratched in the helmet's lining.*

```text
T. GALE. CAUSEWAY WATCH.
IF FOUND TELL THE BOOK.
```

**12. The pot's string.** *Gnawed Bone Heap, a wet strip tied to the pot handle.*

```text
This pot is Winna's and her children's, boiled for this house since
before the Breaking. If I am dead, it is theirs. If they are dead,
it goes in the ground with us. Swear it on stone.
```

**13. The last at the cart.** *Spore-Choked Cart, under the fresh torch.*

```text
Three of us left. Coughing all, the grey in it now.
We were going to the Steps. The ox is dead.
If we have stopped answering, do not come close. Burn the cart.
The torch is fresh. That is what it is for.
Lime us if you have lime. Name us if you can:
Hildy Coyle, healer. Odo Starke. The third would not say.
```

**14. The healer's last.** *On one husk corpse in the Spore Hollow.*

```text
The crust is round my mouth. I know what comes after.
Fire, not a blade. A blade only breaks it open.
- H.C.
```

**15. A name-strip.** *On another husk corpse, sewn inside a cuff.*

```text
ODO STARKE. PEAT-CUTTER. NINE STAKES.
IF I AM SILENT, LIME ME.
```

**16. Quarry slate.** *The Old Quarry's south edge, a slate wedged in a crack (a ground pile).*

```text
STAND STILL.
It cannot see. It came to where Sorrel's hammer fell
and brought both fists down there. Sorrel was not there.
Then she ran, and she was.
```

*(Sorrel is a proposed name; see the New names list.)*

**17. A request for lime.** *On the Blind Quarry-Troll's corpse, rag-wrapped (what went down with its
last meal).*

```text
To the Wayfarer's Watchhouse, from the middle terrace, Rook's Stair.
Six sacks of lime are yours at thaw for two flasks of oil and
the boar spear we lent you. If the carrier does not come back,
the lower terraces are the troll's. Do not send another.
```

**18. Feeding ground warning.** *North-West Feeding Ground, nailed to the near pillar (a ground pile).*

```text
NO FIRES HERE. NO COOKING. IT SMELLS IT FROM THE FEN.
If it lowers its head, step aside and put stone behind you.
It will not come through a door. That is why ours is narrow.
```

**19. The warning book: walking blooms.** *Spore-Choked Cart, a torn page.*

```text
THE BOOK - THE WALKING BLOOMS (husks)
What we know. In a few of the sick the caps root before the body
has finished dying. It still walks. Every cut puffs spores. When it
dies it bursts. Fire burns spores. Still air keeps a cloud; wind clears it.
What we do not know. Why some and not others. Whether the cloud
starts the cough in the healthy.
The dead: three at the Hollow cart. We know two names.
```

**20. The warning book: orks.** *Ork Plunder Pile, a torn page.*

```text
THE BOOK - ORKS
What we know. They come on behind a shield torn off our dead. They hold
the gap at the Causeway because the wall is there. They raid for salt
and lie on what they take. They drag iron to the pile and leave it.
They go silent before anything else does, and in the Dead Calm they
make no sound at all.
What we do not know. What they ran from. Why they drag mail to the pile.
```

**21. The dead this winter.** *Shelter Stash, the book's back page.*

```text
THE DEAD, WINTER S.30, WRITTEN BY THE FIRE
E. Callow, carter, at the Causeway gap.
T. Gale, Watch, at the tower or after. Not found.
Three at the Hollow cart, two named (see the Hollow).
A man on the yard, by the grain crate. Name not known.
There were more.
```

**22. A hedge-priest's scrap.** *Watchhouse Supply Chest, tucked in the gambeson.*

```text
For whoever goes out in this:
Touch the lintel going out and coming in.
Name the dead into their mouths if you cannot bury them.
Keep the last coal. Come back.
- Grisel, of no chapel
```

**23. The barter board.** *Chalked on a plank by the Watchhouse doorway (a readable prop).*

```text
BARTER BOARD - struck level, witnessed
Carter wants: oil 1, rags 2.   Brings: salt 4.      DONE
Kiln wants: oil 2, spear back. Brings: lime 6.      AT THAW
House wants: a pot. Brings: a bed all winter, and a name in the book.
```

**24. A letter never sent.** *On a goblin corpse in the yard (goblins snatch paper with the cloth).*

```text
Lettice -
The Watch say the Causeway is closed at the gap. I will come the
long way by the Hollow. Keep the salt dry and off the iron. Do not
let them burn the shutters, we will want them. Two weeks.
- your mother
```

**25. The Deserter's report.** *East Choke Point, wedged in the wall behind the shield ork's post.*

```text
Report, Causeway tower. To the relief, if there is one.
They came over the wall at dusk in numbers. The gap held until the
mail man fell. I took the book and went. The tower is theirs.
Twenty-six years and one autumn.
```

*(Written for any background. For the Watch Deserter it reads as the survivor's own.)*

### 4.2 Carved inscriptions and boards

Short texts on stone and wood, to be shown when the survivor walks up to them.

**The Watchhouse lintel** *(over the 1.35 m west doorway).*

```text
WAYFARER'S WATCHHOUSE
CROWN OF ORLEN
KEEP THE DOOR. KEEP THE ROAD.
```

Scratched underneath, later and deeper:

```text
THE CROWN DID NOT.
```

**The doorway jamb** *(inside, at shoulder height).*

```text
1.35. DO NOT WIDEN.
```

**The inner wall tally** *(the Watchhouse's north wall, by the supply chest).* Thirty notches cut in
rows of five, and a thirty-first scratched and not finished. Under them:

```text
ONE FOR EACH WINTER. CUT IT WHEN THE THAW COMES.
```

**The hearthstone** *(the shelter fire's stone ring).*

```text
KEEP THE LAST COAL
```

**The grain crate's brand** *(burned into the Rotted Grain Crate's side).*

```text
CROWN STORES - CAUSEWAY - RELIEF - S.2
```

**The choke-point wall** *(East Choke Point, cut into the Watch's own road wall).*

```text
CAUSEWAY WATCH
HELD S.3 - S.29
NO RELIEF CAME. WE HELD IT ANYWAY.
```

**A Causeway marker** *(a leaning distance stone at the yard's south-east edge).*

```text
OLD CAUSEWAY
TOLL HOUSE AHEAD - WATCHHOUSE BEHIND
```

*(No numbers, because map scale is unset.)*

**The Spore Hollow board** *(a cart-board stuck upright at the Hollow's east edge).*

```text
SPORE HOLLOW
BURN. DO NOT BREATHE.
THREE DIED AT THE CART. WE KNOW TWO NAMES.
```

**The quarry face** *(the Old Quarry, cut into the stone by the entrance).*

```text
STAND STILL AND BE STONE
```

**The feeding-ground stake** *(North-West Feeding Ground, a stake with a cow skull on it).*

```text
LEAVE
```

**The Roofed Mile board** *(a copy nailed up inside the Watchhouse; the archive's text, unchanged).*

```text
ROOFED MILE
Occupied
DO NOT ENTER FOR SHELTER
A man died beyond the fifth pier.
We do not know his name.
```

**The nail shrine** *(a niche by the Watchhouse doorway, full of bent nails).*

```text
A NAIL FOR AN OPEN DOOR
TAKE ONE AND YOU OWE ONE
```

### 4.3 Discovery banners

For `TacticalHUD.show_banner()`: shown once, the first time a place is reached or a thing is found.

| Trigger | Banner |
|---|---|
| Entering the Watchhouse | `The Wayfarer's Watchhouse. Touch the lintel going in; everyone does.` |
| Opening the Shelter Stash | `The shelter stash. Take what you need, and say what you took.` |
| First seeing the East Choke Point wall | `The East Choke Point. The Watch held this wall for twenty-six years.` |
| Reaching the North-West Feeding Ground | `Bones in a ring, and the smell of the heap. This is its feeding ground.` |
| Reaching the Spore Hollow | `The Spore Hollow. Three died at that cart, and nobody limed them.` |
| Reaching the Old Quarry | `Rings of shattered stone. Something pounds here. Stand still and be stone.` |
| First husk killed | `The bloom bursts where it stood. Fire burns spores.` |
| Taking the Cooking Pot | `The pot. Heavy and precious: the shelter can boil water again.` |
| Bringing the pot to the Shelter Stash | `The pot is home. Someone puts water on to boil.` |
| Taking the kettle hat | `A name scratched in the lining. Someone should tell the book.` |
| Taking the hauberk | `Watch mail from the Causeway tower. The orks dragged it off with the iron.` |
| Reading a Warning-Book Page | `A page torn from the warning book. It belongs at the Watchhouse.` |
| Returning a page or name-token | `Written in the book. Someone will know where they went.` |
| First Salt Ration taken | `Salt. Struck level, it pays for nearly everything.` |
| First lighting the torch | `A light means fuel, not safety.` |
| Reading the band's mark (note 7) | `Ashbound, they wrote. The sick do not write.` |
| Resting at the shelter fire | `The last coal is kept. The fire will be there in the morning.` |
| Burning a spore cloud with the torch | `The cloud catches and is gone. Fire burns spores.` |

### 4.4 Alternative background epigraphs

Two each, for `SurvivorBackground.epigraph`, all under 100 characters. The current lines stay
canon unless the owner swaps them.

| Background | Option A | Option B |
|---|---|---|
| Watch Deserter | `Twenty-six years the Watch kept the road unpaid. You kept it one more autumn.` | `The tower fell in S.29. You came down the Causeway at night with the issue sword.` |
| Cinder Factor | `You carried salt up the Salt Trace and news back down. Both cost more every winter.` | `Every load you carried was someone's measure. Your knees kept the count.` |
| Chapel Cleaner | `The priest went south with the silver. You kept the keys and the floor.` | `You know where every cupboard is, and which ones are empty.` |
| Peat-cutter | `You cut the fen for fuel thirty winters. Now you cut what comes out of it.` | `You dug bog-pine from the peat and sold the light. The axe was for the roots.` |
| Gutter-kin | `Nobody raised you. The roads did, and the gallery roof, and whatever wasn't watched.` | `You learned young that the thing nobody watches is the thing that eats.` |
| Hedge-priest | `You touch every lintel, name every dead and keep the light lit. Nobody pays you.` | `The Keeping's priests sailed south. You stayed, and the road made you one.` |
| Fen Healer | `You boil the rags, lime the dead and walk home by feel.` | `You have closed more wounds than you have made. In the dark you work by touch.` |
| Causeway Carter | `Oxen, salt and the Causeway, until the orks took the gap. You kept the axe.` | `Thirty winters on the box seat. The squall that took your ear took the cart too.` |

*(Gutter-kin, CANON Q1: with goblins now beasts, the Gutter-kin read as human road waifs, option
(a) or (c). These lines assume that.)*

---

## New names

Proposed in this file, and checked against `docs/worldbuilding/`, `scripts/` and `README.md`
on 2026-11-05 with no clashes:

- **Wystan Prowse**: Serjeant of the Causeway Watch, who counted the Watchhouse stores after the
  tower fell. His fate is unsettled.
- **Tamsin Gale** (T. Gale): Watch, who had the first watch at the gap the night the tower fell. Her
  kettle hat is in the ogre's bone heap.
- **Ebb Callow** (E. Callow): Cinder Factors carter, dead at the Causeway gap. His waybill is in the
  plunder pile.
- **Winna**: owner of the cooking pot, whose children's claim on it is unsettled.
- **Hildy Coyle**: fen healer, one of the three dead at the Spore-Choked Cart.
- **Odo Starke**: peat-cutter of the Nine Stakes, one of the three. The third is unnamed.
- **Osgar** and **Cuddy**: members of the band that took Edda and called itself Ashbound.
- **Grisel**: a hedge-priest "of no chapel".
- **Sorrel**: a Rook's Stair quarry worker, named on the quarry slate.
- **Lettice**: a child, written to by her mother in an unsent letter.
- **The Fallow household**, **Widow Pruett**, **Ancel the drover**: households on the Causeway
  parish register leaf.
- **Bog-pine**, **the barter board**, **hoard-right**, **the struck measure**: terms for things and
  customs.
