class_name EnemyUnnamed
extends CharacterBody3D
## THE UNNAMED. The Keeping teaches that the world is held apart from the dark by obligations kept,
## and one of them is that the dead are named: you speak a corpse's name into its mouth before it
## goes into the ground (docs: keeping-and-merewick.md). In the Smothering nobody had time. The
## dead of the drowned burial ground in the yard's south-east corner were put down unnamed, and
## they get up.
##
## Cut one down and it falls, and after RISE_SECONDS it rises again, whole. It stays down for good
## only when someone kneels at its grave (each has one, a worn stone with an [E] "Speak a name"
## prompt) and speaks its name: an ActionPoint channel of NAME_SECONDS, which a blow cancels like any
## other. Knock it down, then run for the stone; or creep to the stone unseen and name it where it
## stands. Grabbing hands, not weapons; slow, but it never tires of you.

signal unnamed_event_banner(text: String, col: Color)

enum AIState { IDLE, SHAMBLE, GRAB_STARTUP, GRAB_ACTIVE, RECOVERY, STAGGER, FALLEN, RISING, RETURN_HOME, AT_REST }

const SIGHT_RANGE: float = 10.0
const SIGHT_HALF_ANGLE: float = 65.0
const HEARING_SPRINT: float = 10.0
const MEMORY_SECONDS: float = 6.0
const SHAMBLE_SPEED: float = 2.6
const GRAB_RANGE: float = 1.5
const GRAB_DAMAGE: float = 14.0
const GRAB_POISE: float = 20.0
const GRAB_STARTUP: float = 0.6
const GRAB_ACTIVE_TIME: float = 0.18
const GRAB_RECOVERY: float = 0.8
const STAGGER_TIME: float = 0.55
## Seconds a fallen Unnamed lies before it gets up again.
const RISE_SECONDS: float = 12.0
const RISE_ANIM_SECONDS: float = 1.5
## Seconds kneeling at the grave to speak the name.
const NAME_SECONDS: float = 2.5
## It wanders no further than this from its grave before it turns back.
const GRAVE_LEASH: float = 14.0

@export var enemy_name: String = "Unnamed"
@export var max_health: float = 45.0
@export var max_poise: float = 30.0

@export_group("Temperament")
## How doggedly it follows, 0 to 1: how long it remembers you (4 s at 0, 9 s at 1) and how far it
## strays from its grave (10 m at 0, 18 m at 1; 14 at the default).
@export_range(0.0, 1.0) var aggression: float = 0.5
## Scales the damage of its grab.
@export var attack_power: float = 1.0
@export_group("")

var health: float = 45.0
var poise_damage: float = 0.0
var state: AIState = AIState.IDLE
var player_ref: PlayerController
var audio: ProceduralAudio
var coordinator: EncounterCoordinator
## Its grave: an ActionPoint the bootstrap places and hands it (see `bind_grave`).
var grave: ActionPoint
var times_risen: int = 0

var _home_pos: Vector3 = Vector3.ZERO
var _last_known: Vector3 = Vector3.ZERO
var _memory: float = 0.0
var _state_timer: float = 0.0
var _facing_dir: Vector3 = Vector3.FORWARD
var _knockback_vel: Vector3 = Vector3.ZERO
var _first_rise_told: bool = false

var _visual_root: Node3D
var _model: EnemyModel
## Its grasping right hand (every enemy keeps a weapon arm in its right socket).
var _weapon_arm: Node3D
var _anim_state: int = -1
var _status_mat: StandardMaterial3D
var _hitbox: HitboxComponent
var _hurtbox: HurtboxComponent


func _ready() -> void:
	health = max_health
	_home_pos = global_position
	_build_body()


## Ties this Unnamed to its grave: naming at the grave lays it to rest.
func bind_grave(p_grave: ActionPoint) -> void:
	grave = p_grave
	grave.action = _on_named


func _physics_process(delta: float) -> void:
	_update_visibility()
	if state == AIState.AT_REST:
		return
	_knockback_vel = _knockback_vel.move_toward(Vector3.ZERO, 14.0 * delta)
	if poise_damage > 0.0:
		poise_damage = maxf(0.0, poise_damage - 6.0 * delta)
	if player_ref != null and player_ref.current_state == PlayerController.ActionState.DEAD:
		_stand_down()
	elif state not in [AIState.FALLEN, AIState.RISING]:
		_sense(delta)
	_process_ai_state(delta)
	_report_noises(delta)
	_update_visual_telegraph()
	if not is_on_floor():
		velocity.y -= 24.0 * delta
	else:
		velocity.y = -0.1
	move_and_slide()


## Down (it will rise) or laid to rest (it won't): either way, nothing to fight or target now.
func is_dead() -> bool:
	return state in [AIState.FALLEN, AIState.RISING, AIState.AT_REST]


func is_at_rest() -> bool:
	return state == AIState.AT_REST


func is_staggered() -> bool:
	return state in [AIState.STAGGER, AIState.RECOVERY]


func memory_seconds() -> float:
	return lerpf(4.0, 9.0, aggression)


func grave_leash() -> float:
	return lerpf(10.0, 18.0, aggression)


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
		if state in [AIState.IDLE, AIState.RETURN_HOME]:
			state = AIState.SHAMBLE


func _process_ai_state(delta: float) -> void:
	match state:
		AIState.IDLE:
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z

		AIState.RETURN_HOME:
			var to_home: Vector3 = _home_pos - global_position
			to_home.y = 0.0
			if to_home.length() < 0.6:
				state = AIState.IDLE
				return
			_face_toward(_home_pos, 4.0, delta)
			velocity.x = to_home.normalized().x * SHAMBLE_SPEED * 0.7 + _knockback_vel.x
			velocity.z = to_home.normalized().z * SHAMBLE_SPEED * 0.7 + _knockback_vel.z

		AIState.SHAMBLE:
			if _memory <= 0.0 or global_position.distance_to(_home_pos) > grave_leash():
				state = AIState.RETURN_HOME
				return
			var target: Vector3 = player_ref.global_position if player_ref != null and sees_player() else _last_known
			if player_ref != null and global_position.distance_to(player_ref.global_position) <= GRAB_RANGE:
				if _try_begin_grab():
					return
			var to_t: Vector3 = target - global_position
			to_t.y = 0.0
			if to_t.length() < 0.5:
				velocity.x = _knockback_vel.x
				velocity.z = _knockback_vel.z
				return
			_face_toward(target, 5.0, delta)
			velocity.x = to_t.normalized().x * SHAMBLE_SPEED + _knockback_vel.x
			velocity.z = to_t.normalized().z * SHAMBLE_SPEED + _knockback_vel.z

		AIState.GRAB_STARTUP:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if player_ref != null:
				_face_toward(player_ref.global_position, 5.0, delta)
			if _state_timer <= 0.0:
				_enter_grab_active()

		AIState.GRAB_ACTIVE:
			_state_timer -= delta
			velocity.x = _facing_dir.x * 2.5 + _knockback_vel.x
			velocity.z = _facing_dir.z * 2.5 + _knockback_vel.z
			if _state_timer <= 0.0:
				_hitbox.end_swing()
				_release_token()
				state = AIState.RECOVERY
				_state_timer = GRAB_RECOVERY

		AIState.RECOVERY, AIState.STAGGER:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _state_timer <= 0.0:
				state = AIState.SHAMBLE if _memory > 0.0 else AIState.RETURN_HOME

		AIState.FALLEN:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _state_timer <= 0.0:
				_begin_rise()

		AIState.RISING:
			_state_timer -= delta
			velocity.x = 0.0
			velocity.z = 0.0
			if _state_timer <= 0.0:
				collision_layer = 4
				_hurtbox.set_deferred("monitorable", true)
				state = AIState.SHAMBLE if _memory > 0.0 else AIState.IDLE


func _try_begin_grab() -> bool:
	if coordinator and not coordinator.request_attack_token(self):
		return false
	state = AIState.GRAB_STARTUP
	_state_timer = GRAB_STARTUP
	_noise(8.0)
	return true


func _enter_grab_active() -> void:
	state = AIState.GRAB_ACTIVE
	_state_timer = GRAB_ACTIVE_TIME
	if audio:
		audio.play_swing()
	_hitbox.begin_swing(CombatPayload.new(self, global_position, _facing_dir, GRAB_DAMAGE * attack_power, GRAB_POISE, false, false, 1.8))


func _release_token() -> void:
	if coordinator:
		coordinator.release_attack_token(self)


## The survivor is dead: drop the grab, forget them, and drift back to its grave.
func _stand_down() -> void:
	if state in [AIState.IDLE, AIState.RETURN_HOME, AIState.FALLEN, AIState.RISING, AIState.AT_REST]:
		return
	_hitbox.end_swing()
	_release_token()
	_memory = 0.0
	state = AIState.RETURN_HOME


func _face_toward(point: Vector3, turn_speed: float, delta: float) -> void:
	var dir: Vector3 = point - global_position
	dir.y = 0.0
	if dir.length_squared() < 0.0001:
		return
	_facing_dir = _facing_dir.slerp(dir.normalized(), 1.0 - exp(-turn_speed * delta)).normalized()
	_visual_root.look_at(global_position + _facing_dir, Vector3.UP)


func _on_hurtbox_hit_received(payload: CombatPayload) -> void:
	if is_dead():
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
		_fall()
		return
	if state in [AIState.IDLE, AIState.RETURN_HOME]:
		state = AIState.SHAMBLE
	if poise_damage >= max_poise or payload.is_heavy:
		poise_damage = 0.0
		_hitbox.end_swing()
		_release_token()
		state = AIState.STAGGER
		_state_timer = STAGGER_TIME


## Cut down: it lies still, walkable over and unhittable, until it rises or is named.
func _fall() -> void:
	_hitbox.end_swing()
	_release_token()
	state = AIState.FALLEN
	_state_timer = RISE_SECONDS
	collision_layer = 0
	_hurtbox.set_deferred("monitorable", false)
	_model.play(&"Death01")
	_anim_state = AIState.FALLEN


func _begin_rise() -> void:
	state = AIState.RISING
	_state_timer = RISE_ANIM_SECONDS
	health = max_health
	poise_damage = 0.0
	times_risen += 1
	_model.play_fitted(&"LayToIdle", RISE_ANIM_SECONDS)
	_anim_state = AIState.RISING
	_noise(10.0)
	if not _first_rise_told:
		_first_rise_told = true
		unnamed_event_banner.emit("It gets up again. The dead here were never named: find its grave and speak the name.", Color(0.66, 0.74, 0.80))


## Its name spoken at its grave: it lies down for good, wherever it is.
func _on_named(by: Node3D) -> void:
	if state == AIState.AT_REST:
		return
	_hitbox.end_swing()
	_release_token()
	state = AIState.AT_REST
	collision_layer = 0
	_hurtbox.set_deferred("monitorable", false)
	if _anim_state != AIState.FALLEN:
		_model.play(&"Death01")
	_anim_state = AIState.AT_REST
	_status_mat.albedo_color = Color(0.20, 0.22, 0.24)
	if is_instance_valid(grave):
		grave.queue_free()
	grave = null
	Lootable.attach_corpse(self, "%s, at rest" % enemy_name, ItemDatabase.roll_unnamed_loot(), 2.0)
	var p := by as PlayerController
	if p != null:
		p.combat_banner_message.emit("You speak the name. It lies down and does not get up.", Color(0.75, 0.82, 0.68))


## Drawn only while the survivor can see it (their vision cone, cut by walls: Perception).
func _update_visibility() -> void:
	if player_ref == null or player_ref.perception == null:
		return
	player_ref.perception.update_visibility(self, _visual_root, 1.5, not is_dead())


## What the survivor may hear of it: a wet, dragging step and a rattle as it reaches.
func _report_noises(delta: float) -> void:
	if player_ref == null or player_ref.perception == null:
		return
	var speed: float = Vector2(velocity.x, velocity.z).length()
	player_ref.perception.report_footsteps(self, delta, speed, 1.1, 6.0)


func _noise(loudness: float) -> void:
	if player_ref != null and player_ref.perception != null:
		player_ref.perception.report_noise(global_position, loudness, self)


func _update_visual_telegraph() -> void:
	match state:
		AIState.GRAB_STARTUP:
			_status_mat.albedo_color = Color(0.95, 0.65, 0.15)
		AIState.GRAB_ACTIVE:
			_status_mat.albedo_color = Color(0.92, 0.18, 0.15)
		AIState.RECOVERY, AIState.STAGGER:
			_status_mat.albedo_color = Color(0.42, 0.68, 0.85)
		AIState.FALLEN, AIState.RISING:
			# Pale, cold: down but not done.
			_status_mat.albedo_color = Color(0.62, 0.74, 0.84)
		AIState.AT_REST:
			_status_mat.albedo_color = Color(0.20, 0.22, 0.24)
		_:
			_status_mat.albedo_color = Color(0.40, 0.48, 0.54)
	if _model == null or state in [AIState.FALLEN, AIState.RISING, AIState.AT_REST]:
		return
	if state != _anim_state:
		_anim_state = state
		match state:
			AIState.GRAB_STARTUP:
				_model.play_strike(&"Punch_Cross", _state_timer)
			AIState.STAGGER:
				_model.play_fitted(&"Hit_Chest", maxf(_state_timer, 0.3))
	if state in [AIState.GRAB_STARTUP, AIState.GRAB_ACTIVE, AIState.RECOVERY, AIState.STAGGER]:
		return
	var speed: float = Vector2(velocity.x, velocity.z).length()
	if speed < 0.2:
		_model.play(&"Zombie_Idle")
	else:
		_model.play(&"Zombie_Walk_Fwd", clampf(speed / 1.6, 0.6, 1.6))


func _build_body() -> void:
	collision_layer = 4
	collision_mask = 1 | 2 | 4 | 64  # + layer 7 Props: set dressing blocks bodies, never rays
	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.32
	cap.height = 1.76
	col.shape = cap
	col.position = Vector3(0.0, 0.88, 0.0)
	add_child(col)

	_visual_root = Node3D.new()
	add_child(_visual_root)
	_model = EnemyModel.new("unnamed")
	_visual_root.add_child(_model)
	_weapon_arm = Node3D.new()
	_model.right_socket.add_child(_weapon_arm)

	_status_mat = StandardMaterial3D.new()
	_status_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_status_mat.albedo_color = Color(0.40, 0.48, 0.54)
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
