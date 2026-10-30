// Reading colours from page screenshots (WebGL canvases keep no frame to read back): a minimal PNG decoder for the
// 8-bit RGB/RGBA images Playwright writes, using Node's zlib.
import { inflateSync } from 'node:zlib';
import type { Page } from '@playwright/test';

export type Image = { w: number; h: number; at: (x: number, y: number) => [number, number, number] };

export function decodePng(buf: Buffer): Image {
  let pos = 8, w = 0, h = 0, channels = 4;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); channels = data[9] === 6 ? 4 : 3; }
    if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = w * channels, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) { // undo each row's filter
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? px[y * stride + x - channels] : 0, b = y ? px[(y - 1) * stride + x] : 0;
      const c = x >= channels && y ? px[(y - 1) * stride + x - channels] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? (pa <= pb && pa <= pc ? a : pb <= pc ? b : c) : 0;
      px[y * stride + x] = (src[x] + pred) & 255;
    }
  }
  return { w, h, at: (x, y) => { const i = Math.round(y) * stride + Math.round(x) * channels; return [px[i], px[i + 1], px[i + 2]]; } };
}

/** The page as it looks now, to read colours from (CSS pixels at 1×). */
export const look = async (page: Page) => decodePng(await page.screenshot({ scale: 'css' }));
