/**
 * TrainManager — Realistic 7-Car Autonomous Cyber Metro / Bullet Train passing along the northern railway.
 *
 * Visual Features:
 * - 7-car long streamlined train (Lead engine, 5 passenger cars, rear streamliner)
 * - Pantograph roof electrical couplers on coaches
 * - Realistic bogie wheel sets and gangway bellows between cars
 * - Dual glowing warm yellow headlights casting forward cone beams
 * - Illuminated cyan passenger windows with commuter silhouettes
 * - Red rear tail lights
 * - Spatial audio callback when train approaches
 */

import { TILE_HEIGHT, TOTAL_WORLD_WIDTH } from '@spot/world';

export class TrainManager {
  readonly trackGy = 5.5; // gy coordinate of the northern track
  readonly trackWy = 5.5 * TILE_HEIGHT;

  active = false;
  x = -800; // current train front x in world coordinates
  speed = 10.5; // realistic cruising speed
  direction: 1 | -1 = 1; // 1 = west to east, -1 = east to west

  onTrainApproach?: (proximity: number) => void;

  private cooldownTimer = 240; // initial delay ~4s
  private carLength = 100;
  private carGap = 6;
  private carHeight = 22;
  private totalCars = 7;

  tick(playerWy = 0): void {
    if (!this.active) {
      this.cooldownTimer--;
      if (this.cooldownTimer <= 0) {
        this.spawnTrain(playerWy);
      }
      return;
    }

    // Move train
    this.x += this.speed * this.direction;

    // Check if entire train has exited world bounds
    const totalTrainLength = this.totalCars * (this.carLength + this.carGap) + 160;
    if (this.direction === 1 && this.x > TOTAL_WORLD_WIDTH + totalTrainLength) {
      this.active = false;
      this.cooldownTimer = 1400 + Math.floor(Math.random() * 700); // 25-35s cooldown
    } else if (this.direction === -1 && this.x < -totalTrainLength) {
      this.active = false;
      this.cooldownTimer = 1400 + Math.floor(Math.random() * 700);
    }
  }

  private spawnTrain(playerWy: number): void {
    this.active = true;
    this.direction = Math.random() < 0.5 ? 1 : -1;
    const totalTrainLength = this.totalCars * (this.carLength + this.carGap) + 120;

    if (this.direction === 1) {
      this.x = -totalTrainLength;
    } else {
      this.x = TOTAL_WORLD_WIDTH + totalTrainLength;
    }

    // Calculate proximity to player (0.0 to 1.0)
    const distY = Math.abs(playerWy - this.trackWy);
    const proximity = Math.max(0.15, Math.min(1.0, 1.0 - distY / 1200));
    this.onTrainApproach?.(proximity);
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
      const carOffset = c * (this.carLength + this.carGap);
      const carWx = dir === 1 ? this.x - carOffset : this.x + carOffset;
      const screen = camera.worldToScreen(carWx, this.trackWy);

      const isLeadEngine = (dir === 1 && c === 0) || (dir === -1 && c === this.totalCars - 1);
      const isRearEngine = (dir === 1 && c === this.totalCars - 1) || (dir === -1 && c === 0);

      // 1. Under-car Bogie Wheel Sets
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(screen.x - cl / 2 + 10 * z, screen.y + ch / 2 - 2 * z, 14 * z, 4 * z);
      ctx.fillRect(screen.x + cl / 2 - 24 * z, screen.y + ch / 2 - 2 * z, 14 * z, 4 * z);

      // 2. Car Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
      ctx.beginPath();
      ctx.roundRect(screen.x - cl / 2, screen.y + 4 * z, cl, ch * 0.65, 4 * z);
      ctx.fill();

      // 3. Inter-car Gangway Accordion Rubber Bellows
      if (c < this.totalCars - 1) {
        const bellowsX = dir === 1 ? screen.x - cl / 2 - cg : screen.x + cl / 2;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(bellowsX, screen.y - ch / 2 + 3 * z, cg + 1, ch - 6 * z);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.2 * z;
        ctx.strokeRect(bellowsX, screen.y - ch / 2 + 3 * z, cg + 1, ch - 6 * z);
      }

      // 4. Main Train Body (Polished Silver & Titanium)
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.roundRect(screen.x - cl / 2, screen.y - ch / 2, cl, ch, 4 * z);
      ctx.fill();

      // Roof shading
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(screen.x - cl / 2 + 2 * z, screen.y - ch / 2, cl - 4 * z, 3 * z);

      // 5. Roof Pantograph Electrical Coupler (on cars 2 and 5)
      if (c === 1 || c === 4) {
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.8 * z;
        ctx.beginPath();
        ctx.moveTo(screen.x - 6 * z, screen.y - ch / 2);
        ctx.lineTo(screen.x, screen.y - ch / 2 - 6 * z);
        ctx.lineTo(screen.x + 6 * z, screen.y - ch / 2);
        ctx.stroke();

        ctx.strokeStyle = '#94a3b8';
        ctx.beginPath();
        ctx.moveTo(screen.x - 8 * z, screen.y - ch / 2 - 6 * z);
        ctx.lineTo(screen.x + 8 * z, screen.y - ch / 2 - 6 * z);
        ctx.stroke();
      }

      // 6. Aerodynamic Bullet Nose on Lead Engine
      if (isLeadEngine) {
        ctx.fillStyle = '#0284c7';
        const noseDir = dir === 1 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(screen.x + (cl / 2) * noseDir, screen.y - ch / 2);
        ctx.lineTo(screen.x + (cl / 2 + 24 * z) * noseDir, screen.y);
        ctx.lineTo(screen.x + (cl / 2) * noseDir, screen.y + ch / 2);
        ctx.closePath();
        ctx.fill();

        // Dual Headlight Beams
        const headX = screen.x + (cl / 2 + 24 * z) * noseDir;
        const headY = screen.y;

        const beamGrad = ctx.createRadialGradient(
          headX, headY, 2 * z,
          headX + (140 * z) * noseDir, headY, 110 * z
        );
        beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.75)');
        beamGrad.addColorStop(0.5, 'rgba(254, 240, 138, 0.28)');
        beamGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');

        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(headX, headY - 4 * z);
        ctx.lineTo(headX + (220 * z) * noseDir, headY - 55 * z);
        ctx.lineTo(headX + (220 * z) * noseDir, headY + 55 * z);
        ctx.lineTo(headX, headY + 4 * z);
        ctx.closePath();
        ctx.fill();

        // Glowing white LED bulbs
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(headX, headY - 2.5 * z, 2.5 * z, 0, Math.PI * 2);
        ctx.arc(headX, headY + 2.5 * z, 2.5 * z, 0, Math.PI * 2);
        ctx.fill();
      }

      // 7. Red Tail Lights on Rear Engine
      if (isRearEngine) {
        const rearDir = dir === 1 ? -1 : 1;
        const tailX = screen.x + (cl / 2) * rearDir;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(tailX, screen.y - 3.5 * z, 2.5 * z, 0, Math.PI * 2);
        ctx.arc(tailX, screen.y + 3.5 * z, 2.5 * z, 0, Math.PI * 2);
        ctx.fill();
      }

      // 8. Cyber Blue Racing Stripe
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(screen.x - cl / 2, screen.y + 1 * z, cl, 3 * z);

      // 9. Illuminated Passenger Windows with silhouettes
      const windowCount = 6;
      const winW = (cl - 28 * z) / windowCount;
      for (let w = 0; w < windowCount; w++) {
        const wx = screen.x - cl / 2 + 14 * z + w * winW;
        ctx.fillStyle = 'rgba(56, 189, 248, 0.88)';
        ctx.fillRect(wx, screen.y - ch / 2 + 3 * z, winW - 3 * z, 5 * z);

        if (w % 2 === 0) {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
          ctx.fillRect(wx + 2 * z, screen.y - ch / 2 + 4.5 * z, 2.5 * z, 3.5 * z);
        }
      }
    }

    ctx.restore();
  }
}
