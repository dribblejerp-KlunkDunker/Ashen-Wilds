# ENV-001 source assets: crate r01 and barrel opt01

This commit stages editable source generation, not directly imported GLBs. It does not replace project.godot or modify existing scenes, gameplay, networking or CI.

## Generate the models

Use a Python virtual environment. Tested locally with Python 3.12, NumPy 1.26.4 and SciPy 1.13.1:

```sh
python3 -m pip install -r tools/env001-requirements.txt
python3 tools/generate_env001.py
```

The generator writes two real GLBs under assets/environment/env001/models. It checks their triangle counts and expected SHA-256 before writing, and refuses to replace changed model files. A different numerical library/platform may change triangulation; a checksum failure is a stop for review, not permission to bypass validation.

- env_crate_closed_a_r01.glb: 652 triangles; 0.80 x 0.60 x 0.60 m.
- env_barrel_closed_a_opt01.glb: 646 triangles; approximately 0.65 m diameter, 0.90 m high.
- Meters, Y-up, ground-centered origin.
- Five used material groups each; solid-color materials, no UVs or image textures.

After generation, import with the project's Godot 4.3-stable setup. The generated GLBs are not committed by this source-only change. No courtyard integration, collision wrappers, inventory behavior or multiplayer changes are included.

## Status and provenance

Generation was executed locally and both outputs matched the hashes of the earlier Godot import-review package. The geometry was reconstructed from recorded generators, not recovered byte-for-byte from earlier standalone asset attachments.

The barrel's appearance received positive owner review. That is not engine certification. The crate remains a candidate. Godot import, Forward+ lighting, collision response, performance and the repository regression suite have NOT run in this environment. Previous moving-light previews were offline diffuse diagnostics, not engine screenshots.

Separate collision wrappers and lighting review scripts remain in the earlier attachments and are not part of this focused source commit.
