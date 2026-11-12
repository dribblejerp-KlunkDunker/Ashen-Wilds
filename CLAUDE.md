# CLAUDE.md - The Long Account

Guidance for Claude (and other agents) working in this repository. Player-facing documentation is
`README.md`. The phases, and everything invented and awaiting a ruling, are in `ROADMAP.md`. The
design is `docs/worldbuilding/the-round-and-the-long-account.md`. The world's rules are
`docs/worldbuilding/CANON.md`.

## What this is

A first-person, grid-world game of dread that runs in a web browser, co-op for one to four. Plain
JavaScript: **no framework, no bundler, no build step.** The engine was copied from *Echoes of the
Shattered Octave* (same owner, commit `f2b3990`, branch `phase-75-pixel-folk`) with its story taken
out (decision D14). That repository is read-only for this work: read it, never change it.

Two places exist: the prologue's ledge (`la_ledge`) and Marget Sayle's bothy (`la_bothy`).

## The owner's rules

- **The owner's word is canon, and the owner alone rules on it.** The story folder is
  `docs/worldbuilding/` and stays there. Before inventing any name,
  date, custom or fact, search it. Mark anything invented `[PROPOSED]` in `ROADMAP.md` and list it for
  a ruling. Never contradict a written line.
- **Numbered phases.** One phase is one feature, one file `js/<feature><phase>.js`, one test file
  `test/<feature><phase>.test.js`, one entry in `ROADMAP.md` and one pull request.
- **The owner merges; you never do.** Never force-push `main`. Never delete `archive/isometric-prototype`.
- **Save and publish to this repository only** (`dribblejerp-KlunkDunker/Ashen-Wilds`). The
  Shattered Octave's repository is read, never written. Check `git remote -v` before any push.
- **No picture that this repository did not make.** The Octave's art was removed in Phase 2 and
  must not come back: no copied sprite, texture, portrait or icon, and nothing embedded as base64.
  `test/art2.test.js` fails if any appears.
- **Show pictures.** After every visible change, render stills, look at them yourself, and send them.
  If they say they cannot see the difference, believe them and change approach.
- **Write plainly.** Report what changed, what you invented, what is not done, and what needs
  deciding. Say which suites you did not run.

## Run and verify

    python3 -m http.server 8000                       # play at http://localhost:8000

    node test/fork0.test.js --no-browser              # no browser needed
    node test/ledge1.test.js --no-browser
    node test/art2.test.js --no-browser
    node test/sun3.test.js --no-browser
    node tools/pwa/precache.js --check                # the offline list is current
    node tools/icons.js --check                       # the icons match the mark in js/art2.js

    NODE_PATH=$(npm root -g) node test/fork0.test.js  # the played half, headless Chromium
    NODE_PATH=$(npm root -g) node test/ledge1.test.js
    NODE_PATH=$(npm root -g) node test/art2.test.js
    NODE_PATH=$(npm root -g) node test/sun3.test.js
    NODE_PATH=$(npm root -g) node tools/shots.js . docs/screenshots
    NODE_PATH=$(npm root -g) node tools/sunshots.js docs/screenshots      # the sun's day
    NODE_PATH=$(npm root -g) node tools/beastshots.js docs/screenshots    # the look test (tools/look/)

Open every PNG `tools/shots.js` writes. Stills have caught real faults here: a seam in the smoke
running through the sun, a bothy lit like a parlour, and a bare lane in the frost tile that ruled
straight lines from the ledge to the horizon. A test caught another:
the engine lets a player wade into its water floor, so the cliff did not hold.

After any change to a file the page loads: bump its `?v=N` in `index.html`, then run
`node tools/pwa/precache.js` so `sw.js` is rebuilt. CI fails if it is stale.

Headless Chromium needs `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader
--ignore-gpu-blocklist`, and the page must set `window.__r3d21 = { automation: true }` before load
or the 3D renderer stays off. `test/harness.js` does both.

## How the engine is laid out

    index.html            loads every script in order; the last one wins when two wrap the same function
    js/engine.js          the classic raycaster (320 x 200 canvas, 150-row view); the reference renderer
    js/r3d21.js           the WebGL2 renderer: one static mesh per map, passes, R3D.extendMesh(fn)
    js/maps.js            GameMap: cells, blocks, doors, ground heights, entities
    js/game.js            state (G), walking, collision (solidAt), noise, dialogue, saves
    js/light21.js         sky by hour, sun, bloom          js/weather.js      weather states
    js/eaves78.js         roofs, gables, windows, by a per-map style table (EAVES78.STYLES)
    js/pixelfolk75.js, js/paintfolk76.js   painted people, rigged and walked
    js/net19.js ...       two-player co-op: one hosts, one joins with a six-letter code
    js/assets.js          an empty table: the engine's embedded pictures are gone
    js/fork0.js           Phase 0: stand-ins for removed story hooks
    js/art2.js            Phase 2: every tile, person, thing and hand the engine itself needs, painted in code
    js/ledge1.js          Phase 1: the ledge, the bothy, the coal sun, the words
    js/sun3.js            Phase 3: the sun crosses the sky; coal, coin and clear days
    tools/look/           look tests the page never loads (beasts painted and modelled)

Useful facts, all checked in this repository:

- A map is `new GameMap(id, name, w, h, opts)`. Floor index **2** is the engine's water: nobody can
  walk on it, except that `js/upgrades.js` lets the *player* wade in. `ledge1.js` closes that on this
  game's maps (`map._la`), which is how the cliff holds with no wall.
- A walker climbs a step of 0.36 and a grade of 1.1 (`js/engine.js`). Steeper is a cliff.
- A building is a filled rectangle of walls, 3 x 3 or more, whose texture name matches
  `/^(t_house|t_wood$|t_marble)/`, with `t_roof` inside and a door. Name a wall tile `t_house_...`
  and the roof planner finds it.
- An entity with `lightCol: [r, g, b]` is a point light.
- A pass is `R3D.addPass({ name, order, init(gl), enabled(F), draw(gl, F) })`. Core orders: sky 0,
  prepass 10, world 20, sprites 30, body 40, transparent 50, post 90.
- `window.advanceTime(ms)` steps the game without a clock. `R3D.readPixels()` reads the frame. Stop
  `performance.now` and render twice before hashing a frame; then it is the same every time.
- Options rows are added by wrapping `renderAccessibilityMenu`; switches live on `GFX`. A later
  phase adds a row by pushing onto `LEDGE1.SWITCHES`.
- The renderer's world is `(x, y, z * R3D.ZK)`: map cells across, height times `ZK` up. Geometry
  built in heights must be scaled by `ZK` or it draws nowhere you can see.
- The lighting reads the weather's `cloud` and `dark` before any pass runs. To change the light,
  wrap `Engine.setWeather` (as `js/sun3.js` does), not a pass.
- The engine's anim clock moves ash, smoke and firelight, so two stills taken one after the other
  never hash alike. Compare what a still measures, or stop the clock and take one.
- A person is one front-view painting 160 pixels high. `PAINTFOLK.autorig(sprite)` measures a rig
  from it: arms move only if they hang clear of the body from 30% to 44% of the height; legs move
  only if they stand apart from 60% down. Do not make a painting 53, 60 or 66 wide: the engine would
  lay one of its old hand-made rigs on it.
- The held weapon is `Engine.images.fp_sword`, 99 x 190, drawn at half size at the view's right.
  The arm must leave through the bottom edge of the picture, or a cut edge shows.

## Rules for new work

- **Every visual feature has a switch** in Options. Off must draw exactly as before the feature.
  Test it by frame hash, on and off.
- **Nothing visual uses live random numbers.** Use a fixed hash of position (`LEDGE1.hash`).
- **Tiles are 64 x 64, painted in code.** No image files for walls, floors or roofs.
- **In-game text is plain ASCII** (canon rule). The tests check it.
- **Do not edit the copied engine files** unless there is no other way; wrap from a phase file
  instead, as the engine's own phases do. When an engine file must change, say so in `ROADMAP.md`.
- **Keep it fast.** About a millisecond a frame per visual feature. Static geometry once per map.
  Software rendering in CI cannot measure this; say so, and measure on real hardware when you can.

## The look: rules that must hold

- **Four lights, never confused.** Yours is tallow yellow and small. The land's is ember red and
  vast. Teal belongs to the bloom. Pale blue belongs to workings.
- **Cold where you stand, fire where you are going.** The ledge is lit cool; the far country burns.
- **Black is the base colour.** Build dark and add light. Interiors are dark; one fire lights them.
- **People are painted; beasts are modelled** (D8).

## Canon

Read `docs/worldbuilding/CANON.md` before writing any lore or in-game text.

- **O1:** only humans are people. Every creature is an animal, a lizard, a fish or a monster.
- **O3:** the wider world and this game's design decisions are approved.
- **O4:** small magic exists: spoken workings and marks on slag-iron. It is small and always costs.
- **O5:** this game replaced the isometric one; all lore is kept.
- **O6:** everything proposed for the ledge and the bothy (P1 to P26, except P17) is approved.
- **O7:** the walking bloom hunts on the highland edge. It is a body, not a beast.
- No prophecy. Who made the Vaults, what the orks fled and why the Unnamed rise stay unsettled.

## Git

- Remote: `https://github.com/dribblejerp-KlunkDunker/Ashen-Wilds` (`main`).
- Commit under the owner's name and GitHub address, as earlier commits do, so GitHub credits them.
  Take the address from `git log`; never type it into a command or send it anywhere else.
- Keep `README.md` and `ROADMAP.md` in sync with what is actually built.

## Working with the owner (sleeves)

- Before a big design-heavy build, say whether a stronger model such as Fable is worth switching to.
- The owner does not run the game from source: stills are how they see progress.
- Be honest about what a check cannot show: feel, motion, timing, sound and how it reads on a real
  screen still need a person at the controls.
