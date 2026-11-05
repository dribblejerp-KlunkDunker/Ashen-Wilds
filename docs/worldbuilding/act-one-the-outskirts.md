# Act I: the Outskirts

**Status: PROPOSED** (Godot addition, 2026-11-05). Nothing here is canon until the owner says so.
It follows `CANON.md`, including owner decision **O1** (only humans are people; every creature is a
beast). Where the bestiary's older entries treat goblins or orks as peoples, this file follows O1.

**Summary.** Act I is the Blackfen Outskirts, the ground around the Wayfarer's Watchhouse where the
Old Causeway leaves the fen. This file walks the shipped Godot level location by location. For each
one it says what the place was, what happened there, what stands there now, what a player finds,
which pieces of the environment kit could tell its story, and where a later quest could start. The
short version: the Crown built a waystation at the fen end of its road and then left. The Watch
kept the road for twenty-six years without pay. Last autumn a pack of orks took the Causeway tower,
and early this winter a band of raiders took the Watchhouse itself. The survivors now sit at the
fire outside the door they used to keep shut, and Act I is the work of getting back inside. The
file explains in-world why every container holds what it holds, and ends with a gazetteer and a
list of new names.

---

## How to read this file

- **It follows the level, not a map.** Positions are given as the Godot build has them (metres,
  `scripts/core/scene_bootstrap.gd`, `scripts/world/set_dressing.gd`). In the level **-Z is north**
  and **+X is east**. The camera sits on the south-east side. The 52 m yard is a compressed slice of
  country: distances in the prose ("a quarter-mile out to the stable") are the world's, and the
  level squeezes them. Map scale is still unset (see the archive README's continuity boundaries).
- **Two sections per place:** *what we know*, then *what people guess*, kept apart in the
  archive's habit. Where a guess is offered it is marked as one.
- **Props** name pieces from the owner's kit under `assets/environment/` (ENV-002 rubble,
  firewood and patched door; ENV-003 plank walls, posts, roof slopes and broken fence; ENV-006
  fence and wall variants; ENV-007 crates and barrels; ENV-008 trees, rocks and ground cover;
  ENV-009 ruin walls, pillars and paving). They are suggestions for a designer. None is placed yet
  unless the text says it already is.
- **Hook:** lines are places a quest, a note or a later act could start. They are not promises.
- **People elsewhere.** Edda, the band that took her, the eight backgrounds and the Watchhouse's
  living residents belong to `godot-people.md`. This file names only the dead, the departed and the
  historical, and defers to that file wherever the two meet.

## The Outskirts at a glance

| Where (level) | Place | Who or what is there |
|---|---|---|
| South-west, (-6.5, 4.8) | The Outside Fire and the Shelter Stash | The survivor's start; no enemy |
| Centre-east, x 1 to 9, z -7 to 1 | The Wayfarer's Watchhouse | Two goblins: one in the yard by the door, one at the end of the entry hall |
| Watchhouse south-east corner, (7.8, 0.2) | Edda's corner | Edda, bound |
| Between fire and door, (-4.2, 2.2) | The Rotted Grain Crate | Nothing guards it |
| West edge, around (-20, -2.5) | The Spore Hollow (Sallow Bottom) and the Spore-Choked Cart | Three Ash-Spore Husks |
| North-east, (15.5, -14.5) | The Old Quarry (the Causeway Delph) | The Blind Quarry-Troll |
| North-west, (-13.5, -11.5) | The North-West Feeding Ground (the Long Stable) and the Gnawed Bone Heap | The Blackfen Ogre |
| South-east, (12 to 15.5, 5.5 to 12.4) | The East Choke Point (the Fen Gate) and the Ork Plunder Pile | Two orks of the Saltlick Pack, one shielded, one with a cleaver |
| Off the map, east along the Causeway | The Causeway tower | The rest of the pack, as far as anyone knows |

## What happened here

All dates are proposed and use the canon sheet's S-dating (S.0, the Breaking; S.30, now).

| When | What happened |
|---|---|
| About 160 years before S.0 | The Crown rebuilds the Old Causeway's fen end. It raises a stone waystation for the King's wayfarers (its mounted couriers) and the road wardens, with a stable, a yard and a gate, and opens a small quarry to the north-east for the road's stone. |
| Before the Breaking | The waystation counts travellers, takes tolls in salt, holds road offenders for the assize, and changes couriers' horses. Rook's Stair masons cut Causeway stone at the quarry on Crown contract each spring. |
| S.1 | The first ash winter. Wet ash on the slate roof brings half of it down. The Watch re-roofs with planks. Sallow Bottom, the low ground to the west, becomes a lime pit for the road's dead. |
| S.2 | The courier horses are killed and eaten in the Long Stable when the fodder runs out. The stable's roof timber goes for fuel the next winter. |
| S.3 | The Flight South. The last Crown warden, Osric Tarrant, rides south with the waystation's books and strongbox. Crown grain gathered for "relief" is left in the yard in crates and never collected. The Watch keeps the road anyway. |
| S.4 | The Watch builds the Fen Gate barricade where the Causeway leaves the yard, to control what comes off the fen. |
| S.3 to S.29 | The Watchhouse becomes a refuge: the hearth, the warning book, the winter argument about whom to admit. The doorway argument begins the first time an ogre takes the Long Stable for its feeding ground, and ends there every time. |
| Autumn S.29 | The Causeway tower falls to a pack of orks, the Saltlick Pack, under a cinder-squall. Survivors of the Watch come west along the road. Within weeks the pack has denned behind the Watch's own barricade at the Fen Gate. A carter goes east and does not return. A coughing household is turned away and given a cart. Two Watchmen go out to the stable with the Watchhouse pot. |
| Early winter S.30 | A band calling itself Ashbound takes the Watchhouse by night. The residents scatter to the Outside Fire. The band leaves Edda tied in the south-east corner. Goblins come up through the floor drain into the emptied house. |
| Now | Act I begins at the Outside Fire. |

---

## 1. The Outside Fire and the Shelter Stash

*Level: the fire ring at (-6.5, 4.8), its light 1.1 m above it; the survivor spawns at (-6.5, 6.5);
the Shelter Stash at (-7.9, 7.0); firewood bundles at (-5.5, 5.8) and (-8.9, 8.0); a repaired rail
fence and a broken one along the west side at x -10.6, an intact three-picket fence at (-9.4, 9.6);
a pebble scatter at (-6.0, 9.5); a low stump at (-9.0, 12.5) and a long fallen tree at (-11.5, 9.5).*

### What it was

The waystation never let everyone in. The Crown's rule was that a traveller without a token, a toll
or a reason could stand in the yard until morning, and in the Smothering the rule became a
necessity: there were never enough beds, and every winter someone was coughing. The Watch kept a
fire ring of dark stone in the lee of the yard's west fence for the ones it turned away. It was
called **the Outside Fire**, and it was the Watchhouse's conscience. Carters slept beside it in good
years. In bad years the people who sat at it were the ones the vote had gone against.

The Keeping's custom says the last coal of a hearth is kept through the night. The Watchhouse's
version was that a coal from the inside hearth was carried out to the Outside Fire every dusk, so
that the turned-away and the admitted burned the same fire. Some years it was done in good faith.
Some years it was the only thing the house gave.

The box by the fire, the wide, low crate that is now the Shelter Stash, held the **doorstep due**:
what the Watchhouse owed anyone it refused. It was one clean rag and one stick of seasoned timber.
The rule was written on the inside of the lid, and people argued about it every winter like every
other rule. It was never much, but it was owed, and it was paid.

### What happened

When the band took the Watchhouse in early winter, the people inside ran for the only fire they
knew they could reach. The house that had argued every winter about whom to put outside is now
outside itself. Nobody at the fire says so. Everybody knows it.

### What is there now

A ring of dark stone with an ember bed and three charred logs, breathing with the weather: sleet
dims it, the Dead Calm lets it stand straight up. Firewood is stacked on either side. The west
fence is half repaired with a diagonal stay and half fallen, and a three-picket run closes the
corner to the south. Everything the people here own is in one box.

### What a player finds

**The Shelter Stash** opens at once, because it is the survivor's own: a **Clean Rag Bandage**, a
**Seasoned Timber** and a **Padded Coif** at half its condition.

*Why it holds that.* The rag and the timber are the doorstep due, still paid. Someone has kept
filling the box out of habit, though the people it was filled for are now the people at the fire.
The coif is the survivor's. The Watch Deserter's card says so plainly ("Your old coif is in the
shelter stash"): it is the linen cap worn under a Watch helmet, left in the box when its owner came
off the Causeway with nothing else, sweated through and frayed at the ties. For the other
backgrounds it is simply a cap left in the box by somebody who went inside and did not come back
out, and it is the survivor's now because there is nobody else to claim it.

### Props from the kit

- The ENV-002 firewood bundle again, tucked under the fence, with one bundle split for kindling and
  a hatchet scar in a stump (ENV-008 stump low).
- An ENV-007 barrel (v06 open, empty) as the water butt, a ladle hooked on its rim. Without the
  Cast-Iron Cooking Pot there is nothing to boil water in, and the butt is the reason it matters.
- ENV-008 sedge and trampled grass worn flat in a ring around the stones where people sleep, the
  flattened patches spaced so that nobody lies across another's way out to the yard.
- A fourth fence post (ENV-003 timber post) standing alone with a rag knotted to it at head
  height: the old signal that the Outside Fire has someone at it who needs a healer.

### Hooks

- **Hook:** The rule on the stash lid has been scraped out and re-cut at least four times, each
  version a little meaner or a little kinder than the last. The oldest legible line is in a Crown
  clerk's hand. A designer can show them as a readable note: `ONE RAG. ONE STICK. NO ONE TURNED
  FROM THIS FIRE.` with the last four words cut through.
- **Hook:** When the Watchhouse is taken back, who carries the coal out to the Outside Fire at dusk,
  and who sits there tonight?
- **Hook:** The survivor is the only one at the fire with a weapon. Everyone else's eyes say so.

---

## 2. The Wayfarer's Watchhouse

*Level: stone walls 3.2 m high around an 8 m square, x 1 to 9, z -7 to 1; the west wall at x 1 has a
**1.35 m doorway** (z -3.35 to -2.0) under a stone lintel; inside it a **1.7 m entry hall**, 3.4 m
long, between darker stone walls; a plank roof at 3.35 m that hides when the survivor steps in;
rubble against the east wall (9.7, -6.0), the south-west corner (0.2, 1.3) and masonry chips at
the south wall (5.5, 1.7).*

### What it was

A Crown waystation: the King's house at the fen end of the King's road. Its proper name in the
Crown's books was the Fen End Station. Everybody called it the **Wayfarer's Watchhouse** after the
**King's wayfarers**, the mounted couriers who changed horses there on the long run between the
uplands and Wexhaven. It did four things. It **counted**: every traveller coming off the Causeway
gave a name and a purpose, and the clerk wrote both down. It **tolled**: carts paid in salt by the
axle, walkers by the pack. It **held**: road offenders were kept for the assize, chained to an iron
ring in the corner. And it **sheltered** the wayfarers, the wardens and whoever the warden chose.

It was built narrow on purpose. A waystation was a toll gate with a roof, and the Crown wanted
people to come in one at a time, with their packs in front of them, past a clerk who could see
their hands. Carts stayed in the yard. Horses went to the stable. The house itself was for people
and what they could carry.

### Why it is ruined

Nothing dramatic ruined it. It wore out the way everything in the north wore out, one winter at a
time.

- **The roof.** The slates came down under wet ash in the first Smothering winter (S.1). The Watch
  laid planks from the stable over the gap, and then over the rest when more slates went. The roof
  that hides when you step inside is the third plank roof, patched from the second.
- **The partitions.** The inner walls of the rooms beside the entry hall were timber. They were
  burned in a hungry winter (the book says S.11; others say S.13), which is why the house is now
  one large room with two alcoves.
- **The outbuildings.** The stable roof went for fuel in S.3. The north range, a lean-to store
  against the north wall, fell in when its beam rotted, and its stone is the rubble at the corners.
- **The band.** Early this winter the band calling itself Ashbound came in through the narrow door
  by night, the way the door was built to stop. What they took is listed in `godot-people.md`. What
  they left is described below.

### The entry hall: the Counting Passage

The 1.7 m hall inside the door is the **Counting Passage**. A traveller came through the doorway
into it and stood there, between two walls of dark stone, while the clerk in the room to the south
asked their name through a hatch. Two people could not pass in it without one turning sideways.
That was the point.

The Watch learned what the passage meant in a fight long before the Smothering, and every recruit
was told the same thing: **in the passage, thrust.** A sword swung flat across the hall meets
stone, rings, jars the arm and leaves the man open. A spear point goes straight down it. So the
Watch kept a boar-lugged spear in the house for whoever held the passage, and drilled with it. The
game's deflection rule is that lesson. Slashes, cleaves and the spear's shaft-sweep clang off the
hall's walls, and thrusts and the sword's lunge work. An ork's opening slash clangs too, and leaves
it reeling.

The hatch is still there, low in the south wall of the passage, bricked up since the partition
burned. You can feel its edges in the stone.

### Why the doorway was never widened

The doorway is 1.35 m. Carts cannot get in, a stretcher has to be tilted, and every winter someone
says it should be opened up: to bring the sick in lying flat, to get a barrel through without
unloading it, to let the house breathe. A Crown waystation's door was built for one person and a
pack, and the Watch kept it that way at first out of habit and the old rule.

Then an ogre took the Long Stable for its feeding ground, and the argument found its answer. An
ogre is 1.7 m across the shoulders. It cannot get through a 1.35 m door, it will not follow anyone
into one, and it will not charge where its shoulders do not fit. The doorway is the only thing
between the Watchhouse and the ogre, and that is why it stays as it is. The argument still comes up
every winter, usually from someone new. The book records who raises it. The answer is always the
same, and the person who raised it is always walked out to the Long Stable in daylight to look at
the heap.

### The rooms

What the house was, room by room, as the older residents remember it and the stones still show:

| Part of the house | What it was | What is there now |
|---|---|---|
| The doorway (west wall) | The counting door, 1.35 m under a stone lintel. A barred timber door hung here; its pins are still in the stone | An empty doorway. The band took the door, or burned it |
| The Counting Passage (the entry hall) | Where travellers stood to be counted, with the clerk's hatch in its south wall | Bare stone, scarred at blade height where swords have met it for a century and a half |
| The north alcove | The wayfarers' room: four bunks for the couriers, closed off by a timber wall | Open since the partition burned. Now the goblins' nest (below) |
| The south alcove | The tally room: the clerk's desk, the hatch, the toll salt under lock | Open. The desk is gone; a ring of nail holes shows where the salt bin stood |
| The common room (the east half) | The hearth room, where the wardens ate and the sheltered slept on the floor in rows | Empty, cold, swept by the band. The hearth on the north wall is dead |
| The north-east corner | The strong corner: the warden's chest under the loft stair | The Watchhouse Supply Chest, still there |
| The south-east corner | The assize corner: an iron ring set in the stone for holding road offenders | Where Edda is tied (section 3) |
| The loft | A sleeping loft under the old slate roof, over the common room | Gone with the slates. A stub of the stair beam is still in the north wall |

### The goblins

Two Goblin Scavengers are in and around the house. One prowls the yard just outside the door, from
the north side of the doorway down towards the Rotted Grain Crate. The other waits at the end of
the Counting Passage, where the hall opens into the common room, and wanders up and down the east
half between the chest and the assize corner.

**What we know.** They came up through the floor drain, a stone culvert that runs from the hearth
room under the passage and out to the yard ditch. They came days after the band left, drawn by an
emptied house that still smelled of food, and they have been tearing it apart since: the north
alcove is a nest of torn blankets, shredded sacking, hinge plates, a ladle, buttons and bent nails,
the way magpies keep things. Goblins hear rummaging, and a survivor searching the chest is exactly
what they wait for. Their corpses carry iron scrap, sometimes a rag and sometimes a pinch of salt,
which is what they had already carried off into the nest.

**What people guess.** Two goblins are never only two. Where there is a nest there is a drain, and
where there is a drain there may be more coming up it. Some at the fire say the goblins were in the
culvert long before the band came and only waited for the people to go.

### What a player finds

**The Watchhouse Supply Chest** (north-east corner, iron-bound with a hinged lid, a three-second
search): the **Boar-Lugged Spear** (72%), a **Quilted Gambeson** (95%), a **Clean Rag Bandage** and
**two Salt Rations**.

*Why it holds that.* This was the warden's chest, and it was kept for the passage. The spear is the
**hall spear**, the one the Watch drilled with for holding the Counting Passage, its shaft dark
where a hundred hands have gripped it and its lugs filed for boar because that is what the Blackfen
had to hold off in the years nobody came down the road. The gambeson went with it. Whoever held the
passage wore it, so it was mended and kept better than anything else in the house. The rag and the
salt are the last of the house's reserve: two measures, the salt the house kept back for trade and
fever.

*Why the band left it.* Nobody knows. These are the guesses, and the book will not choose between
them. The chest sat under the stub of the loft stair, in the darkest corner of the house, and the
band came by night and left before light. Or the band were frightened off: something came out of
the culvert, or something they heard on the road. Or they left it on purpose, along with Edda, for
a reason only they know. The plainest answer is usually right: they missed it.

### Props from the kit

- **The door:** the ENV-002 patched door and frame, torn off its pins and thrown face-down in the
  yard outside the doorway, axe-marked. If the door goes back up, the Watchhouse is shut again.
- **The nest:** in the north alcove, ENV-008 dense twigs and dense leaves heaped with cloth, an
  ENV-007 crate (v09 braced open) on its side as the goblins' den mouth, and a scatter of ENV-008
  small chips and masonry chips worked loose from the alcove floor where the drain cover was.
- **The salt bin's ghost:** in the south alcove, an ENV-007 crate (v03 iron-bound), its lid
  wrenched, empty, with ENV-008 masonry chips where the clerk's desk stood.
- **The hearth:** an ENV-009 raised plinth against the north wall, cold, with an ENV-002 rubble
  cluster where its hood has fallen in.
- **The partitions that were burned:** an ENV-003 timber post left standing alone where each
  alcove wall used to meet the passage, charred at the foot.
- **Outside:** the rubble already placed against the east wall and the south-west corner is the
  fallen north range. An ENV-005 timber-patch roof slope leaning against the east wall is the next
  repair, waiting for hands.

### Hooks

- **Hook:** The warning book. The house's most valuable thing is not in the chest. Before the band
  came through the door, someone had time to hide the book; the old clerk's hatch is the only
  hollow in the house big enough. Getting it out means opening the bricked hatch from the passage
  side, in the passage, with goblins in the house.
- **Hook:** The culvert. Kill the two goblins and more may come up the drain. Block it with stone
  from the fallen north range (a timber and stone fixture, like the networked breach) and the house
  is shut from below as well as from the door.
- **Hook:** Osric Tarrant's last entry. The Crown books went south with the last warden in S.3. The
  older residents swear he left one sheet behind, nailed inside the strong chest's lid: the list of
  everyone admitted on his last night, and a second list of the people he turned away. The lists
  are the same families. (This ties to the flood-damaged Causeway parish register in
  `keeping-and-merewick.md`, which records the same households admitted and refused.)
- **Hook:** Taking the house back means deciding again who is admitted, now that the people at the
  Outside Fire are the ones who used to decide.

---

## 3. Edda's corner

*Level: the Bound Captive at (7.8, 0.2), the Watchhouse's south-east corner, a hooded figure
sitting against the wall facing into the room. Cutting her free takes two seconds.*

### What it was

The **assize corner**. A Crown waystation held road offenders (toll-cheats, horse thieves, a carter
who had struck a warden) for the circuit judge, and this corner was where they sat. The Crown set an
iron ring in the stone at knee height, the **Assize Ring**, with a short chain. The chain went for
scrap long ago. The ring is too deep in the stone to take out.

In the Smothering the corner had a different use. When the Watchhouse admitted someone who was
coughing, it put them in the corner farthest from the hearth and the door, and that was this one.
The residents called it the cold corner. People who sat in it either got better or were carried
out to Sallow Bottom.

### What happened

The band who took the Watchhouse tied Edda to the Assize Ring and left her there. Who she is, why
they took her and why they left her alive belong to `godot-people.md`. The place itself says only a
few things, and a careful survivor can read them:

- **The knots are good.** Whoever tied her knew rope: a carter's hitch on the ring, her wrists
  crossed and bound separately so she could not work one hand free. The band carry rope, work
  together and loot, and they are not starving beggars.
- **There is a cup within reach.** A tin cup of water stands where her foot can drag it. Someone
  meant her to be alive when they came back, or meant her to last long enough to be found.
- **The ring is the Crown's.** The band used the Watchhouse's own fitting, the one it used to hold
  offenders for justice, to hold a woman for whatever they meant to do with her. Edda does not say
  much about it. When she is cut free, her first words are a debt: *"I owe you."*

### What is there now

Once Edda is freed, the corner keeps the ring, the cut rope, the cup and the scuffed ground where
she sat. If she dies later and her body is brought back, this corner is where the house would lay
her out, because it has always been where the house put the people it did not know what to do with.

### Props from the kit

- The ring itself is a small detail on the existing stone wall: a dark torus decal, or a short
  ENV-008 roots-thin piece repurposed as cut rope trailing from the wall.
- An ENV-007 barrel (v12 squat) on its side as the seat she was tied beside, and ENV-008 sparse
  leaves and twigs kicked away in an arc where her heels dragged.
- ENV-008 trampled grass is wrong indoors. Use bare floor, and let the cup and the cut rope be the
  only objects in the corner, so the eye goes to them.

### Hooks

- **Hook:** The band meant to come back for her. When the Watchhouse is retaken, they may still come
  back, and they will find the door shut against them by the woman they left tied in it.
- **Hook:** The cup. Somebody gave her water. It may have been one of the band, which would mean the
  band are not all of one mind. That is a crack a later act can open.
- **Hook:** The Assize Ring could be used again. When the survivors catch a thief at the fire, and
  they will, the question of whether the house holds people, and who decides, comes back to this
  corner.

---

## 4. The yard

*Level: the open mud between the buildings; a tall stump south of the Watchhouse at (3.5, 7.5); a
weathered rock cluster to the north at (-4.0, -10.0); a snapped-crown dead tree further north at
(-2.5, -16.0); a medium boulder east of the house at (12.5, -2.0); a flat boulder at (6.0, 12.5)
between the fire and the choke point; dead trees on every edge (forked, straight snag, gnarled,
wind-bent, split trunk); seventy scattered patches of grass, sedge, weeds, leaves and twigs.*

### What it was

The waystation's yard: the ground where carts waited for morning, where horses were walked to the
stable, and where the Causeway's travellers stood in the open to be looked at before they were let
anywhere near the door. It was kept bare on purpose, because the Watch wanted a clear sightline.
Bare ground, a fire and people are why the bestiary rates "Watchhouse grounds, passing places" as
low danger. It was low danger only while there were enough people to keep it bare.

### What happened

Thirty years of mud and too few hands. The yard's edges have grown back as dead timber and sedge,
and the dead trees stand where the Watch used to cut them for fuel and then stopped, because the
fuel parties kept not coming back. The stumps are what is left of the ones they did cut.

### What is there now

Open, cold, misted ground with the buildings at its middle and something dangerous in every corner:
the hollow to the west, the stable to the north-west, the quarry to the north-east and the gate to
the south-east. The safe ground is the strip between the Outside Fire and the Watchhouse door, and
the goblin that prowls the doorway has claimed half of that.

**The flat stone.** The broad, flat boulder at (6.0, 12.5), on the road between the yard and the Fen
Gate, is the **Naming Stone**. The Watch laid the dead brought in off the Causeway on it, so that
someone could speak each one's name into its mouth before it went to the lime (a Keeping custom;
see `keeping-and-merewick.md`). When a body had no name, the warden wrote down what it carried
instead. The stone's top is worn smooth and paler than its sides.

**The tall stump.** The one at (3.5, 7.5), south of the house, is the old gallows post. It has not
been used since before the Smothering, and the residents would like everyone to remember that.

### Props from the kit

- An ENV-009 cobbled strip running from the doorway west towards the fire and east towards the Fen
  Gate, broken and half-buried: the old Causeway metalling coming into the yard.
- ENV-009 worn threshold stones outside the doorway, dished by a century and a half of feet.
- ENV-007 crates (v05 face patch, v02 single brace) abandoned along the south wall of the house,
  empty, lids off: the band's leavings.
- An ENV-006 fence run with post collars marking the old horse-walk from the yard to the stable,
  mostly fallen.

### Hooks

- **Hook:** The Naming Stone has fresh marks: three short names scratched into its edge this autumn,
  in different hands, none of them limed. Who carved them, and where are the bodies? (Two of the
  three answers are in the Long Stable and Sallow Bottom.)
- **Hook:** Clearing the yard is its own task. Cut the dead trees for fuel, and the sightline
  returns and the fuel problem eases, but every felling party is noise, and the troll in the quarry
  hears noise.

---

## 5. The Rotted Grain Crate

*Level: a cross-braced crate at (-4.2, 2.2), in the open between the Outside Fire and the
Watchhouse door; a two-second search.*

### What it was

One of the **relief crates**. In the spring of S.3 the Crown's agents came along the Causeway
gathering grain "for relief": requisitioned from the fen farms against receipts, crated in the yard
under guard, and waiting for the carts that would take it south to be shipped and, the receipts
said, returned as bread. The carts took the first load. The Flight South took the rest of the
Crown. The second load sat in the yard for a summer that did not come, under a tarpaulin that rotted
before the grain did. The Watch ate what it could and burned what it couldn't. One crate, at the
bottom of the pile, was too far gone even for that. Its slats are still stencilled with the Crown's
wheatsheaf and a number.

### What happened

A sound crate with a good lid is worth something in the Blackfen even if what is in it is not. The
Watch turned the relief crate into the yard's **dry box**: a place where carters could leave spare
gear off the ground and out of the rain without bringing it through the narrow door. The rotted
grain was never scraped out of the bottom. It set into a black crust, and things were stored on top
of it.

The last carter to use it was **Joss Sefton**, who ran the Watchhouse's cart on the Causeway. In the
autumn of S.29, the week the tower fell, he went east with the cart to bring back whoever was coming
off the road. He left his spare gear in the dry box, because he meant to be back the next night.

### What is there now

The crate sits on two flat stones in the open, cross-braced, its lid warped, the stencil faded but
legible. It smells of old wet grain when it is opened.

### What a player finds

**Two Seasoned Timber**, **one Iron Scrap** and **Leather Greaves** (60%).

*Why it holds that.* All of it is Joss Sefton's. The timber is two seasoned spokes and a felloe
section, cart spares, dry because the crate kept them dry; to the survivors it is fuel or building
wood. The iron scrap is a bundle of tyre nails and a spare hub band. The greaves are his: boiled
leather over the shins, laced at the back, the left one scuffed pale where it rubbed the cart's
footboard. His initials are burned inside the right one.

### Props from the kit

- The existing ENV-007 cross-braced crate, with an ENV-008 small stone under each end.
- A second relief crate beside it, ENV-007 v04 vertical battens, broken open and empty, its
  stencilled slats used as kindling at the Outside Fire (one or two in the firewood bundle there).
- ENV-008 dry weeds grown up around the crates' feet. Nobody has moved them in years.

### Hooks

- **Hook:** The receipts. The Crown gave the fen farms receipts for the relief grain. Some families
  still keep them, sewn into clothing. The crate's stencil number matches a receipt. A Merewick
  collector (`keeping-and-merewick.md`) would want to know that the grain never left the yard.
- **Hook:** Joss Sefton went east with the Watchhouse cart and has not come back. The cart is worth
  more than the man to some people at the fire. Whether either can be found is an Act I or Act II
  question on the road beyond the Fen Gate.
- **Hook:** A survivor wearing a dead carter's greaves will be recognised by anyone who knew him.
  Whether they are glad or angry depends on who they are.

---

## 6. The Spore Hollow (Sallow Bottom) and the Spore-Choked Cart

*Level: three Ash-Spore Husks at (-19.5, -1.0), (-21.5, -3.5) and (-18.5, -4.5); the Spore-Choked
Cart at (-22.5, -1.5) against the west edge; a rooted stump at (-14.5, 3.0) on the way in; a stone
cluster at (-19.5, -8.5) to its north. Teleport banner: "the Spore Hollow (Ash-Spore Husks). Fire
burns spores."*

### What it was

**Sallow Bottom**, a shallow dip at the yard's west edge where the ground holds water. Sallow is
the old word for willow, and before the Smothering willows grew there; carters cut withies there
for basket-work and hurdles. Low, wet and out of the way, it was the place nobody wanted. That is
why it became what it became.

### What happened

In the first winters (S.1 to S.3) the dead came off the Causeway faster than any parish could bury
them, and the Watchhouse had no churchyard. The Watch dug a **lime pit** in Sallow Bottom and limed
the road's dead into it, as the fen does. Then the lime ran out. The quarry kiln could not be fired
without fuel and men, and the Split Kiln was too far. For a winter the dead went into the pit
unlimed, and the spores did what spores do in the unlimed dead. The corpse-caps fruited, and the
hollow has been spore ground ever since. Nothing grows there now but caps and dead willow stumps.

Low, wet ground is also where the sick go. In the third stage of ash-lung, silence, the sick leave
shelter for low, wet ground (`bestiary.md`), and from the Watchhouse the lowest, wettest ground in
reach is Sallow Bottom. For thirty years the coughing who were turned away, and the coughing who
left on their own, have walked down into the hollow.

**The cart.** In the autumn of S.29, with the tower fallen and the house full of the Watch's
wounded, the Watchhouse voted to turn away a coughing household: **the Wenlocks**, three of them,
off the Causeway. **Tamsin Wenlock** was the one who still spoke. The custom for the coughing
turned away was the doorstep due and something more, **fire for your dead**: a torch and a flask of
oil, so that whoever died first could be burned by the others and not left to bloom. The house gave
the Wenlocks a handcart, a pitch torch, a flask of oil and a rag. Three went down into Sallow Bottom
with the cart.

The torch was never lit. Somebody has to stop coughing long enough to strike a light, and somebody
has to decide that the one on the cart is dead. In a few of the sick the bloom roots before the body
has finished dying (`CANON.md` fact 18), and a body that still walks cannot be burned by the people
who love it.

### What is there now

Three Ash-Spore Husks stand and shamble in the hollow, never far from the cart. They are slow,
half-blind and weak alone. Every wound puffs spores, and each one's death bursts a choking cloud
where it stood. They keep to one stretch of ground, as the Ashbound do. Three went down with the
cart and three husks stand round it, and the Watchhouse does not say those two numbers out loud
together.

The husks' corpses carry a little iron scrap and sometimes a rag: buttons, a belt buckle, a knife
gone to rust, the ordinary things people carry.

### What a player finds

**The Spore-Choked Cart** (three-second search, in the middle of the spores): a **Pitch Torch** at
full fuel, a **Flask of Lamp Oil** and a **Clean Rag Bandage**.

*Why it holds that.* It is the Watchhouse's gift, untouched: the doorstep due and fire for your
dead. The torch is fresh because nobody ever lit it. It is the one thing in the hollow the spores
fear, sitting a pace from the people it was given to protect, and a survivor who takes it and lights
it can burn the clouds the Wenlocks became.

### Props from the kit

- The existing ENV-007 open-top crate tinted green-grey is the cart's bed. Add two ENV-008 fallen
  short logs as its shafts, one snapped, and an ENV-007 barrel (v08 partial lid) tipped off the back:
  the household's water.
- ENV-008 stumps (low and rooted) and the straight snag for the dead willows; ENV-008 roots
  spreading across the hollow floor like white threads.
- The old lime pit as a shallow ENV-009 low step edge sunk into the ground on the hollow's north
  side, with ENV-008 pebble scatter dusted pale (lime) at one end and dark at the other, where the
  lime ran out.
- A single ENV-003 timber post at the hollow's lip with a rag tied to it, faded grey: the Watch's
  old warning, *spores below, do not wade*.
- Weather already does the rest: in the Dead Calm the clouds hang for thirteen seconds, and in a
  cinder-squall they blow apart in three.

### Hooks

- **Hook:** Fire for your dead. Burning the cart's three with the cart's own torch finishes what the
  Watchhouse sent them out to do. A designer can let the survivor say the names at the Naming Stone
  afterwards, if anyone at the fire will tell them the names.
- **Hook:** The vote. Somebody at the Outside Fire voted to turn the Wenlocks away. Somebody else
  voted to give them the cart. The book records who raised the question, and the two people may now
  be sleeping side by side.
- **Hook:** Lime. Sallow Bottom will keep fruiting until the pit is limed. Lime means the quarry kiln
  (section 7) or the Split Kiln up the Bell Road, and either is a journey worth an act.
- **Hook:** Was the Wenlocks' cough catching? The fire has to decide whether the people who handled
  their cart, and the survivor who just searched it, sleep inside or out.

---

## 7. The Old Quarry (the Causeway Delph)

*Level: the Blind Quarry-Troll at (15.5, -14.5), its home spot; a large outcrop at its back edge
(19.0, -18.5); standing rocks at (21.5, -12.5) and (12.0, -19.5); masonry chips at (15.5, -13.0)
and (13.0, -15.5); low masonry rubble at (17.5, -15.0); a pebble scatter at (14.5, -11.0); a
gnarled dead tree at (19.5, -17.0); a long fallen tree on the way in at (16.5, -6.0). Teleport
banner: "the Old Quarry (Blind Quarry-Troll). Keep still."*

### What it was

**The Causeway Delph** (delph is the fen word for a pit that stone is dug from): a small open
quarry cut into a low grit ridge north-east of the yard, opened by the Crown when it rebuilt the
Causeway's fen end. It gave grey gritstone, hard and frost-proof, for the road's kerbs, its
drainage mouths, its revetments, the waystation's walls and the Fen Gate. A small kiln at its
mouth burned limestone carted in from the uplands into lime for mortar and, later, for graves.

The Crown did not have masons of its own at the fen end. Every spring it contracted a crew from
**Rook's Stair**, the terraced quarry town on the Bell Road that trades stone, lime and masonry
skill (`blackfen-roads-and-towns.md`), and they cut the season's stone and went home. The
Watchhouse walls and the Delph's grey stone are the same grit as Rook's Stair's lower terraces,
and the same families' marks are cut into both.

### What happened

The contract crews stopped coming after S.3; nobody was paying them. The Watch cut its own repair
stone for a few years and fired the kiln when it had fuel and men. The last time, **in S.24**, a
lime party of four went up to fire the kiln for Sallow Bottom. One came back, walking on her toes
and refusing to speak above a whisper. Nobody has worked the Delph since.

The Blind Quarry-Troll lives there. It never looks, because it has nothing to look with; it hunts by
sound alone. It sits motionless in the cut until it hears something. Then it turns, lumbers to
where the sound was and brings both fists down on that spot. Struck, it thrashes round itself. It
remembers a sound for about six seconds and then goes home to the same patch of stone.

**Why it lives there.** These are guesses, and the book keeps them as guesses.

- **The lime and the salt.** The troll licks lime from kiln waste and gnaws salt-bearing rock
  (`bestiary.md`). The Delph has a kiln's worth of spilled lime and the grit has salt in its
  partings.
- **The quiet.** A dead-end quarry is the quietest ground in the Outskirts. Nobody walks through it
  on the way to anywhere, so every sound in it means something has come in.
- **The walls.** A cut with stone faces on three sides carries sound inward. Everything said in the
  Delph comes back off its walls, and the troll may sit at the one spot where all of it arrives.
- **It was always there.** The Rook's Stair quarrymen say the same one was in the Delph before the
  Smothering, sitting in the cut like an outcrop, and that the contract crews worked around it on
  their toes for a generation. If that is true, it did not come up from the Vaults with the ash. If
  it is not, it is the kind of thing quarrymen say. There is no evidence either way.

### What is there now

A grey cut with a rubble floor, standing stones at its back edge and an outcrop that may be an
outcrop. The kiln mouth is a ruined stub. Rings of shattered stone across the floor mark where the
troll has pounded, and a careful survivor reads them before walking in, because a ring means
something made a noise there and the troll came.

### What a player finds

Nothing is lying in the open. The troll itself, if a survivor somehow brings it down, carries
**four Iron Scrap**, **two Salt Rations**, a **Flask of Lamp Oil** and a **Clean Rag Bandage**.

*Why it carries that.* It is the S.24 lime party's kit, or what is left of it. The scrap is their
crowbar heads, wedges and the kiln's door straps. The salt was their food. The oil was for the
kiln's lamp, and the rag was in somebody's pocket. Whether a troll swallows such things, or they
are caught in the crust of stone dust and lime on its hide, nobody has ever got close enough to
say. The book's guess is that they went down with its last meals.

### Props from the kit

- The existing outcrop and standing rocks at the back edge. Add ENV-008 broken pillar and weathered
  cluster pieces as unfinished blocks, half-cut and abandoned, with ENV-009 split-square pillars as
  squared kerbstones never collected.
- **The pound rings:** ENV-008 masonry chips and small chips in rough circles on the quarry floor,
  more than the troll's current ring, some old, some fresh.
- **The kiln:** an ENV-009 corner ruin at the quarry mouth, an ENV-002 stone corner against it, ENV-008
  pebble scatter dusted pale with lime round its foot.
- **The lime party:** an ENV-007 barrel (v11 iron handles) on its side where it was dropped, an
  ENV-003 timber post used as a lever and left, and an ENV-007 crate (v10 carry handles) half buried
  in spoil.
- **The Rook's Stair marks:** mason's marks cut in the outcrop face, a decal or a note; the same
  mark is on the Watchhouse's lintel stone.

### Hooks

- **Hook:** Lime for Sallow Bottom. The kiln can be fired again with timber and oil, but firing a
  kiln is loud work in a troll's quarry. It is an Act I task the player can attempt in a cinder-squall,
  when the troll is deaf and rests, or not at all.
- **Hook:** The one who came back from the S.24 party is still whispering, at the Outside Fire or
  somewhere on the Bell Road. She knows where the other three fell. She will not go near the Delph
  in the Dead Calm, the weather quarrymen fear above all others.
- **Hook:** Rook's Stair still holds an old Crown contract for the Delph. If anyone from the Stair
  comes down the Bell Road, they will want to know who is working their stone, and they will know
  how to walk past a troll.
- **Hook:** If the quarrymen are right that the troll was there before the Breaking, then the
  bestiary's question of whether it came up from the Vaults has an answer, and the question of what
  it is gets harder.

---

## 8. The North-West Feeding Ground (the Long Stable) and the Gnawed Bone Heap

*Level: the Blackfen Ogre at (-13.5, -11.5); the Gnawed Bone Heap at (-15.0, -13.0); two stone piers
standing at (-11.5, -14.5), 3 m high, and (-16.5, -10.5), 2.4 m; ruins round it: a collapsed end
wall at (-18.0, -13.0), a ground course at (-15.0, -17.5), a fallen column at (-11.5, -16.5), a
leaning remnant at (-9.0, -13.5), wallfall rubble at (-16.5, -15.5). Teleport banner: "North-West
Feeding Ground (Blackfen Ogre)".*

### What it was

**The Long Stable**: the waystation's stable for the King's wayfarers' horses, a long timber roof on
square stone piers with a stone end wall against the north-west wind. Couriers rode in off the
Causeway, threw their reins to a groom and took a fresh horse from the Long Stable. It held twelve
horses in its best years and stood a quarter-mile from the house, so that the smell and the flies
stayed out of the yard.

### What happened

- **S.2.** The fodder ran out. The Watch killed the courier horses in the stable and ate them through
  the winter. The bones went on a heap outside the end wall, unburied and unburned.
- **S.3.** The stable roof was pulled down for fuel. The piers and the end wall stayed.
- **After that.** An open, roofless ruin on open ground near water, with a bone heap already on it, is
  everything an ogre wants in a feeding ground. The first one the book records came to the Long
  Stable in the S.7 winter. Ogres move on when the ground is eaten out, every few years, and the
  heap and the smell bring the next one back. The ogre on the ground now is the third the book
  records there, or the same one come back. Nobody has seen two together to tell them apart.
- **Autumn S.29.** The Watch survivors came off the Causeway starving, and the pack-ox they had
  brought back from the tower died in the yard. Cooking a carcass at the Watchhouse would bring the
  ogre's nose straight to the door, and most ogre deaths start with someone cooking. The ogre had not
  been seen that year. So two Watchmen, **Colm Prewett** and one other (the book's line is blotted),
  took the carcass and the Watchhouse's great cooking pot out to the Long Stable to render the fat
  away from the house. The ogre had not gone far. It came back downwind. Neither man came back.

### What is there now

The ogre's feeding ground: a trampled clearing inside the stable's ruined footprint, ringed with the
heap, two piers still standing and a third leaning, a fallen column across the south end and the
end wall collapsed at the west. Saplings are snapped at shoulder height around it, the ground is
pressed into wide, knuckled tracks, and the smell carries a long way on a wet wind.

The Blackfen Ogre holds it: slow, enormous and too wide for any doorway. It does not flinch while it
winds up a blow, every blow can take half a survivor's health, and from 5 to 11 m it lowers its head
and charges in a line it cannot steer. **The piers are the survivors' friend.** Sidestep the charge
with a pier behind you and the ogre crashes into the stone and reels. The Long Stable's piers were
cut from the Delph's grit for the Crown, and they have stood up to that more than once: one of
them leans because of it.

### What a player finds

**The Gnawed Bone Heap** (a three-and-a-half-second search, in the middle of the feeding ground):
the **Cast-Iron Cooking Pot** (the Act I objective), a **Kettle Hat** (70%) and **two Iron Scrap**.
The ogre itself, if it falls, carries **three Salt Rations**, **three Iron Scrap**, **two Seasoned
Timber** and **two Clean Rag Bandages**.

*Why the heap holds that.* Ogres keep the iron things that come with their meals, and the book's
guess is that they smell of food. The **pot** is the Watchhouse's great pot, the one that boiled
marsh water for the whole house for twenty-six years, taken out to render the ox and never brought
back. Without it the Outside Fire cannot make water safe or stretch a stew, and that is why it is
the Act I objective. The **kettle hat** is Colm Prewett's: "a Watch helmet with a brim, dented and
sweated through", his mark scratched under the brim. The **iron scrap** is the ox's harness buckles
and a length of the yoke chain.

*Why the ogre carries what it carries.* Salt, scrap, timber and rags are what a feeding ground
collects over years: the salt from packs, the scrap from harness, the timber from the litters and
hurdles people were carrying, the rags from people. The book does not try to say whose any more.

### Props from the kit

- The existing piers, ruin walls, fallen column and wallfall rubble are the stable. Add ENV-009 square
  stump pillars in a line between the two standing piers, so the row of stalls reads.
- ENV-009 broken paving inside the footprint where the stable floor survives, pressed into mud.
- **The heap:** the existing ENV-008 dense twigs (tinted pale as bone) built up with ENV-008 small
  chips and an ENV-007 barrel (v05 replacement staves) crushed flat in it.
- **The horses' heap from S.2:** a second, older, lower heap outside the collapsed end wall,
  overgrown with ENV-008 broadleaf weeds. The ogre's heap is built on top of where the old one was.
- **The rendering fire:** a scorched ring of ENV-008 small stones south of the heap, with the ENV-002
  firewood bundle scattered, and ENV-003 timber posts as the tripod that once held the pot, knocked
  flat.
- **The tracks:** ENV-008 trampled grass in wide, knuckled patches leading from the stable towards the
  yard and stopping, every time, well short of the Watchhouse.

### Hooks

- **Hook:** The pot. Getting it back means searching the heap for three and a half seconds in the
  middle of an ogre's feeding ground, then carrying 4.5 kg of iron home with a burdened pack. Doing it
  in Miasma fog, when the ogre cannot find a fire's smell, is the old trick.
- **Hook:** The blotted line. The book records two men going to the stable, and the second name has
  been blotted out, deliberately, by someone at the Watchhouse. Somebody at the Outside Fire knows
  whose it was and why they did not want it written down. One answer is that the second man did not
  die, and came back alone.
- **Hook:** The kettle hat. A Watch Deserter who puts on Colm Prewett's helmet is wearing a dead
  comrade's hat. Anyone who knew Colm will notice.
- **Hook:** The doorway argument. The next person at the fire who says the door should be widened is
  walked out to look at this heap in daylight. Let the player be the one who walks them.

---

## 9. The East Choke Point (the Fen Gate), the Saltlick Pack and the Ork Plunder Pile

*Level: the shield ork at (12.2, 8.2), patrolling between (11.8, 7.5) and (13.5, 10.5); the cleaver
ork at (14.0, 9.8), patrolling between (14.0, 11.2) and (12.5, 8.8); a stone wall running east to
west along z 5.5 from x 8.75 to 13.25 (4.5 m long, 2.8 m high); a stone wall running north to south
along x 15.5 from z 7 to 12 (5 m long, 2.8 m high); a gap at the north-east corner between them; the
Ork Plunder Pile at (13.2, 12.4) in the lee of the cross wall's south end; low masonry rubble at
(12.0, 6.3); a wind-bent dead tree at (21.0, 15.5) and a split-trunk tree at (7.5, 19.5). Teleport
banner: "East Choke Point (Shielded Ork & Vanguard)".*

### What it was

**The Fen Gate.** East of the yard the Old Causeway climbs onto its raised bed and runs out across
the wet between two drainage cuts. A traveller who is on it cannot easily leave it without sinking.
The Crown once had an arch there to collect the axle toll. In S.4, the year after the Flight, the
Watch pulled the arch down and used its stone to build a barricade, because what was coming off the
fen had stopped being travellers who paid. The barricade had two walls: a **cross wall** straight
across the road, with a single gap at its north end that one cart could pass, and a **screen wall**
facing the Watchhouse, so that whatever was at the gate could not see into the yard. For twenty-five
years the Watch stood the gate at night, and the gap in the cross wall was where the Causeway was
counted before it reached the Counting Passage.

### What happened

The **Saltlick Pack** is what the survivors call the orks that took the Causeway tower in autumn
S.29 (section 10). The name is plain and unkind. The pack came to the tower for its salt (the
Watch's tolls had been paid in salt for twenty-six years, and the tower's store was the largest in
the Outskirts). Orks crave salt the way cattle crave a lick: they raid salt stores and hoard what
they find, and a dead ork often has salt in its gut or in its hoard (`CANON.md` fact 15).

After the tower, part of the pack followed the road west. They came in the wake of the Watch's
survivors, following the smell of blood and of the salt the survivors carried. They stopped at the
Fen Gate, the first stone with a wall at its back between the tower and the fen. The Watch had
built a wall across the road with one way through, and an ork wants exactly that kind of den. The
pack took the barricade over the way animals take over another animal's burrow. The Watch's gate is
now their den.

**What the orks are.** Beasts (O1). Large, grey, heavy-boned, hard to cut, and drilled, but by
instinct and dominance, not by anyone: a pack of wolves in armour. They came up out of the Vaults
fleeing something deeper, the way animals flee a fire, and never went back down. **They are
quiet.** An ork pack does not howl or call. It goes still before you see it, and the Dead Calm,
when everything is heard, frightens them more than any weather. Nobody knows why, and the book keeps
it as a question.

**The two at the gate.** One carries a shield, a Watch shield or a cart-board strapped to its
forearm, and advances behind it. It opens with a slash and follows with a chop, and if a survivor
hides behind their own shield too long it bashes the guard aside. It moves like the older, heavier
animal of the two, and it holds the den. The other has no shield, only a cleaver, and it runs a
survivor down faster than they can walk and rests less between attacks: the younger animal that is
sent out first. Nobody has ever seen an ork pick up a shield. Every shield the book records on an ork
was a human one, found strapped on, the straps knotted with teeth or grown into the hide, like the
collars grown into the Greymaws' necks. How they come to wear it is not known.

### What is there now

The Watch's two walls, rubble at the screen wall's foot where the pack has torn at it, and between
them a den that stinks of old meat and wet hide. The gap at the north-east corner is the only way
through the cross wall. The orks stand in the angle the walls make and turn towards anything that
comes from the yard.

The Fen Gate is where Act I ends. Breaking the choke point means killing or driving off the two at
the gate, and it reopens the road east for the first time since the tower fell.

### What a player finds

**The Ork Plunder Pile** (a two-and-a-half-second search, at the cross wall's south end): a
**Woodsman's Broadaxe** (90%), a **Rusted Mail Hauberk**, a **Flask of Lamp Oil** and a **Clean Rag
Bandage**. Each ork's corpse carries **two or three Iron Scrap**, **one or two Salt Rations**, often
a rag, sometimes a flask of oil, and now and then **Splinted Greaves**.

*Why the pile holds that.* It is a den hoard. Orks, like the ogre, keep what comes with their kills
and what smells of salt and people. The pile is where they drag it and lie on it. The **hauberk** is
Watch mail from the tower's armoury, knee-length and orange at every ring, dragged here with the
salt sacks it was lying on. It is far too small for an ork, and they did not take it to wear. The
**broadaxe** belonged to whoever the pack caught on the road this autumn. It is a woodsman's or a
peat-cutter's, not a soldier's, and the pack took its owner, not the axe. The **oil** and the
**rag** are from the same packs and pockets. It is all Watch property or travellers' property.
None of it was ever the orks', because nothing ever is.

*Why the corpses carry that.* The salt is in their gut and knotted into the rags they wear. The
scrap is buckles, rivets and the iron of whatever they have strapped on. The **splinted greaves**
are the Watch's: iron splints riveted to leather, found strapped round an ork's shins with the laces
chewed through and knotted. They clatter on stone.

### Props from the kit

- **The Watch's barricade:** the two existing walls. Add ENV-009 gateposts (left and right) standing
  as stumps at the gap in the cross wall, with an ENV-009 broad threshold half buried between them:
  the old toll arch's footing.
- **The den:** in the angle of the walls, ENV-008 dense leaves and roots heaped and flattened into
  sleeping hollows, ENV-007 crates (v06 cross-plank lid, v03 iron-bound) smashed open and licked
  clean, an ENV-007 barrel (v10 bung head) with its head stove in, salt crusted white round the hole.
- **The tower's wreckage:** ENV-005 and ENV-006 plank wall panels (strapped, cross-braced) dragged here
  and leaning against the cross wall, Watch timber torn from the tower and hauled a mile for no
  reason anyone can see.
- **The road:** an ENV-009 cobbled strip running east through the gap and out of the level towards
  the tower, the Causeway's metalling; an ENV-008 fallen long tree across the drainage cut beside it.
- **The torn screen wall:** the existing low masonry rubble at its foot, with ENV-008 masonry chips
  scattered towards the yard where stones have been pulled out and dropped.

### Hooks

- **Hook:** Breaking the choke point is Act I's last task, and it reopens the road east. The first
  people to come along it will be from the tower: Watch survivors, or travellers, or whatever is left.
- **Hook:** The Watch's gate is a fixture waiting to be rebuilt. The networked build already has a
  breach that timber repairs. The cross wall's gap is the Outskirts' version: shut it with timber and
  stone and the Watchhouse holds the road again, or keep it open and keep the road alive.
- **Hook:** The salt. The orks are here because of salt. Every measure the survivors carry, the two
  in the supply chest and the three on the ogre, is a smell on the wind. A designer can let a salt-heavy
  pack draw orks the way a wound draws the ogre.
- **Hook:** The Dead Calm. When nothing falls and everything is heard, the orks go utterly still.
  Survivors who have seen it say it is the only time an ork looks afraid. Some say something else
  comes out in the Dead Calm. The book keeps that as a question.

---

## 10. The Causeway tower (beyond the map)

*Not in the level. East along the Old Causeway from the Fen Gate, a mile or so out across the wet,
well short of the toll house half way along the road.*

### What it was

The **Causeway tower**: the Crown's road tower at the first good stone east of the fen end, three
storeys of grit with a single door at its foot, a yard wall, a stone stair and a warning bell under
its roof. It held the Watch's armoury, its salt store and, after S.3, the Watch itself. The Watch
went on holding the road from there for twenty-six years after anyone stopped paying them, on the
strength of an oath sworn to a king who had sailed away. They took their tolls in salt and kept the
Causeway open in both directions, and every few winters they lost someone to the fen, the beasts or
the cold.

At the end it was eleven people under **Sergeant Wystan Garrow**, who had joined the Watch the year
before the Breaking and was the last of it who remembered being paid.

### What happened

In autumn S.29 the Saltlick Pack came along the Causeway from the east, out of the deep fen. They did
not rush the tower. For nine days they sat silent at the foot of the yard wall, just out of
bowshot, and did nothing. The Watch could not sleep in the silence. They rang the bell the first
night and the pack did not stir. They stopped ringing it on the third. On the tenth night a
cinder-squall came over the fen (ork packs move under cinder-squalls, when nothing can be heard
over the wind), and the pack came over the yard wall in the embers.

**What we know.** Some of the Watch got out by the drain stair on the fen side and came west along
the road, carrying wounded and as much salt as they could. The Watch Deserter "held the Causeway
tower until you didn't" (the background card). Sergeant Garrow did not come west. The tower's salt
store, the Watch's twenty-six years of tolls, was the largest in the Outskirts. The pack has it now.

**What people guess.** That Garrow ordered the last stand and some refused it, which is why the
survivors call some of their own deserters. That the pack came for the salt and nothing else, and
the Watch died because it was standing on it. That the nine days of silence were not patience but
fear, and the pack was listening to something behind it in the deep fen before it moved. Every one
of these is a guess, and the book does not choose.

### What is there now

Nobody at the Outside Fire has been back. Travellers coming off the road say the tower's door has
been blocked with stone from the inside, which is the sign of an ork den, and that the bell lies in
the yard with its tongue torn out. Nobody knows whether an ork did that or a person. The likeliest
answer is that it fell when the roof went.

### Props for an Act II build

- ENV-009 buttressed and ragged-tall walls for the tower's stump; an ENV-009 jagged breach where the
  pack came over the yard wall; ENV-009 damaged steps for the drain stair down to the fen side.
- The doorway blocked with ENV-008 wallfall rubble and stacked ENV-009 ground-course stones.
- The bell as a single authored prop in the yard, on its side, tongueless.

### Hooks

- **Hook:** Act II begins on this road. The Fen Gate open, the Causeway east, the tower ahead, the toll
  house half way along (the archive's Harl the Toll-Keeper may still be in it: see the continuity
  notes in `keeping-and-merewick.md`).
- **Hook:** Sergeant Garrow's fate. A Watch Deserter player has the most reason to go and look, and the
  least reason to want to know.
- **Hook:** Twenty-six years of the Watch's tolls are in that tower, salt enough to buy the Watchhouse
  a winter. Getting it means going into an ork den.

---

## Weather across the Outskirts

The six weathers change which part of the map is dangerous. A survivor who reads the sky reads the
map.

| Weather | Safest errand | Worst place to be |
|---|---|---|
| **Ashfall** (the ordinary night) | Anything, carefully | Wherever you are, if you are careless |
| **Miasma fog** (sight 7 m, sounds die) | The bone heap: the ogre cannot find a fire's smell in still fog | Sallow Bottom, where you cannot see a husk until you can touch it |
| **Sleet** (torches x1.8, grease underfoot) | The Watchhouse, indoors | Sallow Bottom with a torch that will not last; the shelter fire dims |
| **Cinder-squall** (nothing heard over it) | The quarry: the troll rests, deaf; the kiln can be fired | The Fen Gate: ork packs move under squalls |
| **Hoarfrost** (sound x1.25, ice) | Nothing that needs running | The quarry, and anywhere a sprint ends on ice |
| **Dead Calm** (everything heard, x1.6) | The Fen Gate, where the orks go still | The quarry: the troll at its deadliest. Spore clouds hang thirteen seconds |

---

## Gazetteer

| Name | Also called | Where (level) | What it was | What it is now | Containers and creatures |
|---|---|---|---|---|---|
| The Outside Fire | The shelter fire | (-6.5, 4.8) | The fire for the turned-away, in the yard's lee | The survivors' only fire | Shelter Stash |
| The Shelter Stash | The doorstep box | (-7.9, 7.0) | The box of the doorstep due | The survivor's own box | Bandage, timber, padded coif |
| The Wayfarer's Watchhouse | The Fen End Station (Crown books) | x 1 to 9, z -7 to 1 | A Crown waystation: count, toll, hold, shelter | Ruined, taken by a band, held by goblins | Supply Chest; two goblins |
| The Counting Passage | The entry hall | x 1.2 to 4.6 | Where travellers stood to be counted | The hall where sweeps clang | One goblin at its east end |
| The Watchhouse Supply Chest | The warden's chest | (7.4, -5.6) | The strong chest kept for the passage | Missed by the band | Hall spear, gambeson, bandage, two salt |
| The Assize Ring | Edda's corner; the cold corner | (7.8, 0.2) | Where road offenders, later the coughing, were kept | Where Edda was tied | Edda (Bound Captive) |
| The yard | | The open ground | The waystation's cleared yard | Mud, mist, dead trees | One goblin by the door |
| The Naming Stone | The flat stone | (6.0, 12.5) | Where the road's dead were named | Smooth, with three new names | None |
| The Rotted Grain Crate | The relief crate; the dry box | (-4.2, 2.2) | Crown relief grain, S.3 | Joss Sefton's dry box | Two timber, iron scrap, leather greaves |
| The Spore Hollow | Sallow Bottom | Around (-20, -2.5) | Withy ground, then the lime pit | Spore ground | Spore-Choked Cart; three husks |
| The Spore-Choked Cart | The Wenlock cart | (-22.5, -1.5) | The Watchhouse's gift to a turned-away household | Untouched | Fresh torch, lamp oil, bandage |
| The Old Quarry | The Causeway Delph | (15.5, -14.5) | The Crown's road quarry and lime kiln | The troll's ground | The Blind Quarry-Troll |
| The North-West Feeding Ground | The Long Stable | (-13.5, -11.5) | The couriers' stable | An ogre's feeding ground | Gnawed Bone Heap; the Blackfen Ogre |
| The Gnawed Bone Heap | | (-15.0, -13.0) | The S.2 horses' bones, built on | The ogre's heap | Cooking pot, kettle hat, two iron scrap |
| The East Choke Point | The Fen Gate | (12 to 15.5, 5.5 to 12.4) | The toll arch, then the Watch's barricade (S.4) | The Saltlick Pack's den | Ork Plunder Pile; two orks |
| The Ork Plunder Pile | The den hoard | (13.2, 12.4) | | Tower and road plunder | Broadaxe, hauberk, lamp oil, bandage |
| The Causeway tower | | Off the map, east | The Watch's road tower | An ork den, its door blocked | The rest of the pack |

---

## New names

New in this file. All proposed; grepped against `docs/worldbuilding/` before use, with no clashes
found.

**People (all human, all dead, departed or historical):**

- **Osric Tarrant**: the last Crown warden of the Watchhouse; rode south with its books in S.3.
- **Sergeant Wystan Garrow**: the last commander of the Causeway Watch; lost at the tower, S.29.
- **Joss Sefton**: the Watchhouse's carter; went east in autumn S.29 and did not return; his greaves
  are in the Rotted Grain Crate.
- **Colm Prewett**: a Watchman; died at the Long Stable in autumn S.29; his kettle hat is on the bone
  heap.
- **The Wenlocks**, and **Tamsin Wenlock**: the coughing household turned away in autumn S.29 and
  given the cart.

**Places and things:**

- **The Outside Fire** (the shelter fire's old name) · **the doorstep due** (a rag and a stick owed
  to the turned-away) · **fire for your dead** (the torch and oil given to the coughing turned away)
- **The Fen End Station** (the Crown's name for the Watchhouse) · **the King's wayfarers** (the
  Crown's mounted couriers, behind the Watchhouse's name)
- **The Counting Passage** (the entry hall) · **the hall spear** · **the Assize Ring** and **the cold
  corner** (Edda's corner) · **the wayfarers' room**, **the tally room**, **the strong corner** (the
  Watchhouse's former rooms)
- **The Naming Stone** (the flat boulder on the road) · **the relief crates** and **the dry box**
- **Sallow Bottom** (the Spore Hollow's old name) and its **lime pit**
- **The Causeway Delph** (the Old Quarry's old name) and its kiln
- **The Long Stable** (the North-West Feeding Ground's ruin)
- **The Fen Gate** (the Watch's barricade at the East Choke Point), its **cross wall** and **screen
  wall**
- **The Saltlick Pack** (the survivors' name for the orks that took the Causeway tower and hold the
  Fen Gate; a human-given name for a pack of beasts, not a name they have)
