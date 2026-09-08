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
import { ART_EXPERIENCES } from './art-experiences.js';

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
  | 'ocean_surf'
  | 'jungle_grass'
  | 'jungle_dense'
  | 'jungle_creek'
  | 'forest_grass'
  | 'forest_dense'
  | 'forest_creek'
  | 'void';

export type UrbanPropType =
  | 'street_lamp'
  | 'fountain'
  | 'bench'
  | 'vending_machine'
  | 'tree_planter'
  | 'cherry_tree'
  | 'park_tree'
  | 'great_oak'
  | 'master_bonsai'
  | 'fruit_tree'
  | 'jungle_tree'
  | 'ancient_redwood'
  | 'willow_tree'
  | 'birch_tree'
  | 'pine_tree'
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
  | 'city_hall'
  | 'cafe_storefront'
  | 'grand_station'
  | 'wishing_fountain'
  | 'cyber_glitch_byte'
  | 'cyber_glitch_mantis'
  | 'cyber_glitch_null'
  | 'parked_delorean'
  | 'ramen_foodtruck'
  | 'subway_entrance'
  | 'cyber_konbini'
  | 'toadstool_cluster'
  | 'mossy_boulder'
  | 'hollow_log'
  | 'museum_door'
  | 'jungle_fern'
  | 'city_parking_bay'
  | 'beach_parking_bay'
  | 'sunset_arch'
  | 'dive_sign'
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
const SECONDARY_ROADS_Y = [8, 35, 65, 86];

export function isRoad(gx: number, gy: number): boolean {
  if (gy < 0 || gy >= 88 || gx < 0 || gx > 99) return false;
  // Grand Plaza (36..64, 36..64) is an exclusive pedestrian zone with no vehicle roads
  if (gx >= 36 && gx <= 64 && gy >= 36 && gy <= 64) return false;
  return (
    MAJOR_ROADS_X.includes(gx) ||
    MAJOR_ROADS_Y.includes(gy) ||
    SECONDARY_ROADS_X.includes(gx) ||
    SECONDARY_ROADS_Y.includes(gy)
  );
}

export function isSidewalk(gx: number, gy: number): boolean {
  if (gy < 0 || gy >= 88 || gx < 0 || gx > 99) return false;
  if (gx >= 36 && gx <= 64 && gy >= 36 && gy <= 64) return false;
  if (isRoad(gx, gy)) return false;
  for (const rx of [...MAJOR_ROADS_X, ...SECONDARY_ROADS_X]) {
    if (Math.abs(gx - rx) === 1) return true;
  }
  for (const ry of [...MAJOR_ROADS_Y, ...SECONDARY_ROADS_Y]) {
    if (Math.abs(gy - ry) === 1) return true;
  }
  return false;
}

/**
 * Checks if a tile coordinate is a water surface (pond, ocean deep, ocean surf, or creeks).
 */
export function isWaterTile(gx: number, gy: number): boolean {
  const tile = getCityTileType(gx, gy);
  return (
    tile === 'water_pond' ||
    tile === 'ocean_deep' ||
    tile === 'ocean_surf' ||
    tile === 'jungle_creek' ||
    tile === 'forest_creek'
  );
}

/**
 * Checks if a tile is a safe, realistic pedestrian surface for citizens to occupy.
 * Strictly forbids vehicle roads, asphalt lanes, crosswalks, water ponds/oceans, railway tracks, and mountain crags.
 */
export function isSafeCitizenTile(gx: number, gy: number): boolean {
  // Wilderness bounds check
  if (gx < 0 || gx >= 100 || gy < 0 || gy >= 100) {
    if (gx >= -26 && gx < 0 && gy >= 0 && gy <= 101) {
      const tile = getCityTileType(gx, gy);
      return tile !== 'jungle_creek' && tile !== 'ocean_deep' && tile !== 'ocean_surf';
    }
    if (gx >= 100 && gx <= 126 && gy >= 0 && gy <= 101) {
      const tile = getCityTileType(gx, gy);
      return tile !== 'forest_creek' && tile !== 'ocean_deep' && tile !== 'ocean_surf';
    }
    if (gy >= 100 && gy <= 107 && gx >= 0 && gx < 100) {
      return true; // Boardwalk (100-101) & beach dry (102-107)
    }
    return false;
  }

  // Strictly NO vehicle roads or crosswalks for citizen stationary activities
  if (isRoad(gx, gy)) {
    return false;
  }

  // Strictly NO water surfaces
  if (isWaterTile(gx, gy)) {
    return false;
  }

  const tile = getCityTileType(gx, gy);
  if (
    tile === 'railway_ballast' ||
    tile === 'mountain_rock' ||
    tile === 'mountain_snow' ||
    tile === 'road_asphalt' ||
    tile === 'road_v_stripe' ||
    tile === 'road_h_stripe' ||
    tile === 'crosswalk'
  ) {
    return false;
  }

  return true;
}

/**
 * Finds the nearest safe pedestrian tile to a given grid origin.
 * If (originGx, originGy) is on a road or in water, expands outward to the closest dry sidewalk, plaza, or park grass.
 */
export function getSafeCitizenCoords(originGx: number, originGy: number): { gx: number; gy: number } {
  if (isSafeCitizenTile(originGx, originGy)) {
    return { gx: originGx, gy: originGy };
  }

  for (let r = 1; r <= 15; r++) {
    const candidates: { gx: number; gy: number; d2: number }[] = [];
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r) {
          const candGx = originGx + dx;
          const candGy = originGy + dy;
          if (isSafeCitizenTile(candGx, candGy)) {
            candidates.push({ gx: candGx, gy: candGy, d2: dx * dx + dy * dy });
          }
        }
      }
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.d2 - b.d2);
      return { gx: candidates[0].gx, gy: candidates[0].gy };
    }
  }

  return { gx: 50, gy: 50 }; // Safe fallback to Grand Central Plaza
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
  // External surroundings — beach/ocean now outside city grid (>=100)
  if (gy <= -4) return 'mountains';
  if (gy <= -2) return 'railway';
  if (gx < 0 || gx >= 100) return 'ocean';
  if (gy >= 110) return 'ocean';
  if (gy >= 108) return 'beach'; // surf edge
  if (gy >= 102) return 'beach';
  if (gy >= 100) return 'boardwalk';

  // Internal City (0..99, 0..87)
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
  // Hard crop beyond jungle flanks
  if (gx < -24 || gx >= 125) return 'void';

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

  // ── 2. Southern Coast & Beach (gy >= 100, outside city) ─────────────
  if (gy === 100 || gy === 101) {
    return 'boardwalk';
  }
  if (gy >= 102 && gy <= 107) {
    return 'beach_sand';
  }
  if (gy === 108 || gy === 109) {
    return 'ocean_surf';
  }
  if (gy >= 110) {
    return 'ocean_deep';
  }

  // ── 3. External East / West Wilderness Flanks & Oceans ───────────────────
  // Western Emerald Jungle (gx: -24..-1 — compact cozy jungle buffer, now to boardwalk line 100)
  if (gx >= -24 && gx < 0) {
    if (gy >= 100) return 'void';
    if (gy >= -2 && gy <= 99) {
      // Winding tropical jungle creek
      const creekDist = Math.abs(Math.sin(gy * 0.12) * 4.0 - (gx + 12));
      if (creekDist < 1.4) return 'jungle_creek';
      const r = spatialHash(gx, gy, 88);
      return r > 0.40 ? 'jungle_dense' : 'jungle_grass';
    }
  }

  // Eastern Emerald Jungle Wilderness (gx: 100..124 — compact cozy jungle buffer, to boardwalk)
  if (gx >= 100 && gx <= 124) {
    if (gy >= 100) return 'void';
    if (gy >= -2 && gy <= 99) {
      // Winding tropical jungle creek
      const creekDist = Math.abs(Math.cos(gy * 0.11) * 4.0 - (gx - 112));
      if (creekDist < 1.4) return 'jungle_creek';
      const r = spatialHash(gx, gy, 99);
      return r > 0.40 ? 'jungle_dense' : 'jungle_grass';
    }
  }

  // Void beyond the compact wilderness bounds (no rendering)
  if (gx < 0 || gx >= 100) {
    return 'void';
  }

  // ── 4. Pure Spot World City (0..99, 0..99) ───────────────────────────────
  const district = getDistrict(gx, gy);

  // Grand Plaza is an exclusive pedestrian zone — polished granite throughout, no road stripes
  if (district === 'grand_plaza') {
    return 'plaza_grand';
  }

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
  switch (district) {
    case 'grand_plaza': {
      const isAlt = (gx + gy) % 2 === 0;
      return isAlt ? 'plaza_grand' : 'plaza_grand';
    }
    case 'promenade': {
      return 'plaza_terracotta';
    }
    case 'zen_garden': {
      return 'plaza_zen';
    }
    case 'central_park': {
      // Distance from lake center (72, 25) with squashed Y
      const dLake = Math.hypot(gx - 72, (gy - 25) * 1.3);
      if (dLake <= 7.5) {
        return 'water_pond';
      }
      return 'park_grass';
    }
    default: {
      return 'sidewalk';
    }
  }
}

// ---------------------------------------------------------------------------
// Prop & Landmark Generator
// ---------------------------------------------------------------------------

export function getCityProp(gx: number, gy: number): CityProp | null {
  if (gx < -24 || gx >= 125) return null;
  const wx = gx * TILE_WIDTH + TILE_WIDTH / 2;
  const wy = gy * TILE_HEIGHT + TILE_HEIGHT / 2;

  // ── 1. External Northern Mountain Landscape (gy <= -4) ────────────────────
  if (gy <= -4 && gy >= -16) {
    const r = spatialHash(gx, gy, 77);
    if (r > 0.82) {
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

  // ── 2. Southern Boardwalk & Beach Props (shifted to 100+) ──────────────
  // Scenic Beach Parking Slot overlooking the boardwalk & ocean surf (gx: 50, gy: 98)
  if (gx === 50 && gy === 98) {
    return {
      gx, gy, type: 'beach_parking_bay', wx, wy,
      hasLight: true, lightColor: 'rgba(56, 189, 248, 0.45)', lightRadius: 100,
    };
  }

  // Boardwalk lamps along the timber boardwalk (100,101)
  if ((gy === 100 || gy === 101) && (gx % 8 === 0)) {
    return {
      gx, gy, type: 'boardwalk_lamp', wx, wy,
      hasLight: true, lightColor: 'rgba(251, 191, 36, 0.40)', lightRadius: 85,
    };
  }

  // ── 2a. Art Experience Triggers (art.fazleyrabbi.xyz fullscreen embeds) ──
  // Placed before random beach scatter so the trigger tiles always win.
  for (const exp of ART_EXPERIENCES) {
    if (gx === exp.gx && gy === exp.gy) {
      return {
        gx,
        gy,
        type: exp.propType,
        wx,
        wy,
        hasLight: !exp.underwater,
        lightColor: !exp.underwater ? 'rgba(251, 191, 36, 0.5)' : undefined,
        lightRadius: !exp.underwater ? 120 : undefined,
      };
    }
  }

  // Beach Bonfires at scenic beach gathering spots (gy 105)
  if (gy === 105 && (gx === 50 || gx === 14 || gx === 86 || gx === -12 || gx === 112)) {
    return {
      gx, gy, type: 'beach_bonfire', wx, wy,
      hasLight: true, lightColor: 'rgba(249, 115, 22, 0.65)', lightRadius: 130,
    };
  }

  // Colorful Beach Umbrellas & Loungers along the dry sand (gy: 103)
  if (gy === 103) {
    if (gx % 12 === 2) {
      return { gx, gy, type: 'beach_umbrella', wx, wy, hasLight: false };
    }
    if (gx % 12 === 3) {
      return { gx, gy, type: 'beach_lounger', wx, wy, hasLight: false };
    }
  }

  // Starfish resting on the wet sand near the water surf (gy === 107)
  if (gy === 107) {
    const starR = spatialHash(gx, gy, 311);
    if (starR > 0.85) {
      return { gx, gy, type: 'starfish', wx, wy, hasLight: false };
    }
  }

  // 🌴 Tropical Coconut Palm Trees dotted along the entire sandy beach (gy: 102..106)
  if (gy >= 102 && gy <= 106) {
    const palmR = spatialHash(gx, gy, 709);
    // Placed in organic clusters along the beach coastline
    if (palmR > 0.68) {
      return { gx, gy, type: 'palm_tree', wx, wy, hasLight: false };
    }
  }

  // ── 2b. Western Emerald Jungle Wilderness Props (gx: -24..-1) ──────────────
  if (gx >= -24 && gx < 0 && gy >= 0 && gy <= 99) {
    const tile = getCityTileType(gx, gy);
    if (tile === 'jungle_creek') return null;

    const r = spatialHash(gx, gy, 142);
    if (r > 0.58) {
      const v = spatialHash(gx, gy, 203);
      if (v > 0.65) {
        return { gx, gy, type: 'jungle_tree', wx, wy, hasLight: false };
      } else if (v > 0.44) {
        return { gx, gy, type: 'palm_tree', wx, wy, hasLight: false };
      } else if (v > 0.28) {
        return { gx, gy, type: 'jungle_fern', wx, wy, hasLight: false };
      } else if (v > 0.16) {
        return { gx, gy, type: 'flower_bed', wx, wy, hasLight: false };
      } else if (v > 0.08) {
        return { gx, gy, type: 'mossy_boulder', wx, wy, hasLight: false };
      } else if (v > 0.03) {
        return { gx, gy, type: 'toadstool_cluster', wx, wy, hasLight: false };
      } else {
        return { gx, gy, type: 'hollow_log', wx, wy, hasLight: false };
      }
    }
    return null;
  }

  // ── 2c. Eastern Emerald Jungle Wilderness Props (gx: 100..124) ────────────
  if (gx >= 100 && gx <= 124 && gy >= 0 && gy <= 99) {
    const tile = getCityTileType(gx, gy);
    if (tile === 'jungle_creek') return null;

    const r = spatialHash(gx, gy, 177);
    if (r > 0.58) {
      const v = spatialHash(gx, gy, 299);
      if (v > 0.65) {
        return { gx, gy, type: 'jungle_tree', wx, wy, hasLight: false };
      } else if (v > 0.44) {
        return { gx, gy, type: 'palm_tree', wx, wy, hasLight: false };
      } else if (v > 0.28) {
        return { gx, gy, type: 'jungle_fern', wx, wy, hasLight: false };
      } else if (v > 0.16) {
        return { gx, gy, type: 'flower_bed', wx, wy, hasLight: false };
      } else if (v > 0.08) {
        return { gx, gy, type: 'mossy_boulder', wx, wy, hasLight: false };
      } else if (v > 0.03) {
        return { gx, gy, type: 'toadstool_cluster', wx, wy, hasLight: false };
      } else {
        return { gx, gy, type: 'hollow_log', wx, wy, hasLight: false };
      }
    }
    return null;
  }

  if (gy >= 100 || gx < 0 || gx >= 100) {
    return null;
  }

  // ── Strict World Rules: No items, monuments, or furniture on roads ───────
  if (isRoad(gx, gy)) {
    return null;
  }

  // ── Strict World Rules: No items on water (except mystic duck and sunken sub) ─
  const cityTile = getCityTileType(gx, gy);
  const isWater =
    cityTile === 'water_pond' ||
    cityTile === 'ocean_deep' ||
    cityTile === 'ocean_surf' ||
    cityTile === 'jungle_creek' ||
    cityTile === 'forest_creek';

  if (isWater && !(gx === 72 && gy === 22) && !(gx === 14 && gy === 78)) {
    return null;
  }

  // ── 3. Internal City World Secrets & Lore Landmarks (0..99, 0..99) ───────
  // Colossal Ancient Oak Tree landmark in Central Park Glade
  if (gx === 66 && gy === 12) {
    return {
      gx, gy, type: 'great_oak', wx, wy,
      hasLight: true, lightColor: 'rgba(251, 191, 36, 0.45)', lightRadius: 130,
    };
  }

  // Sacred Millennium Zen Bonsai Tree on carved granite pedestal in Zen Gardens
  if (gx === 70 && gy === 74) {
    return {
      gx, gy, type: 'master_bonsai', wx, wy,
      hasLight: true, lightColor: 'rgba(52, 211, 153, 0.40)', lightRadius: 95,
    };
  }

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

  if (gx === 4 && gy === 106) {
    return {
      gx, gy, type: 'cyber_lighthouse', wx, wy,
      hasLight: true, lightColor: 'rgba(0, 240, 255, 0.75)', lightRadius: 140,
    };
  }

  if (gx === 48 && gy === 4) {
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

  if (gx === 60 && gy === 38) {
    return {
      gx, gy, type: 'museum_door', wx, wy,
      hasLight: true, lightColor: 'rgba(251, 191, 36, 0.50)', lightRadius: 110,
    };
  }

  if (gx === 14 && gy === 78) {
    return {
      gx, gy, type: 'sunken_sub', wx, wy,
      hasLight: true, lightColor: 'rgba(56, 189, 248, 0.5)', lightRadius: 90,
    };
  }

  if (gx === 50 && gy === 46) {
    return {
      gx, gy, type: 'city_hall', wx, wy,
      hasLight: true, lightColor: 'rgba(245, 158, 11, 0.65)', lightRadius: 130,
    };
  }

  if (gx === 19 && gy === 68) {
    return {
      gx, gy, type: 'cafe_storefront', wx, wy,
      hasLight: true, lightColor: 'rgba(251, 191, 36, 0.55)', lightRadius: 100,
    };
  }

  if (gx === 48 && gy === 0) {
    return {
      gx, gy, type: 'grand_station', wx, wy,
      hasLight: true, lightColor: 'rgba(56, 189, 248, 0.65)', lightRadius: 120,
    };
  }

  if (gx === 50 && gy === 50) {
    return {
      gx, gy, type: 'wishing_fountain', wx, wy,
      hasLight: true, lightColor: 'rgba(56, 189, 248, 0.55)', lightRadius: 110,
    };
  }

  // ── 3b. Street Architectural Landmarks & Parked Vehicles ─────────────────
  // City Central EV Parking Bay & Charging Stalls (Downtown Boulevard gx: 22, gy: 32)
  if (gx === 22 && gy === 32) {
    return {
      gx, gy, type: 'city_parking_bay', wx, wy,
      hasLight: true, lightColor: 'rgba(6, 182, 212, 0.55)', lightRadius: 105,
    };
  }

  // Parked DeLorean outside Retro Arcade
  if (gx === 84 && gy === 22) {
    return {
      gx, gy, type: 'parked_delorean', wx, wy,
      hasLight: true, lightColor: 'rgba(6, 182, 212, 0.45)', lightRadius: 75,
    };
  }

  // Cyber Ramen Food Truck / Coffee Rover in Grand Central Plaza
  if (gx === 48 && gy === 48) {
    return {
      gx, gy, type: 'ramen_foodtruck', wx, wy,
      hasLight: true, lightColor: 'rgba(245, 158, 11, 0.65)', lightRadius: 105,
    };
  }

  // Metro Subway Entrances at key transit hubs (placed on pedestrian sidewalks)
  if ((gx === 19 && gy === 19) || (gx === 79 && gy === 79)) {
    return {
      gx, gy, type: 'subway_entrance', wx, wy,
      hasLight: true, lightColor: 'rgba(56, 189, 248, 0.55)', lightRadius: 95,
    };
  }

  // Cyber Bodega / 24-7 Konbini storefront on Downtown sidewalk
  if (gx === 34 && gy === 22) {
    return {
      gx, gy, type: 'cyber_konbini', wx, wy,
      hasLight: true, lightColor: 'rgba(251, 191, 36, 0.60)', lightRadius: 115,
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
    if (tile === 'park_grass') {
      if (r > 0.77) {
        // Distance to lake center (72, 25)
        const dLake = Math.hypot(gx - 72, (gy - 25) * 1.3);
        const treeVariant = spatialHash(gx, gy, 88);

        // Near lake shore: Graceful Weeping Willows!
        if (dLake >= 5.5 && dLake <= 9.0 && treeVariant > 0.40) {
          return { gx, gy, type: 'willow_tree', wx, wy, hasLight: false };
        }

        // Natural woodland diversity across Central Park (Inspired by stylized pixel references):
        if (treeVariant > 0.88 && r > 0.86) {
          return { gx, gy, type: 'great_oak', wx, wy, hasLight: true, lightColor: 'rgba(251, 191, 36, 0.40)', lightRadius: 110 };
        } else if (treeVariant > 0.82) {
          return { gx, gy, type: 'birch_tree', wx, wy, hasLight: false }; // Golden Birch / Ginkgo (Image 2)
        } else if (treeVariant > 0.65) {
          return { gx, gy, type: 'cherry_tree', wx, wy, hasLight: false }; // Flowering Sakura (Image 2)
        } else if (treeVariant > 0.48) {
          return { gx, gy, type: 'fruit_tree', wx, wy, hasLight: false }; // Ruby Apple/Berry Orchard Tree (Image 3)
        } else if (treeVariant > 0.32) {
          return { gx, gy, type: 'pine_tree', wx, wy, hasLight: false }; // Tall Conifer Pine (Image 3)
        } else {
          return { gx, gy, type: 'park_tree', wx, wy, hasLight: false }; // Majestic Fluffy Oak (Image 3)
        }
      }
      if (r > 0.72) {
        return { gx, gy, type: 'bench', wx, wy, hasLight: false };
      }
      if (r > 0.66) {
        return { gx, gy, type: 'flower_bed', wx, wy, hasLight: false };
      }
      if (r > 0.61) {
        return { gx, gy, type: 'toadstool_cluster', wx, wy, hasLight: false }; // Red-and-white mushrooms (Image 3)
      }
      if (r > 0.58) {
        return { gx, gy, type: 'mossy_boulder', wx, wy, hasLight: false }; // Cracked granite stone (Image 3)
      }
    }
  }

  if (district === 'zen_garden') {
    if (r > 0.80) {
      const zt = spatialHash(gx, gy, 77);
      if (zt > 0.72) {
        return {
          gx, gy, type: 'master_bonsai', wx, wy,
          hasLight: true, lightColor: 'rgba(52, 211, 153, 0.35)', lightRadius: 85,
        };
      }
      return { gx, gy, type: zt > 0.35 ? 'cherry_tree' : 'pine_tree', wx, wy, hasLight: false };
    }
    if (r > 0.70) {
      return {
        gx, gy, type: 'stone_lantern', wx, wy,
        hasLight: true, lightColor: 'rgba(251, 191, 36, 0.30)', lightRadius: 70,
      };
    }
  }

  if (district === 'promenade') {
    if (r > 0.84) {
      return { gx, gy, type: 'cafe_table', wx, wy, hasLight: false };
    }
    if (r > 0.74) {
      return { gx, gy, type: 'bench', wx, wy, hasLight: false };
    }
    if (r > 0.66) {
      return { gx, gy, type: 'flower_bed', wx, wy, hasLight: false };
    }
    if (r > 0.58) {
      return { gx, gy, type: 'trash_can', wx, wy, hasLight: false };
    }
  }

  if (district === 'downtown') {
    // Lively, gently-cluttered street furniture so open sidewalks don't read empty.
    if (r > 0.94) {
      return { gx, gy, type: 'tree_planter', wx, wy, hasLight: false };
    }
    if (r > 0.88) {
      return { gx, gy, type: 'flower_bed', wx, wy, hasLight: false };
    }
    if (r > 0.82) {
      return { gx, gy, type: 'bench', wx, wy, hasLight: false };
    }
    if (r > 0.77) {
      return { gx, gy, type: 'fire_hydrant', wx, wy, hasLight: false };
    }
    if (r > 0.73) {
      return { gx, gy, type: 'trash_can', wx, wy, hasLight: false };
    }
  }

  return null;
}
