import { test } from 'node:test';
import assert from 'node:assert/strict';
import { games, GameSlug } from '../games/index.ts';
import { gameRoute, Route } from './routes.ts';

test('site routes keep their public addresses', () => {
  assert.equal(Route.Home, '/');
  assert.equal(Route.Games, '/games/');
  assert.equal(gameRoute(GameSlug.TurboTumble), '/games/turbo-tumble/');
});

test('every game route is under /games/ and ends in a slash', () => {
  for (const g of games) assert.match(gameRoute(g.slug), /^\/games\/[a-z0-9-]+\/$/);
});
