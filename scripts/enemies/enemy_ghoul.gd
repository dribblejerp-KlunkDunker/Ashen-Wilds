class_name EnemyGhoul
extends CharacterBody3D
## Milestone 15: the Ghoul. A corpse-eater from the Drowned Barrow. Between
## hunts it goes to the nearest corpse and gnaws it, healing itself and
## spoiling the food, cloth and herbs on the body (metal survives). It smells
## blood: while the survivor bleeds, it knows where they are within
## `blood_scent_range`, through walls. Fast and fragile; its claw rake
## often opens a bleeding wound. Claws are thrusts: they never clang.

signal ghoul_event_banner(text: String, col: Color)

enum AIState {
	WANDER,
	SEEK_CORPSE,
	EAT,
	PURSUE,
	ATTACK_STARTUP,
	ATTACK_ACTIVE,
	ATTACK_RECOVERY,
	STAGGER,
	DEAD
}

@export var enemy_name: String = "Barrow Ghoul"
@export var max_health: float = 90.0
@export var max_poise: float = 26.0
@export var run_speed: float = 4.6
@export var sight_range: float = 12.0
@export var blood_scent_range: float = 25.0
@export var corpse_search_range: float = 30.0
@export var eat_time: float = 5.0
@export var claw_bleed_chance: float = 0.6

## Milestone 19: the ghoul sees in the dark, and the night makes it bolder:
## its blood scent reaches half as far again and it runs faster.
var night_eyed: bool = true
const NIGHT_SCENT_BONUS: float = 0.5
const NIGHT_SPEED_BONUS: float = 0.15
var health: float = 90.0
var poise_damage: float = 0.0
var state: AIState = AIState.WANDER
var player_ref: PlayerController
var audio: ProceduralAudio
var coordinator: EncounterCoordinator

var _home_pos: Vector3 = Vector3.ZERO
var _wander_target: Vector3 = Vector3.ZERO
var _state_timer: float = 0.0
var _facing_dir: Vector3 = Vector3.FORWARD
var _knockback_vel: Vector3 = Vector3.ZERO
var _target_pos: Vector3 = Vector3.ZERO
var _memory_timer: float = 0.0
var _corpse: Lootable = null
var _corpse_cooldown: float = 0.0
var _scent_announced: bool = false
var _second_claw: bool = false
var _step_timer: float = 0.0

var _visual_root: Node3D
var _arm_l: Node3D
var _arm_r: Node3D
var _status_mat: StandardMaterial3D
var _hitbox: HitboxComponent
var _hurtbox: HurtboxComponent

func _ready() -> void:
	add_to_group("enemy")
	health = max_health
	_home_pos = global_position
	_wander_target = global_position
	_build_ghoul_visuals_and_colliders()
	AcousticField.listen(self, _on_noise_heard)

func _physics_process(delta: float) -> void:
	if player_ref:
		_visual_root.visible = player_ref.can_see_body(self)
	if state == AIState.DEAD:
		return
	_knockback_vel = _knockback_vel.move_toward(Vector3.ZERO, 14.0 * delta)
	if poise_damage > 0.0:
		poise_damage = maxf(0.0, poise_damage - 6.0 * delta)
	_corpse_cooldown = maxf(0.0, _corpse_cooldown - delta)
	_evaluate_senses(delta)
	_process_ai_state(delta)
	_update_visual_telegraph()
	if not is_on_floor():
		velocity.y -= 24.0 * delta
	else:
		velocity.y = -0.1
	move_and_slide()
	_step_timer = AcousticField.step_cadence(self, _step_timer, delta, 0.3, 4.0)

func is_dead() -> bool:
	return state == AIState.DEAD

func is_staggered() -> bool:
	return state == AIState.STAGGER

func is_eating() -> bool:
	return state == AIState.EAT

# ------------------------------------------------------------------------------
# Senses: sight, hearing, and the smell of blood
# ------------------------------------------------------------------------------
func _evaluate_senses(delta: float) -> void:
	if _memory_timer > 0.0:
		_memory_timer = maxf(0.0, _memory_timer - delta)
	if player_ref == null or player_ref.current_state == PlayerController.ActionState.DEAD:
		return
	if smells_blood():
		if not _scent_announced and not _visual_root.visible:
			_scent_announced = true
			ghoul_event_banner.emit("Something in the dark has smelled your blood…", Color(0.80, 0.30, 0.28))
		_hunt(player_ref.global_position)
		return
	if not player_ref.is_bleeding:
		_scent_announced = false
	if _sees_player():
		_hunt(player_ref.global_position)

func smells_blood() -> bool:
	if player_ref == null or not player_ref.is_bleeding:
		return false
	var flat := Vector2(player_ref.global_position.x - global_position.x, player_ref.global_position.z - global_position.z)
	return flat.length() <= get_scent_range()

func get_scent_range() -> float:
	return blood_scent_range * (1.0 + NIGHT_SCENT_BONUS * DayNightCycle.darkness(self))

func get_run_speed() -> float:
	return run_speed * (1.0 + NIGHT_SPEED_BONUS * DayNightCycle.darkness(self))

func _sees_player() -> bool:
	var to_p: Vector3 = player_ref.global_position - global_position
	to_p.y = 0.0
	var dist: float = to_p.length()
	if dist > sight_range * WeatherSystem.factor(self, "sight"):
		return false
	if dist > 2.5 and _facing_dir.dot(to_p / maxf(dist, 0.01)) < cos(deg_to_rad(60.0)):
		return false
	var q := PhysicsRayQueryParameters3D.create(
		global_position + Vector3(0.0, 1.1, 0.0), player_ref.global_position + Vector3(0.0, 1.1, 0.0), 1
	)
	return get_world_3d().direct_space_state.intersect_ray(q).is_empty()

func _hunt(pos: Vector3) -> void:
	_target_pos = pos
	_memory_timer = 6.0
	if state in [AIState.WANDER, AIState.SEEK_CORPSE, AIState.EAT]:
		_corpse = null
		state = AIState.PURSUE

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
		AIState.WANDER:
			var to_w: Vector3 = _wander_target - global_position
			to_w.y = 0.0
			if to_w.length() < 0.6:
				_wander_target = _home_pos + Vector3(randf_range(-4.0, 4.0), 0.0, randf_range(-4.0, 4.0))
				velocity.x = _knockback_vel.x
				velocity.z = _knockback_vel.z
			else:
				_steer_toward(to_w.normalized(), 1.6, delta)
			if _corpse_cooldown <= 0.0:
				_corpse_cooldown = 1.0
				var c: Lootable = find_nearest_corpse()
				if c != null:
					_corpse = c
					state = AIState.SEEK_CORPSE

		AIState.SEEK_CORPSE:
			if not _corpse_valid(_corpse):
				_corpse = null
				state = AIState.WANDER
				return
			var to_c: Vector3 = _corpse.global_position - global_position
			to_c.y = 0.0
			if to_c.length() <= 1.3:
				state = AIState.EAT
				_state_timer = eat_time
			else:
				_steer_toward(to_c.normalized(), 3.2, delta)

		AIState.EAT:
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if not _corpse_valid(_corpse):
				state = AIState.WANDER
				return
			_state_timer -= delta
			if fmod(_state_timer, 0.8) < delta:
				AcousticField.report(self, global_position, 6.0, "gnaw")
			if _state_timer <= 0.0:
				finish_eating()

		AIState.PURSUE:
			if _memory_timer <= 0.0:
				state = AIState.WANDER
				return
			var to_t: Vector3 = _target_pos - global_position
			to_t.y = 0.0
			var dist: float = to_t.length()
			if player_ref and Vector2(player_ref.global_position.x - global_position.x, player_ref.global_position.z - global_position.z).length() <= 1.7:
				if _try_begin_attack():
					return
			if dist < 0.8:
				_memory_timer = minf(_memory_timer, 0.5)
				velocity.x = _knockback_vel.x
				velocity.z = _knockback_vel.z
			else:
				_steer_toward(to_t.normalized(), get_run_speed(), delta)

		AIState.ATTACK_STARTUP:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if player_ref:
				var aim: Vector3 = player_ref.global_position - global_position
				aim.y = 0.0
				if aim.length_squared() > 0.01:
					_face_direction(aim.normalized(), 6.0, delta)
			if _state_timer <= 0.0:
				_enter_attack_active()

		AIState.ATTACK_ACTIVE:
			_state_timer -= delta
			velocity.x = _facing_dir.x * 4.8 + _knockback_vel.x
			velocity.z = _facing_dir.z * 4.8 + _knockback_vel.z
			if _state_timer <= 0.0:
				_hitbox.end_swing()
				if not _second_claw:
					_second_claw = true
					state = AIState.ATTACK_STARTUP
					_state_timer = 0.18
				else:
					if coordinator:
						coordinator.release_attack_token(self)
					state = AIState.ATTACK_RECOVERY
					_state_timer = 0.6

		AIState.ATTACK_RECOVERY, AIState.STAGGER:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _state_timer <= 0.0:
				state = AIState.PURSUE
				_memory_timer = maxf(_memory_timer, 1.0)

func _try_begin_attack() -> bool:
	if coordinator and not coordinator.request_attack_token(self):
		return false
	_second_claw = false
	state = AIState.ATTACK_STARTUP
	_state_timer = 0.4
	return true

## A two-claw rake. Claws are thrusts: they never clang off walls.
func _enter_attack_active() -> void:
	state = AIState.ATTACK_ACTIVE
	_state_timer = 0.12
	if audio:
		audio.play_swing()
	AcousticField.report(self, global_position, 5.0, "swing")
	_hitbox.begin_swing(CombatPayload.new(self, global_position, _facing_dir, 12.0, 10.0, randf() < claw_bleed_chance, false, 2.0))

# ------------------------------------------------------------------------------
# Corpses
# ------------------------------------------------------------------------------
func _corpse_valid(c: Lootable) -> bool:
	return c != null and is_instance_valid(c) and c.is_inside_tree() and not c.is_queued_for_deletion() and not c.get_meta("gnawed", false)

func find_nearest_corpse() -> Lootable:
	if not is_inside_tree():
		return null
	var best: Lootable = null
	var best_d: float = corpse_search_range
	for n: Node in get_tree().get_nodes_in_group("lootable"):
		var l := n as Lootable
		if l == null or not l.get_meta("corpse", false) or not _corpse_valid(l):
			continue
		var d: float = l.global_position.distance_to(global_position)
		if d < best_d:
			best_d = d
			best = l
	return best

## Eats the corpse: heals fully, spoils food, cloth and herbs (metal survives).
func finish_eating() -> void:
	if _corpse_valid(_corpse):
		var kept: Array[ItemInstance] = []
		for inst: ItemInstance in _corpse.items:
			if inst.data.category in [ItemData.Category.WEAPON, ItemData.Category.ARMOR, ItemData.Category.SHIELD, ItemData.Category.TOOL] or inst.data.item_id in ["iron_scrap", "troll_hide"]:
				kept.append(inst)
		_corpse.items = kept
		_corpse.set_meta("gnawed", true)
		_corpse.display_name = "Gnawed " + _corpse.display_name
		_corpse.contents_changed.emit()
	health = max_health
	_corpse = null
	state = AIState.WANDER

func _steer_toward(dir: Vector3, speed: float, delta: float) -> void:
	var move: Vector3 = _avoid_obstacles(dir, delta)
	_face_direction(move, 10.0, delta)
	velocity.x = move.x * speed + _knockback_vel.x
	velocity.z = move.z * speed + _knockback_vel.z

## Wall-following: when pressed against stone, slide along its face (keeping
## the same side for a moment) instead of grinding into it.
var _detour_dir: Vector3 = Vector3.ZERO
var _detour_timer: float = 0.0

func _avoid_obstacles(dir: Vector3, delta: float) -> Vector3:
	if _detour_timer > 0.0:
		_detour_timer -= delta
		return (_detour_dir + dir * 0.25).normalized()
	if is_on_wall():
		var n: Vector3 = get_wall_normal()
		n.y = 0.0
		if n.length_squared() > 0.01 and n.normalized().dot(dir) < -0.2:
			var tangent: Vector3 = n.normalized().cross(Vector3.UP)
			if tangent.dot(dir) < 0.0:
				tangent = -tangent
			_detour_dir = tangent
			_detour_timer = 0.6
			return tangent
	return dir

func _face_direction(dir: Vector3, turn_speed: float, delta: float) -> void:
	_facing_dir = _facing_dir.slerp(dir, 1.0 - exp(-turn_speed * delta)).normalized()
	_visual_root.look_at(global_position + _facing_dir, Vector3.UP)

# ------------------------------------------------------------------------------
# Taking hits
# ------------------------------------------------------------------------------
func _on_hurtbox_hit_received(payload: CombatPayload) -> void:
	if state == AIState.DEAD:
		return
	_hitbox.end_swing()
	health = maxf(0.0, health - payload.physical_damage)
	poise_damage += payload.poise_damage
	_hunt(payload.attacker_origin)
	var away: Vector3 = global_position - payload.attacker_origin
	away.y = 0.0
	if away.length_squared() > 0.01:
		_knockback_vel = away.normalized() * payload.knockback_force
	if health <= 0.0:
		if coordinator:
			coordinator.release_attack_token(self)
		state = AIState.DEAD
		collision_layer = 0
		_hurtbox.set_deferred("monitorable", false)
		_visual_root.rotation_degrees.x = -85.0
		_visual_root.position.y = 0.2
		Lootable.attach_corpse(self, "%s Corpse" % enemy_name, ItemDatabase.roll_ghoul_loot(), 2.6)
		return
	if poise_damage >= max_poise or payload.is_heavy:
		if coordinator:
			coordinator.release_attack_token(self)
		poise_damage = 0.0
		state = AIState.STAGGER
		_state_timer = 0.6

# ------------------------------------------------------------------------------
# Visuals (placeholder; see docs/VISUAL_DIRECTION.md, sheets 07 and 12)
# ------------------------------------------------------------------------------
func _update_visual_telegraph() -> void:
	match state:
		AIState.ATTACK_STARTUP:
			_arm_l.rotation_degrees = Vector3(-70.0, 0.0, 0.0)
			_arm_r.rotation_degrees = Vector3(-70.0, 0.0, 0.0)
			_status_mat.albedo_color = Color(0.95, 0.62, 0.15)
		AIState.ATTACK_ACTIVE:
			_arm_l.rotation_degrees = Vector3(-100.0, 0.0, 0.0) if _second_claw else Vector3(-10.0, 0.0, 0.0)
			_arm_r.rotation_degrees = Vector3(-10.0, 0.0, 0.0) if _second_claw else Vector3(-100.0, 0.0, 0.0)
			_status_mat.albedo_color = Color(0.92, 0.18, 0.15)
		AIState.ATTACK_RECOVERY, AIState.STAGGER:
			_arm_l.rotation_degrees = Vector3(20.0, 0.0, 0.0)
			_arm_r.rotation_degrees = Vector3(20.0, 0.0, 0.0)
			_status_mat.albedo_color = Color(0.42, 0.68, 0.85)
		AIState.EAT:
			_arm_l.rotation_degrees = Vector3(-40.0, 0.0, 0.0)
			_arm_r.rotation_degrees = Vector3(-50.0, 0.0, 0.0)
			_status_mat.albedo_color = Color(0.55, 0.22, 0.20)
		_:
			_arm_l.rotation_degrees = Vector3(-15.0, 0.0, 0.0)
			_arm_r.rotation_degrees = Vector3(-15.0, 0.0, 0.0)
			_status_mat.albedo_color = Color(0.44, 0.42, 0.38)

func _build_ghoul_visuals_and_colliders() -> void:
	collision_layer = 4
	collision_mask = 1 | 2 | 4
	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.32
	cap.height = 1.5
	col.shape = cap
	col.position = Vector3(0.0, 0.75, 0.0)
	add_child(col)

	_visual_root = Node3D.new()
	add_child(_visual_root)
	var skin := StandardMaterial3D.new()
	skin.albedo_color = Color(0.46, 0.44, 0.40) # grave-grey
	skin.roughness = 0.9
	var body := MeshInstance3D.new()
	var b_mesh := CapsuleMesh.new()
	b_mesh.radius = 0.26
	b_mesh.height = 1.2
	body.mesh = b_mesh
	body.material_override = skin
	body.position = Vector3(0.0, 0.72, 0.1)
	body.rotation_degrees.x = 32.0 # crouched, hunting
	_visual_root.add_child(body)
	var head := MeshInstance3D.new()
	var h_mesh := SphereMesh.new()
	h_mesh.radius = 0.17
	h_mesh.height = 0.3
	head.mesh = h_mesh
	head.material_override = skin
	head.position = Vector3(0.0, 1.12, -0.3)
	_visual_root.add_child(head)
	for side: float in [-1.0, 1.0]:
		var pivot := Node3D.new()
		pivot.position = Vector3(0.26 * side, 1.0, -0.15)
		_visual_root.add_child(pivot)
		var arm := MeshInstance3D.new()
		var a_mesh := CapsuleMesh.new()
		a_mesh.radius = 0.06
		a_mesh.height = 0.95 # long arms, long claws
		arm.mesh = a_mesh
		arm.material_override = skin
		arm.position = Vector3(0.0, -0.4, 0.0)
		pivot.add_child(arm)
		if side < 0.0:
			_arm_l = pivot
		else:
			_arm_r = pivot

	_status_mat = StandardMaterial3D.new()
	_status_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_status_mat.albedo_color = Color(0.44, 0.42, 0.38)
	var pip := MeshInstance3D.new()
	var pip_mesh := CylinderMesh.new()
	pip_mesh.top_radius = 0.4
	pip_mesh.bottom_radius = 0.4
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
	hb_box.size = Vector3(0.9, 1.0, 1.3)
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
	hurt_cap.height = 1.55
	hurt_col.shape = hurt_cap
	hurt_col.position = Vector3(0.0, 0.78, 0.0)
	_hurtbox.add_child(hurt_col)
	add_child(_hurtbox)
	_hurtbox.hit_received.connect(_on_hurtbox_hit_received)
