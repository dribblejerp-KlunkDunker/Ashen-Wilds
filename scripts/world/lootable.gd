class_name Lootable
extends Node3D
## Anything the survivor can search: crates, corpses, dropped piles.
## Searching is a timed, cancellable player action; once searched the
## contents open instantly.

signal contents_changed

@export var display_name: String = "Supply Crate"
@export var search_duration: float = 2.5
@export var interact_radius: float = 1.8
@export var remove_when_empty: bool = false

var items: Array[ItemInstance] = []
var searched: bool = false

func _ready() -> void:
	add_to_group("lootable")

func get_prompt() -> String:
	if not searched:
		return "[E] Search %s (%.1fs)" % [display_name, search_duration]
	if items.is_empty():
		return "%s — picked clean" % display_name
	return "[E] Open %s (%d)" % [display_name, items.size()]

func put(inst: ItemInstance) -> void:
	items.append(inst)
	contents_changed.emit()

func take(inst: ItemInstance) -> void:
	items.erase(inst)
	contents_changed.emit()
	if remove_when_empty and items.is_empty():
		queue_free()

func total_weight() -> float:
	var w: float = 0.0
	for inst: ItemInstance in items:
		w += inst.total_weight()
	return w

## Turns a dead enemy into a searchable corpse. Deferred because deaths are
## resolved inside physics callbacks.
static func attach_corpse(body: Node3D, label: String, loot: Array[ItemInstance], duration: float = 3.0) -> Lootable:
	var l := Lootable.new()
	l.name = "CorpseLoot"
	l.display_name = label
	l.search_duration = duration
	l.interact_radius = 2.0
	l.items = loot
	body.add_child.call_deferred(l)
	return l

## Drops an item on the ground as a tiny, instantly-openable pile.
static func spawn_ground_pile(parent: Node, world_pos: Vector3, inst: ItemInstance) -> Lootable:
	var l := Lootable.new()
	l.name = "GroundPile"
	l.display_name = "Dropped " + inst.data.display_name
	l.search_duration = 0.0
	l.searched = true
	l.remove_when_empty = true
	l.interact_radius = 1.4
	l.items.append(inst)

	var mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(0.38, 0.14, 0.3)
	mesh.mesh = box
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.36, 0.30, 0.22)
	mat.roughness = 0.9
	mesh.material_override = mat
	mesh.position = Vector3(0.0, 0.07, 0.0)
	l.add_child(mesh)

	parent.add_child(l)
	l.global_position = world_pos
	return l
