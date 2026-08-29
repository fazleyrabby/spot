/**
 * Lightweight Client-Side Device & Canvas Fingerprinter (Zero Dependencies)
 * Generates a unique, persistent hardware/GPU fingerprint for anti-abuse and multi-account deduplication.
 */

function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no_2d';

    ctx.textBaseline = 'top';
    ctx.font = '14px Arial, sans-serif';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('SPOT Canvas, <fp:2.0> 👾', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('SPOT Canvas, <fp:2.0> 👾', 4, 17);

    return canvas.toDataURL();
  } catch {
    return 'canvas_err';
  }
}

function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
    if (!gl) return 'no_webgl';

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return 'no_debug_info';

    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
    return `${vendor}~${renderer}`;
  } catch {
    return 'webgl_err';
  }
}

export async function getDeviceFingerprint(): Promise<string> {
  if (typeof window === 'undefined') return 'server_render';

  // Check cache
  const cached = localStorage.getItem('spot_device_fp');
  if (cached && cached.startsWith('dfp_')) return cached;

  try {
    const screenInfo = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}@${window.devicePixelRatio || 1}`;
    const navInfo = `${navigator.language || ''}|${(navigator as any).hardwareConcurrency || ''}|${(navigator as any).deviceMemory || ''}|${navigator.platform || ''}`;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const canvasHash = simpleHash(getCanvasFingerprint());
    const webglHash = simpleHash(getWebGLFingerprint());

    const rawString = `${screenInfo}#${navInfo}#${timezone}#${canvasHash}#${webglHash}`;
    const hash1 = simpleHash(rawString);
    const hash2 = simpleHash(rawString.split('').reverse().join(''));
    const fingerprint = `dfp_${hash1}${hash2}`.substring(0, 32);

    localStorage.setItem('spot_device_fp', fingerprint);
    return fingerprint;
  } catch {
    const fallback = `dfp_${Math.random().toString(36).substring(2, 18)}`;
    localStorage.setItem('spot_device_fp', fallback);
    return fallback;
  }
}
