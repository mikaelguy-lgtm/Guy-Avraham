import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!globalThis._postgresPool) {
    globalThis._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
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
