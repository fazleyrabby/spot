/**
 * Isometric projection math utilities for Spot (legacy / optional alternate).
 */

export const ISO_TILE_W = 128;
export const ISO_TILE_H = 64;
export const ISO_TILE_W_HALF = ISO_TILE_W / 2;
export const ISO_TILE_H_HALF = ISO_TILE_H / 2;
export const ISO_SPRITE_OFFSET_Y = ISO_TILE_H;

export function isoGridToWorld(gx: number, gy: number): { wx: number; wy: number } {
  const wx = (gx - gy) * ISO_TILE_W_HALF;
  const wy = (gx + gy) * ISO_TILE_H_HALF;
  return { wx, wy };
}

export function isoWorldToGrid(wx: number, wy: number): { gx: number; gy: number } | null {
  const gxF = (wx / ISO_TILE_W_HALF + wy / ISO_TILE_H_HALF) / 2;
  const gyF = (wy / ISO_TILE_H_HALF - wx / ISO_TILE_W_HALF) / 2;
  const gx = Math.floor(gxF);
  const gy = Math.floor(gyF);
  if (gx < 0 || gy < 0 || gx >= 100 || gy >= 100) return null;
  return { gx, gy };
}

export function isoGetWorldOrigin(): { ox: number; oy: number } {
  return { ox: 99 * ISO_TILE_W_HALF, oy: 0 };
}
