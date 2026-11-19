// The six creature types (FR-010, FR-011): looks only — names, colours, ear style and move effect. The same six names
// and colours as Critter Hop (copied: games don't import each other); the creatures are Critter Chess's own (FR-019).
import { ChessEars, ChessEffect, CritterType } from './enums.ts';

export type Look = { color: string; accent: string; ears: ChessEars; effect: ChessEffect };
export const LOOKS: Record<CritterType, Look> = {
  [CritterType.Fire]: { color: '#ff6b2c', accent: '#ffd23f', ears: ChessEars.Flame, effect: ChessEffect.Embers },
  [CritterType.Water]: { color: '#2f8fff', accent: '#bfe6ff', ears: ChessEars.Fin, effect: ChessEffect.Droplets },
  [CritterType.Grass]: { color: '#3fbf4f', accent: '#c9f27a', ears: ChessEars.Leaf, effect: ChessEffect.Leaves },
  [CritterType.Electric]: { color: '#f5d000', accent: '#3b2f00', ears: ChessEars.Bolt, effect: ChessEffect.Sparks },
  [CritterType.Psychic]: { color: '#c05bff', accent: '#ffd6ff', ears: ChessEars.Orb, effect: ChessEffect.Glimmer },
  [CritterType.Rock]: { color: '#9a7b5a', accent: '#5b4632', ears: ChessEars.Horn, effect: ChessEffect.Pebbles },
};
