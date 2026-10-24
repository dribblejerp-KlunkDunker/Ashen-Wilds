extends SceneTree
# Visual benchmark: renders a fixed, repeatable set of shots for measuring the
# game's look against the owner's target (docs/VISUAL_DIRECTION.md and
# docs/art_reference/00_target_mockup.jpg). Score them with
# tools/visual_benchmark.py. Needs a real renderer:
#   xvfb-run -a -s "-screen 0 1920x1080x24" godot --path . --rendering-driver vulkan \
#     --script res://tools/visual_benchmark.gd -- --run=<name>
# Every shot is posed and frozen the same way each run, so differences between
# runs come from the art, not the staging. "_world" shots hide the HUD so the
# scorer sees only the world. The vision cone's charcoal overlay is turned off:
# the target mockup shows the whole room, and this measures the art, not fog.

const OUT_ROOT := "res://docs/benchmark/runs"

var _main: Node3D
var _player: PlayerController
var _rig: IsoCameraRig
var _hud: TacticalHUD
var _dn: DayNightCycle
var _out: String = ""

func _initialize() -> void:
	_run.call_deferred()

func _frames(n: int) -> void:
	for i in range(n):
		await process_frame

func _run_name() -> String:
	for a: String in OS.get_cmdline_user_args():
		if a.begins_with("--run="):
			return a.substr(6)
	return ""

func _shot(file_name: String) -> void:
	await RenderingServer.frame_post_draw
	var img: Image = root.get_texture().get_image()
	var path: String = "%s/%s" % [_out, file_name]
	var err: int = img.save_png(path)
	print("saved %s (%dx%d) err=%d" % [path, img.get_width(), img.get_height(), err])

## Two shots of the current pose: with the HUD, and the world alone (no HUD,
## no aim-arc marker: neither is world art).
func _pair(stem: String) -> void:
	_hud.visible = true
	_player._aim_arc_mesh.visible = true
	await _frames(3)
	await _shot("%s_ui.png" % stem)
	_hud.visible = false
	_player._aim_arc_mesh.visible = false
	await _frames(3)
	await _shot("%s_world.png" % stem)
	_hud.visible = true
	_player._aim_arc_mesh.visible = true

func _find(cls_check: Callable) -> Array:
	var out: Array = []
	for c: Node in _main.get_children():
		if cls_check.call(c):
			out.append(c)
	return out

func _place(pos: Vector3, aim: Vector3) -> void:
	_player.respawn_at_shelter(pos)
	_player._aim_direction = aim.normalized()
	_player._visual_root.look_at(pos + aim.normalized(), Vector3.UP)
	_rig.global_position = pos
	_hud.show_banner("", Color.WHITE)

func _equip(item_id: String) -> void:
	var inst: ItemInstance = _player.inventory.find_first(item_id)
	if inst == null:
		inst = ItemDatabase.make(item_id)
		_player.inventory.add(inst)
	_player.inventory.equip(inst)

func _pose(e: Node3D, pos: Vector3, face_toward: Vector3) -> void:
	e.global_position = pos
	var dir: Vector3 = face_toward - pos
	dir.y = 0.0
	if dir.length_squared() > 0.001:
		e.set("_facing_dir", dir.normalized())
		(e.get("_visual_root") as Node3D).look_at(pos + dir.normalized(), Vector3.UP)
	(e.get("_visual_root") as Node3D).visible = true

func _run() -> void:
	if _run_name() == "":
		push_error("visual_benchmark: give a run name, e.g. -- --run=001-lighting (runs sort by name; the last is the report's latest)")
		quit(1)
		return
	_out = "%s/%s" % [OUT_ROOT, _run_name()]
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(_out))
	_main = (load("res://main.tscn") as PackedScene).instantiate()
	_main.set("show_background_picker", false)
	_main.set("weather_cycle_enabled", false)
	_main.set("day_cycle_enabled", false)
	_main.set("survival_enabled", false)
	root.add_child(_main)
	await _frames(10)
	_player = _find(func(n: Node) -> bool: return n is PlayerController)[0]
	_rig = _find(func(n: Node) -> bool: return n is IsoCameraRig)[0]
	_hud = _find(func(n: Node) -> bool: return n is TacticalHUD)[0]
	_dn = _find(func(n: Node) -> bool: return n is DayNightCycle)[0]
	var enemies: Array = _find(func(n: Node) -> bool: return n.is_in_group("enemy"))
	for e: Node in enemies:
		e.process_mode = Node.PROCESS_MODE_DISABLED
		(e.get("_visual_root") as Node3D).visible = false
	for r: Node in get_nodes_in_group("crow_roost"):
		r.process_mode = Node.PROCESS_MODE_DISABLED
	var vision: VisionCone = _find(func(n: Node) -> bool: return n is VisionCone)[0]
	vision.set_enabled(false)
	_rig.adjust_brightness(0.4) # the same in-game brightness the README shots use
	_player.camera_rig = null
	await _frames(10)

	# B1. The mockup's composition: night, inside the roofless watchhouse, the
	# survivor with a torch beside the iron-banded chest, the pack open with
	# the rag bandage selected.
	_dn.set_hour(23.0)
	_equip("arming_sword")
	_equip("pitch_torch")
	_place(Vector3(6.3, 0.0, -5.0), Vector3(1.0, 0.0, -0.55)) # torch on the Supply Chest at (7.4, -5.6)
	await _frames(40)
	await _pair("b1_watchhouse_night")
	_hud.inventory_ui.toggle_inventory()
	await _frames(4)
	var bandage: ItemInstance = _player.inventory.find_first("clean_rag_bandage")
	if bandage and _hud.inventory_ui.has_method("select_item"):
		_hud.inventory_ui.call("select_item", bandage)
	await _frames(4)
	await _shot("b1_watchhouse_night_pack.png")
	_hud.inventory_ui.toggle_inventory()
	await _frames(4)

	# B2. Light is precious: the shelter fire at night, no torch.
	_equip("wooden_targe")
	# Beside the fire, across the view, so the survivor doesn't hide it.
	_place(AshenWildsBootstrap.FIRE_POS + Vector3(1.3, 0.0, -1.3), Vector3(-1.0, 0.0, 1.0))
	await _frames(40)
	await _pair("b2_shelter_fire_night")

	# B3. The Blackfen by day: the marsh among the rot mounds, overcast.
	_dn.set_hour(12.0)
	_equip("pitch_torch")
	_place(Vector3(-13.0, 0.0, 17.0), Vector3(-0.6, 0.0, 0.8))
	for e: Node in enemies:
		if e is EnemyRotMound:
			(e.get("_visual_root") as Node3D).visible = true
	await _frames(40)
	await _pair("b3_marsh_day")

	# B4. Creature line-up for silhouette readability, in daylight on open ground.
	for e: Node in enemies:
		if e is EnemyRotMound:
			(e.get("_visual_root") as Node3D).visible = false
	var line_origin := Vector3(-6.0, 0.0, 12.5)
	_place(line_origin + Vector3(4.0, 0.0, 4.0), Vector3(-1.0, 0.0, -1.0))
	var kinds: Array = [EnemyGoblinScavenger, EnemyOrkWarrior, EnemyGhoul, EnemyFungusZombie, EnemySkullDeer, EnemyBogBull, EnemyPallidCrawler, EnemyRotBeast]
	var slot: int = 0
	for k: Variant in kinds:
		for e: Node in enemies:
			if is_instance_of(e, k) and not e.is_dead():
				# Centred on the frame, spread along the screen's horizontal (-X+Z).
				var along: float = 1.2 * (float(slot) - (kinds.size() - 1) * 0.5)
				var pos: Vector3 = line_origin + Vector3(-along, 0.0, along) + Vector3(slot % 2 * 0.8, 0.0, slot % 2 * 0.8)
				if e is EnemyPallidCrawler:
					e.call("_set_buried", false)
				_pose(e, pos, _player.global_position)
				slot += 1
				break
	await _frames(40)
	await _pair("b4_bestiary_lineup")

	_dn.set_hour(8.0)
	quit(0)
