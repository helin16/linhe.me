// Critter Hop's fixed sets (constitution VIII). CritterType and HopMsg values are sent online: don't change them.

// the six creature types (specs/012-creature-checkers FR-007, FR-009)
export const CritterType = { Fire: 'Fire', Water: 'Water', Grass: 'Grass', Electric: 'Electric', Psychic: 'Psychic', Rock: 'Rock' } as const;
export type CritterType = typeof CritterType[keyof typeof CritterType];

// the star for 2 and 6 players, the cross for 4 (FR-002)
export const BoardKind = { Star: 'star', Cross: 'cross' } as const;
export type BoardKind = typeof BoardKind[keyof typeof BoardKind];

export const SeatKind = { Person: 'Person', Computer: 'Computer' } as const;
export type SeatKind = typeof SeatKind[keyof typeof SeatKind];

export const Difficulty = { Easy: 'Easy', Normal: 'Normal', Hard: 'Hard' } as const;
export type Difficulty = typeof Difficulty[keyof typeof Difficulty];

// one segment of a move's path
export const HopKind = { Step: 'step', Hop: 'hop', LongHop: 'long-hop' } as const;
export type HopKind = typeof HopKind[keyof typeof HopKind];

export const GameState = { Playing: 'playing', Over: 'over' } as const;
export type GameState = typeof GameState[keyof typeof GameState];

// why a game ended: every place decided (or no person left playing), the stall rule (FR-022), or End game
export const EndWhy = { Done: 'done', Stall: 'stall', Ended: 'ended' } as const;
export type EndWhy = typeof EndWhy[keyof typeof EndWhy];

// a creature's ear shape and its hop effect's particles (FR-008)
export const Ears = { Flame: 'flame-ears', Fin: 'fin-ears', Leaf: 'leaf-ears', Bolt: 'bolt-ears', Orb: 'orb-ears', Horn: 'horn-ears' } as const;
export type Ears = typeof Ears[keyof typeof Ears];
export const HopEffect = { Embers: 'embers', Droplets: 'droplets', Leaves: 'leaves', Sparks: 'sparks', Glimmer: 'glimmer', Pebbles: 'pebbles' } as const;
export type HopEffect = typeof HopEffect[keyof typeof HopEffect];

// how a move is named on screen and to screen readers
export const MoveWord = { Step: 'Step', Hop: 'Hop', LongHop: 'Long hop' } as const;
export type MoveWord = typeof MoveWord[keyof typeof MoveWord];

// move animation speed (FR-023)
export const HopSpeed = { Normal: 'Normal speed', Fast: 'Fast' } as const;
export type HopSpeed = typeof HopSpeed[keyof typeof HopSpeed];

// online game messages (specs/012-creature-checkers/contracts/messages.md)
export const HopMsg = { Pick: 'pick', Types: 'types', Begin: 'begin', Turn: 'turn', Move: 'move', Sync: 'sync' } as const;
export type HopMsg = typeof HopMsg[keyof typeof HopMsg];

// which screen is up
export const Screen = { Setup: 'at-setup', Play: 'at-play', End: 'at-end' } as const;
export type Screen = typeof Screen[keyof typeof Screen];

// buttons on the end screen
export const ResultAction = { Again: 'play-again', Menu: 'to-menu', Room: 'to-room' } as const;
export type ResultAction = typeof ResultAction[keyof typeof ResultAction];
