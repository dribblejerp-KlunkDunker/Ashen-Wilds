class_name ItemData
extends Resource
## Static definition of an item type. Runtime state (condition, quantity)
## lives on ItemInstance.

enum Category { WEAPON, SHIELD, TORCH, CONSUMABLE, MATERIAL, TOOL }
enum WeaponClass { NONE, BLADE, POLEARM, AXE }

@export var item_id: String = ""
@export var display_name: String = ""
@export_multiline var description: String = ""
@export var category: Category = Category.MATERIAL
@export var weight_kg: float = 0.5
@export var max_stack: int = 1
## 0 = item has no durability. For torches this is fuel in seconds.
@export var max_condition: float = 0.0

# Weapon
@export var weapon: WeaponData
@export var weapon_class: WeaponClass = WeaponClass.NONE
@export var two_handed: bool = false
## Multiplier on condition lost per landed hit (light = 1x, heavy = 2x).
@export var wear_per_hit: float = 1.0

# Shield
@export var block_stamina_efficiency: float = 0.55
@export var block_angle_degrees: float = 130.0
## Condition lost per point of blocked poise damage.
@export var block_wear_per_poise: float = 0.2

# Torch
@export var light_range: float = 7.5
@export var light_energy: float = 1.35

# Consumable
@export var use_duration: float = 1.6

func is_stackable() -> bool:
	return max_stack > 1

func has_durability() -> bool:
	return max_condition > 0.0

func is_equippable() -> bool:
	return category in [Category.WEAPON, Category.SHIELD, Category.TORCH]
