class_name SporeCloud
extends Node3D
## A cloud of ash-spores, burst from a husk. The survivor inside it chokes: health drains,
## stamina barely returns, and they can hardly see (PlayerController.choke(), Perception
## `obscured`). Fire burns spores: a lit torch within reach of the cloud eats it in about a
## second. The weather sets how long a cloud hangs: still air keeps it, wind and sleet clear it
## (Weather's "spores" field). Enemies breathe it without harm: they are spore-kin or used to it.
## A tween-free mesh whose size and alpha follow its remaining life, so it renders anywhere.

const CHOKE_DPS: float = 3.0
## A lit torch held within this distance of the cloud's edge burns it this many times faster.
const TORCH_REACH: float = 2.0
const TORCH_BURN_MULT: float = 10.0

var radius: float = 2.4
var life: float = 8.0
var _life_total: float = 8.0
var _mat: StandardMaterial3D
var _mesh: MeshInstance3D


## A cloud at `pos` (on the ground) of `p_radius` metres that lasts `seconds` before the weather.
static func spawn(parent: Node, pos: Vector3, p_radius: float, seconds: float) -> SporeCloud:
	var c := SporeCloud.new()
	c.name = "SporeCloud"
	c.radius = p_radius
	var weather: Weather = parent.get_node_or_null("Weather") as Weather
	var mult: float = float(weather.profile()["spores"]) if weather != null else 1.0
	c.life = seconds * mult
	c._life_total = c.life
	c.position = Vector3(pos.x, 0.0, pos.z)
	c.add_to_group("spore_cloud")
	parent.add_child(c, true)
	return c


func _init() -> void:
	_mesh = MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 1.0
	sphere.height = 1.0
	sphere.radial_segments = 24
	sphere.rings = 8
	_mesh.mesh = sphere
	_mat = StandardMaterial3D.new()
	_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	_mat.albedo_color = Color(0.62, 0.64, 0.42, 0.34)
	_mat.no_depth_test = false
	_mesh.material_override = _mat
	_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_mesh)


func _ready() -> void:
	_refresh()


func _physics_process(delta: float) -> void:
	var player: PlayerController = _find_player()
	var burn: float = 1.0
	if player != null:
		var d: float = _flat_distance(player.global_position)
		if player.is_torch_lit() and d <= radius + TORCH_REACH:
			burn = TORCH_BURN_MULT
		if d <= radius:
			player.choke(delta, CHOKE_DPS)
	life -= delta * burn
	if life <= 0.0:
		queue_free()
		return
	_refresh()


## True when `point` (on the ground) is inside the cloud.
func contains(point: Vector3) -> bool:
	return _flat_distance(point) <= radius


func _flat_distance(point: Vector3) -> float:
	return Vector2(point.x - global_position.x, point.z - global_position.z).length()


func _find_player() -> PlayerController:
	for n: Node in get_parent().get_children():
		if n is PlayerController:
			return n
	return null


## The cloud swells in its first moments, then thins as its life runs out.
func _refresh() -> void:
	var t: float = clampf(life / maxf(_life_total, 0.01), 0.0, 1.0)
	var swell: float = clampf((1.0 - t) * 6.0, 0.0, 1.0) if t > 0.85 else 1.0
	_mesh.scale = Vector3(radius, radius * 0.55, radius) * lerpf(0.5, 1.0, swell)
	_mesh.position = Vector3(0.0, radius * 0.25, 0.0)
	_mat.albedo_color.a = 0.34 * clampf(t * 3.0, 0.0, 1.0)
