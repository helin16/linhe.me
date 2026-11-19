// The six creature types: the advantage ring (FR-009) and how each looks (FR-008). Original creatures only (FR-020).
import { CritterType, Ears, HopEffect } from './enums.ts';

/** Each type is strong against the next on the ring: Water → Fire → Grass → Rock → Electric → Psychic → Water. */
export const BEATS: Record<CritterType, CritterType> = {
  [CritterType.Water]: CritterType.Fire, [CritterType.Fire]: CritterType.Grass, [CritterType.Grass]: CritterType.Rock,
  [CritterType.Rock]: CritterType.Electric, [CritterType.Electric]: CritterType.Psychic, [CritterType.Psychic]: CritterType.Water,
};
export const strong = (a: CritterType, b: CritterType) => BEATS[a] === b;
export const weak = (a: CritterType, b: CritterType) => BEATS[b] === a;
/** The type that beats `a`. */
export const beatenBy = (a: CritterType) => (Object.keys(BEATS) as CritterType[]).find(t => BEATS[t] === a)!;

/** How a type's creature looks: its name, colours, and the shape parts the 3D scene builds it from. */
export type Look = { creature: string; color: string; accent: string; ears: Ears; effect: HopEffect };
export const LOOKS: Record<CritterType, Look> = {
  [CritterType.Fire]: { creature: 'Emberpup', color: '#ff6b2c', accent: '#ffd23f', ears: Ears.Flame, effect: HopEffect.Embers },
  [CritterType.Water]: { creature: 'Splashkit', color: '#2f8fff', accent: '#bfe6ff', ears: Ears.Fin, effect: HopEffect.Droplets },
  [CritterType.Grass]: { creature: 'Sproutling', color: '#3fbf4f', accent: '#c9f27a', ears: Ears.Leaf, effect: HopEffect.Leaves },
  [CritterType.Electric]: { creature: 'Zapmouse', color: '#f5d000', accent: '#3b2f00', ears: Ears.Bolt, effect: HopEffect.Sparks },
  [CritterType.Psychic]: { creature: 'Mindmoth', color: '#c05bff', accent: '#ffd6ff', ears: Ears.Orb, effect: HopEffect.Glimmer },
  [CritterType.Rock]: { creature: 'Pebblet', color: '#9a7b5a', accent: '#5b4632', ears: Ears.Horn, effect: HopEffect.Pebbles },
};
