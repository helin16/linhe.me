// How much the 3D games draw (Tank Clash, Turbo Tumble): full detail until a short frame-rate check finds the device
// too slow, then low detail for the rest of the visit (specs/009-tank-semi-3d FR-013, specs/010-turbo-3d-look FR-009).
// No three.js or DOM here, so unit tests can load it.

export const Detail = { Probing: 'probing', Full: 'full', Low: 'low' } as const;
export type Detail = typeof Detail[keyof typeof Detail];

export const LOW_DETAIL_FPS = 55;    // below this after DETAIL_PROBE_S, drop to low detail (aiming for 60, at least 50)
export const DETAIL_PROBE_S = 2;
export const LOW_DETAIL_RATIO = 0.75; // low detail draws at this pixel ratio (fewer pixels to fill)

/** The frame-rate check. It measures only frames that drew one after another (idle frames are cheap: they'd hide a slow
 *  GPU), skipping any frame the caller marks with skip() (a one-off rebuild says nothing about the GPU). */
export function detailProbe(seconds = DETAIL_PROBE_S, minFps = LOW_DETAIL_FPS) {
  let detail: Detail = Detail.Full, t = 0, frames = 0, drewLast = false;
  return {
    /** One animation frame, `dt` seconds after the last. True the moment the check drops to low detail. */
    frame(dt: number, drew: boolean) {
      let dropped = false;
      if (detail === Detail.Probing && drew && drewLast) {
        t += dt; frames++;
        if (t >= seconds) { detail = frames / t < minFps ? Detail.Low : Detail.Full; dropped = detail === Detail.Low; }
      }
      drewLast = drew;
      return dropped;
    },
    /** This frame's time doesn't count, nor the next one's start. */
    skip() { drewLast = false; },
    /** Measure again (a race or battle started); low detail stays low. */
    restart() { if (detail !== Detail.Low) { detail = Detail.Probing; t = 0; frames = 0; } },
    /** Low detail now, without measuring. */
    lower() { detail = Detail.Low; },
    get detail() { return detail; },
  };
}
