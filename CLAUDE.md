# CLAUDE.md — Ashen Wilds

Guidance for Claude (and other agents) working in this repository. Player-facing documentation lives in `README.md`; this file covers how to work on the code.

## What this is

An isometric dark-survival action game in **Godot 4.3-stable**, GDScript 2.0, Forward+ renderer. Everything (level geometry, enemies, items, UI, audio) is built in code at startup by `scripts/core/scene_bootstrap.gd`, so there are no imported assets, `.tres` resources or `.tscn` files beyond `main.tscn`.

Milestones 1–12 are complete: combat core, four enemy types, scavenging and equipment, wall deflection and weapon lodging, enemy wall clangs, survivor backgrounds, vision cone and acoustic ripples, weather, enemy ears, the Blind Quarry-Troll and thrown stones, armor slots. `docs/ROADMAP.md` has the plan through M14 and the proposed numbers. The design document (not in the repo) has the final say on specifics.

## Get Godot (cloud sessions don't have it)

GitHub release downloads work through the session proxy. Keep the binary **outside** the repo:

```bash
mkdir -p ~/godot && cd ~/godot
curl -sSL -o godot.zip https://github.com/godotengine/godot/releases/download/4.3-stable/Godot_v4.3-stable_linux.x86_64.zip
unzip -o godot.zip
export GODOT=~/godot/Godot_v4.3-stable_linux.x86_64
$GODOT --version   # 4.3.stable.official.77dcf97d8
```

Use exactly 4.3-stable. GDScript and API details differ between minor versions.

## Verify every change

Run these from the repo root after any code change, and before committing:

```bash
# 1. Build the class cache (needed after adding or renaming a class_name; harmless otherwise)
$GODOT --headless --path . --import

# 2. Compile-check every script (prints nothing when clean)
for f in $(find scripts tests tools -name "*.gd" | sort); do
  out=$($GODOT --headless --path . --check-only --script "res://$f" 2>&1 | grep -E "ERROR|WARNING")
  [ -n "$out" ] && echo "--- $f" && echo "$out"
done

# 3. Regression suite: exit code = number of failures
$GODOT --headless --path . --script res://tests/smoke_test.gd 2>&1 | grep -E "FAIL|passed|SCRIPT ERROR"

# 4. Live boot with enemies active (should print nothing after filtering)
$GODOT --headless --path . --quit-after 1200 2>&1 \
  | grep -vE 'mesh_get_surface_count|Parameter "m" is null|^\s*$|ObjectDB|cleanup \(core|^Godot Engine'
```

**Expected headless noise. Ignore it:** `Parameter "m" is null` / `mesh_get_surface_count` (dummy renderer) and `ObjectDB instances leaked at exit` (an `AudioStreamGeneratorPlayback` under the dummy audio driver). Neither happens with a real renderer or sound card.

Run the suite twice after timing-sensitive changes to catch flakiness. Currently: **294 checks, 0 failures**.

## Screenshots (README images)

`tools/capture_screenshots.gd` renders `docs/screenshots/*.png` through the real Forward+ renderer. Without a GPU, use Mesa's software Vulkan under Xvfb:

```bash
sudo apt-get install -y mesa-vulkan-drivers   # once; xvfb is usually present
xvfb-run -a -s "-screen 0 1920x1080x24" $GODOT --path . --rendering-driver vulkan \
  --script res://tools/capture_screenshots.gd
```

**Look at every image after rendering** (open the PNGs). The script poses enemies and freezes them, and the shots have exposed real bugs before: torch self-shadowing, and an occluding wall without the cutaway. `docs/.gdignore` keeps the images out of Godot's import pipeline.

## Layout

```
scripts/core/       scene_bootstrap.gd (level, input map, spawns, containers), procedural_audio.gd
scripts/camera/     iso_camera_rig.gd (45° yaw / -30° pitch ortho, shake, brightness)
scripts/combat/     hitbox_component, hurtbox_component, encounter_coordinator (attack tokens), swing_geometry (shared clang arc + sparks)
scripts/data/       weapon_data, combat_payload, item_data, item_instance, item_database (all items + loot tables),
                    survivor_background + background_database (the eight starting survivors)
scripts/inventory/  inventory.gd (stacks, weight, encumbrance, equip slots)
scripts/world/      lootable.gd (crates, corpses, ground piles, lodged weapons),
                    vision_cone.gd (cone rays + memory grids + overlay), acoustic_field.gd (noise bus), acoustic_ripples.gd,
                    weather_system.gd (profiles, blending, shelter, gusts, MultiMesh precipitation)
scripts/player/     player_controller.gd (state machine, the largest file)
scripts/enemies/    enemy_goblin_scavenger, enemy_ork_warrior, enemy_ogre_brute, enemy_quarry_troll (blind, hunts sound)
scripts/ui/         tactical_hud.gd, inventory_ui.gd, background_picker.gd (start screen; pauses the tree)
shaders/            foreground_cutaway.gdshader (Bayer-dither cutaway), vision_memory.gdshader (full-screen cone/charcoal pass)
tests/smoke_test.gd headless regression suite
tools/              capture_screenshots.gd
```

Physics layers: 1 Environment · 2 PlayerBody · 3 EnemyBody · 4 PlayerHurtbox · 5 EnemyHurtbox · 6 Occluders.

## How the systems connect

- **Damage:** the attacker builds a `CombatPayload` and calls `HitboxComponent.begin_swing()` during its ACTIVE phase. The hitbox rejects repeat hits and targets behind walls, then calls `HurtboxComponent.receive_attack()`. The defender decides dodge, block or take.
- **Player states** (`PlayerController.ActionState`): IDLE, MOVE, SPRINT, BLOCK are "neutral". ATTACK_STARTUP → ATTACK_ACTIVE → ATTACK_RECOVERY. DODGE, BLOCK_IMPACT, STAGGER. CHANNEL is shared by search, bandage and equip swap; a hit, move, attack or dodge cancels it. RECOIL is a wall clang. LODGED is a stuck weapon. DEAD.
- **Items:** `ItemData` is a shared definition, one instance per id, created in code by `ItemDatabase`. `ItemInstance` holds quantity and condition. Torch condition = fuel in seconds. Equipped items stay in `Inventory.items` and still count toward weight. Armor lives in `Inventory.armor` (slot -> instance), and `remove()`, `consume()` and `clear()` keep the slots in sync. Damage reduction applies only to unblocked hits, in `_on_hurtbox_hit_received`.
- **Deflection:** `WeaponData.is_thrust(heavy)` marks each player stroke. Sweeps raycast their arc (layer 1) through `SwingGeometry.sweep_obstruction()` when they go active, and a hit enters RECOIL instead of opening the hitbox. Thrusts never clang. Enemies call the same function for their sweeping strokes (Ork combo 1, Ogre sweep). A recoiling enemy must report `is_staggered()`.
- **Lodging:** a heavy confirmed hit on a target whose `is_dead()` or `is_staggered()` is true rolls `heavy_lodge_chance`. Every enemy class must implement both methods.
- **Backgrounds:** `PlayerController._mods` is always a `SurvivorBackground`: the chosen one, or a neutral one. New player numbers that a trait could affect should multiply by a field on it. The bootstrap shows the picker unless `show_background_picker` is false. Tests and tools set that before `add_child`. Headless boots auto-pick the first survivor so the world isn't paused.
- **Vision & noise:** enemies set `_visual_root.visible = player_ref.can_see_body(self)`; their own senses must not depend on that (the Ogre has `_sees_player()`). Anything that makes a sound calls `AcousticField.report()`. Enemies hear through `AcousticField.listen()` + `can_hear()` (walls muffle to 60%), never by polling the player's state. Player gait noise comes from `emit_gait_noise()`. Tests set `current_state` and call it directly. Enemy footsteps go through `AcousticField.step_cadence()`.
- **Enemies must be frozen in tests and tools by class:** the freeze lists in `smoke_test.gd` and `capture_screenshots.gd` name every enemy class. Add new ones there, or a live enemy wanders into later checks.
- **A noise credited to someone else** (a thrown stone's thud is the thrower's) goes through `AcousticField.report_as()`.
- **Art is being made separately** (sprites from another agent). Keep visuals inside each class's `_build_*_visuals*` function so they can be swapped without touching gameplay.
- **Weather:** read effects via `WeatherSystem.factor(node, key)`, never by checking `current`. Fire and footing keys (`SHELTERED_KEYS`) are neutral under a roof. Register new interiors with both the camera rig and `WeatherSystem.register_interior()`. Tests and tools set `weather_cycle_enabled = false` before `add_child` so the weather can't change mid-check.
- **UI capture:** while the pack or loot window is open, `PlayerController.ui_capture` suppresses combat input. Any hit force-closes the windows.

## Conventions and pitfalls (learned the hard way)

- **Typed GDScript everywhere**: `var x: float`, `-> void`, typed arrays and loop variables. Fix warnings; don't ignore them.
- **GDScript is not shader language.** `mix()` doesn't exist in GDScript; use `lerpf()` / `lerp()`. This broke the whole project once, because every enemy references the audio class.
- **Set `position`, not `global_position`, before `add_child()`.** Global transforms need the node in the tree.
- **Avoid `CPUParticles3D` / `GPUParticles3D` for gameplay feedback.** They don't render under software Vulkan, so they can't be screenshot-verified. Sparks are tween-animated mesh shards instead (`_spawn_sparks`).
- **Lights must not sit inside meshes that cast shadows.** The torch light hangs off `_torch_root` at the flame. When it was at the torso's centre, it shadowed the survivor black.
- **Walls facing the camera** (the rig sits on the +X/+Z side) need `enable_cutaway = true` in `_create_static_box()`, or they hide interiors.
- **Unused parameters** are prefixed `_`. Rename them when they become used.
- **Godot renames duplicate sibling names** (a second `Ripple` becomes `@Node3D@N`). Find spawned nodes by group, not by `name.begins_with()`.
- **Full-screen shader output is linear, pre-tonemap.** Constants that look tiny (0.016) come out light grey on screen. Compare against the scene with the overlay off (V) before tuning.
- **Keybindings** are added in `_ensure_input_bindings()`; `_bind_key` won't double-bind. 1–4 switch gear, G throws a stone, F1–F3 and F5 are dev teleports, V toggles the vision overlay, F4 advances the weather.

### Writing tests (`tests/smoke_test.gd`)

- It's a `SceneTree` script. Add a `_test_*()` coroutine and call it from `_run()`. Use `_check(cond, label)` and `_section(title)`.
- Enemies are frozen (`PROCESS_MODE_DISABLED`) after the Milestone 1–3 section so later checks are deterministic. Spawn your own dummies if you need targets.
- `_tap(action)` presses for one physics tick and waits a tick for the result. Listeners in `_unhandled_input` (the pack window) need real events: use `_send_event(action)`.
- No mouse exists headless: set `_player.camera_rig = null` and aim with `_face(dir)`. Restore the rig afterwards.
- Force random rolls by temporarily changing data, e.g. `heavy_lodge_chance = 1.0`, and restore it afterwards.
- Time with `_seconds()` / `_ticks()` (physics frames), not process frames.

## Git

- Remote: `https://github.com/dribblejerp-KlunkDunker/Ashen-Wilds` (`main`). The lowercase URL redirects and still works.
- Commit as `sleeves <dribblejerp@gmail.com>` so GitHub credits the owner.
- Keep the README in sync: the status line's test count, the controls table, feature sections, and the roadmap (remove items once they ship).
- Never force-push `main` without the owner's explicit OK.

## Working with the owner (sleeves)

- Before a big design-heavy build (weather, acoustic ripples + vision cone, companion AI), **say whether a stronger model such as Fable is worth switching to.** Routine milestones are fine on Opus.
- Be honest about what headless tests can't show: feel, timing, light levels and UI layout still need a real playtest. Say so when handing back work.
