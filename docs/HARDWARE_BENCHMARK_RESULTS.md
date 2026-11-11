# Launcher results and automated tests

Companion to HARDWARE_BENCHMARK.md. This documents launcher schema 2; it does not report a new performance or multiplayer pass.

## Repeatable tests without Godot

From the repository root:

```sh
python3 -m unittest discover -s tests -p 'test_hardware_benchmark.py' -v
```

The suite copies the actual tools/hardware_benchmark.py into a temporary project and executes it against a fake engine. It does not rewrite the real game, use a real save, launch Godot, or require third-party Python packages. It covers clean exits, version capture, engine errors, time limits, missing executables, relative paths, forwarded multiplayer arguments, renderer arguments, merged logs and invalid duration. The fake-executable tests are POSIX-only and skipped on Windows.

The new repeatable suite has not been executed in the authoring session. Earlier nine ad hoc checks passed against the proposed replacement launcher, but that is not a result for this suite. The interrupt path and forced-kill fallback are not covered by this suite.

## Exit codes and outcomes

| Launcher exit | Outcome | Meaning |
| --- | --- | --- |
| 0 | exited_cleanly | Child process returned zero; not a benchmark pass |
| 1 | exited_with_error or launch_error | Child returned nonzero or launch/handling raised an OS error; inspect logs |
| 2 | no report guaranteed | Argument parsing failed |
| 124 | time_limit_reached | Launcher stopped the child at its configured time limit; incomplete, not success |
| 130 | interrupted | Keyboard interrupt handled during child wait |

The child returncode is separate from launcher_exit_code. An engine error code is preserved in the JSON even though the launcher returns 1. Forced termination is not evidence of a game crash or clean persistence. Close the game normally for save/shutdown tests.

## Schema 2 provenance

run.json records engine_version_probe, source_revision_probe and source_status_probe. Each successful probe invocation includes returncode, stdout and stderr; an invocation failure or timeout records error. A nonzero Git probe is not a valid revision. A failed version probe does not prevent a launch; review its result before interpreting evidence. Version recording does not enforce the project's engine pin.

source_status_probe uses git status --porcelain --untracked-files=normal: empty stdout with returncode zero indicates no reported tracked/untracked changes, not the absence of ignored assets. Source metadata is captured before the game starts. It is not a full content hash or proof that files stayed unchanged during the run.

requested_renderer is the requested command-line setting, not an independently verified active renderer. fps_measured and multiplayer_verified remain false; benchmark_pass remains null. No FPS, frame times, GPU timings or memory metrics are collected.

Engine and Git probes each have a ten-second timeout. The timed child interval starts after those probes, so total wall-clock runtime can exceed requested_seconds. Reports contain local executable paths, platform details and potentially identifying player arguments: inspect before sharing.

## Outstanding validation

Run this repeatable suite and the applicable CLAUDE.md verification commands before merge. Then test rendered Godot runs on actual hardware under both renderers. Do not treat fake-engine tests as an engine, graphics, FPS, LAN or internet multiplayer result. No default renderer or engine pin is changed by this tooling.
