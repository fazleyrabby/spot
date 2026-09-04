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
    return true;
  } catch (err) {
    console.error('[Database Connection Failed]', err);
    return false;
  }
}
