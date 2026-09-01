/**
 * City Terrain & Urban District Generator for Spot World.
 *
 * Layout System for 100x100 Grid:
 * - Avenues: 2-lane dark asphalt roads with lane stripes every 10 tiles.
 * - Crosswalks: Pedestrian crosswalk markings at every avenue intersection.
 * - Sidewalks: Paved stone curbs with streetlamps and planter boxes along streets.
 * - Urban Districts: Paved plaza squares and parks where citizens live and roam.
 */

import { TILE_WIDTH, TILE_HEIGHT, WORLD_COLS, WORLD_ROWS } from '@spot/world';

export type UrbanTileType =
  | 'road_asphalt'
  | 'road_h_stripe'
  | 'road_v_stripe'
  | 'crosswalk'
  | 'sidewalk'
  | 'sidewalk_curb'
  | 'plaza_paving'
  | 'park_grass';

export type UrbanPropType =
  | 'street_lamp'
  | 'bench'
  | 'vending_machine'
  | 'tree_planter'
  | 'bush_box'
  | 'fire_hydrant'
  | 'trash_can'
  | 'bus_stop'
  | 'cafe_table'
  | null;

export interface CityProp {
  gx: number;
  gy: number;
  type: UrbanPropType;
  wx: number;
  wy: number;
  hasLight: boolean;
}

function spatialHash(gx: number, gy: number, salt = 0): number {
  let h = (gx * 73856093) ^ (gy * 19349663) ^ (salt * 83492791);
  h ^= h << 13;
  h ^= h >> 17;
  h ^= h << 5;
  return (h >>> 0) / 0x100000000;
}

/**
 * Determine the urban ground tile type for (gx, gy).
 */
export function getCityTileType(gx: number, gy: number): UrbanTileType {
  const isHorizRoad = gy % 10 === 0 || gy % 10 === 1;
  const isVertRoad = gx % 10 === 0 || gx % 10 === 1;

  // 1. Intersection Crosswalks
  if ((isHorizRoad && (gx % 10 === 9 || gx % 10 === 2)) || (isVertRoad && (gy % 10 === 9 || gy % 10 === 2))) {
    return 'crosswalk';
  }

  // 2. Roadways
  if (isHorizRoad) {
    return gy % 10 === 0 ? 'road_h_stripe' : 'road_asphalt';
  }
  if (isVertRoad) {
    return gx % 10 === 0 ? 'road_v_stripe' : 'road_asphalt';
  }

  // 3. Sidewalks along roads
  const isSidewalk = gy % 10 === 2 || gy % 10 === 9 || gx % 10 === 2 || gx % 10 === 9;
  if (isSidewalk) {
    return 'sidewalk';
  }

  // 4. Urban Interior (Plazas & Parks)
  const isPark = (Math.floor(gx / 10) + Math.floor(gy / 10)) % 3 === 0;
  if (isPark) {
    return 'park_grass';
  }

  return 'plaza_paving';
}

/**
 * Determine urban street props on sidewalks and plazas.
 */
export function getCityProp(gx: number, gy: number, isOccupiedCitizen: boolean): CityProp | null {
  if (isOccupiedCitizen) return null;

  const tileType = getCityTileType(gx, gy);
  const r = spatialHash(gx, gy, 404);

  let type: UrbanPropType = null;
  let hasLight = false;

  // Streetlamps on sidewalk corners and intervals
  const isSidewalk = tileType === 'sidewalk';
  if (isSidewalk) {
    if ((gx % 5 === 2 && gy % 5 === 2) || (gx % 5 === 4 && gy % 5 === 4)) {
      type = 'street_lamp';
      hasLight = true;
    } else if (r < 0.08) {
      type = 'bench';
    } else if (r < 0.12) {
      type = 'tree_planter';
    } else if (r < 0.15) {
      type = 'vending_machine';
      hasLight = true;
    } else if (r < 0.18) {
      type = 'trash_can';
    } else if (r < 0.20) {
      type = 'fire_hydrant';
    }
  } else if (tileType === 'plaza_paving') {
    if (r < 0.04) {
      type = 'cafe_table';
    } else if (r < 0.08) {
      type = 'bench';
    } else if (r < 0.12) {
      type = 'tree_planter';
    } else if (r < 0.15) {
      type = 'street_lamp';
      hasLight = true;
    }
  } else if (tileType === 'park_grass') {
    if (r < 0.08) {
      type = 'tree_planter';
    } else if (r < 0.14) {
      type = 'bush_box';
    } else if (r < 0.18) {
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
  };
}
