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
      }).catch((err) => console.error('[Discord Visitor Alert Error]', err));
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
