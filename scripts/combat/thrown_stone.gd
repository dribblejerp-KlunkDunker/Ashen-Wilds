class_name ThrownStone
extends Node3D
## A stone a goblin throws: flies straight and flat at `SPEED`, hits the survivor once through an
## ordinary HitboxComponent (so dodging, blocking and the hit rules work as for any blow), and is
## gone when it hits, meets a wall (a layer 1 ray along each step, like every other ray in the
## game), or runs out of range. Set dressing on layer 7 doesn't stop it, as it stops no ray.

const SPEED: float = 13.0
const MAX_RANGE: float = 14.0
const RADIUS: float = 0.09

var _velocity: Vector3 = Vector3.ZERO
var _travelled: float = 0.0
var _hitbox: HitboxComponent


## `payload.attacker` is the thrower; `dir` is flattened, so stones fly level at the height thrown.
static func launch(parent: Node, from: Vector3, dir: Vector3, payload: CombatPayload) -> ThrownStone:
	var stone := ThrownStone.new()
	var flat := Vector3(dir.x, 0.0, dir.z)
	stone._velocity = (flat.normalized() if flat.length_squared() > 0.0001 else Vector3.FORWARD) * SPEED
	stone.position = from
	parent.add_child(stone)
	stone._hitbox.begin_swing(payload)
	return stone


func _init() -> void:
	name = "ThrownStone"
	var mesh := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = RADIUS
	sphere.height = RADIUS * 2.0
	mesh.mesh = sphere
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.34, 0.32, 0.30)
	mat.roughness = 0.95
	mesh.material_override = mat
	add_child(mesh)

	_hitbox = HitboxComponent.new()
	_hitbox.owner_entity = self
	_hitbox.collision_layer = 0
	_hitbox.collision_mask = 8  # layer 4: the survivor's hurtbox
	var col := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = 0.28  # a little generous: a stone the size of the mesh would be hard to see land
	col.shape = shape
	_hitbox.add_child(col)
	add_child(_hitbox)
	_hitbox.confirmed_hit.connect(func(_target: Node3D, _payload: CombatPayload) -> void: queue_free())


func _physics_process(delta: float) -> void:
	var step: Vector3 = _velocity * delta
	var q := PhysicsRayQueryParameters3D.create(global_position, global_position + step, 1)
	if not get_world_3d().direct_space_state.intersect_ray(q).is_empty():
		queue_free()
		return
	global_position += step
	_travelled += step.length()
	if _travelled >= MAX_RANGE:
		queue_free()


func velocity() -> Vector3:
	return _velocity
