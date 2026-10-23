class_name AshenWildsBootstrap
extends Node3D

var _player: PlayerController
var _camera_rig: IsoCameraRig
var _hud: TacticalHUD
var _audio: ProceduralAudio
var _coordinator: EncounterCoordinator
var _acoustics: AcousticField
var _ripples: AcousticRipples
var _vision: VisionCone
var _weather: WeatherSystem
var _objectives: ActObjectives
var _watch_goblins: Array[Node3D] = []
var _orks: Array[Node3D] = []
var _ogre: EnemyOgreBrute
var _troll: EnemyQuarryTroll
var _stash: Lootable
## Every enemy in spawn order (Milestone 14 save identity).
var _all_enemies: Array[Node3D] = []
const FIRE_POS := Vector3(-6.5, 0.0, 4.8)
const REST_RADIUS: float = 2.6
var _sun: DirectionalLight3D
## Milestone 9: tests and tools turn the weather cycle off before add_child.
@export var weather_cycle_enabled: bool = true
var _shelter_spawn: Vector3 = Vector3(-6.5, 0.0, 6.5)
## Milestone 7: show the survivor picker on boot. Tests and tools turn this
## off before adding the scene, which keeps the legacy loadout.
@export var show_background_picker: bool = true

const WATCHHOUSE_INTERIOR := AABB(Vector3(1.1, 0.0, -6.9), Vector3(7.8, 3.8, 7.8))

func _ready() -> void:
	_ensure_input_bindings()

	_audio = ProceduralAudio.new()
	add_child(_audio)

	_coordinator = EncounterCoordinator.new()
	add_child(_coordinator)

	_acoustics = AcousticField.new()
	add_child(_acoustics)

	var world_env := _build_atmosphere_and_lighting()
	_camera_rig = IsoCameraRig.new()
	_camera_rig.bind_world_environment(world_env)
	add_child(_camera_rig)

	_build_blackfen_test_yard()

	_player = PlayerController.new()
	_player.position = _shelter_spawn
	_player.camera_rig = _camera_rig
	_player.audio = _audio
	add_child(_player)
	_camera_rig.target = _player
	_camera_rig.global_position = _shelter_spawn

	# Milestone 8: vision cone + memory map, and ripples for unseen noises.
	_vision = VisionCone.new()
	_vision.player = _player
	add_child(_vision)
	_vision.attach_to_camera(_camera_rig.camera)
	_ripples = AcousticRipples.new()
	add_child(_ripples)
	_ripples.bind(_acoustics, _player)

	# Milestone 9: weather.
	_weather = WeatherSystem.new()
	_weather.cycle_enabled = weather_cycle_enabled
	_weather.player = _player
	_weather.environment = world_env.environment
	_weather.sun = _sun
	_weather.acoustics = _acoustics
	_weather.register_interior(WATCHHOUSE_INTERIOR)
	add_child(_weather)
	_weather.weather_changed.connect(_on_weather_changed)

	_spawn_all_archetype_encounters()

	_spawn_scavenge_containers()

	_hud = TacticalHUD.new()
	add_child(_hud)
	_hud.bind_player(_player)
	_build_act_one_objectives()
	for n: Node in get_children():
		if n.is_in_group("enemy"):
			_all_enemies.append(n)
	_hud.show_banner("THE BLACKFEN OUTSKIRTS — Search with [E], manage your pack with [Tab].  [F1] Watchhouse  [F2] Ork Choke  [F3] Ogre Lair", Color(0.82, 0.76, 0.65))

	if show_background_picker and DisplayServer.get_name() == "headless":
		# Headless boots (CI, the live-boot check) can't click: start as the
		# first survivor so the world runs unpaused.
		_on_background_chosen.call_deferred(BackgroundDatabase.all()[0])
	elif show_background_picker:
		var picker := BackgroundPicker.new()
		picker.can_continue = SaveGame.exists()
		picker.background_chosen.connect(_on_background_chosen)
		picker.continue_chosen.connect(load_game)
		add_child(picker)

func _process(_delta: float) -> void:
	_player.extra_prompt = "[T] Rest at the fire (heal & save)" if is_near_fire() else ""

func is_near_fire() -> bool:
	var d := Vector2(_player.global_position.x - FIRE_POS.x, _player.global_position.z - FIRE_POS.z)
	return d.length() <= REST_RADIUS

## Milestone 14: resting at the shelter fire heals you, stops bleeding and saves.
func rest_at_fire() -> bool:
	if not is_near_fire() or not (_player.current_state in PlayerController.NEUTRAL_STATES):
		return false
	_player.health = _player.max_health
	_player.is_bleeding = false
	_player.bleed_timer = 0.0
	_player.cure_spores()
	var ok: bool = SaveGame.write(self)
	_hud.show_banner("You rest by the fire. Wounds bound, the night survived — game saved." if ok else "You rest, but the game could not be saved.", Color(0.88, 0.74, 0.46))
	return ok

func load_game() -> void:
	var ok: bool = await SaveGame.apply(self, SaveGame.read())
	_hud.show_banner("The fire still burns. Game loaded." if ok else "No saved game found.", Color(0.86, 0.78, 0.60))

func _on_background_chosen(bg: SurvivorBackground) -> void:
	_player.apply_background(bg)
	_hud.show_banner("%s — %s, but %s." % [bg.display_name, bg.trait_name, bg.flaw_name.to_lower()], Color(0.86, 0.78, 0.60))

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed:
		match event.keycode:
			KEY_R:
				_player.respawn_at_shelter(_shelter_spawn)
			KEY_F1:
				_player.global_position = Vector3(-2.5, 0.0, -2.5)
				_hud.show_banner("Teleported: Ruined Watchhouse (Goblin Pack & Doorway Test)", Color(0.75, 0.82, 0.68))
			KEY_F2:
				_player.global_position = Vector3(8.5, 0.0, 8.5)
				_hud.show_banner("Teleported: East Choke Point (Shielded Ork & Vanguard)", Color(0.85, 0.68, 0.45))
			KEY_F3:
				_player.global_position = Vector3(-11.0, 0.0, -6.5)
				_hud.show_banner("Teleported: North-West Feeding Ground (Blackfen Ogre)", Color(0.92, 0.42, 0.28))
			KEY_T:
				rest_at_fire()
			KEY_F5:
				_player.global_position = Vector3(7.8, 0.0, -15.0)
				_hud.show_banner("Teleported: The Old Quarry (Blind Quarry-Troll) — make no sound", Color(0.78, 0.72, 0.58))
			KEY_F6:
				_player.global_position = BARROW_POS + Vector3(6.0, 0.0, -4.0)
				_hud.show_banner("Teleported: The Drowned Barrow (Ghoul) — don't bleed here", Color(0.70, 0.62, 0.58))
			KEY_F7:
				_player.global_position = WALLOW_POS + Vector3(13.0, 0.0, 2.0)
				_hud.show_banner("Teleported: east of the Bear Wallow — keep a torch lit", Color(0.80, 0.62, 0.42))
			KEY_F4:
				_weather.advance()
			KEY_V:
				_vision.set_enabled(not _vision.enabled)
				_hud.show_banner("Vision cone & memory map: %s" % ("ON" if _vision.enabled else "OFF"), Color(0.75, 0.75, 0.75))
			KEY_BRACKETLEFT:
				_camera_rig.adjust_brightness(-0.1)
				_hud.show_banner("Brightness Decreased", Color(0.7, 0.7, 0.7))
			KEY_BRACKETRIGHT:
				_camera_rig.adjust_brightness(0.1)
				_hud.show_banner("Brightness Increased", Color(0.85, 0.85, 0.85))
			KEY_MINUS:
				_camera_rig.adjust_shake_scale(-0.15)
				_hud.show_banner("Camera Shake Scale: %.2f" % _camera_rig.shake_intensity_scale, Color(0.75, 0.75, 0.75))
			KEY_EQUAL:
				_camera_rig.adjust_shake_scale(0.15)
				_hud.show_banner("Camera Shake Scale: %.2f" % _camera_rig.shake_intensity_scale, Color(0.75, 0.75, 0.75))

func _ensure_input_bindings() -> void:
	_bind_key("move_up", KEY_W)
	_bind_key("move_down", KEY_S)
	_bind_key("move_left", KEY_A)
	_bind_key("move_right", KEY_D)
	_bind_key("sprint", KEY_SHIFT)
	_bind_key("dodge", KEY_SPACE)
	_bind_key("attack_heavy", KEY_Q)
	_bind_mouse("attack_light", MOUSE_BUTTON_LEFT)
	_bind_mouse("block", MOUSE_BUTTON_RIGHT)
	# Milestone 4
	_bind_key("interact", KEY_E)
	_bind_key("inventory", KEY_TAB)
	_bind_key("bandage", KEY_B)
	_bind_key("equip_slot_1", KEY_1)
	_bind_key("equip_slot_2", KEY_2)
	_bind_key("equip_slot_3", KEY_3)
	_bind_key("equip_slot_4", KEY_4)
	# Milestone 11
	_bind_key("throw", KEY_G)


func _bind_key(action: String, key: Key) -> void:
	if InputMap.has_action(action):
		return
	InputMap.add_action(action)
	var ev := InputEventKey.new()
	ev.keycode = key
	InputMap.action_add_event(action, ev)

func _bind_mouse(action: String, btn: MouseButton) -> void:
	if InputMap.has_action(action):
		return
	InputMap.add_action(action)
	var ev := InputEventMouseButton.new()
	ev.button_index = btn
	InputMap.action_add_event(action, ev)

func _build_atmosphere_and_lighting() -> WorldEnvironment:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.05, 0.05, 0.06)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.16, 0.17, 0.19)
	env.ambient_light_energy = 0.65
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.05
	env.fog_enabled = true
	env.fog_light_color = Color(0.12, 0.12, 0.13)
	env.fog_density = 0.012

	var world_env := WorldEnvironment.new()
	world_env.environment = env
	add_child(world_env)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-52.0, -35.0, 0.0)
	sun.light_color = Color(0.58, 0.62, 0.68)
	sun.light_energy = 0.65
	sun.shadow_enabled = true
	add_child(sun)
	_sun = sun
	return world_env

func _build_blackfen_test_yard() -> void:
	var cutaway_shader: Shader = load("res://shaders/foreground_cutaway.gdshader")

	_create_static_box(
		Vector3(0.0, -0.25, 0.0),
		Vector3(52.0, 0.5, 52.0),
		Color(0.18, 0.16, 0.14),
		cutaway_shader,
		false,
		false
	)

	_create_static_box(
		Vector3(-6.5, 0.2, 4.8),
		Vector3(0.9, 0.4, 0.9),
		Color(0.25, 0.22, 0.20),
		cutaway_shader,
		false,
		false
	)
	var fire_light := OmniLight3D.new()
	fire_light.position = Vector3(-6.5, 1.1, 4.8)
	fire_light.light_color = Color(0.96, 0.54, 0.22)
	fire_light.light_energy = 2.4
	fire_light.omni_range = 9.0
	fire_light.shadow_enabled = true
	add_child(fire_light)

	_camera_rig.register_interior_aabb(WATCHHOUSE_INTERIOR)

	var stone_col := Color(0.28, 0.27, 0.25)
	_create_static_box(Vector3(5.0, 1.6, -7.0), Vector3(8.0, 3.2, 0.4), stone_col, cutaway_shader, false, false)
	# East wall faces the camera (rig sits on the +X/+Z side), so it needs the
	# cutaway too or it hides the eastern half of the watchhouse interior.
	_create_static_box(Vector3(9.0, 1.6, -3.0), Vector3(0.4, 3.2, 8.0), stone_col, cutaway_shader, true, false)

	# West Foreground Wall with 1.35m doorway at Z = -2.675 (Blocks 1.70m Ogre)
	_create_static_box(Vector3(1.0, 1.6, -5.175), Vector3(0.4, 3.2, 3.65), stone_col, cutaway_shader, true, false)
	_create_static_box(Vector3(1.0, 1.6, -0.5), Vector3(0.4, 3.2, 3.0), stone_col, cutaway_shader, true, false)
	_create_static_box(Vector3(1.0, 2.7, -2.675), Vector3(0.4, 1.0, 1.35), stone_col, cutaway_shader, true, false)

	_create_static_box(Vector3(5.0, 1.6, 1.0), Vector3(8.0, 3.2, 0.4), stone_col, cutaway_shader, true, false)

	# Milestone 5: a 1.7 m-wide entry hall running in from the west doorway.
	# Sweeping blades clang off these walls; thrusts work.
	var hall_col := Color(0.25, 0.24, 0.22)
	_create_static_box(Vector3(2.9, 1.2, -3.675), Vector3(3.4, 2.4, 0.3), hall_col, cutaway_shader, true, false)
	_create_static_box(Vector3(2.9, 1.2, -1.675), Vector3(3.4, 2.4, 0.3), hall_col, cutaway_shader, true, false)

	_create_static_box(
		Vector3(5.0, 3.35, -3.0),
		Vector3(8.4, 0.3, 8.4),
		Color(0.22, 0.18, 0.15),
		cutaway_shader,
		true,
		true
	)
	var shadow_proxy := MeshInstance3D.new()
	var sp_box := BoxMesh.new()
	sp_box.size = Vector3(8.4, 0.3, 8.4)
	shadow_proxy.mesh = sp_box
	shadow_proxy.position = Vector3(5.0, 3.35, -3.0)
	shadow_proxy.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY
	add_child(shadow_proxy)

	_create_static_box(Vector3(11.0, 1.4, 5.5), Vector3(4.5, 2.8, 0.6), stone_col, cutaway_shader, false, false)
	_create_static_box(Vector3(15.5, 1.4, 9.5), Vector3(0.6, 2.8, 5.0), stone_col, cutaway_shader, true, false)

	_build_quarry(cutaway_shader)
	_build_bestiary_landmarks(cutaway_shader)

	_create_static_box(Vector3(-11.5, 1.5, -14.5), Vector3(1.6, 3.0, 1.6), stone_col, cutaway_shader, false, false)
	_create_static_box(Vector3(-16.5, 1.2, -10.5), Vector3(1.4, 2.4, 1.4), stone_col, cutaway_shader, false, false)

## Milestone 15: the Old Gibbet (crows) south-east, the Drowned Barrow
## (the Ghoul) south-west.
const GIBBET_POS := Vector3(8.0, 0.0, 15.0)
const BARROW_POS := Vector3(-19.0, 0.0, 16.0)
## Milestone 16: the Bear Wallow (west) and rot mounds in the marsh.
const WALLOW_POS := Vector3(-22.0, 0.0, -1.0)
const ROT_MOUND_SPOTS: Array[Vector3] = [
	Vector3(-14.0, 0.0, 19.5), Vector3(-11.0, 0.0, 21.5), Vector3(-23.5, 0.0, 11.0),
	Vector3(-16.5, 0.0, 9.5), Vector3(-9.5, 0.0, 17.5),
]

func _build_bestiary_landmarks(cutaway_shader: Shader) -> void:
	var wood := Color(0.24, 0.18, 0.13)
	_create_static_box(GIBBET_POS + Vector3(0.0, 1.5, 0.0), Vector3(0.3, 3.0, 0.3), wood, cutaway_shader, false, false)
	_create_static_box(GIBBET_POS + Vector3(0.9, 2.85, 0.0), Vector3(2.0, 0.22, 0.22), wood, cutaway_shader, false, false)
	var stone := Color(0.30, 0.31, 0.29)
	for off: Vector3 in [Vector3(-2.6, 0, -1.8), Vector3(2.4, 0, -2.2), Vector3(-2.2, 0, 2.6), Vector3(2.8, 0, 2.0)]:
		_create_static_box(BARROW_POS + off + Vector3(0.0, 1.0, 0.0), Vector3(0.7, 2.0, 0.5), stone, cutaway_shader, false, false)
	_create_static_box(BARROW_POS + Vector3(0.0, 0.25, -3.6), Vector3(3.6, 0.5, 1.4), stone, cutaway_shader, false, false)
	# The Bear Wallow: a muddy hollow ringed by fallen logs.
	var log_col := Color(0.20, 0.15, 0.10)
	_create_static_box(WALLOW_POS + Vector3(0.0, 0.3, -3.2), Vector3(4.2, 0.6, 0.6), log_col, cutaway_shader, false, false)
	_create_static_box(WALLOW_POS + Vector3(-3.0, 0.3, 0.4), Vector3(0.6, 0.6, 3.6), log_col, cutaway_shader, false, false)
	var mud := MeshInstance3D.new()
	var mud_mesh := CylinderMesh.new()
	mud_mesh.top_radius = 3.0
	mud_mesh.bottom_radius = 3.0
	mud_mesh.height = 0.02
	mud.mesh = mud_mesh
	var mud_mat := StandardMaterial3D.new()
	mud_mat.albedo_color = Color(0.13, 0.11, 0.08)
	mud_mat.roughness = 0.35 # wet
	mud.material_override = mud_mat
	mud.position = WALLOW_POS + Vector3(0.0, 0.012, 0.0)
	add_child(mud)

## Milestone 11: the Old Quarry, north-east. A walled pit with a 3 m gap on
## its west side and broken stone blocks inside. The Blind Quarry-Troll's home.
func _build_quarry(cutaway_shader: Shader) -> void:
	var q_col := Color(0.33, 0.31, 0.28)
	# North and west walls face away from the camera; south and east need the cutaway.
	_create_static_box(Vector3(16.0, 1.3, -21.0), Vector3(12.4, 2.6, 0.6), q_col, cutaway_shader, false, false)
	_create_static_box(Vector3(10.0, 1.3, -18.85), Vector3(0.6, 2.6, 4.9), q_col, cutaway_shader, false, false)
	_create_static_box(Vector3(10.0, 1.3, -11.15), Vector3(0.6, 2.6, 4.9), q_col, cutaway_shader, false, false)
	_create_static_box(Vector3(22.0, 1.3, -15.0), Vector3(0.6, 2.6, 12.4), q_col, cutaway_shader, true, false)
	_create_static_box(Vector3(16.0, 1.3, -9.0), Vector3(12.4, 2.6, 0.6), q_col, cutaway_shader, true, false)
	# Cut blocks and rubble.
	_create_static_box(Vector3(14.0, 0.7, -18.0), Vector3(1.8, 1.4, 1.2), q_col, cutaway_shader, false, false)
	_create_static_box(Vector3(18.5, 0.9, -12.5), Vector3(1.4, 1.8, 1.4), q_col, cutaway_shader, false, false)
	_create_static_box(Vector3(19.0, 0.5, -18.6), Vector3(2.2, 1.0, 1.0), q_col, cutaway_shader, false, false)

func _create_static_box(
	pos: Vector3,
	size: Vector3,
	col: Color,
	shader: Shader,
	enable_cutaway: bool,
	is_roof: bool
) -> void:
	var body := StaticBody3D.new()
	body.position = pos
	body.collision_layer = 32 if is_roof else 1
	body.collision_mask = 0
	add_child(body)

	if not is_roof:
		var cshape := CollisionShape3D.new()
		var box := BoxShape3D.new()
		box.size = size
		cshape.shape = box
		body.add_child(cshape)

	var mesh_inst := MeshInstance3D.new()
	var bmesh := BoxMesh.new()
	bmesh.size = size
	mesh_inst.mesh = bmesh

	var mat := ShaderMaterial.new()
	mat.shader = shader
	mat.set_shader_parameter("albedo_color", col)
	mat.set_shader_parameter("enable_foreground_cutaway", enable_cutaway)
	mesh_inst.material_override = mat
	body.add_child(mesh_inst)

	if enable_cutaway or is_roof:
		_camera_rig.register_cutaway_material(mat, is_roof)

func _spawn_all_archetype_encounters() -> void:
	var goblin_yard := EnemyGoblinScavenger.new()
	goblin_yard.position = Vector3(-1.2, 0.0, -3.2)
	goblin_yard.player_ref = _player
	goblin_yard.audio = _audio
	goblin_yard.coordinator = _coordinator
	goblin_yard.patrol_points = [Vector3(-1.2, 0.0, -4.5), Vector3(-3.0, 0.0, 0.5)]
	add_child(goblin_yard)
	goblin_yard.goblin_alert_sound.connect(_on_goblin_unseen_noise)
	_watch_goblins.append(goblin_yard)

	var goblin_inside := EnemyGoblinScavenger.new()
	goblin_inside.position = Vector3(5.2, 0.0, -3.2)
	goblin_inside.player_ref = _player
	goblin_inside.audio = _audio
	goblin_inside.coordinator = _coordinator
	goblin_inside.patrol_points = [Vector3(6.8, 0.0, -5.2), Vector3(6.8, 0.0, -1.4)]
	add_child(goblin_inside)
	goblin_inside.goblin_alert_sound.connect(_on_goblin_unseen_noise)
	_watch_goblins.append(goblin_inside)

	var ork_shield := EnemyOrkWarrior.new()
	ork_shield.has_shield = true
	ork_shield.position = Vector3(12.2, 0.0, 8.2)
	ork_shield.player_ref = _player
	ork_shield.audio = _audio
	ork_shield.coordinator = _coordinator
	ork_shield.patrol_points = [Vector3(11.8, 0.0, 7.5), Vector3(13.5, 0.0, 10.5)]
	add_child(ork_shield)
	ork_shield.ork_combat_bark.connect(_on_ork_bark)
	_orks.append(ork_shield)

	var ork_cleaver := EnemyOrkWarrior.new()
	ork_cleaver.has_shield = false
	ork_cleaver.enemy_name = "Ork Cleaver"
	ork_cleaver.position = Vector3(14.0, 0.0, 9.8)
	ork_cleaver.player_ref = _player
	ork_cleaver.audio = _audio
	ork_cleaver.coordinator = _coordinator
	ork_cleaver.patrol_points = [Vector3(14.0, 0.0, 11.2), Vector3(12.5, 0.0, 8.8)]
	add_child(ork_cleaver)
	ork_cleaver.ork_combat_bark.connect(_on_ork_bark)
	_orks.append(ork_cleaver)

	var ogre := EnemyOgreBrute.new()
	ogre.position = Vector3(-13.5, 0.0, -11.5)
	ogre.player_ref = _player
	ogre.audio = _audio
	ogre.coordinator = _coordinator
	add_child(ogre)
	_ogre = ogre
	ogre.ogre_event_banner.connect(func(txt: String, col: Color) -> void:
		if _hud:
			_hud.show_banner(txt, col)
	)
	ogre.ogre_ground_shockwave.connect(func(trauma: float) -> void:
		if _camera_rig:
			_camera_rig.add_trauma(trauma)
	)

	# Milestone 15: crows on the gibbet and the Ogre's bone heap; the Ghoul.
	var perches: Array[Vector3] = [
		GIBBET_POS + Vector3(0.4, 2.96, 0.0), GIBBET_POS + Vector3(1.5, 2.96, 0.0), GIBBET_POS + Vector3(-0.8, 0.0, 1.0),
		Vector3(-15.3, 0.45, -13.2), Vector3(-14.6, 0.45, -12.8),
	]
	for perch: Vector3 in perches:
		var crow := EnemyCarrionCrow.new()
		crow.position = perch
		crow.rotation_degrees.y = randf_range(0.0, 360.0)
		crow.player_ref = _player
		crow.audio = _audio
		add_child(crow)
		crow.crow_alarm.connect(_on_crow_alarm)

	var ghoul := EnemyGhoul.new()
	ghoul.position = BARROW_POS + Vector3(0.0, 0.0, 0.5)
	ghoul.player_ref = _player
	ghoul.audio = _audio
	ghoul.coordinator = _coordinator
	add_child(ghoul)
	ghoul.ghoul_event_banner.connect(func(txt: String, col: Color) -> void:
		if _hud:
			_hud.show_banner(txt, col)
	)

	# Milestone 16: the Bog Bear and the rot mounds.
	var bear := EnemyBogBear.new()
	bear.position = WALLOW_POS
	bear.player_ref = _player
	bear.audio = _audio
	bear.coordinator = _coordinator
	add_child(bear)
	bear.bear_event_banner.connect(func(txt: String, col: Color) -> void:
		if _hud:
			_hud.show_banner(txt, col)
	)
	for spot: Vector3 in ROT_MOUND_SPOTS:
		var mound := EnemyRotMound.new()
		mound.position = spot
		mound.player_ref = _player
		mound.audio = _audio
		add_child(mound)
		mound.mound_event_banner.connect(func(txt: String, col: Color) -> void:
			if _hud:
				_hud.show_banner(txt, col)
		)

	var troll := EnemyQuarryTroll.new()
	troll.position = Vector3(16.0, 0.0, -15.5)
	troll.player_ref = _player
	troll.audio = _audio
	troll.coordinator = _coordinator
	add_child(troll)
	_troll = troll
	troll.troll_event_banner.connect(func(txt: String, col: Color) -> void:
		if _hud:
			_hud.show_banner(txt, col)
	)

# ------------------------------------------------------------------------------
# Milestone 13 — Act I objectives
# ------------------------------------------------------------------------------
const SHELTER_NEEDS: Dictionary = {"cooking_pot": 1, "timber": 4, "salt": 4}
const SHELTER_SHORT_NAMES: Dictionary = {"cooking_pot": "pot", "timber": "timber", "salt": "salt"}

func _build_act_one_objectives() -> void:
	_objectives = ActObjectives.new()
	add_child(_objectives)
	_objectives.add("watchhouse", "Secure the Wayfarer's Watchhouse",
		func() -> bool: return _all_dead(_watch_goblins),
		func() -> String: return "goblins %d / %d" % [_dead_count(_watch_goblins), _watch_goblins.size()])
	_objectives.add("shelter", "Stock the shelter stash",
		func() -> bool: return _shelter_stocked(),
		_shelter_progress)
	_objectives.add("causeway", "Break the Ork choke point",
		func() -> bool: return _all_dead(_orks),
		func() -> String: return "orks %d / %d" % [_dead_count(_orks), _orks.size()])
	_objectives.add("ogre", "Slay the Blackfen Ogre",
		func() -> bool: return _ogre != null and _ogre.is_dead(), Callable(), true)
	_objectives.add("troll", "Silence the Quarry-Troll",
		func() -> bool: return _troll != null and _troll.is_dead(), Callable(), true)
	_hud.bind_objectives(_objectives)

func _dead_count(group: Array[Node3D]) -> int:
	return group.filter(func(e: Node3D) -> bool: return not is_instance_valid(e) or e.is_dead()).size()

func _all_dead(group: Array[Node3D]) -> bool:
	return _dead_count(group) == group.size()

func _shelter_stocked() -> bool:
	for id: String in SHELTER_NEEDS.keys():
		if _stash.count_of(id) < int(SHELTER_NEEDS[id]):
			return false
	return true

func _shelter_progress() -> String:
	var parts: Array[String] = []
	for id: String in SHELTER_NEEDS.keys():
		parts.append("%s %d/%d" % [SHELTER_SHORT_NAMES[id], mini(_stash.count_of(id), int(SHELTER_NEEDS[id])), int(SHELTER_NEEDS[id])])
	return " · ".join(parts)

func _on_weather_changed(_w: WeatherSystem.Weather, display_name: String, summary: String) -> void:
	if _hud:
		_hud.show_banner("The weather turns: %s — %s" % [display_name.to_upper(), summary], Color(0.72, 0.78, 0.84))

func _on_crow_alarm(_pos: Vector3) -> void:
	if _hud:
		_hud.show_banner("Crows burst up cawing — everything nearby heard that", Color(0.70, 0.68, 0.62))

func _on_ork_bark(msg: String) -> void:
	if _hud:
		_hud.show_banner(msg, Color(0.86, 0.68, 0.38))

func _on_goblin_unseen_noise(_pos: Vector3) -> void:
	if _hud:
		_hud.show_banner("Scraping footsteps echo from behind the stone wall...", Color(0.75, 0.68, 0.52))

# ------------------------------------------------------------------------------
# Milestone 4 — scavenging containers
# ------------------------------------------------------------------------------
func _spawn_scavenge_containers() -> void:
	# Your own stash by the shelter fire: already known, opens instantly.
	var stash := _spawn_container(
		"Shelter Stash", Vector3(-7.9, 0.0, 7.0), Vector3(0.9, 0.55, 0.6), Color(0.40, 0.29, 0.19), 0.0,
		[ItemDatabase.make("clean_rag_bandage", 1), ItemDatabase.make("timber", 1), ItemDatabase.make("throwing_stone", 3)]
	)
	stash.searched = true
	stash.accepts_deposits = true
	_stash = stash

	_spawn_container(
		"Rotted Grain Crate", Vector3(-4.2, 0.0, 2.2), Vector3(0.8, 0.7, 0.7), Color(0.38, 0.29, 0.19), 2.0,
		[ItemDatabase.make("timber", 2), ItemDatabase.make("iron_scrap", 1)]
	)
	_spawn_container(
		"Watchhouse Supply Chest", Vector3(7.4, 0.0, -5.6), Vector3(1.0, 0.6, 0.6), Color(0.36, 0.27, 0.18), 3.0,
		[ItemDatabase.make("boar_spear", 1, 72.0), ItemDatabase.make("clean_rag_bandage", 1), ItemDatabase.make("salt", 2), ItemDatabase.make("quilted_gambeson", 1, 70.0)]
	)
	_spawn_container(
		"Ork Plunder Pile", Vector3(13.2, 0.0, 12.4), Vector3(1.1, 0.5, 0.9), Color(0.34, 0.28, 0.22), 2.5,
		[ItemDatabase.make("woodsmans_broadaxe", 1, 90.0), ItemDatabase.make("lamp_oil", 1), ItemDatabase.make("clean_rag_bandage", 1), ItemDatabase.make("riveted_mail", 1, 110.0)]
	)
	_spawn_container(
		"Gnawed Bone Heap", Vector3(-15.0, 0.0, -13.0), Vector3(1.2, 0.45, 1.0), Color(0.46, 0.42, 0.35), 3.5,
		[ItemDatabase.make("cooking_pot", 1), ItemDatabase.make("iron_scrap", 2), ItemDatabase.make("splinted_greaves", 1, 80.0)]
	)
	_spawn_container(
		"Quarry Rubble Pile", Vector3(12.2, 0.0, -10.4), Vector3(1.0, 0.4, 0.8), Color(0.38, 0.36, 0.33), 2.5,
		[ItemDatabase.make("throwing_stone", 5), ItemDatabase.make("lamp_oil", 1), ItemDatabase.make("clean_rag_bandage", 1)]
	)

func _spawn_container(label: String, ground_pos: Vector3, size: Vector3, col: Color, search_time: float, contents: Array) -> Lootable:
	var body := StaticBody3D.new()
	body.name = label.replace(" ", "")
	body.position = ground_pos + Vector3(0.0, size.y * 0.5, 0.0)
	body.collision_layer = 1
	body.collision_mask = 0
	add_child(body)

	var cshape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	cshape.shape = box
	body.add_child(cshape)

	var mesh := MeshInstance3D.new()
	var bmesh := BoxMesh.new()
	bmesh.size = size
	mesh.mesh = bmesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = col
	mat.roughness = 0.92
	mesh.material_override = mat
	body.add_child(mesh)

	var loot := Lootable.new()
	loot.display_name = label
	loot.set_meta("save_kind", "container")
	loot.search_duration = search_time
	loot.position = Vector3(0.0, -size.y * 0.5, 0.0)
	for inst: Variant in contents:
		if inst is ItemInstance:
			loot.items.append(inst)
	body.add_child(loot)
	return loot
