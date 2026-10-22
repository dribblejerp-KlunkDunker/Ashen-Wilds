# Ashen Wilds

**A grounded, isometric dark-survival action game built in Godot 4.3.**
Thirty years into the Smothering, you are a broken survivor scavenging the Blackfen Outskirts — every swing costs stamina, every gram in your pack is noise, and the dark belongs to things that don't need torches.

![The Blackfen Ogre winds up a ground slam while the survivor holds a torch and broadaxe](docs/screenshots/06_ogre_lair.png)

> **Status:** Milestones 1–4 complete · verified on Godot 4.3-stable (Forward+) · **93/93** headless regression checks passing
> Art is intentionally placeholder (primitive meshes, procedural audio) — systems first.

---

## Screenshots

| | |
|---|---|
| ![Shelter start](docs/screenshots/01_shelter_start.png) | ![Watchhouse by torchlight](docs/screenshots/02_watchhouse_torchlight.png) |
| **Shelter fire.** You start with a tarnished sword, a wooden targe and a stash you already know. | **Watchhouse by torchlight.** Roof hides when you step inside; foreground walls dither away around you. A goblin's amber telegraph marks its wind-up. |
| ![Searching a chest](docs/screenshots/03_searching_chest.png) | ![Pack and loot windows](docs/screenshots/04_pack_and_loot.png) |
| **Scavenging is timed and interruptible.** Move, attack, dodge or get hit and the search is lost — and goblins hear you rummaging. | **Pack & loot windows.** Every item has weight and condition; the world keeps moving while you decide. |
| ![Ork choke point](docs/screenshots/05_ork_choke_spear.png) | ![Ogre lair](docs/screenshots/06_ogre_lair.png) |
| **Ork choke point with a spear.** Two-handed grip stows your shield; narrow thrusts outreach the Ork's shield wall. | **The Blackfen Ogre.** Slow, enormous, and too wide for doorways. The red ring is its slam zone. |

<sub>Rendered with the project's own `tools/capture_screenshots.gd` (software Vulkan under Xvfb) at in-game brightness +0.4. Enemies are frozen and posed for framing.</sub>

---

## Premise

The Highland Citadels broke open the Deep-Seam Vaults hunting slag-iron and instead released ash-spores, goblin hordes, ork war-clans fleeing something deeper, and a volcanic winter called **the Smothering**. The kings fled south and burned the ships. No prophecy is coming. The people left in the Blackfen are stragglers, deserters and peasants trying to last until spring.

Act I (the current playable slice) is the **Blackfen Outskirts**: secure the ruined Wayfarer's Watchhouse, scavenge what the shelter needs to survive, and break the Ork choke point on the Old Causeway.

---

## What's in the game

### Combat core (Milestones 1–3)
- **Fixed isometric camera** — 45° yaw, −30° pitch orthographic rig with cursor peek, zoom, trauma-based shake, and brightness/shake accessibility controls.
- **Readable occlusion** — 4×4 Bayer-dithered cutaway on foreground walls, roofs that vanish when you're inside (with a shadow-only proxy so interiors stay dark), and **true line-of-sight enemy masking**: enemies behind walls aren't drawn, but you'll *hear* them.
- **Commitment-based melee** — explicit `STARTUP → ACTIVE → RECOVERY` attack phases, stamina with exhaustion, poise and stagger, directional shield blocking with guard breaks, an evasive step with i-frames, and bleeding.
- **Fair hit registration** — one hit per target per swing, and swings can't pass through walls.
- **Three enemy archetypes**
  - *Goblin Scavenger* — flanks, retreats when hurt, hears footsteps, causes bleeding.
  - *Ork Vanguard* — advances behind a shield, punishes button-mashing with a 2-hit combo; heavy attacks or flanking break the guard.
  - *Blackfen Ogre* — slow sweeps and telegraphed ground slams; its 1.70 m body physically can't fit the 1.35 m watchhouse doorway.
- **Encounter coordinator** — attack tokens and a readability gap so enemies take turns instead of swinging all at once.

### Scavenging & equipment (Milestone 4)
- **Timed, cancellable searches** of crates, chests and enemy corpses. Moving, attacking, dodging, pressing E again or taking a hit cancels the search; rummaging is audible to nearby goblins.
- **Carry weight** — an 18 kg pack. Over 75% you're *Burdened* (your pack clatters, so enemies hear you ~35% farther away, and dodges cost more). Over 100% you're *Overburdened* (no sprint, no dodge, slow). Nothing can be picked up past 150%.
- **Item condition**
  - Weapons wear per landed hit; damage tapers below 50% condition and drops to 40% when broken.
  - Shields wear when they block and **splinter** at zero — then they can't block.
  - The torch's condition *is* its fuel: it burns while lit, dims as it runs low, and gutters out.
- **Equipment switching** with a short, interruptible swap:

  | Weapon | Reach | Light | Heavy | Notes |
  |---|---|---|---|---|
  | Tarnished Arming Sword | 1.65 m | 105° diagonal slash | Lunging thrust, 45% bleed | Reliable all-rounder |
  | Boar-Lugged Spear | 2.45 m | 25° thrust | 150° sweep that steps you back | **Two-handed** — stows your off-hand |
  | Woodsman's Broadaxe | 1.55 m | 135° cleave | Heavy cleave, 30% bleed | Hits hard, slow to recover |

  The hitbox is reshaped to each weapon's reach and swing arc. Off-hand: **Wooden Targe** (block) or **Pitch Torch** (light, no block).
- **Bandaging** is a 1.6 s channel that consumes a Clean Rag Bandage.
- **Pack & loot UI** — equip, use and drop from the pack; take items one at a time or all at once. Drops become ground piles you can pick back up.
- **World loot** — five containers, including the spear in the Watchhouse chest, the broadaxe in the Ork plunder pile, and the **Cast-Iron Cooking Pot** (an Act I objective) in the Ogre's bone heap. Every enemy leaves a searchable corpse.

---

## Controls

| Input | Action |
|---|---|
| **WASD** | Move (camera-relative) |
| **Shift** | Sprint |
| **Mouse** | Aim |
| **LMB** | Light attack (tap again late in recovery to chain) |
| **Q** / **Shift+LMB** | Heavy attack |
| **RMB (hold)** | Raise shield |
| **Space** | Evasive step |
| **E** | Search / open container or corpse (press again to stop) |
| **Tab** | Open/close pack · **Esc** closes windows |
| **B** | Bandage a wound |
| **1 / 2 / 3** | Ready blade / polearm / axe |
| **4** | Swap off-hand: shield ⇄ torch |
| **R** | Respawn at the shelter fire |
| **F1 / F2 / F3** | Teleport to Watchhouse / Ork choke point / Ogre lair (dev) |
| **Mouse wheel** | Zoom |
| **[ / ]** | Brightness down / up |
| **- / =** | Camera shake down / up |

---

## Getting started

**Requirements:** [Godot 4.3-stable](https://godotengine.org/download/archive/4.3-stable/) (standard build, not .NET). The project uses the Forward+ renderer, so you need a Vulkan-capable GPU.

```bash
git clone https://github.com/dribblejerp-KlunkDunker/Ashen-Wilds.git
cd Ashen-Wilds
```

Then open `project.godot` in the Godot editor and press **F5**, or run it from a terminal:

```bash
godot --path .
```

Everything — level geometry, enemies, UI, items, audio — is built in code at startup by `scripts/core/scene_bootstrap.gd`, so there are no assets to import.

### Running the tests

The game's systems are covered by a headless regression suite (no GPU needed):

```bash
godot --headless --path . --import          # first run only: builds the class cache
godot --headless --path . --script res://tests/smoke_test.gd
```

The process exit code is the number of failures (`0` = all passed). It covers spawning, the damage pipeline, the attack state machine, attack tokens, inventory stacking and weight, encumbrance, searching and every way to cancel it, equipment swaps and hitbox reshaping, torch fuel, durability and shield splintering, bandaging, dropping and picking up, the pack/loot UI, corpse loot, and the world containers.

> Headless runs print `Parameter "m" is null` and an "instances leaked at exit" warning. Both come from Godot's dummy renderer and audio driver, which are only used in headless mode — not from the game.

### Re-rendering the screenshots

```bash
# Linux without a GPU: needs Xvfb and Mesa's software Vulkan (mesa-vulkan-drivers)
xvfb-run -s "-screen 0 1920x1080x24" godot --path . --script res://tools/capture_screenshots.gd
```

On a desktop with a GPU, drop the `xvfb-run …` prefix.

---

## Project structure

```
project.godot              Engine config, physics layer names
main.tscn                  Single root node → scene_bootstrap.gd
shaders/
  foreground_cutaway.gdshader   Bayer-dither wall/roof cutaway
scripts/
  core/       scene_bootstrap.gd (builds the level, input map, containers), procedural_audio.gd
  camera/     iso_camera_rig.gd
  combat/     hitbox / hurtbox components, encounter_coordinator.gd
  data/       weapon_data, combat_payload, item_data, item_instance, item_database (all items + loot tables)
  inventory/  inventory.gd (stacking, weight, encumbrance, equip slots)
  world/      lootable.gd (crates, corpses, ground piles)
  player/     player_controller.gd
  enemies/    goblin scavenger, ork warrior, ogre brute
  ui/         tactical_hud.gd, inventory_ui.gd
tests/
  smoke_test.gd            Headless regression suite (93 checks)
tools/
  capture_screenshots.gd   Renders docs/screenshots/
docs/screenshots/          README images (ignored by Godot via docs/.gdignore)
```

### How the pieces fit

- **Damage flow:** an attacker builds a `CombatPayload` and opens its `HitboxComponent` during the *active* phase. The hitbox finds overlapping `HurtboxComponent`s, rejects repeat hits and anything behind a wall (raycast), then calls `receive_attack()`. The defender decides whether it was dodged, blocked or taken.
- **Physics layers:** 1 Environment · 2 PlayerBody · 3 EnemyBody · 4 PlayerHurtbox · 5 EnemyHurtbox · 6 Occluders (roofs).
- **Items:** `ItemData` is the shared definition (one instance per id, built in code by `ItemDatabase`); `ItemInstance` carries quantity and condition. `Inventory` holds instances plus the main-hand and off-hand slots — equipped items still count toward weight.
- **Timed actions:** searching, bandaging and equipment swaps all share the player's `CHANNEL` state, so they're interrupted by the same rules and drive the same HUD progress bar.

---

## Roadmap

Next milestone not yet chosen. Candidates from the design document:

- **Weather & atmosphere** — ashfall, miasma fog, sleet, cinder-squalls, hoarfrost and the Dead Calm, each changing sight, hearing, fire and footing.
- **Acoustic ripples & vision cone** — unseen threats shown as dust-ring ripples sized by noise; a 130° vision cone with a charcoal "memory map" outside it.
- **Wall & corridor weapon deflection** — wide swings that clang off narrow hallway walls (and cost durability), making thrusting weapons the indoor choice.
- **Survivor backgrounds** — eight starting characters with gear, traits and permanent flaws.
- Armor slots, companions, the Blind Quarry-Troll and the rest of the bestiary, and Acts II–III.

---

## Known limitations

- Placeholder visuals: characters and props are primitive meshes; audio is synthesized at runtime.
- No save system yet; your pack is kept when you respawn.
- Only tested on Godot **4.3-stable**.
- The test suite checks game logic, not feel — swap times, light levels and UI layout still need hands-on tuning.

---

*No license has been chosen yet; all rights reserved by the author until one is added.*
