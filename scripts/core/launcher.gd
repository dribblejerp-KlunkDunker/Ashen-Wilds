class_name Launcher
extends Node
## The project's entry scene. One exported binary serves every role (appendix §85): started with
## --server or --client after the `--` separator it opens the networked courtyard; started with
## no such argument it opens the single-player prototype exactly as before.
##   ./ashen-wilds.x86_64 --headless -- --server --port 7788
##   ./ashen-wilds.x86_64 -- --client --host 203.0.113.5 --port 7788 --player-key alice
##   ./ashen-wilds.x86_64                       (the single-player Watchhouse)

const NET_SCENE: String = "res://net_main.tscn"
const SOLO_SCENE: String = "res://main.tscn"


func _ready() -> void:
	var args: PackedStringArray = OS.get_cmdline_user_args()
	var networked: bool = args.has("--server") or args.has("--client")
	get_tree().change_scene_to_file.call_deferred(NET_SCENE if networked else SOLO_SCENE)
