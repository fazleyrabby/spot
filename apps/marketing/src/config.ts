import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../../../.env') });
dotenv.config({ path: path.resolve(here, '../.env') });

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export const config = {
  databaseUrl: process.env.DATABASE_URL || '',
  appUrl: (process.env.MARKETING_APP_URL || 'https://claimyourspot.lol').replace(/\/$/, ''),

  bskyHandle: process.env.BSKY_HANDLE || '',
  bskyAppPassword: process.env.BSKY_APP_PASSWORD || '',
  bskyServiceUrl: process.env.BSKY_SERVICE_URL || 'https://bsky.social',

  xApiKey: process.env.X_API_KEY || '',
  xApiSecret: process.env.X_API_SECRET || '',
  xAccessToken: process.env.X_ACCESS_TOKEN || '',
  xAccessSecret: process.env.X_ACCESS_SECRET || '',

  igUserId: process.env.IG_USER_ID || '',
  igAccessToken: process.env.IG_ACCESS_TOKEN || '',
  igGraphVersion: process.env.IG_GRAPH_VERSION || 'v21.0',

  intervalMinutes: Number(process.env.MARKETING_INTERVAL_MINUTES || 1440),
  alwaysPost: bool(process.env.MARKETING_ALWAYS_POST),
  maxClaimsPerPost: Number(process.env.MARKETING_MAX_CLAIMS || 5),
};

export const hasBluesky = Boolean(config.bskyHandle && config.bskyAppPassword);
export const hasTwitter = Boolean(
  config.xApiKey && config.xApiSecret && config.xAccessToken && config.xAccessSecret,
);
export const hasInstagram = Boolean(config.igUserId && config.igAccessToken);
