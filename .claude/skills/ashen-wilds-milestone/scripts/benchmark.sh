#!/usr/bin/env bash
# Visual benchmark: renders the fixed shot set and scores it against the
# target mockup. Usage: benchmark.sh <run-name> "what changed since the last run"
# Shots go to docs/benchmark/runs/<run-name>/ and are kept (one folder per run).
# Copies the previous run's rubric.json for you to re-score by hand.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
GODOT="${GODOT:-$HOME/godot/Godot_v4.3-stable_linux.x86_64}"
RUN="${1:?usage: benchmark.sh <run-name> \"what changed\"}"
LABEL="${2:-}"
PREV=$(ls -1 docs/benchmark/runs | grep -v "^$RUN$" | sort | tail -1 || true)
timeout 900 xvfb-run -a -s "-screen 0 1920x1080x24" "$GODOT" --path . --rendering-driver vulkan \
  --script res://tools/visual_benchmark.gd -- --run="$RUN" 2>&1 | grep -E "^saved|SCRIPT ERROR"
if [ ! -f "docs/benchmark/runs/$RUN/rubric.json" ] && [ -n "$PREV" ]; then
  cp "docs/benchmark/runs/$PREV/rubric.json" "docs/benchmark/runs/$RUN/rubric.json"
  echo "Copied the rubric from $PREV: re-score what this run's art changed, then re-run the scorer."
fi
python3 tools/visual_benchmark.py --run "$RUN" --label "$LABEL"
