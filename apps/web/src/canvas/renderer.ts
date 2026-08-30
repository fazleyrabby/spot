import { GridEngine, Camera2D } from '@spot/world';
import type { Coordinates, OccupiedSpotSummary, WorldSnapshot } from '@spot/shared';
import { getAvatar, drawAvatarOnCanvas, drawCustomAvatarOnCanvas, setOnAvatarImageLoaded } from './avatars.js';

export interface RendererEvents {
  onSpotClick?: (spot: { x: number; y: number; occupied?: OccupiedSpotSummary }) => void;
  onSpotHover?: (spot: { x: number; y: number; occupied?: OccupiedSpotSummary } | null) => void;
  onCameraChange?: (zoom: number, coords: Coordinates) => void;
}

export class WorldCanvasRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly grid: GridEngine;
  readonly camera: Camera2D;

  private snapshot: WorldSnapshot;
  private occupiedMap: Map<string, OccupiedSpotSummary> = new Map();

  // Interaction states
  hoveredCoord: Coordinates | null = null;
  selectedCoord: Coordinates | null = null;

  // Animation & Rendering loop
  private animationFrameId: number | null = null;
  private lastTime = 0;
  private pulsePhase = 0;
  private dpr = 1;
  private boundHandleResize: (() => void) | null = null;

  events: RendererEvents = {};

  constructor(canvas: HTMLCanvasElement, snapshot: WorldSnapshot, events: RendererEvents = {}) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not get 2D canvas context');
    this.ctx = context;

    this.snapshot = snapshot;
    this.events = events;
    this.grid = new GridEngine({
      width: snapshot.width,
      height: snapshot.height,
      spotSize: 36,
      spotGap: 6,
    });

    this.camera = new Camera2D({
      minZoom: 0.15,
      maxZoom: 3.5,
      zoomSpeed: 0.0015,
      damping: 0.18,
    });

    this.rebuildOccupiedMap();
    this.handleResize();
    this.boundHandleResize = () => this.handleResize();
    window.addEventListener('resize', this.boundHandleResize);

    // Initial center on founder spot (52, 60)
    const centerWorld = this.grid.gridToWorld(52, 60);
    this.camera.centerOn(centerWorld.x + 18, centerWorld.y + 18, 2.0, true);
    this.selectedCoord = { x: 52, y: 60 };
    setOnAvatarImageLoaded(() => this.render());
  }

  setSnapshot(snapshot: WorldSnapshot): void {
    this.snapshot = snapshot;
    this.rebuildOccupiedMap();
  }

  private rebuildOccupiedMap(): void {
    this.occupiedMap.clear();
    for (const item of this.snapshot.occupied) {
      this.occupiedMap.set(item.spotId, item);
    }
  }

  handleResize(): void {
    this.dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.floor(rect.width) || window.innerWidth || 1200;
    const height = Math.floor(rect.height) || window.innerHeight || 800;

    this.canvas.width = Math.floor(width * this.dpr);
    this.canvas.height = Math.floor(height * this.dpr);

    this.camera.setViewport(width, height);
  }

  start(): void {
    if (this.animationFrameId !== null) return;
    this.lastTime = performance.now();
    const loop = (currentTime: number) => {
      const delta = (currentTime - this.lastTime) / 1000;
      this.lastTime = currentTime;
      this.pulsePhase += delta * 3.5;

      this.update();
      this.render();

      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  destroy(): void {
    this.stop();
    if (this.boundHandleResize) {
      window.removeEventListener('resize', this.boundHandleResize);
      this.boundHandleResize = null;
    }
    setOnAvatarImageLoaded(() => {});
  }

  update(): void {
    const isCameraMoving = this.camera.update();
    if (isCameraMoving && this.events.onCameraChange) {
      const centerWorld = this.camera.screenToWorld(
        this.camera.viewportWidth / 2,
        this.camera.viewportHeight / 2
      );
      const gridCoords = this.grid.worldToGrid(centerWorld.x, centerWorld.y) || { x: 50, y: 50 };
      this.events.onCameraChange(this.camera.zoom, gridCoords);
    }
  }

  render(): void {
    const { ctx, canvas, dpr, camera, grid } = this;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Deep modern space background
    ctx.fillStyle = '#0c0e14';
    ctx.fillRect(0, 0, width, height);

    // Subtle background atmosphere
    this.renderAtmosphere(ctx, width, height);

    // World transform
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // World boundaries
    this.renderWorldBorder(ctx);
    this.renderDistrictBoundaries(ctx);

    // Get visible grid slice for frustum culling
    const bounds = camera.getViewportBounds();
    const visible = grid.getVisibleBounds(bounds.left, bounds.top, bounds.right, bounds.bottom, 2);

    const spotSize = grid.config.spotSize;

    // 1. Pass 1: Draw All Tiles & Avatars in visible bounds
    const labelsToRender: Array<{
      x: number;
      y: number;
      size: number;
      occupied: OccupiedSpotSummary;
      isHovered: boolean;
      isSelected: boolean;
    }> = [];
    const activeSpotsToRender: Array<{
      x: number;
      y: number;
      size: number;
      occupied: OccupiedSpotSummary;
      isHovered: boolean;
      isSelected: boolean;
    }> = [];

    for (let gx = visible.minX; gx <= visible.maxX; gx++) {
      for (let gy = visible.minY; gy <= visible.maxY; gy++) {
        const spotId = grid.getSpotId(gx, gy);
        const worldPos = grid.gridToWorld(gx, gy);
        const occupied = this.occupiedMap.get(spotId);

        const isHovered = this.hoveredCoord?.x === gx && this.hoveredCoord?.y === gy;
        const isSelected = this.selectedCoord?.x === gx && this.selectedCoord?.y === gy;

        if (occupied) {
          this.renderOccupiedSpot(ctx, worldPos.x, worldPos.y, spotSize, occupied, isHovered, isSelected);
          if (this.isPrimeSpot(gx, gy)) this.renderPrimeSpot(ctx, worldPos.x, worldPos.y, spotSize, isHovered || isSelected);
          if (this.camera.zoom > 1.2 || isHovered) {
            labelsToRender.push({ x: worldPos.x, y: worldPos.y, size: spotSize, occupied, isHovered, isSelected });
          }
          if (isHovered || isSelected) {
            activeSpotsToRender.push({ x: worldPos.x, y: worldPos.y, size: spotSize, occupied, isHovered, isSelected });
          }
        } else {
          this.renderEmptySpot(ctx, worldPos.x, worldPos.y, spotSize, isHovered, isSelected);
          if (this.isPrimeSpot(gx, gy)) this.renderPrimeSpot(ctx, worldPos.x, worldPos.y, spotSize, isHovered || isSelected);
        }
      }
    }

    // 2. Pass 2: Draw background labels above the tile/avatar pass.
    labelsToRender.sort((a, b) => Number(a.isHovered) - Number(b.isHovered));
    for (const item of labelsToRender.filter((item) => !item.isHovered && !item.isSelected)) {
      this.renderSpotLabel(ctx, item.x, item.y, item.size, item.occupied, false);
    }

    // 3. Foreground pass: keep the hovered/focused spot, including its avatar,
    // above neighboring labels and sprites. This matters when labels overlap
    // adjacent tiles in a dense part of the map.
    for (const item of activeSpotsToRender) {
      this.renderOccupiedSpot(ctx, item.x, item.y, item.size, item.occupied, item.isHovered, item.isSelected);
      const activeCoords = grid.worldToGrid(item.x, item.y);
      if (activeCoords && this.isPrimeSpot(activeCoords.x, activeCoords.y)) {
        this.renderPrimeSpot(ctx, item.x, item.y, item.size, true);
      }
      this.renderSpotLabel(ctx, item.x, item.y, item.size, item.occupied, item.isHovered);
    }

    // 4. Pass 4: Render Selection Cursor if active
    if (this.selectedCoord) {
      const pos = grid.gridToWorld(this.selectedCoord.x, this.selectedCoord.y);
      this.renderSelectedBeacon(ctx, pos.x, pos.y, spotSize);
    }

    ctx.restore();
    ctx.restore();
  }

  private renderAtmosphere(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const grad = ctx.createRadialGradient(width / 2, height / 2, 80, width / 2, height / 2, Math.max(width, height) * 0.85);
    grad.addColorStop(0, '#151824');
    grad.addColorStop(0.55, '#0d0f16');
    grad.addColorStop(1, '#07080c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Subtle ambient stars
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    const count = 40;
    for (let i = 0; i < count; i++) {
      const seedX = (i * 1973 + 37) % width;
      const seedY = (i * 3271 + 83) % height;
      const flicker = (Math.sin(this.pulsePhase + i) + 1) / 2;
      ctx.fillStyle = `rgba(245, 158, 11, ${0.05 + flicker * 0.15})`;
      ctx.fillRect(seedX, seedY, 1.5, 1.5);
    }
  }

  private renderWorldBorder(ctx: CanvasRenderingContext2D): void {
    const { grid } = this;
    const padding = 16;
    const x = -padding;
    const y = -padding;
    const w = grid.totalWidth + padding * 2;
    const h = grid.totalHeight + padding * 2;

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
    ctx.lineWidth = 2 / this.camera.zoom;
    ctx.strokeRect(x, y, w, h);

    // Corner markers
    const markerLen = 32;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3 / this.camera.zoom;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(x, y + markerLen);
    ctx.lineTo(x, y);
    ctx.lineTo(x + markerLen, y);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(x + w - markerLen, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y + h - markerLen);
    ctx.stroke();
  }

  private renderDistrictBoundaries(ctx: CanvasRenderingContext2D): void {
    if (this.camera.zoom < 0.35) return;

    const { grid } = this;
    const boundaryOffset = grid.config.spotGap / 2;
    ctx.save();
    ctx.strokeStyle = `rgba(245, 158, 11, ${this.camera.zoom > 0.8 ? 0.2 : 0.12})`;
    ctx.lineWidth = 1 / this.camera.zoom;
    ctx.setLineDash([5 / this.camera.zoom, 5 / this.camera.zoom]);
    ctx.beginPath();

    for (let district = 1; district < 10; district += 1) {
      const offset = district * 10 * grid.cellSize - boundaryOffset;
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset, grid.totalHeight);
      ctx.moveTo(0, offset);
      ctx.lineTo(grid.totalWidth, offset);
    }

    ctx.stroke();
    ctx.restore();
  }

  private isPrimeSpot(x: number, y: number): boolean {
    return (x === 0 && y === 0) || (x === 50 && y === 50) || (x === 99 && y === 99);
  }

  private renderPrimeSpot(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, isActive: boolean): void {
    ctx.save();
    ctx.strokeStyle = isActive ? '#fbbf24' : 'rgba(251, 191, 36, 0.6)';
    ctx.lineWidth = (isActive ? 2 : 1) / this.camera.zoom;
    ctx.setLineDash([4 / this.camera.zoom, 3 / this.camera.zoom]);
    ctx.beginPath();
    ctx.roundRect(x - 2, y - 2, size + 4, size + 4, 7);
    ctx.stroke();
    ctx.restore();
  }

  private renderEmptySpot(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    isHovered: boolean,
    isSelected: boolean
  ): void {
    if (isSelected) {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
    } else if (isHovered) {
      ctx.fillStyle = '#3b2b0d';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
    } else {
      ctx.fillStyle = '#181c2b';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 1;
    }

    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 5);
    ctx.fill();
    ctx.stroke();

    // Center crosshair / plus marker on available tiles
    if (this.camera.zoom > 0.35) {
      ctx.fillStyle = isHovered
        ? '#f59e0b'
        : isSelected
        ? '#ffffff'
        : 'rgba(255, 255, 255, 0.35)';
      const cx = x + size / 2;
      const cy = y + size / 2;
      ctx.fillRect(cx - 3, cy - 0.5, 6, 1);
      ctx.fillRect(cx - 0.5, cy - 3, 1, 6);
    }
  }

  private renderOccupiedSpot(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    occupied: OccupiedSpotSummary,
    isHovered: boolean,
    isSelected: boolean
  ): void {
    const avatar = getAvatar(occupied.avatarId);

    // Live presence glow: kept to one lightweight stroke per online tile.
    if (occupied.isOnline && this.camera.zoom > 0.45) {
      const pulse = (Math.sin(this.pulsePhase) + 1) / 2;
      ctx.save();
      ctx.shadowColor = `rgba(16, 185, 129, ${0.45 + pulse * 0.3})`;
      ctx.shadowBlur = 7 + pulse * 7;
      ctx.strokeStyle = `rgba(52, 211, 153, ${0.55 + pulse * 0.25})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x - 1, y - 1, size + 2, size + 2, 6);
      ctx.stroke();
      ctx.restore();
    }

    // Tile backdrop
    if (isSelected) {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
    } else if (isHovered) {
      ctx.fillStyle = '#263247';
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1.5;
    } else {
      ctx.fillStyle = 'rgba(24, 28, 40, 0.85)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
    }

    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 5);
    ctx.fill();
    ctx.stroke();

    // Avatar Sprite
    const pad = 4;
    const avatarSize = size - pad * 2;
    if (occupied.customAvatarData) {
      drawCustomAvatarOnCanvas(ctx, occupied.customAvatarData, x + pad, y + pad, avatarSize);
    } else {
      drawAvatarOnCanvas(ctx, avatar, x + pad, y + pad, avatarSize);
    }

    // Online presence badge
    if (occupied.isOnline && this.camera.zoom > 0.6) {
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(x + 4, y + 4, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Verified badge indicator
    if (occupied.isVerified && this.camera.zoom > 0.45) {
      const bx = x + size - 5;
      const by = y + 5;
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(bx, by, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Mini white checkmark
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(bx - 1.5, by);
      ctx.lineTo(bx - 0.3, by + 1.2);
      ctx.lineTo(bx + 1.6, by - 1.1);
      ctx.stroke();
    }
  }

  private renderSpotLabel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    occupied: OccupiedSpotSummary,
    isHovered: boolean
  ): void {
    ctx.font = '600 10px "Outfit", -apple-system, sans-serif';
    const text = occupied.displayName.length > 14 ? occupied.displayName.slice(0, 13) + '…' : occupied.displayName;
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const pillWidth = Math.max(size, textWidth + 12);
    const pillHeight = 16;
    const pillX = x + size / 2 - pillWidth / 2;
    const pillY = y + size + 4;

    // Dark glass capsule background behind text
    ctx.fillStyle = isHovered ? 'rgba(15, 23, 42, 0.95)' : 'rgba(10, 12, 18, 0.85)';
    ctx.strokeStyle = isHovered ? '#f59e0b' : 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 4);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = isHovered ? '#ffffff' : 'rgba(241, 245, 249, 0.95)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + size / 2, pillY + pillHeight / 2);
  }

  private renderSelectedBeacon(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number
  ): void {
    const pulse = (Math.sin(this.pulsePhase) + 1) / 2;
    const expand = pulse * 6;

    ctx.save();
    ctx.strokeStyle = `rgba(245, 158, 11, ${0.7 - pulse * 0.4})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x - expand, y - expand, size + expand * 2, size + expand * 2, 6);
    ctx.stroke();
    ctx.restore();
  }

  focusSpot(x: number, y: number, zoom = 2.0): void {
    if (!this.grid.isValidCoordinate(x, y)) return;
    this.selectedCoord = { x, y };
    const worldPos = this.grid.gridToWorld(x, y);
    this.camera.centerOn(worldPos.x + 18, worldPos.y + 18, zoom);
  }

  selectSpot(x: number, y: number): void {
    if (!this.grid.isValidCoordinate(x, y)) return;
    this.selectedCoord = { x, y };
    const spotId = this.grid.getSpotId(x, y);
    const occupied = this.occupiedMap.get(spotId);

    if (this.events.onSpotClick) {
      this.events.onSpotClick({ x, y, occupied });
    }
  }

  clearSelection(): void {
    this.selectedCoord = null;
  }
}
