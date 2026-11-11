extends SceneTree
var failures: Array[String] = []
var checks: int = 0
var cases: int = 0
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
func _ray(n: Node3D, a: Vector3, b: Vector3) -> Dictionary:
    var q := PhysicsRayQueryParameters3D.create(n.to_global(a), n.to_global(b), 1)
    q.hit_from_inside = true
    q.collide_with_areas = false
    return n.get_world_3d().direct_space_state.intersect_ray(q)
func _sphere(n: Node3D, point: Vector3) -> Array:
    var s := SphereShape3D.new()
    s.radius = 0.01
    var q := PhysicsShapeQueryParameters3D.new()
    q.shape = s
    q.transform = Transform3D(Basis.IDENTITY, n.to_global(point))
    q.collision_mask = 1
    q.collide_with_areas = false
    return n.get_world_3d().direct_space_state.intersect_shape(q, 8)
func _capsule_clear(n: Node3D, offset: Vector3) -> bool:
    var s := CapsuleShape3D.new()
    s.radius = 0.25
    s.height = 1.6
    var q := PhysicsShapeQueryParameters3D.new()
    q.shape = s
    q.collision_mask = 1
    q.collide_with_areas = false
    q.transform = Transform3D(n.global_transform.basis, n.to_global(offset + Vector3(0, 0.8, -0.8)))
    var space := n.get_world_3d().direct_space_state
    if not space.intersect_shape(q, 8).is_empty():
        return false
    q.motion = n.global_transform.basis * Vector3(0, 0, 1.6)
    var fractions := space.cast_motion(q)
    q.transform.origin += q.motion
    q.motion = Vector3.ZERO
    return fractions.size() == 2 and fractions[0] >= 0.999 and space.intersect_shape(q, 8).is_empty()
func _run() -> void:
    var data = JSON.parse_string(FileAccess.get_file_as_string("res://assets/environment/env009/manifest.json"))
    if not data is Dictionary or not data.has("assets"):
        _check(false, "manifest")
        _finish()
        return
    _check(data.assets.size() == 39, "39 models")
    var families := {"walls": 0, "pillars": 0, "surfaces": 0}
    var holder := Node3D.new()
    root.add_child(holder)
    for r in data.assets:
        families[r.family] += 1
        boxes += r.collision_boxes.size()
        var packed = load("res://assets/environment/env009/" + str(r.scene)) as PackedScene
        if packed == null:
            _check(false, "load " + str(r.id))
            continue
        for pose in [0, 1]:
            var n = packed.instantiate() as StaticBody3D
            if n == null:
                _check(false, "StaticBody3D root")
                continue
            holder.add_child(n)
            if pose == 1:
                n.position = Vector3(3, 1, -2)
                n.rotation.y = PI / 2.0
            await physics_frame
            await physics_frame
            cases += 1
            var label: String = str(r.id) + " pose " + str(pose)
            _check(n.collision_layer == 1 and n.collision_mask == 0, label + " layers")
            var mesh := _mesh(n)
            _check(mesh != null and mesh.mesh != null, label + " visual")
            if mesh != null and mesh.mesh != null:
                var uv = mesh.mesh.surface_get_arrays(0)[Mesh.ARRAY_TEX_UV]
                var mat = mesh.get_active_material(0)
                _check(uv != null and uv.size() > 0 and mat is BaseMaterial3D and mat.albedo_texture != null, label + " texture/UV import")
            var count: int = 0
            for child in n.get_children():
                if child is CollisionShape3D:
                    count += 1
                    _check(not child.disabled and child.shape is BoxShape3D, label + " enabled box")
            _check(count == r.collision_boxes.size() and count > 0, label + " count")
            for b in r.collision_boxes:
                var c := Vector3(b.center[0], b.center[1], b.center[2])
                var hits := _sphere(n, c)
                _check(not hits.is_empty() and hits[0].get("collider") == n, label + " box sphere")
                _check(_ray(n, c + Vector3(0, float(b.size[1])/2+0.05, 0), c).get("collider") == n, label + " box ray")
            var v = r.reference_offset_m
            var offset := Vector3(v[0], v[1], v[2])
            if r.placement.has("clear_breach"):
                for x in [-0.45, 0.0, 0.45]:
                    for y in [0.2, 0.8, 1.4, 2.0]:
                        _check(_ray(n, offset+Vector3(x,y,-0.8), offset+Vector3(x,y,0.8)).is_empty(), label + " breach ray clear")
                _check(_capsule_clear(n, offset), label + " 0.5m x 1.6m capsule sweep clear")
            if r.placement.has("window_opening"):
                _check(_ray(n, offset+Vector3(0,1.3,-0.8), offset+Vector3(0,1.3,0.8)).is_empty(), label + " window clear")
                for y in [0.45, 1.95]:
                    _check(_ray(n, offset+Vector3(0,y,-0.8), offset+Vector3(0,y,0.8)).get("collider") == n, label + " sill/lintel blocks")
            if r.style == "courtyard_corner":
                _check(_ray(n, offset+Vector3(0.5,1,0.6), offset+Vector3(0.5,-0.2,0.6)).is_empty(), label + " empty L corner clear")
            if r.role == "stairs":
                var steps: int = int(r.placement.tread_count)
                var run: float = float(r.placement.run_m)
                var rise: float = float(r.placement.rise_m)
                for j in range(steps):
                    var z: float = -steps*run/2 + run*(j+0.5)
                    var contact := _ray(n, offset+Vector3(0,2,z), offset+Vector3(0,-0.2,z))
                    _check(contact.get("collider") == n, label + " tread hit")
                    if not contact.is_empty():
                        var local: Vector3 = n.to_local(contact.position)
                        _check(abs(local.y-(offset.y+rise*(j+1))) < 0.01, label + " tread height")
            var high = r.bounds_max_m
            _check(_sphere(n, Vector3(high[0]+0.5,0.2,high[2]+0.5)).is_empty(), label + " exterior clear")
            n.free()
            await physics_frame
    _check(cases == 78 and boxes == 140, "78 cases / 140 boxes")
    _check(families.walls == 13 and families.pillars == 13 and families.surfaces == 13, "13 per family")
    _finish()
func _finish() -> void:
    var report := {"passed": failures.is_empty(), "checks": checks, "scene_pose_cases": cases, "box_definitions": boxes, "failures": failures, "engine": Engine.get_version_info(), "scope": "isolated asset import, physics queries and capsule aperture probes; not actual player-controller traversal or performance"}
    var f := FileAccess.open("res://env009-validation-report.json", FileAccess.WRITE)
    if f != null:
        f.store_string(JSON.stringify(report, "  "))
        f.close()
    print("ENV009_VALIDATION cases=", cases, " failures=", failures.size())
    quit(0 if failures.is_empty() else 1)
