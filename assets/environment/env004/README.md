# ENV-004: compatible plank doorway

Source-based addition for the ENV-003 plank-wall family and ENV-002 patched door/frame. This commit does not include binary GLBs or change existing assets, scenes, gameplay or networking.

## Generate

Use a Python virtual environment with the existing pinned requirements (tested: Python 3.12, NumPy 1.26.4, SciPy 1.13.1):

```sh
python3 -m pip install -r tools/env001-requirements.txt
python3 tools/generate_env004.py
```

Outputs under `assets/environment/env004`: the new GLB in `exports/`, editable geometry in `source/`, `generated-assets.json`, and a doorway/reference-door assembly in `review/`. Counts and expected hashes are checked before writing. Changed outputs are not overwritten. Review tool/platform differences rather than bypassing validation.

## Fit and placement

New wall: 452 triangles, 2.00m wide x 2.40m high x 0.19m deep. Meters, Y-up, ground-centered. Rough opening: 1.26m wide x 2.16m high. Existing door/frame: 1.24m wide x 2.15m high. Align both roots without scaling for 1cm side and top construction clearance.

The bottom rail is split and the full-wall diagonal removed. The standalone wall contains no door. Instance the original ENV-002 door separately, preserving its `DoorLeafHinge` at (-0.47,0,-0.095). The generated review assembly reconstructs the recorded door geometry and shares this batch's materials; it is not a byte-identical replacement for the original door GLB.

## Validation limits

Executed locally: export structure, module dimensions, opening separation, 19 sampled door poses, a conservative continuous leaf-envelope check, deterministic regeneration and changed-output refusal. These establish geometric fit only, not hardware clearance, player passage or swept physics behavior.

The source was reconstructed from the recorded doorway generator. Current outputs have verified hashes; earlier attachment bytes were not independently recovered. No Godot import, Forward+ rendering, collision response, performance or repository regression tests ran here. No UVs or texture maps. Collision boxes in generated-assets.json are proposals, not exported physics bodies. A single solid full-wall collider would block the entrance and must not be used.

Nothing is instanced into the playable game by this commit. Prior review PNGs were offline source-mesh renders, not engine screenshots, and are not included here.
