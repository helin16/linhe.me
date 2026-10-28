# Implementation Plan: Online multiplayer for Turbo Tumble

**Branch**: `master` (no feature branch) | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-online-relay/spec.md`

## Summary

A small, game-agnostic Node + TypeScript WebSocket relay (`relay/`, one dependency: `ws`) holds rooms
in memory, keyed by game and a 4-character code, forwards each player's JSON messages to the rest of
the room with the sender's slot stamped on, and enforces size, rate, address, room and total limits
from configuration. It runs on the VPS as a hardened `systemd` service behind Caddy at `/relay/*`.
Turbo Tumble swaps its old EventSource/POST code for a thin WebSocket wrapper and gains an online
panel (create room, join with code or link, copy link); its race logic and message kinds stay as
they are. Unit and relay end-to-end tests run under `node --test` with 100% function coverage for the
relay code. `yarn deploy` ships and checks the relay along with the site.

## Technical Context

**Language/Version**: TypeScript 7.0 (`strict`, `erasableSyntaxOnly`); Node 24 on the server (Ubuntu
package), Node 24+ locally

**Primary Dependencies**: `ws` 8.22.0 (+ `@types/ws` 8.18.2 dev); `@playwright/test` 1.64.1 (dev, browser e2e); existing React 19, three 0.128, Vite 8

**Storage**: none: rooms in memory only

**Testing**: `node --test` unit + relay end-to-end with built-in coverage (100% functions for
`relay/` and `src/games/turbo-tumble/net.ts`); Playwright browser e2e (`yarn e2e`) in Chromium, WebKit
(iPad, touch) and Firefox for this feature's acceptance scenarios. Firefox can't start on the owner's Mac (macOS 27), so all three run in
GitHub Actions (`.github/workflows/ci.yml`); `yarn deploy` runs Chromium + WebKit locally and requires CI
to have passed for the commit

**Target Platform**: relay on Linux (systemd, localhost port behind Caddy and Cloudflare); clients in
supported browsers (feature 001)

**Project Type**: web app + small server

**Performance Goals**: ≥15 kart updates/s per player (SC-004; the game sends ~20/s); relay well under
1% CPU for a handful of rooms on the 1 vCPU VPS

**Constraints**: constitution V (isolation, WSS, room codes, caps, no stored data, configurable
address); VIII (limits and paths from config); relay restarts within 10 s

**Scale/Scope**: up to 500 rooms × 4 players (cap); expected a few rooms at a time

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. TypeScript, Vite | Relay and client in strict TS; relay bundled to one ESM file at deploy (build output); `ws` locked by `yarn.lock` | Pass |
| II. One folder per game | Game client code stays in `src/games/turbo-tumble/`; the protocol lives in `relay/protocol.ts`, owned by the relay and imported by the game (no one-game module in `src/shared/`) | Pass |
| III. Playable without a server | Offline modes untouched; clear messages for unreachable/dropped relay (FR-008) | Pass |
| IV. Keyboard and touch | Online panel uses the garage's existing buttons and a text input; works by touch | Pass |
| V. Isolated relays | Node + TS over WebSockets at `/relay/<game>/<room>`; per-room/per-game isolation with e2e tests; WSS via Cloudflare/Caddy; room codes; size/room caps; no stored data; configurable address, same origin by default; own systemd service | Pass |
| VI. Simplicity | One dependency (`ws`, reason in R1); in-memory maps; no framework | Pass |
| VII. Tests | Unit + relay e2e with 100% function coverage for relay code and `net.ts`; Playwright e2e for this feature's scenarios in all three engines; the whole-site suite for 001/002 pages stays under its earlier waiver | Pass |
| VIII. No hard-coded values | Limits/port from env with defaults in one config module; service file generated from config with `ExecStart=node …` (no binary path); `ROOM_QUERY`, `OnlineState`, `OnlineAction`, `RelayMsg`, close codes as enums/constants registered in the stray-literal check | Pass |
| Hosting | Relay as its own `systemd` service, restart on failure; deploy repeatable via `yarn deploy` with a relay check; README documents one-time setup by role | Pass |
| Workflow | `/code-review` before commit; README updated | Pass |

**Post-design re-check**: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/003-online-relay/
├── plan.md
├── research.md             # R1–R10
├── data-model.md           # rooms, clients, limits, game-side state
├── quickstart.md
├── contracts/relay-protocol.md
├── checklists/requirements.md
└── tasks.md                # /speckit-tasks
```

### Source Code (repository root)

```text
relay/
├── protocol.ts             # frame types, close codes, URL builder (relay + game)
├── config.ts               # limits and port from env, with defaults
├── codes.ts                # room code generation and normalising
├── rooms.ts                # rooms/slots/join/leave/broadcast (pure, no sockets)
├── limits.ts               # token bucket, per-address counter
├── server.ts               # node:http + ws wiring, pings, logging
├── *.test.ts               # unit tests for the pure modules
└── relay.e2e.test.ts       # real relay + real WebSocket clients
src/
└── games/turbo-tumble/
    ├── net.ts              # NEW: WebSocket wrapper, close code → message
    ├── net.test.ts
    ├── enums.ts            # + OnlineState
    └── game.ts             # online panel, join link, swaps EventSource/fetch for net.ts
vite.config.ts              # dev proxy /relay → local relay
vite.relay.config.ts        # NEW: bundles relay/server.ts → dist-relay/relay.mjs
playwright.config.ts        # NEW: e2e projects (chromium, firefox, webkit-ipad), relay + preview servers
e2e/online.spec.ts          # NEW: two-browser create/join/race/leave/host hand-off
e2e/online-down.spec.ts     # NEW: relay unreachable, unknown code
scripts/deploy.ts           # + relay build/upload, systemd unit from config, restart, relay check
.env.example                # + DEPLOY_RELAY_DIR, RELAY_* (placeholders)
README.md                   # online play, relay run/deploy, one-time server setup by role
package.json                # + ws, @types/ws; scripts: relay, test (with coverage threshold)
```

**Structure Decision**: the relay is a top-level `relay/` folder (server code, never served) beside
`src/` (site); the protocol is owned by the relay (`relay/protocol.ts`) and imported by the game.

## Complexity Tracking

No violations to justify (the owner chose to add Playwright browser tests in this feature).
