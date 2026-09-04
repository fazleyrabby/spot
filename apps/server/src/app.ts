import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { config } from './config.js';
import { apiRouter } from './routes.js';
import { globalApiLimiter } from './rateLimiter.js';
import { query } from './db.js';

export const app: express.Express = express();

// Trust proxy for accurate IP rate limiting behind multi-hop Cloudflare/Traefik reverse proxy
app.set('trust proxy', true);

// Canonical Domain Redirect: enforce apex domain https://claimyourspot.lol in production
app.use((req, res, next) => {
  const host = (req.headers.host || '').toLowerCase();
  if (config.isProd && host.startsWith('www.claimyourspot.lol')) {
    return res.redirect(301, `https://claimyourspot.lol${req.originalUrl}`);
  }
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(
  cors({
    origin: (origin, callback) => {
      // Only allow the app's own origin (support both www and apex domain)
      const isLocalOrigin = config.appEnv === 'local' && origin?.startsWith('http://localhost');
      const isConfiguredOrigin =
        origin === config.corsOrigin ||
        origin === config.corsOrigin.replace('https://', 'https://www.') ||
        origin === config.corsOrigin.replace('https://www.', 'https://');
      const isOwnDomain = Boolean(origin?.endsWith('claimyourspot.lol'));
      if (!origin || isLocalOrigin || isConfiguredOrigin || isOwnDomain) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);

app.use(cookieParser(config.cookieSecret));

// Deep healthcheck endpoint reporting DB connectivity, spot count, and memory stats
app.get('/health', async (_req, res) => {
  const startTime = Date.now();
  try {
    const dbRes = await query<{ count: number }>('SELECT count(*)::int AS count FROM spots');
    const dbLatencyMs = Date.now() - startTime;
    const spotCount = dbRes.rows[0]?.count ?? 0;
    const mem = process.memoryUsage();

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      database: {
        status: 'connected',
        spots: spotCount,
        latencyMs: dbLatencyMs,
      },
      memory: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      },
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      database: {
        status: 'disconnected',
        error: err instanceof Error ? err.message : 'Database check failed',
      },
    });
  }
});

// Mount API router with global sliding-window rate limiter
app.use('/api', globalApiLimiter, apiRouter);

// Serve static frontend in production if dist exists
const webDistPath = process.env.WEB_DIST_PATH || path.resolve(process.cwd(), '../web/dist');
if (fs.existsSync(webDistPath)) {
  app.use(
    express.static(webDistPath, {
      maxAge: '1d',
      index: false,
      setHeaders: (res, filePath) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (filePath.includes('/_astro/') || filePath.includes('/sprites/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      },
    })
  );

  const sendFreshHtml = (res: express.Response, filePath: string) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(filePath);
  };

  app.get('/world', (_req, res) => {
    const worldHtml = path.join(webDistPath, 'world', 'index.html');
    if (fs.existsSync(worldHtml)) {
      return sendFreshHtml(res, worldHtml);
    }
    sendFreshHtml(res, path.join(webDistPath, 'index.html'));
  });

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      return next();
    }
    const cleanPath = req.path.replace(/^\//, '');
    if (cleanPath === '' || cleanPath === '/') {
      return sendFreshHtml(res, path.join(webDistPath, 'index.html'));
    }
    const htmlFile = path.join(webDistPath, cleanPath, 'index.html');
    if (fs.existsSync(htmlFile)) {
      return sendFreshHtml(res, htmlFile);
    }
    const directFile = path.join(webDistPath, `${cleanPath}.html`);
    if (fs.existsSync(directFile)) {
      return sendFreshHtml(res, directFile);
    }
    // 404 Not Found fallback
    const notFoundFile = path.join(webDistPath, '404.html');
    if (fs.existsSync(notFoundFile)) {
      res.status(404);
      return sendFreshHtml(res, notFoundFile);
    }
    sendFreshHtml(res, path.join(webDistPath, 'index.html'));
  });
}

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'InternalServerError', message: 'An unexpected error occurred' });
});
