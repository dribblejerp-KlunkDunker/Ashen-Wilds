class_name Discovery
extends Node
## One-time discovery banners: the first time the survivor reaches a place, opens the shelter stash,
## takes certain things, reads a page of the warning book or lights a torch, the HUD says a line
## from the world bible (docs/worldbuilding/items-and-texts.md, section 4.3; the Drowned Graves and
## the Roofed Gallery lines come from act-one-the-outskirts.md and the bestiary). Presentation only:
## nothing in the simulation reads it.
##
## A discovery never covers a banner already on screen (an enemy's warning, a weather change): it
## waits in a queue until the HUD is free. Each fires once per run.

const BANNER_COLOR := Color(0.80, 0.76, 0.62)
## The Watchhouse interior on the ground (min x, max x, min z, max z); Objectives uses it too.
const WATCHHOUSE_RECT: Array = [1.0, 9.0, -7.0, 1.0]

## Places, in the Act I level's coordinates. A place is a circle (centre, radius) or, for the
## Watchhouse interior, a rectangle on the ground (min x, max x, min z, max z).
const PLACES: Array[Dictionary] = [
	{"id": "watchhouse", "rect": WATCHHOUSE_RECT,
		"text": "The Wayfarer's Watchhouse. Touch the lintel going in; everyone does."},
	{"id": "choke_point", "centre": Vector3(12.8, 0.0, 9.6), "radius": 4.0,
		"text": "The East Choke Point. The Watch held this wall for twenty-six years."},
	{"id": "feeding_ground", "centre": Vector3(-15.0, 0.0, -13.0), "radius": 5.0,
		"text": "Bones in a ring, and the smell of the heap. This is its feeding ground."},
	{"id": "spore_hollow", "centre": Vector3(-22.5, 0.0, -1.5), "radius": 6.0,
		"text": "The Spore Hollow. Three died at that cart, and nobody limed them."},
	{"id": "old_quarry", "centre": Vector3(15.5, 0.0, -14.5), "radius": 6.0,
		"text": "Rings of shattered stone. Something pounds here. Stand still and be stone."},
	{"id": "drowned_graves", "centre": Vector3(17.5, 0.0, 19.5), "radius": 4.5,
		"text": "The Drowned Graves. They went into the wet ground with no names spoken."},
	{"id": "roofed_gallery", "centre": Vector3(-22.5, 0.0, 19.5), "radius": 4.0,
		"text": "A roofed passage, and a clean floor where the ash should lie."},
]

## The first time one of these is taken from the world.
const FIRST_TAKEN: Dictionary = {
	"salt": "Salt. Struck level, it pays for nearly everything.",
	"cooking_pot": "The pot. Heavy and precious: the shelter can boil water again.",
	"kettle_hat": "A name scratched in the lining. Someone should tell the book.",
	"rusted_hauberk": "Watch mail from the Causeway tower. The orks dragged it off with the iron.",
}

## The torn pages of the warning book: reading the first of them.
const WARNING_BOOK_PAGES: Array[String] = ["note_02", "note_19", "note_20"]
const WARNING_BOOK_TEXT := "A page torn from the warning book. It belongs at the Watchhouse."
const STASH_TEXT := "The shelter stash. Take what you need, and say what you took."
const TORCH_TEXT := "A light means fuel, not safety."

var player: PlayerController
var hud: TacticalHUD
var _seen: Dictionary = {}
var _queue: Array[String] = []

func bind(p: PlayerController, h: TacticalHUD) -> void:
	player = p
	hud = h
	player.item_taken.connect(_on_item_taken)
	player.loot_opened.connect(_on_loot_opened)
	if hud.inventory_ui:
		hud.inventory_ui.note_read.connect(_on_note_read)

func has_seen(id: String) -> bool:
	return _seen.has(id)

## Queues a banner the first time `id` is noticed; later calls do nothing.
func notice(id: String, text: String) -> void:
	if _seen.has(id):
		return
	_seen[id] = true
	_queue.append(text)

## Queues a line that is not a one-time discovery (an objective done, a page written in the book),
## on the same queue, so nothing covers anything else.
func announce(text: String) -> void:
	_queue.append(text)

func pending() -> int:
	return _queue.size()

func _physics_process(_delta: float) -> void:
	if player == null or not is_instance_valid(player):
		return
	var at: Vector3 = player.global_position
	for place: Dictionary in PLACES:
		if not _seen.has(place["id"]) and _inside(place, at):
			notice(String(place["id"]), String(place["text"]))
	if not _seen.has("torch") and player.is_torch_lit():
		notice("torch", TORCH_TEXT)
	if not _queue.is_empty() and hud != null and not hud.banner_showing():
		hud.show_banner(_queue.pop_front(), BANNER_COLOR)

static func _inside(place: Dictionary, at: Vector3) -> bool:
	if place.has("rect"):
		var r: Array = place["rect"]
		return at.x >= float(r[0]) and at.x <= float(r[1]) and at.z >= float(r[2]) and at.z <= float(r[3])
	var c: Vector3 = place["centre"]
	return Vector2(at.x - c.x, at.z - c.z).length() <= float(place["radius"])

func _on_item_taken(item_id: String, _from: Lootable) -> void:
	if FIRST_TAKEN.has(item_id):
		notice("took_" + item_id, String(FIRST_TAKEN[item_id]))

func _on_loot_opened(lootable: Lootable) -> void:
	if lootable != null and is_instance_valid(lootable) and lootable.display_name == "Shelter Stash":
		notice("stash", STASH_TEXT)

func _on_note_read(item_id: String) -> void:
	if WARNING_BOOK_PAGES.has(item_id):
		notice("warning_book", WARNING_BOOK_TEXT)
