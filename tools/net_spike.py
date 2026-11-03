#!/usr/bin/env python3
"""Milestone 1a loopback test: one headless server and driven headless clients, as separate
Godot processes on this machine (appendix §56 A-C, brief §62 criteria 1-4, 8, 9).

This is a two-client LOCAL test. It says nothing about internet reliability (brief §8).

Scenario (times are approximate, each client's drive runs from its own spawn):
  t0      server starts, headless, quits after SERVER_SECONDS writing its report
  t0+1.0  A and B connect. A walks screen-up, turns its camera a quarter, walks screen-up again,
          then stays until t+9. B walks screen-right and leaves at t+4 (a clean disconnect).
  t0+7.0  MISMATCH connects with protocol 999 after sending one input before any hello.
  t0+8.0  B2 reconnects with B's player key and expects B's last position (rule R1).

Exit code is the number of failed checks. Set GODOT to the 4.3-stable binary, or put it at
~/godot/Godot_v4.3-stable_linux.x86_64. Run from the project root:  python3 tools/net_spike.py
Pass --keep to leave the report directory in place; its path is printed either way.
Pass --shots DIR to also run a SHOTS client with real rendering under Xvfb (Mesa's software
Vulkan), which saves every camera view and both zoom limits as PNGs into DIR (appendix §78).
Those images must be looked at by a person; the script only checks that they were written.
"""
import json, math, os, shutil, subprocess, sys, tempfile, time

GODOT = os.environ.get("GODOT", os.path.expanduser("~/godot/Godot_v4.3-stable_linux.x86_64"))
PORT = int(os.environ.get("NET_SPIKE_PORT", "7795"))
SERVER_SECONDS = 24.0
PROCESS_TIMEOUT = 60.0
WALK_SPEED = 3.2

checks = []


def check(ok, name, details=None):
    checks.append((bool(ok), name, details))
    print(("PASS " if ok else "FAIL ") + name + ("" if ok or details is None else "  " + json.dumps(details)))


def launch(args, log, rendered=False):
    if rendered:
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
    if not os.path.exists(GODOT):
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
    procs["server"] = launch(["--server", "--port", str(PORT), "--max-players", "3" if shots else "2", "--quit-after", str(SERVER_SECONDS), "--report", rep("server")], log("server"))
    time.sleep(1.0)
    common = ["--client", "--host", "127.0.0.1", "--port", str(PORT)]
    if shots:
        # Real rendering under Xvfb takes several seconds to start, so it goes first and photographs A and B.
        procs["SHOTS"] = launch(common + ["--player-key", "camera", "--drive", "SHOTS", "--shots", os.path.abspath(shots), "--report", rep("SHOTS")], log("SHOTS"), rendered=True)
    procs["A"] = launch(common + ["--player-key", "alpha", "--drive", "A", "--report", rep("A")], log("A"))
    procs["B"] = launch(common + ["--player-key", "bravo", "--drive", "B", "--report", rep("B")], log("B"))
    time.sleep(6.0)
    procs["MISMATCH"] = launch(common + ["--player-key", "late", "--drive", "MISMATCH", "--protocol", "999", "--quit-after", "4", "--report", rep("MISMATCH")], log("MISMATCH"))
    time.sleep(1.0)
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
        b_final = sample(B, "final")
        seen = b_final and next((p for p in b_final["players_seen"] if p["player_key"] == "alpha"), None)
        a_then = sample(A, "move2_start")
        check(seen and a_then and length(sub(vec(seen["position"]), vec(a_then["position"]))) < 1.5, "B saw A move through the same courtyard", {"B_saw": seen and seen["position"], "A_was": a_then and a_then["position"]})

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
        check(S and S["connection_state"] in ("playing", "disconnected") and len(written) == 6, "the SHOTS client rendered and saved six camera images (look at them)", {"written": [os.path.basename(e["path"]) for e in written]})

    failed = [c for c in checks if not c[0]]
    print("--- %d passed, %d failed ---" % (len(checks) - len(failed), len(failed)))
    if not keep and not failed:
        shutil.rmtree(out, ignore_errors=True)
    return len(failed)


if __name__ == "__main__":
    sys.exit(main())
