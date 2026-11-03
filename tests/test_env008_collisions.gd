extends SceneTree
var failures: Array[String] = []
var checks: int = 0
var cases: int = 0
var blockers: int = 0
var boxes: int = 0
func _initialize() -> void:
    call_deferred("_run")
func _check(ok: bool, note: String) -> void:
    checks += 1
    if not ok:
        failures.append(note)
        printerr("FAIL: " + note)
func _mesh(n: Node) -> MeshInstance3D:
    if n is MeshInstance3D:
        return n as MeshInstance3D
    for child in n.get_children():
        var found := _mesh(child)
        if found != null:
            return found
    return null
func _sphere(n: Node3D, p: Vector3) -> Array:
    var shape := SphereShape3D.new()
    shape.radius = 0.01
    var q := PhysicsShapeQueryParameters3D.new()
    q.shape = shape
    q.transform = Transform3D(Basis.IDENTITY, n.to_global(p))
    q.collision_mask = 1
    q.collide_with_areas = false
    return n.get_world_3d().direct_space_state.intersect_shape(q, 8)
func _run() -> void:
    var data = JSON.parse_string(FileAccess.get_file_as_string("res://assets/environment/env008/manifest.json"))
    if not data is Dictionary or not data.has("assets"):
        _check(false, "manifest")
        _finish()
        return
    _check(data.assets.size() == 39, "39 assets")
    var families := {"trees": 0, "rocks": 0, "ground": 0}
    var holder := Node3D.new()
    root.add_child(holder)
    for r in data.assets:
        families[r.family] += 1
        blockers += 1 if r.blocking else 0
        boxes += r.collision_boxes.size()
        var packed = load("res://assets/environment/env008/" + str(r.scene)) as PackedScene
        if packed == null:
            _check(false, "load " + str(r.id))
            continue
        for pose in [0, 1]:
            var n = packed.instantiate() as Node3D
            if n == null:
                _check(false, "Node3D root")
                continue
            holder.add_child(n)
            if pose == 1:
                n.position = Vector3(3, 1, -2)
                n.rotation.y = PI / 2.0
            await physics_frame
            await physics_frame
            cases += 1
            var label: String = str(r.id) + " pose " + str(pose)
            var mesh := _mesh(n)
            _check(mesh != null and mesh.mesh != null, label + " visual")
            if mesh != null and mesh.mesh != null:
                var uv = mesh.mesh.surface_get_arrays(0)[Mesh.ARRAY_TEX_UV]
                var mat = mesh.get_active_material(0)
                _check(uv != null and uv.size() > 0 and mat is BaseMaterial3D and mat.albedo_texture != null, label + " textured UV material")
            var count: int = 0
            for child in n.get_children():
                if child is CollisionShape3D:
                    count += 1
                    _check(not child.disabled and child.shape is BoxShape3D, label + " enabled box")
            _check(count == r.collision_boxes.size(), label + " shape count")
            if r.blocking:
                var physics := n as StaticBody3D
                _check(physics != null and physics.collision_layer == 1 and physics.collision_mask == 0 and count > 0, label + " Environment blocker")
                for b in r.collision_boxes:
                    var c := Vector3(b.center[0], b.center[1], b.center[2])
                    var hits := _sphere(n, c)
                    _check(not hits.is_empty() and hits[0].get("collider") == n, label + " sphere contact")
                    var q := PhysicsRayQueryParameters3D.create(n.to_global(c + Vector3(0, float(b.size[1]) / 2 + 0.05, 0)), n.to_global(c), 1)
                    q.hit_from_inside = true
                    _check(n.get_world_3d().direct_space_state.intersect_ray(q).get("collider") == n, label + " ray blocked")
            else:
                _check(not n is CollisionObject3D and count == 0, label + " decorative root")
                var lo = r.bounds_min_m
                var hi = r.bounds_max_m
                _check(_sphere(n, Vector3((lo[0]+hi[0])/2, (lo[1]+hi[1])/2, (lo[2]+hi[2])/2)).is_empty(), label + " decorative volume clear")
            var maximum = r.bounds_max_m
            _check(_sphere(n, Vector3(maximum[0]+0.5, 0.2, maximum[2]+0.5)).is_empty(), label + " exterior clear")
            if r.family == "ground":
                _check(not r.blocking and count == 0, label + " nonblocking ground")
            n.free()
            await physics_frame
    _check(cases == 78 and blockers == 20 and boxes == 39, "78 cases / 20 blockers / 39 boxes")
    _check(families.trees == 13 and families.rocks == 13 and families.ground == 13, "13 per family")
    _finish()
func _finish() -> void:
    var report := {"passed": failures.is_empty(), "checks": checks, "scene_pose_cases": cases, "blocking_models": blockers, "box_definitions": boxes, "failures": failures, "engine": Engine.get_version_info(), "scope": "isolated asset imports and collision queries; not player traversal or performance"}
    var f := FileAccess.open("res://env008-validation-report.json", FileAccess.WRITE)
    if f != null:
        f.store_string(JSON.stringify(report, "  "))
        f.close()
    print("ENV008_VALIDATION cases=", cases, " failures=", failures.size())
    quit(0 if failures.is_empty() else 1)
