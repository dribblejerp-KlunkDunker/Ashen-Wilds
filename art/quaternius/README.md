# Quaternius survivor art (CC0)

The survivor (decision P15 in `docs/PRODUCTION.md`): a rigged, animated character with adult
proportions, replaceable later by the team's own mesh on the same humanoid rig. It replaced a KayKit
stand-in that the owner judged too cartoonish for the setting (2026-11-03).

| File | From | Notes |
|---|---|---|
| `survivor/Male_Ranger.gltf`, `.bin` | [Modular Character Outfits - Fantasy](https://quaternius.itch.io/modular-character-outfits-fantasy), Standard (free) tier, `Exports/glTF (Godot-Unreal)/Outfits/` | Unchanged. |
| `survivor/T_Ranger_*.png`, `survivor/T_Regular_Male_*.png` | The same folder | Downscaled from 4096 and 2048 px to 1024 px (the survivor is small on screen; it keeps the browser download down). Names kept, so the glTF still finds them. |
| `survivor/survivor_outfit_basecolor.png`, `survivor_skin_basecolor.png` | Made here from `T_Ranger_BaseColor.png` and `T_Regular_Male_Dark_BaseColor.png` | Greens turned to dark, dirty oilcloth, leather dulled, a fixed-seed grime laid over; skin paler and duller. Rebuild with `python3 tools/recolor_survivor_texture.py`. |
| `animations/UAL1_Standard.glb` | [Universal Animation Library](https://quaternius.itch.io/universal-animation-library), Standard tier, `Unreal-Godot/` | Locomotion, sword idle, torch idle, roll, hits, death, interact, kneeling, punches. |
| `animations/UAL2_Standard.glb` | [Universal Animation Library 2](https://quaternius.itch.io/universal-animation-library-2), Standard tier, `Unreal-Godot/` | Sword swings and lunge, shield guard, shield hit, guard break, knockback, consume. Also zombie clips, for later enemies. |
| `LICENSE-*.txt` | The three downloads, verbatim | All CC0 1.0. Credit is optional; we give it anyway: **Quaternius** (quaternius.com). |

All three share one 65-bone humanoid skeleton, so the clips drive the outfit directly. Downloaded
2026-11-03 from the official itch.io pages; every licence file was read before anything was
committed (brief §59).

Godot's importer strips a `_Loop` suffix from clip names (and loops those clips): `Idle_Loop` is
`Idle` in game. `scripts/player/survivor_model.gd` loads all of this and exposes the hand sockets.
