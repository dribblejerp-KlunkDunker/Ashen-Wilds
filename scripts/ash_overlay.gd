extends Control
## Ash falling and embers rising, drawn as single pixels over the low-resolution view.

var flecks: Array[Vector3] = []   # x, y, kind (0 ash, 1 ember)
var t: float = 0.0

func _ready() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 31
	for i: int in 90:
		flecks.append(Vector3(rng.randf() * 320.0, rng.randf() * 150.0, 0.0))
	for i: int in 16:
		flecks.append(Vector3(rng.randf() * 320.0, 70.0 + rng.randf() * 110.0, 1.0))

func _process(delta: float) -> void:
	t += delta
	queue_redraw()

func _draw() -> void:
	for f: Vector3 in flecks:
		if f.z < 0.5:
			var p := Vector2(fposmod(f.x + t * 6.0, 320.0), fposmod(f.y + t * 14.0, 150.0))
			draw_rect(Rect2(p.floor(), Vector2.ONE), Color(0.62, 0.60, 0.58, 0.55))
		else:
			var q := Vector2(fposmod(f.x + sin(t + f.y) * 3.0, 320.0), fposmod(f.y - t * 9.0, 150.0))
			draw_rect(Rect2(q.floor(), Vector2.ONE), Color(0.95, 0.45, 0.16, 0.9))
