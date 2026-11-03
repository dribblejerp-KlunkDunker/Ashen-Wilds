#!/usr/bin/env python3
"""Rebuilds art/kaykit/characters/survivor_texture.png from KayKit's palette texture.

The KayKit Rogue is dressed in bright cloth greens; the Blackfen survivor wears dark, worn
oilcloth. This turns the greens brown-grey and dark, flattens the purples, and mutes everything
else a little. Needs Pillow (pip install pillow). Run from the repository root:

    python3 tools/recolor_survivor_texture.py
"""
import colorsys
from PIL import Image

SRC = "art/kaykit/characters/Rogue_Hooded_rogue_texture.png"
OUT = "art/kaykit/characters/survivor_texture.png"


def recolor(r: int, g: int, b: int) -> tuple[int, int, int]:
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    deg = h * 360
    if 70 <= deg <= 200 and s > 0.25:
        h, s, v = 32 / 360, s * 0.32, v * 0.42 + 0.04  # cloth greens -> worn oilcloth
    elif 200 < deg <= 330 and s > 0.3:
        s, v = s * 0.3, v * 0.5  # blues and purples -> dull
    else:
        s, v = s * 0.78, v * 0.86  # skin, leather, metal: a little muted
    rr, gg, bb = colorsys.hsv_to_rgb(h, s, v)
    return int(rr * 255), int(gg * 255), int(bb * 255)


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    out = Image.new("RGBA", src.size)
    sp, op = src.load(), out.load()
    for y in range(src.size[1]):
        for x in range(src.size[0]):
            r, g, b, a = sp[x, y]
            op[x, y] = (*recolor(r, g, b), a)
    out.save(OUT, optimize=True)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
