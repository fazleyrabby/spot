import type { AvatarDefinition } from '@spot/shared';

// 8x8 matrix definitions for retro procedural characters
// 0: transparent, 1: primary, 2: secondary, 3: accent, 4: skin
export const AVATAR_CATALOG: Record<string, AvatarDefinition> = {
  astronaut: {
    id: 'astronaut',
    name: 'Astronaut',
    category: 'geek',
    colors: {
      primary: '#e2e8f0',   // Suit white
      secondary: '#0284c7', // Visor cyan
      accent: '#f59e0b',    // Badge amber
      skin: '#38bdf8'
    },
    pattern: [
      [0, 1, 1, 1, 1, 1, 1, 0],
      [1, 1, 2, 2, 2, 2, 1, 1],
      [1, 2, 2, 3, 2, 2, 2, 1],
      [1, 2, 2, 2, 2, 2, 2, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [0, 1, 3, 1, 1, 3, 1, 0],
      [0, 1, 1, 0, 0, 1, 1, 0],
      [0, 1, 1, 0, 0, 1, 1, 0]
    ]
  },
  hacker: {
    id: 'hacker',
    name: 'Cyber Hacker',
    category: 'retro',
    colors: {
      primary: '#10b981',   // Terminal green
      secondary: '#0f172a', // Hood dark
      accent: '#34d399',    // Glitch light green
      skin: '#fbbf24'
    },
    pattern: [
      [0, 2, 2, 2, 2, 2, 2, 0],
      [2, 2, 2, 2, 2, 2, 2, 2],
      [2, 4, 1, 4, 4, 1, 4, 2],
      [2, 4, 4, 4, 4, 4, 4, 2],
      [0, 2, 2, 2, 2, 2, 2, 0],
      [0, 2, 1, 1, 1, 1, 2, 0],
      [0, 2, 2, 0, 0, 2, 2, 0],
      [0, 2, 2, 0, 0, 2, 2, 0]
    ]
  },
  pixel_wizard: {
    id: 'pixel_wizard',
    name: 'Archmage',
    category: 'creature',
    colors: {
      primary: '#8b5cf6',   // Robe purple
      secondary: '#f43f5e', // Gem pink
      accent: '#fbbf24',    // Star gold
      skin: '#fde047'
    },
    pattern: [
      [0, 0, 0, 3, 3, 0, 0, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 1, 3, 1, 1, 1, 0],
      [1, 1, 4, 4, 4, 4, 1, 1],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 1, 2, 1, 1, 2, 1, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 1, 1, 0, 0, 1, 1, 0]
    ]
  },
  bot_9000: {
    id: 'bot_9000',
    name: 'Unit 9000',
    category: 'geek',
    colors: {
      primary: '#64748b',   // Steel
      secondary: '#ef4444', // Red sensor
      accent: '#38bdf8',    // Cyan core
      skin: '#94a3b8'
    },
    pattern: [
      [0, 0, 3, 3, 3, 3, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [1, 1, 2, 2, 2, 2, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [0, 1, 3, 3, 3, 3, 1, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 1, 0, 1, 1, 0, 1, 0],
      [0, 1, 0, 0, 0, 0, 1, 0]
    ]
  },
  retro_cat: {
    id: 'retro_cat',
    name: '8-Bit Neko',
    category: 'creature',
    colors: {
      primary: '#f97316',   // Ginger orange
      secondary: '#ffffff', // White muzzle
      accent: '#ec4899',    // Pink nose
      skin: '#fb923c'
    },
    pattern: [
      [1, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 0, 0, 0, 0, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 1, 1, 1, 1, 0, 1],
      [1, 2, 2, 3, 3, 2, 2, 1],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 1, 2, 1, 1, 2, 1, 0],
      [0, 1, 1, 0, 0, 1, 1, 0]
    ]
  },
  ghosty: {
    id: 'ghosty',
    name: 'Phantom',
    category: 'creature',
    colors: {
      primary: '#06b6d4',   // Ethereal cyan
      secondary: '#0e7490', // Shadow
      accent: '#67e8f9',    // Glow
      skin: '#ffffff'
    },
    pattern: [
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [1, 1, 4, 1, 1, 4, 1, 1],
      [1, 1, 4, 1, 1, 4, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 1, 0, 0, 1, 0, 1]
    ]
  },
  pixel_knight: {
    id: 'pixel_knight',
    name: 'Paladin',
    category: 'retro',
    colors: {
      primary: '#cbd5e1',   // Silver plate
      secondary: '#3b82f6', // Plume blue
      accent: '#eab308',    // Trim gold
      skin: '#94a3b8'
    },
    pattern: [
      [0, 0, 0, 2, 2, 0, 0, 0],
      [0, 0, 2, 2, 2, 2, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [1, 1, 3, 3, 3, 3, 1, 1],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 1, 3, 1, 1, 3, 1, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 1, 1, 0, 0, 1, 1, 0]
    ]
  },
  neon_ninja: {
    id: 'neon_ninja',
    name: 'Shadow Runner',
    category: 'retro',
    colors: {
      primary: '#18181b',   // Obsidian
      secondary: '#f43f5e', // Crimson headband
      accent: '#fb7185',    // Crimson light
      skin: '#fcd34d'
    },
    pattern: [
      [0, 2, 2, 2, 2, 2, 2, 0],
      [2, 2, 2, 2, 2, 2, 2, 2],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 4, 1, 4, 4, 1, 4, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [0, 1, 2, 1, 1, 2, 1, 0],
      [0, 1, 1, 0, 0, 1, 1, 0],
      [0, 1, 1, 0, 0, 1, 1, 0]
    ]
  },
  pixel_alien: {
    id: 'pixel_alien',
    name: 'Invader X',
    category: 'creature',
    colors: {
      primary: '#a855f7',
      secondary: '#06b6d4',
      accent: '#ec4899',
      skin: '#22c55e'
    },
    pattern: [
      [0, 1, 0, 0, 0, 0, 1, 0],
      [0, 0, 1, 0, 0, 1, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [1, 1, 2, 1, 1, 2, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [0, 1, 0, 1, 1, 0, 1, 0],
      [1, 0, 0, 0, 0, 0, 0, 1],
      [0, 1, 0, 0, 0, 0, 1, 0]
    ]
  },
  golden_knight: {
    id: 'golden_knight',
    name: 'Solar Champion',
    category: 'geek',
    colors: {
      primary: '#f59e0b',
      secondary: '#fbbf24',
      accent: '#ef4444',
      skin: '#fde047'
    },
    pattern: [
      [0, 0, 3, 3, 3, 3, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [1, 1, 2, 2, 2, 2, 1, 1],
      [1, 2, 1, 1, 1, 1, 2, 1],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 1, 3, 1, 1, 3, 1, 0],
      [0, 1, 1, 0, 0, 1, 1, 0],
      [0, 1, 1, 0, 0, 1, 1, 0]
    ]
  },
  cyber_samurai: {
    id: 'cyber_samurai',
    name: 'Cyber Ronin',
    category: 'retro',
    colors: {
      primary: '#0284c7',
      secondary: '#0f172a',
      accent: '#38bdf8',
      skin: '#fed7aa'
    },
    pattern: [
      [0, 2, 2, 3, 3, 2, 2, 0],
      [2, 2, 2, 2, 2, 2, 2, 2],
      [2, 4, 1, 4, 4, 1, 4, 2],
      [2, 4, 4, 4, 4, 4, 4, 2],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 1, 3, 1, 1, 3, 1, 0],
      [0, 2, 2, 0, 0, 2, 2, 0],
      [0, 2, 2, 0, 0, 2, 2, 0]
    ]
  },
  pixel_dino: {
    id: 'pixel_dino',
    name: '8-Bit Dino',
    category: 'creature',
    colors: {
      primary: '#22c55e',
      secondary: '#15803d',
      accent: '#eab308',
      skin: '#4ade80'
    },
    pattern: [
      [0, 0, 0, 1, 1, 1, 1, 0],
      [0, 0, 1, 1, 2, 1, 1, 1],
      [0, 0, 1, 1, 1, 1, 1, 1],
      [0, 0, 1, 1, 1, 0, 0, 0],
      [1, 0, 1, 1, 1, 1, 1, 0],
      [1, 1, 1, 1, 1, 1, 0, 0],
      [0, 1, 1, 1, 1, 0, 0, 0],
      [0, 0, 1, 0, 1, 0, 0, 0]
    ]
  }
};

export function getAvatar(avatarId: string): AvatarDefinition {
  return AVATAR_CATALOG[avatarId] || AVATAR_CATALOG.astronaut;
}

export function drawAvatarOnCanvas(
  ctx: CanvasRenderingContext2D,
  avatar: AvatarDefinition,
  x: number,
  y: number,
  size: number
): void {
  const matrix = avatar.pattern;
  const rows = matrix.length;
  const cols = matrix[0].length;
  const pixelW = size / cols;
  const pixelH = size / rows;

  const colorMap: Record<number, string> = {
    1: avatar.colors.primary,
    2: avatar.colors.secondary,
    3: avatar.colors.accent,
    4: avatar.colors.skin || '#fed7aa'
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const code = matrix[r][c];
      if (code !== 0 && colorMap[code]) {
        ctx.fillStyle = colorMap[code];
        ctx.fillRect(
          Math.floor(x + c * pixelW),
          Math.floor(y + r * pixelH),
          Math.ceil(pixelW),
          Math.ceil(pixelH)
        );
      }
    }
  }
}
