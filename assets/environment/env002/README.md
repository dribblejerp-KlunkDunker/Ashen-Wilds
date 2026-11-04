# ENV-002: five environment source assets

This stages the stone corner, damaged low wall, patched door/frame, tied firewood bundle and small rubble cluster beside ENV-001. Actual GLBs are generated locally; they are not directly committed by this source-only change.

## Generate

Use a Python virtual environment. Tested with Python 3.12, NumPy 1.26.4 and SciPy 1.13.1. Reuse the existing pinned requirements:

```sh
python3 -m pip install -r tools/env001-requirements.txt
python3 tools/generate_env002.py
```

Outputs under `assets/environment/env002`: five GLBs in `exports/`, editable component geometry in `source/`, and `generated-assets.json`. The generator validates triangle counts and expected SHA-256 before writing, checks 19 door poses, and refuses to overwrite changed outputs. Different numerical-library/platform results must be reviewed, not silently accepted by bypassing checks.

## Placement

Meters, Y-up. The corner origin is the ground-level centerline elbow, not its bounding-box center. Connection planes are x=1 and z=1; centers for adjacent nominal 2m wall modules are (2,0,0) and (0,0,2). Those are placement conventions, not proof of a finished seamless assembly.

The door exports `DoorLeafHinge` at (-0.47,0,-0.095). Rotate it around local Y. No door animation, controller, physics bodies or network interactions are included.

## Status

Triangle counts: corner 1780; low wall 896; door 680; firewood 584; rubble 440. Materials use shared base colors, without UVs or texture maps. These remain visual candidates.

The source was reconstructed from the recorded batch. Current generated hashes and counts were checked locally; earlier attached GLB bytes were not independently recovered. Repeat generation and changed-file refusal passed. The generated-assets.json file records output dimensions and hashes; validation limits are stated below.

Godot import, actual wall assembly, collision response, Forward+ lighting, runtime performance and the repository regressions have NOT run here. Earlier images were offline source-geometry previews, not engine footage. This commit does not modify project.godot, existing scenes, ENV-001, gameplay, networking or CI. Review images and the separate diagnostic scripts are not included in this focused source commit.
