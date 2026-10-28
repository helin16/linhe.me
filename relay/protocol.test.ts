import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CloseCode, CODE_LENGTH, isGameName, NEW_ROOM, normaliseCode, parseRelayPath, RelayMsg, relayUrl } from './protocol.ts';

test('relayUrl builds ws(s) addresses for creating and joining', () => {
  assert.equal(relayUrl('https://example.com/relay/', 'turbo-tumble', NEW_ROOM), 'wss://example.com/relay/turbo-tumble/new');
  assert.equal(relayUrl('http://localhost:5173/relay/', 'turbo-tumble', 'K7QP'), 'ws://localhost:5173/relay/turbo-tumble/K7QP');
  assert.equal(relayUrl('wss://example.com/relay', 'g', 'K7QP'), 'wss://example.com/relay/g/K7QP');
});

test('parseRelayPath reads create and join paths and rejects bad ones', () => {
  assert.deepEqual(parseRelayPath('/relay/turbo-tumble/new'), { game: 'turbo-tumble', create: true });
  assert.deepEqual(parseRelayPath('/relay/turbo-tumble/k7 qp'), { game: 'turbo-tumble', code: 'K7QP' });
  assert.deepEqual(parseRelayPath('/relay/turbo-tumble/k7%20qp'), { game: 'turbo-tumble', code: 'K7QP' });
  for (const bad of ['/relay/Bad_Game/K7QP', '/relay/', '/relay/turbo-tumble/', '/other/turbo-tumble/K7QP',
    `/relay/${'a'.repeat(33)}/K7QP`, '/relay/turbo-tumble/K7Q', '/relay/turbo-tumble/K7QO', '/relay/turbo-tumble/K7QP/x', '/relay/turbo-tumble/%E0%A4%A'])
    assert.equal(parseRelayPath(bad), null, bad);
});

test('game names and codes', () => {
  assert.ok(isGameName('turbo-tumble') && isGameName('a') && isGameName('x'.repeat(32)));
  for (const bad of ['', 'Turbo', 'a_b', 'x'.repeat(33), 'a/b']) assert.ok(!isGameName(bad), bad);
  assert.equal(normaliseCode(' k7 q p '), 'K7QP');
  assert.equal(CODE_LENGTH, 4);
});

test('close codes and relay messages keep their wire values', () => {
  assert.deepEqual(Object.values(CloseCode), [4400, 4404, 4409, 4413, 4429, 4503]);
  assert.deepEqual(RelayMsg, { Hello: 'hello', Join: 'join', Leave: 'leave' });
});
