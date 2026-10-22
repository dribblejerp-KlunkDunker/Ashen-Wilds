class_name IsoCameraRig
extends Node3D

@export var target: Node3D
@export var yaw_degrees: float = 45.0
@export var pitch_degrees: float = -30.0
@export var camera_distance: float = 28.0

@export var ortho_size_default: float = 11.5
@export var ortho_size_min: float = 8.5
@export var ortho_size_max: float = 15.0
@export var zoom_step: float = 1.0

@export var follow_smoothing: float = 8.5
@export var cursor_peek_strength: float = 0.85
@export var max_cursor_peek_distance: float = 1.6

var camera: Camera3D
var shake_intensity_scale: float = 0.75
var _trauma: float = 0.0
var _target_ortho_size: float = 11.5
var _cutaway_materials: Array[ShaderMaterial] = []
var _roof_materials: Array[ShaderMaterial] = []
var _interior_bounds: Array[AABB] = []
var _world_env: WorldEnvironment

func _ready() -> void:
	_target_ortho_size = ortho_size_default
	rotation_degrees = Vector3(0.0, yaw_degrees, 0.0)

	var pitch_pivot := Node3D.new()
	pitch_pivot.name = "PitchPivot"
	pitch_pivot.rotation_degrees = Vector3(pitch_degrees, 0.0, 0.0)
	add_child(pitch_pivot)

	camera = Camera3D.new()
	camera.name = "OrthoCamera3D"
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = ortho_size_default
	camera.near = 0.05
	camera.far = 120.0
	camera.position = Vector3(0.0, 0.0, camera_distance)
	pitch_pivot.add_child(camera)
	camera.make_current()

func register_cutaway_material(mat: ShaderMaterial, is_roof: bool = false) -> void:
	if is_roof:
		_roof_materials.append(mat)
	else:
		_cutaway_materials.append(mat)

func register_interior_aabb(bounds: AABB) -> void:
	_interior_bounds.append(bounds)

func bind_world_environment(env_node: WorldEnvironment) -> void:
	_world_env = env_node

func add_trauma(amount: float) -> void:
	_trauma = clampf(_trauma + amount * shake_intensity_scale, 0.0, 1.0)

func adjust_brightness(delta_val: float) -> void:
	if _world_env and _world_env.environment:
		_world_env.environment.tonemap_exposure = clampf(
			_world_env.environment.tonemap_exposure + delta_val, 0.55, 1.85
		)

func adjust_shake_scale(delta_val: float) -> void:
	shake_intensity_scale = clampf(shake_intensity_scale + delta_val, 0.0, 1.0)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			_target_ortho_size = clampf(_target_ortho_size - zoom_step, ortho_size_min, ortho_size_max)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_target_ortho_size = clampf(_target_ortho_size + zoom_step, ortho_size_min, ortho_size_max)

func _physics_process(delta: float) -> void:
	rotation_degrees = Vector3(0.0, yaw_degrees, 0.0)
	if camera:
		camera.size = lerpf(camera.size, _target_ortho_size, 1.0 - exp(-10.0 * delta))

	if target == null:
		return

	var cursor_world: Vector3 = get_mouse_ground_position(target.global_position.y)
	var offset_to_cursor: Vector3 = cursor_world - target.global_position
	offset_to_cursor.y = 0.0
	if offset_to_cursor.length() > max_cursor_peek_distance:
		offset_to_cursor = offset_to_cursor.normalized() * max_cursor_peek_distance

	var desired_pos: Vector3 = target.global_position + (offset_to_cursor * cursor_peek_strength * 0.25)

	if _trauma > 0.0:
		_trauma = maxf(0.0, _trauma - delta * 2.8)
		var shake_mag: float = (_trauma * _trauma) * 0.22 * shake_intensity_scale
		desired_pos.x += randf_range(-shake_mag, shake_mag)
		desired_pos.z += randf_range(-shake_mag, shake_mag)

	global_position = global_position.lerp(desired_pos, 1.0 - exp(-follow_smoothing * delta))
	_update_occlusion_shaders()

func get_mouse_ground_position(plane_y: float = 0.0) -> Vector3:
	if camera == null:
		return Vector3.ZERO
	var viewport := get_viewport()
	if viewport == null:
		return Vector3.ZERO
	var mouse_pos: Vector2 = viewport.get_mouse_position()
	var ray_origin: Vector3 = camera.project_ray_origin(mouse_pos)
	var ray_dir: Vector3 = camera.project_ray_normal(mouse_pos)
	var ground_plane := Plane(Vector3.UP, plane_y)
	var hit: Variant = ground_plane.intersects_ray(ray_origin, ray_dir)
	if hit != null:
		return hit as Vector3
	return target.global_position if target else Vector3.ZERO

func _update_occlusion_shaders() -> void:
	if target == null or camera == null:
		return
	var p_pos: Vector3 = target.global_position
	var cam_fwd: Vector3 = -camera.global_transform.basis.z.normalized()

	var inside_building: bool = false
	for box: AABB in _interior_bounds:
		if box.has_point(p_pos + Vector3(0.0, 0.8, 0.0)):
			inside_building = true
			break

	for mat: ShaderMaterial in _cutaway_materials:
		mat.set_shader_parameter("player_world_pos", p_pos)
		mat.set_shader_parameter("camera_forward", cam_fwd)

	for r_mat: ShaderMaterial in _roof_materials:
		r_mat.set_shader_parameter("player_world_pos", p_pos)
		r_mat.set_shader_parameter("camera_forward", cam_fwd)
		r_mat.set_shader_parameter("force_roof_hide", inside_building)
