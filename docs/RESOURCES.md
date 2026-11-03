# External resources survey (2026-11-03)

A scan of GitHub, itch.io, the Godot Asset Library, Poly Haven, Kenney, Quaternius, KayKit and
OpenGameArt for things this project could use. **Nothing here is adopted.** Every row is a
candidate; the dependency policy (appendix §89) and the licensing rule (brief §59) apply before
anything enters the repository: purpose, version, licence file read in the actual download,
integration cost, replacement difficulty.

Verification column: **fetched** = the page itself was read in the session; **search** = only a
search-result summary was seen, so counts, versions and licence wording need checking on the
download page; **docs** = the official Godot documentation page was read.

## Recommendation in one paragraph

Keep the networking we have (Godot's built-in ENet with our own authority code: it works and is
tested). Do not add a netcode framework now. For internet play without port forwarding, the
decision between a self-hosted relay (noray) and Steam's relay (GodotSteam) is the "online model"
question the owners still have to answer, and it has a hosting cost either way. For art, use CC0
kits for **blockout, scale reference and the placeholder character**, not as the final look: the
brief wants a crude, weather-beaten world that becomes recognisably ours, and every kit below is
clean and stylised. The strongest single candidate is the KayKit Adventurers pack for a rigged,
animated placeholder survivor, subject to the owners approving its proportions. Textures from
Poly Haven and ambientCG (CC0) fit the shared material library idea directly.

## Networking and tooling

| Resource | What it is | Licence | Fit | Verification |
|---|---|---|---|---|
| [netfox](https://github.com/foxssake/netfox) | Godot 4.x addon: tick loop, client-side prediction and server reconciliation, interpolation, noray integration. 1.1k stars, 355 commits. Examples written against Godot 4.1. | MIT | **Not now.** It replaces the movement slice we just tested with a framework. Revisit if prediction quality becomes a problem in combat (Milestone 4). Test against 4.3 before any adoption. | fetched |
| [noray](https://github.com/foxssake/noray) + [netfox.noray](https://godotengine.org/asset-library/asset/edit/9845) | Self-hosted connection orchestrator: NAT punch-through first, relay fallback. The Godot addon is MIT. | MIT | Candidate for internet play without port forwarding on non-Steam builds. Needs a server you run (cost, uptime). Depends on decision P4. | search |
| [GodotSteam SteamMultiplayerPeer](https://github.com/kargames/SteamMultiplayerPeer), [Steam Multiplayer Peer for 4.3](https://godotengine.org/asset-library/asset/edit/13207) | Godot `MultiplayerPeer` over Steam Networking Sockets: Steam's relays and NAT traversal. | MIT (addon); Steamworks terms | Candidate if the game ships on Steam. Ties online play to the Steam client. Depends on P4. | search |
| [Multiplayer Bomber demo](https://www.godotengine.org/asset-library/asset/edit/11450) (godot-demo-projects, `networking/multiplayer_bomber`) | Official example of `MultiplayerSpawner`/`MultiplayerSynchronizer`. Tagged 4.2. | MIT | Reference only. We chose explicit RPCs over the synchronizer nodes so authority stays visible (appendix §73). | search |
| [Linko-3D authoritative dedicated server template](https://godotengine.org/asset-library/asset/edit/15071) | Headless Linux server, clients, spawn, position sync. Godot 4.5. | MIT | Reference for exporting a headless Linux server build (Milestone 1 last step). No prediction. | search |
| [barichello/godot-ci](https://github.com/hatmix/godot-4-ci/actions/runs/10539404417/workflow) container `godot-ci:4.3` | Docker image with Godot and export templates for GitHub Actions exports. | MIT | Candidate for automated test builds (appendix §57, §90). Confirm the image is maintained. | search |
| [gdUnit4](https://github.com/MikeSchulze/gdUnit4-action), GUT | Godot 4 test frameworks with CI actions. | MIT | Not needed yet: our tests are plain `SceneTree` scripts and a Python orchestrator. Consider gdUnit4 when test count grows. | search |
| Latency and loss simulation | Godot 4.3's ENet has no built-in simulator. Options: `tc netem` on Linux loopback (root), `clumsy` on Windows. | — | Milestone 1b. | knowledge; verify |

## Characters

| Resource | What it is | Licence | Fit | Verification |
|---|---|---|---|---|
| [KayKit Character Pack: Adventurers](https://kaylousberg.itch.io/kaykit) ([Godot listing](https://godotengine.org/asset-library/asset/edit/8899)) | 4 rigged, textured, animated low-poly characters, 75 animations, 25+ weapons and accessories; FBX and glTF; tested in Godot 4.1. | CC0 (itch and Godot listing; one listing snippet says "attribution required": read the licence file in the zip) | **Best placeholder survivor** for Milestones 1–4 (brief §15 asks for a coherent rigged source). Proportions are stylised: the brief says no cartoon proportions without approval, so the owners decide. The rig and animation set can carry an own mesh later. | search |
| [KayKit Character Animations](https://kaylousberg.itch.io/kaykit-animations), [Skeletons pack](https://kaylousberg.itch.io/kaykit-skeleton-pack) | Shared animation library with a Godot implementation guide; a rigged undead set. | CC0 | Animation reference; the skeletons are a possible first enemy placeholder if the Ashbound stay humanoid. | search |
| Existing `assets/character/exports/regenerated/bilateral-torso-fitted.glb` (browser repo) | 21 meshes, one skin, **no animations**, manifest says "substitute, not original recovery". | project | Not runtime-ready (brief §15). Keep as history. | fetched (file inspected) |

## Environment kits (blockout and reference; final look is ours)

| Resource | What it is | Licence | Fit | Verification |
|---|---|---|---|---|
| [Quaternius Medieval Village MegaKit](https://quaternius.com/packs/medievalvillagemegakit.html) ([itch](https://quaternius.itch.io/medieval-village-megakit)) | 300+ modular pieces: walls, roofs, stairs, doors, windows; OBJ/FBX/glTF; "Source" tier adds collision meshes and `.blend` files. | CC0 | Closest to the 20-piece test kit's modular needs. Clean and colourful: would need a damage and material pass to read as poor and weather-beaten. Useful to learn module dimensions and pivots (§51, §52). | search |
| [Kenney Survival Kit](https://www.kenney.nl/assets/survival-kit) | ~80 models: crates, barrels, tents, campfire, tools; glTF. | CC0 | Props for the courtyard slice (barrel, crate, firewood are three of the 20). | search |
| [Kenney Graveyard Kit](https://kenney-assets.itch.io/graveyard-kit) | ~80–90 models: dead trees, fences, rubble, gravestones. | CC0 | Dead tree, crooked fence, rubble cluster: grimdark-friendly shapes. | search |
| [Kenney Nature Kit](https://kenney.nl/assets/nature-kit) | 330 models: trees, rocks, grass. | CC0 | Dry grass, bare trees. | search |
| [Kenney Castle Kit](https://opengameart.org/content/castle-kit) | 75+ stone walls, towers, gates. | CC0 | Stone wall and corner reference. Too tidy for the final look. | search |
| [KayKit Medieval Builder Pack](https://kaylousberg.itch.io/kaykit-medieval-builder-pack) (legacy) | 200+ stylised medieval scenery pieces. Marked legacy; the Hexagon pack is the maintained successor. | CC0 | Reference. Modularity of walls and roofs not confirmed from the listing. | search |

## Textures (shared material library, brief §12)

| Resource | What it is | Licence | Fit | Verification |
|---|---|---|---|---|
| [Poly Haven cobblestone_floor_001](https://polyhaven.com/a/cobblestone_floor_001) | Tagged cobblestone, mud, path, uneven, medieval. | CC0 | Worn cobblestones with mud. | search |
| [Poly Haven wood_planks](https://polyhaven.com/a/wood_planks), [raw_plank_wall](https://polyhaven.com/a/raw_plank_wall), [weathered_brown_planks](https://polyhaven.com/a/weathered_brown_planks), [plank_flooring_03](https://polyhaven.com/a/plank_flooring_03) | Weathered, worn timber. | CC0 | Weathered timber material. | search |
| [ambientCG](https://ambientcg.com) | ~2,000 PBR materials, all CC0, commercial use and redistribution allowed. Ground, mud, cobblestone and plank families exist; specific asset ids were not confirmed in this scan. | CC0 | Second source for the same library. Search the site directly. | search |

## Audio

| Resource | What it is | Licence | Fit | Verification |
|---|---|---|---|---|
| [Kenney RPG Audio](https://www.kenney.nl/assets/rpg-audio), Impact Sounds, [UI Audio](https://godotengine.org/asset-library/asset/796) | Footsteps, cloth foley, coins, impacts, interface sounds. | CC0 | Placeholder footsteps, pack sounds, UI. | search |
| [Freesound](https://www.freesound.org/help/faq) with the CC0 filter | Per-clip licences; the filter works but each file's licence must still be read. | per clip | Wind, fire crackle, timber creaks: available in volume, each clip checked and logged. | search |
| [OpenGameArt CC0 sounds library](https://opengameart.org/content/cc0-sounds-library) | Community CC0 collection (2012); includes a birds-and-wind pack. | CC0 | Thin and old; a fallback. | search |

Medieval ambience packs found on asoundeffect, Artlist, Fusehive and SoundFellas are paid or
licence-unclear and are not listed as candidates.

## Blender → Godot pipeline facts (for the asset contract, supplement §51)

From the Godot 4.3 documentation on import node-name suffixes (**docs**): `-col` (static
trimesh collision from the mesh), `-convcol` (convex), `-colonly` (collision, mesh removed),
`-convcolonly`, `-occ` / `-occonly` (occluders), `-navmesh`, `-rigid` (RigidBody3D), `-vehicle`,
`-wheel`, `-noimp` (dropped on import); `-loop` / `-cycle` on animation names set looping. The
docs do not list `-area`. Separators `-`, `$` and `_` are accepted. Godot recommends glTF 2.0 and
Blender 3.5 or newer for the exporter; importing `.blend` directly needs Blender installed on
every machine, which conflicts with appendix §69 ("do not make the runtime depend on an artist's
machine"), so **export GLB and commit the GLB**. One Blender unit = one metre; apply transforms
before export. The paid "Godot Pipeline" Blender add-on is not needed for this.

## What was not found

A ready Godot 4.3 example combining server authority, a dedicated headless server and client
prediction. We now have our own (`scripts/net/`), which is the one to keep.
