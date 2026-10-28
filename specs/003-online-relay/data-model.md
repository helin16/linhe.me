# Data Model: Online multiplayer for Turbo Tumble

All relay state is in memory and disappears when a room empties or the relay restarts.

## Room

| Field | Type | Rules |
|---|---|---|
| `game` | string | `^[a-z0-9-]{1,32}$` (from the address) |
| `code` | string | 4 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`; unique within `game` |
| `slots` | `Map<number, Client>` | slot numbers 0–3 (shown as P1–P4); at most `ROOM_SIZE` (4) |

- Created only by a `new` connection; a join to an unknown code is refused (close 4404).
- A joiner takes the lowest free slot; a full room refuses (close 4409).
- Host = lowest occupied slot (computed by clients from `slot` + `peers`, as before).
- Removed the moment its last client leaves; its code becomes free.

## Client (connection)

| Field | Type | Rules |
|---|---|---|
| `slot` | number | 0–3 within its room |
| `address` | string | from `CF-Connecting-IP` or the socket; used only for the per-address limit, never logged |
| `bucket` | tokens | refills at `RATE` (40/s), burst 40; a message with no token closes 4429 |
| `alive` | boolean | reset by each pong; two missed pings close the connection |

## Relay limits (configuration, constitution VIII)

| Setting | Env var | Default |
|---|---|---|
| Listen port (localhost) | `RELAY_PORT` | `8787` |
| Players per room | `RELAY_ROOM_SIZE` | `4` |
| Max message bytes | `RELAY_MAX_MESSAGE` | `8192` |
| Messages per second per client | `RELAY_RATE` | `40` |
| Connections per address | `RELAY_PER_ADDRESS` | `8` |
| Rooms in total | `RELAY_MAX_ROOMS` | `500` |
| Ping interval (ms) | `RELAY_PING_MS` | `30000` |
| Count log interval (ms) | `RELAY_LOG_MS` | `60000` |
| Send buffer per peer before dropping it (bytes) | `RELAY_MAX_BUFFER` | `65536` |

## Game-side state (Turbo Tumble)

- `Net` (unchanged shape): `{slot, peers: Set<number>, profiles: Record<slot, PlayerLook>, code}`;
  `code` is new, for the room display and join link.
- Join link: `gameRoute(GameSlug.TurboTumble)` + `?room=<CODE>` (query key constant `ROOM_QUERY`).
- Online panel states: `idle` → `connecting` → `in-room` | `error(message)`; back to `idle` on
  leave or disconnect (new enum `OnlineState` in `enums.ts`).
