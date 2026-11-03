# ENV-005: existing-kit variations

Six new standalone GLBs derived from the ENV-003 timber, roof and fence definitions. Additive only: no existing models, gameplay scenes, collision, controllers or main-branch files are changed.

| Asset | Triangles | Variation |
| --- | ---: | --- |
| env_wall_plank_crossbraced_b | 428 | Crossing braces plus original small repair |
| env_wall_plank_repaired_c | 472 | Reversed brace and three substantial timber patches |
| env_roof_shingle_fine_b | 768 | Seven courses with narrower staggered shingles |
| env_roof_shingle_timber_patch_c | 420 | Standard courses with three timber overlay repairs |
| env_fence_rail_intact_b | 176 | Continuous upper/lower rails; no fallen debris |
| env_fence_rail_repaired_c | 308 | Broken upper rail bridged and tied with new timber |

## Generate the GLBs

From repository root, in a Python virtual environment:

```sh
python3 -m pip install -r tools/env001-requirements.txt
python3 tools/generate_env005.py
```

Tested with Python 3.12, NumPy 1.26.4 and SciPy 1.13.1. The editable generator is self-contained. It emits six GLBs into this folder's exports/ and checks existing outputs before writing. Changed outputs are refused, not overwritten. Compare generated hashes with manifest.json.

## Placement

Meters, Y-up. Walls remain 2m wide x 2.4m high x .19m deep, ground-centered, with x endpoints at -1m and +1m. Fences retain the original posts at x = +/-0.9m and nominal 2m rail span; ground-center pivot. Neither intact nor repaired fence is advertised as passable.

Roof pivots remain the ridge anchor, not the ground. Both slopes retain 2m ridge length, 1.4m run, .8m rise and original rafter geometry. Eave rafter underside is y = -1m, so the earlier 2.4m support uses the same 3.4m ridge placement. Roof variants are interchangeable, but actual seam appearance still needs an engine review.

## Delivered files versus repository

The conversation download contains the six actual GLBs, editable generator, manifest, validation report and source-mesh contact sheet. This repository commit contains the generator, manifest and this README. Binary GLBs and preview images are not uploaded through the text-only connector. Running the generator creates the exact checked exports with the pinned dependencies.

## Validation scope

Checked locally: GLB chunk/buffer layout, finite positions and unit normals, nondegenerate triangles, six unique output hashes, ground/ridge anchors, wall bounds, roof footprint and rafter alignment, deterministic regeneration and changed-output refusal. Brace overlaps, timber repair overlays and fence rail/post overlaps are intentional visual construction intersections, not manifold solid unions.

No engine import, collision, player-clearance, rendering-performance or networking tests. No physics bodies, animation, UVs or image textures. Previews render the generated meshes offline; they are not Godot screenshots. Validation report records these limits.
