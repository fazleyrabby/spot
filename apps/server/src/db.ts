import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl.includes('supabase.co') || config.databaseUrl.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : undefined,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
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
    return true;
  } catch (err) {
    console.error('[Database Connection Failed]', err);
    return false;
  }
}
