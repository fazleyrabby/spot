/**
 * WeatherManager — Atmospheric Weather System for Spot World.
 *
 * Provides:
 * 1. Cyber Neon Rain:
 *    - Angled cyan-white rain streaks falling at high velocity.
 *    - Ground impact splash ripples (expanding elliptical rings).
 *    - Ambient stormy cyber wash.
 * 2. Cyber Motes / Fireflies:
 *    - Gentle floating bioluminescent motes with pulsing glow and sinusoidal drift.
 * 3. Clear:
 *    - Crisp, serene metropolis sky with subtle occasional ambient floaters.
 *
 * Performance:
 * - 100% pre-allocated particle pools (zero Garbage Collection in render loop).
 * - High-performance Canvas2D rendering.
 */

export type WeatherMode = 'clear' | 'rain' | 'motes';

interface RainDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  width: number;
  alpha: number;
}

interface SplashRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  active: boolean;
}

interface CyberMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseRadius: number;
  color: string;
  glowColor: string;
  phase: number;
  phaseSpeed: number;
}

export class WeatherManager {
  private mode: WeatherMode = 'clear';

  // Rain particle pool
  private readonly rainDrops: RainDrop[] = [];
  private readonly maxRainDrops = 140;

  // Splash ripple pool
  private readonly ripples: SplashRipple[] = [];
  private readonly maxRipples = 32;

  // Cyber motes pool
  private readonly motes: CyberMote[] = [];
  private readonly maxMotes = 50;

  // Frame counter for pulsation
  private frame = 0;

  constructor() {
    this.initRainPool();
    this.initRipplesPool();
    this.initMotesPool();

    // Load saved weather preference if any
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('spot_weather_mode') as WeatherMode | null;
        if (saved && (saved === 'clear' || saved === 'rain' || saved === 'motes')) {
          this.mode = saved;
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  getWeather(): WeatherMode {
    return this.mode;
  }

  setWeather(mode: WeatherMode): void {
    this.mode = mode;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('spot_weather_mode', mode);
      }
    } catch {
      // Ignore storage errors
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Pool Initializations                                                       */
  /* -------------------------------------------------------------------------- */

  private initRainPool(): void {
    for (let i = 0; i < this.maxRainDrops; i++) {
      this.rainDrops.push({
        x: Math.random() * 2000,
        y: Math.random() * 1200,
        vx: -1.5 - Math.random() * 1.5,
        vy: 14 + Math.random() * 8,
        length: 14 + Math.random() * 16,
        width: 1 + Math.random() * 0.8,
        alpha: 0.35 + Math.random() * 0.45,
      });
    }
  }

  private initRipplesPool(): void {
    for (let i = 0; i < this.maxRipples; i++) {
      this.ripples.push({
        x: 0,
        y: 0,
        radius: 1,
        maxRadius: 6 + Math.random() * 6,
        alpha: 0,
        active: false,
      });
    }
  }

  private initMotesPool(): void {
    const palette = [
      { color: '#38bdf8', glow: 'rgba(56, 189, 248, 0.4)' },
      { color: '#fbbf24', glow: 'rgba(251, 191, 36, 0.4)' },
      { color: '#34d399', glow: 'rgba(52, 211, 153, 0.4)' },
      { color: '#c084fc', glow: 'rgba(192, 132, 252, 0.4)' },
    ];

    for (let i = 0; i < this.maxMotes; i++) {
      const p = palette[i % palette.length];
      this.motes.push({
        x: Math.random() * 2000,
        y: Math.random() * 1200,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.2 - Math.random() * 0.35,
        baseRadius: 1.5 + Math.random() * 2,
        color: p.color,
        glowColor: p.glow,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: 0.03 + Math.random() * 0.04,
      });
    }
  }

  private spawnRipple(x: number, y: number): void {
    for (const r of this.ripples) {
      if (!r.active) {
        r.x = x;
        r.y = y;
        r.radius = 1;
        r.alpha = 0.6;
        r.active = true;
        break;
      }
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Update & Render Cycles                                                     */
  /* -------------------------------------------------------------------------- */

  tick(viewportW: number, viewportH: number): void {
    this.frame++;

    // 1. Rain drops
    if (this.mode === 'rain') {
      for (const d of this.rainDrops) {
        d.x += d.vx;
        d.y += d.vy;

        // Hit bottom / ground threshold
        if (d.y > viewportH + 20 || d.x < -40) {
          if (Math.random() < 0.35) {
            this.spawnRipple(d.x, Math.min(d.y, viewportH - Math.random() * 80));
          }
          d.y = -20 - Math.random() * 60;
          d.x = Math.random() * (viewportW + 300) - 50;
        }
      }

      // 2. Splash ripples
      for (const r of this.ripples) {
        if (!r.active) continue;
        r.radius += 0.55;
        r.alpha -= 0.035;
        if (r.alpha <= 0 || r.radius >= r.maxRadius) {
          r.active = false;
        }
      }
    }

    // 3. Cyber Motes
    if (this.mode === 'motes' || this.mode === 'clear') {
      const activeCount = this.mode === 'motes' ? this.maxMotes : 15;
      for (let i = 0; i < activeCount; i++) {
        const m = this.motes[i];
        m.phase += m.phaseSpeed;
        m.x += m.vx + Math.sin(m.phase) * 0.3;
        m.y += m.vy;

        if (m.y < -20) {
          m.y = viewportH + 20;
          m.x = Math.random() * viewportW;
        }
        if (m.x < -20) m.x = viewportW + 20;
        if (m.x > viewportW + 20) m.x = -20;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, viewportW: number, viewportH: number): void {
    if (this.mode === 'rain') {
      this.renderRain(ctx, viewportW, viewportH);
    } else if (this.mode === 'motes') {
      this.renderMotes(ctx, this.maxMotes);
    } else {
      // Subtle clear sky occasional ambient dust
      this.renderMotes(ctx, 15);
    }
  }

  private renderRain(ctx: CanvasRenderingContext2D, viewportW: number, viewportH: number): void {
    ctx.save();

    // Subtle dark ambient rain overlay
    ctx.fillStyle = 'rgba(10, 20, 35, 0.16)';
    ctx.fillRect(0, 0, viewportW, viewportH);

    // 1. Draw ripples on ground
    for (const r of this.ripples) {
      if (!r.active || r.alpha <= 0) continue;
      ctx.save();
      ctx.strokeStyle = `rgba(56, 189, 248, ${r.alpha.toFixed(2)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      // Elliptical perspective ring
      ctx.ellipse(r.x, r.y, r.radius * 1.6, r.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Draw rain streaks
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.65)';
    ctx.lineCap = 'round';

    ctx.beginPath();
    for (const d of this.rainDrops) {
      if (d.x < -30 || d.x > viewportW + 30 || d.y < -30 || d.y > viewportH + 30) continue;
      ctx.lineWidth = d.width;
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + d.vx * (d.length / d.vy), d.y - d.length);
    }
    ctx.stroke();

    ctx.restore();
  }

  private renderMotes(ctx: CanvasRenderingContext2D, count: number): void {
    ctx.save();
    for (let i = 0; i < count; i++) {
      const m = this.motes[i];
      const pulse = 0.5 + Math.sin(m.phase) * 0.5; // 0..1
      const radius = m.baseRadius * (0.8 + pulse * 0.4);
      const alpha = 0.25 + pulse * 0.55;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = m.color;
      ctx.shadowColor = m.glowColor;
      ctx.shadowBlur = 6;

      ctx.beginPath();
      ctx.arc(m.x, m.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}
