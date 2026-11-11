# Launcher regression and coverage results

Base commit: 7ce454496ddddc4860429dd7e362db85b5545248.
Launcher Git blob: 0f2be40bb3ec33f7cad7d5f6b8f3c740c9793f90.
Base test Git blob: 8ca652716b9d01b518941ed766ca800baf494ade.
New signal test Git blob: dede9a8f85c1d1d0f49765438ea5a76f8d76c44b.
Transferred launcher and base tests were verified against their Git blob hashes before execution.

## Execution

Executed in the assistant's Linux Python 3.12 sandbox, not the owner's laptop or GitHub Actions. No Godot executed. Signal-only run: 2 passed in 11.537 seconds. Expanded suite: 9 passed in 13.345 seconds, exit 0. Tests: clean exit/version; engine error; forwarding/renderer/log capture; invalid duration; missing executable; relative path; timeout; keyboard interruption; forced-kill fallback.

SIGINT sent after fake-engine readiness produced interrupted, launcher exit 130, child exit -SIGTERM, time-limit flag false. A fake engine ignoring SIGTERM exercised the real ten-second grace period and SIGKILL fallback: time_limit_reached, launcher exit 124, child exit -SIGKILL. Both tests verified that the child PID no longer existed.

## Coverage

Earlier reports counted test outcomes, not code coverage. Measured launcher-only executable-line coverage: 85/86 lines, 98.84%. Missing line 24: bare executable-name/PATH lookup return. Measurement used CPython sys.settrace line events in launcher subprocesses through a temporary sitecustomize module; executable-line denominator used trace._find_executable_linenos, excluding synthetic line 0. Coverage was aggregated across the signal-only and expanded-suite runs. No branch coverage or whole-repository coverage was measured. Temporary instrumentation is not a production dependency; the test suite alone does not emit this coverage report.

## Cleanup and limitations

Temporary test fixtures registered cleanup. After retaining reports, the outer temporary workspace containing tests, instrumentation and raw trace data was removed; absence verified. No unrelated temporary directories or user files were removed. The preceding seven-test run had already cleaned its workspace via a context manager.

These measured results supersede the unexecuted-suite and uncovered-signal statements in docs/HARDWARE_BENCHMARK_RESULTS.md for the source hashes above. No FPS, rendered-game, persistence, LAN or internet multiplayer validation is claimed. This batch adds tests/results only; it does not change the launcher, main, engine pin, renderer defaults or gameplay.

Reproduce from the repository root:

```sh
python3 -m unittest discover -s tests -p 'test_hardware_benchmark*.py' -v
```

The added signal tests are Linux-specific and skip on other platforms.
