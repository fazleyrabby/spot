/**
 * JungleWildlifeManager — Ambient animated creatures for the jungle flanks.
 * Spawns snakes, monkeys, frogs, deer, butterflies, and birds
 * in the western (gx -22..-2) and eastern (gx 101..122) jungle zones.
 */
import { TILE_WIDTH, TILE_HEIGHT } from '@spot/world';
import { getCityTileType } from './terrain-generator.js';

export type WildlifeKind =
  | 'snake'
  | 'python'
  | 'crocodile'
  | 'lion'
  | 'monkey'
  | 'frog'
  | 'deer'
  | 'butterfly'
  | 'bird';

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
    // 3 small snakes near creek areas (slim, quick)
    for (let i = 0; i < 3; i++) {
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
        speed: 0.2 + Math.random() * 0.12,
        phase: Math.random() * Math.PI * 2,
        state: 0,
      });
    }
    // 1 large python / anaconda (heavy, slow, thick body) coiled near dense jungle
    {
      const gx = randBetween(gxMin + 2, gxMax - 2);
      const gy = randBetween(gyMin + 8, gyMax - 8);
      this.entities.push({
        id: `python-${gxMin}`,
        kind: 'python',
        wx: gx * TILE_WIDTH,
        wy: gy * TILE_HEIGHT,
        baseWx: gx * TILE_WIDTH,
        baseWy: gy * TILE_HEIGHT,
        dir: Math.random() > 0.5 ? 1 : -1,
        speed: 0.08 + Math.random() * 0.05,
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

    // ── Creek line detection: crocodiles swim in it, lions drink on its banks ──
    const creekTiles: { gx: number; gy: number }[] = [];
    for (let gy = gyMin + 3; gy <= gyMax - 3; gy++) {
      for (let gx = gxMin + 2; gx <= gxMax - 2; gx++) {
        if (getCityTileType(gx, gy) === 'jungle_creek') creekTiles.push({ gx, gy });
      }
    }

    // 1–2 crocodiles resting in the creek water
    const crocCount = Math.min(2, Math.max(1, Math.floor(creekTiles.length / 120) + 1));
    for (let i = 0; i < crocCount; i++) {
      const c = creekTiles[Math.floor(Math.random() * creekTiles.length)];
      const drift = Math.random() > 0.5 ? 1 : -1;
      this.entities.push({
        id: `croc-${gxMin}_${i}`,
        kind: 'crocodile',
        wx: (c.gx + (drift > 0 ? 0.4 : -0.4)) * TILE_WIDTH,
        wy: c.gy * TILE_HEIGHT + TILE_HEIGHT * 0.5,
        baseWx: (c.gx + (drift > 0 ? 0.4 : -0.4)) * TILE_WIDTH,
        baseWy: c.gy * TILE_HEIGHT + TILE_HEIGHT * 0.5,
        dir: drift,
        speed: 0.05 + Math.random() * 0.03,
        phase: Math.random() * Math.PI * 2,
        state: Math.random() < 0.5 ? 0 : 160, // some start half-submerged
      });
    }

    // 2–3 lion pride members drinking at the creek bank, facing the water
    const lionCount = 2 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < lionCount; i++) {
      // find a bank tile adjacent to the creek that isn't water
      for (let attempt = 0; attempt < 40; attempt++) {
        const c = creekTiles[Math.floor(Math.random() * creekTiles.length)];
        const side = Math.random() > 0.5 ? 1 : -1;
        const bgx = c.gx + side;
        const bt = getCityTileType(bgx, c.gy);
        if (bt === 'jungle_grass' || bt === 'jungle_dense') {
          // face toward the water (opposite of the bank side we're on)
          const faceDir = side === 1 ? -1 : 1;
          this.entities.push({
            id: `lion-${gxMin}_${i}`,
            kind: 'lion',
            wx: bgx * TILE_WIDTH + TILE_WIDTH / 2,
            wy: c.gy * TILE_HEIGHT + TILE_HEIGHT * 0.5,
            baseWx: bgx * TILE_WIDTH + TILE_WIDTH / 2,
            baseWy: c.gy * TILE_HEIGHT + TILE_HEIGHT * 0.5,
            dir: faceDir as 1 | -1,
            speed: 0,
            phase: i * 0.8 + Math.random(),
            state: Math.floor(Math.random() * 240),
          });
          break;
        }
      }
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

        case 'python':
          // Big constrictor: heavy slow crawl with a deep side-to-side S-curl
          e.wx += e.dir * e.speed;
          e.wy = e.baseWy + Math.sin(this.tick * 0.012 + e.phase) * 22;
          if (Math.abs(e.wx - e.baseWx) > TILE_WIDTH * 14) {
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

        case 'crocodile':
          // Mostly at rest in the water: slow side-slip with a periodic
          // sink/submerge and gentle wake ripple. state drives the cycle.
          e.state = (this.tick * 0.3 + e.phase * 120) % 420;
          e.wx = e.baseWx + Math.sin(this.tick * 0.01 + e.phase) * TILE_WIDTH * 0.7;
          break;

        case 'lion':
          // Cycles: stand watch at the bank, dip head to drink, look around.
          e.state = (this.tick * 0.5 + e.phase * 160) % 600;
          e.wx = e.baseWx + Math.sin(this.tick * 0.008 + e.phase) * 2.5;
          e.wy = e.baseWy + Math.sin(this.tick * 0.012 + e.phase) * 1.2;
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

      // Never let an animal leave its jungle flank & step into the city grid.
      this.confineToJungle(e);
    }
  }

  /**
   * Hard-clamps every creature to the jungle flanks (west gx -24..-1, east gx 100..124).
   * Prevents long/wide bodies (pythons, snakes, deer wander paths) from spilling into the
   * 0..99 city grid no matter how far past their base they roam.
   */
  private confineToJungle(e: WildlifeEntity): void {
    const isWest = e.baseWx < 0;
    // Body length margin per kind so tails/heads can never cross the city border.
    const margin =
      e.kind === 'python' ? 2.6 :
      e.kind === 'snake' || e.kind === 'crocodile' ? 1.6 :
      e.kind === 'monkey' || e.kind === 'deer' || e.kind === 'frog' ? 1.1 :
      0.7;

    const minX = isWest ? -24 * TILE_WIDTH : (100 + margin) * TILE_WIDTH;
    const maxX = isWest ? -margin * TILE_WIDTH : 125 * TILE_WIDTH;

    if (e.wx < minX) {
      e.wx = minX;
      e.dir = 1;
    } else if (e.wx > maxX) {
      e.wx = maxX;
      e.dir = -1;
    }

    // Vertical band = the jungle strip itself (gy -2..99); below that is ocean/beach.
    const minY = -2 * TILE_HEIGHT;
    const maxY = 99 * TILE_HEIGHT + TILE_HEIGHT * 0.5;
    if (e.wy < minY) e.wy = minY;
    else if (e.wy > maxY) e.wy = maxY;
  }

  getEntities(): WildlifeEntity[] { return this.entities; }

  render(ctx: CanvasRenderingContext2D, e: WildlifeEntity, sx: number, sy: number, z: number, tick: number): void {
    ctx.save();

    if (e.kind === 'snake' || e.kind === 'python') {
      const isPython = e.kind === 'python';
      this.renderSerpent(ctx, e, sx, sy, z, tick, isPython);
    } else if (e.kind === 'crocodile') {
      // Submersion depth: sinks partially under the water line as it rests.
      const sub = Math.sin((e.state / 420) * Math.PI * 2);
      const submerged = sub > 0.1 ? Math.min(1, (sub - 0.1) * 2.2) : 0;
      const bodyY = sy + submerged * 3 * z;

      // Gentle wake on the water surface
      ctx.fillStyle = 'rgba(56, 189, 248, 0.10)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 3 * z, 22 * z, 7 * z, 0, 0, Math.PI * 2);
      ctx.fill();

      // Long low body (partly submerged)
      ctx.fillStyle = submerged > 0.5 ? 'rgba(28, 58, 32, 0.6)' : '#1c3a20';
      ctx.beginPath();
      ctx.ellipse(sx - e.dir * 3 * z, bodyY, 16 * z, 3.4 * z, 0, 0, Math.PI * 2);
      ctx.fill();

      // Belly underside edge
      ctx.fillStyle = submerged > 0.5 ? 'rgba(120, 150, 110, 0.4)' : '#78a06a';
      ctx.beginPath();
      ctx.ellipse(sx - e.dir * 3 * z, bodyY + 1.6 * z, 14 * z, 1.2 * z, 0, 0, Math.PI * 2);
      ctx.fill();

      // Bony ridge bumps down the spine
      ctx.fillStyle = submerged > 0.5 ? 'rgba(44, 82, 48, 0.7)' : '#2c5230';
      for (let i = -4; i <= 5; i++) {
        const bx = sx - e.dir * i * 2.6 * z;
        const by = bodyY - 2.6 * z - (i === 0 ? 0.8 * z : 0);
        ctx.beginPath();
        ctx.arc(bx, by, 1.1 * z, 0, Math.PI * 2);
        ctx.fill();
      }

      // Long tail sweeping out behind
      ctx.strokeStyle = submerged > 0.5 ? 'rgba(28, 58, 32, 0.55)' : '#1c3a20';
      ctx.lineWidth = 3 * z;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx - e.dir * 10 * z, bodyY);
      ctx.quadraticCurveTo(sx - e.dir * 20 * z, bodyY + 2 * z, sx - e.dir * 26 * z, bodyY - Math.sin(tick * 0.05 + e.phase) * 4 * z);
      ctx.stroke();
      ctx.lineCap = 'butt';

      // Raised snout + head knobs (always above water even when body sinks)
      const headY = bodyY - 3 * z;
      ctx.fillStyle = submerged > 0.5 ? '#24502a' : '#2c5230';
      ctx.beginPath();
      ctx.ellipse(sx + e.dir * 8 * z, headY, 7 * z, 2.6 * z, 0, 0, Math.PI * 2);
      ctx.fill();
      // snout tip + nostrils
      ctx.fillStyle = '#1c3a20';
      ctx.beginPath();
      ctx.ellipse(sx + e.dir * 13.5 * z, headY + 0.5 * z, 2.4 * z, 1.5 * z, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0c1f10';
      ctx.beginPath();
      ctx.arc(sx + e.dir * 12.8 * z, headY + 0.2 * z, 0.6 * z, 0, Math.PI * 2);
      ctx.arc(sx + e.dir * 14.2 * z, headY + 0.2 * z, 0.6 * z, 0, Math.PI * 2);
      ctx.fill();

      // Raised eye bumps on top of the head
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(sx + e.dir * 6 * z, headY - 1.6 * z, 1.3 * z, 0, Math.PI * 2);
      ctx.arc(sx + e.dir * 9.5 * z, headY - 1.6 * z, 1.3 * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0c1f10';
      ctx.beginPath();
      ctx.arc(sx + e.dir * 6 * z, headY - 1.6 * z, 0.6 * z, 0, Math.PI * 2);
      ctx.arc(sx + e.dir * 9.5 * z, headY - 1.6 * z, 0.6 * z, 0, Math.PI * 2);
      ctx.fill();

      // Occasional jaw snap + water ripple when mostly surfaced
      if (submerged < 0.4 && Math.sin(tick * 0.06 + e.phase * 3) > 0.94) {
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.4)';
        ctx.lineWidth = 1 * z;
        ctx.beginPath();
        ctx.ellipse(sx, sy + 4 * z, 16 * z, 3 * z, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (e.kind === 'lion') {
      const t = e.state / 600;
      // Behavior phases: watch → drink → idle → watch…
      const drinking = t > 0.12 && t < 0.28;
      const looking = t > 0.45 && t < 0.55;
      const drinkDip = drinking ? Math.sin(((t - 0.12) / 0.16) * Math.PI) * 3.4 * z : 0;
      const breathe = Math.sin(tick * 0.05 + e.phase) * 0.7 * z;

      // Male has a mane; lioness sleeker (alternate via id hash)
      const isMale = e.id.length % 2 === 0;
      const fur = isMale ? '#d9a441' : '#c8923a';
      const mane = '#8a5a2b';
      const belly = '#e8d3a0';
      const dark = '#5b3a1a';

      // Ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 2 * z, 9 * z, 4 * z, 0, 0, Math.PI * 2);
      ctx.fill();

      const bodyY = sy - 4 * z + breathe + drinkDip * 0.4;
      const facingWater = e.dir === -1;

      // Legs
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1.6 * z;
      ctx.beginPath();
      ctx.moveTo(sx - 5 * z, bodyY + 2 * z);
      ctx.lineTo(sx - 5 * z, sy + 4 * z);
      ctx.moveTo(sx + 2 * z, bodyY + 2 * z);
      ctx.lineTo(sx + 2 * z, sy + 4 * z);
      ctx.moveTo(sx + 6 * z, bodyY + 1 * z);
      ctx.lineTo(sx + 6 * z, sy + 3.4 * z);
      ctx.stroke();

      // Tail
      ctx.strokeStyle = fur;
      ctx.lineWidth = 1.3 * z;
      ctx.beginPath();
      ctx.moveTo(sx - e.dir * 4 * z, bodyY - 1 * z);
      ctx.quadraticCurveTo(sx - e.dir * 11 * z, bodyY - 3 * z, sx - e.dir * 13 * z, bodyY - 6 * z);
      ctx.stroke();
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.arc(sx - e.dir * 13 * z, bodyY - 6.5 * z, 1.5 * z, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.fillStyle = fur;
      ctx.beginPath();
      ctx.ellipse(sx - e.dir * 1 * z, bodyY, 7.5 * z, 4.5 * z, 0, 0, Math.PI * 2);
      ctx.fill();
      // Belly sheen
      ctx.fillStyle = belly;
      ctx.beginPath();
      ctx.ellipse(sx - e.dir * 1 * z, bodyY + 1.8 * z, 5.5 * z, 1.6 * z, 0, 0, Math.PI * 2);
      ctx.fill();

      // Neck lowered while drinking (head extends toward water)
      const headDipY = drinkDip;
      const headForward = drinking ? 5 * z : 2 * z;
      const headX = sx + e.dir * (8.5 * z + headForward);
      const headY = bodyY - 2 * z + headDipY * 0.9;
      const neckAng = drinking ? 0.5 : 0.25;

      // Neck
      ctx.strokeStyle = fur;
      ctx.lineWidth = 3.2 * z;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx + e.dir * 4 * z, bodyY - 1.5 * z);
      ctx.lineTo(headX - e.dir * 3 * z, headY);
      ctx.stroke();

      // Mane (male): fluffy ring behind/around head top
      if (isMale) {
        ctx.fillStyle = mane;
        ctx.beginPath();
        ctx.arc(headX - e.dir * 2 * z, headY - 1 * z, 4.6 * z, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6e4319';
        for (let m = 0; m < 8; m++) {
          const a = (m / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(headX - e.dir * 2 * z + Math.cos(a) * 4.2 * z, headY - 1 * z + Math.sin(a) * 3.6 * z, 0.8 * z, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Head
      ctx.fillStyle = fur;
      ctx.beginPath();
      ctx.arc(headX, headY, isMale ? 3 * z : 2.9 * z, 0, Math.PI * 2);
      ctx.fill();

      // Muzzle pointing down toward the water when drinking
      ctx.fillStyle = belly;
      ctx.beginPath();
      ctx.ellipse(headX + e.dir * (isMale ? 3 * z : 3.2 * z), headY + (drinking ? 1.6 * z : 0.6 * z), isMale ? 1.6 * z : 1.7 * z, 1.1 * z, 0, 0, Math.PI * 2);
      ctx.fill();

      // Nose
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.arc(headX + e.dir * (isMale ? 4 * z : 4.3 * z), headY + (drinking ? 1.8 * z : 0.6 * z), 0.8 * z, 0, Math.PI * 2);
      ctx.fill();

      // Ears
      ctx.fillStyle = fur;
      ctx.beginPath();
      ctx.arc(headX - e.dir * 0.5 * z, headY - 3.2 * z, 1.2 * z, 0, Math.PI * 2);
      ctx.arc(headX - e.dir * 2.8 * z, headY - 3.4 * z, 1.2 * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8d3a0';
      ctx.beginPath();
      ctx.arc(headX - e.dir * 0.5 * z, headY - 3.2 * z, 0.6 * z, 0, Math.PI * 2);
      ctx.arc(headX - e.dir * 2.8 * z, headY - 3.4 * z, 0.6 * z, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      ctx.fillStyle = '#1c1509';
      ctx.beginPath();
      ctx.arc(headX + e.dir * 2 * z, headY - 1.2 * z, 0.8 * z, 0, Math.PI * 2);
      ctx.fill();
      if (looking) {
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(headX + e.dir * 2 * z, headY - 1.2 * z, 0.35 * z, 0, Math.PI * 2);
        ctx.fill();
      }

      // Drinking ripple at the water surface near the muzzle
      if (drinking && Math.sin(tick * 0.2) > 0.3) {
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.5)';
        ctx.lineWidth = 1 * z;
        ctx.beginPath();
        ctx.ellipse(headX + e.dir * 5.5 * z, sy + 1.5 * z, 3 * z, 1.2 * z, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.lineCap = 'butt';
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

  /**
   * Realistic serpent renderer shared by small snakes & large pythons.
   * Body is a single smooth tapered polygon with a traveling S-wave
   * (head leads, tail follows), clipped dorsal shading + saddles, pale belly,
   * distinct spade head and forked tongue.
   */
  private renderSerpent(
    ctx: CanvasRenderingContext2D,
    e: WildlifeEntity,
    sx: number,
    sy: number,
    z: number,
    tick: number,
    isPython: boolean,
  ): void {
    const python = isPython;
    // ── Body proportions ───────────────────────────────────────────────
    const headR = python ? 6.0 * z : 2.9 * z;   // head half-width
    const tailR = python ? 1.4 * z : 0.8 * z;   // tail taper
    const segs = python ? 34 : 24;              // smooth spine samples
    const spacing = python ? 3.2 * z : 2.2 * z; // px between samples
    const amp = python ? 8.5 * z : 5.0 * z;     // undulation amplitude
    const waveFreq = python ? 0.03 : 0.05;      // travel speed of the S-wave

    // ── Palette ────────────────────────────────────────────────────────
    const outline = python ? '#0c1f10' : '#0c3518';
    const dorsal = python ? '#2c5230' : '#2f7c3a';   // top of the back
    const base = python ? '#4a6f43' : '#3d9c4d';     // main scale tone
    const highlight = python ? '#6f9a5f' : '#62c06e'; // lit scale edge
    const belly = python ? '#aec298' : '#bfe0a8';    // pale ventral edge
    const pattern = python ? '#142b16' : '#0d4718';   // saddles / diamonds
    const headTop = python ? '#274a2b' : '#1f6b33';

    // ── Spine points (index 0 = head, growing toward the tail) ────────
    const ptsX: number[] = [];
    const ptsY: number[] = [];
    const taper: number[] = [];
    for (let i = 0; i < segs; i++) {
      const t = i / (segs - 1);
      const x = sx - e.dir * i * spacing;
      // traveling wave — phase grows toward the tail so the head leads.
      // Amplitude envelope peaks mid-body and is ~0 at head & tail so the
      // head stays anchored to its own position while the body S-rolls behind.
      const sway = Math.sin(tick * waveFreq + e.phase + i * 0.42);
      const env = Math.sin(Math.min(1, t * 1.25) * Math.PI);
      const y = sy + sway * amp * env;
      ptsX.push(x);
      ptsY.push(y);
      taper.push(headR - (headR - tailR) * t);
    }

    // ── Ground shadow ─────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 2 * z, headR * (python ? 2.2 : 1.6), (python ? 5 : 2.4) * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Body tube as one smooth tapered polygon ────────────────────────
    // Build top edge head→tail then bottom edge tail→head.
    ctx.beginPath();
    ctx.moveTo(ptsX[0], ptsY[0] - taper[0] * 0.95);
    for (let i = 1; i < segs; i++) {
      ctx.lineTo(ptsX[i], ptsY[i] - taper[i] * 0.95);
    }
    for (let i = segs - 1; i >= 0; i--) {
      ctx.lineTo(ptsX[i], ptsY[i] + taper[i] * 0.95);
    }
    ctx.closePath();

    // silhouette outline
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(1, (python ? 1.6 : 1) * z);
    ctx.fillStyle = dorsal;
    ctx.fill();
    ctx.stroke();

    // Shading + pattern clipped inside the body silhouette
    ctx.clip();

    // lit top scale edge (gradient band across upper half)
    const grad = ctx.createLinearGradient(0, sy - headR, 0, sy + headR);
    grad.addColorStop(0, highlight);
    grad.addColorStop(0.45, base);
    grad.addColorStop(1, belly);
    ctx.fillStyle = grad;
    ctx.fillRect(sx - segs * spacing, sy - headR * 2, segs * spacing * 2 + headR * 6, headR * 4);

    // pale belly band on the lower ventral side
    ctx.fillStyle = python ? '#c4d2a8' : '#d3eec0';
    ctx.beginPath();
    ctx.rect(sx - segs * spacing, sy - headR * 0.1, segs * spacing * 2, headR * 1.4);
    ctx.fill();

    // dorsal saddles / diamonds along the spine
    ctx.fillStyle = pattern;
    for (let i = 1; i < segs - 1; i += 2) {
      const r = taper[i];
      const px = ptsX[i];
      const py = ptsY[i];
      if (python) {
        // irregular saddle blotches over the centre-top
        ctx.beginPath();
        ctx.ellipse(px, py - r * 0.28, r * 0.95, r * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // chain of small diamonds
        ctx.beginPath();
        ctx.moveTo(px, py - r * 0.62);
        ctx.lineTo(px + r * 0.32, py - r * 0.18);
        ctx.lineTo(px, py + r * 0.26);
        ctx.lineTo(px - r * 0.32, py - r * 0.18);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();

    // ── Head: spade-shaped skull facing e.dir ──────────────────────────
    const hx = sx;
    const hy = sy;
    ctx.save();
    ctx.fillStyle = headTop;
    ctx.beginPath();
    if (python) {
      // broad, blunt constrictor head
      ctx.moveTo(hx - e.dir * headR * 1.1, hy - headR * 0.78);
      ctx.quadraticCurveTo(hx + e.dir * headR * 1.2, hy - headR * 0.55, hx + e.dir * headR * 1.7, hy - headR * 0.05);
      ctx.quadraticCurveTo(hx + e.dir * headR * 1.2, hy + headR * 0.45, hx - e.dir * headR * 1.1, hy + headR * 0.78);
      ctx.quadraticCurveTo(hx - e.dir * headR * 1.6, hy, hx - e.dir * headR * 1.1, hy - headR * 0.78);
    } else {
      // narrower, slightly pointed viper head
      ctx.moveTo(hx - e.dir * headR * 0.7, hy - headR * 0.75);
      ctx.lineTo(hx + e.dir * headR * 1.25, hy - headR * 0.12);
      ctx.lineTo(hx - e.dir * headR * 0.7, hy + headR * 0.75);
      ctx.quadraticCurveTo(hx - e.dir * headR * 1.4, hy, hx - e.dir * headR * 0.7, hy - headR * 0.75);
    }
    ctx.closePath();
    ctx.fill();

    // head outline for contrast against the body
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(1, (python ? 1.6 : 1) * z);
    ctx.stroke();

    // snout scales highlight
    ctx.fillStyle = highlight;
    ctx.beginPath();
    ctx.ellipse(hx + e.dir * headR * (python ? 1.15 : 0.75), hy - headR * (python ? 0.45 : 0.36), headR * 0.55, headR * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();

    // eye (yellow iris, slit pupil) just behind the snout
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.ellipse(hx + e.dir * headR * (python ? 0.75 : 0.5), hy - headR * 0.42, headR * 0.4, headR * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = outline;
    ctx.beginPath();
    ctx.ellipse(hx + e.dir * headR * (python ? 0.86 : 0.58), hy - headR * 0.42, headR * 0.13, headR * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // nostril dot near snout tip
    ctx.fillStyle = outline;
    ctx.beginPath();
    ctx.arc(hx + e.dir * headR * (python ? 1.62 : 1.05), hy - headR * 0.08, headR * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── Forked tongue flick ────────────────────────────────────────────
    const flick = Math.sin(tick * 0.11 + e.phase);
    if (flick > 0.45) {
      const tipX = hx + e.dir * headR * (python ? 2.3 : 1.5);
      const out = (flick - 0.45) * 10 * z;
      ctx.strokeStyle = '#ef4444';
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1, 0.8 * z);
      ctx.beginPath();
      ctx.moveTo(hx + e.dir * headR * (python ? 1.5 : 1.0), hy + headR * 0.05);
      ctx.lineTo(tipX + e.dir * out, hy - headR * 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tipX + e.dir * out * 0.85, hy - headR * 0.1);
      ctx.lineTo(tipX + e.dir * (out + 4 * z), hy - headR * 0.4);
      ctx.moveTo(tipX + e.dir * out * 0.85, hy - headR * 0.1);
      ctx.lineTo(tipX + e.dir * (out + 4 * z), hy + headR * 0.16);
      ctx.stroke();
    }
  }
}
