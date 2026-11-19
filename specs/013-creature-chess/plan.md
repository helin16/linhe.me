# Implementation Plan: Critter Chess

**Branch**: `master` (no feature branch) | **Date**: 2026-11-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/013-creature-chess/spec.md`

## Summary

A fifth game, `src/games/critter-chess/`: real chess for 2 (8 × 8), 4 (160-cell cross) or 6 players
(397-cell hexagon, side 12, full 16-piece armies; research R3 explains the size) on a three.js board, with original creatures —
each of the six types dressing the six piece kinds. `boards.ts` describes each board as tables
(rays, knight jumps, king steps, army cells, pawn directions, castling); `rules.ts` is one engine:
legal moves with multi-player check, castling, en passant (2 players), promotion, mate/out,
stalemate (draw or skip), repetition, 50-move and insufficient-material rules, last king standing.
`bots.ts` plays Easy/Normal/Hard inside a 2 s budget (alpha-beta for 2 players, paranoid depth-2
for 4/6). Online copies Critter Hop's proven runner-ordered model over the shared lobby; no relay
change. The keyboard cursor moves to `src/shared/` now that two games use it.

## Technical Context

**Language/Version**: TypeScript 7.0 (`strict`, `erasableSyntaxOnly`)

**Primary Dependencies**: none new — three 0.128 (installed; `OrbitControls` from its own examples),
React 19 for the route component, Web Audio

**Storage**: this device's storage for setup choices and mute; the online rejoin key during a game

**Testing**: `node --test` at 100% functions for `boards`, `rules`, `bots`, `messages`, `settings`,
`types`, `seed` and `src/shared/cursor.ts`; perft counts (R8); Playwright e2e per user story in
Chromium and WebKit iPad locally, Firefox in CI

**Target Platform**: desktop browsers, iPad and phones, as the other games

**Project Type**: web app (a new game); relay unchanged

**Performance Goals**: computer move ≤ 2 s on an iPad on the hexagon (SC-003, R5); moves on other
screens ≤ 1 s (SC-004); smooth turning with 96 pieces (SC-005)

**Constraints**: relay limits (8 KB, room ≤ 12); deterministic rules; original art and names
(FR-019); no hard-coded values (VIII); no importing Critter Hop's folder (II)

**Scale/Scope**: ≤ 6 seats, ≤ 96 pieces, ≤ 397 cells

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. TypeScript, Vite | All TS; no new packages | Pass |
| II. One folder per game | `src/games/critter-chess/`, lazy route; one games-list entry; `cursor.ts` moves to `src/shared/` (used by Critter Hop and Critter Chess); type names/colours copied, not imported from Critter Hop | Pass |
| III. Playable without a server | 1 Player and 2 Players are local; Online fails plainly | Pass |
| IV. Keyboard and touch | Mouse, keyboard cursor (shared), tap/drag/pinch; screen-reader move buttons as in Critter Hop; phone width | Pass |
| V. Isolated relays | No relay change; own messages; e2e covers room/game isolation | Pass |
| VI. Simplicity | Boards as data, one engine; bots within a budget, no library; online model reused | Pass |
| VII. Tests | Unit tests at 100% functions incl. perft; e2e per story; 3D/input only in e2e | Pass |
| VIII. No hard-coded values | Board sizes, timers, budgets, weights in `constants.ts`; enums in `enums.ts`, registered in `src/no-stray-literals.test.ts` | Pass |
| Hosting / Workflow | `yarn deploy`; `/code-review` before commit; README updated | Pass |

**Post-design re-check**: unchanged — all Pass.

## Project Structure

### Documentation (this feature)

```text
specs/013-creature-chess/
├── plan.md
├── research.md          # R1–R8
├── data-model.md
├── quickstart.md
├── contracts/messages.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/shared/cursor.ts (+ .test.ts)   # MOVED from src/games/critter-hop/ (Critter Hop imports it from here)
src/games/critter-chess/            # NEW
├── index.tsx                       # route component
├── constants.ts                    # board sizes, timers, bot budget and weights, piece values
├── enums.ts                        # CritterType, BoardKind, PieceKind, SeatKind, Difficulty, SeatState, EndWhy, ChessMsg, Screen, ResultAction, MoveSpeed
├── types.ts                        # six types: names, colours, ear/horn style, move effect
├── boards.ts                       # 8×8, cross, hexagon: cells, rays, jumps, armies, pawn data, castling
├── rules.ts                        # new game, legal moves, check, apply, outs, draws, end, ranking
├── bots.ts                         # evaluation; Easy/Normal/Hard within the budget; hint/timeout move
├── messages.ts                     # online messages: parse, who may send, type picks, seats, sync
├── settings.ts                     # saved choices
├── seed.ts                         # ?seed= offline
├── scene.ts                        # three.js boards, 36 creatures (6 silhouettes × 6 styles), rings, move animation, picking, camera
├── sound.ts                        # blips
├── game.ts                         # setup, type picker, promotion picker, turns, input, end screen, online
├── game.css
└── *.test.ts
src/games/index.ts                  # + CritterChess entry
src/no-stray-literals.test.ts       # + new enums
e2e/chess.spec.ts                   # NEW
e2e/home.spec.ts                    # + card
package.json                        # coverage list
README.md                           # the new game
```

**Structure Decision**: Critter Hop's pattern (pure tested modules + `game.ts` + `scene.ts`), which
just shipped and works; the parts both games need move to `src/shared/` only where they are truly
the same (the cursor).

## Complexity Tracking

None — no constitution exceptions.
