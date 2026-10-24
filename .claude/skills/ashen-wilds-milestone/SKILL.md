---
name: ashen-wilds-milestone
description: "Build, fix or extend a feature in the Ashen Wilds Godot 4.3 game: the plan → test → code → debug → clean → commit loop, with this repo's verify steps, screenshots, docs and git rules. Use for any gameplay, enemy, system, UI or milestone work in this repository, including 'continue the roadmap', 'build the next milestone', 'add an enemy', or 'fix this bug in the game'."
---

# Ashen Wilds milestone loop

A golden loop for this repo: **plan → test → code → debug → clean → commit**, repeated until the feature is done. `CLAUDE.md` is the source of truth for architecture and pitfalls. Read it first, every session. This skill covers how the work moves, not what the systems are.

## 0. Before the first change

- `scripts/setup_godot.sh` (add `--screenshots` if you'll render). Use exactly 4.3-stable.
- Read `CLAUDE.md`, then the milestone's entry in `docs/ROADMAP.md`. For anything visual, also read `docs/VISUAL_DIRECTION.md`.
- Run `scripts/verify.sh` once as a baseline. Anything already failing isn't yours to hide. Say so.
- Design-heavy work (companion AI, a new core system): tell the owner whether a stronger model such as Fable is worth switching to before you start.

## 1. Plan

- Work from the roadmap. If the request is vague ("proceed", "continue"), take the next `planned` row and say which one.
- Write down the numbers (multipliers, ranges, timers) before coding, and mark them *(proposed)*. The design document has the final say, and the owner tunes in playtests.
- Find the seams first. Read the existing system you're extending, e.g. `WeatherSystem.factor()`, `AcousticField`, the enemy's `_sees_player()`. Hook in there rather than adding a parallel path. Check that existing call sites get the new behaviour for free, without touching each one.
- The owner parks things deliberately (e.g. more bestiary creatures). Don't build parked items. Remind the owner about them when handing back, if they asked you to.

## 2. Test

- Add `_test_<feature>()` to `tests/smoke_test.gd` and call it from `_run()` before `_test_act_one()` (the Act I test, then the save test, must stay last).
- Each check should pin one observable fact, labelled in plain words with the measured value, e.g. `"night cold: warmth drains ×1.7 (%.2f)"`.
- Use dummies (`_spawn_dummy_goblin`, `_spawn_dummy_crow`, …), not the world's enemies, and `queue_free` them at the end. Snapshot and restore anything shared that you change: the stash, item data, the clock, the weather, `survival_enabled`, and the camera rig.
- Any new bootstrap flag that makes the world change over time (cycles, drains) must be turned off by both `tests/smoke_test.gd` and `tools/capture_screenshots.gd` before `add_child`. The smoke test boots the world twice (start and save test), so set it in both places.
- New persistent state needs a line in `SaveGame.collect()`, `SaveGame.apply()` and the save test.

## 3. Code

- Typed GDScript, matching the surrounding style (doc comments with `##`, a milestone tag on new behaviour).
- Keep visuals inside each class's `_build_*_visuals*` function. Another agent is making sprites.
- Every enemy joins the `"enemy"` group and implements `is_dead()` and `is_staggered()`.
- New keys: `_unhandled_input` in the bootstrap or `_ensure_input_bindings()`. Also add them to the HUD hint line in `tactical_hud.gd` and to the README controls table.
- Make multi-anchor edits with a script that asserts each anchor occurs exactly once. A silently partial edit has broken this repo before.

## 4. Debug

- `scripts/verify.sh`: compile-check (warnings count as failures), suite, live boot. Use `--twice` after anything timing-sensitive.
- When AI behaviour changed, run a short live simulation with enemies unfrozen and print positions and states. Static tests have missed real bugs, e.g. the Ghoul stuck on its barrow stones.
- Fix the root cause. Never weaken, skip or delete a check to get green. If an old check's assumption really changed, say so in the commit.

## 5. Clean (screenshots and docs)

- **Every push that changes something visible adds or updates a screenshot.** Add a numbered shot to `tools/capture_screenshots.gd` (pose and freeze the scene, set the state directly). Then run `scripts/capture.sh` in the background (10–15 min).
- **Open and look at every new or changed PNG.** If the subject isn't readable (an enemy hidden behind a wall, out of the torchlight, outside the cone), re-pose and re-render. Shots have exposed real bugs before.
- Art, lighting or UI-look changes also get a **visual benchmark run** (`scripts/benchmark.sh 00N-<name> "what changed"`). Re-score the copied rubric, commit the new run folder, and say in the hand-back how the scores moved.
- Re-commit older shots only when their content really changed (for example a HUD line was added). Otherwise `git checkout -- docs/screenshots/<file>` to avoid render-noise churn.
- Update the README: the status line test count, a feature section with the new image, the controls table, the project structure, and "How the pieces fit" if wiring changed. Also update `docs/ROADMAP.md` (status ✅ plus a section) and `CLAUDE.md` (milestone list, test count, a "How the systems connect" bullet, the keybindings line).

## 6. Commit and hand back

- Commit as `sleeves <dribblejerp@gmail.com>`: `git -c user.name=sleeves -c user.email=dribblejerp@gmail.com commit`. Use one commit per milestone, titled `Milestone N: <name>`, with a body listing the mechanics and the new check count. End with the session's attribution trailers. Never put a model name in commits or PRs.
- Push to the working branch. Never force-push `main`. Keep the open PR's description current (milestone checklist, test count).
- Hand back honestly. Say what the tests prove, and that feel, timing, light levels and UI layout still need a real playtest. Give the numbers to tune. Finish with the next roadmap item and any reminders the owner asked for.

## Scripts

| Script | What it does |
|---|---|
| `scripts/setup_godot.sh [--screenshots]` | Installs Godot 4.3-stable to `~/godot`, plus Mesa Vulkan for screenshots |
| `scripts/verify.sh [--twice]` | Import, compile-check, smoke suite, live boot. Non-zero exit on any problem |
| `scripts/capture.sh` | Renders all README screenshots and lists the changed files |
| `scripts/benchmark.sh <run> "label"` | Renders the visual-benchmark shots into a new run folder and scores them against the target mockup |

All four resolve the repo root themselves, so they run from anywhere inside it.
