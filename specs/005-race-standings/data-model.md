# Data Model: Live standings and room roster

Nothing is stored or sent; both are views of state the game already has.

## Standing row (`standings.ts`)

| Field | Type | From |
|---|---|---|
| `place` | number (1…N) | index in `ranked()` + 1 |
| `name` | string | kart name ("Player N" when blank, as today) |
| `color` | `#rrggbb` | kart body colour |
| `local` | boolean | a human on this device (P1, and P2 in 2P) |
| `time` | string or null | finish time (`m:ss.cc`) when finished |

`standingRows(order, compact)`: all rows when `compact` is false; when true, places 1–3 plus any
`local` row outside them, in order.

## Roster row (`standings.ts`)

| Field | Type | From |
|---|---|---|
| `slot` | number | shown as `P{slot+1}` |
| `name` | string | profile name, or "Player N" |
| `color` | `#rrggbb` | profile kart colour, or a neutral grey until the profile arrives |
| `host` | boolean | lowest occupied slot |
| `you` | boolean | our slot |

`rosterRows(me, peers, profiles, ownLook)` returns rows by slot; `computerKarts(size, players)` =
`size − players`.

## Constants

`COMPACT_MEDIA` (phone test), `COMPACT_TOP` = 3, `UNKNOWN_COLOR` (neutral grey).
