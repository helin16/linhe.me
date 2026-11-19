// Critter Chess (specs/013-creature-chess): the setup screen and type picker, turns, input (mouse, keyboard, touch), the
// promotion picker, resigning, computer turns, the online move clock, hints, the move list, the end screen, and online
// play. The rules live in rules.ts, computer players in bots.ts, the 3D view in scene.ts, online messages in
// messages.ts; mount() renders into `root` and returns a cleanup that leaves the page as it was.
import { values } from '../../shared/enum.ts';
import { ARROWS, nextSpot, type Spot } from '../../shared/cursor.ts';
import { PlayerMode } from '../../shared/modes.ts';
import { NetText } from '../../shared/online/client.ts';
import { createLobby, type LobbyRoom } from '../../shared/online/lobby.ts';
import { playerName, type Look } from '../../shared/online/roster.ts';
import { GameSlug } from '../index.ts';
import { botMove, hint } from './bots.ts';
import {
  BOT_DELAY_MS, COUNTDOWN_MS, DEFAULT_ROOM_SIZE, FAST_FACTOR, FLASH_MS, MAX_SEED, MOVE_MS, PENDING_MS, PLAYER_COUNTS, RECENT_MOVES,
  REJOIN_MS, ROOM_SIZES, SPOTS_S, TAP_PX, TURN_MS,
} from './constants.ts';
import { BoardKind, ChessMsg, CritterType, Difficulty, EndWhy, GameState, MoveSpeed, PieceKind, ResultAction, Screen, SeatKind, SeatState } from './enums.ts';
import { allowedFrom, fromSync, parseMessage, seatSpecs, syncMsg, type Msg, type SeatRow } from './messages.ts';
import { nextRunner, roomSeats, takeType } from '../../shared/online/seats.ts';
import { applyMove, findMove, inCheck, movesFrom, newGame, PROMOTIONS, resign, type Events, type Game, type Move, type Seat } from './rules.ts';
import { createScene, type RingKind } from './scene.ts';
import { gameSetup, seeded, type Random } from '../../shared/seed.ts';
import { loadSaved, saveSettings, uniqueTypes } from './settings.ts';
import { createSound } from './sound.ts';
import { LOOKS } from './types.ts';

const MARKUP = `
<canvas id="view" aria-label="The board"></canvas>
<div id="hud">
  <div id="bar"><span id="whoseTurn" role="status"></span><span id="timer" role="timer"></span>
    <button id="hintBtn">Hint</button><button id="resignBtn">Resign</button><button id="menuBtn">Menu</button>
    <button id="mute" aria-label="Sound on or off"></button></div>
  <ul id="seatList" aria-label="Player list"></ul>
  <ol id="moveList" aria-label="Recent moves"></ol>
  <div id="checkInfo" role="status"></div>
  <div id="msg" role="status"></div>
  <div id="status" aria-live="polite"></div>
  <div id="spots" aria-label="Moves"></div>
  <div id="promo" role="dialog" aria-label="Promote the pawn to"></div>
</div>
<div id="setup">
  <h1>Critter Chess</h1>
  <div>Mode<br><span id="cMode"></span></div>
  <div id="countRow">Players<br><span id="cCount"></span></div>
  <div id="seatRow">Seats <small>(tap a seat to pick its type)</small><ul id="cSeats"></ul></div>
  <div><span id="pickFor">Your type</span><div id="cTypes"></div></div>
  <div id="takenNote" role="status"></div>
  <div id="levelRow">Computer players<br><span id="cLevel"></span></div>
  <div>Move speed<br><span id="cSpeed"></span></div>
  <div id="online"></div>
  <div id="keys"></div>
  <button id="go">Start</button>
</div>
<div id="end"><div id="endText"></div></div>`;
const GAME_VIEWPORT = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
const MODES = [PlayerMode.One, PlayerMode.Two, PlayerMode.Online];
const MAX_FRAME_S = 0.25;
const REJOIN_KEY = 'cc-rejoin';
const KEY_HELP = 'Arrows: move the cursor · Enter: select / move · Esc: cancel · H: hint · Q/E: turn · +/−: zoom';
const PLACE = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
const FILES = 'abcdefghijklmn';
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
  root.classList.add('cc');
  root.innerHTML = MARKUP;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const canvas = $<HTMLCanvasElement>('view');

  const cfg = loadSaved();
  const save = () => saveSettings(cfg);
  const sound = createSound(cfg.muted);
  const scene = createScene(canvas);
  let mode: PlayerMode = PlayerMode.One, screen: Screen = Screen.Setup, editSeat = 0, disposed = false;

  // --- the game and whose turn it is ---
  let g: Game | null = null, random: Random = Math.random, seed = 0, recent: string[] = [], lastMove: Move | null = null;
  // pending: online, a move this device sent to the runner, not yet played back (the runner orders moves, research R6)
  let selected = -1, cursor = -1, hintMove: Move | null = null, turnEnds = 0, busy = false, pending = false, promoFor: Move[] | null = null;
  let botTimer: ReturnType<typeof setTimeout> | undefined, pendingTimer: ReturnType<typeof setTimeout> | undefined, flashTimer: ReturnType<typeof setTimeout> | undefined;
  let queue: Promise<void> = Promise.resolve();
  const persons = () => g ? g.seats.filter(s => s.kind === SeatKind.Person).length : 0;
  const pace = () => cfg.speed === MoveSpeed.Fast ? FAST_FACTOR : 1;
  const mine = (s: Seat) => s.kind === SeatKind.Person && (!online() || s.slot === net!.slot);
  /** Can this device move now? A person's turn here, nothing moving, no promotion being picked. */
  const canAct = () => !!g && screen === Screen.Play && g.state === GameState.Playing && !busy && !pending && !promoFor && mine(g.seats[g.turn]);
  function seatLabel(s: Seat) {
    if (s.kind === SeatKind.Computer) return `${s.type} (computer)`;
    if (online()) return s.slot === net?.slot ? `${s.type} (you)` : `${s.type} (${playerName('', s.slot)})`;
    return persons() === 1 ? `${s.type} (you)` : `${s.type} (Player ${g!.seats.filter(x => x.kind === SeatKind.Person).indexOf(s) + 1})`;
  }
  /** A cell's name: a1… on the square boards; on the hexagon, its distance from the middle and a direction-free number. */
  function cellName(cell: number) {
    const [a, b] = g!.board.cells[cell];
    return g!.board.kind === BoardKind.Hex ? `cell ${a},${b}` : `${FILES[a]}${b + 1}`;
  }
  const flash = (text: string) => {
    $('msg').textContent = text; clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { $('msg').textContent = ''; }, FLASH_MS);
  };
  /** Moves run one at a time, in the order they were made (online ones can arrive while one is still moving). */
  const enqueue = (job: () => Promise<void> | void) => {
    queue = queue.then(job).catch(e => { busy = false; pending = false; console.error(e); refresh(); }); // never stuck, never silent
  };

  /** A move decided here (a person's, a computer's when this device runs them, a timeout, or — on the runner — one a
   *  player sent): checked, then played. Online only the runner plays and sends moves, so every device sees one order. */
  function commit(seat: number, m: { at: number; to: number; promo?: PieceKind }, computer = false) {
    enqueue(() => {
      if (!g || g.turn !== seat || (computer && g.seats[seat].kind !== SeatKind.Computer)) return;
      const mv = findMove(g, seat, m.at, m.to, m.promo);
      if (!mv) return;
      const msg = { t: ChessMsg.Move, seat, at: mv.from, to: mv.to, ...(mv.promo ? { promo: mv.promo } : {}) };
      if (online() && !iRun()) { // the runner may drop it (the turn just timed out): unlock if it doesn't come back
        pending = true; send(msg); clearTimeout(pendingTimer);
        pendingTimer = setTimeout(() => { pending = false; refresh(); }, PENDING_MS);
        return refresh();
      }
      if (online()) send(msg);
      return play(mv);
    });
  }
  const asSent = (m: Move) => ({ at: m.from, to: m.to, promo: m.promo });
  /** Plays a legal move on this device: the rules first, then the animation, then the next turn. */
  async function play(m: Move) {
    const game = g!, p = game.pieces[m.piece], seat = game.seats[p.seat], kind = p.kind;
    const taken = m.capture >= 0 ? game.pieces[m.capture] : null, takenKind = taken?.kind;
    clearTimeout(botTimer); turnEnds = 0; selected = -1; hintMove = null; busy = true; pending = false;
    const ev = applyMove(game, m);
    moveCache.clear(); lastMove = m;
    recent = [`${seat.type} ${kind}${m.castle ? ' castles' : taken ? ` takes ${game.seats[taken.seat].type} ${takenKind}` : ''} to ${cellName(m.to)}${m.promo ? `, becomes a ${m.promo}` : ''}`, ...recent].slice(0, RECENT_MOVES);
    refresh();
    sound.play(taken ? 'take' : 'slide');
    await scene.animate(m, seat.type, MOVE_MS / pace(), kind === PieceKind.Knight);
    if (disposed || g !== game) return;
    busy = false;
    scene.sync(game);
    announce(game, ev);
    nextTurn();
  }
  /** Says who went out (mated, king taken, resigned) or was skipped (stalemate). */
  function announce(game: Game, ev: Events) {
    for (const s of ev.outs) flash(`${seatLabel(game.seats[s])} is out`);
    for (const s of ev.skipped) flash(`${seatLabel(game.seats[s])} can't move: turn skipped`);
    if (game.state === GameState.Playing && inCheck(game, game.turn)) sound.play('check');
  }
  function nextTurn() {
    clearTimeout(botTimer); hintMove = null; selected = -1; cursor = -1; promoFor = null;
    if (!g) return;
    if (g.state === GameState.Over) return gameOver();
    const s = g.seats[g.turn];
    root.dataset.turn = String(g.turn);
    turnEnds = online() ? Date.now() + TURN_MS : 0;
    if (iRun()) send({ t: ChessMsg.Turn, seat: g.turn, left: TURN_MS });
    if (s.kind === SeatKind.Computer && (!online() || iRun())) {
      const seat = g.turn;
      botTimer = setTimeout(() => { if (g) commit(seat, asSent(botMove(g, random, level())), true); }, BOT_DELAY_MS / pace());
    }
    if (s.kind === SeatKind.Person && !online() && persons() > 1) scene.faceSeat(s.id);
    refresh();
  }
  /** The move clock ran out (online): a simple move is played for the player (FR-014). */
  function timeUp() {
    if (!g || g.state !== GameState.Playing || busy) return; // a move in progress: the next turn sets its own clock
    turnEnds = 0;
    if (iRun()) commit(g.turn, asSent(hint(g)));
  }
  function resignHere() {
    if (!canAct()) return;
    const game = g!, seat = game.turn;
    enqueue(() => {
      const ev = resign(game, seat);
      moveCache.clear(); scene.sync(game);
      recent = [`${game.seats[seat].type} resigns`, ...recent].slice(0, RECENT_MOVES);
      announce(game, ev);
      nextTurn();
    });
  }

  // --- input: taps and clicks on the board, the keyboard, the move buttons, the promotion picker ---
  // each piece's legal moves, worked out once per position (a redraw asks for them many times); emptied whenever the
  // game changes (a move, a resignation, a new or synced game), so castling rights and en passant are never stale
  const moveCache = new Map<number, Move[]>();
  function movesOf(id: number) {
    if (!moveCache.has(id)) moveCache.set(id, movesFrom(g!, id));
    return moveCache.get(id)!;
  }
  /** The selected piece's destinations: each cell with its moves (several only when promoting). */
  function destinations() {
    const d = new Map<number, Move[]>();
    if (selected >= 0 && g) for (const m of movesOf(selected)) d.set(m.to, [...d.get(m.to) ?? [], m]);
    return d;
  }
  /** A cell chosen (by tap, click, Enter or a move button): select your piece, move it, or switch/clear. */
  function choose(cell: number) {
    if (!canAct() || cell < 0) return;
    const id = g!.at[cell], own = id >= 0 && g!.pieces[id].seat === g!.turn;
    hintMove = null;
    if (selected >= 0) {
      const ms = destinations().get(cell);
      if (ms?.length === 1) return commit(g!.turn, asSent(ms[0]));
      if (ms) return askPromotion(ms);
    }
    if (own && movesOf(id).length) { selected = selected === id ? -1 : id; sound.play('tap'); }
    else if (own) $('status').textContent = "That piece can't move";
    refresh();
  }
  /** A pawn reaching its promotion cell: the person picks what it becomes (FR-007). */
  function askPromotion(ms: Move[]) {
    promoFor = ms;
    const box = $('promo');
    const cancel = document.createElement('button'); cancel.textContent = 'Cancel'; cancel.className = 'cancel'; cancel.onclick = cancelPromotion;
    box.replaceChildren(...PROMOTIONS.map(kind => {
      const b = document.createElement('button'); b.textContent = kind; b.dataset.promo = kind;
      b.onclick = () => { const m = ms.find(x => x.promo === kind)!; promoFor = null; box.style.display = 'none'; commit(g!.turn, asSent(m)); };
      return b;
    }), cancel);
    box.style.display = 'flex';
    (box.firstElementChild as HTMLElement).focus();
    refresh();
  }
  /** Back out of the promotion picker: the pawn stays selected, nothing moves. */
  function cancelPromotion() { promoFor = null; $('promo').style.display = 'none'; refresh(); }
  const moveWord = (ms: Move[]) => ms[0].castle ? 'Castle' : ms[0].capture >= 0 ? `Take the ${g!.pieces[ms[0].capture].kind}` : 'Move';
  /** The cells a keyboard cursor or a move button can go to: your movable pieces, or where the selected one can go. */
  function candidates(dests = destinations()): number[] {
    if (!canAct()) return [];
    if (selected >= 0) return [...dests.keys(), g!.pieces[selected].cell];
    return g!.pieces.filter(p => p.seat === g!.turn && p.cell >= 0 && movesOf(p.id).length).map(p => p.cell);
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
    const r = canvas.getBoundingClientRect(), cell = scene.pick(e.clientX - r.left, e.clientY - r.top);
    if (hintMove && (cell === hintMove.from || cell === hintMove.to) && canAct()) return commit(g!.turn, asSent(hintMove));
    choose(cell);
  }, { signal });
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // browser shortcuts (zoom, tabs) are not game keys
    const tag = (e.target as HTMLElement).tagName;
    if (screen === Screen.Play && promoFor && e.code === 'Escape') return cancelPromotion();
    if (screen !== Screen.Play || tag === 'INPUT' || tag === 'SELECT' || (tag === 'BUTTON' && (e.code === 'Enter' || e.code === 'Space'))) return;
    if (e.code in TURN_KEYS) return scene.turn(TURN_KEYS[e.code]);
    if (e.code in ZOOM_KEYS) return scene.zoom(ZOOM_KEYS[e.code] > 0 ? 1 / scene.zoomStep : scene.zoomStep);
    if (!canAct()) return;
    if (e.code in ARROWS) {
      e.preventDefault();
      const spots: Spot[] = candidates().map(c => ({ id: c, ...scene.project(c) }));
      if (!spots.length) return;
      const here = spots.find(s => s.id === cursor);
      cursor = here ? nextSpot(here, spots, ARROWS[e.code]).id : spots[0].id;
      hintMove = null;
      return refresh();
    }
    if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); return hintMove ? commit(g!.turn, asSent(hintMove)) : choose(cursor); }
    if (e.code === 'Escape') { selected = -1; hintMove = null; cursor = -1; return refresh(); }
    if (e.code === 'KeyH') showHint();
  }, { signal });

  // --- drawing the state: rings, the bar, the player and move lists, the move buttons ---
  function refresh() {
    if (!g || screen === Screen.Setup) return;
    const rings: [number, RingKind][] = [], dests = destinations(), game = g; // one search for the whole redraw
    if (lastMove) rings.push([lastMove.from, 'last'], [lastMove.to, 'last']);
    for (const s of game.seats) if (s.state === SeatState.Playing && inCheck(game, s.id)) {
      const k = game.pieces.find(p => p.seat === s.id && p.kind === PieceKind.King && p.cell >= 0);
      if (k) rings.push([k.cell, 'check']);
    }
    if (selected >= 0) {
      rings.push([game.pieces[selected].cell, 'select']);
      for (const [cell, ms] of dests) rings.push([cell, ms[0].capture >= 0 ? 'capture' : 'reach']);
    }
    if (hintMove) rings.push([hintMove.from, 'hint'], [hintMove.to, 'hint']);
    if (cursor >= 0) rings.push([cursor, 'cursor']);
    scene.setRings(rings);
    const s = game.seats[game.turn], playing = game.state === GameState.Playing;
    const who = $('whoseTurn');
    who.textContent = playing ? (mine(s) && (persons() === 1 || online()) ? 'Your turn' : `${seatLabel(s)}'s turn`) : 'Game over';
    who.style.color = LOOKS[s.type].color;
    $('checkInfo').textContent = playing && inCheck(game, game.turn) ? `Check! ${seatLabel(s)} must get out of check` : '';
    $('hintBtn').style.display = canAct() ? '' : 'none';
    $('resignBtn').style.display = canAct() && !online() ? '' : 'none';
    $('menuBtn').style.display = online() ? 'none' : '';
    $('promo').style.display = promoFor ? 'flex' : 'none';
    $('seatList').replaceChildren(...game.seats.map(x => {
      const li = document.createElement('li'), dot = document.createElement('i'), text = document.createElement('span');
      dot.className = 'dot'; dot.style.background = LOOKS[x.type].color;
      text.textContent = `${seatLabel(x)}${x.state === SeatState.Out ? ` · out (${PLACE[x.place! - 1]})` : x.place ? ` · ${PLACE[x.place - 1]}` : ''}`; // text, never markup
      li.append(dot, text); li.classList.toggle('now', x.id === game.turn && playing); li.classList.toggle('gone', x.state === SeatState.Out);
      return li;
    }));
    $('moveList').replaceChildren(...recent.map(t => Object.assign(document.createElement('li'), { textContent: t })));
    if (canAct() && cursor >= 0) {
      const id = game.at[cursor], ms = dests.get(cursor);
      $('status').textContent = ms ? `${moveWord(ms)} to ${cellName(cursor)}`
        : id >= 0 ? `${s.type} ${game.pieces[id].kind} on ${cellName(cursor)}: ${movesOf(id).length} moves` : '';
    } else if (!canAct()) $('status').textContent = '';
    // a button per move or piece (for screen readers, and the same choices as tapping the board)
    $('spots').replaceChildren(...candidates(dests).map(cell => {
      const b = document.createElement('button'), ms = dests.get(cell), id = game.at[cell];
      b.dataset.cell = String(cell);
      b.textContent = ms ? `${moveWord(ms)} to ${cellName(cell)}` : `${s.type} ${game.pieces[id].kind} on ${cellName(cell)}`;
      b.onclick = () => choose(cell);
      return b;
    }));
    placeSpots();
  }
  /** Keeps each move button's screen position (data-x / data-y) up to date as the camera moves. */
  function placeSpots() {
    for (const b of $('spots').children as HTMLCollectionOf<HTMLElement>) {
      const p = scene.project(Number(b.dataset.cell));
      b.dataset.x = String(Math.round(p.x)); b.dataset.y = String(Math.round(p.y));
    }
  }
  let shownTime = '';
  function hud() {
    const time = turnEnds ? String(Math.max(0, Math.ceil((turnEnds - Date.now()) / 1000))) : '';
    if (time !== shownTime) { shownTime = time; $('timer').textContent = time; } // once a second, not every frame
    if (turnEnds && Date.now() >= turnEnds) timeUp();
  }
  const showMute = () => { $('mute').textContent = cfg.muted ? '🔇' : '🔊'; };

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
    screen = Screen.Play; busy = false; queue = Promise.resolve(); recent = []; lastMove = null; promoFor = null; moveCache.clear();
    $('setup').style.display = 'none'; $('end').style.display = 'none'; $('hud').style.display = '';
    delete root.dataset.ready;
    root.dataset.board = g!.board.kind;
    (document.activeElement as HTMLElement | null)?.blur();
    scene.setGame(g!);
    scene.faceSeat((g!.seats.find(mine) ?? g!.seats[0]).id);
    nextTurn();
  }
  function setup() {
    screen = Screen.Setup; clearTimeout(botTimer); turnEnds = 0; promoFor = null;
    $('setup').style.display = 'flex'; $('end').style.display = 'none'; $('hud').style.display = 'none';
    delete root.dataset.ready;
    if (online() && lobby.isHost() && !net!.open) lobby.reopen(); // back in the waiting room, fresh countdown
    refreshSetup();
  }
  function gameOver() {
    screen = Screen.End; turnEnds = 0;
    const game = g!, title = document.createElement('b');
    const me = game.seats.find(s => mine(s) || (s.state === SeatState.Out && (online() ? s.slot === net?.slot : persons() === 1 && s.id === 0)));
    const solo = me && (online() || persons() <= 1), winners = game.seats.filter(s => s.place === 1);
    const draw = winners.length > 1;
    title.textContent = draw ? 'Draw' : solo ? (me.place === 1 ? 'You win!' : `You finished ${PLACE[me.place! - 1]}`) : `${seatLabel(winners[0])} wins!`;
    if (!draw && (!solo || me?.place === 1)) sound.play('fanfare');
    const why = { [EndWhy.Mate]: 'Checkmate', [EndWhy.Draw]: 'A draw (stalemate, repetition, the 50-move rule or not enough to mate)',
      [EndWhy.LastStanding]: 'Last king standing', [EndWhy.NoProgress]: 'No way left to win: those still in share first place' }[game.why!];
    const list = document.createElement('ol');
    list.replaceChildren(...game.order.map(s => Object.assign(document.createElement('li'), { textContent: `${PLACE[game.seats[s].place! - 1]}: ${seatLabel(game.seats[s])}` })));
    const button = (label: string, action: ResultAction, onClick: () => void) => {
      const b = document.createElement('button'); b.textContent = label; b.dataset.end = action; b.onclick = onClick; return b;
    };
    const buttons = online() ? [button('Back to room', ResultAction.Room, setup)]
      : [button('Play again', ResultAction.Again, startGame), button('Menu', ResultAction.Menu, setup)];
    $('endText').replaceChildren(title, document.createElement('br'), why, list, ...buttons);
    $('end').style.display = 'grid';
    if (online()) { runner = slots()[0]; saveRejoin(null); }
    refresh();
  }

  // --- online (research R6): the runner (first the host) orders every move and plays computer seats ---
  let net: LobbyRoom<Look> | null = null, runner = -1, rows: SeatRow[] = [], types = new Map<number, CritterType>();
  let roomLevel: Difficulty = cfg.difficulty, rejoining = false, saved = readRejoin();
  const saveRejoin = (v: { code: string; key: string } | null) => { saved = v && { ...v, at: Date.now() }; writeRejoin(saved); };
  const online = () => mode === PlayerMode.Online && !!net;
  const iRun = () => online() && runner === net!.slot;
  const slots = () => net ? [net.slot, ...net.peers].sort((a, b) => a - b) : [];
  const send = (m: object) => lobby.send(m);
  const level = () => online() && !lobby.isHost() ? roomLevel : cfg.difficulty;
  const myType = () => online() ? types.get(net!.slot) : cfg.types[0];
  const sendTypes = () => { if (lobby.isHost()) send({ t: ChessMsg.Types, types: [...types], level: cfg.difficulty }); };
  const showTypes = () => { for (const [slot, t] of types) lobby.setProfile(slot, { name: '', color: LOOKS[t].color }); };
  function pick(type: CritterType) {
    if (!net) return;
    if (lobby.isHost()) { if (takeType(types, net.slot, type)) { sendTypes(); showTypes(); } }
    else send({ t: ChessMsg.Pick, type });
  }
  const lobby = createLobby<Look>({
    root, panel: $('online'), game: GameSlug.CritterChess, sizes: ROOM_SIZES, defaultSize: DEFAULT_ROOM_SIZE,
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
      let restart = runner !== was && iRun(); // the new runner takes over the turn in progress
      for (const s of g.seats) if (s.slot >= 0 && !slots().includes(s.slot)) { // dropped: a computer plays the seat (FR-014)
        flash(`${seatLabel(s)} left: a computer takes over`);
        s.kind = SeatKind.Computer; s.slot = -1;
        if (s.id === g.turn) restart = true;
      }
      if (restart && !busy && g.state === GameState.Playing) nextTurn(); else refresh();
    },
    onMessage: raw => {
      const m = parseMessage(raw);
      if (!m || !net) return;
      if (rejoining && m.t === ChessMsg.Sync) runner = m.from; // whoever runs the game now
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
    if (m.t === ChessMsg.Pick && lobby.isHost() && screen === Screen.Setup) { if (takeType(types, m.from, m.type)) { sendTypes(); showTypes(); refreshSetup(); } else sendTypes(); }
    if (m.t === ChessMsg.Types) { types = new Map(m.types); roomLevel = m.level; showTypes(); refreshSetup(); }
    if (m.t === ChessMsg.Begin) { runner = m.from; seed = m.seed; rows = m.seats; begin(); }
    if (m.t === ChessMsg.Sync && rejoining) {
      rejoining = false; seed = m.seed; rows = m.seats; g = fromSync(m); random = seeded(seed);
      enterPlay(); turnEnds = Date.now() + m.left;
    }
    if (!g) return;
    if (m.t === ChessMsg.Turn && m.seat === g.turn && !busy) turnEnds = Date.now() + m.left;
    if (m.t === ChessMsg.Move && m.from === runner) enqueue(() => { const mv = g && findMove(g, m.seat, m.at, m.to, m.promo); if (mv) return play(mv); });
    else if (m.t === ChessMsg.Move && iRun()) commit(m.seat, m); // a player's own move: the runner settles and sends it
  }
  /** The host starts the game (Start, or the waiting room's countdown ran out): seats from the room's picks. */
  function hostStart() {
    if (!lobby.isHost() || !net) return;
    lobby.lock(); runner = net.slot;
    seed = Math.floor(Math.random() * MAX_SEED);
    rows = roomSeats(values(CritterType), slots(), types, net.size, Math.random);
    send({ t: ChessMsg.Begin, seed, seats: rows });
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
    if (!s || g!.state !== GameState.Playing || s.state === SeatState.Out) return;
    s.kind = SeatKind.Person; s.slot = slot;
    flash(`${seatLabel(s)} is back`);
    if (iRun()) send(syncMsg(g!, seed, turnEnds ? Math.max(0, turnEnds - Date.now()) : TURN_MS, rows));
    if (s.id === g!.turn && !busy) nextTurn();
    refresh();
  }

  // --- the setup screen: mode, players, seats, type, strength, speed ---
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
      const b = document.createElement('button');
      b.className = 'type'; b.dataset.type = t;
      b.style.setProperty('--c', LOOKS[t].color);
      const name = document.createElement('b'), army = document.createElement('small');
      name.textContent = t; army.textContent = `${t} creatures as King, Queen, Rook, Bishop, Knight and Pawns`;
      b.append(name, army);
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
  optRow('cSpeed', values(MoveSpeed), v => { cfg.speed = v; refreshSetup(); });
  $('go').onclick = startGame;
  $('hintBtn').onclick = () => { $('hintBtn').blur(); showHint(); }; // Enter then plays it, not the button again
  $('resignBtn').onclick = () => { $('resignBtn').blur(); resignHere(); };
  $('menuBtn').onclick = () => { g = null; setup(); };
  $('mute').onclick = () => { cfg.muted = !cfg.muted; sound.setMuted(cfg.muted); save(); showMute(); };
  showMute();

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
    root.classList.remove('cc');
    for (const k of Object.keys(root.dataset)) delete root.dataset[k];
  };
}
