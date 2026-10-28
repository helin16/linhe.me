import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMPACT_MEDIA, COMPACT_TOP, computerKarts, playerName, rosterRows, standingRows, UNKNOWN_COLOR, type Standing } from './standings.ts';

const field = (n: number, local: number[] = [], finished: number[] = []): Standing[] => Array.from({ length: n }, (_, i) => ({
  place: i + 1, name: `K${i}`, color: '#112233', local: local.includes(i + 1), time: finished.includes(i + 1) ? '1:02.50' : null,
}));
const places = (rows: Standing[]) => rows.map(r => r.place);

test('every kart is shown on a big screen, in the order given', () => {
  assert.deepEqual(places(standingRows(field(4, [2]), false)), [1, 2, 3, 4]);
  assert.deepEqual(places(standingRows(field(12, [7]), false)), Array.from({ length: 12 }, (_, i) => i + 1));
  // an overtake is just a new order: the rows follow it
  const before = field(4, [3]), after = [before[0], before[2], before[1], before[3]].map((s, i) => ({ ...s, place: i + 1 }));
  assert.deepEqual(standingRows(after, false).map(r => r.name), ['K0', 'K2', 'K1', 'K3']);
});

test('on a phone: the top places plus our own rows outside them', () => {
  assert.equal(COMPACT_TOP, 3);
  assert.deepEqual(places(standingRows(field(12, [2]), true)), [1, 2, 3]);       // we're in the top 3
  assert.deepEqual(places(standingRows(field(12, [9]), true)), [1, 2, 3, 9]);    // we're 9th
  assert.deepEqual(places(standingRows(field(4, [4, 1]), true)), [1, 2, 3, 4]);  // 2P: both players
  assert.deepEqual(places(standingRows(field(12, [5, 11]), true)), [1, 2, 3, 5, 11]);
  assert.match(COMPACT_MEDIA, /max-width: 700px.*max-height: 500px/);
});

test('a finished kart keeps its time on its row', () => {
  const rows = standingRows(field(4, [1], [1, 2]), false);
  assert.deepEqual(rows.map(r => r.time), ['1:02.50', '1:02.50', null, null]);
});

test('names: blank or missing show as "Player N"; long ones are cut like the garage does', () => {
  assert.equal(playerName('Ann', 0), 'Ann');
  assert.equal(playerName('  Bo  ', 1), 'Bo');
  for (const blank of ['', '   ', undefined, 7]) assert.equal(playerName(blank, 2), 'Player 3');
  assert.equal(playerName('ABCDEFGHIJKLMN', 0), 'ABCDEFGHIJ');
});

test('the roster: everyone by slot, host = lowest slot, you marked, unknown profiles grey', () => {
  const own = { name: 'Me', color: '#ff0000' };
  const profiles = { 0: { name: 'Host', color: '#00ff00' }, 3: { name: '', color: '#0000ff' } };
  assert.deepEqual(rosterRows(2, [3, 0, 5], profiles, own), [
    { slot: 0, name: 'Host', color: '#00ff00', host: true, you: false },
    { slot: 2, name: 'Me', color: '#ff0000', host: false, you: true },
    { slot: 3, name: 'Player 4', color: '#0000ff', host: false, you: false },
    { slot: 5, name: 'Player 6', color: UNKNOWN_COLOR, host: false, you: false }, // hasn't sent its profile yet
  ]);
  // after a hand-over the lowest remaining slot is host, even if it isn't slot 0
  assert.deepEqual(rosterRows(1, [4], {}, own).map(r => [r.slot, r.host, r.you]), [[1, true, true], [4, false, false]]);
  assert.deepEqual(rosterRows(0, [], {}, own), [{ slot: 0, name: 'Me', color: '#ff0000', host: true, you: true }]);
});

test('computer karts fill the empty spots', () => {
  assert.equal(computerKarts(4, 1), 3);
  assert.equal(computerKarts(12, 12), 0);
  assert.equal(computerKarts(4, 6), 0);
});
