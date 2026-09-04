/**
 * City & Surroundings Terrain Generator for Spot World.
 *
 * Architecture & Clean Geographic Separation:
 *
 * 1. 🏙️ THE SPOT WORLD CITY (gx: 0..99, gy: 0..99 — 10,000 Pure Citizen Plots):
 *    - Central Grand Plaza (gx: 36..64, gy: 36..64) — Polished granite, fountains, study kiosk.
 *    - Central Park & Lake (gx: 55..92, gy: 8..36) — Verdant parklands, pond, Genesis Monolith, Mystic Duck.
 *    - Downtown Cyber District (gx: 8..36, gy: 8..36) — Neon avenues, vending machines, transit shelters.
 *    - Cafe Promenade (gx: 8..36, gy: 55..92) — Terracotta brick, cafe parasols, Midnight Whiskers cat.
 *    - Zen Gardens & Courtyards (gx: 55..92, gy: 55..92) — Stepping stones, whispering lanterns, cherry blossoms.
 *    - Complete road grid with sidewalks, streetlamps, and tree planters throughout.
 *    - NO citizen ever spawns on a mountain, railway track, or in the ocean!
 *
 * 2. 🌲 NORTHERN MOUNTAINS & RAILWAY (gy < 0 — External Wilderness):
 *    - Mountain Rock & Snow Peaks (gy: -16 .. -4)
 *    - High-Speed Cyber Railway Track (gy: -3 .. -2)
 *    - Security Buffer Boulevard & Guardrail (gy: -1)
 *
 * 3. 🌊 SOUTHERN COASTAL SHORELINE (gy >= 100 — External Coast):
 *    - Coastal Timber Boardwalk (gy: 100 .. 101) with nautical amber lanterns.
 *    - Moonlit Beach (gy: 102 .. 106) with warm sand, palm trees, loungers, and bonfire.
 *    - Midnight Bioluminescent Ocean Surf (gy: 107 .. 120) with animated waves.
 *
 * 4. 🌊 EASTERN & WESTERN SEAWALLS (gx < 0 || gx >= 100):
 *    - Deep oceanic waters surrounding the island.
 */

import { TILE_WIDTH, TILE_HEIGHT } from '@spot/world';

export type UrbanTileType =
  | 'mountain_rock'
  | 'mountain_snow'
  | 'railway_ballast'
  | 'road_asphalt'
  | 'road_h_stripe'
  | 'road_v_stripe'
  | 'crosswalk'
  | 'sidewalk'
  | 'plaza_grand'
  | 'plaza_terracotta'
  | 'plaza_zen'
  | 'park_grass'
  | 'water_pond'
  | 'boardwalk'
  | 'beach_sand'
  | 'ocean_deep'
  | 'ocean_surf';

export type UrbanPropType =
  | 'street_lamp'
  | 'fountain'
  | 'bench'
  | 'vending_machine'
  | 'tree_planter'
  | 'cherry_tree'
  | 'park_tree'
  | 'flower_bed'
  | 'cafe_table'
  | 'stone_lantern'
  | 'fire_hydrant'
  | 'trash_can'
  | 'bus_stop'
  | 'genesis_monolith'
  | 'dev_library'
  | 'mystic_duck'
  | 'cafe_cat'
  | 'glitch_void'
  | 'cyber_lighthouse'
  | 'hermit_cabin'
  | 'retro_arcade'
  | 'sunken_sub'
  | 'palm_tree'
  | 'beach_umbrella'
  | 'beach_bonfire'
  | 'boardwalk_lamp'
  | 'beach_lounger'
  | 'starfish'
  | 'mountain_pine'
  | 'railway_signal'
  | null;

export interface CityProp {
  gx: number;
  gy: number;
  type: UrbanPropType;
  wx: number;
  wy: number;
  hasLight: boolean;
  lightColor?: string;
  lightRadius?: number;
}

function spatialHash(gx: number, gy: number, salt = 0): number {
  let h = (gx * 73856093) ^ (gy * 19349663) ^ (salt * 83492791);
  h ^= h << 13;
  h ^= h >> 17;
  h ^= h << 5;
  return (h >>> 0) / 0x100000000;
}

// ---------------------------------------------------------------------------
// Road & Boulevard Grid Definitions
// ---------------------------------------------------------------------------

const MAJOR_ROADS_X = [20, 50, 80];
const MAJOR_ROADS_Y = [20, 50, 80];

const SECONDARY_ROADS_X = [8, 35, 65, 92];
const SECONDARY_ROADS_Y = [8, 35, 65, 92];

function isRoad(gx: number, gy: number): boolean {
  if (gy < 0 || gy > 99 || gx < 0 || gx > 99) return false;
  return (
    MAJOR_ROADS_X.includes(gx) ||
    MAJOR_ROADS_Y.includes(gy) ||
    SECONDARY_ROADS_X.includes(gx) ||
    SECONDARY_ROADS_Y.includes(gy)
  );
}

function isSidewalk(gx: number, gy: number): boolean {
  if (gy < 0 || gy > 99 || gx < 0 || gx > 99) return false;
  if (isRoad(gx, gy)) return false;
  for (const rx of [...MAJOR_ROADS_X, ...SECONDARY_ROADS_X]) {
    if (Math.abs(gx - rx) === 1) return true;
  }
  for (const ry of [...MAJOR_ROADS_Y, ...SECONDARY_ROADS_Y]) {
    if (Math.abs(gy - ry) === 1) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// District Classification
// ---------------------------------------------------------------------------

export type DistrictType =
  | 'mountains'
  | 'railway'
  | 'grand_plaza'
  | 'central_park'
  | 'downtown'
  | 'promenade'
  | 'zen_garden'
  | 'boardwalk'
  | 'beach'
  | 'ocean';

export function getDistrict(gx: number, gy: number): DistrictType {
  // External surroundings
  if (gy <= -4) return 'mountains';
  if (gy <= -2) return 'railway';
  if (gy >= 107 || gx < 0 || gx >= 100) return 'ocean';
  if (gy >= 102) return 'beach';
  if (gy >= 100) return 'boardwalk';

  // Internal City (0..99, 0..99)
  if (gx >= 36 && gx <= 64 && gy >= 36 && gy <= 64) {
    return 'grand_plaza';
  }
  if (gx >= 55 && gy <= 36) {
    return 'central_park';
  }
  if (gx <= 45 && gy >= 55) {
    return 'promenade';
  }
  if (gx >= 55 && gy >= 55) {
    return 'zen_garden';
  }
  return 'downtown';
}

// ---------------------------------------------------------------------------
// Tile Type Generator
// ---------------------------------------------------------------------------

export function getCityTileType(gx: number, gy: number): UrbanTileType {
  // ── 1. External Northern Wilderness (gy < 0) ─────────────────────────────
  if (gy <= -4) {
    const r = spatialHash(gx, gy, 101);
    return r > 0.45 ? 'mountain_snow' : 'mountain_rock';
  }
  if (gy === -3 || gy === -2) {
    return 'railway_ballast';
  }
  if (gy === -1) {
    return 'road_asphalt';
  }

  // ── 2. External Southern Coast (gy >= 100) ──────────────────────────────
  if (gy === 100 || gy === 101) {
    return 'boardwalk';
  }
  if (gy >= 102 && gy <= 106) {
    return 'beach_sand';
  }
  if (gy >= 107) {
    return gy <= 108 ? 'ocean_surf' : 'ocean_deep';
  }

  // ── 3. External East / West Ocean Waters ─────────────────────────────────
  if (gx < 0 || gx >= 100) {
    return 'ocean_deep';
  }

  // ── 4. Pure Spot World City (0..99, 0..99) ───────────────────────────────
  const isMajorX = MAJOR_ROADS_X.includes(gx);
  const isMajorY = MAJOR_ROADS_Y.includes(gy);
  const isSecX = SECONDARY_ROADS_X.includes(gx);
  const isSecY = SECONDARY_ROADS_Y.includes(gy);

  // Crosswalks at intersections
  if ((isMajorX || isSecX) && (isMajorY || isSecY)) {
    return 'crosswalk';
  }

  // Road lanes & stripes
  if (isMajorX || isSecX) {
    return 'road_v_stripe';
  }
  if (isMajorY || isSecY) {
    return 'road_h_stripe';
  }
  if (isRoad(gx, gy)) {
    return 'road_asphalt';
  }

  // Sidewalks
  if (isSidewalk(gx, gy)) {
    return 'sidewalk';
  }

  // District-specific urban terrain
  const district = getDistrict(gx, gy);

  switch (district) {
    case 'grand_plaza': {
      return 'plaza_grand';
    }

    case 'central_park': {
      // Lake pond in central park
      const dx = gx - 72;
      const dy = gy - 20;
      if (dx * dx * 0.7 + dy * dy < 50) {
        return 'water_pond';
      }
      return 'park_grass';
    }

    case 'promenade': {
      return 'plaza_terracotta';
    }

    case 'zen_garden': {
      return 'plaza_zen';
    }

    case 'downtown':
    default: {
      return 'sidewalk';
    }
  }
}

// ---------------------------------------------------------------------------
// Prop & Landmark Generator
// ---------------------------------------------------------------------------

export function getCityProp(gx: number, gy: number): CityProp | null {
  const wx = gx * TILE_WIDTH + TILE_WIDTH / 2;
  const wy = gy * TILE_HEIGHT + TILE_HEIGHT / 2;

  // ── 1. Northern Mountains & Railway Props (gy < 0) ───────────────────────
  if (gy <= -4) {
    const r = spatialHash(gx, gy, 202);
    if (r > 0.65) {
      return { gx, gy, type: 'mountain_pine', wx, wy, hasLight: false };
    }
    return null;
  }

  if (gy === -3 && (gx % 12 === 0)) {
    return {
      gx, gy, type: 'railway_signal', wx, wy,
      hasLight: true, lightColor: 'rgba(56, 189, 248, 0.45)', lightRadius: 65,
    };
  }

  // ── 2. Southern Boardwalk & Beach Props (gy >= 100) ──────────────────────
  if (gy === 100 && (gx % 8 === 0)) {
    return {
      gx, gy, type: 'boardwalk_lamp', wx, wy,
      hasLight: true, lightColor: 'rgba(251, 191, 36, 0.40)', lightRadius: 85,
    };
  }

  if (gx === 50 && gy === 104) {
    return {
      gx, gy, type: 'beach_bonfire', wx, wy,
      hasLight: true, lightColor: 'rgba(249, 115, 22, 0.65)', lightRadius: 130,
    };
  }

  if (gy === 103 && (gx === 46 || gx === 54 || gx === 34 || gx === 66)) {
    return { gx, gy, type: 'beach_lounger', wx, wy, hasLight: false };
  }

  if (gy === 102 && (gx % 10 === 4)) {
    return { gx, gy, type: 'palm_tree', wx, wy, hasLight: false };
  }

  if (gy >= 106 || gx < 0 || gx >= 100) {
    return null;
  }

  // ── 3. Internal City World Secrets & Lore Landmarks (0..99, 0..99) ───────
  if (gx === 64 && gy === 16) {
    return {
      gx, gy, type: 'genesis_monolith', wx, wy,
      hasLight: true, lightColor: 'rgba(245, 158, 11, 0.55)', lightRadius: 110,
    };
  }

  if (gx === 44 && gy === 52) {
    return {
      gx, gy, type: 'dev_library', wx, wy,
      hasLight: true, lightColor: 'rgba(251, 191, 36, 0.35)', lightRadius: 140,
    };
  }

  if (gx === 72 && gy === 22) {
    return {
      gx, gy, type: 'mystic_duck', wx, wy,
      hasLight: true, lightColor: 'rgba(251, 191, 36, 0.35)', lightRadius: 75,
    };
  }

  if (gx === 22 && gy === 68) {
    return {
      gx, gy, type: 'cafe_cat', wx, wy,
      hasLight: true, lightColor: 'rgba(244, 114, 182, 0.35)', lightRadius: 75,
    };
  }

  if (gx === 18 && gy === 24) {
    return {
      gx, gy, type: 'vending_machine', wx, wy,
      hasLight: true, lightColor: 'rgba(56, 189, 248, 0.45)', lightRadius: 85,
    };
  }

  if (gx === 98 && gy === 98) {
    return {
      gx, gy, type: 'glitch_void', wx, wy,
      hasLight: true, lightColor: 'rgba(168, 85, 247, 0.65)', lightRadius: 110,
    };
  }

  if (gx === 4 && gy === 94) {
    return {
      gx, gy, type: 'cyber_lighthouse', wx, wy,
      hasLight: true, lightColor: 'rgba(0, 240, 255, 0.75)', lightRadius: 140,
    };
  }

  if (gx === 50 && gy === 4) {
    return {
      gx, gy, type: 'hermit_cabin', wx, wy,
      hasLight: true, lightColor: 'rgba(245, 158, 11, 0.55)', lightRadius: 95,
    };
  }

  if (gx === 86 && gy === 22) {
    return {
      gx, gy, type: 'retro_arcade', wx, wy,
      hasLight: true, lightColor: 'rgba(239, 68, 68, 0.5)', lightRadius: 85,
    };
  }

  if (gx === 14 && gy === 78) {
    return {
      gx, gy, type: 'sunken_sub', wx, wy,
      hasLight: true, lightColor: 'rgba(56, 189, 248, 0.5)', lightRadius: 90,
    };
  }

  if (gx === 50 && gy === 50) {
    return {
      gx, gy, type: 'fountain', wx, wy,
      hasLight: true, lightColor: 'rgba(56, 189, 248, 0.45)', lightRadius: 100,
    };
  }

  // ── 4. Street Furniture & Environment in City ────────────────────────────
  const r = spatialHash(gx, gy, 42);

  // Streetlamps along sidewalks
  if (isSidewalk(gx, gy) && (gx + gy) % 9 === 0) {
    return {
      gx, gy, type: 'street_lamp', wx, wy,
      hasLight: true, lightColor: 'rgba(251, 191, 36, 0.42)', lightRadius: 90,
    };
  }

  // District-specific ambient props
  const district = getDistrict(gx, gy);

  if (district === 'central_park') {
    const tile = getCityTileType(gx, gy);
    if (tile === 'park_grass' && r > 0.82) {
      return { gx, gy, type: 'park_tree', wx, wy, hasLight: false };
    }
    if (tile === 'park_grass' && r > 0.74) {
      return { gx, gy, type: 'bench', wx, wy, hasLight: false };
    }
  }

  if (district === 'zen_garden') {
    if (r > 0.80) {
      return { gx, gy, type: 'cherry_tree', wx, wy, hasLight: false };
    }
    if (r > 0.70) {
      return {
        gx, gy, type: 'stone_lantern', wx, wy,
        hasLight: true, lightColor: 'rgba(251, 191, 36, 0.30)', lightRadius: 70,
      };
    }
  }

  if (district === 'promenade') {
    if (r > 0.82) {
      return { gx, gy, type: 'cafe_table', wx, wy, hasLight: false };
    }
    if (r > 0.72) {
      return { gx, gy, type: 'bench', wx, wy, hasLight: false };
    }
  }

  if (district === 'downtown') {
    if (r > 0.90) {
      return { gx, gy, type: 'tree_planter', wx, wy, hasLight: false };
    }
    if (r > 0.84) {
      return { gx, gy, type: 'fire_hydrant', wx, wy, hasLight: false };
    }
  }

  return null;
}
