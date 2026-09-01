/**
 * SpriteManager — Loads and caches top-down & village sprite assets.
 */

export interface SpriteDefinition {
  src: string;
  anchorX?: number;
  anchorY?: number;
}

// Nature sprites (trees, rocks, bushes)
const NATURE_SPRITES: Record<string, SpriteDefinition> = {};
for (let i = 0; i <= 9; i++) {
  NATURE_SPRITES[`nature_${i}`] = {
    src: `/sprites/nature/nature_${String(i).padStart(3, '0')}.png`,
    anchorX: 0.5,
    anchorY: 1.0,
  };
}

// Building sprites
const HOUSE_SPRITES: Record<string, SpriteDefinition> = {};
for (let i = 0; i <= 87; i++) {
  HOUSE_SPRITES[`house_${i}`] = {
    src: `/sprites/buildings/house_${String(i).padStart(3, '0')}.png`,
    anchorX: 0.5,
    anchorY: 1.0,
  };
}

export const HOUSE_KEYS = Object.keys(HOUSE_SPRITES);

export class SpriteManager {
  private cache = new Map<string, HTMLImageElement>();
  private loaded = false;

  async loadEssential(): Promise<void> {
    const essential = { ...NATURE_SPRITES, ...HOUSE_SPRITES };
    const promises: Promise<void>[] = [];

    // Load first 15 houses and all nature sprites for fast initial render
    const initialKeys = [
      ...Object.keys(NATURE_SPRITES),
      ...HOUSE_KEYS.slice(0, 20),
    ];

    for (const key of initialKeys) {
      const def = essential[key as keyof typeof essential];
      if (def) promises.push(this.loadSprite(key, def.src));
    }

    await Promise.allSettled(promises);
    this.loaded = true;

    // Lazily load the rest in the background
    setTimeout(() => {
      for (const key of HOUSE_KEYS.slice(20)) {
        const def = HOUSE_SPRITES[key];
        if (def && !this.cache.has(key)) {
          void this.loadSprite(key, def.src);
        }
      }
    }, 100);
  }

  private loadSprite(key: string, src: string): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.cache.set(key, img);
        resolve();
      };
      img.onerror = () => {
        resolve(); // Continue gracefully on missing asset
      };
      img.src = src;
    });
  }

  getSprite(key: string): HTMLImageElement | null {
    return this.cache.get(key) ?? null;
  }

  getHouseKeyForSpot(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash << 5) - hash + name.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % Math.max(1, HOUSE_KEYS.length);
    return `house_${idx}`;
  }

  get isReady(): boolean {
    return this.loaded;
  }
}
