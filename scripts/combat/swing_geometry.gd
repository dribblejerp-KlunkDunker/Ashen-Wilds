class_name SwingGeometry
extends RefCounted
## Shared wall-deflection geometry (Milestone 5, generalised in Milestone 6).
## The survivor and every enemy use the same arc check, so a stroke that
## clangs for one clangs for all.

## Raycasts across a horizontal swing arc at blade height. Returns the first
## Environment (layer 1) hit as a PhysicsDirectSpaceState3D ray result, or {}
## if the arc is clear.
static func sweep_obstruction(
	body: CollisionObject3D,
	aim: Vector3,
	arc_degrees: float,
	reach: float,
	blade_height: float = 1.05
) -> Dictionary:
	if body == null or not body.is_inside_tree():
		return {}
	var flat: Vector3 = Vector3(aim.x, 0.0, aim.z)
	if flat.length_squared() < 0.0001:
		return {}
	flat = flat.normalized()
	var arc: float = minf(arc_degrees, 180.0)
	var half: float = deg_to_rad(arc * 0.5)
	var steps: int = clampi(int(ceil(arc / 20.0)) + 1, 3, 9)
	var origin: Vector3 = body.global_position + Vector3(0.0, blade_height, 0.0)
	var length: float = reach * 0.9 + 0.25
	var space := body.get_world_3d().direct_space_state
	for i in range(steps):
		var t: float = -half + (2.0 * half) * float(i) / float(steps - 1)
		var dir: Vector3 = flat.rotated(Vector3.UP, t)
		var q := PhysicsRayQueryParameters3D.create(origin, origin + dir * length, 1)
		q.exclude = [body.get_rid()]
		var hit: Dictionary = space.intersect_ray(q)
		if not hit.is_empty():
			return hit
	return {}

## Horizontal push-back direction away from the wall a clang hit.
static func recoil_normal(hit: Dictionary, aim: Vector3) -> Vector3:
	var normal: Vector3 = hit.get("normal", -aim)
	normal.y = 0.0
	if normal.length_squared() < 0.001:
		normal = -aim
		normal.y = 0.0
	return normal.normalized() if normal.length_squared() > 0.001 else Vector3.BACK

## Hand-animated spark shards rather than a particle system: renders
## identically on every backend (including software Vulkan) and is easy to test.
static func spawn_sparks(parent: Node, at: Vector3, normal: Vector3, count: int = 14) -> void:
	if parent == null or not parent.is_inside_tree():
		return
	var burst := Node3D.new()
	burst.name = "WallSparks"
	parent.add_child(burst)
	burst.global_position = at + normal * 0.12
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = Color(1.0, 0.74, 0.32)
	var shard_mesh := BoxMesh.new()
	shard_mesh.size = Vector3(0.07, 0.07, 0.07)
	var base_dir: Vector3 = normal if normal.length_squared() > 0.001 else Vector3.UP
	var tween := burst.create_tween().set_parallel(true)
	for i in range(count):
		var shard := MeshInstance3D.new()
		shard.mesh = shard_mesh
		shard.material_override = mat
		burst.add_child(shard)
		var spray: Vector3 = (base_dir + Vector3(randf_range(-0.9, 0.9), randf_range(0.0, 1.1), randf_range(-0.9, 0.9))).normalized()
		var dist: float = randf_range(0.35, 0.85)
		var end_pos: Vector3 = spray * dist + Vector3(0.0, -0.35, 0.0)
		var life: float = randf_range(0.28, 0.45)
		tween.tween_property(shard, "position", end_pos, life).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
		tween.tween_property(shard, "scale", Vector3.ONE * 0.15, life).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tween.chain().tween_callback(burst.queue_free)
