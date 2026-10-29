// The Online popup and waiting room every game uses (features 004–006): the live room list, Host a room, join by
// code or link, and in a room its name, n/size, the player list, the countdown, Copy link and Cancel/Leave. The game
// supplies its slug, sizes and wording, draws its own garage, and gets callbacks; game messages stay the game's own.
import { CODE_LENGTH, isSlot, NEW_ROOM, RelayMsg, type Hello, type RoomInfo } from '../../../relay/protocol.ts';
import type { GameSlug } from '../../games/index.ts';
import { connect, deadlineFrom, fetchRooms, joinLink, LIST_POLL_MS, NetText, roomFromUrl, secondsLeft } from './client.ts';
import { computerSpots, rosterRows, type Look, type RosterRow } from './roster.ts';
import './lobby.css';

/** The popup's and waiting room's buttons. */
export const OnlineAction = {
  Host: 'host-room', Join: 'join-room', Copy: 'copy-link', Leave: 'leave-room', Cancel: 'cancel-room', Close: 'close-lobby', Rejoin: 'rejoin-room',
} as const;
export type OnlineAction = typeof OnlineAction[keyof typeof OnlineAction];

const TICK_MS = 250; // how often the countdown is checked

/** A room we're in: `deadline` is when its countdown ends on our clock; `open` = waiting (not playing); `key`: our
 *  private key for rejoining it if we drop mid-game. */
export type LobbyRoom<P extends Look> = {
  slot: number; peers: Set<number>; profiles: Record<number, P>; code: string; name: string; size: number;
  open: boolean; deadline: number; key: string;
};

export type LobbyOptions = {
  root: HTMLElement;              // the game's root: the popup goes here
  panel: HTMLElement;             // where the waiting room is drawn (inside the game's garage)
  game: GameSlug;
  sizes: readonly number[];
  defaultSize: number;
  countdownMs: number;
  botWord: string;                // "computer karts"
  roomInfo: (host: boolean) => string;
  own: () => Look;                // our look, for our row of the player list
  canShow: () => boolean;         // the garage is open (not in a race or match)
  onHello: () => void;            // we're in a room
  onPeers: (joined?: number) => void; // someone joined (their slot) or left
  onMessage: (raw: unknown) => void;  // a game message, still to be checked by the game
  onClosed: (reason: NetText | null) => void; // out of the room: refused or dropped (reason), or left on purpose (null)
  onCountdownEnd: () => void;     // the host's countdown reached 0 in the garage
  onDeactivate: () => void;       // the popup was closed
  onChange: () => void;           // after every redraw (for the game's own buttons)
  rowTag?: (slot: number) => string;  // a label on a player's row (Tank Clash: their side)
  bots?: (players: number, size: number) => number; // computer players to show (default: the room's free spots)
  rejoin?: () => { code: string; key: string } | null; // a game we dropped out of: offers "Rejoin battle" (asked on every redraw: keep it cheap)
};

// a coloured dot and text spans; text goes in as text, never markup (names are players' own)
function rowItem(dot: string, ...texts: [cls: string, text: string][]) {
  const li = document.createElement('li'), d = document.createElement('i');
  d.className = 'dot'; d.style.background = dot;
  li.append(d, ...texts.map(([cls, text]) => Object.assign(document.createElement('span'), {className: cls, textContent: text})));
  return li;
}
function rosterItem(r: RosterRow, label?: string) {
  const tags: [string, string][] = [...(label ? [['tag', label] as [string, string]] : []),
    ...(r.host ? [['tag', 'host'] as [string, string]] : []), ...(r.you ? [['tag', 'you'] as [string, string]] : [])];
  const li = rowItem(r.color, ['slot', `P${r.slot + 1}`], ['name', r.name], ...tags);
  li.classList.toggle('mine', r.you);
  return li;
}

export function createLobby<P extends Look>(o: LobbyOptions) {
  const popup = document.createElement('div');
  popup.id = 'lobby'; popup.className = 'online-lobby';
  popup.setAttribute('role', 'dialog'); popup.setAttribute('aria-modal', 'true'); popup.setAttribute('aria-labelledby', 'lobbyTitle');
  popup.innerHTML = `<div class="box">
  <button class="close" data-online="${OnlineAction.Close}" aria-label="Close">✕</button>
  <h2 id="lobbyTitle">Online rooms</h2>
  <button class="opt" id="rejoin" data-online="${OnlineAction.Rejoin}">Rejoin battle</button>
  <div id="roomList"></div>
  <div id="netInfo" role="status"></div>
  <div class="host-row"><label>Players <select id="cSize">${o.sizes.map(n => `<option${n === o.defaultSize ? ' selected' : ''}>${n}</option>`).join('')}</select></label><button class="opt" data-online="${OnlineAction.Host}">Host a room</button></div>
  <div class="join-row"><input type="text" id="cCode" maxlength="${CODE_LENGTH}" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="Room code" aria-label="Room code"><button class="opt" data-online="${OnlineAction.Join}">Join</button></div>
</div>`;
  o.root.append(popup);
  o.panel.classList.add('online-lobby');
  o.panel.innerHTML = `<div id="onlineRoom">
  <b id="roomName"></b> · <span id="roomCount"></span><div id="countdown" role="timer"></div>
  <div id="roomInfo"></div>
  <ul id="roster" aria-label="In this room"></ul><div id="botCount"></div>
  Code <span id="roomCode"></span> <button class="opt" data-online="${OnlineAction.Copy}">Copy link</button>
  <button class="opt" data-online="${OnlineAction.Cancel}">Cancel</button><button class="opt" data-online="${OnlineAction.Leave}">Leave</button>
</div>`;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => o.root.querySelector<T>('#' + id)!;
  const cCode = $<HTMLInputElement>('cCode'), cSize = $<HTMLSelectElement>('cSize');

  let conn: ReturnType<typeof connect> | null = null, room: LobbyRoom<P> | null = null;
  let active = false, connecting = false, info = '', polling = false, rosterKey = '', listKey = '', shownSeconds = -1;
  const isHost = () => !room || room.slot < Math.min(...room.peers);
  const send = (m: object) => { if (room) conn?.send(m); }; // the relay adds our slot as `from`
  const visible = () => active && !room && o.canShow();

  function showRooms(rooms: RoomInfo[]) {
    const key = JSON.stringify(rooms);
    if (key === listKey) return; // unchanged: keep the buttons, so a tap that lands mid-refresh still counts
    listKey = key;
    const rows: HTMLElement[] = rooms.map(r => {
      const b = document.createElement('button'); b.className = 'opt room';
      b.textContent = `${r.name} · ${r.players}/${r.size}`; // names come from the relay: text, never HTML
      b.onclick = () => open(r.code);
      return b;
    });
    if (!rows.length) { const empty = document.createElement('div'); empty.textContent = NetText.NoRooms; rows.push(empty); }
    $('roomList').replaceChildren(...rows);
  }
  // the room list, refreshed while the popup is showing; one request at a time, so a slow answer can't overwrite a newer one
  async function poll() {
    if (!visible() || conn || polling) return;
    polling = true;
    const rooms = await fetchRooms(o.game).finally(() => { polling = false; });
    if (visible() && !conn) showRooms(rooms);
  }

  function render() {
    $('netInfo').textContent = !active ? '' : connecting ? 'Connecting…' : info;
    popup.style.display = visible() ? '' : 'none';
    $('rejoin').style.display = visible() && o.rejoin?.() ? '' : 'none';
    o.panel.style.display = active ? '' : 'none';
    $('onlineRoom').style.display = room ? '' : 'none';
    if (room) {
      const host = isHost();
      $('roomName').textContent = room.name;
      $('roomCount').textContent = `${room.peers.size + 1}/${room.size} players`;
      $('countdown').textContent = room.open ? `Starts in ${secondsLeft(room.deadline)}s` : 'Playing';
      $('roomInfo').textContent = `Online as P${room.slot + 1} · ${o.roomInfo(host)}`;
      $('roomCode').textContent = room.code;
      const rows = rosterRows(room.slot, room.peers, room.profiles, o.own());
      const tags = rows.map(r => o.rowTag?.(r.slot)), key = JSON.stringify([room.size, rows, tags]);
      if (key !== rosterKey) { // render runs on every network message, many a second mid-game
        rosterKey = key;
        $('roster').replaceChildren(...rows.map((r, i) => rosterItem(r, tags[i])));
        const players = room.peers.size + 1, bots = o.bots ? o.bots(players, room.size) : computerSpots(room.size, players);
        $('botCount').textContent = bots ? `+${bots} ${o.botWord}` : '';
      }
      o.panel.querySelector<HTMLElement>(`[data-online="${OnlineAction.Cancel}"]`)!.style.display = host ? '' : 'none';
      o.panel.querySelector<HTMLElement>(`[data-online="${OnlineAction.Leave}"]`)!.style.display = host ? 'none' : '';
    }
    o.onChange();
  }

  /** Hosts (code = NEW_ROOM, with a size) or joins a room (with a key: rejoins a game we dropped out of). */
  function open(code: string, size?: number, key?: string) {
    if (conn) return;
    info = ''; connecting = true;
    conn = connect(code, o.game, {
      hello: (h: Hello) => {
        connecting = false;
        room = {slot: h.slot, peers: new Set(h.peers), profiles: {}, code: h.code, name: h.name, size: h.size,
          open: h.open, deadline: deadlineFrom(h.openFor, o.countdownMs), key: h.key};
        o.onHello(); render();
      },
      room: r => { if (room) { room.open = r.open; room.deadline = deadlineFrom(r.openFor, o.countdownMs); render(); } },
      message: m => {
        const f = m as { t?: unknown; slot?: unknown } | null;
        if (room && f && (f.t === RelayMsg.Join || f.t === RelayMsg.Leave) && isSlot(f.slot) && !('from' in f)) {
          const slot = f.slot as number; // the relay's own frames; a player's would carry `from`
          if (f.t === RelayMsg.Join) { room.peers.add(slot); o.onPeers(slot); }
          else { room.peers.delete(slot); delete room.profiles[slot]; o.onPeers(); }
        } else o.onMessage(m);
        render();
      },
      closed: text => { conn = room = null; connecting = false; info = text; o.onClosed(text); render(); poll(); },
    }, {size, key});
    render();
  }
  function leave() {
    conn?.close();
    conn = room = null; connecting = false; info = '';
    o.onClosed(null); render(); poll();
  }

  for (const b of o.root.querySelectorAll<HTMLButtonElement>('[data-online]')) b.onclick = () => {
    const action = b.dataset.online;
    if (action === OnlineAction.Host) open(NEW_ROOM, Number(cSize.value));
    if (action === OnlineAction.Join && cCode.value.trim()) open(cCode.value);
    const back = action === OnlineAction.Rejoin && o.rejoin?.();
    if (back) open(back.code, undefined, back.key);
    if (action === OnlineAction.Leave) leave();
    if (action === OnlineAction.Cancel) { send({t: RelayMsg.Close}); leave(); } // guests get 4410
    if (action === OnlineAction.Close) { if (conn) leave(); active = false; o.onDeactivate(); render(); }
    if (action === OnlineAction.Copy && room) {
      const link = joinLink(location.origin, o.game, room.code);
      const show = () => { $('netInfo').textContent = link; }; // no clipboard: show it to copy by hand
      navigator.clipboard ? navigator.clipboard.writeText(link).catch(show) : show();
    }
  };

  const poller = setInterval(poll, LIST_POLL_MS);
  // the waiting room's countdown: the host starts when it runs out
  const ticker = setInterval(() => {
    if (!room || !room.open) return;
    const left = secondsLeft(room.deadline);
    if (left !== shownSeconds) { shownSeconds = left; render(); }
    if (left === 0 && isHost() && o.canShow()) o.onCountdownEnd();
  }, TICK_MS);

  // a join link: the game turns Online on and calls open(linkedRoom) once it has drawn its first frame
  const linkedRoom = roomFromUrl(location.href);
  if (linkedRoom) cCode.value = linkedRoom;

  return {
    linkedRoom,
    get room() { return room; },
    get active() { return active; },
    /** Online picked (true) or another mode (false: leaves any room). */
    setActive(on: boolean) { active = on; if (!on && conn) leave(); render(); poll(); },
    isHost, open, leave, send, render, poll,
    /** The room stops being listed or joinable (a race or match starts) / is listed again with a fresh countdown. */
    lock: () => send({t: RelayMsg.Lock}),
    reopen: () => send({t: RelayMsg.Open}),
    /** A player's look arrived (already checked by the game). */
    setProfile(slot: number, look: P) {
      if (!room || slot === room.slot) return;
      room.peers.add(slot); room.profiles[slot] = look; render();
    },
    dispose() { clearInterval(poller); clearInterval(ticker); conn?.close(); popup.remove(); },
  };
}
