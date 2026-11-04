class_name AshenWildsBootstrap
extends Node3D

var _player: PlayerController
var _camera_rig: IsoCameraRig
var _hud: TacticalHUD
var _audio: ProceduralAudio
var _coordinator: EncounterCoordinator
var _weather: Weather
var _unseen_cue_at: float = 0.0
var _unseen_banner_at: float = 0.0
var _shelter_spawn: Vector3 = Vector3(-6.5, 0.0, 6.5)
## The shelter fire's ember bed; its glow breathes with the fire's light (FlickerLight).
var _ember_material: StandardMaterial3D = StandardMaterial3D.new()

func _ready() -> void:
	_ensure_input_bindings()

	_audio = ProceduralAudio.new()
	add_child(_audio)

	_coordinator = EncounterCoordinator.new()
	add_child(_coordinator)

	var world_env := _build_atmosphere_and_lighting()
	_camera_rig = IsoCameraRig.new()
	_camera_rig.bind_world_environment(world_env)
	add_child(_camera_rig)

	_build_blackfen_test_yard()
	add_child(SetDressing.new())

	_player = PlayerController.new()
	_player.position = _shelter_spawn
	_player.camera_rig = _camera_rig
	_player.audio = _audio
	add_child(_player)
	_camera_rig.target = _player
	_camera_rig.global_position = _shelter_spawn
	var ash := AshFall.new()
	ash.follow = _player
	add_child(ash)

	_spawn_all_archetype_encounters()

	_spawn_scavenge_containers()

	add_child(VisionConeOverlay.new(_player))
	add_child(Vignette.new())
	_hud = TacticalHUD.new()
	add_child(_hud)
	_hud.bind_player(_player)
	_player.perception.heard.connect(_on_unseen_noise_heard)
	_weather = Weather.new()
	add_child(_weather)
	_weather.bind(world_env.environment, find_child("Moon", false, false) as DirectionalLight3D, ash,
		find_child("ShelterFireLight", true, false) as FlickerLight, _player)
	_weather.changed.connect(_on_weather_changed)
	_hud.set_background(_player.background.title)
	if DisplayServer.get_name() != "headless":
		_show_background_select()
	_hud.show_banner("MILESTONE 4 — Search with [E], manage your pack with [Tab].  [F1] Watchhouse  [F2] Ork Choke  [F3] Ogre Lair", Color(0.82, 0.76, 0.65))

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
			KEY_F4:
				_player.perception.enabled = not _player.perception.enabled
				_hud.show_banner("Vision cone %s" % ("on" if _player.perception.enabled else "off (dev)"), Color(0.75, 0.75, 0.75))
			KEY_F5:
				_weather.advance()
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

## Night in the Blackfen (look and feel 3): cold moonlight and a desaturated, contrasty grade, so
## fire and torchlight read as warm pools; low mist along the ground; glow on flames and embers.
## Everything here works in the browser's Compatibility renderer too, except SSAO (desktop only,
## and simply off there). The camera rig's brightness setting moves tonemap_exposure on top.
func _build_atmosphere_and_lighting() -> WorldEnvironment:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.035, 0.04, 0.05)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.24, 0.27, 0.32)
	env.ambient_light_energy = 2.6
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.7
	env.tonemap_white = 6.0
	# Distance fog plus a low mist that pools in the first metre above the ground.
	env.fog_enabled = true
	env.fog_light_color = Color(0.22, 0.25, 0.29)
	env.fog_density = 0.012
	env.fog_aerial_perspective = 0.25
	env.fog_height = 0.6
	env.fog_height_density = 0.08
	# Flames, embers and the torch bloom a little; nothing else is bright enough to.
	env.glow_enabled = true
	env.glow_intensity = 0.8
	env.glow_strength = 1.0
	env.glow_bloom = 0.02
	env.glow_hdr_threshold = 1.0
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
	# The grade: drained colour, a touch more contrast.
	env.adjustment_enabled = true
	env.adjustment_brightness = 1.12
	env.adjustment_contrast = 1.08
	env.adjustment_saturation = 0.8
	# Contact shadows where props meet the ground (desktop renderer only).
	env.ssao_enabled = true
	env.ssao_radius = 1.2
	env.ssao_intensity = 1.2

	var world_env := WorldEnvironment.new()
	world_env.environment = env
	add_child(world_env)

	# The moon: cold, dim, low enough for long shadows.
	var moon := DirectionalLight3D.new()
	moon.name = "Moon"
	moon.rotation_degrees = Vector3(-48.0, -35.0, 0.0)
	moon.light_color = Color(0.50, 0.58, 0.76)
	moon.light_energy = 3.0
	moon.shadow_enabled = true
	moon.shadow_blur = 1.5
	add_child(moon)
	return world_env

func _build_blackfen_test_yard() -> void:
	var cutaway_shader: Shader = load("res://shaders/foreground_cutaway.gdshader")

	_create_static_box(
		Vector3(0.0, -0.25, 0.0),
		Vector3(52.0, 0.5, 52.0),
		Color(0.18, 0.16, 0.14),
		cutaway_shader,
		false,
		false,
		"mud"
	)

	_create_static_box(
		Vector3(-6.5, 0.2, 4.8),
		Vector3(0.9, 0.4, 0.9),
		Color(0.25, 0.22, 0.20),
		cutaway_shader,
		false,
		false,
		"dark_stone"
	)
	_build_fire_bed(Vector3(-6.5, 0.4, 4.8))
	var fire_light := FlickerLight.new()
	fire_light.name = "ShelterFireLight"
	fire_light.ember_material = _ember_material
	fire_light.position = Vector3(-6.5, 1.1, 4.8)
	fire_light.light_color = Color(0.96, 0.54, 0.22)
	fire_light.light_energy = 2.4
	fire_light.omni_range = 9.0
	fire_light.shadow_enabled = true
	add_child(fire_light)

	_camera_rig.register_interior_aabb(AABB(Vector3(1.1, 0.0, -6.9), Vector3(7.8, 3.8, 7.8)))

	var stone_col := Color(0.28, 0.27, 0.25)
	_create_static_box(Vector3(5.0, 1.6, -7.0), Vector3(8.0, 3.2, 0.4), stone_col, cutaway_shader, false, false, "stone")
	# East wall faces the camera (rig sits on the +X/+Z side), so it needs the
	# cutaway too or it hides the eastern half of the watchhouse interior.
	_create_static_box(Vector3(9.0, 1.6, -3.0), Vector3(0.4, 3.2, 8.0), stone_col, cutaway_shader, true, false, "stone")

	# West Foreground Wall with 1.35m doorway at Z = -2.675 (Blocks 1.70m Ogre)
	_create_static_box(Vector3(1.0, 1.6, -5.175), Vector3(0.4, 3.2, 3.65), stone_col, cutaway_shader, true, false, "stone")
	_create_static_box(Vector3(1.0, 1.6, -0.5), Vector3(0.4, 3.2, 3.0), stone_col, cutaway_shader, true, false, "stone")
	_create_static_box(Vector3(1.0, 2.7, -2.675), Vector3(0.4, 1.0, 1.35), stone_col, cutaway_shader, true, false, "stone")

	_create_static_box(Vector3(5.0, 1.6, 1.0), Vector3(8.0, 3.2, 0.4), stone_col, cutaway_shader, true, false, "stone")

	# Milestone 5: a 1.7 m-wide entry hall running in from the west doorway.
	# Sweeping blades clang off these walls; thrusts work.
	var hall_col := Color(0.25, 0.24, 0.22)
	_create_static_box(Vector3(2.9, 1.2, -3.675), Vector3(3.4, 2.4, 0.3), hall_col, cutaway_shader, true, false, "dark_stone")
	_create_static_box(Vector3(2.9, 1.2, -1.675), Vector3(3.4, 2.4, 0.3), hall_col, cutaway_shader, true, false, "dark_stone")

	_create_static_box(
		Vector3(5.0, 3.35, -3.0),
		Vector3(8.4, 0.3, 8.4),
		Color(0.22, 0.18, 0.15),
		cutaway_shader,
		true,
		true,
		"planks"
	)
	var shadow_proxy := MeshInstance3D.new()
	var sp_box := BoxMesh.new()
	sp_box.size = Vector3(8.4, 0.3, 8.4)
	shadow_proxy.mesh = sp_box
	shadow_proxy.position = Vector3(5.0, 3.35, -3.0)
	shadow_proxy.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY
	add_child(shadow_proxy)

	_create_static_box(Vector3(11.0, 1.4, 5.5), Vector3(4.5, 2.8, 0.6), stone_col, cutaway_shader, false, false, "stone")
	_create_static_box(Vector3(15.5, 1.4, 9.5), Vector3(0.6, 2.8, 5.0), stone_col, cutaway_shader, true, false, "stone")

	_create_static_box(Vector3(-11.5, 1.5, -14.5), Vector3(1.6, 3.0, 1.6), stone_col, cutaway_shader, false, false, "stone")
	_create_static_box(Vector3(-16.5, 1.2, -10.5), Vector3(1.4, 2.4, 1.4), stone_col, cutaway_shader, false, false, "stone")

## The shelter fire's visible fire: a glowing ember bed and three charred logs on the stone ring.
## Decoration only (no collision; the ring under it is the obstacle). The light stays separate.
func _build_fire_bed(top: Vector3) -> void:
	var embers := MeshInstance3D.new()
	var disc := CylinderMesh.new()
	disc.top_radius = 0.34
	disc.bottom_radius = 0.38
	disc.height = 0.05
	embers.mesh = disc
	var glow := _ember_material
	glow.albedo_color = Color(0.25, 0.08, 0.02)
	glow.emission_enabled = true
	glow.emission = Color(0.95, 0.28, 0.05)
	glow.emission_energy_multiplier = 1.4
	embers.material_override = glow
	embers.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	embers.position = top + Vector3(0.0, 0.03, 0.0)
	add_child(embers)
	var charred := surface_material("planks", Color(0.35, 0.3, 0.27))
	for i: int in range(3):
		var log_mesh := MeshInstance3D.new()
		var cyl := CylinderMesh.new()
		cyl.top_radius = 0.06
		cyl.bottom_radius = 0.07
		cyl.height = 0.75
		log_mesh.mesh = cyl
		log_mesh.material_override = charred
		log_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		log_mesh.position = top + Vector3(0.0, 0.12, 0.0)
		log_mesh.rotation_degrees = Vector3(72.0, i * 60.0, 0.0)
		add_child(log_mesh)

## Photo textures for the level (ambientCG, CC0; art/ambientcg/README.md): albedo with the AO
## baked in, an OpenGL normal map, repeats per metre and a tint that darkens them for the Blackfen.
const SURFACES: Dictionary = {
	"mud": ["res://art/ambientcg/mud_albedo.jpg", "res://art/ambientcg/mud_normal.jpg", 0.32, Color(0.62, 0.58, 0.54)],
	"stone": ["res://art/ambientcg/stone_albedo.jpg", "res://art/ambientcg/stone_normal.jpg", 0.42, Color(0.58, 0.57, 0.55)],
	"dark_stone": ["res://art/ambientcg/stone_albedo.jpg", "res://art/ambientcg/stone_normal.jpg", 0.42, Color(0.44, 0.43, 0.42)],
	"planks": ["res://art/ambientcg/planks_albedo.jpg", "res://art/ambientcg/planks_normal.jpg", 0.55, Color(0.62, 0.55, 0.48)],
}

## Makes a StandardMaterial3D for a prop (container, pile) from one of SURFACES, projected in
## object space so it tiles with the prop's size.
static func surface_material(surface: String, tint: Color = Color.WHITE) -> StandardMaterial3D:
	var def: Array = SURFACES[surface]
	var mat := StandardMaterial3D.new()
	mat.albedo_texture = load(def[0]) as Texture2D
	mat.normal_enabled = true
	mat.normal_texture = load(def[1]) as Texture2D
	mat.normal_scale = 0.8
	mat.uv1_triplanar = true
	mat.uv1_world_triplanar = true
	mat.uv1_scale = Vector3.ONE * float(def[2]) * 2.0
	mat.albedo_color = (def[3] as Color) * tint
	mat.roughness = 0.95
	return mat

func _create_static_box(
	pos: Vector3,
	size: Vector3,
	col: Color,
	shader: Shader,
	enable_cutaway: bool,
	is_roof: bool,
	surface: String = ""
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
	if surface != "":
		var def: Array = SURFACES[surface]
		mat.set_shader_parameter("use_texture", true)
		mat.set_shader_parameter("albedo_tex", load(def[0]))
		mat.set_shader_parameter("normal_tex", load(def[1]))
		mat.set_shader_parameter("tex_scale", def[2])
		mat.set_shader_parameter("tex_tint", def[3])
		# The photo already carries its own dirt; the procedural grime would double it.
		mat.set_shader_parameter("grime_strength", 0.12)
	mesh_inst.material_override = mat
	body.add_child(mesh_inst)

	if enable_cutaway or is_roof:
		_camera_rig.register_cutaway_material(mat, is_roof)

func _on_enemy_bark(message: String) -> void:
	if _hud:
		_hud.show_banner(message, Color(0.86, 0.68, 0.38))

func _spawn_all_archetype_encounters() -> void:
	var goblin_yard := EnemyGoblinScavenger.new()
	goblin_yard.position = Vector3(-1.2, 0.0, -3.2)
	goblin_yard.player_ref = _player
	goblin_yard.audio = _audio
	goblin_yard.coordinator = _coordinator
	goblin_yard.patrol_points = [Vector3(-1.2, 0.0, -4.5), Vector3(-3.0, 0.0, 0.5)]
	add_child(goblin_yard)
	goblin_yard.goblin_combat_bark.connect(_on_enemy_bark)

	var goblin_inside := EnemyGoblinScavenger.new()
	goblin_inside.position = Vector3(5.2, 0.0, -3.2)
	goblin_inside.player_ref = _player
	goblin_inside.audio = _audio
	goblin_inside.coordinator = _coordinator
	goblin_inside.patrol_points = [Vector3(6.8, 0.0, -5.2), Vector3(6.8, 0.0, -1.4)]
	add_child(goblin_inside)
	goblin_inside.goblin_combat_bark.connect(_on_enemy_bark)

	var ork_shield := EnemyOrkWarrior.new()
	ork_shield.has_shield = true
	ork_shield.position = Vector3(12.2, 0.0, 8.2)
	ork_shield.player_ref = _player
	ork_shield.audio = _audio
	ork_shield.coordinator = _coordinator
	ork_shield.patrol_points = [Vector3(11.8, 0.0, 7.5), Vector3(13.5, 0.0, 10.5)]
	add_child(ork_shield)
	ork_shield.ork_combat_bark.connect(func(msg: String) -> void:
		if _hud:
			_hud.show_banner(msg, Color(0.86, 0.68, 0.38))
	)

	var ork_cleaver := EnemyOrkWarrior.new()
	ork_cleaver.has_shield = false
	# The reckless one: no shield, presses harder, rests less (see EnemyOrkWarrior's temperament).
	ork_cleaver.aggression = 0.85
	ork_cleaver.position = Vector3(14.0, 0.0, 9.8)
	ork_cleaver.player_ref = _player
	ork_cleaver.audio = _audio
	ork_cleaver.coordinator = _coordinator
	ork_cleaver.patrol_points = [Vector3(14.0, 0.0, 11.2), Vector3(12.5, 0.0, 8.8)]
	add_child(ork_cleaver)

	var ogre := EnemyOgreBrute.new()
	ogre.position = Vector3(-13.5, 0.0, -11.5)
	ogre.player_ref = _player
	ogre.audio = _audio
	ogre.coordinator = _coordinator
	add_child(ogre)
	ogre.ogre_event_banner.connect(func(txt: String, col: Color) -> void:
		if _hud:
			_hud.show_banner(txt, col)
	)
	ogre.ogre_ground_shockwave.connect(func(trauma: float) -> void:
		if _camera_rig:
			_camera_rig.add_trauma(trauma)
	)

## The survivor heard something they cannot see (Perception): a soft cue, and now and then a
## reminder that the rings on the ground are where the sound came from.
## The start screen. The world is built and paused behind it; headless runs (the suite, CI) skip
## it and keep the default background, the Watch Deserter.
func _show_background_select() -> void:
	var picker := BackgroundSelect.new()
	add_child(picker)
	get_tree().paused = true
	picker.chosen.connect(func(bg: SurvivorBackground) -> void:
		_player.apply_background(bg)
		_hud.set_background(bg.title)
		get_tree().paused = false
		picker.queue_free()
		_hud.show_banner(bg.epigraph, Color(0.86, 0.80, 0.68))
	)

func _on_weather_changed(condition: Weather.Condition, banner: String) -> void:
	if _hud:
		_hud.set_weather(_weather.condition_name(condition))
		_hud.show_banner(banner, Color(0.64, 0.70, 0.78))

func _on_unseen_noise_heard(_pos: Vector3, loudness: float) -> void:
	var now: float = Time.get_ticks_msec() / 1000.0
	if now >= _unseen_cue_at and _audio:
		_unseen_cue_at = now + 1.6
		_audio.play_unseen_threat_cue()
	if loudness >= 7.0 and now >= _unseen_banner_at and _hud:
		_unseen_banner_at = now + 12.0
		_hud.show_banner("Something moves where you cannot see. The rings are where it is.", Color(0.75, 0.68, 0.52))

# ------------------------------------------------------------------------------
# Milestone 4 — scavenging containers
# ------------------------------------------------------------------------------
func _spawn_scavenge_containers() -> void:
	# Your own stash by the shelter fire: already known, opens instantly.
	var stash := _spawn_container(
		"Shelter Stash", Vector3(-7.9, 0.0, 7.0), Vector3(0.9, 0.55, 0.6), Color(0.40, 0.29, 0.19), 0.0,
		[ItemDatabase.make("clean_rag_bandage", 1), ItemDatabase.make("timber", 1)]
	)
	stash.searched = true

	_spawn_container(
		"Rotted Grain Crate", Vector3(-4.2, 0.0, 2.2), Vector3(0.8, 0.7, 0.7), Color(0.38, 0.29, 0.19), 2.0,
		[ItemDatabase.make("timber", 2), ItemDatabase.make("iron_scrap", 1)]
	)
	_spawn_container(
		"Watchhouse Supply Chest", Vector3(7.4, 0.0, -5.6), Vector3(1.0, 0.6, 0.6), Color(0.36, 0.27, 0.18), 3.0,
		[ItemDatabase.make("boar_spear", 1, 72.0), ItemDatabase.make("clean_rag_bandage", 1), ItemDatabase.make("salt", 2)]
	)
	_spawn_container(
		"Ork Plunder Pile", Vector3(13.2, 0.0, 12.4), Vector3(1.1, 0.5, 0.9), Color(0.34, 0.28, 0.22), 2.5,
		[ItemDatabase.make("woodsmans_broadaxe", 1, 90.0), ItemDatabase.make("lamp_oil", 1), ItemDatabase.make("clean_rag_bandage", 1)]
	)
	_spawn_container(
		"Gnawed Bone Heap", Vector3(-15.0, 0.0, -13.0), Vector3(1.2, 0.45, 1.0), Color(0.46, 0.42, 0.35), 3.5,
		[ItemDatabase.make("cooking_pot", 1), ItemDatabase.make("iron_scrap", 2)]
	)

## Search containers wear the owner's crate and barrel kit (assets/environment/env007), fitted
## inside their collision box; the bone heap is a pale tangle of twigs. If a model is missing,
## the textured box stays.
const CONTAINER_MODELS: Dictionary = {
	"Shelter Stash": ["env007/exports/env_crate_v12_wide_low.glb", Color.WHITE],
	"Rotted Grain Crate": ["env007/exports/env_crate_v01_cross_braced.glb", Color(0.85, 0.82, 0.78)],
	"Watchhouse Supply Chest": ["env007/exports/env_crate_v11_hinged_lid.glb", Color(0.8, 0.78, 0.74)],
	"Ork Plunder Pile": ["env007/exports/env_crate_v08_open_top.glb", Color(0.75, 0.72, 0.68)],
	"Gnawed Bone Heap": ["env008/exports/env_ground_11_twigs_dense.glb", Color(1.6, 1.5, 1.3)],
}

## Crates and chests are weathered planks; heaps keep a flat colour.
func _container_material(label: String, col: Color) -> Material:
	if label.contains("Heap"):
		var flat := StandardMaterial3D.new()
		flat.albedo_color = col
		flat.roughness = 0.92
		return flat
	var tint := Color(0.85, 0.82, 0.78) if label.contains("Chest") else Color.WHITE
	return surface_material("planks", tint)

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
	mesh.material_override = _container_material(label, col)
	body.add_child(mesh)
	if CONTAINER_MODELS.has(label):
		var spec: Array = CONTAINER_MODELS[label]
		var holder := Node3D.new()
		holder.name = "Model"
		holder.position = Vector3(0.0, -size.y * 0.5, 0.0)
		body.add_child(holder)
		# A flat heap of twigs would vanish if squeezed into the heap's box height; fit it by footprint.
		var fit := Vector3(size.x, 10.0, size.z) if label.contains("Heap") else size
		if SetDressing.fitted_model(holder, String(spec[0]), fit, spec[1]) != null:
			mesh.visible = false

	var loot := Lootable.new()
	loot.display_name = label
	loot.search_duration = search_time
	loot.position = Vector3(0.0, -size.y * 0.5, 0.0)
	for inst: Variant in contents:
		if inst is ItemInstance:
			loot.items.append(inst)
	body.add_child(loot)
	return loot
