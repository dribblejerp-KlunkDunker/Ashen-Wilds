class_name HurtboxComponent
extends Area3D

signal hit_received(payload: CombatPayload)

@export var owner_entity: Node3D

func _init() -> void:
	monitoring = false
	monitorable = true

func receive_attack(payload: CombatPayload) -> void:
	hit_received.emit(payload)
