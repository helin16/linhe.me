# Research: Critter Chess

## R1. Three boards as data, one move engine

- **Decision**: A board is a table like Critter Hop's: `cells` (integer coordinates), `pos` (flat
  layout for drawing), and per cell precomputed `rays` for each slider direction set (`straight`,
  `diagonal`), `knight` jump targets, and `king` step targets. Armies carry their own `forward`
  data for pawns. One move generator reads only these tables:
  - **Square boards** (8 × 8, cross): straight = 4 orthogonal directions, diagonal = 4 diagonals,
    knight = the 8 (±1, ±2) jumps, king = the 8 neighbours.
  - **Hexagon** (axial coordinates, flat-to-flat rows): straight = 6 directions through cell
    edges, diagonal = 6 directions through cell corners (e.g. (2,−1)), knight = the 12 cells at
    hex distance 3 that are on no straight line, king = the 12 straight and diagonal neighbours.
- **Rationale**: FR-004 asks for standard moves on squares and hex-chess moves on the hexagon; the
  pieces differ only in which tables they read. Unit tests check counts directly (64/160/271 cells,
  12 knight targets in the middle of the hexagon, …).
- **Alternatives**: a separate engine per board (three copies of check/mate logic); a general
  graph library (not needed).

## R2. The cross board (4 players)

- **Decision**: 14 × 14 minus the four 3 × 3 corners (160 cells). Armies on the four arms, back
  rank on the outer row, pawns on the next; Red (south) and Yellow (north) have K on the same file
  as standard chess, Blue (west) and Green (east) mirrored so each king is on its own right of the
  queen as seen from its side (the common four-player layout). Promotion on the 8th row from the
  army's own back rank (the middle line). Castling as standard along the back rank; no en passant.
- **Rationale**: the widely played four-player layout (spec Assumptions).

## R3. The hexagon board (6 players)

- **Decision**: a hexagon of side 12 (397 cells). Each army owns one side: its **back rank** is 8 cells along that side
  (R N B Q K B N R from its left, starting at q = −9 for the near army), its **pawns** 8 cells **two rows in**, on the
  same files. The other armies are the near one turned by 60° steps.
  - **Pawn moves**: one step **straight ahead** along the army's forward diagonal (two rows per step) if that cell is
    empty; **captures** on the two straight neighbours in front. No double step, no en passant. Promotes when it can
    no longer step ahead (it has reached the far edge zone). No castling on the hexagon.
- **Why side 12 and two rows in (found while building, checked with the real rules engine)**: a hex diagonal skips a
  row, so pawns one row in left every back-rank piece facing the opposite army down an open diagonal — **every king
  started in check** on the first layout (side 10). Two rows in, the pawns block those diagonals. Side 10 also put
  neighbouring armies in contact at the corners (knights could take rooks for free on move one); side 12 leaves room.
  The back-rank/pawn offsets were searched over every alignment: with the one chosen, no king starts in check and
  every capture possible on the first move can be taken back (no free piece). A unit test locks this in.
- **Known quirk**: one first move per army (its second pawn) opens the queen's diagonal onto the neighbour's king, a
  legal check that the king answers by moving. No back-rank order avoids it without creating free captures.
- **Alternatives**: side 10 (kings in check / free captures, above); Gliński-style pawn rules (made for two armies).

## R4. Rules, multi-player check and the end

- **Decision**: legal moves = pseudo-legal moves that don't leave the mover's king attacked by any
  player still in. At the start of a seat's turn: no legal move and in check → **out** (mated); no
  legal move, not in check → **skipped** (stalemate, 4/6) or **draw** (2). In 4/6, a pseudo-legal
  capture of a king is allowed (a king left exposed by others' moves) and puts its owner out. A
  player who goes out (mate, king capture, resign) loses all pieces. 2-player draws: stalemate,
  threefold repetition (position keys), 50-move rule (100 plies), insufficient material (K vs K,
  K+minor vs K). 4/6: ends when one seat is left; also after 50 full rounds with no capture or pawn
  move, or when the last two can't mate (insufficient material) — those left share the top place.
- **Rationale**: spec Edge Cases; simple to test as pure functions.

## R5. Computer players within 2 seconds

- **Decision**: material + piece-square bonus (centre, pawn advance) evaluation per seat.
  - **Easy**: random legal move, preferring captures half the time.
  - **Normal**: best 1-ply move by evaluation, minus a penalty if the moved piece lands where an
    opponent attacks it without a defender (avoids blunders cheaply).
  - **Hard**: 2 players — alpha-beta with iterative deepening inside the time budget (depth 3–4 in
    ~1 s); 4/6 players — "paranoid" depth-2 search: each own move against the strongest reply of
    the **next** player only, plus Normal's safety penalty. Always stops at `BOT_BUDGET_MS`.
  The Normal choice is also the Hint and the timeout move.
- **Rationale**: full max-n search over six 16-piece armies can't fit 2 s on an iPad (SC-003);
  limiting look-ahead to the next mover keeps Hard clearly stronger than Normal (SC-007) within
  budget. Unit tests time the worst case on the hexagon start position.
- **Alternatives**: a chess engine library (a dependency; doesn't support cross/hex boards).

## R6. Online: same as Critter Hop

- **Decision**: reuse Critter Hop's proven model: the shared lobby; `pick`/`types` for unique type
  picks; `begin` with seed and seats; the **runner orders every move** (guests send moves to it;
  everyone plays only the runner's echo, so timeouts and late moves can't both happen); `turn` with
  the 60 s clock; `sync` for rejoiners (pieces, castling rights, en-passant cell, clocks, position
  keys for repetition); drops and rejoins handled locally from relay `leave`/`join`. No relay change.
- **Shared code**: `cursor.ts` (keyboard cursor) moves from Critter Hop to `src/shared/cursor.ts`,
  used by both games (constitution II). Type names and colours are copied into Critter Chess's own
  `types.ts` (the creatures differ; importing another game's folder isn't allowed).

## R7. 3D creatures: 36 from 6 silhouettes × 6 type styles

- **Decision**: each piece kind has a silhouette built from primitives (king tall with a crown,
  queen tall with a frill, rook broad and blocky, bishop slim with a pointed cap, knight with a long
  snout and ears, pawn small and round); each type dresses it in its colours, ear/horn shape and
  move effect (as in Critter Hop). Pieces are told apart by height and silhouette, types by colour
  and ears (FR-011). Shared geometries and materials; instanced board cells; low-detail fallback
  via `src/shared/detail.ts`.
- **Rationale**: 36 hand-modelled creatures would be an art project; combining 6 × 6 parts keeps
  every piece readable at a glance and original (FR-019).

## R8. Determinism and tests

- **Decision**: `?seed=` offline fixes computer choices (as the other games). Perft-style unit tests
  on the 8 × 8 board (start position depth 1–3: 20, 400, 8902 moves; plus a castling/en-passant
  position) prove move generation (SC-002); hand-built positions test cross and hex rules. E2E
  plays real games with H + Enter at fast speed, like Critter Hop.
