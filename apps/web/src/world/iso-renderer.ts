/**
 * IsoRenderer — Canvas2D draw layer for Spot World.
 *
 * Citizen avatars are rendered using the existing 8-bit pixel avatar system
 * (drawAvatarOnCanvas / AVATAR_CATALOG) — no external sprite sheet needed.
 * Terrain, vegetation, and buildings are drawn with procedural Canvas2D shapes
 * in a cohesive palette that matches the existing Spot aesthetic.
 *
 * Drawing pipeline per frame:
 *  1. Clear canvas
 *  2. Apply camera transform (translate + scale)
 *  3. For each visible tile sorted by depth (painter's algorithm):
 *     a. Draw terrain rhombus
 *     b. Draw vegetation OR building (occupied tile)
 *     c. Draw avatar (occupied tile)
 *  4. Draw hover / selection highlight overlay
 *  5. Restore transform
 */

import { IsoCamera } from './iso-camera.js';
import {
  gridToWorld,
  getWorldOrigin,
  ISO_TILE_W,
  ISO_TILE_H,
  ISO_TILE_W_HALF,
  ISO_TILE_H_HALF,
  getVisibleGridRange,
  depthKey,
} from '@spot/world';
import {
  getTileNature,
  getHouseStyle,
  getAvatarIdleOffset,
  type HouseStyle,
  type VegetationType,
} from './terrain-generator.js';
import type { OccupiedSpotSummary } from '@spot/shared';

// Reuse the existing avatar renderer
import { AVATAR_CATALOG, drawAvatarOnCanvas } from '../canvas/avatars.js';

// ---------------------------------------------------------------------------
// Colour palette (matches Spot's obsidian/amber/jade theme)
// ---------------------------------------------------------------------------

const PALETTE = {
  // Terrain
  grass_a: '#2d5a1b',
  grass_b: '#3a6b22',
  tile_edge_l: '#1e3d12',   // left face of iso tile
  tile_edge_r: '#243816',   // right face of iso tile

  // Vegetation
  tree_trunk: '#5c3a1e',
  tree_canopy_a: '#2e7d32',
  tree_canopy_b: '#1b5e20',
  bush: '#388e3c',
  flower_stem: '#66bb6a',
  flower_head: '#ffd54f',
  rock: '#78909c',

  // House — default cozy cottage
  house_default_wall: '#c8a882',
  house_default_roof: '#8b4513',
  house_default_door: '#5c3a1e',
  house_default_window: '#87ceeb',

  // House — tech
  house_tech_wall: '#263238',
  house_tech_roof: '#00bcd4',
  house_tech_door: '#0097a7',
  house_tech_window: '#80deea',

  // House — magic
  house_magic_wall: '#311b92',
  house_magic_roof: '#7c4dff',
  house_magic_door: '#ea80fc',
  house_magic_window: '#e040fb',

  // House — explorer
  house_explorer_wall: '#1a237e',
  house_explorer_roof: '#283593',
  house_explorer_door: '#3f51b5',
  house_explorer_window: '#82b1ff',

  // UI overlays
  hover_fill: 'rgba(245,158,11,0.18)',
  hover_stroke: 'rgba(245,158,11,0.8)',
  selected_fill: 'rgba(245,158,11,0.28)',
  selected_stroke: '#f59e0b',
  online_glow: 'rgba(16,185,129,0.6)',
};

// ---------------------------------------------------------------------------
// Avatar cache — offscreen canvases keyed by avatarId
// ---------------------------------------------------------------------------

const avatarCache = new Map<string, HTMLCanvasElement>();

function getCachedAvatar(avatarId: string): HTMLCanvasElement {
  if (avatarCache.has(avatarId)) return avatarCache.get(avatarId)!;

  const size = 32;
  const oc = document.createElement('canvas');
  oc.width = size;
  oc.height = size;
  const octx = oc.getContext('2d');
  if (!octx) { avatarCache.set(avatarId, oc); return oc; }

  const def = AVATAR_CATALOG[avatarId] ?? AVATAR_CATALOG['astronaut'];
  drawAvatarOnCanvas(octx, def, 0, 0, size);

  avatarCache.set(avatarId, oc);
  return oc;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Lighten or darken a hex colour by amount */
function shadeColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// ---------------------------------------------------------------------------
// Sprite draw record (for depth-sorted batching)
// ---------------------------------------------------------------------------

interface DrawCall {
  depth: number;
  fn: () => void;
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export interface IsoRendererEvents {
  onTileClick?: (gx: number, gy: number, occupied?: OccupiedSpotSummary) => void;
  onTileHover?: (gx: number, gy: number, occupied?: OccupiedSpotSummary) => void;
  onTileHoverClear?: () => void;
}

export class IsoRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly camera: IsoCamera;

  private occupiedMap = new Map<string, OccupiedSpotSummary>();

  // Interaction state
  hoveredTile: { gx: number; gy: number } | null = null;
  selectedTile: { gx: number; gy: number } | null = null;

  // Animation
  private animFrameId: number | null = null;
  private frameCount = 0;

  events: IsoRendererEvents = {};

  // Cached world origin offset
  private ox = 0;
  private oy = 0;

  constructor(
    canvas: HTMLCanvasElement,
    camera: IsoCamera,
    events: IsoRendererEvents = {},
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Cannot get 2D context');
    this.ctx = ctx;
    this.camera = camera;
    this.events = events;

    const { ox, oy } = getWorldOrigin();
    this.ox = ox;
    this.oy = oy;
  }

  setOccupied(spots: OccupiedSpotSummary[]): void {
    this.occupiedMap.clear();
    for (const s of spots) {
      this.occupiedMap.set(`${s.x},${s.y}`, s);
    }
  }

  start(): void {
    this.loop();
  }

  stop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  handleResize(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.scale(dpr, dpr);
    this.camera.setViewport(w, h);
  }

  // ---------------------------------------------------------------------------
  // Render loop
  // ---------------------------------------------------------------------------

  private loop = (): void => {
    this.animFrameId = requestAnimationFrame(this.loop);
    this.frameCount++;
    this.camera.update();
    this.draw();
  };

  private draw(): void {
    const { ctx, camera } = this;
    const W = camera.viewportWidth;
    const H = camera.viewportHeight;

    // 1. Clear
    ctx.fillStyle = '#1a2e1a'; // dark forest background behind the diamond
    ctx.fillRect(0, 0, W, H);

    // 2. Determine visible tile range
    const bounds = camera.getWorldBounds();
    const range = getVisibleGridRange(
      bounds.left - this.ox,
      bounds.top - this.oy,
      bounds.right - this.ox,
      bounds.bottom - this.oy,
    );

    // 3. Collect draw calls into a sortable array
    const calls: DrawCall[] = [];

    for (let gy = range.minGy; gy <= range.maxGy; gy++) {
      for (let gx = range.minGx; gx <= range.maxGx; gx++) {
        const key = `${gx},${gy}`;
        const occupied = this.occupiedMap.get(key);
        const nature = getTileNature(gx, gy, !!occupied);

        const { wx, wy } = gridToWorld(gx, gy);
        const worldX = wx + this.ox;
        const worldY = wy + this.oy;

        // Convert to screen
        const screen = camera.worldToScreen(worldX, worldY);
        const cx = screen.x;
        const cy = screen.y;

        const z = camera.zoom;

        // Scale tile dimensions for current zoom
        const tw = ISO_TILE_W * z;
        const th = ISO_TILE_H * z;
        const thw = tw / 2;
        const thh = th / 2;

        const dk = depthKey(gx, gy);

        // Draw calls are closures capturing (gx, gy, cx, cy, tw, th, …)
        // We separate terrain (layer 0), vegetation/house (layer 1), avatar (layer 2)

        const baseColor =
          nature.base === 'grass_a' ? PALETTE.grass_a : PALETTE.grass_b;

        // Terrain (layer 0)
        calls.push({
          depth: dk,
          fn: () => {
            // Scale-aware rhombus: recompute in scaled coords
            this.drawScaledRhombus(ctx, cx, cy, thw, thh, z, baseColor);

            // Hover / selection
            if (
              this.hoveredTile?.gx === gx &&
              this.hoveredTile?.gy === gy
            ) {
              this.drawScaledHighlight(ctx, cx, cy, thw, thh,
                PALETTE.hover_fill, PALETTE.hover_stroke);
            }
            if (
              this.selectedTile?.gx === gx &&
              this.selectedTile?.gy === gy
            ) {
              this.drawScaledHighlight(ctx, cx, cy, thw, thh,
                PALETTE.selected_fill, PALETTE.selected_stroke);
            }
          },
        });

        // Vegetation or building (layer 1)
        if (occupied) {
          const hStyle = getHouseStyle(occupied.avatarId);
          calls.push({
            depth: dk + 0.5,
            fn: () => this.drawScaledHouse(ctx, cx, cy, thw, thh, z, hStyle),
          });
        } else if (nature.vegetation) {
          const veg = nature.vegetation;
          calls.push({
            depth: dk + 0.5,
            fn: () => this.drawScaledVegetation(ctx, cx, cy, thw, thh, z, veg),
          });
        }

        // Avatar (layer 2) — only for occupied tiles
        if (occupied) {
          const { dx: idxOff, dy: idyOff } = getAvatarIdleOffset(gx, gy);
          calls.push({
            depth: dk + 0.9,
            fn: () => this.drawScaledAvatar(ctx, cx, cy, thw, thh, z, occupied, idxOff, idyOff),
          });
        }
      }
    }

    // 4. Sort by depth (painter's algorithm: lowest depth drawn first)
    calls.sort((a, b) => a.depth - b.depth);

    // 5. Execute all draw calls
    for (const call of calls) call.fn();
  }

  // ---------------------------------------------------------------------------
  // Scale-aware draw helpers
  // All dimensions are in *screen* space (pre-multiplied by camera.zoom)
  // ---------------------------------------------------------------------------

  private drawScaledRhombus(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    hw: number, hh: number,
    z: number,
    topColor: string,
  ): void {
    const depth = 6 * z;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + hw, cy + hh);
    ctx.lineTo(cx, cy + hh * 2);
    ctx.lineTo(cx - hw, cy + hh);
    ctx.closePath();
    ctx.fillStyle = topColor;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx - hw, cy + hh);
    ctx.lineTo(cx, cy + hh * 2);
    ctx.lineTo(cx, cy + hh * 2 + depth);
    ctx.lineTo(cx - hw, cy + hh + depth);
    ctx.closePath();
    ctx.fillStyle = PALETTE.tile_edge_l;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + hw, cy + hh);
    ctx.lineTo(cx, cy + hh * 2);
    ctx.lineTo(cx, cy + hh * 2 + depth);
    ctx.lineTo(cx + hw, cy + hh + depth);
    ctx.closePath();
    ctx.fillStyle = PALETTE.tile_edge_r;
    ctx.fill();
  }

  private drawScaledHighlight(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    hw: number, hh: number,
    fill: string, stroke: string,
  ): void {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + hw, cy + hh);
    ctx.lineTo(cx, cy + hh * 2);
    ctx.lineTo(cx - hw, cy + hh);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  private drawScaledHouse(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    hw: number, hh: number,
    z: number,
    style: HouseStyle,
  ): void {
    const topY = cy + hh; // vertical centre of tile top face
    const wallH = 28 * z;
    const halfW = hw * 0.75;
    const roofH = 18 * z;

    const colors = {
      wall: PALETTE[`house_${style}_wall` as keyof typeof PALETTE] as string,
      roof: PALETTE[`house_${style}_roof` as keyof typeof PALETTE] as string,
      door: PALETTE[`house_${style}_door` as keyof typeof PALETTE] as string,
      window: PALETTE[`house_${style}_window` as keyof typeof PALETTE] as string,
    };

    // Front face
    ctx.beginPath();
    ctx.moveTo(cx - halfW, topY);
    ctx.lineTo(cx, topY - wallH * 0.5);
    ctx.lineTo(cx, topY - wallH);
    ctx.lineTo(cx - halfW, topY - wallH * 0.5);
    ctx.closePath();
    ctx.fillStyle = colors.wall;
    ctx.fill();

    // Side face
    ctx.beginPath();
    ctx.moveTo(cx + halfW, topY);
    ctx.lineTo(cx, topY - wallH * 0.5);
    ctx.lineTo(cx, topY - wallH);
    ctx.lineTo(cx + halfW, topY - wallH * 0.5);
    ctx.closePath();
    ctx.fillStyle = shadeColor(colors.wall, -20);
    ctx.fill();

    // Roof
    const roofPeak = topY - wallH - roofH;
    ctx.beginPath();
    ctx.moveTo(cx - halfW, topY - wallH * 0.5);
    ctx.lineTo(cx + halfW, topY - wallH * 0.5);
    ctx.lineTo(cx, roofPeak);
    ctx.closePath();
    ctx.fillStyle = colors.roof;
    ctx.fill();

    // Door
    const dw = 6 * z, dh = 10 * z;
    ctx.fillStyle = colors.door;
    ctx.fillRect(cx - dw / 2, topY - wallH * 0.5, dw, dh);

    // Window
    const ww = 7 * z;
    ctx.fillStyle = colors.window;
    ctx.fillRect(cx - halfW * 0.5 - ww / 2, topY - wallH * 0.75, ww, ww);

    // Online glow for online citizens (pulse via frameCount)
    // (isOnline check happens externally — caller can conditionally call this)
  }

  private drawScaledVegetation(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    _hw: number, hh: number,
    z: number,
    type: VegetationType,
  ): void {
    if (!type) return;
    const topY = cy + hh;

    switch (type) {
      case 'tree_a':
      case 'tree_b': {
        const trunkH = 18 * z;
        const canopyR = (type === 'tree_a' ? 18 : 13) * z;
        const canopyY = topY - trunkH - canopyR * 0.6;

        ctx.fillStyle = PALETTE.tree_trunk;
        ctx.fillRect(cx - 2 * z, topY - trunkH, 4 * z, trunkH);

        ctx.fillStyle = type === 'tree_a' ? PALETTE.tree_canopy_b : PALETTE.tree_canopy_a;
        ctx.beginPath();
        ctx.ellipse(cx, canopyY + 4 * z, canopyR * 0.85, canopyR * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = type === 'tree_a' ? PALETTE.tree_canopy_a : PALETTE.tree_canopy_b;
        ctx.beginPath();
        ctx.ellipse(cx, canopyY, canopyR, canopyR * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'bush': {
        ctx.fillStyle = PALETTE.bush;
        ctx.beginPath();
        ctx.ellipse(cx, topY - 6 * z, 10 * z, 7 * z, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'flower': {
        ctx.strokeStyle = PALETTE.flower_stem;
        ctx.lineWidth = 1.5 * z;
        ctx.beginPath();
        ctx.moveTo(cx, topY);
        ctx.lineTo(cx, topY - 10 * z);
        ctx.stroke();
        ctx.fillStyle = PALETTE.flower_head;
        ctx.beginPath();
        ctx.ellipse(cx, topY - 12 * z, 4 * z, 4 * z, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'rock': {
        ctx.fillStyle = PALETTE.rock;
        ctx.beginPath();
        ctx.ellipse(cx, topY - 3 * z, 7 * z, 4 * z, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  }

  private drawScaledAvatar(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    hw: number, hh: number,
    z: number,
    spot: OccupiedSpotSummary,
    idxOff: number,
    idyOff: number,
  ): void {
    const size = Math.max(16, Math.round(28 * z));
    const topY = cy + hh;

    // Idle wander: slight sub-tile offset + very subtle float animation
    const floatY = Math.sin(this.frameCount * 0.04) * 2 * z;
    const drawX = cx + idxOff * hw - size / 2;
    const drawY = topY - size * 1.4 + idyOff * hh + floatY;

    // Shadow ellipse under avatar
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx + idxOff * hw, topY - 4 * z, size * 0.35, size * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Online glow ring
    if (spot.isOnline) {
      const pulse = 0.65 + 0.35 * Math.sin(this.frameCount * 0.08);
      ctx.shadowColor = `rgba(16,185,129,${pulse})`;
      ctx.shadowBlur = 8 * z;
    }

    // Draw the cached 8-bit pixel avatar
    const avatarCanvas = getCachedAvatar(spot.avatarId);
    ctx.drawImage(avatarCanvas, drawX, drawY, size, size);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Name label (only when zoom is sufficient)
    if (z >= 0.6) {
      const fontSize = Math.round(Math.max(8, 10 * z));
      ctx.font = `600 ${fontSize}px 'Outfit', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';

      const labelX = cx + idxOff * hw;
      const labelY = drawY - 2;

      // Background pill
      const text = spot.displayName.length > 12
        ? spot.displayName.slice(0, 11) + '…'
        : spot.displayName;
      const textW = ctx.measureText(text).width;
      const padX = 4 * z, padY = 2 * z;

      ctx.fillStyle = 'rgba(9,11,16,0.78)';
      const rx = 3 * z;
      const bx = labelX - textW / 2 - padX;
      const by = labelY - fontSize - padY * 2;
      const bw = textW + padX * 2;
      const bh = fontSize + padY * 2;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, rx);
      ctx.fill();

      ctx.fillStyle = '#f8fafc';
      ctx.fillText(text, labelX, labelY);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }
}
