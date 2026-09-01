/**
 * Deterministic procedural terrain and nature generator for top-down Spot World.
 *
 * Rules:
 * - Deterministic spatial hash for repeatable world generation.
 * - Square grid tiles with lush green variations.
 * - Empty land outside citizen plots receives nature props (trees, bushes, flowers, rocks).
 * - 5x5 citizen plots are kept clean for player and buildings.
 */

import { TILE_WIDTH, TILE_HEIGHT, WORLD_COLS, WORLD_ROWS } from '@spot/world';

export type TerrainType = 'grass_1' | 'grass_2' | 'grass_3' | 'grass_4';
export type NatureType = 'tree_oak' | 'tree_pine' | 'bush' | 'flowers' | 'rock' | null;

export interface NatureObject {
  gx: number;
  gy: number;
  type: NatureType;
  // World space feet/base anchor position for depth sorting
  wx: number;
  wy: number;
  variant: number;
}

function spatialHash(gx: number, gy: number, salt = 0): number {
  let h = (gx * 73856093) ^ (gy * 19349663) ^ (salt * 83492791);
  h ^= h << 13;
  h ^= h >> 17;
  h ^= h << 5;
  return (h >>> 0) / 0x100000000;
}

export function getTileBaseTerrain(gx: number, gy: number): TerrainType {
  const r = spatialHash(gx, gy, 101);
  if (r < 0.35) return 'grass_1';
  if (r < 0.65) return 'grass_2';
  if (r < 0.88) return 'grass_3';
  return 'grass_4';
}

/**
 * Returns nature object for a tile if it is outside all citizen plots.
 */
export function getTileNatureObject(gx: number, gy: number, isInsidePlot: boolean): NatureObject | null {
  if (isInsidePlot) return null;

  const r = spatialHash(gx, gy, 202);
  const v = spatialHash(gx, gy, 303);

  let type: NatureType = null;

  // Nature density: ~18% total nature density on empty land
  if (r < 0.06) {
    type = 'tree_oak';
  } else if (r < 0.11) {
    type = 'tree_pine';
  } else if (r < 0.15) {
    type = 'bush';
  } else if (r < 0.18) {
    type = 'flowers';
  } else if (r < 0.20) {
    type = 'rock';
  }

  if (!type) return null;

  const wx = gx * TILE_WIDTH + TILE_WIDTH / 2;
  const wy = gy * TILE_HEIGHT + TILE_HEIGHT; // Base of tile for depth-sort

  return {
    gx,
    gy,
    type,
    wx,
    wy,
    variant: Math.floor(v * 10),
  };
}
