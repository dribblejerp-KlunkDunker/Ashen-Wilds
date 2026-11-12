extends Node
## The Long Account: the prologue's ledge, in first person, at the Shattered Octave build's scale
## (a 320 x 150 view shown at exactly four times its size above a 200-pixel panel).
##
## The world the key painting shows is real geometry here: the broken highland, the cracks with
## fire in them, the Slagcrown on its rise, the teal hollow. Only the sky is still the painting.
## Art is placeholder: the sky and the partner are cut from the owner's key painting, the rest is
## drawn by tools/make_assets.py. There is no gameplay yet.
##
## Run: godot --path .                    walk the ledge (WASD, mouse, L swaps lantern and cold light, Esc quits)
##      godot --path . -- --shots <dir>   write the stills and quit

const LOW := Vector2i(320, 150)
const SCALE := 4
const EYE := 1.7
const CITADEL := Vector3(-178.0, 0.0, -489.0)   # 520 m out, 20 degrees left of north: under the coal sun
const HOLLOW := Vector3(-66.0, 0.0, -118.0)
const CANYON_FROM := Vector2(-14.0, -70.0)
const CANYON_TO := Vector2(-150.0, -400.0)
const LAVA_Y := -84.0

var _view: SubViewport
var _cam: Camera3D
var _hand_light: OmniLight3D
var _left: TextureRect
var _right: TextureRect
var _panel: TextureRect
var _partner: Sprite3D
var _cold: bool = false
var _yaw: float = deg_to_rad(15.0)
var _pitch: float = deg_to_rad(-3.0)
var _tex: Dictionary = {}
var _n_land := FastNoiseLite.new()
var _n_crack := FastNoiseLite.new()
var _blob_tex: GradientTexture2D

func _tex_of(file: String) -> ImageTexture:
	if not _tex.has(file):
		var img := Image.load_from_file(ProjectSettings.globalize_path("res://assets/" + file))
		_tex[file] = ImageTexture.create_from_image(img)
	return _tex[file]

func _ready() -> void:
	_n_land.seed = 31
	_n_land.noise_type = FastNoiseLite.TYPE_SIMPLEX
	_n_land.frequency = 0.006
	_n_land.fractal_octaves = 4
	_n_crack.seed = 30
	_n_crack.noise_type = FastNoiseLite.TYPE_SIMPLEX
	_n_crack.frequency = 0.0042
	_n_crack.fractal_octaves = 2
	_build_view()
	_build_sky_and_light()
	_build_land()
	_build_slagcrown()
	_build_ledge()
	_build_people()
	_build_camera()
	_build_hands()
	_build_panel()
	_apply_hand()
	var args := OS.get_cmdline_user_args()
	var at := args.find("--shots")
	if at >= 0 and at + 1 < args.size():
		_take_shots(args[at + 1])
	elif DisplayServer.get_name() != "headless":
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

# ------------------------------------------------------------------ the low-resolution view
func _build_view() -> void:
	_view = SubViewport.new()
	_view.size = LOW
	_view.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	_view.msaa_3d = Viewport.MSAA_DISABLED
	add_child(_view)
	var layer := CanvasLayer.new()
	add_child(layer)
	var screen := TextureRect.new()
	screen.texture = _view.get_texture()
	screen.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	screen.stretch_mode = TextureRect.STRETCH_SCALE
	screen.position = Vector2.ZERO
	screen.size = Vector2(LOW * SCALE)
	var sh := Shader.new()
	sh.code = """
shader_type canvas_item;
uniform float levels = 26.0;
const float B[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
void fragment() {
	vec4 c = texture(TEXTURE, UV);
	ivec2 p = ivec2(UV * vec2(320.0, 150.0));
	float d = (B[(p.x % 4) + (p.y % 4) * 4] / 16.0 - 0.5) / levels;
	c.rgb = floor((c.rgb + d) * levels + 0.5) / levels;
	COLOR = c;
}
"""
	var mat := ShaderMaterial.new()
	mat.shader = sh
	screen.material = mat
	layer.add_child(screen)

# ------------------------------------------------------------------ small builders
func _rock(top: bool) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_texture = _tex_of("rock_frost.png" if top else "rock.png")
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	m.uv1_triplanar = true
	m.uv1_scale = Vector3(0.3, 0.3, 0.3)
	m.roughness = 1.0
	return m

func _stone(scale: float, tint: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_texture = _tex_of("rock.png")
	m.albedo_color = tint
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	m.uv1_triplanar = true
	m.uv1_world_triplanar = true
	m.uv1_scale = Vector3(scale, scale, scale)
	m.roughness = 1.0
	return m

func _box(size: Vector3, pos: Vector3, rot_deg: Vector3, mat: Material) -> void:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = mat
	mi.position = pos
	mi.rotation_degrees = rot_deg
	_view.add_child(mi)

func _spire(base: float, height: float, pos: Vector3, lean_deg: Vector3, mat: Material) -> void:
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.0
	cm.bottom_radius = base
	cm.height = height
	cm.radial_segments = 4
	cm.rings = 1
	mi.mesh = cm
	mi.material_override = mat
	mi.position = pos
	mi.rotation_degrees = lean_deg
	_view.add_child(mi)

func _blob() -> GradientTexture2D:
	if _blob_tex == null:
		var grad := Gradient.new()
		grad.set_color(0, Color(1, 1, 1, 1))
		grad.set_color(1, Color(1, 1, 1, 0))
		_blob_tex = GradientTexture2D.new()
		_blob_tex.gradient = grad
		_blob_tex.width = 32
		_blob_tex.height = 32
		_blob_tex.fill = GradientTexture2D.FILL_RADIAL
		_blob_tex.fill_from = Vector2(0.5, 0.5)
		_blob_tex.fill_to = Vector2(1.0, 0.5)
	return _blob_tex

func _glow(pos: Vector3, size: float, color: Color) -> void:
	var mi := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2(size, size * 0.7)
	mi.mesh = qm
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.albedo_color = color
	m.albedo_texture = _blob()
	m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	m.disable_fog = true
	mi.material_override = m
	mi.position = pos
	_view.add_child(mi)

func _smoke(pos: Vector3, width: float, height: float) -> void:
	# A plume: dark soft puffs, each higher, wider and further downwind than the last.
	for i: int in 7:
		var t := float(i) / 6.0
		var mi := MeshInstance3D.new()
		var qm := QuadMesh.new()
		var w := width * (0.45 + t * 1.1)
		qm.size = Vector2(w, w * 0.8)
		mi.mesh = qm
		var m := StandardMaterial3D.new()
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.albedo_color = Color(0.035, 0.03, 0.03, 0.62 - t * 0.34)
		m.albedo_texture = _blob()
		m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
		m.disable_fog = true
		mi.material_override = m
		mi.position = pos + Vector3(t * t * width * 1.6, 6.0 + t * height, 0)
		_view.add_child(mi)

func _lamp(pos: Vector3, color: Color, energy: float, reach: float) -> void:
	var l := OmniLight3D.new()
	l.position = pos
	l.light_color = color
	l.light_energy = energy
	l.omni_range = reach
	_view.add_child(l)

# ------------------------------------------------------------------ sky and light
func _build_sky_and_light() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.02, 0.02, 0.02)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.34, 0.42, 0.56)
	env.ambient_light_energy = 0.40
	env.fog_enabled = true
	env.fog_light_color = Color(0.085, 0.04, 0.03)
	env.fog_density = 0.0013
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	var we := WorldEnvironment.new()
	we.environment = env
	_view.add_child(we)

	# The sky is the painting, wrapped round the world: a coarse unshaded arc, untouched by fog.
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var r := 2600.0
	var y0 := -680.0
	var y1 := 1500.0
	var a0 := deg_to_rad(-82.5)
	var a1 := deg_to_rad(82.5)
	var n := 48
	for i: int in n:
		var ua := float(i) / n
		var ub := float(i + 1) / n
		var aa := lerpf(a0, a1, ua)
		var ab := lerpf(a0, a1, ub)
		var pa := Vector3(sin(aa) * r, 0, -cos(aa) * r)
		var pb := Vector3(sin(ab) * r, 0, -cos(ab) * r)
		var quad: Array = [[pa + Vector3(0, y1, 0), Vector2(ua, 0)], [pb + Vector3(0, y1, 0), Vector2(ub, 0)],
			[pb + Vector3(0, y0, 0), Vector2(ub, 1)], [pa + Vector3(0, y1, 0), Vector2(ua, 0)],
			[pb + Vector3(0, y0, 0), Vector2(ub, 1)], [pa + Vector3(0, y0, 0), Vector2(ua, 1)]]
		for v: Array in quad:
			st.set_uv(v[1])
			st.add_vertex(v[0])
	var sky := MeshInstance3D.new()
	sky.mesh = st.commit()
	var sm := StandardMaterial3D.new()
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	sm.albedo_texture = _tex_of("sky.png")
	sm.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	sm.cull_mode = BaseMaterial3D.CULL_DISABLED
	sm.disable_fog = true
	sky.material_override = sm
	_view.add_child(sky)

	# The coal sun's light: low, red, from behind the Slagcrown.
	var sun := DirectionalLight3D.new()
	sun.light_color = Color(1.0, 0.36, 0.18)
	sun.light_energy = 0.6
	sun.rotation_degrees = Vector3(-10, 200, 0)
	_view.add_child(sun)
	# Cold from the front: a faint blue fill, so the near side of everything is night.
	var fill := DirectionalLight3D.new()
	fill.light_color = Color(0.45, 0.58, 0.85)
	fill.light_energy = 0.16
	fill.rotation_degrees = Vector3(-50, 20, 0)
	_view.add_child(fill)

# ------------------------------------------------------------------ the broken country
func _dist_to_canyon(p: Vector2) -> float:
	var ab := CANYON_TO - CANYON_FROM
	var t := clampf((p - CANYON_FROM).dot(ab) / ab.length_squared(), 0.0, 1.0)
	return p.distance_to(CANYON_FROM + ab * t)

func land_height(x: float, z: float) -> float:
	var p := Vector2(x, z)
	var far := clampf(-z / 760.0, 0.0, 1.0)
	var h := -46.0 + _n_land.get_noise_2d(x, z) * 26.0 + far * 22.0
	# the far rim: broken mountains
	h += smoothstep(0.70, 1.0, far) * (16.0 + absf(_n_land.get_noise_2d(x * 2.3, z * 2.3)) * 70.0)
	h += smoothstep(330.0, 520.0, absf(x)) * (12.0 + absf(_n_land.get_noise_2d(z * 2.0, x * 2.0)) * 60.0)
	# the Slagcrown's rise
	var dc := p.distance_to(Vector2(CITADEL.x, CITADEL.z))
	h = lerpf(h, -12.0, smoothstep(150.0, 70.0, dc))
	# cracks: wherever the crack noise crosses zero, and one great one running to the citadel
	var crack := smoothstep(0.075, 0.0, absf(_n_crack.get_noise_2d(x, z)))
	var canyon := smoothstep(34.0, 9.0, _dist_to_canyon(p) + _n_land.get_noise_2d(x * 3.0, z * 3.0) * 10.0)
	var cut := maxf(crack * (1.0 - smoothstep(110.0, 60.0, dc)), canyon)
	h = lerpf(h, LAVA_Y - 8.0, cut)
	# the teal hollow: a bowl
	var dh := p.distance_to(Vector2(HOLLOW.x, HOLLOW.z))
	h = lerpf(h, -62.0, smoothstep(46.0, 12.0, dh) * (1.0 - cut))
	return h

func _build_land() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var step := 8.0
	var x0 := -560.0
	var z0 := -800.0
	var nx := 140
	var nz := 105
	var hs: Array[PackedFloat32Array] = []
	for j: int in nz + 1:
		var row := PackedFloat32Array()
		row.resize(nx + 1)
		for i: int in nx + 1:
			row[i] = land_height(x0 + i * step, z0 + j * step)
		hs.append(row)
	for j: int in nz:
		for i: int in nx:
			var xa := x0 + i * step
			var za := z0 + j * step
			var v00 := Vector3(xa, hs[j][i], za)
			var v10 := Vector3(xa + step, hs[j][i + 1], za)
			var v01 := Vector3(xa, hs[j + 1][i], za + step)
			var v11 := Vector3(xa + step, hs[j + 1][i + 1], za + step)
			for v: Vector3 in [v00, v10, v11, v00, v11, v01]:
				var heat := smoothstep(LAVA_Y + 34.0, LAVA_Y + 2.0, v.y)
				st.set_color(Color(0.42, 0.40, 0.42).lerp(Color(0.9, 0.30, 0.12), heat * 0.85))
				st.add_vertex(v)
	st.generate_normals()
	var land := MeshInstance3D.new()
	land.mesh = st.commit()
	var m := _stone(0.035, Color(1, 1, 1))
	m.vertex_color_use_as_albedo = true
	land.material_override = m
	_view.add_child(land)

	# Fire in the cracks: one glowing sheet below the land, seen only where the land is cut.
	var lava := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(1200, 900)
	lava.mesh = pm
	var lm := StandardMaterial3D.new()
	lm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	lm.albedo_texture = _tex_of("lava.png")
	lm.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	lm.uv1_scale = Vector3(26, 20, 1)
	lm.disable_fog = true
	lava.material_override = lm
	lava.position = Vector3(0, LAVA_Y, -400)
	_view.add_child(lava)

	# Ruins and burning ground, scattered where the land stands.
	var rng := RandomNumberGenerator.new()
	rng.seed = 29
	var dark := _stone(0.08, Color(0.55, 0.50, 0.50))
	var placed := 0
	while placed < 46:
		var x := (rng.randf() - 0.5) * 820.0
		var z := -60.0 - rng.randf() * 560.0
		var y := land_height(x, z)
		if y < LAVA_Y + 30.0 or Vector2(x, z).distance_to(Vector2(CITADEL.x, CITADEL.z)) < 110.0:
			continue
		placed += 1
		var h := 10.0 + rng.randf() * 34.0
		if placed % 3 == 0:
			_spire(3.0 + rng.randf() * 5.0, h * 1.4, Vector3(x, y + h * 0.6, z),
				Vector3((rng.randf() - 0.5) * 22.0, rng.randf() * 90.0, (rng.randf() - 0.5) * 22.0), dark)
		else:
			_box(Vector3(3.0 + rng.randf() * 6.0, h, 3.0 + rng.randf() * 6.0), Vector3(x, y + h * 0.4, z),
				Vector3((rng.randf() - 0.5) * 16.0, rng.randf() * 90.0, (rng.randf() - 0.5) * 16.0), dark)
	var fires := 0
	while fires < 9:
		var fx := -150.0 + (rng.randf() - 0.5) * 520.0
		var fz := -90.0 - rng.randf() * 380.0
		var fy := land_height(fx, fz)
		if fy < LAVA_Y + 30.0:
			continue
		fires += 1
		_glow(Vector3(fx, fy + 3.0, fz), 26.0 + rng.randf() * 20.0, Color(0.60, 0.17, 0.05, 0.75))
		_glow(Vector3(fx, fy + 2.0, fz + 1.0), 7.0 + rng.randf() * 6.0, Color(1.0, 0.58, 0.18, 0.95))
		_lamp(Vector3(fx, fy + 8.0, fz), Color(1.0, 0.40, 0.13), 9.0, 90.0)
		_smoke(Vector3(fx + 4.0, fy, fz - 3.0), 34.0 + rng.randf() * 26.0, 150.0 + rng.randf() * 130.0)

	# The teal hollow: the bloom, glowing in its bowl.
	for i: int in 30:
		var a := rng.randf() * TAU
		var d := rng.randf() * 30.0
		var hx := HOLLOW.x + cos(a) * d
		var hz := HOLLOW.z + sin(a) * d
		_glow(Vector3(hx, land_height(hx, hz) + 1.2, hz), 2.5 + rng.randf() * 4.5, Color(0.10, 0.66, 0.58, 0.9))
	_glow(Vector3(HOLLOW.x, -56.0, HOLLOW.z), 70.0, Color(0.04, 0.27, 0.24, 0.55))
	_lamp(Vector3(HOLLOW.x, -50.0, HOLLOW.z), Color(0.20, 0.80, 0.70), 8.0, 60.0)

	# One lit window under the ledge, to the right: the bothy.
	var bx := 46.0
	var bz := -52.0
	var by := land_height(bx, bz)
	_box(Vector3(7, 3.4, 5), Vector3(bx, by + 1.6, bz), Vector3(0, 30, 0), dark)
	_box(Vector3(7.6, 2.2, 3.2), Vector3(bx, by + 3.9, bz), Vector3(38, 30, 0), dark)
	_glow(Vector3(bx - 2.6, by + 1.7, bz + 2.4), 1.8, Color(1.0, 0.78, 0.40, 1.0))

# ------------------------------------------------------------------ the Slagcrown
func _build_slagcrown() -> void:
	var m := _stone(0.06, Color(0.42, 0.38, 0.38))
	var c := CITADEL + Vector3(0, -12.0, 0)
	var yaw := -20.0
	var parts: Array = [
		# [size, offset from the rise's top centre]
		[Vector3(46, 58, 40), Vector3(0, 29, 0)],            # the keep
		[Vector3(18, 44, 18), Vector3(0, 80, 0)],            # the great tower
		[Vector3(130, 24, 14), Vector3(0, 12, 34)],          # the curtain wall
		[Vector3(18, 52, 18), Vector3(-62, 26, 30)],         # gate towers and flankers
		[Vector3(18, 60, 18), Vector3(64, 30, 28)],
		[Vector3(14, 46, 14), Vector3(-34, 23, 36)],
		[Vector3(14, 40, 14), Vector3(30, 20, 38)],
		[Vector3(22, 40, 26), Vector3(-36, 20, -6)],         # halls
		[Vector3(24, 34, 30), Vector3(38, 17, -10)],
		[Vector3(10, 30, 10), Vector3(-84, 15, 6)],          # an outwork, half fallen
		[Vector3(12, 22, 12), Vector3(90, 11, 2)],
	]
	var basis := Basis(Vector3.UP, deg_to_rad(yaw))
	for part: Array in parts:
		_box(part[0], c + basis * (part[1] as Vector3), Vector3(0, yaw, 0), m)
	var spires: Array = [
		[7.0, 46.0, Vector3(0, 125, 0)], [10.0, 26.0, Vector3(-62, 65, 30)], [10.0, 28.0, Vector3(64, 74, 28)],
		[8.0, 22.0, Vector3(-34, 57, 36)], [8.0, 20.0, Vector3(30, 50, 38)], [12.0, 24.0, Vector3(-36, 52, -6)],
		[13.0, 22.0, Vector3(38, 45, -10)], [5.0, 30.0, Vector3(-14, 73, 4)], [5.0, 34.0, Vector3(15, 75, -3)],
	]
	for s: Array in spires:
		_spire(s[0], s[1], c + basis * (s[2] as Vector3), Vector3(0, yaw + 45.0, 0), m)
	# the crown: spoil heaps ringing the pitheads
	for i: int in 9:
		var a := deg_to_rad(18.0 + i * 40.0)
		var px := CITADEL.x + cos(a) * 118.0
		var pz := CITADEL.z + sin(a) * 104.0
		_spire(26.0, 30.0 + (i % 3) * 9.0, Vector3(px, land_height(px, pz) + 9.0, pz), Vector3(0, i * 17.0, 0), m)
	# a slow burn under the walls
	_glow(c + basis * Vector3(-20, 6, 60), 90.0, Color(0.55, 0.15, 0.05, 0.6))
	_glow(c + basis * Vector3(50, 4, 56), 60.0, Color(0.55, 0.15, 0.05, 0.5))
	_smoke(c + basis * Vector3(84, 10, 20), 70.0, 330.0)
	_smoke(c + basis * Vector3(-96, 6, 12), 60.0, 260.0)

# ------------------------------------------------------------------ the ledge: cold where you stand
func _build_ledge() -> void:
	var top := _rock(true)
	var side := _rock(false)
	_box(Vector3(15, 80, 13), Vector3(0.5, -40.0, 1.5), Vector3.ZERO, top)
	_box(Vector3(5, 60, 4), Vector3(-3.5, -30.2, -6.2), Vector3(0, 18, 0), top)
	_box(Vector3(4, 60, 3.4), Vector3(2.2, -30.3, -6.0), Vector3(0, -24, 0), top)
	_box(Vector3(1.6, 1.1, 1.4), Vector3(-4.6, 0.3, -3.6), Vector3(8, 31, 12), top)
	_box(Vector3(0.9, 0.6, 1.1), Vector3(-1.4, 0.15, -5.0), Vector3(-6, 12, 9), top)
	_box(Vector3(3.2, 4.2, 3.0), Vector3(8.4, 1.0, -1.6), Vector3(6, 22, -14), top)
	_box(Vector3(2.4, 6.0, 2.6), Vector3(9.6, 1.8, 1.6), Vector3(-4, -12, 9), side)
	_box(Vector3(1.6, 1.5, 1.8), Vector3(5.2, 0.3, -5.4), Vector3(12, 40, -20), top)
	_box(Vector3(2.2, 2.6, 2.0), Vector3(-7.6, 0.4, -3.0), Vector3(-9, -30, 16), top)
	_box(Vector3(40, 90, 30), Vector3(4, -40.0, 24), Vector3(0, 8, 0), side)

# ------------------------------------------------------------------ people are painted
func _build_people() -> void:
	_partner = Sprite3D.new()
	_partner.texture = _tex_of("partner.png")
	_partner.pixel_size = 1.86 / 150.0
	_partner.billboard = BaseMaterial3D.BILLBOARD_FIXED_Y
	_partner.shaded = false
	_partner.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
	_partner.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	_partner.position = Vector3(0.9, 0.93, -3.4)
	_view.add_child(_partner)
	var shadow := MeshInstance3D.new()
	var shq := QuadMesh.new()
	shq.size = Vector2(1.5, 1.0)
	shadow.mesh = shq
	var shm := StandardMaterial3D.new()
	shm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	shm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	shm.albedo_color = Color(0, 0, 0, 0.7)
	shm.albedo_texture = _blob()
	shadow.material_override = shm
	shadow.rotation_degrees = Vector3(-90, 0, 0)
	shadow.position = Vector3(0.9, 0.02, -3.4)
	_view.add_child(shadow)

func _build_camera() -> void:
	_cam = Camera3D.new()
	_cam.position = Vector3(0, EYE, 1.0)
	_cam.fov = 60.0
	_cam.far = 4000.0
	_view.add_child(_cam)
	_cam.current = true
	_hand_light = OmniLight3D.new()
	_hand_light.shadow_enabled = true
	_cam.add_child(_hand_light)
	_hand_light.position = Vector3(-0.45, -0.25, -0.5)
	_aim()

func _aim() -> void:
	_cam.rotation = Vector3(_pitch, _yaw, 0.0)

# ------------------------------------------------------------------ hands and the ledger panel
func _build_hands() -> void:
	var layer := CanvasLayer.new()
	_view.add_child(layer)
	var ash := Control.new()
	ash.set_script(load("res://scripts/ash_overlay.gd"))
	ash.size = Vector2(LOW)
	layer.add_child(ash)
	_left = TextureRect.new()
	_left.position = Vector2(2, 26)
	layer.add_child(_left)
	_right = TextureRect.new()
	_right.position = Vector2(204, 30)
	layer.add_child(_right)

func _apply_hand() -> void:
	_left.texture = _tex_of("hand_coldlight.png" if _cold else "hand_lantern.png")
	_right.texture = _tex_of("hand_sword_glim.png" if _cold else "hand_sword.png")
	_panel.texture = _tex_of("panel_cold.png" if _cold else "panel.png")
	if _cold:
		_hand_light.light_color = Color(0.60, 0.82, 1.0)
		_hand_light.light_energy = 1.3
		_hand_light.omni_range = 7.0
		_partner.modulate = Color(0.62, 0.74, 0.90)
	else:
		_hand_light.light_color = Color(1.0, 0.80, 0.52)
		_hand_light.light_energy = 1.5
		_hand_light.omni_range = 9.0
		_partner.modulate = Color(0.92, 0.80, 0.66)

func _build_panel() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	_panel = TextureRect.new()
	_panel.texture = _tex_of("panel.png")
	_panel.position = Vector2(0, LOW.y * SCALE)
	layer.add_child(_panel)

# ------------------------------------------------------------------ walking the ledge
func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_yaw -= event.relative.x * 0.0025
		_pitch = clampf(_pitch - event.relative.y * 0.0025, -1.2, 1.2)
		_aim()
	elif event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_L:
			_cold = not _cold
			_apply_hand()
		elif event.keycode == KEY_ESCAPE:
			get_tree().quit()

func _process(delta: float) -> void:
	if Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
		return
	var move := Vector3.ZERO
	if Input.is_physical_key_pressed(KEY_W):
		move.z -= 1.0
	if Input.is_physical_key_pressed(KEY_S):
		move.z += 1.0
	if Input.is_physical_key_pressed(KEY_A):
		move.x -= 1.0
	if Input.is_physical_key_pressed(KEY_D):
		move.x += 1.0
	if move != Vector3.ZERO:
		var step := move.normalized().rotated(Vector3.UP, _yaw) * 2.4 * delta
		_cam.position.x = clampf(_cam.position.x + step.x, -5.5, 4.5)
		_cam.position.z = clampf(_cam.position.z + step.z, -3.6, 6.5)

# ------------------------------------------------------------------ stills
func _settle() -> void:
	for i: int in 6:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw

func _shot(dir: String, file: String) -> void:
	await _settle()
	get_viewport().get_texture().get_image().save_png(dir.path_join(file))
	print("wrote ", file)

func _look(pos: Vector3, yaw_deg: float, pitch_deg: float) -> void:
	_cam.position = pos
	_yaw = deg_to_rad(yaw_deg)
	_pitch = deg_to_rad(pitch_deg)
	_aim()

func _take_shots(dir: String) -> void:
	DirAccess.make_dir_recursive_absolute(dir)
	await _shot(dir, "01_ledge_lantern.png")
	_cold = true
	_apply_hand()
	await _shot(dir, "02_ledge_cold_light.png")
	_cold = false
	_apply_hand()
	_look(Vector3(2.0, EYE, -0.6), 22.0, -5.0)
	await _shot(dir, "03_partner_by_lantern.png")
	_look(Vector3(-3.0, EYE, -3.4), 28.0, -17.0)
	await _shot(dir, "04_down_into_the_country.png")
	get_tree().quit()
