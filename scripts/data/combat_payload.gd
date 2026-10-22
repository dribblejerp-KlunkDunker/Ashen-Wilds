class_name CombatPayload
extends RefCounted

var attacker: Node3D
var attacker_origin: Vector3
var attack_direction: Vector3
var physical_damage: float = 20.0
var poise_damage: float = 15.0
var causes_bleed: bool = false
var is_heavy: bool = false
var knockback_force: float = 2.5

func _init(
	p_attacker: Node3D,
	p_origin: Vector3,
	p_dir: Vector3,
	p_dmg: float,
	p_poise: float,
	p_bleed: bool = false,
	p_heavy: bool = false,
	p_knockback: float = 2.5
) -> void:
	attacker = p_attacker
	attacker_origin = p_origin
	attack_direction = p_dir.normalized()
	physical_damage = p_dmg
	poise_damage = p_poise
	causes_bleed = p_bleed
	is_heavy = p_heavy
	knockback_force = p_knockback
