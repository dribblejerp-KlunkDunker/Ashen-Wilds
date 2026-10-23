class_name WeatherSystem
extends Node3D
## Milestone 9: weather & atmosphere. One weather is active at a time. It
## blends in over `transition_time` and cycles every few minutes (F4 advances
## it). Each weather scales sight, hearing, fire and footing; gameplay code
## asks `WeatherSystem.factor(node, key)`, which returns the neutral value
## when no weather exists. Interiors shelter you from fire and footing
## effects, but not from fog, sound or miasma. Precipitation is CPU-animated
## MultiMesh flakes, not particles, so it renders in software-Vulkan
## screenshots.

signal weather_changed(weather: Weather, display_name: String, summary: String)

enum Weather { OVERCAST, ASHFALL, MIASMA, SLEET, CINDER_SQUALL, HOARFROST, DEAD_CALM }
enum Precip { NONE, ASH, SLEET, EMBERS, FROST }

## Keys whose effect a roof cancels.
const SHELTERED_KEYS: Array[String] = ["torch_burn", "torch_light", "traction", "sprint", "dodge_extra"]
const PRECIP_COUNT: int = 360
const PRECIP_BOX := Vector3(22.0, 9.0, 22.0)

@export var cycle_enabled: bool = true
@export var min_duration: float = 150.0
@export var max_duration: float = 240.0
@export var transition_time: float = 8.0
@export var gust_interval_min: float = 5.0
@export var gust_interval_max: float = 9.0
@export var gust_strength: float = 5.5

var current: Weather = Weather.OVERCAST
var player: PlayerController
var environment: Environment
var sun: DirectionalLight3D
var acoustics: AcousticField

var _from: Dictionary = {}
var _to: Dictionary = {}
var _blend: float = 1.0
var _time_left: float = 0.0
var _interiors: Array[AABB] = []
var _gust_timer: float = 0.0
var _gust_dir := Vector3(1.0, 0.0, 0.4)
var _gust_flare: float = 0.0
var _precip_mm: MultiMesh
var _precip_node: MultiMeshInstance3D
var _precip_pos: PackedVector3Array
var _precip_kind: Precip = Precip.NONE
var _precip_t: float = 0.0

static var _profiles: Dictionary = {}

func _ready() -> void:
	add_to_group("weather")
	_to = profile(current)
	_from = _to
	_blend = 1.0
	_time_left = randf_range(min_duration, max_duration)
	_gust_timer = randf_range(gust_interval_min, gust_interval_max)
	_build_precip()
	_apply_environment()

# ------------------------------------------------------------------------------
# Profiles
# ------------------------------------------------------------------------------
static func profile(w: Weather) -> Dictionary:
	if _profiles.is_empty():
		_build_profiles()
	return _profiles[w]

static func _p(display: String, summary: String, values: Dictionary) -> Dictionary:
	var d: Dictionary = {
		"name": display,
		"summary": summary,
		"sight": 1.0,
		"hearing": 1.0,
		"torch_burn": 1.0,
		"torch_light": 1.0,
		"traction": 1.0,
		"sprint": 1.0,
		"dodge_extra": 0.0,
		"stamina_regen": 1.0,
		"gusts": 0.0,
		"precip": Precip.NONE,
		"fog_color": Color(0.12, 0.12, 0.13),
		"fog_density": 0.012,
		"ambient_color": Color(0.16, 0.17, 0.19),
		"sun_color": Color(0.58, 0.62, 0.68),
		"sun_energy": 0.65,
		"cold": 1.0,
	}
	d.merge(values, true)
	return d

static func _build_profiles() -> void:
	_profiles[Weather.OVERCAST] = _p("Overcast", "Grey skies. Nothing in the air but ash-stink.", {})
	_profiles[Weather.ASHFALL] = _p("Ashfall", "Ash muffles sound and swallows the horizon. Sight −25%, hearing ×0.8.", {
		"sight": 0.75, "hearing": 0.8, "precip": Precip.ASH,
		"fog_color": Color(0.17, 0.16, 0.15), "fog_density": 0.035,
		"ambient_color": Color(0.17, 0.16, 0.15), "sun_energy": 0.45,
	})
	_profiles[Weather.MIASMA] = _p("Miasma Fog", "Bog-rot fog. Sight halved; every breath tires you (stamina regen −25%).", {
		"sight": 0.5, "stamina_regen": 0.75, "cold": 1.1,
		"fog_color": Color(0.10, 0.14, 0.08), "fog_density": 0.075,
		"ambient_color": Color(0.13, 0.17, 0.12), "sun_color": Color(0.50, 0.60, 0.42), "sun_energy": 0.35,
	})
	_profiles[Weather.SLEET] = _p("Sleet", "Sleet hiss masks noise (×0.7). Torches burn 2× faster; slick footing: sprint −10%, dodges +4 stamina.", {
		"sight": 0.85, "hearing": 0.7, "torch_burn": 2.0, "sprint": 0.9, "dodge_extra": 4.0, "precip": Precip.SLEET, "cold": 2.2,
		"fog_color": Color(0.12, 0.13, 0.155), "fog_density": 0.026,
		"ambient_color": Color(0.14, 0.16, 0.19), "sun_energy": 0.45,
	})
	_profiles[Weather.CINDER_SQUALL] = _p("Cinder-Squall", "Wind roar drowns sound (×0.6). Torches flare (+30% light). Ember gusts shove you about outdoors.", {
		"sight": 0.9, "hearing": 0.6, "torch_light": 1.3, "gusts": 1.0, "precip": Precip.EMBERS, "cold": 0.6,
		"fog_color": Color(0.22, 0.11, 0.05), "fog_density": 0.02,
		"ambient_color": Color(0.22, 0.14, 0.10), "sun_color": Color(0.85, 0.48, 0.28), "sun_energy": 0.55,
	})
	_profiles[Weather.HOARFROST] = _p("Hoarfrost", "Crisp air: sight +15%, and sound carries (×1.25). Torches burn low (−20% light). Ice underfoot: you slide.", {
		"sight": 1.15, "hearing": 1.25, "torch_light": 0.8, "traction": 0.22, "precip": Precip.FROST, "cold": 2.8,
		"fog_color": Color(0.15, 0.17, 0.21), "fog_density": 0.007,
		"ambient_color": Color(0.17, 0.19, 0.24), "sun_color": Color(0.68, 0.76, 0.88), "sun_energy": 0.8,
	})
	_profiles[Weather.DEAD_CALM] = _p("Dead Calm", "No wind at all. Every sound carries (×1.6). Torches burn steady and slow (×0.8).", {
		"hearing": 1.6, "torch_burn": 0.8, "cold": 1.2,
		"fog_color": Color(0.09, 0.09, 0.095), "fog_density": 0.016,
		"ambient_color": Color(0.14, 0.14, 0.15), "sun_energy": 0.55,
	})

# ------------------------------------------------------------------------------
# Queries
# ------------------------------------------------------------------------------
static func find(node: Node) -> WeatherSystem:
	if node == null or not node.is_inside_tree():
		return null
	return node.get_tree().get_first_node_in_group("weather") as WeatherSystem

## The effective value of `key` for a node, with shelter applied. Returns the
## neutral value (1.0, or 0.0 for dodge_extra) when there's no weather.
static func factor(node: Node3D, key: String) -> float:
	var w: WeatherSystem = find(node)
	if w == null:
		return 0.0 if key == "dodge_extra" else 1.0
	return w.value_at(key, node.global_position)

func value(key: String) -> float:
	return lerpf(float(_from[key]), float(_to[key]), _blend)

func value_at(key: String, pos: Vector3) -> float:
	if key in SHELTERED_KEYS and is_sheltered(pos):
		return 0.0 if key == "dodge_extra" else 1.0
	var v: float = value(key)
	if key == "torch_light" and _gust_flare > 0.0:
		v *= 1.0 + 0.35 * _gust_flare
	return v

func register_interior(bounds: AABB) -> void:
	_interiors.append(bounds)

func is_sheltered(pos: Vector3) -> bool:
	for box: AABB in _interiors:
		if box.has_point(pos + Vector3(0.0, 0.8, 0.0)):
			return true
	return false

func get_display_name() -> String:
	return String(_to["name"])

func get_summary() -> String:
	return String(_to["summary"])

func is_transitioning() -> bool:
	return _blend < 1.0

# ------------------------------------------------------------------------------
# Changing weather
# ------------------------------------------------------------------------------
func set_weather(w: Weather, instant: bool = false) -> void:
	# Start the new blend from wherever the old one had got to.
	var snapshot: Dictionary = {}
	for k: String in _to.keys():
		var a: Variant = _from[k]
		var b: Variant = _to[k]
		if a is float:
			snapshot[k] = lerpf(a, b, _blend)
		elif a is Color:
			snapshot[k] = (a as Color).lerp(b as Color, _blend)
		else:
			snapshot[k] = b if _blend >= 0.5 else a
	current = w
	_from = snapshot
	_to = profile(w)
	_blend = 1.0 if instant else 0.0
	_time_left = randf_range(min_duration, max_duration)
	_gust_timer = randf_range(gust_interval_min, gust_interval_max)
	_apply_environment()
	weather_changed.emit(w, get_display_name(), get_summary())

## Moves to the next weather in the list (F4).
func advance(instant: bool = false) -> void:
	set_weather(((int(current) + 1) % Weather.size()) as Weather, instant)

func _physics_process(delta: float) -> void:
	if _blend < 1.0:
		_blend = minf(1.0, _blend + delta / maxf(transition_time, 0.01))
		_apply_environment()
	if cycle_enabled:
		_time_left -= delta
		if _time_left <= 0.0:
			var next: int = randi_range(0, Weather.size() - 2)
			if next >= int(current):
				next += 1
			set_weather(next as Weather)
	_update_gusts(delta)

func _apply_environment() -> void:
	if acoustics:
		acoustics.hearing_multiplier = value("hearing")
	if environment:
		environment.fog_light_color = (_from["fog_color"] as Color).lerp(_to["fog_color"], _blend)
		environment.fog_density = value("fog_density")
		environment.ambient_light_color = (_from["ambient_color"] as Color).lerp(_to["ambient_color"], _blend)
	if sun:
		sun.light_color = (_from["sun_color"] as Color).lerp(_to["sun_color"], _blend)
		sun.light_energy = value("sun_energy")

# ------------------------------------------------------------------------------
# Cinder-squall gusts
# ------------------------------------------------------------------------------
func _update_gusts(delta: float) -> void:
	_gust_flare = maxf(0.0, _gust_flare - delta * 1.5)
	if value("gusts") < 0.5 or player == null:
		return
	_gust_timer -= delta
	if _gust_timer > 0.0:
		return
	_gust_timer = randf_range(gust_interval_min, gust_interval_max)
	trigger_gust()

## Shoves the survivor downwind if they're outdoors. Returns true if it hit.
func trigger_gust() -> bool:
	_gust_dir = _gust_dir.rotated(Vector3.UP, randf_range(-0.6, 0.6)).normalized()
	_gust_flare = 1.0
	if player == null or is_sheltered(player.global_position):
		return false
	player.apply_gust(_gust_dir * gust_strength)
	return true

# ------------------------------------------------------------------------------
# Precipitation (MultiMesh, CPU-animated)
# ------------------------------------------------------------------------------
func _build_precip() -> void:
	_precip_mm = MultiMesh.new()
	_precip_mm.transform_format = MultiMesh.TRANSFORM_3D
	_precip_mm.instance_count = PRECIP_COUNT
	_precip_mm.visible_instance_count = 0
	_precip_node = MultiMeshInstance3D.new()
	_precip_node.name = "Precipitation"
	_precip_node.multimesh = _precip_mm
	_precip_node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_precip_node.extra_cull_margin = 64.0
	add_child(_precip_node)
	_precip_pos = PackedVector3Array()
	_precip_pos.resize(PRECIP_COUNT)
	for i in range(PRECIP_COUNT):
		_precip_pos[i] = Vector3(randf() * PRECIP_BOX.x, randf() * PRECIP_BOX.y, randf() * PRECIP_BOX.z) - Vector3(PRECIP_BOX.x * 0.5, 0.0, PRECIP_BOX.z * 0.5)

func _set_precip_kind(kind: Precip) -> void:
	_precip_kind = kind
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	var mesh := BoxMesh.new()
	match kind:
		Precip.ASH:
			mesh.size = Vector3(0.06, 0.06, 0.06)
			mat.albedo_color = Color(0.62, 0.60, 0.56, 0.75)
		Precip.SLEET:
			mesh.size = Vector3(0.02, 0.42, 0.02)
			mat.albedo_color = Color(0.70, 0.76, 0.85, 0.55)
		Precip.EMBERS:
			mesh.size = Vector3(0.05, 0.05, 0.05)
			mat.albedo_color = Color(1.0, 0.55, 0.18, 0.95)
		Precip.FROST:
			mesh.size = Vector3(0.035, 0.035, 0.035)
			mat.albedo_color = Color(0.85, 0.92, 1.0, 0.8)
	mesh.material = mat
	_precip_mm.mesh = mesh

## The precipitation drawn right now: the outgoing weather's for the first
## half of a transition, the incoming one's after.
func get_active_precip() -> Precip:
	var kind: int = int(_to["precip"]) if _blend >= 0.5 else int(_from["precip"])
	return kind as Precip

func get_precip_visible_count() -> int:
	return _precip_mm.visible_instance_count if _precip_mm else 0

func _process(delta: float) -> void:
	var kind: Precip = get_active_precip()
	var amount: float = absf(_blend - 0.5) * 2.0 if _blend < 1.0 else 1.0
	if kind == Precip.NONE or amount <= 0.01:
		_precip_mm.visible_instance_count = 0
		return
	if kind != _precip_kind or _precip_mm.mesh == null:
		_set_precip_kind(kind)
	var density: float = 0.35 if kind == Precip.FROST else 1.0
	var count: int = int(PRECIP_COUNT * density * amount)
	_precip_mm.visible_instance_count = count
	var center: Vector3 = player.global_position if player else Vector3.ZERO
	_precip_node.global_position = Vector3(center.x, 0.0, center.z)
	_precip_t += delta
	var vel: Vector3
	match kind:
		Precip.ASH:
			vel = Vector3(0.35, -0.9, 0.2)
		Precip.SLEET:
			vel = Vector3(1.6, -9.0, 0.9)
		Precip.EMBERS:
			vel = _gust_dir * (2.4 + 3.0 * _gust_flare) + Vector3(0.0, 0.5, 0.0)
		_:
			vel = Vector3(0.08, -0.25, 0.04)
	var half_x: float = PRECIP_BOX.x * 0.5
	var half_z: float = PRECIP_BOX.z * 0.5
	var tilt := Basis()
	if kind == Precip.SLEET:
		tilt = Basis(Vector3(0.0, 0.0, 1.0), -0.17)
	for i in range(count):
		var p: Vector3 = _precip_pos[i] + vel * delta
		if kind == Precip.ASH or kind == Precip.EMBERS:
			p.x += sin(_precip_t * 1.7 + float(i)) * 0.4 * delta
			p.z += cos(_precip_t * 1.3 + float(i) * 0.7) * 0.4 * delta
		if p.y < 0.0:
			p.y += PRECIP_BOX.y
		elif p.y > PRECIP_BOX.y:
			p.y -= PRECIP_BOX.y
		p.x = wrapf(p.x, -half_x, half_x)
		p.z = wrapf(p.z, -half_z, half_z)
		_precip_pos[i] = p
		var world := Vector3(center.x + p.x, p.y, center.z + p.z)
		var t := Transform3D(tilt, p)
		if is_sheltered(Vector3(world.x, 0.0, world.z)):
			t = t.scaled_local(Vector3.ZERO) # nothing falls through the roof
		_precip_mm.set_instance_transform(i, t)
