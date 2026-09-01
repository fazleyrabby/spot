/**
 * MonumentManager — Renders other citizens in Spot World.
 *
 * Visual Improvements:
 * - Offline citizens: cozy cottage / house structure scaled to fit grid tile footprint with soft chimney smoke.
 * - Online citizens: cute chibi character with autonomous wandering AI.
 * - Name tags: shown for hovered/selected citizen, or when zoomed in for nearby neighbors (not a sea of overlapping black badges).
 */

import {
  TILE_WIDTH,
  TILE_HEIGHT,
  gridToWorldCenter,
} from '@spot/world';
import type { OccupiedSpotSummary } from '@spot/shared';
import { AVATAR_CATALOG } from '../canvas/avatars.js';
import { SpriteManager } from './sprite-manager.js';

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

interface ChimneySmoke {
  x: number;
  y: number;
  alpha: number;
  radius: number;
  vx: number;
  vy: number;
  age: number;
}

export interface CitizenEntity {
  spot: OccupiedSpotSummary;
  wx: number;
  wy: number;
  targetWx: number;
  targetWy: number;
  direction: 'down' | 'up' | 'left' | 'right';
  frame: number;
  animTimer: number;
  pauseTimer: number;
  isMoving: boolean;
  smokeParticles: ChimneySmoke[];
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
        this.entities.set(key, {
          spot,
          wx: center.wx,
          wy: center.wy,
          targetWx: center.wx,
          targetWy: center.wy,
          direction: 'down',
          frame: 0,
          animTimer: 0,
          pauseTimer: Math.floor(Math.random() * 100),
          isMoving: false,
          smokeParticles: [],
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
      if (ent.spot.isOnline) {
        this.updateRoamAI(ent);
      } else {
        this.updateChimneySmoke(ent);
      }
    }
  }

  private updateRoamAI(ent: CitizenEntity): void {
    if (ent.pauseTimer > 0) {
      ent.pauseTimer--;
      ent.isMoving = false;
      return;
    }

    const dist = Math.hypot(ent.targetWx - ent.wx, ent.targetWy - ent.wy);

    if (dist < 3) {
      ent.pauseTimer = 60 + Math.floor(Math.random() * 120);
      ent.isMoving = false;

      const center = gridToWorldCenter(ent.spot.x, ent.spot.y);
      const roamRadiusX = TILE_WIDTH * 1.2;
      const roamRadiusY = TILE_HEIGHT * 1.0;

      ent.targetWx = center.wx + (Math.random() - 0.5) * roamRadiusX * 2;
      ent.targetWy = center.wy + (Math.random() - 0.5) * roamRadiusY * 2;
    } else {
      ent.isMoving = true;
      const speed = 0.85;
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

  private updateChimneySmoke(ent: CitizenEntity): void {
    if (Math.random() < 0.035 && ent.smokeParticles.length < 5) {
      ent.smokeParticles.push({
        x: ent.wx + 8 + (Math.random() - 0.5) * 3,
        y: ent.wy - 28,
        alpha: 0.65,
        radius: 2.5 + Math.random() * 2,
        vx: (Math.random() - 0.5) * 0.15 + 0.1,
        vy: -0.35 - Math.random() * 0.2,
        age: 0,
      });
    }

    for (let i = ent.smokeParticles.length - 1; i >= 0; i--) {
      const p = ent.smokeParticles[i];
      p.age++;
      p.x += p.vx;
      p.y += p.vy;
      p.radius += 0.04;
      p.alpha -= 0.009;

      if (p.alpha <= 0 || p.age > 85) {
        ent.smokeParticles.splice(i, 1);
      }
    }
  }

  hitTest(wx: number, wy: number): OccupiedSpotSummary | null {
    for (const ent of this.entities.values()) {
      const dist = Math.hypot(wx - ent.wx, wy - ent.wy);
      if (dist < 26) {
        return ent.spot;
      }
    }
    return null;
  }

  getAllEntities(): CitizenEntity[] {
    return Array.from(this.entities.values());
  }

  // ---------------------------------------------------------------------------
  // Entity Rendering
  // ---------------------------------------------------------------------------

  renderEntity(
    ctx: CanvasRenderingContext2D,
    ent: CitizenEntity,
    sx: number,
    sy: number,
    z: number,
    sprites: SpriteManager,
    showNameTag: boolean,
  ): void {
    if (ent.spot.isOnline) {
      this.renderOnlineChibi(ctx, ent, sx, sy, z, showNameTag);
    } else {
      this.renderHouseStructure(ctx, ent, sx, sy, z, sprites, showNameTag);
    }
  }

  private renderOnlineChibi(
    ctx: CanvasRenderingContext2D,
    ent: CitizenEntity,
    sx: number,
    sy: number,
    z: number,
    showNameTag: boolean,
  ): void {
    const avatar = AVATAR_CATALOG[ent.spot.avatarId] ?? AVATAR_CATALOG.astronaut;
    const colors = {
      primary: avatar.colors.primary || '#10b981',
      secondary: avatar.colors.secondary || '#0f172a',
      accent: avatar.colors.accent || '#34d399',
      skin: avatar.colors.skin || '#fed7aa',
    };

    // Soft shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 7 * z, 3.5 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    const isStepping = ent.isMoving && (ent.frame === 1 || ent.frame === 3);
    const headBob = isStepping ? -1.5 * z : 0;
    const dir = ent.direction;

    // Feet
    ctx.fillStyle = colors.accent;
    ctx.fillRect(sx - 4 * z, sy - 2 * z, 3 * z, 2.5 * z);
    ctx.fillRect(sx + 1 * z, sy - 2 * z, 3 * z, 2.5 * z);

    // Body
    ctx.fillStyle = colors.primary;
    ctx.beginPath();
    ctx.roundRect(sx - 5 * z, sy - 10 * z, 10 * z, 8 * z, 2.5 * z);
    ctx.fill();

    // Head
    const headY = sy - 15 * z + headBob;
    ctx.fillStyle = colors.skin;
    ctx.beginPath();
    ctx.arc(sx, headY, 7 * z, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = colors.secondary;
    ctx.beginPath();
    if (dir === 'up') {
      ctx.arc(sx, headY, 7 * z, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.arc(sx, headY - 1 * z, 7 * z, Math.PI * 0.8, Math.PI * 2.2);
      ctx.fill();
    }

    // Eyes
    if (dir !== 'up') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(sx - 3 * z, headY - 0.5 * z, 1.8 * z, 2.2 * z);
      ctx.fillRect(sx + 1.2 * z, headY - 0.5 * z, 1.8 * z, 2.2 * z);
    }

    if (showNameTag) {
      this.renderCitizenBadge(ctx, sx, sy - 24 * z, z, ent.spot.displayName, true);
    } else {
      // Small cute green online indicator dot above head
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(sx, sy - 23 * z, 2.5 * z, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderHouseStructure(
    ctx: CanvasRenderingContext2D,
    ent: CitizenEntity,
    sx: number,
    sy: number,
    z: number,
    sprites: SpriteManager,
    showNameTag: boolean,
  ): void {
    const spriteKey = sprites.getHouseKeyForSpot(ent.spot.displayName);
    const sprite = sprites.getSprite(spriteKey);

    if (sprite) {
      // Scale sprite cleanly so it fits nicely on a 48x32 tile footprint
      const maxW = 44 * z;
      const maxH = 40 * z;
      const aspect = sprite.naturalWidth / sprite.naturalHeight;

      let drawW = maxW;
      let drawH = maxW / aspect;
      if (drawH > maxH) {
        drawH = maxH;
        drawW = maxH * aspect;
      }

      // Soft ground shadow under cottage
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.ellipse(sx, sy, drawW * 0.45, 5 * z, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.drawImage(sprite, sx - drawW / 2, sy - drawH + 2 * z, drawW, drawH);
    } else {
      this.renderProceduralHouse(ctx, sx, sy, z);
    }

    // Chimney Smoke Particles
    for (const p of ent.smokeParticles) {
      ctx.fillStyle = `rgba(241, 245, 249, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(sx + (p.x - ent.wx) * z, sy + (p.y - ent.wy) * z, p.radius * z, 0, Math.PI * 2);
      ctx.fill();
    }

    if (showNameTag) {
      this.renderCitizenBadge(ctx, sx, sy - 36 * z, z, ent.spot.displayName, false);
    }
  }

  private renderProceduralHouse(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    z: number,
  ): void {
    const hw = 30 * z;
    const hh = 22 * z;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, hw * 0.55, 5 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cottage Body
    ctx.fillStyle = '#dcd2c4';
    ctx.beginPath();
    ctx.roundRect(sx - hw / 2, sy - hh, hw, hh, 2.5 * z);
    ctx.fill();

    ctx.strokeStyle = '#85694b';
    ctx.lineWidth = 1.2 * z;
    ctx.stroke();

    // Terracotta Roof
    const roofY = sy - hh - 10 * z;
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.moveTo(sx - hw * 0.55, sy - hh + 1.5 * z);
    ctx.lineTo(sx, roofY);
    ctx.lineTo(sx + hw * 0.55, sy - hh + 1.5 * z);
    ctx.closePath();
    ctx.fill();

    // Door
    ctx.fillStyle = '#452a14';
    ctx.fillRect(sx - 4 * z, sy - 12 * z, 8 * z, 12 * z);

    // Warm lit window
    ctx.fillStyle = '#fde047';
    ctx.fillRect(sx - 11 * z, sy - 16 * z, 5 * z, 5 * z);
    ctx.fillRect(sx + 6 * z, sy - 16 * z, 5 * z, 5 * z);
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
