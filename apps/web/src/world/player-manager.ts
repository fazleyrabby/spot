/**
 * PlayerManager — WASD / Arrow key controlled chibi citizen in Spot World (Stardew Valley / Harvest Moon style).
 *
 * Visual & Gameplay features:
 * - 4-direction movement (down, up, left, right)
 * - 4-frame walk animation with head bob and foot steps
 * - Chibi proportions (large head ~40%, cute body, stubby feet)
 * - Sleep mode after 3 seconds of idle (snooze pose + floating 'z' particles)
 * - "You" name badge with amber accent
 * - Constrained to 5x5 plot with edge transition support
 */

import {
  TILE_WIDTH,
  TILE_HEIGHT,
  gridToWorldCenter,
  worldToGrid,
  TOTAL_WORLD_WIDTH,
  TOTAL_WORLD_HEIGHT,
} from '@spot/world';
import { AVATAR_CATALOG } from '../canvas/avatars.js';
import type { AvatarDefinition } from '@spot/shared';
import type { Plot, PlotManager } from './plot-manager.js';

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

export type Direction = 'down' | 'up' | 'left' | 'right';
export type PlayerState = 'idle' | 'walking' | 'sleeping';

const MOVE_SPEED = 2.4; // pixels per frame at 60fps
const WALK_FRAME_INTERVAL = 7; // frames per step
const IDLE_SLEEP_TIMEOUT = 180; // 3 seconds at 60fps

interface SleepParticle {
  x: number;
  y: number;
  alpha: number;
  scale: number;
  seed: number;
  age: number;
}

export class PlayerManager {
  // World space continuous pixel position (feet anchor)
  wx: number = 50 * TILE_WIDTH + TILE_WIDTH / 2;
  wy: number = 50 * TILE_HEIGHT + TILE_HEIGHT / 2;

  // Grid coordinates
  gx: number = 50;
  gy: number = 50;

  // State
  state: PlayerState = 'idle';
  direction: Direction = 'down';
  frame = 0;
  private animTimer = 0;
  private idleTimer = 0;

  // Visuals & avatar
  avatar: AvatarDefinition;
  displayName: string = 'You';
  isFounder: boolean = false;
  isVerified: boolean = false;

  // Plot navigation & containment
  private plotManager: PlotManager | null = null;
  currentPlot: Plot | null = null;
  private onPlotChange?: (plot: Plot) => void;

  // Sleep floating particles
  private sleepParticles: SleepParticle[] = [];

  // Key tracking
  private keys = new Set<string>();

  constructor(
    avatarId: string,
    plotManager?: PlotManager,
    onPlotChange?: (plot: Plot) => void,
  ) {
    this.avatar = AVATAR_CATALOG[avatarId] ?? AVATAR_CATALOG.astronaut;
    this.plotManager = plotManager ?? null;
    this.onPlotChange = onPlotChange;
  }

  setAvatar(avatarId: string): void {
    this.avatar = AVATAR_CATALOG[avatarId] ?? AVATAR_CATALOG.astronaut;
  }

  setPlotManager(pm: PlotManager): void {
    this.plotManager = pm;
    this.updateCurrentPlot();
  }

  /**
   * Set player position by grid coordinate (e.g. at claimed spot center).
   */
  setPosition(gx: number, gy: number): void {
    this.gx = gx;
    this.gy = gy;
    const center = gridToWorldCenter(gx, gy);
    this.wx = center.wx;
    this.wy = center.wy;
    this.updateCurrentPlot();
  }

  /**
   * Teleport player to a target grid tile.
   */
  teleport(gx: number, gy: number): void {
    this.setPosition(gx, gy);
    this.state = 'idle';
    this.idleTimer = 0;
  }

  private updateCurrentPlot(): void {
    if (!this.plotManager) return;
    const grid = worldToGrid(this.wx, this.wy);
    if (!grid) return;
    this.gx = grid.gx;
    this.gy = grid.gy;

    const plot = this.plotManager.getPlotAt(grid.gx, grid.gy);
    if (plot && plot !== this.currentPlot) {
      this.currentPlot = plot;
      this.onPlotChange?.(plot);
    }
  }

  // ---------------------------------------------------------------------------
  // Input Handling
  // ---------------------------------------------------------------------------

  bindInput(): void {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        this.keys.add(k);
        this.resetIdle();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
    });
  }

  private resetIdle(): void {
    if (this.state === 'sleeping') {
      this.state = 'idle';
    }
    this.idleTimer = 0;
  }

  // ---------------------------------------------------------------------------
  // Frame Update (Physics & Animation)
  // ---------------------------------------------------------------------------

  update(): void {
    let dx = 0;
    let dy = 0;

    const up = this.keys.has('w') || this.keys.has('arrowup');
    const down = this.keys.has('s') || this.keys.has('arrowdown');
    const left = this.keys.has('a') || this.keys.has('arrowleft');
    const right = this.keys.has('d') || this.keys.has('arrowright');

    if (up) dy -= 1;
    if (down) dy += 1;
    if (left) dx -= 1;
    if (right) dx += 1;

    if (dx !== 0 || dy !== 0) {
      this.state = 'walking';
      this.idleTimer = 0;

      // 4-direction priority
      if (Math.abs(dy) >= Math.abs(dx)) {
        this.direction = dy > 0 ? 'down' : 'up';
      } else {
        this.direction = dx > 0 ? 'right' : 'left';
      }

      // Normalize diagonal vector
      const len = Math.hypot(dx, dy);
      const moveX = (dx / len) * MOVE_SPEED;
      const moveY = (dy / len) * MOVE_SPEED;

      let nextWx = this.wx + moveX;
      let nextWy = this.wy + moveY;

      // Plot boundary constraint (keep inside current plot or allow seamless neighbor transition)
      if (this.currentPlot) {
        const margin = 12;
        const minX = this.currentPlot.worldMinX + margin;
        const maxX = this.currentPlot.worldMaxX - margin;
        const minY = this.currentPlot.worldMinY + margin;
        const maxY = this.currentPlot.worldMaxY - margin;

        // Check if there is an adjacent plot in the moving direction
        const gridAhead = worldToGrid(nextWx, nextWy);
        const plotAhead = gridAhead ? this.plotManager?.getPlotAt(gridAhead.gx, gridAhead.gy) : null;

        if (!plotAhead) {
          // Constrain to current plot boundaries
          nextWx = Math.max(minX, Math.min(maxX, nextWx));
          nextWy = Math.max(minY, Math.min(maxY, nextWy));
        }
      }

      // World edge bounds
      this.wx = Math.max(16, Math.min(TOTAL_WORLD_WIDTH - 16, nextWx));
      this.wy = Math.max(16, Math.min(TOTAL_WORLD_HEIGHT - 16, nextWy));

      this.updateCurrentPlot();

      // Walk cycle timer (4 frames: 0=idle, 1=left-step, 2=idle, 3=right-step)
      this.animTimer++;
      if (this.animTimer >= WALK_FRAME_INTERVAL) {
        this.animTimer = 0;
        this.frame = (this.frame + 1) % 4;
      }
    } else {
      if (this.state === 'walking') {
        this.state = 'idle';
        this.frame = 0;
        this.animTimer = 0;
      }

      this.idleTimer++;
      if (this.idleTimer >= IDLE_SLEEP_TIMEOUT) {
        this.state = 'sleeping';
        this.updateSleepParticles();
      }
    }
  }

  private updateSleepParticles(): void {
    // Spawn new particle occasionally
    if (Math.random() < 0.05 && this.sleepParticles.length < 5) {
      this.sleepParticles.push({
        x: this.wx + 8 + (Math.random() - 0.5) * 6,
        y: this.wy - 26,
        alpha: 0.9,
        scale: 0.7 + Math.random() * 0.5,
        seed: Math.random() * 10,
        age: 0,
      });
    }

    // Update existing particles
    for (let i = this.sleepParticles.length - 1; i >= 0; i--) {
      const p = this.sleepParticles[i];
      p.age++;
      p.y -= 0.45;
      p.x += Math.sin(p.age * 0.08 + p.seed) * 0.35;
      p.alpha -= 0.012;

      if (p.alpha <= 0 || p.age > 90) {
        this.sleepParticles.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Canvas2D Chibi Rendering
  // ---------------------------------------------------------------------------

  render(ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number): void {
    const z = zoom;
    const colors = {
      primary: this.avatar.colors.primary || '#38bdf8',
      secondary: this.avatar.colors.secondary || '#0f172a',
      accent: this.avatar.colors.accent || '#f59e0b',
      skin: this.avatar.colors.skin || '#fde047',
    };

    // 1. Soft ground shadow under feet
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 10 * z, 4.5 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (this.state === 'sleeping') {
      this.renderSleeping(ctx, sx, sy, z, colors);
    } else {
      this.renderChibi(ctx, sx, sy, z, colors);
    }

    // Floating Sleep 'Z' particles
    if (this.state === 'sleeping') {
      this.renderSleepParticles(ctx, sx, sy, z);
    }

    // "You" name tag above head
    this.renderNameBadge(ctx, sx, sy, z);
  }

  private renderChibi(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    z: number,
    c: { primary: string; secondary: string; accent: string; skin: string },
  ): void {
    const isSteppingLeft = this.state === 'walking' && this.frame === 1;
    const isSteppingRight = this.state === 'walking' && this.frame === 3;
    const headBob = (isSteppingLeft || isSteppingRight) ? -1.5 * z : 0;

    const dir = this.direction;

    // --- Feet / Shoes ---
    const footColor = c.accent || '#334155';
    ctx.fillStyle = footColor;

    if (dir === 'down' || dir === 'up') {
      const leftFootY = sy - 2 * z + (isSteppingLeft ? -2.5 * z : 0);
      const rightFootY = sy - 2 * z + (isSteppingRight ? -2.5 * z : 0);
      // Left foot
      ctx.fillRect(sx - 5.5 * z, leftFootY, 4 * z, 3 * z);
      // Right foot
      ctx.fillRect(sx + 1.5 * z, rightFootY, 4 * z, 3 * z);
    } else if (dir === 'left') {
      const footY = sy - 2 * z + (isSteppingLeft ? -2 * z : 0);
      ctx.fillRect(sx - 4 * z, footY, 6 * z, 3 * z);
    } else if (dir === 'right') {
      const footY = sy - 2 * z + (isSteppingRight ? -2 * z : 0);
      ctx.fillRect(sx - 2 * z, footY, 6 * z, 3 * z);
    }

    // --- Body / Shirt ---
    const bodyY = sy - 12 * z;
    ctx.fillStyle = c.primary;
    ctx.beginPath();
    ctx.roundRect(sx - 6 * z, bodyY, 12 * z, 10 * z, 3 * z);
    ctx.fill();

    // Belt / shirt accent line
    ctx.fillStyle = c.accent;
    ctx.fillRect(sx - 5 * z, sy - 4.5 * z, 10 * z, 1.5 * z);

    // Hands / Arms
    ctx.fillStyle = c.skin;
    if (dir === 'down' || dir === 'up') {
      ctx.fillRect(sx - 7.5 * z, bodyY + 3 * z, 2.2 * z, 4 * z);
      ctx.fillRect(sx + 5.3 * z, bodyY + 3 * z, 2.2 * z, 4 * z);
    } else if (dir === 'left') {
      ctx.fillRect(sx - 6.5 * z, bodyY + 3 * z, 3 * z, 4 * z);
    } else if (dir === 'right') {
      ctx.fillRect(sx + 3.5 * z, bodyY + 3 * z, 3 * z, 4 * z);
    }

    // --- Big Chibi Round Head ---
    const headCenterX = sx;
    const headCenterY = sy - 18 * z + headBob;
    const headRadius = 9 * z;

    // Face / Skin base
    ctx.fillStyle = c.skin;
    ctx.beginPath();
    ctx.arc(headCenterX, headCenterY, headRadius, 0, Math.PI * 2);
    ctx.fill();

    // Hair / Hood (secondary color)
    ctx.fillStyle = c.secondary;
    ctx.beginPath();
    if (dir === 'up') {
      // Full back hair
      ctx.arc(headCenterX, headCenterY, headRadius, 0, Math.PI * 2);
      ctx.fill();
    } else if (dir === 'down') {
      // Bangs / hair top
      ctx.arc(headCenterX, headCenterY - 1.5 * z, headRadius, Math.PI * 0.85, Math.PI * 2.15);
      ctx.lineTo(headCenterX + 7 * z, headCenterY - 2 * z);
      ctx.lineTo(headCenterX, headCenterY - 4 * z);
      ctx.lineTo(headCenterX - 7 * z, headCenterY - 2 * z);
      ctx.closePath();
      ctx.fill();
    } else if (dir === 'left') {
      // Side hair
      ctx.arc(headCenterX + 1.5 * z, headCenterY, headRadius, Math.PI * 0.6, Math.PI * 1.8);
      ctx.fill();
    } else if (dir === 'right') {
      // Side hair
      ctx.arc(headCenterX - 1.5 * z, headCenterY, headRadius, -Math.PI * 0.4, Math.PI * 0.8);
      ctx.fill();
    }

    // --- Face Details (Eyes & Cheeks) ---
    if (dir !== 'up') {
      // Cute blush
      ctx.fillStyle = 'rgba(244, 63, 94, 0.45)';
      if (dir === 'down') {
        ctx.beginPath();
        ctx.arc(headCenterX - 5 * z, headCenterY + 2.5 * z, 2 * z, 0, Math.PI * 2);
        ctx.arc(headCenterX + 5 * z, headCenterY + 2.5 * z, 2 * z, 0, Math.PI * 2);
        ctx.fill();
      } else if (dir === 'left') {
        ctx.beginPath();
        ctx.arc(headCenterX - 4 * z, headCenterY + 2.5 * z, 2 * z, 0, Math.PI * 2);
        ctx.fill();
      } else if (dir === 'right') {
        ctx.beginPath();
        ctx.arc(headCenterX + 4 * z, headCenterY + 2.5 * z, 2 * z, 0, Math.PI * 2);
        ctx.fill();
      }

      // Expressive chibi eyes
      ctx.fillStyle = '#0f172a';
      if (dir === 'down') {
        // Left eye
        ctx.fillRect(headCenterX - 4.5 * z, headCenterY - 1 * z, 2.2 * z, 3.5 * z);
        // Right eye
        ctx.fillRect(headCenterX + 2.3 * z, headCenterY - 1 * z, 2.2 * z, 3.5 * z);

        // Eye glint
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(headCenterX - 4.5 * z, headCenterY - 1 * z, 1.2 * z, 1.2 * z);
        ctx.fillRect(headCenterX + 2.3 * z, headCenterY - 1 * z, 1.2 * z, 1.2 * z);
      } else if (dir === 'left') {
        ctx.fillRect(headCenterX - 6 * z, headCenterY - 1 * z, 2.2 * z, 3.5 * z);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(headCenterX - 6 * z, headCenterY - 1 * z, 1.2 * z, 1.2 * z);
      } else if (dir === 'right') {
        ctx.fillRect(headCenterX + 3.8 * z, headCenterY - 1 * z, 2.2 * z, 3.5 * z);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(headCenterX + 3.8 * z, headCenterY - 1 * z, 1.2 * z, 1.2 * z);
      }
    }
  }

  private renderSleeping(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    z: number,
    c: { primary: string; secondary: string; accent: string; skin: string },
  ): void {
    // Cozy sitting / sleeping pose with blanket
    const bodyY = sy - 8 * z;

    // Blanket / cozy pillow
    ctx.fillStyle = c.accent || '#f59e0b';
    ctx.beginPath();
    ctx.roundRect(sx - 10 * z, bodyY - 2 * z, 20 * z, 10 * z, 4 * z);
    ctx.fill();

    // Sleeping tilted head
    const headX = sx - 3 * z;
    const headY = bodyY - 8 * z;
    ctx.fillStyle = c.skin;
    ctx.beginPath();
    ctx.arc(headX, headY, 7.5 * z, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = c.secondary;
    ctx.beginPath();
    ctx.arc(headX, headY - 1.5 * z, 7.5 * z, Math.PI * 0.8, Math.PI * 2.2);
    ctx.fill();

    // Closed relaxed sleeping eye lines (^ ^)
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.4 * z;
    ctx.beginPath();
    ctx.moveTo(headX - 4 * z, headY);
    ctx.lineTo(headX - 2 * z, headY - 1.5 * z);
    ctx.lineTo(headX, headY);
    ctx.stroke();
  }

  private renderSleepParticles(ctx: CanvasRenderingContext2D, sx: number, sy: number, z: number): void {
    ctx.save();
    ctx.fillStyle = '#38bdf8';
    ctx.font = `bold ${Math.round(11 * z)}px 'Outfit', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const p of this.sleepParticles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
      ctx.fillText('z', sx + (p.x - this.wx) * z, sy + (p.y - this.wy) * z);
    }
    ctx.restore();
  }

  private renderNameBadge(ctx: CanvasRenderingContext2D, sx: number, sy: number, z: number): void {
    const badgeY = sy - 31 * z;
    const text = this.displayName;
    const fontSize = Math.max(9, Math.round(10 * z));

    ctx.font = `bold ${fontSize}px 'Outfit', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textW = ctx.measureText(text).width;
    const padX = 6 * z;
    const padY = 3 * z;
    const badgeW = textW + padX * 2;
    const badgeH = fontSize + padY * 2;

    // Glowing amber pill for player
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(sx - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 6 * z);
    ctx.fill();

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.fillText(text, sx, badgeY);
  }
}
