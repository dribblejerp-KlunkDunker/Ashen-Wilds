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
## Wording for the prompt and progress bar ("Search" / "Searching").
@export var search_verb: String = "Search"
@export var search_verb_progressive: String = "Searching"
## Milestone 13: you can store your own things here (the shelter stash).
@export var accepts_deposits: bool = false

var items: Array[ItemInstance] = []
var searched: bool = false

func _ready() -> void:
	add_to_group("lootable")

func get_prompt() -> String:
	if not searched:
		return "[E] %s %s (%.1fs)" % [search_verb, display_name, search_duration]
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

func count_of(item_id: String) -> int:
	var n: int = 0
	for inst: ItemInstance in items:
		if inst.data.item_id == item_id:
			n += inst.quantity
	return n

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

## A weapon left stuck in a body (or the ground) after a lodged heavy blow.
## Takes a moment to work loose.
static func spawn_lodged_weapon(parent: Node, world_pos: Vector3, inst: ItemInstance, host: String) -> Lootable:
	var l := Lootable.new()
	l.name = "LodgedWeapon"
	l.display_name = "%s (lodged in %s)" % [inst.data.display_name, host]
	l.search_duration = 1.2
	l.search_verb = "Work loose"
	l.search_verb_progressive = "Working loose"
	l.remove_when_empty = true
	l.interact_radius = 1.8
	l.items.append(inst)
	l.set_meta("save_kind", "lodged")

	var mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	var length: float = 1.2
	if inst.data.weapon != null:
		length = inst.data.weapon.reach_meters * 0.76
	var head: float = 0.22 if inst.data.weapon_class == ItemData.WeaponClass.AXE else 0.08
	box.size = Vector3(0.08, head, length)
	mesh.mesh = box
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.56, 0.52, 0.48)
	mat.metallic = 0.6
	mat.roughness = 0.5
	mesh.material_override = mat
	mesh.rotation_degrees = Vector3(-55.0, 30.0, 0.0) # jutting up at an angle
	mesh.position = Vector3(0.0, length * 0.32, 0.0)
	l.add_child(mesh)

	parent.add_child(l)
	l.global_position = world_pos
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
	l.set_meta("save_kind", "ground")

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
