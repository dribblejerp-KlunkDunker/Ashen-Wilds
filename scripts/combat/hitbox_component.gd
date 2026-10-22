class_name HitboxComponent
extends Area3D

signal confirmed_hit(target_entity: Node3D, payload: CombatPayload)

@export var owner_entity: Node3D
@export var environment_collision_mask: int = 1 # Layer 1: Opaque walls

var _active_payload: CombatPayload = null
var _is_swing_active: bool = false
# Key: target entity instance_id -> bool. Prevents one swing from damaging the same target repeatedly.
var _hit_targets_this_swing: Dictionary = {}

func _ready() -> void:
	monitoring = false
	monitorable = false
	area_entered.connect(_on_area_entered)

func begin_swing(payload: CombatPayload) -> void:
	_hit_targets_this_swing.clear()
	_active_payload = payload
	_is_swing_active = true
	monitoring = true
	call_deferred("_check_initial_overlaps")

func end_swing() -> void:
	_is_swing_active = false
	_active_payload = null
	monitoring = false
	_hit_targets_this_swing.clear()

func _check_initial_overlaps() -> void:
	if not _is_swing_active:
		return
	for area: Area3D in get_overlapping_areas():
		_try_process_area(area)

func _on_area_entered(area: Area3D) -> void:
	if _is_swing_active:
		_try_process_area(area)

func _try_process_area(area: Area3D) -> void:
	if not _is_swing_active or _active_payload == null:
		return
	var hurtbox := area as HurtboxComponent
	if hurtbox == null or hurtbox.owner_entity == null:
		return
	if hurtbox.owner_entity == owner_entity:
		return

	var target_id: int = hurtbox.owner_entity.get_instance_id()
	if _hit_targets_this_swing.has(target_id):
		return

	if _is_blocked_by_wall(owner_entity.global_position, hurtbox.owner_entity.global_position):
		return

	_hit_targets_this_swing[target_id] = true
	hurtbox.receive_attack(_active_payload)
	confirmed_hit.emit(hurtbox.owner_entity, _active_payload)

func _is_blocked_by_wall(from_pos: Vector3, to_pos: Vector3) -> bool:
	var space_state := get_world_3d().direct_space_state
	var start := from_pos + Vector3(0.0, 1.0, 0.0)
	var end := to_pos + Vector3(0.0, 1.0, 0.0)
	var query := PhysicsRayQueryParameters3D.create(start, end, environment_collision_mask)
	query.collide_with_areas = false
	var result := space_state.intersect_ray(query)
	return not result.is_empty()
