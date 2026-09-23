/**
 * TourManager — Cinematic Autopilot Island Fly-Through Camera.
 *
 * Glides smoothly along an island railway of iconic landmarks with gentle
 * zoom breathing, landmark title banners, and instant handoff on any user input.
 */

import { gridToWorldCenter } from '@spot/world';
import type { Camera } from './camera.js';

export interface TourLandmark {
  gx: number;
  gy: number;
  zoom: number;
  title: string;
  subtitle: string;
  durationMs: number;
}

export const TOUR_LANDMARKS: TourLandmark[] = [
  {
    gx: 50,
    gy: 50,
    zoom: 1.3,
    title: 'Grand Central Plaza',
    subtitle: 'Luminous granite fountain, civic clocktower & central origin',
    durationMs: 7000,
  },
  {
    gx: 46,
    gy: 54,
    zoom: 1.45,
    title: 'The 1984 Byte Cade',
    subtitle: 'Playable CRT arcade cabinet featuring Spot Fighter II & Byte Snake',
    durationMs: 6500,
  },
  {
    gx: 56,
    gy: 52,
    zoom: 1.35,
    title: '寄り道 Yorimichi Japanese Pavilion',
    subtitle: 'Antique timber hip-and-gable pagoda and tranquil village portal',
    durationMs: 6500,
  },
  {
    gx: 44,
    gy: 58,
    zoom: 1.35,
    title: 'SwarmGuard Bastion',
    subtitle: 'Fortified cyber citadel & tower defense arena',
    durationMs: 6000,
  },
  {
    gx: 20,
    gy: 68,
    zoom: 1.4,
    title: "Kiro's Cyber Cafe",
    subtitle: 'Cozy terracotta promenade roastery serving turbo espresso',
    durationMs: 6000,
  },
  {
    gx: 12,
    gy: 12,
    zoom: 1.25,
    title: "Astrid's Brass Observatory",
    subtitle: 'Mountain ridge telescope surveying deep sky nebulae and constellations',
    durationMs: 6500,
  },
  {
    gx: 50,
    gy: 96,
    zoom: 1.15,
    title: 'Boardwalk Surf & Ocean Horizon',
    subtitle: 'Golden sand coast, marine wildlife, speedboats & coastal sunset',
    durationMs: 7000,
  },
];

export class TourManager {
  private camera: Camera;
  private landmarks: TourLandmark[] = TOUR_LANDMARKS;
  private active = false;
  private currentIndex = 0;
  private legStartTime = 0;
  private startX = 0;
  private startY = 0;
  private startZoom = 1;
  private onLandmarkChange?: (landmark: TourLandmark, index: number, total: number) => void;
  private onExit?: () => void;

  constructor(
    camera: Camera,
    options?: {
      onLandmarkChange?: (landmark: TourLandmark, index: number, total: number) => void;
      onExit?: () => void;
    },
  ) {
    this.camera = camera;
    this.onLandmarkChange = options?.onLandmarkChange;
    this.onExit = options?.onExit;
  }

  get isRunning(): boolean {
    return this.active;
  }

  get currentLandmark(): TourLandmark {
    return this.landmarks[this.currentIndex] || this.landmarks[0];
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.currentIndex = 0;
    this.legStartTime = performance.now();
    this.startX = this.camera.x;
    this.startY = this.camera.y;
    this.startZoom = this.camera.zoom;

    const lm = this.currentLandmark;
    this.onLandmarkChange?.(lm, 0, this.landmarks.length);
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.onExit?.();
  }

  toggle(): boolean {
    if (this.active) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }

  tick(): void {
    if (!this.active) return;

    const now = performance.now();
    const lm = this.currentLandmark;
    const elapsed = now - this.legStartTime;
    const t = Math.min(1, Math.max(0, elapsed / lm.durationMs));

    // Smooth sinusoidal ease-in-out
    const ease = 0.5 - 0.5 * Math.cos(t * Math.PI);

    // Target world pixel coords
    const target = gridToWorldCenter(lm.gx, lm.gy);

    // Gentle camera drift
    const driftX = Math.sin(t * Math.PI * 2) * 14;
    const driftY = Math.cos(t * Math.PI * 2) * 10;

    const curX = this.startX + (target.wx + driftX - this.startX) * ease;
    const curY = this.startY + (target.wy + driftY - this.startY) * ease;
    const curZoom = this.startZoom + (lm.zoom - this.startZoom) * ease;

    this.camera.targetX = curX;
    this.camera.targetY = curY;
    this.camera.targetZoom = curZoom;

    // Check leg completion
    if (t >= 1) {
      this.currentIndex = (this.currentIndex + 1) % this.landmarks.length;
      this.legStartTime = now;
      this.startX = curX;
      this.startY = curY;
      this.startZoom = curZoom;

      const nextLm = this.currentLandmark;
      this.onLandmarkChange?.(nextLm, this.currentIndex, this.landmarks.length);
    }
  }
}
