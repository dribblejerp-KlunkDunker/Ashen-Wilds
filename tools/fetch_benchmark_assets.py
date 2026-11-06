#!/usr/bin/env python3
"""Download the 3D quality benchmark pack (assets/reference/benchmark_manifest.json) from Poly Haven.

All assets are CC0 1.0. They go into assets/reference/benchmark/ (git-ignored, about 150 MB):
models/<id>/<id>_1k.gltf with their textures, and materials/<id>/<id>_{diff,nor_gl,arm}_1k.jpg.
Already-downloaded assets are skipped. Run from the repo root:

    python3 tools/fetch_benchmark_assets.py
"""
import json
import os
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "assets", "reference", "benchmark_manifest.json")
OUT = os.path.join(ROOT, "assets", "reference", "benchmark")
HEADERS = {"User-Agent": "AshenWildsBenchmarkFetch/1.0"}
API = "https://api.polyhaven.com/files/"


def get(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=90) as r:
        return r.read()


def save(path: str, data: bytes) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)


def fetch_model(asset_id: str, res: str) -> None:
    folder = os.path.join(OUT, "models", asset_id)
    if os.path.exists(os.path.join(folder, f"{asset_id}_{res}.gltf")):
        return
    gltf = json.loads(get(API + asset_id))["gltf"][res]["gltf"]
    save(os.path.join(folder, os.path.basename(gltf["url"])), get(gltf["url"]))
    for rel, inc in gltf.get("include", {}).items():
        save(os.path.join(folder, rel), get(inc["url"]))


def fetch_material(asset_id: str, res: str) -> None:
    folder = os.path.join(OUT, "materials", asset_id)
    files = None
    for key, name in (("Diffuse", "diff"), ("nor_gl", "nor_gl"), ("arm", "arm")):
        path = os.path.join(folder, f"{asset_id}_{name}_{res}.jpg")
        if os.path.exists(path):
            continue
        files = files or json.loads(get(API + asset_id))
        save(path, get(files[key][res]["jpg"]["url"]))


def main() -> int:
    manifest = json.load(open(MANIFEST))
    res = manifest.get("resolution", "1k")
    failed = []
    for kind, fetch in (("models", fetch_model), ("materials", fetch_material)):
        for entry in manifest[kind]:
            try:
                fetch(entry["id"], res)
                print(f"{kind[:-1]} {entry['id']} ok", flush=True)
            except Exception as e:  # keep going; report at the end
                failed.append(entry["id"])
                print(f"{kind[:-1]} {entry['id']} FAILED: {e}", flush=True)
            time.sleep(0.3)
    print(f"done: {len(failed)} failed" + (f" ({', '.join(failed)})" if failed else ""))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
