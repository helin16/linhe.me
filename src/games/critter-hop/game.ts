// Critter Hop (specs/012-creature-checkers): the setup screen and type picker, turns, input (mouse, keyboard, touch),
// computer turns, the turn timer and hints, the end screen, and online play. The rules live in rules.ts, computer
// players in bots.ts, the 3D view in scene.ts, online messages in messages.ts; mount() renders into `root` and returns a
// cleanup that leaves the page as it was.
import { values } from '../../shared/enum.ts';
import { PlayerMode } from '../../shared/modes.ts';
import { NetText } from '../../shared/online/client.ts';
import { createLobby, type LobbyRoom } from '../../shared/online/lobby.ts';
import { playerName, type Look } from '../../shared/online/roster.ts';
import { GameSlug } from '../index.ts';
import { botMove, hint } from './bots.ts';
import {
  BOT_DELAY_MS, COUNTDOWN_MS, DEFAULT_ROOM_SIZE, FAST_FACTOR, FLASH_MS, HOP_MS, MAX_SEED, PIECES, PLAYER_COUNTS, REJOIN_MS, ROOM_SIZES,
  PENDING_MS, SPOTS_S, STALL_ROUNDS, STALL_WARN, TAP_PX, TURN_MS,
} from './constants.ts';
import { ARROWS, nextSpot, type Spot } from '../../shared/cursor.ts';
import { CritterType, Difficulty, EndWhy, GameState, HopKind, HopMsg, HopSpeed, MoveWord, ResultAction, Screen, SeatKind } from './enums.ts';
import { allowedFrom, fromSync, parseMessage, seatSpecs, syncMsg, type Msg, type SeatRow } from './messages.ts';
import { nextRunner, roomSeats, takeType } from '../../shared/online/seats.ts';
import { applyMove, endNow, findMove, inTarget, legalMoves, newGame, type Game, type Move, type Seat } from './rules.ts';
import { createScene, type RingKind } from './scene.ts';
import { gameSetup, seeded, type Random } from '../../shared/seed.ts';
import { loadSaved, saveSettings, uniqueTypes } from './settings.ts';
import { createSound } from './sound.ts';
import { beatenBy, BEATS, LOOKS } from './types.ts';

const MARKUP = `
<canvas id="view" aria-label="The board"></canvas>
<div id="hud">
  <div id="bar"><span id="whoseTurn" role="status"></span><span id="timer" role="timer"></span>
    <button id="hintBtn">Hint</button><button id="endBtn">End game</button><button id="menuBtn">Menu</button>
    <button id="mute" aria-label="Sound on or off"></button></div>
  <ul id="seatList" aria-label="Player list"></ul>
  <div id="stallInfo" role="status"></div>
  <div id="msg" role="status"></div>
  <div id="status" aria-live="polite"></div>
  <div id="spots" aria-label="Moves"></div>
</div>
<div id="setup">
  <h1>Critter Hop</h1>
  <div>Mode<br><span id="cMode"></span></div>
  <div id="countRow">Players<br><span id="cCount"></span></div>
  <div id="seatRow">Seats <small>(tap a seat to pick its type)</small><ul id="cSeats"></ul></div>
  <div><span id="pickFor">Your type</span><div id="cTypes"></div></div>
  <div id="takenNote" role="status"></div>
  <div id="levelRow">Computer players<br><span id="cLevel"></span></div>
  <div>Hop speed<br><span id="cSpeed"></span></div>
  <label id="timerRow"><input type="checkbox" id="cTimer"> Turn timer (60 s)</label>
  <div id="online"></div>
  <div id="keys"></div>
  <button id="go">Start</button>
</div>
<div id="end"><div id="endText"></div></div>`;
const GAME_VIEWPORT = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
const MODES = [PlayerMode.One, PlayerMode.Two, PlayerMode.Online];
const MAX_FRAME_S = 0.25;
const REJOIN_KEY = 'ch-rejoin';
const KEY_HELP = 'Arrows: move the cursor · Enter: select / move · Esc: cancel · H: hint · Q/E: turn · +/−: zoom';
const PLACE = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
const ZOOM_KEYS: Record<string, number> = { Equal: 1, NumpadAdd: 1, Minus: -1, NumpadSubtract: -1 };
const TURN_KEYS: Record<string, number> = { KeyQ: -1, KeyE: 1 };

type Saved = { code: string; key: string; at: number };
const readRejoin = (): Saved | null => {
  try {
    const v = JSON.parse(localStorage.getItem(REJOIN_KEY) ?? 'null');
    return v && typeof v.code === 'string' && typeof v.key === 'string' && Date.now() - v.at < REJOIN_MS ? v : null;
  } catch { return null; }
};
const writeRejoin = (v: Saved | null) => { try { if (v) localStorage.setItem(REJOIN_KEY, JSON.stringify(v)); else localStorage.removeItem(REJOIN_KEY); } catch {} };

export function mount(root: HTMLElement): () => void {
  const listening = new AbortController(), signal = listening.signal;
  const viewport = document.querySelector<HTMLMetaElement>('meta[name=viewport]');
  const siteViewport = viewport?.content;
  if (viewport) viewport.content = GAME_VIEWPORT;
  root.classList.add('ch');
  root.innerHTML = MARKUP;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const canvas = $<HTMLCanvasElement>('view');

  const cfg = loadSaved();
  const save = () => saveSettings(cfg);
  const sound = createSound(cfg.muted);
  const scene = createScene(canvas);
  let mode: PlayerMode = PlayerMode.One, screen: Screen = Screen.Setup, editSeat = 0, disposed = false;

  // --- the game and whose turn it is ---
  let g: Game | null = null, random: Random = Math.random, seed = 0;
  // pending: online, a move this device sent to the runner, not yet played back (research R5: the runner orders moves)
  let selected = -1, cursor = -1, hintMove: Move | null = null, turnEnds = 0, busy = false, pending = false;
  let botTimer: ReturnType<typeof setTimeout> | undefined, pendingTimer: ReturnType<typeof setTimeout> | undefined, flashTimer: ReturnType<typeof setTimeout> | undefined;
  let queue: Promise<void> = Promise.resolve();
  const persons = () => g ? g.seats.filter(s => s.kind === SeatKind.Person).length : 0;
  const segMs = () => HOP_MS / (cfg.speed === HopSpeed.Fast ? FAST_FACTOR : 1);
  const mine = (s: Seat) => s.kind === SeatKind.Person && (!online() || s.slot === net!.slot);
  /** Can this device move now? A person's turn here, nothing animating. */
  const canAct = () => !!g && screen === Screen.Play && g.state === GameState.Playing && !busy && !pending && mine(g.seats[g.turn]);
  function seatLabel(s: Seat) {
    if (s.kind === SeatKind.Computer) return `${s.type} (computer)`;
    if (online()) return s.slot === net?.slot ? `${s.type} (you)` : `${s.type} (${playerName('', s.slot)})`;
    return persons() === 1 ? `${s.type} (you)` : `${s.type} (Player ${g!.seats.filter(x => x.kind === SeatKind.Person).indexOf(s) + 1})`;
  }
  const flash = (text: string) => {
    $('msg').textContent = text; clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { $('msg').textContent = ''; }, FLASH_MS);
  };
  /** Moves run one at a time, in the order they were made (online ones can arrive while one is still hopping). */
  const enqueue = (job: () => Promise<void> | void) => {
    queue = queue.then(job).catch(e => { busy = false; pending = false; console.error(e); refresh(); }); // never stuck, never silent
  };

  /** A move decided here (a person's, a computer's when this device runs them, a timeout, or — on the runner — one a
   *  player sent): checked, then played. Online only the runner plays and sends moves, so every device sees one order
   *  (a timeout and a late move can't both happen); a guest's own move goes to the runner and comes back. */
  function commit(seat: number, m: Pick<Move, 'piece' | 'path'>, computer = false) {
    enqueue(() => {
      if (!g || g.turn !== seat || (computer && g.seats[seat].kind !== SeatKind.Computer)) return;
      const mv = findMove(g, seat, m.piece, m.path);
      if (!mv) return;
      const msg = { t: HopMsg.Move, seat, piece: mv.piece, path: mv.path };
      if (online() && !iRun()) { // the runner may drop it (the turn just timed out): unlock if it doesn't come back
        pending = true; send(msg); clearTimeout(pendingTimer);
        pendingTimer = setTimeout(() => { pending = false; refresh(); }, PENDING_MS);
        return refresh();
      }
      if (online()) send(msg);
      return play(mv);
    });
  }
  /** Plays a legal move on this device: the rules first, then the hop, then the next turn. */
  async function play(m: Move) {
    const game = g!, p = game.pieces[m.piece], seat = game.seats[p.seat], arrived = p.arrived;
    clearTimeout(botTimer); turnEnds = 0; selected = -1; hintMove = null; busy = true; pending = false;
    const result = applyMove(game, m);
    refresh();
    sound.play('jump');
    await scene.animate(m, seat.type, segMs());
    if (disposed || g !== game) return;
    busy = false;
    scene.burst(m.path[m.path.length - 1], seat.type);
    if (!arrived && p.arrived) sound.play('arrive');
    if (result.finished) { flash(`${seatLabel(seat)} finishes ${PLACE[seat.place! - 1]}!`); sound.play('fanfare'); }
    for (const s of result.skipped) flash(`${seatLabel(game.seats[s])} can't move: turn skipped`);
    nextTurn();
  }
  function nextTurn() {
    clearTimeout(botTimer); hintMove = null; selected = -1; cursor = -1;
    if (!g) return;
    if (g.state === GameState.Over) return gameOver();
    const s = g.seats[g.turn];
    root.dataset.turn = String(g.turn);
    turnEnds = online() || (cfg.localTimer && s.kind === SeatKind.Person) ? Date.now() + TURN_MS : 0;
    if (iRun()) send({ t: HopMsg.Turn, seat: g.turn, left: TURN_MS, round: g.round, stall: g.stall });
    if (s.kind === SeatKind.Computer && (!online() || iRun())) {
      const seat = g.turn;
      botTimer = setTimeout(() => { if (g) commit(seat, botMove(g, random, level()), true); }, BOT_DELAY_MS / (cfg.speed === HopSpeed.Fast ? FAST_FACTOR : 1));
    }
    if (s.kind === SeatKind.Person && !online() && persons() > 1) scene.faceHome(s.home);
    refresh();
  }
  /** The turn timer ran out: a simple move is played for the person (FR-017). */
  function timeUp() {
    if (!g || g.state !== GameState.Playing || busy) return; // a hop in progress: the next turn sets its own clock
    turnEnds = 0;
    const s = g.seats[g.turn];
    if (online() ? iRun() : mine(s)) commit(g.turn, hint(g));
  }

  // --- input: taps and clicks on the board, the keyboard, the move buttons ---
  /** A hole chosen (by tap, click, Enter or a move button): select your creature, move it, or switch/clear. */
  function choose(hole: number) {
    if (!canAct() || hole < 0) return;
    const id = g!.occupant[hole], own = id >= 0 && g!.pieces[id].seat === g!.turn;
    hintMove = null;
    if (selected >= 0) { const m = destinations().get(hole); if (m) return commit(g!.turn, m); }
    if (own && movesOf(id).length) { selected = selected === id ? -1 : id; sound.play('tap'); }
    else if (own) $('status').textContent = "That creature can't move";
    refresh();
  }
  // each creature's moves, worked out once per board position (a redraw asks for them many times)
  const moveCache = new Map<number, Move[]>();
  let cachedFor: Game | null = null, cachedAt = -1;
  function movesOf(id: number) {
    const at = g!.pieces.reduce((h, p) => h * 31 + p.hole | 0, g!.turn); // changes whenever a creature moves
    if (cachedFor !== g || cachedAt !== at) { moveCache.clear(); cachedFor = g; cachedAt = at; }
    if (!moveCache.has(id)) moveCache.set(id, legalMoves(g!, id));
    return moveCache.get(id)!;
  }
  const destinations = () => new Map(selected >= 0 && g ? movesOf(selected).map(m => [m.path[m.path.length - 1], m]) : []);
  const moveLabel = (m: Move) => m.kinds.includes(HopKind.LongHop) ? MoveWord.LongHop : m.kinds[0] === HopKind.Step ? MoveWord.Step : MoveWord.Hop;
  /** The holes a keyboard cursor or a move button can go to: your movable creatures, or where the selected one can go. */
  function candidates(dests = destinations()): number[] {
    if (!canAct()) return [];
    if (selected >= 0) return [...dests.keys(), g!.pieces[selected].hole];
    return g!.pieces.filter(p => p.seat === g!.turn && movesOf(p.id).length).map(p => p.hole);
  }
  function showHint() {
    if (!canAct()) return;
    hintMove = hint(g!); selected = -1;
    $('status').textContent = 'Hint shown: press Enter or tap it to play it';
    refresh();
  }
  // a tap is one pointer going down and up in place; a second finger (a pinch) cancels it
  const pointers = new Set<number>();
  let tap: { id: number; x: number; y: number } | null = null;
  canvas.addEventListener('pointerdown', e => {
    pointers.add(e.pointerId);
    tap = pointers.size === 1 ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null;
  }, { signal });
  canvas.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); tap = null; }, { signal });
  canvas.addEventListener('pointerup', e => {
    pointers.delete(e.pointerId);
    const down = tap; tap = null;
    if (!down || down.id !== e.pointerId || Math.hypot(e.clientX - down.x, e.clientY - down.y) > TAP_PX) return;
    const r = canvas.getBoundingClientRect(), hole = scene.pick(e.clientX - r.left, e.clientY - r.top);
    if (hintMove && (hole === hintMove.path[0] || hole === hintMove.path[hintMove.path.length - 1])) return commit(g!.turn, hintMove);
    choose(hole);
  }, { signal });
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // browser shortcuts (zoom, tabs) are not game keys
    const tag = (e.target as HTMLElement).tagName;
    if (screen !== Screen.Play || tag === 'INPUT' || tag === 'SELECT' || (tag === 'BUTTON' && (e.code === 'Enter' || e.code === 'Space'))) return;
    if (e.code in TURN_KEYS) return scene.turn(TURN_KEYS[e.code]);
    if (e.code in ZOOM_KEYS) return scene.zoom(ZOOM_KEYS[e.code] > 0 ? 1 / scene.zoomStep : scene.zoomStep);
    if (!canAct()) return;
    if (e.code in ARROWS) {
      e.preventDefault();
      const spots: Spot[] = candidates().map(h => ({ id: h, ...scene.project(h) }));
      if (!spots.length) return;
      const here = spots.find(s => s.id === cursor);
      cursor = here ? nextSpot(here, spots, ARROWS[e.code]).id : spots[0].id;
      hintMove = null;
      return refresh();
    }
    if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); return hintMove ? commit(g!.turn, hintMove) : choose(cursor); }
    if (e.code === 'Escape') { selected = -1; hintMove = null; cursor = -1; return refresh(); }
    if (e.code === 'KeyH') showHint();
  }, { signal });

  // --- drawing the state: rings, the bar, the player list, the move buttons ---
  function holeName(hole: number) {
    const s = g!.seats[g!.turn];
    return `${g!.board.rows[s.target][hole]} rows from home`;
  }
  function refresh() {
    if (!g || screen !== Screen.Play) return;
    const rings: [number, RingKind][] = [], dests = destinations(); // one search for the whole redraw
    if (selected >= 0) {
      rings.push([g.pieces[selected].hole, 'select']);
      for (const [hole, m] of dests) rings.push([hole, m.kinds.includes(HopKind.LongHop) ? 'long' : 'reach']);
    }
    if (hintMove) rings.push([hintMove.path[0], 'hint'], [hintMove.path[hintMove.path.length - 1], 'hint']);
    if (cursor >= 0) rings.push([cursor, 'cursor']);
    scene.setRings(rings);
    const s = g.seats[g.turn], playing = g.state === GameState.Playing;
    const who = $('whoseTurn');
    who.textContent = playing ? (mine(s) && persons() === 1 || online() && mine(s) ? 'Your turn' : `${seatLabel(s)}'s turn`) : 'Game over';
    who.style.color = LOOKS[s.type].color;
    $('hintBtn').style.display = canAct() ? '' : 'none';
    $('endBtn').style.display = online() ? 'none' : '';
    $('menuBtn').style.display = online() ? 'none' : '';
    $('stallInfo').textContent = playing && g.stall >= STALL_WARN ? `No creature has reached home for ${g.stall} rounds: the game ends at ${STALL_ROUNDS}` : '';
    const game = g;
    $('seatList').replaceChildren(...game.seats.map(x => {
      const li = document.createElement('li'), dot = document.createElement('i'), text = document.createElement('span');
      dot.className = 'dot'; dot.style.background = LOOKS[x.type].color;
      text.textContent = `${seatLabel(x)} · ${x.place ? PLACE[x.place - 1] : `${inTarget(game, x.id)}/${PIECES} home`}`; // text, never markup
      li.append(dot, text); li.classList.toggle('now', x.id === game.turn && playing);
      return li;
    }));
    if (canAct() && cursor >= 0) {
      const id = g.occupant[cursor], m = dests.get(cursor);
      $('status').textContent = m ? `${moveLabel(m)} to ${holeName(cursor)}`
        : id >= 0 ? `${s.type} creature, ${holeName(cursor)}: ${movesOf(id).length} places to go` : '';
    } else if (!canAct()) $('status').textContent = '';
    // a button per move or creature (for screen readers, and the same choices as tapping the board)
    $('spots').replaceChildren(...candidates(dests).map(hole => {
      const b = document.createElement('button'), m = dests.get(hole);
      b.dataset.hole = String(hole);
      b.textContent = m ? `${moveLabel(m)} to ${holeName(hole)}`
        : `${s.type} creature, ${holeName(hole)}`;
      b.onclick = () => choose(hole);
      return b;
    }));
    placeSpots();
  }
  /** Keeps each move button's screen position (data-x / data-y) up to date as the camera moves. */
  function placeSpots() {
    for (const b of $('spots').children as HTMLCollectionOf<HTMLElement>) {
      const p = scene.project(Number(b.dataset.hole));
      b.dataset.x = String(Math.round(p.x)); b.dataset.y = String(Math.round(p.y));
    }
  }
  function hud() {
    const left = turnEnds ? Math.max(0, Math.ceil((turnEnds - Date.now()) / 1000)) : 0;
    $('timer').textContent = turnEnds ? String(left) : '';
    if (turnEnds && Date.now() >= turnEnds) timeUp();
    $('mute').textContent = cfg.muted ? '🔇' : '🔊';
  }

  let last = performance.now(), frame = 0, spotsT = 0;
  function loop(now: number) {
    const dt = Math.min(MAX_FRAME_S, (now - last) / 1000); last = now;
    scene.render(dt);
    if (screen === Screen.Play) {
      hud();
      if ((spotsT += dt) >= SPOTS_S) { spotsT = 0; placeSpots(); }
      if (!root.dataset.ready) root.dataset.ready = '1';
    }
    if (pendingRoom) { const room = pendingRoom; pendingRoom = null; lobby.open(room); }
    frame = requestAnimationFrame(loop);
  }

  // --- screens ---
  function startGame() {
    if (mode === PlayerMode.Online) return hostStart();
    ({ random, seed } = gameSetup(location.href, false));
    const n = cfg.players, kinds = mode === PlayerMode.One ? [SeatKind.Person, ...Array<SeatKind>(n - 1).fill(SeatKind.Computer)] : cfg.seats.slice(0, n);
    const people = uniqueTypes(kinds.map((k, i) => k === SeatKind.Person ? cfg.types[i] : null).filter((t): t is CritterType => !!t));
    const left = values(CritterType).filter(t => !people.includes(t));
    let p = 0;
    g = newGame(kinds.map(kind => ({ kind, type: kind === SeatKind.Person ? people[p++] : left.splice(Math.floor(random() * left.length), 1)[0] })));
    enterPlay();
  }
  function enterPlay() {
    screen = Screen.Play; busy = false; queue = Promise.resolve();
    $('setup').style.display = 'none'; $('end').style.display = 'none'; $('hud').style.display = '';
    delete root.dataset.ready;
    root.dataset.board = g!.board.kind;
    (document.activeElement as HTMLElement | null)?.blur();
    scene.setGame(g!);
    const me = g!.seats.find(mine) ?? g!.seats[0];
    scene.faceHome(me.home);
    nextTurn();
  }
  function setup() {
    screen = Screen.Setup; clearTimeout(botTimer); turnEnds = 0;
    $('setup').style.display = 'flex'; $('end').style.display = 'none'; $('hud').style.display = 'none';
    delete root.dataset.ready;
    if (online() && lobby.isHost() && !net!.open) lobby.reopen(); // back in the waiting room, fresh countdown
    refreshSetup();
  }
  function gameOver() {
    screen = Screen.End; turnEnds = 0;
    const game = g!, title = document.createElement('b');
    const me = game.seats.find(mine), solo = me && (online() || persons() === 1); // one player on this device
    title.textContent = solo ? (me.place === 1 ? 'You win!' : `You finished ${PLACE[me.place! - 1]}`) : `${seatLabel(game.seats[game.order[0]])} wins!`;
    if (game.order[0] === me?.id || !me) sound.play('fanfare');
    const why = game.why === EndWhy.Stall ? `No creature reached home for ${STALL_ROUNDS} rounds` : game.why === EndWhy.Ended ? 'Game ended' : '';
    const list = document.createElement('ol');
    list.replaceChildren(...game.order.map(s => Object.assign(document.createElement('li'), { textContent: `${seatLabel(game.seats[s])} · ${inTarget(game, s)}/${PIECES} home` })));
    const button = (label: string, action: ResultAction, onClick: () => void) => {
      const b = document.createElement('button'); b.textContent = label; b.dataset.end = action; b.onclick = onClick; return b;
    };
    const buttons = online() ? [button('Back to room', ResultAction.Room, setup)]
      : [button('Play again', ResultAction.Again, startGame), button('Menu', ResultAction.Menu, setup)];
    $('endText').replaceChildren(title, ...(why ? [document.createElement('br'), why] : []), list, ...buttons);
    $('end').style.display = 'grid';
    if (online()) { runner = slots()[0]; saveRejoin(null); }
    refresh();
  }

  // --- online (research R5–R6): every device checks every move; the runner (first the host) moves computer seats ---
  let net: LobbyRoom<Look> | null = null, runner = -1, rows: SeatRow[] = [], types = new Map<number, CritterType>();
  let roomLevel: Difficulty = cfg.difficulty, rejoining = false, saved = readRejoin();
  const saveRejoin = (v: { code: string; key: string } | null) => { saved = v && { ...v, at: Date.now() }; writeRejoin(saved); };
  const online = () => mode === PlayerMode.Online && !!net;
  const iRun = () => online() && runner === net!.slot;
  const slots = () => net ? [net.slot, ...net.peers].sort((a, b) => a - b) : [];
  const send = (m: object) => lobby.send(m);
  const level = () => online() && !lobby.isHost() ? roomLevel : cfg.difficulty;
  const myType = () => online() ? types.get(net!.slot) : cfg.types[0];
  const sendTypes = () => { if (lobby.isHost()) send({ t: HopMsg.Types, types: [...types], level: cfg.difficulty }); };
  const showTypes = () => { for (const [slot, t] of types) lobby.setProfile(slot, { name: '', color: LOOKS[t].color }); };
  function pick(type: CritterType) {
    if (!net) return;
    if (lobby.isHost()) { if (takeType(types, net.slot, type)) { sendTypes(); showTypes(); } }
    else send({ t: HopMsg.Pick, type });
  }
  const lobby = createLobby<Look>({
    root, panel: $('online'), game: GameSlug.CritterHop, sizes: ROOM_SIZES, defaultSize: DEFAULT_ROOM_SIZE,
    countdownMs: COUNTDOWN_MS, botWord: 'computer players',
    roomInfo: host => host ? 'You are the host: pick the computer strength, start when ready' : 'Pick your type; the host starts',
    own: () => ({ name: '', color: myType() ? LOOKS[myType()!].color : '#888888' }), canShow: () => screen === Screen.Setup,
    rowTag: slot => types.get(slot) ?? 'no type yet',
    rejoin: () => saved && Date.now() - saved.at < REJOIN_MS ? saved : null,
    onHello: () => {
      net = lobby.room; runner = slots()[0];
      if (!net!.open) { rejoining = true; runner = -1; return saveRejoin({ code: net!.code, key: net!.key }); } // back into a game
      types = new Map();
      pick(cfg.types[0]);
      refreshSetup();
    },
    onPeers: joined => {
      const was = runner;
      runner = nextRunner(runner, slots());
      if (runner !== was) pending = false; // a move sent to the old runner is lost: move again
      if (lobby.isHost()) { for (const s of types.keys()) if (!slots().includes(s)) types.delete(s); sendTypes(); }
      if (screen === Screen.Setup || !g) return refreshSetup();
      if (joined !== undefined) return rejoined(joined);
      let restart = runner !== was && iRun(); // the new runner takes over the turn in progress (a computer's move, the clock)
      for (const s of g.seats) if (s.slot >= 0 && !slots().includes(s.slot)) { // dropped: a computer plays the seat (FR-016)
        flash(`${seatLabel(s)} left: a computer takes over`);
        s.kind = SeatKind.Computer; s.slot = -1;
        if (s.id === g.turn) restart = true;
      }
      if (restart && !busy && g.state === GameState.Playing) nextTurn(); else refresh();
    },
    onMessage: raw => {
      const m = parseMessage(raw);
      if (!m || !net) return;
      if (rejoining && m.t === HopMsg.Sync) runner = m.from; // whoever runs the game now
      const turnSlot = g && g.state === GameState.Playing ? g.seats[g.turn].slot : -1;
      if (allowedFrom(m, runner, slots()[0], turnSlot)) onNet(m);
    },
    onClosed: reason => {
      const room = net;
      net = null; runner = -1; rejoining = false;
      if (room && reason && screen === Screen.Play) saveRejoin({ code: room.code, key: room.key }); // dropped mid-game
      if (reason === NetText.NoRoom || reason === NetText.Closed || (reason === null && screen !== Screen.Play)) saveRejoin(null);
      if (mode === PlayerMode.Online && screen !== Screen.End) { g = null; setup(); }
    },
    onCountdownEnd: () => hostStart(), onDeactivate: () => { mode = PlayerMode.One; setup(); }, onChange: () => goButton(),
  });

  function onNet(m: Msg) {
    if (m.t === HopMsg.Pick && lobby.isHost() && screen === Screen.Setup) { if (takeType(types, m.from, m.type)) { sendTypes(); showTypes(); refreshSetup(); } else sendTypes(); }
    if (m.t === HopMsg.Types) { types = new Map(m.types); roomLevel = m.level; showTypes(); refreshSetup(); }
    if (m.t === HopMsg.Begin) { runner = m.from; seed = m.seed; rows = m.seats; begin(); }
    if (m.t === HopMsg.Sync && rejoining) {
      rejoining = false; seed = m.seed; rows = m.seats; g = fromSync(m); random = seeded(seed);
      enterPlay(); turnEnds = Date.now() + m.turn.left;
    }
    if (!g) return;
    if (m.t === HopMsg.Turn && m.seat === g.turn && !busy) turnEnds = Date.now() + m.left;
    if (m.t === HopMsg.Move && m.from === runner) enqueue(() => { const mv = g && findMove(g, m.seat, m.piece, m.path); if (mv) return play(mv); });
    else if (m.t === HopMsg.Move && iRun()) commit(m.seat, m); // a player's own move: the runner settles and sends it
  }
  /** The host starts the game (Start, or the waiting room's countdown ran out): seats from the room's picks. */
  function hostStart() {
    if (!lobby.isHost() || !net) return;
    lobby.lock(); runner = net.slot;
    seed = Math.floor(Math.random() * MAX_SEED);
    rows = roomSeats(values(CritterType), slots(), types, net.size, Math.random);
    send({ t: HopMsg.Begin, seed, seats: rows });
    begin();
  }
  /** Everyone builds the same game from the seats; players already gone are computers. */
  function begin() {
    g = newGame(seatSpecs(rows));
    for (const s of g.seats) if (s.slot >= 0 && !slots().includes(s.slot)) { s.kind = SeatKind.Computer; s.slot = -1; }
    random = seeded(seed);
    if (net) saveRejoin({ code: net.code, key: net.key }); // to come back if we drop
    enterPlay();
  }
  /** A player came back into the game: their seat is theirs again; the runner sends them the game so far. */
  function rejoined(slot: number) {
    const s = g!.seats.find(x => rows[x.id]?.[1] === slot);
    if (!s || g!.state !== GameState.Playing) return;
    s.kind = SeatKind.Person; s.slot = slot;
    flash(`${seatLabel(s)} is back`);
    if (iRun()) send(syncMsg(g!, seed, turnEnds ? Math.max(0, turnEnds - Date.now()) : TURN_MS, rows));
    if (s.id === g!.turn && !busy) nextTurn();
    refresh();
  }

  // --- the setup screen: mode, players, seats, type, strength, speed, timer ---
  const optRow = <T extends string>(id: string, labels: readonly T[], onPick: (label: T) => void) => labels.map(label => {
    const el = document.createElement('button'); el.className = 'opt'; el.textContent = label;
    el.onclick = () => onPick(label);
    $(id).append(el); return el;
  });
  /** Types other people already have (they can't be picked twice). */
  function takenTypes(): CritterType[] {
    if (online()) return [...types].filter(([slot]) => slot !== net!.slot).map(([, t]) => t);
    if (mode === PlayerMode.One) return [];
    return cfg.seats.slice(0, cfg.players).flatMap((k, i) => k === SeatKind.Person && i !== editSeat ? [cfg.types[i]] : []);
  }
  function typeCards() {
    const taken = takenTypes(), current = online() ? myType() : cfg.types[editSeat];
    $('cTypes').replaceChildren(...values(CritterType).map(t => {
      const look = LOOKS[t], b = document.createElement('button');
      b.className = 'type'; b.dataset.type = t;
      b.style.setProperty('--c', look.color);
      const name = document.createElement('b'), who = document.createElement('span'), vs = document.createElement('small');
      name.textContent = t; who.textContent = look.creature;
      vs.textContent = `Strong vs ${BEATS[t]} · Weak vs ${beatenBy(t)}`;
      b.append(name, who, vs);
      b.setAttribute('aria-pressed', String(t === current));
      b.disabled = taken.includes(t);
      if (b.disabled) b.title = 'Taken';
      b.onclick = () => {
        if (online()) { cfg.types[0] = t; save(); return pick(t); }
        cfg.types[editSeat] = t; refreshSetup();
      };
      return b;
    }));
  }
  function seatRows() {
    $('cSeats').replaceChildren(...cfg.seats.slice(0, cfg.players).map((kind, i) => {
      const li = document.createElement('li'), label = document.createElement('button'), toggle = document.createElement('button');
      label.className = 'opt'; label.textContent = `Seat ${i + 1}: ${kind === SeatKind.Person ? cfg.types[i] : 'random type'}`;
      label.classList.toggle('on', i === editSeat);
      label.disabled = kind !== SeatKind.Person;
      label.onclick = () => { editSeat = i; refreshSetup(); };
      toggle.className = 'opt kind'; toggle.textContent = kind; toggle.disabled = i === 0; // seat 1 is always a person
      toggle.setAttribute('aria-label', `Seat ${i + 1} kind: ${kind}`);
      toggle.onclick = () => {
        cfg.seats[i] = kind === SeatKind.Person ? SeatKind.Computer : SeatKind.Person;
        if (cfg.seats[i] === SeatKind.Person) { // a new person keeps their type unless another person has it
          editSeat = i;
          const taken = takenTypes();
          if (taken.includes(cfg.types[i])) cfg.types[i] = values(CritterType).find(t => !taken.includes(t))!;
        } else if (editSeat === i) editSeat = 0;
        refreshSetup();
      };
      li.append(label, toggle);
      return li;
    }));
  }
  function refreshSetup() {
    if (screen !== Screen.Setup) return;
    const on = (id: string, value: string) => [...$(id).children].forEach(x => x.classList.toggle('on', x.textContent === value));
    const isOnline = mode === PlayerMode.Online, guest = online() && !lobby.isHost();
    if (mode !== PlayerMode.Two) editSeat = 0;
    on('cMode', mode); on('cCount', String(cfg.players)); on('cLevel', guest ? roomLevel : cfg.difficulty); on('cSpeed', cfg.speed);
    for (const x of $('cLevel').children) (x as HTMLButtonElement).disabled = guest;
    $('countRow').style.display = isOnline ? 'none' : '';
    $('seatRow').style.display = mode === PlayerMode.Two ? '' : 'none';
    $('timerRow').style.display = isOnline ? 'none' : '';
    $<HTMLInputElement>('cTimer').checked = cfg.localTimer;
    $('pickFor').textContent = mode === PlayerMode.Two ? `Type for seat ${editSeat + 1}` : 'Your type';
    $('takenNote').textContent = isOnline && net && !myType() ? 'Pick a type (one nobody else has)' : '';
    $('keys').textContent = KEY_HELP;
    if (mode === PlayerMode.Two) seatRows();
    typeCards();
    save(); lobby.render(); // the popup and waiting room, then goButton()
    if (online() && lobby.isHost()) sendTypes();
  }
  function goButton() {
    const go = $<HTMLButtonElement>('go');
    go.disabled = mode === PlayerMode.Online && !(net && lobby.isHost());
    go.textContent = mode !== PlayerMode.Online ? 'Start' : net && !lobby.isHost() ? 'Waiting for host…' : 'Start';
    go.style.display = mode === PlayerMode.Online && !net ? 'none' : '';
  }
  optRow('cMode', MODES, m => { mode = m; editSeat = 0; lobby.setActive(m === PlayerMode.Online); setup(); });
  optRow('cCount', PLAYER_COUNTS.map(String), v => { cfg.players = Number(v); if (editSeat >= cfg.players) editSeat = 0; refreshSetup(); });
  optRow('cLevel', values(Difficulty), v => { cfg.difficulty = v; refreshSetup(); });
  optRow('cSpeed', values(HopSpeed), v => { cfg.speed = v; refreshSetup(); });
  $<HTMLInputElement>('cTimer').onchange = e => { cfg.localTimer = (e.target as HTMLInputElement).checked; save(); };
  $('go').onclick = startGame;
  $('hintBtn').onclick = () => { $('hintBtn').blur(); showHint(); }; // Enter then plays it, not the button again
  $('endBtn').onclick = () => { if (g && g.state === GameState.Playing && !busy) { endNow(g); gameOver(); } };
  $('menuBtn').onclick = () => { g = null; setup(); };
  $('mute').onclick = () => { cfg.muted = !cfg.muted; sound.setMuted(cfg.muted); save(); };

  // a join link: Online, and into that room once the first frame is drawn
  let pendingRoom = lobby.linkedRoom;
  if (pendingRoom) { mode = PlayerMode.Online; lobby.setActive(true); }
  setup();
  frame = requestAnimationFrame(loop);

  return () => {
    disposed = true;
    listening.abort();
    cancelAnimationFrame(frame);
    clearTimeout(botTimer); clearTimeout(flashTimer); clearTimeout(pendingTimer);
    lobby.dispose();
    sound.dispose();
    scene.dispose();
    if (viewport && siteViewport !== undefined) viewport.content = siteViewport;
    root.innerHTML = '';
    root.classList.remove('ch');
    for (const k of Object.keys(root.dataset)) delete root.dataset[k];
  };
}
