/**
 * InteractionHandler — Pointer, wheel, and touch input for top-down Spot World.
 */

import { Camera } from './camera.js';
import { Renderer } from './renderer.js';
import { PlotManager } from './plot-manager.js';
import { MonumentManager } from './monument-manager.js';
import { worldToGrid } from '@spot/world';
import type { OccupiedSpotSummary } from '@spot/shared';
import { getSecretAt, type WorldSecret } from './secrets.js';
import { hitTestBanner, type WorldBanner } from './banner-manager.js';
import { getArtExperienceAt } from './art-experiences.js';

export interface InteractionEvents {
  onCitizenClick?: (spot: OccupiedSpotSummary) => void;
  onSecretClick?: (secret: WorldSecret) => void;
  onBannerClick?: (banner: WorldBanner) => void;
  onTileClick?: (gx: number, gy: number) => void;
  onMarineClick?: (kind: string) => void;
  onJungleAnimalClick?: (id: string) => void;
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

  private isUiElement(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest('button, a, input, select, textarea, summary, [role="button"], #world-hud, .world-hud, .modal-card, #profile-modal-backdrop')
    );
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
      // Don't drag or capture if clicking on HUD or Modal UI
      if (this.isUiElement(e.target) || e.target !== canvas) {
        return;
      }

      this.isDragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.dragDistance = 0;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {}
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
        if (this.isUiElement(e.target) || (this.renderer as any).museum?.isInside) {
          this.renderer.hoveredCitizen = null;
          this.renderer.hoveredGrid = null;
          canvas.style.cursor = 'default';
          return;
        }

        const world = this.screenToWorld(e.clientX, e.clientY);
        const grid = worldToGrid(world.x, world.y);
        this.renderer.hoveredGrid = grid;
        const citizen = this.monuments.hitTest(world.x, world.y);
        const banner = hitTestBanner(world.x, world.y);
        const secret = grid ? getSecretAt(grid.gx, grid.gy) : null;
        const vignette = this.renderer.vignettes.getHoveredVignette(world.x, world.y);

        // Museum door hover → pointer
        const doorWx = 60 * 48 + 24;
        const doorWy = 38 * 32 + 16;
        const onDoor = Math.hypot(world.x - doorWx, world.y - doorWy) < 40;

        const onMarine = this.renderer.marine.hitTestMarine(world.x, world.y);
        // Art experiences can sit on the beach (gy >= 100), outside the 0..99
        // city grid worldToGrid validates — use raw floor coords instead.
        const artGx = Math.floor(world.x / 48);
        const artGy = Math.floor(world.y / 32);
        const artExp = getArtExperienceAt(artGx, artGy);

        if (artExp) {
          this.renderer.hoveredCitizen = null;
          this.renderer.hoveredBanner = null;
          this.renderer.hoveredSecret = null;
          canvas.style.cursor = 'pointer';
        } else if (onDoor || onMarine) {
          this.renderer.hoveredCitizen = null;
          this.renderer.hoveredBanner = null;
          this.renderer.hoveredSecret = null;
          canvas.style.cursor = 'pointer';
        } else if (citizen) {
          this.renderer.hoveredCitizen = citizen;
          this.renderer.hoveredBanner = null;
          this.renderer.hoveredSecret = null;
          canvas.style.cursor = 'pointer';
        } else if (vignette) {
          this.renderer.hoveredCitizen = null;
          this.renderer.hoveredBanner = null;
          this.renderer.hoveredSecret = null;
          canvas.style.cursor = 'pointer';
        } else if (banner) {
          this.renderer.hoveredCitizen = null;
          this.renderer.hoveredBanner = banner;
          this.renderer.hoveredSecret = null;
          canvas.style.cursor = 'pointer';
        } else if (secret) {
          this.renderer.hoveredCitizen = null;
          this.renderer.hoveredBanner = null;
          this.renderer.hoveredSecret = secret;
          canvas.style.cursor = 'pointer';
        } else {
          this.renderer.hoveredCitizen = null;
          this.renderer.hoveredBanner = null;
          this.renderer.hoveredSecret = null;
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

      // Click / Tap (dragged less than 6px on desktop mouse, 18px on touchscreens)
      const maxClickDist = e.pointerType === 'touch' ? 18 : 6;
      if (this.dragDistance < maxClickDist) {
        const releaseTarget = document.elementFromPoint(e.clientX, e.clientY);
        if (this.isUiElement(releaseTarget)) {
          return;
        }

        const world = this.screenToWorld(e.clientX, e.clientY);

        // Inside museum — suppress city clicks, handle frame clicks only (handled by overlay)
        if ((this.renderer as any).museum?.isInside) {
          const localGx = Math.floor(world.x / 48);
          const localGy = Math.floor(world.y / 32);
          // allow walk inside museum bounds only
          if (localGx >= 0 && localGx < 22 && localGy >= 0 && localGy < 16) {
            this.renderer.player.walkTo(world.x, world.y);
          }
          return;
        }

        // -1. Museum door (60,38) — click to open (same as pressing E)
        const doorWx = 60 * 48 + 24;
        const doorWy = 38 * 32 + 16;
        if (Math.hypot(world.x - doorWx, world.y - doorWy) < 40) {
          (window as any).openMuseumModal?.();
          return;
        }

        // -0.5. Marine life click
        const marineHit = this.renderer.marine.hitTestMarine(world.x, world.y);
        if (marineHit) {
          this.events.onMarineClick?.(marineHit.kind);
          return;
        }

        // -0.25. Art Experience trigger (sunset arch / dive signpost)
        // Raw floor coords (not worldToGrid) so beach gy>=100 props are clickable.
        const artGx = Math.floor(world.x / 48);
        const artGy = Math.floor(world.y / 32);
        const artExp = getArtExperienceAt(artGx, artGy);
        if (artExp) {
          this.renderer.selectedCitizen = null;
          (window as any).openArtExperience?.(artExp.slug, artExp.title);
          return;
        }

        // 0. Check if clicked directly on an interactive Floor796 vignette
        const vignette = this.renderer.vignettes.handleClick(world.x, world.y);
        if (vignette) {
          this.renderer.selectedCitizen = null;
          if (vignette.id.startsWith('jungle_')) {
            this.events.onJungleAnimalClick?.(vignette.id);
          }
          return;
        }

        // 1. Check if clicked directly on a citizen character
        const citizen = this.monuments.hitTest(world.x, world.y);
        if (citizen) {
          this.renderer.selectedCitizen = citizen;
          this.events.onCitizenClick?.(citizen);
          return;
        }

        // 1b. Check if clicked directly on a sponsor billboard banner
        const banner = hitTestBanner(world.x, world.y);
        if (banner) {
          this.renderer.selectedCitizen = null;
          this.events.onBannerClick?.(banner);
          return;
        }

        const grid = worldToGrid(world.x, world.y);
        if (grid) {
          // 2. Check if clicked on a secret landmark or study kiosk
          const secret = getSecretAt(grid.gx, grid.gy);
          if (secret) {
            this.renderer.selectedCitizen = null;
            this.events.onSecretClick?.(secret);
            return;
          }

          // 3. Tap on ground -> walk to destination
          this.renderer.selectedCitizen = null;
          this.renderer.player.walkTo(world.x, world.y);
          this.events.onTileClick?.(grid.gx, grid.gy);
        } else {
          this.renderer.selectedCitizen = null;
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
      if (this.isUiElement(e.target)) return;
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

    // ── 4. Floor796 Diorama Zoom Shortcuts (DblClick / 'Z' Key) ───────────
    const onDblClick = (e: MouseEvent) => {
      if (this.isUiElement(e.target)) return;
      this.camera.cycleZoomPreset();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (this.isUiElement(document.activeElement)) return;
      if (e.key === 'z' || e.key === 'Z') {
        this.camera.cycleZoomPreset();
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('dblclick', onDblClick);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);

    this.disposers.push(() => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('dblclick', onDblClick);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    });
  }

  destroy(): void {
    for (const d of this.disposers) d();
    this.disposers = [];
  }
}
