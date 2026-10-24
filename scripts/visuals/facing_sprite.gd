class_name FacingSprite
extends Sprite3D
## A painted billboard that mirrors itself to show which way its owner faces.
## The owner's facing is its parent's -Z (every class's _visual_root looks
## along its facing). The sheets' figures are drawn turned slightly to screen
## left, so the sprite flips when the owner faces screen right.
##
## Death poses tip _visual_root over (about X for the humanoids, about Z for
## the bear, rot-beast and crawler). A Y-locked billboard would keep standing,
## and a quad left in the tipped body's plane is edge-on from some camera
## angles, so a fallen sprite stops billboarding and is laid flat on the
## ground, face up, head away from the camera: a corpse reads as a corpse from
## anywhere.

@export var drawn_facing_left: bool = true
## The owner counts as fallen once its up axis tips past ~60 degrees.
const FALLEN_UP_Y: float = 0.5
## Lift off the ground so the flat quad doesn't z-fight the floor.
const GROUND_LIFT: float = 0.06

func _ready() -> void:
	# Keeps updating on frozen owners (tests and the screenshot tool freeze enemies).
	process_mode = Node.PROCESS_MODE_ALWAYS

func is_fallen() -> bool:
	var parent := get_parent() as Node3D
	return parent != null and parent.global_basis.y.normalized().y < FALLEN_UP_Y

## True when the quad lies on the ground (its normal is vertical).
func is_lying_flat() -> bool:
	return absf(global_basis.z.normalized().y) > 0.9

func _process(_delta: float) -> void:
	var parent := get_parent() as Node3D
	var cam: Camera3D = get_viewport().get_camera_3d()
	if parent == null:
		return
	if is_fallen():
		billboard = BaseMaterial3D.BILLBOARD_DISABLED
		_lie_flat(parent, cam)
		return
	billboard = BaseMaterial3D.BILLBOARD_FIXED_Y
	transform = Transform3D.IDENTITY
	if cam == null:
		return
	var facing: Vector3 = -parent.global_basis.z
	var screen_right: Vector3 = cam.global_basis.x
	var faces_right: bool = facing.dot(screen_right) > 0.05
	flip_h = faces_right if drawn_facing_left else not faces_right

func _lie_flat(parent: Node3D, cam: Camera3D) -> void:
	var away: Vector3 = Vector3.FORWARD
	if cam:
		away = -cam.global_basis.z
		away.y = 0.0
		away = away.normalized() if away.length_squared() > 0.001 else Vector3.FORWARD
	var right: Vector3 = Vector3.UP.cross(away).normalized()
	# X = screen right, Y (image up) = along the ground away from the camera,
	# Z (the quad's normal) = straight up.
	var basis := Basis(right, away, right.cross(away))
	var feet: Vector3 = parent.global_position
	var body := parent.get_parent() as Node3D
	if body:
		feet.y = body.global_position.y
	global_transform = Transform3D(basis, feet + Vector3(0.0, GROUND_LIFT, 0.0))
