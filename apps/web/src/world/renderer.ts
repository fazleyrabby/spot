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
import { AVATAR_CATALOG } from '../canvas/avatars.js';
import { PlotManager } from './plot-manager.js';
import { TrainManager } from './train-manager.js';
import { TrafficManager } from './traffic-manager.js';
import { SkylineManager } from './skyline-manager.js';
import { SkyManager } from './sky-manager.js';
import { NPCManager } from './npc-manager.js';
import { WeatherManager, type WeatherMode } from './weather-manager.js';
import { WORLD_BANNERS, type WorldBanner } from './banner-manager.js';
import { VignetteManager } from './vignette-manager.js';
import { MarineManager } from './marine-manager.js';
import { MuseumManager, MUSEUM_SIZE, MUSEUM_FRAMES } from './museum-manager.js';
import type { WorldSecret } from './secrets.js';
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

  beach_sand_1: '#232b38',
  beach_sand_2: '#1e2530',
  ocean_deep: '#061325',
  ocean_surf: '#0a233f',
  wave_foam: 'rgba(148, 163, 184, 0.35)',

  // Western Emerald Jungle
  jungle_grass_1: '#072b18',
  jungle_grass_2: '#0d3820',
  jungle_dense: '#041f10',
  jungle_creek: '#044e3a',
  jungle_creek_ripple: 'rgba(52, 211, 153, 0.40)',

  // Eastern Whispering Woods / Redwood Forest
  forest_grass_1: '#13231a',
  forest_grass_2: '#1a2f23',
  forest_dense: '#0d1a12',
  forest_creek: '#0c384e',
  forest_creek_ripple: 'rgba(56, 189, 248, 0.38)',

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
  readonly traffic: TrafficManager;
  readonly skyline: SkylineManager;
  readonly sky: SkyManager;
  readonly npcs: NPCManager;
  readonly weather: WeatherManager;
  readonly vignettes: VignetteManager;
  readonly marine: MarineManager;
  readonly museum: MuseumManager;
  multiplayer?: import('./multiplayer-sync.js').MultiplayerSync;

  hoveredCitizen: OccupiedSpotSummary | null = null;
  hoveredGrid: { gx: number; gy: number } | null = null;
  hoveredBanner: WorldBanner | null = null;
  hoveredSecret: WorldSecret | null = null;
  selectedCitizen: OccupiedSpotSummary | null = null;
  gpsTarget: { name: string; wx: number; wy: number } | null = null;
  timeOfDay: 'day' | 'twilight' | 'night' = 'night';

  private cityParticles: CityParticle[] = [];
  private animFrameId: number | null = null;
  private tick = 0;
  private bannerImageCache = new Map<string, HTMLImageElement>();

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
    this.traffic = new TrafficManager();
    this.skyline = new SkylineManager();
    this.sky = new SkyManager();
    this.npcs = new NPCManager();
    this.weather = new WeatherManager();
    this.vignettes = new VignetteManager();
    this.marine = new MarineManager();
    this.museum = new MuseumManager();

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
    this.traffic.tick(this.player.wx, this.player.wy);
    this.skyline.tick();
    this.sky.tick(this.player.wx, this.player.wy);
    this.npcs.tick();
    this.vignettes.tick();
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

    // 1b. Distant Parallax Cyber Metropolis Skyline
    this.skyline.render(ctx, camera, this.timeOfDay);

    // 2. Visible grid bounds
    const bounds = camera.getWorldBounds();
    const range = getVisibleGridRange(bounds.left, bounds.top, bounds.right, bounds.bottom, 2);

    // Museum interior — full 2.5D walkable gallery (2D arts only)
    if (this.museum.isInside) {
      this.drawMuseumInterior(ctx, z);
      // still draw player + lights inside museum
      const entities: RenderableEntity[] = [];
      const lights: LightSource[] = [];
      const pScreen = camera.worldToScreen(this.player.wx, this.player.wy);
      entities.push({ depth: this.player.wy, render: (c, zm) => this.player.render(c, pScreen.x, pScreen.y, zm) });
      // exit door hint
      const exitW = this.museum.getExit();
      const exitScreen = camera.worldToScreen(exitW.gx * TILE_WIDTH + TILE_WIDTH/2, (MUSEUM_SIZE.h - 1) * TILE_HEIGHT + TILE_HEIGHT/2);
      lights.push({ wx: exitW.gx * TILE_WIDTH, wy: (MUSEUM_SIZE.h - 1) * TILE_HEIGHT, radius: 90, color: 'rgba(251,191,36,0.35)' });
      if (this.timeOfDay !== 'day') this.drawStreetLighting(ctx, lights, z);
      for (const e of entities) e.render(ctx, z);
      return;
    }

    // Clip all world drawing to the cropped jungle bounds (-24..124) so stray props/lights don't bleed into side voids
    ctx.save();
    {
      const tl = camera.worldToScreen(-24 * 48, -16 * 32);
      const br = camera.worldToScreen(125 * 48, 130 * 32);
      ctx.beginPath();
      ctx.rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.clip();
    }

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

    // 4a-2. Cyber Billboard Banners (Sponsorship & Partner Placeholders)
    this.collectBanners(range, entities, lights);

    // 4b. Passing Cyber Bullet Train
    if (this.train.active) {
      entities.push({
        depth: this.train.trackWy + 10,
        render: (c, currentZoom) => {
          this.train.render(c, 0, this.camera, currentZoom);
        },
      });
    }

    // 4b-2. Autonomous Street Traffic (Cabs, Cruisers, Vans, Scooters)
    const vehicles = this.traffic.getVehicles();
    for (const v of vehicles) {
      const screen = camera.worldToScreen(v.wx, v.wy);
      if (screen.x < -120 || screen.x > W + 120 || screen.y < -120 || screen.y > H + 120) continue;
      entities.push({
        depth: v.wy,
        render: (c, currentZoom) => {
          this.traffic.renderVehicle(c, v, screen, currentZoom, this.timeOfDay);
        },
      });
      if (this.timeOfDay !== 'day') {
        const hOffset = v.direction === 'east' ? 24 : v.direction === 'west' ? -24 : 0;
        const vOffset = v.direction === 'south' ? 24 : v.direction === 'north' ? -24 : 0;
        lights.push({
          wx: v.wx + hOffset,
          wy: v.wy + vOffset,
          radius: 75,
          color: 'rgba(254, 240, 138, 0.40)',
        });
      }
    }

    // 4c. Citizen Chibi Characters — batched LOD only when 2k+ (else original full chibi UI)
    const allCitizens = this.monuments.getAllEntities();
    const useLOD = allCitizens.length >= 2000;
    const lodThreshold = 1.25;
    const isMacroLOD = useLOD && z < lodThreshold;
    // collect LOD dots for single batched draw (otherwise 2.5k entities + sort = lag)
    const lodDots: Array<{ x: number; y: number; col: string; r: number; alpha: number }> = [];
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

      if (isMacroLOD && !isHovered && !isSelected) {
        // ultra-macro headache: 1 in 4, mid-macro 1 in 2, and even when zoomed in at 10k keep dots to avoid confetti wall
        if (z < 0.45) {
          if ((ent.spot.x + ent.spot.y) % 2 !== 0) continue;
          if ((ent.spot.x % 2) !== 0) continue;
        } else if (z < 0.65) {
          if ((ent.spot.x + ent.spot.y) % 2 !== 0) continue;
        }
        // at 5k+ even 116% is still dense — keep dots until you go really close
        const avatarId = (ent.spot as any).avatarId || (ent.spot as any).avatar_id || 'astronaut';
        const col = (AVATAR_CATALOG as any)[avatarId]?.colors?.primary || '#38bdf8';
        const isUltra = z < 0.45;
        const isMid = z < 0.65;
        // larger but more transparent dots when zoomed in so pavement still dominates
        const r = isUltra ? 2.0 * z : isMid ? 1.7 * z : 2.6 * z;
        const alpha = isUltra ? 0.32 : isMid ? 0.42 : 0.52;
        lodDots.push({ x: screen.x, y: screen.y - 0.8 * z, col, r, alpha });
        continue;
      }

      entities.push({
        depth: ent.wy - 0.5,
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

    // 4e. Marine Life — sharks, speedboats, surfers (clipped to beach)
    this.marine.update();
    for (const m of this.marine.getEntities()) {
      const screen = camera.worldToScreen(m.wx, m.wy);
      if (screen.x < -80 || screen.x > W + 80 || screen.y < -80 || screen.y > H + 80) continue;
      entities.push({
        depth: m.wy,
        render: (c, currentZoom) => {
          this.marine.render(c, m, screen.x, screen.y, currentZoom, this.tick);
        },
      });
      if (m.kind === 'speedboat' && this.timeOfDay !== 'day') {
        lights.push({ wx: m.wx, wy: m.wy, radius: 90, color: 'rgba(56, 189, 248, 0.28)' });
      }
      if (m.kind === 'surfer' && this.timeOfDay !== 'day') {
        lights.push({ wx: m.wx, wy: m.wy, radius: 45, color: 'rgba(251, 191, 36, 0.18)' });
      }
    }

    // 5. Draw Ambient Radial Light Glows on the ground
    if (this.timeOfDay !== 'day') {
      this.drawStreetLighting(ctx, lights, z);
    }

    // 5b. Batched LOD dots for macro — single path, no per-dot save/shadow/sort (fixes lag at 35%)
    if (lodDots.length > 0) {
      ctx.save();
      for (const d of lodDots) {
        ctx.globalAlpha = d.alpha;
        ctx.fillStyle = d.col;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 6. Unified Depth Sort (Y ascending) — only non-LOD entities (player, hovered, marine, etc.)
    entities.sort((a, b) => a.depth - b.depth);

    // 7. Draw all sorted physical entities
    for (const entity of entities) {
      entity.render(ctx, z);
    }

    // 7b. Street NPCs (Kiro the Barista & Prof. Barnaby)
    this.npcs.renderNPCs(ctx, camera, this.player.wx, this.player.wy);

    // 7c. Floor796-Style Living Micro-Vignettes
    this.vignettes.render(ctx, camera);

    ctx.restore();

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

    // 9. Floating ambient particles & Dynamic Weather (Cyber Neon Rain / Motes)
    this.weather.tick(W, H);
    this.weather.render(ctx, W, H);
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

  private drawMuseumInterior(ctx: CanvasRenderingContext2D, z: number): void {
    const tw = TILE_WIDTH * z;
    const th = TILE_HEIGHT * z;
    // parquet floor + walls
    for (let gy = 0; gy < MUSEUM_SIZE.h; gy++) {
      for (let gx = 0; gx < MUSEUM_SIZE.w; gx++) {
        const wx = gx * TILE_WIDTH;
        const wy = gy * TILE_HEIGHT;
        const s = this.camera.worldToScreen(wx, wy);
        const dx = Math.floor(s.x), dy = Math.floor(s.y), dw = Math.ceil(tw), dh = Math.ceil(th);
        const isWall = gx === 0 || gx === MUSEUM_SIZE.w - 1 || gy === 0 || gy === MUSEUM_SIZE.h - 1;
        if (isWall) {
          ctx.fillStyle = gx === 0 || gx === MUSEUM_SIZE.w - 1 || gy === 0 ? '#0f172a' : '#1e293b';
          ctx.fillRect(dx, dy, dw, dh);
          if (gy === 0) {
            ctx.fillStyle = 'rgba(251,191,36,0.12)';
            ctx.fillRect(dx, dy + dh - 3 * z, dw, 3 * z);
          }
        } else {
          const isAlt = (gx + gy) % 2 === 0;
          ctx.fillStyle = isAlt ? '#1a2332' : '#162032';
          ctx.fillRect(dx, dy, dw, dh);
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.fillRect(dx, dy, dw, 1);
        }
        // exit door at bottom center
        if (gx === Math.floor(MUSEUM_SIZE.w/2) && gy === MUSEUM_SIZE.h - 1) {
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(dx + dw*0.25, dy + dh*0.15, dw*0.5, dh*0.55);
          ctx.fillStyle = '#0f172a';
          ctx.font = `${Math.max(6, Math.floor(6*z))}px monospace`;
          ctx.textAlign = 'center'; ctx.fillText('EXIT', dx + dw/2, dy + dh*0.55);
        }
      }
    }
    // frame placeholders on north/south walls (where iframes overlay will sit)
    for (const f of MUSEUM_FRAMES) {
      const wx = f.gx * TILE_WIDTH;
      const wy = f.gy * TILE_HEIGHT;
      const s = this.camera.worldToScreen(wx, wy);
      const isNorth = f.gy === 2, isSouth = f.gy === 13;
      ctx.fillStyle = 'rgba(251,191,36,0.18)';
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1.2 * z;
      const fw = 3.2 * TILE_WIDTH * z, fh = 2.2 * TILE_HEIGHT * z;
      const fx = Math.floor(s.x - fw/2), fy = Math.floor(s.y - fh/2);
      ctx.beginPath(); ctx.roundRect(fx, fy, fw, fh, 2*z); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(fx + 4*z, fy + 4*z, fw - 8*z, fh - 14*z);
      ctx.fillStyle = '#94a3b8';
      ctx.font = `${Math.max(5, Math.floor(5*z))}px monospace`;
      ctx.textAlign = 'center'; ctx.fillText(f.title.slice(0,16), fx + fw/2, fy + fh - 4*z);
    }
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
          case 'void': {
            // Cropped — don't draw, background will remain
            break;
          }

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
            // Subtle slate flecks to match city pavement
            if ((gx * 11 + gy * 7) % 5 === 0) {
              ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
              ctx.fillRect(dx + dw * 0.35, dy + dh * 0.4, Math.max(1, 1.8 * z), Math.max(1, 1.2 * z));
            }
            break;
          }

          case 'ocean_surf': {
            // Dark wet-sand base to match city slate
            ctx.fillStyle = '#1e2530';
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

          // ── Western Emerald Jungle Ground ─────────────────────────────────
          case 'jungle_grass': {
            const isAlt = (gx + gy) % 2 === 0;
            ctx.fillStyle = isAlt ? PALETTES.jungle_grass_1 : PALETTES.jungle_grass_2;
            ctx.fillRect(dx, dy, dw, dh);
            // Leafy moss speckle
            if ((gx * 7 + gy * 13) % 5 === 0) {
              ctx.fillStyle = '#10b981';
              ctx.fillRect(dx + dw * 0.3, dy + dh * 0.4, 2 * z, 1.5 * z);
            }
            break;
          }

          case 'jungle_dense': {
            ctx.fillStyle = PALETTES.jungle_dense;
            ctx.fillRect(dx, dy, dw, dh);
            // Deep jungle moss patch
            ctx.fillStyle = '#064e3b';
            ctx.fillRect(dx + dw * 0.2, dy + dh * 0.25, dw * 0.6, dh * 0.5);
            break;
          }

          case 'jungle_creek': {
            // Emerald tropical riverbed
            ctx.fillStyle = PALETTES.jungle_creek;
            ctx.fillRect(dx, dy, dw, dh);
            // Animated creek shimmer
            const current = Math.sin(this.tick * 0.06 + gy * 0.8 + gx * 0.3);
            if (current > 0.2) {
              ctx.fillStyle = PALETTES.jungle_creek_ripple;
              ctx.fillRect(dx + dw * 0.2, dy + dh * 0.4, dw * 0.6, Math.max(1, 1.8 * z));
            }
            break;
          }

          // ── Eastern Whispering Woods Ground ───────────────────────────────
          case 'forest_grass': {
            const isAlt = (gx + gy) % 2 === 0;
            ctx.fillStyle = isAlt ? PALETTES.forest_grass_1 : PALETTES.forest_grass_2;
            ctx.fillRect(dx, dy, dw, dh);
            // Pine needle / fallen amber leaf specks
            if ((gx * 11 + gy * 5) % 4 === 0) {
              ctx.fillStyle = '#d97706';
              ctx.fillRect(dx + dw * 0.4, dy + dh * 0.3, 2 * z, 1.2 * z);
            }
            break;
          }

          case 'forest_dense': {
            ctx.fillStyle = PALETTES.forest_dense;
            ctx.fillRect(dx, dy, dw, dh);
            // Deep woodland moss bed
            ctx.fillStyle = '#13281a';
            ctx.fillRect(dx + dw * 0.15, dy + dh * 0.2, dw * 0.7, dh * 0.6);
            break;
          }

          case 'forest_creek': {
            // Crisp mountain woodland stream
            ctx.fillStyle = PALETTES.forest_creek;
            ctx.fillRect(dx, dy, dw, dh);
            // Animated water current ripples
            const ripple = Math.sin(this.tick * 0.05 + gy * 0.7 - gx * 0.4);
            if (ripple > 0.25) {
              ctx.fillStyle = PALETTES.forest_creek_ripple;
              ctx.fillRect(dx + dw * 0.25, dy + dh * 0.35, dw * 0.5, Math.max(1, 1.8 * z));
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

        // Skip spawning nature/tree props on coordinates occupied by citizens
        if (
          prop.type === 'park_tree' ||
          prop.type === 'fruit_tree' ||
          prop.type === 'jungle_tree' ||
          prop.type === 'ancient_redwood' ||
          prop.type === 'willow_tree' ||
          prop.type === 'birch_tree' ||
          prop.type === 'pine_tree' ||
          prop.type === 'cherry_tree' ||
          prop.type === 'mountain_pine' ||
          prop.type === 'palm_tree' ||
          prop.type === 'tree_planter' ||
          prop.type === 'toadstool_cluster' ||
          prop.type === 'mossy_boulder' ||
          prop.type === 'hollow_log' ||
          prop.type === 'jungle_fern'
        ) {
          if (this.monuments.hasEntityNear(prop.wx, prop.wy, 14)) {
            continue;
          }
        }

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

  private isEntityBehindTree(treeWx: number, treeWy: number): boolean {
    if (
      Math.abs(this.player.wx - treeWx) <= 18 &&
      this.player.wy >= treeWy - 36 &&
      this.player.wy <= treeWy + 4
    ) {
      return true;
    }
    return this.monuments.isEntityInTreeCanopy(treeWx, treeWy);
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
        // Volumetric Ground Shadow on the Sand
        ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 14 * z, 6 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Leaning Curved Coconut Palm Trunk
        // Determine natural lean direction from coordinate hash
        const lean = ((prop.gx * 3 + prop.gy) % 2 === 0) ? 1 : -1;
        const trunkCurve = (8 + Math.sin(prop.gx) * 3) * lean * z;
        const topX = sx + trunkCurve + windSway * 1.1;
        const topY = sy - 30 * z;

        // Trunk shadow underlayer
        ctx.strokeStyle = '#27170a';
        ctx.lineWidth = 5.2 * z;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + trunkCurve * 0.5, sy - 16 * z, topX, topY);
        ctx.stroke();

        // Warm ringed coconut bark
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 4 * z;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + trunkCurve * 0.5, sy - 16 * z, topX, topY);
        ctx.stroke();

        // Segmented bark notches / rings
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 1.2 * z;
        for (let r = 1; r <= 6; r++) {
          const t = r / 7;
          const rx = sx * (1 - t) * (1 - t) + (sx + trunkCurve * 0.5) * 2 * (1 - t) * t + topX * t * t;
          const ry = sy * (1 - t) * (1 - t) + (sy - 16 * z) * 2 * (1 - t) * t + topY * t * t;
          ctx.beginPath();
          ctx.moveTo(rx - 2.5 * z, ry);
          ctx.lineTo(rx + 2.5 * z, ry);
          ctx.stroke();
        }

        const isOccluding = this.isEntityBehindTree(prop.wx, prop.wy);
        if (isOccluding) {
          ctx.save();
          ctx.globalAlpha = 0.32;
        }

        // 🥥 Cluster of Ripe Coconuts hanging right under the crown
        const coconutColors = ['#5c3a1e', '#713f12', '#78350f'];
        const nutOffsets = [
          { x: -2.2, y: 1.5, r: 2.2 },
          { x: 1.8, y: 1.8, r: 2.3 },
          { x: 0, y: 3.2, r: 2.0 },
          { x: -0.8, y: -0.5, r: 1.8 },
        ];
        nutOffsets.forEach((nut, idx) => {
          // Coconut body
          ctx.fillStyle = coconutColors[idx % 3];
          ctx.beginPath();
          ctx.arc(topX + nut.x * z, topY + nut.y * z, nut.r * z, 0, Math.PI * 2);
          ctx.fill();
          // Lighter highlight
          ctx.fillStyle = '#a16207';
          ctx.beginPath();
          ctx.arc(topX + (nut.x - 0.5) * z, topY + (nut.y - 0.5) * z, nut.r * 0.45 * z, 0, Math.PI * 2);
          ctx.fill();
        });

        // 🌴 Arching Tropical Coconut Palm Fronds
        // 7 layered fronds with natural droop and wind sway
        const fronds = [
          { angle: -Math.PI * 0.85, len: 19, droop: 8, col: '#064e3b' },
          { angle: -Math.PI * 0.60, len: 21, droop: 5, col: '#047857' },
          { angle: -Math.PI * 0.35, len: 22, droop: 7, col: '#059669' },
          { angle: -Math.PI * 0.12, len: 20, droop: 10, col: '#10b981' },
          { angle: Math.PI * 0.15,  len: 20, droop: 9, col: '#047857' },
          { angle: -Math.PI * 0.98, len: 17, droop: 11, col: '#065f46' },
          { angle: -Math.PI * 0.50, len: 23, droop: 4, col: '#34d399' },
        ];

        fronds.forEach((f) => {
          const frondAngle = f.angle + windSway * 0.04;
          const endX = topX + Math.cos(frondAngle) * f.len * z;
          const endY = topY + Math.sin(frondAngle) * f.len * 0.65 * z + f.droop * z;
          const ctrlX = topX + Math.cos(frondAngle) * f.len * 0.55 * z;
          const ctrlY = topY + Math.sin(frondAngle) * f.len * 0.4 * z - 4 * z;

          // Main Frond Stem
          ctx.strokeStyle = f.col;
          ctx.lineWidth = 3.2 * z;
          ctx.beginPath();
          ctx.moveTo(topX, topY);
          ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
          ctx.stroke();

          // Leaflet fringe along frond
          ctx.strokeStyle = f.col;
          ctx.lineWidth = 1.4 * z;
          ctx.beginPath();
          for (let p = 0.3; p <= 0.9; p += 0.15) {
            const lx = topX * (1 - p) + endX * p;
            const ly = topY * (1 - p) + endY * p;
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx - 2 * z, ly + 4 * z);
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx + 2 * z, ly + 4 * z);
          }
          ctx.stroke();
        });

        if (isOccluding) {
          ctx.restore();
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

        const isOccluding = this.isEntityBehindTree(prop.wx, prop.wy);
        if (isOccluding) {
          ctx.save();
          ctx.globalAlpha = 0.32;
        }

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

        if (isOccluding) {
          ctx.restore();
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
        const isHovered = this.hoveredSecret?.id === 'dev_library';
        const bob = Math.sin(this.tick * 0.07) * 2.5 * z;

        // 1. Broad Ground Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 3 * z, 58 * z, 14 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. Three-Tier Grand Granite Steps & Foundation Terrace (Wide Base ~108px base)
        // Level 1: Plaza Base
        ctx.fillStyle = '#0a0f1d';
        ctx.beginPath();
        ctx.roundRect(sx - 54 * z, sy - 2 * z, 108 * z, 7 * z, 2 * z);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1 * z;
        ctx.stroke();

        // Level 2: Mid Step
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect(sx - 50 * z, sy - 5 * z, 100 * z, 5 * z, 1.5 * z);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.stroke();

        // Level 3: Upper Terrace
        ctx.fillStyle = '#131d33';
        ctx.beginPath();
        ctx.roundRect(sx - 46 * z, sy - 8 * z, 92 * z, 4 * z, 1.5 * z);
        ctx.fill();

        // Plaza Twin Pedestal Lanterns (Outer Edges)
        for (const lx of [sx - 49 * z, sx + 49 * z]) {
          // Pedestal base
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(lx - 2 * z, sy - 8 * z, 4 * z, 6 * z);
          // Amber glow lamp
          ctx.fillStyle = isHovered ? 'rgba(251, 191, 36, 0.95)' : 'rgba(251, 191, 36, 0.75)';
          ctx.beginPath();
          ctx.arc(lx, sy - 10 * z, 2.5 * z, 0, Math.PI * 2);
          ctx.fill();
          // Soft ambient glow
          ctx.fillStyle = 'rgba(251, 191, 36, 0.15)';
          ctx.beginPath();
          ctx.arc(lx, sy - 10 * z, 7 * z, 0, Math.PI * 2);
          ctx.fill();
        }

        // 3. West & East Wings (Colonnaded Reading Halls)
        const wingW = 28 * z;
        const wingH = 34 * z;
        const wingY = sy - 40 * z;

        // West Wing
        ctx.fillStyle = isHovered ? '#10172c' : '#0b1122';
        ctx.beginPath();
        ctx.roundRect(sx - 44 * z, wingY, wingW, wingH, [3 * z, 0, 0, 0]);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1 * z;
        ctx.stroke();

        // East Wing
        ctx.beginPath();
        ctx.roundRect(sx + 16 * z, wingY, wingW, wingH, [0, 3 * z, 0, 0]);
        ctx.fill();
        ctx.stroke();

        // Wing Roof Cornice & Balustrades
        ctx.fillStyle = '#1a243a';
        ctx.fillRect(sx - 45 * z, wingY - 2.5 * z, wingW + 1 * z, 3 * z);
        ctx.fillRect(sx + 16 * z, wingY - 2.5 * z, wingW + 1 * z, 3 * z);

        // Balustrade notches along wings
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        for (let bx = -43; bx <= -19; bx += 4) {
          ctx.fillRect(sx + bx * z, wingY - 4.5 * z, 2 * z, 2.5 * z);
        }
        for (let bx = 17; bx <= 41; bx += 4) {
          ctx.fillRect(sx + bx * z, wingY - 4.5 * z, 2 * z, 2.5 * z);
        }

        // Arched Stained Glass Windows on Wings (4 Windows Total with Interior Bookshelves Visible!)
        const windowCenters = [sx - 37 * z, sx - 23 * z, sx + 23 * z, sx + 37 * z];
        const bookPalette = ['#38bdf8', '#fbbf24', '#f472b6', '#34d399', '#a78bfa'];

        for (let i = 0; i < windowCenters.length; i++) {
          const wx = windowCenters[i];
          const wy = sy - 34 * z;
          const ww = 8 * z;
          const wh = 18 * z;

          // Window Frame & Warm Glow
          ctx.fillStyle = isHovered ? 'rgba(245, 158, 11, 0.32)' : 'rgba(245, 158, 11, 0.18)';
          ctx.beginPath();
          ctx.arc(wx, wy, ww / 2, Math.PI, 0);
          ctx.lineTo(wx + ww / 2, wy + wh);
          ctx.lineTo(wx - ww / 2, wy + wh);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
          ctx.lineWidth = 0.8 * z;
          ctx.stroke();

          // Interior Bookcases visible inside window pane
          for (let b = 0; b < 3; b++) {
            ctx.fillStyle = bookPalette[(i + b * 2) % bookPalette.length];
            ctx.fillRect(wx - 3 * z + b * 2.2 * z, wy + 4 * z, 1.8 * z, 5 * z);
            ctx.fillRect(wx - 3 * z + b * 2.2 * z, wy + 11 * z, 1.8 * z, 5 * z);
          }

          // Window Mullions (Crossbars)
          ctx.strokeStyle = '#0b1122';
          ctx.lineWidth = 0.8 * z;
          ctx.beginPath();
          ctx.moveTo(wx, wy - ww / 2);
          ctx.lineTo(wx, wy + wh);
          ctx.moveTo(wx - ww / 2, wy + wh / 2);
          ctx.lineTo(wx + ww / 2, wy + wh / 2);
          ctx.stroke();
        }

        // 4. Grand Central Portico / Entrance Pavilion (Elevated & Prominent)
        const porticoW = 34 * z;
        const porticoH = 40 * z;
        const porticoY = sy - 46 * z;

        ctx.fillStyle = isHovered ? '#151f38' : '#0f172c';
        ctx.beginPath();
        ctx.roundRect(sx - porticoW / 2, porticoY, porticoW, porticoH, 2 * z);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.2 * z;
        ctx.stroke();

        // 4 Neoclassical Fluted Columns in Front of Portico
        const colPositions = [sx - 14 * z, sx - 5 * z, sx + 5 * z, sx + 14 * z];
        for (const cx of colPositions) {
          // Column Base Plinth
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(cx - 2.5 * z, sy - 11 * z, 5 * z, 3 * z);
          // Column Shaft
          ctx.fillStyle = isHovered ? '#e2e8f0' : '#cbd5e1';
          ctx.fillRect(cx - 1.8 * z, sy - 38 * z, 3.6 * z, 27 * z);
          // Fluted Center Groove (depth highlight)
          ctx.fillStyle = '#64748b';
          ctx.fillRect(cx - 0.4 * z, sy - 38 * z, 0.8 * z, 27 * z);
          // Column Capital Cap
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(cx - 2.5 * z, sy - 40 * z, 5 * z, 2.5 * z);
        }

        // Grand Arched Main Entrance
        const doorW = 14 * z;
        const doorH = 21 * z;
        const doorY = sy - 28 * z;

        // Warm foyer glow spilling onto the terrace
        ctx.fillStyle = isHovered ? 'rgba(245, 158, 11, 0.35)' : 'rgba(245, 158, 11, 0.22)';
        ctx.beginPath();
        ctx.arc(sx, doorY, doorW / 2, Math.PI, 0);
        ctx.lineTo(sx + doorW / 2, sy - 7 * z);
        ctx.lineTo(sx - doorW / 2, sy - 7 * z);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
        ctx.lineWidth = 1 * z;
        ctx.stroke();

        // Deep interior library stacks & reading hall
        for (let b = 0; b < 5; b++) {
          ctx.fillStyle = bookPalette[b % bookPalette.length];
          ctx.fillRect(sx - 5 * z + b * 2.2 * z, doorY - 1 * z, 1.8 * z, 6 * z);
          ctx.fillRect(sx - 5 * z + b * 2.2 * z, doorY + 8 * z, 1.8 * z, 5 * z);
        }

        // Half-open mahogany entrance doors
        ctx.fillStyle = '#1c1917';
        ctx.fillRect(sx - 6.5 * z, doorY + 6 * z, 3.5 * z, 13 * z);
        ctx.fillRect(sx + 3 * z, doorY + 6 * z, 3.5 * z, 13 * z);
        // Brass door handles
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(sx - 4 * z, doorY + 12 * z, 0.8 * z, 2 * z);
        ctx.fillRect(sx + 3.2 * z, doorY + 12 * z, 0.8 * z, 2 * z);

        // 5. Classical Cyber Frieze & Header Sign
        const friezeW = 38 * z;
        const friezeY = sy - 45 * z;
        ctx.fillStyle = '#162035';
        ctx.beginPath();
        ctx.roundRect(sx - friezeW / 2, friezeY, friezeW, 8.5 * z, 1.5 * z);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1 * z;
        ctx.stroke();

        if (z >= 0.55) {
          ctx.font = `bold ${Math.max(6, Math.floor(6.5 * z))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#f8fafc';
          ctx.fillText('🏛️ THE GRAND CODEX', sx, friezeY + 4.5 * z);
        }

        // 6. Triangular Classical Cyber Pediment (Gable)
        const pedY = sy - 46 * z;
        const pedApexY = sy - 56 * z;
        ctx.fillStyle = '#1c2742';
        ctx.beginPath();
        ctx.moveTo(sx - 20 * z, pedY);
        ctx.lineTo(sx, pedApexY);
        ctx.lineTo(sx + 20 * z, pedY);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 1.2 * z;
        ctx.stroke();

        // Central Tympanum Relief Medallion (Golden Open Book Emblem)
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(sx, pedY - 3.5 * z, 3 * z, 0, Math.PI * 2);
        ctx.fill();

        // 7. Central Observatory Dome & Spire (Cupola)
        const domeR = 10 * z;
        const domeY = pedApexY - 1 * z;
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(sx, domeY, domeR, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.lineWidth = 1 * z;
        ctx.stroke();

        // Dome ribs
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(sx - 5 * z, domeY);
        ctx.lineTo(sx, domeY - domeR);
        ctx.moveTo(sx + 5 * z, domeY);
        ctx.lineTo(sx, domeY - domeR);
        ctx.stroke();

        // Spire & Golden Finial
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.2 * z;
        ctx.beginPath();
        ctx.moveTo(sx, domeY - domeR);
        ctx.lineTo(sx, domeY - domeR - 8 * z);
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(sx, domeY - domeR - 8 * z, 1.8 * z, 0, Math.PI * 2);
        ctx.fill();

        // 8. Floating Holographic Tome Beacon (Animated Bob & Levitating Aura)
        const tomeY = domeY - domeR - 18 * z + bob;

        // Holographic particle glints
        const glintOffset = Math.sin(this.tick * 0.12);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.beginPath();
        ctx.arc(sx - 10 * z + glintOffset * 2 * z, tomeY - 2 * z, 1.2 * z, 0, Math.PI * 2);
        ctx.arc(sx + 10 * z - glintOffset * 2 * z, tomeY + 2 * z, 1.2 * z, 0, Math.PI * 2);
        ctx.fill();

        // Floating holo aura
        ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.beginPath();
        ctx.arc(sx, tomeY, 11 * z, 0, Math.PI * 2);
        ctx.fill();

        // Open 3D Tome - Left Page & Right Page
        // Covers
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.roundRect(sx - 8 * z, tomeY - 5 * z, 16 * z, 10 * z, 1.5 * z);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 0.8 * z;
        ctx.stroke();

        // Luminous Pages
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(sx - 7 * z, tomeY - 4 * z, 14 * z, 8 * z, 1 * z);
        ctx.fill();

        // Book spine & text lines
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(sx - 0.5 * z, tomeY - 4 * z, 1 * z, 8 * z);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(sx - 5.5 * z, tomeY - 2 * z, 4 * z, 0.8 * z);
        ctx.fillRect(sx - 5.5 * z, tomeY + 0.5 * z, 4 * z, 0.8 * z);
        ctx.fillRect(sx + 1.5 * z, tomeY - 2 * z, 4 * z, 0.8 * z);
        ctx.fillRect(sx + 1.5 * z, tomeY + 0.5 * z, 4 * z, 0.8 * z);

        // 9. Interactive Hover Reticle Tooltip (Impeccable Quiet Luxury)
        if (isHovered) {
          const pillY = tomeY - 14 * z;
          const title = '📚 The Grand Codex';
          const sub = 'Click to Enter';

          ctx.font = `bold ${Math.max(10, Math.floor(11 * z))}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
          const tw = ctx.measureText(title).width;
          const pw = tw + 28 * z;
          const ph = 24 * z;

          // Drop Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
          ctx.beginPath();
          ctx.roundRect(sx - pw / 2 + 2 * z, pillY - ph / 2 + 3 * z, pw, ph, 6 * z);
          ctx.fill();

          // Card Body
          ctx.fillStyle = '#0d121c';
          ctx.beginPath();
          ctx.roundRect(sx - pw / 2, pillY - ph / 2, pw, ph, 6 * z);
          ctx.fill();

          // Hairline Border
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
          ctx.lineWidth = 1 * z;
          ctx.stroke();

          // Text
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = '#f8fafc';
          ctx.fillText(title, sx, pillY - 8.5 * z);

          ctx.font = `500 ${Math.max(8, Math.floor(8.5 * z))}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(sub, sx, pillY + 3.5 * z);
        }
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

      case 'cyber_glitch_byte':
      case 'cyber_glitch_mantis':
      case 'cyber_glitch_null': {
        const isByte = prop.type === 'cyber_glitch_byte';
        const isMantis = prop.type === 'cyber_glitch_mantis';
        const primaryColor = isByte ? '#00f0ff' : isMantis ? '#10b981' : '#f59e0b';
        const glowColor = isByte ? 'rgba(0, 240, 255, 0.35)' : isMantis ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)';

        const hoverBob = Math.sin(this.tick * 0.15 + (isByte ? 0 : isMantis ? 2 : 4)) * 3 * z;
        const wingFlap = Math.sin(this.tick * 0.5) * 4 * z;

        // 1. Contact Ground Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 7 * z, 3.5 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. Ambient Pulsing Neon Aura
        ctx.fillStyle = glowColor;
        ctx.beginPath();
        ctx.ellipse(sx, sy - 8 * z + hoverBob, 12 * z, 10 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // 3. Translucent Fluttering Wings
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.ellipse(sx - 4 * z, sy - 11 * z + hoverBob + wingFlap, 5 * z, 2.5 * z, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(sx + 4 * z, sy - 11 * z + hoverBob + wingFlap, 5 * z, 2.5 * z, 0.4, 0, Math.PI * 2);
        ctx.fill();

        // 4. Pixel Bug Core Body
        ctx.fillStyle = primaryColor;
        ctx.beginPath();
        ctx.roundRect(sx - 3.5 * z, sy - 10 * z + hoverBob, 7 * z, 7 * z, 2 * z);
        ctx.fill();

        // 5. Glowing Eyes
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx - 2 * z, sy - 9 * z + hoverBob, 1.5 * z, 1.5 * z);
        ctx.fillRect(sx + 0.5 * z, sy - 9 * z + hoverBob, 1.5 * z, 1.5 * z);

        // 6. Floating Sparkle Particles
        const sparkOffset = (this.tick * 0.4) % 12;
        ctx.fillStyle = primaryColor;
        ctx.fillRect(sx + Math.sin(this.tick * 0.2) * 6 * z, sy - 14 * z + hoverBob - sparkOffset * z * 0.5, 1.5 * z, 1.5 * z);
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
        const isHovered = this.hoveredSecret?.id === 'retro_arcade';
        const bob = Math.sin(this.tick * 0.08) * 2.5 * z;

        // 1. Broad Neon Ambient Underglow & Shadow
        ctx.fillStyle = isHovered ? 'rgba(236, 72, 153, 0.22)' : 'rgba(236, 72, 153, 0.12)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 3 * z, 56 * z, 14 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isHovered ? 'rgba(6, 182, 212, 0.20)' : 'rgba(6, 182, 212, 0.10)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 4 * z, 44 * z, 10 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. Cyber Gaming Plaza Platform (Elevated Synthwave Floor Grid)
        const platW = 90 * z;
        const platH = 14 * z;
        const platX = sx - platW / 2;
        const platY = sy - 6 * z;

        // Platform base
        ctx.fillStyle = '#0a0d18';
        ctx.beginPath();
        ctx.roundRect(platX, platY, platW, platH, 4 * z);
        ctx.fill();
        ctx.strokeStyle = isHovered ? '#ec4899' : 'rgba(236, 72, 153, 0.45)';
        ctx.lineWidth = isHovered ? 1.5 * z : 1 * z;
        ctx.stroke();

        // High-Tech Synthwave Checkerboard Floor Tiles (6 Columns)
        const cols = 6;
        const colW = (platW - 8 * z) / cols;
        for (let c = 0; c < cols; c++) {
          ctx.fillStyle = c % 2 === 0 ? '#13112c' : '#0c1222';
          ctx.fillRect(platX + 4 * z + c * colW, platY + 2 * z, colW - 1 * z, platH - 4 * z);
        }

        // Front Neon Edge Accent Lines
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.65)';
        ctx.lineWidth = 1 * z;
        ctx.beginPath();
        ctx.moveTo(platX + 6 * z, platY + platH - 2 * z);
        ctx.lineTo(platX + platW - 6 * z, platY + platH - 2 * z);
        ctx.stroke();

        // 3. Entrance Neon Stanchions (Cyan & Magenta Beacons)
        // Left Cyan Stanchion
        const leftSx = platX + 5 * z;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(leftSx - 1.5 * z, sy - 18 * z, 3 * z, 16 * z);
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.arc(leftSx, sy - 19 * z, 3 * z, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(6, 182, 212, 0.28)';
        ctx.beginPath();
        ctx.arc(leftSx, sy - 19 * z, 8 * z, 0, Math.PI * 2);
        ctx.fill();

        // Right Magenta Stanchion
        const rightSx = platX + platW - 5 * z;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(rightSx - 1.5 * z, sy - 18 * z, 3 * z, 16 * z);
        ctx.fillStyle = '#ec4899';
        ctx.beginPath();
        ctx.arc(rightSx, sy - 19 * z, 3 * z, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(236, 72, 153, 0.28)';
        ctx.beginPath();
        ctx.arc(rightSx, sy - 19 * z, 8 * z, 0, Math.PI * 2);
        ctx.fill();

        // 4. Industrial Overhead Support Trusses
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2 * z;
        ctx.beginPath();
        ctx.moveTo(platX + 10 * z, sy - 6 * z);
        ctx.lineTo(platX + 10 * z, sy - 52 * z);
        ctx.moveTo(platX + platW - 10 * z, sy - 6 * z);
        ctx.lineTo(platX + platW - 10 * z, sy - 52 * z);
        ctx.stroke();

        // Cross-struts on pillars
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1 * z;
        for (let py = -10; py > -50; py -= 10) {
          ctx.beginPath();
          ctx.moveTo(platX + 8 * z, sy + py * z);
          ctx.lineTo(platX + 12 * z, sy + (py - 6) * z);
          ctx.moveTo(platX + platW - 12 * z, sy + py * z);
          ctx.lineTo(platX + platW - 8 * z, sy + (py - 6) * z);
          ctx.stroke();
        }

        // 5. Trio of Physical Arcade Cabinets
        // ── Cabinet A (Left: "CYBER VOID" Shooter) ──
        const cabLW = 18 * z;
        const cabLH = 32 * z;
        const cabLX = sx - 28 * z;
        const cabLY = sy - 34 * z;

        ctx.fillStyle = '#090d16';
        ctx.fillRect(cabLX, cabLY, cabLW, cabLH);
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1 * z;
        ctx.strokeRect(cabLX, cabLY, cabLW, cabLH);

        // Cab A Marquee
        ctx.fillStyle = '#0891b2';
        ctx.fillRect(cabLX + 1 * z, cabLY + 1 * z, cabLW - 2 * z, 5 * z);
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(6, Math.round(5 * z))}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('VOID', cabLX + cabLW / 2, cabLY + 5 * z);

        // Cab A Screen (Animated Starfield)
        ctx.fillStyle = '#020617';
        ctx.fillRect(cabLX + 2 * z, cabLY + 8 * z, cabLW - 4 * z, 12 * z);
        ctx.fillStyle = '#38bdf8';
        for (let s = 0; s < 4; s++) {
          const sX = cabLX + 3 * z + ((s * 3.5 + this.tick * 0.2) % (cabLW - 6 * z));
          const sY = cabLY + 9 * z + ((s * 2.7) % 10 * z);
          ctx.fillRect(sX, sY, 1.2 * z, 1.2 * z);
        }

        // Cab A Controls
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(cabLX + 1 * z, cabLY + 21 * z, cabLW - 2 * z, 5 * z);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(cabLX + 4 * z, cabLY + 20 * z, 2 * z, 2 * z); // Stick
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(cabLX + 11 * z, cabLY + 22 * z, 2 * z, 2 * z); // Button

        // ── Cabinet B (Right: "NEON FIGHTER") ──
        const cabRW = 18 * z;
        const cabRH = 32 * z;
        const cabRX = sx + 10 * z;
        const cabRY = sy - 34 * z;

        ctx.fillStyle = '#090d16';
        ctx.fillRect(cabRX, cabRY, cabRW, cabRH);
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 1 * z;
        ctx.strokeRect(cabRX, cabRY, cabRW, cabRH);

        // Cab B Marquee
        ctx.fillStyle = '#db2777';
        ctx.fillRect(cabRX + 1 * z, cabRY + 1 * z, cabRW - 2 * z, 5 * z);
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(6, Math.round(5 * z))}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('FIGHT', cabRX + cabRW / 2, cabLY + 5 * z);

        // Cab B Screen (Animated Fighter Healthbars)
        ctx.fillStyle = '#180d24';
        ctx.fillRect(cabRX + 2 * z, cabRY + 8 * z, cabRW - 4 * z, 12 * z);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(cabRX + 3 * z, cabRY + 9 * z, 4 * z, 1.5 * z);
        ctx.fillStyle = '#ec4899';
        ctx.fillRect(cabRX + cabRW - 7 * z, cabRY + 9 * z, 4 * z, 1.5 * z);
        // Little pixel sprites
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(cabRX + 4 * z, cabRY + 13 * z, 3 * z, 5 * z);
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(cabRX + cabRW - 7 * z, cabRY + 13 * z, 3 * z, 5 * z);

        // Cab B Controls
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(cabRX + 1 * z, cabRY + 21 * z, cabRW - 2 * z, 5 * z);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(cabRX + 4 * z, cabRY + 20 * z, 2 * z, 2 * z);
        ctx.fillStyle = '#a855f7';
        ctx.fillRect(cabRX + 11 * z, cabRY + 22 * z, 2 * z, 2 * z);

        // ── Cabinet C (Center Flagship: "BYTE SNAKE 2084") ──
        const cabCW = 24 * z;
        const cabCH = 42 * z;
        const cabCX = sx - cabCW / 2;
        const cabCY = sy - 44 * z;

        // Shadow & Body
        ctx.fillStyle = '#060911';
        ctx.fillRect(cabCX, cabCY, cabCW, cabCH);
        ctx.strokeStyle = isHovered ? '#fbbf24' : '#f59e0b';
        ctx.lineWidth = isHovered ? 1.8 * z : 1.2 * z;
        ctx.strokeRect(cabCX, cabCY, cabCW, cabCH);

        // Side Art Stripes
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
        ctx.lineWidth = 1 * z;
        ctx.beginPath();
        ctx.moveTo(cabCX + 2 * z, cabCY + 8 * z);
        ctx.lineTo(cabCX + 2 * z, cabCY + cabCH - 8 * z);
        ctx.moveTo(cabCX + cabCW - 2 * z, cabCY + 8 * z);
        ctx.lineTo(cabCX + cabCW - 2 * z, cabCY + cabCH - 8 * z);
        ctx.stroke();

        // Flagship Marquee ("BYTE SNAKE")
        ctx.fillStyle = isHovered ? '#f59e0b' : '#d97706';
        ctx.fillRect(cabCX + 1 * z, cabCY + 1 * z, cabCW - 2 * z, 7 * z);
        ctx.fillStyle = '#000000';
        ctx.font = `bold ${Math.max(7, Math.round(6.5 * z))}px 'Outfit', monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('SNAKE', sx, cabCY + 6.5 * z);

        // Flagship CRT Screen (Active Animated Snake mini-game)
        const scrW = cabCW - 4 * z;
        const scrH = 15 * z;
        const scrX = cabCX + 2 * z;
        const scrY = cabCY + 10 * z;

        ctx.fillStyle = '#022c22'; // Phosphor Dark Green
        ctx.fillRect(scrX, scrY, scrW, scrH);
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
        ctx.lineWidth = 0.8 * z;
        ctx.strokeRect(scrX, scrY, scrW, scrH);

        // Score display on screen
        ctx.fillStyle = 'rgba(34, 197, 94, 0.7)';
        ctx.font = `${Math.max(5, Math.round(4 * z))}px monospace`;
        ctx.textAlign = 'right';
        ctx.fillText('2084', scrX + scrW - 1 * z, scrY + 4 * z);

        // Animated Retro Snake crawling across screen
        const snakeStep = (this.tick * 0.15) % 12;
        ctx.fillStyle = '#22c55e'; // Bright green snake body
        ctx.fillRect(scrX + 3 * z + snakeStep * 0.8 * z, scrY + 8 * z, 2.5 * z, 2 * z);
        ctx.fillRect(scrX + 1.5 * z + snakeStep * 0.8 * z, scrY + 8 * z, 2 * z, 2 * z);
        ctx.fillRect(scrX + 1.5 * z + snakeStep * 0.8 * z, scrY + 10 * z, 2 * z, 2 * z);
        ctx.fillRect(scrX + 0 * z + snakeStep * 0.8 * z, scrY + 10 * z, 2 * z, 2 * z);

        // Glowing Apple Target
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(scrX + scrW - 4 * z, scrY + 8 * z, 2.5 * z, 2.5 * z);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(scrX + scrW - 3.5 * z, scrY + 7 * z, 1.2 * z, 1 * z); // leaf

        // CRT Scanline Overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        for (let l = 1; l < scrH; l += 2 * z) {
          ctx.fillRect(scrX, scrY + l, scrW, 1 * z);
        }

        // Flagship Control Deck
        const deckY = cabCY + 26 * z;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(cabCX + 1 * z, deckY, cabCW - 2 * z, 6 * z);

        // Joystick (Red balltop)
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(cabCX + 5 * z, deckY - 2 * z, 1 * z, 4 * z);
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(cabCX + 5.5 * z, deckY - 3 * z, 2 * z, 0, Math.PI * 2);
        ctx.fill();

        // Action Buttons (Cyan, Yellow, Red, Green)
        const btnColors = ['#06b6d4', '#eab308', '#ef4444', '#22c55e'];
        for (let b = 0; b < 4; b++) {
          ctx.fillStyle = btnColors[b];
          ctx.beginPath();
          ctx.arc(cabCX + 12 * z + (b % 2) * 4 * z, deckY + 1.5 * z + Math.floor(b / 2) * 2.5 * z, 1.2 * z, 0, Math.PI * 2);
          ctx.fill();
        }

        // Coin Door & Pulsing 25¢ Insert Slot
        const coinY = cabCY + 33 * z;
        ctx.fillStyle = '#0b0f19';
        ctx.fillRect(cabCX + 4 * z, coinY, cabCW - 8 * z, 8 * z);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 0.8 * z;
        ctx.strokeRect(cabCX + 4 * z, coinY, cabCW - 8 * z, 8 * z);

        // Twin Orange glowing coin slots
        ctx.fillStyle = isHovered ? '#fbbf24' : '#f59e0b';
        ctx.fillRect(cabCX + 7 * z, coinY + 2 * z, 1.2 * z, 4 * z);
        ctx.fillRect(cabCX + cabCW - 8.2 * z, coinY + 2 * z, 1.2 * z, 4 * z);

        // 6. Overhead Grand Animated Marquee Sign ("🕹️ BYTE CADE")
        const marqW = 84 * z;
        const marqH = 18 * z;
        const marqX = sx - marqW / 2;
        const marqY = sy - 64 * z;

        // Sign Backing & Drop Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.beginPath();
        ctx.roundRect(marqX + 2 * z, marqY + 3 * z, marqW, marqH, 5 * z);
        ctx.fill();

        ctx.fillStyle = isHovered ? '#0b1020' : '#070a14';
        ctx.beginPath();
        ctx.roundRect(marqX, marqY, marqW, marqH, 4 * z);
        ctx.fill();
        ctx.strokeStyle = isHovered ? '#ec4899' : 'rgba(236, 72, 153, 0.6)';
        ctx.lineWidth = isHovered ? 2 * z : 1.2 * z;
        ctx.stroke();

        // Running Neon Border Chase Lights (Alternating Cyan/Yellow/Pink Dots)
        const numChase = 24;
        const chaseStep = (this.tick * 0.25) % numChase;
        for (let i = 0; i < numChase; i++) {
          const frac = (i + chaseStep) / numChase;
          let lx = marqX + 3 * z;
          let ly = marqY + 2 * z;
          if (frac < 0.35) {
            lx = marqX + 3 * z + frac * (marqW - 6 * z) / 0.35;
            ly = marqY + 2 * z;
          } else if (frac < 0.5) {
            lx = marqX + marqW - 3 * z;
            ly = marqY + 2 * z + (frac - 0.35) * (marqH - 4 * z) / 0.15;
          } else if (frac < 0.85) {
            lx = marqX + marqW - 3 * z - (frac - 0.5) * (marqW - 6 * z) / 0.35;
            ly = marqY + marqH - 2 * z;
          } else {
            lx = marqX + 3 * z;
            ly = marqY + marqH - 2 * z - (frac - 0.85) * (marqH - 4 * z) / 0.15;
          }

          const dotColors = ['#ec4899', '#06b6d4', '#fbbf24', '#a855f7'];
          ctx.fillStyle = dotColors[i % dotColors.length];
          ctx.beginPath();
          ctx.arc(lx, ly, 1.2 * z, 0, Math.PI * 2);
          ctx.fill();
        }

        // Marquee Text ("🕹️ BYTE CADE")
        ctx.font = `800 ${Math.max(9, Math.round(9.5 * z))}px 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        // Neon Glow Drop
        ctx.fillStyle = isHovered ? 'rgba(236, 72, 153, 0.8)' : 'rgba(236, 72, 153, 0.45)';
        ctx.fillText('🕹️ BYTE CADE', sx, marqY + 12.5 * z + 1 * z);
        // Crisp Text
        ctx.fillStyle = '#ffffff';
        ctx.fillText('🕹️ BYTE CADE', sx, marqY + 12.5 * z);

        // 7. Floating Animated Holographic Game Beacon
        const beaconY = marqY - 14 * z + bob;

        // Floating Pixel Joystick/Gamepad Halo
        ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
        ctx.beginPath();
        ctx.arc(sx, beaconY, 10 * z, 0, Math.PI * 2);
        ctx.fill();

        // Little floating pill: "PLAY 60FPS"
        ctx.fillStyle = isHovered ? '#fbbf24' : 'rgba(251, 191, 36, 0.9)';
        ctx.beginPath();
        ctx.roundRect(sx - 20 * z, beaconY - 5 * z, 40 * z, 10 * z, 5 * z);
        ctx.fill();
        ctx.fillStyle = '#0c0e14';
        ctx.font = `bold ${Math.max(7, Math.round(6.5 * z))}px 'Outfit', monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('PLAY 60FPS', sx, beaconY + 2.5 * z);

        // 8. Interactive Hover Tooltip (Quiet Luxury Elevation)
        if (isHovered) {
          const pillY = beaconY - 18 * z;
          const title = '🕹️ The Byte Cade';
          const sub = 'Click to Play Byte Snake 2084';

          ctx.font = `bold ${Math.max(10, Math.floor(11 * z))}px 'Outfit', sans-serif`;
          const tw = ctx.measureText(title).width;
          const pw = Math.max(tw + 28 * z, 160 * z);
          const ph = 26 * z;

          // Drop Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          ctx.beginPath();
          ctx.roundRect(sx - pw / 2 + 2 * z, pillY - ph / 2 + 3 * z, pw, ph, 7 * z);
          ctx.fill();

          // Card Body
          ctx.fillStyle = '#0d121c';
          ctx.beginPath();
          ctx.roundRect(sx - pw / 2, pillY - ph / 2, pw, ph, 7 * z);
          ctx.fill();
          ctx.strokeStyle = 'rgba(236, 72, 153, 0.55)';
          ctx.lineWidth = 1.2 * z;
          ctx.stroke();

          // Title
          ctx.fillStyle = '#f8fafc';
          ctx.textAlign = 'center';
          ctx.fillText(title, sx, pillY - 2 * z);

          // Subtitle
          ctx.fillStyle = '#ec4899';
          ctx.font = `600 ${Math.max(8, Math.floor(8.5 * z))}px 'Outfit', sans-serif`;
          ctx.fillText(sub, sx, pillY + 8 * z);
        }
        break;
      }

      case 'museum_door': {
        const glow = Math.sin(this.tick * 0.06) * 0.12 + 0.88;
        // ground shadow + spotlight pools
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.beginPath(); ctx.ellipse(sx, sy + 12 * z, 34 * z, 10 * z, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = `rgba(251,191,36,${0.10 * glow})`;
        ctx.beginPath(); ctx.ellipse(sx, sy + 10 * z, 48 * z, 16 * z, 0, 0, Math.PI*2); ctx.fill();

        // stepped podium (3 steps)
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(sx - 26 * z, sy + 4 * z, 52 * z, 4 * z);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(sx - 30 * z, sy + 8 * z, 60 * z, 4 * z);
        ctx.strokeStyle = 'rgba(148,163,184,0.25)'; ctx.lineWidth = 1 * z;
        ctx.strokeRect(sx - 30 * z, sy + 8 * z, 60 * z, 4 * z);

        // main façade block with cornice
        ctx.fillStyle = '#162032';
        ctx.strokeStyle = `rgba(251,191,36,${0.55 * glow})`;
        ctx.lineWidth = 1.6 * z;
        ctx.beginPath(); ctx.roundRect(sx - 30 * z, sy - 32 * z, 60 * z, 38 * z, 4 * z); ctx.fill(); ctx.stroke();
        // cornice
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(sx - 32 * z, sy - 32 * z, 64 * z, 4 * z);
        ctx.fillStyle = '#334155';
        ctx.fillRect(sx - 32 * z, sy - 28 * z, 64 * z, 1.2 * z);

        // pediment triangle with ƒ(x) emblem
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.moveTo(sx - 22 * z, sy - 32 * z); ctx.lineTo(sx, sy - 42 * z); ctx.lineTo(sx + 22 * z, sy - 32 * z); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(251,191,36,0.55)'; ctx.lineWidth = 1.2 * z; ctx.stroke();
        ctx.fillStyle = '#facc15';
        ctx.font = `900 ${Math.max(10, Math.floor(10*z))}px 'Outfit', monospace`;
        ctx.textAlign = 'center'; ctx.fillText('ƒ(x)', sx, sy - 32.5 * z);

        // colonnade — 4 fluted columns
        for (const off of [-20, -7, 7, 20]) {
          const cx = sx + off * z;
          // shaft
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(cx - 2.2 * z, sy - 28 * z, 4.4 * z, 26 * z);
          // flutes
          ctx.fillStyle = 'rgba(15,23,42,0.18)';
          ctx.fillRect(cx - 1 * z, sy - 28 * z, 0.7 * z, 26 * z);
          ctx.fillRect(cx + 0.3 * z, sy - 28 * z, 0.7 * z, 26 * z);
          // capital
          ctx.fillStyle = '#f1f5f9';
          ctx.fillRect(cx - 3.5 * z, sy - 30 * z, 7 * z, 3 * z);
          // base
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(cx - 3.5 * z, sy - 3 * z, 7 * z, 2.5 * z);
          // uplight
          ctx.fillStyle = `rgba(251,191,36,${0.18 * glow})`;
          ctx.beginPath(); ctx.ellipse(cx, sy - 1 * z, 7 * z, 3 * z, 0, 0, Math.PI*2); ctx.fill();
        }

        // double glass doors with brass mullion
        ctx.fillStyle = 'rgba(125,211,252,0.18)';
        ctx.beginPath(); ctx.roundRect(sx - 16 * z, sy - 16 * z, 32 * z, 20 * z, 1.5 * z); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(sx - 16 * z, sy - 16 * z, 32 * z, 6 * z);
        ctx.strokeStyle = '#eab308'; ctx.lineWidth = 1.3 * z;
        ctx.strokeRect(sx - 16 * z, sy - 16 * z, 32 * z, 20 * z);
        ctx.fillStyle = '#eab308'; ctx.fillRect(sx - 0.8 * z, sy - 16 * z, 1.6 * z, 20 * z);
        ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(sx - 6 * z, sy - 6 * z, 1.1 * z, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(sx + 6 * z, sy - 6 * z, 1.1 * z, 0, Math.PI*2); ctx.fill();
        // interior glow spilling out
        ctx.fillStyle = `rgba(251,191,36,${0.10 * glow})`;
        ctx.fillRect(sx - 16 * z, sy - 16 * z, 32 * z, 20 * z);

        // suspended brass sign
        ctx.fillStyle = '#0f172a';
        ctx.beginPath(); ctx.roundRect(sx - 26 * z, sy - 22.5 * z, 52 * z, 9 * z, 3 * z); ctx.fill();
        ctx.strokeStyle = 'rgba(251,191,36,0.55)'; ctx.lineWidth = 1 * z; ctx.stroke();
        ctx.fillStyle = '#facc15';
        ctx.font = `900 ${Math.max(7, Math.floor(7*z))}px 'Outfit', monospace`;
        ctx.textAlign = 'center'; ctx.fillText('MATH ART MUSEUM', sx, sy - 16.5 * z);
        // hanging chains
        ctx.strokeStyle = 'rgba(148,163,184,0.55)'; ctx.lineWidth = 0.7 * z;
        ctx.beginPath(); ctx.moveTo(sx - 20 * z, sy - 30 * z); ctx.lineTo(sx - 22 * z, sy - 22.5 * z); ctx.moveTo(sx + 20 * z, sy - 30 * z); ctx.lineTo(sx + 22 * z, sy - 22.5 * z); ctx.stroke();

        // brass lanterns flanking doors
        for (const lx of [sx - 26 * z, sx + 26 * z]) {
          ctx.fillStyle = '#451a03'; ctx.fillRect(lx - 1.2 * z, sy - 10 * z, 2.4 * z, 10 * z);
          ctx.fillStyle = `rgba(251,191,36,${0.85 * glow})`;
          ctx.beginPath(); ctx.arc(lx, sy - 12 * z, 2.8 * z, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = `rgba(251,191,36,${0.22 * glow})`; ctx.beginPath(); ctx.arc(lx, sy - 12 * z, 7 * z, 0, Math.PI*2); ctx.fill();
        }

        // [E] ENTER pill with pulse
        ctx.fillStyle = `rgba(15,23,42,${0.92})`;
        ctx.beginPath(); ctx.roundRect(sx - 18 * z, sy + 6 * z, 36 * z, 8 * z, 4 * z); ctx.fill();
        ctx.strokeStyle = `rgba(56,189,248,${0.6 * glow})`; ctx.lineWidth = 1 * z; ctx.stroke();
        ctx.fillStyle = '#f8fafc';
        ctx.font = `700 ${Math.max(6, Math.floor(6*z))}px monospace`;
        ctx.textAlign = 'center'; ctx.fillText('[E] ENTER', sx, sy + 11.5 * z);
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

      case 'fountain':
      case 'wishing_fountain': {
        const isHovered = this.hoveredSecret?.id === 'wishing_fountain';
        // 1. Contact Drop Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 26 * z, 12 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. Ornate Hexagonal Carved Granite Basin
        ctx.fillStyle = isHovered ? '#38bdf8' : '#64748b';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 2 * z, 24 * z, 11 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 3 * z, 21 * z, 9.5 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // 3. Shimmering Turquoise Water with Animated Ripples
        const ripple = (this.tick * 0.05) % 1;
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 4 * z, 19 * z, 8 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 1 * z;
        ctx.beginPath();
        ctx.ellipse(sx, sy - 4 * z, (10 + ripple * 8) * z, (4 + ripple * 3.5) * z, 0, 0, Math.PI * 2);
        ctx.stroke();

        // 4. Floating Wishing Coins in the Water
        const coins = [
          { dx: -8, dy: -3, c: '#f59e0b' },
          { dx: 7, dy: -2, c: '#fbbf24' },
          { dx: -2, dy: -6, c: '#38bdf8' },
          { dx: 5, dy: -5, c: '#e2e8f0' },
          { dx: -6, dy: -5, c: '#f59e0b' },
        ];
        for (const coin of coins) {
          ctx.fillStyle = coin.c;
          ctx.beginPath();
          ctx.ellipse(sx + coin.dx * z, sy + coin.dy * z, 1.8 * z, 1.2 * z, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // 5. Central Spire & Pedestal
        ctx.fillStyle = '#475569';
        ctx.fillRect(sx - 4 * z, sy - 18 * z, 8 * z, 15 * z);
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 18 * z, 10 * z, 4 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // 6. Water Jets with Ambient Mist
        const jetHeight = (9 + Math.sin(this.tick * 0.15) * 2.5) * z;
        ctx.fillStyle = '#bae6fd';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 20 * z - jetHeight, 4 * z, 6 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Little water drops splashing
        ctx.fillStyle = 'rgba(224, 242, 254, 0.8)';
        for (let i = 0; i < 4; i++) {
          const dropOff = ((this.tick * 0.3 + i * 8) % 20) * z;
          const dropX = sx + Math.sin(i * 1.5 + this.tick * 0.1) * (6 + dropOff * 0.4) * z;
          const dropY = sy - 20 * z + dropOff * 0.6;
          ctx.fillRect(dropX, dropY, 1.5 * z, 1.5 * z);
        }

        // 7. Interactive Hover Indicator
        if (isHovered) {
          ctx.fillStyle = '#f59e0b';
          ctx.font = `bold ${Math.round(8 * z)}px monospace`;
          ctx.textAlign = 'center';
          ctx.fillText('🪙 TOSS COIN', sx, sy - 34 * z);
        }
        break;
      }

      case 'city_hall': {
        const isHovered = this.hoveredSecret?.id === 'city_hall';
        // 1. Broad Ambient Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 42 * z, 14 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. Grand Granite Steps & Podium
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.roundRect(sx - 36 * z, sy - 8 * z, 72 * z, 12 * z, 3 * z);
        ctx.fill();
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.roundRect(sx - 32 * z, sy - 14 * z, 64 * z, 10 * z, 2 * z);
        ctx.fill();

        // 3. Classical Cyber Pillars (4 Front Pillars)
        const pillarX = [-24, -8, 8, 24];
        for (const px of pillarX) {
          ctx.fillStyle = '#64748b';
          ctx.fillRect((sx + px * z) - 3 * z, sy - 44 * z, 6 * z, 31 * z);
          // Capital & Base
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect((sx + px * z) - 4 * z, sy - 46 * z, 8 * z, 3 * z);
          ctx.fillRect((sx + px * z) - 4 * z, sy - 15 * z, 8 * z, 2 * z);
        }

        // 4. Central Hall Facade & Glass Atrium
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(sx - 28 * z, sy - 44 * z, 56 * z, 30 * z);
        // Amber Windows
        ctx.fillStyle = 'rgba(251, 191, 36, 0.75)';
        ctx.fillRect(sx - 18 * z, sy - 38 * z, 8 * z, 14 * z);
        ctx.fillRect(sx + 10 * z, sy - 38 * z, 8 * z, 14 * z);
        // Central Golden Door
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(sx - 5 * z, sy - 28 * z, 10 * z, 14 * z);

        // 5. Entablature & Pediment (Triangle Roof)
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(sx - 34 * z, sy - 46 * z);
        ctx.lineTo(sx, sy - 64 * z);
        ctx.lineTo(sx + 34 * z, sy - 46 * z);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = isHovered ? '#f59e0b' : '#64748b';
        ctx.lineWidth = 1.5 * z;
        ctx.stroke();

        // 6. Central Clock Tower & Holographic Dome
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(sx - 10 * z, sy - 82 * z, 20 * z, 19 * z);
        // Glowing Clock Face
        ctx.fillStyle = 'rgba(56, 189, 248, 0.9)';
        ctx.beginPath();
        ctx.arc(sx, sy - 72 * z, 6 * z, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5 * z;
        ctx.beginPath();
        ctx.moveTo(sx, sy - 72 * z);
        ctx.lineTo(sx + 3 * z, sy - 72 * z);
        ctx.moveTo(sx, sy - 72 * z);
        ctx.lineTo(sx, sy - 75 * z);
        ctx.stroke();

        // 7. Golden Spire & Beacon
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2 * z;
        ctx.beginPath();
        ctx.moveTo(sx, sy - 82 * z);
        ctx.lineTo(sx, sy - 94 * z);
        ctx.stroke();
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(sx, sy - 94 * z, 2.5 * z, 0, Math.PI * 2);
        ctx.fill();

        // 8. Scrolling LED Census Marquee
        ctx.fillStyle = '#090d16';
        ctx.fillRect(sx - 24 * z, sy - 52 * z, 48 * z, 7 * z);
        ctx.fillStyle = '#38bdf8';
        ctx.font = `bold ${Math.round(5 * z)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('✦ 10,000 PLOTS • SPOT REGISTRY ✦', sx, sy - 47 * z);
        break;
      }

      case 'cafe_storefront': {
        const isHovered = this.hoveredSecret?.id === 'cafe_storefront';
        // 1. Ground Drop Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 26 * z, 10 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. Warm Red Terracotta Brick Facade
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.roundRect(sx - 22 * z, sy - 34 * z, 44 * z, 34 * z, 2 * z);
        ctx.fill();

        // 3. Large Amber-Glow Bay Windows
        ctx.fillStyle = 'rgba(251, 191, 36, 0.75)';
        ctx.fillRect(sx - 18 * z, sy - 24 * z, 14 * z, 16 * z);
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 1 * z;
        ctx.strokeRect(sx - 18 * z, sy - 24 * z, 14 * z, 16 * z);
        // Window mullions
        ctx.beginPath();
        ctx.moveTo(sx - 11 * z, sy - 24 * z); ctx.lineTo(sx - 11 * z, sy - 8 * z);
        ctx.moveTo(sx - 18 * z, sy - 16 * z); ctx.lineTo(sx - 4 * z, sy - 16 * z);
        ctx.stroke();

        // 4. Wooden Entrance Door with Brass Knob
        ctx.fillStyle = '#451a03';
        ctx.fillRect(sx + 1 * z, sy - 24 * z, 12 * z, 24 * z);
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(sx + 10 * z, sy - 12 * z, 1.2 * z, 0, Math.PI * 2);
        ctx.fill();

        // 5. Classic Striped Awning (Amber & Cream)
        const awningW = 46 * z;
        const awningH = 9 * z;
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(sx - awningW / 2, sy - 36 * z, awningW, awningH);
        // Amber stripes
        ctx.fillStyle = '#d97706';
        for (let i = 0; i < 5; i++) {
          ctx.fillRect(sx - 22 * z + i * 9 * z, sy - 36 * z, 4.5 * z, awningH);
        }

        // 6. Glowing Neon "SPOT CAFE" Sign
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(sx - 16 * z, sy - 46 * z, 32 * z, 9 * z);
        ctx.strokeStyle = isHovered ? '#38bdf8' : '#f59e0b';
        ctx.lineWidth = 1 * z;
        ctx.strokeRect(sx - 16 * z, sy - 46 * z, 32 * z, 9 * z);
        ctx.fillStyle = isHovered ? '#38bdf8' : '#f59e0b';
        ctx.font = `bold ${Math.round(5.5 * z)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('☕ SPOT CAFE', sx, sy - 39.5 * z);

        // 7. Chimney with Rising Coffee Roast Steam
        ctx.fillStyle = '#57534e';
        ctx.fillRect(sx - 18 * z, sy - 52 * z, 6 * z, 12 * z);
        ctx.fillStyle = 'rgba(254, 243, 199, 0.45)';
        for (let i = 0; i < 3; i++) {
          const steamOff = ((this.tick * 0.3 + i * 16) % 36) * z;
          const steamX = sx - 15 * z + Math.sin(this.tick * 0.1 + i) * 3 * z;
          ctx.beginPath();
          ctx.arc(steamX, sy - 54 * z - steamOff, (2 + steamOff * 0.1) * z, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'grand_station': {
        const isHovered = this.hoveredSecret?.id === 'grand_station';
        // 1. Broad Drop Shadow across Railway Concourse
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 46 * z, 14 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. High-Tech Steel Concourse Archway
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect(sx - 40 * z, sy - 32 * z, 80 * z, 32 * z, 4 * z);
        ctx.fill();

        // Cyan glass facade
        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.fillRect(sx - 34 * z, sy - 28 * z, 68 * z, 22 * z);
        ctx.strokeStyle = isHovered ? '#00f0ff' : 'rgba(56, 189, 248, 0.5)';
        ctx.lineWidth = 1.5 * z;
        ctx.strokeRect(sx - 34 * z, sy - 28 * z, 68 * z, 22 * z);

        // Truss diagonal supports
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1 * z;
        ctx.beginPath();
        for (let x = -30; x <= 30; x += 15) {
          ctx.moveTo(sx + x * z, sy - 28 * z);
          ctx.lineTo(sx + (x + 8) * z, sy - 6 * z);
        }
        ctx.stroke();

        // 3. Elevated Transit Sign & Departure Board
        ctx.fillStyle = '#020617';
        ctx.fillRect(sx - 26 * z, sy - 44 * z, 52 * z, 11 * z);
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.2 * z;
        ctx.strokeRect(sx - 26 * z, sy - 44 * z, 52 * z, 11 * z);

        ctx.fillStyle = '#00f0ff';
        ctx.font = `bold ${Math.round(5.5 * z)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('🚄 GRAND METRO TERMINAL', sx, sy - 36.5 * z);

        // 4. Dual Flashing Railway Aviation Signals
        const signalBlink = Math.floor(this.tick / 30) % 2 === 0;
        ctx.fillStyle = signalBlink ? '#ef4444' : '#10b981';
        ctx.beginPath();
        ctx.arc(sx - 36 * z, sy - 40 * z, 2.5 * z, 0, Math.PI * 2);
        ctx.arc(sx + 36 * z, sy - 40 * z, 2.5 * z, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'parked_delorean': {
        // 1. Cyber DeLorean DMC-12 Parked outside Retro Arcade
        // Contact Shadow & Cyan Flux Underglow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
        ctx.beginPath();
        ctx.roundRect(sx - 24 * z, sy - 8 * z, 48 * z, 16 * z, 4 * z);
        ctx.fill();

        ctx.fillStyle = 'rgba(6, 182, 212, 0.28)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 26 * z, 10 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // 4 Wheels
        ctx.fillStyle = '#090d16';
        ctx.fillRect(sx - 20 * z, sy - 10 * z, 8 * z, 3 * z);
        ctx.fillRect(sx + 12 * z, sy - 10 * z, 8 * z, 3 * z);
        ctx.fillRect(sx - 20 * z, sy + 7 * z, 8 * z, 3 * z);
        ctx.fillRect(sx + 12 * z, sy + 7 * z, 8 * z, 3 * z);

        // Stainless Steel Wedge Body
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.roundRect(sx - 23 * z, sy - 8 * z, 46 * z, 16 * z, 3 * z);
        ctx.fill();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1 * z;
        ctx.stroke();

        // Black Hood Accent & Louvers
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(sx - 10 * z, sy - 6 * z, 16 * z, 12 * z);
        // Rear window louvers
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(sx - 21 * z, sy - 5 * z, 9 * z, 10 * z);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 0.8 * z;
        for (let lx = -20; lx <= -14; lx += 2) {
          ctx.beginPath();
          ctx.moveTo(sx + lx * z, sy - 5 * z);
          ctx.lineTo(sx + lx * z, sy + 5 * z);
          ctx.stroke();
        }

        // Amber Front Indicators & Dual Red Taillights
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(sx + 21 * z, sy - 6 * z, 2 * z, 2.5 * z);
        ctx.fillRect(sx + 21 * z, sy + 3.5 * z, 2 * z, 2.5 * z);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(sx - 23 * z, sy - 6 * z, 2 * z, 2.5 * z);
        ctx.fillRect(sx - 23 * z, sy + 3.5 * z, 2 * z, 2.5 * z);

        // Hover Text
        const isHovered = Math.hypot(this.player.wx - prop.wx, this.player.wy - prop.wy) < 45;
        if (isHovered) {
          ctx.fillStyle = '#06b6d4';
          ctx.font = `bold ${Math.round(6.5 * z)}px monospace`;
          ctx.textAlign = 'center';
          ctx.fillText('⚡ DMC-12 CYBER EDIT', sx, sy - 14 * z);
        }
        break;
      }

      case 'city_parking_bay': {
        // ── City Central EV Parking Bay & Charging Terminals ──
        // 1. Asphalt Parking Pad with Distinct Stalls (Wider for 3 parallel stalls)
        ctx.fillStyle = '#1e293b'; // Charcoal parking surface
        ctx.fillRect(sx - 45 * z, sy - 20 * z, 90 * z, 40 * z);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.2 * z;
        ctx.strokeRect(sx - 45 * z, sy - 20 * z, 90 * z, 40 * z);

        // 2. White Painted Parking Stall Lines (3 Neat Parallel Parking Stalls)
        // Stalls are at: Slot 1: [-42..-16], Slot 2: [-13..13], Slot 3: [16..42]
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 1.5 * z;
        const stallWidth = 26 * z;
        const stallHeight = 34 * z;
        const stallY = sy - 17 * z;
        const stallXs = [sx - 41 * z, sx - 13 * z, sx + 15 * z];

        for (const stX of stallXs) {
          ctx.strokeRect(stX, stallY, stallWidth, stallHeight);
        }

        // Painted Ground Markings: [⚡ EV 1] [⚡ EV 2] [P 3]
        ctx.fillStyle = 'rgba(6, 182, 212, 0.45)';
        ctx.font = `bold ${Math.round(6.5 * z)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡ EV', sx - 28 * z, sy + 11 * z);
        ctx.fillText('⚡ EV', sx, sy + 11 * z);
        ctx.fillStyle = 'rgba(248, 250, 252, 0.4)';
        ctx.fillText('P', sx + 28 * z, sy + 11 * z);

        // ── 3. Stall 1 (Left): Aligned Cyber Sedan (Synthwave Violet) ──
        const c1X = sx - 28 * z;
        const c1Y = sy - 3 * z;
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
        ctx.beginPath();
        ctx.roundRect(c1X - 10 * z, c1Y - 11 * z, 20 * z, 22 * z, 3 * z);
        ctx.fill();
        // Wheels
        ctx.fillStyle = '#090d16';
        ctx.fillRect(c1X - 11 * z, c1Y - 10 * z, 2.5 * z, 5 * z);
        ctx.fillRect(c1X + 8.5 * z, c1Y - 10 * z, 2.5 * z, 5 * z);
        ctx.fillRect(c1X - 11 * z, c1Y + 5 * z, 2.5 * z, 5 * z);
        ctx.fillRect(c1X + 8.5 * z, c1Y + 5 * z, 2.5 * z, 5 * z);
        // Body
        ctx.fillStyle = '#8b5cf6';
        ctx.beginPath();
        ctx.roundRect(c1X - 9 * z, c1Y - 11 * z, 18 * z, 22 * z, 3 * z);
        ctx.fill();
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 0.8 * z;
        ctx.stroke();
        // Windshield and Roof
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(c1X - 7 * z, c1Y - 7 * z, 14 * z, 13 * z);
        ctx.fillStyle = '#38bdf8'; // Glass
        ctx.fillRect(c1X - 6 * z, c1Y - 6 * z, 12 * z, 4 * z);
        ctx.fillRect(c1X - 6 * z, c1Y + 2 * z, 12 * z, 3 * z);
        // Neon Headlights
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(c1X - 7.5 * z, c1Y - 11 * z, 3 * z, 1.5 * z);
        ctx.fillRect(c1X + 4.5 * z, c1Y - 11 * z, 3 * z, 1.5 * z);

        // ── 4. Stall 2 (Center): Aligned Autonomous Cyber Taxi (Yellow & Black) ──
        const c2X = sx;
        const c2Y = sy - 3 * z;
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
        ctx.beginPath();
        ctx.roundRect(c2X - 10 * z, c2Y - 11 * z, 20 * z, 22 * z, 3 * z);
        ctx.fill();
        // Wheels
        ctx.fillStyle = '#090d16';
        ctx.fillRect(c2X - 11 * z, c2Y - 10 * z, 2.5 * z, 5 * z);
        ctx.fillRect(c2X + 8.5 * z, c2Y - 10 * z, 2.5 * z, 5 * z);
        ctx.fillRect(c2X - 11 * z, c2Y + 5 * z, 2.5 * z, 5 * z);
        ctx.fillRect(c2X + 8.5 * z, c2Y + 5 * z, 2.5 * z, 5 * z);
        // Body
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.roundRect(c2X - 9 * z, c2Y - 11 * z, 18 * z, 22 * z, 3 * z);
        ctx.fill();
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 0.8 * z;
        ctx.stroke();
        // Windshield and Checker Roof Sign
        ctx.fillStyle = '#18181b';
        ctx.fillRect(c2X - 7 * z, c2Y - 7 * z, 14 * z, 13 * z);
        ctx.fillStyle = '#67e8f9'; // Tinted Glass
        ctx.fillRect(c2X - 6 * z, c2Y - 6 * z, 12 * z, 4 * z);
        ctx.fillRect(c2X - 6 * z, c2Y + 2 * z, 12 * z, 3 * z);
        // Illuminated Rooftop Taxi Sign
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(c2X - 4 * z, c2Y - 2 * z, 8 * z, 4 * z);
        ctx.fillStyle = '#fde047';
        ctx.font = `bold ${Math.round(4 * z)}px monospace`;
        ctx.fillText('TAXI', c2X, c2Y);
        // Headlights
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(c2X - 7.5 * z, c2Y - 11 * z, 3 * z, 1.5 * z);
        ctx.fillRect(c2X + 4.5 * z, c2Y - 11 * z, 3 * z, 1.5 * z);

        // ── 5. Stall 3 (Right): Aligned Cyber Coupe (Emerald Green / Carbon) ──
        const c3X = sx + 28 * z;
        const c3Y = sy - 3 * z;
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
        ctx.beginPath();
        ctx.roundRect(c3X - 9.5 * z, c3Y - 11 * z, 19 * z, 22 * z, 3 * z);
        ctx.fill();
        // Wheels
        ctx.fillStyle = '#090d16';
        ctx.fillRect(c3X - 10.5 * z, c3Y - 10 * z, 2.5 * z, 5 * z);
        ctx.fillRect(c3X + 8 * z, c3Y - 10 * z, 2.5 * z, 5 * z);
        ctx.fillRect(c3X - 10.5 * z, c3Y + 5 * z, 2.5 * z, 5 * z);
        ctx.fillRect(c3X + 8 * z, c3Y + 5 * z, 2.5 * z, 5 * z);
        // Body
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.roundRect(c3X - 8.5 * z, c3Y - 11 * z, 17 * z, 22 * z, 3 * z);
        ctx.fill();
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 0.8 * z;
        ctx.stroke();
        // Black Racing Stripe & Glass
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(c3X - 6.5 * z, c3Y - 7 * z, 13 * z, 13 * z);
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(c3X - 5.5 * z, c3Y - 6 * z, 11 * z, 4 * z);
        ctx.fillRect(c3X - 5.5 * z, c3Y + 2 * z, 11 * z, 3 * z);
        // Headlights
        ctx.fillStyle = '#6ee7b7';
        ctx.fillRect(c3X - 7 * z, c3Y - 11 * z, 2.5 * z, 1.5 * z);
        ctx.fillRect(c3X + 4.5 * z, c3Y - 11 * z, 2.5 * z, 1.5 * z);

        // ── 6. EV Fast-Charging Dual Terminals (Posts between stalls) ──
        const chargerXs = [sx - 14 * z, sx + 14 * z];
        for (const chX of chargerXs) {
          ctx.fillStyle = '#334155';
          ctx.fillRect(chX - 2.5 * z, sy - 21 * z, 5 * z, 7 * z);
          // Blinking status screen
          const chargeBlink = (this.tick % 40) < 20;
          ctx.fillStyle = chargeBlink ? '#06b6d4' : '#0891b2';
          ctx.fillRect(chX - 1.8 * z, sy - 19.5 * z, 3.6 * z, 2.5 * z);
        }

        // Hover tooltip
        const isCityHovered = Math.hypot(this.player.wx - prop.wx, this.player.wy - prop.wy) < 65;
        if (isCityHovered) {
          ctx.fillStyle = '#38bdf8';
          ctx.font = `bold ${Math.round(6.5 * z)}px monospace`;
          ctx.textAlign = 'center';
          ctx.fillText('🅿️ DOWNTOWN PARKING LOT', sx, sy - 24 * z);
        }
        break;
      }

      case 'beach_parking_bay': {
        // ── Coastal Beach Parking Slot overlooking Boardwalk & Waves ──
        // 1. Packed Coastal Basalt Road Terminal
        ctx.fillStyle = '#334155';
        ctx.fillRect(sx - 45 * z, sy - 20 * z, 90 * z, 40 * z);
        // Weathered driftwood curb at bottom bordering the boardwalk/sand
        ctx.fillStyle = '#78350f';
        ctx.fillRect(sx - 45 * z, sy + 18 * z, 90 * z, 3 * z);

        // 2. Yellow Weathered Parking Stall Lines (3 Neat Parallel Beach Stalls)
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5 * z;
        const bStallWidth = 26 * z;
        const bStallHeight = 34 * z;
        const bStallY = sy - 17 * z;
        const bStallXs = [sx - 41 * z, sx - 13 * z, sx + 15 * z];

        for (const stX of bStallXs) {
          ctx.strokeRect(stX, bStallY, bStallWidth, bStallHeight);
        }

        // Stenciled Beach Markings
        ctx.fillStyle = 'rgba(251, 191, 36, 0.45)';
        ctx.font = `bold ${Math.round(6.5 * z)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('[P]', sx - 28 * z, sy + 11 * z);
        ctx.fillText('[P]', sx, sy + 11 * z);
        ctx.fillText('[P]', sx + 28 * z, sy + 11 * z);

        // ── 3. Stall 1 (Left): Aligned Retro Cyber Roadster (Crimson / White) ──
        const b1X = sx - 28 * z;
        const b1Y = sy - 3 * z;
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
        ctx.beginPath();
        ctx.roundRect(b1X - 10 * z, b1Y - 11 * z, 20 * z, 22 * z, 3 * z);
        ctx.fill();
        // Wheels
        ctx.fillStyle = '#090d16';
        ctx.fillRect(b1X - 11 * z, b1Y - 10 * z, 2.5 * z, 5 * z);
        ctx.fillRect(b1X + 8.5 * z, b1Y - 10 * z, 2.5 * z, 5 * z);
        ctx.fillRect(b1X - 11 * z, b1Y + 5 * z, 2.5 * z, 5 * z);
        ctx.fillRect(b1X + 8.5 * z, b1Y + 5 * z, 2.5 * z, 5 * z);
        // Body (Crimson sports car)
        ctx.fillStyle = '#e11d48';
        ctx.beginPath();
        ctx.roundRect(b1X - 9 * z, b1Y - 11 * z, 18 * z, 22 * z, 3 * z);
        ctx.fill();
        ctx.strokeStyle = '#fb7185';
        ctx.lineWidth = 0.8 * z;
        ctx.stroke();
        // Open Cabin & Windshield
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(b1X - 7 * z, b1Y - 6 * z, 14 * z, 12 * z);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(b1X - 6 * z, b1Y - 5 * z, 12 * z, 3.5 * z);
        // White Twin Racing Stripes
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(b1X - 2.5 * z, b1Y - 11 * z, 1.5 * z, 22 * z);
        ctx.fillRect(b1X + 1 * z, b1Y - 11 * z, 1.5 * z, 22 * z);
        // Headlights
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(b1X - 7.5 * z, b1Y - 11 * z, 2.5 * z, 1.5 * z);
        ctx.fillRect(b1X + 5 * z, b1Y - 11 * z, 2.5 * z, 1.5 * z);

        // ── 4. Stall 2 (Center): Aligned Beach Buggy with Surfboard ──
        const b2X = sx;
        const b2Y = sy - 3 * z;
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
        ctx.beginPath();
        ctx.roundRect(b2X - 10.5 * z, b2Y - 11 * z, 21 * z, 22 * z, 3 * z);
        ctx.fill();
        // Knobby All-Terrain Wheels
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(b2X - 11.5 * z, b2Y - 10 * z, 3 * z, 5 * z);
        ctx.fillRect(b2X + 8.5 * z, b2Y - 10 * z, 3 * z, 5 * z);
        ctx.fillRect(b2X - 11.5 * z, b2Y + 5 * z, 3 * z, 5 * z);
        ctx.fillRect(b2X + 8.5 * z, b2Y + 5 * z, 3 * z, 5 * z);
        // Cyan Beach Cruiser Body
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.roundRect(b2X - 9 * z, b2Y - 11 * z, 18 * z, 22 * z, 3 * z);
        ctx.fill();
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 0.8 * z;
        ctx.stroke();
        // Open Cabin & Tan Leather Seats
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(b2X - 7 * z, b2Y - 6 * z, 14 * z, 12 * z);
        ctx.fillStyle = '#b45309';
        ctx.fillRect(b2X - 5 * z, b2Y - 3 * z, 4 * z, 7 * z);
        ctx.fillRect(b2X + 1 * z, b2Y - 3 * z, 4 * z, 7 * z);
        // Mounted Coral Pink Surfboard with Racing Stripe
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.ellipse(b2X, b2Y, 3 * z, 10 * z, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.8 * z;
        ctx.stroke();

        // ── 5. Stall 3 (Right): Aligned Sand Cruiser SUV (Tangerine Orange) ──
        const b3X = sx + 28 * z;
        const b3Y = sy - 3 * z;
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
        ctx.beginPath();
        ctx.roundRect(b3X - 10 * z, b3Y - 11 * z, 20 * z, 22 * z, 3 * z);
        ctx.fill();
        // Wheels
        ctx.fillStyle = '#090d16';
        ctx.fillRect(b3X - 11 * z, b3Y - 10 * z, 2.5 * z, 5 * z);
        ctx.fillRect(b3X + 8.5 * z, b3Y - 10 * z, 2.5 * z, 5 * z);
        ctx.fillRect(b3X - 11 * z, b3Y + 5 * z, 2.5 * z, 5 * z);
        ctx.fillRect(b3X + 8.5 * z, b3Y + 5 * z, 2.5 * z, 5 * z);
        // Body (Tangerine Orange)
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.roundRect(b3X - 9 * z, b3Y - 11 * z, 18 * z, 22 * z, 3 * z);
        ctx.fill();
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 0.8 * z;
        ctx.stroke();
        // Roof Rack & Windows
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(b3X - 7 * z, b3Y - 7 * z, 14 * z, 13 * z);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(b3X - 6 * z, b3Y - 6 * z, 12 * z, 4 * z);
        ctx.fillRect(b3X - 6 * z, b3Y + 2 * z, 12 * z, 3 * z);
        // Black roof rack crossbars
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1 * z;
        ctx.beginPath();
        ctx.moveTo(b3X - 7 * z, b3Y - 2 * z);
        ctx.lineTo(b3X + 7 * z, b3Y - 2 * z);
        ctx.moveTo(b3X - 7 * z, b3Y + 1 * z);
        ctx.lineTo(b3X + 7 * z, b3Y + 1 * z);
        ctx.stroke();
        // Headlights
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(b3X - 7.5 * z, b3Y - 11 * z, 2.5 * z, 1.5 * z);
        ctx.fillRect(b3X + 5 * z, b3Y - 11 * z, 2.5 * z, 1.5 * z);

        // ── 6. Beach Parking Signpost (Wood post with Blue [P] & Wave Icon) ──
        ctx.fillStyle = '#78350f';
        ctx.fillRect(sx - 44 * z, sy - 24 * z, 2.5 * z, 10 * z);
        // Blue Parking Sign
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(sx - 46 * z, sy - 28 * z, 7 * z, 6 * z);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.6 * z;
        ctx.strokeRect(sx - 46 * z, sy - 28 * z, 7 * z, 6 * z);
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(4.5 * z)}px sans-serif`;
        ctx.fillText('P', sx - 42.5 * z, sy - 24.5 * z);

        // Hover tooltip
        const isBeachHovered = Math.hypot(this.player.wx - prop.wx, this.player.wy - prop.wy) < 65;
        if (isBeachHovered) {
          ctx.fillStyle = '#f59e0b';
          ctx.font = `bold ${Math.round(6.5 * z)}px monospace`;
          ctx.textAlign = 'center';
          ctx.fillText('🌊 COASTAL BEACH PARKING', sx, sy - 24 * z);
        }
        break;
      }

      case 'ramen_foodtruck': {
        // 2. Cyber Ramen Food Truck / Coffee Rover in Grand Plaza
        // Ground Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 2 * z, 30 * z, 12 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Wheels
        ctx.fillStyle = '#090d16';
        ctx.fillRect(sx - 22 * z, sy + 2 * z, 8 * z, 4 * z);
        ctx.fillRect(sx + 14 * z, sy + 2 * z, 8 * z, 4 * z);

        // Truck Body (Matte Cyber Charcoal)
        ctx.fillStyle = '#18181b';
        ctx.beginPath();
        ctx.roundRect(sx - 25 * z, sy - 22 * z, 50 * z, 24 * z, 3 * z);
        ctx.fill();

        // Driver Cab Windshield (Right side)
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(sx + 15 * z, sy - 18 * z, 8 * z, 10 * z);

        // Open Service Window & Wooden Bar Counter
        ctx.fillStyle = '#090d16';
        ctx.fillRect(sx - 21 * z, sy - 18 * z, 32 * z, 12 * z);
        // Warm Kitchen Interior Glow
        ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
        ctx.fillRect(sx - 21 * z, sy - 18 * z, 32 * z, 12 * z);

        // Wooden Bar Counter Shelf
        ctx.fillStyle = '#92400e';
        ctx.fillRect(sx - 23 * z, sy - 6 * z, 36 * z, 3 * z);

        // Red Japanese Noren Curtains ("ラーメン")
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(sx - 21 * z, sy - 18 * z, 32 * z, 4 * z);
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = i % 2 === 0 ? '#b91c1c' : '#dc2626';
          ctx.fillRect(sx - 21 * z + i * 8 * z, sy - 18 * z, 7 * z, 6 * z);
        }

        // Hanging Paper Lanterns (Warm Amber)
        const lanternGlow = Math.sin(this.tick * 0.08) * 1.5;
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(sx - 16 * z, sy - 18 * z, 3 * z, 0, Math.PI * 2);
        ctx.arc(sx + 6 * z, sy - 18 * z, 3 * z, 0, Math.PI * 2);
        ctx.fill();

        // Rooftop Exhaust with Rising Noodle Steam
        ctx.fillStyle = '#52525b';
        ctx.fillRect(sx - 8 * z, sy - 28 * z, 5 * z, 6 * z);
        ctx.fillStyle = 'rgba(254, 243, 199, 0.45)';
        for (let i = 0; i < 3; i++) {
          const sOff = ((this.tick * 0.3 + i * 14) % 30) * z;
          const sX = sx - 5.5 * z + Math.sin(this.tick * 0.1 + i) * 2.5 * z;
          ctx.beginPath();
          ctx.arc(sX, sy - 29 * z - sOff, (1.8 + sOff * 0.1) * z, 0, Math.PI * 2);
          ctx.fill();
        }

        // 2 Bar Stools on Pavement
        ctx.fillStyle = '#78350f';
        ctx.fillRect(sx - 15 * z, sy + 3 * z, 5 * z, 2 * z);
        ctx.fillRect(sx + 3 * z, sy + 3 * z, 5 * z, 2 * z);
        ctx.fillStyle = '#3f3f46';
        ctx.fillRect(sx - 13.5 * z, sy + 5 * z, 2 * z, 5 * z);
        ctx.fillRect(sx + 4.5 * z, sy + 5 * z, 2 * z, 5 * z);

        // Signboard
        ctx.fillStyle = '#fbbf24';
        ctx.font = `bold ${Math.round(5.5 * z)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('🍜 RAMEN ROVER', sx - 5 * z, sy - 23 * z);
        break;
      }

      case 'subway_entrance': {
        // 3. Metro Subway Entrance with Illuminated Canopy
        // Ground Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 22 * z, 8 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Recessed Underground Stairwell (Dark Gradient)
        ctx.fillStyle = '#060a12';
        ctx.fillRect(sx - 16 * z, sy - 14 * z, 32 * z, 14 * z);

        // Descending Stair Steps
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = i % 2 === 0 ? '#1e293b' : '#334155';
          ctx.fillRect(sx - 14 * z, sy - 12 * z + i * 3 * z, 28 * z, 2 * z);
        }

        // Stainless Steel Handrails
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.2 * z;
        ctx.beginPath();
        ctx.moveTo(sx - 16 * z, sy - 18 * z);
        ctx.lineTo(sx - 16 * z, sy);
        ctx.moveTo(sx + 16 * z, sy - 18 * z);
        ctx.lineTo(sx + 16 * z, sy);
        ctx.stroke();

        // Modern Glass & Steel Canopy
        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.beginPath();
        ctx.moveTo(sx - 18 * z, sy - 22 * z);
        ctx.lineTo(sx + 18 * z, sy - 22 * z);
        ctx.lineTo(sx + 16 * z, sy - 14 * z);
        ctx.lineTo(sx - 16 * z, sy - 14 * z);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1 * z;
        ctx.stroke();

        // Illuminated "Ⓜ SPOT METRO" Transit Sign
        ctx.fillStyle = '#020617';
        ctx.fillRect(sx - 14 * z, sy - 28 * z, 28 * z, 7 * z);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1 * z;
        ctx.strokeRect(sx - 14 * z, sy - 28 * z, 28 * z, 7 * z);

        ctx.fillStyle = '#10b981';
        ctx.font = `bold ${Math.round(5 * z)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('Ⓜ METRO LINE 1', sx, sy - 23 * z);
        break;
      }

      case 'cyber_konbini': {
        // 4. 24/7 Cyber Konbini / Convenience Store Facade
        // Ground Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 26 * z, 10 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Storefront Wall
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect(sx - 24 * z, sy - 34 * z, 48 * z, 34 * z, 2 * z);
        ctx.fill();

        // Warm Interior Glow & Glass Display Windows
        ctx.fillStyle = 'rgba(254, 240, 138, 0.55)';
        ctx.fillRect(sx - 20 * z, sy - 22 * z, 24 * z, 18 * z);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1 * z;
        ctx.strokeRect(sx - 20 * z, sy - 22 * z, 24 * z, 18 * z);

        // Snack Shelves inside window
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(sx - 18 * z, sy - 16 * z, 20 * z, 1.5 * z);
        ctx.fillRect(sx - 18 * z, sy - 10 * z, 20 * z, 1.5 * z);

        // Glass Automatic Sliding Door
        ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.fillRect(sx + 6 * z, sy - 22 * z, 14 * z, 22 * z);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1 * z;
        ctx.strokeRect(sx + 6 * z, sy - 22 * z, 14 * z, 22 * z);

        // 3-Color Striped Illuminated Marquee Awning (Green, Orange, White)
        const awnW = 50 * z;
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(sx - awnW / 2, sy - 36 * z, awnW, 3 * z);
        ctx.fillStyle = '#ea580c';
        ctx.fillRect(sx - awnW / 2, sy - 33 * z, awnW, 3 * z);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx - awnW / 2, sy - 30 * z, awnW, 3 * z);

        // Store Sign
        ctx.fillStyle = '#090d16';
        ctx.fillRect(sx - 18 * z, sy - 46 * z, 36 * z, 9 * z);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1 * z;
        ctx.strokeRect(sx - 18 * z, sy - 46 * z, 36 * z, 9 * z);
        ctx.fillStyle = '#fef08a';
        ctx.font = `bold ${Math.round(5.5 * z)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('🏪 24/7 SPOT MART', sx, sy - 39.5 * z);

        // Spinning Rooftop HVAC Fan (Floor796 Kinetic Clutter)
        const fanAngle = this.tick * 0.35;
        ctx.fillStyle = '#334155';
        ctx.fillRect(sx + 10 * z, sy - 42 * z, 10 * z, 6 * z);
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(sx + 15 * z, sy - 39 * z, 3 * z, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.7)';
        ctx.lineWidth = 1.2 * z;
        for (let b = 0; b < 3; b++) {
          const a = fanAngle + (b * Math.PI * 2) / 3;
          ctx.beginPath();
          ctx.moveTo(sx + 15 * z, sy - 39 * z);
          ctx.lineTo(sx + 15 * z + Math.cos(a) * 3 * z, sy - 39 * z + Math.sin(a) * 3 * z);
          ctx.stroke();
        }

        // Side-by-side drink vending machines on curb
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(sx - 32 * z, sy - 18 * z, 7 * z, 16 * z);
        ctx.fillStyle = '#2563eb';
        ctx.fillRect(sx - 39 * z, sy - 18 * z, 7 * z, 16 * z);
        // Vending display lights
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillRect(sx - 31 * z, sy - 16 * z, 5 * z, 6 * z);
        ctx.fillRect(sx - 38 * z, sy - 16 * z, 5 * z, 6 * z);
        break;
      }

      case 'cherry_tree': {
        // 🌸 Flowering Japanese Sakura Blossom
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 1.5 * z, 16 * z, 6.5 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Gnarled Dark Cherry Bark Trunk with Root Flare
        ctx.fillStyle = '#291305';
        ctx.fillRect(sx - 3 * z, sy - 19 * z, 6 * z, 18 * z);
        ctx.fillStyle = '#451a03';
        ctx.fillRect(sx - 2 * z, sy - 18 * z, 3 * z, 17 * z); // Trunk highlight facet
        // Root spurs
        ctx.beginPath();
        ctx.moveTo(sx - 5 * z, sy);
        ctx.lineTo(sx - 2 * z, sy - 5 * z);
        ctx.lineTo(sx + 2 * z, sy - 5 * z);
        ctx.lineTo(sx + 5 * z, sy);
        ctx.closePath();
        ctx.fill();

        // Fallen pink petals on the turf around trunk
        ctx.fillStyle = '#f472b6';
        ctx.fillRect(sx - 8 * z, sy - 2 * z, 1.5 * z, 1.5 * z);
        ctx.fillRect(sx + 7 * z, sy - 3 * z, 1.5 * z, 1.5 * z);
        ctx.fillRect(sx - 3 * z, sy + 1 * z, 1.5 * z, 1.5 * z);
        ctx.fillRect(sx + 4 * z, sy, 1.5 * z, 1.5 * z);

        const cx = sx + windSway * 1.1;
        const cy = sy - 27 * z;

        const isOccluding = this.isEntityBehindTree(prop.wx, prop.wy);
        if (isOccluding) {
          ctx.save();
          ctx.globalAlpha = 0.32;
        }

        // Visible boughs under the blossom cloud
        ctx.strokeStyle = '#381604';
        ctx.lineWidth = 2 * z;
        ctx.beginPath();
        ctx.moveTo(sx, sy - 18 * z);
        ctx.lineTo(cx - 7 * z, cy + 6 * z);
        ctx.moveTo(sx, sy - 18 * z);
        ctx.lineTo(cx + 6 * z, cy + 5 * z);
        ctx.stroke();

        // Layer 1: Deep Rose Shadow Base
        ctx.fillStyle = '#831843';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 4 * z, 16 * z, 12 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Layer 2: Main Floral Blossom Clusters
        ctx.fillStyle = '#db2777';
        ctx.beginPath();
        ctx.arc(cx - 6 * z, cy + 2 * z, 11 * z, 0, Math.PI * 2);
        ctx.arc(cx + 6 * z, cy + 2 * z, 11 * z, 0, Math.PI * 2);
        ctx.arc(cx, cy - 3 * z, 13 * z, 0, Math.PI * 2);
        ctx.fill();

        // Layer 3: Fluffy Pink Midtones
        ctx.fillStyle = '#f472b6';
        ctx.beginPath();
        ctx.arc(cx - 4 * z, cy - 2 * z, 10 * z, 0, Math.PI * 2);
        ctx.arc(cx + 4 * z, cy - 1 * z, 9.5 * z, 0, Math.PI * 2);
        ctx.arc(cx, cy - 6 * z, 9 * z, 0, Math.PI * 2);
        ctx.fill();

        // Layer 4: Luminous Sunlit Blossom Highlights
        ctx.fillStyle = '#fce7f3';
        ctx.beginPath();
        ctx.arc(cx - 3 * z, cy - 7 * z, 6 * z, 0, Math.PI * 2);
        ctx.arc(cx + 2 * z, cy - 5 * z, 5 * z, 0, Math.PI * 2);
        ctx.fill();

        if (isOccluding) {
          ctx.restore();
        }
        break;
      }

      case 'park_tree': {
        // 🌳 Majestic Fluffy Summer Oak (Inspired by Image 3 & Stardew/RPG pixel aesthetics)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 1.5 * z, 19 * z, 8 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Flared Buttress Roots (Image 1 & 3)
        ctx.fillStyle = '#271406'; // Deep bark shadow
        ctx.beginPath();
        ctx.moveTo(sx - 8 * z, sy);
        ctx.quadraticCurveTo(sx - 4 * z, sy - 8 * z, sx - 3 * z, sy - 20 * z);
        ctx.lineTo(sx + 3 * z, sy - 20 * z);
        ctx.quadraticCurveTo(sx + 4 * z, sy - 8 * z, sx + 8 * z, sy);
        ctx.closePath();
        ctx.fill();

        // Warm Textured Bark Face
        ctx.fillStyle = '#5c3a1e';
        ctx.beginPath();
        ctx.moveTo(sx - 5 * z, sy);
        ctx.lineTo(sx - 2 * z, sy - 19 * z);
        ctx.lineTo(sx + 2 * z, sy - 19 * z);
        ctx.lineTo(sx + 5 * z, sy);
        ctx.closePath();
        ctx.fill();

        // Bark vertical striations
        ctx.fillStyle = '#78350f';
        ctx.fillRect(sx - 1 * z, sy - 18 * z, 1.5 * z, 16 * z);

        // Grass tufts at root base (Image 3)
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(sx - 7 * z, sy - 2 * z, 2.5 * z, 2 * z);
        ctx.fillRect(sx + 5 * z, sy - 2.5 * z, 2.5 * z, 2.5 * z);

        const tx = sx + windSway;
        const ty = sy - 30 * z;

        const isOccluding = this.isEntityBehindTree(prop.wx, prop.wy);
        if (isOccluding) {
          ctx.save();
          ctx.globalAlpha = 0.32;
        }

        // Branch fork peeking out under canopy
        ctx.strokeStyle = '#3e2723';
        ctx.lineWidth = 2.5 * z;
        ctx.beginPath();
        ctx.moveTo(sx, sy - 20 * z);
        ctx.lineTo(tx - 7 * z, ty + 8 * z);
        ctx.moveTo(sx, sy - 20 * z);
        ctx.lineTo(tx + 7 * z, ty + 7 * z);
        ctx.stroke();

        // Volumetric Multi-Lobed Cloud Canopy (Images 1, 2, 3)
        const oakPuffs = [
          { ox: 0, oy: 6, rx: 17, ry: 12, shadowOnly: true },
          { ox: -8, oy: 2, r: 12 },
          { ox: 8, oy: 2, r: 12 },
          { ox: 0, oy: -6, r: 13 },
          { ox: -3, oy: -1, r: 11 },
          { ox: 4, oy: 0, r: 10 },
        ];

        // 1. Ambient under-canopy shadow
        ctx.fillStyle = '#052e16';
        ctx.beginPath();
        ctx.ellipse(tx, ty + 6 * z, 18 * z, 12 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. Base foliage midtones
        ctx.fillStyle = '#15803d';
        for (const p of oakPuffs) {
          if (p.shadowOnly) continue;
          ctx.beginPath();
          ctx.arc(tx + p.ox * z, ty + p.oy * z, p.r * z, 0, Math.PI * 2);
          ctx.fill();
        }

        // 3. Sunlit Upper Highlights (4-tone Stardew lighting)
        ctx.fillStyle = '#22c55e';
        for (const p of oakPuffs) {
          if (p.shadowOnly) continue;
          ctx.beginPath();
          ctx.arc(tx + (p.ox - 2) * z, ty + (p.oy - 3) * z, (p.r * 0.7) * z, 0, Math.PI * 2);
          ctx.fill();
        }

        // 4. Vibrant Lime Top-Rim Sparkle (Image 1 & 2)
        ctx.fillStyle = '#84cc16';
        ctx.beginPath();
        ctx.arc(tx - 3 * z, ty - 9 * z, 6 * z, 0, Math.PI * 2);
        ctx.arc(tx + 2 * z, ty - 8 * z, 5 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#bef264';
        ctx.beginPath();
        ctx.arc(tx - 2 * z, ty - 11 * z, 3 * z, 0, Math.PI * 2);
        ctx.fill();

        if (isOccluding) {
          ctx.restore();
        }
        break;
      }

      case 'fruit_tree': {
        // 🍎 Ruby Apple / Orchard Berry Tree (Directly from Image 3!)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.30)';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 1.5 * z, 17 * z, 7 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Flared roots & trunk
        ctx.fillStyle = '#271406';
        ctx.beginPath();
        ctx.moveTo(sx - 7 * z, sy);
        ctx.quadraticCurveTo(sx - 3 * z, sy - 7 * z, sx - 2.5 * z, sy - 18 * z);
        ctx.lineTo(sx + 2.5 * z, sy - 18 * z);
        ctx.quadraticCurveTo(sx + 3 * z, sy - 7 * z, sx + 7 * z, sy);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#5c3a1e';
        ctx.fillRect(sx - 2 * z, sy - 17 * z, 4 * z, 15 * z);

        // Grass sprouts at base
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(sx - 5 * z, sy - 2 * z, 2 * z, 2 * z);
        ctx.fillRect(sx + 4 * z, sy - 2 * z, 2 * z, 2 * z);

        const fx = sx + windSway * 0.9;
        const fy = sy - 28 * z;

        const isOccluding = this.isEntityBehindTree(prop.wx, prop.wy);
        if (isOccluding) {
          ctx.save();
          ctx.globalAlpha = 0.32;
        }

        // Fluffy Canopy Dome
        ctx.fillStyle = '#064e3b';
        ctx.beginPath();
        ctx.ellipse(fx, fy + 4 * z, 16 * z, 11 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.arc(fx - 7 * z, fy + 1 * z, 10 * z, 0, Math.PI * 2);
        ctx.arc(fx + 7 * z, fy + 1 * z, 10 * z, 0, Math.PI * 2);
        ctx.arc(fx, fy - 4 * z, 11 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(fx - 3 * z, fy - 3 * z, 8 * z, 0, Math.PI * 2);
        ctx.arc(fx + 4 * z, fy - 2 * z, 7 * z, 0, Math.PI * 2);
        ctx.arc(fx, fy - 7 * z, 7 * z, 0, Math.PI * 2);
        ctx.fill();

        // 🍎 Ripe Red Apples / Berries dotted across canopy (Image 3)
        const apples = [
          { ox: -8, oy: 0 },
          { ox: -4, oy: -6 },
          { ox: 3, oy: -7 },
          { ox: 8, oy: -2 },
          { ox: -2, oy: 2 },
          { ox: 5, oy: 3 },
          { ox: -6, oy: 6 },
          { ox: 2, oy: 7 },
        ];

        for (const app of apples) {
          const ax = fx + app.ox * z;
          const ay = fy + app.oy * z;
          ctx.fillStyle = '#7f1d1d';
          ctx.beginPath();
          ctx.arc(ax, ay + 0.5 * z, 2.2 * z, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#dc2626';
          ctx.beginPath();
          ctx.arc(ax, ay, 2 * z, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fef2f2';
          ctx.fillRect(ax - 0.8 * z, ay - 0.8 * z, 1 * z, 1 * z);
        }

        if (isOccluding) {
          ctx.restore();
        }
        break;
      }

      case 'jungle_tree': {
        // 🌴 Ancient Curved Banyan with Hanging Lianas (Directly from Image 1 & Image 2 Row 1!)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 1.5 * z, 22 * z, 9 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Mossy island mound under tree (Image 1)
        ctx.fillStyle = '#064e3b';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 2 * z, 15 * z, 6 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Curved S-Trunk with Buttress Roots (Image 1 & Image 2 Row 1)
        ctx.fillStyle = '#1c1208'; // Deep trunk shadow
        ctx.beginPath();
        ctx.moveTo(sx - 9 * z, sy);
        ctx.quadraticCurveTo(sx - 8 * z, sy - 12 * z, sx - 2 * z, sy - 26 * z);
        ctx.lineTo(sx + 5 * z, sy - 26 * z);
        ctx.quadraticCurveTo(sx + 2 * z, sy - 12 * z, sx + 9 * z, sy);
        ctx.closePath();
        ctx.fill();

        // Warm twisting wood body
        ctx.fillStyle = '#452814';
        ctx.beginPath();
        ctx.moveTo(sx - 6 * z, sy);
        ctx.quadraticCurveTo(sx - 5 * z, sy - 12 * z, sx - 1 * z, sy - 25 * z);
        ctx.lineTo(sx + 3 * z, sy - 25 * z);
        ctx.quadraticCurveTo(sx + 1 * z, sy - 12 * z, sx + 6 * z, sy);
        ctx.closePath();
        ctx.fill();

        // Trunk bark ridge highlight
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.moveTo(sx - 2 * z, sy);
        ctx.quadraticCurveTo(sx - 3 * z, sy - 12 * z, sx + 1 * z, sy - 24 * z);
        ctx.lineTo(sx + 2 * z, sy - 24 * z);
        ctx.quadraticCurveTo(sx - 1 * z, sy - 12 * z, sx - 1 * z, sy);
        ctx.closePath();
        ctx.fill();

        // Broad tropical ferns at base
        ctx.fillStyle = '#10b981';
        ctx.fillRect(sx - 8 * z, sy - 4 * z, 4 * z, 3 * z);
        ctx.fillRect(sx + 5 * z, sy - 3.5 * z, 4 * z, 3 * z);

        const jx = sx + windSway * 1.2;
        const jy = sy - 32 * z;

        const isOccluding = this.isEntityBehindTree(prop.wx, prop.wy);
        if (isOccluding) {
          ctx.save();
          ctx.globalAlpha = 0.32;
        }

        // Deep Canopy Under-Shadow
        ctx.fillStyle = '#022c22';
        ctx.beginPath();
        ctx.ellipse(jx, jy + 6 * z, 20 * z, 13 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tiered Layered Emerald Puffs (Images 1 & 2)
        ctx.fillStyle = '#065f46';
        ctx.beginPath();
        ctx.arc(jx - 9 * z, jy + 2 * z, 12 * z, 0, Math.PI * 2);
        ctx.arc(jx + 9 * z, jy + 2 * z, 12 * z, 0, Math.PI * 2);
        ctx.arc(jx, jy - 5 * z, 14 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#059669';
        ctx.beginPath();
        ctx.arc(jx - 5 * z, jy - 2 * z, 10 * z, 0, Math.PI * 2);
        ctx.arc(jx + 5 * z, jy - 1 * z, 9.5 * z, 0, Math.PI * 2);
        ctx.arc(jx, jy - 8 * z, 11 * z, 0, Math.PI * 2);
        ctx.fill();

        // Vibrant Yellow-Green Sunlit Canopy Crest (Image 1)
        ctx.fillStyle = '#84cc16';
        ctx.beginPath();
        ctx.arc(jx - 4 * z, jy - 7 * z, 8 * z, 0, Math.PI * 2);
        ctx.arc(jx + 3 * z, jy - 6 * z, 7 * z, 0, Math.PI * 2);
        ctx.arc(jx, jy - 12 * z, 7 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#bef264';
        ctx.beginPath();
        ctx.arc(jx - 2 * z, jy - 13 * z, 4 * z, 0, Math.PI * 2);
        ctx.fill();

        // Hanging Curved Liana Vines Swaying in Breeze (Directly from Image 1 & 2!)
        const vineOffsets = [-12, -7, 0, 6, 11];
        vineOffsets.forEach((vx, idx) => {
          const vSway = Math.sin(this.tick * 0.05 + idx * 0.9) * 4 * z;
          const startX = jx + vx * z;
          const startY = jy + 6 * z;
          const vLen = (14 + (idx % 3) * 5) * z;

          ctx.strokeStyle = '#047857';
          ctx.lineWidth = 1.3 * z;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.quadraticCurveTo(startX + vSway * 0.6, startY + vLen * 0.6, startX + vSway, startY + vLen);
          ctx.stroke();

          // Leaf at vine tip
          ctx.fillStyle = '#a3e635';
          ctx.fillRect(startX + vSway - 1 * z, startY + vLen - 1 * z, 2.5 * z, 2.5 * z);
        });

        // Wild Orchid accent on trunk
        ctx.fillStyle = '#ec4899';
        ctx.fillRect(sx - 3 * z, sy - 18 * z, 2.5 * z, 2.5 * z);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(sx - 2 * z, sy - 17 * z, 1 * z, 1 * z);

        if (isOccluding) {
          ctx.restore();
        }
        break;
      }

      case 'ancient_redwood': {
        // 🌲 Towering Ancient Redwood Conifer (Whispering Woods)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 1.5 * z, 18 * z, 7 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Massive Redwood Trunk with Flared Buttress Base
        ctx.fillStyle = '#290f05';
        ctx.beginPath();
        ctx.moveTo(sx - 7 * z, sy);
        ctx.quadraticCurveTo(sx - 4 * z, sy - 10 * z, sx - 3.5 * z, sy - 24 * z);
        ctx.lineTo(sx + 3.5 * z, sy - 24 * z);
        ctx.quadraticCurveTo(sx + 4 * z, sy - 10 * z, sx + 7 * z, sy);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#78350f';
        ctx.fillRect(sx - 2.5 * z, sy - 23 * z, 5 * z, 21 * z);

        const isOccluding = this.isEntityBehindTree(prop.wx, prop.wy);
        if (isOccluding) {
          ctx.save();
          ctx.globalAlpha = 0.32;
        }

        // 5 Tiered Saw-Tooth Needle Boughs (Tall Majestic Crown)
        const rwTiers = [
          { yOff: 12, width: 28, height: 13, colBottom: '#022c22', colTop: '#064e3b' },
          { yOff: 20, width: 24, height: 12, colBottom: '#064e3b', colTop: '#047857' },
          { yOff: 28, width: 19, height: 11, colBottom: '#047857', colTop: '#059669' },
          { yOff: 36, width: 14, height: 10, colBottom: '#059669', colTop: '#10b981' },
          { yOff: 43, width: 9, height: 9, colBottom: '#10b981', colTop: '#34d399' },
        ];

        rwTiers.forEach((t) => {
          const ty = sy - t.yOff * z;
          const tw = t.width * z;
          const th = t.height * z;
          const pSway = windSway * 0.35 * (t.yOff / 40);

          ctx.fillStyle = t.colBottom;
          ctx.beginPath();
          ctx.moveTo(sx - tw / 2, ty);
          ctx.lineTo(sx + pSway, ty - th);
          ctx.lineTo(sx + tw / 2, ty);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = t.colTop;
          ctx.beginPath();
          ctx.moveTo(sx - tw / 2, ty);
          ctx.lineTo(sx + pSway, ty - th);
          ctx.lineTo(sx, ty - th * 0.25);
          ctx.closePath();
          ctx.fill();
        });

        if (isOccluding) {
          ctx.restore();
        }
        break;
      }

      case 'willow_tree': {
        // 🌿 Lakeside Weeping Willow with Cascading Tendrils
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 1.5 * z, 17 * z, 7 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Leaning Curved Trunk
        ctx.fillStyle = '#271708';
        ctx.beginPath();
        ctx.moveTo(sx - 4 * z, sy);
        ctx.quadraticCurveTo(sx - 6 * z, sy - 12 * z, sx - 2 * z + windSway * 0.4, sy - 24 * z);
        ctx.lineTo(sx + 3 * z + windSway * 0.4, sy - 24 * z);
        ctx.quadraticCurveTo(sx + 2 * z, sy - 12 * z, sx + 4 * z, sy);
        ctx.closePath();
        ctx.fill();

        const wx = sx + windSway * 1.3;
        const wy = sy - 28 * z;

        const isOccluding = this.isEntityBehindTree(prop.wx, prop.wy);
        if (isOccluding) {
          ctx.save();
          ctx.globalAlpha = 0.32;
        }

        // Crown Canopy Dome
        ctx.fillStyle = '#14532d';
        ctx.beginPath();
        ctx.ellipse(wx, wy + 2 * z, 15 * z, 10 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.arc(wx - 4 * z, wy - 2 * z, 10 * z, 0, Math.PI * 2);
        ctx.arc(wx + 4 * z, wy - 1 * z, 10 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#65a30d';
        ctx.beginPath();
        ctx.arc(wx - 1 * z, wy - 5 * z, 7 * z, 0, Math.PI * 2);
        ctx.fill();

        // 8 Cascading Weeping Tendrils Swaying with Secondary Phase
        const tendrilOffsets = [-12, -9, -5, -2, 2, 5, 9, 12];
        tendrilOffsets.forEach((ox, idx) => {
          const tSway = Math.sin(this.tick * 0.05 + idx * 0.8) * 3.5 * z;
          const startX = wx + ox * z;
          const startY = wy + 4 * z;
          const length = (18 + (idx % 3) * 4) * z;

          ctx.strokeStyle = '#65a30d';
          ctx.lineWidth = 1.2 * z;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.quadraticCurveTo(startX + tSway * 0.5, startY + length * 0.6, startX + tSway, startY + length);
          ctx.stroke();

          ctx.fillStyle = '#84cc16';
          ctx.fillRect(startX + tSway - 1 * z, startY + length - 2 * z, 2.5 * z, 3 * z);
          ctx.fillStyle = '#a3e635';
          ctx.fillRect(startX + tSway - 0.5 * z, startY + length + 0.5 * z, 1.5 * z, 1.5 * z);
        });

        if (isOccluding) {
          ctx.restore();
        }
        break;
      }

      case 'birch_tree': {
        // 🍂 Golden Birch / Autumn Ginkgo (Warm Amber & White Bark - Image 2)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 1.5 * z, 14 * z, 6 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Slender White Paper Bark Trunk with flared root base
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.moveTo(sx - 4 * z, sy);
        ctx.lineTo(sx - 2 * z, sy - 22 * z);
        ctx.lineTo(sx + 2 * z, sy - 22 * z);
        ctx.lineTo(sx + 4 * z, sy);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(sx - 2 * z, sy - 22 * z, 3 * z, 21 * z);

        // Horizontal Charcoal Lenticel Stripes (Iconic Birch Pattern)
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(sx - 2.5 * z, sy - 18 * z, 4 * z, 1.2 * z);
        ctx.fillRect(sx - 1 * z, sy - 14 * z, 3.5 * z, 1.2 * z);
        ctx.fillRect(sx - 2.5 * z, sy - 9 * z, 4.5 * z, 1.2 * z);
        ctx.fillRect(sx, sy - 5 * z, 2.5 * z, 1.2 * z);

        // Scattered Fallen Golden Leaves on Grass
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(sx - 6 * z, sy - 2 * z, 1.5 * z, 1.5 * z);
        ctx.fillRect(sx + 5 * z, sy - 1 * z, 1.5 * z, 1.5 * z);
        ctx.fillRect(sx - 2 * z, sy + 0.5 * z, 1.5 * z, 1.5 * z);

        const bx = sx + windSway * 1.0;
        const by = sy - 30 * z;

        const isOccluding = this.isEntityBehindTree(prop.wx, prop.wy);
        if (isOccluding) {
          ctx.save();
          ctx.globalAlpha = 0.32;
        }

        // Layer 1: Deep Amber Shadow Base
        ctx.fillStyle = '#9a3412';
        ctx.beginPath();
        ctx.ellipse(bx, by + 4 * z, 14 * z, 11 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Layer 2: Warm Golden Foliage Clusters
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.arc(bx - 5 * z, by + 2 * z, 10 * z, 0, Math.PI * 2);
        ctx.arc(bx + 5 * z, by + 2 * z, 9.5 * z, 0, Math.PI * 2);
        ctx.arc(bx, by - 3 * z, 11 * z, 0, Math.PI * 2);
        ctx.fill();

        // Layer 3: Brilliant Golden Midtones
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(bx - 3 * z, by - 1 * z, 8.5 * z, 0, Math.PI * 2);
        ctx.arc(bx + 3 * z, by - 1 * z, 8 * z, 0, Math.PI * 2);
        ctx.arc(bx, by - 6 * z, 8 * z, 0, Math.PI * 2);
        ctx.fill();

        // Layer 4: Sparkling Sunlit Lemon Highlights
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(bx - 2 * z, by - 6 * z, 5 * z, 0, Math.PI * 2);
        ctx.arc(bx + 2 * z, by - 4 * z, 4 * z, 0, Math.PI * 2);
        ctx.fill();

        if (isOccluding) {
          ctx.restore();
        }
        break;
      }

      case 'pine_tree': {
        // 🌲 Tall Alpine Conifer / Spruce (Tiered Jagged Boughs - Image 3)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 1.5 * z, 14 * z, 6 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Sturdy Cedar Trunk with flared roots
        ctx.fillStyle = '#2b1002';
        ctx.beginPath();
        ctx.moveTo(sx - 5 * z, sy);
        ctx.lineTo(sx - 2.5 * z, sy - 14 * z);
        ctx.lineTo(sx + 2.5 * z, sy - 14 * z);
        ctx.lineTo(sx + 5 * z, sy);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#451a03';
        ctx.fillRect(sx - 2 * z, sy - 14 * z, 4 * z, 13 * z);

        const isOccluding = this.isEntityBehindTree(prop.wx, prop.wy);
        if (isOccluding) {
          ctx.save();
          ctx.globalAlpha = 0.32;
        }

        // 4 Tiered Jagged Evergreen Boughs
        const tiers = [
          { yOff: 10, width: 22, height: 11, colBottom: '#022c22', colTop: '#064e3b' },
          { yOff: 17, width: 18, height: 10, colBottom: '#064e3b', colTop: '#065f46' },
          { yOff: 24, width: 14, height: 9, colBottom: '#047857', colTop: '#059669' },
          { yOff: 31, width: 9, height: 8, colBottom: '#059669', colTop: '#10b981' },
        ];

        tiers.forEach((t) => {
          const ty = sy - t.yOff * z;
          const tw = t.width * z;
          const th = t.height * z;
          const pSway = (windSway * 0.4 * (t.yOff / 30));

          ctx.fillStyle = t.colBottom;
          ctx.beginPath();
          ctx.moveTo(sx - tw / 2, ty);
          ctx.lineTo(sx + pSway, ty - th);
          ctx.lineTo(sx + tw / 2, ty);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = t.colTop;
          ctx.beginPath();
          ctx.moveTo(sx - tw / 2, ty);
          ctx.lineTo(sx + pSway, ty - th);
          ctx.lineTo(sx, ty - th * 0.2);
          ctx.closePath();
          ctx.fill();

          if (t.yOff === 10) {
            ctx.fillStyle = '#78350f';
            ctx.fillRect(sx - tw * 0.35, ty + 0.5 * z, 1.8 * z, 2.8 * z);
            ctx.fillRect(sx + tw * 0.3, ty + 0.5 * z, 1.8 * z, 2.8 * z);
          }
        });

        if (isOccluding) {
          ctx.restore();
        }
        break;
      }

      case 'great_oak': {
        // 🌳 Grand Colossal Elder Oak Tree (Centuries-old landmark with massive roots, hanging lantern & bench)
        // 1. Broad Ground Drop Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 2 * z, 30 * z, 12 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. Circular Wooden Park Bench surrounding base
        ctx.fillStyle = '#451a03'; // Bench frame / legs
        ctx.fillRect(sx - 16 * z, sy - 4 * z, 32 * z, 2 * z);
        ctx.fillStyle = '#78350f'; // Timber slats
        ctx.fillRect(sx - 15 * z, sy - 6 * z, 30 * z, 2.5 * z);
        ctx.fillStyle = '#b45309'; // Sunlit wood edge
        ctx.fillRect(sx - 14 * z, sy - 6 * z, 28 * z, 1 * z);

        // 3. Colossal Gnarled Ancient Trunk with Flared Buttress Roots
        ctx.fillStyle = '#1c0d02'; // Deepest bark shadow
        ctx.beginPath();
        ctx.moveTo(sx - 14 * z, sy);
        ctx.quadraticCurveTo(sx - 7 * z, sy - 12 * z, sx - 5 * z, sy - 28 * z);
        ctx.lineTo(sx + 5 * z, sy - 28 * z);
        ctx.quadraticCurveTo(sx + 7 * z, sy - 12 * z, sx + 14 * z, sy);
        ctx.closePath();
        ctx.fill();

        // Weathered Warm Bark Face
        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.moveTo(sx - 10 * z, sy);
        ctx.lineTo(sx - 4 * z, sy - 27 * z);
        ctx.lineTo(sx + 4 * z, sy - 27 * z);
        ctx.lineTo(sx + 10 * z, sy);
        ctx.closePath();
        ctx.fill();

        // Bark striations & natural growth twists
        ctx.fillStyle = '#78350f';
        ctx.fillRect(sx - 3 * z, sy - 26 * z, 2 * z, 23 * z);
        ctx.fillRect(sx + 1.5 * z, sy - 24 * z, 2 * z, 21 * z);
        ctx.fillStyle = '#9a3412';
        ctx.fillRect(sx - 1 * z, sy - 25 * z, 1.5 * z, 20 * z);

        // Ancient Heartwood Hollow Knot
        ctx.fillStyle = '#180801';
        ctx.beginPath();
        ctx.ellipse(sx - 0.5 * z, sy - 14 * z, 2.5 * z, 4 * z, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.arc(sx - 0.5 * z, sy - 17 * z, 1.5 * z, 0, Math.PI * 2);
        ctx.fill();

        // Moss clusters clinging to base roots
        ctx.fillStyle = '#15803d';
        ctx.fillRect(sx - 12 * z, sy - 3 * z, 3.5 * z, 2.5 * z);
        ctx.fillRect(sx + 9 * z, sy - 3.5 * z, 4 * z, 2.5 * z);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(sx - 11 * z, sy - 3.5 * z, 2 * z, 1.5 * z);
        ctx.fillRect(sx + 10 * z, sy - 4 * z, 2 * z, 1.5 * z);

        const gx_pos = sx + windSway * 0.85;
        const gy_pos = sy - 42 * z;

        const isOccluding = this.isEntityBehindTree(prop.wx, prop.wy);
        if (isOccluding) {
          ctx.save();
          ctx.globalAlpha = 0.32;
        }

        // Heavy twisting primary branches reaching into the canopy
        ctx.strokeStyle = '#291305';
        ctx.lineWidth = 4.5 * z;
        ctx.beginPath();
        ctx.moveTo(sx, sy - 27 * z);
        ctx.lineTo(gx_pos - 15 * z, gy_pos + 12 * z);
        ctx.moveTo(sx, sy - 27 * z);
        ctx.lineTo(gx_pos + 15 * z, gy_pos + 10 * z);
        ctx.moveTo(sx, sy - 27 * z);
        ctx.lineTo(gx_pos, gy_pos + 6 * z);
        ctx.stroke();

        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 2.5 * z;
        ctx.beginPath();
        ctx.moveTo(gx_pos - 15 * z, gy_pos + 12 * z);
        ctx.lineTo(gx_pos - 22 * z, gy_pos + 4 * z);
        ctx.moveTo(gx_pos + 15 * z, gy_pos + 10 * z);
        ctx.lineTo(gx_pos + 22 * z, gy_pos + 2 * z);
        ctx.stroke();

        // 4. Colossal Multi-Tiered Cloud Canopy
        const greatPuffs = [
          { ox: -16, oy: 4, r: 16 },
          { ox: 16, oy: 4, r: 16 },
          { ox: -10, oy: -8, r: 18 },
          { ox: 10, oy: -8, r: 18 },
          { ox: 0, oy: -14, r: 20 },
          { ox: -4, oy: 2, r: 17 },
          { ox: 4, oy: 2, r: 17 },
        ];

        // Deepest under-canopy shadow mantle
        ctx.fillStyle = '#022c14';
        ctx.beginPath();
        ctx.ellipse(gx_pos, gy_pos + 10 * z, 28 * z, 14 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Base dense emerald foliage
        ctx.fillStyle = '#14532d';
        for (const p of greatPuffs) {
          ctx.beginPath();
          ctx.arc(gx_pos + p.ox * z, gy_pos + p.oy * z, p.r * z, 0, Math.PI * 2);
          ctx.fill();
        }

        // Vibrant midtone foliage lobes
        ctx.fillStyle = '#15803d';
        for (const p of greatPuffs) {
          ctx.beginPath();
          ctx.arc(gx_pos + (p.ox - 2) * z, gy_pos + (p.oy - 2) * z, (p.r * 0.82) * z, 0, Math.PI * 2);
          ctx.fill();
        }

        // Sunlit green crests
        ctx.fillStyle = '#22c55e';
        for (const p of greatPuffs) {
          ctx.beginPath();
          ctx.arc(gx_pos + (p.ox - 3.5) * z, gy_pos + (p.oy - 4) * z, (p.r * 0.62) * z, 0, Math.PI * 2);
          ctx.fill();
        }

        // Top canopy rim highlights & sunlit leaves
        ctx.fillStyle = '#84cc16';
        ctx.beginPath();
        ctx.arc(gx_pos - 6 * z, gy_pos - 19 * z, 8 * z, 0, Math.PI * 2);
        ctx.arc(gx_pos + 4 * z, gy_pos - 18 * z, 7 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#bef264';
        ctx.beginPath();
        ctx.arc(gx_pos - 4 * z, gy_pos - 21 * z, 4 * z, 0, Math.PI * 2);
        ctx.fill();

        // 5. Hanging Amber Traveler Lantern (Gently swaying on lower branch)
        const lanternSway = Math.sin(this.tick * 0.05) * 2 * z;
        const lx = gx_pos - 16 * z + lanternSway;
        const ly = gy_pos + 16 * z;

        // Chain
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1 * z;
        ctx.beginPath();
        ctx.moveTo(gx_pos - 16 * z, gy_pos + 12 * z);
        ctx.lineTo(lx, ly);
        ctx.stroke();

        // Brass lantern cap & base
        ctx.fillStyle = '#92400e';
        ctx.fillRect(lx - 2.5 * z, ly, 5 * z, 1.5 * z);
        ctx.fillRect(lx - 2.5 * z, ly + 5 * z, 5 * z, 1.5 * z);

        // Glowing frosted glass
        const candlePulse = Math.sin(this.tick * 0.12) * 0.15 + 0.85;
        ctx.fillStyle = `rgba(251, 191, 36, ${0.9 * candlePulse})`;
        ctx.fillRect(lx - 2 * z, ly + 1.5 * z, 4 * z, 3.5 * z);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(lx - 0.7 * z, ly + 2.5 * z, 1.4 * z, 1.5 * z);

        // 6. Floating fireflies / gentle drifting leaf particles
        for (let i = 0; i < 3; i++) {
          const pTick = (this.tick + i * 35) % 180;
          const px = gx_pos + Math.sin(pTick * 0.04 + i) * 22 * z;
          const py = gy_pos - 10 * z + (pTick / 180) * 36 * z;
          const pAlpha = Math.sin((pTick / 180) * Math.PI) * 0.6;
          ctx.fillStyle = i === 0 ? `rgba(251, 191, 36, ${pAlpha})` : `rgba(134, 239, 172, ${pAlpha})`;
          ctx.fillRect(px, py, 1.5 * z, 1.5 * z);
        }

        if (isOccluding) {
          ctx.restore();
        }
        break;
      }

      case 'master_bonsai': {
        // 🪴 Sacred Millennium Zen Bonsai Tree (Living art on carved granite pedestal)
        // 1. Soft Oval Ground Drop Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 1 * z, 20 * z, 7 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. Carved Granite Pedestal Base
        ctx.fillStyle = '#1e293b'; // Pedestal foot
        ctx.fillRect(sx - 10 * z, sy - 3 * z, 20 * z, 3 * z);
        ctx.fillStyle = '#334155'; // Main stone pillar
        ctx.fillRect(sx - 8 * z, sy - 8 * z, 16 * z, 5 * z);
        ctx.fillStyle = '#475569'; // Pedestal upper crown
        ctx.fillRect(sx - 11 * z, sy - 10 * z, 22 * z, 2 * z);
        ctx.fillStyle = '#64748b'; // Beveled stone rim highlight
        ctx.fillRect(sx - 10 * z, sy - 10 * z, 20 * z, 0.8 * z);

        // 3. Traditional Glazed Ceramic Bonsai Basin (Dark slate indigo with cyan trim)
        ctx.fillStyle = '#090d16'; // Pot shadow
        ctx.fillRect(sx - 9 * z, sy - 12 * z, 18 * z, 2 * z);
        ctx.fillStyle = '#0f172a'; // Ceramic pot body
        ctx.beginPath();
        ctx.moveTo(sx - 9 * z, sy - 10 * z);
        ctx.lineTo(sx - 8 * z, sy - 15 * z);
        ctx.lineTo(sx + 8 * z, sy - 15 * z);
        ctx.lineTo(sx + 9 * z, sy - 10 * z);
        ctx.closePath();
        ctx.fill();

        // Glazed ceramic rim with neon cyan accent line
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(sx - 8.5 * z, sy - 15.5 * z, 17 * z, 1 * z);

        // Velvety green moss mound in the soil
        ctx.fillStyle = '#064e3b';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 15 * z, 7 * z, 2 * z, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#10b981';
        ctx.fillRect(sx - 4 * z, sy - 16 * z, 8 * z, 1.5 * z);

        const bx = sx + windSway * 0.6;
        const by = sy - 16 * z;

        const isOccluding = this.isEntityBehindTree(prop.wx, prop.wy);
        if (isOccluding) {
          ctx.save();
          ctx.globalAlpha = 0.32;
        }

        // 4. Sinuous Sculpted Driftwood Trunk (S-Curve Moyogi Style)
        ctx.strokeStyle = '#3e1a06'; // Dark juniper bark
        ctx.lineWidth = 4 * z;
        ctx.beginPath();
        ctx.moveTo(sx, by);
        ctx.quadraticCurveTo(bx + 7 * z, by - 6 * z, bx + 2 * z, by - 12 * z);
        ctx.quadraticCurveTo(bx - 6 * z, by - 18 * z, bx - 1 * z, by - 24 * z);
        ctx.stroke();

        // Warm bark facets
        ctx.strokeStyle = '#7c2d12';
        ctx.lineWidth = 2.4 * z;
        ctx.beginPath();
        ctx.moveTo(sx + 0.5 * z, by);
        ctx.quadraticCurveTo(bx + 7.5 * z, by - 6 * z, bx + 2.5 * z, by - 12 * z);
        ctx.quadraticCurveTo(bx - 5.5 * z, by - 18 * z, bx - 0.5 * z, by - 24 * z);
        ctx.stroke();

        // Bleached Deadwood Spine (Shari / Jin detail)
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.2 * z;
        ctx.beginPath();
        ctx.moveTo(sx - 0.8 * z, by - 2 * z);
        ctx.quadraticCurveTo(bx + 5 * z, by - 7 * z, bx + 1 * z, by - 13 * z);
        ctx.stroke();

        // Arching lateral branches supporting foliage pads
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 1.6 * z;
        ctx.beginPath();
        // Lower sweeping right branch
        ctx.moveTo(bx + 3 * z, by - 9 * z);
        ctx.lineTo(bx + 11 * z, by - 11 * z);
        // Mid sweeping left branch
        ctx.moveTo(bx - 2 * z, by - 16 * z);
        ctx.lineTo(bx - 10 * z, by - 18 * z);
        // Top right branch
        ctx.moveTo(bx, by - 22 * z);
        ctx.lineTo(bx + 6 * z, by - 24 * z);
        ctx.stroke();

        // 5. Tiered Asymmetrical Horizontal Foliage Cloud Pads (Dan)
        const bonsaiPads = [
          { ox: 12, oy: -12, rx: 7, ry: 3.5 },  // Lower right pad
          { ox: -11, oy: -19, rx: 8, ry: 4 },   // Mid left pad
          { ox: 7, oy: -25, rx: 6, ry: 3 },     // Upper right pad
          { ox: -1, oy: -26, rx: 8, ry: 4.5 },  // Apex crown pad
          { ox: -2, oy: -14, rx: 5, ry: 2.8 },  // Back depth accent pad
        ];

        for (const pad of bonsaiPads) {
          const px = bx + pad.ox * z;
          const py = by + pad.oy * z;

          // Deep shadow underbelly
          ctx.fillStyle = '#022c22';
          ctx.beginPath();
          ctx.ellipse(px, py + 1.2 * z, pad.rx * z, pad.ry * z, 0, 0, Math.PI * 2);
          ctx.fill();

          // Dense emerald needle base
          ctx.fillStyle = '#065f46';
          ctx.beginPath();
          ctx.ellipse(px, py, pad.rx * z, (pad.ry * 0.85) * z, 0, 0, Math.PI * 2);
          ctx.fill();

          // Vibrant needle stipples
          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.ellipse(px - 1 * z, py - 0.8 * z, (pad.rx * 0.7) * z, (pad.ry * 0.6) * z, 0, 0, Math.PI * 2);
          ctx.fill();

          // Spring tips / tender shoots highlight
          ctx.fillStyle = '#6ee7b7';
          ctx.fillRect(px - pad.rx * 0.5 * z, py - pad.ry * 0.7 * z, pad.rx * z, 1 * z);
          ctx.fillRect(px - 1 * z, py - pad.ry * 0.9 * z, 2 * z, 0.8 * z);
        }

        // 6. Fluttering Red Omamori Prayer Ribbon on left branch
        const ribbonSway = Math.sin(this.tick * 0.08) * 1.5 * z;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.2 * z;
        ctx.beginPath();
        ctx.moveTo(bx - 6 * z, by - 16 * z);
        ctx.lineTo(bx - 6 * z + ribbonSway, by - 12 * z);
        ctx.lineTo(bx - 5 * z + ribbonSway * 1.3, by - 9 * z);
        ctx.stroke();

        ctx.fillStyle = '#fef08a'; // Golden talisman knot
        ctx.fillRect(bx - 6.5 * z, by - 16.5 * z, 1.5 * z, 1.5 * z);

        // 7. Ambient Zen Blossom Sparkles drifting gently
        for (let j = 0; j < 2; j++) {
          const zTick = (this.tick + j * 50) % 150;
          const zx = bx + Math.sin(zTick * 0.05 + j) * 14 * z;
          const zy = by - 26 * z + (zTick / 150) * 22 * z;
          const zAlpha = Math.sin((zTick / 150) * Math.PI) * 0.7;
          ctx.fillStyle = `rgba(244, 114, 182, ${zAlpha})`;
          ctx.fillRect(zx, zy, 1.2 * z, 1.2 * z);
        }

        if (isOccluding) {
          ctx.restore();
        }
        break;
      }

      case 'tree_planter': {
        // 🏙️ Downtown Manicured Street Tree with Cast-Iron Grate
        // Square Granite Curb & Cast-Iron Grate
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.roundRect(sx - 9 * z, sy - 4.5 * z, 18 * z, 7 * z, 1.5 * z);
        ctx.fill();

        // Iron Grate Ring Slots
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(sx - 7.5 * z, sy - 3.5 * z, 15 * z, 5 * z);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(sx - 6 * z, sy - 2.5 * z, 12 * z, 3 * z);

        // Sturdy Trunk with Protective Timber Stakes
        ctx.fillStyle = '#451a03';
        ctx.fillRect(sx - 2.5 * z, sy - 20 * z, 5 * z, 18 * z);

        // Angled Tree Guide Stakes
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.2 * z;
        ctx.beginPath();
        ctx.moveTo(sx - 5 * z, sy - 3 * z);
        ctx.lineTo(sx - 1 * z, sy - 12 * z);
        ctx.moveTo(sx + 5 * z, sy - 3 * z);
        ctx.lineTo(sx + 1 * z, sy - 12 * z);
        ctx.stroke();

        const px = sx + windSway * 0.8;
        const py = sy - 26 * z;

        const isOccluding = this.isEntityBehindTree(prop.wx, prop.wy);
        if (isOccluding) {
          ctx.save();
          ctx.globalAlpha = 0.32;
        }

        // Spherical Manicured Foliage with Organic Leaf Clusters
        ctx.fillStyle = '#064e3b';
        ctx.beginPath();
        ctx.ellipse(px, py + 3 * z, 13 * z, 9 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.arc(px - 3 * z, py, 9 * z, 0, Math.PI * 2);
        ctx.arc(px + 3 * z, py, 9 * z, 0, Math.PI * 2);
        ctx.arc(px, py - 4 * z, 9.5 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(px - 2 * z, py - 3 * z, 6.5 * z, 0, Math.PI * 2);
        ctx.arc(px + 1 * z, py - 5 * z, 5.5 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#86efac';
        ctx.beginPath();
        ctx.arc(px - 1.5 * z, py - 5.5 * z, 2.5 * z, 0, Math.PI * 2);
        ctx.fill();

        if (isOccluding) {
          ctx.restore();
        }
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

        // Pulsing Neon Top Header (Floor796 Vibe)
        const neonPulse = 0.6 + Math.sin(this.tick * 0.1) * 0.4;
        ctx.fillStyle = `rgba(56, 189, 248, ${neonPulse})`;
        ctx.fillRect(sx - 5 * z, sy - 17 * z, 10 * z, 2.5 * z);

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(sx - 4.5 * z, sy - 14 * z, 9 * z, 8 * z);

        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(sx - 3.5 * z, sy - 13 * z, 2 * z, 3 * z);
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(sx - 0.5 * z, sy - 13 * z, 2 * z, 3 * z);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(sx + 2 * z, sy - 13 * z, 2 * z, 3 * z);

        // Chute with soft internal light
        ctx.fillStyle = '#0369a1';
        ctx.fillRect(sx - 4 * z, sy - 5 * z, 8 * z, 3 * z);
        ctx.fillStyle = 'rgba(254, 240, 138, 0.5)';
        ctx.fillRect(sx - 3 * z, sy - 4 * z, 6 * z, 1 * z);
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

      case 'toadstool_cluster': {
        // 🍄 Red-and-White Spotted Fly Agaric Mushrooms (Directly from Image 3!)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 8 * z, 3.5 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // 1. Primary Big Red Mushroom
        ctx.fillStyle = '#fef3c7';
        ctx.beginPath();
        ctx.moveTo(sx - 2.5 * z, sy);
        ctx.quadraticCurveTo(sx - 3 * z, sy - 6 * z, sx - 2 * z, sy - 9 * z);
        ctx.lineTo(sx + 1 * z, sy - 9 * z);
        ctx.quadraticCurveTo(sx + 1.5 * z, sy - 6 * z, sx + 2 * z, sy);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.ellipse(sx - 0.5 * z, sy - 9 * z, 6.5 * z, 2.5 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(sx - 0.5 * z, sy - 9 * z, 6.5 * z, Math.PI, 0);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sx - 2.5 * z, sy - 12 * z, 1.2 * z, 0, Math.PI * 2);
        ctx.arc(sx + 1.5 * z, sy - 13 * z, 1.4 * z, 0, Math.PI * 2);
        ctx.arc(sx + 3.5 * z, sy - 10 * z, 1.0 * z, 0, Math.PI * 2);
        ctx.arc(sx - 4.5 * z, sy - 10 * z, 0.9 * z, 0, Math.PI * 2);
        ctx.fill();

        // 2. Baby Brown/Tan Mushroom beside it (Image 3)
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(sx + 4 * z, sy - 4 * z, 1.6 * z, 4 * z);
        ctx.fillStyle = '#92400e';
        ctx.beginPath();
        ctx.arc(sx + 4.8 * z, sy - 4 * z, 3 * z, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(sx + 4.5 * z, sy - 5.5 * z, 0.9 * z, 0.9 * z);

        // Grass sprout
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(sx - 5 * z, sy - 3 * z, 1.5 * z, 3 * z);
        break;
      }

      case 'mossy_boulder': {
        // 🪨 Cracked Granite Boulder with Moss Cap (Directly from Image 3!)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 11 * z, 4.5 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Chiseled Boulder Base & Facets
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(sx - 9 * z, sy);
        ctx.lineTo(sx - 8 * z, sy - 9 * z);
        ctx.lineTo(sx - 3 * z, sy - 14 * z);
        ctx.lineTo(sx + 5 * z, sy - 13 * z);
        ctx.lineTo(sx + 9 * z, sy - 6 * z);
        ctx.lineTo(sx + 8 * z, sy);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.moveTo(sx - 8 * z, sy - 9 * z);
        ctx.lineTo(sx - 3 * z, sy - 14 * z);
        ctx.lineTo(sx + 1 * z, sy - 13 * z);
        ctx.lineTo(sx - 2 * z, sy - 4 * z);
        ctx.lineTo(sx - 7 * z, sy - 2 * z);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(sx - 4 * z, sy - 12 * z, 3 * z, 2 * z);

        // Fissure Cracks (Image 3)
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1 * z;
        ctx.beginPath();
        ctx.moveTo(sx - 1 * z, sy - 13 * z);
        ctx.lineTo(sx, sy - 7 * z);
        ctx.lineTo(sx + 4 * z, sy - 3 * z);
        ctx.stroke();

        // Lush Green Moss Layer on Top
        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.moveTo(sx - 6 * z, sy - 11 * z);
        ctx.quadraticCurveTo(sx - 1 * z, sy - 15 * z, sx + 4 * z, sy - 12 * z);
        ctx.lineTo(sx + 3 * z, sy - 9 * z);
        ctx.quadraticCurveTo(sx - 2 * z, sy - 10 * z, sx - 5 * z, sy - 8 * z);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#22c55e';
        ctx.fillRect(sx - 3 * z, sy - 13 * z, 3 * z, 1.5 * z);

        // Small Pebble Stack Beside
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.arc(sx + 8 * z, sy - 1 * z, 2.5 * z, 0, Math.PI * 2);
        ctx.arc(sx + 7 * z, sy - 4 * z, 1.8 * z, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'hollow_log': {
        // 🪵 Mossy Fallen Hollow Log (Directly from Image 3!)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 14 * z, 4 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Main Log Cylinder Body
        ctx.fillStyle = '#451a03';
        ctx.fillRect(sx - 11 * z, sy - 7 * z, 20 * z, 7 * z);

        ctx.fillStyle = '#78350f';
        ctx.fillRect(sx - 11 * z, sy - 7 * z, 19 * z, 2 * z);

        // Cut End Face with Hollow Cavity
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.ellipse(sx + 9 * z, sy - 3.5 * z, 3.5 * z, 3.5 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.ellipse(sx + 9 * z, sy - 3.5 * z, 2 * z, 2 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Moss Patch on Log
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(sx - 7 * z, sy - 7.5 * z, 6 * z, 1.8 * z);
        ctx.fillRect(sx + 1 * z, sy - 7.5 * z, 4 * z, 1.8 * z);

        // Sprouting Baby Mushrooms
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(sx - 4 * z, sy - 10 * z, 1 * z, 3 * z);
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(sx - 3.5 * z, sy - 10 * z, 1.8 * z, Math.PI, 0);
        ctx.fill();
        break;
      }

      case 'jungle_fern': {
        // 🌿 Prehistoric Fan-Frond Jungle Fern (Images 1 & 3)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 8 * z, 3.5 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        const fernAngles = [-0.8, -0.4, 0, 0.4, 0.8];
        const fSway = Math.sin(this.tick * 0.06) * 1.5 * z;

        ctx.strokeStyle = '#065f46';
        ctx.lineWidth = 1.4 * z;
        for (const fa of fernAngles) {
          const ex = sx + Math.sin(fa) * 10 * z + fSway * 0.5;
          const ey = sy - 2 * z - Math.cos(fa) * 9 * z;
          ctx.beginPath();
          ctx.moveTo(sx, sy - 1 * z);
          ctx.quadraticCurveTo((sx + ex) / 2 + fSway * 0.4, (sy + ey) / 2 - 2 * z, ex, ey);
          ctx.stroke();

          ctx.fillStyle = '#10b981';
          ctx.fillRect(ex - 1.5 * z, ey - 1.5 * z, 3 * z, 3 * z);
          ctx.fillStyle = '#34d399';
          ctx.fillRect(ex - 0.8 * z, ey - 0.8 * z, 1.6 * z, 1.6 * z);
        }
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Cyber Billboard Banners (Sponsorship Placeholders)
  // ---------------------------------------------------------------------------

  private collectBanners(
    range: { minGx: number; maxGx: number; minGy: number; maxGy: number },
    entities: RenderableEntity[],
    lights: LightSource[],
  ): void {
    const W = this.camera.viewportWidth;
    const H = this.camera.viewportHeight;

    for (const banner of WORLD_BANNERS) {
      if (
        banner.gx < range.minGx - 4 ||
        banner.gx > range.maxGx + 4 ||
        banner.gy < range.minGy - 4 ||
        banner.gy > range.maxGy + 4
      ) {
        continue;
      }

      const wx = banner.gx * TILE_WIDTH + TILE_WIDTH / 2;
      const wy = banner.gy * TILE_HEIGHT + TILE_HEIGHT / 2;
      const screen = this.camera.worldToScreen(wx, wy);

      if (screen.x < -100 || screen.x > W + 100 || screen.y < -100 || screen.y > H + 100) {
        continue;
      }

      // Ambient Ground Spotlight
      lights.push({
        wx,
        wy: wy - 4,
        radius: banner.lightRadius,
        color: banner.lightColor,
      });

      const isHovered = this.hoveredBanner?.id === banner.id;

      entities.push({
        depth: wy,
        render: (ctx, z) => {
          this.drawBillboard(ctx, banner, screen.x, screen.y, z, isHovered);
        },
      });
    }
  }

  private drawBillboard(
    ctx: CanvasRenderingContext2D,
    banner: WorldBanner,
    sx: number,
    sy: number,
    z: number,
    isHovered: boolean,
  ): void {
    const pw = banner.pixelWidth * z;
    const ph = banner.pixelHeight * z;
    const poleH = 30 * z;
    const halfW = pw / 2;

    const screenTopY = sy - poleH - ph;
    const screenBottomY = sy - poleH;

    ctx.save();

    // 1. Ground Drop Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, halfW * 0.92, 6 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Concrete Anchor Footings
    const legSpacing = halfW * 0.68;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(sx - legSpacing - 4.5 * z, sy - 4 * z, 9 * z, 4 * z);
    ctx.fillRect(sx + legSpacing - 4.5 * z, sy - 4 * z, 9 * z, 4 * z);

    // 3. Steel Lattice Truss Legs
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = Math.max(1.4, 2.8 * z);
    ctx.beginPath();
    // Left leg
    ctx.moveTo(sx - legSpacing, sy);
    ctx.lineTo(sx - legSpacing, screenBottomY);
    // Right leg
    ctx.moveTo(sx + legSpacing, sy);
    ctx.lineTo(sx + legSpacing, screenBottomY);
    ctx.stroke();

    // Cross-bracing struts
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = Math.max(1.0, 1.6 * z);
    ctx.beginPath();
    ctx.moveTo(sx - legSpacing, sy - 4 * z);
    ctx.lineTo(sx + legSpacing, screenBottomY + 4 * z);
    ctx.moveTo(sx + legSpacing, sy - 4 * z);
    ctx.lineTo(sx - legSpacing, screenBottomY + 4 * z);
    ctx.stroke();

    // 4. Backing & Outer Chassis
    const chassisX = sx - halfW;
    const chassisY = screenTopY;
    const chassisW = pw;
    const chassisH = ph;

    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.roundRect(chassisX - 3 * z, chassisY - 3 * z, chassisW + 6 * z, chassisH + 6 * z, 5 * z);
    ctx.fill();

    // Bezel Border with Neon Lighting
    ctx.strokeStyle = isHovered ? '#ffffff' : banner.accentColor;
    ctx.lineWidth = isHovered ? Math.max(1.8, 2.6 * z) : Math.max(1.2, 1.8 * z);
    if (isHovered) {
      ctx.shadowColor = banner.accentColor;
      ctx.shadowBlur = 14 * z;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 5. Obsidian Screen Glass Inside
    ctx.fillStyle = 'rgba(11, 15, 23, 0.94)';
    ctx.fillRect(chassisX, chassisY, chassisW, chassisH);

    // 6. Scanline raster effect
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    const scanlineSpacing = Math.max(2, 2.8 * z);
    for (let l = chassisY; l < chassisY + chassisH; l += scanlineSpacing) {
      ctx.fillRect(chassisX, l, chassisW, Math.max(0.6, 0.9 * z));
    }

    // Moving scanline sweep
    const sweepOffset = (this.tick * 0.75 * z) % chassisH;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.fillRect(chassisX, chassisY + sweepOffset, chassisW, Math.max(1, 1.8 * z));

    // 7. Render Screen Content (Strict Priority Order: Image > Business Name/Title > Citizen Name)
    const imageUrl = banner.bannerImageUrl;
    let loadedImage: HTMLImageElement | null = null;
    if (imageUrl) {
      let cached = this.bannerImageCache.get(imageUrl);
      if (!cached) {
        cached = new Image();
        cached.crossOrigin = 'anonymous';
        cached.src = imageUrl;
        this.bannerImageCache.set(imageUrl, cached);
      }
      if (cached.complete && cached.naturalWidth > 0) {
        loadedImage = cached;
      }
    }

    if (loadedImage) {
      // ── Priority 1: Banner Image / Logo (Prominently rendered) ──
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(chassisX + 1.5 * z, chassisY + 1.5 * z, chassisW - 3 * z, chassisH - 3 * z, 3 * z);
      ctx.clip();

      const imgRatio = loadedImage.naturalWidth / loadedImage.naturalHeight;
      const boxW = chassisW - 3 * z;
      const boxH = chassisH - 3 * z;
      const boxRatio = boxW / boxH;
      let dw = boxW;
      let dh = boxH;
      if (imgRatio > boxRatio) {
        dh = dw / imgRatio;
      } else {
        dw = dh * imgRatio;
      }
      const dx = chassisX + chassisW / 2 - dw / 2;
      const dy = chassisY + chassisH / 2 - dh / 2;

      ctx.drawImage(loadedImage, dx, dy, dw, dh);
      ctx.restore();
    } else {
      // ── Priority 2: Business Name, Title / Headline OR Priority 3: Citizen Name ──
      const isCitizen = !!banner.citizen;
      const hasBusiness = !!(banner.buyerName || (banner.headline && banner.headline !== 'COMING SOON...'));

      let topTag = banner.tag;
      let mainTitle = banner.headline;
      let subTitle = banner.subtext;

      if (hasBusiness) {
        // Priority 2: Business Name & Title
        if (banner.buyerName) {
          topTag = banner.buyerName.toUpperCase().slice(0, 22);
        }
        mainTitle = banner.headline;
        subTitle = banner.subtext;
      } else if (isCitizen && banner.citizen) {
        // Priority 3: Citizen Name
        topTag = 'CITIZEN SPONSOR';
        mainTitle = banner.citizen.displayName.toUpperCase().slice(0, 22);
        subTitle = banner.citizen.spot
          ? `CITIZEN PLOT (${banner.citizen.spot.x}, ${banner.citizen.spot.y})`
          : 'SPOT WORLD CITIZEN';
      }

      // LOD: At low zoom (< 0.5), hide text to keep satellite view clean & elegant
      if (z < 0.5 && !isHovered) {
        const barW = Math.max(12, pw * 0.6);
        const barH = Math.max(2, 2.6 * z);
        ctx.fillStyle = banner.accentColor;
        ctx.globalAlpha = 0.75 + Math.sin(this.tick * 0.1) * 0.25;
        ctx.fillRect(sx - barW / 2, chassisY + chassisH / 2 - barH / 2, barW, barH);
        ctx.globalAlpha = 1.0;
      } else {
        // Medium to close zoom: Render crisp typography
        // Upper Tag Pill
        if (z >= 0.7 || isHovered) {
          const tagFontH = Math.max(6.5, 8.5 * z);
          ctx.font = `700 ${tagFontH}px 'Chakra Petch', sans-serif`;
          ctx.fillStyle = banner.accentColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(topTag, sx, chassisY + 10 * z);
        }

        // Main Headline / Title / Citizen Name
        const headFontH = Math.max(10, 13 * z);
        ctx.font = `800 ${headFontH}px 'Chakra Petch', sans-serif`;
        ctx.fillStyle = '#ffffff';
        if (isHovered || z >= 0.7) {
          ctx.shadowColor = banner.accentColor;
          ctx.shadowBlur = 8 * z;
        }
        const headY = (z >= 0.7 || isHovered) ? (chassisY + 24 * z) : (chassisY + chassisH / 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(mainTitle, sx, headY);
        ctx.shadowBlur = 0;

        // Subtext / Tagline
        if (subTitle && (z >= 0.8 || (isHovered && z >= 0.65))) {
          const subFontH = Math.max(5.8, 7.5 * z);
          ctx.font = `600 ${subFontH}px 'Outfit', sans-serif`;
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(subTitle, sx, chassisY + 37 * z);
        }
      }
    }

    // 8. Hover Reticle / Tooltip if Hovered
    if (isHovered) {
      const tooltipText = `📡 ${banner.name} • Click to Inspect`;
      ctx.font = `700 10px 'Chakra Petch', sans-serif`;
      const textW = ctx.measureText(tooltipText).width;
      const pillW = textW + 16;
      const pillH = 22;
      const tipY = chassisY - 14;

      ctx.fillStyle = 'rgba(11, 15, 23, 0.95)';
      ctx.beginPath();
      ctx.roundRect(sx - pillW / 2, tipY - pillH / 2, pillW, pillH, 5);
      ctx.fill();

      ctx.strokeStyle = banner.accentColor;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tooltipText, sx, tipY);
    }

    ctx.restore();
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
