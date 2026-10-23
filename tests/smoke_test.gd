extends SceneTree
# Headless regression checks for Ashen Wilds (Milestones 1-9).
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
	_main.set("show_background_picker", false)
	_main.set("weather_cycle_enabled", false)
	root.add_child(_main)
	await _ticks(5)

	_player = _children_of(func(n: Node) -> bool: return n is PlayerController)[0]
	_hud = _children_of(func(n: Node) -> bool: return n is TacticalHUD)[0]
	_player.loot_opened.connect(func(l: Lootable) -> void: _loot_events.append(l))

	await _test_milestones_1_to_3()

	# Freeze enemies so M4 checks are deterministic (they'd otherwise interrupt searches).
	for e: Node in _children_of(func(n: Node) -> bool: return n is EnemyGoblinScavenger or n is EnemyOrkWarrior or n is EnemyOgreBrute or n is EnemyQuarryTroll):
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
	await _test_enemy_clangs()
	await _test_survivor_backgrounds()
	await _test_vision_and_ripples()
	await _test_weather()
	await _test_enemy_ears()
	await _test_quarry_troll()
	await _test_armor()

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
# Milestone 6 — enemy wall clangs
# ------------------------------------------------------------------------------
func _spawn_dummy_ork(pos: Vector3, shield: bool, facing: Vector3) -> EnemyOrkWarrior:
	var o := EnemyOrkWarrior.new()
	o.has_shield = shield
	_main.add_child(o)
	o.global_position = pos
	o.process_mode = Node.PROCESS_MODE_DISABLED
	o._facing_dir = facing.normalized()
	o.state = EnemyOrkWarrior.AIState.PURSUE
	return o

func _sparks_count() -> int:
	return _main.find_children("WallSparks*", "Node3D", false, false).size()

func _test_enemy_clangs() -> void:
	_section("Enemy wall clangs")
	await _ticks(30) # let earlier sparks expire

	# Ork cleaver sweep: clangs in the hall, connects in the open.
	var hall_ork := _spawn_dummy_ork(HALL, false, Vector3.RIGHT)
	await _ticks(2)
	_check(hall_ork.is_cramped(), "entry hall: ork sweep flagged as cramped")
	var sparks_before: int = _sparks_count()
	hall_ork._enter_combo_1_active()
	_check(hall_ork.state == EnemyOrkWarrior.AIState.RECOIL, "entry hall: ork cleaver sweep clangs into RECOIL")
	_check(not hall_ork._hitbox._is_swing_active, "a clanged ork swing never opens its hitbox")
	_check(_sparks_count() > sparks_before, "ork clang throws sparks")
	_check(hall_ork.is_staggered(), "a recoiling ork counts as staggered (punishable, can lodge)")
	hall_ork._process_ai_state(hall_ork.wall_recoil_time + 0.05)
	_check(hall_ork.state == EnemyOrkWarrior.AIState.PURSUE, "ork recovers from recoil back into pursuit")

	hall_ork.state = EnemyOrkWarrior.AIState.PURSUE
	hall_ork._enter_combo_2_active()
	_check(hall_ork.state == EnemyOrkWarrior.AIState.COMBO_2_ACTIVE, "entry hall: ork overhead chop never clangs")
	hall_ork._hitbox.end_swing()

	var open_ork := _spawn_dummy_ork(OPEN + Vector3(0, 0, -3.0), false, Vector3.RIGHT)
	await _ticks(2)
	_check(not open_ork.is_cramped(), "open ground: ork sweep not cramped")
	open_ork._enter_combo_1_active()
	_check(open_ork.state == EnemyOrkWarrior.AIState.COMBO_1_ACTIVE, "open ground: ork cleaver sweep swings normally")
	open_ork._hitbox.end_swing()

	# Vanguard discipline: cramped shielded ork opens with the overhead chop.
	var vanguard := _spawn_dummy_ork(HALL + Vector3(-0.6, 0, 0), true, Vector3.RIGHT)
	await _ticks(2)
	_check(vanguard._try_begin_combo() and vanguard.state == EnemyOrkWarrior.AIState.COMBO_2_STARTUP, "cramped Vanguard opens with the overhead chop")
	var brute := _spawn_dummy_ork(HALL + Vector3(0.6, 0, 0), false, Vector3.RIGHT)
	await _ticks(2)
	_check(brute._try_begin_combo() and brute.state == EnemyOrkWarrior.AIState.COMBO_1_STARTUP, "unshielded ork sweeps anyway")
	var vanguard_open := _spawn_dummy_ork(OPEN + Vector3(2.0, 0, -3.0), true, Vector3.RIGHT)
	await _ticks(2)
	_check(vanguard_open._try_begin_combo() and vanguard_open.state == EnemyOrkWarrior.AIState.COMBO_1_STARTUP, "Vanguard sweeps normally in the open")

	# Goblin stab never clangs.
	var hall_gob := _spawn_dummy_goblin(HALL + Vector3(0.4, 0, 0))
	hall_gob._facing_dir = Vector3.RIGHT
	await _ticks(2)
	hall_gob._enter_attack_active()
	_check(hall_gob.state == EnemyGoblinScavenger.AIState.ATTACK_ACTIVE, "entry hall: goblin knife stab never clangs")
	hall_gob._hitbox.end_swing()

	# Ogre club sweep clangs off a lair pillar; the slam doesn't.
	var ogre := EnemyOgreBrute.new()
	_main.add_child(ogre)
	ogre.global_position = Vector3(-11.5, 0.0, -11.9) # 1.8 m south of the pillar at z -14.5
	ogre.process_mode = Node.PROCESS_MODE_DISABLED
	ogre.player_ref = _player
	ogre._facing_dir = Vector3.FORWARD
	await _ticks(2)
	ogre._enter_sweep_active()
	_check(ogre.state == EnemyOgreBrute.AIState.RECOIL, "ogre club sweep smashes into the pillar (RECOIL)")
	_check(not ogre._hitbox._is_swing_active and ogre.is_staggered(), "clanged ogre swing deals nothing and leaves it open")
	ogre.state = EnemyOgreBrute.AIState.PURSUE
	ogre._enter_slam_active()
	_check(ogre.state == EnemyOgreBrute.AIState.SLAM_ACTIVE, "ogre overhead slam never clangs")
	ogre._hitbox.end_swing()
	ogre._facing_dir = Vector3.BACK
	ogre.state = EnemyOgreBrute.AIState.PURSUE
	ogre._enter_sweep_active()
	_check(ogre.state == EnemyOgreBrute.AIState.SWEEP_ACTIVE, "ogre sweep facing open ground swings normally")
	ogre._hitbox.end_swing()

	# A heavy blow on a recoiling ork can lodge.
	var axe_w: WeaponData = ItemDatabase.get_item("woodsmans_broadaxe").weapon
	var saved_chance: float = axe_w.heavy_lodge_chance
	axe_w.heavy_lodge_chance = 1.0
	_equip_now("woodsmans_broadaxe")
	_reset_player(OPEN)
	await _ticks(2)
	hall_ork.state = EnemyOrkWarrior.AIState.RECOIL
	hall_ork.health = hall_ork.max_health
	_make_lodge(hall_ork, false)
	_check(_player.current_state == PlayerController.ActionState.LODGED, "heavy axe blow on a recoiling ork lodges")
	await _seconds(0.5)
	_check(_player.inventory.main_hand != null and _player.inventory.main_hand.data.item_id == "woodsmans_broadaxe", "...and the tug wrenches it free")
	axe_w.heavy_lodge_chance = saved_chance
	_equip_now("arming_sword")
	_equip_now("wooden_targe")
	await _seconds(0.6)

	for n: Node3D in [hall_ork, open_ork, vanguard, brute, vanguard_open, hall_gob, ogre]:
		n.queue_free()
	await _ticks(2)

# ------------------------------------------------------------------------------
# Milestone 7 — survivor backgrounds
# ------------------------------------------------------------------------------
func _bg(id: String) -> SurvivorBackground:
	var bg: SurvivorBackground = BackgroundDatabase.get_background(id)
	_player.apply_background(bg)
	return bg

func _test_survivor_backgrounds() -> void:
	_section("Survivor backgrounds")
	var all: Array[SurvivorBackground] = BackgroundDatabase.all()
	var ids: Dictionary = {}
	var well_formed: bool = true
	for bg: SurvivorBackground in all:
		ids[bg.background_id] = true
		if bg.trait_name == "" or bg.flaw_name == "" or bg.trait_desc == "" or bg.flaw_desc == "":
			well_formed = false
		var loadout_ids: Array = bg.loadout.map(func(e: Dictionary) -> String: return String(e["id"]))
		for id: String in loadout_ids:
			if not ItemDatabase.all_ids().has(id):
				well_formed = false
		if bg.main_hand_id != "" and not loadout_ids.has(bg.main_hand_id):
			well_formed = false
		if bg.off_hand_id != "" and not loadout_ids.has(bg.off_hand_id):
			well_formed = false
	_check(all.size() == 8 and ids.size() == 8, "eight survivors with unique ids")
	_check(well_formed, "every survivor has a trait, a flaw and a valid loadout")

	_reset_player(OPEN)
	await _ticks(2)
	var all_fit: bool = true
	for bg: SurvivorBackground in all:
		_player.apply_background(bg)
		var main_ok: bool = bg.main_hand_id == "" or (_player.inventory.main_hand != null and _player.inventory.main_hand.data.item_id == bg.main_hand_id)
		var off_ok: bool = bg.off_hand_id == "" or (_player.inventory.off_hand != null and _player.inventory.off_hand.data.item_id == bg.off_hand_id)
		if not main_ok or not off_ok or _player.inventory.get_load() == Inventory.Load.OVERBURDENED:
			all_fit = false
			print("   loadout problem: ", bg.background_id)
	_check(all_fit, "every loadout equips its weapons and starts below overburdened")

	# Citadel Deserter
	_bg("citadel_deserter")
	_check(_player.inventory.main_hand.data.item_id == "arming_sword" and _player.inventory.off_hand.data.item_id == "wooden_targe", "Deserter: sword & targe readied")
	_player.current_state = PlayerController.ActionState.BLOCK
	_player.stamina = _player.max_stamina
	var front: Vector3 = _player.global_position + _player._aim_direction * 1.5
	_player._on_hurtbox_hit_received(CombatPayload.new(_main, front, -_player._aim_direction, 10.0, 20.0))
	var drilled_cost: float = _player.max_stamina - _player.stamina
	_check(absf(drilled_cost - 20.0 * 0.55 * 0.75) < 0.05, "Shield Drill: block costs 25%% less stamina (%.2f)" % drilled_cost)
	_player.current_state = PlayerController.ActionState.IDLE
	_check(is_equal_approx(_player.get_modifiers().sprint_speed_mult, 0.88), "Bad Knee: sprint multiplier 0.88")

	# Peat-Cutter
	_bg("peat_cutter")
	_check(is_equal_approx(_player.inventory.capacity_kg, 23.0), "Strong Back: 23 kg capacity")
	_check(is_equal_approx(_player.max_stamina, 85.0) and is_equal_approx(_player.stamina, 85.0), "Bog Lung: 85 max stamina")

	# Boar Hunter: quieter walking.
	_bg("boar_hunter")
	_check(is_equal_approx(_player.max_health, 80.0) and is_equal_approx(_player.health, 80.0), "Old Goring: 80 max health")
	var listener := _spawn_dummy_goblin(OPEN + Vector3(3.1, 0, 0))
	listener.player_ref = _player
	listener._facing_dir = Vector3.RIGHT # facing away: can't see you
	listener.state = EnemyGoblinScavenger.AIState.PATROL
	_player.current_state = PlayerController.ActionState.MOVE
	_player.emit_gait_noise()
	listener._evaluate_senses(0.016)
	_check(listener.state == EnemyGoblinScavenger.AIState.PATROL, "Light Step: a goblin 3.1 m away doesn't hear you walk")
	_bg("citadel_deserter")
	_player.current_state = PlayerController.ActionState.MOVE
	_player.emit_gait_noise()
	_check(listener.state == EnemyGoblinScavenger.AIState.INVESTIGATE, "...but it hears an ordinary survivor")
	_player.current_state = PlayerController.ActionState.IDLE

	# Hedge Surgeon
	_bg("hedge_surgeon")
	_check(_player.inventory.count_of("clean_rag_bandage") == 5 and _player.inventory.off_hand == null, "Hedge Surgeon: 5 bandages, empty off-hand")
	_check(is_equal_approx(_player.max_poise, 25.0), "Frail: 25 max poise")
	_player.is_bleeding = true
	_player.health = 50.0
	_player.start_bandage()
	_check(absf(_player._channel_total - 1.6 * 0.55) < 0.01, "Steady Hands: bandaging takes 0.88 s")
	await _seconds(1.0)
	_check(not _player.is_bleeding and absf(_player.health - 68.0) < 1.0, "Steady Hands: bandage heals 18 (hp %.1f)" % _player.health)

	# Ferryman's Widow: torch fuel.
	_bg("ferrymans_widow")
	var torch: ItemInstance = _player.inventory.off_hand
	var fuel: float = torch.condition
	await _seconds(1.0)
	var burned: float = fuel - torch.condition
	_check(burned > 0.45 and burned < 0.8, "Fire-Keeper: torch burns ~0.6 s of fuel per second (%.2f)" % burned)
	_check(is_equal_approx(_player.get_modifiers().stamina_regen_mult, 0.85), "Grief-Worn: stamina regen x0.85")

	# Vault Runaway: clangs and the cough.
	var rig: IsoCameraRig = _player.camera_rig
	_player.camera_rig = null
	_bg("vault_runaway")
	var axe: ItemInstance = _player.inventory.main_hand
	_reset_player(HALL)
	_face(Vector3.RIGHT)
	await _ticks(2)
	var cond: float = axe.condition
	_ready_for_attack()
	_player._start_attack(false)
	await _seconds(_player.weapon.light_startup_time + 0.03)
	_check(_player.current_state == PlayerController.ActionState.RECOIL, "Vault Runaway still clangs in the hall")
	_check(absf((cond - axe.condition) - 1.0) < 0.01, "Tunnel-Born: clang costs normal wear (%.1f)" % (cond - axe.condition))
	_check(absf(_player._state_timer - 0.25) < 0.05, "Tunnel-Born: recoil is halved")
	await _seconds(0.4)
	_player.camera_rig = rig
	_reset_player(OPEN)
	await _ticks(2)
	listener.state = EnemyGoblinScavenger.AIState.PATROL
	listener.global_position = OPEN + Vector3(7.0, 0, 0)
	_player._cough_timer = 0.01
	await _ticks(2)
	_check(_player.is_coughing(), "Ash-Lung: the survivor coughs")
	listener._evaluate_senses(0.016)
	_check(listener.state == EnemyGoblinScavenger.AIState.INVESTIGATE, "Ash-Lung: a goblin 7 m away hears the cough")
	_check(_player._cough_timer > 10.0, "next cough rescheduled")
	listener.queue_free()

	# Salt-Smuggler
	_bg("salt_smuggler")
	var cache := _make_test_lootable(OPEN + Vector3(0.8, 0, 0), 2.0, [ItemDatabase.make("salt", 1)])
	await _ticks(2)
	_player._try_interact()
	_check(absf(_player._channel_total - 1.3) < 0.01, "Light Fingers: 2.0 s search takes 1.3 s")
	_player._cancel_channel("")
	cache.queue_free()
	_player.inventory.add(ItemDatabase.make("woodsmans_broadaxe"))
	_player.request_equip(_player.inventory.find_first("woodsmans_broadaxe"))
	_check(absf(_player._channel_total - 0.55 * 1.5) < 0.01, "Shaking Hands: swaps take 50% longer")
	_player._cancel_channel("")

	# Disgraced Squire
	_bg("disgraced_squire")
	_check(is_equal_approx(_player.max_poise, 47.0), "Tourney Poise: 47 max poise")
	var sword: ItemInstance = _player.inventory.main_hand
	var c0: float = sword.condition
	_player._on_confirmed_hit_landed(_main, CombatPayload.new(_player, Vector3.ZERO, Vector3.FORWARD, 1, 1))
	_check(absf((c0 - sword.condition) - 1.5) < 0.001, "Soft Grip: a light hit wears 1.5")

	# Flaws are permanent; the picker pauses the world.
	_player.respawn_at_shelter(OPEN)
	_check(_player.background != null and _player.background.background_id == "disgraced_squire" and is_equal_approx(_player.max_poise, 47.0), "respawning keeps the survivor and their flaw")

	var picker := BackgroundPicker.new()
	var chosen: Array = []
	picker.background_chosen.connect(func(bg: SurvivorBackground) -> void: chosen.append(bg))
	root.add_child(picker)
	await process_frame
	_check(paused, "the survivor picker pauses the world")
	picker.select(3)
	_check(picker.get_selected().background_id == "hedge_surgeon", "picker selects by index")
	picker.confirm()
	await process_frame
	_check(not paused and chosen.size() == 1 and chosen[0].background_id == "hedge_surgeon", "confirming emits the choice and unpauses")

	# Back to the legacy loadout for anything that follows.
	_player.apply_background(null)
	_check(absf(_player.inventory.total_weight() - 5.9) < 0.01 and is_equal_approx(_player.max_health, 100.0), "clearing the background restores the legacy loadout")
	_reset_player(OPEN)
	await _ticks(2)

# ------------------------------------------------------------------------------
# Milestone 8 — vision cone, memory map, acoustic ripples
# ------------------------------------------------------------------------------
func _test_vision_and_ripples() -> void:
	_section("Vision cone & acoustic ripples")
	var rig: IsoCameraRig = _player.camera_rig
	_player.camera_rig = null
	_reset_player(OPEN)
	_face(Vector3.RIGHT)
	await _ticks(3)
	var p: Vector3 = _player.global_position + Vector3(0, 1.0, 0)

	_check(_player.can_see_point(p + Vector3(6, 0, 0)), "sees a point 6 m ahead")
	_check(_player.can_see_point(p + Vector3(5, 0, 4)), "sees 40° off the aim (inside the 130° cone)")
	_check(not _player.can_see_point(p + Vector3(-6, 0, 0)), "can't see 6 m behind")
	_check(not _player.can_see_point(p + Vector3(1, 0, 6)), "can't see 80° off the aim")
	_check(_player.can_see_point(p + Vector3(-1.2, 0, 0)), "senses 1.2 m behind (sense radius)")
	_check(not _player.can_see_point(p + Vector3(17, 0, 0)), "can't see past vision range")
	# Walls block sight: from the yard west of the watchhouse, look east through the wall.
	_reset_player(Vector3(-0.5, 0.0, -5.0))
	_face(Vector3.RIGHT)
	await _ticks(2)
	_check(not _player.can_see_point(Vector3(3.0, 1.0, -5.0)), "a wall in the cone still blocks sight")

	# Enemies outside the cone aren't drawn.
	_reset_player(OPEN)
	_face(Vector3.RIGHT)
	await _ticks(2)
	var ahead := _spawn_dummy_goblin(OPEN + Vector3(4.0, 0, 0))
	var behind := _spawn_dummy_goblin(OPEN + Vector3(-4.0, 0, 0))
	ahead.player_ref = _player
	behind.player_ref = _player
	await _ticks(2)
	ahead._update_player_los_visibility(0.016)
	behind._update_player_los_visibility(0.016)
	_check(ahead._visual_root.visible, "goblin inside the cone is drawn")
	_check(not behind._visual_root.visible, "goblin behind you is hidden")

	# Exploration memory.
	var vision: VisionCone = _children_of(func(n: Node) -> bool: return n is VisionCone)[0]
	vision.update_now()
	_check(vision.is_visible_now(OPEN + Vector3(6, 0, 0)), "cone marks ground ahead as visible")
	_check(not vision.is_visible_now(OPEN + Vector3(-6, 0, 0)), "ground behind is not visible")
	_check(vision.is_explored(OPEN + Vector3(6, 0, 0)), "ground ahead is now explored")
	_face(Vector3.LEFT)
	vision.update_now()
	_check(not vision.is_visible_now(OPEN + Vector3(6, 0, 0)) and vision.is_explored(OPEN + Vector3(6, 0, 0)), "turning away: still explored (charcoal) but no longer visible")
	_check(not vision.is_explored(Vector3(24.0, 0, -24.0)), "far corner never seen stays unexplored")
	_reset_player(Vector3(-0.5, 0.0, -5.0))
	_face(Vector3.RIGHT)
	vision.update_now()
	_check(not vision.is_visible_now(Vector3(4.0, 0.0, -5.0)), "cone rays stop at walls (interior stays unlit)")
	_check(vision.overlay != null and vision.overlay.get_parent() is Camera3D, "memory overlay is attached to the camera")

	# Noises and ripples.
	_reset_player(OPEN)
	_face(Vector3.RIGHT)
	await _ticks(2)
	var field: AcousticField = _children_of(func(n: Node) -> bool: return n is AcousticField)[0]
	var ripples: AcousticRipples = _children_of(func(n: Node) -> bool: return n is AcousticRipples)[0]
	var heard: Array = []
	var listener := func(_pos: Vector3, loud: float, _src: Node3D, kind: String) -> void: heard.append([kind, loud])
	field.noise_emitted.connect(listener)

	var r0: int = ripples.active_ripple_count()
	field.emit_noise(behind.global_position, 6.0, behind, "footstep")
	_check(ripples.active_ripple_count() == r0 + 1, "unseen goblin's footstep draws a ripple")
	field.emit_noise(behind.global_position, 6.0, behind, "footstep")
	_check(ripples.active_ripple_count() == r0 + 1, "one ripple per source per 0.28 s")
	field.emit_noise(ahead.global_position, 6.0, ahead, "footstep")
	_check(ripples.active_ripple_count() == r0 + 1, "a goblin you can see makes no ripple")
	var far := _spawn_dummy_goblin(OPEN + Vector3(-12.0, 0, 0))
	field.emit_noise(far.global_position, 6.0, far, "footstep")
	_check(ripples.active_ripple_count() == r0 + 1, "a footstep beyond its reach isn't heard")
	field.emit_noise(far.global_position, 18.0, far, "slam")
	_check(ripples.active_ripple_count() == r0 + 2, "a loud slam at 12 m is heard")
	field.emit_noise(_player.global_position, 9.0, _player, "cough")
	_check(ripples.active_ripple_count() == r0 + 2, "your own noises make no ripple")
	var rip: Node3D = ripples.get_children().back()
	await _seconds(0.5)
	_check(rip.get_child(0).scale.x > 0.6, "ripple ring expands (scale %.2f)" % rip.get_child(0).scale.x)
	await _seconds(1.2)
	_check(ripples.active_ripple_count() == r0, "ripples fade out and free themselves")

	# Emitters.
	heard.clear()
	behind.velocity = Vector3(3.0, 0, 0)
	var t: float = AcousticField.step_cadence(behind, 0.01, 0.05, 0.34, 4.5)
	_check(heard.size() == 1 and heard[0][0] == "footstep" and is_equal_approx(t, 0.34), "moving goblin reports a footstep")
	behind.velocity = Vector3.ZERO
	heard.clear()
	AcousticField.step_cadence(behind, 0.01, 0.05, 0.34, 4.5)
	_check(heard.is_empty(), "a standing goblin makes no footsteps")
	heard.clear()
	var hall_ork := _spawn_dummy_ork(HALL, false, Vector3.RIGHT)
	await _ticks(2)
	hall_ork._enter_combo_1_active()
	_check(heard.any(func(h: Array) -> bool: return h[0] == "clang"), "an ork clang is reported to the acoustic field")
	heard.clear()
	field.hearing_multiplier = 0.5
	field.emit_noise(OPEN, 10.0, null, "test")
	_check(heard.size() == 1 and is_equal_approx(float(heard[0][1]), 5.0), "hearing multiplier scales noise reach")
	field.hearing_multiplier = 1.0

	field.noise_emitted.disconnect(listener)
	for n: Node in [ahead, behind, far, hall_ork]:
		n.queue_free()
	_player.camera_rig = rig
	await _ticks(2)

# ------------------------------------------------------------------------------
# Milestone 9 — weather & atmosphere
# ------------------------------------------------------------------------------
const INSIDE := Vector3(6.0, 0.0, -3.0) # watchhouse interior (sheltered)

func _test_weather() -> void:
	_section("Weather & atmosphere")
	var weather: WeatherSystem = _children_of(func(n: Node) -> bool: return n is WeatherSystem)[0]
	var field: AcousticField = _children_of(func(n: Node) -> bool: return n is AcousticField)[0]
	var W := WeatherSystem.Weather
	var rig: IsoCameraRig = _player.camera_rig
	_player.camera_rig = null
	_check(not weather.cycle_enabled and weather.current == W.OVERCAST, "starts Overcast (cycle off under test)")
	var all_named: bool = true
	for w: int in W.values():
		if String(WeatherSystem.profile(w)["name"]) == "" or String(WeatherSystem.profile(w)["summary"]) == "":
			all_named = false
	_check(W.size() == 7 and all_named, "seven weathers, each named and described")
	_reset_player(OPEN)
	_face(Vector3.RIGHT)
	await _ticks(2)
	var neutral: bool = true
	for key: String in ["sight", "hearing", "torch_burn", "torch_light", "traction", "sprint", "stamina_regen"]:
		if not is_equal_approx(WeatherSystem.factor(_player, key), 1.0):
			neutral = false
	_check(neutral and is_equal_approx(WeatherSystem.factor(_player, "dodge_extra"), 0.0), "Overcast is neutral")

	var changes: Array = []
	var on_change := func(_w: int, n: String, _s: String) -> void: changes.append(n)
	weather.weather_changed.connect(on_change)
	weather.advance(true)
	_check(weather.current == W.ASHFALL and changes == ["Ashfall"], "F4 / advance() moves to the next weather and announces it")
	_check(absf(_player.get_vision_range() - 12.0) < 0.01, "Ashfall: vision range 16 -> 12 m")
	_check(absf(field.hearing_multiplier - 0.8) < 0.01, "Ashfall: noise reach x0.8")

	# Miasma: sight halved for you and for goblins.
	weather.set_weather(W.MIASMA, true)
	_check(absf(_player.get_vision_range() - 8.0) < 0.01, "Miasma: vision range 8 m")
	_check(not _player.can_see_point(_player.global_position + Vector3(10, 1, 0)), "Miasma: can't see 10 m ahead")
	var watcher := _spawn_dummy_goblin(OPEN + Vector3(10.0, 0, 0))
	watcher.player_ref = _player
	watcher._facing_dir = Vector3.LEFT
	watcher.state = EnemyGoblinScavenger.AIState.PATROL
	_player.current_state = PlayerController.ActionState.IDLE
	watcher._evaluate_senses(0.016)
	_check(watcher.state == EnemyGoblinScavenger.AIState.PATROL, "Miasma: a goblin 10 m away can't see you")
	weather.set_weather(W.OVERCAST, true)
	watcher._evaluate_senses(0.016)
	_check(watcher.state == EnemyGoblinScavenger.AIState.PURSUE, "Overcast: the same goblin spots you")
	weather.set_weather(W.MIASMA, true)
	_check(absf(WeatherSystem.factor(_player, "stamina_regen") - 0.75) < 0.01, "Miasma: stamina regen x0.75 (even indoors)")

	# Dead Calm: sound carries.
	weather.set_weather(W.DEAD_CALM, true)
	watcher.global_position = OPEN + Vector3(-5.0, 0, 0)
	watcher._facing_dir = Vector3.LEFT
	watcher.state = EnemyGoblinScavenger.AIState.PATROL
	_player.current_state = PlayerController.ActionState.MOVE
	_player.emit_gait_noise()
	_check(watcher.state == EnemyGoblinScavenger.AIState.INVESTIGATE, "Dead Calm: footsteps carry 5 m to a goblin")
	weather.set_weather(W.OVERCAST, true)
	watcher.state = EnemyGoblinScavenger.AIState.PATROL
	_player.emit_gait_noise()
	_check(watcher.state == EnemyGoblinScavenger.AIState.PATROL, "Overcast: the same footsteps go unheard")
	_player.current_state = PlayerController.ActionState.IDLE
	watcher.queue_free()

	# Sleet: torch burns faster outdoors only; dodges cost more.
	weather.set_weather(W.SLEET, true)
	_equip_now("pitch_torch")
	await _ticks(2)
	var torch: ItemInstance = _player.inventory.off_hand
	var fuel: float = torch.condition
	await _seconds(1.0)
	var burned_out: float = fuel - torch.condition
	_check(burned_out > 1.7 and burned_out < 2.4, "Sleet: torch burns ~2 s of fuel per second outdoors (%.2f)" % burned_out)
	_reset_player(INSIDE)
	await _ticks(2)
	_check(weather.is_sheltered(_player.global_position), "the watchhouse interior is sheltered")
	fuel = torch.condition
	await _seconds(1.0)
	var burned_in: float = fuel - torch.condition
	_check(burned_in > 0.8 and burned_in < 1.3, "Sleet: indoors the torch burns normally (%.2f)" % burned_in)
	_reset_player(OPEN)
	await _ticks(2)
	_ready_for_attack()
	_player._try_start_dodge(Vector3.RIGHT)
	_check(absf((_player.max_stamina - _player.stamina) - 26.0) < 0.01, "Sleet: dodge costs 26 stamina outdoors")
	await _seconds(0.6)
	_check(get_precip_ok(weather, WeatherSystem.Precip.SLEET), "Sleet: sleet streaks are falling")
	_equip_now("wooden_targe")

	# Hoarfrost: you slide.
	weather.set_weather(W.HOARFROST, true)
	_reset_player(OPEN)
	await _ticks(2)
	_player.velocity = Vector3.ZERO
	_player.current_state = PlayerController.ActionState.MOVE
	_player._apply_locomotion(Vector3.RIGHT, 1.0 / 60.0)
	var icy: float = _player.velocity.x
	weather.set_weather(W.OVERCAST, true)
	_player.velocity = Vector3.ZERO
	_player._apply_locomotion(Vector3.RIGHT, 1.0 / 60.0)
	var firm: float = _player.velocity.x
	_check(icy < firm * 0.25 and firm > 4.0, "Hoarfrost: ice slows your first step (%.2f vs %.2f m/s)" % [icy, firm])
	weather.set_weather(W.HOARFROST, true)
	_check(absf(field.hearing_multiplier - 1.25) < 0.01 and absf(_player.get_vision_range() - 18.4) < 0.01, "Hoarfrost: sound carries x1.25, sight 18.4 m")
	_player.current_state = PlayerController.ActionState.IDLE

	# Cinder-squall: gusts shove you outdoors, not indoors.
	weather.set_weather(W.CINDER_SQUALL, true)
	_reset_player(OPEN)
	await _ticks(1)
	_player._knockback_velocity = Vector3.ZERO
	_check(weather.trigger_gust() and _player._knockback_velocity.length() > 4.0, "Cinder-squall: an ember gust shoves you outdoors")
	_reset_player(INSIDE)
	await _ticks(1)
	_player._knockback_velocity = Vector3.ZERO
	_check(not weather.trigger_gust() and _player._knockback_velocity.length() < 0.01, "Cinder-squall: no gusts inside the watchhouse")
	_check(WeatherSystem.factor(_player, "torch_light") <= 1.0 + 0.001, "torch flare doesn't apply indoors")
	_reset_player(OPEN)
	await _ticks(1)
	_check(WeatherSystem.factor(_player, "torch_light") > 1.29, "Cinder-squall: torches flare outdoors")

	# Smooth transitions.
	weather.set_weather(W.OVERCAST, true)
	var env: Environment = weather.environment
	var d0: float = env.fog_density
	weather.set_weather(W.MIASMA)
	_check(weather.is_transitioning(), "a weather change blends in")
	await _seconds(weather.transition_time * 0.5)
	var mid: float = env.fog_density
	_check(mid > d0 + 0.01 and mid < 0.075 - 0.01, "fog thickens gradually (%.3f mid-way)" % mid)
	await _seconds(weather.transition_time * 0.6)
	_check(not weather.is_transitioning() and absf(env.fog_density - 0.075) < 0.001, "blend completes at the new weather's fog")

	weather.set_weather(W.OVERCAST, true)
	await _ticks(3)
	_check(weather.get_precip_visible_count() == 0, "Overcast: nothing falls")
	weather.weather_changed.disconnect(on_change)
	_player.camera_rig = rig
	await _ticks(2)

func get_precip_ok(weather: WeatherSystem, kind: WeatherSystem.Precip) -> bool:
	return weather.get_active_precip() == kind and weather.get_precip_visible_count() > 100

# ------------------------------------------------------------------------------
# Milestone 10 — enemy ears
# ------------------------------------------------------------------------------
func _test_enemy_ears() -> void:
	_section("Enemy ears")
	var field: AcousticField = _children_of(func(n: Node) -> bool: return n is AcousticField)[0]
	var rig: IsoCameraRig = _player.camera_rig
	_player.camera_rig = null
	var heard: Array = []
	var rec := func(_pos: Vector3, reach: float, src: Node3D, kind: String) -> void:
		if src == _player:
			heard.append([kind, reach])
	field.noise_emitted.connect(rec)

	# The survivor's own noises.
	_reset_player(OPEN)
	await _ticks(2)
	Input.action_press("move_right")
	await _seconds(1.0)
	Input.action_release("move_right")
	await _ticks(2)
	var steps: Array = heard.filter(func(h: Array) -> bool: return h[0] == "footstep")
	_check(steps.size() >= 2 and absf(float(steps[0][1]) - 3.5) < 0.01, "walking reports 3.5 m footsteps (%d in 1 s)" % steps.size())
	heard.clear()
	_player.current_state = PlayerController.ActionState.SPRINT
	_check(absf(_player.emit_gait_noise() - 9.0) < 0.01, "sprinting carries 9 m")
	var timber := ItemDatabase.make("timber", 6)
	_player.inventory.add(timber)
	_check(absf(_player.emit_gait_noise() - 9.0 * 1.35) < 0.01, "a burdened pack clatters: sprint carries 12.2 m")
	_player.inventory.remove(timber)
	_player.current_state = PlayerController.ActionState.IDLE
	_check(is_equal_approx(_player.emit_gait_noise(), 0.0), "standing still is silent")
	heard.clear()
	_reset_player(OPEN)
	_face(Vector3.RIGHT)
	await _ticks(2)
	_ready_for_attack()
	_player._start_attack(false)
	await _seconds(_player.weapon.light_startup_time + 0.05)
	_check(heard.any(func(h: Array) -> bool: return h[0] == "swing"), "a swing is heard")
	await _seconds(0.8)
	heard.clear()
	var cache := _make_test_lootable(OPEN + Vector3(0.8, 0, 0), 2.0, [ItemDatabase.make("salt", 1)])
	await _ticks(2)
	_player._try_interact()
	await _seconds(1.2)
	_check(heard.any(func(h: Array) -> bool: return h[0] == "rummage"), "rummaging through a container is heard")
	_player._cancel_channel("")
	cache.queue_free()

	# Walls muffle.
	var inside := _spawn_dummy_goblin(Vector3(3.0, 0.0, -5.0))
	await _ticks(2)
	_check(absf(AcousticField.muffled_reach(inside, Vector3(-0.5, 0, -5.0), 10.0) - 6.0) < 0.01, "a wall cuts a noise's reach to 60%")
	_check(absf(AcousticField.muffled_reach(inside, Vector3(5.5, 0, -5.0), 10.0) - 10.0) < 0.01, "no wall, full reach")

	# Goblins investigate where the sound came from.
	var gob := _spawn_dummy_goblin(OPEN + Vector3(-6.0, 0, 0))
	gob.state = EnemyGoblinScavenger.AIState.PATROL
	await _ticks(1)
	field.emit_noise(OPEN, 5.0, _player, "footstep")
	_check(gob.state == EnemyGoblinScavenger.AIState.PATROL, "a 5 m footstep doesn't reach a goblin 6 m away")
	field.emit_noise(OPEN, 9.0, _player, "footstep")
	_check(gob.state == EnemyGoblinScavenger.AIState.INVESTIGATE and gob._last_known_player_pos.distance_to(OPEN) < 0.01, "a 9 m sprint does: it investigates the spot")
	gob.state = EnemyGoblinScavenger.AIState.PATROL
	field.emit_noise(OPEN, 9.0, inside, "footstep")
	_check(gob.state == EnemyGoblinScavenger.AIState.PATROL, "goblins ignore other creatures' footsteps")
	field.emit_noise(OPEN, 13.0, inside, "clang")
	_check(gob.state == EnemyGoblinScavenger.AIState.INVESTIGATE, "...but come to see what clanged")
	gob.state = EnemyGoblinScavenger.AIState.PATROL
	field.emit_noise(Vector3(3.0, 0, -5.0) + Vector3(-7.0, 0, 0), 9.0, _player, "footstep")
	_check(inside.state != EnemyGoblinScavenger.AIState.INVESTIGATE, "the goblin indoors doesn't hear a 9 m sprint 7 m away through the wall")

	# Orks come straight for a sound; the Ogre wakes.
	var ork := _spawn_dummy_ork(OPEN + Vector3(0, 0, -6.0), true, Vector3.FORWARD)
	ork.state = EnemyOrkWarrior.AIState.PATROL
	field.emit_noise(OPEN, 9.0, _player, "swing")
	_check(ork.state == EnemyOrkWarrior.AIState.SHIELD_ADVANCE, "a shielded ork advances on a sound it hears")
	var ogre := EnemyOgreBrute.new()
	_main.add_child(ogre)
	ogre.global_position = OPEN + Vector3(8.0, 0, 0)
	ogre.process_mode = Node.PROCESS_MODE_DISABLED
	ogre.player_ref = _player
	await _ticks(1)
	field.emit_noise(OPEN, 9.0, _player, "footstep")
	_check(ogre.state == EnemyOgreBrute.AIState.PURSUE, "a sleeping Ogre wakes to the survivor's noise")
	field.hearing_multiplier = 0.6
	ogre.state = EnemyOgreBrute.AIState.IDLE
	field.emit_noise(OPEN, 9.0, _player, "footstep")
	_check(ogre.state == EnemyOgreBrute.AIState.IDLE, "weather that muffles sound (x0.6) lets it sleep")
	field.hearing_multiplier = 1.0

	field.noise_emitted.disconnect(rec)
	for n: Node in [inside, gob, ork, ogre]:
		n.queue_free()
	_player.camera_rig = rig
	await _ticks(2)

# ------------------------------------------------------------------------------
# Milestone 11 — the Blind Quarry-Troll and thrown stones
# ------------------------------------------------------------------------------
func _spawn_dummy_troll(pos: Vector3) -> EnemyQuarryTroll:
	var t := EnemyQuarryTroll.new()
	t.position = pos
	t.process_mode = Node.PROCESS_MODE_DISABLED
	t.player_ref = _player
	_main.add_child(t)
	return t

func _test_quarry_troll() -> void:
	_section("Blind Quarry-Troll & thrown stones")
	var field: AcousticField = _children_of(func(n: Node) -> bool: return n is AcousticField)[0]
	var rig: IsoCameraRig = _player.camera_rig
	_player.camera_rig = null
	var world_troll: Array = _children_of(func(n: Node) -> bool: return n is EnemyQuarryTroll)
	_check(world_troll.size() == 1 and world_troll[0].global_position.distance_to(Vector3(16, 0, -15.5)) < 2.0, "the troll lairs in the Old Quarry")
	var names: Array = get_nodes_in_group("lootable").map(func(l: Lootable) -> String: return l.display_name)
	_check(names.has("Quarry Rubble Pile"), "the quarry has a rubble pile to search")

	_reset_player(OPEN)
	_face(Vector3.RIGHT)
	await _ticks(2)
	var T := EnemyQuarryTroll.AIState
	var troll := _spawn_dummy_troll(OPEN + Vector3(4.0, 0, 0))
	troll._facing_dir = Vector3.LEFT
	await _ticks(2)
	for i in range(5):
		troll._process_ai_state(0.1)
	_check(troll.state == T.IDLE, "a silent survivor 4 m in front of it goes unnoticed (it's blind)")

	field.emit_noise(OPEN + Vector3(1.0, 0, 0), 3.5, _player, "footstep")
	_check(troll.state == T.STALK and troll.get_target().distance_to(OPEN + Vector3(1.0, troll.global_position.y, 0)) < 0.01, "a footstep 3 m off: it stalks toward the sound")
	var gob := _spawn_dummy_goblin(OPEN + Vector3(6.0, 0, 2.0))
	troll.state = T.IDLE
	troll._has_target = false
	field.emit_noise(gob.global_position, 4.5, gob, "footstep")
	_check(troll.state == T.IDLE, "it ignores other creatures' footsteps")
	field.emit_noise(OPEN + Vector3(-6.0, 0, 0), 13.0, gob, "clang")
	_check(troll.state == T.CHARGE, "a clang 10 m away: it charges")
	var clang_spot: Vector3 = troll.get_target()
	field.emit_noise(OPEN + Vector3(2.5, 0, 0), 3.5, _player, "footstep")
	_check(troll.get_target().distance_to(clang_spot) < 0.01, "a fainter fresh sound doesn't pull it off the louder one")
	troll._target_age = 2.0
	field.emit_noise(OPEN + Vector3(2.5, 0, 0), 3.5, _player, "footstep")
	_check(troll.get_target().distance_to(clang_spot) > 1.0, "...once the old sound is stale, it turns to the new one")

	# Arriving where nobody is: it searches, then gives up.
	troll._target_pos = troll.global_position + Vector3(0, 0, 1.0)
	troll.state = T.STALK
	troll._process_ai_state(0.05)
	_check(troll.state == T.SEARCH, "arriving at an empty spot: it feels around")
	troll._process_ai_state(troll.search_time + 0.1)
	_check(troll.state == T.IDLE, "...and gives up after a few seconds")

	# Touch and pain give you away.
	_reset_player(troll.global_position + Vector3(-1.2, 0, 0))
	await _ticks(1)
	troll._process_ai_state(0.05)
	_check(troll.state == T.SWEEP_STARTUP, "brushing within 1.5 m of it: it swings")
	_reset_player(OPEN)
	await _ticks(1)
	troll.state = T.IDLE
	var hp: float = troll.health
	troll._on_hurtbox_hit_received(CombatPayload.new(_player, OPEN, Vector3.RIGHT, 20.0, 10.0, false, false))
	_check(absf((hp - troll.health) - 7.0) < 0.01, "light blows skid off its hide (20 -> 7)")
	_check(troll.state == T.SWEEP_STARTUP and troll.get_target().distance_to(Vector3(OPEN.x, troll.global_position.y, OPEN.z)) < 0.01, "pain tells it where you are: it swings back")
	hp = troll.health
	troll._on_hurtbox_hit_received(CombatPayload.new(_player, OPEN, Vector3.RIGHT, 20.0, 10.0, false, true))
	_check(absf((hp - troll.health) - 20.0) < 0.01, "heavy blows land in full")
	troll.state = T.STAGGER
	hp = troll.health
	troll._on_hurtbox_hit_received(CombatPayload.new(_player, OPEN, Vector3.RIGHT, 20.0, 1.0, false, false))
	_check(absf((hp - troll.health) - 20.0) < 0.01 and troll.is_staggered(), "a staggered troll takes light blows in full")

	# Its club clangs off the quarry walls.
	var pit_troll := _spawn_dummy_troll(Vector3(16.0, 0.0, -19.2))
	pit_troll._facing_dir = Vector3.FORWARD
	await _ticks(2)
	pit_troll._enter_sweep_active()
	_check(pit_troll.state == T.RECOIL, "its club cracks against the quarry wall (RECOIL)")

	troll._on_hurtbox_hit_received(CombatPayload.new(_player, OPEN, Vector3.RIGHT, 999.0, 1.0, false, true))
	await _ticks(2)
	var corpse: Lootable = null
	for c: Node in troll.get_children():
		if c is Lootable:
			corpse = c
	_check(troll.is_dead() and corpse != null and corpse.items.any(func(i: ItemInstance) -> bool: return i.data.item_id == "troll_hide"), "a dead troll leaves its hide")

	# Thrown stones.
	_reset_player(OPEN)
	_face(Vector3.RIGHT)
	await _ticks(2)
	_player._throw_cooldown_left = 0.0
	_check(not _player.throw_stone(), "no stones, no throw")
	_player.inventory.add(ItemDatabase.make("throwing_stone", 2))
	var thuds: Array = []
	var rec := func(pos: Vector3, _reach: float, src: Node3D, kind: String) -> void:
		if kind == "thud":
			thuds.append([pos, src])
	field.noise_emitted.connect(rec)
	var lure := _spawn_dummy_goblin(OPEN + Vector3(7.2, 0, 5.0))
	lure.state = EnemyGoblinScavenger.AIState.PATROL
	_check(_player.throw_stone() and _player.inventory.count_of("throwing_stone") == 1, "[G] throws a stone")
	_check(not _player.throw_stone(), "throwing has a short cooldown")
	await _seconds(0.6)
	_check(thuds.size() == 1 and thuds[0][1] == _player and (thuds[0][0] as Vector3).distance_to(OPEN + Vector3(7.2, 0, 0)) < 0.3, "it thuds down ~7 m ahead, credited to you")
	_check(lure.state == EnemyGoblinScavenger.AIState.INVESTIGATE and lure._last_known_player_pos.distance_to(OPEN + Vector3(7.2, 0, 0)) < 0.3, "a goblin goes to look where it landed, not where you are")
	var piles: Array = get_nodes_in_group("lootable").filter(func(l: Lootable) -> bool: return l.items.any(func(i: ItemInstance) -> bool: return i.data.item_id == "throwing_stone") and l.global_position.distance_to(OPEN + Vector3(7.2, 0, 0)) < 0.5)
	_check(piles.size() == 1, "the stone stays where it landed, to pick up again")
	field.noise_emitted.disconnect(rec)
	_player.inventory.consume("throwing_stone", _player.inventory.count_of("throwing_stone"))

	for n: Node in [troll, gob, pit_troll, lure] + piles:
		n.queue_free()
	_player.camera_rig = rig
	await _ticks(2)

# ------------------------------------------------------------------------------
# Milestone 12 — armor
# ------------------------------------------------------------------------------
func _test_armor() -> void:
	_section("Armor")
	var S := ItemData.ArmorSlot
	var ids: Dictionary = {"padded_hood": S.HEAD, "iron_skullcap": S.HEAD, "quilted_gambeson": S.BODY,
		"riveted_mail": S.BODY, "leather_leggings": S.LEGS, "splinted_greaves": S.LEGS}
	var ok: bool = true
	for id: String in ids.keys():
		var d: ItemData = ItemDatabase.get_item(id)
		if d.category != ItemData.Category.ARMOR or d.armor_slot != ids[id] or d.protection <= 0.0 or not d.is_equippable():
			ok = false
	_check(ok, "six armor pieces across head, body and legs")
	var lootables: Array = get_nodes_in_group("lootable")
	var holds := func(label: String, id: String) -> bool:
		for l: Lootable in lootables:
			if l.display_name == label:
				return l.items.any(func(i: ItemInstance) -> bool: return i.data.item_id == id)
		return false
	_check(holds.call("Watchhouse Supply Chest", "quilted_gambeson") and holds.call("Ork Plunder Pile", "riveted_mail") and holds.call("Gnawed Bone Heap", "splinted_greaves"), "armor is out there to scavenge (chest, plunder pile, bone heap)")

	_reset_player(OPEN)
	await _ticks(2)
	var inv: Inventory = _player.inventory
	var hood := ItemDatabase.make("padded_hood")
	var gamb := ItemDatabase.make("quilted_gambeson")
	var legs := ItemDatabase.make("leather_leggings")
	var mail := ItemDatabase.make("riveted_mail")
	for a: ItemInstance in [hood, gamb, legs, mail]:
		inv.add(a)
	var w0: float = inv.total_weight()
	_check(_player.request_equip(hood) and _player._channel_label() == "Donning Padded Hood", "donning a hood is a timed swap")
	await _seconds(0.7)
	_check(inv.get_armor(S.HEAD) == hood and inv.is_equipped(hood), "the hood goes on your head")
	_player.request_equip(mail)
	_check(absf(_player._channel_total - 2.4) < 0.01, "mail takes 2.4 s to pull on")
	await _seconds(2.6)
	_check(inv.get_armor(S.BODY) == mail and is_equal_approx(inv.total_weight(), w0), "mail worn; worn armor still weighs what it weighs")
	_player.current_state = PlayerController.ActionState.MOVE
	var pack: float = _player.get_noise_multiplier()
	_check(absf(_player.emit_gait_noise() - 3.5 * 1.4 * pack) < 0.01, "mail jingles: footsteps carry x1.4 (%.1f m with this pack)" % (3.5 * 1.4 * pack))
	_player.current_state = PlayerController.ActionState.IDLE

	# Protection, wear and bleeding.
	_player.health = 100.0
	_player.is_bleeding = false
	var prot: float = _player.get_armor_protection()
	_check(absf(prot - 0.32) < 0.001, "hood + mail = 32%% protection (%.2f)" % prot)
	var mail_cond: float = mail.condition
	_player._on_hurtbox_hit_received(CombatPayload.new(_main, OPEN + Vector3(1, 0, 0), Vector3.LEFT, 50.0, 1.0, true))
	_check(absf(_player.health - 66.0) < 0.01, "a 50-damage blow deals 34 through hood and mail")
	_check(absf((mail_cond - mail.condition) - 12.5) < 0.01, "each worn piece wears with the blow (mail -12.5)")
	_check(not _player.is_bleeding, "mail turns the edge: no bleeding")
	_player.current_state = PlayerController.ActionState.IDLE
	inv.equip(gamb)
	_player._on_hurtbox_hit_received(CombatPayload.new(_main, OPEN + Vector3(1, 0, 0), Vector3.LEFT, 10.0, 1.0, true))
	_check(_player.is_bleeding and inv.get_armor(S.BODY) == gamb, "a gambeson doesn't stop bleeding")
	_player.is_bleeding = false
	_player.current_state = PlayerController.ActionState.IDLE
	gamb.condition = 0.0
	_check(absf(_player.get_armor_protection() - 0.06) < 0.001, "a ruined piece protects nothing")
	gamb.condition = gamb.data.max_condition
	var saved: float = mail.data.protection
	mail.data.protection = 0.9
	inv.equip(mail)
	_check(is_equal_approx(_player.get_armor_protection(), 0.6), "protection is capped at 60%")
	mail.data.protection = saved

	# Blocking keeps armor clean; greaves slow sprinting.
	_player.current_state = PlayerController.ActionState.BLOCK
	_player.stamina = _player.max_stamina
	_player.is_exhausted = false
	mail_cond = mail.condition
	var front: Vector3 = _player.global_position + _player._aim_direction * 1.5
	_player._on_hurtbox_hit_received(CombatPayload.new(_main, front, -_player._aim_direction, 30.0, 10.0))
	_check(is_equal_approx(mail.condition, mail_cond), "a blocked blow doesn't wear your armor")
	_player.current_state = PlayerController.ActionState.IDLE
	var greaves := ItemDatabase.make("splinted_greaves")
	inv.add(greaves)
	inv.equip(greaves)
	_check(is_equal_approx(_player._armor_sprint_multiplier(), 0.95), "splinted greaves: sprint x0.95")

	# Drop and unequip.
	_player.request_equip(hood)
	await _seconds(0.7)
	_check(inv.get_armor(S.HEAD) == null and inv.has_item(hood), "unequipping takes the hood off")
	_player.drop_item(mail)
	_check(inv.get_armor(S.BODY) == null, "dropping worn armor empties the slot")
	await _ticks(2)
	_emit_check_hud()

	# Survivors start with a piece.
	_bg("citadel_deserter")
	_check(_player.inventory.get_armor(S.HEAD) != null and _player.inventory.get_armor(S.HEAD).data.item_id == "padded_hood", "Citadel Deserter starts in a padded hood")
	_bg("disgraced_squire")
	_check(_player.inventory.get_armor(S.HEAD) != null and _player.inventory.get_armor(S.HEAD).data.item_id == "iron_skullcap", "Disgraced Squire starts in an iron skullcap")
	_player.apply_background(null)
	_check(_player.inventory.armor.is_empty(), "legacy loadout wears nothing")
	for l: Node in get_nodes_in_group("lootable"):
		if (l as Lootable).items.has(mail):
			l.queue_free()
	_reset_player(OPEN)
	await _ticks(2)

func _emit_check_hud() -> void:
	_player._emit_stats()
	var lbl: Label = _hud._armor_label
	_check(lbl.text.begins_with("ARMOR ") and lbl.text.contains("%"), "HUD shows armor (%s)" % lbl.text)
