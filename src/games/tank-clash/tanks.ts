// The four tank types (FR-007): how far the cannon tilts (degrees from flat towards the enemy), damage per hit and
// hearts (both in tenths), and grip on snow and ice.
import { Grip, TankType } from './enums.ts';

export type TankSpec = { minAngle: number; maxAngle: number; damage: number; hearts: number; grip: Grip };

export const TANKS: Record<TankType, TankSpec> = {
  [TankType.Scout]: { minAngle: 0, maxAngle: 85, damage: 8, hearts: 30, grip: Grip.High },
  [TankType.Allrounder]: { minAngle: 10, maxAngle: 75, damage: 10, hearts: 40, grip: Grip.Medium },
  [TankType.Heavy]: { minAngle: 30, maxAngle: 65, damage: 15, hearts: 50, grip: Grip.Low },
  [TankType.Artillery]: { minAngle: 30, maxAngle: 80, damage: 18, hearts: 30, grip: Grip.Low },
};

export const DEFAULT_TYPE = TankType.Allrounder;

/** Tenths as shown to players: 25 → "2.5". */
export const tenths = (n: number) => (Math.max(0, n) / 10).toFixed(1);

/** An angle held inside the type's limits. */
export const clampAngle = (type: TankType, angle: number) =>
  Math.min(TANKS[type].maxAngle, Math.max(TANKS[type].minAngle, angle));
