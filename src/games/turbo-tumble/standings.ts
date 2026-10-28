// What the race standings panel shows (feature 005). No three.js, so it's unit tested.

export const COMPACT_MEDIA = '(max-width: 700px), (max-height: 500px)'; // phone-sized: only the top and our own rows
export const COMPACT_TOP = 3;

/** One kart in race order; `time` is its finish time once it has finished. */
export type Standing = { place: number; name: string; color: string; local: boolean; time: string | null };

/** The rows to show: every kart, or on a phone the top places plus any player on this device outside them. */
export const standingRows = (order: Standing[], compact: boolean) =>
  compact ? order.filter(s => s.place <= COMPACT_TOP || s.local) : order;
