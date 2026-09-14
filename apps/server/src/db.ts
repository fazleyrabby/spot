import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

let _pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!_pool) {
    const needsSsl =
      config.databaseUrl.includes('supabase.co') ||
      config.databaseUrl.includes('pooler.supabase.com') ||
      config.databaseUrl.includes('sslmode=require');
    _pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    _pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
    });
  }
  return _pool;
}

export const pool = new Proxy({} as pg.Pool, {
  get(_target, prop, _receiver) {
    return (getPool() as any)[prop];
  },
});

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const res = await getPool().query<T>(text, params);
  const duration = Date.now() - start;
  if (config.nodeEnv === 'development' && duration > 200) {
    console.warn(`[DB Slow Query] ${duration}ms: ${text.slice(0, 80)}...`);
  }
  return res;
}

export async function checkDbConnection(): Promise<boolean> {
  try {
    const res = await query('SELECT 1 as health, count(*) as spot_count FROM spots');
    console.log(`[Database Connected] Spots in registry: ${res.rows[0].spot_count}`);
    // Automatically migrate any legacy single-token session hashes into multi-session table
    await query(`
      INSERT INTO citizen_sessions (citizen_id, token_hash)
      SELECT id, session_token_hash FROM citizens
      WHERE session_token_hash IS NOT NULL AND session_token_hash <> ''
      ON CONFLICT (token_hash) DO NOTHING;
    `).catch(() => {});
    // Ensure email_logs table exists for transactional email tracking
    await query(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id SERIAL PRIMARY KEY,
        kind VARCHAR(32) NOT NULL,
        reference_id VARCHAR(128) NOT NULL,
        recipient_email VARCHAR(255) NOT NULL,
        resend_id VARCHAR(64),
        status VARCHAR(16) DEFAULT 'sent',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT email_logs_kind_reference_unique UNIQUE (kind, reference_id)
      );
    `).catch(() => {});
    // Ensure citizen and billboard view tracking tables and columns exist
    await query(`
      ALTER TABLE citizens ADD COLUMN IF NOT EXISTS views_count INT NOT NULL DEFAULT 0;
      CREATE TABLE IF NOT EXISTS citizen_clicks (
        citizen_id VARCHAR(64) NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
        visitor_hash VARCHAR(64) NOT NULL,
        clicked_date DATE NOT NULL DEFAULT CURRENT_DATE,
        PRIMARY KEY (citizen_id, visitor_hash, clicked_date)
      );
      CREATE INDEX IF NOT EXISTS idx_citizen_clicks_cit_date ON citizen_clicks(citizen_id, clicked_date);

      ALTER TABLE billboard_orders ADD COLUMN IF NOT EXISTS views_count INT NOT NULL DEFAULT 0;
      CREATE TABLE IF NOT EXISTS billboard_clicks (
        billboard_id VARCHAR(64) NOT NULL,
        visitor_hash VARCHAR(64) NOT NULL,
        clicked_date DATE NOT NULL DEFAULT CURRENT_DATE,
        PRIMARY KEY (billboard_id, visitor_hash, clicked_date)
      );
      CREATE INDEX IF NOT EXISTS idx_billboard_clicks_bb_date ON billboard_clicks(billboard_id, clicked_date);

      CREATE TABLE IF NOT EXISTS billboard_stats (
        billboard_id VARCHAR(64) PRIMARY KEY,
        views_count INT NOT NULL DEFAULT 0
      );

      -- Unified world interaction & click logs table
      CREATE TABLE IF NOT EXISTS world_click_logs (
        id BIGSERIAL PRIMARY KEY,
        target_type VARCHAR(32) NOT NULL,
        target_id VARCHAR(64) NOT NULL,
        source VARCHAR(32) NOT NULL DEFAULT '2d',
        visitor_hash VARCHAR(64) NOT NULL,
        country VARCHAR(8),
        city VARCHAR(64),
        clicked_date DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_world_clicks_unique
        ON world_click_logs (target_type, target_id, visitor_hash, clicked_date);
      CREATE INDEX IF NOT EXISTS idx_world_clicks_lookup
        ON world_click_logs (target_type, target_id, clicked_date);

      CREATE TABLE IF NOT EXISTS world_interaction_stats (
        target_type VARCHAR(32) NOT NULL,
        target_id VARCHAR(64) NOT NULL,
        total_clicks BIGINT NOT NULL DEFAULT 0,
        unique_visitors BIGINT NOT NULL DEFAULT 0,
        last_clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (target_type, target_id)
      );

      -- Backfill legacy clicks into unified table
      INSERT INTO world_click_logs (target_type, target_id, source, visitor_hash, clicked_date, created_at)
      SELECT 'citizen', citizen_id, '2d', visitor_hash, clicked_date, clicked_date::timestamp
      FROM citizen_clicks
      ON CONFLICT (target_type, target_id, visitor_hash, clicked_date) DO NOTHING;

      INSERT INTO world_click_logs (target_type, target_id, source, visitor_hash, clicked_date, created_at)
      SELECT 'billboard', billboard_id, '2d', visitor_hash, clicked_date, clicked_date::timestamp
      FROM billboard_clicks
      ON CONFLICT (target_type, target_id, visitor_hash, clicked_date) DO NOTHING;

      INSERT INTO world_interaction_stats (target_type, target_id, total_clicks, unique_visitors, last_clicked_at)
      SELECT 'billboard', billboard_id, views_count, views_count, NOW()
      FROM billboard_stats
      ON CONFLICT (target_type, target_id) DO UPDATE SET
        total_clicks = GREATEST(world_interaction_stats.total_clicks, EXCLUDED.total_clicks),
        unique_visitors = GREATEST(world_interaction_stats.unique_visitors, EXCLUDED.unique_visitors);
    `).catch(() => {});
    return true;
  } catch (err) {
    console.error('[Database Connection Failed]', err);
    return false;
  }
}
