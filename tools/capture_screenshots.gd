extends SceneTree
# Renders README screenshots into res://docs/screenshots/.
# Needs a real renderer (not --headless). On Linux without a GPU:
#   xvfb-run -s "-screen 0 1920x1080x24" godot --path . --script res://tools/capture_screenshots.gd
# Enemies are frozen while staging so shots are repeatable. Facing is set
# directly because there is no real mouse under a virtual display.
# Shots use the default brightness, so they show what a player sees on first launch.

const OUT_DIR := "res://docs/screenshots"

var _main: Node3D
var _player: PlayerController
var _rig: IsoCameraRig
var _hud: TacticalHUD

func _initialize() -> void:
	_run.call_deferred()

func _frames(n: int) -> void:
	for i in range(n):
		await process_frame

func _shot(file_name: String) -> void:
	await RenderingServer.frame_post_draw
	var img: Image = root.get_texture().get_image()
	var path: String = "%s/%s" % [OUT_DIR, file_name]
	var err: int = img.save_png(path)
	print("saved %s (%dx%d) err=%d" % [path, img.get_width(), img.get_height(), err])

func _find(cls_check: Callable) -> Array:
	var out: Array = []
	for c: Node in _main.get_children():
		if cls_check.call(c):
			out.append(c)
	return out

func _lootable(display_name: String) -> Lootable:
	for n: Node in get_nodes_in_group("lootable"):
		var l := n as Lootable
		if l and l.display_name == display_name:
			return l
	return null

func _place(pos: Vector3, aim: Vector3 = Vector3(1, 0, -1)) -> void:
	_player.respawn_at_shelter(pos)
	_player._aim_direction = aim.normalized()
	_player._visual_root.look_at(pos + aim.normalized(), Vector3.UP)
	_rig.global_position = pos
	_hud.show_banner("", Color.WHITE)

func _equip_now(item_id: String) -> void:
	var inst: ItemInstance = _player.inventory.find_first(item_id)
	if inst == null:
		inst = ItemDatabase.make(item_id)
		_player.inventory.add(inst)
	_player.inventory.equip(inst)

func _run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT_DIR))
	_main = (load("res://main.tscn") as PackedScene).instantiate()
	root.add_child(_main)
	_player = _find(func(n: Node) -> bool: return n is PlayerController)[0]
	_rig = _find(func(n: Node) -> bool: return n is IsoCameraRig)[0]
	_hud = _find(func(n: Node) -> bool: return n is TacticalHUD)[0]
	var enemies: Array = _find(func(n: Node) -> bool: return n is EnemyGoblinScavenger or n is EnemyOrkWarrior or n is EnemyOgreBrute or n is EnemyQuarryTroll or n is EnemySporeHusk or n is EnemyUnnamed or n is EnemyGalleryCrawler)
	for e: Node in enemies:
		e.process_mode = Node.PROCESS_MODE_DISABLED
	_player.camera_rig = null # stop mouse-driven aim; the camera still follows
	await _frames(10)

	# 0. The start screen, over the paused yard.
	var picker: BackgroundSelect = _find(func(n: Node) -> bool: return n is BackgroundSelect)[0]
	picker.select(4)
	await _frames(3)
	await _shot("00_who_were_you.png")
	picker.select(0)
	picker.confirm()
	await _frames(3)

	# 1. Shelter start: fire, stash prompt, starting gear.
	_place(Vector3(-7.0, 0.0, 6.6), Vector3(-0.9, 0, 0.5))
	await _frames(40)
	await _shot("01_shelter_start.png")

	# 2. Torchlight inside the watchhouse: roof cutaway + interior goblin.
	_equip_now("pitch_torch")
	_place(Vector3(6.6, 0.0, -4.6), Vector3(-1.6, 0, 1.6))
	var inside_goblin: EnemyGoblinScavenger = enemies.filter(func(e: Node) -> bool: return e is EnemyGoblinScavenger)[1]
	inside_goblin.global_position = Vector3(5.1, 0.0, -3.0)
	inside_goblin._face_direction((Vector3(6.6, 0.0, -4.6) - inside_goblin.global_position).normalized(), 50.0, 1.0)
	inside_goblin.state = EnemyGoblinScavenger.AIState.ATTACK_STARTUP
	inside_goblin._update_visual_telegraph()
	inside_goblin._visual_root.visible = true # in the player's line of sight
	await _frames(40)
	await _shot("02_watchhouse_torchlight.png")

	# 3. Searching the Watchhouse chest mid-way.
	var chest: Lootable = _lootable("Watchhouse Supply Chest")
	_place(chest.global_position + Vector3(-1.1, 0.0, 0.6), Vector3(1, 0, -0.55))
	await _frames(10)
	_player._start_channel(PlayerController.ChannelKind.SCAVENGE, chest.search_duration, chest)
	_player._channel_elapsed = chest.search_duration * 0.55
	await _frames(4)
	await _shot("03_searching_chest.png")

	# 4. Pack + loot windows after the search completes (the coif from the stash is worn).
	_equip_now("padded_coif")
	_player._channel_elapsed = chest.search_duration
	await _frames(6)
	if not _hud.inventory_ui.is_loot_open():
		chest.searched = true
		_hud.inventory_ui.open_loot(chest)
	await _frames(6)
	await _shot("04_pack_and_loot.png")
	_hud.inventory_ui.close_all()

	# 5. Ork choke point with the spear (two-handed, shield stowed).
	_equip_now("arming_sword")
	_equip_now("wooden_targe")
	_equip_now("boar_spear")
	_place(Vector3(10.4, 0.0, 10.2), Vector3(1.8, 0, -1.6))
	for e: Node in enemies:
		if e is EnemyOrkWarrior:
			var ork: EnemyOrkWarrior = e
			ork._face_direction((_player.global_position - ork.global_position).normalized(), 50.0, 1.0)
			ork.state = EnemyOrkWarrior.AIState.SHIELD_ADVANCE if ork.has_shield else EnemyOrkWarrior.AIState.COMBO_1_STARTUP
			ork._update_visual_telegraph()
			ork._visual_root.visible = true
	await _frames(40)
	await _shot("05_ork_choke_spear.png")

	# 6. The Blackfen Ogre's lair: torch + axe, slam telegraph.
	_equip_now("woodsmans_broadaxe")
	_equip_now("pitch_torch")
	var ogre: EnemyOgreBrute = enemies.filter(func(e: Node) -> bool: return e is EnemyOgreBrute)[0]
	_place(Vector3(-10.4, 0.0, -12.6), Vector3(-3.1, 0, 1.1))
	ogre._face_direction((_player.global_position - ogre.global_position).normalized(), 50.0, 1.0)
	ogre._visual_root.visible = true
	ogre.state = EnemyOgreBrute.AIState.SLAM_STARTUP
	ogre._slam_ring.visible = true
	ogre._update_visual_telegraph()
	await _frames(40)
	await _shot("06_ogre_lair.png")

	# 7. Entry hall: a sword slash clangs off the stone (Milestone 5).
	ogre._slam_ring.visible = false
	_equip_now("arming_sword")
	_equip_now("pitch_torch")
	_place(Vector3(2.4, 0.0, -2.675), Vector3(1, 0, 0))
	await _frames(30)
	_player.stamina = _player.max_stamina
	_player._start_attack(false)
	while _player.current_state != PlayerController.ActionState.RECOIL:
		await physics_frame
	# Software rendering runs at a few fps, so slow time or the ~0.4 s sparks
	# finish between frames.
	Engine.time_scale = 0.05
	await _frames(3)
	await _shot("07_entry_hall_clang.png")

	# 08: the vision cone. The survivor faces east across the yard; the yard goblin creeps up from
	# the west, out of the cone, so it is not drawn: only its footstep ripples and the charcoal
	# mark where it was last seen. The charcoal memory map covers everything behind the survivor.
	# Time still runs at 0.05 from the clang shot, so the rings hold their first moments.
	_equip_now("arming_sword")
	_place(Vector3(-4.0, 0.0, 6.0), Vector3(1.0, 0.0, 0.0))
	var yard_goblin: EnemyGoblinScavenger = enemies.filter(func(e: Node) -> bool: return e is EnemyGoblinScavenger)[0]
	yard_goblin.global_position = Vector3(-7.5, 0.0, 5.0)
	yard_goblin._visual_root.visible = false
	await _frames(6)
	AcousticRipple.spawn_mark(_main, Vector3(-6.4, 0.0, 7.6), 6.0)
	AcousticRipple.spawn(_main, Vector3(-7.5, 0.0, 5.0), 8.0)
	AcousticRipple.spawn(_main, Vector3(-7.0, 0.0, 5.6), 8.0)
	await _frames(3)
	await _shot("08_vision_cone_unseen_goblin.png")
	Engine.time_scale = 1.0

	# 09, 10: two weathers. Miasma fog in the yard (the sight range closes to 7 m, the fog is
	# thick and green-grey); a cinder-squall at the ork choke point (embers ride the wind).
	var weather: Weather = _find(func(n: Node) -> bool: return n is Weather)[0]
	weather.cycling = false
	weather.set_condition(Weather.Condition.MIASMA_FOG, true)
	_place(Vector3(-4.0, 0.0, 6.0), Vector3(1.0, 0.0, 0.3))
	await _frames(12)
	await _shot("09_miasma_fog.png")
	weather.set_condition(Weather.Condition.CINDER_SQUALL, true)
	_place(Vector3(8.5, 0.0, 8.5), Vector3(1.0, 0.0, 0.2))
	await _frames(12)
	await _shot("10_cinder_squall.png")
	weather.set_condition(Weather.Condition.ASHFALL, true)

	# 11: the companion. Cut free off-screen (found by name: the graves are ActionPoints too), then posed two paces behind the survivor in the yard.
	var captive: ActionPoint = _find(func(n: Node) -> bool: return n is ActionPoint and (n as Lootable).display_name == "Bound Captive")[0]
	captive.on_search_complete(_player)
	await _frames(2)
	var companion: Companion = _find(func(n: Node) -> bool: return n is Companion)[0]
	_place(Vector3(-3.0, 0.0, 4.0), Vector3(1.0, 0.0, -0.4))
	companion.global_position = Vector3(-4.6, 0.0, 5.2)
	companion._face_toward(Vector3(-3.0, 0.0, 4.0) + Vector3(1.0, 0.0, -0.4) * 3.0, 50.0, 1.0)
	companion.process_mode = Node.PROCESS_MODE_DISABLED
	companion._model.play(&"Idle")
	await _frames(12)
	await _shot("11_companion.png")

	# 12: the Blind Quarry-Troll in the old quarry, bringing both fists down on the spot where it
	# heard the survivor, who has crept a few paces clear of the ring.
	var troll: EnemyQuarryTroll = enemies.filter(func(e: Node) -> bool: return e is EnemyQuarryTroll)[0]
	_place(Vector3(11.0, 0.0, -10.2), Vector3(1.0, 0.0, -0.9))
	troll.global_position = Vector3(15.5, 0.0, -14.5)
	var heard_spot := Vector3(13.4, 0.0, -12.4)
	troll._face_toward(heard_spot, 50.0, 1.0)
	troll._begin_pound(heard_spot)
	troll._update_visual_telegraph()
	troll._visual_root.visible = true
	await _frames(14)
	await _shot("12_quarry_troll.png")
	troll._abandon_attack()

	# 13: the Spore Hollow. Torch in hand, the survivor faces three husks; one has just burst into
	# a cloud. They stand clear of it, out of the torch's reach of it, so it hangs for the shot.
	_equip_now("pitch_torch")
	_place(Vector3(-14.6, 0.0, 0.8), Vector3(-1.0, 0.0, -0.35))
	for h: Node in enemies.filter(func(e: Node) -> bool: return e is EnemySporeHusk):
		var husk: EnemySporeHusk = h
		husk._face_toward(Vector3(-14.6, 0.0, 0.8), 50.0, 1.0)
		husk._visual_root.visible = true
		husk._model.play(&"Zombie_Walk_Fwd")
	SporeCloud.spawn(_main, Vector3(-19.4, 0.0, -0.6), EnemySporeHusk.BURST_RADIUS, 60.0)
	await _frames(14)
	await _shot("13_spore_hollow.png")
	for n: Node in get_nodes_in_group("spore_cloud"):
		n.queue_free()

	# 14: the Drowned Graves. One Unnamed lies fallen (its ring pale: down, not done); the survivor
	# kneels at its grave speaking the name while the other two come on.
	var unnamed: Array = enemies.filter(func(e: Node) -> bool: return e is EnemyUnnamed)
	var fallen: EnemyUnnamed = unnamed[0]
	var fallen_grave: ActionPoint = fallen.grave
	_place(fallen_grave.global_position + Vector3(-1.1, 0.0, -0.4), Vector3(1.0, 0.0, 0.35))
	fallen._fall()
	fallen._update_visual_telegraph()
	fallen._visual_root.visible = true
	for i: int in range(1, unnamed.size()):
		var u: EnemyUnnamed = unnamed[i]
		u._face_toward(_player.global_position, 50.0, 1.0)
		u._visual_root.visible = true
		u._model.play(&"Zombie_Walk_Fwd")
	_player._start_channel(PlayerController.ChannelKind.SCAVENGE, 60.0, fallen_grave)
	await _frames(14)
	await _shot("14_drowned_graves.png")
	_player._clear_channel()
	Engine.time_scale = 1.0

	# 15: the Roofed Gallery. Torch in hand, the survivor has walked under the ledge; the crawler is
	# in the air off the wall, coming down on the ring where they stand.
	var crawler: EnemyGalleryCrawler = enemies.filter(func(e: Node) -> bool: return e is EnemyGalleryCrawler)[0]
	_equip_now("pitch_torch")
	_place(Vector3(-21.7, 0.0, 19.9), Vector3(-1.0, 0.0, -0.25))
	await _frames(4)
	crawler._begin_tell()
	crawler._drop_from = crawler.global_position
	var t: float = 0.7
	var mid: Vector3 = crawler._drop_from.lerp(crawler._drop_target, t)
	mid.y = lerpf(crawler._drop_from.y, 0.0, t * t) + sin(t * PI) * 0.8
	crawler.global_position = mid
	crawler._face_toward(_player.global_position, 50.0, 1.0)
	crawler.state = EnemyGalleryCrawler.AIState.LEAP
	crawler._update_visual_telegraph()
	crawler._visual_root.visible = true
	await _frames(14)
	await _shot("15_roofed_gallery.png")

	quit(0)
