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

  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const ip =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
        req.socket.remoteAddress ||
        'unknown_ip';

      const now = Date.now();
      let entry = this.windows.get(ip);

      if (!entry) {
        // LRU cap: prevent unbounded Map growth from IP spoofing
        if (this.windows.size >= this.maxKeys) this.evictOldest();
        entry = { timestamps: [] };
        this.windows.set(ip, entry);
      } else {
        // Refresh LRU order on hit
        this.windows.delete(ip);
        this.windows.set(ip, entry);
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

// 2. Spot claim limiter: Max 3 claim attempts per IP per minute
export const spotClaimLimiter = new SlidingWindowRateLimiter(
  3,
  60 * 1000,
  'Spot claim rate limit exceeded. Please wait a minute before trying again.'
).middleware();
