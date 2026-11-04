extends Node3D
## Static ENV-010 layout preview. No actor, live loot or moving door controller.
@export_file("*.json") var manifest_path: String = "res://assets/environment/env010/layout_manifest.json"
@export var preview_services: bool = true
@export_range(0, 3, 1) var preview_view: int = 0
var _data: Dictionary = {}
var _issues: Array[String] = []
var _built: int = 0
var _camera: Camera3D

func _issue(text: String) -> void:
    _issues.append(text)
    push_error("ENV010: " + text)

func _vec(value: Variant) -> Vector3:
    var a: Array = value
    return Vector3(float(a[0]), float(a[1]), float(a[2]))

func _material(color: Color) -> StandardMaterial3D:
    var m := StandardMaterial3D.new()
    m.albedo_color = color
    m.roughness = 1.0
    return m

func _boxes(parent: Node3D, values: Array, label: String) -> void:
    var body := StaticBody3D.new()
    body.name = label
    body.collision_layer = 1
    body.collision_mask = 0
    parent.add_child(body)
    for i in range(values.size()):
        var item: Dictionary = values[i]
        var shape := BoxShape3D.new()
        shape.size = _vec(item.size)
        var child := CollisionShape3D.new()
        child.name = "Box" + str(i)
        child.shape = shape
        child.position = _vec(item.center)
        body.add_child(child)

func _fixture(key: String) -> Node3D:
    var spec: Dictionary = _data.fixtures[key]
    var body := StaticBody3D.new()
    body.collision_layer = 1
    body.collision_mask = 0
    var visual := MeshInstance3D.new()
    visual.name = "Visual"
    var collision := CollisionShape3D.new()
    if key == "@ground":
        var mesh := BoxMesh.new()
        mesh.size = _vec(spec.size_m)
        visual.mesh = mesh
        var ground_shape := BoxShape3D.new()
        ground_shape.size = mesh.size
        collision.shape = ground_shape
    else:
        var x0: float = float(spec.x_range_m[0])
        var x1: float = float(spec.x_range_m[1])
        var z0: float = float(spec.z_range_m[0])
        var z1: float = float(spec.z_range_m[1])
        var y0: float = float(spec.top_y_range_m[0])
        var y1: float = float(spec.top_y_range_m[1])
        var t: float = float(spec.thickness_m)
        var v := PackedVector3Array([Vector3(x0,y0,z0),Vector3(x1,y0,z0),Vector3(x1,y1,z1),Vector3(x0,y1,z1),Vector3(x0,y0-t,z0),Vector3(x1,y0-t,z0),Vector3(x1,y1-t,z1),Vector3(x0,y1-t,z1)])
        var faces: Array = [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,4,7],[0,7,3],[1,2,6],[1,6,5],[0,1,5],[0,5,4],[3,7,6],[3,6,2]]
        var tool := SurfaceTool.new()
        tool.begin(Mesh.PRIMITIVE_TRIANGLES)
        for f in faces:
            var normal: Vector3 = (v[f[1]]-v[f[0]]).cross(v[f[2]]-v[f[0]]).normalized()
            for index in f:
                tool.set_normal(normal)
                tool.add_vertex(v[index])
        visual.mesh = tool.commit()
        var ramp_shape := ConvexPolygonShape3D.new()
        ramp_shape.points = v
        collision.shape = ramp_shape
    visual.material_override = _material(Color(0.22,0.21,0.17))
    body.add_child(visual)
    body.add_child(collision)
    return body

func _adapt(node: Node3D, options: Dictionary) -> void:
    var key: String = str(options.get("adapter", ""))
    if key.is_empty():
        return
    var spec: Dictionary = _data.adapters[key]
    if key != "door_frame_and_leaf":
        _boxes(node, spec.boxes, "LayoutCollision")
        return
    _boxes(node, spec.frame_boxes, "FrameCollision")
    var hinge := node.find_child(str(spec.hinge_name), true, false) as Node3D
    if hinge == null:
        _issue("DoorLeafHinge was not found; door adapter incomplete")
        return
    if hinge.position.distance_to(_vec(spec.hinge_position_asset_m)) > 0.001:
        _issue("Imported hinge offset differs; inspect before using door")
        return
    hinge.rotation_degrees.y = float(options.get("initial_door_angle_degrees", 90))
    _boxes(hinge, [spec.leaf_box], "LeafCollision")
    node.set_meta("door_mode", "static preview pose; no motion/controller")

func _ready() -> void:
    var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(manifest_path))
    if not parsed is Dictionary:
        _issue("Cannot parse layout manifest")
        return
    _data = parsed
    var props := Node3D.new()
    props.name = "Props"
    add_child(props)
    for raw in _data.instances:
        var row: Array = raw
        var suffix: String = str(row[0])
        var key: String = str(row[1])
        var node: Node3D
        if key.begins_with("@"):
            node = _fixture(key)
        else:
            var entry: Array = _data.resources[key]
            var path: String = str(_data.asset_root) + str(entry[0])
            var packed := load(path) as PackedScene
            if packed == null:
                _issue("Missing scene: " + path)
                continue
            var instance: Node = packed.instantiate()
            if not instance is Node3D:
                _issue("Resource root is not Node3D: " + path)
                if instance != null:
                    instance.free()
                continue
            node = instance as Node3D
        node.name = str(_data.instance_id_prefix) + suffix
        node.position = _vec(row[2])
        node.rotation.y = deg_to_rad(float(row[3]))
        node.scale = Vector3.ONE
        node.add_to_group("env010_" + str(row[4]))
        var options: Dictionary = _data.overrides.get(suffix, {})
        node.set_meta("env010_asset", key)
        node.set_meta("env010_role", str(row[4]))
        if options.has("world_object_id"):
            node.set_meta("proposed_world_object_id", str(options.world_object_id))
            node.set_meta("loot_binding", "not implemented or server-registered")
        props.add_child(node)
        _adapt(node, options)
        if str(row[4]) == "roof":
            var target: Node = node if str(_data.resources[key][1]) == "visual" else node.get_node_or_null("Visual")
            if target == null:
                _issue("Missing roof Visual child: " + suffix)
            else:
                target.add_to_group(str(_data.camera_review.roof_visual_group))
        _built += 1
    if _built != int(_data.scope.expected_instances):
        _issue("Unexpected instance count: " + str(_built))
    if preview_services:
        _preview()
    set_meta("env010_build_report", {"instances":_built,"issues":_issues,"engine_validated":false,"stage":"static layout only"})
    print("ENV010_LAYOUT instances=", _built, " issues=", _issues.size())

func _preview() -> void:
    var services := Node3D.new()
    services.name = "PreviewServices"
    add_child(services)
    var light := DirectionalLight3D.new()
    light.rotation_degrees = Vector3(-55,-35,0)
    light.light_energy = 0.9
    light.shadow_enabled = true
    services.add_child(light)
    var world := WorldEnvironment.new()
    var env := Environment.new()
    env.background_mode = Environment.BG_COLOR
    env.background_color = Color(0.12,0.14,0.13)
    env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    env.ambient_light_color = Color(0.55,0.57,0.50)
    env.ambient_light_energy = 0.6
    world.environment = env
    services.add_child(world)
    _camera = Camera3D.new()
    _camera.projection = Camera3D.PROJECTION_ORTHOGONAL
    _camera.size = 18.0
    services.add_child(_camera)
    set_preview_view(preview_view)
    _camera.current = true

func set_preview_view(index: int) -> void:
    if _camera == null:
        return
    var i: int = ((index % 4) + 4) % 4
    var yaw: float = deg_to_rad(float(_data.camera_review.views_degrees[i]))
    var elevation: float = deg_to_rad(30.0)
    var target := Vector3(0,1,0)
    _camera.position = target + Vector3(sin(yaw)*cos(elevation),sin(elevation),cos(yaw)*cos(elevation))*20.0
    _camera.look_at(to_global(target), Vector3.UP)
