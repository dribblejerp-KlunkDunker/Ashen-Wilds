class_name CraftingUI
extends Control
## Milestone 18: "Work at the fire" panel. Lists every recipe with its
## ingredients; ones you can't make say why. Opens with [K] at the shelter
## fire and closes when you walk away. Pressing Make starts the timed
## channel and closes the panel so you can watch the progress bar.

const TEXT_DIM := Color(0.66, 0.62, 0.56)
const TEXT_MAIN := Color(0.82, 0.78, 0.70)
const TEXT_WARN := Color(0.86, 0.50, 0.32)

var _player: PlayerController
var _stash: Lootable
var _panel: PanelContainer
var _list: VBoxContainer
var _note: Label

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.09, 0.08, 0.08, 0.95)
	style.border_color = Color(0.40, 0.30, 0.20, 1.0)
	style.set_border_width_all(2)
	style.set_content_margin_all(14)
	_panel = PanelContainer.new()
	_panel.position = Vector2(560, 150)
	_panel.custom_minimum_size = Vector2(800, 0)
	_panel.add_theme_stylebox_override("panel", style)
	add_child(_panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	_panel.add_child(box)
	box.add_child(_make_label("WORK AT THE FIRE   [K] close", 16, Color(0.90, 0.78, 0.56)))
	_note = _make_label("Ingredients come from your pack first, then the shelter stash.", 12, TEXT_DIM)
	box.add_child(_note)
	_list = VBoxContainer.new()
	_list.add_theme_constant_override("separation", 6)
	box.add_child(_list)
	_panel.visible = false

func bind(p: PlayerController, stash: Lootable) -> void:
	_player = p
	_stash = stash

func is_open() -> bool:
	return _panel.visible

func toggle() -> void:
	if _panel.visible:
		close()
	else:
		open()

func open() -> void:
	_panel.visible = true
	rebuild()
	if _player:
		_player.set_ui_capture(true)

func close() -> void:
	if not _panel.visible:
		return
	_panel.visible = false
	if _player:
		_player.set_ui_capture(false)

func rebuild() -> void:
	for c: Node in _list.get_children():
		c.queue_free()
	for recipe: Dictionary in Crafting.all():
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 10)
		var reason: String = Crafting.why_not(recipe, _player, _stash)
		var parts: Array[String] = []
		var inputs: Dictionary = recipe["inputs"]
		for id: String in inputs.keys():
			parts.append("%d× %s" % [int(inputs[id]), ItemDatabase.get_item(id).display_name])
		if String(recipe["tool"]) != "":
			parts.append("in the %s" % ItemDatabase.get_item(String(recipe["tool"])).display_name)
		var lbl := _make_label("%s   (%.1fs)   %s" % [recipe["name"], float(recipe["time"]), ", ".join(parts)], 13, TEXT_MAIN if reason == "" else TEXT_DIM)
		lbl.custom_minimum_size = Vector2(560, 0)
		lbl.tooltip_text = String(recipe["desc"])
		lbl.mouse_filter = Control.MOUSE_FILTER_PASS
		row.add_child(lbl)
		if reason == "":
			var btn := Button.new()
			btn.text = "Make"
			var rid: String = String(recipe["id"])
			btn.pressed.connect(func() -> void: make(rid))
			row.add_child(btn)
		else:
			row.add_child(_make_label(reason, 12, TEXT_WARN))
		_list.add_child(row)

## Starts a recipe; returns "" on success or the reason it couldn't.
func make(recipe_id: String) -> String:
	if _player == null:
		return "no survivor"
	close()
	var reason: String = _player.start_craft(recipe_id, _stash)
	if reason != "":
		_player.combat_banner_message.emit("Can't: %s" % reason, TEXT_WARN)
	return reason

func _make_label(text: String, font_size: int, color: Color) -> Label:
	var lbl := Label.new()
	lbl.text = text
	lbl.add_theme_font_size_override("font_size", font_size)
	lbl.add_theme_color_override("font_color", color)
	return lbl
