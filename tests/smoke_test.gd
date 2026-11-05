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
	for e: Node in _children_of(func(n: Node) -> bool: return n is EnemyGoblinScavenger or n is EnemyOrkWarrior or n is EnemyOgreBrute or n is EnemyQuarryTroll or n is EnemySporeHusk):
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
	await _test_ogre_drops_attack_when_player_dies()
	await _test_survivor_model()
	await _test_environment_surfaces()
	await _test_atmosphere()
	await _test_enemy_models()
	await _test_enemy_temperaments()
	await _test_perception()
	await _test_weather()
	await _test_backgrounds()
	await _test_armour()
	await _test_companions()
	await _test_quarry_troll()
	await _test_spore_husks()

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

# ------------------------------------------------------------------------------
# Ogre: if the player dies mid-attack, the ogre goes idle without leaving its
# hitbox open or keeping the attack token (which would stop every other enemy
# attacking after the respawn).
# ------------------------------------------------------------------------------
func _test_ogre_drops_attack_when_player_dies() -> void:
	_section("Ogre drops its attack when the player dies")
	_reset_player(OPEN)
	await _ticks(2)
	var level_ogre: EnemyOgreBrute = _children_of(func(n: Node) -> bool: return n is EnemyOgreBrute)[0]
	var coord: EncounterCoordinator = _children_of(func(n: Node) -> bool: return n is EncounterCoordinator)[0]
	var saved_holders: Dictionary = coord._active_holders.duplicate()
	coord._active_holders.clear()

	var ogre := EnemyOgreBrute.new()
	_main.add_child(ogre)
	ogre.audio = level_ogre.audio
	ogre.coordinator = coord
	await _pose_ogre(ogre, OGRE_YARD, Vector3.RIGHT)

	# Mid-slam: hitbox open, slam ring shown, token held. (The slam never clangs.)
	coord.request_attack_token(ogre, true)
	ogre.player_ref = _player
	ogre.state = EnemyOgreBrute.AIState.SLAM_STARTUP
	ogre._state_timer = 0.0
	ogre._slam_ring.visible = true
	ogre.process_mode = Node.PROCESS_MODE_INHERIT
	await _ticks(2)
	_check(ogre.state == EnemyOgreBrute.AIState.SLAM_ACTIVE and ogre._hitbox._is_swing_active,
		"ogre is mid-slam with its hitbox open (state=%s)" % EnemyOgreBrute.AIState.keys()[ogre.state])

	_player.current_state = PlayerController.ActionState.DEAD
	await _ticks(2)
	_check(ogre.state == EnemyOgreBrute.AIState.IDLE, "player died: ogre goes idle")
	_check(not ogre._hitbox._is_swing_active, "player died: ogre's hitbox is closed")
	_check(not ogre._slam_ring.visible, "player died: slam ring is hidden")
	_check(not coord._active_holders.has(ogre.get_instance_id()), "player died: ogre hands back its attack token")

	_reset_player(OPEN)
	ogre.queue_free()
	await _ticks(2)
	coord._active_holders = saved_holders

# ------------------------------------------------------------------------------
# Look and feel: the survivor is an animated character driven by the state machine.
func _test_survivor_model() -> void:
	_section("Survivor model (Quaternius Ranger, presentation only)")
	_reset_player(OPEN)
	_player.camera_rig = null
	var model: SurvivorModel = _player._model
	_check(model != null and model.is_inside_tree(), "player has an animated survivor model")
	var needed: Array[StringName] = [&"Idle", &"Sword_Idle", &"Idle_Torch", &"Walk", &"Jog_Fwd", &"Sprint",
		&"Sword_Regular_A", &"Sword_Regular_B", &"Sword_Regular_C", &"Sword_Dash", &"Punch_Jab", &"Punch_Cross", &"Idle_Shield",
		&"Shield_OneShot", &"Idle_Shield_Break", &"Roll", &"Hit_Knockback", &"Hit_Head", &"Push", &"Death01", &"Interact",
		&"Fixing_Kneeling", &"Consume"]
	var missing: Array[StringName] = needed.filter(func(n: StringName) -> bool: return not model.has_animation(n))
	_check(missing.is_empty(), "every animation the states use is loaded (missing: %s)" % str(missing))
	_check(_player._weapon_mesh.get_parent().get_parent() == model.right_socket, "the weapon hangs off the right-hand socket")
	_check(_player._shield_mesh.get_parent() == model.shield_mount and model.shield_mount.get_parent() == model.left_socket
		and _player._torch_root.get_parent() == model.left_socket, "shield and torch hang off the left-hand socket")

	await _ticks(3)
	_check(model.current_animation() == &"Sword_Idle", "idle with a sword plays Sword_Idle (got %s)" % model.current_animation())

	_player.stamina = _player.max_stamina
	_face(Vector3.FORWARD)
	_player._start_attack(true)
	await _ticks(2)
	var heavy_clip: StringName = model.current_animation()
	_check(heavy_clip == &"Sword_Dash", "the sword's heavy (a thrust) plays the lunge (got %s)" % heavy_clip)
	await _seconds(1.5)
	_player.stamina = _player.max_stamina
	_player._start_attack(false)
	await _ticks(2)
	var light_clip: StringName = model.current_animation()
	_check(String(light_clip).begins_with("Sword_Regular_"), "the sword's light (a sweep) plays a regular swing (got %s)" % light_clip)
	var expected_speed: float = model.anim.get_animation(light_clip).length / (_player.weapon.light_startup_time + _player.weapon.light_active_time + _player.weapon.light_recovery_time)
	_check(absf(model.anim.speed_scale - expected_speed) < 0.05, "the swing animation is fitted to the attack's duration (%.2f vs %.2f)" % [model.anim.speed_scale, expected_speed])
	await _seconds(1.5)

	# The torch stays upright whatever the hand does, and its light hangs over the shoulder, above the hood.
	var torch: ItemInstance = ItemDatabase.make("pitch_torch")
	_player.inventory.add(torch)
	_player.inventory.equip(torch)
	await _ticks(3)
	var torch_up: Vector3 = _player._torch_root.global_basis.y.normalized()
	_check(torch_up.y > 0.9, "the torch points up (up·y = %.2f)" % torch_up.y)
	_check(model.current_animation() == &"Idle_Torch", "idle with a lit torch holds it up (got %s)" % model.current_animation())
	_check(_player._torch_light.global_position.y - _player.global_position.y > 2.0,
		"the torch light hangs above the hood (%.2f m up)" % (_player._torch_light.global_position.y - _player.global_position.y))

	var hp: float = _player.health
	_player.health = 1.0
	_player._hurtbox.receive_attack(CombatPayload.new(_player, _player.global_position + Vector3.FORWARD, Vector3.BACK, 50.0, 10.0))
	await _ticks(2)
	_check(_player.current_state == PlayerController.ActionState.DEAD and model.current_animation() == &"Death01", "death plays Death01")
	_player.health = hp
	_reset_player(OPEN)
	await _ticks(3)
	_check(String(model.current_animation()).contains("Idle"), "respawn returns to an idle (got %s)" % model.current_animation())
	_player.inventory.remove(torch)

# ------------------------------------------------------------------------------
# Look and feel 2: the level's boxes wear photo textures (ambientCG, CC0); the owner's kit dresses it.
func _test_environment_surfaces() -> void:
	await _ticks(1)
	_section("Environment surfaces (ambientCG)")
	var textured: int = 0
	var flat: int = 0
	for n: Node in _main.find_children("*", "MeshInstance3D", true, false):
		var mi := n as MeshInstance3D
		var sm := mi.material_override as ShaderMaterial
		if sm == null or not (mi.get_parent() is StaticBody3D):
			continue
		if sm.get_shader_parameter("use_texture") and sm.get_shader_parameter("albedo_tex") is Texture2D:
			textured += 1
		else:
			flat += 1
	_check(textured >= 15 and flat == 0, "every level box wears a photo texture (%d textured, %d flat)" % [textured, flat])
	# Containers wear the owner's kit (assets/environment/env007), fitted inside their collision.
	var fitted: int = 0
	var poking: int = 0
	for label: String in ["ShelterStash", "RottedGrainCrate", "WatchhouseSupplyChest", "OrkPlunderPile", "GnawedBoneHeap"]:
		var body := _main.find_child(label, true, false) as StaticBody3D
		var holder: Node3D = body.get_node_or_null("Model") as Node3D if body else null
		if holder == null or holder.get_child_count() == 0:
			continue
		fitted += 1
		var box: Vector3 = ((body.get_child(0) as CollisionShape3D).shape as BoxShape3D).size
		var bb: AABB = SetDressing._bounds(holder.get_child(0) as Node3D)
		var sc: Vector3 = (holder.get_child(0) as Node3D).scale
		if bb.size.x * sc.x > box.x + 0.01 or bb.size.z * sc.z > box.z + 0.01:
			poking += 1
	_check(fitted == 5 and poking == 0, "all five containers wear kit models inside their collision (%d fitted, %d poking out)" % [fitted, poking])
	var dressing := _main.find_child("SetDressing", true, false) as SetDressing
	_check(dressing != null and dressing.placed >= 90, "the yard is dressed with the kit (%d pieces)" % (dressing.placed if dressing else 0))
	# Solid pieces block bodies on layer 7 "Props" only; every combat and sight ray uses layer 1.
	var bodies: Array[Node] = dressing.find_children("*", "CollisionObject3D", true, false) if dressing else []
	var off_layer: int = bodies.filter(func(b: Node) -> bool: return (b as CollisionObject3D).collision_layer != SetDressing.PROPS_LAYER).size()
	_check(dressing != null and bodies.size() == dressing.solids and dressing.solids >= 15 and off_layer == 0,
		"solid dressing (%d pieces) is on the Props layer only (%d elsewhere)" % [bodies.size(), off_layer])
	var tree_at := Vector3(-21.0, 0.0, 12.0)
	var space := _player.get_world_3d().direct_space_state
	var ray := PhysicsRayQueryParameters3D.create(tree_at + Vector3(-2.0, 1.0, 0.0), tree_at + Vector3(2.0, 1.0, 0.0), 1)
	_check(space.intersect_ray(ray).is_empty(), "sight and combat rays (layer 1) pass through a tree trunk")
	var props_ray := PhysicsRayQueryParameters3D.create(tree_at + Vector3(-2.0, 1.0, 0.0), tree_at + Vector3(2.0, 1.0, 0.0), SetDressing.PROPS_LAYER)
	_check(not space.intersect_ray(props_ray).is_empty(), "the tree trunk is solid on the Props layer")
	_reset_player(tree_at + Vector3(-1.5, 0.0, 0.0))
	await _ticks(2)
	var blocked: bool = _player.test_move(_player.global_transform, Vector3(1.5, 0.0, 0.0))
	_check(blocked, "the survivor bumps into the tree instead of walking through it")
	_reset_player(OPEN)
	await _ticks(2)

# ------------------------------------------------------------------------------
# Look and feel 3: night lighting, mist, glow, the grade, falling ash, the vignette, fire flicker.
func _test_atmosphere() -> void:
	_section("Atmosphere (look and feel 3)")
	var env: Environment = null
	for n: Node in _main.get_children():
		if n is WorldEnvironment:
			env = (n as WorldEnvironment).environment
	_check(env != null and env.fog_enabled and env.fog_height_density > 0.0 and env.glow_enabled and env.adjustment_enabled
		and env.adjustment_saturation < 1.0, "night grade: fog with ground mist, glow, desaturated adjustment")
	var moon := _main.find_child("Moon", true, false) as DirectionalLight3D
	_check(moon != null and moon.light_color.b > moon.light_color.r, "the moon is cold (blue over red)")
	var ash := _main.find_child("AshFall", true, false) as AshFall
	_check(ash != null and ash.multimesh.instance_count == AshFall.FLAKES and ash.follow == _player, "ash falls around the survivor (%d flakes)" % (ash.multimesh.instance_count if ash else 0))
	await _ticks(2)
	_check(ash != null and Vector2(ash.global_position.x - _player.global_position.x, ash.global_position.z - _player.global_position.z).length() < 0.01,
		"the ash box follows the survivor")
	var vig := _main.find_child("Vignette", true, false) as Vignette
	_check(vig != null and vig.layer < _hud.layer and (vig.get_child(0) as Control).mouse_filter == Control.MOUSE_FILTER_IGNORE,
		"the vignette sits under the HUD and ignores the mouse")
	var fire := _main.find_child("ShelterFireLight", true, false) as FlickerLight
	var energies: Array[float] = []
	for i: int in range(6):
		await _ticks(5)
		energies.append(fire.light_energy if fire else 0.0)
	var spread: float = energies.max() - energies.min()
	_check(fire != null and spread > 0.02 and energies.max() <= fire.base_energy * 1.05, "the shelter fire flickers (energy spread %.2f)" % spread)

# ------------------------------------------------------------------------------
# Look and feel 4: the Ashbound enemy bodies, and every character facing where it aims.
func _toes_dir(model: Node3D) -> Vector3:
	var sk := model.find_child("Skeleton3D", true, false) as Skeleton3D
	var foot: Vector3 = sk.to_global(sk.get_bone_global_pose(sk.find_bone("foot_l")).origin)
	var ball: Vector3 = sk.to_global(sk.get_bone_global_pose(sk.find_bone("ball_l")).origin)
	var d := ball - foot
	d.y = 0.0
	return d.normalized()

func _test_enemy_models() -> void:
	_section("Enemy models (Ashbound) and facing")
	# The Quaternius characters face +Z in their files; the game aims down -Z. Toes must point
	# the way a character aims (this shipped backwards once, in LF-1b).
	_reset_player(OPEN)
	_face(Vector3(1.0, 0.0, 0.0))
	await _ticks(2)
	var survivor_toes: Vector3 = _toes_dir(_player._model)
	_check(survivor_toes.dot(Vector3(1.0, 0.0, 0.0)) > 0.8, "the survivor faces where it aims (toes·aim = %.2f)" % survivor_toes.dot(Vector3(1.0, 0.0, 0.0)))

	var needed: Dictionary = {
		EnemyGoblinScavenger: [&"Crouch_Idle", &"Crouch_Fwd", &"Jog_Fwd", &"Sword_Dash", &"OverhandThrow", &"Hit_Knockback", &"Hit_Chest", &"Death01"],
		EnemyOrkWarrior: [&"Sword_Idle", &"Walk", &"Jog_Fwd", &"Idle_Shield", &"Sword_Regular_A", &"Sword_Regular_C", &"Shield_Dash", &"Idle_Shield_Break", &"Hit_Knockback", &"Hit_Head", &"Death01"],
		EnemyOgreBrute: [&"Zombie_Idle", &"Zombie_Walk_Fwd", &"Zombie_Scratch", &"Sword_Regular_A", &"Sword_Regular_C", &"Push", &"Sprint", &"Hit_Knockback", &"Hit_Head", &"Death01"],
		EnemyQuarryTroll: [&"Zombie_Idle", &"Zombie_Walk_Fwd", &"Sword_Regular_A", &"Sword_Regular_C", &"Hit_Knockback", &"Death01"],
		EnemySporeHusk: [&"Zombie_Idle", &"Zombie_Walk_Fwd", &"Melee_Hook", &"Hit_Chest", &"Death01"],
	}
	for cls: Variant in needed.keys():
		var e: Node3D = _children_of(func(n: Node) -> bool: return is_instance_of(n, cls))[0]
		var m: EnemyModel = e.get("_model")
		var missing: Array = (needed[cls] as Array).filter(func(a: StringName) -> bool: return m == null or not m.has_animation(a))
		_check(m != null and missing.is_empty(), "%s has an Ashbound body with every clip it uses (missing %s)" % [e.get("enemy_name"), str(missing)])
		var weapon: Node3D = e.get("_club_pivot") if e is EnemyOgreBrute else e.get("_weapon_arm")
		_check(m != null and weapon != null and weapon.get_parent() == m.right_socket, "%s holds its weapon in its right hand" % e.get("enemy_name"))
		var vr: Node3D = e.get("_visual_root")
		var saved: Transform3D = vr.global_transform
		vr.look_at(vr.global_position + Vector3(0.0, 0.0, 1.0), Vector3.UP)
		await _ticks(2)
		var toes: Vector3 = _toes_dir(m)
		_check(toes.z > 0.8, "%s faces where it aims (toes·aim = %.2f)" % [e.get("enemy_name"), toes.z])
		vr.global_transform = saved

	# Every gait and idle a character holds must loop, or the body freezes after one cycle (the
	# goblin's creep and the ogre's shamble shipped that way in LF-4).
	var held: Array[StringName] = [&"Idle", &"Idle_Torch", &"Sword_Idle", &"Idle_Shield", &"Walk", &"Jog_Fwd", &"Sprint",
		&"Crouch_Idle", &"Crouch_Fwd", &"Zombie_Idle", &"Zombie_Walk_Fwd", &"Zombie_Scratch", &"Push"]
	var lib: AnimationLibrary = SurvivorModel.shared_library()
	var one_shot: Array = held.filter(func(n: StringName) -> bool: return lib.get_animation(n).loop_mode != Animation.LOOP_LINEAR)
	_check(one_shot.is_empty(), "every walk and idle clip loops (one-shot: %s)" % str(one_shot))

	# A goblin's attack plays the jab; its death plays the death clip, and the body is not tipped flat.
	var goblin := EnemyGoblinScavenger.new()
	_main.add_child(goblin)
	goblin.global_position = OPEN + Vector3(3.0, 0.0, 0.0)
	await _ticks(2)
	goblin.state = EnemyGoblinScavenger.AIState.ATTACK_STARTUP
	goblin._state_timer = 0.56
	goblin._update_visual_telegraph()
	_check(goblin._model.current_animation() == &"Sword_Dash", "a goblin's attack plays the jab (got %s)" % goblin._model.current_animation())
	goblin.state = EnemyGoblinScavenger.AIState.IDLE
	goblin._hurtbox.receive_attack(CombatPayload.new(_player, _player.global_position, Vector3.RIGHT, 500.0, 10.0))
	await _ticks(2)
	_check(goblin.state == EnemyGoblinScavenger.AIState.DEAD and goblin._model.current_animation() == &"Death01"
		and absf(goblin._visual_root.rotation_degrees.x) < 1.0, "a goblin's death plays Death01 instead of tipping the body flat")
	goblin.queue_free()
	_reset_player(OPEN)
	await _ticks(2)

# ------------------------------------------------------------------------------
# Enemy temperaments: each enemy fights in its own way (attack style, aggression, power).
# Keep temperament helpers between this banner and the end of the file.
# ------------------------------------------------------------------------------
func _test_enemy_temperaments() -> void:
	var rig: IsoCameraRig = _player.camera_rig
	_player.camera_rig = null
	await _test_goblin_temperament()
	await _test_ork_temperament()
	await _test_ogre_temperament()
	await _test_attack_power()
	await _test_temperament_audit()
	_player.camera_rig = rig
	_reset_player(OPEN)
	await _ticks(2)

## A live goblin hunting the survivor, standing `offset` from them.
func _spawn_hunting_goblin(offset: Vector3) -> EnemyGoblinScavenger:
	var g := EnemyGoblinScavenger.new()
	g.audio = _player.audio
	g.player_ref = _player
	_main.add_child(g)
	g.global_position = _player.global_position + offset
	g.state = EnemyGoblinScavenger.AIState.IDLE
	g._state_timer = 99.0
	return g

func _test_goblin_temperament() -> void:
	_section("Enemy temperament: the goblin opportunist")
	_reset_player(OPEN)
	await _ticks(2)
	var g := _spawn_hunting_goblin(Vector3(4.0, 0.0, 0.0))
	await _ticks(2)
	_check(is_equal_approx(g.aggression, 0.3) and is_equal_approx(g.attack_power, 1.0),
		"goblin temperament: aggression 0.3, attack power 1.0 (%.2f, %.2f)" % [g.aggression, g.attack_power])

	# Openings: a turned back or a swing's recovery opens the survivor; facing it squarely doesn't.
	_face(Vector3.RIGHT)
	_check(not g.player_is_open(), "goblin: a survivor facing it, at rest, is not open")
	_face(Vector3.LEFT)
	_check(g.player_is_open(), "goblin: a survivor with their back turned is open")
	_face(Vector3.RIGHT)
	_player.current_state = PlayerController.ActionState.ATTACK_RECOVERY
	_check(g.player_is_open(), "goblin: a survivor recovering from a swing is open")
	_player.current_state = PlayerController.ActionState.IDLE

	# Patience follows aggression.
	g.aggression = 0.0
	g._reset_patience()
	var slow: float = g._patience
	g.aggression = 1.0
	g._reset_patience()
	_check(slow > 3.5 and g._patience < 1.5, "goblin: a timid one circles longer before losing patience (%.1f s vs %.1f s)" % [slow, g._patience])
	g.aggression = 0.3

	# The jab: weak from the front, double from behind the guard. (4 m away: the hitbox opens on nothing.)
	g.state = EnemyGoblinScavenger.AIState.ATTACK_STARTUP
	g._enter_attack_active()
	var front: float = g._hitbox._active_payload.physical_damage if g._hitbox._active_payload else -1.0
	g._hitbox.end_swing()
	_face(Vector3.LEFT)
	g.state = EnemyGoblinScavenger.AIState.ATTACK_STARTUP
	g._enter_attack_active()
	var back: float = g._hitbox._active_payload.physical_damage if g._hitbox._active_payload else -1.0
	var bleeds: bool = g._hitbox._active_payload != null and g._hitbox._active_payload.causes_bleed
	g._hitbox.end_swing()
	_check(is_equal_approx(front, EnemyGoblinScavenger.JAB_DAMAGE), "goblin: a jab from the front deals %.0f (got %.0f)" % [EnemyGoblinScavenger.JAB_DAMAGE, front])
	_check(is_equal_approx(back, front * EnemyGoblinScavenger.BACKSTAB_MULT), "goblin: a backstab deals double (%.0f)" % back)
	_check(bleeds, "goblin: the jab can still open a bleeding wound")
	_face(Vector3.RIGHT)

	# Hit and run: after the jab's recovery it skitters back out of reach, still facing the survivor.
	g.state = EnemyGoblinScavenger.AIState.ATTACK_RECOVERY
	g._state_timer = 0.02
	await _ticks(3)
	_check(g.state == EnemyGoblinScavenger.AIState.DISENGAGE, "goblin: after a jab it disengages (state=%s)" % EnemyGoblinScavenger.AIState.keys()[g.state])
	var d0: float = g.global_position.distance_to(_player.global_position)
	await _seconds(0.4)
	_check(g.global_position.distance_to(_player.global_position) > d0 + 0.8, "goblin: disengaging backs it away (%.1f m -> %.1f m)" % [d0, g.global_position.distance_to(_player.global_position)])
	_check(g._facing_dir.dot((_player.global_position - g.global_position).normalized()) > 0.7, "goblin: it backs away still facing the survivor")
	_check(g._model.anim.speed_scale < 0.0 and g._model.current_animation() == &"Crouch_Fwd", "goblin: backing away plays the crouched walk in reverse")
	var pos_a: float = g._model.anim.current_animation_position
	await _ticks(3)
	var pos_b: float = g._model.anim.current_animation_position
	_check(g._model.anim.is_playing() and not is_equal_approx(pos_a, pos_b) and (pos_b < pos_a or pos_b > pos_a + 1.0),
		"goblin: the reversed walk actually runs backwards (%.2f s -> %.2f s)" % [pos_a, pos_b])
	g.queue_free()
	await _ticks(2)

	# Stones: at range and in sight it throws one, which flies, strikes once and is gone.
	_reset_player(OPEN)
	await _ticks(2)
	var thrower := _spawn_hunting_goblin(Vector3(7.0, 0.0, 0.0))
	await _ticks(2)
	_check(thrower._try_begin_throw(7.0) and thrower.state == EnemyGoblinScavenger.AIState.THROW_STARTUP,
		"goblin: at 7 m it winds up a throw")
	_check(not thrower._try_begin_throw(7.0), "goblin: and must rest its arm before the next one")
	var coord: EncounterCoordinator = _children_of(func(n: Node) -> bool: return n is EncounterCoordinator)[0]
	var taker := Node3D.new()
	_main.add_child(taker)
	coord._active_holders.clear()
	coord._cooldown_timer = 0.0
	coord.request_attack_token(taker)
	var waiting := _spawn_hunting_goblin(Vector3(0.0, 0.0, 7.0))
	waiting.coordinator = coord
	await _ticks(1)
	_check(not waiting._try_begin_throw(7.0), "goblin: a throw waits its turn while another enemy attacks")
	coord.release_attack_token(taker)
	coord._active_holders.clear()
	coord._cooldown_timer = 0.0
	waiting.queue_free()
	taker.queue_free()
	thrower._update_visual_telegraph()
	_check(thrower._model.current_animation() == &"OverhandThrow", "goblin: the throw plays the overhand throw")
	var hp: float = _player.health
	var saw_stone: bool = false
	for i in range(int(2.0 * Engine.physics_ticks_per_second)):
		await _ticks(1)
		saw_stone = saw_stone or not _main.find_children("ThrownStone*", "", false, false).is_empty()
		if _player.health < hp:
			break
	_check(saw_stone, "goblin: the throw releases a stone")
	_check(is_equal_approx(hp - _player.health, EnemyGoblinScavenger.STONE_DAMAGE),
		"goblin: the stone strikes the survivor for %.0f (took %.1f)" % [EnemyGoblinScavenger.STONE_DAMAGE, hp - _player.health])
	await _ticks(2)
	_check(_main.find_children("ThrownStone*", "", false, false).is_empty(), "goblin: a stone that hits is gone")
	thrower.queue_free()

	# A stone thrown at stone stops there.
	var wall := StaticBody3D.new()
	var wc := CollisionShape3D.new()
	var wb := BoxShape3D.new()
	wb.size = Vector3(0.4, 3.0, 4.0)
	wc.shape = wb
	wall.add_child(wc)
	_main.add_child(wall)
	wall.global_position = OPEN + Vector3(-3.0, 1.5, 6.0)
	var lone := ThrownStone.launch(_main, OPEN + Vector3(0.0, 1.0, 6.0), Vector3.LEFT,
		CombatPayload.new(_main, OPEN, Vector3.LEFT, 1.0, 1.0))
	await _seconds(0.5)
	_check(not is_instance_valid(lone), "goblin: a stone that meets a wall stops there")
	wall.queue_free()
	_reset_player(OPEN)
	await _ticks(2)

func _test_ork_temperament() -> void:
	_section("Enemy temperament: the ork soldier")
	_reset_player(OPEN)
	await _ticks(2)
	var orks: Array = _children_of(func(n: Node) -> bool: return n is EnemyOrkWarrior)
	var shielded: Array = orks.filter(func(o: EnemyOrkWarrior) -> bool: return o.has_shield)
	var cleavers: Array = orks.filter(func(o: EnemyOrkWarrior) -> bool: return not o.has_shield)
	_check(not shielded.is_empty() and is_equal_approx(shielded[0].aggression, 0.5) and is_equal_approx(shielded[0].recovery_scale(), 1.0),
		"ork: the shield ork is the steady baseline (aggression 0.5, recovery x1.0)")
	_check(not cleavers.is_empty() and cleavers[0].aggression > 0.7 and cleavers[0].recovery_scale() < 0.85,
		"ork: the shieldless cleaver is reckless (aggression %.2f, recovery x%.2f)" % [cleavers[0].aggression if not cleavers.is_empty() else 0.0, cleavers[0].recovery_scale() if not cleavers.is_empty() else 0.0])

	var o := EnemyOrkWarrior.new()
	o.has_shield = true
	o.audio = _player.audio
	o.player_ref = _player
	_main.add_child(o)
	o.global_position = _player.global_position + Vector3(1.5, 0.0, 0.0)
	o._facing_dir = Vector3.LEFT
	o._visual_root.look_at(o.global_position + o._facing_dir, Vector3.UP)
	o.state = EnemyOrkWarrior.AIState.IDLE
	o._state_timer = 99.0
	await _ticks(2)

	# A survivor facing it without a guard raised gives it no reason to bash.
	_face(Vector3.RIGHT)
	o._turtle_timer = 0.0
	o._watch_for_raised_guard(1.0)
	_check(is_zero_approx(o._turtle_timer), "ork: no raised guard, no patience lost")

	# Hide behind the targe in front of it and it bashes the guard aside. (Earlier sections may have
	# left a two-handed weapon or the torch in hand: hold the targe in a free off hand for this.)
	var inv: Inventory = _player.inventory
	var saved_main: ItemInstance = inv.main_hand
	var saved_off: ItemInstance = inv.off_hand
	if inv.main_hand != null and inv.main_hand.data.two_handed:
		inv.main_hand = null
	var targe: ItemInstance = inv.find_first("wooden_targe")
	if targe != null:
		targe.condition = maxf(targe.condition, 60.0)
		inv.off_hand = targe
	_check(_player._has_ready_shield(), "ork: (setup) the survivor has the targe ready")
	Input.action_press("block")
	await _ticks(3)
	_face(Vector3.RIGHT)
	_check(_player.current_state == PlayerController.ActionState.BLOCK, "ork: (setup) the survivor holds a guard (state=%s)" % PlayerController.ActionState.keys()[_player.current_state])
	o._watch_for_raised_guard(0.5)
	_check(o._turtle_timer > 0.4, "ork: it notices a guard raised in front of it")
	o._turtle_timer = 5.0
	o.state = EnemyOrkWarrior.AIState.SHIELD_ADVANCE
	o._has_last_known_pos = true
	o._last_known_player_pos = _player.global_position
	var hp: float = _player.health
	var stam: float = _player.stamina
	var saw_bash: bool = false
	var was_bashed: bool = false
	for i in range(int(1.5 * Engine.physics_ticks_per_second)):
		await _ticks(1)
		_face(Vector3.RIGHT)
		saw_bash = saw_bash or o.state == EnemyOrkWarrior.AIState.BASH_STARTUP
		if _player.current_state == PlayerController.ActionState.STAGGER:
			was_bashed = true
			break
	Input.action_release("block")
	_check(saw_bash, "ork: a guard held too long draws the shield bash")
	_check(was_bashed, "ork: the bash knocks the guard aside and staggers the survivor")
	_check(is_equal_approx(_player.health, hp), "ork: the blocked bash costs no health (%.0f -> %.0f)" % [hp, _player.health])
	_check(_player.stamina < stam, "ork: but it costs stamina (%.0f -> %.0f)" % [stam, _player.stamina])
	o._update_visual_telegraph()
	o.queue_free()
	inv.main_hand = saved_main
	inv.off_hand = saved_off
	inv.notify_changed()
	_reset_player(OPEN)
	await _ticks(2)

## A live ogre at `offset` from the survivor, facing them, mid-chase with its charge ready.
func _spawn_charging_ogre(offset: Vector3) -> EnemyOgreBrute:
	var ogre := EnemyOgreBrute.new()
	_main.add_child(ogre)
	ogre.audio = _player.audio
	await _pose_ogre(ogre, _player.global_position + offset, -offset)
	ogre.player_ref = _player
	ogre.state = EnemyOgreBrute.AIState.PURSUE
	ogre._pursuit_time = 2.0
	ogre._charge_cooldown = 0.0
	ogre.process_mode = Node.PROCESS_MODE_INHERIT
	return ogre

func _wait_ogre_state(ogre: EnemyOgreBrute, wanted: EnemyOgreBrute.AIState, secs: float) -> bool:
	for i in range(int(secs * Engine.physics_ticks_per_second)):
		if ogre.state == wanted:
			return true
		await _ticks(1)
	return ogre.state == wanted

func _test_ogre_temperament() -> void:
	_section("Enemy temperament: the ogre juggernaut")
	_reset_player(OGRE_YARD)
	await _ticks(2)
	var probe := EnemyOgreBrute.new()
	_main.add_child(probe)
	probe.process_mode = Node.PROCESS_MODE_DISABLED
	_check(is_equal_approx(probe.aggression, 0.8) and is_equal_approx(probe.leash_distance(), 20.0),
		"ogre temperament: aggression 0.8 keeps the 20 m chase (%.1f m)" % probe.leash_distance())
	var calm_cd: float = probe.charge_cooldown_time()

	# It doesn't flinch mid-windup: poise damage counts for x0.35 while it winds up.
	probe.state = EnemyOgreBrute.AIState.SLAM_STARTUP
	probe._hurtbox.receive_attack(CombatPayload.new(_player, _player.global_position, Vector3.RIGHT, 1.0, 50.0))
	var armoured: float = probe.poise_damage
	probe.state = EnemyOgreBrute.AIState.IDLE
	probe.poise_damage = 0.0
	probe._hurtbox.receive_attack(CombatPayload.new(_player, _player.global_position, Vector3.RIGHT, 1.0, 50.0))
	_check(is_equal_approx(armoured, 50.0 * EnemyOgreBrute.WINDUP_POISE_MULT) and is_equal_approx(probe.poise_damage, 50.0),
		"ogre: a blow during its windup barely rocks it (%.1f poise vs %.1f at rest)" % [armoured, probe.poise_damage])
	probe.poise_damage = 0.0

	# Enraged below 40% health: quicker to swing and to charge again, and it says so.
	var banners: Array[String] = []
	probe.ogre_event_banner.connect(func(txt: String, _c: Color) -> void: banners.append(txt))
	probe.health = probe.max_health * 0.45
	probe._hurtbox.receive_attack(CombatPayload.new(_player, _player.global_position, Vector3.RIGHT, 30.0, 1.0))
	_check(probe.enraged and banners.any(func(t: String) -> bool: return t.contains("enraged")), "ogre: below 40% health it is enraged")
	probe._begin_committed_attack(Vector3.LEFT)
	_check(probe._state_timer <= 1.12 * EnemyOgreBrute.ENRAGE_STARTUP_MULT + 0.001, "ogre: enraged, it winds up faster (%.2f s)" % probe._state_timer)
	_check(probe.charge_cooldown_time() < calm_cd, "ogre: enraged, it charges again sooner (%.1f s vs %.1f s)" % [probe.charge_cooldown_time(), calm_cd])
	probe.queue_free()

	# 1) The charge: at 8 m in the open it lowers its head, then hits a survivor who stands there.
	_reset_player(OGRE_YARD)
	await _ticks(2)
	var ogre: EnemyOgreBrute = await _spawn_charging_ogre(Vector3(8.0, 0.0, 0.0))
	_check(await _wait_ogre_state(ogre, EnemyOgreBrute.AIState.CHARGE_STARTUP, 1.0), "ogre: at 8 m it braces to charge")
	ogre._update_visual_telegraph()
	_check(ogre._model.current_animation() == &"Push", "ogre: bracing plays the shove (got %s)" % ogre._model.current_animation())
	var hp: float = _player.health
	for i in range(int(3.0 * Engine.physics_ticks_per_second)):
		await _ticks(1)
		if _player.health < hp or ogre.state == EnemyOgreBrute.AIState.LONG_RECOVERY:
			break
	_check(is_equal_approx(hp - _player.health, EnemyOgreBrute.CHARGE_DAMAGE),
		"ogre: the charge hits a survivor who stands still for %.0f (took %.1f)" % [EnemyOgreBrute.CHARGE_DAMAGE, hp - _player.health])
	_check(_player.current_state == PlayerController.ActionState.STAGGER, "ogre: and knocks them reeling")
	_check(await _wait_ogre_state(ogre, EnemyOgreBrute.AIState.LONG_RECOVERY, 2.0) and not ogre._charge_hitbox._is_swing_active,
		"ogre: after the charge it recovers, its charge hitbox closed")
	ogre.queue_free()
	await _ticks(2)

	# 2) Sidestep with a wall behind you: it thunders past and crashes into the stone, dazed.
	_reset_player(OGRE_YARD)
	await _ticks(2)
	var wall := _make_ogre_test_wall(OGRE_YARD + Vector3(-2.5, 1.25, 0.0), Vector3(0.4, 2.5, 8.0))
	ogre = await _spawn_charging_ogre(Vector3(8.0, 0.0, 0.0))
	_check(await _wait_ogre_state(ogre, EnemyOgreBrute.AIState.CHARGE_ACTIVE, 2.0), "ogre: (setup) the charge is under way")
	_player.global_position += Vector3(0.0, 0.0, 3.5)
	hp = _player.health
	var crashed: bool = await _wait_ogre_state(ogre, EnemyOgreBrute.AIState.RECOIL, 2.0)
	_check(is_equal_approx(_player.health, hp), "ogre: a sidestep makes the charge miss (it cannot steer)")
	_check(crashed and ogre.is_staggered() and ogre._state_timer > 1.5,
		"ogre: it crashes into the wall behind and reels (state=%s, %.1f s)" % [EnemyOgreBrute.AIState.keys()[ogre.state], ogre._state_timer])
	ogre.queue_free()

	# 3b) A knee-high crate in the lane, or a doorway narrower than its shoulders, also stops the
	#     charge before it starts; the chest-height ray alone looked over both.
	_reset_player(OGRE_YARD)
	await _ticks(2)
	var crate := _make_ogre_test_wall(OGRE_YARD + Vector3(4.0, 0.3, 0.0), Vector3(0.9, 0.6, 0.9))
	var lane_ogre := EnemyOgreBrute.new()
	_main.add_child(lane_ogre)
	await _pose_ogre(lane_ogre, OGRE_YARD + Vector3(8.0, 0.0, 0.0), Vector3.LEFT)
	lane_ogre.player_ref = _player
	lane_ogre._pursuit_time = 2.0
	lane_ogre._visual_root.visible = true
	_check(not lane_ogre._try_begin_charge(8.0, Vector3.LEFT), "ogre: a knee-high crate in the lane stops the charge")
	crate.queue_free()
	await _ticks(2)
	var jamb_a := _make_ogre_test_wall(OGRE_YARD + Vector3(4.0, 1.5, 1.4), Vector3(0.4, 3.0, 1.5))
	var jamb_b := _make_ogre_test_wall(OGRE_YARD + Vector3(4.0, 1.5, -1.4), Vector3(0.4, 3.0, 1.5))
	await _ticks(2)
	_check(not lane_ogre._try_begin_charge(8.0, Vector3.LEFT), "ogre: a 1.3 m doorway (narrower than its shoulders) stops the charge")
	jamb_a.queue_free()
	jamb_b.queue_free()
	await _ticks(2)
	_check(lane_ogre._try_begin_charge(8.0, Vector3.LEFT) and lane_ogre.state == EnemyOgreBrute.AIState.CHARGE_STARTUP,
		"ogre: with the lane clear again it charges")
	lane_ogre.queue_free()

	# 3) With a wall between, it doesn't charge at all.
	_reset_player(OGRE_YARD)
	await _ticks(2)
	ogre = EnemyOgreBrute.new()
	_main.add_child(ogre)
	await _pose_ogre(ogre, OGRE_YARD + Vector3(-7.0, 0.0, 0.0), Vector3.RIGHT)
	ogre.player_ref = _player
	ogre._pursuit_time = 2.0
	ogre._visual_root.visible = true
	_check(not ogre._try_begin_charge(7.0, Vector3.RIGHT), "ogre: it won't charge with a wall in the way")
	ogre.queue_free()
	wall.queue_free()
	_reset_player(OPEN)
	await _ticks(2)

## attack_power scales every blow each enemy deals (checked on the payload each attack builds).
func _test_attack_power() -> void:
	_section("Enemy temperament: attack power")
	_reset_player(OPEN)
	await _ticks(2)
	var g := _spawn_hunting_goblin(Vector3(4.0, 0.0, 0.0))
	await _ticks(2)
	_face(Vector3.RIGHT)
	g.attack_power = 1.5
	g.state = EnemyGoblinScavenger.AIState.ATTACK_STARTUP
	g._enter_attack_active()
	var jab: float = g._hitbox._active_payload.physical_damage
	g._hitbox.end_swing()
	g.queue_free()
	var o := EnemyOrkWarrior.new()
	_main.add_child(o)
	o.process_mode = Node.PROCESS_MODE_DISABLED
	o.global_position = OGRE_YARD  # open ground: the slash must not clang
	o.attack_power = 1.5
	var ork: Array[float] = []
	for f: Callable in [o._enter_combo_1_active, o._enter_combo_2_active, o._enter_bash_active]:
		f.call()
		ork.append(o._hitbox._active_payload.physical_damage if o._hitbox._active_payload else -1.0)
		o._hitbox.end_swing()
	o.queue_free()
	var ogre := EnemyOgreBrute.new()
	_main.add_child(ogre)
	ogre.process_mode = Node.PROCESS_MODE_DISABLED
	ogre.global_position = OGRE_YARD
	ogre.attack_power = 1.5
	ogre._enter_slam_active()
	var slam: float = ogre._hitbox._active_payload.physical_damage
	ogre._hitbox.end_swing()
	ogre._enter_charge_active()
	var charge: float = ogre._charge_hitbox._active_payload.physical_damage
	ogre._charge_hitbox.end_swing()
	ogre.queue_free()
	_check(is_equal_approx(jab, EnemyGoblinScavenger.JAB_DAMAGE * 1.5), "attack power 1.5: goblin jab %.0f" % jab)
	_check(is_equal_approx(ork[0], EnemyOrkWarrior.SLASH_DAMAGE * 1.5) and is_equal_approx(ork[1], EnemyOrkWarrior.CHOP_DAMAGE * 1.5)
		and is_equal_approx(ork[2], EnemyOrkWarrior.BASH_DAMAGE * 1.5), "attack power 1.5: ork slash, chop, bash %s" % str(ork))
	_check(is_equal_approx(slam, EnemyOgreBrute.SLAM_DAMAGE * 1.5) and is_equal_approx(charge, EnemyOgreBrute.CHARGE_DAMAGE * 1.5),
		"attack power 1.5: ogre slam %.0f, charge %.0f" % [slam, charge])
	await _ticks(2)

## Fixes from the temperament audit: enemies stand down when the survivor dies, a goblin's
## attack is knocked out by any blow, the backstab bark waits for a hit, a dart that finds the
## turn taken circles before retrying, and the ogre's charge waits its turn.
func _test_temperament_audit() -> void:
	_section("Enemy temperament: audit fixes")
	var coord: EncounterCoordinator = _children_of(func(n: Node) -> bool: return n is EncounterCoordinator)[0]
	coord._active_holders.clear()
	coord._cooldown_timer = 0.0
	_reset_player(OPEN)
	await _ticks(2)
	_face(Vector3.LEFT)

	# A backstab that hits nothing doesn't bark (4 m away: the jab lands on air).
	var g := _spawn_hunting_goblin(Vector3(4.0, 0.0, 0.0))
	g.coordinator = coord
	var barks: Array[String] = []
	g.goblin_combat_bark.connect(func(m: String) -> void: barks.append(m))
	await _ticks(2)
	g.state = EnemyGoblinScavenger.AIState.ATTACK_STARTUP
	g._enter_attack_active()
	await _ticks(3)
	g._hitbox.end_swing()
	_check(barks.is_empty(), "audit: a backstab that misses says nothing (%s)" % str(barks))

	# Any blow knocks a goblin out of its windup, and the jab never opens.
	_face(Vector3.RIGHT)
	g.state = EnemyGoblinScavenger.AIState.IDLE
	g._state_timer = 99.0
	_check(g._try_begin_attack_windup(), "audit: (setup) goblin winds up a jab")
	g._hurtbox.receive_attack(CombatPayload.new(_player, _player.global_position, Vector3.RIGHT, 1.0, 1.0))
	var opened: bool = false
	for i in range(int(0.6 * Engine.physics_ticks_per_second)):
		await _ticks(1)
		opened = opened or g._hitbox._is_swing_active
	_check(not opened, "audit: a light blow knocks the goblin out of its jab")
	_check(not coord._active_holders.has(g.get_instance_id()), "audit: and it holds no attack turn")

	# A dart that finds the turn taken backs off and circles before trying again.
	var taker := Node3D.new()
	_main.add_child(taker)
	coord.request_attack_token(taker)
	g.global_position = _player.global_position + Vector3(1.6, 0.0, 0.0)
	g._has_last_known_pos = true
	g._last_known_player_pos = _player.global_position
	g._committed = true
	g.state = EnemyGoblinScavenger.AIState.PURSUE
	await _ticks(2)
	_check(g.state == EnemyGoblinScavenger.AIState.FLANK and g._recommit_delay > 0.5 and not g._committed,
		"audit: turn taken, the dart breaks off to circle (state=%s, delay %.2f s)" % [EnemyGoblinScavenger.AIState.keys()[g.state], g._recommit_delay])

	# The ogre's charge waits its turn too.
	var ogre: EnemyOgreBrute = await _spawn_charging_ogre(Vector3(8.0, 0.0, 0.0))
	ogre.coordinator = coord
	ogre.process_mode = Node.PROCESS_MODE_DISABLED
	ogre._visual_root.visible = true
	_check(not ogre._try_begin_charge(8.0, Vector3.LEFT), "audit: the ogre won't charge while another enemy has the turn")
	coord.release_attack_token(taker)
	coord._active_holders.clear()
	coord._cooldown_timer = 0.0
	ogre.enraged = true
	_check(ogre.leash_distance() > 20.0, "audit: enraged, the ogre chases further (%.1f m)" % ogre.leash_distance())
	ogre.queue_free()
	taker.queue_free()

	# When the survivor dies, goblins and orks stop attacking the body and go back to patrol.
	var o := EnemyOrkWarrior.new()
	o.has_shield = true
	o.audio = _player.audio
	o.player_ref = _player
	o.coordinator = coord
	_main.add_child(o)
	o.global_position = _player.global_position + Vector3(-1.5, 0.0, 0.0)
	await _ticks(2)
	g.state = EnemyGoblinScavenger.AIState.ATTACK_STARTUP
	coord.request_attack_token(g)
	o.state = EnemyOrkWarrior.AIState.COMBO_1_STARTUP
	_player.current_state = PlayerController.ActionState.DEAD
	await _ticks(3)
	_check(g.state in [EnemyGoblinScavenger.AIState.PATROL, EnemyGoblinScavenger.AIState.IDLE] and not g._has_last_known_pos and not g._hitbox._is_swing_active,
		"audit: survivor dead, the goblin stands down (state=%s)" % EnemyGoblinScavenger.AIState.keys()[g.state])
	_check(o.state in [EnemyOrkWarrior.AIState.PATROL, EnemyOrkWarrior.AIState.IDLE] and not o._hitbox._is_swing_active,
		"audit: survivor dead, the ork stands down (state=%s)" % EnemyOrkWarrior.AIState.keys()[o.state])
	_check(coord._active_holders.is_empty(), "audit: and both hand back the attack turn")
	g.queue_free()
	o.queue_free()
	coord._active_holders.clear()
	coord._cooldown_timer = 0.0
	_reset_player(OPEN)
	await _ticks(2)

# ------------------------------------------------------------------------------
# Perception: the survivor's 130-degree vision cone, cut by walls, and the acoustic ripples that
# show unseen noises. Presentation only: nothing here changes a hit or an enemy's senses.
# ------------------------------------------------------------------------------
func _count_nodes(group: String) -> int:
	return get_nodes_in_group(group).size()

## Ripples and marks left by earlier sections (they fade on their own) must not skew a count.
func _clear_perception_leftovers() -> void:
	for n: Node in get_nodes_in_group("acoustic_ripple") + get_nodes_in_group("last_seen_mark"):
		n.queue_free()
	await _ticks(1)

func _test_perception() -> void:
	_section("Perception: vision cone and acoustic ripples")
	var rig: IsoCameraRig = _player.camera_rig
	_player.camera_rig = null
	_reset_player(OPEN)
	await _ticks(2)
	var per: Perception = _player.perception
	await _clear_perception_leftovers()
	_check(per != null and per.enabled and is_equal_approx(Perception.CONE_DEGREES, 130.0), "the survivor has a 130-degree vision cone, on by default")
	_check(_main.find_children("VisionConeOverlay", "", false, false).size() == 1, "the charcoal overlay is in the scene")

	# The cone around the aim.
	_face(Vector3.RIGHT)
	_check(per.in_cone(OPEN + Vector3(5.0, 0.0, 0.0)), "straight ahead is in the cone")
	_check(per.in_cone(OPEN + Vector3(5.0, 0.0, 5.0)), "45 degrees off the aim is in the cone")
	_check(not per.in_cone(OPEN + Vector3(0.0, 0.0, 5.0)), "90 degrees off the aim is outside it")
	_check(not per.in_cone(OPEN + Vector3(-5.0, 0.0, 0.0)), "behind the survivor is outside it")

	# An enemy is drawn only while seen; slipping out of sight leaves one charcoal mark.
	var g := _spawn_hunting_goblin(Vector3(4.0, 0.0, 0.0))
	g.process_mode = Node.PROCESS_MODE_DISABLED
	await _ticks(1)
	_check(per.update_visibility(g, g._visual_root, 0.95) and g._visual_root.visible, "a goblin 4 m ahead is drawn")
	_face(Vector3.LEFT)
	var marks: int = _count_nodes("last_seen_mark")
	_check(not per.update_visibility(g, g._visual_root, 0.95) and not g._visual_root.visible, "turn your back and it is no longer drawn")
	_check(_count_nodes("last_seen_mark") == marks + 1, "a charcoal mark is left where it was last seen")
	per.update_visibility(g, g._visual_root, 0.95)
	_check(_count_nodes("last_seen_mark") == marks + 1, "staying unseen leaves no second mark")
	_face(Vector3.RIGHT)
	_check(per.update_visibility(g, g._visual_root, 0.95), "turn back and it is drawn again")
	var wall := _make_ogre_test_wall(OPEN + Vector3(2.0, 1.25, 0.0), Vector3(0.4, 2.5, 3.0))
	await _ticks(1)
	_check(not per.update_visibility(g, g._visual_root, 0.95), "a wall between hides it even inside the cone")
	wall.queue_free()
	await _ticks(1)
	per.enabled = false
	_face(Vector3.LEFT)
	_check(per.update_visibility(g, g._visual_root, 0.95), "cone off (F4): line of sight alone, a goblin behind you is drawn")
	per.enabled = true
	_face(Vector3.RIGHT)
	per.update_visibility(g, g._visual_root, 0.95)
	_face(Vector3.LEFT)
	marks = _count_nodes("last_seen_mark")
	per.update_visibility(g, g._visual_root, 0.95, false)
	_check(_count_nodes("last_seen_mark") == marks, "a corpse slipping out of sight leaves no mark")

	# Noises: heard within their loudness, ripples only for what you cannot see.
	_face(Vector3.RIGHT)
	var heard: Array[float] = []
	var on_heard := func(_p: Vector3, l: float) -> void: heard.append(l)
	per.heard.connect(on_heard)
	var ripples: int = _count_nodes("acoustic_ripple")
	_check(per.report_noise(OPEN + Vector3(4.0, 0.0, 0.0), 8.0, g) and heard.is_empty() and _count_nodes("acoustic_ripple") == ripples,
		"a noise where you can see raises no ripple")
	_check(per.report_noise(OPEN + Vector3(-4.0, 0.0, 0.0), 8.0, g) and heard.size() == 1 and _count_nodes("acoustic_ripple") == ripples + 1,
		"a noise behind you raises a ripple and the cue")
	var ring: AcousticRipple = get_nodes_in_group("acoustic_ripple").back()
	_check(ring.global_position.distance_to(OPEN + Vector3(-4.0, 0.03, 0.0)) < 0.05, "the ripple sits where the noise was")
	_check(per.report_noise(OPEN + Vector3(-4.0, 0.0, 0.0), 8.0, g) and _count_nodes("acoustic_ripple") == ripples + 1,
		"one source cannot carpet the ground: one ripple per %.2f s" % Perception.RIPPLE_GAP)
	var loud := AcousticRipple.spawn(_main, OPEN + Vector3(-6.0, 0.0, 0.0), 30.0)
	var quiet := AcousticRipple.spawn(_main, OPEN + Vector3(-6.0, 0.0, 2.0), 5.0)
	_check(loud.scale.x > quiet.scale.x * 2.0, "a louder noise makes a larger ring (%.2f vs %.2f)" % [loud.scale.x, quiet.scale.x])
	_check(not per.report_noise(OPEN + Vector3(-12.0, 0.0, 0.0), 8.0, null), "a noise beyond its loudness is not heard")
	var muffle := _make_ogre_test_wall(OPEN + Vector3(-3.0, 1.25, 0.0), Vector3(0.4, 2.5, 4.0))
	await _ticks(1)
	_check(not per.report_noise(OPEN + Vector3(-6.0, 0.0, 0.0), 8.0, null), "an 8 m noise 6 m away through a wall is muffled out of hearing")
	muffle.queue_free()
	await _ticks(1)
	_check(per.report_noise(OPEN + Vector3(-6.0, 0.0, 0.0), 8.0, null), "the same noise with no wall is heard")
	await _seconds(0.3)
	ripples = _count_nodes("acoustic_ripple")
	g.global_position = OPEN + Vector3(-4.0, 0.0, 0.0)
	for i in range(30):
		per.report_footsteps(g, 1.0 / 60.0, 3.4, 1.1, 8.0)
	_check(_count_nodes("acoustic_ripple") == ripples + 1, "half a second of jogging at 3.4 m/s is one footstep ripple at a 1.1 m stride")
	await _seconds(1.5)
	_check(_count_nodes("acoustic_ripple") == 0, "ripples fade and clean themselves up")
	per.heard.disconnect(on_heard)
	g.queue_free()
	await _ticks(2)

	# Live enemies report: a jogging ork behind you is unseen but heard, step by step.
	_reset_player(OPEN)
	await _ticks(2)
	await _clear_perception_leftovers()
	_face(Vector3.RIGHT)
	var o := EnemyOrkWarrior.new()
	o.has_shield = false
	o.audio = _player.audio
	o.player_ref = _player
	_main.add_child(o)
	o.global_position = OPEN + Vector3(-7.0, 0.0, 0.0)
	o.state = EnemyOrkWarrior.AIState.PURSUE
	o._has_last_known_pos = true
	o._last_known_player_pos = OPEN + Vector3(-9.0, 0.0, 0.0)
	await _seconds(0.6)
	_check(not o._visual_root.visible, "a live ork behind you is not drawn")
	_check(_count_nodes("acoustic_ripple") >= 1, "its footsteps raise ripples (%d)" % _count_nodes("acoustic_ripple"))
	o.queue_free()

	# The cone is the survivor's sight, not the enemies': an ogre behind you still spots you.
	var ogre := EnemyOgreBrute.new()
	_main.add_child(ogre)
	ogre.audio = _player.audio
	await _pose_ogre(ogre, OPEN + Vector3(-8.0, 0.0, 0.0), Vector3.RIGHT)
	ogre.player_ref = _player
	ogre.process_mode = Node.PROCESS_MODE_INHERIT
	await _ticks(3)
	_check(ogre.state == EnemyOgreBrute.AIState.PURSUE and not ogre._visual_root.visible,
		"an unseen ogre behind you still spots you with its own eyes (state=%s)" % EnemyOgreBrute.AIState.keys()[ogre.state])
	ogre.queue_free()
	await _seconds(1.2)
	_player.camera_rig = rig
	_reset_player(OPEN)
	await _ticks(2)

# ------------------------------------------------------------------------------
# Weather: six conditions that change sight, hearing, fire, footing and the look of the night.
# ------------------------------------------------------------------------------
func _test_weather() -> void:
	_section("Weather: the Smothering's six conditions")
	var rig: IsoCameraRig = _player.camera_rig
	_player.camera_rig = null
	_reset_player(OPEN)
	await _ticks(2)
	var ws: Array = _children_of(func(n: Node) -> bool: return n is Weather)
	_check(ws.size() == 1, "the yard has one Weather")
	var w: Weather = ws[0]
	w.cycling = false
	var env: Environment = (_children_of(func(n: Node) -> bool: return n is WorldEnvironment)[0] as WorldEnvironment).environment
	var ash: AshFall = _children_of(func(n: Node) -> bool: return n is AshFall)[0]
	var fire: FlickerLight = _main.find_child("ShelterFireLight", true, false) as FlickerLight
	var per: Perception = _player.perception
	_check(w.current == Weather.Condition.ASHFALL and is_equal_approx(env.fog_density, 0.012) and is_equal_approx(per.hearing, 1.0),
		"it starts in ashfall: the ordinary night, fog 0.012, hearing x1")
	var base_fire: float = fire.base_energy
	var changes: Array[String] = []
	var on_change := func(_c: Weather.Condition, banner: String) -> void: changes.append(banner)
	w.changed.connect(on_change)

	# Miasma: thick fog, short sight, deadened hearing. Dead Calm: the opposite.
	w.set_condition(Weather.Condition.MIASMA_FOG, true)
	_check(is_equal_approx(env.fog_density, 0.055) and is_equal_approx(per.sight_range, 7.0) and is_equal_approx(per.hearing, 0.7),
		"miasma: fog 0.055, sight 7 m, hearing x0.7")
	_check(changes.size() == 1 and changes[0].begins_with("The miasma"), "a change announces itself")
	_check(_hud._weather_label.text.ends_with("Miasma fog"), "the HUD names the weather (%s)" % _hud._weather_label.text)
	_face(Vector3.RIGHT)
	var g := _spawn_hunting_goblin(Vector3(9.0, 0.0, 0.0))
	g.process_mode = Node.PROCESS_MODE_DISABLED
	g._facing_dir = Vector3.RIGHT  # looking away: it cannot see the survivor, only hear them
	await _ticks(1)
	_check(not per.update_visibility(g, g._visual_root, 0.95), "miasma: a goblin 9 m ahead, in the cone, is lost in the fog")
	_check(not per.report_noise(OPEN + Vector3(-9.0, 0.0, 0.0), 8.0, null), "miasma: an 8 m noise 9 m away is not heard (reach 5.6 m)")
	_player.current_state = PlayerController.ActionState.SPRINT
	g._evaluate_senses(1.0 / 60.0)
	_check(g.state == EnemyGoblinScavenger.AIState.IDLE, "miasma: a goblin 9 m away does not hear you sprint (9 x 0.7 = 6.3 m)")
	w.set_condition(Weather.Condition.DEAD_CALM, true)
	_check(per.update_visibility(g, g._visual_root, 0.95), "dead calm: the same goblin is seen")
	_check(per.report_noise(OPEN + Vector3(-9.0, 0.0, 0.0), 8.0, null), "dead calm: the same noise is heard (reach 12.8 m)")
	g._evaluate_senses(1.0 / 60.0)
	_check(g.state == EnemyGoblinScavenger.AIState.INVESTIGATE, "dead calm: the goblin hears you sprint from 9 m (9 x 1.6 = 14.4 m)")
	_check(not ash.visible, "dead calm: nothing falls")
	_player.current_state = PlayerController.ActionState.IDLE
	g.queue_free()

	# Sleet: the torch burns faster, the fire dims, footing goes. Hoarfrost: ice, bright moon.
	w.set_condition(Weather.Condition.SLEET, true)
	_check(is_equal_approx(_player.weather_torch_burn, 1.8) and absf(fire.base_energy - base_fire * 0.75) < 0.001,
		"sleet: the torch burns x1.8 and the shelter fire dims to x0.75")
	_check(ash.visible and (ash.material_override as ShaderMaterial).get_shader_parameter("fall_speed") > 2.0, "sleet: fast pale streaks fall")
	Input.action_press("move_right")
	await _ticks(20)
	var sleet_speed: float = Vector2(_player.velocity.x, _player.velocity.z).length()
	w.set_condition(Weather.Condition.ASHFALL, true)
	await _ticks(20)
	var dry_speed: float = Vector2(_player.velocity.x, _player.velocity.z).length()
	Input.action_release("move_right")
	await _ticks(2)
	_check(absf(dry_speed - _player.move_speed) < 0.2 and absf(sleet_speed - _player.move_speed * 0.85) < 0.2,
		"sleet: walking drops to 85%% (%.2f m/s vs %.2f dry)" % [sleet_speed, dry_speed])
	w.set_condition(Weather.Condition.HOARFROST, true)
	var moon: DirectionalLight3D = _main.find_child("Moon", false, false) as DirectionalLight3D
	_check(is_equal_approx(_player.weather_footing, 0.8) and moon.light_energy > 3.5 and is_equal_approx(per.hearing, 1.25),
		"hoarfrost: footing x0.8, a hard bright moon, hearing x1.25")

	# Blends: a change drifts in over 8 s instead of snapping.
	w.set_condition(Weather.Condition.DEAD_CALM, true)
	w.set_condition(Weather.Condition.MIASMA_FOG)
	await _seconds(4.0)
	var mid: float = env.fog_density
	_check(mid > 0.015 and mid < 0.045, "half way through a change the fog is between the two (%.3f)" % mid)
	await _seconds(5.0)
	_check(is_equal_approx(env.fog_density, 0.055), "after 8 s the change is complete")

	# The cycle visits all six and comes round.
	var seen_conditions: Array[Weather.Condition] = []
	for i in range(Weather.CYCLE.size()):
		w.advance()
		seen_conditions.append(w.current)
	_check(seen_conditions.size() == 6 and seen_conditions.back() == Weather.Condition.MIASMA_FOG
		and Weather.Condition.CINDER_SQUALL in seen_conditions and Weather.Condition.DEAD_CALM in seen_conditions,
		"advancing six times visits every condition and comes round")
	w.changed.disconnect(on_change)
	w.set_condition(Weather.Condition.ASHFALL, true)
	w.cycling = true
	_player.camera_rig = rig
	_reset_player(OPEN)
	await _ticks(2)

# ------------------------------------------------------------------------------
# Survivor backgrounds: eight starting characters, each a kit, a trait and a permanent flaw.
# ------------------------------------------------------------------------------
func _test_backgrounds() -> void:
	_section("Survivor backgrounds")
	var rig: IsoCameraRig = _player.camera_rig
	_player.camera_rig = null
	_reset_player(OPEN)
	await _ticks(2)
	var all: Array[SurvivorBackground] = SurvivorBackground.all()
	var ids: Array[String] = []
	var complete: bool = true
	for b: SurvivorBackground in all:
		ids.append(b.id)
		complete = complete and b.title != "" and b.epigraph != "" and b.trait_name != "" and b.trait_text != "" and b.flaw_name != "" and b.flaw_text != "" and not b.gear.is_empty()
	_check(all.size() == 8 and ids.size() == 8, "eight backgrounds")
	var unique: Dictionary = {}
	for i: String in ids:
		unique[i] = true
	_check(unique.size() == 8 and complete, "each has a unique id, a title, an epigraph, a kit, a trait and a flaw")
	# (The kit itself is checked at the start of the suite, before other sections swap and spend it.)
	_check(_player.background != null and _player.background.id == "watch_deserter" and is_equal_approx(_player.max_health, 90.0)
		and is_equal_approx(_player.background.block_cost_mult, 0.75), "the default is the Watch Deserter: 90 health, cheaper blocks")
	_check(_main.find_children("BackgroundSelect", "", false, false).is_empty(), "headless, no start screen: the default stands")
	_check(_hud._background_label.text == "WATCH DESERTER", "the HUD names the background")
	var banners: Array[String] = []
	var on_banner := func(msg: String, _c: Color) -> void: banners.append(msg)
	_player.combat_banner_message.connect(on_banner)
	var w: Weather = _children_of(func(n: Node) -> bool: return n is Weather)[0]
	w.cycling = false
	var per: Perception = _player.perception

	# Fen Healer: five bandages, a spear, quick bandaging, and night-blind (sight x0.6 on the weather).
	_player.apply_background(SurvivorBackground.by_id("fen_healer"))
	_check(_player.inventory.count_of("clean_rag_bandage") == 5 and _player.inventory.main_hand.data.item_id == "boar_spear",
		"fen healer: five bandages and a spear")
	_player._start_channel(PlayerController.ChannelKind.BANDAGE, 1.6)
	_check(absf(_player._channel_total - 0.8) < 0.01, "fen healer: bandaging takes half the time (%.2f s)" % _player._channel_total)
	_player._clear_channel()
	_player.current_state = PlayerController.ActionState.IDLE
	_face(Vector3.RIGHT)
	var g := _spawn_hunting_goblin(Vector3(5.0, 0.0, 0.0))
	g.process_mode = Node.PROCESS_MODE_DISABLED
	g._facing_dir = Vector3.RIGHT
	await _ticks(1)
	w.set_condition(Weather.Condition.MIASMA_FOG, true)
	_check(not per.update_visibility(g, g._visual_root, 0.95), "fen healer in the miasma: 7 m x 0.6, a goblin 5 m ahead is unseen")
	w.set_condition(Weather.Condition.ASHFALL, true)
	g.global_position = OPEN + Vector3(9.0, 0.0, 0.0)
	_check(per.update_visibility(g, g._visual_root, 0.95), "fen healer in ashfall: 24 m x 0.6, a goblin 9 m ahead is seen")

	# Hedge-priest: sworn hands, no heavy blow; 50 poise.
	_player.apply_background(SurvivorBackground.by_id("hedge_priest"))
	_player.stamina = _player.max_stamina
	banners.clear()
	_player._start_attack(true)
	_check(_player.current_state == PlayerController.ActionState.IDLE and banners.size() == 1 and banners[0].contains("sworn"),
		"hedge-priest: a heavy blow is refused, and says why")
	_player._start_attack(false)
	_check(_player.current_state == PlayerController.ActionState.ATTACK_STARTUP and is_equal_approx(_player.max_poise, 50.0),
		"hedge-priest: light blows are fine; 50 poise")
	_reset_player(OPEN)
	await _ticks(2)

	# Gutter-kin: soft-footed (own noise x0.65), frail (75 health, longer bleeds).
	_player.apply_background(SurvivorBackground.by_id("gutter_kin"))
	_face(Vector3.RIGHT)
	g.global_position = OPEN + Vector3(8.0, 0.0, 0.0)
	_player.current_state = PlayerController.ActionState.SPRINT
	g.state = EnemyGoblinScavenger.AIState.IDLE
	g._evaluate_senses(1.0 / 60.0)
	_check(g.state == EnemyGoblinScavenger.AIState.IDLE and is_equal_approx(_player.max_health, 75.0) and is_equal_approx(_player.background.bleed_seconds, 18.0),
		"gutter-kin: a goblin 8 m away does not hear you sprint (9 x 0.65 = 5.9 m); 75 health; 18 s bleeds")
	_player.apply_background(SurvivorBackground.by_id("causeway_carter"))
	_player.current_state = PlayerController.ActionState.SPRINT
	g._evaluate_senses(1.0 / 60.0)
	_check(g.state == EnemyGoblinScavenger.AIState.INVESTIGATE, "causeway carter: the same goblin hears the same sprint (9 m)")
	_player.current_state = PlayerController.ActionState.IDLE
	g.queue_free()

	# Causeway Carter: hardy, one good ear (hearing x0.7 on the weather).
	_check(is_equal_approx(_player.max_health, 120.0) and not per.report_noise(OPEN + Vector3(-7.0, 0.0, 0.0), 8.0, null),
		"causeway carter: 120 health; an 8 m noise 7 m behind is not heard (reach 5.6 m)")

	# Chapel Cleaner: no weapon, quick searches. Peat-cutter and Cinder Factor: the numbers.
	_player.apply_background(SurvivorBackground.by_id("chapel_cleaner"))
	_player._start_channel(PlayerController.ChannelKind.SCAVENGE, 2.0)
	_check(_player.inventory.main_hand == null and absf(_player._channel_total - 1.3) < 0.01, "chapel cleaner: bare hands, searches at x0.65")
	_player._clear_channel()
	_player.current_state = PlayerController.ActionState.IDLE
	_player.apply_background(SurvivorBackground.by_id("peat_cutter"))
	_check(is_equal_approx(_player.max_stamina, 80.0) and is_equal_approx(_player.inventory.capacity_kg, 23.0)
		and _player.inventory.main_hand.data.item_id == "woodsmans_broadaxe", "peat-cutter: 80 stamina, 23 kg, the broadaxe")
	_player.apply_background(SurvivorBackground.by_id("cinder_factor"))
	_check(absf(_player.sprint_speed - 6.3 * 0.85) < 0.01 and is_equal_approx(_player.dodge_stamina_cost, 30.0) and is_equal_approx(_player.inventory.capacity_kg, 26.0),
		"cinder factor: 26 kg, sprint at 85%%, dodges cost 30")

	# The start screen: arrows and digits move the choice, confirm hands back the background.
	var picker := BackgroundSelect.new()
	_main.add_child(picker)
	var got: Array[SurvivorBackground] = []
	picker.chosen.connect(func(b: SurvivorBackground) -> void: got.append(b))
	picker.move_selection(1)
	picker.move_selection(0, 1)
	picker.confirm()
	picker.select(7)
	picker.confirm()
	_check(got.size() == 2 and got[0].id == "hedge_priest" and got[1].id == "causeway_carter",
		"the start screen: right then down is the hedge-priest, 8 is the carter")
	picker.queue_free()

	_player.combat_banner_message.disconnect(on_banner)
	_player.apply_background(SurvivorBackground.default_background())
	_check(_player.inventory.main_hand.data.item_id == "arming_sword" and _player.inventory.off_hand.data.item_id == "wooden_targe"
		and _player.inventory.count_of("clean_rag_bandage") == 2 and is_equal_approx(_player.health, 90.0),
		"back to the deserter: the old kit, full health")
	w.cycling = true
	_player.camera_rig = rig
	_reset_player(OPEN)
	await _ticks(2)

# ------------------------------------------------------------------------------
# Armour: three slots, six pieces; a flat soak off every blow, poise, wear, bleed guard, noise.
# ------------------------------------------------------------------------------
func _test_armour() -> void:
	_section("Armour slots")
	var rig: IsoCameraRig = _player.camera_rig
	_player.camera_rig = null
	_reset_player(OPEN)
	await _ticks(2)
	_player.apply_background(SurvivorBackground.default_background())
	var inv: Inventory = _player.inventory
	var pieces: Array[String] = ["padded_coif", "kettle_hat", "quilted_gambeson", "rusted_hauberk", "leather_greaves", "splinted_greaves"]
	var all_armour: bool = true
	for id: String in pieces:
		var d: ItemData = ItemDatabase.get_item(id)
		all_armour = all_armour and d != null and d.is_armour() and d.protection > 0.0 and d.max_condition > 0.0
	_check(all_armour, "six pieces of armour, each with a slot, protection and condition")
	_check(inv.worn_armour().is_empty() and is_zero_approx(inv.total_protection()) and _player._armour_label() == "none", "the deserter starts bare")

	# Wearing: one piece per slot; a second body piece replaces the first; weight counts.
	var coif := ItemDatabase.make("padded_coif")
	var gambeson := ItemDatabase.make("quilted_gambeson")
	var hauberk := ItemDatabase.make("rusted_hauberk")
	var w0: float = inv.total_weight()
	inv.add(coif)
	inv.add(gambeson)
	inv.equip(coif)
	inv.equip(gambeson)
	_check(inv.armour_in(ItemData.ArmourSlot.HEAD) == coif and inv.armour_in(ItemData.ArmourSlot.BODY) == gambeson and inv.is_equipped(coif),
		"a coif on the head and a gambeson on the body")
	_check(is_equal_approx(inv.total_protection(), 7.0) and is_equal_approx(inv.armour_poise_bonus(), 9.0) and is_equal_approx(_player.effective_max_poise(), 44.0),
		"coif and gambeson: soak 7, poise 35 + 9")
	_check(absf(inv.total_weight() - (w0 + 3.8)) < 0.01, "worn armour weighs what it weighs (+3.8 kg)")
	inv.add(hauberk)
	inv.equip(hauberk)
	_check(inv.armour_in(ItemData.ArmourSlot.BODY) == hauberk and not inv.is_equipped(gambeson) and inv.worn_armour().size() == 2,
		"a hauberk replaces the gambeson on the body")
	_check(_player._armour_label().begins_with("Padded Coif, Rusted Mail Hauberk") and _player._armour_label().ends_with("(soak 12)"),
		"the HUD line names what is worn (%s)" % _player._armour_label())
	_check(absf(inv.armour_noise_mult() - 1.25) < 0.001 and _player.get_noise_multiplier() > 1.2, "mail clinks: own noise x1.25")

	# Taking blows: a light slash loses the soak; a heavy slam loses 60% of it; never below 30%.
	_face(Vector3.RIGHT)
	var front: Vector3 = _player.global_position + Vector3(1.5, 0.0, 0.0)
	var hp: float = _player.health
	_player._on_hurtbox_hit_received(CombatPayload.new(_main, front, Vector3.LEFT, 24.0, 10.0, false, false))
	_check(absf((hp - _player.health) - 12.0) < 0.01, "a 24 slash through soak 12 does 12 (took %.1f)" % (hp - _player.health))
	_player.current_state = PlayerController.ActionState.IDLE
	hp = _player.health
	_player._on_hurtbox_hit_received(CombatPayload.new(_main, front, Vector3.LEFT, 62.0, 85.0, false, true))
	_check(absf((hp - _player.health) - (62.0 - 12.0 * 0.6)) < 0.01, "a heavy 62 slam counts the soak at 60%%: 54.8 (took %.1f)" % (hp - _player.health))
	_check(_player.current_state == PlayerController.ActionState.STAGGER, "an 85-poise slam still staggers (poise bonus 15 is not half of it)")
	_player.current_state = PlayerController.ActionState.IDLE
	_player.health = _player.max_health
	hp = _player.health
	_player._on_hurtbox_hit_received(CombatPayload.new(_main, front, Vector3.LEFT, 10.0, 1.0, false, false))
	_check(absf((hp - _player.health) - 3.0) < 0.01, "a 10 jab is never soaked below 30%%: 3 (took %.1f)" % (hp - _player.health))
	_player.current_state = PlayerController.ActionState.IDLE

	# Poise: the full set (kettle hat 5 + hauberk 10 + splinted greaves 4 = 19) shrugs an ork chop
	# (38 poise, heavy) once, since 19 is half of it; coif and hauberk alone (13) do not. Blows wear
	# every worn piece.
	_player.poise_damage_taken = 0.0
	_player.health = _player.max_health
	_player._on_hurtbox_hit_received(CombatPayload.new(_main, front, Vector3.LEFT, 36.0, 38.0, false, true))
	_check(_player.current_state == PlayerController.ActionState.STAGGER, "coif and hauberk (poise 13) still stagger under an ork chop")
	_player.current_state = PlayerController.ActionState.IDLE
	_player.poise_damage_taken = 0.0
	var hat := ItemDatabase.make("kettle_hat")
	var splint := ItemDatabase.make("splinted_greaves")
	inv.add(hat)
	inv.add(splint)
	inv.equip(hat)
	inv.equip(splint)
	_check(is_equal_approx(inv.armour_poise_bonus(), 19.0) and not inv.is_equipped(coif), "kettle hat, hauberk and splinted greaves: poise 19; the hat replaced the coif")
	var c0: float = hauberk.condition
	_player._on_hurtbox_hit_received(CombatPayload.new(_main, front, Vector3.LEFT, 36.0, 38.0, false, true))
	_check(_player.current_state != PlayerController.ActionState.STAGGER, "the full set shrugs off an ork chop (38 poise) without a stagger")
	_check(absf((c0 - hauberk.condition) - 2.0) < 0.01, "a heavy blow wears each worn piece by 2 (%.0f -> %.0f)" % [c0, hauberk.condition])
	_player.current_state = PlayerController.ActionState.IDLE
	inv.remove(hat)
	inv.remove(splint)
	inv.equip(coif)

	# Bleed guard: the hauberk turns four bleeding cuts in five; broken, it turns none and soaks half.
	var resist: float = inv.bleed_resist()
	_check(absf(resist - 0.8) < 0.001, "a hauberk turns 80%% of bleeding cuts")
	hauberk.condition = 0.5
	_player.health = _player.max_health
	_player._on_hurtbox_hit_received(CombatPayload.new(_main, front, Vector3.LEFT, 24.0, 10.0, false, false))
	_check(hauberk.is_broken() and is_zero_approx(inv.bleed_resist()) and absf(inv.total_protection() - 7.0) < 0.01,
		"a ruined hauberk turns no cuts and soaks half (coif 2 + 5)")
	_check(_player._armour_label().contains("ruined"), "the HUD line says so")
	_player.current_state = PlayerController.ActionState.IDLE
	_player.is_bleeding = false

	# Donning takes the piece's own time through the pack; doffing half of it.
	inv.unequip(hauberk)
	_player.health = _player.max_health
	_check(_player.request_equip(gambeson) and absf(_player._channel_total - 2.5) < 0.01 and _player._channel_label().begins_with("Putting on"),
		"putting on a gambeson takes 2.5 s (%s)" % _player._channel_label())
	await _seconds(2.6)
	_check(inv.armour_in(ItemData.ArmourSlot.BODY) == gambeson, "and it is worn when the time is up")
	_check(_player.request_equip(gambeson) and absf(_player._channel_total - 1.25) < 0.01, "taking it off takes half")
	_player._clear_channel()
	_player.current_state = PlayerController.ActionState.IDLE

	# The world has armour to find, and a carter starts in a gambeson.
	var stash: Lootable = null
	for n: Node in get_nodes_in_group("lootable"):
		if (n as Lootable).display_name == "Shelter Stash":
			stash = n
	var stash_has_coif: bool = stash != null and stash.items.any(func(i: ItemInstance) -> bool: return i.data.item_id == "padded_coif")
	_check(stash_has_coif, "the deserter's old coif waits in the shelter stash")
	_player.apply_background(SurvivorBackground.by_id("causeway_carter"))
	_check(inv.armour_in(ItemData.ArmourSlot.BODY) != null and inv.armour_in(ItemData.ArmourSlot.BODY).data.item_id == "quilted_gambeson",
		"the causeway carter starts wearing a gambeson")
	_player.apply_background(SurvivorBackground.default_background())
	_check(inv.worn_armour().is_empty(), "back to the deserter, bare again")
	_player.camera_rig = rig
	_reset_player(OPEN)
	await _ticks(2)

# ------------------------------------------------------------------------------
# Companions: a captive cut free follows, holds, fights, takes blows, goes down, is lifted or dies.
# ------------------------------------------------------------------------------
func _find_companion() -> Companion:
	var found: Array = _children_of(func(n: Node) -> bool: return n is Companion)
	return found[0] if not found.is_empty() else null

func _test_companions() -> void:
	_section("Companions")
	var rig: IsoCameraRig = _player.camera_rig
	_player.camera_rig = null
	_reset_player(OPEN)
	_player.apply_background(SurvivorBackground.default_background())
	await _ticks(2)
	var captives: Array = _children_of(func(n: Node) -> bool: return n is ActionPoint and (n as Lootable).display_name == "Bound Captive")
	_check(captives.size() == 1 and (captives[0] as Lootable).search_verb == "Cut free" and (captives[0] as Lootable).get_prompt().begins_with("[E] Cut free"),
		"a bound captive waits in the Watchhouse, with a [E] Cut free prompt")
	_check(_find_companion() == null and not _hud._ally_row.visible, "no companion yet, no ALLY line")

	# Cut free through the survivor's own channel: the captive becomes a companion at their side.
	var captive: ActionPoint = captives[0]
	_player.global_position = captive.global_position + Vector3(-1.0, 0.0, 0.0)
	await _ticks(2)
	_player._start_channel(PlayerController.ChannelKind.SCAVENGE, 0.05, captive)
	await _seconds(0.2)
	var c: Companion = _find_companion()
	_check(c != null and not is_instance_valid(captive) or (c != null and captive.is_queued_for_deletion()), "cutting the captive free makes a companion and removes the captive")
	_check(c != null and c.mode == Companion.Mode.FOLLOW and c.companion_name == "Edda", "the companion follows by default")
	await _ticks(2)
	_check(_hud._ally_row.visible and _hud._ally_label.text.contains("following"), "the HUD shows an ALLY line (%s)" % _hud._ally_label.text)

	# Follow: walk away and it closes to a few paces; rejoin when left far behind.
	_reset_player(OPEN)
	_face(Vector3.RIGHT)
	c.global_position = OPEN + Vector3(-8.0, 0.0, 0.0)
	await _seconds(3.0)
	var d: float = c.global_position.distance_to(_player.global_position)
	_check(d < 4.0 and d > 1.0, "following, it closes to a few paces (%.1f m)" % d)
	c.global_position = OPEN + Vector3(-30.0, 0.0, 0.0)
	c._away_timer = Companion.REJOIN_SECONDS - 0.05
	await _ticks(6)
	_check(c.global_position.distance_to(_player.global_position) < 3.0, "left far behind, it rejoins behind the survivor")

	# Hold: it stays put while the survivor walks off.
	c.global_position = OPEN + Vector3(-2.5, 0.0, 0.0)
	c.toggle_mode()
	var spot: Vector3 = c.hold_spot
	_player.global_position = OPEN + Vector3(9.0, 0.0, 0.0)
	await _seconds(1.5)
	_check(c.mode == Companion.Mode.HOLD and c.global_position.distance_to(spot) < 1.0, "told to hold, it stays (%.1f m from the spot)" % c.global_position.distance_to(spot))
	c.toggle_mode()
	_reset_player(OPEN)
	await _seconds(2.0)

	# Fight: a goblin near it loses health to the cudgel; the cudgel never lands on the survivor.
	# (The goblin stays live but blind, player_ref null: a process-disabled body leaves physics.)
	var g := _spawn_hunting_goblin(Vector3(0.0, 0.0, 0.0))
	g.player_ref = null
	var beyond: Vector3 = (c.global_position - _player.global_position)
	beyond.y = 0.0
	beyond = beyond.normalized() if beyond.length() > 0.1 else Vector3.LEFT
	g.global_position = c.global_position + beyond * 2.5  # on the companion's far side, clear of the survivor
	var g_hp: float = g.health
	var p_hp: float = _player.health
	var saw_swing: bool = false
	for i in range(int(3.0 * Engine.physics_ticks_per_second)):
		await _ticks(1)
		saw_swing = saw_swing or c.state == Companion.State.ATTACK_ACTIVE
		if g.health < g_hp:
			break
	_check(saw_swing and g.health < g_hp, "a goblin near it is cudgelled (%.0f -> %.0f)" % [g_hp, g.health])
	_check(is_equal_approx(_player.health, p_hp), "the cudgel never lands on the survivor")
	g.queue_free()
	await _ticks(2)

	# Takes blows: an ork's slash in front of it lands on it (it is on the survivor's hurtbox layer).
	var o := EnemyOrkWarrior.new()
	o.has_shield = false
	o.state = EnemyOrkWarrior.AIState.IDLE
	o._state_timer = 99.0
	_main.add_child(o)
	o.global_position = c.global_position + Vector3(1.2, 0.0, 0.0)
	o._facing_dir = Vector3.LEFT
	o._visual_root.look_at(o.global_position + Vector3.LEFT, Vector3.UP)
	await _ticks(1)
	var c_hp: float = c.health
	o._enter_combo_1_active()
	await _ticks(3)
	o._hitbox.end_swing()
	_check(c.health < c_hp, "an ork's slash in front of it lands on it (%.0f -> %.0f)" % [c_hp, c.health])
	o.queue_free()

	# Downed: lifted with a rag at 40% health; without a rag, nothing happens.
	c.health = 5.0
	c._hurtbox.receive_attack(CombatPayload.new(_main, c.global_position + Vector3(1.0, 0.0, 0.0), Vector3.LEFT, 20.0, 5.0))
	_check(c.is_downed() and c.downed_left > 24.0 and c.collision_layer == 0, "knocked to nothing it goes down, not dead")
	await _ticks(2)
	var lift: Array = c.get_children().filter(func(n: Node) -> bool: return n is ActionPoint)
	_check(lift.size() == 1 and (lift[0] as Lootable).search_verb == "Lift", "a [E] Lift prompt appears at the body")
	_check(_hud._ally_label.text.contains("DOWNED"), "the ALLY line says DOWNED")
	var inv: Inventory = _player.inventory
	for b: ItemInstance in inv.items.duplicate():
		if b.data.item_id == "clean_rag_bandage":
			inv.remove(b)
	(lift[0] as ActionPoint).on_search_complete(_player)
	_check(c.is_downed(), "no rag, no lift")
	inv.add(ItemDatabase.make("clean_rag_bandage", 1))
	(lift[0] as ActionPoint).on_search_complete(_player)
	_check(not c.is_downed() and is_equal_approx(c.health, Companion.MAX_HEALTH * 0.4) and inv.count_of("clean_rag_bandage") == 0,
		"a rag lifts them at 40%% health and is used up")
	await _ticks(2)
	_check(c.get_children().filter(func(n: Node) -> bool: return n is ActionPoint).is_empty(), "the Lift prompt is gone")

	# Death: down too long, and they die and leave a body to search.
	c.health = 1.0
	c._hurtbox.receive_attack(CombatPayload.new(_main, c.global_position + Vector3(1.0, 0.0, 0.0), Vector3.LEFT, 20.0, 5.0))
	c.downed_left = 0.05
	await _seconds(0.3)
	var body: Array = c.get_children().filter(func(n: Node) -> bool: return n is Lootable and not n is ActionPoint)
	_check(c.is_dead() and body.size() == 1 and (body[0] as Lootable).display_name == "Edda's body", "down too long, they die and leave a body")
	await _ticks(2)
	_check(_hud._ally_label.text.contains("dead"), "the ALLY line says dead")
	c.queue_free()
	_hud.companion = null
	_player.camera_rig = rig
	_reset_player(OPEN)
	await _ticks(2)

# ------------------------------------------------------------------------------
# Bestiary: the Blind Quarry-Troll hunts by sound alone and pounds where it heard you.
# ------------------------------------------------------------------------------
## A live, blind troll at OGRE_YARD; the survivor `offset` from it, at rest.
func _spawn_test_troll(offset: Vector3) -> EnemyQuarryTroll:
	_reset_player(OGRE_YARD + offset)
	var t := EnemyQuarryTroll.new()
	t.audio = _player.audio
	t.player_ref = _player
	_main.add_child(t)
	t.global_position = OGRE_YARD
	t._home_pos = OGRE_YARD
	await _ticks(2)
	return t

func _test_quarry_troll() -> void:
	_section("Bestiary: the Blind Quarry-Troll")
	var rig: IsoCameraRig = _player.camera_rig
	_player.camera_rig = null
	var w: Weather = _children_of(func(n: Node) -> bool: return n is Weather)[0]
	w.cycling = false
	w.set_condition(Weather.Condition.ASHFALL, true)
	_player.apply_background(SurvivorBackground.default_background())
	var level: Array = _children_of(func(n: Node) -> bool: return n is EnemyQuarryTroll)
	_check(level.size() == 1 and (level[0] as Node3D).global_position.distance_to(Vector3(15.5, 0.0, -14.5)) < 1.0,
		"the troll lives in the old quarry, north-east")
	var t: EnemyQuarryTroll = await _spawn_test_troll(Vector3(-6.0, 0.0, 0.0))
	_check(is_equal_approx(t.aggression, 0.5) and is_equal_approx(t.attack_power, 1.0) and t.max_health >= 300.0,
		"troll temperament: aggression 0.5, attack power 1.0, %.0f health" % t.max_health)

	# Hearing, not sight: still is silent; each action has its own reach.
	var sense := func(state: PlayerController.ActionState, dist: float) -> bool:
		t.has_heard = false
		t.state = EnemyQuarryTroll.AIState.LISTEN
		_player.global_position = OGRE_YARD + Vector3(-dist, 0.0, 0.0)
		_player.current_state = state
		t._listen(1.0 / 60.0)
		_player.current_state = PlayerController.ActionState.IDLE
		return t.has_heard
	_check(not sense.call(PlayerController.ActionState.IDLE, 1.5), "blind: a survivor standing still 1.5 m away is not found")
	_check(not sense.call(PlayerController.ActionState.BLOCK, 2.0), "blocking still makes no sound")
	_check(sense.call(PlayerController.ActionState.MOVE, 5.0) and not sense.call(PlayerController.ActionState.MOVE, 8.0), "walking carries 6 m")
	_check(sense.call(PlayerController.ActionState.SPRINT, 10.0) and not sense.call(PlayerController.ActionState.SPRINT, 16.0), "a sprint carries 14 m")
	_check(sense.call(PlayerController.ActionState.RECOIL, 15.0), "a sword clanging off stone carries 16 m")
	_check(sense.call(PlayerController.ActionState.SPRINT, 10.0) and t.state == EnemyQuarryTroll.AIState.INVESTIGATE
		and t.heard_pos.distance_to(OGRE_YARD + Vector3(-10.0, 0.0, 0.0)) < 0.1, "hearing sends it to where the sound was")
	# The survivor's noise multiplier reaches it: weather, background, armour.
	w.set_condition(Weather.Condition.DEAD_CALM, true)
	_check(sense.call(PlayerController.ActionState.MOVE, 8.0), "dead calm: a walk 8 m away is heard (6 x 1.6)")
	w.set_condition(Weather.Condition.CINDER_SQUALL, true)
	_check(not sense.call(PlayerController.ActionState.SPRINT, 10.0), "cinder-squall: a sprint 10 m away is lost (14 x 0.6)")
	w.set_condition(Weather.Condition.ASHFALL, true)
	_player.apply_background(SurvivorBackground.by_id("gutter_kin"))
	_check(not sense.call(PlayerController.ActionState.SPRINT, 10.0), "a gutter-kin sprints past at 10 m (14 x 0.65)")
	_player.apply_background(SurvivorBackground.default_background())
	var mail := ItemDatabase.make("rusted_hauberk")
	_player.inventory.add(mail)
	_player.inventory.equip(mail)
	_check(sense.call(PlayerController.ActionState.MOVE, 7.0), "mail clinks: a walk 7 m away is heard (6 x 1.25)")
	_player.inventory.remove(mail)
	# Stone muffles.
	var wall := _make_ogre_test_wall(OGRE_YARD + Vector3(-4.0, 1.25, 0.0), Vector3(0.4, 2.5, 6.0))
	await _ticks(1)
	_check(not sense.call(PlayerController.ActionState.SPRINT, 10.0), "through stone, a sprint 10 m away is muffled (14 x 0.55)")
	wall.queue_free()
	await _ticks(1)

	# It pounds where it heard you: still there, you take the blow; it never saw you.
	t.queue_free()
	await _ticks(2)
	t = await _spawn_test_troll(Vector3(-6.0, 0.0, 0.0))
	_face(Vector3.RIGHT)
	t.heard(_player.global_position)
	var hp: float = _player.health
	var saw_pound: bool = false
	for i in range(int(4.0 * Engine.physics_ticks_per_second)):
		await _ticks(1)
		saw_pound = saw_pound or t.state == EnemyQuarryTroll.AIState.POUND_STARTUP
		if _player.health < hp:
			break
	_check(saw_pound and is_equal_approx(hp - _player.health, EnemyQuarryTroll.POUND_DAMAGE),
		"a survivor who stays where they were heard takes the pound (%.0f)" % (hp - _player.health))
	await _seconds(1.6)
	t.queue_free()
	await _ticks(2)

	# Crept away during the windup: it pounds empty ground.
	t = await _spawn_test_troll(Vector3(-6.0, 0.0, 0.0))
	var heard_at: Vector3 = _player.global_position
	t.heard(heard_at)
	for i in range(int(3.0 * Engine.physics_ticks_per_second)):
		await _ticks(1)
		if t.state == EnemyQuarryTroll.AIState.POUND_STARTUP:
			break
	_check(t.state == EnemyQuarryTroll.AIState.POUND_STARTUP and t._pound_ring.visible
		and t._pound_ring.global_position.distance_to(heard_at + Vector3(0.0, 0.05, 0.0)) < 0.2,
		"its ring marks the heard spot, not the survivor")
	_player.global_position = heard_at + Vector3(0.0, 0.0, 4.5)
	hp = _player.health
	await _seconds(1.5)
	_check(is_equal_approx(_player.health, hp), "a survivor who crept away is missed")
	t.queue_free()
	await _ticks(2)

	# Standing still at arm's length: never found.
	t = await _spawn_test_troll(Vector3(-2.0, 0.0, 0.0))
	hp = _player.health
	await _seconds(2.0)
	_check(t.state == EnemyQuarryTroll.AIState.LISTEN and is_equal_approx(_player.health, hp), "a survivor 2 m away who keeps still is never found")

	# Struck from close by, it thrashes round itself.
	t._hurtbox.receive_attack(CombatPayload.new(_player, _player.global_position, Vector3.RIGHT, 22.0, 18.0))
	_check(t.state == EnemyQuarryTroll.AIState.THRASH_STARTUP and t.heard_pos.distance_to(_player.global_position) < 0.1,
		"hit from close by, it knows where you are and thrashes")
	hp = _player.health
	await _seconds(1.0)
	_check(is_equal_approx(hp - _player.health, EnemyQuarryTroll.THRASH_DAMAGE), "the thrash catches a survivor beside it (%.0f)" % (hp - _player.health))
	t.queue_free()
	_reset_player(OPEN)
	await _ticks(2)

	# It hears the companion too: Edda's cudgel draws it.
	t = await _spawn_test_troll(Vector3(-12.0, 0.0, 0.0))
	var c := Companion.new()
	c.player_ref = _player
	_main.add_child(c)
	c.global_position = OGRE_YARD + Vector3(0.0, 0.0, 7.0)
	c.process_mode = Node.PROCESS_MODE_DISABLED
	c.state = Companion.State.ATTACK_ACTIVE
	t.has_heard = false
	t._listen(1.0 / 60.0)
	_check(t.has_heard and t.heard_pos.distance_to(c.global_position) < 0.1, "it hears the companion's cudgel at 7 m and goes for her")
	c.queue_free()

	# The survivor dies mid-pound: it drops the blow, closes its hitboxes and listens.
	_player.global_position = OGRE_YARD + Vector3(-2.0, 0.0, 0.0)
	t._begin_pound(_player.global_position)
	_player.current_state = PlayerController.ActionState.DEAD
	await _ticks(3)
	_check(t.state == EnemyQuarryTroll.AIState.LISTEN and not t._pound_ring.visible and not t._pound_hitbox._is_swing_active,
		"the survivor dead, it drops its blow and listens")
	_reset_player(OPEN)
	await _ticks(2)
	# Lost the sound far from home: it walks back.
	t.global_position = OGRE_YARD + Vector3(8.0, 0.0, 0.0)
	t.has_heard = false
	t.state = EnemyQuarryTroll.AIState.LISTEN
	t._state_timer = 0.0
	await _ticks(2)
	_check(t.state == EnemyQuarryTroll.AIState.RETURN_HOME, "with nothing to hear, far from home, it walks back")
	t.queue_free()
	w.cycling = true
	_player.camera_rig = rig
	_reset_player(OPEN)
	await _ticks(2)

# ------------------------------------------------------------------------------
# Bestiary: Ash-Spore Husks burst into choking clouds; fire burns spores; the weather sets how
# long a cloud hangs.
# ------------------------------------------------------------------------------
func _clear_spores() -> void:
	for n: Node in get_nodes_in_group("spore_cloud"):
		n.queue_free()
	_player._choke_timer = 0.0
	await _ticks(1)

func _test_spore_husks() -> void:
	_section("Bestiary: Ash-Spore Husks")
	var rig: IsoCameraRig = _player.camera_rig
	_player.camera_rig = null
	var w: Weather = _children_of(func(n: Node) -> bool: return n is Weather)[0]
	w.cycling = false
	w.set_condition(Weather.Condition.ASHFALL, true)
	_player.apply_background(SurvivorBackground.default_background())
	_reset_player(OPEN)
	await _ticks(2)
	await _clear_spores()
	var level: Array = _children_of(func(n: Node) -> bool: return n is EnemySporeHusk)
	_check(level.size() == 3 and level.all(func(h: Node3D) -> bool: return h.global_position.x < -17.0),
		"three husks gather in the Spore Hollow on the west edge")
	var cart: Lootable = null
	for n: Node in get_nodes_in_group("lootable"):
		if (n as Lootable).display_name == "Spore-Choked Cart":
			cart = n
	_check(cart != null and cart.items.any(func(i: ItemInstance) -> bool: return i.data.item_id == "pitch_torch" and i.condition >= i.data.max_condition - 0.5),
		"a cart in the hollow holds a fresh torch")

	# A cloud chokes: health drains, stamina barely returns, sight closes, the HUD says so.
	var cloud := SporeCloud.spawn(_main, OPEN, 2.4, 8.0)
	await _ticks(2)
	_player.health = _player.max_health
	_player.stamina = 40.0
	_player._stamina_delay_timer = 0.0
	var hp: float = _player.health
	await _seconds(1.0)
	var choked_regen: float = _player.stamina - 40.0
	_check(_player.is_choking() and absf((hp - _player.health) - SporeCloud.CHOKE_DPS) < 0.4,
		"inside a cloud the survivor chokes, losing %.0f health a second (lost %.1f)" % [SporeCloud.CHOKE_DPS, hp - _player.health])
	_check(_hud._status_label.text.contains("CHOKING"), "the HUD flags it")
	var g := _spawn_hunting_goblin(Vector3(10.0, 0.0, 0.0))
	g.process_mode = Node.PROCESS_MODE_DISABLED
	_face(Vector3.RIGHT)
	_check(not _player.perception.update_visibility(g, g._visual_root, 0.95), "choking, a goblin 10 m ahead cannot be seen (24 m x 0.35 = 8.4 m)")
	cloud.queue_free()
	_player.global_position = OPEN + Vector3(0.0, 0.0, 8.0)
	await _seconds(0.6)
	_player.stamina = 40.0
	await _seconds(1.0)
	var clear_regen: float = _player.stamina - 40.0
	_check(not _player.is_choking() and choked_regen < clear_regen * 0.4,
		"out of it, choking stops and stamina returns (%.1f choking vs %.1f clear)" % [choked_regen, clear_regen])
	g.global_position = _player.global_position + Vector3(10.0, 0.0, 0.0)
	await _ticks(1)
	_check(_player.perception.update_visibility(g, g._visual_root, 0.95), "and the goblin is seen again")
	g.queue_free()
	_check(_player.health >= 1.0, "choking alone never kills (it stops at 1)")

	# Fire burns spores: a lit torch eats a cloud in about a second; without one it hangs.
	await _clear_spores()
	_reset_player(OPEN)
	var torch: ItemInstance = _player.inventory.find_first("pitch_torch")
	_player.inventory.off_hand = torch
	_player.inventory.notify_changed()
	await _ticks(2)
	_check(_player.is_torch_lit(), "(setup) the torch is lit")
	var burnt := SporeCloud.spawn(_main, OPEN + Vector3(3.0, 0.0, 0.0), 2.4, 8.0)
	await _seconds(1.2)
	_check(not is_instance_valid(burnt), "a lit torch near a cloud burns it away within about a second")
	_player.inventory.off_hand = _player.inventory.find_first("wooden_targe")
	_player.inventory.notify_changed()
	await _ticks(2)
	var kept := SporeCloud.spawn(_main, OPEN + Vector3(3.0, 0.0, 0.0), 2.4, 8.0)
	await _seconds(1.2)
	_check(is_instance_valid(kept) and kept.life > 6.0, "without the torch the cloud hangs (%.1f s left)" % (kept.life if is_instance_valid(kept) else 0.0))
	kept.queue_free()

	# The weather sets how long a cloud hangs.
	w.set_condition(Weather.Condition.DEAD_CALM, true)
	var calm := SporeCloud.spawn(_main, OPEN + Vector3(-8.0, 0.0, 0.0), 2.4, 8.0)
	w.set_condition(Weather.Condition.CINDER_SQUALL, true)
	var gusty := SporeCloud.spawn(_main, OPEN + Vector3(-8.0, 0.0, 6.0), 2.4, 8.0)
	_check(absf(calm.life - 12.8) < 0.01 and absf(gusty.life - 3.2) < 0.01, "the Dead Calm keeps a cloud 12.8 s, a cinder-squall clears it in 3.2 s")
	w.set_condition(Weather.Condition.ASHFALL, true)
	await _clear_spores()

	# The husk: half-blind, slow, and full of spores.
	_reset_player(OGRE_YARD + Vector3(-5.0, 0.0, 0.0))
	await _ticks(2)
	var h := EnemySporeHusk.new()
	h.audio = _player.audio
	h.player_ref = _player
	_main.add_child(h)
	h.global_position = OGRE_YARD
	h._facing_dir = Vector3.RIGHT  # looking away from the survivor
	await _ticks(2)
	_check(not h.sees_player(), "a husk looking away does not see a survivor 5 m behind it")
	h._facing_dir = Vector3.LEFT
	_check(h.sees_player(), "facing them, it does")
	_check(EnemySporeHusk.SHAMBLE_SPEED < _player.move_speed, "it shambles slower than you walk (%.1f vs %.1f m/s)" % [EnemySporeHusk.SHAMBLE_SPEED, _player.move_speed])
	# Its claw drives spores in.
	_player.global_position = OGRE_YARD + Vector3(-1.2, 0.0, 0.0)
	_face(Vector3.RIGHT)
	await _ticks(2)
	hp = _player.health
	h.state = EnemySporeHusk.AIState.CLAW_STARTUP
	h._state_timer = 0.0
	await _ticks(4)
	_check(absf((hp - _player.health) - EnemySporeHusk.CLAW_DAMAGE) < 0.5 and _player.is_choking(),
		"its claw does %.0f and leaves the survivor choking" % EnemySporeHusk.CLAW_DAMAGE)
	_player._choke_timer = 0.0
	# A wound puffs a small cloud; death bursts a big one where it stood.
	h.state = EnemySporeHusk.AIState.IDLE
	h._hurtbox.receive_attack(CombatPayload.new(_player, _player.global_position, Vector3.RIGHT, 10.0, 1.0))
	await _ticks(2)
	var puffs: Array = get_nodes_in_group("spore_cloud")
	_check(puffs.size() == 1 and absf((puffs[0] as SporeCloud).radius - EnemySporeHusk.PUFF_RADIUS) < 0.01, "a wound puffs a small cloud")
	await _clear_spores()
	h._hurtbox.receive_attack(CombatPayload.new(_player, _player.global_position, Vector3.RIGHT, 500.0, 1.0))
	await _ticks(2)
	var bursts: Array = get_nodes_in_group("spore_cloud")
	_check(h.is_dead() and bursts.size() == 1 and absf((bursts[0] as SporeCloud).radius - EnemySporeHusk.BURST_RADIUS) < 0.01
		and (bursts[0] as SporeCloud).contains(h.global_position), "killed, it bursts into a %.1f m cloud where it stood" % EnemySporeHusk.BURST_RADIUS)
	_check((bursts[0] as SporeCloud).contains(_player.global_position), "and a survivor who killed it at arm's length stands in the cloud")
	await _clear_spores()
	h.queue_free()

	# The survivor dies mid-claw: it stands down.
	var h2 := EnemySporeHusk.new()
	h2.player_ref = _player
	_main.add_child(h2)
	h2.global_position = OGRE_YARD
	await _ticks(2)
	h2.state = EnemySporeHusk.AIState.CLAW_STARTUP
	h2._state_timer = 0.5
	_player.current_state = PlayerController.ActionState.DEAD
	await _ticks(3)
	_check(h2.state == EnemySporeHusk.AIState.IDLE and not h2._hitbox._is_swing_active, "the survivor dead, a husk stands down")
	h2.queue_free()
	w.cycling = true
	_player.camera_rig = rig
	_reset_player(OPEN)
	await _ticks(2)
