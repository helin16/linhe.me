// Snake Duel's fixed sets (constitution VIII). Values are saved and sent online: don't change them.

export const SnakePattern = { Solid: 'Solid', Stripes: 'Stripes', Spots: 'Spots', TwoTone: 'Two-tone' } as const;
export type SnakePattern = typeof SnakePattern[keyof typeof SnakePattern];

export const SnakeEyes = { Round: 'Round', Sleepy: 'Sleepy', Angry: 'Angry', Starry: 'Starry' } as const;
export type SnakeEyes = typeof SnakeEyes[keyof typeof SnakeEyes];

export const MatchType = { Deathmatch: 'Deathmatch', Quick: 'Quick match' } as const;
export type MatchType = typeof MatchType[keyof typeof MatchType];

export const Difficulty = { Easy: 'Easy', Normal: 'Normal', Hard: 'Hard' } as const;
export type Difficulty = typeof Difficulty[keyof typeof Difficulty];

// online game messages (specs/006-snake-duel/contracts/messages.md)
export const SnakeMsg = {
  Look: 'look', Input: 'in', Orbs: 'orbs', Mode: 'mode', Begin: 'begin', Snap: 'snap', Round: 'result', Clock: 'clock',
  Match: 'match', Hand: 'hand',
} as const;
export type SnakeMsg = typeof SnakeMsg[keyof typeof SnakeMsg];

// a match's progress: before a round, in one, between rounds, finished
export const MatchState = { Ready: 'ready', Playing: 'playing', RoundOver: 'round-over', MatchOver: 'match-over' } as const;
export type MatchState = typeof MatchState[keyof typeof MatchState];

// the garage's Player 1 / Player 2 tabs in 2 Players
export const SnakeTab = { P1: 'Snake 1', P2: 'Snake 2' } as const;
export type SnakeTab = typeof SnakeTab[keyof typeof SnakeTab];

// which screen is up: the garage, a game, or a result
export const Screen = { Garage: 'in-garage', Play: 'in-play', End: 'at-end' } as const;
export type Screen = typeof Screen[keyof typeof Screen];

// buttons on the result screens
export const ResultAction = { Again: 'play-again', Garage: 'to-garage' } as const;
export type ResultAction = typeof ResultAction[keyof typeof ResultAction];
