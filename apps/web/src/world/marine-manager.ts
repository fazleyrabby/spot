/**
 * MarineManager — Lightweight surf/ocean life for the cropped beach.
 * Spawns on gy 96..115 (surf + deep within -24..124 clipped world).
 * - 🦈 Sharks: patrol fins
 * - 🚤 Speedboats: fast E/W zippers with wake
 * - 🏄 Surfers: bobbing boards on wave line
 * - 🚢 Ships: distant freighters / cruise liners on deep horizon
 */
import { TILE_WIDTH, TILE_HEIGHT } from '@spot/world';

export type MarineEntity = {
  id: string;
  kind: 'shark' | 'speedboat' | 'surfer' | 'ship';
  wx: number;
  wy: number;
  dir: 1 | -1; // east / west
  speed: number;
  phase: number;
  hue?: string;
};

export class MarineManager {
  private entities: MarineEntity[] = [];
  private tick = 0;

  constructor() {
    // 3 sharks deep (gy 113..117) — shifted outside city
    for (let i = 0; i < 3; i++) {
      const gy = 113 + i * 2;
      this.entities.push({
        id: `shark-${i}`,
        kind: 'shark',
        wx: (8 + i * 32) * TILE_WIDTH,
        wy: gy * TILE_HEIGHT + TILE_HEIGHT * 0.5,
        dir: i % 2 === 0 ? 1 : -1,
        speed: 0.72 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2,
      });
    }
    // 2 speedboats on surf line (gy 108..109)
    for (let i = 0; i < 2; i++) {
      const gy = 108 + (i % 2);
      this.entities.push({
        id: `boat-${i}`,
        kind: 'speedboat',
        wx: (22 + i * 48) * TILE_WIDTH,
        wy: gy * TILE_HEIGHT + TILE_HEIGHT * 0.55,
        dir: i % 2 === 0 ? 1 : -1,
        speed: 2.2 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
      });
    }
    // 3 surfers bobbing (gy 108.6)
    for (let i = 0; i < 3; i++) {
      this.entities.push({
        id: `surfer-${i}`,
        kind: 'surfer',
        wx: (30 + i * 18) * TILE_WIDTH,
        wy: 108.6 * TILE_HEIGHT + (i % 2) * 8,
        dir: i % 2 === 0 ? 1 : -1,
        speed: 0.28 + Math.random() * 0.18,
        phase: Math.random() * Math.PI * 2,
      });
    }
    // 2 distant ships on deep horizon (gy 121..124)
    for (let i = 0; i < 2; i++) {
      const gy = 121 + i * 3;
      this.entities.push({
        id: `ship-${i}`,
        kind: 'ship',
        wx: (28 + i * 38) * TILE_WIDTH,
        wy: gy * TILE_HEIGHT + TILE_HEIGHT * 0.5,
        dir: 1 as const,
        speed: 0.12 + Math.random() * 0.10, // very slow drift; set to 0 to fully dock
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  update(): void {
    this.tick++;
    const minX = -22 * TILE_WIDTH;
    const maxX = 123 * TILE_WIDTH;
    for (const e of this.entities) {
      e.wx += e.dir * e.speed;
      if (e.wx < minX) { e.wx = maxX; }
      if (e.wx > maxX) { e.wx = minX; }
      // subtle vertical bob on wave
      if (e.kind === 'surfer') {
        e.wy += Math.sin(this.tick * 0.045 + e.phase) * 0.18;
      }
      if (e.kind === 'shark') {
        e.wy += Math.sin(this.tick * 0.02 + e.phase) * 0.12;
      }
      if (e.kind === 'ship') {
        e.wy += Math.sin(this.tick * 0.018 + e.phase) * 0.08;
      }
    }
  }

  getEntities(): MarineEntity[] { return this.entities; }

  render(ctx: CanvasRenderingContext2D, e: MarineEntity, sx: number, sy: number, z: number, tick: number): void {
    ctx.save();
    if (e.kind === 'shark') {
      const w = 30 * z, h = 10 * z;
      // larger wake / shadow for visibility on dark ocean #061325
      ctx.fillStyle = 'rgba(56, 189, 248, 0.32)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 6 * z, 22 * z, 5 * z, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(14, 165, 233, 0.22)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 9 * z, 32 * z, 7 * z, 0, 0, Math.PI * 2);
      ctx.fill();

      // subtle submerged body silhouette
      ctx.fillStyle = 'rgba(51, 65, 85, 0.75)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 1.5 * z, w * 0.52, 4.5 * z, 0, 0, Math.PI * 2);
      ctx.fill();

      // dorsal fin - high contrast slate + cyan edge
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(sx - w * 0.38, sy);
      ctx.lineTo(sx - w * 0.05, sy - h);
      ctx.lineTo(sx + w * 0.18, sy - h * 0.85);
      ctx.lineTo(sx + w * 0.28, sy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.2 * z;
      ctx.stroke();

      // fin highlight
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(sx - w * 0.08, sy - h * 0.9);
      ctx.lineTo(sx - w * 0.02, sy - h * 0.45);
      ctx.lineTo(sx + w * 0.06, sy - h * 0.55);
      ctx.closePath();
      ctx.fill();

      // tail flick
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.moveTo(sx - w * 0.48, sy + 1 * z);
      ctx.lineTo(sx - w * 0.38, sy - 1 * z);
      ctx.lineTo(sx - w * 0.32, sy + 2 * z);
      ctx.closePath();
      ctx.fill();

      // breach splash (more frequent + bigger)
      if (Math.sin(tick * 0.045 + e.phase) > 0.90) {
        ctx.fillStyle = 'rgba(224,242,254,0.85)';
        ctx.beginPath();
        ctx.arc(sx - w * 0.04, sy - h - 1 * z, 3.4 * z, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(224,242,254,0.45)';
        ctx.beginPath();
        ctx.arc(sx + 4 * z, sy - h + 1 * z, 2 * z, 0, Math.PI * 2);
        ctx.arc(sx - 5 * z, sy - h + 2 * z, 1.6 * z, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (e.kind === 'speedboat') {
      const hullW = 22 * z, hullH = 7 * z;
      // wake
      ctx.fillStyle = 'rgba(224,242,254,0.32)';
      const wakeX = e.dir === 1 ? sx - hullW * 0.8 : sx + hullW * 0.8;
      ctx.beginPath();
      ctx.moveTo(wakeX, sy);
      ctx.lineTo(wakeX - e.dir * 14 * z, sy - 3 * z);
      ctx.lineTo(wakeX - e.dir * 14 * z, sy + 3 * z);
      ctx.closePath();
      ctx.fill();
      // hull
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.roundRect(sx - hullW / 2, sy - hullH / 2, hullW, hullH, 2 * z);
      ctx.fill();
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 1 * z;
      ctx.stroke();
      // canopy / driver
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(sx - 3 * z, sy - hullH / 2 - 2 * z, 6 * z, 4 * z, 1 * z);
      ctx.fill();
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(sx - 1.2 * z, sy - hullH / 2 - 1 * z, 2.4 * z, 2 * z);
    } else if (e.kind === 'ship') {
      // distant freighter — larger for visibility despite horizon
      const s = 1.35;
      const hullW = 68 * z * s, hullH = 14 * z * s;
      const bob = Math.sin(tick * 0.018 + e.phase) * 0.7 * z;
      const y = sy + bob;
      // faint wake
      ctx.fillStyle = 'rgba(224,242,254,0.18)';
      ctx.beginPath();
      ctx.ellipse(sx, y + 5 * z, 36 * z * s, 4 * z * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // hull — dark slate matching city palette, low contrast for distance
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(sx - hullW / 2, y - hullH / 2, hullW, hullH, 2 * z);
      ctx.fill();
      ctx.strokeStyle = 'rgba(148,163,184,0.35)';
      ctx.lineWidth = 0.9 * z;
      ctx.stroke();
      // deck containers / bridge
      ctx.fillStyle = '#334155';
      ctx.fillRect(sx - hullW * 0.38, y - hullH / 2 - 6 * z * s, hullW * 0.42, 6 * z * s);
      ctx.fillStyle = '#475569';
      ctx.fillRect(sx + hullW * 0.18, y - hullH / 2 - 9 * z * s, 10 * z * s, 9 * z * s);
      // tiny bridge windows
      ctx.fillStyle = 'rgba(125,211,252,0.9)';
      ctx.fillRect(sx + hullW * 0.20, y - hullH / 2 - 7 * z * s, 3 * z * s, 2 * z * s);
      ctx.fillRect(sx + hullW * 0.24, y - hullH / 2 - 7 * z * s, 3 * z * s, 2 * z * s);
      // faint stack smoke puff
      if (Math.sin(tick * 0.03 + e.phase) > 0.92) {
        ctx.fillStyle = 'rgba(203,213,225,0.28)';
        ctx.beginPath();
        ctx.arc(sx + hullW * 0.12, y - hullH / 2 - 10 * z * s, 2.2 * z * s, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // surfer
      const boardW = 16 * z, boardH = 4 * z;
      const bob = Math.sin(tick * 0.045 + e.phase) * 1.2 * z;
      // board
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.ellipse(sx, sy + bob, boardW / 2, boardH / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#a16207';
      ctx.lineWidth = 1 * z;
      ctx.stroke();
      // surfer body
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(sx - 2 * z, sy - 8 * z + bob, 4 * z, 5 * z);
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(sx, sy - 10 * z + bob, 3 * z, 0, Math.PI * 2);
      ctx.fill();
      // arm
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(sx + 1 * z, sy - 5 * z + bob, 3 * z, 1.5 * z);
    }
    ctx.restore();
  }
}
