# Ashen Wilds

A grounded, isometric dark-survival action game built in Godot. Thirty years into the Smothering, people survive in the Blackfen through scavenging, difficult journeys and obligations kept or broken. No prophecy is coming.

## Play and project direction

- [Browser prototype](https://dribblejerp-klunkdunker.github.io/Ashen-Wilds/): the single-player slice. Click the game to give it keyboard focus.
- [Playtest downloads](https://github.com/dribblejerp-KlunkDunker/Ashen-Wilds/releases/tag/playtest): desktop clients and dedicated server.
- `main.tscn`: preserved single-player prototype, including committed melee, stamina, scavenging, equipment, weather, perception and Act I objectives.
- `net_main.tscn`: networked courtyard development, with server-owned shared state. Browser builds do not currently support its network transport.
- `launcher.tscn`: configured entry scene; selects the prototype or networked mode from launch arguments.

The current direction is a two-developer, two-player-first 3D survival game. Read [the production record](docs/PRODUCTION.md) for network operation, decisions and milestone evidence. Do not mistake proposed worldbuilding for shipped features.

## Run locally

Repository guidance pins Godot 4.7.2-stable, standard build, not .NET. Desktop Forward+ rendering needs a suitable Vulkan-capable GPU. Do not upgrade the project editor version casually.

```sh
git clone https://github.com/dribblejerp-KlunkDunker/Ashen-Wilds.git
cd Ashen-Wilds
godot --path . --editor
```

Open `project.godot`, allow art imports to finish, then press F5. Alternatively run `godot --path .` with the pinned executable available as `godot`. Network launch details belong to `docs/PRODUCTION.md` and generated build instructions, not guessed command lines here.

## Single-player controls

| Input | Action |
| --- | --- |
| WASD / Shift | Move / sprint |
| Mouse / LMB | Aim / light attack |
| Q or Shift+LMB | Heavy attack |
| RMB / Space | Shield / evasive step |
| E / Tab | Interact / pack |
| B / G | Bandage / quicklime |
| 1, 2, 3 / 4 | Weapon / off-hand |
| F / R | Companion follow-hold / respawn |
| Mouse wheel | Zoom |
| [ and ] / - and = | Brightness / camera shake |

These are prototype controls, not a promise of identical multiplayer behavior.

## Repository map

| Path | Purpose |
| --- | --- |
| `project.godot`, `*.tscn` | Engine configuration and launch scenes |
| `scripts/`, `shaders/`, `scenes/` | Gameplay, rendering and scene work |
| `art/`, `assets/` | Imported art and the project environment kit |
| `tests/`, `tools/` | Regression checks, build/export and development tools |
| `docs/PRODUCTION.md` | Current production and multiplayer working record |
| `docs/ROADMAP.md`, `docs/TOOLING_ROADMAP.md` | Planning |
| `docs/worldbuilding/` | Proposed world bible and adventure material |
| `docs/screenshots/` | Prototype screenshots |
| `CLAUDE.md` | Agent/contributor workflow, architecture and verification |

## Drowned Measures: proposed adventure material

- [Player forecasting playbook](docs/worldbuilding/drowned-measures-playbook.md): Read the Ground, the Cutwardens, Rootstone Witness, orchard/regional events and Valid When Issued.
- [Cutwarden adventure pack](docs/worldbuilding/cutwarden-adventure-pack.md): opening dispute, meeting Sella, downstream salvagers, threatened households, GM clock and d20 canal encounters.
- [Worldbuilding index](docs/worldbuilding/README.md) and [canon precedence](docs/worldbuilding/CANON.md).

The playbook is copied unchanged from the legacy repository's commit `b46237b50b9aa1244e394b165364ad0ac5c6b5f6` (file blob `69c2e4eb3cd86f195e76a46ab7f7caccb46888ae`). Its references to the Silt Readers source file and quarry package describe legacy companion material; those dependencies are not migrated by this batch. Named legacy people and places remain proposed, not implemented NPCs. This is a content copy, not a transfer of Git history or deletion from the old repository.

The custom d20 rules, time costs and GM clocks are tabletop/design proposals. They do not change the Godot simulation, saves, HUD, multiplayer authority or campaign time.

## Verification and contributing

```sh
godot --headless --path . --import
godot --headless --path . --script res://tests/smoke_test.gd
python3 tools/net_spike.py
```

Use the pinned engine. See `CLAUDE.md` for compile checks, collision suites, live boots and exported-build verification. This documentation update did not run Godot or establish a new test count. A successful file commit is not evidence of a successful game build.

Keep multiplayer work alongside the preserved prototype. Clients send intent; the server owns shared outcomes. Read the relevant code and production contracts before changing network behavior. All new project updates target this repository, `dribblejerp-KlunkDunker/Ashen-Wilds`.

## Art and credits

The repository credits Quaternius character/animation material and ambientCG photo textures as CC0; consult the READMEs and licenses under `art/quaternius/` and `art/ambientcg/`. The project's environment kit lives under `assets/environment/`. Asset-specific permissions are not a blanket license for all project code or content.
