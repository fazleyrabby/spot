import express from 'express';
import { query } from '../../db.js';
import { validSpotId } from '../spots/routes.js';

export const metaRouter: express.Router = express.Router();

function escapeXml(value: unknown): string {
  return String(value ?? '').replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char] || char));
}

/**
 * GET /api/og?x=50&y=50
 * Dynamic SVG social card generator for individual spot plots
 */
metaRouter.get('/og', async (req, res) => {
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
 * GET /api/share?x=50&y=50
 * Dynamic share landing page. Crawlers get spot metadata; browsers are redirected.
 */
metaRouter.get('/share', async (req, res) => {
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
metaRouter.get('/stats', async (_req, res) => {
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
