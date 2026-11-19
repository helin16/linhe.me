# Tasks: Critter Chess

**Input**: Design documents from `/specs/013-creature-chess/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/messages.md, quickstart.md

**Tests**: required by the constitution (VII): unit tests at 100% function coverage for
`critter-chess/{boards,types,rules,bots,messages,settings,seed}.ts` and `src/shared/cursor.ts`,
perft counts for move generation (research R8), Playwright e2e for every acceptance scenario in
Chromium and WebKit iPad (Firefox in CI) with no console errors. No test-only code ships: browser
tests use `?seed=`, H + Enter and Fast speed, as Critter Hop's do. Write each test first.

Reuse Critter Hop's proven code shapes (copy within the new folder; never import from
`src/games/critter-hop/`): `seed.ts`, `settings.ts` pattern, `sound.ts`, the online runner model in
`game.ts`, the scene's camera/picking/rings, the screen-reader move buttons.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallel (different files, no unfinished dependency)
- **[Story]**: US1 solo vs computer, US2 2/4/6 on one device, US3 online, US4 hints and move list

---

## Phase 1: Setup

- [X] T001 Add `GameSlug.CritterChess = 'critter-chess'` and its entry in `src/games/index.ts` (name "Critter Chess", summary "Chess for 2, 4 or 6 with creature armies.", description naming 2-player, 4-player cross and 6-player hexagon chess, six creature types (looks only), local and online, `homeTag: '2, 4 or 6 players · Online · iPad ready'`, `tag: 'Mouse, keyboard or touch · 2, 4 or 6 players · online up to 6'`, `art: '♞'`, lazy `load`); create `src/games/critter-chess/index.tsx` like Critter Hop's (title "Critter Chess") with stub `game.ts`/`game.css`
- [X] T002 [P] Move `src/games/critter-hop/cursor.ts` and `cursor.test.ts` to `src/shared/cursor.ts`/`cursor.test.ts`; update Critter Hop's import; in `package.json` replace `cursor` in Critter Hop's coverage glob with `--test-coverage-include='src/shared/cursor.ts'` and add `--test-coverage-include='src/games/critter-chess/{boards,types,rules,bots,messages,settings,seed}.ts'`; run `yarn test` and `e2e/critter.spec.ts` to confirm Critter Hop is unchanged

---

## Phase 2: Foundational (blocking)

- [X] T003 Create `src/games/critter-chess/enums.ts` (const objects + union types; data-model.md): `CritterType`, `BoardKind` Square/Cross/Hex, `PieceKind` King/Queen/Rook/Bishop/Knight/Pawn ("sent online"), `SeatKind`, `Difficulty`, `SeatState` Playing/Out, `EndWhy` Mate/Draw/LastStanding/NoProgress, `ChessMsg` pick/types/begin/turn/move/sync, `Screen`, `ResultAction`, `MoveSpeed`, ear and effect enums; choose string values that don't collide with other games' enum values or written-out strings; register all in `src/no-stray-literals.test.ts` (aliases for names other games also export)
- [X] T004 [P] Create `src/games/critter-chess/constants.ts`: `SQUARE = 8`, `CROSS_SIZE = 14`, `CROSS_CORNER = 3`, `HEX_SIDE = 12` (built as 10; changed to 12, research R3), `PLAYER_COUNTS = [2, 4, 6]`, `TURN_MS = 60_000`, `COUNTDOWN_MS = 60_000`, `ROOM_SIZES = [2, 4, 6]`, `DEFAULT_ROOM_SIZE = 2`, `BOT_BUDGET_MS = 1500` (under the 2 s of SC-003), `BOT_DELAY_MS`, piece values (P 1, N 3, B 3, R 5, Q 9), `NO_PROGRESS_PLIES = 100` (2 players), `NO_PROGRESS_ROUNDS = 50` (4/6), `REPEAT = 3`, `MAX_SEED`, `FLASH_MS`, `TAP_PX`, `SPOTS_S`, `REJOIN_MS`, `PENDING_MS`, `MOVE_MS`, `FAST_FACTOR`, `SEED_QUERY = 'seed'`
- [X] T005 [P] Write `types.test.ts`, then `src/games/critter-chess/types.ts`: the six types' names, colours, accents, ear style and move effect (same names/colours as Critter Hop, copied); tests: six distinct colours, effects and ear styles
- [X] T006 [P] Copy Critter Hop's `seed.ts`/`seed.test.ts` into `src/games/critter-chess/` (comments adjusted)
- [X] T007 Write `boards.test.ts`, then `src/games/critter-chess/boards.ts` (research R1–R3): `square()` 64 cells, 2 armies (standard start; pawn step forward, double step from the start row, captures on the forward diagonals, promotion on the far rank, castling cells); `cross()` 14 × 14 minus four 3 × 3 corners = 160 cells, 4 armies clockwise from south (R2: back rank R N B Q K B N R / mirrored for west/east per the common layout, promotion on the 8th row from the army's back rank, castling); `hex()` side 12 axial hexagon = 397 cells, 6 armies (R3, as built: back rank on 8 cells of the army's side, pawns two rows in on the same files — the first plan (side 10, pawns one row in) left every king in check at the start, pawn step = forward diagonal toward the far side, captures = the two forward straight neighbours, no double step, promotion when the step leaves the board, no castling); per cell `straight`/`diagonal` rays, `knight` and `king` targets; tests: cell counts 64/160/397; armies of 16 on distinct cells; start positions match; a middle hex cell has 6 straight + 6 diagonal rays, 12 knight targets (hex distance 3, on no straight line) and 12 king steps; a centre square has 8 knight targets
- [X] T008 Write `rules.test.ts`, then `src/games/critter-chess/rules.ts` core (research R4, data-model Game): `newGame(seatSpecs)` (board by seat count), `legalMoves(game, seat)` and `movesFrom(game, cell)` (pseudo-legal then filtered: own king not attacked by any seat still in), `attacked(game, cell, bySeats)`, `inCheck`, `applyMove` (captures, castling (king two steps toward the rook, rook jumps over; not out of, through or into check), en passant (2 players), promotion (person's choice; default queen), `moved`, `epCell`, `quiet`, repetition `keys`), start-of-turn handling (no moves + check → seat Out, pieces removed; no moves + no check → 2 players draw, 4/6 skip), king capture in 4/6 → owner Out, resign → Out, end rules (mate, last standing, stalemate/repetition/50-move/insufficient material in 2 players; 50 rounds without capture or pawn move and insufficient material between the last two in 4/6 → shared top place), `order` with shared places; tests: **perft** from the standard start depth 1/2/3 = 20/400/8902 and a known castling/en-passant/promotion position (e.g. "Kiwipete" depth 1 = 48, depth 2 = 2039); Fool's mate ends 2-player; stalemate draw; threefold repetition; insufficient material; castling refused through check; cross and hex: pawn moves/captures/promotion, a mated seat goes out and its pieces vanish, a stalemated seat is skipped, a king captured in 4-player puts its owner out, last king standing wins
- [X] T009 Write `bots.test.ts`, then `src/games/critter-chess/bots.ts` (research R5): evaluation (material + small centre/pawn-advance bonus per seat); Easy (random legal move, captures preferred half the time), Normal (best 1-ply minus a penalty when the moved piece is attacked and undefended), Hard (2 players: alpha-beta, iterative deepening; 4/6: depth-2 paranoid against the next seat only), all stopping at `BOT_BUDGET_MS`; `hint(game)` = Normal; tests: always legal, seeded results repeat, Hard finds mate-in-one, Normal never hangs its queen when a safe move exists, Normal beats Easy and Hard beats Normal in most seeded 2-player games, every level moves within `BOT_BUDGET_MS` on the 6-player hexagon start
- [X] T010 [P] Write `settings.test.ts`, then `src/games/critter-chess/settings.ts` (key `cc-cfg`): `{ players (2|4|6, default 2), types[6] (unique), seats: SeatKind[6] (seat 1 always Person), difficulty (default Normal), speed (default normal), muted }`, field-by-field fallback

**Checkpoint**: `yarn test` at 100% functions, perft passing.

---

## Phase 3: User Story 1 — Play chess against the computer (P1) 🎯 MVP

**Goal**: 1 Player on all three boards: type pick, legal-move highlights, check, promotion choice, mate/draw/out, resign, keyboard/mouse/touch.

**Independent Test**: 1 Player, 2 players, Water: standard position; select a pawn: its two squares light up; move; the computer replies.

- [X] T011 [P] [US1] Write `e2e/chess.spec.ts` US1 cases (spec US1 scenarios 1–11): setup and type picker (six creatures per type shown, taken types disabled), boards by count (`data-board` square/cross/hex, 32/64/96 pieces via the piece list), highlights (move vs capture labels on the move buttons), a move then the computer's reply, Check shown, promotion picker (seeded game or Fast H+Enter until a promotion, or a 2 Players line of moves), a full 2-player game to the end screen with H + Enter at Fast speed, Resign, keyboard-only play, touch tap, phone width, no console errors
- [X] T012 [US1] Create `src/games/critter-chess/scene.ts` (research R7): board meshes for square/cross/hex (light and dark cells; hex cells in three shades), 36 creatures from 6 silhouettes × 6 type styles with shared geometries/materials, rings for selection/moves/captures/last move/cursor/hint/check, move animation (slide; knight hops) with the type's effect, capture effect, picking by tap, OrbitControls camera with `faceSeat`, `project`, low-detail fallback, `forceContextLoss` on dispose
- [X] T013 [P] [US1] Create `src/games/critter-chess/sound.ts` (move, capture, check, win), as Critter Hop's
- [X] T014 [US1] Implement `src/games/critter-chess/game.ts` for 1 Player: shared `PlayerMode`; setup (players 2/4/6, strength, type picker with each type's six creatures, speed); computer seats get other types (seeded); play screen: turn banner, Check banner, seat list (in/out, place), move buttons for screen readers with `data-x/y`, select/highlight/move by mouse, touch (single-finger taps only) and keyboard (`src/shared/cursor.ts`, Enter, Escape, Q/E, +/−; modifier keys ignored), promotion picker (Queen/Rook/Bishop/Knight), Resign, computer turns within the budget, end screen (result, why, order, Play again/Menu); `data-ready`, `data-board`, `data-turn`
- [X] T015 [P] [US1] Write `src/games/critter-chess/game.css` (scoped `.cc`, like Critter Hop's)

**Checkpoint**: US1 e2e green in Chromium and WebKit iPad.

---

## Phase 4: User Story 2 — 2, 4 or 6 on one device (P1)

- [X] T016 [P] [US2] Add US2 cases to `e2e/chess.spec.ts`: 2 Players with 4 seats (seat 1 always Person, kinds toggled, each person a different type), the board faces each person, computers play themselves, a player going out (resign) and the game continuing to the last one left
- [X] T017 [US2] Extend `src/games/critter-chess/game.ts`: local setup with seat rows (Person/Computer, per-seat type), `faceSeat` for each person's turn, banners naming players

---

## Phase 5: User Story 3 — Online (P2)

- [X] T018 [P] [US3] Write `messages.test.ts`, then `src/games/critter-chess/messages.ts` (contracts/messages.md): parse/validate `pick`, `types`, `begin`, `turn`, `move` (`from`/`to` within the board, `promo` only Queen/Rook/Bishop/Knight), `sync` ("≤ 96 pieces", seats 2/4/6 with unique types, cells within the board, keys ≤ 100); `allowedFrom`; `nextRunner`; `takeType`/`freeType`/`roomSeats`; `syncMsg`/`fromSync` round trip
- [X] T019 [P] [US3] Add US3 cases to `e2e/chess.spec.ts`: host 4-player room, unique type picks seen within 1 s, Start fills computers, A's move on B's screen within 1 s, B can't move out of turn, a dropped player becomes a computer, another room unaffected, relay down → plain message and offline works
- [X] T020 [US3] Wire online in `src/games/critter-chess/game.ts` with `createLobby` exactly as Critter Hop does (runner-ordered moves, pending unlock after `PENDING_MS`, 60 s turn clock with a Normal move on timeout, drops/rejoins from relay frames, `sync` to rejoiners with clamped time left, new runner restarts the turn in progress)

---

## Phase 6: User Story 4 — Hints and move list (P3)

- [X] T021 [P] [US4] Add US4 cases to `e2e/chess.spec.ts`: Hint shows without moving; Enter plays it; the move list shows the last moves by player; the last move is marked
- [X] T022 [US4] In `src/games/critter-chess/game.ts`/`scene.ts`: Hint button and H key, Enter plays the hint; a move list (last 10 moves, e.g. "Water: Knight to …") and a last-move ring

---

## Phase 7: Polish

- [X] T023 [P] Add the Critter Chess card test to `e2e/home.spec.ts`; README section (rules per board, controls, online)
- [X] T024 Run `yarn build`, `yarn test`, `yarn e2e:local`; fix failures
- [X] T025 Run `/code-review`; fix or waive each finding in the commit message; re-review fixes
- [ ] T026 Play once by hand on a real iPad (quickstart rows 1–8), especially the 6-player hexagon for frame rate and computer move time

## Dependencies

Setup → Foundational (T003 first; T007 → T008 → T009) → US1 → US2 → US3 → US4 → Polish. US3 needs only the rules and messages but edits `game.ts` after US2.

## Parallel examples

- After T003: T004, T005, T006, T010 together.
- US1: T011, T013, T015 together; T012 → T014.
- US3: T018 and T019 together, then T020.

## Implementation strategy

1. **MVP = Phases 1–3**: 1 Player chess on all three boards, deployable.
2. Then local multi-seat (US2), online (US3), hints (US4).
3. Highest risk first inside the MVP: perft-correct rules (T008) and the hexagon bot budget (T009).
