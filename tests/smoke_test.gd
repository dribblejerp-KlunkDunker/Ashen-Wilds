extends SceneTree
# Headless smoke test for Ashen Wilds.
# Run: godot --headless --path . --script res://tests/smoke_test.gd

var _main: Node3D
var _frame: int = 0
var _fails: int = 0
var _player: PlayerController
var _goblin: EnemyGoblinScavenger
var _attack_phys_frame: int = -1
var _checked_return: bool = false

func _initialize() -> void:
	_main = (load("res://main.tscn") as PackedScene).instantiate()
	root.add_child(_main)

func _check(cond: bool, label: String) -> void:
	if cond:
		print("PASS  ", label)
	else:
		_fails += 1
		print("FAIL  ", label)

func _find_all(cls_check: Callable) -> Array:
	var out: Array = []
	for c in _main.get_children():
		if cls_check.call(c):
			out.append(c)
	return out

func _process(_delta: float) -> bool:
	_frame += 1

	if _frame == 5:
		print("--- Spawn positions after 5 frames ---")
		for c in _main.get_children():
			if c is PlayerController or c is EnemyGoblinScavenger or c is EnemyOrkWarrior or c is EnemyOgreBrute:
				print("  %-28s %s" % [c.get_script().get_global_name(), c.global_position])
		_player = _find_all(func(n): return n is PlayerController)[0]
		var gobs := _find_all(func(n): return n is EnemyGoblinScavenger)
		_goblin = gobs[0]
		_check(_player.global_position.distance_to(Vector3(-6.5, 0, 6.5)) < 0.6, "player spawned at shelter (-6.5, 0, 6.5)")
		_check(_goblin.global_position.distance_to(Vector3(-1.2, 0, -3.2)) < 1.5, "yard goblin spawned near (-1.2, 0, -3.2)")
		var ogre: EnemyOgreBrute = _find_all(func(n): return n is EnemyOgreBrute)[0]
		_check(ogre.global_position.distance_to(Vector3(-13.5, 0, -11.5)) < 1.0, "ogre spawned in lair (-13.5, 0, -11.5)")
		_check(ogre._home_pos.distance_to(Vector3(-13.5, 0, -11.5)) < 1.0, "ogre home position recorded correctly")

	if _frame == 20:
		# Direct hurtbox hit on goblin to test the damage pipeline.
		var hp_before: float = _goblin.health
		var payload := CombatPayload.new(_player, _player.global_position, Vector3.FORWARD, 22.0, 18.0)
		_goblin._hurtbox.receive_attack(payload)
		_check(_goblin.health < hp_before, "goblin takes damage via hurtbox (%.0f -> %.0f)" % [hp_before, _goblin.health])

	if _frame == 30:
		var st_before: float = _player.stamina
		_player._start_attack(false)
		_check(_player.current_state == PlayerController.ActionState.ATTACK_STARTUP, "light attack enters STARTUP")
		_check(_player.stamina < st_before, "light attack consumes stamina")
		_attack_phys_frame = Engine.get_physics_frames()

	# Light attack total = 0.24 + 0.14 + 0.34 = 0.72s -> check after 60 physics ticks (1.0s).
	if _attack_phys_frame >= 0 and not _checked_return and Engine.get_physics_frames() - _attack_phys_frame >= 60:
		_checked_return = true
		_check(_player.current_state in [PlayerController.ActionState.IDLE, PlayerController.ActionState.MOVE], "attack sequence returns to IDLE (state=%s)" % PlayerController.ActionState.keys()[_player.current_state])

	if _frame == 100:
		var coord: EncounterCoordinator = _find_all(func(n): return n is EncounterCoordinator)[0]
		var a := Node3D.new(); var b := Node3D.new()
		root.add_child(a); root.add_child(b)
		coord._cooldown_timer = 0.0
		_check(coord.request_attack_token(a), "coordinator grants first token")
		_check(not coord.request_attack_token(b), "coordinator denies second simultaneous token")
		coord.release_attack_token(a)
		_check(not coord.request_attack_token(b), "readability gap blocks immediate re-grant")
		a.queue_free(); b.queue_free()

	if _frame >= 140 and _checked_return:
		print("--- %d failure(s) ---" % _fails)
		quit(1 if _fails > 0 else 0)
	return false
