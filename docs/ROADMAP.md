# Ashen Wilds — Roadmap

Milestones 1–5 shipped the combat core, three enemy archetypes, scavenging and equipment, wall deflection and weapon lodging. This roadmap runs the four candidates from the design document as Milestones 6–9. Each one builds on the one before it.

> The design document isn't in the repo. Specifics marked *(proposed)* are first-pass numbers for playtesting. Check them against the design doc.

| # | Milestone | Status | Depends on |
|---|---|---|---|
| 6 | Cramped for everyone: enemy wall clangs | ✅ shipped | M5 deflection |
| 7 | Survivor backgrounds | ✅ shipped | M4 inventory |
| 8 | Acoustic ripples & vision cone | ✅ shipped | M6 (clangs are loud), M7 (cough flaw) |
| 9 | Weather & atmosphere | ✅ shipped | M8 (weather scales sight & hearing) |
| 10 | Enemy ears | ✅ shipped | M8 acoustic field |
| 11 | The Blind Quarry-Troll | ✅ shipped | M10 |
| 12 | Armor slots | ✅ shipped | M4 inventory, M10 (armor is noisy) |
| 13 | Act I objectives & the shelter | ✅ shipped | M4 loot, M7 |
| 14 | Save & load | ✅ shipped | everything above |
| 15 | Blackfen Bestiary I: Carrion Crows & the Ghoul | ✅ shipped | M8, M10 |
| 16 | Blackfen Bestiary II: Bog Bear & Rot Mounds | ✅ shipped | M4 torch, M10 |
| 17 | Survival: cold & hunger | ✅ shipped | M9 weather, M4 items |
| 18 | Shelter crafting & repairs | ✅ shipped | M17, M13 stash |
| 19 | Day & night | ✅ shipped | M9, M17 |
| 20 | Blackfen Bestiary III: Bog-Bull, Skull-Deer & the Crows' Roost | ✅ shipped | M15, M19 |
| 21 | Blackfen Bestiary IV: fungus zombies, the Rot-Beast & the Pallid Crawler | ✅ shipped | M16, M19 |
| — | Companions, Acts II–III | later | design doc; consider Fable for companion AI |

---

## Milestone 6 — Cramped for everyone

Enemy swings use the same arc check as the survivor's. The entry hall is now a tactical choice, not a safe room.

- **Shared swing geometry.** `SwingGeometry.sweep_obstruction()` (and the spark burst) moves out of `PlayerController` so every attacker uses one implementation.
- **Per-attack stroke types** *(proposed)*:
  | Attacker | Stroke | Clangs? |
  |---|---|---|
  | Goblin Scavenger | hooked-knife stab | never — goblins are tunnel fighters |
  | Ork combo 1 | horizontal cleaver sweep (110°) | yes |
  | Ork combo 2 | overhead chop | never |
  | Ogre sweep | club sweep (150°) | yes |
  | Ogre slam | overhead slam | never |
- **Enemy clang = punish window.** No damage, sparks, a ring, the attack token is released, and the enemy is open for 0.7–1.1 s. Clanged enemies count as staggered, so heavy blows can lodge.
- **Ork discipline.** The shielded Vanguard reads the walls: when cramped, it opens with the overhead chop. The unshielded cleaver Ork swings anyway.

## Milestone 7 — Survivor backgrounds

Eight starting survivors, each with a loadout, one **trait** and one **permanent flaw**. You pick one on a start screen; respawns keep it.

| Survivor | Loadout | Trait | Flaw |
|---|---|---|---|
| Citadel Deserter | arming sword, wooden targe, torch, 2 bandages | **Shield Drill**: blocking costs 25% less stamina | **Bad Knee**: sprint 12% slower |
| Peat-Cutter | worn broadaxe, torch, timber | **Strong Back**: +5 kg carry capacity | **Bog Lung**: −15 max stamina |
| Boar Hunter | boar spear, torch, bandage | **Light Step**: walking is 40% quieter | **Old Goring**: −20 max health |
| Hedge Surgeon | worn sword, 5 bandages, salt | **Steady Hands**: bandage 45% faster, heals more | **Frail**: −10 max poise |
| Ferryman's Widow | sword, torch, lamp oil, bandage | **Fire-Keeper**: torch burns 40% slower | **Grief-Worn**: stamina regenerates 15% slower |
| Vault Runaway | broadaxe, bandage | **Tunnel-Born**: clangs cost normal wear, recoil halved | **Ash-Lung**: coughs every so often, and enemies hear it |
| Salt-Smuggler | sword, targe, 3 salt | **Light Fingers**: search 35% faster | **Shaking Hands**: equip swaps 50% slower |
| Disgraced Squire | sword, targe, bandage | **Tourney Poise**: +12 max poise | **Soft Grip**: weapons wear 50% faster |

*(All proposed. The design doc's roster replaces this table.)*

## Milestone 8 — Acoustic ripples & vision cone

- **130° vision cone** along your aim. Enemies outside it (or behind walls) aren't drawn. Within 1.6 m you still sense them.
- **Charcoal memory map.** Outside the cone the world is drawn as a desaturated charcoal sketch, but only where you've already looked. Unexplored ground stays black. A screen-space pass reconstructs world positions from depth and samples an exploration grid that rays from the cone fill in.
- **Acoustic ripples.** Every noise (footsteps by gait and body size, swings, clangs, roars, slams, coughs) goes to a shared `AcousticField`. Noises from sources you can't see draw a dust-ring ripple at the source, sized by loudness and drawn over walls.

## Milestone 9 — Weather & atmosphere

One `WeatherSystem` holds the current weather. It cycles every few minutes with smooth transitions (dev key **F4** advances it). Each state scales **sight** (fog, cone and enemy sight range), **hearing** (enemy hearing and ripple reach), **fire** (torch fuel and light) and **footing** (traction, sprint, dodge cost). Precipitation is CPU-animated mesh flakes, not particles, so it renders in software-Vulkan screenshots. Interiors shelter you from fire and footing effects.

| Weather | Sight | Hearing | Fire | Footing / other |
|---|---|---|---|---|
| Overcast (baseline) | — | — | — | — |
| Ashfall | grey haze, sight −25% | muffled ×0.8 | — | — |
| Miasma Fog | thick green fog, sight −50% | — | — | stamina regen −25% |
| Sleet | sight −15% | sleet hiss masks noise ×0.7 | torch burns 2× | slick: sprint −10%, dodge +4 stamina |
| Cinder-Squall | flickering embers | wind roar ×0.6 | torch flares (+30% light) | ember gusts shove you outdoors |
| Hoarfrost | crisp, sight +15% | cold air carries ×1.25 | torch −20% light | icy: low traction, you slide |
| Dead Calm | — | silence carries ×1.6 | torch burns 0.8× | — |

*(Multipliers proposed.)*

---

## Milestone 10 — Enemy ears

Enemies stop polling the survivor's state and listen to the `AcousticField` instead, so sight and sound share one model and weather affects both.

- **The survivor reports real noises:** footsteps (walk 3.5 m, sprint 9 m, ×1.35 when burdened, Light Step ×0.6), swings (9 m), rummaging (4.5 m), shield blocks (8 m), a burdened dodge's clatter (6 m), coughs and clangs.
- **Walls muffle:** a noise heard through stone carries 60% as far.
- **Who reacts:** goblins creep up to investigate the spot. Orks advance on it, shield first. A sleeping Ogre wakes. Enemies ignore each other's footsteps but come to see what clanged.

## Milestone 11 — The Blind Quarry-Troll

A sightless troll in a new quarry pit east of the Ogre lair. It has no eyes, so the vision cone can't hide you from it and walls don't help: only silence does.
- It hunts the **last noise it heard**, sprinting to it and sweeping the spot. Quiet survivors (walking, Light Step) can pass within a few metres.
- Loud events (clangs, swings, blocks) make it charge. **Thrown stones (G)** thud down where you aim, so you can lure it away, and goblins and Orks investigate the landing spot too.
- Hits like the Ogre but turns slowly. Tough hide: light blows deal 35% unless it's staggered or recoiling. Its club clangs off the quarry walls. It drops a hide for M12's armor.

## Milestone 12 — Armor slots

Head, body and legs slots. Each piece adds **protection** (damage reduction on unblocked hits, capped at 60%), **weight**, and sometimes **noise** (mail ×1.4, greaves ×1.15) or a sprint penalty. Pieces wear as they absorb blows. Riveted mail stops bleeding. Six pieces, found in containers and on corpses, and three survivors start with one.

## Milestone 13 — Act I objectives & the shelter

Turns the slice into a loop:
1. **Secure the Wayfarer's Watchhouse**: kill or drive off both goblins.
2. **Stock the shelter**: store the Cast-Iron Cooking Pot, 4 timber and 4 salt in the Shelter Stash (a new **Store** button while it's open).
3. **Break the Ork choke point** on the Old Causeway: both Orks dead.
Optional: slay the Ogre and silence the Quarry-Troll. An objective tracker on the HUD, and an Act I complete card.

## Milestone 14 — Save & load

Rest at the shelter fire (T) to heal and save: survivor, pack and worn gear, world containers, dead enemies and their corpses, dropped and lodged items, objectives, weather and the exploration memory. One JSON slot in `user://`. Continue from the start screen.

## Milestone 15 — Blackfen Bestiary I

Two creatures from the bestiary sheet (`docs/art_reference/12_creatures_beasts.webp`), each built on systems that already exist:

- **Carrion Crows** perch in flocks at the Ogre's bone heap and at a new **Old Gibbet** south-east of the watchhouse. They're **sentinels**, not fighters. Come within 6 m in their sight, or make a noise that reaches them, and the flock bursts up **cawing**: a 14 m noise that goblins, Orks and the Quarry-Troll treat like a clang. They come back after about 25 s. A thrown stone that lands near them sets them off on purpose, which makes a loud distraction somewhere else. One blow kills a crow (no lodging in a crow).
- **The Ghoul** lairs at a **Drowned Barrow** in the west. Between hunts it goes to the nearest corpse and **gnaws** it for 5 s, healing itself and spoiling the food, cloth and herbs on the body (metal survives). The crunching is audible and shows as a ripple. It **smells blood**: while you're bleeding it knows exactly where you are within 25 m, through walls. Fast, fragile (90 HP), and its two-claw rake causes bleeding often. Claws are thrusts, so it never clangs.

## Milestone 16 — Blackfen Bestiary II

- **Bog Bear** (Bear Wallow, west): territorial charge by scent within 11 m of its wallow, leash at 18 m. Two-swipe-and-bite maul (the swipes are sweeps that clang, the bite bleeds). **Fears a lit torch held toward it within 4.5 m** until enraged below half health. 220 HP, drops a pelt.
- **Rot Mounds** (marsh): burst into spores when touched, struck or hit by a thrown stone. **Spore-sick** for 25 s within 3 m (stamina regen ×0.5, audible coughing). A torch held close burns one safely; resting at the fire cures it.

## Milestone 17 — Survival: cold & hunger

The Smothering is a volcanic winter, and now the survivor feels it.

- **Warmth (0–100).** Drains outdoors (about 8 minutes from full in Overcast). Weather scales the drain: Sleet ×2.2, Hoarfrost ×2.8, Dead Calm ×1.2, Miasma ×1.1, and Cinder-Squall ×0.6 (the embers are warm). Under a roof it drains at a quarter rate, a lit torch cuts the drain by 60%, and padded armor insulates. **The shelter fire warms you back up** (+4/s within 4 m), as does resting there.
  - Below 40 you're **Chilled**: stamina regen ×0.75.
  - Below 15 you're **Freezing**: stamina regen ×0.5, max stamina capped at 60, and you lose health slowly. At 0, faster.
- **Food (0–100).** Drains about 1 point every 12 s, roughly 20 minutes from full.
  - Below 30 you're **Hungry**: stamina regen ×0.8 and −15 max stamina.
  - Below 10 you're **Starving**: you lose health slowly.
- **Food items:** hardtack, dried meat, and raw bear meat (it fills you, but badly). You eat from the pack (a short, interruptible channel). Food turns up in containers and on corpses. The Ghoul spoils it on corpses it gnaws.
- HUD bars for Warmth and Food. Both are saved.

## Milestone 18 — Shelter crafting & repairs

**K** at the shelter fire opens the work panel. There are nine recipes: repair weapon, shield and armour (iron scrap, timber), refuel the torch (lamp oil / timber), cook Marsh Stew or Salted Broth (needs the Cast-Iron Cooking Pot, pack or stash; hot food restores warmth), and sew Bear-Pelt or Troll-Hide Cloaks (a new cloak slot: insulation; fur muffles footsteps). Ingredients come from the pack, then the stash. Timed, interruptible, nothing wasted.

## Milestone 19 — Day & night

A 16-minute day *(proposed)*: night 20:00–05:00, dusk and dawn easing over two hours each. **F8** skips three hours. The clock is saved.

- **Light:** sun ×0.2 and moon-blue at full dark, ambient −55%, fog darkened. The weather still blends on top.
- **Cold:** warmth drains ×1.7 at night.
- **Sight:** −45% without a lit torch, −15% with one. Anything looking at a torch-bearer sees them as by day. Goblins and the ghoul are `night_eyed`.
- **Hearing:** ×1.15 at night.
- **Creatures:** crows roost (blind, and a noise needs 4 m of spare reach to wake them). The ghoul's blood scent is ×1.5 and its run ×1.15.
- **Sleep:** after dusk, resting at the fire sleeps until 06:00 for 15 food.

## Milestone 20 — Blackfen Bestiary III

Three creatures of the open fen *(all numbers proposed)*:

- **The Bog-Bull** (the Grey Pasture, north; **F9**). It grazes. When it sees you within 10 m, or hears you within 14 m, it snorts, paws for 1.1 s, then charges at 9 m/s for 1.4 s in a line it can't steer. A gore deals 38 damage with heavy knockback. Nothing staggers a charging bull. A charge into a wall or one of the pasture's two standing stones stuns it for 2.6 s, and it counts as staggered, so weapons lodge. Its carcass gives 3 raw game meat.
- **The Skull-Deer** (two, in the Pale Glade, east; **F10**). Prey: it never attacks. It notices you within 11 m (×1.5 with a lit torch) in a 260° field, turns wary, then bolts if you keep coming or get within 6 m, or straight away at a loud noise. Its **bleat** (reach 14) sets off the herd, and goblins, orks, the ghoul and the troll treat it like a caw. At night it stares instead, until you're within 3.5 m. Its carcass gives 2 raw game meat.
- **The Crows' Roost** (a dead tree, far south; **F11**). Six crows and a **Crows' Nest Hoard**. When any roost crow scatters, the flock mobs you for 18 s. Every 2.5 s, within 18 m of the tree, it caws right over your head (reach 14, credited to a crow), so every listener knows where you are.
- **Roast game meat** at the fire, no pot needed: 14 food raw, 40 roasted (+10 warmth).

## Milestone 21 — Blackfen Bestiary IV

The rot, and the thing in the dark *(all numbers proposed)*:

- **Fungus zombies** (three, among the rot mounds). 75 hp. They shamble at 0.8 m/s and chase at 1.9 m/s, seeing 9 m in a 160° field and hearing the survivor. A **spore spew** comes after a 0.9 s rear-back: a 70° cone to 3.5 m, 20 s of spore sickness, 5 s cooldown. The claw does 14. Every non-lethal wound puffs spores within 1.5 m. A death by steel bursts spores within 2.5 m. A lit torch held toward one within 1.8 m sets it **burning** for 3.5 s at 18/s, and a zombie that dies burning leaves no spores.
- **The Rot-Beast** (the Bile Pit; **F12**). 260 hp, 90 poise, 2.4 m/s, sight 12 m. The bite does 30 (a 30% bleed chance) and never clangs. The **vomit**, at 2.5–7 m with a 6 s cooldown, follows a 1.0 s rear-back. It's a 6 × 1.4 m line along the direction the beast faced when the rearing ended: 14 damage and 12 wear on every worn armour piece. It leaves a **BilePool** for 9 s that slows you to ×0.55, deals 3/s and corrodes 3/s. Both the beast and the zombies scan around when they reach your last-known position.
- **The Pallid Crawler** (the Sunken Lane). 80 hp. It is **buried** (unseen, unhittable) until darkness reaches 0.6, then hunts the survivor within 22 m by scent at 4.6 m/s. It **won't enter light**: 5 m around a lit torch, 5.5 m around the shelter fire. It circles 1.5 m outside the light and recoils if the light reaches it. In the dark, within 4 m, it hisses (0.5 s), then **pounces** for 22 with a bleed, retreats for 2.5 s, and comes again. A wound sends it back into the dark. At darkness 0.35 it returns to its lair and buries itself.
- **Bog-Bull fix:** blows on a stunned bull no longer cut its stun short.
- A dodge's invulnerable window avoids the vomit spray, and the spray (and its pool) stops at walls. A zombie killed by any blow while it burns counts as burned clean. Loading restores dead crawlers and zombies quietly, and a living crawler is saved at its lair.

