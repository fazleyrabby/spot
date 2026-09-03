import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { query } from './db.js';
import {
  generateSessionToken,
  hashToken,
  COOKIE_NAME,
  COOKIE_OPTIONS,
  type AuthenticatedRequest,
  requireAuthMiddleware,
  optionalAuthMiddleware,
  resolveCitizen,
  resolveCitizenById,
} from './auth.js';
import { config } from './config.js';
import { sendSpotClaimNotification, sendBillboardPurchaseNotification } from './discord.js';
import { citizenCreationLimiter, deviceFingerprintCreationLimiter, spotClaimLimiter, spotCommentLimiter } from './rateLimiter.js';
import {
  CreateCitizenSchema,
  UpdateCitizenSchema,
  containsBlockedWord,
  sanitizeDisplayName,
  formatSocialUrl,
} from '@spot/shared';
import crypto from 'crypto';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';

import type { Request, Response } from 'express';

export const apiRouter: ExpressRouter = Router();

const MAX_PROFANITY_WARNINGS = 3;

function cleanupWebAuthnChallenges(): void {
  void query('DELETE FROM webauthn_challenges WHERE expires_at < NOW()').catch(() => {});
}

async function saveWebAuthnChallenge(citizenId: string | null, challenge: string, kind: 'register' | 'authenticate'): Promise<void> {
  cleanupWebAuthnChallenges();
  await query(
    `INSERT INTO webauthn_challenges (citizen_id, challenge, kind, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '5 minutes')`,
    [citizenId, challenge, kind]
  );
}

async function consumeWebAuthnChallenge(citizenId: string | null, challenge: string, kind: 'register' | 'authenticate'): Promise<boolean> {
  const result = await query<any>(
    `DELETE FROM webauthn_challenges
     WHERE challenge = $1 AND kind = $2 AND expires_at > NOW()
       AND (citizen_id = $3 OR (citizen_id IS NULL AND $3 IS NULL))
     RETURNING id`,
    [challenge, kind, citizenId]
  );
  return result.rows.length > 0;
}

const spotIdPattern = /^\d{1,2},\d{1,2}$/;

function validSpotId(spotId: string): boolean {
  if (!spotIdPattern.test(spotId)) return false;
  const [x, y] = spotId.split(',').map(Number);
  return x >= 0 && x <= 99 && y >= 0 && y <= 99;
}

function escapeXml(value: unknown): string {
  return String(value ?? '').replace(/[<>&'\"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '\"': '&quot;' }[char] || char));
}

function clientIp(req: Request): string | null {
  const fwd = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim();
  return fwd || req.socket?.remoteAddress || req.ip || null;
}

/**
 * Profanity policy (server-side): first attempts are auto-renamed + warned
 * (tracked by IP); repeat offenders get a 403. Returns the display name to persist.
 */
async function enforceServerProfanity(
  displayName: string,
  tagline: string | undefined,
  req: Request
): Promise<string> {
  if (!containsBlockedWord(displayName) && !containsBlockedWord(tagline)) {
    return displayName;
  }

  const ip = clientIp(req);
  const key = ip ? `ip:${ip}` : null;

  let current = 0;
  if (key) {
    const rows = await query<any>(
      `SELECT warning_count FROM moderation_flags WHERE device_key = $1 LIMIT 1`,
      [key]
    );
    current = Number(rows.rows[0]?.warning_count) || 0;
  }

  const next = current + 1;
  if (key) {
    await query<any>(
      `INSERT INTO moderation_flags (device_key, ip_address, warning_count, last_attempt)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (device_key)
       DO UPDATE SET warning_count = EXCLUDED.warning_count, ip_address = EXCLUDED.ip_address, last_attempt = NOW()`,
      [key, ip, next]
    );
  }

  if (next >= MAX_PROFANITY_WARNINGS) {
    const err: any = new Error('Blocked: you repeatedly used offensive language.');
    err.status = 403;
    throw err;
  }

  return sanitizeDisplayName(displayName);
}

// Build a dynamic column list for updating a citizen's optional profile fields.
// Provided (non-undefined) values are applied, so fields can also be cleared.
function buildCitizenProfileUpdate(fields: Record<string, unknown>): {
  assignments: string[];
  params: unknown[];
} {
  const colMap: Array<[string, string]> = [
    ['displayName', 'display_name'],
    ['avatarId', 'avatar_id'],
    ['customAvatarData', 'custom_avatar_data'],
    ['tagline', 'tagline'],
    ['bio', 'bio'],
    ['websiteUrl', 'website_url'],
    ['githubUrl', 'github_url'],
    ['twitterUrl', 'twitter_url'],
    ['facebookUrl', 'facebook_url'],
    ['instagramUrl', 'instagram_url'],
    ['youtubeUrl', 'youtube_url'],
    ['linkedinUrl', 'linkedin_url'],
  ];
  const assignments: string[] = [];
  const params: unknown[] = [];
  for (const [key, col] of colMap) {
    if (fields[key] !== undefined) {
      params.push(fields[key]);
      assignments.push(`${col} = $${params.length}`);
    }
  }
  return { assignments, params };
}

const CITIZEN_PROFILE_COLUMNS = `
  id, display_name as "displayName", avatar_id as "avatarId",
  custom_avatar_data as "customAvatarData", tagline, bio,
  website_url as "websiteUrl", github_url as "githubUrl",
  twitter_url as "twitterUrl", facebook_url as "facebookUrl",
  instagram_url as "instagramUrl", youtube_url as "youtubeUrl",
  linkedin_url as "linkedinUrl",
  (github_url IS NOT NULL AND github_url <> '') as "isVerified",
  created_at as "createdAt", updated_at as "updatedAt"
`;

// Realtime Event Stream Subscribers (tracked by unique client/IP)
interface SseConnection {
  res: Response;
  clientId: string;
  citizenId?: string;
}

const sseConnections = new Set<SseConnection>();

// Short-lived in-memory cache for the world snapshot. The world only changes on
// claim/update/delete, so a 10s TTL makes repeat loads instant without staleness.
const WORLD_CACHE_TTL_MS = 10_000;
let worldCache: { data: any; expiresAt: number } | null = null;

export function invalidateWorldCache(): void {
  worldCache = null;
}

/** Passkey registration for an already identified citizen (guest or GitHub). */
apiRouter.post('/auth/passkey/register/options', requireAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const existing = await query<any>(
      `SELECT credential_id as "credentialId", transports FROM citizen_passkeys WHERE citizen_id = $1`,
      [req.citizen!.id]
    );
    const options = await generateRegistrationOptions({
      rpName: 'SPOT',
      rpID: config.rpId,
      userName: req.citizen!.displayName,
      userID: Buffer.from(req.citizen!.id),
      userDisplayName: req.citizen!.displayName,
      attestationType: 'none',
      excludeCredentials: existing.rows.map((row) => ({ id: row.credentialId, transports: row.transports || [] })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });
    await saveWebAuthnChallenge(req.citizen!.id, options.challenge, 'register');
    res.json(options);
  } catch (err) {
    console.error('Passkey registration options error:', err);
    res.status(500).json({ error: 'PasskeyUnavailable', message: 'Passkeys are temporarily unavailable.' });
  }
});

apiRouter.post('/auth/passkey/register/verify', requireAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge: async (challenge) => consumeWebAuthnChallenge(req.citizen!.id, challenge, 'register'),
      expectedOrigin: config.rpOrigin,
      expectedRPID: config.rpId,
      requireUserVerification: false,
    });
    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: 'PasskeyVerificationFailed', message: 'Passkey verification failed.' });
      return;
    }
    const credential = verification.registrationInfo.credential;
    await query(
      `INSERT INTO citizen_passkeys (citizen_id, credential_id, public_key, counter, transports)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (credential_id) DO NOTHING`,
      [req.citizen!.id, credential.id, Buffer.from(credential.publicKey), credential.counter, req.body.response?.transports || []]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Passkey registration verification error:', err);
    res.status(400).json({ error: 'PasskeyVerificationFailed', message: 'Could not register this passkey.' });
  }
});

apiRouter.post('/auth/passkey/authenticate/options', async (_req, res) => {
  try {
    const options = await generateAuthenticationOptions({
      rpID: config.rpId,
      userVerification: 'preferred',
      // Omit allowCredentials to support discoverable passkeys in a new browser.
    });
    await saveWebAuthnChallenge(null, options.challenge, 'authenticate');
    res.json(options);
  } catch (err) {
    console.error('Passkey authentication options error:', err);
    res.status(500).json({ error: 'PasskeyUnavailable', message: 'Passkeys are temporarily unavailable.' });
  }
});

apiRouter.post('/auth/passkey/authenticate/verify', async (req, res) => {
  try {
    const credentialId = req.body?.id;
    const stored = await query<any>(
      `SELECT p.credential_id as "credentialId", p.public_key as "publicKey", p.counter, p.transports,
              c.id as "citizenId"
       FROM citizen_passkeys p JOIN citizens c ON c.id = p.citizen_id
       WHERE p.credential_id = $1 LIMIT 1`,
      [credentialId]
    );
    const row = stored.rows[0];
    if (!row) {
      res.status(400).json({ error: 'UnknownPasskey', message: 'That passkey is not registered with SPOT.' });
      return;
    }
    const challengeRows = await query<any>(
      `SELECT challenge FROM webauthn_challenges WHERE kind = 'authenticate' AND citizen_id IS NULL AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`
    );
    const challenge = challengeRows.rows[0]?.challenge;
    if (!challenge) {
      res.status(400).json({ error: 'ChallengeExpired', message: 'The passkey request expired. Try again.' });
      return;
    }
    const verification = await verifyAuthenticationResponse({
      response: req.body,
      expectedChallenge: async (value) => consumeWebAuthnChallenge(null, value, 'authenticate'),
      expectedOrigin: config.rpOrigin,
      expectedRPID: config.rpId,
      credential: {
        id: row.credentialId,
        publicKey: new Uint8Array(row.publicKey),
        counter: Number(row.counter),
        transports: row.transports || [],
      },
      requireUserVerification: false,
    });
    if (!verification.verified) {
      res.status(400).json({ error: 'PasskeyVerificationFailed', message: 'Passkey verification failed.' });
      return;
    }
    await query(`UPDATE citizen_passkeys SET counter = $1 WHERE credential_id = $2`, [verification.authenticationInfo.newCounter, credentialId]);
    const citizen = await resolveCitizenById(row.citizenId);
    if (!citizen) {
      res.status(404).json({ error: 'CitizenNotFound' });
      return;
    }
    const token = generateSessionToken();
    await query(
      `INSERT INTO citizen_sessions (citizen_id, token_hash) VALUES ($1, $2)
       ON CONFLICT (token_hash) DO NOTHING`,
      [citizen.id, hashToken(token)]
    );
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    const spotRes = await query<any>(`SELECT id, x, y, claimed_at as "claimedAt" FROM spots WHERE owner_id = $1 LIMIT 1`, [citizen.id]);
    res.json({ success: true, citizen, ownedSpot: spotRes.rows[0] || null, sessionToken: token });
  } catch (err) {
    console.error('Passkey authentication verification error:', err);
    res.status(400).json({ error: 'PasskeyVerificationFailed', message: 'Could not verify this passkey.' });
  }
});

export function getUniqueOnlineCount(): number {
  const uniqueIds = new Set<string>();
  for (const conn of sseConnections) {
    uniqueIds.add(conn.clientId);
  }
  return uniqueIds.size;
}

function getOnlineCitizenIds(): string[] {
  return [...new Set([...sseConnections].map((conn) => conn.citizenId).filter(Boolean) as string[])];
}

export function broadcastRealtimeEvent(event: { type: string; [key: string]: any }) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const conn of sseConnections) {
    try {
      conn.res.write(data);
    } catch {
      sseConnections.delete(conn);
    }
  }
}

/**
 * GET /api/realtime/stream
 * Server-Sent Events (SSE) stream for instant real-time canvas updates across all tabs/devices.
 */
const enableSSE = process.env.ENABLE_SSE !== 'false';
const sseHandler = async (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Deduplicate by Citizen ID, Session Token, Tab ID, or Client IP
  const tokenParam = typeof req.query.token === 'string' ? req.query.token : undefined;
  const tabParam = typeof req.query.tabId === 'string' ? req.query.tabId : undefined;
  const rawToken = req.rawSessionToken || tokenParam;

  let citizenId = req.citizen?.id;
  if (!citizenId && rawToken) {
    const resolved = await resolveCitizen(rawToken);
    if (resolved) citizenId = resolved.id;
  }

  const clientId = citizenId || (rawToken ? `tok_${rawToken.substring(0, 12)}` : (tabParam ? `tab_${tabParam}` : `ip_${req.ip || 'local'}`));
  const conn: SseConnection = { res, clientId, citizenId };
  sseConnections.add(conn);

  const initialCount = getUniqueOnlineCount();
  res.write(`data: ${JSON.stringify({ type: 'connected', onlineCount: initialCount, onlineCitizenIds: getOnlineCitizenIds() })}\n\n`);
  broadcastRealtimeEvent({ type: 'presence', onlineCount: initialCount, onlineCitizenIds: getOnlineCitizenIds() });

  const cleanup = () => {
    if (sseConnections.has(conn)) {
      sseConnections.delete(conn);
      broadcastRealtimeEvent({ type: 'presence', onlineCount: getUniqueOnlineCount(), onlineCitizenIds: getOnlineCitizenIds() });
    }
  };

  req.on('close', cleanup);
  req.on('end', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);
};

if (enableSSE) {
  apiRouter.get('/realtime/stream', optionalAuthMiddleware, sseHandler as any);
  apiRouter.get('/events', optionalAuthMiddleware, sseHandler as any);
}

/**
 * POST /api/realtime/position
 * Broadcast live player position, state, and speech bubble to all connected world viewers.
 */
apiRouter.post('/realtime/position', optionalAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  const { wx, wy, direction, state, speech, displayName, avatarId, guestId } = req.body || {};
  if (typeof wx !== 'number' || typeof wy !== 'number') {
    res.status(400).json({ error: 'InvalidCoordinates' });
    return;
  }

  const citizenId = req.citizen?.id || (typeof guestId === 'string' ? guestId : `guest_${req.ip || 'anon'}`);
  const finalName = req.citizen?.displayName || (typeof displayName === 'string' ? displayName.slice(0, 24) : 'Visitor');
  const finalAvatar = req.citizen?.avatarId || (typeof avatarId === 'string' ? avatarId : 'astronaut');
  const finalDir = ['down', 'up', 'left', 'right'].includes(direction) ? direction : 'down';
  const finalState = typeof state === 'string' ? state : 'idle';
  const finalSpeech = typeof speech === 'string' ? speech.slice(0, 100) : null;

  broadcastRealtimeEvent({
    type: 'player-position',
    citizenId,
    displayName: finalName,
    avatarId: finalAvatar,
    wx,
    wy,
    direction: finalDir,
    state: finalState,
    speech: finalSpeech,
    timestamp: Date.now(),
  });

  res.json({ ok: true });
});

// Periodic heartbeat every 15s to prune stale socket connections (long-running hosts only)
if (enableSSE) {
  setInterval(() => {
    for (const conn of sseConnections) {
      try {
        conn.res.write(': ping\n\n');
      } catch {
        sseConnections.delete(conn);
        broadcastRealtimeEvent({ type: 'presence', onlineCount: getUniqueOnlineCount(), onlineCitizenIds: getOnlineCitizenIds() });
      }
    }
  }, 15000);
}

/**
 * GET /api/analytics/visit
 * Count one unique browser visitor per 24 hours without being affected by the
 * cached world snapshot response.
 */
apiRouter.get('/analytics/visit', async (req, res) => {
  try {
    const isLocalhost = req.hostname === 'localhost' || req.ip === '127.0.0.1' || req.ip === '::1';
    const hasVisitedCookie = req.cookies?.spot_visited;
    let totalVisitors: number;

    if (!isLocalhost && !hasVisitedCookie) {
      const visitorRes = await query<any>(
        `UPDATE site_stats SET value = value + 1 WHERE key = 'total_visitors' RETURNING value;`
      );
      totalVisitors = parseInt(visitorRes.rows[0]?.value, 10) || 1;
      res.cookie('spot_visited', '1', {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax',
      });
    } else {
      const currentRes = await query<any>(`SELECT value FROM site_stats WHERE key = 'total_visitors' LIMIT 1;`);
      totalVisitors = parseInt(currentRes.rows[0]?.value, 10) || 1;
    }

    res.json({ totalVisitors });
  } catch (err: any) {
    console.error('Error recording visitor:', err);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to record visitor' });
  }
});

/**
 * GET /api/world
 * Full snapshot of the world grid & occupied spots for Canvas rendering
 */
apiRouter.get('/world', async (req, res) => {
  try {
    // Serve from cache when fresh
    if (worldCache && Date.now() < worldCache.expiresAt) {
      res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=60');
      return res.json(worldCache.data);
    }

    const spotsRes = await query<any>(`
      SELECT 
        s.id as "spotId", s.x, s.y, s.owner_id as "citizenId",
        s.claimed_at as "claimedAt",
        c.display_name as "displayName", c.avatar_id as "avatarId",
        c.custom_avatar_data as "customAvatarData", c.tagline, c.bio,
        c.website_url as "websiteUrl", c.github_url as "githubUrl",
        c.twitter_url as "twitterUrl", c.facebook_url as "facebookUrl",
        c.instagram_url as "instagramUrl", c.youtube_url as "youtubeUrl",
        c.linkedin_url as "linkedinUrl",
        (c.github_url IS NOT NULL AND c.github_url <> '') as "isVerified"
      FROM spots s
      INNER JOIN citizens c ON s.owner_id = c.id
    `);
    const statsRes = await query<any>(`
      SELECT 
        count(*) as total_spots,
        count(owner_id) as claimed_count
      FROM spots
    `);

    const totalSpots = parseInt(statsRes.rows[0]?.total_spots, 10) || 10000;
    const claimedCount = parseInt(statsRes.rows[0]?.claimed_count, 10) || spotsRes.rows.length;

    const readRes = await query<any>(`SELECT value FROM site_stats WHERE key = 'total_visitors' LIMIT 1;`);
    const totalVisitors = parseInt(readRes.rows[0]?.value, 10) || 1;

    const data = {
      width: 100,
      height: 100,
      totalSpots,
      claimedCount,
      totalVisitors,
      onlineCount: getUniqueOnlineCount(),
      occupied: spotsRes.rows,
    };

    worldCache = { data, expiresAt: Date.now() + WORLD_CACHE_TTL_MS };
    res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=60');
    res.json(data);
  } catch (err: any) {
    console.error('Error fetching world snapshot:', err);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to load world snapshot' });
  }
});

/**
 * GET /api/citizens/me
 * Hydrate current session and check owned spot
 */
apiRouter.get('/citizens/me', optionalAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.citizen) {
    res.json({ authenticated: false, citizen: null, ownedSpot: null });
    return;
  }

  try {
    const spotRes = await query<any>(
      `SELECT id, x, y, claimed_at as "claimedAt" FROM spots WHERE owner_id = $1 LIMIT 1`,
      [req.citizen.id]
    );

    if (config.appEnv === 'local' && !req.cookies?.[COOKIE_NAME]) {
      const devToken = generateSessionToken();
      const tokenHash = hashToken(devToken);
      await query(`UPDATE citizens SET session_token_hash = $1 WHERE id = $2`, [tokenHash, req.citizen.id]);
      res.cookie(COOKIE_NAME, devToken, COOKIE_OPTIONS);
    }

    res.json({
      authenticated: true,
      citizen: req.citizen,
      ownedSpot: spotRes.rows[0] || null,
    });
  } catch (err: any) {
    console.error('Error fetching citizen session:', err);
    res.status(500).json({ error: 'InternalServerError' });
  }
});

/**
 * POST /api/auth/github/sync
 * Authenticate or link a citizen from Supabase GitHub OAuth
 */
apiRouter.post('/auth/github/sync', async (req, res) => {
  const { githubId, username, email, avatarUrl, displayName } = req.body;
  if (!githubId) {
    res.status(400).json({ error: 'MissingGithubId' });
    return;
  }

  try {
    // Check if citizen with github_id already exists
    let existing = await query<any>(
      `SELECT ${CITIZEN_PROFILE_COLUMNS}
       FROM citizens
       WHERE github_id = $1
       LIMIT 1`,
      [String(githubId)]
    );

    // Fallback: match by github username/handle (accounts created before GitHub ID
    // was captured, e.g. direct-mode claims). Normalize to https://github.com/<user>
    if (existing.rows.length === 0 && username) {
      const cleanUser = String(username).replace(/^@/, '').replace(/^https?:\/\/(www\.)?github\.com\//i, '');
      const matches = await query<any>(
        `SELECT ${CITIZEN_PROFILE_COLUMNS}
         FROM citizens
         WHERE github_url ILIKE '%' || $1
         LIMIT 1`,
        [cleanUser]
      );
      if (matches.rows.length > 0) {
        existing = matches;
        // Persist the github_id so future syncs match by ID directly
        await query(`UPDATE citizens SET github_id = $1, updated_at = NOW() WHERE id = $2`, [String(githubId), matches.rows[0].id]);
      }
    }

    let citizen: any;
    let rawToken = generateSessionToken();
    const tokenHash = hashToken(rawToken);

    if (existing.rows.length > 0) {
      citizen = existing.rows[0];
      // Update session token hash + refresh github handle/email/avatar
      await query(
        `UPDATE citizens SET session_token_hash = $1, github_url = COALESCE($2, github_url),
           email = COALESCE($3, email), avatar_url = COALESCE($4, avatar_url), updated_at = NOW()
         WHERE id = $5`,
        [tokenHash, username || null, email || null, avatarUrl || null, citizen.id]
      );
    } else {
      const citizenId = `c_${crypto.randomBytes(12).toString('hex')}`;
      const name = displayName || username || 'Citizen';
      const insertRes = await query<any>(
        `INSERT INTO citizens (id, session_token_hash, display_name, avatar_id, github_url, github_id, email, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${CITIZEN_PROFILE_COLUMNS}`,
        [citizenId, tokenHash, name, 'astronaut', username || null, String(githubId), email || null, avatarUrl || null]
      );
      citizen = insertRes.rows[0];
    }

    // Check owned spot
    const spotRes = await query<any>(`SELECT id, x, y, claimed_at as "claimedAt" FROM spots WHERE owner_id = $1 LIMIT 1`, [citizen.id]);

    res.cookie(COOKIE_NAME, rawToken, COOKIE_OPTIONS);
    res.json({
      success: true,
      authenticated: true,
      sessionToken: rawToken,
      citizen,
      ownedSpot: spotRes.rows[0] || null,
    });
  } catch (err: any) {
    console.error('Error syncing GitHub user:', err);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to sync GitHub user' });
  }
});

/**
 * POST /api/spots/claim
 * Atomic, idempotent spot claim transaction
 */
apiRouter.post('/spots/claim', spotClaimLimiter, optionalAuthMiddleware, (req: AuthenticatedRequest, res, next) => {
  if (!req.citizen) {
    citizenCreationLimiter(req, res, (err?: any) => {
      if (err) return next(err);
      deviceFingerprintCreationLimiter(req, res, next);
    });
    return;
  }
  next();
}, async (req: AuthenticatedRequest, res) => {
  const parsed = CreateCitizenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'ValidationError', details: parsed.error.format() });
    return;
  }

  const { x, y } = req.body as { x?: unknown; y?: unknown };
  if (!Number.isInteger(x) || !Number.isInteger(y) || (x as number) < 0 || (x as number) > 99 || (y as number) < 0 || (y as number) > 99) {
    res.status(400).json({ error: 'ValidationError', message: 'x and y coordinates are required (0-99).' });
    return;
  }
  const spotId = `${x},${y}`;
  const input = parsed.data;

  // Profanity policy: auto-rename + warn, block repeat offenders by IP
  let displayName = input.displayName;
  try {
    displayName = await enforceServerProfanity(input.displayName, input.tagline, req);
  } catch (err: any) {
    if (err?.status === 403) {
      res.status(403).json({ error: 'Blocked', message: err.message });
      return;
    }
    throw err;
  }

  let citizen = req.citizen;
  let rawToken = req.rawSessionToken;
  let createdCitizenId: string | null = null;
  let claimSucceeded = false;
  const deviceFingerprint = typeof req.headers['x-spot-device-fingerprint'] === 'string'
    ? req.headers['x-spot-device-fingerprint']
    : null;

  // If citizen was not resolved from cookie/header, check by githubId if supplied
  if (!citizen && input.githubId) {
    const gitRes = await query<any>(
      `SELECT ${CITIZEN_PROFILE_COLUMNS}
       FROM citizens
       WHERE github_id = $1
       LIMIT 1`,
      [input.githubId]
    );
    if (gitRes.rows.length > 0) {
      citizen = gitRes.rows[0];
    }
  }

  // Durable guest identity guard: a new browser session on the same device
  // cannot claim a second spot if they already own one. Fingerprints are abuse signals,
  // not authentication credentials.
  if (!citizen && deviceFingerprint) {
    const deviceOwnerRes = await query<any>(
      `SELECT c.id as citizen_id, s.id as spot_id, s.x, s.y
       FROM citizens c
       LEFT JOIN spots s ON s.owner_id = c.id
       WHERE c.device_fingerprint = $1
       ORDER BY c.created_at DESC
       LIMIT 1`,
      [deviceFingerprint]
    );
    if (deviceOwnerRes.rows[0]) {
      const owner = deviceOwnerRes.rows[0];
      // Only block if this device already owns an ACTIVE spot on the board (anti-hoarding)
      if (owner.spot_id) {
        res.status(409).json({
          error: 'DeviceAlreadyHasCitizen',
          message: `This device already owns spot (${owner.x}, ${owner.y}). Use Sync Phone to access it here.`,
          ownedSpotId: owner.spot_id,
        });
        return;
      }

      // If the citizen has no spot (e.g. released their spot or previous anonymous attempt),
      // reuse this citizen so the user can claim their new spot smoothly!
      const citRes = await query<any>(
        `SELECT ${CITIZEN_PROFILE_COLUMNS} FROM citizens WHERE id = $1 LIMIT 1`,
        [owner.citizen_id]
      );
      if (citRes.rows[0]) {
        citizen = citRes.rows[0];
      }
    }
  }

  // If citizen is not yet registered, create them on the fly
  if (!citizen) {
    // Keep the anonymous-account cap durable across serverless instances. The
    // in-memory limiter above is still useful for bursts, but is not a store.
    if (!input.githubId) {
      const ip = clientIp(req);
      if (ip) {
        const recentGuestRes = await query<{ count: string }>(
          `SELECT COUNT(*)::text AS count
           FROM citizens
           WHERE github_id IS NULL
             AND ip_address = $1
             AND created_at > NOW() - INTERVAL '24 hours'`,
          [ip]
        );
        if (Number(recentGuestRes.rows[0]?.count || 0) >= 5) {
          res.status(429).json({ error: 'RateLimitExceeded', message: 'Maximum citizen registration limit reached for this IP today.' });
          return;
        }
      }
    }
    const newRawToken = generateSessionToken();
    const tokenHash = hashToken(newRawToken);
    const citizenId = `c_${crypto.randomBytes(12).toString('hex')}`;

    try {
      const citizenRes = await query<any>(
        `INSERT INTO citizens (
           id, session_token_hash, display_name, avatar_id, custom_avatar_data,
           tagline, website_url, github_url, twitter_url, facebook_url,
           instagram_url, youtube_url, linkedin_url, github_id, email, avatar_url, ip_address, device_fingerprint
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         RETURNING ${CITIZEN_PROFILE_COLUMNS}`,
        [
          citizenId,
          tokenHash,
          displayName,
          input.avatarId,
          input.customAvatarData || null,
          input.tagline || null,
          formatSocialUrl(input.websiteUrl, 'website') || null,
          formatSocialUrl(input.githubUrl, 'github') || null,
          formatSocialUrl(input.twitterUrl, 'twitter') || null,
          formatSocialUrl(input.facebookUrl, 'facebook') || null,
          formatSocialUrl(input.instagramUrl, 'instagram') || null,
          formatSocialUrl(input.youtubeUrl, 'youtube') || null,
          formatSocialUrl(input.linkedinUrl, 'linkedin') || null,
          input.githubId || null,
          input.email || null,
          input.avatarUrl || null,
          clientIp(req),
          deviceFingerprint,
        ]
      );
      citizen = citizenRes.rows[0];
      createdCitizenId = citizenRes.rows[0].id;
      rawToken = newRawToken;
      res.cookie(COOKIE_NAME, newRawToken, COOKIE_OPTIONS);
    } catch (err: any) {
      console.error('Error creating citizen during claim:', err);
      res.status(500).json({ error: 'InternalServerError', message: 'Failed to create citizen profile' });
      return;
    }
  } else if (input.avatarId || input.customAvatarData || input.tagline) {
    // Existing citizen (e.g. GitHub user) claiming for the first time — apply chosen profile
    try {
      const { assignments, params } = buildCitizenProfileUpdate({
        avatarId: input.avatarId,
        customAvatarData: input.customAvatarData,
        tagline: input.tagline,
        websiteUrl: input.websiteUrl,
        githubUrl: input.githubUrl,
        twitterUrl: input.twitterUrl,
        facebookUrl: input.facebookUrl,
        instagramUrl: input.instagramUrl,
        youtubeUrl: input.youtubeUrl,
        linkedinUrl: input.linkedinUrl,
      });
      if (assignments.length > 0) {
        params.push(citizen.id);
        await query<any>(
          `UPDATE citizens SET ${assignments.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING ${CITIZEN_PROFILE_COLUMNS}`,
          params
        );
      }
    } catch (err) {
      console.error('Error updating citizen profile during claim:', err);
    }
  }

  if (!citizen) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Check if citizen already owns a DIFFERENT spot
  const existingOwnership = await query<any>(
    `SELECT id, x, y FROM spots WHERE owner_id = $1 LIMIT 1`,
    [citizen.id]
  );

  if (existingOwnership.rows.length > 0 && existingOwnership.rows[0].id !== spotId) {
    res.status(409).json({
      error: 'CitizenAlreadyOwnsSpot',
      message: `You already own spot (${existingOwnership.rows[0].x}, ${existingOwnership.rows[0].y}). Each person gets exactly one spot.`,
      ownedSpotId: existingOwnership.rows[0].id,
    });
    return;
  }

  try {
    // Atomic Check & Claim Query with Idempotency
    const updateRes = await query<any>(
      `UPDATE spots
       SET owner_id = $1, claimed_at = COALESCE(claimed_at, NOW())
       WHERE id = $2 AND (owner_id IS NULL OR owner_id = $1)
       RETURNING id, x, y, owner_id as "ownerId", claimed_at as "claimedAt"`,
      [citizen.id, spotId]
    );

    if (updateRes.rows.length === 0) {
      // Spot was already taken by someone else
      if (createdCitizenId) {
        await query(`DELETE FROM citizens WHERE id = $1`, [createdCitizenId]);
      }
      res.status(409).json({
        error: 'SpotAlreadyOccupied',
        message: 'This spot was already claimed by another citizen.',
        spotId,
      });
      return;
    }

    const claimedSpot = updateRes.rows[0];
    claimSucceeded = true;

    const neighborRes = await query<any>(
      `SELECT DISTINCT owner_id
       FROM spots
       WHERE x BETWEEN $1 - 1 AND $1 + 1
         AND y BETWEEN $2 - 1 AND $2 + 1
         AND owner_id IS NOT NULL
         AND owner_id <> $3`,
      [Number(x), Number(y), citizen.id]
    );
    const neighborCitizenIds = neighborRes.rows.map((row) => row.owner_id);

    const referrerSpotId = typeof req.body?.referrerSpotId === 'string' ? req.body.referrerSpotId : null;
    if (referrerSpotId && validSpotId(referrerSpotId)) {
      const [refX, refY] = referrerSpotId.split(',').map(Number);
      if (Math.abs(refX - Number(x)) <= 1 && Math.abs(refY - Number(y)) <= 1 && (refX !== Number(x) || refY !== Number(y))) {
        await query(
          `INSERT INTO referrals (referrer_spot_id, referred_spot_id, referrer_id, referred_id)
           SELECT $1::varchar, $2::varchar, owner_id, $3::varchar FROM spots WHERE id = $1::varchar
           ON CONFLICT (referred_spot_id) DO NOTHING`,
          [referrerSpotId, spotId, citizen.id]
        );
      }
    }

    broadcastRealtimeEvent({
      type: 'spot_claimed',
      spot: claimedSpot,
      citizen: {
        id: citizen.id,
        displayName: citizen.displayName,
        avatarId: citizen.avatarId,
        tagline: citizen.tagline,
        websiteUrl: citizen.websiteUrl,
        githubUrl: citizen.githubUrl,
      },
      neighborCitizenIds,
    });

    void sendSpotClaimNotification({
      spotId: claimedSpot.id,
      x: Number(x),
      y: Number(y),
      displayName: citizen.displayName,
      tagline: citizen.tagline,
      githubUrl: citizen.githubUrl,
      websiteUrl: citizen.websiteUrl,
      claimedAt: claimedSpot.claimedAt,
    });

    res.status(200).json({
      success: true,
      spot: claimedSpot,
      citizen,
      sessionToken: rawToken || undefined,
    });
    invalidateWorldCache();
  } catch (err: any) {
    // 23505 = unique_violation (spots_owner_id_unique) when citizen races to claim 2 spots at once
    if (err?.code === '23505' || String(err?.message || '').includes('duplicate key')) {
      if (createdCitizenId && !claimSucceeded) {
        await query(`DELETE FROM citizens WHERE id = $1`, [createdCitizenId]).catch(() => {});
      }
      res.status(409).json({
        error: 'CitizenAlreadyOwnsSpot',
        message: 'You already own a spot — each citizen gets exactly one.',
      });
      return;
    }
    console.error('Error executing claim query:', err);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to claim spot' });
  }
});

/**
 * GET /api/spots/:spotId/comments
 * Read the latest public messages on a claimed spot wall.
 */
apiRouter.get('/spots/:spotId/comments', optionalAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  const spotId = String(req.params.spotId);
  if (!validSpotId(spotId)) {
    res.status(400).json({ error: 'InvalidSpotId' });
    return;
  }

  try {
    const spot = await query<any>(`SELECT owner_id, wall_visibility as "visibility" FROM spots WHERE id = $1`, [spotId]);
    if (!spot.rows[0]) {
      res.status(404).json({ error: 'NotFound' });
      return;
    }
    const comments = await query<any>(
      `SELECT id, author_name as "authorName", body, created_at as "createdAt"
       FROM spot_comments WHERE spot_id = $1
       ORDER BY created_at DESC LIMIT 5`,
      [spotId]
    );
    res.json({
      comments: comments.rows,
      visibility: spot.rows[0].visibility,
      canPost: spot.rows[0].visibility === 'open' && req.citizen?.id !== spot.rows[0].owner_id,
      isOwner: req.citizen?.id === spot.rows[0].owner_id,
    });
  } catch (err) {
    console.error('Comments read error:', err);
    res.status(500).json({ error: 'InternalServerError' });
  }
});

/**
 * POST /api/spots/:spotId/comments
 * Add a short public message to a claimed spot wall.
 */
apiRouter.post('/spots/:spotId/comments', spotCommentLimiter, optionalAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  const spotId = String(req.params.spotId);
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  const requestedName = typeof req.body?.authorName === 'string' ? req.body.authorName.trim() : '';
  if (!validSpotId(spotId) || !body || body.length > 180 || (requestedName && requestedName.length > 32)) {
    res.status(400).json({ error: 'ValidationError', message: 'A message up to 180 characters is required.' });
    return;
  }
  if (containsBlockedWord(body) || containsBlockedWord(requestedName)) {
    res.status(400).json({ error: 'BlockedContent', message: 'Please keep the spot wall welcoming.' });
    return;
  }

  try {
    const spot = await query<any>(`SELECT owner_id, wall_visibility as "visibility" FROM spots WHERE id = $1`, [spotId]);
    if (!spot.rows[0]?.owner_id) {
      res.status(409).json({ error: 'SpotUnavailable', message: 'Only claimed spots have walls.' });
      return;
    }
    if (req.citizen?.id === spot.rows[0].owner_id) {
      res.status(403).json({ error: 'OwnSpotComment', message: 'You cannot post on your own spot wall.' });
      return;
    }
    if (spot.rows[0].visibility !== 'open') {
      res.status(403).json({ error: 'WallReadOnly', message: 'This wall is currently read-only.' });
      return;
    }

    const authorName = req.citizen?.displayName || sanitizeDisplayName(requestedName || 'Visitor');
    const inserted = await query<any>(
      `INSERT INTO spot_comments (spot_id, author_id, author_name, body)
       VALUES ($1, $2, $3, $4)
       RETURNING id, author_name as "authorName", body, created_at as "createdAt"`,
      [spotId, req.citizen?.id || null, authorName, body]
    );
    const comment = inserted.rows[0];
    broadcastRealtimeEvent({ type: 'comment_posted', spotId, comment });
    res.status(201).json({ comment });
  } catch (err) {
    console.error('Comments write error:', err);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to post comment' });
  }
});

apiRouter.patch('/spots/:spotId/wall', requireAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  const spotId = String(req.params.spotId);
  const visibility = req.body?.visibility === 'open' ? 'open' : 'readonly';
  if (!validSpotId(spotId)) {
    res.status(400).json({ error: 'InvalidSpotId' });
    return;
  }
  const result = await query<any>(
    `UPDATE spots SET wall_visibility = $1 WHERE id = $2 AND owner_id = $3 RETURNING wall_visibility as "visibility"`,
    [visibility, spotId, req.citizen!.id]
  );
  if (!result.rows[0]) {
    res.status(403).json({ error: 'NotSpotOwner' });
    return;
  }
  broadcastRealtimeEvent({ type: 'wall_updated', spotId, visibility });
  res.json({ visibility });
});

/**
 * GET /api/citizens/search
 * Search citizens, handles, or taglines with associated spot coordinates.
 */
apiRouter.get('/citizens/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) {
    res.json({ results: [] });
    return;
  }

  try {
    const searchPattern = `%${q}%`;
    const searchRes = await query<any>(
      `SELECT 
         c.id, c.display_name as "displayName", c.avatar_id as "avatarId",
         c.custom_avatar_data as "customAvatarData", c.tagline,
         c.website_url as "websiteUrl", c.github_url as "githubUrl",
         c.twitter_url as "twitterUrl", c.facebook_url as "facebookUrl",
         c.instagram_url as "instagramUrl", c.youtube_url as "youtubeUrl",
         c.linkedin_url as "linkedinUrl",
         s.id as "spotId", s.x, s.y
       FROM citizens c
       INNER JOIN spots s ON s.owner_id = c.id
       WHERE c.display_name ILIKE $1 
          OR c.tagline ILIKE $1 
          OR c.github_url ILIKE $1
          OR s.id = $2
       ORDER BY c.created_at DESC
       LIMIT 20`,
      [searchPattern, q]
    );

    res.json({ results: searchRes.rows });
  } catch (err: any) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to execute search' });
  }
});

/**
 * GET /api/citizens/:id
 * Public profile lookup
 */
apiRouter.get('/citizens/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const citizenRes = await query<any>(
      `SELECT ${CITIZEN_PROFILE_COLUMNS}
       FROM citizens
       WHERE id = $1
       LIMIT 1`,
      [id]
    );

    if (citizenRes.rows.length === 0) {
      res.status(404).json({ error: 'NotFound', message: 'Citizen not found' });
      return;
    }

    const spotRes = await query<any>(
      `SELECT id, x, y, claimed_at as "claimedAt" FROM spots WHERE owner_id = $1 LIMIT 1`,
      [id]
    );

    res.json({
      citizen: citizenRes.rows[0],
      spot: spotRes.rows[0] || null,
    });
  } catch (err: any) {
    console.error('Error fetching citizen profile:', err);
    res.status(500).json({ error: 'InternalServerError' });
  }
});

/**
 * PATCH /api/citizens/me
 * Update citizen profile
 */
apiRouter.patch('/citizens/me', requireAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  const parsed = UpdateCitizenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'ValidationError', details: parsed.error.format() });
    return;
  }

  const {
    displayName,
    avatarId,
    customAvatarData,
    tagline,
    bio,
    websiteUrl,
    githubUrl,
    twitterUrl,
    facebookUrl,
    instagramUrl,
    youtubeUrl,
    linkedinUrl,
  } = parsed.data;
  const citizen = req.citizen!;

  try {
    // Profanity policy on the update path too
    let finalName = citizen.displayName;
    if (displayName !== undefined) {
      try {
        finalName = await enforceServerProfanity(displayName, tagline, req);
      } catch (err: any) {
        if (err?.status === 403) {
          res.status(403).json({ error: 'Blocked', message: err.message });
          return;
        }
        throw err;
      }
    }

    const fields: Record<string, unknown> = {
      displayName: displayName !== undefined ? finalName : undefined,
      avatarId,
      customAvatarData,
      tagline: tagline !== undefined ? tagline : undefined,
      bio: bio !== undefined ? bio : undefined,
      websiteUrl: websiteUrl !== undefined ? (formatSocialUrl(websiteUrl, 'website') || null) : undefined,
      githubUrl: githubUrl !== undefined ? (formatSocialUrl(githubUrl, 'github') || null) : undefined,
      twitterUrl: twitterUrl !== undefined ? (formatSocialUrl(twitterUrl, 'twitter') || null) : undefined,
      facebookUrl: facebookUrl !== undefined ? (formatSocialUrl(facebookUrl, 'facebook') || null) : undefined,
      instagramUrl: instagramUrl !== undefined ? (formatSocialUrl(instagramUrl, 'instagram') || null) : undefined,
      youtubeUrl: youtubeUrl !== undefined ? (formatSocialUrl(youtubeUrl, 'youtube') || null) : undefined,
      linkedinUrl: linkedinUrl !== undefined ? (formatSocialUrl(linkedinUrl, 'linkedin') || null) : undefined,
    };
    const { assignments, params } = buildCitizenProfileUpdate(fields);

    if (assignments.length === 0) {
      res.json({ success: true, citizen });
      return;
    }

    params.push(citizen.id);
    const updateRes = await query<any>(
      `UPDATE citizens SET ${assignments.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length}
       RETURNING ${CITIZEN_PROFILE_COLUMNS}`,
      params
    );

    const updatedCitizen = updateRes.rows[0];

    broadcastRealtimeEvent({
      type: 'profile_updated',
      citizen: updatedCitizen,
    });

    res.json({ success: true, citizen: updatedCitizen });
    invalidateWorldCache();
  } catch (err: any) {
    console.error('Error updating citizen profile:', err);
    res.status(500).json({ error: 'InternalServerError' });
  }
});

/**
 * DELETE /api/citizens/me
 * Release owned spot and permanently delete citizen account (Right to Erasure)
 */
apiRouter.delete('/citizens/me', optionalAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  let citizen = req.citizen;

  // Fallback to device fingerprint if auth cookie/header was lost
  if (!citizen) {
    const deviceFingerprint = typeof req.headers['x-spot-device-fingerprint'] === 'string'
      ? req.headers['x-spot-device-fingerprint']
      : null;
    if (deviceFingerprint) {
      const citRes = await query<any>(
        `SELECT ${CITIZEN_PROFILE_COLUMNS} FROM citizens WHERE device_fingerprint = $1 ORDER BY created_at DESC LIMIT 1`,
        [deviceFingerprint]
      );
      if (citRes.rows[0]) {
        citizen = citRes.rows[0];
      }
    }
  }

  if (!citizen) {
    res.status(401).json({ error: 'Unauthorized', message: 'No active citizen profile found to delete.' });
    return;
  }

  try {
    // 1. Get citizen's spot if any
    const spotRes = await query<any>(`SELECT id, x, y FROM spots WHERE owner_id = $1 LIMIT 1`, [citizen.id]);
    const releasedSpot = spotRes.rows[0];

    // 2. Release spot
    if (releasedSpot) {
      await query(`UPDATE spots SET owner_id = NULL, claimed_at = NULL WHERE owner_id = $1`, [citizen.id]);
    }

    // 3. Delete citizen record
    await query(`DELETE FROM citizens WHERE id = $1`, [citizen.id]);

    // 4. Clear auth cookie
    res.clearCookie(COOKIE_NAME, { path: '/' });

    // 5. Broadcast realtime erasure
    if (releasedSpot) {
      broadcastRealtimeEvent({
        type: 'spot_released',
        spotId: releasedSpot.id,
        x: releasedSpot.x,
        y: releasedSpot.y,
        citizenId: citizen.id,
      });
    }

    res.json({ success: true, message: 'Account and spot successfully deleted.' });
    invalidateWorldCache();
  } catch (err: any) {
    console.error('Error deleting citizen account:', err);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to delete account' });
  }
});

/**
 * GET /api/stats
 */
apiRouter.get('/og', async (req, res) => {
  const x = Number(req.query.x);
  const y = Number(req.query.y);
  const spotId = `${x},${y}`;
  if (!Number.isInteger(x) || !Number.isInteger(y) || !validSpotId(spotId)) {
    res.status(400).type('text').send('Use /api/og?x=50&y=50');
    return;
  }

  try {
    const result = await query<any>(
      `SELECT s.x, s.y, c.display_name as "displayName", c.tagline, c.avatar_id as "avatarId",
              c.github_url as "githubUrl"
       FROM spots s LEFT JOIN citizens c ON c.id = s.owner_id
       WHERE s.id = $1 LIMIT 1`,
      [spotId]
    );
    const spot = result.rows[0];
    if (!spot?.displayName) {
      res.status(404).type('text').send('Spot is available');
      return;
    }

    const district = Math.floor(y / 10) * 10 + Math.floor(x / 10) + 1;
    const glyphs: Record<string, string> = {
      astronaut: '✦', hacker: '⌁', pixel_wizard: '✧', bot_9000: '◈', retro_cat: '◆',
      ghosty: '◌', pixel_knight: '⬟', neon_ninja: '✺', pixel_alien: '◎', golden_knight: '⬢',
      cyber_samurai: '⚔', pixel_dino: '◉',
    };
    const displayName = escapeXml(spot.displayName);
    const tagline = escapeXml(spot.tagline || 'A permanent place on the Internet.');
    const glyph = escapeXml(glyphs[spot.avatarId] || '✦');
    const verified = Boolean(spot.githubUrl);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0c0e14"/><stop offset="1" stop-color="#182238"/></linearGradient><pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse"><path d="M42 0H0V42" fill="none" stroke="#ffffff" stroke-opacity=".06"/></pattern></defs>
      <rect width="1200" height="630" fill="url(#bg)"/><rect width="1200" height="630" fill="url(#grid)"/>
      <rect x="72" y="72" width="1056" height="486" rx="28" fill="#111722" fill-opacity=".92" stroke="#334155"/>
      <rect x="116" y="118" width="210" height="210" rx="24" fill="#1d293b" stroke="#f59e0b" stroke-width="3"/>
      <text x="221" y="253" text-anchor="middle" font-size="120" fill="#38bdf8">${glyph}</text>
      <text x="382" y="150" font-family="Arial,sans-serif" font-size="24" font-weight="700" letter-spacing="5" fill="#f59e0b">SPOT · INTERNET CITY</text>
      <text x="382" y="238" font-family="Arial,sans-serif" font-size="62" font-weight="800" fill="#f8fafc">@${displayName}</text>
      <text x="382" y="286" font-family="monospace" font-size="24" fill="#94a3b8">Spot (${x}, ${y}) · Sector ${district}</text>
      <text x="116" y="430" font-family="Arial,sans-serif" font-size="30" fill="#cbd5e1">${tagline}</text>
      <text x="116" y="500" font-family="monospace" font-size="20" fill="#64748b">${verified ? '✓ VERIFIED CITIZEN' : '● CITIZEN'}  ·  A permanent place on the Internet</text>
    </svg>`;
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    res.type('image/svg+xml').send(svg);
  } catch (err) {
    console.error('OG card error:', err);
    res.status(500).type('text').send('Failed to generate card');
  }
});

/**
 * Dynamic share landing page. Social crawlers receive spot-specific metadata;
 * people are redirected into the interactive canvas.
 */
apiRouter.get('/share', async (req, res) => {
  const x = Number(req.query.x);
  const y = Number(req.query.y);
  const spotId = `${x},${y}`;
  if (!Number.isInteger(x) || !Number.isInteger(y) || !validSpotId(spotId)) {
    res.status(400).type('text').send('Use /api/share?x=50&y=50');
    return;
  }

  try {
    const result = await query<any>(
      `SELECT c.display_name as "displayName", c.tagline
       FROM spots s LEFT JOIN citizens c ON c.id = s.owner_id
       WHERE s.id = $1 LIMIT 1`,
      [spotId]
    );
    const spot = result.rows[0];
    if (!spot?.displayName) {
      res.status(404).type('text').send('Spot is available');
      return;
    }

    const title = `${spot.displayName} · SPOT Internet City`;
    const description = spot.tagline || `Visit ${spot.displayName}'s permanent spot at (${x}, ${y}) in SPOT.`;
    const pageUrl = `https://www.claimyourspot.lol/?spot=${x},${y}`;
    const imageUrl = `https://www.claimyourspot.lol/api/og?x=${x}&y=${y}`;
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    res.type('html').send(`<!doctype html><html><head>
      <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${escapeXml(title)}</title><meta name="description" content="${escapeXml(description)}">
      <meta property="og:type" content="website"><meta property="og:url" content="${pageUrl}">
      <meta property="og:title" content="${escapeXml(title)}"><meta property="og:description" content="${escapeXml(description)}">
      <meta property="og:image" content="${imageUrl}"><meta property="og:image:alt" content="${escapeXml(title)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
      <meta property="og:locale" content="en_US">
      <meta name="twitter:card" content="summary_large_image"><meta name="twitter:site" content="@fazleyrabby"><meta name="twitter:title" content="${escapeXml(title)}">
      <meta name="twitter:description" content="${escapeXml(description)}"><meta name="twitter:image" content="${imageUrl}">
      <link rel="canonical" href="${pageUrl}">
      <meta http-equiv="refresh" content="0;url=${pageUrl}">
    </head><body><p>Opening ${escapeXml(title)}…</p><script>location.replace(${JSON.stringify(pageUrl)})</script></body></html>`);
  } catch (err) {
    console.error('Share page error:', err);
    res.status(500).type('text').send('Failed to generate share page');
  }
});

/**
 * GET /api/stats
 */
apiRouter.get('/stats', async (_req, res) => {
  try {
    const statsRes = await query<any>(`
      SELECT 
        count(*) as total_spots,
        count(owner_id) as claimed_spots,
        (SELECT count(*) FROM citizens) as total_citizens
      FROM spots
    `);

    res.json({
      totalSpots: parseInt(statsRes.rows[0].total_spots, 10),
      claimedSpots: parseInt(statsRes.rows[0].claimed_spots, 10),
      totalCitizens: parseInt(statsRes.rows[0].total_citizens, 10),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'InternalServerError' });
  }
});

/**
 * POST /api/billboards/webhook
 * Gumroad Ping Webhook Receiver
 * Parses and persists all billboard sponsorship sales to `billboard_orders`
 */
apiRouter.post('/billboards/webhook', async (req, res) => {
  try {
    const payload = req.body || {};
    console.log('[Gumroad Webhook Received]', JSON.stringify(payload, null, 2));

    const saleId = payload.sale_id || payload.order_number?.toString() || `sale_${Date.now()}`;
    const buyerEmail = payload.email || 'unknown@gumroad.com';
    let buyerName = payload.full_name || payload.purchaser_name || payload.name || null;
    const priceCents = parseInt(payload.price, 10) || 0;
    const currency = (payload.currency || 'usd').toLowerCase();

    // Extract tier / variant
    let tier = 'Standard';
    if (typeof payload.variants === 'string') {
      tier = payload.variants;
    } else if (Array.isArray(payload.variants)) {
      tier = payload.variants.join(', ');
    } else if (typeof payload.variants === 'object' && payload.variants !== null) {
      tier = Object.values(payload.variants).join(', ') || 'Standard';
    } else if (payload.variant) {
      tier = String(payload.variant);
    }

    // Helper to extract fields across payload, url_params, and custom_fields even if URL-encoded
    const extractField = (...targets: string[]): string | null => {
      const sources = [payload, payload.url_params, payload.custom_fields];
      for (const src of sources) {
        if (!src || typeof src !== 'object') continue;
        for (const [k, v] of Object.entries(src)) {
          if (v === undefined || v === null) continue;
          const strVal = typeof v === 'string' ? v.trim() : String(v);
          if (!strVal) continue;

          let decodedKey = k.toLowerCase();
          try {
            decodedKey = decodeURIComponent(k).toLowerCase();
          } catch (_) {}

          for (const target of targets) {
            const tLower = target.toLowerCase();
            if (
              decodedKey === tLower ||
              decodedKey === `[${tLower}]` ||
              decodedKey.includes(`[${tLower}]`) ||
              decodedKey.endsWith(`[${tLower}]`) ||
              decodedKey === tLower.replace(/\s+/g, '_')
            ) {
              return strVal;
            }
          }
        }
      }
      return null;
    };

    // Verify Gumroad Seller ID in production to prevent forged webhook POSTs
    const expectedSellerId = process.env.GUMROAD_SELLER_ID || 'n2H6rlKkX2TThqZrmrCAuA==';
    if (config.appEnv === 'production' && payload.seller_id && payload.seller_id !== expectedSellerId) {
      console.warn(`[Webhook Auth Failure] Invalid seller_id received: ${payload.seller_id}`);
      res.status(403).json({ error: 'Unauthorized: Invalid seller_id' });
      return;
    }

    const billboardId =
      extractField('billboard_id', 'Selected Billboard / Landmark', 'Billboard ID') ||
      payload.billboard_id ||
      'unassigned';

    // Prevent purchasing or overwriting the permanent Founder monument
    if (billboardId === 'banner_founder_showcase') {
      console.warn(`[Billboard Exploit Attempt] Attempted to purchase protected founder showcase: ${saleId}`);
      res.status(400).json({ error: 'Founder monument is protected and cannot be purchased' });
      return;
    }

    const billboardName =
      extractField('billboard_name', 'Billboard Name') ||
      payload.billboard_name ||
      '';

    const rawHeadline = extractField('headline', 'Billboard Headline') || payload.headline || 'SPONSORED';
    const headline = rawHeadline.trim().toUpperCase();

    const subtext = extractField('subtext', 'Subtext / Tagline') || payload.subtext || '';

    const targetUrl = extractField('destination url', 'target_url', 'target url', 'url', 'link') || payload.target_url || null;

    // Strict URL sanitization: block javascript: and data: pseudo-protocols
    let sanitizedTargetUrl: string | null = null;
    if (targetUrl && typeof targetUrl === 'string') {
      const trimmed = targetUrl.trim();
      const lower = trimmed.toLowerCase();
      if (!lower.startsWith('javascript:') && !lower.startsWith('data:') && !lower.startsWith('vbscript:')) {
        sanitizedTargetUrl = (lower.startsWith('http://') || lower.startsWith('https://')) ? trimmed : `https://${trimmed}`;
      }
    }

    const bannerImageUrl = extractField('banner image url', 'image_url', 'logo link') || null;

    const brandColor = extractField('logo / brand color hex', 'brand_color', 'brand color') || payload.brand_color || null;

    const brandName = extractField('brand / sponsor name', 'brand_name', 'sponsor_name');
    if (brandName) {
      buyerName = brandName;
    }

    // Calculate minimum required price for the chosen billboard
    const getRequiredPriceCents = (id: string): number => {
      if (id.startsWith('banner_plaza_') || id === 'banner_boardwalk_pier') {
        return 3500; // $35 Grand Central Plaza & Pier
      }
      if (id.startsWith('banner_cyber_')) {
        return 2000; // $20 Downtown Cyber District
      }
      return 1000; // $10 Scenic & Rail Landmarks
    };

    const isTestPromo =
      config.appEnv === 'local' &&
      (payload.test === 'true' ||
       payload.offer_code?.toLowerCase() === 'testdev' ||
       payload.discount_code?.toLowerCase() === 'testdev' ||
       (payload.url_params?.discount_code?.toLowerCase() === 'testdev'));

    const requiredPriceCents = getRequiredPriceCents(billboardId);

    // On successful payment, make ad immediately LIVE for 30 days
    let status = 'live';
    if (payload.refunded === true || payload.refunded === 'true') {
      status = 'refunded';
    } else if (payload.disputed === true || payload.disputed === 'true') {
      status = 'disputed';
    } else if (!isTestPromo && priceCents < requiredPriceCents) {
      // Prevent underpaying exploit: reject unauthorized cheaper tier selection
      console.warn(`[Billboard Fraud Alert] Sale ${saleId}: Paid ${priceCents}¢ for ${billboardId} (requires ${requiredPriceCents}¢). Flagged as underpaid.`);
      status = 'underpaid';
    }

    // Extract citizenId if passed from logged-in citizen
    const citizenId = extractField('citizen id', 'citizen_id') || null;

    // Check if billboard has an existing active sponsorship so extensions ADD +30 days cumulatively!
    const activeCheck = await query<any>(
      `SELECT expires_at, buyer_email, citizen_id FROM billboard_orders 
       WHERE billboard_id = $1 AND status = 'live' AND expires_at > NOW() 
       ORDER BY expires_at DESC LIMIT 1`,
      [billboardId]
    );

    let startsAt = new Date();
    let expiresAt = new Date(startsAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    let isSameOwner = false;

    if (activeCheck.rows[0]?.expires_at) {
      const existingExpiry = new Date(activeCheck.rows[0].expires_at);
      isSameOwner = 
        Boolean(activeCheck.rows[0].buyer_email && buyerEmail && activeCheck.rows[0].buyer_email.toLowerCase() === buyerEmail.toLowerCase()) ||
        Boolean(citizenId && activeCheck.rows[0].citizen_id && activeCheck.rows[0].citizen_id === citizenId);

      if (isSameOwner) {
        // Same sponsor extending: stack +30 days on top of remaining time
        if (existingExpiry > startsAt) {
          expiresAt = new Date(existingExpiry.getTime() + 30 * 24 * 60 * 60 * 1000);
        }
      } else {
        // Different buyer: queue the ad so it starts after existing sponsor's campaign ends!
        if (existingExpiry > startsAt) {
          startsAt = existingExpiry;
          expiresAt = new Date(existingExpiry.getTime() + 30 * 24 * 60 * 60 * 1000);
        }
      }
    }

    // Persist to Postgres database with cumulative 30 days active validity
    const upsertRes = await query(
      `INSERT INTO billboard_orders (
        gumroad_sale_id,
        billboard_id,
        billboard_name,
        tier,
        buyer_email,
        buyer_name,
        citizen_id,
        headline,
        subtext,
        target_url,
        banner_image_url,
        brand_color,
        price_cents,
        currency,
        status,
        raw_payload,
        starts_at,
        expires_at,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, NOW(), NOW()
      )
      ON CONFLICT (gumroad_sale_id) DO UPDATE SET
        citizen_id = COALESCE(EXCLUDED.citizen_id, billboard_orders.citizen_id),
        banner_image_url = COALESCE(EXCLUDED.banner_image_url, billboard_orders.banner_image_url),
        status = EXCLUDED.status,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = NOW()
      RETURNING (xmax = 0) AS is_new_insert, id, expires_at`,
      [
        saleId,
        billboardId,
        billboardName,
        String(tier),
        buyerEmail,
        buyerName,
        citizenId,
        headline,
        subtext,
        sanitizedTargetUrl,
        bannerImageUrl,
        brandColor,
        priceCents,
        currency,
        status,
        JSON.stringify(payload),
        startsAt.toISOString(),
        expiresAt.toISOString(),
      ]
    );

    // If this was an extension by the same sponsor, mark older live orders as 'extended'
    if (activeCheck.rows[0]?.expires_at && upsertRes.rows[0]?.id && isSameOwner) {
      await query(
        `UPDATE billboard_orders 
         SET status = 'extended', updated_at = NOW() 
         WHERE billboard_id = $1 AND status = 'live' AND id <> $2`,
        [billboardId, upsertRes.rows[0].id]
      );
    }

    const isNewSale = upsertRes.rows[0]?.is_new_insert === true;

    if (isNewSale) {
      console.log(`[Billboard Order Live!] New Sale: ${saleId}, Billboard: ${billboardId} (${billboardName}), Headline: "${headline}"`);

      // Dispatch instant Discord notification ONLY on new purchases (idempotent)
      sendBillboardPurchaseNotification({
        billboardId,
        billboardName: billboardName || billboardId,
        tier: String(tier),
        buyerEmail,
        buyerName,
        headline,
        subtext,
        targetUrl: sanitizedTargetUrl,
        priceFormatted: `$${(priceCents / 100).toFixed(2)}`,
        saleId,
      }).catch((err) => console.error('[Discord Notification Error]', err));
    } else {
      console.log(`[Billboard Order Idempotency] Sale ${saleId} was already recorded. Updated status without duplicate alert.`);
    }

    res.status(200).json({ success: true, saleId, billboardId, status, isNewSale });
  } catch (err: any) {
    console.error('[Gumroad Webhook Error]', err);
    res.status(500).json({ error: 'InternalServerError' });
  }
});

/**
 * POST /api/billboards/manual-assign
 * Allows Admin to manually assign or repair an ad spot for a customer
 * (e.g. if network issue occurred or custom offline deal was made)
 */
apiRouter.post('/billboards/manual-assign', async (req, res) => {
  const suppliedKey = (req.headers['x-admin-key'] as string | undefined) || (req.query.key as string | undefined);
  if (!suppliedKey || suppliedKey !== config.adminSecret) {
    res.status(401).json({ error: 'Unauthorized. Admin authorization key required.' });
    return;
  }

  const {
    billboardId,
    buyerEmail,
    headline,
    subtext,
    targetUrl,
    buyerName,
    citizenId,
    brandColor,
    days = 30,
    tier = 'Admin Manual Assignment',
  } = req.body || {};

  if (!billboardId || !buyerEmail || !headline) {
    res.status(400).json({ error: 'Missing required fields: billboardId, buyerEmail, and headline are required.' });
    return;
  }

  const saleId = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const durationDays = Math.max(1, parseInt(days, 10) || 30);

  try {
    const result = await query(
      `INSERT INTO billboard_orders (
        gumroad_sale_id,
        billboard_id,
        billboard_name,
        tier,
        buyer_email,
        buyer_name,
        citizen_id,
        headline,
        subtext,
        target_url,
        brand_color,
        price_cents,
        currency,
        status,
        raw_payload,
        starts_at,
        expires_at,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, 'usd', 'live',
        '{"source":"manual_admin_assignment"}'::jsonb,
        NOW(), NOW() + ($11 || ' days')::interval, NOW(), NOW()
      )
      RETURNING id, gumroad_sale_id, billboard_id, headline, status, expires_at`,
      [
        saleId,
        billboardId,
        tier,
        buyerEmail,
        buyerName || 'Manual Sponsor',
        citizenId || null,
        headline.toUpperCase(),
        subtext || '',
        targetUrl || null,
        brandColor || '#00f0ff',
        durationDays.toString(),
      ]
    );

    // Notify Discord
    sendBillboardPurchaseNotification({
      billboardId,
      billboardName: billboardId,
      tier,
      buyerEmail,
      buyerName: buyerName || 'Manual Assignment',
      headline,
      subtext,
      targetUrl,
      priceFormatted: '$0.00 (Manual)',
      saleId,
    }).catch(() => {});

    res.json({
      success: true,
      message: `Billboard ${billboardId} manually assigned and is now LIVE for ${durationDays} days!`,
      order: result.rows[0],
    });
  } catch (err: any) {
    console.error('[Manual Assign Error]', err);
    res.status(500).json({ error: 'InternalServerError' });
  }
});

/**
 * GET /api/billboards/orders
 * Admin list of persisted billboard orders (Protected: requires x-admin-key or ?key=)
 */
apiRouter.get('/billboards/orders', async (req, res) => {
  const suppliedKey = (req.headers['x-admin-key'] as string | undefined) || (req.query.key as string | undefined);
  if (!suppliedKey || suppliedKey !== config.adminSecret) {
    res.status(401).json({ error: 'Unauthorized. Admin authorization key required.' });
    return;
  }

  try {
    const orders = await query<any>(
      `SELECT id, gumroad_sale_id, billboard_id, billboard_name, tier, buyer_email, buyer_name, citizen_id,
              headline, subtext, target_url, brand_color, price_cents, currency, status,
              starts_at, expires_at, created_at
       FROM billboard_orders
       ORDER BY created_at DESC
       LIMIT 100`
    );
    res.json({ orders: orders.rows });
  } catch (err: any) {
    console.error('[Fetch Billboard Orders Error]', err);
    res.status(500).json({ error: 'InternalServerError' });
  }
});

/**
 * GET /api/billboards/active
 * Returns all currently live billboard campaigns, joined with Citizen data if sponsor is a citizen
 */
apiRouter.get('/billboards/active', async (_req, res) => {
  try {
    const active = await query<any>(
      `SELECT 
        bo.billboard_id,
        bo.billboard_name,
        bo.headline,
        bo.subtext,
        bo.target_url,
        bo.banner_image_url,
        bo.brand_color,
        bo.buyer_name,
        bo.citizen_id,
        bo.status,
        bo.expires_at,
        c.id AS citizen_db_id,
        c.display_name AS citizen_display_name,
        c.avatar_id AS citizen_avatar_id,
        c.avatar_url AS citizen_avatar_url,
        (c.github_id IS NOT NULL) AS citizen_is_verified,
        c.github_url AS citizen_github_url,
        s.x AS spot_x,
        s.y AS spot_y
       FROM billboard_orders bo
       LEFT JOIN citizens c ON (bo.citizen_id IS NOT NULL AND c.id = bo.citizen_id) 
                            OR (c.email IS NOT NULL AND bo.buyer_email IS NOT NULL AND LOWER(c.email) = LOWER(bo.buyer_email))
       LEFT JOIN spots s ON s.owner_id = c.id
       WHERE bo.status = 'live' 
         AND (bo.starts_at IS NULL OR bo.starts_at <= NOW()) 
         AND (bo.expires_at IS NULL OR bo.expires_at > NOW())
       ORDER BY bo.created_at DESC`
    );

    const activeBanners = active.rows.map((row) => ({
      billboard_id: row.billboard_id,
      billboard_name: row.billboard_name,
      headline: row.headline,
      subtext: row.subtext,
      target_url: row.target_url,
      banner_image_url: row.banner_image_url,
      brand_color: row.brand_color,
      buyer_name: row.buyer_name,
      status: row.status,
      expires_at: row.expires_at,
      citizen: row.citizen_db_id
        ? {
            id: row.citizen_db_id,
            displayName: row.citizen_display_name,
            avatarId: row.citizen_avatar_id,
            avatarUrl: row.citizen_avatar_url,
            isVerified: row.citizen_is_verified,
            githubUrl: row.citizen_github_url,
            spot: row.spot_x !== null && row.spot_y !== null ? { x: row.spot_x, y: row.spot_y } : null,
          }
        : null,
    }));

    res.json({ activeBanners });
  } catch (err: any) {
    console.error('[Fetch Active Billboards Error]', err);
    res.status(500).json({ error: 'InternalServerError' });
  }
});

/**
 * GET /api/billboards/fetch-og?url=...
 * Extracts OpenGraph image, title, and description from a destination URL
 */
apiRouter.get('/billboards/fetch-og', async (req, res) => {
  const targetUrl = req.query.url as string | undefined;
  if (!targetUrl || typeof targetUrl !== 'string') {
    res.status(400).json({ error: 'Missing url parameter' });
    return;
  }

  try {
    let parsed: URL;
    try {
      parsed = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
    } catch {
      res.status(400).json({ error: 'Invalid URL' });
      return;
    }

    // SSRF Protection: strictly block localhost, private LAN, and metadata addresses
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('172.20.') ||
      hostname.startsWith('172.21.') ||
      hostname.startsWith('172.22.') ||
      hostname.startsWith('172.23.') ||
      hostname.startsWith('172.24.') ||
      hostname.startsWith('172.25.') ||
      hostname.startsWith('172.26.') ||
      hostname.startsWith('172.27.') ||
      hostname.startsWith('172.28.') ||
      hostname.startsWith('172.29.') ||
      hostname.startsWith('172.30.') ||
      hostname.startsWith('172.31.') ||
      hostname.startsWith('169.254.') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      res.status(400).json({ error: 'Private or internal network addresses are forbidden' });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 SpotBot/1.0',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      res.json({ ogImage: null, title: null, description: null });
      return;
    }

    const html = await response.text();

    const ogImageMatch =
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i) ||
      html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);

    const titleMatch =
      html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i);

    const descMatch =
      html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);

    let ogImage = ogImageMatch ? ogImageMatch[1].trim() : null;
    if (ogImage && !ogImage.startsWith('http')) {
      try {
        ogImage = new URL(ogImage, parsed.origin).toString();
      } catch {}
    }

    const title = titleMatch ? titleMatch[1].trim() : null;
    const description = descMatch ? descMatch[1].trim() : null;

    res.json({ ogImage, title, description });
  } catch (_err) {
    res.json({ ogImage: null, title: null, description: null });
  }
});


