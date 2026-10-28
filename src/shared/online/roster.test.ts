import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computerSpots, playerName, rosterRows, UNKNOWN_COLOR } from './roster.ts';

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

test('computer players fill the empty spots', () => {
  assert.equal(computerSpots(4, 1), 3);
  assert.equal(computerSpots(12, 12), 0);
  assert.equal(computerSpots(4, 6), 0);
});
