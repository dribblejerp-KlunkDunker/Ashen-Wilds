class_name AcousticRipples
extends Node3D
## Milestone 8: noises from threats you can't see appear as dust-ring
## ripples at their source. Size follows loudness and opacity follows
## distance. Drawn over walls and the memory map so you can read what's
## behind the stone.

## Never more than one ripple per source in this window.
@export var per_source_cooldown: float = 0.28
@export var max_ring_radius: float = 2.6

var player: PlayerController
var _last_ripple: Dictionary = {}

func bind(field: AcousticField, p: PlayerController) -> void:
	player = p
	field.noise_emitted.connect(_on_noise)

func _on_noise(world_pos: Vector3, loudness: float, source: Node3D, _kind: String) -> void:
	if player == null or source == player:
		return
	var dist: float = Vector2(world_pos.x - player.global_position.x, world_pos.z - player.global_position.z).length()
	if not AcousticField.can_hear(player, world_pos, loudness):
		return # too far to hear (walls muffle)
	if source != null and is_instance_valid(source) and player.can_see_body(source):
		return # you can see it; no need to hear it
	var now: float = Time.get_ticks_msec() / 1000.0
	var key: int = source.get_instance_id() if source != null else 0
	if key != 0 and now - float(_last_ripple.get(key, -10.0)) < per_source_cooldown:
		return
	_last_ripple[key] = now
	var closeness: float = 1.0 - clampf(dist / maxf(loudness, 0.01), 0.0, 1.0)
	spawn_ripple(world_pos, clampf(loudness / 18.0, 0.0, 1.0), lerpf(0.35, 0.9, closeness))

## A pair of expanding dust rings. `size01` 0..1 maps to ring radius.
func spawn_ripple(at: Vector3, size01: float, alpha: float) -> Node3D:
	var root := Node3D.new()
	root.name = "Ripple"
	root.add_to_group("acoustic_ripple")
	add_child(root)
	root.global_position = Vector3(at.x, 0.06, at.z)
	var radius: float = lerpf(0.5, max_ring_radius, size01)
	var tween := root.create_tween().set_parallel(true)
	for i in range(2):
		var mat := StandardMaterial3D.new()
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.no_depth_test = true
		mat.render_priority = 120
		mat.albedo_color = Color(0.80, 0.72, 0.58, alpha * (1.0 if i == 0 else 0.6))
		var ring := MeshInstance3D.new()
		var torus := TorusMesh.new()
		torus.inner_radius = 0.92
		torus.outer_radius = 1.0
		torus.rings = 48
		ring.mesh = torus
		ring.material_override = mat
		ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		ring.scale = Vector3(0.15, 0.05, 0.15)
		root.add_child(ring)
		var delay: float = 0.12 * i
		var life: float = 0.85 + 0.25 * size01
		var end_r: float = radius * (1.0 if i == 0 else 0.7)
		tween.tween_property(ring, "scale", Vector3(end_r, 0.05, end_r), life).set_delay(delay).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
		tween.tween_property(mat, "albedo_color:a", 0.0, life).set_delay(delay).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tween.chain().tween_callback(root.queue_free)
	return root

func active_ripple_count() -> int:
	var n: int = 0
	for c: Node in get_children():
		if c.is_in_group("acoustic_ripple") and not c.is_queued_for_deletion():
			n += 1
	return n
