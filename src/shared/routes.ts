import type { GameSlug } from '../games/index.ts';

// The site's public addresses (contracts in specs/001-react-typescript-port/contracts/routes.md).
export const Route = { Home: '/', Games: '/games/' } as const;
export type Route = typeof Route[keyof typeof Route];

export const gameRoute = (slug: GameSlug) => `${Route.Games}${slug}/`;
