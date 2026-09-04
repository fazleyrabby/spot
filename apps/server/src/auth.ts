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
            custom_avatar_data as "customAvatarData", tagline, bio,
            website_url as "websiteUrl", github_url as "githubUrl",
            twitter_url as "twitterUrl", facebook_url as "facebookUrl",
            instagram_url as "instagramUrl", youtube_url as "youtubeUrl",
            linkedin_url as "linkedinUrl",
            (github_url IS NOT NULL AND github_url <> '') as "isVerified",
            created_at as "createdAt", updated_at as "updatedAt"
     FROM citizens
     WHERE session_token_hash = $1
        OR EXISTS (
          SELECT 1 FROM citizen_sessions s
          WHERE s.citizen_id = citizens.id
            AND s.token_hash = $1
            AND s.expires_at > NOW()
        )
     LIMIT 1`,
    [tokenHash]
  );

  if (res.rows.length === 0) return null;
  return res.rows[0];
}

export async function resolveCitizenById(id: string): Promise<Citizen | null> {
  const result = await query<any>(
    `SELECT id, display_name as "displayName", avatar_id as "avatarId",
            custom_avatar_data as "customAvatarData", tagline, bio,
            website_url as "websiteUrl", github_url as "githubUrl",
            twitter_url as "twitterUrl", facebook_url as "facebookUrl",
            instagram_url as "instagramUrl", youtube_url as "youtubeUrl",
            linkedin_url as "linkedinUrl",
            (github_url IS NOT NULL AND github_url <> '') as "isVerified",
            created_at as "createdAt", updated_at as "updatedAt"
     FROM citizens WHERE id = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
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

  // Local Dev Auto-Login: In local dev, auto-authenticate as Founder (Fazley Rabbi)
  if (!req.citizen && config.appEnv === 'local') {
    const founderRes = await query<any>(
      `SELECT id, display_name as "displayName", avatar_id as "avatarId", 
              custom_avatar_data as "customAvatarData", tagline, bio,
              website_url as "websiteUrl", github_url as "githubUrl",
              twitter_url as "twitterUrl", facebook_url as "facebookUrl",
              instagram_url as "instagramUrl", youtube_url as "youtubeUrl",
              linkedin_url as "linkedinUrl",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM citizens
       WHERE display_name ILIKE '%Fazley%'
       LIMIT 1`
    );
    if (founderRes.rows[0]) {
      req.citizen = founderRes.rows[0];
    }
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

export function clientIp(req: Request): string | null {
  const cfIp = req.headers['cf-connecting-ip'] as string;
  if (cfIp) return cfIp.trim();
  const realIp = req.headers['x-real-ip'] as string;
  if (realIp) return realIp.trim();
  const fwd = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim();
  return fwd || req.socket?.remoteAddress || req.ip || null;
}

export async function saveWebAuthnChallenge(
  citizenId: string | null,
  challenge: string,
  kind: 'register' | 'authenticate'
): Promise<void> {
  await query(
    `INSERT INTO webauthn_challenges (citizen_id, challenge, kind, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '5 minutes')`,
    [citizenId, challenge, kind]
  );
}

export async function consumeWebAuthnChallenge(
  citizenId: string | null,
  challenge: string,
  kind: 'register' | 'authenticate'
): Promise<boolean> {
  const result = await query(
    `DELETE FROM webauthn_challenges
     WHERE challenge = $1 AND kind = $2 AND (citizen_id = $3 OR (citizen_id IS NULL AND $3 IS NULL)) AND expires_at > NOW()
     RETURNING id`,
    [challenge, kind, citizenId]
  );
  return result.rows.length > 0;
}
