import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CloseCode, CODE_LENGTH, DEFAULT_ROOM_SIZE, isGameName, isRelayMsg, NEW_ROOM, normaliseCode, parseRelayPath, RelayMsg, relayUrl, roomsUrl } from './protocol.ts';

test('relayUrl builds ws(s) addresses for creating and joining', () => {
  assert.equal(relayUrl('https://example.com/relay/', 'turbo-tumble', NEW_ROOM), 'wss://example.com/relay/turbo-tumble/new');
  assert.equal(relayUrl('http://localhost:5173/relay/', 'turbo-tumble', 'K7QP'), 'ws://localhost:5173/relay/turbo-tumble/K7QP');
  assert.equal(relayUrl('wss://example.com/relay', 'g', 'K7QP'), 'wss://example.com/relay/g/K7QP');
  assert.equal(relayUrl('https://example.com/relay/', 'g', NEW_ROOM, 8), 'wss://example.com/relay/g/new?size=8');
});

test('roomsUrl gives the http(s) list address, even from a ws(s) base', () => {
  assert.equal(roomsUrl('https://example.com/relay/', 'g'), 'https://example.com/relay/g/rooms');
  assert.equal(roomsUrl('wss://example.com/relay', 'g'), 'https://example.com/relay/g/rooms');
  assert.equal(roomsUrl('ws://localhost:1/relay/', 'g'), 'http://localhost:1/relay/g/rooms');
});

test('parseRelayPath reads create and join paths and rejects bad ones', () => {
  assert.deepEqual(parseRelayPath('/relay/turbo-tumble/new'), { game: 'turbo-tumble', create: true, size: DEFAULT_ROOM_SIZE });
  assert.deepEqual(parseRelayPath('/relay/turbo-tumble/new', '?size=12'), { game: 'turbo-tumble', create: true, size: 12 });
  for (const bad of ['?size=', '?size=x', '?size=-1', '?size=1.5', '?size=9999'])
    assert.equal(parseRelayPath('/relay/turbo-tumble/new', bad), null, bad);
  assert.deepEqual(parseRelayPath('/relay/turbo-tumble/rooms'), { game: 'turbo-tumble', list: true });
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
  assert.deepEqual(Object.values(CloseCode), [4400, 4404, 4409, 4410, 4413, 4423, 4429, 4503]);
  assert.deepEqual(RelayMsg, { Hello: 'hello', Join: 'join', Leave: 'leave', Room: 'room', Lock: 'room-lock', Open: 'room-open', Close: 'room-close' });
  assert.ok(isRelayMsg('room-close') && !isRelayMsg('me'));
});
