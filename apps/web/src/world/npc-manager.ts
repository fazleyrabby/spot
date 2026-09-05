/**
 * NPCManager — Interactive Street NPCs, Turbo Coffee Speed Buffs & Waypoint Guidance.
 *
 * Featured NPCs:
 * - Kiro the Cyber Barista (Downtown, gx: 24, gy: 26): Grants 20-second Turbo Espresso speed boost (+40% speed)
 * - Professor Barnaby the Cartographer (Plaza, gx: 48, gy: 50): Shares grid lore & sets GPS to a random citizen spot
 */

import { TILE_WIDTH, TILE_HEIGHT } from '@spot/world';

export interface StreetNPC {
  id: string;
  name: string;
  title: string;
  district: string;
  dialogue: string;
  icon: string;
  gx: number;
  gy: number;
  wx: number;
  wy: number;
  color: string;
  interactRange: number;
  promptText: string;
}

export class NPCManager {
  readonly npcs: StreetNPC[] = [
    {
      id: 'kiro_barista',
      name: 'Kiro',
      title: 'Downtown Coffee Artisan',
      district: 'Downtown Cyber District',
      dialogue: 'A quiet roast for a busy night. Take a warm espresso with you before you continue across the metropolis.',
      icon: '☕',
      gx: 24,
      gy: 26,
      wx: 24 * TILE_WIDTH,
      wy: 26 * TILE_HEIGHT,
      color: '#00f0ff',
      interactRange: 90,
      promptText: '[E] Order Espresso ⚡',
    },
    {
      id: 'prof_barnaby',
      name: 'Barnaby',
      title: 'Metropolis Cartographer',
      district: 'Grand Central Plaza',
      dialogue: 'Every stone in this city was placed with purpose. Let me know if you seek coordinates to an uncharted quarter.',
      icon: '🧭',
      gx: 48,
      gy: 50,
      wx: 48 * TILE_WIDTH,
      wy: 50 * TILE_HEIGHT,
      color: '#f59e0b',
      interactRange: 90,
      promptText: '[E] Consult Cartographer',
    },
  ];

  // Steam particle pool for Kiro's cart
  private steamParticles: { x: number; y: number; vy: number; vx: number; alpha: number; size: number }[] = [];
  private animTick = 0;

  // Active Speed Boost State
  speedBoostRemainingFrames = 0; // 60 frames = 1s
  readonly SPEED_BOOST_MULTIPLIER = 1.45;

  onTalkToNPC?: (npc: StreetNPC) => void;
  onSpeedBoostActivated?: (seconds: number) => void;

  constructor() {
    this.initSteam();
  }

  private initSteam(): void {
    for (let i = 0; i < 15; i++) {
      this.steamParticles.push({
        x: (Math.random() - 0.5) * 12,
        y: -Math.random() * 20,
        vx: (Math.random() - 0.5) * 0.2,
        vy: -0.3 - Math.random() * 0.3,
        alpha: Math.random() * 0.7,
        size: 1.5 + Math.random() * 2.5,
      });
    }
  }

  tick(): void {
    this.animTick++;

    // Update Speed Boost Timer
    if (this.speedBoostRemainingFrames > 0) {
      this.speedBoostRemainingFrames--;
    }

    // Update steam particles
    for (const p of this.steamParticles) {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.012;
      p.size += 0.04;
      if (p.alpha <= 0 || p.y < -35) {
        p.x = (Math.random() - 0.5) * 10;
        p.y = 0;
        p.vx = (Math.random() - 0.5) * 0.2;
        p.vy = -0.3 - Math.random() * 0.3;
        p.alpha = 0.6 + Math.random() * 0.3;
        p.size = 1.5 + Math.random() * 1.5;
      }
    }
  }

  /**
   * Activate Turbo Espresso Buff for player (+40% speed for given seconds)
   */
  activateSpeedBoost(seconds = 20): void {
    this.speedBoostRemainingFrames = seconds * 60;
    this.onSpeedBoostActivated?.(seconds);
  }

  getSpeedMultiplier(): number {
    return this.speedBoostRemainingFrames > 0 ? this.SPEED_BOOST_MULTIPLIER : 1.0;
  }

  getNearestNPC(playerWx: number, playerWy: number): StreetNPC | null {
    for (const npc of this.npcs) {
      const dist = Math.hypot(playerWx - npc.wx, playerWy - npc.wy);
      if (dist <= npc.interactRange) {
        return npc;
      }
    }
    return null;
  }

  /* -------------------------------------------------------------------------- */
  /* Rendering                                                                  */
  /* -------------------------------------------------------------------------- */

  renderNPCs(
    ctx: CanvasRenderingContext2D,
    camera: { worldToScreen: (wx: number, wy: number) => { x: number; y: number }; zoom: number; viewportWidth: number; viewportHeight: number },
    playerWx: number,
    playerWy: number,
  ): void {
    const W = camera.viewportWidth;
    const H = camera.viewportHeight;
    const z = camera.zoom;

    for (const npc of this.npcs) {
      const screen = camera.worldToScreen(npc.wx, npc.wy);
      if (screen.x < -100 * z || screen.x > W + 100 * z || screen.y < -100 * z || screen.y > H + 100 * z) {
        continue;
      }

      const dist = Math.hypot(playerWx - npc.wx, playerWy - npc.wy);
      const isNearby = dist <= npc.interactRange;

      if (npc.id === 'kiro_barista') {
        this.renderKiro(ctx, screen.x, screen.y, z, isNearby);
      } else {
        this.renderBarnaby(ctx, screen.x, screen.y, z, isNearby);
      }
    }
  }

  private renderKiro(ctx: CanvasRenderingContext2D, sx: number, sy: number, z: number, isNearby: boolean): void {
    ctx.save();
    ctx.translate(sx, sy);

    // 1. Ground Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 2 * z, 18 * z, 8 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Neon Ramen/Coffee Street Cart
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-16 * z, -18 * z, 32 * z, 18 * z);
    ctx.strokeRect(-16 * z, -18 * z, 32 * z, 18 * z);

    // Cart Awning (Striped Cyan/Black)
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(-18 * z, -24 * z, 36 * z, 6 * z);
    ctx.fillStyle = '#090b10';
    for (let i = -18; i < 18; i += 9) {
      ctx.fillRect(i * z, -24 * z, 4.5 * z, 6 * z);
    }

    // Glowing Neon Coffee Sign
    ctx.fillStyle = '#fbbf24';
    ctx.font = `bold ${Math.round(8 * z)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('☕ KIRO', 0, -10 * z);

    // Steaming Espresso Pot
    ctx.fillStyle = '#64748b';
    ctx.fillRect(6 * z, -21 * z, 7 * z, 5 * z);

    // Render Steam Particles rising from coffee pot
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    for (const p of this.steamParticles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc((9 + p.x) * z, (-22 + p.y) * z, p.size * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. Kiro Character (Behind Cart)
    const bob = Math.sin(this.animTick * 0.08) * 1.5;
    ctx.fillStyle = '#f87171'; // Red bandana
    ctx.fillRect((-10) * z, (-34 + bob) * z, 8 * z, 3 * z);
    ctx.fillStyle = '#fed7aa'; // Face
    ctx.fillRect((-10) * z, (-31 + bob) * z, 8 * z, 7 * z);
    ctx.fillStyle = '#090b10'; // Eyes smiling
    ctx.fillRect((-8) * z, (-28 + bob) * z, 2 * z, 1 * z);
    ctx.fillRect((-4) * z, (-28 + bob) * z, 2 * z, 1 * z);
    ctx.fillStyle = '#0284c7'; // Apron
    ctx.fillRect((-11) * z, (-24 + bob) * z, 10 * z, 6 * z);

    // 4. Floating Interaction Pill
    if (isNearby) {
      this.renderInteractPrompt(ctx, 0, (-45 + bob) * z, '[E] Order Turbo Espresso ⚡', '#00f0ff', z);
    }

    ctx.restore();
  }

  private renderBarnaby(ctx: CanvasRenderingContext2D, sx: number, sy: number, z: number, isNearby: boolean): void {
    ctx.save();
    ctx.translate(sx, sy);

    const bob = Math.sin(this.animTick * 0.06) * 1.2;

    // 1. Ground Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 2 * z, 12 * z, 5 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Scholar Body (Vintage Coat & Scarf)
    ctx.fillStyle = '#78350f'; // Brown trench coat
    ctx.fillRect(-6 * z, (-16 + bob) * z, 12 * z, 16 * z);
    ctx.fillStyle = '#f59e0b'; // Gold scarf
    ctx.fillRect(-5 * z, (-18 + bob) * z, 10 * z, 4 * z);

    // 3. Head & Glasses
    ctx.fillStyle = '#fed7aa'; // Face
    ctx.fillRect(-5 * z, (-26 + bob) * z, 10 * z, 8 * z);
    ctx.fillStyle = '#94a3b8'; // Grey Scholar Hair
    ctx.fillRect(-6 * z, (-29 + bob) * z, 12 * z, 4 * z);
    // Glasses & eyes
    ctx.fillStyle = '#090b10';
    ctx.fillRect(-4 * z, (-24 + bob) * z, 3 * z, 2 * z);
    ctx.fillRect(1 * z, (-24 + bob) * z, 3 * z, 2 * z);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1;
    ctx.strokeRect(-4.5 * z, (-24.5 + bob) * z, 4 * z, 3 * z);
    ctx.strokeRect(0.5 * z, (-24.5 + bob) * z, 4 * z, 3 * z);

    // 4. Props: Magnifying Glass & Rolled Map Blueprint
    // Blueprint roll under arm
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-9 * z, (-14 + bob) * z, 4 * z, 10 * z);
    // Brass Magnifying Glass in hand
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(8 * z, (-16 + bob) * z, 4 * z, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(6 * z, (-13 + bob) * z);
    ctx.lineTo(4 * z, (-9 + bob) * z);
    ctx.stroke();

    // 5. Floating Interaction Pill
    if (isNearby) {
      this.renderInteractPrompt(ctx, 0, (-40 + bob) * z, '[E] Talk to Cartographer 🧭', '#f59e0b', z);
    }

    ctx.restore();
  }

  private renderInteractPrompt(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    text: string,
    accentColor: string,
    z: number,
  ): void {
    ctx.save();
    ctx.font = `bold ${Math.max(10, Math.round(11 * z))}px 'Outfit', sans-serif`;
    const textW = ctx.measureText(text).width;
    const pillW = textW + 16 * z;
    const pillH = 22 * z;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    ctx.roundRect(x - pillW / 2, y - pillH / 2, pillW, pillH, 6 * z);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }
}
