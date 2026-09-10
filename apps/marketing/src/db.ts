import pg from 'pg';
import { config } from './config.js';

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!pool) {
    if (!config.databaseUrl) throw new Error('DATABASE_URL is not configured');
    const needsSsl =
      config.databaseUrl.includes('supabase.co') ||
      config.databaseUrl.includes('sslmode=require');
    pool = new pg.Pool({
      connectionString: config.databaseUrl,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
      max: 4,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

export interface Claim {
  x: number;
  y: number;
  claimedAt: string;
  displayName: string;
  tagline: string | null;
}

export interface Totals {
  claimed: number;
  citizens: number;
}

export async function ensureMarketingTables(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS marketing_state (
      key VARCHAR(64) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS marketing_posts (
      id SERIAL PRIMARY KEY,
      channel VARCHAR(32) NOT NULL,
      body TEXT NOT NULL,
      external_id VARCHAR(128),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function getLastCursor(): Promise<string> {
  const res = await getPool().query<{ value: string }>(
    `SELECT value FROM marketing_state WHERE key = 'last_claim_cursor'`,
  );
  if (res.rows[0]?.value) return res.rows[0].value;
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

export async function setLastCursor(iso: string): Promise<void> {
  await getPool().query(
    `INSERT INTO marketing_state (key, value, updated_at)
     VALUES ('last_claim_cursor', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [iso],
  );
}

export async function getRecentClaims(sinceIso: string): Promise<Claim[]> {
  const res = await getPool().query<Claim>(
    `SELECT s.x, s.y,
            s.claimed_at AS "claimedAt",
            c.display_name AS "displayName",
            c.tagline
     FROM spots s
     JOIN citizens c ON c.id = s.owner_id
     WHERE s.owner_id IS NOT NULL AND s.claimed_at > $1
     ORDER BY s.claimed_at DESC
     LIMIT 50`,
    [sinceIso],
  );
  return res.rows;
}

export async function getTotals(): Promise<Totals> {
  const res = await getPool().query<{ claimed: string; citizens: string }>(
    `SELECT
       (SELECT COUNT(*) FROM spots WHERE owner_id IS NOT NULL) AS claimed,
       (SELECT COUNT(*) FROM citizens) AS citizens`,
  );
  const row = res.rows[0];
  return { claimed: Number(row?.claimed ?? 0), citizens: Number(row?.citizens ?? 0) };
}

export async function recordPost(
  channel: string,
  body: string,
  externalId: string | null,
): Promise<void> {
  await getPool().query(
    `INSERT INTO marketing_posts (channel, body, external_id) VALUES ($1, $2, $3)`,
    [channel, body, externalId],
  );
}
