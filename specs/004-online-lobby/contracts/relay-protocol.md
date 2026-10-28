# Contract: relay protocol, lobby additions

Changes to [003's protocol](../../003-online-relay/contracts/relay-protocol.md); everything not
listed here is unchanged. Defined once in `relay/protocol.ts`.

## Addresses

| Purpose | URL | Result |
|---|---|---|
| Create a room | `wss://<site>/relay/<game>/new?size=N` | `N` from 2 to the relay's largest room (12); missing → 4; otherwise 4400. `hello` adds `name`, `size`, `open: true`, `openFor: 0` |
| Join a room | `wss://<site>/relay/<game>/<CODE>` | as 003; `hello` adds `name`, `size`, `open`, `openFor`; a racing room → 4423 |
| List rooms | `GET https://<site>/relay/<game>/rooms` | `200 {"rooms":[{"code","name","players","size"}]}` (open, not full, newest first), `Cache-Control: no-store`; over the rate limit → `429` |

## Frames from the relay (new)

| `t` | Fields | When |
|---|---|---|
| `room` | `open`, `openFor` | the host locked or reopened the room (sent to everyone, host included) |

## Frames from a client (new, host only)

| `t` | Effect | From anyone else |
|---|---|---|
| `room-lock` | room stops being listed or joinable | ignored |
| `room-open` | room is listed and joinable again; countdown restarts (`openedAt = now`) | ignored |
| `room-close` | every connection in the room is closed with 4410; the room is removed | ignored |

Game messages still may not use any relay type (`hello`, `join`, `leave`, `room`): those close
the connection with 4400 as before.

## Close codes (new)

| Code | Meaning | Game message |
|---|---|---|
| 4410 | the host closed the room | "The host closed the room" |
| 4423 | the room's race has already started | "That race has already started" |

## Turbo Tumble

- `hello.size` sets the field size; slots run 0 … size − 1. `start` is preceded by `room-lock`;
  when the results show, the host sends `room-open`.
- Countdown deadline = `Date.now() − openFor + 60 000`; at 0 the host starts the race.
