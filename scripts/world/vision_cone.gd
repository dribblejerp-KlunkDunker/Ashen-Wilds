class_name VisionCone
extends Node
## Milestone 8: the survivor's 130° vision cone and the charcoal memory map.
## Each physics tick it casts rays across the cone at eye height. It marks the
## cells they cross as "visible now" (cleared every update) and "seen" (kept).
## The vision_memory shader reads both grids, so places you've seen outside
## the cone are drawn as charcoal and places you haven't stay black.

const GRID_ORIGIN := Vector2(-26.0, -26.0)
const GRID_WORLD_SIZE: float = 52.0
const CELLS: int = 156 # ~0.33 m per cell
const RAY_COUNT: int = 96
const EYE_HEIGHT: float = 1.35

var player: PlayerController
var overlay: MeshInstance3D
var enabled: bool = true

## Physics ticks between cone updates (the grids are cheap to read, not to write).
var update_interval_ticks: int = 2

var _seen_bytes: PackedByteArray
var _visible_bytes: PackedByteArray
var _seen_img: Image
var _visible_img: Image
var _tick: int = 0
var _seen_tex: ImageTexture
var _visible_tex: ImageTexture
var _material: ShaderMaterial

func _ready() -> void:
	add_to_group("vision_cone")
	_seen_bytes = PackedByteArray()
	_seen_bytes.resize(CELLS * CELLS)
	_visible_bytes = PackedByteArray()
	_visible_bytes.resize(CELLS * CELLS)
	_seen_img = Image.create_from_data(CELLS, CELLS, false, Image.FORMAT_R8, _seen_bytes)
	_visible_img = Image.create_from_data(CELLS, CELLS, false, Image.FORMAT_R8, _visible_bytes)
	_seen_tex = ImageTexture.create_from_image(_seen_img)
	_visible_tex = ImageTexture.create_from_image(_visible_img)

## Puts the full-screen overlay quad in front of the given camera.
func attach_to_camera(cam: Camera3D) -> void:
	_material = ShaderMaterial.new()
	_material.shader = load("res://shaders/vision_memory.gdshader")
	_material.render_priority = 100
	_material.set_shader_parameter("seen_tex", _seen_tex)
	_material.set_shader_parameter("visible_tex", _visible_tex)
	_material.set_shader_parameter("grid_origin", GRID_ORIGIN)
	_material.set_shader_parameter("grid_world_size", GRID_WORLD_SIZE)
	_material.set_shader_parameter("grid_texel", 1.0 / float(CELLS))
	var quad := QuadMesh.new()
	quad.size = Vector2(2.0, 2.0)
	quad.custom_aabb = AABB(Vector3(-1e4, -1e4, -1e4), Vector3(2e4, 2e4, 2e4))
	overlay = MeshInstance3D.new()
	overlay.name = "VisionMemoryOverlay"
	overlay.mesh = quad
	overlay.material_override = _material
	overlay.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	overlay.extra_cull_margin = 16384.0
	overlay.position = Vector3(0.0, 0.0, -1.0)
	cam.add_child(overlay)

func set_enabled(on: bool) -> void:
	enabled = on
	if _material:
		_material.set_shader_parameter("overlay_enabled", on)

func _physics_process(_delta: float) -> void:
	if player == null or not player.is_inside_tree():
		return
	_tick += 1
	if _tick >= update_interval_ticks:
		_tick = 0
		update_now()

## Re-casts the cone. Public so tests can force an update.
func update_now() -> void:
	_visible_bytes.fill(0)
	var origin: Vector3 = player.global_position + Vector3(0.0, EYE_HEIGHT, 0.0)
	var aim: Vector3 = player.get_aim_direction()
	var half: float = deg_to_rad(player.vision_half_angle_deg)
	var reach: float = player.get_vision_range()
	var space := player.get_world_3d().direct_space_state
	for i in range(RAY_COUNT):
		var t: float = -half + (2.0 * half) * float(i) / float(RAY_COUNT - 1)
		var dir: Vector3 = aim.rotated(Vector3.UP, t)
		var q := PhysicsRayQueryParameters3D.create(origin, origin + dir * reach, 1)
		q.exclude = [player.get_rid()]
		var hit: Dictionary = space.intersect_ray(q)
		var length: float = reach
		if not hit.is_empty():
			# Reach a little into the wall so its face counts as seen.
			length = origin.distance_to(hit["position"]) + 0.3
		_mark_ray(origin, dir, length)
	_mark_disc(player.global_position, player.sense_radius)
	_seen_img.set_data(CELLS, CELLS, false, Image.FORMAT_R8, _seen_bytes)
	_visible_img.set_data(CELLS, CELLS, false, Image.FORMAT_R8, _visible_bytes)
	_seen_tex.update(_seen_img)
	_visible_tex.update(_visible_img)
	if _material:
		_material.set_shader_parameter("player_pos", player.global_position)
		_material.set_shader_parameter("aim_dir", Vector2(aim.x, aim.z))
		_material.set_shader_parameter("cos_half_angle", cos(half))
		_material.set_shader_parameter("vision_range", reach)
		_material.set_shader_parameter("sense_radius", player.sense_radius)

func _cell_of(world: Vector3) -> Vector2i:
	var u: float = (world.x - GRID_ORIGIN.x) / GRID_WORLD_SIZE
	var v: float = (world.z - GRID_ORIGIN.y) / GRID_WORLD_SIZE
	return Vector2i(int(floor(u * CELLS)), int(floor(v * CELLS)))

func _mark(c: Vector2i) -> void:
	if c.x < 0 or c.y < 0 or c.x >= CELLS or c.y >= CELLS:
		return
	var idx: int = c.y * CELLS + c.x
	_visible_bytes[idx] = 255
	_seen_bytes[idx] = 255

func _mark_ray(origin: Vector3, dir: Vector3, length: float) -> void:
	var step: float = GRID_WORLD_SIZE / float(CELLS) * 0.9
	var last := Vector2i(-1, -1)
	var dist: float = 0.0
	while dist <= length:
		var c: Vector2i = _cell_of(origin + dir * dist)
		if c != last:
			_mark(c)
			if dist > 6.0:
				# Rays fan apart with range: thicken them so the cone has no gaps.
				_mark(c + Vector2i(1, 0))
				_mark(c + Vector2i(0, 1))
			last = c
		dist += step

func _mark_disc(center: Vector3, radius: float) -> void:
	var cell: float = GRID_WORLD_SIZE / float(CELLS)
	var r: int = int(ceil(radius / cell))
	var c0: Vector2i = _cell_of(center)
	for dx in range(-r, r + 1):
		for dy in range(-r, r + 1):
			if Vector2(dx, dy).length() * cell <= radius:
				_mark(c0 + Vector2i(dx, dy))

## Milestone 14: the exploration memory, for saving.
func get_seen_bytes() -> PackedByteArray:
	return _seen_bytes

func set_seen_bytes(bytes: PackedByteArray) -> void:
	if bytes.size() != CELLS * CELLS:
		return
	_seen_bytes = bytes
	_seen_img.set_data(CELLS, CELLS, false, Image.FORMAT_R8, _seen_bytes)
	_seen_tex.update(_seen_img)

## True if the spot was lit by the cone on the last update.
func is_visible_now(world: Vector3) -> bool:
	var c: Vector2i = _cell_of(world)
	if c.x < 0 or c.y < 0 or c.x >= CELLS or c.y >= CELLS:
		return false
	return _visible_bytes[c.y * CELLS + c.x] > 127

## True if the spot has ever been seen (it shows on the memory map).
func is_explored(world: Vector3) -> bool:
	var c: Vector2i = _cell_of(world)
	if c.x < 0 or c.y < 0 or c.x >= CELLS or c.y >= CELLS:
		return false
	return _seen_bytes[c.y * CELLS + c.x] > 127
