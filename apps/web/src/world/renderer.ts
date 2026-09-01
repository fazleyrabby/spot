/**
 * Renderer — Top-Down City & Urban District Canvas2D Renderer for Spot World.
 *
 * Visual Features:
 *  - Dark asphalt streets with white lane stripes and zebra crosswalks.
 *  - Paved sidewalks, urban plazas, and green park squares.
 *  - Streetlamps with warm ambient golden light halos on the dark streets.
 *  - Urban furniture: Benches, vending machines, tree planters, cafe tables.
 *  - Chibi citizens and player walking along sidewalks and pedestrian plazas.
 *  - Unified depth sorting (Y-sort) for all entities.
 */

import { Camera } from './camera.js';
import {
  TILE_WIDTH,
  TILE_HEIGHT,
  getVisibleGridRange,
} from '@spot/world';
import {
  getCityTileType,
  getCityProp,
  type CityProp,
  type UrbanTileType,
} from './terrain-generator.js';
import { SpriteManager, URBAN_TILES } from './sprite-manager.js';
import { PlayerManager } from './player-manager.js';
import { MonumentManager } from './monument-manager.js';
import { PlotManager, type Plot } from './plot-manager.js';

// ---------------------------------------------------------------------------
// Urban Palette (Sleek Dark Asphalt, Amber Lighting, Jade Accents)
// ---------------------------------------------------------------------------

const CITY_PALETTE = {
  // Asphalt & Streets
  asphalt_base: '#171b21',
  asphalt_edge: '#12151a',
  lane_white: 'rgba(248, 250, 252, 0.85)',
  lane_yellow: '#f59e0b',
  crosswalk_bar: 'rgba(255, 255, 255, 0.90)',

  // Sidewalks & Plazas
  sidewalk_base: '#27313f',
  sidewalk_edge: '#1e2632',
  sidewalk_seam: 'rgba(255, 255, 255, 0.06)',
  plaza_base: '#222a36',
  plaza_accent: '#2a3443',
  park_grass: '#1b3822',
  park_accent: '#23472c',

  // Lighting
  lamp_glow_inner: 'rgba(251, 191, 36, 0.32)',
  lamp_glow_outer: 'rgba(251, 191, 36, 0.0)',
  neon_vending_glow: 'rgba(56, 189, 248, 0.28)',

  // Overlays
  hover_border: '#f59e0b',
  hover_fill: 'rgba(245, 158, 11, 0.12)',
  select_border: '#38bdf8',
  select_fill: 'rgba(56, 189, 248, 0.18)',
};

interface RenderableEntity {
  depth: number;
  render: (ctx: CanvasRenderingContext2D, z: number) => void;
}

interface LightSource {
  wx: number;
  wy: number;
  radius: number;
  color: string;
}

interface CityParticle {
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

  hoveredGrid: { gx: number; gy: number } | null = null;
  hoveredPlot: Plot | null = null;
  selectedPlot: Plot | null = null;

  private cityParticles: CityParticle[] = [];
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

    this.initCityParticles();
  }

  private initCityParticles(): void {
    const colors = ['#fef08a', '#bae6fd', '#86efac', '#fbcfe8'];
    for (let i = 0; i < 25; i++) {
      this.cityParticles.push({
        x: Math.random() * (this.canvas.width || 800),
        y: Math.random() * (this.canvas.height || 600),
        vx: (Math.random() - 0.5) * 0.3 + 0.15,
        vy: -0.1 - Math.random() * 0.25,
        size: 1 + Math.random() * 1.8,
        alpha: 0.15 + Math.random() * 0.45,
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

    // 1. Dark city night sky clear
    ctx.fillStyle = '#0b0e13';
    ctx.fillRect(0, 0, W, H);

    // 2. Visible grid bounds
    const bounds = camera.getWorldBounds();
    const range = getVisibleGridRange(bounds.left, bounds.top, bounds.right, bounds.bottom, 2);

    // 3. Ground Layer (Asphalt, Crosswalks, Sidewalks, Plazas)
    this.drawCityGround(ctx, range, z);

    // 4. Collect Depth-Sorted Entities & Street Lights
    const entities: RenderableEntity[] = [];
    const lights: LightSource[] = [];

    // 4a. Urban Props & Street Lamps
    this.collectCityProps(range, entities, lights);

    // 4b. Citizen Chibi Characters
    const allCitizens = this.monuments.getAllEntities();
    for (const ent of allCitizens) {
      const screen = camera.worldToScreen(ent.wx, ent.wy);
      if (screen.x < -80 || screen.x > W + 80 || screen.y < -80 || screen.y > H + 80) continue;

      const isHovered = this.hoveredPlot?.centerX === ent.spot.x && this.hoveredPlot?.centerY === ent.spot.y;
      const isSelected = this.selectedPlot?.centerX === ent.spot.x && this.selectedPlot?.centerY === ent.spot.y;
      const distToPlayer = Math.hypot(ent.wx - this.player.wx, ent.wy - this.player.wy);
      const isNearby = z >= 1.1 && distToPlayer < 120;

      const showNameTag = isHovered || isSelected || isNearby;

      entities.push({
        depth: ent.wy,
        render: (c, currentZoom) => {
          this.monuments.renderEntity(c, ent, screen.x, screen.y, currentZoom, this.sprites, showNameTag);
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

    // 5. Draw Ambient Radial Light Glows on the streets under entities
    this.drawStreetLighting(ctx, lights, z);

    // 6. Unified Depth Sort (Y ascending)
    entities.sort((a, b) => a.depth - b.depth);

    // 7. Draw all sorted physical entities
    for (const entity of entities) {
      entity.render(ctx, z);
    }

    // 8. Hover & Selection Overlays
    this.drawOverlays(ctx, z);

    // 9. Floating particles (night motes & sparks)
    this.drawCityParticles(ctx);
  }

  // ---------------------------------------------------------------------------
  // City Ground Rendering
  // ---------------------------------------------------------------------------

  private drawCityGround(
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
        const tileType = getCityTileType(gx, gy);

        const dx = Math.floor(screen.x);
        const dy = Math.floor(screen.y);
        const dw = Math.ceil(tw);
        const dh = Math.ceil(th);

        switch (tileType) {
          case 'road_asphalt': {
            ctx.fillStyle = CITY_PALETTE.asphalt_base;
            ctx.fillRect(dx, dy, dw, dh);
            break;
          }

          case 'road_h_stripe': {
            ctx.fillStyle = CITY_PALETTE.asphalt_base;
            ctx.fillRect(dx, dy, dw, dh);
            // Dashed center line
            if (gx % 2 === 0) {
              ctx.fillStyle = CITY_PALETTE.lane_white;
              ctx.fillRect(dx + dw * 0.15, dy + dh * 0.45, dw * 0.7, Math.max(1, 2 * z));
            }
            break;
          }

          case 'road_v_stripe': {
            ctx.fillStyle = CITY_PALETTE.asphalt_base;
            ctx.fillRect(dx, dy, dw, dh);
            // Dashed vertical center line
            if (gy % 2 === 0) {
              ctx.fillStyle = CITY_PALETTE.lane_white;
              ctx.fillRect(dx + dw * 0.45, dy + dh * 0.15, Math.max(1, 2 * z), dh * 0.7);
            }
            break;
          }

          case 'crosswalk': {
            ctx.fillStyle = CITY_PALETTE.asphalt_base;
            ctx.fillRect(dx, dy, dw, dh);
            // Zebra bars
            ctx.fillStyle = CITY_PALETTE.crosswalk_bar;
            const barCount = 4;
            const barW = dw / (barCount * 2);
            for (let b = 0; b < barCount; b++) {
              ctx.fillRect(dx + (b * 2 + 0.5) * barW, dy + dh * 0.1, barW, dh * 0.8);
            }
            break;
          }

          case 'sidewalk': {
            ctx.fillStyle = CITY_PALETTE.sidewalk_base;
            ctx.fillRect(dx, dy, dw, dh);
            // Pavement seams
            ctx.fillStyle = CITY_PALETTE.sidewalk_seam;
            ctx.fillRect(dx, dy, dw, 1);
            ctx.fillRect(dx, dy, 1, dh);
            break;
          }

          case 'plaza_paving': {
            const isAlt = (gx + gy) % 2 === 0;
            ctx.fillStyle = isAlt ? CITY_PALETTE.plaza_base : CITY_PALETTE.plaza_accent;
            ctx.fillRect(dx, dy, dw, dh);
            break;
          }

          case 'park_grass': {
            const isAlt = (gx + gy) % 2 === 0;
            ctx.fillStyle = isAlt ? CITY_PALETTE.park_grass : CITY_PALETTE.park_accent;
            ctx.fillRect(dx, dy, dw, dh);
            break;
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // City Props & Street Lights Collection
  // ---------------------------------------------------------------------------

  private collectCityProps(
    range: { minGx: number; maxGx: number; minGy: number; maxGy: number },
    entities: RenderableEntity[],
    lights: LightSource[],
  ): void {
    const W = this.camera.viewportWidth;
    const H = this.camera.viewportHeight;

    for (let gy = range.minGy; gy <= range.maxGy; gy++) {
      for (let gx = range.minGx; gx <= range.maxGx; gx++) {
        const prop = getCityProp(gx, gy, false);
        if (!prop) continue;

        const screen = this.camera.worldToScreen(prop.wx, prop.wy);
        if (screen.x < -60 || screen.x > W + 60 || screen.y < -60 || screen.y > H + 60) continue;

        // Streetlight glow
        if (prop.hasLight) {
          lights.push({
            wx: prop.wx,
            wy: prop.wy - 18,
            radius: prop.type === 'street_lamp' ? 64 : 32,
            color: prop.type === 'street_lamp' ? 'rgba(251, 191, 36, 0.28)' : 'rgba(56, 189, 248, 0.22)',
          });
        }

        entities.push({
          depth: prop.wy,
          render: (ctx, z) => {
            this.drawCityProp(ctx, prop, screen.x, screen.y, z);
          },
        });
      }
    }
  }

  private drawCityProp(
    ctx: CanvasRenderingContext2D,
    prop: CityProp,
    sx: number,
    sy: number,
    z: number,
  ): void {
    switch (prop.type) {
      case 'street_lamp': {
        // Base shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 4 * z, 2 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pole
        ctx.fillStyle = '#475569';
        ctx.fillRect(sx - 1.5 * z, sy - 24 * z, 3 * z, 24 * z);

        // Lamp head
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(sx - 4 * z, sy - 26 * z, 8 * z, 3 * z);

        // Warm glowing bulb
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(sx, sy - 23 * z, 2.5 * z, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'bench': {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 8 * z, 3 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Metal / Wood Bench
        ctx.fillStyle = '#64748b';
        ctx.fillRect(sx - 6 * z, sy - 4 * z, 2 * z, 4 * z);
        ctx.fillRect(sx + 4 * z, sy - 4 * z, 2 * z, 4 * z);

        ctx.fillStyle = '#b45309';
        ctx.fillRect(sx - 7 * z, sy - 6 * z, 14 * z, 3 * z);
        ctx.fillRect(sx - 7 * z, sy - 10 * z, 14 * z, 2.5 * z);
        break;
      }

      case 'vending_machine': {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 7 * z, 3.5 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Machine body
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.roundRect(sx - 6 * z, sy - 18 * z, 12 * z, 18 * z, 2 * z);
        ctx.fill();

        // Glass display window with glowing beverages
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(sx - 4.5 * z, sy - 16 * z, 9 * z, 9 * z);

        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(sx - 3.5 * z, sy - 15 * z, 2 * z, 3 * z);
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(sx - 0.5 * z, sy - 15 * z, 2 * z, 3 * z);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(sx + 2 * z, sy - 15 * z, 2 * z, 3 * z);

        // Coin slot & drink dispenser
        ctx.fillStyle = '#0369a1';
        ctx.fillRect(sx - 4 * z, sy - 5 * z, 8 * z, 3 * z);
        break;
      }

      case 'tree_planter': {
        // Square curb planter box
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.roundRect(sx - 8 * z, sy - 4 * z, 16 * z, 6 * z, 1.5 * z);
        ctx.fill();

        // Dark mulch
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(sx - 6.5 * z, sy - 3.5 * z, 13 * z, 4 * z);

        // Trunk
        ctx.fillStyle = '#5c3a1e';
        ctx.fillRect(sx - 2 * z, sy - 16 * z, 4 * z, 14 * z);

        // Round city foliage canopy
        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.arc(sx, sy - 22 * z, 12 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(sx - 1.5 * z, sy - 24 * z, 10 * z, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'bush_box': {
        ctx.fillStyle = '#334155';
        ctx.fillRect(sx - 6 * z, sy - 3 * z, 12 * z, 4 * z);

        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.arc(sx - 2 * z, sy - 6 * z, 5 * z, 0, Math.PI * 2);
        ctx.arc(sx + 2 * z, sy - 6 * z, 5 * z, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'fire_hydrant': {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(sx - 2.5 * z, sy - 8 * z, 5 * z, 8 * z);
        ctx.fillRect(sx - 4 * z, sy - 5 * z, 8 * z, 2.5 * z);
        ctx.fillStyle = '#f87171';
        ctx.beginPath();
        ctx.arc(sx, sy - 8 * z, 2.5 * z, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'trash_can': {
        ctx.fillStyle = '#475569';
        ctx.fillRect(sx - 3.5 * z, sy - 8 * z, 7 * z, 8 * z);
        ctx.fillStyle = '#334155';
        ctx.fillRect(sx - 4.5 * z, sy - 9 * z, 9 * z, 2 * z);
        break;
      }

      case 'cafe_table': {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 7 * z, 3 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Table
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(sx - 1 * z, sy - 7 * z, 2 * z, 7 * z);
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 7 * z, 6 * z, 3 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Parasol
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(sx, sy - 16 * z, 10 * z, Math.PI, 0);
        ctx.fill();
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Street Ambient Lighting Engine
  // ---------------------------------------------------------------------------

  private drawStreetLighting(
    ctx: CanvasRenderingContext2D,
    lights: LightSource[],
    z: number,
  ): void {
    ctx.save();
    for (const light of lights) {
      const s = this.camera.worldToScreen(light.wx, light.wy);
      const rad = light.radius * z;

      const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, rad);
      grad.addColorStop(0, light.color);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(s.x, s.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Overlays (Hover & Selection)
  // ---------------------------------------------------------------------------

  private drawOverlays(ctx: CanvasRenderingContext2D, z: number): void {
    if (this.hoveredPlot) {
      const p = this.hoveredPlot;
      const sMin = this.camera.worldToScreen(p.worldMinX, p.worldMinY);
      const w = (p.worldMaxX - p.worldMinX) * z;
      const h = (p.worldMaxY - p.worldMinY) * z;

      ctx.save();
      ctx.fillStyle = CITY_PALETTE.hover_fill;
      ctx.fillRect(sMin.x, sMin.y, w, h);

      ctx.strokeStyle = CITY_PALETTE.hover_border;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(sMin.x, sMin.y, w, h);
      ctx.restore();
    } else if (this.hoveredGrid) {
      const wx = this.hoveredGrid.gx * TILE_WIDTH;
      const wy = this.hoveredGrid.gy * TILE_HEIGHT;
      const s = this.camera.worldToScreen(wx, wy);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(s.x, s.y, TILE_WIDTH * z, TILE_HEIGHT * z);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(s.x, s.y, TILE_WIDTH * z, TILE_HEIGHT * z);
    }

    if (this.selectedPlot) {
      const p = this.selectedPlot;
      const sMin = this.camera.worldToScreen(p.worldMinX, p.worldMinY);
      const w = (p.worldMaxX - p.worldMinX) * z;
      const h = (p.worldMaxY - p.worldMinY) * z;

      ctx.save();
      ctx.fillStyle = CITY_PALETTE.select_fill;
      ctx.fillRect(sMin.x, sMin.y, w, h);

      ctx.strokeStyle = CITY_PALETTE.select_border;
      ctx.lineWidth = 2.2;
      ctx.strokeRect(sMin.x, sMin.y, w, h);
      ctx.restore();
    }
  }

  private drawCityParticles(ctx: CanvasRenderingContext2D): void {
    const W = this.camera.viewportWidth;
    const H = this.camera.viewportHeight;

    ctx.save();
    for (const p of this.cityParticles) {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10;

      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
