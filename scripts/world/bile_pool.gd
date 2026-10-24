class_name BilePool
extends Node3D
## Milestone 21: a slick of Rot-Beast bile on the ground. A strip
## `length` long and `width` wide, laid along -Z from where it was spat.
## While the survivor stands in it they're slowed, take a little damage and
## their worn armour corrodes. It soaks away after `lifetime` seconds.

@export var length: float = 6.0
@export var width: float = 1.4
@export var lifetime: float = 9.0
@export var slow_mult: float = 0.55
@export var dps: float = 3.0
@export var corrode_per_second: float = 3.0

var player_ref: PlayerController
var _age: float = 0.0
var _mat: StandardMaterial3D

func _ready() -> void:
	add_to_group("bile_pool")
	_mat = StandardMaterial3D.new()
	_mat.albedo_color = Color(0.42, 0.46, 0.14, 0.85)
	_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_mat.roughness = 0.2 # wet and glistening
	var slick := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(width, 0.02, length)
	slick.mesh = mesh
	slick.material_override = _mat
	slick.position = Vector3(0.0, 0.02, -length * 0.5)
	slick.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(slick)

## True if `pos` (world) is on the slick.
func contains(pos: Vector3) -> bool:
	var local: Vector3 = to_local(pos)
	return absf(local.x) <= width * 0.5 and local.z <= 0.0 and local.z >= -length

func _physics_process(delta: float) -> void:
	_age += delta
	if _age >= lifetime:
		queue_free()
		return
	_mat.albedo_color.a = 0.85 * clampf((lifetime - _age) / 2.0, 0.0, 1.0)
	if player_ref and player_ref.current_state != PlayerController.ActionState.DEAD and contains(player_ref.global_position):
		player_ref.apply_slow(slow_mult, 0.25)
		player_ref.take_hazard_damage(dps * delta)
		player_ref.corrode_armor(corrode_per_second * delta)
