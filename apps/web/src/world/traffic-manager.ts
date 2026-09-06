/**
 * TrafficManager — Autonomous Cyber Traffic System for Spot World.
 *
 * Simulates autonomous cybernetic vehicles cruising along the city's avenue corridors:
 * - 🚕 Cyber Cabs (Signature yellow/black with illuminated rooftop signs)
 * - 🏎️ Synthwave Cruisers (Neon wedge sports cars with spoilers & ground underglow)
 * - 🚐 Autonomous Delivery Vans (Compact lidar-equipped parcel couriers)
 * - 🛵 Cyber Scooters (Agile two-wheel delivery couriers)
 *
 * Features:
 * - Realistic lane-following on major and secondary roads (E/W and N/S)
 * - Pedestrian-aware braking (smoothly stops if player is in crossing path, taps 8-bit horn)
 * - Forward headlight cones and red taillight glows during twilight and night
 * - 2.5D depth sorting and ground shadow projection
 */

import { TILE_WIDTH, TILE_HEIGHT, TOTAL_WORLD_WIDTH, TOTAL_WORLD_HEIGHT } from '@spot/world';

export type VehicleType = 'taxi' | 'synthwave' | 'van' | 'scooter';
export type TravelDirection = 'north' | 'south' | 'east' | 'west';

export interface Vehicle {
  id: string;
  type: VehicleType;
  wx: number;
  wy: number;
  direction: TravelDirection;
  corridor: number; // grid index of the road (e.g. gx = 50 or gy = 50)
  isCorridorX: boolean; // true if moving along an X road (N/S), false if Y road (E/W)
  speed: number;
  maxSpeed: number;
  length: number;
  width: number;
  primaryColor: string;
  accentColor: string;
  isBraking: boolean;
  honkCooldown: number;
  passCooldown: number;
  underglowColor?: string;
}

export class TrafficManager {
  private vehicles: Vehicle[] = [];
  private maxVehicles = 16;
  private spawnTimer = 0;

  onHonk?: (proximity: number, type: VehicleType) => void;
  onPassBy?: (proximity: number) => void;

  // Designated road corridors (bypassing central pedestrian plaza where monuments are)
  private majorX = [20, 80];
  private majorY = [20, 80];
  private secX = [8, 35, 65, 92];
  private secY = [8, 35, 65, 92];

  constructor() {
    this.seedVehicles();
  }

  private seedVehicles(): void {
    const allX = [...this.majorX, ...this.secX];
    const allY = [...this.majorY, ...this.secY];

    // Initial pool of distributed cars
    for (let i = 0; i < 12; i++) {
      const isXRoad = Math.random() < 0.5;
      const corridor = isXRoad
        ? allX[Math.floor(Math.random() * allX.length)]
        : allY[Math.floor(Math.random() * allY.length)];
      const v = this.createVehicle(corridor, isXRoad);
      // Randomize initial progress along road
      if (isXRoad) {
        v.wy = Math.random() * TOTAL_WORLD_HEIGHT;
      } else {
        v.wx = Math.random() * TOTAL_WORLD_WIDTH;
      }
      this.vehicles.push(v);
    }
  }

  private createVehicle(corridor: number, isXRoad: boolean): Vehicle {
    const types: VehicleType[] = ['taxi', 'synthwave', 'van', 'scooter', 'taxi'];
    const type = types[Math.floor(Math.random() * types.length)];

    let length = 38;
    let width = 20;
    let maxSpeed = 2.0;
    let primaryColor = '#eab308'; // taxi yellow
    let accentColor = '#0f172a';
    let underglowColor: string | undefined;

    if (type === 'taxi') {
      length = 38;
      width = 20;
      maxSpeed = 2.2;
      primaryColor = '#facc15';
      accentColor = '#18181b';
    } else if (type === 'synthwave') {
      length = 42;
      width = 21;
      maxSpeed = 2.8;
      const palette = Math.random() < 0.5 ? ['#ec4899', '#06b6d4'] : ['#8b5cf6', '#f43f5e'];
      primaryColor = palette[0];
      accentColor = palette[1];
      underglowColor = primaryColor;
    } else if (type === 'van') {
      length = 44;
      width = 22;
      maxSpeed = 1.7;
      primaryColor = '#38bdf8';
      accentColor = '#ffffff';
    } else if (type === 'scooter') {
      length = 24;
      width = 12;
      maxSpeed = 2.4;
      primaryColor = '#10b981';
      accentColor = '#f8fafc';
    }

    let direction: TravelDirection;
    let wx = 0;
    let wy = 0;

    if (isXRoad) {
      // North/South road at gx = corridor
      const dirSouth = Math.random() < 0.5;
      direction = dirSouth ? 'south' : 'north';
      // Dual lanes: southbound on right side of road (+8px), northbound on left side (-8px)
      const laneOffset = dirSouth ? 9 : -9;
      wx = corridor * TILE_WIDTH + TILE_WIDTH / 2 + laneOffset;
      wy = dirSouth ? -length - 40 : TOTAL_WORLD_HEIGHT + length + 40;
    } else {
      // East/West road at gy = corridor
      const dirEast = Math.random() < 0.5;
      direction = dirEast ? 'east' : 'west';
      // Dual lanes: eastbound on lower side (+6px), westbound on upper side (-6px)
      const laneOffset = dirEast ? 6 : -6;
      wy = corridor * TILE_HEIGHT + TILE_HEIGHT / 2 + laneOffset;
      wx = dirEast ? -length - 40 : TOTAL_WORLD_WIDTH + length + 40;
    }

    return {
      id: `veh_${Math.random().toString(36).substring(2, 8)}`,
      type,
      wx,
      wy,
      direction,
      corridor,
      isCorridorX: isXRoad,
      speed: maxSpeed * (0.85 + Math.random() * 0.3),
      maxSpeed,
      length,
      width,
      primaryColor,
      accentColor,
      underglowColor,
      isBraking: false,
      honkCooldown: 0,
      passCooldown: 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Simulation Update Loop
  // ---------------------------------------------------------------------------
  tick(playerWx: number, playerWy: number): void {
    this.spawnTimer++;
    if (this.spawnTimer > 120 && this.vehicles.length < this.maxVehicles) {
      this.spawnTimer = 0;
      const allX = [...this.majorX, ...this.secX];
      const allY = [...this.majorY, ...this.secY];
      const isXRoad = Math.random() < 0.5;
      const corridor = isXRoad
        ? allX[Math.floor(Math.random() * allX.length)]
        : allY[Math.floor(Math.random() * allY.length)];
      this.vehicles.push(this.createVehicle(corridor, isXRoad));
    }

    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];

      // Never enter the central pedestrian plaza where monuments are located (gx: 36..64, gy: 36..64)
      const gx = Math.floor(v.wx / TILE_WIDTH);
      const gy = Math.floor(v.wy / TILE_HEIGHT);
      if (gx >= 36 && gx <= 64 && gy >= 36 && gy <= 64) {
        this.vehicles.splice(i, 1);
        continue;
      }

      if (v.honkCooldown > 0) v.honkCooldown--;
      if (v.passCooldown > 0) v.passCooldown--;

      // 1. Check Pedestrian & Traffic Obstacles Ahead
      let shouldBrake = false;

      // Distance check to player
      const dxToPlayer = playerWx - v.wx;
      const dyToPlayer = playerWy - v.wy;
      const distToPlayer = Math.hypot(dxToPlayer, dyToPlayer);

      if (distToPlayer < 75) {
        // Check if player is directly ahead in driving lane
        if (v.direction === 'east' && dxToPlayer > 0 && dxToPlayer < 65 && Math.abs(dyToPlayer) < 22) {
          shouldBrake = true;
        } else if (v.direction === 'west' && dxToPlayer < 0 && dxToPlayer > -65 && Math.abs(dyToPlayer) < 22) {
          shouldBrake = true;
        } else if (v.direction === 'south' && dyToPlayer > 0 && dyToPlayer < 65 && Math.abs(dxToPlayer) < 22) {
          shouldBrake = true;
        } else if (v.direction === 'north' && dyToPlayer < 0 && dyToPlayer > -65 && Math.abs(dxToPlayer) < 22) {
          shouldBrake = true;
        }
      }

      // Check distance to vehicle ahead in same lane
      for (let j = 0; j < this.vehicles.length; j++) {
        if (i === j) continue;
        const other = this.vehicles[j];
        if (other.corridor !== v.corridor || other.direction !== v.direction) continue;

        const dAhead = v.direction === 'east' ? other.wx - v.wx
          : v.direction === 'west' ? v.wx - other.wx
          : v.direction === 'south' ? other.wy - v.wy
          : v.wy - other.wy;

        if (dAhead > 0 && dAhead < v.length + 30) {
          shouldBrake = true;
          break;
        }
      }

      // 2. Adjust Speed & Braking
      if (shouldBrake) {
        v.isBraking = true;
        v.speed = Math.max(0, v.speed - 0.18);
        if (v.speed === 0 && v.honkCooldown === 0 && distToPlayer < 65) {
          const proximity = Math.max(0.2, 1 - distToPlayer / 80);
          this.onHonk?.(proximity, v.type);
          v.honkCooldown = 240; // Don't spam horn
        }
      } else {
        v.isBraking = false;
        v.speed = Math.min(v.maxSpeed, v.speed + 0.08);

        // Gentle passing electric motor / engine whoosh when cruising near player
        if (v.speed > 1.2 && distToPlayer < 75 && v.passCooldown === 0) {
          const proximity = Math.max(0.15, 1 - distToPlayer / 90);
          this.onPassBy?.(proximity);
          v.passCooldown = 320;
        }
      }

      // 3. Move Vehicle
      if (v.direction === 'east') v.wx += v.speed;
      else if (v.direction === 'west') v.wx -= v.speed;
      else if (v.direction === 'south') v.wy += v.speed;
      else if (v.direction === 'north') v.wy -= v.speed;

      // 4. Wrap or Despawn at World Bounds
      const boundPad = 120;
      const isOutOfWorld =
        v.wx < -boundPad ||
        v.wx > TOTAL_WORLD_WIDTH + boundPad ||
        v.wy < -boundPad ||
        v.wy > TOTAL_WORLD_HEIGHT + boundPad;

      if (isOutOfWorld) {
        this.vehicles.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Get Entities for 2.5D Depth Sorting & Headlight Arrays
  // ---------------------------------------------------------------------------
  getVehicles(): Vehicle[] {
    return this.vehicles;
  }

  // Render a specific vehicle
  renderVehicle(
    ctx: CanvasRenderingContext2D,
    v: Vehicle,
    screen: { x: number; y: number },
    zoom: number,
    timeOfDay: 'day' | 'twilight' | 'night'
  ): void {
    const z = zoom;
    const isHorizontal = v.direction === 'east' || v.direction === 'west';
    const vl = (isHorizontal ? v.length : v.width) * z;
    const vw = (isHorizontal ? v.width : v.length) * z;
    const isNight = timeOfDay !== 'day';

    ctx.save();
    ctx.translate(screen.x, screen.y);

    // 1. Soft Ground Contact Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.roundRect(-vl / 2 + 1, -vw / 2 + 4 * z, vl, vw, 4 * z);
    ctx.fill();

    // 1b. Neon Underglow (Synthwave / Cyber Cab)
    if (v.underglowColor && isNight) {
      ctx.fillStyle = v.underglowColor;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.ellipse(0, 0, vl * 0.65, vw * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    // 2. Wheels
    ctx.fillStyle = '#090d16';
    if (isHorizontal) {
      const wheelW = 8 * z;
      const wheelH = 3 * z;
      // 4 wheels
      ctx.fillRect(-vl / 2 + 6 * z, -vw / 2 - 1 * z, wheelW, wheelH);
      ctx.fillRect(vl / 2 - 14 * z, -vw / 2 - 1 * z, wheelW, wheelH);
      ctx.fillRect(-vl / 2 + 6 * z, vw / 2 - 2 * z, wheelW, wheelH);
      ctx.fillRect(vl / 2 - 14 * z, vw / 2 - 2 * z, wheelW, wheelH);
    } else {
      const wheelW = 3 * z;
      const wheelH = 8 * z;
      ctx.fillRect(-vl / 2 - 1 * z, -vw / 2 + 6 * z, wheelW, wheelH);
      ctx.fillRect(-vl / 2 - 1 * z, vw / 2 - 14 * z, wheelW, wheelH);
      ctx.fillRect(vl / 2 - 2 * z, -vw / 2 + 6 * z, wheelW, wheelH);
      ctx.fillRect(vl / 2 - 2 * z, vw / 2 - 14 * z, wheelW, wheelH);
    }

    // 3. Vehicle Chassis Body
    ctx.fillStyle = v.primaryColor;
    ctx.beginPath();
    ctx.roundRect(-vl / 2, -vw / 2, vl, vw, 3.5 * z);
    ctx.fill();

    // Subtle edge bevel highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 4. Cabin & Windshields
    ctx.fillStyle = '#0f172a'; // tinted cyber glass
    if (isHorizontal) {
      const cabinL = vl * 0.52;
      const cabinW = vw * 0.72;
      const cabinOffset = v.direction === 'east' ? -vl * 0.06 : vl * 0.06;
      ctx.beginPath();
      ctx.roundRect(-cabinL / 2 + cabinOffset, -cabinW / 2, cabinL, cabinW, 2 * z);
      ctx.fill();

      // Glass reflection shine
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(-cabinL / 2 + cabinOffset + 2 * z, -cabinW / 2 + 1 * z, cabinL - 4 * z, 2 * z);
    } else {
      const cabinL = vl * 0.72;
      const cabinW = vw * 0.52;
      const cabinOffset = v.direction === 'south' ? -vw * 0.06 : vw * 0.06;
      ctx.beginPath();
      ctx.roundRect(-cabinL / 2, -cabinW / 2 + cabinOffset, cabinL, cabinW, 2 * z);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(-cabinL / 2 + 1 * z, -cabinW / 2 + cabinOffset + 2 * z, 2 * z, cabinW - 4 * z);
    }

    // 5. Special Type Details
    if (v.type === 'taxi') {
      // Illuminated TAXI Rooftop Sign
      ctx.fillStyle = '#facc15';
      const signW = isHorizontal ? 10 * z : 6 * z;
      const signH = isHorizontal ? 5 * z : 10 * z;
      ctx.fillRect(-signW / 2, -signH / 2, signW, signH);
      ctx.fillStyle = '#000000';
      ctx.fillRect(-signW / 2 + 1, -signH / 2 + 1, signW - 2, signH - 2);
    } else if (v.type === 'synthwave') {
      // Rear Spoiler Wing
      ctx.fillStyle = v.accentColor;
      if (v.direction === 'east') ctx.fillRect(-vl / 2 - 2 * z, -vw / 2 + 2 * z, 3 * z, vw - 4 * z);
      else if (v.direction === 'west') ctx.fillRect(vl / 2 - 1 * z, -vw / 2 + 2 * z, 3 * z, vw - 4 * z);
      else if (v.direction === 'south') ctx.fillRect(-vl / 2 + 2 * z, -vw / 2 - 2 * z, vl - 4 * z, 3 * z);
      else if (v.direction === 'north') ctx.fillRect(-vl / 2 + 2 * z, vw / 2 - 1 * z, vl - 4 * z, 3 * z);
    } else if (v.type === 'van') {
      // Autonomous Lidar Dome on Roof
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, 0, 3 * z, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Headlights & Taillights
    if (isHorizontal) {
      const frontX = v.direction === 'east' ? vl / 2 : -vl / 2;
      const rearX = v.direction === 'east' ? -vl / 2 : vl / 2;

      // Headlights (Warm White / Yellow)
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(frontX - (v.direction === 'east' ? 2 * z : 0), -vw / 2 + 2 * z, 2 * z, 3 * z);
      ctx.fillRect(frontX - (v.direction === 'east' ? 2 * z : 0), vw / 2 - 5 * z, 2 * z, 3 * z);

      // Taillights (Glowing Red)
      ctx.fillStyle = v.isBraking ? '#ff0000' : '#ef4444';
      ctx.fillRect(rearX - (v.direction === 'east' ? 0 : 2 * z), -vw / 2 + 2 * z, 2 * z, 3 * z);
      ctx.fillRect(rearX - (v.direction === 'east' ? 0 : 2 * z), vw / 2 - 5 * z, 2 * z, 3 * z);

      // Night Headlight Forward Cones
      if (isNight) {
        ctx.fillStyle = 'rgba(254, 240, 138, 0.12)';
        ctx.beginPath();
        const beamLen = 65 * z;
        const beamW = 28 * z;
        if (v.direction === 'east') {
          ctx.moveTo(frontX, -vw / 2 + 3 * z);
          ctx.lineTo(frontX + beamLen, -beamW);
          ctx.lineTo(frontX + beamLen, beamW);
          ctx.lineTo(frontX, vw / 2 - 3 * z);
        } else {
          ctx.moveTo(frontX, -vw / 2 + 3 * z);
          ctx.lineTo(frontX - beamLen, -beamW);
          ctx.lineTo(frontX - beamLen, beamW);
          ctx.lineTo(frontX, vw / 2 - 3 * z);
        }
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // Vertical (North / South)
      const frontY = v.direction === 'south' ? vw / 2 : -vw / 2;
      const rearY = v.direction === 'south' ? -vw / 2 : vw / 2;

      // Headlights
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-vl / 2 + 2 * z, frontY - (v.direction === 'south' ? 2 * z : 0), 3 * z, 2 * z);
      ctx.fillRect(vl / 2 - 5 * z, frontY - (v.direction === 'south' ? 2 * z : 0), 3 * z, 2 * z);

      // Taillights
      ctx.fillStyle = v.isBraking ? '#ff0000' : '#ef4444';
      ctx.fillRect(-vl / 2 + 2 * z, rearY - (v.direction === 'south' ? 0 : 2 * z), 3 * z, 2 * z);
      ctx.fillRect(vl / 2 - 5 * z, rearY - (v.direction === 'south' ? 0 : 2 * z), 3 * z, 2 * z);

      // Night Headlight Forward Cones
      if (isNight) {
        ctx.fillStyle = 'rgba(254, 240, 138, 0.12)';
        ctx.beginPath();
        const beamLen = 65 * z;
        const beamW = 28 * z;
        if (v.direction === 'south') {
          ctx.moveTo(-vl / 2 + 3 * z, frontY);
          ctx.lineTo(-beamW, frontY + beamLen);
          ctx.lineTo(beamW, frontY + beamLen);
          ctx.lineTo(vl / 2 - 3 * z, frontY);
        } else {
          ctx.moveTo(-vl / 2 + 3 * z, frontY);
          ctx.lineTo(-beamW, frontY - beamLen);
          ctx.lineTo(beamW, frontY - beamLen);
          ctx.lineTo(vl / 2 - 3 * z, frontY);
        }
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();
  }
}
