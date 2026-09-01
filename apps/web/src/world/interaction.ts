/**
 * IsoInputHandler — pointer / wheel / touch event handling for Spot World.
 *
 * Mirrors the pattern of the existing CanvasInputHandler in canvas/input.ts
 * but adapted for the IsoRenderer's coordinate system.
 */

import { IsoCamera } from './iso-camera.js';
import { IsoRenderer } from './iso-renderer.js';
import { worldToGrid, getWorldOrigin } from '@spot/world';

export class IsoInputHandler {
  private camera: IsoCamera;
  private renderer: IsoRenderer;
  private canvas: HTMLCanvasElement;

  private isDragging = false;
  private lastX = 0;
  private lastY = 0;
  private dragDistance = 0;

  private initialPinchDist = 0;

  private disposers: Array<() => void> = [];

  /** Cached world origin (constant for a given grid size) */
  private ox: number;
  private oy: number;

  constructor(renderer: IsoRenderer, camera: IsoCamera) {
    this.renderer = renderer;
    this.camera = camera;
    this.canvas = renderer.canvas;

    const { ox, oy } = getWorldOrigin();
    this.ox = ox;
    this.oy = oy;

    this.bindEvents();
  }

  private screenToGrid(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const world = this.camera.screenToWorld(sx, sy);
    // Subtract world origin offset before inverse-projecting
    return worldToGrid(world.x - this.ox, world.y - this.oy);
  }

  private bindEvents(): void {
    const { canvas } = this;

    // ── Pointer drag (pan) ──────────────────────────────────────────────────

    const onPointerDown = (e: PointerEvent) => {
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
        // Hover — convert screen → iso grid
        const grid = this.screenToGrid(e.clientX, e.clientY);
        if (grid) {
          if (
            this.renderer.hoveredTile?.gx !== grid.gx ||
            this.renderer.hoveredTile?.gy !== grid.gy
          ) {
            this.renderer.hoveredTile = grid;
            canvas.style.cursor = 'pointer';
          }
        } else {
          if (this.renderer.hoveredTile !== null) {
            this.renderer.hoveredTile = null;
            canvas.style.cursor = 'default';
          }
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!this.isDragging) return;
      this.isDragging = false;

      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}

      // Tap / click: treat as click if moved < 6px total
      if (this.dragDistance < 6) {
        const grid = this.screenToGrid(e.clientX, e.clientY);
        if (grid) {
          this.renderer.selectedTile = grid;
          // Find occupied spot data and fire event
          // (engine will wire up the actual map lookup)
          this.renderer.events.onTileClick?.(grid.gx, grid.gy);
        } else {
          this.renderer.selectedTile = null;
        }
      }
    };

    const onPointerCancel = () => {
      this.isDragging = false;
      this.dragDistance = 0;
      this.initialPinchDist = 0;
    };

    // ── Wheel zoom ──────────────────────────────────────────────────────────

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      this.camera.zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY);
    };

    // ── Pinch zoom (touch) ──────────────────────────────────────────────────

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

    const onTouchEnd = () => { this.initialPinchDist = 0; };

    // ── Resize ──────────────────────────────────────────────────────────────

    const onResize = () => { this.renderer.handleResize(); };

    // ── Register ────────────────────────────────────────────────────────────

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
