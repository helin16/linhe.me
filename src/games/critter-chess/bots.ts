// Computer players (FR-013, research R5): an evaluation (material, a little for the centre and for pushed pawns), Easy
// (random, liking captures), Normal (the best move one ply ahead, not leaving the moved piece hanging), Hard (2 players:
// alpha-beta with iterative deepening; 4/6: each move against the next player's strongest reply). Every level stops
// within BOT_BUDGET_MS: Normal's full scoring stops at its deadline (moves left get a quick estimate), and Hard gives it
// half the budget, keeping the rest for looking ahead. The Normal choice is also the Hint and the move played when a turn times out.
import { ADVANCE_WEIGHT, BOT_BUDGET_MS, CENTRE_WEIGHT, CHECK_BONUS, KING_WEIGHT, EASY_CAPTURE_CHANCE, HANG_WEIGHT, MATE_SCORE, MAX_DEPTH, VALUE } from './constants.ts';
import { Difficulty, GameState, PieceKind, SeatState } from './enums.ts';
import { applyMove, attacked, attackedBy, cloneGame, inCheck, legalMoves, tryMove, type Game, type Move } from './rules.ts';
import type { Random } from '../../shared/seed.ts';

const value = (k: PieceKind) => VALUE[k];

/** A seat's position: its material and placement, minus the average of its rivals' material. */
export function evaluate(g: Game, seat: number) {
  const b = g.board, back = b.armies[seat].back, bx = back.reduce((s, c) => s + b.pos[c][0], 0) / back.length,
    by = back.reduce((s, c) => s + b.pos[c][1], 0) / back.length;
  let own = 0, rivals = 0;
  for (const p of g.pieces) {
    if (p.cell < 0) continue;
    const [x, y] = b.pos[p.cell];
    if (p.seat !== seat) { rivals += value(p.kind); continue; }
    own += value(p.kind);
    if (p.kind === PieceKind.Pawn) own += ADVANCE_WEIGHT * Math.hypot(x - bx, y - by);
    else if (p.kind === PieceKind.King) own -= KING_WEIGHT * Math.hypot(x - bx, y - by); // a king is safest at home
    else own -= CENTRE_WEIGHT * Math.hypot(x, y);
  }
  const others = g.seats.filter(s => s.id !== seat && s.state === SeatState.Playing).length;
  return own - (others ? rivals / others : 0);
}

/** A finished game's worth to a seat: a win (sooner is better), a draw (first place shared, whoever else is out), or a
 *  loss. */
export const outcome = (h: Game, seat: number, depth: number) =>
  h.seats[seat].place !== 1 ? -MATE_SCORE : h.seats.filter(s => s.place === 1).length > 1 ? 0 : MATE_SCORE + depth;

/** Normal's view of a move, played out: a win or a draw scores as such (so a player far ahead won't stalemate or repeat);
 *  otherwise the position after it, less the moved piece's worth if left attacked and undefended, plus a little for check. */
export function quickScore(g: Game, m: Move) {
  const seat = g.pieces[m.piece].seat, h = cloneGame(g);
  applyMove(h, m);
  if (h.state === GameState.Over) return outcome(h, seat, 0);
  if (h.seats[seat].state !== SeatState.Playing) return -MATE_SCORE;
  const p = h.pieces[m.piece], hanging = attacked(h, m.to, seat) && !attackedBy(h, m.to, s => s === seat);
  // check helps finish a 2-player game; with more players it only sends kings walking
  const check = h.seats.length === 2 && h.seats.some(s => s.id !== seat && s.state === SeatState.Playing && inCheck(h, s.id));
  return evaluate(h, seat) - (hanging ? HANG_WEIGHT * value(p.kind) : 0) + (check ? CHECK_BONUS : 0);
}
const bestBy = (moves: Move[], score: (m: Move) => number) => {
  let best = moves[0], top = -Infinity;
  for (const m of moves) { const s = score(m); if (s > top) { top = s; best = m; } }
  return best;
};

/** 2 players: negamax with alpha-beta from the side to move; null when time ran out. */
function search(g: Game, depth: number, alpha: number, beta: number, until: number): number | null {
  if (performance.now() > until) return null;
  const seat = g.turn;
  if (depth === 0) return evaluate(g, seat);
  const moves = legalMoves(g, seat).sort((a, b) => +(b.capture >= 0) - +(a.capture >= 0));
  for (const m of moves) {
    const h = cloneGame(g, false);
    applyMove(h, m);
    let v: number | null;
    if (h.state === GameState.Over) v = outcome(h, seat, depth);
    else { const r = search(h, depth - 1, -beta, -alpha, until); v = r === null ? null : -r; }
    if (v === null) return null;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return alpha;
}

/** The move a computer player makes for the seat in turn (there is always one: seats without moves are skipped). */
export function botMove(g: Game, random: Random, level: Difficulty, budgetMs = BOT_BUDGET_MS): Move {
  const seat = g.turn, moves = legalMoves(g, seat), until = performance.now() + budgetMs;
  if (level === Difficulty.Easy) {
    const captures = moves.filter(m => m.capture >= 0);
    const pool = captures.length && random() < EASY_CAPTURE_CHANCE ? captures : moves;
    return pool[Math.floor(random() * pool.length)];
  }
  const start = performance.now(), scoreUntil = level === Difficulty.Hard ? start + budgetMs / 2 : until;
  const estimate = (m: Move) => tryMove(g, m, () => evaluate(g, seat)); // cheap: no play-through
  const quick = new Map(moves.map(m => [m, performance.now() < scoreUntil ? quickScore(g, m) : estimate(m)]));
  const normal = bestBy(moves, m => quick.get(m)!);
  if (level === Difficulty.Normal) return normal;
  if (g.seats.length === 2) {
    let pick = normal;
    for (let depth = 2; depth <= MAX_DEPTH; depth++) { // deepen while time allows; keep the last finished depth's choice
      let best: Move | null = null, top = -Infinity;
      for (const m of [pick, ...moves.filter(x => x !== pick)]) {
        const h = cloneGame(g, false);
        applyMove(h, m);
        const r = h.state === GameState.Over ? -outcome(h, seat, depth) : search(h, depth - 1, -Infinity, -top, until);
        if (r === null) { best = null; break; }
        const v = -r;
        if (v > top) { top = v; best = m; }
      }
      if (!best) break;
      pick = best;
      if (top >= MATE_SCORE) break;
    }
    return pick;
  }
  // 4/6 players: each of the best few moves against the next player's reply that hurts this seat most
  let pick = normal, top = -Infinity;
  const king = g.pieces.findIndex(p => p.seat === seat && p.kind === PieceKind.King && p.cell >= 0);
  for (const m of [...moves].sort((a, b) => quick.get(b)! - quick.get(a)!)) { // best-looking first: the budget may cut the rest
    if (performance.now() > until) break;
    const h = cloneGame(g);
    applyMove(h, m);
    let worst: number;
    if (h.state === GameState.Over || h.seats[seat].state !== SeatState.Playing) worst = outcome(h, seat, 0);
    else worst = legalMoves(h, h.turn).reduce((low, r) =>
      Math.min(low, tryMove(h, r, () => king < 0 || h.pieces[king].cell < 0 ? -MATE_SCORE : evaluate(h, seat))), evaluate(h, seat));
    if (worst > top) { top = worst; pick = m; }
  }
  return pick;
}

/** One good move for the person in turn (the Hint), and the move played for them when their time runs out. */
export const hint = (g: Game) => botMove(g, Math.random, Difficulty.Normal);
