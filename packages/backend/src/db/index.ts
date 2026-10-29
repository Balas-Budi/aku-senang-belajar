import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.ts';

export function createDatabase(connectionString: string) {
    const pool = new pg.Pool({ connectionString });

    return { db: drizzle(pool, { schema }), pool };
}
