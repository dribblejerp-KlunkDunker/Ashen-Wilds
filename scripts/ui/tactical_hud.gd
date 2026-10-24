class_name TacticalHUD
extends CanvasLayer

var _player: PlayerController
var _health_bar: ColorRect
var _stamina_bar: ColorRect
var _poise_bar: ColorRect
var _weight_bar: ColorRect
var _warmth_bar: ColorRect
var _food_bar: ColorRect
var _status_label: Label
var _survivor_label: Label
var _weather_label: Label
var _armor_label: Label
var _main_label: Label
var _off_label: Label
var _weight_label: Label
var _banner_label: Label
var _banner_timer: float = 0.0
var _prompt_label: Label
var _channel_panel: PanelContainer
var _channel_label: Label
var _channel_fill: ColorRect
var inventory_ui: InventoryUI
var _objectives: ActObjectives
var _objectives_label: Label
var _objectives_panel: PanelContainer
var _act_panel: PanelContainer
var _act_label: Label

const BAR_W: float = 215.0

func _ready() -> void:
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.09, 0.08, 0.08, 0.88)
	style.border_color = Color(0.28, 0.25, 0.22, 1.0)
	style.set_border_width_all(2)
	style.set_content_margin_all(12)

	var panel := PanelContainer.new()
	panel.position = Vector2(24, 24)
	panel.custom_minimum_size = Vector2(360, 130)
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_theme_stylebox_override("panel", style)
	root.add_child(panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 8)
	panel.add_child(vbox)

	_health_bar = _create_bar_row(vbox, "VITALITY", Color(0.64, 0.16, 0.16))
	_stamina_bar = _create_bar_row(vbox, "STAMINA", Color(0.76, 0.58, 0.22))
	_poise_bar = _create_bar_row(vbox, "POISE", Color(0.46, 0.50, 0.54))
	_weight_bar = _create_bar_row(vbox, "PACK", Color(0.48, 0.56, 0.40))
	_warmth_bar = _create_bar_row(vbox, "WARMTH", Color(0.86, 0.52, 0.24))
	_food_bar = _create_bar_row(vbox, "FOOD", Color(0.62, 0.52, 0.32))

	_survivor_label = _make_label("", 12, Color(0.74, 0.68, 0.54))
	_survivor_label.visible = false
	vbox.add_child(_survivor_label)
	_weather_label = _make_label("", 12, Color(0.62, 0.70, 0.76))
	vbox.add_child(_weather_label)

	_weight_label = _make_label("", 12, Color(0.66, 0.62, 0.56))
	vbox.add_child(_weight_label)
	_main_label = _make_label("", 13, Color(0.80, 0.76, 0.68))
	vbox.add_child(_main_label)
	_off_label = _make_label("", 13, Color(0.80, 0.76, 0.68))
	vbox.add_child(_off_label)
	_armor_label = _make_label("", 12, Color(0.70, 0.72, 0.74))
	vbox.add_child(_armor_label)

	_status_label = _make_label("STATE: IDLE", 13, Color(0.72, 0.68, 0.62))
	vbox.add_child(_status_label)

	var help_panel := PanelContainer.new()
	help_panel.position = Vector2(24, 905)
	help_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	help_panel.add_theme_stylebox_override("panel", style)
	root.add_child(help_panel)

	var help_lbl := _make_label(
		"ASHEN WILDS — THE BLACKFEN OUTSKIRTS\n" +
		"[WASD] Move   [Shift] Sprint   [Mouse] Aim   [LMB] Light   [Q / Shift+LMB] Heavy   [RMB Hold] Shield   [Space] Step / Let go\n" +
		"[E] Search / Open   [Tab] Pack   [B] Bandage   [G] Throw Stone   [T] Rest · [K] Craft at Fire   [1] Blade   [2] Polearm   [3] Axe   [4] Shield ⇄ Torch   [R] Respawn\n" +
		"[F1–F3/F5–F7/F9–F11] Teleport   [F4] Next Weather   [F8] +3 Hours   [V] Vision Cone   [Wheel] Zoom   [ [ / ] ] Brightness   [ - / = ] Shake Scale",
		13, Color(0.68, 0.65, 0.60)
	)
	help_panel.add_child(help_lbl)

	_banner_label = Label.new()
	_banner_label.position = Vector2(460, 40)
	_banner_label.custom_minimum_size = Vector2(1000, 40)
	_banner_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_banner_label.add_theme_font_size_override("font_size", 18)
	_banner_label.text = ""
	root.add_child(_banner_label)

	_prompt_label = Label.new()
	_prompt_label.position = Vector2(560, 760)
	_prompt_label.custom_minimum_size = Vector2(800, 30)
	_prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_prompt_label.add_theme_font_size_override("font_size", 16)
	_prompt_label.add_theme_color_override("font_color", Color(0.86, 0.80, 0.66))
	root.add_child(_prompt_label)

	_channel_panel = PanelContainer.new()
	_channel_panel.position = Vector2(760, 800)
	_channel_panel.custom_minimum_size = Vector2(400, 0)
	_channel_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_channel_panel.add_theme_stylebox_override("panel", style)
	root.add_child(_channel_panel)
	var ch_box := VBoxContainer.new()
	ch_box.add_theme_constant_override("separation", 6)
	_channel_panel.add_child(ch_box)
	_channel_label = _make_label("", 13, Color(0.82, 0.78, 0.70))
	_channel_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ch_box.add_child(_channel_label)
	var ch_bg := ColorRect.new()
	ch_bg.custom_minimum_size = Vector2(376, 10)
	ch_bg.color = Color(0.16, 0.15, 0.14)
	ch_box.add_child(ch_bg)
	_channel_fill = ColorRect.new()
	_channel_fill.size = Vector2(0, 10)
	_channel_fill.color = Color(0.80, 0.64, 0.30)
	ch_bg.add_child(_channel_fill)
	_channel_panel.visible = false

	# Milestone 13: objectives (left, under the stats) and the act-complete card.
	_objectives_panel = PanelContainer.new()
	_objectives_panel.position = Vector2(24, 360)
	_objectives_panel.custom_minimum_size = Vector2(360, 0)
	_objectives_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_objectives_panel.add_theme_stylebox_override("panel", style)
	_objectives_panel.visible = false
	root.add_child(_objectives_panel)
	_objectives_label = _make_label("", 13, Color(0.78, 0.74, 0.64))
	_objectives_panel.add_child(_objectives_label)

	_act_panel = PanelContainer.new()
	_act_panel.position = Vector2(560, 300)
	_act_panel.custom_minimum_size = Vector2(800, 0)
	_act_panel.add_theme_stylebox_override("panel", style)
	_act_panel.visible = false
	root.add_child(_act_panel)
	_act_label = _make_label("", 17, Color(0.90, 0.82, 0.62))
	_act_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_act_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_act_label.custom_minimum_size = Vector2(760, 0)
	_act_panel.add_child(_act_label)

	inventory_ui = InventoryUI.new()
	root.add_child(inventory_ui)

func bind_player(p: PlayerController) -> void:
	_player = p
	inventory_ui.bind_player(p)
	p.stats_changed.connect(update_stats)
	p.combat_banner_message.connect(show_banner)
	p.loot_opened.connect(inventory_ui.open_loot)
	p.ui_force_close.connect(inventory_ui.close_all)

func bind_objectives(o: ActObjectives) -> void:
	_objectives = o
	_objectives_panel.visible = true
	o.objective_completed.connect(func(_id: String, title: String) -> void:
		show_banner("OBJECTIVE COMPLETE — %s" % title, Color(0.86, 0.80, 0.52))
		_refresh_objectives()
	)
	o.act_completed.connect(show_act_complete)
	_refresh_objectives()

func _refresh_objectives() -> void:
	if _objectives == null:
		return
	_objectives_label.text = "%s\n%s" % [_objectives.act_title, "\n".join(_objectives.summary_lines())]

func is_act_panel_open() -> bool:
	return _act_panel.visible

func show_act_complete() -> void:
	var t: int = int(_objectives.elapsed) if _objectives else 0
	var who: String = _player.background.display_name if _player and _player.background else "The survivor"
	_act_label.text = "ACT I COMPLETE\n\nThe watchhouse is yours, the shelter has a pot to boil and wood to burn, and the Old Causeway is open.\n%s will see the spring... perhaps.\n\nTime in the Wilds: %d:%02d   ·   Objectives: %d / %d\n\n[Enter] Keep exploring" % [
		who, t / 60, t % 60, _objectives.done_count() if _objectives else 0, _objectives.objectives.size() if _objectives else 0
	]
	_act_panel.visible = true
	if _player:
		_player.set_ui_capture(true)

func close_act_complete() -> void:
	if not _act_panel.visible:
		return
	_act_panel.visible = false
	if _player:
		_player.set_ui_capture(inventory_ui.is_any_open())

func _unhandled_input(event: InputEvent) -> void:
	if _act_panel.visible and event is InputEventKey and event.pressed and (event as InputEventKey).keycode in [KEY_ENTER, KEY_KP_ENTER, KEY_ESCAPE]:
		close_act_complete()
		get_viewport().set_input_as_handled()

func _process(delta: float) -> void:
	if _objectives and Engine.get_process_frames() % 30 == 0:
		_refresh_objectives()
	if _banner_timer > 0.0:
		_banner_timer = maxf(0.0, _banner_timer - delta)
		if _banner_timer == 0.0:
			_banner_label.text = ""

func _make_label(text: String, font_size: int, color: Color) -> Label:
	var lbl := Label.new()
	lbl.text = text
	lbl.add_theme_font_size_override("font_size", font_size)
	lbl.add_theme_color_override("font_color", color)
	return lbl

func _create_bar_row(parent: VBoxContainer, title: String, fill_col: Color) -> ColorRect:
	var hbox := HBoxContainer.new()
	parent.add_child(hbox)

	var lbl := _make_label(title, 12, Color(0.66, 0.62, 0.56))
	lbl.custom_minimum_size = Vector2(85, 18)
	hbox.add_child(lbl)

	var bg := ColorRect.new()
	bg.custom_minimum_size = Vector2(BAR_W, 14)
	bg.color = Color(0.16, 0.15, 0.14)
	hbox.add_child(bg)

	var fill := ColorRect.new()
	fill.size = Vector2(BAR_W, 14)
	fill.color = fill_col
	bg.add_child(fill)
	return fill

func update_stats(data: Dictionary) -> void:
	var hp_ratio: float = clampf(float(data["health"]) / float(data["max_health"]), 0.0, 1.0)
	var st_ratio: float = clampf(float(data["stamina"]) / float(data["max_stamina"]), 0.0, 1.0)
	var ps_ratio: float = clampf(float(data["poise"]) / float(data["max_poise"]), 0.0, 1.0)

	_health_bar.size.x = BAR_W * hp_ratio
	_stamina_bar.size.x = BAR_W * st_ratio
	_poise_bar.size.x = BAR_W * ps_ratio

	var weight: float = float(data["weight"])
	var capacity: float = float(data["capacity"])
	_weight_bar.size.x = BAR_W * clampf(weight / capacity, 0.0, 1.0)
	match String(data["load"]):
		"BURDENED":
			_weight_bar.color = Color(0.80, 0.62, 0.26)
		"OVERBURDENED":
			_weight_bar.color = Color(0.84, 0.30, 0.20)
		_:
			_weight_bar.color = Color(0.48, 0.56, 0.40)
	_weight_label.text = "%.1f / %.1f kg  ·  %s  ·  Bandages ×%d" % [
		weight, capacity, String(data["load"]).capitalize(), int(data["bandages"])
	]

	var bg_name: String = String(data.get("background", ""))
	_survivor_label.visible = bg_name != ""
	if _survivor_label.visible and _player and _player.background:
		_survivor_label.text = "%s  ·  %s  ·  %s" % [bg_name.to_upper(), _player.background.trait_name, _player.background.flaw_name]

	var weather: WeatherSystem = WeatherSystem.find(_player) if _player else null
	_weather_label.visible = weather != null
	if weather:
		var sheltered: bool = weather.is_sheltered(_player.global_position)
		_weather_label.text = "WEATHER  %s%s" % [weather.get_display_name(), "  ·  sheltered" if sheltered else ""]
		var dn: DayNightCycle = DayNightCycle.find(_player)
		if dn:
			_weather_label.text += "     %s  %s" % [dn.get_phase_name().to_upper(), dn.clock_text()]

	_main_label.text = "MAIN  %s" % data["main_label"]
	_main_label.add_theme_color_override(
		"font_color", Color(0.90, 0.46, 0.28) if data["main_broken"] else Color(0.80, 0.76, 0.68)
	)
	var off_text: String = "OFF   %s" % data["off_label"]
	if not data["off_active"] and String(data["off_label"]) != "— empty —":
		off_text += "  [stowed]"
	_off_label.text = off_text
	var prot: float = float(data.get("armor", 0.0))
	_armor_label.text = "ARMOR %d%%  %s" % [int(round(prot * 100.0)), String(data.get("armor_label", ""))]

	var flags: String = ""
	if data["exhausted"]:
		flags += "  [EXHAUSTED: REGEN DELAYED]"
	if data["bleeding"]:
		flags += "  [BLEEDING: -HP & SLOW STAMINA]"
	if data.get("cramped", false):
		flags += "  [CRAMPED: SWEEPS WILL CLANG]"
	if data.get("lodged", false):
		flags += "  [LODGED: SPACE TO LET GO]"
	if data.has("warmth"):
		_warmth_bar.size.x = BAR_W * clampf(float(data["warmth"]) / float(data["max_warmth"]), 0.0, 1.0)
		_warmth_bar.color = Color(0.40, 0.60, 0.86) if data["freezing"] else (Color(0.62, 0.66, 0.78) if data["chilled"] else Color(0.86, 0.52, 0.24))
		_food_bar.size.x = BAR_W * clampf(float(data["satiety"]) / float(data["max_satiety"]), 0.0, 1.0)
		_food_bar.color = Color(0.84, 0.30, 0.20) if data["starving"] else (Color(0.80, 0.62, 0.26) if data["hungry"] else Color(0.62, 0.52, 0.32))
	if data.get("freezing", false):
		flags += "  [FREEZING: GET TO A FIRE]"
	elif data.get("chilled", false):
		flags += "  [CHILLED]"
	if data.get("starving", false):
		flags += "  [STARVING]"
	elif data.get("hungry", false):
		flags += "  [HUNGRY]"
	if data.get("spore_sick", false):
		flags += "  [SPORE-SICK: SLOW STAMINA, COUGHING]"
	if data.get("coughing", false):
		flags += "  [COUGHING: HEARD NEARBY]"
	_status_label.text = "ACTION: %s%s" % [data["state"], flags]

	_prompt_label.text = String(data["prompt"])

	var ch_label: String = String(data["channel_label"])
	_channel_panel.visible = ch_label != ""
	if _channel_panel.visible:
		_channel_label.text = ch_label
		_channel_fill.size.x = 376.0 * float(data["channel_progress"])

func show_banner(msg: String, col: Color = Color(0.82, 0.76, 0.65)) -> void:
	_banner_label.text = msg
	_banner_label.add_theme_color_override("font_color", col)
	_banner_timer = 3.2
