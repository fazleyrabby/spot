import express from 'express';
import { query } from '../../db.js';
import { getUniqueOnlineCount } from '../realtime/routes.js';

export const worldRouter: express.Router = express.Router();

const WORLD_CACHE_TTL_MS = 5000; // 5 second cache
let worldCache: { data: any; expiresAt: number } | null = null;

export function invalidateWorldCache(): void {
  worldCache = null;
}

/**
 * GET /api/world
 * Full snapshot of the world grid & occupied spots for Canvas rendering
 */
worldRouter.get('/', async (_req, res) => {
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
