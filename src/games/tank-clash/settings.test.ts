import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Difficulty, MapId, Side, TankType, Variant } from './enums.ts';
import { defaults, distinctColors, fixLook, loadSaved, loadSettings, saveSettings } from './settings.ts';

test('defaults when nothing or junk is saved', () => {
  for (const raw of [null, '', 'not json', '42', '[]', '{}']) assert.deepEqual(loadSettings(raw), defaults(), String(raw));
  assert.equal(defaults().players[0].type, TankType.Allrounder);
  assert.equal(defaults().tanks, 2);
  assert.equal(defaults().map, MapId.Random);
  assert.equal(defaults().overview, true, 'the overview map shows unless hidden');
});

test('a saved setup comes back as it was', () => {
  const s = { ...defaults(), map: MapId.FrostRidge, tanks: 6, difficulty: Difficulty.Hard, muted: true, overview: false };
  s.players[0] = { name: 'Ann', color: '#112233', type: TankType.Heavy, variant: Variant.C };
  assert.deepEqual(loadSettings(JSON.stringify(s)), s);
});

test('looks are cleaned field by field; names up to 10 characters; a side is kept only if valid', () => {
  const d = defaults().players[0];
  assert.deepEqual(fixLook({ name: 'ABCDEFGHIJKLMN', color: 'red', type: 'Tiger', variant: 'Z' }, d), { ...d, name: 'ABCDEFGHIJ' });
  assert.equal(fixLook({ variant: Variant.A }, d).variant, Variant.A);
  assert.equal(fixLook({}, { ...d, variant: undefined }).variant, Variant.B, 'no build: B');
  assert.deepEqual(fixLook({ ...d, color: '#ABCDEF', side: Side.Right }, d), { ...d, color: '#abcdef', side: Side.Right });
  assert.deepEqual(fixLook({ ...d, side: 'Middle' }, d), d);
  assert.deepEqual(fixLook(null, d), d);
  assert.deepEqual(fixLook('x', d), d);
});

test('bad map, tank count, difficulty, mute or overview fall back; saved sides are dropped', () => {
  const s = loadSettings(JSON.stringify({ map: 'Moon', tanks: 3, difficulty: 'Insane', muted: 'yes', overview: 'no',
    players: [{ ...defaults().players[0], side: Side.Left }] }));
  assert.deepEqual([s.map, s.tanks, s.difficulty, s.muted, s.overview], [MapId.Random, 2, Difficulty.Normal, false, true]);
  assert.equal(s.players[0].side, undefined);
});

test('a save from before Arcade was removed loads in the normal look, keeping everything else (008 FR-012)', () => {
  const old = { ...defaults(), map: MapId.TimberGap, tanks: 4, muted: true, style: 'arcade' } as Record<string, unknown>;
  delete old.overview;
  (old.players as { name: string }[])[0].name = 'Ann';
  const s = loadSettings(JSON.stringify(old));
  assert.equal('style' in s, false);
  assert.deepEqual([s.map, s.tanks, s.muted, s.players[0].name, s.overview], [MapId.TimberGap, 4, true, 'Ann', true]);
});

test("player 2's colour never matches player 1's", () => {
  const [p1, p2] = defaults().players;
  assert.deepEqual(distinctColors(p1, p2), { p2, changed: false });
  const same = distinctColors(p1, { ...p2, color: p1.color });
  assert.ok(same.changed && same.p2.color !== p1.color);
  const yellow = { ...p1, color: '#ffcc00' }, both = distinctColors(yellow, { ...p2, color: '#ffcc00' });
  assert.ok(both.changed && both.p2.color !== yellow.color);
});

test('storage: saves and reads back; no storage means defaults', () => {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) };
  const s = { ...defaults(), tanks: 8 };
  saveSettings(s);
  assert.deepEqual(loadSaved(), s);
  delete (globalThis as { localStorage?: unknown }).localStorage;
  assert.deepEqual(loadSaved(), defaults());
  saveSettings(s); // no storage: no throw
});
