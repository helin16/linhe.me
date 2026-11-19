// Critter Chess's fixed sets (constitution VIII). CritterType, PieceKind and ChessMsg values are sent online: don't
// change them.

export const CritterType = { Fire: 'Fire', Water: 'Water', Grass: 'Grass', Electric: 'Electric', Psychic: 'Psychic', Rock: 'Rock' } as const;
export type CritterType = typeof CritterType[keyof typeof CritterType];

// 8 × 8 for 2 players, the cross for 4, the hexagon for 6 (FR-002)
export const BoardKind = { Square: 'square-board', Cross: 'cross-board', Hex: 'hexagon' } as const;
export type BoardKind = typeof BoardKind[keyof typeof BoardKind];

export const PieceKind = { King: 'King', Queen: 'Queen', Rook: 'Rook', Bishop: 'Bishop', Knight: 'Knight', Pawn: 'Pawn' } as const;
export type PieceKind = typeof PieceKind[keyof typeof PieceKind];

export const SeatKind = { Person: 'Person', Computer: 'Computer' } as const;
export type SeatKind = typeof SeatKind[keyof typeof SeatKind];

export const Difficulty = { Easy: 'Easy', Normal: 'Normal', Hard: 'Hard' } as const;
export type Difficulty = typeof Difficulty[keyof typeof Difficulty];

export const SeatState = { Playing: 'in-play', Out: 'out' } as const;
export type SeatState = typeof SeatState[keyof typeof SeatState];

export const GameState = { Playing: 'game-on', Over: 'game-over' } as const;
export type GameState = typeof GameState[keyof typeof GameState];

// how a game ended: checkmate (2 players), a draw, the last king standing, or no progress / no mate possible (4/6)
export const EndWhy = { Mate: 'checkmate', Draw: 'drawn', LastStanding: 'last-standing', NoProgress: 'no-progress' } as const;
export type EndWhy = typeof EndWhy[keyof typeof EndWhy];

// a creature's ear shape and its move effect's particles (FR-011)
export const ChessEars = { Flame: 'flame-tufts', Fin: 'fin-tufts', Leaf: 'leaf-tufts', Bolt: 'bolt-tufts', Orb: 'orb-tufts', Horn: 'horn-tufts' } as const;
export type ChessEars = typeof ChessEars[keyof typeof ChessEars];
export const ChessEffect = { Embers: 'ember-burst', Droplets: 'droplet-burst', Leaves: 'leaf-burst', Sparks: 'spark-burst', Glimmer: 'glimmer-burst', Pebbles: 'pebble-burst' } as const;
export type ChessEffect = typeof ChessEffect[keyof typeof ChessEffect];

export const MoveSpeed = { Normal: 'Normal pace', Fast: 'Fast pace' } as const;
export type MoveSpeed = typeof MoveSpeed[keyof typeof MoveSpeed];

// online game messages (specs/013-creature-chess/contracts/messages.md)
export const ChessMsg = { Pick: 'chess-pick', Types: 'chess-types', Begin: 'chess-begin', Turn: 'chess-turn', Move: 'chess-move', Sync: 'chess-sync' } as const;
export type ChessMsg = typeof ChessMsg[keyof typeof ChessMsg];

export const Screen = { Setup: 'chess-setup', Play: 'chess-play', End: 'chess-end' } as const;
export type Screen = typeof Screen[keyof typeof Screen];

export const ResultAction = { Again: 'chess-again', Menu: 'chess-menu', Room: 'chess-room' } as const;
export type ResultAction = typeof ResultAction[keyof typeof ResultAction];
