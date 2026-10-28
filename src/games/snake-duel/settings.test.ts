import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Difficulty, MatchType, SnakeEyes, SnakePattern } from './enums.ts';
import { defaults, distinctColors, fixLook, loadSaved, loadSettings, saveSettings } from './settings.ts';

test('defaults when nothing or junk is saved', () => {
  for (const raw of [null, '', 'not json', '42', '[]', '{}']) assert.deepEqual(loadSettings(raw), defaults(), String(raw));
});

test('a saved setup comes back as it was', () => {
  const s = { ...defaults(), difficulty: Difficulty.Hard, match: MatchType.Quick, best: 57, muted: true };
  s.players[0] = { name: 'Ann', color: '#112233', accent: '#445566', pattern: SnakePattern.TwoTone, eyes: SnakeEyes.Starry };
  assert.deepEqual(loadSettings(JSON.stringify(s)), s);
});

test('looks are cleaned field by field; names up to 10 characters', () => {
  const d = defaults().players[0];
  assert.deepEqual(fixLook({ name: 'ABCDEFGHIJKLMN', color: 'red', accent: '#ABCDEF', pattern: 'Plaid', eyes: 7 }, d),
    { ...d, name: 'ABCDEFGHIJ', accent: '#abcdef' });
  assert.deepEqual(fixLook(null, d), d);
  assert.deepEqual(fixLook('x', d), d);
});

test('bad difficulty, match, best or mute fall back', () => {
  const s = loadSettings(JSON.stringify({ difficulty: 'Insane', match: 'Forever', best: -3, muted: 'yes' }));
  assert.deepEqual([s.difficulty, s.match, s.best, s.muted], [Difficulty.Normal, MatchType.Deathmatch, 0, false]);
  assert.equal(loadSettings(JSON.stringify({ best: 2.5 })).best, 0);
});

test("player 2's main colour never matches player 1's", () => {
  const [p1, p2] = defaults().players;
  assert.deepEqual(distinctColors(p1, p2), { p2, changed: false });
  const same = distinctColors(p1, { ...p2, color: p1.color });
  assert.ok(same.changed && same.p2.color !== p1.color);
  const yellow = { ...p1, color: '#ffcc00' }, both = distinctColors(yellow, { ...p2, color: '#ffcc00' });
  assert.ok(both.changed && both.p2.color !== yellow.color);
  const saved = loadSettings(JSON.stringify({ players: [p1, { ...p2, color: p1.color }] }));
  assert.notEqual(saved.players[1].color, saved.players[0].color);
});

test('saving and loading survive missing storage', () => {
  const g = globalThis as { localStorage?: unknown };
  const had = 'localStorage' in g, old = g.localStorage;
  const store = new Map<string, string>();
  g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
  try {
    const s = { ...defaults(), best: 12 };
    saveSettings(s);
    assert.deepEqual(loadSaved(), s);
    g.localStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    assert.deepEqual(loadSaved(), defaults());
    saveSettings(s); // doesn't throw
  } finally {
    if (had) g.localStorage = old; else delete g.localStorage;
  }
});
