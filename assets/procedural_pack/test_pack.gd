extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var folder: String = get_script().resource_path.get_base_dir()
	var kinds: Array[String] = ["pillar", "crate", "barrel", "fence", "bench", "wall", "rubble", "stump"]
	var failures: int = 0
	var checked: int = 0
	for kind in kinds:
		for variant in range(1, 5):
			var path: String = folder.path_join("%s_%02d.tscn" % [kind, variant])
			var packed := load(path) as PackedScene
			if packed == null:
				failures += 1
				continue
			var prop: Node3D = packed.instantiate() as Node3D
			root.add_child(prop)
			await process_frame
			await process_frame
			var generated := prop.get_node_or_null("Generated") as Node3D
			var visuals: int = 0
			var solids: int = 0
			var ok: bool = generated != null
			if generated:
				for child in generated.get_children():
					if child is MeshInstance3D:
						visuals += 1
						var visual := child as MeshInstance3D
						ok = ok and visual.mesh != null and visual.material_override != null
						ok = ok and visual.position.is_finite()
					elif child is StaticBody3D:
						solids += 1
						ok = ok and (child as StaticBody3D).collision_layer == 1
				ok = ok and visuals > 0 and solids > 0
			prop.call("rebuild")
			ok = ok and prop.get_child_count() == 1
			if not ok:
				failures += 1
				push_error("Prop structure failed: " + path)
			checked += 1
			prop.queue_free()
			await process_frame
	print("PROCEDURAL_PACK checked=%d failures=%d; visuals and traversal unverified" % [checked, failures])
	quit(1 if failures > 0 else 0)
