extends SceneTree
# Headless regression checks for Ashen Wilds (Milestones 1-5 and enemy wall deflection).
# Run: godot --headless --path . --script res://tests/smoke_test.gd
# Exit code is the number of failures (0 = all passed).

var _main: Node3D
var _fails: int = 0
var _passes: int = 0
var _player: PlayerController
var _hud: TacticalHUD
var _loot_events: Array = []

func _initialize() -> void:
	_run.call_deferred()

func _check(cond: bool, label: String) -> void:
	if cond:
		_passes += 1
		print("PASS  ", label)
	else:
		_fails += 1
		print("FAIL  ", label)

func _section(title: String) -> void:
	print("\n== %s ==" % title)

func _ticks(n: int) -> void:
	for i in range(n):
		await physics_frame

func _seconds(s: float) -> void:
	await _ticks(int(ceil(s * Engine.physics_ticks_per_second)) + 1)

func _children_of(cls_check: Callable) -> Array:
	var out: Array = []
	for c: Node in _main.get_children():
		if cls_check.call(c):
			out.append(c)
	return out

## Presses an action for exactly one physics tick, then lets the tick that
## consumed it settle so callers can assert on the result immediately.
func _tap(action: String) -> void:
	await physics_frame
	Input.action_press(action)
	await physics_frame
	Input.action_release(action)
	await physics_frame

## Sends a real InputEvent (needed for _unhandled_input listeners like the pack window).
func _send_event(action: String) -> void:
	var down := InputEventAction.new()
	down.action = action
	down.pressed = true
	Input.parse_input_event(down)
	await process_frame
	await process_frame
	var up := InputEventAction.new()
	up.action = action
	up.pressed = false
	Input.parse_input_event(up)
	await process_frame

func _make_test_lootable(pos: Vector3, duration: float, contents: Array) -> Lootable:
	var l := Lootable.new()
	l.display_name = "Test Cache"
	l.search_duration = duration
	for inst: Variant in contents:
		l.items.append(inst)
	_main.add_child(l)
	l.global_position = pos
	return l

func _reset_player(pos: Vector3) -> void:
	_player.respawn_at_shelter(pos)
	_player.set_ui_capture(false)
	_player.ui_capture = false
	_player._dodge_cooldown = 0.0

func _run() -> void:
	_main = (load("res://main.tscn") as PackedScene).instantiate()
	root.add_child(_main)
	await _ticks(5)

	_player = _children_of(func(n: Node) -> bool: return n is PlayerController)[0]
	_hud = _children_of(func(n: Node) -> bool: return n is TacticalHUD)[0]
	_player.loot_opened.connect(func(l: Lootable) -> void: _loot_events.append(l))

	await _test_milestones_1_to_3()

	# Freeze enemies so M4 checks are deterministic (they'd otherwise interrupt searches).
	for e: Node in _children_of(func(n: Node) -> bool: return n is EnemyGoblinScavenger or n is EnemyOrkWarrior or n is EnemyOgreBrute):
		e.process_mode = Node.PROCESS_MODE_DISABLED

	await _test_loadout_and_inventory()
	await _test_encumbrance()
	await _test_scavenging()
	await _test_equipment()
	await _test_durability_and_blocking()
	await _test_bandage_drop_and_ui()
	await _test_corpse_loot()
	await _test_world_containers()
	await _test_wall_deflection()
	await _test_weapon_lodging()
	await _test_enemy_wall_deflection()

	print("\n--- %d passed, %d failure(s) ---" % [_passes, _fails])
	quit(_fails)

# ------------------------------------------------------------------------------
func _test_milestones_1_to_3() -> void:
	_section("Milestones 1-3")
	var goblins: Array = _children_of(func(n: Node) -> bool: return n is EnemyGoblinScavenger)
	var ogre: EnemyOgreBrute = _children_of(func(n: Node) -> bool: return n is EnemyOgreBrute)[0]
	var goblin: EnemyGoblinScavenger = goblins[0]
	_check(_player.global_position.distance_to(Vector3(-6.5, 0, 6.5)) < 0.6, "player spawned at shelter")
	_check(goblin.global_position.distance_to(Vector3(-1.2, 0, -3.2)) < 1.5, "yard goblin spawned near its post")
	_check(ogre.global_position.distance_to(Vector3(-13.5, 0, -11.5)) < 1.0, "ogre spawned in lair")
	_check(ogre._home_pos.distance_to(Vector3(-13.5, 0, -11.5)) < 1.0, "ogre home position recorded")

	var hp_before: float = goblin.health
	goblin._hurtbox.receive_attack(CombatPayload.new(_player, _player.global_position, Vector3.FORWARD, 22.0, 18.0))
	_check(goblin.health < hp_before, "goblin takes damage via hurtbox (%.0f -> %.0f)" % [hp_before, goblin.health])

	var st_before: float = _player.stamina
	_player._start_attack(false)
	_check(_player.current_state == PlayerController.ActionState.ATTACK_STARTUP, "light attack enters STARTUP")
	_check(_player.stamina < st_before, "light attack consumes stamina")
	await _seconds(1.0)
	_check(_player.current_state in [PlayerController.ActionState.IDLE, PlayerController.ActionState.MOVE],
		"attack sequence returns to IDLE (state=%s)" % PlayerController.ActionState.keys()[_player.current_state])

	var coord: EncounterCoordinator = _children_of(func(n: Node) -> bool: return n is EncounterCoordinator)[0]
	var a := Node3D.new()
	var b := Node3D.new()
	root.add_child(a)
	root.add_child(b)
	coord._active_holders.clear()
	coord._cooldown_timer = 0.0
	_check(coord.request_attack_token(a), "coordinator grants first token")
	_check(not coord.request_attack_token(b), "coordinator denies second simultaneous token")
	coord.release_attack_token(a)
	_check(not coord.request_attack_token(b), "readability gap blocks immediate re-grant")
	a.queue_free()
	b.queue_free()
	coord._active_holders.clear()

# ------------------------------------------------------------------------------
func _test_loadout_and_inventory() -> void:
	_section("Loadout & inventory")
	_reset_player(Vector3(-2.0, 0.0, 10.0))
	var inv: Inventory = _player.inventory
	_check(inv.main_hand != null and inv.main_hand.data.item_id == "arming_sword", "starts with arming sword in main hand")
	_check(inv.off_hand != null and inv.off_hand.data.item_id == "wooden_targe", "starts with targe in off-hand")
	_check(inv.find_first("pitch_torch") != null, "torch carried in pack")
	_check(inv.count_of("clean_rag_bandage") == 2, "starts with 2 bandages")
	_check(absf(inv.total_weight() - 5.9) < 0.01, "starting weight 5.9 kg (got %.2f)" % inv.total_weight())
	_check(not _player.is_torch_lit(), "torch light off while shield is readied")

	inv.add(ItemDatabase.make("iron_scrap", 3))
	inv.add(ItemDatabase.make("iron_scrap", 4))
	var scrap_stacks: int = 0
	for i: ItemInstance in inv.items:
		if i.data.item_id == "iron_scrap":
			scrap_stacks += 1
	_check(scrap_stacks == 1 and inv.count_of("iron_scrap") == 7, "stackables merge into one stack (7 scrap)")
	inv.add(ItemDatabase.make("iron_scrap", 18))
	_check(inv.count_of("iron_scrap") == 25, "overflow beyond max_stack splits into a second stack")
	inv.consume("iron_scrap", 25)
	_check(inv.count_of("iron_scrap") == 0, "consume removes items across stacks")

# ------------------------------------------------------------------------------
func _test_encumbrance() -> void:
	_section("Encumbrance")
	var inv: Inventory = _player.inventory
	var added: Array[ItemInstance] = []
	# 5.9 + 6 timber (9.0) = 14.9 kg -> 83% -> BURDENED
	var t1 := ItemDatabase.make("timber", 6)
	inv.add(t1)
	added.append(t1)
	_check(inv.get_load() == Inventory.Load.BURDENED, "14.9 / 18 kg is BURDENED")
	_check(_player.get_noise_multiplier() > 1.0, "burdened pack is noisier (clatter)")
	# + 4 timber (6.0) = 20.9 kg -> OVERBURDENED
	var t2 := ItemDatabase.make("timber", 4)
	inv.add(t2)
	added.append(t2)
	_check(inv.get_load() == Inventory.Load.OVERBURDENED, "20.9 / 18 kg is OVERBURDENED")
	_player.stamina = _player.max_stamina
	_check(not _player._try_start_dodge(Vector3.FORWARD), "cannot dodge while overburdened")
	# Hard limit 27 kg: a 4.5 kg pot (-> 25.4) fits, a second (-> 29.9) doesn't.
	var pot1 := ItemDatabase.make("cooking_pot")
	var pot2 := ItemDatabase.make("cooking_pot")
	_check(inv.add(pot1), "can exceed capacity up to the hard limit")
	_check(not inv.add(pot2), "pickups beyond the 150% hard limit are refused")
	added.append(pot1)
	for inst: ItemInstance in inv.items.duplicate():
		if inst.data.item_id in ["timber", "cooking_pot"]:
			inv.remove(inst)
	_check(inv.get_load() == Inventory.Load.NORMAL, "back to NORMAL after unloading")

# ------------------------------------------------------------------------------
func _test_scavenging() -> void:
	_section("Scavenging")
	var origin := Vector3(-2.0, 0.0, 10.0)
	_reset_player(origin)
	await _ticks(2)

	# 1) Completes, opens loot window, marks searched.
	var cache := _make_test_lootable(origin + Vector3(0.8, 0, 0), 1.0, [ItemDatabase.make("salt", 2), ItemDatabase.make("boar_spear", 1, 60.0)])
	await _ticks(2)
	_check(_player.get_nearest_lootable() == cache, "nearest lootable detected within radius")
	_loot_events.clear()
	await _tap("interact")
	_check(_player.current_state == PlayerController.ActionState.CHANNEL
		and _player.get_channel_kind() == PlayerController.ChannelKind.SCAVENGE, "E starts a timed search")
	await _seconds(0.5)
	var mid: float = _player.get_channel_progress()
	_check(mid > 0.3 and mid < 0.8, "search progress advances (%.2f at 0.5s of 1.0s)" % mid)
	await _seconds(0.7)
	_check(cache.searched, "search completes and marks container searched")
	_check(_loot_events.has(cache), "loot_opened emitted on completion")
	_check(_hud.inventory_ui.is_loot_open() and _player.ui_capture, "loot window opens and captures combat input")

	# 2) Take items.
	var spear: ItemInstance = null
	for i: ItemInstance in cache.items:
		if i.data.item_id == "boar_spear":
			spear = i
	_check(_player.take_from(cache, spear), "take spear from container")
	_check(_player.inventory.has_item(spear) and not cache.items.has(spear), "spear moved container -> pack")
	_hud.inventory_ui._take_all()
	_check(cache.items.is_empty() and _player.inventory.count_of("salt") >= 2, "Take All empties container")
	_hud.inventory_ui.close_all()
	await _seconds(0.2)
	_check(not _player.ui_capture, "closing windows releases combat input")

	# 3) Re-opening a searched container is instant.
	_loot_events.clear()
	await _tap("interact")
	_check(_loot_events.has(cache) and _player.current_state != PlayerController.ActionState.CHANNEL, "searched container re-opens instantly")
	_hud.inventory_ui.close_all()
	await _seconds(0.2)
	cache.queue_free()
	await _ticks(2)

	# 4) Cancelled by moving.
	var c2 := _make_test_lootable(origin + Vector3(0.8, 0, 0), 2.0, [ItemDatabase.make("salt", 1)])
	await _ticks(2)
	await _tap("interact")
	await _seconds(0.4)
	Input.action_press("move_up")
	await _ticks(2)
	Input.action_release("move_up")
	await _ticks(1)
	_check(_player.current_state != PlayerController.ActionState.CHANNEL and not c2.searched, "moving cancels a search")

	# 5) Cancelled by being hit (and loot window force-closed).
	_reset_player(origin)
	await _ticks(2)
	await _tap("interact")
	await _seconds(0.3)
	var hp: float = _player.health
	_player._on_hurtbox_hit_received(CombatPayload.new(_main, origin + Vector3(1, 0, 0), Vector3.LEFT, 5.0, 2.0))
	_check(_player.current_state != PlayerController.ActionState.CHANNEL and not c2.searched, "taking a hit interrupts the search")
	_check(_player.health < hp, "the interrupting hit still lands")

	# 6) Pressing E again stops searching.
	_reset_player(origin)
	await _ticks(2)
	await _tap("interact")
	await _seconds(0.3)
	await _tap("interact")
	await _ticks(1)
	_check(_player.current_state != PlayerController.ActionState.CHANNEL and not c2.searched, "pressing E again stops searching")
	c2.queue_free()
	await _ticks(2)

# ------------------------------------------------------------------------------
func _test_equipment() -> void:
	_section("Equipment switching")
	_reset_player(Vector3(-2.0, 0.0, 10.0))
	var inv: Inventory = _player.inventory
	if inv.find_first("woodsmans_broadaxe") == null:
		inv.add(ItemDatabase.make("woodsmans_broadaxe", 1, 90.0))
	await _ticks(2)
	var sword_width: float = _player.get_hitbox_size().x

	await _tap("equip_slot_2")
	_check(_player.get_channel_kind() == PlayerController.ChannelKind.EQUIP_SWAP, "[2] starts an equip swap")
	_check(inv.main_hand.data.item_id == "arming_sword", "weapon not swapped until the swap finishes")
	await _seconds(0.7)
	_check(inv.main_hand != null and inv.main_hand.data.item_id == "boar_spear", "spear readied after swap time")
	var spear_size: Vector3 = _player.get_hitbox_size()
	_check(spear_size.z > 2.3 and spear_size.x < sword_width, "spear hitbox is longer and narrower (%.2f x %.2f)" % [spear_size.x, spear_size.z])
	_check(not _player._has_ready_shield(), "two-handed spear stows the shield")
	_player._start_attack(true)
	await _seconds(_player.weapon.heavy_startup_time + 0.03)
	_check(_player.get_hitbox_size().x > spear_size.x + 0.5, "spear heavy sweep widens the hitbox")
	await _seconds(1.2)

	await _tap("equip_slot_3")
	await _seconds(0.7)
	_check(inv.main_hand.data.item_id == "woodsmans_broadaxe", "[3] readies the axe")
	_check(_player.get_hitbox_size().x > sword_width, "axe hitbox is wider than the sword's")
	_check(_player._has_ready_shield(), "one-handed axe allows the shield again")

	await _tap("equip_slot_1")
	await _seconds(0.7)
	_check(inv.main_hand.data.item_id == "arming_sword", "[1] readies the sword")
	_check(absf(_player.get_hitbox_size().x - sword_width) < 0.01, "sword hitbox restored")

	await _tap("equip_slot_4")
	await _seconds(0.7)
	_check(inv.off_hand.data.item_id == "pitch_torch", "[4] swaps shield for torch")
	await _ticks(2)
	_check(_player.is_torch_lit(), "torch light on while torch is readied")
	var fuel_before: float = inv.off_hand.condition
	await _seconds(1.0)
	_check(inv.off_hand.condition < fuel_before - 0.8, "torch burns fuel while lit (%.1f -> %.1f)" % [fuel_before, inv.off_hand.condition])
	inv.off_hand.condition = 0.4
	await _seconds(0.6)
	_check(not _player.is_torch_lit(), "torch gutters out when fuel runs dry")
	inv.off_hand.condition = 120.0

	await _tap("equip_slot_4")
	await _seconds(0.7)
	_check(inv.off_hand.data.item_id == "wooden_targe", "[4] swaps back to the shield")
	_check(not _player.is_torch_lit(), "torch light off again")

	# Swap is cancelled by an attack press.
	await _tap("equip_slot_3")
	await _ticks(3)
	await _tap("attack_light")
	await _ticks(2)
	_check(inv.main_hand.data.item_id == "arming_sword", "attack input during a swap cancels it")
	await _seconds(1.0)

# ------------------------------------------------------------------------------
func _test_durability_and_blocking() -> void:
	_section("Durability & blocking")
	_reset_player(Vector3(-2.0, 0.0, 10.0))
	await _ticks(2)
	var inv: Inventory = _player.inventory
	var sword: ItemInstance = inv.main_hand
	sword.condition = 80.0
	var before: float = sword.condition
	_player._on_confirmed_hit_landed(_main, CombatPayload.new(_player, Vector3.ZERO, Vector3.FORWARD, 1, 1, false, false))
	_check(absf(sword.condition - (before - 1.0)) < 0.001, "light hit wears weapon by 1")
	_player._on_confirmed_hit_landed(_main, CombatPayload.new(_player, Vector3.ZERO, Vector3.FORWARD, 1, 1, false, true))
	_check(absf(sword.condition - (before - 3.0)) < 0.001, "heavy hit wears weapon by 2")
	_check(is_equal_approx(_player._weapon_condition_multiplier(), 1.0), "above 50% condition: full damage")
	sword.condition = 25.0
	_check(absf(_player._weapon_condition_multiplier() - 0.8) < 0.01, "25% condition: 80% damage")
	sword.condition = 0.5
	_player._on_confirmed_hit_landed(_main, CombatPayload.new(_player, Vector3.ZERO, Vector3.FORWARD, 1, 1))
	_check(sword.is_broken() and is_equal_approx(_player._weapon_condition_multiplier(), 0.4), "breaking drops damage to 40%")
	sword.condition = 88.0
	inv.notify_changed()

	# Blocking wears the shield; a splintered shield can't block.
	var shield: ItemInstance = inv.off_hand
	shield.condition = 120.0
	_player.current_state = PlayerController.ActionState.BLOCK
	var hp: float = _player.health
	var front: Vector3 = _player.global_position + _player._aim_direction * 1.5
	_player._on_hurtbox_hit_received(CombatPayload.new(_main, front, -_player._aim_direction, 20.0, 30.0))
	_check(is_equal_approx(_player.health, hp), "frontal hit blocked with shield")
	_check(absf(shield.condition - 114.0) < 0.01, "block wears shield by poise x 0.2 (120 -> %.1f)" % shield.condition)
	_player.current_state = PlayerController.ActionState.IDLE
	_player.stamina = _player.max_stamina
	_player.is_exhausted = false
	shield.condition = 0.0
	inv.notify_changed()
	_check(not _player._has_ready_shield(), "splintered shield cannot block")
	shield.condition = 120.0
	inv.notify_changed()
	_check(_player._has_ready_shield(), "repaired shield blocks again")

# ------------------------------------------------------------------------------
func _test_bandage_drop_and_ui() -> void:
	_section("Bandage, drop & UI")
	_reset_player(Vector3(-2.0, 0.0, 10.0))
	await _ticks(2)
	var inv: Inventory = _player.inventory
	var bandages: int = inv.count_of("clean_rag_bandage")
	_player.is_bleeding = true
	_player.bleed_timer = 12.0
	await _tap("bandage")
	_check(_player.get_channel_kind() == PlayerController.ChannelKind.BANDAGE, "[B] starts binding the wound")
	await _seconds(1.8)
	_check(not _player.is_bleeding, "bandage stops bleeding")
	_check(inv.count_of("clean_rag_bandage") == bandages - 1, "bandage consumed (%d -> %d)" % [bandages, inv.count_of("clean_rag_bandage")])

	# Drop -> ground pile you can pick back up.
	var scrap := ItemDatabase.make("iron_scrap", 2)
	inv.add(scrap)
	var w: float = inv.total_weight()
	_check(_player.drop_item(scrap), "drop item")
	_check(inv.total_weight() < w - 1.0, "dropping reduces pack weight")
	await _ticks(3)
	var pile: Lootable = _player.get_nearest_lootable()
	_check(pile != null and pile.items.has(scrap), "dropped item becomes a ground pile")
	_loot_events.clear()
	await _tap("interact")
	_check(_loot_events.has(pile), "ground pile opens instantly")
	_player.take_from(pile, scrap)
	await _ticks(3)
	_check(inv.has_item(scrap) and not is_instance_valid(pile), "empty pile disappears after pickup")
	_hud.inventory_ui.close_all()
	await _seconds(0.2)

	# Tab opens pack; attacks are suppressed while it's open.
	await _send_event("inventory")
	await _ticks(1)
	_check(_hud.inventory_ui.is_inventory_open(), "[Tab] opens the pack window")
	var stam: float = _player.stamina
	await _tap("attack_light")
	await _ticks(1)
	_check(_player.current_state != PlayerController.ActionState.ATTACK_STARTUP and is_equal_approx(_player.stamina, stam), "attacks suppressed while a window is open")
	_player._on_hurtbox_hit_received(CombatPayload.new(_main, _player.global_position + Vector3(1, 0, 0), Vector3.LEFT, 1.0, 1.0))
	_check(not _hud.inventory_ui.is_any_open(), "getting hit closes open windows")
	await _seconds(0.2)

# ------------------------------------------------------------------------------
func _test_corpse_loot() -> void:
	_section("Corpse loot")
	# Yard goblin (index 0): its corpse lies outside, away from the interior test spots.
	var goblin: EnemyGoblinScavenger = _children_of(func(n: Node) -> bool: return n is EnemyGoblinScavenger)[0]
	goblin._on_hurtbox_hit_received(CombatPayload.new(_player, goblin.global_position + Vector3(1, 0, 0), Vector3.LEFT, 999.0, 10.0))
	await _ticks(2)
	var corpse: Lootable = null
	for c: Node in goblin.get_children():
		if c is Lootable:
			corpse = c
	_check(goblin.state == EnemyGoblinScavenger.AIState.DEAD, "goblin killed")
	_check(corpse != null and not corpse.items.is_empty(), "dead goblin becomes a searchable corpse")
	if corpse:
		_check(corpse.items.any(func(i: ItemInstance) -> bool: return i.data.item_id == "iron_scrap"), "goblin corpse always carries iron scrap")

	var ork: EnemyOrkWarrior = _children_of(func(n: Node) -> bool: return n is EnemyOrkWarrior)[1]
	ork._on_hurtbox_hit_received(CombatPayload.new(_player, ork.global_position + Vector3(1, 0, 0), Vector3.LEFT, 999.0, 10.0))
	await _ticks(2)
	_check(ork.get_children().any(func(c: Node) -> bool: return c is Lootable), "dead ork becomes a searchable corpse")

# ------------------------------------------------------------------------------
func _test_world_containers() -> void:
	_section("World containers")
	var lootables: Array = get_nodes_in_group("lootable")
	var names: Array = lootables.map(func(l: Lootable) -> String: return l.display_name)
	for expected: String in ["Shelter Stash", "Rotted Grain Crate", "Watchhouse Supply Chest", "Ork Plunder Pile", "Gnawed Bone Heap"]:
		_check(names.has(expected), "container present: %s" % expected)
	var chest: Lootable = null
	var heap: Lootable = null
	for l: Lootable in lootables:
		if l.display_name == "Watchhouse Supply Chest":
			chest = l
		elif l.display_name == "Gnawed Bone Heap":
			heap = l
	_check(chest != null and chest.items.any(func(i: ItemInstance) -> bool: return i.data.item_id == "boar_spear"), "spear is in the watchhouse chest")
	_check(heap != null and heap.items.any(func(i: ItemInstance) -> bool: return i.data.item_id == "cooking_pot"), "cooking pot is in the ogre's bone heap")

	# Real search of the watchhouse chest from inside the building.
	_reset_player(chest.global_position + Vector3(-1.2, 0.0, 0.0))
	await _ticks(3)
	_check(_player.get_nearest_lootable() == chest, "chest reachable from inside the watchhouse")
	await _tap("interact")
	await _seconds(3.2)
	_check(chest.searched, "watchhouse chest searched (3.0s)")
	_hud.inventory_ui.close_all()

# ------------------------------------------------------------------------------
# Milestone 5
# ------------------------------------------------------------------------------
const HALL := Vector3(2.8, 0.0, -2.675)   # inside the 1.7 m entry hall
const OPEN := Vector3(-2.0, 0.0, 10.0)    # open ground south of the shelter

func _face(dir: Vector3) -> void:
	_player._aim_direction = dir.normalized()
	_player._visual_root.look_at(_player.global_position + dir.normalized(), Vector3.UP)

func _ready_for_attack() -> void:
	_player.stamina = _player.max_stamina
	_player.is_exhausted = false
	_player._dodge_cooldown = 0.0

func _equip_now(item_id: String) -> ItemInstance:
	var inst: ItemInstance = _player.inventory.find_first(item_id)
	if inst == null:
		inst = ItemDatabase.make(item_id)
		_player.inventory.add(inst)
	inst.condition = inst.data.max_condition
	_player.inventory.equip(inst)
	return inst

## Starts an attack and returns the state right after its startup phase.
func _attack_and_resolve(heavy: bool) -> PlayerController.ActionState:
	_ready_for_attack()
	_player._start_attack(heavy)
	var startup: float = _player.weapon.heavy_startup_time if heavy else _player.weapon.light_startup_time
	await _seconds(startup + 0.03)
	var result: PlayerController.ActionState = _player.current_state
	await _seconds(1.6) # let recovery / recoil finish
	return result

func _spawn_dummy_goblin(pos: Vector3) -> EnemyGoblinScavenger:
	var g := EnemyGoblinScavenger.new()
	_main.add_child(g)
	g.global_position = pos
	g.process_mode = Node.PROCESS_MODE_DISABLED
	return g

func _test_wall_deflection() -> void:
	_section("Wall & corridor deflection")
	var rig: IsoCameraRig = _player.camera_rig
	_player.camera_rig = null # deterministic aim (no mouse in headless)
	var sword: ItemInstance = _equip_now("arming_sword")
	_equip_now("wooden_targe")

	_reset_player(OPEN)
	_face(Vector3.RIGHT)
	await _ticks(3)
	_check(not _player.is_cramped(), "open ground: sword sweep not cramped")
	_check(await _attack_and_resolve(false) == PlayerController.ActionState.ATTACK_ACTIVE, "open ground: sword slash connects normally")

	_reset_player(HALL)
	_face(Vector3.RIGHT)
	await _ticks(3)
	_check(_player.is_cramped(), "entry hall: sword sweep flagged as cramped")
	sword.condition = 80.0
	var hb_active: bool = true
	_ready_for_attack()
	_player._start_attack(false)
	await _seconds(_player.weapon.light_startup_time + 0.03)
	hb_active = _player._hitbox._is_swing_active
	_check(_player.current_state == PlayerController.ActionState.RECOIL, "entry hall: sword slash clangs into RECOIL")
	_check(not hb_active, "a clanged swing never opens its hitbox")
	_check(absf(sword.condition - 77.0) < 0.01, "clang costs 3x wear (80 -> %.1f)" % sword.condition)
	_check(get_nodes_in_group("lootable").size() >= 0 and _main.find_children("WallSparks*", "Node3D", false, false).size() > 0, "clang throws sparks")
	await _seconds(0.7)
	_check(_player.current_state == PlayerController.ActionState.IDLE, "recoil ends back in IDLE")

	_reset_player(HALL)
	_face(Vector3.RIGHT)
	await _ticks(2)
	_check(await _attack_and_resolve(true) == PlayerController.ActionState.ATTACK_ACTIVE, "entry hall: sword heavy (thrust) is never deflected")

	_equip_now("boar_spear")
	_reset_player(HALL)
	_face(Vector3.RIGHT)
	await _ticks(3)
	_check(not _player.is_cramped(), "entry hall: spear thrust not cramped")
	_check(await _attack_and_resolve(false) == PlayerController.ActionState.ATTACK_ACTIVE, "entry hall: spear thrust connects")
	_reset_player(HALL)
	_face(Vector3.RIGHT)
	await _ticks(2)
	_check(await _attack_and_resolve(true) == PlayerController.ActionState.RECOIL, "entry hall: spear heavy shaft-sweep clangs")

	_equip_now("woodsmans_broadaxe")
	_reset_player(HALL)
	_face(Vector3.RIGHT)
	await _ticks(2)
	_check(await _attack_and_resolve(false) == PlayerController.ActionState.RECOIL, "entry hall: axe cleave clangs")
	_reset_player(OPEN)
	_face(Vector3.RIGHT)
	await _ticks(2)
	_check(await _attack_and_resolve(false) == PlayerController.ActionState.ATTACK_ACTIVE, "open ground: axe cleave connects")

	# Doorway: facing through it is fine, facing along the wall is not.
	_equip_now("arming_sword")
	_reset_player(Vector3(0.2, 0.0, -2.675))
	_face(Vector3.RIGHT)
	await _ticks(3)
	_check(_player.is_cramped(), "facing down the entry hall from the doorway is cramped")
	_reset_player(Vector3(-0.8, 0.0, -2.675))
	_face(Vector3.LEFT)
	await _ticks(3)
	_check(not _player.is_cramped(), "facing out into the yard is not cramped")

	_player.camera_rig = rig

func _make_lodge(target: Node3D, lethal: bool) -> void:
	_player._is_current_attack_heavy = true
	_player.current_state = PlayerController.ActionState.ATTACK_ACTIVE
	_player._state_timer = 0.2
	var dmg: float = 999.0 if lethal else 1.0
	var hit := CombatPayload.new(_player, _player.global_position, _player._aim_direction, dmg, 1.0, false, true, 1.0)
	target._on_hurtbox_hit_received(hit)
	_player._on_confirmed_hit_landed(target, hit)

func _lodged_piles() -> Array:
	return get_nodes_in_group("lootable").filter(func(l: Lootable) -> bool: return l.name.begins_with("LodgedWeapon") and not l.is_queued_for_deletion())

func _test_weapon_lodging() -> void:
	_section("Weapon lodging")
	var rig: IsoCameraRig = _player.camera_rig
	_player.camera_rig = null
	var axe_w: WeaponData = ItemDatabase.get_item("woodsmans_broadaxe").weapon
	var saved_chance: float = axe_w.heavy_lodge_chance
	axe_w.heavy_lodge_chance = 1.0 # force the roll for deterministic tests
	var axe: ItemInstance = _equip_now("woodsmans_broadaxe")

	# 1) Kill -> lodge -> tug free, keep the axe.
	_reset_player(OPEN)
	_face(Vector3.RIGHT)
	await _ticks(2)
	var g1 := _spawn_dummy_goblin(OPEN + Vector3(1.4, 0, 0))
	_make_lodge(g1, true)
	_check(_player.current_state == PlayerController.ActionState.LODGED and _player.get_lodged_target() == g1, "lethal heavy axe blow lodges in the goblin")
	var cond_before: float = axe.condition
	await _seconds(0.45)
	_check(_player.current_state != PlayerController.ActionState.LODGED and _player.inventory.main_hand == axe, "0.35 s tug wrenches the axe free")
	_check(axe.condition < cond_before, "wrenching free costs a little condition")
	await _seconds(0.6)

	# 2) Light hits never lodge.
	var g2 := _spawn_dummy_goblin(OPEN + Vector3(1.4, 0, 1.0))
	_player._is_current_attack_heavy = false
	_player.current_state = PlayerController.ActionState.ATTACK_ACTIVE
	var light_hit := CombatPayload.new(_player, _player.global_position, Vector3.RIGHT, 999.0, 1.0, false, false, 1.0)
	g2._on_hurtbox_hit_received(light_hit)
	_player._on_confirmed_hit_landed(g2, light_hit)
	_check(_player.current_state != PlayerController.ActionState.LODGED, "light hits never lodge")
	_player.current_state = PlayerController.ActionState.IDLE

	# 3) A target that is neither dead nor staggered doesn't lodge.
	#    (Goblins stagger on every heavy hit, so use an unshielded Ork, which
	#    only staggers when its poise breaks.)
	var ork := EnemyOrkWarrior.new()
	ork.has_shield = false
	_main.add_child(ork)
	ork.global_position = OPEN + Vector3(1.4, 0, -1.0)
	ork.process_mode = Node.PROCESS_MODE_DISABLED
	ork.state = EnemyOrkWarrior.AIState.PURSUE
	_make_lodge(ork, false)
	_check(_player.current_state != PlayerController.ActionState.LODGED, "no lodge if the target shrugs the blow off")
	_player.current_state = PlayerController.ActionState.IDLE

	# 4) The boar spear's lugs stop it lodging.
	_equip_now("boar_spear")
	var g4 := _spawn_dummy_goblin(OPEN + Vector3(1.4, 0, 0.5))
	_make_lodge(g4, true)
	_check(_player.current_state != PlayerController.ActionState.LODGED, "boar spear never lodges")
	_player.current_state = PlayerController.ActionState.IDLE
	_equip_now("woodsmans_broadaxe")
	axe = _player.inventory.main_hand

	# 5) Let go with Space: dodge clear, axe stays in the body.
	_reset_player(OPEN)
	_face(Vector3.RIGHT)
	await _ticks(2)
	var g5 := _spawn_dummy_goblin(OPEN + Vector3(1.4, 0, 0))
	_make_lodge(g5, true)
	_ready_for_attack()
	await _tap("dodge")
	_check(_player.inventory.main_hand == null and not _player.inventory.has_item(axe), "[Space] while lodged lets go of the axe")
	_check(_player.current_state == PlayerController.ActionState.DODGE or _player._dodge_cooldown > 0.0, "letting go turns into an evasive step")
	_check(_player.weapon.weapon_id == "bare_fists", "empty-handed after letting go")
	var piles: Array = _lodged_piles()
	_check(piles.size() == 1 and piles[0].items.has(axe), "axe left lodged in the corpse as a lootable")
	await _seconds(0.8)

	# 6) Work it loose and take it back.
	var pile: Lootable = piles[0]
	_reset_player(pile.global_position + Vector3(-0.9, 0, 0))
	await _ticks(3)
	_check(_player.get_nearest_lootable() == pile, "lodged weapon is the nearest interactable")
	_check(pile.get_prompt().begins_with("[E] Work loose"), "prompt reads 'Work loose' (%s)" % pile.get_prompt())
	_loot_events.clear()
	await _tap("interact")
	_check(_player._channel_label().begins_with("Working loose"), "progress bar reads 'Working loose'")
	await _seconds(1.4)
	_check(_loot_events.has(pile), "working it loose opens the loot window")
	_player.take_from(pile, axe)
	await _ticks(2)
	_check(_player.inventory.has_item(axe) and not is_instance_valid(pile), "axe recovered; lodged marker removed")
	_hud.inventory_ui.close_all()
	await _seconds(0.2)

	# 7) Getting hit while lodged tears the weapon from your grip.
	_player.inventory.equip(axe)
	_reset_player(OPEN)
	_face(Vector3.RIGHT)
	await _ticks(2)
	var g7 := _spawn_dummy_goblin(OPEN + Vector3(1.4, 0, 0))
	_make_lodge(g7, true)
	var hp: float = _player.health
	_player._on_hurtbox_hit_received(CombatPayload.new(_main, OPEN + Vector3(0, 0, 1.5), Vector3.BACK, 10.0, 5.0))
	_check(_player.inventory.main_hand == null and _lodged_piles().size() == 1, "a hit while lodged tears the axe from your grip")
	_check(_player.health < hp, "...and the hit still lands")

	# Clean up: take the axe back, restore the roll and the sword.
	var last: Lootable = _lodged_piles()[0]
	_player.take_from(last, last.items[0])
	axe_w.heavy_lodge_chance = saved_chance
	_equip_now("arming_sword")
	_equip_now("wooden_targe")
	_player.camera_rig = rig
	await _ticks(2)

# ------------------------------------------------------------------------------
# Enemy wall deflection. Each enemy's checks live in their own function below;
# spawn your own enemy dummies (the level's enemies are frozen by now).
# ------------------------------------------------------------------------------
func _test_enemy_wall_deflection() -> void:
	await _test_goblin_corridor()
	await _test_ork_clang()
	await _test_ogre_clang()

# ------------------------------------------------------------------------------
# Goblin: its shiv jab is a thrust, so it never clangs, even in the entry hall.
# Keep goblin helpers between this banner and the next one.
# ------------------------------------------------------------------------------
## A live (processing) goblin with no player or coordinator, facing `dir`.
func _spawn_attacking_goblin(pos: Vector3, dir: Vector3) -> EnemyGoblinScavenger:
	var g := EnemyGoblinScavenger.new()
	g.audio = _player.audio
	_main.add_child(g)
	g.global_position = pos
	g._facing_dir = dir.normalized()
	g._visual_root.look_at(g.global_position + g._facing_dir, Vector3.UP)
	g.state = EnemyGoblinScavenger.AIState.IDLE
	g._state_timer = 99.0
	return g

func _wall_sparks_now() -> Array:
	return _main.get_children().filter(func(c: Node) -> bool: return String(c.name).contains("WallSparks"))

## Starts the goblin's real windup and watches it tick by tick until its
## startup ends. Returns the state it resolves into and whether the hitbox
## opened at any point up to `watch_after` seconds afterwards.
func _goblin_attack_resolve(g: EnemyGoblinScavenger, watch_after: float) -> Dictionary:
	var result: Dictionary = {"state": g.state, "hitbox": false, "new_sparks": 0}
	var sparks_before: Array = _wall_sparks_now()
	if not g._try_begin_attack_windup():
		return result
	var limit: int = int(ceil(1.2 * Engine.physics_ticks_per_second))
	for i in range(limit):
		await _ticks(1)
		result["hitbox"] = result["hitbox"] or g._hitbox._is_swing_active
		if g.state != EnemyGoblinScavenger.AIState.ATTACK_STARTUP:
			break
	result["state"] = g.state
	for i in range(int(ceil(watch_after * Engine.physics_ticks_per_second))):
		await _ticks(1)
		result["hitbox"] = result["hitbox"] or g._hitbox._is_swing_active
	result["new_sparks"] = _wall_sparks_now().filter(func(c: Node) -> bool: return not sparks_before.has(c)).size()
	return result

func _test_goblin_corridor() -> void:
	_section("Enemy deflection: goblin")

	# 1) Default: the shiv jab is a thrust and connects even in the entry hall.
	var g1 := _spawn_attacking_goblin(HALL, Vector3.RIGHT)
	await _ticks(2)
	_check(g1.attack_is_thrust, "goblin jab is a thrust by default")
	_check(not WallDeflection.sweep_obstruction(g1, Vector3.RIGHT, EnemyGoblinScavenger.SWEEP_ARC_DEGREES, EnemyGoblinScavenger.SWEEP_REACH).is_empty(),
		"entry hall: a goblin-sized sweep would be obstructed (sanity)")
	var r1: Dictionary = await _goblin_attack_resolve(g1, 0.0)
	_check(r1["state"] == EnemyGoblinScavenger.AIState.ATTACK_ACTIVE and g1._hitbox._is_swing_active,
		"entry hall: goblin jab reaches ATTACK_ACTIVE with its hitbox open (state=%s)" % EnemyGoblinScavenger.AIState.keys()[r1["state"]])
	_check(r1["new_sparks"] == 0, "entry hall: goblin jab throws no sparks")
	g1.queue_free()
	await _ticks(2)

	# 2) As a sweep, the same placement clangs through the shared rule.
	var g2 := _spawn_attacking_goblin(HALL, Vector3.RIGHT)
	g2.attack_is_thrust = false
	await _ticks(2)
	var r2: Dictionary = await _goblin_attack_resolve(g2, 0.3)
	_check(r2["state"] == EnemyGoblinScavenger.AIState.ATTACK_RECOVERY, "entry hall: goblin sweep clangs into ATTACK_RECOVERY (state=%s)" % EnemyGoblinScavenger.AIState.keys()[r2["state"]])
	_check(not r2["hitbox"], "entry hall: a clanged goblin sweep never opens its hitbox")
	_check(r2["new_sparks"] > 0, "entry hall: goblin clang throws WallSparks")
	_check(g2.state == EnemyGoblinScavenger.AIState.ATTACK_RECOVERY and g2._state_timer > 0.0 and g2._state_timer <= 0.31,
		"goblin clang recovery lasts 0.6 s (%.2f s left after 0.3 s)" % g2._state_timer)
	g2.attack_is_thrust = true
	g2.queue_free()
	await _ticks(2)

	# 3) As a sweep on open ground, nothing obstructs it.
	var g3 := _spawn_attacking_goblin(OPEN + Vector3(0.0, 0.0, 3.0), Vector3.RIGHT)
	g3.attack_is_thrust = false
	await _ticks(2)
	var r3: Dictionary = await _goblin_attack_resolve(g3, 0.0)
	_check(r3["state"] == EnemyGoblinScavenger.AIState.ATTACK_ACTIVE and g3._hitbox._is_swing_active,
		"open ground: goblin sweep is not deflected (state=%s)" % EnemyGoblinScavenger.AIState.keys()[r3["state"]])
	_check(r3["new_sparks"] == 0, "open ground: goblin sweep throws no sparks")
	g3.attack_is_thrust = true
	g3.queue_free()
	await _ticks(2)

# ------------------------------------------------------------------------------
# Ork: the combo's opening slash clangs in cramped space; the overhead chop does not.
# Keep ork helpers between this banner and the next one.
# ------------------------------------------------------------------------------
func _spawn_dummy_ork(pos: Vector3, facing: Vector3) -> EnemyOrkWarrior:
	var o := EnemyOrkWarrior.new()
	o.has_shield = true
	_main.add_child(o)
	o.global_position = pos
	o._facing_dir = facing.normalized()
	o._visual_root.look_at(o.global_position + o._facing_dir, Vector3.UP)
	o.state = EnemyOrkWarrior.AIState.IDLE
	o._state_timer = 99.0
	return o

func _ork_sparks() -> int:
	return _main.find_children("WallSparks*", "Node3D", false, false).size()

## Ticks until the ork leaves `from_state` (max ~1 s). Returns true if the
## hitbox was ever active on any sampled tick.
func _ork_wait_leave(o: EnemyOrkWarrior, from_state: EnemyOrkWarrior.AIState) -> bool:
	var hb_seen: bool = o._hitbox._is_swing_active
	for i in range(60):
		if o.state != from_state:
			break
		await physics_frame
		hb_seen = hb_seen or o._hitbox._is_swing_active
	return hb_seen

func _test_ork_clang() -> void:
	_section("Enemy deflection: ork")
	# Park the player on open ground, well clear of both dummies' swings.
	_reset_player(OPEN)
	await _ticks(2)
	var coord: EncounterCoordinator = _children_of(func(n: Node) -> bool: return n is EncounterCoordinator)[0]
	var audio_list: Array = _children_of(func(n: Node) -> bool: return n is ProceduralAudio)
	coord._active_holders.clear()
	coord._cooldown_timer = 0.0

	# 1) In the entry hall, facing down it: the opening slash clangs.
	var ork := _spawn_dummy_ork(HALL, Vector3.RIGHT)
	ork.coordinator = coord
	if not audio_list.is_empty():
		ork.audio = audio_list[0]
	var barks: Array[String] = []
	ork.ork_combat_bark.connect(func(msg: String) -> void: barks.append(msg))
	await _ticks(2)
	var sparks_before: int = _ork_sparks()
	_check(ork._try_begin_combo() and coord._active_holders.has(ork.get_instance_id()), "ork: combo takes an attack token")
	var hb_seen: bool = await _ork_wait_leave(ork, EnemyOrkWarrior.AIState.COMBO_1_STARTUP)
	_check(ork.state == EnemyOrkWarrior.AIState.RECOIL,
		"ork: entry hall combo slash clangs into RECOIL (state=%s)" % EnemyOrkWarrior.AIState.keys()[ork.state])
	_check(not hb_seen and not ork._hitbox._is_swing_active, "ork: a clanged slash never opens its hitbox")
	_check(_ork_sparks() > sparks_before, "ork: clang throws WallSparks")
	_check(ork.is_staggered(), "ork: RECOIL counts as staggered (lodging opening)")
	_check(not coord._active_holders.has(ork.get_instance_id()), "ork: clang releases the attack token")
	_check(barks.size() == 1 and barks[0].contains("Clang"), "ork: clang barks once (%s)" % [barks])
	_check(ork._knockback_vel.length() > 0.5, "ork: clang pushes the ork back off the wall (%.2f m/s)" % ork._knockback_vel.length())

	# Guard is down during the recoil: a frontal hit lands instead of being blocked.
	var hp: float = ork.health
	var guard: float = ork.guard_stamina
	ork._on_hurtbox_hit_received(CombatPayload.new(_player, ork.global_position + Vector3.RIGHT * 1.2, Vector3.LEFT, 5.0, 1.0))
	_check(ork.health < hp and is_equal_approx(ork.guard_stamina, guard), "ork: shield guard is down during RECOIL (frontal hit lands)")
	_check(ork.state == EnemyOrkWarrior.AIState.RECOIL, "ork: a light hit doesn't cut the recoil short")
	# Forget the attacker so the dummy doesn't start a fresh combo afterwards.
	ork._has_last_known_pos = false
	ork._memory_timer = 0.0

	# 2) Still reeling just before wall_recoil_time; recovered just after, without the combo resuming.
	# A clang must leave a longer opening than a whiffed slash (active + link + recovery).
	_check(ork.wall_recoil_time > 0.16 + 0.24 + 0.78,
		"ork: a clang opens a longer window than a whiffed slash (%.2f s > 1.18 s)" % ork.wall_recoil_time)
	ork.guard_stamina = 20.0
	await _seconds(ork.wall_recoil_time - 0.12)
	_check(ork.state == EnemyOrkWarrior.AIState.RECOIL, "ork: still in RECOIL before %.2f s" % ork.wall_recoil_time)
	await _ork_wait_leave(ork, EnemyOrkWarrior.AIState.RECOIL)
	_check(ork.state == EnemyOrkWarrior.AIState.SHIELD_ADVANCE,
		"ork: shielded ork returns to SHIELD_ADVANCE (state=%s)" % EnemyOrkWarrior.AIState.keys()[ork.state])
	_check(ork.guard_stamina < 21.0, "ork: recoil doesn't refill guard stamina (%.1f)" % ork.guard_stamina)
	await _seconds(0.2)
	_check(ork.state not in [EnemyOrkWarrior.AIState.RECOIL, EnemyOrkWarrior.AIState.COMBO_LINK,
		EnemyOrkWarrior.AIState.COMBO_2_STARTUP, EnemyOrkWarrior.AIState.COMBO_2_ACTIVE],
		"ork: combo does not continue after a clang (state=%s)" % EnemyOrkWarrior.AIState.keys()[ork.state])

	# 3) In the hall, the overhead chop is never deflected.
	ork.global_position = HALL
	ork._facing_dir = Vector3.RIGHT
	ork._knockback_vel = Vector3.ZERO
	await _ticks(2)
	ork.state = EnemyOrkWarrior.AIState.COMBO_2_STARTUP
	ork._state_timer = 0.05
	hb_seen = await _ork_wait_leave(ork, EnemyOrkWarrior.AIState.COMBO_2_STARTUP)
	_check(ork.state == EnemyOrkWarrior.AIState.COMBO_2_ACTIVE and hb_seen,
		"ork: entry hall overhead chop reaches COMBO_2_ACTIVE, hitbox open (state=%s)" % EnemyOrkWarrior.AIState.keys()[ork.state])
	await _seconds(0.3)
	ork.queue_free()

	# 4) On open ground (3 m from the player, swinging away from them) the slash connects as before.
	coord._active_holders.clear()
	coord._cooldown_timer = 0.0
	var ork_open := _spawn_dummy_ork(OPEN + Vector3(0.0, 0.0, 3.0), Vector3.RIGHT)
	ork_open.coordinator = coord
	await _ticks(2)
	sparks_before = _ork_sparks()
	ork_open._try_begin_combo()
	hb_seen = await _ork_wait_leave(ork_open, EnemyOrkWarrior.AIState.COMBO_1_STARTUP)
	_check(ork_open.state == EnemyOrkWarrior.AIState.COMBO_1_ACTIVE and hb_seen,
		"ork: open ground combo slash reaches COMBO_1_ACTIVE, hitbox open (state=%s)" % EnemyOrkWarrior.AIState.keys()[ork_open.state])
	_check(_ork_sparks() == sparks_before, "ork: no sparks when nothing obstructs")
	await _seconds(0.25)
	_check(ork_open.state == EnemyOrkWarrior.AIState.COMBO_LINK or ork_open.state == EnemyOrkWarrior.AIState.ATTACK_RECOVERY,
		"ork: unobstructed slash flows into the combo link (state=%s)" % EnemyOrkWarrior.AIState.keys()[ork_open.state])
	await _seconds(0.3)
	ork_open.queue_free()
	coord._active_holders.clear()
	coord._cooldown_timer = 0.0
	await _ticks(2)

# ------------------------------------------------------------------------------
# Ogre: the club sweep clangs off walls; the ground slam never does.
# Keep ogre helpers below this banner.
# ------------------------------------------------------------------------------
func _test_ogre_clang() -> void:
	_section("Enemy deflection: ogre")
	# The ogre is too big for the entry hall, so build a cramped spot in open
	# ground ~13 m from the player: a stone wall running along the ogre's left
	# side, inside the 150-degree sweep arc but clear of its 0.85 m body.
	_reset_player(OPEN)
	await _ticks(2)
	var spot: Vector3 = OGRE_YARD
	var wall := _make_ogre_test_wall(spot + Vector3(0.8, 1.25, -1.5), Vector3(4.0, 2.5, 0.4))
	var level_ogre: EnemyOgreBrute = _children_of(func(n: Node) -> bool: return n is EnemyOgreBrute)[0]
	var coord: EncounterCoordinator = _children_of(func(n: Node) -> bool: return n is EncounterCoordinator)[0]
	var saved_holders: Dictionary = coord._active_holders.duplicate()
	coord._active_holders.clear()

	var ogre := EnemyOgreBrute.new()
	_main.add_child(ogre)
	ogre.audio = level_ogre.audio
	ogre.coordinator = coord
	ogre.process_mode = Node.PROCESS_MODE_DISABLED
	var banners: Array[String] = []
	ogre.ogre_event_banner.connect(func(txt: String, _col: Color) -> void: banners.append(txt))
	_check(_player.current_state != PlayerController.ActionState.DEAD and _player.global_position.distance_to(spot) > 10.0,
		"ogre test: player parked alive, %.1f m away" % _player.global_position.distance_to(spot))

	# 1) Sweep beside the wall clangs. Driven through the real state machine:
	#    SWEEP_STARTUP with its timer expired goes active on the next tick.
	#    player_ref is the live, distant player so _process_ai_state runs its
	#    match normally (it forces IDLE only for a missing or dead player).
	await _pose_ogre(ogre, spot, Vector3.RIGHT)
	coord.request_attack_token(ogre, true)
	_check(coord._active_holders.has(ogre.get_instance_id()), "ogre holds the attack token before its sweep")
	var sparks_before: int = _main.find_children("WallSparks*", "Node3D", false, false).size()
	ogre.player_ref = _player
	ogre.state = EnemyOgreBrute.AIState.SWEEP_STARTUP
	ogre._state_timer = 0.0
	ogre.process_mode = Node.PROCESS_MODE_INHERIT
	var hb_ever_active: bool = false
	var reached_sweep_active: bool = false
	for i in range(3):
		await physics_frame
		hb_ever_active = hb_ever_active or ogre._hitbox._is_swing_active
		reached_sweep_active = reached_sweep_active or ogre.state == EnemyOgreBrute.AIState.SWEEP_ACTIVE
	_check(ogre.state == EnemyOgreBrute.AIState.RECOIL,
		"wall beside the ogre: club sweep clangs into RECOIL (state=%s)" % EnemyOgreBrute.AIState.keys()[ogre.state])
	_check(_main.find_children("WallSparks*", "Node3D", false, false).size() > sparks_before, "ogre clang throws sparks")
	_check(ogre.is_staggered() and not ogre.is_dead(), "recoiling ogre counts as staggered (lodging opening)")
	_check(not coord._active_holders.has(ogre.get_instance_id()), "clang releases the ogre's attack token")
	_check(banners.any(func(t: String) -> bool: return t.contains("smashes into the wall")), "clang raises the 'smashes into the wall' banner")
	_check(not ogre._slam_ring.visible, "no slam ring shown during recoil")
	var ticks_in_recoil: int = 0
	while ogre.state == EnemyOgreBrute.AIState.RECOIL and ticks_in_recoil < 600:
		await physics_frame
		ticks_in_recoil += 1
		hb_ever_active = hb_ever_active or ogre._hitbox._is_swing_active
		reached_sweep_active = reached_sweep_active or ogre.state == EnemyOgreBrute.AIState.SWEEP_ACTIVE
	_check(not hb_ever_active and not reached_sweep_active, "a clanged ogre sweep never opens its hitbox")
	# The wall is on the -Z side; the knockback (1.2 m/s, decaying at 18 m/s^2)
	# is a ~4 cm nudge, so compare against the pre-swing position.
	_check(ogre.global_position.z > spot.z + 0.02,
		"recoil knocks the ogre away from the wall (z %.3f -> %.3f)" % [spot.z, ogre.global_position.z])

	# 2) Recoil length. Still the real state machine with the live player as
	#    player_ref, so this also proves RECOIL isn't cut short while the
	#    player is alive.
	var recoil_secs: float = float(ticks_in_recoil) / float(Engine.physics_ticks_per_second)
	# A clang must leave a longer opening than a whiffed sweep (active + long recovery).
	_check(ogre.wall_recoil_time > 0.24 + 1.30,
		"a clang opens a longer window than a whiffed sweep (%.2f s > 1.54 s)" % ogre.wall_recoil_time)
	_check(absf(recoil_secs - ogre.wall_recoil_time) < 0.1,
		"recoil lasts wall_recoil_time (%.2f s of %.2f s)" % [recoil_secs, ogre.wall_recoil_time])
	await _seconds(0.05)
	_check(ogre.state == EnemyOgreBrute.AIState.PURSUE and not ogre.is_staggered(),
		"after recoil the ogre resumes PURSUE (state=%s)" % EnemyOgreBrute.AIState.keys()[ogre.state])
	ogre.process_mode = Node.PROCESS_MODE_DISABLED

	# 3) Ground slam beside the same wall: vertical, never deflected.
	await _pose_ogre(ogre, spot, Vector3.RIGHT)
	var sparks_pre_slam: int = _main.find_children("WallSparks*", "Node3D", false, false).size()
	ogre.state = EnemyOgreBrute.AIState.SLAM_STARTUP
	ogre._state_timer = 0.0
	ogre.process_mode = Node.PROCESS_MODE_INHERIT
	await _ticks(3)
	_check(ogre.state == EnemyOgreBrute.AIState.SLAM_ACTIVE and ogre._hitbox._is_swing_active,
		"beside the wall: ground slam reaches SLAM_ACTIVE with its hitbox open")
	_check(_main.find_children("WallSparks*", "Node3D", false, false).size() == sparks_pre_slam, "ground slam throws no sparks")
	await _seconds(0.3)
	_check(ogre.state == EnemyOgreBrute.AIState.LONG_RECOVERY and not ogre._slam_ring.visible and not ogre._hitbox._is_swing_active,
		"after the slam: long recovery, slam ring hidden, hitbox closed")
	ogre.process_mode = Node.PROCESS_MODE_DISABLED

	# 4) Same spot with the wall gone: the sweep connects exactly as before.
	wall.queue_free()
	await _ticks(3)
	await _pose_ogre(ogre, spot, Vector3.RIGHT)
	ogre.state = EnemyOgreBrute.AIState.SWEEP_STARTUP
	ogre._state_timer = 0.0
	ogre.process_mode = Node.PROCESS_MODE_INHERIT
	await _ticks(3)
	_check(ogre.state == EnemyOgreBrute.AIState.SWEEP_ACTIVE and ogre._hitbox._is_swing_active,
		"no wall nearby: club sweep reaches SWEEP_ACTIVE with its hitbox open (state=%s)" % EnemyOgreBrute.AIState.keys()[ogre.state])
	ogre.process_mode = Node.PROCESS_MODE_DISABLED

	ogre.queue_free()
	coord._active_holders = saved_holders
	await _ticks(2)

const OGRE_YARD := Vector3(-12.0, 0.0, 18.0)   # open ground, ~13 m north-west of OPEN

func _make_ogre_test_wall(center: Vector3, size: Vector3) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.name = "OgreTestWall"
	body.collision_layer = 1
	body.collision_mask = 0
	body.position = center
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	shape.shape = box
	body.add_child(shape)
	_main.add_child(body)
	return body

## Places a frozen ogre on its feet, still, idle and facing `facing`.
func _pose_ogre(ogre: EnemyOgreBrute, pos: Vector3, facing: Vector3) -> void:
	ogre.process_mode = Node.PROCESS_MODE_DISABLED
	ogre._hitbox.end_swing()
	ogre._slam_ring.visible = false
	ogre.global_position = pos
	ogre.velocity = Vector3.ZERO
	ogre._knockback_vel = Vector3.ZERO
	ogre._home_pos = pos
	ogre._facing_dir = facing.normalized()
	ogre._visual_root.look_at(pos + facing.normalized(), Vector3.UP)
	ogre.state = EnemyOgreBrute.AIState.IDLE
	await _ticks(2)
