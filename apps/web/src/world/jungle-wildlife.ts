/**
 * JungleWildlifeManager — Ambient animated creatures for the jungle flanks.
 * Spawns snakes, monkeys, frogs, deer, butterflies, and birds
 * in the western (gx -22..-2) and eastern (gx 101..122) jungle zones.
 */
import { TILE_WIDTH, TILE_HEIGHT } from '@spot/world';

export type WildlifeKind = 'snake' | 'monkey' | 'frog' | 'deer' | 'butterfly' | 'bird';

type WildlifeEntity = {
  id: string;
  kind: WildlifeKind;
  wx: number;
  wy: number;
  baseWx: number;
  baseWy: number;
  dir: 1 | -1;
  speed: number;
  phase: number;
  state: number; // generic animation state counter
};

function randBetween(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

export class JungleWildlifeManager {
  private entities: WildlifeEntity[] = [];
  private tick = 0;

  constructor() {
    // Western jungle (gx -22..-2)
    this.spawnZone(-22, -2, -2, 96);
    // Eastern jungle (gx 101..122)
    this.spawnZone(101, 122, -2, 96);
  }

  private spawnZone(gxMin: number, gxMax: number, gyMin: number, gyMax: number): void {
    // 4 snakes near creek areas
    for (let i = 0; i < 4; i++) {
      const gx = randBetween(gxMin + 2, gxMax - 2);
      const gy = randBetween(gyMin + 8, gyMax - 8);
      this.entities.push({
        id: `snake-${gxMin}_${i}`,
        kind: 'snake',
        wx: gx * TILE_WIDTH,
        wy: gy * TILE_HEIGHT,
        baseWx: gx * TILE_WIDTH,
        baseWy: gy * TILE_HEIGHT,
        dir: Math.random() > 0.5 ? 1 : -1,
        speed: 0.15 + Math.random() * 0.1,
        phase: Math.random() * Math.PI * 2,
        state: 0,
      });
    }
    // 3 monkeys near trees
    for (let i = 0; i < 3; i++) {
      const gx = randBetween(gxMin + 1, gxMax - 1);
      const gy = randBetween(gyMin + 5, gyMax - 12);
      this.entities.push({
        id: `monkey-${gxMin}_${i}`,
        kind: 'monkey',
        wx: gx * TILE_WIDTH,
        wy: gy * TILE_HEIGHT,
        baseWx: gx * TILE_WIDTH,
        baseWy: gy * TILE_HEIGHT,
        dir: Math.random() > 0.5 ? 1 : -1,
        speed: 0.6 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
        state: 0,
      });
    }
    // 3 frogs near water/creek
    for (let i = 0; i < 3; i++) {
      const gx = randBetween(gxMin + 3, gxMax - 3);
      const gy = randBetween(gyMin + 10, gyMax - 6);
      this.entities.push({
        id: `frog-${gxMin}_${i}`,
        kind: 'frog',
        wx: gx * TILE_WIDTH,
        wy: gy * TILE_HEIGHT,
        baseWx: gx * TILE_WIDTH,
        baseWy: gy * TILE_HEIGHT,
        dir: Math.random() > 0.5 ? 1 : -1,
        speed: 0.3 + Math.random() * 0.2,
        phase: Math.random() * Math.PI * 2,
        state: 0,
      });
    }
    // 2 deer on grass/dense areas
    for (let i = 0; i < 2; i++) {
      const gx = randBetween(gxMin + 4, gxMax - 4);
      const gy = randBetween(gyMin + 6, gyMax - 14);
      this.entities.push({
        id: `deer-${gxMin}_${i}`,
        kind: 'deer',
        wx: gx * TILE_WIDTH,
        wy: gy * TILE_HEIGHT,
        baseWx: gx * TILE_WIDTH,
        baseWy: gy * TILE_HEIGHT,
        dir: Math.random() > 0.5 ? 1 : -1,
        speed: 0.22 + Math.random() * 0.15,
        phase: Math.random() * Math.PI * 2,
        state: 0,
      });
    }
    // 5 butterflies floating above
    for (let i = 0; i < 5; i++) {
      const gx = randBetween(gxMin + 1, gxMax - 1);
      const gy = randBetween(gyMin + 4, gyMax - 10);
      this.entities.push({
        id: `butterfly-${gxMin}_${i}`,
        kind: 'butterfly',
        wx: gx * TILE_WIDTH,
        wy: gy * TILE_HEIGHT,
        baseWx: gx * TILE_WIDTH,
        baseWy: gy * TILE_HEIGHT,
        dir: Math.random() > 0.5 ? 1 : -1,
        speed: 0.3 + Math.random() * 0.25,
        phase: Math.random() * Math.PI * 2,
        state: 0,
      });
    }
    // 3 birds flying / perching
    for (let i = 0; i < 3; i++) {
      const gx = randBetween(gxMin + 2, gxMax - 2);
      const gy = randBetween(gyMin + 3, gyMax - 16);
      this.entities.push({
        id: `bird-${gxMin}_${i}`,
        kind: 'bird',
        wx: gx * TILE_WIDTH,
        wy: gy * TILE_HEIGHT,
        baseWx: gx * TILE_WIDTH,
        baseWy: gy * TILE_HEIGHT,
        dir: Math.random() > 0.5 ? 1 : -1,
        speed: 0.5 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
        state: 0,
      });
    }
  }

  update(): void {
    this.tick++;
    for (const e of this.entities) {
      switch (e.kind) {
        case 'snake':
          // Slither along ground, slow sinusoidal path
          e.wx += e.dir * e.speed;
          e.wy = e.baseWy + Math.sin(this.tick * 0.02 + e.phase) * 12;
          // reverse at bounds
          if (Math.abs(e.wx - e.baseWx) > TILE_WIDTH * 8) {
            e.dir = (e.dir === 1 ? -1 : 1) as 1 | -1;
          }
          break;

        case 'monkey':
          // Jump arc — periodic hop with gravity
          e.state += 0.04;
          if (e.state > Math.PI * 2) e.state -= Math.PI * 2;
          const jumpProgress = Math.sin(e.state + e.phase);
          // Move horizontally, jump vertically
          e.wx += e.dir * e.speed * 0.5;
          e.wy = e.baseWy - Math.abs(jumpProgress) * 18; // arc upward
          if (Math.abs(e.wx - e.baseWx) > TILE_WIDTH * 6) {
            e.dir = (e.dir === 1 ? -1 : 1) as 1 | -1;
            e.baseWx = e.wx;
          }
          break;

        case 'frog':
          // Hop — stay still, then sudden leap
          e.state++;
          if (e.state < 80) {
            // sitting still
            e.wy = e.baseWy + Math.sin(this.tick * 0.03 + e.phase) * 1;
          } else if (e.state < 90) {
            // leaping
            const leapT = (e.state - 80) / 10;
            e.wx += e.dir * e.speed * 4;
            e.wy = e.baseWy - Math.sin(leapT * Math.PI) * 14;
          } else {
            // landed — reset
            e.state = 0;
            e.baseWx = e.wx;
            e.baseWy = e.wy;
            if (Math.random() < 0.4) e.dir = (e.dir === 1 ? -1 : 1) as 1 | -1;
          }
          break;

        case 'deer':
          // Slow wander, occasional head lift (state > 100)
          e.wx += e.dir * e.speed;
          e.wy = e.baseWy + Math.sin(this.tick * 0.015 + e.phase) * 4;
          if (Math.abs(e.wx - e.baseWx) > TILE_WIDTH * 10) {
            e.dir = (e.dir === 1 ? -1 : 1) as 1 | -1;
          }
          e.state = (this.tick + Math.floor(e.phase * 100)) % 200;
          break;

        case 'butterfly':
          // Random flutter — figure-8 wobble
          e.wx += Math.sin(this.tick * 0.025 + e.phase) * e.speed * 0.8;
          e.wy += Math.cos(this.tick * 0.03 + e.phase * 1.3) * e.speed * 0.5;
          // drift back toward base
          e.wx += (e.baseWx - e.wx) * 0.002;
          e.wy += (e.baseWy - e.wy) * 0.002;
          break;

        case 'bird':
          // Fly across, then perch, then fly again
          e.state = (this.tick + Math.floor(e.phase * 200)) % 300;
          if (e.state < 180) {
            // flying
            e.wx += e.dir * e.speed;
            e.wy = e.baseWy + Math.sin(this.tick * 0.04 + e.phase) * 6;
            if (Math.abs(e.wx - e.baseWx) > TILE_WIDTH * 12) {
              e.dir = (e.dir === 1 ? -1 : 1) as 1 | -1;
            }
          } else {
            // perching — subtle bob
            e.wy = e.baseWy + Math.sin(this.tick * 0.02 + e.phase) * 1;
          }
          break;
      }
    }
  }

  getEntities(): WildlifeEntity[] { return this.entities; }

  render(ctx: CanvasRenderingContext2D, e: WildlifeEntity, sx: number, sy: number, z: number, tick: number): void {
    ctx.save();

    if (e.kind === 'snake') {
      // Sinusoidal snake body
      const len = 5;
      const segW = 2.5 * z, segH = 2 * z;
      for (let i = 0; i < len; i++) {
        const offX = -e.dir * i * 3 * z;
        const offY = Math.sin(tick * 0.06 + e.phase + i * 0.8) * 2.5 * z;
        ctx.fillStyle = i === 0 ? '#16a34a' : i < 2 ? '#22c55e' : '#4ade80';
        ctx.beginPath();
        ctx.ellipse(sx + offX, sy + offY, segW, segH, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Head — slightly larger with eye
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.ellipse(sx, sy, 3 * z, 2.5 * z, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(sx + e.dir * 1.5 * z, sy - 0.8 * z, 0.8 * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(sx + e.dir * 1.8 * z, sy - 0.8 * z, 0.4 * z, 0, Math.PI * 2);
      ctx.fill();
      // Tongue flick
      if (Math.sin(tick * 0.08 + e.phase) > 0.7) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 0.6 * z;
        ctx.beginPath();
        ctx.moveTo(sx + e.dir * 3 * z, sy);
        ctx.lineTo(sx + e.dir * 5.5 * z, sy - 1 * z);
        ctx.moveTo(sx + e.dir * 5.5 * z, sy - 1 * z);
        ctx.lineTo(sx + e.dir * 6 * z, sy - 0.5 * z);
        ctx.moveTo(sx + e.dir * 5.5 * z, sy - 1 * z);
        ctx.lineTo(sx + e.dir * 6 * z, sy - 1.5 * z);
        ctx.stroke();
      }
    } else if (e.kind === 'monkey') {
      const jumping = Math.abs(e.wy - e.baseWy) > 4;
      const bobY = jumping ? 0 : Math.sin(tick * 0.05 + e.phase) * 1.5 * z;

      // Body
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.ellipse(sx, sy + bobY, 4 * z, 5 * z, 0, 0, Math.PI * 2);
      ctx.fill();

      // Belly
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 1.5 * z + bobY, 2.8 * z, 3 * z, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.arc(sx, sy - 5.5 * z + bobY, 3.5 * z, 0, Math.PI * 2);
      ctx.fill();

      // Face
      ctx.fillStyle = '#fcd34d';
      ctx.beginPath();
      ctx.ellipse(sx + e.dir * 0.5 * z, sy - 5 * z + bobY, 2.2 * z, 2 * z, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(sx - 1 * z, sy - 5.8 * z + bobY, 0.7 * z, 0, Math.PI * 2);
      ctx.arc(sx + 1 * z, sy - 5.8 * z + bobY, 0.7 * z, 0, Math.PI * 2);
      ctx.fill();

      // Arms reaching (when jumping)
      if (jumping) {
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 1.5 * z;
        ctx.beginPath();
        ctx.moveTo(sx - 3 * z, sy - 2 * z + bobY);
        ctx.lineTo(sx - 6 * z, sy - 8 * z + bobY);
        ctx.moveTo(sx + 3 * z, sy - 2 * z + bobY);
        ctx.lineTo(sx + 6 * z, sy - 8 * z + bobY);
        ctx.stroke();
      }

      // Tail — curled
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 1.2 * z;
      ctx.beginPath();
      ctx.moveTo(sx - e.dir * 3 * z, sy + 2 * z + bobY);
      ctx.quadraticCurveTo(
        sx - e.dir * 8 * z, sy - 2 * z + bobY,
        sx - e.dir * 6 * z, sy - 6 * z + bobY,
      );
      ctx.stroke();
    } else if (e.kind === 'frog') {
      const sitting = e.state < 80;
      const hopY = sitting ? 0 : -Math.sin(((e.state - 80) / 10) * Math.PI) * 14 * z;

      // Body
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.ellipse(sx, sy + hopY, 4.5 * z, 3.5 * z, 0, 0, Math.PI * 2);
      ctx.fill();

      // Lighter belly
      ctx.fillStyle = '#86efac';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 1 * z + hopY, 3 * z, 2 * z, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eyes — big red-eyed tree frog style
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(sx - 2.5 * z, sy - 3 * z + hopY, 1.8 * z, 0, Math.PI * 2);
      ctx.arc(sx + 2.5 * z, sy - 3 * z + hopY, 1.8 * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(sx - 2.5 * z, sy - 3 * z + hopY, 0.8 * z, 0, Math.PI * 2);
      ctx.arc(sx + 2.5 * z, sy - 3 * z + hopY, 0.8 * z, 0, Math.PI * 2);
      ctx.fill();

      // Throat sac pulse (when sitting)
      if (sitting && Math.sin(tick * 0.04 + e.phase) > 0.6) {
        ctx.fillStyle = 'rgba(134, 239, 172, 0.6)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 2.5 * z + hopY, 3 * z, 2 * z, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Back legs
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.ellipse(sx - 4 * z, sy + 2 * z + hopY, 2 * z, 1.2 * z, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(sx + 4 * z, sy + 2 * z + hopY, 2 * z, 1.2 * z, 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'deer') {
      const headLift = e.state > 100 ? Math.sin((e.state - 100) / 20 * Math.PI) * 3 * z : 0;

      // Body
      ctx.fillStyle = '#a16207';
      ctx.beginPath();
      ctx.ellipse(sx, sy, 7 * z, 5 * z, 0, 0, Math.PI * 2);
      ctx.fill();

      // Lighter underbelly
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 2 * z, 5 * z, 2.5 * z, 0, 0, Math.PI * 2);
      ctx.fill();

      // Legs
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 1.5 * z;
      const legPhase = Math.sin(tick * 0.03 + e.phase) * 2 * z;
      // Front legs
      ctx.beginPath();
      ctx.moveTo(sx + 4 * z, sy + 3 * z);
      ctx.lineTo(sx + 4 * z + legPhase, sy + 10 * z);
      ctx.moveTo(sx + 2 * z, sy + 3 * z);
      ctx.lineTo(sx + 2 * z - legPhase, sy + 10 * z);
      ctx.stroke();
      // Back legs
      ctx.beginPath();
      ctx.moveTo(sx - 3 * z, sy + 3 * z);
      ctx.lineTo(sx - 3 * z - legPhase, sy + 10 * z);
      ctx.moveTo(sx - 5 * z, sy + 3 * z);
      ctx.lineTo(sx - 5 * z + legPhase, sy + 10 * z);
      ctx.stroke();

      // Neck
      ctx.fillStyle = '#a16207';
      ctx.beginPath();
      ctx.moveTo(sx + 5 * z, sy - 2 * z);
      ctx.lineTo(sx + 7 * z, sy - 10 * z - headLift);
      ctx.lineTo(sx + 9 * z, sy - 2 * z);
      ctx.closePath();
      ctx.fill();

      // Head
      ctx.fillStyle = '#a16207';
      ctx.beginPath();
      ctx.ellipse(sx + 7 * z, sy - 11 * z - headLift, 3 * z, 2.5 * z, 0.1, 0, Math.PI * 2);
      ctx.fill();

      // Snout
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.ellipse(sx + 9 * z, sy - 10.5 * z - headLift, 1.5 * z, 1.2 * z, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(sx + 6 * z, sy - 11.5 * z - headLift, 0.7 * z, 0, Math.PI * 2);
      ctx.fill();

      // Antlers
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1 * z;
      ctx.beginPath();
      ctx.moveTo(sx + 6 * z, sy - 13 * z - headLift);
      ctx.lineTo(sx + 4 * z, sy - 17 * z - headLift);
      ctx.lineTo(sx + 3 * z, sy - 15 * z - headLift);
      ctx.moveTo(sx + 4 * z, sy - 17 * z - headLift);
      ctx.lineTo(sx + 5 * z, sy - 19 * z - headLift);
      ctx.moveTo(sx + 8 * z, sy - 13 * z - headLift);
      ctx.lineTo(sx + 10 * z, sy - 17 * z - headLift);
      ctx.lineTo(sx + 11 * z, sy - 15 * z - headLift);
      ctx.moveTo(sx + 10 * z, sy - 17 * z - headLift);
      ctx.lineTo(sx + 9 * z, sy - 19 * z - headLift);
      ctx.stroke();

      // Tail
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.ellipse(sx - 7 * z, sy - 2 * z, 1.5 * z, 1 * z, -0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'butterfly') {
      const wingFlap = Math.sin(tick * 0.15 + e.phase * 3);
      const wingAngle = wingFlap * 0.6;

      // Wings
      const wingColor1 = `hsl(${(e.phase * 60) % 360}, 80%, 60%)`;
      const wingColor2 = `hsl(${(e.phase * 60 + 40) % 360}, 70%, 50%)`;

      ctx.fillStyle = wingColor1;
      // Left wing
      ctx.beginPath();
      ctx.ellipse(sx - 2.5 * z, sy - 1 * z, 3.5 * z * Math.cos(wingAngle), 2.5 * z, -0.3, 0, Math.PI * 2);
      ctx.fill();
      // Right wing
      ctx.beginPath();
      ctx.ellipse(sx + 2.5 * z, sy - 1 * z, 3.5 * z * Math.cos(wingAngle), 2.5 * z, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Inner wing spots
      ctx.fillStyle = wingColor2;
      ctx.beginPath();
      ctx.ellipse(sx - 2 * z, sy - 1 * z, 1.5 * z * Math.cos(wingAngle), 1.5 * z, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(sx + 2 * z, sy - 1 * z, 1.5 * z * Math.cos(wingAngle), 1.5 * z, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.ellipse(sx, sy, 0.8 * z, 2.5 * z, 0, 0, Math.PI * 2);
      ctx.fill();

      // Antennae
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 0.5 * z;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 2 * z);
      ctx.lineTo(sx - 2 * z, sy - 4.5 * z);
      ctx.moveTo(sx, sy - 2 * z);
      ctx.lineTo(sx + 2 * z, sy - 4.5 * z);
      ctx.stroke();
    } else if (e.kind === 'bird') {
      const flying = e.state < 180;
      const wingUp = flying ? Math.sin(tick * 0.12 + e.phase * 2) * 5 * z : 0;

      // Body
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.ellipse(sx, sy, 4 * z, 2.5 * z, flying ? e.dir * 0.1 : 0, 0, Math.PI * 2);
      ctx.fill();

      // Head
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(sx + e.dir * 4 * z, sy - 1 * z, 2 * z, 0, Math.PI * 2);
      ctx.fill();

      // Beak
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(sx + e.dir * 6 * z, sy - 1 * z);
      ctx.lineTo(sx + e.dir * 8 * z, sy - 0.5 * z);
      ctx.lineTo(sx + e.dir * 6 * z, sy + 0.5 * z);
      ctx.closePath();
      ctx.fill();

      // Eye
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(sx + e.dir * 4.5 * z, sy - 1.5 * z, 0.6 * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(sx + e.dir * 4.7 * z, sy - 1.5 * z, 0.3 * z, 0, Math.PI * 2);
      ctx.fill();

      // Wings
      if (flying) {
        ctx.fillStyle = '#64748b';
        // Upper wing
        ctx.beginPath();
        ctx.moveTo(sx - 1 * z, sy);
        ctx.quadraticCurveTo(sx - 2 * z, sy - 4 * z - wingUp, sx + 2 * z, sy - 2 * z - wingUp);
        ctx.closePath();
        ctx.fill();
        // Lower wing
        ctx.beginPath();
        ctx.moveTo(sx - 1 * z, sy);
        ctx.quadraticCurveTo(sx - 2 * z, sy + 4 * z + wingUp, sx + 2 * z, sy + 2 * z + wingUp);
        ctx.closePath();
        ctx.fill();
      }

      // Tail
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(sx - e.dir * 4 * z, sy);
      ctx.lineTo(sx - e.dir * 7 * z, sy - 2 * z);
      ctx.lineTo(sx - e.dir * 7 * z, sy + 2 * z);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}
