#!/usr/bin/env bash
# Zips the desktop builds tools/export_builds.sh wrote into builds/release/, one archive per
# platform, each with BUILD_INFO.txt inside, plus BUILD_INFO.txt beside them (the release notes).
# The web build is not zipped: CI publishes builds/web/ to GitHub Pages as it is.
set -euo pipefail
cd "$(dirname "$0")/../builds"
[ -f BUILD_INFO.txt ] || { echo "run tools/export_builds.sh first"; exit 2; }
rm -rf release && mkdir release
pack() {
  local dir="$1" name="$2"
  cp BUILD_INFO.txt "$dir/"
  zip -q -r "release/$name" "$dir"
}
pack linux-client ashen-wilds-chromebook-or-linux-x86_64.zip
pack linux-arm64-client ashen-wilds-chromebook-or-linux-arm64.zip
pack windows-client ashen-wilds-windows.zip
pack linux-server ashen-wilds-linux-dedicated-server.zip
cp BUILD_INFO.txt release/
ls -la release
