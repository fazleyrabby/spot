/**
 * InteractionHandler — Pointer, wheel, and touch input for top-down Spot World.
 */

import { Camera } from './camera.js';
import { Renderer } from './renderer.js';
import { PlotManager } from './plot-manager.js';
import { MonumentManager } from './monument-manager.js';
import { worldToGrid } from '@spot/world';
import type { OccupiedSpotSummary } from '@spot/shared';

export interface InteractionEvents {
  onCitizenClick?: (spot: OccupiedSpotSummary) => void;
  onTileClick?: (gx: number, gy: number) => void;
}

export class InteractionHandler {
  private renderer: Renderer;
  private camera: Camera;
  private canvas: HTMLCanvasElement;
  private plots: PlotManager;
  private monuments: MonumentManager;
  private events: InteractionEvents;

  private isDragging = false;
  private lastX = 0;
  private lastY = 0;
  private dragDistance = 0;
  private initialPinchDist = 0;

  private disposers: Array<() => void> = [];

  constructor(
    renderer: Renderer,
    camera: Camera,
    plots: PlotManager,
    monuments: MonumentManager,
    events: InteractionEvents = {},
  ) {
    this.renderer = renderer;
    this.camera = camera;
    this.canvas = renderer.canvas;
    this.plots = plots;
    this.monuments = monuments;
    this.events = events;

    this.bindEvents();
  }

  private screenToWorld(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return this.camera.screenToWorld(sx, sy);
  }

  private bindEvents(): void {
    const { canvas } = this;

    // ── 1. Pointer Down / Move / Up (Pan & Hover) ──────────────────────────

    const onPointerDown = (e: PointerEvent) => {
      // Don't drag if clicking a UI button overlaid on canvas
      const target = e.target as HTMLElement;
      if (target !== canvas) return;

      this.isDragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.dragDistance = 0;
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (this.isDragging) {
        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;
        this.dragDistance += Math.hypot(dx, dy);
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.camera.panBy(dx, dy);
      } else {
        // Hover state
        const world = this.screenToWorld(e.clientX, e.clientY);
        const grid = worldToGrid(world.x, world.y);

        if (grid) {
          this.renderer.hoveredGrid = grid;
          const plot = this.plots.getPlotAt(grid.gx, grid.gy);
          this.renderer.hoveredPlot = plot;
          canvas.style.cursor = plot ? 'pointer' : 'default';
        } else {
          this.renderer.hoveredGrid = null;
          this.renderer.hoveredPlot = null;
          canvas.style.cursor = 'default';
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!this.isDragging) return;
      this.isDragging = false;

      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {}

      // Click / Tap (dragged less than 6 pixels)
      if (this.dragDistance < 6) {
        const world = this.screenToWorld(e.clientX, e.clientY);
        const grid = worldToGrid(world.x, world.y);

        // 1. Check if clicked a citizen house / monument
        const citizen = this.monuments.hitTest(world.x, world.y);
        if (citizen) {
          const plot = this.plots.getPlotByCenter(citizen.x, citizen.y);
          this.renderer.selectedPlot = plot;
          this.events.onCitizenClick?.(citizen);
          return;
        }

        // 2. Check if clicked a plot
        if (grid) {
          const plot = this.plots.getPlotAt(grid.gx, grid.gy);
          if (plot) {
            this.renderer.selectedPlot = plot;
            this.events.onCitizenClick?.(plot.owner);
          } else {
            this.renderer.selectedPlot = null;
            this.events.onTileClick?.(grid.gx, grid.gy);
          }
        } else {
          this.renderer.selectedPlot = null;
        }
      }
    };

    const onPointerCancel = () => {
      this.isDragging = false;
      this.dragDistance = 0;
      this.initialPinchDist = 0;
    };

    // ── 2. Wheel Zoom ──────────────────────────────────────────────────────

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      this.camera.zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY);
    };

    // ── 3. Touch Pinch Zoom ────────────────────────────────────────────────

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        if (this.initialPinchDist > 0) {
          const delta = this.initialPinchDist - dist;
          const rect = canvas.getBoundingClientRect();
          const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
          const midY = (t1.clientY + t2.clientY) / 2 - rect.top;
          this.camera.zoomAt(midX, midY, delta * 3);
        }
        this.initialPinchDist = dist;
      }
    };

    const onTouchEnd = () => {
      this.initialPinchDist = 0;
    };

    const onResize = () => {
      this.renderer.handleResize();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    window.addEventListener('resize', onResize);

    this.disposers.push(() => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('resize', onResize);
    });
  }

  destroy(): void {
    for (const d of this.disposers) d();
    this.disposers = [];
  }
}
