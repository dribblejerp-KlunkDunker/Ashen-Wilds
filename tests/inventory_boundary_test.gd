extends SceneTree
## Run after import: godot --headless --path . --script res://tests/inventory_boundary_test.gd
## Standalone unit-style runner; not yet wired into the integration CI matrix.

var _passes: int = 0
var _fails: int = 0
var _changes: int = 0

func _initialize() -> void:
	call_deferred("_run")

func _check(ok: bool, label: String) -> void:
	if ok:
		_passes += 1
	else:
		_fails += 1
		push_error("FAIL: " + label)

func _on_changed() -> void:
	_changes += 1

func _run() -> void:
	var inv := Inventory.new()
	inv.changed.connect(_on_changed)
	_check(not inv.can_carry(null), "null carry request rejected")
	_check(not inv.add(null), "null add rejected")
	_check(not inv.equip(null), "null equip rejected")
	var food_data := ItemData.new()
	food_data.item_id = "audit_food"
	food_data.max_stack = 10
	var food := ItemInstance.new(food_data, 3)
	_check(inv.add(food), "valid stack added")
	var before: int = _changes
	_check(not inv.consume("audit_food", 0), "zero consumption rejected")
	_check(not inv.consume("audit_food", -1), "negative consumption rejected")
	_check(not inv.consume("audit_food", 4), "insufficient stock rejected")
	_check(inv.count_of("audit_food") == 3, "rejected consumption preserves quantity")
	_check(_changes == before, "rejected consumption emits no change")
	_check(inv.consume("audit_food", 1), "valid consumption succeeds")
	_check(inv.count_of("audit_food") == 2, "valid consumption decrements quantity")
	var malformed := ItemInstance.new(food_data)
	malformed.quantity = 0
	before = _changes
	_check(not inv.can_carry(malformed), "zero-sized stack cannot be carried")
	_check(not inv.add(malformed), "zero-sized stack cannot be added")
	malformed.quantity = 1
	malformed.data = null
	_check(not inv.can_carry(malformed), "missing definition cannot be carried")
	_check(not inv.add(malformed), "missing definition cannot be added")
	_check(_changes == before, "invalid additions emit no change")
	var invalid_data := ItemData.new()
	invalid_data.item_id = "audit_invalid_armor"
	invalid_data.category = ItemData.Category.ARMOR
	var invalid := ItemInstance.new(invalid_data)
	_check(inv.add(invalid), "unequippable armor may remain in pack")
	before = _changes
	_check(not inv.equip(invalid), "NONE armor slot rejected")
	_check(not inv.is_equipped(invalid), "invalid armor not marked equipped")
	_check(inv.armor.is_empty(), "invalid armor leaves slots empty")
	_check(_changes == before, "rejected equip emits no change")
	for slot: int in [ItemData.ArmorSlot.HEAD, ItemData.ArmorSlot.BODY, ItemData.ArmorSlot.LEGS, ItemData.ArmorSlot.CLOAK]:
		var data := ItemData.new()
		data.item_id = "audit_armor_%d" % slot
		data.category = ItemData.Category.ARMOR
		data.armor_slot = slot
		var piece := ItemInstance.new(data)
		_check(inv.add(piece), "valid armor added")
		_check(inv.equip(piece), "valid armor slot equipped")
		_check(inv.get_armor(slot) == piece, "slot returns equipped piece")
		_check(inv.armor_pieces().has(piece), "equipped piece participates in armor aggregation")
		_check(inv.remove(piece) == piece, "equipped piece removed")
		_check(not inv.is_equipped(piece) and inv.get_armor(slot) == null, "removal clears armor reference")
	var head_data := ItemData.new()
	head_data.item_id = "audit_consumed_armor"
	head_data.category = ItemData.Category.ARMOR
	head_data.armor_slot = ItemData.ArmorSlot.HEAD
	var head := ItemInstance.new(head_data)
	_check(inv.add(head) and inv.equip(head), "armor consumption setup")
	_check(inv.consume(head_data.item_id), "equipped armor consumed")
	_check(inv.get_armor(ItemData.ArmorSlot.HEAD) == null, "consumption clears armor reference")
	inv.clear()
	_check(inv.items.is_empty() and inv.armor.is_empty() and inv.main_hand == null and inv.off_hand == null, "clear empties pack and equipment")
	print("--- %d passed, %d failure(s) ---" % [_passes, _fails])
	quit(1 if _fails > 0 else 0)
