import express from 'express';
import { query } from '../../db.js';
import { validSpotId } from '../spots/routes.js';
import { generateOgSvg, rasterizeSvgToPng, getCachedOgImage, setCachedOgImage, type OgCardOptions } from './og.js';

export const metaRouter: express.Router = express.Router();

function escapeXml(value: unknown): string {
  return String(value ?? '').replace(
    /[<>&'"]/g,
    (char) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&apos;',
        '"': '&quot;',
      }[char] || char)
  );
}

/**
 * Helper to resolve spot & citizen details by coords or citizen identifier
 */
async function resolveSpotOrCitizen(rawParam: string): Promise<{
  spot?: any;
  citizen?: any;
  x?: number;
  y?: number;
  spotId?: string;
  isAvailable?: boolean;
} | null> {
  const clean = rawParam.trim();
  if (!clean) return null;

  // 1. Check if identifier is coordinates format: x,y
  if (/^\d+,\d+$/.test(clean)) {
    const [x, y] = clean.split(',').map(Number);
    if (Number.isInteger(x) && Number.isInteger(y) && validSpotId(clean)) {
      try {
        const r = await query<any>(
          `SELECT s.id, s.x, s.y, c.id as "citizenId", c.display_name as "displayName",
                  c.tagline, c.avatar_id as "avatarId", c.custom_avatar_data as "customAvatarData",
                  c.github_url as "githubUrl", c.twitter_url as "twitterUrl"
           FROM spots s
           LEFT JOIN citizens c ON c.id = s.owner_id
           WHERE s.id = $1 LIMIT 1`,
          [clean]
        );
        const row = r.rows[0];
        if (row) {
          return {
            spot: row,
            citizen: row.citizenId ? row : null,
            x,
            y,
            spotId: clean,
            isAvailable: !row.citizenId,
          };
        }
      } catch (err) {
        console.warn('[OG/Badge] DB query failed for coords, using fallback:', clean);
      }
      return { x, y, spotId: clean, isAvailable: true };
    }
  }

  // 2. Query by citizen display_name, id, or github_id
  try {
    const r = await query<any>(
      `SELECT s.id, s.x, s.y, c.id as "citizenId", c.display_name as "displayName",
              c.tagline, c.avatar_id as "avatarId", c.custom_avatar_data as "customAvatarData",
              c.github_url as "githubUrl", c.twitter_url as "twitterUrl"
       FROM citizens c
       LEFT JOIN spots s ON s.owner_id = c.id
       WHERE LOWER(c.display_name) = LOWER($1) OR c.id = $1 OR c.github_id = $1
       ORDER BY s.claimed_at DESC NULLS LAST
       LIMIT 1`,
      [clean]
    );
    const row = r.rows[0];
    if (row) {
      return {
        spot: row.x !== null ? row : null,
        citizen: row,
        x: row.x ?? undefined,
        y: row.y ?? undefined,
        spotId: row.id || undefined,
        isAvailable: false,
      };
    }
  } catch (err) {
    console.warn('[OG/Badge] DB query failed for citizen, using fallback:', clean);
  }

  return null;
}

/**
 * GET /api/og/:identifier?
 * GET /api/og?x=50&y=50 or ?spot=50,50 or ?citizen=name
 * Generates dynamic 1200x630 PNG (or SVG if format=svg) preview cards.
 */
const handleOgRequest = async (req: express.Request, res: express.Response): Promise<void> => {
  let rawParam =
    req.params.identifier ||
    (req.query.spot as string) ||
    (req.query.citizen as string) ||
    (req.query.x && req.query.y ? `${req.query.x},${req.query.y}` : '') ||
    '';

  let raw = (Array.isArray(rawParam) ? String(rawParam[0] || '') : String(rawParam)).trim();

  // Determine requested format
  const isExplicitSvg = raw.toLowerCase().endsWith('.svg') || (req.query.format as string)?.toLowerCase() === 'svg';
  raw = raw.replace(/\.(png|svg|jpg|jpeg)$/i, '').trim();

  const cacheKey = `og:${raw || 'default'}:${isExplicitSvg ? 'svg' : 'png'}`;

  // Check cache for PNG
  if (!isExplicitSvg) {
    const cachedBuffer = getCachedOgImage(cacheKey);
    if (cachedBuffer) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=1800');
      res.setHeader('X-Cache', 'HIT');
      res.send(cachedBuffer);
      return;
    }
  }

  try {
    let cardOpts: OgCardOptions = {
      displayName: 'SPOT METROPOLIS',
      tagline: '10,000-Plot Cyber Canvas City on the Internet. Claim your permanent land.',
      avatarId: 'astronaut',
      x: 50,
      y: 50,
    };

    if (raw) {
      const resolved = await resolveSpotOrCitizen(raw);
      if (resolved) {
        if (resolved.citizen) {
          cardOpts = {
            displayName: resolved.citizen.displayName,
            tagline: resolved.citizen.tagline,
            x: resolved.x,
            y: resolved.y,
            avatarId: resolved.citizen.avatarId,
            customAvatarData: resolved.citizen.customAvatarData,
            githubUrl: resolved.citizen.githubUrl,
            isAvailable: false,
          };
        } else if (resolved.isAvailable) {
          cardOpts = {
            displayName: `Available Plot (${resolved.x}, ${resolved.y})`,
            tagline: 'This cyber territory is currently unclaimed. Choose your avatar and claim it forever.',
            x: resolved.x,
            y: resolved.y,
            isAvailable: true,
          };
        }
      }
    }

    const svg = generateOgSvg(cardOpts);

    if (isExplicitSvg) {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600');
      res.send(svg);
      return;
    }

    const pngBuffer = rasterizeSvgToPng(svg);
    setCachedOgImage(cacheKey, pngBuffer);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=1800');
    res.setHeader('X-Cache', 'MISS');
    res.send(pngBuffer);
  } catch (err) {
    console.error('OG image generation error:', err);
    res.status(500).type('text').send('Failed to generate OpenGraph image');
  }
};

/**
 * GET /api/share
 * GET /spot/:identifier
 * Dynamic share & deep-link landing page.
 * Returns rich OG meta tags (pointing to PNG) for crawlers, and auto-redirects browsers to /world.
 */
export const handleShareLanding = async (req: express.Request, res: express.Response): Promise<void> => {
  let rawParam =
    req.params.identifier ||
    (req.query.spot as string) ||
    (req.query.citizen as string) ||
    (req.query.x && req.query.y ? `${req.query.x},${req.query.y}` : '') ||
    '';

  let raw = (Array.isArray(rawParam) ? String(rawParam[0] || '') : String(rawParam)).trim();
  raw = raw.replace(/^@/, '').replace(/\.(png|html|svg)$/i, '').trim();

  try {
    const resolved = raw ? await resolveSpotOrCitizen(raw) : null;
    const hasPlot = typeof resolved?.x === 'number' && typeof resolved?.y === 'number';
    const spotCoords = hasPlot ? `${resolved!.x},${resolved!.y}` : '50,50';
    const displayName = resolved?.citizen?.displayName || (resolved?.isAvailable ? `Plot (${spotCoords})` : 'Spot Citizen');
    const tagline =
      resolved?.citizen?.tagline ||
      (resolved?.isAvailable
        ? `Plot (${spotCoords}) is unclaimed! Claim your permanent place in the 10,000-plot cyber world.`
        : `Explore the permanent 10,000-plot cyber world.`);

    const title = `${displayName} · SPOT Cyber City`;
    const description = `${tagline} · Plot (${spotCoords}) in the permanent 10,000-tile living canvas.`;
    const pageUrl = `https://claimyourspot.lol/?spot=${encodeURIComponent(spotCoords)}`;
    const imageUrl = `https://claimyourspot.lol/api/og/${encodeURIComponent(spotCoords)}.png`;

    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeXml(title)}</title>
  <meta name="description" content="${escapeXml(description)}" />

  <!-- Open Graph / Facebook / LinkedIn / Discord -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:site_name" content="SPOT" />
  <meta property="og:title" content="${escapeXml(title)}" />
  <meta property="og:description" content="${escapeXml(description)}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:secure_url" content="${imageUrl}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${escapeXml(title)}" />
  <meta property="og:locale" content="en_US" />

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta property="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@claimyourspot" />
  <meta name="twitter:creator" content="@claimyourspot" />
  <meta name="twitter:url" content="${pageUrl}" />
  <meta name="twitter:title" content="${escapeXml(title)}" />
  <meta name="twitter:description" content="${escapeXml(description)}" />
  <meta name="twitter:image" content="${imageUrl}" />
  <meta property="twitter:image" content="${imageUrl}" />

  <link rel="canonical" href="${pageUrl}" />
  <meta http-equiv="refresh" content="0;url=${pageUrl}" />
</head>
<body style="background:#090b10;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <p style="font-size:1.1rem;letter-spacing:0.05em;">Connecting to Spot City (${escapeXml(spotCoords)})…</p>
  <script>location.replace(${JSON.stringify(pageUrl)});</script>
</body>
</html>`);
  } catch (err) {
    console.error('Share page error:', err);
    res.status(500).type('text').send('Failed to generate share page');
  }
};

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
 * Supports style=badge (compact 295x28) and style=card (mini-deed 450x120).
 */
const handleBadgeRequest = async (req: express.Request, res: express.Response): Promise<void> => {
  const rawParam = req.params.identifier || (req.query.citizen as string) || (req.query.spot as string) || '';
  let raw = (Array.isArray(rawParam) ? String(rawParam[0] || '') : String(rawParam)).trim();
  raw = raw.replace(/\.svg$/i, '').trim();

  const style = (req.query.style as string)?.toLowerCase() === 'card' ? 'card' : 'badge';

  const glyphs: Record<string, string> = {
    astronaut: '✦',
    hacker: '⌁',
    pixel_wizard: '✧',
    bot_9000: '◈',
    retro_cat: '◆',
    ghosty: '◌',
    pixel_knight: '⬟',
    neon_ninja: '✺',
    pixel_alien: '◎',
    golden_knight: '⬢',
    cyber_samurai: '⚔',
    pixel_dino: '◉',
    indie_hacker: '💻',
    cyber_sysadmin: '🛡',
    ai_architect: '🔮',
    cadet_blue: '💠',
    hazard_orange: '⚡',
    arctic_medic: '✚',
    stealth_navy: '⚓',
  };

  res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600');
  res.type('image/svg+xml');

  if (!raw) {
    res.send(generateGenericBadge(style));
    return;
  }

  try {
    const resolved = await resolveSpotOrCitizen(raw);

    if (!resolved || (!resolved.citizen && !resolved.isAvailable)) {
      res.send(generateNotFoundBadge(raw, style));
      return;
    }

    if (resolved.isAvailable) {
      res.send(generateNotFoundBadge(raw, style));
      return;
    }

    const spotData = resolved.citizen;
    const displayName = escapeXml(spotData.displayName);
    const tagline = escapeXml(spotData.tagline || 'A permanent place on the Internet.');
    const glyph = escapeXml(glyphs[spotData.avatarId] || '✦');
    const x = resolved.x !== undefined ? resolved.x : '?';
    const y = resolved.y !== undefined ? resolved.y : '?';
    const hasPlot = resolved.x !== undefined && resolved.y !== undefined;
    const district = hasPlot ? Math.floor(resolved.y! / 10) * 10 + Math.floor(resolved.x! / 10) + 1 : '—';
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

// Mount OpenGraph image generator routes
metaRouter.get('/og/:identifier', handleOgRequest);
metaRouter.get('/og', handleOgRequest);

// Mount Badge generator routes
metaRouter.get('/badge/:identifier', handleBadgeRequest);
metaRouter.get('/badge', handleBadgeRequest);

// Mount share route
metaRouter.get('/share', handleShareLanding);

/**
 * GET /api/meta/sitemap-spots.xml
 * Dynamic XML sitemap listing all claimed spots and permalinks for search engines.
 */
export const handleSitemapSpots = async (_req: express.Request, res: express.Response): Promise<void> => {
  try {
    const spotsRes = await query<any>(`
      SELECT s.x, s.y, s.claimed_at as "claimedAt", c.updated_at as "updatedAt"
      FROM spots s
      INNER JOIN citizens c ON s.owner_id = c.id
      ORDER BY s.claimed_at DESC
    `);

    const domain = 'https://claimyourspot.lol';
    const now = new Date().toISOString().split('T')[0];
    const urlsXml = spotsRes.rows
      .map((row) => {
        const lastmod = row.updatedAt || row.claimedAt ? new Date(row.updatedAt || row.claimedAt).toISOString().split('T')[0] : now;
        return `  <url>
    <loc>${domain}/?spot=${row.x},${row.y}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
      })
      .join('\n');

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${domain}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${domain}/world</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${domain}/voxel</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
${urlsXml}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.send(sitemap);
  } catch (err) {
    console.error('Sitemap generation error:', err);
    res.status(500).type('text/plain').send('Failed to generate sitemap');
  }
};

metaRouter.get('/sitemap-spots.xml', handleSitemapSpots);
metaRouter.get('/sitemap.xml', handleSitemapSpots);
metaRouter.get('/sitemap-index.xml', handleSitemapSpots);
