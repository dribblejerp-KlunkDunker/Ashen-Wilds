extends SceneTree
## Run after Godot 4.3 import: --headless --path . --script res://tests/test_env010_walkplane.gd
signal drive_finished
var _failures: Array[String] = []
var _checks: int = 0
var _player: NetPlayer
var _goals: Array[Vector3] = []
var _driving: bool = false
var _goal_index: int = 0
var _leg_ticks: int = 0
var _integrations: int = 0
var _max_y_error: float = 0.0
var _blockers: Dictionary = {}

func _initialize() -> void:
    call_deferred("_run")

func _check(ok: bool, label: String) -> void:
    _checks += 1
    if not ok:
        _failures.append(label)
        printerr("FAIL: " + label)

func _point(value: Array) -> Vector3:
    return Vector3(float(value[0]), float(value[1]), float(value[2]))

func _physics_process(delta: float) -> bool:
    if not _driving:
        return false
    var offset: Vector3 = _goals[_goal_index] - _player.position
    offset.y = 0.0
    if offset.length() <= 0.025:
        _goal_index += 1
        _leg_ticks = 0
        if _goal_index == _goals.size():
            _driving = false
            drive_finished.emit()
        return false
    _leg_ticks += 1
    if _leg_ticks > 600:
        _check(false, "Route blocked at leg " + str(_goal_index) + " position=" + str(_player.position) + " colliders=" + str(_blockers.keys()))
        _driving = false
        drive_finished.emit()
        return false
    var intent: Vector3 = offset.normalized() * minf(1.0, offset.length() / (NetProtocol.WALK_SPEED * delta))
    _player.integrate(intent, delta)
    _integrations += 1
    _max_y_error = maxf(_max_y_error, absf(_player.position.y))
    for i in range(_player.get_slide_collision_count()):
        var hit: KinematicCollision3D = _player.get_slide_collision(i)
        var collider: Object = hit.get_collider()
        if collider is Node:
            _blockers[str((collider as Node).get_path())] = true
    return false

func _run() -> void:
    var packed := load("res://scenes/environment/env010_watchhouse_courtyard.tscn") as PackedScene
    _check(packed != null, "Load activated preview scene")
    if packed == null:
        _finish()
        return
    var layout := packed.instantiate() as Node3D
    _check(layout != null, "Preview root is Node3D")
    if layout == null:
        _finish()
        return
    layout.set("preview_services", false)
    root.add_child(layout)
    await physics_frame
    await physics_frame
    var report: Dictionary = layout.get_meta("env010_build_report", {})
    _check(bool(report.get("revision_applied", false)), "Overlay applied without builder issues")
    _check(int(report.get("instances", 0)) == 79, "79 layout instances")
    var data: Dictionary = layout.get("_data")
    var props: Node = layout.get_node_or_null("Props")
    if not bool(report.get("revision_applied", false)) or props == null:
        layout.free()
        _finish()
        return
    var revision: Dictionary = layout.get("_revision")
    var y_changes: Dictionary = revision.instance_y_overrides_m
    for id in y_changes:
        var item := props.get_node_or_null(NodePath(id)) as Node3D
        _check(item != null, "Retained ID " + id)
        if item != null:
            _check(is_equal_approx(item.position.y, float(y_changes[id])), "Applied Y " + id)
    for i in range(1, 4):
        var floor_node: Node = props.get_node("env010_floor_" + str(i))
        _check(not floor_node is CollisionObject3D and floor_node.find_children("*", "CollisionObject3D", true, false).is_empty(), "Paving visual has no physics body " + str(i))
    var ramp: Node = props.get_node("env010_entry_ramp")
    var ramp_shapes: int = 0
    for child in ramp.get_children():
        if child is CollisionShape3D:
            ramp_shapes += 1
            _check((child as CollisionShape3D).disabled, "Transition collider disabled")
    _check(ramp_shapes == 1, "Retained transition fixture shape")
    var ground: Node = props.get_node("env010_ground")
    var route: Array = data.reserved_route.waypoints_m
    _check(route.size() == 7, "Seven reserved route waypoints")
    if route.size() != 7:
        layout.free()
        _finish()
        return
    for value in route:
        var point: Vector3 = _point(value)
        _check(is_zero_approx(point.y), "Route uses Y=0")
        var query := PhysicsRayQueryParameters3D.create(point + Vector3(0,0.15,0), point - Vector3(0,0.25,0), 1)
        query.collide_with_areas = false
        var contact: Dictionary = layout.get_world_3d().direct_space_state.intersect_ray(query)
        _check(contact.get("collider") == ground, "Ground is route walking surface " + str(point))
        if not contact.is_empty():
            var position: Vector3 = contact.position
            _check(absf(position.y) < 0.0001, "Ground contact Y=0")
    _player = NetPlayer.create(1, "env010-traversal-test", _point(route[0]), 0.0, Color(0.6,0.7,0.6))
    root.add_child(_player)
    await physics_frame
    await physics_frame
    var capsule_count: int = 0
    for child in _player.get_children():
        if child is CollisionShape3D:
            var shape: Shape3D = (child as CollisionShape3D).shape
            if shape is CapsuleShape3D:
                capsule_count += 1
                var capsule := shape as CapsuleShape3D
                _check(is_equal_approx(capsule.radius, 0.35) and is_equal_approx(capsule.height, 1.7), "Unmodified real player capsule")
    _check(capsule_count == 1, "One real controller capsule")
    for i in range(1, route.size()):
        _goals.append(_point(route[i]))
    for i in range(route.size() - 2, -1, -1):
        _goals.append(_point(route[i]))
    _driving = true
    await drive_finished
    _check(_goal_index == _goals.size() and _goals.size() == 12, "Exterior-to-supply-approach-and-return completed")
    _check(_integrations > 0, "Movement used real NetPlayer.integrate")
    _check(_max_y_error < 0.0001, "Controller remained on Y=0")
    _check(_player.position.distance_to(_point(route[0])) <= 0.025, "Returned to initial exterior position")
    _player.free()
    layout.free()
    await physics_frame
    _finish()

func _finish() -> void:
    var result: Dictionary = {"passed":_failures.is_empty(),"checks":_checks,"failures":_failures,"reached_route_legs":_goal_index,"integrate_calls":_integrations,"maximum_y_error_m":_max_y_error,"collision_nodes":_blockers.keys(),"engine":Engine.get_version_info(),"scope":"Actual unchanged controller in static ENV-010 preview; no live loot, moving door, multiplayer, rendered visual or performance certification"}
    var output := FileAccess.open("user://env010-walkplane-validation-report.json", FileAccess.WRITE)
    if output == null:
        _check(false, "Write validation report")
    else:
        output.store_string(JSON.stringify(result, "  "))
        output.close()
    print("ENV010_WALKPLANE_VALIDATION checks=", _checks, " failures=", _failures.size())
    quit(0 if _failures.is_empty() else 1)
