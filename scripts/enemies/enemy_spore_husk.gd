class_name EnemySporeHusk
extends CharacterBody3D
## THE ASH-SPORE HUSK. One of the Ashbound's dead, colonised by the spores that came out of the
## Deep-Seam Vaults. Slow (it shambles slower than you walk), half-blind and weak alone; the danger
## is what it carries. Every wound puffs spores, and when it dies it bursts into a choking cloud
## (SporeCloud) where it stood: cut one down at arm's length and you stand in its cloud. Its claw
## drives spores into you, and you choke for a moment. Fire burns spores, so the torch is the
## answer to a hollow full of husks; still air keeps a cloud hanging, wind and sleet clear it.
## They gather in the Spore Hollow on the yard's west edge.

enum AIState { IDLE, SHAMBLE, CLAW_STARTUP, CLAW_ACTIVE, RECOVERY, STAGGER, DEAD }

const SIGHT_RANGE: float = 8.0
const SIGHT_HALF_ANGLE: float = 60.0
const HEARING_SPRINT: float = 8.0
const MEMORY_SECONDS: float = 5.0
const SHAMBLE_SPEED: float = 1.9
const CLAW_RANGE: float = 1.5
const CLAW_DAMAGE: float = 16.0
const CLAW_POISE: float = 14.0
const CLAW_STARTUP: float = 0.7
const CLAW_ACTIVE_TIME: float = 0.2
const CLAW_RECOVERY: float = 0.9
## Seconds of choking a claw drives in.
const CLAW_CHOKE_SECONDS: float = 2.0
const PUFF_RADIUS: float = 1.2
const PUFF_SECONDS: float = 3.0
const BURST_RADIUS: float = 2.4
const BURST_SECONDS: float = 8.0
const STAGGER_TIME: float = 0.6

@export var enemy_name: String = "Ash-Spore Husk"
@export var max_health: float = 55.0
@export var max_poise: float = 25.0

@export_group("Temperament")
## How doggedly it follows, 0 to 1: how long it remembers you (3 s at 0, 8 s at 1) and how
## soon it claws again after a swing (recovery 1.2 s at 0, 0.6 s at 1).
@export_range(0.0, 1.0) var aggression: float = 0.4
## Scales the damage of its claw.
@export var attack_power: float = 1.0
@export_group("")

var health: float = 55.0
var poise_damage: float = 0.0
var state: AIState = AIState.IDLE
var player_ref: PlayerController
var audio: ProceduralAudio
var coordinator: EncounterCoordinator

var _last_known: Vector3 = Vector3.ZERO
var _memory: float = 0.0
var _state_timer: float = 0.0
var _facing_dir: Vector3 = Vector3.FORWARD
var _knockback_vel: Vector3 = Vector3.ZERO
var _sway_t: float = 0.0

var _visual_root: Node3D
var _model: EnemyModel
## Its claws: the empty right hand (every enemy keeps a weapon arm in its right socket).
var _weapon_arm: Node3D
var _anim_state: int = -1
var _status_mat: StandardMaterial3D
var _hitbox: HitboxComponent
var _hurtbox: HurtboxComponent


func _ready() -> void:
	health = max_health
	_sway_t = randf() * TAU
	_build_body()


func _physics_process(delta: float) -> void:
	_update_visibility()
	if state == AIState.DEAD:
		return
	_knockback_vel = _knockback_vel.move_toward(Vector3.ZERO, 14.0 * delta)
	if poise_damage > 0.0:
		poise_damage = maxf(0.0, poise_damage - 5.0 * delta)
	if player_ref != null and player_ref.current_state == PlayerController.ActionState.DEAD:
		_stand_down()
	else:
		_sense(delta)
	_process_ai_state(delta)
	_report_noises(delta)
	_update_visual_telegraph()
	if not is_on_floor():
		velocity.y -= 24.0 * delta
	else:
		velocity.y = -0.1
	move_and_slide()


func is_dead() -> bool:
	return state == AIState.DEAD


func is_staggered() -> bool:
	return state in [AIState.STAGGER, AIState.RECOVERY]


func memory_seconds() -> float:
	return lerpf(3.0, 8.0, aggression)


func claw_recovery() -> float:
	return lerpf(1.2, 0.6, aggression)


## True when it can see the survivor: within SIGHT_RANGE, inside its cone, no wall between.
func sees_player() -> bool:
	if player_ref == null:
		return false
	var to_p: Vector3 = player_ref.global_position - global_position
	to_p.y = 0.0
	var dist: float = to_p.length()
	if dist > SIGHT_RANGE:
		return false
	if dist > 1.2 and _facing_dir.dot(to_p.normalized()) < cos(deg_to_rad(SIGHT_HALF_ANGLE)):
		return false
	var q := PhysicsRayQueryParameters3D.create(global_position + Vector3(0.0, 1.5, 0.0), player_ref.global_position + Vector3(0.0, 1.1, 0.0), 1)
	return get_world_3d().direct_space_state.intersect_ray(q).is_empty()


func _sense(delta: float) -> void:
	_memory = maxf(0.0, _memory - delta)
	if player_ref == null:
		return
	var heard: bool = (
		player_ref.current_state in [PlayerController.ActionState.SPRINT, PlayerController.ActionState.ATTACK_ACTIVE]
		and global_position.distance_to(player_ref.global_position) <= HEARING_SPRINT * player_ref.get_noise_multiplier()
	)
	if sees_player() or heard:
		_last_known = player_ref.global_position
		_memory = memory_seconds()
		if state == AIState.IDLE:
			state = AIState.SHAMBLE


func _process_ai_state(delta: float) -> void:
	match state:
		AIState.IDLE:
			# Swaying on the spot.
			_sway_t += delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			_face_toward(global_position + Vector3(sin(_sway_t * 0.4), 0.0, cos(_sway_t * 0.4)), 0.6, delta)

		AIState.SHAMBLE:
			if _memory <= 0.0:
				state = AIState.IDLE
				return
			var target: Vector3 = player_ref.global_position if player_ref != null and sees_player() else _last_known
			var to_t: Vector3 = target - global_position
			to_t.y = 0.0
			if player_ref != null and global_position.distance_to(player_ref.global_position) <= CLAW_RANGE:
				if _try_begin_claw():
					return
			if to_t.length() < 0.5:
				velocity.x = _knockback_vel.x
				velocity.z = _knockback_vel.z
				return
			_face_toward(target, 4.0, delta)
			velocity.x = to_t.normalized().x * SHAMBLE_SPEED + _knockback_vel.x
			velocity.z = to_t.normalized().z * SHAMBLE_SPEED + _knockback_vel.z

		AIState.CLAW_STARTUP:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if player_ref != null:
				_face_toward(player_ref.global_position, 4.0, delta)
			if _state_timer <= 0.0:
				_enter_claw_active()

		AIState.CLAW_ACTIVE:
			_state_timer -= delta
			velocity.x = _facing_dir.x * 2.0 + _knockback_vel.x
			velocity.z = _facing_dir.z * 2.0 + _knockback_vel.z
			if _state_timer <= 0.0:
				_hitbox.end_swing()
				_release_token()
				state = AIState.RECOVERY
				_state_timer = claw_recovery()

		AIState.RECOVERY, AIState.STAGGER:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _state_timer <= 0.0:
				state = AIState.SHAMBLE if _memory > 0.0 else AIState.IDLE


func _try_begin_claw() -> bool:
	if coordinator and not coordinator.request_attack_token(self):
		return false
	state = AIState.CLAW_STARTUP
	_state_timer = CLAW_STARTUP
	_noise(8.0)
	return true


func _enter_claw_active() -> void:
	state = AIState.CLAW_ACTIVE
	_state_timer = CLAW_ACTIVE_TIME
	if audio:
		audio.play_swing()
	_hitbox.begin_swing(CombatPayload.new(self, global_position, _facing_dir, CLAW_DAMAGE * attack_power, CLAW_POISE, false, false, 1.5))


func _on_claw_landed(target: Node3D, _payload: CombatPayload) -> void:
	var p := target as PlayerController
	if p != null:
		p.choke(CLAW_CHOKE_SECONDS, 0.0)


func _release_token() -> void:
	if coordinator:
		coordinator.release_attack_token(self)


## The survivor is dead: drop the claw, forget them, and sway where it stands.
func _stand_down() -> void:
	if state in [AIState.IDLE, AIState.DEAD]:
		return
	_hitbox.end_swing()
	_release_token()
	_memory = 0.0
	state = AIState.IDLE


func _face_toward(point: Vector3, turn_speed: float, delta: float) -> void:
	var dir: Vector3 = point - global_position
	dir.y = 0.0
	if dir.length_squared() < 0.0001:
		return
	_facing_dir = _facing_dir.slerp(dir.normalized(), 1.0 - exp(-turn_speed * delta)).normalized()
	_visual_root.look_at(global_position + _facing_dir, Vector3.UP)


func _on_hurtbox_hit_received(payload: CombatPayload) -> void:
	if state == AIState.DEAD:
		return
	health = maxf(0.0, health - payload.physical_damage)
	poise_damage += payload.poise_damage
	_last_known = payload.attacker_origin
	_memory = memory_seconds()
	var away: Vector3 = global_position - payload.attacker_origin
	away.y = 0.0
	if away.length_squared() > 0.01:
		_knockback_vel = away.normalized() * payload.knockback_force
	if health <= 0.0:
		_hitbox.end_swing()
		_release_token()
		state = AIState.DEAD
		collision_layer = 0
		_hurtbox.set_deferred("monitorable", false)
		_model.play(&"Death01")
		SporeCloud.spawn.call_deferred(get_parent(), global_position, BURST_RADIUS, BURST_SECONDS)
		_noise(12.0)
		Lootable.attach_corpse(self, "%s Remains" % enemy_name, ItemDatabase.roll_husk_loot(), 2.0)
		return
	# Every wound puffs spores.
	SporeCloud.spawn.call_deferred(get_parent(), global_position, PUFF_RADIUS, PUFF_SECONDS)
	if state == AIState.IDLE:
		state = AIState.SHAMBLE
	if poise_damage >= max_poise or payload.is_heavy:
		poise_damage = 0.0
		_hitbox.end_swing()
		_release_token()
		state = AIState.STAGGER
		_state_timer = STAGGER_TIME


## Drawn only while the survivor can see it (their vision cone, cut by walls: Perception).
func _update_visibility() -> void:
	if player_ref == null or player_ref.perception == null:
		return
	player_ref.perception.update_visibility(self, _visual_root, 1.5, state != AIState.DEAD)


## What the survivor may hear of it: a soft, dragging shuffle and a wet groan as it claws.
func _report_noises(delta: float) -> void:
	if player_ref == null or player_ref.perception == null:
		return
	var speed: float = Vector2(velocity.x, velocity.z).length()
	player_ref.perception.report_footsteps(self, delta, speed, 1.0, 5.0)


func _noise(loudness: float) -> void:
	if player_ref != null and player_ref.perception != null:
		player_ref.perception.report_noise(global_position, loudness, self)


func _update_visual_telegraph() -> void:
	match state:
		AIState.CLAW_STARTUP:
			_status_mat.albedo_color = Color(0.95, 0.65, 0.15)
		AIState.CLAW_ACTIVE:
			_status_mat.albedo_color = Color(0.92, 0.18, 0.15)
		AIState.RECOVERY, AIState.STAGGER:
			_status_mat.albedo_color = Color(0.42, 0.68, 0.85)
		_:
			_status_mat.albedo_color = Color(0.46, 0.50, 0.32)
	if _model == null or state == AIState.DEAD:
		return
	if state != _anim_state:
		_anim_state = state
		match state:
			AIState.CLAW_STARTUP:
				_model.play_strike(&"Melee_Hook", _state_timer)
			AIState.STAGGER:
				_model.play_fitted(&"Hit_Chest", maxf(_state_timer, 0.3))
	if state in [AIState.CLAW_STARTUP, AIState.CLAW_ACTIVE, AIState.RECOVERY, AIState.STAGGER]:
		return
	var speed: float = Vector2(velocity.x, velocity.z).length()
	if speed < 0.2:
		_model.play(&"Zombie_Idle")
	else:
		_model.play(&"Zombie_Walk_Fwd", clampf(speed / 1.4, 0.6, 1.4))


func _build_body() -> void:
	collision_layer = 4
	collision_mask = 1 | 2 | 4 | 64  # + layer 7 Props: set dressing blocks bodies, never rays
	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.32
	cap.height = 1.78
	col.shape = cap
	col.position = Vector3(0.0, 0.89, 0.0)
	add_child(col)

	_visual_root = Node3D.new()
	add_child(_visual_root)
	_model = EnemyModel.new("husk")
	_visual_root.add_child(_model)
	_weapon_arm = Node3D.new()
	_model.right_socket.add_child(_weapon_arm)

	# Fungal lumps on the shoulders and back, faintly glowing: the spores it carries.
	var lump_mat := StandardMaterial3D.new()
	lump_mat.albedo_color = Color(0.70, 0.68, 0.46)
	lump_mat.emission_enabled = true
	lump_mat.emission = Color(0.55, 0.52, 0.22)
	lump_mat.emission_energy_multiplier = 0.5
	lump_mat.roughness = 1.0
	for spot: Vector3 in [Vector3(0.18, 1.42, 0.08), Vector3(-0.2, 1.38, 0.1), Vector3(0.02, 1.25, 0.2), Vector3(0.12, 1.1, 0.18)]:
		var lump := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = 0.07 + 0.03 * absf(spot.x)
		sm.height = sm.radius * 1.6
		lump.mesh = sm
		lump.material_override = lump_mat
		lump.position = spot
		_visual_root.add_child(lump)

	_status_mat = StandardMaterial3D.new()
	_status_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_status_mat.albedo_color = Color(0.46, 0.50, 0.32)
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
	hb_box.size = Vector3(1.0, 1.2, 1.3)
	hb_col.shape = hb_box
	hb_col.position = Vector3(0.0, 1.0, -0.7)
	_hitbox.add_child(hb_col)
	_visual_root.add_child(_hitbox)
	_hitbox.confirmed_hit.connect(_on_claw_landed)

	_hurtbox = HurtboxComponent.new()
	_hurtbox.owner_entity = self
	_hurtbox.collision_layer = 16
	_hurtbox.collision_mask = 0
	var hurt_col := CollisionShape3D.new()
	var hurt_cap := CapsuleShape3D.new()
	hurt_cap.radius = 0.38
	hurt_cap.height = 1.8
	hurt_col.shape = hurt_cap
	hurt_col.position = Vector3(0.0, 0.9, 0.0)
	_hurtbox.add_child(hurt_col)
	add_child(_hurtbox)
	_hurtbox.hit_received.connect(_on_hurtbox_hit_received)
