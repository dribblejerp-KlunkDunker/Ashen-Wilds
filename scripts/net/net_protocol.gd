class_name NetProtocol
extends RefCounted
## Wire-level constants shared by server and clients (appendix §73). The handshake compares
## PROTOCOL_VERSION; bump it whenever an RPC signature or its meaning changes.
## Everything here is a server rule or a shared definition, never a client preference (§86).

const PROTOCOL_VERSION: int = 1
const BUILD_ID: String = "m1a-courtyard-spike"
const DEFAULT_PORT: int = 7788

## Default for the server's --max-players setting (§85): two for the spike (brief §7). Not a
## final player count; the capacity rejection text quotes whatever the server was started with.
const MAX_PLAYERS: int = 2
## A connected peer that has not introduced itself within this time is dropped.
const HELLO_TIMEOUT_SECONDS: float = 3.0
## Physics runs at 60 Hz; authoritative state goes out every second tick (assumption A3: 30 Hz).
const STATE_SEND_EVERY_TICKS: int = 2
## Inputs above this rate from one peer are dropped and counted (brief §8, request limits).
const MAX_INPUTS_PER_SECOND: int = 200
## If a moving player's input stops arriving for this long, the server stops them (lost packet).
const INPUT_DEADMAN_SECONDS: float = 0.25

## Movement policy (appendix §77): immediate velocity, no acceleration, ground plane only.
const WALK_SPEED: float = 3.2
## Local responsiveness: the owning client predicts its own walk and corrects toward the
## server's answer. Errors above SNAP_DISTANCE are applied at once; smaller ones blended.
const SNAP_DISTANCE: float = 1.0
const CORRECTION_RATE: float = 0.3
## Remote avatars ease toward their latest authoritative state at this rate.
const REMOTE_SMOOTHING: float = 12.0

## Rejection categories (appendix §80). Names are what logs and the HUD show.
enum Reject {
	NONE,
	PROTOCOL_MISMATCH,
	SERVER_FULL,
	BAD_KEY,
	KEY_IN_USE,
	HELLO_TIMEOUT,
	NO_PLAYER,
	BAD_INPUT,
	RATE_LIMIT,
}

static func reject_name(reason: int) -> String:
	var names: Array = Reject.keys()
	if reason < 0 or reason >= names.size():
		return "UNKNOWN"
	return str(names[reason])

## Player-facing wording for a rejection (§80): specific, no stack traces.
static func reject_text(reason: int) -> String:
	match reason:
		Reject.PROTOCOL_MISMATCH:
			return "This build cannot join that server (protocol %d). Update one of them." % PROTOCOL_VERSION
		Reject.SERVER_FULL:
			return "The server is full."
		Reject.BAD_KEY:
			return "The player key is missing or malformed."
		Reject.KEY_IN_USE:
			return "That player is already connected."
		Reject.HELLO_TIMEOUT:
			return "The client never introduced itself."
		_:
			return "Rejected: %s." % reject_name(reason)

static func valid_player_key(key: String) -> bool:
	if key.is_empty() or key.length() > 64:
		return false
	for ch: String in key:
		if not (ch.is_valid_identifier() or ch == "-"):
			return false
	return true
