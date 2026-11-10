# Procedural environment prototype pack

32 native Godot scenes: 8 archetypes x 4 size/seed variants. These are NOT 32 unique handcrafted models, baked GLBs, or production-approved assets. All scenes share factory.gd and generate on load, including editor use via @tool.

Kinds: stone pillar, damaged supply crate, barrel, fence segment, bench, low stone wall, rubble cluster and stump. Variant scale factors: 0.85, 0.95, 1.05, 1.15. Material tones are seed-dependent; rubble placement also varies. Stone and wood are flat rough colors, without the richer textures in the individual experiments. Barrel bands are solid decorative cylinders, not hollow hoops. These are deliberately simple blockout silhouettes.

Target: project's Godot 4.7.2-stable. Keep the directory together. Open one TSCN at a time to inspect it; do not load all 32 on a constrained PC. Select its root and use Rebuild Now after changing exported settings. Generated children are disposable and regenerated, not serialized authored nodes.

Collision: environment layer 1; component boxes preserve fence and bench gaps. Barrel/stump collision is a conservative bounding box, not a fitted cylinder. Decorative pieces may also be solid. Validate the real player against every approved variant; do not shrink the controller to force clearance. Many separate nodes mean draw calls and performance are unmeasured; batch meshes only after visual acceptance.

Run on a Godot-capable host from the project root:

    godot --headless --path . --import
    godot --headless --path . --script res://assets/procedural_pack/test_pack.gd

The supplied test checks all scenes sequentially for generation, materials, basic node structure and regeneration cleanup. It does not test rendering, exact physics clearance, network behavior or performance. No Godot execution has run during preparation of this pack. No visual approval is claimed.

No loot, inventory, network object ids, fixture functionality, door logic, live-level placement, external packages or local installations. Existing environment assets are untouched. Validate in an isolated scene before integration. Source is procedural GDScript, not AI output.

Generated scripts and scenes: CC0-1.0 dedication to the extent possible under law. Godot remains under its own license.
