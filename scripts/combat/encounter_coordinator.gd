class_name EncounterCoordinator
extends Node

@export var max_simultaneous_attackers: int = 1
@export var min_readability_gap_seconds: float = 0.45

# Key: enemy instance_id -> Node3D
var _active_holders: Dictionary = {}
var _cooldown_timer: float = 0.0

func _physics_process(delta: float) -> void:
	if _cooldown_timer > 0.0:
		_cooldown_timer = maxf(0.0, _cooldown_timer - delta)

	var stale_ids: Array[int] = []
	for id: int in _active_holders.keys():
		var node: Variant = _active_holders[id]
		if node == null or not is_instance_valid(node):
			stale_ids.append(id)
	for id: int in stale_ids:
		_active_holders.erase(id)

func request_attack_token(requester: Node3D, priority_override: bool = false) -> bool:
	if requester == null:
		return false
	var req_id: int = requester.get_instance_id()
	if _active_holders.has(req_id):
		return true

	if not priority_override and _cooldown_timer > 0.0:
		return false

	if _active_holders.size() < max_simultaneous_attackers:
		_active_holders[req_id] = requester
		return true

	return false

func release_attack_token(requester: Node3D) -> void:
	if requester == null:
		return
	var req_id: int = requester.get_instance_id()
	if _active_holders.has(req_id):
		_active_holders.erase(req_id)
		_cooldown_timer = maxf(_cooldown_timer, min_readability_gap_seconds)
