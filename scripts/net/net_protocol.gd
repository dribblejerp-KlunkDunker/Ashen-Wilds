class_name NetProtocol
extends RefCounted
## Wire-level constants shared by server and clients (appendix §73). The handshake compares
## PROTOCOL_VERSION; bump it whenever an RPC signature or its meaning changes.
## Everything here is a server rule or a shared definition, never a client preference (§86).

## 1: Milestone 1a (join, movement). 2: Milestone 1b (container contents, take item, pack state).
## 3: Milestone 1c (store item). 4: Milestone 3 (fixture use, fixture state).
const PROTOCOL_VERSION: int = 4
const BUILD_ID: String = "m3-persistent-refuge"
const DEFAULT_PORT: int = 7788

## Default for the server's --max-players setting (§85): two for the spike (brief §7). Not a
## final player count; the owners have said multiplayer stays small (decision P5).
const MAX_PLAYERS: int = 2
## A connected peer that has not introduced itself within this time is dropped.
const HELLO_TIMEOUT_SECONDS: float = 3.0
## Physics runs at 60 Hz; authoritative state goes out every second tick (assumption A3: 30 Hz).
const STATE_SEND_EVERY_TICKS: int = 2
## Inputs above this rate from one peer are dropped and counted (brief §8, request limits).
const MAX_INPUTS_PER_SECOND: int = 200
## Interaction requests above this rate from one peer are rejected (brief §8).
const MAX_REQUESTS_PER_SECOND: int = 20
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

## Interaction (supplement §34): reach, measured on the ground plane between the survivor and
## the object's origin. No line-of-sight rule yet (recorded as open).
const INTERACT_RADIUS: float = 2.5
## Pack capacity (decision P11: weight only). The existing Inventory allows carrying past
## capacity up to hard_limit_ratio (1.5x) at an encumbrance cost, as in the single-player game.
const PACK_CAPACITY_KG: float = 12.0
## Request ids a server remembers per connection, so a repeated request gets its first answer.
const REQUEST_MEMORY: int = 64
## Persistence (temporary rule A4). The server writes after a durable change at most this often,
## records live players' positions this often, and always writes on a clean shutdown.
const SAVE_DEBOUNCE_SECONDS: float = 1.0
const POSITION_SAVE_SECONDS: float = 30.0
const DEFAULT_SAVE_PATH: String = "user://ashen_world.json"

## Join rejection categories (appendix §80). Names are what logs and the HUD show.
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

## Interaction request outcomes (appendix §80). OK is the only success.
enum Result {
	OK,
	INVALID_REQUEST,
	NOT_READY,
	OBJECT_UNAVAILABLE,
	OUT_OF_RANGE,
	STATE_CHANGED,
	CAPACITY_EXCEEDED,
	RATE_LIMITED,
	INSUFFICIENT_RESOURCES,
}

static func reject_name(reason: int) -> String:
	var names: Array = Reject.keys()
	if reason < 0 or reason >= names.size():
		return "UNKNOWN"
	return str(names[reason])

static func result_name(code: int) -> String:
	var names: Array = Result.keys()
	if code < 0 or code >= names.size():
		return "UNKNOWN"
	return str(names[code])

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

## Player-facing wording for an interaction result (§34 asks for a clear reason every time).
static func result_text(code: int) -> String:
	match code:
		Result.OK:
			return "Done."
		Result.INVALID_REQUEST:
			return "That request made no sense to the server."
		Result.NOT_READY:
			return "You are not in the world yet."
		Result.OBJECT_UNAVAILABLE:
			return "That container is no longer available."
		Result.OUT_OF_RANGE:
			return "Too far away."
		Result.STATE_CHANGED:
			return "Someone got there first. The container has been refreshed."
		Result.CAPACITY_EXCEEDED:
			return "Too heavy to carry."
		Result.RATE_LIMITED:
			return "Slow down."
		Result.INSUFFICIENT_RESOURCES:
			return "You don't carry enough for that."
		_:
			return "Rejected: %s." % result_name(code)

static func valid_player_key(key: String) -> bool:
	if key.is_empty() or key.length() > 64:
		return false
	for ch: String in key:
		if not (ch.is_valid_identifier() or ch == "-"):
			return false
	return true

static func valid_object_id(id: String) -> bool:
	if id.is_empty() or id.length() > 64:
		return false
	for ch: String in id:
		if not (ch.is_valid_identifier() or ch == "-" or ch == "/"):
			return false
	return true

## Stacks cross the wire as plain arrays: [stack_id, item_id, quantity, condition].
static func stack_to_wire(stack_id: int, inst: ItemInstance) -> Array:
	return [stack_id, inst.data.item_id, inst.quantity, inst.condition]
