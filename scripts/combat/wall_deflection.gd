class_name WallDeflection
extends RefCounted
## Compatibility entry point for code originating on main.
## SwingGeometry remains the authoritative implementation.

const BLADE_HEIGHT: float = 1.05

static func sweep_obstruction(
	attacker: CollisionObject3D,
	aim: Vector3,
	arc_degrees: float,
	reach_meters: float,
	blade_height: float = BLADE_HEIGHT
) -> Dictionary:
	return SwingGeometry.sweep_obstruction(
		attacker, aim, arc_degrees, reach_meters, blade_height
	)

static func recoil_normal(hit: Dictionary, aim: Vector3) -> Vector3:
	return SwingGeometry.recoil_normal(hit, aim)

static func spawn_sparks(parent: Node, at: Vector3, normal: Vector3) -> void:
	SwingGeometry.spawn_sparks(parent, at, normal)
