class_name EnemyQuarryTroll
extends CharacterBody3D
## THE BLIND QUARRY-TROLL. It has no eyes worth the name; it hunts by sound alone. Stand still and
## it cannot find you, even at arm's length. Every noise you make (a sprint, a swing, a dodge, a
## shield taking a blow, a sword clanging off stone, a pack that clatters, mail that clinks) has a
## radius; inside it, the troll turns and lumbers to where the sound WAS, and brings both fists
## down on that spot. If you are still there, you take the blow; if you crept away, it pounds
## empty ground. Hit it and it knows where you are: it thrashes around itself. It hears your
## companion too, so Edda's cudgel can draw it. Weather, armour, load and background all reach
## it through the survivor's noise multiplier: the Dead Calm makes it deadly, a cinder-squall
## makes it deaf, a gutter-kin can walk past it.

signal troll_event_banner(text: String, col: Color)
signal troll_ground_shockwave(intensity: float)

enum AIState { LISTEN, INVESTIGATE, POUND_STARTUP, POUND_ACTIVE, THRASH_STARTUP, THRASH_ACTIVE, RECOVERY, STAGGER, RETURN_HOME, DEAD }

## How far (metres) each thing the survivor does can be heard, before the survivor's noise
## multiplier (load, weather, background, armour). Standing, blocking still and walking slowly
## while blocking make no sound it can hear.
const HEARING: Dictionary = {
	"sprint": 14.0, "attack": 12.0, "dodge": 9.0, "block_impact": 10.0, "recoil": 16.0,
	"move": 6.0, "scavenge": 5.0, "channel": 3.0,
}
## The companion's noise, before the weather.
const COMPANION_HEARING_RUN: float = 7.0
const COMPANION_HEARING_WALK: float = 3.5
const COMPANION_HEARING_ATTACK: float = 10.0
## Through stone a noise carries this fraction (the same rule as the survivor's hearing).
const WALL_MUFFLE: float = 0.55

const POUND_DAMAGE: float = 55.0
const POUND_POISE: float = 90.0
const POUND_RADIUS: float = 1.8
## It pounds when the heard spot is this close.
const POUND_REACH: float = 2.4
const POUND_STARTUP_TIME: float = 1.1
const POUND_ACTIVE_TIME: float = 0.2
const POUND_RECOVERY: float = 1.4
const THRASH_DAMAGE: float = 30.0
const THRASH_POISE: float = 50.0
const THRASH_RADIUS: float = 2.8
const THRASH_STARTUP_TIME: float = 0.55
const THRASH_ACTIVE_TIME: float = 0.25
const THRASH_RECOVERY: float = 1.0
const THRASH_COOLDOWN: float = 3.0
const STAGGER_TIME: float = 1.3
## Forgets a sound after this long; then walks home if it has strayed.
const MEMORY_SECONDS: float = 6.0
const HOME_LEASH: float = 3.0

@export var enemy_name: String = "Blind Quarry-Troll"
@export var max_health: float = 360.0
@export var max_poise: float = 130.0

@export_group("Temperament")
## How hungrily it hunts, 0 to 1: how fast it lumbers to a sound (2.2 m/s at 0, 3.2 at 1) and how
## long it stands listening after a blow (4 s at 0, 1.2 s at 1).
@export_range(0.0, 1.0) var aggression: float = 0.5
## Scales the damage of everything it lands (pound, thrash).
@export var attack_power: float = 1.0
@export_group("")

var health: float = 360.0
var poise_damage: float = 0.0
var state: AIState = AIState.LISTEN
var player_ref: PlayerController
var audio: ProceduralAudio
var coordinator: EncounterCoordinator

## Where it last heard something, and how long ago.
var heard_pos: Vector3 = Vector3.ZERO
var has_heard: bool = false
var _heard_age: float = 0.0
var _home_pos: Vector3 = Vector3.ZERO
var _state_timer: float = 0.0
var _thrash_cooldown: float = 0.0
var _facing_dir: Vector3 = Vector3.FORWARD
var _knockback_vel: Vector3 = Vector3.ZERO
var _pound_target: Vector3 = Vector3.ZERO
var _first_heard: bool = true

var _visual_root: Node3D
var _model: EnemyModel
## Holds the lump of quarry stone in its right fist.
var _weapon_arm: Node3D
var _anim_state: int = -1
var _status_mat: StandardMaterial3D
var _pound_ring: MeshInstance3D
## The pound lands at a point on the ground, not in front of the troll: its own hitbox, placed
## in world space at the target when the blow comes down.
var _pound_hitbox: HitboxComponent
var _thrash_hitbox: HitboxComponent
var _hurtbox: HurtboxComponent


func _ready() -> void:
	health = max_health
	_home_pos = global_position
	_build_body()


func _physics_process(delta: float) -> void:
	_update_visibility()
	if state == AIState.DEAD:
		return
	_knockback_vel = _knockback_vel.move_toward(Vector3.ZERO, 16.0 * delta)
	_thrash_cooldown = maxf(0.0, _thrash_cooldown - delta)
	if poise_damage > 0.0:
		poise_damage = maxf(0.0, poise_damage - 6.0 * delta)
	if player_ref != null and player_ref.current_state == PlayerController.ActionState.DEAD:
		_stand_down()
	else:
		_listen(delta)
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


func lumber_speed() -> float:
	return lerpf(2.2, 3.2, aggression)


func listen_pause() -> float:
	return lerpf(4.0, 1.2, aggression)


## How far the survivor's current action carries, in metres, before walls. 0: silent.
func player_noise_radius() -> float:
	return survivor_noise_radius(player_ref)


## How far what `p` is doing right now carries (HEARING times their noise multiplier); 0 when
## silent. Static so other listeners (the gallery-crawler) hear the survivor by the same table.
static func survivor_noise_radius(p: PlayerController) -> float:
	if p == null:
		return 0.0
	var key: String = ""
	match p.current_state:
		PlayerController.ActionState.SPRINT:
			key = "sprint"
		PlayerController.ActionState.ATTACK_STARTUP, PlayerController.ActionState.ATTACK_ACTIVE:
			key = "attack"
		PlayerController.ActionState.DODGE:
			key = "dodge"
		PlayerController.ActionState.BLOCK_IMPACT:
			key = "block_impact"
		PlayerController.ActionState.RECOIL:
			key = "recoil"
		PlayerController.ActionState.MOVE:
			key = "move"
		PlayerController.ActionState.CHANNEL:
			key = "scavenge" if p.is_scavenging() else "channel"
	if key == "":
		return 0.0
	return float(HEARING[key]) * p.get_noise_multiplier()


## How far the companion's current action carries, before walls.
func companion_noise_radius(c: Companion) -> float:
	if c == null or not is_instance_valid(c) or c.is_dead() or c.is_downed():
		return 0.0
	var weather: float = player_ref.weather_hearing if player_ref != null else 1.0
	if c.state in [Companion.State.ATTACK_STARTUP, Companion.State.ATTACK_ACTIVE]:
		return COMPANION_HEARING_ATTACK * weather
	var speed: float = Vector2(c.velocity.x, c.velocity.z).length()
	if speed > 4.2:
		return COMPANION_HEARING_RUN * weather
	if speed > 0.3:
		return COMPANION_HEARING_WALK * weather
	return 0.0


## True when a noise at `from` with `radius` reaches the troll (muffled through stone).
func hears(from: Vector3, radius: float) -> bool:
	if radius <= 0.0:
		return false
	var reach: float = radius
	var q := PhysicsRayQueryParameters3D.create(global_position + Vector3(0.0, 2.0, 0.0), from + Vector3(0.0, 1.0, 0.0), 1)
	if not get_world_3d().direct_space_state.intersect_ray(q).is_empty():
		reach *= WALL_MUFFLE
	return global_position.distance_to(from) <= reach


func _listen(delta: float) -> void:
	_heard_age += delta
	if _heard_age > MEMORY_SECONDS:
		has_heard = false
	# The loudest source relative to its reach wins.
	var best: Vector3 = Vector3.ZERO
	var best_ratio: float = INF
	if player_ref != null:
		var r: float = player_noise_radius()
		if hears(player_ref.global_position, r):
			best = player_ref.global_position
			best_ratio = global_position.distance_to(best) / r
	for n: Node in get_parent().get_children():
		var c := n as Companion
		if c == null:
			continue
		var cr: float = companion_noise_radius(c)
		if hears(c.global_position, cr):
			var ratio: float = global_position.distance_to(c.global_position) / cr
			if ratio < best_ratio:
				best = c.global_position
				best_ratio = ratio
	if best_ratio < INF:
		heard(best)


## Something made a noise at `pos`: remember it, and go there if free to.
func heard(pos: Vector3) -> void:
	heard_pos = pos
	has_heard = true
	_heard_age = 0.0
	if state in [AIState.LISTEN, AIState.RETURN_HOME]:
		state = AIState.INVESTIGATE
		if _first_heard:
			_first_heard = false
			if audio:
				audio.play_ogre_roar()
			troll_event_banner.emit("Something huge turns its head toward the sound. It is blind: keep still.", Color(0.80, 0.70, 0.52))


func _process_ai_state(delta: float) -> void:
	match state:
		AIState.LISTEN:
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			_state_timer -= delta
			if _state_timer <= 0.0 and not has_heard and global_position.distance_to(_home_pos) > HOME_LEASH:
				state = AIState.RETURN_HOME

		AIState.INVESTIGATE:
			var to_h: Vector3 = heard_pos - global_position
			to_h.y = 0.0
			if to_h.length() <= POUND_REACH:
				_begin_pound(heard_pos)
				return
			if not has_heard:
				state = AIState.LISTEN
				_state_timer = listen_pause()
				return
			_steer(to_h.normalized(), lumber_speed(), delta)

		AIState.RETURN_HOME:
			var to_home: Vector3 = _home_pos - global_position
			to_home.y = 0.0
			if to_home.length() <= 0.8:
				state = AIState.LISTEN
				_state_timer = listen_pause()
				return
			_steer(to_home.normalized(), lumber_speed() * 0.7, delta)

		AIState.POUND_STARTUP:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			_face_toward(_pound_target, 4.0, delta)
			if _state_timer <= 0.0:
				_enter_pound_active()

		AIState.POUND_ACTIVE:
			_state_timer -= delta
			velocity = Vector3(0.0, velocity.y, 0.0)
			if _state_timer <= 0.0:
				_pound_hitbox.end_swing()
				_pound_ring.visible = false
				_release_token()
				state = AIState.RECOVERY
				_state_timer = POUND_RECOVERY

		AIState.THRASH_STARTUP:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _state_timer <= 0.0:
				_enter_thrash_active()

		AIState.THRASH_ACTIVE:
			_state_timer -= delta
			velocity = Vector3(0.0, velocity.y, 0.0)
			if _state_timer <= 0.0:
				_thrash_hitbox.end_swing()
				_release_token()
				state = AIState.RECOVERY
				_state_timer = THRASH_RECOVERY

		AIState.RECOVERY, AIState.STAGGER:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _state_timer <= 0.0:
				# A fresh sound sends it straight back in; otherwise it stands and listens.
				if has_heard and _heard_age < 0.5:
					state = AIState.INVESTIGATE
				else:
					state = AIState.LISTEN
					_state_timer = listen_pause()


func _begin_pound(target: Vector3) -> void:
	if coordinator:
		coordinator.request_attack_token(self, true)
	_pound_target = Vector3(target.x, 0.0, target.z)
	has_heard = false
	state = AIState.POUND_STARTUP
	_state_timer = POUND_STARTUP_TIME
	_pound_ring.global_position = _pound_target + Vector3(0.0, 0.05, 0.0)
	_pound_ring.visible = true
	_noise(10.0)


func _enter_pound_active() -> void:
	state = AIState.POUND_ACTIVE
	_state_timer = POUND_ACTIVE_TIME
	_pound_hitbox.global_position = _pound_target + Vector3(0.0, 0.9, 0.0)
	if audio:
		audio.play_ogre_ground_slam()
	troll_ground_shockwave.emit(0.6)
	_noise(30.0)
	_pound_hitbox.begin_swing(CombatPayload.new(self, _pound_target + (global_position - _pound_target).normalized() * 0.5,
		(_pound_target - global_position).normalized(), POUND_DAMAGE * attack_power, POUND_POISE, false, true, 7.0))


func _begin_thrash() -> void:
	if coordinator:
		coordinator.request_attack_token(self, true)
	_pound_ring.visible = false
	_pound_hitbox.end_swing()
	state = AIState.THRASH_STARTUP
	_state_timer = THRASH_STARTUP_TIME
	_thrash_cooldown = THRASH_COOLDOWN
	_noise(12.0)


func _enter_thrash_active() -> void:
	state = AIState.THRASH_ACTIVE
	_state_timer = THRASH_ACTIVE_TIME
	if audio:
		audio.play_swing()
	_noise(16.0)
	_thrash_hitbox.begin_swing(CombatPayload.new(self, global_position, _facing_dir, THRASH_DAMAGE * attack_power, THRASH_POISE, false, false, 6.0))


func _release_token() -> void:
	if coordinator:
		coordinator.release_attack_token(self)


## Drops any blow in progress (hitboxes closed, ring hidden, turn handed back).
func _abandon_attack() -> void:
	_pound_hitbox.end_swing()
	_thrash_hitbox.end_swing()
	_pound_ring.visible = false
	_release_token()


## The survivor is dead: drop the blow, forget the sound, and stand listening.
func _stand_down() -> void:
	if state in [AIState.LISTEN, AIState.RETURN_HOME, AIState.DEAD]:
		return
	_abandon_attack()
	has_heard = false
	state = AIState.LISTEN
	_state_timer = listen_pause()


func _steer(dir: Vector3, speed: float, delta: float) -> void:
	_face_toward(global_position + dir, 3.0, delta)
	velocity.x = dir.x * speed + _knockback_vel.x
	velocity.z = dir.z * speed + _knockback_vel.z


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
	# A blow tells it exactly where its attacker stands.
	heard(payload.attacker_origin)
	var away: Vector3 = global_position - payload.attacker_origin
	away.y = 0.0
	if away.length_squared() > 0.01:
		_knockback_vel = away.normalized() * payload.knockback_force * 0.4

	if health <= 0.0:
		_abandon_attack()
		state = AIState.DEAD
		collision_layer = 0
		_hurtbox.set_deferred("monitorable", false)
		_model.play(&"Death01", 0.8)
		troll_event_banner.emit("THE BLIND QUARRY-TROLL HAS FALLEN", Color(0.88, 0.74, 0.36))
		var corpse := Lootable.attach_corpse(self, "%s Carcass" % enemy_name, ItemDatabase.roll_troll_loot(), 4.0)
		corpse.interact_radius = 2.4
		return

	if poise_damage >= max_poise:
		poise_damage = 0.0
		_abandon_attack()
		state = AIState.STAGGER
		_state_timer = STAGGER_TIME
		troll_event_banner.emit("The troll reels. Strike now!", Color(0.48, 0.78, 0.92))
		return

	# Struck from close by, it thrashes round itself (unless already swinging).
	var near: bool = global_position.distance_to(payload.attacker_origin) <= THRASH_RADIUS + 0.5
	if near and _thrash_cooldown <= 0.0 and state in [AIState.LISTEN, AIState.INVESTIGATE, AIState.RETURN_HOME, AIState.RECOVERY]:
		_begin_thrash()


## Drawn only while the survivor can see it (their vision cone, cut by walls: Perception).
func _update_visibility() -> void:
	if player_ref == null or player_ref.perception == null:
		return
	player_ref.perception.update_visibility(self, _visual_root, 2.2, state != AIState.DEAD)


## What the survivor may hear of it: a heavy, dragging tread, a grunt as a blow starts, the blows.
func _report_noises(delta: float) -> void:
	if player_ref == null or player_ref.perception == null:
		return
	var speed: float = Vector2(velocity.x, velocity.z).length()
	player_ref.perception.report_footsteps(self, delta, speed, 1.8, 18.0)


func _noise(loudness: float) -> void:
	if player_ref != null and player_ref.perception != null:
		player_ref.perception.report_noise(global_position, loudness, self)


func _update_visual_telegraph() -> void:
	match state:
		AIState.POUND_STARTUP, AIState.THRASH_STARTUP:
			_status_mat.albedo_color = Color(0.98, 0.42, 0.12)
		AIState.POUND_ACTIVE, AIState.THRASH_ACTIVE:
			_status_mat.albedo_color = Color(0.95, 0.12, 0.12)
		AIState.RECOVERY, AIState.STAGGER:
			_status_mat.albedo_color = Color(0.40, 0.74, 0.92)
		AIState.INVESTIGATE:
			_status_mat.albedo_color = Color(0.74, 0.62, 0.34)
		_:
			_status_mat.albedo_color = Color(0.40, 0.40, 0.44)
	_update_model_animation()


func _update_model_animation() -> void:
	if _model == null or state == AIState.DEAD:
		return
	if state != _anim_state:
		_anim_state = state
		match state:
			AIState.POUND_STARTUP:
				_model.play_strike(&"Sword_Regular_C", _state_timer)
			AIState.THRASH_STARTUP:
				_model.play_strike(&"Sword_Regular_A", _state_timer)
			AIState.STAGGER:
				_model.play_fitted(&"Hit_Knockback", maxf(_state_timer, 0.4))
	if state in [AIState.POUND_STARTUP, AIState.POUND_ACTIVE, AIState.THRASH_STARTUP, AIState.THRASH_ACTIVE,
			AIState.RECOVERY, AIState.STAGGER]:
		return
	var speed: float = Vector2(velocity.x, velocity.z).length()
	if speed < 0.2:
		_model.play(&"Zombie_Idle")
	else:
		_model.play(&"Zombie_Walk_Fwd", clampf(speed / 1.8, 0.6, 1.6))


func _build_body() -> void:
	collision_layer = 4
	collision_mask = 1 | 2 | 4 | 64  # + layer 7 Props: set dressing blocks bodies, never rays
	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.8
	cap.height = 2.6
	col.shape = cap
	col.position = Vector3(0.0, 1.3, 0.0)
	add_child(col)

	_visual_root = Node3D.new()
	add_child(_visual_root)
	_model = EnemyModel.new("troll")
	_visual_root.add_child(_model)
	# A lump of quarry stone in its fist.
	var stone := MeshInstance3D.new()
	var s_mesh := BoxMesh.new()
	s_mesh.size = Vector3(0.42, 0.34, 0.48)
	stone.mesh = s_mesh
	stone.material_override = AshenWildsBootstrap.surface_material("dark_stone")
	stone.position = Vector3(0.0, 0.0, -0.2)
	_weapon_arm = Node3D.new()
	_model.right_socket.add_child(_weapon_arm)
	_weapon_arm.add_child(stone)

	_status_mat = StandardMaterial3D.new()
	_status_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_status_mat.albedo_color = Color(0.40, 0.40, 0.44)
	var pip := MeshInstance3D.new()
	var pip_mesh := CylinderMesh.new()
	pip_mesh.top_radius = 0.9
	pip_mesh.bottom_radius = 0.9
	pip_mesh.height = 0.04
	pip.mesh = pip_mesh
	pip.material_override = _status_mat
	pip.position = Vector3(0.0, 0.04, 0.0)
	_visual_root.add_child(pip)

	# The pound's ring sits on the ground at the heard spot, not under the troll.
	var ring_mat := StandardMaterial3D.new()
	ring_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	ring_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ring_mat.albedo_color = Color(0.88, 0.28, 0.12, 0.42)
	_pound_ring = MeshInstance3D.new()
	_pound_ring.name = "PoundRing"
	var r_mesh := CylinderMesh.new()
	r_mesh.top_radius = POUND_RADIUS
	r_mesh.bottom_radius = POUND_RADIUS
	r_mesh.height = 0.04
	_pound_ring.mesh = r_mesh
	_pound_ring.material_override = ring_mat
	_pound_ring.top_level = true
	_pound_ring.visible = false
	add_child(_pound_ring)

	_pound_hitbox = HitboxComponent.new()
	_pound_hitbox.name = "PoundHitbox"
	_pound_hitbox.owner_entity = self
	_pound_hitbox.collision_layer = 0
	_pound_hitbox.collision_mask = 8  # layer 4: the survivor's (and the companion's) hurtbox
	_pound_hitbox.top_level = true
	var pc := CollisionShape3D.new()
	var ps := CylinderShape3D.new()
	ps.radius = POUND_RADIUS
	ps.height = 1.8
	pc.shape = ps
	_pound_hitbox.add_child(pc)
	add_child(_pound_hitbox)

	_thrash_hitbox = HitboxComponent.new()
	_thrash_hitbox.name = "ThrashHitbox"
	_thrash_hitbox.owner_entity = self
	_thrash_hitbox.collision_layer = 0
	_thrash_hitbox.collision_mask = 8
	var tc := CollisionShape3D.new()
	var ts := CylinderShape3D.new()
	ts.radius = THRASH_RADIUS
	ts.height = 2.2
	tc.shape = ts
	tc.position = Vector3(0.0, 1.1, 0.0)
	_thrash_hitbox.add_child(tc)
	add_child(_thrash_hitbox)

	_hurtbox = HurtboxComponent.new()
	_hurtbox.owner_entity = self
	_hurtbox.collision_layer = 16
	_hurtbox.collision_mask = 0
	var hurt_col := CollisionShape3D.new()
	var hurt_cap := CapsuleShape3D.new()
	hurt_cap.radius = 0.9
	hurt_cap.height = 2.6
	hurt_col.shape = hurt_cap
	hurt_col.position = Vector3(0.0, 1.3, 0.0)
	_hurtbox.add_child(hurt_col)
	add_child(_hurtbox)
	_hurtbox.hit_received.connect(_on_hurtbox_hit_received)
