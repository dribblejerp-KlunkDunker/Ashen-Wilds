# Act I: the Outskirts

> **Note, 2026-11-11 (owner decisions O3, O4, O5).** The isometric game this file describes location by location is retired (its code is on the branch `archive/isometric-prototype`). The places, props, people and hooks stand as lore of the Watchhouse in the winter of S.30; the level layout, coordinates and numbers are the retired build's. See `CANON.md`, *Reading the older files after O3, O4 and O5*.

**Status: PROPOSED** (Godot addition, 2026-11-05). Nothing here is canon until the owner says so.
It follows `CANON.md`, including owner decision **O1**: only humans are people, and every creature is
a beast. Where older archive text treats goblins or orks as peoples, this file follows O1.

**Summary.** The Blackfen Outskirts, location by location as the Godot level builds them: what each
place was, what happened, what is there now, what a player finds and why, kit props, and hooks. In
short: the Crown built a waystation at the fen end of its road and left. The Watch kept the road
unpaid and gave the house to refugees in S.12. Last autumn an ork pack took the Causeway tower and
walled the road. This winter goblins came up through the Watchhouse floor and drove its people out
to the yard fire, and a band of raiders left a woman tied in the hall. Act I is getting back inside.
A gazetteer and the new names close the file.

## How to read this file

- **It follows the level.** Positions are the Godot build's (metres; `scripts/core/scene_bootstrap.gd`,
  `scripts/world/set_dressing.gd`). **-Z is north, +X is east**, and the camera sits to the
  south-east. The 52 m yard is a compressed slice of country. Map scale is unset.
- **Known, then guessed.** As in the warning book, what is known is kept apart from what people
  guess, and every guess is marked.
- **Props** name pieces of the kit in `assets/environment/` (ENV-002 to ENV-009). They are
  suggestions unless the text says a piece is already placed.
- **Texts and people live elsewhere.** The notes and inscriptions quoted here are drafted in
  `items-and-texts.md` section 4, cited as "note N". Edda, the band and the residents are in
  `godot-people.md`. This file covers places and follows those files on texts and people.

## What happened here

Dates follow `the-kingdom-and-the-breaking.md` where it gives them. The rest are proposals.

| When | What happened |
|---|---|
| c. S.-140 | The Crown builds the waystation and the Causeway tower at the fen end, with a courier stable and a road quarry (the Watch dates from S.-148). |
| S.1 | Wet ash brings down half the waystation's slate roof, and planks replace it. |
| S.2 | The courier horses are killed and eaten in the stable. Relief grain for the Grain March is crated in the yard and left there. |
| S.3 | The Flight South. The waystation's Crown warden, Osric Brayne, rides south with its books. The Watch keeps the road. |
| From S.4 | Ogres come to the fen edge. One takes the stable ruin for its feeding ground, and the doorway argument begins. |
| S.12 | The Watch withdraws to the tower and the toll house. Refugees move into the waystation, and the warning book is begun there. |
| From S.22 | Walking blooms appear in the west reedbeds. The Spore Hollow has had husks for at least five years. |
| Autumn S.29 | The ork pack takes the Causeway tower under a cinder-squall, walls the road at the choke point with the tower's rubble and dens behind the wall. |
| Early winter S.30 | Goblins swarm up the Watchhouse floor drain and the refuge flees to the Outside Fire. The band calling itself Ashbound comes through by night and ties Edda to the hall post. |

---

## 1. The Outside Fire and the Shelter Stash

*Level: fire ring (-6.5, 4.8); spawn (-6.5, 6.5); Shelter Stash (-7.9, 7.0); firewood (-5.5, 5.8) and
(-8.9, 8.0); a repaired fence and a broken one along the west side at x -10.6, a picket run at (-9.4,
9.6); a fallen tree (-11.5, 9.5).*

**What it was.** The waystation never let everyone in. Under Crown rule a traveller with no token,
toll or business waited in the yard till morning, and in the Smothering there were never enough beds,
so the rule outlived the Crown. The ring of dark stone in the lee of the west fence was the fire for
those kept out: **the Outside Fire**. Carters slept by it in good years. In bad years the people
sitting at it were the ones the vote at the door had gone against. The ring is cut *KEEP THE LAST
COAL*. The house's version of that Keeping custom was to carry a coal out from the hearth every dusk,
so that the people outside and inside burned the same fire. Some winters it was done in good faith.
Some winters it was all the house gave.

The low box by the ring held the **doorstep due**: what the Watchhouse owed anyone it turned away. That
was one clean rag and one stick of seasoned timber. It was never much, but it was owed and it was paid.

**What happened.** When the goblins came up through the floor, the people in the hall ran to the only
other fire they had. The refuge that argued every winter about who should sit outside now sits outside
itself. About a score of people sleep round the ring (`godot-people.md` section 5). The door-warden has
no door to keep.

**What a player finds.** The **Shelter Stash** opens at once, because it is the survivor's own. It
holds a **Clean Rag Bandage**, a **Seasoned Timber** and a **Padded Coif** at 48%.
*Why:* the rag and the timber are the doorstep due. Someone has kept filling the box out of habit, though
the people it was filled for are now the people at the fire. The coif is Watch issue, worn under a
kettle hat. The Watch Deserter left it here on a supply run when the tower still sent people
(`godot-people.md`). For any other background it is a cap no one came back for. The box also holds
what is left of the **warning book**, its back pages and loose leaves, until the hall's dry box can be
reached. Pages found in the Outskirts come back here.

**Props.** An open ENV-007 barrel (v06) as the water butt, a ladle on its rim: nothing is boiled until
the pot comes home. Sleeping places worn into ENV-008 grass, none across another's way out. A lone
ENV-003 post with a rag at head height: someone at the fire needs a healer.

- **Hook:** Once the hall is retaken, who carries the coal out at dusk, and who sleeps outside tonight?
- **Hook:** The survivor is the only one at the fire carrying a weapon, and everyone's eyes say so.

---

## 2. The Wayfarer's Watchhouse

*Level: stone walls 3.2 m high round an 8 m square (x 1 to 9, z -7 to 1); a 1.35 m doorway in the west
wall under a stone lintel; inside it a 1.7 m entry hall, 3.4 m long; a plank roof at 3.35 m that
hides when the survivor steps in; rubble at the east wall, the south-west corner and the south wall.*

### What it was

A Crown waystation, the King's house at the fen end of the King's road. It was named after the **King's
wayfarers**, the mounted couriers who changed horses there between the uplands and Wexhaven. It did
four things. It **counted**: everyone coming off the Causeway gave a name and a purpose. It **tolled**
carts by the axle and walkers by the pack. It **held** road offenders until the royal assize came
north. And it **sheltered** couriers, wardens, and whoever else the warden chose.

It was built narrow on purpose. A waystation was a toll gate with a roof, and the Crown wanted people
to come in one at a time, packs in front of them, past a clerk who could see their hands. Carts stayed
in the yard and horses went to the stable. The lintel reads *KEEP THE DOOR. KEEP THE ROAD.* Under it,
cut later and deeper: *THE CROWN DID NOT.*

### Why it is ruined

It wore out one winter at a time. The slates fell under wet ash in S.1 and were replaced with stable
planks; the roof that hides when you step in is the third plank roof. The timber walls between the
rooms were burned in a hungry winter, which is why the house is now one hall with two alcoves. A
lean-to store on the north wall rotted and fell, and its stone is the rubble at the corners.

The worst came this winter. Goblins swarmed up the **floor drain**, a stone culvert that runs from under
the hearth, beneath the entry hall, out to the yard ditch, and the people ran. The band came through
by night with their captive. They took rope and the healer's needles, failed to find the salt, and left
Edda tied to the hall post among the nesting goblins (notes 7 and 8; `godot-people.md` section 1).

### The entry hall: the Counting Passage

A traveller came through the door into the 1.7 m hall and stood between two walls of dark stone while
the clerk in the south room asked their name through a hatch. Two people cannot pass there unless one
turns sideways, and that was the point. The Watch told every recruit the same thing: **in the passage,
thrust.** A sword swung flat across the hall meets stone, rings and leaves you open. A spear point goes
straight down it. The game's deflection rule is that lesson: slashes, cleaves and the spear's
shaft-sweep clang off these walls, and thrusts and the sword's lunge do not. An ork's opening slash
clangs here too. The walls are scarred at blade height. The clerk's hatch is still there, low in the
south wall, bricked up since the partition burned.

### Why the doorway was never widened

Carts cannot get in and stretchers must be tilted, so every winter someone wants the door opened up. The
Crown built it for one person and a pack, and at first the Watch kept it that way from habit. Then an
ogre took the stable ruin for its feeding ground, and the argument had its answer. An ogre is 1.7 m
across the shoulders. It cannot pass 1.35 m, it will not follow anyone into a doorway, and it will not
charge where its shoulders do not fit. The inside jamb is cut *1.35. DO NOT WIDEN.* Someone new raises it
every winter anyway, and the book records who. They are walked out to the feeding ground in daylight to
look at the heap.

### The rooms

| Part | What it was | What it is now |
|---|---|---|
| The doorway | The counting door, barred; its pins are still in the stone | Empty; the door lies face-down in the yard |
| The Counting Passage | Where travellers stood to be counted | Scarred stone; a goblin waits where it opens into the hall |
| The north alcove | The **wayfarers' room**: four couriers' bunks behind a timber wall | The goblins' nest |
| The south alcove | The **tally room**: the clerk's desk, the hatch, the toll salt under lock | Empty; nail holes show where the salt bin stood |
| The hall (east half) | The hearth room, where wardens ate and the sheltered slept in rows | Cold, stripped; the second goblin walks it |
| North-east corner | The **strong corner**: the warden's chest under the loft stair | The Supply Chest, under a notched winter tally |
| South-east corner | The **assize corner**: an oak post with the Crown's iron ring | Edda's corner (section 3) |
| The loft | Sleeping space under the old slates | Gone; a stub of the stair beam remains |

### The goblins

**What we know.** Two Goblin Scavengers are what is left of the swarm: one prowls the yard by the door,
the other holds the hall end of the passage. They are beasts, quick and cowardly, sharp-eyed in the
dark, with a shiv and stones thrown from five to eleven metres. They wait for a turned back or a search,
and a survivor rummaging in the chest is exactly that. The north alcove is their nest of torn blankets,
hinge plates and bent nails, gathered as a magpie gathers. Their corpses carry scrap, and sometimes a rag
or a pinch of salt. **What people guess:** where there is a nest there is a drain, and it may bring more.

### What a player finds

The **Watchhouse Supply Chest** (three-second search, iron-bound, hinged lid) holds the **Boar-Lugged
Spear** (72%), a **Quilted Gambeson** (95%), a **Clean Rag Bandage** and **two Salt Rations**.
*Why:* the **spear** is Rook's Stair's, lent, and they want it back as part of the price of lime (note
17). It is kept in the chest because a spear is what the passage wants. The **gambeson** is the shelter's
spare, for whoever goes out, and it is meant to come back. A hedge-priest's scrap is tucked inside it
(note 22). The **rag and salt** are the last of the reserve. The band's tally says *Salt none, they hid
it*: the people hid it in the strong corner, under the stair stub, in the dark, and the band missed it.
The Watch's own reckoning lies under them: *Owed to the Causeway Watch by the Crown of Orlen* (note 4).

### Props

The ENV-002 patched door lies face-down outside, axe-marked; rehanging it shuts the house again. The
nest is ENV-008 dense twigs and cloth round an ENV-007 crate (v09) on its side, with chips round the
lifted drain cover. The tally room has an ENV-007 iron-bound crate (v03), wrenched open. The cold hearth
is an ENV-009 raised plinth under an ENV-002 rubble cluster. A charred ENV-003 post marks each burned
partition. The nail shrine, the barter board (`items-and-texts.md` 4.2) and the ash-post
(`the-smothering.md`) are by the door.

- **Hook:** The drain. Kill the goblins and more may come up it. Stop it with stone from the fallen
  lean-to (a timber and stone fixture, like the networked breach), and the house is shut from below.
- **Hook:** The bricked hatch is the one hollow the band never opened. The oldest residents swear Osric
  Brayne left a sheet in it in S.3: the people he admitted on his last night and the people he turned
  away, the same families on both lists. It may be the older sheet of the Causeway register
  (`keeping-and-merewick.md` section 4; note 6).
- **Hook:** Retaking the hall means choosing again who comes in, and the people choosing have now slept
  outside themselves.

---

## 3. Edda's corner

*Level: the Bound Captive at (7.8, 0.2), the hall's south-east corner, a hooded figure sitting against
the wall. Cutting her free takes two seconds.*

**What it was.** The **assize corner**. A road offender (a toll-cheat, a horse thief, a carter who struck a
warden) waited here for the circuit judge, chained to an iron ring in an oak post the residents call
**the hall post**. The chain went for scrap long ago, and the ring is too deep in the oak to come out. In
the refuge years a coughing traveller who was let in slept as far from the hearth and the door as the
house allowed, which meant here. The residents called it the **cold corner**. Whoever slept in it got
better or was carried out to the Hollow.

**What happened.** The band tied Edda to the hall post and left her among the goblins. Who she is and why
they did it is in `godot-people.md` ("leaving them to the ash"). The corner tells a careful survivor four
things. **The knot** is the band's, a boatman's hitch from Low Harrow that tightens as you pull, the same
on everyone they have left. **A tin cup of water** stands where her foot can drag it, so someone meant
her to last. **The plaster above her** is scratched *OURS. WE COME BACK AT THAW.* (note 7), and the band's
tally is trodden into the floor where she sat (note 8). **The ring is the Crown's**: the house's own fitting
for holding offenders until justice came was used to hold a woman until the Blackfen decided. Cut free, her
first words are a debt: *"I owe you."*

**Props.** A trailing length of cut rope (ENV-008 thin roots), the cup, and an ENV-007 squat barrel (v12)
on its side. Leave the rest of the floor bare so the eye goes to the rope and the cup.

- **Hook:** The band will come back at thaw and find the door shut against them by the woman they tied inside.
- **Hook:** The cup means the band is not of one mind, and a later act can work that crack.
- **Hook:** The ring can be used again. When someone at the fire is caught stealing, the question of whether
  the house holds people, and who decides, comes back to this corner.

---

## 4. The yard

*Level: the open mud between the places; a tall stump south of the house (3.5, 7.5); rocks and a
snapped-crown tree to the north; a boulder east of the house (12.5, -2.0); a flat boulder (6.0, 12.5) on
the way to the choke point; dead trees at every edge; seventy patches of grass, sedge, weeds and twigs.*

**What it was.** The waystation yard, kept bare on purpose so that travellers could be looked at in the open
before they came near the door. Bare ground, fire and people are why the bestiary rates the Watchhouse grounds
low danger, but that held only while there were people enough to keep it bare.

**What is there now.** Thirty years of mud and too few hands. The stumps are trees felled for fuel, and the dead
trees still standing are the ones nobody went back for once the fuel parties stopped returning. Danger sits in
every corner: the Hollow, the feeding ground, the quarry, the choke point. The safe strip runs from the fire to
the door, and the yard goblin has half of it.

- **The Naming Stone** (6.0, 12.5), on the road out. The Watch laid the dead brought in off the Causeway on
  it so their names could be spoken into their mouths before the lime (a Keeping custom,
  `keeping-and-merewick.md`). When a body had no name, the warden wrote down what it carried. Its top is
  worn smooth and paler than its sides.
- **The tall stump** south of the house was the gallows post. It has not been used since before the
  Smothering, and the residents want that remembered.
- **A Causeway marker** leans at the south-east edge: *TOLL HOUSE AHEAD - WATCHHOUSE BEHIND* (4.2).

**Props.** A broken ENV-009 cobbled strip from the door to the fire and the choke point (the Causeway's
metalling), worn thresholds at the doorway, the band's empty ENV-007 crates along the south wall, and a fallen
ENV-006 fence along the old horse-walk to the stable.

- **Hook:** Three short names were scratched into the Naming Stone this autumn, in different hands, none of
  the dead limed. The Hollow and the feeding ground may account for all three.
- **Hook:** Felling the dead trees gives back sightlines and fuel, but felling is noise, and the troll hears
  noise.

---

## 5. The Rotted Grain Crate

*Level: a cross-braced crate at (-4.2, 2.2), in the open between the fire and the door; a two-second search.*

**What it was.** A **relief crate**. In S.2 the Crown's agents gathered the fen's grain for the Grain March.
It was requisitioned against receipts, crated in the yard under guard, and promised back as bread. The
carts took the first load, then the Flight took the Crown, and the rest sat through a summer that never
came. The Watch ate what it could and burned what it could not. This crate, at the bottom of the stack,
was too far gone even for that. It is still branded *CROWN STORES - CAUSEWAY - RELIEF - S.2*, with an
inspector's tag on the lid: *Weevil and rat. Do not eat* (note 5).

**What happened.** A sound crate with a good lid is worth something even when its grain is not. The refuge
used it as the yard's **dry box**, where carters left spare gear off the ground without bringing it through
the narrow door. The rotted grain at the bottom set into a black crust, and things were stored on top. This
autumn a man put his greaves in it for the winter, or hid them there. He died in the yard beside it, and
no one at the fire knew his name (note 21: *A man on the yard, by the grain crate. Name not known*).

**What a player finds.** **Two Seasoned Timber**, an **Iron Scrap** and **Leather Greaves** (60%).
*Why:* the timber is cart spares, two spokes and a felloe, still dry because the crate kept them dry. The
scrap is tyre nails and a hub band. The greaves are the dead man's: Brackenreach work for carters and
drovers, their old laces eaten by the rats that got into the grain (`items-and-texts.md`). Folded beneath
them is a register leaf (note 6). It lists households admitted to shelter in S.1, crossed out as
*departed*, and on the back, in older ink, the same households *refused at the gate*. Why a nameless carter
carried it, nobody knows.

**Props.** The crate on two ENV-008 stones, a second relief crate (ENV-007 v04) broken open beside it with its
branded slats gone to kindling, and dry weeds grown up round both.

- **Hook:** Fen families still keep their worthless S.2 receipts sewn into clothes. A Merewick collector
  (`keeping-and-merewick.md`) would want to know that this grain never left the yard.
- **Hook:** The greaves, the spares and a doctored register leaf add up to a name. Someone in Brackenreach made
  those greaves for somebody.

---

## 6. The Spore Hollow and the Spore-Choked Cart

*Level: three Ash-Spore Husks at (-19.5, -1.0), (-21.5, -3.5) and (-18.5, -4.5); the Spore-Choked Cart at
(-22.5, -1.5) on the west edge; a rooted stump on the way in (-14.5, 3.0). Banner: "the Spore Hollow
(Ash-Spore Husks). Fire burns spores."*

**What it was.** **Withy Bottom**, a shallow dip at the yard's west edge that holds water, where willows once
grew and carters cut withies for hurdles. It was low, wet and out of the way, which is why it became what it
is.

**What happened.** In the first winters the dead came off the Causeway faster than any parish could take them,
and the waystation had no churchyard. The Watch dug a **lime pit** in Withy Bottom. Then the lime ran out (the
quarry kiln needed fuel and men, and the Split Kiln was far), and for a winter the dead went in unlimed. The
corpse-caps fruited, and the Bottom has been spore ground, the **Spore Hollow**, ever since. Low, wet ground is
also where the silent sick go (`bestiary.md`), and the Hollow is the lowest ground within reach. It has had
walking blooms for at least five years (`the-smothering.md`).

**The cart.** This autumn three travellers came from the west with a cart, an ox and the grey in all their
coughs. They were bound for the hospice at Saint Orra's Steps. The ox died at the Hollow's edge. They did what
the dying are taught to do: they wrote a note, left it under a fresh torch, and waited for whoever stopped
answering first (note 13: *If we have stopped answering, do not come close. Burn the cart. The torch is fresh.
That is what it is for.*). Two left names: **Hildy Coyle**, a healer, and **Odo Starke**, a peat-cutter of the
Nine Stakes. The third would not say. No one lit the torch. Someone has to stop coughing long enough to strike
a light, and has to decide that the one beside them is dead. In a few of the sick the bloom roots before the
body has finished dying (`CANON.md` fact 18), and no one can burn someone they love while that body still
walks. Whether the three came to the Watchhouse door first, the book does not say.

**What is there now.** Three husks stand and shamble round the cart. They are slow, half-blind and weak alone,
but every wound puffs spores, and a husk's death bursts a choking cloud where it falls. One carries the healer's
last words (note 14: *Fire, not a blade*), and another has a name sewn in its cuff (note 15). The board at the
Hollow's east edge reads *THREE DIED AT THE CART. WE KNOW TWO NAMES.*

**What a player finds.** The **Spore-Choked Cart** (three seconds, in the middle of the spores) holds a **Pitch
Torch** at full fuel, a **Flask of Lamp Oil** and a **Clean Rag Bandage**. The husks carry scrap (buttons, a
buckle, a rusted knife) and sometimes a rag. *Why:* it is the travellers' own fire for their dead, untouched.
The torch is fresh because no one ever lit it, and it is the one thing in the Hollow the spores fear. A survivor
who lights it can do what the note asks.

**Props.** The open-top crate as the cart bed with two ENV-008 short logs for shafts (one snapped), an ENV-007
barrel (v08) tipped off the back, and a low hump where the ox lies. Low and rooted stumps for dead willows, and
spreading roots across the floor like white threads. A sunken ENV-009 step edge marks the lime pit, its pebbles
pale at one end and dark where the lime ran out. The weather does the rest: a cloud hangs thirteen seconds in
the Dead Calm and three in a cinder-squall.

- **Hook:** Burning the three with their own torch finishes their errand, and their names can then be spoken at
  the Naming Stone. The third name may turn up somewhere else.
- **Hook:** The Hollow will keep fruiting until the pit is limed, and lime means the quarry kiln (section 7) or
  the Split Kiln up the Bell Road (`acts-two-and-three.md`).
- **Hook:** Is it catching? The fire must decide whether the survivor who just searched the cart sleeps inside.

---

## 7. The Old Quarry

*Level: the Blind Quarry-Troll's home at (15.5, -14.5); a large outcrop at the back (19.0, -18.5); standing
rocks (21.5, -12.5) and (12.0, -19.5); masonry chips and low rubble across the floor; a gnarled dead tree
(19.5, -17.0); a fallen tree on the way in (16.5, -6.0). Banner: "the Old Quarry (Blind Quarry-Troll). Keep
still."*

**What it was.** **The Causeway Delph** (*delph*: the fen word for a stone pit), opened by the Crown in a low
grit ridge when it built the fen end. Its hard, frost-proof grey stone went into the road's kerbs and drain
mouths, the waystation's walls and the stable's piers. A small kiln at the mouth burned upland limestone
into lime for mortar and, later, for graves. The Crown had no masons at the fen end, so every spring it hired
a crew from **Rook's Stair**, the terraced quarry town on the Bell Road that trades stone, lime and masonry
(`blackfen-roads-and-towns.md`). The same mason families' marks are cut into the quarry face and the
Watchhouse lintel.

**What happened.** Once nobody was paying them, the crews stopped coming. The Watch cut its own repair stone
for a few years. Then the Delph became the troll's. A slate wedged in a crack at its south edge (note 16)
says how: *It came to where Sorrel's hammer fell and brought both fists down there. Sorrel was not there.
Then she ran, and she was.*

**What lives there.** The **Blind Quarry-Troll**, a beast that hunts by sound alone: it lumbers to where a
sound was, pounds the spot, forgets after six seconds and walks home. *Why it lives here (guesses; the book will
not choose):* the Delph has a
kiln's worth of spilled lime to lick and salt-bearing rock to gnaw (`bestiary.md`). It is the quietest ground
in the Outskirts, a dead end nobody crosses, so every sound in it means something has come in. Its three stone
faces throw sound inward. Or the troll was always there: Rook's Stair quarrymen say the same one sat in the
Delph like an outcrop before the Smothering, and that the crews worked round it on their toes for a
generation. If so, it did not come up with the ash. If not, it is the kind of thing quarrymen say.

**What is there now.** A grey cut with a rubble floor and an outcrop that may be an outcrop. Rings of
shattered stone mark where the troll has pounded, and a careful survivor reads them before walking in. The
entrance face is cut *STAND STILL AND BE STONE*. On a ledge above lives **Dace Ormer**, an eel-trapper's boy
who survives on rainwater and has learned to keep absolutely still. He is Act I's second companion, and he
follows a survivor who leaves the quarry without being pounded (`godot-people.md` section 4).

**What a player finds.** Nothing in the open. The troll, if it ever falls, carries **four Iron Scrap**, **two
Salt Rations**, a **Flask of Lamp Oil** and a **Clean Rag Bandage**. *Why:* it is a Rook's Stair carrier's
kit. The carrier was bringing a message (note 17: *Six sacks of lime are yours at thaw for two flasks of oil
and the boar spear we lent you*). The scrap is wedges and strap iron, the salt was road food, the oil was a
sample of the price, and the rag was in a pocket. Nobody has got close enough to see whether these things
went down with the meal or are caught in the crust of lime on its hide.

**Props.** ENV-008 broken pillars as half-cut blocks and ENV-009 split-square pillars as kerbstones never
collected. Pound rings of chips, old and fresh. The kiln: an ENV-009 corner ruin at the mouth, lime-pale pebbles
round its foot. The carrier's ENV-007 barrel (v11) dropped on its side.

- **Hook:** Lime for the Hollow. The kiln can be fired with timber and oil, but firing a kiln is loud work in a
  troll's quarry. Do it in a cinder-squall, when the troll is deaf and resting, or not at all.
- **Hook:** Rook's Stair's price for lime includes the spear. Keeping it costs lime, and giving it back costs
  the Counting Passage its best weapon.
- **Hook:** If the quarrymen are right that the troll predates the Breaking, one of the bestiary's questions
  is answered and a harder one opens.

---

## 8. The North-West Feeding Ground and the Gnawed Bone Heap

*Level: the Blackfen Ogre at (-13.5, -11.5); the Gnawed Bone Heap at (-15.0, -13.0); stone piers at (-11.5,
-14.5), 3 m high, and (-16.5, -10.5), 2.4 m; a collapsed end wall, a ground course, a fallen column, a leaning
pier at (-9.0, -13.5) and wallfall rubble round them. Banner: "North-West Feeding Ground (Blackfen Ogre)".*

**What it was.** **The Long Stable**, the waystation's stable for the couriers' horses: a long timber roof on
square piers of Delph stone, with a stone end wall against the north-west wind. It held twelve horses in good
years and stood a quarter-mile from the house, so the smell and the flies stayed out of the yard.

**What happened.** In S.2 the fodder ran out, and the Watch killed the horses in the stable and ate them
through the winter. The bones went on a heap outside the end wall, and the roof went for fuel. That left an
open ruin on open ground near water with a bone heap already on it, which is everything an ogre wants. Ogres
came to the fen edge from S.4. Ogres move on when a ground is eaten out, every few years, and the old bones
bring the next one back. The one there now is the third the book records, or the same one returned. Nobody has
seen two together to tell them apart.

This autumn, after the tower fell, someone took a household's cooking pot out to the stable. A string on the
handle reads *This pot is Winna's and her children's, boiled for this house since before the Breaking* (note
12). A Watch helmet scratched *T. GALE* lies with it (note 11), and the tower roster has Gale at the gap on the
last nights (note 9). The book's dead list says *at the tower or after. Not found.* *The likeliest reading
(a guess):* Gale came west off the Causeway hungry, borrowed Winna's pot, and went out to cook at the stable to
keep the smell from the house. Most ogre deaths start with someone cooking.

**What is there now.** A trampled clearing in the stable's footprint, the heap at its middle, two piers
standing and a third leaning. Saplings are snapped at shoulder height and the ground is pressed into wide,
knuckled tracks. A stake with a cow skull reads *LEAVE*. A warning nailed to the near pier ends: *It will not
come through a door. That is why ours is narrow.* (note 18). The **Blackfen Ogre** is a beast that does not
flinch mid-windup and charges in a line it cannot steer. **The piers are the survivor's friend:** sidestep with
one behind you and the ogre runs into Delph stone and reels. The leaning pier shows it has happened before.

**What a player finds.** The **Gnawed Bone Heap** (three and a half seconds, in the middle of the ground) holds
the **Cast-Iron Cooking Pot** (the Act I objective), a **Kettle Hat** (70%) and **two Iron Scrap**. The ogre
carries **three Salt Rations**, **three Iron Scrap**, **two Seasoned Timber** and **two Clean Rag Bandages**.
*Why:* ogres keep the iron that came with their meals; the book guesses it smells of food. The **pot** is
Winna's household's, slag-iron that holds its heat for hours. Without it the fire cannot make water safe, boil
rags or stretch a stew, and by the house's hoard-right it is the shelter's until kin come with a name
(`items-and-texts.md`). The **kettle hat** is Gale's, and the **scrap** is a pot-chain and a buckle. What the ogre
carries is years of a feeding ground's sediment: salt from packs, scrap from harness, timber from litters, rags
from people. The book no longer tries to say whose.

**Props.** ENV-009 square stump pillars between the standing piers so the row of stalls reads, and broken
paving for the floor. The heap built up with ENV-008 chips and a crushed ENV-007 barrel (v05), and an older S.2
heap outside the end wall under broadleaf weeds. Gale's fire south of the heap: a scorched stone ring, scattered
ENV-002 firewood and ENV-003 posts as a fallen pot tripod. Trampled tracks towards the yard that stop, every
time, well short of the Watchhouse.

- **Hook:** The pot. A search of three and a half seconds in the middle of an ogre's ground, then 4.5 kg of iron to
  carry home on a burdened pack. The old trick is Miasma fog, when the ogre cannot smell a fire.
- **Hook:** The string names Winna and her children. Whether any of them are at the Outside Fire, and what they
  say when the pot comes home, is the scene at the end of the errand.
- **Hook:** A Watch Deserter who puts on Gale's hat is wearing a comrade's helmet, and the Watchhouse asks for
  every name scratched inside one.
- **Hook:** The next person at the fire who wants the door widened is walked out to this heap in daylight. Let
  the player be the one who walks them.

---

## 9. The East Choke Point and the Ork Plunder Pile

*Level: the shield ork at (12.2, 8.2) and the cleaver ork at (14.0, 9.8), patrolling the angle of two walls; a
4.5 m wall running east to west along z 5.5 (x 8.75 to 13.25); a 5 m wall running north to south along x 15.5
(z 7 to 12), across the road; a narrow gap at the north-east corner between them; the Ork Plunder Pile at
(13.2, 12.4), in the lee of the cross wall. Banner: "East Choke Point (Shielded Ork & Vanguard)".*

**What it was.** **The Causeway gap.** East of the yard the Causeway climbs onto its raised bed between two
drainage cuts, and a traveller on it cannot leave it without sinking. The Crown's toll arch stood here. After
S.3 the Watch kept a **road wall** along its north side so that whatever came off the fen could not see into
the yard. The cart way past the wall's end, where the road ran on to the tower, was called **the gap**, and the
Watch stood night watch in it (note 9). The road wall is cut *CAUSEWAY WATCH / HELD S.3 - S.29 / NO RELIEF
CAME. WE HELD IT ANYWAY.*

**What happened.** After the tower fell (section 10), the pack followed the road west behind the Watch's
survivors, drawn by blood and by the salt the survivors carried. At the gap it found stone with a wall at its
back. Over the following weeks the orks dragged rubble from the tower and heaped it across the road, leaving
only a narrow gap, and denned behind it (`the-kingdom-and-the-breaking.md`). Orks close their dens with stone,
the way other animals block a burrow. Nobody has watched them do it. For the first time in a hundred and
seventy-seven years the Causeway is shut at the fen end.

**The pack.** The survivors call it **the Causeway pack**. Carters say **the Saltlickers**, because orks crave
salt as cattle crave a lick (`CANON.md` fact 15), and the tower held the biggest salt store in the Outskirts.
They are beasts: large, grey, heavy-boned and hard to cut, drilled by instinct and by which animal is
stronger, not by anyone. A wolf pack in armour. They came up from the Vaults fleeing something deeper, the way
animals flee a fire, and never went back down. **They are quiet.** A pack makes no calls, goes still before you
see it, and in the Dead Calm makes no sound at all. Nobody knows why.

**The two at the gap.** The shield ork, the older and heavier animal, keeps to the den behind a shield torn
off the Watch's dead and strapped to its forearm: slash, then chop, and a bash for a guard held too long. The
cleaver ork, the younger one sent out first, has no shield, runs a survivor down and rests less. Human gear on
orks is buckled on anyhow, the straps chewed and knotted. The book does not think it is armour to them. They
keep what they take on their bodies, as a jackdaw lines a nest (`items-and-texts.md`).

**What is there now.** The Watch's road wall, stones torn from its foot, and the pack's heaped cross wall, with
a den between them that stinks of old meat, wet hide and salt. The only way through is the north-east gap.
Breaking the choke point is the shipped level's last fight, and it opens the road east.

**What a player finds.** The **Ork Plunder Pile** (two and a half seconds) holds a **Woodsman's Broadaxe**
(90%), a **Rusted Mail Hauberk**, a **Flask of Lamp Oil** and a **Clean Rag Bandage**. Each ork carries two or
three **Iron Scrap**, one or two **Salt Rations**, often a rag, sometimes oil, and now and then **Splinted
Greaves**. *Why:* the pile is a den hoard. Orks drag back what is heavy, what smells of hands and what smells of
salt, and lie on it. The **hauberk** is Crown mail from the tower, kept *for whoever has the gap* (note 9). It
was dragged here with the salt sacks it lay on, and it neither fits the orks nor is worn by them. The
**broadaxe** came off **E. Callow**'s cart. Callow was a Cinder Factors carter (the waybill is still in the
sheath, note 10), and the dead list says *E. Callow, carter, at the Causeway gap.* The oil and the rag came from
the same cart. The orks' own loads are salt in the gut and knotted into rags, scrap from the buckles and rivets
of whatever they have strapped on, and the Watch's **splinted greaves**, buckled round a shin or a forearm. None
of it was ever theirs. They have nothing of their own.

**Props.** Tower planks (ENV-005, ENV-006 panels) jammed into the cross wall's rubble, with ENV-008 wallfall
at its foot; keep it rougher than the Watch's wall, because the Watch built and the pack piled. ENV-009
gatepost stumps and a half-buried threshold at the gap: the toll arch's footing. In the angle, ENV-008 leaves
flattened into sleeping hollows, smashed ENV-007 crates (v06, v03) and a barrel (v10) stove in, salt crusted
round the hole. An ENV-009 cobbled strip runs east through the gap and off the level.

- **Hook:** The road opens. The first people along it may be Watch survivors, carters, or the band, who already
  went round the choke point on Edda's drowned stakes (`godot-people.md`).
- **Hook:** The gap as a fixture. Closing it with timber and stone holds the road, and clearing it keeps the road
  alive. Each choice costs something, like the networked breach.
- **Hook:** Every measure of salt the survivor carries is a smell on the wind, and a salt-heavy pack could draw orks
  the way a wound draws the ogre.
- **Hook:** In the Dead Calm the orks go utterly still, the only time survivors say an ork looks afraid. Some say
  something else comes out then. The book keeps it as a question.

---

## 10. The Causeway tower (beyond the map)

*Not in the level: a short way east past the choke point, on the Causeway's first good stone.*

**What it was.** The Watch's road tower, built with the waystation around S.-140: three storeys of grit, one
door at the foot, a yard wall, a culvert down to the fen side, a warning bell under the roof, the armoury, and
the salt store where the tolls went. From S.12 it was the Watch's home. Unpaid men and women held it on an oath
to a king who had sailed away, took toll in salt and food, and kept the road open both ways.

**What happened.** *What we know* (`the-kingdom-and-the-breaking.md`): the pack had worked the fen's edge since
S.27. In autumn S.29 it came onto the Causeway under a cinder-squall, when nothing could be heard over the wind,
and came over the yard wall in the embers. Nine of the Watch were inside. The muster book's last entry, in a
hand nobody at the Watchhouse knows, names four dead. The rest scattered, and at least one reached the
Watchhouse with the sword they were issued: *You held the Causeway tower until you didn't.* The salt store,
twenty-six years of tolls, is the pack's now. *What people guess:* that the pack came only for the salt and the
Watch died standing on it; that someone was sent down the culvert for help that did not exist, and it was the
Watch Deserter (`godot-people.md`); that the pack was not attacking at all but fleeing something behind it in
the deep fen. The book does not choose.

**What is there now.** Travellers who have looked from the road say the tower stands roofless with the Watch's
dead still inside, its door blocked with stone, the sign of an ork den. The bell lies in the yard with its
tongue torn out. Nobody knows whether an ork did that or a person. The likeliest answer is that it fell when
the roof went.

**Props for a later build.** ENV-009 buttressed and ragged walls, a jagged breach, damaged steps for the culvert
stair, wallfall rubble in the doorway, and the tongueless bell on its side.

- **Hook:** `acts-two-and-three.md` has the pack broken at the tower and its dead left on the Causeway. Lime them
  or meet them.
- **Hook:** The muster roll's last page decides whether the Watch Deserter was sent or ran (`godot-people.md`).
- **Hook:** Twenty-six years of tolls lie in an ork den. That is salt enough to buy the Watchhouse a winter.

---

## 11. The Drowned Graves (the yard's south-east corner)

*Added 2026-11-05 for the Godot build's third bestiary slice (`docs/PRODUCTION.md`, Bestiary 3).*

**What it was.** The waystation's burial ground: a low, wet corner of the yard below the road, where
the Watch and the wardens buried the travellers who died on the Causeway. In the Holding Years it
was where the Naming Stone's dead went after the lime: named on the stone, limed, carried down and
put in.

**What happened.** In the Long Dark the corner flooded and stayed flooded, and the dead came faster
than anyone could carry them to the stone. Some were put into the wet ground with no name spoken
over them: travellers nobody knew, the dead of a cough-winter, bodies brought in at night and buried
before morning so the smell would not bring the ogre. The worn stones that mark them were cut for
other graves, or for nothing. Nobody wrote down who lies under which.

**What is there now.** Three graves, each a squared stump of old pillar sunk in the mud, and beside
each the one who lies under it, standing. They do not speak. They do not seem to see the survivor
until the survivor is close or loud, and then they come, slow, with their hands out, and grab. Cut
one down and it lies in the mud a while, and then it gets up whole. It stays down only when someone
kneels at its stone and speaks a name over it; then it lies down for good and is only a body, with
whatever it was buried with.

**What the player finds.** The graves, the three Unnamed (one per stone, none straying far from its
own), and on each body, once named, what the burial left: a rag, a little salt. The order matters:
knock one down, then run for its stone before it rises; or creep to a stone unseen and name it where
it stands. A blow breaks the naming off.

**Why it works the way it does (in-world).** Nobody knows, and the book keeps the guesses apart:
- The Keeping: an unnamed body has no rest, and the naming is a debt owed to the dead, not a charm.
  Any name honestly given pays it.
- The healers: the bloom is in the wet ground, and what moves them is the same rot that moves the
  husks. This does not explain why a name works.
- Carriers: any name will do; one swears he named a man "Watchhouse" and he lay down. The faithful
  call that blasphemy and say it did not happen.
- Some blame the Unwriters, the movement that scratched names out of registers and off graves.
  Nobody at the Watchhouse admits to having been one.

**Props from the kit.** Square pillar stumps for the stones (in game: `env_ruin_pillars_03_square_stump`),
mud and standing water, rushes, a broken fence where the corner meets the yard, a spade left upright.

- **Hook:** the Naming Stone (section 4) and the graves are the same custom at two ends: a quest that
  carries the three names scratched on the Naming Stone down to the graves, to see if the right name
  lays one to rest faster.
- **Hook:** a fourth stone with no one standing by it, and fresh earth.
- **Hook:** in the Dead Calm they hear further; in a cinder-squall the survivor can kneel unheard.

## Gazetteer

| Name | Old or other name | Where (level) | What it is now | Holds |
|---|---|---|---|---|
| The Outside Fire | The shelter fire | (-6.5, 4.8) | The refuge's only fire | |
| Shelter Stash | The doorstep box | (-7.9, 7.0) | The survivor's box; the book's loose pages | Rag, timber, padded coif |
| Wayfarer's Watchhouse | Crown waystation; refuge since S.12 | x 1 to 9, z -7 to 1 | Goblin-held, stripped by the band | Supply Chest; two goblins |
| Counting Passage | The entry hall | x 1.2 to 4.6 | Where sweeps clang | |
| Watchhouse Supply Chest | The warden's chest | (7.4, -5.6) | Where the salt was hidden | Spear, gambeson, rag, two salt |
| The hall post | Assize corner, cold corner | (7.8, 0.2) | Where Edda was tied | Edda |
| Naming Stone | The flat stone | (6.0, 12.5) | Three new names | |
| The Drowned Graves | The waystation burial ground | about (15.5 to 21, 17.5 to 21) | Three Unnamed, three stones | A rag, a little salt (named bodies) |
| Rotted Grain Crate | A relief crate, the dry box | (-4.2, 2.2) | A dead man's gear | Two timber, scrap, leather greaves |
| Spore Hollow | Withy Bottom, the lime pit | Around (-20, -2.5) | Spore ground | Cart; three husks |
| Spore-Choked Cart | | (-22.5, -1.5) | Untouched | Fresh torch, oil, rag |
| Old Quarry | The Causeway Delph | (15.5, -14.5) | The troll's ground; Dace's ledge | The troll |
| North-West Feeding Ground | The Long Stable | (-13.5, -11.5) | An ogre's ground | Bone Heap; the ogre |
| Gnawed Bone Heap | On the S.2 horse bones | (-15.0, -13.0) | The ogre's heap | Cooking pot, kettle hat, two scrap |
| East Choke Point | The Causeway gap | x 9 to 15.5, z 5.5 to 12.4 | The pack's walled den | Plunder Pile; two orks |
| Ork Plunder Pile | | (13.2, 12.4) | A den hoard | Broadaxe, hauberk, oil, rag |
| Causeway tower | | Beyond the map, east | A roofless ork den | The rest of the pack |

---

## New names

New in this file. All are proposed, and all were checked by grep against every file in `docs/worldbuilding/`
(the other Godot additions included), `scripts/` and `README.md` on 2026-11-05. None clashes.

**People.** **Osric Brayne**, the waystation's last Crown warden, who rode south with its books in S.3. (The
other people named here come from `items-and-texts.md`: Winna, T. Gale, E. Callow, Hildy Coyle, Odo Starke and
Sorrel. Edda, Dace Ormer and the residents come from `godot-people.md`.)

**Places and things.** The Outside Fire · the doorstep due · the King's wayfarers · the Counting Passage · the
wayfarers' room, the tally room, the strong corner, the assize corner, the cold corner · the Naming Stone · the
relief crates and the dry box · Withy Bottom and its lime pit · the Causeway Delph · the Long Stable · the
Watch's road wall and the gap (the gap is already in `items-and-texts.md`).

**Beasts (names people give them; no creature has a name of its own).** The Causeway pack (already in
`acts-two-and-three.md`) and the carters' name for it, **the Saltlickers**.
