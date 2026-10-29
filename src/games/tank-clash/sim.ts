// The battle (research R4, R5, R7; FR-002–FR-011, FR-020–FR-021, FR-025): two sides taking turns, driving within
// their half, shells under gravity and wind, blasts that carve the ground and take hearts (tenths), falling tanks,
// wrecks, snow sliding and air drops. Pure: the random source and every input come from outside.
import {
  BLAST_R, CRATE_FALL_MS, CRATE_SIZE, DRIVE_SPEED, DROP_CHANCES, FALL_OUT, FUEL, GRAVITY, GRIP_SLIDE, ICE_SLIDE_FACTOR,
  MAX_CLIMB, MAX_CRATES, MUZZLE, POWER_SCALE, POWER_SHELL_FACTOR, POWER_SPEED, ANGLE_SPEED, REPAIR, SETTLE_MIN, SLIDE,
  SLIDE_SPEED, START_ANGLE, START_POWER, TANK_H, TANK_W, TRAIL_MAX, TURN_MS, WIND_MAX, WORLD_H, WORLD_W,
} from './constants.ts';
import { Drop, Grip, MapId, Material, Phase, Side, type TankType } from './enums.ts';
import type { Random } from './seed.ts';
import type { TankLook } from './settings.ts';
import { clampAngle, TANKS } from './tanks.ts';
import { carve, cellAt, generate, groundBelow, isSolid, PLAYABLE_MAPS, type Ground, type PlayableMap, type Terrain } from './terrain.ts';

/** Who drives a tank: player 1 or 2 on this device, an online slot, or the computer (null). */
export type Owner = { player: number } | { slot: number } | null;
export type Tank = {
  id: number; side: Side; type: TankType; look: TankLook; owner: Owner;
  x: number; y: number; angle: number; power: number; fuel: number; hearts: number;
  alive: boolean; gone: boolean;   // not alive and not gone: a wreck (FR-025)
  doomed: boolean;                 // destroyed by a fall: leaves no wreck
  vy: number; falling: boolean; on: Material;
  powerShell: boolean; shield: boolean; gripUntil: number | null;
  slide: number; driving: number; // the way it is driving (−1, 1), or 0
};
export type Crate = { id: number; x: number; y: number; falling: boolean; contents: Drop | null };
export type Shell = { x: number; y: number; vx: number; vy: number; trail: [number, number][]; damage: number; from: number; age: number };
export const DRAW = 'draw';
export type Winner = Side | typeof DRAW | null;
export type Battle = {
  terrain: Terrain; tanks: Tank[]; crates: Crate[]; round: number; order: number[]; active: number; phase: Phase;
  turnLeftMs: number; wind: number; shell: Shell | null; winner: Winner; settleT: number; nextCrate: number;
  boom: { x: number; y: number; r: number; t: number } | null;
};
export type Entry = { side: Side; look: TankLook; owner: Owner };
export type Input = { drive: number; aim: number; power: number; fire: boolean };
export type Events = { fired: boolean; blasts: [number, number, number][]; landed: number[]; got: [number, Drop][];
  destroyed: number[]; settled: boolean; timeout: boolean };

export const NO_INPUT: Input = { drive: 0, aim: 0, power: 0, fire: false };
const SELF_SAFE = 0.15;   // a new shell ignores the tank that fired it this long
const EDGE = 2;           // footprint columns sit this far inside the tank's ends
const CRATE_SPEED = WORLD_H / (CRATE_FALL_MS / 1000);
const BIG_DROP = 8;       // driving down more than this at once is a fall, not a slope
const RESTING = 0.5;      // support this far below is still "resting"
const half = (side: Side) => side === Side.Left ? [TANK_W / 2, WORLD_W / 2 - TANK_W / 2] : [WORLD_W / 2 + TANK_W / 2, WORLD_W - TANK_W / 2];
export const facing = (side: Side) => side === Side.Left ? 1 : -1;
const noEvents = (): Events => ({ fired: false, blasts: [], landed: [], got: [], destroyed: [], settled: false, timeout: false });

export const tankOf = (b: Battle, id: number) => b.tanks[id];
export const activeTank = (b: Battle) => b.tanks[b.active];
const solidOthers = (b: Battle, self: number) => b.tanks.filter(o => o.id !== self && !o.gone);

/** Highest support under a footprint [x − w/2, x + w/2] at or below fromY: ground (water included), or the top of a
 *  tank or wreck; null if there's nothing down to the bottom. */
function support(b: Battle, x: number, w: number, fromY: number, self = -1): Ground | null {
  let best: Ground | null = null;
  for (let cx = x - w / 2 + EDGE; cx <= x + w / 2 - EDGE + 0.001; cx += Math.min(4, w - 2 * EDGE)) {
    const g = groundBelow(b.terrain, cx, fromY);
    if (g && (!best || g.y < best.y)) best = g;
  }
  for (const o of solidOthers(b, self)) {
    const top = o.y - TANK_H;
    if (Math.abs(o.x - x) < (TANK_W + w) / 2 && top >= fromY - RESTING && (!best || top < best.y)) best = { y: top, m: Material.Earth };
  }
  return best;
}

/** A fresh battle: `entries` in order, each placed at a random spot in its side's half, then the first turn. */
export function createBattle(random: Random, map: MapId, entries: Entry[]): Battle {
  const resolved: PlayableMap = map === MapId.Random ? PLAYABLE_MAPS[Math.floor(random() * PLAYABLE_MAPS.length)] : map;
  const lefts = entries.filter(e => e.side === Side.Left), rights = entries.filter(e => e.side === Side.Right);
  const { terrain, spots } = generate(random, resolved, lefts.length, rights.length);
  const b: Battle = { terrain, tanks: [], crates: [], round: 0, order: [], active: 0, phase: Phase.Aim, turnLeftMs: TURN_MS,
    wind: 0, shell: null, winner: null, settleT: 0, nextCrate: 0, boom: null };
  [...lefts, ...rights].forEach((e, i) => b.tanks.push(newTank(b, i, e, spots[i])));
  startTurn(b, random);
  return b;
}

/** A tank at x resting on the ground (new battles here, and online battles as the runner sent them). */
export function newTank(b: Battle, id: number, e: Entry, x: number): Tank {
  const g = support(b, x, TANK_W, 0, id) ?? { y: WORLD_H, m: Material.Earth };
  return { id, side: e.side, type: e.look.type, look: e.look, owner: e.owner, x, y: g.y, angle: clampAngle(e.look.type, START_ANGLE),
    power: START_POWER, fuel: FUEL, hearts: TANKS[e.look.type].hearts, alive: true, gone: false, doomed: false, vy: 0,
    falling: false, on: g.m, powerShell: false, shield: false, gripUntil: null, slide: 0, driving: 0 };
}

/** This round's turns (FR-006): Left, Right alternately while both sides have tanks to play, then the rest. */
export function buildOrder(b: Battle) {
  const left = b.tanks.filter(t => t.alive && t.side === Side.Left).map(t => t.id);
  const right = b.tanks.filter(t => t.alive && t.side === Side.Right).map(t => t.id);
  const order: number[] = [];
  while (left.length || right.length) { if (left.length) order.push(left.shift()!); if (right.length) order.push(right.shift()!); }
  return order;
}

/** The next turn (rolling a crate and a new order when a round ends). Returns a new crate, if one dropped. */
export function startTurn(b: Battle, random: Random): Crate | null {
  let crate: Crate | null = null;
  b.order = b.order.filter(id => b.tanks[id].alive);
  if (!b.order.length) {
    if (b.round > 0 && b.crates.length < MAX_CRATES) crate = addCrate(b, b.nextCrate, CRATE_SIZE + random() * (WORLD_W - 2 * CRATE_SIZE), rollDrop(random));
    b.order = buildOrder(b);
    b.round++;
  }
  setTurn(b, b.order.shift()!, Math.round((random() * 2 - 1) * WIND_MAX), TURN_MS, b.round);
  return crate;
}

/** A turn as told (online guests, and the end of startTurn). `rest`: the round's turns still to come, as the runner
 *  has them, so any device can run the battle from here on. */
export function setTurn(b: Battle, id: number, wind: number, leftMs: number, round: number, rest?: number[]) {
  if (rest) b.order = [...rest];
  b.round = round; b.active = id; b.wind = wind; b.turnLeftMs = leftMs; b.phase = Phase.Aim; b.shell = null;
  b.order = b.order.filter(o => o !== id);
  for (const t of b.tanks) { t.driving = 0; if (t.gripUntil !== null && t.gripUntil < round) t.gripUntil = null; }
  b.tanks[id].fuel = FUEL;
}

export function rollDrop(random: Random): Drop {
  let r = random() * DROP_CHANCES.reduce((n, [, c]) => n + c, 0);
  for (const [drop, chance] of DROP_CHANCES.slice(0, -1)) if ((r -= chance) < 0) return drop;
  return DROP_CHANCES[DROP_CHANCES.length - 1][0];
}

/** A crate starting to fall at x; online guests get `contents: null` (hidden until picked up). */
export function addCrate(b: Battle, id: number, x: number, contents: Drop | null): Crate {
  const c = { id, x, y: -CRATE_SIZE, falling: true, contents };
  b.crates.push(c); b.nextCrate = Math.max(b.nextCrate, id + 1);
  return c;
}

const grip = (b: Battle, t: Tank) => t.gripUntil !== null && t.gripUntil >= b.round ? Grip.High : TANKS[t.type].grip;
/** Starts a slide on snow or ice (FR-011): after driving stops (dir = the way it went) or when firing (dir = back). */
function startSlide(b: Battle, t: Tank, dir: number) {
  if (t.on !== Material.Snow && t.on !== Material.Ice) return;
  const d = Math.min(TANK_W, SLIDE * GRIP_SLIDE[grip(b, t)] * (t.on === Material.Ice ? ICE_SLIDE_FACTOR : 1));
  t.slide = dir * d;
}

/** Moves a tank sideways by dx along the ground, if it may go there (half, other tanks, slopes, water, gaps). */
function move(b: Battle, t: Tank, dx: number) {
  const dir = Math.sign(dx), [lo, hi] = half(t.side), nx = Math.min(hi, Math.max(lo, t.x + dx));
  if (nx === t.x) return false;
  if (solidOthers(b, t.id).some(o => Math.abs(o.x - nx) < TANK_W && Math.abs(o.y - t.y) < TANK_H)) return false;
  const climb = TANK_W / 2 * MAX_CLIMB, front = groundBelow(b.terrain, nx + dir * TANK_W / 2, t.y - climb);
  if (!front || front.m === Material.Water || t.y - front.y >= climb) return false; // a gap, water or too steep
  const g = support(b, nx, TANK_W, t.y - climb, t.id);
  if (!g || g.m === Material.Water) return false;
  t.x = nx;
  if (g.y - t.y > BIG_DROP) t.falling = true; else { t.y = g.y; t.on = g.m; }
  return true;
}

/** Fires the active tank's shell (FR-004); a power shell does 1.5× damage, halves rounding up (research R4). */
export function fire(b: Battle) {
  const t = activeTank(b), f = facing(t.side), base = TANKS[t.type].damage;
  b.shell = makeShell(t, t.angle, t.power, t.powerShell ? Math.round(base * POWER_SHELL_FACTOR) : base);
  t.powerShell = false; t.driving = 0;
  startSlide(b, t, -f);
  b.phase = Phase.Flight;
}

/** A shell leaving t's cannon at an angle and power. */
export function makeShell(t: Tank, angle: number, power: number, damage: number): Shell {
  const f = facing(t.side), rad = angle * Math.PI / 180, speed = power * POWER_SCALE;
  return { x: t.x + f * Math.cos(rad) * MUZZLE, y: t.y - TANK_H * 0.7 - Math.sin(rad) * MUZZLE,
    vx: f * Math.cos(rad) * speed, vy: -Math.sin(rad) * speed, trail: [], from: t.id, age: 0, damage };
}

const inBox = (t: Tank, x: number, y: number, pad = 0) =>
  x >= t.x - TANK_W / 2 - pad && x <= t.x + TANK_W / 2 + pad && y >= t.y - TANK_H - pad && y <= t.y + pad;
const distToBox = (t: Tank, x: number, y: number) => {
  const dx = Math.max(t.x - TANK_W / 2 - x, 0, x - t.x - TANK_W / 2), dy = Math.max(t.y - TANK_H - y, 0, y - t.y);
  return Math.sqrt(dx * dx + dy * dy);
};

/** A blast (FR-005, FR-009, FR-025): carves the ground, takes the damage from every live tank it reaches (a shield
 *  takes the hit instead), destroys crates; wrecks are untouched. */
export function blast(b: Battle, x: number, y: number, r: number, damage: number, ev: Events) {
  carve(b.terrain, x, y, r);
  for (const t of b.tanks) {
    if (!t.alive || distToBox(t, x, y) > r) continue;
    if (t.shield) { t.shield = false; continue; }
    t.hearts -= damage;
    if (t.hearts <= 0) { t.alive = false; ev.destroyed.push(t.id); }
  }
  b.crates = b.crates.filter(c => Math.hypot(c.x - x, c.y - CRATE_SIZE / 2 - y) > r + CRATE_SIZE / 2);
  ev.blasts.push([x, y, r]);
  b.boom = { x, y, r, t: 0 };
}

export const Flying = { On: 0, Lost: 1, Hit: 2 } as const;
/** Moves a shell one step (in small pieces, so it can't pass through thin ground): still flying, lost (off the sides or
 *  bottom, or into water: no effect), or hit (ground, a tank or wreck, a crate). Only the shell changes. */
export function flyStep(b: Battle, s: Shell, dt: number) {
  s.age += dt;
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(s.vx), Math.abs(s.vy)) * dt / 2)), h = dt / n;
  for (let i = 0; i < n; i++) {
    s.vx += b.wind * h; s.vy += GRAVITY * h; s.x += s.vx * h; s.y += s.vy * h;
    if (s.x < 0 || s.x > WORLD_W || s.y > WORLD_H) return Flying.Lost;
    if (s.y < 0) continue; // above the screen: still flying
    const m = cellAt(b.terrain, s.x, s.y);
    if (m === Material.Water) return Flying.Lost;
    if (isSolid(m) || b.tanks.some(t => !t.gone && (t.id !== s.from || s.age > SELF_SAFE) && inBox(t, s.x, s.y))
      || b.crates.some(c => Math.abs(c.x - s.x) < CRATE_SIZE / 2 && s.y <= c.y && s.y >= c.y - CRATE_SIZE)) return Flying.Hit;
  }
  return Flying.On;
}

function stepShell(b: Battle, dt: number, ev: Events) {
  const s = b.shell!, result = flyStep(b, s, dt);
  if (result === Flying.On) {
    s.trail.push([s.x, s.y]);
    if (s.trail.length > TRAIL_MAX) s.trail.shift();
    return;
  }
  if (result === Flying.Hit) blast(b, s.x, s.y, BLAST_R, s.damage, ev);
  b.shell = null; b.phase = Phase.Settle; b.settleT = 0;
}

function destroy(t: Tank, ev: Events) { if (t.alive) { t.alive = false; ev.destroyed.push(t.id); } }

// falls (FR-009, FR-025): drop onto what's left; nothing below → off the screen; water → sinks; off wood → destroyed
function stepFalls(b: Battle, dt: number, ev: Events) {
  let moving = false;
  for (const t of b.tanks) {
    if (t.gone) continue;
    const g = support(b, t.x, TANK_W, t.y - RESTING, t.id);
    if (!t.falling) {
      if (g && g.y <= t.y + RESTING) continue;           // still resting
      if (t.on === Material.Wood) { destroy(t, ev); t.doomed = true; } // the wood under it went: no wreck
      t.falling = true; t.vy = 0;
    }
    moving = true;
    t.vy += GRAVITY * dt;
    const ny = t.y + t.vy * dt;
    if (g && g.y <= ny) {
      t.y = g.y; t.falling = false; t.vy = 0; t.on = g.m;
      if (g.m === Material.Water || t.doomed) { destroy(t, ev); t.gone = true; }
    } else {
      t.y = ny;
      if (t.y > FALL_OUT) { destroy(t, ev); t.gone = true; t.falling = false; }
    }
  }
  return moving;
}

function stepSlides(b: Battle, dt: number) {
  let moving = false;
  for (const t of b.tanks) {
    if (!t.slide || t.gone || t.falling) continue;
    const d = Math.sign(t.slide) * Math.min(Math.abs(t.slide), SLIDE_SPEED * dt);
    if (move(b, t, d)) { t.slide -= d; moving = true; } else t.slide = 0;
  }
  return moving;
}

/** Applies a crate to a tank (FR-021). Contents unknown (an online guest) → nothing here: the runner says. */
export function pickUp(b: Battle, t: Tank, c: Crate, ev: Events) {
  b.crates = b.crates.filter(x => x !== c);
  if (!c.contents) return;
  if (c.contents === Drop.Repair) t.hearts = Math.min(TANKS[t.type].hearts, t.hearts + REPAIR);
  if (c.contents === Drop.Power) t.powerShell = true;
  if (c.contents === Drop.GripGear) t.gripUntil = b.round + 1;
  if (c.contents === Drop.Shield) t.shield = true;
  ev.got.push([t.id, c.contents]);
}

function stepCrates(b: Battle, dt: number, ev: Events) {
  for (const c of [...b.crates]) {
    const toucher = b.tanks.find(t => t.alive && Math.abs(t.x - c.x) < (TANK_W + CRATE_SIZE) / 2 && c.y >= t.y - TANK_H - 1 && c.y - CRATE_SIZE <= t.y);
    if (toucher) { pickUp(b, toucher, c, ev); continue; }
    const g = support(b, c.x, CRATE_SIZE, c.y - RESTING);
    if (g && g.y <= c.y + RESTING) { if (c.falling) { c.falling = false; ev.landed.push(c.id); } continue; }
    c.falling = true;
    const ny = c.y + CRATE_SPEED * dt;
    if (g && g.y <= ny) {
      c.y = g.y; c.falling = false;
      if (g.m === Material.Water) b.crates = b.crates.filter(x => x !== c); else ev.landed.push(c.id);
    } else if ((c.y = ny) > FALL_OUT) b.crates = b.crates.filter(x => x !== c);
  }
}

/** Which side won, if the battle is over (FR-005): a side with no live tanks has lost; both empty = draw. */
export function winnerOf(b: Battle): Winner {
  const left = b.tanks.some(t => t.alive && t.side === Side.Left), right = b.tanks.some(t => t.alive && t.side === Side.Right);
  return left && right ? null : left ? Side.Left : right ? Side.Right : DRAW;
}

/** One fixed step. `input` drives the active tank (pass NO_INPUT when someone else moves it, e.g. online). */
export function step(b: Battle, input: Input, dt: number): Events {
  const ev = noEvents();
  if (b.boom) b.boom.t += dt;
  stepCrates(b, dt, ev);
  if (b.phase === Phase.Over) return ev;
  const t = activeTank(b);
  if (b.phase === Phase.Aim) {
    b.turnLeftMs -= dt * 1000;
    if (t.alive && !t.falling) {
      t.angle = clampAngle(t.type, t.angle + input.aim * ANGLE_SPEED * dt);
      t.power = Math.min(100, Math.max(0, t.power + input.power * POWER_SPEED * dt));
      const dx = Math.min(t.fuel, DRIVE_SPEED * dt);
      const dir = Math.sign(input.drive);
      if (dir && dx > 0 && !t.slide && move(b, t, dir * dx)) { t.fuel -= dx; t.driving = dir; }
      else if (t.driving) { startSlide(b, t, t.driving); t.driving = 0; }
      if (input.fire) { fire(b); ev.fired = true; }
    }
    if (b.phase === Phase.Aim && (b.turnLeftMs <= 0 || !t.alive)) { b.turnLeftMs = 0; b.phase = Phase.Settle; b.settleT = SETTLE_MIN; ev.timeout = true; }
  } else if (b.phase === Phase.Flight) stepShell(b, dt, ev);
  const sliding = stepSlides(b, dt);
  const falling = stepFalls(b, dt, ev);
  if (b.phase === Phase.Settle) {
    b.settleT += dt;
    if (!sliding && !falling && b.settleT >= SETTLE_MIN) {
      b.winner = winnerOf(b);
      if (b.winner) b.phase = Phase.Over;
      ev.settled = true;
    }
  }
  return ev;
}


/** Sets the active tank's pose as its own device drove it (online), held inside its half and its type's limits. */
export function setPose(b: Battle, id: number, x: number, angle: number, power: number, fuel: number) {
  const t = b.tanks[id], [lo, hi] = half(t.side);
  if (!t.alive) return;
  t.x = Math.min(hi, Math.max(lo, x)); t.angle = clampAngle(t.type, angle);
  t.power = Math.min(100, Math.max(0, power)); t.fuel = Math.min(t.fuel, Math.max(0, fuel));
  const g = support(b, t.x, TANK_W, t.y - TANK_W, t.id);
  if (g && g.m !== Material.Water) { t.y = g.y; t.on = g.m; }
}
