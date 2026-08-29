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
  ClaimSpotSchema,
  UpdateCitizenSchema,
} from '@spot/shared';
import crypto from 'crypto';

import type { Response } from 'express';

export const apiRouter: ExpressRouter = Router();

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
        c.tagline, c.website_url as "websiteUrl", c.github_url as "githubUrl",
        c.linkedin_url as "linkedinUrl"
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
      `SELECT id, display_name as "displayName", avatar_id as "avatarId", tagline,
              website_url as "websiteUrl", github_url as "githubUrl", session_token_hash
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
      // Update session token hash
      await query(`UPDATE citizens SET session_token_hash = $1, updated_at = NOW() WHERE id = $2`, [tokenHash, citizen.id]);
    } else {
      const citizenId = `c_${crypto.randomBytes(12).toString('hex')}`;
      const name = displayName || username || 'Citizen';
      const insertRes = await query<any>(
        `INSERT INTO citizens (id, session_token_hash, display_name, avatar_id, github_url, github_id, email, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, display_name as "displayName", avatar_id as "avatarId", tagline,
                   website_url as "websiteUrl", github_url as "githubUrl", created_at as "createdAt"`,
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
  const parsed = ClaimSpotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'ValidationError', details: parsed.error.format() });
    return;
  }

  const { spotId, citizen: citizenInput } = parsed.data;
  let citizen = req.citizen;
  let rawToken = req.rawSessionToken;

  // If citizen was not resolved from cookie/header, check by githubId if supplied
  if (!citizen && citizenInput?.githubId) {
    const gitRes = await query<any>(
      `SELECT id, display_name as "displayName", avatar_id as "avatarId", tagline,
              website_url as "websiteUrl", github_url as "githubUrl", linkedin_url as "linkedinUrl",
              created_at as "createdAt"
       FROM citizens
       WHERE github_id = $1
       LIMIT 1`,
      [citizenInput.githubId]
    );
    if (gitRes.rows.length > 0) {
      citizen = gitRes.rows[0];
    }
  }

  // If citizen is not yet registered, create them on the fly
  if (!citizen) {
    if (!citizenInput) {
      res.status(400).json({
        error: 'MissingCitizenProfile',
        message: 'Must provide citizen profile details when claiming without an active session',
      });
      return;
    }

    const newRawToken = generateSessionToken();
    const tokenHash = hashToken(newRawToken);
    const citizenId = `c_${crypto.randomBytes(12).toString('hex')}`;

    try {
      const citizenRes = await query<any>(
        `INSERT INTO citizens (id, session_token_hash, display_name, avatar_id, tagline, website_url, github_url, linkedin_url, github_id, email, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, display_name as "displayName", avatar_id as "avatarId", tagline,
                   website_url as "websiteUrl", github_url as "githubUrl", linkedin_url as "linkedinUrl",
                   created_at as "createdAt"`,
        [
          citizenId,
          tokenHash,
          citizenInput.displayName,
          citizenInput.avatarId,
          citizenInput.tagline || null,
          citizenInput.websiteUrl || null,
          citizenInput.githubUrl || null,
          citizenInput.linkedinUrl || null,
          citizenInput.githubId || null,
          citizenInput.email || null,
          citizenInput.avatarUrl || null,
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
    });
  } catch (err: any) {
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
         c.tagline, c.website_url as "websiteUrl", c.github_url as "githubUrl",
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
      `SELECT id, display_name as "displayName", avatar_id as "avatarId", tagline,
              website_url as "websiteUrl", github_url as "githubUrl", linkedin_url as "linkedinUrl",
              created_at as "createdAt"
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

  const { displayName, avatarId, tagline, websiteUrl, githubUrl, linkedinUrl } = parsed.data;
  const citizen = req.citizen!;

  try {
    const updateRes = await query<any>(
      `UPDATE citizens
       SET display_name = COALESCE($1, display_name),
           avatar_id = COALESCE($2, avatar_id),
           tagline = COALESCE($3, tagline),
           website_url = COALESCE($4, website_url),
           github_url = COALESCE($5, github_url),
           linkedin_url = COALESCE($6, linkedin_url),
           updated_at = NOW()
       WHERE id = $7
       RETURNING id, display_name as "displayName", avatar_id as "avatarId", tagline,
                 website_url as "websiteUrl", github_url as "githubUrl", linkedin_url as "linkedinUrl",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        displayName || null,
        avatarId || null,
        tagline !== undefined ? tagline : null,
        websiteUrl !== undefined ? websiteUrl : null,
        githubUrl !== undefined ? githubUrl : null,
        linkedinUrl !== undefined ? linkedinUrl : null,
        citizen.id,
      ]
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
