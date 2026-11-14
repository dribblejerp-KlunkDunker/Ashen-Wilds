# Highland material quality - look test

Status: preparatory source-only look test. Not a numbered gameplay phase, not loaded by index.html, and not an integration claim.

## Contents

- `highland-materials.js`: six deterministic 64 x 64 code painters, CommonJS and classic-browser compatible.
- `highland-materials.html`: offline repeating-material review; no embedded images or dependencies.
- `../../test/highland-materials.test.js`: dimensions, alpha, palette bounds, determinism, periodic sampling and descriptive seam metrics.

Run `node test/highland-materials.test.js`. Open `tools/look/highland-materials.html` to review the repeat.

## Direction and scope

Muted cold mineral tones, small dithered ramps, irregular fieldstone masses rather than full-width courses, periodic grain and frost. New code adaptation of the approved direction; not a byte-identical copy of the previous Python pack. Frost has two cuts, but no map assignment is changed here. Existing game art, lighting, people, creatures, geometry and lore are untouched.

Candidate mapping for a later reviewed integration (NOT installed): rock -> t_la_rock; frost/frost2 -> t_la_frost/t_la_frost2; drystone -> t_house_la_drystone; flags -> t_flag; planks -> t_wood. No fallback aliases are changed in this look test.

## Verification boundaries

Pure Node tests were run during preparation. Periodic means the sampler repeats after 64 pixels, not that opposite edge pixels must match. Seam metrics are descriptive, not a visual quality pass. The look-test HTML has not been browser-tested. No actual-engine images, original-look switch, off-state frame equivalence, hardware timings, game test suites or PWA regeneration are claimed.

## Integration gate

Do not promote to live art until a numbered phase has an Options switch, exact original fallback, engine atlas/update checks, both classic and WebGL render checks, frozen-time before/after screenshots from the ledge and bothy, and game regression tests. Then update README/ROADMAP, script version tags and regenerate the PWA cache. Keep this draft outside js/ until that work is complete so it does not enter the game's precache list. Owner merges.
