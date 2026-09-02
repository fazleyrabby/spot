/**
 * Renderer — Top-Down Diverse City, Mountain Ridge, Railway, Coastal Boardwalk & Moonlit Ocean Canvas2D Renderer.
 *
 * Geographical Structure:
 * - Northern Mountain Ridge (snow peaks & pines)
 * - Northern High-Speed Cyber Railway (autonomous bullet train with headlights)
 * - 5 Urban Districts (Grand Plaza, Central Park & Lake, Downtown, Cafe Promenade, Zen Gardens)
 * - Coastal Timber Boardwalk (gy: 89..90) with nautical lanterns
 * - Southern Moonlit Beach (gy: 91..94) with bonfire, loungers & palms
 * - Southern Midnight Ocean (gy: 95..99) with bioluminescent surf waves
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
} from './terrain-generator.js';
import { SpriteManager } from './sprite-manager.js';
import { PlayerManager } from './player-manager.js';
import { MonumentManager } from './monument-manager.js';
import { PlotManager } from './plot-manager.js';
import { TrainManager } from './train-manager.js';
import { SkyManager } from './sky-manager.js';
import { NPCManager } from './npc-manager.js';
import type { OccupiedSpotSummary } from '@spot/shared';

// ---------------------------------------------------------------------------
// Cohesive Retro/Cyber Palette Definitions
// ---------------------------------------------------------------------------

const PALETTES = {
  // Mountains
  mountain_rock_1: '#1e293b',
  mountain_rock_2: '#334155',
  mountain_snow: '#f1f5f9',

  // Railway
  rail_ballast: '#181e26',
  rail_sleeper: '#451a03',
  rail_steel: '#cbd5e1',
  rail_shine: '#f8fafc',

  // Asphalt & Streets
  asphalt: '#151921',
  lane_white: 'rgba(248, 250, 252, 0.85)',
  crosswalk_bar: 'rgba(255, 255, 255, 0.92)',

  // Sidewalks
  sidewalk_base: '#262f3c',
  sidewalk_seam: 'rgba(255, 255, 255, 0.05)',

  // District Pavements
  grand_plaza_1: '#202834',
  grand_plaza_2: '#273140',

  terracotta_1: '#3d251e',
  terracotta_2: '#4a2c23',

  zen_paving_1: '#252930',
  zen_paving_2: '#2d333b',

  park_grass_1: '#16361e',
  park_grass_2: '#1c4226',
  water_pond: '#0c4a6e',

  // Coastal Boardwalk & Moonlit Beach (Cohesive with Terracotta & Slate)
  boardwalk_1: '#2e1c14',
  boardwalk_2: '#382319',
  boardwalk_seam: 'rgba(0, 0, 0, 0.35)',

  beach_sand_1: '#26201b',
  beach_sand_2: '#2e2722',
  ocean_deep: '#06101d',
  ocean_surf: '#0a1c30',
  wave_foam: 'rgba(186, 230, 253, 0.75)',

  // Target Selection Rings
  hover_ring: 'rgba(245, 158, 11, 0.85)',
  hover_glow: 'rgba(245, 158, 11, 0.22)',
  select_ring: '#38bdf8',
  select_glow: 'rgba(56, 189, 248, 0.28)',
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
  readonly train: TrainManager;
  readonly sky: SkyManager;
  readonly npcs: NPCManager;
  multiplayer?: import('./multiplayer-sync.js').MultiplayerSync;

  hoveredCitizen: OccupiedSpotSummary | null = null;
  hoveredGrid: { gx: number; gy: number } | null = null;
  selectedCitizen: OccupiedSpotSummary | null = null;
  gpsTarget: { name: string; wx: number; wy: number } | null = null;
  timeOfDay: 'day' | 'twilight' | 'night' = 'night';

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
    this.train = new TrainManager();
    this.sky = new SkyManager();
    this.npcs = new NPCManager();

    this.initCityParticles();
  }

  private initCityParticles(): void {
    const colors = ['#fef08a', '#bae6fd', '#fbcfe8', '#86efac'];
    for (let i = 0; i < 30; i++) {
      this.cityParticles.push({
        x: Math.random() * (this.canvas.width || 800),
        y: Math.random() * (this.canvas.height || 600),
        vx: (Math.random() - 0.5) * 0.35 + 0.15,
        vy: -0.12 - Math.random() * 0.25,
        size: 1 + Math.random() * 2,
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
    this.train.tick(this.player.wy);
    this.sky.tick(this.player.wx, this.player.wy);
    this.npcs.tick();
    this.player.speedMultiplier = this.npcs.getSpeedMultiplier();
    this.multiplayer?.broadcastMovement(
      this.player.wx,
      this.player.wy,
      this.player.direction,
      this.player.state,
      this.player.chatBubble?.text,
    );

    this.draw();
  };

  private draw(): void {
    const { ctx, camera } = this;
    const W = camera.viewportWidth;
    const H = camera.viewportHeight;
    const z = camera.zoom;

    // 1. Sky / World background
    if (this.timeOfDay === 'day') {
      ctx.fillStyle = '#0f172a';
    } else if (this.timeOfDay === 'twilight') {
      ctx.fillStyle = '#1e1b4b';
    } else {
      ctx.fillStyle = '#060a0f';
    }
    ctx.fillRect(0, 0, W, H);

    // 2. Visible grid bounds
    const bounds = camera.getWorldBounds();
    const range = getVisibleGridRange(bounds.left, bounds.top, bounds.right, bounds.bottom, 2);

    // 3. Ground Layer (Mountains, Railway, Districts, Boardwalk, Beach, Ocean)
    this.drawCityGround(ctx, range, z);

    // 3b. Atmospheric Ground Shadows & Wildlife
    this.sky.renderGroundShadows(ctx, camera, this.timeOfDay);
    this.sky.renderGroundedWildlife(ctx, camera);

    // 4. Collect Depth-Sorted Entities & Street Lights
    const entities: RenderableEntity[] = [];
    const lights: LightSource[] = [];

    // 4a. Urban Props & Street Lamps
    this.collectCityProps(range, entities, lights);

    // 4b. Passing Cyber Bullet Train
    if (this.train.active) {
      entities.push({
        depth: this.train.trackWy + 10,
        render: (c, currentZoom) => {
          this.train.render(c, 0, this.camera, currentZoom);
        },
      });
    }

    // 4c. Citizen Chibi Characters
    const allCitizens = this.monuments.getAllEntities();
    for (const ent of allCitizens) {
      const screen = camera.worldToScreen(ent.wx, ent.wy);
      if (screen.x < -80 || screen.x > W + 80 || screen.y < -80 || screen.y > H + 80) continue;

      const isHovered = this.hoveredCitizen?.x === ent.spot.x && this.hoveredCitizen?.y === ent.spot.y;
      const isSelected = this.selectedCitizen?.x === ent.spot.x && this.selectedCitizen?.y === ent.spot.y;

      const showNameTag = isHovered || isSelected;

      if (isHovered || isSelected) {
        entities.push({
          depth: ent.wy - 0.1,
          render: (c, currentZoom) => {
            const ringRadius = 5.5 * currentZoom;
            c.save();
            c.fillStyle = isSelected ? PALETTES.select_glow : PALETTES.hover_glow;
            c.beginPath();
            c.ellipse(screen.x, screen.y, ringRadius, ringRadius * 0.45, 0, 0, Math.PI * 2);
            c.fill();

            c.strokeStyle = isSelected ? PALETTES.select_ring : PALETTES.hover_ring;
            c.lineWidth = 1.2;
            c.beginPath();
            c.ellipse(screen.x, screen.y, ringRadius, ringRadius * 0.45, 0, 0, Math.PI * 2);
            c.stroke();
            c.restore();
          },
        });
      }

      entities.push({
        depth: ent.wy,
        render: (c, currentZoom) => {
          this.monuments.renderEntity(c, ent, screen.x, screen.y, currentZoom, this.sprites, showNameTag);
        },
      });
    }

    // 4d. Player Character
    const playerScreen = camera.worldToScreen(this.player.wx, this.player.wy);
    entities.push({
      depth: this.player.wy,
      render: (c, currentZoom) => {
        this.player.render(c, playerScreen.x, playerScreen.y, currentZoom);
      },
    });

    // 5. Draw Ambient Radial Light Glows on the ground
    if (this.timeOfDay !== 'day') {
      this.drawStreetLighting(ctx, lights, z);
    }

    // 6. Unified Depth Sort (Y ascending)
    entities.sort((a, b) => a.depth - b.depth);

    // 7. Draw all sorted physical entities
    for (const entity of entities) {
      entity.render(ctx, z);
    }

    // 7b. Street NPCs (Kiro the Barista & Prof. Barnaby)
    this.npcs.renderNPCs(ctx, camera, this.player.wx, this.player.wy);

    // 8. Time of Day Atmospheric Wash
    if (this.timeOfDay === 'day') {
      ctx.save();
      ctx.fillStyle = 'rgba(251, 191, 36, 0.05)';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    } else if (this.timeOfDay === 'twilight') {
      ctx.save();
      const sunsetGrad = ctx.createLinearGradient(0, 0, 0, H);
      sunsetGrad.addColorStop(0, 'rgba(244, 63, 94, 0.14)');
      sunsetGrad.addColorStop(1, 'rgba(147, 51, 234, 0.12)');
      ctx.fillStyle = sunsetGrad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // 9. Floating ambient particles
    this.drawCityParticles(ctx);

    // 9b. Sky Layer (Drifting Clouds, Cyber Blimp & High-Altitude Birds)
    this.sky.renderSkyLayer(ctx, camera, this.timeOfDay);

    // 10. On-Screen GPS Waypoint Indicator
    this.drawGpsWaypoint(ctx);
  }

  private drawGpsWaypoint(ctx: CanvasRenderingContext2D): void {
    if (!this.gpsTarget) return;

    const W = this.camera.viewportWidth;
    const H = this.camera.viewportHeight;
    const screenTarget = this.camera.worldToScreen(this.gpsTarget.wx, this.gpsTarget.wy);

    const distTiles = Math.round(
      Math.hypot(this.player.wx - this.gpsTarget.wx, this.player.wy - this.gpsTarget.wy) / TILE_WIDTH
    );

    if (screenTarget.x > 80 && screenTarget.x < W - 80 && screenTarget.y > 80 && screenTarget.y < H - 80 && distTiles <= 2) {
      return;
    }

    const margin = 48;
    const cx = W / 2;
    const cy = H / 2;
    const angle = Math.atan2(screenTarget.y - cy, screenTarget.x - cx);

    let ix = cx + Math.cos(angle) * (W / 2 - margin);
    let iy = cy + Math.sin(angle) * (H / 2 - margin);
    ix = Math.max(margin, Math.min(W - margin, ix));
    iy = Math.max(margin + 40, Math.min(H - margin - 50, iy));

    ctx.save();

    const text = `🧭 ${this.gpsTarget.name} • ${distTiles} tiles`;
    ctx.font = `bold 11px 'Outfit', sans-serif`;
    const textW = ctx.measureText(text).width;
    const pillW = textW + 24;
    const pillH = 28;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.beginPath();
    ctx.roundRect(ix - pillW / 2, iy - pillH / 2, pillW, pillH, 14);
    ctx.fill();

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.shadowColor = 'rgba(245, 158, 11, 0.5)';
    ctx.shadowBlur = 10;

    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, ix, iy);

    ctx.save();
    ctx.translate(ix, iy);
    ctx.rotate(angle);
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(pillW / 2 + 2, -4);
    ctx.lineTo(pillW / 2 + 9, 0);
    ctx.lineTo(pillW / 2 + 2, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // City & Geography Ground Rendering
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
          // ── Northern Mountains ─────────────────────────────────────────────
          case 'mountain_rock': {
            const isAlt = (gx + gy) % 2 === 0;
            ctx.fillStyle = isAlt ? PALETTES.mountain_rock_1 : PALETTES.mountain_rock_2;
            ctx.fillRect(dx, dy, dw, dh);
            break;
          }

          case 'mountain_snow': {
            ctx.fillStyle = PALETTES.mountain_rock_1;
            ctx.fillRect(dx, dy, dw, dh);
            ctx.fillStyle = PALETTES.mountain_snow;
            ctx.beginPath();
            ctx.moveTo(dx, dy + dh);
            ctx.lineTo(dx + dw / 2, dy);
            ctx.lineTo(dx + dw, dy + dh);
            ctx.closePath();
            ctx.fill();
            break;
          }

          // ── Northern Railway Track ────────────────────────────────────────
          case 'railway_ballast': {
            ctx.fillStyle = PALETTES.rail_ballast;
            ctx.fillRect(dx, dy, dw, dh);

            const sleeperCount = 3;
            const slW = dw / sleeperCount;
            ctx.fillStyle = PALETTES.rail_sleeper;
            for (let s = 0; s < sleeperCount; s++) {
              ctx.fillRect(dx + s * slW + 2 * z, dy + 2 * z, slW - 4 * z, dh - 4 * z);
            }

            ctx.fillStyle = PALETTES.rail_steel;
            ctx.fillRect(dx, dy + dh * 0.28, dw, Math.max(1, 2.5 * z));
            ctx.fillRect(dx, dy + dh * 0.72, dw, Math.max(1, 2.5 * z));

            ctx.fillStyle = PALETTES.rail_shine;
            ctx.fillRect(dx, dy + dh * 0.28, dw, Math.max(1, 0.8 * z));
            ctx.fillRect(dx, dy + dh * 0.72, dw, Math.max(1, 0.8 * z));

            // Southern Perimeter Safety Guardrail (gy === -2)
            if (gy === -2) {
              ctx.fillStyle = '#0f172a';
              ctx.fillRect(dx, dy + dh - 4 * z, dw, 4 * z);

              ctx.fillStyle = '#475569';
              ctx.fillRect(dx, dy + dh - 7 * z, dw, 3 * z);

              // Hazard warning stripes
              ctx.fillStyle = '#f59e0b';
              ctx.fillRect(dx + 2 * z, dy + dh - 6.5 * z, 4 * z, 2 * z);
              ctx.fillRect(dx + dw * 0.5, dy + dh - 6.5 * z, 4 * z, 2 * z);

              // Heavy security fence posts
              ctx.fillStyle = '#1e293b';
              ctx.fillRect(dx, dy + dh - 9 * z, 2.5 * z, 9 * z);
              ctx.fillRect(dx + dw - 2.5 * z, dy + dh - 9 * z, 2.5 * z, 9 * z);
            }
            break;
          }

          // ── Coastal Timber Boardwalk (gy: 89..90) ─────────────────────────
          case 'boardwalk': {
            const isAlt = (gx + gy) % 2 === 0;
            ctx.fillStyle = isAlt ? PALETTES.boardwalk_1 : PALETTES.boardwalk_2;
            ctx.fillRect(dx, dy, dw, dh);

            // Horizontal wood plank seams
            ctx.fillStyle = PALETTES.boardwalk_seam;
            ctx.fillRect(dx, dy + dh * 0.33, dw, 1);
            ctx.fillRect(dx, dy + dh * 0.66, dw, 1);
            break;
          }

          // ── Moonlit Beach & Midnight Ocean (Cohesive & Atmospheric) ────────
          case 'beach_sand': {
            const isAlt = (gx + gy) % 2 === 0;
            ctx.fillStyle = isAlt ? PALETTES.beach_sand_1 : PALETTES.beach_sand_2;
            ctx.fillRect(dx, dy, dw, dh);
            break;
          }

          case 'ocean_surf': {
            // Wet Sand base
            ctx.fillStyle = PALETTES.beach_sand_1;
            ctx.fillRect(dx, dy, dw, dh);

            // Rolling animated wave tide
            const wave = Math.sin(this.tick * 0.045 + gx * 0.4) * 0.35;
            const waterHeight = (0.55 + wave) * dh;

            ctx.fillStyle = PALETTES.ocean_surf;
            ctx.fillRect(dx, dy + dh - waterHeight, dw, waterHeight);

            // Soft translucent wave foam
            ctx.fillStyle = PALETTES.wave_foam;
            ctx.fillRect(dx, dy + dh - waterHeight, dw, Math.max(1.5, 2.8 * z));
            break;
          }

          case 'ocean_deep': {
            ctx.fillStyle = PALETTES.ocean_deep;
            ctx.fillRect(dx, dy, dw, dh);

            // Bioluminescent oceanic ripple sparkles
            const sparkle = Math.sin(this.tick * 0.04 + gx * 0.6 + gy * 0.6);
            if (sparkle > 0.45) {
              ctx.fillStyle = 'rgba(56, 189, 248, 0.32)';
              ctx.fillRect(dx + dw * 0.25, dy + dh * 0.4, dw * 0.5, Math.max(1, 1.6 * z));
            }
            break;
          }

          // ── Urban Roadways ────────────────────────────────────────────────
          case 'road_asphalt': {
            ctx.fillStyle = PALETTES.asphalt;
            ctx.fillRect(dx, dy, dw, dh);
            break;
          }

          case 'road_h_stripe': {
            ctx.fillStyle = PALETTES.asphalt;
            ctx.fillRect(dx, dy, dw, dh);
            if (gx % 2 === 0) {
              ctx.fillStyle = PALETTES.lane_white;
              ctx.fillRect(dx + dw * 0.15, dy + dh * 0.45, dw * 0.7, Math.max(1, 2 * z));
            }
            break;
          }

          case 'road_v_stripe': {
            ctx.fillStyle = PALETTES.asphalt;
            ctx.fillRect(dx, dy, dw, dh);
            if (gy % 2 === 0) {
              ctx.fillStyle = PALETTES.lane_white;
              ctx.fillRect(dx + dw * 0.45, dy + dh * 0.15, Math.max(1, 2 * z), dh * 0.7);
            }
            break;
          }

          case 'crosswalk': {
            ctx.fillStyle = PALETTES.asphalt;
            ctx.fillRect(dx, dy, dw, dh);
            ctx.fillStyle = PALETTES.crosswalk_bar;
            const barCount = 4;
            const barW = dw / (barCount * 2);
            for (let b = 0; b < barCount; b++) {
              ctx.fillRect(dx + (b * 2 + 0.5) * barW, dy + dh * 0.1, barW, dh * 0.8);
            }
            break;
          }

          case 'sidewalk': {
            ctx.fillStyle = PALETTES.sidewalk_base;
            ctx.fillRect(dx, dy, dw, dh);
            ctx.fillStyle = PALETTES.sidewalk_seam;
            ctx.fillRect(dx, dy, dw, 1);
            ctx.fillRect(dx, dy, 1, dh);
            break;
          }

          case 'plaza_grand': {
            const isAlt = (gx + gy) % 2 === 0;
            ctx.fillStyle = isAlt ? PALETTES.grand_plaza_1 : PALETTES.grand_plaza_2;
            ctx.fillRect(dx, dy, dw, dh);
            break;
          }

          case 'plaza_terracotta': {
            const isAlt = (gx + gy) % 2 === 0;
            ctx.fillStyle = isAlt ? PALETTES.terracotta_1 : PALETTES.terracotta_2;
            ctx.fillRect(dx, dy, dw, dh);
            break;
          }

          case 'plaza_zen': {
            const isAlt = (gx + gy) % 2 === 0;
            ctx.fillStyle = isAlt ? PALETTES.zen_paving_1 : PALETTES.zen_paving_2;
            ctx.fillRect(dx, dy, dw, dh);
            break;
          }

          case 'park_grass': {
            const isAlt = (gx + gy) % 2 === 0;
            ctx.fillStyle = isAlt ? PALETTES.park_grass_1 : PALETTES.park_grass_2;
            ctx.fillRect(dx, dy, dw, dh);
            break;
          }

          case 'water_pond': {
            ctx.fillStyle = PALETTES.water_pond;
            ctx.fillRect(dx, dy, dw, dh);

            const wave = Math.sin((this.tick * 0.05) + gx * 0.8 + gy * 0.8);
            ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
            ctx.fillRect(dx + dw * 0.2, dy + (0.4 + wave * 0.15) * dh, dw * 0.6, Math.max(1, 1.5 * z));
            break;
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Props & Street Lighting Collection
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
        const prop = getCityProp(gx, gy);
        if (!prop) continue;

        const screen = this.camera.worldToScreen(prop.wx, prop.wy);
        if (screen.x < -70 || screen.x > W + 70 || screen.y < -70 || screen.y > H + 70) continue;

        if (prop.hasLight) {
          lights.push({
            wx: prop.wx,
            wy: prop.wy - 16,
            radius: prop.lightRadius ?? 60,
            color: prop.lightColor ?? 'rgba(251, 191, 36, 0.28)',
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
    const windSway = Math.sin(this.tick * 0.04 + prop.wx * 0.1) * 1.6 * z;

    switch (prop.type) {
      case 'beach_bonfire': {
        // Glowing Beach Bonfire with warm radial light and crackling embers
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 14 * z, 6 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Firewood logs
        ctx.fillStyle = '#451a03';
        ctx.fillRect(sx - 8 * z, sy - 4 * z, 16 * z, 4 * z);
        ctx.fillRect(sx - 4 * z, sy - 6 * z, 8 * z, 4 * z);

        // Dancing flame
        const flameFlicker = Math.sin(this.tick * 0.25) * 2 * z;
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.arc(sx, sy - 8 * z + flameFlicker, 7 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(sx, sy - 10 * z + flameFlicker, 5 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(sx, sy - 11 * z + flameFlicker, 2.5 * z, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'boardwalk_lamp': {
        // Nautical timber lamp post with warm lantern
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 5 * z, 2.5 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#3e2723';
        ctx.fillRect(sx - 1.5 * z, sy - 22 * z, 3 * z, 22 * z);

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect(sx - 3.5 * z, sy - 24 * z, 7 * z, 6 * z, 1.5 * z);
        ctx.fill();

        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(sx, sy - 21 * z, 2.5 * z, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'beach_lounger': {
        // Teak wood beach recliner
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 10 * z, 4 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#451a03';
        ctx.fillRect(sx - 8 * z, sy - 4 * z, 16 * z, 4 * z);

        // White cushioned headrest
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.roundRect(sx - 8 * z, sy - 7 * z, 6 * z, 5 * z, 1.5 * z);
        ctx.fill();
        break;
      }

      case 'palm_tree': {
        // Volumetric Moonlit Palm Tree
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 12 * z, 5 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 4.5 * z;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + 7 * z, sy - 16 * z, sx + 4 * z + windSway, sy - 28 * z);
        ctx.stroke();

        const topX = sx + 4 * z + windSway;
        const topY = sy - 28 * z;

        const frondColors = ['#064e3b', '#047857', '#059669'];
        for (let f = 0; f < 6; f++) {
          const angle = (f * Math.PI) / 3 + windSway * 0.05;
          ctx.strokeStyle = frondColors[f % 3];
          ctx.lineWidth = 3.2 * z;
          ctx.beginPath();
          ctx.moveTo(topX, topY);
          const endX = topX + Math.cos(angle) * 16 * z;
          const endY = topY + Math.sin(angle) * 10 * z + 5 * z;
          ctx.quadraticCurveTo(topX + Math.cos(angle) * 10 * z, topY - 3 * z, endX, endY);
          ctx.stroke();
        }
        break;
      }

      case 'beach_umbrella': {
        // Nautical Navy & Cream Striped Beach Parasol
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.beginPath();
        ctx.ellipse(sx + 2 * z, sy + 2 * z, 10 * z, 4 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.8 * z;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - 2 * z, sy - 18 * z);
        ctx.stroke();

        ctx.fillStyle = '#1e3a8a'; // Navy
        ctx.beginPath();
        ctx.arc(sx - 2 * z, sy - 18 * z, 12 * z, Math.PI, 0);
        ctx.fill();

        ctx.fillStyle = '#f8fafc'; // Cream
        ctx.beginPath();
        ctx.moveTo(sx - 2 * z, sy - 18 * z);
        ctx.arc(sx - 2 * z, sy - 18 * z, 12 * z, Math.PI + 0.6, Math.PI + 1.4);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'starfish': {
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.arc(sx, sy, 3 * z, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'mountain_pine': {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 10 * z, 4.5 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#451a03';
        ctx.fillRect(sx - 2 * z, sy - 8 * z, 4 * z, 8 * z);

        const pineColors = ['#064e3b', '#065f46', '#047857'];
        for (let t = 0; t < 3; t++) {
          ctx.fillStyle = pineColors[t];
          const py = sy - 8 * z - t * 7 * z;
          const pw = (14 - t * 3) * z;
          ctx.beginPath();
          ctx.moveTo(sx - pw / 2, py);
          ctx.lineTo(sx, py - 9 * z);
          ctx.lineTo(sx + pw / 2, py);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }

      case 'railway_signal': {
        ctx.fillStyle = '#475569';
        ctx.fillRect(sx - 1.5 * z, sy - 20 * z, 3 * z, 20 * z);

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect(sx - 4 * z, sy - 22 * z, 8 * z, 10 * z, 2 * z);
        ctx.fill();

        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(sx, sy - 18 * z, 2.5 * z, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'genesis_monolith': {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 16 * z, 8 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect(sx - 12 * z, sy - 6 * z, 24 * z, 8 * z, 2 * z);
        ctx.fill();

        const floatBob = Math.sin(this.tick * 0.08) * 1.5 * z;
        const monoY = sy - 12 * z + floatBob;

        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(sx - 8 * z, monoY);
        ctx.lineTo(sx - 6 * z, monoY - 26 * z);
        ctx.lineTo(sx, monoY - 34 * z);
        ctx.lineTo(sx + 6 * z, monoY - 26 * z);
        ctx.lineTo(sx + 8 * z, monoY);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.moveTo(sx - 3 * z, monoY - 22 * z);
        ctx.lineTo(sx, monoY - 34 * z);
        ctx.lineTo(sx + 3 * z, monoY - 22 * z);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(9 * z)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('#0', sx, monoY - 14 * z);
        break;
      }

      case 'dev_library': {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 14 * z, 6 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.roundRect(sx - 11 * z, sy - 22 * z, 22 * z, 22 * z, 3 * z);
        ctx.fill();

        ctx.fillStyle = '#451a03';
        ctx.fillRect(sx - 9 * z, sy - 19 * z, 18 * z, 8 * z);
        ctx.fillRect(sx - 9 * z, sy - 9 * z, 18 * z, 7 * z);

        const colors = ['#38bdf8', '#f43f5e', '#10b981', '#fbbf24', '#c084fc'];
        for (let b = 0; b < 5; b++) {
          ctx.fillStyle = colors[b % colors.length];
          ctx.fillRect(sx - 8 * z + b * 3.2 * z, sy - 18 * z, 2.4 * z, 6.5 * z);
          ctx.fillRect(sx - 8 * z + b * 3.2 * z, sy - 8 * z, 2.4 * z, 5.5 * z);
        }

        ctx.fillStyle = '#6366f1';
        ctx.beginPath();
        ctx.moveTo(sx - 13 * z, sy - 22 * z);
        ctx.lineTo(sx, sy - 27 * z);
        ctx.lineTo(sx + 13 * z, sy - 22 * z);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'mystic_duck': {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 2 * z, 9 * z, 4 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        const bob = Math.sin(this.tick * 0.1) * 1.5 * z;
        const dy = sy + bob;

        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.ellipse(sx, dy - 3 * z, 7 * z, 4.5 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(sx + 4 * z, dy - 7 * z, 3.5 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f97316';
        ctx.fillRect(sx + 6.5 * z, dy - 7 * z, 3 * z, 1.8 * z);

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(sx + 4.5 * z, dy - 8 * z, 1 * z, 1 * z);
        break;
      }

      case 'cafe_cat': {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 8 * z, 4 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#be123c';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 4 * z, 8 * z, 4 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        const catY = sy - 6 * z;
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.ellipse(sx, catY, 6 * z, 4 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(sx + 3 * z, catY - 2 * z, 3.5 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f472b6';
        ctx.beginPath();
        ctx.moveTo(sx + 2 * z, catY - 5 * z);
        ctx.lineTo(sx + 3 * z, catY - 8 * z);
        ctx.lineTo(sx + 4.5 * z, catY - 5 * z);
        ctx.fill();

        const tailWag = Math.sin(this.tick * 0.1) * 2 * z;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.8 * z;
        ctx.beginPath();
        ctx.moveTo(sx - 4 * z, catY);
        ctx.quadraticCurveTo(sx - 8 * z, catY - 2 * z + tailWag, sx - 6 * z, catY - 6 * z + tailWag);
        ctx.stroke();
        break;
      }

      case 'glitch_void': {
        const glitchPulse = Math.sin(this.tick * 0.12) * 2 * z;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, (18 + glitchPulse) * z, (9 + glitchPulse * 0.5) * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 8 * z, (12 + glitchPulse) * z, (24 + glitchPulse) * z, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 8 * z, 6 * z, 16 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#22c55e';
        ctx.font = `bold ${Math.round(8 * z)}px monospace`;
        ctx.textAlign = 'center';
        const bY1 = sy - 14 * z - ((this.tick * 0.8) % (25 * z));
        const bY2 = sy - 10 * z - (((this.tick + 20) * 0.8) % (25 * z));
        ctx.fillText('0 1', sx - 6 * z, bY1);
        ctx.fillText('1 0', sx + 6 * z, bY2);
        break;
      }

      case 'cyber_lighthouse': {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 22 * z, 10 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(sx - 14 * z, sy);
        ctx.lineTo(sx - 8 * z, sy - 48 * z);
        ctx.lineTo(sx + 8 * z, sy - 48 * z);
        ctx.lineTo(sx + 14 * z, sy);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(sx - 12 * z, sy - 14 * z, 24 * z, 6 * z);
        ctx.fillRect(sx - 10 * z, sy - 28 * z, 20 * z, 6 * z);
        ctx.fillRect(sx - 8 * z, sy - 42 * z, 16 * z, 5 * z);

        ctx.fillStyle = '#090b10';
        ctx.fillRect(sx - 10 * z, sy - 54 * z, 20 * z, 6 * z);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(sx - 7 * z, sy - 53 * z, 14 * z, 5 * z);

        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.arc(sx, sy - 54 * z, 9 * z, Math.PI, 0);
        ctx.fill();

        const beamAngle = (this.tick * 0.035) % (Math.PI * 2);
        const beamLen = 140 * z;
        ctx.save();
        ctx.translate(sx, sy - 51 * z);
        ctx.rotate(beamAngle);
        const beamGrad = ctx.createRadialGradient(0, 0, 4 * z, 0, 0, beamLen);
        beamGrad.addColorStop(0, 'rgba(0, 240, 255, 0.85)');
        beamGrad.addColorStop(0.5, 'rgba(0, 240, 255, 0.25)');
        beamGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, beamLen, -0.22, 0.22);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }

      case 'hermit_cabin': {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 24 * z, 12 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#78350f';
        ctx.fillRect(sx - 18 * z, sy - 24 * z, 36 * z, 24 * z);
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 1;
        for (let l = -20; l < 0; l += 5) {
          ctx.beginPath();
          ctx.moveTo(sx - 18 * z, sy + l * z);
          ctx.lineTo(sx + 18 * z, sy + l * z);
          ctx.stroke();
        }

        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(sx - 22 * z, sy - 24 * z);
        ctx.lineTo(sx, sy - 40 * z);
        ctx.lineTo(sx + 22 * z, sy - 24 * z);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#f1f5f9';
        ctx.beginPath();
        ctx.moveTo(sx - 23 * z, sy - 25 * z);
        ctx.lineTo(sx, sy - 42 * z);
        ctx.lineTo(sx + 23 * z, sy - 25 * z);
        ctx.lineTo(sx + 18 * z, sy - 28 * z);
        ctx.lineTo(sx, sy - 38 * z);
        ctx.lineTo(sx - 18 * z, sy - 28 * z);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(sx + 4 * z, sy - 16 * z, 8 * z, 8 * z);
        ctx.strokeStyle = '#451a03';
        ctx.strokeRect(sx + 4 * z, sy - 16 * z, 8 * z, 8 * z);

        ctx.fillStyle = '#475569';
        ctx.fillRect(sx - 14 * z, sy - 42 * z, 6 * z, 16 * z);
        ctx.fillStyle = 'rgba(241, 245, 249, 0.45)';
        for (let i = 0; i < 3; i++) {
          const sOffset = ((this.tick * 0.4 + i * 20) % 60);
          ctx.beginPath();
          ctx.arc((sx - 11 * z) + Math.sin(sOffset * 0.1) * 4 * z, (sy - 44 * z) - sOffset * 0.8 * z, (3 + sOffset * 0.1) * z, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'retro_arcade': {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 12 * z, 6 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.2;
        ctx.fillRect(sx - 10 * z, sy - 28 * z, 20 * z, 28 * z);
        ctx.strokeRect(sx - 10 * z, sy - 28 * z, 20 * z, 28 * z);

        ctx.fillStyle = '#ef4444';
        ctx.fillRect(sx - 9 * z, sy - 27 * z, 18 * z, 5 * z);
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(6 * z)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('SPACE', sx, sy - 23 * z);

        ctx.fillStyle = '#022c22';
        ctx.fillRect(sx - 8 * z, sy - 21 * z, 16 * z, 10 * z);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(sx - 2 * z, sy - 18 * z, 4 * z, 3 * z);
        ctx.fillRect(sx - 4 * z, sy - 16 * z, 8 * z, 2 * z);

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(sx - 9 * z, sy - 10 * z, 18 * z, 4 * z);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(sx - 5 * z, sy - 12 * z, 2 * z, 3 * z);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(sx + 3 * z, sy - 9 * z, 2 * z, 2 * z);
        break;
      }

      case 'sunken_sub': {
        ctx.fillStyle = 'rgba(2, 132, 199, 0.4)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 24 * z, 10 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 4 * z, 20 * z, 9 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(sx - 6 * z, sy - 20 * z, 12 * z, 14 * z);

        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2 * z;
        ctx.beginPath();
        ctx.moveTo(sx - 1 * z, sy - 20 * z);
        ctx.lineTo(sx - 1 * z, sy - 30 * z);
        ctx.lineTo(sx + 3 * z, sy - 30 * z);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        for (let i = 0; i < 3; i++) {
          const bY = sy - 6 * z - ((this.tick * 0.5 + i * 18) % (20 * z));
          ctx.beginPath();
          ctx.arc(sx + 8 * z + Math.sin(this.tick * 0.1 + i) * 2 * z, bY, 1.8 * z, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'fountain': {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 22 * z, 10 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 2 * z, 20 * z, 9 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 3 * z, 17 * z, 7 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#64748b';
        ctx.fillRect(sx - 3 * z, sy - 16 * z, 6 * z, 14 * z);
        ctx.beginPath();
        ctx.ellipse(sx, sy - 16 * z, 8 * z, 3.5 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        const jetHeight = (8 + Math.sin(this.tick * 0.15) * 2) * z;
        ctx.fillStyle = '#bae6fd';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 18 * z - jetHeight, 3.5 * z, 5 * z, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'cherry_tree': {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 2 * z, 14 * z, 6 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#451a03';
        ctx.fillRect(sx - 3 * z, sy - 18 * z, 6 * z, 17 * z);

        const cx = sx + windSway;
        const cy = sy - 26 * z;

        ctx.fillStyle = '#db2777';
        ctx.beginPath();
        ctx.arc(cx, cy + 3 * z, 15 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f472b6';
        ctx.beginPath();
        ctx.arc(cx - 3 * z, cy - 2 * z, 13 * z, 0, Math.PI * 2);
        ctx.arc(cx + 3 * z, cy - 1 * z, 12 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fbcfe8';
        ctx.beginPath();
        ctx.arc(cx - 1 * z, cy - 6 * z, 9 * z, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'park_tree': {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 2 * z, 15 * z, 6.5 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#5c3a1e';
        ctx.fillRect(sx - 3.5 * z, sy - 20 * z, 7 * z, 18 * z);
        ctx.fillStyle = '#451a03';
        ctx.fillRect(sx - 5 * z, sy - 4 * z, 10 * z, 3 * z);

        const tx = sx + windSway;
        const ty = sy - 28 * z;

        ctx.fillStyle = '#14532d';
        ctx.beginPath();
        ctx.arc(tx, ty + 3 * z, 16 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.arc(tx - 4 * z, ty - 2 * z, 14 * z, 0, Math.PI * 2);
        ctx.arc(tx + 4 * z, ty - 1 * z, 13 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(tx - 1 * z, ty - 7 * z, 10 * z, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'tree_planter': {
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.roundRect(sx - 8 * z, sy - 4 * z, 16 * z, 6 * z, 1.5 * z);
        ctx.fill();

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(sx - 6.5 * z, sy - 3.5 * z, 13 * z, 4 * z);

        ctx.fillStyle = '#5c3a1e';
        ctx.fillRect(sx - 2.5 * z, sy - 18 * z, 5 * z, 15 * z);

        const px = sx + windSway * 0.7;
        const py = sy - 24 * z;

        ctx.fillStyle = '#14532d';
        ctx.beginPath();
        ctx.arc(px, py + 2 * z, 12 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.arc(px - 2 * z, py - 2 * z, 10.5 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.arc(px - 1 * z, py - 5 * z, 7 * z, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'stone_lantern': {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 5 * z, 2.5 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#64748b';
        ctx.fillRect(sx - 2 * z, sy - 12 * z, 4 * z, 12 * z);

        ctx.fillStyle = '#fb923c';
        ctx.fillRect(sx - 3 * z, sy - 14 * z, 6 * z, 5 * z);

        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(sx - 5 * z, sy - 14 * z);
        ctx.lineTo(sx, sy - 18 * z);
        ctx.lineTo(sx + 5 * z, sy - 14 * z);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'flower_bed': {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 8 * z, 4 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 2 * z, 7.5 * z, 3.5 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 3 * z, 5.5 * z, 2.5 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(sx - 3 * z, sy - 5 * z, 2 * z, 2 * z);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(sx + 1 * z, sy - 4 * z, 2 * z, 2 * z);
        ctx.fillStyle = '#c084fc';
        ctx.fillRect(sx - 1 * z, sy - 6 * z, 2 * z, 2 * z);
        break;
      }

      case 'street_lamp': {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 4 * z, 2 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#475569';
        ctx.fillRect(sx - 1.5 * z, sy - 24 * z, 3 * z, 24 * z);

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(sx - 4 * z, sy - 26 * z, 8 * z, 3 * z);

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

        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.roundRect(sx - 6 * z, sy - 18 * z, 12 * z, 18 * z, 2 * z);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(sx - 4.5 * z, sy - 16 * z, 9 * z, 9 * z);

        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(sx - 3.5 * z, sy - 15 * z, 2 * z, 3 * z);
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(sx - 0.5 * z, sy - 15 * z, 2 * z, 3 * z);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(sx + 2 * z, sy - 15 * z, 2 * z, 3 * z);

        ctx.fillStyle = '#0369a1';
        ctx.fillRect(sx - 4 * z, sy - 5 * z, 8 * z, 3 * z);
        break;
      }

      case 'cafe_table': {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 7 * z, 3 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(sx - 1 * z, sy - 7 * z, 2 * z, 7 * z);
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 7 * z, 6 * z, 3 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(sx, sy - 16 * z, 10 * z, Math.PI, 0);
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
