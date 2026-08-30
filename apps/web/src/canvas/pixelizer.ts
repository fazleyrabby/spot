/**
 * Client-Side Retro Pixel Art Avatar Converter
 * Converts any uploaded photo or image into a sanitized 16x16 or 8x8 pixel art matrix.
 */

export interface PixelArtAvatar {
  resolution: 8 | 16;
  matrix: string[][]; // 2D array of hex color strings (e.g. '#38bdf8' or '' for transparent)
  dataUrl: string;    // Tiny compressed WebP data URL (~500 bytes)
}

/**
 * Quantize / Pixelize an image from an HTML Image or File
 */
export async function pixelizeImage(
  imageSource: HTMLImageElement | File | Blob,
  resolution: 8 | 16 = 16,
  options: { contrast?: number; brightness?: number } = {}
): Promise<PixelArtAvatar> {
  let img: HTMLImageElement;

  if (imageSource instanceof HTMLImageElement) {
    img = imageSource;
  } else {
    img = await loadImageFromFile(imageSource);
  }

  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not create canvas context');

  // Disable smoothing for sharp pixel downscaling
  ctx.imageSmoothingEnabled = false;

  // Center crop square
  const minDim = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
  const sx = ((img.naturalWidth || img.width) - minDim) / 2;
  const sy = ((img.naturalHeight || img.height) - minDim) / 2;

  ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, resolution, resolution);

  const imgData = ctx.getImageData(0, 0, resolution, resolution);
  const pixels = imgData.data;

  const contrast = options.contrast ?? 1.15; // slightly punchier colors
  const brightness = options.brightness ?? 1.0;

  const matrix: string[][] = [];

  for (let r = 0; r < resolution; r++) {
    const row: string[] = [];
    for (let c = 0; c < resolution; c++) {
      const idx = (r * resolution + c) * 4;
      let red = pixels[idx];
      let green = pixels[idx + 1];
      let blue = pixels[idx + 2];
      let alpha = pixels[idx + 3];

      if (alpha < 32) {
        // Transparent pixel
        row.push('');
        pixels[idx + 3] = 0;
      } else {
        // Apply contrast & brightness
        red = clamp(Math.round(((red / 255 - 0.5) * contrast + 0.5) * 255 * brightness));
        green = clamp(Math.round(((green / 255 - 0.5) * contrast + 0.5) * 255 * brightness));
        blue = clamp(Math.round(((blue / 255 - 0.5) * contrast + 0.5) * 255 * brightness));

        // Quantize colors to retro 8-bit palette vibe (step of 16 for cleaner pixel blocks)
        red = Math.round(red / 16) * 16;
        green = Math.round(green / 16) * 16;
        blue = Math.round(blue / 16) * 16;

        red = clamp(red);
        green = clamp(green);
        blue = clamp(blue);

        pixels[idx] = red;
        pixels[idx + 1] = green;
        pixels[idx + 2] = blue;
        pixels[idx + 3] = 255;

        const hex = `#${((1 << 24) + (red << 16) + (green << 8) + blue).toString(16).slice(1)}`;
        row.push(hex);
      }
    }
    matrix.push(row);
  }

  ctx.putImageData(imgData, 0, 0);
  const dataUrl = canvas.toDataURL('image/webp', 0.9);

  return { resolution, matrix, dataUrl };
}

function clamp(val: number): number {
  return Math.max(0, Math.min(255, val));
}

function loadImageFromFile(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
