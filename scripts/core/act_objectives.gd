class_name ActObjectives
extends Node
## Milestone 13: the Act I objective tracker. Each objective is a check
## (Callable -> bool) plus a progress line (Callable -> String). They're
## re-evaluated twice a second; an objective, once done, stays done. When
## every non-optional objective is done the act completes, once.

signal objective_completed(id: String, title: String)
signal act_completed

## Each: {id, title, optional, check: Callable, progress: Callable, done: bool}
var objectives: Array[Dictionary] = []
var act_title: String = "ACT I — THE BLACKFEN OUTSKIRTS"
var completed: bool = false
var elapsed: float = 0.0

var _eval_timer: float = 0.0

func add(id: String, title: String, check: Callable, progress: Callable = Callable(), optional: bool = false) -> void:
	objectives.append({
		"id": id, "title": title, "optional": optional,
		"check": check, "progress": progress, "done": false,
	})

func _process(delta: float) -> void:
	if not completed:
		elapsed += delta
	_eval_timer -= delta
	if _eval_timer <= 0.0:
		_eval_timer = 0.5
		evaluate()

## Re-checks every objective. Public so tests can force it.
func evaluate() -> void:
	for o: Dictionary in objectives:
		if o["done"]:
			continue
		if (o["check"] as Callable).call():
			o["done"] = true
			objective_completed.emit(String(o["id"]), String(o["title"]))
	if not completed and is_act_complete():
		completed = true
		act_completed.emit()

func is_done(id: String) -> bool:
	for o: Dictionary in objectives:
		if o["id"] == id:
			return o["done"]
	return false

func is_act_complete() -> bool:
	for o: Dictionary in objectives:
		if not o["optional"] and not o["done"]:
			return false
	return not objectives.is_empty()

## One line per objective for the HUD: "[x] Title — progress".
func summary_lines() -> Array[String]:
	var out: Array[String] = []
	for o: Dictionary in objectives:
		var mark: String = "[x]" if o["done"] else "[ ]"
		var line: String = "%s %s%s" % [mark, o["title"], "  (optional)" if o["optional"] else ""]
		var progress: Callable = o["progress"]
		if not o["done"] and progress.is_valid():
			var p: String = progress.call()
			if p != "":
				line += " — " + p
		out.append(line)
	return out

func done_count() -> int:
	return objectives.filter(func(o: Dictionary) -> bool: return o["done"]).size()
