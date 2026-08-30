import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
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
      if (!origin || origin.startsWith('http://localhost') || origin === config.corsOrigin) {
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

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'InternalServerError', message: 'An unexpected error occurred' });
});
