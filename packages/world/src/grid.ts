import type { Coordinates, WorldConfig } from '@spot/shared';

export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  width: 100,
  height: 100,
  spotSize: 32, // pixels per spot cell
  spotGap: 4,   // gap between spots
};

export class GridEngine {
  readonly config: WorldConfig;
  readonly cellSize: number;
  readonly totalWidth: number;
  readonly totalHeight: number;

  constructor(config: WorldConfig = DEFAULT_WORLD_CONFIG) {
    this.config = config;
    this.cellSize = config.spotSize + config.spotGap;
    this.totalWidth = config.width * this.cellSize - config.spotGap;
    this.totalHeight = config.height * this.cellSize - config.spotGap;
  }

  /**
   * Format grid coordinates into standard Spot ID e.g. "42,17"
   */
  getSpotId(x: number, y: number): string {
    return `${x},${y}`;
  }

  /**
   * Parse Spot ID into grid coordinates
   */
  parseSpotId(id: string): Coordinates | null {
    const parts = id.split(',');
    if (parts.length !== 2) return null;
    const x = parseInt(parts[0], 10);
    const y = parseInt(parts[1], 10);
    if (isNaN(x) || isNaN(y)) return null;
    return { x, y };
  }

  /**
   * Check if a grid coordinate is within valid world bounds
   */
  isValidCoordinate(x: number, y: number): boolean {
    return x >= 0 && x < this.config.width && y >= 0 && y < this.config.height;
  }

  /**
   * Convert grid coordinate (0..99) to world space top-left pixel position
   */
  gridToWorld(x: number, y: number): Coordinates {
    return {
      x: x * this.cellSize,
      y: y * this.cellSize,
    };
  }

  /**
   * Convert world space pixel position to grid coordinate
   */
  worldToGrid(worldX: number, worldY: number): Coordinates | null {
    if (worldX < 0 || worldY < 0 || worldX >= this.totalWidth || worldY >= this.totalHeight) {
      return null;
    }
    const gx = Math.floor(worldX / this.cellSize);
    const gy = Math.floor(worldY / this.cellSize);

    // Check if within the spot area (not in the gap)
    const localX = worldX % this.cellSize;
    const localY = worldY % this.cellSize;

    if (localX >= this.config.spotSize || localY >= this.config.spotSize) {
      // In the gap between spots, still highlight the closest cell if valid
      if (this.isValidCoordinate(gx, gy)) return { x: gx, y: gy };
      return null;
    }

    if (this.isValidCoordinate(gx, gy)) {
      return { x: gx, y: gy };
    }
    return null;
  }

  /**
   * Get visible grid coordinate range based on world camera viewport
   */
  getVisibleBounds(
    viewportLeft: number,
    viewportTop: number,
    viewportRight: number,
    viewportBottom: number,
    margin = 2
  ): { minX: number; maxX: number; minY: number; maxY: number } {
    const minX = Math.max(0, Math.floor(viewportLeft / this.cellSize) - margin);
    const maxX = Math.min(this.config.width - 1, Math.ceil(viewportRight / this.cellSize) + margin);
    const minY = Math.max(0, Math.floor(viewportTop / this.cellSize) - margin);
    const maxY = Math.min(this.config.height - 1, Math.ceil(viewportBottom / this.cellSize) + margin);

    return { minX, maxX, minY, maxY };
  }
}
