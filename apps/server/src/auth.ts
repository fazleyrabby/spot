import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { query } from './db.js';
import { config } from './config.js';
import type { Citizen } from '@spot/shared';

export const COOKIE_NAME = 'spot_session_token';

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.isProd,
  sameSite: 'lax' as const,
  maxAge: 10 * 365 * 24 * 60 * 60 * 1000, // 10 years (permanent identity)
  path: '/',
};

/**
 * Generate a cryptographically random 256-bit opaque token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash session token with SHA-256 for secure database storage
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export interface AuthenticatedRequest extends Request {
  citizen?: Citizen;
  rawSessionToken?: string;
}

/**
 * Resolves the authenticated citizen from HttpOnly cookie if present
 */
export async function resolveCitizen(token: string): Promise<Citizen | null> {
  const tokenHash = hashToken(token);
  const res = await query<any>(
    `SELECT id, display_name as "displayName", avatar_id as "avatarId", 
            custom_avatar_data as "customAvatarData", tagline,
            website_url as "websiteUrl", github_url as "githubUrl",
            twitter_url as "twitterUrl", facebook_url as "facebookUrl",
            instagram_url as "instagramUrl", youtube_url as "youtubeUrl",
            linkedin_url as "linkedinUrl",
            created_at as "createdAt", updated_at as "updatedAt"
     FROM citizens
     WHERE session_token_hash = $1
     LIMIT 1`,
    [tokenHash]
  );

  if (res.rows.length === 0) return null;
  return res.rows[0];
}

/**
 * Middleware: Optional session resolution
 */
export async function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const customHeader = req.headers['x-spot-session'] as string;
  let token = req.cookies?.[COOKIE_NAME];
  if (!token && authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  if (!token && customHeader) {
    token = customHeader;
  }

  if (token && typeof token === 'string') {
    req.rawSessionToken = token;
    const citizen = await resolveCitizen(token);
    if (citizen) req.citizen = citizen;
  }
  next();
}

/**
 * Middleware: Enforces that the request comes from an authenticated citizen
 */
export async function requireAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const customHeader = req.headers['x-spot-session'] as string;
  let token = req.cookies?.[COOKIE_NAME];
  if (!token && authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  if (!token && customHeader) {
    token = customHeader;
  }

  if (!token || typeof token !== 'string') {
    res.status(401).json({ error: 'Unauthorized: Missing citizen session token' });
    return;
  }

  const citizen = await resolveCitizen(token);
  if (!citizen) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired session token' });
    return;
  }

  req.citizen = citizen;
  req.rawSessionToken = token;
  next();
}
