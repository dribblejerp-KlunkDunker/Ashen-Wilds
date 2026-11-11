class_name SurvivorBackground
extends RefCounted
## Who the survivor was before the Smothering. Eight backgrounds, each a starting kit, one trait
## and one permanent flaw, all data: `PlayerController.apply_background()` reads the numbers.
## Absolute fields replace the survivor's base stat; `*_mult` fields scale it. Everything is
## created in code here, like the items (ItemDatabase), and the Watch Deserter is the default,
## whose kit is the prototype's original loadout so the suite's expectations hold.
##
## Drawn from the worldbuilding's people: road carriers of the Cinder Factors, chapel cleaners,
## hedge-priests, deserters from the Watch, the Gutter-kin, the fen's healers and carters.

var id: String
var title: String
## One line, spoken in the second person, shown on the picker and as the banner on choosing.
var epigraph: String
## [[item_id, quantity, condition], ...]; condition -1 keeps the item's default.
var gear: Array = []
var main_hand_id: String = ""
var off_hand_id: String = ""
## Armour in the kit that starts worn.
var worn_ids: Array[String] = []
var trait_name: String
var trait_text: String
var flaw_name: String
var flaw_text: String

var health: float = 100.0
var stamina: float = 100.0
var poise: float = 35.0
var carry_kg: float = 18.0
var dodge_cost: float = 22.0
var stamina_regen_mult: float = 1.0
var move_speed_mult: float = 1.0
var sprint_speed_mult: float = 1.0
var attack_cost_mult: float = 1.0
var heavy_allowed: bool = true
var heavy_damage_mult: float = 1.0
var block_cost_mult: float = 1.0
var weapon_wear_mult: float = 1.0
var search_time_mult: float = 1.0
var bandage_time_mult: float = 1.0
var bandage_heal: float = 8.0
var bleed_seconds: float = 12.0
## How far the survivor's own noise carries, on top of load and weather.
var own_noise_mult: float = 1.0
## The survivor's eyes and ears, on top of the weather (Perception).
var sight_mult: float = 1.0
var hearing_mult: float = 1.0
var torch_burn_mult: float = 1.0

const DEFAULT_ID: String = "watch_deserter"

static var _all: Array[SurvivorBackground] = []


static func all() -> Array[SurvivorBackground]:
	if _all.is_empty():
		_all = _build()
	return _all


static func by_id(bg_id: String) -> SurvivorBackground:
	for b: SurvivorBackground in all():
		if b.id == bg_id:
			return b
	return null


static func default_background() -> SurvivorBackground:
	return by_id(DEFAULT_ID)


static func _make(bg_id: String, p_title: String, p_epigraph: String, p_gear: Array, main_id: String, off_id: String,
		t_name: String, t_text: String, f_name: String, f_text: String) -> SurvivorBackground:
	var b := SurvivorBackground.new()
	b.id = bg_id
	b.title = p_title
	b.epigraph = p_epigraph
	b.gear = p_gear
	b.main_hand_id = main_id
	b.off_hand_id = off_id
	b.trait_name = t_name
	b.trait_text = t_text
	b.flaw_name = f_name
	b.flaw_text = f_text
	return b


static func _build() -> Array[SurvivorBackground]:
	var out: Array[SurvivorBackground] = []
	var b: SurvivorBackground

	b = _make("watch_deserter", "Watch Deserter",
		"You held the Causeway tower until you didn't. The sword is the one you were issued.",
		[["arming_sword", 1, 88.0], ["wooden_targe", 1, -1.0], ["pitch_torch", 1, 180.0], ["clean_rag_bandage", 2, -1.0]],
		"arming_sword", "wooden_targe",
		"Drilled", "Blocking costs a quarter less stamina. Your old coif is in the shelter stash.",
		"Old wound", "90 health.")
	b.block_cost_mult = 0.75
	b.health = 90.0
	out.append(b)

	b = _make("cinder_factor", "Cinder Factor",
		"A road carrier. You have walked every embankment of the Blackfen with a load on your back.",
		[["boar_spear", 1, -1.0], ["pitch_torch", 1, 240.0], ["clean_rag_bandage", 2, -1.0]],
		"boar_spear", "",
		"Packhorse", "Carries 26 kg before slowing, and a full pack clatters less.",
		"Bad knees", "Sprint at 85%; a dodge costs 30 stamina.")
	b.carry_kg = 26.0
	b.own_noise_mult = 0.9
	b.sprint_speed_mult = 0.85
	b.dodge_cost = 30.0
	out.append(b)

	b = _make("chapel_cleaner", "Chapel Cleaner",
		"You swept a chapel floor for twenty years and know where everything is kept.",
		[["wooden_targe", 1, -1.0], ["pitch_torch", 1, 300.0], ["clean_rag_bandage", 4, -1.0]],
		"", "wooden_targe",
		"Quiet hands", "Searches take a third less time; your steps carry less far.",
		"Untrained", "Attacks cost a third more stamina and wear a weapon twice as fast.")
	b.search_time_mult = 0.65
	b.own_noise_mult = 0.8
	b.attack_cost_mult = 1.3
	b.weapon_wear_mult = 2.0
	out.append(b)

	b = _make("peat_cutter", "Peat-cutter",
		"Your arms were made by the fen. The axe was for roots; it serves for other things.",
		[["woodsmans_broadaxe", 1, -1.0], ["pitch_torch", 1, 150.0], ["clean_rag_bandage", 1, -1.0]],
		"woodsmans_broadaxe", "",
		"Strong back", "Carries 23 kg; heavy strikes deal 15% more.",
		"Winded", "80 stamina, and it comes back slower.")
	b.carry_kg = 23.0
	b.heavy_damage_mult = 1.15
	b.stamina = 80.0
	b.stamina_regen_mult = 0.9
	out.append(b)

	b = _make("gutter_kin", "Gutter-kin",
		"You grew up under the Roofed Mile taking what wasn't watched. The sword was someone else's.",
		[["arming_sword", 1, 55.0], ["pitch_torch", 1, 90.0], ["clean_rag_bandage", 2, -1.0]],
		"arming_sword", "",
		"Soft-footed", "Your steps carry a third less far; dodges cost 16; you see a little further.",
		"Frail", "75 health, and a wound bleeds half again as long.")
	b.own_noise_mult = 0.65
	b.dodge_cost = 16.0
	b.sight_mult = 1.15
	b.health = 75.0
	b.bleed_seconds = 18.0
	out.append(b)

	b = _make("hedge_priest", "Hedge-priest",
		"No chapel will have you, so the road is your chapel. You keep the light lit.",
		[["wooden_targe", 1, -1.0], ["pitch_torch", 1, 360.0], ["clean_rag_bandage", 3, -1.0]],
		"", "wooden_targe",
		"Steady", "50 poise; stamina returns a quarter faster.",
		"Sworn hands", "You will not strike a heavy blow.")
	b.poise = 50.0
	b.stamina_regen_mult = 1.25
	b.heavy_allowed = false
	out.append(b)

	b = _make("fen_healer", "Fen Healer",
		"You have closed more wounds than you have made. You see poorly in the dark, and know it.",
		[["boar_spear", 1, -1.0], ["pitch_torch", 1, 200.0], ["clean_rag_bandage", 5, -1.0]],
		"boar_spear", "",
		"Deft", "Bandaging takes half the time and heals twice as much.",
		"Night-blind", "You see only 60% as far.")
	b.bandage_time_mult = 0.5
	b.bandage_heal = 16.0
	b.sight_mult = 0.6
	out.append(b)

	b = _make("causeway_carter", "Causeway Carter",
		"Carts and oxen, and a cart-axe for the things that come out of the reeds. One ear went to a squall.",
		[["woodsmans_broadaxe", 1, -1.0], ["wooden_targe", 1, -1.0], ["quilted_gambeson", 1, 90.0], ["pitch_torch", 1, 180.0], ["clean_rag_bandage", 2, -1.0]],
		"woodsmans_broadaxe", "wooden_targe",
		"Hardy", "120 health, a worn gambeson; wounds bleed a quarter less long.",
		"One good ear", "You hear only 70% as far.")
	b.worn_ids = ["quilted_gambeson"]
	b.health = 120.0
	b.bleed_seconds = 9.0
	b.hearing_mult = 0.7
	out.append(b)

	return out
