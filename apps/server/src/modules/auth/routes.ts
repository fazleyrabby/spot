import express from 'express';
import crypto from 'crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import {
  requireAuthMiddleware,
  AuthenticatedRequest,
  generateSessionToken,
  hashToken,
  COOKIE_NAME,
  COOKIE_OPTIONS,
  resolveCitizenById,
  saveWebAuthnChallenge,
  consumeWebAuthnChallenge,
} from '../../auth.js';
import { authSyncLimiter } from '../../rateLimiter.js';
import { config } from '../../config.js';
import { query } from '../../db.js';
import { CITIZEN_PROFILE_COLUMNS } from '../citizens/helpers.js';

export const authRouter: express.Router = express.Router();

/** Passkey registration for an already identified citizen (guest or GitHub). */
authRouter.post('/passkey/register/options', requireAuthMiddleware, async (req: AuthenticatedRequest, res) => {
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

authRouter.post('/passkey/register/verify', requireAuthMiddleware, async (req: AuthenticatedRequest, res) => {
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

authRouter.post('/passkey/authenticate/options', authSyncLimiter, async (_req, res) => {
  try {
    const options = await generateAuthenticationOptions({
      rpID: config.rpId,
      userVerification: 'preferred',
    });
    await saveWebAuthnChallenge(null, options.challenge, 'authenticate');
    res.json(options);
  } catch (err) {
    console.error('Passkey authentication options error:', err);
    res.status(500).json({ error: 'PasskeyUnavailable', message: 'Passkeys are temporarily unavailable.' });
  }
});

authRouter.post('/passkey/authenticate/verify', authSyncLimiter, async (req, res) => {
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

/**
 * POST /api/auth/github/sync
 * Authenticate or link a citizen from Supabase GitHub OAuth
 */
authRouter.post('/github/sync', authSyncLimiter, async (req, res) => {
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

    // Fallback: match by github username/handle
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
        await query(`UPDATE citizens SET github_id = $1, updated_at = NOW() WHERE id = $2`, [String(githubId), matches.rows[0].id]);
      }
    }

    let citizen: any;
    let rawToken = generateSessionToken();
    const tokenHash = hashToken(rawToken);

    if (existing.rows.length > 0) {
      citizen = existing.rows[0];
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
