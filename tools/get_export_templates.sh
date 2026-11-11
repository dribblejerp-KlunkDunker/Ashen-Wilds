#!/usr/bin/env bash
# Installs the Godot 4.7.2-stable export templates this project's presets use, and nothing else:
# Linux x86_64 and ARM64, Windows x86_64, and the single-threaded Web template, release builds
# only (tools/export_builds.sh exports release). The full archive is 1.28 GB; what is kept is
# about 200 MB, which is what CI caches.
#
# Installs into Godot's data folder: $XDG_DATA_HOME/godot/export_templates/4.7.2.stable
# (XDG_DATA_HOME defaults to ~/.local/share). Does nothing if the templates are already there.
set -euo pipefail
DEST="${XDG_DATA_HOME:-$HOME/.local/share}/godot/export_templates/4.7.2.stable"
NEEDED=(version.txt linux_release.x86_64 linux_release.arm64 windows_release_x86_64.exe web_nothreads_release.zip)

have_all=1
for f in "${NEEDED[@]}"; do [ -f "$DEST/$f" ] || have_all=0; done
if [ "$have_all" = 1 ]; then echo "export templates already installed at $DEST"; exit 0; fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
echo "downloading Godot 4.7.2-stable export templates (1.28 GB)"
curl -sSL --retry 4 -o "$WORK/templates.tpz" \
  https://github.com/godotengine/godot/releases/download/4.7.2-stable/Godot_v4.7.2-stable_export_templates.tpz
mkdir -p "$DEST"
for f in "${NEEDED[@]}"; do
  unzip -q -o -j "$WORK/templates.tpz" "templates/$f" -d "$DEST"
done
grep -qx "4.7.2.stable" "$DEST/version.txt" || { echo "unexpected template version: $(cat "$DEST/version.txt")"; exit 1; }
ls -la "$DEST"
