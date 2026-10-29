# Contract: relay slot keys and rejoining a locked room

A generic addition to the relay protocol (specs/003-online-relay/contracts/relay-protocol.md). Games
that don't use it see no change.

## Hello

`hello` gains `key`: a random 16-character string for this slot in this room, sent only to its
owner.

## Leaving a locked room

When a player's connection closes while the room is locked (`room-lock`), the relay keeps their
slot reserved for their key: the others still get `leave {slot}`, and new joins skip that slot.
When the host reopens the room (`room-open`) or the room empties, all reservations are dropped.

## Rejoining

`/relay/<game>/<code>?key=<key>`:

| Room state | Key | Result |
|---|---|---|
| locked | matches a reservation | joins with the reserved slot; `hello` (same slot, a new key); others get `join {slot}` |
| locked | missing or no match | closed with `4423 Started` (as today) |
| open | any | ordinary join (key ignored) |
| no such room | any | `4404` (as today) |

A key is used once: rejoining issues a new key. Keys are never listed or forwarded. Only the slot's
owner ever learns its key, so no one else can take that slot.

## Tests (relay e2e)

- leave while locked → rejoin with key → same slot, others see `join`;
- wrong key or no key → 4423; key from another room or game → 4423;
- room reopened → reservation gone, key no longer works, slot free for anyone;
- a reserved slot is skipped by new joins and doesn't count as a free spot in the room list;
- isolation: rooms and games still never see each other's messages.
