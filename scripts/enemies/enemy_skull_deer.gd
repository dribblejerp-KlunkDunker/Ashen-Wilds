class_name EnemySkullDeer
extends CharacterBody3D
## Milestone 20: the Skull-Deer. Antlered, bone-faced prey of the Pale
## Glade. It never attacks. It notices the survivor by sight (a wide 260°
## field) or by noise, raises its head (WARY), and if you keep coming, or get
## within `bolt_radius`, it bolts with a bleat that every listening creature
## hears. A lit torch is seen from further. At night it doesn't run: it
## freezes and stares at you until you're within `night_bolt_radius`. Its
## carcass gives game meat.

enum AIState { GRAZE, WARY, FLEE, STARE, RETURN, DEAD }

@export var enemy_name: String = "Skull-Deer"
@export var max_health: float = 45.0
@export var notice_radius: float = 11.0
@export var torch_notice_bonus: float = 1.5
@export var bolt_radius: float = 6.0
@export var night_bolt_radius: float = 3.5
@export var wary_time: float = 1.6
@export var flee_speed: float = 7.2
@export var flee_time: float = 3.5
@export var bleat_reach: float = 14.0
@export var glade_radius: float = 9.0

var health: float = 45.0
var state: AIState = AIState.GRAZE
var player_ref: PlayerController
var audio: ProceduralAudio
var coordinator: EncounterCoordinator

var _glade_pos: Vector3 = Vector3.ZERO
var _graze_target: Vector3 = Vector3.ZERO
var _state_timer: float = 0.0
var _facing_dir: Vector3 = Vector3.FORWARD
var _flee_dir: Vector3 = Vector3.FORWARD
var _wary_start_dist: float = 0.0
var _step_timer: float = 0.0

var _visual_root: Node3D
var _eye_mat: StandardMaterial3D
var _hurtbox: HurtboxComponent

func _ready() -> void:
	add_to_group("enemy")
	health = max_health
	_glade_pos = global_position
	_graze_target = global_position
	_build_deer_visuals_and_colliders()
	AcousticField.listen(self, _on_noise_heard)

func _physics_process(delta: float) -> void:
	if player_ref:
		_visual_root.visible = player_ref.can_see_body(self)
	if state == AIState.DEAD:
		return
	_process_ai_state(delta)
	_update_visual_telegraph()
	if not is_on_floor():
		velocity.y -= 24.0 * delta
	else:
		velocity.y = -0.1
	move_and_slide()
	_step_timer = AcousticField.step_cadence(self, _step_timer, delta, 0.3 if state == AIState.FLEE else 0.7, 6.0 if state == AIState.FLEE else 2.5)

func is_dead() -> bool:
	return state == AIState.DEAD

func is_staggered() -> bool:
	return false

func is_fleeing() -> bool:
	return state == AIState.FLEE

func is_night_still() -> bool:
	return DayNightCycle.darkness(self) > 0.5

# ------------------------------------------------------------------------------
# Senses
# ------------------------------------------------------------------------------
func _player_alive() -> bool:
	return player_ref != null and player_ref.current_state != PlayerController.ActionState.DEAD

func _flat(v: Vector3) -> Vector3:
	return Vector3(v.x, 0.0, v.z)

func player_distance() -> float:
	return _flat(player_ref.global_position - global_position).length() if player_ref else INF

## How far away it notices you: further if you carry fire.
func get_notice_radius() -> float:
	var r: float = notice_radius * WeatherSystem.factor(self, "sight")
	if player_ref and player_ref.is_torch_lit():
		r *= torch_notice_bonus
	return r

func notices_player() -> bool:
	if not _player_alive():
		return false
	var to_p: Vector3 = _flat(player_ref.global_position - global_position)
	var d: float = to_p.length()
	if d > get_notice_radius():
		return false
	# Eyes on the sides of its skull: only a narrow blind spot behind.
	if d > 2.0 and _facing_dir.dot(to_p / d) < cos(deg_to_rad(130.0)):
		return false
	var q := PhysicsRayQueryParameters3D.create(
		global_position + Vector3(0.0, 1.3, 0.0), player_ref.global_position + Vector3(0.0, 1.1, 0.0), 1
	)
	return get_world_3d().direct_space_state.intersect_ray(q).is_empty()

func _on_noise_heard(world_pos: Vector3, reach: float, source: Node3D, kind: String) -> void:
	if state in [AIState.FLEE, AIState.DEAD] or source == self or not is_inside_tree():
		return
	if source is EnemySkullDeer and kind == "bleat":
		if AcousticField.can_hear(self, world_pos, reach):
			bolt(world_pos)
		return
	if not (source is PlayerController or kind in ["clang", "caw", "roar", "thud"]):
		return
	if AcousticField.can_hear(self, world_pos, reach):
		if kind in ["clang", "roar", "thud"] or reach >= 9.0:
			bolt(world_pos) # a loud noise sends it straight off
		elif state == AIState.GRAZE:
			_become_wary()

func _become_wary() -> void:
	state = AIState.WARY
	_state_timer = wary_time
	_wary_start_dist = player_distance()

## Runs away from `from_pos`, bleating. Public for tests and the herd.
func bolt(from_pos: Vector3) -> void:
	if state in [AIState.FLEE, AIState.DEAD]:
		return
	var away: Vector3 = _flat(global_position - from_pos)
	if away.length_squared() < 0.01:
		away = -_facing_dir
	_flee_dir = away.normalized()
	state = AIState.FLEE
	_state_timer = flee_time
	if audio:
		audio.play_caw()
	AcousticField.report(self, global_position, bleat_reach, "bleat")

# ------------------------------------------------------------------------------
# AI
# ------------------------------------------------------------------------------
func _process_ai_state(delta: float) -> void:
	match state:
		AIState.GRAZE:
			var to_g: Vector3 = _flat(_graze_target - global_position)
			if to_g.length() < 0.5:
				_graze_target = _glade_pos + Vector3(randf_range(-3.0, 3.0), 0.0, randf_range(-3.0, 3.0))
				velocity.x = 0.0
				velocity.z = 0.0
			else:
				_steer_toward(to_g.normalized(), 0.7, delta)
			if notices_player():
				if is_night_still():
					state = AIState.STARE
				else:
					_become_wary()

		AIState.WARY:
			_state_timer -= delta
			_hold_and_face_player(delta)
			if not _player_alive():
				state = AIState.GRAZE
				return
			var d: float = player_distance()
			if is_night_still():
				state = AIState.STARE
			elif d <= bolt_radius or d < _wary_start_dist - 1.5:
				bolt(player_ref.global_position)
			elif _state_timer <= 0.0:
				state = AIState.GRAZE if not notices_player() else AIState.WARY
				_state_timer = wary_time
				_wary_start_dist = d

		AIState.STARE:
			# Night: it doesn't run. It watches.
			_hold_and_face_player(delta)
			if not _player_alive() or not is_night_still():
				state = AIState.GRAZE
				return
			if player_distance() <= night_bolt_radius:
				bolt(player_ref.global_position)
			elif not notices_player():
				state = AIState.GRAZE

		AIState.FLEE:
			_state_timer -= delta
			_steer_toward(_flee_dir, flee_speed, delta)
			if _state_timer <= 0.0:
				state = AIState.RETURN

		AIState.RETURN:
			var to_home: Vector3 = _flat(_glade_pos - global_position)
			if to_home.length() < glade_radius * 0.5:
				state = AIState.GRAZE
				_graze_target = global_position
			else:
				_steer_toward(to_home.normalized(), 1.6, delta)
			if notices_player() and player_distance() <= bolt_radius:
				bolt(player_ref.global_position)

func _hold_and_face_player(delta: float) -> void:
	velocity.x = 0.0
	velocity.z = 0.0
	if _player_alive():
		var aim: Vector3 = _flat(player_ref.global_position - global_position)
		if aim.length_squared() > 0.01:
			_face_direction(aim.normalized(), 5.0, delta)

func _steer_toward(dir: Vector3, speed: float, delta: float) -> void:
	_face_direction(dir, 6.0, delta)
	velocity.x = dir.x * speed
	velocity.z = dir.z * speed

func _face_direction(dir: Vector3, turn_speed: float, delta: float) -> void:
	if _facing_dir.dot(dir) < -0.98:
		_facing_dir = _facing_dir.rotated(Vector3.UP, 0.25) # slerp can't turn through exactly 180°
	_facing_dir = _facing_dir.slerp(dir, 1.0 - exp(-turn_speed * delta)).normalized()
	_visual_root.look_at(global_position + _facing_dir, Vector3.UP)

# ------------------------------------------------------------------------------
# Taking hits
# ------------------------------------------------------------------------------
func _on_hurtbox_hit_received(payload: CombatPayload) -> void:
	if state == AIState.DEAD:
		return
	health = maxf(0.0, health - payload.physical_damage)
	if health <= 0.0:
		state = AIState.DEAD
		collision_layer = 0
		_hurtbox.set_deferred("monitorable", false)
		_visual_root.rotation_degrees.z = 85.0
		_visual_root.position.y = 0.25
		Lootable.attach_corpse(self, "%s Carcass" % enemy_name, ItemDatabase.roll_deer_loot(), 3.0)
		return
	bolt(payload.attacker_origin)

# ------------------------------------------------------------------------------
# Visuals (placeholder; see docs/VISUAL_DIRECTION.md, sheet 12: antlered skull-faced deer)
# ------------------------------------------------------------------------------
func _update_visual_telegraph() -> void:
	match state:
		AIState.WARY, AIState.STARE:
			_visual_root.rotation_degrees.x = 8.0 # head up
		_:
			_visual_root.rotation_degrees.x = 0.0
	# At night the eye sockets glow faintly.
	_eye_mat.albedo_color = Color(0.85, 0.80, 0.55) if is_night_still() else Color(0.06, 0.05, 0.05)

func _build_deer_visuals_and_colliders() -> void:
	collision_layer = 4
	collision_mask = 1 | 4
	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.4
	cap.height = 1.4
	col.shape = cap
	col.position = Vector3(0.0, 0.8, 0.0)
	add_child(col)

	_visual_root = Node3D.new()
	add_child(_visual_root)
	var coat := StandardMaterial3D.new()
	coat.albedo_color = Color(0.32, 0.28, 0.22)
	coat.roughness = 0.95
	var body := MeshInstance3D.new()
	var b_mesh := CapsuleMesh.new()
	b_mesh.radius = 0.3
	b_mesh.height = 1.3
	body.mesh = b_mesh
	body.material_override = coat
	body.rotation_degrees.x = 90.0
	body.position = Vector3(0.0, 1.0, 0.0)
	_visual_root.add_child(body)
	var neck := MeshInstance3D.new()
	var n_mesh := CylinderMesh.new()
	n_mesh.top_radius = 0.09
	n_mesh.bottom_radius = 0.13
	n_mesh.height = 0.6
	neck.mesh = n_mesh
	neck.material_override = coat
	neck.rotation_degrees.x = -35.0
	neck.position = Vector3(0.0, 1.35, -0.55)
	_visual_root.add_child(neck)
	var bone := StandardMaterial3D.new()
	bone.albedo_color = Color(0.82, 0.78, 0.68)
	var skull := MeshInstance3D.new()
	var s_mesh := BoxMesh.new()
	s_mesh.size = Vector3(0.22, 0.22, 0.38)
	skull.mesh = s_mesh
	skull.material_override = bone
	skull.position = Vector3(0.0, 1.62, -0.78)
	_visual_root.add_child(skull)
	_eye_mat = StandardMaterial3D.new()
	_eye_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_eye_mat.albedo_color = Color(0.06, 0.05, 0.05)
	for side: float in [-1.0, 1.0]:
		var eye := MeshInstance3D.new()
		var e_mesh := SphereMesh.new()
		e_mesh.radius = 0.035
		e_mesh.height = 0.07
		eye.mesh = e_mesh
		eye.material_override = _eye_mat
		eye.position = Vector3(0.1 * side, 1.67, -0.82)
		_visual_root.add_child(eye)
		var antler := MeshInstance3D.new()
		var a_mesh := CylinderMesh.new()
		a_mesh.top_radius = 0.015
		a_mesh.bottom_radius = 0.035
		a_mesh.height = 0.6
		antler.mesh = a_mesh
		antler.material_override = bone
		antler.position = Vector3(0.16 * side, 1.95, -0.7)
		antler.rotation_degrees = Vector3(-15.0, 0.0, -30.0 * side)
		_visual_root.add_child(antler)
	for leg_pos: Vector3 in [Vector3(-0.15, 0.35, -0.45), Vector3(0.15, 0.35, -0.45), Vector3(-0.15, 0.35, 0.45), Vector3(0.15, 0.35, 0.45)]:
		var leg := MeshInstance3D.new()
		var lm := CylinderMesh.new()
		lm.top_radius = 0.05
		lm.bottom_radius = 0.035
		lm.height = 0.7
		leg.mesh = lm
		leg.material_override = coat
		leg.position = leg_pos
		_visual_root.add_child(leg)

	_hurtbox = HurtboxComponent.new()
	_hurtbox.owner_entity = self
	_hurtbox.collision_layer = 16
	_hurtbox.collision_mask = 0
	var hurt_col := CollisionShape3D.new()
	var hurt_cap := CapsuleShape3D.new()
	hurt_cap.radius = 0.45
	hurt_cap.height = 1.5
	hurt_col.shape = hurt_cap
	hurt_col.position = Vector3(0.0, 0.9, 0.0)
	_hurtbox.add_child(hurt_col)
	add_child(_hurtbox)
	_hurtbox.hit_received.connect(_on_hurtbox_hit_received)
