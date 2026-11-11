class_name Weather
extends Node
## The Smothering's weathers. Six conditions, each a profile of what it does to sight, hearing,
## fire and footing, and to the look of the night; the weather drifts from one to the next on a
## cycle, blending over BLEND_SECONDS so nothing snaps. Owned by the bootstrap, which binds it to
## the things it drives: the Environment (fog, ambient), the Moon, the AshFall, the shelter fire,
## the survivor (torch burn, footing, how far their own noise carries) and their Perception (how
## far they see, how far they hear). Hearing cuts both ways: in a squall nobody hears anything;
## in the Dead Calm everyone hears everything.
##
## The profiles are first guesses meant for tuning; every number is in PROFILES. F5 forces the
## next condition. Tests set conditions directly with `set_condition(c, true)`.

signal changed(condition: Condition, banner: String)

enum Condition { ASHFALL, MIASMA_FOG, SLEET, CINDER_SQUALL, HOARFROST, DEAD_CALM }

const BLEND_SECONDS: float = 8.0
const SPELL_MIN: float = 70.0
const SPELL_MAX: float = 130.0
## The order the weather drifts through. Starts in ashfall, the Blackfen's ordinary night.
const CYCLE: Array[Condition] = [
	Condition.ASHFALL, Condition.MIASMA_FOG, Condition.SLEET, Condition.HOARFROST,
	Condition.CINDER_SQUALL, Condition.DEAD_CALM,
]

## Every field is numeric or a Color so the blend can lerp them all the same way.
##   fog_density, fog_color, fog_height_density: the Environment's fog.
##   ambient, moon: scales on the night's base ambient and moonlight energy.
##   flake_alpha, flake_color, fall_speed, drift, flake_size: the AshFall.
##   hearing: multiplies every loudness, the survivor's and the enemies'.
##   sight: metres; beyond it the survivor sees nothing, cone or not.
##   torch_burn: multiplies torch fuel use. fire: scales the shelter fire's light.
##   footing: multiplies the survivor's walking, sprinting and blocking speed.
##   spores: how long a spore cloud hangs (still air keeps it, wind and sleet clear it).
const PROFILES: Dictionary = {
	Condition.ASHFALL: {
		"name": "Ashfall", "banner": "Ash falls, as it always does.",
		"fog_density": 0.012, "fog_color": Color(0.22, 0.25, 0.29), "fog_height_density": 0.08,
		"ambient": 1.0, "moon": 1.0,
		"flake_alpha": 0.4, "flake_color": Color(0.46, 0.44, 0.42), "fall_speed": 0.55, "drift": 0.35, "flake_size": 0.028,
		"hearing": 1.0, "sight": 24.0, "torch_burn": 1.0, "fire": 1.0, "footing": 1.0, "spores": 1.0,
	},
	Condition.MIASMA_FOG: {
		"name": "Miasma fog", "banner": "The miasma closes in. Sounds die in it, and you cannot see past a few paces.",
		"fog_density": 0.055, "fog_color": Color(0.30, 0.34, 0.27), "fog_height_density": 0.22,
		"ambient": 0.9, "moon": 0.6,
		"flake_alpha": 0.15, "flake_color": Color(0.40, 0.42, 0.36), "fall_speed": 0.3, "drift": 0.2, "flake_size": 0.026,
		"hearing": 0.7, "sight": 7.0, "torch_burn": 1.0, "fire": 0.9, "footing": 1.0, "spores": 1.3,
	},
	Condition.SLEET: {
		"name": "Sleet", "banner": "Sleet. The torch gutters, and the ground turns to grease.",
		"fog_density": 0.02, "fog_color": Color(0.24, 0.27, 0.33), "fog_height_density": 0.1,
		"ambient": 0.95, "moon": 0.85,
		"flake_alpha": 0.55, "flake_color": Color(0.62, 0.66, 0.74), "fall_speed": 2.6, "drift": 0.6, "flake_size": 0.02,
		"hearing": 0.85, "sight": 14.0, "torch_burn": 1.8, "fire": 0.75, "footing": 0.85, "spores": 0.6,
	},
	Condition.CINDER_SQUALL: {
		"name": "Cinder-squall", "banner": "A cinder-squall. Embers ride the wind, and nothing can be heard over it.",
		"fog_density": 0.03, "fog_color": Color(0.33, 0.26, 0.21), "fog_height_density": 0.12,
		"ambient": 1.05, "moon": 0.7,
		"flake_alpha": 0.7, "flake_color": Color(0.95, 0.45, 0.15), "fall_speed": 0.9, "drift": 2.4, "flake_size": 0.03,
		"hearing": 0.6, "sight": 9.0, "torch_burn": 1.4, "fire": 1.2, "footing": 0.95, "spores": 0.4,
	},
	Condition.HOARFROST: {
		"name": "Hoarfrost", "banner": "Hoarfrost. The air rings: every step carries, and the ground is glass.",
		"fog_density": 0.006, "fog_color": Color(0.30, 0.34, 0.42), "fog_height_density": 0.04,
		"ambient": 1.1, "moon": 1.35,
		"flake_alpha": 0.0, "flake_color": Color(0.7, 0.75, 0.85), "fall_speed": 0.3, "drift": 0.1, "flake_size": 0.02,
		"hearing": 1.25, "sight": 32.0, "torch_burn": 1.2, "fire": 1.0, "footing": 0.8, "spores": 0.9,
	},
	Condition.DEAD_CALM: {
		"name": "Dead Calm", "banner": "The Dead Calm. Nothing falls. Everything can be heard, by everyone.",
		"fog_density": 0.004, "fog_color": Color(0.22, 0.25, 0.29), "fog_height_density": 0.03,
		"ambient": 1.0, "moon": 1.1,
		"flake_alpha": 0.0, "flake_color": Color(0.46, 0.44, 0.42), "fall_speed": 0.3, "drift": 0.1, "flake_size": 0.02,
		"hearing": 1.6, "sight": 40.0, "torch_burn": 0.8, "fire": 1.0, "footing": 1.0, "spores": 1.6,
	},
}

var current: Condition = Condition.ASHFALL
## Seconds left in the current spell before the weather drifts on. Negative: never (tests).
var spell_left: float = 90.0
## True while the cycle runs on its own; tests turn it off.
var cycling: bool = true

## The profile that was showing when the current condition was set; the blend runs from it.
var _start: Dictionary = PROFILES[Condition.ASHFALL]
var _blend: float = 1.0
var _rng := RandomNumberGenerator.new()

var _env: Environment
var _moon: DirectionalLight3D
var _ash: AshFall
var _fire: FlickerLight
var _player: PlayerController
var _base_ambient: float = 1.0
var _base_moon: float = 1.0
var _base_fire: float = 1.0


func _init(seed_value: int = 1306) -> void:
	name = "Weather"
	_rng.seed = seed_value
	spell_left = _rng.randf_range(SPELL_MIN, SPELL_MAX)


## Everything the weather drives. Any may be null (tests, the networked scene).
func bind(env: Environment, moon: DirectionalLight3D, ash: AshFall, fire: FlickerLight, player: PlayerController) -> void:
	_env = env
	_moon = moon
	_ash = ash
	_fire = fire
	_player = player
	if _env != null:
		_base_ambient = _env.ambient_light_energy
	if _moon != null:
		_base_moon = _moon.light_energy
	if _fire != null:
		_base_fire = _fire.base_energy
	_apply()


func _process(delta: float) -> void:
	if _blend < 1.0:
		_blend = minf(1.0, _blend + delta / BLEND_SECONDS)
		_apply()
	if cycling and spell_left >= 0.0:
		spell_left -= delta
		if spell_left <= 0.0:
			advance()


## The next condition in the cycle.
func advance() -> void:
	set_condition(CYCLE[(CYCLE.find(current) + 1) % CYCLE.size()])


func set_condition(c: Condition, instant: bool = false) -> void:
	if c == current and _blend >= 1.0:
		return
	# A change that lands mid-blend starts from what was showing, not from where it was heading.
	_start = profile().duplicate()
	current = c
	_blend = 1.0 if instant else 0.0
	spell_left = _rng.randf_range(SPELL_MIN, SPELL_MAX)
	_apply()
	changed.emit(current, String(PROFILES[current]["banner"]))


func condition_name(c: Condition = current) -> String:
	return String(PROFILES[c]["name"])


## The profile in force now: the target's, blended from the previous one while `_blend` < 1.
func profile() -> Dictionary:
	var to: Dictionary = PROFILES[current]
	if _blend >= 1.0:
		return to
	var out: Dictionary = {}
	for key: String in to.keys():
		var a: Variant = _start.get(key, to[key])
		var b: Variant = to[key]
		if a is float or a is int:
			out[key] = lerpf(float(a), float(b), _blend)
		elif a is Color:
			out[key] = (a as Color).lerp(b as Color, _blend)
		else:
			out[key] = b
	return out


func _apply() -> void:
	var p: Dictionary = profile()
	if _env != null:
		_env.fog_density = float(p["fog_density"])
		_env.fog_light_color = p["fog_color"] as Color
		_env.fog_height_density = float(p["fog_height_density"])
		_env.ambient_light_energy = _base_ambient * float(p["ambient"])
	if _moon != null:
		_moon.light_energy = _base_moon * float(p["moon"])
	if _ash != null:
		_ash.apply(float(p["flake_alpha"]), p["flake_color"] as Color, float(p["fall_speed"]), float(p["drift"]), float(p["flake_size"]))
	if _fire != null:
		_fire.base_energy = _base_fire * float(p["fire"])
	if _player != null:
		_player.weather_hearing = float(p["hearing"])
		_player.weather_torch_burn = float(p["torch_burn"])
		_player.weather_footing = float(p["footing"])
		if _player.perception != null:
			_player.perception.hearing = float(p["hearing"])
			_player.perception.sight_range = float(p["sight"])
