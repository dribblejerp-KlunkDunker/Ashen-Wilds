extends SceneTree
## Inventory boundary checks against main's armour API (flat protection, HEAD/BODY/LEGS).
## Run after import: godot --headless --path . --script res://tests/inventory_boundary_test.gd
## Exit code 1 on any failure.

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

func _armour(id: String, slot: int) -> ItemData:
	var d := ItemData.new()
	d.item_id = id
	d.category = ItemData.Category.ARMOUR
	d.armour_slot = slot
	d.protection = 2.0
	return d

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

	var invalid := ItemInstance.new(_armour("audit_no_slot", ItemData.ArmourSlot.NONE))
	_check(inv.add(invalid), "unwearable armour may stay in the pack")
	var bogus := ItemInstance.new(_armour("audit_bogus_slot", 99))
	_check(inv.add(bogus), "out-of-range slot armour may stay in the pack")
	before = _changes
	_check(not inv.equip(invalid), "NONE armour slot rejected")
	_check(not inv.equip(bogus), "out-of-range armour slot rejected")
	_check(not inv.is_equipped(invalid) and not inv.is_equipped(bogus), "rejected armour not marked worn")
	_check(inv.armour.is_empty(), "rejected armour leaves slots empty")
	_check(_changes == before, "rejected equip emits no change")

	for slot: int in Inventory.ARMOUR_SLOTS:
		var piece := ItemInstance.new(_armour("audit_armour_%d" % slot, slot))
		_check(inv.add(piece), "valid armour added")
		_check(inv.equip(piece), "valid armour slot worn")
		_check(inv.armour_in(slot) == piece, "slot returns the worn piece")
		_check(inv.worn_armour().has(piece), "worn piece counted in protection")
		_check(is_equal_approx(inv.total_protection(), 2.0), "one piece's flat protection")
		_check(inv.remove(piece) == piece, "worn piece removed")
		_check(not inv.is_equipped(piece) and inv.armour_in(slot) == null, "removal clears the slot")

	var head := ItemInstance.new(_armour("audit_consumed_armour", ItemData.ArmourSlot.HEAD))
	_check(inv.add(head) and inv.equip(head), "armour consumption setup")
	_check(inv.consume("audit_consumed_armour"), "worn armour consumed")
	_check(inv.armour_in(ItemData.ArmourSlot.HEAD) == null, "consumption clears the slot")
	_check(inv.worn_armour().is_empty(), "consumed armour no longer protects")
	_check(is_equal_approx(inv.total_protection(), 0.0), "protection drops to zero")

	print("--- %d passed, %d failure(s) ---" % [_passes, _fails])
	quit(1 if _fails > 0 else 0)
