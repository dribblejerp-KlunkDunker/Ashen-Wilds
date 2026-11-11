class_name AcousticRipple
extends MeshInstance3D
## A dust-ring on the ground where the survivor heard something they cannot see: it spreads and
## fades, larger and longer for a louder noise. The same quad, filled and charcoal, is the mark an
## enemy leaves where it slipped out of sight. Drawn on top of everything (no depth test), since
## the point is to show what is behind a wall or behind the survivor. Tween-animated mesh, not
## particles, so it renders under software Vulkan and in the browser. Ripples are in the group
## "acoustic_ripple" and marks in "last_seen_mark" (the suite counts them there).

const RADIUS_BASE: float = 0.3
const RADIUS_PER_METRE: float = 0.07
const SECONDS_BASE: float = 0.6
const SECONDS_PER_METRE: float = 0.02
const RIPPLE_COLOR: Color = Color(0.74, 0.70, 0.62)
const MARK_COLOR: Color = Color(0.09, 0.09, 0.11)

static var _shader: Shader


static func spawn(parent: Node, world_pos: Vector3, loudness: float) -> AcousticRipple:
	var r := AcousticRipple.new(RIPPLE_COLOR, 0.14, 0.0)
	r.name = "AcousticRipple"
	r.position = Vector3(world_pos.x, 0.03, world_pos.z)
	r.add_to_group("acoustic_ripple")
	parent.add_child(r, true)
	var radius: float = RADIUS_BASE + RADIUS_PER_METRE * loudness
	var seconds: float = SECONDS_BASE + SECONDS_PER_METRE * loudness
	r.scale = Vector3.ONE * (radius * 0.25)
	var tw: Tween = r.create_tween().set_parallel(true)
	tw.tween_property(r, "scale", Vector3.ONE * radius, seconds).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_QUAD)
	tw.tween_method(r._set_alpha, 0.75, 0.0, seconds).set_ease(Tween.EASE_IN)
	tw.chain().tween_callback(r.queue_free)
	return r


static func spawn_mark(parent: Node, world_pos: Vector3, seconds: float) -> AcousticRipple:
	var m := AcousticRipple.new(MARK_COLOR, 0.1, 0.55)
	m.name = "LastSeenMark"
	m.position = Vector3(world_pos.x, 0.025, world_pos.z)
	m.add_to_group("last_seen_mark")
	parent.add_child(m, true)
	m.scale = Vector3.ONE * 0.55
	var tw: Tween = m.create_tween()
	tw.tween_method(m._set_alpha, 0.6, 0.0, seconds).set_ease(Tween.EASE_IN)
	tw.tween_callback(m.queue_free)
	return m


func _init(tint: Color = RIPPLE_COLOR, ring: float = 0.14, fill: float = 0.0) -> void:
	var quad := QuadMesh.new()
	quad.size = Vector2(2.0, 2.0)
	mesh = quad
	rotation_degrees.x = -90.0
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	if _shader == null:
		_shader = Shader.new()
		_shader.code = """
shader_type spatial;
render_mode unshaded, blend_mix, cull_disabled, depth_draw_never, depth_test_disabled, shadows_disabled, fog_disabled;
uniform vec4 tint : source_color = vec4(0.74, 0.70, 0.62, 1.0);
uniform float alpha = 0.7;
uniform float ring = 0.14;
uniform float fill = 0.0;
void fragment() {
	vec2 d = UV - vec2(0.5);
	float r = length(d) * 2.0;
	float edge = 1.0 - smoothstep(0.95, 1.0, r);
	float band = smoothstep(1.0 - ring - 0.05, 1.0 - ring, r) * edge;
	float inner = fill * (1.0 - smoothstep(0.2, 1.0 - ring, r));
	ALBEDO = tint.rgb;
	ALPHA = alpha * max(band, inner);
}
"""
	var mat := ShaderMaterial.new()
	mat.shader = _shader
	mat.set_shader_parameter("tint", tint)
	mat.set_shader_parameter("ring", ring)
	mat.set_shader_parameter("fill", fill)
	material_override = mat


func _set_alpha(a: float) -> void:
	(material_override as ShaderMaterial).set_shader_parameter("alpha", a)


func alpha() -> float:
	return float((material_override as ShaderMaterial).get_shader_parameter("alpha"))
