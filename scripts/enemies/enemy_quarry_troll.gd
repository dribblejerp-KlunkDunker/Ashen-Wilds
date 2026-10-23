class_name EnemyQuarryTroll
extends CharacterBody3D
## Milestone 11: the Blind Quarry-Troll. It has no eyes: the vision cone,
## darkness and walls don't hide you from it, but silence does. It hunts the
## last noise it heard (charging loud ones), sweeps the spot, and searches.
## Touch gives you away too. Its hide turns light blows unless it's reeling.

signal troll_event_banner(text: String, col: Color)

enum AIState {
	IDLE,
	STALK,
	CHARGE,
	SEARCH,
	SWEEP_STARTUP,
	SWEEP_ACTIVE,
	RECOVERY,
	STAGGER,
	RECOIL,
	DEAD
}

@export var enemy_name: String = "Blind Quarry-Troll"
@export var max_health: float = 360.0
@export var max_poise: float = 110.0
@export var stalk_speed: float = 2.0
@export var charge_speed: float = 4.4
@export var turn_speed: float = 2.2
## A noise this much louder than its distance (metres of spare reach) makes
## it charge instead of stalk.
@export var charge_urgency: float = 4.0
@export var touch_radius: float = 1.5
@export var club_reach: float = 2.7
@export var sweep_arc_degrees: float = 140.0
## Light blows only deal this fraction unless it's staggered or recovering.
@export var hide_light_mult: float = 0.35
@export var search_time: float = 3.2
@export var wall_recoil_time: float = 1.2

const LOUD_KINDS: Array[String] = ["clang", "swing", "roar", "slam", "thud", "shield", "cough", "caw"]

var health: float = 360.0
var poise_damage: float = 0.0
var state: AIState = AIState.IDLE
var player_ref: PlayerController
var audio: ProceduralAudio
var coordinator: EncounterCoordinator

var _state_timer: float = 0.0
var _facing_dir: Vector3 = Vector3.FORWARD
var _knockback_vel: Vector3 = Vector3.ZERO
var _home_pos: Vector3 = Vector3.ZERO
var _target_pos: Vector3 = Vector3.ZERO
var _has_target: bool = false
var _target_age: float = 99.0
var _target_urgency: float = 0.0
var _step_timer: float = 0.0

var _visual_root: Node3D
var _club_pivot: Node3D
var _status_mat: StandardMaterial3D
var _hitbox: HitboxComponent
var _hurtbox: HurtboxComponent

func _ready() -> void:
	add_to_group("enemy")
	health = max_health
	_home_pos = global_position
	_build_troll_visuals_and_colliders()
	AcousticField.listen(self, _on_noise_heard)

func _physics_process(delta: float) -> void:
	if player_ref:
		_visual_root.visible = player_ref.can_see_body(self)
	if state == AIState.DEAD:
		return
	_knockback_vel = _knockback_vel.move_toward(Vector3.ZERO, 16.0 * delta)
	if poise_damage > 0.0:
		poise_damage = maxf(0.0, poise_damage - 5.0 * delta)
	_target_age += delta
	_process_ai_state(delta)
	_update_visual_telegraph()
	if not is_on_floor():
		velocity.y -= 24.0 * delta
	else:
		velocity.y = -0.1
	move_and_slide()
	_step_timer = AcousticField.step_cadence(self, _step_timer, delta, 0.6, 11.0)

func is_dead() -> bool:
	return state == AIState.DEAD

func is_staggered() -> bool:
	return state in [AIState.STAGGER, AIState.RECOIL]

func get_target() -> Vector3:
	return _target_pos

func has_target() -> bool:
	return _has_target

# ------------------------------------------------------------------------------
# Hearing (its only sense besides touch)
# ------------------------------------------------------------------------------
func _on_noise_heard(world_pos: Vector3, reach: float, source: Node3D, kind: String) -> void:
	if state == AIState.DEAD or source == self or not is_inside_tree():
		return
	# Other creatures' footsteps are just the quarry's background patter.
	if kind == "footstep" and not (source is PlayerController):
		return
	if not AcousticField.can_hear(self, world_pos, reach):
		return
	var dist: float = Vector2(world_pos.x - global_position.x, world_pos.z - global_position.z).length()
	var urgency: float = reach - dist
	# Keep chasing a louder, fresh sound rather than a fainter new one.
	if _has_target and _target_age < 1.5 and urgency < _target_urgency:
		return
	_target_pos = Vector3(world_pos.x, global_position.y, world_pos.z)
	_has_target = true
	_target_age = 0.0
	_target_urgency = urgency
	if state in [AIState.IDLE, AIState.STALK, AIState.SEARCH, AIState.CHARGE]:
		var charge: bool = urgency >= charge_urgency or kind in LOUD_KINDS
		if charge and state != AIState.CHARGE:
			if audio:
				audio.play_ogre_roar()
			troll_event_banner.emit("The Quarry-Troll lurches toward the sound!", Color(0.80, 0.70, 0.55))
		state = AIState.CHARGE if charge or state == AIState.CHARGE else AIState.STALK

## Touch: anything brushing against it within arm's reach gives itself away.
func _player_within_touch() -> bool:
	if player_ref == null or player_ref.current_state == PlayerController.ActionState.DEAD:
		return false
	var d: Vector3 = player_ref.global_position - global_position
	d.y = 0.0
	return d.length() <= touch_radius

func _player_within_reach() -> bool:
	if player_ref == null or player_ref.current_state == PlayerController.ActionState.DEAD:
		return false
	var d: Vector3 = player_ref.global_position - global_position
	d.y = 0.0
	return d.length() <= club_reach + 0.2

# ------------------------------------------------------------------------------
# AI
# ------------------------------------------------------------------------------
func _process_ai_state(delta: float) -> void:
	match state:
		AIState.IDLE:
			var to_home: Vector3 = _home_pos - global_position
			to_home.y = 0.0
			if to_home.length() > 1.0:
				_steer_toward(to_home.normalized(), stalk_speed * 0.6, delta)
			else:
				velocity.x = _knockback_vel.x
				velocity.z = _knockback_vel.z
			if _player_within_touch():
				_begin_sweep(player_ref.global_position)

		AIState.STALK, AIState.CHARGE:
			if _player_within_touch():
				_begin_sweep(player_ref.global_position)
				return
			var to_t: Vector3 = _target_pos - global_position
			to_t.y = 0.0
			if to_t.length() <= 1.6:
				# Arrived: lash out if something's there, otherwise feel around.
				if _player_within_reach():
					_begin_sweep(player_ref.global_position)
				else:
					_enter_search()
				return
			_steer_toward(to_t.normalized(), charge_speed if state == AIState.CHARGE else stalk_speed, delta)

		AIState.SEARCH:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			_face_direction(_facing_dir.rotated(Vector3.UP, 1.2 * delta), 10.0, delta)
			if _player_within_touch():
				_begin_sweep(player_ref.global_position)
				return
			if _state_timer <= 0.0:
				_has_target = false
				state = AIState.IDLE

		AIState.SWEEP_STARTUP:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			var to_t: Vector3 = _target_pos - global_position
			to_t.y = 0.0
			if to_t.length_squared() > 0.01:
				_face_direction(to_t.normalized(), turn_speed * 0.5, delta)
			if _state_timer <= 0.0:
				_enter_sweep_active()

		AIState.SWEEP_ACTIVE:
			_state_timer -= delta
			velocity.x = _facing_dir.x * 3.0
			velocity.z = _facing_dir.z * 3.0
			if _state_timer <= 0.0:
				_hitbox.end_swing()
				if coordinator:
					coordinator.release_attack_token(self)
				state = AIState.RECOVERY
				_state_timer = 1.2

		AIState.RECOVERY:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _state_timer <= 0.0:
				_enter_search()

		AIState.STAGGER, AIState.RECOIL:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _state_timer <= 0.0:
				_enter_search()

func _enter_search() -> void:
	state = AIState.SEARCH
	_state_timer = search_time

func _begin_sweep(at: Vector3) -> void:
	if coordinator:
		coordinator.request_attack_token(self, true)
	_target_pos = Vector3(at.x, global_position.y, at.z)
	_has_target = true
	_target_age = 0.0
	state = AIState.SWEEP_STARTUP
	_state_timer = 0.85

func _enter_sweep_active() -> void:
	var obstruction: Dictionary = SwingGeometry.sweep_obstruction(self, _facing_dir, sweep_arc_degrees, club_reach, 1.4)
	if not obstruction.is_empty():
		_enter_wall_recoil(obstruction)
		return
	state = AIState.SWEEP_ACTIVE
	_state_timer = 0.26
	if audio:
		audio.play_swing()
	AcousticField.report(self, global_position, 12.0, "swing")
	_hitbox.begin_swing(CombatPayload.new(self, global_position, _facing_dir, 50.0, 70.0, false, true, 7.5))

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
	AcousticField.report(self, global_position, 14.0, "clang")
	SwingGeometry.spawn_sparks(get_parent(), hit.get("position", global_position + _facing_dir * 2.0), normal, 20)
	troll_event_banner.emit("The Troll's club cracks against the quarry wall — strike now!", Color(0.48, 0.78, 0.92))

func _steer_toward(dir: Vector3, speed: float, delta: float) -> void:
	_face_direction(dir, turn_speed, delta)
	# It lumbers the way it faces, so it overshoots when it turns.
	velocity.x = _facing_dir.x * speed + _knockback_vel.x
	velocity.z = _facing_dir.z * speed + _knockback_vel.z

func _face_direction(dir: Vector3, turn: float, delta: float) -> void:
	_facing_dir = _facing_dir.slerp(dir, 1.0 - exp(-turn * delta)).normalized()
	_visual_root.look_at(global_position + _facing_dir, Vector3.UP)

# ------------------------------------------------------------------------------
# Taking hits
# ------------------------------------------------------------------------------
func _on_hurtbox_hit_received(payload: CombatPayload) -> void:
	if state == AIState.DEAD:
		return
	var reeling: bool = state in [AIState.STAGGER, AIState.RECOIL, AIState.RECOVERY]
	var mult: float = 1.0 if (payload.is_heavy or reeling) else hide_light_mult
	health = maxf(0.0, health - payload.physical_damage * mult)
	poise_damage += payload.poise_damage * mult
	if mult < 1.0:
		troll_event_banner.emit("Your blow skids off the Troll's hide", Color(0.72, 0.68, 0.60))

	if health <= 0.0:
		_hitbox.end_swing()
		if coordinator:
			coordinator.release_attack_token(self)
		state = AIState.DEAD
		collision_layer = 0
		_hurtbox.set_deferred("monitorable", false)
		_visual_root.rotation_degrees.x = -85.0
		_visual_root.position.y = 0.4
		troll_event_banner.emit("THE BLIND QUARRY-TROLL IS DEAD", Color(0.88, 0.74, 0.36))
		var corpse := Lootable.attach_corpse(self, "%s Carcass" % enemy_name, ItemDatabase.roll_troll_loot(), 4.5)
		corpse.interact_radius = 2.6
		return

	if poise_damage >= max_poise:
		_hitbox.end_swing()
		if coordinator:
			coordinator.release_attack_token(self)
		poise_damage = 0.0
		state = AIState.STAGGER
		_state_timer = 1.3
		troll_event_banner.emit("Troll Staggered — Strike Now!", Color(0.48, 0.78, 0.92))
		return

	# Pain tells it exactly where you are.
	if state in [AIState.IDLE, AIState.STALK, AIState.CHARGE, AIState.SEARCH]:
		_begin_sweep(payload.attacker_origin)

# ------------------------------------------------------------------------------
# Visuals
# ------------------------------------------------------------------------------
func _update_visual_telegraph() -> void:
	match state:
		AIState.SWEEP_STARTUP:
			_club_pivot.rotation_degrees = Vector3(-20.0, 100.0, 30.0)
			_status_mat.albedo_color = Color(0.95, 0.58, 0.15)
		AIState.SWEEP_ACTIVE:
			_club_pivot.rotation_degrees = Vector3(30.0, -80.0, 0.0)
			_status_mat.albedo_color = Color(0.95, 0.12, 0.12)
		AIState.RECOVERY, AIState.STAGGER, AIState.RECOIL:
			_club_pivot.rotation_degrees = Vector3(55.0, -20.0, 18.0)
			_status_mat.albedo_color = Color(0.38, 0.75, 0.92)
		AIState.CHARGE:
			_club_pivot.rotation_degrees = Vector3(-10.0, 30.0, 0.0)
			_status_mat.albedo_color = Color(0.86, 0.66, 0.30)
		AIState.STALK, AIState.SEARCH:
			_club_pivot.rotation_degrees = Vector3(10.0, 10.0, 0.0)
			_status_mat.albedo_color = Color(0.66, 0.60, 0.42)
		_:
			_club_pivot.rotation_degrees = Vector3.ZERO
			_status_mat.albedo_color = Color(0.36, 0.34, 0.30)

func _build_troll_visuals_and_colliders() -> void:
	collision_layer = 4
	collision_mask = 1 | 2 | 4

	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.8
	cap.height = 2.7
	col.shape = cap
	col.position = Vector3(0.0, 1.35, 0.0)
	add_child(col)

	_visual_root = Node3D.new()
	add_child(_visual_root)

	var hide_mat := StandardMaterial3D.new()
	hide_mat.albedo_color = Color(0.40, 0.39, 0.36) # quarry-dust grey
	hide_mat.roughness = 0.96

	var body := MeshInstance3D.new()
	var b_mesh := CapsuleMesh.new()
	b_mesh.radius = 0.78
	b_mesh.height = 2.3
	body.mesh = b_mesh
	body.material_override = hide_mat
	body.position = Vector3(0.0, 1.25, 0.15)
	body.rotation_degrees.x = 24.0 # hunched
	_visual_root.add_child(body)

	# A smooth, eyeless head thrust forward, listening.
	var head := MeshInstance3D.new()
	var h_mesh := SphereMesh.new()
	h_mesh.radius = 0.36
	h_mesh.height = 0.6
	head.mesh = h_mesh
	head.material_override = hide_mat
	head.position = Vector3(0.0, 2.05, -0.55)
	_visual_root.add_child(head)

	var arm_mat := hide_mat
	for side: float in [-1.0, 1.0]:
		var arm := MeshInstance3D.new()
		var a_mesh := CapsuleMesh.new()
		a_mesh.radius = 0.22
		a_mesh.height = 1.7
		arm.mesh = a_mesh
		arm.material_override = arm_mat
		arm.position = Vector3(0.78 * side, 1.0, -0.2)
		_visual_root.add_child(arm)

	_club_pivot = Node3D.new()
	_club_pivot.position = Vector3(0.9, 1.3, -0.3)
	_visual_root.add_child(_club_pivot)
	var stone_mat := StandardMaterial3D.new()
	stone_mat.albedo_color = Color(0.30, 0.29, 0.27)
	stone_mat.roughness = 0.95
	var club := MeshInstance3D.new()
	var c_mesh := BoxMesh.new()
	c_mesh.size = Vector3(0.42, 0.42, 1.9) # a slab of quarry stone
	club.mesh = c_mesh
	club.material_override = stone_mat
	club.position = Vector3(0.0, 0.0, -1.0)
	_club_pivot.add_child(club)

	_status_mat = StandardMaterial3D.new()
	_status_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_status_mat.albedo_color = Color(0.36, 0.34, 0.30)
	var pip := MeshInstance3D.new()
	var pip_mesh := CylinderMesh.new()
	pip_mesh.top_radius = 0.9
	pip_mesh.bottom_radius = 0.9
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
	hb_box.size = Vector3(2.9, 2.0, 2.7)
	hb_col.shape = hb_box
	hb_col.position = Vector3(0.0, 1.0, -1.5)
	_hitbox.add_child(hb_col)
	_visual_root.add_child(_hitbox)

	_hurtbox = HurtboxComponent.new()
	_hurtbox.owner_entity = self
	_hurtbox.collision_layer = 16
	_hurtbox.collision_mask = 0
	var hurt_col := CollisionShape3D.new()
	var hurt_cap := CapsuleShape3D.new()
	hurt_cap.radius = 0.88
	hurt_cap.height = 2.7
	hurt_col.shape = hurt_cap
	hurt_col.position = Vector3(0.0, 1.35, 0.0)
	_hurtbox.add_child(hurt_col)
	add_child(_hurtbox)
	_hurtbox.hit_received.connect(_on_hurtbox_hit_received)
