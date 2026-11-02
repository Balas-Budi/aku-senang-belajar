import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { testDatabaseUrl } from './helpers.ts';

export async function globalSetup(): Promise<void> {
    const pool = new pg.Pool({ connectionString: testDatabaseUrl() });

    try {
        await migrate(drizzle(pool), {
            migrationsFolder: fileURLToPath(
                new URL('../drizzle', import.meta.url),
            ),
        });
    } finally {
        await pool.end();
    }
}
