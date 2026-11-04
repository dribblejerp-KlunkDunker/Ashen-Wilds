#!/usr/bin/env python3
"""Milestone 1a loopback test: one headless server and driven headless clients, as separate
Godot processes on this machine (appendix §56 A-C, brief §62 criteria 1-4, 8, 9).

This is a two-client LOCAL test. It says nothing about internet reliability (brief §8).

Milestone 1b adds the shared supply crate: both clients read it, both ask for the single flask of
lamp oil at the same moment, A repeats a request id, sends an impossible quantity and overloads
its pack, B asks for a container that does not exist, A asks from out of reach, and B sends a
take in the instant it disconnects. The checks are the brief §17 list: quantities conserved,
capacity enforced, no duplicate from concurrent access or repeats, invalid requests rejected,
disconnect leaves no unexplained ownership, the rejoin gets the pack back.

Scenario (times are approximate, each client's drive runs from its own spawn):
  t0      server starts, headless, quits after SERVER_SECONDS writing its report
  t0+1.0  A and B connect. A walks screen-up, turns its camera a quarter, walks screen-up again,
          then stays until t+9. B walks screen-right and leaves at t+4 (a clean disconnect).
  t0+7.0  MISMATCH connects with protocol 999 after sending one input before any hello.
  t0+8.0  B2 reconnects with B's player key and expects B's last position (rule R1).

Exit code is the number of failed checks. Set GODOT to the 4.7.2-stable binary, or put it at
~/godot/Godot_v4.7.2-stable_linux.x86_64. Run from the project root:  python3 tools/net_spike.py
Pass --keep to leave the report directory in place; its path is printed either way.
Pass --exported DIR to run the exported binaries from tools/export_builds.sh instead of the editor
binary and the project (DIR/linux-server/ashen-wilds-server.x86_64 serves, DIR/linux-client/
ashen-wilds-client.x86_64 joins): the proof that the archives contain a working game (§91).
Pass --shots DIR to also run a SHOTS client with real rendering under Xvfb (Mesa's software
Vulkan), which saves every camera view and both zoom limits as PNGs into DIR (appendix §78).
Those images must be looked at by a person; the script only checks that they were written.
"""
import json, math, os, shutil, subprocess, sys, tempfile, time

GODOT = os.environ.get("GODOT", os.path.expanduser("~/godot/Godot_v4.7.2-stable_linux.x86_64"))
EXPORTED = sys.argv[sys.argv.index("--exported") + 1] if "--exported" in sys.argv else None
PORT = int(os.environ.get("NET_SPIKE_PORT", "7795"))
SERVER_SECONDS = 26.0
PROCESS_TIMEOUT = 70.0
WALK_SPEED = 3.2

checks = []


def check(ok, name, details=None):
    checks.append((bool(ok), name, details))
    print(("PASS " if ok else "FAIL ") + name + ("" if ok or details is None else "  " + json.dumps(details)))


def launch(args, log, rendered=False):
    if EXPORTED:
        role = "server" if "--server" in args else "client"
        binary = os.path.join(EXPORTED, "linux-%s" % role, "ashen-wilds-%s.x86_64" % role)
        if rendered:
            cmd = ["xvfb-run", "-a", "-s", "-screen 0 1280x800x24", binary, "--rendering-driver", "vulkan", "--resolution", "1280x800", "--"] + args
        else:
            cmd = [binary, "--headless", "--"] + args
    elif rendered:
        cmd = ["xvfb-run", "-a", "-s", "-screen 0 1280x800x24", GODOT, "--path", ".", "--rendering-driver", "vulkan",
               "--resolution", "1280x800", "net_main.tscn", "--"] + args
    else:
        cmd = [GODOT, "--headless", "--path", ".", "net_main.tscn", "--"] + args
    return subprocess.Popen(cmd, stdout=open(log, "w"), stderr=subprocess.STDOUT)


def load(path):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return None


def vec(a):
    return tuple(float(x) for x in a)


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def length(v):
    return math.sqrt(sum(x * x for x in v))


def unit(v):
    n = length(v)
    return tuple(x / n for x in v) if n > 1e-9 else (0.0, 0.0, 0.0)


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def screen_up(yaw_degrees):
    """World direction of 'screen up' for the rig at this yaw: (0,0,-1) rotated about +Y."""
    r = math.radians(yaw_degrees)
    return (-math.sin(r), 0.0, -math.cos(r))


def sample(report, label):
    for s in report.get("samples", []):
        if s["label"] == label:
            return s
    return None


def main():
    if EXPORTED:
        for role in ("server", "client"):
            b = os.path.join(EXPORTED, "linux-%s" % role, "ashen-wilds-%s.x86_64" % role)
            if not os.access(b, os.X_OK):
                print("exported binary missing or not executable: %s" % b)
                return 2
        print("running the EXPORTED binaries from", EXPORTED)
    elif not os.path.exists(GODOT):
        print("Godot binary not found at %s (set GODOT)" % GODOT)
        return 2
    keep = "--keep" in sys.argv
    shots = sys.argv[sys.argv.index("--shots") + 1] if "--shots" in sys.argv else None
    if shots:
        os.makedirs(shots, exist_ok=True)
    out = tempfile.mkdtemp(prefix="net-spike-")
    print("reports in", out)
    rep = lambda name: os.path.join(out, name + ".json")
    log = lambda name: os.path.join(out, name + ".log")
    procs = {}
    t0 = time.time()
    # With --shots the server admits a third, rendered client (a development setting, §85).
    save = os.path.join(out, "world.json")
    procs["server"] = launch(["--server", "--port", str(PORT), "--max-players", "3" if shots else "2", "--quit-after", str(SERVER_SECONDS), "--save", save, "--report", rep("server")], log("server"))
    time.sleep(1.0)
    common = ["--client", "--host", "127.0.0.1", "--port", str(PORT)]
    if shots:
        # Real rendering under Xvfb takes several seconds to start, so it goes first and photographs A and B.
        procs["SHOTS"] = launch(common + ["--player-key", "camera", "--drive", "SHOTS", "--shots", os.path.abspath(shots), "--report", rep("SHOTS")], log("SHOTS"), rendered=True)
    procs["A"] = launch(common + ["--player-key", "alpha", "--drive", "A", "--report", rep("A")], log("A"))
    procs["B"] = launch(common + ["--player-key", "bravo", "--drive", "B", "--report", rep("B")], log("B"))
    time.sleep(6.0)
    procs["MISMATCH"] = launch(common + ["--player-key", "late", "--drive", "MISMATCH", "--protocol", "999", "--quit-after", "4", "--report", rep("MISMATCH")], log("MISMATCH"))
    time.sleep(1.5)
    procs["B2"] = launch(common + ["--player-key", "bravo", "--drive", "B2", "--report", rep("B2")], log("B2"))

    deadline = t0 + PROCESS_TIMEOUT
    for name, p in procs.items():
        try:
            p.wait(timeout=max(0.1, deadline - time.time()))
        except subprocess.TimeoutExpired:
            p.kill()
            check(False, "%s process finished on its own" % name)

    server, A, B, B2, MM = (load(rep(n)) for n in ("server", "A", "B", "B2", "MISMATCH"))

    # --- startup and connection (criteria 1, 2; matrix A, B)
    check(server and server.get("started") and server.get("headless"), "server ran headless and wrote its report")
    check(A and B and A["connection_state"] in ("playing", "disconnected") and B["connection_state"] in ("playing", "disconnected"), "both clients were welcomed and spawned",
          {"A": A and A["connection_state"], "B": B and B["connection_state"]})
    check(A and B and A["peer_id"] != B["peer_id"] and A["peer_id"] > 1 and B["peer_id"] > 1, "clients hold distinct connection ids")
    check(MM and MM["rejected_reason"] == "PROTOCOL_MISMATCH", "a client with another protocol version is rejected with a clear reason", MM and MM.get("rejected_reason"))
    check(server and server["rejections"].get("NO_PLAYER", 0) >= 1, "an input sent before hello is rejected as NO_PLAYER", server and server["rejections"])

    # --- movement and camera-relative intent (criteria 3, 4; matrix C)
    if A:
        s0, s1, s2, s3 = (sample(A, l) for l in ("move1_start", "move1_end", "move2_start", "move2_end"))
        if all((s0, s1, s2, s3)):
            d1 = sub(vec(s1["position"]), vec(s0["position"]))
            d2 = sub(vec(s3["position"]), vec(s2["position"]))
            check(dot(unit(d1), screen_up(s0["camera_yaw"])) > 0.97 and 1.5 * WALK_SPEED * 0.8 < length(d1) < 1.5 * WALK_SPEED * 1.2,
                  "A's first walk follows screen-up at the initial view (45°) for about 4.8 m", {"moved": d1, "yaw": s0["camera_yaw"]})
            check(abs(s2["camera_yaw"] - 135.0) < 1.0 and s2["view"] == 1, "A's quarter turn settled at 135° (view 1) before the second walk", {"yaw": s2["camera_yaw"], "view": s2["view"]})
            check(dot(unit(d2), screen_up(135.0)) > 0.97, "A's second walk follows screen-up at the turned view: the intent is camera-relative", {"moved": d2})
        else:
            check(False, "A produced all four movement samples", [s and s["label"] for s in (s0, s1, s2, s3)])
    if B:
        b0, b1 = sample(B, "move1_start"), sample(B, "move1_end")
        if b0 and b1:
            check(abs(b1["camera_yaw"] - 45.0) < 0.5, "B's camera stayed at 45° while A turned: cameras are independent", b1["camera_yaw"])
    # Authority agreement: the server's final record equals each client's own last sample.
    if server and A and B:
        a_exit, b_exit = sample(A, "exit"), sample(B, "exit")
        srv_a = server["records"].get("alpha", {}).get("position")
        check(a_exit and srv_a and length(sub(vec(a_exit["position"]), vec(srv_a))) < 0.3, "A's own predicted position matches the server's authoritative one", {"client": a_exit and a_exit["position"], "server": srv_a})
        check(float(A["stats"]["max_correction"]) < 0.5, "A's prediction corrections stayed small (max %.2f m)" % float(A["stats"]["max_correction"]))
        # Shared presence: B saw A at a position near where A was at that time (A's move1_end ~ B's final).
        # B looks at A at B's t=3.0, while A stands still between its walks (A's t=2.5 to 3.5).
        b_look = sample(B, "see_A")
        seen = b_look and next((p for p in b_look["players_seen"] if p["player_key"] == "alpha"), None)
        a_then = sample(A, "move1_end")
        check(seen and a_then and length(sub(vec(seen["position"]), vec(a_then["position"]))) < 0.5, "B saw A move through the same courtyard (B's view of A within 0.5 m of where A stood)", {"B_saw": seen and seen["position"], "A_was": a_then and a_then["position"]})

    # --- disconnect and rejoin (criteria 8, 9; matrix B)
    if server and A and B and B2:
        a_final = sample(A, "final")
        still_sees_b = a_final and any(p["player_key"] == "bravo" and p["peer_id"] == B["peer_id"] for p in a_final["players_seen"])
        check(a_final and not still_sees_b, "after B disconnects, A no longer sees B's avatar (rule R1: avatar removed, record kept)")
        check(any(e["event"] == "player_left" for e in A["events"]), "A received an explicit player_left event")
        check(any(d["player_key"] == "bravo" and d["retained"] for d in server["disconnects"]), "the server retained B's record on disconnect")
        b_exit = sample(B, "exit")
        check(B2["connection_state"] in ("playing", "disconnected") and B2["peer_id"] != B["peer_id"], "B rejoined under a new connection id with the same player key")
        check(b_exit and length(sub(vec(B2["spawn_position"]), vec(b_exit["position"]))) < 0.5, "the rejoin spawned at B's last authoritative position", {"B_left_at": b_exit and b_exit["position"], "B2_spawned": B2["spawn_position"]})
        check(server["rejoins"] == 1, "the server counted exactly one rejoin", server["rejoins"])
        check(server["records"].keys() >= {"alpha", "bravo"} and "late" not in server["records"], "records exist for alpha and bravo only; the rejected client left none")

    if shots:
        S = load(rep("SHOTS"))
        written = [e for e in (S or {}).get("events", []) if e["event"] == "screenshot" and e.get("ok")]
        check(S and S["connection_state"] in ("playing", "disconnected") and len(written) == 8, "the SHOTS client rendered and saved eight images: four views, two zoom limits, the open crate window, the refuge (look at them)", {"written": [os.path.basename(e["path"]) for e in written]})

    # --- shared container and item transfer (brief §17, §62 criteria 5 and 6; matrix D)
    if server and A and B and B2:
        crate = server["containers"].get("courtyard/supply-crate", {})
        seeded = {"timber": 6, "salt": 4, "iron_scrap": 8, "lamp_oil": 1, "clean_rag_bandage": 3, "cooking_pot": 1, "wooden_targe": 1}

        def totals(stacks):
            out = {}
            for s in stacks:
                out[s[1]] = out.get(s[1], 0) + int(s[2])
            return out

        def req(report, label_item, kind="take", repeat=None):
            return [r for r in report["requests"] if r["kind"] == kind and (r.get("item_id") == label_item or r.get("object_id") == label_item) and (repeat is None or bool(r.get("repeat")) == repeat)]

        check(A["container_views"].get("courtyard/supply-crate") and B["container_views"].get("courtyard/supply-crate"), "both clients received the crate's contents on joining (initial world sync)")
        a_oil = req(A, "lamp_oil", repeat=False)
        b_oil = req(B, "lamp_oil")
        oil_ok = [r for r in a_oil + b_oil if r["ok"]]
        oil_lost = [r for r in a_oil + b_oil if not r["ok"]]
        check(len(a_oil) == 1 and len(b_oil) == 1 and len(oil_ok) == 1 and len(oil_lost) == 1 and oil_lost[0]["code"] == "STATE_CHANGED", "the single flask of lamp oil went to exactly one of two simultaneous takers; the other was told STATE_CHANGED", {"A": [r["code"] for r in a_oil], "B": [r["code"] for r in b_oil]})
        a_repeat = req(A, "lamp_oil", repeat=True)
        check(len(a_repeat) == 1 and a_repeat[0]["ok"] == a_oil[0]["ok"] and a_repeat[0]["code"] == a_oil[0]["code"] and a_repeat[0]["data"] == a_oil[0]["data"], "a repeated request id got the identical first answer", {"first": a_oil and a_oil[0]["code"], "repeat": a_repeat and a_repeat[0]["code"]})
        zero = [r for r in A["requests"] if r["kind"] == "take" and r["quantity"] == 0]
        check(zero and zero[0]["code"] == "INVALID_REQUEST", "a take of quantity 0 is INVALID_REQUEST", zero and zero[0]["code"])
        nowhere = req(B, "nowhere/none")
        check(nowhere and nowhere[0]["code"] == "OBJECT_UNAVAILABLE", "a take from an unknown container is OBJECT_UNAVAILABLE", nowhere and nowhere[0]["code"])
        pot, targe, timber_a, scrap = (req(A, i) for i in ("cooking_pot", "wooden_targe", "timber", "iron_scrap"))
        timber_a = [r for r in timber_a if r["quantity"] == 4]
        check(pot and pot[0]["ok"] and targe and targe[0]["ok"] and timber_a and timber_a[0]["ok"], "A took the pot, the targe and four timber (14 kg, under the 18 kg hard limit)", {"pot": pot and pot[0]["code"], "targe": targe and targe[0]["code"], "timber": timber_a and timber_a[0]["code"]})
        check(scrap and scrap[0]["code"] == "CAPACITY_EXCEEDED", "eight iron scrap more would pass the hard limit: CAPACITY_EXCEEDED, nothing moved", scrap and scrap[0]["code"])
        far = req(A, "salt")
        check(far and far[0]["code"] == "OUT_OF_RANGE", "a take from 4 m away is OUT_OF_RANGE", far and far[0]["code"])
        timber_b = req(B, "timber")
        check(timber_b and timber_b[0]["ok"], "B took two timber", timber_b and timber_b[0]["code"])
        # Storing back (Milestone 1c): the reverse transfer through the same pipeline.
        stored = [r for r in A["requests"] if r["kind"] == "store" and r["item_id"] == "timber" and r["quantity"] == 2]
        check(stored and stored[0]["ok"], "A stored two timber back into the crate", stored and stored[0]["code"])
        none_held = [r for r in A["requests"] if r["kind"] == "store" and r["item_id"] == "salt"]
        check(none_held and none_held[0]["code"] == "STATE_CHANGED", "storing 99 salt A does not hold is STATE_CHANGED, nothing moved", none_held and none_held[0]["code"])
        unknown = [r for r in A["requests"] if r["kind"] == "store" and r["item_id"] == "dragon_egg"]
        check(unknown and unknown[0]["code"] == "INVALID_REQUEST", "storing an item id the game does not define is INVALID_REQUEST", unknown and unknown[0]["code"])
        store_far = [r for r in A["requests"] if r["kind"] == "store" and r["item_id"] == "timber" and r["quantity"] == 1]
        check(store_far and store_far[0]["code"] == "OUT_OF_RANGE", "a store from 4 m away is OUT_OF_RANGE", store_far and store_far[0]["code"])
        crate_timber = totals(crate.get("stacks", [])).get("timber", 0)
        a_timber = totals(server["packs"].get("alpha", {}).get("stacks", [])).get("timber", 0)
        check(crate_timber == 2 and a_timber == 0, "after 6 − 4 (A) − 2 (B) + 2 (A stores) the crate holds 2 timber, and A spent its last 2 on the breach", {"crate": crate_timber, "A": a_timber})
        b_view = B["container_views"].get("courtyard/supply-crate", {})
        check(totals(b_view.get("stacks", [])).get("timber", 0) == 2 or B["connection_state"] != "playing", "B saw the crate refilled by A's store before leaving", totals(b_view.get("stacks", [])))
        # Conservation: seeded == crate + every pack the server knows (live or retained) + what the
        # fixtures consumed (breach 2 timber, hearth 1 timber, when done), item by item.
        held = totals(crate.get("stacks", []))
        for key, pack in server["packs"].items():
            for item, n in totals(pack["stacks"]).items():
                held[item] = held.get(item, 0) + n
        fx = server.get("fixtures", {})
        consumed = (2 if fx.get("courtyard/breach", {}).get("done") else 0) + (1 if fx.get("courtyard/hearth", {}).get("done") else 0)
        held["timber"] = held.get("timber", 0) + consumed
        check(held == seeded, "every seeded item is accounted for across the crate, all packs and the fixtures' consumption (no duplication, no loss)", {"seeded": seeded, "held": held, "consumed_timber": consumed})
        a_pack = totals(A["pack_view"]["stacks"])
        srv_a = totals(server["packs"].get("alpha", {}).get("stacks", []))
        check(a_pack == srv_a and abs(float(A["pack_view"]["weight"]) - float(server["packs"].get("alpha", {}).get("weight", -1))) < 0.01, "A's pack view equals the server's pack for A, weight included", {"client": a_pack, "server": srv_a})
        # B's parting take: applied before the disconnect, or rejected; either way accounted for above.
        b_salt_server = totals(server["packs"].get("bravo", {}).get("stacks", [])).get("salt", 0)
        b_salt_req = req(B, "salt")
        check(b_salt_server in (0, 1) and (not b_salt_req or b_salt_req[0]["ok"] == (b_salt_server == 1) or not b_salt_req[0].get("done_t")), "B's take in the instant of leaving was either applied once or not at all", {"server_salt": b_salt_server, "B_answer": b_salt_req and b_salt_req[0]["code"]})
        check(totals(B2["pack_view"]["stacks"]) == totals(server["packs"].get("bravo", {}).get("stacks", [])) and totals(B2["pack_view"]["stacks"]).get("timber", 0) == 1, "the rejoin received B's pack back from the server's record (1 timber after lighting the hearth)", {"B2": totals(B2["pack_view"]["stacks"])})
        a_view = A["container_views"].get("courtyard/supply-crate", {})
        check(a_view.get("version") == crate.get("version") and totals(a_view.get("stacks", [])) == totals(crate.get("stacks", [])), "A's final view of the crate matches the server's (version and contents)", {"client_v": a_view.get("version"), "server_v": crate.get("version")})
        check(not A["pending_at_exit"], "A had no unanswered requests at exit", A["pending_at_exit"])

    # --- Milestone 3: repair and hearth (brief §62 criterion 7; matrix E)
    if server and A and B and B2:
        def uses(report, object_id):
            return [r for r in report["requests"] if r["kind"] == "use" and r["object_id"] == object_id]
        b_light, b_rep = uses(B, "courtyard/hearth"), uses(B, "courtyard/breach")
        check(b_light and b_light[0]["ok"], "B lit the hearth with one timber", b_light and b_light[0]["code"])
        check(b_rep and b_rep[0]["code"] == "INSUFFICIENT_RESOURCES", "B, left with one timber, cannot repair the breach (needs two): INSUFFICIENT_RESOURCES", b_rep and b_rep[0]["code"])
        b_gap = sample(B, "through_gap")
        check(b_gap and b_gap["position"][2] > 7.0, "before the repair, the breach is open: B walked through it (z %.2f > 7)" % (b_gap["position"][2] if b_gap else -99), b_gap and b_gap["position"])
        a_light, a_rep = uses(A, "courtyard/hearth"), uses(A, "courtyard/breach")
        check(a_light and a_light[0]["code"] == "STATE_CHANGED", "lighting an already lit hearth is STATE_CHANGED", a_light and a_light[0]["code"])
        check(a_rep and a_rep[0]["ok"], "A repaired the breach with two timber", a_rep and a_rep[0]["code"])
        a_gap = sample(A, "after_gap")
        check(a_gap and a_gap["position"][2] < 6.2, "after the repair, the barricade blocks: A walking at the gap stopped at z %.2f (< 6.2)" % (a_gap["position"][2] if a_gap else 99), a_gap and a_gap["position"])
        fx = server.get("fixtures", {})
        check(fx.get("courtyard/breach", {}).get("done_by") == "alpha" and fx.get("courtyard/hearth", {}).get("done_by") == "bravo", "the server records who repaired and who lit", fx)
        b2_fx = [e for e in B2["events"] if e["event"] == "fixture_state" and e["object_id"] == "courtyard/breach"]
        check(len(b2_fx) >= 2 and b2_fx[0]["done"] is False and b2_fx[-1]["done"] is True, "B2 joined with the breach open and received the repair live, from the other player's action", [(e["t"], e["done"]) for e in b2_fx])
        check(B2["fixture_views"].get("courtyard/hearth", {}).get("done") is True and B2["fixture_views"].get("courtyard/breach", {}).get("done") is True, "B2's final view: hearth lit, breach repaired", B2["fixture_views"])
        sv = server.get("save", {})
        check(sv.get("info", {}).get("loaded") == "NEW_WORLD" and int(sv.get("info", {}).get("saves_written", 0)) >= 3 and int(sv.get("info", {}).get("save_failures", 1)) == 0, "the server started a new world and saved it (%s saves, 0 failures)" % sv.get("info", {}).get("saves_written"), sv.get("info"))

    # --- Milestone 3: restart recovery (brief §62 criterion 10; matrix G)
    saved = load(save)
    check(saved and saved.get("schema") == 1 and set(saved.get("players", {})) >= {"alpha", "bravo"}, "the save file exists, schema 1, with both players", saved and {k: saved[k] for k in ("schema", "world_id", "save_seq")})
    if saved and server:
        procs2 = {"server2": launch(["--server", "--port", str(PORT), "--quit-after", "8", "--save", save, "--report", rep("server2")], log("server2"))}
        time.sleep(1.5)
        procs2["R"] = launch(common + ["--player-key", "alpha", "--drive", "R", "--report", rep("R")], log("R"))
        for name, p in procs2.items():
            try:
                p.wait(timeout=30)
            except subprocess.TimeoutExpired:
                p.kill()
                check(False, "%s process finished on its own" % name)
        s2, R = load(rep("server2")), load(rep("R"))
        check(s2 and s2["save"]["info"]["loaded"] == "LOADED" and s2["save"]["world_id"] == saved["world_id"], "the restarted server loaded the same world (%s)" % (s2 and s2["save"]["world_id"]), s2 and s2["save"]["info"])
        if R:
            alpha_rec = saved["players"]["alpha"]
            check(length(sub(vec(R["spawn_position"]), vec(alpha_rec["position"]))) < 0.05, "alpha rejoined the restarted server where the save left them", {"save": alpha_rec["position"], "spawn": R["spawn_position"]})
            check(totals(R["pack_view"]["stacks"]) == totals(alpha_rec["pack"]), "alpha's pack came back across the restart", {"save": totals(alpha_rec["pack"]), "rejoin": totals(R["pack_view"]["stacks"])})
            rv = R["container_views"].get("courtyard/supply-crate", {})
            sc = saved["containers"]["courtyard/supply-crate"]
            check(totals(rv.get("stacks", [])) == totals(sc["stacks"]) and rv.get("version") == sc["version"] and [st[0] for st in rv.get("stacks", [])] == [st[0] for st in sc["stacks"]], "the crate came back with the same contents, version and stack ids", {"save_v": sc["version"], "view_v": rv.get("version")})
            check(R["fixture_views"].get("courtyard/breach", {}).get("done") is True and R["fixture_views"].get("courtyard/hearth", {}).get("done") is True, "the repaired breach and the lit hearth came back across the restart", R["fixture_views"])

    # --- Milestone 3: save failure policy (brief §18, appendix §88; matrix G)
    if saved:
        def server_only(tag, extra=()):
            p = launch(["--server", "--port", str(PORT), "--quit-after", "1.5", "--save", save, "--report", rep(tag)] + list(extra), log(tag))
            try:
                p.wait(timeout=30)
            except subprocess.TimeoutExpired:
                p.kill()
            return p.returncode, load(rep(tag))
        def read(path):
            with open(path, "rb") as f:
                return f.read()
        world_id = saved["world_id"]
        # a. corrupt primary, valid backup -> backup loaded, bad file kept aside, primary rewritten
        with open(save, "w") as f:
            f.write("{ this is not json")
        code, r = server_only("server_backup")
        aside = r and r["save"]["info"]["moved_aside"]
        check(code == 0 and r and r["save"]["info"]["loaded"] == "LOADED_BACKUP" and r["save"]["world_id"] == world_id, "a corrupt primary falls back to the backup of the same world", r and r["save"]["info"])
        check(aside and os.path.exists(aside[0]) and read(aside[0]) == b"{ this is not json", "the corrupt file is kept aside, not deleted (%s)" % (aside and os.path.basename(aside[0])), aside)
        fixed = load(save)
        check(fixed and fixed.get("world_id") == world_id, "after the backup load the primary is a valid save again", fixed and fixed.get("save_seq"))
        # b. a save from a newer build is refused and never overwritten
        newer = dict(fixed or {})
        newer["schema"] = 99
        with open(save, "w") as f:
            json.dump(newer, f)
        before = read(save)
        code, r = server_only("server_newer")
        check(code == 4 and r and r["save"]["info"]["loaded"] == "SAVE_SCHEMA_NEWER" and not r["started"], "a save from a newer build stops the server with exit code 4 (got %s)" % code, r and r["save"]["info"])
        check(read(save) == before, "the newer save is byte-for-byte untouched")
        # c. primary and backup both unusable -> refuse, files untouched
        with open(save, "w") as f:
            f.write("garbage")
        with open(save + ".bak", "w") as f:
            f.write("also garbage")
        code, r = server_only("server_unreadable")
        check(code == 3 and r and r["save"]["info"]["loaded"] == "SAVE_UNREADABLE" and read(save) == b"garbage" and read(save + ".bak") == b"also garbage", "with both files unusable the server refuses (exit 3) and touches neither (got %s)" % code, r and r["save"]["info"])
        # d. --reset-world: explicit, keeps the bad files aside, starts a new world
        code, r = server_only("server_reset", ["--reset-world"])
        moved = (r and r["save"]["info"]["moved_aside"]) or []
        fresh = load(save)
        check(code == 0 and r and r["save"]["info"]["loaded"] == "RESET_NEW_WORLD" and len(moved) == 2 and all(os.path.exists(m) for m in moved) and fresh and fresh["world_id"] != world_id, "--reset-world moves both bad files aside and starts a new world", {"moved": [os.path.basename(m) for m in moved], "new": fresh and fresh.get("world_id")})
        # e. a server killed outright (SIGKILL: no shutdown save) keeps every change older than the
        #    one-second save window: a take made 3 s before the kill survives the restart.
        crash = launch(["--server", "--port", str(PORT), "--quit-after", "30", "--save", save, "--report", rep("server_crash")], log("server_crash"))
        time.sleep(1.5)
        victim = launch(common + ["--player-key", "crashy", "--drive", "CRASH", "--report", rep("CRASH")], log("CRASH"))
        time.sleep(4.0)
        crash.kill()
        crash.wait(timeout=10)
        try:
            victim.wait(timeout=15)
        except subprocess.TimeoutExpired:
            victim.kill()
        took = [x for x in (load(rep("CRASH")) or {}).get("requests", []) if x["kind"] == "take"]
        after = launch(["--server", "--port", str(PORT), "--quit-after", "6", "--save", save, "--report", rep("server_after")], log("server_after"))
        time.sleep(1.5)
        back = launch(common + ["--player-key", "crashy", "--drive", "R", "--report", rep("R_crash")], log("R_crash"))
        for p in (back, after):
            try:
                p.wait(timeout=30)
            except subprocess.TimeoutExpired:
                p.kill()
        sa, rc = load(rep("server_after")), load(rep("R_crash"))
        crate_after = rc and totals(rc["container_views"].get("courtyard/supply-crate", {}).get("stacks", [])).get("timber", 0)
        check(took and took[0]["ok"] and crash.returncode != 0, "the crash victim took one timber and the server was then killed outright (exit %s)" % crash.returncode, took and took[0]["code"])
        check(sa and sa["save"]["info"]["loaded"] == "LOADED" and rc and totals(rc["pack_view"]["stacks"]).get("timber", 0) == 1 and crate_after == 5, "after the kill and a restart, the take survived: the player has 1 timber, the crate 5", {"loaded": sa and sa["save"]["info"]["loaded"], "pack": rc and totals(rc["pack_view"]["stacks"]), "crate_timber": crate_after})

    failed = [c for c in checks if not c[0]]
    print("--- %d passed, %d failed ---" % (len(checks) - len(failed), len(failed)))
    if not keep and not failed:
        shutil.rmtree(out, ignore_errors=True)
    return len(failed)


if __name__ == "__main__":
    sys.exit(main())
