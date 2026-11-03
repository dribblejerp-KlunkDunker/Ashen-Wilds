class_name NetMain
extends Node
## Milestone 1a session (appendix §70): one process is the server, the others are clients, all
## running this scene. The server owns every avatar's position; clients send intent and draw.
##
## Every RPC of the spike lives on this node, so both sides share one protocol surface and no
## message can address a node the receiver has not created yet. Operation contracts are in
## docs/PRODUCTION.md (§73). Nothing beyond walking exists yet: no items, no saves, no combat.
##
## Run (from the project root, Godot 4.3-stable):
##   server:  godot --headless --path . net_main.tscn -- --server --port 7788
##   client:  godot --path . net_main.tscn -- --client --host 127.0.0.1 --port 7788 --player-key alice
## Test flags (--drive, --report, --quit-after, --shots) exist for tools/net_spike.py.

const PLAYER_COLORS: Array[Color] = [
	Color(0.55, 0.45, 0.3), Color(0.35, 0.45, 0.5), Color(0.5, 0.35, 0.35), Color(0.4, 0.5, 0.35),
]

# ---- configuration (parsed from the command line; §85 server, §86 client) ----
var role: String = "client"
var port: int = NetProtocol.DEFAULT_PORT
var max_players: int = NetProtocol.MAX_PLAYERS  # server development setting (§85); never a client preference
var host: String = "127.0.0.1"
var player_key: String = ""
var protocol_sent: int = NetProtocol.PROTOCOL_VERSION
var report_path: String = ""
var quit_after: float = 0.0
var drive: String = ""
var shots_dir: String = ""

# ---- scene ----
var players: Node3D
var courtyard: NetCourtyard
var camera_rig: IsoCameraRig
var hud: NetHud
var own: NetPlayer

# ---- server state ----
var records: Dictionary = {}        # player_key -> {position, facing, color}: survives disconnect (rule R1)
var live_by_peer: Dictionary = {}   # connection id -> player_key, live avatars only
var pending_hello: Dictionary = {}  # connection id -> deadline (session seconds)
var rejections: Dictionary = {}     # reject name -> count
var disconnect_log: Array = []
var rejoins: int = 0
var tick: int = 0
var next_color: int = 0

# ---- client state ----
var connection_state: String = "idle"
var own_peer_id: int = 0  # the connection id the server assigned; valid after welcome, survives close
var rejected_reason: String = ""
var seq: int = 0
var prediction: Array = []          # [{seq, pos}] positions predicted when each input was sent
var last_sent_dir: Vector3 = Vector3.ZERO
var zero_sends_left: int = 0
var held_yaw: float = 0.0
var was_moving: bool = false
var synthetic_input: Vector2 = Vector2.ZERO
var synthetic_active: bool = false
var samples: Array = []
var events: Array = []
var session_time: float = 0.0
var spawned_at: float = -1.0
var spawn_position: Vector3 = Vector3.ZERO
var stats: Dictionary = {"max_correction": 0.0, "states_received": 0, "inputs_sent": 0, "ping_ms": 0}
var _drive_done: Dictionary = {}
var _hud_tick: int = 0
var _quitting: bool = false


func _ready() -> void:
	_parse_args()
	_ensure_input_bindings()
	players = Node3D.new()
	players.name = "Players"
	add_child(players)
	courtyard = NetCourtyard.new()
	courtyard.name = "Courtyard"
	add_child(courtyard)
	multiplayer.peer_connected.connect(_on_peer_connected)
	multiplayer.peer_disconnected.connect(_on_peer_disconnected)
	multiplayer.connected_to_server.connect(_on_connected_to_server)
	multiplayer.connection_failed.connect(_on_connection_failed)
	multiplayer.server_disconnected.connect(_on_server_disconnected)
	if role == "server":
		_start_server()
	else:
		_start_client()


func _parse_args() -> void:
	var args: PackedStringArray = OS.get_cmdline_user_args()
	var i: int = 0
	while i < args.size():
		var a: String = args[i]
		var next: String = args[i + 1] if i + 1 < args.size() else ""
		match a:
			"--server": role = "server"
			"--client": role = "client"
			"--port": port = int(next); i += 1
			"--max-players": max_players = clampi(int(next), 1, 8); i += 1
			"--host": host = next; i += 1
			"--player-key": player_key = next; i += 1
			"--protocol": protocol_sent = int(next); i += 1
			"--report": report_path = next; i += 1
			"--quit-after": quit_after = float(next); i += 1
			"--drive": drive = next; i += 1
			"--shots": shots_dir = next; i += 1
			_: push_warning("Unknown argument: %s" % a)
		i += 1
	if role == "client" and player_key.is_empty():
		player_key = "dev-%d" % (randi() % 100000)


func _ensure_input_bindings() -> void:
	_bind_key("move_up", KEY_W); _bind_key("move_up", KEY_UP)
	_bind_key("move_down", KEY_S); _bind_key("move_down", KEY_DOWN)
	_bind_key("move_left", KEY_A); _bind_key("move_left", KEY_LEFT)
	_bind_key("move_right", KEY_D); _bind_key("move_right", KEY_RIGHT)
	_bind_key("camera_rotate_left", KEY_Q)
	_bind_key("camera_rotate_right", KEY_E)
	_bind_key("camera_recenter", KEY_C)


func _bind_key(action: String, key: Key) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
	for existing: InputEvent in InputMap.action_get_events(action):
		if existing is InputEventKey and (existing as InputEventKey).physical_keycode == key:
			return
	var ev := InputEventKey.new()
	ev.physical_keycode = key
	InputMap.action_add_event(action, ev)


# ---------------------------------------------------------------- lifecycle (§43)

func _start_server() -> void:
	var peer := ENetMultiplayerPeer.new()
	var err: Error = peer.create_server(port, 32)
	if err != OK:
		_fatal("SERVER_BIND_FAILED: port %d (%s)" % [port, error_string(err)])
		return
	multiplayer.multiplayer_peer = peer
	connection_state = "listening"
	_log("server listening on %d, build %s, protocol %d, max players %d, headless=%s" % [
		port, NetProtocol.BUILD_ID, NetProtocol.PROTOCOL_VERSION, max_players, str(_is_headless())])


func _start_client() -> void:
	camera_rig = IsoCameraRig.new()
	camera_rig.name = "CameraRig"
	add_child(camera_rig)
	hud = NetHud.new()
	add_child(hud)
	var peer := ENetMultiplayerPeer.new()
	var err: Error = peer.create_client(host, port)
	if err != OK:
		_fatal("CLIENT_CREATE_FAILED: %s:%d (%s)" % [host, port, error_string(err)])
		return
	multiplayer.multiplayer_peer = peer
	connection_state = "connecting"
	hud.set_message("Connecting to %s:%d…" % [host, port])


func _on_peer_connected(id: int) -> void:
	if role == "server":
		pending_hello[id] = session_time + NetProtocol.HELLO_TIMEOUT_SECONDS
		_log("peer %d connected, awaiting hello" % id)


func _on_peer_disconnected(id: int) -> void:
	if not role == "server":
		return
	pending_hello.erase(id)
	if live_by_peer.has(id):
		var key: String = live_by_peer[id]
		var p: NetPlayer = _player_node(id)
		if p:
			# Rule R1 (temporary): the avatar leaves at once, the record stays for a rejoin.
			records[key] = {"position": p.position, "facing": p.facing_yaw, "color": records[key]["color"]}
		live_by_peer.erase(id)
		disconnect_log.append({"peer_id": id, "player_key": key, "t": session_time, "retained": true})
		_despawn_local(id)
		despawn_player.rpc(id)
		_log("peer %d (%s) disconnected; record retained" % [id, key])


func _on_connected_to_server() -> void:
	connection_state = "handshaking"
	_event("connected")
	if drive == "MISMATCH":
		# Negative test: an input before any hello must be rejected as NO_PLAYER.
		submit_input.rpc_id(1, 1, Vector3(1.0, 0.0, 0.0))
	hello.rpc_id(1, protocol_sent, player_key)


func _on_connection_failed() -> void:
	connection_state = "failed"
	_event("connection_failed")
	hud.set_message("Could not reach %s:%d." % [host, port])
	_finish_client()


func _on_server_disconnected() -> void:
	if role == "server" or _quitting:
		return  # the server closing its own peer, or a client already on its way out
	if connection_state != "rejected":
		connection_state = "disconnected"
		if hud:
			hud.set_message("Lost the server.")
	_event("server_disconnected")
	for child: Node in players.get_children():
		child.queue_free()
	own = null
	if not drive.is_empty():
		_finish_client()


# ---------------------------------------------------------------- RPCs: join

## Client -> server. The server derives identity from the sender, never from the payload (§74).
@rpc("any_peer", "call_remote", "reliable")
func hello(protocol: int, key: String) -> void:
	if not role == "server":
		return
	var id: int = multiplayer.get_remote_sender_id()
	pending_hello.erase(id)
	var reason: int = NetProtocol.Reject.NONE
	if protocol != NetProtocol.PROTOCOL_VERSION:
		reason = NetProtocol.Reject.PROTOCOL_MISMATCH
	elif live_by_peer.size() >= max_players:
		reason = NetProtocol.Reject.SERVER_FULL
	elif not NetProtocol.valid_player_key(key):
		reason = NetProtocol.Reject.BAD_KEY
	elif live_by_peer.values().has(key):
		reason = NetProtocol.Reject.KEY_IN_USE
	if reason != NetProtocol.Reject.NONE:
		_reject(id, reason)
		return
	var pos: Vector3
	var yaw: float = 0.0
	var color_index: int
	var is_rejoin: bool = records.has(key)
	if is_rejoin:
		pos = records[key]["position"]
		yaw = records[key]["facing"]
		color_index = records[key]["color"]
		rejoins += 1
	else:
		pos = courtyard.spawn_points[records.size() % courtyard.spawn_points.size()]
		color_index = next_color % PLAYER_COLORS.size()
		next_color += 1
		records[key] = {"position": pos, "facing": yaw, "color": color_index}
	# The newcomer learns about the world first, then everyone (newcomer included) about them.
	var existing: Array = []
	for pid: int in live_by_peer:
		var p: NetPlayer = _player_node(pid)
		existing.append([pid, p.player_key, p.position, p.facing_yaw, records[p.player_key]["color"]])
	welcome.rpc_id(id, id, existing, NetProtocol.BUILD_ID)
	live_by_peer[id] = key
	_spawn_local(id, key, pos, yaw, color_index)
	spawn_player.rpc(id, key, pos, yaw, color_index)
	_log("peer %d joined as %s at %s%s" % [id, key, str(pos), " (rejoin)" if is_rejoin else ""])


func _reject(id: int, reason: int) -> void:
	var name_: String = NetProtocol.reject_name(reason)
	rejections[name_] = int(rejections.get(name_, 0)) + 1
	_log("peer %d rejected: %s" % [id, name_])
	rejected.rpc_id(id, reason)
	await get_tree().create_timer(0.25).timeout
	if multiplayer.multiplayer_peer and multiplayer.get_peers().has(id):
		multiplayer.multiplayer_peer.disconnect_peer(id)


## Server -> joining client: the world as it stands. Normal play waits for the player's own spawn.
@rpc("authority", "call_remote", "reliable")
func welcome(assigned_id: int, existing: Array, build: String) -> void:
	connection_state = "welcomed"
	own_peer_id = assigned_id
	_event("welcome", {"peer_id": assigned_id, "server_build": build, "existing": existing.size()})
	for info: Array in existing:
		_spawn_local(info[0], info[1], info[2], info[3], info[4])


@rpc("authority", "call_remote", "reliable")
func rejected(reason: int) -> void:
	connection_state = "rejected"
	rejected_reason = NetProtocol.reject_name(reason)
	_event("rejected", {"reason": rejected_reason})
	hud.set_message(NetProtocol.reject_text(reason))


@rpc("authority", "call_remote", "reliable")
func spawn_player(id: int, key: String, pos: Vector3, yaw: float, color_index: int) -> void:
	_spawn_local(id, key, pos, yaw, color_index)


@rpc("authority", "call_remote", "reliable")
func despawn_player(id: int) -> void:
	var p: NetPlayer = _player_node(id)
	_event("player_left", {"peer_id": id, "player_key": p.player_key if p else ""})
	_despawn_local(id)
	if hud:
		hud.set_message("The other survivor has gone.")


# ---------------------------------------------------------------- RPCs: movement (§77)

## Client -> server: intent only. dir is world space, |dir| <= 1, no vertical part.
@rpc("any_peer", "call_remote", "unreliable_ordered")
func submit_input(input_seq: int, dir: Vector3) -> void:
	if not role == "server":
		return
	var id: int = multiplayer.get_remote_sender_id()
	if not live_by_peer.has(id):
		_count_reject(NetProtocol.Reject.NO_PLAYER)
		return
	var p: NetPlayer = _player_node(id)
	if p == null:
		_count_reject(NetProtocol.Reject.NO_PLAYER)
		return
	if not (is_finite(dir.x) and is_finite(dir.y) and is_finite(dir.z)) or dir.y != 0.0 or dir.length_squared() > 1.0001:
		_count_reject(NetProtocol.Reject.BAD_INPUT)
		return
	if input_seq <= p.last_seq:
		return  # stale or duplicate: unreliable channel, nothing to count
	if p.inputs_this_second >= NetProtocol.MAX_INPUTS_PER_SECOND:
		_count_reject(NetProtocol.Reject.RATE_LIMIT)
		return
	p.inputs_this_second += 1
	p.input_dir = dir
	p.last_seq = input_seq
	p.seconds_since_input = 0.0


## Server -> everyone: the authoritative pose, 30 times a second, unreliable.
@rpc("authority", "call_remote", "unreliable_ordered")
func player_state(id: int, pos: Vector3, yaw: float, acked_seq: int) -> void:
	var p: NetPlayer = _player_node(id)
	if p == null:
		return
	stats["states_received"] = int(stats["states_received"]) + 1
	if p == own:
		_reconcile(pos, acked_seq)
	else:
		p.target_position = pos
		p.target_yaw = yaw
		p.has_target = true


# ---------------------------------------------------------------- simulation

func _physics_process(delta: float) -> void:
	if _quitting or multiplayer.multiplayer_peer == null \
			or multiplayer.multiplayer_peer.get_connection_status() != MultiplayerPeer.CONNECTION_CONNECTED:
		return  # the peer is closed, closing or gone: nothing may be sent any more
	session_time += delta
	if role == "server":
		_server_tick(delta)
	else:
		_client_tick(delta)
	if quit_after > 0.0 and session_time >= quit_after and not _quitting:
		if role == "server":
			_finish_server()
		else:
			_finish_client()


func _server_tick(delta: float) -> void:
	tick += 1
	for id: int in pending_hello.keys():
		if session_time > float(pending_hello[id]):
			pending_hello.erase(id)
			_reject(id, NetProtocol.Reject.HELLO_TIMEOUT)
	for child: Node in players.get_children():
		var p := child as NetPlayer
		p.rate_window += delta
		if p.rate_window >= 1.0:
			p.rate_window = 0.0
			p.inputs_this_second = 0
		p.seconds_since_input += delta
		if p.seconds_since_input > NetProtocol.INPUT_DEADMAN_SECONDS:
			p.input_dir = Vector3.ZERO
		p.integrate(p.input_dir, delta)
	# State goes to live players only (never to a peer mid-handshake or being rejected).
	if tick % NetProtocol.STATE_SEND_EVERY_TICKS == 0 and not live_by_peer.is_empty():
		var connected: PackedInt32Array = multiplayer.get_peers()
		for child: Node in players.get_children():
			var p := child as NetPlayer
			for pid: int in live_by_peer:
				if connected.has(pid):
					player_state.rpc_id(pid, p.peer_id, p.position, p.facing_yaw, p.last_seq)


func _client_tick(delta: float) -> void:
	if not drive.is_empty():
		_drive(delta)
	if own:
		var screen_input: Vector2 = synthetic_input if synthetic_active else _read_input()
		var dir: Vector3 = _camera_relative(screen_input)
		own.integrate(dir, delta)
		var moving: bool = dir.length_squared() > 0.0001
		if moving or zero_sends_left > 0 or dir != last_sent_dir:
			seq += 1
			submit_input.rpc_id(1, seq, dir)
			stats["inputs_sent"] = int(stats["inputs_sent"]) + 1
			prediction.append({"seq": seq, "pos": own.position})
			if prediction.size() > 180:
				prediction.pop_front()
			zero_sends_left = 10 if not moving and last_sent_dir != Vector3.ZERO else maxi(0, zero_sends_left - 1)
			last_sent_dir = dir
	for child: Node in players.get_children():
		var p := child as NetPlayer
		if p != own and p.has_target:
			p.smooth_toward_target(delta)
	_hud_tick += 1
	if _hud_tick % 6 == 0:
		_update_hud()


func _read_input() -> Vector2:
	return Input.get_vector("move_left", "move_right", "move_up", "move_down")


## Camera-relative intent (§77): screen up is the camera's forward on the ground plane. While a
## key is held the basis is frozen at press time, so a quarter turn mid-walk does not swerve you.
func _camera_relative(v: Vector2) -> Vector3:
	if v.length_squared() < 0.0001:
		was_moving = false
		return Vector3.ZERO
	if not was_moving:
		held_yaw = camera_rig.yaw_degrees
		was_moving = true
	var d := Vector3(v.x, 0.0, v.y)
	if d.length_squared() > 1.0:
		d = d.normalized()
	return d.rotated(Vector3.UP, deg_to_rad(held_yaw))


## Prediction correction: the server's answer for input acked_seq against what we predicted then.
func _reconcile(server_pos: Vector3, acked_seq: int) -> void:
	var predicted: Vector3 = own.position
	var found: bool = false
	for entry: Dictionary in prediction:
		if int(entry["seq"]) == acked_seq:
			predicted = entry["pos"]
			found = true
			break
	while prediction.size() > 0 and int(prediction[0]["seq"]) <= acked_seq:
		prediction.pop_front()
	var error: Vector3 = server_pos - predicted
	error.y = 0.0
	var size: float = error.length()
	if size > float(stats["max_correction"]):
		stats["max_correction"] = size
	if not found or size > NetProtocol.SNAP_DISTANCE:
		own.position += error
	elif size > 0.001:
		own.position += error * NetProtocol.CORRECTION_RATE


# ---------------------------------------------------------------- spawning

func _spawn_local(id: int, key: String, pos: Vector3, yaw: float, color_index: int) -> void:
	if _player_node(id):
		return
	var p: NetPlayer = NetPlayer.create(id, key, pos, yaw, PLAYER_COLORS[color_index % PLAYER_COLORS.size()])
	players.add_child(p)
	if not role == "server" and id == own_peer_id:
		own = p
		camera_rig.target = p
		camera_rig.recenter()
		connection_state = "playing"
		spawned_at = session_time
		spawn_position = pos
		_event("spawned", {"position": _v(pos)})
		hud.set_message("")


func _despawn_local(id: int) -> void:
	var p: NetPlayer = _player_node(id)
	if p:
		players.remove_child(p)
		p.queue_free()


func _player_node(id: int) -> NetPlayer:
	return players.get_node_or_null(str(id)) as NetPlayer


# ---------------------------------------------------------------- test drive (tools/net_spike.py)

## Fixed timelines relative to the moment this client's own avatar spawned.
func _drive(_delta: float) -> void:
	if spawned_at < 0.0:
		return
	var t: float = session_time - spawned_at
	match drive:
		"A":
			_at(t, 0.5, "shot_initial", func() -> void: _shot("view0"))
			_at(t, 1.0, "move1_start", func() -> void: _push(Vector2(0.0, -1.0)))
			_at(t, 2.5, "move1_end", func() -> void: _push(Vector2.ZERO))
			_at(t, 2.6, "turn", func() -> void: camera_rig.rotate_quarter(1))
			_at(t, 3.0, "shot_turned", func() -> void: _shot("view1"))
			_at(t, 3.5, "move2_start", func() -> void: _push(Vector2(0.0, -1.0)))
			_at(t, 5.0, "move2_end", func() -> void: _push(Vector2.ZERO))
			_at(t, 14.0, "final", func() -> void: _finish_client())
		"B":
			_at(t, 1.0, "move1_start", func() -> void: _push(Vector2(1.0, 0.0)))
			_at(t, 2.0, "move1_end", func() -> void: _push(Vector2.ZERO))
			_at(t, 2.2, "shot_initial", func() -> void: _shot("view0"))
			_at(t, 4.0, "final", func() -> void: _finish_client())
		"B2":
			_at(t, 1.0, "final", func() -> void: _finish_client())
		"SHOTS":
			# Camera acceptance (appendix §78): every view, then the zoom limits. Stands still.
			_at(t, 0.6, "view0", func() -> void: _shot("view0"))
			_at(t, 0.7, "turn1", func() -> void: camera_rig.rotate_quarter(1))
			_at(t, 1.6, "view1", func() -> void: _shot("view1"))
			_at(t, 1.7, "turn2", func() -> void: camera_rig.rotate_quarter(1))
			_at(t, 2.6, "view2", func() -> void: _shot("view2"))
			_at(t, 2.7, "turn3", func() -> void: camera_rig.rotate_quarter(1))
			_at(t, 3.6, "view3", func() -> void: _shot("view3"))
			_at(t, 3.7, "turn4", func() -> void: camera_rig.rotate_quarter(1))
			_at(t, 4.6, "zoom_near_set", func() -> void: camera_rig.set_zoom(camera_rig.ortho_size_min))
			_at(t, 5.4, "zoom_near", func() -> void: _shot("zoom-near"))
			_at(t, 5.5, "zoom_far_set", func() -> void: camera_rig.set_zoom(camera_rig.ortho_size_max))
			_at(t, 6.3, "zoom_far", func() -> void: _shot("zoom-far"))
			_at(t, 6.8, "final", func() -> void: _finish_client())
		_:
			pass


func _at(t: float, when: float, label: String, action: Callable) -> void:
	if t >= when and not _drive_done.has(label):
		_drive_done[label] = true
		_sample(label)
		action.call()


func _push(v: Vector2) -> void:
	synthetic_input = v
	synthetic_active = true


func _sample(label: String) -> void:
	var seen: Array = []
	for child: Node in players.get_children():
		var p := child as NetPlayer
		seen.append({"peer_id": p.peer_id, "player_key": p.player_key, "position": _v(p.position)})
	samples.append({"label": label, "t": snappedf(session_time - spawned_at, 0.01), "position": _v(own.position),
		"camera_yaw": snappedf(camera_rig.yaw_degrees, 0.1), "view": camera_rig.view_index(), "players_seen": seen})


func _shot(label: String) -> void:
	if shots_dir.is_empty() or _is_headless():
		return
	await RenderingServer.frame_post_draw
	var img: Image = get_viewport().get_texture().get_image()
	var path: String = shots_dir.path_join("%s-%s.png" % [player_key, label])
	var err: Error = img.save_png(path)
	_event("screenshot", {"path": path, "ok": err == OK})


# ---------------------------------------------------------------- reporting (§24, §55)

func _update_hud() -> void:
	if hud == null:
		return
	var ping: int = 0
	var enet := multiplayer.multiplayer_peer as ENetMultiplayerPeer
	if enet and enet.get_connection_status() == MultiplayerPeer.CONNECTION_CONNECTED:
		var server_link: ENetPacketPeer = enet.get_peer(1)
		if server_link:
			ping = int(server_link.get_statistic(ENetPacketPeer.PEER_ROUND_TRIP_TIME))
	stats["ping_ms"] = ping
	var others: int = players.get_child_count() - (1 if own else 0)
	hud.set_lines(PackedStringArray([
		"%s · protocol %d" % [NetProtocol.BUILD_ID, NetProtocol.PROTOCOL_VERSION],
		"client peer %d · key %s" % [own_peer_id, player_key],
		"state %s · ping %d ms · others %d" % [connection_state, ping, others],
		"camera view %d (%.0f°) · Q/E turn · C recenter · wheel zoom" % [camera_rig.view_index(), camera_rig.yaw_degrees],
		"prediction max correction %.2f m" % float(stats["max_correction"]),
		("last rejection: " + rejected_reason) if not rejected_reason.is_empty() else "",
	]))


func _report() -> Dictionary:
	var out: Dictionary = {"role": role, "build": NetProtocol.BUILD_ID, "protocol": NetProtocol.PROTOCOL_VERSION,
		"headless": _is_headless(), "session_seconds": snappedf(session_time, 0.01)}
	if role == "server":
		var live: Array = []
		for child: Node in players.get_children():
			var p := child as NetPlayer
			live.append({"peer_id": p.peer_id, "player_key": p.player_key, "position": _v(p.position)})
		var recs: Dictionary = {}
		for key: String in records:
			recs[key] = {"position": _v(records[key]["position"]), "facing": records[key]["facing"]}
		out.merge({"started": true, "port": port, "max_players": max_players, "ticks": tick,
			"players_live_end": live, "records": recs, "disconnects": disconnect_log, "rejoins": rejoins, "rejections": rejections})
	else:
		out.merge({"peer_id": own_peer_id, "player_key": player_key,
			"drive": drive, "connection_state": connection_state, "rejected_reason": rejected_reason,
			"spawn_position": _v(spawn_position), "samples": samples, "events": events, "stats": stats})
	return out


func _write_report() -> void:
	if report_path.is_empty():
		return
	var f := FileAccess.open(report_path, FileAccess.WRITE)
	if f == null:
		push_error("report not written: %s" % report_path)
		return
	f.store_string(JSON.stringify(_report(), "  "))
	f.close()


func _finish_client() -> void:
	if _quitting:
		return
	_quitting = true
	if own:
		_sample("exit")
	_write_report()
	_drop_peer()
	get_tree().quit()


func _finish_server() -> void:
	_quitting = true
	_write_report()
	_log("server stopping after %.1fs, %d ticks" % [session_time, tick])
	_drop_peer()
	get_tree().quit()


## Close and detach the peer. Detaching matters: a closed peer left attached makes the engine's
## own teardown call get_unique_id() on an inactive instance and log an error.
func _drop_peer() -> void:
	if multiplayer.multiplayer_peer:
		multiplayer.multiplayer_peer.close()
	multiplayer.multiplayer_peer = null


func _fatal(message: String) -> void:
	push_error(message)
	events.append({"t": snappedf(session_time, 0.01), "event": "fatal", "message": message})
	connection_state = "fatal"
	_write_report()
	get_tree().quit(1)


func _count_reject(reason: int) -> void:
	var name_: String = NetProtocol.reject_name(reason)
	rejections[name_] = int(rejections.get(name_, 0)) + 1


func _event(kind: String, data: Dictionary = {}) -> void:
	var e: Dictionary = {"t": snappedf(session_time, 0.01), "event": kind}
	e.merge(data)
	events.append(e)
	_log("%s %s" % [kind, JSON.stringify(data) if not data.is_empty() else ""])


func _log(message: String) -> void:
	print("[%s %.2f] %s" % [role, session_time, message])


func _is_headless() -> bool:
	return DisplayServer.get_name() == "headless"


static func _v(v: Vector3) -> Array:
	return [snappedf(v.x, 0.001), snappedf(v.y, 0.001), snappedf(v.z, 0.001)]
