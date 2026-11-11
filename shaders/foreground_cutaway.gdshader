shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_disabled, diffuse_burley, specular_schlick_ggx;

uniform vec4 albedo_color : source_color = vec4(0.26, 0.24, 0.22, 1.0);
uniform float roughness_val : hint_range(0.0, 1.0) = 0.88;
uniform float metallic_val : hint_range(0.0, 1.0) = 0.08;
uniform float grime_strength : hint_range(0.0, 1.0) = 0.35;

// Photo textures (ambientCG, CC0), projected in world space so any box size tiles at the same
// density: the floor and roofs take the XZ plane, walls the plane they face. Off = flat albedo_color.
uniform bool use_texture = false;
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap, repeat_enable;
uniform float tex_scale = 0.5; // repeats per metre
uniform vec3 tex_tint : source_color = vec3(1.0);
uniform float normal_strength : hint_range(0.0, 2.0) = 0.8;

// Updated every frame by IsoCameraRig
uniform vec3 player_world_pos = vec3(0.0, 0.0, 0.0);
uniform vec3 camera_forward = vec3(-0.612372, -0.5, -0.612372);
uniform bool force_roof_hide = false;
uniform bool enable_foreground_cutaway = true;
uniform float cutaway_radius : hint_range(0.5, 6.0) = 2.4;

varying vec3 world_pos;
varying vec3 world_normal;

float bayer4x4(vec2 screen_px) {
	int x = int(mod(screen_px.x, 4.0));
	int y = int(mod(screen_px.y, 4.0));
	int index = y * 4 + x;
	float m[16] = float[16](
		0.0625, 0.5625, 0.1875, 0.6875,
		0.8125, 0.3125, 0.9375, 0.4375,
		0.2500, 0.7500, 0.1250, 0.6250,
		1.0000, 0.5000, 0.8750, 0.3750
	);
	return m[index];
}

float hash_noise(vec3 p) {
	p = fract(p * 0.3183099 + 0.1);
	p *= 17.0;
	return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	world_normal = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

void fragment() {
	float n = hash_noise(floor(world_pos * 6.0));
	float damp_gradient = clamp(world_pos.y * 0.45, 0.0, 1.0);
	vec3 base = albedo_color.rgb;
	if (use_texture) {
		// Boxes are axis-aligned, so the dominant normal axis picks one projection (no blending).
		vec3 an = abs(world_normal);
		vec2 uv;
		vec3 t_axis;
		vec3 b_axis;
		if (an.y >= an.x && an.y >= an.z) {
			uv = world_pos.xz;
			t_axis = vec3(1.0, 0.0, 0.0);
			b_axis = vec3(0.0, 0.0, 1.0);
		} else if (an.x >= an.z) {
			uv = vec2(world_pos.z, -world_pos.y);
			t_axis = vec3(0.0, 0.0, 1.0);
			b_axis = vec3(0.0, -1.0, 0.0);
		} else {
			uv = vec2(world_pos.x, -world_pos.y);
			t_axis = vec3(1.0, 0.0, 0.0);
			b_axis = vec3(0.0, -1.0, 0.0);
		}
		uv *= tex_scale;
		base = texture(albedo_tex, uv).rgb * tex_tint;
		vec3 nm = texture(normal_tex, uv).rgb * 2.0 - 1.0;
		nm.xy *= normal_strength;
		// OpenGL-style normal map: +Y in the image is up the texture, i.e. against b_axis.
		vec3 nw = normalize(t_axis * nm.x - b_axis * nm.y + world_normal * max(nm.z, 0.2));
		NORMAL = normalize((VIEW_MATRIX * vec4(nw, 0.0)).xyz);
	}
	base *= mix(0.62, 1.0, damp_gradient);
	base = mix(base, base * (0.75 + 0.5 * n), grime_strength);

	ALBEDO = base;
	ROUGHNESS = clamp(roughness_val + (n - 0.5) * 0.12, 0.1, 1.0);
	METALLIC = metallic_val;

	float opacity = 1.0;

	if (force_roof_hide) {
		opacity = 0.0;
	} else if (enable_foreground_cutaway) {
		vec3 to_frag = world_pos - (player_world_pos + vec3(0.0, 1.1, 0.0));
		float depth_along_cam = dot(to_frag, -camera_forward);

		if (depth_along_cam > 0.25 && world_pos.y > (player_world_pos.y + 0.45)) {
			vec3 projected = to_frag - (-camera_forward * depth_along_cam);
			projected.y *= 0.65;
			float radial_dist = length(projected);
			opacity = clamp((radial_dist - (cutaway_radius * 0.45)) / (cutaway_radius * 0.55), 0.12, 1.0);
		}
	}

	float threshold = bayer4x4(FRAGCOORD.xy);
	if (opacity < threshold) {
		discard;
	}
}
