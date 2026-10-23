class_name BackgroundPicker
extends CanvasLayer
## Start screen (Milestone 7): choose one of the eight survivors. The world is
## paused while it's open. Keys 1-8 select, Enter begins.

signal background_chosen(bg: SurvivorBackground)

var _backgrounds: Array[SurvivorBackground] = []
var _selected: int = 0
var _buttons: Array[Button] = []
var _name_label: Label
var _blurb_label: Label
var _loadout_label: Label
var _trait_label: Label
var _flaw_label: Label

func _ready() -> void:
	layer = 20
	process_mode = Node.PROCESS_MODE_ALWAYS
	_backgrounds = BackgroundDatabase.all()

	var dim := ColorRect.new()
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.color = Color(0.03, 0.03, 0.035, 0.86)
	add_child(dim)

	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.09, 0.08, 0.08, 0.96)
	style.border_color = Color(0.36, 0.30, 0.24, 1.0)
	style.set_border_width_all(2)
	style.set_content_margin_all(18)

	var panel := PanelContainer.new()
	panel.position = Vector2(360, 170)
	panel.custom_minimum_size = Vector2(1200, 700)
	panel.add_theme_stylebox_override("panel", style)
	add_child(panel)

	var outer := VBoxContainer.new()
	outer.add_theme_constant_override("separation", 14)
	panel.add_child(outer)
	outer.add_child(_make_label("WHO WERE YOU BEFORE THE SMOTHERING?", 26, Color(0.90, 0.80, 0.62)))
	outer.add_child(_make_label("Every survivor carries one trait and one flaw. Neither ever leaves you.", 15, Color(0.66, 0.62, 0.56)))

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 24)
	row.size_flags_vertical = Control.SIZE_EXPAND_FILL
	outer.add_child(row)

	var list := VBoxContainer.new()
	list.custom_minimum_size = Vector2(360, 0)
	list.add_theme_constant_override("separation", 6)
	row.add_child(list)
	for i in range(_backgrounds.size()):
		var bg: SurvivorBackground = _backgrounds[i]
		var btn := Button.new()
		btn.text = "  [%d]  %s" % [i + 1, bg.display_name]
		btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
		btn.custom_minimum_size = Vector2(360, 52)
		btn.toggle_mode = true
		btn.add_theme_font_size_override("font_size", 18)
		var idx: int = i
		btn.pressed.connect(func() -> void: select(idx))
		btn.mouse_entered.connect(func() -> void: select(idx))
		list.add_child(btn)
		_buttons.append(btn)

	var detail := VBoxContainer.new()
	detail.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	detail.add_theme_constant_override("separation", 12)
	row.add_child(detail)
	_name_label = _make_label("", 24, Color(0.92, 0.84, 0.66))
	detail.add_child(_name_label)
	_blurb_label = _make_label("", 16, Color(0.72, 0.68, 0.62))
	_blurb_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_blurb_label.custom_minimum_size = Vector2(760, 0)
	detail.add_child(_blurb_label)
	_loadout_label = _make_label("", 15, Color(0.78, 0.74, 0.66))
	_loadout_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_loadout_label.custom_minimum_size = Vector2(760, 0)
	detail.add_child(_loadout_label)
	_trait_label = _make_label("", 17, Color(0.62, 0.82, 0.56))
	_trait_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_trait_label.custom_minimum_size = Vector2(760, 0)
	detail.add_child(_trait_label)
	_flaw_label = _make_label("", 17, Color(0.90, 0.48, 0.38))
	_flaw_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_flaw_label.custom_minimum_size = Vector2(760, 0)
	detail.add_child(_flaw_label)

	var spacer := Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	detail.add_child(spacer)
	var begin := Button.new()
	begin.text = "Begin as this survivor   [Enter]"
	begin.custom_minimum_size = Vector2(0, 54)
	begin.add_theme_font_size_override("font_size", 19)
	begin.pressed.connect(confirm)
	detail.add_child(begin)

	select(0)
	get_tree().paused = true

func _make_label(text: String, font_size: int, color: Color) -> Label:
	var lbl := Label.new()
	lbl.text = text
	lbl.add_theme_font_size_override("font_size", font_size)
	lbl.add_theme_color_override("font_color", color)
	return lbl

func get_selected() -> SurvivorBackground:
	return _backgrounds[_selected]

func select(index: int) -> void:
	_selected = clampi(index, 0, _backgrounds.size() - 1)
	for i in range(_buttons.size()):
		_buttons[i].set_pressed_no_signal(i == _selected)
	var bg: SurvivorBackground = _backgrounds[_selected]
	_name_label.text = bg.display_name
	_blurb_label.text = bg.blurb
	var parts: Array[String] = []
	for entry: Dictionary in bg.loadout:
		var data: ItemData = ItemDatabase.get_item(String(entry["id"]))
		var text: String = data.display_name
		if int(entry["qty"]) > 1:
			text += " ×%d" % int(entry["qty"])
		parts.append(text)
	_loadout_label.text = "CARRYING   " + ", ".join(parts)
	_trait_label.text = "TRAIT — %s: %s" % [bg.trait_name, bg.trait_desc]
	_flaw_label.text = "FLAW — %s: %s" % [bg.flaw_name, bg.flaw_desc]

func confirm() -> void:
	var bg: SurvivorBackground = get_selected()
	get_tree().paused = false
	background_chosen.emit(bg)
	queue_free()

func _input(event: InputEvent) -> void:
	if not (event is InputEventKey and event.pressed and not event.echo):
		return
	var key: Key = (event as InputEventKey).keycode
	if key >= KEY_1 and key <= KEY_8:
		select(int(key - KEY_1))
		get_viewport().set_input_as_handled()
	elif key == KEY_UP:
		select(_selected - 1)
		get_viewport().set_input_as_handled()
	elif key == KEY_DOWN:
		select(_selected + 1)
		get_viewport().set_input_as_handled()
	elif key == KEY_ENTER or key == KEY_KP_ENTER:
		get_viewport().set_input_as_handled()
		confirm()
