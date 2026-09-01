/**
 * AudioManager — Lightweight Web Audio API procedural environmental sound generator.
 *
 * Generates natural environmental ambiance and SFX with zero external asset dependencies:
 *  - Ambient wind breeze (low-pass noise)
 *  - Birds chirping (Central Park / Zen Garden)
 *  - Fountain & lake water trickles
 *  - Footstep ticks
 *  - Interactive SFX: duck quack, cat purr, fanfare chime, emote pop
 */

export class AudioManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = true;
  private windNode: AudioNode | null = null;
  private ambientInterval: number | null = null;

  constructor() {
    try {
      const saved = localStorage.getItem('spot_world_muted');
      this.isMuted = saved !== 'false'; // muted by default
    } catch {
      this.isMuted = true;
    }
  }

  get muted(): boolean {
    return this.isMuted;
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem('spot_world_muted', String(this.isMuted));
    } catch {}

    if (!this.isMuted) {
      this.ensureContext();
      this.startAmbient();
    } else {
      this.stopAmbient();
    }
    return this.isMuted;
  }

  private ensureContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  // ── Ambient Environmental Loop (Wind, Birds, Water) ──────────────────────

  private startAmbient(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.stopAmbient();

    // 1. Soft wind generator (filtered pink noise)
    try {
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        output[i] = (b0 + b1 + b2) * 0.04;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.06, ctx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      whiteNoise.start();
      this.windNode = gain;
    } catch (_) {}

    // 2. Periodic natural bird chirps & water droplets
    this.ambientInterval = window.setInterval(() => {
      if (this.isMuted) return;
      if (Math.random() < 0.45) {
        this.playBirdChirp();
      }
    }, 4500);
  }

  private stopAmbient(): void {
    if (this.ambientInterval) {
      clearInterval(this.ambientInterval);
      this.ambientInterval = null;
    }
    if (this.windNode) {
      try {
        (this.windNode as GainNode).gain.setValueAtTime(0, this.ctx?.currentTime || 0);
      } catch (_) {}
      this.windNode = null;
    }
  }

  // ── Procedural Sound Effects ──────────────────────────────────────────────

  playFootstep(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(80 + Math.random() * 20, ctx.currentTime);
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch (_) {}
  }

  playBirdChirp(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(2400 + Math.random() * 400, now);
      osc.frequency.exponentialRampToValueAtTime(3200 + Math.random() * 600, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(2200, now + 0.16);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    } catch (_) {}
  }

  playDuckQuack(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.12);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);
      filter.Q.setValueAtTime(4, now);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch (_) {}
  }

  playCatPurr(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(60, now);

      // Tremolo
      const tremolo = ctx.createOscillator();
      tremolo.frequency.setValueAtTime(22, now);
      const tremGain = ctx.createGain();
      tremGain.gain.setValueAtTime(0.08, now);

      tremolo.connect(tremGain);
      osc.connect(gain);
      gain.connect(ctx.destination);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      tremolo.start(now);
      osc.start(now);
      tremolo.stop(now + 0.6);
      osc.stop(now + 0.6);
    } catch (_) {}
  }

  playFanfare(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const now = ctx.currentTime + idx * 0.08;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.28);
      });
    } catch (_) {}
  }

  playEmotePop(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.06);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (_) {}
  }
}
