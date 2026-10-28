// Snake Duel (specs/006-snake-duel): the garage, the game loop, input, drawing and the HUD. The rules live in sim.ts,
// the computer snakes in bots.ts; mount() renders into `root` and returns a cleanup that leaves the page as it was.
import { values } from '../../shared/enum.ts';
import { PlayerMode } from '../../shared/modes.ts';
import { driveBots, fillBots } from './bots.ts';
import {
  BOOST_SPEED, COUNTDOWN_S, DEFAULT_ROOM_SIZE, LOBBY_COUNTDOWN_MS, NET_HZ, ORB_TARGET, ROOM_SIZES, SPEED, STEP_HZ,
} from './constants.ts';
import { Difficulty, MatchState, MatchType, ResultAction, Screen, SnakeEyes, SnakeMsg, SnakePattern, SnakeTab } from './enums.ts';
import { drawArena, drawMinimap, drawPreview, MINI_SIZE, viewFor } from './draw.ts';
import { gameSetup, type Random } from './seed.ts';
import { defaults, distinctColors, loadSaved, saveSettings, type SnakeLook } from './settings.ts';
import { createLobby, type LobbyRoom } from '../../shared/online/lobby.ts';
import { GameSlug } from '../index.ts';
import {
  addOrbs, allowedFrom, applySnap, bumpId, coast, encodeBegin, encodeSnaps, nextRunner, orbChunks, parseMessage, type Msg,
} from './messages.ts';
import { playerName } from '../../shared/online/roster.ts';
import {
  addSnake, createArena, createMatch, knockOut, leadOrbs, nextRound, playerStarts, segments, step, topUp, updateMatch,
  type Arena, type Events, type Input, type Match, type MatchEvent, type Snake,
} from './sim.ts';

const MARKUP = `
<canvas id="view"></canvas>
<canvas id="mini" width="${MINI_SIZE}" height="${MINI_SIZE}" aria-hidden="true"></canvas>
<div id="hud">
  <div class="len" id="len"></div><div class="len" id="len2"></div><div id="score"></div><div id="timer" role="timer"></div><div id="alive"></div>
  <div id="msg" role="status"></div>
  <div class="pad"><div class="stick" aria-label="Steer"><i></i></div><button class="boost" aria-label="Boost">BOOST</button></div>
  <div class="pad"><div class="stick" aria-label="Steer player 2"><i></i></div><button class="boost" aria-label="Boost player 2">BOOST</button></div>
</div>
<div id="setup">
  <h1>Snake Duel</h1>
  <div>Players<br><span id="cPlayers"></span></div>
  <div id="editRow">Customise<br><span id="cEdit"></span></div>
  <label>Name <input type="text" id="cName" maxlength="10"></label>
  <label>Colour <input type="color" id="cColor"></label>
  <label>Accent <input type="color" id="cAccent"></label>
  <div>Pattern<br><span id="cPattern"></span></div>
  <div>Eyes<br><span id="cEyes"></span></div>
  <canvas id="preview" width="260" height="80" aria-label="Preview"></canvas>
  <div id="colorNote" role="status"></div>
  <div id="matchRow">Match<br><span id="cMatch"></span></div>
  <div>Computer snakes<br><span id="cLevel"></span></div>
  <div id="best"></div>
  <div id="online"></div>
  <div id="keys"></div>
  <button id="go">Start</button>
</div>
<div id="end"><div id="endText"></div></div>`;
const GAME_VIEWPORT = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
const MAX_FRAME_S = 0.25;      // a long frame (tab switch) runs at most this much game time
const BETWEEN_S = 2;           // the round result shows this long before the next round
const GO_S = 0.6;              // "GO!" shows this long
const SNAP_STEPS = STEP_HZ / NET_HZ; // the runner sends a snapshot every 3 steps
const CLOCK_STEPS = STEP_HZ;   // and the Quick match clock once a second
const SEND_GAP_MS = 200;       // looks and match picks: at most 5 a second
const STICK_DEAD = 8;          // pixels of stick movement before it steers
// keys per player: 1 Player can use either set; in 2 Players player 1 has WASD and player 2 the arrows
const KEYS = [
  { left: ['KeyA'], right: ['KeyD'], boost: ['KeyW'] },
  { left: ['ArrowLeft'], right: ['ArrowRight'], boost: ['ArrowUp'] },
];
const SOLO_BOOST = ['Space'];
const KEY_HELP = { [PlayerMode.One]: 'Mouse to steer, hold to boost · or ←/→ (A/D) to turn, ↑/W/Space to boost',
  [PlayerMode.Two]: 'P1: A/D turn, W boost · P2: ←/→ turn, ↑ boost', [PlayerMode.Online]: 'Mouse, keys or touch to steer · hold to boost' };

export function mount(root: HTMLElement): () => void {
  const listening = new AbortController(), signal = listening.signal;
  const viewport = document.querySelector<HTMLMetaElement>('meta[name=viewport]');
  const siteViewport = viewport?.content;
  if (viewport) viewport.content = GAME_VIEWPORT;
  root.classList.add('sd');
  root.innerHTML = MARKUP;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const isTouch = navigator.maxTouchPoints > 0;
  root.classList.toggle('touch', isTouch);

  const cfg = loadSaved();
  const save = () => saveSettings(cfg);
  let mode: PlayerMode = PlayerMode.One, edit = 0, screen: Screen = Screen.Garage;

  // --- the arena and the players' snakes ---
  let arena: Arena = createArena(Math.random), random: Random = Math.random, stillBots = false;
  let players: Snake[] = [], botMemory = new Map<number, Input>(), stepNo = 0, paused = false;
  let match: Match | null = null, countdown = 0, between = 0, banner = '';
  const localPlayers = () => mode === PlayerMode.Two ? 2 : 1;

  // --- online (research R4): one device, the runner (first the host), runs the arena for everyone ---
  let net: LobbyRoom<SnakeLook> | null = null, runner = -1, picks = { type: cfg.match, level: cfg.difficulty }, startedWith = 0;
  let remote = new Map<number, Input>(), pending: Events = { eaten: [], added: [], out: [] }, sendT = 0;
  const playing = () => screen !== Screen.Garage;
  const online = () => mode === PlayerMode.Online && !!net;
  const iRun = () => online() && runner === net!.slot;
  const slots = () => net ? [net.slot, ...net.peers].sort((a, b) => a - b) : [];
  const send = (m: object) => lobby.send(m);
  const lookOf = (slot: number): SnakeLook => slot === net?.slot ? cfg.players[0] : net?.profiles[slot] ?? { ...defaults().players[0], name: '' };
  const lobby = createLobby<SnakeLook>({
    root, panel: $('online'), game: GameSlug.SnakeDuel, sizes: ROOM_SIZES, defaultSize: DEFAULT_ROOM_SIZE,
    countdownMs: LOBBY_COUNTDOWN_MS, botWord: 'computer snakes',
    roomInfo: host => host ? 'You are the host: pick the match, start when ready' : 'The host picks the match and starts',
    own: () => cfg.players[0], canShow: () => screen === Screen.Garage,
    onHello: () => { net = lobby.room; runner = slots()[0]; sendLook(true); refreshGarage(); },
    onPeers: joined => {
      if (joined !== undefined) { sendLook(true); if (lobby.isHost()) sendMode(true); }
      runner = nextRunner(runner, slots());
      if (iRun() && playing()) for (const s of arena.snakes) if (s.slot !== null && s.alive && !slots().includes(s.slot)) knockOut(arena, s, pending);
    },
    onMessage: raw => { const m = parseMessage(raw); if (m && net && allowedFrom(m, runner, slots()[0])) onNet(m); },
    onClosed: () => { net = null; runner = -1; if (mode === PlayerMode.Online) garage(); },
    onCountdownEnd: () => hostStart(), onDeactivate: () => { mode = PlayerMode.One; garage(); }, onChange: () => garageInfo(),
  });
  // looks and match picks go out only when they change, at most every SEND_GAP_MS (a colour drag fires many inputs;
  // the relay allows 40 messages a second)
  const lastSent = new Map<string, string>(), sendLater = new Map<string, ReturnType<typeof setTimeout>>();
  function sendChanged(m: { t: string }) {
    const key = JSON.stringify(m);
    if (lastSent.get(m.t) === key || sendLater.has(m.t)) return;
    sendLater.set(m.t, setTimeout(() => { sendLater.delete(m.t); const now = JSON.stringify(latest(m.t)); if (lastSent.get(m.t) !== now) { lastSent.set(m.t, now); send(JSON.parse(now)); } }, SEND_GAP_MS));
  }
  const latest = (t: string) => t === SnakeMsg.Look ? {t, p: cfg.players[0]} : {t, type: cfg.match, level: cfg.difficulty};
  const sendLook = (now = false) => now ? (lastSent.set(SnakeMsg.Look, JSON.stringify(latest(SnakeMsg.Look))), send(latest(SnakeMsg.Look))) : sendChanged(latest(SnakeMsg.Look));
  const sendMode = (now = false) => now ? (lastSent.set(SnakeMsg.Mode, JSON.stringify(latest(SnakeMsg.Mode))), send(latest(SnakeMsg.Mode))) : sendChanged(latest(SnakeMsg.Mode));
  function onNet(m: Msg) {
    if (m.t === SnakeMsg.Look) {
      lobby.setProfile(m.from, m.p);
      for (const s of arena.snakes) if (s.slot === m.from) s.look = m.p;
    }
    if (m.t === SnakeMsg.Input && iRun()) {
      const s = arena.snakes.find(x => x.slot === m.from);
      if (s) remote.set(s.id, {target: m.h, turn: m.r, boost: m.b});
    }
    if (m.t === SnakeMsg.Mode) { picks = {type: m.type, level: m.level}; refreshGarage(); }
    if (m.t === SnakeMsg.Orbs) {
      if (m.first) arena.orbs.clear();
      addOrbs(arena, m.o);
    }
    if (m.t === SnakeMsg.Begin) { runner = m.from; guestBegin(m); }
    if (m.t === SnakeMsg.Snap && !iRun()) applySnap(arena, m);
    if (m.t === SnakeMsg.Round && match) {
      match.wins = new Map(m.wins); match.state = MatchState.RoundOver;
      banner = m.winner === null ? 'Draw' : `${nameOf(m.winner)} wins the round`; between = BETWEEN_S;
    }
    if (m.t === SnakeMsg.Clock && match) match.timeLeft = m.left;
    if (m.t === SnakeMsg.Match) matchOver(m.winner);
    if (m.t === SnakeMsg.Hand) { runner = nextRunner(runner, slots(), m); if (iRun()) botMemory = new Map(); }
  }
  /** The host starts a match (Start, or the waiting room's countdown ran out). */
  function hostStart() {
    if (!lobby.isHost()) return;
    lobby.lock(); sendMode(true); runner = net!.slot;
    match = createMatch(cfg.match, slots()); startedWith = slots().length;
    begin();
  }
  /** The runner starts a round: a fresh arena, sent to everyone. */
  function begin() {
    newGame();
    send(encodeBegin(arena, match!.type, match!.round));
    for (const chunk of orbChunks(arena)) send(chunk);
    enterPlay();
  }
  function guestBegin(m: Extract<Msg, { t: typeof SnakeMsg.Begin }>) {
    if (!match || m.round === 1) { match = createMatch(m.type, slots()); startedWith = m.snakes.filter(x => x[1] >= 0).length; }
    match.round = m.round; match.state = MatchState.Playing;
    arena = createArena(Math.random);
    for (const [id, slot, x, y, heading, mass, look] of m.snakes) {
      const s = addSnake(arena, slot < 0 ? null : slot, slot === net?.slot ? cfg.players[0] : look, {x, y, heading});
      s.id = id; s.mass = mass; bumpId(arena, id);
    }
    players = arena.snakes.filter(s => s.slot === net?.slot);
    enterPlay();
  }

  function newGame() {
    botMemory = new Map(); stepNo = 0; remote = new Map(); pending = { eaten: [], added: [], out: [] };
    if (online()) { // every player in the room, around a ring, plus computer snakes
      ({random} = gameSetup(location.href, true)); stillBots = false;
      arena = createArena(random);
      const room = slots(), starts = playerStarts(room.length);
      room.forEach((slot, i) => { addSnake(arena, slot, lookOf(slot), starts[i]); leadOrbs(arena, starts[i]); });
      players = arena.snakes.filter(s => s.slot === net!.slot);
    } else {
      ({random, stillBots} = gameSetup(location.href, false));
      arena = createArena(random);
      const starts = playerStarts(localPlayers());
      players = starts.map((at, n) => { const s = addSnake(arena, n, cfg.players[n], at); leadOrbs(arena, at); return s; });
    }
    fillBots(arena, stillBots);
    while (arena.orbs.size < ORB_TARGET) topUp(arena);
  }

  // --- input: keys, mouse (1 Player) and touch sticks ---
  const keys = new Set<string>();
  let mouse: { target: number; boost: boolean } | null = null;
  const sticks: ({ target: number } | null)[] = [null, null], boosts = [false, false];
  addEventListener('keydown', e => {
    if (['INPUT', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    keys.add(e.code); mouse = mouse && { ...mouse, boost: false };
    if (e.code.startsWith('Arrow') || ['KeyA', 'KeyD'].includes(e.code)) mouse = null; // keys take over steering
  }, {signal});
  addEventListener('keyup', e => keys.delete(e.code), {signal});
  const view = $<HTMLCanvasElement>('view'), ctx = view.getContext('2d')!;
  view.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || mode !== PlayerMode.One && mode !== PlayerMode.Online) return;
    const r = view.getBoundingClientRect();
    mouse = { target: Math.atan2(e.clientY - r.top - r.height / 2, e.clientX - r.left - r.width / 2), boost: mouse?.boost ?? false };
  }, {signal});
  view.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && mouse) mouse.boost = true; }, {signal});
  addEventListener('pointerup', e => { if (e.pointerType === 'mouse' && mouse) mouse.boost = false; }, {signal});
  root.querySelectorAll<HTMLElement>('.pad').forEach((pad, n) => {
    const stick = pad.querySelector<HTMLElement>('.stick')!, knob = stick.firstElementChild as HTMLElement;
    const aim = (e: PointerEvent) => {
      const r = stick.getBoundingClientRect(), dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
      knob.style.transform = `translate(${Math.max(-r.width / 3, Math.min(r.width / 3, dx))}px, ${Math.max(-r.height / 3, Math.min(r.height / 3, dy))}px)`;
      if (Math.hypot(dx, dy) > STICK_DEAD) sticks[n] = { target: Math.atan2(dy, dx) };
    };
    stick.onpointerdown = e => { stick.setPointerCapture(e.pointerId); aim(e); };
    stick.onpointermove = e => stick.hasPointerCapture(e.pointerId) && aim(e);
    stick.onpointerup = stick.onpointercancel = () => { sticks[n] = null; knob.style.transform = ''; };
    const boost = pad.querySelector<HTMLElement>('.boost')!;
    boost.onpointerdown = e => { e.preventDefault(); boosts[n] = true; boost.classList.add('on'); };
    boost.onpointerup = boost.onpointercancel = () => { boosts[n] = false; boost.classList.remove('on'); };
  });
  function playerInput(n: number): Input {
    const k = KEYS[n], solo = localPlayers() === 1, any = (codes: string[]) => codes.some(c => keys.has(c));
    const set = solo ? { left: [...KEYS[0].left, ...KEYS[1].left], right: [...KEYS[0].right, ...KEYS[1].right], boost: [...KEYS[0].boost, ...KEYS[1].boost, ...SOLO_BOOST] } : k;
    const boost = any(set.boost) || boosts[n] || (solo && !!mouse?.boost);
    if (sticks[n]) return { target: sticks[n]!.target, boost };
    if (solo && mouse) return { target: mouse.target, boost };
    return { turn: +any(set.right) - +any(set.left), boost };
  }

  // --- the loop: fixed steps, drawn every frame ---
  function tick() {
    const level = online() && !lobby.isHost() ? picks.level : cfg.difficulty; // the host's own pick, or the one it sent
    const all = new Map([...driveBots(arena, level, random, stepNo++, botMemory), ...remote]);
    players.forEach((s, n) => { if (s.alive) all.set(s.id, playerInput(n)); });
    const ev = step(arena, all, 1 / STEP_HZ);
    pending.eaten.push(...ev.eaten); pending.added.push(...ev.added); pending.out.push(...ev.out);
    fillBots(arena, stillBots);
    if (mode === PlayerMode.One && !players[0].alive) return soloOver();
    if (!match) return;
    if (online()) {
      if (stepNo % SNAP_STEPS === 0) { for (const m of encodeSnaps(arena, pending)) send(m); pending = { eaten: [], added: [], out: [] }; }
      if (match.type === MatchType.Quick && stepNo % CLOCK_STEPS === 0) send({t: SnakeMsg.Clock, left: match.timeLeft});
      if (startedWith > 1 && slots().length === 1) { send({t: SnakeMsg.Match, winner: net!.slot}); return matchOver(net!.slot, 'Everyone else left'); }
    }
    matchEvent(updateMatch(match, arena, 1000 / STEP_HZ));
  }
  const nameOf = (slot: number | null) => slot === null ? '' : playerName(online() ? lookOf(slot).name : cfg.players[slot]?.name, slot);
  function matchEvent(e: MatchEvent) {
    if (!e) return;
    if (online()) send(e.over === MatchState.RoundOver ? {t: SnakeMsg.Round, winner: e.winner, wins: [...match!.wins]} : {t: SnakeMsg.Match, winner: e.winner});
    if (e.over === MatchState.RoundOver) { banner = e.winner === null ? 'Draw' : `${nameOf(e.winner)} wins the round`; between = BETWEEN_S; return; }
    matchOver(e.winner);
  }
  function matchOver(winner: number | null, title?: string) {
    if (online()) runner = slots()[0]; // the next match starts with the host running it, whoever ran this one
    showEnd(title ?? (winner === null ? "It's a draw" : `${nameOf(winner)} wins!`), ...(match!.type === MatchType.Deathmatch ? [scoreLine()] : []));
  }
  const scoreLine = () => match ? [...match.wins].map(([slot, n]) => `${nameOf(slot)} ${n}`).join(' – ') : '';
  const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
  let acc = 0, last = performance.now(), frame = 0;
  const mini = $<HTMLCanvasElement>('mini').getContext('2d')!;
  function draw() {
    const dpr = Math.min(devicePixelRatio, 2), w = Math.round(view.clientWidth * dpr), h = Math.round(view.clientHeight * dpr);
    if (view.width !== w || view.height !== h) { view.width = w; view.height = h; }
    if (screen === Screen.Garage) { drawArena(ctx, viewFor(undefined, 0, 0, w, h), arena, undefined, false); return; }
    const n = players.length, portrait = h > w;
    const leader = () => arena.snakes.filter(x => x.alive && x.slot !== null).sort((a, b) => b.mass - a.mass)[0];
    players.forEach((s, i) => {
      const [vw, vh] = n === 1 ? [w, h] : portrait ? [w, h / 2] : [w / 2, h];
      const follow = online() && !s.alive ? leader() ?? s : s; // out online: watch the leader until the round ends
      drawArena(ctx, viewFor(follow, portrait ? 0 : i * vw, portrait ? i * vh : 0, vw, vh), arena, s);
    });
    drawMinimap(mini, arena, players[0]);
  }
  function hud() {
    $('hud').style.display = screen === Screen.Garage ? 'none' : '';
    $('mini').style.display = screen === Screen.Garage ? 'none' : '';
    players.forEach((s, i) => { $(i ? 'len2' : 'len').textContent = `${players.length > 1 ? `P${i + 1} · ` : ''}Length ${segments(s)}`; });
    $('len2').style.display = players.length > 1 ? '' : 'none';
    root.classList.toggle('two', players.length > 1);
    root.classList.toggle('portrait', view.clientHeight > view.clientWidth);
    $('score').textContent = match?.type === MatchType.Deathmatch ? scoreLine() : '';
    $('timer').textContent = match?.type === MatchType.Quick ? clock(match.timeLeft) : '';
    $('alive').textContent = online() && match ? `${arena.snakes.filter(x => x.alive && x.slot !== null).length} players in` : '';
    $('msg').textContent = countdown > 0 ? String(Math.ceil(countdown)) : countdown > -GO_S ? 'GO!' : between > 0 ? banner : '';
  }
  function loop(now: number) {
    const dt = Math.min(MAX_FRAME_S, (now - last) / 1000); last = now;
    if (screen === Screen.Play && !(paused && !online())) {
      const runs = !online() || iRun();
      if (between > 0 && (between -= dt) <= 0 && runs) { nextRound(match!); if (online()) begin(); else { newGame(); countdown = COUNTDOWN_S; } }
      if (countdown > -GO_S) countdown -= dt;
      if (countdown <= 0 && between <= 0) {
        if (runs) {
          acc += dt;
          while (acc >= 1 / STEP_HZ && screen === Screen.Play && between <= 0) { tick(); acc -= 1 / STEP_HZ; }
        } else coast(arena, dt, s => s.boost ? BOOST_SPEED : SPEED);
        if (online() && !iRun() && (sendT += dt) >= 1 / NET_HZ) { // guests steer the runner's copy of their snake
          sendT = 0;
          const i = playerInput(0);
          send({t: SnakeMsg.Input, h: i.target, r: i.turn, b: +!!i.boost});
        }
      }
    }
    draw(); hud();
    if (pendingRoom) { const room = pendingRoom; pendingRoom = null; lobby.open(room); } // once, even if it throws
    frame = requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', () => {
    paused = document.visibilityState === 'hidden'; last = performance.now();
    if (paused && iRun() && playing() && slots().length > 1) { // a hidden tab slows down: hand the arena to the next player
      const to = slots().find(x => x !== net!.slot)!;
      for (const m of encodeSnaps(arena, pending)) send(m); pending = { eaten: [], added: [], out: [] };
      send({t: SnakeMsg.Hand, to}); runner = to;
    }
  }, {signal});

  // --- screens ---
  function startGame() {
    if (mode === PlayerMode.Online) return hostStart();
    newGame();
    match = mode === PlayerMode.Two ? createMatch(cfg.match, [0, 1]) : null;
    enterPlay(match ? COUNTDOWN_S : -GO_S);
  }
  function enterPlay(count = COUNTDOWN_S) {
    acc = 0; screen = Screen.Play; between = 0; countdown = count;
    $('setup').style.display = 'none'; $('end').style.display = 'none';
    (document.activeElement as HTMLElement | null)?.blur();
  }
  function garage() {
    screen = Screen.Garage; match = null; newGame();
    $('setup').style.display = 'flex'; $('end').style.display = 'none';
    if (online() && lobby.isHost() && !net!.open) lobby.reopen(); // back in the waiting room, fresh countdown
    refreshGarage();
  }
  /** A result screen: a bold title and lines, all plain text (names are players' own), then Play again / Garage. */
  function showEnd(title: string, ...lines: string[]) {
    screen = Screen.End;
    const b = document.createElement('b'); b.textContent = title;
    const button = (label: string, action: ResultAction, onClick: () => void) => {
      const el = document.createElement('button'); el.textContent = label; el.dataset.end = action; el.onclick = onClick; return el;
    };
    $('endText').replaceChildren(b, ...lines.flatMap(l => [document.createElement('br'), l]), document.createElement('br'),
      ...(online() ? [button('Back to room', ResultAction.Garage, garage)]
        : [button('Play again', ResultAction.Again, startGame), ' ', button('Garage', ResultAction.Garage, garage)]));
    $('end').style.display = 'grid';
  }
  function soloOver() {
    const length = segments(players[0]), best = length > cfg.best;
    if (best) { cfg.best = length; save(); }
    showEnd("You're out", `Length ${length}`, best ? 'New best!' : `Best ${cfg.best}`);
  }

  // --- the garage: looks, players, match type and difficulty ---
  const optRow = <T extends string>(id: string, labels: readonly T[], onPick: (label: T) => void) => labels.map(label => {
    const b = document.createElement('button'); b.className = 'opt'; b.textContent = label;
    b.onclick = () => onPick(label);
    $(id).append(b); return b;
  });
  const cName = $<HTMLInputElement>('cName'), cColor = $<HTMLInputElement>('cColor'), cAccent = $<HTMLInputElement>('cAccent');
  const preview = $<HTMLCanvasElement>('preview').getContext('2d')!;
  function loadInputs() { const p = cfg.players[edit]; cName.value = p.name; cColor.value = p.color; cAccent.value = p.accent; }
  function refreshGarage(note = '') {
    const p = cfg.players[edit];
    const on = (id: string, value: string) => [...$(id).children].forEach(b => b.classList.toggle('on', b.textContent === value));
    const guest = online() && !lobby.isHost(), shown = guest ? picks : { type: cfg.match, level: cfg.difficulty };
    on('cPlayers', mode); on('cPattern', p.pattern); on('cEyes', p.eyes); on('cMatch', shown.type); on('cLevel', shown.level);
    for (const id of ['cMatch', 'cLevel']) [...$(id).children].forEach(b => { (b as HTMLButtonElement).disabled = guest; });
    [...$('cEdit').children].forEach((b, i) => b.classList.toggle('on', i === edit));
    $('editRow').style.display = mode === PlayerMode.Two ? '' : 'none';
    $('matchRow').style.display = mode === PlayerMode.One ? 'none' : '';
    $('best').textContent = mode === PlayerMode.One ? `Best length ${cfg.best}` : '';
    $('keys').textContent = KEY_HELP[mode];
    $('colorNote').textContent = note;
    drawPreview(preview, p);
    save(); sendLook(); lobby.render(); // the popup and waiting room, then garageInfo()
    if (online() && lobby.isHost()) sendMode();
  }
  function garageInfo() {
    const go = $<HTMLButtonElement>('go');
    go.disabled = mode === PlayerMode.Online && !(net && lobby.isHost());
    go.textContent = mode !== PlayerMode.Online ? 'Start' : net && !lobby.isHost() ? 'Waiting for host…' : 'Start';
    go.style.display = mode === PlayerMode.Online && !net ? 'none' : '';
  }
  function changed() { // keep the two players' main colours apart (FR-014)
    const { p2, changed } = distinctColors(cfg.players[0], cfg.players[1]);
    cfg.players[1] = p2;
    if (changed && edit === 1) loadInputs();
    refreshGarage(changed ? 'That colour is taken by Snake 1: Snake 2 got another' : '');
  }
  cName.oninput = () => { cfg.players[edit].name = cName.value; changed(); };
  cColor.oninput = () => { cfg.players[edit].color = cColor.value; changed(); };
  cAccent.oninput = () => { cfg.players[edit].accent = cAccent.value; changed(); };
  optRow('cPattern', values(SnakePattern), v => { cfg.players[edit].pattern = v; changed(); });
  optRow('cEyes', values(SnakeEyes), v => { cfg.players[edit].eyes = v; changed(); });
  optRow('cMatch', values(MatchType), v => { cfg.match = v; refreshGarage(); });
  optRow('cLevel', values(Difficulty), v => { cfg.difficulty = v; refreshGarage(); });
  optRow('cEdit', values(SnakeTab), tab => { edit = values(SnakeTab).indexOf(tab); loadInputs(); refreshGarage(); });
  optRow('cPlayers', values(PlayerMode), m => { mode = m; edit = 0; lobby.setActive(m === PlayerMode.Online); loadInputs(); garage(); });
  $('go').onclick = startGame;

  // a join link: Online, and into that room once the first frame is drawn (setting up can hold a slow device up)
  let pendingRoom = lobby.linkedRoom;
  if (pendingRoom) { mode = PlayerMode.Online; lobby.setActive(true); }
  loadInputs();
  garage();
  frame = requestAnimationFrame(loop);

  return () => {
    listening.abort();
    cancelAnimationFrame(frame);
    for (const t of sendLater.values()) clearTimeout(t);
    lobby.dispose();
    if (viewport && siteViewport !== undefined) viewport.content = siteViewport;
    root.innerHTML = '';
    root.classList.remove('sd', 'two', 'touch');
  };
}
