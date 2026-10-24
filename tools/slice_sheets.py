#!/usr/bin/env python3
"""Cuts the owner's reference contact sheets into individual transparent sprites.

The sheets in docs/art_reference/ are transparent PNG-like webps laid out in
rows (they only look white in a viewer). This finds the rows (horizontal runs
of ink, alpha > INK), then the sprites in each row (vertical runs), drops the
faint alpha haze the generator left between sprites, trims, and saves:

    assets/sheets/<sheet>/r<row>_c<col>.png
    assets/sheets/manifest.json          every cut: sheet, row, col, size, file

assets/sheets/ isn't committed (it's 18 MB and rebuilt from the sheets in seconds).

The game doesn't load these directly: assets/art_map.json names the cuts it uses.
These are interim art: the sheets are small previews (a character is ~60 px
tall), so they're soft when scaled up. Replace them file for file with the art
agent's full-resolution exports when they arrive.

    python3 tools/slice_sheets.py            # all sheets
    python3 tools/slice_sheets.py 05 07      # sheets whose name starts with these
    python3 tools/slice_sheets.py --build    # copy the cuts art_map.json uses into assets/game/
"""

import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "docs", "art_reference")
OUT = os.path.join(ROOT, "assets", "sheets")

INK = 40          # alpha above this is sprite; the sheets carry a faint haze (alpha ~6-8) between sprites
HAZE = 24         # alpha below this is dropped, the rest rescaled to 0-255
MIN_RUN = 3       # a gap this wide (px) separates rows / sprites
MIN_SIZE = 10     # ignore specks smaller than this in both directions


def runs(mask_1d, min_gap):
    """[start, end) runs of True, merging gaps shorter than min_gap."""
    idx = np.flatnonzero(mask_1d)
    if idx.size == 0:
        return []
    out = []
    start = prev = idx[0]
    for i in idx[1:]:
        if i - prev > min_gap:
            out.append((start, prev + 1))
            start = i
        prev = i
    out.append((start, prev + 1))
    return out


def clean(cell):
    """cell: HxWx4 uint8. Drops the background haze, trims. None if empty."""
    rgba = cell.astype(float)
    a = np.clip((rgba[..., 3] - HAZE) / (255.0 - HAZE), 0.0, 1.0)
    ys, xs = np.nonzero(a > 0.05)
    if ys.size == 0:
        return None
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    if (y1 - y0) < MIN_SIZE and (x1 - x0) < MIN_SIZE:
        return None
    rgba[..., 3] = a * 255.0
    return rgba[y0:y1, x0:x1].round().astype(np.uint8)


def slice_sheet(path):
    name = os.path.splitext(os.path.basename(path))[0]
    img = np.asarray(Image.open(path).convert("RGBA"))
    if (img[..., 3] < 10).mean() < 0.05:
        print(f"  {name}: opaque sheet (no transparency to cut along); skipped")
        return []
    ink = img[..., 3] > INK
    out_dir = os.path.join(OUT, name)
    os.makedirs(out_dir, exist_ok=True)
    cuts = []
    for r, (y0, y1) in enumerate(runs(ink.any(axis=1), MIN_RUN)):
        band = ink[y0:y1]
        for c, (x0, x1) in enumerate(runs(band.any(axis=0), MIN_RUN)):
            # Re-trim vertically to this sprite's own ink (rows can be ragged).
            ys = np.flatnonzero(ink[y0:y1, x0:x1].any(axis=1))
            sy0, sy1 = y0 + ys.min(), y0 + ys.max() + 1
            sprite = clean(img[sy0:sy1, x0:x1])
            if sprite is None:
                continue
            fname = f"r{r:02d}_c{c:02d}.png"
            Image.fromarray(sprite, "RGBA").save(os.path.join(out_dir, fname))
            cuts.append({"sheet": name, "row": r, "col": c, "w": int(sprite.shape[1]), "h": int(sprite.shape[0]),
                         "src": [int(x0), int(sy0), int(x1), int(sy1)], "file": f"{name}/{fname}"})
    return cuts


def seamless(src, dst, contrast=1.0):
    """Mirror-tiles a texture 2x2 (flipped copies) so it repeats without seams,
    makes it opaque (surfaces have no holes), and optionally pulls its contrast
    toward its mean (a busy tile repeated over a big area bands visibly)."""
    im = Image.open(src).convert("RGBA")
    rgb = Image.new("RGB", im.size, (40, 38, 34))
    rgb.paste(im, (0, 0), im)
    if contrast != 1.0:
        a = np.asarray(rgb, dtype=float)
        mean = a.reshape(-1, 3).mean(axis=0)
        rgb = Image.fromarray(np.clip(mean + (a - mean) * contrast, 0, 255).astype(np.uint8))
    w, h = rgb.size
    out = Image.new("RGB", (w * 2, h * 2))
    out.paste(rgb, (0, 0))
    out.paste(rgb.transpose(Image.FLIP_LEFT_RIGHT), (w, 0))
    out.paste(rgb.transpose(Image.FLIP_TOP_BOTTOM), (0, h))
    out.paste(rgb.transpose(Image.ROTATE_180), (w, h))
    out.save(dst)


def build():
    """Copies the cuts named in assets/art_map.json to assets/game/ (what Godot imports)."""
    import shutil
    art = json.load(open(os.path.join(ROOT, "assets", "art_map.json")))
    game = os.path.join(ROOT, "assets", "game")
    for sub in ("sprites", "icons", "textures"):
        os.makedirs(os.path.join(game, sub), exist_ok=True)
    missing = []
    for key, spec in art["sprites"].items():
        src = os.path.join(OUT, spec["cut"])
        if os.path.exists(src):
            shutil.copyfile(src, os.path.join(game, "sprites", f"{key}.png"))
        else:
            missing.append(spec["cut"])
    for item_id, cut in art["icons"].items():
        src = os.path.join(OUT, cut)
        if os.path.exists(src):
            shutil.copyfile(src, os.path.join(game, "icons", f"{item_id}.png"))
        else:
            missing.append(cut)
    for key, spec in art.get("textures", {}).items():
        src = os.path.join(OUT, spec["cut"])
        if os.path.exists(src):
            seamless(src, os.path.join(game, "textures", f"{key}.png"), float(spec.get("contrast", 1.0)))
        else:
            missing.append(spec["cut"])
    print(f"built {len(art['sprites'])} sprites and {len(art['icons'])} icons into assets/game/"
          + (f"; MISSING: {missing}" if missing else ""))
    return 1 if missing else 0


def main():
    if sys.argv[1:] == ["--build"]:
        sys.exit(build())
    prefixes = sys.argv[1:]
    sheets = sorted(f for f in os.listdir(SRC) if f.endswith(".webp"))
    if prefixes:
        sheets = [s for s in sheets if any(s.startswith(p) for p in prefixes)]
    manifest_path = os.path.join(OUT, "manifest.json")
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else []
    done = {os.path.splitext(s)[0] for s in sheets}
    manifest = [m for m in manifest if m["sheet"] not in done]
    for s in sheets:
        cuts = slice_sheet(os.path.join(SRC, s))
        manifest += cuts
        rows = len({c["row"] for c in cuts})
        print(f"{s}: {len(cuts)} sprites in {rows} rows")
    os.makedirs(OUT, exist_ok=True)
    open(os.path.join(OUT, ".gdignore"), "w").close()  # Godot imports only assets/game/
    json.dump(sorted(manifest, key=lambda m: (m["sheet"], m["row"], m["col"])), open(manifest_path, "w"), indent=1)


if __name__ == "__main__":
    main()
