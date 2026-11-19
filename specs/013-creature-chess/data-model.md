# Data Model: Critter Chess

In-memory on each device (copied between devices online). Enums are const objects in `enums.ts`.

## Enums

| Enum | Values |
|---|---|
| `CritterType` | `Fire`, `Water`, `Grass`, `Electric`, `Psychic`, `Rock` (sent online) |
| `BoardKind` | `Square`, `Cross`, `Hex` |
| `PieceKind` | `King`, `Queen`, `Rook`, `Bishop`, `Knight`, `Pawn` (sent online) |
| `SeatKind` | `Person`, `Computer` |
| `Difficulty` | `Easy`, `Normal`, `Hard` |
| `SeatState` | `Playing`, `Out` |
| `EndWhy` | `Mate`, `Draw`, `LastStanding`, `NoProgress` |
| `ChessMsg` | `pick`, `types`, `begin`, `turn`, `move`, `sync` |
| `Screen`, `ResultAction`, `HopSpeed`-like `MoveSpeed` | UI states, as in Critter Hop |

## Board (`boards.ts`, built once per kind)

| Field | Rule |
|---|---|
| `cells: [a, b][]` | Square 64, Cross 160, Hex 397 (side 12; research R3) |
| `pos: [x, y][]` | flat layout for the scene |
| `straight[cell][dir]`, `diagonal[cell][dir]` | rays (nearest first): 4+4 on squares, 6+6 on hex |
| `knight[cell]`, `king[cell]` | jump/step targets: ≤8 / ≤8 squares; ≤12 / ≤12 hex |
| `armies[]` | per army slot: `back` cells in R N B Q K B N R order, `pawns` cells, `pawnStep` (direction), `pawnCaptures` (directions), `doubleStep` (2-player and cross only), `promote` (cells), `castle` (king/rook cells, or none on hex) |

Seats per board: Square 2, Cross 4, Hex 6 (clockwise from the near side).

## Piece

`{ id, seat, kind: PieceKind, cell, moved: boolean }` — `moved` for castling and pawn double steps.

## Seat

`{ id, kind: SeatKind, type: CritterType, slot (−1 offline/computer), state: SeatState, place: number | null }`

## Move

`{ piece, from, to, capture: pieceId | −1, promo?: PieceKind, castle?: rookPieceId, enPassant?: true }`
Online a move is sent as `{ from, to, promo? }`; every device rebuilds the full move from its own
legal move list (illegal ones are dropped).

## Game

| Field | Rule |
|---|---|
| `board`, `seats`, `pieces`, `at: Int16Array` (cell → piece or −1) | |
| `turn` | seat id |
| `epCell` | en-passant target or −1 (2 players only) |
| `quiet` | plies since the last capture or pawn move (50-move rule; 4/6: rounds × seats) |
| `keys: Map<string, number>` | position key counts (threefold repetition, 2 players) |
| `state: playing / over`, `why: EndWhy`, `order` (seats by place; shared places allowed) |

**Transitions**: start of a seat's turn → `inCheck`, `legal = legalMoves(seat)`; none + check → seat
`Out` (pieces removed); none + no check → 2 players: draw; 4/6: skip. A move: apply (capture,
castle, en passant, promotion), update `moved`, `epCell`, `quiet`, `keys`; a captured king → its
seat `Out`; check end conditions (R4); next seat clockwise still `Playing`.

## Settings (saved, key `cc-cfg`)

`{ players (2|4|6), types[6], seats: SeatKind[6], difficulty, speed, muted }`, field-by-field fallback.
