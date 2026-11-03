class_name NetCourtyard
extends Node3D
## The Milestone 1 test courtyard: a flat 24 m yard, a low perimeter wall, a stone stub where
## the watchhouse will stand, and a few crates. Blocks only (appendix §78): the scene proves
## camera and networking before it proves art. Walls stay low so every quarter-turn view can
## see both players without any transparency tricks; interiors arrive with the roof policy (§84).
## World object ids are not assigned yet: nothing here is interactable or persistent.

const YARD: float = 24.0
const WALL_HEIGHT: float = 1.2

var spawn_points: Array[Vector3] = [
	Vector3(-2.0, 0.0, 3.0),
	Vector3(2.0, 0.0, 3.0),
	Vector3(-2.0, 0.0, -1.0),
	Vector3(2.0, 0.0, -1.0),
]


func _ready() -> void:
	_box(Vector3(0.0, -0.5, 0.0), Vector3(YARD, 1.0, YARD), Color(0.23, 0.2, 0.16))  # packed dirt
	var half: float = YARD * 0.5 - 0.5
	var wall_colour := Color(0.36, 0.36, 0.34)
	_box(Vector3(0.0, WALL_HEIGHT * 0.5, -half), Vector3(YARD, WALL_HEIGHT, 1.0), wall_colour)
	_box(Vector3(0.0, WALL_HEIGHT * 0.5, half), Vector3(YARD, WALL_HEIGHT, 1.0), wall_colour)
	_box(Vector3(-half, WALL_HEIGHT * 0.5, 0.0), Vector3(1.0, WALL_HEIGHT, YARD), wall_colour)
	_box(Vector3(half, WALL_HEIGHT * 0.5, 0.0), Vector3(1.0, WALL_HEIGHT, YARD), wall_colour)
	# Watchhouse stub: a solid block, no interior yet.
	_box(Vector3(6.0, 1.6, -6.0), Vector3(5.0, 3.2, 4.0), Color(0.3, 0.29, 0.27))
	# Crates and a woodpile, placeholder props with real collision.
	_box(Vector3(-6.0, 0.5, -4.0), Vector3(1.0, 1.0, 1.0), Color(0.4, 0.3, 0.18))
	_box(Vector3(-5.0, 0.4, -5.2), Vector3(0.8, 0.8, 0.8), Color(0.38, 0.28, 0.17))
	_box(Vector3(4.0, 0.35, 6.0), Vector3(2.2, 0.7, 1.0), Color(0.33, 0.24, 0.14))

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-52.0, 28.0, 0.0)
	sun.light_energy = 0.75
	sun.light_color = Color(0.86, 0.84, 0.78)
	sun.shadow_enabled = true
	add_child(sun)

	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.06, 0.07, 0.07)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.42, 0.45, 0.47)
	e.ambient_light_energy = 0.55
	env.environment = e
	add_child(env)


func _box(pos: Vector3, size: Vector3, colour: Color) -> void:
	var body := StaticBody3D.new()
	body.position = pos
	body.collision_layer = 1
	body.collision_mask = 0
	add_child(body)
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	shape.shape = box
	body.add_child(shape)
	var mesh := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mesh.mesh = bm
	var mat := StandardMaterial3D.new()
	mat.albedo_color = colour
	mat.roughness = 1.0
	mesh.material_override = mat
	body.add_child(mesh)
