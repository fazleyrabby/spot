import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config(); // fallback to local cwd

export const config = {
  port: parseInt(process.env.PORT || '5050', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/spot_db',
  cookieSecret: process.env.COOKIE_SECRET || 'spot_default_cookie_secret_at_least_32_chars',
  corsOrigin: process.env.CORS_ORIGIN || 'https://www.claimyourspot.lol',
  isProd: process.env.NODE_ENV === 'production',
};
