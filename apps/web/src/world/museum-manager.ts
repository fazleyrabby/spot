/**
 * MuseumManager — Walkable 2.5D Art Museum for art.fazleyrabbi.xyz
 * Only 2D Canvas arts (no WebGPU) for now. Walls hold iframes.
 */

import { TILE_WIDTH, TILE_HEIGHT } from '@spot/world';

export type MuseumFrame = {
  id: string;
  gx: number; // interior grid 0..M_W-1
  gy: number;
  slug: string;
  title: string;
  formula: string;
};

export const MUSEUM_DOOR = { gx: 60, gy: 38, wx: 60 * TILE_WIDTH + TILE_WIDTH/2, wy: 38 * TILE_HEIGHT + TILE_HEIGHT/2 };
export const MUSEUM_SIZE = { w: 22, h: 16 };

// 12 curated 2D-only arts (from art.fazleyrabbi.xyz — all Canvas2D 60fps, no WebGPU)
export const MUSEUM_FRAMES: MuseumFrame[] = [
  { id: 'f1', gx: 2, gy: 2, slug: 'organic-wave', title: 'Organic Wave', formula: 'y = sin(x*0.02+t)*cos(y*0.01+t*0.5)*35' },
  { id: 'f2', gx: 6, gy: 2, slug: 'phyllotaxis-spiral', title: 'Phyllotaxis Spiral', formula: 'θ=n*137.508°, r=c*√n' },
  { id: 'f3', gx: 10, gy: 2, slug: 'superformula-bloom', title: 'Superformula Bloom', formula: 'r = (|cos(mφ/4)/a|^n2+|sin(mφ/4)/b|^n3)^-1/n1' },
  { id: 'f4', gx: 14, gy: 2, slug: 'perlin-tendrils', title: 'Perlin Tendrils', formula: 'angle=fbm(x*0.003,y*0.003+t*0.15)*4π' },
  { id: 'f5', gx: 18, gy: 2, slug: 'barnsley-fern', title: 'Barnsley Fern', formula: 'IFS p=85% organic attractor' },
  { id: 'f6', gx: 2, gy: 13, slug: 'fibonacci-sunflower', title: 'Fibonacci Sunflower', formula: 'θ=n*137.508°, r=c√n' },
  { id: 'f7', gx: 6, gy: 13, slug: 'hyperbolic-tessellation', title: 'Hyperbolic Poincaré', formula: 'r_hyp=R*tanh(l*0.25)' },
  { id: 'f8', gx: 10, gy: 13, slug: 'sacred-mandala', title: 'Sacred Mandala', formula: 'rotate(2πk/N) polar symmetry' },
  { id: 'f9', gx: 14, gy: 13, slug: 'moire-interference', title: 'Moiré Interference', formula: 'beat = |k1-k2|' },
  { id: 'f10', gx: 18, gy: 13, slug: 'fractal-tree', title: 'L-System Tree', formula: 'branch(len*ratio, angle±Δθ)' },
  { id: 'f11', gx: 6, gy: 7, slug: 'fourier-harmonics', title: 'Fourier Harmonics', formula: 'r_k=(4/kπ)R, epicycle' },
  { id: 'f12', gx: 14, gy: 7, slug: 'lissajous-web', title: 'Lissajous Web', formula: 'x=sin(3φ+δ), y=sin(4φ)' },
];

export class MuseumManager {
  isInside = false;
  private exitGx = 52;
  private exitGy = 44;
  // interior player pos in museum local coords
  interiorGx = 11;
  interiorGy = 8;

  enter(exitGx: number, exitGy: number) {
    this.exitGx = exitGx;
    this.exitGy = exitGy;
    this.isInside = true;
  }
  exit() { this.isInside = false; }

  getExit() { return { gx: this.exitGx, gy: this.exitGy }; }

  // museum local (0..w-1, 0..h-1) → world pixel for rendering (center museum at world origin for camera)
  // We render museum centered at world (MUSEUM_SIZE.w/2 * TILE) so camera math stays simple
  localToWorld(lgx: number, lgy: number) {
    return { wx: lgx * TILE_WIDTH + TILE_WIDTH/2, wy: lgy * TILE_HEIGHT + TILE_HEIGHT/2 };
  }
}
