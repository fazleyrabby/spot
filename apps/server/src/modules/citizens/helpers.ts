import { Request } from 'express';
import { query } from '../../db.js';
import { clientIp } from '../../auth.js';
import { containsBlockedWord, sanitizeDisplayName } from '@spot/shared';

export const CITIZEN_PROFILE_COLUMNS = `
  id, display_name as "displayName", avatar_id as "avatarId",
  custom_avatar_data as "customAvatarData", tagline, bio,
  website_url as "websiteUrl", github_url as "githubUrl",
  twitter_url as "twitterUrl", facebook_url as "facebookUrl",
  instagram_url as "instagramUrl", youtube_url as "youtubeUrl",
  linkedin_url as "linkedinUrl",
  (github_url IS NOT NULL AND github_url <> '') as "isVerified",
  created_at as "createdAt", updated_at as "updatedAt"
`;

// Build a dynamic column list for updating a citizen's optional profile fields.
export function buildCitizenProfileUpdate(fields: Record<string, unknown>): {
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

const MAX_PROFANITY_WARNINGS = 3;

export async function enforceServerProfanity(
  displayName: string,
  tagline: string | undefined | null,
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
