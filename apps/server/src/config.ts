import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load root environment files. `.env.local` is loaded first, so its local values
// win over `.env` without overriding values explicitly supplied by the hosting environment.
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const projectRoot = path.resolve(__dirname, '../../../');
  dotenv.config({ path: path.join(projectRoot, '.env.local') });
  dotenv.config({ path: path.join(projectRoot, '.env') });
} catch { /* ignore in serverless */ }
dotenv.config();

const useLiveDb = process.env.USE_LIVE_DB === 'true';
const appEnv = process.env.APP_ENV || (process.env.NODE_ENV === 'production' ? 'production' : 'local');
const defaultLocalDatabaseUrl = 'postgresql://spot_user:spot_secret_password@localhost:55432/spot_db';
const configuredDatabaseUrl = process.env.DATABASE_URL || '';
const databaseUrl = (!useLiveDb && appEnv === 'local' && configuredDatabaseUrl.includes('supabase'))
  ? defaultLocalDatabaseUrl
  : configuredDatabaseUrl || (appEnv === 'local' ? defaultLocalDatabaseUrl : '');

export const config = {
  port: parseInt(process.env.PORT || '5050', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  appEnv,
  databaseUrl,
  cookieSecret: process.env.COOKIE_SECRET || 'spot_default_cookie_secret_at_least_32_chars',
  corsOrigin: process.env.CORS_ORIGIN || 'https://www.claimyourspot.lol',
  rpId: process.env.WEBAUTHN_RP_ID || (appEnv === 'local' ? 'localhost' : 'www.claimyourspot.lol'),
  rpOrigin: process.env.WEBAUTHN_ORIGIN || (appEnv === 'local' ? 'http://localhost:4322' : 'https://www.claimyourspot.lol'),
  isProd: process.env.NODE_ENV === 'production',
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
  adminSecret: process.env.ADMIN_SECRET || process.env.SHOWCASE_ADMIN_TOKEN || 'spot_admin_secret_key',
};
