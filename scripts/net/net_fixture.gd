class_name NetFixture
extends Node3D
## A shared world fixture with one irreversible state change (brief §38): the breach is repaired,
## the hearth is lit. Server-owned: `done` changes only in NetMain._use_fixture_for(), and clients
## mirror it from `fixture_state`. Placement, cost and appearance are defined here; whether the
## change is persistent is decided by NetMain (it is: Milestone 3).
##
## Collision implication (brief §38): the open breach is a 1.6 m gap in the low wall that anyone can
## walk through. Repaired, a timber barricade fills it and blocks movement on server and clients
## alike, because the server's physics is what moves avatars. The hearth's stone ring is solid
## either way; lighting it adds a warm OmniLight3D and a flame on clients only (presentation).

enum Kind { BREACH, HEARTH }

var object_id: String = ""
var kind: Kind = Kind.BREACH
var display_name: String = ""
var verb: String = ""            # "repair", "light"
var cost_item: String = "timber"
var cost_qty: int = 1
var done: bool = false
var done_by: String = ""         # player key, for logs and the HUD

var _barricade_shape: CollisionShape3D
var _barricade_mesh: MeshInstance3D
var _rubble: Node3D
var _flame: MeshInstance3D
var _light: OmniLight3D


static func breach(id: String, pos: Vector3) -> NetFixture:
	var f := NetFixture.new()
	f.object_id = id
	f.name = id.replace("/", "_")
	f.kind = Kind.BREACH
	f.display_name = "the breach"
	f.verb = "repair"
	f.cost_item = "timber"
	f.cost_qty = 2
	f.position = pos
	return f


static func hearth(id: String, pos: Vector3) -> NetFixture:
	var f := NetFixture.new()
	f.object_id = id
	f.name = id.replace("/", "_")
	f.kind = Kind.HEARTH
	f.display_name = "the hearth"
	f.verb = "light"
	f.cost_item = "timber"
	f.cost_qty = 1
	f.position = pos
	return f


func _ready() -> void:
	if kind == Kind.BREACH:
		_build_breach()
	else:
		_build_hearth()
	_apply()


func set_done(value: bool, by: String) -> void:
	done = value
	done_by = by
	if is_inside_tree():
		_apply()


## Ground-plane distance from a survivor to this fixture's origin.
func reach_from(p: Vector3) -> float:
	return Vector2(p.x - global_position.x, p.z - global_position.z).length()


func prompt() -> String:
	var item: ItemData = ItemDatabase.get_item(cost_item)
	if done:
		return "%s is %s" % [display_name.capitalize(), "repaired" if kind == Kind.BREACH else "lit"]
	return "F · %s %s (%d %s)" % [verb, display_name, cost_qty, item.display_name.to_lower() if item else cost_item]


func _apply() -> void:
	if kind == Kind.BREACH:
		_barricade_shape.set_deferred("disabled", not done)
		_barricade_mesh.visible = done
		_rubble.visible = not done
	else:
		_flame.visible = done
		_light.visible = done


func _build_breach() -> void:
	var body := StaticBody3D.new()
	body.collision_layer = 1
	body.collision_mask = 0
	add_child(body)
	_barricade_shape = CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(1.6, 1.1, 0.5)
	_barricade_shape.shape = box
	_barricade_shape.position = Vector3(0.0, 0.55, 0.0)
	body.add_child(_barricade_shape)
	_barricade_mesh = MeshInstance3D.new()
	_barricade_mesh.name = "Barricade"
	var planks := Node3D.new()
	_barricade_mesh.add_child(planks)
	for i: int in 3:
		var plank := MeshInstance3D.new()
		var pm := BoxMesh.new()
		pm.size = Vector3(1.7, 0.24, 0.12)
		plank.mesh = pm
		plank.position = Vector3(0.0, 0.25 + i * 0.32, 0.05 * (i % 2))
		plank.rotation_degrees = Vector3(0.0, 0.0, -4.0 + 4.0 * i)
		plank.material_override = _mat(Color(0.42, 0.31, 0.18))
		planks.add_child(plank)
	for x: float in [-0.7, 0.7]:
		var post := MeshInstance3D.new()
		var postm := BoxMesh.new()
		postm.size = Vector3(0.16, 1.2, 0.16)
		post.mesh = postm
		post.position = Vector3(x, 0.6, -0.1)
		post.material_override = _mat(Color(0.3, 0.22, 0.13))
		planks.add_child(post)
	add_child(_barricade_mesh)
	_rubble = Node3D.new()
	_rubble.name = "Rubble"
	for spec: Array in [[Vector3(-0.5, 0.12, 0.25), 0.34], [Vector3(0.45, 0.1, -0.2), 0.28], [Vector3(0.05, 0.08, 0.45), 0.22]]:
		var stone := MeshInstance3D.new()
		var sm := BoxMesh.new()
		sm.size = Vector3.ONE * float(spec[1])
		stone.mesh = sm
		stone.position = spec[0]
		stone.rotation_degrees = Vector3(12.0, 30.0, 8.0)
		stone.material_override = _mat(Color(0.36, 0.36, 0.34))
		_rubble.add_child(stone)
	add_child(_rubble)


func _build_hearth() -> void:
	var body := StaticBody3D.new()
	body.collision_layer = 1
	body.collision_mask = 0
	add_child(body)
	var shape := CollisionShape3D.new()
	var cyl := CylinderShape3D.new()
	cyl.radius = 0.5
	cyl.height = 0.4
	shape.shape = cyl
	shape.position = Vector3(0.0, 0.2, 0.0)
	body.add_child(shape)
	var ring := MeshInstance3D.new()
	var rm := CylinderMesh.new()
	rm.top_radius = 0.5
	rm.bottom_radius = 0.55
	rm.height = 0.3
	ring.mesh = rm
	ring.position = Vector3(0.0, 0.15, 0.0)
	ring.material_override = _mat(Color(0.33, 0.32, 0.3))
	add_child(ring)
	var ash := MeshInstance3D.new()
	var am := CylinderMesh.new()
	am.top_radius = 0.38
	am.bottom_radius = 0.38
	am.height = 0.04
	ash.mesh = am
	ash.position = Vector3(0.0, 0.31, 0.0)
	ash.material_override = _mat(Color(0.12, 0.11, 0.1))
	add_child(ash)
	_flame = MeshInstance3D.new()
	_flame.name = "Flame"
	var fm := CylinderMesh.new()
	fm.top_radius = 0.02
	fm.bottom_radius = 0.24
	fm.height = 0.5
	_flame.mesh = fm
	_flame.position = Vector3(0.0, 0.58, 0.0)
	_flame.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var flame_mat := StandardMaterial3D.new()
	flame_mat.albedo_color = Color(1.0, 0.62, 0.25)
	flame_mat.emission_enabled = true
	flame_mat.emission = Color(1.0, 0.5, 0.15)
	flame_mat.emission_energy_multiplier = 2.5
	flame_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_flame.material_override = flame_mat
	add_child(_flame)
	# The light hangs above the flame, outside every mesh that casts a shadow (CLAUDE.md pitfall).
	_light = OmniLight3D.new()
	_light.position = Vector3(0.0, 1.1, 0.0)
	_light.light_color = Color(1.0, 0.66, 0.36)
	_light.light_energy = 2.2
	_light.omni_range = 7.0
	_light.shadow_enabled = false
	add_child(_light)


func _mat(colour: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = colour
	m.roughness = 1.0
	return m
