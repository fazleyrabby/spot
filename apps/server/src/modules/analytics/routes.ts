import crypto from 'node:crypto';
import express from 'express';
import { query } from '../../db.js';
import { sendVisitorNotification, parseUserAgent } from '../../discord.js';

export const analyticsRouter: express.Router = express.Router();

/**
 * GET /api/analytics/visit
 * Count one unique browser visitor per 24 hours and dispatch Discord real-time alerts.
 */
analyticsRouter.get('/visit', async (req, res) => {
  try {
    const isCloudflare = Boolean(req.headers['cf-connecting-ip'] || req.headers['cf-ray']);
    const isLocalhost = !isCloudflare && (req.hostname === 'localhost' || req.ip === '127.0.0.1' || req.ip === '::1');
    const hasVisitedCookie = req.cookies?.spot_visited;
    const isTest = req.query.test === '1';
    let totalVisitors: number;

    if (!isLocalhost && (!hasVisitedCookie || isTest)) {
      const visitorRes = await query<any>(
        `UPDATE site_stats SET value = value + 1 WHERE key = 'total_visitors' RETURNING value;`
      );
      totalVisitors = parseInt(visitorRes.rows[0]?.value, 10) || 1;
      res.cookie('spot_visited', '1', {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax',
      });

      // Dispatch rich visitor alert to Discord (IP, Device, OS, Country, City, Referrer)
      const rawIp =
        (req.headers['cf-connecting-ip'] as string) ||
        (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
        req.socket.remoteAddress ||
        'unknown';
      const country = (req.headers['cf-ipcountry'] as string) || null;
      const city = (req.headers['cf-ipcity'] as string) || null;
      const region = (req.headers['cf-region'] as string) || null;
      const referrer = (req.headers['referer'] as string) || (req.headers['referrer'] as string) || null;
      const userAgent = (req.headers['user-agent'] as string) || 'Unknown';
      const landingPath = (req.query.path as string) || (req.headers['x-landing-path'] as string) || '/';

      const { os, browser, device } = parseUserAgent(userAgent);

      sendVisitorNotification({
        ip: rawIp,
        country,
        city,
        region,
        os,
        browser,
        device,
        referrer,
        path: landingPath,
        userAgent,
        totalVisitors,
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
 * POST /api/analytics/click
 * Record an interaction / click event on any world target (monument, billboard, secret, portal).
 * Deduplicates uniquely per day per visitor while maintaining overall total counts.
 */
analyticsRouter.post('/click', async (req, res) => {
  try {
    const { targetType, targetId, source = '2d' } = req.body || {};
    if (!targetType || !targetId) {
      res.status(400).json({ error: 'BadRequest', message: 'targetType and targetId are required' });
      return;
    }

    const rawIp =
      (req.headers['cf-connecting-ip'] as string) ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown';
    const country = (req.headers['cf-ipcountry'] as string) || null;
    const city = (req.headers['cf-ipcity'] as string) || null;
    const userAgent = (req.headers['user-agent'] as string) || 'Unknown';

    // Consistent visitor hash (IP + User-Agent)
    const visitorSeed = `${rawIp}#${userAgent}`;
    const visitorHash = crypto.createHash('sha256').update(visitorSeed).digest('hex').substring(0, 32);

    // 1. Daily Deduplicated Log Insert
    const insertRes = await query(
      `INSERT INTO world_click_logs (target_type, target_id, source, visitor_hash, country, city, clicked_date)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)
       ON CONFLICT (target_type, target_id, visitor_hash, clicked_date) DO NOTHING
       RETURNING id;`,
      [targetType, targetId, source, visitorHash, country, city]
    );

    const isUniqueToday = (insertRes.rowCount ?? 0) > 0;
    const uniqueIncrement = isUniqueToday ? 1 : 0;

    // 2. Real-time Aggregate Stats Update
    const statRes = await query<{ total_clicks: string; unique_visitors: string }>(
      `INSERT INTO world_interaction_stats (target_type, target_id, total_clicks, unique_visitors, last_clicked_at)
       VALUES ($1, $2, 1, $3, NOW())
       ON CONFLICT (target_type, target_id) DO UPDATE SET
         total_clicks = world_interaction_stats.total_clicks + 1,
         unique_visitors = world_interaction_stats.unique_visitors + $3,
         last_clicked_at = NOW()
       RETURNING total_clicks, unique_visitors;`,
      [targetType, targetId, uniqueIncrement]
    );

    const totalClicks = parseInt(statRes.rows[0]?.total_clicks || '1', 10);
    const uniqueVisitors = parseInt(statRes.rows[0]?.unique_visitors || '1', 10);

    res.json({
      counted: true,
      isUniqueToday,
      totalClicks,
      uniqueVisitors,
    });
  } catch (err: any) {
    console.error('Error logging click event:', err);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to record click' });
  }
});

/**
 * GET /api/analytics/click/:targetType/:targetId
 * Fetch interaction statistics for any target (total clicks, unique visitors, today clicks).
 */
analyticsRouter.get('/click/:targetType/:targetId', async (req, res) => {
  try {
    const { targetType, targetId } = req.params;

    const [statsRes, todayRes] = await Promise.all([
      query<{ total_clicks: string; unique_visitors: string; last_clicked_at: string }>(
        `SELECT total_clicks, unique_visitors, last_clicked_at
         FROM world_interaction_stats
         WHERE target_type = $1 AND target_id = $2 LIMIT 1;`,
        [targetType, targetId]
      ),
      query<{ today_count: string }>(
        `SELECT COUNT(*) as today_count
         FROM world_click_logs
         WHERE target_type = $1 AND target_id = $2 AND clicked_date = CURRENT_DATE;`,
        [targetType, targetId]
      ),
    ]);

    const totalClicks = parseInt(statsRes.rows[0]?.total_clicks || '0', 10);
    const uniqueVisitors = parseInt(statsRes.rows[0]?.unique_visitors || '0', 10);
    const todayClicks = parseInt(todayRes.rows[0]?.today_count || '0', 10);
    const lastClickedAt = statsRes.rows[0]?.last_clicked_at || null;

    res.json({
      targetType,
      targetId,
      totalClicks,
      uniqueVisitors,
      todayClicks,
      lastClickedAt,
    });
  } catch (err: any) {
    console.error('Error fetching interaction stats:', err);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to fetch stats' });
  }
});

