class_name InventoryUI
extends Control
## Pack window (Tab) and loot window (opens when a search completes).
## The world keeps running while these are open — survival tension — but
## the player's combat inputs are suspended and any hit closes them.

const PANEL_BG := Color(0.09, 0.08, 0.08, 0.94)
const PANEL_BORDER := Color(0.30, 0.26, 0.22, 1.0)
const TEXT_DIM := Color(0.66, 0.62, 0.56)
const TEXT_MAIN := Color(0.82, 0.78, 0.70)
const TEXT_WARN := Color(0.90, 0.46, 0.28)

var _player: PlayerController
var _inv_panel: PanelContainer
var _inv_weight: Label
var _inv_list: VBoxContainer
var _loot_panel: PanelContainer
var _loot_title: Label
var _loot_list: VBoxContainer
var _loot_target: Lootable = null

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE

	_inv_panel = _make_panel(Vector2(1430, 110), 460)
	var inv_box: VBoxContainer = _inv_panel.get_child(0)
	inv_box.add_child(_make_label("SURVIVOR'S PACK   [Tab] close", 15, TEXT_MAIN))
	_inv_weight = _make_label("", 13, TEXT_DIM)
	inv_box.add_child(_inv_weight)
	_inv_list = _make_scroll_list(inv_box, 520)
	add_child(_inv_panel)

	_loot_panel = _make_panel(Vector2(950, 110), 460)
	var loot_box: VBoxContainer = _loot_panel.get_child(0)
	_loot_title = _make_label("", 15, TEXT_MAIN)
	loot_box.add_child(_loot_title)
	_loot_list = _make_scroll_list(loot_box, 360)
	var loot_buttons := HBoxContainer.new()
	loot_buttons.add_theme_constant_override("separation", 8)
	loot_box.add_child(loot_buttons)
	_add_button(loot_buttons, "Take All", _take_all)
	_add_button(loot_buttons, "Close [Esc]", close_loot)
	add_child(_loot_panel)

	_inv_panel.visible = false
	_loot_panel.visible = false

func bind_player(p: PlayerController) -> void:
	_player = p
	_player.inventory_changed.connect(_on_inventory_changed)

func is_any_open() -> bool:
	return _inv_panel.visible or _loot_panel.visible

func is_inventory_open() -> bool:
	return _inv_panel.visible

func is_loot_open() -> bool:
	return _loot_panel.visible

func get_loot_target() -> Lootable:
	return _loot_target

func toggle_inventory() -> void:
	if _inv_panel.visible:
		_inv_panel.visible = false
		if _loot_panel.visible:
			close_loot()
	else:
		_inv_panel.visible = true
		_rebuild_inventory()
	_sync_capture()

func open_loot(target: Lootable) -> void:
	if target == null or not is_instance_valid(target):
		return
	if _loot_target != null and is_instance_valid(_loot_target) and _loot_target.contents_changed.is_connected(_rebuild_loot):
		_loot_target.contents_changed.disconnect(_rebuild_loot)
	_loot_target = target
	_loot_target.contents_changed.connect(_rebuild_loot)
	_loot_panel.visible = true
	_inv_panel.visible = true
	_rebuild_loot()
	_rebuild_inventory()
	_sync_capture()

func close_loot() -> void:
	if _loot_target != null and is_instance_valid(_loot_target) and _loot_target.contents_changed.is_connected(_rebuild_loot):
		_loot_target.contents_changed.disconnect(_rebuild_loot)
	_loot_target = null
	_loot_panel.visible = false
	_sync_capture()

func close_all() -> void:
	if not is_any_open():
		return
	close_loot()
	_inv_panel.visible = false
	_sync_capture()

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("inventory"):
		toggle_inventory()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_cancel") and is_any_open():
		close_all()
		get_viewport().set_input_as_handled()

func _process(_delta: float) -> void:
	if not _loot_panel.visible or _player == null:
		return
	if _loot_target == null or not is_instance_valid(_loot_target) or _loot_target.is_queued_for_deletion():
		close_loot()
		return
	var d: float = Vector2(
		_loot_target.global_position.x - _player.global_position.x,
		_loot_target.global_position.z - _player.global_position.z
	).length()
	if d > _loot_target.interact_radius + 0.8:
		close_loot()

func _sync_capture() -> void:
	if _player:
		_player.set_ui_capture(is_any_open())

func _on_inventory_changed() -> void:
	if _inv_panel.visible:
		_rebuild_inventory()

# ------------------------------------------------------------------------------
# Rebuild
# ------------------------------------------------------------------------------
func _rebuild_inventory() -> void:
	if _player == null:
		return
	_clear(_inv_list)
	var inv: Inventory = _player.inventory
	var load_name: String = Inventory.Load.keys()[inv.get_load()]
	_inv_weight.text = "Load %.1f / %.1f kg  (%s)   ·   hard limit %.1f kg" % [
		inv.total_weight(), inv.capacity_kg, load_name, inv.hard_limit_kg()
	]
	_inv_weight.add_theme_color_override(
		"font_color", TEXT_WARN if inv.get_load() != Inventory.Load.NORMAL else TEXT_DIM
	)
	if inv.items.is_empty():
		_inv_list.add_child(_make_label("Your pack is empty.", 13, TEXT_DIM))
		return
	for inst: ItemInstance in inv.items:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 6)
		var prefix: String = ""
		if inst == inv.main_hand:
			prefix = "[MAIN] "
		elif inst == inv.off_hand:
			prefix = "[OFF] " if _player._offhand_active() else "[OFF·stowed] "
		var name_lbl := _make_label(prefix + inst.get_label(), 13, TEXT_WARN if inst.is_broken() else TEXT_MAIN)
		name_lbl.custom_minimum_size = Vector2(250, 0)
		name_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		name_lbl.clip_text = true
		name_lbl.tooltip_text = inst.data.description
		name_lbl.mouse_filter = Control.MOUSE_FILTER_PASS
		row.add_child(name_lbl)
		var w_lbl := _make_label("%.1f kg" % inst.total_weight(), 12, TEXT_DIM)
		w_lbl.custom_minimum_size = Vector2(52, 0)
		row.add_child(w_lbl)
		if inst.data.is_equippable():
			_add_button(row, "Unequip" if inv.is_equipped(inst) else "Equip", func() -> void: _player.request_equip(inst))
		elif inst.data.category == ItemData.Category.CONSUMABLE:
			_add_button(row, "Use", func() -> void: _player.use_item(inst))
		_add_button(row, "Drop", func() -> void: _player.drop_item(inst))
		_inv_list.add_child(row)

func _rebuild_loot() -> void:
	if _loot_target == null or not is_instance_valid(_loot_target):
		return
	_clear(_loot_list)
	_loot_title.text = "%s   (%.1f kg)" % [_loot_target.display_name.to_upper(), _loot_target.total_weight()]
	if _loot_target.items.is_empty():
		_loot_list.add_child(_make_label("Nothing left worth taking.", 13, TEXT_DIM))
		return
	for inst: ItemInstance in _loot_target.items:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 6)
		var name_lbl := _make_label(inst.get_label(), 13, TEXT_MAIN)
		name_lbl.custom_minimum_size = Vector2(280, 0)
		name_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		name_lbl.clip_text = true
		name_lbl.tooltip_text = inst.data.description
		name_lbl.mouse_filter = Control.MOUSE_FILTER_PASS
		row.add_child(name_lbl)
		var w_lbl := _make_label("%.1f kg" % inst.total_weight(), 12, TEXT_DIM)
		w_lbl.custom_minimum_size = Vector2(52, 0)
		row.add_child(w_lbl)
		var target: Lootable = _loot_target
		_add_button(row, "Take", func() -> void: _player.take_from(target, inst))
		_loot_list.add_child(row)

func _take_all() -> void:
	if _loot_target == null or not is_instance_valid(_loot_target) or _player == null:
		return
	var target: Lootable = _loot_target
	for inst: ItemInstance in target.items.duplicate():
		if not is_instance_valid(target):
			break
		_player.take_from(target, inst)

# ------------------------------------------------------------------------------
# Widgets
# ------------------------------------------------------------------------------
func _make_panel(pos: Vector2, width: float) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.position = pos
	panel.custom_minimum_size = Vector2(width, 0)
	panel.mouse_filter = Control.MOUSE_FILTER_STOP
	var style := StyleBoxFlat.new()
	style.bg_color = PANEL_BG
	style.border_color = PANEL_BORDER
	style.set_border_width_all(2)
	style.set_content_margin_all(12)
	panel.add_theme_stylebox_override("panel", style)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	panel.add_child(box)
	return panel

func _make_scroll_list(parent: VBoxContainer, height: float) -> VBoxContainer:
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(0, height)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	parent.add_child(scroll)
	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("separation", 4)
	scroll.add_child(list)
	return list

func _make_label(text: String, font_size: int, color: Color) -> Label:
	var lbl := Label.new()
	lbl.text = text
	lbl.add_theme_font_size_override("font_size", font_size)
	lbl.add_theme_color_override("font_color", color)
	return lbl

func _add_button(parent: Control, text: String, callback: Callable) -> Button:
	var b := Button.new()
	b.text = text
	# No keyboard focus: Space/Enter must stay dodge/etc., not "press button".
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", 12)
	b.pressed.connect(callback)
	parent.add_child(b)
	return b

func _clear(container: Node) -> void:
	for c: Node in container.get_children():
		container.remove_child(c)
		c.queue_free()
