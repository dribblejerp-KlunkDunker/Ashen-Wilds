# KayKit placeholder art (CC0)

Placeholder survivor for the look-and-feel work (decision P15 in `docs/PRODUCTION.md`): a rigged,
animated character that the team's own mesh can replace later on the same rig.

| File | From | Notes |
|---|---|---|
| `characters/Rogue_Hooded.glb` | [KayKit Adventurers 2.0](https://kaylousberg.itch.io/kaykit-adventurers), Free tier, `Characters/gltf/` | Unchanged. Godot extracts its embedded texture to `Rogue_Hooded_rogue_texture.png` on import. |
| `characters/survivor_texture.png` | Made here from `Rogue_Hooded_rogue_texture.png` | Bright cloth greens turned to dark, worn oilcloth; the rest muted. Rebuild with `python3 tools/recolor_survivor_texture.py`. |
| `animations/Rig_Medium_*.glb` | [KayKit Character Animations 1.1](https://kaylousberg.itch.io/kaykit-character-animations), Free tier, `Animations/gltf/Rig_Medium/` | General, MovementBasic, MovementAdvanced and CombatMelee. Same `Rig_Medium` skeleton as the character, so the clips drive it directly. |
| `LICENSE-Adventurers.txt`, `LICENSE-Character-Animations.txt` | The two downloads, verbatim | Both CC0 1.0. Credit is optional; we give it anyway: **Kay Lousberg, www.kaylousberg.com**. |

Downloaded 2026-11-03 from the official itch.io pages. Both licence files were read before
anything was committed (brief §59).

`scripts/player/survivor_model.gd` loads these, merges the clips into one `AnimationPlayer`, and
exposes the two hand-slot sockets (`handslot.r`, `handslot.l`) the controller hangs items on.
