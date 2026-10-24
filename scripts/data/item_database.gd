class_name ItemDatabase
extends RefCounted
## Code-defined item registry (no .tres files needed). Every ItemData is a
## single shared instance per item_id, so instances can be compared by id.

static var _items: Dictionary = {}

static func get_item(id: String) -> ItemData:
	if _items.is_empty():
		_build()
	if not _items.has(id):
		push_error("ItemDatabase: unknown item id '%s'" % id)
		return null
	return _items[id] as ItemData

static func make(id: String, quantity: int = 1, condition: float = -1.0) -> ItemInstance:
	var data: ItemData = get_item(id)
	if data == null:
		return null
	return ItemInstance.new(data, quantity, condition)

static func all_ids() -> Array:
	if _items.is_empty():
		_build()
	return _items.keys()

# ------------------------------------------------------------------------------
# Loot tables
# ------------------------------------------------------------------------------
static func roll_goblin_loot() -> Array[ItemInstance]:
	var out: Array[ItemInstance] = []
	out.append(make("iron_scrap", randi_range(1, 2)))
	if randf() < 0.5:
		out.append(make("clean_rag_bandage", 1))
	if randf() < 0.35:
		out.append(make("salt", 1))
	if randf() < 0.2:
		out.append(make("leather_leggings", 1, randf_range(25.0, 50.0)))
	if randf() < 0.4:
		out.append(make("hardtack", 1))
	return out

static func roll_ork_loot() -> Array[ItemInstance]:
	var out: Array[ItemInstance] = []
	out.append(make("iron_scrap", randi_range(2, 3)))
	out.append(make("salt", randi_range(1, 2)))
	if randf() < 0.7:
		out.append(make("clean_rag_bandage", 1))
	if randf() < 0.3:
		out.append(make("lamp_oil", 1))
	if randf() < 0.35:
		out.append(make("iron_skullcap", 1, randf_range(40.0, 80.0)))
	out.append(make("dried_meat", randi_range(1, 2)))
	return out

static func roll_bear_loot() -> Array[ItemInstance]:
	var out: Array[ItemInstance] = []
	out.append(make("bear_pelt", 1))
	out.append(make("raw_bear_meat", 2))
	if randf() < 0.4:
		out.append(make("clean_rag_bandage", 1))
	return out

## Milestone 20
static func roll_bull_loot() -> Array[ItemInstance]:
	var out: Array[ItemInstance] = []
	out.append(make("raw_game_meat", 3))
	return out

static func roll_deer_loot() -> Array[ItemInstance]:
	var out: Array[ItemInstance] = []
	out.append(make("raw_game_meat", 2))
	return out

## Milestone 21
static func roll_zombie_loot() -> Array[ItemInstance]:
	var out: Array[ItemInstance] = []
	if randf() < 0.5:
		out.append(make("clean_rag_bandage", 1))
	if randf() < 0.3:
		out.append(make("hardtack", 1))
	return out

static func roll_rot_beast_loot() -> Array[ItemInstance]:
	var out: Array[ItemInstance] = []
	out.append(make("iron_scrap", 2))
	out.append(make("salt", 2))
	return out

static func roll_crawler_loot() -> Array[ItemInstance]:
	var out: Array[ItemInstance] = []
	if randf() < 0.5:
		out.append(make("throwing_stone", 2))
	return out

static func roll_ghoul_loot() -> Array[ItemInstance]:
	var out: Array[ItemInstance] = []
	out.append(make("iron_scrap", 1))
	if randf() < 0.5:
		out.append(make("clean_rag_bandage", 1))
	if randf() < 0.25:
		out.append(make("throwing_stone", 2))
	return out

static func roll_troll_loot() -> Array[ItemInstance]:
	var out: Array[ItemInstance] = []
	out.append(make("troll_hide", 1))
	out.append(make("iron_scrap", 2))
	out.append(make("throwing_stone", 4))
	return out

static func roll_ogre_loot() -> Array[ItemInstance]:
	var out: Array[ItemInstance] = []
	out.append(make("salt", 3))
	out.append(make("iron_scrap", 3))
	out.append(make("timber", 2))
	out.append(make("clean_rag_bandage", 2))
	return out

# ------------------------------------------------------------------------------
# Definitions
# ------------------------------------------------------------------------------
static func _register(item: ItemData) -> void:
	_items[item.item_id] = item

static func _build() -> void:
	# --- Weapons -------------------------------------------------------------
	var sword_w := WeaponData.new()
	sword_w.weapon_id = "arming_sword"
	sword_w.display_name = "Tarnished Arming Sword"
	sword_w.heavy_swing_arc_degrees = 50.0 # committed lunging thrust
	sword_w.light_is_thrust = false        # diagonal slash: clangs in hallways
	sword_w.heavy_is_thrust = true
	sword_w.heavy_lodge_chance = 0.15      # thrust can bind in bone

	var sword := ItemData.new()
	sword.item_id = "arming_sword"
	sword.display_name = "Tarnished Arming Sword"
	sword.description = "Reliable all-rounder for yards and doorways. Heavy: lunging thrust."
	sword.category = ItemData.Category.WEAPON
	sword.weapon_class = ItemData.WeaponClass.BLADE
	sword.weapon = sword_w
	sword.weight_kg = 1.4
	sword.max_condition = 100.0
	_register(sword)

	var spear_w := WeaponData.new()
	spear_w.weapon_id = "boar_spear"
	spear_w.display_name = "Boar-Lugged Spear"
	spear_w.light_startup_time = 0.22
	spear_w.light_active_time = 0.12
	spear_w.light_recovery_time = 0.32
	spear_w.light_stamina_cost = 14.0
	spear_w.light_damage = 19.0
	spear_w.light_poise_damage = 12.0
	spear_w.light_step_impulse = 2.0
	spear_w.heavy_startup_time = 0.46
	spear_w.heavy_active_time = 0.18
	spear_w.heavy_recovery_time = 0.56
	spear_w.heavy_stamina_cost = 26.0
	spear_w.heavy_damage = 24.0
	spear_w.heavy_poise_damage = 38.0
	spear_w.heavy_step_impulse = -2.6 # shaft-sweep that steps you back
	spear_w.heavy_bleed_chance = 0.0
	spear_w.reach_meters = 2.45
	spear_w.swing_arc_degrees = 25.0
	spear_w.heavy_swing_arc_degrees = 150.0
	spear_w.light_knockback = 2.0
	spear_w.heavy_knockback = 7.0
	spear_w.light_is_thrust = true         # safe in hallways
	spear_w.heavy_is_thrust = false        # the shaft-sweep still clangs
	spear_w.heavy_lodge_chance = 0.0       # the lugs exist to stop over-penetration

	var spear := ItemData.new()
	spear.item_id = "boar_spear"
	spear.display_name = "Boar-Lugged Spear"
	spear.description = "Two-handed. Narrow thrust, safe in hallways. Heavy: wide sweep that steps back and shoves flankers."
	spear.category = ItemData.Category.WEAPON
	spear.weapon_class = ItemData.WeaponClass.POLEARM
	spear.two_handed = true
	spear.weapon = spear_w
	spear.weight_kg = 2.6
	spear.max_condition = 90.0
	_register(spear)

	var axe_w := WeaponData.new()
	axe_w.weapon_id = "woodsmans_broadaxe"
	axe_w.display_name = "Woodsman's Broadaxe"
	axe_w.light_startup_time = 0.30
	axe_w.light_active_time = 0.16
	axe_w.light_recovery_time = 0.44
	axe_w.light_stamina_cost = 20.0
	axe_w.light_damage = 27.0
	axe_w.light_poise_damage = 24.0
	axe_w.light_step_impulse = 3.0
	axe_w.heavy_startup_time = 0.58
	axe_w.heavy_active_time = 0.20
	axe_w.heavy_recovery_time = 0.70
	axe_w.heavy_stamina_cost = 34.0
	axe_w.heavy_damage = 50.0
	axe_w.heavy_poise_damage = 52.0
	axe_w.heavy_step_impulse = 4.2
	axe_w.heavy_bleed_chance = 0.30
	axe_w.reach_meters = 1.55
	axe_w.swing_arc_degrees = 135.0
	axe_w.light_knockback = 3.0
	axe_w.heavy_knockback = 5.6
	axe_w.light_is_thrust = false
	axe_w.heavy_is_thrust = false
	axe_w.heavy_lodge_chance = 0.40        # heavy blade bites deep

	var axe := ItemData.new()
	axe.item_id = "woodsmans_broadaxe"
	axe.display_name = "Woodsman's Broadaxe"
	axe.description = "Wide horizontal cleave. Hard-hitting and slow to recover."
	axe.category = ItemData.Category.WEAPON
	axe.weapon_class = ItemData.WeaponClass.AXE
	axe.weapon = axe_w
	axe.weight_kg = 2.3
	axe.max_condition = 110.0
	_register(axe)

	# --- Off-hand ------------------------------------------------------------
	var targe := ItemData.new()
	targe.item_id = "wooden_targe"
	targe.display_name = "Wooden Targe"
	targe.description = "Iron-rimmed round shield. Splinters if it takes too many heavy blows."
	targe.category = ItemData.Category.SHIELD
	targe.weight_kg = 3.5
	targe.max_condition = 120.0
	targe.block_stamina_efficiency = 0.55
	targe.block_angle_degrees = 130.0
	targe.block_wear_per_poise = 0.2
	_register(targe)

	var torch := ItemData.new()
	torch.item_id = "pitch_torch"
	torch.display_name = "Pitch Torch"
	torch.description = "Light and warmth in the off-hand at the cost of your shield. Burns while lit."
	torch.category = ItemData.Category.TORCH
	torch.weight_kg = 0.8
	torch.max_condition = 240.0 # seconds of fuel
	torch.light_range = 7.5
	torch.light_energy = 1.35
	_register(torch)

	# --- Consumables & materials --------------------------------------------
	var bandage := ItemData.new()
	bandage.item_id = "clean_rag_bandage"
	bandage.display_name = "Clean Rag Bandage"
	bandage.description = "Stops bleeding and restores a little health. Takes time to bind."
	bandage.category = ItemData.Category.CONSUMABLE
	bandage.weight_kg = 0.1
	bandage.max_stack = 10
	bandage.use_duration = 1.6
	_register(bandage)

	_register(_material("iron_scrap", "Iron Scrap", 0.6, 20, "Bent nails, hinge plates and chain links."))
	_register(_material("salt", "Salt Ration", 0.4, 20, "Preserves meat through the Smothering."))
	_register(_material("timber", "Seasoned Timber", 1.5, 10, "Dry enough to burn or build with."))
	_register(_material("lamp_oil", "Flask of Lamp Oil", 0.9, 5, "Refuels lanterns; douses rags for fire."))

	# --- Armor (Milestone 12) ----------------------------------------------
	var hood := _armor("padded_hood", "Padded Hood", ItemData.ArmorSlot.HEAD, 0.6, 0.06, 60.0,
		"Quilted linen cap. Takes the sting out of a glancing blow, and keeps your ears warm.")
	hood.insulation = 0.10
	_register(hood)
	var cap := _armor("iron_skullcap", "Iron Skullcap", ItemData.ArmorSlot.HEAD, 1.4, 0.12, 90.0,
		"Dented ork-forged cap, strapped under the chin.")
	_register(cap)
	var gambeson := _armor("quilted_gambeson", "Quilted Gambeson", ItemData.ArmorSlot.BODY, 3.0, 0.14, 90.0,
		"Thick padded coat. Quiet, warm, and better than nothing.")
	gambeson.equip_time = 1.6
	gambeson.insulation = 0.25
	_register(gambeson)
	var mail := _armor("riveted_mail", "Riveted Mail Shirt", ItemData.ArmorSlot.BODY, 7.5, 0.26, 140.0,
		"Heavy and loud: every step jingles. Edges skid off it, so no bleeding.")
	mail.armor_noise_mult = 1.4
	mail.stops_bleeding = true
	mail.equip_time = 2.4
	_register(mail)
	var leggings := _armor("leather_leggings", "Leather Leggings", ItemData.ArmorSlot.LEGS, 1.5, 0.08, 70.0,
		"Boiled-leather chaps with knee cops.")
	leggings.insulation = 0.08
	_register(leggings)
	var greaves := _armor("splinted_greaves", "Splinted Greaves", ItemData.ArmorSlot.LEGS, 3.2, 0.14, 100.0,
		"Iron splints over leather. They clank and slow your stride.")
	greaves.armor_noise_mult = 1.15
	greaves.armor_sprint_mult = 0.95
	greaves.equip_time = 1.4
	_register(greaves)

	# --- Cloaks (Milestone 18: sewn at the shelter fire) ------------------------
	var bear_cloak := _armor("bear_pelt_cloak", "Bear-Pelt Cloak", ItemData.ArmorSlot.CLOAK, 2.8, 0.04, 80.0,
		"Heavy, warm, and the fur muffles every step.")
	bear_cloak.insulation = 0.35
	bear_cloak.armor_noise_mult = 0.85
	bear_cloak.equip_time = 1.2
	_register(bear_cloak)
	var troll_cloak := _armor("troll_hide_cloak", "Troll-Hide Cloak", ItemData.ArmorSlot.CLOAK, 3.4, 0.10, 120.0,
		"Stiff as a cart-tarp. Turns a blade now and then.")
	troll_cloak.insulation = 0.25
	troll_cloak.equip_time = 1.2
	_register(troll_cloak)

	# --- Food (Milestone 17) ---------------------------------------------------
	_register(_food("hardtack", "Hardtack Biscuit", 0.2, 10, 25.0, 1.2, "Twice-baked and hard as slate. Soak it if you can."))
	_register(_food("dried_meat", "Strip of Dried Meat", 0.3, 10, 35.0, 1.4, "Salted, smoked, chewy. A soldier's supper."))
	var stew := _food("marsh_stew", "Bowl of Marsh Stew", 0.8, 3, 60.0, 2.0, "Bear meat stewed with salt in the iron pot. Warms you to the bone.")
	stew.warmth_value = 35.0
	_register(stew)
	var broth := _food("salted_broth", "Cup of Salted Broth", 0.4, 3, 30.0, 1.5, "Thin and salty, but hot.")
	broth.warmth_value = 25.0
	_register(broth)
	_register(_food("raw_bear_meat", "Raw Bear Meat", 1.0, 4, 12.0, 2.2, "Fills the belly badly raw. Better in a pot."))
	# Milestone 20: bull and deer.
	_register(_food("raw_game_meat", "Raw Game Meat", 0.8, 6, 14.0, 2.0, "Bull or deer, cut from the carcass. Roast it at the fire."))
	var roast := _food("roast_game_meat", "Roast Game Meat", 0.6, 6, 40.0, 1.6, "Charred outside, pink within. Still warm.")
	roast.warmth_value = 10.0
	_register(roast)

	# Milestone 11
	var stone := ItemData.new()
	stone.item_id = "throwing_stone"
	stone.display_name = "Fist-Sized Stone"
	stone.description = "Throw it with [G] to make a noise where it lands. Lures the blind and distracts the sighted."
	stone.category = ItemData.Category.TOOL
	stone.weight_kg = 0.3
	stone.max_stack = 10
	_register(stone)
	_register(_material("bear_pelt", "Bog Bear Pelt", 2.6, 2, "Matted with moss and marsh-water. Warm, if you can stand the smell."))
	_register(_material("troll_hide", "Quarry-Troll Hide", 3.2, 2, "Thick as a cart-tarp and grey with stone dust."))

	var pot := ItemData.new()
	pot.item_id = "cooking_pot"
	pot.display_name = "Cast-Iron Cooking Pot"
	pot.description = "Heavy and precious: boil marsh water and simmer stews at the shelter fire."
	pot.category = ItemData.Category.TOOL
	pot.weight_kg = 4.5
	_register(pot)

static func _armor(id: String, label: String, slot: ItemData.ArmorSlot, weight: float, protection: float, condition: float, desc: String) -> ItemData:
	var d := ItemData.new()
	d.item_id = id
	d.display_name = label
	d.description = desc
	d.category = ItemData.Category.ARMOR
	d.armor_slot = slot
	d.weight_kg = weight
	d.protection = protection
	d.max_condition = condition
	return d

static func _food(id: String, label: String, weight: float, stack: int, food: float, eat_time: float, desc: String) -> ItemData:
	var d := ItemData.new()
	d.item_id = id
	d.display_name = label
	d.description = desc
	d.category = ItemData.Category.CONSUMABLE
	d.weight_kg = weight
	d.max_stack = stack
	d.food_value = food
	d.use_duration = eat_time
	return d

static func _material(id: String, label: String, weight: float, stack: int, desc: String) -> ItemData:
	var d := ItemData.new()
	d.item_id = id
	d.display_name = label
	d.description = desc
	d.category = ItemData.Category.MATERIAL
	d.weight_kg = weight
	d.max_stack = stack
	return d
