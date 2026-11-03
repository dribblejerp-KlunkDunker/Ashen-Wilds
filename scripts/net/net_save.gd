class_name NetSave
extends RefCounted
## Server-side world persistence (brief §18, appendix §87, §88; temporary rule A4: versioned JSON).
## Only the server reads or writes this file; clients never see it.
##
## Policy, in the order a load applies it:
##   * no primary and no backup  -> a new world (the caller seeds it)
##   * primary from a NEWER schema -> refuse (SAVE_SCHEMA_NEWER); nothing is written, ever
##   * primary unreadable or invalid, backup valid -> load the backup; the bad primary is moved
##     aside to <path>.corrupt-<unix time> (kept as evidence, never deleted) before the next write
##   * primary and backup both unusable -> refuse (SAVE_UNREADABLE) unless the server was started
##     with --reset-world, which moves both aside and starts a new world. Never a silent reset.
##
## A write is: serialise -> write <path>.tmp -> read it back and validate -> copy the current
## primary to <path>.bak -> rename <path>.tmp over <path>. A crash at any step leaves either the old
## primary or the new one in place, plus a valid backup.

const SCHEMA: int = 1
const WORLD_BOUND: float = 15.0  # a saved position outside +-15 m is not trusted (respawn instead)


## {ok, code, data, from_backup, warnings, moved_aside}
static func load_world(path: String, reset_allowed: bool) -> Dictionary:
	var out: Dictionary = {"ok": false, "code": "", "data": {}, "from_backup": false, "warnings": [], "moved_aside": []}
	var bak: String = path + ".bak"
	var has_primary: bool = FileAccess.file_exists(path)
	var has_backup: bool = FileAccess.file_exists(bak)
	if not has_primary and not has_backup:
		out["ok"] = true
		out["code"] = "NEW_WORLD"
		return out
	var primary: Dictionary = _read(path) if has_primary else {"ok": false, "code": "MISSING"}
	if primary.get("code", "") == "SAVE_SCHEMA_NEWER":
		out["code"] = "SAVE_SCHEMA_NEWER"
		out["warnings"].append("%s was written by a newer build (schema %s > %d); refusing to load or overwrite it" % [path, str(primary.get("schema")), SCHEMA])
		return out
	if primary["ok"]:
		out["ok"] = true
		out["code"] = "LOADED"
		out["data"] = primary["data"]
		out["warnings"].append_array(primary.get("warnings", []))
		return out
	var backup: Dictionary = _read(bak) if has_backup else {"ok": false, "code": "MISSING"}
	if backup.get("code", "") == "SAVE_SCHEMA_NEWER":
		out["code"] = "SAVE_SCHEMA_NEWER"
		out["warnings"].append("%s is from a newer build; refusing" % bak)
		return out
	if backup["ok"]:
		out["ok"] = true
		out["code"] = "LOADED_BACKUP"
		out["from_backup"] = true
		out["data"] = backup["data"]
		out["warnings"].append("primary save unusable (%s); loaded the backup" % primary.get("code", "?"))
		out["warnings"].append_array(backup.get("warnings", []))
		if has_primary:
			out["moved_aside"].append(_move_aside(path))
		return out
	if not reset_allowed:
		out["code"] = "SAVE_UNREADABLE"
		out["warnings"].append("primary (%s) and backup (%s) are both unusable; start with --reset-world to move them aside and begin a new world" % [primary.get("code", "?"), backup.get("code", "?")])
		return out
	for p: String in [path, bak]:
		if FileAccess.file_exists(p):
			out["moved_aside"].append(_move_aside(p))
	out["ok"] = true
	out["code"] = "RESET_NEW_WORLD"
	out["warnings"].append("--reset-world: unusable saves moved aside; starting a new world")
	return out


## {ok, code}
static func write_world(path: String, data: Dictionary) -> Dictionary:
	var text: String = JSON.stringify(data, "  ")
	var tmp: String = path + ".tmp"
	var dir: String = path.get_base_dir()
	if not dir.is_empty() and not DirAccess.dir_exists_absolute(dir):
		DirAccess.make_dir_recursive_absolute(dir)
	var f := FileAccess.open(tmp, FileAccess.WRITE)
	if f == null:
		return {"ok": false, "code": "SAVE_OPEN_FAILED", "detail": error_string(FileAccess.get_open_error())}
	f.store_string(text)
	f.flush()
	f.close()
	var check: Dictionary = _read(tmp)
	if not check["ok"]:
		return {"ok": false, "code": "SAVE_VERIFY_FAILED", "detail": str(check.get("code"))}
	if FileAccess.file_exists(path):
		var err_copy: Error = DirAccess.copy_absolute(path, path + ".bak")
		if err_copy != OK:
			return {"ok": false, "code": "BACKUP_FAILED", "detail": error_string(err_copy)}
	var err: Error = DirAccess.rename_absolute(tmp, path)
	if err != OK:
		return {"ok": false, "code": "SAVE_RENAME_FAILED", "detail": error_string(err)}
	return {"ok": true, "code": "SAVED"}


## Read and validate one file. {ok, code, data, schema, warnings}
static func _read(path: String) -> Dictionary:
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		return {"ok": false, "code": "SAVE_OPEN_FAILED"}
	var text: String = f.get_as_text()
	f.close()
	var json := JSON.new()
	if json.parse(text) != OK or typeof(json.data) != TYPE_DICTIONARY:
		return {"ok": false, "code": "SAVE_NOT_JSON"}
	var d: Dictionary = json.data
	var schema: Variant = d.get("schema")
	if typeof(schema) != TYPE_FLOAT and typeof(schema) != TYPE_INT:
		return {"ok": false, "code": "SAVE_NO_SCHEMA"}
	if int(schema) > SCHEMA:
		return {"ok": false, "code": "SAVE_SCHEMA_NEWER", "schema": int(schema)}
	if int(schema) < 1:
		return {"ok": false, "code": "SAVE_BAD_SCHEMA"}
	var warnings: Array = []
	var errors: Array = validate(d, warnings)
	if not errors.is_empty():
		return {"ok": false, "code": "SAVE_INVALID", "errors": errors}
	return {"ok": true, "code": "OK", "data": d, "warnings": warnings}


## Structural validation. Errors make the file unusable; warnings are recoverable content issues
## (an item id this build does not define, a position outside the world) that the loader repairs
## and reports instead of failing.
static func validate(d: Dictionary, warnings: Array) -> Array:
	var errors: Array = []
	if typeof(d.get("world_id")) != TYPE_STRING or str(d.get("world_id")).is_empty():
		errors.append("world_id missing")
	for key: String in ["containers", "fixtures", "players"]:
		if typeof(d.get(key)) != TYPE_DICTIONARY:
			errors.append("%s missing" % key)
	if not errors.is_empty():
		return errors
	var known: Array = ItemDatabase.all_ids()
	for object_id: String in d["containers"]:
		var c: Variant = d["containers"][object_id]
		if typeof(c) != TYPE_DICTIONARY or typeof(c.get("stacks")) != TYPE_ARRAY:
			errors.append("container %s malformed" % object_id)
			continue
		for s: Variant in c["stacks"]:
			var problem: String = _stack_problem(s, known)
			if problem == "unknown":
				warnings.append("container %s: item %s is not defined by this build; dropped" % [object_id, str(s[1])])
			elif not problem.is_empty():
				errors.append("container %s: %s" % [object_id, problem])
	for key: String in d["players"]:
		var p: Variant = d["players"][key]
		if typeof(p) != TYPE_DICTIONARY or typeof(p.get("pack")) != TYPE_ARRAY or typeof(p.get("position")) != TYPE_ARRAY or (p["position"] as Array).size() != 3:
			errors.append("player %s malformed" % key)
			continue
		for s: Variant in p["pack"]:
			var problem: String = _stack_problem(s, known)
			if problem == "unknown":
				warnings.append("player %s: item %s is not defined by this build; dropped" % [key, str(s[1])])
			elif not problem.is_empty():
				errors.append("player %s pack: %s" % [key, problem])
	for object_id: String in d["fixtures"]:
		var fx: Variant = d["fixtures"][object_id]
		if typeof(fx) != TYPE_DICTIONARY or typeof(fx.get("done")) != TYPE_BOOL:
			errors.append("fixture %s malformed" % object_id)
	return errors


## "" if fine, "unknown" for an undefined item id, otherwise the reason.
static func _stack_problem(s: Variant, known: Array) -> String:
	if typeof(s) != TYPE_ARRAY or (s as Array).size() != 4:
		return "stack is not [id, item, quantity, condition]"
	if not known.has(str(s[1])):
		return "unknown"
	var data: ItemData = ItemDatabase.get_item(str(s[1]))
	var q: int = int(s[2])
	if q < 1 or q > maxi(data.max_stack, 1) or float(s[2]) != float(q):
		return "%s quantity %s out of range" % [str(s[1]), str(s[2])]
	var cond: float = float(s[3])
	if not is_finite(cond) or cond < 0.0 or cond > data.max_condition + 0.001:
		return "%s condition %s out of range" % [str(s[1]), str(s[3])]
	return ""


static func usable_stack(s: Array) -> bool:
	return _stack_problem(s, ItemDatabase.all_ids()).is_empty()


static func trusted_position(a: Array) -> bool:
	for v: Variant in a:
		if not is_finite(float(v)):
			return false
	return absf(float(a[0])) <= WORLD_BOUND and absf(float(a[2])) <= WORLD_BOUND


static func _move_aside(path: String) -> String:
	var target: String = "%s.corrupt-%d" % [path, int(Time.get_unix_time_from_system())]
	var n: int = 0
	while FileAccess.file_exists(target):
		n += 1
		target = "%s.corrupt-%d-%d" % [path, int(Time.get_unix_time_from_system()), n]
	DirAccess.rename_absolute(path, target)
	return target
