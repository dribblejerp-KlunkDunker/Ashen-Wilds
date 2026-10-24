class_name EnemyRotBeast
extends CharacterBody3D
## Milestone 21: the Rot-Beast of the Bile Pit. A bloated, hunch-backed thing
## that hunts by sight and sound. Close in, it bites (a thrust: it never
## clangs) and the bite can open a wound. From mid range it rears back,
## swells (the telegraph) and vomits a 6 m line of bile in the direction it
## faced when the rearing ended. Caught in the spray you take damage and your
## worn armour corrodes; the bile then lies on the ground as a BilePool that
## slows and corrodes anyone who stands in it.

signal beast_event_banner(text: String, col: Color)

enum AIState { IDLE, PURSUE, BITE_STARTUP, BITE_ACTIVE, VOMIT_STARTUP, RECOVERY, STAGGER, DEAD }

@export var enemy_name: String = "Rot-Beast"
@export var max_health: float = 260.0
@export var max_poise: float = 90.0
@export var move_speed: float = 2.4
@export var sight_range: float = 12.0
@export var bite_range: float = 2.0
@export var vomit_min_range: float = 2.5
@export var vomit_max_range: float = 7.0
@export var vomit_length: float = 6.0
@export var vomit_width: float = 1.4
@export var vomit_cooldown_time: float = 6.0
@export var vomit_damage: float = 14.0
@export var vomit_corrode: float = 12.0
@export var bite_bleed_chance: float = 0.3

var health: float = 260.0
var poise_damage: float = 0.0
var state: AIState = AIState.IDLE
var player_ref: PlayerController
var audio: ProceduralAudio
var coordinator: EncounterCoordinator

var _home_pos: Vector3 = Vector3.ZERO
var _target_pos: Vector3 = Vector3.ZERO
var _memory_timer: float = 0.0
var _state_timer: float = 0.0
var _vomit_cooldown: float = 0.0
var _facing_dir: Vector3 = Vector3.FORWARD
var _knockback_vel: Vector3 = Vector3.ZERO
var _step_timer: float = 0.0

var _visual_root: Node3D
var _status_mat: StandardMaterial3D
var _pip: MeshInstance3D
var _hitbox: HitboxComponent
var _hurtbox: HurtboxComponent

func _ready() -> void:
	add_to_group("enemy")
	health = max_health
	_home_pos = global_position
	_build_beast_visuals_and_colliders()
	AcousticField.listen(self, _on_noise_heard)

func _physics_process(delta: float) -> void:
	if player_ref:
		_visual_root.visible = player_ref.can_see_body(self)
	if state == AIState.DEAD:
		return
	_knockback_vel = _knockback_vel.move_toward(Vector3.ZERO, 14.0 * delta)
	_vomit_cooldown = maxf(0.0, _vomit_cooldown - delta)
	if poise_damage > 0.0:
		poise_damage = maxf(0.0, poise_damage - 5.0 * delta)
	if _memory_timer > 0.0:
		_memory_timer = maxf(0.0, _memory_timer - delta)
	if sees_player():
		_hunt(player_ref.global_position)
	_process_ai_state(delta)
	_update_visual_telegraph()
	if not is_on_floor():
		velocity.y -= 24.0 * delta
	else:
		velocity.y = -0.1
	move_and_slide()
	_step_timer = AcousticField.step_cadence(self, _step_timer, delta, 0.5, 7.0)

func is_dead() -> bool:
	return state == AIState.DEAD

func is_staggered() -> bool:
	return state == AIState.STAGGER

# ------------------------------------------------------------------------------
# Senses
# ------------------------------------------------------------------------------
func _player_alive() -> bool:
	return player_ref != null and player_ref.current_state != PlayerController.ActionState.DEAD

func _flat(v: Vector3) -> Vector3:
	return Vector3(v.x, 0.0, v.z)

func _player_dist() -> float:
	return _flat(player_ref.global_position - global_position).length() if player_ref else INF

func sees_player() -> bool:
	if not _player_alive():
		return false
	var to_p: Vector3 = _flat(player_ref.global_position - global_position)
	var d: float = to_p.length()
	if d > sight_range * WeatherSystem.factor(self, "sight"):
		return false
	if d > 2.5 and _facing_dir.dot(to_p / d) < cos(deg_to_rad(70.0)):
		return false
	var q := PhysicsRayQueryParameters3D.create(
		global_position + Vector3(0.0, 1.2, 0.0), player_ref.global_position + Vector3(0.0, 1.1, 0.0), 1
	)
	return get_world_3d().direct_space_state.intersect_ray(q).is_empty()

func _hunt(pos: Vector3) -> void:
	_target_pos = pos
	_memory_timer = 6.0
	if state == AIState.IDLE:
		state = AIState.PURSUE
		if audio:
			audio.play_ogre_roar()
		AcousticField.report(self, global_position, 12.0, "roar")

func _on_noise_heard(world_pos: Vector3, reach: float, source: Node3D, kind: String) -> void:
	if state == AIState.DEAD or source == self or not is_inside_tree():
		return
	if not (source is PlayerController or kind in ["clang", "caw", "bleat"]):
		return
	if AcousticField.can_hear(self, world_pos, reach):
		_hunt(world_pos)

# ------------------------------------------------------------------------------
# AI
# ------------------------------------------------------------------------------
func _process_ai_state(delta: float) -> void:
	match state:
		AIState.IDLE:
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z

		AIState.PURSUE:
			if _memory_timer <= 0.0:
				var home: Vector3 = _flat(_home_pos - global_position)
				if home.length() < 1.0:
					state = AIState.IDLE
				else:
					_steer_toward(home.normalized(), move_speed * 0.6, delta)
				return
			if _player_alive() and sees_player():
				var d: float = _player_dist()
				if d <= bite_range:
					if coordinator == null or coordinator.request_attack_token(self, true):
						state = AIState.BITE_STARTUP
						_state_timer = 0.7
						return
				elif d >= vomit_min_range and d <= vomit_max_range and _vomit_cooldown <= 0.0:
					state = AIState.VOMIT_STARTUP
					_state_timer = 1.0
					beast_event_banner.emit("The Rot-Beast rears back, swelling…", Color(0.70, 0.78, 0.30))
					return
			var to_t: Vector3 = _flat(_target_pos - global_position)
			if to_t.length() < 0.8:
				# At the last place it saw or heard you: look around.
				velocity.x = _knockback_vel.x
				velocity.z = _knockback_vel.z
				_face_direction(_facing_dir.rotated(Vector3.UP, 0.6), 2.0, delta)
			else:
				_steer_toward(to_t.normalized(), move_speed, delta)

		AIState.BITE_STARTUP, AIState.VOMIT_STARTUP:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _player_alive():
				var aim: Vector3 = _flat(player_ref.global_position - global_position)
				if aim.length_squared() > 0.01:
					_face_direction(aim.normalized(), 2.5, delta)
			if _state_timer <= 0.0:
				if state == AIState.BITE_STARTUP:
					_bite()
				else:
					vomit()

		AIState.BITE_ACTIVE:
			_state_timer -= delta
			velocity.x = _facing_dir.x * 2.0 + _knockback_vel.x
			velocity.z = _facing_dir.z * 2.0 + _knockback_vel.z
			if _state_timer <= 0.0:
				_end_attack(1.0)

		AIState.RECOVERY, AIState.STAGGER:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _state_timer <= 0.0:
				state = AIState.PURSUE

func _bite() -> void:
	state = AIState.BITE_ACTIVE
	_state_timer = 0.18
	if audio:
		audio.play_swing()
	AcousticField.report(self, global_position, 8.0, "swing")
	_hitbox.begin_swing(CombatPayload.new(self, global_position, _facing_dir, 30.0, 35.0, randf() < bite_bleed_chance, true, 3.0))

## Spews the bile line along its facing and leaves a pool. Returns true if
## the spray caught the survivor. Public so tests can fire it directly.
func vomit() -> bool:
	_vomit_cooldown = vomit_cooldown_time
	_end_attack(1.6)
	if audio:
		audio.play_cough()
	AcousticField.report(self, global_position, 10.0, "retch")
	# The spray stops at a wall.
	var from: Vector3 = global_position + Vector3(0.0, 0.6, 0.0) + _facing_dir * 0.8
	var wall := get_world_3d().direct_space_state.intersect_ray(PhysicsRayQueryParameters3D.create(from, from + _facing_dir * vomit_length, 1))
	var reach: float = vomit_length if wall.is_empty() else maxf(0.5, from.distance_to(wall["position"]))
	var pool := BilePool.new()
	pool.length = reach
	pool.width = vomit_width
	pool.player_ref = player_ref
	get_parent().add_child(pool)
	pool.global_position = Vector3(global_position.x, 0.0, global_position.z) + _facing_dir * 0.8
	pool.look_at(pool.global_position + _facing_dir, Vector3.UP)
	if not _player_alive() or not pool.contains(player_ref.global_position) or player_ref.is_evading():
		return false
	player_ref.take_hazard_damage(vomit_damage)
	player_ref.corrode_armor(vomit_corrode)
	beast_event_banner.emit("Bile splashes over you — your armour hisses and pits", Color(0.72, 0.80, 0.28))
	return true

func _end_attack(recovery: float) -> void:
	_hitbox.end_swing()
	if coordinator:
		coordinator.release_attack_token(self)
	state = AIState.RECOVERY
	_state_timer = recovery

func _steer_toward(dir: Vector3, speed: float, delta: float) -> void:
	_face_direction(dir, 4.0, delta)
	velocity.x = dir.x * speed + _knockback_vel.x
	velocity.z = dir.z * speed + _knockback_vel.z

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
		_hitbox.end_swing()
		if coordinator:
			coordinator.release_attack_token(self)
		state = AIState.DEAD
		collision_layer = 0
		_hurtbox.set_deferred("monitorable", false)
		_visual_root.rotation_degrees.z = 75.0
		_visual_root.position.y = 0.35
		Lootable.attach_corpse(self, "%s Carcass" % enemy_name, ItemDatabase.roll_rot_beast_loot(), 3.5)
		return
	poise_damage += payload.poise_damage
	if poise_damage >= max_poise:
		poise_damage = 0.0
		_hitbox.end_swing()
		if coordinator:
			coordinator.release_attack_token(self)
		state = AIState.STAGGER
		_state_timer = 1.0
		return
	if payload.attacker is PlayerController:
		_hunt(payload.attacker_origin)

# ------------------------------------------------------------------------------
# Visuals (placeholder; see docs/VISUAL_DIRECTION.md, sheet 12: vomiting rot-beast)
# ------------------------------------------------------------------------------
func _update_visual_telegraph() -> void:
	match state:
		AIState.VOMIT_STARTUP:
			_visual_root.rotation_degrees.x = 16.0 # rears back, gut swelling
			_visual_root.scale = Vector3.ONE * (1.0 + 0.08 * (1.0 - clampf(_state_timer, 0.0, 1.0)))
			_status_mat.albedo_color = Color(0.70, 0.82, 0.25)
		AIState.BITE_STARTUP:
			_visual_root.rotation_degrees.x = 6.0
			_visual_root.scale = Vector3.ONE
			_status_mat.albedo_color = Color(0.95, 0.60, 0.15)
		AIState.BITE_ACTIVE:
			_visual_root.rotation_degrees.x = -10.0
			_status_mat.albedo_color = Color(0.92, 0.18, 0.15)
		AIState.RECOVERY, AIState.STAGGER:
			_visual_root.rotation_degrees.x = 0.0
			_visual_root.scale = Vector3.ONE
			_status_mat.albedo_color = Color(0.42, 0.68, 0.85)
		_:
			_visual_root.rotation_degrees.x = 0.0
			_visual_root.scale = Vector3.ONE
			_status_mat.albedo_color = Color(0.40, 0.38, 0.24)
	# Keep the status ring flat on the ground while the body tilts.
	_pip.rotation_degrees.x = -_visual_root.rotation_degrees.x


func _build_beast_visuals_and_colliders() -> void:
	collision_layer = 4
	collision_mask = 1 | 2 | 4
	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.7
	cap.height = 1.8
	col.shape = cap
	col.position = Vector3(0.0, 0.9, 0.0)
	add_child(col)

	_visual_root = Node3D.new()
	add_child(_visual_root)
	var flesh := StandardMaterial3D.new()
	flesh.albedo_color = Color(0.40, 0.33, 0.26) # flayed, bruised
	flesh.roughness = 0.6
	var gut := MeshInstance3D.new()
	var g_mesh := SphereMesh.new()
	g_mesh.radius = 0.85
	g_mesh.height = 1.5
	gut.mesh = g_mesh
	gut.material_override = flesh
	gut.position = Vector3(0.0, 0.95, 0.1)
	_visual_root.add_child(gut)
	var hump := MeshInstance3D.new()
	var hu_mesh := SphereMesh.new()
	hu_mesh.radius = 0.55
	hu_mesh.height = 0.9
	hump.mesh = hu_mesh
	hump.material_override = flesh
	hump.position = Vector3(0.0, 1.6, 0.35)
	_visual_root.add_child(hump)
	var head := MeshInstance3D.new()
	var h_mesh := BoxMesh.new()
	h_mesh.size = Vector3(0.5, 0.42, 0.55)
	head.mesh = h_mesh
	head.material_override = flesh
	head.position = Vector3(0.0, 1.15, -0.85)
	_visual_root.add_child(head)
	var bile_mat := StandardMaterial3D.new()
	bile_mat.albedo_color = Color(0.55, 0.60, 0.18)
	var jaw := MeshInstance3D.new()
	var j_mesh := BoxMesh.new()
	j_mesh.size = Vector3(0.4, 0.1, 0.4)
	jaw.mesh = j_mesh
	jaw.material_override = bile_mat
	jaw.position = Vector3(0.0, 0.92, -0.95)
	_visual_root.add_child(jaw)

	_status_mat = StandardMaterial3D.new()
	_status_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_status_mat.albedo_color = Color(0.40, 0.38, 0.24)
	var pip := MeshInstance3D.new()
	var pip_mesh := CylinderMesh.new()
	pip_mesh.top_radius = 0.9
	pip_mesh.bottom_radius = 0.9
	pip_mesh.height = 0.03
	pip.mesh = pip_mesh
	pip.material_override = _status_mat
	pip.position = Vector3(0.0, 0.03, 0.0)
	_visual_root.add_child(pip)
	_pip = pip

	_hitbox = HitboxComponent.new()
	_hitbox.owner_entity = self
	_hitbox.collision_layer = 0
	_hitbox.collision_mask = 8
	var hb_col := CollisionShape3D.new()
	var hb_box := BoxShape3D.new()
	hb_box.size = Vector3(1.3, 1.2, 1.4)
	hb_col.shape = hb_box
	hb_col.position = Vector3(0.0, 1.0, -1.3)
	_hitbox.add_child(hb_col)
	_visual_root.add_child(_hitbox)

	_hurtbox = HurtboxComponent.new()
	_hurtbox.owner_entity = self
	_hurtbox.collision_layer = 16
	_hurtbox.collision_mask = 0
	var hurt_col := CollisionShape3D.new()
	var hurt_cap := CapsuleShape3D.new()
	hurt_cap.radius = 0.85
	hurt_cap.height = 2.0
	hurt_col.shape = hurt_cap
	hurt_col.position = Vector3(0.0, 1.0, 0.0)
	_hurtbox.add_child(hurt_col)
	add_child(_hurtbox)
	_hurtbox.hit_received.connect(_on_hurtbox_hit_received)
