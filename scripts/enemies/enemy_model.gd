class_name EnemyModel
extends Node3D
## An Ashbound enemy's look: Quaternius's Peasant outfit (CC0, art/quaternius/ashbound/) worn as
## filthy rags over grey skin, under the Ranger's hood (the free Peasant outfit has no head, and the
## base characters have no separate one: faceless sackcloth hoods it is), tinted and scaled per type, animated by the same humanoid clip
## library as the survivor (SurvivorModel.shared_library()). Presentation only, like the survivor:
## each enemy's collision, hitbox, hurtbox, AI and timings are untouched, so a better creature mesh on
## the same rig can replace this later without changing play.

const CHARACTER_SCENE: String = "res://art/quaternius/ashbound/Male_Peasant.gltf"
const RAGS_TEXTURE: String = "res://art/quaternius/ashbound/ashbound_rags_basecolor.png"
const SKIN_TEXTURE: String = "res://art/quaternius/ashbound/ashbound_skin_basecolor.png"
## The hood comes off the survivor's Ranger outfit (same skeleton), darker than the survivor's.
const HOOD_SOURCE: String = "res://art/quaternius/survivor/Male_Ranger.gltf"
const HOOD_MESH: String = "Male_Ranger_Head_Hood"
const HOOD_TINT: Color = Color(0.55, 0.52, 0.5)
## The Peasant stands 1.80 m; each type is scaled to its collision capsule.
const BASE_HEIGHT: float = 1.80
const DEFAULT_BLEND: float = 0.15

## [height m, breadth multiplier, skin tint, rags tint] per enemy type.
const TYPES: Dictionary = {
	"goblin": [1.35, 1.0, Color(0.62, 0.74, 0.52), Color(0.9, 0.9, 0.85)],
	"ork": [1.92, 1.18, Color(0.52, 0.60, 0.44), Color(0.8, 0.78, 0.74)],
	"ogre": [2.95, 1.45, Color(0.74, 0.72, 0.68), Color(0.7, 0.68, 0.64)],
	# The Blind Quarry-Troll: huge, stooped breadth, skin the blue-grey of quarry dust.
	"troll": [2.6, 1.55, Color(0.62, 0.66, 0.70), Color(0.62, 0.60, 0.56)],
	# An Ash-Spore Husk: a gaunt corpse, skin gone the grey-green of the spores in it.
	"husk": [1.78, 0.9, Color(0.66, 0.70, 0.58), Color(0.55, 0.52, 0.48)],
	# A human in plain clothes (the companion): warm skin, undyed cloth, the hood like everyone's.
	"companion": [1.72, 1.0, Color(0.96, 0.84, 0.74), Color(0.84, 0.80, 0.72)],
}

var anim: AnimationPlayer
var right_socket: Node3D
var left_socket: Node3D
## The back of the left hand, for a shield (its local Y is the shield's face normal).
var shield_mount: Node3D
var _character: Node3D
var _current: StringName = &""
var _scale: float = 1.0


func _init(kind: String = "goblin") -> void:
	name = "EnemyModel"
	var spec: Array = TYPES[kind]
	_scale = float(spec[0]) / BASE_HEIGHT
	_character = (load(CHARACTER_SCENE) as PackedScene).instantiate() as Node3D
	_character.scale = Vector3(_scale * float(spec[1]), _scale, _scale * float(spec[1]))
	# Quaternius's glTF characters face +Z; enemies aim down -Z like the survivor.
	_character.rotation.y = PI
	add_child(_character)
	_apply_textures(spec[2], spec[3])
	_add_hood()
	anim = AnimationPlayer.new()
	anim.name = "AnimationPlayer"
	# Animates even while its enemy is frozen (tests, posed screenshots): presentation only.
	anim.process_mode = Node.PROCESS_MODE_ALWAYS
	_character.add_child(anim)
	anim.add_animation_library(&"", SurvivorModel.shared_library())
	var skeleton := _character.find_child("Skeleton3D", true, false) as Skeleton3D
	right_socket = _make_socket(skeleton, SurvivorModel.RIGHT_HAND_BONE, SurvivorModel.RIGHT_GRIP_OFFSET)
	left_socket = _make_socket(skeleton, SurvivorModel.LEFT_HAND_BONE, SurvivorModel.LEFT_GRIP_OFFSET)
	shield_mount = Node3D.new()
	shield_mount.name = "ShieldMount"
	shield_mount.rotation_degrees = SurvivorModel.SHIELD_MOUNT_ROTATION
	shield_mount.position = SurvivorModel.SHIELD_MOUNT_OFFSET
	left_socket.add_child(shield_mount)
	play(&"Idle", 1.0, 0.0)


func _apply_textures(skin_tint: Color, rags_tint: Color) -> void:
	var rags: Texture2D = load(RAGS_TEXTURE) as Texture2D
	var skin: Texture2D = load(SKIN_TEXTURE) as Texture2D
	for node: Node in _character.find_children("*", "MeshInstance3D", true, false):
		var mi := node as MeshInstance3D
		for i: int in range(mi.mesh.get_surface_count()):
			var base := mi.mesh.surface_get_material(i) as StandardMaterial3D
			if base == null:
				continue
			var mat := base.duplicate() as StandardMaterial3D
			var is_skin: bool = base.resource_name.contains("Regular")
			mat.albedo_texture = skin if is_skin else rags
			mat.albedo_color = skin_tint if is_skin else rags_tint
			mi.set_surface_override_material(i, mat)


## Moves a copy of the Ranger's hood onto this body's skeleton (they share bones and rest pose).
func _add_hood() -> void:
	var source := (load(HOOD_SOURCE) as PackedScene).instantiate()
	var hood := source.find_child(HOOD_MESH, true, false) as MeshInstance3D
	var skeleton := _character.find_child("Skeleton3D", true, false) as Skeleton3D
	if hood != null and skeleton != null:
		var copy := MeshInstance3D.new()
		copy.name = "Hood"
		copy.mesh = hood.mesh
		copy.skin = hood.skin
		copy.transform = hood.transform
		skeleton.add_child(copy)
		copy.skeleton = NodePath("..")
		var base := hood.mesh.surface_get_material(0) as StandardMaterial3D
		if base != null:
			var mat := base.duplicate() as StandardMaterial3D
			mat.albedo_texture = load(SurvivorModel.OUTFIT_TEXTURE) as Texture2D
			mat.albedo_color = HOOD_TINT
			copy.set_surface_override_material(0, mat)
	source.free()


func _make_socket(skeleton: Skeleton3D, bone: String, offset: Vector3) -> Node3D:
	var attach := BoneAttachment3D.new()
	attach.name = "Attach_" + bone
	attach.bone_name = bone
	skeleton.add_child(attach)
	var socket := Node3D.new()
	socket.name = "Socket"
	# Undo the body's scale so held items keep the sizes the enemy scripts give them.
	socket.scale = Vector3.ONE / _character.scale
	socket.position = offset
	attach.add_child(socket)
	return socket


func has_animation(anim_name: StringName) -> bool:
	return anim.has_animation(anim_name)


func current_animation() -> StringName:
	return _current


## Plays `anim_name` unless it is already playing; `restart` replays it.
func play(anim_name: StringName, speed: float = 1.0, blend: float = DEFAULT_BLEND, restart: bool = false) -> void:
	if not anim.has_animation(anim_name):
		return
	if anim_name == _current and not restart:
		anim.speed_scale = speed
		return
	if restart and anim_name == _current:
		anim.stop(true)
	_current = anim_name
	anim.speed_scale = speed
	anim.play(anim_name, blend)


## Plays an attack so the clip's blow (about 45% through it) lands as the startup timer runs out.
func play_strike(anim_name: StringName, startup_seconds: float) -> void:
	if not anim.has_animation(anim_name):
		return
	var length: float = anim.get_animation(anim_name).length
	play(anim_name, clampf(length * 0.45 / maxf(startup_seconds, 0.05), 0.3, 4.0), DEFAULT_BLEND, true)


## A one-shot stretched to last `duration` seconds.
func play_fitted(anim_name: StringName, duration: float) -> void:
	if not anim.has_animation(anim_name):
		return
	play(anim_name, clampf(anim.get_animation(anim_name).length / maxf(duration, 0.05), 0.25, 4.0), DEFAULT_BLEND, true)
