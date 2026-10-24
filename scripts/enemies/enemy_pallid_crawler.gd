class_name EnemyPallidCrawler
extends CharacterBody3D
## Milestone 21: the Pallid Crawler. A long-limbed, eyeless white thing that
## lives under the Sunken Lane. By day it lies buried: unseen, unhittable.
## When night falls it digs out and hunts by scent: it always knows where
## the survivor is within `hunt_radius`. It hates light. It won't come
## within `light_radius` of a lit torch or the shelter fire; it circles at
## the edge of the light instead, and recoils if the light comes to it. In
## the dark it closes, hisses (the telegraph) and pounces: a raking leap that
## opens a wound. Then it scuttles back into the dark and comes again. At
## dawn it goes home and buries itself.

signal crawler_event_banner(text: String, col: Color)

enum AIState { BURROWED, EMERGE, STALK, POUNCE_STARTUP, POUNCE, RETREAT, RECOIL, BURROW, STAGGER, DEAD }

@export var enemy_name: String = "Pallid Crawler"
@export var max_health: float = 80.0
@export var max_poise: float = 25.0
@export var hunt_radius: float = 22.0
@export var light_radius: float = 5.0
@export var fire_light_radius: float = 5.5
@export var crawl_speed: float = 4.6
@export var pounce_range: float = 4.0
@export var pounce_speed: float = 9.0
@export var pounce_damage: float = 22.0
@export var emerge_darkness: float = 0.6
@export var burrow_darkness: float = 0.35

## It sees as well in the dark (it has no eyes to blind).
var night_eyed: bool = true
var health: float = 80.0
var poise_damage: float = 0.0
var state: AIState = AIState.BURROWED
var player_ref: PlayerController
var audio: ProceduralAudio
var coordinator: EncounterCoordinator

var _lair_pos: Vector3 = Vector3.ZERO
var _state_timer: float = 0.0
var _facing_dir: Vector3 = Vector3.FORWARD
var _pounce_dir: Vector3 = Vector3.FORWARD
var _orbit_sign: float = 1.0
var _knockback_vel: Vector3 = Vector3.ZERO
var _step_timer: float = 0.0
var _announced: bool = false

var _visual_root: Node3D
var _status_mat: StandardMaterial3D
var _pip: MeshInstance3D
var _hitbox: HitboxComponent
var _hurtbox: HurtboxComponent
var _body_shape: CollisionShape3D

func _ready() -> void:
	add_to_group("enemy")
	health = max_health
	_lair_pos = global_position
	_orbit_sign = 1.0 if randf() < 0.5 else -1.0
	_build_crawler_visuals_and_colliders()
	_set_buried(true)

func _physics_process(delta: float) -> void:
	if player_ref:
		_visual_root.visible = not is_buried() and player_ref.can_see_body(self)
	if state == AIState.DEAD:
		return
	_knockback_vel = _knockback_vel.move_toward(Vector3.ZERO, 14.0 * delta)
	if poise_damage > 0.0:
		poise_damage = maxf(0.0, poise_damage - 4.0 * delta)
	_process_ai_state(delta)
	_update_visual_telegraph()
	if is_buried():
		return
	if not is_on_floor():
		velocity.y -= 24.0 * delta
	else:
		velocity.y = -0.1
	move_and_slide()
	# It skitters almost silently.
	_step_timer = AcousticField.step_cadence(self, _step_timer, delta, 0.25, 1.5)

func is_dead() -> bool:
	return state == AIState.DEAD

func is_staggered() -> bool:
	return state in [AIState.STAGGER, AIState.RECOIL]

func is_buried() -> bool:
	return state == AIState.BURROWED

func _set_buried(buried: bool) -> void:
	collision_layer = 0 if buried else 4
	if _hurtbox:
		_hurtbox.set_deferred("monitorable", not buried)
	_body_shape.set_deferred("disabled", buried)

# ------------------------------------------------------------------------------
# Light
# ------------------------------------------------------------------------------
func _player_alive() -> bool:
	return player_ref != null and player_ref.current_state != PlayerController.ActionState.DEAD

func _flat(v: Vector3) -> Vector3:
	return Vector3(v.x, 0.0, v.z)

func _flat_dist(a: Vector3, b: Vector3) -> float:
	return Vector2(a.x - b.x, a.z - b.z).length()

## The nearest light that reaches `pos`, as [centre, radius], or [] for none.
## Lights are the survivor's lit torch and every heat source (the shelter fire).
func light_at(pos: Vector3) -> Array:
	var best: Array = []
	var best_d: float = INF
	if _player_alive() and player_ref.is_torch_lit():
		var d: float = _flat_dist(pos, player_ref.global_position)
		if d <= light_radius:
			best = [player_ref.global_position, light_radius]
			best_d = d
	if is_inside_tree():
		for n: Node in get_tree().get_nodes_in_group("heat_source"):
			var h := n as Node3D
			if h == null:
				continue
			var d: float = _flat_dist(pos, h.global_position)
			if d <= fire_light_radius and d < best_d:
				best = [h.global_position, fire_light_radius]
				best_d = d
	return best

func is_lit(pos: Vector3) -> bool:
	return not light_at(pos).is_empty()

func _night() -> bool:
	return DayNightCycle.darkness(self) >= emerge_darkness

func _dawn() -> bool:
	return DayNightCycle.darkness(self) <= burrow_darkness

# ------------------------------------------------------------------------------
# AI
# ------------------------------------------------------------------------------
func _process_ai_state(delta: float) -> void:
	match state:
		AIState.BURROWED:
			velocity = Vector3.ZERO
			if _night():
				state = AIState.EMERGE
				_state_timer = 1.0
				_set_buried(false)
				AcousticField.report(self, global_position, 6.0, "burst")

		AIState.EMERGE:
			_state_timer -= delta
			velocity.x = 0.0
			velocity.z = 0.0
			if _state_timer <= 0.0:
				state = AIState.STALK

		AIState.STALK:
			if _dawn():
				state = AIState.BURROW
				return
			var light: Array = light_at(global_position)
			if not light.is_empty():
				_recoil_from(light[0])
				return
			if not _player_alive() or _flat_dist(player_ref.global_position, global_position) > hunt_radius:
				_go_toward(_lair_pos, crawl_speed * 0.5, delta)
				return
			if not _announced:
				_announced = true
				crawler_event_banner.emit("Something pale is crawling toward you in the dark…", Color(0.82, 0.84, 0.88))
			var to_p: Vector3 = _flat(player_ref.global_position - global_position)
			var d: float = to_p.length()
			var player_light: Array = light_at(player_ref.global_position)
			if not player_light.is_empty():
				# Circle just outside the light.
				var centre: Vector3 = player_light[0]
				var edge: float = float(player_light[1]) + 1.5
				var from_c: Vector3 = _flat(global_position - centre)
				if from_c.length_squared() < 0.01:
					from_c = Vector3.RIGHT
				var tangent: Vector3 = from_c.normalized().cross(Vector3.UP) * _orbit_sign
				var radial: float = clampf(edge - from_c.length(), -1.0, 1.0)
				_steer_toward((tangent + from_c.normalized() * radial).normalized(), crawl_speed * 0.6, delta)
				return
			if d <= pounce_range:
				if coordinator == null or coordinator.request_attack_token(self, true):
					state = AIState.POUNCE_STARTUP
					_state_timer = 0.5
					if audio:
						audio.play_cough()
					AcousticField.report(self, global_position, 7.0, "hiss")
					return
			_steer_toward(to_p / maxf(d, 0.01), crawl_speed, delta)

		AIState.POUNCE_STARTUP:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _player_alive():
				# Light on it now and it thinks better of it.
				var light: Array = light_at(global_position)
				if not light.is_empty():
					_release_token()
					_recoil_from(light[0])
					return
				var aim: Vector3 = _flat(player_ref.global_position - global_position)
				if aim.length_squared() > 0.01:
					_face_direction(aim.normalized(), 8.0, delta)
			if _state_timer <= 0.0:
				_begin_pounce()

		AIState.POUNCE:
			_state_timer -= delta
			velocity.x = _pounce_dir.x * pounce_speed
			velocity.z = _pounce_dir.z * pounce_speed
			if _state_timer <= 0.0:
				_hitbox.end_swing()
				_release_token()
				_retreat()

		AIState.RETREAT, AIState.RECOIL:
			_state_timer -= delta
			if _player_alive():
				var away: Vector3 = _flat(global_position - player_ref.global_position)
				if away.length_squared() > 0.01:
					_steer_toward(away.normalized(), crawl_speed * (1.1 if state == AIState.RECOIL else 0.9), delta)
			if _state_timer <= 0.0:
				state = AIState.STALK

		AIState.STAGGER:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _state_timer <= 0.0:
				_retreat()

		AIState.BURROW:
			if _flat_dist(global_position, _lair_pos) > 0.6:
				_go_toward(_lair_pos, crawl_speed * 0.8, delta)
				return
			state = AIState.BURROWED
			_announced = false
			velocity = Vector3.ZERO
			_set_buried(true)

func _go_toward(pos: Vector3, speed: float, delta: float) -> void:
	var to: Vector3 = _flat(pos - global_position)
	if to.length() < 0.4:
		velocity.x = 0.0
		velocity.z = 0.0
		return
	_steer_toward(to.normalized(), speed, delta)

func _recoil_from(centre: Vector3) -> void:
	_hitbox.end_swing()
	state = AIState.RECOIL
	_state_timer = 1.5
	var away: Vector3 = _flat(global_position - centre)
	if away.length_squared() > 0.01:
		_face_direction(-away.normalized(), 50.0, 1.0)

func _begin_pounce() -> void:
	state = AIState.POUNCE
	_state_timer = 0.35
	_pounce_dir = _facing_dir
	_hitbox.begin_swing(CombatPayload.new(self, global_position, _pounce_dir, pounce_damage, 20.0, true, false, 3.0))

func _retreat() -> void:
	state = AIState.RETREAT
	_state_timer = 2.5

func _release_token() -> void:
	if coordinator:
		coordinator.release_attack_token(self)

func _steer_toward(dir: Vector3, speed: float, delta: float) -> void:
	_face_direction(dir, 9.0, delta)
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
## Loading a save: it died above ground. A fresh crawler boots buried (and a
## buried one ignores hits), so dig it out first.
func restore_dead() -> void:
	if state == AIState.DEAD:
		return
	state = AIState.STALK
	_set_buried(false)
	_on_hurtbox_hit_received(CombatPayload.new(self, global_position, Vector3.FORWARD, 1e9, 0.0))

func _on_hurtbox_hit_received(payload: CombatPayload) -> void:
	if state in [AIState.DEAD, AIState.BURROWED]:
		return
	health = maxf(0.0, health - payload.physical_damage)
	if health <= 0.0:
		_hitbox.end_swing()
		_release_token()
		state = AIState.DEAD
		collision_layer = 0
		_hurtbox.set_deferred("monitorable", false)
		_visual_root.rotation_degrees.z = 160.0 # on its back, limbs curled
		_visual_root.position.y = 0.3
		Lootable.attach_corpse(self, "%s Husk" % enemy_name, ItemDatabase.roll_crawler_loot(), 2.5)
		return
	poise_damage += payload.poise_damage
	_hitbox.end_swing()
	_release_token()
	if poise_damage >= max_poise:
		poise_damage = 0.0
		state = AIState.STAGGER
		_state_timer = 0.8
		return
	_retreat() # wounded, it slips back into the dark

# ------------------------------------------------------------------------------
# Visuals (placeholder; see docs/VISUAL_DIRECTION.md, sheet 12: pallid crawling horror)
# ------------------------------------------------------------------------------
func _update_visual_telegraph() -> void:
	match state:
		AIState.POUNCE_STARTUP:
			_visual_root.rotation_degrees.x = 18.0 # rears to spring
			_status_mat.albedo_color = Color(0.95, 0.60, 0.15)
		AIState.POUNCE:
			_visual_root.rotation_degrees.x = -10.0
			_status_mat.albedo_color = Color(0.92, 0.18, 0.15)
		AIState.RECOIL:
			_visual_root.rotation_degrees.x = 25.0 # flinching from the light
			_status_mat.albedo_color = Color(0.95, 0.85, 0.55)
		AIState.EMERGE:
			_visual_root.rotation_degrees.x = -20.0
			_status_mat.albedo_color = Color(0.55, 0.50, 0.45)
		_:
			_visual_root.rotation_degrees.x = 0.0
			_status_mat.albedo_color = Color(0.70, 0.70, 0.74)
	# Keep the status ring flat on the ground while the body tilts.
	_pip.rotation_degrees.x = -_visual_root.rotation_degrees.x


func _build_crawler_visuals_and_colliders() -> void:
	collision_mask = 1 | 2 | 4
	_body_shape = CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.4
	cap.height = 1.2
	_body_shape.shape = cap
	_body_shape.position = Vector3(0.0, 0.45, 0.0)
	add_child(_body_shape)

	_visual_root = Node3D.new()
	add_child(_visual_root)
	var skin := StandardMaterial3D.new()
	skin.albedo_color = Color(0.80, 0.79, 0.76) # bloodless, cave-white
	skin.roughness = 0.5
	var body := MeshInstance3D.new()
	var b_mesh := CapsuleMesh.new()
	b_mesh.radius = 0.25
	b_mesh.height = 1.4
	body.mesh = b_mesh
	body.material_override = skin
	body.rotation_degrees.x = 90.0 # low to the ground
	body.position = Vector3(0.0, 0.4, 0.0)
	_visual_root.add_child(body)
	var head := MeshInstance3D.new()
	var h_mesh := SphereMesh.new()
	h_mesh.radius = 0.2
	h_mesh.height = 0.34
	head.mesh = h_mesh
	head.material_override = skin
	head.position = Vector3(0.0, 0.45, -0.8)
	_visual_root.add_child(head)
	for i in range(4):
		var side: float = -1.0 if i % 2 == 0 else 1.0
		var fore: bool = i < 2
		var limb := MeshInstance3D.new()
		var l_mesh := CapsuleMesh.new()
		l_mesh.radius = 0.05
		l_mesh.height = 1.0
		limb.mesh = l_mesh
		limb.material_override = skin
		limb.position = Vector3(0.45 * side, 0.35, -0.45 if fore else 0.4)
		limb.rotation_degrees = Vector3(0.0, 0.0, 60.0 * side) # splayed, spider-like
		_visual_root.add_child(limb)

	_status_mat = StandardMaterial3D.new()
	_status_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_status_mat.albedo_color = Color(0.70, 0.70, 0.74)
	var pip := MeshInstance3D.new()
	var pip_mesh := CylinderMesh.new()
	pip_mesh.top_radius = 0.6
	pip_mesh.bottom_radius = 0.6
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
	hb_box.size = Vector3(1.1, 1.0, 1.2)
	hb_col.shape = hb_box
	hb_col.position = Vector3(0.0, 0.6, -0.9)
	_hitbox.add_child(hb_col)
	_visual_root.add_child(_hitbox)

	_hurtbox = HurtboxComponent.new()
	_hurtbox.owner_entity = self
	_hurtbox.collision_layer = 16
	_hurtbox.collision_mask = 0
	var hurt_col := CollisionShape3D.new()
	var hurt_cap := CapsuleShape3D.new()
	hurt_cap.radius = 0.45
	hurt_cap.height = 1.4
	hurt_col.shape = hurt_cap
	hurt_col.rotation_degrees.x = 90.0
	hurt_col.position = Vector3(0.0, 0.45, 0.0)
	_hurtbox.add_child(hurt_col)
	add_child(_hurtbox)
	_hurtbox.hit_received.connect(_on_hurtbox_hit_received)
