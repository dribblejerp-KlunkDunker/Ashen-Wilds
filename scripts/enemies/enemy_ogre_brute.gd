class_name EnemyOgreBrute
extends CharacterBody3D

signal ogre_event_banner(text: String, col: Color)
signal ogre_ground_shockwave(intensity: float)

## THE JUGGERNAUT. Slow, relentless and devastating: every blow can take half your health. It never
## retreats and doesn't flinch while winding up a blow (poise damage x0.35 during its startups and
## charge), so the answer is to dodge, not to trade. From mid-range it lowers its head and charges
## in a straight line it cannot steer: sidestep and it thunders past, or crashes into a wall
## behind you and reels. Below 40% health it is enraged: faster on its feet, quicker to swing,
## and quicker to charge again.

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
	CHARGE_STARTUP,
	CHARGE_ACTIVE,
	DEAD
}

const SWEEP_DAMAGE: float = 46.0
const SLAM_DAMAGE: float = 62.0
const CHARGE_DAMAGE: float = 38.0
const CHARGE_POISE: float = 80.0
const CHARGE_MIN_RANGE: float = 5.0
const CHARGE_MAX_RANGE: float = 11.0
const CHARGE_SPEED: float = 8.5
const CHARGE_STARTUP_TIME: float = 0.95
## How long the charge runs at most; it also stops a few metres past where the survivor stood.
const CHARGE_MAX_TIME: float = 1.4
const CHARGE_OVERRUN: float = 3.0
const CHARGE_RECOVERY: float = 1.2
## Seconds it reels after running into a wall: the best opening it gives.
const CHARGE_CRASH_TIME: float = 2.0
## It must have been chasing for this long before it charges (not straight out of an attack).
const CHARGE_MIN_PURSUIT: float = 1.2
## Half the width it needs to charge through: its shoulders. The Watchhouse doorway (1.35 m) and
## the entry hall (1.7 m) are narrower than 2 x 0.8, so it never charges them (it would only
## crash into the frame and hand the survivor a free opening every few seconds).
const CHARGE_HALF_WIDTH: float = 0.8
## Heights the charge lane is checked at: knee (a crate or a bone heap stops a charge; the chest
## ray alone looked over them) and chest.
const CHARGE_LANE_HEIGHTS: Array[float] = [0.45, 1.4]
## Poise damage it takes while winding up or charging: it doesn't flinch mid-blow.
const WINDUP_POISE_MULT: float = 0.35
const ENRAGE_HEALTH: float = 0.4
const ENRAGE_SPEED_MULT: float = 1.25
const ENRAGE_STARTUP_MULT: float = 0.8

@export var enemy_name: String = "Blackfen Ogre"
@export var max_health: float = 280.0
@export var max_poise: float = 95.0
## Width of the club sweep in degrees, centred on the facing direction. Walls
## inside this arc (within `sweep_reach`) make the sweep clang.
@export var sweep_arc_degrees: float = 150.0
## How far the club sweep reaches from the ogre's centre, in metres. Matches the
## sweep hitbox, which extends about 3 m forward and 1.5 m to each side.
@export var sweep_reach: float = 2.6
## Seconds the ogre reels after its club clangs off a wall: the player's opening.
## Keep it longer than a whiffed sweep leaves the ogre open (0.24 s active +
## 1.30 s recovery = 1.54 s), or clanging would be the better outcome for it.
@export var wall_recoil_time: float = 1.8

@export_group("Temperament")
## How relentless it is, 0 to 1: how far it chases before going home (10 m at 0, 22.5 m at 1;
## 20 m at the default) and how soon it charges again (12 s at 0, 4 s at 1). Enraged, it acts
## as if 0.25 higher.
@export_range(0.0, 1.0) var aggression: float = 0.8
## Scales the damage of everything it lands (sweep, slam, charge).
@export var attack_power: float = 1.0
@export_group("")

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
var _charge_cooldown: float = 0.0
var _pursuit_time: float = 0.0
var _charge_dir: Vector3 = Vector3.FORWARD
var _charge_left: float = 0.0
var _charge_travelled: float = 0.0
var enraged: bool = false

var _visual_root: Node3D
var _club_pivot: Node3D
## The Ashbound body (presentation only) and the state its animation was last chosen for.
var _model: EnemyModel
var _anim_state: int = -1
var _slam_ring: MeshInstance3D
var _slam_ring_mat: StandardMaterial3D
var _status_mat: StandardMaterial3D
var _hitbox: HitboxComponent
## The charge hits with the ogre's whole body, not the club's reach.
var _charge_hitbox: HitboxComponent
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
	_charge_cooldown = maxf(0.0, _charge_cooldown - delta)
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
		if state != AIState.IDLE:
			_abandon_attack()
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
				_enter_pursuit()

		AIState.PURSUE:
			_pursuit_time += delta
			if dist > leash_distance():
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
			if _try_begin_charge(dist, dir_p):
				return

			_steer_toward(dir_p, 2.85 * _speed_mult(), delta)

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
				_enter_pursuit()

		AIState.CHARGE_STARTUP:
			# Head down, pawing: it still turns to follow the survivor until it goes.
			_state_timer -= delta
			velocity = Vector3.ZERO
			_face_direction(dir_p, 2.5, delta)
			if _state_timer <= 0.0:
				_enter_charge_active()

		AIState.CHARGE_ACTIVE:
			# Locked to the line it chose: it cannot steer, so a sidestep makes it miss.
			_state_timer -= delta
			if _ran_into_wall():
				_enter_charge_crash()
				return
			_charge_left -= CHARGE_SPEED * delta
			_charge_travelled += CHARGE_SPEED * delta
			velocity.x = _charge_dir.x * CHARGE_SPEED
			velocity.z = _charge_dir.z * CHARGE_SPEED
			if _state_timer <= 0.0 or _charge_left <= 0.0:
				_charge_hitbox.end_swing()
				_enter_long_recovery(CHARGE_RECOVERY)

		AIState.STAGGER, AIState.RECOIL:
			_state_timer -= delta
			_slam_ring.visible = false
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _state_timer <= 0.0:
				_enter_pursuit()

func is_dead() -> bool:
	return state == AIState.DEAD

func is_staggered() -> bool:
	return state == AIState.STAGGER or state == AIState.RECOIL

func _begin_committed_attack(dir_to_player: Vector3) -> void:
	if coordinator:
		coordinator.request_attack_token(self, true)
	_face_direction(dir_to_player, 12.0, 0.1)
	var quick: float = ENRAGE_STARTUP_MULT if enraged else 1.0
	if randf() > 0.45:
		state = AIState.SLAM_STARTUP
		_state_timer = 1.12 * quick
	else:
		state = AIState.SWEEP_STARTUP
		_state_timer = 0.92 * quick

func _enter_pursuit() -> void:
	state = AIState.PURSUE
	_pursuit_time = 0.0

## How far from the survivor it gives up and walks home.
func leash_distance() -> float:
	return 10.0 + 12.5 * clampf(aggression + (0.25 if enraged else 0.0), 0.0, 1.0)

func charge_cooldown_time() -> float:
	return lerpf(12.0, 4.0, clampf(aggression + (0.25 if enraged else 0.0), 0.0, 1.0))

func _speed_mult() -> float:
	return ENRAGE_SPEED_MULT if enraged else 1.0

## Charges when the survivor is at mid-range, in sight, the way between is clear of walls, it
## has been chasing for a moment, and its last charge has cooled down.
func _try_begin_charge(dist: float, dir_p: Vector3) -> bool:
	if _charge_cooldown > 0.0 or _pursuit_time < CHARGE_MIN_PURSUIT:
		return false
	if dist < CHARGE_MIN_RANGE or dist > CHARGE_MAX_RANGE or not _visual_root.visible:
		return false
	if not _charge_lane_clear(dir_p, dist):
		return false
	# Unlike its close blows, the charge is optional: it waits for the attack turn.
	if coordinator and not coordinator.request_attack_token(self, true):
		return false
	_face_direction(dir_p, 12.0, 0.1)
	state = AIState.CHARGE_STARTUP
	_state_timer = CHARGE_STARTUP_TIME * (ENRAGE_STARTUP_MULT if enraged else 1.0)
	_charge_cooldown = charge_cooldown_time()
	if audio:
		audio.play_ogre_roar()
	ogre_event_banner.emit("The Ogre lowers its head to charge. Sidestep!", Color(0.95, 0.52, 0.18))
	return true

## True when a lane as wide as its shoulders, from knee to chest height, runs clear of walls and
## solid props on layer 1 all the way to the survivor. Set dressing (layer 7) is no ray's
## business, so a tree in the lane still ends in a crash, as documented.
func _charge_lane_clear(dir_p: Vector3, dist: float) -> bool:
	var side := Vector3(-dir_p.z, 0.0, dir_p.x)
	var space := get_world_3d().direct_space_state
	for lateral: float in [0.0, CHARGE_HALF_WIDTH, -CHARGE_HALF_WIDTH]:
		for height: float in CHARGE_LANE_HEIGHTS:
			var offset: Vector3 = side * lateral + Vector3(0.0, height, 0.0)
			var q := PhysicsRayQueryParameters3D.create(global_position + offset,
				global_position + offset + dir_p * (dist + CHARGE_OVERRUN * 0.5), 1)
			if not space.intersect_ray(q).is_empty():
				return false
	return true

func _enter_charge_active() -> void:
	state = AIState.CHARGE_ACTIVE
	_state_timer = CHARGE_MAX_TIME
	_charge_dir = _facing_dir
	var reach: float = CHARGE_MIN_RANGE
	if player_ref:
		var to_p: Vector3 = player_ref.global_position - global_position
		to_p.y = 0.0
		reach = to_p.length()
	_charge_left = reach + CHARGE_OVERRUN
	_charge_travelled = 0.0
	var payload := CombatPayload.new(self, global_position, _charge_dir,
		CHARGE_DAMAGE * attack_power, CHARGE_POISE, false, true, 9.0)
	_charge_hitbox.begin_swing(payload)

## True when its last move ran it into something solid (a wall, a tree, a fence), not a body.
func _ran_into_wall() -> bool:
	if _charge_travelled < 0.3:
		return false  # not under way yet
	for i: int in range(get_slide_collision_count()):
		var c: KinematicCollision3D = get_slide_collision(i)
		if c.get_collider() is StaticBody3D and absf(c.get_normal().y) < 0.5 and c.get_normal().dot(_charge_dir) < -0.5:
			return true
	return false

## Ran into a wall: it reels, dazed, for CHARGE_CRASH_TIME (counts as staggered).
func _enter_charge_crash() -> void:
	_charge_hitbox.end_swing()
	if coordinator:
		coordinator.release_attack_token(self)
	state = AIState.RECOIL
	_state_timer = CHARGE_CRASH_TIME
	_knockback_vel = -_charge_dir * 2.0
	velocity = Vector3.ZERO
	if audio:
		audio.play_ogre_ground_slam()
	ogre_ground_shockwave.emit(0.6)
	ogre_event_banner.emit("The Ogre crashes into the wall. Strike now!", Color(0.48, 0.78, 0.92))

func _enter_sweep_active() -> void:
	# Blade height 1.6: the club pivot (the ogre's fist) sits 1.65 m up; the
	# club tip runs from about 1.1 m (wound-up pose) to 2.9 m (follow-through
	# pose), and the sweep hitbox covers 0-2.2 m. 1.6 lies inside both, at
	# fist height. Knee-high crates (0.45-0.7 m) don't stop it; walls do.
	var obstruction: Dictionary = WallDeflection.sweep_obstruction(self, _facing_dir, sweep_arc_degrees, sweep_reach, 1.6)
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
		SWEEP_DAMAGE * attack_power,
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
		SLAM_DAMAGE * attack_power,
		85.0,
		true,
		true,
		8.5
	)
	_hitbox.begin_swing(payload)

func _enter_long_recovery(duration: float) -> void:
	_hitbox.end_swing()
	if coordinator:
		coordinator.release_attack_token(self)
	state = AIState.LONG_RECOVERY
	_state_timer = duration

func _enter_wall_recoil(hit: Dictionary) -> void:
	_hitbox.end_swing()
	_slam_ring.visible = false
	if coordinator:
		coordinator.release_attack_token(self)
	state = AIState.RECOIL
	_state_timer = wall_recoil_time

	var normal: Vector3 = WallDeflection.recoil_normal(hit, _facing_dir)
	_knockback_vel = normal * 1.2
	if audio:
		audio.play_wall_clang()
	WallDeflection.spawn_sparks(get_parent(), hit.get("position", global_position + _facing_dir * sweep_reach), normal)
	ogre_event_banner.emit("The Ogre's club smashes into the wall — Strike Now!", Color(0.48, 0.78, 0.92))

## Drops whatever attack was under way when the ogre loses its target (the
## player died or is gone): closes the hitbox, hides the slam ring and hands
## back the attack token so other enemies can attack after a respawn.
func _abandon_attack() -> void:
	_hitbox.end_swing()
	_charge_hitbox.end_swing()
	_slam_ring.visible = false
	if coordinator:
		coordinator.release_attack_token(self)

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
	var winding_up: bool = state in [AIState.SWEEP_STARTUP, AIState.SLAM_STARTUP, AIState.CHARGE_STARTUP, AIState.CHARGE_ACTIVE]
	poise_damage += payload.poise_damage * (WINDUP_POISE_MULT if winding_up else 1.0)

	if health <= 0.0:
		_hitbox.end_swing()
		_charge_hitbox.end_swing()
		_slam_ring.visible = false
		if coordinator:
			coordinator.release_attack_token(self)
		state = AIState.DEAD
		collision_layer = 0
		_hurtbox.set_deferred("monitorable", false)
		_model.play(&"Death01", 0.8)
		ogre_event_banner.emit("THE BLACKFEN OGRE HAS FALLEN", Color(0.88, 0.74, 0.36))
		var corpse := Lootable.attach_corpse(self, "%s Carcass" % enemy_name, ItemDatabase.roll_ogre_loot(), 4.0)
		corpse.interact_radius = 2.6
		return

	if not enraged and health < max_health * ENRAGE_HEALTH:
		enraged = true
		_charge_cooldown = minf(_charge_cooldown, 1.5)
		if audio:
			audio.play_ogre_roar()
		ogre_event_banner.emit("The Ogre is enraged!", Color(0.95, 0.30, 0.16))

	if poise_damage >= max_poise:
		_hitbox.end_swing()
		_charge_hitbox.end_swing()
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
			_status_mat.albedo_color = Color(0.95, 0.58, 0.15)
		AIState.SLAM_STARTUP, AIState.CHARGE_STARTUP:
			_status_mat.albedo_color = Color(0.98, 0.35, 0.10)
		AIState.SWEEP_ACTIVE, AIState.SLAM_ACTIVE, AIState.CHARGE_ACTIVE:
			_status_mat.albedo_color = Color(0.95, 0.12, 0.12)
		AIState.LONG_RECOVERY, AIState.STAGGER:
			_status_mat.albedo_color = Color(0.38, 0.75, 0.92)
		AIState.RECOIL:
			# Club jarred back past the wind-up; a paler blue than recovery so
			# the clang reads as its own opening.
			_status_mat.albedo_color = Color(0.58, 0.86, 0.98)
		_:
			# Enraged, its ring smoulders red instead of dull brown.
			_status_mat.albedo_color = Color(0.70, 0.16, 0.10) if enraged else Color(0.48, 0.28, 0.24)
	_update_model_animation()

## Picks the body's animation from the AI state (the status ring and slam ring stay the readable
## telegraph). The sweep and the slam land as their startup timers run out; the ogre shambles
## with the zombie walk and claws at doorways it cannot fit through.
func _update_model_animation() -> void:
	if _model == null or state == AIState.DEAD:
		return
	if state != _anim_state:
		_anim_state = state
		match state:
			AIState.SWEEP_STARTUP:
				_model.play_strike(&"Sword_Regular_A", _state_timer)
			AIState.SLAM_STARTUP:
				_model.play_strike(&"Sword_Regular_C", _state_timer)
			AIState.STAGGER:
				_model.play_fitted(&"Hit_Knockback", maxf(_state_timer, 0.4))
			AIState.RECOIL:
				_model.play_fitted(&"Hit_Head", maxf(_state_timer, 0.4))
			AIState.DOORWAY_FRUSTRATED:
				_model.play(&"Zombie_Scratch", 0.8, EnemyModel.DEFAULT_BLEND, true)
			AIState.CHARGE_STARTUP:
				_model.play(&"Push", 1.4)
			AIState.CHARGE_ACTIVE:
				_model.play(&"Sprint", 1.1)
	if state in [AIState.SWEEP_STARTUP, AIState.SWEEP_ACTIVE, AIState.SLAM_STARTUP, AIState.SLAM_ACTIVE,
			AIState.LONG_RECOVERY, AIState.STAGGER, AIState.RECOIL, AIState.DOORWAY_FRUSTRATED,
			AIState.CHARGE_STARTUP, AIState.CHARGE_ACTIVE]:
		return
	var speed: float = Vector2(velocity.x, velocity.z).length()
	if speed < 0.2:
		_model.play(&"Zombie_Idle")
	else:
		_model.play(&"Zombie_Walk_Fwd", clampf(speed / 1.8, 0.6, 1.8))

func _build_ogre_visuals_and_colliders() -> void:
	collision_layer = 4
	collision_mask = 1 | 2 | 4 | 64  # + layer 7 Props: set dressing blocks bodies, never rays

	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.85
	cap.height = 2.95
	col.shape = cap
	col.position = Vector3(0.0, 1.48, 0.0)
	add_child(col)

	_visual_root = Node3D.new()
	add_child(_visual_root)

	_model = EnemyModel.new("ogre")
	_visual_root.add_child(_model)
	_club_pivot = Node3D.new()
	_model.right_socket.add_child(_club_pivot)

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

	_charge_hitbox = HitboxComponent.new()
	_charge_hitbox.name = "ChargeHitbox"
	_charge_hitbox.owner_entity = self
	_charge_hitbox.collision_layer = 0
	_charge_hitbox.collision_mask = 8
	var ch_col := CollisionShape3D.new()
	var ch_box := BoxShape3D.new()
	ch_box.size = Vector3(2.0, 2.4, 1.3)
	ch_col.shape = ch_box
	ch_col.position = Vector3(0.0, 1.2, -0.95)
	_charge_hitbox.add_child(ch_col)
	_visual_root.add_child(_charge_hitbox)

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
