class_name Inventory
extends RefCounted
## The survivor's pack: items, weight/encumbrance and the two equipment slots.
## Equipped items stay in `items` (they still weigh something).

signal changed

enum Load { NORMAL, BURDENED, OVERBURDENED }

const BURDENED_RATIO: float = 0.75

var capacity_kg: float = 18.0
## Nothing can be picked up past capacity * hard_limit_ratio.
var hard_limit_ratio: float = 1.5
var items: Array[ItemInstance] = []
var main_hand: ItemInstance = null
var off_hand: ItemInstance = null
## Milestone 12: ItemData.ArmorSlot -> ItemInstance.
var armor: Dictionary = {}

func total_weight() -> float:
	var w: float = 0.0
	for inst: ItemInstance in items:
		w += inst.total_weight()
	return w

func load_ratio() -> float:
	return total_weight() / maxf(capacity_kg, 0.01)

func get_load() -> Load:
	var r: float = load_ratio()
	if r > 1.0 + 0.0001:
		return Load.OVERBURDENED
	if r > BURDENED_RATIO + 0.0001:
		return Load.BURDENED
	return Load.NORMAL

func hard_limit_kg() -> float:
	return capacity_kg * hard_limit_ratio

func can_carry(inst: ItemInstance) -> bool:
	return total_weight() + inst.total_weight() <= hard_limit_kg() + 0.0001

func has_item(inst: ItemInstance) -> bool:
	return inst != null and items.has(inst)

## Adds an item (merging stacks). Returns false if it would exceed the hard limit.
func add(inst: ItemInstance) -> bool:
	if inst == null or items.has(inst):
		return false
	if not can_carry(inst):
		return false
	if inst.data.is_stackable():
		var remaining: int = inst.quantity
		for existing: ItemInstance in items:
			if remaining <= 0:
				break
			if existing.data.item_id == inst.data.item_id and existing.quantity < existing.data.max_stack:
				var moved: int = mini(remaining, existing.data.max_stack - existing.quantity)
				existing.quantity += moved
				remaining -= moved
		while remaining > 0:
			var chunk: int = mini(remaining, inst.data.max_stack)
			if remaining == inst.quantity and chunk == remaining:
				items.append(inst) # reuse the original object when it fits whole
			else:
				items.append(ItemInstance.new(inst.data, chunk, inst.condition))
			remaining -= chunk
	else:
		items.append(inst)
	changed.emit()
	return true

## Removes `quantity` from a stack (or the whole item when quantity <= 0 or >= stack).
## Returns the removed portion as its own ItemInstance.
func remove(inst: ItemInstance, quantity: int = -1) -> ItemInstance:
	if not items.has(inst):
		return null
	if quantity > 0 and quantity < inst.quantity:
		inst.quantity -= quantity
		changed.emit()
		return ItemInstance.new(inst.data, quantity, inst.condition)
	items.erase(inst)
	if main_hand == inst:
		main_hand = null
	if off_hand == inst:
		off_hand = null
	_drop_armor_ref(inst)
	changed.emit()
	return inst

func count_of(item_id: String) -> int:
	var n: int = 0
	for inst: ItemInstance in items:
		if inst.data.item_id == item_id:
			n += inst.quantity
	return n

func consume(item_id: String, quantity: int = 1) -> bool:
	if count_of(item_id) < quantity:
		return false
	var left: int = quantity
	for inst: ItemInstance in items.duplicate():
		if left <= 0:
			break
		if inst.data.item_id != item_id:
			continue
		var taken: int = mini(left, inst.quantity)
		inst.quantity -= taken
		left -= taken
		if inst.quantity <= 0:
			items.erase(inst)
			if main_hand == inst:
				main_hand = null
			if off_hand == inst:
				off_hand = null
			_drop_armor_ref(inst)
	changed.emit()
	return true

func find_first(item_id: String) -> ItemInstance:
	for inst: ItemInstance in items:
		if inst.data.item_id == item_id:
			return inst
	return null

## Prefers an unbroken / still-fuelled item of the category.
func find_first_of_category(category: ItemData.Category) -> ItemInstance:
	var fallback: ItemInstance = null
	for inst: ItemInstance in items:
		if inst.data.category != category:
			continue
		if not inst.is_broken():
			return inst
		if fallback == null:
			fallback = inst
	return fallback

func find_weapon_of_class(weapon_class: ItemData.WeaponClass) -> ItemInstance:
	if main_hand != null and main_hand.data.weapon_class == weapon_class:
		return main_hand
	var fallback: ItemInstance = null
	for inst: ItemInstance in items:
		if inst.data.category != ItemData.Category.WEAPON or inst.data.weapon_class != weapon_class:
			continue
		if not inst.is_broken():
			return inst
		if fallback == null:
			fallback = inst
	return fallback

func is_equipped(inst: ItemInstance) -> bool:
	return inst != null and (inst == main_hand or inst == off_hand or armor.values().has(inst))

func get_armor(slot: ItemData.ArmorSlot) -> ItemInstance:
	return armor.get(slot, null) as ItemInstance

func armor_pieces() -> Array[ItemInstance]:
	var out: Array[ItemInstance] = []
	for slot: int in [ItemData.ArmorSlot.HEAD, ItemData.ArmorSlot.BODY, ItemData.ArmorSlot.LEGS, ItemData.ArmorSlot.CLOAK]:
		if armor.has(slot):
			out.append(armor[slot])
	return out

func _drop_armor_ref(inst: ItemInstance) -> void:
	for slot: Variant in armor.keys():
		if armor[slot] == inst:
			armor.erase(slot)

func equip(inst: ItemInstance) -> bool:
	if not items.has(inst):
		return false
	match inst.data.category:
		ItemData.Category.WEAPON:
			main_hand = inst
		ItemData.Category.SHIELD, ItemData.Category.TORCH:
			off_hand = inst
		ItemData.Category.ARMOR:
			armor[inst.data.armor_slot] = inst
		_:
			return false
	changed.emit()
	return true

func unequip(inst: ItemInstance) -> void:
	if inst == main_hand:
		main_hand = null
	elif inst == off_hand:
		off_hand = null
	elif armor.values().has(inst):
		_drop_armor_ref(inst)
	else:
		return
	changed.emit()

## Empties the pack and both slots (used when a survivor background is applied).
func clear() -> void:
	items.clear()
	main_hand = null
	off_hand = null
	armor.clear()
	changed.emit()

func notify_changed() -> void:
	changed.emit()
