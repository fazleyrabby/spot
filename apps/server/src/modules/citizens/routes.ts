import express from 'express';
import crypto from 'crypto';
import {
  optionalAuthMiddleware,
  requireAuthMiddleware,
  AuthenticatedRequest,
  generateSessionToken,
  hashToken,
  COOKIE_NAME,
  COOKIE_OPTIONS,
  clientIp,
} from '../../auth.js';
import { query } from '../../db.js';
import { config } from '../../config.js';
import { searchLimiter } from '../../rateLimiter.js';
import { UpdateCitizenSchema, formatSocialUrl } from '@spot/shared';
import { broadcastRealtimeEvent } from '../realtime/routes.js';
import { invalidateWorldCache } from '../world/routes.js';
import {
  CITIZEN_PROFILE_COLUMNS,
  buildCitizenProfileUpdate,
  enforceServerProfanity,
} from './helpers.js';

export const citizensRouter: express.Router = express.Router();

/**
 * GET /api/citizens/me
 * Hydrate current session and check owned spot
 */
citizensRouter.get('/me', optionalAuthMiddleware, async (req: AuthenticatedRequest, res) => {
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
 * GET /api/citizens/search
 * Search citizens, handles, or taglines with associated spot coordinates.
 */
citizensRouter.get('/search', searchLimiter, async (req, res) => {
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
citizensRouter.get('/:id', async (req, res) => {
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
 * POST /api/citizens/:id/click
 * Record a click / inspection on a citizen's spot modal.
 * Excludes the owner (by session, device fingerprint, or IP address).
 * Deduplicates multiple clicks from the same visitor per 24 hours.
 */
citizensRouter.post('/:id/click', optionalAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const rawFingerprint = typeof req.body?.deviceFingerprint === 'string'
    ? req.body.deviceFingerprint.trim().substring(0, 64)
    : (req.headers['x-device-fingerprint'] as string)?.trim().substring(0, 64) || null;
  const ip = clientIp(req);

  try {
    const citizenRes = await query<any>(
      `SELECT id, ip_address as "ipAddress", device_fingerprint as "deviceFingerprint", COALESCE(views_count, 0) as "viewsCount"
       FROM citizens
       WHERE id = $1
       LIMIT 1`,
      [id]
    );

    if (citizenRes.rows.length === 0) {
      res.status(404).json({ error: 'NotFound', message: 'Citizen not found' });
      return;
    }

    const citizen = citizenRes.rows[0];
    let currentViews = parseInt(citizen.viewsCount, 10) || 0;

    // 1. Owner Self-Click Exclusion
    const isOwnerBySession = Boolean(req.citizen && req.citizen.id === citizen.id);
    const isOwnerByDevice = Boolean(rawFingerprint && citizen.deviceFingerprint && rawFingerprint === citizen.deviceFingerprint);
    const isOwnerByIp = Boolean(ip && citizen.ipAddress && ip === citizen.ipAddress);

    if (isOwnerBySession || isOwnerByDevice || isOwnerByIp) {
      res.json({
        counted: false,
        reason: 'owner_excluded',
        viewsCount: currentViews,
      });
      return;
    }

    // 2. Visitor Identity Hash for Daily Deduplication
    const visitorSeed = `${ip || 'no_ip'}#${rawFingerprint || 'no_dfp'}`;
    const visitorHash = crypto.createHash('sha256').update(visitorSeed).digest('hex').substring(0, 32);

    // 3. Atomically Record Click with Daily Deduplication
    const insertRes = await query(
      `INSERT INTO citizen_clicks (citizen_id, visitor_hash, clicked_date)
       VALUES ($1, $2, CURRENT_DATE)
       ON CONFLICT (citizen_id, visitor_hash, clicked_date) DO NOTHING
       RETURNING citizen_id`,
      [citizen.id, visitorHash]
    );

    if (insertRes.rowCount && insertRes.rowCount > 0) {
      const updateRes = await query<any>(
        `UPDATE citizens SET views_count = views_count + 1 WHERE id = $1 RETURNING views_count as "viewsCount"`,
        [citizen.id]
      );
      currentViews = parseInt(updateRes.rows[0]?.viewsCount, 10) || (currentViews + 1);
      invalidateWorldCache();
      res.json({
        counted: true,
        viewsCount: currentViews,
      });
    } else {
      res.json({
        counted: false,
        reason: 'already_counted_today',
        viewsCount: currentViews,
      });
    }
  } catch (err: any) {
    console.error('Error recording citizen click:', err);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to record click' });
  }
});

/**
 * PATCH /api/citizens/me
 * Update citizen profile
 */
citizensRouter.patch('/me', requireAuthMiddleware, async (req: AuthenticatedRequest, res) => {
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
citizensRouter.delete('/me', optionalAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  let citizen = req.citizen;

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
    const spotRes = await query<any>(`SELECT id, x, y FROM spots WHERE owner_id = $1 LIMIT 1`, [citizen.id]);
    const releasedSpot = spotRes.rows[0];

    if (releasedSpot) {
      await query(`UPDATE spots SET owner_id = NULL, claimed_at = NULL WHERE owner_id = $1`, [citizen.id]);
    }

    await query(`DELETE FROM citizens WHERE id = $1`, [citizen.id]);

    res.clearCookie(COOKIE_NAME, { path: '/' });

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
