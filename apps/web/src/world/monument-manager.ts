/**
 * MonumentManager — Autonomous Citizen NPCs with Living Activity Modes.
 *
 * Activity Modes:
 * - 💻 working: Typing on an open glowing laptop with code sparkles
 * - ☕ having_coffee: Holding a ceramic coffee mug with rising steam ripples
 * - 💡 thinking: Hand on chin with a floating glowing idea lightbulb
 * - 🎮 gaming: Holding a retro handheld console
 * - 📚 reading: Holding an open book
 * - 🌸 meditating: Floating in serene zen meditation
 * - 🚶 walking: Pathing between district landmarks
 * - 🧍 idle: Breathing and observing the city
 * - 💤 sleeping: Cozy futon bedroll with pillow and z particles
 */

import {
  TILE_WIDTH,
  TILE_HEIGHT,
  TOTAL_WORLD_WIDTH,
  TOTAL_WORLD_HEIGHT,
} from '@spot/world';
import { AVATAR_CATALOG } from '../canvas/avatars.js';
import type { SpriteManager } from './sprite-manager.js';
import type { OccupiedSpotSummary } from '@spot/shared';

export type CitizenActivityMode =
  | 'idle'
  | 'walking'
  | 'working'
  | 'having_coffee'
  | 'thinking'
  | 'gaming'
  | 'reading'
  | 'meditating'
  | 'sleeping';

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
  state: CitizenActivityMode;
  frame: number;
  animTimer: number;
  pauseTimer: number;
  isMoving: boolean;
  sleepParticles: SleepZ[];
  emote: EmoteBubble | null;
  emoteTimer: number;
  liveSpeech?: { text: string; age: number; maxAge: number } | null;
}

const MODES: CitizenActivityMode[] = [
  'working',
  'having_coffee',
  'thinking',
  'gaming',
  'reading',
  'meditating',
  'idle',
  'walking',
];

const MODE_LABELS: Record<CitizenActivityMode, string> = {
  working: '💻 Working',
  having_coffee: '☕ Having Coffee',
  thinking: '💡 Thinking',
  gaming: '🎮 Gaming',
  reading: '📚 Reading',
  meditating: '🌸 Meditating',
  idle: '✨ Exploring',
  walking: '🚶 Walking',
  sleeping: '💤 Resting',
};

export class MonumentManager {
  private entities = new Map<string, CitizenEntity>();
  private excludeCitizenId = '';
  private tick = 0;
  onCitizenClick?: (spot: OccupiedSpotSummary) => void;

  constructor(
    onCitizenClick?: (spot: OccupiedSpotSummary) => void,
    excludeCitizenId = '',
    _displayName?: string,
  ) {
    this.onCitizenClick = onCitizenClick;
    this.excludeCitizenId = excludeCitizenId;
  }

  setExcludeCitizen(id: string, _name?: string): void {
    this.excludeCitizenId = id;
  }

  update(spots: OccupiedSpotSummary[]): void {
    this.syncOccupiedSpots(spots);
  }

  syncLivePlayer(data: {
    citizenId: string;
    displayName: string;
    avatarId: string;
    wx: number;
    wy: number;
    direction: 'down' | 'up' | 'left' | 'right';
    state: string;
    speech?: string | null;
  }): void {
    if (!data.citizenId || data.citizenId === this.excludeCitizenId) return;

    let found = false;
    for (const ent of this.entities.values()) {
      if (ent.spot.citizenId === data.citizenId) {
        ent.targetWx = data.wx;
        ent.targetWy = data.wy;
        ent.direction = data.direction;
        ent.state = data.state as CitizenActivityMode;
        ent.isMoving = data.state === 'walking';
        ent.spot.isOnline = true;
        ent.pauseTimer = 600; // Keep alive under player control
        found = true;
        break;
      }
    }

    if (!found) {
      const key = `live_${data.citizenId}`;
      if (!this.entities.has(key)) {
        const liveEnt: CitizenEntity = {
          spot: {
            spotId: '0,0',
            x: Math.floor(data.wx / TILE_WIDTH),
            y: Math.floor(data.wy / TILE_HEIGHT),
            citizenId: data.citizenId,
            displayName: data.displayName,
            avatarId: data.avatarId || 'astronaut',
            isOnline: true,
            claimedAt: new Date().toISOString(),
          },
          wx: data.wx,
          wy: data.wy,
          targetWx: data.wx,
          targetWy: data.wy,
          direction: data.direction,
          state: data.state as CitizenActivityMode,
          frame: 0,
          animTimer: 0,
          pauseTimer: 600,
          isMoving: data.state === 'walking',
          sleepParticles: [],
          emote: null,
          emoteTimer: 0,
        };
        this.entities.set(key, liveEnt);
      } else {
        const liveEnt = this.entities.get(key)!;
        liveEnt.targetWx = data.wx;
        liveEnt.targetWy = data.wy;
        liveEnt.direction = data.direction;
        liveEnt.state = data.state as CitizenActivityMode;
        liveEnt.isMoving = data.state === 'walking';
        liveEnt.pauseTimer = 600;
      }
    }
  }

  syncOccupiedSpots(spots: OccupiedSpotSummary[]): void {
    const currentKeys = new Set<string>();

    for (const spot of spots) {
      if (spot.citizenId && spot.citizenId === this.excludeCitizenId) {
        continue;
      }

      const key = `${spot.x},${spot.y}`;
      currentKeys.add(key);

      const baseWx = spot.x * TILE_WIDTH + TILE_WIDTH / 2;
      const baseWy = spot.y * TILE_HEIGHT + TILE_HEIGHT;

      if (!this.entities.has(key)) {
        const rand = Math.random();
        let initialMode: CitizenActivityMode = 'idle';
        if (rand < 0.12) initialMode = 'sleeping';
        else if (rand < 0.28) initialMode = 'working';
        else if (rand < 0.44) initialMode = 'having_coffee';
        else if (rand < 0.58) initialMode = 'thinking';
        else if (rand < 0.70) initialMode = 'gaming';
        else if (rand < 0.82) initialMode = 'reading';
        else if (rand < 0.90) initialMode = 'meditating';

        const ent: CitizenEntity = {
          spot,
          wx: baseWx,
          wy: baseWy,
          targetWx: baseWx,
          targetWy: baseWy,
          direction: ['down', 'up', 'left', 'right'][Math.floor(Math.random() * 4)] as any,
          state: initialMode,
          frame: 0,
          animTimer: 0,
          pauseTimer: 1500 + Math.floor(Math.random() * 2500),
          isMoving: false,
          sleepParticles: [],
          emote: null,
          emoteTimer: Math.floor(Math.random() * 300),
        };
        this.entities.set(key, ent);
      } else {
        const ent = this.entities.get(key)!;
        ent.spot = spot;
      }
    }

    for (const key of this.entities.keys()) {
      if (!currentKeys.has(key)) {
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
      if (ent.emoteTimer > 500 + Math.random() * 500) {
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
      if (Math.random() < 0.001) {
        ent.state = 'having_coffee';
        ent.pauseTimer = 300;
      }
      return;
    }

    if (ent.liveSpeech) {
      ent.liveSpeech.age++;
      if (ent.liveSpeech.age >= ent.liveSpeech.maxAge) {
        ent.liveSpeech = null;
      }
    }

    // 1. Live remote multiplayer player fast interpolation
    if (ent.spot.isOnline && (Math.abs(ent.wx - ent.targetWx) > 0.5 || Math.abs(ent.wy - ent.targetWy) > 0.5)) {
      const dx = ent.targetWx - ent.wx;
      const dy = ent.targetWy - ent.wy;
      const dist = Math.hypot(dx, dy);

      if (dist > 180) {
        ent.wx = ent.targetWx;
        ent.wy = ent.targetWy;
        ent.isMoving = false;
      } else if (dist > 1.2) {
        const step = Math.min(dist, Math.max(3.8, dist * 0.45));
        ent.wx += (dx / dist) * step;
        ent.wy += (dy / dist) * step;
        ent.isMoving = true;
      } else {
        ent.wx = ent.targetWx;
        ent.wy = ent.targetWy;
        ent.isMoving = false;
      }

      ent.animTimer++;
      if (ent.animTimer >= 6) {
        ent.animTimer = 0;
        ent.frame = (ent.frame + 1) % 4;
      }
      return;
    }

    // 2. Offline AI Walking movement logic
    if (ent.isMoving && ent.state === 'walking') {
      const dx = ent.targetWx - ent.wx;
      const dy = ent.targetWy - ent.wy;
      const dist = Math.hypot(dx, dy);

      if (dist < 1.5) {
        ent.wx = ent.targetWx;
        ent.wy = ent.targetWy;
        ent.isMoving = false;
        ent.frame = 0;
        ent.pauseTimer = 180 + Math.floor(Math.random() * 240);
        // Switch to an active cozy mode when done walking
        const choices: CitizenActivityMode[] = ['working', 'having_coffee', 'thinking', 'gaming', 'reading', 'meditating', 'idle'];
        ent.state = choices[Math.floor(Math.random() * choices.length)];
      } else {
        const speed = 0.65;
        ent.wx += (dx / dist) * speed;
        ent.wy += (dy / dist) * speed;

        if (Math.abs(dx) > Math.abs(dy)) {
          ent.direction = dx > 0 ? 'right' : 'left';
        } else {
          ent.direction = dy > 0 ? 'down' : 'up';
        }

        ent.animTimer++;
        if (ent.animTimer >= 14) {
          ent.animTimer = 0;
          ent.frame = (ent.frame + 1) % 4;
        }
      }
      return;
    }

    // Stationary behavior in active mode
    ent.pauseTimer--;
    if (ent.pauseTimer <= 0) {
      const roll = Math.random();
      if (roll < 0.25) {
        // Start walking around their home plot area
        const baseWx = ent.spot.x * TILE_WIDTH + TILE_WIDTH / 2;
        const baseWy = ent.spot.y * TILE_HEIGHT + TILE_HEIGHT;
        const wanderR = 24;
        const targetX = baseWx + (Math.random() * wanderR * 2 - wanderR);
        const targetY = baseWy + (Math.random() * wanderR * 2 - wanderR);

        ent.targetWx = Math.max(16, Math.min(TOTAL_WORLD_WIDTH - 16, targetX));
        ent.targetWy = Math.max(16, Math.min(TOTAL_WORLD_HEIGHT - 16, targetY));
        ent.isMoving = true;
        ent.state = 'walking';
      } else {
        // Switch activity mode (calm, long duration ~35-75 seconds)
        const randomMode = MODES[Math.floor(Math.random() * MODES.length)];
        ent.state = randomMode;
        ent.pauseTimer = 2000 + Math.floor(Math.random() * 2400);
        if (Math.random() < 0.3) {
          ent.direction = ['down', 'up', 'left', 'right'][Math.floor(Math.random() * 4)] as any;
        }
      }
    }
  }

  private updateSleepParticles(ent: CitizenEntity): void {
    if (this.tick % 45 === 0 && ent.sleepParticles.length < 3) {
      ent.sleepParticles.push({
        x: ent.wx + (Math.random() * 6 - 3),
        y: ent.wy - 18,
        alpha: 1.0,
        scale: 0.8 + Math.random() * 0.4,
        seed: Math.random() * 10,
        age: 0,
      });
    }

    for (let i = ent.sleepParticles.length - 1; i >= 0; i--) {
      const p = ent.sleepParticles[i];
      p.age++;
      p.y -= 0.32;
      p.x += Math.sin(p.age * 0.09 + p.seed) * 0.3;
      p.alpha -= 0.012;

      if (p.alpha <= 0 || p.age > 90) {
        ent.sleepParticles.splice(i, 1);
      }
    }
  }

  hitTest(wx: number, wy: number): OccupiedSpotSummary | null {
    for (const ent of this.entities.values()) {
      // Tight precise hitbox around chibi character sprite
      const dx = Math.abs(wx - ent.wx);
      const dy = wy - ent.wy; // Head is vertically above feet
      if (dx < 7.5 && dy >= -18 && dy <= 4) {
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

    // Ground shadow
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

    // Name badge with live Activity Mode
    if (showNameTag) {
      this.renderCitizenBadge(ctx, sx, sy - 28 * z, z, ent.spot.displayName, ent.state);
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
    ctx.roundRect(sx - 5.5 * z, bodyY, 11 * z, 9.5 * z, 2.5 * z);
    ctx.fill();

    // Body trim stripe
    ctx.fillStyle = c.accent;
    ctx.fillRect(sx - 5.5 * z, bodyY + 7 * z, 11 * z, 2 * z);

    // --- Head ---
    const headY = bodyY - 8 * z + headBob;
    ctx.fillStyle = c.skin;
    ctx.beginPath();
    ctx.arc(sx, headY + 3.5 * z, 6.5 * z, 0, Math.PI * 2);
    ctx.fill();

    // --- Hair / Helmet ---
    ctx.fillStyle = c.secondary;
    if (avatarId === 'wizard') {
      ctx.beginPath();
      ctx.moveTo(sx - 8 * z, headY + 1 * z);
      ctx.lineTo(sx, headY - 10 * z);
      ctx.lineTo(sx + 8 * z, headY + 1 * z);
      ctx.closePath();
      ctx.fill();
    } else if (avatarId === 'robot') {
      ctx.fillRect(sx - 7 * z, headY - 3 * z, 14 * z, 7 * z);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(sx - 1 * z, headY - 8 * z, 2 * z, 5 * z);
    } else {
      ctx.beginPath();
      ctx.arc(sx, headY + 1 * z, 7 * z, Math.PI * 0.8, Math.PI * 2.2);
      ctx.fill();
    }

    // --- Eyes / Visor ---
    this.renderEyes(ctx, sx, headY + 3.5 * z, dir, z, avatarId);

    // ── ACTIVITY PROPS (Working Laptop, Steaming Coffee, Idea Bulb, etc.) ────
    this.renderActivityProp(ctx, ent, sx, bodyY, headY, z, c);
  }

  private renderActivityProp(
    ctx: CanvasRenderingContext2D,
    ent: CitizenEntity,
    sx: number,
    bodyY: number,
    headY: number,
    z: number,
    c: { primary: string; secondary: string; accent: string; skin: string },
  ): void {
    const dir = ent.direction;

    switch (ent.state) {
      // 💻 WORKING: Glowing Laptop with Typing Hands
      case 'working': {
        const lapX = dir === 'left' ? sx - 6 * z : (dir === 'right' ? sx + 6 * z : sx);
        const lapY = bodyY + 3 * z;

        // Open Laptop Base
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(lapX - 5 * z, lapY + 1 * z, 10 * z, 2.5 * z);

        // Glowing Screen
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(lapX - 4 * z, lapY - 4 * z, 8 * z, 5 * z);

        // Code Cursor / Code Lines
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(lapX - 2.5 * z, lapY - 2.5 * z, 3 * z, 1 * z);
        ctx.fillRect(lapX - 2.5 * z, lapY - 1 * z, 5 * z, 1 * z);

        // Hands typing
        ctx.fillStyle = c.skin;
        const typeBob = Math.sin(this.tick * 0.3) * 1 * z;
        ctx.fillRect(lapX - 4 * z, lapY + typeBob, 2 * z, 2 * z);
        ctx.fillRect(lapX + 2 * z, lapY - typeBob, 2 * z, 2 * z);
        break;
      }

      // ☕ HAVING COFFEE: Ceramic Mug with Animated Steam Swirls
      case 'having_coffee': {
        const mugX = dir === 'left' ? sx - 5 * z : (dir === 'right' ? sx + 5 * z : sx + 3 * z);
        const mugY = bodyY + 3 * z;

        // Mug Body
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.roundRect(mugX - 2.5 * z, mugY - 2.5 * z, 5 * z, 5 * z, 1 * z);
        ctx.fill();

        // Handle
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1 * z;
        ctx.beginPath();
        ctx.arc(mugX + 3 * z, mugY, 1.5 * z, 0, Math.PI * 2);
        ctx.stroke();

        // Steam Swirls (~ ~)
        const steam1 = Math.sin(this.tick * 0.1) * 1.5 * z;
        const steam2 = Math.cos(this.tick * 0.1) * 1.5 * z;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.lineWidth = 1.2 * z;
        ctx.beginPath();
        ctx.moveTo(mugX - 1 * z + steam1, mugY - 4 * z);
        ctx.quadraticCurveTo(mugX, mugY - 7 * z, mugX - 1 * z, mugY - 9 * z);
        ctx.moveTo(mugX + 1.5 * z + steam2, mugY - 4 * z);
        ctx.quadraticCurveTo(mugX + 2 * z, mugY - 7 * z, mugX + 1.5 * z, mugY - 9 * z);
        ctx.stroke();
        break;
      }

      // 💡 THINKING: Glowing Idea Bulb & Pondering
      case 'thinking': {
        const bulbX = sx + 5 * z;
        const bulbY = headY - 9 * z + Math.sin(this.tick * 0.08) * 1.5 * z;

        // Glowing Idea Bulb
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(bulbX, bulbY, 3.5 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(bulbX - 1.5 * z, bulbY + 2.5 * z, 3 * z, 2 * z);

        // Hand on chin
        ctx.fillStyle = c.skin;
        ctx.beginPath();
        ctx.arc(sx + 3 * z, headY + 5 * z, 1.8 * z, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      // 🎮 GAMING: Retro Handheld Game Boy
      case 'gaming': {
        const padX = sx;
        const padY = bodyY + 3.5 * z;

        // Console body
        ctx.fillStyle = '#6366f1';
        ctx.beginPath();
        ctx.roundRect(padX - 4 * z, padY - 3 * z, 8 * z, 6 * z, 1.5 * z);
        ctx.fill();

        // Pixel screen
        ctx.fillStyle = '#86efac';
        ctx.fillRect(padX - 2.5 * z, padY - 2 * z, 5 * z, 3 * z);

        // Hands holding console
        ctx.fillStyle = c.skin;
        ctx.fillRect(padX - 4.5 * z, padY - 1 * z, 1.8 * z, 3 * z);
        ctx.fillRect(padX + 2.7 * z, padY - 1 * z, 1.8 * z, 3 * z);
        break;
      }

      // 📚 READING: Open Leatherbound Book
      case 'reading': {
        const bookX = sx;
        const bookY = bodyY + 3 * z;

        // Leather cover
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.roundRect(bookX - 5.5 * z, bookY - 2 * z, 11 * z, 6 * z, 1 * z);
        ctx.fill();

        // White pages
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(bookX - 4.5 * z, bookY - 1.5 * z, 4 * z, 5 * z);
        ctx.fillRect(bookX + 0.5 * z, bookY - 1.5 * z, 4 * z, 5 * z);
        break;
      }

      // 🌸 MEDITATING: Zen Floating Serenity Aura
      case 'meditating': {
        // Floating glow ring underneath
        const auraY = bodyY + 9 * z;
        ctx.strokeStyle = 'rgba(244, 114, 182, 0.45)';
        ctx.lineWidth = 1.5 * z;
        ctx.beginPath();
        ctx.ellipse(sx, auraY, 9 * z, 3.5 * z, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
    }
  }

  private renderEyes(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    dir: 'down' | 'up' | 'left' | 'right',
    z: number,
    avatarId: string,
  ): void {
    if (dir === 'up') return;

    ctx.fillStyle = '#0f172a';
    if (avatarId === 'cyber') {
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(cx - 4 * z, cy - 1.5 * z, 8 * z, 3 * z);
      return;
    }

    if (dir === 'down') {
      ctx.fillRect(cx - 3.5 * z, cy - 1 * z, 2 * z, 2.5 * z);
      ctx.fillRect(cx + 1.5 * z, cy - 1 * z, 2 * z, 2.5 * z);
    } else if (dir === 'left') {
      ctx.fillRect(cx - 4.5 * z, cy - 1 * z, 2 * z, 2.5 * z);
    } else if (dir === 'right') {
      ctx.fillRect(cx + 2.5 * z, cy - 1 * z, 2 * z, 2.5 * z);
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
    // 1. Soft ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 12 * z, 5 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Sleeping Mat / Futon Base
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(sx - 11 * z, sy - 9 * z, 22 * z, 10 * z, 3 * z);
    ctx.fill();

    // 3. White Pillow
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(sx - 10 * z, sy - 9.5 * z, 8 * z, 6.5 * z, 2 * z);
    ctx.fill();

    // 4. Cozy Folded Quilt Blanket
    ctx.fillStyle = c.primary || '#3b82f6';
    ctx.beginPath();
    ctx.roundRect(sx - 3 * z, sy - 8.5 * z, 13 * z, 8.5 * z, 2.5 * z);
    ctx.fill();

    // White foldover sheet cuff
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx - 3 * z, sy - 8.5 * z, 3 * z, 8.5 * z);

    // 5. Chibi Head Resting on Pillow
    const headX = sx - 6.5 * z;
    const headY = sy - 6.5 * z;

    ctx.fillStyle = c.skin || '#fed7aa';
    ctx.beginPath();
    ctx.arc(headX, headY, 5 * z, 0, Math.PI * 2);
    ctx.fill();

    // Hair / Helmet
    ctx.fillStyle = c.secondary || '#1e293b';
    ctx.beginPath();
    ctx.arc(headX, headY - 1 * z, 5 * z, Math.PI * 0.7, Math.PI * 2.1);
    ctx.fill();

    // Closed peaceful sleeping eye arc
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.2 * z;
    ctx.beginPath();
    ctx.moveTo(headX - 1.5 * z, headY);
    ctx.lineTo(headX, headY - 1 * z);
    ctx.lineTo(headX + 1.5 * z, headY);
    ctx.stroke();

    // Cozy blush cheek
    ctx.fillStyle = 'rgba(244, 114, 182, 0.6)';
    ctx.beginPath();
    ctx.arc(headX + 1.5 * z, headY + 1.8 * z, 1.2 * z, 0, Math.PI * 2);
    ctx.fill();
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
      ctx.fillText('z', sx + (p.x - ent.wx) * z, sy - 18 * z + (p.y - ent.wy) * z);
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
    const pop = Math.min(1.0, emote.age / 10);
    const floatY = sy - Math.min(6, emote.age * 0.08) * z;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, (emote.maxAge - emote.age) / 20));

    // Bubble speech box
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(sx - 10 * z * pop, floatY - 9 * z * pop, 20 * z * pop, 18 * z * pop, 6 * z);
    ctx.fill();

    // Tail
    ctx.beginPath();
    ctx.moveTo(sx - 2 * z, floatY + 9 * z);
    ctx.lineTo(sx, floatY + 13 * z);
    ctx.lineTo(sx + 2 * z, floatY + 9 * z);
    ctx.fill();

    // Emote icon
    const icons: Record<string, string> = {
      heart: '❤️',
      coffee: '☕',
      sparkle: '✨',
      music: '🎵',
      bulb: '💡',
    };
    ctx.font = `${Math.round(11 * z * pop)}px 'Apple Color Emoji', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icons[emote.type] || '✨', sx, floatY);

    ctx.restore();
  }

  private renderCitizenBadge(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    z: number,
    name: string,
    state: CitizenActivityMode,
  ): void {
    ctx.save();
    const modeLabel = MODE_LABELS[state] || '✨ Citizen';
    const text = `${name} • ${modeLabel}`;
    ctx.font = `bold ${Math.round(9.5 * z)}px 'Outfit', sans-serif`;

    const textW = ctx.measureText(text).width;
    const badgeW = textW + 16 * z;
    const badgeH = 18 * z;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.beginPath();
    ctx.roundRect(sx - badgeW / 2, sy - badgeH / 2, badgeW, badgeH, 6 * z);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, sx, sy);

    ctx.restore();
  }
}
