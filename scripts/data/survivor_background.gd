class_name SurvivorBackground
extends RefCounted
## A starting survivor (Milestone 7): loadout, one trait and one permanent
## flaw. Built in code by BackgroundDatabase. Every modifier defaults to
## "no change" so a background only states what makes it different.

var background_id: String = ""
var display_name: String = ""
var blurb: String = ""
var trait_name: String = ""
var trait_desc: String = ""
var flaw_name: String = ""
var flaw_desc: String = ""

## Each entry: {"id": String, "qty": int, "cond": float (-1 = full)}.
var loadout: Array[Dictionary] = []
var main_hand_id: String = ""
var off_hand_id: String = ""

# Flat stat changes
var capacity_bonus_kg: float = 0.0
var max_health_bonus: float = 0.0
var max_stamina_bonus: float = 0.0
var max_poise_bonus: float = 0.0
var bandage_heal_bonus: float = 0.0

# Multipliers (1.0 = unchanged)
var stamina_regen_mult: float = 1.0
var sprint_speed_mult: float = 1.0
var block_stamina_mult: float = 1.0
var bandage_time_mult: float = 1.0
var search_time_mult: float = 1.0
var swap_time_mult: float = 1.0
var torch_burn_mult: float = 1.0
var weapon_wear_mult: float = 1.0
var recoil_time_mult: float = 1.0
## Hearing radius of your walking footsteps.
var footstep_noise_mult: float = 1.0
## Replaces the 3x clang wear when >= 0.
var clang_wear_mult: float = -1.0

## Ash-Lung: an involuntary cough every so often that enemies can hear.
var coughs: bool = false

func add_item(id: String, qty: int = 1, cond: float = -1.0) -> SurvivorBackground:
	loadout.append({"id": id, "qty": qty, "cond": cond})
	return self
