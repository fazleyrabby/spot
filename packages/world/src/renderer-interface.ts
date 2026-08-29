import type { Coordinates, OccupiedSpotSummary, WorldSnapshot } from '@spot/shared';

/**
 * Formal renderer interface decoupling the logical world state
 * from concrete 2D Canvas, WebGL, or future Three.js rendering engines.
 */
export interface WorldRenderer {
  /**
   * Update the internal world snapshot state
   */
  setSnapshot(snapshot: WorldSnapshot): void;

  /**
   * Center the viewport camera on specific world coordinates
   */
  centerOn(x: number, y: number, zoom?: number, immediate?: boolean): void;

  /**
   * Programmatically select or highlight a spot by grid coordinates
   */
  selectSpot(gx: number, gy: number): void;

  /**
   * Clear current spot selection
   */
  clearSelection(): void;

  /**
   * Start the rendering animation loop
   */
  start(): void;

  /**
   * Stop/pause the rendering animation loop
   */
  stop(): void;

  /**
   * Handle viewport resize
   */
  handleResize(): void;
}

export interface SpotClickEvent {
  x: number;
  y: number;
  occupied?: OccupiedSpotSummary;
}

export interface SpotHoverEvent {
  x: number;
  y: number;
  occupied?: OccupiedSpotSummary;
}
