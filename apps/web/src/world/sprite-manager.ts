/**
 * SpriteManager — Loads and manages Kenney RPG Urban Pack spritesheet and city tiles.
 *
 * Spritesheet: /sprites/city/tilemap_packed.png (432 x 288 px, 27 cols x 18 rows of 16x16 px tiles)
 */

export const TILE_SIZE_SOURCE = 16;
export const SHEET_COLS = 27;
export const SHEET_ROWS = 18;

// Common Kenney Urban tile indices
export const URBAN_TILES = {
  // Ground & Roads
  asphalt: 0,
  road_h_dashed: 1,
  road_v_dashed: 27,
  crosswalk_h: 2,
  crosswalk_v: 28,
  sidewalk: 4,
  sidewalk_curb_top: 31,
  sidewalk_curb_bottom: 58,
  sidewalk_corner_tl: 30,
  sidewalk_corner_tr: 32,
  sidewalk_corner_bl: 57,
  sidewalk_corner_br: 59,

  // Greenery & Parks
  park_grass: 5,
  potted_plant: 74,
  tree_small: 182,
  tree_large_top: 155,
  tree_large_bot: 182,
  planter_box: 101,

  // Street Furniture & Props
  street_lamp: 128,
  bench: 104,
  vending_machine: 103,
  trash_can: 102,
  fire_hydrant: 75,
  traffic_cone: 76,
  bus_stop_sign: 129,
  fence_wood: 130,
  cafe_table: 131,
};

export class SpriteManager {
  private sheetImg: HTMLImageElement | null = null;
  private isLoaded = false;

  async loadEssential(): Promise<void> {
    if (this.isLoaded && this.sheetImg) return;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.sheetImg = img;
        this.isLoaded = true;
        resolve();
      };
      img.onerror = () => {
        console.warn('[SpriteManager] Failed to load city tilemap_packed.png, using procedural fallback.');
        resolve();
      };
      img.src = '/sprites/city/tilemap_packed.png';
    });
  }

  get isReady(): boolean {
    return this.isLoaded && this.sheetImg !== null;
  }

  /**
   * Draw a specific 16x16 tile from the urban pack spritesheet.
   */
  drawTile(
    ctx: CanvasRenderingContext2D,
    tileIndex: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): boolean {
    if (!this.sheetImg || !this.isLoaded) return false;

    const col = tileIndex % SHEET_COLS;
    const row = Math.floor(tileIndex / SHEET_COLS);

    const sx = col * TILE_SIZE_SOURCE;
    const sy = row * TILE_SIZE_SOURCE;

    ctx.drawImage(
      this.sheetImg,
      sx,
      sy,
      TILE_SIZE_SOURCE,
      TILE_SIZE_SOURCE,
      Math.floor(dx),
      Math.floor(dy),
      Math.ceil(dw),
      Math.ceil(dh),
    );
    return true;
  }
}
