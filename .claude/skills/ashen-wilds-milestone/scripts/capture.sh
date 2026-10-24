#!/usr/bin/env bash
# Renders docs/screenshots/*.png through software Vulkan (10-15 minutes), then
# lists what changed. Look at every image before committing.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
GODOT="${GODOT:-$HOME/godot/Godot_v4.3-stable_linux.x86_64}"
xvfb-run -a -s "-screen 0 1920x1080x24" "$GODOT" --path . --rendering-driver vulkan \
  --script res://tools/capture_screenshots.gd 2>&1 | grep -E "saved|ERROR"
git status --short docs/screenshots
