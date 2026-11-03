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
| Engine | **CONFIRMED**: Godot 4.3-stable (`4.3.stable.official.77dcf97d8`), GDScript, Forward+. Pinned in `project.godot`. Do not change versions during production without a recorded decision. |
| Asset tools | **PROPOSED** (brief §4): Blender, exporting glTF/GLB into `res://`. Blender was not available in the session that wrote this; no 3D asset has been authored yet. |
| Preserved prototype | `main.tscn` and everything under `scripts/` other than `scripts/net/` are the single-player Milestones 1–5 of the earlier plan: 177 headless checks, unchanged. The new networked work lives beside it, not inside it. |
| Reproducible build | Source plus the Godot binary. No export templates are in use yet; the game runs from source with the commands below. Exported test builds (appendix §57, §91) are Milestone 1's last step. |
| Collaboration | GitHub, one focused draft PR per slice, small commits; CI runs the single-player suite. The loopback network test is run locally for now (CI has no second process budget measured yet). |

Commands (from the repository root; `GODOT` is the 4.3-stable binary):

```bash
$GODOT --headless --path . --import                                # class cache
$GODOT --headless --path . --script res://tests/smoke_test.gd      # single-player suite (177 checks)
python3 tools/net_spike.py                                         # networked courtyard, 5 processes on loopback
python3 tools/net_spike.py --shots docs/screenshots/net            # same, plus a rendered client under Xvfb
$GODOT --headless --path . net_main.tscn -- --server --port 7788   # a dedicated server, no window
$GODOT --path . net_main.tscn -- --client --host 127.0.0.1 --port 7788 --player-key alice
```

## Decision register (appendix §63)

| # | Decision | Status | Date | Reason / consequence | Revisit trigger |
|---|---|---|---|---|---|
| P1 | Base the 3D game on this Godot repo | CONFIRMED | 2026-11-03 | Already real-time 3D, elevated orthographic rig with roof hiding and wall cutaway, built-in multiplayer, GLB import. The browser build would need a renderer first. | Only if the developers' machines cannot run the Godot editor (test: open the project, press F5). |
| P2 | Godot 4.3-stable | CONFIRMED | 2026-11-03 | Project pins it; its own suite passes on it. | A blocking engine bug, or a feature that needs 4.4+, recorded here first. |
| P3 | Target platforms | PROPOSED desktop first (Windows/Linux/macOS exports); browser export as a later option | 2026-11-03 | Brief §48. The owner's Chromebook is unmeasured. | The F5 test above, and the first exported build. |
| P4 | Online session model | OPEN. **TEMPORARY A1**: one player's game is also the server ("listen server"); the other joins by IP over Godot's ENet. | 2026-11-03 | Fastest route to a two-player test with no services. Changing to dedicated servers needs only the already-separate server role; a relay or NAT traversal needs a decision on hosting. | The owners' answer to the online-model question. |
| P5 | Player count | OPEN. Spike server default: 2 (`--max-players` dev setting). | 2026-11-03 | Brief §7: two is the test, not the limit. | Measured server and network cost with two, then a decision. |
| P6 | PvP | OPEN. **TEMPORARY A2**: none. | 2026-11-03 | Affects hit validation and death rules, not transport. | The owners' answer. |
| P7 | Persistence | OPEN. **TEMPORARY A4** (not yet built): versioned JSON on the server with the browser build's tested rules (validate before write, keep a backup, never overwrite a newer format, never silently reset). | 2026-11-03 | One courtyard and one container do not justify a database (brief §18). | Measured save size or concurrency at Milestone 3. |
| P8 | Camera | PROPOSED → built in M1a: elevated orthographic, pitch fixed at −30°, four quarter-turn views eased over 0.35 s, wheel zoom between fixed limits, C recenters, per client. No pan yet. | 2026-11-03 | Brief §5: controlled first, free rotation only if it reads. | Playtest of the four views in a real interior (appendix §84). |
| P9 | Movement controls | PROPOSED → built in M1a: camera-relative intent resolved on the client, basis frozen while a key is held (a mid-walk turn does not swerve you), server integrates at 60 Hz, immediate velocity, 3.2 m/s, no acceleration. | 2026-11-03 | Appendix §77. | Feel in the first human playtest. |
| P10 | Network rates | **TEMPORARY A3**: input up to 60/s unreliable-ordered; state 30/s unreliable-ordered; join, spawn, leave reliable. | 2026-11-03 | Constants in `net_protocol.gd`. | Latency and loss tests (Milestone 1b). |
| P11 | Inventory capacity model | OPEN | | Supplement §36. Weight-only is what the single-player code already does. | Needed before the container slice is designed; see Next. |
| P12 | Death and recovery | OPEN | | Supplement §42. Not needed before Milestone 4. | Before Milestone 4. |
| P13 | Asset pipeline | PROPOSED: Blender → GLB → `res://art/exports/`, metadata per asset (brief §14), a 20-piece test kit first. | 2026-11-03 | Brief §12–§14, appendix §82. | The first exported module placed beside the capsule placeholder. |
| P14 | Superseded earlier decisions | Random world per expedition, browser-only delivery (old D42), and the generated 48×48 Blackfen before a small location: all superseded by the briefs and the owner's decisions. The procedural generator remains in the browser repo as reference. | 2026-11-03 | Brief §11, §25. | A demonstrated need for a larger world after the vertical slice. |

### Temporary rules in the code

| Rule | What it does | Why | Consequence of changing |
|---|---|---|---|
| R1 disconnect | On disconnect the avatar is removed at once; the server keeps the player's record (position, facing, colour) in memory; a rejoin with the same player key spawns there. | Brief §62 criterion 8 needs an explicit rule; this one is the least surprising for a two-player test. | A "body stays for N seconds" rule changes `_on_peer_disconnected` only. Records are in memory: a server restart loses them until Milestone 3's saves. |
| R2 identity | `--player-key` (a string the developer chooses) is the persistent player identity; the ENet connection id is only the connection. | Appendix §45, §72: never key ownership on a connection id. | This is a development mechanism, not authentication. Any real identity scheme replaces the key's source, not its role. |

## Identifiers (appendix §72)

| Identifier | Example | Survives disconnect | Survives server restart | Notes |
|---|---|---|---|---|
| Connection id | `442489596` | no | no | ENet peer id; the server is always 1. |
| Player key (identity) | `alice` | yes | yes (once saved) | Dev-chosen string, R2. |
| Avatar node | `/root/NetMain/Players/<connection id>` | no | no | Presentation and simulation handle; never persisted. |
| World object id | — | — | — | Not assigned yet: nothing in the courtyard is interactable or persistent. Assigned in the container slice. |
| Item definition / instance id | — | — | — | Exist in the single-player `ItemData`/`ItemInstance`; adopted by the container slice. |

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
| leave | — | — | — | ENet disconnect | rule R1 | — |

Durable state and presentation are already distinct (appendix §75): positions and the player table
are durable, the turn animation and HUD messages are local.

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

The second slice of Milestone 1 (appendix §67): one shared container with world object id and
server-owned contents; `request_container_contents` and `request_take_item` with request ids,
distance checks and capacity; the simultaneous-last-item, repeated-request and
disconnect-mid-transfer tests from brief §17 added to the loopback test. It needs decision P11
(capacity model); the proposal is weight-only, as the single-player `Inventory` already is.
