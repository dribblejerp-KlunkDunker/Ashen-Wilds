extends "res://scripts/environment/env010_layout.gd"
## Branch-local walk-plane preview. Original builder and manifest remain unchanged.
@export_file("*.json") var revision_path: String = "res://assets/environment/env010/layout_walkplane_v2.json"
var _revision: Dictionary = {}

func _blob_sha(path: String) -> String:
    var bytes: PackedByteArray = FileAccess.get_file_as_bytes(path)
    var payload: PackedByteArray = ("blob " + str(bytes.size())).to_utf8_buffer()
    payload.append(0)
    payload.append_array(bytes)
    var hash_context := HashingContext.new()
    if hash_context.start(HashingContext.HASH_SHA1) != OK:
        return ""
    if hash_context.update(payload) != OK:
        return ""
    return hash_context.finish().hex_encode()

func _read_revision() -> Dictionary:
    var base_value: Variant = JSON.parse_string(FileAccess.get_file_as_string(manifest_path))
    var overlay_value: Variant = JSON.parse_string(FileAccess.get_file_as_string(revision_path))
    if not base_value is Dictionary or not overlay_value is Dictionary:
        _issue("Cannot parse base manifest or walk-plane revision")
        return {}
    var data: Dictionary = base_value
    _revision = overlay_value
    if str(_revision.get("schema", "")) != "ashen.env010.walkplane_revision.v2":
        _issue("Unsupported walk-plane revision schema")
        return {}
    if str(_revision.get("base_manifest", "")) != manifest_path:
        _issue("Revision targets a different manifest")
        return {}
    if _blob_sha(manifest_path) != str(_revision.get("base_manifest_git_blob_sha", "")):
        _issue("Base manifest changed; review the revision before activation")
        return {}
    var movement: Dictionary = _revision.get("movement_contract", {})
    var movement_path: String = str(movement.get("source", ""))
    if not FileAccess.file_exists(movement_path) or _blob_sha(movement_path) != str(movement.get("source_git_blob_sha", "")):
        _issue("Player controller changed; review the movement contract")
        return {}
    var resource_changes: Dictionary = _revision.resource_overrides
    for key in resource_changes:
        if not data.resources.has(key):
            _issue("Unknown resource override: " + key)
            return {}
        var resource_spec: Dictionary = resource_changes[key]
        data.resources[key] = [resource_spec.relative_path, resource_spec.mode]
    var pending: Dictionary = _revision.instance_y_overrides_m.duplicate()
    for raw in data.instances:
        var full_id: String = str(data.instance_id_prefix) + str(raw[0])
        if pending.has(full_id):
            var value: Variant = pending[full_id]
            if not (value is float or value is int) or not is_finite(float(value)):
                _issue("Invalid Y override: " + full_id)
                return {}
            raw[2][1] = float(value)
            pending.erase(full_id)
    if not pending.is_empty():
        _issue("Unknown instance IDs in walk-plane revision")
        return {}
    var fixture_changes: Dictionary = _revision.fixture_overrides
    for key in fixture_changes:
        if not data.fixtures.has(key):
            _issue("Unknown fixture override: " + key)
            return {}
        var fixture_spec: Dictionary = data.fixtures[key]
        fixture_spec.merge(fixture_changes[key], true)
    var route: Dictionary = data.reserved_route
    route.merge(_revision.reserved_route_override, true)
    var preserved: Dictionary = _revision.preserve
    if data.instances.size() != int(preserved.instance_count) or data.resources.size() != int(preserved.resource_type_count) or data.fixtures.size() != int(preserved.local_fixture_count):
        _issue("Revision changed a protected layout count")
        return {}
    return data

func _fixture(key: String) -> Node3D:
    var body: Node3D = super._fixture(key)
    var spec: Dictionary = _data.fixtures[key]
    var visual := body.get_node("Visual") as MeshInstance3D
    visual.position = _vec(spec.get("visual_local_offset_m", [0,0,0]))
    visual.visible = bool(spec.get("visual_enabled", true))
    var collision_body := body as StaticBody3D
    collision_body.collision_layer = int(spec.get("collision_layer", 1))
    collision_body.collision_mask = int(spec.get("collision_mask", 0))
    for child in body.get_children():
        if child is CollisionShape3D:
            var shape := child as CollisionShape3D
            shape.disabled = not bool(spec.get("collision_enabled", true))
            shape.position = _vec(spec.get("collision_local_offset_m", [0,0,0]))
    return body

func _ready() -> void:
    _data = _read_revision()
    if _data.is_empty():
        set_meta("env010_build_report", {"instances":0,"issues":_issues,"engine_validated":false,"revision_applied":false})
        return
    var props := Node3D.new()
    props.name = "Props"
    add_child(props)
    for raw in _data.instances:
        var suffix: String = str(raw[0])
        var key: String = str(raw[1])
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
        node.position = _vec(raw[2])
        node.rotation.y = deg_to_rad(float(raw[3]))
        node.scale = Vector3.ONE
        node.add_to_group("env010_" + str(raw[4]))
        var options: Dictionary = _data.overrides.get(suffix, {})
        node.set_meta("env010_asset", key)
        node.set_meta("env010_role", str(raw[4]))
        if options.has("world_object_id"):
            node.set_meta("proposed_world_object_id", str(options.world_object_id))
            node.set_meta("loot_binding", "not implemented or server-registered")
        props.add_child(node)
        _adapt(node, options)
        if str(raw[4]) == "roof":
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
    set_meta("env010_build_report", {"instances":_built,"issues":_issues,"engine_validated":false,"revision_applied":_issues.is_empty(),"stage":"walk-plane v2 static preview; traversal and visual review required","revision_path":revision_path})
    print("ENV010_WALKPLANE instances=", _built, " issues=", _issues.size())
