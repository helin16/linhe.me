// Live rooms, in memory only: game → code → room. Nothing is kept once a room empties (FR-007, 004 FR-012).
import { randomBytes } from 'node:crypto';
import { newCode } from './codes.ts';
import { newName } from './names.ts';
import { CloseCode, KEY_LENGTH, RelayMsg, type RoomInfo } from './protocol.ts';

export type Peer = { send: (data: string) => void; close: (code: number) => void };
/** `open`: waiting (listed, joinable) or racing; `openedAt`: when it last opened, the room's countdown clock; `keys`: each
 *  slot's rejoin key; `reserved`: slots of players who left while the room was locked, by key, until it reopens. */
type Room = { slots: Map<number, Peer>; name: string; size: number; open: boolean; openedAt: number; keys: Map<number, string>; reserved: Map<string, number> };
const newKey = () => randomBytes(KEY_LENGTH * 3 / 4).toString('base64url'); // 12 bytes → 16 characters
export type Control = typeof RelayMsg.Lock | typeof RelayMsg.Open | typeof RelayMsg.Close;

export function createRooms({ maxRooms }: { maxRooms: number }, makeCode: (taken: (c: string) => boolean) => string = newCode,
  makeName: (taken: (n: string) => boolean) => string = newName, now: () => number = Date.now, makeKey: () => string = newKey) {
  const games = new Map<string, Map<string, Room>>();
  let total = 0;
  const find = (game: string, code: string) => games.get(game)?.get(code);
  const tell = (room: Room, except: number, msg: object) => {
    const data = JSON.stringify(msg);
    for (const [slot, peer] of room.slots) if (slot !== except) peer.send(data);
  };
  const state = (room: Room) => ({ name: room.name, size: room.size, open: room.open, openFor: now() - room.openedAt });
  const host = (room: Room) => Math.min(...room.slots.keys());
  const remove = (game: string, code: string) => {
    games.get(game)!.delete(code);
    if (!games.get(game)!.size) games.delete(game);
    total--;
  };

  return {
    /** `size` is checked by the caller (the relay's largest room is configuration). */
    create(game: string, peer: Peer, size: number) {
      if (total >= maxRooms) return 'busy' as const;
      const rooms = games.get(game) ?? new Map<string, Room>();
      let code: string, name: string;
      try {
        code = makeCode(c => rooms.has(c));
        name = makeName(n => [...rooms.values()].some(r => r.name === n));
      } catch { return 'busy' as const; } // every code or name taken: refuse, don't crash the relay
      const room: Room = { slots: new Map([[0, peer]]), name, size, open: true, openedAt: now(), keys: new Map([[0, makeKey()]]), reserved: new Map() };
      rooms.set(code, room);
      games.set(game, rooms);
      total++;
      return { code, slot: 0, peers: [] as number[], ...state(room), key: room.keys.get(0)! };
    },
    /** Joins an open room, or — with the key of a slot kept when its player left — rejoins a locked one. */
    join(game: string, code: string, peer: Peer, key?: string) {
      const room = find(game, code);
      if (!room) return 'no-room' as const;
      let slot = 0;
      if (!room.open) {
        if (key === undefined || !room.reserved.has(key)) return 'started' as const;
        slot = room.reserved.get(key)!;
        room.reserved.delete(key);
      } else {
        while (room.slots.has(slot)) slot++;
        if (slot >= room.size) return 'full' as const;
      }
      const peers = [...room.slots.keys()].sort((a, b) => a - b);
      room.slots.set(slot, peer);
      room.keys.set(slot, makeKey()); // a key works once
      tell(room, slot, { t: RelayMsg.Join, slot });
      return { slot, peers, ...state(room), key: room.keys.get(slot)! };
    },
    leave(game: string, code: string, slot: number) {
      const room = find(game, code);
      if (!room?.slots.delete(slot)) return;
      if (!room.open) room.reserved.set(room.keys.get(slot)!, slot); // a locked room keeps the slot for its key
      room.keys.delete(slot);
      if (room.slots.size) return tell(room, slot, { t: RelayMsg.Leave, slot });
      remove(game, code);
    },
    /** The host (lowest slot) locks the room for a race, reopens it after, or closes it; anyone else is ignored. */
    control(game: string, code: string, from: number, t: Control) {
      const room = find(game, code);
      if (!room || host(room) !== from) return false;
      if (t === RelayMsg.Close) {
        remove(game, code);
        for (const peer of room.slots.values()) peer.close(CloseCode.Closed);
        return true;
      }
      room.open = t === RelayMsg.Open;
      if (room.open) { room.openedAt = now(); room.reserved.clear(); }
      const { open, openFor } = state(room);
      tell(room, -1, { t: RelayMsg.Room, open, openFor });
      return true;
    },
    /** Sends a game payload to the room's other players, stamped with the sender's real slot. */
    broadcast(game: string, code: string, from: number, payload: object) {
      const room = find(game, code);
      if (room) tell(room, from, { ...payload, from });
    },
    /** The game's waiting rooms with a free spot, newest first. */
    list(game: string): RoomInfo[] {
      return [...games.get(game) ?? []].reverse().filter(([, r]) => r.open && r.slots.size < r.size)
        .map(([code, r]) => ({ code, name: r.name, players: r.slots.size, size: r.size }));
    },
    count() {
      let clients = 0;
      for (const rooms of games.values()) for (const room of rooms.values()) clients += room.slots.size;
      return { rooms: total, clients };
    },
  };
}
