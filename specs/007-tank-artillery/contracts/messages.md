# Contract: Tank Clash online messages

Game payloads over the relay (feature 003/004 protocol; the relay stamps `from`). The *runner* (the
device settling the battle) starts as the host (lowest slot) and can change (research R6). Every
message is validated on receipt; anything malformed or from the wrong sender is dropped. Hearts are
in tenths; angles in degrees; positions in world units.

| `t` | From | Fields | Meaning |
|---|---|---|---|
| `look` | anyone | `p: {name, color, type, side}` | the player's tank look and chosen side (cleaned like a saved look); a side switch is accepted only if that side has a free place |
| `mode` | host | `map` (`MapId`), `tanks` (2/4/6/8/10), `level` (`Difficulty`) | the waiting room's picks, shown to everyone |
| `begin` | runner | `seed`, `map` (resolved), `tanks: [id, slot or -1, side, type, x, look][]` | battle starts; every device builds the same battlefield from `seed` + `map` |
| `turn` | runner | `id`, `slot` (the player's slot, or −1 for a computer), `left` (ms), `wind`, `round`, `rest` (the round's turns still to come) | a tank's turn starts (devices count down locally); `slot` tells everyone who plays it now (a dropped player's tank is −1 until they rejoin) |
| `pose` | the device playing the active tank (the runner for computer tanks) | `id`, `x`, `angle`, `power`, `fuel` | the active tank's driving and aiming, ~15/s; the relay forwards it to everyone, and every device holds it to the tank's half, angle limits and fuel |
| `fire` | active player's device, or runner for computer tanks | `id`, `x`, `angle`, `power` | the shot; every device flies it with the turn's wind for drawing and the trail |
| `settle` | runner | `blasts: [x, y, r][]`, `tanks: [id, x, y, hearts, alive, gone, power, shield, gripUntil][]` (not alive and not gone = a wreck), `crates: [id, x, y, falling][]`, `got: [tankId, Drop][]` | the authoritative result of a shot, a timeout or a pick-up; devices apply blasts and replace tank and crate state |
| `drop` | runner | `id`, `x` | a crate starts falling at `x` (contents stay hidden until `got`) |
| `over` | runner | `winner` (`Side` or `draw`) | battle result |
| `hand` | runner | `to` (slot) | the runner hands over (its tab was hidden); sent right after a `settle` |
| `sync` | runner | `seed`, `map`, `tanks` (as `begin`), `blasts[]` (chunked, `first` 0/1), `turn` (as `turn`, plus `aim` 0/1: still aiming or mid-shot) | the battle so far for a player rejoining mid-battle; a `settle` follows |

Limits: ≤10 tanks; ≤3 crates; ≤200 blasts per `sync` chunk; all numbers finite and inside the
field; angle within the tank type's limits; `pose` ≤ 20/s (relay rate 40/s); every message ≤ 8 KB.
`begin`, `turn`, `settle`, `drop`, `over`, `hand`, `sync` are accepted only from the current runner;
`mode` only from the host; `pose` and `fire` only from the slot that owns the active tank (or the
runner when that tank is a computer's).
