# Research: Critter Hop

No open questions were left in the Technical Context; these are the design decisions behind it.

## R1. Boards as data, one move engine

- **Decision**: A board is a plain table: `holes` (integer coordinates), `dirs` (direction vectors),
  `homes` (six or four lists of ten hole indices) and `opposite` (home → target). The star uses
  axial hex coordinates (6 directions); the cross uses square coordinates (8 directions). Both are
  built once by `boards.ts`; everything else (moves, bots, drawing, picking) only reads the table.
- **Rationale**: FR-002/004 say the move rules are the same on both boards; only neighbours differ.
  One generator over `dirs` covers both, and unit tests check hole counts (121 / 105) and home sizes
  (10) directly.
- **Alternatives**: a class per board (two implementations of one interface, no gain); hard-coded
  hole lists (121 + 105 literals, unreadable).

## R2. Move generation, including long and blocked hops

- **Decision**: `legalMoves(state, piece)` = single steps to empty neighbours, plus a breadth-first
  search of hop chains with a visited set (each hole reached once, so chains can't loop). From a hole,
  in each direction, scan to the first occupied hole at distance `d`:
  - mover **weak** against that creature → no hop in this direction (blocked, any `d`);
  - `d = 1` → normal hop if the hole at distance 2 exists and is empty;
  - `d > 1` and mover **strong** against it → long hop if the `d − 1` holes beyond it are empty and
    the landing hole at `2d` exists and is empty;
  - otherwise no hop.
  Each result keeps its path (for the animation and the online message). Type advantage is
  `beats[a] === b` over the ring Water → Fire → Grass → Rock → Electric → Psychic → Water.
- **Rationale**: one rule set gives exactly the highlights SC-002 tests; the path makes moves
  replayable and checkable on every device.
- **Alternatives**: precomputed hop tables (stale once pieces move); recursive DFS (same result,
  deeper stacks on 6-player boards).

## R3. Seats, homes and turn order

- **Decision**: Homes are numbered clockwise. 2 players → homes 0 and 3; 6 → 0–5; 4 (cross) → arms
  0–3 (N, E, S, W). Turn order is seat order = clockwise. Target = `opposite[home]`.
- **Win and blocking rule**: a player has finished when every hole of their target holds a creature
  and at least one of them is their own, and the rest are opponents' creatures still in their own
  home (never left). Places are given in finishing order; a finished seat is skipped.
- **Stall rule (FR-022)**: count full rounds since a creature last entered a hole of its own target
  for the first time; at 20, end and rank unfinished seats by creatures in target, then by total
  distance left (sum over creatures of board distance to the farthest free target hole).

## R4. Computer players (Easy / Normal / Hard)

- **Decision**: Score a move by how much it cuts the team's total distance to its target (board
  distance on the hex or square-with-diagonals metric), with a small bonus for moving the
  rear-most creature so none is left behind.
  - **Easy**: ignores long hops; picks randomly among the top few moves, sometimes (~1 in 4) a
    plain forward step instead.
  - **Normal**: best-scoring move, long hops included.
  - **Hard**: Normal plus a one-move look-ahead (the best follow-up for itself) and a bonus for
    moves that take away the current leader's best hop.
  The same scorer gives the Hint (US4) and the timed-out move (FR-017, Normal strength).
- **Rationale**: greedy distance play is the classic, strong-enough heuristic for this game and fits
  SC-005 (≤2 s; target ≤1 s even on an iPad) without search trees. Seeded random keeps tests exact.
- **Alternatives**: minimax over 6 players (branching too high, slow on iPad).

## R5. Online: every device checks every move; the runner speaks for computers and timeouts

- **Decision**: Reuse Tank Clash's model (spec 007 R6): the host is the *runner*. Moves are tiny
  (`piece`, `path`), and the rules are deterministic, so every device applies a move only after
  `legalMoves` confirms the path and that the sender owns the seat in turn. The runner alone sends
  moves for computer seats and timed-out turns, the turn clock, seat hand-overs and the game result.
  Type picks go through the host: guests send `pick`; the host answers with the room's full `types`
  list (first come wins), so two players can never hold the same type (FR-014).
- **Rationale**: no lockstep or full-state broadcasts needed; an illegal or forged move is dropped
  everywhere (FR-015). The relay stays a game-agnostic forwarder (constitution V).
- **Alternatives**: host-only authority with full state after each move (more traffic, slower); a
  relay-side referee (game logic in the relay breaks V).

## R6. Leaving and rejoining (uses what the relay already has)

- **Decision**: When a player drops mid-game, the runner sends `seat` making that seat a computer
  (FR-016). The relay's existing per-slot rejoin key (spec 007 `relay-rejoin.md`) and the shared
  lobby's "Rejoin" button let them come back: on rejoin the runner sends `sync` (seats, types, all
  creature positions, turn) and hands the seat back. If the runner drops, the next lowest slot takes
  over (Tank Clash's `nextRunner`).
- **Spec impact**: the spec's assumption that a disconnected player "does not reclaim their seat"
  is replaced by "can rejoin and take their seat back" — the relay and lobby already do it, and it
  is simpler than a separate watch-only mode (a locked room refuses keyless joins).
- **Relay change**: none. Room sizes 2–12 are already accepted (`RELAY_ROOM_SIZE` default 12).

## R7. Rendering with three.js 0.128 (already installed)

- **Decision**: One `scene.ts`: a low board slab with holes drawn as instanced discs, home areas
  tinted per type, lights and soft shadows; creatures built from primitives (bodies, ears, tails,
  horns per type — original designs) with the leader scaled ×1.3 and a small crown ring; per-type hop
  effects (embers, droplets, leaves, sparks, glimmer, pebbles) as short particle bursts; highlights as
  glowing rings, long hops in a stronger colour. Picking with `Raycaster` on holes and creatures.
  Camera: `OrbitControls` from `three/examples/jsm` (ships inside the existing `three` package — no
  new dependency), limited polar angle and zoom, turned to face the current local player.
  Shared `src/shared/render.ts` (`softwareGpu`, `texture`) and `src/shared/detail.ts` (low-detail
  fallback) are reused.
- **Rationale**: 60 creatures × ~10 meshes stays well within an iPad's budget with shared
  geometries/materials (SC-006); OrbitControls handles drag, pinch and wheel on every engine.
- **Alternatives**: 2D canvas (user asked for three.js / a 3D board); glTF models (asset pipeline and
  licensing for a small site); hand-written orbit (re-implements what ships in the package).

## R8. Keyboard play (FR-019)

- **Decision**: A pure `cursor.ts`: given screen positions of candidate holes, Arrow keys move to the
  nearest candidate in that direction (angle within 60°, then distance). Phase 1 candidates = own
  movable creatures; after Enter, candidates = highlighted holes. Escape goes back. Q/E turn the
  board, +/− zoom. The cursor hole has a visible ring and its name is read out via an `aria-live`
  status line ("Fire creature, row 3 → 2 places to go").
- **Rationale**: works the same on star and cross, testable without a browser.

## R9. Determinism for tests

- **Decision**: As Tank Clash: `?seed=<n>` (offline only) fixes the computer players' choices and the
  free type handed out, so e2e games replay exactly. Rule positions (long hop, blocked hop) are unit
  tested; e2e reaches one long-hop position by playing a fixed opening on a seeded 2-player game.
  `root.dataset.ready`/`data-turn` mark state for the browser tests, as in the other games.
- **Each game keeps its own `seed.ts`**: Snake Duel and Tank Clash each have one; moving it to
  `src/shared/` would touch both other games and is out of scope (noted for a later tidy-up).

## R10. What is saved on this device

- **Decision**: last type picked, player count, seat kinds (local), computer strength, local turn
  timer on/off, mute; the online rejoin key until the game ends. Field-by-field fallback like the
  other games' `settings.ts`. Sound: short Web Audio blips (select, hop, win) with a mute toggle,
  generated, not files — kept minimal since the spec doesn't ask for sound.
