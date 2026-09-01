/**
 * City & District Layout Generator for Spot World (100x100 Grid).
 *
 * Distinct Urban Districts:
 *  1. Central Grand Plaza (gx: 40..58, gy: 40..58) — Grand stone plaza, fountain square, cafe tables.
 *  2. Central Park & Lake (gx: 62..82, gy: 12..35) — Lush park, organic pond, bridges, flower beds.
 *  3. Downtown Cyber District (gx: 8..36, gy: 8..36) — Asphalt avenues, neon vending machines, bus stops.
 *  4. Cafe Promenade (gx: 8..36, gy: 54..86) — Terracotta brick, cafe parasols, bistro seating.
 *  5. Zen Gardens & Courtyards (gx: 58..88, gy: 54..86) — Stepping stones, stone lanterns, cherry trees.
 *  6. Asymmetric Road Network — Major 2-lane boulevards and varied side streets (no rigid 10x10 waffle).
 */

import { TILE_WIDTH, TILE_HEIGHT, WORLD_COLS, WORLD_ROWS } from '@spot/world';

export type UrbanTileType =
  | 'road_asphalt'
  | 'road_h_stripe'
  | 'road_v_stripe'
  | 'crosswalk'
  | 'sidewalk'
  | 'plaza_grand'
  | 'plaza_terracotta'
  | 'plaza_zen'
  | 'park_grass'
  | 'water_pond';

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
// Road & Boulevard Grid Definitions (Asymmetric & Hierarchical)
// ---------------------------------------------------------------------------

// Major 2-lane avenues
const MAJOR_ROADS_X = [48, 49]; // Central Grand Boulevard N-S
const MAJOR_ROADS_Y = [48, 49]; // Central Grand Boulevard E-W

// Secondary 1-lane streets (varied spacing: 18, 34, 66, 84)
const SECONDARY_ROADS_X = [14, 32, 68, 86];
const SECONDARY_ROADS_Y = [14, 32, 68, 86];

function isRoad(gx: number, gy: number): boolean {
  return (
    MAJOR_ROADS_X.includes(gx) ||
    MAJOR_ROADS_Y.includes(gy) ||
    SECONDARY_ROADS_X.includes(gx) ||
    SECONDARY_ROADS_Y.includes(gy)
  );
}

function isSidewalk(gx: number, gy: number): boolean {
  if (isRoad(gx, gy)) return false;
  // Sidewalks buffer every road by 1 tile
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

export type DistrictType = 'grand_plaza' | 'central_park' | 'downtown' | 'promenade' | 'zen_garden';

export function getDistrict(gx: number, gy: number): DistrictType {
  // 1. Central Grand Plaza (center of the world)
  if (gx >= 36 && gx <= 60 && gy >= 36 && gy <= 60) {
    return 'grand_plaza';
  }
  // 2. Central Park & Lake (North-East)
  if (gx >= 55 && gy <= 36) {
    return 'central_park';
  }
  // 3. Cafe Promenade (South-West)
  if (gx <= 45 && gy >= 52) {
    return 'promenade';
  }
  // 4. Zen Gardens & Courtyards (South-East)
  if (gx >= 55 && gy >= 52) {
    return 'zen_garden';
  }
  // 5. Downtown Cyber District (North-West)
  return 'downtown';
}

// ---------------------------------------------------------------------------
// Tile Type Generator
// ---------------------------------------------------------------------------

export function getCityTileType(gx: number, gy: number): UrbanTileType {
  // 1. Roads & Crosswalks
  const isRX = MAJOR_ROADS_X.includes(gx) || SECONDARY_ROADS_X.includes(gx);
  const isRY = MAJOR_ROADS_Y.includes(gy) || SECONDARY_ROADS_Y.includes(gy);

  if (isRX && isRY) {
    return 'crosswalk';
  }
  if (isRX) {
    return MAJOR_ROADS_X.includes(gx) ? 'road_v_stripe' : 'road_asphalt';
  }
  if (isRY) {
    return MAJOR_ROADS_Y.includes(gy) ? 'road_h_stripe' : 'road_asphalt';
  }

  // 2. Sidewalks along streets
  if (isSidewalk(gx, gy)) {
    return 'sidewalk';
  }

  // 3. District Interior
  const district = getDistrict(gx, gy);

  switch (district) {
    case 'central_park': {
      // Organic Lake Pond in Central Park
      const dx = gx - 70;
      const dy = gy - 22;
      const dist = (dx * dx) / 45 + (dy * dy) / 20;
      if (dist < 1.0) {
        return 'water_pond';
      }
      return 'park_grass';
    }

    case 'grand_plaza':
      return 'plaza_grand';

    case 'promenade':
      return 'plaza_terracotta';

    case 'zen_garden':
      return 'plaza_zen';

    case 'downtown':
    default:
      return 'plaza_grand';
  }
}

// ---------------------------------------------------------------------------
// Prop & Landmark Generator
// ---------------------------------------------------------------------------

export function getCityProp(gx: number, gy: number, isOccupiedCitizen: boolean): CityProp | null {
  if (isOccupiedCitizen || isRoad(gx, gy)) return null;

  const tileType = getCityTileType(gx, gy);
  const district = getDistrict(gx, gy);
  const r = spatialHash(gx, gy, 505);

  let type: UrbanPropType = null;
  let hasLight = false;
  let lightColor = 'rgba(251, 191, 36, 0.28)';
  let lightRadius = 60;

  // 1. Center Landmark Fountain (at the exact heart of Grand Plaza: 48, 48)
  if (gx === 48 && gy === 47) {
    return {
      gx,
      gy,
      type: 'fountain',
      wx: gx * TILE_WIDTH + TILE_WIDTH,
      wy: gy * TILE_HEIGHT + TILE_HEIGHT,
      hasLight: true,
      lightColor: 'rgba(56, 189, 248, 0.35)',
      lightRadius: 90,
    };
  }

  // 2. Sidewalk streetlamps and props
  if (tileType === 'sidewalk') {
    // Streetlamps spaced along roads
    if ((gx % 4 === 1 && gy % 2 === 0) || (gy % 4 === 1 && gx % 2 === 0)) {
      type = 'street_lamp';
      hasLight = true;
    } else if (r < 0.08) {
      type = 'bench';
    } else if (r < 0.13) {
      type = 'tree_planter';
    } else if (r < 0.17 && district === 'downtown') {
      type = 'vending_machine';
      hasLight = true;
      lightColor = 'rgba(56, 189, 248, 0.28)';
      lightRadius = 36;
    } else if (r < 0.20) {
      type = 'trash_can';
    } else if (r < 0.22) {
      type = 'fire_hydrant';
    }
  } else if (district === 'central_park' && tileType === 'park_grass') {
    if (r < 0.09) {
      type = 'park_tree';
    } else if (r < 0.16) {
      type = 'flower_bed';
    } else if (r < 0.20) {
      type = 'bench';
    }
  } else if (district === 'promenade') {
    if (r < 0.08) {
      type = 'cafe_table';
    } else if (r < 0.13) {
      type = 'flower_bed';
    } else if (r < 0.18) {
      type = 'street_lamp';
      hasLight = true;
      lightColor = 'rgba(251, 191, 36, 0.35)';
    }
  } else if (district === 'zen_garden') {
    if (r < 0.08) {
      type = 'cherry_tree';
    } else if (r < 0.14) {
      type = 'stone_lantern';
      hasLight = true;
      lightColor = 'rgba(251, 146, 60, 0.30)';
      lightRadius = 45;
    } else if (r < 0.19) {
      type = 'bench';
    }
  } else if (district === 'grand_plaza') {
    if (r < 0.06) {
      type = 'cafe_table';
    } else if (r < 0.12) {
      type = 'tree_planter';
    } else if (r < 0.16) {
      type = 'bench';
    }
  }

  if (!type) return null;

  const wx = gx * TILE_WIDTH + TILE_WIDTH / 2;
  const wy = gy * TILE_HEIGHT + TILE_HEIGHT;

  return {
    gx,
    gy,
    type,
    wx,
    wy,
    hasLight,
    lightColor,
    lightRadius,
  };
}
