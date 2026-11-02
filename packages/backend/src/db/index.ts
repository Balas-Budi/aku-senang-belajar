import { drizzle, type NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import pg from 'pg';
import * as schema from './schema.ts';

export function createDatabase(connectionString: string) {
    const pool = new pg.Pool({ connectionString });

    return { db: drizzle(pool, { schema, casing: 'snake_case' }), pool };
}

export type Database = ReturnType<typeof createDatabase>['db'];

export type Queryable = PgDatabase<NodePgQueryResultHKT, typeof schema>;
