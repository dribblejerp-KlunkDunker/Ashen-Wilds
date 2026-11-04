shader_type spatial;
// Falling ash around the survivor: one MultiMesh of tiny quads, every flake placed and animated
// here from its INSTANCE_ID (the MultiMesh transforms are all identity). Flakes live in world space
// and wrap inside a box centred on the node, so they stay put as the survivor walks through them.
// Shader-driven, not particles: it renders under software Vulkan and in the browser build.
render_mode unshaded, cull_disabled, blend_mix, depth_draw_never, shadows_disabled, skip_vertex_transform, fog_disabled;

uniform vec3 box_size = vec3(26.0, 9.0, 26.0);
uniform float fall_speed = 0.55;
uniform float drift = 0.35;
uniform float flake_size = 0.028;
uniform vec4 flake_color : source_color = vec4(0.46, 0.44, 0.42, 0.4);

varying float v_fade;

float hash(float n) {
	return fract(sin(n * 12.9898) * 43758.5453);
}

void vertex() {
	float id = float(INSTANCE_ID);
	vec3 center = MODEL_MATRIX[3].xyz;
	vec3 base = vec3(hash(id + 0.1), hash(id + 7.3), hash(id + 13.7)) * 64.0;
	float speed = fall_speed * (0.6 + 0.8 * hash(id + 3.1));
	float t = TIME;
	vec3 p = base;
	p.y -= t * speed;
	p.x += sin(t * 0.7 + id) * drift + t * 0.12;
	p.z += cos(t * 0.5 + id * 1.3) * drift;
	vec3 half_box = box_size * 0.5;
	p.xz = center.xz + mod(p.xz - center.xz + half_box.xz, box_size.xz) - half_box.xz;
	p.y = center.y + mod(p.y, box_size.y);
	// Fade out near the ground and the top of the box so flakes neither pop nor pile up.
	float h = (p.y - center.y) / box_size.y;
	v_fade = smoothstep(0.0, 0.12, h) * (1.0 - smoothstep(0.85, 1.0, h));
	// Camera-facing quad.
	vec3 right = INV_VIEW_MATRIX[0].xyz;
	vec3 up = INV_VIEW_MATRIX[1].xyz;
	float s = flake_size * (0.6 + 0.8 * hash(id + 5.5));
	vec3 world = p + (right * VERTEX.x + up * VERTEX.y) * s;
	VERTEX = (VIEW_MATRIX * vec4(world, 1.0)).xyz;
}

void fragment() {
	ALBEDO = flake_color.rgb;
	ALPHA = flake_color.a * v_fade;
}
