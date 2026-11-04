class_name SetDressing
extends Node3D
## Decoration for the single-player prototype, built from the owner's environment kit
## (assets/environment/env00*, made in a separate session; they will be reworked later).
##
## Solid pieces (trees, stumps, fences, boulders, ruin walls and columns, fallen trees) block bodies
## on physics layer 7 "Props", which the survivor and the enemies collide with but which no ray
## uses: line of sight, the hidden-behind-a-wall check, wall clangs and hit blocking all cast against
## layer 1 only, so props block movement and nothing else. Ground cover, pebbles, low rubble and
## firewood stay walk-through. Tall pieces stand at the yard's edges where they cannot hide a fight.
## `SetDressing.model()` is also how containers get their crate and barrel looks.

const KIT: String = "res://assets/environment/"
## Every placed piece is darkened a little to sit in the Blackfen's light.
const DRESSING_TINT: Color = Color(0.78, 0.76, 0.74)

## Physics layer 7 (bit value 64): blocks survivor and enemy bodies, ignored by every ray.
const PROPS_LAYER: int = 64
enum Solid { NONE, TRUNK, BOX }
## Trees block at the trunk only, not the branches.
const TRUNK_RADIUS: float = 0.22
## Boxes are a little smaller than the piece's footprint, so you brush past rough edges.
const BOX_SHRINK: float = 0.85

## [path under KIT, position, yaw degrees, scale, Solid]
const PIECES: Array = [
	# Dead trees and stumps at the yard's edges.
	["env008/exports/env_trees_02_forked_dead.glb", Vector3(-21.0, 0.0, 12.0), 20.0, 1.0, Solid.TRUNK],
	["env008/exports/env_trees_01_straight_snag.glb", Vector3(-18.5, 0.0, -20.0), 140.0, 1.0, Solid.TRUNK],
	["env008/exports/env_trees_04_gnarled.glb", Vector3(19.5, 0.0, -17.0), 75.0, 1.0, Solid.TRUNK],
	["env008/exports/env_trees_03_wind_bent.glb", Vector3(21.0, 0.0, 15.5), 200.0, 1.0, Solid.TRUNK],
	["env008/exports/env_trees_05_snapped_crown.glb", Vector3(-2.5, 0.0, -16.0), 300.0, 1.0, Solid.TRUNK],
	["env008/exports/env_trees_06_split_trunk.glb", Vector3(7.5, 0.0, 19.5), 45.0, 1.0, Solid.TRUNK],
	["env008/exports/env_trees_11_stump_low.glb", Vector3(-9.0, 0.0, 12.5), 0.0, 1.0, Solid.NONE],
	["env008/exports/env_trees_12_stump_tall.glb", Vector3(3.5, 0.0, 7.5), 80.0, 1.0, Solid.TRUNK],
	["env008/exports/env_trees_13_stump_rooted.glb", Vector3(-14.5, 0.0, 3.0), 160.0, 1.0, Solid.TRUNK],
	["env008/exports/env_trees_08_fallen_long.glb", Vector3(-11.5, 0.0, 9.5), 30.0, 1.0, Solid.BOX],
	["env008/exports/env_trees_09_fallen_branched.glb", Vector3(16.5, 0.0, -6.0), 100.0, 1.0, Solid.BOX],
	# Rocks.
	["env008/exports/env_rocks_09_weathered_cluster.glb", Vector3(-4.0, 0.0, -10.0), 0.0, 1.0, Solid.BOX],
	["env008/exports/env_rocks_03_medium_boulder.glb", Vector3(12.5, 0.0, -2.0), 40.0, 1.0, Solid.BOX],
	["env008/exports/env_rocks_07_stone_cluster.glb", Vector3(-19.5, 0.0, -8.5), 120.0, 1.0, Solid.BOX],
	["env008/exports/env_rocks_05_flat_boulder.glb", Vector3(6.0, 0.0, 12.5), 210.0, 1.0, Solid.BOX],
	["env008/exports/env_rocks_06_pebble_scatter.glb", Vector3(-6.0, 0.0, 9.5), 70.0, 1.0, Solid.NONE],
	# Ruins around the ogre's lair.
	["env009/exports/env_ruin_walls_11_collapsed_end.glb", Vector3(-18.0, 0.0, -13.0), 90.0, 1.0, Solid.BOX],
	["env009/exports/env_ruin_walls_12_ground_course.glb", Vector3(-15.0, 0.0, -17.5), 10.0, 1.0, Solid.NONE],
	["env009/exports/env_ruin_pillars_10_fallen_column.glb", Vector3(-11.5, 0.0, -16.5), 15.0, 1.0, Solid.BOX],
	["env009/exports/env_ruin_pillars_09_leaning_remnant.glb", Vector3(-9.0, 0.0, -13.5), 230.0, 1.0, Solid.BOX],
	["env008/exports/env_rocks_12_wallfall_rubble.glb", Vector3(-16.5, 0.0, -15.5), 60.0, 1.0, Solid.BOX],
	# Rubble against the Watchhouse and the ork walls.
	["env002/exports/env_rubble_stone_small_a.glb", Vector3(9.7, 0.0, -6.0), 90.0, 1.0, Solid.NONE],
	["env002/exports/env_rubble_stone_small_a.glb", Vector3(0.2, 0.0, 1.3), 10.0, 0.9, Solid.NONE],
	["env008/exports/env_rocks_10_masonry_chips.glb", Vector3(5.5, 0.0, 1.7), 0.0, 1.0, Solid.NONE],
	["env008/exports/env_rocks_11_low_masonry_rubble.glb", Vector3(12.0, 0.0, 6.3), 0.0, 1.0, Solid.NONE],
	# The shelter: firewood by the fire, a broken fence along its west side.
	["env002/exports/env_firewood_bundle_a.glb", Vector3(-5.5, 0.0, 5.8), 30.0, 1.0, Solid.NONE],
	["env002/exports/env_firewood_bundle_a.glb", Vector3(-8.9, 0.0, 8.0), 110.0, 0.9, Solid.NONE],
	["env006/exports/env_fence_rail_repaired_c_v01_diagonal_stay.glb", Vector3(-10.6, 0.0, 4.6), 90.0, 1.0, Solid.BOX],
	["env003/exports/env_fence_rail_broken_a.glb", Vector3(-10.6, 0.0, 6.7), 90.0, 1.0, Solid.BOX],
	["env006/exports/env_fence_rail_intact_b_v02_three_pickets.glb", Vector3(-9.4, 0.0, 9.6), 0.0, 1.0, Solid.BOX],
]

## Ground cover scattered with a fixed seed, kept out of these rectangles [x0, z0, x1, z1]:
## the Watchhouse, the ork walls, the shelter fire and every container.
const COVER: Array[String] = [
	"env008/exports/env_ground_01_grass_sparse.glb", "env008/exports/env_ground_02_grass_medium.glb",
	"env008/exports/env_ground_04_grass_trampled.glb", "env008/exports/env_ground_06_weeds_dry.glb",
	"env008/exports/env_ground_07_weeds_broadleaf.glb", "env008/exports/env_ground_08_leaves_sparse.glb",
	"env008/exports/env_ground_10_twigs_sparse.glb", "env008/exports/env_ground_05_sedge_tall.glb",
]
const COVER_COUNT: int = 70
const COVER_SEED: int = 1306
const COVER_KEEP_OUT: Array = [
	[0.3, -7.6, 9.7, 1.6], [8.5, 4.8, 16.2, 12.4], [-7.6, 3.9, -5.4, 5.7],
	[-8.6, 6.4, -7.2, 7.6], [-4.9, 1.6, -3.5, 2.8], [6.6, -6.2, 8.2, -5.0],
	[12.4, 11.7, 14.0, 13.1], [-15.8, -13.7, -14.2, -12.3],
]

var placed: int = 0
var solids: int = 0


func _ready() -> void:
	name = "SetDressing"
	for p: Array in PIECES:
		var node := model(self, String(p[0]), p[1], float(p[2]), float(p[3]))
		if node != null:
			placed += 1
			if int(p[4]) != Solid.NONE:
				_make_solid(node, int(p[4]))
				solids += 1
	var rng := RandomNumberGenerator.new()
	rng.seed = COVER_SEED
	var tries: int = 0
	var cover: int = 0
	while cover < COVER_COUNT and tries < COVER_COUNT * 10:
		tries += 1
		var pos := Vector3(rng.randf_range(-24.0, 24.0), 0.0, rng.randf_range(-24.0, 24.0))
		var path: String = COVER[rng.randi() % COVER.size()]
		var yaw: float = rng.randf_range(0.0, 360.0)
		var scale_f: float = rng.randf_range(0.8, 1.3)
		if _kept_out(pos):
			continue
		if model(self, path, pos, yaw, scale_f) != null:
			cover += 1
			placed += 1


## A StaticBody3D on the Props layer inside the piece, so it shares the piece's turn and scale.
static func _make_solid(node: Node3D, kind: int) -> void:
	var body := StaticBody3D.new()
	body.name = "Solid"
	body.collision_layer = PROPS_LAYER
	body.collision_mask = 0
	var shape := CollisionShape3D.new()
	var bounds: AABB = _bounds(node)
	if kind == Solid.TRUNK:
		var cyl := CylinderShape3D.new()
		cyl.radius = TRUNK_RADIUS
		cyl.height = maxf(bounds.size.y, 1.0)
		shape.shape = cyl
		shape.position = Vector3(0.0, cyl.height * 0.5, 0.0)
	else:
		var box := BoxShape3D.new()
		box.size = Vector3(bounds.size.x * BOX_SHRINK, maxf(bounds.size.y, 0.3), bounds.size.z * BOX_SHRINK)
		shape.shape = box
		shape.position = bounds.get_center()
	body.add_child(shape)
	node.add_child(body)


static func _kept_out(pos: Vector3) -> bool:
	for r: Array in COVER_KEEP_OUT:
		if pos.x >= float(r[0]) and pos.x <= float(r[2]) and pos.z >= float(r[1]) and pos.z <= float(r[3]):
			return true
	return false


## Places one kit model under `parent` (decoration: no collision), darkened by DRESSING_TINT.
## Returns null, and places nothing, if the file is missing.
static func model(parent: Node, path: String, pos: Vector3, yaw_degrees: float = 0.0, scale_f: float = 1.0) -> Node3D:
	var full: String = path if path.begins_with("res://") else KIT + path
	if not ResourceLoader.exists(full):
		push_warning("SetDressing: missing %s" % full)
		return null
	var node := (load(full) as PackedScene).instantiate() as Node3D
	node.position = pos
	node.rotation_degrees = Vector3(0.0, yaw_degrees, 0.0)
	node.scale = Vector3.ONE * scale_f
	_tint(node, DRESSING_TINT)
	parent.add_child(node)
	return node


## Fits a kit model inside a box of `size` (centred on the floor), scaled uniformly so it never
## pokes out of the container's collision. Used for crates and barrels that are search containers.
static func fitted_model(parent: Node3D, path: String, size: Vector3, tint: Color = Color.WHITE) -> Node3D:
	var node := model(parent, path, Vector3.ZERO)
	if node == null:
		return null
	var bounds: AABB = _bounds(node)
	if bounds.size.x > 0.0 and bounds.size.y > 0.0 and bounds.size.z > 0.0:
		var s: float = minf(minf(size.x / bounds.size.x, size.y / bounds.size.y), size.z / bounds.size.z)
		node.scale = Vector3.ONE * s
	if tint != Color.WHITE:
		_tint(node, tint)
	return node


static func _bounds(node: Node3D) -> AABB:
	var out := AABB()
	var first: bool = true
	for m: Node in node.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		var bb: AABB = mi.transform * mi.get_aabb()
		out = bb if first else out.merge(bb)
		first = false
	return out


static func _tint(node: Node, tint: Color) -> void:
	for m: Node in node.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		for i: int in range(mi.mesh.get_surface_count()):
			var base := mi.get_surface_override_material(i) as StandardMaterial3D
			if base == null:
				base = mi.mesh.surface_get_material(i) as StandardMaterial3D
			if base == null:
				continue
			var mat := base.duplicate() as StandardMaterial3D
			mat.albedo_color = mat.albedo_color * tint
			mi.set_surface_override_material(i, mat)
