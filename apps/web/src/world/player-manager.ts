/**
 * PlayerManager — WASD / Arrow key controlled chibi citizen in Spot World (Stardew Valley / RPG style).
 *
 * Visual & Gameplay features:
 * - 4-direction movement (down, up, left, right)
 * - 4-frame walk animation with head bob and foot steps
 * - Archetype accessories (astronaut helmet, hacker cyber visor, wizard hat, golden crown)
 * - Sleep mode after 3 seconds of idle (snooze pose + floating 'z' particles)
 * - "You" name badge with glowing amber accent
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

const MOVE_SPEED = 2.6; // smooth continuous speed
const WALK_FRAME_INTERVAL = 7;
const IDLE_SLEEP_TIMEOUT = 180; // 3 seconds

interface SleepParticle {
  x: number;
  y: number;
  alpha: number;
  scale: number;
  seed: number;
  age: number;
}

export class PlayerManager {
  wx: number = 50 * TILE_WIDTH + TILE_WIDTH / 2;
  wy: number = 50 * TILE_HEIGHT + TILE_HEIGHT / 2;

  gx: number = 50;
  gy: number = 50;

  state: PlayerState = 'idle';
  direction: Direction = 'down';
  frame = 0;
  private animTimer = 0;
  private idleTimer = 0;
  private tick = 0;

  avatar: AvatarDefinition;
  avatarId: string;
  displayName: string = 'You';
  isFounder: boolean = false;
  isVerified: boolean = false;

  chatBubble: { text: string; age: number; maxAge: number } | null = null;

  say(text: string, duration = 300): void {
    if (!text || !text.trim()) return;
    this.chatBubble = {
      text: text.trim(),
      age: 0,
      maxAge: duration,
    };
    this.resetIdle();
  }

  private plotManager: PlotManager | null = null;
  currentPlot: Plot | null = null;
  private onPlotChange?: (plot: Plot) => void;

  private sleepParticles: SleepParticle[] = [];
  private keys = new Set<string>();

  constructor(
    avatarId: string,
    plotManager?: PlotManager,
    onPlotChange?: (plot: Plot) => void,
  ) {
    this.avatarId = avatarId;
    this.avatar = AVATAR_CATALOG[avatarId] ?? AVATAR_CATALOG.astronaut;
    this.plotManager = plotManager ?? null;
    this.onPlotChange = onPlotChange;
  }

  setAvatar(avatarId: string): void {
    this.avatarId = avatarId;
    this.avatar = AVATAR_CATALOG[avatarId] ?? AVATAR_CATALOG.astronaut;
  }

  setPlotManager(pm: PlotManager): void {
    this.plotManager = pm;
    this.updateCurrentPlot();
  }

  setPosition(gx: number, gy: number): void {
    this.gx = gx;
    this.gy = gy;
    const center = gridToWorldCenter(gx, gy);
    this.wx = center.wx;
    this.wy = center.wy;
    this.updateCurrentPlot();
  }

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

  onInteract?: () => void;

  bindInput(): void {
    window.addEventListener('keydown', (e) => {
      // Don't capture keys if typing in an input/textarea
      if (['input', 'textarea', 'select'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) {
        return;
      }

      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        this.keys.add(k);
        this.resetIdle();
      } else if (k === 'e' || k === ' ' || k === 'enter') {
        this.resetIdle();
        this.onInteract?.();
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

  targetDestination: { wx: number; wy: number } | null = null;

  walkTo(wx: number, wy: number): void {
    this.targetDestination = {
      wx: Math.max(16, Math.min(TOTAL_WORLD_WIDTH - 16, wx)),
      wy: Math.max(16, Math.min(TOTAL_WORLD_HEIGHT - 16, wy)),
    };
    this.resetIdle();
  }

  update(): void {
    this.tick++;
    this.updateChatBubble();
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

    // Keyboard overrides tap destination
    if (dx !== 0 || dy !== 0) {
      this.targetDestination = null;
    } else if (this.targetDestination) {
      const distX = this.targetDestination.wx - this.wx;
      const distY = this.targetDestination.wy - this.wy;
      const dist = Math.hypot(distX, distY);

      if (dist < 4) {
        this.targetDestination = null;
        dx = 0;
        dy = 0;
      } else {
        dx = distX / dist;
        dy = distY / dist;
      }
    }

    if (dx !== 0 || dy !== 0) {
      this.state = 'walking';
      this.idleTimer = 0;

      if (Math.abs(dy) >= Math.abs(dx)) {
        this.direction = dy > 0 ? 'down' : 'up';
      } else {
        this.direction = dx > 0 ? 'right' : 'left';
      }

      const len = Math.hypot(dx, dy);
      const moveX = (dx / len) * MOVE_SPEED;
      const moveY = (dy / len) * MOVE_SPEED;

      this.wx = Math.max(16, Math.min(TOTAL_WORLD_WIDTH - 16, this.wx + moveX));
      this.wy = Math.max(16, Math.min(TOTAL_WORLD_HEIGHT - 16, this.wy + moveY));

      this.updateCurrentPlot();

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

  render(ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number): void {
    const z = zoom;
    const colors = {
      primary: this.avatar.colors.primary || '#38bdf8',
      secondary: this.avatar.colors.secondary || '#0f172a',
      accent: this.avatar.colors.accent || '#f59e0b',
      skin: this.avatar.colors.skin || '#fde047',
    };

    // 1. Soft ground shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 10 * z, 4.5 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (this.state === 'sleeping') {
      this.renderSleeping(ctx, sx, sy, z, colors);
      this.renderSleepParticles(ctx, sx, sy, z);
    } else {
      this.renderChibi(ctx, sx, sy, z, colors);
    }

    this.renderNameBadge(ctx, sx, sy, z);

    // Chat / Emote speech bubble
    if (this.chatBubble) {
      this.renderChatBubble(ctx, sx, sy - 38 * z, z);
    }
  }

  private updateChatBubble(): void {
    if (!this.chatBubble) return;
    this.chatBubble.age++;
    if (this.chatBubble.age >= this.chatBubble.maxAge) {
      this.chatBubble = null;
    }
  }

  private renderChatBubble(ctx: CanvasRenderingContext2D, bx: number, by: number, z: number): void {
    if (!this.chatBubble) return;
    const { text, age, maxAge } = this.chatBubble;
    const alpha = age > maxAge - 30 ? (maxAge - age) / 30 : 1;

    const fontSize = Math.max(9, Math.round(10 * z));
    ctx.font = `600 ${fontSize}px 'Outfit', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textW = ctx.measureText(text).width;
    const padX = 8 * z;
    const padY = 5 * z;
    const bubbleW = Math.max(28 * z, textW + padX * 2);
    const bubbleH = fontSize + padY * 2;

    const floatY = by - Math.min(4 * z, (age / 30) * 4 * z);

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);

    // Speech bubble pill
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.beginPath();
    ctx.roundRect(bx - bubbleW / 2, floatY - bubbleH / 2, bubbleW, bubbleH, 7 * z);
    ctx.fill();

    ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Bubble pointer
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.beginPath();
    ctx.moveTo(bx - 3 * z, floatY + bubbleH / 2);
    ctx.lineTo(bx, floatY + bubbleH / 2 + 4 * z);
    ctx.lineTo(bx + 3 * z, floatY + bubbleH / 2);
    ctx.fill();

    // Text
    ctx.fillStyle = '#0f172a';
    ctx.fillText(text, bx, floatY);
    ctx.restore();
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
    const breathe = this.state === 'idle' ? Math.sin(this.tick * 0.08) * 0.7 * z : 0;
    const headBob = (isSteppingLeft || isSteppingRight) ? -1.5 * z : breathe;

    const dir = this.direction;

    // --- Feet ---
    ctx.fillStyle = c.accent || '#334155';
    if (dir === 'down' || dir === 'up') {
      const leftFootY = sy - 2 * z + (isSteppingLeft ? -2.5 * z : 0);
      const rightFootY = sy - 2 * z + (isSteppingRight ? -2.5 * z : 0);
      ctx.fillRect(sx - 5.5 * z, leftFootY, 4 * z, 3 * z);
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

    // Belt accent
    ctx.fillStyle = c.accent;
    ctx.fillRect(sx - 5 * z, sy - 4.5 * z, 10 * z, 1.5 * z);

    // Hands
    ctx.fillStyle = c.skin;
    if (dir === 'down' || dir === 'up') {
      ctx.fillRect(sx - 7.5 * z, bodyY + 3 * z, 2.2 * z, 4 * z);
      ctx.fillRect(sx + 5.3 * z, bodyY + 3 * z, 2.2 * z, 4 * z);
    } else if (dir === 'left') {
      ctx.fillRect(sx - 6.5 * z, bodyY + 3 * z, 3 * z, 4 * z);
    } else if (dir === 'right') {
      ctx.fillRect(sx + 3.5 * z, bodyY + 3 * z, 3 * z, 4 * z);
    }

    // --- Round Chibi Head ---
    const headX = sx;
    const headY = sy - 18 * z + headBob;
    const headRadius = 9 * z;

    // Skin
    ctx.fillStyle = c.skin;
    ctx.beginPath();
    ctx.arc(headX, headY, headRadius, 0, Math.PI * 2);
    ctx.fill();

    // Hair / Hood
    ctx.fillStyle = c.secondary;
    ctx.beginPath();
    if (dir === 'up') {
      ctx.arc(headX, headY, headRadius, 0, Math.PI * 2);
      ctx.fill();
    } else if (dir === 'down') {
      ctx.arc(headX, headY - 1.5 * z, headRadius, Math.PI * 0.85, Math.PI * 2.15);
      ctx.lineTo(headCenterX(sx), headY - 4 * z);
      ctx.closePath();
      ctx.fill();
    } else if (dir === 'left') {
      ctx.arc(headX + 1.5 * z, headY, headRadius, Math.PI * 0.6, Math.PI * 1.8);
      ctx.fill();
    } else if (dir === 'right') {
      ctx.arc(headX - 1.5 * z, headY, headRadius, -Math.PI * 0.4, Math.PI * 0.8);
      ctx.fill();
    }

    // Archetype Headgear
    this.renderPlayerHeadgear(ctx, headX, headY, z, dir, c);

    // --- Face Details ---
    if (dir !== 'up') {
      ctx.fillStyle = 'rgba(244, 63, 94, 0.45)';
      ctx.beginPath();
      if (dir === 'down') {
        ctx.arc(headX - 5 * z, headY + 2.5 * z, 2 * z, 0, Math.PI * 2);
        ctx.arc(headCenterX(sx) + 5 * z, headY + 2.5 * z, 2 * z, 0, Math.PI * 2);
      } else if (dir === 'left') {
        ctx.arc(headX - 4 * z, headY + 2.5 * z, 2 * z, 0, Math.PI * 2);
      } else if (dir === 'right') {
        ctx.arc(headX + 4 * z, headY + 2.5 * z, 2 * z, 0, Math.PI * 2);
      }
      ctx.fill();

      // Eyes
      if (this.avatarId !== 'hacker') {
        ctx.fillStyle = '#0f172a';
        if (dir === 'down') {
          ctx.fillRect(headX - 4.5 * z, headY - 1 * z, 2.2 * z, 3.5 * z);
          ctx.fillRect(headX + 2.3 * z, headY - 1 * z, 2.2 * z, 3.5 * z);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(headX - 4.5 * z, headY - 1 * z, 1.2 * z, 1.2 * z);
          ctx.fillRect(headX + 2.3 * z, headY - 1 * z, 1.2 * z, 1.2 * z);
        } else if (dir === 'left') {
          ctx.fillRect(headX - 6 * z, headY - 1 * z, 2.2 * z, 3.5 * z);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(headX - 6 * z, headY - 1 * z, 1.2 * z, 1.2 * z);
        } else if (dir === 'right') {
          ctx.fillRect(headX + 3.8 * z, headY - 1 * z, 2.2 * z, 3.5 * z);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(headX + 3.8 * z, headY - 1 * z, 1.2 * z, 1.2 * z);
        }
      }
    }
  }

  private renderPlayerHeadgear(
    ctx: CanvasRenderingContext2D,
    hx: number,
    hy: number,
    z: number,
    dir: string,
    c: { primary: string; secondary: string; accent: string; skin: string },
  ): void {
    if (this.avatarId === 'astronaut' && dir !== 'up') {
      ctx.fillStyle = 'rgba(2, 132, 199, 0.8)';
      ctx.beginPath();
      ctx.roundRect(hx - 6 * z, hy - 2.5 * z, 12 * z, 5.5 * z, 2.5 * z);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.fillRect(hx - 4.5 * z, hy - 2 * z, 3.5 * z, 1.5 * z);
    } else if (this.avatarId === 'hacker') {
      if (dir !== 'up') {
        ctx.fillStyle = '#10b981';
        ctx.fillRect(hx - 6 * z, hy - 1 * z, 12 * z, 2.5 * z);
        ctx.fillStyle = '#34d399';
        ctx.fillRect(hx - 2 * z, hy - 1 * z, 4 * z, 2.5 * z);
      }
      ctx.fillStyle = c.secondary;
      ctx.beginPath();
      ctx.moveTo(hx - 7 * z, hy - 7 * z);
      ctx.lineTo(hx - 9 * z, hy - 12 * z);
      ctx.lineTo(hx - 4 * z, hy - 8 * z);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(hx + 7 * z, hy - 7 * z);
      ctx.lineTo(hx + 9 * z, hy - 12 * z);
      ctx.lineTo(hx + 4 * z, hy - 8 * z);
      ctx.fill();
    }
  }

  private renderSleeping(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    z: number,
    c: { primary: string; secondary: string; accent: string; skin: string },
  ): void {
    const bodyY = sy - 8 * z;

    ctx.fillStyle = c.accent || '#f59e0b';
    ctx.beginPath();
    ctx.roundRect(sx - 10 * z, bodyY - 2 * z, 20 * z, 10 * z, 4 * z);
    ctx.fill();

    const headX = sx - 3 * z;
    const headY = bodyY - 8 * z;
    ctx.fillStyle = c.skin;
    ctx.beginPath();
    ctx.arc(headX, headY, 7.5 * z, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = c.secondary;
    ctx.beginPath();
    ctx.arc(headX, headY - 1.5 * z, 7.5 * z, Math.PI * 0.8, Math.PI * 2.2);
    ctx.fill();

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

    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.beginPath();
    ctx.roundRect(sx - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 6 * z);
    ctx.fill();

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.fillText(text, sx, badgeY);
  }
}

function headCenterX(sx: number): number {
  return sx;
}
