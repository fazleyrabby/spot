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
import {
  spotClaimLimiter,
  spotCommentLimiter,
  citizenCreationLimiter,
  deviceFingerprintCreationLimiter,
} from '../../rateLimiter.js';
import {
  CreateCitizenSchema,
  formatSocialUrl,
  containsBlockedWord,
  sanitizeDisplayName,
} from '@spot/shared';
import { sendSpotClaimNotification } from '../../discord.js';
import { sendWelcomeClaimEmail } from '../../mailer.js';
import { broadcastRealtimeEvent } from '../realtime/routes.js';
import { invalidateWorldCache } from '../world/routes.js';
import {
  CITIZEN_PROFILE_COLUMNS,
  buildCitizenProfileUpdate,
  enforceServerProfanity,
} from '../citizens/helpers.js';

export const spotsRouter: express.Router = express.Router();

const spotIdPattern = /^\d{1,2},\d{1,2}$/;

export function validSpotId(spotId: string): boolean {
  if (!spotIdPattern.test(spotId)) return false;
  const [x, y] = spotId.split(',').map(Number);
  return x >= 0 && x <= 99 && y >= 0 && y <= 99;
}

/**
 * POST /api/spots/claim
 * Claim an available spot coordinate.
 */
spotsRouter.post(
  '/claim',
  spotClaimLimiter,
  optionalAuthMiddleware,
  (req: AuthenticatedRequest, res, next) => {
    if (!req.citizen) {
      citizenCreationLimiter(req, res, (err?: any) => {
        if (err) return next(err);
        deviceFingerprintCreationLimiter(req, res, next);
      });
      return;
    }
    next();
  },
  async (req: AuthenticatedRequest, res) => {
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

    // Durable guest identity guard: a new browser session on the same device cannot hoard spots
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
        if (owner.spot_id) {
          res.status(409).json({
            error: 'DeviceAlreadyHasCitizen',
            message: `This device already owns spot (${owner.x}, ${owner.y}). Use Sync Phone to access it here.`,
            ownedSpotId: owner.spot_id,
          });
          return;
        }

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
        await query(
          `INSERT INTO citizen_sessions (citizen_id, token_hash) VALUES ($1, $2)
           ON CONFLICT (token_hash) DO NOTHING`,
          [createdCitizenId, tokenHash]
        );
        res.cookie(COOKIE_NAME, newRawToken, COOKIE_OPTIONS);
      } catch (err: any) {
        console.error('Error creating citizen during claim:', err);
        res.status(500).json({ error: 'InternalServerError', message: 'Failed to create citizen profile' });
        return;
      }
    } else if (input.avatarId || input.customAvatarData || input.tagline) {
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

      const recipientEmail = input.email || citizen.email;
      if (recipientEmail && typeof recipientEmail === 'string' && recipientEmail.includes('@')) {
        void sendWelcomeClaimEmail({
          to: recipientEmail.trim(),
          displayName: citizen.displayName,
          x: Number(x),
          y: Number(y),
          avatarId: citizen.avatarId,
          citizenId: citizen.id,
        });
      }

      res.status(200).json({
        success: true,
        spot: claimedSpot,
        citizen,
        sessionToken: rawToken || undefined,
      });
      invalidateWorldCache();
    } catch (err: any) {
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
  }
);

/**
 * GET /api/spots/:spotId/comments
 * Read the latest public messages on a claimed spot wall.
 */
spotsRouter.get('/:spotId/comments', optionalAuthMiddleware, async (req: AuthenticatedRequest, res) => {
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
spotsRouter.post('/:spotId/comments', spotCommentLimiter, optionalAuthMiddleware, async (req: AuthenticatedRequest, res) => {
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

/**
 * PATCH /api/spots/:spotId/wall
 * Toggle spot wall read-only / open visibility
 */
spotsRouter.patch('/:spotId/wall', requireAuthMiddleware, async (req: AuthenticatedRequest, res) => {
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
