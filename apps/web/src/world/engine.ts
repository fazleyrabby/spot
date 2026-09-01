/**
 * Engine — Main orchestrator for top-down Spot World (Stardew Valley / RPG Maker style).
 *
 * Responsibilities:
 * - Owns Camera, Renderer, SpriteManager
 * - Owns PlayerManager (chibi character with 4-dir WASD movement)
 * - Owns PlotManager (5x5 square plots)
 * - Owns MonumentManager (other citizen houses & online roam AI)
 * - Fetches WorldSnapshot and syncs live updates via SSE
 * - Exposes flyTo(gx, gy) for search and camera navigation
 */

import { Camera } from './camera.js';
import { Renderer } from './renderer.js';
import { SpriteManager } from './sprite-manager.js';
import { PlayerManager } from './player-manager.js';
import { MonumentManager } from './monument-manager.js';
import { PlotManager } from './plot-manager.js';
import { InteractionHandler } from './interaction.js';
import { gridToWorldCenter } from '@spot/world';
import type { OccupiedSpotSummary, WorldSnapshot } from '@spot/shared';

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  apiBase: string;
  /** Current logged in user details */
  citizenId?: string;
  avatarId?: string;
  displayName?: string;
  isVerified?: boolean;
  /** Callback when a citizen monument / plot is clicked */
  onCitizenClick?: (spot: OccupiedSpotSummary) => void;
  /** Callback when an empty tile is clicked */
  onEmptyClick?: (gx: number, gy: number) => void;
}

export class Engine {
  readonly camera: Camera;
  readonly renderer: Renderer;
  readonly sprites: SpriteManager;
  readonly player: PlayerManager;
  readonly monuments: MonumentManager;
  readonly plots: PlotManager;

  private input!: InteractionHandler;
  private sseSource: EventSource | null = null;
  private options: EngineOptions;

  constructor(options: EngineOptions) {
    this.options = options;

    this.camera = new Camera({
      minZoom: 0.35,
      maxZoom: 2.2,
      zoomSpeed: 0.0012,
      damping: 0.14,
    });

    this.sprites = new SpriteManager();
    this.plots = new PlotManager();

    this.monuments = new MonumentManager(
      (spot) => {
        this.options.onCitizenClick?.(spot);
      },
      options.citizenId,
      options.citizenId ? options.displayName : undefined,
    );

    this.player = new PlayerManager(
      options.avatarId ?? 'astronaut',
      this.plots,
      (plot) => {
        // Center camera smoothly on player's plot
        this.camera.centerOn(plot.worldCenterX, plot.worldCenterY, this.camera.zoom);
      },
    );

    if (options.displayName) this.player.displayName = options.displayName;
    if (options.isVerified) this.player.isVerified = options.isVerified;

    this.renderer = new Renderer(
      options.canvas,
      this.camera,
      this.sprites,
      this.player,
      this.monuments,
      this.plots,
    );
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async init(): Promise<void> {
    // 1. Initial canvas sizing
    this.renderer.handleResize();

    // 2. Load essential sprites (non-blocking)
    await this.sprites.loadEssential();

    // 3. Fetch initial world snapshot
    const snapshot = await this.fetchSnapshot();
    this.applySnapshot(snapshot);

    // 4. Position player
    if (this.options.citizenId) {
      this.monuments.setExcludeCitizen(this.options.citizenId, this.options.displayName);
      const mySpot = snapshot.occupied.find((s) => s.citizenId === this.options.citizenId);
      if (mySpot) {
        this.player.setPosition(mySpot.x, mySpot.y);
        const center = gridToWorldCenter(mySpot.x, mySpot.y);
        this.camera.centerOn(center.wx, center.wy, 1.2, true);
      } else {
        // Default founder coordinate (52, 60)
        this.player.setPosition(52, 60);
        const center = gridToWorldCenter(52, 60);
        this.camera.centerOn(center.wx, center.wy, 1.0, true);
      }
    } else {
      // Guest: spawn at Grand Central Plaza (48, 50)
      this.player.setPosition(48, 50);
      const center = gridToWorldCenter(48, 50);
      this.camera.centerOn(center.wx, center.wy, 1.1, true);
    }

    // 5. Bind player movement keys (WASD/Arrows)
    this.player.bindInput();

    // 6. Bind mouse/touch input handler
    this.input = new InteractionHandler(
      this.renderer,
      this.camera,
      this.plots,
      this.monuments,
      {
        onCitizenClick: (spot) => this.options.onCitizenClick?.(spot),
        onTileClick: (gx, gy) => this.options.onEmptyClick?.(gx, gy),
      },
    );

    // 7. Start the 60fps render loop
    this.renderer.start();

    // 8. Connect to real-time updates
    this.connectSSE();
  }

  destroy(): void {
    this.renderer.stop();
    this.input?.destroy();
    this.sseSource?.close();
  }

  // ---------------------------------------------------------------------------
  // Data Sync
  // ---------------------------------------------------------------------------

  private async fetchSnapshot(): Promise<WorldSnapshot> {
    const url = `${this.options.apiBase}/api/world`;
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as WorldSnapshot;
    } catch (err) {
      console.warn('[SpotWorld] Using fallback empty snapshot:', err);
      return {
        width: 100,
        height: 100,
        totalSpots: 10000,
        claimedCount: 0,
        onlineCount: 1,
        occupied: [],
      };
    }
  }

  private applySnapshot(snapshot: WorldSnapshot): void {
    this.plots.update(snapshot.occupied);
    this.monuments.update(snapshot.occupied);
  }

  // ---------------------------------------------------------------------------
  // Navigation & Search
  // ---------------------------------------------------------------------------

  /**
   * Smoothly fly camera to a target grid tile and teleport player there.
   */
  flyTo(gx: number, gy: number, zoom = 1.3): void {
    const center = gridToWorldCenter(gx, gy);
    this.camera.centerOn(center.wx, center.wy, zoom);
    this.player.teleport(gx, gy);
  }

  // ---------------------------------------------------------------------------
  // SSE Real-Time Sync
  // ---------------------------------------------------------------------------

  private connectSSE(): void {
    const url = `${this.options.apiBase}/api/events`;
    try {
      const source = new EventSource(url, { withCredentials: true });
      this.sseSource = source;

      source.addEventListener('spot-claimed', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as OccupiedSpotSummary;
          const current = this.plots.getAllPlots().map((p) => p.owner);
          const updated = [...current.filter((s) => s.x !== data.x || s.y !== data.y), data];
          this.plots.update(updated);
          this.monuments.update(updated);
        } catch (_) {}
      });

      source.addEventListener('spot-updated', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as OccupiedSpotSummary;
          const current = this.plots.getAllPlots().map((p) => p.owner);
          const updated = current.map((s) => (s.x === data.x && s.y === data.y ? data : s));
          this.plots.update(updated);
          this.monuments.update(updated);
        } catch (_) {}
      });

      source.addEventListener('spot-released', (e: MessageEvent) => {
        try {
          const { x, y } = JSON.parse(e.data) as { x: number; y: number };
          const current = this.plots.getAllPlots().map((p) => p.owner);
          const updated = current.filter((s) => s.x !== x || s.y !== y);
          this.plots.update(updated);
          this.monuments.update(updated);
        } catch (_) {}
      });

      source.onerror = () => {
        // Auto-reconnects
      };
    } catch (_) {}
  }
}
