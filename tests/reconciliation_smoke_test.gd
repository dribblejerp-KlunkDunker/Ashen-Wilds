extends "res://tests/smoke_test.gd"
## Runs the inherited smoke suite with Ogre cleanup coverage before Act I.
## Run after import:
## godot --headless --path . --script res://tests/reconciliation_smoke_test.gd
## The original smoke_test.gd remains unchanged.

func _test_act_one() -> void:
	await _test_ogre_target_cleanup_port()
	await super._test_act_one()

func _test_ogre_target_cleanup_port() -> void:
	_section("Reconciliation: Ogre target-loss cleanup")
	var coord: EncounterCoordinator = _children_of(
		func(n: Node) -> bool: return n is EncounterCoordinator
	)[0]
	var saved_holders: Dictionary = coord._active_holders.duplicate()
	var saved_cooldown: float = coord._cooldown_timer
	var saved_player_state: PlayerController.ActionState = _player.current_state

	var ogre := EnemyOgreBrute.new()
	ogre.process_mode = Node.PROCESS_MODE_DISABLED
	ogre.position = Vector3(-12.0, 0.0, 18.0)
	_main.add_child(ogre)
	ogre.coordinator = coord
	var other := Node3D.new()
	_main.add_child(other)
	var states: Array[EnemyOgreBrute.AIState] = [
		EnemyOgreBrute.AIState.SLAM_STARTUP,
		EnemyOgreBrute.AIState.SLAM_ACTIVE,
		EnemyOgreBrute.AIState.SWEEP_STARTUP,
		EnemyOgreBrute.AIState.SWEEP_ACTIVE,
	]

	for missing_target: bool in [false, true]:
		for attack_state: EnemyOgreBrute.AIState in states:
			var label: String = "%s / %s" % [
				"missing target" if missing_target else "dead player",
				EnemyOgreBrute.AIState.keys()[attack_state],
			]
			coord._active_holders.clear()
			coord._cooldown_timer = 0.0
			ogre.player_ref = _player
			ogre.state = attack_state
			ogre.velocity = Vector3(2.0, 0.0, 1.0)
			_player.current_state = PlayerController.ActionState.IDLE
			var active: bool = attack_state in [
				EnemyOgreBrute.AIState.SLAM_ACTIVE,
				EnemyOgreBrute.AIState.SWEEP_ACTIVE,
			]
			if active:
				ogre._hitbox.begin_swing(CombatPayload.new(
					ogre, ogre.global_position, Vector3.FORWARD, 1.0, 1.0
				))
			else:
				ogre._hitbox.end_swing()
			ogre._slam_ring.visible = attack_state in [
				EnemyOgreBrute.AIState.SLAM_STARTUP,
				EnemyOgreBrute.AIState.SLAM_ACTIVE,
			]
			_check(coord.request_attack_token(ogre, true),
				"%s: setup acquires token" % label)
			_check(ogre._hitbox._is_swing_active == active,
				"%s: setup matches attack phase" % label)
			if missing_target:
				ogre.player_ref = null
			else:
				_player.current_state = PlayerController.ActionState.DEAD
			ogre._process_ai_state(0.0)
			_check(ogre.state == EnemyOgreBrute.AIState.IDLE,
				"%s: returns to idle" % label)
			_check(ogre.velocity == Vector3.ZERO,
				"%s: movement stops" % label)
			_check(not ogre._hitbox._is_swing_active,
				"%s: hitbox closes" % label)
			_check(not ogre._slam_ring.visible,
				"%s: slam ring hides" % label)
			_check(not coord._active_holders.has(ogre.get_instance_id()),
				"%s: token releases" % label)
			var cooldown: float = coord._cooldown_timer
			ogre._process_ai_state(0.0)
			_check(is_equal_approx(coord._cooldown_timer, cooldown),
				"%s: idle repeat preserves cooldown" % label)
			_check(not coord.request_attack_token(other),
				"%s: readability gap blocks immediate grant" % label)
			coord._physics_process(coord.min_readability_gap_seconds + 0.01)
			_check(coord.request_attack_token(other),
				"%s: another attacker obtains token after gap" % label)
			coord.release_attack_token(other)

	_player.current_state = saved_player_state
	coord._active_holders = saved_holders
	coord._cooldown_timer = saved_cooldown
	ogre.queue_free()
	other.queue_free()
	await _ticks(2)
