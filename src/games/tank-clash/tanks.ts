// The four tank types (FR-007): how far the cannon tilts (degrees from flat towards the enemy), damage per hit and
// hearts (both in tenths), grip, and driving speed in units a second. Lighter tanks drive faster, and so do
// low-grip ones, which roll on a little after letting go; high grip is slower but stops dead.
import { Grip, TankType, Variant } from './enums.ts';

export type TankSpec = { minAngle: number; maxAngle: number; damage: number; hearts: number; grip: Grip; speed: number; topPower: number };

// the B build of each type; top power is worked out from damage (topPowerOf)
export const TANKS: Record<TankType, Omit<TankSpec, 'topPower'>> = {
  [TankType.Scout]: { minAngle: 5, maxAngle: 80, damage: 8, hearts: 30, grip: Grip.High, speed: 85 },
  [TankType.Allrounder]: { minAngle: 10, maxAngle: 75, damage: 10, hearts: 40, grip: Grip.Medium, speed: 75 },
  [TankType.Heavy]: { minAngle: 30, maxAngle: 65, damage: 15, hearts: 50, grip: Grip.Low, speed: 60 },
  [TankType.Artillery]: { minAngle: 30, maxAngle: 80, damage: 18, hearts: 30, grip: Grip.Low, speed: 105 },
};

export const DEFAULT_TYPE = TankType.Allrounder;
export const DEFAULT_VARIANT = Variant.B;

// A: the cannon tilts further but hits softer; C: it tilts less but hits harder (hearts, grip and speed stay the type's)
const MIN_ANGLE = 0, MAX_ANGLE = 85;
// harder hits reach less far: full power at 0.6 damage or less, 1.2 power less for each tenth above
export const MAX_POWER = 100;
const FULL_REACH_DAMAGE = 6, POWER_PER_TENTH = 1.2;
const topPowerOf = (damage: number) => Math.min(MAX_POWER, Math.round(MAX_POWER - (damage - FULL_REACH_DAMAGE) * POWER_PER_TENTH));
const BUILDS: Record<Variant, { widen: number; damage: number }> = {
  [Variant.A]: { widen: 5, damage: 0.8 },
  [Variant.B]: { widen: 0, damage: 1 },
  [Variant.C]: { widen: -8, damage: 1.25 },
};

/** A tank's stats: its type's, changed by its build (B when none is given). */
export function specOf(look: { type: TankType; variant?: Variant }): TankSpec {
  const base = TANKS[look.type], build = BUILDS[look.variant ?? DEFAULT_VARIANT], damage = Math.round(base.damage * build.damage);
  return { ...base, minAngle: Math.max(MIN_ANGLE, base.minAngle - build.widen), maxAngle: Math.min(MAX_ANGLE, base.maxAngle + build.widen),
    damage, topPower: topPowerOf(damage) };
}

/** Tenths as shown to players: 25 → "2.5". */
export const tenths = (n: number) => (Math.max(0, n) / 10).toFixed(1);

/** An angle held inside a tank's limits. */
export const clampAngle = (look: { type: TankType; variant?: Variant }, angle: number) => {
  const s = specOf(look);
  return Math.min(s.maxAngle, Math.max(s.minAngle, angle));
};

/** A power held between 0 and a tank's top power. */
export const clampPower = (look: { type: TankType; variant?: Variant }, power: number) => Math.min(specOf(look).topPower, Math.max(0, power));
