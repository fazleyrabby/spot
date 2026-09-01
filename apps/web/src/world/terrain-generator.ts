/**
 * City & District Layout Generator for Spot World (100x100 Grid).
 *
 * Geographical Structure:
 *  1. Northern Mountain Ridge (gy: 0..4) — Snow-capped peaks & mountain pines.
 *  2. Northern Railway & Metro (gy: 5..6) — High-speed cyber bullet train track.
 *  3. Central Grand Plaza (gx: 36..60, gy: 36..60) — Grand stone plaza, fountain square, study kiosk.
 *  4. Central Park & Lake (gx: 55..85, gy: 8..35) — Lush park, lake with mystic duck, genesis monolith.
 *  5. Downtown Cyber District (gx: 8..36, gy: 8..36) — Asphalt avenues, neon vending machines, bus stops.
 *  6. Cafe Promenade (gx: 8..36, gy: 52..86) — Terracotta brick, cafe parasols, Midnight Whiskers cat.
 *  7. Zen Gardens & Courtyards (gx: 55..88, gy: 52..86) — Stepping stones, whispering stone lanterns, cherry trees.
 *  8. Coastal Timber Boardwalk (gy: 89..90) — Dark teak wood decking with nautical lanterns.
 *  9. Southern Moonlit Beach (gy: 91..94) — Deep warm sand, palm trees, beach bonfire, loungers.
 *  10. Southern Midnight Ocean (gy: 95..99) — Deep oceanic navy with glowing bioluminescent surf waves.
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

const MAJOR_ROADS_X = [48, 49];
const MAJOR_ROADS_Y = [48, 49];

const SECONDARY_ROADS_X = [14, 32, 68, 86];
const SECONDARY_ROADS_Y = [14, 32, 68, 86];

function isRoad(gx: number, gy: number): boolean {
  if (gy < 8 || gy > 88) return false;
  return (
    MAJOR_ROADS_X.includes(gx) ||
    MAJOR_ROADS_Y.includes(gy) ||
    SECONDARY_ROADS_X.includes(gx) ||
    SECONDARY_ROADS_Y.includes(gy)
  );
}

function isSidewalk(gx: number, gy: number): boolean {
  if (gy < 8 || gy > 88) return false;
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
  if (gy <= 4) return 'mountains';
  if (gy <= 6) return 'railway';
  if (gy >= 95) return 'ocean';
  if (gy >= 91) return 'beach';
  if (gy >= 89) return 'boardwalk';

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
  // 1. Northern Mountains (gy: 0..4)
  if (gy <= 4) {
    return gy <= 2 && (gx % 3 === 0 || gx % 5 === 0) ? 'mountain_snow' : 'mountain_rock';
  }

  // 2. Northern Railway Track (gy: 5..6)
  if (gy === 5 || gy === 6) {
    return 'railway_ballast';
  }

  // 3. Southern Midnight Ocean (gy: 95..99)
  if (gy >= 96) {
    return 'ocean_deep';
  }
  if (gy === 95) {
    return 'ocean_surf';
  }

  // 4. Southern Moonlit Beach (gy: 91..94)
  if (gy >= 91) {
    return 'beach_sand';
  }

  // 5. Coastal Timber Boardwalk (gy: 89..90)
  if (gy >= 89) {
    return 'boardwalk';
  }

  // 6. Urban Roads & Sidewalks
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

  // Center Landmark Fountain (48, 47)
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

  // Genesis Monolith in Central Park Grove (64, 16)
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

  // Open Developer Study Kiosk in Grand Plaza (44, 52)
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

  // Mystic Lake Duck (72, 22)
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

  // Midnight Whiskers Cafe Cat (22, 70)
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

  // Interactive Cyber Vending Machine in Downtown (18, 24)
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

  // Whispering Stone Lantern in Zen Garden (78, 74)
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

  // ── GEOGRAPHY PROPS (Mountains, Railway, Boardwalk, Beach) ─────────────────

  if (district === 'mountains') {
    if (r < 0.22) {
      type = 'mountain_pine';
    }
  } else if (district === 'railway') {
    if (gx % 12 === 0 && gy === 5) {
      type = 'railway_signal';
      hasLight = true;
      lightColor = 'rgba(16, 185, 129, 0.35)';
      lightRadius = 40;
    }
  } else if (district === 'boardwalk') {
    if (gx % 5 === 0 && gy === 89) {
      type = 'boardwalk_lamp';
      hasLight = true;
      lightColor = 'rgba(251, 191, 36, 0.35)';
      lightRadius = 50;
    } else if (r < 0.12) {
      type = 'bench';
    }
  } else if (district === 'beach') {
    // Cozy beach bonfire in center of beach
    if (gx === 48 && gy === 92) {
      type = 'beach_bonfire';
      hasLight = true;
      lightColor = 'rgba(249, 115, 22, 0.55)';
      lightRadius = 95;
    } else if (r < 0.07) {
      type = 'palm_tree';
    } else if (r < 0.13) {
      type = 'beach_lounger';
    } else if (r < 0.18) {
      type = 'beach_umbrella';
    } else if (r < 0.22) {
      type = 'starfish';
    }
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
