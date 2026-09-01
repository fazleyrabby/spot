/**
 * IsoEngine — main orchestrator for Spot World.
 *
 * Responsibilities:
 *  - Owns IsoCamera, IsoRenderer, SpriteManager, IsoInputHandler
 *  - Fetches WorldSnapshot and keeps it in sync via SSE
 *  - Exposes flyTo(gx, gy) for search integration
 *  - Fires profile popup events for the host page to handle
 */

import { IsoCamera } from './iso-camera.js';
import { IsoRenderer } from './iso-renderer.js';
import { SpriteManager } from './sprite-manager.js';
import { IsoInputHandler } from './interaction.js';
import { gridToWorld, getWorldOrigin } from '@spot/world';
import type { OccupiedSpotSummary, WorldSnapshot } from '@spot/shared';

export interface IsoEngineOptions {
  canvas: HTMLCanvasElement;
  apiBase: string;
  /** Called when a citizen plot is clicked — host page should open profile modal */
  onCitizenClick?: (spot: OccupiedSpotSummary) => void;
  /** Called when an empty tile is clicked */
  onEmptyClick?: (gx: number, gy: number) => void;
}

export class IsoEngine {
  readonly camera: IsoCamera;
  readonly renderer: IsoRenderer;
  readonly sprites: SpriteManager;

  private input!: IsoInputHandler;
  private occupiedMap = new Map<string, OccupiedSpotSummary>();
  private sseSource: EventSource | null = null;
  private options: IsoEngineOptions;

  constructor(options: IsoEngineOptions) {
    this.options = options;

    this.camera = new IsoCamera({
      minZoom: 0.18,
      maxZoom: 2.2,
      zoomSpeed: 0.0012,
      damping: 0.15,
    });

    this.renderer = new IsoRenderer(options.canvas, this.camera, {
      onTileClick: (gx, gy) => this.handleTileClick(gx, gy),
    });

    this.sprites = new SpriteManager();
  }

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------

  async init(): Promise<void> {
    // 1. Resize canvas
    this.renderer.handleResize();

    // 2. Kick off sprite loading (non-blocking — procedural fallback renders immediately)
    this.sprites.loadEssential();

    // 3. Fetch world snapshot
    const snapshot = await this.fetchSnapshot();
    this.applySnapshot(snapshot);

    // 4. Centre camera on world centroid (tile 50,50)
    this.centreOnWorld();

    // 5. Bind input handler
    this.input = new IsoInputHandler(this.renderer, this.camera);

    // 6. Start render loop
    this.renderer.start();

    // 7. Subscribe to SSE for live updates
    this.connectSSE();
  }

  destroy(): void {
    this.renderer.stop();
    this.input?.destroy();
    this.sseSource?.close();
  }

  // ---------------------------------------------------------------------------
  // Snapshot
  // ---------------------------------------------------------------------------

  private async fetchSnapshot(): Promise<WorldSnapshot> {
    const url = `${this.options.apiBase}/api/world`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`World fetch failed: ${res.status}`);
    return res.json() as Promise<WorldSnapshot>;
  }

  private applySnapshot(snapshot: WorldSnapshot): void {
    this.occupiedMap.clear();
    for (const s of snapshot.occupied) {
      this.occupiedMap.set(`${s.x},${s.y}`, s);
    }
    this.renderer.setOccupied(snapshot.occupied);
  }

  // ---------------------------------------------------------------------------
  // Camera
  // ---------------------------------------------------------------------------

  private centreOnWorld(): void {
    const { ox, oy } = getWorldOrigin();
    const centre = gridToWorld(50, 50);
    // Camera centre = iso world centre + origin offset
    this.camera.centerOn(centre.wx + ox, centre.wy + oy, 0.55, true);
  }

  /**
   * Smoothly fly the camera to a citizen's plot.
   * Used by the ⌘K search results handler.
   */
  flyTo(gx: number, gy: number, zoom = 1.2): void {
    const { ox, oy } = getWorldOrigin();
    const { wx, wy } = gridToWorld(gx, gy);
    this.camera.centerOn(wx + ox, wy + oy, zoom);
  }

  // ---------------------------------------------------------------------------
  // Interaction
  // ---------------------------------------------------------------------------

  private handleTileClick(gx: number, gy: number): void {
    const key = `${gx},${gy}`;
    const occupied = this.occupiedMap.get(key);

    if (occupied) {
      this.options.onCitizenClick?.(occupied);
    } else {
      this.options.onEmptyClick?.(gx, gy);
    }
  }

  // ---------------------------------------------------------------------------
  // SSE — live real-time updates (same stream as grid view)
  // ---------------------------------------------------------------------------

  private connectSSE(): void {
    const url = `${this.options.apiBase}/api/events`;
    const source = new EventSource(url, { withCredentials: true });
    this.sseSource = source;

    source.addEventListener('spot-claimed', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as OccupiedSpotSummary;
        this.occupiedMap.set(`${data.x},${data.y}`, data);
        // Rebuild renderer occupied list
        this.renderer.setOccupied(Array.from(this.occupiedMap.values()));
      } catch (_) {}
    });

    source.addEventListener('spot-updated', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as OccupiedSpotSummary;
        this.occupiedMap.set(`${data.x},${data.y}`, data);
        this.renderer.setOccupied(Array.from(this.occupiedMap.values()));
      } catch (_) {}
    });

    source.addEventListener('spot-released', (e: MessageEvent) => {
      try {
        const { x, y } = JSON.parse(e.data) as { x: number; y: number };
        this.occupiedMap.delete(`${x},${y}`);
        this.renderer.setOccupied(Array.from(this.occupiedMap.values()));
      } catch (_) {}
    });

    source.onerror = () => {
      // SSE reconnects automatically; silence the error
    };
  }
}
