class_name ItemData
extends Resource
## Static definition of an item type. Runtime state (condition, quantity)
## lives on ItemInstance.

## NOTE: something written (a note, a page, a tag) that can be read from the pack. Appended last so
## the earlier values keep their numbers.
enum Category { WEAPON, SHIELD, TORCH, CONSUMABLE, MATERIAL, TOOL, ARMOUR, NOTE }
## Where a piece of armour is worn. One piece per slot.
enum ArmourSlot { NONE, HEAD, BODY, LEGS }
enum WeaponClass { NONE, BLADE, POLEARM, AXE }

@export var item_id: String = ""
@export var display_name: String = ""
@export_multiline var description: String = ""
## A line of lore from the world bible (LoreTexts.ITEM_LORE), shown under the description.
@export_multiline var lore: String = ""
## The full text of a NOTE, shown in the reading panel.
@export_multiline var note_text: String = ""
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
# Armour (see Inventory.total_protection and PlayerController._on_hurtbox_hit_received)
@export var armour_slot: ArmourSlot = ArmourSlot.NONE
## Flat damage taken off every blow (heavy blows count it at 60%); half when broken.
@export var protection: float = 0.0
## Added to the survivor's poise while worn and unbroken.
@export var poise_bonus: float = 0.0
## Chance a bleeding blow is turned, 0 to 1.
@export var bleed_resist: float = 0.0
## Mail clinks: multiplies how far the survivor's own noise carries.
@export var noise_mult: float = 1.0
## Seconds to put it on (taking it off is half).
@export var don_time: float = 1.5

# Food & warmth (ported from the Watchhouse branch, Milestone 17)
## Satiety restored when eaten (0 = not food).
@export var food_value: float = 0.0
## Warmth restored when eaten (a hot stew warms you).
@export var warmth_value: float = 0.0
## Armour: how much it slows the loss of warmth (summed across worn pieces).
@export var insulation: float = 0.0

func is_stackable() -> bool:
	return max_stack > 1

func has_durability() -> bool:
	return max_condition > 0.0

func is_equippable() -> bool:
	return category in [Category.WEAPON, Category.SHIELD, Category.TORCH, Category.ARMOUR]


func is_food() -> bool:
	return category == Category.CONSUMABLE and food_value > 0.0

func is_note() -> bool:
	return category == Category.NOTE

## What the pack and loot windows show on hover: what the item does, then where it came from.
func tooltip() -> String:
	if lore.is_empty():
		return description
	if description.is_empty():
		return lore
	return description + "\n\n" + lore


func is_armour() -> bool:
	return category == Category.ARMOUR and armour_slot != ArmourSlot.NONE
