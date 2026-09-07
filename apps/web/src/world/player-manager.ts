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
import { isWaterTile } from './terrain-generator.js';

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

export type Direction = 'down' | 'up' | 'left' | 'right';
export type PlayerState = 'idle' | 'walking' | 'sleeping';

export const MIN_WALKABLE_WY = 0.5 * TILE_HEIGHT; // Keep inside city — no mountains/railway
export const MAX_WALKABLE_WY = 93.5 * TILE_HEIGHT; // Dry sand only — blocks surf (96) & deep ocean, stays on beach
export const MIN_WALKABLE_WX = 0.5 * TILE_WIDTH; // Block western jungle
export const MAX_WALKABLE_WX = TOTAL_WORLD_WIDTH - 0.5 * TILE_WIDTH; // Block eastern forest — stay inside 0..99

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
  speedMultiplier = 1.0;
  speedTrail: { wx: number; wy: number; alpha: number }[] = [];
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
    // snap water/jungle or gy>=94 to nearest dry city tile
    let sgx = gx, sgy = gy;
    if (sgx < 0 || sgx >= 100 || isWaterTile(sgx, sgy) || sgy >= 94) {
      for (let r = 0; r < 12; r++) {
        const ny = sgy - 1 - r;
        if (ny < 0 || ny >= 94) continue;
        const nx = Math.max(0, Math.min(99, sgx));
        if (!isWaterTile(nx, ny)) { sgx = nx; sgy = ny; break; }
      }
      if (sgx < 0 || sgx >= 100 || isWaterTile(sgx, sgy) || sgy >= 94) {
        sgx = 50; sgy = 50;
      }
    }
    this.gx = sgx;
    this.gy = sgy;
    const center = gridToWorldCenter(sgx, sgy);
    this.wx = Math.max(MIN_WALKABLE_WX, Math.min(MAX_WALKABLE_WX, center.wx));
    this.wy = Math.max(MIN_WALKABLE_WY, Math.min(MAX_WALKABLE_WY, center.wy));
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
    if (!grid) {
      this.gx = Math.floor(this.wx / TILE_WIDTH);
      this.gy = Math.floor(this.wy / TILE_HEIGHT);
      if (this.currentPlot) {
        this.currentPlot = null;
      }
      return;
    }
    this.gx = grid.gx;
    this.gy = grid.gy;

    const plot = this.plotManager.getPlotAt(grid.gx, grid.gy);
    if (plot && plot !== this.currentPlot) {
      this.currentPlot = plot;
      this.onPlotChange?.(plot);
    } else if (!plot && this.currentPlot) {
      this.currentPlot = null;
    }
  }

  onInteract?: () => void;
  onStep?: () => void;

  isInputBlocked(): boolean {
    if (typeof document === 'undefined') return false;

    // 1. Don't capture keys if typing in an input, textarea, select, or editable element
    const active = document.activeElement as HTMLElement | null;
    if (active && (['input', 'textarea', 'select'].includes(active.tagName.toLowerCase()) || active.isContentEditable)) {
      return true;
    }

    // 2. Don't capture keys if any modal backdrop or dialog is actively open
    const openModal = document.querySelector(
      '.modal-backdrop.open, .modal-backdrop.is-open, .library-modal-backdrop.is-open, .library-modal-backdrop.open, .search-backdrop.open, .arcade-modal-backdrop.open, .share-modal-backdrop.open, .about-modal-backdrop.open'
    );
    if (openModal) {
      return true;
    }

    return false;
  }

  clearMovement(): void {
    this.keys.clear();
    this.targetDestination = null;
    if (this.state === 'walking') {
      this.state = 'idle';
      this.frame = 0;
      this.animTimer = 0;
    }
  }

  bindInput(): void {
    window.addEventListener('keydown', (e) => {
      // Don't capture keys if an input is active or any modal is open
      if (this.isInputBlocked()) {
        this.clearMovement();
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
      this.clearMovement();
    });

    // Clear movement whenever a modal opens
    window.addEventListener('spot:modal-opened', () => {
      this.clearMovement();
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
    if (this.isInputBlocked()) return;
    const clampedWx = Math.max(MIN_WALKABLE_WX, Math.min(MAX_WALKABLE_WX, wx));
    const clampedWy = Math.max(MIN_WALKABLE_WY, Math.min(MAX_WALKABLE_WY, wy));
    const gx = Math.floor(clampedWx / TILE_WIDTH);
    const gy = Math.floor(clampedWy / TILE_HEIGHT);
    // Hard block water / jungle clicks — don't even set a target
    if (isWaterTile(gx, gy)) return;
    if (gx < 0 || gx >= 100) return;
    if (gy < 0 || gy >= 94) {
      // gy 94+ is surf onward — only allow up to dry beach
      if (gy >= 94) return;
    }
    this.targetDestination = { wx: clampedWx, wy: clampedWy };
    this.resetIdle();
  }

  update(): void {
    this.tick++;
    this.updateChatBubble();
    this.updateSpeedTrail();

    // Rescue: if somehow in water/jungle (old save, teleport), nudge north to dry city
    if (this.gx < 0 || this.gx >= 100 || isWaterTile(this.gx, this.gy) || this.gy >= 94) {
      for (let r = 0; r < 8; r++) {
        const ny = this.gy - 1 - r;
        if (ny < 0) break;
        if (ny >= 94) continue;
        if (this.gx < 0 || this.gx >= 100) {
          // snap x inside city
          const safeGx = Math.max(0, Math.min(99, this.gx));
          if (!isWaterTile(safeGx, ny)) {
            this.wx = safeGx * TILE_WIDTH + TILE_WIDTH / 2;
            this.wy = ny * TILE_HEIGHT + TILE_HEIGHT / 2;
            this.gx = safeGx;
            this.gy = ny;
            break;
          }
        } else if (!isWaterTile(this.gx, ny)) {
          this.wy = ny * TILE_HEIGHT + TILE_HEIGHT / 2;
          this.gy = ny;
          break;
        }
      }
    }

    // If modal opened or input focused while moving, freeze player in place immediately
    if (this.isInputBlocked()) {
      if (this.keys.size > 0 || this.targetDestination) {
        this.clearMovement();
      }
    }

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

      const isSprint = this.keys.has('shift');
      const baseSpeed = isSprint ? 5.6 : 3.8;
      const speed = baseSpeed * this.speedMultiplier;
      const len = Math.hypot(dx, dy);
      const moveX = (dx / len) * speed;
      const moveY = (dy / len) * speed;

      const candWx = Math.max(MIN_WALKABLE_WX, Math.min(MAX_WALKABLE_WX, this.wx + moveX));
      const candWy = Math.max(MIN_WALKABLE_WY, Math.min(MAX_WALKABLE_WY, this.wy + moveY));

      const candGx = Math.floor(candWx / TILE_WIDTH);
      const candGy = Math.floor(candWy / TILE_HEIGHT);

      const isJungle = candGx < 0 || candGx >= 100;
      const isWater = isWaterTile(candGx, candGy);

      if (isJungle || isWater) {
        // Sliding collision: allow movement along unobstructed axis only if that axis stays in city dry land
        const xGx = Math.floor(candWx / TILE_WIDTH);
        const xGy = Math.floor(this.wy / TILE_HEIGHT);
        const yGx = Math.floor(this.wx / TILE_WIDTH);
        const yGy = Math.floor(candWy / TILE_HEIGHT);
        const canMoveX = !(xGx < 0 || xGx >= 100) && !isWaterTile(xGx, xGy);
        const canMoveY = !(yGx < 0 || yGx >= 100) && !isWaterTile(yGx, yGy);

        if (canMoveX) this.wx = candWx;
        if (canMoveY) this.wy = candWy;
      } else {
        this.wx = candWx;
        this.wy = candWy;
      }

      if (this.speedMultiplier > 1.0 && this.tick % 3 === 0) {
        this.speedTrail.push({ wx: this.wx, wy: this.wy, alpha: 0.65 });
      }

      this.updateCurrentPlot();

      this.animTimer++;
      if (this.animTimer >= (isSprint ? 5 : WALK_FRAME_INTERVAL)) {
        this.animTimer = 0;
        this.frame = (this.frame + 1) % 4;
        if (this.frame === 1 || this.frame === 3) {
          this.onStep?.();
        }
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

  private updateSpeedTrail(): void {
    for (let i = this.speedTrail.length - 1; i >= 0; i--) {
      this.speedTrail[i].alpha -= 0.05;
      if (this.speedTrail[i].alpha <= 0) {
        this.speedTrail.splice(i, 1);
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

    // Speed boost cyan motion trails
    if (this.speedTrail.length > 0) {
      ctx.save();
      for (const t of this.speedTrail) {
        const dx = (t.wx - this.wx) * z;
        const dy = (t.wy - this.wy) * z;
        ctx.fillStyle = `rgba(0, 240, 255, ${t.alpha * 0.45})`;
        ctx.beginPath();
        ctx.ellipse(sx + dx, sy + dy, 7 * z, 3 * z, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

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
    const bodyY = sy - 12 * z;
    const headX = sx;
    const headY = sy - 18 * z + headBob;
    const headRadius = 9 * z;

    // --- Back Gear (Facing Up) ---
    if (dir === 'up') {
      this.renderBackGear(ctx, sx, bodyY, headY, z, c);
    }

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
    ctx.fillStyle = c.primary;
    ctx.beginPath();
    ctx.roundRect(sx - 6 * z, bodyY, 12 * z, 10 * z, 3 * z);
    ctx.fill();

    // Belt accent
    ctx.fillStyle = c.accent;
    ctx.fillRect(sx - 5 * z, sy - 4.5 * z, 10 * z, 1.5 * z);

    // Dynamic Arm Stride Swing
    const armSwing = (this.state === 'walking' && (dir === 'left' || dir === 'right'))
      ? Math.sin(this.animTimer * 0.3) * 3 * z
      : 0;

    // Hands
    ctx.fillStyle = c.skin;
    if (dir === 'down' || dir === 'up') {
      ctx.fillRect(sx - 7.5 * z, bodyY + 3 * z, 2.2 * z, 4 * z);
      ctx.fillRect(sx + 5.3 * z, bodyY + 3 * z, 2.2 * z, 4 * z);
    } else if (dir === 'left') {
      ctx.fillRect(sx - 6.5 * z - armSwing, bodyY + 3 * z, 3 * z, 4 * z);
    } else if (dir === 'right') {
      ctx.fillRect(sx + 3.5 * z + armSwing, bodyY + 3 * z, 3 * z, 4 * z);
    }

    // Front Held Gear (Facing Down)
    if (dir === 'down') {
      this.renderFrontGear(ctx, sx, bodyY, z, c);
    }

    // --- Round Chibi Head ---
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
      ctx.lineTo(headX, headY - 4 * z);
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

    // Profile Accessories (Headphones, Visor Monocles)
    if (dir === 'left' || dir === 'right') {
      this.renderProfileGear(ctx, headX, headY, z, dir, c);
    }

    // --- Face Details ---
    if (dir !== 'up') {
      ctx.fillStyle = 'rgba(244, 63, 94, 0.45)';
      ctx.beginPath();
      if (dir === 'down') {
        ctx.arc(headX - 5 * z, headY + 2.5 * z, 2 * z, 0, Math.PI * 2);
        ctx.arc(headX + 5 * z, headY + 2.5 * z, 2 * z, 0, Math.PI * 2);
      } else if (dir === 'left') {
        ctx.arc(headX - 4 * z, headY + 2.5 * z, 2 * z, 0, Math.PI * 2);
      } else if (dir === 'right') {
        ctx.arc(headX + 4 * z, headY + 2.5 * z, 2 * z, 0, Math.PI * 2);
      }
      ctx.fill();

      // Eyes
      if (this.avatarId !== 'hacker' && this.avatarId !== 'cyber_sysadmin') {
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

    // Procedural Idle Gestures (Standing still > 5s)
    if (this.state === 'idle' && this.idleTimer >= 240) {
      this.renderIdleGesture(ctx, sx, headY, z, c);
    }
  }

  private renderBackGear(
    ctx: CanvasRenderingContext2D,
    sx: number,
    bodyY: number,
    headY: number,
    z: number,
    c: { primary: string; secondary: string; accent: string; skin: string },
  ): void {
    if (this.avatarId === 'astronaut') {
      // Oxygen Thruster Tanks
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.roundRect(sx - 5.5 * z, bodyY + 1 * z, 4 * z, 8 * z, 1.5 * z);
      ctx.roundRect(sx + 1.5 * z, bodyY + 1 * z, 4 * z, 8 * z, 1.5 * z);
      ctx.fill();

      // Thruster Valves
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(sx - 4.5 * z, bodyY + 0.2 * z, 2 * z, 1.2 * z);
      ctx.fillRect(sx + 2.5 * z, bodyY + 0.2 * z, 2 * z, 1.2 * z);
    } else if (this.avatarId === 'cyber_samurai' || this.avatarId === 'neon_ninja') {
      // Diagonal Katana Scabbard
      ctx.save();
      ctx.translate(sx, bodyY + 5 * z);
      ctx.rotate(-Math.PI / 4.5);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-1.5 * z, -8 * z, 3 * z, 16 * z);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-2 * z, -9 * z, 4 * z, 2 * z); // Guard
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-1.2 * z, -12 * z, 2.4 * z, 3 * z); // Hilt
      ctx.restore();
    } else if (this.avatarId === 'indie_hacker' || this.avatarId === 'hacker') {
      // Padded Canvas Backpack with Cyber Sticker
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(sx - 5 * z, bodyY + 1.5 * z, 10 * z, 8 * z, 2.5 * z);
      ctx.fill();
      // Cyan Laptop/Matrix Sticker
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(sx - 1.5 * z, bodyY + 4 * z, 3 * z, 3 * z);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(sx + 0.5 * z, bodyY + 5 * z, 1 * z, 1 * z);
    } else if (this.avatarId === 'cyber_sysadmin') {
      // High-Tech Server Rig & Keycard Belt
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(sx - 5 * z, bodyY + 2 * z, 10 * z, 7 * z);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(sx - 3.5 * z, bodyY + 3.5 * z, 7 * z, 1.2 * z);
      ctx.fillStyle = '#34d399';
      ctx.fillRect(sx + 1.5 * z, bodyY + 5.5 * z, 2 * z, 1.5 * z); // Blinking LED
    } else if (this.avatarId === 'ai_architect') {
      // Orbiting Syntax Halo Runes
      const haloTime = this.tick * 0.06;
      ctx.fillStyle = '#c084fc';
      for (let i = 0; i < 3; i++) {
        const angle = haloTime + (i * Math.PI * 2) / 3;
        const rx = sx + Math.cos(angle) * 11 * z;
        const ry = headY - 3 * z + Math.sin(angle) * 4 * z;
        ctx.fillRect(rx - 1.2 * z, ry - 1.2 * z, 2.4 * z, 2.4 * z);
      }
    } else if (this.avatarId === 'pixel_knight' || this.avatarId === 'golden_knight') {
      // Chivalric Heraldic Cape
      ctx.fillStyle = c.secondary;
      ctx.beginPath();
      ctx.moveTo(sx - 5 * z, bodyY + 1 * z);
      ctx.lineTo(sx + 5 * z, bodyY + 1 * z);
      ctx.lineTo(sx + 6.5 * z, bodyY + 11 * z);
      ctx.lineTo(sx - 6.5 * z, bodyY + 11 * z);
      ctx.closePath();
      ctx.fill();
    }
  }

  private renderProfileGear(
    ctx: CanvasRenderingContext2D,
    hx: number,
    hy: number,
    z: number,
    dir: string,
    c: { primary: string; secondary: string; accent: string; skin: string },
  ): void {
    const isLeft = dir === 'left';
    const earX = isLeft ? hx - 0.5 * z : hx + 0.5 * z;

    if (this.avatarId === 'indie_hacker' || this.avatarId === 'hacker') {
      // Over-Ear Side Headphone Cup
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(earX - 2.5 * z, hy - 1.5 * z, 5 * z, 6 * z, 2 * z);
      ctx.fill();
      // Pulsing Audio LED
      ctx.fillStyle = this.avatarId === 'hacker' ? '#10b981' : '#38bdf8';
      ctx.fillRect(earX - 1 * z, hy + 0.5 * z, 2 * z, 2 * z);
    } else if (this.avatarId === 'cyber_sysadmin') {
      // Tactical Cyber Monocle / Side Visor
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(isLeft ? hx - 5.5 * z : hx + 5.5 * z, hy - 0.5 * z, 2.8 * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(isLeft ? hx - 6.2 * z : hx + 4.8 * z, hy - 1 * z, 1.4 * z, 1.4 * z);
    } else if (this.avatarId === 'astronaut') {
      // Communicator Antenna & Helmet Rim
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.2 * z;
      ctx.beginPath();
      ctx.moveTo(earX, hy);
      ctx.lineTo(isLeft ? earX + 3 * z : earX - 3 * z, hy - 8 * z);
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(isLeft ? earX + 2.5 * z : earX - 3.5 * z, hy - 9 * z, 1.8 * z, 1.8 * z);
    }
  }

  private renderFrontGear(
    ctx: CanvasRenderingContext2D,
    sx: number,
    bodyY: number,
    z: number,
    c: { primary: string; secondary: string; accent: string; skin: string },
  ): void {
    if (this.avatarId === 'indie_hacker') {
      // Glowing Open Laptop / Code Pad
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(sx - 4.5 * z, bodyY + 3.5 * z, 9 * z, 5.5 * z);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(sx - 3.5 * z, bodyY + 4.2 * z, 7 * z, 4 * z); // Glowing Screen
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - 2.5 * z, bodyY + 5 * z, 3 * z, 0.8 * z); // Code line
      ctx.fillRect(sx - 2.5 * z, bodyY + 6.2 * z, 4.5 * z, 0.8 * z);
    } else if (this.avatarId === 'cyber_sysadmin') {
      // Server Keycard Lanyard
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(sx - 2 * z, bodyY + 4 * z, 4 * z, 5 * z);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(sx - 1 * z, bodyY + 5.5 * z, 2 * z, 2 * z);
    } else if (this.avatarId === 'ai_architect') {
      // Neural Core Pendant
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.arc(sx, bodyY + 5 * z, 2 * z, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.avatarId === 'bot_9000') {
      // Glowing Chassis Core
      ctx.fillStyle = Math.sin(this.tick * 0.15) > 0 ? '#38bdf8' : '#ef4444';
      ctx.fillRect(sx - 2.5 * z, bodyY + 4 * z, 5 * z, 3 * z);
    }
  }

  private renderIdleGesture(
    ctx: CanvasRenderingContext2D,
    sx: number,
    headY: number,
    z: number,
    c: { primary: string; secondary: string; accent: string; skin: string },
  ): void {
    const cycle = this.idleTimer % 360;
    if (cycle > 140) return; // Active for ~2.3 seconds

    if (this.avatarId === 'indie_hacker' || this.avatarId === 'hacker' || this.avatarId === 'cyber_sysadmin') {
      // Holographic Wrist Terminal
      const holoX = sx + 8 * z;
      const holoY = headY - 2 * z;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(holoX, holoY - 6 * z, 13 * z, 10 * z, 2 * z);
      ctx.fill();
      ctx.stroke();

      // Scanning data lines
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(holoX + 1.5 * z, holoY - 4.5 * z, 8 * z, 1 * z);
      ctx.fillRect(holoX + 1.5 * z, holoY - 2.5 * z, 6 * z, 1 * z);
      ctx.fillRect(holoX + 1.5 * z, holoY - 0.5 * z, 9 * z, 1 * z);

      // Sweep line
      const sweepY = holoY - 6 * z + ((cycle * 0.4) % (10 * z));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(holoX, sweepY, 13 * z, 0.8 * z);
    } else if (this.avatarId === 'cyber_samurai' || this.avatarId === 'neon_ninja') {
      // Katana Blade Glint Sparkle
      const glintProgress = (cycle / 140) * Math.PI;
      const scale = Math.sin(glintProgress);
      if (scale > 0.1) {
        ctx.save();
        ctx.translate(sx - 5 * z, headY + 1 * z);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        const r = 4 * z * scale;
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.3, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r * 0.3, 0);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-r, 0);
        ctx.lineTo(0, r * 0.3);
        ctx.lineTo(r, 0);
        ctx.lineTo(0, -r * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    } else {
      // Steaming Coffee Cup Sip
      const cupX = sx + 7 * z;
      const cupY = headY + 5 * z;
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.roundRect(cupX, cupY, 4 * z, 5 * z, 1 * z);
      ctx.fill();

      // Rising Steam
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.65)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const steamOffset = (this.tick * 0.1) % 6;
      ctx.moveTo(cupX + 2 * z, cupY - 1 * z - steamOffset * z);
      ctx.quadraticCurveTo(cupX + 4 * z, cupY - 3 * z - steamOffset * z, cupX + 2 * z, cupY - 5 * z - steamOffset * z);
      ctx.stroke();
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
    const text = this.isVerified ? `${this.displayName} ✓` : this.displayName;
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

    ctx.strokeStyle = this.isVerified ? '#00f0ff' : '#f59e0b';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.fillStyle = this.isVerified ? '#38bdf8' : '#fbbf24';
    ctx.fillText(text, sx, badgeY);
  }
}

function headCenterX(sx: number): number {
  return sx;
}
