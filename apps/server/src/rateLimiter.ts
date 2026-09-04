import type { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  timestamps: number[];
}

export class SlidingWindowRateLimiter {
  private windows: Map<string, RateLimitEntry> = new Map();
  private maxRequests: number;
  private windowMs: number;
  private message: string;
  private maxKeys: number;

  constructor(maxRequests: number, windowMs: number, message?: string, maxKeys = 10000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.message = message || 'Too many requests, please try again later';
    this.maxKeys = maxKeys;

    // Auto-cleanup stale keys every 10 minutes
    setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  private evictOldest(): void {
    const firstKey = this.windows.keys().next().value;
    if (firstKey !== undefined) this.windows.delete(firstKey);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.windows.entries()) {
      entry.timestamps = entry.timestamps.filter((ts) => now - ts < this.windowMs);
      if (entry.timestamps.length === 0) {
        this.windows.delete(key);
      }
    }
  }

  middleware(keyResolver?: (req: Request) => string) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const ip =
        (req.headers['cf-connecting-ip'] as string)?.trim() ||
        (req.headers['x-real-ip'] as string)?.trim() ||
        (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
        req.socket.remoteAddress ||
        'unknown_ip';
      const key = keyResolver?.(req) || ip;

      const now = Date.now();
      let entry = this.windows.get(key);

      if (!entry) {
        // LRU cap: prevent unbounded Map growth from IP spoofing
        if (this.windows.size >= this.maxKeys) this.evictOldest();
        entry = { timestamps: [] };
        this.windows.set(key, entry);
      } else {
        // Refresh LRU order on hit
        this.windows.delete(key);
        this.windows.set(key, entry);
      }

      // Filter out timestamps outside current window
      entry.timestamps = entry.timestamps.filter((ts) => now - ts < this.windowMs);

      if (entry.timestamps.length >= this.maxRequests) {
        const oldest = entry.timestamps[0];
        const retryAfterSeconds = Math.ceil((oldest + this.windowMs - now) / 1000);
        res.setHeader('Retry-After', retryAfterSeconds);
        res.status(429).json({
          error: 'RateLimitExceeded',
          message: this.message,
          retryAfterSeconds,
        });
        return;
      }

      entry.timestamps.push(now);
      next();
    };
  }
}

// 1. Citizen creation limiter: Max 5 new anonymous citizens per IP per 24 hours
export const citizenCreationLimiter = new SlidingWindowRateLimiter(
  5,
  24 * 60 * 60 * 1000,
  'Maximum citizen registration limit reached for this IP today'
).middleware();

// A browser fingerprint is only an abuse signal, never an ownership credential.
// Use it alongside the IP limit to make anonymous account multiplication harder.
export const deviceFingerprintCreationLimiter = new SlidingWindowRateLimiter(
  1,
  24 * 60 * 60 * 1000,
  'This device already has an anonymous citizen',
  20000
).middleware((req) => {
  const fingerprint = req.headers['x-spot-device-fingerprint'];
  return typeof fingerprint === 'string' && fingerprint.startsWith('dfp_')
    ? `fp:${fingerprint}`
    : `ip:${(req.headers['cf-connecting-ip'] as string)?.trim() || (req.headers['x-real-ip'] as string)?.trim() || (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown_ip'}`;
});

// 2. Spot claim limiter: Max 3 claim attempts per IP per minute
export const spotClaimLimiter = new SlidingWindowRateLimiter(
  3,
  60 * 1000,
  'Spot claim rate limit exceeded. Please wait a minute before trying again.'
).middleware();

// 3. Spot wall limiter: Max 5 comments per IP every 10 minutes
export const spotCommentLimiter = new SlidingWindowRateLimiter(
  5,
  10 * 60 * 1000,
  'Spot wall rate limit exceeded. Please wait before posting again.'
).middleware();

// 4. Global API Limiter: Max 300 requests per minute per IP (protects against Burp Suite, scrapers, DDoS bursts)
export const globalApiLimiter = new SlidingWindowRateLimiter(
  300,
  60 * 1000,
  'Global API request threshold exceeded. Please slow down.'
).middleware();

// 5. Search Limiter: Max 30 searches per minute per IP
export const searchLimiter = new SlidingWindowRateLimiter(
  30,
  60 * 1000,
  'Too many search queries. Please slow down.'
).middleware();

// 6. OpenGraph Scraper Limiter: Max 10 URL fetches per minute per IP
export const ogFetchLimiter = new SlidingWindowRateLimiter(
  10,
  60 * 1000,
  'Too many link preview requests. Please wait a moment.'
).middleware();

// 7. Auth / Sync Limiter: Max 60 auth sync requests per minute per IP
export const authSyncLimiter = new SlidingWindowRateLimiter(
  60,
  60 * 1000,
  'Too many authentication requests. Please wait.'
).middleware();
