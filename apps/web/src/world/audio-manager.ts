/**
 * AudioManager — Natural Environmental Sound Engine for Spot World (Web Audio API).
 *
 * Synthesizes:
 * - Natural breeze & air currents
 * - Tree birds chirping in Central Park & Zen Garden
 * - Water fountain / stream bubbles
 * - Footsteps on cobblestone/asphalt
 * - Interactive SFX (Quacks, Purrs, Emote Pops, Discovery Fanfares)
 */

export class AudioManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = true;
  private windGain: GainNode | null = null;
  private waterGain: GainNode | null = null;
  private ambientInterval: number | null = null;

  constructor() {
    try {
      const saved = localStorage.getItem('spot_world_muted');
      this.isMuted = saved !== 'false'; // default muted until clicked
    } catch {
      this.isMuted = true;
    }
  }

  get muted(): boolean {
    return this.isMuted;
  }

  async toggleMute(): Promise<boolean> {
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem('spot_world_muted', String(this.isMuted));
    } catch {}

    if (!this.isMuted) {
      await this.ensureContext();
      this.startAmbient();
      // Play an instant pleasant confirmation chime
      this.playEmotePop();
    } else {
      this.stopAmbient();
    }
    return this.isMuted;
  }

  private async ensureContext(): Promise<AudioContext | null> {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (_) {}
    }
    return this.ctx;
  }

  // ── Ambient Environmental Loop (Air Breeze, Birds, Water) ────────────────

  private startAmbient(): void {
    if (this.isMuted) return;
    const ctx = this.ctx;
    if (!ctx) return;

    this.stopAmbient();

    // 1. Natural Wind / Air Breeze (Pink Noise generator)
    try {
      const bufferSize = ctx.sampleRate * 3;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        output[i] = (b0 + b1 + b2) * 0.08;
      }

      const windSource = ctx.createBufferSource();
      windSource.buffer = noiseBuffer;
      windSource.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18, ctx.currentTime);

      windSource.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      windSource.start();
      this.windGain = gain;
    } catch (_) {}

    // 2. Continuous Water Fountain Ambience
    try {
      const bufferSize = ctx.sampleRate * 2;
      const waterBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = waterBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.03;
      }

      const waterSource = ctx.createBufferSource();
      waterSource.buffer = waterBuffer;
      waterSource.loop = true;

      const bq = ctx.createBiquadFilter();
      bq.type = 'bandpass';
      bq.frequency.setValueAtTime(850, ctx.currentTime);
      bq.Q.setValueAtTime(1.8, ctx.currentTime);

      const wGain = ctx.createGain();
      wGain.gain.setValueAtTime(0.12, ctx.currentTime);

      waterSource.connect(bq);
      bq.connect(wGain);
      wGain.connect(ctx.destination);

      waterSource.start();
      this.waterGain = wGain;
    } catch (_) {}

    // 3. Periodic Natural Bird Chirps
    this.ambientInterval = window.setInterval(() => {
      if (this.isMuted) return;
      if (Math.random() < 0.65) {
        this.playBirdChirp();
      }
    }, 2800);
  }

  private stopAmbient(): void {
    if (this.ambientInterval) {
      clearInterval(this.ambientInterval);
      this.ambientInterval = null;
    }
    if (this.windGain && this.ctx) {
      try {
        this.windGain.gain.setValueAtTime(0, this.ctx.currentTime);
      } catch (_) {}
      this.windGain = null;
    }
    if (this.waterGain && this.ctx) {
      try {
        this.waterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      } catch (_) {}
      this.waterGain = null;
    }
  }

  // ── Procedural Sound Effects ──────────────────────────────────────────────

  playFootstep(): void {
    if (this.isMuted) return;
    const ctx = this.ctx;
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(110 + Math.random() * 30, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.04);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } catch (_) {}
  }

  playBirdChirp(): void {
    if (this.isMuted) return;
    const ctx = this.ctx;
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      const baseFreq = 2200 + Math.random() * 600;
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq + 800, now + 0.06);
      osc.frequency.exponentialRampToValueAtTime(baseFreq - 300, now + 0.14);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch (_) {}
  }

  playDuckQuack(): void {
    if (this.isMuted) return;
    const ctx = this.ctx;
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.15);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(900, now);
      filter.Q.setValueAtTime(3.5, now);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch (_) {}
  }

  playCatPurr(): void {
    if (this.isMuted) return;
    const ctx = this.ctx;
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(75, now);

      const tremolo = ctx.createOscillator();
      tremolo.frequency.setValueAtTime(25, now);
      const tremGain = ctx.createGain();
      tremGain.gain.setValueAtTime(0.15, now);

      tremolo.connect(tremGain);
      osc.connect(gain);
      gain.connect(ctx.destination);

      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      tremolo.start(now);
      osc.start(now);
      tremolo.stop(now + 0.7);
      osc.stop(now + 0.7);
    } catch (_) {}
  }

  playFanfare(): void {
    if (this.isMuted) return;
    const ctx = this.ctx;
    if (!ctx) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const now = ctx.currentTime + idx * 0.08;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.32);
      });
    } catch (_) {}
  }

  playEmotePop(): void {
    if (this.isMuted) return;
    const ctx = this.ctx;
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(920, now + 0.08);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch (_) {}
  }
}
