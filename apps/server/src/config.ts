import dotenv from 'dotenv';

// Load root .env (safe to fail — Vercel sets env vars via dashboard)
try {
  if (typeof import.meta.url !== 'undefined') {
    const { fileURLToPath } = await import('url');
    const { default: path } = await import('path');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
  }
} catch { /* ignore in Vercel/serverless */ }
dotenv.config(); // fallback to local cwd

export const config = {
  port: parseInt(process.env.PORT || '5050', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/spot_db',
  cookieSecret: process.env.COOKIE_SECRET || 'spot_default_cookie_secret_at_least_32_chars',
  corsOrigin: process.env.CORS_ORIGIN || 'https://www.claimyourspot.lol',
  isProd: process.env.NODE_ENV === 'production',
};
