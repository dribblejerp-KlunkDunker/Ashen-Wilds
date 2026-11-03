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
mkdir -p builds/linux-client builds/linux-server builds/windows-client builds/linux-arm64-client
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
export_one "Linux Client ARM64" builds/linux-arm64-client/ashen-wilds-client.arm64

# Start scripts for the Linux folders (Chromebooks run these in the Linux terminal). Clients use
# Godot's OpenGL Compatibility renderer by default because ChromeOS's Linux container often has no
# Vulkan; on a desktop with a Vulkan GPU, RENDER="" gives the full Forward+ look.
write_scripts() {
  local dir="$1" bin="$2"
  cat > "$dir/play-here.sh" <<SH
#!/usr/bin/env bash
# Starts a server and a player on this machine. Usage: ./play-here.sh [your name]
cd "\$(dirname "\$0")"
NAME="\${1:-player1}"
RENDER="\${RENDER---rendering-method gl_compatibility}"
./$bin --headless -- --server --port 7788 &
SERVER=\$!
trap 'kill \$SERVER 2>/dev/null' EXIT
sleep 1
./$bin \$RENDER -- --client --host 127.0.0.1 --port 7788 --player-key "\$NAME"
SH
  cat > "$dir/run-server.sh" <<SH
#!/usr/bin/env bash
# Runs only the server (no window). Others join with ./join.sh <this machine's address> <name>.
cd "\$(dirname "\$0")"
exec ./$bin --headless -- --server --port 7788 "\$@"
SH
  cat > "$dir/join.sh" <<SH
#!/usr/bin/env bash
# Joins a running server. Usage: ./join.sh <server address> [your name]
cd "\$(dirname "\$0")"
[ -n "\$1" ] || { echo "usage: ./join.sh <server address> [your name]"; exit 2; }
RENDER="\${RENDER---rendering-method gl_compatibility}"
exec ./$bin \$RENDER -- --client --host "\$1" --port 7788 --player-key "\${2:-player2}"
SH
  chmod +x "$dir"/*.sh
}
write_scripts builds/linux-client ashen-wilds-client.x86_64
write_scripts builds/linux-arm64-client ashen-wilds-client.arm64

cat > builds/BUILD_INFO.txt <<EOF
Grim Dark: Ashen Wilds — internal playtest build (not a release candidate)
build id      $BUILD_ID
protocol      $PROTOCOL  (server and client must match; a mismatch is refused with a message)
source        $COMMIT  (git short SHA; -dirty means uncommitted changes were included)
exported      $STAMP with Godot 4.3-stable export templates
platforms     linux-client (x86_64), linux-arm64-client (ARM Chromebooks and ARM Linux; not run in this session),
              linux-server (x86_64, dedicated-server export), windows-client (x86_64, not run in this session)

CHROMEBOOK
  Turn on Linux (Settings > About ChromeOS > Developers > Linux development environment), copy the
  linux-client folder (Intel/AMD Chromebook) or linux-arm64-client folder (ARM Chromebook; check
  Settings > About ChromeOS > Additional details, or run `uname -m` in the Linux terminal: x86_64 or
  aarch64) into "Linux files", then in the terminal:  cd <folder> && chmod +x * && ./play-here.sh
  The scripts use the OpenGL Compatibility renderer, which ChromeOS's Linux supports more widely.
  For a friend on another machine to join a server on the Chromebook, ChromeOS must forward UDP 7788
  to Linux (Settings > Developers > Linux > Port forwarding).

HOW TO PLAY TOGETHER (temporary rules P4/A1: one of you runs the server, the other joins by IP)
  server (Linux):   ./ashen-wilds-server.x86_64 --headless -- --server --port 7788
  client (Linux):   ./ashen-wilds-client.x86_64 -- --client --host <server ip> --port 7788 --player-key <your name>
  client (Windows): ashen-wilds-client.exe -- --client --host <server ip> --port 7788 --player-key <your name>
  Same machine: the host runs the server and a client with --host 127.0.0.1. Over the internet the
  server's UDP port 7788 must be reachable (port forwarding), which is the open online-model question.
  Keys: WASD/arrows move · Q/E turn the camera · wheel zoom · C recenter · F search a crate · Esc closes.
  With no arguments the binary opens the single-player Watchhouse prototype instead.

SAVES (server only)
  The server keeps the world in ashen_world.json in Godot's user data folder (see Logs below) and
  writes it after every change and on shutdown. Choose another file with --save <path> after the
  `--`. A save from a newer build is refused, never overwritten; if the save and its backup are
  both unreadable the server refuses to start until it is given --reset-world (which keeps the bad
  files aside). Save compatibility: schema 1, written by protocol-4 builds.

KNOWN LIMITATIONS
  No enemies or combat yet. A position is saved at most every 30 seconds while playing (packs,
  the crate, the breach and the hearth are saved within a second of changing).
  Placeholder art (capsules and boxes). Two players by default (--max-players on the server).
  Logs: Godot's user data folder, e.g. ~/.local/share/godot/app_userdata/<project name>/logs/ on
  Linux, %APPDATA%\\Godot\\app_userdata\\<project name>\\logs\\ on Windows.
EOF
ls -la builds/*/ builds/BUILD_INFO.txt
echo "done: build $BUILD_ID from $COMMIT"
