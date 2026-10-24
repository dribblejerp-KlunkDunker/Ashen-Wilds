#!/usr/bin/env bash
# Downloads Godot 4.3-stable (outside the repo) and the software Vulkan driver
# used for screenshots. Safe to re-run.
set -euo pipefail
GODOT="$HOME/godot/Godot_v4.3-stable_linux.x86_64"
if [ ! -x "$GODOT" ]; then
  mkdir -p "$HOME/godot" && cd "$HOME/godot"
  curl -sSL -o godot.zip https://github.com/godotengine/godot/releases/download/4.3-stable/Godot_v4.3-stable_linux.x86_64.zip
  unzip -oq godot.zip && rm godot.zip
fi
"$GODOT" --version
if [ "${1:-}" = "--screenshots" ] && ! dpkg -s mesa-vulkan-drivers >/dev/null 2>&1; then
  sudo apt-get update -qq && sudo apt-get install -y -qq mesa-vulkan-drivers xvfb
fi
