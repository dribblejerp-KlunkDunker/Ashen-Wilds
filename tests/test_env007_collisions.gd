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
    var query := PhysicsRayQueryParameters3D.create(body.to_global(a), body.to_global(b), 1)
    query.collide_with_areas = false
    return body.get_world_3d().direct_space_state.intersect_ray(query)

func _sphere_hit(body: StaticBody3D, point: Vector3) -> bool:
    var shape := SphereShape3D.new()
    shape.radius = 0.015
    var query := PhysicsShapeQueryParameters3D.new()
    query.shape = shape
    query.transform = Transform3D(Basis.IDENTITY, body.to_global(point))
    query.collision_mask = 1
    query.collide_with_areas = false
    return not body.get_world_3d().direct_space_state.intersect_shape(query, 8).is_empty()

func _run() -> void:
    var path := "res://assets/environment/env007/collision-manifest.json"
    if not FileAccess.file_exists(path):
        _expect(false, "collision manifest exists")
        _finish()
        return
    var data = JSON.parse_string(FileAccess.get_file_as_string(path))
    if not data is Dictionary or not data.has("assets"):
        _expect(false, "collision manifest parses")
        _finish()
        return
    _expect(data.assets.size() == 24, "24 scene records")
    _expect(int(data.total_shapes) == 121, "121 total box definitions")
    var holder := Node3D.new()
    root.add_child(holder)
    for record in data.assets:
        var scene_path: String = "res://assets/environment/env007/" + str(record.scene)
        var packed = load(scene_path) as PackedScene
        if packed == null:
            _expect(false, "load " + scene_path)
            continue
        for pose in [0, 1]:
            var instance = packed.instantiate()
            if instance == null:
                _expect(false, "instantiate " + scene_path)
                continue
            if not instance is StaticBody3D:
                _expect(false, "StaticBody3D root: " + str(record.id))
                instance.free()
                continue
            var body: StaticBody3D = instance
            holder.add_child(body)
            if pose == 1:
                body.position = Vector3(2, 0, -3)
                body.rotation.y = PI / 2.0
            await physics_frame
            await physics_frame
            var label: String = str(record.id) + " pose " + str(pose)
            loaded_cases += 1
            _expect(body.collision_layer == 1 and body.collision_mask == 0, label + " layers")
            _expect(body.has_node("Visual") and _meshes(body) > 0, label + " visual meshes loaded")
            var count: int = 0
            for child in body.get_children():
                if child is CollisionShape3D:
                    count += 1
                    _expect(not child.disabled and child.shape is BoxShape3D, label + " enabled box")
                    if child.shape is BoxShape3D:
                        var size: Vector3 = child.shape.size
                        _expect(size.x > 0 and size.y > 0 and size.z > 0, label + " positive size")
            _expect(count == int(record.shape_count), label + " collider count")
            var height: float = float(record.height_m)
            if bool(record.open_interior):
                var x: float = 0.098 if record.style == "partial_lid" else 0.0
                var z: float = 0.12 if record.style == "open_crossbar" else 0.0
                _expect(_ray(body, Vector3(x, height + 0.2, z), Vector3(x, 0.1, z)).is_empty(), label + " hollow vertical path")
                _expect(_ray(body, Vector3(0, 0.1, 0), Vector3(0, -0.1, 0)).get("collider") == body, label + " floor blocks")
                _expect(not _sphere_hit(body, Vector3(0, 0.2, 0)), label + " hollow sphere clearance")
                if record.style in ["open_crossbar", "partial_lid"]:
                    _expect(_ray(body, Vector3(0, 1.2, 0), Vector3(0, 0.2, 0)).get("collider") == body, label + " lid or crossbar blocks")
            else:
                _expect(_ray(body, Vector3(0, height + 0.2, 0), Vector3(0, 0.1, 0)).get("collider") == body, label + " solid top blocks")
                _expect(_sphere_hit(body, Vector3(0, height * 0.5, 0)), label + " solid sphere overlap")
            _expect(_ray(body, Vector3(-1, height * 0.5, 0), Vector3(0, height * 0.5, 0)).get("collider") == body, label + " side blocks")
            _expect(not _sphere_hit(body, Vector3(0.9, 0.2, 0)), label + " exterior sphere clear")
            body.free()
            await physics_frame
    _expect(loaded_cases == 48, "24 scenes tested at two placements")
    _finish()

func _finish() -> void:
    var report := {"engine": Engine.get_version_info(), "checks": checks, "scene_pose_cases": loaded_cases, "failures": failures, "passed": failures.is_empty(), "scope": "asset-only import, structure, ray and sphere queries; not player traversal or performance"}
    var file := FileAccess.open("res://validation-report.json", FileAccess.WRITE)
    if file != null:
        file.store_string(JSON.stringify(report, "  "))
        file.close()
    print("ENV007_VALIDATION checks=", checks, " cases=", loaded_cases, " failures=", failures.size())
    quit(0 if failures.is_empty() else 1)
