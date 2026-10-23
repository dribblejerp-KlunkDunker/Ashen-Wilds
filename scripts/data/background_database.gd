class_name BackgroundDatabase
extends RefCounted
## The eight starting survivors (Milestone 7). Numbers are first-pass
## proposals for playtesting; see docs/ROADMAP.md.

static var _list: Array[SurvivorBackground] = []

static func all() -> Array[SurvivorBackground]:
	if _list.is_empty():
		_build()
	return _list

static func get_background(id: String) -> SurvivorBackground:
	for bg: SurvivorBackground in all():
		if bg.background_id == id:
			return bg
	push_error("BackgroundDatabase: unknown background id '%s'" % id)
	return null

static func _make(id: String, label: String, blurb: String) -> SurvivorBackground:
	var bg := SurvivorBackground.new()
	bg.background_id = id
	bg.display_name = label
	bg.blurb = blurb
	_list.append(bg)
	return bg

static func _build() -> void:
	var b: SurvivorBackground

	b = _make("citadel_deserter", "Citadel Deserter",
		"You walked off the Highland wall the night the Vaults broke. The drill never left you.")
	b.add_item("arming_sword", 1, 88.0).add_item("wooden_targe").add_item("pitch_torch", 1, 180.0).add_item("clean_rag_bandage", 2)
	b.main_hand_id = "arming_sword"
	b.off_hand_id = "wooden_targe"
	b.trait_name = "Shield Drill"
	b.trait_desc = "Blocking costs 25% less stamina."
	b.block_stamina_mult = 0.75
	b.flaw_name = "Bad Knee"
	b.flaw_desc = "A fall from the wall. Sprinting is 12% slower."
	b.sprint_speed_mult = 0.88

	b = _make("peat_cutter", "Peat-Cutter",
		"Twenty winters hauling turf out of the Blackfen. You can carry a bog on your back.")
	b.add_item("woodsmans_broadaxe", 1, 70.0).add_item("pitch_torch", 1, 200.0).add_item("timber", 2).add_item("clean_rag_bandage", 1)
	b.main_hand_id = "woodsmans_broadaxe"
	b.off_hand_id = "pitch_torch"
	b.trait_name = "Strong Back"
	b.trait_desc = "+5 kg carry capacity."
	b.capacity_bonus_kg = 5.0
	b.flaw_name = "Bog Lung"
	b.flaw_desc = "Marsh damp in your chest. −15 max stamina."
	b.max_stamina_bonus = -15.0

	b = _make("boar_hunter", "Boar Hunter",
		"You fed a village on what you could spear in the reeds. You learned to move without a sound.")
	b.add_item("boar_spear", 1, 80.0).add_item("pitch_torch", 1, 160.0).add_item("clean_rag_bandage", 1)
	b.main_hand_id = "boar_spear"
	b.off_hand_id = "pitch_torch"
	b.trait_name = "Light Step"
	b.trait_desc = "Walking is 40% quieter."
	b.footstep_noise_mult = 0.6
	b.flaw_name = "Old Goring"
	b.flaw_desc = "A tusk scar that never closed right. −20 max health."
	b.max_health_bonus = -20.0

	b = _make("hedge_surgeon", "Hedge Surgeon",
		"Barber, bonesetter, midwife. You've stitched more wounds than you've opened.")
	b.add_item("arming_sword", 1, 55.0).add_item("clean_rag_bandage", 5).add_item("salt", 2)
	b.main_hand_id = "arming_sword"
	b.trait_name = "Steady Hands"
	b.trait_desc = "Bandaging is 45% faster and heals 10 more."
	b.bandage_time_mult = 0.55
	b.bandage_heal_bonus = 10.0
	b.flaw_name = "Frail"
	b.flaw_desc = "Thin from the hungry years. −10 max poise."
	b.max_poise_bonus = -10.0

	b = _make("ferrymans_widow", "Ferryman's Widow",
		"You kept the crossing-fire lit for a husband who never rowed home.")
	b.add_item("arming_sword", 1, 75.0).add_item("pitch_torch", 1, 240.0).add_item("lamp_oil", 1).add_item("clean_rag_bandage", 1)
	b.main_hand_id = "arming_sword"
	b.off_hand_id = "pitch_torch"
	b.trait_name = "Fire-Keeper"
	b.trait_desc = "Your torch burns 40% slower."
	b.torch_burn_mult = 0.6
	b.flaw_name = "Grief-Worn"
	b.flaw_desc = "Some mornings you can barely stand. Stamina regenerates 15% slower."
	b.stamina_regen_mult = 0.85

	b = _make("vault_runaway", "Vault Runaway",
		"Born in the Deep-Seam galleries, you ran when the ash-spores came up the shafts.")
	b.add_item("woodsmans_broadaxe", 1, 85.0).add_item("clean_rag_bandage", 1)
	b.main_hand_id = "woodsmans_broadaxe"
	b.trait_name = "Tunnel-Born"
	b.trait_desc = "Swinging in tight galleries is second nature: clangs cost normal wear and recoil half as long."
	b.clang_wear_mult = 1.0
	b.recoil_time_mult = 0.5
	b.flaw_name = "Ash-Lung"
	b.flaw_desc = "You cough every so often, and everything nearby hears it."
	b.coughs = true

	b = _make("salt_smuggler", "Salt-Smuggler",
		"You ran salt past the toll-forts for years. Quick fingers, and nerves that never settled.")
	b.add_item("arming_sword", 1, 80.0).add_item("wooden_targe", 1, 90.0).add_item("salt", 3)
	b.main_hand_id = "arming_sword"
	b.off_hand_id = "wooden_targe"
	b.trait_name = "Light Fingers"
	b.trait_desc = "Searching is 35% faster."
	b.search_time_mult = 0.65
	b.flaw_name = "Shaking Hands"
	b.flaw_desc = "Equipment swaps take 50% longer."
	b.swap_time_mult = 1.5

	b = _make("disgraced_squire", "Disgraced Squire",
		"Stripped of your spurs for a duel you shouldn't have won. You still stand like a knight.")
	b.add_item("arming_sword", 1, 100.0).add_item("wooden_targe").add_item("clean_rag_bandage", 1)
	b.main_hand_id = "arming_sword"
	b.off_hand_id = "wooden_targe"
	b.trait_name = "Tourney Poise"
	b.trait_desc = "+12 max poise."
	b.max_poise_bonus = 12.0
	b.flaw_name = "Soft Grip"
	b.flaw_desc = "Court-trained, never field-trained. Weapons wear 50% faster."
	b.weapon_wear_mult = 1.5
