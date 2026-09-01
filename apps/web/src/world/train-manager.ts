/**
 * TrainManager — Autonomous High-Speed Metro / Shinkansen passing along the northern railway.
 *
 * Visual Features:
 * - 4-car streamlined bullet train with aerodynamic front nose
 * - Dual glowing warm yellow headlights casting forward cone beams
 * - Illuminated passenger windows with chibi passenger silhouettes
 * - Red rear tail lights
 * - Periodic automatic schedule (whooshes across every 35-45s)
 */

import { TILE_WIDTH, TILE_HEIGHT, TOTAL_WORLD_WIDTH } from '@spot/world';

export interface TrainCar {
  type: 'engine_front' | 'passenger' | 'engine_rear';
  width: number;
  height: number;
}

export class TrainManager {
  readonly trackGy = 5.5; // gy coordinate of the northern track
  readonly trackWy = 5.5 * TILE_HEIGHT;

  active = false;
  x = -600; // current train front x in world coordinates
  speed = 9.2; // fast passing speed in px per frame
  direction: 1 | -1 = 1; // 1 = west to east, -1 = east to west

  private cooldownTimer = 300; // initial delay ~5s
  private carLength = 85;
  private carGap = 4;
  private carHeight = 22;
  private totalCars = 4;

  tick(): void {
    if (!this.active) {
      this.cooldownTimer--;
      if (this.cooldownTimer <= 0) {
        this.spawnTrain();
      }
      return;
    }

    // Move train
    this.x += this.speed * this.direction;

    // Check if entire train has exited world bounds
    const totalTrainLength = this.totalCars * (this.carLength + this.carGap) + 120;
    if (this.direction === 1 && this.x > TOTAL_WORLD_WIDTH + totalTrainLength) {
      this.active = false;
      this.cooldownTimer = 1200 + Math.floor(Math.random() * 600); // 20-30s cooldown
    } else if (this.direction === -1 && this.x < -totalTrainLength) {
      this.active = false;
      this.cooldownTimer = 1200 + Math.floor(Math.random() * 600);
    }
  }

  private spawnTrain(): void {
    this.active = true;
    this.direction = Math.random() < 0.5 ? 1 : -1;
    const totalTrainLength = this.totalCars * (this.carLength + this.carGap) + 100;

    if (this.direction === 1) {
      this.x = -totalTrainLength;
    } else {
      this.x = TOTAL_WORLD_WIDTH + totalTrainLength;
    }
  }

  render(ctx: CanvasRenderingContext2D, screenY: number, camera: { worldToScreen: (wx: number, wy: number) => { x: number; y: number } }, zoom: number): void {
    if (!this.active) return;

    const z = zoom;
    const dir = this.direction;
    const ch = this.carHeight * z;
    const cl = this.carLength * z;
    const cg = this.carGap * z;

    ctx.save();

    for (let c = 0; c < this.totalCars; c++) {
      // Calculate world X of this car
      const carOffset = c * (this.carLength + this.carGap);
      const carWx = dir === 1 ? this.x - carOffset : this.x + carOffset;
      const screen = camera.worldToScreen(carWx, this.trackWy);

      const isLeadEngine = (dir === 1 && c === 0) || (dir === -1 && c === this.totalCars - 1);
      const isRearEngine = (dir === 1 && c === this.totalCars - 1) || (dir === -1 && c === 0);

      // Car shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.roundRect(screen.x - cl / 2, screen.y + 4 * z, cl, ch * 0.6, 4 * z);
      ctx.fill();

      // Main Train Body (Sleek Cyber Silver & Cyan Stripe)
      ctx.fillStyle = '#e2e8f0'; // Silver metallic
      ctx.beginPath();
      ctx.roundRect(screen.x - cl / 2, screen.y - ch / 2, cl, ch, 5 * z);
      ctx.fill();

      // Aerodynamic aerodynamic nose on front
      if (isLeadEngine) {
        ctx.fillStyle = '#0284c7';
        const noseDir = dir === 1 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(screen.x + (cl / 2) * noseDir, screen.y - ch / 2);
        ctx.lineTo(screen.x + (cl / 2 + 18 * z) * noseDir, screen.y);
        ctx.lineTo(screen.x + (cl / 2) * noseDir, screen.y + ch / 2);
        ctx.closePath();
        ctx.fill();

        // Dual Front Headlight Beams
        const headX = screen.x + (cl / 2 + 18 * z) * noseDir;
        const headY = screen.y;

        // Headlight glow
        const beamGrad = ctx.createRadialGradient(
          headX, headY, 2 * z,
          headX + (120 * z) * noseDir, headY, 90 * z
        );
        beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.7)');
        beamGrad.addColorStop(0.5, 'rgba(254, 240, 138, 0.25)');
        beamGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');

        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(headX, headY - 4 * z);
        ctx.lineTo(headX + (180 * z) * noseDir, headY - 45 * z);
        ctx.lineTo(headX + (180 * z) * noseDir, headY + 45 * z);
        ctx.lineTo(headX, headY + 4 * z);
        ctx.closePath();
        ctx.fill();

        // Bright bulb dot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(headX, headY - 2 * z, 2.5 * z, 0, Math.PI * 2);
        ctx.arc(headX, headY + 2 * z, 2.5 * z, 0, Math.PI * 2);
        ctx.fill();
      }

      // Red tail lights on rear
      if (isRearEngine) {
        const rearDir = dir === 1 ? -1 : 1;
        const tailX = screen.x + (cl / 2) * rearDir;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(tailX, screen.y - 3 * z, 2 * z, 0, Math.PI * 2);
        ctx.arc(tailX, screen.y + 3 * z, 2 * z, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cyber Cyan Racing Stripe along train body
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(screen.x - cl / 2, screen.y + 1 * z, cl, 3 * z);

      // Glowing Passenger Windows
      const windowCount = 5;
      const winW = (cl - 24 * z) / windowCount;
      for (let w = 0; w < windowCount; w++) {
        const wx = screen.x - cl / 2 + 12 * z + w * winW;
        ctx.fillStyle = 'rgba(56, 189, 248, 0.85)'; // glowing cyan window
        ctx.fillRect(wx, screen.y - ch / 2 + 3 * z, winW - 3 * z, 5 * z);

        // Chibi passenger silhouette
        if (w % 2 === 0) {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
          ctx.fillRect(wx + 2 * z, screen.y - ch / 2 + 4.5 * z, 2.5 * z, 3.5 * z);
        }
      }

      // Train roof AC vents
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(screen.x - cl / 4, screen.y - ch / 2 - 1.5 * z, cl / 2, 1.5 * z);
    }

    ctx.restore();
  }
}
