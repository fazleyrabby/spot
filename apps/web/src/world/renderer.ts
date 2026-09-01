/**
 * Renderer — Canvas2D top-down renderer for Spot World (Stardew Valley / RPG Maker style).
 *
 * Pipeline:
 *  1. Render base ground tiles (lush grass variations + plot lawns & stone paths).
 *  2. Collect all renderable entities (trees, houses, AI citizens, player).
 *  3. Depth-sort all entities by Y position (painter's algorithm for proper occlusion).
 *  4. Render sorted entities.
 *  5. Render particle overlays (pollen, leaves, chimney smoke, sleep z's).
 *  6. Render hover / selection overlays.
 */

import { Camera } from './camera.js';
import {
  TILE_WIDTH,
  TILE_HEIGHT,
  getVisibleGridRange,
  worldToGrid,
} from '@spot/world';
import {
  getTileBaseTerrain,
  getTileNatureObject,
  type NatureObject,
} from './terrain-generator.js';
import { SpriteManager } from './sprite-manager.js';
import { PlayerManager } from './player-manager.js';
import { MonumentManager } from './monument-manager.js';
import { PlotManager, type Plot } from './plot-manager.js';
import type { OccupiedSpotSummary } from '@spot/shared';

// ---------------------------------------------------------------------------
// Colors & Palettes (Stardew Valley / Harvest Moon inspired warmth)
// ---------------------------------------------------------------------------

const PALETTE = {
  // Ground tiles
  grass_1: '#2f6826', // base vibrant grass
  grass_2: '#38752c', // sunlit patch
  grass_3: '#285820', // deep shaded grass
  grass_4: '#3f8232', // lush warm green

  // Plot ground
  plot_lawn: '#3d8630',
  plot_lawn_accent: '#479639',
  plot_border_stone: '#94a3b8',
  plot_border_path: '#ca8a04',
  plot_border_inner: 'rgba(253, 224, 71, 0.25)',

  // Nature colors
  trunk: '#5c3a1e',
  canopy_oak: '#22c55e',
  canopy_oak_shadow: '#15803d',
  canopy_pine: '#047857',
  canopy_pine_shadow: '#064e3b',
  bush: '#16a34a',
  flower_stem: '#4ade80',
  flower_petal_1: '#f43f5e',
  flower_petal_2: '#fbbf24',
  flower_petal_3: '#38bdf8',
  rock_body: '#64748b',
  rock_shadow: '#334155',

  // Selection / hover
  hover_border: 'rgba(245, 158, 11, 0.75)',
  hover_fill: 'rgba(245, 158, 11, 0.12)',
  select_border: '#f59e0b',
  select_fill: 'rgba(245, 158, 11, 0.22)',
};

// ---------------------------------------------------------------------------
// Renderable Entity Interface for Depth Sorting
// ---------------------------------------------------------------------------

interface RenderableEntity {
  depth: number;
  render: (ctx: CanvasRenderingContext2D, z: number) => void;
}

interface AmbientParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly camera: Camera;
  readonly sprites: SpriteManager;
  readonly player: PlayerManager;
  readonly monuments: MonumentManager;
  readonly plots: PlotManager;

  // Interaction highlights
  hoveredGrid: { gx: number; gy: number } | null = null;
  hoveredPlot: Plot | null = null;
  selectedPlot: Plot | null = null;

  // Ambient floating particles
  private ambientParticles: AmbientParticle[] = [];
  private animFrameId: number | null = null;
  private tick = 0;

  constructor(
    canvas: HTMLCanvasElement,
    camera: Camera,
    sprites: SpriteManager,
    player: PlayerManager,
    monuments: MonumentManager,
    plots: PlotManager,
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Cannot get 2D canvas context');
    this.ctx = ctx;
    this.camera = camera;
    this.sprites = sprites;
    this.player = player;
    this.monuments = monuments;
    this.plots = plots;

    this.initAmbientParticles();
  }

  private initAmbientParticles(): void {
    const colors = ['#86efac', '#fef08a', '#fbcfe8', '#bae6fd'];
    for (let i = 0; i < 35; i++) {
      this.ambientParticles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.3) * 0.4 + 0.2,
        vy: (Math.random() - 0.5) * 0.2 + 0.15,
        size: 1.5 + Math.random() * 2,
        alpha: 0.2 + Math.random() * 0.45,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  handleResize(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.scale(dpr, dpr);
    this.camera.setViewport(w, h);
  }

  start(): void {
    if (this.animFrameId === null) {
      this.loop();
    }
  }

  stop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private loop = (): void => {
    this.animFrameId = requestAnimationFrame(this.loop);
    this.tick++;

    // Update camera & gameplay entities
    this.camera.update();
    this.player.update();
    this.monuments.updateTick();

    this.draw();
  };

  private draw(): void {
    const { ctx, camera } = this;
    const W = camera.viewportWidth;
    const H = camera.viewportHeight;
    const z = camera.zoom;

    // 1. Clear with dark background
    ctx.fillStyle = '#0f1710';
    ctx.fillRect(0, 0, W, H);

    // 2. Visible grid bounds
    const bounds = camera.getWorldBounds();
    const range = getVisibleGridRange(bounds.left, bounds.top, bounds.right, bounds.bottom, 2);

    // 3. Ground Layer — Square Tiles
    this.drawGroundTiles(ctx, range, z);

    // 4. Collect all Depth-Sorted Entities
    const entities: RenderableEntity[] = [];

    // 4a. Nature props on empty land
    this.collectNatureEntities(range, entities);

    // 4b. Citizen Houses & AI Roaming Characters
    const allCitizens = this.monuments.getAllEntities();
    for (const ent of allCitizens) {
      const screen = camera.worldToScreen(ent.wx, ent.wy);
      // Cull if way off screen
      if (screen.x < -120 || screen.x > W + 120 || screen.y < -120 || screen.y > H + 120) continue;

      entities.push({
        depth: ent.wy,
        render: (c, currentZoom) => {
          this.monuments.renderEntity(c, ent, screen.x, screen.y, currentZoom, this.sprites);
        },
      });
    }

    // 4c. Player Character
    const playerScreen = camera.worldToScreen(this.player.wx, this.player.wy);
    entities.push({
      depth: this.player.wy,
      render: (c, currentZoom) => {
        this.player.render(c, playerScreen.x, playerScreen.y, currentZoom);
      },
    });

    // 5. Sort by Y (depth ascending: top-to-bottom on screen)
    entities.sort((a, b) => a.depth - b.depth);

    // 6. Draw all sorted entities
    for (const entity of entities) {
      entity.render(ctx, z);
    }

    // 7. Hover & Selection Overlays
    this.drawOverlays(ctx, z);

    // 8. Ambient atmospheric particles (drifting pollen / sparkles)
    this.drawAmbientParticles(ctx);
  }

  // ---------------------------------------------------------------------------
  // Ground Layer
  // ---------------------------------------------------------------------------

  private drawGroundTiles(
    ctx: CanvasRenderingContext2D,
    range: { minGx: number; maxGx: number; minGy: number; maxGy: number },
    z: number,
  ): void {
    const tw = TILE_WIDTH * z;
    const th = TILE_HEIGHT * z;

    for (let gy = range.minGy; gy <= range.maxGy; gy++) {
      for (let gx = range.minGx; gx <= range.maxGx; gx++) {
        const wx = gx * TILE_WIDTH;
        const wy = gy * TILE_HEIGHT;
        const screen = this.camera.worldToScreen(wx, wy);

        const plot = this.plots.getPlotAt(gx, gy);
        const { isBorder } = this.plots.isPlotBorder(gx, gy);

        if (plot) {
          // Inside 5x5 citizen plot
          if (isBorder) {
            // Plot perimeter stone border
            ctx.fillStyle = (gx + gy) % 2 === 0 ? PALETTE.plot_border_path : PALETTE.plot_lawn;
            ctx.fillRect(Math.floor(screen.x), Math.floor(screen.y), Math.ceil(tw), Math.ceil(th));

            // Subtle stone paving dot
            ctx.fillStyle = PALETTE.plot_border_stone;
            ctx.fillRect(
              Math.floor(screen.x + tw * 0.2),
              Math.floor(screen.y + th * 0.25),
              Math.max(1, Math.round(3 * z)),
              Math.max(1, Math.round(2 * z)),
            );
          } else {
            // Clean garden lawn
            const isCenter = gx === plot.centerX && gy === plot.centerY;
            ctx.fillStyle = isCenter ? PALETTE.plot_lawn_accent : PALETTE.plot_lawn;
            ctx.fillRect(Math.floor(screen.x), Math.floor(screen.y), Math.ceil(tw), Math.ceil(th));
          }
        } else {
          // Empty nature land
          const baseType = getTileBaseTerrain(gx, gy);
          ctx.fillStyle = PALETTE[baseType];
          ctx.fillRect(Math.floor(screen.x), Math.floor(screen.y), Math.ceil(tw), Math.ceil(th));

          // Subtle grass blade detail
          if ((gx * 7 + gy * 13) % 5 === 0 && z >= 0.7) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.fillRect(
              Math.floor(screen.x + tw * 0.4),
              Math.floor(screen.y + th * 0.35),
              Math.max(1, Math.round(2 * z)),
              Math.max(1, Math.round(4 * z)),
            );
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Nature Props Collection
  // ---------------------------------------------------------------------------

  private collectNatureEntities(
    range: { minGx: number; maxGx: number; minGy: number; maxGy: number },
    entities: RenderableEntity[],
  ): void {
    const W = this.camera.viewportWidth;
    const H = this.camera.viewportHeight;

    for (let gy = range.minGy; gy <= range.maxGy; gy++) {
      for (let gx = range.minGx; gx <= range.maxGx; gx++) {
        const plot = this.plots.getPlotAt(gx, gy);
        if (plot) continue; // No wild nature inside citizen plots

        const nature = getTileNatureObject(gx, gy, false);
        if (!nature) continue;

        const screen = this.camera.worldToScreen(nature.wx, nature.wy);
        if (screen.x < -100 || screen.x > W + 100 || screen.y < -100 || screen.y > H + 100) continue;

        entities.push({
          depth: nature.wy,
          render: (ctx, z) => {
            this.drawNatureObject(ctx, nature, screen.x, screen.y, z);
          },
        });
      }
    }
  }

  private drawNatureObject(
    ctx: CanvasRenderingContext2D,
    nature: NatureObject,
    sx: number,
    sy: number,
    z: number,
  ): void {
    switch (nature.type) {
      case 'tree_oak': {
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 2 * z, 14 * z, 6 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Trunk
        ctx.fillStyle = PALETTE.trunk;
        ctx.fillRect(sx - 3 * z, sy - 18 * z, 6 * z, 18 * z);

        // Layered leafy canopy
        const cy = sy - 28 * z;
        ctx.fillStyle = PALETTE.canopy_oak_shadow;
        ctx.beginPath();
        ctx.arc(sx, cy + 3 * z, 18 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = PALETTE.canopy_oak;
        ctx.beginPath();
        ctx.arc(sx - 2 * z, cy - 2 * z, 16 * z, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'tree_pine': {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 2 * z, 11 * z, 5 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = PALETTE.trunk;
        ctx.fillRect(sx - 2.5 * z, sy - 12 * z, 5 * z, 12 * z);

        // Pine tiers
        const p1 = sy - 12 * z;
        ctx.fillStyle = PALETTE.canopy_pine_shadow;
        ctx.beginPath();
        ctx.moveTo(sx - 14 * z, p1);
        ctx.lineTo(sx, p1 - 16 * z);
        ctx.lineTo(sx + 14 * z, p1);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = PALETTE.canopy_pine;
        ctx.beginPath();
        ctx.moveTo(sx - 11 * z, p1 - 10 * z);
        ctx.lineTo(sx, p1 - 28 * z);
        ctx.lineTo(sx + 11 * z, p1 - 10 * z);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'bush': {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 1 * z, 9 * z, 4 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = PALETTE.bush;
        ctx.beginPath();
        ctx.arc(sx - 3 * z, sy - 6 * z, 6 * z, 0, Math.PI * 2);
        ctx.arc(sx + 3 * z, sy - 6 * z, 6 * z, 0, Math.PI * 2);
        ctx.arc(sx, sy - 8 * z, 6.5 * z, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'flowers': {
        const colors = [PALETTE.flower_petal_1, PALETTE.flower_petal_2, PALETTE.flower_petal_3];
        const color = colors[nature.variant % colors.length];

        ctx.fillStyle = PALETTE.flower_stem;
        ctx.fillRect(sx - 1 * z, sy - 6 * z, 2 * z, 6 * z);

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(sx, sy - 7 * z, 3 * z, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'rock': {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 8 * z, 3.5 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = PALETTE.rock_shadow;
        ctx.beginPath();
        ctx.arc(sx + 1 * z, sy - 4 * z, 6 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = PALETTE.rock_body;
        ctx.beginPath();
        ctx.arc(sx - 1 * z, sy - 5 * z, 5.5 * z, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Overlays (Hover & Selection)
  // ---------------------------------------------------------------------------

  private drawOverlays(ctx: CanvasRenderingContext2D, z: number): void {
    // 1. Hovered Plot highlight
    if (this.hoveredPlot) {
      const p = this.hoveredPlot;
      const sMin = this.camera.worldToScreen(p.worldMinX, p.worldMinY);
      const w = (p.worldMaxX - p.worldMinX) * z;
      const h = (p.worldMaxY - p.worldMinY) * z;

      ctx.save();
      ctx.fillStyle = PALETTE.hover_fill;
      ctx.fillRect(sMin.x, sMin.y, w, h);

      ctx.strokeStyle = PALETTE.hover_border;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(sMin.x, sMin.y, w, h);
      ctx.restore();
    } else if (this.hoveredGrid) {
      // Hovered empty tile
      const wx = this.hoveredGrid.gx * TILE_WIDTH;
      const wy = this.hoveredGrid.gy * TILE_HEIGHT;
      const s = this.camera.worldToScreen(wx, wy);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(s.x, s.y, TILE_WIDTH * z, TILE_HEIGHT * z);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(s.x, s.y, TILE_WIDTH * z, TILE_HEIGHT * z);
    }

    // 2. Selected Plot highlight
    if (this.selectedPlot) {
      const p = this.selectedPlot;
      const sMin = this.camera.worldToScreen(p.worldMinX, p.worldMinY);
      const w = (p.worldMaxX - p.worldMinX) * z;
      const h = (p.worldMaxY - p.worldMinY) * z;

      ctx.save();
      ctx.fillStyle = PALETTE.select_fill;
      ctx.fillRect(sMin.x, sMin.y, w, h);

      ctx.strokeStyle = PALETTE.select_border;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(sMin.x, sMin.y, w, h);
      ctx.restore();
    }
  }

  private drawAmbientParticles(ctx: CanvasRenderingContext2D): void {
    const W = this.camera.viewportWidth;
    const H = this.camera.viewportHeight;

    ctx.save();
    for (const p of this.ambientParticles) {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x > W + 10) p.x = -10;
      if (p.y > H + 10) p.y = -10;

      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
