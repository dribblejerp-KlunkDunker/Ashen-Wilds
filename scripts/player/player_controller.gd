class_name PlayerController
extends CharacterBody3D

signal stats_changed(state_data: Dictionary)
signal combat_banner_message(text: String, color: Color)

enum ActionState {
	IDLE,
	MOVE,
	SPRINT,
	ATTACK_STARTUP,
	ATTACK_ACTIVE,
	ATTACK_RECOVERY,
	BLOCK,
	BLOCK_IMPACT,
	DODGE,
	STAGGER,
	DEAD
}

@export var move_speed: float = 4.2
@export var sprint_speed: float = 6.3
@export var block_move_speed: float = 2.1
@export var exhausted_speed_multiplier: float = 0.72
@export var rotation_speed: float = 16.0
@export var attack_commit_rotation_speed: float = 2.2

@export var max_health: float = 100.0
@export var max_stamina: float = 100.0
@export var stamina_regen_rate: float = 24.0
@export var stamina_regen_delay: float = 1.05
@export var exhausted_regen_delay: float = 1.85
@export var max_poise: float = 35.0
@export var poise_reset_time: float = 3.0

var health: float = 100.0
var stamina: float = 100.0
var poise_damage_taken: float = 0.0
var is_exhausted: bool = false
var is_bleeding: bool = false
var bleed_timer: float = 0.0

var current_state: ActionState = ActionState.IDLE
var weapon: WeaponData
var camera_rig: IsoCameraRig
var audio: ProceduralAudio

var _state_timer: float = 0.0
var _stamina_delay_timer: float = 0.0
var _poise_timer: float = 0.0
var _dodge_cooldown: float = 0.0
var _is_current_attack_heavy: bool = false
var _queued_light_attack: bool = false
var _aim_direction: Vector3 = Vector3.FORWARD
var _dodge_direction: Vector3 = Vector3.FORWARD
var _knockback_velocity: Vector3 = Vector3.ZERO

var _visual_root: Node3D
var _weapon_pivot: Node3D
var _shield_mesh: MeshInstance3D
var _aim_arc_mesh: MeshInstance3D
var _aim_arc_mat: StandardMaterial3D
var _hitbox: HitboxComponent
var _hurtbox: HurtboxComponent
var _torch_light: OmniLight3D

func _ready() -> void:
	if weapon == null:
		weapon = WeaponData.new()
	_build_survivor_visuals_and_colliders()
	_emit_stats()

func _physics_process(delta: float) -> void:
	if current_state == ActionState.DEAD:
		return

	_update_timers_and_conditions(delta)
	_update_mouse_aim(delta)
	_process_state_machine(delta)
	_update_visual_pose(delta)
	move_and_slide()
	_emit_stats()

func _update_timers_and_conditions(delta: float) -> void:
	if _dodge_cooldown > 0.0:
		_dodge_cooldown = maxf(0.0, _dodge_cooldown - delta)

	if _poise_timer > 0.0:
		_poise_timer = maxf(0.0, _poise_timer - delta)
		if _poise_timer == 0.0:
			poise_damage_taken = 0.0

	if is_bleeding:
		bleed_timer -= delta
		health = maxf(1.0, health - 1.8 * delta)
		if bleed_timer <= 0.0:
			is_bleeding = false
		if Input.is_key_pressed(KEY_B):
			is_bleeding = false
			combat_banner_message.emit("Applied Clean Rag Bandage — Bleeding Stopped", Color(0.75, 0.82, 0.68))

	if _stamina_delay_timer > 0.0:
		_stamina_delay_timer = maxf(0.0, _stamina_delay_timer - delta)
	elif current_state in [ActionState.IDLE, ActionState.MOVE, ActionState.BLOCK]:
		var rate: float = stamina_regen_rate * (0.38 if current_state == ActionState.BLOCK else 1.0)
		if is_bleeding:
			rate *= 0.75
		stamina = minf(max_stamina, stamina + rate * delta)
		if is_exhausted and stamina >= 18.0:
			is_exhausted = false

func _update_mouse_aim(delta: float) -> void:
	if camera_rig == null:
		return
	var mouse_world: Vector3 = camera_rig.get_mouse_ground_position(global_position.y)
	var to_mouse: Vector3 = mouse_world - global_position
	to_mouse.y = 0.0
	if to_mouse.length_squared() > 0.01:
		var desired_dir: Vector3 = to_mouse.normalized()
		var turn_rate: float = rotation_speed
		if current_state in [ActionState.ATTACK_STARTUP, ActionState.ATTACK_ACTIVE]:
			turn_rate = attack_commit_rotation_speed
		elif current_state in [ActionState.DODGE, ActionState.STAGGER]:
			turn_rate = 0.0
		if turn_rate > 0.0:
			_aim_direction = _aim_direction.slerp(desired_dir, 1.0 - exp(-turn_rate * delta)).normalized()
			_visual_root.look_at(global_position + _aim_direction, Vector3.UP)

func _get_isometric_move_vector() -> Vector3:
	var input_2d := Vector2.ZERO
	if Input.is_action_pressed("move_right"):
		input_2d.x += 1.0
	if Input.is_action_pressed("move_left"):
		input_2d.x -= 1.0
	if Input.is_action_pressed("move_down"):
		input_2d.y += 1.0
	if Input.is_action_pressed("move_up"):
		input_2d.y -= 1.0

	if input_2d.length_squared() < 0.01:
		return Vector3.ZERO
	input_2d = input_2d.normalized()

	var cam_yaw_rad: float = deg_to_rad(camera_rig.yaw_degrees if camera_rig else 45.0)
	var right_axis := Vector3(cos(cam_yaw_rad), 0.0, -sin(cam_yaw_rad))
	var down_axis := Vector3(sin(cam_yaw_rad), 0.0, cos(cam_yaw_rad))
	return (right_axis * input_2d.x + down_axis * input_2d.y).normalized()

func _process_state_machine(delta: float) -> void:
	var move_dir: Vector3 = _get_isometric_move_vector()
	_knockback_velocity = _knockback_velocity.move_toward(Vector3.ZERO, 14.0 * delta)

	match current_state:
		ActionState.IDLE, ActionState.MOVE, ActionState.SPRINT, ActionState.BLOCK:
			_handle_neutral_combat_inputs(move_dir)
			if current_state in [ActionState.IDLE, ActionState.MOVE, ActionState.SPRINT, ActionState.BLOCK]:
				_apply_locomotion(move_dir, delta)

		ActionState.ATTACK_STARTUP:
			_state_timer -= delta
			velocity = _aim_direction * 0.6 + _knockback_velocity
			var total_startup: float = weapon.heavy_startup_time if _is_current_attack_heavy else weapon.light_startup_time
			if _state_timer > (total_startup * 0.65) and Input.is_action_just_pressed("dodge"):
				if _try_start_dodge(move_dir):
					return
			if _state_timer <= 0.0:
				_enter_attack_active()

		ActionState.ATTACK_ACTIVE:
			_state_timer -= delta
			var impulse: float = weapon.heavy_step_impulse if _is_current_attack_heavy else weapon.light_step_impulse
			velocity = _aim_direction * impulse + _knockback_velocity
			if _state_timer <= 0.0:
				_enter_attack_recovery()

		ActionState.ATTACK_RECOVERY:
			_state_timer -= delta
			velocity = velocity.move_toward(Vector3.ZERO, 16.0 * delta) + _knockback_velocity
			var total_rec: float = weapon.heavy_recovery_time if _is_current_attack_heavy else weapon.light_recovery_time
			if _state_timer < (total_rec * 0.25) and Input.is_action_just_pressed("attack_light"):
				_queued_light_attack = true
			if _state_timer <= 0.0:
				if _queued_light_attack and not is_exhausted and stamina > 4.0:
					_queued_light_attack = false
					_start_attack(false)
				else:
					_queued_light_attack = false
					current_state = ActionState.IDLE

		ActionState.DODGE:
			_state_timer -= delta
			if _state_timer > 0.14:
				velocity = _dodge_direction * 8.2
			else:
				velocity = _dodge_direction * 2.0
			if _state_timer <= 0.0:
				current_state = ActionState.IDLE

		ActionState.BLOCK_IMPACT:
			_state_timer -= delta
			velocity = _knockback_velocity
			if _state_timer <= 0.0:
				current_state = ActionState.BLOCK if Input.is_action_pressed("block") else ActionState.IDLE

		ActionState.STAGGER:
			_state_timer -= delta
			velocity = _knockback_velocity
			if _state_timer <= 0.0:
				current_state = ActionState.IDLE

	if not is_on_floor():
		velocity.y -= 24.0 * delta
	else:
		velocity.y = -0.1

func _handle_neutral_combat_inputs(move_dir: Vector3) -> void:
	if Input.is_action_just_pressed("dodge"):
		if _try_start_dodge(move_dir):
			return

	var wants_heavy: bool = Input.is_action_just_pressed("attack_heavy") or (
		Input.is_action_just_pressed("attack_light") and Input.is_key_pressed(KEY_SHIFT)
	)
	if wants_heavy:
		_start_attack(true)
		return

	if Input.is_action_just_pressed("attack_light"):
		_start_attack(false)
		return

	if Input.is_action_pressed("block") and not is_exhausted:
		current_state = ActionState.BLOCK
	elif current_state == ActionState.BLOCK:
		current_state = ActionState.IDLE

func _apply_locomotion(move_dir: Vector3, delta: float) -> void:
	var exh_mult: float = exhausted_speed_multiplier if is_exhausted else 1.0
	if current_state == ActionState.BLOCK:
		velocity.x = move_dir.x * block_move_speed * exh_mult + _knockback_velocity.x
		velocity.z = move_dir.z * block_move_speed * exh_mult + _knockback_velocity.z
		return

	var wants_sprint: bool = Input.is_action_pressed("sprint") and move_dir.length_squared() > 0.1 and not is_exhausted
	if wants_sprint and stamina > 1.0:
		current_state = ActionState.SPRINT
		_consume_stamina(13.5 * delta)
		velocity.x = move_dir.x * sprint_speed + _knockback_velocity.x
		velocity.z = move_dir.z * sprint_speed + _knockback_velocity.z
	elif move_dir.length_squared() > 0.01:
		current_state = ActionState.MOVE
		velocity.x = move_dir.x * move_speed * exh_mult + _knockback_velocity.x
		velocity.z = move_dir.z * move_speed * exh_mult + _knockback_velocity.z
	else:
		current_state = ActionState.IDLE
		velocity.x = _knockback_velocity.x
		velocity.z = _knockback_velocity.z

func _start_attack(heavy: bool) -> void:
	if is_exhausted or stamina < 4.0:
		combat_banner_message.emit("Exhausted — Stamina Depleted", Color(0.85, 0.55, 0.25))
		return
	_is_current_attack_heavy = heavy
	var cost: float = weapon.heavy_stamina_cost if heavy else weapon.light_stamina_cost
	_consume_stamina(cost)
	current_state = ActionState.ATTACK_STARTUP
	_state_timer = weapon.heavy_startup_time if heavy else weapon.light_startup_time

func _enter_attack_active() -> void:
	current_state = ActionState.ATTACK_ACTIVE
	_state_timer = weapon.heavy_active_time if _is_current_attack_heavy else weapon.light_active_time
	if audio:
		audio.play_swing()

	var payload := CombatPayload.new(
		self,
		global_position,
		_aim_direction,
		weapon.heavy_damage if _is_current_attack_heavy else weapon.light_damage,
		weapon.heavy_poise_damage if _is_current_attack_heavy else weapon.light_poise_damage,
		_is_current_attack_heavy and (randf() <= weapon.heavy_bleed_chance),
		_is_current_attack_heavy,
		4.8 if _is_current_attack_heavy else 2.4
	)
	_hitbox.begin_swing(payload)

func _enter_attack_recovery() -> void:
	_hitbox.end_swing()
	current_state = ActionState.ATTACK_RECOVERY
	_state_timer = weapon.heavy_recovery_time if _is_current_attack_heavy else weapon.light_recovery_time

func _try_start_dodge(move_dir: Vector3) -> bool:
	if is_exhausted or stamina < 8.0 or _dodge_cooldown > 0.0:
		return false
	_hitbox.end_swing()
	_consume_stamina(22.0)
	_dodge_cooldown = 0.58
	_dodge_direction = move_dir if move_dir.length_squared() > 0.01 else -_aim_direction
	current_state = ActionState.DODGE
	_state_timer = 0.36
	return true

func _consume_stamina(amount: float) -> void:
	stamina = maxf(0.0, stamina - amount)
	if stamina <= 0.01:
		is_exhausted = true
		_stamina_delay_timer = exhausted_regen_delay
	else:
		_stamina_delay_timer = maxf(_stamina_delay_timer, stamina_regen_delay)

func _on_hurtbox_hit_received(payload: CombatPayload) -> void:
	if current_state == ActionState.DEAD:
		return
	if current_state == ActionState.DODGE and _state_timer > 0.16:
		combat_banner_message.emit("Evaded!", Color(0.75, 0.78, 0.82))
		return

	var to_attacker: Vector3 = (payload.attacker_origin - global_position)
	to_attacker.y = 0.0
	if to_attacker.length_squared() > 0.001:
		to_attacker = to_attacker.normalized()

	var facing_dot: float = _aim_direction.dot(to_attacker)
	var block_cos: float = cos(deg_to_rad(weapon.block_angle_degrees * 0.5))

	if current_state in [ActionState.BLOCK, ActionState.BLOCK_IMPACT] and facing_dot >= block_cos:
		var stam_cost: float = payload.poise_damage * weapon.block_stamina_efficiency
		_consume_stamina(stam_cost)
		_knockback_velocity = -to_attacker * (payload.knockback_force * 0.7)
		if is_exhausted:
			if audio:
				audio.play_guard_break()
			if camera_rig:
				camera_rig.add_trauma(0.65)
			current_state = ActionState.STAGGER
			_state_timer = 1.05
			combat_banner_message.emit("GUARD BROKEN!", Color(0.92, 0.32, 0.22))
		else:
			if audio:
				audio.play_shield_block()
			if camera_rig:
				camera_rig.add_trauma(0.28)
			current_state = ActionState.BLOCK_IMPACT
			_state_timer = 0.22
		return

	_hitbox.end_swing()
	health = maxf(0.0, health - payload.physical_damage)
	poise_damage_taken += payload.poise_damage
	_poise_timer = poise_reset_time
	_knockback_velocity = -to_attacker * payload.knockback_force

	if payload.causes_bleed:
		is_bleeding = true
		bleed_timer = 12.0
		combat_banner_message.emit("Deep Laceration — Bleeding (Press B to Bandage)", Color(0.88, 0.2, 0.2))

	if audio:
		audio.play_flesh_hit()
	if camera_rig:
		camera_rig.add_trauma(0.55 if payload.is_heavy else 0.35)

	if health <= 0.0:
		current_state = ActionState.DEAD
		combat_banner_message.emit("YOU PERISHED IN THE ASHEN WILDS — Press R to Respawn at Shelter", Color(0.9, 0.18, 0.18))
		return

	if poise_damage_taken >= max_poise or payload.is_heavy:
		poise_damage_taken = 0.0
		current_state = ActionState.STAGGER
		_state_timer = 0.62

func respawn_at_shelter(spawn_pos: Vector3) -> void:
	global_position = spawn_pos
	health = max_health
	stamina = max_stamina
	is_exhausted = false
	is_bleeding = false
	poise_damage_taken = 0.0
	current_state = ActionState.IDLE
	combat_banner_message.emit("Awakened at Shelter Fire", Color(0.85, 0.72, 0.45))

func _update_visual_pose(_delta: float) -> void:
	match current_state:
		ActionState.ATTACK_STARTUP:
			var windup_angle: float = 75.0 if _is_current_attack_heavy else 52.0
			_weapon_pivot.rotation_degrees = Vector3(-18.0, windup_angle, 0.0)
			_shield_mesh.position = Vector3(-0.38, 1.05, -0.15)
			_aim_arc_mat.albedo_color = Color(0.88, 0.62, 0.18, 0.55)
		ActionState.ATTACK_ACTIVE:
			_weapon_pivot.rotation_degrees = Vector3(0.0, -68.0, 0.0)
			_aim_arc_mat.albedo_color = Color(0.88, 0.18, 0.15, 0.72)
		ActionState.ATTACK_RECOVERY:
			_weapon_pivot.rotation_degrees = Vector3(12.0, -48.0, 0.0)
			_aim_arc_mat.albedo_color = Color(0.35, 0.35, 0.38, 0.28)
		ActionState.BLOCK, ActionState.BLOCK_IMPACT:
			_weapon_pivot.rotation_degrees = Vector3(-10.0, 15.0, 0.0)
			_shield_mesh.position = Vector3(-0.12, 1.12, -0.45)
			_aim_arc_mat.albedo_color = Color(0.45, 0.62, 0.78, 0.45)
		ActionState.STAGGER:
			_weapon_pivot.rotation_degrees = Vector3(35.0, 60.0, 25.0)
			_shield_mesh.position = Vector3(-0.48, 0.95, 0.1)
			_aim_arc_mat.albedo_color = Color(0.75, 0.22, 0.22, 0.35)
		_:
			_weapon_pivot.rotation_degrees = Vector3(0.0, 0.0, 0.0)
			_shield_mesh.position = Vector3(-0.36, 1.05, -0.22)
			_aim_arc_mat.albedo_color = Color(0.65, 0.62, 0.55, 0.24)

func _build_survivor_visuals_and_colliders() -> void:
	collision_layer = 2
	collision_mask = 1 | 2 | 4

	var body_col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.36
	cap.height = 1.75
	body_col.shape = cap
	body_col.position = Vector3(0.0, 0.88, 0.0)
	add_child(body_col)

	_visual_root = Node3D.new()
	_visual_root.name = "VisualRoot"
	add_child(_visual_root)

	var torso_mat := StandardMaterial3D.new()
	torso_mat.albedo_color = Color(0.24, 0.21, 0.19)
	torso_mat.roughness = 0.88

	var torso := MeshInstance3D.new()
	var torso_mesh := CapsuleMesh.new()
	torso_mesh.radius = 0.33
	torso_mesh.height = 1.35
	torso.mesh = torso_mesh
	torso.material_override = torso_mat
	torso.position = Vector3(0.0, 0.82, 0.0)
	_visual_root.add_child(torso)

	var helm_mat := StandardMaterial3D.new()
	helm_mat.albedo_color = Color(0.36, 0.35, 0.34)
	helm_mat.metallic = 0.45
	helm_mat.roughness = 0.65

	var helm := MeshInstance3D.new()
	var helm_mesh := SphereMesh.new()
	helm_mesh.radius = 0.24
	helm_mesh.height = 0.44
	helm.mesh = helm_mesh
	helm.material_override = helm_mat
	helm.position = Vector3(0.0, 1.58, 0.0)
	_visual_root.add_child(helm)

	var shield_mat := StandardMaterial3D.new()
	shield_mat.albedo_color = Color(0.32, 0.23, 0.16)
	shield_mat.roughness = 0.9
	_shield_mesh = MeshInstance3D.new()
	var s_box := BoxMesh.new()
	s_box.size = Vector3(0.12, 0.62, 0.52)
	_shield_mesh.mesh = s_box
	_shield_mesh.material_override = shield_mat
	_shield_mesh.position = Vector3(-0.36, 1.05, -0.22)
	_visual_root.add_child(_shield_mesh)

	_weapon_pivot = Node3D.new()
	_weapon_pivot.position = Vector3(0.34, 1.05, -0.15)
	_visual_root.add_child(_weapon_pivot)

	var blade_mat := StandardMaterial3D.new()
	blade_mat.albedo_color = Color(0.52, 0.50, 0.48)
	blade_mat.metallic = 0.65
	blade_mat.roughness = 0.52

	var sword := MeshInstance3D.new()
	var sword_box := BoxMesh.new()
	sword_box.size = Vector3(0.08, 0.08, 1.25)
	sword.mesh = sword_box
	sword.material_override = blade_mat
	sword.position = Vector3(0.0, 0.0, -0.68)
	_weapon_pivot.add_child(sword)

	_aim_arc_mat = StandardMaterial3D.new()
	_aim_arc_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_aim_arc_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_aim_arc_mat.albedo_color = Color(0.65, 0.62, 0.55, 0.24)

	_aim_arc_mesh = MeshInstance3D.new()
	var arc_prism := PrismMesh.new()
	arc_prism.size = Vector3(1.15, 1.55, 0.02)
	_aim_arc_mesh.mesh = arc_prism
	_aim_arc_mesh.material_override = _aim_arc_mat
	_aim_arc_mesh.rotation_degrees = Vector3(90.0, 180.0, 0.0)
	_aim_arc_mesh.position = Vector3(0.0, 0.04, -0.95)
	_visual_root.add_child(_aim_arc_mesh)

	_torch_light = OmniLight3D.new()
	_torch_light.light_color = Color(0.95, 0.62, 0.28)
	_torch_light.light_energy = 1.35
	_torch_light.omni_range = 7.5
	_torch_light.shadow_enabled = true
	_torch_light.position = Vector3(0.0, 1.35, 0.0)
	add_child(_torch_light)

	_hitbox = HitboxComponent.new()
	_hitbox.owner_entity = self
	_hitbox.collision_layer = 0
	_hitbox.collision_mask = 16
	var hb_shape := CollisionShape3D.new()
	var hb_box := BoxShape3D.new()
	hb_box.size = Vector3(1.45, 1.2, weapon.reach_meters)
	hb_shape.shape = hb_box
	hb_shape.position = Vector3(0.0, 1.0, -(weapon.reach_meters * 0.5 + 0.25))
	_hitbox.add_child(hb_shape)
	_visual_root.add_child(_hitbox)
	_hitbox.confirmed_hit.connect(_on_confirmed_hit_landed)

	_hurtbox = HurtboxComponent.new()
	_hurtbox.owner_entity = self
	_hurtbox.collision_layer = 8
	_hurtbox.collision_mask = 0
	var hurt_shape := CollisionShape3D.new()
	var hurt_cap := CapsuleShape3D.new()
	hurt_cap.radius = 0.42
	hurt_cap.height = 1.75
	hurt_shape.shape = hurt_cap
	hurt_shape.position = Vector3(0.0, 0.88, 0.0)
	_hurtbox.add_child(hurt_shape)
	add_child(_hurtbox)
	_hurtbox.hit_received.connect(_on_hurtbox_hit_received)

func _on_confirmed_hit_landed(_target: Node3D, payload: CombatPayload) -> void:
	if audio:
		audio.play_flesh_hit()
	if camera_rig:
		camera_rig.add_trauma(0.38 if payload.is_heavy else 0.22)

func _emit_stats() -> void:
	stats_changed.emit({
		"health": health,
		"max_health": max_health,
		"stamina": stamina,
		"max_stamina": max_stamina,
		"poise": max_poise - poise_damage_taken,
		"max_poise": max_poise,
		"state": ActionState.keys()[current_state],
		"exhausted": is_exhausted,
		"bleeding": is_bleeding
	})
