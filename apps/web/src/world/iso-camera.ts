/**
 * IsoCamera — Isometric world camera with smooth pan / zoom.
 *
 * Extends the same lerp / damping pattern used by Camera2D but works in
 * isometric world space.  All transforms are:
 *
 *   screenX = (worldX - cam.x) * cam.zoom + viewportW / 2
 *   screenY = (worldY - cam.y) * cam.zoom + viewportH / 2
 *
 * The isometric grid is centred around origin (0, 0) in world space.
 */

import type { Coordinates } from '@spot/shared';

export interface IsoCameraOptions {
  minZoom?: number;
  maxZoom?: number;
  zoomSpeed?: number;
  /** Lerp factor applied each frame (0 < damping < 1, lower = smoother) */
  damping?: number;
}

export class IsoCamera {
  // Current camera centre in world space
  x = 0;
  y = 0;
  zoom = 1;

  // Lerp targets
  targetX = 0;
  targetY = 0;
  targetZoom = 1;

  // Viewport
  viewportWidth = 800;
  viewportHeight = 600;

  readonly minZoom: number;
  readonly maxZoom: number;
  readonly zoomSpeed: number;
  readonly damping: number;

  constructor(options: IsoCameraOptions = {}) {
    this.minZoom = options.minZoom ?? 0.2;
    this.maxZoom = options.maxZoom ?? 2.5;
    this.zoomSpeed = options.zoomSpeed ?? 0.0012;
    this.damping = options.damping ?? 0.15;
  }

  setViewport(w: number, h: number): void {
    this.viewportWidth = w;
    this.viewportHeight = h;
  }

  /** Smooth fly-to a world coordinate (optionally with a zoom level). */
  centerOn(wx: number, wy: number, zoom?: number, immediate = false): void {
    this.targetX = wx;
    this.targetY = wy;
    if (zoom !== undefined) {
      this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    }
    if (immediate) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.zoom = this.targetZoom;
    }
  }

  /** Instant pan by screen-space deltas (called from pointer drag). */
  panBy(screenDx: number, screenDy: number): void {
    const dx = screenDx / this.zoom;
    const dy = screenDy / this.zoom;
    this.targetX -= dx;
    this.targetY -= dy;
    // Snap immediately for drag responsiveness
    this.x = this.targetX;
    this.y = this.targetY;
  }

  /** Zoom keeping the screen point (sx, sy) anchored in world space. */
  zoomAt(sx: number, sy: number, delta: number): void {
    const worldBefore = this.screenToWorld(sx, sy);

    const factor = Math.exp(-delta * this.zoomSpeed);
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.targetZoom * factor));
    this.targetZoom = newZoom;
    this.zoom = newZoom;

    // Re-anchor: adjust centre so the hovered world point stays under cursor
    const newX = worldBefore.x - (sx - this.viewportWidth / 2) / newZoom;
    const newY = worldBefore.y - (sy - this.viewportHeight / 2) / newZoom;
    this.targetX = newX;
    this.targetY = newY;
    this.x = newX;
    this.y = newY;
  }

  /**
   * Advance the lerp by one frame.
   * Returns true while the camera is still moving (caller can skip redraws).
   */
  update(): boolean {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dz = this.targetZoom - this.zoom;

    const moving = Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1 || Math.abs(dz) > 0.001;
    if (moving) {
      this.x += dx * this.damping;
      this.y += dy * this.damping;
      this.zoom += dz * this.damping;
    }
    return moving;
  }

  screenToWorld(sx: number, sy: number): Coordinates {
    return {
      x: this.x + (sx - this.viewportWidth / 2) / this.zoom,
      y: this.y + (sy - this.viewportHeight / 2) / this.zoom,
    };
  }

  worldToScreen(wx: number, wy: number): Coordinates {
    return {
      x: (wx - this.x) * this.zoom + this.viewportWidth / 2,
      y: (wy - this.y) * this.zoom + this.viewportHeight / 2,
    };
  }

  getWorldBounds(): { left: number; top: number; right: number; bottom: number } {
    const hw = (this.viewportWidth / 2) / this.zoom;
    const hh = (this.viewportHeight / 2) / this.zoom;
    return {
      left: this.x - hw,
      top: this.y - hh,
      right: this.x + hw,
      bottom: this.y + hh,
    };
  }
}
