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
} from './auth.js';
import { citizenCreationLimiter, spotClaimLimiter } from './rateLimiter.js';
import {
  CreateCitizenSchema,
  UpdateCitizenSchema,
  containsBlockedWord,
  sanitizeDisplayName,
} from '@spot/shared';
import crypto from 'crypto';

import type { Request, Response } from 'express';

export const apiRouter: ExpressRouter = Router();

const MAX_PROFANITY_WARNINGS = 3;

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
  custom_avatar_data as "customAvatarData", tagline,
  website_url as "websiteUrl", github_url as "githubUrl",
  twitter_url as "twitterUrl", facebook_url as "facebookUrl",
  instagram_url as "instagramUrl", youtube_url as "youtubeUrl",
  linkedin_url as "linkedinUrl",
  created_at as "createdAt", updated_at as "updatedAt"
`;

// Realtime Event Stream Subscribers (tracked by unique client/IP)
interface SseConnection {
  res: Response;
  clientId: string;
}

const sseConnections = new Set<SseConnection>();

export function getUniqueOnlineCount(): number {
  const uniqueIds = new Set<string>();
  for (const conn of sseConnections) {
    uniqueIds.add(conn.clientId);
  }
  return Math.max(1, uniqueIds.size);
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
 * Server-Sent Events (SSE) stream for instant real-time canvas updates across all tabs/devices
 */
apiRouter.get('/realtime/stream', optionalAuthMiddleware, async (req: AuthenticatedRequest, res) => {
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
  const conn: SseConnection = { res, clientId };
  sseConnections.add(conn);

  const initialCount = getUniqueOnlineCount();
  res.write(`data: ${JSON.stringify({ type: 'connected', onlineCount: initialCount })}\n\n`);
  broadcastRealtimeEvent({ type: 'presence', onlineCount: initialCount });

  const cleanup = () => {
    if (sseConnections.has(conn)) {
      sseConnections.delete(conn);
      broadcastRealtimeEvent({ type: 'presence', onlineCount: getUniqueOnlineCount() });
    }
  };

  req.on('close', cleanup);
  req.on('end', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);
});

// Periodic heartbeat every 15s to prune stale socket connections
setInterval(() => {
  for (const conn of sseConnections) {
    try {
      conn.res.write(': ping\n\n');
    } catch {
      sseConnections.delete(conn);
      broadcastRealtimeEvent({ type: 'presence', onlineCount: getUniqueOnlineCount() });
    }
  }
}, 15000);

/**
 * GET /api/world
 * Full snapshot of the world grid & occupied spots for Canvas rendering
 */
apiRouter.get('/world', async (req, res) => {
  try {
    const spotsRes = await query<any>(`
      SELECT 
        s.id as "spotId", s.x, s.y, s.owner_id as "citizenId",
        c.display_name as "displayName", c.avatar_id as "avatarId",
        c.custom_avatar_data as "customAvatarData", c.tagline,
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

    // Check if local dev or existing session cookie
    const isLocalhost = req.hostname === 'localhost' || req.ip === '127.0.0.1' || req.ip === '::1';
    const hasVisitedCookie = req.cookies?.spot_visited;

    let totalVisitors = 1;
    if (!isLocalhost && !hasVisitedCookie) {
      // New unique visitor in production
      const visitorRes = await query<any>(
        `UPDATE site_stats SET value = value + 1 WHERE key = 'total_visitors' RETURNING value;`
      );
      totalVisitors = parseInt(visitorRes.rows[0]?.value, 10) || 1;
      res.cookie('spot_visited', '1', {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        sameSite: 'lax',
      });
    } else {
      // Read current total without incrementing
      const readRes = await query<any>(`SELECT value FROM site_stats WHERE key = 'total_visitors' LIMIT 1;`);
      totalVisitors = parseInt(readRes.rows[0]?.value, 10) || 1;
    }

    res.json({
      width: 100,
      height: 100,
      totalSpots,
      claimedCount,
      totalVisitors,
      onlineCount: getUniqueOnlineCount(),
      occupied: spotsRes.rows,
    });
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
    const existing = await query<any>(
      `SELECT ${CITIZEN_PROFILE_COLUMNS}
       FROM citizens
       WHERE github_id = $1
       LIMIT 1`,
      [String(githubId)]
    );

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
apiRouter.post('/spots/claim', spotClaimLimiter, optionalAuthMiddleware, async (req: AuthenticatedRequest, res) => {
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

  // If citizen is not yet registered, create them on the fly
  if (!citizen) {
    const newRawToken = generateSessionToken();
    const tokenHash = hashToken(newRawToken);
    const citizenId = `c_${crypto.randomBytes(12).toString('hex')}`;

    try {
      const citizenRes = await query<any>(
        `INSERT INTO citizens (
           id, session_token_hash, display_name, avatar_id, custom_avatar_data,
           tagline, website_url, github_url, twitter_url, facebook_url,
           instagram_url, youtube_url, linkedin_url, github_id, email, avatar_url, ip_address
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         RETURNING ${CITIZEN_PROFILE_COLUMNS}`,
        [
          citizenId,
          tokenHash,
          displayName,
          input.avatarId,
          input.customAvatarData || null,
          input.tagline || null,
          input.websiteUrl || null,
          input.githubUrl || null,
          input.twitterUrl || null,
          input.facebookUrl || null,
          input.instagramUrl || null,
          input.youtubeUrl || null,
          input.linkedinUrl || null,
          input.githubId || null,
          input.email || null,
          input.avatarUrl || null,
          clientIp(req),
        ]
      );
      citizen = citizenRes.rows[0];
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
      const currentOwner = await query<any>(`SELECT owner_id FROM spots WHERE id = $1`, [spotId]);
      res.status(409).json({
        error: 'SpotAlreadyOccupied',
        message: 'This spot was already claimed by another citizen.',
        spotId,
      });
      return;
    }

    const claimedSpot = updateRes.rows[0];

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
    });

    res.status(200).json({
      success: true,
      spot: claimedSpot,
      citizen,
      sessionToken: rawToken || undefined,
    });
  } catch (err: any) {
    // 23505 = unique_violation (spots_owner_id_unique) when citizen races to claim 2 spots at once
    if (err?.code === '23505' || String(err?.message || '').includes('duplicate key')) {
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
 * GET /api/citizens/search
 * Search citizens by name, handle, or tagline with associated spot coordinates
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
      websiteUrl: websiteUrl !== undefined ? websiteUrl : undefined,
      githubUrl: githubUrl !== undefined ? githubUrl : undefined,
      twitterUrl: twitterUrl !== undefined ? twitterUrl : undefined,
      facebookUrl: facebookUrl !== undefined ? facebookUrl : undefined,
      instagramUrl: instagramUrl !== undefined ? instagramUrl : undefined,
      youtubeUrl: youtubeUrl !== undefined ? youtubeUrl : undefined,
      linkedinUrl: linkedinUrl !== undefined ? linkedinUrl : undefined,
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
  } catch (err: any) {
    console.error('Error updating citizen profile:', err);
    res.status(500).json({ error: 'InternalServerError' });
  }
});

/**
 * DELETE /api/citizens/me
 * Release owned spot and permanently delete citizen account (Right to Erasure)
 */
apiRouter.delete('/citizens/me', requireAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  const citizen = req.citizen!;

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
  } catch (err: any) {
    console.error('Error deleting citizen account:', err);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to delete account' });
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
