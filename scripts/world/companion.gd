class_name Companion
extends CharacterBody3D
## A survivor who throws in with you. Found bound in the Watchhouse and cut free (an ActionPoint),
## they follow a few paces behind, fight whatever comes within reach of either of you, and can be
## told to hold a spot (F). They are not the survivor: a cudgel, no pack, no stamina, modest
## health. Knocked to nothing they go DOWNED, not dead, for DOWNED_SECONDS: lift them with a clean
## rag before then or they die and leave a body to search.
##
## Enemies do not hunt the companion (every enemy's senses are for the survivor), but their
## blows land on anything in the way: the companion's hurtbox is on the survivor's hurtbox layer,
## so a sweep, a slam or a stone that would have hit you hits them if they are nearer. Their own
## cudgel lands on enemy hurtboxes like yours and never on you. Presentation reuses the Ashbound
## body ("companion" type: human skin, plain clothes) and the shared clip library. The companion
## is always drawn: you know where your friend is.

signal downed(companion: Companion)
signal died(companion: Companion)
signal revived(companion: Companion)

enum Mode { FOLLOW, HOLD }
enum State { IDLE, MOVE, ATTACK_STARTUP, ATTACK_ACTIVE, ATTACK_RECOVERY, STAGGER, DOWNED, DEAD }

const MAX_HEALTH: float = 70.0
const MAX_POISE: float = 30.0
## Following: stands when nearer than NEAR, walks when further than FAR, runs when further than RUN_AT.
const FOLLOW_NEAR: float = 2.2
const FOLLOW_FAR: float = 3.4
const RUN_AT: float = 7.0
const WALK_SPEED: float = 3.6
const RUN_SPEED: float = 5.4
## Fights an enemy within ENGAGE of itself, but never strays further than LEASH from its anchor
## (the survivor when following, the held spot when holding).
const ENGAGE_RADIUS: float = 6.0
const LEASH: float = 8.0
const HOLD_LEASH: float = 4.0
const ATTACK_RANGE: float = 1.7
const CUDGEL_DAMAGE: float = 14.0
const CUDGEL_POISE: float = 12.0
const ATTACK_STARTUP: float = 0.45
const ATTACK_ACTIVE: float = 0.15
const ATTACK_RECOVERY: float = 0.8
const STAGGER_SECONDS: float = 0.6
const DOWNED_SECONDS: float = 25.0
const REVIVE_SECONDS: float = 3.0
const REVIVE_HEALTH_RATIO: float = 0.4
## Lost far behind (no pathfinding yet), it catches up by rejoining behind the survivor.
const REJOIN_DISTANCE: float = 14.0
const REJOIN_SECONDS: float = 4.0

@export var companion_name: String = "Edda"

var player_ref: PlayerController
var audio: ProceduralAudio
var mode: Mode = Mode.FOLLOW
var state: State = State.IDLE
var health: float = MAX_HEALTH
var poise_damage: float = 0.0
var hold_spot: Vector3 = Vector3.ZERO
var downed_left: float = 0.0

var _state_timer: float = 0.0
var _facing_dir: Vector3 = Vector3.FORWARD
var _knockback_vel: Vector3 = Vector3.ZERO
var _away_timer: float = 0.0
var _target: Node3D
var _visual_root: Node3D
var _model: EnemyModel
var _anim_state: int = -1
var _ring_mat: StandardMaterial3D
var _hitbox: HitboxComponent
var _hurtbox: HurtboxComponent
var _revive_point: ActionPoint


func _ready() -> void:
	_build_body()
	hold_spot = global_position


func _physics_process(delta: float) -> void:
	if state == State.DEAD:
		return
	_knockback_vel = _knockback_vel.move_toward(Vector3.ZERO, 14.0 * delta)
	if poise_damage > 0.0:
		poise_damage = maxf(0.0, poise_damage - 6.0 * delta)
	if state == State.DOWNED:
		downed_left -= delta
		velocity = Vector3(_knockback_vel.x, velocity.y, _knockback_vel.z)
		if downed_left <= 0.0:
			_die()
	else:
		_think(delta)
	_update_presentation()
	if not is_on_floor():
		velocity.y -= 24.0 * delta
	else:
		velocity.y = -0.1
	move_and_slide()


## Where it wants to be when nothing needs hitting.
func anchor() -> Vector3:
	if mode == Mode.HOLD or player_ref == null:
		return hold_spot
	return player_ref.global_position


func toggle_mode() -> void:
	set_mode(Mode.HOLD if mode == Mode.FOLLOW else Mode.FOLLOW)


func set_mode(m: Mode) -> void:
	mode = m
	if m == Mode.HOLD:
		hold_spot = global_position


func is_dead() -> bool:
	return state == State.DEAD


func is_staggered() -> bool:
	return state in [State.STAGGER, State.DOWNED]


func is_downed() -> bool:
	return state == State.DOWNED


func _think(delta: float) -> void:
	match state:
		State.ATTACK_STARTUP:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if is_instance_valid(_target):
				_face_toward(_target.global_position, 5.0, delta)
			if _state_timer <= 0.0:
				_enter_attack_active()
			return
		State.ATTACK_ACTIVE:
			_state_timer -= delta
			velocity.x = _facing_dir.x * 2.5 + _knockback_vel.x
			velocity.z = _facing_dir.z * 2.5 + _knockback_vel.z
			if _state_timer <= 0.0:
				_hitbox.end_swing()
				state = State.ATTACK_RECOVERY
				_state_timer = ATTACK_RECOVERY
			return
		State.ATTACK_RECOVERY, State.STAGGER:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _state_timer <= 0.0:
				state = State.IDLE
			return

	# Idle or moving: fight what is near, else keep station.
	_target = _pick_target()
	if _target != null:
		var to_t: Vector3 = _target.global_position - global_position
		to_t.y = 0.0
		if to_t.length() <= ATTACK_RANGE:
			_begin_attack()
		else:
			_steer(to_t.normalized(), RUN_SPEED if to_t.length() > 4.0 else WALK_SPEED, delta)
			state = State.MOVE
		return

	var to_a: Vector3 = anchor() - global_position
	to_a.y = 0.0
	var dist: float = to_a.length()
	var stop_at: float = FOLLOW_NEAR if mode == Mode.FOLLOW else 0.4
	var go_at: float = FOLLOW_FAR if mode == Mode.FOLLOW else 0.8
	if state == State.MOVE and dist > stop_at or state != State.MOVE and dist > go_at:
		_steer(to_a.normalized(), RUN_SPEED if dist > RUN_AT else WALK_SPEED, delta)
		state = State.MOVE
	else:
		velocity.x = _knockback_vel.x
		velocity.z = _knockback_vel.z
		state = State.IDLE
		if mode == Mode.FOLLOW and player_ref != null:
			_face_toward(global_position + player_ref.get_aim_direction(), 3.0, delta)

	# Left far behind with no way round: rejoin behind the survivor.
	if mode == Mode.FOLLOW and player_ref != null and dist > REJOIN_DISTANCE:
		_away_timer += delta
		if _away_timer >= REJOIN_SECONDS:
			_away_timer = 0.0
			rejoin()
	else:
		_away_timer = 0.0


## Puts the companion a pace and a half behind the survivor.
func rejoin() -> void:
	if player_ref == null:
		return
	global_position = player_ref.global_position - player_ref.get_aim_direction() * 1.5
	velocity = Vector3.ZERO


## The nearest living enemy within ENGAGE of the companion and within its leash of the anchor.
func _pick_target() -> Node3D:
	var best: Node3D = null
	var best_d: float = INF
	var leash: float = HOLD_LEASH if mode == Mode.HOLD else LEASH
	for n: Node in get_parent().get_children():
		if n == self or n is PlayerController or n is Companion or not (n is CharacterBody3D):
			continue
		if not n.has_method("is_dead") or not n.has_method("is_staggered"):
			continue
		# Dead, or frozen out of the simulation (a process-disabled enemy has no physics to hit).
		if bool(n.call("is_dead")) or not n.can_process():
			continue
		var e := n as Node3D
		var d: float = global_position.distance_to(e.global_position)
		if d <= ENGAGE_RADIUS and e.global_position.distance_to(anchor()) <= leash and d < best_d:
			best_d = d
			best = e
	return best


func _begin_attack() -> void:
	state = State.ATTACK_STARTUP
	_state_timer = ATTACK_STARTUP
	velocity.x = 0.0
	velocity.z = 0.0


func _enter_attack_active() -> void:
	state = State.ATTACK_ACTIVE
	_state_timer = ATTACK_ACTIVE
	if audio:
		audio.play_swing()
	_hitbox.begin_swing(CombatPayload.new(self, global_position, _facing_dir, CUDGEL_DAMAGE, CUDGEL_POISE, false, false, 2.0))


func _steer(dir: Vector3, speed: float, delta: float) -> void:
	_face_toward(global_position + dir, 9.0, delta)
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
	if state in [State.DEAD, State.DOWNED]:
		return
	health = maxf(0.0, health - payload.physical_damage)
	poise_damage += payload.poise_damage
	var away: Vector3 = global_position - payload.attacker_origin
	away.y = 0.0
	if away.length_squared() > 0.01:
		_knockback_vel = away.normalized() * payload.knockback_force
	if audio:
		audio.play_flesh_hit()
	if health <= 0.0:
		_go_down()
		return
	if poise_damage >= MAX_POISE or payload.is_heavy:
		poise_damage = 0.0
		_hitbox.end_swing()
		state = State.STAGGER
		_state_timer = STAGGER_SECONDS


func _go_down() -> void:
	_hitbox.end_swing()
	state = State.DOWNED
	downed_left = DOWNED_SECONDS
	_target = null
	collision_layer = 0
	_hurtbox.set_deferred("monitorable", false)
	_model.play(&"Death01")
	_anim_state = State.DOWNED
	_revive_point = ActionPoint.make("%s (downed)" % companion_name, "Lift", "Lifting", REVIVE_SECONDS, 2.0, _on_revive_attempt)
	add_child(_revive_point)
	downed.emit(self)


## The survivor's lift: needs a clean rag to bind the wounds; without one, nothing happens.
func _on_revive_attempt(by: Node3D) -> void:
	var p := by as PlayerController
	if p == null or state != State.DOWNED:
		return
	if not p.inventory.consume("clean_rag_bandage", 1):
		p.combat_banner_message.emit("You need a clean rag to bind %s's wounds" % companion_name, Color(0.75, 0.68, 0.52))
		return
	p.inventory.notify_changed()
	health = MAX_HEALTH * REVIVE_HEALTH_RATIO
	poise_damage = 0.0
	state = State.IDLE
	collision_layer = 2
	_hurtbox.set_deferred("monitorable", true)
	if is_instance_valid(_revive_point):
		_revive_point.queue_free()
	_revive_point = null
	_anim_state = -1
	p.combat_banner_message.emit("%s is on their feet" % companion_name, Color(0.75, 0.82, 0.68))
	revived.emit(self)


func _die() -> void:
	state = State.DEAD
	if is_instance_valid(_revive_point):
		_revive_point.queue_free()
	_revive_point = null
	var loot: Array[ItemInstance] = [ItemDatabase.make("clean_rag_bandage", 1)]
	Lootable.attach_corpse(self, "%s's body" % companion_name, loot, 2.0)
	died.emit(self)


func _update_presentation() -> void:
	match state:
		State.ATTACK_STARTUP:
			_ring_mat.albedo_color = Color(0.85, 0.70, 0.35)
		State.ATTACK_ACTIVE:
			_ring_mat.albedo_color = Color(0.92, 0.55, 0.25)
		State.DOWNED:
			_ring_mat.albedo_color = Color(0.70, 0.25, 0.20)
		_:
			_ring_mat.albedo_color = Color(0.46, 0.58, 0.70) if mode == Mode.FOLLOW else Color(0.52, 0.52, 0.62)
	if _model == null or state in [State.DEAD, State.DOWNED]:
		return
	if state != _anim_state:
		_anim_state = state
		match state:
			State.ATTACK_STARTUP:
				_model.play_strike(&"Sword_Regular_B", _state_timer)
			State.STAGGER:
				_model.play_fitted(&"Hit_Knockback", maxf(_state_timer, 0.3))
	if state in [State.ATTACK_STARTUP, State.ATTACK_ACTIVE, State.ATTACK_RECOVERY, State.STAGGER]:
		return
	var speed: float = Vector2(velocity.x, velocity.z).length()
	if speed < 0.2:
		_model.play(&"Idle")
	elif speed < 4.2:
		_model.play(&"Walk", clampf(speed / 1.6, 0.6, 1.6))
	else:
		_model.play(&"Jog_Fwd", clampf(speed / 3.8, 0.6, 1.6))


func _build_body() -> void:
	name = "Companion"
	collision_layer = 2
	collision_mask = 1 | 2 | 4 | 64
	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.34
	cap.height = 1.72
	col.shape = cap
	col.position = Vector3(0.0, 0.86, 0.0)
	add_child(col)

	_visual_root = Node3D.new()
	add_child(_visual_root)
	_model = EnemyModel.new("companion")
	_visual_root.add_child(_model)

	var cudgel := MeshInstance3D.new()
	var c_mesh := CylinderMesh.new()
	c_mesh.top_radius = 0.045
	c_mesh.bottom_radius = 0.028
	c_mesh.height = 0.7
	cudgel.mesh = c_mesh
	var wood := StandardMaterial3D.new()
	wood.albedo_color = Color(0.3, 0.22, 0.15)
	wood.roughness = 0.9
	cudgel.material_override = wood
	cudgel.rotation_degrees.x = 90.0
	cudgel.position = Vector3(0.0, 0.0, -0.3)
	_model.right_socket.add_child(cudgel)

	_ring_mat = StandardMaterial3D.new()
	_ring_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_ring_mat.albedo_color = Color(0.46, 0.58, 0.70)
	var ring := MeshInstance3D.new()
	var r_mesh := CylinderMesh.new()
	r_mesh.top_radius = 0.42
	r_mesh.bottom_radius = 0.42
	r_mesh.height = 0.03
	ring.mesh = r_mesh
	ring.material_override = _ring_mat
	ring.position = Vector3(0.0, 0.03, 0.0)
	_visual_root.add_child(ring)

	_hitbox = HitboxComponent.new()
	_hitbox.owner_entity = self
	_hitbox.collision_layer = 0
	_hitbox.collision_mask = 16  # layer 5: enemy hurtboxes, never the survivor
	var hb_col := CollisionShape3D.new()
	var hb_box := BoxShape3D.new()
	hb_box.size = Vector3(1.2, 1.2, 1.4)
	hb_col.shape = hb_box
	hb_col.position = Vector3(0.0, 0.9, -0.8)
	_hitbox.add_child(hb_col)
	_visual_root.add_child(_hitbox)

	_hurtbox = HurtboxComponent.new()
	_hurtbox.owner_entity = self
	_hurtbox.collision_layer = 8  # layer 4, the survivor's hurtbox layer: enemy blows land on it
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
