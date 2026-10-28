// Live rooms, in memory only: game → code → room. Nothing is kept once a room empties (FR-007, 004 FR-012).
import { newCode } from './codes.ts';
import { newName } from './names.ts';
import { CloseCode, RelayMsg, type RoomInfo } from './protocol.ts';

export type Peer = { send: (data: string) => void; close: (code: number) => void };
/** `open`: waiting (listed, joinable) or racing; `openedAt`: when it last opened, the room's countdown clock. */
type Room = { slots: Map<number, Peer>; name: string; size: number; open: boolean; openedAt: number };
export type Control = typeof RelayMsg.Lock | typeof RelayMsg.Open | typeof RelayMsg.Close;

export function createRooms({ maxRooms }: { maxRooms: number }, makeCode: (taken: (c: string) => boolean) => string = newCode,
  makeName: (taken: (n: string) => boolean) => string = newName, now: () => number = Date.now) {
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
      const room: Room = { slots: new Map([[0, peer]]), name, size, open: true, openedAt: now() };
      rooms.set(code, room);
      games.set(game, rooms);
      total++;
      return { code, slot: 0, peers: [] as number[], ...state(room) };
    },
    join(game: string, code: string, peer: Peer) {
      const room = find(game, code);
      if (!room) return 'no-room' as const;
      if (!room.open) return 'started' as const;
      let slot = 0;
      while (room.slots.has(slot)) slot++;
      if (slot >= room.size) return 'full' as const;
      const peers = [...room.slots.keys()].sort((a, b) => a - b);
      room.slots.set(slot, peer);
      tell(room, slot, { t: RelayMsg.Join, slot });
      return { slot, peers, ...state(room) };
    },
    leave(game: string, code: string, slot: number) {
      const room = find(game, code);
      if (!room?.slots.delete(slot)) return;
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
      if (room.open) room.openedAt = now();
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
