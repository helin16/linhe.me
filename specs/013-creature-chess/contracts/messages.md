# Contract: Critter Chess online messages

Game payloads over the existing relay (features 003/004 protocol, 007 rejoin keys; the relay stamps
`from`). Same model as Critter Hop (specs/012-creature-checkers/contracts/messages.md): the
*runner* (first the host, then the lowest slot left) **orders every move** — a player sends their
move to everyone, only the runner plays it and sends it back, and every device plays only the
runner's moves, so all devices see one order (a timeout and a late move can't both happen).

| `t` | From | Fields | Meaning |
|---|---|---|---|
| `pick` | anyone (waiting room) | `type` (`CritterType`) | asks for a type; the host decides |
| `types` | host | `types: [slot, CritterType][]`, `level` (`Difficulty`) | taken types (first come wins) and the computer strength |
| `begin` | runner | `seed`, `seats: [seatId, slot or −1, CritterType][]` (2, 4 or 6, which also picks the board) | the game starts |
| `turn` | runner | `seat`, `left` (ms, 0–60 000) | a turn starts; devices count down locally |
| `move` | the player in turn (a request) or the runner (the move itself) | `seat`, `at` (the moving piece's cell), `to`, `promo?` (`PieceKind`: Queen/Rook/Bishop/Knight) | a move; checked against the receiving device's legal moves |
| `sync` | runner | `seed`, `seats` (as in `begin`: who each seat began with), `now` (the slot playing each seat now, −1 for a computer), `pieces: [cell, PieceKind, seat, moved 0/1][]` (≤ 96), `places` (per seat: null while in, else its place), `turn`, `left`, `ep` (`[cell passed over, pawn's cell]` or null), `quiet`, `keys: [hash, count][]` (repetition history since the last pawn move or capture, ≤ 100) | everything so far, for a player rejoining mid-game |

Drops and rejoins need no message: every device sees relay `leave`/`join` and gives the seat to a
computer (or back), using the seats from `begin`. Results follow from the moves on every device.

Limits: ≤ 6 seats; cells within the board; ≤ 96 pieces; every message ≤ 8 KB (a full 6-player
`sync` is about 3 KB). `types` only from the host; `begin`, `turn`, `sync` only from the runner;
a `move` is played only when it comes from the runner (or, on the runner, from the seat's player).
