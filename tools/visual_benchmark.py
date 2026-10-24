#!/usr/bin/env python3
"""Visual benchmark scorer for Ashen Wilds.

Scores the shots rendered by tools/visual_benchmark.gd against the owner's
target (docs/art_reference/00_target_mockup.jpg, described in
docs/VISUAL_DIRECTION.md). Each metric is a measurable reading of a style
pillar, compared with the same reading of the mockup's world area, and turned
into a 0-100 closeness score. A hand-scored rubric covers what numbers can't.

    python3 tools/visual_benchmark.py --run <name> [--label "what changed"]
    python3 tools/visual_benchmark.py --selftest

A run writes docs/benchmark/runs/<name>/metrics.json, updates
docs/benchmark/history.json (one entry per run, replaced on re-score) and
rewrites docs/benchmark/REPORT.md. Needs Pillow and numpy.
"""

import argparse
import datetime
import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BENCH = os.path.join(ROOT, "docs", "benchmark")
RUNS = os.path.join(BENCH, "runs")
MOCKUP = os.path.join(ROOT, "docs", "art_reference", "00_target_mockup.jpg")
RUBRIC = os.path.join(BENCH, "rubric.json")
WORK_WIDTH = 480  # every image is scaled to this width before measuring
# Bump when a metric's definition changes: scores from different versions
# aren't comparable, and the report says so.
SCORER_VERSION = 2

# The mockup is 836x470: the world on the left, the PACK panel from x=475,
# and the HUD (two bars + three quick slots) bottom-left.
MOCKUP_WORLD_BOX = (0, 0, 470, 470)
MOCKUP_HUD_BOX = (0, 405, 250, 470)

# Which metrics each shot is scored on. Night shots are held to the night
# mockup on everything; the day and line-up shots only on what still applies.
SHOTS = {
    "b1_watchhouse_night": {"title": "Watchhouse at night (the mockup's composition)", "metrics": "all"},
    "b2_shelter_fire_night": {"title": "Shelter fire at night", "metrics": "all"},
    "b3_marsh_day": {"title": "The marsh by day", "metrics": ["palette", "saturation", "detail"]},
    "b4_bestiary_lineup": {"title": "Creature line-up (silhouettes)", "metrics": ["saturation", "detail"]},
}

METRICS = {
    "palette": "Muted, earthy palette: Lab distance between the 8 dominant colours of shot and target",
    "darkness": "The world reads in darkness: share of the frame that is near-black (L* < 25)",
    "light_pool": "Light is precious: how far the brightest 1% stands above the median (L*)",
    "torch_pool": "Warm torchlight on a dark world: share of the frame that is warm-lit (b* > 12 at L* > 25)",
    "ambient_share": "Silhouettes read in the dark: share of the frame that is dim but visible ambient (L* 15-50, not torch-lit)",
    "ambient_tint": "A cold blue-grey ambient: mean b* of that dim, visible ambient (negative is blue); 0 if there's none",
    "saturation": "Saturation is rare and meaningful: mean chroma C*",
    "detail": "Painterly, worn surfaces: mean Laplacian of L* (surface detail)",
}


# ---------------------------------------------------------------------------
# Colour science (sRGB -> CIE Lab, D65)
# ---------------------------------------------------------------------------
def srgb_to_lab(rgb):
    """rgb: float array (..., 3) in 0..1. Returns Lab (..., 3)."""
    c = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124564, 0.3575761, 0.1804375],
                  [0.2126729, 0.7151522, 0.0721750],
                  [0.0193339, 0.1191920, 0.9503041]])
    xyz = c @ m.T
    xyz = xyz / np.array([0.95047, 1.0, 1.08883])
    e = 216 / 24389
    k = 24389 / 27
    f = np.where(xyz > e, np.cbrt(xyz), (k * xyz + 16) / 116)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], axis=-1)


def load(path_or_img, box=None):
    img = path_or_img if isinstance(path_or_img, Image.Image) else Image.open(path_or_img)
    img = img.convert("RGB")
    if box:
        img = img.crop(box)
    h = max(1, round(img.height * WORK_WIDTH / img.width))
    return img.resize((WORK_WIDTH, h), Image.LANCZOS)


def mask_box(img, box, scale_from):
    """Replace a region (given in the original image's pixels) with the image's median colour."""
    sx = img.width / scale_from[0]
    sy = img.height / scale_from[1]
    arr = np.asarray(img).copy()
    x0, y0, x1, y1 = [int(round(v)) for v in (box[0] * sx, box[1] * sy, box[2] * sx, box[3] * sy)]
    med = np.median(arr.reshape(-1, 3), axis=0)
    arr[y0:y1, x0:x1] = med
    return Image.fromarray(arr.astype(np.uint8))


# ---------------------------------------------------------------------------
# Readings
# ---------------------------------------------------------------------------
def palette(img, n=8):
    q = img.quantize(colors=n, method=Image.Quantize.MEDIANCUT)
    raw = q.getpalette() or []
    k = min(n, len(raw) // 3)
    pal = np.array(raw[: k * 3], dtype=float).reshape(-1, 3) / 255.0
    counts = np.bincount(np.asarray(q).ravel(), minlength=k)[:k].astype(float)
    keep = counts > 0
    return srgb_to_lab(pal[keep]), counts[keep] / counts[keep].sum()


def readings(img):
    rgb = np.asarray(img, dtype=float) / 255.0
    lab = srgb_to_lab(rgb)
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    chroma = np.hypot(a, b)
    lo, med, hi = np.percentile(L, [50, 50, 99])
    amb_mask = (L > 15) & (L < 50) & (b <= 12)
    lap = np.abs(4 * L[1:-1, 1:-1] - L[:-2, 1:-1] - L[2:, 1:-1] - L[1:-1, :-2] - L[1:-1, 2:])
    return {
        "darkness": float((L < 25).mean()),
        "light_pool": float(hi - med),
        "torch_pool": float(((b > 12) & (L > 25)).mean()),
        "ambient_share": float(amb_mask.mean()),
        "ambient_tint": float(b[amb_mask].mean()) if amb_mask.mean() >= 0.005 else float("nan"),
        "saturation": float(chroma.mean()),
        "detail": float(lap.mean()),
        "_palette": palette(img),
    }


def palette_distance(p1, p2):
    """Symmetric weighted mean of each colour's distance to the other palette's nearest colour."""
    (c1, w1), (c2, w2) = p1, p2
    d = np.linalg.norm(c1[:, None, :] - c2[None, :, :], axis=-1)
    return float(0.5 * ((d.min(axis=1) * w1).sum() + (d.min(axis=0) * w2).sum()))


def closeness(metric, shot, target):
    """0-100: how close a shot's reading is to the target's."""
    if metric == "palette":
        return max(0.0, 100.0 * (1.0 - palette_distance(shot["_palette"], target["_palette"]) / 15.0))
    s, t = shot[metric], target[metric]
    if metric == "darkness":
        return max(0.0, 100.0 * (1.0 - abs(s - t) / 0.15))
    if metric == "ambient_tint":
        # A difference in b*: 0 apart = 100, 8 apart (a clearly different cast)
        # = 0. No visible ambient at all (nan) can't read as a cold world.
        if s != s:
            return 0.0
        return max(0.0, 100.0 * (1.0 - abs(s - t) / 8.0))
    # Ratio metrics: equal = 100, twice or half = 50.
    if s <= 0 or t <= 0:
        return 0.0
    return 100.0 * min(s, t) / max(s, t)


def mockup_world():
    """The mockup's world area at full resolution, with its HUD painted out."""
    world = Image.open(MOCKUP).convert("RGB").crop(MOCKUP_WORLD_BOX)
    return mask_box(world, MOCKUP_HUD_BOX, (MOCKUP_WORLD_BOX[2], MOCKUP_WORLD_BOX[3]))


def target_readings():
    return readings(load(mockup_world()))


def score_image(img_or_path, metrics, target):
    r = readings(load(img_or_path))
    names = list(METRICS) if metrics == "all" else metrics
    scores = {m: round(closeness(m, r, target), 1) for m in names}
    values = {}
    for m in METRICS:
        v = palette_distance(r["_palette"], target["_palette"]) if m == "palette" else r[m]
        values[m] = None if v != v else round(v, 3)
    return {"values": values, "scores": scores, "overall": round(float(np.mean(list(scores.values()))), 1)}


# ---------------------------------------------------------------------------
# Rubric
# ---------------------------------------------------------------------------
def load_rubric(run_dir):
    template = json.load(open(RUBRIC))
    path = os.path.join(run_dir, "rubric.json")
    marks = json.load(open(path)) if os.path.exists(path) else {}
    # benchmark.sh copies the previous run's marks and flags them; a person
    # deletes "_unreviewed" once they've re-scored what the new art changed.
    unreviewed = marks.get("_unreviewed")
    items = []
    for it in template["items"]:
        m = marks.get(it["id"], {})
        items.append({**it, "score": m.get("score"), "note": m.get("note", "")})
    scored = [i for i in items if i["score"] is not None]
    total = sum(i["weight"] for i in scored)
    pct = round(100.0 * sum(i["score"] * i["weight"] for i in scored) / total, 1) if total else None
    return items, pct, len(scored) == len(items) and not unreviewed


# ---------------------------------------------------------------------------
# Run, history, report
# ---------------------------------------------------------------------------
def score_run(name, label=None, quiet=False):
    """Scores one run, updates the history (kept in run-name order) and rewrites
    the report for the latest run. Re-scoring keeps the run's label (unless a
    new one is given) and its render date."""
    run_dir = os.path.join(RUNS, name)
    if not os.path.isdir(run_dir):
        sys.exit(f"No shots in {run_dir}. Render them first with tools/visual_benchmark.gd -- --run={name}")
    missing = [s for s in SHOTS if not os.path.exists(os.path.join(run_dir, f"{s}_world.png"))]
    if missing:
        sys.exit(f"{run_dir} is missing {', '.join(m + '_world.png' for m in missing)}: a partial run would skew the score.")
    hist_path = os.path.join(BENCH, "history.json")
    history = json.load(open(hist_path)) if os.path.exists(hist_path) else []
    old = next((h for h in history if h["run"] == name), None)
    if label is None:
        label = old["label"] if old else ""
    target = target_readings()
    shots = {stem: score_image(os.path.join(run_dir, f"{stem}_world.png"), spec["metrics"], target) for stem, spec in SHOTS.items()}
    rubric_items, rubric_pct, rubric_done = load_rubric(run_dir)
    rendered = os.path.getmtime(os.path.join(run_dir, f"{next(iter(SHOTS))}_world.png"))
    result = {
        "run": name,
        "label": label,
        "date": old["date"] if old else datetime.date.fromtimestamp(rendered).isoformat(),
        "scorer_version": SCORER_VERSION,
        "measured": round(float(np.mean([s["overall"] for s in shots.values()])), 1),
        "rubric": rubric_pct,
        "rubric_complete": rubric_done,
        "shots": shots,
        "target": {m: round(v, 3) for m, v in target.items() if not m.startswith("_")},
    }
    json.dump(result, open(os.path.join(run_dir, "metrics.json"), "w"), indent=2)
    history = [h for h in history if h["run"] != name]
    history.append({k: result[k] for k in ("run", "label", "date", "scorer_version", "measured", "rubric", "rubric_complete")}
                   | {"per_shot": {s: v["overall"] for s, v in shots.items()}})
    history.sort(key=lambda h: h["run"])
    json.dump(history, open(hist_path, "w"), indent=2)
    latest = history[-1]["run"]
    latest_result = result if latest == name else json.load(open(os.path.join(RUNS, latest, "metrics.json")))
    write_report(latest_result, load_rubric(os.path.join(RUNS, latest))[0], history)
    if not quiet:
        print(f"{name}: measured {result['measured']}/100, rubric {rubric_pct if rubric_pct is not None else 'unscored'}"
              f"{'' if rubric_done else ' (incomplete)'}; report (latest run, {latest}): docs/benchmark/REPORT.md")
    return result


def fmt_delta(cur, prev):
    if prev is None or cur is None:
        return ""
    d = cur - prev
    return f" ({'+' if d >= 0 else ''}{d:.1f})"


def write_report(result, rubric_items, history):
    name = result["run"]
    idx = next(i for i, h in enumerate(history) if h["run"] == name)
    prev = history[idx - 1] if idx > 0 else None
    if prev and prev.get("scorer_version") != result.get("scorer_version"):
        prev = None # different metric definitions: no delta
    lines = [
        "# Visual benchmark",
        "",
        "How close the game's look is to the owner's target, [`00_target_mockup.jpg`](../art_reference/00_target_mockup.jpg) and "
        "[`VISUAL_DIRECTION.md`](../VISUAL_DIRECTION.md). Generated by `tools/visual_benchmark.py`; don't edit by hand.",
        "",
        f"**Latest run: `{name}`** ({result['date']}){': ' + result['label'] if result['label'] else ''}",
        "",
        f"- **Measured: {result['measured']}/100**{fmt_delta(result['measured'], prev['measured'] if prev else None)}: image metrics vs the mockup's world area.",
        f"- **Rubric: {str(result['rubric']) + '/100' if result['rubric'] is not None else 'unscored'}**"
        f"{fmt_delta(result['rubric'], prev['rubric'] if prev else None)}{'' if result['rubric_complete'] else ' (incomplete)'}: the doc's must-haves, scored by hand.",
        "",
        "| Target | This run |",
        "|---|---|",
        f"| ![target](../art_reference/00_target_mockup.jpg) | ![b1](runs/{name}/b1_watchhouse_night_pack.png) |",
        "",
        "## Shots",
        "",
        "| Shot | Overall | " + " | ".join(METRICS) + " |",
        "|---|---|" + "---|" * len(METRICS),
    ]
    for stem, s in result["shots"].items():
        cells = [f"{s['scores'][m]:.0f}" if m in s["scores"] else "–" for m in METRICS]  # noqa: E501
        lines.append(f"| [{SHOTS[stem]['title']}](runs/{name}/{stem}_world.png) | **{s['overall']:.0f}** | " + " | ".join(cells) + " |")
    lines += ["", "Raw readings (target first, then each shot):", "", "| | " + " | ".join(METRICS) + " |", "|---|" + "---|" * len(METRICS)]
    tgt = result["target"]
    def num(v):
        return "none" if v is None or v != v else f"{v:.3g}"
    lines.append("| **target** | " + " | ".join("0 (itself)" if m == "palette" else num(tgt[m]) for m in METRICS) + " |")
    for stem, s in result["shots"].items():
        lines.append(f"| {stem} | " + " | ".join(num(s["values"][m]) for m in METRICS) + " |")
    lines += ["", "### What each metric reads", ""]
    lines += [f"- **{m}**: {d}." for m, d in METRICS.items()]
    lines += ["", "Caveats: `detail` also rises with exposure and with film grain or dithering, and every reading moves with overall "
              "brightness. So compare runs rendered the same way, and treat a jump from a lighting or post-process change with suspicion. "
              f"Scorer version {result.get('scorer_version', '?')}; rows from other versions in the history aren't comparable."]
    lines += ["", "## Rubric", "", "| Pillar | Must-have | Score | Note |", "|---|---|---|---|"]
    for it in rubric_items:
        sc = "–" if it["score"] is None else f"{it['score']:g}"
        lines.append(f"| {it['pillar']} | {it['text']} | {sc} | {it['note']} |")
    lines += ["", "## History", "", "| Run | Rendered | Scorer | Measured | Rubric | " + " | ".join(SHOTS) + " | What changed |",
              "|---|---|---|---|---|" + "---|" * len(SHOTS) + "---|"]
    for h in history:
        per = " | ".join(f"{h['per_shot'].get(s, '–')}" for s in SHOTS)
        lines.append(f"| `{h['run']}` | {h['date']} | v{h.get('scorer_version', 1)} | {h['measured']} | {h['rubric'] if h['rubric'] is not None else '–'} | {per} | {h['label']} |")
    lines += ["", "## Running it", "",
              "```bash",
              "xvfb-run -a -s \"-screen 0 1920x1080x24\" $GODOT --path . --rendering-driver vulkan \\",
              "  --script res://tools/visual_benchmark.gd -- --run=<name>",
              "cp docs/benchmark/runs/<previous>/rubric.json docs/benchmark/runs/<name>/   # then re-score the must-haves",
              "python3 tools/visual_benchmark.py --run <name> --label \"what changed\"",
              "```", ""]
    open(os.path.join(BENCH, "REPORT.md"), "w").write("\n".join(lines))


# ---------------------------------------------------------------------------
# Self-test
# ---------------------------------------------------------------------------
def selftest():
    target = target_readings()
    failures = []

    def check(cond, label):
        print(f"{'  ok  ' if cond else '  FAIL'}  {label}")
        if not cond:
            failures.append(label)

    mock_world = mockup_world()
    same = score_image(mock_world, "all", target)
    check(all(v >= 99.0 for v in same["scores"].values()), f"the mockup scored against itself is ~100 on every metric {same['scores']}")
    grey = score_image(Image.new("RGB", mock_world.size, (128, 128, 128)), "all", target)
    check(grey["overall"] < 40.0, f"a flat grey frame scores low ({grey['overall']})")
    white = score_image(Image.new("RGB", mock_world.size, (235, 235, 235)), "all", target)
    check(white["overall"] < 30.0, f"a bright white frame scores low ({white['overall']})")
    rng = np.random.default_rng(7)
    noise = Image.fromarray(rng.integers(0, 256, (mock_world.height, mock_world.width, 3), dtype=np.uint8))
    noisy = score_image(noise, "all", target)
    check(noisy["overall"] < 50.0, f"colour noise scores low ({noisy['overall']})")
    cold = np.asarray(mock_world, dtype=float)
    cold = Image.fromarray(np.clip(cold[..., ::-1], 0, 255).astype(np.uint8))  # swap red and blue: cold highlights
    swapped = score_image(cold, "all", target)
    check(swapped["scores"]["torch_pool"] < 40.0 and swapped["scores"]["ambient_tint"] < 80.0, f"swapping red and blue (cold torchlight, blue cast) breaks torch_pool and ambient_tint ({swapped['scores']['torch_pool']}, {swapped['scores']['ambient_tint']})")
    bright = Image.fromarray(np.clip(np.asarray(mock_world, dtype=float) * 2.2 + 30, 0, 255).astype(np.uint8))
    lit = score_image(bright, "all", target)
    check(lit["scores"]["darkness"] < 60.0, f"brightening the mockup breaks 'reads in darkness' ({lit['scores']['darkness']})")
    blurred = score_image(mock_world.resize((60, 34)).resize(mock_world.size), "all", target)
    check(blurred["scores"]["detail"] < 60.0, f"blurring away the surface detail breaks 'detail' ({blurred['scores']['detail']})")
    black = score_image(Image.new("RGB", mock_world.size, (0, 0, 0)), "all", target)
    check(black["overall"] < 30.0, f"a black frame scores low ({black['overall']})")
    murk = score_image(Image.new("RGB", mock_world.size, (20, 20, 22)), "all", target)
    check(murk["overall"] < 30.0 and murk["scores"]["palette"] < 70.0, f"a flat near-black frame scores low, palette too ({murk['overall']}, palette {murk['scores']['palette']})")
    check(murk["scores"]["light_pool"] < 10.0 and murk["scores"]["ambient_share"] < 10.0, "...with no light pool and no visible ambient")
    gaudy = Image.new("RGB", mock_world.size, (200, 30, 40))
    gaudy.paste((30, 160, 60), (0, 0, mock_world.width // 2, mock_world.height))
    loud = score_image(gaudy, "all", target)
    check(loud["scores"]["palette"] < 20.0 and loud["scores"]["saturation"] < 20.0, f"a loud red-and-green frame fails palette and saturation ({loud['scores']['palette']}, {loud['scores']['saturation']})")
    lab = srgb_to_lab(np.asarray(load(mock_world), dtype=float) / 255.0)
    amb = (lab[..., 0] > 15) & (lab[..., 0] < 50) & (lab[..., 2] <= 12)
    warm_amb = np.asarray(load(mock_world), dtype=float)
    warm_amb[amb] = np.clip(warm_amb[amb] * np.array([1.18, 1.0, 0.72]), 0, 255)  # brown the ambient, keep the torch
    browned = score_image(Image.fromarray(warm_amb.astype(np.uint8)), "all", target)
    check(browned["scores"]["ambient_tint"] < 30.0, f"warm brown shadows instead of the cold blue-grey ambient fail ambient_tint ({browned['scores']['ambient_tint']})")
    check(history_selftest(), "re-scoring keeps history in run order, the report on the latest run, deltas right, labels and render dates kept; a copied rubric reads as incomplete")
    template = json.load(open(RUBRIC))
    ids = [i["id"] for i in template["items"]]
    check(len(ids) == len(set(ids)) and all(i["weight"] > 0 for i in template["items"]), "the rubric's items have unique ids and positive weights")
    print(f"\n{'PASS' if not failures else 'FAIL'}: {len(failures)} failure(s)")
    return 1 if failures else 0


def history_selftest():
    """Scores three fake runs in a temporary benchmark folder."""
    import shutil
    import tempfile
    global BENCH, RUNS
    saved = (BENCH, RUNS)
    tmp = tempfile.mkdtemp(prefix="vb-selftest-")
    try:
        BENCH, RUNS = tmp, os.path.join(tmp, "runs")
        base = mockup_world()
        for run, gain in (("000-a", 1.0), ("001-b", 0.6), ("002-c", 1.0)):
            d = os.path.join(RUNS, run)
            os.makedirs(d)
            img = Image.fromarray(np.clip(np.asarray(base, dtype=float) * gain, 0, 255).astype(np.uint8))
            for stem in SHOTS:
                img.save(os.path.join(d, f"{stem}_world.png"))
        score_run("000-a", "first", quiet=True)
        score_run("002-c", "third", quiet=True)
        score_run("001-b", "second", quiet=True)
        first_date = next(h for h in json.load(open(os.path.join(BENCH, "history.json"))) if h["run"] == "000-a")["date"]
        os.utime(os.path.join(RUNS, "000-a", f"{next(iter(SHOTS))}_world.png"), (0, 0))  # as if freshly checked out
        score_run("000-a", None, quiet=True)  # re-score an older run, no label
        json.dump({"_unreviewed": "copied from 001-b", **{i["id"]: {"score": 0} for i in json.load(open(RUBRIC))["items"]}},
                  open(os.path.join(RUNS, "002-c", "rubric.json"), "w"))
        score_run("002-c", None, quiet=True)
        hist = json.load(open(os.path.join(BENCH, "history.json")))
        report = open(os.path.join(BENCH, "REPORT.md")).read()
        c = next(h for h in hist if h["run"] == "002-c")
        b = next(h for h in hist if h["run"] == "001-b")
        delta = round(c["measured"] - b["measured"], 1)
        ok = [h["run"] for h in hist] == ["000-a", "001-b", "002-c"]
        ok = ok and "Latest run: `002-c`" in report and f"({'+' if delta >= 0 else ''}{delta:.1f})" in report
        ok = ok and hist[0]["label"] == "first" and all(h["scorer_version"] == SCORER_VERSION for h in hist)
        ok = ok and hist[0]["date"] == first_date  # the render date survives a re-score
        ok = ok and hist[2]["rubric_complete"] is False and "(incomplete)" in report  # a copied rubric isn't finished
        return ok
    finally:
        BENCH, RUNS = saved
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--run", help="run name: the folder under docs/benchmark/runs/")
    ap.add_argument("--label", default=None, help="one line on what changed since the last run (kept on re-score if omitted)")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()
    if args.selftest:
        sys.exit(selftest())
    if not args.run:
        ap.error("--run or --selftest is required")
    score_run(args.run, args.label)


if __name__ == "__main__":
    main()
