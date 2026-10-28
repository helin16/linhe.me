import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaults, KartStyle, loadSaved, loadSettings, saveSettings, Track } from './settings.ts';

test('missing, corrupt or null saves give defaults', () => {
  for (const raw of [null, 'not json', 'null']) assert.deepEqual(loadSettings(raw), defaults());
});

test('a full save keeps its values', () => {
  const saved = {
    players: [
      { name: 'Ann', color: '#000001', helmet: '#000002', skin: '#5c3a1e', style: 'Rocket' },
      { name: 'Bo', color: '#000003', helmet: '#000004', skin: '#7fdc6a', style: 'Classic' },
    ],
    two: true, map: 'Neon', muted: true,
  };
  assert.deepEqual(loadSettings(JSON.stringify(saved)), saved);
});

test('legacy single-player save becomes player 1', () => {
  const s = loadSettings('{"name":"Old","color":"#123456","helmet":"#ffffff","skin":"#ffe0bd","style":"Rocket"}');
  assert.deepEqual(s.players[0], { name: 'Old', color: '#123456', helmet: '#ffffff', skin: '#ffe0bd', style: KartStyle.Rocket });
  assert.deepEqual(s.players[1], { name: 'Player 2', color: '#22cc88', helmet: '#222222', skin: '#c68642', style: KartStyle.Buggy });
  for (const k of ['name', 'color', 'helmet', 'skin', 'style']) assert.ok(!(k in s), k);
});

test('malformed players and styles fall back to defaults', () => {
  const d = defaults();
  assert.deepEqual(loadSettings('{"players":null}').players, d.players);
  assert.deepEqual(loadSettings('{"players":[{"name":"X"}]}').players, [{ ...d.players[0], name: 'X' }, d.players[1]]);
  const s = loadSettings('{"players":[{"name":"Ann","color":"red","style":"Hover"},null],"two":"yes"}');
  assert.deepEqual(s.players[0], { ...d.players[0], name: 'Ann' });
  assert.deepEqual(s.players[1], d.players[1]);
  assert.equal(s.two, false);
  assert.equal(loadSettings('{"name":"Old"}').players[0].style, KartStyle.Classic); // legacy save without a style
});

test('unknown keys are dropped and __proto__ cannot change the object', () => {
  const s = loadSettings('{"foo":1,"__proto__":{"x":1},"map":"Desert"}');
  assert.deepEqual(Object.keys(s).sort(), ['map', 'muted', 'players', 'two']);
  assert.equal(Object.getPrototypeOf(s), Object.prototype);
  assert.equal(s.map, Track.Desert);
});

test('a track that no longer exists falls back to Meadow', () => {
  assert.equal(loadSettings('{"map":"Moon"}').map, Track.Meadow);
});

test('loading and saving never throw, even without working storage', () => {
  const g = globalThis as { localStorage?: unknown };
  const original = Object.getOwnPropertyDescriptor(g, 'localStorage'); // Node 25+ has a built-in getter
  try {
    delete g.localStorage;
    assert.doesNotThrow(() => saveSettings(defaults()));
    assert.deepEqual(loadSaved(), defaults());
    Object.defineProperty(g, 'localStorage', {
      configurable: true,
      value: { setItem() { throw new Error('blocked'); }, getItem() { throw new Error('blocked'); } },
    });
    assert.doesNotThrow(() => saveSettings(defaults()));
    assert.deepEqual(loadSaved(), defaults());
  } finally {
    delete g.localStorage;
    if (original) Object.defineProperty(g, 'localStorage', original);
  }
});
