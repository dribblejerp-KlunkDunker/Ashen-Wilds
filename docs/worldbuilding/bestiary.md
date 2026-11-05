# The Blackfen Bestiary

Compiled 2026-11-04, revised 2026-11-05. Proposed lore, not implemented game systems; see *Status of this document* below. A live, editable copy is kept as a Claude Doc.

Every creature a survivor can meet in the Ashen Wilds, from the goblins at the Watchhouse to the thing the orks fled: what it is, what it eats, where it sleeps, and what no one knows yet.

## How to read this ledger

This is the Watchhouse's warning book: what carriers, cutters and survivors have reported about the things that kill people in the Blackfen, with the reports kept apart from the guesses. It is written in the voice of the people who keep it, not by anyone who knows the truth of the Vaults.

The book follows the habit of the Roofed Mile board: say what happened, say what you do not know, and write down the dead. Nobody who contributed to it has seen the bottom of the Deep-Seam Vaults. Nobody has explained what the orks fled. Where an entry offers an explanation, it is marked as a guess.

The book keeps one rule above the others: **only people are people.** Everything in these pages is an animal, a lizard, a fish or a monster. Some are cunning, some carry what they took from the dead, some hunt in packs. None of them speaks, bargains, keeps faith or answers to a name, and nobody in the book has reasoned with one and lived by it.

### Status of this document

Everything here is **proposed lore**, in line with the rest of `docs/worldbuilding/`. Putting it in the repo does not make it canon. Each entry carries one of three tags:

| Tag | Meaning |
| --- | --- |
| **In play (Godot)** | The creature exists in the Godot `Ashen-Wilds` build; sizes and behaviour below match its collision and AI numbers |
| **In play (browser)** | It stands behind the browser build's generic Ashbound enemy |
| **Proposed** | New in this ledger; nothing implemented |

Revised 2026-11-05 for owner decision O1 (only humans are people); the original is in git history at commit fd60061. The Claude Doc copy predates this revision.

### Inside each entry

- **Measures**: standing height, weight, and lifespan where anyone can say. Metres and kilograms, as the game uses.
- **Body**: what it is made of and how it works.
- **Senses**: sight, hearing and smell, rated for the perception work in R5.
- **Habitat and lair**: by the generator's land types (fen, marsh, reedbed, farmland, birch wood, upland, quarry, mere, crags) and site types.
- **Sleep, diet and temperament**: when it rests, what it eats first, what it will eat when hungry, and how it behaves.
- **Signs**: what a careful survivor notices before the meeting.
- **What we know** and **what no one knows**: the reports, then the open questions. The open questions are the lore hooks.
- **For the game**: one or two lines for whoever builds it.

### Threat tiers

| Tier | Watchhouse word | Meaning |
| --- | --- | --- |
| I | Nuisance | Costs you food, metal or sleep, rarely a life |
| II | Danger | Can kill one careless person |
| III | Killer | Will kill a prepared person who fights it fairly |
| IV | Leave | Nobody in the book has fought one and been sure they won |

## The ecology of the Smothering

Thirty years in, the Blackfen's dangers come from three causes: what climbed out of the Vaults, what the ash did to ordinary animals, and what the dead left lying.

### Three causes

1. **The breach.** When the Highland Citadels cut into the Deep-Seam Vaults for slag-iron, the upper dark emptied. Goblin swarms, ork packs and the large things came up the mine roads and down the Bell Road. The spores came with them. This is why danger thickens to the north and in the uplands.
2. **The ash.** Grazing failed in the first winters. Flocks were abandoned, then went wild. Lords who fled south left their kennels. Within ten years the farm animals of the fen had become its predators and pests.
3. **The dead.** Burial overwhelmed the parishes (see *The Keeping and the Merewick Register*). Bodies lay in common pits, drains and sheepfolds. Carrion-eaters multiplied on them, and the spore-growths rooted in them. Much of what hunts the Blackfen today first learned the taste of people from the unburied.

### Why roads are safer

The book's rule of thumb matches what every carrier sees: the maintained road is the safest ground, deep fen and ruins the worst. Roads carry people, fire and noise, and most beasts learned to keep off them. Ruins offer roofs, and anything that wants a roof competes for them. That is why the toll house always has someone in it.

| Ground | Usual danger | Why |
| --- | --- | --- |
| Watchhouse grounds, passing places | Low | Fires, people, cleared sightlines |
| Maintained road, farmland | Low to middling | Open ground, fewer lairs; Greymaw follow carts |
| Birch wood, mere edge | Middling | Cover for packs; herons nest by water |
| Marsh, reedbed, deep fen | High far out | Bloodwicks, spore ground, Ashbound sleep here |
| Ruins (farmsteads, quarry sheds, toll house) | High | Roofs are lairs |
| Quarry, upland, crags | High | Troll ground; the Roofed Mile beast's country |

### Who eats whom

```text
Below: what the orks fled            (eats: unknown)
   ^ fled from
Blackfen Ogre · Blind Quarry-Troll · Roofed Mile animal
   ^ eaten by
People · goblins · orks · the Ashbound
   ^ eaten by
Greymaw · Gallows Herons · Harrow eels · Bloodwicks
   ^ eaten by
Peat-boar · Ash-rats · Ash-moths · Rustlings
   ^ eaten by
The dead, the stores, roots and iron
```

People, goblins and orks sit in the middle together: all three hunt boar, eels and rats, goblins and orks hunt people, and everything above them hunts all three.

## At a glance

Seventeen entries, from beetles to the thing below. Senses run none, poor, fair, keen, acute; heights are standing height unless marked.

| Creature | Tier | Height (m) | Weight (kg) | Sight | Hearing | Smell | Usual ground | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Goblin (a swarming beast) | I alone, II in a group | 1.20–1.40 | 28–40 | Keen, good in dark | Keen | Fair | Nests: drains, glasshouse ranges, culverts | In play (Godot) |
| Ork (a pack beast) | III | 1.80–2.05 | 110–150 | Fair | Keen | Keen | Stone dens, road choke points | In play (Godot) |
| Blackfen Ogre | IV | 2.90–3.20 | 600–800 | Poor | Fair | Acute | Fen edge, farmland, its feeding ground | In play (Godot) |
| Blind Quarry-Troll | IV | 2.60 hunched (3.3 upright) | 900–1,200 | None | Acute | Poor | Quarry, lime cuts, crags | In play (Godot) |
| The Roofed Mile animal | III | 0.9–1.1 at shoulder | 150–250 | Fair | Keen | Keen | Galleries, culverts, upland | Proposed (from the story) |
| Greymaw (wild dogs) | II, III as a pack | 0.60–0.80 at shoulder | 30–45 | Fair | Keen | Acute | Farmland, birch wood, road verges | Proposed |
| Peat-boar | II | 0.80–0.95 at shoulder | 90–160 | Poor | Fair | Acute | Reedbed, fen edge, farmland | Proposed |
| Gallows Heron | I (it calls others) | 1.20 | 1.5–2.5 | Acute | Fair | Poor | Mere, river, dead trees | Proposed |
| Harrow eel | II in water | 1.0–1.6 long | 4–9 | Poor | Fair | Keen | Mere, flooded rooms, sluices | Proposed |
| Bloodwick (leech) | I, II in numbers | 0.15–0.40 long | 0.05–0.30 | None | Poor | Keen (warmth) | Marsh, reedbed, standing water | Proposed |
| Ash-rat | I | 0.25–0.40 with tail | 0.3–0.6 | Poor | Keen | Acute | Drains, granaries, stores | Proposed |
| Rustling (iron beetle) | I | 0.04–0.06 long | 0.015 | Poor | Poor | Keen (iron) | Scrap piles, hinges, nail kegs | Proposed |
| Ash-moth | I | 0.10–0.14 wingspan | 0.002 | Fair (light) | Poor | Fair | Anywhere a flame burns | Proposed |
| The Ashbound (people) | II | 1.50–1.85 | 45–70 | Poor | Fair | Poor | Deep fen, reedbed, ruins | In play (browser) |
| Corpse-cap (growth) | I, II if breathed | 0.10–0.30 | — | — | — | — | Unburied dead, pits, folds | Proposed |
| Walking bloom (Ash-Spore Husk) | II, worse in still air | 1.50–1.85 (1.78 in Godot) | 40–60 | Poor | Poor | — | Hollows, pits, still low ground | In play (Godot) |
| What the orks fled | Unknown | Unknown | Unknown | Unknown | Said to be acute | Unknown | Below the Vaults, they say | Proposed (unexplained by design) |

Godot heights come from collision capsules: goblin 1.35 m, ork 1.92 m, ogre 2.95 m tall and 1.70 m across the shoulders, troll 2.60 m and 1.60 m across, husk 1.78 m. Weights are the book's estimates; nobody has a scale that big.

## Goblins

**A beast, not a people. Tier I alone, II in a group. In play (Godot: the Goblin Scavenger).**

Goblins are swarming scavengers that came up out of the Vaults and never stopped breeding in the drains. They are cunning the way rats and crows are cunning: they learn a door, a habit, a careless hour. They carry knives and throw stones they took from the dead. They have no bargains, no kin, no households and no names, and a survivor who treats one as anything but a hungry animal is the next thing it strips. "Goblin" is a Citadel miner's word for them.

### Measures

|  |  |
| --- | --- |
| Height | 1.20–1.40 m; even the broad ones are small beside an adult human |
| Weight | 28–40 kg |
| Lifespan | Unknown. Grey-muzzled, stiff-jointed goblins are seen in every nest; the book guesses they live long for their size |
| Speed | Faster than a walking human over a few strides (a dart near 5.6 m/s), poor over distance |

### Body

Narrow-built, long in the fingers and forearm, with large mobile ears that fold when damaged and stay folded. The skin runs grey to grey-green and takes ash so well that a goblin lying still in a drain is hard to see. Eyes are large and shine back torchlight.

They are frail for their quickness. Bones break in falls that would only bruise a human; a goblin with a bad hip is common, and it still hunts. Their blood is slow to clot, so a goblin cut bleeds long, which is why they avoid a straight fight and go for a hand, an ankle or a pack instead.

### Senses

- **Sight**: keen, and much better than a human's in dim light. They see a torch from very far and prefer to hunt by ash-light.
- **Hearing**: keen. They hear footsteps, rummaging and a pack's clatter from a long way off.
- **Smell**: fair. Good enough for food stores, not for tracking.

### Habitat and lair

Nests in low, enclosed, many-exited places: drains, maintenance trenches, glasshouse ranges, slaughter-quarter culverts (Coldbarrow), the undersides of benches and bridges. Outbuildings over houses. A nest is always backed against a standing wall, the way rats den against a foundation.

A goblin nest from the outside looks abandoned. Closer, the debris has been dragged about, some gaps are worn clear by traffic, and loose bright metal lies heaped and scattered round the entrances. Goblins hoard bright scraps (buckles, nails, coins, a spoon) and drag them back to the nest. The scatter works as an alarm, whether or not they mean it to: a careless foot finds it before it finds the nest.

### Sleep

By day, heaped together, with a few always stirring. Nests are low and lined with stolen cloth and rags, and the sleepers lie off the runs, never across a way out, so a nest empties in a breath when disturbed. The strongest take the driest place, and there is always squabbling over it.

### Diet

- **First choice**: fat, marrow, salt, eggs, anything cooked.
- **Will eat**: rats, birds, insects, roots, scraps, stolen bread, the dead.
- **Whether they eat people**: the book has no sure report of goblins killing a person to eat. Rumours say otherwise, and bodies found near nests are always stripped. Treat the rumours as rumours.

A nest cannot feed itself where it sits. Every meal means leaving cover, which is when goblins and people meet.

### Temperament

Opportunists by nature. A goblin circles out of reach, waits for a turned back, a swing's recovery, a search or a stumble, then darts in and skitters away. Several will worry one person from all sides rather than one face them. **Cornered, a goblin becomes much more dangerous.** A swarm drags back its wounded, as rats do; nobody in the book is sure whether it is to save them or to eat them.

Food left out does not buy them off. It teaches them where food is.

### Signs

Disturbed soil, fresh refuse, missing small metal, narrow worn runs through walls, rags dragged into broken frames, a heap of bright scraps by a covered gap. Thrown stones from 5–11 m mean a goblin is retreating, not giving up.

### What we know

- They came up from the Vaults in the first years in swarms. The "goblin hordes" of the first winter were many nests fleeing at once.
- They learn. A goblin that has watched a sentry for a few nights knows when he turns.
- They strip metal and leather from the dead with quick, clever hands, and use what they find (a knife, a cudgel, a stone) as weapons. They make nothing.

### What no one knows

- **Where goblin young are.** No nursery nest has ever been found; every nest the book has cleared held only grown beasts. Either they hide their young very well, or something about how goblins breed is not known to anyone above ground.
- Why they hoard bright metal. The book's guess is the smell of the dead it came off.
- Whether they lived in the upper Vaults before the breach or fled up from deeper.

### For the game

The Godot Scavenger's opportunist AI is right. For the browser build, goblin nests are a site type for ruins and drains: noise traps of loose metal around containers, and a hoard of bright scraps as a rich container. R5 should let a goblin flee and come back with others.

## Orks

**A beast in packs. Tier III. In play (Godot: the Ork Vanguard, shield and cleaver).**

Orks came out of the Vaults in packs running from something below; the first winter called them war-clans. They are large, heavy, drilled beasts: a pack keeps its order by dominance, as wolves do, and moves and fights as one. They carry shields and cleavers taken from the Watch and the Citadels' dead, which they cannot make and do not mend. One pack holds the Old Causeway choke point. Another dens in the rear range of Saint Vey's Fold.

### Measures

|  |  |
| --- | --- |
| Height | 1.80–2.05 m |
| Weight | 110–150 kg |
| Lifespan | Unknown. Old orks, scarred and grey about the jaw, lead every pack the book has seen; nobody knows their age |
| Speed | A walking pace matched to a human's; the reckless ones run faster than you walk |

### Body

Heavy-boned and deep-chested, with thick hide over the shoulders and forearms that turns a glancing cut. The jaw is wide, with heavy lower teeth. Skin runs grey to ash-brown. Hands are broad and strong, good for gripping a stolen haft and useless for making one: a cracked shield is carried until it falls apart.

They tire slower than people and heal clean. They feel cold badly, which is why salt and dry stone matter so much to them.

### Senses

- **Sight**: fair, about a human's.
- **Hearing**: keen. An ork den goes quiet before you see it.
- **Smell**: keen. Orks smell a cooking fire, a wound and a stranger's pack.

### Habitat and lair

Dens in stone with one way in: hospice ranges, sheepfold walls, toll houses, chapels. A pack drags rubble, carts and timber into its other openings until only one is left, the way a badger blocks a sett. A road-holding pack heaps the same across a choke point, and keeps a **plunder pile** behind it: a hoard of what it took off the road, salt and iron uppermost.

### Sleep

At night, in short sleeps of four or five hours, with one always awake, like a herd's sentry. Orks sleep under stone and pack rubble into their openings. At Saint Vey's Fold they den in the stone rear range and will not enter the timber-roofed front dormitory that human travellers use. **Nobody knows why.** It may be a smell, a danger they know of, or no reason at all.

### Diet

- **First choice**: meat, raw or the salted meat they steal, and fat.
- **Will eat**: roots, peat-boar, birds, fish, stolen bread.
- **Needs**: salt, far more than people do. Orks crave it like cattle at a lick: they raid salt stores, lick salt-bearing rock smooth and hoard what they take. A dead ork almost always has salt in its gut or its plunder.

### Temperament

Drilled. A pack ork on the road fights like a soldier: it advances behind a shield, opens with a slash and follows with a chop, and it will bash aside a guard held too long. The unshielded cleaver-carriers are the lower-ranked ones, driven at people first. In a cramped hall an ork's opening slash clangs off the walls; it has learned to chop overhead indoors.

Away from the road, a pack keeps to its den and lets nothing in. Salt left out draws a pack; it does not buy one off, and it teaches the pack where the salt came from.

### Quiet

*Proposed.* Orks make no calls near the hills. A pack that senses danger goes silent all at once, the way deer go silent when something hunts the wood, and a silent pack is the most dangerous kind. The book believes this is connected to what they fled. The listeners beneath the hills, a human movement who keep the same silences, do not explain it either.

### Signs

Rubble heaped across a road with a narrow gap. A plunder pile. Rubble packed into a doorway. Salt-rock licked smooth. Silence where there should be birds.

### What we know

- They fled up through the Vaults in packs and never went back down.
- They use the weapons and shields they took from the dead well. They cannot repair or make them.
- A pack is ranked: the biggest eats first, and the lowest are sent in first.
- Nothing offered to them changes what they do.

### What no one knows

- **What they fled.** This is the book's oldest open question (see *What the orks fled*).
- Why they will not den under timber at Saint Vey's Fold.
- Whether the road packs and the Fold den are one pack split, or rivals.

### For the game

The Godot Vanguard pair is right. In the browser build, ork dens belong at the toll house and on causeway choke points; salt can lure a pack off a road for a while, never pay it. Ork corpses: salt, scrap, lamp oil, sometimes splinted greaves stripped from the dead (already Godot's ork loot).

## The Blackfen Ogre

**Tier IV: leave. In play (Godot: the north-west feeding ground and the Gnawed Bone Heap).**

The ogre is the reason the Watchhouse doorway was never widened. It is a solitary, enormous eater that holds one feeding ground at a time and kills anything that stays on it.

### Measures

|  |  |
| --- | --- |
| Height | 2.90–3.20 m, stooped |
| Shoulders | 1.70 m across, too wide for a 1.35 m door |
| Weight | 600–800 kg |
| Lifespan | Unknown; the book has never seen a young one or an old one die of age |
| Speed | A slow shamble, but a head-down charge reaches 8.5 m/s over 5–11 m |

### Body

Long arms, short bowed legs and a body carried forward on the knuckles when it walks far. The hide is hairless, folded and grey, crusted with ash and old mud. The head sits low between the shoulders, so it turns its whole body to look. Its club is a stripped tree limb.

It has tremendous strength and very little control of it. Mid-swing, nothing short of a wall stops it. It feels pain late: an ogre wounded below about half its strength grows faster and angrier, not weaker.

### Senses

- **Sight**: poor. It sees movement, not detail.
- **Hearing**: fair.
- **Smell**: acute. It finds a cooking fire, a wound or a carcass from very far downwind. Most ogre deaths start with someone cooking.

### Habitat and lair

Open ground at the fen edge or on farmland, near water, with a single **feeding ground**: a trampled clearing ringed by a bone heap. It moves on when the ground is eaten out, every few years. It avoids buildings, gateways and close woods, because it cannot charge where its shoulders do not fit.

### Sleep

After a large meal, an ogre sleeps for two or three days on or beside its bone heap, in the open. Hungry, it barely sleeps at all. A sleeping ogre breathes loudly enough to be heard across the clearing; a quiet one is awake.

### Diet

- **First choice**: big meat. Peat-boar, sheep, pack animals, Greymaw, people.
- **Will eat**: carrion of any age, bone (it cracks them for marrow), the Ashbound.
- **Will not**: anything with spore-growth on it, as far as anyone has seen.

### The bone heap

The heap is not only bones. Ogres hoard the iron things that came with their meals, the way a magpie hoards bright things: cooking pots, kettle hats, buckles, chain. The book's guess is that they smell of food. Those who search the heap find the best salvage in the Blackfen and the clearest record of who went missing.

### Temperament

Relentless once it has noticed you, indifferent until then. It chases about twenty metres before giving up, but charges every few seconds while you are in its line. It is not cunning. It is enough.

### Signs

Snapped saplings at shoulder height. Ground pressed into wide, knuckled tracks. The smell of the heap, carried a long way on a wet wind. Herons standing patiently at the edge of a clearing.

### What we know

- Sidestep the charge and let it hit stone: it crashes and reels for about two seconds.
- It never follows into a doorway.
- It is an animal, and hungry. Nothing turns it but a wall.

### What no one knows

- **Why it hoards iron.** It makes nothing beyond a stripped club, yet it keeps every pot and buckle. The book argues about this every winter.
- Whether ogres came up from the Vaults, or were always in the high fen and simply grew bolder.
- How they breed. No one has seen two together.

### For the game

The Godot ogre is right. Its feeding ground is a natural generator site for open fen and farmland in the browser build (bone heap as a rich container, one guard, never near a road).

## The Blind Quarry-Troll

**Tier IV: leave. In play (Godot: the old quarry in the north-east corner, added 2026-11-04).**

A blind thing of the quarries that hunts by sound alone. Stand still and it cannot find you, even at arm's length. Make a noise and it comes to where the noise was and brings both fists down on that spot.

### Measures

|  |  |
| --- | --- |
| Height | 2.60 m hunched; about 3.3 m if it ever stood straight |
| Width | 1.60 m across the shoulders |
| Weight | 900–1,200 kg; it is denser than it looks |
| Lifespan | Unknown. Quarrymen at Rook's Stair say the same one has been there since before the Smothering |
| Speed | A lumber of 2.2–3.2 m/s, faster when hungry |

### Body

Huge forearms and fists, short thick legs, and a skull with no eyes worth the name: two shallow pits under a heavy brow. The hide is grey and crusted with stone dust and lime that it never sheds, so a resting troll looks like an outcrop. Under the crust the skin is soft and pale.

The ears are wide, folded flaps along the side of the head, and the whole skull seems built to catch sound. It listens with its body too: it feels a heavy footfall through the ground.

### Senses

- **Sight**: none.
- **Hearing**: acute. Rough reaches from the Godot build: a walk carries 6 m, a dodge 9 m, a shield taking a blow 10 m, a swing 12 m, a sprint 14 m, a blade clanging off stone 16 m. Through stone, sound carries at about half. Searching a container carries 5 m.
- **Smell**: poor. It does not find a still person by scent.

### Habitat and lair

Quarries, lime cuts, spoil heaps and crags: the quarry land type, Rook's Stair's lower terraces, the chalk cut behind the Split Kiln. It keeps to one patch of ground and walks back to it when it loses a sound.

### Sleep

Nobody can tell when it sleeps. It sits motionless for hours, and a motionless troll is not a sleeping one. Quarry folk say it rests most in cinder-squalls, when it cannot hear anything anyway.

### Diet

- **First choice**: whatever it has just pounded. Sheep, goats, people.
- **Will eat**: carrion; it gnaws salt-bearing rock and licks lime from kiln waste.
- **What it carries**: iron scrap, salt, a flask of oil, a rag, in its gut or caught in its crust. The book's guess is that these went down with its last meals.

### Temperament

Patient, then sudden. It listens, turns, lumbers to the spot, and pounds. Struck, it knows where you are and thrashes around itself. After a sound, it remembers for about six seconds, then forgets and goes home. It hears companions as well as you.

### Signs

Rings of shattered stone where it has pounded. An outcrop where there was none yesterday. Quarry folk who speak in whispers and walk on their toes. The Dead Calm, which quarrymen fear above all weathers.

### What we know

- **Keep still.** It cannot find you at arm's length.
- Creep out of the ring before the fists come down.
- A thrown stone draws it. Hit it, then step away.
- A soft-footed walker can pass it: the Gutter-kin, road waifs raised under the Roofed Mile, do it on a dare.

### What no one knows

- Whether it came up from the Vaults or was quarried out of the hill.
- Whether there is more than one, and whether trolls are kin to what the orks fled. Some say this is a lesser cousin of the thing below; there is no evidence either way.
- What it hunted before there were people to hear.

### For the game

The Godot troll is the model for R5's hearing work in the browser build: one noise table, wall muffling, short memory and a home leash. Quarry and crag chunks far out are its ground.

## Lesser Vault-born

Small things that came up with the slag-iron. They rarely kill anyone directly; they starve, blind and strip the people who do the dying.

### Rustlings

**Tier I. Proposed.** Iron-eating beetles from the Vault seams, and the real reason so much metal goes missing from ruins that people blame on goblins.

|  |  |
| --- | --- |
| Measures | 4–6 cm long, about 15 g; colonies of a few hundred to several thousand |
| Body | Flat, rust-brown carapace that flakes like scale. Grinding mouthparts lined with something harder than iron; nobody has found what |
| Senses | Poor sight and hearing; keen to iron and damp. They find a nail keg through a wall |
| Habitat | Scrap piles, hinges, nail kegs, the iron bands of carts and barrels, the Leaning Team's harness. Commonest in quarry sheds, smithies and Coldbarrow |
| Sleep | They go still in cold and dry air, and swarm in sleet and fog |
| Diet | Iron, wet. They leave steel slowest and copper alone, which is why carriers mend straps with copper wire |
| Temperament | None to speak of. They do not bite people unless trapped in clothing, and then it festers |
| Signs | Orange frass like rust-snuff, iron gone lacy, hinge plates that crumble in the hand |
| What we know | Tallow, wood ash and dry storage slow them. Fire kills a colony. Salt makes them worse |
| What no one knows | Whether they are why the Citadels found slag-iron where they did, or the reason the seams were rich at all |
| For the game | A slow condition loss on stored iron scrap and iron-bound containers in damp chunks; a reason to keep iron greased at the Watchhouse |

### Ash-moths

**Tier I, but they put out torches. Proposed.** Grey moths the size of a palm that came up in the first ashfalls and never left. Every survivor's saying about light is really about them: *a light means fuel, not safety.*

|  |  |
| --- | --- |
| Measures | 10–14 cm wingspan, about 2 g; swarms of hundreds in an ashfall |
| Body | Soft, thick-bodied, dusted with fine grey scale that sheds like ash. The dust makes people cough and stings the eyes |
| Senses | Drawn to flame and warmth from a long way; otherwise nearly blind and deaf |
| Habitat | Anywhere a fire burns. They rest by day under eaves, in chimney mouths and in the folds of hung cloth |
| Sleep | By day, clustered in grey drifts that look like ash until touched |
| Diet | The adults do not seem to eat. The grubs eat wool, felt and stored cloth |
| Temperament | Mindless. A swarm smothers a torch by sheer weight and dust, then disperses |
| Signs | A fire that dims for no reason, grey drifts under eaves, holes in stored wool |
| What we know | A shuttered lantern draws fewer than an open torch. Smoke from wet peat drives them off |
| What no one knows | Whether they carry the spores. Fen healers blame them; nobody has proven it |
| For the game | In ashfall, an open torch burns faster and can be put out by a swarm; a light seen from far draws moths first and something else after |

## Beasts of the Fen

Ordinary animals made dangerous by thirty years of ash, hunger and the dead. Nothing here is from the Vaults. All six are proposed.

### Greymaw

**Tier II alone, III as a pack.** Wild dogs descended from the kennels the lords left behind and the farm dogs nobody could feed. Ash has greyed them all the same colour.

|  |  |
| --- | --- |
| Measures | 0.60–0.80 m at the shoulder, 30–45 kg; packs of four to nine; live eight to ten years |
| Body | Long-legged hound stock gone rangy, coats matted grey, many with old collars grown into the neck |
| Senses | Fair sight, keen hearing, acute smell. They track blood and a wet pack for miles |
| Habitat | Farmland, birch wood and road verges; they follow carts at a distance and wait at passing places |
| Sleep | By day in drainage cuts, hedge banks and roofless farmsteads, packed together for warmth |
| Diet | Carrion and ash-rats first; sheep, peat-boar piglets, stragglers, the sick and the Ashbound when hungry |
| Temperament | Testers. They circle, feint and wait for the slowest. Most packs break off if one is badly hurt. Some still come to a whistle and a held-out hand, which is how people die |
| Signs | Tracks pacing a cart's, a howl answered from two directions, gnawed bones at a passing place |
| What we know | Fire and a wall at your back hold them. They respect a spear. They will not cross deep water |
| What no one knows | Whether some packs are still kept by someone. Carriers swear a few answer to whistles from no one they could see |
| For the game | The first pack enemy: low per-dog health, flanking, flee-on-loss. Spawns follow roads and react to bleeding |

### Peat-boar

**Tier II.** Pigs turned out of the farmsteads in the first winter, now wild and heavy in the reedbeds. The Boar-Lugged Spear exists because of them.

|  |  |
| --- | --- |
| Measures | 0.80–0.95 m at the shoulder, 90–160 kg; sows smaller with litters of six to ten |
| Body | Long-snouted, bristle-backed, tusks to 15 cm on old boars; hide caked in peat that works like armour |
| Senses | Poor sight, fair hearing, acute smell |
| Habitat | Reedbeds and fen edges by day, farmland at dusk; wallows near any standing water |
| Sleep | In wallows and reed nests through the middle of the day; awake at dusk and dawn |
| Diet | Roots, peat-moss, grubs, carrion, buried things. They dig up shallow graves |
| Temperament | Shy until cornered or with young; then a boar charges and keeps charging up the spear |
| Signs | Ploughed ground, mud rubbed high on trees, wallows, a sour reek |
| What we know | Lugged spears stop a charge. Pork keeps through the winter in salt |
| What no one knows | Whether boar that ate the dead carry the spores into the people who eat them |
| For the game | A charging animal with meat as loot; a reason to carry the spear in reed country |

### Gallows Herons

**Tier I, but they call everything else.** Grey herons that learned carrion from the common pits. They stand at the edge of every fight in the Blackfen and scream when anything is dying.

|  |  |
| --- | --- |
| Measures | 1.20 m tall, 1.8 m wingspan, 1.5–2.5 kg |
| Body | Tall, ash-grey, with a dagger bill that takes eyes first |
| Senses | Acute sight, fair hearing, poor smell |
| Habitat | Meres, rivers, flooded towns, and the dead trees they nest in; the White Trees on the Salt Trace are a rookery |
| Sleep | At night, standing in shallow water or roosting in dead trunks |
| Diet | Fish, frogs, ash-rats, eels; carrion and the soft parts of the dying |
| Temperament | Patient and unafraid of people. They do not attack the healthy. When anything bleeds, they cry out |
| Signs | Several herons standing still and facing one way |
| What we know | Their cry carries across a whole chunk. Greymaw and goblins both come to it |
| What no one knows | Whether they follow the Ashbound, or the Ashbound follow them |
| For the game | A noise source: a fight near herons is heard much farther; a cheap way to make R5's hearing matter |

### Harrow eels

**Tier II in water.** Eels grown huge in the flooded rooms of Low Harrow and the meres, fat on what drowned there.

|  |  |
| --- | --- |
| Measures | 1.0–1.6 m long, 4–9 kg; the largest reported was "as long as the boat" |
| Body | Thick, slime-black, with a grip like a vice and many small teeth set backward |
| Senses | Poor sight, fair hearing through the water, keen smell |
| Habitat | Flooded cellars, sluices, millponds, meres, drowned carts |
| Sleep | By day in mud and under sunk timbers; they feed at night |
| Diet | Fish, frogs, drowned things, ducklings, a wading ankle |
| Temperament | Hidden, then sudden. An eel bites and rolls, dragging a leg under |
| Signs | Still water with no fish at the surface, bones on a cellar step |
| What we know | Eels are good food, smoked. Low Harrow's boat owner leaves bait lines |
| What no one knows | Who keeps the maintained boat at Low Harrow, and why travellers never meet them |
| For the game | A hazard of water tiles in mere and flooded sites; a bleed and a stagger, never a chase |

### Bloodwicks

**Tier I, II in numbers.** Marsh leeches the length of a hand or a forearm.

|  |  |
| --- | --- |
| Measures | 15–40 cm long, 50–300 g when fed |
| Body | Soft, banded brown and grey, with a numbing bite and something in the mouth that stops blood clotting |
| Senses | None to speak of; they find warmth and movement in water |
| Habitat | Marsh, reedbed and any standing water deeper than an ankle |
| Sleep | They sink into the mud in hoarfrost and lie torpid through cold spells |
| Diet | Blood: people, boar, dogs, herons, goblins |
| Temperament | They do not chase. They wait where you will wade |
| Signs | Ripples moving against the wind, a bitter smell of mud |
| What we know | Salt or fire makes them drop. Pulling one off leaves the wound bleeding longer. Goblins never nest by standing water; their blood already clots badly, and a goblin that wades bleeds out |
| What no one knows | Why the largest ones gather where the Ashbound sleep |
| For the game | A bleed applied by wading marsh tiles, worse for anyone already bleeding; salt as a remedy |

### Ash-rats

**Tier I.** Brown rats, grey with ash, in numbers that have ended more households than any ogre.

|  |  |
| --- | --- |
| Measures | 25–40 cm with tail, 0.3–0.6 kg; colonies of dozens to hundreds |
| Body | Ordinary rat, ash-grey, bold |
| Senses | Poor sight, keen hearing, acute smell |
| Habitat | Drains, granaries, stores, sheds, the Watchhouse cellar, any common grave |
| Sleep | By day in nests in walls and under floors |
| Diet | Stored food above all: bread, grain, Salt Rations, tallow, leather |
| Temperament | Bold in numbers, quick to flee alone, vicious cornered |
| Signs | Droppings, gnawed sacks, a store that weighs less than it should |
| What we know | Cats, iron bins and hung stores help. A dead dog was found in a grain sack at the Last Gardens; rats had been at it. Nobody knows who put it there |
| What no one knows | Whether they spread the flux. Fen healers say yes |
| For the game | Slow loss of food in unguarded containers, worst in drains and farmland stores |

## The Ashbound and the spore-sick

**"Ashbound" is the fen's word for whatever came up with the ash and whatever the ash has taken.** It has two senses, and the book keeps them apart.

1. **The Vault-born beasts**: goblins, orks, ogres, trolls, everything in the first half of this book. When a carrier says "the Ashbound are on the causeway", this is usually what is meant. They go hooded and ragged: they strip cloth from the dead and drag it over themselves, the way some animals dress in what they find. Survivors guess it is against the light, or the cold, or to smell of people. Nobody knows; it is habit, not dress.
2. **A verdict on people**: anyone who has stopped answering. They will not speak, will not take help, and attack whoever comes close. Calling a person Ashbound is a verdict, not a description, and the book records who was called it and by whom.

The rest of this section is about the second sense: people.

### What the word covers in people

**In play (browser: every current enemy; Godot: the shared enemy body, the rags and hood every beast wears).** *Proposed as the R5 enemy identity.*

| Kind | How common | What it is | Tell |
| --- | --- | --- | --- |
| The far-gone sick | Most | People in the silent stage of ash-lung (below) | Grey crust on the face, a wet cough, no words |
| The starving and lost | Few | People mad with hunger or cold, sick or not | They still speak, sometimes, and may stop if fed |
| Bands who take the name | Few | Deserters and raiders who wear grey rags and use the word to frighten. They took Edda and left her bound in the Watchhouse | They carry rope, work together and loot |

Most Ashbound people a survivor meets are the first kind. The second and third are why the book insists on the word being a verdict: a hungry family on the causeway has been called Ashbound and turned away before.

### Ash-lung (the Coughing)

A sickness of the breath that the fen healers tie to the ash-spores from the Vaults. Some blame the ash alone, some hunger and damp. Nobody in the book has settled it. It is a sickness of people.

| Stage | Signs | How long |
| --- | --- | --- |
| 1. The grey cough | A dry cough that brings up grey; tiredness | Weeks to years; many never go further |
| 2. The crust | Grey scaling round the mouth, nose and eyes; fever at night; constant thirst | Months |
| 3. Silence | Speech stops. Recognition goes. The sick leave shelter for low, wet ground and attack anyone who comes near | Weeks; this is when people say *Ashbound* |
| 4. The bloom | Death, then corpse-caps fruiting from the body within days. In a few, the bloom roots before death (see *Walking blooms*) | — |

|  |  |
| --- | --- |
| Measures (the sick) | As people: 1.50–1.85 m, wasted to 45–70 kg |
| Senses | Poor sight (crusted eyes), fair hearing, poor smell |
| Habitat | Deep fen, reedbeds, marsh corners and ruins, far from roads and fires; they keep to one stretch of ground |
| Sleep | Curled in reeds or in the corner of a ruin, by day and night alike; they wake to footsteps |
| Diet | Almost none. They drink marsh water constantly and eat raw whatever they catch |
| Temperament | Still until approached, then a straight rush and a beating. They do not chase far, and an Ashbound left at the edge of its ground stands where it stopped |
| Signs | A cough in the reeds, flattened sleeping places, unburied dead nearby |
| What we know | Masks of wet cloth help the healthy. Lime and fire on the dead stop the bloom. The Watchhouse argues every winter about admitting coughing travellers |
| What no one knows | Whether stage 1 passes person to person. Whether anyone comes back from stage 3: two people in the book say they did. Why bloodwicks gather where they sleep |
| For the game | Today's 65-health Ashbound fits stage 3 exactly: idle, rush, confined to its chunk. R5 can add the cough as a sound cue and the bands as a separate, looting enemy |

**Beasts and the spores.** What the book knows is short. No one has seen a goblin, ork, ogre or troll cough grey, crust over or fall silent. Beasts walk through a spore cloud without choking. Corpse-caps fruit on dead beasts as readily as on dead people, and goblins from nests near the common pits come out dusted grey. Whether a beast can carry the spores to a person, on its hide or in its rags, nobody knows.

### Corpse-caps

**Tier I, II if breathed. Proposed.** The fruiting growth of the spores, rising from the unburied dead.

|  |  |
| --- | --- |
| Measures | Pale caps 10–30 cm tall on grey stalks, in clusters over a body |
| Body | A fungus, as far as anyone knows. Caps puff grey spores when stepped on or brushed |
| Habitat | Common pits, sheepfolds, drains, the Corpseway's verges, anywhere bodies lie unburied in damp |
| Diet | The dead. They do not grow on the healthy; in a few of the dying they root before death (walking blooms, below) |
| Signs | A sweet smell of mushrooms where there should be rot; white threads in the soil |
| What we know | This is why the Blackfen limes its dead. The Split Kiln's lime is worth as much for graves as for chimneys. Fire works but costs fuel nobody has |
| What no one knows | Whether breathing the puff begins ash-lung, or whether the sick only bloom because they were already dying of it |
| For the game | A hazard prop at unburied sites: a cough and a short sight loss if disturbed; lime as an item that clears it |

#### Walking blooms (the Ash-Spore Husk)

**Tier II, worse in still air. In play (Godot: three in the Spore Hollow on the yard's west edge, round the Spore-Choked Cart).** In a few of the sick the bloom roots **before the body has finished dying**, so the caps fruit in a body that still walks. Carriers call them **walking blooms** or husks. Whatever answered in them is gone; the book counts them with the dead.

|  |  |
| --- | --- |
| Measures | As people, wasted: 1.50–1.85 m (1.78 m in Godot); about as hard to put down as a starving man (55 health) |
| Senses | Poor. It sees about 8 m in a narrow wedge ahead (120 degrees) and hears a sprint or a swing at about 8 m; it remembers where you were for a few seconds (about 5) |
| Speed | A shamble of 1.9 m/s, slower than you walk |
| Attack | A clawing swipe at arm's reach (1.5 m) that drives spores in: a wound (16) and about 2 s of choking |
| The cloud | Every wound puffs spores (about 1.2 m across, 3 s). Death bursts the whole crop at once (about 2.4 m, 8 s): cut one down at arm's length and you stand in it. Inside, you choke: about 3 health a second (it will not kill you by itself, but it leaves you at the edge), stamina barely returns, and sight closes in |
| What we know | **Fire burns spores**: a lit torch held within about 2 m of a cloud's edge eats it ten times faster, in about a second. Still air keeps a cloud hanging, wind and sleet clear it. By the Godot numbers a cloud lasts x1.6 in the Dead Calm, x1.3 in miasma fog, x1.0 in ashfall, x0.9 in hoarfrost, x0.6 in sleet and x0.4 in a cinder-squall. Beasts breathe the cloud without harm |
| What no one knows | How long a walking bloom lasts before it falls. Whether the dying feel it root. Why so few of the silent bloom early and the rest wait for death |
| For the game | In play as it stands. A torch-first fight: burn the cloud, step back from the burst, never finish one in the Dead Calm |

## Things the book cannot name

Two entries with more questions than answers. The first is one animal, seen once, by three people. The second has never been seen by anyone in the book.

### The Roofed Mile animal

**Tier III. Unidentified.** Recorded from *The third arch*: Annet, Pell and Renn met it in the avalanche gallery on the Bell Road. The board they sent to the Watchhouse reads: *ROOFED MILE. Occupied. DO NOT ENTER FOR SHELTER.* The archive keeps it unidentified, and so does this book; carriers have started calling it **the gallery-crawler**, a name, not a species.

|  |  |
| --- | --- |
| Measures (estimated from the account) | About 2.0–2.4 m long, 0.9–1.1 m at the shoulder; reached a climber's boot on the masonry, so about 2.5 m rearing; heavy enough to wrench a laden handcart, so perhaps 150–250 kg |
| Body (witnessed) | Pale and nearly hairless; forelegs too heavy for the rest of it, thick through the joints; hindquarters crouched low; a head that turned toward Renn without the body turning; clicking claws; a wet nose |
| Senses (witnessed) | It turned to the sound of a hammer struck on a pier. It found people behind stone by breath and smell. It saw well enough to drop on a climber |
| Habitat | The gap where the gallery roof meets the hillside. Its kind of place: roofed galleries, culverts, avalanche shelters, drainage cuts in upland country |
| Sleep | Unknown. It was in the roof space by day |
| Diet (witnessed) | Sheep dragged uphill, a pack animal, a carrier. It eats the hindquarters first and caches the rest between the piers |
| Temperament | Not a rusher. It moved sideways to get the cart out from between itself and Pell. It waited behind stone for Annet to step out, the way a cat waits at a hole |
| Signs | Drag marks across the road from the downhill verge, a tuft of wool on a stone, grease streaked high on a wall, strips of hide in cracks, a clean floor where ash should lie |
| What we know | Lime in the air drove it back coughing. Fire made it cry out and withdraw. Keeping a pier between you and it bought time |
| What no one knows | Whether it survived the fire: the next dawn something walked slowly on the road above the drainage cut, paused, and dragged something over stone. Whether there are others. Whether it came up from the Vaults. The name of the man beyond the fifth pier, and who was missing a carrier with a copper repair on his saddle strap |
| For the game | A single authored encounter at the Roofed Mile anchor, not a spawn type: an ambush from above, lime and fire as the counters, a detour that costs a day |

### What the orks fled

**Tier unknown. Unexplained by design.** The premise says the ork war-clans, as the first winter called the packs, came up out of the Vaults fleeing *something deeper*. They fled it as animals flee a fire. The archive keeps it unexplained, and so does this book. There are no measures here because no one has any.

**What people call it.** The listeners beneath the hills call it *the Hush*, and avoid even that. Citadel miners said *the Tenant*. Most Blackfen folk just say *below*.

**What is actually known.**

- The orks fled it in packs and never went back.
- Orks and the listeners keep the same silences near the hills: the orks as frightened animals do, the listeners with no bells, no drums and little speech.
- Old Edrin at the Bell-Tender's House keeps his bell's tongue wrapped and sends a runner instead, "because noise reaches unwanted listeners".
- The Dead Calm, when nothing falls and everything is heard, frightens orks more than any other weather.

**What people guess.** *Every one of these is a guess, and the book will not choose.*

- It hunts by sound, and the Blind Quarry-Troll is a small cousin of it.
- There is nothing down there but heat and collapse, and the orks fled the earth itself.
- The orks fled a bigger pack of their own kind, and *below* is a territory they lost.
- It is still coming up, slowly, and the Smothering is its weather.

**For the game.** Keep it off-screen. Let its evidence accumulate: silences, wrapped bells, dens the orks will not enter, and a Dead Calm that makes everything else hunt harder.

## Weather and the bestiary

The Smothering's six weathers decide who is hunting. The first column's numbers are the Godot build's; the browser build has no weather yet (R7), so this table is its brief.

| Weather | What changes | Comes out | Goes to ground |
| --- | --- | --- | --- |
| **Ashfall** (the ordinary night) | Normal sight and hearing in the dark | Ash-moths in swarms; goblins hunting by ash-light; Greymaw on the roads | Herons |
| **Miasma fog** | Sight closes to about 7 m; sounds die; spore clouds hang longer (x1.3) | Ashbound wander off their ground; Greymaw close in by smell; Rustlings swarm in the damp | Ogre (it cannot find a fire's smell in still fog) |
| **Sleet** | Torches burn about ×1.8 faster; ground is grease, 85% speed; spore clouds clear quickly (x0.6) | Bloodwicks in the overflowing water; Harrow eels in the shallows; ash-rats into stores | Ash-moths; goblins, who feel the cold badly |
| **Cinder-squall** | Embers on the wind; nothing heard over it; torches fan; spore clouds blow away (x0.4) | Ork road-packs move under it; Peat-boar driven out of burning reed | The Quarry-Troll (deaf, it rests); herons |
| **Hoarfrost** | Hard bright moon; sound carries ×1.25; ice, 80% speed | Greymaw hunting by moon; Gallows Herons see far; the Roofed Mile animal on the road | Bloodwicks (torpid in the mud); Ashbound curled against the cold |
| **Dead Calm** | Nothing falls; everything is heard by everyone, ×1.6; spore clouds hang longest (x1.6) | The Quarry-Troll at its deadliest; the Ogre hears what it usually smells | Orks, who go utterly silent; the listeners stop speaking at all. Some say something else comes out |

Hearing cuts both ways: what muffles a goblin's footsteps muffles yours.

## Sayings, open questions and the next work

### What survivors say

*Proposed.* Repeated at the Watchhouse fire; some are useful, some are wrong.

- *A light means fuel, not safety.* (Ash-moths, the Ogre's nose.)
- *Stand still and be stone.* (The Quarry-Troll.)
- *Never sleep across a door.* (Learned from goblin nests.)
- *Lime the dead or meet them.* (Corpse-caps.)
- *Never feed what follows you.* (Goblins, orks and Greymaw alike: food only teaches them the way back.)
- *A heron that's waiting knows something you don't.*
- *Ashbound is what you call someone after you've stopped helping them.*
- *When the wind stops, so do you.* (The Dead Calm.)

### Open questions

Each is a hook for a story or a site, not a mystery the book expects to solve.

1. What the orks fled, and whether it is still coming up.
2. Where goblin young are.
3. Why ogres hoard iron.
4. Whether ash-lung is catching, whether anyone returns from silence, and whether beasts carry it.
5. Whether the Roofed Mile animal survived the fire, and whether it has kin.
6. **The Hanging Shed at Rook's Stair.** Its ropes descend into fog, its machinery is serviceable, and no resident claims to have repaired it. The book lists it here only because people keep asking what uses it. Mystery is not automatically supernatural: the likeliest answer is a person nobody wants to name.
7. Who whistles to the Greymaw.
8. Who keeps the boat at Low Harrow.
9. Why the Saint Vey's Fold orks will not den under timber.

### For R5 (perception and enemy identity)

What this ledger proposes for the browser build, in the order it would pay off:

- [ ] Give the Ashbound their identity: stage-three ash-lung, with a cough as a sound cue, idle on their ground, rush, no long chase (matches today's 65-health enemy).
- [ ] Port the Godot troll's noise table as the shared hearing model: walk 6 m, dodge 9 m, block 10 m, swing 12 m, sprint 14 m, clang 16 m, search 5 m, stone at about half.
- [ ] Add Gallows Herons as a noise amplifier near water and Greymaw packs on roads as the first group enemy.
- [ ] Add goblin nests and ork dens as sites: loose-metal noise traps and a hoard to rob at a nest, a plunder pile behind a single way in at a den, salt as a lure that draws a pack away for a while.
- [ ] Keep the Roofed Mile animal and the Hanging Shed as authored anchors, never spawn types.
- [ ] Keep what the orks fled off-screen.
