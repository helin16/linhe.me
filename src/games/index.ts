import type { ComponentType } from 'react';

export const GameSlug = { TurboTumble: 'turbo-tumble', SnakeDuel: 'snake-duel', TankClash: 'tank-clash' } as const;
export type GameSlug = typeof GameSlug[keyof typeof GameSlug];

// The one games list: the home page, the games page and the router all read it.
export type GameEntry = {
  slug: GameSlug;
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
    slug: GameSlug.TurboTumble,
    name: 'Turbo Tumble',
    summary: '3D kart racing with drifts, items and four tracks.',
    description:
      'Race three rivals over four themed tracks. Drift to charge a boost, and grab item boxes for turbos, goo and zaps. Customise your driver and kart, and race a friend split-screen, or up to 11 others online in a room.',
    homeTag: '1–2 players · Online up to 12 · iPad ready',
    tag: 'Keyboard or touch · 1–2 players · online up to 12',
    art: '🏎️',
    load: () => import('./turbo-tumble/index.tsx'),
  },
  {
    slug: GameSlug.SnakeDuel,
    name: 'Snake Duel',
    summary: 'Glide, grow and outwit other snakes in a big arena.',
    description:
      'Steer your snake around a glowing arena, eat orbs to grow and boost to cut others off — but touch another snake and you are out. Customise your snake, play solo against computer snakes, with a friend split-screen, or with up to 7 others online in a room.',
    homeTag: '1–2 players · Online up to 8 · iPad ready',
    tag: 'Mouse, keyboard or touch · 1–2 players · online up to 8',
    art: '🐍',
    load: () => import('./snake-duel/index.tsx'),
  },
  {
    slug: GameSlug.TankClash,
    name: 'Tank Clash',
    summary: 'Turn-based tank battles on hills you can blow apart.',
    description:
      'Pick a tank, tilt your cannon, mind the wind and fire across hills, bridges, lakes and snow. Blast the ground away under your rivals, grab air drops, and play solo against computer tanks, with a friend on one device, or with up to 9 others online.',
    homeTag: '1–2 players · Online up to 10 · iPad ready',
    tag: 'Keyboard or touch · 1–2 players · online up to 10',
    art: '💥',
    load: () => import('./tank-clash/index.tsx'),
  },
];
