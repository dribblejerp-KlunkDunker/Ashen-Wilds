#!/usr/bin/env bash
# Exports the internal test builds (appendix §57, §90, §91) and writes builds/BUILD_INFO.txt.
#
# Needs: Godot 4.3-stable at $GODOT (default ~/godot/Godot_v4.3-stable_linux.x86_64) and its export
# templates installed at ~/.local/share/godot/export_templates/4.3.stable (the .tpz from the same
# release, unzipped, its `templates` folder renamed to `4.3.stable`). docs/PRODUCTION.md has the
# steps. Run from anywhere; outputs go to <repo>/builds/, which is git-ignored.
#
# A finished archive is not proof the build runs (§91): tools/net_spike.py --exported builds runs
# the exported Linux server and client against each other on loopback.
set -euo pipefail
cd "$(dirname "$0")/.."
GODOT="${GODOT:-$HOME/godot/Godot_v4.3-stable_linux.x86_64}"
[ -x "$GODOT" ] || { echo "Godot not found at $GODOT (set GODOT)"; exit 2; }
TEMPLATES="$HOME/.local/share/godot/export_templates/4.3.stable"
[ -f "$TEMPLATES/version.txt" ] || { echo "Export templates not installed at $TEMPLATES"; exit 2; }

COMMIT="$(git rev-parse --short HEAD)"
git diff --quiet && git diff --cached --quiet || COMMIT="$COMMIT-dirty"
BUILD_ID="$(grep -oP 'BUILD_ID: String = "\K[^"]+' scripts/net/net_protocol.gd)"
PROTOCOL="$(grep -oP 'PROTOCOL_VERSION: int = \K[0-9]+' scripts/net/net_protocol.gd)"
STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

rm -rf builds
mkdir -p builds/linux-client builds/linux-server builds/windows-client
"$GODOT" --headless --path . --import >/dev/null 2>&1 || true

export_one() {
  local preset="$1" out="$2"
  echo "== exporting $preset -> $out"
  if ! "$GODOT" --headless --path . --export-release "$preset" "$out" 2>&1 | grep -vE 'mesh_get_surface|Parameter "m" is null|^\s*$|ObjectDB|cleanup \(core|^Godot Engine'; then :; fi
  [ -s "$out" ] || { echo "export failed: $out missing"; exit 1; }
}
export_one "Linux Client" builds/linux-client/ashen-wilds-client.x86_64
export_one "Linux Server" builds/linux-server/ashen-wilds-server.x86_64
export_one "Windows Client" builds/windows-client/ashen-wilds-client.exe

cat > builds/BUILD_INFO.txt <<EOF
Grim Dark: Ashen Wilds — internal playtest build (not a release candidate)
build id      $BUILD_ID
protocol      $PROTOCOL  (server and client must match; a mismatch is refused with a message)
source        $COMMIT  (git short SHA; -dirty means uncommitted changes were included)
exported      $STAMP with Godot 4.3-stable export templates
platforms     linux-client (x86_64), linux-server (x86_64, dedicated-server export), windows-client (x86_64, untested on Windows in this session)

HOW TO PLAY TOGETHER (temporary rules P4/A1: one of you runs the server, the other joins by IP)
  server (Linux):   ./ashen-wilds-server.x86_64 --headless -- --server --port 7788
  client (Linux):   ./ashen-wilds-client.x86_64 -- --client --host <server ip> --port 7788 --player-key <your name>
  client (Windows): ashen-wilds-client.exe -- --client --host <server ip> --port 7788 --player-key <your name>
  Same machine: the host runs the server and a client with --host 127.0.0.1. Over the internet the
  server's UDP port 7788 must be reachable (port forwarding), which is the open online-model question.
  Keys: WASD/arrows move · Q/E turn the camera · wheel zoom · C recenter · F search a crate · Esc closes.
  With no arguments the binary opens the single-player Watchhouse prototype instead.

KNOWN LIMITATIONS
  No saves: a server restart loses packs and the crate. No enemies, no repair, no hearth yet.
  Placeholder art (capsules and boxes). Two players by default (--max-players on the server).
  Logs: Godot's user data folder, e.g. ~/.local/share/godot/app_userdata/<project name>/logs/ on
  Linux, %APPDATA%\\Godot\\app_userdata\\<project name>\\logs\\ on Windows.
EOF
ls -la builds/*/ builds/BUILD_INFO.txt
echo "done: build $BUILD_ID from $COMMIT"
