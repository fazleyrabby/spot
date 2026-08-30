export type AvatarResolution = 8 | 16 | 24 | 32;

export interface PixelArtAvatar {
  resolution: AvatarResolution;
  matrix: string[][]; // 2D array of hex color strings (e.g. '#38bdf8' or '' for transparent)
  dataUrl: string;    // Tiny compressed WebP data URL (~500 bytes - 2 KB)
}

/**
 * High-Fidelity Retro Pixel Art Converter
 * Uses two-pass downsampling + smart color quantization for crisp, detailed facial & photo avatars.
 */
export async function pixelizeImage(
  imageSource: HTMLImageElement | File | Blob,
  resolution: AvatarResolution = 32,
  options: { contrast?: number; brightness?: number; sharpness?: number } = {}
): Promise<PixelArtAvatar> {
  let img: HTMLImageElement;

  if (imageSource instanceof HTMLImageElement) {
    img = imageSource;
  } else {
    img = await loadImageFromFile(imageSource);
  }

  // Pass 1: High quality intermediate downscale to preserve features
  const intermediateSize = Math.max(resolution * 4, 128);
  const pass1Canvas = document.createElement('canvas');
  pass1Canvas.width = intermediateSize;
  pass1Canvas.height = intermediateSize;
  const p1Ctx = pass1Canvas.getContext('2d');
  if (!p1Ctx) throw new Error('Could not create intermediate canvas');

  p1Ctx.imageSmoothingEnabled = true;
  p1Ctx.imageSmoothingQuality = 'high';

  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;
  const minDim = Math.min(naturalW, naturalH);
  const sx = (naturalW - minDim) / 2;
  const sy = (naturalH - minDim) / 2;

  p1Ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, intermediateSize, intermediateSize);

  // Pass 2: Final pixel grid
  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not create final canvas context');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(pass1Canvas, 0, 0, intermediateSize, intermediateSize, 0, 0, resolution, resolution);

  const imgData = ctx.getImageData(0, 0, resolution, resolution);
  const pixels = imgData.data;

  const contrast = options.contrast ?? 1.12; // enhanced punch
  const brightness = options.brightness ?? 1.02;
  const quantizeStep = resolution >= 24 ? 6 : (resolution >= 16 ? 10 : 16);

  const matrix: string[][] = [];

  for (let r = 0; r < resolution; r++) {
    const row: string[] = [];
    for (let c = 0; c < resolution; c++) {
      const idx = (r * resolution + c) * 4;
      let red = pixels[idx];
      let green = pixels[idx + 1];
      let blue = pixels[idx + 2];
      let alpha = pixels[idx + 3];

      if (alpha < 24) {
        row.push('');
        pixels[idx + 3] = 0;
      } else {
        // Contrast & brightness calibration
        red = clamp(Math.round(((red / 255 - 0.5) * contrast + 0.5) * 255 * brightness));
        green = clamp(Math.round(((green / 255 - 0.5) * contrast + 0.5) * 255 * brightness));
        blue = clamp(Math.round(((blue / 255 - 0.5) * contrast + 0.5) * 255 * brightness));

        // Smart palette quantization
        red = Math.round(red / quantizeStep) * quantizeStep;
        green = Math.round(green / quantizeStep) * quantizeStep;
        blue = Math.round(blue / quantizeStep) * quantizeStep;

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
  const dataUrl = canvas.toDataURL('image/webp', 0.92);

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
