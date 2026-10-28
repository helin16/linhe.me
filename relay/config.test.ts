import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, loadConfig } from './config.ts';

test('defaults when nothing is set', () => {
  assert.deepEqual(loadConfig({}), DEFAULTS);
  assert.deepEqual(DEFAULTS, { port: 8787, roomSize: 12, maxMessage: 8192, rate: 40, perAddress: 8, maxRooms: 500, pingMs: 30000, logMs: 60000, maxBuffer: 65536, listRate: 5 });
});

test('reads settings from the environment', () => {
  const c = loadConfig({ RELAY_PORT: '9000', RELAY_ROOM_SIZE: '2', RELAY_MAX_MESSAGE: '100', RELAY_RATE: '5', RELAY_PER_ADDRESS: '3', RELAY_MAX_ROOMS: '7', RELAY_PING_MS: '50', RELAY_LOG_MS: '20', RELAY_MAX_BUFFER: '99', RELAY_LIST_RATE: '3' });
  assert.deepEqual(c, { port: 9000, roomSize: 2, maxMessage: 100, rate: 5, perAddress: 3, maxRooms: 7, pingMs: 50, logMs: 20, maxBuffer: 99, listRate: 3 });
});

test('invalid or non-positive values fall back to the default', () => {
  for (const v of ['', 'abc', '0', '-1', '1.5', '1e3x']) assert.equal(loadConfig({ RELAY_RATE: v }).rate, DEFAULTS.rate, v);
});

test('port 0 is allowed (pick a free port, for tests)', () => {
  assert.equal(loadConfig({ RELAY_PORT: '0' }).port, 0);
});
