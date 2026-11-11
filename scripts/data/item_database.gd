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
	return out

static func roll_ork_loot() -> Array[ItemInstance]:
	var out: Array[ItemInstance] = []
	out.append(make("iron_scrap", randi_range(2, 3)))
	out.append(make("salt", randi_range(1, 2)))
	if randf() < 0.7:
		out.append(make("clean_rag_bandage", 1))
	if randf() < 0.3:
		out.append(make("lamp_oil", 1))
	if randf() < 0.3:
		out.append(make("splinted_greaves", 1, 70.0))
	return out

static func roll_unnamed_loot() -> Array[ItemInstance]:
	var out: Array[ItemInstance] = []
	out.append(make("salt", 1))
	if randf() < 0.5:
		out.append(make("clean_rag_bandage", 1))
	return out

## The gallery-crawler swallows what it drags: a buckle, a few links of harness chain.
static func roll_crawler_loot() -> Array[ItemInstance]:
	var out: Array[ItemInstance] = []
	if randf() < 0.6:
		out.append(make("iron_scrap", 1))
	return out

static func roll_husk_loot() -> Array[ItemInstance]:
	var out: Array[ItemInstance] = []
	out.append(make("iron_scrap", 1))
	if randf() < 0.4:
		out.append(make("clean_rag_bandage", 1))
	return out

static func roll_troll_loot() -> Array[ItemInstance]:
	var out: Array[ItemInstance] = []
	out.append(make("iron_scrap", 4))
	out.append(make("salt", 2))
	out.append(make("lamp_oil", 1))
	out.append(make("clean_rag_bandage", 1))
	return out

static func roll_ogre_loot() -> Array[ItemInstance]:
	var out: Array[ItemInstance] = []
	out.append(make("salt", 3))
	out.append(make("iron_scrap", 3))
	out.append(make("timber", 2))
	out.append(make("clean_rag_bandage", 2))
	return out

# --- Blackfen creatures (ported from the Watchhouse branch, Milestones 15-21) ---
# Item ids are mapped onto main's armour set: iron_skullcap -> kettle_hat,
# leather_leggings -> leather_greaves.
static func roll_ghoul_loot() -> Array[ItemInstance]:
	var out: Array[ItemInstance] = []
	out.append(make("iron_scrap", 1))
	if randf() < 0.5:
		out.append(make("clean_rag_bandage", 1))
	if randf() < 0.25:
		out.append(make("throwing_stone", 2))
	if randf() < 0.2:
		out.append(make("leather_greaves", 1, randf_range(25.0, 50.0)))
	if randf() < 0.4:
		out.append(make("hardtack", 1))
	if randf() < 0.35:
		out.append(make("kettle_hat", 1, randf_range(40.0, 80.0)))
	return out

static func roll_bear_loot() -> Array[ItemInstance]:
	var out: Array[ItemInstance] = []
	out.append(make("bear_pelt", 1))
	out.append(make("raw_bear_meat", 2))
	if randf() < 0.4:
		out.append(make("clean_rag_bandage", 1))
	return out

static func roll_bull_loot() -> Array[ItemInstance]:
	var out: Array[ItemInstance] = []
	out.append(make("raw_game_meat", 3))
	return out

static func roll_deer_loot() -> Array[ItemInstance]:
	var out: Array[ItemInstance] = []
	out.append(make("raw_game_meat", 2))
	return out

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

## The Pallid Crawler's own table (main's roll_crawler_loot belongs to the Gallery Dragger).
static func roll_pallid_crawler_loot() -> Array[ItemInstance]:
	var out: Array[ItemInstance] = []
	if randf() < 0.5:
		out.append(make("throwing_stone", 2))
	return out

# ------------------------------------------------------------------------------
# Definitions
# ------------------------------------------------------------------------------
static func _register_armour(id: String, display: String, desc: String, slot: ItemData.ArmourSlot, weight: float,
		condition: float, protection: float, poise: float, bleed_resist: float, noise: float, don: float) -> void:
	var d := ItemData.new()
	d.item_id = id
	d.display_name = display
	d.description = desc
	d.category = ItemData.Category.ARMOUR
	d.armour_slot = slot
	d.weight_kg = weight
	d.max_condition = condition
	d.protection = protection
	d.poise_bonus = poise
	d.bleed_resist = bleed_resist
	d.noise_mult = noise
	d.don_time = don
	_register(d)

static func _register(item: ItemData) -> void:
	if LoreTexts.ITEM_LORE.has(item.item_id):
		item.lore = String(LoreTexts.ITEM_LORE[item.item_id])
	_items[item.item_id] = item

## A sheet of paper weighs next to nothing, but it is still carried.
const NOTE_WEIGHT_KG: float = 0.02

## The notes of the Act I level (LoreTexts.NOTES, generated from the world bible): one item each,
## read from the pack. Where each one lies is the bootstrap's business.
static func _register_notes() -> void:
	for n: Dictionary in LoreTexts.NOTES:
		var d := ItemData.new()
		d.item_id = String(n["id"])
		d.display_name = String(n["title"])
		d.description = "Something written. Read it from the pack."
		d.note_text = String(n["text"])
		d.category = ItemData.Category.NOTE
		d.weight_kg = NOTE_WEIGHT_KG
		d.max_stack = 1
		_register(d)

## The ids of the notes that belong in a place: a container's label, or "ground".
static func note_ids_for(place: String) -> Array[String]:
	var out: Array[String] = []
	for n: Dictionary in LoreTexts.NOTES:
		if String(n["place"]) == place:
			out.append(String(n["id"]))
	return out

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

	# --- Armour ----------------------------------------------------------------
	# Worn in three slots. Protection comes off every blow (heavy blows count it at 60%, and a blow
	# always does at least 30%); the poise bonus lets a well-armoured survivor shrug an ork's chop
	# once; weight goes through the pack like everything else, and mail clinks.
	_register_armour("padded_coif", "Padded Coif", "Quilted linen cap. Turns a glancing blow and little else.",
		ItemData.ArmourSlot.HEAD, 0.6, 60.0, 2.0, 3.0, 0.0, 1.0, 1.0)
	_register_armour("kettle_hat", "Kettle Hat", "A Watch helmet with a brim, dented and sweated through.",
		ItemData.ArmourSlot.HEAD, 1.4, 100.0, 4.0, 5.0, 0.0, 1.05, 1.5)
	_register_armour("quilted_gambeson", "Quilted Gambeson", "Thirty layers of linen. Stops a cut from going deep.",
		ItemData.ArmourSlot.BODY, 3.2, 120.0, 5.0, 6.0, 0.5, 1.0, 2.5)
	_register_armour("rusted_hauberk", "Rusted Mail Hauberk", "Knee-length mail, orange at every ring. Heavy, loud, and very hard to cut.",
		ItemData.ArmourSlot.BODY, 8.5, 160.0, 10.0, 10.0, 0.8, 1.25, 4.0)
	_register_armour("leather_greaves", "Leather Greaves", "Boiled leather over the shins, laced at the back.",
		ItemData.ArmourSlot.LEGS, 1.2, 80.0, 2.0, 2.0, 0.0, 1.0, 1.5)
	_register_armour("splinted_greaves", "Splinted Greaves", "Iron splints riveted to leather. They clatter on stone.",
		ItemData.ArmourSlot.LEGS, 3.0, 120.0, 5.0, 4.0, 0.0, 1.1, 2.0)

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
	_register(_material("quicklime", "Sack of Lime", 2.0, 5, "[G] splits a sack and throws it: a white cloud that blinds what breathes it (you included) and stops spores."))

	var pot := ItemData.new()
	pot.item_id = "cooking_pot"
	pot.display_name = "Cast-Iron Cooking Pot"
	pot.description = "Heavy and precious: boil marsh water and simmer stews at the shelter fire."
	pot.category = ItemData.Category.TOOL
	pot.weight_kg = 4.5
	_register(pot)

	# --- Food & creature materials (ported from the Watchhouse branch) --------
	_register(_food("hardtack", "Hardtack Biscuit", 0.2, 10, 25.0, 1.2, "Twice-baked and hard as slate. Soak it if you can."))
	_register(_food("dried_meat", "Strip of Dried Meat", 0.3, 10, 35.0, 1.4, "Salted, smoked, chewy. A soldier's supper."))
	var stew := _food("marsh_stew", "Bowl of Marsh Stew", 0.8, 3, 60.0, 2.0, "Bear meat stewed with salt in the iron pot. Warms you to the bone.")
	stew.warmth_value = 35.0
	_register(stew)
	var broth := _food("salted_broth", "Cup of Salted Broth", 0.4, 3, 30.0, 1.5, "Thin and salty, but hot.")
	broth.warmth_value = 25.0
	_register(broth)
	_register(_food("raw_bear_meat", "Raw Bear Meat", 1.0, 4, 12.0, 2.2, "Fills the belly badly raw. Better in a pot."))
	_register(_food("raw_game_meat", "Raw Game Meat", 0.8, 6, 14.0, 2.0, "Bull or deer, cut from the carcass. Roast it at the fire."))
	var roast := _food("roast_game_meat", "Roast Game Meat", 0.6, 6, 40.0, 1.6, "Charred outside, pink within. Still warm.")
	roast.warmth_value = 10.0
	_register(roast)
	var stone := ItemData.new()
	stone.item_id = "throwing_stone"
	stone.display_name = "Fist-Sized Stone"
	stone.description = "Heavy enough to make a noise where it lands."
	stone.category = ItemData.Category.TOOL
	stone.weight_kg = 0.3
	stone.max_stack = 10
	_register(stone)
	_register(_material("bear_pelt", "Bog Bear Pelt", 2.6, 2, "Matted with moss and marsh-water. Warm, if you can stand the smell."))
	_register(_material("troll_hide", "Quarry-Troll Hide", 3.2, 2, "Thick as a cart-tarp and grey with stone dust."))

	_register_notes()

static func _material(id: String, label: String, weight: float, stack: int, desc: String) -> ItemData:
	var d := ItemData.new()
	d.item_id = id
	d.display_name = label
	d.description = desc
	d.category = ItemData.Category.MATERIAL
	d.weight_kg = weight
	d.max_stack = stack
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
