/**
 * City & District Layout Generator for Spot World (100x100 Grid).
 *
 * Distinct Urban Districts:
 *  1. Central Grand Plaza (gx: 40..58, gy: 40..58) — Grand stone plaza, fountain square, study kiosk.
 *  2. Central Park & Lake (gx: 62..82, gy: 12..35) — Lush park, lake with mystic duck, genesis monolith.
 *  3. Downtown Cyber District (gx: 8..36, gy: 8..36) — Asphalt avenues, neon vending machines, bus stops.
 *  4. Cafe Promenade (gx: 8..36, gy: 54..86) — Terracotta brick, cafe parasols, Midnight Whiskers cat.
 *  5. Zen Gardens & Courtyards (gx: 58..88, gy: 54..86) — Stepping stones, whispering stone lanterns, cherry trees.
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
  | 'genesis_monolith'
  | 'dev_library'
  | 'mystic_duck'
  | 'cafe_cat'
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

const MAJOR_ROADS_X = [48, 49];
const MAJOR_ROADS_Y = [48, 49];

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
  if (gx >= 36 && gx <= 60 && gy >= 36 && gy <= 60) {
    return 'grand_plaza';
  }
  if (gx >= 55 && gy <= 36) {
    return 'central_park';
  }
  if (gx <= 45 && gy >= 52) {
    return 'promenade';
  }
  if (gx >= 55 && gy >= 52) {
    return 'zen_garden';
  }
  return 'downtown';
}

// ---------------------------------------------------------------------------
// Tile Type Generator
// ---------------------------------------------------------------------------

export function getCityTileType(gx: number, gy: number): UrbanTileType {
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

  if (isSidewalk(gx, gy)) {
    return 'sidewalk';
  }

  const district = getDistrict(gx, gy);

  switch (district) {
    case 'central_park': {
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

  // ── SPECIAL EASTER EGG & STUDY LANDMARKS ───────────────────────────────────

  // 1. Center Landmark Fountain (48, 47)
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

  // 2. Genesis Monolith in Central Park Grove (64, 16)
  if (gx === 64 && gy === 16) {
    return {
      gx,
      gy,
      type: 'genesis_monolith',
      wx: gx * TILE_WIDTH + TILE_WIDTH / 2,
      wy: gy * TILE_HEIGHT + TILE_HEIGHT,
      hasLight: true,
      lightColor: 'rgba(245, 158, 11, 0.45)',
      lightRadius: 80,
    };
  }

  // 3. Open Developer Study Kiosk in Grand Plaza (44, 52)
  if (gx === 44 && gy === 52) {
    return {
      gx,
      gy,
      type: 'dev_library',
      wx: gx * TILE_WIDTH + TILE_WIDTH / 2,
      wy: gy * TILE_HEIGHT + TILE_HEIGHT,
      hasLight: true,
      lightColor: 'rgba(129, 140, 248, 0.38)',
      lightRadius: 75,
    };
  }

  // 4. Mystic Lake Duck (72, 22)
  if (gx === 72 && gy === 22) {
    return {
      gx,
      gy,
      type: 'mystic_duck',
      wx: gx * TILE_WIDTH + TILE_WIDTH / 2,
      wy: gy * TILE_HEIGHT + TILE_HEIGHT / 2,
      hasLight: true,
      lightColor: 'rgba(56, 189, 248, 0.25)',
      lightRadius: 40,
    };
  }

  // 5. Midnight Whiskers Cafe Cat (22, 70)
  if (gx === 22 && gy === 70) {
    return {
      gx,
      gy,
      type: 'cafe_cat',
      wx: gx * TILE_WIDTH + TILE_WIDTH / 2,
      wy: gy * TILE_HEIGHT + TILE_HEIGHT,
      hasLight: true,
      lightColor: 'rgba(244, 114, 182, 0.30)',
      lightRadius: 45,
    };
  }

  // 6. Interactive Cyber Vending Machine in Downtown (18, 24)
  if (gx === 18 && gy === 24) {
    return {
      gx,
      gy,
      type: 'vending_machine',
      wx: gx * TILE_WIDTH + TILE_WIDTH / 2,
      wy: gy * TILE_HEIGHT + TILE_HEIGHT,
      hasLight: true,
      lightColor: 'rgba(56, 189, 248, 0.38)',
      lightRadius: 55,
    };
  }

  // 7. Whispering Stone Lantern in Zen Garden (78, 74)
  if (gx === 78 && gy === 74) {
    return {
      gx,
      gy,
      type: 'stone_lantern',
      wx: gx * TILE_WIDTH + TILE_WIDTH / 2,
      wy: gy * TILE_HEIGHT + TILE_HEIGHT,
      hasLight: true,
      lightColor: 'rgba(251, 146, 60, 0.40)',
      lightRadius: 65,
    };
  }

  // ── Standard District Props ───────────────────────────────────────────────

  if (tileType === 'sidewalk') {
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
