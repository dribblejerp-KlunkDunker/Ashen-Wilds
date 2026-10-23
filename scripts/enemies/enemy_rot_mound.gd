class_name EnemyRotMound
extends StaticBody3D
## Milestone 16: a Rot Mound. A fungal heap in the marsh that bursts into
## spores when it's touched, struck, or hit by a thrown stone. Anyone in the
## cloud gets spore-sick (see PlayerController.afflict_spores). A lit torch
## held close burns it away safely; a thrown stone pops it from range.

signal mound_event_banner(text: String, col: Color)

@export var enemy_name: String = "Rot Mound"
@export var touch_radius: float = 1.3
@export var spore_radius: float = 3.0
@export var spore_duration: float = 25.0
@export var burn_radius: float = 1.6
@export var burn_time: float = 1.5

## Weapons don't lodge in rot.
var can_lodge: bool = false
var health: float = 1.0
var player_ref: PlayerController
var audio: ProceduralAudio
var coordinator: EncounterCoordinator

var _gone: bool = false
var _burn: float = 0.0
var _visual_root: Node3D
var _mat: StandardMaterial3D
var _hurtbox: HurtboxComponent

func _ready() -> void:
	add_to_group("enemy")
	_build_mound_visuals_and_colliders()
	AcousticField.listen(self, _on_noise_heard)

func _physics_process(delta: float) -> void:
	if player_ref:
		_visual_root.visible = not _gone and player_ref.can_see_body(self)
	if _gone or player_ref == null or player_ref.current_state == PlayerController.ActionState.DEAD:
		return
	var d: float = Vector2(player_ref.global_position.x - global_position.x, player_ref.global_position.z - global_position.z).length()
	if player_ref.is_torch_lit() and d <= burn_radius:
		_burn += delta
		_mat.albedo_color = Color(0.40, 0.28, 0.12).lerp(Color(0.95, 0.45, 0.15), clampf(_burn / burn_time, 0.0, 1.0))
		if _burn >= burn_time:
			burn_away()
		return
	if d <= touch_radius:
		burst()

func is_dead() -> bool:
	return _gone

func is_staggered() -> bool:
	return false

func _on_noise_heard(world_pos: Vector3, _reach: float, _source: Node3D, kind: String) -> void:
	if _gone or kind != "thud":
		return
	if Vector2(world_pos.x - global_position.x, world_pos.z - global_position.z).length() <= 1.5:
		burst()

func _on_hurtbox_hit_received(_payload: CombatPayload) -> void:
	burst()

## Pops in a cloud of spores. Anyone inside gets spore-sick.
func burst() -> void:
	if _gone:
		return
	_gone = true
	health = 0.0
	collision_layer = 0
	_hurtbox.set_deferred("monitorable", false)
	if audio:
		audio.play_cough()
	AcousticField.report(self, global_position, 8.0, "burst")
	_spawn_spore_cloud()
	if player_ref and player_ref.current_state != PlayerController.ActionState.DEAD:
		var d: float = Vector2(player_ref.global_position.x - global_position.x, player_ref.global_position.z - global_position.z).length()
		if d <= spore_radius:
			player_ref.afflict_spores(spore_duration)

## Burned by torchlight: no spores.
func burn_away() -> void:
	if _gone:
		return
	_gone = true
	health = 0.0
	collision_layer = 0
	_hurtbox.set_deferred("monitorable", false)
	mound_event_banner.emit("The rot mound shrivels in your torch flame", Color(0.90, 0.62, 0.30))

func _spawn_spore_cloud() -> void:
	var parent: Node = get_parent()
	if parent == null:
		return
	var cloud := MeshInstance3D.new()
	cloud.name = "SporeCloud"
	var mesh := SphereMesh.new()
	mesh.radius = 1.0
	mesh.height = 1.2
	cloud.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_color = Color(0.62, 0.70, 0.30, 0.5)
	cloud.material_override = mat
	parent.add_child(cloud)
	cloud.global_position = global_position + Vector3(0.0, 0.5, 0.0)
	cloud.scale = Vector3.ONE * 0.3
	var tween := cloud.create_tween().set_parallel(true)
	tween.tween_property(cloud, "scale", Vector3(spore_radius, spore_radius * 0.6, spore_radius), 1.2).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.tween_property(mat, "albedo_color:a", 0.0, 2.2).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tween.chain().tween_callback(cloud.queue_free)

# ------------------------------------------------------------------------------
# Visuals (placeholder; see docs/VISUAL_DIRECTION.md, sheet 12 "rot mounds")
# ------------------------------------------------------------------------------
func _build_mound_visuals_and_colliders() -> void:
	collision_layer = 0 # waist-high rot: you walk into it, not around it
	collision_mask = 0
	_visual_root = Node3D.new()
	add_child(_visual_root)
	_mat = StandardMaterial3D.new()
	_mat.albedo_color = Color(0.40, 0.28, 0.12)
	_mat.roughness = 0.6
	var heap := MeshInstance3D.new()
	var h_mesh := SphereMesh.new()
	h_mesh.radius = 0.6
	h_mesh.height = 0.7
	heap.mesh = h_mesh
	heap.material_override = _mat
	heap.position = Vector3(0.0, 0.2, 0.0)
	_visual_root.add_child(heap)
	var cap_mat := StandardMaterial3D.new()
	cap_mat.albedo_color = Color(0.58, 0.62, 0.30)
	for off: Vector3 in [Vector3(0.2, 0.5, 0.1), Vector3(-0.25, 0.45, -0.1), Vector3(0.0, 0.55, -0.25)]:
		var pod := MeshInstance3D.new()
		var p_mesh := SphereMesh.new()
		p_mesh.radius = 0.12
		p_mesh.height = 0.18
		pod.mesh = p_mesh
		pod.material_override = cap_mat
		pod.position = off
		_visual_root.add_child(pod)

	_hurtbox = HurtboxComponent.new()
	_hurtbox.owner_entity = self
	_hurtbox.collision_layer = 16
	_hurtbox.collision_mask = 0
	var hurt_col := CollisionShape3D.new()
	var sphere := SphereShape3D.new()
	sphere.radius = 0.7
	hurt_col.shape = sphere
	hurt_col.position = Vector3(0.0, 0.4, 0.0)
	_hurtbox.add_child(hurt_col)
	add_child(_hurtbox)
	_hurtbox.hit_received.connect(_on_hurtbox_hit_received)
