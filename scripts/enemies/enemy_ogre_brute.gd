class_name EnemyOgreBrute
extends CharacterBody3D

signal ogre_event_banner(text: String, col: Color)
signal ogre_ground_shockwave(intensity: float)

enum AIState {
	IDLE,
	PATROL,
	PURSUE,
	DOORWAY_FRUSTRATED,
	SWEEP_STARTUP,
	SWEEP_ACTIVE,
	SLAM_STARTUP,
	SLAM_ACTIVE,
	LONG_RECOVERY,
	STAGGER,
	RECOIL,
	DEAD
}

@export var enemy_name: String = "Blackfen Ogre"
@export var max_health: float = 280.0
@export var max_poise: float = 95.0

# Milestone 6 — the club sweep clangs off walls and pillars; the slam doesn't.
@export var club_reach: float = 2.6
@export var sweep_arc_degrees: float = 150.0
@export var wall_recoil_time: float = 1.1

var health: float = 280.0
var poise_damage: float = 0.0
var state: AIState = AIState.IDLE
var player_ref: PlayerController
var audio: ProceduralAudio
var coordinator: EncounterCoordinator

var _state_timer: float = 0.0
var _facing_dir: Vector3 = Vector3.FORWARD
var _knockback_vel: Vector3 = Vector3.ZERO
var _home_pos: Vector3 = Vector3.ZERO
var _blocked_by_narrow_gap_timer: float = 0.0

var _visual_root: Node3D
var _club_pivot: Node3D
var _slam_ring: MeshInstance3D
var _slam_ring_mat: StandardMaterial3D
var _status_mat: StandardMaterial3D
var _hitbox: HitboxComponent
var _hurtbox: HurtboxComponent

func _ready() -> void:
	health = max_health
	_home_pos = global_position
	_build_ogre_visuals_and_colliders()

func _physics_process(delta: float) -> void:
	_update_player_los_visibility()
	if state == AIState.DEAD:
		return

	_knockback_vel = _knockback_vel.move_toward(Vector3.ZERO, 18.0 * delta)
	if poise_damage > 0.0:
		poise_damage = maxf(0.0, poise_damage - 5.0 * delta)

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
		global_position + Vector3(0.0, 1.85, 0.0),
		1
	)
	_visual_root.visible = space_state.intersect_ray(q).is_empty()

func _process_ai_state(delta: float) -> void:
	if player_ref == null or player_ref.current_state == PlayerController.ActionState.DEAD:
		state = AIState.IDLE
		velocity = Vector3.ZERO
		return

	var to_player: Vector3 = player_ref.global_position - global_position
	to_player.y = 0.0
	var dist: float = to_player.length()
	var dir_p: Vector3 = to_player.normalized() if dist > 0.01 else Vector3.FORWARD

	match state:
		AIState.IDLE:
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if dist <= 13.0 and _visual_root.visible:
				if audio:
					audio.play_ogre_roar()
				ogre_event_banner.emit("The Blackfen Ogre Has Spotted You!", Color(0.92, 0.35, 0.20))
				state = AIState.PURSUE

		AIState.PURSUE:
			if dist > 20.0:
				var to_home: Vector3 = _home_pos - global_position
				to_home.y = 0.0
				if to_home.length() > 1.0:
					_steer_toward(to_home.normalized(), 2.4, delta)
				else:
					state = AIState.IDLE
				return

			if dist <= 3.15:
				_begin_committed_attack(dir_p)
				return

			_steer_toward(dir_p, 2.85, delta)

			if is_on_wall() and velocity.length() < 0.85 and dist > 2.4:
				_blocked_by_narrow_gap_timer += delta
				if _blocked_by_narrow_gap_timer >= 0.55:
					_blocked_by_narrow_gap_timer = 0.0
					if audio:
						audio.play_ogre_roar()
					ogre_event_banner.emit("The Ogre Is Too Massive To Fit Through The Doorway!", Color(0.85, 0.72, 0.38))
					state = AIState.DOORWAY_FRUSTRATED
					_state_timer = 2.2
			else:
				_blocked_by_narrow_gap_timer = maxf(0.0, _blocked_by_narrow_gap_timer - delta)

		AIState.DOORWAY_FRUSTRATED:
			_state_timer -= delta
			velocity.x = -_facing_dir.x * 1.4
			velocity.z = -_facing_dir.z * 1.4
			_face_direction(dir_p, 3.0, delta)
			if _state_timer <= 0.0:
				state = AIState.PURSUE

		AIState.SWEEP_STARTUP:
			_state_timer -= delta
			velocity = Vector3.ZERO
			_face_direction(dir_p, 0.65, delta)
			if _state_timer <= 0.0:
				_enter_sweep_active()

		AIState.SWEEP_ACTIVE:
			_state_timer -= delta
			velocity.x = _facing_dir.x * 3.8
			velocity.z = _facing_dir.z * 3.8
			if _state_timer <= 0.0:
				_enter_long_recovery(1.30)

		AIState.SLAM_STARTUP:
			_state_timer -= delta
			velocity = Vector3.ZERO
			_face_direction(dir_p, 0.45, delta)
			_slam_ring.visible = true
			if _state_timer <= 0.0:
				_enter_slam_active()

		AIState.SLAM_ACTIVE:
			_state_timer -= delta
			velocity = Vector3.ZERO
			if _state_timer <= 0.0:
				_slam_ring.visible = false
				_enter_long_recovery(1.60)

		AIState.LONG_RECOVERY:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _state_timer <= 0.0:
				state = AIState.PURSUE

		AIState.RECOIL:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _state_timer <= 0.0:
				state = AIState.PURSUE

		AIState.STAGGER:
			_state_timer -= delta
			_slam_ring.visible = false
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _state_timer <= 0.0:
				state = AIState.PURSUE

func is_dead() -> bool:
	return state == AIState.DEAD

func is_staggered() -> bool:
	return state in [AIState.STAGGER, AIState.RECOIL]

func _begin_committed_attack(dir_to_player: Vector3) -> void:
	if coordinator:
		coordinator.request_attack_token(self, true)
	_face_direction(dir_to_player, 12.0, 0.1)
	if randf() > 0.45:
		state = AIState.SLAM_STARTUP
		_state_timer = 1.12
	else:
		state = AIState.SWEEP_STARTUP
		_state_timer = 0.92

func _enter_sweep_active() -> void:
	var obstruction: Dictionary = SwingGeometry.sweep_obstruction(self, _facing_dir, sweep_arc_degrees, club_reach, 1.6)
	if not obstruction.is_empty():
		_enter_wall_recoil(obstruction)
		return
	state = AIState.SWEEP_ACTIVE
	_state_timer = 0.24
	if audio:
		audio.play_swing()
	var payload := CombatPayload.new(
		self,
		global_position,
		_facing_dir,
		46.0,
		60.0,
		false,
		true,
		7.5
	)
	_hitbox.begin_swing(payload)

func _enter_slam_active() -> void:
	state = AIState.SLAM_ACTIVE
	_state_timer = 0.22
	if audio:
		audio.play_ogre_ground_slam()
	ogre_ground_shockwave.emit(0.75)
	var payload := CombatPayload.new(
		self,
		global_position,
		_facing_dir,
		62.0,
		85.0,
		true,
		true,
		8.5
	)
	_hitbox.begin_swing(payload)

func _enter_wall_recoil(hit: Dictionary) -> void:
	_hitbox.end_swing()
	if coordinator:
		coordinator.release_attack_token(self)
	state = AIState.RECOIL
	_state_timer = wall_recoil_time
	var normal: Vector3 = SwingGeometry.recoil_normal(hit, _facing_dir)
	_knockback_vel = normal * 1.6
	if audio:
		audio.play_wall_clang()
	ogre_ground_shockwave.emit(0.3)
	SwingGeometry.spawn_sparks(get_parent(), hit.get("position", global_position + _facing_dir * 2.0), normal, 22)
	ogre_event_banner.emit("The Ogre's club smashes into stone — strike now!", Color(0.48, 0.78, 0.92))

func _enter_long_recovery(duration: float) -> void:
	_hitbox.end_swing()
	if coordinator:
		coordinator.release_attack_token(self)
	state = AIState.LONG_RECOVERY
	_state_timer = duration

func _steer_toward(dir: Vector3, speed: float, delta: float) -> void:
	_face_direction(dir, 3.8, delta)
	velocity.x = dir.x * speed + _knockback_vel.x
	velocity.z = dir.z * speed + _knockback_vel.z

func _face_direction(dir: Vector3, turn_speed: float, delta: float) -> void:
	_facing_dir = _facing_dir.slerp(dir, 1.0 - exp(-turn_speed * delta)).normalized()
	_visual_root.look_at(global_position + _facing_dir, Vector3.UP)

func _on_hurtbox_hit_received(payload: CombatPayload) -> void:
	if state == AIState.DEAD:
		return
	health = maxf(0.0, health - payload.physical_damage)
	poise_damage += payload.poise_damage

	if health <= 0.0:
		_hitbox.end_swing()
		_slam_ring.visible = false
		if coordinator:
			coordinator.release_attack_token(self)
		state = AIState.DEAD
		collision_layer = 0
		_hurtbox.set_deferred("monitorable", false)
		_visual_root.rotation_degrees.x = -85.0
		_visual_root.position.y = 0.45
		ogre_event_banner.emit("THE BLACKFEN OGRE HAS FALLEN", Color(0.88, 0.74, 0.36))
		var corpse := Lootable.attach_corpse(self, "%s Carcass" % enemy_name, ItemDatabase.roll_ogre_loot(), 4.0)
		corpse.interact_radius = 2.6
		return

	if poise_damage >= max_poise:
		_hitbox.end_swing()
		_slam_ring.visible = false
		if coordinator:
			coordinator.release_attack_token(self)
		poise_damage = 0.0
		state = AIState.STAGGER
		_state_timer = 1.15
		ogre_event_banner.emit("Ogre Staggered — Strike Now!", Color(0.48, 0.78, 0.92))

func _update_visual_telegraph() -> void:
	match state:
		AIState.SWEEP_STARTUP:
			_club_pivot.rotation_degrees = Vector3(-15.0, 95.0, 25.0)
			_status_mat.albedo_color = Color(0.95, 0.58, 0.15)
		AIState.SLAM_STARTUP:
			_club_pivot.rotation_degrees = Vector3(-105.0, 0.0, 0.0)
			_status_mat.albedo_color = Color(0.98, 0.35, 0.10)
		AIState.SWEEP_ACTIVE, AIState.SLAM_ACTIVE:
			_club_pivot.rotation_degrees = Vector3(32.0, -75.0, 0.0)
			_status_mat.albedo_color = Color(0.95, 0.12, 0.12)
		AIState.LONG_RECOVERY, AIState.STAGGER, AIState.RECOIL:
			_club_pivot.rotation_degrees = Vector3(52.0, -15.0, 18.0)
			_status_mat.albedo_color = Color(0.38, 0.75, 0.92)
		_:
			_club_pivot.rotation_degrees = Vector3(0.0, 0.0, 0.0)
			_status_mat.albedo_color = Color(0.48, 0.28, 0.24)

func _build_ogre_visuals_and_colliders() -> void:
	collision_layer = 4
	collision_mask = 1 | 2 | 4

	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.85
	cap.height = 2.95
	col.shape = cap
	col.position = Vector3(0.0, 1.48, 0.0)
	add_child(col)

	_visual_root = Node3D.new()
	add_child(_visual_root)

	var hide_mat := StandardMaterial3D.new()
	hide_mat.albedo_color = Color(0.34, 0.29, 0.26)
	hide_mat.roughness = 0.92

	var body := MeshInstance3D.new()
	var b_mesh := CapsuleMesh.new()
	b_mesh.radius = 0.78
	b_mesh.height = 2.45
	body.mesh = b_mesh
	body.material_override = hide_mat
	body.position = Vector3(0.0, 1.38, 0.0)
	_visual_root.add_child(body)

	var head := MeshInstance3D.new()
	var h_mesh := SphereMesh.new()
	h_mesh.radius = 0.42
	h_mesh.height = 0.78
	head.mesh = h_mesh
	head.material_override = hide_mat
	head.position = Vector3(0.0, 2.55, -0.22)
	_visual_root.add_child(head)

	_club_pivot = Node3D.new()
	_club_pivot.position = Vector3(0.82, 1.65, -0.25)
	_visual_root.add_child(_club_pivot)

	var wood_mat := StandardMaterial3D.new()
	wood_mat.albedo_color = Color(0.24, 0.17, 0.12)
	wood_mat.roughness = 0.90

	var club := MeshInstance3D.new()
	var c_mesh := CylinderMesh.new()
	c_mesh.top_radius = 0.28
	c_mesh.bottom_radius = 0.14
	c_mesh.height = 2.35
	club.mesh = c_mesh
	club.material_override = wood_mat
	club.rotation_degrees.x = 90.0
	club.position = Vector3(0.0, 0.0, -1.10)
	_club_pivot.add_child(club)

	_slam_ring_mat = StandardMaterial3D.new()
	_slam_ring_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_slam_ring_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_slam_ring_mat.albedo_color = Color(0.88, 0.28, 0.12, 0.42)
	_slam_ring = MeshInstance3D.new()
	var r_mesh := CylinderMesh.new()
	r_mesh.top_radius = 2.15
	r_mesh.bottom_radius = 2.15
	r_mesh.height = 0.04
	_slam_ring.mesh = r_mesh
	_slam_ring.material_override = _slam_ring_mat
	_slam_ring.position = Vector3(0.0, 0.05, -2.05)
	_slam_ring.visible = false
	_visual_root.add_child(_slam_ring)

	_status_mat = StandardMaterial3D.new()
	_status_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_status_mat.albedo_color = Color(0.48, 0.28, 0.24)
	var pip := MeshInstance3D.new()
	var pip_mesh := CylinderMesh.new()
	pip_mesh.top_radius = 0.92
	pip_mesh.bottom_radius = 0.92
	pip_mesh.height = 0.04
	pip.mesh = pip_mesh
	pip.material_override = _status_mat
	pip.position = Vector3(0.0, 0.04, 0.0)
	_visual_root.add_child(pip)

	_hitbox = HitboxComponent.new()
	_hitbox.owner_entity = self
	_hitbox.collision_layer = 0
	_hitbox.collision_mask = 8
	var hb_col := CollisionShape3D.new()
	var hb_box := BoxShape3D.new()
	hb_box.size = Vector3(2.95, 2.2, 2.85)
	hb_col.shape = hb_box
	hb_col.position = Vector3(0.0, 1.1, -1.65)
	_hitbox.add_child(hb_col)
	_visual_root.add_child(_hitbox)

	_hurtbox = HurtboxComponent.new()
	_hurtbox.owner_entity = self
	_hurtbox.collision_layer = 16
	_hurtbox.collision_mask = 0
	var hurt_col := CollisionShape3D.new()
	var hurt_cap := CapsuleShape3D.new()
	hurt_cap.radius = 0.92
	hurt_cap.height = 2.95
	hurt_col.shape = hurt_cap
	hurt_col.position = Vector3(0.0, 1.48, 0.0)
	_hurtbox.add_child(hurt_col)
	add_child(_hurtbox)
	_hurtbox.hit_received.connect(_on_hurtbox_hit_received)
