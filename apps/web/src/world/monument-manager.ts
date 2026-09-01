/**
 * MonumentManager — Renders other citizens in Spot World.
 *
 * Rules:
 * - Offline citizens: rendered as a cozy house / cottage structure at the plot center with chimney smoke.
 * - Online citizens: rendered as a cute chibi character walking around their 5x5 plot (AI roam).
 * - Clickable to open citizen profile popup.
 */

import {
  TILE_WIDTH,
  TILE_HEIGHT,
  gridToWorldCenter,
  worldToGrid,
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

interface CitizenEntity {
  spot: OccupiedSpotSummary;
  // World space feet anchor position
  wx: number;
  wy: number;
  // AI roam state for online citizens
  targetWx: number;
  targetWy: number;
  direction: 'down' | 'up' | 'left' | 'right';
  frame: number;
  animTimer: number;
  pauseTimer: number;
  isMoving: boolean;
  // Chimney smoke
  smokeParticles: ChimneySmoke[];
}

export class MonumentManager {
  private entities = new Map<string, CitizenEntity>();
  private excludeCitizenId = '';
  private onClick?: (spot: OccupiedSpotSummary) => void;

  constructor(onClick?: (spot: OccupiedSpotSummary) => void) {
    this.onClick = onClick;
  }

  setExcludeCitizen(id: string): void {
    this.excludeCitizenId = id;
  }

  /**
   * Sync citizens from world snapshot
   */
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

    // Remove deleted spots
    for (const key of Array.from(this.entities.keys())) {
      if (!existing.has(key)) {
        this.entities.delete(key);
      }
    }
  }

  /**
   * Update AI roam positions and particles per frame
   */
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
      // Arrived at waypoint — pause for 60 to 180 frames (1-3s)
      ent.pauseTimer = 60 + Math.floor(Math.random() * 120);
      ent.isMoving = false;

      // Pick next random waypoint within plot (center ± 1.5 tiles)
      const center = gridToWorldCenter(ent.spot.x, ent.spot.y);
      const roamRadiusX = TILE_WIDTH * 1.5;
      const roamRadiusY = TILE_HEIGHT * 1.2;

      ent.targetWx = center.wx + (Math.random() - 0.5) * roamRadiusX * 2;
      ent.targetWy = center.wy + (Math.random() - 0.5) * roamRadiusY * 2;
    } else {
      ent.isMoving = true;
      const speed = 0.9; // AI walking speed
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
    if (Math.random() < 0.04 && ent.smokeParticles.length < 6) {
      ent.smokeParticles.push({
        x: ent.wx + 10 + (Math.random() - 0.5) * 4,
        y: ent.wy - 38,
        alpha: 0.7,
        radius: 3 + Math.random() * 2,
        vx: (Math.random() - 0.5) * 0.2 + 0.15,
        vy: -0.4 - Math.random() * 0.2,
        age: 0,
      });
    }

    for (let i = ent.smokeParticles.length - 1; i >= 0; i--) {
      const p = ent.smokeParticles[i];
      p.age++;
      p.x += p.vx;
      p.y += p.vy;
      p.radius += 0.05;
      p.alpha -= 0.008;

      if (p.alpha <= 0 || p.age > 90) {
        ent.smokeParticles.splice(i, 1);
      }
    }
  }

  /**
   * Hit test for clicks
   */
  hitTest(wx: number, wy: number): OccupiedSpotSummary | null {
    for (const ent of this.entities.values()) {
      const dist = Math.hypot(wx - ent.wx, wy - ent.wy);
      if (dist < 32) {
        return ent.spot;
      }
    }
    return null;
  }

  /**
   * Get all entities for depth-sorted rendering
   */
  getAllEntities(): CitizenEntity[] {
    return Array.from(this.entities.values());
  }

  // ---------------------------------------------------------------------------
  // Rendering Helpers
  // ---------------------------------------------------------------------------

  renderEntity(
    ctx: CanvasRenderingContext2D,
    ent: CitizenEntity,
    sx: number,
    sy: number,
    z: number,
    sprites: SpriteManager,
  ): void {
    if (ent.spot.isOnline) {
      this.renderOnlineChibi(ctx, ent, sx, sy, z);
    } else {
      this.renderHouseStructure(ctx, ent, sx, sy, z, sprites);
    }
  }

  private renderOnlineChibi(
    ctx: CanvasRenderingContext2D,
    ent: CitizenEntity,
    sx: number,
    sy: number,
    z: number,
  ): void {
    const avatar = AVATAR_CATALOG[ent.spot.avatarId] ?? AVATAR_CATALOG.astronaut;
    const colors = {
      primary: avatar.colors.primary || '#10b981',
      secondary: avatar.colors.secondary || '#0f172a',
      accent: avatar.colors.accent || '#34d399',
      skin: avatar.colors.skin || '#fed7aa',
    };

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 8 * z, 4 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    const isStepping = ent.isMoving && (ent.frame === 1 || ent.frame === 3);
    const headBob = isStepping ? -1.5 * z : 0;
    const dir = ent.direction;

    // Feet
    ctx.fillStyle = colors.accent;
    ctx.fillRect(sx - 4.5 * z, sy - 2 * z, 3.5 * z, 2.5 * z);
    ctx.fillRect(sx + 1.2 * z, sy - 2 * z, 3.5 * z, 2.5 * z);

    // Body
    ctx.fillStyle = colors.primary;
    ctx.beginPath();
    ctx.roundRect(sx - 5.5 * z, sy - 11 * z, 11 * z, 9 * z, 2.5 * z);
    ctx.fill();

    // Head
    const headY = sy - 16 * z + headBob;
    ctx.fillStyle = colors.skin;
    ctx.beginPath();
    ctx.arc(sx, headY, 7.5 * z, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = colors.secondary;
    ctx.beginPath();
    if (dir === 'up') {
      ctx.arc(sx, headY, 7.5 * z, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.arc(sx, headY - 1 * z, 7.5 * z, Math.PI * 0.8, Math.PI * 2.2);
      ctx.fill();
    }

    // Eyes
    if (dir !== 'up') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(sx - 3.5 * z, headY - 0.5 * z, 2 * z, 2.5 * z);
      ctx.fillRect(sx + 1.8 * z, headY - 0.5 * z, 2 * z, 2.5 * z);
    }

    // Citizen Name Tag with Online Green Dot
    this.renderCitizenBadge(ctx, sx, sy - 26 * z, z, ent.spot.displayName, true);
  }

  private renderHouseStructure(
    ctx: CanvasRenderingContext2D,
    ent: CitizenEntity,
    sx: number,
    sy: number,
    z: number,
    sprites: SpriteManager,
  ): void {
    // Try sprite first
    const spriteKey = sprites.getHouseKeyForSpot(ent.spot.displayName);
    const sprite = sprites.getSprite(spriteKey);

    if (sprite) {
      const sw = sprite.naturalWidth * 0.45 * z;
      const sh = sprite.naturalHeight * 0.45 * z;
      ctx.drawImage(sprite, sx - sw / 2, sy - sh + 4 * z, sw, sh);
    } else {
      // Procedural cozy Stardew-style cottage fallback
      this.renderProceduralHouse(ctx, sx, sy, z, ent.spot);
    }

    // Chimney Smoke Particles
    for (const p of ent.smokeParticles) {
      ctx.fillStyle = `rgba(226, 232, 240, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(sx + (p.x - ent.wx) * z, sy + (p.y - ent.wy) * z, p.radius * z, 0, Math.PI * 2);
      ctx.fill();
    }

    // Citizen name plate
    this.renderCitizenBadge(ctx, sx, sy - 42 * z, z, ent.spot.displayName, false);
  }

  private renderProceduralHouse(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    z: number,
    spot: OccupiedSpotSummary,
  ): void {
    const hw = 34 * z;
    const hh = 26 * z;

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, hw * 0.6, 6 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // House Body (cozy timber/brick)
    ctx.fillStyle = '#e2d5c3';
    ctx.beginPath();
    ctx.roundRect(sx - hw / 2, sy - hh, hw, hh, 3 * z);
    ctx.fill();

    ctx.strokeStyle = '#8b6f4e';
    ctx.lineWidth = 1.5 * z;
    ctx.stroke();

    // Wood Roof (warm terracotta / slate)
    const roofY = sy - hh - 12 * z;
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.moveTo(sx - hw * 0.6, sy - hh + 2 * z);
    ctx.lineTo(sx, roofY);
    ctx.lineTo(sx + hw * 0.6, sy - hh + 2 * z);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.8 * z;
    ctx.stroke();

    // Door
    ctx.fillStyle = '#523418';
    ctx.fillRect(sx - 5 * z, sy - 14 * z, 10 * z, 14 * z);

    // Warm lit window
    ctx.fillStyle = '#fde047';
    ctx.fillRect(sx - 13 * z, sy - 18 * z, 6 * z, 6 * z);
    ctx.fillRect(sx + 7 * z, sy - 18 * z, 6 * z, 6 * z);
  }

  private renderCitizenBadge(
    ctx: CanvasRenderingContext2D,
    bx: number,
    by: number,
    z: number,
    name: string,
    isOnline: boolean,
  ): void {
    const fontSize = Math.max(8, Math.round(9 * z));
    ctx.font = `600 ${fontSize}px 'Outfit', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textW = ctx.measureText(name).width;
    const dotSpace = isOnline ? 9 * z : 0;
    const badgeW = textW + 12 * z + dotSpace;
    const badgeH = fontSize + 6 * z;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(bx - badgeW / 2, by - badgeH / 2, badgeW, badgeH, 4 * z);
    ctx.fill();

    ctx.strokeStyle = isOnline ? 'rgba(16, 185, 129, 0.6)' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (isOnline) {
      // Online green dot
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(bx - badgeW / 2 + 6 * z, by, 3 * z, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = isOnline ? '#34d399' : '#f8fafc';
    ctx.fillText(name, bx + (isOnline ? 4 * z : 0), by);
  }
}
