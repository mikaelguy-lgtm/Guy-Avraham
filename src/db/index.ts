import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

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
