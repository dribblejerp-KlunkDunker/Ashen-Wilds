# Watchhouse reconciliation: decision register

Branch: `reconcile/watchhouse-onto-main`. Merge of `main` at `9e649bf` into
`integration/watchhouse-survivor` at `d7eb902` (common base `d35d506`).
Engine: Godot 4.7.2-stable, the production pin.

## Foundation decision

The two branches split at `d35d506` and then built overlapping milestones independently:
33 commits on the integration branch and 148 on `main`. Both sides wrote their own weather,
sound ripples, vision cone, objectives, survivor backgrounds, Quarry-Troll and armour model.

`main` is the foundation for every shared system. It carries the 4.7.2 upgrade, the launcher,
networked co-op, the world bible's lore, newer enemies (charge-and-enrage Ogre, Spore Husk,
Unnamed, Gallery Dragger), 3D character models and 532 regression checks. The integration
branch's features that `main` lacks are kept in the tree and get ported onto `main`'s APIs in
later batches. They are not discarded.

This supersedes `docs/WATCHHOUSE_RECONCILIATION.md`, which was written when `main` had 177
checks and advised keeping the integration versions of the core files.

## Batch 1: foundation merge (this commit)

| Path | Resolution |
|---|---|
| `.gitignore` | Integration's combined rules (commit `c5f049d`). They contain every rule from `main`. |
| `CLAUDE.md`, `README.md`, `docs/ROADMAP.md` | `main`. The integration roadmap stays in history at `d7eb902`. |
| `docs/screenshots/01-07` | `main`'s renders. The integration renders show billboard stand-ins. |
| `scripts/combat/wall_deflection.gd` | `main`'s full implementation. `SwingGeometry` remains only for the integration modules that are not yet wired in. |
| `shaders/foreground_cutaway.gdshader` | `main`: single-axis projection with normal maps. |
| `scripts/core/scene_bootstrap.gd` | `main` (launcher, networked courtyard, objectives, lore notes). |
| `scripts/player/player_controller.gd` | `main` (Perception, flat armour, network hooks). |
| `scripts/enemies/enemy_{goblin_scavenger,ork_warrior,ogre_brute,quarry_troll}.gd` | `main`. Its Ogre adds charge and enrage and already closes both hitboxes on target loss. |
| `scripts/data/item_data.gd` | `main` (`ARMOUR`, flat protection, `NOTE`), plus the `food_value`, `warmth_value` and `insulation` fields. |
| `scripts/data/item_database.gd` | `main`, plus the integration food, stone, pelt and hide items and the creature loot tables, remapped to `main`'s armour ids. |
| `scripts/data/survivor_background.gd` | `main`'s eight backgrounds. |
| `scripts/inventory/inventory.gd` | `main`, plus the boundary guards from `d7eb902`, adapted (see below). |
| `scripts/ui/inventory_ui.gd`, `scripts/ui/tactical_hud.gd` | `main`. |
| `tests/smoke_test.gd` | `main` (532 checks). The integration suite's 579 checks belong to features not yet ported. |
| `tools/capture_screenshots.gd` | `main`. |

### Fixes found while compiling the merged tree

- **`WeatherSystem` name clash.** Its inner enum `Weather` was shadowed by `main`'s global `Weather` class. Every use inside the file is now qualified, so it compiles.
- **Inventory guards ported to `main`.** `can_carry(null)` crashed, `consume(0)` reported success, consuming worn armour left a stale slot reference, and out-of-range armour slots could be equipped without counting toward protection. All four are fixed, with 49 checks in `tests/inventory_boundary_test.gd`.
- **Pallid Crawler loot.** The integration crawler called `roll_crawler_loot`, which on `main` is the Gallery Dragger's table. It now has `roll_pallid_crawler_loot`.
- **Ghoul loot filter.** `Category.ARMOR` became `Category.ARMOUR`.
- **Visual benchmark.** It used `AshenWildsBootstrap.FIRE_POS`; `main` keeps that constant in `Objectives.FIRE_POS`.
- **Item lore.** `main` requires a lore line for every item. The ten ported items have proposed lines, marked in `lore_texts.gd` as awaiting owner review and not canon.
- **Tests.** The Ogre target-loss test now covers `CHARGE_STARTUP` and `CHARGE_ACTIVE` and checks both hitboxes: 12 scenarios, 144 checks. `tests/reconciliation_smoke_test.gd` is removed; it extended the integration smoke suite, which `main`'s suite replaces, and the standalone Ogre test covers the same cases.
- **CI.** `watchhouse-integration-verification.yml` used Godot 4.3 and the removed runner. It now uses 4.7.2 and runs the smoke, Ogre and inventory suites twice each.

## Still to port (integration-only, compiled but not yet wired in)

| Feature | Files | Depends on (main API to adapt to) |
|---|---|---|
| Survival: cold and hunger | player controller sections at `d7eb902` | `Weather.profile()`, `ItemData.food_value/insulation` |
| Day and night | `world/day_night_cycle.gd` | Replace `WeatherSystem` with `main`'s `Weather` |
| Shelter crafting and repairs | `core/crafting.gd`, `ui/crafting_ui.gd` | `Inventory.worn_armour()`, `Objectives.FIRE_POS`; cloak slot decision |
| Save and load | `core/save_game.gd` | Reconcile with `net/net_save.gd`; armour API |
| Bestiary I-IV (crow, roost, ghoul, bog bear, rot mound, bog-bull, skull-deer, fungus zombie, rot-beast, pallid crawler) | `enemies/enemy_*.gd`, `world/{crow_roost,bile_pool}.gd` | `Perception` instead of `AcousticField`; `WallDeflection`; `EnemyModel` or explicit sprite fallback; canon review |
| Integration background roster | `data/background_database.gd`, `ui/background_picker.gd` | Two eight-survivor rosters. Pick one, or merge them, as an owner decision. |
| Painted-art billboards | `visuals/{sprite_art,facing_sprite}.gd` | Keep optional, never replacing `main`'s 3D models |
| Duplicate systems to retire after porting | `world/{acoustic_field,acoustic_ripples,vision_cone,weather_system}.gd`, `core/act_objectives.gd`, `combat/swing_geometry.gd` | Delete once nothing references them |

## Verification of batch 1 (Godot 4.7.2-stable, headless, Linux sandbox)

- Import plus a compile check of every script under `scripts/`, `tests/` and `tools/`: no errors or warnings.
- `tests/smoke_test.gd`: 532 passed, 0 failures.
- `tests/ogre_target_cleanup_test.gd`: 144 passed, 0 failures.
- `tests/inventory_boundary_test.gd`: 49 passed, 0 failures.
- `test_env006` through `test_env009` collisions and `test_env010_walkplane`: all exit 0.
- Live boot, 1200 frames with enemies active: no unexpected log lines.
- `tools/net_spike.py` (two clients on loopback): 65 passed, 0 failed.
- Launcher Python tests: 9 of 9 on rerun. One timing-sensitive signal test errored once while running in parallel with the network test.

Not verified: rendered screenshots, interactive play, internet multiplayer.
