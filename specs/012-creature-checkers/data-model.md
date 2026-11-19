# Data Model: Critter Hop

All in-memory on the device (and copied between devices online). Enums are const objects in
`enums.ts` (constitution VIII).

## Enums

| Enum | Values |
|---|---|
| `CritterType` | `Fire`, `Water`, `Grass`, `Electric`, `Psychic`, `Rock` (sent online: don't change) |
| `BoardKind` | `Star`, `Cross` |
| `SeatKind` | `Person`, `Computer` |
| `Difficulty` | `Easy`, `Normal`, `Hard` |
| `HopKind` | `Step`, `Hop`, `LongHop` (per path segment, for drawing and effects) |
| `GameState` | `Setup`, `Playing`, `Over` |
| `HopMsg` | online message types — see [contracts/messages.md](contracts/messages.md) |
| `HopSpeed` | `Normal`, `Fast` (move animation; Fast ≈ 5× quicker) |
| `Screen` | `Setup`, `Play`, `End` |
| `ResultAction` | `Again`, `Menu` |

Advantage ring (constant, `types.ts`): `BEATS = { Water: Fire, Fire: Grass, Grass: Rock, Rock: Electric, Electric: Psychic, Psychic: Water }`.
`strong(a, b) = BEATS[a] === b`; `weak(a, b) = BEATS[b] === a`.

## Board (built once per kind, `boards.ts`)

| Field | Type | Rule |
|---|---|---|
| `kind` | `BoardKind` | |
| `holes` | `[q, r][]` | Star: 121 axial hex coords; Cross: 105 square coords (5×5 centre + four 5×4 arms) |
| `index` | `Map<string, number>` | coord key → hole index |
| `dirs` | `[dq, dr][]` | Star: 6; Cross: 8 |
| `homes` | `number[][]` | Star: 6 × 10 holes; Cross: 4 × 10 (outer two rows of each arm), clockwise |
| `opposite` | `number[]` | home → target home (Star: `(h + 3) % 6`; Cross: `(h + 2) % 4`) |

Validation (unit tests): hole count, every home has 10 holes, homes disjoint, `opposite` is an
involution, every hole's neighbours are inside the board.

## Seat

| Field | Type | Rule |
|---|---|---|
| `id` | 0..5 | turn order (clockwise) |
| `kind` | `SeatKind` | at least one `Person` per game |
| `slot` | number or −1 | online: the relay slot playing it; −1 = computer |
| `type` | `CritterType` | unique within a game |
| `home`, `target` | home indices | 2p: homes 0, 3; 4p (cross): 0–3; 6p: 0–5 |
| `place` | number or null | finishing place once done |

## Creature (piece)

| Field | Type | Rule |
|---|---|---|
| `id` | 0..59 | `seat * 10 + n` |
| `seat` | seat id | |
| `hole` | hole index | one creature per hole |
| `leader` | boolean | `n === 0`; looks only |
| `left` | boolean | has ever left its home (blocking rule, research R3) |

## Move

`{ piece, path: number[] }` — `path[0]` is the start hole, the rest are landing holes. Valid iff
`legalMoves(game, piece)` contains the same path. Each segment's `HopKind` is derived on replay.

## Game

| Field | Type |
|---|---|
| `board` | `Board` |
| `seats` | `Seat[]` (2, 4 or 6) |
| `pieces` | `Creature[]` |
| `occupant` | `Int8Array` per hole (piece id or −1) |
| `turn` | seat id whose move it is |
| `round` | number of full rounds played |
| `stall` | rounds since a creature last newly entered its target (ends at 20) |
| `difficulty` | `Difficulty` |
| `timerMs` | 0 (off) or 60 000 |
| `state` | `GameState` |
| `order` | seat ids by place |

**Transitions**: `Setup` → `Playing` (all seats have unique types) → each move: apply path, update
`left`, check finish (assign place), advance `turn` to next unfinished seat (skip seats with no
legal move, with a message), bump `round`/`stall` after the last seat of a round → `Over` when all
places are decided, one unfinished seat remains, `stall` hits 20, no Person seat is still playing, or players choose End game (a finish mid-game shows a banner, play continues).

## Settings (saved, `settings.ts`, key `ch-cfg`)

`{ type, players (2|4|6), seats: SeatKind[], difficulty, localTimer: boolean, speed: HopSpeed, muted: boolean }`,
each field falling back to its default on bad data.

## Room (online, built on the shared lobby)

Relay room (name, size 2/4/6, slots, rejoin keys) plus, in the game: `types: (CritterType|null)[]`
by slot (host-owned), `difficulty` (host), `runner` slot.
