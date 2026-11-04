class_name FlickerLight
extends OmniLight3D
## A fire's light that breathes: energy and range wander around their base values with layered
## sines (no randomness, so screenshots and tests are repeatable). An optional emissive material
## (the embers) brightens and dims with it.

var base_energy: float = 2.4
var base_range: float = 9.0
var ember_material: StandardMaterial3D
var ember_base_energy: float = 1.4
var _t: float = 0.0


func _ready() -> void:
	base_energy = light_energy
	base_range = omni_range
	if ember_material:
		ember_base_energy = ember_material.emission_energy_multiplier


func _process(delta: float) -> void:
	_t += delta
	var f: float = 0.86 + 0.08 * sin(_t * 9.1) + 0.04 * sin(_t * 23.7 + 1.1) + 0.03 * sin(_t * 3.3 + 0.4)
	light_energy = base_energy * f
	omni_range = base_range * (0.96 + 0.04 * f)
	if ember_material:
		ember_material.emission_energy_multiplier = ember_base_energy * (0.75 + 0.35 * f)
