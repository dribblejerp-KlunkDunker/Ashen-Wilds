class_name Perception
extends Node
## What the survivor can see and hear. Owned by PlayerController (`player.perception`).
##
## Sight is a cone of CONE_DEGREES around the aim, cut by walls (a layer 1 ray, like every other ray
## in the game). Enemies ask `update_visibility()` each tick: outside the cone or behind a wall
## their body is not drawn, and where one slips out of sight a charcoal last-seen mark is left.
## Hearing: enemies report every noise they make (footsteps, a windup grunt, a swing, a roar) with
## a loudness in metres, the radius at which the survivor hears it; through a wall it carries less
## far. A heard noise whose source is unseen raises a dust-ring ripple on the ground at the source,
## sized by its loudness (`AcousticRipple`), and the `heard` signal for a sound cue.
##
## Presentation and readability only. Nothing in the simulation reads from here: hitboxes land,
## and enemies see and hear the survivor, exactly as before. Turning the cone off (`enabled`, F4)
## restores the old draw rule, line of sight alone.

signal heard(world_pos: Vector3, loudness: float)

const CONE_DEGREES: float = 130.0
const EYE_HEIGHT: float = 1.35
## Walls muffle: a noise heard through stone carries this fraction of its loudness.
const WALL_MUFFLE: float = 0.55
## The shortest gap between ripples from one source, so footsteps don't carpet the ground.
const RIPPLE_GAP: float = 0.22
## How long a last-seen mark lingers, in seconds.
const MARK_SECONDS: float = 4.0

var enabled: bool = true
## Set by Weather: every loudness is multiplied by `hearing`, and nothing further than
## `sight_range` metres is seen, cone or not.
var hearing: float = 1.0
var sight_range: float = 1.0e9
## The survivor's own eyes and ears (SurvivorBackground), on top of the weather.
var sight_mult: float = 1.0
var hearing_mult: float = 1.0

var _player: Node3D
## The world node ripples and marks are added to.
var _world: Node
var _seen: Dictionary = {}
var _last_ripple: Dictionary = {}
var _step_clocks: Dictionary = {}


func _init(player: Node3D) -> void:
	name = "Perception"
	_player = player


func _ready() -> void:
	_world = _player.get_parent()


## The aim the cone is centred on (flat, unit length).
func aim() -> Vector3:
	return _player.get_aim_direction()


## True when `point` lies inside the cone (ignoring walls).
func in_cone(point: Vector3) -> bool:
	if not enabled:
		return true
	var to_p: Vector3 = point - _player.global_position
	to_p.y = 0.0
	if to_p.length_squared() < 0.0001:
		return true
	return aim().dot(to_p.normalized()) >= cos(deg_to_rad(CONE_DEGREES * 0.5))


## True when nothing on layer 1 stands between the survivor's eyes and `point` at `height`.
func line_of_sight(point: Vector3, height: float = 1.0) -> bool:
	var space: PhysicsDirectSpaceState3D = _player.get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(_player.global_position + Vector3(0.0, EYE_HEIGHT, 0.0),
		Vector3(point.x, point.y + height, point.z), 1)
	return space.intersect_ray(q).is_empty()


## Inside the cone, within the weather's sight range, and not behind a wall.
func can_see(point: Vector3, height: float = 1.0) -> bool:
	if _player.global_position.distance_to(point) > sight_range * sight_mult:
		return false
	return in_cone(point) and line_of_sight(point, height)


## Called by an enemy every tick with its body root and the height of its head: draws the body only
## while it is seen, and drops a last-seen mark where it slipped out of sight (not for a corpse:
## `leaves_mark` false). Returns whether it is seen now.
func update_visibility(enemy: Node3D, visual_root: Node3D, head_height: float, leaves_mark: bool = true) -> bool:
	var seen: bool = can_see(enemy.global_position, head_height)
	visual_root.visible = seen
	var id: int = enemy.get_instance_id()
	if leaves_mark and _seen.get(id, false) and not seen and _world != null:
		AcousticRipple.spawn_mark(_world, enemy.global_position, MARK_SECONDS)
	_seen[id] = seen
	return seen


## An enemy has died or left: forget it, so a mark isn't left for a body that stays visible.
func forget(enemy: Node3D) -> void:
	var id: int = enemy.get_instance_id()
	_seen.erase(id)
	_last_ripple.erase(id)
	_step_clocks.erase(id)


## A noise at `world_pos` that carries `loudness` metres. Heard if the survivor is within that
## radius (less through a wall). Unseen sources raise a ripple and the `heard` signal.
func report_noise(world_pos: Vector3, loudness: float, source: Node3D = null) -> bool:
	var dist: float = _player.global_position.distance_to(world_pos)
	var reach: float = loudness * hearing * hearing_mult
	if not line_of_sight(world_pos, 1.0):
		reach *= WALL_MUFFLE
	if dist > reach:
		return false
	var seen: bool = can_see(world_pos, 1.0)
	if seen:
		return true
	var now: float = Time.get_ticks_msec() / 1000.0
	var id: int = source.get_instance_id() if source != null else 0
	if now - float(_last_ripple.get(id, -10.0)) >= RIPPLE_GAP and _world != null:
		_last_ripple[id] = now
		AcousticRipple.spawn(_world, world_pos, loudness)
	heard.emit(world_pos, loudness)
	return true


## Footsteps for a moving enemy: call every physics tick. One step every `stride` metres of
## travel at `speed`, each a noise of `loudness`.
func report_footsteps(source: Node3D, delta: float, speed: float, stride: float, loudness: float) -> void:
	if speed < 0.3:
		return
	var id: int = source.get_instance_id()
	var clock: float = float(_step_clocks.get(id, 0.0)) + speed * delta
	if clock >= stride:
		clock = 0.0
		report_noise(source.global_position, loudness, source)
	_step_clocks[id] = clock
