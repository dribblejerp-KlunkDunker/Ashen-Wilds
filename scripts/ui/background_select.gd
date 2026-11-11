class_name BackgroundSelect
extends CanvasLayer
## The start screen: "Who were you, before the Smothering?" Eight cards, one per
## SurvivorBackground, in two rows of four. Arrow keys or the number keys move the choice,
## Enter, Space or E confirm; a card can also be clicked, and clicked again to confirm. The
## picker only emits `chosen`; the bootstrap pauses the world while it is up and applies the
## choice, so the picker can be driven headless by the suite without pausing anything.
## Godot's default font only (the browser has no others), no symbols.

signal chosen(background: SurvivorBackground)

const COLUMNS: int = 4
const CARD_SIZE: Vector2 = Vector2(300.0, 250.0)
const COLOR_CARD: Color = Color(0.10, 0.09, 0.09, 0.94)
const COLOR_CARD_CHOSEN: Color = Color(0.17, 0.14, 0.11, 0.98)
const COLOR_EDGE: Color = Color(0.28, 0.25, 0.22)
const COLOR_EDGE_CHOSEN: Color = Color(0.86, 0.68, 0.38)

var selected: int = 0
var _cards: Array[PanelContainer] = []
var _backgrounds: Array[SurvivorBackground] = []
var _hint: Label


func _init() -> void:
	name = "BackgroundSelect"
	layer = 5
	process_mode = Node.PROCESS_MODE_ALWAYS
	_backgrounds = SurvivorBackground.all()

	var shade := ColorRect.new()
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	shade.color = Color(0.0, 0.0, 0.0, 0.72)
	add_child(shade)

	var centre := CenterContainer.new()
	centre.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(centre)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 14)
	centre.add_child(column)

	var title := Label.new()
	title.text = "WHO WERE YOU, BEFORE THE SMOTHERING?"
	title.add_theme_font_size_override("font_size", 26)
	title.add_theme_color_override("font_color", Color(0.86, 0.80, 0.68))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(title)

	var grid := GridContainer.new()
	grid.columns = COLUMNS
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 12)
	column.add_child(grid)
	for i: int in range(_backgrounds.size()):
		var card: PanelContainer = _make_card(i, _backgrounds[i])
		grid.add_child(card)
		_cards.append(card)

	_hint = Label.new()
	_hint.add_theme_font_size_override("font_size", 14)
	_hint.add_theme_color_override("font_color", Color(0.66, 0.62, 0.56))
	_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hint.text = "Arrows or 1-8 to choose   Enter, Space or E to begin   (click a card twice)"
	column.add_child(_hint)
	_refresh()


func _make_card(index: int, bg: SurvivorBackground) -> PanelContainer:
	var card := PanelContainer.new()
	card.custom_minimum_size = CARD_SIZE
	card.mouse_filter = Control.MOUSE_FILTER_STOP
	card.gui_input.connect(func(event: InputEvent) -> void:
		if event is InputEventMouseButton and event.pressed and (event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT:
			if selected == index:
				confirm()
			else:
				select(index)
	)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 6)
	card.add_child(box)
	box.add_child(_label("%d  %s" % [index + 1, bg.title.to_upper()], 15, Color(0.86, 0.80, 0.68)))
	box.add_child(_label(bg.epigraph, 12, Color(0.66, 0.62, 0.56)))
	box.add_child(_label("Carries: " + _gear_text(bg), 12, Color(0.74, 0.70, 0.64)))
	box.add_child(_label("%s: %s" % [bg.trait_name, bg.trait_text], 12, Color(0.62, 0.74, 0.58)))
	box.add_child(_label("%s: %s" % [bg.flaw_name, bg.flaw_text], 12, Color(0.84, 0.52, 0.42)))
	return card


func _label(text: String, size: int, color: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return l


static func _gear_text(bg: SurvivorBackground) -> String:
	var parts: Array[String] = []
	for entry: Array in bg.gear:
		var data: ItemData = ItemDatabase.get_item(String(entry[0]))
		var label: String = data.display_name if data != null else String(entry[0])
		if int(entry[1]) > 1:
			label += " x%d" % int(entry[1])
		parts.append(label)
	return ", ".join(parts) if not parts.is_empty() else "nothing but your hands"


func _refresh() -> void:
	for i: int in range(_cards.size()):
		var style := StyleBoxFlat.new()
		style.bg_color = COLOR_CARD_CHOSEN if i == selected else COLOR_CARD
		style.border_color = COLOR_EDGE_CHOSEN if i == selected else COLOR_EDGE
		style.set_border_width_all(2)
		style.set_content_margin_all(10.0)
		_cards[i].add_theme_stylebox_override("panel", style)


func select(index: int) -> void:
	selected = wrapi(index, 0, _backgrounds.size())
	_refresh()


func move_selection(dx: int, dy: int = 0) -> void:
	var col: int = selected % COLUMNS
	var row: int = selected / COLUMNS
	var rows: int = int(ceil(float(_backgrounds.size()) / COLUMNS))
	col = wrapi(col + dx, 0, COLUMNS)
	row = wrapi(row + dy, 0, rows)
	select(mini(row * COLUMNS + col, _backgrounds.size() - 1))


func current() -> SurvivorBackground:
	return _backgrounds[selected]


func confirm() -> void:
	chosen.emit(current())


func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventKey) or not event.pressed or event.echo:
		return
	var key: InputEventKey = event
	match key.keycode:
		KEY_LEFT, KEY_A:
			move_selection(-1)
		KEY_RIGHT, KEY_D:
			move_selection(1)
		KEY_UP, KEY_W:
			move_selection(0, -1)
		KEY_DOWN, KEY_S:
			move_selection(0, 1)
		KEY_ENTER, KEY_KP_ENTER, KEY_SPACE, KEY_E:
			confirm()
		_:
			if key.keycode >= KEY_1 and key.keycode <= KEY_8:
				select(key.keycode - KEY_1)
			else:
				return
	get_viewport().set_input_as_handled()
