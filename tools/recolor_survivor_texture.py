#!/usr/bin/env python3
"""Rebuilds the survivor's and the Ashbound enemies' grim textures from Quaternius's.

The Ranger outfit is bright greens and clean leather; a Blackfen survivor wears dark, worn,
dirty cloth. This turns the greens into dark brown-grey oilcloth, darkens and dulls the leather,
and lays a soft, fixed-seed grime over the result. The skin is made a little paler and duller.
The Ashbound (the enemies) wear the Peasant outfit as filthy rags, and their skin is drained to a
pale grey that each enemy type tints in game (goblin green, ork olive, ogre ash).
Needs Pillow (pip install pillow). Run from the repository root:

    python3 tools/recolor_survivor_texture.py
"""
import colorsys
import random
from PIL import Image, ImageFilter

JOBS = [
    ("art/quaternius/survivor/", "T_Ranger_BaseColor.png", "survivor_outfit_basecolor.png", "outfit"),
    ("art/quaternius/survivor/", "T_Regular_Male_Dark_BaseColor.png", "survivor_skin_basecolor.png", "skin"),
    ("art/quaternius/ashbound/", "T_Peasant_BaseColor.png", "ashbound_rags_basecolor.png", "rags"),
    ("art/quaternius/ashbound/", "T_Regular_Male_Dark_BaseColor.png", "ashbound_skin_basecolor.png", "ashskin"),
]


def grime_map(size: tuple[int, int], seed: int) -> Image.Image:
    """Soft blotches between 0.72 and 1.0: multiplied in, they read as dirt and wear."""
    rng = random.Random(seed)
    small = Image.new("L", (64, 64))
    small.putdata([int(255 * (0.72 + 0.28 * rng.random())) for _ in range(64 * 64)])
    return small.resize(size, Image.BICUBIC).filter(ImageFilter.GaussianBlur(6))


def outfit(h: float, s: float, v: float) -> tuple[float, float, float]:
    deg = h * 360
    if 60 <= deg <= 200 and s > 0.2:
        return 30 / 360, s * 0.30, v * 0.45 + 0.03  # cloth greens -> dark oilcloth
    if 10 <= deg < 60:
        return h, s * 0.62, v * 0.70  # leather and wood: darker, duller
    return h, s * 0.6, v * 0.75  # metal, buckles, the rest


def skin(h: float, s: float, v: float) -> tuple[float, float, float]:
    return h, s * 0.72, v * 0.86


def rags(h: float, s: float, v: float) -> tuple[float, float, float]:
    return 28 / 360, s * 0.22, v * 0.5 + 0.02  # every colour to dark, dirty sackcloth


def ashskin(h: float, s: float, v: float) -> tuple[float, float, float]:
    return h, s * 0.12, v * 0.9  # nearly grey; the game tints it per enemy type


def main() -> None:
    fns = {"outfit": outfit, "skin": skin, "rags": rags, "ashskin": ashskin}
    for folder, src_name, out_name, kind in JOBS:
        src = Image.open(folder + src_name).convert("RGBA")
        grimy = kind in ("outfit", "rags")
        grime = grime_map(src.size, {"outfit": 1306, "rags": 2611}.get(kind, 77))
        out = Image.new("RGBA", src.size)
        sp, gp, op = src.load(), grime.load(), out.load()
        fn = fns[kind]
        for y in range(src.size[1]):
            for x in range(src.size[0]):
                r, g, b, a = sp[x, y]
                h, s, v = fn(*colorsys.rgb_to_hsv(r / 255, g / 255, b / 255))
                v *= gp[x, y] / 255 if grimy else (0.9 + 0.1 * gp[x, y] / 255)
                rr, gg, bb = colorsys.hsv_to_rgb(h, s, v)
                op[x, y] = (int(rr * 255), int(gg * 255), int(bb * 255), a)
        out.save(folder + out_name, optimize=True)
        print("wrote", folder + out_name)


if __name__ == "__main__":
    main()
