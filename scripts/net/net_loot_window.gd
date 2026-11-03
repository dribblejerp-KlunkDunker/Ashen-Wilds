class_name NetLootWindow
extends CanvasLayer
## Client presentation of one shared container (supplement §36, §47). Explicit buttons, no
## drag and drop. Each row shows the server's last snapshot; a request marks its row pending
## until the server answers, and the answer (accepted quantity or the reason) is shown in
## words. Nothing here changes any state: it only asks NetMain to send requests.

signal take_requested(object_id: String, stack_id: int, quantity: int)
signal store_requested(object_id: String, item_id: String, quantity: int)
signal closed

const BG := Color(0.09, 0.08, 0.08, 0.94)
const BORDER := Color(0.30, 0.26, 0.22, 1.0)
const DIM := Color(0.66, 0.62, 0.56)
const MAIN := Color(0.82, 0.78, 0.70)
const WARN := Color(0.90, 0.46, 0.28)
const GOOD := Color(0.62, 0.78, 0.52)

var object_id: String = ""
var _panel: PanelContainer
var _title: Label
var _rows: VBoxContainer
var _pack_line: Label
var _pack_rows: VBoxContainer
var _status: Label
var _pending_stacks: Dictionary = {}  # stack_id -> true while a take is unanswered
var _pending_items: Dictionary = {}   # item_id -> true while a store is unanswered
var _pack_stacks: Array = []


func _ready() -> void:
	layer = 11
	visible = false
	_panel = PanelContainer.new()
	_panel.position = Vector2(40.0, 160.0)  # below the development HUD's lines
	_panel.custom_minimum_size = Vector2(440.0, 0.0)
	var style := StyleBoxFlat.new()
	style.bg_color = BG
	style.border_color = BORDER
	style.set_border_width_all(1)
	style.set_content_margin_all(12.0)
	_panel.add_theme_stylebox_override("panel", style)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 6)
	_panel.add_child(box)
	_title = _label("", 15, MAIN)
	box.add_child(_title)
	_pack_line = _label("", 13, DIM)
	box.add_child(_pack_line)
	_rows = VBoxContainer.new()
	_rows.add_theme_constant_override("separation", 4)
	box.add_child(_rows)
	box.add_child(_label("YOUR PACK", 13, MAIN))
	_pack_rows = VBoxContainer.new()
	_pack_rows.add_theme_constant_override("separation", 4)
	box.add_child(_pack_rows)
	_status = _label("", 13, DIM)
	_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_status.custom_minimum_size = Vector2(416.0, 0.0)
	box.add_child(_status)
	var close := Button.new()
	close.text = "Close  [F / Esc]"
	close.pressed.connect(func() -> void: close_window())
	box.add_child(close)
	add_child(_panel)


func open_window(id: String, title: String) -> void:
	object_id = id
	_title.text = title.to_upper()
	_status.text = "Asking the server what is here…"
	_pending_stacks.clear()
	_pending_items.clear()
	_clear_rows()
	_rebuild_pack()
	_status.add_theme_color_override("font_color", DIM)
	visible = true


func close_window() -> void:
	if not visible:
		return
	visible = false
	object_id = ""
	_pending_stacks.clear()
	_pending_items.clear()
	closed.emit()


func show_contents(id: String, stacks: Array) -> void:
	if id != object_id:
		return
	_clear_rows()
	if stacks.is_empty():
		_rows.add_child(_label("Empty.", 13, DIM))
	for s: Array in stacks:
		var stack_id: int = int(s[0])
		var data: ItemData = ItemDatabase.get_item(str(s[1]))
		var quantity: int = int(s[2])
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		var text: String = (data.display_name if data else str(s[1]))
		if quantity > 1:
			text += " ×%d" % quantity
		text += "   %.1f kg" % ((data.weight_kg if data else 0.0) * quantity)
		if _pending_stacks.has(stack_id):
			text += "   …"
		var name_label: Label = _label(text, 13, MAIN)
		name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(name_label)
		var take_one := Button.new()
		take_one.text = "Take 1"
		take_one.disabled = _pending_stacks.has(stack_id)
		take_one.pressed.connect(func() -> void: take_requested.emit(object_id, stack_id, 1))
		row.add_child(take_one)
		if quantity > 1:
			var take_all := Button.new()
			take_all.text = "Take all"
			take_all.disabled = _pending_stacks.has(stack_id)
			take_all.pressed.connect(func() -> void: take_requested.emit(object_id, stack_id, quantity))
			row.add_child(take_all)
		_rows.add_child(row)
	if _status.text.begins_with("Asking"):
		_status.text = ""


func show_pack(stacks: Array, weight: float, capacity: float, hard_limit: float) -> void:
	var state: String = ""
	if weight > capacity + 0.0001:
		state = "   BURDENED" if weight <= hard_limit else "   OVERLOADED"
	_pack_line.text = "Pack %.1f / %.0f kg (hard limit %.0f)%s" % [weight, capacity, hard_limit, state]
	_pack_stacks = stacks
	_rebuild_pack()


func _rebuild_pack() -> void:
	for child: Node in _pack_rows.get_children():
		_pack_rows.remove_child(child)
		child.queue_free()
	if _pack_stacks.is_empty():
		_pack_rows.add_child(_label("Nothing carried.", 13, DIM))
		return
	for s: Array in _pack_stacks:
		var item_id: String = str(s[1])
		var data: ItemData = ItemDatabase.get_item(item_id)
		var quantity: int = int(s[2])
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		var text: String = (data.display_name if data else item_id)
		if quantity > 1:
			text += " ×%d" % quantity
		text += "   %.1f kg" % ((data.weight_kg if data else 0.0) * quantity)
		if _pending_items.has(item_id):
			text += "   …"
		var name_label: Label = _label(text, 13, MAIN)
		name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(name_label)
		var store_one := Button.new()
		store_one.text = "Store 1"
		store_one.disabled = _pending_items.has(item_id)
		store_one.pressed.connect(func() -> void: store_requested.emit(object_id, item_id, 1))
		row.add_child(store_one)
		if quantity > 1:
			var store_all := Button.new()
			store_all.text = "Store all"
			store_all.disabled = _pending_items.has(item_id)
			store_all.pressed.connect(func() -> void: store_requested.emit(object_id, item_id, quantity))
			row.add_child(store_all)
		_pack_rows.add_child(row)


func mark_pending(stack_id: int, _request_id: int) -> void:
	_pending_stacks[stack_id] = true
	_status.text = "Asking…"


func mark_pending_item(item_id: String) -> void:
	_pending_items[item_id] = true
	_status.text = "Asking…"
	_rebuild_pack()


## The answer to the last request. One request is in flight at a time from this window, so every
## pending mark is cleared; the next pack_state and container_contents redraw the rows.
func show_result(ok: bool, text: String) -> void:
	_pending_stacks.clear()
	_pending_items.clear()
	_status.text = text
	_status.add_theme_color_override("font_color", GOOD if ok else WARN)


func _clear_rows() -> void:
	for child: Node in _rows.get_children():
		_rows.remove_child(child)
		child.queue_free()


func _label(text: String, size: int, colour: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", colour)
	return l
