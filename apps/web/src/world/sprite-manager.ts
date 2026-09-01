/**
 * SpriteManager — loads and caches Kenney isometric sprite sheets.
 *
 * Kenney CC0 packs used:
 *   - Isometric Blocks   → terrain tiles
 *   - Isometric Buildings → houses / structures
 *   - Isometric Landscape → trees, vegetation
 *
 * Download the packs from https://kenney.nl/assets and place PNGs under:
 *   apps/web/public/sprites/terrain/
 *   apps/web/public/sprites/buildings/
 *   apps/web/public/sprites/vegetation/
 *
 * Each sprite is referenced by a logical name. If the image hasn't loaded yet
 * (or isn't present), getSprite() returns null and callers fall back to the
 * procedural Canvas2D drawing in iso-renderer.ts.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpriteFrame {
  img: HTMLImageElement;
  /** Source x in the sheet (0 for full-image sprites) */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

type SpriteState = 'pending' | 'loading' | 'ready' | 'failed';

interface SpriteEntry {
  state: SpriteState;
  frame: SpriteFrame | null;
}

// ---------------------------------------------------------------------------
// Sprite manifest
// Maps logical sprite names → public URL paths (Kenney asset filenames)
//
// IMPORTANT: file names below match the Kenney pack exactly.
// Place the downloaded PNGs in apps/web/public/sprites/ as noted.
// ---------------------------------------------------------------------------

const SPRITE_MANIFEST: Record<string, string> = {
  // --- Terrain (Isometric Blocks pack) ---
  // File: isometric-blocks/PNG/Default (128px)/blockGrass.png
  terrain_grass_a:    '/sprites/terrain/blockGrass.png',
  terrain_grass_b:    '/sprites/terrain/blockGrassHill.png',
  terrain_dirt:       '/sprites/terrain/blockDirt.png',
  terrain_stone:      '/sprites/terrain/blockStone.png',
  terrain_sand:       '/sprites/terrain/blockSand.png',
  terrain_water:      '/sprites/terrain/blockWater.png',

  // --- Vegetation (Isometric Landscape pack) ---
  // File: isometric-landscape/PNG/Default (128px)/...
  vegetation_tree_a:  '/sprites/vegetation/treePine.png',
  vegetation_tree_b:  '/sprites/vegetation/treePineSmall.png',
  vegetation_bush:    '/sprites/vegetation/bush.png',
  vegetation_flower:  '/sprites/vegetation/flower.png',
  vegetation_rock:    '/sprites/vegetation/rock.png',

  // --- Buildings (Isometric Buildings pack) ---
  // File: isometric-buildings/PNG/Default (128px)/...
  building_default:   '/sprites/buildings/buildingA.png',
  building_tech:      '/sprites/buildings/buildingC.png',
  building_magic:     '/sprites/buildings/buildingE.png',
  building_explorer:  '/sprites/buildings/buildingB.png',
};

// ---------------------------------------------------------------------------
// SpriteManager
// ---------------------------------------------------------------------------

export class SpriteManager {
  private cache = new Map<string, SpriteEntry>();

  constructor() {
    // Pre-warm all entries as pending
    for (const key of Object.keys(SPRITE_MANIFEST)) {
      this.cache.set(key, { state: 'pending', frame: null });
    }
  }

  /**
   * Kick off loading of all sprites. Call once on engine init.
   * Individual sprites become available as they finish loading —
   * the renderer falls back to procedural drawing until then.
   */
  loadAll(): void {
    for (const [key, url] of Object.entries(SPRITE_MANIFEST)) {
      this.loadOne(key, url);
    }
  }

  /**
   * Load only the sprites needed for visible terrain to avoid
   * loading all 20+ images upfront on slow connections.
   */
  loadEssential(): void {
    const essential = [
      'terrain_grass_a',
      'terrain_grass_b',
      'vegetation_tree_a',
      'vegetation_tree_b',
      'building_default',
    ];
    for (const key of essential) {
      const url = SPRITE_MANIFEST[key];
      if (url) this.loadOne(key, url);
    }
  }

  private loadOne(key: string, url: string): void {
    const entry = this.cache.get(key)!;
    if (entry.state !== 'pending') return;

    entry.state = 'loading';
    const img = new Image();

    img.onload = () => {
      entry.state = 'ready';
      entry.frame = { img, sx: 0, sy: 0, sw: img.naturalWidth, sh: img.naturalHeight };
    };

    img.onerror = () => {
      // Sprite missing — renderer will use procedural fallback silently
      entry.state = 'failed';
    };

    img.src = url;
  }

  /**
   * Return a ready sprite frame, or null if not yet loaded / missing.
   * Callers MUST handle null gracefully.
   */
  getSprite(key: string): SpriteFrame | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Lazy-start loading on first access
    if (entry.state === 'pending') {
      const url = SPRITE_MANIFEST[key];
      if (url) this.loadOne(key, url);
    }

    return entry.frame;
  }

  /** True if all attempted loads have settled (ready or failed). */
  get isSettled(): boolean {
    for (const entry of this.cache.values()) {
      if (entry.state === 'loading' || entry.state === 'pending') return false;
    }
    return true;
  }

  /** Number of sprites currently in ready state. */
  get readyCount(): number {
    let n = 0;
    for (const entry of this.cache.values()) {
      if (entry.state === 'ready') n++;
    }
    return n;
  }

  get totalCount(): number {
    return this.cache.size;
  }
}
