@tool
extends Node3D
## Bulk visual prototypes. No loot, networking, doors or gameplay integration.
@export_enum("Stone pillar", "Supply crate", "Barrel", "Fence", "Bench", "Stone wall", "Rubble", "Stump") var kind: int = 0
@export_range(1, 4, 1) var variant: int = 1
@export var rebuild_now: bool = false:
	set(value):
		if value and is_inside_tree():
			call_deferred("rebuild")
		rebuild_now = false
var generated: Node3D
var materials: Array[StandardMaterial3D] = []
var rng := RandomNumberGenerator.new()
var factor: float = 1.0

func _ready() -> void:
	call_deferred("rebuild")

func rebuild() -> void:
	if not is_inside_tree():
		return
	if is_instance_valid(generated):
		generated.free()
	generated = Node3D.new()
	generated.name = "Generated"
	add_child(generated)
	factor = 0.75 + 0.10 * float(clampi(variant, 1, 4))
	rng.seed = 1000 + kind * 100 + variant
	materials.clear()
	for color: Color in [Color(0.39, 0.40, 0.35), Color(0.27, 0.18, 0.10), Color(0.12, 0.11, 0.09), Color(0.18, 0.24, 0.10)]:
		var material := StandardMaterial3D.new()
		material.albedo_color = color * rng.randf_range(0.88, 1.10)
		material.roughness = 0.95
		materials.append(material)
	match kind:
		0:
			_box(Vector3(0, 0.08, 0), Vector3(0.65, 0.16, 0.65), 0)
			for level in range(5):
				var width: float = 0.50 - float(level) * 0.025
				_box(Vector3(0, 0.32 + float(level) * 0.31, 0), Vector3(width, 0.30, width), 0)
			_box(Vector3(0.12, 1.76, 0), Vector3(0.22, 0.12, 0.35), 3)
		1:
			for z: float in [-0.33, 0.33]:
				for y: float in [0.14, 0.34, 0.54]:
					_box(Vector3(0, y, z), Vector3(0.86, 0.17, 0.04), 1)
			for x: float in [-0.41, 0.41]:
				for y: float in [0.14, 0.34, 0.54]:
					_box(Vector3(x, y, 0), Vector3(0.04, 0.17, 0.62), 1)
			_box(Vector3(0, 0.025, 0), Vector3(0.86, 0.05, 0.66), 1)
			_box(Vector3(-0.20, 0.66, 0), Vector3(0.35, 0.04, 0.66), 1)
		2:
			_cylinder(Vector3(0, 0.43, 0), 0.31, 0.27, 0.86, 1, true)
			for y: float in [0.12, 0.43, 0.74]:
				_cylinder(Vector3(0, y, 0), 0.32, 0.32, 0.035, 2, false)
		3:
			for x: float in [-0.90, 0.90]:
				_box(Vector3(x, 0.55, 0), Vector3(0.12, 1.10, 0.12), 1)
			for y: float in [0.40, 0.82]:
				_box(Vector3(0, y, 0), Vector3(1.80, 0.10, 0.075), 1)
		4:
			for x: float in [-0.55, 0.55]:
				for z: float in [-0.18, 0.18]:
					_box(Vector3(x, 0.22, z), Vector3(0.10, 0.44, 0.10), 1)
			for z: float in [-0.17, 0.0, 0.17]:
				_box(Vector3(0, 0.47, z), Vector3(1.40, 0.06, 0.15), 1)
		5:
			for row in range(4):
				for column in range(3):
					var offset: float = 0.10 if row % 2 == 1 else 0.0
					_box(Vector3(float(column - 1) * 0.50 + offset, 0.15 + float(row) * 0.30, 0), Vector3(0.48, 0.29, 0.35), 0)
		6:
			for stone in range(7):
				var size := Vector3(rng.randf_range(0.18, 0.40), rng.randf_range(0.12, 0.28), rng.randf_range(0.18, 0.35))
				_box(Vector3(rng.randf_range(-0.40, 0.40), size.y * 0.5, rng.randf_range(-0.30, 0.30)), size, 0)
		7:
			_cylinder(Vector3(0, 0.28, 0), 0.24, 0.36, 0.56, 1, true)
			for root_index in range(4):
				var angle: float = float(root_index) * PI * 0.5
				_box(Vector3(cos(angle) * 0.28, 0.06, sin(angle) * 0.28), Vector3(0.24, 0.12, 0.24), 1)
	set_meta("pack_kind", kind)
	set_meta("pack_variant", variant)

func _box(center: Vector3, size: Vector3, material_index: int) -> void:
	var mesh := BoxMesh.new()
	mesh.size = size * factor
	_add(mesh, center * factor, size * factor, material_index, true)

func _cylinder(center: Vector3, top: float, bottom: float, height: float, material_index: int, solid: bool) -> void:
	var mesh := CylinderMesh.new()
	mesh.top_radius = top * factor
	mesh.bottom_radius = bottom * factor
	mesh.height = height * factor
	mesh.radial_segments = 12
	var radius: float = maxf(top, bottom) * factor
	_add(mesh, center * factor, Vector3(radius * 2.0, height * factor, radius * 2.0), material_index, solid)

func _add(mesh: Mesh, center: Vector3, collision_size: Vector3, material_index: int, solid: bool) -> void:
	var visual := MeshInstance3D.new()
	visual.mesh = mesh
	visual.material_override = materials[material_index]
	visual.position = center
	generated.add_child(visual)
	if solid:
		var body := StaticBody3D.new()
		body.position = center
		body.collision_layer = 1
		body.collision_mask = 0
		var shape := BoxShape3D.new()
		shape.size = collision_size
		var collision := CollisionShape3D.new()
		collision.shape = shape
		body.add_child(collision)
		generated.add_child(body)
