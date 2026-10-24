class_name EnemyCarrionCrow
extends CharacterBody3D
## Milestone 15: a Carrion Crow. Sentinel, not fighter. It perches, and when
## the survivor comes close in its sight or a noise reaches it, it bursts up
## cawing: a loud noise that goblins, orks and the Quarry-Troll treat like a
## clang. It comes back after a while. One blow kills it. Milestone 19: at
## night the flock roosts. A roosting crow keeps its eyes shut and only a
## noise that reaches it with `roost_margin` to spare wakes it.

signal crow_alarm(world_pos: Vector3)

enum AIState { PERCHED, FLYING_AWAY, AWAY, RETURNING, DEAD }

@export var enemy_name: String = "Carrion Crow"
@export var max_health: float = 5.0
@export var sight_range: float = 6.0
@export var caw_reach: float = 14.0
@export var away_time: float = 25.0
## Any noise reaching it with at least this much reach to spare scatters it.
@export var startle_margin: float = 0.0
## Extra reach a noise needs to wake a roosting crow.
@export var roost_margin: float = 4.0

## Weapons don't lodge in a crow.
var can_lodge: bool = false
var health: float = 5.0
var state: AIState = AIState.PERCHED
var player_ref: PlayerController
var audio: ProceduralAudio
var coordinator: EncounterCoordinator

var _perch_pos: Vector3 = Vector3.ZERO
var _state_timer: float = 0.0
var _bob_t: float = 0.0
var _visual_root: Node3D
var _hurtbox: HurtboxComponent

func _ready() -> void:
	add_to_group("enemy")
	health = max_health
	_perch_pos = global_position
	_bob_t = randf() * TAU
	_build_crow_visuals_and_colliders()
	AcousticField.listen(self, _on_noise_heard)

func _physics_process(delta: float) -> void:
	if player_ref:
		_visual_root.visible = state != AIState.AWAY and player_ref.can_see_body(self)
	if state == AIState.DEAD:
		return
	_process_ai_state(delta)

func is_dead() -> bool:
	return state == AIState.DEAD

func is_staggered() -> bool:
	return false

func is_perched() -> bool:
	return state == AIState.PERCHED

func _process_ai_state(delta: float) -> void:
	match state:
		AIState.PERCHED:
			if not is_roosting():
				_bob_t += delta
			_visual_root.position.y = absf(sin(_bob_t * 2.3)) * 0.04
			if not is_roosting() and _sees_player():
				scatter()
		AIState.FLYING_AWAY:
			_state_timer -= delta
			if _state_timer <= 0.0:
				state = AIState.AWAY
				_state_timer = away_time
		AIState.AWAY:
			_state_timer -= delta
			if _state_timer <= 0.0:
				_return_to_perch()
		AIState.RETURNING:
			_state_timer -= delta
			if _state_timer <= 0.0:
				state = AIState.PERCHED

## Asleep on its perch: the night is more than half dark.
func is_roosting() -> bool:
	return state == AIState.PERCHED and DayNightCycle.darkness(self) > 0.5

func _sees_player() -> bool:
	if player_ref == null or player_ref.current_state == PlayerController.ActionState.DEAD:
		return false
	var flat := Vector2(player_ref.global_position.x - global_position.x, player_ref.global_position.z - global_position.z)
	if flat.length() > sight_range * WeatherSystem.factor(self, "sight"):
		return false
	var q := PhysicsRayQueryParameters3D.create(
		global_position + Vector3(0.0, 0.3, 0.0), player_ref.global_position + Vector3(0.0, 1.2, 0.0), 1
	)
	return get_world_3d().direct_space_state.intersect_ray(q).is_empty()

func _on_noise_heard(world_pos: Vector3, reach: float, source: Node3D, kind: String) -> void:
	if state != AIState.PERCHED or not is_inside_tree():
		return
	if source is EnemyCarrionCrow:
		# One crow cawing sets off the whole flock.
		if kind == "caw" and AcousticField.can_hear(self, world_pos, reach):
			scatter()
		return
	if kind == "footstep" and not (source is PlayerController):
		return
	var flat := Vector2(world_pos.x - global_position.x, world_pos.z - global_position.z).length()
	var margin: float = startle_margin + (roost_margin if is_roosting() else 0.0)
	if flat <= reach - margin and AcousticField.can_hear(self, world_pos, reach):
		scatter()

## Bursts into the air cawing. Public so tests (and other crows) can call it.
func scatter() -> void:
	if state != AIState.PERCHED:
		return
	state = AIState.FLYING_AWAY
	_state_timer = 1.4
	if audio:
		audio.play_caw()
	crow_alarm.emit(global_position)
	AcousticField.report(self, global_position, caw_reach, "caw")
	var away := Vector3(randf_range(-1.0, 1.0), 0.0, randf_range(-1.0, 1.0))
	if away.length_squared() < 0.01:
		away = Vector3.RIGHT
	var target: Vector3 = global_position + away.normalized() * 9.0 + Vector3(0.0, 7.0, 0.0)
	var tween := create_tween()
	tween.tween_property(self, "global_position", target, 1.4).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	_set_wings(true)

## Back on its perch at once, wings folded (the roost settling, a load).
func settle_on_perch() -> void:
	if state == AIState.DEAD:
		return
	state = AIState.PERCHED
	global_position = _perch_pos
	_set_wings(false)

func _return_to_perch() -> void:
	state = AIState.RETURNING
	_state_timer = 1.6
	var tween := create_tween()
	tween.tween_property(self, "global_position", _perch_pos, 1.6).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.tween_callback(func() -> void: _set_wings(false))

func _on_hurtbox_hit_received(payload: CombatPayload) -> void:
	if state == AIState.DEAD:
		return
	health = maxf(0.0, health - payload.physical_damage)
	if health > 0.0:
		return
	state = AIState.DEAD
	collision_layer = 0
	_hurtbox.set_deferred("monitorable", false)
	_set_wings(false)
	_visual_root.rotation_degrees.z = 90.0
	var ground := Vector3(global_position.x, 0.08, global_position.z)
	var tween := create_tween()
	tween.tween_property(self, "global_position", ground, 0.35).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)

# ------------------------------------------------------------------------------
# Visuals (placeholder; see docs/VISUAL_DIRECTION.md, sheet 12)
# ------------------------------------------------------------------------------
var _wing_l: MeshInstance3D
var _wing_r: MeshInstance3D

func _set_wings(open: bool) -> void:
	if _wing_l == null:
		return
	_wing_l.rotation_degrees.z = -70.0 if open else -10.0
	_wing_r.rotation_degrees.z = 70.0 if open else 10.0

func _build_crow_visuals_and_colliders() -> void:
	collision_layer = 0
	collision_mask = 0
	_visual_root = Node3D.new()
	add_child(_visual_root)
	var feather := StandardMaterial3D.new()
	feather.albedo_color = Color(0.07, 0.07, 0.08)
	feather.roughness = 0.7
	var body := MeshInstance3D.new()
	var b_mesh := CapsuleMesh.new()
	b_mesh.radius = 0.11
	b_mesh.height = 0.36
	body.mesh = b_mesh
	body.material_override = feather
	body.rotation_degrees.x = 70.0
	body.position = Vector3(0.0, 0.16, 0.0)
	_visual_root.add_child(body)
	var head := MeshInstance3D.new()
	var h_mesh := SphereMesh.new()
	h_mesh.radius = 0.08
	h_mesh.height = 0.16
	head.mesh = h_mesh
	head.material_override = feather
	head.position = Vector3(0.0, 0.27, -0.15)
	_visual_root.add_child(head)
	var beak_mat := StandardMaterial3D.new()
	beak_mat.albedo_color = Color(0.25, 0.22, 0.18)
	var beak := MeshInstance3D.new()
	var bk := BoxMesh.new()
	bk.size = Vector3(0.03, 0.03, 0.1)
	beak.mesh = bk
	beak.material_override = beak_mat
	beak.position = Vector3(0.0, 0.26, -0.25)
	_visual_root.add_child(beak)
	for side: float in [-1.0, 1.0]:
		var wing := MeshInstance3D.new()
		var w_mesh := BoxMesh.new()
		w_mesh.size = Vector3(0.28, 0.02, 0.16)
		wing.mesh = w_mesh
		wing.material_override = feather
		wing.position = Vector3(0.14 * side, 0.2, 0.0)
		_visual_root.add_child(wing)
		if side < 0.0:
			_wing_l = wing
		else:
			_wing_r = wing
	_set_wings(false)

	_hurtbox = HurtboxComponent.new()
	_hurtbox.owner_entity = self
	_hurtbox.collision_layer = 16
	_hurtbox.collision_mask = 0
	var hurt_col := CollisionShape3D.new()
	var sphere := SphereShape3D.new()
	sphere.radius = 0.35
	hurt_col.shape = sphere
	hurt_col.position = Vector3(0.0, 0.2, 0.0)
	_hurtbox.add_child(hurt_col)
	add_child(_hurtbox)
	_hurtbox.hit_received.connect(_on_hurtbox_hit_received)
