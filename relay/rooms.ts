// Live rooms, in memory only: game → code → slots. Nothing is kept once a room empties (FR-007).
import { newCode } from './codes.ts';
import { RelayMsg } from './protocol.ts';

export type Peer = { send: (data: string) => void };
type Room = Map<number, Peer>; // slot → connection

export function createRooms({ roomSize, maxRooms }: { roomSize: number; maxRooms: number }, makeCode: (taken: (c: string) => boolean) => string = newCode) {
  const games = new Map<string, Map<string, Room>>();
  let total = 0;
  const find = (game: string, code: string) => games.get(game)?.get(code);
  const tell = (room: Room, except: number, msg: object) => {
    const data = JSON.stringify(msg);
    for (const [slot, peer] of room) if (slot !== except) peer.send(data);
  };

  return {
    create(game: string, peer: Peer) {
      if (total >= maxRooms) return 'busy' as const;
      const rooms = games.get(game) ?? new Map<string, Room>();
      games.set(game, rooms);
      const code = makeCode(c => rooms.has(c));
      rooms.set(code, new Map([[0, peer]]));
      total++;
      return { code, slot: 0 };
    },
    join(game: string, code: string, peer: Peer) {
      const room = find(game, code);
      if (!room) return 'no-room' as const;
      let slot = 0;
      while (room.has(slot)) slot++;
      if (slot >= roomSize) return 'full' as const;
      const peers = [...room.keys()].sort((a, b) => a - b);
      room.set(slot, peer);
      tell(room, slot, { t: RelayMsg.Join, slot });
      return { slot, peers };
    },
    leave(game: string, code: string, slot: number) {
      const room = find(game, code);
      if (!room?.delete(slot)) return;
      if (room.size) return tell(room, slot, { t: RelayMsg.Leave, slot });
      games.get(game)!.delete(code);
      if (!games.get(game)!.size) games.delete(game);
      total--;
    },
    /** Sends a game payload to the room's other players, stamped with the sender's real slot. */
    broadcast(game: string, code: string, from: number, payload: object) {
      const room = find(game, code);
      if (room) tell(room, from, { ...payload, from });
    },
    count() {
      let clients = 0;
      for (const rooms of games.values()) for (const room of rooms.values()) clients += room.size;
      return { rooms: total, clients };
    },
  };
}
