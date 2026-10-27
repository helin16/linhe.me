import type { ComponentType } from 'react';

// The one games list: the home page, the games page and the router all read it.
export type GameEntry = {
  slug: string;
  name: string;
  summary: string;
  description: string;
  homeTag: string;
  tag: string;
  art: string;
  load: () => Promise<{ default: ComponentType }>;
};

export const games: GameEntry[] = [
  {
    slug: 'turbo-tumble',
    name: 'Turbo Tumble',
    summary: '3D kart racing with drifts, items and four tracks.',
    description:
      'Race three rivals over four themed tracks. Drift to charge a boost, and grab item boxes for turbos, goo and zaps. Customise your driver and kart, and race a friend split-screen.',
    homeTag: '1–2 players · iPad ready',
    tag: 'Keyboard or touch · 1–2 players',
    art: '🏎️',
    load: () => import('./turbo-tumble/index.tsx'),
  },
];
