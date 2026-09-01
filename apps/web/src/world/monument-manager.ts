/**
 * MonumentManager / CitizenNPCManager — Renders all other citizens as highly detailed animated chibi characters.
 *
 * Features:
 * - Archetype Headgear & Outfits (Astronaut helmet, Wizard hat, Cyber visor, Ninja headband, Golden crown).
 * - Animated micro-bounce and walking step cycles.
 * - Cute floating thought/emote bubbles (❤️, ☕, ✨, 🎵, 💡).
 * - Sleeping cozy poses with floating 'z' particles when offline.
 */

import {
  TILE_WIDTH,
  TILE_HEIGHT,
  TOTAL_WORLD_WIDTH,
  TOTAL_WORLD_HEIGHT,
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

interface EmoteBubble {
  type: 'heart' | 'coffee' | 'sparkle' | 'music' | 'bulb';
  age: number;
  maxAge: number;
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
  emote: EmoteBubble | null;
  emoteTimer: number;
}

export class MonumentManager {
  private entities = new Map<string, CitizenEntity>();
  private excludeCitizenId = '';
  private excludeDisplayName = '';
  private tick = 0;

  constructor(
    _onClick?: (spot: OccupiedSpotSummary) => void,
    excludeCitizenId?: string,
    excludeDisplayName?: string,
  ) {
    if (excludeCitizenId) this.excludeCitizenId = excludeCitizenId;
    if (excludeDisplayName) this.excludeDisplayName = excludeDisplayName;
  }

  setExcludeCitizen(id: string, displayName?: string): void {
    this.excludeCitizenId = id;
    if (displayName) this.excludeDisplayName = displayName;

    if (id || displayName) {
      for (const [key, ent] of this.entities.entries()) {
        if ((id && ent.spot.citizenId === id) || (displayName && ent.spot.displayName === displayName)) {
          this.entities.delete(key);
        }
      }
    }
  }

  update(spots: OccupiedSpotSummary[]): void {
    const existing = new Set<string>();

    for (const spot of spots) {
      if (this.excludeCitizenId && spot.citizenId === this.excludeCitizenId) continue;
      if (this.excludeDisplayName && spot.displayName === this.excludeDisplayName) continue;
      const key = `${spot.x},${spot.y}`;
      existing.add(key);

      const center = gridToWorldCenter(spot.x, spot.y);

      if (!this.entities.has(key)) {
        const initOffsetWx = (Math.random() - 0.5) * TILE_WIDTH * 1.2;
        const initOffsetWy = (Math.random() - 0.5) * TILE_HEIGHT * 1.0;

        const clampedWx = Math.max(TILE_WIDTH * 0.5, Math.min(TOTAL_WORLD_WIDTH - TILE_WIDTH * 0.5, center.wx + initOffsetWx));
        const clampedWy = Math.max(TILE_HEIGHT * 0.5, Math.min(TOTAL_WORLD_HEIGHT - TILE_HEIGHT * 0.5, center.wy + initOffsetWy));

        this.entities.set(key, {
          spot,
          wx: clampedWx,
          wy: clampedWy,
          targetWx: clampedWx,
          targetWy: clampedWy,
          direction: Math.random() > 0.5 ? 'down' : 'right',
          state: Math.random() < 0.2 ? 'sleeping' : 'idle',
          frame: 0,
          animTimer: 0,
          pauseTimer: Math.floor(Math.random() * 120),
          isMoving: false,
          sleepParticles: [],
          emote: null,
          emoteTimer: Math.floor(Math.random() * 300),
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
    this.tick++;
    for (const ent of this.entities.values()) {
      this.updateCitizenAI(ent);
      this.updateEmote(ent);
    }
  }

  private updateEmote(ent: CitizenEntity): void {
    if (ent.emote) {
      ent.emote.age++;
      if (ent.emote.age >= ent.emote.maxAge) {
        ent.emote = null;
      }
    } else if (ent.state !== 'sleeping') {
      ent.emoteTimer++;
      if (ent.emoteTimer > 400 + Math.random() * 400) {
        ent.emoteTimer = 0;
        const emotes: ('heart' | 'coffee' | 'sparkle' | 'music' | 'bulb')[] = ['heart', 'coffee', 'sparkle', 'music', 'bulb'];
        ent.emote = {
          type: emotes[Math.floor(Math.random() * emotes.length)],
          age: 0,
          maxAge: 120,
        };
      }
    }
  }

  private updateCitizenAI(ent: CitizenEntity): void {
    if (ent.state === 'sleeping') {
      this.updateSleepParticles(ent);
      if (Math.random() < 0.002) {
        ent.state = 'idle';
        ent.pauseTimer = 60;
      }
      return;
    }

    if (ent.pauseTimer > 0) {
      ent.pauseTimer--;
      ent.isMoving = false;
      if (!ent.spot.isOnline && Math.random() < 0.002) {
        ent.state = 'sleeping';
      }
      return;
    }

    const dist = Math.hypot(ent.targetWx - ent.wx, ent.targetWy - ent.wy);

    if (dist < 3) {
      ent.isMoving = false;
      ent.state = 'idle';
      ent.pauseTimer = 80 + Math.floor(Math.random() * 160);

      const center = gridToWorldCenter(ent.spot.x, ent.spot.y);
      const roamRadiusX = TILE_WIDTH * 1.5;
      const roamRadiusY = TILE_HEIGHT * 1.2;

      const rawTargetX = center.wx + (Math.random() - 0.5) * roamRadiusX * 2;
      const rawTargetY = center.wy + (Math.random() - 0.5) * roamRadiusY * 2;

      ent.targetWx = Math.max(TILE_WIDTH * 0.5, Math.min(TOTAL_WORLD_WIDTH - TILE_WIDTH * 0.5, rawTargetX));
      ent.targetWy = Math.max(TILE_HEIGHT * 0.5, Math.min(TOTAL_WORLD_HEIGHT - TILE_HEIGHT * 0.5, rawTargetY));
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

      ent.wx = Math.max(TILE_WIDTH * 0.5, Math.min(TOTAL_WORLD_WIDTH - TILE_WIDTH * 0.5, ent.wx + (dx / dist) * speed));
      ent.wy = Math.max(TILE_HEIGHT * 0.5, Math.min(TOTAL_WORLD_HEIGHT - TILE_HEIGHT * 0.5, ent.wy + (dy / dist) * speed));

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

    // Soft ground contact shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 8 * z, 4 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    if (ent.state === 'sleeping') {
      this.renderSleepingCitizen(ctx, sx, sy, z, colors, ent.spot.avatarId);
      this.renderSleepParticles(ctx, ent, sx, sy, z);
    } else {
      this.renderAwakeCitizen(ctx, ent, sx, sy, z, colors, ent.spot.avatarId);
    }

    // Emote thought bubble (❤️, ☕, ✨, 🎵, 💡)
    if (ent.emote) {
      this.renderEmoteBubble(ctx, sx, sy - 34 * z, z, ent.emote);
    }

    // Name badge / online status
    if (showNameTag) {
      this.renderCitizenBadge(ctx, sx, sy - 28 * z, z, ent.spot.displayName, ent.spot.isOnline ?? false);
    } else if (ent.spot.isOnline) {
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(sx, sy - 25 * z, 2.5 * z, 0, Math.PI * 2);
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
    avatarId: string,
  ): void {
    const isSteppingLeft = ent.isMoving && ent.frame === 1;
    const isSteppingRight = ent.isMoving && ent.frame === 3;
    const breathe = !ent.isMoving ? Math.sin(this.tick * 0.08 + ent.wx) * 0.7 * z : 0;
    const headBob = (isSteppingLeft || isSteppingRight) ? -1.5 * z : breathe;
    const dir = ent.direction;

    // --- Feet & Shoes ---
    ctx.fillStyle = c.accent || '#334155';
    if (dir === 'down' || dir === 'up') {
      const leftFootY = sy - 2 * z + (isSteppingLeft ? -2.2 * z : 0);
      const rightFootY = sy - 2 * z + (isSteppingRight ? -2.2 * z : 0);
      ctx.fillRect(sx - 5 * z, leftFootY, 3.5 * z, 2.5 * z);
      ctx.fillRect(sx + 1.5 * z, rightFootY, 3.5 * z, 2.5 * z);
    } else if (dir === 'left') {
      const footY = sy - 2 * z + (isSteppingLeft ? -2 * z : 0);
      ctx.fillRect(sx - 4 * z, footY, 5 * z, 2.5 * z);
    } else if (dir === 'right') {
      const footY = sy - 2 * z + (isSteppingRight ? -2 * z : 0);
      ctx.fillRect(sx - 1 * z, footY, 5 * z, 2.5 * z);
    }

    // --- Body / Outfit ---
    const bodyY = sy - 11 * z;
    ctx.fillStyle = c.primary;
    ctx.beginPath();
    ctx.roundRect(sx - 5.5 * z, bodyY, 11 * z, 9 * z, 2.5 * z);
    ctx.fill();

    // Belt / shirt stripe
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

    // Face / Skin
    ctx.fillStyle = c.skin;
    ctx.beginPath();
    ctx.arc(headX, headY, headRadius, 0, Math.PI * 2);
    ctx.fill();

    // Hair / Base Hood
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

    // --- Archetype Headgear & Accessories ---
    this.renderArchetypeAccessory(ctx, headX, headY, z, avatarId, dir, c);

    // --- Face Eyes & Blush ---
    if (dir !== 'up') {
      // Cute blush
      ctx.fillStyle = 'rgba(244, 63, 94, 0.45)';
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

      // Sparkly eyes
      if (avatarId !== 'hacker') {
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
  }

  private renderArchetypeAccessory(
    ctx: CanvasRenderingContext2D,
    hx: number,
    hy: number,
    z: number,
    avatarId: string,
    dir: string,
    c: { primary: string; secondary: string; accent: string; skin: string },
  ): void {
    switch (avatarId) {
      case 'astronaut': {
        // Cyan Bubble Visor
        if (dir !== 'up') {
          ctx.fillStyle = 'rgba(2, 132, 199, 0.75)';
          ctx.beginPath();
          ctx.roundRect(hx - 5.5 * z, hy - 2 * z, 11 * z, 5 * z, 2.5 * z);
          ctx.fill();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.fillRect(hx - 4 * z, hy - 1.5 * z, 3 * z, 1.2 * z);
        }
        break;
      }

      case 'hacker': {
        // Glowing Cyber-Visor
        if (dir !== 'up') {
          ctx.fillStyle = '#10b981';
          ctx.fillRect(hx - 5.5 * z, hy - 1 * z, 11 * z, 2 * z);
          ctx.fillStyle = '#34d399';
          ctx.fillRect(hx - 2 * z, hy - 1 * z, 4 * z, 2 * z);
        }
        // Cat / Demon Hood Horns
        ctx.fillStyle = c.secondary;
        ctx.beginPath();
        ctx.moveTo(hx - 6 * z, hy - 6 * z);
        ctx.lineTo(hx - 8 * z, hy - 11 * z);
        ctx.lineTo(hx - 3 * z, hy - 7 * z);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(hx + 6 * z, hy - 6 * z);
        ctx.lineTo(hx + 8 * z, hy - 11 * z);
        ctx.lineTo(hx + 3 * z, hy - 7 * z);
        ctx.fill();
        break;
      }

      case 'pixel_wizard': {
        // Pointed Wizard Hat
        ctx.fillStyle = c.primary;
        ctx.beginPath();
        ctx.moveTo(hx - 9 * z, hy - 5 * z);
        ctx.lineTo(hx, hy - 18 * z);
        ctx.lineTo(hx + 9 * z, hy - 5 * z);
        ctx.closePath();
        ctx.fill();

        // Gold hat buckle
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(hx - 3 * z, hy - 6 * z, 6 * z, 2 * z);
        break;
      }

      case 'solar_champion': {
        // Golden Crown
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(hx - 5 * z, hy - 7 * z);
        ctx.lineTo(hx - 5 * z, hy - 11 * z);
        ctx.lineTo(hx - 2.5 * z, hy - 8.5 * z);
        ctx.lineTo(hx, hy - 12 * z);
        ctx.lineTo(hx + 2.5 * z, hy - 8.5 * z);
        ctx.lineTo(hx + 5 * z, hy - 11 * z);
        ctx.lineTo(hx + 5 * z, hy - 7 * z);
        ctx.closePath();
        ctx.fill();
        break;
      }
    }
  }

  private renderSleepingCitizen(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    z: number,
    c: { primary: string; secondary: string; accent: string; skin: string },
    _avatarId: string,
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

  private renderEmoteBubble(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    z: number,
    emote: EmoteBubble,
  ): void {
    const floatY = sy - Math.min(6 * z, (emote.age / emote.maxAge) * 6 * z);
    const alpha = emote.age > 90 ? (120 - emote.age) / 30 : 1;

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);

    // Pill bubble
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.roundRect(sx - 7 * z, floatY - 6 * z, 14 * z, 12 * z, 4 * z);
    ctx.fill();

    ctx.strokeStyle = 'rgba(15, 23, 42, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Small tail
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.moveTo(sx - 2 * z, floatY + 6 * z);
    ctx.lineTo(sx, floatY + 9 * z);
    ctx.lineTo(sx + 2 * z, floatY + 6 * z);
    ctx.fill();

    // Emote icon
    ctx.font = `${Math.round(8 * z)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const icons = {
      heart: '❤️',
      coffee: '☕',
      sparkle: '✨',
      music: '🎵',
      bulb: '💡',
    };
    ctx.fillText(icons[emote.type], sx, floatY);
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

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
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
