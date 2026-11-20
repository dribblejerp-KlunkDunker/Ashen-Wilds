# The Tally: the plan

**One page. M0, for sleeves.** The design is `design.md`; every departure from the brief is
`lore-deltas.md`. This page is what I would do next, in what order, and what could stop it.

## What v1 is

**Three nights, and nothing that is not needed to prove them.** Ruled 2026-11-20:

- **Stages 1-3**: the Outside Fire, the Old Causeway, Halwen House, with their three bosses.
- **8 weapons, 8 kit, 8 evolutions**, no unions; **8 of the 12 workings**.
- **6 characters**: Rafe, Merrick, Edda, Pim, Margery, Aud.
- **The Tally Room, saves, and the relics found in stages 1-3.**
- **One mode**: the Watch Rota, local. **No co-op.**

Stage 1 already holds every idea the game has, and stages 1-3 are the three map types the engine has
(open, lane, bounded). The other six stages are content, not capability.

**Cut from v1, deliberately:** stages 4-9 and the six secret stages; the Weight Gate and the billman;
eight weapons, eight kit, eight evolutions and both unions; nine characters including all three secret
ones; the Naming Stone's long arc and the collection; the Long Account and the Approved Load; all of
co-op.

**What this buys is not the three stages but the milestones either side of them.** M1-M4 no longer
assume shared embers, a pause for every player, revive, interest management, fifteen painted
characters or nine bosses' art. Those were the costs making every earlier milestone expensive, and
they are now gone from the work in front of us.

## Where the work lives

`the-tally/` in `dribblejerp-KlunkDunker/Ashen-Wilds`, served by the existing Pages workflow at
`/the-tally/`. Plain ES modules, no build step, no framework, no runtime dependencies. Shared code
(audio, net, the sun's day, the palette ramp) goes in `shared/` so neither game owns a copy. Work on a
branch, one PR per milestone, never straight to `main`.

## What already exists that we should not rebuild

- **Audio** (`js/audio.js`) is a complete Web Audio engine with a master chain, a low-pass muffler, an
  echo bus, procedural SFX, a per-family voice limiter, a duck-to-silence and a streaming score. Dead
  Calm, the heartbeat and the thinning mix are nearly free.
- **Networking** (`js/net19.js`) is a working host/guest transport with join codes, typed messages,
  rate limits and stats. It is not v1 work, but it is what v1.1's star is built on.
- **The sun's day** (`js/sun3.js`, `js/ledge1.js`): coal, coin and clear days fixed by the day's
  number, the coal sun, the dither ramp. That is this game's stage lighting, already written.
- **The house test pattern**: one test file per feature, half `--no-browser`, half headless Chromium,
  stills written into `docs/screenshots/` and looked at. Copy it exactly.

## The order

**M1, feel (the one that matters).** Fixed 120 Hz step, four input kinds, the camera, movement and the
Watch Step to the exact numbers in `design.md` section 3, circle-vs-segment collision, the Watch Sword,
one goblin type with steering and separation, embers, the level curve, a bare page. `tests/feel.html`
and `tests/stress.html` running. **Nothing else until the movement is right**, because everything after
this is built on how it feels.

**M2, the horde.** The WebGL2 instancer, the pools, the spatial hash, flow fields, 1,500 enemies, the
effect limiter, the light pass. The gate is a frame-time capture. One player's snapshot budget only:
no interest management until v1.1.

**M3, the build.** The 8 weapons, 8 kit and 8 evolutions, boxes, workings, the Debt, the cough, and the
first modelled goblin and ork rendered to sheets.

**M4, stage 1.** The complete night. This is the milestone that decides whether the game is good,
because stage 1 holds every one of the game's ideas: the fire, the naming, the rot, the Order, the
Grey Hour, a wonder, a boss and a book line.

**M5, meta and roster.** The Tally Room, saves with export, the relics of stages 1-3, and characters
1-6 with their unlocks.

**M6, the road so far.** Stages 2 and 3, their bosses and pages, and the Watch Rota. Three stages,
start to finish, with no dead ends.

**M7, ship.** The bot, accessibility, Chromebook performance, README, Pages, a trailer capture.

## What I think is risky

1. **1,500 enemies at 60 fps on an Intel Chromebook.** Everything in the architecture exists for this
   and none of it is proven until M2. If the simulation cannot hold 4 ms, the fix is fewer behaviours
   per enemy per step (stagger steering across 4 frames) and a coarser flow field, not a smaller horde.
2. **The art.** The repository's rule is that every picture is made here: creatures modelled and
   rendered, people painted. That is a real production cost and the biggest unknown in the schedule.
   Three stages and six characters is the cut that keeps it payable; it is still the number to watch.
3. **The naming at the graves.** It is the best idea in the game and the easiest to make annoying. A
   three-second stationary loud action, during a horde, will feel either brave or unfair. It needs
   sleeves at the controls in M4, not a spreadsheet.
4. **Ninety minutes of content.** Three stages is a short game. Retention rests on the Tally Room, the
   Watch Rota and the muster book, and on nothing else. If M5's meta feels thin in the hand, the
   honest fix is a fourth stage, not a bigger shop.

## What I would build first if only one thing were possible

The Watch Step. It is the whole feel of the game in 0.18 s.

## The decisions, ruled

All ten questions in PR #49 were ruled on **2026-11-20**, every one as recommended:

1. **Title:** *The Tally* stands.
2. **Home:** `the-tally/` in this repo, served at `/the-tally/`.
3. **Beasts:** modelled and rendered to sheets per O9; the two-way painted/modelled test is dropped.
4. **The Weight Gate:** Merrick drops it and the player hears the one knock; in co-op, standing below
   is a volunteer choice with no default.
5. **Merrick:** on by default, and only for Rafe.
6. **Secret character:** **Wat Corley**, not the Kept Hand (S2 in the roster; Gise Marrable keeps S3).
7. **Two names:** character 10 and the Halwen siege captain stay `[name]` until M4.
8. **The Watch Rota:** local only. No online board.
9. **Co-op:** a four-player host-authoritative star above `net19`; the transport is not rewritten.
10. **Gytha Marrin:** patron and narrator, not a body.

The four that change code rather than text are therefore settled: the currency (**salt**, not coin),
the player's colour (**pale blue**, never teal), Edda's weapon (**Nails**), and the roster's shape.
**Nothing in `design.md` changes**: every ruling confirmed what it already specifies.

Fifteen proposals in `lore-deltas.md` are still open (P1-P6, P9-P15, P16 and P17). None of them blocks M1.
They are the ones that alter the design's text rather than its framing, and they need a second pass.

## What is not in this plan

No code in M0. No art. No new canon. Anything this design adds to the world is marked **proposal** in
`lore-deltas.md` and waits for a ruling.
