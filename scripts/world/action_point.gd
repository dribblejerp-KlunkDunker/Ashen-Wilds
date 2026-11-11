class_name ActionPoint
extends Lootable
## Something the survivor does to the world with [E] over a few seconds, using the same prompt,
## channel and cancel rules as a search, but with an action at the end instead of a loot window:
## cutting a captive free, lifting a downed companion. `action` is called with the survivor when
## the time is up; the point stays until whoever made it removes it.

var action: Callable


static func make(label: String, verb: String, verb_progressive: String, seconds: float, radius: float, p_action: Callable) -> ActionPoint:
	var a := ActionPoint.new()
	a.name = "ActionPoint"
	a.display_name = label
	a.search_verb = verb
	a.search_verb_progressive = verb_progressive
	a.search_duration = seconds
	a.interact_radius = radius
	a.action = p_action
	return a


func on_search_complete(by: Node3D) -> bool:
	searched = false
	if action.is_valid():
		action.call(by)
	return true
