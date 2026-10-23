class_name EnemyBogBear
extends CharacterBody3D
## Milestone 16: the Bog Bear. Territorial: it charges anything that comes
## within `territory_radius` of its wallow (by scent, so it doesn't need to
## be facing you) and gives up past `leash_radius`. Mauls with a
## swipe-swipe-bite combo; the swipes are sweeps that clang off walls. It
## fears fire: a lit torch held toward it within reach makes it rear back,
## until it's wounded below half health and enraged.

signal bear_event_banner(text: String, col: Color)

enum AIState { IDLE, CHARGE, MAUL_STARTUP, MAUL_ACTIVE, MAUL_LINK, RECOVERY, REAR, RETURN, STAGGER, RECOIL, DEAD }

@export var enemy_name: String = "Bog Bear"
@export var max_health: float = 220.0
@export var max_poise: float = 70.0
@export var territory_radius: float = 11.0
@export var leash_radius: float = 18.0
@export var charge_speed: float = 5.2
@export var fire_fear_range: float = 4.5
@export var swipe_reach: float = 1.7
@export var swipe_arc_degrees: float = 100.0

var health: float = 220.0
var poise_damage: float = 0.0
var state: AIState = AIState.IDLE
var player_ref: PlayerController
var audio: ProceduralAudio
var coordinator: EncounterCoordinator

var _den_pos: Vector3 = Vector3.ZERO
var _state_timer: float = 0.0
var _fear_cooldown: float = 0.0
var _combo_step: int = 0
var _facing_dir: Vector3 = Vector3.FORWARD
var _knockback_vel: Vector3 = Vector3.ZERO
var _step_timer: float = 0.0

var _visual_root: Node3D
var _status_mat: StandardMaterial3D
var _hitbox: HitboxComponent
var _hurtbox: HurtboxComponent

func _ready() -> void:
	add_to_group("enemy")
	health = max_health
	_den_pos = global_position
	_build_bear_visuals_and_colliders()
	AcousticField.listen(self, _on_noise_heard)

func _physics_process(delta: float) -> void:
	if player_ref:
		_visual_root.visible = player_ref.can_see_body(self)
	if state == AIState.DEAD:
		return
	_knockback_vel = _knockback_vel.move_toward(Vector3.ZERO, 16.0 * delta)
	_fear_cooldown = maxf(0.0, _fear_cooldown - delta)
	if poise_damage > 0.0:
		poise_damage = maxf(0.0, poise_damage - 5.0 * delta)
	_process_ai_state(delta)
	_update_visual_telegraph()
	if not is_on_floor():
		velocity.y -= 24.0 * delta
	else:
		velocity.y = -0.1
	move_and_slide()
	_step_timer = AcousticField.step_cadence(self, _step_timer, delta, 0.4, 8.0)

func is_dead() -> bool:
	return state == AIState.DEAD

func is_staggered() -> bool:
	return state in [AIState.STAGGER, AIState.RECOIL]

func is_enraged() -> bool:
	return health < max_health * 0.5

# ------------------------------------------------------------------------------
# Territory, fire and noise
# ------------------------------------------------------------------------------
func _player_alive() -> bool:
	return player_ref != null and player_ref.current_state != PlayerController.ActionState.DEAD

func _flat_dist(a: Vector3, b: Vector3) -> float:
	return Vector2(a.x - b.x, a.z - b.z).length()

func player_in_territory() -> bool:
	return _player_alive() and _flat_dist(player_ref.global_position, _den_pos) <= territory_radius

## True when the survivor holds a lit torch toward it, close enough to scare it.
func is_threatened_by_fire() -> bool:
	if not _player_alive() or is_enraged() or not player_ref.is_torch_lit():
		return false
	var to_bear: Vector3 = global_position - player_ref.global_position
	to_bear.y = 0.0
	var d: float = to_bear.length()
	if d > fire_fear_range or d < 0.01:
		return false
	return player_ref.get_aim_direction().dot(to_bear / d) >= 0.5

func _on_noise_heard(world_pos: Vector3, reach: float, source: Node3D, _kind: String) -> void:
	if state != AIState.IDLE or not (source is PlayerController) or not is_inside_tree():
		return
	if _flat_dist(world_pos, _den_pos) <= leash_radius and AcousticField.can_hear(self, world_pos, reach):
		_begin_charge()

func _begin_charge() -> void:
	if state in [AIState.IDLE, AIState.RETURN]:
		state = AIState.CHARGE
		if audio:
			audio.play_ogre_roar()
		AcousticField.report(self, global_position, 14.0, "roar")
		bear_event_banner.emit("A Bog Bear charges out of its wallow!", Color(0.86, 0.50, 0.30))

# ------------------------------------------------------------------------------
# AI
# ------------------------------------------------------------------------------
func _process_ai_state(delta: float) -> void:
	match state:
		AIState.IDLE:
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if player_in_territory():
				_begin_charge()

		AIState.CHARGE:
			if not _player_alive() or _flat_dist(player_ref.global_position, _den_pos) > leash_radius:
				state = AIState.RETURN
				return
			if _fear_cooldown <= 0.0 and is_threatened_by_fire():
				_enter_rear()
				return
			var to_p: Vector3 = player_ref.global_position - global_position
			to_p.y = 0.0
			if to_p.length() <= 1.9:
				if coordinator == null or coordinator.request_attack_token(self, true):
					_combo_step = 0
					state = AIState.MAUL_STARTUP
					_state_timer = 0.55
					return
			_steer_toward(to_p.normalized(), charge_speed, delta)

		AIState.MAUL_STARTUP, AIState.MAUL_LINK:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _player_alive():
				var aim: Vector3 = player_ref.global_position - global_position
				aim.y = 0.0
				if aim.length_squared() > 0.01:
					_face_direction(aim.normalized(), 4.0, delta)
			if _state_timer <= 0.0:
				_enter_maul_active()

		AIState.MAUL_ACTIVE:
			_state_timer -= delta
			velocity.x = _facing_dir.x * 3.0 + _knockback_vel.x
			velocity.z = _facing_dir.z * 3.0 + _knockback_vel.z
			if _state_timer <= 0.0:
				_hitbox.end_swing()
				_combo_step += 1
				if _combo_step < 3:
					state = AIState.MAUL_LINK
					_state_timer = 0.22
				else:
					_end_attack(1.0)

		AIState.RECOVERY, AIState.STAGGER, AIState.RECOIL:
			_state_timer -= delta
			velocity.x = _knockback_vel.x
			velocity.z = _knockback_vel.z
			if _state_timer <= 0.0:
				state = AIState.CHARGE if player_in_territory() or (_player_alive() and _flat_dist(player_ref.global_position, _den_pos) <= leash_radius) else AIState.RETURN

		AIState.REAR:
			_state_timer -= delta
			if _player_alive():
				var away: Vector3 = global_position - player_ref.global_position
				away.y = 0.0
				if away.length_squared() > 0.01:
					velocity.x = away.normalized().x * 2.2 + _knockback_vel.x
					velocity.z = away.normalized().z * 2.2 + _knockback_vel.z
					_face_direction(-away.normalized(), 6.0, delta)
			if _state_timer <= 0.0:
				_fear_cooldown = 3.0
				state = AIState.CHARGE

		AIState.RETURN:
			var to_den: Vector3 = _den_pos - global_position
			to_den.y = 0.0
			if player_in_territory():
				_begin_charge()
				return
			if to_den.length() < 0.8:
				state = AIState.IDLE
			else:
				_steer_toward(to_den.normalized(), 2.4, delta)

func _enter_rear() -> void:
	state = AIState.REAR
	_state_timer = 1.5
	if audio:
		audio.play_ogre_roar()
	bear_event_banner.emit("The bear rears back from your torch!", Color(0.95, 0.66, 0.30))

func _enter_maul_active() -> void:
	var is_bite: bool = _combo_step == 2
	if not is_bite:
		var obstruction: Dictionary = SwingGeometry.sweep_obstruction(self, _facing_dir, swipe_arc_degrees, swipe_reach, 1.0)
		if not obstruction.is_empty():
			_enter_wall_recoil(obstruction)
			return
	state = AIState.MAUL_ACTIVE
	_state_timer = 0.14
	if audio:
		audio.play_swing()
	AcousticField.report(self, global_position, 8.0, "swing")
	var payload := CombatPayload.new(self, global_position, _facing_dir, 30.0 if is_bite else 20.0, 30.0 if is_bite else 18.0, is_bite, is_bite, 4.5 if is_bite else 3.0)
	_hitbox.begin_swing(payload)

func _enter_wall_recoil(hit: Dictionary) -> void:
	_hitbox.end_swing()
	if coordinator:
		coordinator.release_attack_token(self)
	state = AIState.RECOIL
	_state_timer = 0.8
	var normal: Vector3 = SwingGeometry.recoil_normal(hit, _facing_dir)
	_knockback_vel = normal * 1.8
	if audio:
		audio.play_wall_clang()
	AcousticField.report(self, global_position, 13.0, "clang")
	SwingGeometry.spawn_sparks(get_parent(), hit.get("position", global_position + _facing_dir), normal)

func _end_attack(recovery: float) -> void:
	_hitbox.end_swing()
	if coordinator:
		coordinator.release_attack_token(self)
	state = AIState.RECOVERY
	_state_timer = recovery

func _steer_toward(dir: Vector3, speed: float, delta: float) -> void:
	_face_direction(dir, 7.0, delta)
	velocity.x = dir.x * speed + _knockback_vel.x
	velocity.z = dir.z * speed + _knockback_vel.z

func _face_direction(dir: Vector3, turn_speed: float, delta: float) -> void:
	_facing_dir = _facing_dir.slerp(dir, 1.0 - exp(-turn_speed * delta)).normalized()
	_visual_root.look_at(global_position + _facing_dir, Vector3.UP)

# ------------------------------------------------------------------------------
# Taking hits
# ------------------------------------------------------------------------------
func _on_hurtbox_hit_received(payload: CombatPayload) -> void:
	if state == AIState.DEAD:
		return
	var was_enraged: bool = is_enraged()
	health = maxf(0.0, health - payload.physical_damage)
	poise_damage += payload.poise_damage
	if not was_enraged and is_enraged() and health > 0.0:
		bear_event_banner.emit("The Bog Bear is enraged — fire won't hold it back now", Color(0.92, 0.32, 0.22))
	if health <= 0.0:
		_hitbox.end_swing()
		if coordinator:
			coordinator.release_attack_token(self)
		state = AIState.DEAD
		collision_layer = 0
		_hurtbox.set_deferred("monitorable", false)
		_visual_root.rotation_degrees.z = 80.0
		_visual_root.position.y = 0.35
		Lootable.attach_corpse(self, "%s Carcass" % enemy_name, ItemDatabase.roll_bear_loot(), 3.5)
		return
	if poise_damage >= max_poise:
		_hitbox.end_swing()
		if coordinator:
			coordinator.release_attack_token(self)
		poise_damage = 0.0
		state = AIState.STAGGER
		_state_timer = 0.9
		return
	if state in [AIState.IDLE, AIState.RETURN]:
		_begin_charge()

# ------------------------------------------------------------------------------
# Visuals (placeholder; see docs/VISUAL_DIRECTION.md, sheet 12)
# ------------------------------------------------------------------------------
func _update_visual_telegraph() -> void:
	match state:
		AIState.MAUL_STARTUP, AIState.MAUL_LINK:
			_visual_root.rotation_degrees.x = 12.0 # rising up to strike
			_status_mat.albedo_color = Color(0.95, 0.60, 0.15)
		AIState.MAUL_ACTIVE:
			_visual_root.rotation_degrees.x = -8.0 # lunging down
			_status_mat.albedo_color = Color(0.92, 0.18, 0.15)
		AIState.REAR:
			_visual_root.rotation_degrees.x = 35.0 # up on its hind legs
			_status_mat.albedo_color = Color(0.95, 0.78, 0.35)
		AIState.RECOVERY, AIState.STAGGER, AIState.RECOIL:
			_visual_root.rotation_degrees.x = 0.0
			_status_mat.albedo_color = Color(0.42, 0.68, 0.85)
		_:
			_visual_root.rotation_degrees.x = 0.0
			_status_mat.albedo_color = Color(0.80, 0.30, 0.22) if is_enraged() else Color(0.40, 0.33, 0.24)

func _build_bear_visuals_and_colliders() -> void:
	collision_layer = 4
	collision_mask = 1 | 2 | 4
	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.6
	cap.height = 1.6
	col.shape = cap
	col.position = Vector3(0.0, 0.8, 0.0)
	add_child(col)

	_visual_root = Node3D.new()
	add_child(_visual_root)
	var fur := StandardMaterial3D.new()
	fur.albedo_color = Color(0.22, 0.24, 0.16) # bog-moss over dark fur
	fur.roughness = 0.97
	var body := MeshInstance3D.new()
	var b_mesh := CapsuleMesh.new()
	b_mesh.radius = 0.55
	b_mesh.height = 1.9
	body.mesh = b_mesh
	body.material_override = fur
	body.rotation_degrees.x = 90.0 # on all fours
	body.position = Vector3(0.0, 0.75, 0.1)
	_visual_root.add_child(body)
	var head := MeshInstance3D.new()
	var h_mesh := SphereMesh.new()
	h_mesh.radius = 0.32
	h_mesh.height = 0.55
	head.mesh = h_mesh
	head.material_override = fur
	head.position = Vector3(0.0, 0.95, -0.95)
	_visual_root.add_child(head)
	var snout_mat := StandardMaterial3D.new()
	snout_mat.albedo_color = Color(0.30, 0.22, 0.16)
	var snout := MeshInstance3D.new()
	var s_mesh := BoxMesh.new()
	s_mesh.size = Vector3(0.22, 0.2, 0.3)
	snout.mesh = s_mesh
	snout.material_override = snout_mat
	snout.position = Vector3(0.0, 0.88, -1.25)
	_visual_root.add_child(snout)

	_status_mat = StandardMaterial3D.new()
	_status_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_status_mat.albedo_color = Color(0.40, 0.33, 0.24)
	var pip := MeshInstance3D.new()
	var pip_mesh := CylinderMesh.new()
	pip_mesh.top_radius = 0.75
	pip_mesh.bottom_radius = 0.75
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
	hb_box.size = Vector3(1.6, 1.2, 1.6)
	hb_col.shape = hb_box
	hb_col.position = Vector3(0.0, 0.8, -1.3)
	_hitbox.add_child(hb_col)
	_visual_root.add_child(_hitbox)

	_hurtbox = HurtboxComponent.new()
	_hurtbox.owner_entity = self
	_hurtbox.collision_layer = 16
	_hurtbox.collision_mask = 0
	var hurt_col := CollisionShape3D.new()
	var hurt_cap := CapsuleShape3D.new()
	hurt_cap.radius = 0.7
	hurt_cap.height = 1.8
	hurt_col.shape = hurt_cap
	hurt_col.position = Vector3(0.0, 0.85, 0.0)
	_hurtbox.add_child(hurt_col)
	add_child(_hurtbox)
	_hurtbox.hit_received.connect(_on_hurtbox_hit_received)
