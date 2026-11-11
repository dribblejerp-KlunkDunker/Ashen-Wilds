class_name WallDeflection
extends RefCounted
# Milestone 5 wall & corridor deflection, shared by the survivor and enemies.
# A sweeping stroke whose arc would meet stone (layer 1) clangs instead of
# opening its hitbox; thrusts and overhead blows never clang.

## Blade height above the attacker's feet for the arc raycasts.
const BLADE_HEIGHT: float = 1.05

## Raycasts across a horizontal swing arc. Returns the first wall hit
## (a PhysicsDirectSpaceState3D ray result) or {} if the arc is clear.
static func sweep_obstruction(attacker: CollisionObject3D, aim: Vector3, arc_degrees: float, reach_meters: float, blade_height: float = BLADE_HEIGHT) -> Dictionary:
	if attacker == null or not attacker.is_inside_tree():
		return {}
	var flat_aim: Vector3 = Vector3(aim.x, 0.0, aim.z)
	if flat_aim.length_squared() < 0.0001:
		return {}
	flat_aim = flat_aim.normalized()
	var arc: float = minf(arc_degrees, 180.0)
	var half: float = deg_to_rad(arc * 0.5)
	var steps: int = clampi(int(ceil(arc / 20.0)) + 1, 3, 9)
	var origin: Vector3 = attacker.global_position + Vector3(0.0, blade_height, 0.0)
	var length: float = reach_meters * 0.9 + 0.25
	var space := attacker.get_world_3d().direct_space_state
	for i in range(steps):
		var t: float = -half + (2.0 * half) * float(i) / float(steps - 1)
		var dir: Vector3 = flat_aim.rotated(Vector3.UP, t)
		var q := PhysicsRayQueryParameters3D.create(origin, origin + dir * length, 1)
		q.exclude = [attacker.get_rid()]
		var hit: Dictionary = space.intersect_ray(q)
		if not hit.is_empty():
			return hit
	return {}

## Flat push-back direction away from the wall that was struck.
static func recoil_normal(hit: Dictionary, aim: Vector3) -> Vector3:
	var normal: Vector3 = hit.get("normal", -aim)
	normal.y = 0.0
	if normal.length_squared() < 0.001:
		normal = Vector3(-aim.x, 0.0, -aim.z)
	if normal.length_squared() < 0.001:
		return Vector3.ZERO
	return normal.normalized()

## Spark burst where a blade meets stone. Hand-animated shards rather than a
## particle system: renders identically on every backend (including software
## Vulkan) and is easy to test. Nodes are named "WallSparks*" under `parent`.
static func spawn_sparks(parent: Node, at: Vector3, normal: Vector3) -> void:
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
	for i in range(14):
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
