import type { Coordinates } from '@spot/shared';

export interface CameraOptions {
  minZoom?: number;
  maxZoom?: number;
  zoomSpeed?: number;
  damping?: number;
}

export class Camera2D {
  // Center position of camera in world pixel coordinates
  x: number = 0;
  y: number = 0;

  // Zoom level (1 = 100%)
  zoom: number = 1;

  // Target values for smooth interpolation
  targetX: number = 0;
  targetY: number = 0;
  targetZoom: number = 1;

  readonly minZoom: number;
  readonly maxZoom: number;
  readonly zoomSpeed: number;
  readonly damping: number;

  // Viewport dimensions
  viewportWidth: number = 800;
  viewportHeight: number = 600;

  constructor(options: CameraOptions = {}) {
    this.minZoom = options.minZoom ?? 0.25;
    this.maxZoom = options.maxZoom ?? 3.5;
    this.zoomSpeed = options.zoomSpeed ?? 0.0015;
    this.damping = options.damping ?? 0.2;
  }

  setViewport(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  centerOn(worldX: number, worldY: number, zoom?: number, immediate = false): void {
    this.targetX = worldX;
    this.targetY = worldY;
    if (zoom !== undefined) {
      this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    }
    if (immediate) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.zoom = this.targetZoom;
    }
  }

  panBy(screenDeltaX: number, screenDeltaY: number): void {
    // Screen delta divided by current zoom gives world delta
    const worldDeltaX = screenDeltaX / this.zoom;
    const worldDeltaY = screenDeltaY / this.zoom;
    this.targetX -= worldDeltaX;
    this.targetY -= worldDeltaY;
    this.x = this.targetX;
    this.y = this.targetY;
  }

  zoomAt(screenX: number, screenY: number, delta: number): void {
    // Calculate world point before zoom
    const worldBefore = this.screenToWorld(screenX, screenY);

    // Apply exponential zoom delta
    const zoomFactor = Math.exp(-delta * this.zoomSpeed);
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.targetZoom * zoomFactor));

    this.targetZoom = newZoom;
    this.zoom = newZoom;

    // Adjust camera position so that the world point remains under screen cursor
    const newWorldX = worldBefore.x - (screenX - this.viewportWidth / 2) / newZoom;
    const newWorldY = worldBefore.y - (screenY - this.viewportHeight / 2) / newZoom;

    this.targetX = newWorldX;
    this.targetY = newWorldY;
    this.x = newWorldX;
    this.y = newWorldY;
  }

  update(): boolean {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dz = this.targetZoom - this.zoom;

    const moving = Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01 || Math.abs(dz) > 0.001;

    if (moving) {
      this.x += dx * this.damping;
      this.y += dy * this.damping;
      this.zoom += dz * this.damping;
    }

    return moving;
  }

  screenToWorld(screenX: number, screenY: number): Coordinates {
    return {
      x: this.x + (screenX - this.viewportWidth / 2) / this.zoom,
      y: this.y + (screenY - this.viewportHeight / 2) / this.zoom,
    };
  }

  worldToScreen(worldX: number, worldY: number): Coordinates {
    return {
      x: (worldX - this.x) * this.zoom + this.viewportWidth / 2,
      y: (worldY - this.y) * this.zoom + this.viewportHeight / 2,
    };
  }

  getViewportBounds(): { left: number; top: number; right: number; bottom: number } {
    const halfW = (this.viewportWidth / 2) / this.zoom;
    const halfH = (this.viewportHeight / 2) / this.zoom;
    return {
      left: this.x - halfW,
      top: this.y - halfH,
      right: this.x + halfW,
      bottom: this.y + halfH,
    };
  }
}
