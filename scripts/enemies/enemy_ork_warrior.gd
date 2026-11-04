class_name EnemyOrkWarrior
extends CharacterBody3D

signal ork_combat_bark(message: String)

## THE SOLDIER. Disciplined, steady pressure at medium power. It advances behind its shield and
## answers button-mashing with a slash-then-chop combo. A survivor who hides behind a raised guard
## gets the shield bash, which knocks the guard aside. The shieldless ork (the yard's "cleaver",
## aggression 0.85) is the reckless one: it runs you down faster, chases its chop further and
## rests less between combos. Flanking and heavy blows still break the shield ork's guard.

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
	RECOIL,
	BASH_STARTUP,
	BASH_ACTIVE,
	DEAD
}

const SLASH_DAMAGE: float = 24.0
const CHOP_DAMAGE: float = 36.0
## The bash hurts little; it is there to break a guard (CombatPayload.breaks_guard).
const BASH_DAMAGE: float = 6.0
const BASH_POISE: float = 30.0
const BASH_STARTUP_TIME: float = 0.36
const BASH_ACTIVE_TIME: float = 0.14
const BASH_RECOVERY: float = 0.7
## Within this range the ork watches for a raised guard.
const BASH_RANGE: float = 2.3

@export var enemy_name: String = "Ork Vanguard"
@export var has_shield: bool = true
@export var max_health: float = 115.0
@export var max_poise: float = 42.0
@export var max_guard_stamina: float = 55.0
@export var patrol_points: Array[Vector3] = []
## Horizontal arc of the opening combo slash, in degrees. If this arc meets a
## wall within reach, the slash clangs off it instead of opening the hitbox.
@export var combo_slash_arc_degrees: float = 110.0
## How far the opening combo slash reaches, in meters, for the wall check.
@export var combo_slash_reach: float = 1.6
## Seconds the Ork is stunned after its slash clangs off a wall. The shield
## guard is down for the whole recoil, so it is an opening for the player.
## Keep it longer than a whiffed opening slash leaves the Ork open
## (0.16 s active + 0.24 s link + 0.78 s recovery = 1.18 s), or clanging
## would be the better outcome for the Ork.
@export var wall_recoil_time: float = 1.25

@export_group("Temperament")
## How hard it presses, 0 to 1. At 0.5 (the shield ork) its timings are the baseline. Higher rests
## less after a combo (recovery x1.3 at 0 down to x0.7 at 1), chases its chop further, runs faster
## without a shield, and loses patience with a raised guard sooner (1.4 s at 0, 0.6 s at 1).
@export_range(0.0, 1.0) var aggression: float = 0.5
## Scales the damage of everything it lands (slash, chop, bash).
@export var attack_power: float = 1.0
@export_group("")

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
## How long the survivor has held a raised guard in front of this ork, within BASH_RANGE.
var _turtle_timer: float = 0.0

var _visual_root: Node3D
var _weapon_arm: Node3D
## The Ashbound body (presentation only) and the state its animation was last chosen for.
var _model: EnemyModel
var _anim_state: int = -1
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

	if player_ref != null and player_ref.current_state == PlayerController.ActionState.DEAD:
		_stand_down()
	_evaluate_senses(delta)
	_watch_for_raised_guard(delta)
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

			if has_shield and _turtle_timer >= turtle_patience() and dist <= BASH_RANGE:
				if _try_begin_bash():
					return
			if dist <= 2.05:
				if _try_begin_combo():
					return
				var tangent := Vector3(-dir_p.z * _strafe_sign, 0.0, dir_p.x * _strafe_sign)
				_face_direction(dir_p, 8.5, delta)
				velocity.x = tangent.x * 1.65 + _knockback_vel.x
				velocity.z = tangent.z * 1.65 + _knockback_vel.z
			else:
				var spd: float = 2.55 if state == AIState.SHIELD_ADVANCE else 3.75
				if not has_shield:
					spd += (aggression - 0.5) * 1.6
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
				if player_ref and global_position.distance_to(player_ref.global_position) <= 2.85 + (aggression - 0.5):
					state = AIState.COMBO_2_STARTUP
					_state_timer = 0.54
				else:
					_finish_attack_sequence(0.78 * recovery_scale())

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
				_finish_attack_sequence(0.98 * recovery_scale())

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

		AIState.BASH_STARTUP:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			_track_player_lightly(6.0, delta)
			if _state_timer <= 0.0:
				_enter_bash_active()

		AIState.BASH_ACTIVE:
			# A short, shoving step behind the shield.
			_state_timer -= delta
			velocity.x = _facing_dir.x * 4.8 + _knockback_vel.x
			velocity.z = _facing_dir.z * 4.8 + _knockback_vel.z
			if _state_timer <= 0.0:
				_hitbox.end_swing()
				_finish_attack_sequence(BASH_RECOVERY * recovery_scale())

		AIState.RECOIL:
			# Wall clang: the shield guard is down but guard stamina is untouched.
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _state_timer <= 0.0:
				state = AIState.SHIELD_ADVANCE if has_shield else AIState.PURSUE

func is_dead() -> bool:
	return state == AIState.DEAD

func is_staggered() -> bool:
	return state in [AIState.STAGGER, AIState.GUARD_BROKEN, AIState.RECOIL]

## Recovery after its attacks, scaled by aggression (x1.0 at 0.5).
func recovery_scale() -> float:
	return lerpf(1.3, 0.7, aggression)

## Seconds of a raised guard in front of it before it bashes.
func turtle_patience() -> float:
	return lerpf(1.4, 0.6, aggression)

func _watch_for_raised_guard(delta: float) -> void:
	if player_ref == null or not has_shield:
		_turtle_timer = 0.0
		return
	var to_me: Vector3 = global_position - player_ref.global_position
	to_me.y = 0.0
	var guarding: bool = (
		player_ref.current_state in [PlayerController.ActionState.BLOCK, PlayerController.ActionState.BLOCK_IMPACT]
		and to_me.length() <= BASH_RANGE + 0.5
		and to_me.length_squared() > 0.0001
		and player_ref.get_aim_direction().dot(to_me.normalized()) > 0.5
	)
	if guarding:
		_turtle_timer += delta
	else:
		_turtle_timer = maxf(0.0, _turtle_timer - delta * 2.0)

## The survivor is dead: drop any attack (closing the hitbox, handing back the turn), forget them
## and go back to patrolling, instead of hacking at the body.
func _stand_down() -> void:
	if state in [AIState.IDLE, AIState.PATROL, AIState.DEAD]:
		return
	_hitbox.end_swing()
	if coordinator:
		coordinator.release_attack_token(self)
	_has_last_known_pos = false
	_turtle_timer = 0.0
	state = AIState.PATROL

func _try_begin_bash() -> bool:
	if coordinator and not coordinator.request_attack_token(self):
		return false
	state = AIState.BASH_STARTUP
	_state_timer = BASH_STARTUP_TIME
	_turtle_timer = 0.0
	return true

func _enter_bash_active() -> void:
	# A shove, not a swing: it never clangs off walls.
	state = AIState.BASH_ACTIVE
	_state_timer = BASH_ACTIVE_TIME
	if audio:
		audio.play_shield_block()
	var payload := CombatPayload.new(self, global_position, _facing_dir,
		BASH_DAMAGE * attack_power, BASH_POISE, false, false, 4.5)
	payload.breaks_guard = true
	_hitbox.begin_swing(payload)

func _try_begin_combo() -> bool:
	if coordinator and not coordinator.request_attack_token(self):
		return false
	state = AIState.COMBO_1_STARTUP
	_state_timer = 0.48
	return true

func _enter_combo_1_active() -> void:
	# The opening slash is a horizontal sweep: in cramped space it clangs.
	var obstruction: Dictionary = WallDeflection.sweep_obstruction(self, _facing_dir, combo_slash_arc_degrees, combo_slash_reach)
	if not obstruction.is_empty():
		_enter_wall_recoil(obstruction)
		return
	state = AIState.COMBO_1_ACTIVE
	_state_timer = 0.16
	if audio:
		audio.play_swing()
	var payload := CombatPayload.new(
		self,
		global_position,
		_facing_dir,
		SLASH_DAMAGE * attack_power,
		24.0,
		false,
		false,
		3.4
	)
	_hitbox.begin_swing(payload)

func _enter_combo_2_active() -> void:
	# The overhead chop is vertical, so it never clangs off walls.
	state = AIState.COMBO_2_ACTIVE
	_state_timer = 0.18
	if audio:
		audio.play_swing()
	var payload := CombatPayload.new(
		self,
		global_position,
		_facing_dir,
		CHOP_DAMAGE * attack_power,
		38.0,
		true,
		true,
		5.2
	)
	_hitbox.begin_swing(payload)

## The opening slash struck stone: no damage, the combo is abandoned and the
## Ork reels back with its guard down for `wall_recoil_time`.
func _enter_wall_recoil(hit: Dictionary) -> void:
	_hitbox.end_swing()
	if coordinator:
		coordinator.release_attack_token(self)
	state = AIState.RECOIL
	_state_timer = wall_recoil_time

	var normal: Vector3 = WallDeflection.recoil_normal(hit, _facing_dir)
	_knockback_vel = normal * 2.0

	if audio:
		audio.play_wall_clang()
	ork_combat_bark.emit("Ork Cleaver Clangs Off the Wall — Punish Opening!")
	WallDeflection.spawn_sparks(get_parent(), hit.get("position", global_position + _facing_dir), normal)

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
		_model.play(&"Death01")
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
			_status_mat.albedo_color = Color(0.45, 0.58, 0.72)
		AIState.COMBO_1_STARTUP:
			_status_mat.albedo_color = Color(0.95, 0.62, 0.15)
		AIState.COMBO_2_STARTUP, AIState.BASH_STARTUP:
			_status_mat.albedo_color = Color(0.98, 0.42, 0.12)
		AIState.COMBO_1_ACTIVE, AIState.COMBO_2_ACTIVE, AIState.BASH_ACTIVE:
			_status_mat.albedo_color = Color(0.92, 0.16, 0.16)
		AIState.ATTACK_RECOVERY, AIState.GUARD_BROKEN, AIState.STAGGER:
			_status_mat.albedo_color = Color(0.42, 0.72, 0.88)
		AIState.RECOIL:
			# Cleaver jarred up and back, shield swung wide: same "punish" blue
			# family as a stagger, a touch brighter so the clang reads.
			_status_mat.albedo_color = Color(0.58, 0.84, 0.96)
		_:
			_status_mat.albedo_color = Color(0.52, 0.36, 0.28)
	_update_model_animation()

## Picks the body's animation from the AI state (the status ring above stays the readable
## telegraph). Each swing's blow lands as its startup timer runs out: a forehand slash for the
## opener, an overhead chop for the follow-up.
func _update_model_animation() -> void:
	if _model == null or state == AIState.DEAD:
		return
	if state != _anim_state:
		_anim_state = state
		match state:
			AIState.COMBO_1_STARTUP:
				_model.play_strike(&"Sword_Regular_A", _state_timer)
			AIState.COMBO_2_STARTUP:
				_model.play_strike(&"Sword_Regular_C", _state_timer)
			AIState.BASH_STARTUP:
				_model.play_strike(&"Shield_Dash", _state_timer)
			AIState.GUARD_BROKEN:
				_model.play_fitted(&"Idle_Shield_Break", maxf(_state_timer, 0.4))
			AIState.STAGGER:
				_model.play_fitted(&"Hit_Knockback", maxf(_state_timer, 0.3))
			AIState.RECOIL:
				_model.play_fitted(&"Hit_Head", maxf(_state_timer, 0.3))
	if state in [AIState.COMBO_1_STARTUP, AIState.COMBO_1_ACTIVE, AIState.COMBO_LINK, AIState.COMBO_2_STARTUP,
			AIState.COMBO_2_ACTIVE, AIState.ATTACK_RECOVERY, AIState.GUARD_BROKEN, AIState.STAGGER, AIState.RECOIL,
			AIState.BASH_STARTUP, AIState.BASH_ACTIVE]:
		return
	var speed: float = Vector2(velocity.x, velocity.z).length()
	if state == AIState.SHIELD_ADVANCE and has_shield:
		_model.play(&"Idle_Shield")
	elif speed < 0.2:
		_model.play(&"Sword_Idle")
	elif state in [AIState.PATROL, AIState.INVESTIGATE]:
		_model.play(&"Walk", clampf(speed / 1.6, 0.6, 1.6))
	else:
		_model.play(&"Jog_Fwd", clampf(speed / 3.8, 0.6, 1.6))

func _build_ork_visuals_and_colliders() -> void:
	collision_layer = 4
	collision_mask = 1 | 2 | 4 | 64  # + layer 7 Props: set dressing blocks bodies, never rays

	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.42
	cap.height = 1.92
	col.shape = cap
	col.position = Vector3(0.0, 0.96, 0.0)
	add_child(col)

	_visual_root = Node3D.new()
	add_child(_visual_root)

	var armor_mat := StandardMaterial3D.new()
	armor_mat.albedo_color = Color(0.27, 0.23, 0.21)
	armor_mat.metallic = 0.48
	armor_mat.roughness = 0.72

	_model = EnemyModel.new("ork")
	_visual_root.add_child(_model)
	if has_shield:
		# A tall board shield strapped over the left fist; its thin side faces out of the hand.
		_shield_mesh = MeshInstance3D.new()
		var s_box := BoxMesh.new()
		s_box.size = Vector3(0.66, 0.08, 0.82)
		_shield_mesh.mesh = s_box
		_shield_mesh.material_override = armor_mat
		_model.shield_mount.add_child(_shield_mesh)

	_weapon_arm = Node3D.new()
	_model.right_socket.add_child(_weapon_arm)

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
