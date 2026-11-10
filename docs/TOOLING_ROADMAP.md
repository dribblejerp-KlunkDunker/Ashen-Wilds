# Asset and code tooling roadmap

Prepared 2026-11-09. Status: staged proposal, not installed tooling. This supports docs/ROADMAP.md; it does not replace the multiplayer milestones.

## Hardware and safety policy

- The owner's current RAM, GPU, VRAM, operating system and available disk space are unverified. Do not assume a suitable local development workstation.
- Start with repository documentation and check-only tooling on hosted CI. Nothing here installs software on the owner's device. CI has its own limits; measure resource use rather than assume unlimited capacity.
- Distinguish system RAM from GPU VRAM. TRELLIS.2's documented reference requirements include Linux and an NVIDIA GPU with at least 24 GB of memory; system RAM alone does not satisfy that GPU requirement. Recheck requirements for the pinned revision before installation.
- No paid runners, GPU provisioning, account connections, third-party image uploads or public runtime-control endpoints without specific approval.
- Pin dependencies, review licenses and preserve source assets. Do not run unreviewed repository installation scripts.
- Keep existing gameplay, networking, collision and save behavior unchanged during tooling adoption. No repository-wide formatting or bulk plugin installation.

## 0. Production engine baseline

PR #34 aligns ENV-010 validation with the existing Godot 4.7.2 production pin. At the 2026-11-09 inspection, both push and PR validation/Godot jobs and the build passed. Pages/release were skipped. The PR was still a draft and unmerged. This is a recorded observation, not a live status assertion.

Next: review, obtain approval to mark ready and merge, then verify main. Retain archive checksum, exact engine version verification, Dummy audio, strict errors, two traversal runs and eight image captures. Screenshot generation is not visual approval.

## 1. Check-only code tooling

Candidate: https://github.com/Scony/godot-gdscript-toolkit

Inspect current dependency configuration, choose a pinned version, and test parsing/linting on representative project GDScript. Record existing findings before adding enforcement. Do not mass-format source or hide existing failures.

Acceptance: supported syntax parses; a deliberately invalid fixture fails; diagnostics are actionable; existing engine/network checks remain green. Run on an isolated CI environment rather than requiring a local install.

## 2. Runtime and visual feedback

Candidate: https://github.com/Fulviuus/godot-mcp

Evaluate in an isolated project copy on an actual Godot-capable host with a compatible MCP client. Inspect licenses, dependencies and permissions. Keep control private/local, restrict capabilities, and prove any development bridge is excluded from release builds. Repository discovery is not proof this chat can call the service.

Acceptance: retrieve a real intentional error, inspect a running scene, exercise movement and capture all four camera views. If connectivity is unavailable, retain CI-based evidence collection; do not claim direct runtime access.

## 3. Reproducible GLB preparation

Candidates:
- https://github.com/KhronosGroup/glTF-Tutorials/tree/main/BlenderGltfConverter
- https://github.com/donmccurdy/glTF-Transform

Build a pinned background-mode asset preparation process: source model -> scale/orientation/pivot checks -> material preparation -> GLB export -> optional measured optimization -> Godot import -> screenshots. The Khronos example is a starting pattern, not a complete cleanup system.

Manifest fields: source/license, tool versions, units, bounds, vertex/triangle/material counts, texture dimensions, hashes, seed where relevant and collision policy. Preserve originals; test each optimization and compression extension in Godot before adoption. Measure CPU/RAM usage on the execution host.

Acceptance: reproducible equivalent geometry/material results, successful import and no unintended appearance change.

## 4. Coherent materials

Candidate: https://github.com/RodZill4/material-maker

Trial limestone, damp mortar, weathered timber and rusted iron; add cloth later. Pin export settings and inspect input-graph/texture licenses separately. Verify batch-export rendering and memory requirements on the chosen host before promising headless execution.

Acceptance: consistent scale and material response across three representative props under actual game lighting and all four views.

## 5. Ruined stone pillar benchmark

Proposed reference: one broken limestone pillar approximately 1.8 m tall and 0.55 m wide, irregular damaged top, chipped edges, restrained lower moss and dirt. No surrounding scene. Dimensions are test targets, not final level metrics.

Create a controlled authored/procedural baseline first, honestly labeled by method. Deliver source, GLB, material inputs, manifest, simple separate collision and four-view images. Establish geometry/texture budgets from measured gameplay performance rather than invented universal limits.

Acceptance: readable at gameplay scale, correct ground contact and pivot, no invisible movement blockers, complete provenance and explicit visual review.

## 6. Structured gameplay tests

Evaluate one framework, not both as permanent dependencies:
- https://github.com/bitwes/Gut
- https://github.com/godot-gdunit-labs/gdUnit4

Verify the selected version against Godot 4.7.2 with a small representative test set. Preserve smoke_test.gd and net_spike.py. Add focused tests for cooldowns, duplicates, invalid inputs, health and save migration as combat implementation begins.

Acceptance: intentional defects are caught, machine-readable results are available, timing-sensitive cases pass twice. Tooling must not silently decide protocol, death/recovery or persistence policy.

## 7. AI prop generation experiment

Candidate: https://github.com/microsoft/TRELLIS.2

Blocked until a suitable GPU runtime, license/dependency review and any cost/upload approval exist. Do not install locally merely because it is on the roadmap. Use an owned/licensed reference image; record model revision, parameters, seed where supported and generation time. Prepare output using the same pipeline as the controlled pillar baseline.

Acceptance: actual generated mesh plus cleaned GLB improves the in-game result enough to justify its runtime and cleanup costs. An illustration or procedural stand-in is not a TRELLIS result. Rejecting the tool after testing is a valid outcome. Hunyuan remains separately gated by its license restrictions.

## 8. Measure value and resume the playable slice

Compare test duration, resource use, asset preparation effort, GLB complexity/size, frame time and defects against the baseline. No percentage speedup claims without measurement. Keep only tools that help.

Resume gameplay roadmap 1.2/1.3: adopt the multiplayer contracts, resolve open death/recovery decisions, then implement server-owned health and one goblin fighting two players. Do not let tooling replace gameplay indefinitely.

## Immediate execution order

1. Commit this roadmap on the isolated tooling branch.
2. Complete the engine-fix review and verify main after an approved merge.
3. Inspect existing dependency setup and prepare a small pinned, check-only gdtoolkit trial.
4. Design the asset manifest and CPU-friendly inspection checks in parallel.
5. Advance host-dependent phases only after their hardware, security and cost gates are met.

Each write, service provisioning and merge requires its own scoped approval. Creating this document performs no installation, GPU job or gameplay execution.
