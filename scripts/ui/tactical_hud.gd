class_name TacticalHUD
extends CanvasLayer

var _health_bar: ColorRect
var _stamina_bar: ColorRect
var _poise_bar: ColorRect
var _status_label: Label
var _banner_label: Label
var _banner_timer: float = 0.0

func _ready() -> void:
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	var panel := PanelContainer.new()
	panel.position = Vector2(24, 24)
	panel.custom_minimum_size = Vector2(340, 130)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.09, 0.08, 0.08, 0.88)
	style.border_color = Color(0.28, 0.25, 0.22, 1.0)
	style.set_border_width_all(2)
	style.set_content_margin_all(12)
	panel.add_theme_stylebox_override("panel", style)
	root.add_child(panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 8)
	panel.add_child(vbox)

	_health_bar = _create_bar_row(vbox, "VITALITY", Color(0.64, 0.16, 0.16))
	_stamina_bar = _create_bar_row(vbox, "STAMINA", Color(0.76, 0.58, 0.22))
	_poise_bar = _create_bar_row(vbox, "POISE", Color(0.46, 0.50, 0.54))

	_status_label = Label.new()
	_status_label.text = "STATE: IDLE"
	_status_label.add_theme_font_size_override("font_size", 13)
	_status_label.add_theme_color_override("font_color", Color(0.72, 0.68, 0.62))
	vbox.add_child(_status_label)

	var help_panel := PanelContainer.new()
	help_panel.position = Vector2(24, 910)
	help_panel.add_theme_stylebox_override("panel", style)
	root.add_child(help_panel)

	var help_lbl := Label.new()
	help_lbl.text = (
		"ASHEN WILDS — MILESTONE 1-3 VERTICAL SLICE (THE BLACKFEN OUTSKIRTS)\n" +
		"[WASD] Move   [Shift] Sprint   [Mouse] Aim   [LMB] Light Slash   [Q / Shift+LMB] Heavy Cleave\n" +
		"[RMB Hold] Raise Shield   [Space] Evasive Step   [B] Bandage Bleed   [R] Respawn at Shelter\n" +
		"[1/2/3] Teleport Encounters   [Wheel] Zoom   [ [ / ] ] Brightness   [ - / = ] Shake Scale"
	)
	help_lbl.add_theme_font_size_override("font_size", 13)
	help_lbl.add_theme_color_override("font_color", Color(0.68, 0.65, 0.60))
	help_panel.add_child(help_lbl)

	_banner_label = Label.new()
	_banner_label.position = Vector2(460, 40)
	_banner_label.custom_minimum_size = Vector2(1000, 40)
	_banner_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_banner_label.add_theme_font_size_override("font_size", 18)
	_banner_label.text = ""
	root.add_child(_banner_label)

func _process(delta: float) -> void:
	if _banner_timer > 0.0:
		_banner_timer = maxf(0.0, _banner_timer - delta)
		if _banner_timer == 0.0:
			_banner_label.text = ""

func _create_bar_row(parent: VBoxContainer, title: String, fill_col: Color) -> ColorRect:
	var hbox := HBoxContainer.new()
	parent.add_child(hbox)

	var lbl := Label.new()
	lbl.text = title
	lbl.custom_minimum_size = Vector2(85, 18)
	lbl.add_theme_font_size_override("font_size", 12)
	lbl.add_theme_color_override("font_color", Color(0.66, 0.62, 0.56))
	hbox.add_child(lbl)

	var bg := ColorRect.new()
	bg.custom_minimum_size = Vector2(215, 14)
	bg.color = Color(0.16, 0.15, 0.14)
	hbox.add_child(bg)

	var fill := ColorRect.new()
	fill.size = Vector2(215, 14)
	fill.color = fill_col
	bg.add_child(fill)
	return fill

func update_stats(data: Dictionary) -> void:
	var hp_ratio: float = clampf(float(data["health"]) / float(data["max_health"]), 0.0, 1.0)
	var st_ratio: float = clampf(float(data["stamina"]) / float(data["max_stamina"]), 0.0, 1.0)
	var ps_ratio: float = clampf(float(data["poise"]) / float(data["max_poise"]), 0.0, 1.0)

	_health_bar.size.x = 215.0 * hp_ratio
	_stamina_bar.size.x = 215.0 * st_ratio
	_poise_bar.size.x = 215.0 * ps_ratio

	var flags: String = ""
	if data["exhausted"]:
		flags += "  [EXHAUSTED: REGEN DELAYED]"
	if data["bleeding"]:
		flags += "  [BLEEDING: -HP & SLOW STAMINA]"

	_status_label.text = "ACTION: %s%s" % [data["state"], flags]

func show_banner(msg: String, col: Color = Color(0.82, 0.76, 0.65)) -> void:
	_banner_label.text = msg
	_banner_label.add_theme_color_override("font_color", col)
	_banner_timer = 3.2
