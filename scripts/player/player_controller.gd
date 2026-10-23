class_name PlayerController
extends CharacterBody3D

signal stats_changed(state_data: Dictionary)
signal combat_banner_message(text: String, color: Color)
signal loot_opened(lootable: Lootable)
signal ui_force_close
signal inventory_changed

enum ActionState {
	IDLE,
	MOVE,
	SPRINT,
	ATTACK_STARTUP,
	ATTACK_ACTIVE,
	ATTACK_RECOVERY,
	BLOCK,
	BLOCK_IMPACT,
	DODGE,
	STAGGER,
	CHANNEL,
	RECOIL,
	LODGED,
	DEAD
}

## Timed, cancellable actions that share the CHANNEL state.
enum ChannelKind { NONE, SCAVENGE, BANDAGE, EQUIP_SWAP }

const NEUTRAL_STATES: Array[ActionState] = [
	ActionState.IDLE, ActionState.MOVE, ActionState.SPRINT, ActionState.BLOCK
]

@export var move_speed: float = 4.2
@export var sprint_speed: float = 6.3
@export var block_move_speed: float = 2.1
@export var exhausted_speed_multiplier: float = 0.72
@export var rotation_speed: float = 16.0
@export var attack_commit_rotation_speed: float = 2.2

@export var max_health: float = 100.0
@export var max_stamina: float = 100.0
@export var stamina_regen_rate: float = 24.0
@export var stamina_regen_delay: float = 1.05
@export var exhausted_regen_delay: float = 1.85
@export var max_poise: float = 35.0
@export var poise_reset_time: float = 3.0

# Milestone 4 — scavenging, equipment & encumbrance
@export var carry_capacity_kg: float = 18.0
@export var equip_swap_time: float = 0.55
## Movement in the first moments of a search/bandage doesn't cancel it.
@export var channel_move_grace: float = 0.15
@export var dodge_stamina_cost: float = 22.0
@export var burdened_dodge_extra_cost: float = 6.0

# Milestone 5 — wall deflection & weapon lodging
@export var wall_recoil_time: float = 0.5
## Condition lost by a clang, as a multiple of a normal hit's wear.
@export var wall_clang_wear_mult: float = 3.0
@export var lodge_tug_time: float = 0.35

# Milestone 7 — survivor backgrounds
@export var cough_interval_min: float = 16.0
@export var cough_interval_max: float = 30.0
## How far an Ash-Lung cough carries to enemy ears.
@export var cough_noise_radius: float = 9.0

# Milestone 10 — the noises you make (heard through the acoustic field)
@export var walk_noise_reach: float = 3.5
@export var sprint_noise_reach: float = 9.0
@export var swing_noise_reach: float = 9.0
@export var rummage_noise_reach: float = 4.5
@export var shield_noise_reach: float = 8.0

# Milestone 11 — thrown stones
@export var throw_range: float = 9.0
@export var throw_noise_reach: float = 10.0
@export var throw_cooldown: float = 0.8

# Milestone 8 — vision cone
@export var vision_half_angle_deg: float = 65.0
@export var vision_range: float = 16.0
## Inside this radius you sense things behind you (walls still block).
@export var sense_radius: float = 1.6

var health: float = 100.0
var stamina: float = 100.0
var poise_damage_taken: float = 0.0
var is_exhausted: bool = false
var is_bleeding: bool = false
var bleed_timer: float = 0.0

var current_state: ActionState = ActionState.IDLE
## Derived from the main-hand item; falls back to bare fists.
var weapon: WeaponData
var inventory: Inventory
var camera_rig: IsoCameraRig
var audio: ProceduralAudio
## True while a pack/loot window is open: combat inputs are ignored.
var ui_capture: bool = false

var _state_timer: float = 0.0
var _stamina_delay_timer: float = 0.0
var _poise_timer: float = 0.0
var _dodge_cooldown: float = 0.0
var _is_current_attack_heavy: bool = false
var _queued_light_attack: bool = false
var _aim_direction: Vector3 = Vector3.FORWARD
var _dodge_direction: Vector3 = Vector3.FORWARD
var _knockback_velocity: Vector3 = Vector3.ZERO
var _ui_release_timer: float = 0.0

var _fists: WeaponData
var _channel_kind: ChannelKind = ChannelKind.NONE
var _channel_elapsed: float = 0.0
var _channel_total: float = 0.0
var _channel_lootable: Lootable = null
var _channel_item: ItemInstance = null
var _channel_unequip: bool = false
var _nearest_lootable: Lootable = null
var _last_load: Inventory.Load = Inventory.Load.NORMAL
var _torch_flicker_t: float = 0.0
var _cramped: bool = false
var _lodged_target: Node3D = null
## The chosen survivor (null = legacy Milestone 1-6 loadout, no traits).
var background: SurvivorBackground = null
## Active modifiers: the background's, or a neutral set.
var _mods: SurvivorBackground = SurvivorBackground.new()
var _base_stats: Dictionary = {}
var _cough_timer: float = 0.0
var _cough_noise_left: float = 0.0
var _gait_noise_timer: float = 0.0
var _throw_cooldown_left: float = 0.0

var _visual_root: Node3D
var _weapon_pivot: Node3D
var _weapon_mesh: MeshInstance3D
var _weapon_box: BoxMesh
var _blade_mat: StandardMaterial3D
var _shield_mesh: MeshInstance3D
var _shield_mat: StandardMaterial3D
var _torch_root: Node3D
var _torch_flame: MeshInstance3D
var _aim_arc_mesh: MeshInstance3D
var _aim_arc_mat: StandardMaterial3D
var _hitbox: HitboxComponent
var _hitbox_col: CollisionShape3D
var _hitbox_shape: BoxShape3D
var _hurtbox: HurtboxComponent
var _torch_light: OmniLight3D

func _ready() -> void:
	_base_stats = {
		"max_health": max_health,
		"max_stamina": max_stamina,
		"max_poise": max_poise,
		"carry_capacity_kg": carry_capacity_kg,
	}
	_fists = _make_fists()
	if inventory == null:
		inventory = Inventory.new()
		inventory.capacity_kg = carry_capacity_kg
		_give_starting_loadout()
	weapon = _current_weapon_data()
	_build_survivor_visuals_and_colliders()
	inventory.changed.connect(_on_inventory_changed)
	_apply_equipment()
	_last_load = inventory.get_load()
	_emit_stats()

func _physics_process(delta: float) -> void:
	if current_state == ActionState.DEAD:
		return

	if _ui_release_timer > 0.0:
		_ui_release_timer = maxf(0.0, _ui_release_timer - delta)
		if _ui_release_timer == 0.0:
			ui_capture = false

	_update_timers_and_conditions(delta)
	_update_torch(delta)
	_update_mouse_aim(delta)
	_process_state_machine(delta)
	_update_visual_pose(delta)
	move_and_slide()
	_update_gait_noise(delta)
	_update_interaction_target()
	_cramped = current_state in NEUTRAL_STATES and not _sweep_obstruction(false).is_empty()
	_emit_stats()

# ------------------------------------------------------------------------------
# Loadout & equipment
# ------------------------------------------------------------------------------
func _make_fists() -> WeaponData:
	var f := WeaponData.new()
	f.weapon_id = "bare_fists"
	f.display_name = "Bare Fists"
	f.light_startup_time = 0.18
	f.light_active_time = 0.10
	f.light_recovery_time = 0.28
	f.light_stamina_cost = 10.0
	f.light_damage = 7.0
	f.light_poise_damage = 8.0
	f.light_step_impulse = 2.4
	f.heavy_startup_time = 0.42
	f.heavy_active_time = 0.14
	f.heavy_recovery_time = 0.50
	f.heavy_stamina_cost = 20.0
	f.heavy_damage = 12.0
	f.heavy_poise_damage = 18.0
	f.heavy_step_impulse = 3.4
	f.heavy_bleed_chance = 0.0
	f.reach_meters = 1.0
	f.swing_arc_degrees = 70.0
	f.light_knockback = 1.6
	f.heavy_knockback = 3.2
	f.light_is_thrust = true # a punch never clangs off a wall
	f.heavy_is_thrust = true
	return f

func _give_starting_loadout() -> void:
	var sword := ItemDatabase.make("arming_sword", 1, 88.0)
	var targe := ItemDatabase.make("wooden_targe")
	var torch := ItemDatabase.make("pitch_torch", 1, 180.0)
	inventory.add(sword)
	inventory.add(targe)
	inventory.add(torch)
	inventory.add(ItemDatabase.make("clean_rag_bandage", 2))
	inventory.main_hand = sword
	inventory.off_hand = targe

## Milestone 7: replaces the loadout and applies the survivor's trait and
## flaw. The flaw is permanent: respawning keeps the background.
func apply_background(bg: SurvivorBackground) -> void:
	background = bg
	_mods = bg if bg != null else SurvivorBackground.new()
	max_health = float(_base_stats["max_health"]) + _mods.max_health_bonus
	max_stamina = float(_base_stats["max_stamina"]) + _mods.max_stamina_bonus
	max_poise = float(_base_stats["max_poise"]) + _mods.max_poise_bonus
	carry_capacity_kg = float(_base_stats["carry_capacity_kg"]) + _mods.capacity_bonus_kg
	_clear_channel()
	_hitbox.end_swing()
	_lodged_target = null
	current_state = ActionState.IDLE
	inventory.clear()
	inventory.capacity_kg = carry_capacity_kg
	if bg == null:
		_give_starting_loadout()
	else:
		for entry: Dictionary in bg.loadout:
			var inst: ItemInstance = ItemDatabase.make(String(entry["id"]), int(entry["qty"]), float(entry["cond"]))
			inventory.add(inst)
			var id: String = inst.data.item_id
			if id == bg.main_hand_id and inventory.main_hand == null:
				inventory.main_hand = inst
			elif id == bg.off_hand_id and inventory.off_hand == null:
				inventory.off_hand = inst
	health = max_health
	stamina = max_stamina
	is_exhausted = false
	is_bleeding = false
	poise_damage_taken = 0.0
	_cough_timer = randf_range(cough_interval_min, cough_interval_max)
	_cough_noise_left = 0.0
	_last_load = inventory.get_load()
	inventory.notify_changed()
	_emit_stats()

## Footsteps, sprinting and rummaging, reported at their cadence.
func _update_gait_noise(delta: float) -> void:
	var interval: float = _gait_interval()
	if interval <= 0.0:
		_gait_noise_timer = minf(_gait_noise_timer, 0.05)
		return
	_gait_noise_timer -= delta
	if _gait_noise_timer <= 0.0:
		_gait_noise_timer = interval
		emit_gait_noise()

func _gait_interval() -> float:
	match current_state:
		ActionState.SPRINT:
			return 0.3
		ActionState.MOVE:
			return 0.45
		ActionState.CHANNEL:
			return 0.5 if _channel_kind == ChannelKind.SCAVENGE else 0.0
	return 0.0

## Reports the noise your current gait makes right now. Returns its reach
## (0 when standing still or doing something quiet).
func emit_gait_noise() -> float:
	var reach: float = 0.0
	var kind: String = "footstep"
	match current_state:
		ActionState.SPRINT:
			reach = sprint_noise_reach * get_noise_multiplier()
		ActionState.MOVE:
			reach = walk_noise_reach * get_footstep_noise_multiplier()
		ActionState.CHANNEL:
			if _channel_kind == ChannelKind.SCAVENGE:
				reach = rummage_noise_reach
				kind = "rummage"
	if reach > 0.0:
		AcousticField.report(self, global_position, reach, kind)
	return reach

## Milestone 11: lob a stone toward the cursor (or straight ahead without a
## camera). It makes a noise where it lands and stays there to pick up.
func throw_stone() -> bool:
	if _throw_cooldown_left > 0.0 or not (current_state in NEUTRAL_STATES):
		return false
	var stone: ItemInstance = inventory.find_first("throwing_stone")
	if stone == null:
		combat_banner_message.emit("No stones to throw", Color(0.70, 0.66, 0.60))
		return false
	var target: Vector3 = global_position + get_aim_direction() * throw_range * 0.8
	if camera_rig:
		target = camera_rig.get_mouse_ground_position(global_position.y)
	var flat: Vector3 = target - global_position
	flat.y = 0.0
	if flat.length() > throw_range:
		flat = flat.normalized() * throw_range
	var landing: Vector3 = global_position + flat
	var thrown: ItemInstance = inventory.remove(stone, 1)
	_throw_cooldown_left = throw_cooldown
	_consume_stamina(4.0)
	if audio:
		audio.play_swing()
	_launch_stone(landing, thrown)
	return true

func _launch_stone(landing: Vector3, thrown: ItemInstance) -> void:
	var parent: Node = get_parent()
	if parent == null:
		return
	var rock := MeshInstance3D.new()
	rock.name = "ThrownStone"
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.12, 0.1, 0.12)
	rock.mesh = mesh
	parent.add_child(rock)
	var start: Vector3 = global_position + Vector3(0.0, 1.4, 0.0)
	rock.global_position = start
	var flight: float = 0.45
	var tween := rock.create_tween()
	tween.tween_method(func(t: float) -> void:
		var p: Vector3 = start.lerp(landing, t)
		p.y = lerpf(start.y, landing.y + 0.06, t) + sin(t * PI) * 1.6
		rock.global_position = p
	, 0.0, 1.0, flight)
	tween.tween_callback(func() -> void:
		AcousticField.report_as(rock, self, landing, throw_noise_reach, "thud")
		Lootable.spawn_ground_pile(parent, landing, thrown)
		rock.queue_free()
	)

func get_modifiers() -> SurvivorBackground:
	return _mods

func _current_weapon_data() -> WeaponData:
	var main: ItemInstance = inventory.main_hand if inventory else null
	if main != null and main.data.weapon != null:
		return main.data.weapon
	return _fists

func _offhand_active() -> bool:
	if inventory == null or inventory.off_hand == null:
		return false
	return not (inventory.main_hand != null and inventory.main_hand.data.two_handed)

func _has_ready_shield() -> bool:
	return (
		_offhand_active()
		and inventory.off_hand.data.category == ItemData.Category.SHIELD
		and not inventory.off_hand.is_broken()
	)

func _has_lit_torch() -> bool:
	return (
		_offhand_active()
		and inventory.off_hand.data.category == ItemData.Category.TORCH
		and inventory.off_hand.condition > 0.0
	)

func _weapon_condition_multiplier() -> float:
	var main: ItemInstance = inventory.main_hand
	if main == null or not main.data.has_durability():
		return 1.0
	if main.is_broken():
		return 0.4
	return lerpf(0.6, 1.0, clampf(main.condition_ratio() / 0.5, 0.0, 1.0))

func _apply_equipment() -> void:
	var is_attacking: bool = current_state in [
		ActionState.ATTACK_STARTUP, ActionState.ATTACK_ACTIVE, ActionState.ATTACK_RECOVERY
	]
	weapon = _current_weapon_data()
	if _hitbox_shape != null and not is_attacking:
		_configure_hitbox(weapon.swing_arc_degrees)
	_update_weapon_mesh()

	var off: ItemInstance = inventory.off_hand
	var off_active: bool = _offhand_active()
	if _shield_mesh:
		_shield_mesh.visible = off_active and off.data.category == ItemData.Category.SHIELD
		if off != null and off.data.category == ItemData.Category.SHIELD and off.is_broken():
			_shield_mat.albedo_color = Color(0.20, 0.15, 0.11)
		else:
			_shield_mat.albedo_color = Color(0.32, 0.23, 0.16)
	if _torch_root:
		_torch_root.visible = off_active and off.data.category == ItemData.Category.TORCH
	var lit: bool = _has_lit_torch()
	if _torch_light:
		_torch_light.visible = lit
	if _torch_flame:
		_torch_flame.visible = lit
	if current_state == ActionState.BLOCK and not _has_ready_shield():
		current_state = ActionState.IDLE

## Box hitbox sized to the weapon's reach and swing arc.
func _configure_hitbox(arc_degrees: float) -> void:
	var reach: float = weapon.reach_meters
	var half_arc: float = deg_to_rad(minf(arc_degrees, 180.0) * 0.5)
	var width: float = clampf(reach * sin(half_arc) * 1.1, 0.45, 1.9)
	_hitbox_shape.size = Vector3(width, 1.2, reach)
	_hitbox_col.position = Vector3(0.0, 1.0, -(reach * 0.5 + 0.25))

func get_hitbox_size() -> Vector3:
	return _hitbox_shape.size if _hitbox_shape else Vector3.ZERO

func _update_weapon_mesh() -> void:
	if _weapon_mesh == null:
		return
	if weapon == _fists:
		_weapon_mesh.visible = false
		return
	_weapon_mesh.visible = true
	var main: ItemInstance = inventory.main_hand
	var length: float = weapon.reach_meters * 0.76
	var thickness: float = 0.08
	if main and main.data.weapon_class == ItemData.WeaponClass.AXE:
		thickness = 0.24
	elif main and main.data.weapon_class == ItemData.WeaponClass.POLEARM:
		thickness = 0.06
	_weapon_box.size = Vector3(0.08, thickness, length)
	_weapon_mesh.position = Vector3(0.0, 0.0, -length * 0.55)
	if main and main.is_broken():
		_blade_mat.albedo_color = Color(0.36, 0.24, 0.16)
	else:
		_blade_mat.albedo_color = Color(0.52, 0.50, 0.48)

func _on_inventory_changed() -> void:
	_apply_equipment()
	var load_state: Inventory.Load = inventory.get_load()
	if load_state != _last_load:
		match load_state:
			Inventory.Load.NORMAL:
				combat_banner_message.emit("Pack weight manageable", Color(0.72, 0.80, 0.66))
			Inventory.Load.BURDENED:
				combat_banner_message.emit("Burdened — your pack clatters when you sprint or dodge", Color(0.86, 0.70, 0.38))
			Inventory.Load.OVERBURDENED:
				combat_banner_message.emit("Overburdened — cannot sprint or dodge", Color(0.90, 0.40, 0.25))
		_last_load = load_state
	inventory_changed.emit()

func get_noise_multiplier() -> float:
	return 1.35 if inventory and inventory.get_load() != Inventory.Load.NORMAL else 1.0

## Hearing multiplier for walking footsteps (pack clatter x Light Step).
func get_footstep_noise_multiplier() -> float:
	return get_noise_multiplier() * _mods.footstep_noise_mult

## True for a moment after an Ash-Lung cough.
func is_coughing() -> bool:
	return _cough_noise_left > 0.0

func is_scavenging() -> bool:
	return current_state == ActionState.CHANNEL and _channel_kind == ChannelKind.SCAVENGE

func _encumbrance_speed_mult() -> float:
	match inventory.get_load():
		Inventory.Load.BURDENED:
			return 0.92
		Inventory.Load.OVERBURDENED:
			return 0.62
	return 1.0

# ------------------------------------------------------------------------------
# Public API used by the HUD / inventory UI
# ------------------------------------------------------------------------------
func set_ui_capture(active: bool) -> void:
	if active:
		ui_capture = true
		_ui_release_timer = 0.0
		if current_state == ActionState.BLOCK:
			current_state = ActionState.IDLE
	elif ui_capture:
		# Release a moment later so the click that closed a window isn't read as an attack.
		_ui_release_timer = 0.12

func request_equip(inst: ItemInstance) -> bool:
	if not (current_state in NEUTRAL_STATES):
		return false
	if not inventory.has_item(inst) or not inst.data.is_equippable():
		return false
	_start_channel(ChannelKind.EQUIP_SWAP, equip_swap_time * _mods.swap_time_mult, null, inst, inventory.is_equipped(inst))
	return true

func use_item(inst: ItemInstance) -> bool:
	if not inventory.has_item(inst):
		return false
	if inst.data.item_id == "clean_rag_bandage":
		return start_bandage()
	combat_banner_message.emit("You can't use %s here" % inst.data.display_name, Color(0.7, 0.68, 0.62))
	return false

func start_bandage() -> bool:
	if not (current_state in NEUTRAL_STATES):
		return false
	if inventory.count_of("clean_rag_bandage") <= 0:
		combat_banner_message.emit("No clean bandages left", Color(0.86, 0.55, 0.30))
		return false
	if not is_bleeding and health >= max_health - 0.5:
		combat_banner_message.emit("No wound to dress", Color(0.7, 0.68, 0.62))
		return false
	_start_channel(ChannelKind.BANDAGE, ItemDatabase.get_item("clean_rag_bandage").use_duration * _mods.bandage_time_mult)
	return true

func drop_item(inst: ItemInstance) -> bool:
	if not inventory.has_item(inst):
		return false
	if not (current_state in NEUTRAL_STATES or current_state == ActionState.CHANNEL):
		return false
	if current_state == ActionState.CHANNEL and _channel_item == inst:
		_cancel_channel("Swap abandoned")
	var removed: ItemInstance = inventory.remove(inst)
	var drop_pos: Vector3 = global_position + _aim_direction * 0.7
	drop_pos.y = global_position.y
	Lootable.spawn_ground_pile(get_parent(), drop_pos, removed)
	combat_banner_message.emit("Dropped %s" % removed.data.display_name, Color(0.72, 0.68, 0.60))
	return true

func take_from(lootable: Lootable, inst: ItemInstance) -> bool:
	if not is_instance_valid(lootable) or not lootable.items.has(inst):
		return false
	if not inventory.add(inst):
		combat_banner_message.emit(
			"Too heavy — %.1f kg would exceed your %.1f kg limit" % [
				inventory.total_weight() + inst.total_weight(), inventory.hard_limit_kg()
			],
			Color(0.90, 0.42, 0.26)
		)
		return false
	lootable.take(inst)
	return true

func get_nearest_lootable() -> Lootable:
	return _nearest_lootable

# ------------------------------------------------------------------------------
# Channelled actions (scavenge / bandage / equip swap)
# ------------------------------------------------------------------------------
func _start_channel(kind: ChannelKind, duration: float, lootable: Lootable = null, item: ItemInstance = null, unequip: bool = false) -> void:
	_channel_kind = kind
	_channel_total = maxf(duration, 0.01)
	_channel_elapsed = 0.0
	_channel_lootable = lootable
	_channel_item = item
	_channel_unequip = unequip
	current_state = ActionState.CHANNEL

func _clear_channel() -> void:
	_channel_kind = ChannelKind.NONE
	_channel_elapsed = 0.0
	_channel_total = 0.0
	_channel_lootable = null
	_channel_item = null
	_channel_unequip = false

func _cancel_channel(reason: String) -> void:
	if current_state != ActionState.CHANNEL:
		return
	_clear_channel()
	current_state = ActionState.IDLE
	if reason != "":
		combat_banner_message.emit(reason, Color(0.84, 0.62, 0.38))

func _channel_label() -> String:
	match _channel_kind:
		ChannelKind.SCAVENGE:
			if not is_instance_valid(_channel_lootable):
				return "Searching"
			return "%s %s" % [_channel_lootable.search_verb_progressive, _channel_lootable.display_name]
		ChannelKind.BANDAGE:
			return "Binding wound"
		ChannelKind.EQUIP_SWAP:
			if _channel_item == null:
				return "Changing grip"
			return ("Stowing %s" if _channel_unequip else "Readying %s") % _channel_item.data.display_name
	return ""

func get_channel_progress() -> float:
	if current_state != ActionState.CHANNEL:
		return 0.0
	return clampf(_channel_elapsed / _channel_total, 0.0, 1.0)

func get_channel_kind() -> ChannelKind:
	return _channel_kind if current_state == ActionState.CHANNEL else ChannelKind.NONE

func _process_channel(move_dir: Vector3, delta: float) -> void:
	_channel_elapsed += delta

	if not ui_capture and (
		Input.is_action_just_pressed("dodge")
		or Input.is_action_just_pressed("attack_light")
		or Input.is_action_just_pressed("attack_heavy")
	):
		_cancel_channel("%s — interrupted" % _channel_label())
		return

	if _channel_kind == ChannelKind.EQUIP_SWAP:
		# You can shuffle while changing grip, slowly.
		var spd: float = move_speed * 0.55 * _encumbrance_speed_mult()
		velocity.x = move_dir.x * spd + _knockback_velocity.x
		velocity.z = move_dir.z * spd + _knockback_velocity.z
	else:
		velocity.x = _knockback_velocity.x
		velocity.z = _knockback_velocity.z
		if _channel_elapsed > channel_move_grace and move_dir.length_squared() > 0.01:
			_cancel_channel("%s — interrupted (moved)" % _channel_label())
			return
		if _channel_kind == ChannelKind.SCAVENGE:
			if not is_instance_valid(_channel_lootable):
				_cancel_channel("")
				return
			if not ui_capture and Input.is_action_just_pressed("interact"):
				_cancel_channel("Stopped searching")
				return

	if _channel_elapsed >= _channel_total:
		_complete_channel()

func _complete_channel() -> void:
	var kind: ChannelKind = _channel_kind
	var lootable: Lootable = _channel_lootable
	var item: ItemInstance = _channel_item
	var unequip: bool = _channel_unequip
	_clear_channel()
	current_state = ActionState.IDLE

	match kind:
		ChannelKind.SCAVENGE:
			if is_instance_valid(lootable):
				lootable.searched = true
				if lootable.items.is_empty():
					combat_banner_message.emit("%s — nothing worth taking" % lootable.display_name, Color(0.66, 0.62, 0.56))
				loot_opened.emit(lootable)
		ChannelKind.BANDAGE:
			if inventory.consume("clean_rag_bandage", 1):
				is_bleeding = false
				bleed_timer = 0.0
				health = minf(max_health, health + 8.0 + _mods.bandage_heal_bonus)
				combat_banner_message.emit("Wound bound with a clean rag — bleeding stopped", Color(0.75, 0.82, 0.68))
		ChannelKind.EQUIP_SWAP:
			if item != null and inventory.has_item(item):
				if unequip:
					inventory.unequip(item)
					combat_banner_message.emit("Stowed %s" % item.data.display_name, Color(0.72, 0.70, 0.64))
				else:
					inventory.equip(item)
					var note: String = ""
					if item.data.two_handed and inventory.off_hand != null:
						note = " — two-handed grip, %s stowed" % inventory.off_hand.data.display_name
					elif item.is_broken():
						note = " — it's broken"
					combat_banner_message.emit("Readied %s%s" % [item.data.display_name, note], Color(0.78, 0.74, 0.62))

func _try_interact() -> bool:
	var l: Lootable = _nearest_lootable
	if l == null or not is_instance_valid(l):
		return false
	if l.searched or l.search_duration <= 0.0:
		l.searched = true
		loot_opened.emit(l)
		return true
	_start_channel(ChannelKind.SCAVENGE, l.search_duration * _mods.search_time_mult, l)
	return true

func _update_interaction_target() -> void:
	_nearest_lootable = null
	var best: float = INF
	for n: Node in get_tree().get_nodes_in_group("lootable"):
		var l := n as Lootable
		if l == null or l.is_queued_for_deletion() or not l.is_inside_tree():
			continue
		var d: float = Vector2(l.global_position.x - global_position.x, l.global_position.z - global_position.z).length()
		if d <= l.interact_radius and d < best:
			best = d
			_nearest_lootable = l

func _on_slot_key(slot: int) -> void:
	if slot <= 3:
		var classes: Array[ItemData.WeaponClass] = [
			ItemData.WeaponClass.BLADE, ItemData.WeaponClass.POLEARM, ItemData.WeaponClass.AXE
		]
		var names: Array[String] = ["blade", "polearm", "axe"]
		var candidate: ItemInstance = inventory.find_weapon_of_class(classes[slot - 1])
		if candidate == null:
			combat_banner_message.emit("No %s in your pack" % names[slot - 1], Color(0.70, 0.66, 0.60))
			return
		if candidate == inventory.main_hand:
			return
		request_equip(candidate)
		return

	var shield: ItemInstance = inventory.find_first_of_category(ItemData.Category.SHIELD)
	var torch: ItemInstance = inventory.find_first_of_category(ItemData.Category.TORCH)
	var off: ItemInstance = inventory.off_hand
	var target: ItemInstance = null
	if off != null and off.data.category == ItemData.Category.SHIELD:
		target = torch
	elif off != null and off.data.category == ItemData.Category.TORCH:
		target = shield
	else:
		target = shield if shield != null else torch
	if target == null:
		combat_banner_message.emit("Nothing else to ready in your off-hand", Color(0.70, 0.66, 0.60))
		return
	request_equip(target)

func _block_unavailable_reason() -> String:
	var off: ItemInstance = inventory.off_hand
	if inventory.main_hand != null and inventory.main_hand.data.two_handed and off != null:
		return "Two-handed grip — shield stowed"
	if off == null:
		return "No shield readied"
	if off.data.category == ItemData.Category.TORCH:
		return "Torch in your off-hand — no shield to raise"
	if off.is_broken():
		return "Your shield is splintered"
	return "Cannot block"

# ------------------------------------------------------------------------------
# Torch
# ------------------------------------------------------------------------------
func _update_torch(delta: float) -> void:
	var lit: bool = _has_lit_torch()
	_torch_light.visible = lit
	_torch_flame.visible = lit
	if not lit:
		return
	var torch: ItemInstance = inventory.off_hand
	if torch.wear(delta * _mods.torch_burn_mult * WeatherSystem.factor(self, "torch_burn")):
		_torch_light.visible = false
		_torch_flame.visible = false
		combat_banner_message.emit("Your torch gutters out", Color(0.78, 0.58, 0.36))
		inventory.notify_changed()
		return
	_torch_flicker_t += delta
	var flicker: float = 0.9 + 0.06 * sin(_torch_flicker_t * 13.0) + 0.04 * sin(_torch_flicker_t * 29.0 + 1.3)
	var fuel_fade: float = clampf(torch.condition_ratio() / 0.2, 0.35, 1.0)
	var weather_light: float = WeatherSystem.factor(self, "torch_light")
	_torch_light.light_energy = torch.data.light_energy * flicker * fuel_fade * weather_light
	_torch_light.omni_range = torch.data.light_range * lerpf(0.7, 1.0, fuel_fade) * lerpf(1.0, weather_light, 0.5)

# ------------------------------------------------------------------------------
# Milestone 8 — vision cone
# ------------------------------------------------------------------------------
func get_aim_direction() -> Vector3:
	return Vector3(_aim_direction.x, 0.0, _aim_direction.z).normalized()

func get_vision_range() -> float:
	return vision_range * WeatherSystem.factor(self, "sight")

## Milestone 9: a cinder-squall gust shoves you downwind.
func apply_gust(impulse: Vector3) -> void:
	if current_state == ActionState.DEAD:
		return
	_knockback_velocity += Vector3(impulse.x, 0.0, impulse.z)
	combat_banner_message.emit("An ember gust staggers you", Color(0.95, 0.56, 0.28))

## True if a world point is inside the cone (or the sense radius) with a clear
## line of sight from eye height.
func can_see_point(world: Vector3) -> bool:
	if not is_inside_tree():
		return false
	var flat := Vector3(world.x - global_position.x, 0.0, world.z - global_position.z)
	var dist: float = flat.length()
	if dist > sense_radius:
		if dist > get_vision_range():
			return false
		if get_aim_direction().dot(flat / dist) < cos(deg_to_rad(vision_half_angle_deg)):
			return false
	var q := PhysicsRayQueryParameters3D.create(global_position + Vector3(0.0, 1.35, 0.0), world, 1)
	q.exclude = [get_rid()]
	return get_world_3d().direct_space_state.intersect_ray(q).is_empty()

## Checks a body at chest and head height so short walls don't hide tall foes.
func can_see_body(body: Node3D) -> bool:
	if body == null or not is_instance_valid(body):
		return false
	return can_see_point(body.global_position + Vector3(0.0, 0.95, 0.0)) or can_see_point(body.global_position + Vector3(0.0, 1.7, 0.0))

func is_torch_lit() -> bool:
	return _torch_light != null and _torch_light.visible

# ------------------------------------------------------------------------------
# Core loop (Milestones 1-3, extended)
# ------------------------------------------------------------------------------
func _update_timers_and_conditions(delta: float) -> void:
	if _dodge_cooldown > 0.0:
		_dodge_cooldown = maxf(0.0, _dodge_cooldown - delta)
	if _throw_cooldown_left > 0.0:
		_throw_cooldown_left = maxf(0.0, _throw_cooldown_left - delta)

	if _poise_timer > 0.0:
		_poise_timer = maxf(0.0, _poise_timer - delta)
		if _poise_timer == 0.0:
			poise_damage_taken = 0.0

	if is_bleeding:
		bleed_timer -= delta
		health = maxf(1.0, health - 1.8 * delta)
		if bleed_timer <= 0.0:
			is_bleeding = false

	if _cough_noise_left > 0.0:
		_cough_noise_left = maxf(0.0, _cough_noise_left - delta)
	if _mods.coughs:
		_cough_timer -= delta
		if _cough_timer <= 0.0:
			_cough()

	if _stamina_delay_timer > 0.0:
		_stamina_delay_timer = maxf(0.0, _stamina_delay_timer - delta)
	elif current_state in [ActionState.IDLE, ActionState.MOVE, ActionState.BLOCK, ActionState.CHANNEL]:
		var rate: float = stamina_regen_rate * _mods.stamina_regen_mult * WeatherSystem.factor(self, "stamina_regen") * (0.38 if current_state == ActionState.BLOCK else 1.0)
		if is_bleeding:
			rate *= 0.75
		if inventory.get_load() == Inventory.Load.OVERBURDENED:
			rate *= 0.7
		stamina = minf(max_stamina, stamina + rate * delta)
		if is_exhausted and stamina >= 18.0:
			is_exhausted = false

func _update_mouse_aim(delta: float) -> void:
	if camera_rig == null:
		return
	var mouse_world: Vector3 = camera_rig.get_mouse_ground_position(global_position.y)
	var to_mouse: Vector3 = mouse_world - global_position
	to_mouse.y = 0.0
	if to_mouse.length_squared() > 0.01:
		var desired_dir: Vector3 = to_mouse.normalized()
		var turn_rate: float = rotation_speed
		if current_state in [ActionState.ATTACK_STARTUP, ActionState.ATTACK_ACTIVE]:
			turn_rate = attack_commit_rotation_speed
		elif current_state in [ActionState.DODGE, ActionState.STAGGER, ActionState.RECOIL, ActionState.LODGED]:
			turn_rate = 0.0
		if turn_rate > 0.0:
			_aim_direction = _aim_direction.slerp(desired_dir, 1.0 - exp(-turn_rate * delta)).normalized()
			_visual_root.look_at(global_position + _aim_direction, Vector3.UP)

func _get_isometric_move_vector() -> Vector3:
	var input_2d := Vector2.ZERO
	if Input.is_action_pressed("move_right"):
		input_2d.x += 1.0
	if Input.is_action_pressed("move_left"):
		input_2d.x -= 1.0
	if Input.is_action_pressed("move_down"):
		input_2d.y += 1.0
	if Input.is_action_pressed("move_up"):
		input_2d.y -= 1.0

	if input_2d.length_squared() < 0.01:
		return Vector3.ZERO
	input_2d = input_2d.normalized()

	var cam_yaw_rad: float = deg_to_rad(camera_rig.yaw_degrees if camera_rig else 45.0)
	var right_axis := Vector3(cos(cam_yaw_rad), 0.0, -sin(cam_yaw_rad))
	var down_axis := Vector3(sin(cam_yaw_rad), 0.0, cos(cam_yaw_rad))
	return (right_axis * input_2d.x + down_axis * input_2d.y).normalized()

func _process_state_machine(delta: float) -> void:
	var move_dir: Vector3 = _get_isometric_move_vector()
	_knockback_velocity = _knockback_velocity.move_toward(Vector3.ZERO, 14.0 * delta)

	match current_state:
		ActionState.IDLE, ActionState.MOVE, ActionState.SPRINT, ActionState.BLOCK:
			_handle_neutral_combat_inputs(move_dir)
			if current_state in NEUTRAL_STATES:
				_apply_locomotion(move_dir, delta)

		ActionState.CHANNEL:
			_process_channel(move_dir, delta)

		ActionState.ATTACK_STARTUP:
			_state_timer -= delta
			velocity = _aim_direction * 0.6 + _knockback_velocity
			var total_startup: float = weapon.heavy_startup_time if _is_current_attack_heavy else weapon.light_startup_time
			if _state_timer > (total_startup * 0.65) and Input.is_action_just_pressed("dodge"):
				if _try_start_dodge(move_dir):
					return
			if _state_timer <= 0.0:
				_enter_attack_active()

		ActionState.ATTACK_ACTIVE:
			_state_timer -= delta
			var impulse: float = weapon.heavy_step_impulse if _is_current_attack_heavy else weapon.light_step_impulse
			velocity = _aim_direction * impulse + _knockback_velocity
			if _state_timer <= 0.0:
				_enter_attack_recovery()

		ActionState.ATTACK_RECOVERY:
			_state_timer -= delta
			velocity = velocity.move_toward(Vector3.ZERO, 16.0 * delta) + _knockback_velocity
			var total_rec: float = weapon.heavy_recovery_time if _is_current_attack_heavy else weapon.light_recovery_time
			if _state_timer < (total_rec * 0.25) and Input.is_action_just_pressed("attack_light") and not ui_capture:
				_queued_light_attack = true
			if _state_timer <= 0.0:
				if _queued_light_attack and not is_exhausted and stamina > 4.0:
					_queued_light_attack = false
					_start_attack(false)
				else:
					_queued_light_attack = false
					current_state = ActionState.IDLE

		ActionState.DODGE:
			_state_timer -= delta
			if _state_timer > 0.14:
				velocity = _dodge_direction * 8.2
			else:
				velocity = _dodge_direction * 2.0
			if _state_timer <= 0.0:
				current_state = ActionState.IDLE

		ActionState.BLOCK_IMPACT:
			_state_timer -= delta
			velocity = _knockback_velocity
			if _state_timer <= 0.0:
				var keep_block: bool = Input.is_action_pressed("block") and _has_ready_shield() and not ui_capture
				current_state = ActionState.BLOCK if keep_block else ActionState.IDLE

		ActionState.STAGGER:
			_state_timer -= delta
			velocity = _knockback_velocity
			if _state_timer <= 0.0:
				current_state = ActionState.IDLE

		ActionState.RECOIL:
			_state_timer -= delta
			velocity = _knockback_velocity
			if _state_timer <= 0.0:
				current_state = ActionState.IDLE

		ActionState.LODGED:
			_state_timer -= delta
			velocity.x = 0.0
			velocity.z = 0.0
			if not ui_capture and Input.is_action_just_pressed("dodge"):
				var lost: String = inventory.main_hand.data.display_name if inventory.main_hand else "weapon"
				_release_lodged_weapon("You let go of the %s and leap clear" % lost)
				current_state = ActionState.IDLE
				_dodge_cooldown = 0.0
				_try_start_dodge(move_dir)
				return
			if _state_timer <= 0.0:
				_finish_lodge_tug()

	if not is_on_floor():
		velocity.y -= 24.0 * delta
	else:
		velocity.y = -0.1

func _handle_neutral_combat_inputs(move_dir: Vector3) -> void:
	if ui_capture:
		if current_state == ActionState.BLOCK:
			current_state = ActionState.IDLE
		return

	if Input.is_action_just_pressed("interact"):
		if _try_interact():
			return

	if Input.is_action_just_pressed("bandage"):
		if start_bandage():
			return

	if Input.is_action_just_pressed("throw"):
		if throw_stone():
			return

	for slot: int in range(1, 5):
		if Input.is_action_just_pressed("equip_slot_%d" % slot):
			_on_slot_key(slot)
			if current_state == ActionState.CHANNEL:
				return

	if Input.is_action_just_pressed("dodge"):
		if _try_start_dodge(move_dir):
			return

	var wants_heavy: bool = Input.is_action_just_pressed("attack_heavy") or (
		Input.is_action_just_pressed("attack_light") and Input.is_key_pressed(KEY_SHIFT)
	)
	if wants_heavy:
		_start_attack(true)
		return

	if Input.is_action_just_pressed("attack_light"):
		_start_attack(false)
		return

	if Input.is_action_pressed("block") and not is_exhausted and _has_ready_shield():
		current_state = ActionState.BLOCK
	else:
		if current_state == ActionState.BLOCK:
			current_state = ActionState.IDLE
		if Input.is_action_just_pressed("block") and not _has_ready_shield():
			combat_banner_message.emit(_block_unavailable_reason(), Color(0.74, 0.66, 0.56))

## Sets horizontal velocity; on icy ground (traction < 1) it eases toward the
## target instead, so you slide.
func _set_planar_velocity(target_x: float, target_z: float, delta: float) -> void:
	var traction: float = WeatherSystem.factor(self, "traction")
	if traction >= 0.99:
		velocity.x = target_x
		velocity.z = target_z
		return
	var k: float = 1.0 - exp(-traction * 14.0 * delta)
	velocity.x = lerpf(velocity.x, target_x, k)
	velocity.z = lerpf(velocity.z, target_z, k)

func _apply_locomotion(move_dir: Vector3, delta: float) -> void:
	var exh_mult: float = exhausted_speed_multiplier if is_exhausted else 1.0
	var load_mult: float = _encumbrance_speed_mult()
	if current_state == ActionState.BLOCK:
		_set_planar_velocity(
			move_dir.x * block_move_speed * exh_mult * load_mult + _knockback_velocity.x,
			move_dir.z * block_move_speed * exh_mult * load_mult + _knockback_velocity.z,
			delta
		)
		return

	var overburdened: bool = inventory.get_load() == Inventory.Load.OVERBURDENED
	var wants_sprint: bool = (
		Input.is_action_pressed("sprint") and move_dir.length_squared() > 0.1
		and not is_exhausted and not overburdened
	)
	if wants_sprint and stamina > 1.0:
		current_state = ActionState.SPRINT
		_consume_stamina(13.5 * delta)
		var spd: float = sprint_speed * _mods.sprint_speed_mult * WeatherSystem.factor(self, "sprint") * load_mult
		_set_planar_velocity(move_dir.x * spd + _knockback_velocity.x, move_dir.z * spd + _knockback_velocity.z, delta)
	elif move_dir.length_squared() > 0.01:
		current_state = ActionState.MOVE
		var walk: float = move_speed * exh_mult * load_mult
		_set_planar_velocity(move_dir.x * walk + _knockback_velocity.x, move_dir.z * walk + _knockback_velocity.z, delta)
	else:
		current_state = ActionState.IDLE
		_set_planar_velocity(_knockback_velocity.x, _knockback_velocity.z, delta)

func _start_attack(heavy: bool) -> void:
	if is_exhausted or stamina < 4.0:
		combat_banner_message.emit("Exhausted — Stamina Depleted", Color(0.85, 0.55, 0.25))
		return
	_is_current_attack_heavy = heavy
	var cost: float = weapon.heavy_stamina_cost if heavy else weapon.light_stamina_cost
	_consume_stamina(cost)
	current_state = ActionState.ATTACK_STARTUP
	_state_timer = weapon.heavy_startup_time if heavy else weapon.light_startup_time

func _enter_attack_active() -> void:
	var obstruction: Dictionary = _sweep_obstruction(_is_current_attack_heavy)
	if not obstruction.is_empty():
		_enter_wall_recoil(obstruction)
		return
	current_state = ActionState.ATTACK_ACTIVE
	_state_timer = weapon.heavy_active_time if _is_current_attack_heavy else weapon.light_active_time
	if audio:
		audio.play_swing()
	AcousticField.report(self, global_position, swing_noise_reach * get_noise_multiplier(), "swing")

	_configure_hitbox(weapon.get_swing_arc(_is_current_attack_heavy))
	var mult: float = _weapon_condition_multiplier()
	var payload := CombatPayload.new(
		self,
		global_position,
		_aim_direction,
		(weapon.heavy_damage if _is_current_attack_heavy else weapon.light_damage) * mult,
		(weapon.heavy_poise_damage if _is_current_attack_heavy else weapon.light_poise_damage) * mult,
		_is_current_attack_heavy and (randf() <= weapon.heavy_bleed_chance),
		_is_current_attack_heavy,
		weapon.heavy_knockback if _is_current_attack_heavy else weapon.light_knockback
	)
	_hitbox.begin_swing(payload)

func _enter_attack_recovery() -> void:
	_hitbox.end_swing()
	current_state = ActionState.ATTACK_RECOVERY
	_state_timer = weapon.heavy_recovery_time if _is_current_attack_heavy else weapon.light_recovery_time

func _try_start_dodge(move_dir: Vector3) -> bool:
	var load_state: Inventory.Load = inventory.get_load()
	if load_state == Inventory.Load.OVERBURDENED:
		combat_banner_message.emit("Overburdened — too heavy to dodge", Color(0.90, 0.40, 0.25))
		return false
	var cost: float = (
		dodge_stamina_cost
		+ (burdened_dodge_extra_cost if load_state == Inventory.Load.BURDENED else 0.0)
		+ WeatherSystem.factor(self, "dodge_extra")
	)
	if is_exhausted or stamina < 8.0 or _dodge_cooldown > 0.0:
		return false
	_hitbox.end_swing()
	_consume_stamina(cost)
	_dodge_cooldown = 0.58
	_dodge_direction = move_dir if move_dir.length_squared() > 0.01 else -_aim_direction
	current_state = ActionState.DODGE
	if load_state == Inventory.Load.BURDENED:
		AcousticField.report(self, global_position, 6.0 * get_noise_multiplier(), "clatter")
	_state_timer = 0.36
	return true

func _consume_stamina(amount: float) -> void:
	stamina = maxf(0.0, stamina - amount)
	if stamina <= 0.01:
		is_exhausted = true
		_stamina_delay_timer = exhausted_regen_delay
	else:
		_stamina_delay_timer = maxf(_stamina_delay_timer, stamina_regen_delay)

func _on_hurtbox_hit_received(payload: CombatPayload) -> void:
	if current_state == ActionState.DEAD:
		return
	if current_state == ActionState.DODGE and _state_timer > 0.16:
		combat_banner_message.emit("Evaded!", Color(0.75, 0.78, 0.82))
		return

	if current_state == ActionState.CHANNEL:
		_cancel_channel("%s — interrupted!" % _channel_label())
	ui_force_close.emit()
	if current_state == ActionState.LODGED:
		var torn: String = inventory.main_hand.data.display_name if inventory.main_hand else "weapon"
		_release_lodged_weapon("The %s is torn from your grip!" % torn)
		current_state = ActionState.IDLE

	var to_attacker: Vector3 = (payload.attacker_origin - global_position)
	to_attacker.y = 0.0
	if to_attacker.length_squared() > 0.001:
		to_attacker = to_attacker.normalized()

	var facing_dot: float = _aim_direction.dot(to_attacker)
	var shield: ItemInstance = inventory.off_hand

	if current_state in [ActionState.BLOCK, ActionState.BLOCK_IMPACT] and _has_ready_shield():
		var block_cos: float = cos(deg_to_rad(shield.data.block_angle_degrees * 0.5))
		if facing_dot >= block_cos:
			var stam_cost: float = payload.poise_damage * shield.data.block_stamina_efficiency * _mods.block_stamina_mult
			_consume_stamina(stam_cost)
			_knockback_velocity = -to_attacker * (payload.knockback_force * 0.7)
			if shield.wear(payload.poise_damage * shield.data.block_wear_per_poise):
				combat_banner_message.emit("Your %s splinters apart!" % shield.data.display_name, Color(0.92, 0.36, 0.22))
				inventory.notify_changed()
			if is_exhausted:
				if audio:
					audio.play_guard_break()
				if camera_rig:
					camera_rig.add_trauma(0.65)
				current_state = ActionState.STAGGER
				_state_timer = 1.05
				combat_banner_message.emit("GUARD BROKEN!", Color(0.92, 0.32, 0.22))
			else:
				if audio:
					audio.play_shield_block()
				AcousticField.report(self, global_position, shield_noise_reach, "shield")
				if camera_rig:
					camera_rig.add_trauma(0.28)
				current_state = ActionState.BLOCK_IMPACT
				_state_timer = 0.22
			return

	_hitbox.end_swing()
	health = maxf(0.0, health - payload.physical_damage)
	poise_damage_taken += payload.poise_damage
	_poise_timer = poise_reset_time
	_knockback_velocity = -to_attacker * payload.knockback_force

	if payload.causes_bleed:
		is_bleeding = true
		bleed_timer = 12.0
		combat_banner_message.emit("Deep Laceration — Bleeding (Press B to Bandage)", Color(0.88, 0.2, 0.2))

	if audio:
		audio.play_flesh_hit()
	if camera_rig:
		camera_rig.add_trauma(0.55 if payload.is_heavy else 0.35)

	if health <= 0.0:
		current_state = ActionState.DEAD
		combat_banner_message.emit("YOU PERISHED IN THE ASHEN WILDS — Press R to Respawn at Shelter", Color(0.9, 0.18, 0.18))
		return

	if poise_damage_taken >= max_poise or payload.is_heavy:
		poise_damage_taken = 0.0
		current_state = ActionState.STAGGER
		_state_timer = 0.62

func _cough() -> void:
	_cough_timer = randf_range(cough_interval_min, cough_interval_max)
	_cough_noise_left = 0.5
	if audio:
		audio.play_cough()
	AcousticField.report(self, global_position, cough_noise_radius, "cough")
	combat_banner_message.emit("You double over coughing — ash in your lungs", Color(0.70, 0.66, 0.58))

func respawn_at_shelter(spawn_pos: Vector3) -> void:
	_clear_channel()
	_hitbox.end_swing()
	_lodged_target = null
	global_position = spawn_pos
	health = max_health
	stamina = max_stamina
	is_exhausted = false
	is_bleeding = false
	poise_damage_taken = 0.0
	current_state = ActionState.IDLE
	combat_banner_message.emit("Awakened at Shelter Fire", Color(0.85, 0.72, 0.45))

func _update_visual_pose(_delta: float) -> void:
	match current_state:
		ActionState.ATTACK_STARTUP:
			var windup_angle: float = 75.0 if _is_current_attack_heavy else 52.0
			_weapon_pivot.rotation_degrees = Vector3(-18.0, windup_angle, 0.0)
			_shield_mesh.position = Vector3(-0.38, 1.05, -0.15)
			_aim_arc_mat.albedo_color = Color(0.88, 0.62, 0.18, 0.55)
		ActionState.ATTACK_ACTIVE:
			_weapon_pivot.rotation_degrees = Vector3(0.0, -68.0, 0.0)
			_aim_arc_mat.albedo_color = Color(0.88, 0.18, 0.15, 0.72)
		ActionState.ATTACK_RECOVERY:
			_weapon_pivot.rotation_degrees = Vector3(12.0, -48.0, 0.0)
			_aim_arc_mat.albedo_color = Color(0.35, 0.35, 0.38, 0.28)
		ActionState.BLOCK, ActionState.BLOCK_IMPACT:
			_weapon_pivot.rotation_degrees = Vector3(-10.0, 15.0, 0.0)
			_shield_mesh.position = Vector3(-0.12, 1.12, -0.45)
			_aim_arc_mat.albedo_color = Color(0.45, 0.62, 0.78, 0.45)
		ActionState.STAGGER:
			_weapon_pivot.rotation_degrees = Vector3(35.0, 60.0, 25.0)
			_shield_mesh.position = Vector3(-0.48, 0.95, 0.1)
			_aim_arc_mat.albedo_color = Color(0.75, 0.22, 0.22, 0.35)
		ActionState.CHANNEL:
			_weapon_pivot.rotation_degrees = Vector3(38.0, 25.0, 0.0)
			_shield_mesh.position = Vector3(-0.42, 0.98, -0.05)
			_aim_arc_mat.albedo_color = Color(0.55, 0.52, 0.45, 0.10)
		ActionState.RECOIL:
			_weapon_pivot.rotation_degrees = Vector3(-35.0, 70.0, -20.0)
			_shield_mesh.position = Vector3(-0.44, 1.0, 0.0)
			_aim_arc_mat.albedo_color = Color(0.95, 0.55, 0.15, 0.45)
		ActionState.LODGED:
			_weapon_pivot.rotation_degrees = Vector3(28.0, -30.0, 0.0)
			_aim_arc_mat.albedo_color = Color(0.70, 0.30, 0.22, 0.35)
		_:
			_weapon_pivot.rotation_degrees = Vector3(0.0, 0.0, 0.0)
			_shield_mesh.position = Vector3(-0.36, 1.05, -0.22)
			if _cramped:
				# Your next sweep will hit the wall: warn before you commit.
				_aim_arc_mat.albedo_color = Color(0.86, 0.45, 0.16, 0.34)
			else:
				_aim_arc_mat.albedo_color = Color(0.65, 0.62, 0.55, 0.24)

func _build_survivor_visuals_and_colliders() -> void:
	collision_layer = 2
	collision_mask = 1 | 2 | 4

	var body_col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.36
	cap.height = 1.75
	body_col.shape = cap
	body_col.position = Vector3(0.0, 0.88, 0.0)
	add_child(body_col)

	_visual_root = Node3D.new()
	_visual_root.name = "VisualRoot"
	add_child(_visual_root)

	var torso_mat := StandardMaterial3D.new()
	torso_mat.albedo_color = Color(0.24, 0.21, 0.19)
	torso_mat.roughness = 0.88

	var torso := MeshInstance3D.new()
	var torso_mesh := CapsuleMesh.new()
	torso_mesh.radius = 0.33
	torso_mesh.height = 1.35
	torso.mesh = torso_mesh
	torso.material_override = torso_mat
	torso.position = Vector3(0.0, 0.82, 0.0)
	_visual_root.add_child(torso)

	var helm_mat := StandardMaterial3D.new()
	helm_mat.albedo_color = Color(0.36, 0.35, 0.34)
	helm_mat.metallic = 0.45
	helm_mat.roughness = 0.65

	var helm := MeshInstance3D.new()
	var helm_mesh := SphereMesh.new()
	helm_mesh.radius = 0.24
	helm_mesh.height = 0.44
	helm.mesh = helm_mesh
	helm.material_override = helm_mat
	helm.position = Vector3(0.0, 1.58, 0.0)
	_visual_root.add_child(helm)

	_shield_mat = StandardMaterial3D.new()
	_shield_mat.albedo_color = Color(0.32, 0.23, 0.16)
	_shield_mat.roughness = 0.9
	_shield_mesh = MeshInstance3D.new()
	var s_box := BoxMesh.new()
	s_box.size = Vector3(0.12, 0.62, 0.52)
	_shield_mesh.mesh = s_box
	_shield_mesh.material_override = _shield_mat
	_shield_mesh.position = Vector3(-0.36, 1.05, -0.22)
	_visual_root.add_child(_shield_mesh)

	# Off-hand torch (handle + flame)
	_torch_root = Node3D.new()
	_torch_root.name = "TorchRoot"
	_torch_root.position = Vector3(-0.36, 1.05, -0.30)
	_torch_root.rotation_degrees = Vector3(-25.0, 0.0, 0.0)
	_visual_root.add_child(_torch_root)
	var handle_mat := StandardMaterial3D.new()
	handle_mat.albedo_color = Color(0.22, 0.15, 0.10)
	handle_mat.roughness = 0.95
	var handle := MeshInstance3D.new()
	var handle_mesh := CylinderMesh.new()
	handle_mesh.top_radius = 0.045
	handle_mesh.bottom_radius = 0.035
	handle_mesh.height = 0.62
	handle.mesh = handle_mesh
	handle.material_override = handle_mat
	_torch_root.add_child(handle)
	var flame_mat := StandardMaterial3D.new()
	flame_mat.albedo_color = Color(1.0, 0.62, 0.22)
	flame_mat.emission_enabled = true
	flame_mat.emission = Color(1.0, 0.55, 0.18)
	flame_mat.emission_energy_multiplier = 3.0
	flame_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_torch_flame = MeshInstance3D.new()
	var flame_mesh := SphereMesh.new()
	flame_mesh.radius = 0.09
	flame_mesh.height = 0.22
	_torch_flame.mesh = flame_mesh
	_torch_flame.material_override = flame_mat
	_torch_flame.position = Vector3(0.0, 0.38, 0.0)
	_torch_root.add_child(_torch_flame)

	_weapon_pivot = Node3D.new()
	_weapon_pivot.position = Vector3(0.34, 1.05, -0.15)
	_visual_root.add_child(_weapon_pivot)

	_blade_mat = StandardMaterial3D.new()
	_blade_mat.albedo_color = Color(0.52, 0.50, 0.48)
	_blade_mat.metallic = 0.65
	_blade_mat.roughness = 0.52

	_weapon_mesh = MeshInstance3D.new()
	_weapon_box = BoxMesh.new()
	_weapon_box.size = Vector3(0.08, 0.08, 1.25)
	_weapon_mesh.mesh = _weapon_box
	_weapon_mesh.material_override = _blade_mat
	_weapon_mesh.position = Vector3(0.0, 0.0, -0.68)
	_weapon_pivot.add_child(_weapon_mesh)

	_aim_arc_mat = StandardMaterial3D.new()
	_aim_arc_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_aim_arc_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_aim_arc_mat.albedo_color = Color(0.65, 0.62, 0.55, 0.24)

	_aim_arc_mesh = MeshInstance3D.new()
	var arc_prism := PrismMesh.new()
	arc_prism.size = Vector3(1.15, 1.55, 0.02)
	_aim_arc_mesh.mesh = arc_prism
	_aim_arc_mesh.material_override = _aim_arc_mat
	_aim_arc_mesh.rotation_degrees = Vector3(90.0, 180.0, 0.0)
	_aim_arc_mesh.position = Vector3(0.0, 0.04, -0.95)
	_visual_root.add_child(_aim_arc_mesh)

	# The light lives at the flame in the off-hand. (It used to sit at the body's
	# centre, inside the torso mesh, which self-shadowed the survivor black and
	# threw a huge dark wedge across rooms.)
	_torch_light = OmniLight3D.new()
	_torch_light.light_color = Color(0.95, 0.62, 0.28)
	_torch_light.light_energy = 1.35
	_torch_light.omni_range = 7.5
	_torch_light.shadow_enabled = true
	_torch_light.position = Vector3(0.0, 0.48, 0.0)
	_torch_root.add_child(_torch_light)

	_hitbox = HitboxComponent.new()
	_hitbox.owner_entity = self
	_hitbox.collision_layer = 0
	_hitbox.collision_mask = 16
	_hitbox_col = CollisionShape3D.new()
	_hitbox_shape = BoxShape3D.new()
	_hitbox_col.shape = _hitbox_shape
	_hitbox.add_child(_hitbox_col)
	_visual_root.add_child(_hitbox)
	_configure_hitbox(weapon.swing_arc_degrees)
	_hitbox.confirmed_hit.connect(_on_confirmed_hit_landed)

	_hurtbox = HurtboxComponent.new()
	_hurtbox.owner_entity = self
	_hurtbox.collision_layer = 8
	_hurtbox.collision_mask = 0
	var hurt_shape := CollisionShape3D.new()
	var hurt_cap := CapsuleShape3D.new()
	hurt_cap.radius = 0.42
	hurt_cap.height = 1.75
	hurt_shape.shape = hurt_cap
	hurt_shape.position = Vector3(0.0, 0.88, 0.0)
	_hurtbox.add_child(hurt_shape)
	add_child(_hurtbox)
	_hurtbox.hit_received.connect(_on_hurtbox_hit_received)

func _on_confirmed_hit_landed(target: Node3D, payload: CombatPayload) -> void:
	if audio:
		audio.play_flesh_hit()
	if camera_rig:
		camera_rig.add_trauma(0.38 if payload.is_heavy else 0.22)
	var main: ItemInstance = inventory.main_hand
	if main != null and main.data.has_durability():
		var amount: float = (2.0 if payload.is_heavy else 1.0) * main.data.wear_per_hit * _mods.weapon_wear_mult
		if main.wear(amount):
			combat_banner_message.emit("Your %s has BROKEN" % main.data.display_name, Color(0.92, 0.36, 0.22))
			inventory.notify_changed()

	# Over-commitment: a heavy blow that kills or staggers may bite too deep.
	if (
		payload.is_heavy
		and current_state == ActionState.ATTACK_ACTIVE
		and main != null
		and weapon.heavy_lodge_chance > 0.0
		and _target_dead_or_staggered(target)
		and randf() < weapon.heavy_lodge_chance
	):
		_enter_lodged(target)

func _emit_stats() -> void:
	var main: ItemInstance = inventory.main_hand
	var off: ItemInstance = inventory.off_hand
	var prompt: String = ""
	if _nearest_lootable != null and current_state in NEUTRAL_STATES and not ui_capture:
		prompt = _nearest_lootable.get_prompt()
	stats_changed.emit({
		"health": health,
		"max_health": max_health,
		"stamina": stamina,
		"max_stamina": max_stamina,
		"poise": max_poise - poise_damage_taken,
		"max_poise": max_poise,
		"state": ActionState.keys()[current_state],
		"exhausted": is_exhausted,
		"bleeding": is_bleeding,
		"main_label": main.get_label() if main else "Bare Fists",
		"main_broken": main.is_broken() if main else false,
		"off_label": off.get_label() if off else "— empty —",
		"off_active": _offhand_active(),
		"weight": inventory.total_weight(),
		"capacity": inventory.capacity_kg,
		"hard_limit": inventory.hard_limit_kg(),
		"load": Inventory.Load.keys()[inventory.get_load()],
		"bandages": inventory.count_of("clean_rag_bandage"),
		"channel_label": _channel_label() if current_state == ActionState.CHANNEL else "",
		"channel_progress": get_channel_progress(),
		"prompt": prompt,
		"cramped": _cramped,
		"lodged": current_state == ActionState.LODGED,
		"coughing": is_coughing(),
		"background": background.display_name if background else ""
	})

# ------------------------------------------------------------------------------
# Milestone 5 — wall & corridor deflection
# ------------------------------------------------------------------------------
## Raycasts across the swing arc at blade height. Returns the first wall hit
## (a PhysicsDirectSpaceState3D ray result) or {} if the arc is clear.
## Thrusts never clang.
func _sweep_obstruction(heavy: bool) -> Dictionary:
	if weapon == null or weapon.is_thrust(heavy):
		return {}
	return SwingGeometry.sweep_obstruction(self, _aim_direction, weapon.get_swing_arc(heavy), weapon.reach_meters)

func is_cramped() -> bool:
	return _cramped

func _enter_wall_recoil(hit: Dictionary) -> void:
	_hitbox.end_swing()
	_queued_light_attack = false
	current_state = ActionState.RECOIL
	_state_timer = wall_recoil_time * _mods.recoil_time_mult

	var normal: Vector3 = SwingGeometry.recoil_normal(hit, _aim_direction)
	_knockback_velocity = normal * 2.2

	var main: ItemInstance = inventory.main_hand
	var name_text: String = main.data.display_name if main else "fist"
	var broke: bool = false
	if main != null and main.data.has_durability():
		var clang_mult: float = _mods.clang_wear_mult if _mods.clang_wear_mult >= 0.0 else wall_clang_wear_mult
		var amount: float = clang_mult * main.data.wear_per_hit * _mods.weapon_wear_mult * (2.0 if _is_current_attack_heavy else 1.0)
		broke = main.wear(amount)
	if broke:
		combat_banner_message.emit("Your %s clangs off the wall and BREAKS" % name_text, Color(0.92, 0.36, 0.22))
		inventory.notify_changed()
	else:
		combat_banner_message.emit("Your %s clangs off the wall — too cramped to swing" % name_text, Color(0.92, 0.62, 0.30))

	if audio:
		audio.play_wall_clang()
	AcousticField.report(self, global_position, 13.0, "clang")
	if camera_rig:
		camera_rig.add_trauma(0.32)
	_spawn_sparks(hit.get("position", global_position + _aim_direction), normal)

func _spawn_sparks(at: Vector3, normal: Vector3) -> void:
	SwingGeometry.spawn_sparks(get_parent(), at, normal)

# ------------------------------------------------------------------------------
# Milestone 5 — weapon lodging
# ------------------------------------------------------------------------------
func _target_dead_or_staggered(target: Node3D) -> bool:
	if target == null or not is_instance_valid(target):
		return false
	if target.has_method("is_dead") and target.is_dead():
		return true
	return target.has_method("is_staggered") and target.is_staggered()

func _enter_lodged(target: Node3D) -> void:
	_hitbox.end_swing()
	_lodged_target = target
	current_state = ActionState.LODGED
	_state_timer = lodge_tug_time
	var host: String = "it"
	if target.get("enemy_name") != null:
		host = "the " + String(target.get("enemy_name"))
	if audio:
		audio.play_lodge_thud()
	combat_banner_message.emit(
		"Your %s lodges in %s — wrenching free…  [Space] let go" % [inventory.main_hand.data.display_name, host],
		Color(0.92, 0.58, 0.30)
	)

func get_lodged_target() -> Node3D:
	return _lodged_target if current_state == ActionState.LODGED else null

func _finish_lodge_tug() -> void:
	_lodged_target = null
	var main: ItemInstance = inventory.main_hand
	if main != null and main.wear(main.data.wear_per_hit * _mods.weapon_wear_mult):
		combat_banner_message.emit("You wrench the %s free — it snaps" % main.data.display_name, Color(0.92, 0.36, 0.22))
		inventory.notify_changed()
	current_state = ActionState.ATTACK_RECOVERY
	_state_timer = weapon.heavy_recovery_time * 0.5

## Leaves the main-hand weapon stuck in the target (or on the ground) as a
## lootable you can work loose later.
func _release_lodged_weapon(message: String) -> void:
	var target: Node3D = _lodged_target
	_lodged_target = null
	var main: ItemInstance = inventory.main_hand
	if main == null:
		return
	var host: String = "the ground"
	var pos: Vector3 = global_position + _aim_direction * 1.2
	if target != null and is_instance_valid(target):
		pos = target.global_position
		if target.get("enemy_name") != null:
			host = "a " + String(target.get("enemy_name"))
	var toward_player: Vector3 = global_position - pos
	toward_player.y = 0.0
	if toward_player.length() > 0.6:
		pos += toward_player.normalized() * 0.4
	pos.y = global_position.y
	var removed: ItemInstance = inventory.remove(main)
	Lootable.spawn_lodged_weapon(get_parent(), pos, removed, host)
	combat_banner_message.emit(message, Color(0.92, 0.48, 0.26))
