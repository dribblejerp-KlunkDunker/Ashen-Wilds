class_name NetPlayerView
extends Node3D
## Placeholder presentation for a survivor: a capsule body, a darker head, and a short nose
## block so facing reads from every camera angle. Primitive on purpose (brief §10, §62).

static func create(color: Color) -> NetPlayerView:
	var v := NetPlayerView.new()
	v.name = "View"
	v._build(color)
	return v


func _build(color: Color) -> void:
	var body := MeshInstance3D.new()
	var capsule := CapsuleMesh.new()
	capsule.radius = 0.33
	capsule.height = 1.5
	body.mesh = capsule
	body.position = Vector3(0.0, 0.75, 0.0)
	body.material_override = _flat(color)
	add_child(body)

	var head := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.2
	sphere.height = 0.4
	head.mesh = sphere
	head.position = Vector3(0.0, 1.65, 0.0)
	head.material_override = _flat(color.darkened(0.35))
	add_child(head)

	var nose := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(0.12, 0.12, 0.28)
	nose.mesh = box
	nose.position = Vector3(0.0, 1.62, 0.3)
	nose.material_override = _flat(Color(0.85, 0.8, 0.7))
	add_child(nose)


func _flat(color: Color) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 0.95
	return mat
