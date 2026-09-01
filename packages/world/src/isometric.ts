/**
 * Isometric projection math utilities for Spot World.
 *
 * Coordinate system:
 *   Grid  (gx, gy) — integer 0..99 cell indices
 *   World (wx, wy) — continuous pixel space before camera transform
 *   Screen (sx, sy) — final canvas pixels after camera pan/zoom
 *
 * Standard "2:1" isometric ratio:
 *   TILE_W = tile width in world px  (wide axis)
 *   TILE_H = tile height in world px (narrow axis, typically TILE_W / 2)
 */

export const ISO_TILE_W = 128; // world pixels wide
export const ISO_TILE_H = 64;  // world pixels tall (2:1 ratio)
export const ISO_TILE_W_HALF = ISO_TILE_W / 2;
export const ISO_TILE_H_HALF = ISO_TILE_H / 2;

/** Pixels above tile surface for building / vegetation sprites */
export const ISO_SPRITE_OFFSET_Y = ISO_TILE_H;

/** Grid dimensions of the Spot world */
export const WORLD_COLS = 100;
export const WORLD_ROWS = 100;

// ---------------------------------------------------------------------------
// Core projection functions (pure — no state, fully testable)
// ---------------------------------------------------------------------------

/**
 * Convert a grid coordinate to its isometric world-space position.
 * Returns the top-left corner of the tile rhombus.
 */
export function gridToWorld(gx: number, gy: number): { wx: number; wy: number } {
  const wx = (gx - gy) * ISO_TILE_W_HALF;
  const wy = (gx + gy) * ISO_TILE_H_HALF;
  return { wx, wy };
}

/**
 * Convert an isometric world-space position back to the nearest grid cell.
 * Returns null when the position is outside the valid grid bounds.
 */
export function worldToGrid(wx: number, wy: number): { gx: number; gy: number } | null {
  // Inverse of the iso projection matrix
  const gxF = (wx / ISO_TILE_W_HALF + wy / ISO_TILE_H_HALF) / 2;
  const gyF = (wy / ISO_TILE_H_HALF - wx / ISO_TILE_W_HALF) / 2;

  const gx = Math.floor(gxF);
  const gy = Math.floor(gyF);

  if (gx < 0 || gy < 0 || gx >= WORLD_COLS || gy >= WORLD_ROWS) return null;
  return { gx, gy };
}

/**
 * The world-space "origin offset" that centres the diamond on screen.
 * Add this to all gridToWorld results before applying the camera transform
 * so that tile (0,0) starts at the top of the diamond.
 */
export function getWorldOrigin(): { ox: number; oy: number } {
  // Top apex is at x = 0; shift left by half the diamond width so it centres
  const ox = (WORLD_ROWS - 1) * ISO_TILE_W_HALF; // horizontal centre
  const oy = 0;
  return { ox, oy };
}

// ---------------------------------------------------------------------------
// Depth sort key
// ---------------------------------------------------------------------------

/**
 * Tiles with a higher depth key should be drawn later (on top).
 * For standard isometric, depth = gx + gy (painter's algorithm row).
 * Add a fractional part to sort sprites within the same row by y position.
 */
export function depthKey(gx: number, gy: number, subLayer = 0): number {
  return gx + gy + subLayer * 0.01;
}

// ---------------------------------------------------------------------------
// Frustum culling
// ---------------------------------------------------------------------------

/**
 * Given the camera's world-space viewport bounds, compute the grid range
 * of tiles that could possibly be visible. Adds a margin of extra tiles
 * to avoid pop-in near edges.
 */
export function getVisibleGridRange(
  worldLeft: number,
  worldTop: number,
  worldRight: number,
  worldBottom: number,
  margin = 3,
): { minGx: number; maxGx: number; minGy: number; maxGy: number } {
  // The four world corners map to grid coords via worldToGrid.
  // We take the bounding box of those results and add a margin.
  const corners = [
    worldToGrid(worldLeft, worldTop),
    worldToGrid(worldRight, worldTop),
    worldToGrid(worldLeft, worldBottom),
    worldToGrid(worldRight, worldBottom),
  ].filter(Boolean) as { gx: number; gy: number }[];

  if (corners.length === 0) {
    // Full grid fallback (extreme zoom-out)
    return { minGx: 0, maxGx: WORLD_COLS - 1, minGy: 0, maxGy: WORLD_ROWS - 1 };
  }

  // Also consider the direct world-to-grid of extra points to handle
  // the top/bottom apices of the diamond
  const all = [
    worldToGrid(worldLeft + (worldRight - worldLeft) / 2, worldTop),
    worldToGrid(worldLeft + (worldRight - worldLeft) / 2, worldBottom),
    ...corners,
  ].filter(Boolean) as { gx: number; gy: number }[];

  let minGx = Math.min(...all.map((c) => c.gx)) - margin;
  let maxGx = Math.max(...all.map((c) => c.gx)) + margin;
  let minGy = Math.min(...all.map((c) => c.gy)) - margin;
  let maxGy = Math.max(...all.map((c) => c.gy)) + margin;

  // Clamp to world bounds
  minGx = Math.max(0, minGx);
  maxGx = Math.min(WORLD_COLS - 1, maxGx);
  minGy = Math.max(0, minGy);
  maxGy = Math.min(WORLD_ROWS - 1, maxGy);

  return { minGx, maxGx, minGy, maxGy };
}

// ---------------------------------------------------------------------------
// Diamond hit-test (for accurate click detection on iso tiles)
// ---------------------------------------------------------------------------

/**
 * Test whether a world-space point (wx, wy) falls inside the diamond
 * (rhombus) of the given tile. Used for precise click hit-detection.
 */
export function isPointInTile(
  wx: number,
  wy: number,
  tileGx: number,
  tileGy: number,
): boolean {
  const { wx: tx, wy: ty } = gridToWorld(tileGx, tileGy);
  const { ox } = getWorldOrigin();

  // Local coords relative to tile centre
  const localX = wx - (tx + ox);
  const localY = wy - ty - ISO_TILE_H_HALF;

  // Diamond test: |localX / halfW| + |localY / halfH| <= 1
  return (
    Math.abs(localX / ISO_TILE_W_HALF) + Math.abs(localY / ISO_TILE_H_HALF) <= 1
  );
}
