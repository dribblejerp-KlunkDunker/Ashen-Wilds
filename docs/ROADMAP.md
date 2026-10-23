# Ashen Wilds — Roadmap

Milestones 1–5 shipped the combat core, three enemy archetypes, scavenging and equipment, wall deflection and weapon lodging. This roadmap runs the four candidates from the design document as Milestones 6–9. Each one builds on the one before it.

> The design document isn't in the repo. Specifics marked *(proposed)* are first-pass numbers for playtesting. Check them against the design doc.

| # | Milestone | Status | Depends on |
|---|---|---|---|
| 6 | Cramped for everyone: enemy wall clangs | ✅ shipped | M5 deflection |
| 7 | Survivor backgrounds | ✅ shipped | M4 inventory |
| 8 | Acoustic ripples & vision cone | ✅ shipped | M6 (clangs are loud), M7 (cough flaw) |
| 9 | Weather & atmosphere | planned | M8 (weather scales sight & hearing) |
| — | Armor slots, companions, Blind Quarry-Troll, Acts II–III | later | — |

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
