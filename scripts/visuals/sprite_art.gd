class_name SpriteArt
extends RefCounted
## Interim painted art, cut from the owner's reference sheets by
## tools/slice_sheets.py (see assets/art_map.json). `dress()` swaps a class's
## primitive placeholder meshes for a torch-lit painted billboard; `icon()`
## gives an item's inventory icon. Everything degrades to the old placeholders
## when a file is missing, so gameplay never depends on art being present.

const SPRITE_DIR := "res://assets/game/sprites/"
const ICON_DIR := "res://assets/game/icons/"
const TEXTURE_DIR := "res://assets/game/textures/"
const ART_MAP := "res://assets/art_map.json"

static var _map: Dictionary = {}
static var _icons: Dictionary = {}

static func _art_map() -> Dictionary:
	if _map.is_empty() and FileAccess.file_exists(ART_MAP):
		var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(ART_MAP))
		if parsed is Dictionary:
			_map = parsed
	return _map

static func has_sprite(key: String) -> bool:
	return ResourceLoader.exists(SPRITE_DIR + key + ".png")

## The item's painted icon, or null.
static func icon(item_id: String) -> Texture2D:
	if not _icons.has(item_id):
		var path: String = ICON_DIR + item_id + ".png"
		_icons[item_id] = load(path) if ResourceLoader.exists(path) else null
	return _icons[item_id]

## Puts the painted billboard for `key` on `visual_root` (feet at its origin)
## and hides the primitive meshes under it. Unshaded meshes are kept: they're
## the gameplay markers (status rings, telegraph decals, eye glows), and so is
## anything under a node in `keep` (the survivor's weapon and torch). Returns
## the sprite, or null when there's no art for `key` (the placeholders stay).
static func dress(visual_root: Node3D, key: String, keep: Array[Node] = [], height_override: float = -1.0) -> FacingSprite:
	if not has_sprite(key):
		return null
	var tex: Texture2D = load(SPRITE_DIR + key + ".png")
	var spec: Dictionary = (_art_map().get("sprites", {}) as Dictionary).get(key, {})
	var height: float = height_override if height_override > 0.0 else float(spec.get("height", 1.8))
	for c: Node in visual_root.find_children("*", "MeshInstance3D", true, false):
		if _is_marker(c as MeshInstance3D) or keep.any(func(k: Node) -> bool: return k == c or k.is_ancestor_of(c)):
			continue
		(c as MeshInstance3D).visible = false
	var s := make_sprite(tex, height)
	visual_root.add_child(s)
	return s

## A painted billboard for a prop (no meshes hidden). Null without art.
static func prop(key: String) -> FacingSprite:
	if not has_sprite(key):
		return null
	var spec: Dictionary = (_art_map().get("sprites", {}) as Dictionary).get(key, {})
	return make_sprite(load(SPRITE_DIR + key + ".png"), float(spec.get("height", 1.0)))

static func make_sprite(tex: Texture2D, height: float) -> FacingSprite:
	var s := FacingSprite.new()
	s.name = "PaintedSprite"
	s.texture = tex
	s.billboard = BaseMaterial3D.BILLBOARD_FIXED_Y
	s.shaded = true
	s.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
	s.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	s.pixel_size = height / float(tex.get_height())
	s.offset = Vector2(0.0, tex.get_height() * 0.5) # feet on the ground
	s.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	return s

## Paints a cutaway-shader surface with a tiling texture ("stone", "wood",
## "ground"). Returns false (and leaves the flat colour) without art.
static func paint_surface(mat: ShaderMaterial, key: String) -> bool:
	var path: String = TEXTURE_DIR + key + ".png"
	if not ResourceLoader.exists(path):
		return false
	var spec: Dictionary = (_art_map().get("textures", {}) as Dictionary).get(key, {})
	mat.set_shader_parameter("use_texture", true)
	mat.set_shader_parameter("albedo_tex", load(path))
	mat.set_shader_parameter("tex_metres", float(spec.get("metres", 1.5)))
	return true

static func _is_marker(m: MeshInstance3D) -> bool:
	var mat := m.material_override as StandardMaterial3D
	return mat != null and mat.shading_mode == BaseMaterial3D.SHADING_MODE_UNSHADED
