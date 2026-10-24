#!/usr/bin/env bash
# The four CLAUDE.md checks in one go: import, compile-check, smoke suite, live
# boot. Exit status is non-zero if any of them fails. Pass --twice to run the
# suite a second time (timing-sensitive changes). Takes a few minutes.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
GODOT="${GODOT:-$HOME/godot/Godot_v4.3-stable_linux.x86_64}"
status=0
"$GODOT" --headless --path . --import >/dev/null 2>&1
echo "== compile"
for f in $(find scripts tests tools -name "*.gd" | sort); do
  out=$("$GODOT" --headless --path . --check-only --script "res://$f" 2>&1 | grep -E "ERROR|WARNING")
  [ -n "$out" ] && echo "--- $f" && echo "$out" && status=1
done
runs=1; [ "${1:-}" = "--twice" ] && runs=2
for i in $(seq "$runs"); do
  echo "== suite (run $i)"
  "$GODOT" --headless --path . --script res://tests/smoke_test.gd 2>&1 | grep -E "FAIL|passed|SCRIPT ERROR"
  [ "${PIPESTATUS[0]}" -ne 0 ] && status=1
done
echo "== live boot (should be empty)"
noise=$("$GODOT" --headless --path . --quit-after 1200 2>&1 \
  | grep -vE 'mesh_get_surface_count|Parameter "m" is null|^\s*$|ObjectDB|cleanup \(core|^Godot Engine')
[ -n "$noise" ] && echo "$noise" && status=1
echo "== $([ $status -eq 0 ] && echo CLEAN || echo PROBLEMS)"
exit $status
