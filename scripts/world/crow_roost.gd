class_name CrowRoost
extends Node3D
## Milestone 20: the Crows' Roost. A dead tree with a flock perched in its
## branches and a hoard of shiny things in the nest at its foot. When any
## roost crow scatters, the whole flock mobs the survivor for `mob_time`:
## every `caw_interval` seconds, while you're within `mob_radius` of the
## tree, a caw goes up over your head. Each one is a crow's noise at your
## position, so everything that hears it knows where you are.

signal roost_event_banner(text: String, col: Color)

@export var mob_time: float = 18.0
@export var caw_interval: float = 2.5
@export var mob_radius: float = 18.0
@export var mob_caw_reach: float = 14.0

var player_ref: PlayerController
var crows: Array[EnemyCarrionCrow] = []
## The hoard at the tree's foot (for tools and tests; the crows hear
## rummaging in it through the acoustic field like any other noise).
var nest: Lootable

var _mob_left: float = 0.0
var _caw_timer: float = 0.0

func _ready() -> void:
	add_to_group("crow_roost")

## Adopts a crow: its alarm sets the roost off.
func add_crow(crow: EnemyCarrionCrow) -> void:
	crows.append(crow)
	crow.crow_alarm.connect(func(_pos: Vector3) -> void: start_mobbing())

func is_mobbing() -> bool:
	return _mob_left > 0.0

func start_mobbing() -> void:
	if is_mobbing():
		_mob_left = maxf(_mob_left, mob_time * 0.5)
		return
	if crows.all(func(c: EnemyCarrionCrow) -> bool: return not is_instance_valid(c) or c.is_dead()):
		return
	_mob_left = mob_time
	_caw_timer = 0.6
	for c: EnemyCarrionCrow in crows:
		if is_instance_valid(c):
			c.scatter() # they stay away (away_time) longer than the mobbing lasts
	roost_event_banner.emit("The roost erupts — the flock mobs you, and every caw gives you away", Color(0.80, 0.72, 0.60))

## The flock settles back on the tree and stops mobbing.
func settle() -> void:
	_mob_left = 0.0
	for c: EnemyCarrionCrow in crows:
		if is_instance_valid(c):
			c.settle_on_perch()

func _physics_process(delta: float) -> void:
	if _mob_left <= 0.0:
		return
	_mob_left = maxf(0.0, _mob_left - delta)
	_caw_timer -= delta
	if _caw_timer > 0.0:
		return
	_caw_timer = caw_interval
	mob_caw()

## One caw over the survivor's head, credited to a live roost crow. Returns
## true if it sounded.
func mob_caw() -> bool:
	if player_ref == null or player_ref.current_state == PlayerController.ActionState.DEAD:
		return false
	var flat := Vector2(player_ref.global_position.x - global_position.x, player_ref.global_position.z - global_position.z)
	if flat.length() > mob_radius:
		return false
	for c: EnemyCarrionCrow in crows:
		if is_instance_valid(c) and not c.is_dead():
			if c.audio:
				c.audio.play_caw()
			AcousticField.report_as(self, c, player_ref.global_position + Vector3(0.0, 3.0, 0.0), mob_caw_reach, "caw")
			return true
	return false
