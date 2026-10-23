class_name SaveGame
extends RefCounted
## Milestone 14: save & load. One JSON file in user://. Saving happens when
## you rest at the shelter fire; loading from the start screen.
##
## Identity rules: world containers by display name, enemies by spawn order,
## dropped piles and lodged weapons by kind and position (re-created on load).

const VERSION: int = 1
static var save_path: String = "user://ashen_wilds_save.json"

static func exists() -> bool:
	return FileAccess.file_exists(save_path)

static func delete() -> void:
	if exists():
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))

# ------------------------------------------------------------------------------
# Items
# ------------------------------------------------------------------------------
static func item_to_dict(inst: ItemInstance, slot: String = "") -> Dictionary:
	var d: Dictionary = {"id": inst.data.item_id, "qty": inst.quantity, "cond": inst.condition}
	if slot != "":
		d["slot"] = slot
	return d

static func item_from_dict(d: Dictionary) -> ItemInstance:
	return ItemDatabase.make(String(d["id"]), int(d["qty"]), float(d["cond"]))

static func items_to_array(items: Array[ItemInstance]) -> Array:
	var out: Array = []
	for inst: ItemInstance in items:
		out.append(item_to_dict(inst))
	return out

static func items_from_array(arr: Array) -> Array[ItemInstance]:
	var out: Array[ItemInstance] = []
	for d: Variant in arr:
		var inst: ItemInstance = item_from_dict(d)
		if inst:
			out.append(inst)
	return out

static func _v3(v: Vector3) -> Array:
	return [v.x, v.y, v.z]

static func _to_v3(a: Variant) -> Vector3:
	var arr: Array = a
	return Vector3(float(arr[0]), float(arr[1]), float(arr[2]))

# ------------------------------------------------------------------------------
# Collect
# ------------------------------------------------------------------------------
static func collect(boot: AshenWildsBootstrap) -> Dictionary:
	var player: PlayerController = boot._player
	var inv: Inventory = player.inventory
	var pack: Array = []
	for inst: ItemInstance in inv.items:
		var slot: String = ""
		if inst == inv.main_hand:
			slot = "main"
		elif inst == inv.off_hand:
			slot = "off"
		else:
			for s: Variant in inv.armor.keys():
				if inv.armor[s] == inst:
					slot = "armor"
		pack.append(item_to_dict(inst, slot))

	var containers: Dictionary = {}
	var piles: Array = []
	for n: Node in boot.get_tree().get_nodes_in_group("lootable"):
		var l := n as Lootable
		if l == null or l.is_queued_for_deletion():
			continue
		match String(l.get_meta("save_kind", "")):
			"container":
				containers[l.display_name] = {"searched": l.searched, "items": items_to_array(l.items)}
			"ground", "lodged":
				piles.append({
					"kind": l.get_meta("save_kind"), "pos": _v3(l.global_position),
					"label": l.display_name, "items": items_to_array(l.items),
				})

	var enemies: Array = []
	for e: Node3D in boot._all_enemies:
		var entry: Dictionary = {"dead": true}
		if is_instance_valid(e):
			# A crow caught mid-flight is saved back on its perch.
			var pos: Vector3 = e.get("_perch_pos") if e is EnemyCarrionCrow else e.global_position
			entry = {"dead": e.is_dead(), "pos": _v3(pos), "health": float(e.get("health"))}
			if e.is_dead():
				for c: Node in e.get_children():
					if c is Lootable:
						entry["corpse"] = {"searched": (c as Lootable).searched, "items": items_to_array((c as Lootable).items)}
		enemies.append(entry)

	var done: Array = []
	for o: Dictionary in boot._objectives.objectives:
		if o["done"]:
			done.append(o["id"])

	return {
		"version": VERSION,
		"background": player.background.background_id if player.background else "",
		"player": {
			"pos": _v3(player.global_position),
			"health": player.health,
			"bleeding": player.is_bleeding,
			"pack": pack,
		},
		"containers": containers,
		"piles": piles,
		"enemies": enemies,
		"objectives": {"done": done, "elapsed": boot._objectives.elapsed, "completed": boot._objectives.completed},
		"weather": int(boot._weather.current),
		"seen": Marshalls.raw_to_base64(boot._vision.get_seen_bytes()),
	}

static func write(boot: AshenWildsBootstrap) -> bool:
	var f := FileAccess.open(save_path, FileAccess.WRITE)
	if f == null:
		push_error("SaveGame: can't write %s" % save_path)
		return false
	f.store_string(JSON.stringify(collect(boot)))
	f.close()
	return true

static func read() -> Dictionary:
	if not exists():
		return {}
	var f := FileAccess.open(save_path, FileAccess.READ)
	if f == null:
		return {}
	var parsed: Variant = JSON.parse_string(f.get_as_text())
	f.close()
	if not (parsed is Dictionary) or int((parsed as Dictionary).get("version", 0)) != VERSION:
		return {}
	return parsed

# ------------------------------------------------------------------------------
# Apply (a coroutine: corpses attach a frame after a death)
# ------------------------------------------------------------------------------
static func apply(boot: AshenWildsBootstrap, data: Dictionary) -> bool:
	if data.is_empty():
		return false
	var player: PlayerController = boot._player
	var bg_id: String = String(data.get("background", ""))
	player.apply_background(BackgroundDatabase.get_background(bg_id) if bg_id != "" else null)

	var p: Dictionary = data["player"]
	var inv: Inventory = player.inventory
	inv.clear()
	for d: Variant in p["pack"]:
		var dd: Dictionary = d
		var inst: ItemInstance = item_from_dict(dd)
		inv.items.append(inst) # bypass the weight limit: it was legal when saved
		match String(dd.get("slot", "")):
			"main":
				inv.main_hand = inst
			"off":
				inv.off_hand = inst
			"armor":
				inv.armor[inst.data.armor_slot] = inst
	inv.notify_changed()
	player.global_position = _to_v3(p["pos"])
	player.health = float(p["health"])
	player.is_bleeding = bool(p["bleeding"])
	player.bleed_timer = 12.0 if player.is_bleeding else 0.0

	var containers: Dictionary = data["containers"]
	for n: Node in boot.get_tree().get_nodes_in_group("lootable"):
		var l := n as Lootable
		if l == null:
			continue
		var kind: String = String(l.get_meta("save_kind", ""))
		if kind == "container" and containers.has(l.display_name):
			var c: Dictionary = containers[l.display_name]
			l.searched = bool(c["searched"])
			l.items = items_from_array(c["items"])
			l.contents_changed.emit()
		elif kind == "ground" or kind == "lodged":
			l.queue_free() # replaced from the save below
	for d: Variant in data["piles"]:
		var pile: Dictionary = d
		var items: Array[ItemInstance] = items_from_array(pile["items"])
		if items.is_empty():
			continue
		var pos: Vector3 = _to_v3(pile["pos"])
		var made: Lootable
		if String(pile["kind"]) == "lodged":
			made = Lootable.spawn_lodged_weapon(boot, pos, items[0], "")
			made.display_name = String(pile["label"])
		else:
			made = Lootable.spawn_ground_pile(boot, pos, items[0])
		for extra: ItemInstance in items.slice(1):
			made.items.append(extra)

	# Objectives first, so re-killing saved-dead enemies doesn't re-announce them.
	var obj: Dictionary = data["objectives"]
	var done: Array = obj["done"]
	for o: Dictionary in boot._objectives.objectives:
		o["done"] = done.has(o["id"])
	boot._objectives.elapsed = float(obj["elapsed"])
	boot._objectives.completed = bool(obj["completed"])

	var enemies: Array = data["enemies"]
	var to_dress: Array = []
	for i in range(mini(enemies.size(), boot._all_enemies.size())):
		var e: Node3D = boot._all_enemies[i]
		var entry: Dictionary = enemies[i]
		if not is_instance_valid(e):
			continue
		if entry.has("pos"):
			e.global_position = _to_v3(entry["pos"])
		if bool(entry["dead"]) and not e.is_dead():
			e.call("_on_hurtbox_hit_received", CombatPayload.new(player, e.global_position, Vector3.FORWARD, 1e9, 0.0))
			to_dress.append([e, entry])
		elif entry.has("health") and not e.is_dead():
			e.set("health", float(entry["health"]))
	if not to_dress.is_empty():
		await boot.get_tree().process_frame
	for pair: Array in to_dress:
		var e: Node3D = pair[0]
		var entry: Dictionary = pair[1]
		if not entry.has("corpse"):
			continue
		for c: Node in e.get_children():
			if c is Lootable:
				var corpse: Lootable = c
				corpse.searched = bool(entry["corpse"]["searched"])
				corpse.items = items_from_array(entry["corpse"]["items"])

	boot._weather.set_weather(int(data["weather"]) as WeatherSystem.Weather, true)
	boot._vision.set_seen_bytes(Marshalls.base64_to_raw(String(data["seen"])))
	return true
