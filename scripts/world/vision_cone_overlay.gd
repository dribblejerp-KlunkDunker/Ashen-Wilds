class_name VisionConeOverlay
extends MeshInstance3D
## The charcoal "memory map": everything outside the survivor's vision cone is drawn drained and
## dark, like a charcoal sketch of what they remember, so the lit wedge ahead is what they see.
##
## A full-screen quad with a spatial shader (shaders/vision_cone.gdshader) that rebuilds each
## pixel's world position from the depth buffer and tests it against the cone in world space, so
## the edge is exact on walls as well as on the ground. The quad is the first transparent thing
## drawn (render_priority -100), so ash, sparks, ripples and marks draw over it untouched. Forward+
## stores depth reversed (Godot 4.3) and the Compatibility renderer does not; `reverse_z` is set
## from the rendering method. Presentation only: it follows `Perception`, it decides nothing.

const COLOR_CHARCOAL: Color = Color(0.05, 0.05, 0.065)
## The Compatibility renderer (the browser) needs a small lift on the charcoal; Forward+ needs none
## (1.0). Measured on Godot 4.7.2: 0.9 leaves the ground outside the cone at 41% of its unshaded
## level on the desktop Compatibility renderer, as 4.3 did with its own value (0.6, which 4.7.2 turns
## into a washed-out 98%: its Compatibility renderer now encodes this material's output itself;
## 1.0 gives 28%). Headless Chromium shows the same charcoal as 4.3's browser build.
const COMPATIBILITY_OUTPUT_GAMMA: float = 0.9

var follow: PlayerController
var _mat: ShaderMaterial


func _init(player: PlayerController) -> void:
	name = "VisionConeOverlay"
	follow = player
	var quad := QuadMesh.new()
	quad.size = Vector2(2.0, 2.0)
	mesh = quad
	_mat = ShaderMaterial.new()
	_mat.shader = load("res://shaders/vision_cone.gdshader") as Shader
	_mat.render_priority = -100
	material_override = _mat
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# Placed on screen by the shader, so the mesh bounds mean nothing: never cull.
	custom_aabb = AABB(Vector3(-1.0e4, -1.0e4, -1.0e4), Vector3(2.0e4, 2.0e4, 2.0e4))
	# Only Forward+ and Mobile have a RenderingDevice; the Compatibility renderer (the browser
	# build) has none, and stores depth the old way round.
	var forward_plus: bool = RenderingServer.get_rendering_device() != null
	_mat.set_shader_parameter("reverse_z", forward_plus)
	_mat.set_shader_parameter("output_gamma", 1.0 if forward_plus else COMPATIBILITY_OUTPUT_GAMMA)
	_mat.set_shader_parameter("half_angle_cos", cos(deg_to_rad(Perception.CONE_DEGREES * 0.5)))
	_mat.set_shader_parameter("charcoal", COLOR_CHARCOAL)


func _process(_delta: float) -> void:
	if follow == null or not follow.is_inside_tree():
		return
	var on: bool = follow.perception != null and follow.perception.enabled
	_mat.set_shader_parameter("enabled", on)
	_mat.set_shader_parameter("player_pos", follow.global_position)
	_mat.set_shader_parameter("aim_dir", follow.get_aim_direction())


func is_enabled() -> bool:
	return bool(_mat.get_shader_parameter("enabled"))
