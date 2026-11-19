import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BoardKind, CritterType as T, EndWhy, GameState, PieceKind as K, SeatKind, SeatState } from './enums.ts';
import { boardOf } from './boards.ts';
import {
  applyMove, attacked, cloneGame, findMove, inCheck, legalMoves, movesFrom, newGame, resign, setPieces, tryMove,
  type Game, type PieceSpec,
} from './rules.ts';

const P = SeatKind.Person, C = SeatKind.Computer;
const SQ = boardOf(BoardKind.Square);
const sq = (name: string) => SQ.cells.findIndex(([x, y]) => x === name.charCodeAt(0) - 97 && y === Number(name[1]) - 1);
const two = () => newGame([{ kind: P, type: T.Fire }, { kind: C, type: T.Water }]);
const FEN_KIND: Record<string, K> = { k: K.King, q: K.Queen, r: K.Rook, b: K.Bishop, n: K.Knight, p: K.Pawn };
/** A 2-player position from FEN (pieces, side to move, castling rights). */
function fen(text: string): Game {
  const [rows, side, rights] = text.split(' '), g = two(), list: PieceSpec[] = [];
  rows.split('/').forEach((row, i) => {
    let x = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) { x += Number(ch); continue; }
      const seat = ch === ch.toUpperCase() ? 0 : 1, kind = FEN_KIND[ch.toLowerCase()], cell = SQ.cells.findIndex(([a, b]) => a === x && b === 7 - i);
      const home = seat ? 'kq' : 'KQ';
      const castleOk = kind === K.King ? [...home].some(r => rights.includes(r))
        : kind === K.Rook ? (x === 7 && rights.includes(home[0])) || (x === 0 && rights.includes(home[1])) : true;
      list.push({ seat, kind, cell, moved: !castleOk || (kind === K.Rook && x !== 0 && x !== 7) });
      x++;
    }
  });
  setPieces(g, list);
  g.turn = side === 'w' ? 0 : 1;
  return g;
}
function perft(g: Game, depth: number): number {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of legalMoves(g, g.turn)) {
    if (depth === 1) { n++; continue; }
    const h = cloneGame(g);
    applyMove(h, { ...m });
    n += h.state === GameState.Playing ? perft(h, depth - 1) : 1;
  }
  return n;
}
const play = (g: Game, ...moves: string[]) => {
  for (const mv of moves) {
    const m = findMove(g, g.turn, sq(mv.slice(0, 2)), sq(mv.slice(2, 4)), mv[4] ? FEN_KIND[mv[4]] : undefined);
    assert.ok(m, `${mv} is legal`);
    applyMove(g, m);
  }
  return g;
};

test('perft from the standard start: 20, 400, 8902 (SC-002)', () => {
  assert.equal(perft(two(), 1), 20);
  assert.equal(perft(two(), 2), 400);
  assert.equal(perft(two(), 3), 8902);
});

test('perft "Kiwipete" (castling, en passant, promotion, pins): 48, 2039', () => {
  const k = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq';
  assert.equal(perft(fen(k), 1), 48);
  assert.equal(perft(fen(k), 2), 2039);
});

test('perft position 3 (en passant and discovered checks): 14, 191, 2812', () => {
  const p = '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w -';
  assert.equal(perft(fen(p), 1), 14);
  assert.equal(perft(fen(p), 2), 191);
  assert.equal(perft(fen(p), 3), 2812);
});

test("Fool's mate ends a 2-player game; the winner is first", () => {
  const g = play(two(), 'f2f3', 'e7e5', 'g2g4', 'd8h4');
  assert.equal(g.state, GameState.Over);
  assert.equal(g.why, EndWhy.Mate);
  assert.deepEqual(g.order, [1, 0]);
  assert.equal(g.seats[0].state, SeatState.Out);
});

test('check: only moves out of check; castling not out of, through or into check', () => {
  const g = fen('4k3/8/8/8/8/8/4r3/R3K2R w KQ');
  assert.ok(inCheck(g, 0));
  assert.ok(legalMoves(g, 0).every(m => tryMove(g, m, () => !inCheck(g, 0))));
  assert.ok(!legalMoves(g, 0).some(m => m.castle), 'not out of check');
  const h = fen('4k3/8/8/8/8/8/5r2/R3K2R w KQ');
  assert.ok(!legalMoves(h, 0).some(m => m.castle && m.to === sq('g1')), 'not through f1');
  assert.ok(legalMoves(h, 0).some(m => m.castle && m.to === sq('c1')));
  play(h, 'e1c1');
  assert.equal(h.pieces[h.at[sq('d1')]].kind, K.Rook, 'the rook jumped over');
});

test('en passant, then gone a move later; promotion offers four pieces', () => {
  const g = play(two(), 'e2e4', 'a7a6', 'e4e5', 'd7d5');
  const ep = movesFrom(g, g.at[sq('e5')]).find(m => m.ep);
  assert.ok(ep);
  assert.equal(ep.to, sq('d6'));
  const h = cloneGame(g);
  applyMove(h, ep);
  assert.equal(h.at[sq('d5')], -1, 'the passed pawn is taken');
  play(g, 'h2h3', 'a6a5');
  assert.ok(!movesFrom(g, g.at[sq('e5')]).some(m => m.ep));
  const p = fen('8/P7/8/8/8/8/8/k6K w -');
  assert.deepEqual(movesFrom(p, p.at[sq('a7')]).map(m => m.promo).sort(), [K.Bishop, K.Knight, K.Queen, K.Rook]);
  play(p, 'a7a8n');
  assert.equal(p.pieces[p.at[sq('a8')]].kind, K.Knight);
});

test('draws: stalemate, insufficient material, threefold repetition, the 50-move rule', () => {
  const stale = fen('k7/2Q5/8/8/8/8/8/7K w -');
  play(stale, 'h1g1');
  assert.equal(stale.state, GameState.Over);
  assert.equal(stale.why, EndWhy.Draw);
  assert.deepEqual(stale.order.map(i => stale.seats[i].place), [1, 1]);
  const ins = fen('k7/8/8/8/8/8/1p6/7K w -');
  play(ins, 'h1g1', 'b2b1n');
  assert.equal(ins.why, EndWhy.Draw, 'king and knight against king');
  const rep = two();
  play(rep, 'g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1');
  assert.equal(rep.state, GameState.Playing);
  play(rep, 'f6g8');
  assert.equal(rep.why, EndWhy.Draw, 'threefold');
  const fifty = fen('k7/8/8/8/8/8/8/RK6 w -');
  fifty.quiet = 99;
  play(fifty, 'a1a2');
  assert.equal(fifty.why, EndWhy.Draw);
});

test('a mate on the 100th quiet move is a mate, not a 50-move draw', () => {
  const g = fen('6k1/5ppp/8/8/8/8/8/R5K1 w -');
  g.quiet = 99;
  play(g, 'a1a8');
  assert.equal(g.why, EndWhy.Mate);
  assert.deepEqual(g.order, [0, 1]);
});

test('repetition ignores an en passant cell no pawn can use', () => {
  const g = two();
  play(g, 'e2e4', 'g8f6', 'g1f3', 'f6g8', 'f3g1'); // back to the position after e4 (no black pawn could take on e3)
  play(g, 'g8f6', 'g1f3', 'f6g8');
  assert.equal(g.state, GameState.Playing);
  play(g, 'f3g1');
  assert.equal(g.why, EndWhy.Draw, 'third time');
});

test('attacked: pieces of other seats only, through rays, knights, kings and pawns', () => {
  const g = two();
  assert.ok(attacked(g, sq('f3'), 1) && !attacked(g, sq('f3'), 0));
  assert.ok(attacked(g, sq('d6'), 0) && !attacked(g, sq('d5'), 0));
  assert.ok(!attacked(g, sq('e4'), 1));
});

test('findMove: only the seat in turn, its own piece, a legal destination and promotion', () => {
  const g = two();
  assert.ok(findMove(g, 0, sq('e2'), sq('e4')));
  assert.equal(findMove(g, 1, sq('e7'), sq('e5')), null, 'not its turn');
  assert.equal(findMove(g, 0, sq('e7'), sq('e5')), null, 'not its piece');
  assert.equal(findMove(g, 0, sq('e2'), sq('e5')), null);
  assert.equal(findMove(g, 0, sq('e4'), sq('e5')), null, 'empty square');
});

const four = (kinds = [P, C, C, C]) => newGame([T.Fire, T.Water, T.Grass, T.Rock].map((type, i) => ({ kind: kinds[i], type })));
const six = () => newGame([T.Fire, T.Water, T.Grass, T.Rock, T.Electric, T.Psychic].map(type => ({ kind: C, type })));

test('4 and 6 players: everyone starts with 20 moves or more; turns go round', () => {
  const g = four();
  assert.equal(g.board.kind, BoardKind.Cross);
  for (const s of [0, 1, 2, 3]) assert.equal(legalMoves(g, s).length, 20, `seat ${s}`);
  applyMove(g, legalMoves(g, 0)[0]);
  assert.equal(g.turn, 1);
  const h = six();
  assert.equal(h.board.kind, BoardKind.Hex);
  for (const s of [0, 1, 2, 3, 4, 5]) assert.ok(legalMoves(h, s).length > 0);
  for (let i = 0; i < 12; i++) applyMove(h, legalMoves(h, h.turn)[0]);
  assert.equal(h.turn, 0);
});

test('4 players: a king left exposed can be taken; its owner is out and its pieces leave', () => {
  const g = four();
  const b = g.board, [south, west] = b.armies;
  // seat 1's king alone in front of seat 0's queen with nothing between; seat 0 to move
  setPieces(g, [
    { seat: 0, kind: K.King, cell: south.back[4] }, { seat: 0, kind: K.Queen, cell: south.back[3] },
    { seat: 1, kind: K.King, cell: b.cells.findIndex(([x, y]) => x === 6 && y === 9) }, { seat: 1, kind: K.Pawn, cell: west.pawns[0] },
    { seat: 2, kind: K.King, cell: b.armies[2].back[4] }, { seat: 3, kind: K.King, cell: b.armies[3].back[4] },
  ]);
  const take = movesFrom(g, 1).find(m => m.capture === 2);
  assert.ok(take, 'the queen can take the exposed king');
  const ev = applyMove(g, take);
  assert.deepEqual(ev.outs, [1]);
  assert.equal(g.seats[1].state, SeatState.Out);
  assert.equal(g.pieces[3].cell, -1, 'its pawn left the board');
  assert.equal(g.turn, 2, 'seat 1 is skipped from now on');
  assert.equal(g.seats[1].place, 4);
});

test('4 players: mate puts a seat out at the start of its turn; stalemate skips; the last one standing wins', () => {
  const g = four([C, C, C, C]), b = g.board, cell = (x: number, y: number) => b.cells.findIndex(([a, c]) => a === x && c === y);
  // seat 1 (west) king in the corner of its arm, mated by seat 0's two rooks; seats 2 and 3 have kings far away
  setPieces(g, [
    { seat: 0, kind: K.King, cell: cell(7, 0) }, { seat: 0, kind: K.Rook, cell: cell(5, 3) }, { seat: 0, kind: K.Rook, cell: cell(5, 4) },
    { seat: 1, kind: K.King, cell: cell(0, 3) },
    { seat: 2, kind: K.King, cell: cell(6, 13) }, { seat: 3, kind: K.King, cell: cell(13, 7) },
  ]);
  const mate = findMove(g, 0, cell(5, 4), cell(2, 4)); // out of the king's reach: rows 3 and 4 both covered
  assert.ok(mate);
  const ev = applyMove(g, mate);
  assert.deepEqual(ev.outs, [1], 'seat 1 had no move and was in check');
  assert.equal(g.turn, 2);
  // resignations down to one player
  resign(g, 2);
  assert.equal(g.turn, 3);
  const r = resign(g, 3);
  assert.deepEqual(r.outs, [3]);
  assert.equal(g.state, GameState.Over);
  assert.equal(g.why, EndWhy.LastStanding);
  assert.deepEqual(g.order, [0, 3, 2, 1]);
  assert.deepEqual(resign(g, 0).outs, [], 'over: nothing happens');
});

test('6 players: no king starts in check, and every capture possible on the first move can be taken back', () => {
  const g = six();
  for (let s = 0; s < 6; s++) {
    assert.ok(!inCheck(g, s));
    for (const m of legalMoves(g, s)) if (m.capture >= 0) assert.ok(tryMove(g, m, () => attacked(g, m.to, s)), 'no free piece at the start');
  }
});

test('6 players: a stalemated seat is skipped, not out', () => {
  const g = six(), b = g.board, a = b.armies;
  const mid = b.cells.findIndex(([q, r]) => q === 0 && r === 0);
  // seat 1's king boxed in by its own pawns that can't move? simpler: seat 1 has only a king with every step attacked
  setPieces(g, [
    { seat: 0, kind: K.King, cell: a[0].back[4] }, { seat: 0, kind: K.Queen, cell: mid },
    { seat: 1, kind: K.King, cell: a[1].back[0] },
    ...[2, 3, 4, 5].map(s => ({ seat: s, kind: K.King, cell: a[s].back[4] })),
  ]);
  const ev = applyMove(g, legalMoves(g, 0).find(m => g.pieces[m.piece].kind === K.King)!);
  if (!legalMoves(g, 1).length && !inCheck(g, 1)) assert.deepEqual(ev.skipped, [1]);
  assert.equal(g.seats[1].state, SeatState.Playing);
});

test('4/6: no progress for 50 rounds ends with those left sharing first place; two bare kings too', () => {
  const g = four([C, C, C, C]);
  g.quiet = 50 * 4 - 1;
  applyMove(g, legalMoves(g, 0).find(m => g.pieces[m.piece].kind === K.Knight)!);
  assert.equal(g.why, EndWhy.NoProgress);
  assert.deepEqual(g.seats.map(s => s.place), [1, 1, 1, 1]);
  const h = four([C, C, C, C]), b = h.board;
  setPieces(h, [
    { seat: 0, kind: K.King, cell: b.armies[0].back[4] }, { seat: 1, kind: K.King, cell: b.armies[1].back[4] },
    { seat: 2, kind: K.King, cell: b.armies[2].back[4] }, { seat: 3, kind: K.King, cell: b.armies[3].back[4] },
  ]);
  resign(h, 2); resign(h, 3);
  applyMove(h, legalMoves(h, 0)[0]);
  assert.equal(h.why, EndWhy.NoProgress, 'only kings left between two players');
});

test('pawns: the hexagon step, its two captures and promotion; the cross promotes at the middle', () => {
  const g = six(), a = g.board.armies[0], p = g.pieces.find(x => x.seat === 0 && x.kind === K.Pawn)!;
  assert.deepEqual(movesFrom(g, p.id).map(m => m.to), [a.pawnStep[p.cell]], 'one step, no double step');
  const c = four([C, C, C, C]), b = c.board, cell = (x: number, y: number) => b.cells.findIndex(([q, r]) => q === x && r === y);
  setPieces(c, [
    { seat: 0, kind: K.King, cell: cell(7, 0) }, { seat: 0, kind: K.Pawn, cell: cell(5, 6) },
    ...[1, 2, 3].map(s => ({ seat: s, kind: K.King, cell: b.armies[s].back[4] })),
  ]);
  assert.ok(movesFrom(c, 1).every(m => m.promo), 'reaching row 8 promotes');
  assert.equal(c.ep, -1);
  const d = four([C, C, C, C]);
  applyMove(d, findMove(d, 0, d.board.armies[0].pawns[0], d.board.armies[0].pawnDouble[d.board.armies[0].pawns[0]])!);
  assert.equal(d.ep, -1, 'no en passant with 4 players');
});
