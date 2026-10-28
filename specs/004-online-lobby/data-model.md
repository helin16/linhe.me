# Data Model: Online lobby for Turbo Tumble

Extends [003's data model](../003-online-relay/data-model.md). Everything stays in memory and is
dropped when the room empties (FR-012).

## Room (relay)

| Field | Type | Rules |
|---|---|---|
| `game`, `code`, `slots` | as 003 | |
| `name` | string | adjective + " " + animal from `relay/names.ts`; unique within `game` while the room exists |
| `size` | number | `MIN_ROOM_SIZE` (2) … `RELAY_ROOM_SIZE` (12); fixed at creation |
| `open` | boolean | true = waiting (listed if a slot is free, joinable); false = racing (not listed, joins refused 4423) |
| `openedAt` | ms timestamp | set at creation and on each `room-open`; clients get `openFor = now − openedAt` |

State: `open` —`room-lock` (host)→ `locked` —`room-open` (host)→ `open`. `room-close` (host) or the
last player leaving → removed. Host = lowest occupied slot (unchanged).

## Room list entry (relay → game)

`{ code, name, players, size }` for each open room with `players < size`, newest first.

## Relay limits (additions)

| Setting | Env var | Default |
|---|---|---|
| Largest room | `RELAY_ROOM_SIZE` | `12` (was 4) |
| List requests per second per address | `RELAY_LIST_RATE` | `5` (burst 5) |

`MIN_ROOM_SIZE` = 2 is a protocol constant (a room needs two players to be a room).

## Game-side state (Turbo Tumble)

- `Net` gains `name`, `size`, `open`, `deadline` (local ms, from `openFor`).
- Constants: `MAX_SLOTS` = 12 (replaces `SLOTS`), `OFFLINE_KARTS` = 4, `ROOM_SIZES` = 4…12,
  `COUNTDOWN_MS` = 60 000, `LIST_POLL_MS` = 1 000 (was 1 500: too close to the 2 s target on slow devices).
- Online popup: shown while Online is picked, the garage is open and we're not in a room
  (`OnlineState` stays `idle` → `connecting` → `in-room` | `error(message)`); back to it on leave,
  cancel or disconnect.
- New `NetText`: `Started` ("That race has already started"), `Closed` ("The host closed the
  room"), `NoRooms` ("No rooms waiting — host one!").
