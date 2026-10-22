class_name WeaponData
extends Resource

@export var weapon_id: String = "rusted_arming_sword"
@export var display_name: String = "Tarnished Arming Sword"

# Light Attack Timings (seconds) & Costs
@export var light_startup_time: float = 0.24
@export var light_active_time: float = 0.14
@export var light_recovery_time: float = 0.34
@export var light_stamina_cost: float = 16.0
@export var light_damage: float = 22.0
@export var light_poise_damage: float = 18.0
@export var light_step_impulse: float = 3.2

# Heavy Attack Timings (seconds) & Costs
@export var heavy_startup_time: float = 0.52
@export var heavy_active_time: float = 0.18
@export var heavy_recovery_time: float = 0.58
@export var heavy_stamina_cost: float = 30.0
@export var heavy_damage: float = 42.0
@export var heavy_poise_damage: float = 45.0
@export var heavy_step_impulse: float = 5.0
@export var heavy_bleed_chance: float = 0.45

# Geometry & Reach
@export var reach_meters: float = 1.65
@export var swing_arc_degrees: float = 105.0
@export var block_stamina_efficiency: float = 0.55
@export var block_angle_degrees: float = 130.0
