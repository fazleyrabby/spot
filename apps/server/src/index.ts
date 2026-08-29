import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { checkDbConnection } from './db.js';
import { apiRouter } from './routes.js';

const app = express();

// Trust proxy for accurate IP rate limiting behind Cloudflare/Vercel
app.set('trust proxy', 1);

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow localhost and specified CORS origin
      if (!origin || origin.startsWith('http://localhost') || origin === config.corsOrigin) {
        callback(null, true);
      } else {
        callback(null, true); // Allow during dev/preview
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

async function start() {
  console.log('--- Starting Spot Authoritative Backend ---');
  const dbConnected = await checkDbConnection();
  if (!dbConnected) {
    console.warn('[Warning] PostgreSQL is not reachable. Ensure DATABASE_URL is valid or Docker is running.');
  }

  app.listen(config.port, () => {
    console.log(`🚀 Spot API server listening on http://localhost:${config.port}`);
    console.log(`📦 Environment: ${config.nodeEnv}`);
  });
}

start();
