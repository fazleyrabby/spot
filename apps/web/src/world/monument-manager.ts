/**
 * MonumentManager / CitizenNPCManager — Renders all other citizens as cute animated chibi characters in Spot World.
 *
 * Rules:
 * - Every citizen is represented by their unique chibi character (with their archetype colors and animations).
 * - Citizens roam within their 5x5 plot, pause to look around, or sit/sleep cozily.
 * - Online citizens show a live jade online indicator.
 * - Clicking any citizen opens their profile modal.
 */

import {
  TILE_WIDTH,
  TILE_HEIGHT,
  gridToWorldCenter,
} from '@spot/world';
import type { OccupiedSpotSummary } from '@spot/shared';
import { AVATAR_CATALOG } from '../canvas/avatars.js';
import type { SpriteManager } from './sprite-manager.js';

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

interface SleepZ {
  x: number;
  y: number;
  alpha: number;
  scale: number;
  seed: number;
  age: number;
}

export interface CitizenEntity {
  spot: OccupiedSpotSummary;
  wx: number;
  wy: number;
  targetWx: number;
  targetWy: number;
  direction: 'down' | 'up' | 'left' | 'right';
  state: 'walking' | 'idle' | 'sleeping';
  frame: number;
  animTimer: number;
  pauseTimer: number;
  isMoving: boolean;
  sleepParticles: SleepZ[];
  propType: 'lamp' | 'bench' | 'flowers' | 'sign' | 'bonfire';
}

function getPlotPropType(name: string): 'lamp' | 'bench' | 'flowers' | 'sign' | 'bonfire' {
  const props: ('lamp' | 'bench' | 'flowers' | 'sign' | 'bonfire')[] = ['lamp', 'bench', 'flowers', 'sign', 'bonfire'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return props[Math.abs(hash) % props.length];
}

export class MonumentManager {
  private entities = new Map<string, CitizenEntity>();
  private excludeCitizenId = '';

  constructor(_onClick?: (spot: OccupiedSpotSummary) => void) {}

  setExcludeCitizen(id: string): void {
    this.excludeCitizenId = id;
  }

  update(spots: OccupiedSpotSummary[]): void {
    const existing = new Set<string>();

    for (const spot of spots) {
      if (spot.citizenId === this.excludeCitizenId) continue;
      const key = `${spot.x},${spot.y}`;
      existing.add(key);

      const center = gridToWorldCenter(spot.x, spot.y);

      if (!this.entities.has(key)) {
        // Initial random sub-tile offset
        const initOffsetWx = (Math.random() - 0.5) * TILE_WIDTH * 1.5;
        const initOffsetWy = (Math.random() - 0.5) * TILE_HEIGHT * 1.2;

        this.entities.set(key, {
          spot,
          wx: center.wx + initOffsetWx,
          wy: center.wy + initOffsetWy,
          targetWx: center.wx + initOffsetWx,
          targetWy: center.wy + initOffsetWy,
          direction: Math.random() > 0.5 ? 'down' : 'right',
          state: Math.random() < 0.25 ? 'sleeping' : 'idle',
          frame: 0,
          animTimer: 0,
          pauseTimer: Math.floor(Math.random() * 120),
          isMoving: false,
          sleepParticles: [],
          propType: getPlotPropType(spot.displayName),
        });
      } else {
        const ent = this.entities.get(key)!;
        ent.spot = spot;
      }
    }

    for (const key of Array.from(this.entities.keys())) {
      if (!existing.has(key)) {
        this.entities.delete(key);
      }
    }
  }

  updateTick(): void {
    for (const ent of this.entities.values()) {
      this.updateCitizenAI(ent);
    }
  }

  private updateCitizenAI(ent: CitizenEntity): void {
    if (ent.state === 'sleeping') {
      this.updateSleepParticles(ent);
      // Occasionally wake up and walk around
      if (Math.random() < 0.002) {
        ent.state = 'idle';
        ent.pauseTimer = 60;
      }
      return;
    }

    if (ent.pauseTimer > 0) {
      ent.pauseTimer--;
      ent.isMoving = false;

      // Small chance to take a nap if offline
      if (!ent.spot.isOnline && Math.random() < 0.003) {
        ent.state = 'sleeping';
      }
      return;
    }

    const dist = Math.hypot(ent.targetWx - ent.wx, ent.targetWy - ent.wy);

    if (dist < 3) {
      // Arrived at waypoint
      ent.isMoving = false;
      ent.state = 'idle';
      ent.pauseTimer = 80 + Math.floor(Math.random() * 160);

      // Pick next waypoint within 5x5 plot bounds
      const center = gridToWorldCenter(ent.spot.x, ent.spot.y);
      const roamRadiusX = TILE_WIDTH * 1.6;
      const roamRadiusY = TILE_HEIGHT * 1.3;

      ent.targetWx = center.wx + (Math.random() - 0.5) * roamRadiusX * 2;
      ent.targetWy = center.wy + (Math.random() - 0.5) * roamRadiusY * 2;
    } else {
      ent.isMoving = true;
      ent.state = 'walking';
      const speed = ent.spot.isOnline ? 0.95 : 0.75;
      const dx = ent.targetWx - ent.wx;
      const dy = ent.targetWy - ent.wy;

      if (Math.abs(dy) >= Math.abs(dx)) {
        ent.direction = dy > 0 ? 'down' : 'up';
      } else {
        ent.direction = dx > 0 ? 'right' : 'left';
      }

      ent.wx += (dx / dist) * speed;
      ent.wy += (dy / dist) * speed;

      ent.animTimer++;
      if (ent.animTimer >= 8) {
        ent.animTimer = 0;
        ent.frame = (ent.frame + 1) % 4;
      }
    }
  }

  private updateSleepParticles(ent: CitizenEntity): void {
    if (Math.random() < 0.035 && ent.sleepParticles.length < 4) {
      ent.sleepParticles.push({
        x: ent.wx + 6 + (Math.random() - 0.5) * 4,
        y: ent.wy - 22,
        alpha: 0.85,
        scale: 0.7 + Math.random() * 0.4,
        seed: Math.random() * 10,
        age: 0,
      });
    }

    for (let i = ent.sleepParticles.length - 1; i >= 0; i--) {
      const p = ent.sleepParticles[i];
      p.age++;
      p.y -= 0.4;
      p.x += Math.sin(p.age * 0.09 + p.seed) * 0.3;
      p.alpha -= 0.011;

      if (p.alpha <= 0 || p.age > 80) {
        ent.sleepParticles.splice(i, 1);
      }
    }
  }

  hitTest(wx: number, wy: number): OccupiedSpotSummary | null {
    for (const ent of this.entities.values()) {
      const dist = Math.hypot(wx - ent.wx, wy - ent.wy);
      if (dist < 22) {
        return ent.spot;
      }
    }
    return null;
  }

  getAllEntities(): CitizenEntity[] {
    return Array.from(this.entities.values());
  }

  // ---------------------------------------------------------------------------
  // Citizen Chibi Rendering
  // ---------------------------------------------------------------------------

  renderEntity(
    ctx: CanvasRenderingContext2D,
    ent: CitizenEntity,
    sx: number,
    sy: number,
    z: number,
    _sprites: SpriteManager,
    showNameTag: boolean,
  ): void {
    const avatar = AVATAR_CATALOG[ent.spot.avatarId] ?? AVATAR_CATALOG.astronaut;
    const colors = {
      primary: avatar.colors.primary || '#38bdf8',
      secondary: avatar.colors.secondary || '#0f172a',
      accent: avatar.colors.accent || '#f59e0b',
      skin: avatar.colors.skin || '#fde047',
    };

    // Soft ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 8 * z, 4 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    if (ent.state === 'sleeping') {
      this.renderSleepingCitizen(ctx, sx, sy, z, colors);
      this.renderSleepParticles(ctx, ent, sx, sy, z);
    } else {
      this.renderAwakeCitizen(ctx, ent, sx, sy, z, colors);
    }

    // Name badge / indicator
    if (showNameTag) {
      this.renderCitizenBadge(ctx, sx, sy - 26 * z, z, ent.spot.displayName, ent.spot.isOnline ?? false);
    } else if (ent.spot.isOnline) {
      // Small cute jade online dot
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(sx, sy - 24 * z, 2.5 * z, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderAwakeCitizen(
    ctx: CanvasRenderingContext2D,
    ent: CitizenEntity,
    sx: number,
    sy: number,
    z: number,
    c: { primary: string; secondary: string; accent: string; skin: string },
  ): void {
    const isSteppingLeft = ent.isMoving && ent.frame === 1;
    const isSteppingRight = ent.isMoving && ent.frame === 3;
    const headBob = (isSteppingLeft || isSteppingRight) ? -1.5 * z : 0;
    const dir = ent.direction;

    // --- Feet ---
    ctx.fillStyle = c.accent || '#334155';
    if (dir === 'down' || dir === 'up') {
      const leftFootY = sy - 2 * z + (isSteppingLeft ? -2 * z : 0);
      const rightFootY = sy - 2 * z + (isSteppingRight ? -2 * z : 0);
      ctx.fillRect(sx - 5 * z, leftFootY, 3.5 * z, 2.5 * z);
      ctx.fillRect(sx + 1.5 * z, rightFootY, 3.5 * z, 2.5 * z);
    } else if (dir === 'left') {
      const footY = sy - 2 * z + (isSteppingLeft ? -2 * z : 0);
      ctx.fillRect(sx - 4 * z, footY, 5 * z, 2.5 * z);
    } else if (dir === 'right') {
      const footY = sy - 2 * z + (isSteppingRight ? -2 * z : 0);
      ctx.fillRect(sx - 1 * z, footY, 5 * z, 2.5 * z);
    }

    // --- Body / Shirt ---
    const bodyY = sy - 11 * z;
    ctx.fillStyle = c.primary;
    ctx.beginPath();
    ctx.roundRect(sx - 5.5 * z, bodyY, 11 * z, 9 * z, 2.5 * z);
    ctx.fill();

    // Belt accent
    ctx.fillStyle = c.accent;
    ctx.fillRect(sx - 4.5 * z, sy - 4 * z, 9 * z, 1.2 * z);

    // Hands
    ctx.fillStyle = c.skin;
    if (dir === 'down' || dir === 'up') {
      ctx.fillRect(sx - 7 * z, bodyY + 2.5 * z, 2 * z, 3.5 * z);
      ctx.fillRect(sx + 5 * z, bodyY + 2.5 * z, 2 * z, 3.5 * z);
    }

    // --- Big Round Chibi Head ---
    const headX = sx;
    const headY = sy - 17 * z + headBob;
    const headRadius = 8 * z;

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
      ctx.arc(headX, headY - 1.2 * z, headRadius, Math.PI * 0.85, Math.PI * 2.15);
      ctx.lineTo(headX + 6 * z, headY - 2 * z);
      ctx.lineTo(headX, headY - 3.5 * z);
      ctx.lineTo(headX - 6 * z, headY - 2 * z);
      ctx.closePath();
      ctx.fill();
    } else if (dir === 'left') {
      ctx.arc(headX + 1.2 * z, headY, headRadius, Math.PI * 0.6, Math.PI * 1.8);
      ctx.fill();
    } else if (dir === 'right') {
      ctx.arc(headX - 1.2 * z, headY, headRadius, -Math.PI * 0.4, Math.PI * 0.8);
      ctx.fill();
    }

    // --- Expressive Face ---
    if (dir !== 'up') {
      // Cute blush
      ctx.fillStyle = 'rgba(244, 63, 94, 0.4)';
      ctx.beginPath();
      if (dir === 'down') {
        ctx.arc(headX - 4.5 * z, headY + 2 * z, 1.8 * z, 0, Math.PI * 2);
        ctx.arc(headX + 4.5 * z, headY + 2 * z, 1.8 * z, 0, Math.PI * 2);
      } else if (dir === 'left') {
        ctx.arc(headX - 3.5 * z, headY + 2 * z, 1.8 * z, 0, Math.PI * 2);
      } else if (dir === 'right') {
        ctx.arc(headX + 3.5 * z, headY + 2 * z, 1.8 * z, 0, Math.PI * 2);
      }
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#0f172a';
      if (dir === 'down') {
        ctx.fillRect(headX - 4 * z, headY - 1 * z, 2 * z, 3 * z);
        ctx.fillRect(headX + 2 * z, headY - 1 * z, 2 * z, 3 * z);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(headX - 4 * z, headY - 1 * z, 1 * z, 1 * z);
        ctx.fillRect(headX + 2 * z, headY - 1 * z, 1 * z, 1 * z);
      } else if (dir === 'left') {
        ctx.fillRect(headX - 5 * z, headY - 1 * z, 2 * z, 3 * z);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(headX - 5 * z, headY - 1 * z, 1 * z, 1 * z);
      } else if (dir === 'right') {
        ctx.fillRect(headX + 3 * z, headY - 1 * z, 2 * z, 3 * z);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(headX + 3 * z, headY - 1 * z, 1 * z, 1 * z);
      }
    }
  }

  private renderSleepingCitizen(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    z: number,
    c: { primary: string; secondary: string; accent: string; skin: string },
  ): void {
    const bodyY = sy - 7 * z;

    // Blanket
    ctx.fillStyle = c.accent || '#f59e0b';
    ctx.beginPath();
    ctx.roundRect(sx - 9 * z, bodyY - 2 * z, 18 * z, 9 * z, 3.5 * z);
    ctx.fill();

    // Head
    const headX = sx - 2.5 * z;
    const headY = bodyY - 7 * z;
    ctx.fillStyle = c.skin;
    ctx.beginPath();
    ctx.arc(headX, headY, 6.5 * z, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = c.secondary;
    ctx.beginPath();
    ctx.arc(headX, headY - 1 * z, 6.5 * z, Math.PI * 0.8, Math.PI * 2.2);
    ctx.fill();

    // Sleeping eye arc
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.2 * z;
    ctx.beginPath();
    ctx.moveTo(headX - 3.5 * z, headY);
    ctx.lineTo(headX - 1.5 * z, headY - 1.2 * z);
    ctx.lineTo(headX + 0.5 * z, headY);
    ctx.stroke();
  }

  private renderSleepParticles(
    ctx: CanvasRenderingContext2D,
    ent: CitizenEntity,
    sx: number,
    sy: number,
    z: number,
  ): void {
    ctx.save();
    ctx.fillStyle = '#38bdf8';
    ctx.font = `bold ${Math.round(10 * z)}px 'Outfit', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const p of ent.sleepParticles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
      ctx.fillText('z', sx + (p.x - ent.wx) * z, sy + (p.y - ent.wy) * z);
    }
    ctx.restore();
  }

  private renderCitizenBadge(
    ctx: CanvasRenderingContext2D,
    bx: number,
    by: number,
    z: number,
    name: string,
    isOnline: boolean,
  ): void {
    const fontSize = Math.max(8, Math.round(8.5 * z));
    ctx.font = `600 ${fontSize}px 'Outfit', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textW = ctx.measureText(name).width;
    const dotSpace = isOnline ? 8 * z : 0;
    const badgeW = textW + 10 * z + dotSpace;
    const badgeH = fontSize + 5 * z;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(bx - badgeW / 2, by - badgeH / 2, badgeW, badgeH, 4 * z);
    ctx.fill();

    ctx.strokeStyle = isOnline ? 'rgba(16, 185, 129, 0.7)' : 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (isOnline) {
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(bx - badgeW / 2 + 5 * z, by, 2.5 * z, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = isOnline ? '#34d399' : '#f8fafc';
    ctx.fillText(name, bx + (isOnline ? 3 * z : 0), by);
  }
}
