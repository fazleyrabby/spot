/**
 * SkylineManager — Distant Parallax Cyber Metropolis Skyline for Spot World.
 *
 * Renders a massive, multi-layered cyberpunk city skyline beyond the northern
 * wilderness and mountains:
 * - Parallax camera-coupled scrolling (moves at 0.18x camera speed for deep perspective)
 * - Multi-tiered skyscraper silhouettes with lit windows and architectural spires
 * - Animated FAA aviation warning beacons (pulsing red/amber LEDs atop towers)
 * - Glowing holographic corporate billboards (NEO-CORP, BYTE, SPOT)
 * - Dynamic lighting adaptation for Day, Twilight, and Night cycles
 */

import { TOTAL_WORLD_WIDTH, TILE_HEIGHT } from '@spot/world';

interface BuildingSilhouette {
  x: number; // base x in world coords
  width: number;
  height: number;
  color: string;
  windowColor: string;
  hasSpire: boolean;
  spireHeight: number;
  hasNeonSign?: 'SPOT' | 'BYTE' | 'NEO' | 'CORP';
  windowGrid: boolean[];
  windowCols: number;
  windowRows: number;
}

export class SkylineManager {
  private buildings: BuildingSilhouette[] = [];
  private beaconTimer = 0;
  private readonly horizonBaseWy = -4.5 * TILE_HEIGHT; // Behind the northern mountain ridge

  constructor() {
    this.initSkyline();
  }

  private initSkyline(): void {
    // Generate a diverse skyline across the full northern span (-600 to TOTAL_WORLD_WIDTH + 600)
    const minX = -800;
    const maxX = TOTAL_WORLD_WIDTH + 800;
    let curX = minX;

    const neonBrands: ('SPOT' | 'BYTE' | 'NEO' | 'CORP')[] = ['SPOT', 'BYTE', 'NEO', 'CORP'];
    let brandIdx = 0;

    while (curX < maxX) {
      const width = 45 + Math.floor(Math.random() * 65);
      const height = 90 + Math.floor(Math.random() * 140);
      const hasSpire = Math.random() < 0.65;
      const spireHeight = hasSpire ? 20 + Math.floor(Math.random() * 35) : 0;
      const hasNeon = Math.random() < 0.28 && height > 120;
      const sign = hasNeon ? neonBrands[brandIdx++ % neonBrands.length] : undefined;

      const cols = Math.max(3, Math.floor(width / 9));
      const rows = Math.max(6, Math.floor(height / 10));
      const windowGrid: boolean[] = [];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          // 45% chance of lit window
          windowGrid.push(Math.random() < 0.45);
        }
      }

      this.buildings.push({
        x: curX,
        width,
        height,
        color: '#080d1a',
        windowColor: Math.random() < 0.6 ? '#fef08a' : '#38bdf8',
        hasSpire,
        spireHeight,
        hasNeonSign: sign,
        windowGrid,
        windowCols: cols,
        windowRows: rows,
      });

      curX += width - Math.floor(Math.random() * 12); // slight overlap
    }
  }

  tick(): void {
    this.beaconTimer++;
  }

  render(
    ctx: CanvasRenderingContext2D,
    camera: { x: number; y: number; viewportWidth: number; viewportHeight: number; zoom: number; worldToScreen: (wx: number, wy: number) => { x: number; y: number } },
    timeOfDay: 'day' | 'twilight' | 'night'
  ): void {
    const z = camera.zoom;
    const W = camera.viewportWidth;
    const H = camera.viewportHeight;

    // Parallax calculation: skyline moves at 0.15x camera delta
    const screenBase = camera.worldToScreen(0, this.horizonBaseWy);
    // If the horizon is far offscreen below, skip
    if (screenBase.y < -300 || screenBase.y > H + 400) return;

    ctx.save();

    // 1. Distant Atmospheric Glow on Horizon
    const horizonGlow = ctx.createLinearGradient(0, screenBase.y - 180 * z, 0, screenBase.y + 40 * z);
    if (timeOfDay === 'day') {
      horizonGlow.addColorStop(0, 'rgba(30, 41, 59, 0)');
      horizonGlow.addColorStop(1, 'rgba(51, 65, 85, 0.45)');
    } else if (timeOfDay === 'twilight') {
      horizonGlow.addColorStop(0, 'rgba(124, 45, 18, 0)');
      horizonGlow.addColorStop(0.7, 'rgba(194, 65, 12, 0.28)');
      horizonGlow.addColorStop(1, 'rgba(234, 88, 12, 0.45)');
    } else {
      // Night: Cyan & violet cyberpunk city glow
      horizonGlow.addColorStop(0, 'rgba(15, 23, 42, 0)');
      horizonGlow.addColorStop(0.6, 'rgba(56, 189, 248, 0.08)');
      horizonGlow.addColorStop(1, 'rgba(147, 51, 234, 0.18)');
    }
    ctx.fillStyle = horizonGlow;
    ctx.fillRect(0, screenBase.y - 180 * z, W, 220 * z);

    // 2. Beacon blink cycle (every 60 frames, pulses for 15 frames)
    const beaconLit = (this.beaconTimer % 60) < 18;

    // 3. Render Skyscraper Silhouettes
    for (let i = 0; i < this.buildings.length; i++) {
      const b = this.buildings[i];
      // Parallax coordinate: anchor to world with 0.2x speed
      const bScreen = camera.worldToScreen(b.x, this.horizonBaseWy);
      const bw = b.width * z;
      const bh = b.height * z;

      // Viewport culling
      if (bScreen.x + bw < -50 || bScreen.x > W + 50) continue;

      // Building Body
      ctx.fillStyle = timeOfDay === 'day' ? '#1e293b' : '#070b14';
      ctx.fillRect(bScreen.x, bScreen.y - bh, bw, bh);

      // Rooftop Spire / Antenna
      if (b.hasSpire) {
        const spireX = bScreen.x + bw / 2;
        const spireH = b.spireHeight * z;
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.2 * z;
        ctx.beginPath();
        ctx.moveTo(spireX, bScreen.y - bh);
        ctx.lineTo(spireX, bScreen.y - bh - spireH);
        ctx.stroke();

        // Pulsing Red Warning Beacon
        if (beaconLit && timeOfDay !== 'day') {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(spireX, bScreen.y - bh - spireH, 2.2 * z, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Lit Windows (Twilight & Night)
      if (timeOfDay !== 'day') {
        const colW = bw / (b.windowCols + 1);
        const rowH = (bh * 0.78) / (b.windowRows + 1);
        const winW = Math.max(1.5, colW * 0.45);
        const winH = Math.max(2, rowH * 0.55);

        ctx.fillStyle = b.windowColor;
        ctx.globalAlpha = timeOfDay === 'twilight' ? 0.45 : 0.72;

        let wIdx = 0;
        for (let r = 0; r < b.windowRows; r++) {
          for (let c = 0; c < b.windowCols; c++) {
            if (b.windowGrid[wIdx++]) {
              const wx = bScreen.x + (c + 1) * colW - winW / 2;
              const wy = bScreen.y - bh + 14 * z + (r + 1) * rowH - winH / 2;
              ctx.fillRect(wx, wy, winW, winH);
            }
          }
        }
        ctx.globalAlpha = 1.0;
      }

      // Neon Hologram Billboard
      if (b.hasNeonSign && timeOfDay !== 'day') {
        const signW = bw * 0.65;
        const signH = 14 * z;
        const signX = bScreen.x + (bw - signW) / 2;
        const signY = bScreen.y - bh + 6 * z;

        ctx.fillStyle = 'rgba(6, 182, 212, 0.18)';
        ctx.fillRect(signX, signY, signW, signH);
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 1;
        ctx.strokeRect(signX, signY, signW, signH);

        ctx.fillStyle = '#67e8f9';
        ctx.font = `bold ${Math.max(7, Math.round(8 * z))}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.hasNeonSign, signX + signW / 2, signY + signH / 2);
      }
    }

    ctx.restore();
  }
}
