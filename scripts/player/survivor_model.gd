class_name SurvivorModel
extends Node3D
## The survivor's look: a rigged, animated character (Quaternius Modular Character Outfits, the
## Ranger, CC0: see art/quaternius/) driven by PlayerController. Presentation only. Nothing in the
## simulation reads from here (collision, hitboxes and aim stay on the controller), so the mesh can
## be swapped for the team's own character on the same humanoid rig without touching gameplay
## (decision P15; it already replaced a KayKit stand-in the owner judged too cartoonish).
##
## Animations come from Quaternius's Universal Animation Libraries 1 and 2, made on the same
## 65-bone humanoid skeleton, so they are merged into one AnimationPlayer on the character. Items in
## the hands hang off two sockets that follow the hand bones.

const CHARACTER_SCENE: String = "res://art/quaternius/survivor/Male_Ranger.gltf"
## The Ranger's textures recoloured for the Blackfen: dark, dirty oilcloth and dull leather, paler
## skin (tools/recolor_survivor_texture.py).
const OUTFIT_TEXTURE: String = "res://art/quaternius/survivor/survivor_outfit_basecolor.png"
const SKIN_TEXTURE: String = "res://art/quaternius/survivor/survivor_skin_basecolor.png"
const ANIMATION_SOURCES: Array[String] = [
	"res://art/quaternius/animations/UAL1_Standard.glb",
	"res://art/quaternius/animations/UAL2_Standard.glb",
]
## Animations that repeat until something else is played. (Godot's importer strips a "_Loop" suffix
## from clip names and loops those clips itself; the rest are listed here.)
const LOOPING: Array[StringName] = [
	&"Idle", &"Sword_Idle", &"Idle_Torch", &"Idle_Shield", &"Walk",
	&"Jog_Fwd", &"Sprint", &"Crouch_Idle", &"Fixing_Kneeling", &"Consume", &"Push",
]
## The Ranger is 1.87 m to the top of the hood; the survivor's capsule is 1.75 m.
const MODEL_SCALE: float = 0.95
const DEFAULT_BLEND: float = 0.12
const RIGHT_HAND_BONE: String = "hand_r"
const LEFT_HAND_BONE: String = "hand_l"
## How an item sits in a fist. On both hand bones +Y runs along the fingers and -Z out of the
## thumb side of the fist, which is where a held blade points, so the sockets need no turn; they
## only move from the wrist into the palm (+Y along the fingers, X towards the palm). Found by
## rendering axis markers on the bones.
const RIGHT_GRIP_ROTATION: Vector3 = Vector3.ZERO
const LEFT_GRIP_ROTATION: Vector3 = Vector3.ZERO
const RIGHT_GRIP_OFFSET: Vector3 = Vector3(0.03, 0.08, 0.0)
const LEFT_GRIP_OFFSET: Vector3 = Vector3(-0.03, 0.08, 0.0)
## A shield faces out of the back of the left hand (+X on that bone), strapped over the fist.
const SHIELD_MOUNT_ROTATION: Vector3 = Vector3(0.0, 0.0, 90.0)
const SHIELD_MOUNT_OFFSET: Vector3 = Vector3(0.07, -0.02, 0.0)

var anim: AnimationPlayer
## Where the main-hand item goes. Its -Z axis points out of the fist along the blade.
var right_socket: Node3D
## Where the shield or torch goes. Its -Z axis points out of the fist.
var left_socket: Node3D
## Where a shield goes: on the back of the left hand. Its local Y axis is the shield's face normal.
var shield_mount: Node3D
## Items that stay upright whatever the hand does (a torch flame points up, not at the floor).
var upright: Array[Node3D] = []

var _character: Node3D
var _current: StringName = &""

static var _library: AnimationLibrary


func _init() -> void:
	name = "SurvivorModel"
	_character = (load(CHARACTER_SCENE) as PackedScene).instantiate() as Node3D
	_character.scale = Vector3.ONE * MODEL_SCALE
	# Quaternius's glTF characters face +Z (their toes point +Z); the game aims down -Z. Without
	# this turn the survivor ran and swung backwards (shipped that way in LF-1b; caught in LF-4).
	_character.rotation.y = PI
	add_child(_character)
	_apply_textures()

	anim = AnimationPlayer.new()
	anim.name = "AnimationPlayer"
	_character.add_child(anim)
	anim.add_animation_library(&"", shared_library())

	var skeleton: Skeleton3D = _character.find_child("Skeleton3D", true, false) as Skeleton3D
	right_socket = _make_socket(skeleton, RIGHT_HAND_BONE, RIGHT_GRIP_ROTATION, RIGHT_GRIP_OFFSET)
	left_socket = _make_socket(skeleton, LEFT_HAND_BONE, LEFT_GRIP_ROTATION, LEFT_GRIP_OFFSET)
	shield_mount = Node3D.new()
	shield_mount.name = "ShieldMount"
	shield_mount.rotation_degrees = SHIELD_MOUNT_ROTATION
	shield_mount.position = SHIELD_MOUNT_OFFSET
	left_socket.add_child(shield_mount)
	play(&"Idle", 1.0, 0.0)
	# After the animation and the hand sockets have moved this frame.
	process_priority = 100


func _process(_delta: float) -> void:
	for n: Node3D in upright:
		if n.is_inside_tree() and n.visible:
			# Upright, leaning slightly forward, at real size.
			n.global_basis = global_basis.orthonormalized() * Basis(Vector3.RIGHT, deg_to_rad(-18.0))


## All animations from both libraries in one library, built once and shared by every survivor.
static func shared_library() -> AnimationLibrary:
	if _library != null:
		return _library
	_library = AnimationLibrary.new()
	for path: String in ANIMATION_SOURCES:
		var source: Node = (load(path) as PackedScene).instantiate()
		var player: AnimationPlayer = source.find_child("AnimationPlayer", true, false) as AnimationPlayer
		if player != null:
			for anim_name: StringName in player.get_animation_list():
				if anim_name == &"A_TPose" or _library.has_animation(anim_name):
					continue
				var a: Animation = player.get_animation(anim_name)
				a.loop_mode = Animation.LOOP_LINEAR if anim_name in LOOPING else Animation.LOOP_NONE
				_library.add_animation(anim_name, a)
		source.free()
	return _library


## The outfit and the skin each get their recoloured base colour; normal and ORM maps stay.
func _apply_textures() -> void:
	var outfit: Texture2D = load(OUTFIT_TEXTURE) as Texture2D
	var skin: Texture2D = load(SKIN_TEXTURE) as Texture2D
	for node: Node in _character.find_children("*", "MeshInstance3D", true, false):
		var mi := node as MeshInstance3D
		for i: int in range(mi.mesh.get_surface_count()):
			var base := mi.mesh.surface_get_material(i) as StandardMaterial3D
			if base == null:
				continue
			var mat := base.duplicate() as StandardMaterial3D
			mat.albedo_texture = skin if base.resource_name.contains("Regular") else outfit
			mi.set_surface_override_material(i, mat)


func _make_socket(skeleton: Skeleton3D, bone: String, grip_rotation: Vector3, grip_offset: Vector3) -> Node3D:
	var attach := BoneAttachment3D.new()
	attach.name = "Attach_" + bone
	attach.bone_name = bone
	skeleton.add_child(attach)
	var socket := Node3D.new()
	socket.name = "Socket"
	# Undo the model's scale so items keep their real sizes.
	socket.scale = Vector3.ONE / MODEL_SCALE
	socket.rotation_degrees = grip_rotation
	socket.position = grip_offset
	attach.add_child(socket)
	return socket


func has_animation(anim_name: StringName) -> bool:
	return anim.has_animation(anim_name)


## Plays `anim_name` unless it is already playing; `restart` replays it from the start.
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


## Plays a one-shot animation stretched or squeezed to last `duration` seconds.
func play_fitted(anim_name: StringName, duration: float, blend: float = DEFAULT_BLEND, restart: bool = true) -> void:
	if not anim.has_animation(anim_name):
		return
	var length: float = anim.get_animation(anim_name).length
	play(anim_name, clampf(length / maxf(duration, 0.05), 0.25, 4.0), blend, restart)


func current_animation() -> StringName:
	return _current
