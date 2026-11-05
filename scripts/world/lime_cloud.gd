class_name LimeCloud
extends Node3D
## A cloud of quicklime, from a sack the survivor split and threw (PlayerController, the [G] key). In
## the Roofed Mile story a lime sack burst across the passage and the beast "withdrew, coughing" and
## rubbed its muzzle on the paving (docs: roofed-mile-third-arch.md). Anything in it with eyes that
## knows how to be blinded (a `blind(seconds)` method: the gallery-crawler) is blinded and backs off.
## It burns the survivor's eyes and throat too: inside it they choke (PlayerController.choke(), cause
## "LIME"): no wound, but stamina barely returns and they can hardly see. The weather sets how long it
## hangs, by the same field as spores (Weather's "spores": wind and sleet clear it, still air keeps it).
## Lime stops ash-spores (canon 16, "Lime the dead or meet them"): a spore cloud it touches burns
## away SPORE_KILL_MULT times faster, as a torch burns one.

const RADIUS: float = 2.6
const SECONDS: float = 6.0
## Each tick inside it re-blinds an enemy for at least this long.
const BLIND_SECONDS: float = 4.0
const SPORE_KILL_MULT: float = 10.0

var radius: float = RADIUS
var life: float = SECONDS
var _life_total: float = SECONDS
var _mat: StandardMaterial3D
var _mesh: MeshInstance3D


## A cloud at `pos` (on the ground) that hangs `seconds` before the weather.
static func spawn(parent: Node, pos: Vector3, seconds: float = SECONDS) -> LimeCloud:
	var c := LimeCloud.new()
	c.name = "LimeCloud"
	var weather: Weather = parent.get_node_or_null("Weather") as Weather
	var mult: float = float(weather.profile()["spores"]) if weather != null else 1.0
	c.life = seconds * mult
	c._life_total = c.life
	c.position = Vector3(pos.x, 0.0, pos.z)
	c.add_to_group("lime_cloud")
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
	_mat.albedo_color = Color(0.92, 0.91, 0.86, 0.38)
	_mesh.material_override = _mat
	_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_mesh)


func _ready() -> void:
	_refresh()


func _physics_process(delta: float) -> void:
	for n: Node in get_parent().get_children():
		if n is PlayerController:
			if contains((n as Node3D).global_position):
				(n as PlayerController).choke(delta, 0.0, "LIME")
		elif n is SporeCloud:
			var spores := n as SporeCloud
			if Vector2(spores.global_position.x - global_position.x, spores.global_position.z - global_position.z).length() <= radius + spores.radius:
				spores.life -= delta * (SPORE_KILL_MULT - 1.0)
		elif n is Node3D and n.has_method("blind") and contains((n as Node3D).global_position):
			n.call("blind", BLIND_SECONDS)
	life -= delta
	if life <= 0.0:
		queue_free()
		return
	_refresh()


## True when `point` (on the ground) is inside the cloud.
func contains(point: Vector3) -> bool:
	return Vector2(point.x - global_position.x, point.z - global_position.z).length() <= radius


## It bursts out at once, then settles and thins as its life runs out.
func _refresh() -> void:
	var t: float = clampf(life / maxf(_life_total, 0.01), 0.0, 1.0)
	var burst: float = clampf((1.0 - t) * 10.0, 0.0, 1.0) if t > 0.9 else 1.0
	_mesh.scale = Vector3(radius, radius * 0.5, radius) * lerpf(0.4, 1.0, burst)
	_mesh.position = Vector3(0.0, radius * 0.2, 0.0)
	_mat.albedo_color.a = 0.38 * clampf(t * 3.0, 0.0, 1.0)
