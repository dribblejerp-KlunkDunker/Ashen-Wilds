class_name EnemyBogBull
extends CharacterBody3D
## Milestone 20: the Bog-Bull. A horned grazer in the Grey Pasture. It
## ignores you until you come within `alert_radius` where it can see you,
## or it hears you nearby. Then it snorts, paws the ground (the telegraph)
## and charges in a straight line it can't steer. Step aside and it
## thunders past; a hit tramples you for heavy damage and knockback. A
## charge that ends in a wall or standing stone stuns it, and a stunned
## bull counts as staggered, so heavy blows can lodge.

signal bull_event_banner(text: String, col: Color)

enum AIState { GRAZE, ALERT, PAW, CHARGE, OVERRUN, RECOVER, STUNNED, RETURN, STAGGER, DEAD }

@export var enemy_name: String = "Bog-Bull"
@export var max_health: float = 170.0
@export var max_poise: float = 60.0
@export var alert_radius: float = 10.0
@export var hearing_radius: float = 14.0
@export var leash_radius: float = 20.0
@export var charge_speed: float = 9.0
@export var charge_time: float = 1.4
@export var paw_time: float = 1.1
@export var stun_time: float = 2.6
@export var trample_damage: float = 38.0
@export var trample_knockback: float = 7.0

var health: float = 170.0
var poise_damage: float = 0.0
var state: AIState = AIState.GRAZE
var player_ref: PlayerController
var audio: ProceduralAudio
var coordinator: EncounterCoordinator

var _pasture_pos: Vector3 = Vector3.ZERO
var _graze_target: Vector3 = Vector3.ZERO
var _state_timer: float = 0.0
var _facing_dir: Vector3 = Vector3.FORWARD
var _charge_dir: Vector3 = Vector3.FORWARD
var _knockback_vel: Vector3 = Vector3.ZERO
var _step_timer: float = 0.0

var _visual_root: Node3D
var _status_mat: StandardMaterial3D
var _pip: MeshInstance3D
var _hitbox: HitboxComponent
var _hurtbox: HurtboxComponent

func _ready() -> void:
	add_to_group("enemy")
	health = max_health
	_pasture_pos = global_position
	_graze_target = global_position
	_build_bull_visuals_and_colliders()
	AcousticField.listen(self, _on_noise_heard)

func _physics_process(delta: float) -> void:
	if player_ref:
		_visual_root.visible = player_ref.can_see_body(self)
	if state == AIState.DEAD:
		return
	_knockback_vel = _knockback_vel.move_toward(Vector3.ZERO, 14.0 * delta)
	if poise_damage > 0.0:
		poise_damage = maxf(0.0, poise_damage - 5.0 * delta)
	_process_ai_state(delta)
	_update_visual_telegraph()
	if not is_on_floor():
		velocity.y -= 24.0 * delta
	else:
		velocity.y = -0.1
	move_and_slide()
	_step_timer = AcousticField.step_cadence(self, _step_timer, delta, 0.35 if state == AIState.CHARGE else 0.6, 11.0 if state == AIState.CHARGE else 5.0)

func is_dead() -> bool:
	return state == AIState.DEAD

func is_staggered() -> bool:
	return state in [AIState.STUNNED, AIState.STAGGER]

func is_charging() -> bool:
	return state == AIState.CHARGE

# ------------------------------------------------------------------------------
# Senses
# ------------------------------------------------------------------------------
func _player_alive() -> bool:
	return player_ref != null and player_ref.current_state != PlayerController.ActionState.DEAD

func _flat(v: Vector3) -> Vector3:
	return Vector3(v.x, 0.0, v.z)

func sees_player() -> bool:
	if not _player_alive():
		return false
	var to_p: Vector3 = _flat(player_ref.global_position - global_position)
	if to_p.length() > alert_radius * WeatherSystem.factor(self, "sight"):
		return false
	var q := PhysicsRayQueryParameters3D.create(
		global_position + Vector3(0.0, 1.2, 0.0), player_ref.global_position + Vector3(0.0, 1.1, 0.0), 1
	)
	return get_world_3d().direct_space_state.intersect_ray(q).is_empty()

func _on_noise_heard(world_pos: Vector3, reach: float, source: Node3D, _kind: String) -> void:
	if state != AIState.GRAZE or not (source is PlayerController) or not is_inside_tree():
		return
	if _flat(world_pos - global_position).length() <= hearing_radius and AcousticField.can_hear(self, world_pos, reach):
		alert()

## Snorts and turns to face the survivor; the charge follows.
func alert() -> void:
	if state not in [AIState.GRAZE, AIState.RETURN, AIState.RECOVER]:
		return
	state = AIState.ALERT
	_state_timer = 0.5
	if audio:
		audio.play_ogre_roar()
	AcousticField.report(self, global_position, 12.0, "roar")
	bull_event_banner.emit("A Bog-Bull lowers its horns…", Color(0.86, 0.58, 0.32))

# ------------------------------------------------------------------------------
# AI
# ------------------------------------------------------------------------------
func _process_ai_state(delta: float) -> void:
	match state:
		AIState.GRAZE:
			var to_g: Vector3 = _flat(_graze_target - global_position)
			if to_g.length() < 0.5:
				_graze_target = _pasture_pos + Vector3(randf_range(-4.0, 4.0), 0.0, randf_range(-4.0, 4.0))
				velocity.x = _knockback_vel.x
				velocity.z = _knockback_vel.z
			else:
				_steer_toward(to_g.normalized(), 0.9, delta)
			if sees_player():
				alert()

		AIState.ALERT:
			_state_timer -= delta
			_hold_and_face_player(delta, 6.0)
			if _state_timer <= 0.0:
				state = AIState.PAW
				_state_timer = paw_time

		AIState.PAW:
			_state_timer -= delta
			_hold_and_face_player(delta, 3.0)
			if _state_timer <= 0.0:
				_begin_charge()

		AIState.CHARGE:
			_state_timer -= delta
			velocity.x = _charge_dir.x * charge_speed + _knockback_vel.x
			velocity.z = _charge_dir.z * charge_speed + _knockback_vel.z
			if _wall_ahead():
				_hit_wall()
				return
			if _state_timer <= 0.0:
				state = AIState.OVERRUN
				_state_timer = 0.5

		AIState.OVERRUN:
			# Momentum carries it on, slowing.
			_state_timer -= delta
			var k: float = clampf(_state_timer / 0.5, 0.0, 1.0)
			velocity.x = _charge_dir.x * charge_speed * 0.5 * k
			velocity.z = _charge_dir.z * charge_speed * 0.5 * k
			if _wall_ahead():
				_hit_wall()
				return
			if _state_timer <= 0.0:
				_end_charge(1.4)

		AIState.RECOVER, AIState.STUNNED, AIState.STAGGER:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _state_timer <= 0.0:
				if _player_alive() and _flat(player_ref.global_position - _pasture_pos).length() <= leash_radius and sees_player():
					state = AIState.ALERT
					_state_timer = 0.3
				else:
					state = AIState.RETURN

		AIState.RETURN:
			var to_home: Vector3 = _flat(_pasture_pos - global_position)
			if to_home.length() < 1.0:
				state = AIState.GRAZE
			else:
				_steer_toward(to_home.normalized(), 2.0, delta)
			if sees_player() and _flat(player_ref.global_position - _pasture_pos).length() <= leash_radius:
				alert()

func _hold_and_face_player(delta: float, turn: float) -> void:
	velocity.x = _knockback_vel.x
	velocity.z = _knockback_vel.z
	if _player_alive():
		var aim: Vector3 = _flat(player_ref.global_position - global_position)
		if aim.length_squared() > 0.01:
			_face_direction(aim.normalized(), turn, delta)

## The charge locks its direction: wherever it faced when the pawing ended.
func _begin_charge() -> void:
	state = AIState.CHARGE
	_state_timer = charge_time
	_charge_dir = _facing_dir
	_visual_root.look_at(global_position + _charge_dir, Vector3.UP)
	if coordinator:
		coordinator.request_attack_token(self, true)
	# The horns gore whatever they meet: heavy, knocks you flat back.
	_hitbox.begin_swing(CombatPayload.new(self, global_position, _charge_dir, trample_damage, 45.0, false, true, trample_knockback))

func _wall_ahead() -> bool:
	var from: Vector3 = global_position + Vector3(0.0, 0.8, 0.0)
	var q := PhysicsRayQueryParameters3D.create(from, from + _charge_dir * 1.25, 1)
	return not get_world_3d().direct_space_state.intersect_ray(q).is_empty()

func _hit_wall() -> void:
	_end_charge(stun_time)
	state = AIState.STUNNED
	_knockback_vel = -_charge_dir * 2.5
	if audio:
		audio.play_ogre_ground_slam()
	AcousticField.report(self, global_position, 14.0, "thud")
	bull_event_banner.emit("The Bog-Bull slams into stone — it's stunned!", Color(0.70, 0.84, 0.95))

func _end_charge(recovery: float) -> void:
	_hitbox.end_swing()
	if coordinator:
		coordinator.release_attack_token(self)
	state = AIState.RECOVER
	_state_timer = recovery

func _steer_toward(dir: Vector3, speed: float, delta: float) -> void:
	_face_direction(dir, 4.0, delta)
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
func _on_hurtbox_hit_received(payload: CombatPayload) -> void:
	if state == AIState.DEAD:
		return
	health = maxf(0.0, health - payload.physical_damage)
	if health <= 0.0:
		_hitbox.end_swing()
		if coordinator:
			coordinator.release_attack_token(self)
		state = AIState.DEAD
		collision_layer = 0
		_hurtbox.set_deferred("monitorable", false)
		_visual_root.rotation_degrees.z = 80.0
		_visual_root.position.y = 0.4
		Lootable.attach_corpse(self, "%s Carcass" % enemy_name, ItemDatabase.roll_bull_loot(), 3.5)
		return
	# Nothing staggers a charging bull.
	if state != AIState.CHARGE:
		poise_damage += payload.poise_damage
		if poise_damage >= max_poise:
			poise_damage = 0.0
			# Staggered out of the overrun: the horns stop goring.
			_hitbox.end_swing()
			if coordinator:
				coordinator.release_attack_token(self)
			state = AIState.STAGGER
			_state_timer = 1.0
			return
	if state in [AIState.GRAZE, AIState.RETURN]:
		alert()

# ------------------------------------------------------------------------------
# Visuals (placeholder; see docs/VISUAL_DIRECTION.md, sheet 12: horned bog-bull)
# ------------------------------------------------------------------------------
func _update_visual_telegraph() -> void:
	match state:
		AIState.ALERT:
			_visual_root.rotation_degrees.x = 6.0 # head up
			_status_mat.albedo_color = Color(0.92, 0.72, 0.30)
		AIState.PAW:
			_visual_root.rotation_degrees.x = -10.0 # horns lowered
			_status_mat.albedo_color = Color(0.95, 0.50, 0.15)
		AIState.CHARGE, AIState.OVERRUN:
			_visual_root.rotation_degrees.x = -14.0
			_status_mat.albedo_color = Color(0.92, 0.18, 0.15)
		AIState.STUNNED, AIState.STAGGER, AIState.RECOVER:
			_visual_root.rotation_degrees.x = 0.0
			_status_mat.albedo_color = Color(0.42, 0.68, 0.85)
		_:
			_visual_root.rotation_degrees.x = 0.0
			_status_mat.albedo_color = Color(0.36, 0.30, 0.22)
	# Keep the status ring flat on the ground while the body tilts.
	_pip.rotation_degrees.x = -_visual_root.rotation_degrees.x

func _build_bull_visuals_and_colliders() -> void:
	collision_layer = 4
	collision_mask = 1 | 4
	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.6
	cap.height = 1.5
	col.shape = cap
	col.position = Vector3(0.0, 0.85, 0.0)
	add_child(col)

	_visual_root = Node3D.new()
	add_child(_visual_root)
	var hide_mat := StandardMaterial3D.new()
	hide_mat.albedo_color = Color(0.29, 0.24, 0.17) # wet, peat-brown hide
	hide_mat.roughness = 0.9
	var body := MeshInstance3D.new()
	var b_mesh := CapsuleMesh.new()
	b_mesh.radius = 0.58
	b_mesh.height = 2.1
	body.mesh = b_mesh
	body.material_override = hide_mat
	body.rotation_degrees.x = 90.0
	body.position = Vector3(0.0, 0.95, 0.15)
	_visual_root.add_child(body)
	var head := MeshInstance3D.new()
	var h_mesh := BoxMesh.new()
	h_mesh.size = Vector3(0.5, 0.48, 0.62)
	head.mesh = h_mesh
	head.material_override = hide_mat
	head.position = Vector3(0.0, 1.0, -1.1)
	_visual_root.add_child(head)
	var horn_mat := StandardMaterial3D.new()
	horn_mat.albedo_color = Color(0.70, 0.64, 0.52)
	for side: float in [-1.0, 1.0]:
		var horn := MeshInstance3D.new()
		var hm := CylinderMesh.new()
		hm.top_radius = 0.02
		hm.bottom_radius = 0.08
		hm.height = 0.7
		horn.mesh = hm
		horn.material_override = horn_mat
		horn.position = Vector3(0.42 * side, 1.25, -1.15)
		horn.rotation_degrees = Vector3(-40.0, 0.0, -65.0 * side)
		_visual_root.add_child(horn)
	for leg_pos: Vector3 in [Vector3(-0.32, 0.3, -0.7), Vector3(0.32, 0.3, -0.7), Vector3(-0.32, 0.3, 0.9), Vector3(0.32, 0.3, 0.9)]:
		var leg := MeshInstance3D.new()
		var lm := CylinderMesh.new()
		lm.top_radius = 0.1
		lm.bottom_radius = 0.08
		lm.height = 0.6
		leg.mesh = lm
		leg.material_override = hide_mat
		leg.position = leg_pos
		_visual_root.add_child(leg)

	_status_mat = StandardMaterial3D.new()
	_status_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_status_mat.albedo_color = Color(0.36, 0.30, 0.22)
	var pip := MeshInstance3D.new()
	var pip_mesh := CylinderMesh.new()
	pip_mesh.top_radius = 0.8
	pip_mesh.bottom_radius = 0.8
	pip_mesh.height = 0.03
	pip.mesh = pip_mesh
	pip.material_override = _status_mat
	pip.position = Vector3(0.0, 0.03, 0.0)
	_visual_root.add_child(pip)
	_pip = pip

	# Active only while charging: a box over the horns.
	_hitbox = HitboxComponent.new()
	_hitbox.owner_entity = self
	_hitbox.collision_layer = 0
	_hitbox.collision_mask = 8
	var hb_col := CollisionShape3D.new()
	var hb_box := BoxShape3D.new()
	hb_box.size = Vector3(1.5, 1.3, 1.2)
	hb_col.shape = hb_box
	hb_col.position = Vector3(0.0, 0.9, -1.3)
	_hitbox.add_child(hb_col)
	_visual_root.add_child(_hitbox)

	_hurtbox = HurtboxComponent.new()
	_hurtbox.owner_entity = self
	_hurtbox.collision_layer = 16
	_hurtbox.collision_mask = 0
	var hurt_col := CollisionShape3D.new()
	var hurt_cap := CapsuleShape3D.new()
	hurt_cap.radius = 0.7
	hurt_cap.height = 2.0
	hurt_col.shape = hurt_cap
	hurt_col.rotation_degrees.x = 90.0
	hurt_col.position = Vector3(0.0, 0.9, 0.0)
	_hurtbox.add_child(hurt_col)
	add_child(_hurtbox)
	_hurtbox.hit_received.connect(_on_hurtbox_hit_received)
