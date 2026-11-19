# Contract: Critter Hop online messages

Game payloads over the existing relay (features 003/004 protocol, 007 rejoin keys; the relay stamps
`from`). The *runner* starts as the host (lowest slot) and moves to the next lowest slot if it
leaves (research R5–R6). Every message is checked on arrival; anything malformed, from the wrong
sender, or (for `move`) not in `legalMoves` is dropped.

| `t` | From | Fields | Meaning |
|---|---|---|---|
| `pick` | anyone (waiting room) | `type` (`CritterType`) | asks for a type; the host decides |
| `types` | host | `types: [slot, CritterType][]`, `level` (`Difficulty`) | the room's taken types and computer strength; replaces any earlier list (first request for a type wins) |
| `begin` | runner | `seed`, `seats: [seatId, slot or −1, CritterType][]` | the game starts; every device builds the same board, seats and pieces; the seed drives computer choices |
| `turn` | runner | `seat`, `left` (ms), `round`, `stall` | a turn starts (devices count down locally) |
| `move` | the slot owning the seat in turn; the runner for computer seats and timeouts | `seat`, `piece`, `path: number[]` (≤ 2 + 121 holes) | a move; every device checks and applies it |
| `sync` | runner | `seed`, `seats` (as `begin`, with the rejoiner's slot back on its seat), `holes: number[]` (one per creature), `flags: number[]` (1 = has left home, 2 = has reached its target), `order` (places so far), `progress` (0/1), `turn` (as `turn`) | everything so far, for a player rejoining mid-game |

Drops and rejoins need no message of their own: every device sees the relay's `leave` and `join` frames and
gives a dropped player's seat to a computer (or back to them) itself, using the seats from `begin`. The end
of the game follows from the moves, so every device reaches the same result without an `over` message.

Limits: ≤6 seats; piece ids 0..59; hole indices within the board; paths of distinct holes; one
`move` per turn (a second `move` for the same turn is ignored); every message ≤ 8 KB (a full `sync`
is under 1 KB). `types` only from the host; `begin`, `turn`, `sync` only from the runner.
