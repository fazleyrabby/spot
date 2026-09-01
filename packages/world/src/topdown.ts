/**
 * Top-down 3/4 perspective grid math utilities for Spot World (Stardew Valley / RPG Maker style).
 *
 * Coordinate system:
 *   Grid   (gx, gy) — integer 0..99 cell indices
 *   World  (wx, wy) — continuous pixel space (0 .. 100 * TILE_WIDTH, 0 .. 100 * TILE_HEIGHT)
 *   Screen (sx, sy) — final canvas pixels after camera pan/zoom
 *
 * Tile size:
 *   TILE_WIDTH  = 48px
 *   TILE_HEIGHT = 32px (3/4 perspective slight vertical compression)
 */

import type { Coordinates } from '@spot/shared';

export const WORLD_COLS = 100;
export const WORLD_ROWS = 100;

export const TILE_WIDTH = 48;
export const TILE_HEIGHT = 32;

export const TOTAL_WORLD_WIDTH = WORLD_COLS * TILE_WIDTH;
export const TOTAL_WORLD_HEIGHT = WORLD_ROWS * TILE_HEIGHT;

/** 5x5 tile plot constants */
export const PLOT_RADIUS = 2; // center ± 2 tiles = 5x5
export const PLOT_SIZE = 5;
export const PLOT_WIDTH_PX = PLOT_SIZE * TILE_WIDTH;
export const PLOT_HEIGHT_PX = PLOT_SIZE * TILE_HEIGHT;

/**
 * Convert a grid coordinate (0..99) to the top-left world pixel position of the tile.
 */
export function gridToWorld(gx: number, gy: number): { wx: number; wy: number } {
  return {
    wx: gx * TILE_WIDTH,
    wy: gy * TILE_HEIGHT,
  };
}

/**
 * Convert a grid coordinate to the center world pixel position of the tile.
 */
export function gridToWorldCenter(gx: number, gy: number): { wx: number; wy: number } {
  return {
    wx: gx * TILE_WIDTH + TILE_WIDTH / 2,
    wy: gy * TILE_HEIGHT + TILE_HEIGHT / 2,
  };
}

/**
 * Convert world space pixel position to grid coordinate.
 * Returns null if outside 0..99 bounds.
 */
export function worldToGrid(wx: number, wy: number): { gx: number; gy: number } | null {
  if (wx < 0 || wy < 0 || wx >= TOTAL_WORLD_WIDTH || wy >= TOTAL_WORLD_HEIGHT) {
    return null;
  }
  const gx = Math.floor(wx / TILE_WIDTH);
  const gy = Math.floor(wy / TILE_HEIGHT);
  if (gx < 0 || gx >= WORLD_COLS || gy < 0 || gy >= WORLD_ROWS) return null;
  return { gx, gy };
}

/**
 * Check if grid coordinates are valid.
 */
export function isValidGridCoord(gx: number, gy: number): boolean {
  return gx >= 0 && gx < WORLD_COLS && gy >= 0 && gy < WORLD_ROWS;
}

/**
 * Get visible grid tile bounding box from camera world bounds (frustum culling).
 */
export function getVisibleGridRange(
  worldLeft: number,
  worldTop: number,
  worldRight: number,
  worldBottom: number,
  margin = 3,
): { minGx: number; maxGx: number; minGy: number; maxGy: number } {
  const minGx = Math.max(-12, Math.floor(worldLeft / TILE_WIDTH) - margin);
  const maxGx = Math.min(WORLD_COLS + 12, Math.ceil(worldRight / TILE_WIDTH) + margin);
  const minGy = Math.max(-16, Math.floor(worldTop / TILE_HEIGHT) - margin);
  const maxGy = Math.min(WORLD_ROWS + 20, Math.ceil(worldBottom / TILE_HEIGHT) + margin);

  return { minGx, maxGx, minGy, maxGy };
}
