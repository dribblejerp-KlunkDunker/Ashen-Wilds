extends SceneTree
# Renders README screenshots into res://docs/screenshots/.
# Needs a real renderer (not --headless). On Linux without a GPU:
#   xvfb-run -s "-screen 0 1920x1080x24" godot --path . --script res://tools/capture_screenshots.gd
# Enemies are frozen while staging so shots are repeatable. Shots use the in-game
# brightness setting at +0.4 (the same as pressing ] four times). Facing is set
# directly because there is no real mouse under a virtual display.

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
	_main.set("show_background_picker", false)
	_main.set("weather_cycle_enabled", false)
	_main.set("day_cycle_enabled", false)
	_main.set("survival_enabled", false)
	root.add_child(_main)
	_player = _find(func(n: Node) -> bool: return n is PlayerController)[0]
	_rig = _find(func(n: Node) -> bool: return n is IsoCameraRig)[0]
	_hud = _find(func(n: Node) -> bool: return n is TacticalHUD)[0]
	var enemies: Array = _find(func(n: Node) -> bool: return n.is_in_group("enemy"))
	for e: Node in enemies:
		e.process_mode = Node.PROCESS_MODE_DISABLED
	_rig.adjust_brightness(0.4)
	_player.camera_rig = null # stop mouse-driven aim; the camera still follows
	await _frames(10)

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

	# 4. Pack + loot windows after the search completes.
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
	Engine.time_scale = 1.0
	await _frames(10)

	# 8. Milestone 6: the cleaver Ork follows you into the entry hall and clangs.
	_equip_now("arming_sword")
	_equip_now("pitch_torch")
	_place(Vector3(3.7, 0.0, -2.675), Vector3(-1, 0, 0))
	var cleaver_ork: EnemyOrkWarrior = enemies.filter(func(e: Node) -> bool: return e is EnemyOrkWarrior and not e.has_shield)[0]
	cleaver_ork.global_position = Vector3(2.3, 0.0, -2.675)
	cleaver_ork._face_direction(Vector3.RIGHT, 50.0, 1.0)
	cleaver_ork._visual_root.visible = true
	await _frames(30)
	cleaver_ork._enter_combo_1_active()
	cleaver_ork._update_visual_telegraph()
	Engine.time_scale = 0.05
	await _frames(3)
	await _shot("08_ork_hall_clang.png")
	Engine.time_scale = 1.0
	await _frames(10)

	# 10. Milestone 8: vision cone, charcoal memory and ripples. Sweep the cone
	# around the yard to build memory, then face west, away from the
	# watchhouse. The goblin inside and the Ogre to the north-west are heard,
	# not seen.
	_equip_now("wooden_targe")
	var field: AcousticField = _find(func(n: Node) -> bool: return n is AcousticField)[0]
	_place(Vector3(-1.6, 0.0, -1.2), Vector3(-1, 0, 0))
	for a in range(0, 360, 15):
		_player._aim_direction = Vector3.FORWARD.rotated(Vector3.UP, deg_to_rad(a))
		await _frames(2)
	_place(Vector3(-1.6, 0.0, -1.2), Vector3(-1, 0, 0.35))
	await _frames(20)
	inside_goblin.global_position = Vector3(4.6, 0.0, -4.4)
	field.emit_noise(inside_goblin.global_position, 12.5, inside_goblin, "footstep")
	var yard_goblin: EnemyGoblinScavenger = enemies.filter(func(e: Node) -> bool: return e is EnemyGoblinScavenger)[0]
	yard_goblin.global_position = Vector3(-1.4, 0.0, -6.6)
	yard_goblin._visual_root.visible = false # out of the cone
	field.emit_noise(yard_goblin.global_position, 9.0, yard_goblin, "footstep")
	Engine.time_scale = 0.12
	await _frames(4)
	await _shot("10_vision_cone_ripples.png")
	Engine.time_scale = 1.0
	await _frames(10)

	# 11-13. Milestone 9: weather. Each is set instantly and given a moment
	# for the flakes to spread.
	var weather: WeatherSystem = _find(func(n: Node) -> bool: return n is WeatherSystem)[0]
	_equip_now("pitch_torch")
	weather.set_weather(WeatherSystem.Weather.ASHFALL, true)
	_place(Vector3(-5.2, 0.0, 3.2), Vector3(0.6, 0, -1))
	await _frames(45)
	await _shot("11_weather_ashfall.png")
	weather.set_weather(WeatherSystem.Weather.CINDER_SQUALL, true)
	_place(Vector3(10.6, 0.0, 9.6), Vector3(1.2, 0, -0.4))
	for e: Node in enemies:
		if e is EnemyOrkWarrior:
			e._visual_root.visible = true
	await _frames(45)
	await _shot("12_weather_cinder_squall.png")
	weather.set_weather(WeatherSystem.Weather.MIASMA, true)
	_place(Vector3(-9.0, 0.0, -9.2), Vector3(-1.4, 0, -0.6))
	ogre.state = EnemyOgreBrute.AIState.IDLE
	ogre._update_visual_telegraph()
	ogre._visual_root.visible = true
	await _frames(45)
	await _shot("13_weather_miasma.png")
	weather.set_weather(WeatherSystem.Weather.OVERCAST, true)
	await _frames(5)

	# 14. Milestone 11: the Blind Quarry-Troll stalks a thrown stone's thud.
	_equip_now("arming_sword")
	_equip_now("pitch_torch")
	var troll: EnemyQuarryTroll = enemies.filter(func(e: Node) -> bool: return e is EnemyQuarryTroll)[0]
	_place(Vector3(11.6, 0.0, -13.0), Vector3(1.0, 0, -0.9))
	troll.global_position = Vector3(15.6, 0.0, -16.2)
	troll._face_direction(Vector3(-0.3, 0, 1).normalized(), 50.0, 1.0)
	troll.state = EnemyQuarryTroll.AIState.STALK
	troll._update_visual_telegraph()
	troll._visual_root.visible = true
	await _frames(30)
	field.emit_noise(Vector3(14.6, 0.0, -13.4), 10.0, troll, "thud")
	Engine.time_scale = 0.12
	await _frames(4)
	await _shot("14_quarry_troll.png")
	Engine.time_scale = 1.0
	await _frames(5)

	# 15. Milestone 13: the Act I card, at the shelter fire.
	_equip_now("wooden_targe")
	_place(Vector3(-7.0, 0.0, 6.6), Vector3(-0.9, 0, 0.5))
	await _frames(20)
	var acts: ActObjectives = _find(func(n: Node) -> bool: return n is ActObjectives)[0]
	for o: Dictionary in acts.objectives:
		o["done"] = not o["optional"] or o["id"] == "ogre"
	acts.elapsed = 47.0 * 60.0 + 12.0
	_hud._refresh_objectives()
	_hud.show_act_complete()
	await _frames(4)
	await _shot("15_act_one_complete.png")
	_hud.close_act_complete()

	# 16. Milestone 15: crows on the Old Gibbet; the Ghoul gnawing a corpse.
	_equip_now("arming_sword")
	_equip_now("pitch_torch")
	var ghoul: EnemyGhoul = enemies.filter(func(e: Node) -> bool: return e is EnemyGhoul)[0]
	var meal: EnemyGoblinScavenger = enemies.filter(func(e: Node) -> bool: return e is EnemyGoblinScavenger)[0]
	meal.global_position = Vector3(10.6, 0.0, 16.4)
	meal.state = EnemyGoblinScavenger.AIState.DEAD
	meal._visual_root.rotation_degrees.x = -85.0
	meal._visual_root.position.y = 0.2
	meal._visual_root.visible = true
	ghoul.global_position = Vector3(11.4, 0.0, 16.9)
	ghoul._face_direction((meal.global_position - ghoul.global_position).normalized(), 50.0, 1.0)
	ghoul.state = EnemyGhoul.AIState.EAT
	ghoul._update_visual_telegraph()
	ghoul._visual_root.visible = true
	_place(Vector3(6.2, 0.0, 17.6), Vector3(1.0, 0, -0.25))
	for e: Node in enemies:
		if e is EnemyCarrionCrow:
			e._visual_root.visible = true
	await _frames(40)
	await _shot("16_gibbet_crows_ghoul.png")

	# 17. Milestone 16: the Bog Bear rears from a raised torch; rot mounds nearby.
	_equip_now("woodsmans_broadaxe")
	_equip_now("pitch_torch")
	var bear: EnemyBogBear = enemies.filter(func(e: Node) -> bool: return e is EnemyBogBear)[0]
	var bear_spot := Vector3(-19.6, 0.0, 1.2)
	var stand := bear_spot + Vector3(2.8, 0.0, -1.5)
	_place(stand, (bear_spot - stand).normalized())
	bear.global_position = bear_spot
	bear._face_direction((stand - bear_spot).normalized(), 50.0, 1.0)
	bear.state = EnemyBogBear.AIState.REAR
	bear._update_visual_telegraph()
	bear._visual_root.visible = true
	await _frames(40)
	await _shot("17_bog_bear_torch.png")

	# 18. Milestone 17: freezing and hungry, out in the hoarfrost.
	_equip_now("arming_sword")
	_equip_now("pitch_torch")
	weather.set_weather(WeatherSystem.Weather.HOARFROST, true)
	_place(Vector3(-3.0, 0.0, 12.5), Vector3(-1.0, 0, -0.6))
	_player.warmth = 11.0
	_player.satiety = 24.0
	_player.stamina = 55.0
	await _frames(45)
	await _shot("18_survival_freezing.png")
	weather.set_weather(WeatherSystem.Weather.OVERCAST, true)
	_player.warmth = _player.max_warmth
	_player.satiety = 80.0
	await _frames(5)

	# 19. Milestone 18: working at the shelter fire.
	var boot: AshenWildsBootstrap = _main as AshenWildsBootstrap
	_equip_now("arming_sword")
	_equip_now("wooden_targe")
	_player.inventory.main_hand.condition = 34.0
	_player.inventory.add(ItemDatabase.make("iron_scrap", 3))
	_player.inventory.add(ItemDatabase.make("raw_bear_meat", 1))
	_player.inventory.add(ItemDatabase.make("bear_pelt", 1))
	boot._stash.put(ItemDatabase.make("cooking_pot"))
	_place(Vector3(-7.4, 0.0, 6.0), Vector3(0.5, 0, -1.0))
	await _frames(25)
	boot._crafting.open()
	await _frames(6)
	await _shot("19_crafting_at_fire.png")
	boot._crafting.close()

	# 20. Milestone 19: night. Torchlight in the yard, a goblin at the edge of it.
	var dn: DayNightCycle = _find(func(n: Node) -> bool: return n is DayNightCycle)[0]
	dn.set_hour(23.0)
	_equip_now("pitch_torch")
	_place(Vector3(-2.4, 0.0, 1.6), Vector3(-0.5, 0, -0.86))
	var night_gob: EnemyGoblinScavenger = enemies.filter(func(e: Node) -> bool: return e is EnemyGoblinScavenger and not e.is_dead())[0]
	night_gob.global_position = Vector3(-3.9, 0.0, -1.0)
	night_gob._facing_dir = Vector3(0.5, 0, 0.86).normalized()
	night_gob._visual_root.look_at(night_gob.global_position + night_gob._facing_dir, Vector3.UP)
	night_gob._visual_root.visible = true
	await _frames(40)
	await _shot("20_night_torchlight.png")
	dn.set_hour(8.0)
	await _frames(5)

	# 9. Milestone 7: the survivor picker.
	var picker := BackgroundPicker.new()
	root.add_child(picker)
	picker.select(5)
	await _frames(6)
	await _shot("09_survivor_picker.png")
	picker.confirm()

	quit(0)
