class_name Vignette
extends CanvasLayer
## A soft dark edge around the screen. Layer 0: over the 3D view, under the HUD (layer 1), and it
## ignores the mouse. Pure 2D shader, so it looks the same in the desktop and browser builds.

const STRENGTH: float = 0.4


func _init() -> void:
	name = "Vignette"
	layer = 0
	var rect := ColorRect.new()
	rect.name = "Shade"
	rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var shader := Shader.new()
	shader.code = """
shader_type canvas_item;
uniform float strength = 0.55;
void fragment() {
	vec2 d = UV - vec2(0.5);
	d.x *= 1.35;
	float v = smoothstep(0.32, 0.86, length(d));
	COLOR = vec4(0.0, 0.0, 0.0, v * strength);
}
"""
	var mat := ShaderMaterial.new()
	mat.shader = shader
	mat.set_shader_parameter("strength", STRENGTH)
	rect.material = mat
	add_child(rect)
