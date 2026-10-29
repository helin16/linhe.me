// Tank Clash (specs/007-tank-artillery): the garage, the battle loop, input, the HUD and the life panel, offline and
// online. The rules live in sim.ts, computer tanks in bots.ts, drawing in draw.ts, sounds in sound.ts, online messages
// in messages.ts; mount() renders into `root` and returns a cleanup that leaves the page as it was.
import { values } from '../../shared/enum.ts';
import { PlayerMode } from '../../shared/modes.ts';
import { NetText } from '../../shared/online/client.ts';
import { createLobby, type LobbyRoom } from '../../shared/online/lobby.ts';
import { playerName } from '../../shared/online/roster.ts';
import { GameSlug } from '../index.ts';
import { botInput, newMemory, type Memory } from './bots.ts';
import { DEFAULT_ROOM_SIZE, LOBBY_COUNTDOWN_MS, POSE_HZ, ROOM_SIZES, STEP_HZ, TANK_COUNTS } from './constants.ts';
import { Difficulty, Drop, Hold, MapId, Phase, ResultAction, Screen, Side, TankMsg, TankTab, TankType } from './enums.ts';
import { BONUS_ICON, drawBattle, drawPreview, groundChanged } from './draw.ts';
import {
  allowedFrom, applySettle, BLAST_CHUNK, beginRows, encodeSettle, nextRunner, parseMessage, randomSide, roomEntries,
  rowsToEntries, sideFree, tanksFor, turnFits, type BeginRow, type Msg, type TurnInfo,
} from './messages.ts';
import { gameSetup, seeded, type Random } from './seed.ts';
import { defaults, distinctColors, loadSaved, saveSettings, type TankLook } from './settings.ts';
import { createSound } from './sound.ts';
import {
  activeTank, addCrate, createBattle, DRAW, fire, NO_INPUT, setPose, setTurn, startTurn, step, type Battle, type Entry,
  type Events, type Input, type Owner, type Tank,
} from './sim.ts';
import { clampAngle, TANKS, tenths } from './tanks.ts';
import { carve, PLAYABLE_MAPS, type PlayableMap } from './terrain.ts';

const MARKUP = `
<canvas id="view"></canvas>
<div id="hud">
  <div id="bar"><div id="whoseTurn" role="status"></div><div id="timer" role="timer"></div><div id="wind"></div>
    <button id="mute" aria-label="Sound on or off"></button></div>
  <button id="panelToggle" aria-label="Show or hide the tank list" aria-expanded="true">Tanks</button>
  <ul id="panel" aria-label="Tanks"></ul>
  <div id="msg" role="status"></div>
  <div id="controls">
    <button data-hold="${Hold.DriveLeft}" aria-label="Drive left">◀</button><button data-hold="${Hold.DriveRight}" aria-label="Drive right">▶</button>
    <button data-hold="${Hold.AimUp}" aria-label="Raise the cannon">▲</button><button data-hold="${Hold.AimDown}" aria-label="Lower the cannon">▼</button>
    <div id="aimBox"><span id="angle"></span><label>Power <input type="range" id="cPower" min="0" max="100" step="1"></label><span id="power"></span></div>
    <button id="fireBtn">FIRE</button>
  </div>
</div>
<div id="setup">
  <h1>Tank Clash</h1>
  <div>Players<br><span id="cPlayers"></span></div>
  <div id="editRow">Customise<br><span id="cEdit"></span></div>
  <label>Name <input type="text" id="cName" maxlength="10"></label>
  <label>Colour <input type="color" id="cColor"></label>
  <div>Tank<br><span id="cType"></span></div>
  <canvas id="preview" width="240" height="110" aria-label="Preview"></canvas>
  <div id="stats"></div>
  <div id="colorNote" role="status"></div>
  <div id="sideRow">Side<br><span id="cSide"></span></div>
  <div id="tanksRow">Tanks<br><span id="cTanks"></span></div>
  <div id="mapRow">Map<br><span id="cMap"></span></div>
  <div id="levelRow">Computer tanks<br><span id="cLevel"></span></div>
  <div id="online"></div>
  <div id="keys"></div>
  <button id="go">Start</button>
</div>
<div id="end"><div id="endText"></div></div>`;
const GAME_VIEWPORT = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
const MAX_FRAME_S = 0.25;   // a long frame (tab switch) runs at most this much game time
const END_DELAY_S = 1.2;    // the battle's last moments show this long before the result
const SEND_GAP_MS = 200;    // looks and room picks: at most 5 a second
const MAX_SEED = 2 ** 31;
const SIDE_WAIT_MS = 1500;  // a joiner picks a side by then even if someone hasn't said theirs
const REJOIN_KEY = 'tc-rejoin';
const REJOIN_MS = 10 * 60_000; // a saved rejoin key is offered this long (a battle that long is still on, most likely)
const BOT_COLORS = ['#8e8e93', '#ff9800', '#9c27b0', '#00bcd4', '#795548', '#cddc39', '#3f51b5', '#ff5722'];
const KEY_HELP = '←/→ drive · ↑/↓ aim · Q/E power · Space fire';
// driving keys are held; aiming keys move the cannon or power by exactly 1 per press (the keyboard repeats while held)
const HELD_KEYS: Record<string, Hold> = { ArrowLeft: Hold.DriveLeft, ArrowRight: Hold.DriveRight };
const NUDGE_KEYS: Record<string, [aim: number, power: number]> = {
  ArrowUp: [1, 0], ArrowDown: [-1, 0], KeyE: [0, 1], Equal: [0, 1], NumpadAdd: [0, 1], KeyQ: [0, -1], Minus: [0, -1], NumpadSubtract: [0, -1],
};
const FIRE_KEY = 'Space';
const MODES = [PlayerMode.One, PlayerMode.Two, PlayerMode.Online];

type Saved = { code: string; key: string; at: number };
const readRejoin = (): Saved | null => {
  try {
    const v = JSON.parse(localStorage.getItem(REJOIN_KEY) ?? 'null');
    return v && typeof v.code === 'string' && typeof v.key === 'string' && Date.now() - v.at < REJOIN_MS ? v : null;
  } catch { return null; }
};
const writeRejoin = (v: Saved | null) => { try { if (v) localStorage.setItem(REJOIN_KEY, JSON.stringify(v)); else localStorage.removeItem(REJOIN_KEY); } catch {} };
const botLook = (n: number, random: Random): TankLook =>
  ({ name: `CPU ${n}`, color: BOT_COLORS[(n - 1) % BOT_COLORS.length], type: values(TankType)[Math.floor(random() * values(TankType).length)] });

export function mount(root: HTMLElement): () => void {
  const listening = new AbortController(), signal = listening.signal;
  const viewport = document.querySelector<HTMLMetaElement>('meta[name=viewport]');
  const siteViewport = viewport?.content;
  if (viewport) viewport.content = GAME_VIEWPORT;
  root.classList.add('tc');
  root.innerHTML = MARKUP;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  root.classList.toggle('touch', navigator.maxTouchPoints > 0);

  const cfg = loadSaved();
  const save = () => saveSettings(cfg);
  const sound = createSound(cfg.muted);
  let mode: PlayerMode = PlayerMode.One, edit = 0, screen: Screen = Screen.Garage;

  // --- the battle ---
  let random: Random = Math.random, b: Battle | null = null, mem: Memory = newMemory(), paused = false, endT = 0;
  const localPlayers = () => mode === PlayerMode.Two ? 2 : 1;

  /** Both sides for a local game: player 1 leads Left (and player 2 Right), computer tanks fill the rest (FR-006). */
  function entries(): Entry[] {
    const per = cfg.tanks / 2, list: Entry[] = [];
    let bots = 0;
    list.push({ side: Side.Left, owner: { player: 0 }, look: cfg.players[0] });
    for (let i = 1; i < per; i++) list.push({ side: Side.Left, owner: null, look: botLook(++bots, random) });
    if (localPlayers() === 2) list.push({ side: Side.Right, owner: { player: 1 }, look: cfg.players[1] });
    while (list.filter(e => e.side === Side.Right).length < per) list.push({ side: Side.Right, owner: null, look: botLook(++bots, random) });
    return list;
  }

  // --- online (research R6, R9): one device, the runner (first the host), settles the battle for everyone ---
  let net: LobbyRoom<TankLook> | null = null, runner = -1, mySide: Side | undefined;
  let picks = { map: cfg.map, tanks: cfg.tanks, level: cfg.difficulty }; // the host's, as last sent
  let rows: BeginRow[] = [], seed = 0, blastLog: [number, number, number][] = [], shotBlasts: [number, number, number][] = [], shotGot: [number, Drop][] = [];
  let rejoining = false, poseT = 0, saved = readRejoin();
  const saveRejoin = (v: { code: string; key: string } | null) => { saved = v && { ...v, at: Date.now() }; writeRejoin(saved); };
  const online = () => mode === PlayerMode.Online && !!net;
  const iRun = () => online() && runner === net!.slot;
  const slots = () => net ? [net.slot, ...net.peers].sort((a, b) => a - b) : [];
  const send = (m: object) => lobby.send(m);
  const myLook = (): TankLook => ({ ...cfg.players[0], side: mySide });
  const lookOf = (slot: number): TankLook | undefined => slot === net?.slot ? myLook() : net?.profiles[slot];
  const sides = (except?: number) => slots().filter(s => s !== except).map(s => lookOf(s)?.side);
  const roomTanks = (): number => tanksFor(lobby.isHost() ? cfg.tanks : picks.tanks, sides().filter((s): s is Side => !!s));
  const level = () => online() && !lobby.isHost() ? picks.level : cfg.difficulty;
  const lobby = createLobby<TankLook>({
    root, panel: $('online'), game: GameSlug.TankClash, sizes: ROOM_SIZES, defaultSize: DEFAULT_ROOM_SIZE,
    countdownMs: LOBBY_COUNTDOWN_MS, botWord: 'computer tanks',
    roomInfo: host => host ? 'You are the host: pick the map and tanks, start when ready' : 'The host picks the map and starts',
    own: myLook, canShow: () => screen === Screen.Garage,
    rowTag: slot => lookOf(slot)?.side ?? '',
    bots: (players: number): number => Math.max(0, roomTanks() - players),
    rejoin: () => saved && Date.now() - saved.at < REJOIN_MS ? saved : null,
    onHello: () => {
      net = lobby.room; runner = slots()[0];
      if (!net!.open) { // back into a battle: whoever runs it now sends it (sync)
        rejoining = true; runner = -1;
        return saveRejoin({ code: net!.code, key: net!.key });
      }
      mySide = undefined;
      chooseSide();
      sideTimer = setTimeout(() => chooseSide(true), SIDE_WAIT_MS);
    },
    onPeers: joined => {
      if (joined !== undefined) { sendLook(true); if (lobby.isHost()) sendMode(true); }
      runner = nextRunner(runner, slots());
      if (!b || screen === Screen.Garage) return;
      if (joined !== undefined) return rejoined(joined);
      for (const t of b.tanks) if (t.owner && 'slot' in t.owner && !slots().includes(t.owner.slot)) { // dropped: a computer plays it
        flash(`${nameOf(t)} left: a computer takes over`);
        t.owner = null;
        if (t.id === b.active) mem = newMemory();
      }
    },
    onMessage: raw => {
      const m = parseMessage(raw), t = b && activeTank(b);
      if (m && rejoining && m.t === TankMsg.Sync && m.first) runner = m.from; // the runner, whoever it is now
      const activeSlot = t?.owner && 'slot' in t.owner ? t.owner.slot : null;
      if (m && net && allowedFrom(m, runner, slots()[0], activeSlot)) onNet(m);
    },
    onClosed: reason => {
      const room = net;
      net = null; runner = -1;
      rejoining = false;
      if (room && reason && screen === Screen.Play) saveRejoin({ code: room.code, key: room.key }); // dropped: 10 minutes from now
      if (reason === NetText.NoRoom || reason === NetText.Closed || (reason === null && screen !== Screen.Play)) saveRejoin(null);
      if (mode === PlayerMode.Online && screen !== Screen.End) { b = null; garage(); }
    },
    onCountdownEnd: () => hostStart(), onDeactivate: () => { mode = PlayerMode.One; garage(); }, onChange: () => garageInfo(),
  });
  /** A joining player's side (FR-006): random, balancing the sides, once everyone already here has said theirs. */
  let sideTimer: ReturnType<typeof setTimeout> | undefined;
  function chooseSide(anyway = false) {
    if (!net || mySide) return;
    if (!anyway && [...net.peers].some(slot => !net!.profiles[slot])) return;
    clearTimeout(sideTimer);
    mySide = randomSide(sides(net.slot), Math.random);
    sendLook(true); refreshGarage();
  }
  // looks and room picks go out only when they change, at most every SEND_GAP_MS (a colour drag fires many inputs)
  const lastSent = new Map<string, string>(), sendLater = new Map<string, ReturnType<typeof setTimeout>>();
  const latest = (t: string) => t === TankMsg.Look ? {t, p: myLook()} : {t, map: cfg.map, tanks: cfg.tanks, level: cfg.difficulty};
  function sendChanged(t: string, now: boolean) {
    const key = JSON.stringify(latest(t));
    if (now) { lastSent.set(t, key); return send(latest(t)); }
    if (lastSent.get(t) === key || sendLater.has(t)) return;
    sendLater.set(t, setTimeout(() => { sendLater.delete(t); const v = JSON.stringify(latest(t)); if (lastSent.get(t) !== v) { lastSent.set(t, v); send(JSON.parse(v)); } }, SEND_GAP_MS));
  }
  const sendLook = (now = false) => sendChanged(TankMsg.Look, now);
  const sendMode = (now = false) => sendChanged(TankMsg.Mode, now);

  function onNet(m: Msg) {
    if (m.t === TankMsg.Look) { lobby.setProfile(m.from, m.p); chooseSide(); if (screen === Screen.Garage) refreshGarage(); }
    if (m.t === TankMsg.Mode) { picks = { map: m.map, tanks: m.tanks, level: m.level }; refreshGarage(); }
    if (m.t === TankMsg.Begin) { runner = m.from; seed = m.seed; rows = m.tanks; begin(m.map); }
    if (m.t === TankMsg.Sync && rejoining) {
      if (m.first) { seed = m.seed; rows = m.tanks; begin(m.map); takeTurn(m.turn); if (!m.turn.aim) b!.phase = Phase.Settle; }
      for (const [x, y, r] of m.blasts) carve(b!.terrain, x, y, r);
      blastLog.push(...m.blasts);
      groundChanged(b!.terrain);
    }
    if (!b) return;
    if (m.t === TankMsg.Turn) { takeTurn(m); rejoining = false; }
    if (m.t === TankMsg.Pose && m.id === b.active && b.phase === Phase.Aim) {
      const t = b.tanks[m.id], dx = m.x - t.x;
      setPose(b, m.id, m.x, m.angle, m.power, m.fuel);
      t.driving = Math.abs(dx) > 0.01 ? Math.sign(dx) : 0;
    }
    if (m.t === TankMsg.Fire && m.id === b.active && b.phase === Phase.Aim) {
      setPose(b, m.id, m.x, m.angle, m.power, b.tanks[m.id].fuel);
      fire(b); sound.fire();
    }
    if (m.t === TankMsg.Settle && !iRun()) {
      for (const [x, y, r] of m.blasts) carve(b.terrain, x, y, r);
      blastLog.push(...m.blasts);
      applySettle(b, m);
      groundChanged(b.terrain);
      if (m.got.length) flash(m.got.map(([, d]) => `${d}!`).join(' '));
    }
    if (m.t === TankMsg.Drop && !iRun()) addCrate(b, m.id, m.x, null);
    if (m.t === TankMsg.Over) { b.winner = m.winner; b.phase = Phase.Over; }
    if (m.t === TankMsg.Hand) { runner = nextRunner(runner, slots(), m); if (iRun()) mem = newMemory(); }
  }

  /** The host starts a battle (Start, or the waiting room's countdown ran out). */
  function hostStart() {
    if (!lobby.isHost()) return;
    lobby.lock(); sendMode(true); runner = net!.slot;
    const r = Math.random, players = slots().map(slot => {
      const look = lookOf(slot) ?? { ...defaults().players[0], name: '' };
      return { slot, look, side: look.side ?? randomSide(sides(slot), r) };
    });
    const tanks = tanksFor(cfg.tanks, players.map(p => p.side));
    let bots = 0;
    rows = beginRows(roomEntries(players, tanks, () => botLook(++bots, r)));
    seed = Math.floor(r() * MAX_SEED);
    const map: PlayableMap = cfg.map === MapId.Random ? PLAYABLE_MAPS[Math.floor(r() * PLAYABLE_MAPS.length)] : cfg.map;
    send({t: TankMsg.Begin, seed, map, tanks: rows});
    begin(map);
    sendTurn();
  }
  /** Everyone builds the same battle from the seed, map and tank list (research R6). */
  function begin(map: PlayableMap) {
    random = seeded(seed);
    b = createBattle(random, map, rowsToEntries(rows));
    random = gameSetup(location.href, true).random; // after the battle is built, each device's own randomness
    blastLog = []; shotBlasts = []; shotGot = [];
    if (online()) for (const t of b.tanks) { const slot = rows[t.id][1]; if (slot >= 0 && !slots().includes(slot)) t.owner = null; }
    if (online() && net && !rejoining) saveRejoin({ code: net.code, key: net.key }); // to come back if we drop
    enterPlay();
  }
  /** A turn as the runner says (the rest of the round included, so this device can run the battle from here). */
  function takeTurn(t: TurnInfo) {
    if (!b || !turnFits(t, b.tanks.length)) return;
    setTurn(b, t.id, t.wind, t.left, t.round, t.rest);
    b.tanks[t.id].owner = t.slot < 0 ? null : { slot: t.slot };
    mem = newMemory(); held.clear();
  }
  const turnMsg = () => {
    const t = activeTank(b!);
    return {t: TankMsg.Turn, id: t.id, slot: t.owner && 'slot' in t.owner ? t.owner.slot : -1, left: Math.round(b!.turnLeftMs), wind: b!.wind,
      round: b!.round, rest: b!.order};
  };
  const sendTurn = () => send(turnMsg());
  /** A player came back into a running battle (FR-016): the runner sends them the battle so far. */
  function rejoined(slot: number) {
    if (!iRun() || !b || screen !== Screen.Play || b.phase === Phase.Over) return;
    const id = rows.find(r => r[1] === slot)?.[0];
    if (id === undefined) return;
    flash(`${nameOf(b.tanks[id])} is back`);
    const map = b.terrain.map;
    for (let i = 0; i === 0 || i < blastLog.length; i += BLAST_CHUNK)
      send({t: TankMsg.Sync, seed, map, tanks: rows, blasts: blastLog.slice(i, i + BLAST_CHUNK), first: +(i === 0),
        turn: { ...turnMsg(), t: undefined, aim: +(b.phase === Phase.Aim) }});
    send(encodeSettle(b, [], []));
  }

  // --- input: keys and the on-screen buttons, for whoever's turn it is on this device ---
  const held = new Set<Hold>();
  let fireQueued = false;
  addEventListener('keydown', e => {
    if (['INPUT', 'SELECT'].includes((e.target as HTMLElement).tagName) && (e.target as HTMLInputElement).type !== 'range') return;
    if (e.code in HELD_KEYS || e.code in NUDGE_KEYS || e.code === FIRE_KEY) e.preventDefault();
    if (e.code in HELD_KEYS) held.add(HELD_KEYS[e.code]);
    if (e.code in NUDGE_KEYS && b && myTurn()) {
      const t = activeTank(b), [a, p] = NUDGE_KEYS[e.code];
      t.angle = clampAngle(t.type, Math.round(t.angle) + a); t.power = Math.min(100, Math.max(0, Math.round(t.power) + p));
    }
    if (e.code === FIRE_KEY && !e.repeat) fireQueued = true;
  }, {signal});
  addEventListener('keyup', e => { if (e.code in HELD_KEYS) held.delete(HELD_KEYS[e.code]); }, {signal});
  addEventListener('blur', () => held.clear(), {signal});
  for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-hold]')) {
    const h = btn.dataset.hold as Hold;
    btn.onpointerdown = e => { e.preventDefault(); btn.setPointerCapture(e.pointerId); held.add(h); btn.classList.add('on'); };
    btn.onpointerup = btn.onpointercancel = () => { held.delete(h); btn.classList.remove('on'); };
  }
  $('fireBtn').onclick = () => { fireQueued = true; };
  const cPower = $<HTMLInputElement>('cPower');
  cPower.oninput = () => { if (b && myTurn()) activeTank(b).power = Number(cPower.value); };
  /** Is this tank played on this device by a person? */
  const mine = (o: Owner) => !!o && ('player' in o || (online() && o.slot === net!.slot));
  const myTurn = () => !!b && b.phase === Phase.Aim && mine(activeTank(b).owner) && activeTank(b).alive;
  /** Does this device move the active tank (its person, or the runner for a computer)? */
  const iDrive = (t: Tank) => mine(t.owner) || (!t.owner && (!online() || iRun()));
  const humanInput = (): Input => {
    const fire = fireQueued; fireQueued = false;
    const k = (h: Hold) => +held.has(h);
    return { drive: k(Hold.DriveRight) - k(Hold.DriveLeft), aim: k(Hold.AimUp) - k(Hold.AimDown), power: k(Hold.PowerUp) - k(Hold.PowerDown), fire };
  };

  // --- the loop: fixed steps, drawn every frame ---
  function tick() {
    const battle = b!, t = activeTank(battle), dt = 1 / STEP_HZ;
    let input = NO_INPUT;
    if (battle.phase === Phase.Aim && t.alive && iDrive(t)) input = t.owner ? humanInput() : botInput(battle, t, mem, level(), random, dt);
    else fireQueued = false;
    if (online() && battle.phase === Phase.Aim && iDrive(t)) {
      if (input.fire) send({t: TankMsg.Fire, id: t.id, x: t.x, angle: t.angle, power: t.power});
      else if ((poseT += dt) >= 1 / POSE_HZ) { poseT = 0; send({t: TankMsg.Pose, id: t.id, x: t.x, angle: t.angle, power: t.power, fuel: t.fuel}); }
    }
    const ev = step(battle, input, dt);
    react(ev);
    if (!online()) { if (ev.settled && battle.phase !== Phase.Over) nextTurn(); return; }
    if (!iRun()) return;
    shotBlasts.push(...ev.blasts); shotGot.push(...ev.got);
    if (ev.got.length && battle.phase === Phase.Aim) { send(encodeSettle(battle, [], ev.got)); shotGot = []; }
    if (!ev.settled) return;
    blastLog.push(...shotBlasts);
    send(encodeSettle(battle, shotBlasts, shotGot)); shotBlasts = []; shotGot = [];
    if (battle.phase === Phase.Over) return send({t: TankMsg.Over, winner: battle.winner});
    nextTurn();
    sendTurn();
  }
  function nextTurn() {
    const crate = startTurn(b!, random);
    // online, a tank is its player's while they're in the room, else a computer's: decided as each turn starts (FR-016)
    const slot = rows[b!.active]?.[1];
    if (online() && slot !== undefined && slot >= 0) b!.tanks[b!.active].owner = slots().includes(slot) ? { slot } : null;
    if (crate && online()) send({t: TankMsg.Drop, id: crate.id, x: crate.x});
    mem = newMemory();
    held.clear();
  }
  function react(ev: Events) {
    if (ev.fired) sound.fire();
    for (const [, , r] of ev.blasts) sound.boom(r);
    if (ev.blasts.length) groundChanged(b!.terrain);
    for (const _ of ev.landed) sound.crateLand();
    if (ev.got.length) flash(ev.got.map(([, d]) => `${d}!`).join(' '));
  }
  let flashText = '', flashT = 0;
  const flash = (text: string) => { flashText = text; flashT = 2; };

  const view = $<HTMLCanvasElement>('view'), ctx = view.getContext('2d')!;
  let acc = 0, last = performance.now(), frame = 0, time = 0;
  function draw() {
    const dpr = Math.min(devicePixelRatio, 2), w = Math.round(view.clientWidth * dpr), h = Math.round(view.clientHeight * dpr);
    if (view.width !== w || view.height !== h) { view.width = w; view.height = h; }
    if (b) drawBattle(ctx, w, h, b, time);
  }
  const nameOf = (t: Tank) => {
    if (t.owner && 'player' in t.owner) return t.look.name.trim() || `Player ${t.owner.player + 1}`;
    const row = rows[t.id];
    return online() && row && row[1] >= 0 ? playerName(t.look.name, row[1]) : t.look.name.trim() || 'CPU';
  };
  let panelKey = '';
  function hud() {
    $('hud').style.display = screen === Screen.Garage || !b ? 'none' : '';
    if (!b) return;
    const t = activeTank(b), aiming = b.phase === Phase.Aim;
    $('whoseTurn').textContent = b.phase === Phase.Over ? '' : `${nameOf(t)}'s turn${t.owner ? '' : ' (computer)'}`;
    $('whoseTurn').style.color = t.look.color;
    $('timer').textContent = aiming ? String(Math.ceil(Math.max(0, b.turnLeftMs) / 1000)) : '';
    $('wind').textContent = b.wind === 0 ? 'No wind' : `Wind ${b.wind < 0 ? '←' : '→'} ${Math.abs(b.wind)}`;
    $('angle').textContent = `Angle ${Math.round(t.angle)}°`;
    $('power').textContent = String(Math.round(t.power));
    if (document.activeElement !== cPower) cPower.value = String(Math.round(t.power));
    const yours = myTurn();
    root.classList.toggle('my-turn', yours);
    for (const el of root.querySelectorAll<HTMLButtonElement | HTMLInputElement>('#controls button, #controls input')) el.disabled = !yours;
    $('msg').textContent = flashT > 0 ? flashText : '';
    $('mute').textContent = cfg.muted ? '🔇' : '🔊';
    // the life panel (FR-019): by side, hearts drawn and as a number, the active tank highlighted, wrecks marked
    const all = [Side.Left, Side.Right].flatMap(side => b!.tanks.filter(x => x.side === side));
    const key = JSON.stringify([b.active, aiming, all.map(x => [x.hearts, x.alive, x.gone, x.powerShell, x.shield, x.gripUntil !== null && x.gripUntil >= b!.round, x.look, x.owner])]);
    if (key === panelKey) return;
    panelKey = key;
    $('panel').replaceChildren(...[Side.Left, Side.Right].flatMap(side => {
      const head = document.createElement('li'); head.className = 'side'; head.textContent = side;
      return [head, ...b!.tanks.filter(x => x.side === side).map(row)];
    }));
  }
  function row(t: Tank) {
    const li = document.createElement('li'), spec = TANKS[t.type];
    li.className = 'tank';
    li.classList.toggle('active', t.id === b!.active && b!.phase !== Phase.Over && t.alive);
    li.classList.toggle('destroyed', !t.alive);
    li.classList.toggle('you', online() ? rows[t.id]?.[1] === net!.slot : mine(t.owner)); // whose tank it is, even while a computer stands in
    li.dataset.id = String(t.id);
    const dot = document.createElement('i'); dot.className = 'dot'; dot.style.background = t.look.color;
    const name = document.createElement('span'); name.className = 'name'; name.textContent = nameOf(t); // text, never markup
    const type = document.createElement('span'); type.className = 'type'; type.textContent = t.type;
    const hearts = document.createElement('span'); hearts.className = 'hearts'; hearts.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < spec.hearts / 10; i++) {
      const h = document.createElement('i'), fill = Math.min(1, Math.max(0, (t.hearts - i * 10) / 10));
      h.style.setProperty('--fill', String(fill)); hearts.append(h);
    }
    const num = document.createElement('span'); num.className = 'num'; num.textContent = t.alive ? tenths(t.hearts) : 'destroyed';
    const bonus = document.createElement('span'); bonus.className = 'bonus';
    bonus.textContent = [t.powerShell && BONUS_ICON[Drop.Power], t.shield && BONUS_ICON[Drop.Shield],
      t.gripUntil !== null && t.gripUntil >= b!.round && BONUS_ICON[Drop.GripGear]].filter(Boolean).join('');
    li.append(dot, name, type, hearts, num, bonus);
    return li;
  }
  function loop(now: number) {
    const dt = Math.min(MAX_FRAME_S, (now - last) / 1000); last = now; time += dt;
    if (screen === Screen.Play && b && !(paused && !online())) {
      acc += dt;
      while (acc >= 1 / STEP_HZ && screen === Screen.Play) { tick(); acc -= 1 / STEP_HZ; }
      flashT -= dt;
      if (b.phase === Phase.Over && (endT += dt) >= END_DELAY_S) battleOver();
    }
    sound.engine(screen === Screen.Play && !!b && b.phase === Phase.Aim && activeTank(b).driving !== 0 && !paused);
    draw(); hud();
    if (pendingRoom) { const room = pendingRoom; pendingRoom = null; lobby.open(room); } // once, even if it throws
    frame = requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', () => {
    paused = document.visibilityState === 'hidden'; last = performance.now(); held.clear();
    if (paused && iRun() && b && screen === Screen.Play && slots().length > 1) { // a hidden tab stops: hand the battle on
      const to = slots().find(x => x !== net!.slot)!;
      send(encodeSettle(b, shotBlasts, shotGot)); blastLog.push(...shotBlasts); shotBlasts = []; shotGot = [];
      send({t: TankMsg.Hand, to}); runner = to;
    }
  }, {signal});

  // --- screens ---
  function startGame() {
    if (mode === PlayerMode.Online) return hostStart();
    ({random} = gameSetup(location.href, false));
    b = createBattle(random, cfg.map, entries());
    rows = [];
    enterPlay();
  }
  function enterPlay() {
    mem = newMemory(); endT = 0; acc = 0; panelKey = '';
    groundChanged(b!.terrain);
    screen = Screen.Play;
    $('setup').style.display = 'none'; $('end').style.display = 'none';
    (document.activeElement as HTMLElement | null)?.blur();
    flash(b!.terrain.map);
  }
  function garage() {
    screen = Screen.Garage;
    $('setup').style.display = 'flex'; $('end').style.display = 'none';
    if (online() && lobby.isHost() && !net!.open) lobby.reopen(); // back in the waiting room, fresh countdown
    refreshGarage();
  }
  function battleOver() {
    const w = b!.winner;
    const side = online() ? b!.tanks.find(t => rows[t.id]?.[1] === net?.slot)?.side : localPlayers() === 1 ? Side.Left : undefined;
    const leader = (s: Side) => b!.tanks.find(t => t.side === s && t.owner && 'player' in t.owner);
    const title = w === DRAW ? "It's a draw" : side ? (w === side ? 'You win!' : 'You lose')
      : `${leader(w!) ? nameOf(leader(w!)!) : w} wins!`;
    if (w !== DRAW && (!side || w === side)) sound.win(); else sound.lose();
    if (online()) { runner = slots()[0]; saveRejoin(null); } // the next battle starts with the host running it
    showEnd(title, w === DRAW ? 'Both sides were wiped out' : `${w} side wins`);
  }
  /** The result: a bold title and lines, all plain text (names are players' own), then the buttons. */
  function showEnd(title: string, ...lines: string[]) {
    screen = Screen.End;
    const t = document.createElement('b'); t.textContent = title;
    const button = (label: string, action: ResultAction, onClick: () => void) => {
      const el = document.createElement('button'); el.textContent = label; el.dataset.end = action; el.onclick = onClick; return el;
    };
    $('endText').replaceChildren(t, ...lines.flatMap(l => [document.createElement('br'), l]), document.createElement('br'),
      ...(online() ? [button('Back to room', ResultAction.Garage, garage)]
        : [button('Play again', ResultAction.Again, startGame), ' ', button('Garage', ResultAction.Garage, garage)]));
    $('end').style.display = 'grid';
  }

  // --- the garage: players, tank, name, colour, side (online), tank count, map and difficulty ---
  const optRow = <T extends string>(id: string, labels: readonly T[], onPick: (label: T) => void) => labels.map(label => {
    const el = document.createElement('button'); el.className = 'opt'; el.textContent = label;
    el.onclick = () => onPick(label);
    $(id).append(el); return el;
  });
  const cName = $<HTMLInputElement>('cName'), cColor = $<HTMLInputElement>('cColor');
  const preview = $<HTMLCanvasElement>('preview').getContext('2d')!;
  function loadInputs() { const p = cfg.players[edit]; cName.value = p.name; cColor.value = p.color; }
  function refreshGarage(note = '') {
    const p: TankLook = cfg.players[edit], spec = TANKS[p.type], guest = online() && !lobby.isHost();
    const shown = guest ? picks : { map: cfg.map, tanks: online() ? roomTanks() : cfg.tanks, level: cfg.difficulty };
    const on = (id: string, value: string | undefined) => [...$(id).children].forEach(x => x.classList.toggle('on', x.textContent === value));
    on('cPlayers', mode); on('cType', p.type); on('cTanks', String(shown.tanks)); on('cMap', shown.map); on('cLevel', shown.level); on('cSide', mySide);
    for (const id of ['cTanks', 'cMap', 'cLevel']) [...$(id).children].forEach(x => { (x as HTMLButtonElement).disabled = guest; });
    [...$('cEdit').children].forEach((x, i) => x.classList.toggle('on', i === edit));
    $('editRow').style.display = mode === PlayerMode.Two ? '' : 'none';
    $('sideRow').style.display = online() ? '' : 'none';
    $('stats').textContent = `Cannon ${spec.minAngle}°–${spec.maxAngle}° · Damage ${tenths(spec.damage)} · Hearts ${spec.hearts / 10} · Grip ${spec.grip}`;
    $('keys').textContent = KEY_HELP;
    $('colorNote').textContent = note;
    drawPreview(preview, p.type, p.color);
    save(); sendLook(); lobby.render(); // the popup and waiting room, then garageInfo()
    if (online() && lobby.isHost()) sendMode();
  }
  function garageInfo() {
    const go = $<HTMLButtonElement>('go');
    go.disabled = mode === PlayerMode.Online && !(net && lobby.isHost());
    go.textContent = mode !== PlayerMode.Online ? 'Start' : net && !lobby.isHost() ? 'Waiting for host…' : 'Start';
    go.style.display = mode === PlayerMode.Online && !net ? 'none' : '';
  }
  function changed() { // keep the two players' colours apart
    const { p2, changed } = distinctColors(cfg.players[0], cfg.players[1]);
    cfg.players[1] = p2;
    if (changed && edit === 1) loadInputs();
    refreshGarage(changed ? 'That colour is taken by Tank 1: Tank 2 got another' : '');
  }
  cName.oninput = () => { cfg.players[edit].name = cName.value; changed(); };
  cColor.oninput = () => { cfg.players[edit].color = cColor.value; changed(); };
  optRow('cType', values(TankType), v => { cfg.players[edit].type = v; refreshGarage(); });
  optRow('cSide', values(Side), v => { // switch side while it has a free place (FR-006)
    if (v === mySide) return;
    if (!sideFree(sides(net?.slot), roomTanks(), v)) return refreshGarage(`The ${v} side is full`);
    mySide = v; sendLook(true); refreshGarage();
  });
  optRow('cTanks', TANK_COUNTS.map(String), v => { cfg.tanks = Number(v); refreshGarage(); });
  optRow('cMap', values(MapId), v => { cfg.map = v; refreshGarage(); });
  optRow('cLevel', values(Difficulty), v => { cfg.difficulty = v; refreshGarage(); });
  optRow('cEdit', values(TankTab), tab => { edit = values(TankTab).indexOf(tab); loadInputs(); refreshGarage(); });
  optRow('cPlayers', MODES, m => { mode = m; edit = 0; lobby.setActive(m === PlayerMode.Online); loadInputs(); garage(); });
  $('go').onclick = startGame;
  $('mute').onclick = () => { cfg.muted = !cfg.muted; sound.setMuted(cfg.muted); save(); };
  $('panelToggle').onclick = () => {
    const open = root.classList.toggle('panel-closed') === false;
    $('panelToggle').setAttribute('aria-expanded', String(open));
  };

  // a join link: Online, and into that room once the first frame is drawn
  let pendingRoom = lobby.linkedRoom;
  if (pendingRoom) { mode = PlayerMode.Online; lobby.setActive(true); }
  loadInputs();
  garage();
  frame = requestAnimationFrame(loop);

  return () => {
    listening.abort();
    cancelAnimationFrame(frame);
    for (const t of sendLater.values()) clearTimeout(t);
    clearTimeout(sideTimer);
    lobby.dispose();
    sound.dispose();
    if (viewport && siteViewport !== undefined) viewport.content = siteViewport;
    root.innerHTML = '';
    root.classList.remove('tc', 'touch', 'my-turn', 'panel-closed');
  };
}
