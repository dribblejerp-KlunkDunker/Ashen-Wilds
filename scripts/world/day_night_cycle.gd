class_name DayNightCycle
extends Node
## Milestone 19: day & night. A 24-hour clock runs over `day_length` real
## seconds (F8 skips ahead three hours). Night is darker and colder: the
## WeatherSystem dims its sun, ambient and fog by `get_darkness()`, and
## `WeatherSystem.factor()` folds the night into "sight" and "cold". In the
## dark you see less without fire, and your enemies see less of you, unless
## you carry a lit torch. Creatures with `night_eyed` (goblins, the ghoul)
## see as well as by day. Gameplay asks `DayNightCycle.darkness(node)`.

signal phase_changed(phase: Phase, display_name: String)

enum Phase { DAWN, DAY, DUSK, NIGHT }

## Sight lost at full dark without a lit torch, and with one.
const NIGHT_SIGHT_LOSS: float = 0.45
const TORCH_NIGHT_SIGHT_LOSS: float = 0.15
## Extra warmth drain at full dark (×1.7).
const NIGHT_COLD: float = 0.7
## The night is still: sound carries a little further (×1.15).
const NIGHT_HEARING: float = 0.15
const DAWN_HOUR: float = 6.0

@export var cycle_enabled: bool = true
## Real seconds per 24 hours. Night (20:00–05:00) is 6 of the 16 minutes.
@export var day_length: float = 960.0

var hour: float = 8.0
var weather: WeatherSystem
var phase: Phase = Phase.DAY

func _ready() -> void:
	add_to_group("daynight")
	phase = phase_of(hour)

static func find(node: Node) -> DayNightCycle:
	if node == null or not node.is_inside_tree():
		return null
	return node.get_tree().get_first_node_in_group("daynight") as DayNightCycle

## 0 by day (07:00–18:00), 1 at night (20:00–05:00), easing through dusk and dawn.
static func darkness_at_hour(h: float) -> float:
	h = fposmod(h, 24.0)
	if h >= 7.0 and h <= 18.0:
		return 0.0
	if h > 18.0 and h < 20.0:
		return smoothstep(18.0, 20.0, h)
	if h >= 5.0 and h < 7.0:
		return 1.0 - smoothstep(5.0, 7.0, h)
	return 1.0

static func phase_of(h: float) -> Phase:
	h = fposmod(h, 24.0)
	if h >= 5.0 and h < 7.0:
		return Phase.DAWN
	if h >= 7.0 and h < 18.0:
		return Phase.DAY
	if h >= 18.0 and h < 20.0:
		return Phase.DUSK
	return Phase.NIGHT

static func phase_name(p: Phase) -> String:
	match p:
		Phase.DAWN:
			return "Dawn"
		Phase.DAY:
			return "Day"
		Phase.DUSK:
			return "Dusk"
	return "Night"

## How dark it is for this node right now (0 when there's no cycle).
static func darkness(node: Node) -> float:
	var dn: DayNightCycle = find(node)
	return dn.get_darkness() if dn else 0.0

## The night's effect on sight for `viewer`. The survivor loses less with a
## lit torch; anyone looking at a survivor who carries one sees them as by day.
static func sight_factor(viewer: Node) -> float:
	var d: float = darkness(viewer)
	if d <= 0.0 or viewer.get("night_eyed") == true:
		return 1.0
	if viewer is PlayerController:
		var loss: float = TORCH_NIGHT_SIGHT_LOSS if (viewer as PlayerController).is_torch_lit() else NIGHT_SIGHT_LOSS
		return 1.0 - loss * d
	var target: Variant = viewer.get("player_ref")
	if target is PlayerController and (target as PlayerController).is_torch_lit():
		return 1.0
	return 1.0 - NIGHT_SIGHT_LOSS * d

func get_darkness() -> float:
	return darkness_at_hour(hour)

func is_night() -> bool:
	return phase == Phase.NIGHT

func get_phase_name() -> String:
	return phase_name(phase)

func clock_text() -> String:
	var minutes: int = int(hour * 60.0) % (24 * 60)
	return "%02d:%02d" % [floori(minutes / 60.0), minutes % 60]

func set_hour(h: float) -> void:
	hour = fposmod(h, 24.0)
	var p: Phase = phase_of(hour)
	if p != phase:
		phase = p
		phase_changed.emit(p, phase_name(p))
	if weather:
		weather.refresh_environment()

func advance_hours(n: float) -> void:
	set_hour(hour + n)

## Hours from now until the next dawn (06:00).
func hours_until_dawn() -> float:
	return fposmod(DAWN_HOUR - hour, 24.0)

func _physics_process(delta: float) -> void:
	if cycle_enabled:
		set_hour(hour + delta * 24.0 / maxf(day_length, 1.0))
