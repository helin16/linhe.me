# Contract: relay protocol

Shared by the relay and every game client; defined once in `relay/protocol.ts` (owned by the relay, imported by games).

## Addresses

| Purpose | URL | Result |
|---|---|---|
| Create a room | `wss://<site>/relay/<game>/new` | room created; first frame is `hello` with the new `code`, `slot: 0`, `peers: []` |
| Join a room | `wss://<site>/relay/<game>/<CODE>` | first frame is `hello` with `code`, own `slot`, `peers` (other slots) |

`<game>` matches `^[a-z0-9-]{1,32}$`. `<CODE>` is normalised (upper case, spaces removed) before
lookup. Any other path is refused with HTTP 404 before the upgrade.

## Frames from the relay

| `t` | Fields | When |
|---|---|---|
| `hello` | `slot`, `peers: number[]`, `code` | once, right after connecting |
| `join` | `slot` | another player joined the room |
| `leave` | `slot` | another player left (closed, dropped, or kicked) |
| *(anything else)* | the sender's payload plus `from: <sender slot>` | a peer sent a message |

## Frames from a client

Any JSON object (game-defined, e.g. Turbo Tumble's `me`, `start`, `s`, `goo`, `pop`, `zap`). The
relay overwrites `from` with the sender's slot and forwards it to every other client in the room.
Non-JSON or non-object frames close the connection with 4400.

## Close codes

| Code | Meaning | Game message |
|---|---|---|
| 4400 | bad request (bad game name, bad frame) | "Online play isn't available right now" |
| 4404 | no room with that code | "No room with that code" |
| 4409 | room is full | "That room is full" |
| 4413 | message too big | "Disconnected from the room" |
| 4429 | too many messages | "Disconnected from the room" |
| 4503 | relay at its room or address limit | "Online play isn't available right now" |
| other / network error before `hello` | relay unreachable | "Online play isn't available right now" |
| other after `hello` | connection dropped | "Disconnected from the room" |

## Join link (Turbo Tumble)

`https://<site>/games/turbo-tumble/?room=<CODE>` opens the game with the code filled in and the
Join button shown.
