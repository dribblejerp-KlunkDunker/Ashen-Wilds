extends SceneTree

var failures: Array[String] = []
var checks: int = 0
var loaded_cases: int = 0

func _initialize() -> void:
    call_deferred("_run")

func _expect(ok: bool, label: String) -> void:
    checks += 1
    if not ok:
        failures.append(label)
        printerr("FAIL: " + label)

func _meshes(node: Node) -> int:
    var count: int = 1 if node is MeshInstance3D else 0
    for child in node.get_children():
        count += _meshes(child)
    return count

func _ray(body: StaticBody3D, a: Vector3, b: Vector3) -> Dictionary:
    var q := PhysicsRayQueryParameters3D.create(body.to_global(a), body.to_global(b), 1)
    q.collide_with_areas = false
    return body.get_world_3d().direct_space_state.intersect_ray(q)

func _hit(body: StaticBody3D, a: Vector3, b: Vector3) -> bool:
    return _ray(body, a, b).get("collider") == body

func _sphere(body: StaticBody3D, point: Vector3) -> bool:
    var shape := SphereShape3D.new()
    shape.radius = 0.015
    var q := PhysicsShapeQueryParameters3D.new()
    q.shape = shape
    q.transform = Transform3D(Basis.IDENTITY, body.to_global(point))
    q.collision_mask = 1
    q.collide_with_areas = false
    return not body.get_world_3d().direct_space_state.intersect_shape(q, 8).is_empty()

func _run() -> void:
    var path := "res://assets/environment/env006/collision-manifest.json"
    if not FileAccess.file_exists(path):
        _expect(false, "manifest exists")
        _finish()
        return
    var data = JSON.parse_string(FileAccess.get_file_as_string(path))
    if not data is Dictionary or not data.has("assets"):
        _expect(false, "manifest parses")
        _finish()
        return
    _expect(data.assets.size() == 30 and int(data.total_shapes) == 145, "30 scenes / 145 boxes")
    var holder := Node3D.new()
    root.add_child(holder)
    for record in data.assets:
        var packed = load("res://assets/environment/env006/" + str(record.scene)) as PackedScene
        if packed == null:
            _expect(false, "scene load: " + str(record.id))
            continue
        for pose in [0, 1]:
            var instance = packed.instantiate()
            if instance == null:
                _expect(false, "scene instantiate")
                continue
            if not instance is StaticBody3D:
                _expect(false, "static root")
                instance.free()
                continue
            var body: StaticBody3D = instance
            holder.add_child(body)
            if pose == 1:
                body.position = Vector3(3, 2, -2)
                body.rotation.y = PI / 2.0
            await physics_frame
            await physics_frame
            loaded_cases += 1
            var label: String = str(record.id) + " pose " + str(pose)
            _expect(body.collision_layer == 1 and body.collision_mask == 0, label + " layers")
            _expect(body.has_node("Visual") and _meshes(body) > 0, label + " visual")
            var count: int = 0
            for child in body.get_children():
                if child is CollisionShape3D:
                    count += 1
                    _expect(not child.disabled and child.shape is BoxShape3D, label + " enabled box")
                    if child.shape is BoxShape3D:
                        var size: Vector3 = child.shape.size
                        _expect(size.x > 0 and size.y > 0 and size.z > 0, label + " positive size")
            _expect(count == int(record.shape_count), label + " count")
            if record.family == "wall":
                _expect(_hit(body, Vector3(0, 1.2, -0.5), Vector3(0, 1.2, 0.5)), label + " wall blocks")
                _expect(_sphere(body, Vector3(0, 1.2, 0)), label + " wall overlap")
                _expect(_ray(body, Vector3(1.2, 1.2, -0.5), Vector3(1.2, 1.2, 0.5)).is_empty(), label + " beyond wall end clear")
                _expect(_ray(body, Vector3(0, 2.6, -0.5), Vector3(0, 2.6, 0.5)).is_empty(), label + " above wall clear")
            elif record.family == "roof":
                var top := _ray(body, Vector3(0, 0.4, 0.7), Vector3(0, -1.5, 0.7))
                _expect(top.get("collider") == body, label + " roof blocks from above")
                if not top.is_empty():
                    var local_hit: Vector3 = body.to_local(top.position)
                    _expect(abs(local_hit.y - (float(record.deck_top_offset_m) - 0.4)) < 0.015, label + " roof slope height")
                    var up: Vector3 = body.global_transform.basis * Vector3.UP
                    _expect(top.normal.dot(up) > 0.7, label + " upward roof normal")
                var under := _ray(body, Vector3(0.28, -1.4, 0.7), Vector3(0.28, 0.3, 0.7))
                _expect(under.get("collider") == body, label + " rafter underside blocks")
                if not under.is_empty():
                    var local_under: Vector3 = body.to_local(under.position)
                    _expect(abs(local_under.y + 0.6) < 0.015, label + " rafter underside height")
                _expect(not _sphere(body, Vector3(0, -1.4, 0.7)), label + " below roof clear")
                _expect(_ray(body, Vector3(0, 0.4, 1.7), Vector3(0, -1.5, 1.7)).is_empty(), label + " beyond eave clear")
            elif record.family == "fence":
                _expect(_hit(body, Vector3(-0.9, 0.55, -0.5), Vector3(-0.9, 0.55, 0.5)), label + " post blocks")
                _expect(_hit(body, Vector3(0, 0.40, -0.5), Vector3(0, 0.40, 0.5)), label + " lower rail blocks")
                _expect(_hit(body, Vector3(0, 0.83, -0.5), Vector3(0, 0.83, 0.5)), label + " upper rail or repair blocks")
                _expect(_ray(body, Vector3(-0.72, 0.62, -0.5), Vector3(-0.72, 0.62, 0.5)).is_empty(), label + " fence gap stays open")
                _expect(not _sphere(body, Vector3(-0.72, 0.62, 0)), label + " gap sphere clear")
            else:
                _expect(false, label + " supported family")
            body.free()
            await physics_frame
    _expect(loaded_cases == 60, "30 scenes at two placements")
    _finish()

func _finish() -> void:
    var report := {"engine": Engine.get_version_info(), "checks": checks, "scene_pose_cases": loaded_cases, "failures": failures, "passed": failures.is_empty(), "scope": "ENV-006 asset-only import, structure, slope/rafter, ray and sphere checks; not player traversal or performance"}
    var file := FileAccess.open("res://env006-validation-report.json", FileAccess.WRITE)
    if file != null:
        file.store_string(JSON.stringify(report, "  "))
        file.close()
    print("ENV006_VALIDATION checks=", checks, " cases=", loaded_cases, " failures=", failures.size())
    quit(0 if failures.is_empty() else 1)
