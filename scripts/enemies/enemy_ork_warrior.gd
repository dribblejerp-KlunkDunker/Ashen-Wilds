class_name EnemyOrkWarrior
extends CharacterBody3D

signal ork_combat_bark(message: String)

enum AIState {
	IDLE,
	PATROL,
	INVESTIGATE,
	PURSUE,
	SHIELD_ADVANCE,
	COMBO_1_STARTUP,
	COMBO_1_ACTIVE,
	COMBO_LINK,
	COMBO_2_STARTUP,
	COMBO_2_ACTIVE,
	ATTACK_RECOVERY,
	GUARD_BROKEN,
	STAGGER,
	DEAD
}

@export var enemy_name: String = "Ork Vanguard"
@export var has_shield: bool = true
@export var max_health: float = 115.0
@export var max_poise: float = 42.0
@export var max_guard_stamina: float = 55.0
@export var patrol_points: Array[Vector3] = []

var health: float = 115.0
var poise_damage: float = 0.0
var guard_stamina: float = 55.0
var state: AIState = AIState.PATROL
var player_ref: PlayerController
var audio: ProceduralAudio
var coordinator: EncounterCoordinator

var _state_timer: float = 0.0
var _patrol_index: int = 0
var _last_known_player_pos: Vector3 = Vector3.ZERO
var _has_last_known_pos: bool = false
var _memory_timer: float = 0.0
var _facing_dir: Vector3 = Vector3.FORWARD
var _knockback_vel: Vector3 = Vector3.ZERO
var _strafe_sign: float = 1.0

var _visual_root: Node3D
var _weapon_arm: Node3D
var _shield_mesh: MeshInstance3D
var _status_mat: StandardMaterial3D
var _hitbox: HitboxComponent
var _hurtbox: HurtboxComponent

func _ready() -> void:
	health = max_health
	guard_stamina = max_guard_stamina
	_strafe_sign = 1.0 if randf() > 0.5 else -1.0
	_build_ork_visuals_and_colliders()

func _physics_process(delta: float) -> void:
	_update_player_los_visibility()
	if state == AIState.DEAD:
		return

	_knockback_vel = _knockback_vel.move_toward(Vector3.ZERO, 15.0 * delta)
	if state in [AIState.IDLE, AIState.PATROL, AIState.PURSUE]:
		guard_stamina = minf(max_guard_stamina, guard_stamina + 10.0 * delta)
	if poise_damage > 0.0:
		poise_damage = maxf(0.0, poise_damage - 6.0 * delta)

	_evaluate_senses(delta)
	_process_ai_state(delta)
	_update_visual_telegraph()

	if not is_on_floor():
		velocity.y -= 24.0 * delta
	else:
		velocity.y = -0.1
	move_and_slide()

func _update_player_los_visibility() -> void:
	if player_ref == null:
		return
	var space_state := get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(
		player_ref.global_position + Vector3(0.0, 1.35, 0.0),
		global_position + Vector3(0.0, 1.15, 0.0),
		1
	)
	_visual_root.visible = space_state.intersect_ray(q).is_empty()

func _evaluate_senses(delta: float) -> void:
	if player_ref == null or player_ref.current_state == PlayerController.ActionState.DEAD:
		return
	if _memory_timer > 0.0:
		_memory_timer = maxf(0.0, _memory_timer - delta)
		if _memory_timer == 0.0:
			_has_last_known_pos = false

	var to_player: Vector3 = player_ref.global_position - global_position
	var dist: float = to_player.length()
	var dir_p: Vector3 = to_player.normalized() if dist > 0.01 else Vector3.FORWARD

	var can_see: bool = false
	if dist <= 14.5:
		if _facing_dir.dot(dir_p) >= cos(deg_to_rad(60.0)) or dist <= 3.0:
			var space_state := get_world_3d().direct_space_state
			var q := PhysicsRayQueryParameters3D.create(
				global_position + Vector3(0.0, 1.25, 0.0),
				player_ref.global_position + Vector3(0.0, 1.1, 0.0),
				1
			)
			if space_state.intersect_ray(q).is_empty():
				can_see = true

	var can_hear: bool = (
		player_ref.current_state in [PlayerController.ActionState.SPRINT, PlayerController.ActionState.ATTACK_ACTIVE]
		and dist <= 10.0 * player_ref.get_noise_multiplier()
	)

	if can_see or can_hear:
		_last_known_player_pos = player_ref.global_position
		_has_last_known_pos = true
		_memory_timer = 9.0
		if state in [AIState.IDLE, AIState.PATROL, AIState.INVESTIGATE]:
			state = AIState.SHIELD_ADVANCE if has_shield else AIState.PURSUE

func _process_ai_state(delta: float) -> void:
	match state:
		AIState.IDLE:
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			_state_timer -= delta
			if _state_timer <= 0.0 and patrol_points.size() > 0:
				state = AIState.PATROL

		AIState.PATROL:
			if patrol_points.is_empty():
				state = AIState.IDLE
				_state_timer = 2.0
				return
			var pt: Vector3 = patrol_points[_patrol_index]
			var to_pt: Vector3 = pt - global_position
			to_pt.y = 0.0
			if to_pt.length() < 0.7:
				_patrol_index = (_patrol_index + 1) % patrol_points.size()
				state = AIState.IDLE
				_state_timer = 1.8
			else:
				_steer_toward(to_pt.normalized(), 2.3, delta)

		AIState.INVESTIGATE:
			if not _has_last_known_pos:
				state = AIState.PATROL
				return
			var to_inv: Vector3 = _last_known_player_pos - global_position
			to_inv.y = 0.0
			if to_inv.length() < 0.9:
				_has_last_known_pos = false
				state = AIState.IDLE
				_state_timer = 2.5
			else:
				_steer_toward(to_inv.normalized(), 2.8, delta)

		AIState.PURSUE, AIState.SHIELD_ADVANCE:
			if not _has_last_known_pos:
				state = AIState.INVESTIGATE
				return
			var to_p: Vector3 = _last_known_player_pos - global_position
			to_p.y = 0.0
			var dist: float = to_p.length()
			var dir_p: Vector3 = to_p.normalized() if dist > 0.01 else Vector3.FORWARD

			if has_shield and dist < 6.0:
				state = AIState.SHIELD_ADVANCE
			elif not has_shield:
				state = AIState.PURSUE

			if dist <= 2.05:
				if _try_begin_combo():
					return
				var tangent := Vector3(-dir_p.z * _strafe_sign, 0.0, dir_p.x * _strafe_sign)
				_face_direction(dir_p, 8.5, delta)
				velocity.x = tangent.x * 1.65 + _knockback_vel.x
				velocity.z = tangent.z * 1.65 + _knockback_vel.z
			else:
				var spd: float = 2.55 if state == AIState.SHIELD_ADVANCE else 3.75
				_steer_toward(dir_p, spd, delta)

		AIState.COMBO_1_STARTUP:
			_state_timer -= delta
			velocity.x = _facing_dir.x * 0.4 + _knockback_vel.x
			velocity.z = _facing_dir.z * 0.4 + _knockback_vel.z
			_track_player_lightly(3.8, delta)
			if _state_timer <= 0.0:
				_enter_combo_1_active()

		AIState.COMBO_1_ACTIVE:
			_state_timer -= delta
			velocity.x = _facing_dir.x * 4.4 + _knockback_vel.x
			velocity.z = _facing_dir.z * 4.4 + _knockback_vel.z
			if _state_timer <= 0.0:
				_hitbox.end_swing()
				state = AIState.COMBO_LINK
				_state_timer = 0.24

		AIState.COMBO_LINK:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			_track_player_lightly(5.0, delta)
			if _state_timer <= 0.0:
				if player_ref and global_position.distance_to(player_ref.global_position) <= 2.85:
					state = AIState.COMBO_2_STARTUP
					_state_timer = 0.54
				else:
					_finish_attack_sequence(0.78)

		AIState.COMBO_2_STARTUP:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			_track_player_lightly(2.6, delta)
			if _state_timer <= 0.0:
				_enter_combo_2_active()

		AIState.COMBO_2_ACTIVE:
			_state_timer -= delta
			velocity.x = _facing_dir.x * 5.6 + _knockback_vel.x
			velocity.z = _facing_dir.z * 5.6 + _knockback_vel.z
			if _state_timer <= 0.0:
				_hitbox.end_swing()
				_finish_attack_sequence(0.98)

		AIState.ATTACK_RECOVERY:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _state_timer <= 0.0:
				state = AIState.SHIELD_ADVANCE if has_shield else AIState.PURSUE

		AIState.GUARD_BROKEN, AIState.STAGGER:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _state_timer <= 0.0:
				guard_stamina = max_guard_stamina * 0.6
				state = AIState.PURSUE

func is_dead() -> bool:
	return state == AIState.DEAD

func is_staggered() -> bool:
	return state in [AIState.STAGGER, AIState.GUARD_BROKEN]

func _try_begin_combo() -> bool:
	if coordinator and not coordinator.request_attack_token(self):
		return false
	state = AIState.COMBO_1_STARTUP
	_state_timer = 0.48
	return true

func _enter_combo_1_active() -> void:
	state = AIState.COMBO_1_ACTIVE
	_state_timer = 0.16
	if audio:
		audio.play_swing()
	var payload := CombatPayload.new(
		self,
		global_position,
		_facing_dir,
		24.0,
		24.0,
		false,
		false,
		3.4
	)
	_hitbox.begin_swing(payload)

func _enter_combo_2_active() -> void:
	state = AIState.COMBO_2_ACTIVE
	_state_timer = 0.18
	if audio:
		audio.play_swing()
	var payload := CombatPayload.new(
		self,
		global_position,
		_facing_dir,
		36.0,
		38.0,
		true,
		true,
		5.2
	)
	_hitbox.begin_swing(payload)

func _finish_attack_sequence(recovery_duration: float) -> void:
	_hitbox.end_swing()
	if coordinator:
		coordinator.release_attack_token(self)
	state = AIState.ATTACK_RECOVERY
	_state_timer = recovery_duration

func _track_player_lightly(turn_speed: float, delta: float) -> void:
	if player_ref == null:
		return
	var to_p: Vector3 = player_ref.global_position - global_position
	to_p.y = 0.0
	if to_p.length_squared() > 0.01:
		_face_direction(to_p.normalized(), turn_speed, delta)

func _steer_toward(dir: Vector3, speed: float, delta: float) -> void:
	_face_direction(dir, 8.0, delta)
	velocity.x = dir.x * speed + _knockback_vel.x
	velocity.z = dir.z * speed + _knockback_vel.z

func _face_direction(dir: Vector3, turn_speed: float, delta: float) -> void:
	_facing_dir = _facing_dir.slerp(dir, 1.0 - exp(-turn_speed * delta)).normalized()
	_visual_root.look_at(global_position + _facing_dir, Vector3.UP)

func _on_hurtbox_hit_received(payload: CombatPayload) -> void:
	if state == AIState.DEAD:
		return

	var to_attacker: Vector3 = payload.attacker_origin - global_position
	to_attacker.y = 0.0
	if to_attacker.length_squared() > 0.001:
		to_attacker = to_attacker.normalized()

	var is_blocking_front: bool = (
		has_shield
		and state == AIState.SHIELD_ADVANCE
		and _facing_dir.dot(to_attacker) >= cos(deg_to_rad(62.0))
	)

	if is_blocking_front:
		guard_stamina -= payload.poise_damage
		_knockback_vel = -to_attacker * (payload.knockback_force * 0.65)
		if guard_stamina <= 0.0:
			if audio:
				audio.play_guard_break()
			state = AIState.GUARD_BROKEN
			_state_timer = 1.25
			ork_combat_bark.emit("Ork Shield Guard Shattered — Punish Opening!")
		else:
			if audio:
				audio.play_shield_block()
			ork_combat_bark.emit("Blocked by Ork Shield (Use Heavy Cleave [Q] or Flank!)")
		return

	health = maxf(0.0, health - payload.physical_damage)
	var poise_mult: float = 0.45 if state == AIState.COMBO_2_STARTUP else 1.0
	poise_damage += payload.poise_damage * poise_mult

	_last_known_player_pos = payload.attacker_origin
	_has_last_known_pos = true
	_memory_timer = 10.0
	_knockback_vel = -to_attacker * (payload.knockback_force * 0.75)

	if health <= 0.0:
		_hitbox.end_swing()
		if coordinator:
			coordinator.release_attack_token(self)
		state = AIState.DEAD
		collision_layer = 0
		_hurtbox.set_deferred("monitorable", false)
		_visual_root.rotation_degrees.x = -85.0
		_visual_root.position.y = 0.25
		Lootable.attach_corpse(self, "%s Corpse" % enemy_name, ItemDatabase.roll_ork_loot(), 3.0)
		return

	if poise_damage >= max_poise:
		_hitbox.end_swing()
		if coordinator:
			coordinator.release_attack_token(self)
		poise_damage = 0.0
		state = AIState.STAGGER
		_state_timer = 0.65

func _update_visual_telegraph() -> void:
	match state:
		AIState.SHIELD_ADVANCE:
			_weapon_arm.rotation_degrees = Vector3(-15.0, 20.0, 0.0)
			if _shield_mesh:
				_shield_mesh.position = Vector3(-0.14, 1.15, -0.52)
			_status_mat.albedo_color = Color(0.45, 0.58, 0.72)
		AIState.COMBO_1_STARTUP:
			_weapon_arm.rotation_degrees = Vector3(-25.0, 75.0, 20.0)
			if _shield_mesh:
				_shield_mesh.position = Vector3(-0.46, 1.10, -0.15)
			_status_mat.albedo_color = Color(0.95, 0.62, 0.15)
		AIState.COMBO_2_STARTUP:
			_weapon_arm.rotation_degrees = Vector3(-85.0, 10.0, 0.0)
			_status_mat.albedo_color = Color(0.98, 0.42, 0.12)
		AIState.COMBO_1_ACTIVE, AIState.COMBO_2_ACTIVE:
			_weapon_arm.rotation_degrees = Vector3(25.0, -70.0, 0.0)
			_status_mat.albedo_color = Color(0.92, 0.16, 0.16)
		AIState.ATTACK_RECOVERY, AIState.GUARD_BROKEN, AIState.STAGGER:
			_weapon_arm.rotation_degrees = Vector3(40.0, -45.0, 25.0)
			if _shield_mesh:
				_shield_mesh.position = Vector3(-0.52, 0.95, 0.15)
			_status_mat.albedo_color = Color(0.42, 0.72, 0.88)
		_:
			_weapon_arm.rotation_degrees = Vector3(0.0, 0.0, 0.0)
			if _shield_mesh:
				_shield_mesh.position = Vector3(-0.42, 1.10, -0.25)
			_status_mat.albedo_color = Color(0.52, 0.36, 0.28)

func _build_ork_visuals_and_colliders() -> void:
	collision_layer = 4
	collision_mask = 1 | 2 | 4

	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.42
	cap.height = 1.92
	col.shape = cap
	col.position = Vector3(0.0, 0.96, 0.0)
	add_child(col)

	_visual_root = Node3D.new()
	add_child(_visual_root)

	var skin_mat := StandardMaterial3D.new()
	skin_mat.albedo_color = Color(0.32, 0.33, 0.24)
	skin_mat.roughness = 0.85

	var armor_mat := StandardMaterial3D.new()
	armor_mat.albedo_color = Color(0.27, 0.23, 0.21)
	armor_mat.metallic = 0.48
	armor_mat.roughness = 0.72

	var torso := MeshInstance3D.new()
	var t_mesh := CapsuleMesh.new()
	t_mesh.radius = 0.39
	t_mesh.height = 1.52
	torso.mesh = t_mesh
	torso.material_override = armor_mat
	torso.position = Vector3(0.0, 0.92, 0.0)
	_visual_root.add_child(torso)

	var head := MeshInstance3D.new()
	var h_mesh := BoxMesh.new()
	h_mesh.size = Vector3(0.40, 0.38, 0.42)
	head.mesh = h_mesh
	head.material_override = skin_mat
	head.position = Vector3(0.0, 1.72, -0.06)
	_visual_root.add_child(head)

	if has_shield:
		_shield_mesh = MeshInstance3D.new()
		var s_box := BoxMesh.new()
		s_box.size = Vector3(0.14, 0.82, 0.66)
		_shield_mesh.mesh = s_box
		_shield_mesh.material_override = armor_mat
		_shield_mesh.position = Vector3(-0.42, 1.10, -0.25)
		_visual_root.add_child(_shield_mesh)

	_weapon_arm = Node3D.new()
	_weapon_arm.position = Vector3(0.42, 1.15, -0.15)
	_visual_root.add_child(_weapon_arm)

	var cleaver := MeshInstance3D.new()
	var c_box := BoxMesh.new()
	c_box.size = Vector3(0.09, 0.22, 1.38)
	cleaver.mesh = c_box
	cleaver.material_override = armor_mat
	cleaver.position = Vector3(0.0, 0.0, -0.68)
	_weapon_arm.add_child(cleaver)

	_status_mat = StandardMaterial3D.new()
	_status_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_status_mat.albedo_color = Color(0.52, 0.36, 0.28)
	var pip := MeshInstance3D.new()
	var pip_mesh := CylinderMesh.new()
	pip_mesh.top_radius = 0.48
	pip_mesh.bottom_radius = 0.48
	pip_mesh.height = 0.03
	pip.mesh = pip_mesh
	pip.material_override = _status_mat
	pip.position = Vector3(0.0, 0.03, 0.0)
	_visual_root.add_child(pip)

	_hitbox = HitboxComponent.new()
	_hitbox.owner_entity = self
	_hitbox.collision_layer = 0
	_hitbox.collision_mask = 8
	var hb_col := CollisionShape3D.new()
	var hb_box := BoxShape3D.new()
	hb_box.size = Vector3(1.55, 1.35, 1.75)
	hb_col.shape = hb_box
	hb_col.position = Vector3(0.0, 1.0, -0.95)
	_hitbox.add_child(hb_col)
	_visual_root.add_child(_hitbox)

	_hurtbox = HurtboxComponent.new()
	_hurtbox.owner_entity = self
	_hurtbox.collision_layer = 16
	_hurtbox.collision_mask = 0
	var hurt_col := CollisionShape3D.new()
	var hurt_cap := CapsuleShape3D.new()
	hurt_cap.radius = 0.46
	hurt_cap.height = 1.95
	hurt_col.shape = hurt_cap
	hurt_col.position = Vector3(0.0, 0.96, 0.0)
	_hurtbox.add_child(hurt_col)
	add_child(_hurtbox)
	_hurtbox.hit_received.connect(_on_hurtbox_hit_received)
