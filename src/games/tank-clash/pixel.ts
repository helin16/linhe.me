// The arcade style's pixel-art tanks (spec Style): each type's body drawn on a small pixel grid — shapes with a
// light top row and a dark bottom row, then a dark outline — in the player's colour, cached as a canvas. The cannon
// isn't in the sprite: draw.ts draws it at the tank's angle from GUNS. Coordinates are design units: the tank is
// 64 × 36 with the tracks' bottom at y = 34 and the front to the right. Original designs (the canvas's arcade row).
import { TankType } from './enums.ts';

type RGB = [number, number, number];
export type Ramp = [RGB, RGB, RGB]; // light, mid, dark

const K = 2;                       // pixels per design unit
export const SPRITE_W = 64, SPRITE_H = 36, SPRITE_GROUND = 34;
const hex = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const ramp = (l: string, m: string, d: string): Ramp => [hex(l), hex(m), hex(d)];
const scaled = (c: RGB, f: number): RGB => c.map(v => Math.max(0, Math.min(255, Math.round(v * f)))) as RGB;
/** A ramp around one colour: lighter on top, darker below. */
export const rampOf = (color: string): Ramp => { const c = hex(color); return [scaled(c, 1.3), c, scaled(c, 0.62)]; };

export const METAL = ramp('#cfd3d6', '#8f959c', '#565b62');
const TRACK = ramp('#57524c', '#34302c', '#1f1c1a'), WHEEL = ramp('#b3afa6', '#77736c', '#45423e');
const RUST = ramp('#f6ad55', '#cc6d2b', '#8a4318'), KHAKI = ramp('#eadb9f', '#c6ad63', '#8c7738');
const GLASS = ramp('#d8f4ff', '#7cc6e8', '#3c7fa6'), LAMP = ramp('#fff1a0', '#f2c230', '#a8780e');
export const GOLD = ramp('#fff1a0', '#f2c230', '#a8780e'), GOLD_BRIGHT = ramp('#ffffff', '#ffe066', '#c89a1a');
export const OUTLINE: RGB = hex('#1a130c');
const WRECK = rampOf('#2e2b2b');

class Grid {
  readonly w = SPRITE_W * K; readonly h = SPRITE_H * K;
  readonly px: (RGB | null)[] = new Array(this.w * this.h).fill(null);
  /** Fills the pixels inside a shape (in design units, within a box), light on top and dark at the bottom. */
  shape(inside: (x: number, y: number) => boolean, r: Ramp, box: [number, number, number, number]) {
    const pts = new Set<number>();
    for (let y = Math.max(0, box[1] * K); y < Math.min(this.h, box[3] * K); y++)
      for (let x = Math.max(0, box[0] * K); x < Math.min(this.w, box[2] * K); x++)
        if (inside((x + 0.5) / K, (y + 0.5) / K)) pts.add(y * this.w + x);
    for (const i of pts) this.px[i] = !pts.has(i - this.w) ? r[0] : !pts.has(i + this.w) ? r[2] : r[1];
  }
  rect(x0: number, y0: number, x1: number, y1: number, r: Ramp) {
    this.shape((x, y) => x >= x0 && x < x1 && y >= y0 && y < y1, r, [Math.floor(x0), Math.floor(y0), Math.ceil(x1), Math.ceil(y1)]);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, r: Ramp, upper = false) {
    this.shape((x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 && (!upper || y < cy), r,
      [Math.floor(cx - rx) - 1, Math.floor(cy - ry) - 1, Math.ceil(cx + rx) + 2, Math.ceil(cy + ry) + 2]);
  }
  poly(pts: [number, number][], r: Ramp) {
    const inside = (x: number, y: number) => {
      let c = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xa, ya] = pts[i], [xb, yb] = pts[j];
        if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) c = !c;
      }
      return c;
    };
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    this.shape(inside, r, [Math.floor(Math.min(...xs)) - 1, Math.floor(Math.min(...ys)) - 1, Math.ceil(Math.max(...xs)) + 2, Math.ceil(Math.max(...ys)) + 2]);
  }
  /** A slim fixed barrel from (x, y), `deg` up from pointing right. */
  barrel(x: number, y: number, len: number, thick: number, deg: number, r: Ramp) {
    const a = deg * Math.PI / 180, dx = Math.cos(a), dy = -Math.sin(a), nx = -dy * thick / 2, ny = dx * thick / 2;
    this.poly([[x + nx, y + ny], [x + dx * len + nx, y + dy * len + ny], [x + dx * len - nx, y + dy * len - ny], [x - nx, y - ny]], r);
  }
  /** Rounded-end tracks with road wheels and tread teeth. */
  tracks(x0: number, x1: number, top: number, wheels: number, wheel: Ramp, rad = 3.3) {
    const r = (SPRITE_GROUND - top) / 2;
    this.shape((x, y) => {
      const cx = Math.min(Math.max(x, x0 + r), x1 - r), cy = Math.min(Math.max(y, top + r), SPRITE_GROUND - r);
      return x >= x0 && x < x1 && y >= top && y < SPRITE_GROUND && (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
    }, TRACK, [Math.floor(x0), top, Math.ceil(x1) + 1, SPRITE_GROUND + 1]);
    const span = (x1 - x0 - 10) / (wheels - 1);
    for (let i = 0; i < wheels; i++) this.ellipse(x0 + 5 + i * span, 29.5, rad, rad, wheel);
  }
  /** Dark rivets with a glint. */
  rivets(xs: number[], y: number) {
    for (const x of xs) {
      const X = Math.round(x * K), Y = Math.round(y * K);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) this.px[(Y + dy) * this.w + X + dx] = OUTLINE;
      this.px[Y * this.w + X] = [232, 228, 200];
    }
  }
  /** A one-pixel outline round everything drawn. */
  outline(c: RGB) {
    const add: number[] = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.px[y * this.w + x]) continue;
      const near = (dx: number, dy: number) => x + dx >= 0 && x + dx < this.w && y + dy >= 0 && y + dy < this.h && !!this.px[(y + dy) * this.w + x + dx];
      if (near(1, 0) || near(-1, 0) || near(0, 1) || near(0, -1)) add.push(y * this.w + x);
    }
    for (const i of add) this.px[i] = c;
  }
  canvas() {
    const cv = document.createElement('canvas'); cv.width = this.w; cv.height = this.h;
    const ctx = cv.getContext('2d')!, img = ctx.createImageData(this.w, this.h);
    this.px.forEach((c, i) => { if (c) img.data.set([...c, 255], i * 4); });
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}

const range = (from: number, to: number, step: number) => { const r: number[] = []; for (let v = from; v < to; v += step) r.push(v); return r; };

// each type's body (no cannon), in body colour b
const BODIES: Record<TankType, (g: Grid, b: Ramp, wheel: Ramp) => void> = {
  [TankType.Scout]: (g, b, wheel) => {
    g.ellipse(6, 19, 3.2, 4.2, TRACK);                                                 // spare tyre
    g.poly([[5, 25], [9, 16], [50, 16], [60, 21], [60, 26]], b);
    g.ellipse(30, 16, 8, 5, b, true);                                                  // turret
    g.poly([[44, 16], [47, 12], [50, 12], [52, 16]], GLASS);                           // windscreen
    g.rect(57, 20, 60, 22, LAMP);
    for (const cx of [14, 32, 50]) { g.ellipse(cx, 29, 6, 6, TRACK); g.ellipse(cx, 29, 2.6, 2.6, wheel === WHEEL ? RUST : wheel); }
    g.rivets(range(12, 48, 6), 19);
    g.barrel(16, 15, 13, 0.8, 108, TRACK);                                             // antenna
  },
  [TankType.Allrounder]: (g, b, wheel) => {
    g.barrel(30, 9, 9, 1.6, 12, METAL);                                                // hatch MG
    g.tracks(5, 59, 25, 6, wheel);
    g.poly([[3, 25], [9, 18], [54, 18], [61, 25]], b);
    g.rect(7, 22, 57, 25, b);                                                          // skirt
    g.poly([[20, 18], [23, 11], [41, 11], [46, 14], [46, 18]], b);
    g.ellipse(30, 10.5, 4, 1.8, b);                                                    // hatch
    g.rect(5, 14, 8, 19, METAL);                                                       // exhaust
    g.rect(56, 20, 59, 22, LAMP);
    g.rect(26, 14, 38, 15, KHAKI);
    g.rivets(range(12, 54, 6), 20); g.rivets(range(25, 42, 5), 16);
  },
  [TankType.Heavy]: (g, b, wheel) => {
    g.rect(8, 8, 11, 15, METAL); g.rect(12, 9, 15, 15, METAL);                         // exhaust stacks
    g.tracks(2, 62, 24, 7, wheel, 3.1);
    g.poly([[2, 22], [8, 15], [56, 15], [62, 22]], b);
    g.poly([[16, 15], [18, 5], [43, 5], [48, 9], [48, 15]], b);
    for (let x0 = 4; x0 < 60; x0 += 9) { g.rect(x0, 21, x0 + 9, 28, b); g.rivets([x0 + 2, x0 + 6], 23); } // skirt plates
    g.rect(20, 8, 24, 13, TRACK); g.rect(25, 8, 29, 13, TRACK);                         // spare track links
    g.rect(55, 17, 59, 19, LAMP);
    g.rivets(range(31, 46, 4), 7); g.rivets(range(12, 54, 7), 17);
  },
  [TankType.Artillery]: (g, b, wheel) => {
    g.poly([[3, 24], [8, 24], [6, 33], [1, 33]], METAL);                               // spade
    g.tracks(8, 56, 26, 5, wheel);
    g.poly([[6, 26], [10, 20], [52, 20], [58, 26]], b);
    g.poly([[14, 20], [18, 12], [37, 12], [42, 20]], b);
    g.rect(18, 11, 37, 13, METAL);                                                     // rim
    g.rect(44, 15, 50, 20, KHAKI); g.rect(50, 16, 55, 20, KHAKI);                      // ammo boxes
    g.rivets(range(14, 52, 6), 22);
  },
};

/** Each type's cannon: where it pivots, barrels (offset across the pivot, length, thickness), a muzzle brake. */
export const GUNS: Record<TankType, { x: number; y: number; barrels: [number, number, number][]; brake?: [number, number] }> = {
  [TankType.Scout]: { x: 36, y: 12.5, barrels: [[0, 15, 2.2]] },
  [TankType.Allrounder]: { x: 44, y: 14.5, barrels: [[0, 17, 3]], brake: [4, 6] },
  [TankType.Heavy]: { x: 46, y: 11, barrels: [[-2, 16, 2.6], [2, 16, 2.6]] },
  [TankType.Artillery]: { x: 34, y: 13, barrels: [[0, 30, 3], [3, 13, 2.2]] },
};

const cache = new Map<string, HTMLCanvasElement>();
/** A tank body's sprite: its colour, or a blackened wreck; grip gear gilds the wheels, a shield the outline. */
export function tankSprite(type: TankType, color: string, wreck: boolean, gold: { wheels: Ramp | null; edge: RGB | null }) {
  const key = [type, color, wreck, gold.wheels?.[1], gold.edge].join('|');
  let cv = cache.get(key);
  if (!cv) {
    const g = new Grid();
    BODIES[type](g, wreck ? WRECK : rampOf(color), wreck ? WRECK : gold.wheels ?? WHEEL);
    g.outline(gold.edge ?? OUTLINE);
    cache.set(key, cv = g.canvas());
  }
  return cv;
}
