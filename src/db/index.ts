import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, types } from 'pg';
import * as schema from './schema.js';

// PostgreSQL `date` columns are business-date-only values (no time-of-day,
// no timezone) — e.g. a liability's end date. node-postgres's default type
// parser for oid 1082 (date) converts them into a JS Date built from local
// year/month/day, which then silently shifts by one calendar day whenever
// the value is later serialized through a UTC-based path (toISOString) on a
// process not running with TZ=UTC. Registering a raw passthrough parser
// keeps these columns as the exact "YYYY-MM-DD" string Postgres sends, so
// no code path can reintroduce a timezone conversion for a value that never
// had a time component to begin with.
types.setTypeParser(1082, (value: string) => value);

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!globalThis._postgresPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }
    globalThis._postgresPool = new Pool({
      connectionString,
      max: 10,
      connectionTimeoutMillis: 15000,
    });

    globalThis._postgresPool.on('error', (err: any) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return globalThis._postgresPool;
};

const pool = createPool();
export const db = drizzle(pool, { schema });

export async function closeDatabase(): Promise<void> {
  if (globalThis._postgresPool) {
    await globalThis._postgresPool.end();
    globalThis._postgresPool = undefined;
  }
}
