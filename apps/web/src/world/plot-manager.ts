/**
 * PlotManager — manages 5x5 square tile plots for each citizen.
 *
 * Each claimed spot gets a 5x5 plot centered at (spot.x, spot.y).
 * Grid radius is 2 tiles (center ± 2, resulting in 5x5 = 25 tiles).
 */

import {
  TILE_WIDTH,
  TILE_HEIGHT,
  PLOT_RADIUS,
  PLOT_SIZE,
  WORLD_COLS,
  WORLD_ROWS,
} from '@spot/world';
import type { OccupiedSpotSummary } from '@spot/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Plot {
  /** Center tile coordinate of the plot (the claimed spot) */
  centerX: number;
  centerY: number;
  /** Owner citizen information */
  owner: OccupiedSpotSummary;
  /** 5x5 tile bounds (inclusive) */
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  /** World space bounding box in pixels */
  worldMinX: number;
  worldMaxX: number;
  worldMinY: number;
  worldMaxY: number;
  worldCenterX: number;
  worldCenterY: number;
}

export class PlotManager {
  private plots = new Map<string, Plot>();
  private occupiedMap = new Map<string, OccupiedSpotSummary>();

  /** Set or update plots from world snapshot occupied list */
  update(spots: OccupiedSpotSummary[]): void {
    this.plots.clear();
    this.occupiedMap.clear();

    for (const spot of spots) {
      const key = `${spot.x},${spot.y}`;
      this.occupiedMap.set(key, spot);

      const minX = Math.max(0, spot.x - PLOT_RADIUS);
      const maxX = Math.min(WORLD_COLS - 1, spot.x + PLOT_RADIUS);
      const minY = Math.max(0, spot.y - PLOT_RADIUS);
      const maxY = Math.min(WORLD_ROWS - 1, spot.y + PLOT_RADIUS);

      const worldMinX = minX * TILE_WIDTH;
      const worldMaxX = (maxX + 1) * TILE_WIDTH;
      const worldMinY = minY * TILE_HEIGHT;
      const worldMaxY = (maxY + 1) * TILE_HEIGHT;

      const worldCenterX = spot.x * TILE_WIDTH + TILE_WIDTH / 2;
      const worldCenterY = spot.y * TILE_HEIGHT + TILE_HEIGHT / 2;

      this.plots.set(key, {
        centerX: spot.x,
        centerY: spot.y,
        owner: spot,
        minX,
        maxX,
        minY,
        maxY,
        worldMinX,
        worldMaxX,
        worldMinY,
        worldMaxY,
        worldCenterX,
        worldCenterY,
      });
    }
  }

  /**
   * Find the plot that covers the given grid tile (gx, gy).
   */
  getPlotAt(gx: number, gy: number): Plot | null {
    for (const plot of this.plots.values()) {
      if (gx >= plot.minX && gx <= plot.maxX && gy >= plot.minY && gy <= plot.maxY) {
        return plot;
      }
    }
    return null;
  }

  /**
   * Find the plot for a specific citizen by their citizenId.
   */
  getOwnerPlot(citizenId: string): Plot | null {
    for (const plot of this.plots.values()) {
      if (plot.owner.citizenId === citizenId) {
        return plot;
      }
    }
    return null;
  }

  /**
   * Find plot by exact center coordinates.
   */
  getPlotByCenter(centerX: number, centerY: number): Plot | null {
    return this.plots.get(`${centerX},${centerY}`) ?? null;
  }

  /**
   * Check if a grid tile (gx, gy) is on the perimeter / border of any 5x5 plot.
   */
  isPlotBorder(gx: number, gy: number): { isBorder: boolean; plot: Plot | null } {
    for (const plot of this.plots.values()) {
      if (gx >= plot.minX && gx <= plot.maxX && gy >= plot.minY && gy <= plot.maxY) {
        const isBorder = (gx === plot.minX || gx === plot.maxX || gy === plot.minY || gy === plot.maxY);
        return { isBorder, plot };
      }
    }
    return { isBorder: false, plot: null };
  }

  /**
   * Return all plots list.
   */
  getAllPlots(): Plot[] {
    return Array.from(this.plots.values());
  }

  /**
   * Total number of claimed plots.
   */
  get count(): number {
    return this.plots.size;
  }
}
