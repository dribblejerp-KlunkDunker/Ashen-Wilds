extends "res://tests/smoke_test.gd"
## Standalone regression runner; existing smoke assertions are unchanged.
## Run after import: godot --headless --path . --script res://tests/ogre_target_cleanup_test.gd
## Direct state-machine checks, not a live combat or graphical test.

func _run() -> void:
	_main = (load("res://main.tscn") as PackedScene).instantiate()
	_main.set("show_background_picker", false)
	_main.set("weather_cycle_enabled", false)
	_main.set("day_cycle_enabled", false)
	_main.set("survival_enabled", false)
	_main.process_mode = Node.PROCESS_MODE_DISABLED
	root.add_child(_main)
	await _ticks(5)
	_player = _children_of(func(n: Node) -> bool: return n is PlayerController)[0]
	var ogre: EnemyOgreBrute = _children_of(func(n: Node) -> bool: return n is EnemyOgreBrute)[0]
	var coord: EncounterCoordinator = _children_of(func(n: Node) -> bool: return n is EncounterCoordinator)[0]
	var other := Node3D.new()
	_main.add_child(other)
	var attack_states: Array[int] = [
		EnemyOgreBrute.AIState.SLAM_STARTUP,
		EnemyOgreBrute.AIState.SLAM_ACTIVE,
		EnemyOgreBrute.AIState.SWEEP_STARTUP,
		EnemyOgreBrute.AIState.SWEEP_ACTIVE,
	]
	for target_missing: bool in [false, true]:
		for attack_state: int in attack_states:
			var label: String = "%s / %s" % [
				"missing target" if target_missing else "dead player",
				EnemyOgreBrute.AIState.keys()[attack_state],
			]
			_section(label)
			coord._active_holders.clear()
			coord._cooldown_timer = 0.0
			_player.current_state = PlayerController.ActionState.IDLE
			ogre.player_ref = _player
			ogre.coordinator = coord
			ogre.state = attack_state
			ogre.velocity = Vector3(2.0, 0.0, 1.0)
			var active: bool = attack_state in [EnemyOgreBrute.AIState.SLAM_ACTIVE, EnemyOgreBrute.AIState.SWEEP_ACTIVE]
			if active:
				ogre._hitbox.begin_swing(CombatPayload.new(ogre, ogre.global_position, Vector3.FORWARD, 1.0, 1.0))
			else:
				ogre._hitbox.end_swing()
			ogre._slam_ring.visible = attack_state in [EnemyOgreBrute.AIState.SLAM_STARTUP, EnemyOgreBrute.AIState.SLAM_ACTIVE]
			_check(coord.request_attack_token(ogre, true), "setup: Ogre owns attack token")
			_check(ogre._hitbox._is_swing_active == active, "setup: hitbox matches attack phase")
			if target_missing:
				ogre.player_ref = null
			else:
				_player.current_state = PlayerController.ActionState.DEAD
			ogre._process_ai_state(0.0)
			_check(ogre.state == EnemyOgreBrute.AIState.IDLE, "target lost: Ogre returns to idle")
			_check(ogre.velocity == Vector3.ZERO, "target lost: movement stops")
			_check(not ogre._hitbox._is_swing_active, "target lost: hitbox is closed")
			_check(not ogre._slam_ring.visible, "target lost: slam ring is hidden")
			_check(not coord._active_holders.has(ogre.get_instance_id()), "target lost: attack token released")
			var cooldown: float = coord._cooldown_timer
			ogre._process_ai_state(0.0)
			_check(is_equal_approx(coord._cooldown_timer, cooldown), "idle repeats do not restart readability gap")
			_check(not coord.request_attack_token(other), "readability gap still blocks immediate re-grant")
			coord._physics_process(coord.min_readability_gap_seconds + 0.01)
			_check(coord.request_attack_token(other), "another attacker can obtain the token after the gap")
			coord.release_attack_token(other)
	print("\n--- Ogre cleanup: %d passed, %d failure(s) ---" % [_passes, _fails])
	_main.queue_free()
	await process_frame
	quit(1 if _fails > 0 else 0)
