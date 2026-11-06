# Grim Dark: Ashen Wilds — production record

The working record for the two-developer 3D build: tool versions, decisions, temporary rules,
network operation contracts, and the evidence behind each milestone. The briefs (master,
supplement, appendix) set the requirements; this file records what was decided and what ran.
Labels follow the supplement: **CONFIRMED**, **PROPOSED**, **OPEN**, **DEFERRED**, plus
**TEMPORARY** for a default chosen so work can start.

Document precedence (appendix §66): the developers' latest explicit decision, then this file and
`CLAUDE.md`, then the briefs, then proposals and examples, then earlier chat summaries.

## Milestone 0 — project foundation (2026-11-03)

| Item | State |
|---|---|
| Base project | **CONFIRMED** (owner, 2026-11-03): this Godot repository (`dribblejerp-KlunkDunker/Ashen-Wilds`). The browser prototype (`Grim-Dark-Ashen-Wilds-`) is a design reference, a source of reusable rules and data, and a rollback baseline; it is not ported as code. |
| Engine | **CONFIRMED**: Godot 4.7.2-stable (`4.7.2.stable.official.ed1daf0bf`), GDScript, Forward+. Pinned in `project.godot`, CI and the export tools. Upgraded from 4.3-stable on 2026-11-05 (decision P2; evidence below). Do not change versions during production without a recorded decision. |
| Asset tools | **PROPOSED** (brief §4): Blender, exporting glTF/GLB into `res://`. Blender was not available in the session that wrote this; no 3D asset has been authored yet. |
| Preserved prototype | `main.tscn` and everything under `scripts/` other than `scripts/net/` are the single-player Milestones 1–5 of the earlier plan: 177 headless checks, unchanged. The new networked work lives beside it, not inside it. |
| Reproducible build | Source plus the Godot binary. No export templates are in use yet; the game runs from source with the commands below. Exported test builds (appendix §57, §91) are Milestone 1's last step. |
| Collaboration | GitHub, one focused draft PR per slice, small commits; CI runs the single-player suite. The loopback network test is run locally for now (CI has no second process budget measured yet). |

Commands (from the repository root; `GODOT` is the 4.7.2-stable binary):

```bash
$GODOT --headless --path . --import                                # class cache
$GODOT --headless --path . --script res://tests/smoke_test.gd      # single-player suite (177 checks)
python3 tools/net_spike.py                                         # networked courtyard, 5 processes on loopback
python3 tools/net_spike.py --shots docs/screenshots/net            # same, plus a rendered client under Xvfb
$GODOT --headless --path . net_main.tscn -- --server --port 7788   # a dedicated server, no window
$GODOT --path . net_main.tscn -- --client --host 127.0.0.1 --port 7788 --player-key alice
```

## Clean build procedure (appendix §90, §91)

Inputs: this repository at a known commit; Godot **4.7.2-stable** (`Godot_v4.7.2-stable_linux.x86_64`,
the editor binary, which also exports); its **export templates** from the same release
(`Godot_v4.7.2-stable_export_templates.tpz`, 1.28 GB). Nothing outside the repository is read
except those two downloads; no editor clicks are involved.

```bash
# 1. Godot (once)
mkdir -p ~/godot && cd ~/godot
curl -sSL -o godot.zip https://github.com/godotengine/godot/releases/download/4.7.2-stable/Godot_v4.7.2-stable_linux.x86_64.zip
unzip -o godot.zip && export GODOT=~/godot/Godot_v4.7.2-stable_linux.x86_64

# 2. Export templates (once). Downloads the 1 GB archive and keeps only the five release
#    templates the presets use (~250 MB) in ~/.local/share/godot/export_templates/4.7.2.stable.
tools/get_export_templates.sh

# 3. From the repository root: five builds and BUILD_INFO.txt into builds/ (git-ignored)
tools/export_builds.sh

# 4. Prove the exported binaries run: the loopback test on the exported server and client
python3 tools/net_spike.py --exported builds

# 5. Optional: the desktop zips (each with BUILD_INFO.txt inside) into builds/release/
tools/package_builds.sh
```

Outputs: `builds/linux-client/ashen-wilds-client.x86_64`, `builds/linux-server/ashen-wilds-server.x86_64`
(the dedicated-server export preset), `builds/windows-client/ashen-wilds-client.exe`,
`builds/linux-arm64-client/ashen-wilds-client.arm64`, `builds/web/index.html` (the browser build:
single-threaded, WebGL 2 through the Compatibility renderer, opens the single-player prototype), and
`builds/BUILD_INFO.txt` with the build id (`NetProtocol.BUILD_ID`), protocol version, source commit
(`-dirty` if uncommitted changes were included), export time, platforms, connection steps, known
limitations, save compatibility (none yet) and log locations. These are **internal playtest builds**
(appendix §57), not release candidates. On Windows the editor binary's path differs; the steps are
otherwise the same, and the Windows build has not been run in this session.

One binary serves every role: `launcher.tscn` is the main scene and opens the networked courtyard
when the arguments after `--` contain `--server` or `--client`, otherwise the single-player
prototype. CI (`.github/workflows/checks.yml`) runs import, compile-check, the regression suite and
the loopback test on every push and pull request.

**Published playtest builds (P17).** `.github/workflows/publish.yml` runs steps 1–5 above on every
pull request and every push to `main`, with the trimmed templates cached, and keeps the desktop zips
as a workflow artifact for 14 days. On `main`, once the exported server and client have passed the
loopback test, it deploys `builds/web/` to GitHub Pages
(https://dribblejerp-klunkdunker.github.io/Ashen-Wilds/) and replaces the assets of the rolling
pre-release tagged `playtest` (https://github.com/dribblejerp-KlunkDunker/Ashen-Wilds/releases/tag/playtest).
Pages needs a one-time setting by the owner: Settings > Pages > Build and deployment > Source:
GitHub Actions. The browser build's procedural sound streams through the browser's audio worklet
(`playback_type = STREAM`; the web default plays samples, which a generator cannot be).

## Decision register (appendix §63)

| # | Decision | Status | Date | Reason / consequence | Revisit trigger |
|---|---|---|---|---|---|
| P1 | Base the 3D game on this Godot repo | CONFIRMED | 2026-11-03 | Already real-time 3D, elevated orthographic rig with roof hiding and wall cutaway, built-in multiplayer, GLB import. The browser build would need a renderer first. | Only if the developers' machines cannot run the Godot editor (test: open the project, press F5). |
| P2 | Godot 4.7.2-stable (was 4.3-stable, 2026-11-03) | **CONFIRMED** (owner, 2026-11-04: "you can do it for me"; 2026-11-05: "fix both") | 2026-11-04 | 4.7.2 was the current stable release. On it, with no code changes, every check passes: compile-check, the 274-check suite (twice), the four environment-kit collision suites, the live boot, the loopback test (65), all five exports, the loopback test on the exported binaries (65) and the web build in Chromium. Bone poses sampled from the same clips match 4.3 exactly, and a frozen pose renders the same on both engines and both renderers. The project can no longer be opened in 4.3: both developers move together. | A blocking engine bug, or the next stable release, recorded here first. |
| P3 | Target platforms | PROPOSED desktop first (Windows/Linux/macOS exports); browser export as a later option | 2026-11-03 | Brief §48. The owner's Chromebook is unmeasured. | The F5 test above, and the first exported build. |
| P17 | Playtest distribution | **CONFIRMED** (owner, 2026-11-03: "yes set it up"): every merge to `main` publishes a browser build of the single-player prototype to GitHub Pages and replaces the desktop zips on the rolling `playtest` pre-release; pull requests get the zips as a workflow artifact. Browser multiplayer is not included: the courtyard uses ENet (UDP), which browsers cannot open; it needs a WebSocket transport and a publicly hosted `wss://` server (P4). | 2026-11-03 | Easier testing per update, no Linux setup needed on the Chromebook for the single-player build. Pages is free because the repository is public. | A decision on server hosting (P4), which is what browser multiplayer waits on. |
| P4 | Online session model | OPEN. **TEMPORARY A1**: one player's game is also the server ("listen server"); the other joins by IP over Godot's ENet. | 2026-11-03 | Fastest route to a two-player test with no services. Changing to dedicated servers needs only the already-separate server role; a relay or NAT traversal needs a decision on hosting. | The owners' answer to the online-model question. |
| P5 | Player count | **CONFIRMED direction** (owner, 2026-11-03): multiplayer stays small, friends-scale. Exact number OPEN. Spike server default: 2 (`--max-players` dev setting). | 2026-11-03 | Brief §7: two is the test, not the limit. Rules out MMO-scale design (brief §25). | Measured server and network cost with two, then a number. |
| P6 | PvP | OPEN. **TEMPORARY A2**: none. | 2026-11-03 | Affects hit validation and death rules, not transport. | The owners' answer. |
| P7 | Persistence | **TEMPORARY A4, built in Milestone 3**: one versioned JSON file on the server (`--save`, default `user://ashen_world.json`), schema 1, written by `NetSave`: atomic write (temp file, verify, back up the previous save, rename), after any durable change at most once a second, live positions every 30 s, and on clean shutdown. Load policy: newer schema refused and never overwritten (exit 4); unusable primary falls back to the backup and the bad file is kept aside; both unusable refuses to start (exit 3) unless `--reset-world`, which keeps them aside. | 2026-11-03 | One courtyard does not justify a database (brief §18); the rules are the browser build's tested ones. A save is about 2 KB. | Save size or write time measured as a problem, or a dedicated server that runs for weeks. |
| P8 | Camera | PROPOSED → built in M1a: elevated orthographic, pitch fixed at −30°, four quarter-turn views eased over 0.35 s, wheel zoom between fixed limits, C recenters, per client. No pan yet. | 2026-11-03 | Brief §5: controlled first, free rotation only if it reads. | Playtest of the four views in a real interior (appendix §84). |
| P9 | Movement controls | PROPOSED → built in M1a: camera-relative intent resolved on the client, basis frozen while a key is held (a mid-walk turn does not swerve you), server integrates at 60 Hz, immediate velocity, 3.2 m/s, no acceleration. | 2026-11-03 | Appendix §77. | Feel in the first human playtest. |
| P10 | Network rates | **TEMPORARY A3**: input up to 60/s unreliable-ordered; state 30/s unreliable-ordered; join, spawn, leave reliable. | 2026-11-03 | Constants in `net_protocol.gd`. | Latency and loss tests (Milestone 1b). |
| P11 | Inventory capacity model | **CONFIRMED** (owner, 2026-11-03): weight only. Built in M1b: the server holds an `Inventory` per player, `PACK_CAPACITY_KG` = 12 with the existing 1.5× hard limit (encumbrance above capacity, refusal above the hard limit). | 2026-11-03 | Supplement §36: one model, explicit buttons. Reuses the single-player classes unchanged. | Playtest: does 12 kg produce the carrying decision the brief wants? |
| P12 | Death and recovery | OPEN | | Supplement §42. Not needed before Milestone 4. | Before Milestone 4. |
| P13 | Asset pipeline | **IN USE** (owner, 2026-11-04): the owner's environment kit ENV-001 to ENV-010 is generated as GLBs by Python scripts (`tools/generate_env*.py`, NumPy/SciPy) into `assets/environment/envNNN/`, each set with a README and, from ENV-006, collision scenes and a Godot collision suite. Merged in PR #14; the owner says the pieces will need more work later. The earlier proposal (Blender → GLB → `res://art/exports/`) is superseded for now. | 2026-11-04 | Brief §12–§14, appendix §82. | Rework of the kit, or a Blender pipeline for hero assets. |
| P15 | Placeholder survivor | **CONFIRMED** (owner, 2026-11-03): the KayKit Adventurers pack (CC0) may be the rigged, animated placeholder character for Milestones 1–4, **on the condition that it can be replaced later**. Kept replaceable by design: the avatar's presentation is its own node (`NetPlayerView`), separate from identity, state and simulation (appendix §71), and the simulation drives a capsule footprint, not the mesh. **Built in LF-1** (single-player prototype) with KayKit's Rogue_Hooded; the owner then judged it "does not fit the grim world at all", so **LF-1b** replaced it with Quaternius's Ranger (Modular Character Outfits, CC0) on the Universal Animation Libraries 1 and 2 (CC0): adult proportions, recoloured dark and dirty. The swap touched only `SurvivorModel` and the clip names, which is the replaceability this decision asked for. Stylised, cartoon-proportioned kits (KayKit, Kenney) are now ruled out for the look. The courtyard's `NetPlayerView` still uses a capsule (multiplayer deferred by the owner). The owner accepted the Ranger "for now" (2026-11-04) and may later commission or buy more realistic characters, or ask for help making them; any character on a standard humanoid rig can take the current animations. | 2026-11-03 | Brief §15 wants a coherent rigged source early and no weeks of art before the loop works. The licence file inside the download must still be read before anything is committed (brief §59). | The first own character mesh, or the art-direction slice (Milestone 5). |
| P16 | CC0 environment kits | **CONFIRMED** (owner, 2026-11-03): CC0 kits (Quaternius, Kenney, KayKit) may be used for blockout, scale reference and placeholder props only; the final look comes from the team's own modules and material pass, replacing kit pieces over time. | 2026-11-03 | Brief §59: the visual direction must become recognisably ours; §3: crude and weather-beaten, which the clean kits are not. | Each module of the 20-piece test kit replaces its kit stand-in as it is approved (appendix §82). |
| P14 | Superseded earlier decisions | Random world per expedition, browser-only delivery (old D42), and the generated 48×48 Blackfen before a small location: all superseded by the briefs and the owner's decisions. The procedural generator remains in the browser repo as reference. | 2026-11-03 | Brief §11, §25. | A demonstrated need for a larger world after the vertical slice. |

### Temporary rules in the code

| Rule | What it does | Why | Consequence of changing |
|---|---|---|---|
| R1 disconnect | On disconnect the avatar is removed at once; the server keeps the player's record (position, facing, colour) in memory; a rejoin with the same player key spawns there. | Brief §62 criterion 8 needs an explicit rule; this one is the least surprising for a two-player test. | A "body stays for N seconds" rule changes `_on_peer_disconnected` only. Records are in memory: a server restart loses them until Milestone 3's saves. |
| R2 identity | `--player-key` (a string the developer chooses) is the persistent player identity; the ENet connection id is only the connection. | Appendix §45, §72: never key ownership on a connection id. | This is a development mechanism, not authentication. Any real identity scheme replaces the key's source, not its role. |
| R3 request ids | A client numbers its requests from 1 per connection. The server remembers the last 64 answers per connection and answers a repeated id identically without acting again. The memory is dropped on disconnect, so a rejoin starts at 1 again. | Appendix §74: duplicate-request policy with a stated scope. | Reconnect-safe idempotency (surviving a disconnect) would need request ids keyed by player identity and persisted; not needed while the only transfer is a take from a container. |
| R4 pack on disconnect | The pack is stored in the player's record with position and facing, and restored on rejoin; since Milestone 3 the record is saved, so it also survives a server restart. | Brief §17: disconnect must not create unexplained ownership. | — |
| R5 fixture cost | A fixture (breach, hearth) is used by one player, who pays the whole cost from their own pack. | The simplest shared rule; both players see the result. | Pooling materials from two packs is a later option if playtests want it. |
| R6 instant actions | Repair and lighting happen at once; no timer, no interruption. | Supplement §34 leaves timed actions open. | A timer (and interruption by damage) when Milestone 4 adds danger. |
| R7 crash window | A server killed outright loses at most the last second of changes (the save debounce) and up to 30 s of walking. | The debounce keeps writes rare; positions matter least. | A playtest that loses something that mattered. |

## Identifiers (appendix §72)

| Identifier | Example | Survives disconnect | Survives server restart | Notes |
|---|---|---|---|---|
| Connection id | `442489596` | no | no | ENet peer id; the server is always 1. |
| Player key (identity) | `alice` | yes | yes (once saved) | Dev-chosen string, R2. |
| Avatar node | `/root/NetMain/Players/<connection id>` | no | no | Presentation and simulation handle; never persisted. |
| World object id | `courtyard/supply-crate` | yes | yes (authored) | Hand-assigned in `net_courtyard.gd`; a copied scene never inherits one (appendix §52). |
| Stack id | `3` | yes, while anything is left of the stack | no | Server-assigned per container; names exactly the stack a client saw. Packs have none yet. |
| Item definition id | `timber` | yes | yes | `ItemDatabase`, one shared `ItemData` per id. No item instance ids yet: no mechanic needs them (supplement §35). |
| Request id | `7` | no (rule R3) | no | Per connection, client-numbered. |
| Fixture id | `courtyard/breach`, `courtyard/hearth` | yes | yes (authored; state saved) | Hand-assigned in `net_courtyard.gd`. |
| World id | `0c39e843-6ae95265` | yes | yes (saved) | Generated when a new world is created; a restored save keeps it. |
| Player key in a save | `alpha` | yes | yes | Rule R2; the save maps each key to its position, facing, colour and pack (appendix §87, player identity mapping). |

## Network operation contracts (appendix §73) — Milestone 1a

All RPCs live on `/root/NetMain` (`scripts/net/net_main.gd`), so no message can address a node the
receiver has not created. The server derives the acting player from the sender id, never from the
payload (§74).

| Operation | Sender → receiver | Transport | Fields | Server validation | Success | Rejection |
|---|---|---|---|---|---|---|
| `hello` | client → server | reliable | protocol version, player key | version equals `PROTOCOL_VERSION`; live players < max; key well-formed (1–64 chars, identifier or `-`); key not already live | `welcome` to the newcomer (own connection id, existing players, server build), then `spawn_player` to everyone | `rejected(reason)` then the server disconnects the peer after 0.25 s. Reasons: `PROTOCOL_MISMATCH`, `SERVER_FULL`, `BAD_KEY`, `KEY_IN_USE`. A peer that sends no `hello` within 3 s is dropped (`HELLO_TIMEOUT`). |
| `welcome` | server → one client | reliable | assigned id, existing players `[id, key, position, yaw, colour]`, build id | — | client spawns the others, waits for its own `spawn_player` before play | — |
| `spawn_player` / `despawn_player` | server → all | reliable | id, key, position, yaw, colour / id | — | avatar created / removed on every client; the owner's camera attaches on spawn | — |
| `submit_input` | client → server | unreliable ordered | sequence number, world-space direction | sender has a live avatar; components finite; no vertical part; length ≤ 1; sequence newer than the last; ≤ 200 per second | stored as that avatar's intent until replaced, or zeroed after 0.25 s without input (lost packet) | counted, never answered: `NO_PLAYER`, `BAD_INPUT`, `RATE_LIMIT`; stale sequences ignored |
| `player_state` | server → live clients | unreliable ordered, 30 Hz | id, position, yaw, last accepted sequence | — | remote avatars ease toward it; the owner corrects its prediction (snap above 1 m, else 30 % per packet) | — |
| leave | — | — | — | ENet disconnect | rules R1, R4 | — |
| `request_container_contents` | client → server | reliable | request id, object id | sender has a live avatar; ≤ 20 requests/s; repeat id → first answer again; object id well-formed; object exists; survivor within 2.5 m on the ground plane | `request_result(id, ok)` then `container_contents(object, version, stacks)` to the requester | `request_result(id, false, code)`: `NOT_READY`, `RATE_LIMITED`, `INVALID_REQUEST`, `OBJECT_UNAVAILABLE`, `OUT_OF_RANGE` |
| `request_take_item` | client → server | reliable | request id, object id, stack id, quantity | as above, plus: stack id ≥ 1, 1 ≤ quantity ≤ 999, stack still exists with at least that quantity, the portion fits under the pack's hard limit | removes the portion from the container, adds it to the requester's server-side pack, bumps the container version; `request_result(id, true, {item, quantity, pack_weight})` to the requester; `container_contents` to **every** live client; `pack_state` to the requester | nothing changes; `request_result` with `STATE_CHANGED` (someone was first, or the view was stale), `CAPACITY_EXCEEDED`, or the codes above; on `STATE_CHANGED`, `CAPACITY_EXCEEDED` and `OUT_OF_RANGE` the requester also gets a fresh `container_contents` |
| `request_store_item` | client → server | reliable | request id, object id, item id, quantity | as for take, plus: item id is a defined item, the pack holds at least that quantity, the portion fits the container | pulls the quantity from the pack's own stacks in order (each portion keeps its condition), merges stackables into an existing crate stack or opens a new stack id, bumps the version; same answers and pushes as a successful take | `STATE_CHANGED` (the pack no longer holds it), `CAPACITY_EXCEEDED`, or the codes above |
| `container_contents` | server → client(s) | reliable | object id, version, `[[stack id, item id, quantity, condition], …]` | — | the client replaces its view; the loot window redraws | — |
| `request_use_fixture` | client → server | reliable | request id, object id | sender live; ≤ 20/s; repeat id → first answer; object id well-formed; fixture exists; within 2.5 m; not already done (`STATE_CHANGED`); the pack holds the fixture's own cost (`INSUFFICIENT_RESOURCES`; the cost is never taken from the request) | consumes the cost from the requester's pack, marks the fixture done by that player, `fixture_state` to every live client, `pack_state` to the requester, save within a second | nothing changes; `request_result` with the code |
| `fixture_state` | server → client(s) | reliable | object id, done, done by | — | on join (initial sync, before spawn) and after every change; the client toggles the barricade (and its collision) or the fire and light | — |
| `pack_state` | server → owner only | reliable | stacks, weight, capacity, hard limit | — | private player data (§71); sent on join and after every change | — |

Durable state and presentation are already distinct (appendix §75): positions and the player table
are durable, the turn animation and HUD messages are local.

## Lore 1 — the world bible in the game: evidence (brief §24)

**What.** The first slice of `docs/worldbuilding/` (merged in PR #27) that a player meets, built from
`items-and-texts.md` and nothing invented here:
- **Item lore.** Every item carries a line from the bible; its tooltip now gives what it does (the
  old description, unchanged) and then where it came from. Mechanics text is kept on purpose.
- **Eighteen notes.** Each is a `Category.NOTE` item (0.02 kg, unequippable) in the container the
  bible put it in: three in the Shelter Stash, three in the Watchhouse chest, two in the grain crate,
  three in the ork plunder pile, two in the bone heap, two on the spore cart; three lie on the ground
  (the quarry's south edge, the feeding ground's near pillar, the choke-point wall). **Read** from
  the loot window or the pack opens a reading panel beside them.
- **Discovery banners.** The first time the survivor reaches seven places, opens the stash, takes the
  salt, the pot, the kettle hat or the hauberk, reads a warning-book page or lights a torch, a line
  from the bible shows. A discovery waits for the HUD to be free, so it never covers a warning.
- **One source.** `tools/generate_lore_texts.py` writes `scripts/data/lore_texts.gd` from the bible
  and fails on non-ASCII text (the browser build has no system fonts).

**Tests (run in this container).** `tests/smoke_test.gd`: 503 passed, 0 failures, twice (17 new:
every item has lore; the tooltip keeps both parts; eighteen notes, each light, readable and plain
ASCII; a container gets its notes after its own goods; every note's place is in the level; the
ground notes lie where the bible put them; reading opens the panel, captures input, shows the title
and the whole text, is announced once, refuses a non-note and closes with the windows; a place is
noticed once and its banner waits behind one already showing; taking the pot and reading a page are
discoveries, taking timber is not). Kit suites, live boot and `tools/net_spike.py` (65) clean. A new
README screenshot, `16_reading_a_note.png`; `04_pack_and_loot.png` re-rendered because the chest now
lists its notes. The screenshot tool disables discovery so banners stay out of the other shots.

**Not covered by headless tests.** Whether the notes are read or skipped, whether the reading panel's
size and the 14 px text suit a real screen, and whether the discovery banners feel like a voice of
the place or like interruptions. The placement circles are first guesses at each area's edge.

## Bestiary 4 — the Gallery Dragger: evidence (brief §24)

**What.** The owner chose "more bestiary" (2026-11-05) after Bestiary 3. No bestiary list exists in
either repository, so the creature comes from the one beast the worldbuilding describes: the thing in
the Roofed Mile story (grim-dark-ashen-wilds-, docs/worldbuilding/roofed-mile-third-arch.md; the Bell
Road's Roofed Mile is "an old avalanche gallery with carcasses dragged between its supports",
blackfen-roads-and-towns.md). The worldbuilding index says that beast is "unidentified, not a
confirmed bestiary species": the Gallery Dragger is this project's proposal for it, and its name is
ours. Everything it does is taken from the story:
- **It drops from above** ("in the narrow space where the roof met the hillside, a pale shape
  shifted ... The thing dropped where he had been standing"). It waits on top of the Roofed
  Gallery's hillside wall (south-west corner, new) and comes down on a survivor who passes beneath
  and whom it can see over the lip; an orange ring marks the spot 0.7 s ahead (drop 26, heavy).
- **It does not rush; it moves sideways round cover** ("It did not rush him. It lowered its head
  and moved sideways until the cart no longer stood between them"). With stone between them it
  sidles; it lunges and bites only down a clear line (bite 20, bleeds). Piers and the tipped
  handcart in the passage are cover, as the pier and the cart were in the story.
- **It worries what it bites** ("It snapped at the wheel, caught the wooden rim, and shook it hard
  enough to wrench the handles from Pell's hands"). A bite caught on a shield clamps on: holding the
  guard costs 40 stamina a second, and run dry, the shield is torn away and thrown down. Its head
  is pinned there: a blow on it lands x1.5 and breaks its grip.
- **It turns to a sound** ("She struck the pier three times. The animal turned toward the sound"):
  it hears by the troll's table (now a static `EnemyQuarryTroll.survivor_noise_radius()`) at 0.8.
- **Fire keeps it off** (the oil fire at the end): a lit torch held toward it within 4.2 m, longer
  than its lunge, and it circles for a way round the flame instead of coming in.
- It climbs back to its ledge when it has lost the survivor. F9 teleports to the gallery.
- The passage between wall and piers is 3 m wide, so the existing cramped rule applies there: sword
  sweeps clang off the stone (the HUD says so), and a fight in the gallery wants thrusts.
- Not built: the lime that drove it off coughing, its dragging of carcasses, and rearing to reach a
  climber. Proposed next, with the companion's view of it.
- The body is the Ashbound stand-in, crouched and pale (no four-legged rig or clips exist in the
  libraries); the drop, the landing and the climb use `NinjaJump_*` and `ClimbUp_1m`.

**A test moved, honestly.** The troll's hearing tests listened from OGRE_YARD westward; the new
gallery's wall now stands there and muffled the 16 m clang. They listen eastward now, across open
ground; the troll is unchanged. The first test run also showed two real faults, fixed before
committing: the floor counted as a wall and ended every lunge at once, and the torch held it at a
distance its lunge could still cross.

**Tests (run in this container, Godot 4.7.2).** `tests/smoke_test.gd`: 486 passed, 0 failures, twice
(31 new: the level's Dragger on its ledge and the gallery's containers; unnoticed beyond the piers;
the ring under the ledge; the drop's damage and stagger; stepping out of the ring; sidling round a
pier and not lunging through it; the bite in the open; the worry costing stamina, the shield torn
away and thrown down, and the blow that breaks its grip; the torch keeping it off and not when turned
away; its hearing reach; climbing back; standing down; the carcass; the model, clip and facing
checks every enemy gets). Kit suites, live boot and `tools/net_spike.py` clean. A new README
screenshot of the drop (the other shots are still the 4.3 renders).

**Not covered by headless tests.** Whether the 0.7 s ring is enough to step out of on a real
screen, whether the worry reads (the banner explains it once), whether circling at 3.8 m round a
torch feels like a beast or a bug, and how dark the gallery is at default brightness.

## Engine upgrade — Godot 4.3-stable to 4.7.2-stable: evidence (decision P2)

**Why.** The owner asked for it (2026-11-04) after a trial on a copy of the repository showed it
cost nothing. 4.7.2-stable was the current release (18 August 2026); staying on 4.3 meant every
later engine fix was four minor versions away.

**What changed.** The version string everywhere it is pinned: `project.godot`
(`config/features` 4.7), the five workflows (`checks.yml`, `publish.yml`, `validate-env008.yml`,
`validate-env009.yml`, `build-environment-assets.yml`), `tools/get_export_templates.sh`,
`tools/export_builds.sh`, `tools/net_spike.py`, and the docs. The 4.7 importer writes a `.uid`
file beside every script and shader (committed; Godot 4.4+ needs them in version control), and
adds its new default keys to the art's `.import` files (additions only; no existing setting
changed). One constant changed: `VisionConeOverlay.COMPATIBILITY_OUTPUT_GAMMA`, 0.6 to 0.9 (below).

**Measured on 4.7.2** (2026-11-05, this branch, merged with `main` at `dc031ea`):

| Check | Result |
|---|---|
| Import and compile-check every script | clean, no errors or warnings |
| `tests/smoke_test.gd` | 434 passed, 0 failures, twice |
| Environment kit collision suites ENV-006 to ENV-009 | 1082 / 837 / 78 / 78 checks, 0 failures |
| Live boot, 1200 frames | nothing after the usual filter |
| `tools/net_spike.py` | 65 passed, 0 failed |
| `tools/export_builds.sh` | all five builds; web pack 25.2 MB (the live 4.3 one is 26.0 MB) |
| `tools/net_spike.py --exported builds` | 65 passed, 0 failed |
| Web build in headless Chromium (SwiftShader WebGL 2) | runs, no console errors; the cone's charcoal fixed (below) |

The art was checked directly, because the headless suite cannot see a pose. The same clips
(`Idle`, `Sword_Idle`, `Idle_Shield`) sampled at the same time give the same bone rotations and
positions on 4.3 and 4.7.2, to the printed precision, and the live game plays the same clips frame
for frame on both. A frozen `Sword_Idle` pose renders identically on 4.3 and 4.7.2 under Forward+
and under Compatibility. The eleven README shots re-rendered on 4.7.2 (Forward+) differ from the 4.3 ones by 0.5 to 2.2
out of 255 on average, the vision cone and the start screen included; characters are caught at
slightly different moments of their animations, so the committed shots were kept.

**The browser build: one real regression, fixed; one false alarm.** Compared with the live 4.3
Pages build of the same `main`, by the same script in headless Chromium (SwiftShader), 30 and
120 s after pressing Enter on the start screen:
- *The vision cone's charcoal came out a washed-out light grey.* Real. 4.7.2's Compatibility
  renderer now encodes this material's output itself, so the lift 4.3 needed (`output_gamma` 0.6)
  is applied twice. Measured on the desktop Compatibility renderer, the ground outside the cone
  against the same ground with the overlay hidden: 4.3 at 0.6, 41%; 4.7.2 at 0.6, 98%; at 1.0, 28%;
  at 0.9, 41%. `COMPATIBILITY_OUTPUT_GAMMA` is now 0.9, and the browser shows the same charcoal as
  4.3's. Forward+ is unchanged (1.0). The depth convention did not change: `reverse_z` off is still
  right for Compatibility.
- *The survivor stood in a T-pose.* Not the engine. Every web build exported from the working
  checkout that had been through this session's imports and merge showed it; every build made the
  way CI makes it (a clean copy of the commit, imported once, `tools/export_builds.sh`) animates
  normally. The imported character scenes in that checkout's `.godot` cache differed in size from a
  clean import of the same files. Bone poses and the skeleton's per-frame skin updates were right in
  both. If a local web build ever shows a T-pose, delete `.godot/` and export again.
- Under SwiftShader the browser build runs at about one frame a second on both engines, so judge
  nothing about speed from it.

**Not covered.** Feel, input timing, light levels on a real GPU, real audio, and the web build's
load time on a real browser and GPU (the SwiftShader slowdown above may be SwiftShader alone).
The second developer needs 4.7.2 too: a project opened in 4.7 is converted and cannot go back.

## Bestiary 3 — the Unnamed: evidence (brief §24)

**What.** From the worldbuilding's faith, not its monsters (it names none): the Keeping teaches
that "dead people are named", and a proposed custom is to "speak a corpse's name into its mouth"
(grim-dark-ashen-wilds-, docs/worldbuilding/keeping-and-merewick.md). The Unnamed are the drowned
dead of a burial ground in the yard's empty south-east corner, put down in the Smothering without
their names, and they get up:
- **They rise again.** At 0 health an Unnamed falls (walkable over, unhittable, no corpse) and 12 s
  later rises whole (the `LayToIdle` clip). It stays down only when its name is spoken at its own
  grave: each has a worn stone with an [E] "Speak a name" prompt, a 2.5 s channel that a blow
  breaks off. Naming works whether it is down or standing, so a careful survivor can creep to a
  stone unseen. Then it lies down for good and leaves a body to search.
- 45 health, slow (2.6 m/s), sees 10 m in a 130 degree cone, hears a sprint or a swing at 10 m,
  a grab for 14. Tied to its grave: it turns back past 14 m. F8 teleports to the graves.
- The fight is a puzzle of attention: three of them, three stones; down one, then race to its
  stone before it rises, with the other two on you. The companion holding them helps.

**A slip on the way, owned.** Merging PR #24 failed once because the call carried a full commit
hash filled in from the short one rather than read from the PR; it was read and the merge retried.

**Tests (run in this container).** `tests/smoke_test.gd`: 455 passed, 0 failures, twice (21 new:
three Unnamed bound to three graves; the grave's prompt; falling and not leaving a corpse; rising
whole with the rise clip and standing hittable; naming a fallen one through the survivor's own
channel laying it to rest, the prompt gone, a body to search, no rising again; naming a standing
one; its cone; its grab; a blow breaking off the naming; the leash; standing down; and the model,
clip and facing checks every enemy gets). Kit suites, live boot and `tools/net_spike.py` clean.
A new README screenshot of a naming at a grave.
After `main` moved to Godot 4.7.2 (PR #21) this branch was merged with it and everything above
re-run on 4.7.2-stable from a clean `.godot`: compile check clean, 455 passed twice, kit suites,
live boot and `tools/net_spike.py` (65) clean. The new script's `.uid` is committed. The README
shots stay the 4.3 renders, as the upgrade kept its own (4.7.2 differs by 1 to 2 of 255).

**Not covered by headless tests.** Whether "find its grave" is clear from the banner alone (the
first rise says so), whether 12 s is long enough to reach a stone with two more coming, and
whether the stones read as graves (a ruin-pillar stump, scaled down).

## Bestiary 2 — Ash-Spore Husks: evidence (brief §24)

**What.** No bestiary list exists in either repository; the README's history says the
Deep-Seam Vaults released "ash-spores, goblin hordes, ork war-clans". This slice makes the spores
a creature and a hazard, built to use what the game already has (the torch, the weather, the
vision cone):
- **Ash-Spore Husks**, the Ashbound's dead colonised by spores. 55 health, slow (1.9 m/s, under a
  walk), half-blind (8 m, a 120 degree cone, cut by walls), hears a sprint or a swing at 8 m
  (times the survivor's noise multiplier). A claw: 16 damage and 2 s of choking. Three stand in
  the Spore Hollow on the west edge, round a cart that holds a full torch.
- **Spore clouds.** Every wound puffs a small one (1.2 m, 3 s); death bursts a large one where the
  husk stood (2.4 m, 8 s), so a husk cut down at arm's length leaves the survivor inside it. In a
  cloud the survivor **chokes**: 3 health a second (never below 1, like bleeding), stamina
  regeneration x0.25, and sight cut to 35% (8.4 m in ashfall, 2.5 m in the miasma).
- **Fire burns spores.** A lit torch within 2 m of a cloud's edge burns it ten times faster (about
  a second): the first real reason to carry the torch instead of the shield in the open.
- **The weather sets how long a cloud hangs**, a new "spores" field in every profile: ashfall
  x1.0, miasma x1.3, sleet x0.6, cinder-squall x0.4, hoarfrost x0.9, Dead Calm x1.6.
- Enemies and the companion breathe it without harm. F7 teleports to the hollow.

**Tests (run in this container).** `tests/smoke_test.gd`: 434 passed, 0 failures, twice (23 new:
the three husks and the cart's torch; choking's health drain, HUD flag, lost sight and stamina
regeneration against clear air; that it stops; that it never kills; a lit torch burning a cloud
and an unlit one leaving it; the Dead Calm and cinder-squall cloud lives; the husk's cone and its
speed; its claw's damage and choking; the wound's puff; the death burst where it stood, around a
survivor at arm's length; standing down; and the model, clip and facing checks every enemy gets).
Kit suites, live boot and `tools/net_spike.py` clean. A new README screenshot of the hollow.

**Not covered by headless tests.** Whether the cloud reads as dangerous at a glance (a pale,
translucent dome), whether 3 health a second is a threat or a nuisance, and whether players find
the torch answer without being told (the F7 banner says "Fire burns spores").

## Bestiary 1 — the Blind Quarry-Troll: evidence (brief §24)

**What.** The roadmap's "the Blind Quarry-Troll", built from its name and what the game already
had: the noise systems. It lives in an old quarry dressed in the yard's empty north-east corner
(an outcrop and standing stones at the back, masonry chips and rubble across the floor), 2.6 m
tall, 360 health, 130 poise. It never looks:
- **Hearing only.** Every action the survivor takes has a reach in metres (walk 6, sprint 14,
  swing 12, dodge 9, a shield taking a blow 10, a sword clanging off stone 16, rummaging 5),
  multiplied by the survivor's noise multiplier, so load, weather, background and armour all
  reach it, and muffled to 55% through stone. Standing still, blocking still, and the quiet parts
  of a channel make no sound it can hear. It hears the companion too (her cudgel 10 m, running 7).
- **It strikes where the sound was.** It lumbers (2.7 m/s) to the heard spot and, within 2.4 m,
  brings both fists down on it: a ring on the ground marks the spot for 1.1 s, then 55 damage
  (heavy) to anything within 1.8 m of it, the survivor or the companion. Creep out of the ring
  and it pounds empty ground. It then stands listening (2.6 s).
- **Hit it and it knows.** A blow tells it where its attacker stands, and from close by it
  thrashes round itself (30 damage within 2.8 m, 3 s cooldown). Its poise breaks on 130.
- Forgets a sound after 6 s, walks home when it has strayed; stands down on the survivor's
  death; takes and releases the attack turn like the ogre's committed blows. F6 teleports there.
- Interactions that come free: the Dead Calm makes it deadly, a cinder-squall makes it deaf, a
  gutter-kin can sprint past at 10 m, mail clinks bring it from 7.5 m, Edda's cudgel draws it.

**Tests (run in this container).** `tests/smoke_test.gd`: 411 passed, 0 failures, twice (25 new:
its home; its temperament; still and blocking are silent; walk, sprint and clang reaches;
hearing sends it to the spot; the Dead Calm, the cinder-squall, the gutter-kin and the hauberk;
stone muffling; the pound landing on a survivor who stayed; the ring marking the heard spot and
missing a survivor who crept away; never finding a survivor still at 2 m; the thrash on being hit
and its damage; hearing the companion; standing down on death; walking home; and the model,
clip and facing checks every enemy gets). Kit suites, live boot and `tools/net_spike.py` clean.
A new README screenshot of a pound on an empty spot.

**Not covered by headless tests.** Whether "keep still" reads without a tutorial (the first
time it hears you a banner says it is blind), whether 6 m for walking makes the quarry too tense
to cross or too easy, and whether its slow lumber is threatening or comic.

## Companions 1 — Edda: evidence (brief §24)

**What.** The roadmap's "companions", built on Fable (CLAUDE.md flags companion AI as
design-heavy) from that one word and the worldbuilding's people. One companion for now, Edda, a
survivor the Ashbound left bound in the Watchhouse's south-east corner (a hooded figure sitting
against the wall). Cutting her free is an `ActionPoint`, a Lootable whose timed [E] action runs a
Callable instead of opening a loot window; the same thing is the "Lift" prompt at her body when
she is down. The design, chosen to stay readable and honest about what the yard has:
- **Follow / hold / fight.** She keeps 2.2 to 3.4 m behind the survivor (walks, runs past 7 m),
  fights the nearest living enemy within 6 m of herself and 8 m of the survivor (4 m of a held
  spot), and F toggles holding where she stands. A cudgel: 14 damage, 12 poise, 0.45 s startup,
  0.8 s recovery. 70 health, 30 poise, no pack, no stamina.
- **Enemies don't hunt her, but hit her.** Every enemy's senses are for the survivor; changing all
  three AIs to pick targets was out of scope and would have made the companion a decoy. Instead
  her hurtbox is on the survivor's hurtbox layer, so any blow, sweep, slam or stone that passes
  through her lands on her. Her cudgel can only touch enemy hurtboxes.
- **Downed, not dead.** At 0 health she goes down for 25 s; the survivor lifts her (3 s) with a
  clean rag, at 40% health. Past 25 s she dies and leaves "Edda's body" to search (a rag).
- **No pathfinding yet.** Enemies steer straight too. When she is further than 14 m behind for
  4 s she rejoins a pace and a half behind the survivor; the notes say so plainly.
- The HUD shows an ALLY bar with her name and state; she is always drawn (the vision cone hides
  enemies, not friends).

**A rule learned.** A process-disabled CollisionObject leaves physics (`disable_mode` REMOVE), so
a frozen enemy can neither be hit nor hit: the companion skips targets that cannot process (the
suite freezes the level's enemies), and the tests that want her to fight or be hit keep their
enemies live and blind (`player_ref` null) instead of frozen.

**Tests (run in this container).** `tests/smoke_test.gd`: 386 passed, 0 failures, twice (19 new:
the captive and its prompt; no companion and no ALLY line at first; cutting free through the
survivor's own channel; follow by default and the HUD line; closing to a few paces; the rejoin;
holding; cudgelling a goblin and never the survivor; an ork's slash landing on her; down, not
dead, with the Lift prompt and the HUD's DOWNED; no rag, no lift; a rag lifts her at 40% and is
used up; dying after too long, the body, the HUD's dead). Kit suites, live boot and
`tools/net_spike.py` clean. A new README screenshot of her at the survivor's back.

**Not covered by headless tests.** Whether she gets in the way in the entry hall (she will stand
in the doorway sometimes), whether enemies' blows land on her too often or too rarely to feel
right, and whether a silent follower reads as a person. She has no lines beyond the one when freed.

## Armour 1 — three slots, six pieces: evidence (brief §24)

**What.** The roadmap's "armor slots". Three slots (head, body, legs) and six grounded pieces, all
data in `ItemDatabase`:

| | Slot | kg | Soak | Poise | Bleed guard | Noise | Don | Where |
|---|---|---|---|---|---|---|---|---|
| Padded Coif | head | 0.6 | 2 | 3 | – | – | 1.0 s | shelter stash |
| Kettle Hat | head | 1.4 | 4 | 5 | – | x1.05 | 1.5 s | ogre's bone heap |
| Quilted Gambeson | body | 3.2 | 5 | 6 | 50% | – | 2.5 s | Watchhouse chest; the carter wears one |
| Rusted Mail Hauberk | body | 8.5 | 10 | 10 | 80% | x1.25 | 4.0 s | ork plunder pile |
| Leather Greaves | legs | 1.2 | 2 | 2 | – | – | 1.5 s | grain crate |
| Splinted Greaves | legs | 3.0 | 5 | 4 | – | x1.1 | 2.0 s | 30% of ork corpses |

The rules, chosen to stay readable: every blow loses the worn soak (heavy blows count it at 60%)
and always does at least 30%; every worn piece wears 1 per blow taken (2 for heavy), a ruined
piece soaks half and gives no poise; cloth and mail turn bleeding cuts by their combined chance;
poise adds to the survivor's, and a heavy blow staggers outright only when the bonus is under
half the blow's poise, so the full set (19) takes an ork's chop (38) once, and nothing takes an
ogre's slam (85); mail clinks (own noise); weight goes through the pack, so the hauberk alone is
nearly half the deserter's capacity. Donning takes the piece's own time through the pack window.
No armour is drawn on the body yet (the Quaternius outfit is one mesh); the HUD's WORN line and
the pack window's [BODY] tags say what is on.

**Tests (run in this container).** `tests/smoke_test.gd`: 367 passed, 0 failures, twice (25 new:
the six pieces; slots and replacement; weight; soak on a light, a heavy and a small blow; the
floor; wear; coif and hauberk staggering under a chop and the full set not; bleed guard whole and
ruined; the HUD line; donning and doffing times; the stash's coif; the carter's gambeson). Kit
suites, live boot and `tools/net_spike.py` clean. The pack-window screenshot now shows a worn coif.

**Not covered by headless tests.** Whether 8.5 kg of mail is the right trade for soak 10 (it
pushes a deserter to burdened with little else), whether four seconds to don it is tense or
tedious, and the want of a visible helmet.

## Backgrounds 1 — who were you, before the Smothering: evidence (brief §24)

**What.** The roadmap line "eight starting characters with gear, traits and permanent flaws",
built on Fable from that line and the worldbuilding's people (road carriers of the Cinder Factors,
chapel cleaners, hedge-priests, Watch deserters, the Gutter-kin, fen healers, carters). A start
screen over the paused yard offers eight cards; arrows or 1 to 8 choose, Enter, Space or E begin,
or click a card twice. Each background is a kit, one trait and one flaw, all numbers:

| | Kit | Trait | Flaw |
|---|---|---|---|
| Watch Deserter (default) | sword 88%, targe, torch 180 s, 2 bandages | blocks cost x0.75 | 90 health |
| Cinder Factor | spear, torch 240 s, 2 bandages | 26 kg; load noise x0.9 | sprint x0.85; dodge 30 |
| Chapel Cleaner | targe, torch 300 s, 4 bandages, no weapon | searches x0.65; steps x0.8 | attacks cost x1.3; wear x2 |
| Peat-cutter | broadaxe, torch 150 s, 1 bandage | 23 kg; heavy damage x1.15 | 80 stamina; regen x0.9 |
| Gutter-kin | sword 55%, torch 90 s, 2 bandages | steps x0.65; dodge 16; sight x1.15 | 75 health; bleeds 18 s |
| Hedge-priest | targe, torch 360 s, 3 bandages, no weapon | 50 poise; regen x1.25 | no heavy blow |
| Fen Healer | spear, torch 200 s, 5 bandages | bandage x0.5 time, heals 16 | sight x0.6 |
| Causeway Carter | broadaxe, targe, torch 180 s, 2 bandages | 120 health; bleeds 9 s | hearing x0.7 |

Sight and hearing stack on the weather (a night-blind healer in the miasma sees 4.2 m), and
own-noise stacks on load and weather (a gutter-kin sprinting 8 m from a goblin is not heard). The
default was chosen to carry the prototype's original kit, so nothing the suite expected changed;
its one visible difference is 90 health. Respawning keeps the background.

**Tests (run in this container).** `tests/smoke_test.gd`: 342 passed, 0 failures, twice (19 new:
eight complete, unique backgrounds; the headless default; the HUD line; the healer's bandages,
spear, half-time bandaging and night-blindness in two weathers; the priest's refused heavy and
allowed light; the gutter-kin's unheard sprint, 75 health and 18 s bleeds against the carter
hearing the same sprint; the carter's 120 health and deaf ear; the cleaner's bare hands and quick
search; the peat-cutter's and the factor's numbers; the start screen's keys; back to the
deserter). Kit suites, live boot and `tools/net_spike.py` clean. A new README screenshot of the
start screen; every other shot re-rendered and looked at.

**Not covered by headless tests.** Whether eight is readable on one screen at the browser's
size (the cards are 300 x 250 in a 4 x 2 grid; a 1280-wide window holds them), whether the flaws
bite enough to matter and the traits enough to be chosen, and whether the epigraphs land.

## Weather 1 — the Smothering's weathers: evidence (brief §24)

**What.** The roadmap line "ashfall, miasma fog, sleet, cinder-squalls, hoarfrost and the Dead
Calm, each changing sight, hearing, fire and footing", built on Fable from that line (no fuller
design exists). `Weather` holds one profile per condition and drifts through them on a cycle
(70 to 130 s a spell, 8 s blends, a fixed seed). Each profile sets the fog (density, colour, mist),
the ambient and moon scales, the ash (count, colour, speed, drift, size), hearing (a multiplier
on every loudness, the survivor's and the enemies'), sight (metres, beyond which Perception sees
nothing), torch burn, the shelter fire's light, and footing (a speed multiplier). The numbers:

| | Fog | Sight | Hearing | Torch | Fire | Footing | Falls |
|---|---|---|---|---|---|---|---|
| Ashfall | 0.012 | 24 m | x1.0 | x1.0 | x1.0 | x1.0 | grey ash |
| Miasma fog | 0.055, green-grey | 7 m | x0.7 | x1.0 | x0.9 | x1.0 | little |
| Sleet | 0.02 | 14 m | x0.85 | x1.8 | x0.75 | x0.85 | fast pale streaks |
| Cinder-squall | 0.03, warm | 9 m | x0.6 | x1.4 | x1.2 | x0.95 | orange embers, sideways |
| Hoarfrost | 0.006, pale | 32 m | x1.25 | x1.2 | x1.0 | x0.8 | nothing; a bright moon |
| Dead Calm | 0.004 | 40 m | x1.6 | x0.8 | x1.0 | x1.0 | nothing |

Hearing cuts both ways by design: a goblin 9 m away hears a sprint in the Dead Calm (9 x 1.6)
and not in the miasma (9 x 0.7), and the survivor's ripples reach the same way. A change is
announced by a banner and named on the HUD; F5 forces the next.

**Tests (run in this container).** `tests/smoke_test.gd`: 323 passed, 0 failures, twice (19 new:
the start state; miasma's fog, sight and hearing on a goblin in the cone, on an enemy noise and
on a goblin hearing a sprint, and the Dead Calm reversing all three; sleet's torch, fire, falling
streaks and measured 85% walking speed; hoarfrost's footing, moon and hearing; a blend half way
and complete; the cycle visiting all six). Kit suites, live boot and `tools/net_spike.py` clean.
Two new README screenshots, looked at.

**Not covered by headless tests.** Every number above is a first guess: whether 7 m of sight in
the miasma is tense or merely blind, whether 70 to 130 s spells are too long or too short for a
yard this size, whether the sleet's 85% and the hoarfrost's 80% read as footing or as lag, and
how the fog colours sit on a real screen. The browser build was not re-run for this slice: it
changes only values of the fog and ash the browser already renders.

## Perception 1 — the vision cone and acoustic ripples: evidence (brief §24)

**What.** The roadmap line "unseen threats shown as dust-ring ripples sized by noise; a 130°
vision cone with a charcoal memory map outside it", built on Fable from that line (there was no
fuller design). The reading taken: the cone is what the *survivor* sees, a 130° wedge around the
aim, cut by walls; outside it the world is drawn as a charcoal sketch and live enemies are not
drawn at all; what cannot be seen is heard. Nothing in the simulation changed: hits land as
before, and enemies sense the survivor as before.
- `Perception` (on the player): `in_cone`, `line_of_sight`, `can_see`; `update_visibility()` for
  enemies, which also drops a charcoal last-seen mark where one slipped out of sight (4 s; not
  for corpses); `report_noise(pos, loudness, source)` and `report_footsteps()`.
- Every enemy now reports its noises with a loudness in metres, the radius at which the survivor
  hears it, 0.55x through a wall: goblin steps 5 m creeping, 8 m moving, jab grunt 7, jab 9,
  stone 6; ork steps 8 to 10, grunts 8, slash 10, chop 11, bash 9, clang 14; ogre steps 16,
  grunt 12, sweep 14, roar 28, slam and crash 30, clang 20. A heard, unseen noise raises an
  `AcousticRipple` at its source (radius 0.3 m + 0.07 m per metre of loudness, one per source per
  0.22 s, tween-animated, drawn over everything) and the `heard` signal, which the bootstrap
  turns into the old cue (1.6 s apart) and a rare banner (12 s). The goblin's own wall-cue is gone;
  this replaces it for every enemy and every direction.
- `VisionConeOverlay` and `shaders/vision_cone.gdshader`: a full-screen quad, first among the
  transparent pass, that rebuilds each pixel's world position from the depth buffer and drains and
  darkens everything outside the wedge, with a four-degree soft edge and a 1.4 m lit circle at the
  survivor's feet. Forward+ stores depth reversed in 4.3; the Compatibility renderer does not; the
  overlay sets `reverse_z` from whether a RenderingDevice exists.
- A design bug caught on the way: the ogre used its *draw* flag as its own eyes (to spot the
  survivor and to charge). With the cone that would have blinded it behind the survivor. It now
  has `_can_see_player()`, a ray of its own, and the suite checks an unseen ogre still spots you.
- F4 toggles the cone (the old draw rule, line of sight alone).

**Tests (run in this container).** `tests/smoke_test.gd`: 304 passed, 0 failures (27 new: the cone
angles; an enemy drawn, hidden by turning away, marked once, drawn again, hidden by a wall, drawn
behind you with the cone off; no mark for a corpse; a seen noise raises no ripple, an unseen one
raises one where it was, one per source per 0.22 s, louder is larger, out of range unheard, muffled
through a wall, footsteps by stride, ripples clean up; a live ork behind you is unseen and heard; an
unseen ogre still spots you). Kit suites, live boot and `tools/net_spike.py` clean. README
screenshots re-rendered and looked at, plus the new one of an unseen goblin's rings.

**Not covered by headless tests.** Whether 130° feels right with a mouse aim (the cone swings
with the cursor; it may want smoothing or a wider angle), whether the charcoal is too dark on a
real screen, and whether ripples read as "a thing is there" in motion.

**Browser check (headless Chromium, SwiftShader, the exported Web build).** The Compatibility
renderer compiled the shader and drew the cone and the rings. Two renderer differences were found
and fixed by measurement: writing the whole frame back through the overlay ran it through
Compatibility's per-material tonemapping again and darkened the entire browser build (the overlay
now blends only where it darkens; inside the cone the frame is untouched on both renderers,
measured identical with the cone on and off), and the charcoal came out black there because that
renderer writes the output without encoding (on 4.3; 4.7.2 needs 0.9, see the engine upgrade) (an output gamma of 0.6, measured against 1.0, 0.75
and 1/2.2, puts the charcoal at 43% of the lit level in the browser against 44% on Forward+).
The mean luminance of the README shots is now 38 (was 59): the lit wedge is as bright as before
and everything outside it is deliberately charcoal. If the owner finds the whole too dark, the
levers are `darken` and `desaturate` in `shaders/vision_cone.gdshader` (0.6 and 0.85).

## Enemy temperaments — second audit, on Fable (brief §24)

The owner switched the session to Fable and asked for an audit before the next milestone. A fresh
read of all three enemies, the stone and the player's hit handling, as a coder and as a designer.

**Found and fixed.** The ogre's charge checked its lane with one chest-height ray, so it charged
over knee-high crates and bone heaps (solid bodies on layer 1) and into the 1.35 m Watchhouse
doorway, crashed, and reeled for 2 s: a free opening every six seconds, and silly. It now needs a
lane as wide as its shoulders (1.6 m), clear from knee to chest, all the way to the survivor; a
tree (layer 7, which no ray sees) still ends in a crash, as intended. Three new checks.

**Read and judged sound (design).** Each enemy's damage, pace and senses are distinct and the
README table matches the code. Points the owner should know, left as they are:
- The goblin's real damage is the bleed: 1.8 health a second for 12 s (about 22) on every jab,
  refreshed, not stacked. A goblin fight is a drain you stop by bandaging. The README now says so.
- A goblin under a third of its health never jabs again: it kites and throws. Sprinting (6.3 m/s
  against its 4.3) catches it. The coward reads; it is a choice.
- The shield ork walks at 2.55 m/s and cannot catch a survivor walking away (4.2). It has always
  been so: its threat is pressure, not pursuit.
- A stone throw takes the attack turn, so a stone can delay an ork's combo by about a second.
  Conservative; it keeps the one-attack-at-a-time rule simple.
- The ogre's sweep and slam still ignore the turn (its committed close blows, as always).

**Tests.** `tests/smoke_test.gd`: 277 passed, 0 failures, twice. Kit suites, live boot and
`tools/net_spike.py` (65) clean.

## Enemy temperaments — audit (brief §24)

The owner asked for a full audit that the temperament work is done. Two passes: a checklist
against the request and the tests, and an independent read of the code by a separate reviewer
given only the diff, not these notes.

**Against the request.** Attack style: each enemy has its own moves and a doc comment naming its
style. Aggression: an export on each, documented per enemy, with a measurable effect tested on
all three (goblin patience, ork recovery, ogre chase and charge cooldown). Attack power: an export
on each that scales every blow; this was untested and is now checked on all nine attacks. Also
distinct already: health and poise (65/22, 115/42, 280/95), speed, and senses (the goblin hears
footsteps and rummaging, the ork a sprint or a swing, the ogre only sees).

**Found and fixed.**
- *Since LF-4 (this PR):* the goblin's creep and the ogre's idle, shamble and doorway scratch were
  one-shot clips, so the bodies froze after one cycle. They are looped now, and the suite checks
  that every gait and idle clip loops. Found because the new test asked whether the goblin's
  reversed walk actually moves.
- The goblin's stone throw took no attack token, so stones could fly during another enemy's blow.
- The ogre's charge ignored whether it got the token. It now waits its turn. Its sweep and slam
  still take the turn regardless, as they always have (they are its committed close blows).
- With the survivor dead, goblins kept darting at and throwing at the body, and a backstab bark
  could overwrite "YOU PERISHED". Goblins and orks now stand down to patrol, closing their hitbox
  and handing back the turn. The bark now fires only when a backstab lands.
- A goblin out of patience, finding the turn taken, hovered at sword range, darting in and out
  every tick. It now circles for 0.8 s before trying again.
- A light blow released a goblin's token but its jab or throw carried on without one. Now any blow
  knocks a goblin out of its attack.
- The enraged ogre didn't get the longer chase its doc promised. The aggression speed bonus
  reached a shielded ork too. Both fixed.

**Checked and sound.** Every exit from the charge closes its hitbox. `player_ref` is null-safe on
every path (tests spawn enemies without one). The stone's rays use layer 1 only, and it can't
step through the survivor. The bash and `breaks_guard` behave as documented. Every new state is
in the animation and telegraph lists.

**Tests.** `tests/smoke_test.gd`: 274 passed, 0 failures, twice (16 new). Kit suites, live boot and
`tools/net_spike.py` (65) clean.

## Enemy temperaments — each enemy fights its own way: evidence (brief §24)

**Why.** The owner asked for each enemy to have its own attack style, aggression level and attack
power. The three already differed in stats and moves; they now differ in how they fight.

**What.** Every enemy has an `aggression` (0 to 1) and an `attack_power` export, and a doc comment
naming its style. Base damages are named constants.
- **Goblin, the opportunist** (aggression 0.3). Circles at 2.9 m, out of a sword's reach, and darts
  in (5.6 m/s, faster than a walk) when the survivor is open: back or side turned, recovering from
  a swing, searching or bandaging, staggered, lodged, reeling from a clang, or exhausted; or when
  its patience runs out (4 s at aggression 0, 1.2 s at 1) or on a small chance per second. A jab
  from more than 100 degrees off the survivor's aim is a backstab for double damage (a HUD bark
  says so). After a jab it backs away for 0.75 s, facing the survivor, playing the crouched walk in
  reverse. At 5 to 11 m with a clear line it throws a stone (`ThrownStone`: flat, 13 m/s,
  blockable and dodgeable, stopped by walls, 4.5 s between throws); a hurt goblin flees and keeps
  throwing. Jab 18 to 12 damage, startup 0.56 to 0.42 s, recovery 0.72 to 0.5 s.
- **Ork, the soldier** (shield ork 0.5, the baseline; the shieldless "cleaver" 0.85). A survivor who
  holds a raised guard in front of the shield ork for longer than its patience (1.0 s at 0.5) gets
  the shield bash (`Shield_Dash`): 6 damage, but `CombatPayload.breaks_guard` makes a block of it
  cost the stamina and stagger the survivor anyway. Aggression scales recovery after attacks (x1.3
  at 0 to x0.7 at 1), how far it chases its chop, and its speed without a shield; the cleaver runs
  at 4.3 m/s (a walk is 4.2) and rests 21% less.
- **Ogre, the juggernaut** (0.8). Doesn't flinch mid-blow: poise damage x0.35 during windups and the
  charge. From 5 to 11 m, with a clear line, after 1.2 s of chasing and with its charge cooled
  down (5.6 s), it braces (0.95 s, `Push`) and charges (8.5 m/s, `Sprint`) in a straight line it
  cannot steer: 38 damage, heavy, a body-sized hitbox of its own. It stops 3 m past where the
  survivor stood; running into a wall or a solid prop leaves it reeling for 2 s (counts as
  staggered, so a heavy blow can lodge). Below 40% health it is enraged: 25% faster, windups 20%
  shorter, charges sooner, a red ring. Aggression sets its chase distance (20 m, unchanged) and
  charge cooldown.

**Measured (headless soak, not committed).** An idle survivor (100 health) against each enemy
for 20 s, from 7 m. Facing it: a goblin circled a dozen times, jabbed four times and threw once
(70 damage, much of it bleeding); with the back turned it backstabbed and killed in 9.2 s. The
cleaver ork killed in 5.1 s, the shield ork in 6.4 s, the ogre in 6.7 s facing it (slam then
sweep) and 5.6 s with the back turned (it opened with the charge).

**Tests (run in this container).** `tests/smoke_test.gd`: 258 passed, 0 failures, twice (43 new: the
goblin's openings, patience, jab and backstab damage, bleeding, disengage, throw, stone damage,
stone stopped by a wall; the orks' temperaments, no bash without a raised guard, the bash breaking
a held guard at no health cost; the ogre's leash, unflinching windups, enrage, the charge hitting,
a sidestep making it miss, the crash into a wall, no charge through a wall; every new clip present).
Every earlier enemy, deflection and lodging check unchanged and passing. Kit suites, live boot and
`tools/net_spike.py` (65) clean.

**Not covered by headless tests.** Whether this feels fair: the goblin's dart and the ork's bash
are new things to read, the ogre's charge telegraph (a roar, a banner, the brace and an orange ring)
needs testing on a real screen, and the soak player never fights back. The numbers are first
guesses meant for tuning: `aggression` and `attack_power` on each enemy, and the named constants.

## Look and feel 4b — a brighter night: evidence (brief §24)

**Why.** The owner found the screenshots "incredibly dark". They were: the LF-3 night took mean
luminance of the README shots (0-255, centre crop) from 35 to 25, and the shots were rendered at
+0.4 brightness, so a player at the default saw something darker still.

**What changed.** At the default brightness the night is now lit like a clear, moonlit one:
ambient 1.8 to 2.6 (bluer-grey colour lifted), moon 2.1 to 3.0, exposure 1.55 to 1.7,
`adjustment_brightness` 1.12, SSAO 1.6 to 1.2, a paler mist, and a lighter vignette (0.55 to 0.4).
The grade, fog, glow and cold-vs-warm contrast are unchanged, so fire and torchlight still read as
warm pools. The brightness keys now range over exposure 0.6 to 2.6 (was 0.55 to 1.85), leaving
room both ways. `capture_screenshots.gd` renders at the default brightness, so the README shows
what a player sees.

**Measured.** Mean luminance of the five README shots without a HUD window: 25 before, 59 now
(shelter 72, Watchhouse 56, chest 55, ork 65, ogre 71). Every shot re-rendered and looked at.

**Not covered by headless tests.** The owner's screen. Software Vulkan and the browser's
Compatibility renderer differ a little in exposure; if it is now too bright or still too dark,
the `[` and `]` keys move it and the defaults are one line each in
`_build_atmosphere_and_lighting()`.

## Look and feel 4 — the Ashbound enemies, and a facing fix: evidence (brief §24)

**What changed.** The goblin, ork and ogre lose their capsules for the Ashbound: Quaternius's free
Peasant outfit (CC0, `art/quaternius/ashbound/`) worn as filthy rags over grey skin tinted per type
(goblin green, ork olive, ogre ash), under the Ranger's hood (the free outfit has no head and the
base characters have none to lend). `EnemyModel` scales each to its collision capsule (goblin
1.35 m, ork 1.92 m and broader, ogre 2.95 m and much broader) and shares the survivor's clip
library. Goblin: creeps (crouch), jogs, jabs (`Sword_Dash`). Ork: sword idle, walks, jogs, raises
its shield on the advance, slashes then chops, staggers on a guard break. Ogre: zombie shamble and
idle, claws at doorways it cannot fit, sweeps and slams. Every attack's blow lands as its startup
timer runs out (`play_strike`). Weapons hang in the right hand; the status ring stays the readable
telegraph; death plays `Death01` instead of tipping the body flat. AI, timings, hitboxes and
hurtboxes are untouched.

**A bug in shipped work, found and fixed.** The close-ups showed the ork from behind when it was
turned to face the camera. Measured from the skeleton, Quaternius's characters face +Z in their
files (toes point +Z), but the game aims down -Z, so **the survivor merged in LF-1b (PR #12) has
been running and swinging backwards**. The LF-1b render check misread the pose and no test looked
at facing. Both models now turn the character 180°, and the suite checks that every character's
toes point where it aims.

**Tests (run in this container).** `tests/smoke_test.gd`: 215 passed, 0 failures (12 new: the
survivor and each enemy face where they aim; each enemy has its body and every clip it uses and
holds its weapon in the right hand; a goblin's attack plays the jab; its death plays Death01 and
is not tipped flat). Every earlier combat and enemy check unchanged and passing. Kit suites, live
boot and `tools/net_spike.py` clean. README screenshots re-rendered and looked at, plus close-ups
of each enemy's idle and attack.

**Not covered by headless tests.** Whether the strikes read in motion, foot sliding on the ogre's
shamble, and whether faceless hooded humans read as goblins and orks (they are stand-ins; a
creature mesh on the same rig can replace them).

## Look and feel 3b — solid set dressing: evidence (brief §24)

**What.** After LF-2b you could walk through trees and fences. Now 21 solid pieces (six dead trees
at the trunk only, two stumps, two fallen trees, four boulders, the ruin wall, column, remnant and
wall-fall rubble by the lair, three fence runs) get a collider: a 0.22 m cylinder for trunks, a box
85% of the footprint for the rest. Ground cover, pebbles, low rubble and firewood stay walk-through.

**Why a new layer.** Layer 1 is also what every ray casts against: enemy line of sight, the
hidden-behind-a-wall check, wall clangs and hit blocking. A trunk on layer 1 would make an enemy
flicker out of view or stop a sword. The colliders go on a new layer 7 "Props"; the survivor's and
the three enemies' body masks add it (1 | 2 | 4 | 64). Rays are unchanged, so props block movement
and nothing else.

**Tests (run in this container).** `tests/smoke_test.gd`: 203 passed, 0 failures (the "no collision"
check became four: solids only on the Props layer; a layer-1 ray passes through a tree; a Props ray
hits it; the survivor's `test_move` into it is blocked). All earlier combat, enemy and wall checks
unchanged and passing. Kit suites, live boot and `tools/net_spike.py` clean.

**Not covered by headless tests.** Whether an enemy chasing round the ruins by the lair snags on them
(the AI steers straight at its target and slides along obstacles), and how the fence colliders feel.

## Look and feel 3 — lighting and atmosphere: evidence (brief §24)

**What changed.** The third and last look-and-feel slice, built only from features the browser's
Compatibility renderer also draws (SSAO is the one exception; it is desktop-only and simply off
there):
- **Night grade.** The sun is now a cold `Moon` (blue-grey, dimmer, softer shadows), the ambient
  light is blue-grey, and an adjustment drains saturation to 0.8 and lifts contrast a little, so
  the fire and the torch read as warm pools in a cold yard.
- **Mist.** Distance fog plus a low ground mist (`fog_height`), in a pale blue-grey. A first pass
  used a near-black fog colour, which turned the misted ground almost black in the screenshots; it
  was caught there and fixed.
- **Glow** on emissive surfaces (the embers, flames), and **SSAO** contact shadows on desktop.
- **Falling ash** (`AshFall`, `shaders/ash_fall.gdshader`): 420 flakes in one MultiMesh, placed and
  animated in the shader, fixed in world space and wrapping in a box that follows the survivor.
  Not particles, so it renders in software screenshots and in the browser. A first pass at 700
  larger, brighter flakes read as a starfield; it was dimmed, shrunk and thinned.
- **Vignette** (`Vignette`, CanvasLayer 0, under the HUD, ignores the mouse).
- **Fire flicker** (`FlickerLight`): the shelter fire's energy and range breathe on layered sines
  (deterministic), and the ember bed's glow follows it.

**Tests (run in this container).** `tests/smoke_test.gd`: 200 passed, 0 failures (6 new: the night
grade, a cold moon, the ash count and that it follows the survivor, the vignette under the HUD, the
fire's flicker within its base energy). README screenshots re-rendered and looked at (twice; see
the two fixes above); the web export renders the grade, mist, glow, ash and vignette in headless
Chromium.

**Not covered by headless tests.** How dark this is on the owner's screen (the in-game brightness
keys still work), whether the ash reads as ash while moving, and the browser's frame rate.

## Look and feel 2b — the owner's kit dresses the yard: evidence (brief §24)

**What.** The owner's environment kit (PR #14, made in a separate session) now dresses the
single-player prototype. `SetDressing` places 30 hand-placed pieces: six dead trees at the yard's
edges, stumps and fallen trees, rock clusters, ruin walls and columns around the ogre's lair,
rubble at the Watchhouse and the ork walls, firewood by the fire, and a broken fence along the
shelter. A fixed-seed scatter adds 70 tufts of grass, weeds, leaves and twigs, kept out of the
buildings and away from the containers. Every piece is darkened slightly to sit in the light.
The five search containers wear kit crates (an open one for the ork pile, a pale tangle of twigs
for the bone heap), each scaled to fit inside its collision box.

**Why nothing moves in play.** Decoration has no collision and is on no physics layer, so walls,
the doorway, the entry hall, clangs, enemy routes and every test position are as before. The
ENV-010 timber Watchhouse layout stays a separate preview scene: swapping it in would change the
stone Watchhouse's gameplay geometry (the 1.35 m doorway, the 1.7 m entry hall).

**Also.** CI now runs the kit's four collision suites (ENV-006 to ENV-009). Godot's generated
`.import` files and extracted textures under `assets/environment/` are git-ignored.

**Tests (run in this container).** `tests/smoke_test.gd`: 194 passed, 0 failures (the crate check
became three: all five containers wear kit models inside their collision; 100 pieces placed; set
dressing adds no collision bodies). The kit suites: ENV-006 1,082 checks, ENV-007 837, ENV-008 and
ENV-009 78 cases each, 0 failures. Compile check, live boot, `tools/net_spike.py` (65) clean. README
screenshots re-rendered and looked at; the web export checked in headless Chromium.

**Not covered by headless tests.** Walking through a tree or fence (no collision yet) may look
wrong; whether the ground cover reads or clutters at the default zoom; browser frame rate with 100
more meshes.

## Look and feel 2 — the environment: evidence (brief §24)

**Approach.** The level is code-built boxes of arbitrary sizes, so modular kit pieces would not fit
them, and the owner had just ruled out stylised art. The boxes keep their shapes, collision and
cutaway and wear photo-scanned CC0 textures instead (ambientCG): mud with straw for the ground,
dressed stone for the Watchhouse, ruins and fire ring, dark weathered planks for the roof and crates.

**What changed.**
- `shaders/foreground_cutaway.gdshader` projects an albedo and an OpenGL normal map in world space
  (floor and roof on XZ, walls on the plane they face) at a fixed density, tinted per surface; the
  cutaway, damp gradient and a lighter procedural grime are unchanged.
- `AshenWildsBootstrap.SURFACES` names the four surfaces; `_create_static_box()` takes one as its last
  argument; `surface_material()` builds the triplanar StandardMaterial3D the crates and chest use.
- The shelter fire gains a glowing ember bed and three charred logs (decoration, no collision).
- `art/ambientcg/` holds the six 1K JPGs (AO baked into each albedo) and a README with sources.

**Blocked: prop models.** Poly Haven's CC0 models (crates, a chest, barrels, a stone fire pit) were
the plan for props, but its download server answers scripted downloads with 403. Changing the
client's user agent to get past that was refused as bot-check circumvention, rightly. The props stay
textured boxes until the owner downloads the models in a browser or decides on tooling.

**Tests (run in this container).** `tests/smoke_test.gd`: 192 passed, 0 failures (2 new: every level
box is textured; crates wear planks). Compile check, live boot and `tools/net_spike.py` (65) clean.
All seven README screenshots re-rendered through Forward+ and looked at; the web export renders the
textured walls in headless Chromium.

**Not covered by headless tests.** Whether the tiling repeats visibly while walking, how dark it
reads on a real screen, and frame rate on the Chromebook with the extra texture sampling.

## Look and feel 1b — a grim survivor: evidence (brief §24)

**Why.** After LF-1 merged, the owner: "the character does not fit the grim world at all." KayKit's
chibi proportions read as cute however dark the texture. Quaternius's free character and animation
packs have adult proportions and the same CC0 licence, and the code was built to swap the mesh.

**What changed.**
- `art/kaykit/` removed; `art/quaternius/` added: the Male Ranger outfit (hood, leathers, bracers,
  boots), textures downscaled from 4K to 1K, and the Universal Animation Libraries 1 and 2 (one
  65-bone humanoid skeleton for all three). Sources and licences: `art/quaternius/README.md`.
- The outfit is recoloured: greens to dark, dirty oilcloth, leather dulled, a fixed-seed grime
  over it; the skin paler (`tools/recolor_survivor_texture.py`).
- Clip choices: `Sword_Idle`, or `Idle_Torch` (torch held aloft) with a lit torch; walk, jog and
  sprint by speed; light sweeps alternate `Sword_Regular_A`/`B`; heavy sweeps `Sword_Regular_C`;
  thrusts (the sword's heavy, the spear) `Sword_Dash`; punches unarmed; `Idle_Shield` to block,
  `Shield_OneShot` on a blocked hit, `Idle_Shield_Break` on a guard break; `Roll` to dodge, with the
  model turned to face the roll; `Hit_Knockback` and `Hit_Head` for stagger and wall recoil;
  `Fixing_Kneeling` to search, `Consume` to bandage; `Death01`.
- The hand bones put the blade direction on -Z already, so the sockets only move into the palm; the
  targe sits on a mount on the back of the left hand.
- The torch light now hangs on the body over the left shoulder, 2.3 m up, not on the hand: the
  torch-holding idle raises the torch overhead and the light would have swung up to 3.5 m.
- Drawn blades are back to 0.7 of the weapon's reach (half was only for the short KayKit figure).

**Tests (run in this container).** `tests/smoke_test.gd`: 190 passed, 0 failures (the survivor
section now checks the Quaternius clips, the shield mount and the torch idle). Compile check, live
boot and `tools/net_spike.py` (65) clean. All seven README screenshots re-rendered through Forward+
and looked at, plus close-ups of every main pose; the web export booted in headless Chromium.

**Not covered by headless tests.** Whether this reads as grim enough to the owner; foot sliding;
whether the sword swings line up with when hits land (the clips are fitted to each attack's
duration, not to its active frames).

## Look and feel 1 — the survivor: evidence (brief §24)

**Why now.** The owner deferred multiplayer ("lets work on multiplayer much later") and chose look
and feel next, in three slices: the survivor, the environment, lighting and materials. The browser
build plays the single-player prototype, so that is where the slices land first.

**What changed.**
- The capsule-and-sphere survivor is replaced by KayKit's Rogue_Hooded (Adventurers 2.0, CC0),
  animated with KayKit's Rig_Medium clips (Character Animations 1.1, CC0): idle, walk, jog, run,
  one- and two-handed slices, stabs and chops, unarmed punch and kick, block, block-hit, four
  dodges, two hits, death, interact (search) and use-item (bandage). Files, sources and licences:
  `art/kaykit/README.md`.
- `SurvivorModel` (presentation only) loads the character, merges the clips into one
  `AnimationPlayer` and exposes two hand sockets on the rig's hand-slot bones. The controller's
  sword, targe (now a round disc) and torch hang off them. Hitbox, hurtbox, collision and aim are
  unchanged and never read the mesh.
- `PlayerController._update_animation()` chooses the clip from the action state. Timed states
  stretch their clip to the state's own duration (a light sword swing's slice plays at 1.9× to fit
  0.72 s), so the simulation keeps the timing. Light sweeps alternate forehand and backhand.
- The KayKit palette texture is recoloured (`tools/recolor_survivor_texture.py`): bright cloth
  greens become dark, worn oilcloth; the rest is muted.
- The torch stays upright whatever the hand does. Its light hangs 1.8 m above the hand, over the
  hood: at the flame, which the animated hands carry in front of the body, the body cast a dark
  wedge across the Watchhouse in the search screenshot (found by looking at it, fixed, re-rendered).
  The torch's range gets +1 m for the extra height.
- The drawn blade is about half the weapon's reach; the stylised character is short and a
  full-length blade dwarfed it. Reach in play still comes from the hitbox.

**Tests (run in this container).** `tests/smoke_test.gd`: 189 passed, 0 failures, twice (177
before; 12 new under "Survivor model": every clip the states use is loaded, items on the right
sockets, idle, heavy thrust plays the stab, light sweep plays a slice fitted to the attack's
duration, the torch points up, its light is above the hood, death plays Death_A, respawn returns to
idle). Compile check clean; live boot clean; `tools/net_spike.py` 65 passed (the courtyard is
unchanged). Screenshots re-rendered through Forward+ (all seven README images) and looked at; the
web export booted in headless Chromium (WebGL 2, Compatibility renderer) with the character drawn
and no console errors.

**Not covered by headless tests.** Foot sliding (the walk, jog and run speeds are matched to
movement speed by estimate), how the swings read at game zoom, the stylised proportions next to the
grim setting, and whether the sockets look right in every animation. These need the owner's eye in
the browser build.

## Milestone 3 — persistent refuge: evidence (brief §24)

Branch `claude/gifted-babbage-vbbmgl-m3`. Protocol 4, build `m3-persistent-refuge`. Changed:
`scripts/net/net_save.gd` (new), `scripts/net/net_fixture.gd` (new), `net_courtyard.gd` (the low
wall with the breach, the hearth, the woodpile moved), `net_container.gd` (`restore`),
`net_protocol.gd`, `net_main.gd` (load before listening, save on change and shutdown, the fixture
request, fixture state, interaction prompts, drives), `tools/net_spike.py` (25 checks),
`tools/export_builds.sh` (ARM64 client, start scripts, Chromebook and save notes),
`export_presets.cfg` (Linux Client ARM64), this file, `CLAUDE.md`, `README.md`.

| Check | Kind | Result |
|---|---|---|
| Compile-check of every script | syntax | clean |
| `tests/smoke_test.gd` | single-player regression | 177 passed, 0 failed |
| `tools/net_spike.py` | loopback: five processes, then a restart, four broken-save cases, a hard kill | **65 passed, 0 failed**; logs clean apart from the deliberate refusals |
| `tools/net_spike.py --shots` | plus a rendered client | 66 passed, 0 failed |
| `tools/net_spike.py --exported builds` | the same 65 checks on the exported Linux binaries from `1e69f3f` | **65 passed, 0 failed** |
| Compatibility renderer (`--rendering-method gl_compatibility`) | rendered client under Mesa OpenGL | runs and draws the courtyard like Forward+; the start scripts use it by default for Chromebooks |
| `play-here.sh` | the exported start script, x86_64 | started a server and a player; a second player joined that server and saw the first and the crate |
| Screenshot `camera-refuge.png` | visual | **reviewed by the agent**: the lit hearth casts a warm pool of light on the ground, crate and fence; the barricade fills the breach. The planks read small at this zoom (placeholder art). |
| ARM64 Linux client | — | **exported, not run** (no ARM machine here) |

What the tests establish (brief §62 criteria 7 and 10; matrix E and G): B lights the hearth and,
left with one timber, cannot repair (`INSUFFICIENT_RESOURCES`) · before the repair B walks out
through the breach (z > 7) · A repairs it with two timber; lighting the lit hearth is
`STATE_CHANGED` · after the repair the barricade stops A at the gap (z < 6.2) · B2, joined with the
breach open, receives the repair live from A's action · conservation now counts what fixtures
consumed · the server starts a new world and saves it with no failures · a restarted server loads
the same world id; alpha comes back where the save left them, with the same pack; the crate comes
back with the same contents, version and stack ids; the breach and the hearth come back done ·
a corrupt primary falls back to the backup and is kept aside, and the primary is rewritten · a
newer-schema save stops the server (exit 4) and stays byte-identical · two unusable files stop
it (exit 3) and stay untouched · `--reset-world` keeps both aside and starts a new world · a
server killed outright (SIGKILL) three seconds after a take keeps the take across the restart.

Not established: a human playtest, Windows or ARM runs, internet play, a disk-full or
read-only-folder failure (the code retries and reports a failed write; untested).

## Milestone 1d — exported test builds and CI: evidence (brief §24)

Branch `claude/gifted-babbage-vbbmgl-m1d`. Changed: `launcher.tscn` + `scripts/core/launcher.gd`
(the new main scene), `project.godot` (`run/main_scene`), `export_presets.cfg` (Linux Client,
Linux Server with `dedicated_server`, Windows Client; x86_64, embedded pack),
`tools/export_builds.sh`, `tools/net_spike.py --exported`, `.github/workflows/checks.yml`,
this file, `CLAUDE.md`, `README.md`.

| Check | Kind | Result |
|---|---|---|
| Compile-check of every script | syntax | clean |
| `tests/smoke_test.gd` | single-player regression | 177 passed, 0 failed |
| Boot with no arguments through the launcher (`--quit-after 600`) | runtime | opens the single-player prototype; nothing in the log beyond the documented noise |
| `tools/export_builds.sh` | export | three builds produced from the installed 4.3-stable templates: Linux client 66 MB, Linux server 66 MB, Windows client 84 MB, plus `BUILD_INFO.txt` |
| `tools/net_spike.py --exported builds` | **the exported Linux server and client, five processes on loopback** | **40 passed, 0 failed**, three runs; the only log line beyond the documented noise is the release-template shutdown message recorded in `CLAUDE.md` |
| `tools/net_spike.py` (editor binary) | loopback | 40 passed, 0 failed |
| Windows client | — | **not executed**: no Windows machine in this session. The file was produced; nothing more is claimed. |
| CI workflow | — | **not executed here**: it runs on the first push of this branch; its result is the first CI evidence this repository has. |

What this establishes: the exported server runs headless (criterion 1 of brief §62 with a real
export, not the editor), the exported client joins it, and every Milestone 1 behaviour holds on the
exported binaries. What it does not: a Windows run, an internet run, or a human playtest.

## Milestone 1c — store-item: evidence (brief §24)

Branch `claude/gifted-babbage-vbbmgl-m1c`. Protocol 3. Changed: `net_protocol.gd`,
`net_container.gd` (`put` with stack merging), `net_main.gd` (`request_store_item`, `_store_for`,
drive steps), `net_loot_window.gd` (a "your pack" section with Store 1 / Store all),
`tools/net_spike.py` (six checks), this file.

| Check | Kind | Result |
|---|---|---|
| Compile-check of every script | syntax | clean |
| `tests/smoke_test.gd` | single-player regression | 177 passed, 0 failed |
| `tools/net_spike.py` | two-client local loopback test | **40 passed, 0 failed**, two runs; logs clean |
| `tools/net_spike.py --shots` | plus a rendered client | 41 passed, 0 failed |

New checks: A stores two timber back (OK) · storing 99 salt A does not hold is `STATE_CHANGED`
with nothing moved · an undefined item id is `INVALID_REQUEST` · a store from 4 m away is
`OUT_OF_RANGE` · after 6 − 4 − 2 + 2 the crate holds 2 timber and A holds 2, and the whole-world
conservation check still holds · B saw the crate refilled before leaving. The crate-window
screenshot now shows the pack section (visually reviewed by the agent).

## Milestone 1b — shared container and take-item: evidence (brief §24)

Branch `claude/gifted-babbage-vbbmgl-m1b`. Changed files: `scripts/net/net_container.gd` (new),
`scripts/net/net_loot_window.gd` (new), `scripts/net/net_protocol.gd` (protocol 2, results,
`PACK_CAPACITY_KG`, `INTERACT_RADIUS`), `scripts/net/net_courtyard.gd` (the crate and its seed),
`scripts/net/net_main.gd` (request pipeline, server packs, initial sync, interaction, drives),
`tools/net_spike.py` (matrix D checks), this file, `CLAUDE.md`, `README.md`.

| Check | Kind | Result |
|---|---|---|
| Import and compile-check of every script | syntax | clean |
| `tests/smoke_test.gd` | single-player regression | 177 passed, 0 failed |
| `tools/net_spike.py` | **two-client local loopback test**, five Godot processes | **34 passed, 0 failed** (19 from M1a plus 15 for the crate), three runs after the last code change; logs clean |
| `tools/net_spike.py --shots` | plus a rendered client under Xvfb | 35 passed, 0 failed, two runs |
| Screenshots | `docs/screenshots/net/camera-crate-window.png` plus the six M1a views, re-taken | **Visually reviewed** by the agent: the open crate window lists the stacks the other two players left, with weights, explicit Take 1 / Take all buttons, the pack line and the close hint; the review caught two faults that were then fixed (a wrong key in the close hint, the panel overlapping the HUD). Not yet reviewed by a developer. |

What the loopback test establishes (brief §17, §62 criteria 5 and 6): both clients receive the
crate on joining · two clients asking for the one flask of lamp oil in the same instant: exactly
one gets it, the other is told `STATE_CHANGED` and gets a fresh view · a repeated request id gets
its first answer again and moves nothing · quantity 0 is `INVALID_REQUEST`, an unknown container
`OBJECT_UNAVAILABLE`, a take from 4 m away `OUT_OF_RANGE` · 14 kg of pot, targe and timber go
into a 12 kg pack (under the 18 kg hard limit) and 4.8 kg more is `CAPACITY_EXCEEDED` with
nothing moved · every seeded item is accounted for across the crate and every pack the server
knows, live or retained · a take sent in the instant of disconnecting is applied once or not at
all · the rejoin gets the pack back · each client's final view of the crate equals the server's,
version and contents · no request is left unanswered.

Not established: storing items back (next), persistence across a server restart (Milestone 3,
criterion 10), repair (criterion 7). **Still loopback only; no internet test, no human playtest.**
The one-process-at-a-time nature of the server means "simultaneous" is decided by arrival order,
which is the intended rule; under real latency the loser's wait is longer, not different.

## Milestone 1a — networked courtyard: evidence (brief §24)

Branch `claude/gifted-babbage-vbbmgl-m1a`. Changed files: `scripts/net/*` (new), `net_main.tscn`
(new), `scripts/camera/iso_camera_rig.gd` (quarter turns, recenter, `set_zoom`; the single-player
scene binds none of the new actions and is unchanged in behaviour), `tools/net_spike.py` (new),
this file, `CLAUDE.md`, `README.md`.

| Check | Kind | Result |
|---|---|---|
| Import and compile-check of every script | syntax | clean |
| `tests/smoke_test.gd` | single-player regression | 177 passed, 0 failed, after the camera change |
| `tools/net_spike.py` | **two-client local loopback test**, five Godot processes on one machine | 19 passed, 0 failed, five runs; the five process logs carry no error or warning beyond the documented headless noise |
| `tools/net_spike.py --shots` | the same plus a sixth, rendered client under Xvfb with Mesa's software Vulkan (`llvmpipe`) | 20 passed, 0 failed, three runs (one earlier run lost two timing checks under CPU load before the rendered client was moved to start first; not reproduced since) |
| Screenshots | `docs/screenshots/net/camera-view{0,1,2,3}.png`, `camera-zoom-near.png`, `camera-zoom-far.png` | **Visually reviewed** by the agent, not yet by a developer: every view keeps the same elevation and pitch, no horizon or under-map view, other survivors and their facing visible from all four views, both zoom limits readable, HUD legible. Near-wall, under-roof and map-edge views (appendix §78) wait for the interior slice. |

What the loopback test establishes (brief §62): 1 server runs headless and writes its report ·
2 two clients connect · 3 a client cannot act on another's avatar (the server maps the sender to
its own avatar; an input before `hello` is rejected `NO_PLAYER`) · 4 cameras rotate independently
(A at 135°, B still at 45°) and intent follows each client's own camera · 8 disconnect follows R1
· 9 a rejoin under the same key spawns at the last authoritative position · a protocol mismatch
is rejected with a clear reason · the server's final record matches the owning client's predicted
position within 0.3 m, with prediction corrections peaking at 0.11–0.17 m.

Not established: 5–7 and 10 (container, single-item contention, shared repair, persistence) are
the next slices. **No internet test has been run**; latency and loss are untested (Milestone 1b).
No human has played it. Frame time on the developers' machines is unmeasured.

## Deferred register (appendix §97)

| Feature | Why deferred | Prerequisite to revisit |
|---|---|---|
| Camera pan | Not needed to prove the architecture | Playtest asks for it |
| Free camera rotation | Four views first (brief §5) | Four views judged readable in an interior |
| Latency and loss simulation | Tooling: `tc netem` on loopback needs root; ENet has no built-in simulator in 4.3 | Milestone 1b |
| Procedural Blackfen | Brief §11, §25 | A finished vertical slice and a measured need |
| Public servers, PvP, accounts, matchmaking | Supplement §43–§46 | The owners' decisions |

## Next

The two developers' first playtest, recorded per appendix §94: it decides whether Milestone 4
(one enemy, one attack, damage and death, online) comes next or feel comes first. The latency and
loss tests still need a decision on tooling (`tc netem` needs root on the test machine).
