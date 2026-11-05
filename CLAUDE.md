# CLAUDE.md — Ashen Wilds

Guidance for Claude (and other agents) working in this repository. Player-facing documentation lives in `README.md`; this file covers how to work on the code.

## What this is

An isometric dark-survival action game in **Godot 4.3-stable**, GDScript 2.0, Forward+ renderer. Everything (level geometry, enemies, items, UI, audio) is built in code at startup by `scripts/core/scene_bootstrap.gd`, and there are no `.tres` resources. The one exception to "all in code" is art: the survivor is a rigged Quaternius character (CC0) with its animations under `art/quaternius/`, the level's boxes wear photo textures from `art/ambientcg/` (CC0; see each README), and the owner's own environment kit under `assets/environment/` (generated GLBs; see each set's README) dresses the yard; the only scenes are `launcher.tscn` (the main scene: picks the networked courtyard when started with `-- --server` or `-- --client`, else the prototype), `main.tscn` and `net_main.tscn`.

Milestones 1–5 of the single-player prototype are complete: combat core, three enemy types, scavenging and equipment, wall deflection and weapon lodging. That prototype (`main.tscn`) is preserved as the rollback baseline.

**Since 2026-11-03 the project is the two-developer 3D multiplayer game described in the owners' briefs.** `docs/PRODUCTION.md` is the working record: tool versions, the decision register, temporary rules, network operation contracts, and the evidence for each milestone. Read it before changing anything under `scripts/net/`. The networked work lives beside the prototype (`net_main.tscn`, `scripts/net/`), never inside it. Server authority is not negotiable: clients send intent, the server owns every shared outcome, and every RPC lives on `NetMain` with the sender derived from the connection, never from the payload.

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

**Expected headless noise. Ignore it:** `Parameter "m" is null` / `mesh_get_surface_count` (dummy renderer) and `ObjectDB instances leaked at exit` (an `AudioStreamGeneratorPlayback` under the dummy audio driver). Neither happens with a real renderer or sound card. **Exported release builds** also log one `Attempt to disconnect a nonexistent connection from 'NetMain' ... 'tree_exited'` line per process at shutdown after RPCs were exchanged; the editor binary never does, and it is unaffected by whether the peer is detached. Engine teardown noise, verified 2026-11-03; anything else in a log is a bug.

Run the suite twice after timing-sensitive changes to catch flakiness. Currently: **411 checks, 0 failures**. The environment kit has its own collision suites, `tests/test_env006_collisions.gd` to `test_env009_collisions.gd` (exit code 1 on any failure).

```bash
# 5. Networked courtyard: a headless server and driven headless clients as separate processes on loopback.
#    Exit code = failures. Two-client LOCAL test; it says nothing about internet play.
python3 tools/net_spike.py

# 6. The same with a rendered client under Xvfb (needs mesa-vulkan-drivers; apt-get update first if it
#    has "no installation candidate"). Look at every PNG it writes.
python3 tools/net_spike.py --shots docs/screenshots/net

# 7. Exported builds (tools/get_export_templates.sh installs the 4.3-stable templates once), then the
#    loopback test on the exported binaries. An archive is not proof it runs; this is.
tools/export_builds.sh && python3 tools/net_spike.py --exported builds
```

CI (`.github/workflows/checks.yml`) runs steps 1–3, the environment kit's collision suites, and step 5 on every push and pull request. `.github/workflows/publish.yml` runs step 7 on every pull request and push to `main`; on `main` it then deploys the browser build (`builds/web/`, the single-player prototype) to GitHub Pages and replaces the zips on the rolling `playtest` pre-release. Anything that breaks the web export breaks that publish. The browser has no system fonts: UI text must stay within Godot's default font (no arrows or symbols like ⇄), and audio generators must set `playback_type = AudioServer.PLAYBACK_TYPE_STREAM`.

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
scripts/camera/     iso_camera_rig.gd (-30° pitch ortho; four quarter-turn views, zoom, recenter, shake, brightness)
scripts/net/        net_main.gd (session: roles, every RPC, the request pipeline, test drives), net_protocol.gd (constants, rejections, results),
                    net_player.gd (identity, state, the one walking rule), net_player_view.gd, net_courtyard.gd (the crate and its seed),
                    net_container.gd (a world object: stable id, server-owned contents, stack ids, version), net_hud.gd, net_loot_window.gd,
                    net_fixture.gd (the breach and the hearth: one-way state, cost, collision), net_save.gd (the world save and its load policy)
scripts/combat/     hitbox_component, hurtbox_component, encounter_coordinator (attack tokens), wall_deflection (shared clang rules),
                    thrown_stone (the goblin's projectile: a moving HitboxComponent stopped by layer 1 rays)
scripts/data/       weapon_data, combat_payload, item_data, item_instance, item_database (all items + loot tables),
                    survivor_background (the eight starting characters: kit, trait, flaw, modifiers)
scripts/inventory/  inventory.gd (stacks, weight, encumbrance, equip slots)
scripts/world/      lootable.gd (crates, corpses, ground piles, lodged weapons), set_dressing.gd (the owner's kit placed as decoration; container models),
                    ash_fall.gd (shader-driven falling ash around the survivor), flicker_light.gd (the shelter fire's breathing light),
                    acoustic_ripple.gd (dust rings for unseen noises, last-seen marks), vision_cone_overlay.gd (the charcoal memory map, a full-screen quad),
                    weather.gd (six conditions on a cycle: fog, ash, fire, hearing, sight range, footing),
                    companion.gd (a follower: follow/hold/fight/downed/revive), action_point.gd (a timed [E] action instead of a search)
scripts/player/     player_controller.gd (state machine, the largest file), survivor_model.gd (the animated Quaternius body and hand sockets),
                    perception.gd (the 130° vision cone cut by walls, hearing, ripples: what the survivor can see and hear)
scripts/enemies/    enemy_goblin_scavenger, enemy_ork_warrior, enemy_ogre_brute, enemy_quarry_troll (blind: hunts by sound),
                    enemy_model.gd (the Ashbound body shared by all of them)
scripts/ui/         tactical_hud.gd, inventory_ui.gd, vignette.gd (screen-edge shade, CanvasLayer 0 under the HUD),
                    background_select.gd (the start screen: eight cards, keyboard and mouse; emits only)
shaders/            foreground_cutaway.gdshader (Bayer-dither cutaway, world-space photo textures), ash_fall.gdshader (falling ash),
                    vision_cone.gdshader (charcoal outside the cone, world position rebuilt from depth)
tests/smoke_test.gd headless regression suite
art/quaternius/     the survivor (Ranger outfit), the enemies (ashbound/: Peasant outfit + Ranger hood), the two animation libraries,
                    recoloured textures, licences (README)
art/ambientcg/      photo textures (mud, stone, planks) for the level and props (README)
assets/environment/ the owner's environment kit ENV-001..010: crates, barrels, walls, roofs, fences, trees, rocks, ruins,
                    ground cover, the ENV-010 Watchhouse layout preview; generated by tools/generate_env*.py (each set has a README)
scenes/environment/, scripts/environment/  the ENV-010 layout preview scene and its builder (not used by the game yet)
tools/              capture_screenshots.gd, net_spike.py (loopback multiplayer test and screenshots),
                    get_export_templates.sh, export_builds.sh, package_builds.sh (the five builds and their zips)
```

Physics layers: 1 Environment · 2 PlayerBody · 3 EnemyBody · 4 PlayerHurtbox · 5 EnemyHurtbox · 6 Occluders · 7 Props. Every ray (line of sight, hidden-behind-a-wall, clangs, hit blocking) casts against layer 1 only; survivor and enemy bodies collide with 1, 2, 3 and 7.

## How the systems connect

- **Damage:** the attacker builds a `CombatPayload` and calls `HitboxComponent.begin_swing()` during its ACTIVE phase. The hitbox rejects repeat hits and targets behind walls, then calls `HurtboxComponent.receive_attack()`. The defender decides dodge, block or take.
- **Player states** (`PlayerController.ActionState`): IDLE, MOVE, SPRINT, BLOCK are "neutral". ATTACK_STARTUP → ATTACK_ACTIVE → ATTACK_RECOVERY. DODGE, BLOCK_IMPACT, STAGGER. CHANNEL is shared by search, bandage and equip swap; a hit, move, attack or dodge cancels it. RECOIL is a wall clang. LODGED is a stuck weapon. DEAD.
- **Items:** `ItemData` is a shared definition, one instance per id, created in code by `ItemDatabase`. `ItemInstance` holds quantity and condition. Torch condition = fuel in seconds. Equipped items stay in `Inventory.items` and still count toward weight.
- **Armour:** `ItemData.Category.ARMOUR` with an `ArmourSlot` (HEAD, BODY, LEGS), `protection`, `poise_bonus`, `bleed_resist`, `noise_mult`, `don_time`; `ItemDatabase._register_armour()` makes the six pieces. `Inventory.armour` maps slot to piece (`equip` replaces the slot, `remove` and `unequip` clear it) and sums them: `total_protection()` (broken pieces half), `armour_poise_bonus()`, `bleed_resist()` (chances combined), `armour_noise_mult()`, `wear_armour()`. The player's hit handling soaks `protection` off each blow (x0.6 for heavy, floor 30% of the blow), wears every worn piece (2 for heavy), turns bleeds by `bleed_resist()`, and staggers on a heavy blow only when the poise bonus is under half the blow's poise; `effective_max_poise()` feeds the stagger rule and the HUD. `request_equip()` on armour takes `don_time` (half to take off). Nothing is drawn on the body yet.
- **Deflection:** `WeaponData.is_thrust(heavy)` marks each player stroke. Sweeps raycast their arc (layer 1) through `WallDeflection.sweep_obstruction()` when they go active, and a hit enters RECOIL instead of opening the hitbox. Thrusts never clang. Enemies use the same helper: the Ork's opening slash and the Ogre's sweep clang into an `AIState.RECOIL` that counts as staggered; the Goblin's jab (`attack_is_thrust`), the Ork's chop and the Ogre's slam never clang.
- **Lodging:** a heavy confirmed hit on a target whose `is_dead()` or `is_staggered()` is true rolls `heavy_lodge_chance`. Every enemy class must implement both methods.
- **Survivor look:** `SurvivorModel` is presentation only. `_update_animation()` picks a clip from the action state; timed states (attacks, dodge, stagger, recoil) stretch their clip to the state's own duration, so the simulation sets the timing and the animation follows. The weapon and torch hang off the model's hand sockets (`right_socket`, `left_socket`, whose -Z points out of the fist), the shield off `shield_mount` on the back of the left hand; hitboxes, collision and aim stay on the controller, so a different mesh on the same rig changes nothing in play. Godot strips a `_Loop` suffix from imported clip names (`Idle_Loop` is `Idle`). During a dodge the model turns to face the roll.
- **Enemy look:** `EnemyModel` is the Ashbound body (Peasant rags, the Ranger's hood, grey skin tinted per type, scaled to each collision capsule), presentation only like `SurvivorModel` and sharing its clip library. Each enemy's `_update_model_animation()`, called at the end of `_update_visual_telegraph()`, picks clips from its AI state; attacks use `play_strike()` so the blow lands as the startup timer runs out. Weapons hang in the right hand, the ork's shield on the left `shield_mount`; the coloured status ring stays the readable telegraph. Death plays `Death01` (the body is no longer tipped flat). Its AnimationPlayer runs even when the enemy is frozen.
- **Atmosphere:** `_build_atmosphere_and_lighting()` sets the night: cold `Moon` light, blue-grey ambient, distance fog plus ground mist (`fog_height`), glow on emissive flames, and a desaturated, slightly contrasty adjustment. All of it works in the browser's Compatibility renderer except SSAO (desktop only). The brightness setting still moves `tonemap_exposure` (0.6 to 2.6; default 1.7). Screenshots render at the default brightness; the owner found the first night far too dark, so judge darkness from the shots at default, not with a boost. A near-black fog colour darkens the ground under the mist; keep the mist colour pale.
- **Enemy temperaments:** each enemy has its own style (a doc comment at the top of its script), an `aggression` (0 to 1; what it changes is documented on the export, different per enemy) and an `attack_power` multiplier on every damage it deals; base damages are named constants (`JAB_DAMAGE`, `SLASH_DAMAGE`, `CHARGE_DAMAGE`...). Goblin, the opportunist: circles at `CIRCLE_RADIUS`, darts in on `player_is_open()` or when its patience runs out, backstabs for x2 from behind the survivor's aim (`PlayerController.get_aim_direction()`), disengages after a jab, throws `ThrownStone`s at 5 to 11 m. Ork, the soldier: a guard held in front of it past `turtle_patience()` draws the shield bash, whose payload sets `CombatPayload.breaks_guard` (the player's block code staggers on it anyway); aggression scales recovery (x1.0 at 0.5, so the shield ork's timings are the baseline) and the bootstrap makes the shieldless ork 0.85. Ogre, the juggernaut: `WINDUP_POISE_MULT` during startups and the charge; the charge needs a shoulder-wide lane clear of layer 1 from knee to chest (`_charge_lane_clear()`: no doorways, no crates), has its own `_charge_hitbox`, cannot steer, and crashes into any StaticBody3D into RECOIL; enraged below 40%. New enemy attacks must take and release an attack token, and close every hitbox they open on death, stagger, `_abandon_attack()` and the survivor's death (goblin and ork `_stand_down()`). Every looping gait or idle clip must be in `SurvivorModel.LOOPING` (the suite checks), or it plays once and freezes.
- **The Blind Quarry-Troll:** `EnemyQuarryTroll` never looks. `_listen()` asks `player_noise_radius()` (a metres-per-action table `HEARING` times the survivor's `get_noise_multiplier()`, so load, weather, background and armour all reach it; still, blocking still and walking-while-blocking are silent) and `companion_noise_radius()` for every `Companion`, muffles through stone (`WALL_MUFFLE`), and keeps the loudest source by reach. `heard(pos)` remembers a spot for `MEMORY_SECONDS`; it walks there and `_begin_pound(spot)` aims at the spot, not the survivor: `_pound_ring` and `_pound_hitbox` are `top_level` and placed at the spot. A blow on it calls `heard(attacker_origin)` and, from close by, `_begin_thrash()` (a cylinder hitbox round itself). Both take and release the attack token (priority, like the ogre's committed blows); `_stand_down()` on the survivor's death; `RETURN_HOME` when it has lost the sound away from `_home_pos`. It lives in the north-east quarry (15.5, -14.5); F6 teleports there. The suite freezes it with the other level enemies.
- **Perception (presentation only):** `PlayerController.perception` (`Perception`) is the survivor's sight and hearing. Sight is a `CONE_DEGREES` wedge around the aim plus a layer 1 ray from the eyes. Every enemy calls `perception.update_visibility(self, _visual_root, head_height, alive)` each tick and never reads `_visual_root.visible` for its own decisions (the ogre once did and would have gone blind behind the survivor; it has `_can_see_player()`). Enemies report every noise they make with a loudness in metres (`_noise(x)` on windups, swings, roars, slams; `report_footsteps()` by stride); an unseen heard noise spawns an `AcousticRipple` (rate-limited per source) and emits `heard`, which the bootstrap turns into the cue and a rare banner. Slipping out of sight leaves a last-seen mark (not for corpses). `VisionConeOverlay` is a full-screen quad drawn first among transparents (`render_priority -100`) so ash, sparks and ripples draw over it; it rebuilds world positions from `hint_depth_texture`, reversed on Forward+/Mobile (a `RenderingDevice` exists) and not on Compatibility. `enabled` (F4) restores the old draw rule, line of sight alone. Nothing in the simulation reads any of this.
- **Weather:** `Weather` (bootstrap) holds `PROFILES`, one dictionary per `Condition`, every field a float or a Color so `profile()` can lerp a change over `BLEND_SECONDS`. `bind()` captures the base ambient, moon and fire energies and `_apply()` writes the blended profile every frame of a blend into the Environment, the Moon, `AshFall.apply()`, the `FlickerLight`, the player's `weather_hearing` / `weather_torch_burn` / `weather_footing`, and `Perception.hearing` / `sight_range`. Enemy hearing of the survivor goes through `get_noise_multiplier()`, which now includes `weather_hearing`, so a condition deafens or sharpens both sides. Tests set `cycling = false` and `set_condition(c, true)`; F5 is `advance()`. Add a condition by adding a profile and a `CYCLE` entry; nothing else needs to know.
- **Backgrounds:** `SurvivorBackground.all()` builds the eight in code; `PlayerController.apply_background(bg)` sets the stats (absolute fields for health, stamina, poise, carry, dodge cost; `*_mult` fields against `_base_stats` captured in `_ready`), empties and refills the pack, equips the kit and heals. The hooks read `background.*` at the point of use: search and bandage time in `_start_channel`, bandage heal, bleed length, attack cost and `heavy_allowed` in `_start_attack`, block cost, heavy damage, wear, own noise in `get_noise_multiplier()`, torch burn; `Perception.sight_mult` / `hearing_mult` stack on the weather. The default (`DEFAULT_ID`, the Watch Deserter) carries the prototype's original kit so the suite's early expectations hold. `BackgroundSelect` only emits `chosen`; the bootstrap pauses the tree, applies, unpauses, and skips the screen when `DisplayServer.get_name() == "headless"`, so tests and CI keep the default. Add a background by adding it to `_build()`; the picker lays out whatever `all()` returns.
- **Companions:** `Companion` (CharacterBody3D on the player's body layer 2) follows `anchor()` (the survivor, or `hold_spot` in HOLD), fights the nearest living, processing enemy within `ENGAGE_RADIUS` of itself and `LEASH` of the anchor (targets are found by duck typing: a CharacterBody3D with `is_dead` and `is_staggered`, so every enemy class must keep both), and rejoins behind the survivor after `REJOIN_SECONDS` further than `REJOIN_DISTANCE` away (no pathfinding). Its hurtbox is on layer 4 (the survivor's), so enemy hitboxes (mask 8) and stones hit it; its hitbox mask is 16 (enemy hurtboxes), so it can never hit the survivor. At 0 health it is DOWNED for `DOWNED_SECONDS` with an `ActionPoint` "Lift" child whose action needs a bandage, then dies into a corpse Lootable. `ActionPoint` is a `Lootable` whose `on_search_complete(by)` runs a Callable instead of opening the loot window (`Lootable.on_search_complete` is the hook; `PlayerController._complete_channel` honours it), used for the bound captive and the lift. The bootstrap's `_on_captive_freed` makes the companion and hands it to `TacticalHUD.companion`, which draws the ALLY row each frame; F is `toggle_mode()`. The companion is always drawn (never passed to Perception). `EnemyModel` has a "companion" type (human skin, undyed cloth).
- **UI capture:** while the pack or loot window is open, `PlayerController.ui_capture` suppresses combat input. Any hit force-closes the windows.

## Conventions and pitfalls (learned the hard way)

- **Typed GDScript everywhere**: `var x: float`, `-> void`, typed arrays and loop variables. Fix warnings; don't ignore them.
- **GDScript is not shader language.** `mix()` doesn't exist in GDScript; use `lerpf()` / `lerp()`. This broke the whole project once, because every enemy references the audio class.
- **Set `position`, not `global_position`, before `add_child()`.** Global transforms need the node in the tree.
- **Avoid `CPUParticles3D` / `GPUParticles3D` for gameplay feedback.** They don't render under software Vulkan, so they can't be screenshot-verified. Sparks are tween-animated mesh shards instead (`WallDeflection.spawn_sparks`).
- **Quaternius characters face +Z in their files; the game aims down -Z.** Both models turn the character 180° (`_character.rotation.y = PI`). The survivor shipped backwards once (LF-1b) because a render was misread; the suite now checks that every character's toes point where it aims. Measure facing from the skeleton (toes vs. foot), not by eye.
- **Lights must not sit inside or right beside meshes that cast shadows.** The torch light hangs on the survivor's visual root over the left shoulder, 2.3 m up (`TORCH_LIGHT_POSITION`), not at the flame. At the torso's centre it shadowed the survivor black; at the flame, which the animated hands carry in front of, behind or above the body, the body threw dark wedges across rooms and the light swung about.
- **Walls facing the camera** (the rig sits on the +X/+Z side) need `enable_cutaway = true` in `_create_static_box()`, or they hide interiors. Give every new box a surface (`"mud"`, `"stone"`, `"dark_stone"`, `"planks"` in `SURFACES`) as its last argument; the suite fails on a flat one. Props use `AshenWildsBootstrap.surface_material()`.
- **Set dressing blocks bodies, never rays.** `SetDressing` gives solid pieces (trees at the trunk, stumps, fences, boulders, ruin walls and columns, fallen trees) a collider on layer 7 Props, which bodies collide with and no ray uses; ground cover, pebbles, low rubble and firewood stay walk-through. Never put a dressing collider on layer 1: it would hide enemies, stop hits and clang swords. Tall pieces stand at the yard's edges, away from the doorway, the entry hall and test positions. Containers get their kit model through `CONTAINER_MODELS` in the bootstrap, fitted inside their collision box (the suite checks nothing pokes out). Godot's `.import` files and extracted `*_0.png` textures under `assets/environment/` are git-ignored: they are regenerated on every import.
- **Stylised kits are out** (KayKit, Kenney, Quaternius props): the owner wants grim and grounded. Photo-based CC0 sources fit (ambientCG; Poly Haven's download server refuses scripted clients, so its models need the owner to fetch them or a decision on the tooling).
- **Node names collide.** `add_child(n)` renames a node whose name a sibling already has to `@Class@id`, so `find_children("Name*")` misses every one after the first. Spawned effects (ripples, marks) use `add_child(n, true)` and a group; count them with `get_nodes_in_group`.
- **Unused parameters** are prefixed `_`. Rename them when they become used.
- **Keybindings** are added in `_ensure_input_bindings()`; `_bind_key` won't double-bind. 1–4 switch gear, F1–F3 are dev teleports. The networked scene binds its own (WASD/arrows, Q/E turn, C recenter) in `NetMain`; the camera rig only reacts to `camera_rotate_*` and `camera_recenter` when a scene has bound them.
- **Networked code:** never move an avatar on a client except through `integrate()` for prediction; never read `multiplayer.get_unique_id()` or `multiplayer.is_server()` after a peer may have closed (use `own_peer_id` and `role`); send state per live peer, not broadcast, so a peer mid-handshake or being rejected gets nothing. Every interaction goes through `_serve_request()`: identity from the sender, rate limit, repeat detection, validate, apply, answer, then push the changed durable state to everyone. A client never changes a pack or a container itself; it waits for `pack_state` and `container_contents`.
- **Test drives read the first snapshot** (`first_views`) when two clients must ask for the same stack, because the loser's live view has already lost it. Drives that must reach a place use `_goto([points])`, which walks straight at each point regardless of spawn order or camera.
- **Persistence:** every durable change must set `save_dirty = true` on the server (take, store, fixture use, join of a new key, disconnect); the debounce writes within a second. Nothing writes before `_load_world()` succeeds (`save_enabled`), so a refused load can never overwrite a save. Tests always pass `--save <temp path>`; never let a test touch the developer's real `user://ashen_world.json`.

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
