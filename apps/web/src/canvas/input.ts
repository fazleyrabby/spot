import type { WorldCanvasRenderer } from './renderer.js';

export class CanvasInputHandler {
  private renderer: WorldCanvasRenderer;
  private canvas: HTMLCanvasElement;

  // Pointer state
  private isDragging = false;
  private lastX = 0;
  private lastY = 0;
  private dragDistance = 0;

  // Multi-touch pinch state
  private initialPinchDist = 0;

  // Cleanup callbacks
  private disposers: Array<() => void> = [];

  constructor(renderer: WorldCanvasRenderer) {
    this.renderer = renderer;
    this.canvas = renderer.canvas;
    this.bindEvents();
  }

  private bindEvents(): void {
    const { canvas, renderer } = this;

    // 1. Mouse & Pointer events
    const onPointerDown = (e: PointerEvent) => {
      this.isDragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.dragDistance = 0;
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      if (this.isDragging) {
        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;
        this.dragDistance += Math.hypot(dx, dy);
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        renderer.camera.panBy(dx, dy);
      } else {
        // Hover state calculation
        const worldPos = renderer.camera.screenToWorld(clientX, clientY);
        const gridCoord = renderer.grid.worldToGrid(worldPos.x, worldPos.y);

        if (
          (gridCoord && !renderer.hoveredCoord) ||
          (!gridCoord && renderer.hoveredCoord) ||
          (gridCoord && renderer.hoveredCoord && (gridCoord.x !== renderer.hoveredCoord.x || gridCoord.y !== renderer.hoveredCoord.y))
        ) {
          renderer.hoveredCoord = gridCoord;
          if (renderer.events.onSpotHover) {
            if (gridCoord) {
              const spotId = renderer.grid.getSpotId(gridCoord.x, gridCoord.y);
              // @ts-ignore internal map lookup
              const occupied = renderer['occupiedMap']?.get(spotId);
              renderer.events.onSpotHover({ x: gridCoord.x, y: gridCoord.y, occupied });
            } else {
              renderer.events.onSpotHover(null);
            }
          }
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (this.isDragging) {
        this.isDragging = false;
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch (_) {}

        // HUD controls sit over the canvas and pointerup is handled on the
        // window so drags can finish outside the canvas. On touch devices,
        // that global handler can otherwise interpret a control tap as a map
        // tap and select the spot underneath it.
        const releaseTarget = document.elementFromPoint(e.clientX, e.clientY);
        const isUiControl = releaseTarget instanceof Element && Boolean(
          releaseTarget.closest('button, a, input, select, textarea, summary, [role="button"]'),
        );
        if (isUiControl) return;

        // If moved less than 5px, treat as a click / tap
        if (this.dragDistance < 6) {
          const rect = canvas.getBoundingClientRect();
          const clientX = e.clientX - rect.left;
          const clientY = e.clientY - rect.top;
          const worldPos = renderer.camera.screenToWorld(clientX, clientY);
          const gridCoord = renderer.grid.worldToGrid(worldPos.x, worldPos.y);

          if (gridCoord) {
            renderer.selectSpot(gridCoord.x, gridCoord.y);
          } else {
            renderer.clearSelection();
          }
        }
      }
    };

    // 2. Wheel zoom
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      renderer.camera.zoomAt(clientX, clientY, e.deltaY);
    };

    // 3. Touch Pinch Zoom
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        if (this.initialPinchDist > 0) {
          const delta = this.initialPinchDist - dist;
          const midX = (t1.clientX + t2.clientX) / 2;
          const midY = (t1.clientY + t2.clientY) / 2;
          const rect = canvas.getBoundingClientRect();
          renderer.camera.zoomAt(midX - rect.left, midY - rect.top, delta * 3);
        }
        this.initialPinchDist = dist;
      }
    };

    const onTouchEnd = () => {
      this.initialPinchDist = 0;
    };

    // 4. Resize listener
    const onResize = () => {
      renderer.handleResize();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    window.addEventListener('resize', onResize);

    this.disposers.push(() => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('resize', onResize);
    });
  }

  destroy(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers = [];
  }
}
