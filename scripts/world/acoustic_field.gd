class_name AcousticField
extends Node
## Milestone 8: one place every noise in the world is reported to.
## `loudness` is how far the sound carries in metres, before weather.
## Listeners (the ripple renderer; later, enemy ears) connect to
## `noise_emitted`.

signal noise_emitted(world_pos: Vector3, loudness: float, source: Node3D, kind: String)

## Scales every noise's reach; Milestone 9 weather sets it.
var hearing_multiplier: float = 1.0

## Milestone 10: a wall between noise and listener cuts the reach to this.
const WALL_MUFFLE: float = 0.6

func _ready() -> void:
	add_to_group("acoustic_field")

func emit_noise(world_pos: Vector3, loudness: float, source: Node3D, kind: String) -> void:
	noise_emitted.emit(world_pos, loudness * hearing_multiplier, source, kind)

## Convenience for emitters that don't hold a reference to the field.
static func report(emitter: Node, world_pos: Vector3, loudness: float, kind: String) -> void:
	if emitter == null or not emitter.is_inside_tree():
		return
	var field := emitter.get_tree().get_first_node_in_group("acoustic_field") as AcousticField
	if field:
		field.emit_noise(world_pos, loudness, emitter as Node3D, kind)

## Like report(), but credits the noise to `source` (a thrown stone's thud
## belongs to whoever threw it).
static func report_as(emitter: Node, source: Node3D, world_pos: Vector3, loudness: float, kind: String) -> void:
	if emitter == null or not emitter.is_inside_tree():
		return
	var field := emitter.get_tree().get_first_node_in_group("acoustic_field") as AcousticField
	if field:
		field.emit_noise(world_pos, loudness, source, kind)

## Connects a listener (an enemy's ear) to the field, if one exists.
static func listen(listener: Node, callback: Callable) -> void:
	if listener == null or not listener.is_inside_tree():
		return
	var field := listener.get_tree().get_first_node_in_group("acoustic_field") as AcousticField
	if field and not field.noise_emitted.is_connected(callback):
		field.noise_emitted.connect(callback)

## The reach of a noise at this listener: stone between them muffles it.
static func muffled_reach(listener: Node3D, noise_pos: Vector3, reach: float) -> float:
	if listener == null or not listener.is_inside_tree():
		return reach
	var from: Vector3 = listener.global_position + Vector3(0.0, 1.2, 0.0)
	var q := PhysicsRayQueryParameters3D.create(from, noise_pos + Vector3(0.0, 1.0, 0.0), 1)
	if listener is CollisionObject3D:
		q.exclude = [(listener as CollisionObject3D).get_rid()]
	var blocked: bool = not listener.get_world_3d().direct_space_state.intersect_ray(q).is_empty()
	return reach * (WALL_MUFFLE if blocked else 1.0)

## True if the listener is close enough to hear a noise (flat distance,
## walls muffle).
static func can_hear(listener: Node3D, noise_pos: Vector3, reach: float) -> bool:
	var flat := Vector2(noise_pos.x - listener.global_position.x, noise_pos.z - listener.global_position.z)
	if flat.length() > reach:
		return false
	return flat.length() <= muffled_reach(listener, noise_pos, reach)

## Footstep cadence helper shared by the enemies: returns the new timer value
## and reports a footstep when it runs out while the body is moving.
static func step_cadence(body: CharacterBody3D, timer: float, delta: float, interval: float, loudness: float) -> float:
	var flat_speed: float = Vector2(body.velocity.x, body.velocity.z).length()
	if flat_speed < 0.6:
		return minf(timer, interval * 0.5)
	timer -= delta * clampf(flat_speed / 3.0, 0.6, 1.6)
	if timer <= 0.0:
		report(body, body.global_position, loudness, "footstep")
		return interval
	return timer
