/**
 * PetCompanionManager — Procedural Follower Pet Companions for Spot World.
 *
 * Supported Pets:
 * - 🐕 cyber_shibe: Golden shiba inu with cyan cyber-goggles, wagging tail, & running trot
 * - 🐱 pixel_cat: Midnight cat with emerald eyes, neon collar, & curling tail
 * - 🤖 droid_bob: Spherical floating robot with pulsing optic & ion propulsion spark
 * - 🦊 red_panda: Cozy striped bushy tail waddler
 *
 * Features:
 * - Trailing spring physics behind the player
 * - Squash-and-stretch trot & sit idle modes
 * - Emote bubbles (heart, sparkle, snooze)
 * - Click to pet with interactive sound & hearts
 */

import type { Camera } from './camera.js';
import type { PlayerManager } from './player-manager.js';

export type PetType = 'cyber_shibe' | 'pixel_cat' | 'droid_bob' | 'red_panda';

export interface PetDefinition {
  id: PetType;
  name: string;
  glyph: string;
  title: string;
  primaryColor: string;
  accentColor: string;
}

export const PET_CATALOG: PetDefinition[] = [
  {
    id: 'cyber_shibe',
    name: 'Shibe-01',
    glyph: '🐕',
    title: 'Cyber Shiba Companion',
    primaryColor: '#e0a96d',
    accentColor: '#00f0ff',
  },
  {
    id: 'pixel_cat',
    name: 'Kuro',
    glyph: '🐱',
    title: 'Midnight Pixel Cat',
    primaryColor: '#1e293b',
    accentColor: '#10b981',
  },
  {
    id: 'droid_bob',
    name: 'Bob-8',
    glyph: '🤖',
    title: 'Floating Recon Droid',
    primaryColor: '#94a3b8',
    accentColor: '#38bdf8',
  },
  {
    id: 'red_panda',
    name: 'Pabu',
    glyph: '🦊',
    title: 'Panda Adventurer',
    primaryColor: '#d97706',
    accentColor: '#fde68a',
  },
];

interface EmoteParticle {
  type: 'heart' | 'spark' | 'z';
  x: number;
  y: number;
  alpha: number;
  scale: number;
  age: number;
  maxAge: number;
}

export class PetCompanionManager {
  private player: PlayerManager;
  private currentPetId: PetType = 'cyber_shibe';
  private enabled = true;

  // Pet world coords
  wx: number;
  wy: number;
  targetWx: number;
  targetWy: number;

  direction: 'left' | 'right' = 'right';
  state: 'idle' | 'walking' | 'sitting' = 'idle';

  private walkFrame = 0;
  private animTimer = 0;
  private idleTimer = 0;
  private tickCount = 0;
  private particles: EmoteParticle[] = [];

  constructor(player: PlayerManager) {
    this.player = player;
    this.wx = player.wx - 24;
    this.wy = player.wy;
    this.targetWx = this.wx;
    this.targetWy = this.wy;

    try {
      const saved = localStorage.getItem('spot_pet_companion');
      if (saved && PET_CATALOG.some((p) => p.id === saved)) {
        this.currentPetId = saved as PetType;
      }
      const savedEnabled = localStorage.getItem('spot_pet_enabled');
      if (savedEnabled !== null) {
        this.enabled = savedEnabled === 'true';
      }
    } catch (_) {}
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get pet(): PetDefinition {
    return PET_CATALOG.find((p) => p.id === this.currentPetId) || PET_CATALOG[0];
  }

  setPet(id: PetType): void {
    if (!PET_CATALOG.some((p) => p.id === id)) return;
    this.currentPetId = id;
    try {
      localStorage.setItem('spot_pet_companion', id);
    } catch (_) {}
    this.spawnEmote('spark');
  }

  toggleEnabled(): boolean {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem('spot_pet_enabled', String(this.enabled));
    } catch (_) {}
    return this.enabled;
  }

  petInteraction(): void {
    this.spawnEmote('heart');
    this.spawnEmote('heart');
    this.state = 'idle';
    this.idleTimer = 0;
  }

  spawnEmote(type: 'heart' | 'spark' | 'z'): void {
    this.particles.push({
      type,
      x: this.wx + (Math.random() * 8 - 4),
      y: this.wy - 18,
      alpha: 1,
      scale: 0.8 + Math.random() * 0.4,
      age: 0,
      maxAge: 45,
    });
  }

  hitTest(worldX: number, worldY: number): boolean {
    if (!this.enabled) return false;
    return Math.hypot(worldX - this.wx, worldY - (this.wy - 8)) < 16;
  }

  tick(): void {
    if (!this.enabled) return;
    this.tickCount++;

    // Calculate trailing anchor behind player direction
    let offsetX = 0;
    let offsetY = 0;
    const followDist = 26;

    switch (this.player.direction) {
      case 'down':
        offsetY = -followDist;
        offsetX = 12;
        break;
      case 'up':
        offsetY = followDist;
        offsetX = -12;
        break;
      case 'left':
        offsetX = followDist;
        offsetY = 4;
        break;
      case 'right':
        offsetX = -followDist;
        offsetY = 4;
        break;
    }

    this.targetWx = this.player.wx + offsetX;
    this.targetWy = this.player.wy + offsetY;

    const dx = this.targetWx - this.wx;
    const dy = this.targetWy - this.wy;
    const dist = Math.hypot(dx, dy);

    if (dist > 8) {
      this.state = 'walking';
      this.idleTimer = 0;
      this.direction = dx >= 0 ? 'right' : 'left';

      // Catch-up spring physics
      const speed = Math.min(dist * 0.16, 5.2);
      this.wx += (dx / dist) * speed;
      this.wy += (dy / dist) * speed;

      this.animTimer++;
      if (this.animTimer >= 6) {
        this.animTimer = 0;
        this.walkFrame = (this.walkFrame + 1) % 4;
      }
    } else {
      this.idleTimer++;
      if (this.idleTimer > 120) {
        this.state = 'sitting';
      } else {
        this.state = 'idle';
      }
    }

    // Occasional idle emote
    if (this.tickCount % 600 === 0 && Math.random() < 0.6) {
      this.spawnEmote(this.state === 'sitting' ? 'z' : 'heart');
    }

    // Update floating emote particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age++;
      p.y -= 0.6;
      p.alpha = Math.max(0, 1 - p.age / p.maxAge);
      if (p.age >= p.maxAge) {
        this.particles.splice(i, 1);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (!this.enabled) return;

    const screen = camera.worldToScreen(this.wx, this.wy);
    const z = camera.zoom;
    const sx = screen.x;
    const sy = screen.y;

    // Viewport cull check
    if (
      sx < -40 ||
      sx > camera.viewportWidth + 40 ||
      sy < -40 ||
      sy > camera.viewportHeight + 40
    ) {
      return;
    }

    ctx.save();

    // 1. Soft Contact Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.beginPath();
    const shadowW = (this.state === 'sitting' ? 14 : 12) * z;
    const shadowH = 5 * z;
    ctx.ellipse(sx, sy, shadowW, shadowH, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Pet Sprite Drawing
    const isFacingLeft = this.direction === 'left';
    ctx.translate(sx, sy);
    if (isFacingLeft) {
      ctx.scale(-1, 1);
    }

    const bob =
      this.state === 'walking'
        ? Math.sin(this.walkFrame * Math.PI * 0.5) * 2 * z
        : this.state === 'sitting'
        ? 1.5 * z
        : Math.sin(this.tickCount * 0.08) * 1 * z;

    switch (this.currentPetId) {
      case 'cyber_shibe':
        this.drawShiba(ctx, z, bob);
        break;
      case 'pixel_cat':
        this.drawCat(ctx, z, bob);
        break;
      case 'droid_bob':
        this.drawDroid(ctx, z, bob);
        break;
      case 'red_panda':
        this.drawRedPanda(ctx, z, bob);
        break;
    }

    ctx.restore();

    // 3. Render Floating Emotes
    for (const p of this.particles) {
      const pScreen = camera.worldToScreen(p.x, p.y);
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.font = `${Math.round(11 * z * p.scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const symbol = p.type === 'heart' ? '💖' : p.type === 'spark' ? '✨' : '💤';
      ctx.fillText(symbol, pScreen.x, pScreen.y);
      ctx.restore();
    }
  }

  private drawShiba(ctx: CanvasRenderingContext2D, z: number, bob: number): void {
    const fur = '#e0a96d';
    const belly = '#fff8e7';
    const visor = '#00f0ff';
    const collar = '#ef4444';

    // Body
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.ellipse(0, -7 * z + bob, 8 * z, 6 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cream Belly
    ctx.fillStyle = belly;
    ctx.beginPath();
    ctx.ellipse(1 * z, -5.5 * z + bob, 5 * z, 4 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.arc(6 * z, -12 * z + bob, 5.5 * z, 0, Math.PI * 2);
    ctx.fill();

    // Pointed Ears
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.moveTo(3 * z, -15 * z + bob);
    ctx.lineTo(5 * z, -20 * z + bob);
    ctx.lineTo(7 * z, -15 * z + bob);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(7 * z, -15 * z + bob);
    ctx.lineTo(9 * z, -19 * z + bob);
    ctx.lineTo(11 * z, -14 * z + bob);
    ctx.fill();

    // Red Collar
    ctx.fillStyle = collar;
    ctx.fillRect(4 * z, -9 * z + bob, 3 * z, 1.8 * z);

    // Cyan Cyber-Visor
    ctx.fillStyle = visor;
    ctx.shadowColor = visor;
    ctx.shadowBlur = 6 * z;
    ctx.fillRect(7 * z, -13.5 * z + bob, 4.5 * z, 2.2 * z);
    ctx.shadowBlur = 0;

    // Snout
    ctx.fillStyle = belly;
    ctx.beginPath();
    ctx.ellipse(10.5 * z, -11 * z + bob, 2.5 * z, 2 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(11.5 * z, -12 * z + bob, 1.5 * z, 1.2 * z); // nose

    // Wagging Curled Tail
    const tailWag = Math.sin(this.tickCount * 0.25) * 3 * z;
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.arc(-7 * z + tailWag, -11 * z + bob, 3.5 * z, 0, Math.PI * 2);
    ctx.fill();

    // Legs with cream socks
    ctx.fillStyle = fur;
    const legOffset = this.state === 'walking' ? Math.sin(this.walkFrame * Math.PI) * 2 * z : 0;
    ctx.fillRect(-4 * z - legOffset, -2 * z, 2.5 * z, 3 * z);
    ctx.fillRect(3 * z + legOffset, -2 * z, 2.5 * z, 3 * z);
    ctx.fillStyle = belly;
    ctx.fillRect(-4 * z - legOffset, 0 * z, 2.5 * z, 1.2 * z);
    ctx.fillRect(3 * z + legOffset, 0 * z, 2.5 * z, 1.2 * z);
  }

  private drawCat(ctx: CanvasRenderingContext2D, z: number, bob: number): void {
    // High-contrast Midnight Charcoal with luminous slate-blue contour
    const fur = '#1e2638';
    const furRim = '#475569';
    const chestWhite = '#f8fafc';
    const eyes = '#10b981'; // Luminous emerald
    const eyeHighlight = '#34d399';
    const innerEar = '#f43f5e'; // Vibrant neon rose
    const collar = '#f59e0b'; // Gold cyber-collar
    const bell = '#fde047'; // Glowing yellow-gold bell

    // Subtle luminous outline for total visibility on pitch-black surfaces
    ctx.strokeStyle = furRim;
    ctx.lineWidth = 1.2 * z;

    // 1. Body
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.ellipse(0, -6 * z + bob, 7 * z, 5 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 2. White Tuxedo Chest & Belly Patch (high contrast!)
    ctx.fillStyle = chestWhite;
    ctx.beginPath();
    ctx.ellipse(2 * z, -5 * z + bob, 3.8 * z, 3.2 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Head
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.arc(5 * z, -11 * z + bob, 5 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 4. Triangular Ears with Warm Inner Fluff
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.moveTo(2 * z, -14 * z + bob);
    ctx.lineTo(4 * z, -19 * z + bob);
    ctx.lineTo(6.5 * z, -14 * z + bob);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = innerEar;
    ctx.fillRect(3.2 * z, -17 * z + bob, 1.8 * z, 2.4 * z);

    // 5. White Muzzle & Cute Pink Nose
    ctx.fillStyle = chestWhite;
    ctx.beginPath();
    ctx.ellipse(7.5 * z, -10 * z + bob, 2.2 * z, 1.8 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fb7185';
    ctx.fillRect(8.5 * z, -10.8 * z + bob, 1.2 * z, 1 * z);

    // 6. Vibrant Gold Collar with Glowing Bell
    ctx.fillStyle = collar;
    ctx.fillRect(3.5 * z, -8 * z + bob, 3.5 * z, 1.6 * z);

    ctx.fillStyle = bell;
    ctx.shadowColor = bell;
    ctx.shadowBlur = 5 * z;
    ctx.beginPath();
    ctx.arc(5.2 * z, -6.6 * z + bob, 1.4 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 7. Large Glowing Emerald Eyes with Specular Sparkle
    ctx.fillStyle = eyes;
    ctx.shadowColor = eyeHighlight;
    ctx.shadowBlur = 6 * z;
    ctx.beginPath();
    ctx.ellipse(6.8 * z, -12 * z + bob, 1.4 * z, 1.8 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Specular eye glint (makes it look alive!)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(7.2 * z, -13 * z + bob, 0.8 * z, 0.8 * z);

    // 8. Sleek Tail Swish with White Dipped Tip
    const tailAng = Math.sin(this.tickCount * 0.15) * 0.4;
    ctx.strokeStyle = fur;
    ctx.lineWidth = 2.4 * z;
    ctx.beginPath();
    ctx.moveTo(-6 * z, -6 * z + bob);
    ctx.quadraticCurveTo(-11 * z, -12 * z + tailAng * 8 * z, -8 * z, -16 * z);
    ctx.stroke();

    // White dipped tail tip (stands out in dark mode!)
    ctx.fillStyle = chestWhite;
    ctx.beginPath();
    ctx.arc(-8 * z, -16 * z, 1.8 * z, 0, Math.PI * 2);
    ctx.fill();

    // 9. Legs with White "Mittens" / Socks
    const legOffset = this.state === 'walking' ? Math.sin(this.walkFrame * Math.PI) * 2 * z : 0;

    // Back leg (top fur, white paw)
    ctx.fillStyle = fur;
    ctx.fillRect(-3 * z - legOffset, -2 * z, 2.2 * z, 3 * z);
    ctx.fillStyle = chestWhite;
    ctx.fillRect(-3 * z - legOffset, 0 * z, 2.2 * z, 1.5 * z);

    // Front leg (top fur, white paw)
    ctx.fillStyle = fur;
    ctx.fillRect(3 * z + legOffset, -2 * z, 2.2 * z, 3 * z);
    ctx.fillStyle = chestWhite;
    ctx.fillRect(3 * z + legOffset, 0 * z, 2.2 * z, 1.5 * z);
  }

  private drawDroid(ctx: CanvasRenderingContext2D, z: number, _bob: number): void {
    const bodyColor = '#94a3b8';
    const eyeColor = '#38bdf8';
    const ringColor = '#0284c7';
    const floatY = -12 * z + Math.sin(this.tickCount * 0.1) * 3 * z;

    // Spherical Metal Chassis
    const grad = ctx.createRadialGradient(
      -2 * z,
      floatY - 2 * z,
      1 * z,
      0,
      floatY,
      8 * z
    );
    grad.addColorStop(0, '#f8fafc');
    grad.addColorStop(0.5, bodyColor);
    grad.addColorStop(1, '#475569');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, floatY, 7.5 * z, 0, Math.PI * 2);
    ctx.fill();

    // Equatorial Ring
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 1.5 * z;
    ctx.beginPath();
    ctx.ellipse(0, floatY, 8 * z, 2.5 * z, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Glowing Optical Sensor
    ctx.fillStyle = eyeColor;
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 8 * z;
    ctx.beginPath();
    ctx.arc(3 * z, floatY, 3 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(3.8 * z, floatY - 1 * z, 1.2 * z, 1.2 * z);
    ctx.shadowBlur = 0;

    // Little Antenna
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.2 * z;
    ctx.beginPath();
    ctx.moveTo(0, floatY - 7 * z);
    ctx.lineTo(0, floatY - 12 * z);
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, floatY - 12 * z, 1.2 * z, 0, Math.PI * 2);
    ctx.fill();

    // Ion Propulsion Glow
    ctx.fillStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.beginPath();
    const ionPulse = Math.sin(this.tickCount * 0.3) * 1.5 * z;
    ctx.ellipse(0, floatY + 8 * z, 3 * z, (3 + ionPulse) * z, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawRedPanda(ctx: CanvasRenderingContext2D, z: number, bob: number): void {
    const fur = '#d97706';
    const darkFur = '#78350f';
    const white = '#fef3c7';

    // Body
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.ellipse(0, -6.5 * z + bob, 7.5 * z, 5.5 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dark underbelly
    ctx.fillStyle = darkFur;
    ctx.beginPath();
    ctx.ellipse(1 * z, -4 * z + bob, 5 * z, 3.5 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.arc(5.5 * z, -11 * z + bob, 5.5 * z, 0, Math.PI * 2);
    ctx.fill();

    // White Cheeks & Brow
    ctx.fillStyle = white;
    ctx.fillRect(8 * z, -11 * z + bob, 2.5 * z, 2.5 * z);
    ctx.fillRect(5 * z, -14 * z + bob, 2 * z, 1.5 * z);

    // Big White Rounded Ears
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.arc(3 * z, -16 * z + bob, 2.5 * z, 0, Math.PI * 2);
    ctx.arc(8 * z, -16 * z + bob, 2.5 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = white;
    ctx.beginPath();
    ctx.arc(3 * z, -16 * z + bob, 1.2 * z, 0, Math.PI * 2);
    ctx.arc(8 * z, -16 * z + bob, 1.2 * z, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(6 * z, -11 * z + bob, 1.6 * z, 1.6 * z);

    // Thick Striped Ringed Tail
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.ellipse(-8 * z, -10 * z + bob, 6 * z, 3.5 * z, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Dark rings
    ctx.fillStyle = darkFur;
    ctx.fillRect(-10 * z, -12 * z + bob, 1.8 * z, 5 * z);
    ctx.fillRect(-6 * z, -11 * z + bob, 1.8 * z, 5 * z);

    // Legs with white mitten paws
    ctx.fillStyle = darkFur;
    const legOffset = this.state === 'walking' ? Math.sin(this.walkFrame * Math.PI) * 2 * z : 0;
    ctx.fillRect(-3 * z - legOffset, -2 * z, 2.5 * z, 3 * z);
    ctx.fillRect(3 * z + legOffset, -2 * z, 2.5 * z, 3 * z);
    ctx.fillStyle = white;
    ctx.fillRect(-3 * z - legOffset, 0 * z, 2.5 * z, 1.2 * z);
    ctx.fillRect(3 * z + legOffset, 0 * z, 2.5 * z, 1.2 * z);
  }
}
