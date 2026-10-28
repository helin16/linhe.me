# Implementation Plan: Online lobby for Turbo Tumble

**Branch**: `master` (no feature branch) | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-online-lobby/spec.md`

## Summary

The relay gains generic lobby features: rooms made with a size (2–12) and a relay-generated
adjective + animal name, an open/locked state with a shared "opened at" clock, host-only control
frames (lock, reopen, close), and an HTTP list of open rooms. Turbo Tumble replaces its
create/join panel with an Online popup (room list polled every 1 s, Host a room with a 4–12 size
picker), a waiting-room panel (name, n/size, 60-second countdown, Start/Cancel or Leave, code and
link), and races of up to 12 karts online (offline stays at 4). No new dependencies.

## Technical Context

**Language/Version**: TypeScript 7.0 (`strict`, `erasableSyntaxOnly`); Node 24

**Primary Dependencies**: unchanged (`ws` 8.22.0, React 19, three 0.128, Vite 8, Playwright 1.64.1)

**Storage**: none: rooms in memory only

**Testing**: `node --test` unit + relay e2e (100% functions for `relay/` and `net.ts`); Playwright
e2e for the lobby scenarios (Chromium + WebKit locally, plus Firefox in GitHub CI); `page.clock`
for the countdown (R6)

**Target Platform**: as 003

**Project Type**: web app + small server

**Performance Goals**: list changes visible ≤2 s (SC-003); countdowns within 1 s (SC-004);
≥10 kart updates/s with 12 karts (SC-008)

**Constraints**: constitution V (relay stays game-agnostic, FR-013) and VIII (sizes, countdown,
poll interval, rates as named constants or config)

**Scale/Scope**: up to 500 rooms × 12 players (caps); expected a few rooms

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. TypeScript, Vite | All changes in strict TS; no new packages | Pass |
| II. One folder per game | Game UI and 12-kart changes in `src/games/turbo-tumble/`; names, sizes, open/lock and list are relay features in `relay/` | Pass |
| III. Playable without a server | 1P/2P untouched (4 karts); unreachable relay keeps 003's message | Pass |
| IV. Keyboard and touch | Popup, list rows, size picker and buttons are real buttons/`<select>`, usable by touch and keyboard | Pass |
| V. Isolated relays | Per-game lists and names; control frames honoured only from the host; joins to racing rooms refused; no stored data; caps from config | Pass |
| VI. Simplicity | HTTP polling instead of a watch socket (R1); the kart array grows to 12 instead of being rebuilt (R5) | Pass |
| VII. Tests | Unit + relay e2e for every new relay function; `net.ts` parsing for 12 slots; Playwright for each user story | Pass |
| VIII. No hard-coded values | `RELAY_ROOM_SIZE`, `RELAY_LIST_RATE` config; `MIN_ROOM_SIZE`, `ROOMS_PATH`, new `RelayMsg`/`CloseCode` members in `protocol.ts`; `MAX_SLOTS`, `OFFLINE_KARTS`, `ROOM_SIZES`, `COUNTDOWN_MS`, `LIST_POLL_MS`, new `NetText`/`OnlineState` in the game; word lists as data | Pass |
| Hosting | No server changes beyond the relay bundle; `yarn deploy` as before | Pass |
| Workflow | `/code-review` before commit; README updated | Pass |

**Post-design re-check**: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/004-online-lobby/
├── plan.md
├── research.md                # R1–R7
├── data-model.md
├── quickstart.md
├── contracts/relay-protocol.md
├── checklists/requirements.md
└── tasks.md                   # /speckit-tasks
```

### Source Code (repository root)

```text
relay/
├── protocol.ts        # + ROOMS_PATH, MIN_ROOM_SIZE, RelayMsg.Room/Lock/Open/Close, CloseCode.Closed/Started,
│                      #   parseRelayPath (?size, rooms route), RoomInfo/Room frame types
├── names.ts           # NEW: word lists + newName(taken) (like codes.ts)
├── config.ts          # roomSize default 12; + listRate
├── rooms.ts           # + name, size, open, openedAt; host control (lock/open/close); list(game)
├── server.ts          # GET rooms route + per-address bucket; ?size; host control frames; 4410/4423
└── *.test.ts, relay.e2e.test.ts
src/games/turbo-tumble/
├── net.ts             # MAX_SLOTS, hello fields, new close messages, fetchRooms(), control helpers
├── enums.ts           # + OnlineState.Browsing, OnlineAction (Host/Start/Cancel/Leave/Pick)
├── game.ts            # popup + waiting room UI, countdown, 12 racers, field size, grid, lock/open
└── game.css           # popup, list rows, countdown
e2e/lobby.spec.ts      # NEW: host/browse/join/countdown/cancel/hand-over/started
e2e/online.spec.ts     # updated for the popup
README.md, .env.example  # RELAY_ROOM_SIZE default, RELAY_LIST_RATE
```

**Structure Decision**: same layout as 003; one new relay module (`names.ts`) and one new e2e spec.

## Complexity Tracking

No violations to justify.
