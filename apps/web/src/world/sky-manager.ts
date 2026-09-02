/**
 * SkyManager — Ambient Atmosphere, Dynamic Clouds, Cyber Blimp & Interactive Wildlife.
 *
 * Visual Features:
 * - Procedural drifting pixel clouds with synchronous ground shadows
 * - Autonomous cyber blimp with animated propellers, aviation beacons & scrolling LED marquee
 * - Interactive bird flocks in parks & beach that peck, hop, and scatter when player approaches
 * - Responsive atmospheric tinting matching Day, Twilight, and Night cycles
 */

import {
  TOTAL_WORLD_WIDTH,
  TOTAL_WORLD_HEIGHT,
  TILE_WIDTH,
  TILE_HEIGHT,
} from '@spot/world';

export type TimeOfDay = 'day' | 'twilight' | 'night';

interface Cloud {
  wx: number;
  wy: number;
  speed: number;
  width: number;
  height: number;
  scale: number;
  puffs: { dx: number; dy: number; r: number }[];
  shadowDistance: number;
}

interface Bird {
  homeWx: number;
  homeWy: number;
  wx: number;
  wy: number;
  altitude: number; // 0 = on ground, >0 = flying in air
  vz: number; // vertical lift velocity
  vx: number;
  vy: number;
  state: 'idle' | 'pecking' | 'hopping' | 'fleeing';
  timer: number;
  frame: number;
  wingTimer: number;
  facing: 1 | -1;
  color: string;
}

interface BirdFlock {
  id: string;
  name: string;
  centerWx: number;
  centerWy: number;
  birds: Bird[];
  fled: boolean;
  alertTimer: number; // shows '!' alert bubble
  respawnTimer: number;
}

export class SkyManager {
  private clouds: Cloud[] = [];
  private flocks: BirdFlock[] = [];

  // Cyber Blimp state
  private blimp = {
    active: false,
    wx: -600,
    wy: 800,
    altitude: 450,
    speed: 1.25,
    direction: 1 as 1 | -1,
    propellerFrame: 0,
    tickerOffset: 0,
    cooldownTimer: 180, // initial ~3s delay
    beaconTimer: 0,
    messages: [
      '✦ SPOT METROPOLIS • POPULATION: 10,000 CITIZENS • CLAIM YOUR SPOT ✦',
      '✦ 24/7 AUTONOMOUS BULLET TRAIN RUNNING ON SCHEDULE ✦',
      '✦ WELCOME EXPLORER • VISIT THE DOWNTOWN CYBER DISTRICT ✦',
      '✦ 100x100 PERSISTENT VIRTUAL WORLD • DIGITAL HERITAGE PRESERVED ✦',
    ],
    currentMessageIndex: 0,
  };

  constructor() {
    this.initClouds();
    this.initFlocks();
  }

  /* -------------------------------------------------------------------------- */
  /* Initialization                                                             */
  /* -------------------------------------------------------------------------- */

  private initClouds(): void {
    const cloudCount = 12;
    for (let i = 0; i < cloudCount; i++) {
      const scale = 0.85 + Math.random() * 0.75;
      const puffs: { dx: number; dy: number; r: number }[] = [];
      const puffCount = 5 + Math.floor(Math.random() * 4);

      for (let p = 0; p < puffCount; p++) {
        puffs.push({
          dx: (p - puffCount / 2) * (20 * scale) + (Math.random() - 0.5) * 12,
          dy: (Math.random() - 0.5) * (14 * scale),
          r: (18 + Math.random() * 14) * scale,
        });
      }

      this.clouds.push({
        wx: (i / cloudCount) * (TOTAL_WORLD_WIDTH + 1200) - 600,
        wy: 100 + Math.random() * (TOTAL_WORLD_HEIGHT - 400),
        speed: 0.35 + Math.random() * 0.45,
        width: 140 * scale,
        height: 60 * scale,
        scale,
        puffs,
        shadowDistance: 160 + scale * 70,
      });
    }
  }

  private initFlocks(): void {
    // 4 atmospheric flock locations across world
    const locations = [
      { id: 'park_grove', name: 'Park Pigeons', gx: 62, gy: 18, count: 5, color: '#94a3b8' },
      { id: 'central_plaza', name: 'Plaza Doves', gx: 46, gy: 48, count: 4, color: '#cbd5e1' },
      { id: 'beach_boardwalk', name: 'Beach Seagulls', gx: 32, gy: 86, count: 5, color: '#f1f5f9' },
      { id: 'south_pier', name: 'Pier Gulls', gx: 72, gy: 90, count: 4, color: '#e2e8f0' },
    ];

    for (const loc of locations) {
      const centerWx = loc.gx * TILE_WIDTH;
      const centerWy = loc.gy * TILE_HEIGHT;
      const birds: Bird[] = [];

      for (let b = 0; b < loc.count; b++) {
        const offsetDist = Math.random() * 28;
        const angle = Math.random() * Math.PI * 2;
        const bwx = centerWx + Math.cos(angle) * offsetDist;
        const bwy = centerWy + Math.sin(angle) * offsetDist;

        birds.push({
          homeWx: bwx,
          homeWy: bwy,
          wx: bwx,
          wy: bwy,
          altitude: 0,
          vz: 0,
          vx: 0,
          vy: 0,
          state: 'idle',
          timer: Math.floor(Math.random() * 60),
          frame: 0,
          wingTimer: 0,
          facing: Math.random() < 0.5 ? 1 : -1,
          color: loc.color,
        });
      }

      this.flocks.push({
        id: loc.id,
        name: loc.name,
        centerWx,
        centerWy,
        birds,
        fled: false,
        alertTimer: 0,
        respawnTimer: 0,
      });
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Update Tick Loop                                                           */
  /* -------------------------------------------------------------------------- */

  tick(playerWx: number, playerWy: number): void {
    // 1. Update Clouds
    for (const cloud of this.clouds) {
      cloud.wx += cloud.speed;
      if (cloud.wx > TOTAL_WORLD_WIDTH + 800) {
        cloud.wx = -600;
        cloud.wy = 100 + Math.random() * (TOTAL_WORLD_HEIGHT - 400);
      }
    }

    // 2. Update Blimp
    this.tickBlimp();

    // 3. Update Bird Flocks
    this.tickFlocks(playerWx, playerWy);
  }

  private tickBlimp(): void {
    this.blimp.beaconTimer++;
    this.blimp.propellerFrame = (this.blimp.propellerFrame + 1) % 4;

    if (!this.blimp.active) {
      this.blimp.cooldownTimer--;
      if (this.blimp.cooldownTimer <= 0) {
        this.blimp.active = true;
        this.blimp.direction = Math.random() < 0.5 ? 1 : -1;
        this.blimp.wy = 400 + Math.random() * (TOTAL_WORLD_HEIGHT - 1200);
        this.blimp.wx = this.blimp.direction === 1 ? -400 : TOTAL_WORLD_WIDTH + 400;
        this.blimp.tickerOffset = 0;
        this.blimp.currentMessageIndex = (this.blimp.currentMessageIndex + 1) % this.blimp.messages.length;
      }
      return;
    }

    // Move Blimp
    this.blimp.wx += this.blimp.speed * this.blimp.direction;
    this.blimp.tickerOffset += 1.2;

    // Check world bounds exit
    if (this.blimp.direction === 1 && this.blimp.wx > TOTAL_WORLD_WIDTH + 600) {
      this.blimp.active = false;
      this.blimp.cooldownTimer = 2200 + Math.floor(Math.random() * 1000); // 35-50s
    } else if (this.blimp.direction === -1 && this.blimp.wx < -600) {
      this.blimp.active = false;
      this.blimp.cooldownTimer = 2200 + Math.floor(Math.random() * 1000);
    }
  }

  private tickFlocks(playerWx: number, playerWy: number): void {
    for (const flock of this.flocks) {
      // Alert bubble decay
      if (flock.alertTimer > 0) flock.alertTimer--;

      // If flock fled, wait for respawn timer
      if (flock.fled) {
        flock.respawnTimer--;
        if (flock.respawnTimer <= 0) {
          flock.fled = false;
          for (const b of flock.birds) {
            b.wx = b.homeWx;
            b.wy = b.homeWy;
            b.altitude = 0;
            b.vz = 0;
            b.vx = 0;
            b.vy = 0;
            b.state = 'idle';
            b.timer = Math.floor(Math.random() * 60);
          }
        }
      }

      // Check proximity to player if flock is still grounded
      if (!flock.fled) {
        const distToPlayer = Math.hypot(playerWx - flock.centerWx, playerWy - flock.centerWy);
        if (distToPlayer < 90) {
          // Trigger scatter!
          flock.fled = true;
          flock.alertTimer = 45; // show '!' for 0.75s
          flock.respawnTimer = 1800 + Math.floor(Math.random() * 600); // return in ~35-45s

          for (const b of flock.birds) {
            b.state = 'fleeing';
            b.altitude = 1;
            b.vz = 2.4 + Math.random() * 1.5;
            // Scatter outward away from player
            const awayAngle = Math.atan2(b.wy - playerWy, b.wx - playerWx) + (Math.random() - 0.5) * 0.8;
            const fleeSpeed = 3.5 + Math.random() * 2.0;
            b.vx = Math.cos(awayAngle) * fleeSpeed;
            b.vy = Math.sin(awayAngle) * fleeSpeed - 1.2; // slight upward drift
            b.facing = b.vx >= 0 ? 1 : -1;
          }
        }
      }

      // Update individual birds
      for (const b of flock.birds) {
        if (b.state === 'fleeing') {
          b.altitude += b.vz;
          b.wx += b.vx;
          b.wy += b.vy;
          b.wingTimer++;
          if (b.wingTimer >= 4) {
            b.wingTimer = 0;
            b.frame = (b.frame + 1) % 4;
          }
        } else {
          // Grounded idle behavior
          b.timer--;
          if (b.timer <= 0) {
            const nextAction = Math.random();
            if (nextAction < 0.45) {
              b.state = 'pecking';
              b.timer = 30 + Math.floor(Math.random() * 40);
              b.frame = 1;
            } else if (nextAction < 0.75) {
              b.state = 'hopping';
              b.timer = 15;
              b.facing = Math.random() < 0.5 ? 1 : -1;
              b.wx = Math.max(b.homeWx - 20, Math.min(b.homeWx + 20, b.wx + b.facing * (3 + Math.random() * 4)));
            } else {
              b.state = 'idle';
              b.timer = 40 + Math.floor(Math.random() * 60);
              b.frame = 0;
            }
          }
        }
      }
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Rendering: Layer 1 - Ground Shadows (Rendered beneath entities)            */
  /* -------------------------------------------------------------------------- */

  renderGroundShadows(
    ctx: CanvasRenderingContext2D,
    camera: { worldToScreen: (wx: number, wy: number) => { x: number; y: number }; zoom: number; viewportWidth: number; viewportHeight: number },
    timeOfDay: TimeOfDay,
  ): void {
    const W = camera.viewportWidth;
    const H = camera.viewportHeight;
    const z = camera.zoom;
    const shadowOpacity = timeOfDay === 'night' ? 0.03 : timeOfDay === 'twilight' ? 0.05 : 0.08;

    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;

    // 1. Cloud Shadows
    for (const cloud of this.clouds) {
      const shadowWx = cloud.wx + 80;
      const shadowWy = cloud.wy + cloud.shadowDistance;
      const screen = camera.worldToScreen(shadowWx, shadowWy);

      // Frustum culling
      if (screen.x < -180 * z || screen.x > W + 180 * z || screen.y < -100 * z || screen.y > H + 100 * z) {
        continue;
      }

      ctx.beginPath();
      for (const p of cloud.puffs) {
        const px = screen.x + p.dx * z;
        const py = screen.y + p.dy * 0.45 * z;
        const rx = p.r * 1.3 * z;
        const ry = p.r * 0.55 * z;
        ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    // 2. Blimp Shadow
    if (this.blimp.active) {
      const bShadowWx = this.blimp.wx;
      const bShadowWy = this.blimp.wy + this.blimp.altitude * 0.45;
      const screen = camera.worldToScreen(bShadowWx, bShadowWy);

      if (screen.x > -250 * z && screen.x < W + 250 * z && screen.y > -100 * z && screen.y < H + 100 * z) {
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y, 85 * z, 24 * z, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /* -------------------------------------------------------------------------- */
  /* Rendering: Layer 2 - Birds & Wildlife (Depth sorted or above ground)       */
  /* -------------------------------------------------------------------------- */

  renderGroundedWildlife(
    ctx: CanvasRenderingContext2D,
    camera: { worldToScreen: (wx: number, wy: number) => { x: number; y: number }; zoom: number; viewportWidth: number; viewportHeight: number },
  ): void {
    const W = camera.viewportWidth;
    const H = camera.viewportHeight;
    const z = camera.zoom;

    for (const flock of this.flocks) {
      // Draw alert '!' icon over flock if startled
      if (flock.alertTimer > 0) {
        const screen = camera.worldToScreen(flock.centerWx, flock.centerWy - 20);
        if (screen.x > -50 && screen.x < W + 50 && screen.y > -50 && screen.y < H + 50) {
          ctx.save();
          ctx.fillStyle = '#ef4444';
          ctx.font = `bold ${Math.round(13 * z)}px 'Outfit', sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('!', screen.x, screen.y);
          ctx.restore();
        }
      }

      for (const b of flock.birds) {
        // Draw birds that are on or near the ground
        if (b.altitude > 300) continue; // High flying birds rendered in sky layer

        const screen = camera.worldToScreen(b.wx, b.wy - b.altitude);
        if (screen.x < -30 || screen.x > W + 30 || screen.y < -30 || screen.y > H + 30) continue;

        this.drawPixelBird(ctx, screen.x, screen.y, b, z);
      }
    }
  }

  private drawPixelBird(ctx: CanvasRenderingContext2D, sx: number, sy: number, b: Bird, z: number): void {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(b.facing * z, z);

    // Ground contact shadow if slightly airborne
    if (b.altitude > 0 && b.altitude < 180) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.ellipse(0, b.altitude * z, 4, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (b.state === 'fleeing') {
      // Flying Wing-Flap Frame
      ctx.fillStyle = b.color;
      // Body
      ctx.fillRect(-3, -2, 6, 4);
      // Head & beak
      ctx.fillRect(3, -4, 3, 3);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(6, -3, 2, 1);

      // Flapping Wings
      ctx.fillStyle = '#64748b';
      if (b.frame === 0 || b.frame === 2) {
        // Wings up
        ctx.fillRect(-2, -7, 4, 5);
        ctx.fillRect(-1, -9, 3, 3);
      } else {
        // Wings down
        ctx.fillRect(-2, 2, 4, 5);
        ctx.fillRect(-1, 5, 3, 3);
      }
    } else {
      // Grounded Bird (Idle, Pecking, Hopping)
      ctx.fillStyle = b.color;
      // Body
      ctx.fillRect(-3, -4, 6, 4);
      // Tail
      ctx.fillStyle = '#64748b';
      ctx.fillRect(-5, -5, 2, 2);

      // Head position (lower when pecking)
      const headY = b.state === 'pecking' ? -2 : -6;
      ctx.fillStyle = b.color;
      ctx.fillRect(2, headY, 3, 3);
      // Beak
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(5, headY + 1, 2, 1);
      // Eye
      ctx.fillStyle = '#090b10';
      ctx.fillRect(3, headY + 1, 1, 1);

      // Legs
      ctx.fillStyle = '#d97706';
      ctx.fillRect(-1, 0, 1, 2);
      ctx.fillRect(1, 0, 1, 2);
    }

    ctx.restore();
  }

  /* -------------------------------------------------------------------------- */
  /* Rendering: Layer 3 - Sky Layer (Clouds, Blimp & High Flying Birds)         */
  /* -------------------------------------------------------------------------- */

  renderSkyLayer(
    ctx: CanvasRenderingContext2D,
    camera: { worldToScreen: (wx: number, wy: number) => { x: number; y: number }; zoom: number; viewportWidth: number; viewportHeight: number },
    timeOfDay: TimeOfDay,
  ): void {
    const W = camera.viewportWidth;
    const H = camera.viewportHeight;
    const z = camera.zoom;

    // 1. High-Flying Birds
    for (const flock of this.flocks) {
      for (const b of flock.birds) {
        if (b.altitude >= 300) {
          const screen = camera.worldToScreen(b.wx, b.wy - b.altitude);
          if (screen.x > -20 && screen.x < W + 20 && screen.y > -20 && screen.y < H + 20) {
            this.drawPixelBird(ctx, screen.x, screen.y, b, z * 0.85);
          }
        }
      }
    }

    // 2. Cyber Blimp
    if (this.blimp.active) {
      this.renderCyberBlimp(ctx, camera, z, timeOfDay);
    }

    // 3. Fluffy Pixel Clouds
    this.renderClouds(ctx, camera, z, timeOfDay);
  }

  private renderClouds(
    ctx: CanvasRenderingContext2D,
    camera: { worldToScreen: (wx: number, wy: number) => { x: number; y: number }; viewportWidth: number; viewportHeight: number },
    z: number,
    timeOfDay: TimeOfDay,
  ): void {
    const W = camera.viewportWidth;
    const H = camera.viewportHeight;

    let cloudFill = 'rgba(255, 255, 255, 0.75)';
    let highlightFill = 'rgba(255, 255, 255, 0.9)';

    if (timeOfDay === 'twilight') {
      cloudFill = 'rgba(253, 186, 116, 0.7)';
      highlightFill = 'rgba(254, 215, 170, 0.85)';
    } else if (timeOfDay === 'night') {
      cloudFill = 'rgba(30, 41, 59, 0.45)';
      highlightFill = 'rgba(51, 65, 85, 0.6)';
    }

    ctx.save();
    for (const cloud of this.clouds) {
      const screen = camera.worldToScreen(cloud.wx, cloud.wy);
      if (screen.x < -180 * z || screen.x > W + 180 * z || screen.y < -100 * z || screen.y > H + 100 * z) {
        continue;
      }

      // Base Puffs
      ctx.fillStyle = cloudFill;
      ctx.beginPath();
      for (const p of cloud.puffs) {
        const px = screen.x + p.dx * z;
        const py = screen.y + p.dy * 0.55 * z;
        const rx = p.r * z;
        const ry = p.r * 0.5 * z;
        ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      // Soft Top Highlight
      ctx.fillStyle = highlightFill;
      ctx.beginPath();
      for (const p of cloud.puffs) {
        const px = screen.x + p.dx * z;
        const py = screen.y + (p.dy * 0.55 - 4) * z;
        const rx = p.r * 0.85 * z;
        const ry = p.r * 0.35 * z;
        ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.restore();
  }

  private renderCyberBlimp(
    ctx: CanvasRenderingContext2D,
    camera: { worldToScreen: (wx: number, wy: number) => { x: number; y: number } },
    z: number,
    _timeOfDay: TimeOfDay,
  ): void {
    const screen = camera.worldToScreen(this.blimp.wx, this.blimp.wy);
    const dir = this.blimp.direction;

    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.scale(dir * z, z);

    // 1. Blimp Hull
    const hullGrad = ctx.createLinearGradient(0, -22, 0, 22);
    hullGrad.addColorStop(0, '#334155');
    hullGrad.addColorStop(0.5, '#1e293b');
    hullGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = hullGrad;
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.ellipse(0, 0, 88, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 2. Cyan Neon Racing Stripe
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-70, 0);
    ctx.lineTo(65, 0);
    ctx.stroke();

    // 3. Tail Fins (Upper & Lower)
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.2;
    // Top fin
    ctx.beginPath();
    ctx.moveTo(-75, -6);
    ctx.lineTo(-94, -20);
    ctx.lineTo(-78, -20);
    ctx.lineTo(-62, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Bottom fin
    ctx.beginPath();
    ctx.moveTo(-75, 6);
    ctx.lineTo(-94, 20);
    ctx.lineTo(-78, 20);
    ctx.lineTo(-62, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 4. Passenger Gondola / Cockpit
    ctx.fillStyle = '#090b10';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.fillRect(-28, 22, 56, 12);
    ctx.strokeRect(-28, 22, 56, 12);

    // Illuminated Cabin Windows
    ctx.fillStyle = '#fbbf24';
    for (let w = -22; w < 24; w += 9) {
      ctx.fillRect(w, 25, 6, 5);
    }

    // 5. Twin Spinning Propellers (Rear Gondola)
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-34, 24, 6, 6); // Propeller engine housing
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (this.blimp.propellerFrame % 2 === 0) {
      ctx.moveTo(-36, 18);
      ctx.lineTo(-36, 36);
    } else {
      ctx.moveTo(-42, 27);
      ctx.lineTo(-30, 27);
    }
    ctx.stroke();

    // 6. Blinking Aviation Beacons
    const isBeaconOn = Math.floor(this.blimp.beaconTimer / 30) % 2 === 0;
    if (isBeaconOn) {
      // Red Tail Beacon
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(-92, -21, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Green Nose Beacon
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(88, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 7. Scrolling LED Marquee on Hull
    ctx.save();
    // Clip to hull center area
    ctx.beginPath();
    ctx.rect(-55, -9, 110, 18);
    ctx.clip();

    ctx.fillStyle = '#000000';
    ctx.fillRect(-55, -9, 110, 18);

    // Scrolling text
    const msg = this.blimp.messages[this.blimp.currentMessageIndex];
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 4;

    const textMetrics = ctx.measureText(msg);
    const totalW = textMetrics.width + 40;
    const scrollX = 55 - (this.blimp.tickerOffset % totalW);

    ctx.fillText(msg, scrollX, 4);
    ctx.fillText(msg, scrollX + totalW, 4);
    ctx.restore();

    ctx.restore();
  }
}
