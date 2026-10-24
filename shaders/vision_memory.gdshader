// Milestone 8: vision cone + charcoal memory map.
// A full-screen quad drawn after the opaque pass. It rebuilds each pixel's
// world position from depth and decides whether the survivor sees that spot:
//   - inside the 130° cone (or the close "sense" radius) AND lit by a cone ray
//     this frame (so walls cast sight-shadows)  -> passes through untouched
//   - seen before                              -> charcoal sketch
//   - never seen                               -> near black
shader_type spatial;
render_mode unshaded, depth_test_disabled, depth_draw_never, cull_disabled, blend_mix, fog_disabled, shadows_disabled;

uniform sampler2D screen_tex : hint_screen_texture, filter_nearest;
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest;
uniform sampler2D seen_tex : filter_linear, repeat_disable;
uniform sampler2D visible_tex : filter_linear, repeat_disable;

uniform vec2 grid_origin = vec2(-26.0, -26.0);
uniform float grid_world_size = 52.0;
uniform float grid_texel = 0.0064;
uniform vec3 player_pos = vec3(0.0);
uniform vec2 aim_dir = vec2(0.0, -1.0);
uniform float cos_half_angle = 0.4226;
uniform float vision_range = 16.0;
uniform float sense_radius = 1.6;
uniform float charcoal_strength : hint_range(0.0, 2.0) = 1.0;
uniform bool overlay_enabled = true;

void vertex() {
	POSITION = vec4(VERTEX.xy, 1.0, 1.0);
}

float grid_sample(sampler2D tex, vec2 uv) {
	if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) {
		return 0.0;
	}
	return texture(tex, uv).r;
}

void fragment() {
	if (!overlay_enabled) {
		discard;
	}
	float depth = texture(depth_tex, SCREEN_UV).x;
	vec3 ndc = vec3(SCREEN_UV * 2.0 - 1.0, depth);
	vec4 view = INV_PROJECTION_MATRIX * vec4(ndc, 1.0);
	view.xyz /= view.w;
	vec3 world = (INV_VIEW_MATRIX * vec4(view.xyz, 1.0)).xyz;

	vec2 rel = world.xz - player_pos.xz;
	float d = length(rel);
	float in_cone = 0.0;
	if (d > 0.001) {
		float facing = dot(rel / d, aim_dir);
		float angular = smoothstep(cos_half_angle - 0.03, cos_half_angle + 0.03, facing);
		float ranged = 1.0 - smoothstep(vision_range - 1.5, vision_range, d);
		in_cone = angular * ranged;
	}
	in_cone = max(in_cone, 1.0 - smoothstep(sense_radius - 0.3, sense_radius, d));

	vec2 guv = (world.xz - grid_origin) / grid_world_size;
	float lit = grid_sample(visible_tex, guv) * 0.4;
	lit += grid_sample(visible_tex, guv + vec2(grid_texel, 0.0)) * 0.15;
	lit += grid_sample(visible_tex, guv - vec2(grid_texel, 0.0)) * 0.15;
	lit += grid_sample(visible_tex, guv + vec2(0.0, grid_texel)) * 0.15;
	lit += grid_sample(visible_tex, guv - vec2(0.0, grid_texel)) * 0.15;
	float near_self = 1.0 - smoothstep(sense_radius - 0.3, sense_radius, d);
	float visible = clamp(in_cone * max(smoothstep(0.12, 0.4, lit), near_self), 0.0, 1.0);

	float seen = grid_sample(seen_tex, guv) * 0.4;
	seen += grid_sample(seen_tex, guv + vec2(grid_texel, 0.0)) * 0.15;
	seen += grid_sample(seen_tex, guv - vec2(grid_texel, 0.0)) * 0.15;
	seen += grid_sample(seen_tex, guv + vec2(0.0, grid_texel)) * 0.15;
	seen += grid_sample(seen_tex, guv - vec2(0.0, grid_texel)) * 0.15;
	seen = smoothstep(0.1, 0.6, seen);
	vec3 col = texture(screen_tex, SCREEN_UV).rgb;
	float lum = dot(col, vec3(0.299, 0.587, 0.114));
	float hatch = 0.82 + 0.18 * step(0.5, fract((FRAGCOORD.x + FRAGCOORD.y) * 0.125));
	// Output is linear: keep it dim so the remembered world reads as a sketch.
	// Remembered ground: a darker, desaturated copy of what's there, with a
	// faint diagonal hatch. Always dimmer than what you can actually see.
	vec3 paper = vec3(0.0035, 0.0034, 0.0032);
	vec3 charcoal = paper + vec3(0.95, 0.92, 0.86) * clamp(lum, 0.0, 0.3) * 0.62 * hatch * charcoal_strength;
	vec3 outside = mix(vec3(0.0008, 0.0008, 0.001), charcoal, seen);

	ALBEDO = outside;
	ALPHA = 1.0 - visible;
}
