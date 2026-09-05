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

/**
 * GET /api/badge/:identifier
 * GET /api/badge?citizen=name or ?spot=x,y
 * Dynamic SVG badge generator optimized for GitHub Profile READMEs and website embeds.
 * Supports style=badge (compact 290x28) and style=card (mini-deed 450x120).
 */
const handleBadgeRequest = async (req: express.Request, res: express.Response): Promise<void> => {
  const rawParam = req.params.identifier || (req.query.citizen as string) || (req.query.spot as string) || '';
  let raw = (Array.isArray(rawParam) ? String(rawParam[0] || '') : String(rawParam)).trim();
  raw = raw.replace(/\.svg$/i, '').trim();

  const style = (req.query.style as string)?.toLowerCase() === 'card' ? 'card' : 'badge';

  const glyphs: Record<string, string> = {
    astronaut: '✦', hacker: '⌁', pixel_wizard: '✧', bot_9000: '◈', retro_cat: '◆',
    ghosty: '◌', pixel_knight: '⬟', neon_ninja: '✺', pixel_alien: '◎', golden_knight: '⬢',
    cyber_samurai: '⚔', pixel_dino: '◉',
  };

  res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600');
  res.type('image/svg+xml');

  if (!raw) {
    res.send(generateGenericBadge(style));
    return;
  }

  try {
    let spotData: any = null;

    // 1. Check if identifier is coordinates format: x,y
    if (/^\d+,\d+$/.test(raw)) {
      const [x, y] = raw.split(',').map(Number);
      if (Number.isInteger(x) && Number.isInteger(y) && validSpotId(raw)) {
        const r = await query<any>(
          `SELECT s.x, s.y, c.id as "citizenId", c.display_name as "displayName", c.tagline,
                  c.avatar_id as "avatarId", c.github_url as "githubUrl"
           FROM spots s
           LEFT JOIN citizens c ON c.id = s.owner_id
           WHERE s.id = $1 LIMIT 1`,
          [raw]
        );
        spotData = r.rows[0];
      }
    }

    // 2. If not found by coords, query by citizen display_name, id, or github_id
    if (!spotData) {
      const r = await query<any>(
        `SELECT s.x, s.y, c.id as "citizenId", c.display_name as "displayName", c.tagline,
                c.avatar_id as "avatarId", c.github_url as "githubUrl"
         FROM citizens c
         LEFT JOIN spots s ON s.owner_id = c.id
         WHERE LOWER(c.display_name) = LOWER($1) OR c.id = $1 OR c.github_id = $1
         ORDER BY s.claimed_at DESC NULLS LAST
         LIMIT 1`,
        [raw]
      );
      spotData = r.rows[0];
    }

    if (!spotData || !spotData.displayName) {
      res.send(generateNotFoundBadge(raw, style));
      return;
    }

    const displayName = escapeXml(spotData.displayName);
    const tagline = escapeXml(spotData.tagline || 'A permanent place on the Internet.');
    const glyph = escapeXml(glyphs[spotData.avatarId] || '✦');
    const x = spotData.x !== null ? spotData.x : '?';
    const y = spotData.y !== null ? spotData.y : '?';
    const hasPlot = spotData.x !== null && spotData.y !== null;
    const district = hasPlot ? Math.floor(spotData.y / 10) * 10 + Math.floor(spotData.x / 10) + 1 : '—';
    const verified = Boolean(spotData.githubUrl);

    if (style === 'card') {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="450" height="120" viewBox="0 0 450 120" fill="none" role="img" aria-label="Spot Citizen Card">
  <defs>
    <linearGradient id="card-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b0f19" />
      <stop offset="100%" stop-color="#030712" />
    </linearGradient>
    <pattern id="card-grid" width="16" height="16" patternUnits="userSpaceOnUse">
      <path d="M16 0H0V16" fill="none" stroke="#ffffff" stroke-opacity="0.04" />
    </pattern>
    <linearGradient id="card-border" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.7" />
      <stop offset="50%" stop-color="#1e293b" stop-opacity="0.4" />
      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.7" />
    </linearGradient>
  </defs>

  <rect width="450" height="120" rx="14" fill="url(#card-bg)" />
  <rect width="450" height="120" rx="14" fill="url(#card-grid)" />
  <rect x="0.75" y="0.75" width="448.5" height="118.5" rx="13.25" stroke="url(#card-border)" stroke-width="1.5" />

  <!-- Avatar Box -->
  <rect x="16" y="16" width="88" height="88" rx="12" fill="#111827" stroke="#1e293b" stroke-width="1.5" />
  <text x="60" y="72" text-anchor="middle" font-size="44" fill="#38bdf8">${glyph}</text>

  <!-- Header & Tag -->
  <text x="118" y="34" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="10" font-weight="700" letter-spacing="1.5" fill="#38bdf8">SPOT CITY · SECTOR ${district}</text>
  <text x="118" y="58" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="18" font-weight="800" fill="#f8fafc">@${displayName} ${verified ? '<tspan fill="#38bdf8" font-size="14">✓</tspan>' : ''}</text>

  <!-- Tagline / Bio -->
  <text x="118" y="78" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="12" fill="#94a3b8">${tagline.length > 42 ? tagline.slice(0, 40) + '…' : tagline}</text>

  <!-- Bottom Pills -->
  <rect x="118" y="88" width="94" height="18" rx="4" fill="#1e293b" />
  <text x="165" y="101" text-anchor="middle" font-family="'SF Mono',Menlo,Consolas,monospace" font-size="9" font-weight="600" fill="#38bdf8">${hasPlot ? `PLOT (${x}, ${y})` : 'EXPLORER'}</text>

  <rect x="218" y="88" width="88" height="18" rx="4" fill="#1e293b" />
  <text x="262" y="101" text-anchor="middle" font-family="'SF Mono',Menlo,Consolas,monospace" font-size="9" font-weight="600" fill="#cbd5e1">${verified ? 'VERIFIED' : 'CITIZEN'}</text>

  <!-- Watermark right -->
  <text x="432" y="101" text-anchor="end" font-family="'SF Mono',Menlo,Consolas,monospace" font-size="9" fill="#475569">claimyourspot.lol</text>
</svg>`;
      res.send(svg);
      return;
    }

    // Default compact badge style
    const labelCoords = hasPlot ? `(${x}, ${y})` : 'Citizen';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="295" height="28" viewBox="0 0 295 28" fill="none" role="img" aria-label="Spot Citizen: @${displayName}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
  </defs>

  <rect width="295" height="28" rx="6" fill="url(#bg)" stroke="#1e293b" stroke-width="1.2" />
  
  <!-- Left Brand Pill -->
  <path d="M0 6 C0 2.68 2.68 0 6 0 L78 0 L78 28 L6 28 C2.68 28 0 25.32 0 22 Z" fill="#090d16" />
  <line x1="78" y1="0" x2="78" y2="28" stroke="#334155" stroke-width="1" />
  <circle cx="14" cy="14" r="3.5" fill="#38bdf8" />
  <text x="24" y="18" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="11" font-weight="800" letter-spacing="1.5" fill="#f8fafc">SPOT</text>

  <!-- Right Citizen Pill -->
  <text x="88" y="18" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="11" font-weight="600" fill="#e2e8f0">@${displayName}</text>
  <text x="238" y="18" text-anchor="middle" font-family="'SF Mono',Menlo,Consolas,monospace" font-size="10" font-weight="600" fill="#38bdf8">${labelCoords}</text>
  <circle cx="282" cy="14" r="2.5" fill="${verified ? '#38bdf8' : '#64748b'}" />
</svg>`;
    res.send(svg);
  } catch (err) {
    console.error('Badge generation error:', err);
    res.status(500).type('text').send('Failed to generate badge');
  }
};

function generateGenericBadge(style: string): string {
  if (style === 'card') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="450" height="120" viewBox="0 0 450 120" fill="none">
  <rect width="450" height="120" rx="14" fill="#0b0f19" stroke="#38bdf8" stroke-width="1.5" />
  <text x="30" y="52" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="20" font-weight="800" fill="#f8fafc">SPOT · 10,000 PLOT CYBER CITY</text>
  <text x="30" y="80" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="13" fill="#94a3b8">Claim your permanent digital land on the internet.</text>
  <text x="420" y="102" text-anchor="end" font-family="'SF Mono',Menlo,Consolas,monospace" font-size="10" fill="#38bdf8">claimyourspot.lol ↗</text>
</svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="230" height="28" viewBox="0 0 230 28" fill="none">
  <rect width="230" height="28" rx="6" fill="#090d16" stroke="#1e293b" stroke-width="1.2" />
  <circle cx="14" cy="14" r="3.5" fill="#38bdf8" />
  <text x="24" y="18" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="11" font-weight="800" letter-spacing="1.5" fill="#f8fafc">SPOT</text>
  <line x1="78" y1="0" x2="78" y2="28" stroke="#334155" stroke-width="1" />
  <text x="90" y="18" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="11" font-weight="600" fill="#38bdf8">claimyourspot.lol ↗</text>
</svg>`;
}

function generateNotFoundBadge(queryVal: string, style: string): string {
  const safe = escapeXml(queryVal.slice(0, 16));
  if (style === 'card') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="450" height="120" viewBox="0 0 450 120" fill="none">
  <rect width="450" height="120" rx="14" fill="#0b0f19" stroke="#334155" stroke-width="1.5" />
  <text x="30" y="52" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="18" font-weight="800" fill="#f8fafc">Spot Available: ${safe}</text>
  <text x="30" y="80" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="13" fill="#94a3b8">This plot has not been claimed yet. Claim it now!</text>
  <text x="420" y="102" text-anchor="end" font-family="'SF Mono',Menlo,Consolas,monospace" font-size="10" fill="#38bdf8">claimyourspot.lol ↗</text>
</svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="270" height="28" viewBox="0 0 270 28" fill="none">
  <rect width="270" height="28" rx="6" fill="#090d16" stroke="#1e293b" stroke-width="1.2" />
  <circle cx="14" cy="14" r="3.5" fill="#f59e0b" />
  <text x="24" y="18" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="11" font-weight="800" letter-spacing="1.5" fill="#f8fafc">SPOT</text>
  <line x1="78" y1="0" x2="78" y2="28" stroke="#334155" stroke-width="1" />
  <text x="88" y="18" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="11" font-weight="600" fill="#94a3b8">Unclaimed · claimyourspot.lol</text>
</svg>`;
}

metaRouter.get('/badge/:identifier', handleBadgeRequest);
metaRouter.get('/badge', handleBadgeRequest);
