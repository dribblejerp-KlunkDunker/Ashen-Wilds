class_name NetPlayer
extends CharacterBody3D
## One survivor avatar in the shared courtyard (appendix §71).
##   Identity:    peer_id (this connection) and player_key (the persistent dev identity, §72).
##   State:       position and facing, owned by the server.
##   Simulation:  integrate(), the one walking rule, run by the server for everyone and by the
##                owning client for its own prediction.
##   Presentation: a NetPlayerView child; nothing here reads input or touches UI.
## Collision is a deliberate capsule footprint, not the rendered bounds (brief §11).

var peer_id: int = 0
var player_key: String = ""
var facing_yaw: float = 0.0

## Server only: the latest validated input and its bookkeeping.
var input_dir: Vector3 = Vector3.ZERO
var last_seq: int = 0
var inputs_this_second: int = 0
var rate_window: float = 0.0
var seconds_since_input: float = 0.0

## Client only, remote avatars: the latest authoritative state to ease toward.
var target_position: Vector3 = Vector3.ZERO
var target_yaw: float = 0.0
var has_target: bool = false

var view: NetPlayerView


static func create(id: int, key: String, pos: Vector3, yaw: float, color: Color) -> NetPlayer:
	var p := NetPlayer.new()
	p.name = str(id)
	p.peer_id = id
	p.player_key = key
	p.position = pos
	p.facing_yaw = yaw
	p.rotation.y = yaw
	p.target_position = pos
	p.target_yaw = yaw
	p.view = NetPlayerView.create(color)
	return p


func _ready() -> void:
	collision_layer = 2
	collision_mask = 1 | 2
	motion_mode = CharacterBody3D.MOTION_MODE_FLOATING
	var shape := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.35
	capsule.height = 1.7
	shape.shape = capsule
	shape.position = Vector3(0.0, 0.85, 0.0)
	add_child(shape)
	add_child(view)


## The walking rule. dir is a world-space direction with |dir| <= 1 and no vertical part.
func integrate(dir: Vector3, _delta: float) -> void:
	velocity = Vector3(dir.x, 0.0, dir.z) * NetProtocol.WALK_SPEED
	move_and_slide()
	position.y = 0.0
	if dir.length_squared() > 0.0001:
		facing_yaw = atan2(dir.x, dir.z)
	rotation.y = facing_yaw


## Remote avatars: ease toward the last authoritative state (no physics on this side).
func smooth_toward_target(delta: float) -> void:
	var k: float = 1.0 - exp(-NetProtocol.REMOTE_SMOOTHING * delta)
	position = position.lerp(target_position, k)
	rotation.y = lerp_angle(rotation.y, target_yaw, k)
