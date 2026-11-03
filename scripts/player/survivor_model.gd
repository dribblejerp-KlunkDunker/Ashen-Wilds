class_name SurvivorModel
extends Node3D
## The survivor's look: a rigged, animated character (KayKit Adventurers, CC0: see art/kaykit/)
## driven by PlayerController. Presentation only. Nothing in the simulation reads from here
## (collision, hitboxes and aim stay on the controller), so the mesh can be swapped for the
## team's own character on the same rig later without touching gameplay (decision P15).
##
## Animations come from KayKit's Rig_Medium libraries, which share the character's skeleton, so
## they are merged into one AnimationPlayer on the character. Items in the hands hang off two
## sockets that follow the rig's hand-slot bones.

const CHARACTER_SCENE: String = "res://art/kaykit/characters/Rogue_Hooded.glb"
## KayKit's palette texture recoloured for the Blackfen: the bright cloth greens become dark, worn
## oilcloth and everything else is muted (art/kaykit/README.md says how it was made).
const SURVIVOR_TEXTURE: String = "res://art/kaykit/characters/survivor_texture.png"
const ANIMATION_SOURCES: Array[String] = [
	"res://art/kaykit/animations/Rig_Medium_General.glb",
	"res://art/kaykit/animations/Rig_Medium_MovementBasic.glb",
	"res://art/kaykit/animations/Rig_Medium_MovementAdvanced.glb",
	"res://art/kaykit/animations/Rig_Medium_CombatMelee.glb",
]
## Animations that repeat until something else is played.
const LOOPING: Array[StringName] = [
	&"Idle_A", &"Idle_B", &"Melee_2H_Idle", &"Melee_Unarmed_Idle", &"Walking_A", &"Walking_B",
	&"Running_A", &"Running_B", &"Sneaking", &"Melee_Blocking", &"Interact", &"Use_Item",
]
## The KayKit character is about 2.17 m tall at rest, hood included; the survivor's capsule is 1.75 m.
const MODEL_SCALE: float = 0.8
const DEFAULT_BLEND: float = 0.12

var anim: AnimationPlayer
## Where the main-hand item goes. Its -Z axis points out of the fist along the blade.
var right_socket: Node3D
## Where the shield or torch goes. Its -Z axis points out of the fist.
var left_socket: Node3D

## Items that stay upright whatever the hand does (a torch flame points up, not at the floor).
var upright: Array[Node3D] = []

var _character: Node3D
var _current: StringName = &""

static var _library: AnimationLibrary


func _init() -> void:
	name = "SurvivorModel"
	_character = (load(CHARACTER_SCENE) as PackedScene).instantiate() as Node3D
	_character.scale = Vector3.ONE * MODEL_SCALE
	# glTF characters face +Z; the controller aims its visual root down -Z.
	_character.rotation.y = PI
	add_child(_character)
	_apply_texture(load(SURVIVOR_TEXTURE) as Texture2D)

	anim = AnimationPlayer.new()
	anim.name = "AnimationPlayer"
	_character.add_child(anim)
	anim.add_animation_library(&"", _shared_library())

	var skeleton: Skeleton3D = _character.find_child("Skeleton3D", true, false) as Skeleton3D
	right_socket = _make_socket(skeleton, "handslot.r")
	left_socket = _make_socket(skeleton, "handslot.l")
	play(&"Idle_A", 1.0, 0.0)
	# After the animation and the hand sockets have moved this frame.
	process_priority = 100


func _process(_delta: float) -> void:
	for n: Node3D in upright:
		if n.is_inside_tree() and n.visible:
			# Upright, leaning slightly forward, at real size.
			n.global_basis = global_basis.orthonormalized() * Basis(Vector3.RIGHT, deg_to_rad(-18.0))


func _apply_texture(texture: Texture2D) -> void:
	for node: Node in _character.find_children("*", "MeshInstance3D", true, false):
		var mi := node as MeshInstance3D
		for i: int in range(mi.mesh.get_surface_count()):
			var base := mi.mesh.surface_get_material(i) as StandardMaterial3D
			if base == null:
				continue
			var mat := base.duplicate() as StandardMaterial3D
			mat.albedo_texture = texture
			mat.roughness = 0.92
			mi.set_surface_override_material(i, mat)


## All Rig_Medium animations in one library, built once and shared by every survivor.
static func _shared_library() -> AnimationLibrary:
	if _library != null:
		return _library
	_library = AnimationLibrary.new()
	for path: String in ANIMATION_SOURCES:
		var source: Node = (load(path) as PackedScene).instantiate()
		var player: AnimationPlayer = source.find_child("AnimationPlayer", true, false) as AnimationPlayer
		if player != null:
			for anim_name: StringName in player.get_animation_list():
				if anim_name == &"T-Pose" or _library.has_animation(anim_name):
					continue
				var a: Animation = player.get_animation(anim_name)
				a.loop_mode = Animation.LOOP_LINEAR if anim_name in LOOPING else Animation.LOOP_NONE
				_library.add_animation(anim_name, a)
		source.free()
	return _library


func _make_socket(skeleton: Skeleton3D, bone: String) -> Node3D:
	var attach := BoneAttachment3D.new()
	attach.name = "Attach_" + bone
	attach.bone_name = bone
	skeleton.add_child(attach)
	var socket := Node3D.new()
	socket.name = "Socket"
	# Undo the model's scale so items keep their real sizes, and turn the bone's +Y (out of the
	# fist) into the socket's -Z, which is how the controller's item meshes are laid out.
	socket.scale = Vector3.ONE / MODEL_SCALE
	socket.rotation_degrees = Vector3(90.0, 0.0, 0.0)
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
