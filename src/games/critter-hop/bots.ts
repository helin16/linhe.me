// Computer players (FR-012, research R4): a greedy score of how much closer a move brings the team to its target,
// Easy picking loosely without long hops, Normal the best, Hard also counting its best follow-up and taking the
// leader's best move away. The same Normal choice is the Hint and the move played when a turn times out.
import { distance } from './boards.ts';
import { BLOCK_BONUS, EASY_STEP_CHANCE, EASY_TOP, FOLLOW_WEIGHT, REAR_BONUS, ROW_WEIGHT } from './constants.ts';
import { Difficulty, HopKind } from './enums.ts';
import { movesOf, type Game, type Move } from './rules.ts';
import type { Random } from '../../shared/seed.ts';

/** How far a hole is from a seat's target: rows to go first; outside the target, also the steps to the nearest hole
 *  of it not yet holding one of the seat's own creatures (so the last ones head for the gaps, not the tip). */
export function cost(g: Game, seat: number, hole: number) {
  const t = g.seats[seat].target, target = g.board.homes[t], rows = ROW_WEIGHT * g.board.rows[t][hole];
  if (target.includes(hole)) return rows;
  const free = target.filter(h => g.occupant[h] < 0 || g.pieces[g.occupant[h]].seat !== seat);
  return rows + Math.min(...free.map(h => distance(g.board, hole, h)));
}
const total = (g: Game, seat: number) => g.pieces.filter(p => p.seat === seat).reduce((s, p) => s + cost(g, seat, p.hole), 0);

/** A move's worth to its own team: the cut in distance, plus a little for moving the creature furthest behind. */
export function score(g: Game, m: Move) {
  const p = g.pieces[m.piece], from = cost(g, p.seat, p.hole), to = cost(g, p.seat, m.path[m.path.length - 1]);
  const rear = g.pieces.every(q => q.seat !== p.seat || cost(g, p.seat, q.hole) <= from);
  return from - to + (rear && to < from ? REAR_BONUS : 0);
}

/** Runs `fn` with the move made on the board, then puts it back. */
function tryMove<T>(g: Game, m: Move, fn: () => T): T {
  const p = g.pieces[m.piece], from = p.hole, to = m.path[m.path.length - 1];
  g.occupant[from] = -1; g.occupant[to] = p.id; p.hole = to;
  try { return fn(); } finally { g.occupant[to] = -1; g.occupant[from] = p.id; p.hole = from; }
}
const best = (g: Game, seat: number) => Math.max(0, ...movesOf(g, seat).map(m => score(g, m)));

/** The leader among the other seats still playing: the least distance left. */
function leader(g: Game, seat: number) {
  const rivals = g.seats.filter(s => s.id !== seat && s.place === null);
  return rivals.length ? rivals.reduce((a, b) => total(g, b.id) < total(g, a.id) ? b : a).id : -1;
}

/** The move a computer player makes for the seat in turn (there is always one: seats without moves are skipped). */
export function botMove(g: Game, random: Random, level: Difficulty): Move {
  const seat = g.turn, moves = movesOf(g, seat);
  if (level === Difficulty.Easy) {
    const plain = moves.filter(m => !m.kinds.includes(HopKind.LongHop));
    const pool = plain.length ? plain : moves;
    const steps = pool.filter(m => m.kinds[0] === HopKind.Step && score(g, m) > 0);
    if (steps.length && random() < EASY_STEP_CHANCE) return steps[Math.floor(random() * steps.length)];
    const top = [...pool].sort((a, b) => score(g, b) - score(g, a)).slice(0, EASY_TOP);
    return top[Math.floor(random() * top.length)];
  }
  if (level === Difficulty.Normal) return moves.reduce((a, b) => score(g, b) > score(g, a) ? b : a);
  const lead = leader(g, seat), leadBest = lead < 0 ? 0 : best(g, lead);
  const worth = (m: Move) => score(g, m) + tryMove(g, m, () =>
    FOLLOW_WEIGHT * best(g, seat) + (lead >= 0 && best(g, lead) < leadBest ? BLOCK_BONUS : 0));
  let pick = moves[0], top = -Infinity;
  for (const m of moves) { const w = worth(m); if (w > top) { top = w; pick = m; } }
  return pick;
}

/** One good move for the person in turn (the Hint), and the move played for them when their time runs out. */
export const hint = (g: Game) => botMove(g, Math.random, Difficulty.Normal);
