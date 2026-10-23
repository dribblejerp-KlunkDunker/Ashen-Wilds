class_name AcousticField
extends Node
## Milestone 8: one place every noise in the world is reported to.
## `loudness` is how far the sound carries in metres, before weather.
## Listeners (the ripple renderer; later, enemy ears) connect to
## `noise_emitted`.

signal noise_emitted(world_pos: Vector3, loudness: float, source: Node3D, kind: String)

## Scales every noise's reach; Milestone 9 weather sets it.
var hearing_multiplier: float = 1.0

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
