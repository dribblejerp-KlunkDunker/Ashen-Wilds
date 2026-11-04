# ENV-007 static collision source and CI validation

The source generator emits all 24 crate/barrel wrappers: 121 BoxShape3D definitions total. Open-barrel counts are revision 3: 10 empty, 11 crossbar, 13 partial lid. Closed crates use bounding boxes; closed barrels use five stacked boxes (seven for handles). Open crates use 14 boxes, or 16 with braces. Hollow interiors are not replaced by solid boxes.

Generate from repository root after visual generation:

    python tools/generate_env007_collisions.py assets/environment/env007 --replace-existing

The generator verifies every GLB hash against the visual manifest before writing any files. It emits StaticBody3D scenes on Environment layer 1, mask 0, referencing res://assets/environment/env007/exports/. Instance the wrapper instead of a second raw GLB. Changed outputs require --replace-existing; generated scenes are source-controlled outputs, so edit the generator rather than hand-editing the wrappers.

The asset workflow generates visuals/colliders, downloads Godot 4.3-stable from the official release, copies the assets to an isolated temporary project, imports them and runs tests/test_env007_collisions.gd. It commits generated outputs only after the report says all 48 cases passed. The workflow also watches env_variation_common.py and the test source. main, project.godot and gameplay scenes are untouched.

The engine suite loads 24 scenes at identity and translated/90-degree-yaw placements. It checks enabled box counts, layer/mask, visual mesh presence, solid blocking, hollow/floor/side paths, crossbar and partial-lid blocking, small sphere overlaps and outside clearance. Failed checks exit nonzero; logs and JSON report are saved as Actions artifacts. CI success certifies only those checks. Local Python/text tests are not labeled as an engine pass.

Conservative box proxies over-block round corners. Open barrels retain a straight octagonal shell instead of the bulged visual profile. Crossed floors overlap and lid edges are rectangular. This is not precise container capacity, dynamic-body behavior, player-controller traversal, full-game regression, screenshot approval or performance certification. The isolated project deliberately does not run gameplay autoloads. It does not make the props roll or become pushable.
