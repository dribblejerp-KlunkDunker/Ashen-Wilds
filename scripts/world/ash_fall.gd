class_name AshFall
extends MultiMeshInstance3D
## Falling ash around whatever it follows (the survivor). Atmosphere only: it is drawn by
## shaders/ash_fall.gdshader, has no collision, and never touches gameplay. The box follows the
## target's ground position; the flakes themselves stay fixed in the world and wrap within it.

const FLAKES: int = 420

var follow: Node3D


func _init() -> void:
	name = "AshFall"
	var quad := QuadMesh.new()
	quad.size = Vector2.ONE
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = quad
	mm.instance_count = FLAKES
	for i: int in range(FLAKES):
		mm.set_instance_transform(i, Transform3D.IDENTITY)
	multimesh = mm
	var mat := ShaderMaterial.new()
	mat.shader = load("res://shaders/ash_fall.gdshader") as Shader
	material_override = mat
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# Every flake is placed in the shader, so the mesh's own bounds mean nothing: never cull.
	custom_aabb = AABB(Vector3(-20.0, -2.0, -20.0), Vector3(40.0, 14.0, 40.0))


## The weather's hand on the flakes: how many (alpha), what colour, how fast, how sideways, how big.
func apply(alpha: float, color: Color, fall_speed: float, drift: float, flake_size: float) -> void:
	var mat := material_override as ShaderMaterial
	mat.set_shader_parameter("flake_color", Color(color.r, color.g, color.b, alpha))
	mat.set_shader_parameter("fall_speed", fall_speed)
	mat.set_shader_parameter("drift", drift)
	mat.set_shader_parameter("flake_size", flake_size)
	visible = alpha > 0.001


func _process(_delta: float) -> void:
	if follow and follow.is_inside_tree():
		global_position = Vector3(follow.global_position.x, 0.0, follow.global_position.z)
