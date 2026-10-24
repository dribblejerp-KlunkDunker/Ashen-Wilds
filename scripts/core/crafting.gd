class_name Crafting
extends RefCounted
## Milestone 18: shelter crafting & repairs. Recipes are worked at the
## shelter fire. Ingredients come from the pack first, then the shelter
## stash. A recipe either makes an item, or repairs / refuels gear.

enum Kind { MAKE, REPAIR_MAIN, REPAIR_SHIELD, REPAIR_ARMOR, REFUEL_TORCH }

static var _recipes: Array[Dictionary] = []

static func all() -> Array[Dictionary]:
	if _recipes.is_empty():
		_build()
	return _recipes

static func get_recipe(id: String) -> Dictionary:
	for r: Dictionary in all():
		if r["id"] == id:
			return r
	return {}

static func _add(id: String, label: String, desc: String, time: float, inputs: Dictionary, kind: Kind, extra: Dictionary = {}) -> void:
	var r: Dictionary = {"id": id, "name": label, "desc": desc, "time": time, "inputs": inputs, "kind": kind, "tool": "", "output": "", "amount": 0.0}
	r.merge(extra, true)
	_recipes.append(r)

static func _build() -> void:
	_add("repair_weapon", "Repair weapon", "Hammer out the nicks: +40 condition to your main-hand weapon.", 3.0,
		{"iron_scrap": 2}, Kind.REPAIR_MAIN, {"amount": 40.0})
	_add("repair_shield", "Repair shield", "New boards and a rim nail: +50 condition to your shield.", 3.0,
		{"timber": 1, "iron_scrap": 1}, Kind.REPAIR_SHIELD, {"amount": 50.0})
	_add("repair_armor", "Repair armour", "Patch the most worn piece you're wearing: +40 condition.", 3.5,
		{"iron_scrap": 2}, Kind.REPAIR_ARMOR, {"amount": 40.0})
	_add("refuel_torch_oil", "Refuel torch (oil)", "Soak the head in lamp oil: a full torch.", 1.5,
		{"lamp_oil": 1}, Kind.REFUEL_TORCH, {"amount": 9999.0})
	_add("refuel_torch_wood", "Refuel torch (pitch & timber)", "Re-wrap with splints: +90 s of fuel.", 2.0,
		{"timber": 1}, Kind.REFUEL_TORCH, {"amount": 90.0})
	_add("cook_stew", "Cook Marsh Stew", "Bear meat and salt in the iron pot. Hot, filling, warming.", 4.0,
		{"raw_bear_meat": 1, "salt": 1}, Kind.MAKE, {"tool": "cooking_pot", "output": "marsh_stew"})
	_add("cook_broth", "Cook Salted Broth", "Thin, but hot: salt and a splint of firewood.", 3.0,
		{"salt": 2, "timber": 1}, Kind.MAKE, {"tool": "cooking_pot", "output": "salted_broth"})
	_add("roast_game_meat", "Roast game meat", "Spit it over the fire. No pot needed.", 2.5,
		{"raw_game_meat": 1}, Kind.MAKE, {"output": "roast_game_meat"})
	_add("sew_bear_cloak", "Sew Bear-Pelt Cloak", "Warm, and the fur muffles your steps.", 5.0,
		{"bear_pelt": 1, "clean_rag_bandage": 1}, Kind.MAKE, {"output": "bear_pelt_cloak"})
	_add("sew_troll_cloak", "Sew Troll-Hide Cloak", "Tough as a cart-tarp: some protection, some warmth.", 5.0,
		{"troll_hide": 1, "clean_rag_bandage": 1}, Kind.MAKE, {"output": "troll_hide_cloak"})

static func _count(id: String, player: PlayerController, stash: Lootable) -> int:
	var n: int = player.inventory.count_of(id)
	if stash and is_instance_valid(stash):
		n += stash.count_of(id)
	return n

static func _has_tool(tool: String, player: PlayerController, stash: Lootable) -> bool:
	return tool == "" or _count(tool, player, stash) > 0

## The item a repair / refuel recipe would work on (null if none).
static func target_of(recipe: Dictionary, player: PlayerController) -> ItemInstance:
	var inv: Inventory = player.inventory
	match int(recipe["kind"]):
		Kind.REPAIR_MAIN:
			return inv.main_hand if inv.main_hand and inv.main_hand.data.has_durability() else null
		Kind.REPAIR_SHIELD:
			return inv.off_hand if inv.off_hand and inv.off_hand.data.category == ItemData.Category.SHIELD else null
		Kind.REPAIR_ARMOR:
			var worst: ItemInstance = null
			for piece: ItemInstance in inv.armor_pieces():
				if piece.data.has_durability() and (worst == null or piece.condition_ratio() < worst.condition_ratio()):
					worst = piece
			return worst
		Kind.REFUEL_TORCH:
			return inv.find_first_of_category(ItemData.Category.TORCH)
	return null

## "" when the recipe can be made right now, otherwise the reason it can't.
static func why_not(recipe: Dictionary, player: PlayerController, stash: Lootable) -> String:
	if not _has_tool(String(recipe["tool"]), player, stash):
		return "needs the %s" % ItemDatabase.get_item(String(recipe["tool"])).display_name
	var inputs: Dictionary = recipe["inputs"]
	for id: String in inputs.keys():
		if _count(id, player, stash) < int(inputs[id]):
			return "needs %d× %s" % [int(inputs[id]), ItemDatabase.get_item(id).display_name]
	if int(recipe["kind"]) != Kind.MAKE:
		var t: ItemInstance = target_of(recipe, player)
		if t == null:
			return "nothing to work on"
		if t.condition >= t.data.max_condition - 0.01:
			return "%s is already in good order" % t.data.display_name
	return ""

static func _consume(id: String, qty: int, player: PlayerController, stash: Lootable) -> void:
	var from_pack: int = mini(qty, player.inventory.count_of(id))
	if from_pack > 0:
		player.inventory.consume(id, from_pack)
	var left: int = qty - from_pack
	if left <= 0 or stash == null:
		return
	for inst: ItemInstance in stash.items.duplicate():
		if left <= 0:
			break
		if inst.data.item_id != id:
			continue
		var taken: int = mini(left, inst.quantity)
		inst.quantity -= taken
		left -= taken
		if inst.quantity <= 0:
			stash.items.erase(inst)
	stash.contents_changed.emit()

## Consumes the ingredients and applies the result. Returns a banner line.
static func apply(recipe: Dictionary, player: PlayerController, stash: Lootable) -> String:
	if why_not(recipe, player, stash) != "":
		return ""
	var inputs: Dictionary = recipe["inputs"]
	for id: String in inputs.keys():
		_consume(id, int(inputs[id]), player, stash)
	match int(recipe["kind"]):
		Kind.MAKE:
			var made: ItemInstance = ItemDatabase.make(String(recipe["output"]))
			if not player.inventory.add(made):
				if stash:
					stash.put(made)
					return "%s made — too heavy to carry, left in the stash" % made.data.display_name
			return "%s made" % made.data.display_name
		_:
			var t: ItemInstance = target_of(recipe, player)
			t.condition = minf(t.data.max_condition, t.condition + float(recipe["amount"]))
			player.inventory.notify_changed()
			return "%s: %s" % [recipe["name"], t.get_label()]
