# Contract: Snake Duel online messages

Game payloads over the relay (feature 003/004 protocol; the relay stamps `from`). The *runner*
(the device running the arena) starts as the host (lowest slot) and can change (research R4). Every message is validated on receipt; anything malformed or from the wrong sender is dropped.

| `t` | From | Fields | Meaning |
|---|---|---|---|
| `look` | anyone | `p: {name, color, accent, pattern, eyes}` | the player's snake look (name ≤10 chars, colours `#rrggbb`, pattern/eyes from their enums; cleaned like a saved look) |
| `in` | guest | `h` (target radians) or `r` (turn −1…1), `b` (0/1) | steering and boost, ~20/s |
| `orbs` | runner | `o: [id, x, y, size, color][]`, `first` (0/1) | the full orb list in chunks of up to 150 (`first: 1` on the first chunk clears the old list): at round start |
| `mode` | runner | `type` (`MatchType`), `level` (`Difficulty`) | match type and computer-snake difficulty picked in the waiting room |
| `begin` | runner | `type`, `round`, `snakes: [id, slot or -1, x, y, h, length, look][]` | round begins (after a 3 s countdown on every screen); players' looks come from their `look`, bots' from the host |
| `snap` | runner | `s: [id, x, y, h, length, boost, alive][]`, `eat: id[]`, `add: [id,x,y,size,color][]`, `out: id[]` | arena state, ~20/s |
| `result` | runner | `winner` (slot or null), `wins: [slot, n][]` | Deathmatch round result |
| `clock` | runner | `left` (ms) | Quick match time left, ~1/s (guests count down between) |
| `match` | runner | `winner` (slot) | match result |
| `hand` | runner | `to` (slot) | the runner hands the arena to `to` (its tab was hidden); sent right after a `snap` |

Limits: ≤20 snakes per `snap`, ≤150 orbs per `orbs` chunk; numbers finite and within the arena; `snap` ≤ 8 KB (relay cap);
guests send ≤ 25 messages/s (relay rate 40/s). `orbs`, `mode`, `begin`, `snap`, `round`, `clock`,
`match` and `hand` are accepted only from the current runner; `in` only from a slot in the room.
