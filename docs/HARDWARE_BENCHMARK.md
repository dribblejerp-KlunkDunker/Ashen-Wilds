# Hardware and two-player benchmark

Status: proposed test tooling; not executed or Godot-validated in the authoring session. No FPS results, renderer approval, or multiplayer pass is claimed. Existing project settings, launch scenes and network code are unchanged. Use the engine pinned by README.md and docs/PRODUCTION.md; do not upgrade it for this test.

## Renderer comparison

From the repository root, substitute the actual executable path:

```sh
python3 tools/hardware_benchmark.py --godot /path/to/godot --renderer gl_compatibility --seconds 120 --label compatibility
python3 tools/hardware_benchmark.py --godot /path/to/godot --renderer forward_plus --seconds 120 --label forward-plus
```

The launcher requests a windowed 1280x720 viewport and an explicit renderer for that process only. It does not rewrite project.godot. Each run writes engine.log and run.json beneath builds/hardware-benchmark in a unique directory. Confirm the actual renderer and GPU in the engine log; a requested renderer is not evidence that it initialized. Output contains local paths and system details: review before sharing.

Use the same character, route, camera angles, weather and interactions for both runs. Finish the background selection before judging play. First-time shader compilation and imports can distort results; perform a warm-up, then three measured repeats. Keep power mode, other applications and display settings fixed. Record CPU, GPU, RAM, OS, engine version and source commit.

This runner records process duration and logs, NOT FPS, GPU timings, memory usage or automatic visual correctness. Measure frame rate and frame times separately using Godot's profiler in an equivalent editor session or an external tool, and identify that tool in the results. Record median FPS, slow-frame behavior, visual defects and whether movement/camera/container interaction works. Do not infer performance from successful startup.

At the time limit the runner terminates the process; that is not a clean game shutdown, and the resulting return code is not a crash verdict. Close the game normally before the limit when checking clean shutdown or persistence.

## Two-player test

First run the existing automated LOCAL loopback test:

```sh
python3 tools/net_spike.py
```

For a human test, use the server and client commands documented in docs/PRODUCTION.md, with distinct player keys. For example, with that server running, launch a measured client:

```sh
python3 tools/hardware_benchmark.py --godot /path/to/godot --renderer gl_compatibility --scene net_main.tscn --seconds 180 --label client-alice -- --client --host 127.0.0.1 --port 7788 --player-key alice
```

Start another client with a different key (bob). Use a disposable server save path via the documented --save option; never test on an important world save. Verify both players see each other's movement, camera controls remain local, competing takes cannot duplicate the last crate item, inventory agrees with server outcomes, and disconnect/rejoin follows the production rules. Shut down the server cleanly when checking save/restart behavior.

A same-machine test does not establish LAN or internet play. Repeat on two physical machines using the server's LAN address, then separately test the intended internet hosting arrangement. Keep exact player count, transport, save path and network conditions with the results. Do not change networking or expose a port merely to run the local benchmark.

## Acceptance and follow-up

No hardware suitability threshold is approved yet. Record observations rather than declaring a pass from a guessed FPS target. Compare appearance as well as speed, especially visibility masks, cutaways, shadows and fog. Preserve Forward+ as the default unless the developers approve a measured change. Before merging, run the applicable verification commands in CLAUDE.md, validate this Python launcher's help/argument handling, and perform real rendered runs under both renderers.
