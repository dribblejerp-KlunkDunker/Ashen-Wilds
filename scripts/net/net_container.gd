class_name NetContainer
extends StaticBody3D
## A shared container in the world (appendix §72: a WORLD OBJECT with a stable id, not an asset).
## The server owns `contents`; clients hold only the snapshot the server last sent them. Every
## stack gets a server-assigned stack id that is unique within this container for the life of
## the stack, so a request can name exactly the thing the player saw. `version` increments on
## every change, so a client can tell a stale view from a current one.
## Appearance is a placeholder crate; the gameplay role (searchable) is assigned here on purpose
## rather than implied by the mesh (brief §14).

var object_id: String = ""
var display_name: String = "Supply crate"
var contents: Inventory = Inventory.new()
var version: int = 1
var _next_stack_id: int = 1
var _stack_ids: Dictionary = {}  # ItemInstance -> int


static func create(id: String, name_: String, pos: Vector3, seed_items: Array[ItemInstance]) -> NetContainer:
	var c := NetContainer.new()
	c.name = id.replace("/", "_")
	c.object_id = id
	c.display_name = name_
	c.position = pos
	c.contents.capacity_kg = 500.0
	c.contents.hard_limit_ratio = 1.0
	for inst: ItemInstance in seed_items:
		c._put(inst)
	return c


func _ready() -> void:
	collision_layer = 1
	collision_mask = 0
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(1.2, 0.9, 0.9)
	shape.shape = box
	shape.position = Vector3(0.0, 0.45, 0.0)
	add_child(shape)
	var mesh := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(1.2, 0.9, 0.9)
	mesh.mesh = bm
	mesh.position = Vector3(0.0, 0.45, 0.0)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.42, 0.31, 0.17)
	mat.roughness = 1.0
	mesh.material_override = mat
	add_child(mesh)
	var lid := MeshInstance3D.new()
	var lm := BoxMesh.new()
	lm.size = Vector3(1.26, 0.08, 0.96)
	lid.mesh = lm
	lid.position = Vector3(0.0, 0.93, 0.0)
	var lmat := StandardMaterial3D.new()
	lmat.albedo_color = Color(0.3, 0.22, 0.12)
	lid.material_override = lmat
	add_child(lid)


## Server side: add a stack, assigning it an id (merging is deliberately not done here, so a
## seeded stack keeps the id the clients were told about).
func _put(inst: ItemInstance) -> void:
	contents.items.append(inst)
	_stack_ids[inst] = _next_stack_id
	_next_stack_id += 1


func find(stack_id: int) -> ItemInstance:
	for inst: ItemInstance in contents.items:
		if int(_stack_ids.get(inst, -1)) == stack_id:
			return inst
	return null


## Server side: remove `quantity` from the stack and return it as its own instance, or null if
## the stack is gone or too small. The stack keeps its id while anything is left of it.
func take(stack_id: int, quantity: int) -> ItemInstance:
	var inst: ItemInstance = find(stack_id)
	if inst == null or quantity < 1 or quantity > inst.quantity:
		return null
	var taken: ItemInstance
	if quantity == inst.quantity:
		contents.items.erase(inst)
		_stack_ids.erase(inst)
		taken = inst
	else:
		inst.quantity -= quantity
		taken = ItemInstance.new(inst.data, quantity, inst.condition)
	version += 1
	return taken


## The wire form of the contents: [[stack_id, item_id, quantity, condition], ...].
func snapshot() -> Array:
	var out: Array = []
	for inst: ItemInstance in contents.items:
		out.append(NetProtocol.stack_to_wire(int(_stack_ids[inst]), inst))
	return out


## Ground-plane distance from a survivor to this container's origin.
func reach_from(p: Vector3) -> float:
	return Vector2(p.x - global_position.x, p.z - global_position.z).length()
