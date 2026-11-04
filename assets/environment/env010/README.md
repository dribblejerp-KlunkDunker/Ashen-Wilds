# ENV-010 Watchhouse static layout

79 approved instances, 34 existing resource types, two local fixtures. layout_manifest.json stores explicit rows; prepend env010_ to suffixes. Props are built at startup, following the project convention. main, project.godot, network scripts and source assets are untouched.

From project root:

    python tools/validate_env010_manifest.py
    godot --path . res://scenes/environment/env010_watchhouse_courtyard.tscn

Use Godot 4.7.2-stable. Props contains the 79 placements; PreviewServices camera/light/environment helpers are not manifest props. Disable preview_services when embedding in another scene. The fixed preview camera is not the gameplay rig. preview_view selects four angles; no input bindings are added.

The ground/ramp and doorway/post/door colliders are NEW UNVALIDATED adapters. DoorLeafHinge and its offset must match or the builder reports an error. The leaf is posed statically at 90 degrees: no door motion, obstruction handling or multiplayer binding is implemented. Proposed crate identity is metadata only, not a registered server container. No actor or live looting is supplied. Roof visuals are grouped independently of collision.

Inspect env010_build_report metadata for build issues. A successful build count is NOT physics certification. Static manifest checks do not prove actual-controller traversal, ramp/door clearance, side-wall gap behavior, four-view readability or performance. Existing asset suites do not validate this assembled scene. Engine, gameplay and screenshot checks remain the next step; no test success is claimed here.
