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

Two places exist: the prologue's ledge (`la_ledge`) and Marget Sayle's bothy (`la_bothy`). One
thing hunts: the walking bloom on the shelf (`js/bloom4.js`). The bothy's door has a bar (`js/door5.js`).
Ash falls and sleet comes in spells, stopped by roofs (`js/weather6.js`). You start with a torch; a lantern is found or bought (`js/lantern7.js`, `js/torch38.js`). The bothy is built the highland way (`js/building8.js`). Dread rises and the picture closes in (`js/dread9.js`). Begin asks who walks north, and the panel speaks this game (`js/panel10.js`).

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
    node test/bloom4.test.js --no-browser
    node test/door5.test.js --no-browser
    node test/weather6.test.js --no-browser
    node test/lantern7.test.js --no-browser
    node test/building8.test.js --no-browser
    node test/dread9.test.js --no-browser
    node test/panel10.test.js --no-browser
    node test/hearth27.test.js --no-browser
    node test/torch38.test.js --no-browser
    node test/touchlink36.test.js --no-browser       # the phone link, not Act III
    node test/wires19-23.test.js --no-browser    # phases 19-23 against fake G, update and HUD
    node tools/pwa/precache.js --check                # the offline list is current
    node tools/icons.js --check                       # the icons match the mark in js/art2.js

    NODE_PATH=$(npm root -g) node test/fork0.test.js  # the played half, headless Chromium
    NODE_PATH=$(npm root -g) node test/ledge1.test.js
    NODE_PATH=$(npm root -g) node test/art2.test.js
    NODE_PATH=$(npm root -g) node test/sun3.test.js
    NODE_PATH=$(npm root -g) node test/bloom4.test.js
    NODE_PATH=$(npm root -g) node test/door5.test.js
    NODE_PATH=$(npm root -g) node test/weather6.test.js
    NODE_PATH=$(npm root -g) node test/lantern7.test.js
    NODE_PATH=$(npm root -g) node test/building8.test.js
    NODE_PATH=$(npm root -g) node test/dread9.test.js
    NODE_PATH=$(npm root -g) node test/panel10.test.js
    NODE_PATH=$(npm root -g) node test/hearth27.test.js
    NODE_PATH=$(npm root -g) node test/torch38.test.js
    NODE_PATH=$(npm root -g) node tools/shots.js . docs/screenshots
    NODE_PATH=$(npm root -g) node tools/sunshots.js docs/screenshots      # the sun's day
    NODE_PATH=$(npm root -g) node tools/beastshots.js docs/screenshots    # the look test (tools/look/)
    NODE_PATH=$(npm root -g) node tools/bloomshots.js docs/screenshots    # the walking bloom, posed
    NODE_PATH=$(npm root -g) node tools/bloomgifs.js docs/screenshots     # and played, as clips (needs ffmpeg)
    NODE_PATH=$(npm root -g) node tools/doorshots.js docs/screenshots     # the door: stills and played clips
    NODE_PATH=$(npm root -g) node tools/weathershots.js docs/screenshots  # ashfall and sleet: stills and a clip
    NODE_PATH=$(npm root -g) node tools/lanternshots.js docs/screenshots  # the lantern: stills and a clip (Phase 38 held off)
    NODE_PATH=$(npm root -g) node tools/torchshots.js docs/screenshots    # the torch, the found lantern: stills and a clip
    NODE_PATH=$(npm root -g) node tools/buildshots.js docs/screenshots    # the highland building: stills and a clip
    NODE_PATH=$(npm root -g) node tools/dreadshots.js docs/screenshots    # dread: stills and a clip
    NODE_PATH=$(npm root -g) node tools/panelshots.js docs/screenshots    # creation, the HUD and the panels

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
    js/bloom4.js          Phase 4: the walking bloom: a pure think() step, a boned body drawn by one pass
    js/door5.js           Phase 5: the bar on the bothy's door; the doors the bloom can go through (BLOOM4.DOORS)
    js/weather6.js        Phase 6: ashfall and sleet, by day number; a pass that stops at roofs (EAVES78.shelter)
    js/lantern7.js        Phase 7: the lantern in the left hand; its oil (G.flags.la_oil, la_flasks); its light (LIGHTING.lanternLight)
    js/building8.js       Phase 8: EAVES78.STYLES.la_ledge.plan, the highland planner; turf, the smoke hole, the owner's drystone
    js/dread9.js          Phase 9: dread (DREAD9.state().d, 0..1), a pure step(S, env, dt); its picture is pass 'la-dread' at order 88
    js/panel10.js         Phase 10: creation (G.flags.la_bg, PANEL10.BACKGROUNDS), the HUD's buttons and words, the panels, the credits
    js/opening11.js       Phase 11: the opening look; the Slagcrown held at the middle of the view for 2 s before the errand
    js/company12.js       Phase 12: the two-person company, permanent death, succession at the hearth, the roll
    js/carter13.js        Phase 13: the carter follows, holds and waits, goes down and dies; his two orders
    js/account14.js       Phase 14: the Account (A), the ledger, the first promise, hearth marking, forsworn
    js/carry15.js         Phase 15: Marget's arm, the 0.65 walk, both hands full, the look back and the title
    js/book16.js          Phase 16: the thirty warning-book entries, generated from the Markdown; read marks and search
    js/kit17.js           Phase 17: the item table in salt, the eight kits, burden, capacity, torch fuel, one light; drives the bag, hands, worn slots, pace, noise and old saves
    js/cards18.js         Phase 18: the eight cards' exact effects, no levels, stamina, bleeding, sight and hearing; drives fatigue, fog, attack cost and pack noise
    js/hearing19.js       Phase 19: the noise and hearing table, stone and surfaces, company noise
    js/lungs20.js         Phase 20: exposure, the four stages, mask, fire and silence
    js/weather21.js       Phase 21: six skies and their sight, sound, spore and ground
    js/deadcalm22.js      Phase 22: cinder squall and the ninety-second Dead Calm
    js/combat23.js        Phase 23: commitment clock, stamina at the start, formation, clang, lodge, stagger
    js/bloom24.js         Phase 24: bloom wounds, clouds, burst and prologue invulnerability
    js/coop25.js          Phase 25: co-op parity, one noise, one sighting, one fuel pool
    js/chart26.js         Phase 26: five nodes, six roads, shortest path and supplies
    js/hearth27.js        Phase 27: the bothy REST panel: rest, store, named dead and promises
    js/people28.js        Phase 28: morale, memory and meetings
    js/chill29.js         The chill (Phase 29): warmth, the cold stages and the lit hearth
    js/workings30.js      Phase 30: eight workings, costs and prohibitions
    js/marks31.js         Phase 31: glim, keen, rime, ember, dull-voice
        js/bestiary32.js     Phase 32: the seventeen things in the ash; a page in the warning book
    js/actone33.js       Phase 33: Act I, the Burned Quay's five scenes and three choices
    js/acttwo34.js       Phase 34: Act II, the three courts, the receipt and the winter roof
    js/sidearcs35.js     Phase 35: Act II, the five side arcs and their consequences
    js/actthree36.js     Phase 36: Act III, the eleven days, Marget's limit and the wall
    js/touchlink36.js    Support, not a phase: the phone link; ?touch/?mobile or a coarse pointer starts touch controls
    js/endings37.js      Phase 37: the five endings and the player's last line
    js/torch38.js        Phase 38: start with a torch (the left hand's light, by LANTERN7.setSource); the horn lantern found in the bothy or bought
    tools/look/           look tests the page never loads (the quarry-troll, until it goes into the game)

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
- The engine's noise (`G.noise`) floors at 1.0 standing, 2.4 walking, 4.2 running, plus what you wear.
  A hunter that hears by it lives in `js/bloom4.js`: copy its `think(S, env, dt)` shape, which runs in
  Node, so its rules can be tested step by step without a browser.
- A modelled body: build every part once, in the space of the bone that carries it (a bone index per
  vertex), and send the bones as `uniform vec4 uBone[]` each frame. Rebuilding geometry each frame
  cost the look test 27 ms. Give it a solid map entity with an empty sprite so it can be looked at and
  bumped into, and a flat painting for the classic renderer.
- The hunt's metres are cells of walking (P33): the walker covers about 2.6 cells a second.
- To let the bloom use a door, push `{ from, at, to, out, barred(), onBarred(S), waitAt }` onto `BLOOM4.DOORS` and
  give the far map an entity with `BLOOM4.addMap(map)`. `transfer(portal)` and `useDeco(e)` in `js/game.js` are the
  hooks for a door that will not open and a thing you use.
- Anything that falls (ash, sleet) should stop at roofs: read `EAVES78.shelter(map)` (heights in game units, times
  `R3D.ZK`), place each flake in the world along the view ray, skip it under a roof, and write `gl_FragDepth` so walls
  hide it. `js/weather6.js` does all three. `R3D.passes()` returns copies; to wrap a pass, use `R3D.getPass(name)`.
- The weather on this game's maps is `WEATHER6`, not the engine's `Weather` (held 'clear' since Phase 1). It reaches
  the light through `Engine.setWeather`, the fog through `R3D.on('frame')`, walking through `playerMove` and the
  bloom through `BLOOM4.setSenses`.
- The player's light is `LIGHTING.lanternLight()` (js/lighting.js), read once a frame; `js/lantern7.js` replaces it on this
  game's maps. Lit or not is the engine's `UPG.lantern`; the oil is `G.flags.la_oil` (seconds), saved with the game.
  What is in the left hand is a source (`LANTERN7.setSource`): Phase 38's torch, or Phase 7's lantern when none is set.
  Read the light in hand through `LANTERN7.frac()`, `source()`, `reach()` and `flameNow()`, never `la_oil` directly.
  Point lights in the 3D renderer are multiplied, not added (`js/light21.js`): warm light on blue frost turns it
  white, so a light that must read warm needs little blue and a strong red.
- The 3D renderer shades your own body (pass `body`) at a point 0.3 cells in front of your eye. Any light there burns the
  sword arm white; `js/lantern7.js` turns its own light down for that one pass (the lights buffer is binding 1).
- Things drawn on `Engine.ctx` after `drawHUD` show over the 3D view in the 320 x 150 view's own units; clip to the view.
- A region builds its own way through `EAVES78.STYLES[mapId].plan(m)`. `js/building8.js` runs the timber planner under a
  copy of the old style row (`la_ledge_timber`, via `Object.create(m)` with another `id`) and reshapes what it finds.
  `EAVES78.planOf` caches a plan against `m.cells`: give the map a copy of that array to make the planner look again.
  Heights in a plan are absolute: the bothy stands on the shelf at 9.5, so a ridge limit is `top - 1 + limit`.
- Smoke from anything: `FIRESMOKE.spawn(0, x, y, z, vx, vy, vz, life, r0, r1, a, warm, zmax)`, in game units. The 3D
  renderer draws it with the engine's chimney smoke.
- To hash two frames alike, hold `ANIM.T` as well as the clocks: set it back before each `render()`. The lantern's sway
  and the smoke read it.
- To change what the whole frame looks like, run before the lighting's last pass (order 90), which reads the scene's colour:
  `R3D.resolveScene`, draw from `scene.color` into a target of your own, then blit it back into `scene.fb` with
  `drawBuffers([COLOR_ATTACHMENT0, NONE])` so the material target is left alone. Never sample a texture attached to the
  framebuffer you draw into. `js/dread9.js` does this. Hash a frame only after one warm-up frame: the first frame after
  any change differs while the sky settles.
- The Shattered Octave's own `js/dread.js` and opening film (`js/cinematic24.js`) are held off on this game, and their
  Options rows removed. Never call `DREAD.setOn` or save their settings: GitHub Pages serves this game and the Octave from
  one site, so they share a browser's storage.
- Begin asks who walks north first (`#la-who`); `test/harness.js` picks the deserter. `HUD_BTNS` (js/game.js) is a const
  array that `hudClick` reads: Phase 10 refills it in place. `js/panel10.js` wraps `drawHUD` last, so a test that puts an
  earlier phase's inner `drawHUD` back must put this layer back too: `PANEL10.wrapHUD(inner)`.
- The in-game credits are `VOICES.CREDIT_SECTIONS`, refilled in place by Phase 10. The engine's panels are opened by name
  (`renderCharacter`, `renderInventory`, ...); wrap the global to replace one on this game's maps.
- The bothy is tiny (cells 1 to 5 by 1 to 4) and crowded: a test that walks a player round the bloom inside will
  pin them against the table. Test indoor behaviour with a still player, or start them clear of the furniture.

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
- **People are painted; beasts are modelled** (D8, confirmed as O9). A modelled body gets the same
  ink outline and the same few dithered steps of light as a painted person, so the two sit together.

## Canon

Read `docs/worldbuilding/CANON.md` before writing any lore or in-game text.

- **O1:** only humans are people. Every creature is an animal, a lizard, a fish or a monster.
- **O3:** the wider world and this game's design decisions are approved.
- **O4:** small magic exists: spoken workings and marks on slag-iron. It is small and always costs.
- **O5:** this game replaced the isometric one; all lore is kept.
- **O6:** everything proposed for the ledge and the bothy (P1 to P26, except P17) is approved.
- **O7:** the walking bloom hunts on the highland edge. It is a body, not a beast.
- **O8:** the sun's day is approved: coal, coin and clear days, fixed by the day's number.
- **O9:** beasts are modelled, the walking bloom too; living people stay painted.
- **O14:** every traveller starts with a torch; a lantern is found or bought (Phase 38).
- **O15:** the world's scale is the hybrid: each region one dense walkable zone of about a square mile, the Chart between
  regions, something to find every 30 to 60 seconds of walking, and not on the small side.
- No prophecy. Who made the Vaults, what the orks fled and why the Unnamed rise stay unsettled.

## Git

- Remote: `https://github.com/dribblejerp-KlunkDunker/Ashen-Wilds` (`main`).
- Commit under the owner's name and GitHub address, as earlier commits do, so GitHub credits them.
  Take the address from `git log`; never type it into a command or send it anywhere else.
- Keep `README.md` and `ROADMAP.md` in sync with what is actually built.

## Working with the owner (sleeves)

- Before a big design-heavy build, say which model it needs. The owner has no access to Fable; Opus is
  the strongest they have. Use Opus for design-heavy phases, canon and shaders; Sonnet will do for
  routine follow-through (bringing a branch up to date, fixing a test, docs).
- The owner does not run the game from source: stills are how they see progress.
- Be honest about what a check cannot show: feel, motion, timing, sound and how it reads on a real
  screen still need a person at the controls.
