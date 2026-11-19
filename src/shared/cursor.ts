// The keyboard cursor (Critter Hop, Critter Chess; FR-019): arrow keys jump between candidate cells (your pieces, then the
// cells the selected one can reach) by where they are on screen, so it works on any board at any camera angle.

export type Spot = { id: number; x: number; y: number }; // screen position, y down
/** The arrow keys' screen directions (keys by `KeyboardEvent.code`). */
export const ARROWS: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
const MAX_ANGLE = Math.PI / 3; // a candidate counts if it lies within 60° of the arrow's direction

/** The candidate an arrow moves to from `from`: the one within 60° of its direction (`[dx, dy]`, unit length) with the
 *  smallest angle-weighted distance; `from` itself when nothing lies that way. */
export function nextSpot(from: Spot, spots: Spot[], [dx, dy]: [number, number]): Spot {
  let best = from, bestScore = Infinity;
  for (const s of spots) {
    const x = s.x - from.x, y = s.y - from.y, len = Math.hypot(x, y);
    if (s.id === from.id || len === 0) continue;
    const angle = Math.acos(Math.max(-1, Math.min(1, (x * dx + y * dy) / len)));
    if (angle > MAX_ANGLE) continue;
    const score = len * (1 + angle);
    if (score < bestScore) { bestScore = score; best = s; }
  }
  return best;
}
