// Constitution VIII: every fixed set has one definition, and no other code writes its values out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GameSlug } from './games/index.ts';
import { Action, EditTab, EndAction, Item, MsgType, RaceState } from './games/turbo-tumble/enums.ts';
import { PlayerMode } from './shared/modes.ts';
import * as Snake from './games/snake-duel/enums.ts';
import { KartStyle, Track } from './games/turbo-tumble/settings.ts';
import { values } from './shared/enum.ts';
import { Route } from './shared/routes.ts';
import { RelayMsg } from '../relay/protocol.ts';

const enums: Record<string, Record<string, string>> = { Route, GameSlug, Track, KartStyle, RaceState, MsgType, Item, Action, PlayerMode, EditTab, EndAction, RelayMsg,
  SnakePattern: Snake.SnakePattern, SnakeEyes: Snake.SnakeEyes, MatchType: Snake.MatchType, Difficulty: Snake.Difficulty,
  SnakeMsg: Snake.SnakeMsg, MatchState: Snake.MatchState, SnakeTab: Snake.SnakeTab, Screen: Snake.Screen, ResultAction: Snake.ResultAction };
// the one file allowed to hold each enum's definition
const home: Record<string, string> = {
  RelayMsg: '../relay/protocol.ts',
  Route: 'shared/routes.ts', GameSlug: 'games/index.ts', Track: 'games/turbo-tumble/settings.ts', KartStyle: 'games/turbo-tumble/settings.ts',
  PlayerMode: 'shared/modes.ts',
  ...Object.fromEntries(['SnakePattern', 'SnakeEyes', 'MatchType', 'Difficulty', 'SnakeMsg', 'MatchState', 'SnakeTab', 'Screen', 'ResultAction'].map(n => [n, 'games/snake-duel/enums.ts'])),
  ...Object.fromEntries(['RaceState', 'MsgType', 'Item', 'Action', 'EditTab', 'EndAction'].map(n => [n, 'games/turbo-tumble/enums.ts'])),
};
// value → files where it may still appear written out, with the reason
const allowed: Record<string, string[]> = {
  'Player 1': ['games/turbo-tumble/settings.ts', 'games/snake-duel/settings.ts'], // default player name, not the edit tab (research R5)
  'Player 2': ['games/turbo-tumble/settings.ts', 'games/snake-duel/settings.ts'],
  '/': ['shared/router.tsx', '../relay/protocol.ts'], // URL path syntax (slashes), not the home route
  Rocket: ['../relay/names.ts'], // a word for room names, not the kart style
  room: ['shared/online/client.ts'], // the join link's query key (ROOM_QUERY), not the relay's room frame
};

const src = fileURLToPath(new URL('.', import.meta.url));
// the site's code and the relay's (paths relative to src/)
const list = (dir: string, prefix: string) => readdirSync(join(src, dir), { recursive: true, encoding: 'utf8' })
  .map(f => prefix + f.split(sep).join('/'))
  .filter(f => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
const files = [...list('.', ''), ...list('../relay', '../relay/')];
// an enum definition (`export const Name = { ... } as const`), blanked only in that enum's own file
const definition = (name: string) => new RegExp(`export const ${name} = \\{[^}]*\\} as const`, 'g');
// the value as a whole quoted string, or at the start of a template string (`/games/${slug}`)
const quoted = (v: string) => new RegExp(`(['"\`])${v.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}(\\1|\\$\\{)`);
const checks = Object.entries(enums).flatMap(([name, e]) => values(e).map(v => ({ name, v, re: quoted(v) })));

test('no enum value is written out outside its definition', () => {
  const stray: string[] = [];
  for (const file of files) {
    let text = readFileSync(join(src, file), 'utf8');
    for (const name of Object.keys(enums)) if (home[name] === file) text = text.replace(definition(name), d => d.replace(/[^\n]/g, ' '));
    const lines = text.split('\n');
    for (const { name, v, re } of checks) {
      if (allowed[v]?.includes(file)) continue;
      lines.forEach((line, i) => { if (re.test(line)) stray.push(`${file}:${i + 1} ${name} '${v}'`); });
    }
  }
  assert.deepEqual(stray, []);
});
