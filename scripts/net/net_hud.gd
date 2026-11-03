class_name NetHud
extends CanvasLayer
## Development HUD for the networked courtyard (appendix §55): build, role, connection state,
## identity, ping, camera view, the last rejection, and the prediction correction size.
## Clients only; the server never instantiates it (§70).

var _label: Label
var _message: Label


func _ready() -> void:
	layer = 10
	_label = Label.new()
	_label.position = Vector2(12.0, 10.0)
	_label.add_theme_font_size_override("font_size", 13)
	_label.add_theme_color_override("font_color", Color(0.86, 0.82, 0.7))
	add_child(_label)
	_message = Label.new()
	_message.anchors_preset = Control.PRESET_CENTER_BOTTOM
	_message.position = Vector2(-300.0, -80.0)
	_message.size = Vector2(600.0, 40.0)
	_message.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_message.add_theme_font_size_override("font_size", 16)
	_message.add_theme_color_override("font_color", Color(0.95, 0.75, 0.55))
	add_child(_message)


func set_lines(lines: PackedStringArray) -> void:
	_label.text = "\n".join(lines)


func set_message(text: String) -> void:
	_message.text = text
