class_name EnemyGoblinScavenger
extends CharacterBody3D

signal goblin_alert_sound(world_pos: Vector3)

## Arc and reach of the wall check, used only when the attack is not a thrust.
const SWEEP_ARC_DEGREES: float = 90.0
const SWEEP_REACH: float = 1.35

enum AIState {
	IDLE,
	PATROL,
	INVESTIGATE,
	PURSUE,
	FLANK,
	ATTACK_STARTUP,
	ATTACK_ACTIVE,
	ATTACK_RECOVERY,
	RECOVER_VULNERABLE,
	RETREAT,
	STAGGER,
	DEAD
}

@export var enemy_name: String = "Goblin Scavenger"
@export var max_health: float = 65.0
@export var max_poise: float = 22.0
@export var patrol_points: Array[Vector3] = []
## The shiv attack is a jab: a thrust, which never clangs off walls (Milestone 5
## deflection rule). Deliberate: goblins stay dangerous in corridors, so the
## entry-hall goblin keeps its teeth. Set false to treat it as a sweep that
## raycasts its arc through WallDeflection and clangs when stone is in the way.
@export var attack_is_thrust: bool = true

var health: float = 65.0
var poise_damage: float = 0.0
var state: AIState = AIState.PATROL
var player_ref: PlayerController
var audio: ProceduralAudio
var coordinator: EncounterCoordinator

var _state_timer: float = 0.0
var _patrol_index: int = 0
var _last_known_player_pos: Vector3 = Vector3.ZERO
var _has_last_known_pos: bool = false
var _memory_timer: float = 0.0
var _flank_sign: float = 1.0
var _facing_dir: Vector3 = Vector3.FORWARD
var _knockback_vel: Vector3 = Vector3.ZERO
var _unseen_cue_cooldown: float = 0.0

var _visual_root: Node3D
var _weapon_arm: Node3D
var _status_pip: MeshInstance3D
var _status_mat: StandardMaterial3D
var _hitbox: HitboxComponent
var _hurtbox: HurtboxComponent

func _ready() -> void:
	health = max_health
	_flank_sign = 1.0 if randf() > 0.5 else -1.0
	_build_goblin_visuals_and_colliders()

func _physics_process(delta: float) -> void:
	_update_player_los_visibility(delta)

	if state == AIState.DEAD:
		return

	_knockback_vel = _knockback_vel.move_toward(Vector3.ZERO, 14.0 * delta)
	_evaluate_senses(delta)
	_process_ai_state(delta)
	_update_visual_telegraph()

	if not is_on_floor():
		velocity.y -= 24.0 * delta
	else:
		velocity.y = -0.1
	move_and_slide()

func _update_player_los_visibility(delta: float) -> void:
	if player_ref == null:
		return
	if _unseen_cue_cooldown > 0.0:
		_unseen_cue_cooldown = maxf(0.0, _unseen_cue_cooldown - delta)

	var space_state := get_world_3d().direct_space_state
	var from_pos: Vector3 = player_ref.global_position + Vector3(0.0, 1.35, 0.0)
	var to_pos: Vector3 = global_position + Vector3(0.0, 0.95, 0.0)
	var query := PhysicsRayQueryParameters3D.create(from_pos, to_pos, 1)
	var hit := space_state.intersect_ray(query)

	var is_occluded_by_wall: bool = not hit.is_empty()
	_visual_root.visible = not is_occluded_by_wall

	if is_occluded_by_wall and state != AIState.DEAD and velocity.length() > 0.5:
		var dist: float = global_position.distance_to(player_ref.global_position)
		if dist < 8.5 and _unseen_cue_cooldown <= 0.0:
			_unseen_cue_cooldown = 2.4
			if audio:
				audio.play_unseen_threat_cue()
			goblin_alert_sound.emit(global_position)

func _evaluate_senses(delta: float) -> void:
	if player_ref == null or player_ref.current_state == PlayerController.ActionState.DEAD:
		return

	if _memory_timer > 0.0:
		_memory_timer = maxf(0.0, _memory_timer - delta)
		if _memory_timer == 0.0:
			_has_last_known_pos = false

	var to_player: Vector3 = player_ref.global_position - global_position
	var dist: float = to_player.length()
	var dir_to_player: Vector3 = to_player.normalized() if dist > 0.01 else Vector3.FORWARD

	var can_see: bool = false
	if dist <= 13.5:
		var dot: float = _facing_dir.dot(dir_to_player)
		if dot >= cos(deg_to_rad(57.5)) or dist <= 2.8:
			var space_state := get_world_3d().direct_space_state
			var q := PhysicsRayQueryParameters3D.create(
				global_position + Vector3(0.0, 1.0, 0.0),
				player_ref.global_position + Vector3(0.0, 1.1, 0.0),
				1
			)
			if space_state.intersect_ray(q).is_empty():
				can_see = true

	# A burdened pack clatters, stretching every hearing radius.
	var noise_mult: float = player_ref.get_noise_multiplier()
	var can_hear: bool = false
	if player_ref.current_state in [
		PlayerController.ActionState.SPRINT,
		PlayerController.ActionState.ATTACK_ACTIVE
	] and dist <= 9.0 * noise_mult:
		can_hear = true
	elif player_ref.current_state == PlayerController.ActionState.MOVE and dist <= 3.5 * noise_mult:
		can_hear = true
	elif player_ref.is_scavenging() and dist <= 4.5:
		# Rummaging through crates and corpses is never quiet.
		can_hear = true

	if can_see:
		_last_known_player_pos = player_ref.global_position
		_has_last_known_pos = true
		_memory_timer = 7.5
		if state in [AIState.IDLE, AIState.PATROL, AIState.INVESTIGATE]:
			state = AIState.PURSUE
	elif can_hear and state in [AIState.IDLE, AIState.PATROL]:
		_last_known_player_pos = player_ref.global_position
		_has_last_known_pos = true
		_memory_timer = 5.0
		state = AIState.INVESTIGATE

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
			var target_pt: Vector3 = patrol_points[_patrol_index]
			var to_pt: Vector3 = target_pt - global_position
			to_pt.y = 0.0
			if to_pt.length() < 0.65:
				_patrol_index = (_patrol_index + 1) % patrol_points.size()
				state = AIState.IDLE
				_state_timer = 1.6
			else:
				_steer_toward(to_pt.normalized(), 2.2, delta)

		AIState.INVESTIGATE:
			if not _has_last_known_pos:
				state = AIState.PATROL
				return
			var to_investigate: Vector3 = _last_known_player_pos - global_position
			to_investigate.y = 0.0
			if to_investigate.length() < 0.8:
				_has_last_known_pos = false
				state = AIState.IDLE
				_state_timer = 2.4
			else:
				_steer_toward(to_investigate.normalized(), 2.6, delta)

		AIState.PURSUE:
			if not _has_last_known_pos:
				state = AIState.INVESTIGATE
				return
			if health < (max_health * 0.32):
				state = AIState.RETREAT
				_state_timer = 3.2
				return

			var to_target: Vector3 = _last_known_player_pos - global_position
			to_target.y = 0.0
			var dist: float = to_target.length()

			if dist <= 1.85:
				if _try_begin_attack_windup():
					return
				state = AIState.FLANK
				_state_timer = 0.55
			elif dist <= 4.2:
				state = AIState.FLANK
				_state_timer = randf_range(0.75, 1.35)
			else:
				_steer_toward(to_target.normalized(), 4.1, delta)

		AIState.FLANK:
			_state_timer -= delta
			if player_ref == null:
				state = AIState.IDLE
				return
			var to_p: Vector3 = player_ref.global_position - global_position
			to_p.y = 0.0
			var dist: float = to_p.length()
			var dir_p: Vector3 = to_p.normalized() if dist > 0.01 else Vector3.FORWARD
			var tangent := Vector3(-dir_p.z * _flank_sign, 0.0, dir_p.x * _flank_sign)
			var radial_push: float = 0.45 if dist > 2.1 else -0.25
			var move_vec: Vector3 = (dir_p * radial_push + tangent * 0.88).normalized()
			_face_direction(dir_p, 10.0, delta)
			velocity.x = move_vec.x * 3.4 + _knockback_vel.x
			velocity.z = move_vec.z * 3.4 + _knockback_vel.z

			if (dist <= 1.85 and _try_begin_attack_windup()):
				return
			if _state_timer <= 0.0:
				state = AIState.PURSUE

		AIState.ATTACK_STARTUP:
			_state_timer -= delta
			velocity.x = -_facing_dir.x * 0.85 + _knockback_vel.x
			velocity.z = -_facing_dir.z * 0.85 + _knockback_vel.z
			if player_ref:
				var aim: Vector3 = (player_ref.global_position - global_position)
				aim.y = 0.0
				if aim.length_squared() > 0.01:
					_face_direction(aim.normalized(), 3.2, delta)
			if _state_timer <= 0.0:
				_enter_attack_active()

		AIState.ATTACK_ACTIVE:
			_state_timer -= delta
			velocity.x = _facing_dir.x * 5.2 + _knockback_vel.x
			velocity.z = _facing_dir.z * 5.2 + _knockback_vel.z
			if _state_timer <= 0.0:
				_hitbox.end_swing()
				if coordinator:
					coordinator.release_attack_token(self)
				state = AIState.ATTACK_RECOVERY
				_state_timer = 0.72

		AIState.ATTACK_RECOVERY, AIState.RECOVER_VULNERABLE:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _state_timer <= 0.0:
				state = AIState.PURSUE

		AIState.RETREAT:
			_state_timer -= delta
			if player_ref:
				var away: Vector3 = (global_position - player_ref.global_position)
				away.y = 0.0
				if away.length_squared() > 0.01:
					_steer_toward(away.normalized(), 4.3, delta)
			if _state_timer <= 0.0:
				state = AIState.PURSUE

		AIState.STAGGER:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _state_timer <= 0.0:
				state = AIState.RECOVER_VULNERABLE
				_state_timer = 0.35

func is_dead() -> bool:
	return state == AIState.DEAD

func is_staggered() -> bool:
	return state in [AIState.STAGGER, AIState.RECOVER_VULNERABLE]

func _try_begin_attack_windup() -> bool:
	if coordinator and not coordinator.request_attack_token(self):
		return false
	state = AIState.ATTACK_STARTUP
	_state_timer = 0.56
	return true

func _enter_attack_active() -> void:
	if not attack_is_thrust:
		var obstruction: Dictionary = WallDeflection.sweep_obstruction(self, _facing_dir, SWEEP_ARC_DEGREES, SWEEP_REACH)
		if not obstruction.is_empty():
			_enter_wall_recoil(obstruction)
			return
	state = AIState.ATTACK_ACTIVE
	_state_timer = 0.16
	if audio:
		audio.play_swing()
	var payload := CombatPayload.new(
		self,
		global_position,
		_facing_dir,
		18.0,
		16.0,
		true,
		false,
		3.0
	)
	_hitbox.begin_swing(payload)

## A sweep that met stone: the hitbox never opens. Release the token, take a
## short shove off the wall, throw sparks and clang, then recover for 0.6 s.
func _enter_wall_recoil(hit: Dictionary) -> void:
	_hitbox.end_swing()
	if coordinator:
		coordinator.release_attack_token(self)
	var normal: Vector3 = WallDeflection.recoil_normal(hit, _facing_dir)
	_knockback_vel = normal * 2.2
	if audio:
		audio.play_wall_clang()
	WallDeflection.spawn_sparks(get_parent(), hit.get("position", global_position + _facing_dir), normal)
	state = AIState.ATTACK_RECOVERY
	_state_timer = 0.6

func _steer_toward(dir: Vector3, speed: float, delta: float) -> void:
	_face_direction(dir, 9.0, delta)
	velocity.x = dir.x * speed + _knockback_vel.x
	velocity.z = dir.z * speed + _knockback_vel.z

func _face_direction(dir: Vector3, turn_speed: float, delta: float) -> void:
	_facing_dir = _facing_dir.slerp(dir, 1.0 - exp(-turn_speed * delta)).normalized()
	_visual_root.look_at(global_position + _facing_dir, Vector3.UP)

func _on_hurtbox_hit_received(payload: CombatPayload) -> void:
	if state == AIState.DEAD:
		return
	_hitbox.end_swing()
	if coordinator:
		coordinator.release_attack_token(self)

	health = maxf(0.0, health - payload.physical_damage)
	poise_damage += payload.poise_damage
	_last_known_player_pos = payload.attacker_origin
	_has_last_known_pos = true
	_memory_timer = 9.0

	var away: Vector3 = (global_position - payload.attacker_origin)
	away.y = 0.0
	if away.length_squared() > 0.01:
		_knockback_vel = away.normalized() * payload.knockback_force

	if health <= 0.0:
		state = AIState.DEAD
		collision_layer = 0
		_hurtbox.set_deferred("monitorable", false)
		_visual_root.rotation_degrees.x = -85.0
		_visual_root.position.y = 0.2
		_status_pip.visible = false
		Lootable.attach_corpse(self, "%s Corpse" % enemy_name, ItemDatabase.roll_goblin_loot(), 2.6)
		return

	if poise_damage >= max_poise or payload.is_heavy:
		poise_damage = 0.0
		state = AIState.STAGGER
		_state_timer = 0.68

func _update_visual_telegraph() -> void:
	match state:
		AIState.ATTACK_STARTUP:
			_weapon_arm.rotation_degrees = Vector3(-65.0, 55.0, 35.0)
			_status_mat.albedo_color = Color(0.95, 0.65, 0.15)
		AIState.ATTACK_ACTIVE:
			_weapon_arm.rotation_degrees = Vector3(15.0, -65.0, 0.0)
			_status_mat.albedo_color = Color(0.92, 0.18, 0.15)
		AIState.ATTACK_RECOVERY, AIState.RECOVER_VULNERABLE, AIState.STAGGER:
			_weapon_arm.rotation_degrees = Vector3(38.0, -35.0, 20.0)
			_status_mat.albedo_color = Color(0.42, 0.68, 0.85)
		AIState.RETREAT:
			_weapon_arm.rotation_degrees = Vector3(0.0, 0.0, 0.0)
			_status_mat.albedo_color = Color(0.75, 0.75, 0.32)
		_:
			_weapon_arm.rotation_degrees = Vector3(0.0, 0.0, 0.0)
			_status_mat.albedo_color = Color(0.38, 0.46, 0.34)

func _build_goblin_visuals_and_colliders() -> void:
	collision_layer = 4
	collision_mask = 1 | 2 | 4

	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.32
	cap.height = 1.35
	col.shape = cap
	col.position = Vector3(0.0, 0.68, 0.0)
	add_child(col)

	_visual_root = Node3D.new()
	add_child(_visual_root)

	var skin_mat := StandardMaterial3D.new()
	skin_mat.albedo_color = Color(0.28, 0.34, 0.22)
	skin_mat.roughness = 0.86

	var body := MeshInstance3D.new()
	var b_mesh := CapsuleMesh.new()
	b_mesh.radius = 0.28
	b_mesh.height = 1.05
	body.mesh = b_mesh
	body.material_override = skin_mat
	body.position = Vector3(0.0, 0.58, 0.0)
	body.rotation_degrees.x = 18.0
	_visual_root.add_child(body)

	var head := MeshInstance3D.new()
	var h_mesh := BoxMesh.new()
	h_mesh.size = Vector3(0.34, 0.30, 0.38)
	head.mesh = h_mesh
	head.material_override = skin_mat
	head.position = Vector3(0.0, 1.12, -0.14)
	_visual_root.add_child(head)

	_weapon_arm = Node3D.new()
	_weapon_arm.position = Vector3(0.30, 0.82, -0.12)
	_visual_root.add_child(_weapon_arm)

	var iron_mat := StandardMaterial3D.new()
	iron_mat.albedo_color = Color(0.38, 0.33, 0.30)
	iron_mat.metallic = 0.55
	iron_mat.roughness = 0.72

	var blade := MeshInstance3D.new()
	var bl_mesh := BoxMesh.new()
	bl_mesh.size = Vector3(0.07, 0.14, 0.88)
	blade.mesh = bl_mesh
	blade.material_override = iron_mat
	blade.position = Vector3(0.0, 0.0, -0.45)
	_weapon_arm.add_child(blade)

	_status_mat = StandardMaterial3D.new()
	_status_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_status_mat.albedo_color = Color(0.38, 0.46, 0.34)
	_status_pip = MeshInstance3D.new()
	var pip_mesh := CylinderMesh.new()
	pip_mesh.top_radius = 0.38
	pip_mesh.bottom_radius = 0.38
	pip_mesh.height = 0.03
	_status_pip.mesh = pip_mesh
	_status_pip.material_override = _status_mat
	_status_pip.position = Vector3(0.0, 0.03, 0.0)
	_visual_root.add_child(_status_pip)

	_hitbox = HitboxComponent.new()
	_hitbox.owner_entity = self
	_hitbox.collision_layer = 0
	_hitbox.collision_mask = 8
	var hb_col := CollisionShape3D.new()
	var hb_box := BoxShape3D.new()
	hb_box.size = Vector3(1.15, 1.1, 1.35)
	hb_col.shape = hb_box
	hb_col.position = Vector3(0.0, 0.8, -0.75)
	_hitbox.add_child(hb_col)
	_visual_root.add_child(_hitbox)

	_hurtbox = HurtboxComponent.new()
	_hurtbox.owner_entity = self
	_hurtbox.collision_layer = 16
	_hurtbox.collision_mask = 0
	var hurt_col := CollisionShape3D.new()
	var hurt_cap := CapsuleShape3D.new()
	hurt_cap.radius = 0.38
	hurt_cap.height = 1.45
	hurt_col.shape = hurt_cap
	hurt_col.position = Vector3(0.0, 0.72, 0.0)
	_hurtbox.add_child(hurt_col)
	add_child(_hurtbox)
	_hurtbox.hit_received.connect(_on_hurtbox_hit_received)
