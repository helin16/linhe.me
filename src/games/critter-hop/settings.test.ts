import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CritterType as T, Difficulty, HopSpeed, SeatKind } from './enums.ts';
import { defaults, loadSaved, loadSettings, saveSettings, uniqueTypes } from './settings.ts';

test('defaults when nothing or junk is saved', () => {
  for (const raw of [null, '', 'not json', '42', '[]', '{}']) assert.deepEqual(loadSettings(raw), defaults(), String(raw));
  const d = defaults();
  assert.equal(d.players, 2);
  assert.equal(d.difficulty, Difficulty.Normal);
  assert.equal(d.speed, HopSpeed.Normal);
  assert.equal(d.localTimer, false);
  assert.equal(d.types[0], T.Fire);
  assert.deepEqual(d.seats.slice(0, 3), [SeatKind.Person, SeatKind.Person, SeatKind.Computer]);
});

test('a saved setup comes back as it was', () => {
  const s = { ...defaults(), players: 6, types: [T.Rock, T.Fire, T.Water, T.Grass, T.Electric, T.Psychic],
    difficulty: Difficulty.Hard, localTimer: true, speed: HopSpeed.Fast, muted: true };
  s.seats[3] = SeatKind.Person;
  assert.deepEqual(loadSettings(JSON.stringify(s)), s);
});

test('bad fields fall back one by one; seat 1 is always a person; types stay unique', () => {
  const s = loadSettings(JSON.stringify({ players: 3, types: ['Fire', 'Fire', 'Ice'], seats: ['Computer', 'Robot'], difficulty: 'Expert', speed: 'Warp', muted: 'yes', localTimer: 1 }));
  assert.equal(s.players, 2);
  assert.equal(s.seats[0], SeatKind.Person);
  assert.equal(s.seats[1], SeatKind.Person);
  assert.equal(new Set(s.types).size, 6);
  assert.equal(s.types[0], T.Fire);
  assert.equal(s.difficulty, Difficulty.Normal);
  assert.equal(s.speed, HopSpeed.Normal);
  assert.equal(s.muted, false);
  assert.equal(s.localTimer, false);
});

test('uniqueTypes swaps repeats for a type nobody later wants', () => {
  assert.deepEqual(uniqueTypes([T.Fire, T.Fire, T.Water]), [T.Fire, T.Grass, T.Water]);
  assert.deepEqual(uniqueTypes([T.Water, T.Fire, T.Grass, T.Electric, T.Psychic, T.Water]), [T.Water, T.Fire, T.Grass, T.Electric, T.Psychic, T.Rock]);
  // every free type wanted later: take the first free one anyway
  assert.deepEqual(uniqueTypes([T.Fire, T.Fire, T.Water, T.Grass, T.Electric, T.Psychic, T.Rock].slice(0, 6)).length, 6);
});

test('saving and loading through this browser; no storage: defaults, no throw', () => {
  const store = new Map<string, string>();
  const g = globalThis as { localStorage?: unknown };
  g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) };
  const s = { ...defaults(), players: 4 };
  saveSettings(s);
  assert.deepEqual(loadSaved(), s);
  g.localStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.deepEqual(loadSaved(), defaults());
  assert.doesNotThrow(() => saveSettings(s));
  delete g.localStorage;
});
