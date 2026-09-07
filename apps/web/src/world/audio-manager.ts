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

export type BiomeType = 'jungle' | 'forest' | 'beach' | 'city' | 'mountains' | 'ocean' | 'boardwalk';

function resolveBiome(gx: number, gy: number): BiomeType {
  if (gx < 0) return 'jungle';
  if (gx >= 100) return 'forest';
  if (gy <= -4) return 'mountains';
  if (gy >= -3 && gy <= -2) return 'mountains';
  if (gy === -1) return 'city';
  if (gy >= 98) return 'ocean';
  if (gy >= 96) return 'beach';
  if (gy >= 90) return 'beach';
  if (gy >= 88) return 'boardwalk';
  // city jungle pockets
  if (gx >= 55 && gy <= 36) return 'jungle'; // Central Park
  if (gx >= 55 && gy >= 55) return 'jungle'; // Zen Garden
  return 'city';
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = true;
  private windGain: GainNode | null = null;
  private waterGain: GainNode | null = null;
  private jungleGain: GainNode | null = null;
  private waveGain: GainNode | null = null;
  private cityGain: GainNode | null = null;
  private ambientInterval: number | null = null;
  private biome: BiomeType = 'city';
  private waveLfo: OscillatorNode | null = null;

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

  // ── Public Biome API ───────────────────────────────────────────────────
  /** Call each frame or on player move to crossfade ambience */
  public setPlayerPosition(gx: number, gy: number): void {
    const next = resolveBiome(gx, gy);
    if (next !== this.biome) {
      this.biome = next;
      if (!this.isMuted && this.ctx) this.crossfadeToBiome(next);
      this.restartBiomeChirps();
    }
  }

  private crossfadeToBiome(biome: BiomeType): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const fade = 1.1;

    const targets: Record<string, number> = {
      wind: 0.08,
      water: 0.02,
      jungle: 0.0,
      wave: 0.0,
      city: 0.0,
    };

    switch (biome) {
      case 'jungle':
      case 'forest':
        targets.jungle = 0.18;
        targets.water = 0.09;
        targets.wind = 0.06;
        targets.wave = 0.0;
        targets.city = 0.0;
        break;
      case 'beach':
      case 'boardwalk':
        targets.wave = 0.22;
        targets.wind = 0.12;
        targets.water = 0.03;
        targets.jungle = 0.04;
        break;
      case 'ocean':
        targets.wave = 0.28;
        targets.wind = 0.10;
        targets.water = 0.0;
        targets.jungle = 0.0;
        break;
      case 'mountains':
        targets.wind = 0.20;
        targets.wave = 0.0;
        targets.jungle = 0.02;
        break;
      case 'city':
      default:
        targets.city = 0.13;
        targets.wind = 0.09;
        targets.water = 0.05;
        targets.jungle = 0.03;
        break;
    }

    const ramp = (node: GainNode | null, v: number) => {
      if (!node || !this.ctx) return;
      try {
        node.gain.cancelScheduledValues(t);
        node.gain.linearRampToValueAtTime(node.gain.value, t);
        node.gain.linearRampToValueAtTime(v, t + fade);
      } catch (_) {}
    };

    ramp(this.windGain, targets.wind);
    ramp(this.waterGain, targets.water);
    ramp(this.jungleGain, targets.jungle);
    ramp(this.waveGain, targets.wave);
    ramp(this.cityGain, targets.city);

    // Filter tweaks for wind by biome
    // (kept simple — gain does most of the work)
  }

  private restartBiomeChirps(): void {
    if (this.ambientInterval) {
      clearInterval(this.ambientInterval);
      this.ambientInterval = null;
    }
    if (this.isMuted) return;

    const period = this.biome === 'jungle' || this.biome === 'forest' ? 3200 : this.biome === 'beach' || this.biome === 'boardwalk' || this.biome === 'ocean' ? 5200 : this.biome === 'city' ? 7000 : 8000;

    this.ambientInterval = window.setInterval(() => {
      if (this.isMuted) return;
      switch (this.biome) {
        case 'jungle':
        case 'forest':
          if (Math.random() < 0.75) this.playBirdChirp();
          if (Math.random() < 0.35) this.playInsectBuzz();
          if (Math.random() < 0.15) this.playWaterDrip();
          break;
        case 'beach':
        case 'boardwalk':
          if (Math.random() < 0.45) this.playGullCry();
          if (Math.random() < 0.30) this.playBirdChirp();
          break;
        case 'ocean':
          if (Math.random() < 0.50) this.playGullCry();
          break;
        case 'city':
          if (Math.random() < 0.25) this.playNeonBuzz();
          if (Math.random() < 0.20) this.playBirdChirp();
          break;
        case 'mountains':
          if (Math.random() < 0.30) this.playBirdChirp();
          if (Math.random() < 0.10) this.playWindHowl();
          break;
      }
    }, period);
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
      gain.gain.setValueAtTime(0.09, ctx.currentTime);

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
      wGain.gain.setValueAtTime(0.05, ctx.currentTime);

      waterSource.connect(bq);
      bq.connect(wGain);
      wGain.connect(ctx.destination);

      waterSource.start();
      this.waterGain = wGain;
    } catch (_) {}

    // 3. Jungle / Forest canopy rustle + creek
    try {
      const bufferSize = ctx.sampleRate * 2;
      const jBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = jBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.045;
      const src = ctx.createBufferSource();
      src.buffer = jBuffer;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1400, ctx.currentTime);
      bp.Q.setValueAtTime(0.9, ctx.currentTime);
      const jGain = ctx.createGain();
      jGain.gain.setValueAtTime(0.03, ctx.currentTime);
      src.connect(bp);
      bp.connect(jGain);
      jGain.connect(ctx.destination);
      src.start();
      this.jungleGain = jGain;
    } catch (_) {}

    // 4. Ocean waves — low surf with LFO
    try {
      const bufferSize = ctx.sampleRate * 4;
      const wBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = wBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.07;
      const src = ctx.createBufferSource();
      src.buffer = wBuffer;
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(220, ctx.currentTime);
      const wGain = ctx.createGain();
      wGain.gain.setValueAtTime(0.0, ctx.currentTime);
      // slow swell LFO 0.18 Hz
      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.18, ctx.currentTime);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0.07, ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(wGain.gain);
      src.connect(lp);
      lp.connect(wGain);
      wGain.connect(ctx.destination);
      src.start();
      lfo.start();
      this.waveGain = wGain;
      this.waveLfo = lfo;
    } catch (_) {}

    // 5. City hum — warm 80Hz filtered noise
    try {
      const bufferSize = ctx.sampleRate * 2;
      const cBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = cBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.035;
      const src = ctx.createBufferSource();
      src.buffer = cBuffer;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(110, ctx.currentTime);
      bp.Q.setValueAtTime(1.2, ctx.currentTime);
      const cGain = ctx.createGain();
      cGain.gain.setValueAtTime(0.0, ctx.currentTime);
      src.connect(bp);
      bp.connect(cGain);
      cGain.connect(ctx.destination);
      src.start();
      this.cityGain = cGain;
    } catch (_) {}

    // initialize to current biome
    this.crossfadeToBiome(this.biome);
    this.restartBiomeChirps();
  }

  private stopAmbient(): void {
    if (this.ambientInterval) {
      clearInterval(this.ambientInterval);
      this.ambientInterval = null;
    }
    const fadeOut = (node: GainNode | null) => {
      if (node && this.ctx) {
        try {
          node.gain.setValueAtTime(0, this.ctx.currentTime);
        } catch (_) {}
      }
    };
    fadeOut(this.windGain);
    fadeOut(this.waterGain);
    fadeOut(this.jungleGain);
    fadeOut(this.waveGain);
    fadeOut(this.cityGain);
    this.windGain = null;
    this.waterGain = null;
    this.jungleGain = null;
    this.waveGain = null;
    this.cityGain = null;
    if (this.waveLfo) {
      try { this.waveLfo.stop(); } catch (_) {}
      this.waveLfo = null;
    }
  }

  // ── Biome SFX ──────────────────────────────────────────────────────────
  private playInsectBuzz(): void {
    if (this.isMuted || !this.ctx) return;
    try {
      const ctx = this.ctx!;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(6200 + Math.random() * 800, now);
      osc.frequency.linearRampToValueAtTime(6200 + Math.random() * 400, now + 0.22);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.035, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(5500, now);
      bp.Q.setValueAtTime(2.0, now);
      osc.connect(bp);
      bp.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    } catch (_) {}
  }

  private playWaterDrip(): void {
    if (this.isMuted || !this.ctx) return;
    try {
      const ctx = this.ctx!;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.14);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch (_) {}
  }

  private playGullCry(): void {
    if (this.isMuted || !this.ctx) return;
    try {
      const ctx = this.ctx!;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.linearRampToValueAtTime(1350, now + 0.22);
      osc.frequency.linearRampToValueAtTime(1050, now + 0.45);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      const vib = ctx.createOscillator();
      vib.frequency.setValueAtTime(18, now);
      const vg = ctx.createGain();
      vg.gain.setValueAtTime(80, now);
      vib.connect(vg);
      vg.connect(osc.frequency);
      osc.connect(gain);
      gain.connect(ctx.destination);
      vib.start(now);
      osc.start(now);
      vib.stop(now + 0.48);
      osc.stop(now + 0.48);
    } catch (_) {}
  }

  private playWindHowl(): void {
    if (this.isMuted || !this.ctx) return;
    try {
      const ctx = this.ctx!;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.linearRampToValueAtTime(150, now + 0.9);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(800, now);
      osc.connect(lp);
      lp.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.1);
    } catch (_) {}
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

  playWhoosh(): void {
    if (this.isMuted) return;
    const ctx = this.ctx;
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.22);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.35);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
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

  playCarHorn(proximity = 1.0, type: 'taxi' | 'synthwave' | 'van' | 'scooter' = 'taxi'): void {
    if (this.isMuted) return;
    const ctx = this.ctx;
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const vol = Math.max(0.04, Math.min(0.24, 0.24 * proximity));

      if (type === 'scooter') {
        // High-pitched nimble scooter beep-beep
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(980, now + 0.08);

        gain.gain.setValueAtTime(vol * 0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
      } else if (type === 'synthwave') {
        // Dual-tone futuristic cyber pulse horn (sawtooth filtered)
        [440, 554.37].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(1200, now);

          gain.gain.setValueAtTime(vol * 0.5, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now);
          osc.stop(now + 0.22);
        });
      } else {
        // Classic city cab double-tap horn (F4 + A4)
        [349.23, 440].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now);

          // Double beep
          gain.gain.setValueAtTime(vol * 0.75, now);
          gain.gain.setValueAtTime(0.001, now + 0.08);
          gain.gain.setValueAtTime(vol * 0.75, now + 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now);
          osc.stop(now + 0.28);
        });
      }
    } catch (_) {}
  }

  playCarPass(proximity = 1.0): void {
    if (this.isMuted) return;
    const ctx = this.ctx;
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const vol = Math.max(0.02, Math.min(0.12, 0.12 * proximity));

      // Gentle electric motor Doppler whoosh
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(95, now);
      osc.frequency.exponentialRampToValueAtTime(145, now + 0.25);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.6);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.65);
    } catch (_) {}
  }

  playDiscoveryFanfare(): void {
    if (this.isMuted) return;
    const ctx = this.ctx;
    if (!ctx) return;

    try {
      const notes = [659.25, 830.61, 987.77, 1318.51]; // E5, G#5, B5, E6
      notes.forEach((freq, idx) => {
        const now = ctx.currentTime + idx * 0.07;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.28);
      });
    } catch (_) {}
  }

  playNeonBuzz(): void {
    if (this.isMuted) return;
    const ctx = this.ctx;
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now); // 120Hz mains hum

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(480, now);
      filter.Q.setValueAtTime(3.0, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch (_) {}
  }

  // ── Marine Click SFX ────────────────────────────────────────────────────
  playMarineClickSound(kind: 'shark' | 'speedboat' | 'surfer' | 'ship'): void {
    if (this.isMuted) return;
    const ctx = this.ctx;
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      if (kind === 'shark') {
        // Low menacing growl — deep sawtooth sweep
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.linearRampToValueAtTime(65, now + 0.35);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, now);
        filter.Q.setValueAtTime(2.5, now);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.4);

        // Second harmonic for bite
        const osc2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(180, now);
        osc2.frequency.linearRampToValueAtTime(90, now + 0.25);
        g2.gain.setValueAtTime(0.14, now);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc2.connect(g2);
        g2.connect(ctx.destination);
        osc2.start(now);
        osc2.stop(now + 0.3);
      } else if (kind === 'speedboat') {
        // Motor rev — rapid sawtooth pitch rise then fall
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.linearRampToValueAtTime(380, now + 0.12);
        osc.frequency.linearRampToValueAtTime(160, now + 0.3);
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(600, now);
        filter.Q.setValueAtTime(1.8, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.25, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.32);
      } else if (kind === 'surfer') {
        // Splash — filtered noise burst
        const dur = 0.28;
        const bufSize = Math.floor(ctx.sampleRate * dur);
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(2200, now);
        bp.frequency.exponentialRampToValueAtTime(800, now + dur);
        bp.Q.setValueAtTime(0.7, now);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        src.connect(bp);
        bp.connect(gain);
        gain.connect(ctx.destination);
        src.start(now);
        src.stop(now + dur);
      } else if (kind === 'dolphin') {
        // Dolphin click chatter — rapid sine chirps
        for (let i = 0; i < 4; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1200 + i * 180, now + i * 0.04);
          osc.frequency.exponentialRampToValueAtTime(800 + i * 120, now + i * 0.04 + 0.06);
          gain.gain.setValueAtTime(0.18, now + i * 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.07);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.04);
          osc.stop(now + i * 0.04 + 0.07);
        }
      } else {
        // Ship — deep foghorn: two-tone sine, long sustain
        [82.41, 110].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(300, now);
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.2, now + 0.12);
          gain.gain.setValueAtTime(0.2, now + 0.35);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.7);
        });
      }
    } catch (_) {}
  }

  // ── Jungle Animal Click SFX ─────────────────────────────────────────────
  playJungleAnimalSound(id: string): void {
    if (this.isMuted) return;
    const ctx = this.ctx;
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      if (id === 'jungle_monkeys') {
        // Chittering chirps — rapid alternating sine bursts
        for (let i = 0; i < 5; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1800 + (i % 2) * 600, now + i * 0.055);
          osc.frequency.exponentialRampToValueAtTime(1200 + (i % 2) * 400, now + i * 0.055 + 0.04);
          gain.gain.setValueAtTime(0.15, now + i * 0.055);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.05);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.055);
          osc.stop(now + i * 0.055 + 0.05);
        }
      } else if (id === 'jungle_macaw') {
        // Squawk — harsh sawtooth sweep with vibrato
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.linearRampToValueAtTime(2200, now + 0.08);
        osc.frequency.linearRampToValueAtTime(1600, now + 0.22);
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1800, now);
        filter.Q.setValueAtTime(2.5, now);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (id === 'jungle_panther') {
        // Deep growl — low sawtooth with slow rumble
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(85, now);
        osc.frequency.linearRampToValueAtTime(65, now + 0.4);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(350, now);
        filter.Q.setValueAtTime(2, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.45);
        // Rumble overtone
        const osc2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(130, now);
        osc2.frequency.linearRampToValueAtTime(80, now + 0.3);
        g2.gain.setValueAtTime(0.12, now);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc2.connect(g2);
        g2.connect(ctx.destination);
        osc2.start(now);
        osc2.stop(now + 0.35);
      } else if (id === 'jungle_treefrog') {
        // Ribbit — two quick sine pops
        for (let i = 0; i < 2; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, now + i * 0.14);
          osc.frequency.exponentialRampToValueAtTime(350, now + i * 0.14 + 0.08);
          gain.gain.setValueAtTime(0.22, now + i * 0.14);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.1);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.14);
          osc.stop(now + i * 0.14 + 0.1);
        }
      } else if (id === 'jungle_sloth') {
        // Slow drawn-out groan
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(180, now + 0.6);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.14, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.7);
      } else if (id === 'jungle_tiger') {
        // Roar — rising sawtooth + low rumble
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.linearRampToValueAtTime(250, now + 0.15);
        osc.frequency.linearRampToValueAtTime(140, now + 0.5);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.55);
      } else if (id === 'jungle_caiman') {
        // Snap — sharp noise burst + low growl
        const dur = 0.12;
        const bufSize = Math.floor(ctx.sampleRate * dur);
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(1200, now);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        src.connect(hp);
        hp.connect(gain);
        gain.connect(ctx.destination);
        src.start(now);
        src.stop(now + dur);
        // trailing growl
        const gosc = ctx.createOscillator();
        const gg = ctx.createGain();
        gosc.type = 'sawtooth';
        gosc.frequency.setValueAtTime(90, now + 0.08);
        gg.gain.setValueAtTime(0.1, now + 0.08);
        gg.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        gosc.connect(gg);
        gg.connect(ctx.destination);
        gosc.start(now + 0.08);
        gosc.stop(now + 0.3);
      } else if (id === 'jungle_capybaras') {
        // Squeak-purr — gentle sine chirp + low purr
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(900, now);
        osc.frequency.exponentialRampToValueAtTime(1100, now + 0.06);
        osc.frequency.exponentialRampToValueAtTime(700, now + 0.15);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (id === 'jungle_parrots') {
        // Kree-kree — two quick high squawks
        for (let i = 0; i < 2; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(2000 + i * 200, now + i * 0.1);
          osc.frequency.linearRampToValueAtTime(2400 + i * 200, now + i * 0.1 + 0.05);
          osc.frequency.linearRampToValueAtTime(1800, now + i * 0.1 + 0.1);
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(2200, now);
          filter.Q.setValueAtTime(2, now);
          gain.gain.setValueAtTime(0.14, now + i * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.12);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.1);
          osc.stop(now + i * 0.1 + 0.12);
        }
      } else if (id === 'jungle_tamarin') {
        // High-pitched chirp — rapid sine trill
        for (let i = 0; i < 3; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(3200 + i * 300, now + i * 0.04);
          osc.frequency.exponentialRampToValueAtTime(2600, now + i * 0.04 + 0.05);
          gain.gain.setValueAtTime(0.12, now + i * 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.06);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.04);
          osc.stop(now + i * 0.04 + 0.06);
        }
      }
    } catch (_) {}
  }
}
