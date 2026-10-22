class_name ItemInstance
extends RefCounted
## A physical item in the world or a pack: definition + quantity + condition.

var data: ItemData
var quantity: int = 1
var condition: float = 0.0

func _init(p_data: ItemData, p_quantity: int = 1, p_condition: float = -1.0) -> void:
	data = p_data
	quantity = maxi(1, p_quantity)
	if p_condition < 0.0:
		condition = data.max_condition
	else:
		condition = clampf(p_condition, 0.0, data.max_condition)

func total_weight() -> float:
	return data.weight_kg * quantity

func condition_ratio() -> float:
	if not data.has_durability():
		return 1.0
	return condition / data.max_condition

func is_broken() -> bool:
	return data.has_durability() and condition <= 0.0

## Reduces condition. Returns true only on the call that breaks the item.
func wear(amount: float) -> bool:
	if not data.has_durability() or condition <= 0.0 or amount <= 0.0:
		return false
	condition = maxf(0.0, condition - amount)
	return condition <= 0.0

func get_condition_text() -> String:
	if not data.has_durability():
		return ""
	if data.category == ItemData.Category.TORCH:
		return "burnt out" if condition <= 0.0 else "fuel %ds" % int(ceil(condition))
	if condition <= 0.0:
		return "BROKEN"
	return "%d%%" % int(round(condition_ratio() * 100.0))

func get_label() -> String:
	var text: String = data.display_name
	if quantity > 1:
		text += " ×%d" % quantity
	var cond: String = get_condition_text()
	if cond != "":
		text += "  (%s)" % cond
	return text
