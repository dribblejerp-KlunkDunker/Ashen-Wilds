class_name Objectives
extends Node
## Act I's objectives (docs/worldbuilding/README.md, the acts; act-one-the-outskirts.md): make the
## Wayfarer's Watchhouse a shelter and keep it. Four things, in any order:
##   - take back the Watchhouse: the goblins that came up its floor drain are dead;
##   - bring the Cast-Iron Cooking Pot home: carried to the shelter fire, it is set on the fire
##     (it leaves the pack; the bootstrap puts it on the fire bed);
##   - return the warning book's torn pages: carried into the Watchhouse, each is written back in
##     (it leaves the pack);
##   - break the ork hold on the Old Causeway: the pack at the east choke point is dead.
## When all four are done, the act is done. Nothing is lost if you die: enemies stay dead and the
## objectives latch. The lines go through Discovery's banner queue so they never cover a warning.

signal objective_completed(id: String)
signal act_completed

const TITLE := "ACT I - THE OUTSKIRTS"
const ORDER: Array[String] = ["watchhouse", "pot", "pages", "choke_point"]
const LABELS: Dictionary = {
	"watchhouse": "Take back the Watchhouse",
	"pot": "Bring the cooking pot to the shelter fire",
	"pages": "Return the warning book's torn pages",
	"choke_point": "Break the ork hold on the Old Causeway",
}
const DONE_TEXT: Dictionary = {
	"watchhouse": "The Watchhouse is ours again. Bar the door at night.",
	"pot": "The pot is home. Someone puts water on to boil.",
	"pages": "The book is whole again, as whole as it gets.",
	"choke_point": "The Causeway is open. Nobody will thank you, and the carts will come.",
}
const PAGE_TEXT := "Written in the book. Someone will know where they went."
const ACT_TEXT := "The shelter holds for the winter. Spring is still a long way off."
const ACT_LINE := "The shelter holds. Act I is done."

## The warning book's torn pages (LoreTexts.NOTES): the stash's, the spore cart's and the orks'.
const PAGE_IDS: Array[String] = ["note_02", "note_19", "note_20"]
const POT_ID := "cooking_pot"
## The shelter fire (the bootstrap's fire bed) and how close counts as "at the fire".
const FIRE_POS := Vector3(-6.5, 0.0, 4.8)
const FIRE_RADIUS: float = 2.6

var player: PlayerController
var hud: TacticalHUD
var discovery: Discovery
var watchhouse_foes: Array = []
var choke_foes: Array = []
var pages_returned: Array[String] = []
var _done: Dictionary = {}
var _act_done: bool = false

## Foes are anything with is_dead() (every enemy class has it).
func bind(p: PlayerController, h: TacticalHUD, d: Discovery, watchhouse: Array, choke: Array) -> void:
	player = p
	hud = h
	discovery = d
	watchhouse_foes = watchhouse
	choke_foes = choke
	_refresh_hud()

func is_done(id: String) -> bool:
	return _done.has(id)

func is_act_done() -> bool:
	return _act_done

func _physics_process(_delta: float) -> void:
	if player == null or not is_instance_valid(player):
		return
	if not is_done("watchhouse") and _all_dead(watchhouse_foes):
		_complete("watchhouse")
	if not is_done("choke_point") and _all_dead(choke_foes):
		_complete("choke_point")
	if not is_done("pot"):
		var pot: ItemInstance = player.inventory.find_first(POT_ID)
		var at: Vector3 = player.global_position
		if pot != null and Vector2(at.x - FIRE_POS.x, at.z - FIRE_POS.z).length() <= FIRE_RADIUS:
			player.inventory.remove(pot)
			player.inventory_changed.emit()
			_complete("pot")
	if not is_done("pages") and Discovery._inside({"rect": Discovery.WATCHHOUSE_RECT}, player.global_position):
		_return_pages()

static func _all_dead(foes: Array) -> bool:
	if foes.is_empty():
		return false
	for f: Variant in foes:
		if f is Object and is_instance_valid(f) and (f as Object).has_method("is_dead") and not bool((f as Object).call("is_dead")):
			return false
	return true

func _return_pages() -> void:
	var returned_now: int = 0
	for page_id: String in PAGE_IDS:
		if pages_returned.has(page_id):
			continue
		var page: ItemInstance = player.inventory.find_first(page_id)
		if page == null:
			continue
		player.inventory.remove(page)
		pages_returned.append(page_id)
		returned_now += 1
	if returned_now == 0:
		return
	player.inventory_changed.emit()
	if pages_returned.size() >= PAGE_IDS.size():
		_complete("pages")
	else:
		_say(PAGE_TEXT)
		_refresh_hud()

func _complete(id: String) -> void:
	if _done.has(id):
		return
	_done[id] = true
	_say(String(DONE_TEXT[id]))
	objective_completed.emit(id)
	if not _act_done and _done.size() >= ORDER.size():
		_act_done = true
		_say(ACT_TEXT)
		act_completed.emit()
	_refresh_hud()

func _say(text: String) -> void:
	if discovery != null and is_instance_valid(discovery):
		discovery.announce(text)
	elif hud != null:
		hud.show_banner(text, Discovery.BANNER_COLOR)

## The panel's lines: the title, then "[x]" or "[ ]" per objective (ASCII: the browser build has no
## system fonts), with the pages counted.
func lines() -> Array[String]:
	var out: Array[String] = [TITLE]
	for id: String in ORDER:
		var label: String = String(LABELS[id])
		if id == "pages" and not is_done(id):
			label += " (%d/%d)" % [pages_returned.size(), PAGE_IDS.size()]
		out.append(("[x] " if is_done(id) else "[ ] ") + label)
	if _act_done:
		out.append(ACT_LINE)
	return out

func _refresh_hud() -> void:
	if hud != null and is_instance_valid(hud):
		hud.set_objectives(lines())
