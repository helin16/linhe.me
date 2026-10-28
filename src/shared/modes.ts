// The play modes every game offers (labels shown on the mode buttons): one fixed set for all games.
export const PlayerMode = { One: '1 Player', Two: '2 Players', Online: 'Online' } as const;
export type PlayerMode = typeof PlayerMode[keyof typeof PlayerMode];
