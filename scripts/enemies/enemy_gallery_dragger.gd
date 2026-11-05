class_name EnemyGalleryDragger
extends CharacterBody3D
## THE GALLERY DRAGGER. The Bell Road's Roofed Mile is an old avalanche gallery "with carcasses
## dragged between its supports" (docs: blackfen-roads-and-towns.md), and something lives there that
## nobody has named (roofed-mile-third-arch.md; the worldbuilding calls it unidentified, so this is a
## proposal). Its forelegs are too heavy for the rest of it; it waits up where the roof met the hillside.
##
## It drops on whoever passes beneath its ledge (a ring marks where it will land: step back out of
## it). On the ground it does not rush: with stone between you it moves sideways until there is
## none, then lunges and bites. A bite caught on a shield becomes a worry: it clamps on and shakes,
## each second of holding the guard costs stamina, and an empty survivor loses the shield to it. Its
## head is pinned there, though: strike it while it worries and the blow lands hard and breaks its
## grip. A lit torch held toward it keeps it off; it circles for a way round the flame. It turns to
## a sound it cannot see. When it has lost you it goes home and climbs back to its ledge.

signal dragger_event_banner(text: String, col: Color)
signal dragger_landing_shock(trauma: float)

enum AIState { IDLE, PERCHED, TELL, LEAP, RECOVERY, STALK, WARY, LUNGE_STARTUP, LUNGE_ACTIVE, WORRY, STAGGER, RETURN_HOME, CLIMB, DEAD }

const SIGHT_RANGE: float = 9.0
const SIGHT_HALF_ANGLE: float = 70.0
## It hears the survivor by the troll's table (EnemyQuarryTroll.HEARING), at this share of the reach.
const HEARING_MULT: float = 0.8
const WALL_MUFFLE: float = 0.55
const MEMORY_SECONDS: float = 7.0
## How far from the foot of its ledge it follows before it gives up and goes home.
const LAIR_LEASH: float = 16.0

## Ambush: someone within this (flat) distance of it on its ledge brings it down.
const DROP_TRIGGER: float = 3.6
const DROP_TELL: float = 0.7
const DROP_FLIGHT: float = 0.4
const DROP_RADIUS: float = 1.3
const DROP_DAMAGE: float = 26.0
const DROP_POISE: float = 45.0
const DROP_RECOVERY: float = 1.1
## How long the landing's hitbox stays open.
const DROP_ACTIVE: float = 0.12

const STALK_SPEED: float = 2.2
const SIDLE_SPEED: float = 2.8
## With stone between them, it sidles only when the survivor is this close; further off it closes in.
const SIDLE_RANGE: float = 7.0

const LUNGE_RANGE: float = 3.6
const LUNGE_STARTUP: float = 0.5
const LUNGE_ACTIVE: float = 0.26
const LUNGE_SPEED: float = 8.5
const LUNGE_RECOVERY: float = 0.85
const BITE_DAMAGE: float = 20.0
const BITE_POISE: float = 22.0

## A bite caught on a shield: it hangs on this long, and the guard costs this much stamina a second.
const WORRY_SECONDS: float = 1.6
const WORRY_STAMINA_PER_SECOND: float = 40.0
## A blow on it while it worries lands this much harder, and breaks its grip.
const WORRY_EXPOSED_MULT: float = 1.5
## Where a wrenched shield lands: this far off, past the beast.
const WRENCH_THROW: float = 2.4

## A lit torch held toward it (aim within about 70 degrees) inside this range keeps it off. Longer
## than its lunge, so it cannot lunge from where the flame holds it.
const TORCH_FEAR_RANGE: float = 4.2
## Where it holds while kept off: inside the flame's reach, outside its own lunge.
const WARY_DISTANCE: float = 3.8
const TORCH_FACING_COS: float = 0.35
const WARY_CIRCLE_SPEED: float = 3.2

const STAGGER_TIME: float = 0.7
const CLIMB_SECONDS: float = 1.4
## The foot of its ledge: this far out from the wall into the passage.
const FOOT_OUT: float = 1.4

@export var enemy_name: String = "Gallery Dragger"
@export var max_health: float = 70.0
@export var max_poise: float = 40.0

@export_group("Temperament")
## How bold it is, 0 to 1: how long it keeps after a survivor it has lost (5 s at 0, 9 s at 1) and
## how long it lets a lunge recover (x1.2 at 0, x0.8 at 1; the constants at 0.5).
@export_range(0.0, 1.0) var aggression: float = 0.5
## Scales the damage of its drop and its bite.
@export var attack_power: float = 1.0
@export_group("")

var health: float = 70.0
var poise_damage: float = 0.0
var state: AIState = AIState.IDLE
var player_ref: PlayerController
var audio: ProceduralAudio
var coordinator: EncounterCoordinator
## Its ledge: where it waits, and which way is out into the passage. Unset, it lives on the ground.
var perch_pos: Vector3 = Vector3.ZERO
var perch_out: Vector3 = Vector3.ZERO
var has_perch: bool = false

var _home_pos: Vector3 = Vector3.ZERO
var _last_known: Vector3 = Vector3.ZERO
var _memory: float = 0.0
var _state_timer: float = 0.0
var _facing_dir: Vector3 = Vector3.FORWARD
var _knockback_vel: Vector3 = Vector3.ZERO
var _sidle_sign: float = 1.0
var _drop_from: Vector3 = Vector3.ZERO
var _drop_target: Vector3 = Vector3.ZERO
var _landing_timer: float = 0.0
var _climb_from: Vector3 = Vector3.ZERO
var _worry_victim: PlayerController
var _told_drop: bool = false
var _told_torch: bool = false
var _told_worry: bool = false

var _visual_root: Node3D
var _model: EnemyModel
## Its jaw (every enemy keeps a weapon arm in its right socket).
var _weapon_arm: Node3D
var _anim_state: int = -1
var _status_mat: StandardMaterial3D
var _bite_hitbox: HitboxComponent
var _drop_hitbox: HitboxComponent
var _drop_ring: MeshInstance3D
var _hurtbox: HurtboxComponent


func _ready() -> void:
	health = max_health
	_build_body()
	if has_perch:
		_perch_now()
	else:
		_home_pos = global_position


## Gives it a ledge to wait on (a point on top of a wall) and the way out into the passage below.
## Call before adding it to the tree, or after: it goes up there at once.
func set_perch(pos: Vector3, out_dir: Vector3) -> void:
	perch_pos = pos
	perch_out = Vector3(out_dir.x, 0.0, out_dir.z).normalized()
	has_perch = true
	if is_inside_tree() and _visual_root != null:
		_perch_now()


func _perch_now() -> void:
	global_position = perch_pos
	_home_pos = foot_pos()
	_facing_dir = perch_out
	_visual_root.look_at(global_position + _facing_dir, Vector3.UP)
	state = AIState.PERCHED
	velocity = Vector3.ZERO


## The ground below its ledge, out in the passage: where it walks home to before it climbs.
func foot_pos() -> Vector3:
	var f: Vector3 = perch_pos + perch_out * FOOT_OUT
	return Vector3(f.x, 0.0, f.z)


func _physics_process(delta: float) -> void:
	_update_visibility()
	if state == AIState.DEAD:
		return
	_knockback_vel = _knockback_vel.move_toward(Vector3.ZERO, 14.0 * delta)
	if poise_damage > 0.0:
		poise_damage = maxf(0.0, poise_damage - 6.0 * delta)
	if _landing_timer > 0.0:
		_landing_timer -= delta
		if _landing_timer <= 0.0:
			_drop_hitbox.end_swing()
	if player_ref != null and player_ref.current_state == PlayerController.ActionState.DEAD:
		_stand_down()
	elif state not in [AIState.LEAP, AIState.CLIMB]:
		_sense(delta)
	_process_ai_state(delta)
	_report_noises(delta)
	_update_visual_telegraph()
	if state in [AIState.PERCHED, AIState.TELL, AIState.LEAP, AIState.CLIMB]:
		return
	if not is_on_floor():
		velocity.y -= 24.0 * delta
	else:
		velocity.y = -0.1
	move_and_slide()


func is_dead() -> bool:
	return state == AIState.DEAD


func is_staggered() -> bool:
	return state in [AIState.STAGGER, AIState.RECOVERY]


func is_perched() -> bool:
	return state in [AIState.PERCHED, AIState.TELL]


func memory_seconds() -> float:
	return lerpf(5.0, 9.0, aggression)


func lunge_recovery() -> float:
	return LUNGE_RECOVERY * lerpf(1.2, 0.8, aggression)


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
	return _ray_clear(global_position + Vector3(0.0, 1.1, 0.0), player_ref.global_position + Vector3(0.0, 1.1, 0.0))


## True when no stone (layer 1) stands between it and the survivor at chest height: a lunge's lane.
func line_clear_to_player() -> bool:
	if player_ref == null:
		return false
	return _ray_clear(global_position + Vector3(0.0, 0.9, 0.0), player_ref.global_position + Vector3(0.0, 0.9, 0.0))


func _ray_clear(from: Vector3, to: Vector3) -> bool:
	var q := PhysicsRayQueryParameters3D.create(from, to, 1)
	return get_world_3d().direct_space_state.intersect_ray(q).is_empty()


## How far the survivor's noise reaches it now (0 when silent), muffled through stone.
func hears_player_at() -> float:
	if player_ref == null:
		return 0.0
	var reach: float = EnemyQuarryTroll.survivor_noise_radius(player_ref) * HEARING_MULT
	if reach > 0.0 and not _ray_clear(global_position + Vector3(0.0, 1.0, 0.0), player_ref.global_position + Vector3(0.0, 1.0, 0.0)):
		reach *= WALL_MUFFLE
	return reach


## The survivor holds a lit torch toward it, close: it will not come in.
func torch_keeps_it_off() -> bool:
	if player_ref == null or not player_ref.is_torch_lit():
		return false
	var to_me: Vector3 = global_position - player_ref.global_position
	to_me.y = 0.0
	if to_me.length() > TORCH_FEAR_RANGE:
		return false
	return to_me.length() < 0.3 or player_ref.get_aim_direction().dot(to_me.normalized()) >= TORCH_FACING_COS


func _sense(delta: float) -> void:
	_memory = maxf(0.0, _memory - delta)
	if player_ref == null:
		return
	var flat: Vector3 = player_ref.global_position - global_position
	flat.y = 0.0
	if state == AIState.PERCHED:
		# An ambusher: whatever it sees or hears, it waits until someone comes beneath it.
		# It looks down over the lip of its ledge, not through the stone it crouches on.
		var lip: Vector3 = global_position + perch_out * 0.7 + Vector3(0.0, 1.0, 0.0)
		if flat.length() <= DROP_TRIGGER and _ray_clear(lip, player_ref.global_position + Vector3(0.0, 1.0, 0.0)):
			_begin_tell()
		return
	var seen: bool = sees_player()
	var heard: bool = flat.length() <= hears_player_at()
	if seen or heard:
		_last_known = player_ref.global_position
		_memory = memory_seconds()
		if not seen and state in [AIState.IDLE, AIState.RETURN_HOME, AIState.STALK]:
			# A sound it cannot see: it turns its head to it before its body.
			_face_toward(_last_known, 9.0, delta)
		if state in [AIState.IDLE, AIState.RETURN_HOME]:
			state = AIState.STALK


func _process_ai_state(delta: float) -> void:
	match state:
		AIState.IDLE, AIState.PERCHED:
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z

		AIState.TELL:
			_state_timer -= delta
			if _state_timer <= 0.0:
				state = AIState.LEAP
				_state_timer = DROP_FLIGHT
				_drop_from = global_position
				_noise(8.0)

		AIState.LEAP:
			_state_timer -= delta
			var t: float = clampf(1.0 - _state_timer / DROP_FLIGHT, 0.0, 1.0)
			var p: Vector3 = _drop_from.lerp(_drop_target, t)
			p.y = lerpf(_drop_from.y, _drop_target.y, t * t) + sin(t * PI) * 0.8
			global_position = p
			if _state_timer <= 0.0:
				_land()

		AIState.STALK:
			_stalk(delta)

		AIState.WARY:
			_wary(delta)

		AIState.LUNGE_STARTUP:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if player_ref != null:
				_face_toward(player_ref.global_position, 10.0, delta)
			if _state_timer <= 0.0:
				_enter_lunge_active()

		AIState.LUNGE_ACTIVE:
			_state_timer -= delta
			velocity.x = _facing_dir.x * LUNGE_SPEED + _knockback_vel.x
			velocity.z = _facing_dir.z * LUNGE_SPEED + _knockback_vel.z
			if _state_timer <= 0.0 or _struck_wall():
				_bite_hitbox.end_swing()
				_release_token()
				state = AIState.RECOVERY
				_state_timer = lunge_recovery()

		AIState.WORRY:
			_worry(delta)

		AIState.RECOVERY, AIState.STAGGER:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _state_timer <= 0.0:
				state = AIState.STALK if _memory > 0.0 else AIState.RETURN_HOME

		AIState.RETURN_HOME:
			var to_home: Vector3 = _home_pos - global_position
			to_home.y = 0.0
			if to_home.length() < 0.5:
				if has_perch:
					_begin_climb()
				else:
					state = AIState.IDLE
				return
			_face_toward(_home_pos, 5.0, delta)
			velocity.x = to_home.normalized().x * STALK_SPEED + _knockback_vel.x
			velocity.z = to_home.normalized().z * STALK_SPEED + _knockback_vel.z

		AIState.CLIMB:
			_state_timer -= delta
			var ct: float = clampf(1.0 - _state_timer / CLIMB_SECONDS, 0.0, 1.0)
			# Up the face first, then over the lip.
			var up: float = clampf(ct / 0.7, 0.0, 1.0)
			var across: float = clampf((ct - 0.6) / 0.4, 0.0, 1.0)
			global_position = Vector3(lerpf(_climb_from.x, perch_pos.x, across), lerpf(_climb_from.y, perch_pos.y, up),
				lerpf(_climb_from.z, perch_pos.z, across))
			if _state_timer <= 0.0:
				_perch_now()


## Closing in without rushing; with stone between them it moves sideways until there is none.
func _stalk(delta: float) -> void:
	if _memory <= 0.0 or global_position.distance_to(_home_pos) > LAIR_LEASH:
		state = AIState.RETURN_HOME
		return
	if player_ref != null and torch_keeps_it_off():
		state = AIState.WARY
		if not _told_torch:
			_told_torch = true
			dragger_event_banner.emit("It will not come at the flame. It circles, looking for a way round it.", Color(0.92, 0.66, 0.32))
		return
	var seen: bool = sees_player()
	var target: Vector3 = player_ref.global_position if player_ref != null and seen else _last_known
	var to_t: Vector3 = target - global_position
	to_t.y = 0.0
	var dist: float = to_t.length()
	if player_ref != null and seen and dist <= LUNGE_RANGE and line_clear_to_player():
		if _try_begin_lunge():
			return
	if dist < 0.5:
		velocity.x = _knockback_vel.x
		velocity.z = _knockback_vel.z
		return
	var toward: Vector3 = to_t / dist
	_face_toward(target, 6.0, delta)
	if player_ref != null and dist <= SIDLE_RANGE and not line_clear_to_player():
		var side := Vector3(-toward.z, 0.0, toward.x)
		# Keep its side unless the other one clears the line and this one does not.
		var here_clear: bool = _ray_clear(global_position + side * _sidle_sign * 1.5 + Vector3(0.0, 0.9, 0.0), player_ref.global_position + Vector3(0.0, 0.9, 0.0))
		var there_clear: bool = _ray_clear(global_position - side * _sidle_sign * 1.5 + Vector3(0.0, 0.9, 0.0), player_ref.global_position + Vector3(0.0, 0.9, 0.0))
		if there_clear and not here_clear:
			_sidle_sign = -_sidle_sign
		var move: Vector3 = (side * _sidle_sign + toward * 0.25).normalized() * SIDLE_SPEED
		velocity.x = move.x + _knockback_vel.x
		velocity.z = move.z + _knockback_vel.z
		return
	velocity.x = toward.x * STALK_SPEED + _knockback_vel.x
	velocity.z = toward.z * STALK_SPEED + _knockback_vel.z


## Kept off by a torch: it holds just outside the flame's reach and circles for the survivor's back.
func _wary(delta: float) -> void:
	if player_ref == null or not torch_keeps_it_off():
		state = AIState.STALK
		return
	_memory = memory_seconds()
	_last_known = player_ref.global_position
	var from_p: Vector3 = global_position - player_ref.global_position
	from_p.y = 0.0
	var dist: float = maxf(from_p.length(), 0.01)
	var out: Vector3 = from_p / dist
	var around := Vector3(-out.z, 0.0, out.x) * _sidle_sign
	var radial: float = clampf((WARY_DISTANCE - dist) * 3.0, -1.5, 3.0)
	var move: Vector3 = around * WARY_CIRCLE_SPEED + out * radial
	velocity.x = move.x + _knockback_vel.x
	velocity.z = move.z + _knockback_vel.z
	_face_toward(player_ref.global_position, 8.0, delta)


func _begin_tell() -> void:
	if player_ref == null:
		return
	if coordinator:
		coordinator.request_attack_token(self, true)
	state = AIState.TELL
	_state_timer = DROP_TELL
	_drop_target = Vector3(player_ref.global_position.x, 0.0, player_ref.global_position.z)
	_drop_ring.global_position = _drop_target + Vector3(0.0, 0.05, 0.0)
	_drop_ring.visible = true
	_last_known = player_ref.global_position
	_memory = memory_seconds()
	# Claws on stone overhead: a pale shape shifts.
	_noise(5.0)


func _land() -> void:
	global_position = _drop_target
	_drop_ring.visible = false
	var to_p: Vector3 = (player_ref.global_position - _drop_target) if player_ref != null else perch_out
	to_p.y = 0.0
	if to_p.length_squared() > 0.01:
		_facing_dir = to_p.normalized()
		_visual_root.look_at(global_position + _facing_dir, Vector3.UP)
	_drop_hitbox.global_position = _drop_target + Vector3(0.0, 0.9, 0.0)
	_drop_hitbox.begin_swing(CombatPayload.new(self, _drop_target, _facing_dir, DROP_DAMAGE * attack_power, DROP_POISE, false, true, 5.0))
	_landing_timer = DROP_ACTIVE
	_release_token()
	state = AIState.RECOVERY
	_state_timer = DROP_RECOVERY
	if audio:
		audio.play_ogre_ground_slam()
	dragger_landing_shock.emit(0.45)
	_noise(14.0)
	if not _told_drop:
		_told_drop = true
		dragger_event_banner.emit("It came down off the wall. Watch the ledges in the gallery.", Color(0.86, 0.80, 0.68))


## True when the last move ran it into stone (a wall, a pier, a cart), not just along the floor.
func _struck_wall() -> bool:
	for i: int in range(get_slide_collision_count()):
		var c: KinematicCollision3D = get_slide_collision(i)
		if c.get_normal().y < 0.5 and c.get_collider() is StaticBody3D:
			return true
	return false


func _try_begin_lunge() -> bool:
	if coordinator and not coordinator.request_attack_token(self):
		return false
	state = AIState.LUNGE_STARTUP
	_state_timer = LUNGE_STARTUP
	_noise(6.0)
	return true


func _enter_lunge_active() -> void:
	state = AIState.LUNGE_ACTIVE
	_state_timer = LUNGE_ACTIVE
	if audio:
		audio.play_swing()
	_noise(9.0)
	_bite_hitbox.begin_swing(CombatPayload.new(self, global_position, _facing_dir, BITE_DAMAGE * attack_power, BITE_POISE, true, false, 2.0))


## Its bite landed on someone. Caught on a raised shield, it clamps on instead of letting go.
func _on_bite_landed(target: Node3D, _payload: CombatPayload) -> void:
	var p := target as PlayerController
	if p == null or state != AIState.LUNGE_ACTIVE:
		return
	if p.current_state == PlayerController.ActionState.BLOCK_IMPACT and p.has_ready_shield():
		_begin_worry(p)


func _begin_worry(p: PlayerController) -> void:
	# Called from the hitbox's own signal: it cannot stop monitoring until the callback is over.
	_bite_hitbox.call_deferred("end_swing")
	_worry_victim = p
	state = AIState.WORRY
	_state_timer = WORRY_SECONDS
	velocity = Vector3.ZERO
	_noise(10.0)
	if not _told_worry:
		_told_worry = true
		dragger_event_banner.emit("It has your shield in its teeth. Hold on and it shakes you empty; strike it and it lets go.", Color(0.92, 0.58, 0.28))


## Clamped on the shield, shaking. A held guard pays stamina; an empty survivor loses the shield.
## A survivor who lets the guard drop (to move or dodge) shakes it off; one who strikes back is
## answered in `_on_hurtbox_hit_received`.
func _worry(delta: float) -> void:
	_state_timer -= delta
	velocity.x = 0.0
	velocity.z = 0.0
	var p: PlayerController = _worry_victim
	if p == null or not is_instance_valid(p):
		_let_go(0.5)
		return
	_face_toward(p.global_position, 10.0, delta)
	var holding: bool = p.current_state in [PlayerController.ActionState.BLOCK, PlayerController.ActionState.BLOCK_IMPACT] and p.has_ready_shield()
	var striking: bool = p.current_state in [PlayerController.ActionState.ATTACK_STARTUP, PlayerController.ActionState.ATTACK_ACTIVE]
	if not holding and not striking:
		_let_go(0.5)
		return
	if holding:
		p.drain_stamina(WORRY_STAMINA_PER_SECOND * delta)
		if p.is_exhausted:
			var away: Vector3 = global_position - p.global_position
			away.y = 0.0
			away = away.normalized() if away.length_squared() > 0.01 else -_facing_dir
			p.wrench_off_hand(global_position + away * WRENCH_THROW)
			_noise(12.0)
			_let_go(0.9)
			return
	if _state_timer <= 0.0:
		_let_go(0.6)


func _let_go(recover: float) -> void:
	_worry_victim = null
	_release_token()
	state = AIState.RECOVERY
	_state_timer = recover


func _begin_climb() -> void:
	state = AIState.CLIMB
	_state_timer = CLIMB_SECONDS
	_climb_from = global_position
	_facing_dir = -perch_out
	_visual_root.look_at(global_position + _facing_dir, Vector3.UP)
	velocity = Vector3.ZERO


func _release_token() -> void:
	if coordinator:
		coordinator.release_attack_token(self)


## Drops any blow in progress: hitboxes closed, ring hidden, grip loosed, turn handed back.
func _abandon_attack() -> void:
	_bite_hitbox.end_swing()
	_drop_hitbox.end_swing()
	_landing_timer = 0.0
	_drop_ring.visible = false
	_worry_victim = null
	_release_token()


## The survivor is dead: drop everything, forget them, and go home to the ledge.
func _stand_down() -> void:
	if state in [AIState.IDLE, AIState.PERCHED, AIState.RETURN_HOME, AIState.CLIMB, AIState.DEAD]:
		return
	_abandon_attack()
	_memory = 0.0
	if state in [AIState.TELL, AIState.LEAP]:
		# Still up top, or in the air: back to the ledge.
		if has_perch:
			_perch_now()
			return
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
	var worrying: bool = state == AIState.WORRY
	var dmg: float = payload.physical_damage * (WORRY_EXPOSED_MULT if worrying else 1.0)
	health = maxf(0.0, health - dmg)
	poise_damage += payload.poise_damage
	_last_known = payload.attacker_origin
	_memory = memory_seconds()
	var away: Vector3 = global_position - payload.attacker_origin
	away.y = 0.0
	if away.length_squared() > 0.01:
		_knockback_vel = away.normalized() * payload.knockback_force
	if health <= 0.0:
		_die()
		return
	if state == AIState.CLIMB:
		# Knocked off the wall face: it drops back down, staggered.
		_abandon_attack()
		state = AIState.STAGGER
		_state_timer = STAGGER_TIME
		return
	if state in [AIState.IDLE, AIState.RETURN_HOME]:
		state = AIState.STALK
	if worrying or poise_damage >= max_poise or payload.is_heavy:
		poise_damage = 0.0
		_abandon_attack()
		state = AIState.STAGGER
		_state_timer = STAGGER_TIME


func _die() -> void:
	_abandon_attack()
	state = AIState.DEAD
	velocity = Vector3.ZERO
	collision_layer = 0
	_hurtbox.set_deferred("monitorable", false)
	_model.play(&"Death01")
	_anim_state = AIState.DEAD
	_status_mat.albedo_color = Color(0.20, 0.20, 0.20)
	Lootable.attach_corpse(self, "%s carcass" % enemy_name, ItemDatabase.roll_dragger_loot(), 2.5)
	if player_ref != null:
		player_ref.combat_banner_message.emit("The thing from the gallery is dead.", Color(0.80, 0.76, 0.64))


## Drawn only while the survivor can see it (their vision cone, cut by walls: Perception).
func _update_visibility() -> void:
	if player_ref == null or player_ref.perception == null:
		return
	player_ref.perception.update_visibility(self, _visual_root, 1.0, not is_dead())


## What the survivor may hear of it: claws clicking on stone, a wet breath.
func _report_noises(delta: float) -> void:
	if player_ref == null or player_ref.perception == null:
		return
	var speed: float = Vector2(velocity.x, velocity.z).length()
	player_ref.perception.report_footsteps(self, delta, speed, 0.9, 4.5)


func _noise(loudness: float) -> void:
	if player_ref != null and player_ref.perception != null:
		player_ref.perception.report_noise(global_position, loudness, self)


func _update_visual_telegraph() -> void:
	match state:
		AIState.TELL, AIState.LUNGE_STARTUP:
			_status_mat.albedo_color = Color(0.95, 0.65, 0.15)
		AIState.LEAP, AIState.LUNGE_ACTIVE, AIState.WORRY:
			_status_mat.albedo_color = Color(0.92, 0.18, 0.15)
		AIState.RECOVERY, AIState.STAGGER:
			_status_mat.albedo_color = Color(0.42, 0.68, 0.85)
		AIState.WARY:
			_status_mat.albedo_color = Color(0.86, 0.52, 0.22)
		AIState.DEAD:
			_status_mat.albedo_color = Color(0.20, 0.20, 0.20)
		_:
			_status_mat.albedo_color = Color(0.62, 0.58, 0.50)
	if _model == null or state == AIState.DEAD:
		return
	if state != _anim_state:
		var was: int = _anim_state
		_anim_state = state
		match state:
			AIState.TELL:
				_model.play_fitted(&"NinjaJump_Start", DROP_TELL)
			AIState.LEAP:
				_model.play(&"NinjaJump_Idle")
			AIState.RECOVERY:
				if was == AIState.LEAP:
					_model.play_fitted(&"NinjaJump_Land", 0.6)
			AIState.LUNGE_STARTUP:
				_model.play_strike(&"Sword_Dash", _state_timer)
			AIState.WORRY:
				_model.play(&"Zombie_Scratch", 1.6)
			AIState.STAGGER:
				_model.play_fitted(&"Hit_Knockback", maxf(_state_timer, 0.3))
			AIState.CLIMB:
				_model.play_fitted(&"ClimbUp_1m", CLIMB_SECONDS)
	if state in [AIState.TELL, AIState.LEAP, AIState.LUNGE_STARTUP, AIState.LUNGE_ACTIVE, AIState.WORRY, AIState.STAGGER, AIState.CLIMB]:
		return
	if state == AIState.RECOVERY and _model.current_animation() == &"NinjaJump_Land" and _model.anim.is_playing():
		return
	var speed: float = Vector2(velocity.x, velocity.z).length()
	if speed < 0.2:
		_model.play(&"Crouch_Idle")
	else:
		_model.play(&"Crouch_Fwd", clampf(speed / 1.6, 0.7, 2.0))


func _build_body() -> void:
	collision_layer = 4
	collision_mask = 1 | 2 | 4 | 64  # + layer 7 Props: set dressing blocks bodies, never rays
	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.4
	cap.height = 1.3
	col.shape = cap
	col.position = Vector3(0.0, 0.65, 0.0)
	add_child(col)

	_visual_root = Node3D.new()
	add_child(_visual_root)
	_model = EnemyModel.new("dragger")
	_visual_root.add_child(_model)
	_weapon_arm = Node3D.new()
	_model.right_socket.add_child(_weapon_arm)

	_status_mat = StandardMaterial3D.new()
	_status_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_status_mat.albedo_color = Color(0.62, 0.58, 0.50)
	var pip := MeshInstance3D.new()
	var pip_mesh := CylinderMesh.new()
	pip_mesh.top_radius = 0.5
	pip_mesh.bottom_radius = 0.5
	pip_mesh.height = 0.03
	pip.mesh = pip_mesh
	pip.material_override = _status_mat
	pip.position = Vector3(0.0, 0.03, 0.0)
	_visual_root.add_child(pip)

	# The drop's ring sits on the ground where it will land, not under it.
	var ring_mat := StandardMaterial3D.new()
	ring_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	ring_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ring_mat.albedo_color = Color(0.92, 0.55, 0.15, 0.42)
	_drop_ring = MeshInstance3D.new()
	_drop_ring.name = "DropRing"
	var r_mesh := CylinderMesh.new()
	r_mesh.top_radius = DROP_RADIUS
	r_mesh.bottom_radius = DROP_RADIUS
	r_mesh.height = 0.04
	_drop_ring.mesh = r_mesh
	_drop_ring.material_override = ring_mat
	_drop_ring.top_level = true
	_drop_ring.visible = false
	add_child(_drop_ring)

	_drop_hitbox = HitboxComponent.new()
	_drop_hitbox.name = "DropHitbox"
	_drop_hitbox.owner_entity = self
	_drop_hitbox.collision_layer = 0
	_drop_hitbox.collision_mask = 8  # layer 4: the survivor's (and the companion's) hurtbox
	_drop_hitbox.top_level = true
	var dc := CollisionShape3D.new()
	var ds := CylinderShape3D.new()
	ds.radius = DROP_RADIUS
	ds.height = 1.8
	dc.shape = ds
	_drop_hitbox.add_child(dc)
	add_child(_drop_hitbox)

	_bite_hitbox = HitboxComponent.new()
	_bite_hitbox.name = "BiteHitbox"
	_bite_hitbox.owner_entity = self
	_bite_hitbox.collision_layer = 0
	_bite_hitbox.collision_mask = 8
	var bc := CollisionShape3D.new()
	var bb := BoxShape3D.new()
	bb.size = Vector3(0.9, 1.0, 1.2)
	bc.shape = bb
	bc.position = Vector3(0.0, 0.8, -0.75)
	_bite_hitbox.add_child(bc)
	_visual_root.add_child(_bite_hitbox)
	_bite_hitbox.confirmed_hit.connect(_on_bite_landed)

	_hurtbox = HurtboxComponent.new()
	_hurtbox.owner_entity = self
	_hurtbox.collision_layer = 16
	_hurtbox.collision_mask = 0
	var hurt_col := CollisionShape3D.new()
	var hurt_cap := CapsuleShape3D.new()
	hurt_cap.radius = 0.5
	hurt_cap.height = 1.4
	hurt_col.shape = hurt_cap
	hurt_col.position = Vector3(0.0, 0.7, 0.0)
	_hurtbox.add_child(hurt_col)
	add_child(_hurtbox)
	_hurtbox.hit_received.connect(_on_hurtbox_hit_received)
