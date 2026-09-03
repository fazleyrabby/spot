import express from 'express';
import { query } from '../../db.js';
import { config } from '../../config.js';
import { sendBillboardPurchaseNotification } from '../../discord.js';
import { ogFetchLimiter } from '../../rateLimiter.js';

export const billboardsRouter: express.Router = express.Router();

/**
 * POST /api/billboards/webhook
 * Gumroad Webhook Integration for Billboard Sponsorships
 */
billboardsRouter.post('/webhook', async (req, res) => {
  try {
    const payload = req.body || {};
    console.log('[Gumroad Webhook Received]', JSON.stringify(payload, null, 2));

    const saleId = payload.sale_id || payload.order_number?.toString() || `sale_${Date.now()}`;
    const buyerEmail = payload.email || 'unknown@gumroad.com';
    let buyerName = payload.full_name || payload.purchaser_name || payload.name || null;
    const priceCents = parseInt(payload.price, 10) || 0;
    const currency = (payload.currency || 'usd').toLowerCase();

    // Extract tier / variant
    let tier = 'Standard';
    if (typeof payload.variants === 'string') {
      tier = payload.variants;
    } else if (Array.isArray(payload.variants)) {
      tier = payload.variants.join(', ');
    } else if (typeof payload.variants === 'object' && payload.variants !== null) {
      tier = Object.values(payload.variants).join(', ') || 'Standard';
    } else if (payload.variant) {
      tier = String(payload.variant);
    }

    // Helper to extract fields across payload, url_params, and custom_fields even if URL-encoded
    const extractField = (...targets: string[]): string | null => {
      const sources = [payload, payload.url_params, payload.custom_fields];
      for (const src of sources) {
        if (!src || typeof src !== 'object') continue;
        for (const [k, v] of Object.entries(src)) {
          if (v === undefined || v === null) continue;
          const strVal = typeof v === 'string' ? v.trim() : String(v);
          if (!strVal) continue;

          let decodedKey = k.toLowerCase();
          try {
            decodedKey = decodeURIComponent(k).toLowerCase();
          } catch (_) {}

          for (const target of targets) {
            const tLower = target.toLowerCase();
            if (
              decodedKey === tLower ||
              decodedKey === `[${tLower}]` ||
              decodedKey.includes(`[${tLower}]`) ||
              decodedKey.endsWith(`[${tLower}]`) ||
              decodedKey === tLower.replace(/\s+/g, '_')
            ) {
              return strVal;
            }
          }
        }
      }
      return null;
    };

    // Verify Gumroad Seller ID in production to prevent forged webhook POSTs
    const expectedSellerId = process.env.GUMROAD_SELLER_ID || 'n2H6rlKkX2TThqZrmrCAuA==';
    if (config.appEnv === 'production' && (!payload.seller_id || payload.seller_id !== expectedSellerId)) {
      console.warn(`[Webhook Auth Failure] Invalid or missing seller_id received: ${payload.seller_id}`);
      res.status(403).json({ error: 'Unauthorized: Invalid or missing seller_id' });
      return;
    }

    const billboardId =
      extractField('billboard_id', 'Selected Billboard / Landmark', 'Billboard ID') ||
      payload.billboard_id ||
      'unassigned';

    // Prevent purchasing or overwriting the permanent Founder monument
    if (billboardId === 'banner_founder_showcase') {
      console.warn(`[Billboard Exploit Attempt] Attempted to purchase protected founder showcase: ${saleId}`);
      res.status(400).json({ error: 'Founder monument is protected and cannot be purchased' });
      return;
    }

    const billboardName =
      extractField('billboard_name', 'Billboard Name') ||
      payload.billboard_name ||
      '';

    const rawHeadline = extractField('headline', 'Billboard Headline') || payload.headline || 'SPONSORED';
    const headline = rawHeadline.trim().toUpperCase();

    const subtext = extractField('subtext', 'Subtext / Tagline') || payload.subtext || '';

    const targetUrl = extractField('destination url', 'target_url', 'target url', 'url', 'link') || payload.target_url || null;

    // Strict URL sanitization: block javascript: and data: pseudo-protocols
    let sanitizedTargetUrl: string | null = null;
    if (targetUrl && typeof targetUrl === 'string') {
      const trimmed = targetUrl.trim();
      const lower = trimmed.toLowerCase();
      if (!lower.startsWith('javascript:') && !lower.startsWith('data:') && !lower.startsWith('vbscript:')) {
        sanitizedTargetUrl = (lower.startsWith('http://') || lower.startsWith('https://')) ? trimmed : `https://${trimmed}`;
      }
    }

    const bannerImageUrl = extractField('banner image url', 'image_url', 'logo link') || null;
    let sanitizedBannerImageUrl: string | null = null;
    if (bannerImageUrl && typeof bannerImageUrl === 'string') {
      const trimmed = bannerImageUrl.trim();
      const lower = trimmed.toLowerCase();
      if (!lower.startsWith('javascript:') && !lower.startsWith('data:') && !lower.startsWith('vbscript:')) {
        sanitizedBannerImageUrl = (lower.startsWith('http://') || lower.startsWith('https://')) ? trimmed : `https://${trimmed}`;
      }
    }

    const brandColor = extractField('logo / brand color hex', 'brand_color', 'brand color') || payload.brand_color || null;

    const brandName = extractField('brand / sponsor name', 'brand_name', 'sponsor_name');
    if (brandName) {
      buyerName = brandName;
    }

    // Calculate minimum required price for the chosen billboard
    const getRequiredPriceCents = (id: string): number => {
      if (id.startsWith('banner_plaza_') || id === 'banner_boardwalk_pier') {
        return 3500; // $35 Grand Central Plaza & Pier
      }
      if (id.startsWith('banner_cyber_')) {
        return 2000; // $20 Downtown Cyber District
      }
      return 1000; // $10 Scenic & Rail Landmarks
    };

    const isTestPromo =
      config.appEnv === 'local' &&
      (payload.test === 'true' ||
       payload.offer_code?.toLowerCase() === 'testdev' ||
       payload.discount_code?.toLowerCase() === 'testdev' ||
       (payload.url_params?.discount_code?.toLowerCase() === 'testdev'));

    const requiredPriceCents = getRequiredPriceCents(billboardId);

    // On successful payment, make ad immediately LIVE for 30 days
    let status = 'live';
    if (payload.refunded === true || payload.refunded === 'true') {
      status = 'refunded';
    } else if (payload.disputed === true || payload.disputed === 'true') {
      status = 'disputed';
    } else if (!isTestPromo && priceCents < requiredPriceCents) {
      console.warn(`[Billboard Fraud Alert] Sale ${saleId}: Paid ${priceCents}¢ for ${billboardId} (requires ${requiredPriceCents}¢). Flagged as underpaid.`);
      status = 'underpaid';
    }

    // Extract citizenId if passed from logged-in citizen
    const citizenId = extractField('citizen id', 'citizen_id') || null;

    // Check if billboard has an existing active sponsorship so extensions ADD +30 days cumulatively
    const activeCheck = await query<any>(
      `SELECT expires_at, buyer_email, citizen_id FROM billboard_orders 
       WHERE billboard_id = $1 AND status = 'live' AND expires_at > NOW() 
       ORDER BY expires_at DESC LIMIT 1`,
      [billboardId]
    );

    let startsAt = new Date();
    let expiresAt = new Date(startsAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    let isSameOwner = false;

    if (activeCheck.rows[0]?.expires_at) {
      const existingExpiry = new Date(activeCheck.rows[0].expires_at);
      isSameOwner = 
        Boolean(activeCheck.rows[0].buyer_email && buyerEmail && activeCheck.rows[0].buyer_email.toLowerCase() === buyerEmail.toLowerCase()) ||
        Boolean(citizenId && activeCheck.rows[0].citizen_id && activeCheck.rows[0].citizen_id === citizenId);

      if (isSameOwner) {
        // Same sponsor extending: stack +30 days on top of remaining time
        if (existingExpiry > startsAt) {
          expiresAt = new Date(existingExpiry.getTime() + 30 * 24 * 60 * 60 * 1000);
        }
      } else {
        // Different buyer: queue the ad so it starts after existing sponsor's campaign ends
        if (existingExpiry > startsAt) {
          startsAt = existingExpiry;
          expiresAt = new Date(existingExpiry.getTime() + 30 * 24 * 60 * 60 * 1000);
        }
      }
    }

    // Persist to Postgres database
    const upsertRes = await query(
      `INSERT INTO billboard_orders (
        gumroad_sale_id,
        billboard_id,
        billboard_name,
        tier,
        buyer_email,
        buyer_name,
        citizen_id,
        headline,
        subtext,
        target_url,
        banner_image_url,
        brand_color,
        price_cents,
        currency,
        status,
        raw_payload,
        starts_at,
        expires_at,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, NOW(), NOW()
      )
      ON CONFLICT (gumroad_sale_id) DO UPDATE SET
        citizen_id = COALESCE(EXCLUDED.citizen_id, billboard_orders.citizen_id),
        banner_image_url = COALESCE(EXCLUDED.banner_image_url, billboard_orders.banner_image_url),
        status = EXCLUDED.status,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = NOW()
      RETURNING (xmax = 0) AS is_new_insert, id, expires_at`,
      [
        saleId,
        billboardId,
        billboardName,
        tier,
        buyerEmail,
        buyerName,
        citizenId,
        headline,
        subtext,
        sanitizedTargetUrl,
        sanitizedBannerImageUrl,
        brandColor,
        priceCents,
        currency,
        status,
        JSON.stringify(payload),
        startsAt.toISOString(),
        expiresAt.toISOString(),
      ]
    );

    // If this was an extension by the same sponsor, mark older live orders as 'extended'
    if (activeCheck.rows[0]?.expires_at && upsertRes.rows[0]?.id && isSameOwner) {
      await query(
        `UPDATE billboard_orders SET status = 'extended' 
         WHERE billboard_id = $1 AND id != $2 AND status = 'live' AND buyer_email = $3`,
        [billboardId, upsertRes.rows[0].id, buyerEmail]
      ).catch(() => {});
    }

    // Fire Discord notification
    const priceFormatted = `$${(priceCents / 100).toFixed(2)} ${currency.toUpperCase()}`;
    sendBillboardPurchaseNotification({
      billboardId,
      billboardName,
      tier,
      buyerEmail,
      buyerName,
      headline,
      subtext,
      targetUrl: sanitizedTargetUrl,
      priceFormatted,
      saleId,
    }).catch((err) => console.error('[Discord Webhook Error]', err));

    res.json({
      success: true,
      message: 'Billboard sponsorship recorded and activated.',
      order: upsertRes.rows[0],
    });
  } catch (err: any) {
    console.error('Error processing Gumroad webhook:', err);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to process webhook' });
  }
});

/**
 * POST /api/billboards/assign
 * Admin manual billboard assignment (Protected: requires x-admin-key or ?key=)
 */
billboardsRouter.post('/assign', async (req, res) => {
  const suppliedKey = (req.headers['x-admin-key'] as string | undefined) || (req.query.key as string | undefined);
  if (!suppliedKey || suppliedKey !== config.adminSecret) {
    res.status(401).json({ error: 'Unauthorized. Admin authorization key required.' });
    return;
  }

  try {
    const {
      billboardId,
      headline = 'SPONSORED',
      subtext = '',
      targetUrl = null,
      brandColor = '#00f0ff',
      buyerName = 'Manual Sponsor',
      buyerEmail = 'admin@claimyourspot.lol',
      durationDays = 30,
      tier = 'Manual Placement',
      citizenId = null,
    } = req.body || {};

    if (!billboardId) {
      res.status(400).json({ error: 'Missing required billboardId' });
      return;
    }

    const saleId = `admin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const result = await query(
      `INSERT INTO billboard_orders (
        gumroad_sale_id, billboard_id, billboard_name, tier, buyer_email, buyer_name,
        citizen_id, headline, subtext, target_url, brand_color, price_cents, currency,
        status, raw_payload, starts_at, expires_at, created_at, updated_at
      ) VALUES (
        $1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, 'usd', 'live',
        '{"source":"manual_admin_assignment"}'::jsonb,
        NOW(), NOW() + ($11 || ' days')::interval, NOW(), NOW()
      )
      RETURNING id, gumroad_sale_id, billboard_id, headline, status, expires_at`,
      [
        saleId,
        billboardId,
        tier,
        buyerEmail,
        buyerName || 'Manual Sponsor',
        citizenId || null,
        headline.toUpperCase(),
        subtext || '',
        targetUrl || null,
        brandColor || '#00f0ff',
        durationDays.toString(),
      ]
    );

    sendBillboardPurchaseNotification({
      billboardId,
      billboardName: billboardId,
      tier,
      buyerEmail,
      buyerName: buyerName || 'Manual Assignment',
      headline,
      subtext,
      targetUrl,
      priceFormatted: '$0.00 (Manual)',
      saleId,
    }).catch(() => {});

    res.json({
      success: true,
      message: `Billboard ${billboardId} manually assigned and is now LIVE for ${durationDays} days!`,
      order: result.rows[0],
    });
  } catch (err: any) {
    console.error('[Manual Assign Error]', err);
    res.status(500).json({ error: 'InternalServerError' });
  }
});

/**
 * GET /api/billboards/orders
 * Admin list of persisted billboard orders (Protected: requires x-admin-key or ?key=)
 */
billboardsRouter.get('/orders', async (req, res) => {
  const suppliedKey = (req.headers['x-admin-key'] as string | undefined) || (req.query.key as string | undefined);
  if (!suppliedKey || suppliedKey !== config.adminSecret) {
    res.status(401).json({ error: 'Unauthorized. Admin authorization key required.' });
    return;
  }

  try {
    const orders = await query<any>(
      `SELECT id, gumroad_sale_id, billboard_id, billboard_name, tier, buyer_email, buyer_name, citizen_id,
              headline, subtext, target_url, brand_color, price_cents, currency, status,
              starts_at, expires_at, created_at
       FROM billboard_orders
       ORDER BY created_at DESC
       LIMIT 100`
    );
    res.json({ orders: orders.rows });
  } catch (err: any) {
    console.error('[Fetch Billboard Orders Error]', err);
    res.status(500).json({ error: 'InternalServerError' });
  }
});

/**
 * GET /api/billboards/active
 * Returns all currently live billboard campaigns
 */
billboardsRouter.get('/active', async (_req, res) => {
  try {
    const active = await query<any>(
      `SELECT 
        bo.billboard_id,
        bo.billboard_name,
        bo.headline,
        bo.subtext,
        bo.target_url,
        bo.banner_image_url,
        bo.brand_color,
        bo.buyer_name,
        bo.citizen_id,
        bo.status,
        bo.expires_at,
        c.id AS citizen_db_id,
        c.display_name AS citizen_display_name,
        c.avatar_id AS citizen_avatar_id,
        c.avatar_url AS citizen_avatar_url,
        (c.github_id IS NOT NULL) AS citizen_is_verified,
        c.github_url AS citizen_github_url,
        s.x AS spot_x,
        s.y AS spot_y
       FROM billboard_orders bo
       LEFT JOIN citizens c ON bo.citizen_id = c.id
       LEFT JOIN spots s ON s.owner_id = c.id
       WHERE bo.status = 'live' 
         AND bo.starts_at <= NOW()
         AND bo.expires_at > NOW()
       ORDER BY bo.created_at DESC`
    );

    res.setHeader('Cache-Control', 'public, max-age=30');

    const activeBanners = active.rows.map((row) => ({
      id: row.billboard_id,
      billboard_id: row.billboard_id,
      billboard_name: row.billboard_name,
      headline: row.headline,
      subtext: row.subtext,
      target_url: row.target_url,
      banner_image_url: row.banner_image_url,
      brand_color: row.brand_color,
      buyer_name: row.buyer_name,
      status: row.status,
      expires_at: row.expires_at,
      citizen: row.citizen_db_id
        ? {
            id: row.citizen_db_id,
            displayName: row.citizen_display_name,
            avatarId: row.citizen_avatar_id,
            avatarUrl: row.citizen_avatar_url,
            isVerified: row.citizen_is_verified,
            githubUrl: row.citizen_github_url,
            spot: row.spot_x !== null && row.spot_y !== null ? { x: row.spot_x, y: row.spot_y } : null,
          }
        : null,
    }));

    res.json({ activeBanners });
  } catch (err: any) {
    console.error('[Fetch Active Billboards Error]', err);
    res.status(500).json({ error: 'InternalServerError' });
  }
});

/**
 * GET /api/billboards/fetch-og?url=...
 * Extracts OpenGraph image, title, and description with strict SSRF defense
 */
billboardsRouter.get('/fetch-og', ogFetchLimiter, async (req, res) => {
  const targetUrl = req.query.url as string | undefined;
  if (!targetUrl || typeof targetUrl !== 'string') {
    res.status(400).json({ error: 'Missing url parameter' });
    return;
  }

  try {
    let parsed: URL;
    try {
      parsed = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
    } catch {
      res.status(400).json({ error: 'Invalid URL' });
      return;
    }

    // SSRF Protection: strictly block localhost, private LAN, and metadata addresses
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('172.20.') ||
      hostname.startsWith('172.21.') ||
      hostname.startsWith('172.22.') ||
      hostname.startsWith('172.23.') ||
      hostname.startsWith('172.24.') ||
      hostname.startsWith('172.25.') ||
      hostname.startsWith('172.26.') ||
      hostname.startsWith('172.27.') ||
      hostname.startsWith('172.28.') ||
      hostname.startsWith('172.29.') ||
      hostname.startsWith('172.30.') ||
      hostname.startsWith('172.31.') ||
      hostname.startsWith('169.254.') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      res.status(400).json({ error: 'Private or internal network addresses are forbidden' });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 SpotBot/1.0',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      res.json({ ogImage: null, title: null, description: null });
      return;
    }

    const reader = response.body?.getReader();
    let html = '';
    if (reader) {
      const decoder = new TextDecoder('utf-8');
      let bytesRead = 0;
      const MAX_BYTES = 200 * 1024; // 200KB limit
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytesRead += value.length;
        html += decoder.decode(value, { stream: true });
        if (bytesRead >= MAX_BYTES) {
          reader.cancel().catch(() => {});
          break;
        }
      }
    } else {
      html = await response.text();
    }

    const getMeta = (prop: string): string | null => {
      const match =
        html.match(new RegExp(`<meta[^>]+(?:property|name)=["'](?:og:)?${prop}["'][^>]+content=["']([^"']+)["']`, 'i')) ||
        html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:)?${prop}["']`, 'i'));
      return match ? match[1] : null;
    };

    let ogImage = getMeta('image');
    if (ogImage && !ogImage.startsWith('http')) {
      try {
        ogImage = new URL(ogImage, parsed.origin).toString();
      } catch {
        ogImage = null;
      }
    }

    const title = getMeta('title') || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || null;
    const description = getMeta('description');

    res.json({
      ogImage,
      title: title ? title.trim().slice(0, 80) : null,
      description: description ? description.trim().slice(0, 140) : null,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      res.json({ ogImage: null, title: null, description: null, error: 'Timeout' });
      return;
    }
    res.json({ ogImage: null, title: null, description: null });
  }
});
