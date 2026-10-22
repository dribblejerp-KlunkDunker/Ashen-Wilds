class_name ProceduralAudio
extends Node

var _sfx_player: AudioStreamPlayer
var _playback: AudioStreamGeneratorPlayback
var _sample_rate: float = 22050.0

var _burst_timer: float = 0.0
var _burst_duration: float = 0.0
var _burst_freq: float = 180.0
var _burst_noise_mix: float = 0.5
var _burst_metallic: bool = false
var _phase: float = 0.0

func _ready() -> void:
	_sfx_player = AudioStreamPlayer.new()
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = _sample_rate
	gen.buffer_length = 0.1
	_sfx_player.stream = gen
	_sfx_player.volume_db = -6.0
	add_child(_sfx_player)
	_sfx_player.play()
	_playback = _sfx_player.get_stream_playback() as AudioStreamGeneratorPlayback

func _process(delta: float) -> void:
	if _playback == null:
		return
	if _burst_timer > 0.0:
		_burst_timer = maxf(0.0, _burst_timer - delta)
	_fill_buffer()

func play_swing() -> void:
	_trigger_sound(0.11, 140.0, 0.85, false)

func play_flesh_hit() -> void:
	_trigger_sound(0.16, 95.0, 0.65, false)

func play_shield_block() -> void:
	_trigger_sound(0.22, 310.0, 0.35, true)

func play_guard_break() -> void:
	_trigger_sound(0.38, 110.0, 0.75, true)

func play_unseen_threat_cue() -> void:
	_trigger_sound(0.14, 420.0, 0.90, false)

func play_ogre_ground_slam() -> void:
	_trigger_sound(0.48, 52.0, 0.78, false)

func play_wall_clang() -> void:
	_trigger_sound(0.20, 560.0, 0.30, true)

func play_lodge_thud() -> void:
	_trigger_sound(0.18, 88.0, 0.55, false)

func play_ogre_roar() -> void:
	_trigger_sound(0.42, 74.0, 0.45, false)

func _trigger_sound(duration: float, freq: float, noise_mix: float, metallic: bool) -> void:
	_burst_duration = duration
	_burst_timer = duration
	_burst_freq = freq
	_burst_noise_mix = noise_mix
	_burst_metallic = metallic

func _fill_buffer() -> void:
	var frames_available: int = _playback.get_frames_available()
	for i in range(frames_available):
		var sample: float = 0.0
		var wind: float = (randf() * 2.0 - 1.0) * 0.012
		if _burst_timer > 0.0 and _burst_duration > 0.0:
			var env: float = (_burst_timer / _burst_duration)
			env = env * env
			_phase += _burst_freq / _sample_rate
			var tone: float = sin(_phase * TAU)
			if _burst_metallic:
				tone = (tone + 0.6 * sin(_phase * TAU * 2.41) + 0.4 * sin(_phase * TAU * 3.83)) * 0.5
			var noise: float = (randf() * 2.0 - 1.0)
			sample = lerpf(tone, noise, _burst_noise_mix) * env * 0.48
		_playback.push_frame(Vector2(sample + wind, sample + wind))
