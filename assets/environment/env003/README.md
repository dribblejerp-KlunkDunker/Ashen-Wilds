# ENV-003: timber and roof source assets

Five new draft assets: rough plank wall, timber support post, shingle roof slope, matching ridge cap and broken rail fence. This is a source-based package; GLBs are generated locally, not committed directly.

## Generate

Use a Python virtual environment. Tested with Python 3.12, NumPy 1.26.4 and SciPy 1.13.1:

```sh
python3 -m pip install -r tools/env001-requirements.txt
python3 tools/generate_env003.py
```

Outputs under `assets/environment/env003`: five GLBs in `exports/`, component geometry in `source/`, `generated-assets.json`, and a geometry-only shelter assembly in `review/`. The generator checks counts, expected hashes, basic geometry and eave/post alignment, then refuses to overwrite changed outputs. Review version/platform differences rather than bypassing a failed checksum.

Triangle counts: plank wall 384; post 44; roof slope 384; ridge cap 24; fence 264. Total for one of each: 1100 triangles.

## Critical placement conventions

Meters, Y-up. Wall, post and fence origins are ground-level. Roof slope and ridge cap origins are at the ridge reference and their geometry extends BELOW local Y=0. Do not auto-ground roof modules or recenter their pivots.

Roof run 1.4 m, nominal rise 0.8 m, module length 2 m. Place the ridge reference at y=3.4 m to align eave-rafter undersides with the 2.4 m supports. Rotate the second slope 180 degrees around Y. The generator includes a reference assembly using one rear wall, two front posts, two slopes, one ridge cap and a fence. It is not a production building prefab or structural-load certification.

## Validation and limits

The source was reconstructed from the recorded ENV-003 generator. Current exports were executed and checked locally: 35 internal checks, deterministic repeated generation, expected hash checks, changed-output refusal and numerical support alignment. Earlier attachment bytes were not independently recovered.

All assets remain draft visual candidates. Materials use shared base colors; no UVs or texture maps. No collision bodies, interaction code, animations or network behavior are included. Positive signed component volumes are an orientation sanity check, not global watertightness certification. Intentional overlaps remain in shingles, framing and ridge geometry.

Godot import, actual Forward+ appearance, collision response, performance and repository regressions have NOT run here. Prior PNGs were offline mesh renders, not engine footage. This commit does not change project.godot, existing scenes, earlier batches, gameplay, networking or CI. Review images are not included in this focused source commit.
