class_name EnemyFungusZombie
extends CharacterBody3D
## Milestone 21: a Fungus Zombie. A corpse the rot has taken root in. It
## shambles slowly among the rot mounds, claws when close and, from a few
## metres, spews a cone of spores (telegraphed: it rears back and swells).
## Every wound puffs spores, and when it dies it bursts like a rot mound, so
## fight it at arm's length or with fire: a lit torch held close and toward
## it sets it burning, and a zombie that burns to death burns clean.

signal zombie_event_banner(text: String, col: Color)

enum AIState { SHAMBLE, PURSUE, CLAW_STARTUP, CLAW_ACTIVE, SPEW_STARTUP, RECOVERY, BURNING, STAGGER, DEAD }

@export var enemy_name: String = "Fungus Zombie"
@export var max_health: float = 75.0
@export var max_poise: float = 30.0
@export var shamble_speed: float = 0.8
@export var chase_speed: float = 1.9
@export var sight_range: float = 9.0
@export var claw_range: float = 1.6
@export var spew_range: float = 3.5
@export var spew_arc_degrees: float = 70.0
@export var spew_cooldown_time: float = 5.0
@export var spew_spores: float = 20.0
@export var wound_puff_radius: float = 1.5
@export var wound_puff_spores: float = 10.0
@export var death_burst_radius: float = 2.5
@export var death_burst_spores: float = 20.0
@export var ignite_range: float = 1.8
@export var burn_time: float = 3.5
@export var burn_dps: float = 18.0

var health: float = 75.0
var poise_damage: float = 0.0
var state: AIState = AIState.SHAMBLE
var player_ref: PlayerController
var audio: ProceduralAudio
var coordinator: EncounterCoordinator

var _home_pos: Vector3 = Vector3.ZERO
var _wander_target: Vector3 = Vector3.ZERO
var _target_pos: Vector3 = Vector3.ZERO
var _memory_timer: float = 0.0
var _state_timer: float = 0.0
var _spew_cooldown: float = 0.0
var _facing_dir: Vector3 = Vector3.FORWARD
var _knockback_vel: Vector3 = Vector3.ZERO
var _step_timer: float = 0.0
var _burned_clean: bool = false
var _quiet_death: bool = false

var _visual_root: Node3D
var _status_mat: StandardMaterial3D
var _pip: MeshInstance3D
var _cap_mat: StandardMaterial3D
var _hitbox: HitboxComponent
var _hurtbox: HurtboxComponent

func _ready() -> void:
	add_to_group("enemy")
	health = max_health
	_home_pos = global_position
	_wander_target = global_position
	_build_zombie_visuals_and_colliders()
	AcousticField.listen(self, _on_noise_heard)

func _physics_process(delta: float) -> void:
	if player_ref:
		_visual_root.visible = player_ref.can_see_body(self)
	if state == AIState.DEAD:
		return
	_knockback_vel = _knockback_vel.move_toward(Vector3.ZERO, 12.0 * delta)
	_spew_cooldown = maxf(0.0, _spew_cooldown - delta)
	if poise_damage > 0.0:
		poise_damage = maxf(0.0, poise_damage - 4.0 * delta)
	_evaluate_senses(delta)
	_process_ai_state(delta)
	_update_visual_telegraph()
	if not is_on_floor():
		velocity.y -= 24.0 * delta
	else:
		velocity.y = -0.1
	move_and_slide()
	_step_timer = AcousticField.step_cadence(self, _step_timer, delta, 0.8, 3.0)

func is_dead() -> bool:
	return state == AIState.DEAD

func is_staggered() -> bool:
	return state == AIState.STAGGER

func is_burning() -> bool:
	return state == AIState.BURNING

func burned_clean() -> bool:
	return _burned_clean

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
	if d > 2.0 and _facing_dir.dot(to_p / d) < cos(deg_to_rad(80.0)):
		return false
	var q := PhysicsRayQueryParameters3D.create(
		global_position + Vector3(0.0, 1.4, 0.0), player_ref.global_position + Vector3(0.0, 1.1, 0.0), 1
	)
	return get_world_3d().direct_space_state.intersect_ray(q).is_empty()

## A lit torch held toward it, close: it catches.
func is_threatened_by_fire() -> bool:
	if not _player_alive() or not player_ref.is_torch_lit():
		return false
	var to_z: Vector3 = _flat(global_position - player_ref.global_position)
	var d: float = to_z.length()
	if d > ignite_range or d < 0.01:
		return false
	return player_ref.get_aim_direction().dot(to_z / d) >= 0.5

func _evaluate_senses(delta: float) -> void:
	if _memory_timer > 0.0:
		_memory_timer = maxf(0.0, _memory_timer - delta)
	if state == AIState.BURNING:
		return
	if is_threatened_by_fire():
		ignite()
		return
	if sees_player():
		_hunt(player_ref.global_position)

func _hunt(pos: Vector3) -> void:
	_target_pos = pos
	_memory_timer = 5.0
	if state == AIState.SHAMBLE:
		state = AIState.PURSUE

func _on_noise_heard(world_pos: Vector3, reach: float, source: Node3D, kind: String) -> void:
	if state in [AIState.DEAD, AIState.BURNING] or source == self or not is_inside_tree():
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
		AIState.SHAMBLE:
			var to_w: Vector3 = _flat(_wander_target - global_position)
			if to_w.length() < 0.5:
				_wander_target = _home_pos + Vector3(randf_range(-3.5, 3.5), 0.0, randf_range(-3.5, 3.5))
				velocity.x = _knockback_vel.x
				velocity.z = _knockback_vel.z
			else:
				_steer_toward(to_w.normalized(), shamble_speed, delta)

		AIState.PURSUE:
			if _memory_timer <= 0.0:
				state = AIState.SHAMBLE
				return
			if _player_alive() and sees_player():
				var d: float = _player_dist()
				if d <= claw_range:
					if coordinator == null or coordinator.request_attack_token(self):
						state = AIState.CLAW_STARTUP
						_state_timer = 0.6
						return
				elif d <= spew_range and _spew_cooldown <= 0.0:
					state = AIState.SPEW_STARTUP
					_state_timer = 0.9
					return
			var to_t: Vector3 = _flat(_target_pos - global_position)
			if to_t.length() < 0.6:
				# At the last place it saw or heard you: look around.
				velocity.x = _knockback_vel.x
				velocity.z = _knockback_vel.z
				_face_direction(_facing_dir.rotated(Vector3.UP, 0.6), 1.5, delta)
			else:
				_steer_toward(to_t.normalized(), chase_speed, delta)

		AIState.CLAW_STARTUP, AIState.SPEW_STARTUP:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _player_alive():
				var aim: Vector3 = _flat(player_ref.global_position - global_position)
				if aim.length_squared() > 0.01:
					_face_direction(aim.normalized(), 3.0, delta)
			if _state_timer <= 0.0:
				if state == AIState.CLAW_STARTUP:
					_claw()
				else:
					spew()

		AIState.CLAW_ACTIVE:
			_state_timer -= delta
			velocity.x = _facing_dir.x * 1.2 + _knockback_vel.x
			velocity.z = _facing_dir.z * 1.2 + _knockback_vel.z
			if _state_timer <= 0.0:
				_end_attack(0.9)

		AIState.RECOVERY, AIState.STAGGER:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _state_timer <= 0.0:
				state = AIState.PURSUE if _memory_timer > 0.0 else AIState.SHAMBLE

		AIState.BURNING:
			_state_timer -= delta
			# Flails about while it burns.
			var flail := Vector3(sin(_state_timer * 7.0), 0.0, cos(_state_timer * 5.0))
			velocity.x = flail.x * 1.0 + _knockback_vel.x
			velocity.z = flail.z * 1.0 + _knockback_vel.z
			_take_damage(burn_dps * delta, true)
			if state == AIState.BURNING and _state_timer <= 0.0:
				state = AIState.PURSUE if _memory_timer > 0.0 else AIState.SHAMBLE

func _claw() -> void:
	state = AIState.CLAW_ACTIVE
	_state_timer = 0.15
	if audio:
		audio.play_swing()
	AcousticField.report(self, global_position, 5.0, "swing")
	_hitbox.begin_swing(CombatPayload.new(self, global_position, _facing_dir, 14.0, 12.0, false, false, 1.5))

## The spore cone. Public so tests can fire it directly. Returns true if it
## caught the survivor.
func spew() -> bool:
	_spew_cooldown = spew_cooldown_time
	_end_attack(1.4)
	if audio:
		audio.play_cough()
	AcousticField.report(self, global_position, 6.0, "cough")
	if not _player_alive():
		return false
	var to_p: Vector3 = _flat(player_ref.global_position - global_position)
	var d: float = to_p.length()
	if d > spew_range or (d > 0.3 and _facing_dir.dot(to_p / d) < cos(deg_to_rad(spew_arc_degrees * 0.5))):
		return false
	var q := PhysicsRayQueryParameters3D.create(
		global_position + Vector3(0.0, 1.3, 0.0), player_ref.global_position + Vector3(0.0, 1.1, 0.0), 1
	)
	if not get_world_3d().direct_space_state.intersect_ray(q).is_empty():
		return false
	player_ref.afflict_spores(spew_spores)
	return true

func ignite() -> void:
	if state in [AIState.DEAD, AIState.BURNING]:
		return
	_hitbox.end_swing()
	if coordinator:
		coordinator.release_attack_token(self)
	state = AIState.BURNING
	_state_timer = burn_time
	zombie_event_banner.emit("The fungus zombie catches fire!", Color(0.95, 0.60, 0.25))

func _end_attack(recovery: float) -> void:
	_hitbox.end_swing()
	if coordinator:
		coordinator.release_attack_token(self)
	state = AIState.RECOVERY
	_state_timer = recovery

func _steer_toward(dir: Vector3, speed: float, delta: float) -> void:
	_face_direction(dir, 3.0, delta)
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
func _spores_at(radius: float, amount: float) -> bool:
	if not _player_alive():
		return false
	if _player_dist() > radius:
		return false
	player_ref.afflict_spores(amount)
	return true

func _on_hurtbox_hit_received(payload: CombatPayload) -> void:
	if state == AIState.DEAD:
		return
	_knockback_vel = _flat(global_position - payload.attacker_origin).normalized() * payload.knockback_force * 0.5
	_take_damage(payload.physical_damage, state == AIState.BURNING)
	if state == AIState.DEAD:
		return
	if state != AIState.BURNING:
		_spores_at(wound_puff_radius, wound_puff_spores) # every wound puffs
		poise_damage += payload.poise_damage
		if poise_damage >= max_poise:
			poise_damage = 0.0
			_hitbox.end_swing()
			if coordinator:
				coordinator.release_attack_token(self)
			state = AIState.STAGGER
			_state_timer = 0.9
			return
	if payload.attacker is PlayerController:
		_hunt(payload.attacker_origin)

## Loading a save: dead already, so no burst, no noise.
func restore_dead() -> void:
	if state == AIState.DEAD:
		return
	_quiet_death = true
	_take_damage(health + 1.0, false)

func _take_damage(amount: float, by_fire: bool) -> void:
	health = maxf(0.0, health - amount)
	if health > 0.0:
		return
	_hitbox.end_swing()
	if coordinator:
		coordinator.release_attack_token(self)
	state = AIState.DEAD
	collision_layer = 0
	_hurtbox.set_deferred("monitorable", false)
	_visual_root.rotation_degrees.x = -85.0
	_visual_root.position.y = 0.25
	_burned_clean = by_fire
	if by_fire:
		_cap_mat.albedo_color = Color(0.12, 0.10, 0.08) # charred
		zombie_event_banner.emit("It burns clean — no spores", Color(0.85, 0.66, 0.40))
	elif not _quiet_death:
		_spores_at(death_burst_radius, death_burst_spores)
		AcousticField.report(self, global_position, 8.0, "burst")
	Lootable.attach_corpse(self, "%s Remains" % enemy_name, ItemDatabase.roll_zombie_loot(), 2.5)

# ------------------------------------------------------------------------------
# Visuals (placeholder; see docs/VISUAL_DIRECTION.md, sheet 12: spore-spewing fungus zombie)
# ------------------------------------------------------------------------------
func _update_visual_telegraph() -> void:
	match state:
		AIState.SPEW_STARTUP:
			_visual_root.rotation_degrees.x = 14.0 # rears back, swelling
			_status_mat.albedo_color = Color(0.70, 0.85, 0.25)
		AIState.CLAW_STARTUP:
			_visual_root.rotation_degrees.x = -6.0
			_status_mat.albedo_color = Color(0.95, 0.60, 0.15)
		AIState.CLAW_ACTIVE:
			_status_mat.albedo_color = Color(0.92, 0.18, 0.15)
		AIState.BURNING:
			_visual_root.rotation_degrees.x = 0.0
			_status_mat.albedo_color = Color(1.0, 0.45, 0.10)
		AIState.RECOVERY, AIState.STAGGER:
			_visual_root.rotation_degrees.x = 0.0
			_status_mat.albedo_color = Color(0.42, 0.68, 0.85)
		_:
			_visual_root.rotation_degrees.x = 0.0
			_status_mat.albedo_color = Color(0.34, 0.38, 0.22)
	if state == AIState.BURNING:
		_cap_mat.albedo_color = Color(0.95, 0.42, 0.12)
	elif state != AIState.DEAD:
		_cap_mat.albedo_color = Color(0.62, 0.52, 0.30)
	# Keep the status ring flat on the ground while the body tilts.
	_pip.rotation_degrees.x = -_visual_root.rotation_degrees.x


func _build_zombie_visuals_and_colliders() -> void:
	collision_layer = 4
	collision_mask = 1 | 2 | 4
	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.35
	cap.height = 1.7
	col.shape = cap
	col.position = Vector3(0.0, 0.85, 0.0)
	add_child(col)

	_visual_root = Node3D.new()
	add_child(_visual_root)
	var flesh := StandardMaterial3D.new()
	flesh.albedo_color = Color(0.36, 0.38, 0.30) # grey-green, waterlogged
	flesh.roughness = 0.8
	var body := MeshInstance3D.new()
	var b_mesh := CapsuleMesh.new()
	b_mesh.radius = 0.3
	b_mesh.height = 1.5
	body.mesh = b_mesh
	body.material_override = flesh
	body.rotation_degrees.x = 12.0 # stooped
	body.position = Vector3(0.0, 0.85, 0.0)
	_visual_root.add_child(body)
	_cap_mat = StandardMaterial3D.new()
	_cap_mat.albedo_color = Color(0.62, 0.52, 0.30)
	for cap_pos: Vector3 in [Vector3(0.0, 1.72, 0.05), Vector3(0.22, 1.45, 0.12), Vector3(-0.2, 1.3, 0.15)]:
		var shroom := MeshInstance3D.new()
		var s_mesh := SphereMesh.new()
		s_mesh.radius = 0.16 if cap_pos.y > 1.6 else 0.1
		s_mesh.height = s_mesh.radius
		shroom.mesh = s_mesh
		shroom.material_override = _cap_mat
		shroom.position = cap_pos
		_visual_root.add_child(shroom)
	for side: float in [-1.0, 1.0]:
		var arm := MeshInstance3D.new()
		var a_mesh := CapsuleMesh.new()
		a_mesh.radius = 0.07
		a_mesh.height = 0.8
		arm.mesh = a_mesh
		arm.material_override = flesh
		arm.rotation_degrees.x = 70.0 # reaching
		arm.position = Vector3(0.3 * side, 1.1, -0.3)
		_visual_root.add_child(arm)

	_status_mat = StandardMaterial3D.new()
	_status_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_status_mat.albedo_color = Color(0.34, 0.38, 0.22)
	var pip := MeshInstance3D.new()
	var pip_mesh := CylinderMesh.new()
	pip_mesh.top_radius = 0.5
	pip_mesh.bottom_radius = 0.5
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
	hb_box.size = Vector3(1.0, 1.2, 1.2)
	hb_col.shape = hb_box
	hb_col.position = Vector3(0.0, 1.0, -0.9)
	_hitbox.add_child(hb_col)
	_visual_root.add_child(_hitbox)

	_hurtbox = HurtboxComponent.new()
	_hurtbox.owner_entity = self
	_hurtbox.collision_layer = 16
	_hurtbox.collision_mask = 0
	var hurt_col := CollisionShape3D.new()
	var hurt_cap := CapsuleShape3D.new()
	hurt_cap.radius = 0.4
	hurt_cap.height = 1.8
	hurt_col.shape = hurt_cap
	hurt_col.position = Vector3(0.0, 0.9, 0.0)
	_hurtbox.add_child(hurt_col)
	add_child(_hurtbox)
	_hurtbox.hit_received.connect(_on_hurtbox_hit_received)
