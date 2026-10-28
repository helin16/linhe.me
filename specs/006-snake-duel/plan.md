# Implementation Plan: Snake Duel

**Branch**: `master` (no feature branch) | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-snake-duel/spec.md`

## Summary

A second game in its own folder, `src/games/snake-duel/`: an original arena-snake game drawn on a 2D
canvas. A pure simulation module (`sim.ts`, fixed 60 Hz step) moves snakes along smooth paths,
handles orbs, boost, take-outs and the two match types (Deathmatch: rounds, first to 3, no time
limit; Quick match: one 5-minute game with rejoins, longest wins); 1 Player is one endless game
with a best length. `bots.ts` drives the computer snakes that fill the arena to 20, at Easy, Normal
or Hard. A garage like Turbo Tumble's customises each snake (name, two colours, pattern, eyes) and
picks the match type and difficulty for local play; online the host picks them in the waiting room.
1 Player and 2 Players (split screen) run the simulation locally. Online, one device (the runner,
first the host) runs it for everyone and sends snapshots ~20/s while the others send their
steering; the runner hands over if its tab is hidden or it leaves; the relay is unchanged.
The online lobby (popup, room list, waiting room, countdown, roster) moves from Turbo Tumble into
`src/shared/online/` so both games use the very same lobby (constitution II).

## Technical Context

**Language/Version**: TypeScript 7.0 (`strict`, `erasableSyntaxOnly`)

**Primary Dependencies**: none new (React 19 for the route component; 2D canvas is native)

**Storage**: this device's storage for the garage looks, best length and mute; nothing on a server

**Testing**: `node --test` unit tests with 100% function coverage for `sim.ts`, `bots.ts`,
`messages.ts`, `settings.ts` and `src/shared/online/*` logic; Playwright e2e for every user story
(Chromium + WebKit locally, Firefox in CI); Turbo Tumble's existing e2e guards the lobby move

**Target Platform**: as Turbo Tumble (desktop browsers, iPad and phones by touch)

**Project Type**: web app (a second game) + the existing relay

**Performance Goals**: 60 fps with 20 snakes and ~400 orbs on supported devices (SC-002); online
view ≤0.5 s behind (SC-004); snapshots ≈1 KB, 20/s

**Constraints**: relay limits (8 KB per message, 40 messages/s per client, room size ≤ 12);
original art and name (FR-015); no hard-coded values (VIII); Quick match timers within 1 s across
players (SC-003)

**Scale/Scope**: rooms of 2–8 players; 20 snakes per arena

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. TypeScript, Vite | All TS; no new packages | Pass |
| II. One folder per game | Game in `src/games/snake-duel/`, lazy-loaded at `/games/snake-duel/`; one games-list entry; the lobby both games use moves to `src/shared/online/` (now used by two games); no game imports the other | Pass |
| III. Playable without a server | 1P and 2P run locally; Online fails cleanly within 5 s (FR-013) | Pass |
| IV. Keyboard and touch | Mouse, keys and per-player touch stick + boost; fits phones in both orientations | Pass |
| V. Isolated relays | Uses the generic relay as is; rooms per game slug; messages validated and limited by sender (host-only messages) | Pass |
| VI. Simplicity | 2D canvas; host-authoritative snapshots instead of lockstep or prediction (noted upgrade path) | Pass |
| VII. Tests | Unit tests at 100% functions for all pure modules; e2e for all five user stories; relay unchanged | Pass |
| VIII. No hard-coded values | Arena, speeds, counts, rates, room sizes, round wins, quick-match length, rejoin time, per-difficulty numbers in one constants module; enums for pattern, eyes, modes, match type, difficulty, message types, match state, registered in the stray-literal check | Pass |
| Hosting | No server change; `yarn deploy` ships it | Pass |
| Workflow | `/code-review` before commit; README updated | Pass |

**Post-design re-check**: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/006-snake-duel/
├── plan.md
├── research.md              # R1–R8
├── data-model.md
├── quickstart.md
├── contracts/messages.md    # online game messages
├── checklists/requirements.md
└── tasks.md                 # /speckit-tasks
```

### Source Code (repository root)

```text
src/shared/online/                 # NEW: the lobby both games use (moved from turbo-tumble)
├── client.ts                      # connect, close messages, fetchRooms, joinLink/roomFromUrl(slug), countdown clock
├── roster.ts                      # rosterRows, playerName, computerSpots
├── lobby.ts                       # Online popup + waiting room DOM (list, host, join, roster, countdown, Start/Cancel/Leave, Copy link)
├── lobby.css
└── *.test.ts
src/games/turbo-tumble/            # switches to src/shared/online; no visible change
src/games/snake-duel/              # NEW
├── index.tsx                      # route component (like turbo-tumble/index.tsx)
├── constants.ts                   # arena, speeds, counts, rates, sizes
├── enums.ts                       # SnakePattern, SnakeEyes, Mode, MatchType, Difficulty, MsgType, MatchState
├── settings.ts                    # looks, difficulty, match type, best length, mute; fixLook
├── seed.ts                        # seeded random source, ?seed= / ?bots=0 (offline only; research R9)
├── sim.ts                         # arena, snakes, orbs, boost, take-outs; Deathmatch rounds, Quick match timer/rejoins, 1P endless
├── bots.ts                        # computer snakes at Easy / Normal / Hard
├── messages.ts                    # parse/validate online messages, who may send what
├── draw.ts                        # canvas drawing (snakes with patterns/eyes, orbs, minimap, views)
├── game.ts                        # mount(): modes, input, garage (looks, match type, difficulty), loop, online host/guest
├── game.css
└── *.test.ts
src/games/index.ts                 # + SnakeDuel entry (slug, text, art)
e2e/snake.spec.ts                  # NEW: 1P, garage, 2P, online, relay down
e2e/home.spec.ts                   # + Snake Duel card
README.md                          # the new game, controls, online
```

**Structure Decision**: same pattern as Turbo Tumble (pure, tested modules + one `game.ts` that
wires DOM, input and the loop). The lobby becomes shared because two games now use it.

## Complexity Tracking

No violations to justify.
