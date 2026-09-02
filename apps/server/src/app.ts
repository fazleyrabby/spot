import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { config } from './config.js';
import { apiRouter } from './routes.js';

export const app: express.Express = express();

// Trust proxy for accurate IP rate limiting behind Cloudflare/Vercel
app.set('trust proxy', 1);

// Vercel functions pre-parse JSON into req.body — tell express.json to skip
// so route handlers still receive the parsed body.
app.use((req, _res, next) => {
  if (req.body && typeof req.body === 'object' && !(req as any)._body) {
    (req as any)._body = true;
  }
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      // Only allow the app's own origin (no third-party origins)
      const isLocalOrigin = config.appEnv === 'local' && origin?.startsWith('http://localhost');
      if (!origin || isLocalOrigin || origin === config.corsOrigin) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);

app.use(cookieParser(config.cookieSecret));
app.use(express.json({ limit: '64kb' }));

// Healthcheck endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Mount API router
app.use('/api', apiRouter);

// Serve static frontend in production if dist exists
const webDistPath = process.env.WEB_DIST_PATH || path.resolve(process.cwd(), '../web/dist');
if (fs.existsSync(webDistPath)) {
  app.use(express.static(webDistPath, { maxAge: '1d', index: false }));

  app.get('/world', (_req, res) => {
    const worldHtml = path.join(webDistPath, 'world', 'index.html');
    if (fs.existsSync(worldHtml)) {
      return res.sendFile(worldHtml);
    }
    res.sendFile(path.join(webDistPath, 'index.html'));
  });

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      return next();
    }
    const htmlFile = path.join(webDistPath, req.path.replace(/^\//, ''), 'index.html');
    if (fs.existsSync(htmlFile)) {
      return res.sendFile(htmlFile);
    }
    res.sendFile(path.join(webDistPath, 'index.html'));
  });
}

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'InternalServerError', message: 'An unexpected error occurred' });
});
