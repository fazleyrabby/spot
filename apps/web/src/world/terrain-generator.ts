/**
 * Deterministic procedural terrain generator for Spot World.
 *
 * Rules:
 * - Every tile gets a base terrain type (grass_a or grass_b).
 * - Empty tiles may also receive vegetation (tree, bush, flower, rock).
 * - All results are pure functions of (gx, gy) — same output for all users.
 * - Occupied tiles only show the house + avatar; vegetation is suppressed.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TerrainBase = 'grass_a' | 'grass_b';

export type VegetationType = 'tree_a' | 'tree_b' | 'bush' | 'flower' | 'rock' | null;

export interface TileNature {
  base: TerrainBase;
  vegetation: VegetationType;
}

// ---------------------------------------------------------------------------
// Deterministic hash (LCG-style, no external deps)
// ---------------------------------------------------------------------------

/**
 * Cheap spatial hash that returns a pseudo-random number in [0, 1).
 * Prime multiplication avoids obvious grid patterns.
 */
function spatialHash(gx: number, gy: number, salt = 0): number {
  let h = (gx * 73856093) ^ (gy * 19349663) ^ (salt * 83492791);
  // Xorshift32
  h ^= h << 13;
  h ^= h >> 17;
  h ^= h << 5;
  // Normalise to [0, 1)
  return (h >>> 0) / 0x100000000;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the deterministic nature of a tile at grid (gx, gy).
 * Pass `isOccupied = true` to suppress vegetation on claimed plots.
 */
export function getTileNature(gx: number, gy: number, isOccupied: boolean): TileNature {
  const r0 = spatialHash(gx, gy, 0);
  const r1 = spatialHash(gx, gy, 1);

  const base: TerrainBase = r0 < 0.55 ? 'grass_a' : 'grass_b';

  let vegetation: VegetationType = null;

  if (!isOccupied) {
    if (r1 < 0.12) {
      // ~12% chance of tree
      vegetation = r0 < 0.5 ? 'tree_a' : 'tree_b';
    } else if (r1 < 0.20) {
      vegetation = 'bush';
    } else if (r1 < 0.27) {
      vegetation = 'flower';
    } else if (r1 < 0.31) {
      vegetation = 'rock';
    }
  }

  return { base, vegetation };
}

/**
 * House archetype selector — maps an avatar ID to a house visual style.
 * Returns a colour palette key used by the renderer.
 */
export type HouseStyle = 'tech' | 'magic' | 'explorer' | 'default';

const ARCHETYPE_MAP: Record<string, HouseStyle> = {
  'cyber-hacker': 'tech',
  'cyber-ronin': 'tech',
  archmage: 'magic',
  'solar-champion': 'magic',
  astronaut: 'explorer',
};

export function getHouseStyle(avatarId: string): HouseStyle {
  return ARCHETYPE_MAP[avatarId] ?? 'default';
}

/**
 * Deterministic sub-tile avatar idle position within a plot.
 * Returns an offset (0..1 range) so the avatar idles slightly off-centre.
 */
export function getAvatarIdleOffset(gx: number, gy: number): { dx: number; dy: number } {
  const rx = spatialHash(gx, gy, 42);
  const ry = spatialHash(gx, gy, 43);
  return {
    dx: (rx - 0.5) * 0.3, // ± 15% of tile width
    dy: (ry - 0.5) * 0.2,
  };
}
