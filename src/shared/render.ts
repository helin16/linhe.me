// Browser-only helpers for the 3D games (Tank Clash, Turbo Tumble). WebGL and canvases: covered by the end-to-end
// tests (constitution VII).
import * as THREE from 'three';

/** Is WebGL drawn by the processor (a software renderer, as in headless test browsers)? Antialiasing there halves the
 *  frame rate (specs/009-tank-semi-3d research R10); on a graphics chip it is cheap and smooths every edge. */
export function softwareGpu() {
  const gl = document.createElement('canvas').getContext('webgl'), info = gl?.getExtension('WEBGL_debug_renderer_info');
  const name = gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
  return !gl || /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
}

/** A repeating texture `size` pixels square, painted by `draw` with a seeded random source (the same every time). */
export function texture(size: number, draw: (c: CanvasRenderingContext2D, rnd: () => number) => void) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  draw(cv.getContext('2d')!, rnd);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
