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
    this.isMuted = true; // Always start muted to respect browser autoplay policies
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

    // 3. Periodic Natural Bird Chirps (Occasional & Natural)
    this.ambientInterval = window.setInterval(() => {
      if (this.isMuted) return;
      if (Math.random() < 0.55) {
        this.playBirdChirp();
      }
    }, 6500);
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
      const startTime = ctx.currentTime;
      const baseFreq = 2800 + Math.random() * 500;
      const chirpCount = Math.random() < 0.5 ? 2 : 3;

      for (let i = 0; i < chirpCount; i++) {
        const chirpStart = startTime + i * 0.09;
        const dur = 0.055;

        // Carrier oscillator
        const osc = ctx.createOscillator();
        osc.type = 'sine';

        // Fast pitch envelope for natural avian "pip"
        osc.frequency.setValueAtTime(baseFreq + (i === 1 ? 300 : 0), chirpStart);
        osc.frequency.exponentialRampToValueAtTime(baseFreq + 650 + (i === 1 ? 400 : 0), chirpStart + dur * 0.4);
        osc.frequency.exponentialRampToValueAtTime(baseFreq - 150, chirpStart + dur);

        // Micro-flutter vibrato for organic realism
        const vibrato = ctx.createOscillator();
        vibrato.frequency.setValueAtTime(38, chirpStart);
        const vibGain = ctx.createGain();
        vibGain.gain.setValueAtTime(45, chirpStart);
        vibrato.connect(vibGain);
        vibGain.connect(osc.frequency);

        // Soft gain envelope
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.001, chirpStart);
        gain.gain.linearRampToValueAtTime(0.06, chirpStart + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, chirpStart + dur);

        // Bandpass filter to remove harsh synthetic highs
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(baseFreq + 300, chirpStart);
        filter.Q.setValueAtTime(1.5, chirpStart);

        osc.connect(gain);
        gain.connect(filter);
        filter.connect(ctx.destination);

        vibrato.start(chirpStart);
        osc.start(chirpStart);
        vibrato.stop(chirpStart + dur);
        osc.stop(chirpStart + dur);
      }
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

  playTrainSound(proximity = 1.0): void {
    if (this.isMuted) return;
    const ctx = this.ctx;
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const vol = Math.max(0.04, Math.min(0.22, 0.22 * proximity));

      // 1. Distant Warm Two-Tone Train Horn Chime (A4 + C#5)
      const hornNotes = [440, 554.37];
      hornNotes.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(vol * 0.7, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 1.2);
      });

      // 2. Track Rumble (Low frequency filtered pink noise)
      const dur = 2.4;
      const bufferSize = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.08;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, now);

      const rGain = ctx.createGain();
      rGain.gain.setValueAtTime(0.001, now);
      rGain.gain.linearRampToValueAtTime(vol * 0.85, now + 0.4);
      rGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      noise.connect(filter);
      filter.connect(rGain);
      rGain.connect(ctx.destination);

      noise.start(now);
    } catch (_) {}
  }
}
