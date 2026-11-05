shader_type spatial;
// The charcoal memory map outside the survivor's vision cone (VisionConeOverlay). A full-screen
// quad: each pixel's world position is rebuilt from the depth buffer and tested against the cone
// in world space, so the edge lands where it should on walls as well as on the ground. Inside the
// cone the scene passes through untouched; outside it is drained of colour and darkened towards
// charcoal, with a soft edge of a few degrees and a small always-lit circle at the survivor's feet.
render_mode unshaded, blend_mix, cull_disabled, depth_draw_never, depth_test_disabled, shadows_disabled, fog_disabled, skip_vertex_transform;

uniform sampler2D screen_tex : hint_screen_texture, filter_nearest;
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest;
uniform bool enabled = true;
// Godot 4.3 Forward+ stores depth reversed (1 near, 0 far); the Compatibility renderer does not.
uniform bool reverse_z = true;
uniform vec3 player_pos = vec3(0.0);
uniform vec3 aim_dir = vec3(0.0, 0.0, -1.0);
uniform float half_angle_cos = 0.4226; // cos(65 degrees)
uniform float edge_soft = 0.07;        // in cosine, about four degrees
uniform float near_radius = 1.4;       // metres around the survivor always lit
uniform vec3 charcoal : source_color = vec3(0.05, 0.05, 0.065);
uniform float darken : hint_range(0.0, 1.0) = 0.6;
uniform float desaturate : hint_range(0.0, 1.0) = 0.85;
// A lift on the charcoal for the Compatibility renderer (VisionConeOverlay sets it; measured per
// engine version). Forward+ tonemaps and encodes the output itself (1.0).
uniform float output_gamma = 1.0;

void vertex() {
	// Cover the screen regardless of where the node sits. z is inside the clip range in both
	// depth conventions and the depth test is off, so only xy matter.
	POSITION = vec4(VERTEX.xy, 0.9999, 1.0);
}

// Only the charcoal is drawn: inside the cone ALPHA is 0 and the frame is left exactly as rendered.
// (Writing the scene back through this material would run it through the Compatibility renderer's
// per-material tonemapping a second time and darken the whole browser build.)
void fragment() {
	vec4 scene = texture(screen_tex, SCREEN_UV);
	vec3 result = scene.rgb;
	float cover = 0.0;
	if (enabled) {
		float depth = texture(depth_tex, SCREEN_UV).x;
		vec3 ndc = reverse_z ? vec3(SCREEN_UV * 2.0 - 1.0, depth) : vec3(SCREEN_UV, depth) * 2.0 - 1.0;
		vec4 view = INV_PROJECTION_MATRIX * vec4(ndc, 1.0);
		view.xyz /= view.w;
		vec3 world = (INV_VIEW_MATRIX * vec4(view.xyz, 1.0)).xyz;
		vec2 to_p = world.xz - player_pos.xz;
		float dist = length(to_p);
		vec2 aim = normalize(aim_dir.xz + vec2(1.0e-6, 0.0));
		float c = dot(to_p / max(dist, 1.0e-4), aim);
		float inside = smoothstep(half_angle_cos - edge_soft, half_angle_cos + edge_soft, c);
		inside = max(inside, 1.0 - smoothstep(near_radius * 0.5, near_radius, dist));
		float luma = dot(scene.rgb, vec3(0.299, 0.587, 0.114));
		vec3 drained = mix(scene.rgb, vec3(luma), desaturate);
		result = mix(drained * (1.0 - darken), charcoal, 0.3);
		result = pow(max(result, vec3(0.0)), vec3(output_gamma));
		cover = 1.0 - inside;
	}
	ALBEDO = result;
	ALPHA = cover;
}
