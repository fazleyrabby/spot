/**
 * VignetteManager — Living Floor796-Inspired Interactive Micro-Scenes in Spot World.
 *
 * Handcrafted dynamic pixel vignettes:
 * 1. Takeshi the Master Ramen Chef (Downtown, gx: 28, gy: 18) — Steaming wok, broth pot, hungry tabby cat.
 * 2. Zero-X the Netrunner (Downtown Alley, gx: 12, gy: 28) — Overturned crate, holographic matrix code.
 * 3. Jax the Grid Technician (Railside, gx: 42, gy: 12) — Welding transformer, arc flashes, spark burst particles.
 * 4. Blitz the Cyber B-Boy (Plaza, gx: 58, gy: 45) — Boombox with pulsing EQ rings, breakdancer routines.
 * 5. Dex the Thirsty Nomad (Downtown Automat, gx: 22, gy: 62) — Kicking vending machine, falling soda can.
 * 6. Master Sora & Koi Pond (Zen Gardens, gx: 74, gy: 68) — Floating meditation, swimming koi fish, ripples.
 * 7. Astrid the Horizon Watcher (Boardwalk, gx: 82, gy: 101) — Brass telescope, ocean breeze, lens glint.
 * 8. Midnight Whiskers Clowder (Cafe Promenade, gx: 16, gy: 78) — Warm grate cat, tail swishing, neon moth batting.
 */

import { TILE_WIDTH, TILE_HEIGHT } from '@spot/world';
import type { Camera } from './camera.js';

export interface VignetteSpeech {
  text: string;
  author: string;
  age: number;
  maxAge: number;
  color: string;
}

export interface InteractiveVignette {
  id: string;
  name: string;
  title: string;
  district: string;
  gx: number;
  gy: number;
  wx: number;
  wy: number;
  interactRadius: number;
  speech: VignetteSpeech | null;
  onInteract?: () => void;
}

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface MatrixGlyph {
  x: number;
  y: number;
  vy: number;
  char: string;
  alpha: number;
}

interface WaterRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

export class VignetteManager {
  readonly vignettes: InteractiveVignette[] = [
    {
      id: 'ramen_chef',
      name: 'Takeshi',
      title: 'Master Ramen Artisan',
      district: 'Downtown Cyber District',
      gx: 28,
      gy: 18,
      wx: 28 * TILE_WIDTH + TILE_WIDTH / 2,
      wy: 18 * TILE_HEIGHT + TILE_HEIGHT / 2,
      interactRadius: 36,
      speech: null,
    },
    {
      id: 'alley_hacker',
      name: 'Zero-X',
      title: 'Rogue Cyber Netrunner',
      district: 'Downtown Cyber District',
      gx: 12,
      gy: 28,
      wx: 12 * TILE_WIDTH + TILE_WIDTH / 2,
      wy: 28 * TILE_HEIGHT + TILE_HEIGHT / 2,
      interactRadius: 36,
      speech: null,
    },
    {
      id: 'street_solderer',
      name: 'Jax',
      title: 'High-Voltage Grid Technician',
      district: 'Northern Railside',
      gx: 42,
      gy: 12,
      wx: 42 * TILE_WIDTH + TILE_WIDTH / 2,
      wy: 12 * TILE_HEIGHT + TILE_HEIGHT / 2,
      interactRadius: 36,
      speech: null,
    },
    {
      id: 'boombox_dancer',
      name: 'Blitz',
      title: 'Cyber B-Boy & Beatboxer',
      district: 'Grand Central Plaza',
      gx: 58,
      gy: 45,
      wx: 58 * TILE_WIDTH + TILE_WIDTH / 2,
      wy: 45 * TILE_HEIGHT + TILE_HEIGHT / 2,
      interactRadius: 36,
      speech: null,
    },
    {
      id: 'automat_kicker',
      name: 'Dex',
      title: 'Thirsty Cyber Wanderer',
      district: 'Cafe Promenade Border',
      gx: 22,
      gy: 62,
      wx: 22 * TILE_WIDTH + TILE_WIDTH / 2,
      wy: 62 * TILE_HEIGHT + TILE_HEIGHT / 2,
      interactRadius: 36,
      speech: null,
    },
    {
      id: 'zen_meditator',
      name: 'Master Sora',
      title: 'Quiet Koi Sage',
      district: 'Zen Gardens',
      gx: 74,
      gy: 68,
      wx: 74 * TILE_WIDTH + TILE_WIDTH / 2,
      wy: 68 * TILE_HEIGHT + TILE_HEIGHT / 2,
      interactRadius: 36,
      speech: null,
    },
    {
      id: 'boardwalk_stargazer',
      name: 'Astrid',
      title: 'Deep Ocean Watcher',
      district: 'Coastal Timber Boardwalk',
      gx: 82,
      gy: 101,
      wx: 82 * TILE_WIDTH + TILE_WIDTH / 2,
      wy: 101 * TILE_HEIGHT + TILE_HEIGHT / 2,
      interactRadius: 36,
      speech: null,
    },
    {
      id: 'cat_gathering',
      name: 'Midnight Whiskers',
      title: 'Alley Clowder of Spot City',
      district: 'Cafe Promenade',
      gx: 16,
      gy: 78,
      wx: 16 * TILE_WIDTH + TILE_WIDTH / 2,
      wy: 78 * TILE_HEIGHT + TILE_HEIGHT / 2,
      interactRadius: 36,
      speech: null,
    },
    {
      id: 'seaside_binoculars',
      name: 'Captain Barnacle',
      title: 'Boardwalk Lookout Watch',
      district: 'Coastal Timber Boardwalk',
      gx: 32,
      gy: 101,
      wx: 32 * TILE_WIDTH + TILE_WIDTH / 2,
      wy: 101 * TILE_HEIGHT + TILE_HEIGHT / 2,
      interactRadius: 36,
      speech: null,
    },
    {
      id: 'swan_pedal_boat',
      name: 'Penelope & Pip',
      title: 'Central Park Swan Boaters',
      district: 'Central Park Lake',
      gx: 72,
      gy: 25,
      wx: 72 * TILE_WIDTH + TILE_WIDTH / 2,
      wy: 25 * TILE_HEIGHT + TILE_HEIGHT / 2,
      interactRadius: 40,
      speech: null,
    },

    // ── 9. Western Emerald Jungle Wildlife ─────────────────────────────────
    {
      id: 'jungle_monkeys',
      name: 'Koko & Milo',
      title: 'Capuchin Monkey Acrobats',
      district: 'Western Emerald Jungle',
      gx: -12,
      gy: 35,
      wx: -12 * TILE_WIDTH + TILE_WIDTH / 2,
      wy: 35 * TILE_HEIGHT + TILE_HEIGHT / 2,
      interactRadius: 36,
      speech: null,
    },
    {
      id: 'jungle_macaw',
      name: 'Rio & Coral',
      title: 'Scarlet Macaw & Toucan',
      district: 'Western Emerald Jungle',
      gx: -16,
      gy: 60,
      wx: -16 * TILE_WIDTH + TILE_WIDTH / 2,
      wy: 60 * TILE_HEIGHT + TILE_HEIGHT / 2,
      interactRadius: 36,
      speech: null,
    },
    {
      id: 'jungle_panther',
      name: 'Shadow',
      title: 'Midnight Jungle Jaguar',
      district: 'Western Emerald Jungle',
      gx: -8,
      gy: 18,
      wx: -8 * TILE_WIDTH + TILE_WIDTH / 2,
      wy: 18 * TILE_HEIGHT + TILE_HEIGHT / 2,
      interactRadius: 36,
      speech: null,
    },
    {
      id: 'jungle_treefrog',
      name: 'Pepe',
      title: 'Red-Eyed Tree Frog',
      district: 'Western Emerald Jungle',
      gx: -14,
      gy: 78,
      wx: -14 * TILE_WIDTH + TILE_WIDTH / 2,
      wy: 78 * TILE_HEIGHT + TILE_HEIGHT / 2,
      interactRadius: 32,
      speech: null,
    },
    {
      id: 'jungle_sloth',
      name: 'Bramble',
      title: 'Three-Toed Tree Sloth',
      district: 'Western Emerald Jungle',
      gx: -22,
      gy: 46,
      wx: -22 * TILE_WIDTH + TILE_WIDTH / 2,
      wy: 46 * TILE_HEIGHT + TILE_HEIGHT / 2,
      interactRadius: 36,
      speech: null,
    },

    // ── 10. Eastern Emerald Jungle Wildlife ─────────────────────────────────
    {
      id: 'jungle_tiger',
      name: 'Raja',
      title: 'Royal Bengal Tiger',
      district: 'Eastern Emerald Jungle',
      gx: 114,
      gy: 28,
      wx: 114 * TILE_WIDTH + TILE_WIDTH / 2,
      wy: 28 * TILE_HEIGHT + TILE_HEIGHT / 2,
      interactRadius: 40,
      speech: null,
    },
    {
      id: 'jungle_caiman',
      name: 'Snappy',
      title: 'Jungle River Caiman',
      district: 'Eastern Emerald Jungle',
      gx: 120,
      gy: 56,
      wx: 120 * TILE_WIDTH + TILE_WIDTH / 2,
      wy: 56 * TILE_HEIGHT + TILE_HEIGHT / 2,
      interactRadius: 36,
      speech: null,
    },
    {
      id: 'jungle_capybaras',
      name: 'Barnaby & Luna',
      title: 'Capybara Family Sanctuary',
      district: 'Eastern Emerald Jungle',
      gx: 112,
      gy: 72,
      wx: 112 * TILE_WIDTH + TILE_WIDTH / 2,
      wy: 72 * TILE_HEIGHT + TILE_HEIGHT / 2,
      interactRadius: 38,
      speech: null,
    },
    {
      id: 'jungle_parrots',
      name: 'Azure & Sunshine',
      title: 'Emerald Parrots & Hornbill',
      district: 'Eastern Emerald Jungle',
      gx: 126,
      gy: 40,
      wx: 126 * TILE_WIDTH + TILE_WIDTH / 2,
      wy: 40 * TILE_HEIGHT + TILE_HEIGHT / 2,
      interactRadius: 36,
      speech: null,
    },
    {
      id: 'jungle_tamarin',
      name: 'Mango',
      title: 'Golden Lion Tamarin',
      district: 'Eastern Emerald Jungle',
      gx: 108,
      gy: 86,
      wx: 108 * TILE_WIDTH + TILE_WIDTH / 2,
      wy: 86 * TILE_HEIGHT + TILE_HEIGHT / 2,
      interactRadius: 34,
      speech: null,
    },
  ];

  // Procedural Animation Timers & Particle Pools
  private animTick = 0;
  private sparks: SparkParticle[] = [];
  private matrixGlyphs: MatrixGlyph[] = [];
  private ripples: WaterRipple[] = [];

  // Special State Variables
  private automatKickTimer = 0;
  private sodaCanOffset = 0;
  private danceRoutine = 0;
  private catHearts: { x: number; y: number; alpha: number }[] = [];

  // Audio callback trigger
  onPlaySFX?: (type: 'solder' | 'purr' | 'beat' | 'vending' | 'splash' | 'chime' | 'code' | 'quack') => void;

  constructor() {
    this.initMatrixGlyphs();
  }

  private initMatrixGlyphs(): void {
    const chars = '0123456789ABCDEFｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ';
    for (let i = 0; i < 16; i++) {
      this.matrixGlyphs.push({
        x: (Math.random() - 0.5) * 20,
        y: -Math.random() * 24,
        vy: -0.2 - Math.random() * 0.4,
        char: chars[Math.floor(Math.random() * chars.length)] ?? '1',
        alpha: 0.3 + Math.random() * 0.7,
      });
    }
  }

  tick(): void {
    this.animTick++;

    // 1. Update Sparks (Solderer)
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i]!;
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.vy += 0.08; // Gravity
      sp.life++;
      if (sp.life >= sp.maxLife) {
        this.sparks.splice(i, 1);
      }
    }

    // Occasionally spawn welding sparks
    if (this.animTick % 6 === 0 && Math.sin(this.animTick * 0.05) > 0.2) {
      this.spawnWeldingSparks();
    }

    // 2. Update Matrix Glyphs (Hacker)
    for (const g of this.matrixGlyphs) {
      g.y += g.vy;
      if (g.y < -32) {
        g.y = -6;
        g.x = (Math.random() - 0.5) * 22;
        g.alpha = 0.8;
      }
      g.alpha = Math.max(0, g.alpha - 0.008);
    }

    // 3. Update Water Ripples (Zen Garden Koi)
    if (this.animTick % 45 === 0) {
      const koiAngle = this.animTick * 0.04;
      const kx = Math.cos(koiAngle) * 14;
      const ky = Math.sin(koiAngle) * 8;
      this.ripples.push({ x: kx, y: ky, radius: 2, maxRadius: 16, alpha: 0.7 });
    }
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i]!;
      r.radius += 0.3;
      r.alpha -= 0.015;
      if (r.alpha <= 0) this.ripples.splice(i, 1);
    }

    // 4. Update Cat Hearts
    for (let i = this.catHearts.length - 1; i >= 0; i--) {
      const h = this.catHearts[i]!;
      h.y -= 0.4;
      h.alpha -= 0.015;
      if (h.alpha <= 0) this.catHearts.splice(i, 1);
    }

    // 5. Automat Kicker Animation Cycle
    if (this.automatKickTimer > 0) {
      this.automatKickTimer--;
      if (this.automatKickTimer === 20) {
        this.sodaCanOffset = 1; // Can drops!
      }
    }

    // 6. Speech bubble age
    for (const v of this.vignettes) {
      if (v.speech) {
        v.speech.age++;
        if (v.speech.age >= v.speech.maxAge) {
          v.speech = null;
        }
      }
    }
  }

  private spawnWeldingSparks(): void {
    for (let i = 0; i < 4; i++) {
      this.sparks.push({
        x: 6 + (Math.random() - 0.5) * 4,
        y: -14 + (Math.random() - 0.5) * 4,
        vx: (Math.random() - 0.5) * 2.5,
        vy: -1.2 - Math.random() * 2.0,
        life: 0,
        maxLife: 15 + Math.floor(Math.random() * 15),
        color: Math.random() > 0.3 ? '#fef08a' : '#67e8f9',
        size: 1 + Math.random() * 1.5,
      });
    }
  }

  // ── Interaction Hit-Testing ───────────────────────────────────────────────

  handleClick(wx: number, wy: number): InteractiveVignette | null {
    for (const v of this.vignettes) {
      const dist = Math.hypot(wx - v.wx, wy - v.wy);
      if (dist <= v.interactRadius) {
        this.triggerVignette(v);
        return v;
      }
    }
    return null;
  }

  getHoveredVignette(wx: number, wy: number): InteractiveVignette | null {
    for (const v of this.vignettes) {
      const dist = Math.hypot(wx - v.wx, wy - v.wy);
      if (dist <= v.interactRadius) return v;
    }
    return null;
  }

  triggerVignette(v: InteractiveVignette): void {
    switch (v.id) {
      case 'ramen_chef': {
        const quotes = [
          'Order up! 18-hour tonkotsu broth boiled to perfection!',
          'Fresh handmade noodles ready for the night shift.',
          'Special spicy miso for traveling coders!',
        ];
        this.setSpeech(v, quotes[Math.floor(Math.random() * quotes.length)]!, '#f59e0b');
        this.onPlaySFX?.('solder');
        break;
      }
      case 'alley_hacker': {
        const quotes = [
          'Decentralized sub-mesh breached. Decrypting block cipher...',
          'Pinging Genesis Monolith node... response: 12ms.',
          'Shh! Corporate netsec scanners are sweeping sector 4.',
        ];
        this.setSpeech(v, quotes[Math.floor(Math.random() * quotes.length)]!, '#22c55e');
        this.onPlaySFX?.('code');
        break;
      }
      case 'street_solderer': {
        const quotes = [
          'Watch your step! 50,000 volts running through these superconductor lines.',
          'One loose transformer wire and downtown goes dark.',
          'Soldering complete! Ground line secured.',
        ];
        this.setSpeech(v, quotes[Math.floor(Math.random() * quotes.length)]!, '#38bdf8');
        this.spawnWeldingSparks();
        this.onPlaySFX?.('solder');
        break;
      }
      case 'boombox_dancer': {
        this.danceRoutine = (this.danceRoutine + 1) % 4;
        const quotes = [
          'Drop the bass! 128 BPM cyber rhythm!',
          'Floor796 style breakdance! Watch the windmill!',
          'Metropolis street cypher is live!',
        ];
        this.setSpeech(v, quotes[Math.floor(Math.random() * quotes.length)]!, '#ec4899');
        this.onPlaySFX?.('beat');
        break;
      }
      case 'automat_kicker': {
        this.automatKickTimer = 35; // Trigger kick animation
        const quotes = [
          'CLUNK! Works every time. Chilled neon soda dispensed!',
          'Nothing like a swift kick to unstuck the vending coil.',
          'Electrolyte boost secured for the journey.',
        ];
        this.setSpeech(v, quotes[Math.floor(Math.random() * quotes.length)]!, '#06b6d4');
        this.onPlaySFX?.('vending');
        break;
      }
      case 'zen_meditator': {
        const quotes = [
          'Breathe in the digital dawn; exhale the noise of the metropolis.',
          'Like the koi through still waters, the grid flows endlessly.',
          'Stillness in the center of ten thousand plots.',
        ];
        this.setSpeech(v, quotes[Math.floor(Math.random() * quotes.length)]!, '#a78bfa');
        this.onPlaySFX?.('splash');
        break;
      }
      case 'boardwalk_stargazer': {
        const quotes = [
          'Aligning the brass telescope... look out at the cosmos!',
          'Out past the reef... look at the orbital stations and ringed worlds!',
          'Every star in the sky corresponds to an uncharted grid.',
        ];
        this.setSpeech(v, quotes[Math.floor(Math.random() * quotes.length)]!, '#facc15');
        this.onPlaySFX?.('chime');
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            (window as unknown as { openTelescopeModal?: () => void }).openTelescopeModal?.();
          }, 350);
        }
        break;
      }
      case 'cat_gathering': {
        this.catHearts.push({ x: 0, y: -20, alpha: 1.0 });
        this.catHearts.push({ x: 8, y: -24, alpha: 0.9 });
        const quotes = ['*Purrrrrrr...*', 'Mrow! *stretches paw on warm steam grate*', '*kneads invisible dough*'];
        this.setSpeech(v, quotes[Math.floor(Math.random() * quotes.length)]!, '#fb7185');
        this.onPlaySFX?.('purr');
        break;
      }
      case 'seaside_binoculars': {
        const quotes = [
          'Ahoy! Leviathan spotted breachin\' off the starboard reef! Peer through the tower glass!',
          'Look lively! Pod of dolphins leapin\' over the ocean swells!',
          'Drop a quarter in the slot and behold the endless ocean!',
        ];
        this.setSpeech(v, quotes[Math.floor(Math.random() * quotes.length)]!, '#38bdf8');
        this.onPlaySFX?.('splash');
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            (window as unknown as { openBinocularModal?: () => void }).openBinocularModal?.();
          }, 350);
        }
        break;
      }
      case 'swan_pedal_boat': {
        const quotes = [
          'HONK! Pedaling through the tranquil waters of Central Park Lake!',
          'Pip, steer left! We\'re drifting straight into the water lilies!',
          'Best 30-minute rental in all of Spot Metropolis. *paddle paddle splash*',
          'Ah, the serenity of Central Park... though my legs are burning!',
        ];
        this.setSpeech(v, quotes[Math.floor(Math.random() * quotes.length)]!, '#38bdf8');
        this.onPlaySFX?.('quack');
        break;
      }
      case 'jungle_monkeys': {
        const quotes = [
          'Ooh-ooh aah-aah! *swings playfully from a hanging liana and offers a ripe golden mango!*',
          'Chatter chatter! *Koko grooms Milo\'s head playfully while hanging upside down by tail*',
          'Squeak! *Milo juggles three tiny wild figs up in the banyan boughs!*',
        ];
        this.setSpeech(v, quotes[Math.floor(Math.random() * quotes.length)]!, '#f59e0b');
        this.onPlaySFX?.('chime');
        break;
      }
      case 'jungle_macaw': {
        const quotes = [
          'Squaaawk! *flaps brilliant rainbow wings* Welcome to the Emerald Canopy!',
          '*Tucks head sideways, clicks beak curiously, and preens cobalt tail feathers*',
          'Kraww! The morning jungle mist is lifting over the ancient trees!',
        ];
        this.setSpeech(v, quotes[Math.floor(Math.random() * quotes.length)]!, '#ef4444');
        this.onPlaySFX?.('chime');
        break;
      }
      case 'jungle_panther': {
        const quotes = [
          '*Rumbles a deep, majestic purr...* The jungle mist watches all paths.',
          '*Lazy golden eyes blink slowly from the mossy branch as tail tip curls*',
          '*Stretches sleek midnight paws silently along the banyan bough...*',
        ];
        this.setSpeech(v, quotes[Math.floor(Math.random() * quotes.length)]!, '#fbbf24');
        this.onPlaySFX?.('purr');
        break;
      }
      case 'jungle_treefrog': {
        const quotes = [
          'Ribbit! *puffs neon throat sac proudly* Watch out for slippery moss on the jungle stones!',
          '*Blinks bright ruby-red eyes cheerfully from the giant broad monster leaf*',
          'Croak-ribbit! The creek water is cool and crystal clear today!',
        ];
        this.setSpeech(v, quotes[Math.floor(Math.random() * quotes.length)]!, '#22c55e');
        this.onPlaySFX?.('splash');
        break;
      }
      case 'jungle_sloth': {
        const quotes = [
          '*Blinks slowly with a calm, peaceful smile...* Life moves at the perfect speed up here in the canopy.',
          '*Lazily scratches shaggy moss-dusted fur with a long curved claw and sighs contentedly*',
          'Zzz... The breeze through the banyan leaves is the greatest lullaby...',
        ];
        this.setSpeech(v, quotes[Math.floor(Math.random() * quotes.length)]!, '#a8a29e');
        this.onPlaySFX?.('purr');
        break;
      }
      case 'jungle_tiger': {
        const quotes = [
          '*Rumbles a mighty, deep-chested purr...* The sun-warmed river stone is mine today, little traveler.',
          '*Luminous amber eyes gleam as tail tip flicks with lazy majesty across the boulder*',
          '*Stretches muscular striped forepaws and yawns, revealing impressive white fangs!*',
        ];
        this.setSpeech(v, quotes[Math.floor(Math.random() * quotes.length)]!, '#f97316');
        this.onPlaySFX?.('purr');
        break;
      }
      case 'jungle_caiman': {
        const quotes = [
          '*Snap!* *swishes armored tail, creating gentle concentric ripples across the jungle creek*',
          '*Blinks reptilian golden slit eyes from just above the emerald water line*',
          '*Basks peacefully in the warm sunbeam breaking through the wild palm fronds*',
        ];
        this.setSpeech(v, quotes[Math.floor(Math.random() * quotes.length)]!, '#22c55e');
        this.onPlaySFX?.('splash');
        break;
      }
      case 'jungle_capybaras': {
        const quotes = [
          '*Sniffs curiously with a blunt nose... Luna snuggles closer while balancing a pink water lily!*',
          '*Twitches little round ears peacefully and munches on crisp river reeds*',
          'Squeeee-purr! *The ultimate chill energy of the jungle radiates all around*',
        ];
        this.setSpeech(v, quotes[Math.floor(Math.random() * quotes.length)]!, '#f472b6');
        this.onPlaySFX?.('chime');
        break;
      }
      case 'jungle_parrots': {
        const quotes = [
          'Squaaawk! *Azure ruffles brilliant sapphire wings while Sunshine tilts yellow-crowned head*',
          'Kreee-kraww! High up on the vine, the jungle stretches endless toward the horizon!',
          '*Azure clicks curved black bill happily and grooms Sunshine\'s bright emerald plumage*',
        ];
        this.setSpeech(v, quotes[Math.floor(Math.random() * quotes.length)]!, '#38bdf8');
        this.onPlaySFX?.('chime');
        break;
      }
      case 'jungle_tamarin': {
        const quotes = [
          'Chitter-squeak! *Mango bounds along the palm stem, golden mane shining like a sunburst!*',
          '*Holds up a juicy wild purple jungle berry proudly and does an agile backflip!*',
          'Peep! *Curled golden tail balances effortlessly on the tropical frond*',
        ];
        this.setSpeech(v, quotes[Math.floor(Math.random() * quotes.length)]!, '#f59e0b');
        this.onPlaySFX?.('chime');
        break;
      }
    }
  }

  private setSpeech(v: InteractiveVignette, text: string, color: string): void {
    v.speech = {
      text,
      author: v.name,
      age: 0,
      maxAge: 260, // ~4.3 seconds
      color,
    };
  }

  // ── Rendering All Vignettes ───────────────────────────────────────────────

  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const W = camera.viewportWidth;
    const H = camera.viewportHeight;
    const z = camera.zoom;

    for (const v of this.vignettes) {
      const screen = camera.worldToScreen(v.wx, v.wy);

      // Viewport culling
      if (screen.x < -120 * z || screen.x > W + 120 * z || screen.y < -120 * z || screen.y > H + 120 * z) {
        continue;
      }

      ctx.save();
      ctx.translate(screen.x, screen.y);

      switch (v.id) {
        case 'ramen_chef':
          this.renderRamenChef(ctx, z);
          break;
        case 'alley_hacker':
          this.renderAlleyHacker(ctx, z);
          break;
        case 'street_solderer':
          this.renderSolderer(ctx, z);
          break;
        case 'boombox_dancer':
          this.renderBoomboxDancer(ctx, z);
          break;
        case 'automat_kicker':
          this.renderAutomatKicker(ctx, z);
          break;
        case 'zen_meditator':
          this.renderZenMeditator(ctx, z);
          break;
        case 'boardwalk_stargazer':
          this.renderBoardwalkStargazer(ctx, z);
          break;
        case 'cat_gathering':
          this.renderCatGathering(ctx, z);
          break;
        case 'seaside_binoculars':
          this.renderSeasideBinoculars(ctx, z);
          break;
        case 'swan_pedal_boat':
          this.renderSwanPedalBoat(ctx, z);
          break;
        case 'jungle_monkeys':
          this.renderJungleMonkeys(ctx, z);
          break;
        case 'jungle_macaw':
          this.renderJungleMacaw(ctx, z);
          break;
        case 'jungle_panther':
          this.renderJunglePanther(ctx, z);
          break;
        case 'jungle_treefrog':
          this.renderJungleTreefrog(ctx, z);
          break;
        case 'jungle_sloth':
          this.renderJungleSloth(ctx, z);
          break;
        case 'jungle_tiger':
          this.renderJungleTiger(ctx, z);
          break;
        case 'jungle_caiman':
          this.renderJungleCaiman(ctx, z);
          break;
        case 'jungle_capybaras':
          this.renderJungleCapybaras(ctx, z);
          break;
        case 'jungle_parrots':
          this.renderJungleParrots(ctx, z);
          break;
        case 'jungle_tamarin':
          this.renderJungleTamarin(ctx, z);
          break;
      }

      // Render Active Speech Bubble
      if (v.speech) {
        this.renderSpeechBubble(ctx, v.speech, z);
      }

      ctx.restore();
    }

    // ── Ambient Wildlife Elements ───────────────────────────────────────────
    this.renderAmbientJungleButterflies(ctx, camera);
    this.renderAmbientForestFireflies(ctx, camera);
  }

  // ── 1. Takeshi the Ramen Chef ─────────────────────────────────────────────
  private renderRamenChef(ctx: CanvasRenderingContext2D, z: number): void {
    const bob = Math.sin(this.animTick * 0.12) * 1.5;

    // Ground Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 2 * z, 20 * z, 8 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Food Stall Counter & Stove
    ctx.fillStyle = '#1e1b18';
    ctx.fillRect(-18 * z, -16 * z, 36 * z, 16 * z);
    ctx.fillStyle = '#b45309'; // Timber bar top
    ctx.fillRect(-20 * z, -18 * z, 40 * z, 4 * z);

    // Steaming Broth Pot
    ctx.fillStyle = '#475569';
    ctx.fillRect(-14 * z, -24 * z, 10 * z, 8 * z);
    // Broth Glow
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-13 * z, -24 * z, 8 * z, 2 * z);

    // Rising Steam from Broth
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    for (let i = 0; i < 3; i++) {
      const sy = ((this.animTick * 0.4 + i * 8) % 18);
      const sx = -9 + Math.sin(this.animTick * 0.08 + i) * 2.5;
      ctx.beginPath();
      ctx.arc(sx * z, (-25 - sy) * z, (2 + sy * 0.12) * z, 0, Math.PI * 2);
      ctx.fill();
    }

    // Chef Body
    ctx.fillStyle = '#1e3a8a'; // Blue apron
    ctx.fillRect(2 * z, (-28 + bob) * z, 10 * z, 14 * z);
    ctx.fillStyle = '#fed7aa'; // Head
    ctx.fillRect(3 * z, (-36 + bob) * z, 8 * z, 8 * z);
    ctx.fillStyle = '#ffffff'; // White Hachimaki headband
    ctx.fillRect(2 * z, (-36 + bob) * z, 10 * z, 2.5 * z);
    ctx.fillStyle = '#dc2626'; // Red dot emblem
    ctx.fillRect(6 * z, (-36 + bob) * z, 2 * z, 2 * z);

    // Wok & Noodle Toss
    ctx.fillStyle = '#0f172a'; // Iron wok
    ctx.beginPath();
    ctx.arc(0, (-22 + bob * 0.5) * z, 6 * z, 0, Math.PI);
    ctx.fill();
    // Flying Noodles in mid-air
    const noodleHop = Math.abs(Math.sin(this.animTick * 0.15)) * 8;
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.5 * z;
    ctx.beginPath();
    ctx.moveTo(-3 * z, (-24 - noodleHop + bob) * z);
    ctx.lineTo(2 * z, (-26 - noodleHop + bob) * z);
    ctx.stroke();

    // Red Lantern Hanging
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-18 * z, -38 * z, 6 * z, 10 * z);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(-16 * z, -35 * z, 2 * z, 4 * z);

    // Tabby Cat Waiting on Counter
    const catTail = Math.sin(this.animTick * 0.1) * 2;
    ctx.fillStyle = '#f97316'; // Orange tabby
    ctx.fillRect(14 * z, -22 * z, 6 * z, 5 * z);
    ctx.fillRect(17 * z, -25 * z, 4 * z, 4 * z); // Cat head
    ctx.fillStyle = '#ffffff'; // White chest
    ctx.fillRect(14 * z, -19 * z, 3 * z, 2 * z);
    // Cat Tail
    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 1.5 * z;
    ctx.beginPath();
    ctx.moveTo(14 * z, -18 * z);
    ctx.lineTo((11 + catTail) * z, -22 * z);
    ctx.stroke();
  }

  // ── 2. Zero-X the Alley Netrunner ─────────────────────────────────────────
  private renderAlleyHacker(ctx: CanvasRenderingContext2D, z: number): void {
    const bob = Math.sin(this.animTick * 0.09) * 1.0;

    // Ground Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 2 * z, 16 * z, 6 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Overturned Cyber Milk Crate
    ctx.fillStyle = '#0f766e';
    ctx.fillRect(-6 * z, -10 * z, 12 * z, 10 * z);
    ctx.strokeStyle = '#14b8a6';
    ctx.lineWidth = 1 * z;
    ctx.strokeRect(-6 * z, -10 * z, 12 * z, 10 * z);

    // Netrunner Seated Body
    ctx.fillStyle = '#090d16'; // Black leather trench
    ctx.fillRect(-5 * z, (-22 + bob) * z, 10 * z, 14 * z);
    ctx.fillStyle = '#fed7aa'; // Face
    ctx.fillRect(-4 * z, (-28 + bob) * z, 8 * z, 7 * z);
    // Glowing Cyan Cybernetic Visor
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(-4 * z, (-26 + bob) * z, 8 * z, 2.5 * z);
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 6 * z;
    ctx.fillRect(-3 * z, (-26 + bob) * z, 6 * z, 2 * z);
    ctx.shadowBlur = 0;

    // Fast Typing Hands
    const handJitter1 = Math.sin(this.animTick * 0.4) * 1.5;
    const handJitter2 = Math.cos(this.animTick * 0.4) * 1.5;
    ctx.fillStyle = '#fed7aa';
    ctx.fillRect((4 + handJitter1) * z, (-17 + bob) * z, 3 * z, 2 * z);
    ctx.fillRect((7 + handJitter2) * z, (-16 + bob) * z, 3 * z, 2 * z);

    // Floating Green Hologram Projection Screen
    ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
    ctx.fillRect(4 * z, (-34 + bob) * z, 24 * z, 20 * z);
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
    ctx.lineWidth = 1 * z;
    ctx.strokeRect(4 * z, (-34 + bob) * z, 24 * z, 20 * z);

    // Matrix Glyphs inside Hologram
    ctx.font = `${Math.round(6 * z)}px monospace`;
    ctx.textAlign = 'center';
    for (const g of this.matrixGlyphs) {
      ctx.fillStyle = `rgba(74, 222, 128, ${g.alpha})`;
      ctx.fillText(g.char, (16 + g.x * 0.4) * z, (-18 + g.y + bob) * z);
    }
  }

  // ── 3. Jax the Grid Technician / Solderer ─────────────────────────────────
  private renderSolderer(ctx: CanvasRenderingContext2D, z: number): void {
    const isWelding = Math.sin(this.animTick * 0.05) > 0.2;
    const arcFlicker = isWelding && (this.animTick % 2 === 0);

    // Ground Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 2 * z, 18 * z, 7 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // High-Voltage Transformer Junction Box
    ctx.fillStyle = '#334155';
    ctx.fillRect(-18 * z, -22 * z, 14 * z, 22 * z);
    ctx.fillStyle = '#eab308'; // Warning Chevron
    ctx.fillRect(-16 * z, -18 * z, 10 * z, 4 * z);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-14 * z, -17 * z, 6 * z, 2 * z);

    // Technician Crouched Body
    ctx.fillStyle = '#475569'; // Heavy utility jumpsuit
    ctx.fillRect(-2 * z, -16 * z, 12 * z, 14 * z);
    ctx.fillStyle = '#0284c7'; // Utility Vest
    ctx.fillRect(-1 * z, -15 * z, 10 * z, 9 * z);
    // Welder Mask
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, -22 * z, 8 * z, 8 * z);
    ctx.fillStyle = arcFlicker ? '#fef08a' : '#0284c7'; // Tinted lens
    ctx.fillRect(4 * z, -20 * z, 3 * z, 3 * z);

    // Welding Torch & Arc Flash
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-4 * z, -15 * z, 6 * z, 2.5 * z);

    if (arcFlicker) {
      // Powerful Welding Glow Flash
      ctx.fillStyle = 'rgba(254, 240, 138, 0.85)';
      ctx.beginPath();
      ctx.arc(-4 * z, -14 * z, 4 * z, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.beginPath();
      ctx.arc(-4 * z, -14 * z, 24 * z, 0, Math.PI * 2);
      ctx.fill();
    }

    // Flying Sparks
    for (const sp of this.sparks) {
      ctx.fillStyle = sp.color;
      ctx.fillRect((sp.x - 10) * z, sp.y * z, sp.size * z, sp.size * z);
    }
  }

  // ── 4. Blitz the Cyber B-Boy ──────────────────────────────────────────────
  private renderBoomboxDancer(ctx: CanvasRenderingContext2D, z: number): void {
    // Ground Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 2 * z, 18 * z, 7 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // 1. Retro 1984 Cyber Boombox (Left)
    ctx.fillStyle = '#111827';
    ctx.fillRect(-18 * z, -12 * z, 16 * z, 12 * z);
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 1 * z;
    ctx.strokeRect(-18 * z, -12 * z, 16 * z, 12 * z);
    // Dual Speakers
    ctx.fillStyle = '#374151';
    ctx.beginPath();
    ctx.arc(-14 * z, -6 * z, 3 * z, 0, Math.PI * 2);
    ctx.arc(-6 * z, -6 * z, 3 * z, 0, Math.PI * 2);
    ctx.fill();

    // Animated Soundwave Rings from Boombox
    const pulseRadius = ((this.animTick * 0.6) % 24);
    const pulseAlpha = Math.max(0, 1 - pulseRadius / 24);
    ctx.strokeStyle = `rgba(236, 72, 153, ${pulseAlpha * 0.7})`;
    ctx.lineWidth = 1.2 * z;
    ctx.beginPath();
    ctx.arc(-10 * z, -6 * z, pulseRadius * z, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Breakdancer (Right) with 4-phase routine
    const step = Math.floor(this.animTick / 14) % 4;
    ctx.save();
    ctx.translate(6 * z, -8 * z);

    if (step === 0) {
      // Windmill / Kick Freeze
      ctx.fillStyle = '#ef4444'; // Red jacket
      ctx.fillRect(-4 * z, -12 * z, 9 * z, 8 * z);
      ctx.fillStyle = '#fed7aa'; // Head
      ctx.fillRect(-3 * z, -18 * z, 7 * z, 6 * z);
      ctx.fillStyle = '#1e293b'; // Cap
      ctx.fillRect(-5 * z, -19 * z, 9 * z, 2.5 * z);
      // Legs extended
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(-6 * z, -4 * z, 5 * z, 12 * z);
      ctx.fillRect(1 * z, -8 * z, 12 * z, 4 * z);
    } else if (step === 1) {
      // Handstand Freeze
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-4 * z, -6 * z, 8 * z, 8 * z);
      ctx.fillStyle = '#fed7aa';
      ctx.fillRect(-3 * z, 2 * z, 6 * z, 6 * z);
      ctx.fillStyle = '#3b82f6'; // Legs in air
      ctx.fillRect(-7 * z, -18 * z, 5 * z, 12 * z);
      ctx.fillRect(2 * z, -16 * z, 5 * z, 10 * z);
    } else if (step === 2) {
      // Pop & Lock Bounce
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-4 * z, -14 * z, 8 * z, 9 * z);
      ctx.fillStyle = '#fed7aa';
      ctx.fillRect(-3 * z, -20 * z, 6 * z, 6 * z);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(-5 * z, -5 * z, 4 * z, 8 * z);
      ctx.fillRect(1 * z, -5 * z, 4 * z, 8 * z);
    } else {
      // Low Crouch Glide
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-6 * z, -8 * z, 12 * z, 6 * z);
      ctx.fillStyle = '#fed7aa';
      ctx.fillRect(4 * z, -12 * z, 6 * z, 5 * z);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(-10 * z, -4 * z, 16 * z, 4 * z);
    }
    ctx.restore();
  }

  // ── 5. Dex the Thirsty Nomad (Vending Machine Kicker) ──────────────────────
  private renderAutomatKicker(ctx: CanvasRenderingContext2D, z: number): void {
    // Ground Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 2 * z, 18 * z, 7 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // 1. Glowing Neon Street Automat (Left)
    const machineRattle = (this.automatKickTimer > 15 && this.automatKickTimer < 25) ? Math.sin(this.animTick * 1.2) * 2 : 0;
    ctx.save();
    ctx.translate(machineRattle * z, 0);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-18 * z, -30 * z, 16 * z, 30 * z);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1.2 * z;
    ctx.strokeRect(-18 * z, -30 * z, 16 * z, 30 * z);

    // Glowing Drinks Display Window
    ctx.fillStyle = '#083344';
    ctx.fillRect(-16 * z, -26 * z, 12 * z, 14 * z);
    // Colorful Drink Cans Inside
    const colors = ['#f43f5e', '#38bdf8', '#fbbf24', '#4ade80'];
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        ctx.fillStyle = colors[(row * 3 + col) % colors.length]!;
        ctx.fillRect((-15 + col * 4) * z, (-24 + row * 6) * z, 2.5 * z, 4 * z);
      }
    }
    // Dispense Chute
    ctx.fillStyle = '#020617';
    ctx.fillRect(-15 * z, -8 * z, 10 * z, 5 * z);

    // Dispensed Soda Can on Ground
    if (this.sodaCanOffset > 0) {
      ctx.fillStyle = '#f43f5e'; // Cold neon cherry soda
      ctx.fillRect(-13 * z, -3 * z, 4 * z, 3 * z);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-13 * z, -3 * z, 4 * z, 0.8 * z);
    }
    ctx.restore();

    // 2. Dex the Kicker (Right)
    ctx.save();
    ctx.translate(4 * z, 0);

    const isKicking = this.automatKickTimer > 15 && this.automatKickTimer < 30;
    const bodyBob = Math.sin(this.animTick * 0.1) * 1.0;

    ctx.fillStyle = '#7c3aed'; // Purple hoodie
    ctx.fillRect(-3 * z, (-22 + bodyBob) * z, 8 * z, 12 * z);
    ctx.fillStyle = '#fed7aa'; // Face
    ctx.fillRect(-2 * z, (-28 + bodyBob) * z, 6 * z, 6 * z);

    if (isKicking) {
      // Leg Extended in Kick Pose
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-10 * z, -12 * z, 10 * z, 3 * z); // Kicking leg
      ctx.fillRect(1 * z, -10 * z, 3 * z, 10 * z); // Standing leg
    } else {
      // Idle Standing Pose
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-2 * z, -10 * z, 3 * z, 10 * z);
      ctx.fillRect(3 * z, -10 * z, 3 * z, 10 * z);
    }
    ctx.restore();
  }

  // ── 6. Master Sora & Zen Koi Pond ─────────────────────────────────────────
  private renderZenMeditator(ctx: CanvasRenderingContext2D, z: number): void {
    // 1. Zen Koi Pond Water Circle
    ctx.fillStyle = '#075985';
    ctx.beginPath();
    ctx.ellipse(0, 0, 24 * z, 14 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.5 * z;
    ctx.stroke();

    // Concentric Water Ripples
    for (const r of this.ripples) {
      ctx.strokeStyle = `rgba(186, 230, 253, ${r.alpha * 0.6})`;
      ctx.lineWidth = 1 * z;
      ctx.beginPath();
      ctx.ellipse(r.x * z, r.y * z, r.radius * z, (r.radius * 0.6) * z, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 2. Animated Swimming Koi Fish
    const koiAngle = this.animTick * 0.04;
    const kx = Math.cos(koiAngle) * 14;
    const ky = Math.sin(koiAngle) * 8;
    const kAngle = koiAngle + Math.PI / 2;

    ctx.save();
    ctx.translate(kx * z, ky * z);
    ctx.rotate(kAngle);
    // Orange/Gold Koi Body
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.ellipse(0, 0, 5 * z, 2 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff'; // White fin patch
    ctx.fillRect(-1 * z, -1 * z, 2 * z, 2 * z);
    ctx.restore();

    // 3. Floating Meditating Monk on Platform (Hovering in air)
    const floatBob = Math.sin(this.animTick * 0.06) * 3.5;

    // Glowing Aura Ring Underneath
    ctx.fillStyle = 'rgba(167, 139, 250, 0.2)';
    ctx.beginPath();
    ctx.ellipse(0, (-22 + floatBob) * z, 12 * z, 4 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Monk Lotus Pose
    ctx.fillStyle = '#7c2d12'; // Ochre robe
    ctx.fillRect(-6 * z, (-24 + floatBob) * z, 12 * z, 8 * z);
    ctx.fillStyle = '#fed7aa'; // Bald head
    ctx.beginPath();
    ctx.arc(0, (-28 + floatBob) * z, 4 * z, 0, Math.PI * 2);
    ctx.fill();
    // Folded Hands in prayer
    ctx.fillStyle = '#fed7aa';
    ctx.fillRect(-2 * z, (-22 + floatBob) * z, 4 * z, 3 * z);
  }

  // ── 7. Astrid the Boardwalk Stargazer ─────────────────────────────────────
  private renderBoardwalkStargazer(ctx: CanvasRenderingContext2D, z: number): void {
    const breeze = Math.sin(this.animTick * 0.08) * 1.5;

    // Ground Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 2 * z, 16 * z, 6 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Boardwalk Timber Railing
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-16 * z, -14 * z, 32 * z, 3 * z);
    ctx.fillStyle = '#451a03';
    ctx.fillRect(-12 * z, -11 * z, 3 * z, 11 * z);
    ctx.fillRect(8 * z, -11 * z, 3 * z, 11 * z);

    // Brass Nautical Telescope
    ctx.fillStyle = '#b45309'; // Brass stand
    ctx.fillRect(-8 * z, -20 * z, 3 * z, 14 * z);
    ctx.save();
    ctx.translate(-7 * z, -20 * z);
    ctx.rotate(0.25); // Angled up toward horizon
    ctx.fillStyle = '#d97706';
    ctx.fillRect(-8 * z, -3 * z, 16 * z, 5 * z);
    ctx.fillStyle = '#fef08a'; // Brass eyepiece
    ctx.fillRect(-10 * z, -2 * z, 2 * z, 3 * z);

    // Occasional Lens Flare Sparkle
    if (this.animTick % 60 < 15) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(7 * z, -4 * z, 2 * z, 2 * z);
    }
    ctx.restore();

    // Astrid Looking Through Telescope
    ctx.fillStyle = '#0f172a'; // Deep navy nautical coat
    ctx.fillRect(0, -22 * z, 7 * z, 14 * z);
    // Coat tail fluttering in wind
    ctx.beginPath();
    ctx.moveTo(7 * z, -12 * z);
    ctx.lineTo((12 + breeze) * z, -16 * z);
    ctx.lineTo(7 * z, -8 * z);
    ctx.fill();

    ctx.fillStyle = '#fed7aa'; // Head leaning in
    ctx.fillRect(-3 * z, -25 * z, 6 * z, 6 * z);
    ctx.fillStyle = '#f59e0b'; // Amber scarf
    ctx.fillRect(-1 * z, -21 * z, 6 * z, 3 * z);
  }

  // ── 8. Midnight Whiskers & The Stray Clowder ──────────────────────────────
  private renderCatGathering(ctx: CanvasRenderingContext2D, z: number): void {
    // Warm Sewer Steam Grate
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-16 * z, -4 * z, 32 * z, 8 * z);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1 * z;
    ctx.strokeRect(-16 * z, -4 * z, 32 * z, 8 * z);
    for (let i = -12; i < 14; i += 5) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(i * z, -3 * z, 2.5 * z, 6 * z);
    }

    // Steam Puffs from Grate
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    const steamY = ((this.animTick * 0.3) % 16);
    ctx.beginPath();
    ctx.arc(0, (-4 - steamY) * z, (3 + steamY * 0.15) * z, 0, Math.PI * 2);
    ctx.fill();

    // Cat 1: Sleeping Black Cat on Warm Grate with 'z'
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.ellipse(0, 0, 6 * z, 3.5 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    // Sleeping 'z'
    if (this.animTick % 40 > 20) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = `${Math.round(6 * z)}px monospace`;
      ctx.fillText('z', 4 * z, -6 * z);
    }

    // Cat 2: Calico Cat Stretching & Swishing Tail (Right)
    const stretch = Math.sin(this.animTick * 0.1) * 2;
    ctx.fillStyle = '#f8fafc'; // White base
    ctx.fillRect(10 * z, (-6 + stretch * 0.3) * z, 7 * z, 5 * z);
    ctx.fillStyle = '#f97316'; // Orange patch
    ctx.fillRect(12 * z, (-6 + stretch * 0.3) * z, 3 * z, 3 * z);
    ctx.fillStyle = '#1e293b'; // Black patch
    ctx.fillRect(15 * z, (-5 + stretch * 0.3) * z, 2 * z, 2 * z);
    // Tail
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1.2 * z;
    ctx.beginPath();
    ctx.moveTo(17 * z, (-4 + stretch * 0.3) * z);
    ctx.lineTo((21 + stretch) * z, -9 * z);
    ctx.stroke();

    // Cat 3: Playful Ginger Cat Batting at Neon Moth (Left)
    const pawSwat = Math.sin(this.animTick * 0.25) * 3;
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(-14 * z, -9 * z, 6 * z, 7 * z);
    ctx.fillRect(-12 * z, -13 * z, 4 * z, 4 * z); // Head
    // Swatting Paw
    ctx.fillStyle = '#fed7aa';
    ctx.fillRect((-9 + pawSwat) * z, -11 * z, 2.5 * z, 2.5 * z);

    // Glowing Neon Moth Fluttering
    const mothX = -6 + Math.sin(this.animTick * 0.2) * 4;
    const mothY = -14 + Math.cos(this.animTick * 0.15) * 3;
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(mothX * z, mothY * z, 2 * z, 2 * z);

    // Love Hearts on Click
    for (const h of this.catHearts) {
      ctx.fillStyle = `rgba(244, 63, 94, ${h.alpha})`;
      ctx.font = `${Math.round(8 * z)}px sans-serif`;
      ctx.fillText('❤️', h.x * z, h.y * z);
    }
  }

  // ── 9. Seaside Tower Coin-Op Binoculars & Captain Barnacle ────────────────
  private renderSeasideBinoculars(ctx: CanvasRenderingContext2D, z: number): void {
    // Ground Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 2 * z, 18 * z, 7 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Boardwalk Timber Railing
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-20 * z, -14 * z, 40 * z, 3 * z);
    ctx.fillStyle = '#451a03';
    ctx.fillRect(-16 * z, -11 * z, 3 * z, 11 * z);
    ctx.fillRect(12 * z, -11 * z, 3 * z, 11 * z);

    // Cast-Iron Tower Binocular Stand (Center-Left)
    ctx.fillStyle = '#1e293b'; // Pedestal base & step footplate
    ctx.fillRect(-10 * z, -3 * z, 12 * z, 3 * z);
    ctx.fillStyle = '#334155'; // Column
    ctx.fillRect(-6 * z, -20 * z, 4 * z, 17 * z);
    ctx.fillStyle = '#0f172a'; // Yoke swivel mount
    ctx.fillRect(-8 * z, -22 * z, 8 * z, 3 * z);

    // Dual-Barrel Binoculars Head (Angled down toward ocean waves)
    ctx.fillStyle = '#0284c7'; // Maritime Blue
    ctx.fillRect(-9 * z, -26 * z, 10 * z, 5 * z);
    // Eyepieces
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-10 * z, -25.5 * z, 2 * z, 4 * z);
    // Front Lenses with Sky Reflection Glint
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(0, -26 * z, 2 * z, 5 * z);

    // Coin Box (Red 25¢ box)
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-4 * z, -14 * z, 4 * z, 5 * z);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(-3 * z, -12 * z, 2 * z, 1 * z); // Coin slot

    // Captain Barnacle (Standing Beside Binoculars)
    ctx.save();
    ctx.translate(6 * z, 0);

    // Sailor Body & Navy Peacoat
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-2 * z, -20 * z, 9 * z, 13 * z);
    // Gold Double-Breasted Buttons
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, -18 * z, 1.5 * z, 1.5 * z);
    ctx.fillRect(0, -14 * z, 1.5 * z, 1.5 * z);
    ctx.fillRect(3 * z, -18 * z, 1.5 * z, 1.5 * z);
    ctx.fillRect(3 * z, -14 * z, 1.5 * z, 1.5 * z);

    // Head, Face & White Sailor Beard
    ctx.fillStyle = '#fed7aa'; // Face
    ctx.fillRect(0, -26 * z, 6 * z, 6 * z);
    ctx.fillStyle = '#f8fafc'; // Full White Sailor Beard
    ctx.fillRect(-1 * z, -22 * z, 8 * z, 4 * z);

    // Captain's Hat (White top, black visor, gold anchor cord)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-2 * z, -30 * z, 9 * z, 4 * z);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-3 * z, -27 * z, 11 * z, 1.5 * z); // Black brim
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(1 * z, -28 * z, 3 * z, 1.5 * z); // Gold badge

    // Arm Pointing Out to Sea
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-6 * z, -18 * z, 5 * z, 3 * z);
    ctx.fillStyle = '#fed7aa';
    ctx.fillRect(-8 * z, -18 * z, 2 * z, 2.5 * z); // Pointing hand

    ctx.restore();

    // White Seagull Perched on Boardwalk Railing (Right)
    const gullHead = (Math.floor(this.animTick / 30) % 2) * 1.5;
    ctx.fillStyle = '#ffffff'; // Gull body
    ctx.fillRect(15 * z, -17 * z, 6 * z, 3.5 * z);
    ctx.fillRect((19 + gullHead) * z, -20 * z, 3.5 * z, 3.5 * z); // Head
    ctx.fillStyle = '#f59e0b'; // Beak
    ctx.fillRect((22 + gullHead) * z, -19 * z, 2 * z, 1.5 * z);
    ctx.fillStyle = '#475569'; // Wing tip
    ctx.fillRect(14 * z, -16 * z, 3 * z, 2 * z);
  }

  // ── 10. Penelope & Pip's Central Park Swan Pedal Boat ─────────────────────
  private renderSwanPedalBoat(ctx: CanvasRenderingContext2D, z: number): void {
    // Kinetic gentle drifting loop around the lake
    const patrolX = Math.cos(this.animTick * 0.015) * 12 * z;
    const patrolY = Math.sin(this.animTick * 0.015) * 6 * z;
    const waterBob = Math.sin(this.animTick * 0.08) * 1.5 * z;

    ctx.save();
    ctx.translate(patrolX, patrolY + waterBob);

    // 1. Concentric Water Wake Ripples behind boat
    const ripplePhase = (this.animTick * 0.04) % 1;
    ctx.strokeStyle = `rgba(186, 230, 253, ${0.45 * (1 - ripplePhase)})`;
    ctx.lineWidth = 1.2 * z;
    ctx.beginPath();
    ctx.ellipse(-8 * z, 8 * z, (14 + ripplePhase * 8) * z, (6 + ripplePhase * 4) * z, 0, 0, Math.PI * 2);
    ctx.stroke();

    // V-Wake Stern Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.0 * z;
    ctx.beginPath();
    ctx.moveTo(-16 * z, 4 * z);
    ctx.lineTo(-26 * z, -2 * z);
    ctx.moveTo(-16 * z, 8 * z);
    ctx.lineTo(-26 * z, 14 * z);
    ctx.stroke();

    // 2. Churning Paddle Wheel Froth
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    const splashOffset = (Math.floor(this.animTick / 4) % 3) * 1.5 * z;
    ctx.fillRect(-14 * z, (7 + splashOffset) * z, 3 * z, 2 * z);
    ctx.fillRect(-17 * z, (5 - splashOffset) * z, 2.5 * z, 2 * z);

    // 3. Swan Boat Hull (Sculpted White Fiberglass)
    // Hull Shadow in Water
    ctx.fillStyle = 'rgba(3, 105, 161, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 8 * z, 18 * z, 7 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Boat Cockpit Tub
    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.ellipse(0, 4 * z, 16 * z, 8 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sculpted Feather Wings Flanking Cockpit
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-14 * z, 2 * z);
    ctx.quadraticCurveTo(-6 * z, -6 * z, 8 * z, 0);
    ctx.lineTo(8 * z, 6 * z);
    ctx.quadraticCurveTo(-4 * z, 8 * z, -14 * z, 2 * z);
    ctx.closePath();
    ctx.fill();

    // Wing Feather Stepped Ridges
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.0 * z;
    ctx.beginPath();
    ctx.moveTo(-8 * z, 1 * z);
    ctx.lineTo(-2 * z, 4 * z);
    ctx.moveTo(-4 * z, -1 * z);
    ctx.lineTo(2 * z, 2 * z);
    ctx.stroke();

    // Rear Swan Tail Feathers
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-14 * z, 3 * z);
    ctx.lineTo(-20 * z, -2 * z);
    ctx.lineTo(-17 * z, 6 * z);
    ctx.closePath();
    ctx.fill();

    // 4. Pedaling Passengers: Penelope (Left) & Pip (Right)
    const pedalL = Math.sin(this.animTick * 0.16) * 2.5 * z;
    const pedalR = -pedalL;

    // Penelope (Left Seat)
    // Body & Summer Top
    ctx.fillStyle = '#06b6d4'; // Cyan tank top
    ctx.fillRect(-7 * z, -6 * z, 5 * z, 6 * z);
    // Pedaling Legs
    ctx.fillStyle = '#fed7aa'; // Legs
    ctx.fillRect(-7 * z, (0 + pedalL) * z, 2 * z, 5 * z);
    // Face & Sunhat
    ctx.fillRect(-6.5 * z, -12 * z, 4 * z, 4 * z);
    ctx.fillStyle = '#fde047'; // Wide brim sunhat
    ctx.beginPath();
    ctx.ellipse(-4.5 * z, -12 * z, 6 * z, 2.5 * z, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#15803d'; // Hat green ribbon
    ctx.fillRect(-6.5 * z, -13 * z, 4 * z, 1.5 * z);

    // Pip (Right Seat)
    // Body & Coral Shirt
    ctx.fillStyle = '#f43f5e'; // Rose/coral shirt
    ctx.fillRect(2 * z, -6 * z, 5 * z, 6 * z);
    // Pedaling Legs
    ctx.fillStyle = '#fed7aa';
    ctx.fillRect(4 * z, (0 + pedalR) * z, 2 * z, 5 * z);
    // Face & Backwards Cap
    ctx.fillRect(2.5 * z, -12 * z, 4 * z, 4 * z);
    ctx.fillStyle = '#3b82f6'; // Blue cap
    ctx.fillRect(2 * z, -14 * z, 5 * z, 3 * z);
    ctx.fillRect(1 * z, -13 * z, 2 * z, 1.5 * z); // Backward brim

    // Pip's Animated Waving Hand!
    const pipWave = Math.sin(this.animTick * 0.18) * 2.5 * z;
    ctx.fillStyle = '#fed7aa';
    ctx.fillRect(7 * z, (-9 + pipWave) * z, 2 * z, 2 * z);

    // Central Chrome Steering Tiller
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-1 * z, -3 * z, 2 * z, 5 * z);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-2.5 * z, -4 * z, 5 * z, 1.5 * z);

    // 5. Arched Swan Neck & Head (Bows forward majestically)
    const neckSway = Math.sin(this.animTick * 0.06) * 1.2 * z;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(11 * z, 4 * z);
    ctx.bezierCurveTo((15 + neckSway) * z, -4 * z, (12 + neckSway) * z, -16 * z, (16 + neckSway) * z, -20 * z);
    ctx.lineTo((19 + neckSway) * z, -20 * z);
    ctx.bezierCurveTo((16 + neckSway) * z, -14 * z, (18 + neckSway) * z, -4 * z, 14 * z, 6 * z);
    ctx.closePath();
    ctx.fill();

    // Swan Head
    const headX = (17 + neckSway) * z;
    const headY = -21 * z;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(headX, headY, 4 * z, 3 * z, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Black Facial Lore & Mask
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(headX, headY - 1 * z);
    ctx.lineTo(headX + 3 * z, headY - 2 * z);
    ctx.lineTo(headX + 3.5 * z, headY + 1 * z);
    ctx.closePath();
    ctx.fill();

    // Orange-Red Beak with Black Basal Knob
    ctx.fillStyle = '#0f172a'; // Basal knob
    ctx.fillRect(headX + 2.5 * z, headY - 2.5 * z, 1.5 * z, 1.5 * z);
    ctx.fillStyle = '#ea580c'; // Vibrant beak
    ctx.beginPath();
    ctx.moveTo(headX + 3.5 * z, headY - 1.5 * z);
    ctx.lineTo(headX + 7.5 * z, headY + 0.5 * z);
    ctx.lineTo(headX + 3.5 * z, headY + 1.5 * z);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // ── Speech Bubble Rendering ───────────────────────────────────────────────
  private renderSpeechBubble(ctx: CanvasRenderingContext2D, speech: VignetteSpeech, z: number): void {
    const text = speech.text;
    const fontSize = Math.max(9, Math.round(8.5 * z));
    ctx.font = `600 ${fontSize}px var(--font-body, system-ui, sans-serif)`;
    const metrics = ctx.measureText(text);
    const boxW = metrics.width + 16 * z;
    const boxH = fontSize + 12 * z;
    const boxX = -boxW / 2;
    const boxY = -48 * z;

    // Bubble Background Box
    ctx.fillStyle = '#0b0f19';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 6 * z);
    ctx.fill();

    // Border with Character Theme Color
    ctx.strokeStyle = speech.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Downward Pointer Arrow
    ctx.fillStyle = '#0b0f19';
    ctx.beginPath();
    ctx.moveTo(-4 * z, boxY + boxH);
    ctx.lineTo(0, boxY + boxH + 5 * z);
    ctx.lineTo(4 * z, boxY + boxH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Bubble Text
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, boxY + boxH / 2);
  }

  // ── 11. Western Jungle: Koko & Milo the Capuchin Monkeys ─────────────────
  private renderJungleMonkeys(ctx: CanvasRenderingContext2D, z: number): void {
    // Arching Banyan Branch
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 3.5 * z;
    ctx.beginPath();
    ctx.moveTo(-24 * z, -28 * z);
    ctx.quadraticCurveTo(0, -22 * z, 24 * z, -28 * z);
    ctx.stroke();

    // Hanging Vine for Koko
    const swingAngle = Math.sin(this.animTick * 0.08) * 0.25;
    const vineLen = 18 * z;

    ctx.save();
    ctx.translate(-8 * z, -24 * z);
    ctx.rotate(swingAngle);

    // Green Vine
    ctx.strokeStyle = '#047857';
    ctx.lineWidth = 1.4 * z;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(2 * z, vineLen * 0.5, 0, vineLen);
    ctx.stroke();

    // Koko (Hanging Upside Down by Curly Tail!)
    ctx.translate(0, vineLen);
    // Curled Prehensile Tail
    ctx.strokeStyle = '#5c3a1e';
    ctx.lineWidth = 2 * z;
    ctx.beginPath();
    ctx.moveTo(0, -6 * z);
    ctx.quadraticCurveTo(4 * z, -3 * z, 0, 0);
    ctx.stroke();

    // Furry Body
    ctx.fillStyle = '#5c3a1e';
    ctx.beginPath();
    ctx.ellipse(0, 4 * z, 4.5 * z, 6 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Peach Face & Ears
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.ellipse(0, 8 * z, 3.5 * z, 3 * z, 0, 0, Math.PI * 2);
    ctx.arc(-3.5 * z, 7 * z, 1.6 * z, 0, Math.PI * 2);
    ctx.arc(3.5 * z, 7 * z, 1.6 * z, 0, Math.PI * 2);
    ctx.fill();

    // Blinking Eyes
    ctx.fillStyle = '#0f172a';
    const blink = (this.animTick % 120) < 6;
    if (blink) {
      ctx.fillRect(-2 * z, 7.5 * z, 1.5 * z, 0.8 * z);
      ctx.fillRect(0.5 * z, 7.5 * z, 1.5 * z, 0.8 * z);
    } else {
      ctx.beginPath();
      ctx.arc(-1.2 * z, 7.5 * z, 0.9 * z, 0, Math.PI * 2);
      ctx.arc(1.2 * z, 7.5 * z, 0.9 * z, 0, Math.PI * 2);
      ctx.fill();
    }

    // Golden Mango / Banana in Paw
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.ellipse(2.5 * z, 3 * z, 2 * z, 3 * z, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Milo (Sitting on Branch)
    ctx.save();
    ctx.translate(10 * z, -26 * z);
    // Body
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.ellipse(0, -4 * z, 4 * z, 5.5 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail swishing down
    const tailSway = Math.sin(this.animTick * 0.1) * 3 * z;
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.8 * z;
    ctx.beginPath();
    ctx.moveTo(3 * z, -1 * z);
    ctx.quadraticCurveTo(8 * z, 5 * z, 6 * z + tailSway, 12 * z);
    ctx.stroke();

    // Head
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(0, -9 * z, 3 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-1.5 * z, -9.5 * z, 1 * z, 1 * z);
    ctx.fillRect(0.5 * z, -9.5 * z, 1 * z, 1 * z);

    // Scratching Paw
    const scratch = Math.sin(this.animTick * 0.25) * 1.5 * z;
    ctx.strokeStyle = '#fed7aa';
    ctx.lineWidth = 1.2 * z;
    ctx.beginPath();
    ctx.moveTo(-2 * z, -5 * z);
    ctx.lineTo(-4 * z, -9 * z + scratch);
    ctx.stroke();
    ctx.restore();
  }

  // ── 12. Western Jungle: Rio & Coral the Macaw & Toucan ────────────────────
  private renderJungleMacaw(ctx: CanvasRenderingContext2D, z: number): void {
    // Arching branch
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 3 * z;
    ctx.beginPath();
    ctx.moveTo(-16 * z, -6 * z);
    ctx.quadraticCurveTo(0, -10 * z, 18 * z, -4 * z);
    ctx.stroke();

    // 🦜 Rio the Scarlet Macaw (Left)
    ctx.save();
    ctx.translate(-6 * z, -10 * z);
    const mHeadBob = Math.sin(this.animTick * 0.08) * 1.2 * z;
    const wingFlap = Math.sin(this.animTick * 0.16) * 2 * z;

    // Long streaming tail feathers
    const tailWave = Math.sin(this.animTick * 0.05) * 3.5 * z;
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.moveTo(-1 * z, 4 * z);
    ctx.quadraticCurveTo(-4 * z, 14 * z, -2 * z + tailWave, 24 * z);
    ctx.lineTo(1 * z + tailWave, 24 * z);
    ctx.quadraticCurveTo(2 * z, 14 * z, 2 * z, 4 * z);
    ctx.closePath();
    ctx.fill();

    // Red Body
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.ellipse(0, 0, 4.5 * z, 7 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Yellow & Blue Wing Fold
    ctx.fillStyle = '#eab308';
    ctx.fillRect(-3.5 * z, -3 * z, 3 * z, 4 * z);
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.moveTo(-4 * z, 0);
    ctx.lineTo(-6 * z - wingFlap, 5 * z);
    ctx.lineTo(-2 * z, 6 * z);
    ctx.closePath();
    ctx.fill();

    // Head
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(0, -7 * z + mHeadBob, 3.8 * z, 0, Math.PI * 2);
    ctx.fill();

    // White Cheek Patch
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.ellipse(-1 * z, -7 * z + mHeadBob, 2 * z, 1.8 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Beak (Curved Ivory with Black tip)
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.moveTo(-1 * z, -7 * z + mHeadBob);
    ctx.quadraticCurveTo(-6 * z, -6 * z + mHeadBob, -4 * z, -2 * z + mHeadBob);
    ctx.lineTo(-2 * z, -4 * z + mHeadBob);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-4.5 * z, -3.5 * z + mHeadBob, 1.5 * z, 2 * z);
    ctx.restore();

    // 🦤 Coral the Toucan (Right)
    ctx.save();
    ctx.translate(8 * z, -8 * z);
    // Glossy Black Body
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(0, 0, 4 * z, 6 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bright Yellow Throat Bib
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.ellipse(2.5 * z, -2 * z, 2.2 * z, 3 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Giant Curved Orange Bill
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.moveTo(3 * z, -3 * z);
    ctx.quadraticCurveTo(11 * z, -4 * z, 12 * z, 1 * z);
    ctx.lineTo(3 * z, 0);
    ctx.closePath();
    ctx.fill();
    // Black tip
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(10 * z, -1 * z, 2.5 * z, 2.5 * z);

    // Blue eye ring
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(1.5 * z, -3 * z, 1.2 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(1.2 * z, -3.3 * z, 0.8 * z, 0.8 * z);
    ctx.restore();
  }

  // ── 13. Western Jungle: Shadow the Midnight Jaguar ────────────────────────
  private renderJunglePanther(ctx: CanvasRenderingContext2D, z: number): void {
    // Mossy tree bough
    ctx.fillStyle = '#271708';
    ctx.fillRect(-18 * z, -4 * z, 36 * z, 7 * z);
    ctx.fillStyle = '#15803d'; // Moss on bough
    ctx.fillRect(-18 * z, -5.5 * z, 36 * z, 2 * z);

    // Sleek Midnight Panther Lounging
    const breath = Math.sin(this.animTick * 0.07) * 0.8 * z;
    const tailCurl = Math.sin(this.animTick * 0.05) * 5 * z;

    // Dangling Tail
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 2.2 * z;
    ctx.beginPath();
    ctx.moveTo(-12 * z, 0);
    ctx.quadraticCurveTo(-15 * z, 8 * z, -11 * z + tailCurl, 16 * z);
    ctx.stroke();

    // Sleek Body
    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.ellipse(0, -6 * z - breath * 0.5, 12 * z, 5.5 * z + breath, 0, 0, Math.PI * 2);
    ctx.fill();

    // Front paws dangling over the branch
    ctx.fillStyle = '#18181b';
    ctx.fillRect(7 * z, -4 * z, 3 * z, 6 * z);
    ctx.fillRect(11 * z, -4 * z, 3 * z, 5.5 * z);

    // Panther Head
    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.ellipse(11 * z, -9 * z, 4.5 * z, 3.8 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Triangular Ears
    ctx.beginPath();
    ctx.moveTo(8 * z, -12 * z);
    ctx.lineTo(10 * z, -15 * z);
    ctx.lineTo(11 * z, -12 * z);
    ctx.moveTo(12 * z, -12 * z);
    ctx.lineTo(14 * z, -15 * z);
    ctx.lineTo(15 * z, -12 * z);
    ctx.fill();

    // Glowing Amber Feline Eyes (Blinking Slowly)
    const pBlink = (this.animTick % 160) < 6;
    if (pBlink) {
      ctx.fillStyle = '#18181b';
      ctx.fillRect(10 * z, -9.5 * z, 2 * z, 0.8 * z);
      ctx.fillRect(13 * z, -9.5 * z, 2 * z, 0.8 * z);
    } else {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.ellipse(10.5 * z, -9.5 * z, 1.4 * z, 0.9 * z, 0, 0, Math.PI * 2);
      ctx.ellipse(13.5 * z, -9.5 * z, 1.4 * z, 0.9 * z, 0, 0, Math.PI * 2);
      ctx.fill();
      // Slit pupils
      ctx.fillStyle = '#000000';
      ctx.fillRect(10.3 * z, -10.2 * z, 0.5 * z, 1.4 * z);
      ctx.fillRect(13.3 * z, -10.2 * z, 0.5 * z, 1.4 * z);
    }
  }

  // ── 14. Western Jungle: Pepe the Red-Eyed Tree Frog ───────────────────────
  private renderJungleTreefrog(ctx: CanvasRenderingContext2D, z: number): void {
    // Giant Broad Jungle Monstera Leaf
    ctx.fillStyle = '#065f46';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16 * z, 8 * z, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.ellipse(-1 * z, -1 * z, 14 * z, 6.5 * z, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Vivid Green Frog Body
    const throatPulse = Math.sin(this.animTick * 0.18) * 1.5 * z;

    // Neon Orange Suction-Cup Toes
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.arc(-6 * z, 3 * z, 1.5 * z, 0, Math.PI * 2);
    ctx.arc(-8 * z, 1 * z, 1.5 * z, 0, Math.PI * 2);
    ctx.arc(6 * z, 2 * z, 1.5 * z, 0, Math.PI * 2);
    ctx.arc(8 * z, 0, 1.5 * z, 0, Math.PI * 2);
    ctx.fill();

    // Lime Green Back
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.ellipse(0, -2 * z, 5.5 * z, 4 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Blue & Yellow Flank Stripes
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(-3 * z, -1 * z, 6 * z, 1.2 * z);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(-2 * z, 0, 4 * z, 1 * z);

    // Pulsing White Throat Sac
    ctx.fillStyle = 'rgba(254, 240, 138, 0.8)';
    ctx.beginPath();
    ctx.ellipse(0, 1 * z, 3 * z + throatPulse * 0.5, 2 * z + throatPulse, 0, 0, Math.PI * 2);
    ctx.fill();

    // Huge Bulging Red Eyes with Vertical Pupils
    const frogBlink = (this.animTick % 100) < 5;
    if (frogBlink) {
      ctx.fillStyle = '#15803d';
      ctx.fillRect(-4 * z, -6 * z, 3 * z, 1 * z);
      ctx.fillRect(1 * z, -6 * z, 3 * z, 1 * z);
    } else {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(-2.5 * z, -5.5 * z, 2.5 * z, 0, Math.PI * 2);
      ctx.arc(2.5 * z, -5.5 * z, 2.5 * z, 0, Math.PI * 2);
      ctx.fill();
      // Black vertical slit pupil
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-2.8 * z, -7 * z, 0.7 * z, 3 * z);
      ctx.fillRect(2.2 * z, -7 * z, 0.7 * z, 3 * z);
    }
  }

  // ── 15. Western Jungle: Bramble the Three-Toed Tree Sloth ────────────────
  private renderJungleSloth(ctx: CanvasRenderingContext2D, z: number): void {
    // Horizontal banyan branch
    ctx.strokeStyle = '#452814';
    ctx.lineWidth = 3.5 * z;
    ctx.beginPath();
    ctx.moveTo(-16 * z, -10 * z);
    ctx.lineTo(16 * z, -10 * z);
    ctx.stroke();

    // Hanging green liana vines
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 1.2 * z;
    ctx.beginPath();
    ctx.moveTo(-9 * z, -10 * z);
    ctx.lineTo(-9 * z, 4 * z);
    ctx.moveTo(11 * z, -10 * z);
    ctx.lineTo(11 * z, 6 * z);
    ctx.stroke();

    // Gentle slow pendulum sway
    const slowSwing = Math.sin(this.animTick * 0.04) * 0.08;
    ctx.save();
    ctx.translate(0, -10 * z);
    ctx.rotate(slowSwing);

    // Long curved claws gripping the underside of the bough
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-6 * z, -2 * z, 1.2 * z, 4.5 * z);
    ctx.fillRect(-4.2 * z, -2 * z, 1.2 * z, 4.5 * z);
    ctx.fillRect(4.2 * z, -2 * z, 1.2 * z, 4.5 * z);
    ctx.fillRect(6 * z, -2 * z, 1.2 * z, 4.5 * z);

    // Shaggy brownish-gray sloth body
    ctx.fillStyle = '#78716c';
    ctx.beginPath();
    ctx.ellipse(0, 8 * z, 7.5 * z, 5.5 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle mossy-green algae sheen on fur
    ctx.fillStyle = 'rgba(22, 101, 52, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 9 * z, 5.5 * z, 3.5 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pale mask face
    ctx.fillStyle = '#f5f5f4';
    ctx.beginPath();
    ctx.arc(6 * z, 7 * z, 3.4 * z, 0, Math.PI * 2);
    ctx.fill();

    // Dark eye patches
    ctx.fillStyle = '#44403c';
    ctx.fillRect(4.5 * z, 6.2 * z, 3.8 * z, 1.3 * z);

    // Sleepy smiling eyes
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(6.2 * z, 6.2 * z, 1.1 * z, 1.1 * z);

    // Dark button nose & gentle serene smile
    ctx.fillRect(7.8 * z, 7.8 * z, 1.2 * z, 0.9 * z);
    ctx.strokeStyle = '#44403c';
    ctx.lineWidth = 0.9 * z;
    ctx.beginPath();
    ctx.arc(7.6 * z, 8.4 * z, 1.3 * z, 0, Math.PI * 0.8);
    ctx.stroke();

    ctx.restore();
  }

  // ── 16. Eastern Jungle: Raja the Royal Bengal Tiger ───────────────────────
  private renderJungleTiger(ctx: CanvasRenderingContext2D, z: number): void {
    // Sun-drenched riverbank boulder base
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.ellipse(0, 4 * z, 20 * z, 8 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.ellipse(0, 2 * z, 18 * z, 6.8 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Emerald jungle moss on boulder edges
    ctx.fillStyle = '#15803d';
    ctx.fillRect(-12 * z, 1 * z, 6 * z, 2.5 * z);
    ctx.fillRect(4 * z, 2 * z, 8 * z, 2.5 * z);

    const breath = Math.sin(this.animTick * 0.08) * 0.8 * z;

    // Muscular Bengal Orange Body
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.ellipse(-1 * z, -5 * z, 13 * z, 7 * z + breath, 0, 0, Math.PI * 2);
    ctx.fill();

    // Creamy white underbelly & chest ruff
    ctx.fillStyle = '#fffbeb';
    ctx.beginPath();
    ctx.ellipse(6 * z, -3 * z, 4 * z, 5 * z, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Distinct jet-black tiger stripes across body
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.4 * z;
    ctx.beginPath();
    ctx.moveTo(-7 * z, -10 * z); ctx.lineTo(-6 * z, -2 * z);
    ctx.moveTo(-3 * z, -11 * z); ctx.lineTo(-2 * z, -1 * z);
    ctx.moveTo(1 * z, -11 * z); ctx.lineTo(1.5 * z, -1 * z);
    ctx.moveTo(5 * z, -9 * z); ctx.lineTo(4 * z, -3 * z);
    ctx.stroke();

    // Massive front paws resting on the stone
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(8 * z, -2 * z, 5 * z, 4 * z);
    ctx.fillRect(11 * z, -2 * z, 5 * z, 4 * z);
    ctx.fillStyle = '#fffbeb';
    ctx.fillRect(10 * z, 1 * z, 3 * z, 2 * z);
    ctx.fillRect(13 * z, 1 * z, 3 * z, 2 * z);

    // Striped tail curling with rhythmic flick
    const tailTip = Math.sin(this.animTick * 0.12) * 3 * z;
    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 2.2 * z;
    ctx.beginPath();
    ctx.moveTo(-13 * z, -4 * z);
    ctx.quadraticCurveTo(-19 * z, -6 * z, -18 * z, -12 * z + tailTip);
    ctx.stroke();

    // Black stripes on tail
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-17 * z, -7 * z, 2 * z, 1.4 * z);
    ctx.fillRect(-18.5 * z, -10 * z + tailTip * 0.7, 2 * z, 1.4 * z);

    // Tiger Head
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.ellipse(13 * z, -9 * z, 5.5 * z, 4.5 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // White cheeks / whisker pads
    ctx.fillStyle = '#fffbeb';
    ctx.beginPath();
    ctx.ellipse(15 * z, -8 * z, 2.5 * z, 2.5 * z, 0, 0, Math.PI * 2);
    ctx.arc(10.5 * z, -7.5 * z, 2 * z, 0, Math.PI * 2);
    ctx.fill();

    // Pink nose
    ctx.fillStyle = '#f472b6';
    ctx.fillRect(15.5 * z, -9 * z, 1.2 * z, 1 * z);

    // Rounded Ears with white spot
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(10 * z, -13 * z, 2 * z, 0, Math.PI * 2);
    ctx.arc(14 * z, -13 * z, 2 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fffbeb';
    ctx.fillRect(9.5 * z, -13.5 * z, 1.2 * z, 1.2 * z);
    ctx.fillRect(13.5 * z, -13.5 * z, 1.2 * z, 1.2 * z);

    // Glowing Amber Eyes (blinking periodically)
    const tBlink = (this.animTick % 140) < 6;
    if (tBlink) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(12 * z, -10 * z, 2.2 * z, 0.8 * z);
      ctx.fillRect(15 * z, -10 * z, 2.2 * z, 0.8 * z);
    } else {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.ellipse(12.5 * z, -10 * z, 1.4 * z, 1.1 * z, 0, 0, Math.PI * 2);
      ctx.ellipse(15.5 * z, -10 * z, 1.4 * z, 1.1 * z, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.fillRect(12.3 * z, -10.5 * z, 0.6 * z, 1.6 * z);
      ctx.fillRect(15.3 * z, -10.5 * z, 0.6 * z, 1.6 * z);
    }
  }

  // ── 17. Eastern Jungle: Snappy the River Caiman ───────────────────────────
  private renderJungleCaiman(ctx: CanvasRenderingContext2D, z: number): void {
    // Water ripple expansion
    const rip = (this.animTick * 0.05) % 1;
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.6 * (1 - rip)})`;
    ctx.lineWidth = 1.2 * z;
    ctx.beginPath();
    ctx.ellipse(0, 0, (18 + rip * 12) * z, (8 + rip * 6) * z, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Dark emerald creek water pool
    ctx.fillStyle = 'rgba(6, 78, 59, 0.75)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16 * z, 7 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Textured armored caiman back
    ctx.fillStyle = '#14532d';
    ctx.beginPath();
    ctx.ellipse(-2 * z, -3 * z, 11 * z, 5 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Osteoderm scute ridges
    ctx.fillStyle = '#166534';
    for (let k = -9; k <= 4; k += 3) {
      ctx.fillRect(k * z, -6 * z, 2 * z, 2.5 * z);
      ctx.fillRect((k + 1) * z, -4 * z, 2 * z, 2 * z);
    }

    // Long serrated tail swishing through water
    const tailWag = Math.sin(this.animTick * 0.1) * 2.2 * z;
    ctx.fillStyle = '#14532d';
    ctx.beginPath();
    ctx.moveTo(-12 * z, -2 * z);
    ctx.quadraticCurveTo(-18 * z, -1 * z + tailWag, -24 * z, -2 * z + tailWag * 1.5);
    ctx.lineTo(-22 * z, 1 * z + tailWag * 1.5);
    ctx.quadraticCurveTo(-16 * z, 2 * z + tailWag, -11 * z, 1 * z);
    ctx.closePath();
    ctx.fill();

    // Broad snout protruding above water line
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.moveTo(6 * z, -5 * z);
    ctx.lineTo(16 * z, -4 * z);
    ctx.lineTo(17 * z, -1 * z);
    ctx.lineTo(6 * z, 1 * z);
    ctx.closePath();
    ctx.fill();

    // White tooth peaks
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(11 * z, -3 * z, 1 * z, 1.5 * z);
    ctx.fillRect(13 * z, -3 * z, 1 * z, 1.5 * z);
    ctx.fillRect(15 * z, -3 * z, 1 * z, 1.5 * z);

    // Raised reptilian yellow eyes
    const cBlink = (this.animTick % 110) < 5;
    if (cBlink) {
      ctx.fillStyle = '#14532d';
      ctx.fillRect(7 * z, -7 * z, 3 * z, 1.2 * z);
    } else {
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(8.5 * z, -6.5 * z, 2 * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(8.2 * z, -7.5 * z, 0.6 * z, 2.2 * z);
    }
  }

  // ── 18. Eastern Jungle: Barnaby & Luna the Capybara Family ────────────────
  private renderJungleCapybaras(ctx: CanvasRenderingContext2D, z: number): void {
    const breath = Math.sin(this.animTick * 0.07) * 0.7 * z;

    // Mama/Papa Capybara (Barnaby)
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.ellipse(-3 * z, -4 * z, 11 * z, 7.5 * z + breath, 0, 0, Math.PI * 2);
    ctx.fill();

    // Lighter muzzle / underside
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.ellipse(4 * z, -3 * z, 5 * z, 5.5 * z, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Square blunt snout
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.ellipse(7.5 * z, -4 * z, 4 * z, 3.5 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dark blunt nose
    ctx.fillStyle = '#292524';
    ctx.fillRect(9.5 * z, -5.5 * z, 2 * z, 2.4 * z);

    // Sleepy gentle eye
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(6 * z, -7.2 * z, 1.5 * z, 1.2 * z);

    // Ear with occasional peaceful twitch
    const earTwitch = (this.animTick % 90 < 8) ? Math.sin(this.animTick * 0.4) * 1.5 * z : 0;
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.ellipse(3 * z, -9 * z + earTwitch, 1.8 * z, 2.2 * z, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Pink Tropical Water Lily flower resting on Barnaby's head
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.ellipse(3 * z, -11 * z, 3 * z, 1.5 * z, 0, 0, Math.PI * 2);
    ctx.ellipse(3 * z, -11 * z, 1.5 * z, 3 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(3 * z, -11 * z, 1 * z, 0, Math.PI * 2);
    ctx.fill();

    // Baby Capybara (Luna) nestled beside Barnaby
    ctx.save();
    ctx.translate(-11 * z, -1 * z);
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.ellipse(0, -2 * z, 5.5 * z, 4 * z + breath * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Baby head
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.ellipse(4 * z, -2.5 * z, 2.8 * z, 2.4 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#292524';
    ctx.fillRect(6 * z, -3 * z, 1.2 * z, 1.4 * z);
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(4 * z, -4.2 * z, 1 * z, 1 * z);

    // Tiny ear
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.arc(2.5 * z, -5 * z, 1.2 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── 19. Eastern Jungle: Azure & Sunshine the Parrots ──────────────────────
  private renderJungleParrots(ctx: CanvasRenderingContext2D, z: number): void {
    // Twisting jungle liana
    ctx.strokeStyle = '#065f46';
    ctx.lineWidth = 2.5 * z;
    ctx.beginPath();
    ctx.moveTo(-16 * z, -12 * z);
    ctx.quadraticCurveTo(0, -8 * z, 16 * z, -14 * z);
    ctx.stroke();

    // Azure (Blue & Gold Macaw on Left)
    ctx.save();
    ctx.translate(-7 * z, -14 * z);
    const wingRuffle = Math.sin(this.animTick * 0.12) * 1.5 * z;

    // Long cobalt tail feathers
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(-1 * z, 0, 2.5 * z, 14 * z);

    // Golden belly
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.ellipse(1 * z, -2 * z, 3.5 * z, 5 * z, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Cobalt blue wing
    ctx.fillStyle = '#0369a1';
    ctx.beginPath();
    ctx.ellipse(-1.5 * z + wingRuffle * 0.2, -3 * z, 3.5 * z, 6 * z, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Head with white mask and black beak
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(1.5 * z, -8 * z, 3 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(1 * z, -8.5 * z, 2.2 * z, 2 * z);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(2.2 * z, -8.2 * z, 0.9 * z, 0.9 * z);
    ctx.beginPath();
    ctx.moveTo(3.5 * z, -8.5 * z);
    ctx.lineTo(6.5 * z, -7 * z);
    ctx.lineTo(4 * z, -5.5 * z);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Sunshine (Emerald Amazon Parrot on Right)
    ctx.save();
    ctx.translate(6 * z, -15 * z);
    const headTilt = Math.sin(this.animTick * 0.15) * 0.2;
    ctx.rotate(headTilt);

    // Green tail
    ctx.fillStyle = '#15803d';
    ctx.fillRect(-1 * z, 0, 2 * z, 8 * z);

    // Bright lime green body
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.ellipse(0, -2 * z, 3.5 * z, 4.5 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Red wing shoulder flash
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-2 * z, -4 * z, 2 * z, 2.5 * z);

    // Yellow crown
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, -7 * z, 2.6 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(1 * z, -7.5 * z, 0.8 * z, 0.8 * z);

    // Horn bill
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.moveTo(2 * z, -7.5 * z);
    ctx.lineTo(4.5 * z, -6.5 * z);
    ctx.lineTo(2 * z, -5.5 * z);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ── 20. Eastern Jungle: Mango the Golden Lion Tamarin ─────────────────────
  private renderJungleTamarin(ctx: CanvasRenderingContext2D, z: number): void {
    // Bending palm stalk
    ctx.strokeStyle = '#3f6212';
    ctx.lineWidth = 2.2 * z;
    ctx.beginPath();
    ctx.moveTo(-14 * z, 6 * z);
    ctx.quadraticCurveTo(0, -6 * z, 14 * z, -12 * z);
    ctx.stroke();

    // Long golden-orange prehensile tail
    const tailSway = Math.sin(this.animTick * 0.14) * 3 * z;
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1.8 * z;
    ctx.beginPath();
    ctx.moveTo(-4 * z, -4 * z);
    ctx.quadraticCurveTo(-10 * z, 4 * z, -8 * z + tailSway, 12 * z);
    ctx.stroke();

    // Golden-orange silky body
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.ellipse(0, -5 * z, 4 * z, 5 * z, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Radiant golden mane
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(3 * z, -10 * z, 5 * z, 0, Math.PI * 2);
    ctx.fill();

    // Dark face
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.arc(3.5 * z, -9.5 * z, 2.5 * z, 0, Math.PI * 2);
    ctx.fill();

    // Golden curious eyes
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(2.8 * z, -10.2 * z, 0.8 * z, 0.8 * z);
    ctx.fillRect(4.4 * z, -10.2 * z, 0.8 * z, 0.8 * z);

    // Purple jungle berry in paws
    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.arc(4 * z, -4.5 * z, 1.5 * z, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 21. Ambient Jungle Blue Morpho Butterflies ────────────────────────────
  private renderAmbientJungleButterflies(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const z = camera.zoom;
    const butterflyCount = 12;

    for (let i = 0; i < butterflyCount; i++) {
      // Half in Western Jungle (gx: -40..-5), half in Eastern Jungle (gx: 105..145)
      const isWest = i % 2 === 0;
      const baseGx = isWest ? -36 + (i * 4.5) : 105 + (i * 3.8);
      const baseWx = baseGx * TILE_WIDTH;
      const baseWy = (12 + ((i * 7.7) % 80)) * TILE_HEIGHT;

      // Graceful figure-8 sine motion
      const t = this.animTick * 0.04 + i * 1.8;
      const bwx = baseWx + Math.sin(t) * 35;
      const bwy = baseWy + Math.sin(t * 2) * 18;

      const screen = camera.worldToScreen(bwx, bwy);
      if (screen.x < -30 || screen.x > camera.viewportWidth + 30 || screen.y < -30 || screen.y > camera.viewportHeight + 30) {
        continue;
      }

      const wingFold = Math.abs(Math.sin(this.animTick * 0.22 + i));

      ctx.save();
      ctx.translate(screen.x, screen.y);

      // Iridescent Electric-Blue Wings
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.ellipse(-2.5 * z * wingFold, -1 * z, 3 * z * wingFold, 2 * z, -0.3, 0, Math.PI * 2);
      ctx.ellipse(2.5 * z * wingFold, -1 * z, 3 * z * wingFold, 2 * z, 0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.ellipse(-1.5 * z * wingFold, -0.5 * z, 1.8 * z * wingFold, 1.2 * z, -0.3, 0, Math.PI * 2);
      ctx.ellipse(1.5 * z * wingFold, -0.5 * z, 1.8 * z * wingFold, 1.2 * z, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Tiny Body
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-0.5 * z, -2 * z, 1 * z, 4 * z);
      ctx.restore();
    }
  }

  // ── 22. Ambient Jungle Warm Glowing Fireflies ─────────────────────────────
  private renderAmbientForestFireflies(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const z = camera.zoom;
    const fireflyCount = 14;

    for (let i = 0; i < fireflyCount; i++) {
      // Half in Western Jungle (gx: -34..-5), half in Eastern Jungle (gx: 108..148)
      const isWest = i % 2 === 0;
      const baseGx = isWest ? -34 + (i * 4) : 108 + (i * 3.5);
      const baseWx = baseGx * TILE_WIDTH;
      const baseWy = (14 + ((i * 8.2) % 82)) * TILE_HEIGHT;

      const t = this.animTick * 0.03 + i * 2.1;
      const fwx = baseWx + Math.sin(t * 0.7) * 25;
      const fwy = baseWy + Math.cos(t * 0.5) * 20;

      const screen = camera.worldToScreen(fwx, fwy);
      if (screen.x < -30 || screen.x > camera.viewportWidth + 30 || screen.y < -30 || screen.y > camera.viewportHeight + 30) {
        continue;
      }

      const pulse = 0.35 + Math.sin(this.animTick * 0.08 + i * 1.5) * 0.45;

      ctx.save();
      // Soft amber glow halo
      ctx.fillStyle = `rgba(251, 191, 36, ${pulse * 0.3})`;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, 4.5 * z, 0, Math.PI * 2);
      ctx.fill();

      // Bright ember core
      ctx.fillStyle = `rgba(254, 240, 138, ${Math.min(1, pulse * 1.2)})`;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, 1.5 * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
