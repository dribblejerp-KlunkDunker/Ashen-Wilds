# ENV-006 collision source and Godot validation

Thirty generated StaticBody3D wrappers: 10 walls, 10 roof slopes and 10 fences, using 145 BoxShape3D definitions. Source: tools/generate_env006_collisions.py. It uses the existing ENV-006 visual generator, ENV-005 primitives, shared helpers and the ENV-007 scene writer. The generator verifies visual file hashes AND regenerated source hashes before writing any outputs.

Run after visual generation:

    python tools/generate_env006_collisions.py assets/environment/env006 --replace-existing

Walls use one solid envelope box. These wall variants have no doorway apertures; the separate ENV-004 doorway is not changed. Roofs use an oriented box around decking/shingles plus four oriented rafter boxes. Raised timber patches are decorative, without separate collision. Roof origins remain ridge anchors. Fences use separate boxes for posts, rails, pickets and repairs; diagonal pieces use an oriented fit instead of a large axis-aligned blocker. Chamfers and board gaps within wall panels are simplified.

Instance the generated *_collision.tscn rather than adding another raw GLB instance. Layer 1 is Environment; static mask 0 is retained. Outputs are generated files: modify the source recipe and review --replace-existing, not hand-edited scene changes. main, project.godot, playable scenes and visual GLBs are not modified by this source addition.

CI runs tests/test_env006_collisions.gd in Godot 4.7.2 with 30 scenes at identity and translated/90-degree-yaw placements (60 cases). Checks cover mesh imports, enabled box counts, wall blocking/end clearance, sloped roof heights/normals, rafter underside, fence posts/rails and small probe clearance through a fence gap. That gap is NOT certified as a walkable opening. The existing ENV-007 suite remains active (48 cases). Both must pass before any generated output commit.

The isolated runner avoids gameplay autoloads and retains logs plus JSON reports as artifacts. Python fixture/analytic checks are not an engine pass. Box fits are conservative; they are not exact mesh unions. Player traversal, roof walking, world placement, structural loading, dynamic-body interaction, screenshots and performance profiling remain separate tasks. Roofs and fences are static, not breakable or simulated structures. The authoritative engine result is the CI report, not the presence of source files.
