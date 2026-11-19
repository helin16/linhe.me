# Implementation Plan: Critter Hop

**Branch**: `master` (no feature branch) | **Date**: 2026-11-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/012-creature-checkers/spec.md`

## Summary

A fourth game in its own folder, `src/games/critter-hop/`: star checkers for 2, 4 or 6 players on
a 3D three.js board, with original elemental creatures. `boards.ts` builds the 121-hole star
(6 directions) and the 105-hole cross (8 directions) as plain tables; `rules.ts` is one move engine
for both — steps, hop chains, and the type ring's long hops and blocked hops — plus turns, finishing,
the blocking rule and the 20-round stall end. `bots.ts` plays Easy/Normal/Hard with a greedy
distance score (also used for Hint and timeouts). Online reuses the shared lobby and the relay
unchanged: every device checks every move, the runner (host) speaks for computer seats, timeouts,
drops and rejoins (Tank Clash's model).

## Technical Context

**Language/Version**: TypeScript 7.0 (`strict`, `erasableSyntaxOnly`)

**Primary Dependencies**: none new — three 0.128 (already installed; `OrbitControls` from its own
`examples/jsm`), React 19 for the route component, Web Audio for blips

**Storage**: this device's storage for type, player count, seat kinds, strength, local timer, mute;
the online rejoin key until the game ends; nothing on a server

**Testing**: `node --test` at 100% functions for `boards`, `types`, `rules`, `bots`, `cursor`,
`messages`, `settings`, `seed`; Playwright e2e for US1–US4, keyboard and touch, relay down, two
clients in one room not leaking to another room or game (Chromium, WebKit iPad, Firefox)

**Target Platform**: desktop browsers, iPad and phones (Safari included), as the other games

**Project Type**: web app (a new game); relay unchanged

**Performance Goals**: smooth turning with 60 creatures on an iPad (SC-006, 60 fps target, low
detail fallback via `shared/detail.ts`); computer move ≤1 s typical, ≤2 s worst (SC-005); move on
other screens ≤1 s (SC-004)

**Constraints**: relay limits (8 KB, 40 msg/s, room ≤12 — rooms here are 2/4/6); deterministic rules
(integers only); original creatures, no Pokémon content (FR-020); no hard-coded values (VIII)

**Scale/Scope**: ≤6 seats, 60 creatures, one move per turn

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. TypeScript, Vite | All TS; no new packages (`OrbitControls` ships in `three`) | Pass |
| II. One folder per game | `src/games/critter-hop/`, lazy-loaded at `/games/critter-hop/`; one games-list entry; uses `src/shared/online/`, `shared/render.ts`, `shared/detail.ts`, `shared/modes.ts` unchanged; imports no other game | Pass |
| III. Playable without a server | 1 Player and local games are fully local; Online shows the shared "isn't available" message (FR-018) | Pass |
| IV. Keyboard and touch | Mouse, keyboard-only cursor (R8), tap/drag/pinch; fits phone width; type shown by name and creature, not colour alone | Pass |
| V. Isolated relays | No relay change; game messages are this game's own; e2e covers room and game isolation | Pass |
| VI. Simplicity | Boards as data, one move engine, greedy bots, every-device move checks (no state broadcasts) | Pass |
| VII. Tests | 100% functions for the pure modules; e2e per story; three.js/input only in e2e | Pass |
| VIII. No hard-coded values | Board sizes, timers (60 s turn, 20-round stall, countdown), sizes [2,4,6], bot weights in `constants.ts`; enums in `enums.ts`, registered in `src/no-stray-literals.test.ts` | Pass |
| Hosting | Static build only; `yarn deploy` as usual | Pass |
| Workflow | `/code-review` before commit; README gains the game and controls | Pass |

**Post-design re-check**: unchanged after data model and contracts — all Pass.

## Project Structure

### Documentation (this feature)

```text
specs/012-creature-checkers/
├── plan.md
├── research.md          # R1–R10
├── data-model.md
├── quickstart.md
├── contracts/messages.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/games/critter-hop/             # NEW
├── index.tsx                      # route component (like tank-clash/index.tsx)
├── constants.ts                   # board sizes, timers, room sizes, countdown, bot weights, camera limits
├── enums.ts                       # CritterType, BoardKind, SeatKind, Difficulty, HopKind, GameState, HopMsg, Screen, ResultAction
├── types.ts                       # advantage ring (BEATS), strong/weak, per-type colour, name, look parts
├── boards.ts                      # star and cross tables: holes, dirs, homes, opposite, distance
├── rules.ts                       # new game, legalMoves (steps, hops, long/blocked hops), apply, finish, blocking, stall, turn order
├── bots.ts                        # Easy/Normal/Hard, hint, timeout move
├── cursor.ts                      # keyboard cursor: nearest candidate in an arrow direction
├── messages.ts                    # parse/validate online messages; who may send what; begin/sync rows
├── settings.ts                    # saved choices, field-by-field fallback
├── seed.ts                        # seeded random; ?seed= offline only
├── scene.ts                       # three.js board, creatures, leader, highlights, hop effects, picking, camera
├── sound.ts                       # Web Audio blips, mute
├── game.ts                        # mount(): setup screens, type picker, turns, input, loop, online runner/guest, rejoin
├── game.css
└── *.test.ts
src/games/index.ts                 # + CritterHop entry (slug, text, art)
src/no-stray-literals.test.ts      # + the new enums
e2e/critter.spec.ts                # NEW: US1–US4, keyboard, touch, online, rejoin, relay down, isolation
e2e/home.spec.ts                   # + Critter Hop card
package.json                       # coverage include list gains the new modules
README.md                          # the new game and its controls
```

**Structure Decision**: same pattern as Tank Clash — pure, unit-tested modules plus one `game.ts`
wiring DOM, input and the loop, and one `scene.ts` for three.js. Boards are their own module because
rules, bots, cursor and scene all read them.

## Complexity Tracking

None — no constitution exceptions.
