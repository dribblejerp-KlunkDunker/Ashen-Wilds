"""Builds the look test's placeholder art from the owner's key painting plus drawn pixel art.
Usage: python3 tools/make_assets.py <key_art.jpg> <out_dir>"""
import sys, random
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFilter, ImageFont
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB'); W, H = im.size  # 1376 x 768
random.seed(31); np.random.seed(31)

# --- sky: the painting IS the sky. Left part (sun, citadel, burning land) + cloud extension both ways.
def ramp(img, lo, hi, flip=False):
    arr = np.array(img).astype(np.float32); w = arr.shape[1]
    g = np.linspace(hi, lo, w) if flip else np.linspace(lo, hi, w)
    return Image.fromarray(np.clip(arr * g[None, :, None], 0, 255).astype(np.uint8))
src_bgr = np.array(im)[:, :, ::-1].copy()
cm = np.zeros(src_bgr.shape[:2], np.uint8)
cv2.fillPoly(cm, [np.array([(250, 420), (262, 300), (300, 262), (345, 250), (372, 186), (392, 186), (412, 250), (455, 262), (492, 300), (505, 420)])], 255)
src_bgr = cv2.inpaint(src_bgr, cm, 9, cv2.INPAINT_TELEA)
imsky = Image.fromarray(src_bgr[:, :, ::-1])
left = imsky.crop((0, 0, 545, 520))
cloud = im.crop((1130, 0, 1376, 300)).resize((1100, 520), Image.BICUBIC).filter(ImageFilter.GaussianBlur(8))
cloud = ramp(cloud, 0.75, 0.4)
pan = Image.new('RGB', (1500, 520)); pan.paste(cloud.resize((1200, 520)), (300, 0))
mask = Image.new('L', (545, 520), 255); md = ImageDraw.Draw(mask)
for x in range(200):
    md.line([(345 + x, 0), (345 + x, 520)], fill=int(255 * (1 - x / 200) ** 1.5))
pan.paste(left, (0, 0), mask)
lext = ramp(imsky.crop((0, 0, 230, 520)).transpose(Image.FLIP_LEFT_RIGHT).resize((300, 520)), 0.2, 1.0)
full = Image.new('RGB', (1800, 520)); full.paste(lext, (0, 0)); full.paste(pan, (300, 0))
full = full.resize((900, 260), Image.BOX)   # low resolution: the far world is coarse
full.save(f'{out}/sky.png')

# --- partner: the young spearman cut from the painting by a hand-drawn outline (placeholder painted person)
poly = [(1030,150),(1060,148),(1082,165),(1085,195),(1095,205),(1120,225),(1140,240),(1150,265),(1175,290),(1200,320),
        (1205,350),(1195,385),(1170,415),(1140,425),(1125,430),(1130,445),(1140,470),(1150,500),(1150,540),(1155,570),
        (1160,600),(1150,612),(1120,612),(1115,590),(1105,550),(1095,500),(1080,465),(1060,455),(1045,470),(1030,500),
        (1022,540),(1020,565),(1015,578),(985,580),(950,572),(955,560),(985,548),(990,520),(985,490),(980,460),
        (978,430),(985,400),(968,375),(962,355),(975,340),(985,320),(995,290),(1005,260),(1010,235),(1020,222),
        (1035,212),(1030,195),(1025,170)]
spear = [(1086,200),(1094,206),(1160,100),(1152,96)]
am = Image.new('L', im.size, 0); ad = ImageDraw.Draw(am); ad.polygon(poly, fill=255); ad.polygon(spear, fill=255)
fig = im.convert('RGBA'); fig.putalpha(am); fig = fig.crop((940, 94, 1215, 616))
small = fig.resize((fig.width * 150 // fig.height, 150), Image.BOX)
sa = small.split()[3].point(lambda v: 255 if v > 120 else 0); small.putalpha(sa)
small.save(f'{out}/partner.png')

# --- ground: black rock with hoarfrost
g = np.random.rand(64, 64); g = cv2.GaussianBlur(g, (0, 0), 2.2); g = (g - g.min()) / (g.max() - g.min())
rock = np.zeros((64, 64, 3), np.uint8)
base = np.array([0x1c, 0x1d, 0x20]); frost = np.array([0xb6, 0xc6, 0xd2])
for i in range(64):
    for j in range(64):
        t = max(0.0, (g[i, j] - 0.5) * 4.0); t = min(1.0, t) * (0.6 + 0.4 * random.random())
        c = base * (0.7 + 0.5 * g[i, j]) * (1 - t) + frost * t
        rock[i, j] = np.clip(c, 0, 255)
Image.fromarray(rock).save(f'{out}/rock_frost.png')
rk = np.zeros((64, 64, 3), np.uint8)
for i in range(64):
    for j in range(64):
        rk[i, j] = np.clip(base * (0.55 + 0.7 * g[i, j]) + (4 if random.random() < 0.06 else 0), 0, 255)
Image.fromarray(rk).save(f'{out}/rock.png')

# --- the fire in the cracks, and smoke
lv = np.random.rand(64, 64); lv = cv2.GaussianBlur(lv, (0, 0), 3.0); lv = (lv - lv.min()) / (lv.max() - lv.min())
lava = np.zeros((64, 64, 3), np.uint8)
for i in range(64):
    for j in range(64):
        v = lv[i, j]
        c = (0x1a, 0x08, 0x05) if v < 0.42 else (0x8a, 0x2a, 0x0c) if v < 0.55 else (0xd8, 0x5a, 0x16) if v < 0.72 else (0xff, 0xa8, 0x3a)
        lava[i, j] = c
Image.fromarray(lava).save(f'{out}/lava.png')
sm = Image.new('RGBA', (32, 96), (0, 0, 0, 0))
for yy in range(96):
    for xx in range(32):
        n = lv[(yy * 2) % 64, (xx * 2 + yy) % 64]
        edge = 1.0 - abs(xx - 15.5) / 15.5; lift = min(1.0, yy / 20.0) * (0.35 + 0.65 * yy / 96.0)
        al = max(0.0, edge * (0.5 + n) - 0.45) * 2.0 * lift
        sm.putpixel((xx, yy), (20, 17, 17, int(min(1.0, al) * 215)))
sm.save(f'{out}/smoke.png')

# --- hands, drawn at the low internal resolution
def px(d, pts, fill): d.polygon(pts, fill=fill)
def sword(glim):
    s = Image.new('RGBA', (150, 150), (0, 0, 0, 0)); d = ImageDraw.Draw(s)
    # blade from the grip (lower right) up and to the left
    px(d, [(101, 96), (113, 101), (58, 6), (52, 4)], (0x6b, 0x6e, 0x70, 255))
    px(d, [(107, 99), (113, 101), (58, 6), (56, 6)], (0x3d, 0x40, 0x43, 255))
    d.line([(104, 96), (56, 8)], fill=(0x9a, 0x9d, 0x9c, 255))
    if glim:
        for k in range(7):
            t = 0.12 + k * 0.11; x = 105 + (57 - 105) * t; y = 97 + (8 - 97) * t
            d.line([(x - 2, y + 1), (x + 2, y - 2)], fill=(0xa9, 0xd8, 0xf2, 255)); d.point((x, y - 3), fill=(0xdc, 0xf2, 0xff, 255))
    else:
        for k in range(7):
            t = 0.12 + k * 0.11; x = 105 + (57 - 105) * t; y = 97 + (8 - 97) * t
            d.line([(x - 2, y + 1), (x + 2, y - 2)], fill=(0x2c, 0x2e, 0x30, 255))
    px(d, [(88, 104), (92, 96), (124, 108), (120, 115)], (0x4a, 0x3a, 0x2a, 255))      # guard
    d.line([(90, 100), (122, 111)], fill=(0x7a, 0x60, 0x40, 255))
    px(d, [(104, 108), (116, 112), (140, 150), (118, 150)], (0x35, 0x27, 0x1c, 255))    # grip under the fist
    px(d, [(98, 112), (124, 116), (138, 138), (134, 150), (104, 150), (94, 128)], (0x5a, 0x40, 0x2a, 255))  # glove
    px(d, [(98, 112), (124, 116), (126, 122), (99, 118)], (0x7a, 0x58, 0x38, 255))
    for k in range(4):
        d.line([(100 + k * 6, 119 + k), (98 + k * 6, 130 + k)], fill=(0x36, 0x25, 0x18, 255))
    px(d, [(112, 136), (140, 132), (150, 150), (112, 150)], (0x3a, 0x3c, 0x40, 255))    # vambrace
    d.line([(114, 138), (141, 134)], fill=(0x70, 0x73, 0x76, 255))
    return s
for nm, gl in (('hand_sword.png', False), ('hand_sword_glim.png', True)):
    sw = sword(gl); sw.resize((120, 120), Image.NEAREST).save(f'{out}/{nm}')

def lantern():
    s = Image.new('RGBA', (120, 130), (0, 0, 0, 0)); d = ImageDraw.Draw(s)
    px(d, [(0, 130), (0, 104), (30, 88), (52, 92), (58, 110), (44, 130)], (0x5a, 0x40, 0x2a, 255))  # fist
    px(d, [(30, 88), (52, 92), (54, 98), (30, 95)], (0x7a, 0x58, 0x38, 255))
    for k in range(3): d.line([(34 + k * 6, 98 + k), (32 + k * 6, 108 + k)], fill=(0x36, 0x25, 0x18, 255))
    d.arc([36, 44, 60, 92], 180, 360, fill=(0x48, 0x48, 0x49, 255)); d.line([(36, 68), (36, 90)], fill=(0x48, 0x48, 0x49, 255))
    d.line([(60, 68), (60, 58)], fill=(0x48, 0x48, 0x49, 255))
    px(d, [(46, 20), (74, 20), (78, 26), (42, 26)], (0x2c, 0x2e, 0x2e, 255))            # cap
    d.rectangle([44, 26, 76, 62], fill=(0x24, 0x22, 0x20, 255))
    d.rectangle([48, 29, 72, 59], fill=(0xd9, 0xa8, 0x4a, 255)); d.rectangle([53, 36, 67, 59], fill=(0xf3, 0xd0, 0x7a, 255))
    d.rectangle([57, 44, 63, 59], fill=(0xff, 0xf0, 0xc0, 255))
    d.line([(60, 26), (60, 62)], fill=(0x24, 0x22, 0x20, 255)); d.rectangle([42, 62, 78, 66], fill=(0x2c, 0x2e, 0x2e, 255))
    d.line([(60, 20), (60, 12)], fill=(0x48, 0x48, 0x49, 255)); d.ellipse([56, 6, 64, 14], outline=(0x48, 0x48, 0x49, 255))
    return s
lantern().save(f'{out}/hand_lantern.png')

def coldlight():
    s = Image.new('RGBA', (120, 130), (0, 0, 0, 0)); d = ImageDraw.Draw(s)
    px(d, [(0, 130), (0, 100), (26, 78), (56, 70), (70, 84), (62, 108), (40, 130)], (0x5a, 0x40, 0x2a, 255))   # open hand
    px(d, [(26, 78), (56, 70), (60, 76), (28, 86)], (0x7a, 0x58, 0x38, 255))
    for k in range(4): d.line([(34 + k * 8, 74 - k), (30 + k * 8, 60 - k * 2)], fill=(0x5a, 0x40, 0x2a, 255), width=4)
    for r, c in [(22, (0x3a, 0x6a, 0x8c, 110)), (15, (0x6c, 0xa8, 0xd0, 170)), (9, (0xb4, 0xdc, 0xf4, 230)), (4, (0xf0, 0xfb, 0xff, 255))]:
        d.ellipse([46 - r, 44 - r, 46 + r, 44 + r], fill=c)
    return s
coldlight().save(f'{out}/hand_coldlight.png')

# --- the ledger panel (1280 x 200), plain ASCII
P = Image.new('RGB', (1280, 200), (0x12, 0x10, 0x0f)); d = ImageDraw.Draw(P)
gold, dim, paper = (0xc2, 0x9a, 0x45), (0x6e, 0x58, 0x2a), (0x9b, 0x7d, 0x66)
F = lambda s: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf', s)
R = lambda s: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf', s)
d.rectangle([0, 0, 1279, 5], fill=gold); d.rectangle([0, 6, 1279, 7], fill=dim)
for x in (180, 612, 896): d.rectangle([x - 3, 0, x + 3, 9], fill=(0x12, 0x10, 0x0f)); d.rectangle([x - 2, 1, x + 2, 8], outline=gold)
# lungs (grey, only fills), blood, breath, load
d.rectangle([8, 22, 16, 180], fill=(0x1e, 0x1d, 0x1c)); d.rectangle([8, 150, 16, 180], fill=(0x8a, 0x8c, 0x8a))
for i, (c, fill) in enumerate([((0x8f, 0x2f, 0x26), 1.0), ((0x7c, 0x86, 0x3c), 0.82), ((0x4a, 0x60, 0x80), 0.45)]):
    x0 = 26 + i * 30; d.rectangle([x0, 22, x0 + 24, 180], fill=(0x1e, 0x1d, 0x1c)); d.rectangle([x0, 180 - int(158 * fill), x0 + 24, 180], fill=c)
# noise gauge
d.rectangle([124, 22, 160, 180], fill=(0, 0, 0)); 
for k in range(1, 8): d.line([(124, 180 - k * 20), (130, 180 - k * 20)], fill=dim)
d.rectangle([122, 141, 162, 144], fill=(0xd2, 0x5a, 0x2a)); d.text((124, 184), '6 m', font=R(11), fill=paper)
rows = [['COMPANY', 'PACK', 'MAP', 'BOOK'], ['SIGNS', 'MURMUR', 'WORD', 'NAMES'], ['ACCOUNT', 'REST']]
y = 22
for r in rows:
    x = 192; wds = [100, 100, 100, 96] if len(r) == 4 else [204, 196]
    for label, wd in zip(r, wds):
        d.rectangle([x, y, x + wd, y + 44], fill=(0x1a, 0x17, 0x14), outline=dim)
        f = F(16); tw = d.textlength(label, font=f); d.text((x + (wd - tw) / 2, y + 12), label, font=f, fill=gold)
        x += wd + 4
    y += 52
d.rectangle([626, 20, 880, 182], fill=(0x0c, 0x0b, 0x0a), outline=dim)
for i, (t, f, c) in enumerate([('STILL', F(24), gold), ('Short sword - Lantern', R(19), paper), ('The thaw, first week', R(19), paper), ('S.31', R(17), gold)]):
    tw = d.textlength(t, font=f); d.text((753 - tw / 2, 28 + i * 38), t, font=f, fill=c)
d.rectangle([912, 20, 1256, 76], fill=(0x0c, 0x0b, 0x0a))
for i, t in enumerate(['NW', 'N', 'NE', 'E']):
    d.text((930 + i * 86, 30), t, font=F(24), fill=gold if t == 'N' else dim)
for k in range(17): d.rectangle([922 + k * 20, 66, 924 + k * 20, 68], fill=dim)
d.rectangle([1024, 20, 1026, 76], fill=(0xf0, 0xe0, 0xb0))
for i, t in enumerate(['Highland edge - Hoarfrost', 'Carter: near - Sayle: below']):
    f = R(20); tw = d.textlength(t, font=f); d.text((1256 - tw, 96 + i * 38), t, font=f, fill=paper)
P.save(f'{out}/panel.png')
d.rectangle([630, 60, 876, 92], fill=(0x0c, 0x0b, 0x0a)); f = R(19); tx = 'Glim blade - Cold light'; tw = d.textlength(tx, font=f); d.text((753 - tw / 2, 66), tx, font=f, fill=(0xa9, 0xd8, 0xf2))
P.save(f'{out}/panel_cold.png')
print('ok', full.size, small.size)
